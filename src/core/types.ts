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
    | 'checkboxes'
    | 'radio'
    | 'scale'
    | 'nps';

/**
 * Der Wert einer Antwort.
 *
 * Zeichenketten, mit EINER Ausnahme: `checkboxes` speichert eine Liste.
 *
 * Die Zeichenketten-Regel war bis hierher ausnahmslos, und zwar mit Grund —
 * die Antworten liegen als JSON-Objekt in einer Spalte, ein echtes `true`
 * haette dort neben lauter Texten gestanden. Der Kommentar an `checkbox`
 * warnt deshalb: wer das aendert, muss alle Bestandsdaten mit aendern.
 *
 * Fuer `checkboxes` gilt das NICHT, und der Unterschied ist der springende
 * Punkt: Es ist ein NEUER Typ. Kein gespeicherter Wert aendert seine Gestalt,
 * weil es keinen gibt — nur der Typ wird weiter. Eine Mehrfachauswahl als
 * Trennzeichen-Text abzulegen waere die scheinbar sparsame Wahl und die
 * schlechtere: `contains` waere dann ein Teilstring-Vergleich, und
 * „Workshop A" traefe auch auf „Workshop AB" zu.
 */
export type Feldwert = string | string[];

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

    /** Nur fuer `select`, `radio` und `checkboxes`. */
    options?: string[];

    /**
     * Nur fuer `scale`: wie viele Stufen die Skala hat. Vorgabe 5.
     *
     * Eine Skala ist damit eine FERTIGE Frage und keine, die man sich aus
     * Auswahlknoepfen zusammenbaut. Genau darin liegt der Unterschied
     * zwischen einem Formular-Baukasten und einem Umfrage-Werkzeug: Wer eine
     * Bewertung braucht, waehlt sie aus, statt fuenf Optionszeilen zu tippen —
     * und dann sieht jede Skala im Haus gleich aus.
     */
    stufen?: number;

    /** Nur fuer `scale`: die Beschriftung der beiden Enden. */
    skalaVon?: string;
    skalaBis?: string;

    /**
     * Nur fuer `scale`: wie die Stufen aussehen sollen.
     *
     * Ein WUNSCH an die Anwendung, keine Zusage. Wer keine Sterne zeichnen
     * kann, zeichnet Zahlen — der gespeicherte Wert ist in jedem Fall die
     * Stufe als Zeichenkette, und daran haengt die Auswertung.
     */
    skalaDarstellung?: 'zahlen' | 'sterne' | 'smilies';

    /** Hilfetext unter dem Feld. */
    hinweis?: string;

    /**
     * Woher das Feld beim Oeffnen vorbelegt wird — ein Pfad in die Daten der
     * Anwendung, etwa `order.delivery_date`.
     *
     * Nur eine VORBELEGUNG, keine Bindung: Der Wert wird beim Oeffnen
     * eingesetzt und danach wie jede andere Antwort gespeichert. Wer ihn
     * ueberschreibt, behaelt seine Aenderung, auch wenn sich die Quelle
     * spaeter aendert. Ein ausgedrucktes Formular soll den Stand vom
     * Druckzeitpunkt zeigen, nicht den von heute.
     *
     * Welche Pfade es gibt, weiss nur die Anwendung — der Editor bekommt sie
     * als Liste gereicht. Die Gegenstelle ist `FormularFeld::$quelle`.
     */
    quelle?: string;
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

    /**
     * Macht aus der Gruppe eine MATRIX: eine Zeile je Feld, dieselben Spalten
     * fuer alle.
     *
     * ## Warum das Layout und nicht ein Feldtyp
     *
     * Eine Matrix erzeugt MEHRERE Antworten — eine je Zeile. Ein
     * `FormularFeld` hat aber genau einen `name`, und unter dem liegt genau
     * eine Antwort. Ein Feldtyp `matrix` muesste den Vertrag brechen und einen
     * verschachtelten Wert speichern; jede Leseseite muesste danach lernen,
     * dass ein Wert auch ein Objekt sein kann.
     *
     * Stattdessen ist eine Matrix-Zeile ein GEWOEHNLICHES `radio`-Feld mit
     * eigenem Datenschluessel. Bedingungen greifen je Zeile, der Export hat
     * eine Spalte je Zeile, und die Auswertung rechnet ohne Sonderfall.
     *
     * ## Und warum sie damit wegwerfbar ist
     *
     * Faellt diese Angabe weg, stehen dieselben Fragen untereinander statt
     * nebeneinander. Unschoener, aber vollstaendig — kein Datenverlust. Genau
     * das ist die Zusage des Layouts: man darf es wegwerfen, umbauen und neu
     * erfinden, ohne dass eine Antwort ihren Platz verliert.
     *
     * Die Spalten stehen ZUSAETZLICH als `options` an jedem Zeilenfeld. Das
     * ist keine Dopplung aus Bequemlichkeit: Daran haengt die
     * `in:`-Validierung, und die darf nicht davon abhaengen, ob eine
     * Layout-Angabe erhalten geblieben ist.
     */
    matrix?: {
        spalten: string[];
    };

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
 *
 * ## Auf einer Mehrfachauswahl
 *
 * Dort gibt es keinen einen Wert, dem etwas gleichen koennte. Deshalb bedeuten
 * `is`/`is_not` und `contains`/`not_contains` dasselbe: **ist diese Option
 * angekreuzt**, verglichen als ganzer Eintrag.
 *
 * Dass `is` hier wie `contains` wirkt, ist eine Entscheidung gegen die
 * Alternative, es fehlschlagen zu lassen. Wer im Editor „ist" und „Workshop A"
 * waehlt, meint „Workshop A wurde gewaehlt" — eine Regel, die daraufhin nie
 * zutrifft, ist eine Falle ohne Fehlermeldung.
 *
 * `gt`/`lt` treffen auf einer Liste nie zu: Eine Menge ist nicht groesser als
 * ein Text. `filled`/`empty` fragen, ob ueberhaupt etwas angekreuzt ist.
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

    /**
     * Die Kennung des Rahmens, in dem diese Position gilt — oder `undefined`
     * fuer die oberste Ebene.
     *
     * ## Warum das mitgespeichert wird
     *
     * Eine Position innerhalb eines Rahmens ist RELATIV zu ihm. Wandert das
     * Feld in einen anderen Rahmen oder heraus, zeigt dieselbe Zahl
     * irgendwohin.
     *
     * Der Graph-Editor raeumt das beim Hineinziehen selbst auf
     * (`anordnungVergessen`). Aber ein Feld kann den Rahmen auch auf anderen
     * Wegen wechseln: ueber die Listenansicht, ueber eine Schnittstelle, oder
     * weil eine Anwendung eine Gruppe um vorhandene Zeilen legt. Auf diesen
     * Wegen wusste bisher niemand, dass eine gespeicherte Position ungueltig
     * geworden war.
     *
     * Beobachtet am 28.10.2026 in peppermint-connect: Nachdem eine Gruppe
     * „Rechnungsangaben" serverseitig um vorhandene Zeilen gelegt und danach
     * in der Listenansicht umsortiert wurde, ueberlappten sich im Graphen drei
     * Felder — sie standen noch dort, wo sie VOR dem Rahmen gestanden hatten.
     *
     * Fehlt die Angabe, gilt die Position fuer die oberste Ebene. Damit
     * bleiben Bestandsdefinitionen lesbar: Was dort steht, stammt aus einer
     * Zeit, in der es nur die oberste Ebene gab oder der Graph-Editor selbst
     * aufgeraeumt hat.
     */
    parent?: string;
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
