import { useState } from 'react';

import {
    definitionLesen,
    feldAendern,
    feldDuplizieren,
    feldEntfernen,
    feldHinzufuegen,
    feldUmordnen,
    felderInReihenfolge,
    naechsterFeldname,
} from '../../core';
import type { FormularDefinition, RoheDefinition } from '../../core';
import type { FeldTypAuswahl } from '../editor/feldmaske';
import Fragekarte, { type Woerter } from './fragekarte';
import { vorschlaege, type Typvorschlag } from './typwahl';

export interface UmfrageBuilderProps {
    definition: RoheDefinition;
    onChange: (definition: FormularDefinition) => void;
    /**
     * Wie die Dinge heißen. „Frage" ist für eine Umfrage richtig und für ein
     * Anmeldeformular falsch — das Paket kann die Ansicht, das Produkt
     * benennt sie. Dasselbe Muster wie `gesperrteFelder`.
     */
    woerter?: Woerter;
    gesperrteFelder?: Record<string, string>;
    zusatzTypen?: FeldTypAuswahl[];
}

const VORGABE_WOERTER: Woerter = { einzahl: 'Frage', mehrzahl: 'Fragen' };
const KEINE_SPERREN: Record<string, string> = {};
const KEINE_TYPEN: FeldTypAuswahl[] = [];

/**
 * Der geführte Aufbau — die dritte Ansicht neben Struktur und Liste.
 *
 * ## Was sie anders macht
 *
 * Nicht die Optik. Man **wählt eine fertige Frage**, statt eine zu **bauen**:
 * „Bewertung" ist ein Eintrag in der Liste, keine Auswahlknopfgruppe, in die
 * man fünf Zeilen tippt. Und der Datenschlüssel steht unter „Erweitert", weil
 * er niemanden angeht, der eine Feedback-Umfrage schreibt.
 *
 * ## Was sie NICHT kann — und warum das ungefährlich ist
 *
 * Verzweigungen zwischen Schritten (`flow`) und Bedingungen (`conditions`)
 * lassen sich linear nicht darstellen. Sie werden hier aber auch **nicht
 * angefasst**: Jeder Handgriff des Kerns reicht die Definition durch
 * (`...definition`) und erhält beides. Ein Umbau hier kann eine Verzweigung
 * also nicht verlieren — er kann sie nur nicht zeigen.
 *
 * Deshalb ein Hinweis und keine Sperre. Eine Ansicht, die sich selbst sperrt,
 * sobald es irgendwo eine Regel gibt, wäre für jede gewachsene Umfrage
 * unbenutzbar — und die Gefahr, gegen die sie sich sperrt, gibt es nicht.
 */
export default function UmfrageBuilder({
    definition,
    onChange,
    woerter = VORGABE_WOERTER,
    gesperrteFelder = KEINE_SPERREN,
    zusatzTypen = KEINE_TYPEN,
}: UmfrageBuilderProps) {
    const gelesen = definitionLesen(definition);
    const felder = felderInReihenfolge(gelesen);
    const typen = vorschlaege(zusatzTypen);
    const [wahlOffen, setWahlOffen] = useState(false);
    const [alleTypen, setAlleTypen] = useState(false);

    const hatVerzweigung = (gelesen.flow ?? []).length > 0;
    const hatBedingungen = (gelesen.conditions ?? []).length > 0;

    const anlegen = (typ: Typvorschlag) => {
        const name = naechsterFeldname(gelesen);

        onChange(
            feldHinzufuegen(gelesen, {
                name,
                label: '',
                type: typ.wert,
                // Zwei leere Zeilen als Startpunkt: Eine Auswahlfrage ohne
                // Antworten ist keine, und ein leerer Kasten sagt nicht, dass
                // dort etwas hingehört.
                ...(['select', 'radio', 'checkboxes'].includes(typ.wert)
                    ? { options: ['', ''] }
                    : {}),
            }),
        );

        setWahlOffen(false);
        setAlleTypen(false);
    };

    return (
        <div className="pm-fb-umfrage">
            {(hatVerzweigung || hatBedingungen) && (
                <p className="pm-fb-umfrage__hinweis">
                    {hatVerzweigung
                        ? `Diese${woerter.einzahl === 'Frage' ? '' : 's'} ${woerter.mehrzahl.toLowerCase()} folgen einer Verzweigung: Je nach Antwort geht es anders weiter. `
                        : 'Einige Teile werden nur bei bestimmten Antworten gezeigt. '}
                    Das lässt sich hier nicht darstellen — in der Struktur schon.
                    Änderungen an dieser Stelle lassen die Verzweigung unberührt.
                </p>
            )}

            {felder.length === 0 && (
                <p className="pm-fb-umfrage__leer">
                    Noch keine {woerter.mehrzahl}.
                </p>
            )}

            {felder.map((feld, index) => (
                <Fragekarte
                    key={feld.name}
                    definition={gelesen}
                    feld={feld}
                    // Nur die Fragen DAVOR. Eine Bedingung auf eine spaetere
                    // waere im Formular nie erfuellt — sie saehe im Editor
                    // plausibel aus und taete nie etwas.
                    vorgaenger={felder.slice(0, index)}
                    onDefinition={onChange}
                    nummer={index + 1}
                    anzahl={felder.length}
                    woerter={woerter}
                    typen={typen}
                    {...(gesperrteFelder[feld.name] !== undefined
                        ? { sperrgrund: gesperrteFelder[feld.name] }
                        : {})}
                    onChange={(aenderungen) =>
                        onChange(feldAendern(gelesen, feld.name, aenderungen))
                    }
                    onDuplizieren={() => onChange(feldDuplizieren(gelesen, feld.name))}
                    onEntfernen={() => onChange(feldEntfernen(gelesen, feld.name))}
                    onHoch={() => onChange(feldUmordnen(gelesen, feld.name, 'hoch'))}
                    onRunter={() => onChange(feldUmordnen(gelesen, feld.name, 'runter'))}
                />
            ))}

            {!wahlOffen ? (
                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-umfrage__anlegen"
                    onClick={() => setWahlOffen(true)}
                >
                    + {woerter.einzahl} hinzufügen
                </button>
            ) : (
                <div className="pm-fb-typwahl">
                    <div className="pm-fb-typwahl__kopf">
                        <strong>Was für eine {woerter.einzahl}?</strong>
                        <button
                            type="button"
                            className="pm-fb-knopf pm-fb-knopf--still"
                            onClick={() => {
                                setWahlOffen(false);
                                setAlleTypen(false);
                            }}
                        >
                            Abbrechen
                        </button>
                    </div>

                    <ul className="pm-fb-typwahl__liste">
                        {typen
                            .filter((typ) => alleTypen || typ.haeufig)
                            .map((typ) => (
                                <li key={typ.wert}>
                                    <button
                                        type="button"
                                        className="pm-fb-typwahl__eintrag"
                                        onClick={() => anlegen(typ)}
                                    >
                                        <strong>{typ.label}</strong>
                                        {typ.wofuer && <span>{typ.wofuer}</span>}
                                        {/*
                                            Das Beispiel und nicht nur der Name:
                                            „Auswahlknöpfe" sagt, wie es
                                            aussieht. „○ Ja ○ Nein" sagt, was
                                            man bekommt.
                                        */}
                                        {typ.beispiel && (
                                            <code>{typ.beispiel}</code>
                                        )}
                                    </button>
                                </li>
                            ))}
                    </ul>

                    {!alleTypen && (
                        <button
                            type="button"
                            className="pm-fb-knopf pm-fb-knopf--still"
                            onClick={() => setAlleTypen(true)}
                        >
                            Mehr Arten
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
