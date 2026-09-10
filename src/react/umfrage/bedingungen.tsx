import {
    pruefungAendern,
    pruefungAnlegen,
    pruefungEntfernen,
    regelAendern,
    regelAnlegen,
    regelEntfernen,
    regelnFuerZiel,
    type Bedingungsregel,
    type FormularDefinition,
    type FormularFeld,
    type Vergleich,
    type Wirkung,
} from '../../core';
import type { Woerter } from './fragekarte';


/**
 * Die Vergleiche in der Sprache, in der jemand die Frage stellt.
 *
 * „is" ist der gespeicherte Wert; „ist gleich" ist das, was man meint. Die
 * Reihenfolge folgt der Haeufigkeit, nicht dem Alphabet — `is` steht oben,
 * weil „wenn Antwort X" die Regel ist, die fast jeder zuerst baut.
 */
const VERGLEICHE: Array<{ wert: Vergleich; label: string; ohneWert?: boolean }> = [
    { wert: 'is', label: 'ist gleich' },
    { wert: 'is_not', label: 'ist nicht' },
    { wert: 'contains', label: 'enthält' },
    { wert: 'not_contains', label: 'enthält nicht' },
    { wert: 'filled', label: 'ist beantwortet', ohneWert: true },
    { wert: 'empty', label: 'ist nicht beantwortet', ohneWert: true },
    { wert: 'gt', label: 'ist größer als' },
    { wert: 'lt', label: 'ist kleiner als' },
];

const WIRKUNGEN: Array<{ wert: Wirkung; label: string }> = [
    { wert: 'show', label: 'zeigen' },
    { wert: 'hide', label: 'ausblenden' },
    { wert: 'require', label: 'zur Pflicht machen' },
    { wert: 'optional', label: 'freiwillig machen' },
];

interface Props {
    definition: FormularDefinition;
    /**
     * Worum es geht — eine Frage oder ein ganzer Block.
     *
     * Ein Block ist der Grund, warum das hier nicht nur Felder kennt: „Wenn
     * Nein, dann zeige DIESE VIER Fragen" ist mit vier Regeln zwar moeglich,
     * aber viermal dieselbe Arbeit — und beim naechsten Umbau vergisst man
     * eine davon.
     */
    ziel: { kind: 'field' | 'group'; ref: string };
    /** Alle Felder VOR dem Ziel — nur die koennen darueber entscheiden. */
    vorgaenger: FormularFeld[];
    woerter: Woerter;
    /** Wie das Ziel in den Saetzen heisst — „Frage" oder „Block". */
    was: string;
    onChange: (definition: FormularDefinition) => void;
}

/**
 * Bedingungen an der Frage, nicht an einer Kante.
 *
 * Der Unterschied zur Struktur-Ansicht ist die Frage, die man stellt: Dort
 * zieht man eine Verbindung und sieht den ganzen Bogen. Hier steht an jeder
 * Frage, **wovon sie abhängt** — und das ist die Frage, die jemand hat,
 * während er die Frage schreibt.
 *
 * Beides bearbeitet dieselben `conditions`. Es gibt keine zweite Wahrheit.
 *
 * ## Warum nur Vorgänger
 *
 * Eine Frage kann nur von etwas abhängen, das der Befragte schon beantwortet
 * hat. Eine Bedingung auf eine spätere Frage wäre im Formular nie erfüllt —
 * sie sähe im Editor plausibel aus und täte nie etwas. Der Kern würde sie
 * annehmen; die Auswahl hier bietet sie gar nicht erst an.
 */
export default function Bedingungen({
    definition,
    ziel,
    vorgaenger,
    woerter,
    was,
    onChange,
}: Props) {
    const regeln = regelnFuerZiel(definition, ziel.kind, ziel.ref);

    if (vorgaenger.length === 0) {
        return (
            <p className="pm-fb-hinweis">
                {was === 'Block'
                    ? 'Ein Block ganz oben kann von nichts abhängen — es ist noch nichts beantwortet.'
                    : `Die erste ${woerter.einzahl} kann von nichts abhängen — es ist noch nichts beantwortet.`}
            </p>
        );
    }

    return (
        <div className="pm-fb-bedingungen">
            {regeln.length === 0 && (
                <p className="pm-fb-hinweis">
                    Wird immer gezeigt.
                </p>
            )}

            {regeln.map((regel) => (
                <Regelzeile
                    key={regel.id}
                    regel={regel}
                    vorgaenger={vorgaenger}
                    definition={definition}
                    onChange={onChange}
                />
            ))}

            <button
                type="button"
                className="pm-fb-knopf"
                onClick={() =>
                    onChange(regelAnlegen(definition, vorgaenger[0]!.name, ziel))
                }
            >
                + Bedingung
            </button>

            {/*
                Der Satz steht hier und nicht in der Hilfe: Eine `show`-Regel
                dreht die Vorgabe um. Sobald es eine gibt, ist die Frage
                verborgen, bis eine davon zutrifft — sonst wäre „zeige X, wenn
                Y" wirkungslos, X wäre ja ohnehin schon sichtbar. Wer das nicht
                weiß, legt zwei Regeln an und wundert sich, dass die Frage
                verschwindet.
            */}
            {regeln.some((regel) => regel.effect === 'show') && (
                <p className="pm-fb-hinweis">
                    Sobald es eine „zeigen"-Bedingung gibt, ist{' '}
                    {was === 'Block' ? 'der Block' : `die ${woerter.einzahl}`}{' '}
                    verborgen, bis eine davon zutrifft.
                </p>
            )}
        </div>
    );
}

function Regelzeile({
    regel,
    vorgaenger,
    definition,
    onChange,
}: {
    regel: Bedingungsregel;
    vorgaenger: FormularFeld[];
    definition: FormularDefinition;
    onChange: (definition: FormularDefinition) => void;
}) {
    return (
        <div className="pm-fb-regel">
            <div className="pm-fb-regel__kopf">
                <select
                    className="pm-fb-eingabe pm-fb-eingabe--schmal"
                    value={regel.effect}
                    aria-label="Wirkung"
                    onChange={(e) =>
                        onChange(
                            regelAendern(definition, regel.id, {
                                effect: e.target.value as Wirkung,
                            }),
                        )
                    }
                >
                    {WIRKUNGEN.map((w) => (
                        <option key={w.wert} value={w.wert}>
                            {w.label}
                        </option>
                    ))}
                </select>

                <span>wenn</span>

                {regel.tests.length > 1 && (
                    <select
                        className="pm-fb-eingabe pm-fb-eingabe--schmal"
                        value={regel.match}
                        aria-label="Verknüpfung"
                        onChange={(e) =>
                            onChange(
                                regelAendern(definition, regel.id, {
                                    match: e.target.value as 'all' | 'any',
                                }),
                            )
                        }
                    >
                        <option value="all">alle zutreffen</option>
                        <option value="any">eines zutrifft</option>
                    </select>
                )}

                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--gefahr"
                    onClick={() => onChange(regelEntfernen(definition, regel.id))}
                >
                    Bedingung löschen
                </button>
            </div>

            {regel.tests.map((pruefung, index) => {
                const vergleich = VERGLEICHE.find((v) => v.wert === pruefung.op);
                const quelle = vorgaenger.find((f) => f.name === pruefung.field);
                const optionen = quelle?.options ?? [];

                return (
                    <div key={index} className="pm-fb-regel__pruefung">
                        <select
                            className="pm-fb-eingabe"
                            value={pruefung.field}
                            aria-label="Frage"
                            onChange={(e) =>
                                onChange(
                                    pruefungAendern(definition, regel.id, index, {
                                        field: e.target.value,
                                    }),
                                )
                            }
                        >
                            {/*
                                Ein gespeichertes Feld, das nicht mehr Vorgänger
                                ist — etwa nach dem Verschieben —, bleibt in der
                                Liste. Sonst zeigte die Auswahl etwas anderes an,
                                als in der Regel steht, und das nächste Speichern
                                änderte sie unbemerkt.
                            */}
                            {quelle === undefined && (
                                <option value={pruefung.field}>
                                    {pruefung.field} (steht nicht davor)
                                </option>
                            )}
                            {vorgaenger.map((f) => (
                                <option key={f.name} value={f.name}>
                                    {f.label || f.name}
                                </option>
                            ))}
                        </select>

                        <select
                            className="pm-fb-eingabe pm-fb-eingabe--schmal"
                            value={pruefung.op}
                            aria-label="Vergleich"
                            onChange={(e) =>
                                onChange(
                                    pruefungAendern(definition, regel.id, index, {
                                        op: e.target.value as Vergleich,
                                    }),
                                )
                            }
                        >
                            {VERGLEICHE.map((v) => (
                                <option key={v.wert} value={v.wert}>
                                    {v.label}
                                </option>
                            ))}
                        </select>

                        {!vergleich?.ohneWert &&
                            (optionen.length > 0 ? (
                                // Bei einer Auswahlfrage die Optionen anbieten
                                // statt tippen zu lassen: Ein Tippfehler
                                // erzeugt eine Regel, die im Editor richtig
                                // aussieht und im Formular nie zutrifft.
                                <select
                                    className="pm-fb-eingabe"
                                    value={pruefung.value ?? ''}
                                    aria-label="Wert"
                                    onChange={(e) =>
                                        onChange(
                                            pruefungAendern(definition, regel.id, index, {
                                                value: e.target.value,
                                            }),
                                        )
                                    }
                                >
                                    <option value="">— wählen —</option>
                                    {optionen
                                        .filter((o) => o.trim() !== '')
                                        .map((o) => (
                                            <option key={o} value={o}>
                                                {o}
                                            </option>
                                        ))}
                                </select>
                            ) : (
                                <input
                                    className="pm-fb-eingabe"
                                    value={pruefung.value ?? ''}
                                    aria-label="Wert"
                                    onChange={(e) =>
                                        onChange(
                                            pruefungAendern(definition, regel.id, index, {
                                                value: e.target.value,
                                            }),
                                        )
                                    }
                                />
                            ))}

                        <button
                            type="button"
                            className="pm-fb-knopf pm-fb-knopf--still"
                            aria-label="Prüfung entfernen"
                            onClick={() =>
                                onChange(pruefungEntfernen(definition, regel.id, index))
                            }
                        >
                            ✕
                        </button>
                    </div>
                );
            })}

            <button
                type="button"
                className="pm-fb-knopf pm-fb-knopf--still"
                onClick={() =>
                    onChange(pruefungAnlegen(definition, regel.id, vorgaenger[0]!.name))
                }
            >
                + und noch eine Prüfung
            </button>
        </div>
    );
}
