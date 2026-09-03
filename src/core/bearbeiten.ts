import type {
    FormularDefinition,
    FormularFeld,
    LayoutGruppe,
    LayoutKnoten,
    LayoutSchritt,
    LayoutSpalte,
    LayoutZeile,
} from './types';

/**
 * Mehr als drei Felder nebeneinander sind auf keinem Bildschirm mehr lesbar,
 * und auf dem Telefon werden sie ohnehin gestapelt.
 */
export const MAX_SPALTEN = 3;

/**
 * Wohin ein Feld gezogen wurde.
 *
 * `pfad` benennt den Rahmen, in dem gearbeitet wird — die Indizes der Gruppen
 * und Schritte, in die hinabzusteigen ist. Leer oder fehlend heisst oberste
 * Ebene; das ist die Vorgabe, damit ein Formular ohne Rahmen unveraendert
 * bedient wird. `zeile` und `position` zaehlen INNERHALB dieses Rahmens.
 *
 * Ohne den Pfad wuerde `layout[ziel.zeile]` gelesen, und das trifft die
 * falsche Zeile, sobald irgendwo eine Gruppe steht — dieselbe Falle, wegen der
 * es {@see feldNebenFeld} ueber Namen gibt.
 */
export type Ablageziel =
    | { art: 'spalte'; pfad?: number[]; zeile: number; position: number }
    | { art: 'neueZeile'; pfad?: number[]; position: number };

/**
 * Ersetzt die Knotenliste eines Rahmens — oder die oberste Ebene.
 *
 * Eine Stelle fuer das Hinabsteigen, damit nicht jede Bearbeitungsfunktion
 * ihre eigene Schleife durch den Baum bekommt. Zeigt der Pfad ins Leere,
 * bleibt alles unveraendert: ein Griff, der nichts trifft, darf nichts
 * zerstoeren.
 */
function imRahmen(
    layout: LayoutKnoten[],
    pfad: number[],
    umbau: (liste: LayoutKnoten[]) => LayoutKnoten[],
): LayoutKnoten[] {
    if (pfad.length === 0) {
        return umbau(layout);
    }

    const [index, ...rest] = pfad;
    const knoten = index === undefined ? undefined : layout[index];

    if (index === undefined || !knoten || !istRahmen(knoten)) {
        return layout;
    }

    const neu = [...layout];
    neu[index] = { ...knoten, children: imRahmen(knoten.children, rest, umbau) };

    return neu;
}

/** Die Knotenliste eines Rahmens — `null`, wenn der Pfad ins Leere zeigt. */
function listeAm(layout: LayoutKnoten[], pfad: number[]): LayoutKnoten[] | null {
    let liste = layout;

    for (const index of pfad) {
        const knoten = liste[index];

        if (!knoten || !istRahmen(knoten)) {
            return null;
        }

        liste = knoten.children;
    }

    return liste;
}

/**
 * Welcher Rahmen am Ende des Pfades steht — `null` fuer die oberste Ebene,
 * `undefined`, wenn der Pfad ins Leere zeigt.
 *
 * Gebraucht, weil ein Pfad aus INDIZES besteht und {@see feldVerschieben} das
 * Feld zuerst herausnimmt: Wird dabei eine Zeile leer, ruecken alle
 * nachfolgenden Knoten eine Stelle vor, und derselbe Pfad zeigt danach auf
 * einen anderen Rahmen — oder ins Nichts. Die Kennung eines Rahmens
 * ueberlebt das Umraeumen, ein Index nicht.
 */
function rahmenIdAm(
    layout: LayoutKnoten[],
    pfad: number[],
): string | null | undefined {
    let liste = layout;
    let id: string | null = null;

    for (const index of pfad) {
        const knoten = liste[index];

        if (!knoten || !istRahmen(knoten)) {
            return undefined;
        }

        id = knoten.id;
        liste = knoten.children;
    }

    return id;
}

/** Die Kinder eines Rahmens ueber seine Kennung — `null`, wenn es ihn nicht gibt. */
function listeMitId(layout: LayoutKnoten[], id: string | null): LayoutKnoten[] | null {
    if (id === null) {
        return layout;
    }

    for (const eintrag of layout) {
        if (!istRahmen(eintrag)) {
            continue;
        }

        if (eintrag.id === id) {
            return eintrag.children;
        }

        const tiefer = listeMitId(eintrag.children, id);

        if (tiefer !== null) {
            return tiefer;
        }
    }

    return null;
}

/** Wie {@see imRahmen}, nur ueber die Kennung statt ueber den Pfad. */
function imRahmenMitId(
    layout: LayoutKnoten[],
    id: string | null,
    umbau: (liste: LayoutKnoten[]) => LayoutKnoten[],
): LayoutKnoten[] {
    if (id === null) {
        return umbau(layout);
    }

    return layout.map((eintrag) => {
        if (!istRahmen(eintrag)) {
            return eintrag;
        }

        return eintrag.id === id
            ? { ...eintrag, children: umbau(eintrag.children) }
            : { ...eintrag, children: imRahmenMitId(eintrag.children, id, umbau) };
    });
}

function istRahmen(knoten: LayoutKnoten): knoten is LayoutGruppe | LayoutSchritt {
    return knoten.type === 'group' || knoten.type === 'step';
}

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
): FormularDefinition & { layout: LayoutKnoten[] } {
    // Durchreichen statt neu zusammensetzen: `conditions`, `flow` und `graph`
    // haengen an derselben Definition. Wurden hier nur `fields` und `layout`
    // uebernommen, verlor jeder Editor-Handgriff die Bedingungen — lautlos,
    // denn ein Formular ohne Bedingungen sieht aus wie ein richtiges.
    if (definition.layout && definition.layout.length > 0) {
        return { ...definition, layout: definition.layout };
    }

    return {
        ...definition,
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
        .map((knoten): LayoutKnoten => {
            // In Rahmen hinabsteigen: ein Feld in einer Gruppe blieb sonst
            // dort stehen, und ein Verschieben nach draussen legte es ein
            // zweites Mal an. Sichtbar waere weiter das erste Vorkommen — die
            // Bewegung sieht aus, als haette sie nicht stattgefunden.
            if (istRahmen(knoten)) {
                return { ...knoten, children: ausLayoutEntfernen(knoten.children, name) };
            }

            if (!istZeile(knoten)) {
                return knoten;
            }

            const columns = knoten.columns
                .map((spalte) => spalte.filter((eintrag) => eintrag !== name))
                .filter((spalte) => spalte.length > 0);

            return { type: 'row' as const, columns };
        })
        // Eine Zeile ohne Felder hinterliesse eine Luecke im Formular. Ein
        // leerer RAHMEN bleibt dagegen stehen: ihn hat jemand angelegt, und
        // er soll nicht verschwinden, weil man sein letztes Feld herauszieht.
        .filter((knoten) => !istZeile(knoten) || knoten.columns.length > 0);
}

export function feldHinzufuegen(
    definition: FormularDefinition,
    feld: FormularFeld,
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);
    const { fields, layout } = gesichert;

    return {
        ...gesichert,
        fields: [...fields, feld],
        layout: [...layout, { type: 'row', columns: [[feld.name]] }],
    };
}

export function feldEntfernen(
    definition: FormularDefinition,
    name: string,
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);
    const { fields, layout } = gesichert;

    return {
        ...gesichert,
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
    const gesichert = layoutSicherstellen(definition);
    const { fields, layout } = gesichert;
    const neuerName = aenderungen.name;

    const neueFelder = fields.map((feld) =>
        feld.name === name ? { ...feld, ...aenderungen } : feld,
    );

    if (!neuerName || neuerName === name) {
        return { ...gesichert, fields: neueFelder };
    }

    return {
        ...gesichert,
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
    const gesichert = layoutSicherstellen(definition);
    const { fields, layout } = gesichert;

    if (!fields.some((feld) => feld.name === name)) {
        return definition;
    }

    // Die Kennung VOR dem Herausnehmen bestimmen, die Liste danach: Das
    // Herausnehmen kann eine Zeile leeren und damit alle Indizes verschieben.
    const rahmenId = rahmenIdAm(layout, ziel.pfad ?? []);

    // Ein Pfad, der ins Leere zeigt, ist kein Grund, das Feld irgendwo
    // abzulegen — es bleibt, wo es war.
    if (rahmenId === undefined) {
        return gesichert;
    }

    const bereinigt = ausLayoutEntfernen(layout, name);
    const liste = listeMitId(bereinigt, rahmenId);

    if (liste === null) {
        return gesichert;
    }

    if (ziel.art === 'neueZeile') {
        const position = Math.max(0, Math.min(ziel.position, liste.length));

        return {
            ...gesichert,
            layout: imRahmenMitId(bereinigt, rahmenId, (aktuell) => {
                const neu = [...aktuell];
                neu.splice(position, 0, { type: 'row', columns: [[name]] });

                return neu;
            }),
        };
    }

    const zeile = liste[ziel.zeile];

    // Die Zielzeile kann durch das Herausnehmen verschwunden sein — dann war
    // das Feld ihr einziger Inhalt, und es bleibt, wo es war.
    if (!zeile || !istZeile(zeile)) {
        return gesichert;
    }

    if (zeile.columns.length >= MAX_SPALTEN) {
        return gesichert;
    }

    const columns = [...zeile.columns];
    columns.splice(Math.max(0, Math.min(ziel.position, columns.length)), 0, [name]);

    return {
        ...gesichert,
        layout: imRahmenMitId(bereinigt, rahmenId, (aktuell) => {
            const neu = [...aktuell];
            neu[ziel.zeile] = { type: 'row', columns };

            return neu;
        }),
    };
}

/**
 * Schiebt einen Knoten nach oben oder unten — innerhalb seines Rahmens.
 *
 * `pfad` benennt den Rahmen wie bei {@see Ablageziel}; leer ist die oberste
 * Ebene. Verschoben wird nur INNERHALB einer Ebene: Ein Pfeil, der ein Feld
 * aus seiner Gruppe herausbefoerdert, waere ein Umzug und keine Reihenfolge.
 */
export function zeileVerschieben(
    definition: FormularDefinition,
    von: number,
    nach: number,
    pfad: number[] = [],
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);
    const { fields } = gesichert;
    const layout = listeAm(gesichert.layout, pfad);

    if (layout === null) {
        return gesichert;
    }

    if (von < 0 || von >= layout.length || nach < 0 || nach >= layout.length) {
        return gesichert;
    }

    const neu = [...layout];
    const [bewegt] = neu.splice(von, 1);

    if (bewegt) {
        neu.splice(nach, 0, bewegt);
    }

    return { ...gesichert, layout: imRahmen(gesichert.layout, pfad, () => neu) };
}

export function abschnittHinzufuegen(
    definition: FormularDefinition,
    titel: string,
    position?: number,
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);
    const { fields, layout } = gesichert;
    const neu = [...layout];
    const stelle = position ?? neu.length;

    neu.splice(Math.max(0, Math.min(stelle, neu.length)), 0, {
        type: 'section',
        title: titel,
    });

    return { ...gesichert, layout: neu };
}

/**
 * Entfernt einen Abschnitt — nie eine Zeile.
 *
 * Eine Zeile enthaelt Felder, und die traegt man ueber `feldEntfernen`
 * einzeln ab. Ein Griff, der beim Aufraeumen der Gliederung stillschweigend
 * Datenschluessel mitnimmt, ist genau der, den niemand rueckgaengig machen kann.
 */
export function knotenEntfernen(
    definition: FormularDefinition,
    index: number,
    pfad: number[] = [],
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);
    const { fields } = gesichert;
    const liste = listeAm(gesichert.layout, pfad);
    const knoten = liste?.[index];

    if (!liste || !knoten || istZeile(knoten)) {
        return gesichert;
    }

    return {
        ...gesichert,
        layout: imRahmen(gesichert.layout, pfad, (aktuell) =>
            aktuell.filter((_, i) => i !== index),
        ),
    };
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

/**
 * Die naechste freie Kennung fuer einen Rahmen.
 *
 * Ueber den GANZEN Baum gesucht, nicht nur auf oberster Ebene: eine Gruppe in
 * einem Schritt traegt dieselbe Art von Kennung, und zwei gleiche waeren im
 * Graphen ein Knoten.
 */
export function naechsteRahmenkennung(
    definition: FormularDefinition,
    praefix: 'g' | 's',
): string {
    const vergeben = new Set<string>();

    const sammeln = (knoten: LayoutKnoten[]): void => {
        for (const eintrag of knoten) {
            if (istRahmen(eintrag)) {
                vergeben.add(eintrag.id);
                sammeln(eintrag.children);
            }
        }
    };

    sammeln(definition.layout ?? []);

    let nummer = vergeben.size + 1;

    while (vergeben.has(`${praefix}${nummer}`)) {
        nummer++;
    }

    return `${praefix}${nummer}`;
}

/**
 * Legt einen leeren Rahmen an.
 *
 * Leer, und das ist Absicht: wer eine Gruppe anlegt, weiss oft noch nicht,
 * was hineinkommt. Damit sie trotzdem sichtbar ist, zeichnet der Editor
 * leere Rahmen mit — das Formular laesst sie weg.
 */
export function rahmenHinzufuegen(
    definition: FormularDefinition,
    art: 'group' | 'step',
    title: string,
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);
    const id = naechsteRahmenkennung(gesichert, art === 'group' ? 'g' : 's');

    const rahmen =
        art === 'group'
            ? ({ type: 'group', id, title, children: [] } satisfies LayoutGruppe)
            : ({ type: 'step', id, title, children: [] } satisfies LayoutSchritt);

    return { ...gesichert, layout: [...gesichert.layout, rahmen] };
}

/** Aendert Titel oder Beschreibung eines Rahmens. */
export function rahmenAendern(
    definition: FormularDefinition,
    id: string,
    aenderungen: { title?: string; description?: string },
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);

    const gehen = (knoten: LayoutKnoten[]): LayoutKnoten[] =>
        knoten.map((eintrag) => {
            if (!istRahmen(eintrag)) {
                return eintrag;
            }

            return eintrag.id === id
                ? { ...eintrag, ...aenderungen }
                : { ...eintrag, children: gehen(eintrag.children) };
        });

    return { ...gesichert, layout: gehen(gesichert.layout) };
}

/**
 * Loest einen Rahmen auf — sein Inhalt rueckt eine Ebene nach aussen.
 *
 * Die Felder gehen NICHT mit. Ein Rahmen ist Darstellung, ein Feld ist ein
 * Datenschluessel, unter dem Antworten liegen. Wer eine Gruppe wegnimmt, will
 * die Gruppierung los sein und nicht die Angaben von hundert Leuten.
 *
 * Bedingungen, die auf den Rahmen zeigten, fallen mit ihm weg — sie haetten
 * sonst ein Ziel, das es nicht mehr gibt, und wuerden still nie zutreffen.
 */
export function rahmenEntfernen(
    definition: FormularDefinition,
    id: string,
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);

    const gehen = (knoten: LayoutKnoten[]): LayoutKnoten[] =>
        knoten.flatMap((eintrag) => {
            if (!istRahmen(eintrag)) {
                return [eintrag];
            }

            return eintrag.id === id
                ? eintrag.children
                : [{ ...eintrag, children: gehen(eintrag.children) }];
        });

    const uebrig = (gesichert.conditions ?? []).filter(
        (regel) => regel.target.ref !== id,
    );

    const naechste: FormularDefinition = { ...gesichert, layout: gehen(gesichert.layout) };

    if (uebrig.length > 0) {
        naechste.conditions = uebrig;
    } else {
        delete naechste.conditions;
    }

    return naechste;
}

/**
 * Verschiebt ein Feld in einen Rahmen — oder mit `null` wieder heraus.
 *
 * Erst ueberall entfernen, dann einsetzen. Wer das umdreht, hat das Feld
 * zweimal im Baum, und sichtbar bleibt das erste Vorkommen: die Bewegung
 * sieht aus, als waere sie nicht passiert.
 */
export function feldInRahmen(
    definition: FormularDefinition,
    name: string,
    rahmenId: string | null,
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);

    if (!gesichert.fields.some((feld) => feld.name === name)) {
        return definition;
    }

    const bereinigt = ausLayoutEntfernen(gesichert.layout, name);
    const zeile: LayoutZeile = { type: 'row', columns: [[name]] };

    if (rahmenId === null) {
        return { ...gesichert, layout: [...bereinigt, zeile] };
    }

    let gefunden = false;

    const gehen = (knoten: LayoutKnoten[]): LayoutKnoten[] =>
        knoten.map((eintrag) => {
            if (!istRahmen(eintrag)) {
                return eintrag;
            }

            if (eintrag.id === rahmenId) {
                gefunden = true;

                return { ...eintrag, children: [...eintrag.children, zeile] };
            }

            return { ...eintrag, children: gehen(eintrag.children) };
        });

    const layout = gehen(bereinigt);

    // Ein Rahmen, den es nicht gibt, darf das Feld nicht verschlucken.
    return gefunden
        ? { ...gesichert, layout }
        : { ...gesichert, layout: [...bereinigt, zeile] };
}

/** In welchem Rahmen ein Feld liegt — `null`, wenn es frei steht. */
export function rahmenVonFeld(
    definition: FormularDefinition,
    name: string,
): string | null {
    const gehen = (knoten: LayoutKnoten[], eltern: string | null): string | null => {
        for (const eintrag of knoten) {
            if (istRahmen(eintrag)) {
                const treffer = gehen(eintrag.children, eintrag.id);

                if (treffer !== null) {
                    return treffer;
                }

                continue;
            }

            if (istZeile(eintrag) && eintrag.columns.flat().includes(name)) {
                return eltern;
            }
        }

        return null;
    };

    return gehen(definition.layout ?? [], null);
}

/** Alle Rahmen der Definition, fuer Auswahllisten im Editor. */
export function rahmenListe(
    definition: FormularDefinition,
): Array<{ id: string; art: 'group' | 'step'; titel: string }> {
    const aus: Array<{ id: string; art: 'group' | 'step'; titel: string }> = [];

    const gehen = (knoten: LayoutKnoten[]): void => {
        for (const eintrag of knoten) {
            if (istRahmen(eintrag)) {
                aus.push({
                    id: eintrag.id,
                    art: eintrag.type,
                    titel: eintrag.title || (eintrag.type === 'group' ? 'Gruppe' : 'Schritt'),
                });
                gehen(eintrag.children);
            }
        }
    };

    gehen(definition.layout ?? []);

    return aus;
}

/**
 * Die Spalten der Zeile, in der ein Feld steht — `null`, wenn keine da ist.
 *
 * Fuer die Auswahlfelder im Editor: Er muss wissen, ob ein Feld allein steht
 * und wer sonst noch in seiner Zeile ist, ohne das Layout selbst zu durchlaufen.
 * Taete er es selbst, gaebe es eine zweite Lesart derselben Struktur — und die
 * waere beim naechsten Umbau die falsche.
 */
export function zeileVonFeld(
    definition: FormularDefinition,
    name: string,
): LayoutSpalte[] | null {
    const suchen = (knoten: LayoutKnoten[]): LayoutSpalte[] | null => {
        for (const eintrag of knoten) {
            if (istRahmen(eintrag)) {
                const treffer = suchen(eintrag.children);

                if (treffer !== null) {
                    return treffer;
                }

                continue;
            }

            if (istZeile(eintrag) && eintrag.columns.flat().includes(name)) {
                return eintrag.columns;
            }
        }

        return null;
    };

    return suchen(definition.layout ?? []);
}

/**
 * Holt ein Feld aus seiner geteilten Zeile in eine eigene.
 *
 * Der Rueckweg zu {@see feldNebenFeld}. Ohne ihn ist das Nebeneinanderstellen
 * eine Einbahnstrasse: Zwei Felder in eine Zeile zu legen geht mit einem Griff,
 * sie wieder zu trennen gar nicht.
 *
 * Die neue Zeile steht direkt UNTER der alten und nicht am Ende des Formulars.
 * Ein Feld, das beim Heraustrennen ans andere Ende springt, sieht aus wie ein
 * Fehler — und der Zusammenhang zum eigenen Handgriff ist von aussen nicht mehr
 * zu sehen. Gefunden wird die Stelle ueber ein verbliebenes Nachbarfeld, weil
 * ein Zeilenindex in Gruppen und Schritten das Falsche trifft.
 */
export function feldEigeneZeile(
    definition: FormularDefinition,
    name: string,
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);
    const spalten = zeileVonFeld(gesichert, name);

    // Steht schon allein — oder gibt es gar nicht. Beides ist kein Umbau.
    if (spalten === null || spalten.flat().length <= 1) {
        return definition;
    }

    const anker = spalten.flat().find((eintrag) => eintrag !== name);

    if (anker === undefined) {
        return definition;
    }

    const bereinigt = ausLayoutEntfernen(gesichert.layout, name);
    const zeile: LayoutZeile = { type: 'row', columns: [[name]] };
    let gesetzt = false;

    const gehen = (knoten: LayoutKnoten[]): LayoutKnoten[] =>
        knoten.flatMap((eintrag): LayoutKnoten[] => {
            if (istRahmen(eintrag)) {
                return [{ ...eintrag, children: gehen(eintrag.children) }];
            }

            if (gesetzt || !istZeile(eintrag) || !eintrag.columns.flat().includes(anker)) {
                return [eintrag];
            }

            gesetzt = true;

            return [eintrag, zeile];
        });

    const layout = gehen(bereinigt);

    // Wie bei `feldNebenFeld`: nicht untergebracht heisst unveraendert. Ein
    // Feld, das beim Verschieben verschwindet, waere schlimmer als eines, das
    // sich nicht verschieben laesst.
    return gesetzt ? { ...gesichert, layout } : definition;
}

/**
 * Legt ein Feld NEBEN ein anderes — beide stehen danach in einer Zeile.
 *
 * Ueber den Namen des Zielfelds und nicht ueber einen Zeilenindex:
 * `feldVerschieben` rechnet mit `layout[ziel.zeile]` und trifft damit das
 * Falsche, sobald Zeilen in Gruppen oder Schritten liegen. Diese Funktion
 * sucht rekursiv und ist von der Ebene unabhaengig.
 *
 * Ist die Zielzeile voll (`MAX_SPALTEN`), passiert nichts: mehr als drei
 * Felder nebeneinander sind auf keinem Bildschirm lesbar, und stillschweigend
 * eine vierte Spalte anzulegen waere eine Regel, die nur hier gilt.
 */
export function feldNebenFeld(
    definition: FormularDefinition,
    name: string,
    zielName: string,
): FormularDefinition {
    const gesichert = layoutSicherstellen(definition);

    if (name === zielName) {
        return definition;
    }

    if (!gesichert.fields.some((feld) => feld.name === name)) {
        return definition;
    }

    const bereinigt = ausLayoutEntfernen(gesichert.layout, name);
    let gesetzt = false;

    const gehen = (knoten: LayoutKnoten[]): LayoutKnoten[] =>
        knoten.map((eintrag) => {
            if (istRahmen(eintrag)) {
                return { ...eintrag, children: gehen(eintrag.children) };
            }

            if (
                gesetzt ||
                !istZeile(eintrag) ||
                !eintrag.columns.flat().includes(zielName)
            ) {
                return eintrag;
            }

            if (eintrag.columns.length >= MAX_SPALTEN) {
                return eintrag;
            }

            gesetzt = true;

            return { type: 'row' as const, columns: [...eintrag.columns, [name]] };
        });

    const layout = gehen(bereinigt);

    // Nicht untergebracht — dann bleibt alles, wie es war. Ein Feld, das beim
    // Verschieben verschwindet, waere schlimmer als eines, das sich nicht
    // verschieben laesst.
    return gesetzt ? { ...gesichert, layout } : definition;
}
