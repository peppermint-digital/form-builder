import type {
    FormularDefinition,
    FormularFeld,
    LayoutKnoten,
    LayoutZeile,
} from './types';

/**
 * Mehr als drei Felder nebeneinander sind auf keinem Bildschirm mehr lesbar,
 * und auf dem Telefon werden sie ohnehin gestapelt.
 */
export const MAX_SPALTEN = 3;

/** Wohin ein Feld gezogen wurde. */
export type Ablageziel =
    | { art: 'spalte'; zeile: number; position: number }
    | { art: 'neueZeile'; position: number };

function istZeile(knoten: LayoutKnoten): knoten is LayoutZeile {
    return knoten.type === 'row';
}

/**
 * Macht das Layout ausdruecklich.
 *
 * Solange kein Layout gespeichert ist, gilt die Reihenfolge von `fields` —
 * bequem fuer Bestandsformulare, aber nichts, worauf sich eine Bearbeitung
 * stuetzen kann: der erste Griff ans Layout muesste sonst gleichzeitig eines
 * erfinden, und zwar an jeder Bearbeitungsstelle einzeln.
 */
export function layoutSicherstellen(
    definition: FormularDefinition,
): Required<FormularDefinition> {
    if (definition.layout && definition.layout.length > 0) {
        return { fields: definition.fields, layout: definition.layout };
    }

    return {
        fields: definition.fields,
        layout: definition.fields.map((feld) => ({
            type: 'row' as const,
            columns: [[feld.name]],
        })),
    };
}

/**
 * Der naechste freie Name der Form `field_N`.
 *
 * Bewusst nicht `fields.length + 1`: nach dem Loeschen eines Feldes trifft das
 * einen bereits vergebenen Namen. Doppelte Namen weist der Waechter ab — das
 * Speichern schluege fehl, ohne dass klar waere, warum.
 */
export function naechsterFeldname(
    definition: FormularDefinition,
    praefix = 'field',
): string {
    const vergeben = new Set(definition.fields.map((feld) => feld.name));
    let nummer = definition.fields.length + 1;

    while (vergeben.has(`${praefix}_${nummer}`)) {
        nummer++;
    }

    return `${praefix}_${nummer}`;
}

/** Entfernt einen Namen ueberall aus dem Layout und raeumt Leergewordenes auf. */
function ausLayoutEntfernen(layout: LayoutKnoten[], name: string): LayoutKnoten[] {
    return layout
        .map((knoten) => {
            if (!istZeile(knoten)) {
                return knoten;
            }

            const columns = knoten.columns
                .map((spalte) => spalte.filter((eintrag) => eintrag !== name))
                .filter((spalte) => spalte.length > 0);

            return { type: 'row' as const, columns };
        })
        // Eine Zeile ohne Felder hinterliesse eine Luecke im Formular.
        .filter((knoten) => !istZeile(knoten) || knoten.columns.length > 0);
}

export function feldHinzufuegen(
    definition: FormularDefinition,
    feld: FormularFeld,
): FormularDefinition {
    const { fields, layout } = layoutSicherstellen(definition);

    return {
        fields: [...fields, feld],
        layout: [...layout, { type: 'row', columns: [[feld.name]] }],
    };
}

export function feldEntfernen(
    definition: FormularDefinition,
    name: string,
): FormularDefinition {
    const { fields, layout } = layoutSicherstellen(definition);

    return {
        fields: fields.filter((feld) => feld.name !== name),
        layout: ausLayoutEntfernen(layout, name),
    };
}

/**
 * Aendert ein Feld — und zieht das Layout mit, wenn sich der Name aendert.
 *
 * Ohne das Mitziehen zeigte das Layout auf einen Namen, den es nicht mehr
 * gibt: das Feld verschwindet aus seiner Spalte und taucht am Ende des
 * Formulars wieder auf. Es sieht aus wie ein Sprung ohne Grund, und der
 * Zusammenhang zum Umbenennen ist von aussen nicht zu sehen.
 */
export function feldAendern(
    definition: FormularDefinition,
    name: string,
    aenderungen: Partial<FormularFeld>,
): FormularDefinition {
    const { fields, layout } = layoutSicherstellen(definition);
    const neuerName = aenderungen.name;

    const neueFelder = fields.map((feld) =>
        feld.name === name ? { ...feld, ...aenderungen } : feld,
    );

    if (!neuerName || neuerName === name) {
        return { fields: neueFelder, layout };
    }

    return {
        fields: neueFelder,
        layout: layout.map((knoten) =>
            istZeile(knoten)
                ? {
                      type: 'row' as const,
                      columns: knoten.columns.map((spalte) =>
                          spalte.map((eintrag) => (eintrag === name ? neuerName : eintrag)),
                      ),
                  }
                : knoten,
        ),
    };
}

/**
 * Verschiebt ein Feld an eine andere Stelle im Layout.
 *
 * Erst herausnehmen, dann einsetzen — und die Zielposition wird NACH dem
 * Herausnehmen bestimmt. Wer das umdreht, verschiebt beim Ziehen innerhalb
 * derselben Zeile um eine Stelle zu weit.
 */
export function feldVerschieben(
    definition: FormularDefinition,
    name: string,
    ziel: Ablageziel,
): FormularDefinition {
    const { fields, layout } = layoutSicherstellen(definition);

    if (!fields.some((feld) => feld.name === name)) {
        return definition;
    }

    const bereinigt = ausLayoutEntfernen(layout, name);

    if (ziel.art === 'neueZeile') {
        const position = Math.max(0, Math.min(ziel.position, bereinigt.length));
        const neu = [...bereinigt];
        neu.splice(position, 0, { type: 'row', columns: [[name]] });

        return { fields, layout: neu };
    }

    const zeile = bereinigt[ziel.zeile];

    // Die Zielzeile kann durch das Herausnehmen verschwunden sein — dann war
    // das Feld ihr einziger Inhalt, und es bleibt, wo es war.
    if (!zeile || !istZeile(zeile)) {
        return { fields, layout };
    }

    if (zeile.columns.length >= MAX_SPALTEN) {
        return { fields, layout };
    }

    const columns = [...zeile.columns];
    columns.splice(Math.max(0, Math.min(ziel.position, columns.length)), 0, [name]);

    const neu = [...bereinigt];
    neu[ziel.zeile] = { type: 'row', columns };

    return { fields, layout: neu };
}

/** Schiebt eine ganze Zeile nach oben oder unten. */
export function zeileVerschieben(
    definition: FormularDefinition,
    von: number,
    nach: number,
): FormularDefinition {
    const { fields, layout } = layoutSicherstellen(definition);

    if (von < 0 || von >= layout.length || nach < 0 || nach >= layout.length) {
        return { fields, layout };
    }

    const neu = [...layout];
    const [bewegt] = neu.splice(von, 1);

    if (bewegt) {
        neu.splice(nach, 0, bewegt);
    }

    return { fields, layout: neu };
}

export function abschnittHinzufuegen(
    definition: FormularDefinition,
    titel: string,
    position?: number,
): FormularDefinition {
    const { fields, layout } = layoutSicherstellen(definition);
    const neu = [...layout];
    const stelle = position ?? neu.length;

    neu.splice(Math.max(0, Math.min(stelle, neu.length)), 0, {
        type: 'section',
        title: titel,
    });

    return { fields, layout: neu };
}

export function knotenEntfernen(
    definition: FormularDefinition,
    index: number,
): FormularDefinition {
    const { fields, layout } = layoutSicherstellen(definition);
    const knoten = layout[index];

    if (!knoten || istZeile(knoten)) {
        return { fields, layout };
    }

    return { fields, layout: layout.filter((_, i) => i !== index) };
}

/**
 * Bereinigt die Optionen aller Felder — der Riegel an der Quelle.
 *
 * Beim Speichern und nicht erst beim Anzeigen: ein leerer Eintrag bringt die
 * Auswahlliste im Browser zum Absturz, und eine daraus abgeleitete
 * Validierungsregel wuerde den leeren Wert erlauben. Die Bereinigung auf der
 * Leseseite bleibt trotzdem — sie faengt ab, was schon gespeichert ist.
 */
export function definitionBereinigen(
    definition: FormularDefinition,
): FormularDefinition {
    return {
        ...definition,
        fields: definition.fields.map((feld) => {
            if (!feld.options) {
                return feld;
            }

            return {
                ...feld,
                options: [
                    ...new Set(
                        feld.options.map((o) => String(o).trim()).filter((o) => o !== ''),
                    ),
                ],
            };
        }),
    };
}
