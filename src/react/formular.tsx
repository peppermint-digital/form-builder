import { useState, type ReactElement, type ReactNode } from 'react';

import {
    definitionLesen,
    pruefungenTreffen,
    schritteAufloesen,
    optionenMitBestandswert,
    sichtbarkeit,
    textLesen,
    wertLeer,
    type AufgeloesterKnoten,
    type AufgeloesterSchritt,
    type Feldwert,
    type FormularDefinition,
    type RoheDefinition,
    type Sichtbarkeit,
} from '../core';
import FormularFeldEingabe from './feld';
import {
    StandardGruppe,
    StandardMatrix,
    StandardSchrittsteuerung,
    StandardSystembaustein,
} from './standard';
import type {
    EigenerFeldTyp,
    KomponentenSatz,
    MatrixZeile,
    Systembaustein,
} from './typen';

/** Was der Renderer ueber den Schrittstand nach aussen gibt. */
export interface SchrittStand {
    /** 1-basiert und nur ueber die SICHTBAREN Schritte gezaehlt. */
    schritt: number;
    anzahl: number;
    istErster: boolean;
    istLetzter: boolean;
    /** Falsch, solange es nur eine Seite gibt — dann gibt es nichts zu blaettern. */
    mehrstufig: boolean;
    weiter: () => void;
    zurueck: () => void;
}

export interface FormularRendererProps {
    /** Nimmt jede gespeicherte Form an — Objekt, nackte Liste oder nichts. */
    definition: RoheDefinition;
    /**
     * Der Antwortstand. Zeichenketten — mit der einen Ausnahme
     * `checkboxes`, die eine Liste fuehrt (siehe `Feldwert`).
     */
    werte: Record<string, Feldwert>;
    onChange: (name: string, wert: Feldwert) => void;
    /** Feldname → Meldung, wie Laravel sie zurueckgibt. */
    fehler?: Record<string, string | undefined>;
    komponenten?: KomponentenSatz;
    eigeneTypen?: Record<string, EigenerFeldTyp>;
    idPrefix?: string;
    /** Setzt den Fokus ins erste Feld. Nur sinnvoll, wenn die Maske allein steht. */
    autoFocusErstesFeld?: boolean;
    /** Meldung, wenn beim Weiterblaettern ein Pflichtfeld leer ist. */
    pflichtMeldung?: string;
    /**
     * Bausteine, die die ANWENDUNG zeichnet — Terminauswahl, Workshops.
     *
     * Sie stehen nicht in der Definition und landen auch nie darin. Ohne sie
     * zeigt die Vorschau weniger, als die Anmeldeseite am Ende hat.
     */
    systemBausteine?: Systembaustein[];
    /**
     * Bekommt den Schrittstand und zeichnet, was darunter gehoert.
     *
     * Die Absende-Schaltflaeche gehoert der Anwendung, nicht dem Paket — aber
     * bei einem mehrstufigen Formular darf sie nur auf der letzten Seite
     * stehen. Ohne diesen Weg muesste die Anwendung den Schrittstand selbst
     * fuehren, und dann gaebe es ihn zweimal.
     */
    children?: (stand: SchrittStand) => ReactNode;
}

const KEINE_BAUSTEINE: Systembaustein[] = [];

/**
 * Zeichnet eine Formular-Definition — mehrspaltig, gruppiert, bedingt und
 * bei Bedarf ueber mehrere Seiten.
 *
 * Was erscheint, entscheidet diese Komponente NICHT. Struktur kommt aus
 * `schritteAufloesen()`, Sichtbarkeit und Pflicht aus `sichtbarkeit()` — beide
 * im framework-unabhaengigen Kern, weil der Server dieselben Fragen noch
 * einmal beantworten muss. Hier wird nur angeordnet und gezeichnet.
 *
 * Ein Formular ohne Schritte und ohne Bedingungen sieht dadurch aus wie
 * vorher: `schritteAufloesen()` liefert einen impliziten Schritt, und ohne
 * Regeln ist alles sichtbar.
 */
export default function FormularRenderer({
    definition,
    werte,
    onChange,
    fehler = {},
    komponenten,
    eigeneTypen,
    idPrefix,
    autoFocusErstesFeld = false,
    pflichtMeldung = 'Bitte ausfüllen.',
    systemBausteine = KEINE_BAUSTEINE,
    children,
}: FormularRendererProps) {
    const [verlauf, setVerlauf] = useState<string[]>([]);
    const [eigeneFehler, setEigeneFehler] = useState<Record<string, string>>({});

    const gelesen = definitionLesen(definition);
    const stand = sichtbarkeit(gelesen, werte);
    const alleSchritte = schritteAufloesen(gelesen);

    const sichtbareSchritte = alleSchritte.filter((schritt) => {
        if (!schritt.implizit && !stand.sichtbareSchritte.has(schritt.id)) {
            return false;
        }

        const felder = felderVon(schritt.knoten);

        // Ein Schritt, dessen Felder ALLE bedingt verborgen sind, ist eine
        // leere Seite mit Weiter-Schaltflaeche. Bei einem bedingten Formular
        // ist das der Normalfall und nicht die Ausnahme: „zeig die
        // Hotelfragen nur bei Uebernachtung" heisst fuer alle anderen eine
        // Seite, durch die sie klicken muessen — und es sieht aus wie ein
        // Fehler in der Anmeldung.
        //
        // Ein Schritt GANZ ohne Felder bleibt dagegen stehen: das ist eine
        // gewollte Textseite mit Abschnitten, und die duerfte nicht
        // verschwinden, nur weil nichts auszufuellen ist.
        if (felder.length === 0) {
            return true;
        }

        return felder.some((name) => stand.sichtbareFelder.has(name));
    });

    // Alle Schritte verborgen: das ist eine kaputte Definition, kein
    // Formular. Lieber nichts zeichnen als eine leere Seite mit
    // Weiter-Schaltflaeche.
    if (sichtbareSchritte.length === 0) {
        return <div className="pm-fb-formular" />;
    }

    const kette = verlauf.length > 0 ? verlauf : [sichtbareSchritte[0]!.id];
    const aktuell =
        sichtbareSchritte.find((schritt) => schritt.id === kette[kette.length - 1]) ??
        sichtbareSchritte[0]!;
    const index = sichtbareSchritte.indexOf(aktuell);
    const mehrstufig = sichtbareSchritte.length > 1;

    const feldGeaendert = (name: string, wert: Feldwert) => {
        if (eigeneFehler[name]) {
            const rest = { ...eigeneFehler };
            delete rest[name];
            setEigeneFehler(rest);
        }

        onChange(name, wert);
    };

    const weiter = () => {
        const fehlend = pflichtLuecken(aktuell, stand, werte);

        // Ohne diesen Riegel blaettert man bis zum Ende durch und bekommt dort
        // Fehler zu Feldern, die drei Seiten zurueckliegen — ohne Hinweis,
        // welche Seite gemeint ist.
        if (fehlend.length > 0) {
            setEigeneFehler(
                Object.fromEntries(fehlend.map((name) => [name, pflichtMeldung])),
            );

            return;
        }

        const naechster = naechsterSchritt(
            gelesen,
            aktuell,
            sichtbareSchritte,
            werte,
            stand,
        );

        if (naechster) {
            setEigeneFehler({});
            setVerlauf([...kette, naechster.id]);
        }
    };

    const zurueck = () => {
        setEigeneFehler({});

        // Ueber den Verlauf und nicht ueber den Index: mit Verzweigungen ist
        // der Weg zurueck nicht der Schritt davor, sondern der, ueber den man
        // hergekommen ist.
        setVerlauf(kette.length > 1 ? kette.slice(0, -1) : kette);
    };

    const schrittStand: SchrittStand = {
        schritt: index + 1,
        anzahl: sichtbareSchritte.length,
        istErster: kette.length <= 1,
        istLetzter: !naechsterSchritt(gelesen, aktuell, sichtbareSchritte, werte, stand),
        mehrstufig,
        weiter,
        zurueck,
    };

    const Gruppe = komponenten?.Gruppe ?? StandardGruppe;
    const Matrix = komponenten?.Matrix ?? StandardMatrix;
    const Baustein = komponenten?.Systembaustein ?? StandardSystembaustein;
    const Schrittsteuerung =
        komponenten?.Schrittsteuerung ?? StandardSchrittsteuerung;

    // Serverfehler gewinnen: sie stammen aus dem letzten echten Absenden, die
    // eigenen nur aus dem Blaettern.
    const alleFehler: Record<string, string | undefined> = {
        ...eigeneFehler,
        ...fehler,
    };

    let erstesFeld = true;

    const zeichnen = (
        knoten: AufgeloesterKnoten[],
        schluessel: string,
    ): ReactElement[] =>
        knoten.flatMap<ReactElement>((eintrag, position) => {
            const eigenerSchluessel = `${schluessel}_${position}`;

            if (eintrag.type === 'section') {
                return [
                    <div className="pm-fb-abschnitt" key={eigenerSchluessel}>
                        <h3 className="pm-fb-abschnitt__titel">{eintrag.title}</h3>
                        {eintrag.description && (
                            <p className="pm-fb-abschnitt__text">{eintrag.description}</p>
                        )}
                    </div>,
                ];
            }

            if (eintrag.type === 'group') {
                if (!stand.sichtbareGruppen.has(eintrag.id)) {
                    return [];
                }

                /*
                 * Eine Matrix-Gruppe wird als Tabelle gezeichnet statt als
                 * Rahmen. Die Felder darin bleiben gewöhnliche Felder mit
                 * eigenem Datenschlüssel — es ändert sich nur, WIE sie
                 * nebeneinander stehen.
                 *
                 * Nur SICHTBARE Zeilen. Eine bedingt ausgeblendete Zeile
                 * verschwindet aus der Tabelle; eine leere Zeile mit
                 * Überschrift wäre eine Frage, die es nicht gibt.
                 */
                if (eintrag.matrix) {
                    const zeilen = matrixZeilen(
                        eintrag,
                        stand,
                        werte,
                        alleFehler,
                        idPrefix ?? '',
                        feldGeaendert,
                    );

                    if (zeilen.length === 0) {
                        return [];
                    }

                    return [
                        <Matrix
                            key={eigenerSchluessel}
                            id={`${idPrefix}${eintrag.id}`}
                            {...(eintrag.title ? { title: eintrag.title } : {})}
                            {...(eintrag.description
                                ? { description: eintrag.description }
                                : {})}
                            spalten={eintrag.matrix.spalten}
                            zeilen={zeilen}
                        />,
                    ];
                }

                const inhalt = zeichnen(eintrag.children, eigenerSchluessel);

                // Ein Rahmen, dessen Inhalt komplett bedingt weggefallen ist,
                // waere eine leere Umrandung mit Ueberschrift.
                if (inhalt.length === 0) {
                    return [];
                }

                return [
                    <Gruppe
                        key={eigenerSchluessel}
                        id={eintrag.id}
                        {...(eintrag.title ? { title: eintrag.title } : {})}
                        {...(eintrag.description
                            ? { description: eintrag.description }
                            : {})}
                    >
                        {inhalt}
                    </Gruppe>,
                ];
            }

            if (eintrag.type === 'step') {
                // Verschachtelte Schritte ergeben keine zweite Seite — sie
                // werden wie ein Rahmen ohne Rand gezeichnet, damit ihr Inhalt
                // nicht verschwindet.
                return zeichnen(eintrag.children, eigenerSchluessel);
            }

            const spalten = eintrag.columns
                .map((spalte) =>
                    spalte.filter((feld) => stand.sichtbareFelder.has(feld.name)),
                )
                .filter((spalte) => spalte.length > 0);

            if (spalten.length === 0) {
                return [];
            }

            return [
                <div
                    key={eigenerSchluessel}
                    className={`pm-fb-zeile pm-fb-zeile--${Math.min(spalten.length, 3)}`}
                >
                    {spalten.map((spalte, spaltenIndex) => (
                        <div className="pm-fb-spalte" key={`${eigenerSchluessel}_${spaltenIndex}`}>
                            {spalte.map((feld) => {
                                const fokus = autoFocusErstesFeld && erstesFeld;
                                erstesFeld = false;

                                return (
                                    <FormularFeldEingabe
                                        key={feld.name}
                                        feld={feld}
                                        wert={werte[feld.name] ?? ''}
                                        onChange={(wert) => feldGeaendert(feld.name, wert)}
                                        pflicht={stand.pflichtFelder.has(feld.name)}
                                        {...(alleFehler[feld.name]
                                            ? { fehler: alleFehler[feld.name] }
                                            : {})}
                                        {...(komponenten ? { komponenten } : {})}
                                        {...(eigeneTypen ? { eigeneTypen } : {})}
                                        {...(idPrefix ? { idPrefix } : {})}
                                        autoFocus={fokus}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>,
            ];
        });

    // Nur auf der ERSTEN bzw. LETZTEN Seite. Auf jeder Seite wiederholt waeren
    // sie eine Aufforderung, die Terminwahl mehrfach zu treffen.
    const vorher = index === 0 ? systemBausteine.filter((b) => b.position === 'vorher') : [];
    const nachher = schrittStand.istLetzter
        ? systemBausteine.filter((b) => b.position === 'nachher')
        : [];

    return (
        <div className="pm-fb-formular">
            {vorher.map((baustein) => (
                <Baustein key={baustein.id} baustein={baustein} />
            ))}

            {mehrstufig && (aktuell.title || aktuell.description) && (
                <div className="pm-fb-schritt__kopf">
                    {aktuell.title && (
                        <h3 className="pm-fb-schritt__titel">{aktuell.title}</h3>
                    )}
                    {aktuell.description && (
                        <p className="pm-fb-schritt__text">{aktuell.description}</p>
                    )}
                </div>
            )}

            {zeichnen(aktuell.knoten, 'k')}

            {nachher.map((baustein) => (
                <Baustein key={baustein.id} baustein={baustein} />
            ))}

            {mehrstufig && (
                <Schrittsteuerung
                    schritt={schrittStand.schritt}
                    anzahl={schrittStand.anzahl}
                    istErster={schrittStand.istErster}
                    istLetzter={schrittStand.istLetzter}
                    weiter={weiter}
                    zurueck={zurueck}
                />
            )}

            {children?.(schrittStand)}
        </div>
    );
}

/**
 * Die Pflichtfelder dieses Schritts, die noch leer sind.
 *
 * Nur die SICHTBAREN: ein Feld, das die Bedingungen gerade ausgeblendet
 * haben, kann niemand ausfuellen, und `sichtbarkeit()` nimmt es ohnehin aus
 * den Pflichtfeldern heraus.
 */
function pflichtLuecken(
    schritt: AufgeloesterSchritt,
    stand: Sichtbarkeit,
    werte: Record<string, Feldwert>,
): string[] {
    return felderVon(schritt.knoten)
        .filter((name) => stand.pflichtFelder.has(name))
        // Ueber `wertLeer` und nicht ueber `=== ''`: eine leere
        // Mehrfachauswahl ist `[]`, und `[] === ''` ist falsch. Ohne diesen
        // Schnitt galte ein Pflicht-Mehrfachfeld als ausgefuellt, sobald der
        // Browser den Schluessel ueberhaupt mitschickt — also immer.
        .filter((name) => wertLeer(werte[name]));
}

/**
 * Die Zeilen einer Matrix — aus den Feldern der Gruppe.
 *
 * Nur Felder auf oberster Ebene der Gruppe, und nur SICHTBARE. Wer eine Zeile
 * bedingt ausblendet, will sie aus der Tabelle heraus haben; sie leer
 * stehenzulassen wäre eine Frage, die es gerade nicht gibt.
 */
function matrixZeilen(
    gruppe: { children: AufgeloesterKnoten[] },
    stand: Sichtbarkeit,
    werte: Record<string, Feldwert>,
    alleFehler: Record<string, string | undefined>,
    idPrefix: string,
    onChange: (name: string, wert: Feldwert) => void,
): MatrixZeile[] {
    return gruppe.children
        .flatMap((knoten) =>
            knoten.type === 'row' ? knoten.columns.flat() : [],
        )
        .filter((feld) => stand.sichtbareFelder.has(feld.name))
        .map((feld) => {
            const wert = textLesen(werte[feld.name]);

            return {
                name: feld.name,
                id: `${idPrefix}${feld.name}`,
                label: feld.label,
                required: stand.pflichtFelder.has(feld.name),
                wert,
                // Die Optionen kommen vom FELD und nicht von den Spalten. Die
                // Spalten sind Darstellung, die Optionen sind der Vertrag —
                // und daran hängt die Validierung.
                optionen: optionenMitBestandswert(feld, wert),
                ...(alleFehler[feld.name] ? { fehler: alleFehler[feld.name] } : {}),
                ...(feld.hinweis ? { hinweis: feld.hinweis } : {}),
                onChange: (neu: string) => onChange(feld.name, neu),
            };
        });
}

function felderVon(knoten: AufgeloesterKnoten[]): string[] {
    return knoten.flatMap((eintrag) => {
        if (eintrag.type === 'row') {
            return eintrag.columns.flat().map((feld) => feld.name);
        }

        if (eintrag.type === 'group' || eintrag.type === 'step') {
            return felderVon(eintrag.children);
        }

        return [];
    });
}

/**
 * Der naechste Schritt — ueber die Verzweigungen, sonst der naechste in der
 * Reihenfolge.
 *
 * Reihenfolge der Auswahl: erst eine bedingte Kante, die zutrifft, dann eine
 * Kante ohne Bedingung (der Rueckfall), dann der naechste sichtbare Schritt.
 * Fuehrt eine Kante auf einen verborgenen Schritt, gilt sie nicht — sonst
 * landete man auf einer Seite, die es gerade nicht gibt.
 */
function naechsterSchritt(
    definition: FormularDefinition,
    aktuell: AufgeloesterSchritt,
    sichtbare: AufgeloesterSchritt[],
    werte: Record<string, Feldwert>,
    stand: Sichtbarkeit,
): AufgeloesterSchritt | null {
    const kanten = (definition.flow ?? []).filter(
        (kante) => kante.from === aktuell.id,
    );

    const erreichbar = (id: string) =>
        sichtbare.find((schritt) => schritt.id === id) ?? null;

    for (const kante of kanten) {
        if (!kante.tests || kante.tests.length === 0) {
            continue;
        }

        if (
            pruefungenTreffen(
                kante.tests,
                kante.match ?? 'all',
                werte,
                stand.sichtbareFelder,
            )
        ) {
            const ziel = erreichbar(kante.to);

            if (ziel) {
                return ziel;
            }
        }
    }

    for (const kante of kanten) {
        if (kante.tests && kante.tests.length > 0) {
            continue;
        }

        const ziel = erreichbar(kante.to);

        if (ziel) {
            return ziel;
        }
    }

    return sichtbare[sichtbare.indexOf(aktuell) + 1] ?? null;
}
