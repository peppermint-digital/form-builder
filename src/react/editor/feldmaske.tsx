import { STUFEN_MAX, STUFEN_MIN, STUFEN_VORGABE } from '../../core';
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
    { wert: 'radio', label: 'Auswahlknöpfe (eine Antwort)' },
    { wert: 'checkboxes', label: 'Mehrfachauswahl (mehrere Antworten)' },
    { wert: 'scale', label: 'Bewertungsskala' },
    { wert: 'nps', label: 'Weiterempfehlung (NPS, 0–10)' },
    { wert: 'checkbox', label: 'Ankreuzfeld (Zustimmung)' },
];

const SKALA_DARSTELLUNGEN: Array<{ wert: string; label: string }> = [
    { wert: 'zahlen', label: 'Zahlen' },
    { wert: 'sterne', label: 'Sterne' },
    { wert: 'smilies', label: 'Smilies' },
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
    /**
     * Woraus sich ein Feld vorbelegen laesst. Kommt vom Produkt, weil nur es
     * weiss, welche Daten es hat.
     *
     * Leer oder nicht gesetzt heisst: Die Auswahl erscheint gar nicht. Ein
     * leeres Auswahlfeld, das nichts anzubieten hat, ist schlimmer als keines
     * — es verspricht etwas.
     */
    quellen?: QuellenAuswahl[];
    /** Zusaetzliche Ankreuzfelder vom Produkt. */
    feldSchalter?: FeldSchalter[];
}

/**
 * Ein zusaetzliches Ankreuzfeld an der Feldmaske — vom Produkt beigesteuert.
 *
 * Warum allgemein und nicht als fertige Einstellung: Das Paket weiss nicht,
 * was eine Rechnung ist, und soll es nicht wissen. Dieselbe Arbeitsteilung wie
 * bei {@link FormularEditorProps.gesperrteFelder} — das Paket zeigt den
 * Schalter, die Bedeutung gehoert dem Produkt.
 *
 * Der Wert landet unter `schluessel` direkt am Feld und wandert damit in die
 * Definition, die das Produkt speichert.
 */
export interface FeldSchalter {
    /** Der Schluessel am Feld — z. B. `auf_rechnung`. */
    schluessel: string;
    /** Was neben dem Ankreuzfeld steht. */
    label: string;
    /**
     * Eine kurze Erklaerung — als Tooltip beim Darueberfahren, nicht als Text
     * unter dem Kaestchen.
     *
     * Die Feldmaske ist schmal; ein Absatz unter jedem Ankreuzfeld schiebt die
     * eigentlichen Einstellungen aus dem Blick. Wer den Schalter kennt, will
     * ihn anklicken und nicht lesen.
     */
    hinweis?: string;
    /**
     * Was gilt, solange das Feld den Schluessel nicht traegt. Vorgabe `false`.
     *
     * `true` ist fuer Faelle, in denen „nichts eingetragen" schon immer „ja"
     * bedeutet hat — ein Bestandsfeld soll dann nicht stillschweigend das
     * Gegenteil anzeigen.
     */
    vorgabe?: boolean;
    /**
     * Nur bei Feldern mit diesen Namen anbieten. Fehlt die Angabe, erscheint
     * der Schalter bei JEDEM Feld.
     *
     * Verglichen wird ohne Ruecksicht auf Gross-/Kleinschreibung: Bestands-
     * formulare nennen ihre Felder wie das Label („Name", „Unternehmen"), und
     * ein Schalter, der dort nicht erscheint, waere genau fuer die Formulare
     * weg, um die es geht.
     */
    nurFuer?: string[];
}

export interface QuellenAuswahl {
    /** Der Pfad, der gespeichert wird — z. B. `order.delivery_date`. */
    wert: string;
    /** Was im Auswahlfeld steht — z. B. „Auftrag: Liefertermin". */
    label: string;
}

export default function Feldmaske({
    feld,
    onChange,
    sperrgrund,
    zusatzTypen = [],
    quellen = [],
    feldSchalter = [],
}: Props) {
    const typen = [...STANDARD_TYPEN, ...zusatzTypen];
    const hatOptionen =
        feld.type === 'select' || feld.type === 'radio' || feld.type === 'checkboxes';
    const istSkala = feld.type === 'scale';
    const istNps = feld.type === 'nps';

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

            {istSkala && (
                <>
                    <div className="pm-fb-maske__reihe">
                        <label className="pm-fb-maske__feld">
                            <span>Stufen</span>
                            <input
                                className="pm-fb-eingabe"
                                type="number"
                                min={STUFEN_MIN}
                                max={STUFEN_MAX}
                                value={feld.stufen ?? STUFEN_VORGABE}
                                /*
                                 * Hier wird bewusst NICHT begrenzt, waehrend
                                 * getippt wird: Wer „11" tippen will, kommt
                                 * an der „1" vorbei, und ein Feld, das die
                                 * Eingabe unter dem Cursor korrigiert, laesst
                                 * sich nicht bedienen. Die Schranken sitzen
                                 * beim Lesen (`stufenwerte`) und auf der
                                 * Serverseite.
                                 */
                                onChange={(e) =>
                                    onChange({ stufen: Number(e.target.value) })
                                }
                            />
                            <small className="pm-fb-hinweis">
                                {STUFEN_MIN} bis {STUFEN_MAX}. Für einen NPS sind
                                es 11 (0 bis 10).
                            </small>
                        </label>

                        <label className="pm-fb-maske__feld">
                            <span>Darstellung</span>
                            <select
                                className="pm-fb-eingabe"
                                value={feld.skalaDarstellung ?? 'zahlen'}
                                onChange={(e) =>
                                    onChange({
                                        skalaDarstellung: e.target
                                            .value as FormularFeld['skalaDarstellung'],
                                    })
                                }
                            >
                                {SKALA_DARSTELLUNGEN.map((art) => (
                                    <option key={art.wert} value={art.wert}>
                                        {art.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="pm-fb-maske__reihe">
                        <label className="pm-fb-maske__feld">
                            <span>Beschriftung links</span>
                            <input
                                className="pm-fb-eingabe"
                                value={feld.skalaVon ?? ''}
                                placeholder="gar nicht zufrieden"
                                onChange={(e) => onChange({ skalaVon: e.target.value })}
                            />
                        </label>

                        <label className="pm-fb-maske__feld">
                            <span>Beschriftung rechts</span>
                            <input
                                className="pm-fb-eingabe"
                                value={feld.skalaBis ?? ''}
                                placeholder="sehr zufrieden"
                                onChange={(e) => onChange({ skalaBis: e.target.value })}
                            />
                        </label>
                    </div>
                </>
            )}

            {istNps && (
                <p className="pm-fb-hinweis">
                    Feste Skala von 0 bis 10 — sie lässt sich nicht ändern.
                    Genau daran hängt die Auswertung: Wer 9 oder 10 gibt, zählt
                    als Promotor, wer 0 bis 6 gibt, als Detraktor. Der Wert
                    eines NPS liegt darin, dass alle dieselbe Skala benutzen.
                </p>
            )}

            {quellen.length > 0 && (
                <label className="pm-fb-maske__feld">
                    <span>Vorbelegen aus</span>
                    <select
                        className="pm-fb-eingabe"
                        value={feld.quelle ?? ''}
                        onChange={(e) => onChange({ quelle: e.target.value })}
                    >
                        {/* Der leere Eintrag ist der Weg zurueck. Ohne ihn liesse
                            sich eine einmal gesetzte Quelle nicht mehr loesen. */}
                        <option value="">— keine —</option>
                        {quellen.map((quelle) => (
                            <option key={quelle.wert} value={quelle.wert}>
                                {quelle.label}
                            </option>
                        ))}
                    </select>
                    <small className="pm-fb-hinweis">
                        Der Wert steht beim Öffnen schon da und lässt sich überschreiben. Gespeichert wird, was beim
                        Ausfüllen drinstand — nicht, was später in der Quelle steht.
                    </small>
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

            {feldSchalter
                .filter((schalter) => passt(schalter, feld.name))
                .map((schalter) => (
                    <label
                        className="pm-fb-option"
                        key={schalter.schluessel}
                        {...(schalter.hinweis !== undefined
                            ? { title: schalter.hinweis }
                            : {})}
                    >
                        <input
                            type="checkbox"
                            checked={gesetzt(feld, schalter)}
                            onChange={(e) =>
                                onChange({
                                    [schalter.schluessel]: e.target.checked,
                                } as Partial<FormularFeld>)
                            }
                        />
                        <span>{schalter.label}</span>
                    </label>
                ))}
        </div>
    );
}

/** Gilt dieser Schalter fuer das Feld mit diesem Namen? */
function passt(schalter: FeldSchalter, name: string): boolean {
    if (schalter.nurFuer === undefined || schalter.nurFuer.length === 0) {
        return true;
    }

    return schalter.nurFuer.some(
        (kandidat) => kandidat.toLowerCase() === (name ?? '').toLowerCase(),
    );
}

/**
 * Der Zustand des Schalters an diesem Feld.
 *
 * Traegt das Feld den Schluessel nicht, gilt die Vorgabe des Schalters — nicht
 * `false`. Ein Bestandsfeld hat den Schalter nie gesehen; ihn als „nein" zu
 * zeigen behauptete eine Entscheidung, die niemand getroffen hat.
 */
function gesetzt(feld: FormularFeld, schalter: FeldSchalter): boolean {
    const wert = (feld as unknown as Record<string, unknown>)[schalter.schluessel];

    return wert === undefined ? schalter.vorgabe === true : wert === true;
}
