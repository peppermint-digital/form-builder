import type {
    AnkreuzProps,
    AuswahlProps,
    BeschriftungProps,
    FehlerProps,
    HinweisProps,
    MehrzeiligProps,
    OptionsgruppeProps,
    TextEingabeProps,
} from './typen';

/**
 * Die schlichte Umsetzung — native Elemente, keine Bibliothek.
 *
 * Sie ist nicht als endgueltiges Aussehen gedacht, sondern als Startpunkt: ein
 * Formular laesst sich damit sofort anzeigen, und die Anwendung ersetzt danach
 * die Bausteine, an denen ihr etwas liegt. Die Klassen kommen aus
 * `styles.css`; wer Tailwind benutzt, gibt eigene Komponenten mit.
 */

export function StandardText({
    wert,
    onChange,
    type,
    ...rest
}: TextEingabeProps) {
    return (
        <input
            {...rest}
            type={type}
            className="pm-fb-eingabe"
            value={wert}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

export function StandardMehrzeilig({ wert, onChange, ...rest }: MehrzeiligProps) {
    return (
        <textarea
            {...rest}
            className="pm-fb-eingabe pm-fb-eingabe--mehrzeilig"
            rows={4}
            value={wert}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

export function StandardAuswahl({
    wert,
    optionen,
    placeholder,
    onChange,
    ...rest
}: AuswahlProps) {
    return (
        <select
            {...rest}
            className="pm-fb-eingabe"
            value={wert}
            onChange={(e) => onChange(e.target.value)}
        >
            {/*
                Eine leere Vorauswahl ist bei einem nativen <select> noetig:
                ohne sie zeigt das Feld die erste Option an, obwohl niemand sie
                gewaehlt hat — und ein Pflichtfeld gilt als ausgefuellt.
            */}
            <option value="">{placeholder || 'Bitte wählen'}</option>
            {optionen.map((option) => (
                <option key={option.wert} value={option.wert}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

export function StandardOptionsgruppe({
    id,
    name,
    wert,
    optionen,
    onChange,
    required,
    ...rest
}: OptionsgruppeProps) {
    return (
        <div className="pm-fb-optionsgruppe" role="radiogroup" {...rest}>
            {optionen.map((option) => {
                // Die id traegt den Feldschluessel, damit zwei Masken auf
                // derselben Seite sich nicht gegenseitig die Beschriftungen
                // wegnehmen.
                const optionId = `${id}_${option.wert}`;

                return (
                    <div key={option.wert} className="pm-fb-option">
                        <input
                            type="radio"
                            id={optionId}
                            // Gruppiert wird ueber die id, nicht ueber den
                            // Feldnamen: sonst waeren zwei Masken auf einer
                            // Seite dieselbe Gruppe, und ein Klick links
                            // loescht die Auswahl rechts.
                            name={id}
                            value={option.wert}
                            checked={wert === option.wert}
                            required={required}
                            onChange={(e) => onChange(e.target.value)}
                        />
                        <label htmlFor={optionId}>{option.label}</label>
                    </div>
                );
            })}
        </div>
    );
}

export function StandardAnkreuz({
    label,
    angekreuzt,
    onChange,
    id,
    ...rest
}: AnkreuzProps) {
    return (
        <div className="pm-fb-option">
            <input
                {...rest}
                id={id}
                type="checkbox"
                checked={angekreuzt}
                onChange={(e) => onChange(e.target.checked)}
            />
            <label htmlFor={id}>{label}</label>
        </div>
    );
}

export function StandardBeschriftung({
    htmlFor,
    required,
    children,
}: BeschriftungProps) {
    return (
        <label className="pm-fb-beschriftung" htmlFor={htmlFor}>
            {children}
            {required && (
                <span className="pm-fb-pflicht" aria-hidden="true">
                    {' '}
                    *
                </span>
            )}
        </label>
    );
}

export function StandardFehler({ id, meldung }: FehlerProps) {
    return (
        <p className="pm-fb-fehler" id={id}>
            {meldung}
        </p>
    );
}

export function StandardHinweis({ id, children }: HinweisProps) {
    return (
        <p className="pm-fb-hinweis" id={id}>
            {children}
        </p>
    );
}
