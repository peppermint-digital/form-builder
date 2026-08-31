/**
 * Die Typen des Formular-Baukastens.
 *
 * Der Kern der Aufteilung: `FormularFeld` ist ein DATENVERTRAG, `LayoutKnoten`
 * ist Darstellung. Beide leben in derselben Definition, aber nur der erste
 * bestimmt, unter welchem Schluessel eine Antwort gespeichert wird.
 *
 * Deshalb verweisen Spalten ausschliesslich auf `feld.name` und enthalten das
 * Feld nicht: ein Layout darf man wegwerfen, umbauen und neu erfinden, ohne
 * dass eine einzige gespeicherte Antwort ihren Platz verliert.
 */

/** Feldtypen, die jedes Produkt kennt. */
export type StandardFeldTyp =
    | 'text'
    | 'email'
    | 'textarea'
    | 'tel'
    | 'number'
    | 'date'
    | 'select'
    | 'checkbox'
    | 'radio';

/**
 * Der Typ eines Feldes.
 *
 * Bewusst offen fuer eigene Werte: Peppermint Connect kennt `hotel_booking`,
 * ein anderes Produkt kennt etwas anderes. Produkteigene Typen gehoeren in die
 * Anwendung, nicht in dieses Paket — sonst wandert die Fachlichkeit eines
 * Produkts in ein Paket, das alle benutzen.
 */
export type FeldTyp = StandardFeldTyp | (string & {});

export interface FormularFeld {
    /**
     * Fehlt bei Bestandsformularen aus Import, Seeder oder API.
     *
     * Sie ist NICHT der Datenschluessel — das ist `name`. Sie dient nur dazu,
     * zwei Felder im Editor auseinanderzuhalten. Wer sie als Schluessel
     * benutzt, verliert bei Bestandsdaten alles auf einmal.
     */
    id?: string;

    /**
     * Der Datenschluessel. Unter diesem Namen liegt die Antwort.
     *
     * Aendert er sich, sind alle bereits gespeicherten Werte unauffindbar —
     * ohne dass irgendetwas sichtbar kaputtgeht. Genau davor schuetzt die
     * Waisen-Sperre auf der Laravel-Seite.
     */
    name: string;

    /** Die Beschriftung. Frei aenderbar, haengt nichts daran. */
    label: string;

    type: FeldTyp;
    placeholder?: string;
    required?: boolean;

    /** Nur fuer `select` und `radio`. */
    options?: string[];

    /** Hilfetext unter dem Feld. */
    hinweis?: string;
}

/** Eine Spalte enthaelt Feldnamen, keine Felder. */
export type LayoutSpalte = string[];

export interface LayoutZeile {
    type: 'row';
    /**
     * Ein bis drei Spalten. Mehr ist auf einem Formular nicht lesbar, und auf
     * dem Telefon wird ohnehin alles untereinander gestapelt.
     */
    columns: LayoutSpalte[];
}

export interface LayoutAbschnitt {
    type: 'section';
    title: string;
    description?: string;
}

/**
 * Ein Rahmen um mehrere Knoten.
 *
 * Anders als `LayoutAbschnitt`, der nur eine Ueberschrift IN die Reihenfolge
 * setzt, haelt eine Gruppe ihren Inhalt: sie laesst sich als Ganzes ein- und
 * ausblenden, und im Knoten-Editor ist sie ein aufziehbarer Rahmen.
 *
 * `id` ist NICHT der Datenschluessel — Gruppen speichern nichts. Sie ist da,
 * damit eine Bedingung auf die Gruppe zeigen kann statt auf jedes Feld darin.
 */
export interface LayoutGruppe {
    type: 'group';
    id: string;
    title?: string;
    description?: string;
    children: LayoutKnoten[];
}

/**
 * Eine Seite des Formulars.
 *
 * Schritte sind gewoehnliche Layout-Knoten und keine zweite Liste neben
 * `layout`. Das ist der springende Punkt: gaebe es `steps` UND `layout`,
 * muesste an jeder Leseseite entschieden werden, welches von beiden gilt —
 * und die Antwort fiele verschieden aus.
 *
 * Ein Formular ist mehrstufig, sobald irgendwo auf oberster Ebene ein Schritt
 * steht. Steht keiner da, ist alles eine Seite; genau die Darstellung von vor
 * dieser Ebene, damit Bestandsformulare unveraendert weiterlaufen.
 */
export interface LayoutSchritt {
    type: 'step';
    id: string;
    title?: string;
    description?: string;
    children: LayoutKnoten[];
}

export type LayoutKnoten =
    | LayoutZeile
    | LayoutAbschnitt
    | LayoutGruppe
    | LayoutSchritt;

/**
 * Wie ein gespeicherter Wert mit einem Vergleichswert verglichen wird.
 *
 * Bewusst wenige und bewusst als Zeichenketten gespeichert: die Antworten
 * liegen als JSON neben lauter Texten, ein Ankreuzfeld kommt als '1' oder '0'
 * an. Ein Vergleich, der Typen voraussetzt, die es dort nicht gibt, ist eine
 * Regel, die im Editor plausibel aussieht und im Formular nie zutrifft.
 */
export type Vergleich =
    | 'is'
    | 'is_not'
    | 'contains'
    | 'not_contains'
    | 'filled'
    | 'empty'
    | 'gt'
    | 'lt';

export interface Pruefung {
    /** Der DATENSCHLUESSEL des gepruefeten Feldes (`feld.name`), nicht `feld.id`. */
    field: string;
    op: Vergleich;
    /** Fehlt bei `filled` und `empty` — dort gibt es nichts zu vergleichen. */
    value?: string;
}

/**
 * Worauf eine Bedingung wirkt.
 *
 * `kind: 'field'` zeigt auf `feld.name`, `'group'` und `'step'` auf deren `id`.
 * Die beiden Namensraeume sind getrennt, deshalb steht die Art dabei — sonst
 * traefe eine Regel bei gleichlautenden Kennungen das Falsche.
 */
export interface Bedingungsziel {
    kind: 'field' | 'group' | 'step';
    ref: string;
}

/**
 * Was mit dem Ziel geschieht, wenn die Pruefungen zutreffen.
 *
 * `require`/`optional` gibt es neben `show`/`hide`, weil „nur dann Pflicht"
 * etwas anderes ist als „nur dann sichtbar": ein Feld kann sichtbar und
 * freiwillig sein.
 */
export type Wirkung = 'show' | 'hide' | 'require' | 'optional';

export interface Bedingungsregel {
    id: string;
    target: Bedingungsziel;
    effect: Wirkung;
    /** `all` = alle Pruefungen (UND), `any` = mindestens eine (ODER). */
    match: 'all' | 'any';
    tests: Pruefung[];
}

/**
 * Ein Weg von einem Schritt zum naechsten.
 *
 * Ohne `tests` ist die Kante der unbedingte Weg — der Rueckfall, wenn keine
 * bedingte Kante zutrifft. Ein Schritt ohne ausgehende Kante ist der letzte.
 */
export interface Ablaufkante {
    id: string;
    /** `id` des Schritts, von dem der Weg ausgeht. */
    from: string;
    /** `id` des Schritts, zu dem er fuehrt. */
    to: string;
    match?: 'all' | 'any';
    tests?: Pruefung[];
}

export interface Knotenposition {
    x: number;
    y: number;
}

/**
 * Wie der Knoten-Editor die Definition anordnet.
 *
 * Reine Kosmetik, und zwar mit Absicht: eine Definition ohne `graph` muss
 * vollstaendig funktionieren. Waeren die Positionen noetig, waere der Graph
 * ein zweites Format neben `layout` — und ein Formular, das nur ueber den
 * Knoten-Editor entstehen kann.
 */
export interface Knotengroesse {
    breite: number;
    hoehe: number;
}

export interface GraphDarstellung {
    /** Kennung → Position. Feldnamen, Gruppen-, Schritt- und Regel-Kennungen. */
    positions?: Record<string, Knotenposition>;

    /**
     * Kennung → von Hand gesetzte Groesse. Nur fuer Rahmen.
     *
     * Dieselbe Rolle wie `positions`: was hier steht, gewinnt; was fehlt,
     * wird aus dem Inhalt gerechnet. Ein Rahmen, den jemand groesser gezogen
     * hat, soll nicht beim naechsten Feld wieder zusammenschnurren.
     */
    sizes?: Record<string, Knotengroesse>;
}

/**
 * Eine vollstaendige Formular-Definition.
 *
 * `layout` ist optional, und das ist keine Bequemlichkeit: Bestandsformulare
 * haben keins. Fehlt es, wird einspaltig in der Reihenfolge von `fields`
 * gerendert — dieselbe Darstellung wie vor der Layout-Ebene. Ohne diese Regel
 * braeuchte die Einfuehrung eine Migration ueber alle gespeicherten Formulare.
 */
export interface FormularDefinition {
    fields: FormularFeld[];
    layout?: LayoutKnoten[];

    /**
     * Sichtbarkeits- und Pflichtregeln.
     *
     * Bewusst Daten in der Definition und nicht im Graphen: der Knoten-Editor
     * ist eine ANSICHT hierauf. Laege die Wahrheit im Graphen, gaebe es eine
     * dritte Quelle neben `fields` und `layout` — und ein Formular, das sich
     * nur mit dem Graphen lesen liesse.
     */
    conditions?: Bedingungsregel[];

    /** Verzweigungen zwischen Schritten. Ohne Schritte bedeutungslos. */
    flow?: Ablaufkante[];

    /** Nur Anordnung. Fehlt sie, funktioniert alles unveraendert. */
    graph?: GraphDarstellung;
}

/**
 * Wie eine Definition ankommt, bevor sie normalisiert ist.
 *
 * Aeltere Bestaende speichern die nackte Feldliste statt eines Objekts mit
 * `fields`. Beide Formen muessen hereinkommen duerfen; nach `definitionLesen()`
 * gibt es nur noch eine.
 */
export type RoheDefinition =
    | FormularDefinition
    | FormularFeld[]
    | null
    | undefined;
