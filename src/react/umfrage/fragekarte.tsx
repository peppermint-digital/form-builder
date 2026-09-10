import { useState } from 'react';

import { regelnFuerZiel, STUFEN_MAX, STUFEN_MIN, STUFEN_VORGABE } from '../../core';
import type { FormularDefinition, FormularFeld } from '../../core';
import Bedingungen from './bedingungen';
import Optionsliste from './optionsliste';
import type { Typvorschlag } from './typwahl';

export interface Woerter {
    /** „Frage" in einer Umfrage, „Feld" in einem Anmeldeformular. */
    einzahl: string;
    mehrzahl: string;
}

interface Props {
    /** Die ganze Definition — die Bedingungen leben dort, nicht am Feld. */
    definition: FormularDefinition;
    feld: FormularFeld;
    /** Alle Fragen VOR dieser. Nur die koennen ueber sie entscheiden. */
    vorgaenger: FormularFeld[];
    onDefinition: (definition: FormularDefinition) => void;
    nummer: number;
    anzahl: number;
    woerter: Woerter;
    typen: Typvorschlag[];
    /** Gesetzt, wenn dieses Feld gesperrt ist — der Text ist die Begründung. */
    sperrgrund?: string;
    onChange: (aenderungen: Partial<FormularFeld>) => void;
    onDuplizieren: () => void;
    onEntfernen: () => void;
    onHoch: () => void;
    onRunter: () => void;
}

const MIT_OPTIONEN = ['select', 'radio', 'checkboxes'];

/**
 * Eine Frage als Karte.
 *
 * Der Unterschied zur `Feldmaske` des Listen-Editors ist keine Optik, sondern
 * eine Rangfolge: Dort stehen Beschriftung und **Feldname** gleichberechtigt
 * nebeneinander. Der Feldname ist aber der Datenschlüssel, unter dem die
 * Antworten liegen — jemand, der eine Feedback-Umfrage baut, hat damit nichts
 * zu tun und soll ihn nicht sehen.
 *
 * Er steht deshalb unter „Erweitert", und er wird **nie automatisch
 * nachgezogen**, wenn sich die Frage ändert: Ein Umbenennen macht alle bereits
 * gespeicherten Antworten unauffindbar, ohne dass sichtbar etwas kaputtgeht.
 */
export default function Fragekarte({
    definition,
    feld,
    vorgaenger,
    onDefinition,
    nummer,
    anzahl,
    woerter,
    typen,
    sperrgrund,
    onChange,
    onDuplizieren,
    onEntfernen,
    onHoch,
    onRunter,
}: Props) {
    const [erweitert, setErweitert] = useState(false);
    const [logikOffen, setLogikOffen] = useState(false);
    const typ = typen.find((t) => t.wert === feld.type);
    const regeln = regelnFuerZiel(definition, 'field', feld.name);

    return (
        <article className="pm-fb-frage">
            <header className="pm-fb-frage__kopf">
                <span className="pm-fb-frage__nummer">
                    {woerter.einzahl} {nummer} von {anzahl}
                </span>

                <span className="pm-fb-frage__werkzeuge">
                    <button
                        type="button"
                        className="pm-fb-knopf pm-fb-knopf--still"
                        aria-label={`${woerter.einzahl} ${nummer} nach oben`}
                        disabled={nummer === 1}
                        onClick={onHoch}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        className="pm-fb-knopf pm-fb-knopf--still"
                        aria-label={`${woerter.einzahl} ${nummer} nach unten`}
                        disabled={nummer === anzahl}
                        onClick={onRunter}
                    >
                        ↓
                    </button>
                    {/*
                        Duplizieren steht neben Löschen und nicht unter
                        „Erweitert": Es ist der meistgeklickte Handgriff eines
                        Umfrage-Baukastens. Man formuliert eine gute Frage
                        einmal und variiert sie danach fünfmal.
                    */}
                    <button
                        type="button"
                        className="pm-fb-knopf pm-fb-knopf--still"
                        onClick={onDuplizieren}
                    >
                        Duplizieren
                    </button>
                    <button
                        type="button"
                        className="pm-fb-knopf pm-fb-knopf--gefahr"
                        disabled={sperrgrund !== undefined}
                        title={sperrgrund}
                        onClick={onEntfernen}
                    >
                        Löschen
                    </button>
                </span>
            </header>

            {/*
                Die Frage selbst, groß und ohne Beschriftung darüber. Sie IST
                die Überschrift der Karte — ein Label „Beschriftung" davor wäre
                eine Zeile, die nichts sagt.
            */}
            <input
                className="pm-fb-eingabe pm-fb-frage__text"
                value={feld.label}
                placeholder={`${woerter.einzahl} eingeben …`}
                onChange={(e) => onChange({ label: e.target.value })}
            />

            <div className="pm-fb-maske__reihe">
                <label className="pm-fb-maske__feld">
                    <span>Art der Antwort</span>
                    <select
                        className="pm-fb-eingabe"
                        value={feld.type}
                        onChange={(e) => onChange({ type: e.target.value })}
                    >
                        {typen.map((t) => (
                            <option key={t.wert} value={t.wert}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                    {typ?.wofuer && (
                        <small className="pm-fb-hinweis">{typ.wofuer}</small>
                    )}
                </label>

                <label className="pm-fb-option pm-fb-frage__pflicht">
                    <input
                        type="checkbox"
                        checked={feld.required === true}
                        onChange={(e) => onChange({ required: e.target.checked })}
                    />
                    <span>Pflicht</span>
                </label>
            </div>

            {MIT_OPTIONEN.includes(feld.type) && (
                <Optionsliste
                    optionen={feld.options ?? []}
                    onChange={(options) => onChange({ options })}
                />
            )}

            {feld.type === 'scale' && (
                <div className="pm-fb-maske__reihe">
                    <label className="pm-fb-maske__feld">
                        <span>Stufen</span>
                        <input
                            className="pm-fb-eingabe"
                            type="number"
                            min={STUFEN_MIN}
                            max={STUFEN_MAX}
                            value={feld.stufen ?? STUFEN_VORGABE}
                            onChange={(e) => onChange({ stufen: Number(e.target.value) })}
                        />
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
                            <option value="zahlen">Zahlen</option>
                            <option value="sterne">Sterne</option>
                            <option value="smilies">Smilies</option>
                        </select>
                    </label>
                </div>
            )}

            {feld.type === 'nps' && (
                <p className="pm-fb-hinweis">
                    Feste Skala von 0 bis 10. Wer 9 oder 10 gibt, zählt als
                    Promotor, wer 0 bis 6 gibt, als Detraktor — daran hängt die
                    Auswertung.
                </p>
            )}

            <div className="pm-fb-frage__leiste">
                {/*
                    „Wann zeigen?" steht neben „Erweitert" und nicht darin: Es
                    ist eine fachliche Frage, die jemand beim Schreiben der
                    Frage hat — nicht eine Einstellung, die man einmal setzt
                    und vergisst. Die Zahl daneben macht sichtbar, dass es
                    schon eine Regel gibt, ohne dass man aufklappen muss.
                */}
                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--still"
                    aria-expanded={logikOffen}
                    onClick={() => setLogikOffen(!logikOffen)}
                >
                    Wann zeigen?
                    {regeln.length > 0 && ` (${regeln.length})`}
                </button>

                <button
                    type="button"
                    className="pm-fb-knopf pm-fb-knopf--still"
                    aria-expanded={erweitert}
                    onClick={() => setErweitert(!erweitert)}
                >
                    {erweitert ? 'Weniger' : 'Erweitert'}
                </button>
            </div>

            {logikOffen && (
                <Bedingungen
                    definition={definition}
                    feld={feld}
                    vorgaenger={vorgaenger}
                    woerter={woerter}
                    onChange={onDefinition}
                />
            )}

            {erweitert && (
                <div className="pm-fb-frage__erweitert">
                    <label className="pm-fb-maske__feld">
                        <span>Hinweis unter der {woerter.einzahl}</span>
                        <input
                            className="pm-fb-eingabe"
                            value={feld.hinweis ?? ''}
                            onChange={(e) => onChange({ hinweis: e.target.value })}
                        />
                    </label>

                    <label className="pm-fb-maske__feld">
                        <span>Platzhalter im Feld</span>
                        <input
                            className="pm-fb-eingabe"
                            value={feld.placeholder ?? ''}
                            onChange={(e) => onChange({ placeholder: e.target.value })}
                        />
                    </label>

                    <label className="pm-fb-maske__feld">
                        <span>Datenschlüssel</span>
                        <input
                            className="pm-fb-eingabe"
                            value={feld.name}
                            disabled={sperrgrund !== undefined}
                            onChange={(e) => onChange({ name: e.target.value })}
                        />
                        <small className="pm-fb-hinweis">
                            {sperrgrund ??
                                'Unter diesem Namen liegen die Antworten. Ändern macht ' +
                                    'alle bereits gegebenen Antworten unauffindbar — ohne ' +
                                    'dass sichtbar etwas kaputtgeht.'}
                        </small>
                    </label>
                </div>
            )}
        </article>
    );
}
