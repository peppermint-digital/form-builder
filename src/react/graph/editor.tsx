import {
    Background,
    BackgroundVariant,
    Controls,
    ReactFlow,
    useNodesState,
    type Node,
    type NodeChange,
} from '@xyflow/react';
import { useCallback, useMemo } from 'react';

import {
    definitionLesen,
    type FormularDefinition,
    type Knotenposition,
    type RoheDefinition,
} from '../../core';
import { knotenAusDefinition, positionenSchreiben } from './anordnung';
import { KNOTENARTEN } from './knoten';

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
 * aus `layoutAufloesen()`, die Positionen sind reine Kosmetik unter `graph`.
 * Ein Formular, das nie hier war, laesst sich trotzdem oeffnen — die
 * Anordnung entsteht dann aus der Reihenfolge, und zwar beim zweiten Oeffnen
 * genauso wie beim ersten.
 *
 * Was hier (noch) NICHT passiert: Struktur aendern. Ziehen verschiebt nur die
 * Darstellung. Felder anlegen, in Gruppen einsortieren und Bedingungen
 * verdrahten kommt in den naechsten Schritten dazu — und dort gilt wieder die
 * Regel des Listen-Editors, dass jede strukturelle Aenderung auch ueber
 * Schaltflaechen gehen muss, nicht nur mit der Maus.
 */
export default function GraphEditor({
    definition,
    onChange,
    gesperrteFelder = {},
    hoehe = '600px',
}: GraphEditorProps) {
    const gelesen = useMemo(() => definitionLesen(definition), [definition]);

    const anfang = useMemo<Node[]>(
        () =>
            knotenAusDefinition(gelesen).map((knoten) => ({
                id: knoten.id,
                type: knoten.art,
                position: knoten.position,
                ...(knoten.parentId
                    ? { parentId: knoten.parentId, extent: 'parent' as const }
                    : {}),
                // Rahmen liegen unter ihren Kindern, sonst faengt die Flaeche
                // des Rahmens jeden Klick ab, der einem Feld darin gilt.
                ...(knoten.art === 'feld' ? {} : { style: { zIndex: -1 } }),
                width: knoten.breite,
                height: knoten.hoehe,
                data: {
                    titel: knoten.titel,
                    feldTyp: knoten.feldTyp ?? '',
                    pflicht: knoten.pflicht ?? false,
                    ...(gesperrteFelder[knoten.id]
                        ? { gesperrt: gesperrteFelder[knoten.id] }
                        : {}),
                },
            })),
        [gelesen, gesperrteFelder],
    );

    const [knoten, setKnoten, onKnotenChange] = useNodesState(anfang);

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

    const anordnungZuruecksetzen = useCallback(() => {
        setKnoten(anfang);

        // Ohne `graph` faellt die Anordnung auf die abgeleitete zurueck — und
        // die entsteht aus der Reihenfolge, also bei jedem Oeffnen gleich.
        onChange(positionenSchreiben(gelesen, {}));
    }, [anfang, gelesen, onChange, setKnoten]);

    return (
        <div className="pm-fb-graph" style={{ height: hoehe }}>
            <div className="pm-fb-graph__leiste">
                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--still"
                    onClick={anordnungZuruecksetzen}
                >
                    Anordnung zurücksetzen
                </button>
            </div>

            <ReactFlow
                nodes={knoten}
                edges={[]}
                onNodesChange={knotenGeaendert}
                nodeTypes={KNOTENARTEN}
                fitView
                proOptions={{ hideAttribution: false }}
            >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
