import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { useState } from 'react';

import {
    definitionLesen,
    feldAendern,
    feldEntfernen,
    feldHinzufuegen,
    feldVerschieben,
    knotenEntfernen,
    layoutSicherstellen,
    naechsterFeldname,
    zeileVerschieben,
    type Ablageziel,
    type FormularDefinition,
    type FormularFeld,
    type LayoutKnoten,
    type RoheDefinition,
} from '../../core';
import Feldmaske, { type FeldTypAuswahl } from './feldmaske';

export interface FormularEditorProps {
    definition: RoheDefinition;
    onChange: (definition: FormularDefinition) => void;
    /**
     * Gesperrte Felder: Feldname → Begründung, die der Nutzer lesen soll.
     *
     * Ein gesperrtes Feld lässt sich weder umbenennen noch entfernen. WARUM es
     * gesperrt ist, entscheidet das Produkt und nicht dieses Paket — der eine
     * sperrt Felder, unter denen bereits Antworten liegen, der andere solche,
     * die er für seine Rechnungen braucht. Ein hier fest verdrahteter Grund
     * wäre eine Regel des einen Produkts, die alle anderen mittragen müssten.
     *
     * Die Sperre hier zu zeigen erspart den Fehlschlag beim Speichern; der
     * Wächter auf der Serverseite bleibt die verbindliche Stelle.
     */
    gesperrteFelder?: Record<string, string>;
    zusatzTypen?: FeldTypAuswahl[];
}

/**
 * Wohin eine Ablage zeigt — kodiert in der Droppable-Kennung.
 *
 * Der zweite Abschnitt ist der Pfad in den Rahmen: leer die oberste Ebene,
 * sonst die Indizes der Gruppen und Schritte mit Punkten dazwischen. Ohne ihn
 * zeigte jede Ablagestelle einer Gruppe auf die gleichnamige Zeile GANZ OBEN.
 */
function zielLesen(id: string): Ablageziel | null {
    const teile = id.split(':');
    const pfad =
        teile[1] === undefined || teile[1] === ''
            ? []
            : teile[1].split('.').map(Number);

    if (teile[0] === 'neuezeile' && teile[2] !== undefined) {
        return { art: 'neueZeile', pfad, position: Number(teile[2]) };
    }

    if (teile[0] === 'spalte' && teile[2] !== undefined && teile[3] !== undefined) {
        return { art: 'spalte', pfad, zeile: Number(teile[2]), position: Number(teile[3]) };
    }

    return null;
}

/** Der Pfad als Teil einer Droppable-Kennung. */
function pfadKennung(pfad: number[]): string {
    return pfad.join('.');
}

function Ablagestelle({ id, waagerecht = false }: { id: string; waagerecht?: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={[
                'pm-fb-ablage',
                waagerecht ? 'pm-fb-ablage--waagerecht' : '',
                isOver ? 'pm-fb-ablage--aktiv' : '',
            ]
                .filter(Boolean)
                .join(' ')}
            aria-hidden="true"
        />
    );
}

function ZiehbaresFeld({
    feld,
    children,
}: {
    feld: FormularFeld;
    children: React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `feld:${feld.name}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={`pm-fb-karte${isDragging ? ' pm-fb-karte--zieht' : ''}`}
        >
            <div className="pm-fb-karte__kopf">
                <button
                    type="button"
                    className="pm-fb-griff"
                    aria-label={`${feld.label} verschieben`}
                    {...attributes}
                    {...listeners}
                >
                    ⠿
                </button>
                {children}
            </div>
        </div>
    );
}

/**
 * Der Baukasten für Formular-Definitionen.
 *
 * Gezogen wird mit der Maus; jede Bewegung geht zusätzlich über Schaltflächen.
 * Das ist kein Zusatz, sondern die Bedingung dafür, dass der Baukasten mit der
 * Tastatur bedienbar bleibt — freies Ziehen und Ablegen ohne Maus ist auch mit
 * Hilfsmitteln kaum zu treffen.
 */
export default function FormularEditor({
    definition,
    onChange,
    gesperrteFelder = {},
    zusatzTypen = [],
}: FormularEditorProps) {
    const [offen, setOffen] = useState<string | null>(null);

    const gelesen = layoutSicherstellen(definitionLesen(definition));
    const { fields, layout } = gelesen;
    const nachName = new Map(fields.map((feld) => [feld.name, feld]));

    const sensoren = useSensors(
        useSensor(PointerSensor, {
            // Ohne Mindestabstand löst jeder Klick auf den Griff ein Ziehen
            // aus, und die Schaltflächen darunter reagieren nicht mehr.
            activationConstraint: { distance: 6 },
        }),
        useSensor(KeyboardSensor),
    );

    const feldHinzu = () => {
        const name = naechsterFeldname(gelesen);
        const neu: FormularFeld = {
            id: `feld_${name}`,
            name,
            label: 'Neues Feld',
            type: 'text',
            required: false,
        };

        onChange(feldHinzufuegen(gelesen, neu));
        setOffen(name);
    };

    const beimAblegen = (event: DragEndEvent) => {
        const gezogen = String(event.active.id);
        const ziel = event.over ? zielLesen(String(event.over.id)) : null;

        if (!ziel || !gezogen.startsWith('feld:')) {
            return;
        }

        onChange(feldVerschieben(gelesen, gezogen.slice('feld:'.length), ziel));
    };

    /**
     * Zeichnet eine Ebene des Layouts — und ruft sich fuer Rahmen selbst auf.
     *
     * Rekursiv und nicht flach, weil es seit den Gruppen und Schritten (#4658)
     * mehr als eine Ebene gibt. Die flache Fassung behandelte JEDEN Knoten als
     * Zeile und griff auf `columns` zu, das eine Gruppe nicht hat: Der ganze
     * Tab blieb leer, sobald irgendwo eine Gruppe stand (Bug #688). Die
     * Strukturansicht konnte Gruppen anlegen, die Liste stuerzte daran ab —
     * die beiden Ansichten waren nicht zwei Sichten auf dasselbe, sondern zwei
     * verschiedene Reichweiten.
     */
    const ebeneZeichnen = (liste: LayoutKnoten[], pfad: number[]) => {
        const kennung = pfadKennung(pfad);

        return (
            <>
                <Ablagestelle id={`neuezeile:${kennung}:0`} />

                {liste.map((knoten, index) => {
                    if (knoten.type === 'section') {
                        return (
                            <div key={`abschnitt_${index}`}>
                                <div className="pm-fb-karte pm-fb-karte--abschnitt">
                                    <strong>{knoten.title}</strong>
                                    <button
                                        type="button"
                                        className="pm-fb-knopf pm-fb-knopf--still"
                                        onClick={() =>
                                            onChange(knotenEntfernen(gelesen, index, pfad))
                                        }
                                    >
                                        Entfernen
                                    </button>
                                </div>
                                <Ablagestelle id={`neuezeile:${kennung}:${index + 1}`} />
                            </div>
                        );
                    }

                    if (knoten.type === 'group' || knoten.type === 'step') {
                        return (
                            <div key={`rahmen_${knoten.id}`}>
                                <div
                                    className={`pm-fb-rahmenblock pm-fb-rahmenblock--${
                                        knoten.type === 'group' ? 'gruppe' : 'schritt'
                                    }`}
                                >
                                    <div className="pm-fb-rahmenblock__kopf">
                                        <span className="pm-fb-rahmenblock__art">
                                            {knoten.type === 'group' ? 'Gruppe' : 'Schritt'}
                                        </span>
                                        <strong>
                                            {knoten.title ||
                                                (knoten.type === 'group' ? 'Gruppe' : 'Schritt')}
                                        </strong>
                                        <span className="pm-fb-rahmenblock__pfeile">
                                            <button
                                                type="button"
                                                className="pm-fb-knopf pm-fb-knopf--still"
                                                aria-label={`${knoten.title ?? ''} nach oben`}
                                                onClick={() =>
                                                    onChange(
                                                        zeileVerschieben(
                                                            gelesen,
                                                            index,
                                                            index - 1,
                                                            pfad,
                                                        ),
                                                    )
                                                }
                                            >
                                                ↑
                                            </button>
                                            <button
                                                type="button"
                                                className="pm-fb-knopf pm-fb-knopf--still"
                                                aria-label={`${knoten.title ?? ''} nach unten`}
                                                onClick={() =>
                                                    onChange(
                                                        zeileVerschieben(
                                                            gelesen,
                                                            index,
                                                            index + 1,
                                                            pfad,
                                                        ),
                                                    )
                                                }
                                            >
                                                ↓
                                            </button>
                                        </span>
                                    </div>

                                    {/*
                                        Anlegen und Aufloesen bleiben der
                                        Strukturansicht vorbehalten. Hier steht
                                        der Rahmen, damit man SIEHT, wo ein Feld
                                        liegt — und damit ein Formular mit
                                        Gruppen ueberhaupt eine Liste hat.
                                    */}
                                    {ebeneZeichnen(knoten.children, [...pfad, index])}
                                </div>
                                <Ablagestelle id={`neuezeile:${kennung}:${index + 1}`} />
                            </div>
                        );
                    }

                    const zeile = knoten;

                    return (
                        <div key={`zeile_${index}`}>
                            <div className="pm-fb-editorzeile">
                                <Ablagestelle id={`spalte:${kennung}:${index}:0`} waagerecht />

                                {zeile.columns.map((spalte, spaltenIndex) => (
                                    <div className="pm-fb-editorspalte" key={spaltenIndex}>
                                        {spalte.map((name) => {
                                            const feld = nachName.get(name);

                                            if (!feld) {
                                                return null;
                                            }

                                            return (
                                                <div key={name}>
                                                    <ZiehbaresFeld feld={feld}>
                                                        <span className="pm-fb-karte__titel">
                                                            {feld.label}
                                                            {feld.required && (
                                                                <span className="pm-fb-pflicht"> *</span>
                                                            )}
                                                        </span>
                                                        <span className="pm-fb-karte__knoepfe">
                                                            <button
                                                                type="button"
                                                                className="pm-fb-knopf pm-fb-knopf--still"
                                                                onClick={() =>
                                                                    setOffen(offen === name ? null : name)
                                                                }
                                                            >
                                                                {offen === name ? 'Fertig' : 'Bearbeiten'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="pm-fb-knopf pm-fb-knopf--still"
                                                                aria-label={`${feld.label} nach oben`}
                                                                onClick={() =>
                                                                    onChange(
                                                                        zeileVerschieben(
                                                                            gelesen,
                                                                            index,
                                                                            index - 1,
                                                                            pfad,
                                                                        ),
                                                                    )
                                                                }
                                                            >
                                                                ↑
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="pm-fb-knopf pm-fb-knopf--still"
                                                                aria-label={`${feld.label} nach unten`}
                                                                onClick={() =>
                                                                    onChange(
                                                                        zeileVerschieben(
                                                                            gelesen,
                                                                            index,
                                                                            index + 1,
                                                                            pfad,
                                                                        ),
                                                                    )
                                                                }
                                                            >
                                                                ↓
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="pm-fb-knopf pm-fb-knopf--gefahr"
                                                                aria-label={`${feld.label} entfernen`}
                                                                disabled={name in gesperrteFelder}
                                                                title={gesperrteFelder[name]}
                                                                onClick={() =>
                                                                    onChange(feldEntfernen(gelesen, name))
                                                                }
                                                            >
                                                                ✕
                                                            </button>
                                                        </span>
                                                    </ZiehbaresFeld>

                                                    {offen === name && (
                                                        <Feldmaske
                                                            feld={feld}
                                                            zusatzTypen={zusatzTypen}
                                                            sperrgrund={gesperrteFelder[name]}
                                                            onChange={(aenderungen) => {
                                                                onChange(
                                                                    feldAendern(gelesen, name, aenderungen),
                                                                );

                                                                if (
                                                                    aenderungen.name &&
                                                                    aenderungen.name !== name
                                                                ) {
                                                                    setOffen(aenderungen.name);
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <Ablagestelle
                                            id={`spalte:${kennung}:${index}:${spaltenIndex + 1}`}
                                            waagerecht
                                        />
                                    </div>
                                ))}
                            </div>

                            <Ablagestelle id={`neuezeile:${kennung}:${index + 1}`} />
                        </div>
                    );
                })}
            </>
        );
    };

    return (
        <div className="pm-fb-editor">
            <div className="pm-fb-editor__leiste">
                <span className="pm-fb-editor__zahl">
                    {fields.length} {fields.length === 1 ? 'Feld' : 'Felder'}
                </span>
                <button type="button" className="pm-fb-knopf" onClick={feldHinzu}>
                    Feld hinzufügen
                </button>
            </div>

            <DndContext
                sensors={sensoren}
                collisionDetection={closestCenter}
                onDragEnd={beimAblegen}
            >
                {ebeneZeichnen(layout, [])}
            </DndContext>

            {fields.length === 0 && (
                <p className="pm-fb-hinweis">
                    Noch keine Felder. „Feld hinzufügen" legt das erste an.
                </p>
            )}
        </div>
    );
}
