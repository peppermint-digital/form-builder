import type {
    FormularDefinition,
    FormularFeld,
    LayoutKnoten,
    LayoutZeile,
    RoheDefinition,
} from './types';

/**
 * Bringt jede gespeicherte Form auf dieselbe Gestalt.
 *
 * Es gibt drei Bestaende: das Objekt mit `fields`, die nackte Feldliste aus
 * aelteren Fassungen, und gar nichts. Wer das an jeder Leseseite einzeln
 * abfaengt, vergisst es an einer — und genau die faellt dann leer aus, ohne
 * Fehlermeldung.
 */
export function definitionLesen(roh: RoheDefinition): FormularDefinition {
    if (!roh) {
        return { fields: [] };
    }

    if (Array.isArray(roh)) {
        return { fields: roh.filter(istFeld) };
    }

    const fields = Array.isArray(roh.fields) ? roh.fields.filter(istFeld) : [];
    const layout = Array.isArray(roh.layout) ? roh.layout : undefined;

    return layout ? { fields, layout } : { fields };
}

function istFeld(kandidat: unknown): kandidat is FormularFeld {
    return (
        typeof kandidat === 'object' &&
        kandidat !== null &&
        typeof (kandidat as FormularFeld).name === 'string' &&
        (kandidat as FormularFeld).name !== ''
    );
}

/**
 * Die auswaehlbaren Werte eines Feldes, benutzbar gemacht.
 *
 * Der Baukasten speichert Optionen als `textarea.split('\n')`. Ein
 * abschliessender Zeilenumbruch — beim Tippen der Normalfall — erzeugt damit
 * einen LEEREN Eintrag. Radix lehnt ein `SelectItem` mit leerem Wert ab und
 * wirft: weisse Seite statt Formular (Connect-Bug #610).
 *
 * Der Riegel sitzt zusaetzlich beim Speichern. Hier bleibt er trotzdem, weil
 * Bestandsdaten bereits leere Eintraege enthalten koennen — ein Riegel, der
 * erst ab dem naechsten Speichern wirkt, hilft der Seite von heute nicht.
 */
export function nutzbareOptionen(feld: FormularFeld): string[] {
    const roh = Array.isArray(feld.options) ? feld.options : [];

    return [...new Set(roh.map((o) => String(o).trim()).filter((o) => o !== ''))];
}

/**
 * Ob dieser Feldtyp seine Beschriftung selbst zeichnet.
 *
 * Ankreuzfelder setzen den Text neben das Kaestchen, nicht darueber. Die
 * Schleife aussen darf dann kein zweites Label malen, sonst steht es doppelt.
 * Die Regel haengt am Typ und gehoert deshalb hierher — wer sie in jeder Maske
 * neu beruecksichtigen muss, vergisst sie, und es faellt erst im Browser auf.
 */
export function labelStehtImFeld(typ: string): boolean {
    return typ === 'checkbox' || typ === 'hotel_booking';
}

/** Eine Zeile mit aufgeloesten Feldern statt mit Namen. */
export interface AufgeloesteZeile {
    type: 'row';
    columns: FormularFeld[][];
}

export interface AufgeloesterAbschnitt {
    type: 'section';
    title: string;
    description?: string;
}

export type AufgeloesterKnoten = AufgeloesteZeile | AufgeloesterAbschnitt;

/**
 * Uebersetzt Definition und Layout in das, was gerendert wird.
 *
 * Vier Regeln, jede davon gegen einen konkreten Ausfall:
 *
 * 1. **Kein Layout** → alles einspaltig in der Reihenfolge von `fields`. Genau
 *    die Darstellung von vor der Layout-Ebene, damit Bestandsformulare ohne
 *    Migration weiterlaufen.
 * 2. **Feld in `fields`, aber in keiner Spalte** → hinten anhaengen. Ein Feld
 *    darf niemals unsichtbar werden, nur weil das Layout es nicht kennt; sonst
 *    verschwindet ein Pflichtfeld lautlos aus dem Formular.
 * 3. **Spalte verweist auf einen unbekannten Namen** → ueberspringen. Passiert
 *    nach jedem Loeschen eines Feldes.
 * 4. **Derselbe Name mehrfach im Layout** → nur das erste Vorkommen. Zwei
 *    Eingabefelder auf denselben Datenschluessel wuerden sich gegenseitig
 *    ueberschreiben, und welches gewinnt, waere Zufall.
 */
export function layoutAufloesen(
    definition: FormularDefinition,
): AufgeloesterKnoten[] {
    const { fields } = definition;
    const nachName = new Map(fields.map((feld) => [feld.name, feld]));
    const verbraucht = new Set<string>();

    const knoten: AufgeloesterKnoten[] = [];

    for (const eintrag of definition.layout ?? []) {
        if (istAbschnitt(eintrag)) {
            knoten.push({
                type: 'section',
                title: eintrag.title,
                ...(eintrag.description ? { description: eintrag.description } : {}),
            });
            continue;
        }

        const columns = eintrag.columns
            .map((spalte) =>
                spalte
                    .filter((name) => {
                        if (verbraucht.has(name) || !nachName.has(name)) {
                            return false;
                        }
                        verbraucht.add(name);

                        return true;
                    })
                    .map((name) => nachName.get(name)!),
            )
            .filter((spalte) => spalte.length > 0);

        // Eine Zeile, deren Felder alle geloescht wurden, hinterlaesst sonst
        // eine Luecke im Formular.
        if (columns.length > 0) {
            knoten.push({ type: 'row', columns });
        }
    }

    const uebrig = fields.filter((feld) => !verbraucht.has(feld.name));

    for (const feld of uebrig) {
        knoten.push({ type: 'row', columns: [[feld]] });
    }

    return knoten;
}

function istAbschnitt(
    knoten: LayoutKnoten,
): knoten is Extract<LayoutKnoten, { type: 'section' }> {
    return knoten.type === 'section';
}

/**
 * Alle Felder eines Layouts in Anzeigereihenfolge.
 *
 * Fuer alles, was die Felder braucht, aber nicht die Zeilen: Validierung,
 * Vorbefuellung, Export.
 */
export function felderInReihenfolge(
    definition: FormularDefinition,
): FormularFeld[] {
    return layoutAufloesen(definition)
        .filter((knoten): knoten is AufgeloesteZeile => knoten.type === 'row')
        .flatMap((zeile) => zeile.columns.flat());
}

/** Das Gegenstueck zu `layoutAufloesen` fuer den Editor. */
export function zeileAusFeldern(namen: string[][]): LayoutZeile {
    return { type: 'row', columns: namen };
}
