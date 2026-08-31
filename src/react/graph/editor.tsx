import {
    Background,
    BackgroundVariant,
    Controls,
    MarkerType,
    ReactFlow,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
    type NodeChange,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    definitionLesen,
    sichtbarkeit,
    type FormularDefinition,
    type Knotenposition,
    type RoheDefinition,
} from '../../core';
import {
    knotenAusDefinition,
    positionenSchreiben,
    unterkanteVon,
} from './anordnung';
import {
    kanteEntfernen,
    kantenAusDefinition,
    regelAnlegen,
    regelEntfernen,
    regelKnoten,
    verbindungVerarbeiten,
} from './kanten';
import { zielArtVon, type Knotenart } from './kennung';
import { KNOTENARTEN } from './knoten';

/**
 * Der Vorgabewert fuer `gesperrteFelder` — als Konstante und nicht als
 * `= {}` an der Stelle.
 *
 * Ein Objektliteral im Parameter entsteht bei JEDEM Rendern neu. Es haengt an
 * einem `useMemo`, das daran haengt, das an einem `useEffect`, der den Zustand
 * setzt — und schon rendert die Komponente sich selbst im Kreis, bis React
 * abbricht. Genau so ist es beim Bauen passiert.
 */
const KEINE_SPERREN: Record<string, string> = {};

export interface GraphEditorProps {
    definition: RoheDefinition;
    onChange: (definition: FormularDefinition) => void;
    /**
     * Gesperrte Felder: Feldname → Begruendung.
     *
     * Dieselbe Bedeutung wie im Listen-Editor. Der Graph zeigt die Sperre nur
     * an; der Waechter auf der Serverseite bleibt die verbindliche Stelle.
     */
    gesperrteFelder?: Record<string, string>;
    /** Hoehe der Zeichenflaeche. React Flow braucht eine, sonst bleibt sie leer. */
    hoehe?: string;
}

/**
 * Der Knoten-Editor.
 *
 * Er ist eine ANSICHT auf die Definition, kein zweites Format. Struktur kommt
 * aus `layoutAufloesen()`, Bedingungen aus `conditions`, Verzweigungen aus
 * `flow` — unter `graph` stehen ausschliesslich Positionen. Jede gezogene
 * Kante aendert deshalb die DEFINITION und nicht den Graphen.
 *
 * Ein Formular, das nie hier war, laesst sich trotzdem oeffnen: die Anordnung
 * entsteht dann aus der Reihenfolge, und zwar beim zweiten Oeffnen genauso wie
 * beim ersten.
 */
export default function GraphEditor({
    definition,
    onChange,
    gesperrteFelder = KEINE_SPERREN,
    hoehe = '600px',
}: GraphEditorProps) {
    const gelesen = useMemo(() => definitionLesen(definition), [definition]);
    const zyklen = useMemo(() => sichtbarkeit(gelesen).zyklen, [gelesen]);

    const strukturKnoten = useMemo(
        () => knotenAusDefinition(gelesen),
        [gelesen],
    );

    const regelEntfernenUndMelden = useCallback(
        (regelId: string) => onChange(regelEntfernen(gelesen, regelId)),
        [gelesen, onChange],
    );

    const gebaut = useMemo<Node[]>(() => {
        const aus: Node[] = strukturKnoten.map((knoten) => ({
            id: knoten.id,
            type: knoten.art,
            position: knoten.position,
            ...(knoten.parentId
                ? { parentId: knoten.parentId, extent: 'parent' as const }
                : {}),
            // Rahmen liegen unter ihren Kindern, sonst faengt die Flaeche des
            // Rahmens jeden Klick ab, der einem Feld darin gilt.
            ...(knoten.art === 'feld' ? {} : { style: { zIndex: -1 } }),
            width: knoten.breite,
            height: knoten.hoehe,
            data: {
                titel: knoten.titel,
                feldTyp: knoten.feldTyp ?? '',
                pflicht: knoten.pflicht ?? false,
                ...(gesperrteFelder[knoten.ref]
                    ? { gesperrt: gesperrteFelder[knoten.ref] }
                    : {}),
            },
        }));

        for (const regel of regelKnoten(
            gelesen,
            zyklen,
            unterkanteVon(strukturKnoten),
        )) {
            aus.push({
                id: regel.id,
                type: 'regel',
                position: regel.position,
                width: regel.breite,
                height: regel.hoehe,
                data: {
                    titel: regel.titel,
                    imKreis: regel.imKreis,
                    entfernen: () => regelEntfernenUndMelden(regel.ref),
                },
            });
        }

        return aus;
    }, [gelesen, gesperrteFelder, regelEntfernenUndMelden, strukturKnoten, zyklen]);

    const gebauteKanten = useMemo<Edge[]>(
        () =>
            kantenAusDefinition(gelesen, zyklen).map((kante) => ({
                id: kante.id,
                source: kante.quelle,
                target: kante.ziel,
                label: kante.beschriftung,
                animated: kante.art === 'ablauf',
                markerEnd: { type: MarkerType.ArrowClosed },
                ...(kante.imKreis
                    ? { style: { stroke: '#dc2626', strokeDasharray: '4 4' } }
                    : {}),
            })),
        [gelesen, zyklen],
    );

    const [knoten, setKnoten, onKnotenChange] = useNodesState(gebaut);
    const [kanten, setKanten, onKantenChange] = useEdgesState(gebauteKanten);

    // Die Definition gehoert der Anwendung. Aendert sie sich — weil hier eine
    // Regel entstanden ist oder weil jemand daneben am Listen-Editor
    // gearbeitet hat — muss der Graph nachziehen, sonst zeigt er einen Stand,
    // den es nicht mehr gibt.
    //
    // Uebernommen wird aber nur, wenn sich INHALTLICH etwas geaendert hat.
    // Der Grund ist nicht Sparsamkeit: reicht eine Anwendung `gesperrteFelder`
    // als Objektliteral herein, entsteht bei jedem Rendern ein neues, das
    // `useMemo` faellt durch, der Effekt setzt den Zustand, und die Komponente
    // rendert sich im Kreis, bis React abbricht. Die Konstante oben verhindert
    // den Fall im Paket, dieser Vergleich auch den in der Anwendung.
    const knotenSignatur = useMemo(() => signaturVon(gebaut), [gebaut]);
    const kantenSignatur = useMemo(() => JSON.stringify(gebauteKanten), [gebauteKanten]);
    const letzteKnoten = useRef<string | null>(null);
    const letzteKanten = useRef<string | null>(null);

    useEffect(() => {
        if (letzteKnoten.current === knotenSignatur) {
            return;
        }

        letzteKnoten.current = knotenSignatur;
        setKnoten(gebaut);
    }, [gebaut, knotenSignatur, setKnoten]);

    useEffect(() => {
        if (letzteKanten.current === kantenSignatur) {
            return;
        }

        letzteKanten.current = kantenSignatur;
        setKanten(gebauteKanten);
    }, [gebauteKanten, kantenSignatur, setKanten]);

    const positionenSichern = useCallback(
        (stand: Node[]) => {
            const positionen: Record<string, Knotenposition> = {};

            for (const eintrag of stand) {
                positionen[eintrag.id] = {
                    x: Math.round(eintrag.position.x),
                    y: Math.round(eintrag.position.y),
                };
            }

            onChange(positionenSchreiben(gelesen, positionen));
        },
        [gelesen, onChange],
    );

    const knotenGeaendert = useCallback(
        (aenderungen: NodeChange[]) => {
            onKnotenChange(aenderungen);

            // Erst beim Loslassen sichern, nicht bei jedem Pixel: sonst
            // schreibt ein einziges Ziehen hunderte Aenderungen in die
            // Definition, und ein „ungespeichert"-Hinweis flackert dauerhaft.
            const losgelassen = aenderungen.some(
                (aenderung) =>
                    aenderung.type === 'position' && aenderung.dragging === false,
            );

            if (losgelassen) {
                setKnoten((stand) => {
                    positionenSichern(stand);

                    return stand;
                });
            }
        },
        [onKnotenChange, positionenSichern, setKnoten],
    );

    const verbinden = useCallback(
        (verbindung: Connection) => {
            if (!verbindung.source || !verbindung.target) {
                return;
            }

            // Ueber dieselbe Stelle wie die Auswahlfelder: zwei Wege, die
            // verschiedene Regeln erzeugen, waeren zwei Bedeutungen derselben
            // Geste.
            const naechste = verbindungVerarbeiten(
                gelesen,
                verbindung.source,
                verbindung.target,
            );

            if (naechste) {
                onChange(naechste);
            }
        },
        [gelesen, onChange],
    );

    const kantenEntfernt = useCallback(
        (entfernte: Edge[]) => {
            let naechste = gelesen;

            for (const kante of entfernte) {
                naechste = kanteEntfernen(naechste, kante.id);
            }

            onChange(naechste);
        },
        [gelesen, onChange],
    );

    const anordnungZuruecksetzen = useCallback(() => {
        // Ohne `graph` faellt die Anordnung auf die abgeleitete zurueck — und
        // die entsteht aus der Reihenfolge, also bei jedem Oeffnen gleich.
        onChange(positionenSchreiben(gelesen, {}));
    }, [gelesen, onChange]);

    return (
        <div className="pm-fb-graph" style={{ height: hoehe }}>
            <div className="pm-fb-graph__leiste">
                <BedingungAnlegen
                    knoten={strukturKnoten}
                    onAnlegen={(feld, ziel) => onChange(regelAnlegen(gelesen, feld, ziel))}
                />

                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--still"
                    onClick={anordnungZuruecksetzen}
                >
                    Anordnung zurücksetzen
                </button>
            </div>

            {zyklen.length > 0 && (
                <p className="pm-fb-graph__warnung" role="status">
                    {zyklen.length === 1
                        ? 'Eine Bedingung hängt im Kreis und wird nicht angewendet.'
                        : `${zyklen.length} Bedingungen hängen im Kreis und werden nicht angewendet.`}
                </p>
            )}

            <ReactFlow
                nodes={knoten}
                edges={kanten}
                onNodesChange={knotenGeaendert}
                onEdgesChange={onKantenChange}
                onEdgesDelete={kantenEntfernt}
                onConnect={verbinden}
                nodeTypes={KNOTENARTEN}
                fitView
            >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <Controls />
            </ReactFlow>
        </div>
    );
}

/**
 * Der Inhalt der Knoten als Zeichenkette — ohne die Rueckrufe.
 *
 * Eine Funktion laesst sich nicht vergleichen; sie ist bei jedem Rendern eine
 * andere, und ein Vergleich, der sie einschliesst, meldet immer „geaendert".
 */
function signaturVon(knoten: Node[]): string {
    return JSON.stringify(
        knoten.map((eintrag) => ({
            id: eintrag.id,
            typ: eintrag.type,
            eltern: eintrag.parentId ?? null,
            breite: eintrag.width,
            hoehe: eintrag.height,
            position: eintrag.position,
            daten: Object.fromEntries(
                Object.entries(eintrag.data ?? {}).filter(
                    ([, wert]) => typeof wert !== 'function',
                ),
            ),
        })),
    );
}

/**
 * Eine Bedingung ueber Auswahlfelder statt ueber die Maus.
 *
 * Dieselbe Regel wie im Listen-Editor: was sich nur ziehen laesst, laesst
 * sich mit der Tastatur gar nicht. Der Weg hier ist absichtlich der kuerzeste
 * — zwei Auswahlen und eine Schaltflaeche; verfeinern laesst sich die Regel
 * danach.
 */
function BedingungAnlegen({
    knoten,
    onAnlegen,
}: {
    knoten: { id: string; ref: string; art: Knotenart; titel: string }[];
    onAnlegen: (
        feld: string,
        ziel: { kind: 'field' | 'group' | 'step'; ref: string },
    ) => void;
}) {
    const felder = knoten.filter((eintrag) => eintrag.art === 'feld');
    const [feld, setFeld] = useState('');
    const [ziel, setZiel] = useState('');

    if (felder.length === 0 || knoten.length < 2) {
        return null;
    }

    const anlegen = () => {
        const zielKnoten = knoten.find((eintrag) => eintrag.id === ziel);
        const art = zielKnoten ? zielArtVon(zielKnoten.art) : null;

        if (!feld || !zielKnoten || !art) {
            return;
        }

        onAnlegen(feld, { kind: art, ref: zielKnoten.ref });
    };

    return (
        <div className="pm-fb-graph__anlegen">
            <label className="pm-fb-graph__feld">
                <span>Wenn ausgefüllt</span>
                <select value={feld} onChange={(e) => setFeld(e.target.value)}>
                    <option value="">Feld wählen</option>
                    {felder.map((eintrag) => (
                        <option key={eintrag.id} value={eintrag.ref}>
                            {eintrag.titel}
                        </option>
                    ))}
                </select>
            </label>

            <label className="pm-fb-graph__feld">
                <span>zeige</span>
                <select value={ziel} onChange={(e) => setZiel(e.target.value)}>
                    <option value="">Ziel wählen</option>
                    {knoten
                        .filter((eintrag) => eintrag.ref !== feld)
                        .map((eintrag) => (
                            <option key={eintrag.id} value={eintrag.id}>
                                {eintrag.titel}
                            </option>
                        ))}
                </select>
            </label>

            <button
                type="button"
                className="pm-fb-knopf"
                onClick={anlegen}
                disabled={!feld || !ziel}
            >
                Bedingung anlegen
            </button>
        </div>
    );
}
