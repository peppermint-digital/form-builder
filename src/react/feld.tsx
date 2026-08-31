import {
    labelStehtImFeld,
    nutzbareOptionen,
    optionenMitBestandswert,
    type FormularFeld,
} from '../core';
import {
    StandardAnkreuz,
    StandardAuswahl,
    StandardBeschriftung,
    StandardFehler,
    StandardHinweis,
    StandardMehrzeilig,
    StandardOptionsgruppe,
    StandardText,
} from './standard';
import type { EigenerFeldTyp, KomponentenSatz } from './typen';

export interface FormularFeldEingabeProps {
    feld: FormularFeld;
    /**
     * Immer eine Zeichenkette, auch bei Ankreuzfeldern ('1' oder '0').
     *
     * Der Grund liegt in der Ablage: die Antworten liegen als JSON-Objekt in
     * einer Spalte, und ein echtes `true` haette dort neben lauter Texten
     * gestanden. Wer das aendert, muss alle Bestandsdaten mit aendern.
     */
    wert: string;
    onChange: (wert: string) => void;
    fehler?: string;
    komponenten?: KomponentenSatz;
    eigeneTypen?: Record<string, EigenerFeldTyp>;
    /**
     * Unterscheidet die `id`s, wenn eine Seite mehrere Masken zeigt. Ohne
     * Prefix zeigt eine Beschriftung auf das gleichnamige Feld der anderen —
     * und ein Klick darauf setzt den Fokus in die falsche Maske.
     */
    idPrefix?: string;
    autoFocus?: boolean;
    /**
     * Ob dieses Feld JETZT Pflicht ist.
     *
     * Ohne Bedingungen ist das `feld.required`. Mit ihnen kann es abweichen:
     * ein Feld, das nur bei einer bestimmten Antwort verlangt wird, traegt
     * sonst dauerhaft den Pflicht-Stern — und der Besucher sucht nach einem
     * Feld, das er gar nicht ausfuellen muss.
     */
    pflicht?: boolean;
}

/** Welchen HTML-Typ ein Feld bekommt. */
function eingabeTyp(typ: string): 'text' | 'email' | 'tel' | 'number' | 'date' {
    switch (typ) {
        case 'email':
            return 'email';
        case 'tel':
            return 'tel';
        case 'number':
            return 'number';
        case 'date':
            return 'date';
        default:
            // Ein unbekannter Typ wird zum Textfeld statt zu einer leeren
            // Stelle. Eine Definition aus einer neueren Fassung des Baukastens
            // faellt so nicht aus dem Formular heraus — sie sieht nur
            // schlichter aus.
            return 'text';
    }
}

export default function FormularFeldEingabe({
    feld,
    wert,
    onChange,
    fehler,
    komponenten = {},
    eigeneTypen = {},
    idPrefix = '',
    autoFocus = false,
    pflicht,
}: FormularFeldEingabeProps) {
    const istPflicht = pflicht ?? feld.required === true;
    const id = `${idPrefix}${feld.name}`;
    const fehlerId = `${id}__fehler`;
    const hinweisId = `${id}__hinweis`;

    const Text = komponenten.Text ?? StandardText;
    const Mehrzeilig = komponenten.Mehrzeilig ?? StandardMehrzeilig;
    const Auswahl = komponenten.Auswahl ?? StandardAuswahl;
    const Optionsgruppe = komponenten.Optionsgruppe ?? StandardOptionsgruppe;
    const Ankreuz = komponenten.Ankreuz ?? StandardAnkreuz;
    const Beschriftung = komponenten.Beschriftung ?? StandardBeschriftung;
    const Fehler = komponenten.Fehler ?? StandardFehler;
    const Hinweis = komponenten.Hinweis ?? StandardHinweis;

    const beschrieben =
        [fehler ? fehlerId : null, feld.hinweis ? hinweisId : null]
            .filter(Boolean)
            .join(' ') || undefined;

    const gemeinsam = {
        id,
        name: feld.name,
        required: istPflicht,
        ...(beschrieben ? { 'aria-describedby': beschrieben } : {}),
        ...(fehler ? { 'aria-invalid': true as const } : {}),
    };

    const eigener = eigeneTypen[feld.type];

    const labelImFeld = labelStehtImFeld(
        feld.type,
        Object.entries(eigeneTypen)
            .filter(([, def]) => def.labelImFeld)
            .map(([typ]) => typ),
    );

    const eingabe = () => {
        if (eigener) {
            const Eigen = eigener.komponente;

            return (
                <Eigen
                    {...gemeinsam}
                    feld={feld}
                    wert={wert}
                    onChange={onChange}
                />
            );
        }

        switch (feld.type) {
            case 'textarea':
                return (
                    <Mehrzeilig
                        {...gemeinsam}
                        autoFocus={autoFocus}
                        wert={wert}
                        onChange={onChange}
                        {...(feld.placeholder ? { placeholder: feld.placeholder } : {})}
                    />
                );

            case 'select':
                return (
                    <Auswahl
                        {...gemeinsam}
                        wert={wert}
                        optionen={optionenMitBestandswert(feld, wert)}
                        onChange={onChange}
                        {...(feld.placeholder ? { placeholder: feld.placeholder } : {})}
                    />
                );

            case 'radio':
                return (
                    <Optionsgruppe
                        {...gemeinsam}
                        wert={wert}
                        optionen={optionenMitBestandswert(feld, wert)}
                        onChange={onChange}
                    />
                );

            case 'checkbox':
                return (
                    <Ankreuz
                        {...gemeinsam}
                        label={feld.label}
                        angekreuzt={wert === '1'}
                        onChange={(an) => onChange(an ? '1' : '0')}
                    />
                );

            default:
                return (
                    <Text
                        {...gemeinsam}
                        autoFocus={autoFocus}
                        type={eingabeTyp(feld.type)}
                        wert={wert}
                        onChange={onChange}
                        {...(feld.placeholder ? { placeholder: feld.placeholder } : {})}
                    />
                );
        }
    };

    return (
        <div className="pm-fb-feld">
            {!labelImFeld && (
                <Beschriftung htmlFor={id} required={istPflicht}>
                    {feld.label}
                </Beschriftung>
            )}
            {eingabe()}
            {feld.hinweis && <Hinweis id={hinweisId}>{feld.hinweis}</Hinweis>}
            {fehler && <Fehler id={fehlerId} meldung={fehler} />}
        </div>
    );
}

export { nutzbareOptionen };
