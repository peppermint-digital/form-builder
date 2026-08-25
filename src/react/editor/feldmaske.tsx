import type { FormularFeld, StandardFeldTyp } from '../../core';

export interface FeldTypAuswahl {
    wert: string;
    label: string;
}

/** Die Typen, die jeder Baukasten anbietet. */
export const STANDARD_TYPEN: Array<{ wert: StandardFeldTyp; label: string }> = [
    { wert: 'text', label: 'Text (einzeilig)' },
    { wert: 'textarea', label: 'Text (mehrzeilig)' },
    { wert: 'email', label: 'E-Mail' },
    { wert: 'tel', label: 'Telefon' },
    { wert: 'number', label: 'Zahl' },
    { wert: 'date', label: 'Datum' },
    { wert: 'select', label: 'Auswahlliste' },
    { wert: 'radio', label: 'Auswahlknöpfe' },
    { wert: 'checkbox', label: 'Ankreuzfeld' },
];

interface Props {
    feld: FormularFeld;
    onChange: (aenderungen: Partial<FormularFeld>) => void;
    /**
     * Gesetzt, wenn dieses Feld gesperrt ist — der Text ist die Begründung, die
     * der Nutzer lesen soll. Sie kommt vom Produkt: Der eine sperrt Felder,
     * unter denen bereits Antworten liegen, der andere solche, die er für seine
     * Rechnungen braucht. Der Schlüssel ist dann fest, die Beschriftung bleibt
     * frei — sie ist das Einzige an einem gesperrten Feld, das dem Nutzer
     * gehört.
     */
    sperrgrund?: string;
    /** Zusaetzliche, produkteigene Feldtypen. */
    zusatzTypen?: FeldTypAuswahl[];
}

export default function Feldmaske({
    feld,
    onChange,
    sperrgrund,
    zusatzTypen = [],
}: Props) {
    const typen = [...STANDARD_TYPEN, ...zusatzTypen];
    const hatOptionen = feld.type === 'select' || feld.type === 'radio';

    return (
        <div className="pm-fb-maske">
            <div className="pm-fb-maske__reihe">
                <label className="pm-fb-maske__feld">
                    <span>Beschriftung</span>
                    <input
                        className="pm-fb-eingabe"
                        value={feld.label}
                        onChange={(e) => onChange({ label: e.target.value })}
                    />
                </label>

                <label className="pm-fb-maske__feld">
                    <span>Feldname</span>
                    <input
                        className="pm-fb-eingabe"
                        value={feld.name}
                        disabled={sperrgrund !== undefined}
                        onChange={(e) => onChange({ name: e.target.value })}
                    />
                    {sperrgrund !== undefined && (
                        <small className="pm-fb-hinweis">{sperrgrund}</small>
                    )}
                </label>
            </div>

            <div className="pm-fb-maske__reihe">
                <label className="pm-fb-maske__feld">
                    <span>Art</span>
                    <select
                        className="pm-fb-eingabe"
                        value={feld.type}
                        onChange={(e) => onChange({ type: e.target.value })}
                    >
                        {typen.map((typ) => (
                            <option key={typ.wert} value={typ.wert}>
                                {typ.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="pm-fb-maske__feld">
                    <span>Platzhalter</span>
                    <input
                        className="pm-fb-eingabe"
                        value={feld.placeholder ?? ''}
                        onChange={(e) => onChange({ placeholder: e.target.value })}
                    />
                </label>
            </div>

            {hatOptionen && (
                <label className="pm-fb-maske__feld">
                    <span>Optionen — eine je Zeile</span>
                    <textarea
                        className="pm-fb-eingabe pm-fb-eingabe--mehrzeilig"
                        rows={4}
                        value={(feld.options ?? []).join('\n')}
                        /*
                         * Hier wird bewusst NICHT bereinigt: wer gerade eine
                         * neue Zeile angefangen hat, soll sie nicht unter dem
                         * Cursor wegräumt bekommen. Leere Einträge fallen beim
                         * Speichern weg (definitionBereinigen).
                         */
                        onChange={(e) => onChange({ options: e.target.value.split('\n') })}
                    />
                </label>
            )}

            <label className="pm-fb-maske__feld">
                <span>Hinweis unter dem Feld</span>
                <input
                    className="pm-fb-eingabe"
                    value={feld.hinweis ?? ''}
                    onChange={(e) => onChange({ hinweis: e.target.value })}
                />
            </label>

            <label className="pm-fb-option">
                <input
                    type="checkbox"
                    checked={feld.required === true}
                    onChange={(e) => onChange({ required: e.target.checked })}
                />
                <span>Pflichtfeld</span>
            </label>
        </div>
    );
}
