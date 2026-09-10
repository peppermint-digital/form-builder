import { useState } from 'react';

import {
    definitionLesen,
    feldAendern,
    feldDuplizieren,
    feldEntfernen,
    feldHinzufuegen,
    feldInRahmen,
    feldUmordnen,
    felderInReihenfolge,
    layoutAufloesen,
    naechsterFeldname,
    rahmenHinzufuegen,
    rahmenListe,
    rahmenVonFeld,
} from '../../core';
import type {
    AufgeloesterKnoten,
    FormularDefinition,
    FormularFeld,
    RoheDefinition,
} from '../../core';
import type { FeldTypAuswahl } from '../editor/feldmaske';
import Block from './block';
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
    // `leereRahmenBehalten`: Ein frisch angelegter Block ist immer leer, und
    // einer, der erst beim ersten Feld erscheint, laesst sich nicht befuellen.
    const knoten = layoutAufloesen(gelesen, { leereRahmenBehalten: true });
    const bloecke = rahmenListe(gelesen).filter((r) => r.art === 'group');
    const [wahlOffen, setWahlOffen] = useState(false);
    const [alleTypen, setAlleTypen] = useState(false);

    const hatVerzweigung = (gelesen.flow ?? []).length > 0;
    const hatBedingungen = (gelesen.conditions ?? []).length > 0;

    /**
     * Zeichnet die Struktur — Bloecke als Rahmen, Zeilen als Fragekarten.
     *
     * Die Nummerierung laeuft ueber ALLE Fragen und nicht je Block: „Frage 3
     * von 7" ist die Stelle im Bogen, und die aendert sich nicht dadurch, dass
     * jemand eine Klammer darum zieht.
     */
    const zeichnen = (liste: AufgeloesterKnoten[]): React.ReactNode[] =>
        liste.flatMap((eintrag, i) => {
            if (eintrag.type === 'group') {
                return [
                    <Block
                        key={`block_${eintrag.id}`}
                        definition={gelesen}
                        id={eintrag.id}
                        {...(eintrag.title !== undefined ? { title: eintrag.title } : { title: undefined })}
                        vorgaenger={vorgaengerVon(eintrag)}
                        woerter={woerter}
                        onChange={onChange}
                    >
                        {eintrag.children.length === 0 ? (
                            <p className="pm-fb-hinweis">
                                Noch leer. Schieb {woerter.mehrzahl} über die Auswahl
                                unter einer Frage hierher.
                            </p>
                        ) : (
                            zeichnen(eintrag.children)
                        )}
                    </Block>,
                ];
            }

            if (eintrag.type !== 'row') {
                return [];
            }

            return eintrag.columns.flat().map((feld) => karte(feld));
        });

    /**
     * Alle Fragen VOR diesem Knoten.
     *
     * Ueber die Gesamtreihenfolge und nicht ueber den Block: Eine Bedingung
     * darf sich auf jede Frage stuetzen, die der Befragte schon beantwortet
     * hat — auch auf eine ausserhalb des Blocks. Das ist ja gerade der Fall,
     * um den es geht („wenn Frage 1 Nein, zeige diesen Block").
     */
    const vorgaengerVon = (knoten: AufgeloesterKnoten): FormularFeld[] => {
        const erste = ersteFrageIn(knoten);

        if (erste === null) {
            return felder;
        }

        const index = felder.findIndex((f) => f.name === erste);

        return index <= 0 ? [] : felder.slice(0, index);
    };

    const karte = (feld: FormularFeld) => {
        const index = felder.findIndex((f) => f.name === feld.name);

        return (
            <Fragekarte
                key={feld.name}
                definition={gelesen}
                feld={feld}
                // Nur die Fragen DAVOR. Eine Bedingung auf eine spaetere waere
                // im Formular nie erfuellt — sie saehe im Editor plausibel aus
                // und taete nie etwas.
                vorgaenger={felder.slice(0, Math.max(0, index))}
                onDefinition={onChange}
                nummer={index + 1}
                anzahl={felder.length}
                woerter={woerter}
                typen={typen}
                bloecke={bloecke}
                aktuellerBlock={rahmenVonFeld(gelesen, feld.name)}
                onBlock={(id: string | null) =>
                    onChange(feldInRahmen(gelesen, feld.name, id))
                }
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
        );
    };

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

            {/*
                Durch die STRUKTUR statt durch eine flache Liste: Nur so werden
                Bloecke sichtbar — und ein Block ist der Unterschied zwischen
                einer Bedingung und vier gleichen.
            */}
            {zeichnen(knoten)}

            {!wahlOffen && felder.length > 0 && (
                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--still"
                    onClick={() =>
                        onChange(rahmenHinzufuegen(gelesen, 'group', 'Neuer Block'))
                    }
                >
                    + Block (mehrere {woerter.mehrzahl} unter einer Bedingung)
                </button>
            )}

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

/**
 * Der Datenschluessel der ersten Frage in einem Knoten — oder `null`.
 *
 * Fuer die Vorgaengerliste eines Blocks: Sie endet dort, wo der Block anfaengt.
 */
function ersteFrageIn(knoten: AufgeloesterKnoten): string | null {
    if (knoten.type === 'row') {
        return knoten.columns.flat()[0]?.name ?? null;
    }

    if (knoten.type === 'group' || knoten.type === 'step') {
        for (const kind of knoten.children) {
            const treffer = ersteFrageIn(kind);

            if (treffer !== null) {
                return treffer;
            }
        }
    }

    return null;
}
