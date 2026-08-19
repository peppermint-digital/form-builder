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

export type LayoutKnoten = LayoutZeile | LayoutAbschnitt;

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
