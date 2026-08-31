import {
    layoutAufloesen,
    type AufgeloesterKnoten,
    type FormularDefinition,
    type Knotengroesse,
    type Knotenposition,
} from '../../core';
import { knotenId, type Knotenart } from './kennung';

/**
 * Die Masse, nach denen der Graph aufgebaut wird.
 *
 * Bewusst Zahlen und keine CSS-Variablen: React Flow rechnet mit
 * Koordinaten, nicht mit Layout. Ein Rahmen, dessen Groesse aus dem
 * Stylesheet kaeme, waere im Graphen an der falschen Stelle.
 */
export const MASSE = {
    feldBreite: 220,
    feldHoehe: 64,
    luecke: 16,
    rand: 20,
    kopf: 44,
} as const;

export interface GraphKnoten {
    /** Mit Praefix — siehe `kennung.ts`, warum der nicht wegdarf. */
    id: string;
    /** Der Name bzw. die Kennung ohne Praefix. */
    ref: string;
    art: Knotenart;
    /** Kennung des umgebenden Rahmens; fehlt auf oberster Ebene. */
    parentId?: string;
    /** Bei Kindern RELATIV zum Rahmen — so rechnet React Flow. */
    position: Knotenposition;
    breite: number;
    hoehe: number;
    titel: string;
    /**
     * Wie gross der Inhalt MINDESTENS braucht.
     *
     * Nur bei Rahmen. Kleiner darf niemand ziehen: sonst laegen die Felder
     * sichtbar neben ihrem eigenen Rahmen.
     */
    mindestBreite?: number;
    mindestHoehe?: number;
    /** Nur bei `feld`: der Feldtyp, fuer die Beschriftung im Knoten. */
    feldTyp?: string;
    /** Nur bei `feld`: ob das Feld laut Definition Pflicht ist. */
    pflicht?: boolean;
}

/**
 * Baut aus einer Definition die Knoten des Graphen.
 *
 * Gespeicherte Positionen gewinnen; wo keine steht, entsteht eine Anordnung
 * aus der Reihenfolge. Das ist die Bedingung dafuer, dass `graph` reine
 * Kosmetik bleibt: ein Formular, das nie im Knoten-Editor war — und das sind
 * heute alle — muss sich darin oeffnen lassen, und beim zweiten Oeffnen
 * genauso aussehen wie beim ersten.
 *
 * Die Anordnung folgt dem, was das Formular ohnehin schon aussagt:
 *
 * - **Zeilen** legen ihre Spalten NEBENEINANDER. Ein zweispaltiges
 *   „Vorname | Nachname" steht im Graphen so, wie es im Formular steht.
 * - **Rahmen** stapeln ihren Inhalt untereinander, unter der Ueberschrift.
 * - **Auf oberster Ebene** entscheidet der Bestand: hat das Formular
 *   Schritte, laufen sie von links nach rechts — in dieselbe Richtung wie die
 *   Verzweigungspfeile. Hat es keine, wird gestapelt, wie ein Formular
 *   gelesen wird.
 *
 * Bewusst ohne dagre oder elkjs. Eine Anordnung, die sich aus der Reihenfolge
 * ergibt, ist vorhersagbar und braucht keine Abhaengigkeit; ein
 * Graphen-Layouter waere erst dann faellig, wenn das nachweislich nicht mehr
 * reicht.
 */
export function knotenAusDefinition(
    definition: FormularDefinition,
): GraphKnoten[] {
    const gespeichert = definition.graph?.positions ?? {};
    const groessen = definition.graph?.sizes ?? {};
    const gebaut: GraphKnoten[] = [];

    // Mit leeren Rahmen: der Editor muss zeigen, was jemand gerade angelegt
    // hat, auch bevor etwas darin liegt.
    const aufgeloest = layoutAufloesen(definition, { leereRahmenBehalten: true });

    // Waagerecht nur, wenn es ueberhaupt Schritte gibt. Ein Bestandsformular
    // hat keine — und soll aussehen wie das Formular, das es ist.
    const richtung: Richtung = aufgeloest.some((knoten) => knoten.type === 'step')
        ? 'waagerecht'
        : 'senkrecht';

    const platzieren = (
        liste: AufgeloesterKnoten[],
        eltern: string | undefined,
        fluss: Richtung,
    ): Ausmass => {
        let x = MASSE.rand;
        let y = eltern ? MASSE.kopf : MASSE.rand;
        let rechts = 0;
        let unten = 0;

        const merken = (knoten: GraphKnoten) => {
            gebaut.push(knoten);
            rechts = Math.max(rechts, knoten.position.x + knoten.breite);
            unten = Math.max(unten, knoten.position.y + knoten.hoehe);
        };

        for (const eintrag of liste) {
            // Abschnitte sind reine Ueberschriften im Formular. Ein eigener
            // Knoten dafuer traegt im Graphen keine Aussage.
            if (eintrag.type === 'section') {
                continue;
            }

            if (eintrag.type === 'row') {
                let spaltenX = x;
                let zeilenHoehe = 0;

                for (const spalte of eintrag.columns) {
                    let spaltenY = y;

                    for (const feld of spalte) {
                        merken({
                            id: knotenId('feld', feld.name),
                            ref: feld.name,
                            art: 'feld',
                            ...(eltern ? { parentId: eltern } : {}),
                            position: gespeichert[knotenId('feld', feld.name)] ?? {
                                x: spaltenX,
                                y: spaltenY,
                            },
                            breite: MASSE.feldBreite,
                            hoehe: MASSE.feldHoehe,
                            titel: feld.label || feld.name,
                            feldTyp: feld.type,
                            pflicht: feld.required === true,
                        });

                        spaltenY += MASSE.feldHoehe + MASSE.luecke;
                    }

                    zeilenHoehe = Math.max(zeilenHoehe, spaltenY - y - MASSE.luecke);
                    spaltenX += MASSE.feldBreite + MASSE.luecke;
                }

                if (fluss === 'waagerecht') {
                    x = spaltenX;
                } else {
                    y += zeilenHoehe + MASSE.luecke;
                }

                continue;
            }

            const art: Knotenart = eintrag.type === 'group' ? 'gruppe' : 'schritt';
            const eigeneId = knotenId(art, eintrag.id);
            const stelle = gebaut.length;

            merken({
                id: eigeneId,
                ref: eintrag.id,
                art,
                ...(eltern ? { parentId: eltern } : {}),
                position: gespeichert[eigeneId] ?? { x, y },
                breite: 0,
                hoehe: 0,
                titel: eintrag.title || (art === 'gruppe' ? 'Gruppe' : 'Schritt'),
            });

            // In einem Rahmen wird immer gestapelt: er ist ein Ausschnitt des
            // Formulars, und ein Formular liest man von oben nach unten.
            const innen = platzieren(eintrag.children, eigeneId, 'senkrecht');

            const rahmen = gebaut[stelle]!;

            // Der gerechnete Inhalt ist die Mindestgroesse; eine von Hand
            // gesetzte gewinnt darueber.
            rahmen.mindestBreite = innen.breite;
            rahmen.mindestHoehe = innen.hoehe;
            rahmen.breite = Math.max(groessen[eigeneId]?.breite ?? 0, innen.breite);
            rahmen.hoehe = Math.max(groessen[eigeneId]?.hoehe ?? 0, innen.hoehe);

            rechts = Math.max(rechts, rahmen.position.x + rahmen.breite);
            unten = Math.max(unten, rahmen.position.y + rahmen.hoehe);

            if (fluss === 'waagerecht') {
                x += rahmen.breite + MASSE.luecke;
            } else {
                y += rahmen.hoehe + MASSE.luecke;
            }
        }

        return {
            breite: Math.max(rechts + MASSE.rand, MASSE.feldBreite + 2 * MASSE.rand),
            hoehe: Math.max(
                unten + MASSE.rand,
                (eltern ? MASSE.kopf : 0) + MASSE.feldHoehe + 2 * MASSE.rand,
            ),
        };
    };

    platzieren(aufgeloest, undefined, richtung);

    return gebaut;
}

type Richtung = 'waagerecht' | 'senkrecht';

interface Ausmass {
    breite: number;
    hoehe: number;
}

/**
 * Die Unterkante der gesamten Struktur.
 *
 * Die Regel-Knoten liegen darunter, in einer eigenen Bahn. Sie an einer
 * festen Stelle abzulegen ginge so lange gut, bis ein Formular mit Schritten
 * daherkommt und die Bahn mitten durch die Knoten laeuft.
 */
export function unterkanteVon(knoten: GraphKnoten[]): number {
    const oberste = knoten.filter((eintrag) => eintrag.parentId === undefined);

    if (oberste.length === 0) {
        return MASSE.rand;
    }

    return (
        Math.max(...oberste.map((eintrag) => eintrag.position.y + eintrag.hoehe)) +
        MASSE.luecke * 2
    );
}

/**
 * Schreibt die Positionen zurueck in die Definition.
 *
 * Nur Positionen, und nur die, die von der abgeleiteten Anordnung abweichen
 * waere schoener — aber nicht ehrlich: was einmal von Hand geschoben wurde,
 * soll genau dort bleiben, auch wenn es zufaellig dem Vorschlag entspricht.
 */
export function positionenSchreiben(
    definition: FormularDefinition,
    positionen: Record<string, Knotenposition>,
): FormularDefinition {
    if (Object.keys(positionen).length === 0) {
        // Kein leeres `graph` anlegen: das waere ein Unterschied in der
        // gespeicherten Definition, den niemand gemacht hat.
        const { graph: _weg, ...ohne } = definition;

        return ohne;
    }

    return { ...definition, graph: { ...definition.graph, positions: positionen } };
}

/** Eine von Hand gezogene Rahmengroesse festhalten. */
export function groesseSchreiben(
    definition: FormularDefinition,
    id: string,
    groesse: Knotengroesse,
): FormularDefinition {
    return {
        ...definition,
        graph: {
            ...definition.graph,
            sizes: {
                ...(definition.graph?.sizes ?? {}),
                [id]: {
                    breite: Math.round(groesse.breite),
                    hoehe: Math.round(groesse.hoehe),
                },
            },
        },
    };
}

/**
 * Vergisst Position und Groesse eines Knotens.
 *
 * Noetig, sobald ein Feld den Rahmen wechselt: seine gespeicherte Position
 * war RELATIV zum alten Rahmen und zeigt im neuen irgendwohin. Ohne das
 * Vergessen landet ein hineingezogenes Feld sichtbar neben der Gruppe, in die
 * es gerade gelegt wurde.
 */
export function anordnungVergessen(
    definition: FormularDefinition,
    id: string,
): FormularDefinition {
    const positionen = { ...(definition.graph?.positions ?? {}) };
    const groessen = { ...(definition.graph?.sizes ?? {}) };

    delete positionen[id];
    delete groessen[id];

    if (Object.keys(positionen).length === 0 && Object.keys(groessen).length === 0) {
        const { graph: _weg, ...ohne } = definition;

        return ohne;
    }

    return {
        ...definition,
        graph: {
            ...(Object.keys(positionen).length > 0 ? { positions: positionen } : {}),
            ...(Object.keys(groessen).length > 0 ? { sizes: groessen } : {}),
        },
    };
}
