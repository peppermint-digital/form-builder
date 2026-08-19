import {
    definitionLesen,
    layoutAufloesen,
    type AufgeloesteZeile,
    type RoheDefinition,
} from '../core';
import FormularFeldEingabe from './feld';
import type { EigenerFeldTyp, KomponentenSatz } from './typen';

export interface FormularRendererProps {
    /** Nimmt jede gespeicherte Form an — Objekt, nackte Liste oder nichts. */
    definition: RoheDefinition;
    werte: Record<string, string>;
    onChange: (name: string, wert: string) => void;
    /** Feldname → Meldung, wie Laravel sie zurueckgibt. */
    fehler?: Record<string, string | undefined>;
    komponenten?: KomponentenSatz;
    eigeneTypen?: Record<string, EigenerFeldTyp>;
    idPrefix?: string;
    /** Setzt den Fokus ins erste Feld. Nur sinnvoll, wenn die Maske allein steht. */
    autoFocusErstesFeld?: boolean;
}

/**
 * Zeichnet eine Formular-Definition — mehrspaltig, wenn ein Layout es sagt.
 *
 * Die Zeilen kommen aus `layoutAufloesen()`, das heisst: fehlendes Layout,
 * geloeschte Felder und doppelte Verweise sind bereits behandelt, bevor hier
 * das erste Element entsteht. Diese Komponente entscheidet nichts darueber,
 * WAS erscheint — nur, wie es angeordnet wird.
 *
 * Die Spaltenzahl steckt in einer Klasse und nicht in einem inline-Style, weil
 * es einen Umbruchpunkt braucht: auf einem Telefon steht alles untereinander,
 * und eine Media-Query laesst sich inline nicht schreiben.
 */
export default function FormularRenderer({
    definition,
    werte,
    onChange,
    fehler = {},
    komponenten,
    eigeneTypen,
    idPrefix,
    autoFocusErstesFeld = false,
}: FormularRendererProps) {
    const gelesen = definitionLesen(definition);
    const knoten = layoutAufloesen(gelesen);

    let erstesFeld = true;

    return (
        <div className="pm-fb-formular">
            {knoten.map((eintrag, index) => {
                if (eintrag.type === 'section') {
                    return (
                        <div className="pm-fb-abschnitt" key={`abschnitt_${index}`}>
                            <h3 className="pm-fb-abschnitt__titel">{eintrag.title}</h3>
                            {eintrag.description && (
                                <p className="pm-fb-abschnitt__text">
                                    {eintrag.description}
                                </p>
                            )}
                        </div>
                    );
                }

                const zeile = eintrag as AufgeloesteZeile;

                return (
                    <div
                        key={`zeile_${index}`}
                        className={`pm-fb-zeile pm-fb-zeile--${Math.min(zeile.columns.length, 3)}`}
                    >
                        {zeile.columns.map((spalte, spaltenIndex) => (
                            <div className="pm-fb-spalte" key={`spalte_${spaltenIndex}`}>
                                {spalte.map((feld) => {
                                    const fokus = autoFocusErstesFeld && erstesFeld;
                                    erstesFeld = false;

                                    return (
                                        <FormularFeldEingabe
                                            key={feld.name}
                                            feld={feld}
                                            wert={werte[feld.name] ?? ''}
                                            onChange={(wert) => onChange(feld.name, wert)}
                                            {...(fehler[feld.name]
                                                ? { fehler: fehler[feld.name] }
                                                : {})}
                                            {...(komponenten ? { komponenten } : {})}
                                            {...(eigeneTypen ? { eigeneTypen } : {})}
                                            {...(idPrefix ? { idPrefix } : {})}
                                            autoFocus={fokus}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
