import { useState } from 'react';

interface Props {
    optionen: string[];
    onChange: (optionen: string[]) => void;
}

/**
 * Die Antwortmöglichkeiten einer Frage — als einzelne Zeilen.
 *
 * Der Listen-Editor führt sie als Textfeld mit einer Option je Zeile. Das ist
 * für den, der eine Liste aus Excel hat, der schnellste Weg — und für den, der
 * eine einzelne Option umbenennen oder verschieben will, der umständlichste.
 *
 * Deshalb BEIDES: Zeilen als Normalfall, das Textfeld als „Mehrere auf einmal".
 * SurveyMonkey nennt das „Bulk Answers", und es ist die eine Sache an deren
 * Optionsverwaltung, die man übernehmen sollte.
 */
export default function Optionsliste({ optionen, onChange }: Props) {
    const [massenModus, setMassenModus] = useState(false);
    const [rohtext, setRohtext] = useState('');

    const setzen = (index: number, wert: string) =>
        onChange(optionen.map((alt, i) => (i === index ? wert : alt)));

    const entfernen = (index: number) =>
        onChange(optionen.filter((_, i) => i !== index));

    const tauschen = (index: number, ziel: number) => {
        if (ziel < 0 || ziel >= optionen.length) {
            return;
        }

        const neu = [...optionen];
        [neu[index], neu[ziel]] = [neu[ziel]!, neu[index]!];
        onChange(neu);
    };

    if (massenModus) {
        return (
            <div className="pm-fb-optionen">
                <label className="pm-fb-maske__feld">
                    <span>Mehrere auf einmal — eine je Zeile</span>
                    <textarea
                        className="pm-fb-eingabe pm-fb-eingabe--mehrzeilig"
                        rows={6}
                        autoFocus
                        value={rohtext}
                        onChange={(e) => setRohtext(e.target.value)}
                    />
                </label>

                <div className="pm-fb-optionen__leiste">
                    <button
                        type="button"
                        className="pm-fb-knopf"
                        onClick={() => {
                            /*
                             * Ersetzen und nicht anhängen. Wer den Kasten
                             * öffnet, sieht die bestehenden Optionen darin —
                             * anzuhängen würde sie verdoppeln, und das fällt
                             * erst im Formular auf.
                             */
                            onChange(rohtext.split('\n'));
                            setMassenModus(false);
                        }}
                    >
                        Übernehmen
                    </button>
                    <button
                        type="button"
                        className="pm-fb-knopf pm-fb-knopf--still"
                        onClick={() => setMassenModus(false)}
                    >
                        Abbrechen
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pm-fb-optionen">
            {optionen.map((option, index) => (
                <div key={index} className="pm-fb-optionen__zeile">
                    <input
                        className="pm-fb-eingabe"
                        value={option}
                        placeholder={`Antwort ${index + 1}`}
                        onChange={(e) => setzen(index, e.target.value)}
                    />
                    <button
                        type="button"
                        className="pm-fb-knopf pm-fb-knopf--still"
                        aria-label={`Antwort ${index + 1} nach oben`}
                        disabled={index === 0}
                        onClick={() => tauschen(index, index - 1)}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        className="pm-fb-knopf pm-fb-knopf--still"
                        aria-label={`Antwort ${index + 1} nach unten`}
                        disabled={index === optionen.length - 1}
                        onClick={() => tauschen(index, index + 1)}
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        className="pm-fb-knopf pm-fb-knopf--still"
                        aria-label={`Antwort ${index + 1} entfernen`}
                        onClick={() => entfernen(index)}
                    >
                        ✕
                    </button>
                </div>
            ))}

            <div className="pm-fb-optionen__leiste">
                <button
                    type="button"
                    className="pm-fb-knopf"
                    onClick={() => onChange([...optionen, ''])}
                >
                    + Antwort
                </button>
                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--still"
                    onClick={() => {
                        setRohtext(optionen.join('\n'));
                        setMassenModus(true);
                    }}
                >
                    Mehrere auf einmal
                </button>
            </div>
        </div>
    );
}
