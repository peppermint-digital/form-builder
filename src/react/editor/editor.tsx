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
    type LayoutZeile,
    type RoheDefinition,
} from '../../core';
import Feldmaske, { type FeldTypAuswahl } from './feldmaske';

export interface FormularEditorProps {
    definition: RoheDefinition;
    onChange: (definition: FormularDefinition) => void;
    /**
     * Feldnamen, unter denen bereits Antworten liegen. Ihr Schlüssel ist
     * gesperrt — dieselbe Regel, die der Wächter auf der Serverseite
     * durchsetzt. Sie hier zu zeigen erspart den Fehlschlag beim Speichern.
     */
    gesperrteNamen?: string[];
    zusatzTypen?: FeldTypAuswahl[];
}

/** Wohin eine Ablage zeigt — kodiert in der Droppable-Kennung. */
function zielLesen(id: string): Ablageziel | null {
    const teile = id.split(':');

    if (teile[0] === 'neuezeile' && teile[1] !== undefined) {
        return { art: 'neueZeile', position: Number(teile[1]) };
    }

    if (teile[0] === 'spalte' && teile[1] !== undefined && teile[2] !== undefined) {
        return { art: 'spalte', zeile: Number(teile[1]), position: Number(teile[2]) };
    }

    return null;
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
    gesperrteNamen = [],
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
                <Ablagestelle id="neuezeile:0" />

                {layout.map((knoten, index) => {
                    if (knoten.type === 'section') {
                        return (
                            <div key={`abschnitt_${index}`}>
                                <div className="pm-fb-karte pm-fb-karte--abschnitt">
                                    <strong>{knoten.title}</strong>
                                    <button
                                        type="button"
                                        className="pm-fb-knopf pm-fb-knopf--still"
                                        onClick={() => onChange(knotenEntfernen(gelesen, index))}
                                    >
                                        Entfernen
                                    </button>
                                </div>
                                <Ablagestelle id={`neuezeile:${index + 1}`} />
                            </div>
                        );
                    }

                    const zeile = knoten as LayoutZeile;

                    return (
                        <div key={`zeile_${index}`}>
                            <div className="pm-fb-editorzeile">
                                <Ablagestelle id={`spalte:${index}:0`} waagerecht />

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
                                                            schluesselGesperrt={gesperrteNamen.includes(
                                                                name,
                                                            )}
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
                                            id={`spalte:${index}:${spaltenIndex + 1}`}
                                            waagerecht
                                        />
                                    </div>
                                ))}
                            </div>

                            <Ablagestelle id={`neuezeile:${index + 1}`} />
                        </div>
                    );
                })}
            </DndContext>

            {fields.length === 0 && (
                <p className="pm-fb-hinweis">
                    Noch keine Felder. „Feld hinzufügen" legt das erste an.
                </p>
            )}
        </div>
    );
}
