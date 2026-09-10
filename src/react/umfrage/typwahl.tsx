import type { FeldTypAuswahl } from '../editor/feldmaske';

/**
 * Was ein Fragetyp im Formular ergibt — als Beispiel, nicht als Beschreibung.
 *
 * Der Unterschied ist der ganze Punkt dieser Ansicht: „Auswahlknöpfe" sagt,
 * WIE es aussieht. „Genau eine Antwort aus einer Liste — Ja / Nein /
 * Vielleicht" sagt, WOFÜR man es nimmt. Wer eine Umfrage baut, sucht das
 * Zweite.
 */
export interface Typvorschlag {
    wert: string;
    label: string;
    /** Ein Satz, der die Frage beantwortet „wofür nehme ich das?". */
    wofuer: string;
    /** Ein Beispiel, wie die Antwort aussieht. */
    beispiel: string;
    /** Ob er in der kurzen Liste steht oder erst unter „Mehr". */
    haeufig: boolean;
}

/**
 * Die Reihenfolge ist nicht alphabetisch und nicht technisch, sondern nach
 * Häufigkeit in einer Umfrage. Oben steht, was jemand beim ersten Anlegen
 * sucht.
 */
export const TYPVORSCHLAEGE: Typvorschlag[] = [
    {
        wert: 'radio',
        label: 'Eine Antwort',
        wofuer: 'Genau eine Möglichkeit aus einer Liste.',
        beispiel: '○ Ja   ○ Nein   ○ Vielleicht',
        haeufig: true,
    },
    {
        wert: 'checkboxes',
        label: 'Mehrere Antworten',
        wofuer: 'Beliebig viele Möglichkeiten ankreuzen.',
        beispiel: '☑ Workshop A   ☑ Workshop B   ☐ Workshop C',
        haeufig: true,
    },
    {
        wert: 'scale',
        label: 'Bewertung',
        wofuer: 'Eine Note auf einer Skala — Zahlen, Sterne oder Smilies.',
        beispiel: '★ ★ ★ ★ ☆',
        haeufig: true,
    },
    {
        wert: 'textarea',
        label: 'Freitext',
        wofuer: 'Was in keine Liste passt.',
        beispiel: '„Der Raum war zu warm."',
        haeufig: true,
    },
    {
        wert: 'nps',
        label: 'Weiterempfehlung (NPS)',
        wofuer: 'Die Standardfrage nach der Weiterempfehlung, 0 bis 10.',
        beispiel: '0 1 2 3 4 5 6 7 8 9 10',
        haeufig: true,
    },
    {
        wert: 'select',
        label: 'Auswahlliste',
        wofuer: 'Wie „Eine Antwort", aber zusammengeklappt — für lange Listen.',
        beispiel: '[ Bitte wählen ▾ ]',
        haeufig: false,
    },
    {
        wert: 'text',
        label: 'Kurzer Text',
        wofuer: 'Eine Zeile, etwa ein Name.',
        beispiel: '[ Maria Meier ]',
        haeufig: false,
    },
    {
        wert: 'checkbox',
        label: 'Zustimmung',
        wofuer: 'Ein einzelnes Kästchen zum Ankreuzen.',
        beispiel: '☑ Ich komme wieder',
        haeufig: false,
    },
    {
        wert: 'email',
        label: 'E-Mail',
        wofuer: 'Eine Adresse, auf Gültigkeit geprüft.',
        beispiel: '[ maria@example.de ]',
        haeufig: false,
    },
    {
        wert: 'tel',
        label: 'Telefon',
        wofuer: 'Eine Rufnummer.',
        beispiel: '[ 0170 1234567 ]',
        haeufig: false,
    },
    {
        wert: 'number',
        label: 'Zahl',
        wofuer: 'Eine Menge oder ein Betrag.',
        beispiel: '[ 42 ]',
        haeufig: false,
    },
    {
        wert: 'date',
        label: 'Datum',
        wofuer: 'Ein Tag aus dem Kalender.',
        beispiel: '[ 24.12.2026 ]',
        haeufig: false,
    },
];

/**
 * Die Vorschläge, ergänzt um die produkteigenen Typen.
 *
 * Ein eigener Typ ohne Beispieltext bekommt keinen erfundenen — er steht
 * unter „Mehr" mit seinem Namen. Eine ausgedachte Beschreibung wäre schlimmer
 * als keine: Sie sähe aus wie eine Zusage.
 */
export function vorschlaege(zusatzTypen: FeldTypAuswahl[] = []): Typvorschlag[] {
    const bekannt = new Set(TYPVORSCHLAEGE.map((v) => v.wert));

    return [
        ...TYPVORSCHLAEGE,
        ...zusatzTypen
            .filter((typ) => !bekannt.has(typ.wert))
            .map((typ) => ({
                wert: typ.wert,
                label: typ.label,
                wofuer: '',
                beispiel: '',
                haeufig: false,
            })),
    ];
}
