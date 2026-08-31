import type {
    Ablaufkante,
    Bedingungsregel,
    FormularDefinition,
    FormularFeld,
    LayoutKnoten,
    LayoutZeile,
    Pruefung,
    RoheDefinition,
    Vergleich,
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

    // Die drei neuen Schluessel muessen HIER durchgereicht werden.
    //
    // Der Editor liest die gespeicherte Definition durch diese Funktion und
    // schreibt spaeter zurueck, was er haelt. Wuerde hier ein Objekt aus nur
    // `fields` und `layout` gebaut, waeren die Bedingungen nach dem naechsten
    // Speichern weg — und zwar unbemerkt: ein Formular ohne Bedingungen sieht
    // aus wie ein Formular, bei dem nie welche eingestellt waren.
    const conditions = Array.isArray(roh.conditions)
        ? roh.conditions.filter(istBedingungsregel)
        : undefined;
    const flow = Array.isArray(roh.flow)
        ? roh.flow.filter(istAblaufkante)
        : undefined;
    const graph =
        typeof roh.graph === 'object' && roh.graph !== null ? roh.graph : undefined;

    return {
        fields,
        ...(layout ? { layout } : {}),
        ...(conditions && conditions.length > 0 ? { conditions } : {}),
        ...(flow && flow.length > 0 ? { flow } : {}),
        ...(graph ? { graph } : {}),
    };
}

const VERGLEICHE: readonly Vergleich[] = [
    'is',
    'is_not',
    'contains',
    'not_contains',
    'filled',
    'empty',
    'gt',
    'lt',
];

function textGefuellt(wert: unknown): wert is string {
    return typeof wert === 'string' && wert !== '';
}

function istPruefung(kandidat: unknown): kandidat is Pruefung {
    if (typeof kandidat !== 'object' || kandidat === null) {
        return false;
    }

    const pruefung = kandidat as Pruefung;

    return (
        textGefuellt(pruefung.field) &&
        VERGLEICHE.includes(pruefung.op)
    );
}

/**
 * Anders als beim Layout wird hier streng gefiltert.
 *
 * Beim Layout waere das falsch — dort liegt ein gewachsener Bestand, und eine
 * zu enge Pruefung wuerde bestehende Formulare leerraeumen. Bedingungen sind
 * neu: es gibt keinen Bestand, den eine strenge Pruefung treffen koennte.
 * Eine halbe Regel dagegen ist gefaehrlich — sie entscheidet ueber
 * Sichtbarkeit, und was sie bei fehlenden Angaben tut, waere Zufall.
 */
function istBedingungsregel(kandidat: unknown): kandidat is Bedingungsregel {
    if (typeof kandidat !== 'object' || kandidat === null) {
        return false;
    }

    const regel = kandidat as Bedingungsregel;

    return (
        textGefuellt(regel.id) &&
        typeof regel.target === 'object' &&
        regel.target !== null &&
        ['field', 'group', 'step'].includes(regel.target.kind) &&
        textGefuellt(regel.target.ref) &&
        ['show', 'hide', 'require', 'optional'].includes(regel.effect) &&
        ['all', 'any'].includes(regel.match) &&
        Array.isArray(regel.tests) &&
        regel.tests.length > 0 &&
        regel.tests.every(istPruefung)
    );
}

function istAblaufkante(kandidat: unknown): kandidat is Ablaufkante {
    if (typeof kandidat !== 'object' || kandidat === null) {
        return false;
    }

    const kante = kandidat as Ablaufkante;

    if (
        !textGefuellt(kante.id) ||
        !textGefuellt(kante.from) ||
        !textGefuellt(kante.to)
    ) {
        return false;
    }

    // Ohne Pruefungen ist die Kante der unbedingte Weg — das ist gueltig und
    // der haeufigste Fall.
    return kante.tests === undefined
        ? true
        : Array.isArray(kante.tests) && kante.tests.every(istPruefung);
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
 *
 * `hotel_booking` stand hier urspruenglich fest verdrahtet. Das ist ein Typ,
 * den nur Peppermint Connect kennt — in einem Paket, das mehrere Produkte
 * benutzen, hat er nichts zu suchen. Produkteigene Typen melden ihre Regel
 * jetzt selbst an.
 */
export function labelStehtImFeld(
    typ: string,
    eigeneMitLabelImFeld: string[] = [],
): boolean {
    return typ === 'checkbox' || eigeneMitLabelImFeld.includes(typ);
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

export interface AufgeloesteGruppe {
    type: 'group';
    id: string;
    title?: string;
    description?: string;
    children: AufgeloesterKnoten[];
}

export interface AufgeloesterSchrittknoten {
    type: 'step';
    id: string;
    title?: string;
    description?: string;
    children: AufgeloesterKnoten[];
}

export type AufgeloesterKnoten =
    | AufgeloesteZeile
    | AufgeloesterAbschnitt
    | AufgeloesteGruppe
    | AufgeloesterSchrittknoten;

/**
 * Uebersetzt Definition und Layout in das, was gerendert wird.
 *
 * Fuenf Regeln, jede davon gegen einen konkreten Ausfall:
 *
 * 1. **Kein Layout** → alles einspaltig in der Reihenfolge von `fields`. Genau
 *    die Darstellung von vor der Layout-Ebene, damit Bestandsformulare ohne
 *    Migration weiterlaufen.
 * 2. **Feld in `fields`, aber in keiner Spalte** → hinten anhaengen. Ein Feld
 *    darf niemals unsichtbar werden, nur weil das Layout es nicht kennt; sonst
 *    verschwindet ein Pflichtfeld lautlos aus dem Formular. Gilt auch bei
 *    Schritten: das Feld landet dann auf der letzten Seite, nicht nirgends.
 * 3. **Spalte verweist auf einen unbekannten Namen** → ueberspringen. Passiert
 *    nach jedem Loeschen eines Feldes.
 * 4. **Derselbe Name mehrfach im Layout** → nur das erste Vorkommen. Zwei
 *    Eingabefelder auf denselben Datenschluessel wuerden sich gegenseitig
 *    ueberschreiben, und welches gewinnt, waere Zufall. Der Zaehler laeuft
 *    ueber den GANZEN Baum, nicht je Gruppe.
 * 5. **Knoten, mit dem hier niemand rechnet** → ueberspringen. Vorher griff
 *    der Rueckfall blind auf `columns` zu; ein Knoten ohne Spalten riss damit
 *    die ganze Seite mit, statt nur sich selbst.
 */
export function layoutAufloesen(
    definition: FormularDefinition,
): AufgeloesterKnoten[] {
    const { fields } = definition;
    const nachName = new Map(fields.map((feld) => [feld.name, feld]));
    const verbraucht = new Set<string>();

    const knoten = knotenAufloesen(definition.layout ?? [], nachName, verbraucht);

    for (const feld of fields) {
        if (!verbraucht.has(feld.name)) {
            knoten.push({ type: 'row', columns: [[feld]] });
        }
    }

    return knoten;
}

function knotenAufloesen(
    liste: LayoutKnoten[],
    nachName: Map<string, FormularFeld>,
    verbraucht: Set<string>,
): AufgeloesterKnoten[] {
    const aufgeloest: AufgeloesterKnoten[] = [];

    for (const eintrag of liste) {
        if (typeof eintrag !== 'object' || eintrag === null) {
            continue;
        }

        if (eintrag.type === 'section') {
            aufgeloest.push({
                type: 'section',
                title: eintrag.title,
                ...(eintrag.description ? { description: eintrag.description } : {}),
            });
            continue;
        }

        if (eintrag.type === 'group' || eintrag.type === 'step') {
            const children = knotenAufloesen(
                Array.isArray(eintrag.children) ? eintrag.children : [],
                nachName,
                verbraucht,
            );

            // Ein Rahmen ohne Inhalt ist im Formular eine Luecke, bei einem
            // Schritt sogar eine leere Seite mit Weiter-Schaltflaeche. Beides
            // entsteht, sobald jemand die Felder darin loescht.
            if (children.length === 0) {
                continue;
            }

            aufgeloest.push({
                type: eintrag.type,
                id: eintrag.id,
                ...(eintrag.title ? { title: eintrag.title } : {}),
                ...(eintrag.description ? { description: eintrag.description } : {}),
                children,
            });
            continue;
        }

        if (!Array.isArray((eintrag as LayoutZeile).columns)) {
            continue;
        }

        const columns = (eintrag as LayoutZeile).columns
            .map((spalte) =>
                (Array.isArray(spalte) ? spalte : [])
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
            aufgeloest.push({ type: 'row', columns });
        }
    }

    return aufgeloest;
}

/** Ein Schritt mit seinem aufgeloesten Inhalt. */
export interface AufgeloesterSchritt {
    id: string;
    title?: string;
    description?: string;
    knoten: AufgeloesterKnoten[];
    /**
     * Wahr, wenn dieser Schritt nicht in der Definition stand.
     *
     * Ein einstufiges Formular bekommt hier einen impliziten Schritt, damit
     * die Zeichenseite nur EINEN Fall kennt. Sie darf ihn aber nicht
     * beschriften oder eine Fortschrittsanzeige daraus bauen — sonst
     * verwandelt sich jedes bestehende Formular in „Schritt 1 von 1".
     */
    implizit?: boolean;
}

/**
 * Die Seiten des Formulars, in Reihenfolge.
 *
 * Steht auf oberster Ebene kein Schritt, ist alles EIN impliziter Schritt —
 * die Darstellung von vor dieser Ebene.
 *
 * Ein loser Knoten neben Schritten faellt an den zuletzt eroeffneten Schritt;
 * steht er vor dem ersten, entsteht ein impliziter Schritt davor. Das ist
 * bewusst tolerant statt streng: ein Knoten, den niemand einer Seite
 * zugeordnet hat, verschwindet sonst aus dem Formular, ohne dass etwas
 * fehlschlaegt.
 */
export function schritteAufloesen(
    definition: FormularDefinition,
): AufgeloesterSchritt[] {
    const knoten = layoutAufloesen(definition);

    if (!knoten.some((eintrag) => eintrag.type === 'step')) {
        return [{ id: 'schritt-1', knoten, implizit: true }];
    }

    const schritte: AufgeloesterSchritt[] = [];

    for (const eintrag of knoten) {
        if (eintrag.type === 'step') {
            schritte.push({
                id: eintrag.id,
                ...(eintrag.title ? { title: eintrag.title } : {}),
                ...(eintrag.description ? { description: eintrag.description } : {}),
                knoten: eintrag.children,
            });
            continue;
        }

        if (schritte.length === 0) {
            schritte.push({ id: 'schritt-1', knoten: [], implizit: true });
        }

        schritte[schritte.length - 1]!.knoten.push(eintrag);
    }

    return schritte;
}

/**
 * Alle Felder eines Layouts in Anzeigereihenfolge.
 *
 * Fuer alles, was die Felder braucht, aber nicht die Zeilen: Validierung,
 * Vorbefuellung, Export. Steigt in Gruppen und Schritte hinab — ein Feld in
 * einer Gruppe ist ein Feld des Formulars.
 */
export function felderInReihenfolge(
    definition: FormularDefinition,
): FormularFeld[] {
    return felderAusKnoten(layoutAufloesen(definition));
}

function felderAusKnoten(knoten: AufgeloesterKnoten[]): FormularFeld[] {
    return knoten.flatMap((eintrag) => {
        if (eintrag.type === 'row') {
            return eintrag.columns.flat();
        }

        if (eintrag.type === 'group' || eintrag.type === 'step') {
            return felderAusKnoten(eintrag.children);
        }

        return [];
    });
}

/** Das Gegenstueck zu `layoutAufloesen` fuer den Editor. */
export function zeileAusFeldern(namen: string[][]): LayoutZeile {
    return { type: 'row', columns: namen };
}

/** Eine Option, wie sie angezeigt wird. */
export interface AnzeigeOption {
    wert: string;
    label: string;
    /** Wahr, wenn dieser Wert nur noch da ist, weil er gespeichert war. */
    bestandswert?: boolean;
}

/**
 * Die Optionen eines Feldes, ergaenzt um einen gespeicherten Fremdwert.
 *
 * Ein Wert, der nicht (mehr) zur Auswahl steht, muss sichtbar bleiben — sonst
 * zeigt die Maske ein leeres Feld, und das naechste Speichern wirft den Wert
 * stillschweigend weg. Es faellt niemandem auf: Die Maske sieht aus, als waere
 * dort nie etwas gewesen.
 *
 * Vorkommen in der Praxis: Angaben aus einem CSV-Import und Optionen, die nach
 * der Anmeldung umbenannt wurden.
 *
 * Steht bewusst hier und nicht in der React-Schicht — ein Vue-Adapter braucht
 * dieselbe Regel, und zweimal geschrieben waere sie zweimal zu pflegen.
 */
export function optionenMitBestandswert(
    feld: FormularFeld,
    wert: string,
    hinweis = '(nicht mehr zur Auswahl)',
): AnzeigeOption[] {
    const optionen = nutzbareOptionen(feld);
    const anzeige: AnzeigeOption[] = optionen.map((o) => ({ wert: o, label: o }));

    // Ohne Optionsliste gibt es nichts, wovon der Wert abweichen koennte.
    if (wert === '' || optionen.length === 0 || optionen.includes(wert)) {
        return anzeige;
    }

    return [
        ...anzeige,
        { wert, label: `${wert} ${hinweis}`.trim(), bestandswert: true },
    ];
}
