import type {
    AnkreuzProps,
    AuswahlProps,
    MatrixProps,
    MehrfachauswahlProps,
    SkalaProps,
    BeschriftungProps,
    FehlerProps,
    GruppeProps,
    HinweisProps,
    MehrzeiligProps,
    OptionsgruppeProps,
    SchrittsteuerungProps,
    SystembausteinProps,
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

/**
 * Ein Rahmen um mehrere Felder.
 *
 * Ein `fieldset` mit `legend` und nicht ein `div` mit Ueberschrift: fuer einen
 * Screenreader ist das der Unterschied zwischen „hier stehen ein paar Felder"
 * und „diese Felder gehoeren zusammen, und zwar unter diesem Titel".
 */
export function StandardGruppe({ title, description, children }: GruppeProps) {
    return (
        <fieldset className="pm-fb-gruppe">
            {title && <legend className="pm-fb-gruppe__titel">{title}</legend>}
            {description && <p className="pm-fb-gruppe__text">{description}</p>}
            {children}
        </fieldset>
    );
}

/**
 * Zurueck, Weiter und der Zaehler dazwischen.
 *
 * `type="button"` an beiden Schaltflaechen ist kein Detail: in einem
 * `<form>` ist ein Knopf ohne Typ ein Absende-Knopf. „Weiter" wuerde das
 * halbe Formular abschicken.
 */
export function StandardSchrittsteuerung({
    schritt,
    anzahl,
    istErster,
    istLetzter,
    weiter,
    zurueck,
}: SchrittsteuerungProps) {
    return (
        <div className="pm-fb-steuerung">
            <button
                type="button"
                className="pm-fb-knopf"
                onClick={zurueck}
                disabled={istErster}
            >
                Zurück
            </button>

            <span className="pm-fb-steuerung__zaehler">
                Schritt {schritt} von {anzahl}
            </span>

            {!istLetzter && (
                <button type="button" className="pm-fb-knopf" onClick={weiter}>
                    Weiter
                </button>
            )}
        </div>
    );
}

/**
 * Ein Baustein, den die Anwendung zeichnet.
 *
 * Bewusst als ruhiger, gestrichelter Kasten: er gehoert zum Formular, ist
 * aber nichts, was hier eingestellt wird. Wer ihn fuer ein Feld haelt, sucht
 * vergeblich nach seinen Einstellungen.
 */
export function StandardSystembaustein({ baustein }: SystembausteinProps) {
    return (
        <div className="pm-fb-system">
            <div className="pm-fb-system__titel">{baustein.titel}</div>
            {baustein.beschreibung && (
                <p className="pm-fb-system__text">{baustein.beschreibung}</p>
            )}
        </div>
    );
}

/**
 * Mehrere Antworten aus einer Liste.
 *
 * Der Baustein reicht immer die VOLLSTAENDIGE neue Liste heraus, nicht das
 * umgeschaltete Element. Sonst muesste jeder Adapter selbst entscheiden, was
 * ein zweites Kreuz auf derselben Option bedeutet — und zwei Adapter
 * entschieden es verschieden.
 *
 * Die Reihenfolge folgt den OPTIONEN, nicht der Reihenfolge des Anklickens.
 * Damit sieht eine gespeicherte Antwort immer gleich aus, egal in welcher
 * Folge jemand geklickt hat; sonst waeren `['A','B']` und `['B','A']` zwei
 * verschiedene Antworten auf dieselbe Frage.
 */
export function StandardMehrfachauswahl({
    id,
    wert,
    optionen,
    onChange,
    required,
    ...rest
}: MehrfachauswahlProps) {
    const umschalten = (option: string) => {
        const gewaehlt = new Set(wert);

        if (gewaehlt.has(option)) {
            gewaehlt.delete(option);
        } else {
            gewaehlt.add(option);
        }

        onChange(optionen.map((o) => o.wert).filter((o) => gewaehlt.has(o)));
    };

    return (
        <div className="pm-fb-mehrfachauswahl" role="group" aria-labelledby={`${id}__label`}>
            {optionen.map((option) => (
                <label
                    key={option.wert}
                    className="pm-fb-option"
                    htmlFor={`${id}_${option.wert}`}
                >
                    <input
                        type="checkbox"
                        id={`${id}_${option.wert}`}
                        name={rest.name}
                        value={option.wert}
                        checked={wert.includes(option.wert)}
                        onChange={() => umschalten(option.wert)}
                    />
                    <span>{option.label}</span>
                </label>
            ))}
        </div>
    );
}

/**
 * Eine Bewertung auf n Stufen.
 *
 * Native Auswahlknoepfe und keine Sterne: Sterne sind eine Frage des
 * Aussehens, und dieses Paket bringt bewusst keine Bibliothek mit. Der Wunsch
 * (`darstellung`) wird trotzdem durchgereicht — eine Anwendung, die Sterne
 * zeichnen will, ersetzt den Baustein und weiss dann, was gemeint war.
 */
export function StandardSkala({
    id,
    wert,
    stufen,
    von,
    bis,
    onChange,
    ...rest
}: SkalaProps) {
    return (
        <div className="pm-fb-skala">
            {von && <span className="pm-fb-skala__ende">{von}</span>}

            <div className="pm-fb-skala__stufen" role="radiogroup">
                {stufen.map((stufe) => (
                    <label
                        key={stufe}
                        className="pm-fb-skala__stufe"
                        htmlFor={`${id}_${stufe}`}
                    >
                        <input
                            type="radio"
                            id={`${id}_${stufe}`}
                            // Ueber die id gruppiert und nicht ueber den
                            // Feldnamen: sonst waeren zwei Masken auf einer
                            // Seite dieselbe Gruppe, und ein Klick links
                            // loescht rechts.
                            name={id}
                            value={stufe}
                            checked={wert === stufe}
                            required={rest.required}
                            onChange={() => onChange(stufe)}
                        />
                        <span>{stufe}</span>
                    </label>
                ))}
            </div>

            {bis && <span className="pm-fb-skala__ende">{bis}</span>}
        </div>
    );
}

/**
 * Eine Matrix als Tabelle — eine Zeile je Frage, dieselben Spalten fuer alle.
 *
 * Auswahlknoepfe und keine Schaltflaechen: Damit funktionieren Tastatur und
 * Vorlesesoftware ohne eigenes Zutun, und ein Pflichtfeld bleibt eines.
 *
 * Die Spaltenueberschrift steht ZUSAETZLICH in jedem `aria-label` der Zellen.
 * Eine Tabelle vorgelesen zu bekommen heisst sonst: „Auswahlknopf, Auswahlknopf,
 * Auswahlknopf" — die Zuordnung zur Spalte macht der Blick, und den gibt es
 * dort nicht.
 */
export function StandardMatrix({
    id,
    title,
    description,
    spalten,
    zeilen,
}: MatrixProps) {
    return (
        <fieldset className="pm-fb-matrix" id={id}>
            {title && <legend className="pm-fb-matrix__titel">{title}</legend>}
            {description && <p className="pm-fb-hinweis">{description}</p>}

            <table className="pm-fb-matrix__tabelle">
                <thead>
                    <tr>
                        <td />
                        {spalten.map((spalte) => (
                            <th key={spalte} scope="col">
                                {spalte}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {zeilen.map((zeile) => (
                        <tr key={zeile.name}>
                            <th scope="row" className="pm-fb-matrix__zeile">
                                {zeile.label}
                                {zeile.required && <span aria-hidden="true"> *</span>}
                                {zeile.hinweis && (
                                    <span className="pm-fb-hinweis">{zeile.hinweis}</span>
                                )}
                            </th>

                            {spalten.map((spalte) => {
                                // Eine Zeile, die diese Spalte gar nicht
                                // anbietet, bekommt eine LEERE Zelle statt
                                // eines Knopfes, der nichts speichern darf.
                                const option = zeile.optionen.find(
                                    (o) => o.wert === spalte,
                                );

                                if (!option) {
                                    return <td key={spalte} aria-hidden="true" />;
                                }

                                return (
                                    <td key={spalte}>
                                        <input
                                            type="radio"
                                            name={zeile.id}
                                            value={option.wert}
                                            checked={zeile.wert === option.wert}
                                            required={zeile.required}
                                            aria-label={`${zeile.label}: ${option.label}`}
                                            onChange={() => zeile.onChange(option.wert)}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/*
                Werte, die eine Zeile trägt und die Matrix nicht als Spalte
                kennt. Sie STILL wegzulassen hiesse, eine gespeicherte Antwort
                unsichtbar zu machen — und das naechste Speichern wuerfe sie weg.
            */}
            {zeilen.map((zeile) => {
                const fremde = zeile.optionen.filter(
                    (o) => !spalten.includes(o.wert),
                );

                if (fremde.length === 0) {
                    return null;
                }

                return (
                    <p key={zeile.name} className="pm-fb-hinweis">
                        {zeile.label}: {fremde.map((o) => o.label).join(', ')}
                    </p>
                );
            })}

            {zeilen
                .filter((zeile) => zeile.fehler)
                .map((zeile) => (
                    <p key={zeile.name} className="pm-fb-fehler">
                        {zeile.label}: {zeile.fehler}
                    </p>
                ))}
        </fieldset>
    );
}
