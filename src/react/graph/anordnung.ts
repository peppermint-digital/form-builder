import {
    layoutAufloesen,
    type AufgeloesterKnoten,
    type FormularDefinition,
    type Knotenposition,
} from '../../core';

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

export type Knotenart = 'feld' | 'gruppe' | 'schritt';

export interface GraphKnoten {
    /** Feldname bei `feld`, sonst die Kennung von Gruppe oder Schritt. */
    id: string;
    art: Knotenart;
    /** Kennung des umgebenden Rahmens; fehlt auf oberster Ebene. */
    parentId?: string;
    /** Bei Kindern RELATIV zum Rahmen — so rechnet React Flow. */
    position: Knotenposition;
    breite: number;
    hoehe: number;
    titel: string;
    /** Nur bei `feld`: der Feldtyp, fuer die Beschriftung im Knoten. */
    feldTyp?: string;
    /** Nur bei `feld`: ob das Feld laut Definition Pflicht ist. */
    pflicht?: boolean;
}

/**
 * Baut aus einer Definition die Knoten des Graphen.
 *
 * Gespeicherte Positionen gewinnen; wo keine steht, entsteht eine
 * nachvollziehbare Anordnung aus der Reihenfolge. Das ist die Bedingung
 * dafuer, dass `graph` reine Kosmetik bleibt: ein Formular, das nie im
 * Knoten-Editor war, muss sich darin trotzdem oeffnen lassen — und beim
 * zweiten Oeffnen genauso aussehen wie beim ersten.
 */
export function knotenAusDefinition(
    definition: FormularDefinition,
): GraphKnoten[] {
    const gespeichert = definition.graph?.positions ?? {};

    const gebaut: GraphKnoten[] = [];

    const gehen = (knoten: AufgeloesterKnoten[], eltern?: string): void => {
        let laufendeHoehe = eltern ? MASSE.kopf : 0;

        for (const eintrag of knoten) {
            if (eintrag.type === 'section') {
                continue;
            }

            if (eintrag.type === 'row') {
                for (const feld of eintrag.columns.flat()) {
                    gebaut.push({
                        id: feld.name,
                        art: 'feld',
                        ...(eltern ? { parentId: eltern } : {}),
                        position: gespeichert[feld.name] ?? {
                            x: MASSE.rand,
                            y: laufendeHoehe + MASSE.rand,
                        },
                        breite: MASSE.feldBreite,
                        hoehe: MASSE.feldHoehe,
                        titel: feld.label || feld.name,
                        feldTyp: feld.type,
                        pflicht: feld.required === true,
                    });

                    laufendeHoehe += MASSE.feldHoehe + MASSE.luecke;
                }

                continue;
            }

            // Gruppe oder Schritt: erst die Kinder, dann die eigene Groesse —
            // sie ergibt sich aus dem, was darin liegt.
            const vorher = gebaut.length;

            gebaut.push({
                id: eintrag.id,
                art: eintrag.type === 'group' ? 'gruppe' : 'schritt',
                ...(eltern ? { parentId: eltern } : {}),
                position: gespeichert[eintrag.id] ?? {
                    x: MASSE.rand,
                    y: laufendeHoehe + MASSE.rand,
                },
                breite: 0,
                hoehe: 0,
                titel:
                    eintrag.title ||
                    (eintrag.type === 'group' ? 'Gruppe' : 'Schritt'),
            });

            gehen(eintrag.children, eintrag.id);

            const rahmen = gebaut[vorher]!;
            const masse = rahmenMasse(gebaut.slice(vorher + 1), eintrag.id);

            rahmen.breite = masse.breite;
            rahmen.hoehe = masse.hoehe;

            laufendeHoehe += masse.hoehe + MASSE.luecke;
        }
    };

    gehen(layoutAufloesen(definition));

    return gebaut;
}

/**
 * Wie gross ein Rahmen sein muss, damit sein Inhalt hineinpasst.
 *
 * Gerechnet statt gestylt: React Flow haelt Kinder mit `extent: 'parent'`
 * innerhalb der Flaeche des Rahmens. Ist die zu klein, laesst sich ein Knoten
 * nicht mehr dorthin ziehen, wo er hingehoert — und es sieht aus, als haenge
 * der Editor.
 */
function rahmenMasse(
    kandidaten: GraphKnoten[],
    eltern: string,
): { breite: number; hoehe: number } {
    const kinder = kandidaten.filter((knoten) => knoten.parentId === eltern);

    if (kinder.length === 0) {
        return {
            breite: MASSE.feldBreite + 2 * MASSE.rand,
            hoehe: MASSE.kopf + MASSE.feldHoehe + 2 * MASSE.rand,
        };
    }

    const rechts = Math.max(
        ...kinder.map((knoten) => knoten.position.x + knoten.breite),
    );
    const unten = Math.max(
        ...kinder.map((knoten) => knoten.position.y + knoten.hoehe),
    );

    return {
        breite: rechts + MASSE.rand,
        hoehe: unten + MASSE.rand,
    };
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
