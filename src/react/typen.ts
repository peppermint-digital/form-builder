import type { ComponentType, ReactNode } from 'react';

import type { AnzeigeOption, Feldwert, FormularFeld } from '../core';

/**
 * Die Vertraege, ueber die eine Anwendung ihre eigenen Eingabe-Elemente
 * einhaengt.
 *
 * Absichtlich schmal und absichtlich nicht die Schnittstelle irgendeiner
 * Bibliothek: shadcns `Select` erwartet ein halbes Dutzend verschachtelter
 * Bausteine, Nuxt UI erwartet etwas ganz anderes, ein nacktes `<select>`
 * wieder etwas anderes. Ein Paket, das eine dieser Formen zur Vorgabe macht,
 * ist ein Paket fuer genau ein Frontend.
 *
 * Die Anwendung schreibt stattdessen einmal einen kurzen Adapter. Was dabei
 * NICHT in die Anwendung wandert, ist die Logik: welche Optionen es gibt, ob
 * ein Bestandswert ergaenzt werden muss, wie die `id` heisst — das entscheidet
 * das Paket und reicht das Ergebnis fertig herein.
 */

interface Gemeinsam {
    id: string;
    name: string;
    required: boolean;
    /** Ein Feld pro Maske darf den Fokus bekommen, nicht jedes. */
    autoFocus?: boolean;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
}

export interface TextEingabeProps extends Gemeinsam {
    /** Bereits aufgeloest: das Paket entscheidet, was `tel` oder `email` wird. */
    type: 'text' | 'email' | 'tel' | 'number' | 'date';
    wert: string;
    placeholder?: string;
    onChange: (wert: string) => void;
}

export interface MehrzeiligProps extends Gemeinsam {
    wert: string;
    placeholder?: string;
    onChange: (wert: string) => void;
}

export interface AuswahlProps extends Gemeinsam {
    wert: string;
    /**
     * Fertig aufbereitet — inklusive eines gespeicherten Wertes, der nicht mehr
     * zur Auswahl steht. Der Adapter muss die Liste nur noch zeichnen.
     */
    optionen: AnzeigeOption[];
    placeholder?: string;
    onChange: (wert: string) => void;
}

export interface OptionsgruppeProps extends Gemeinsam {
    wert: string;
    optionen: AnzeigeOption[];
    onChange: (wert: string) => void;
}

/**
 * Mehrere Antworten aus einer Liste.
 *
 * Der einzige Baustein, dessen Wert KEINE Zeichenkette ist. Warum, steht am
 * Typ `Feldwert`: eine zusammengefuegte Zeichenkette machte aus `contains`
 * einen Teilstring-Vergleich, und „Workshop A" traefe auch auf „Workshop AB".
 */
export interface MehrfachauswahlProps extends Gemeinsam {
    /** Die angekreuzten Eintraege. Leer heisst: keiner. */
    wert: string[];
    optionen: AnzeigeOption[];
    /**
     * Bekommt immer die VOLLSTAENDIGE neue Liste, nicht das umgeschaltete
     * Element. Der Adapter muss sich damit nicht merken, was vorher galt —
     * und zwei Adapter koennen nicht verschieden entscheiden, was ein
     * doppeltes Kreuz bedeutet.
     */
    onChange: (wert: string[]) => void;
}

/**
 * Eine Bewertung auf n Stufen.
 *
 * Der Wert ist die Stufe als Zeichenkette ('1'…'n'), nie eine Zahl — dieselbe
 * Regel wie beim Ankreuzfeld. Dass es Ziffern sind, ist trotzdem kein Zufall:
 * `gt`/`lt` rechnen darueber, und „Bewertung unter 3 → frag nach" ist die
 * haeufigste Regel einer Feedback-Umfrage.
 */
export interface SkalaProps extends Gemeinsam {
    wert: string;
    /** Die Stufen, immer '1' bis n. */
    stufen: string[];
    /** Beschriftung der Enden, falls gesetzt. */
    von?: string;
    bis?: string;
    /**
     * Wie die Stufen aussehen SOLLEN. Ein Wunsch, keine Zusage — wer keine
     * Sterne zeichnen kann, zeichnet Zahlen. Am gespeicherten Wert aendert
     * das nichts, und daran haengt die Auswertung.
     */
    darstellung: 'zahlen' | 'sterne' | 'smilies';
    onChange: (wert: string) => void;
}

export interface AnkreuzProps extends Gemeinsam {
    /**
     * Ankreuzfelder zeichnen ihre Beschriftung selbst, neben dem Kaestchen
     * statt darueber. Der Renderer laesst das aeussere Label dann weg.
     */
    label: string;
    angekreuzt: boolean;
    onChange: (angekreuzt: boolean) => void;
}

/**
 * Ein Baustein, den die ANWENDUNG zeichnet und nicht das Formular.
 *
 * Connect zeigt auf der Anmeldeseite mehr als die Formularfelder:
 * Terminauswahl und Workshops kommen aus der Veranstaltung, nicht aus
 * `form_config`. Im Baukasten fehlten sie deshalb — Aufbau und Vorschau
 * zeigten ein unvollstaendiges Bild der Seite, die am Ende entsteht.
 *
 * Sie sind ANZEIGE und sonst nichts: nicht bearbeitbar, nicht in einen Rahmen
 * zu legen, kein Ziel einer Bedingung, und sie landen NIE in `fields`. Sie
 * haben keinen Datenschluessel — `ticket_type_id` steht in einer eigenen
 * Spalte, `workshop_ids` in einer Beziehung. Ein Editor, der sie als Felder
 * anlegt, erzeugt Namen, unter denen nie eine Antwort liegt.
 */
export interface Systembaustein {
    id: string;
    titel: string;
    beschreibung?: string;
    /** Ob er ueber oder unter dem Formular steht. */
    position: 'vorher' | 'nachher';
}

export interface SystembausteinProps {
    baustein: Systembaustein;
}

/**
 * Eine Matrix: eine Zeile je Frage, dieselben Spalten fuer alle.
 *
 * Optional wie jeder Eintrag in `KomponentenSatz` — fehlt sie, zeichnet
 * `StandardMatrix`. Ein Pflicht-Eintrag waere eine Komponente, die JEDE
 * Anwendung nachreichen muesste, bevor der Typ bei ihr ankommt.
 */
export interface MatrixProps {
    id: string;
    title?: string;
    description?: string;
    spalten: string[];
    zeilen: MatrixZeile[];
}

export interface MatrixZeile {
    /** Der Datenschluessel dieser Zeile — ein gewoehnliches Feld. */
    name: string;
    id: string;
    label: string;
    required: boolean;
    wert: string;
    fehler?: string;
    hinweis?: string;
    /**
     * Die anzukreuzenden Werte dieser Zeile — fertig aufbereitet, inklusive
     * eines gespeicherten Wertes, der nicht mehr zur Auswahl steht.
     *
     * Sie koennen von `spalten` ABWEICHEN: Die Spalten sind Darstellung, die
     * Optionen des Feldes sind der Vertrag. Weicht eine Zeile ab, gehoert das
     * sichtbar gemacht und nicht stillschweigend geglaettet.
     */
    optionen: AnzeigeOption[];
    onChange: (wert: string) => void;
}

export interface GruppeProps {
    id: string;
    title?: string;
    description?: string;
    children: ReactNode;
}

export interface SchrittsteuerungProps {
    /** 1-basiert und nur ueber die SICHTBAREN Schritte gezaehlt. */
    schritt: number;
    anzahl: number;
    istErster: boolean;
    istLetzter: boolean;
    weiter: () => void;
    zurueck: () => void;
}

export interface BeschriftungProps {
    htmlFor: string;
    required: boolean;
    children: ReactNode;
}

export interface FehlerProps {
    id: string;
    meldung: string;
}

export interface HinweisProps {
    id: string;
    children: ReactNode;
}

/**
 * Der Satz Bausteine, den die Anwendung mitgibt.
 *
 * Jeder Eintrag ist optional; was fehlt, faellt auf die schlichte Umsetzung
 * aus `standard.tsx` zurueck. So laesst sich ein Formular in fuenf Minuten
 * anzeigen und danach Stueck fuer Stueck ans eigene Aussehen anpassen.
 */
export interface KomponentenSatz {
    Text?: ComponentType<TextEingabeProps>;
    Gruppe?: ComponentType<GruppeProps>;
    Systembaustein?: ComponentType<SystembausteinProps>;
    Schrittsteuerung?: ComponentType<SchrittsteuerungProps>;
    Mehrzeilig?: ComponentType<MehrzeiligProps>;
    Auswahl?: ComponentType<AuswahlProps>;
    Optionsgruppe?: ComponentType<OptionsgruppeProps>;
    Mehrfachauswahl?: ComponentType<MehrfachauswahlProps>;
    Skala?: ComponentType<SkalaProps>;
    Ankreuz?: ComponentType<AnkreuzProps>;
    Matrix?: ComponentType<MatrixProps>;
    Beschriftung?: ComponentType<BeschriftungProps>;
    Fehler?: ComponentType<FehlerProps>;
    Hinweis?: ComponentType<HinweisProps>;
}

/**
 * Ein Feldtyp, den nur diese Anwendung kennt.
 *
 * Der Weg fuer alles Fachliche: Connects `hotel_booking` gehoert hierher und
 * nicht in den Kern eines Pakets, das mehrere Produkte benutzen.
 */
export interface EigenerFeldTyp {
    komponente: ComponentType<EigenerFeldTypProps>;
    /**
     * Ob dieser Typ seine Beschriftung selbst zeichnet — dann laesst der
     * Renderer das aeussere Label weg, sonst stuende es doppelt.
     */
    labelImFeld?: boolean;
}

export interface EigenerFeldTypProps extends Gemeinsam {
    feld: FormularFeld;
    wert: Feldwert;
    onChange: (wert: Feldwert) => void;
}
