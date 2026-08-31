import type {
    Ablaufkante,
    Bedingungsregel,
    FormularDefinition,
    Knotenposition,
} from '../../core';
import { knotenId, knotenRef, naechsteKennung, zielArtVon } from './kennung';
import { MASSE } from './anordnung';

export interface GraphKante {
    id: string;
    quelle: string;
    ziel: string;
    /** Was an der Kante steht — die Kurzfassung der Bedingung. */
    beschriftung: string;
    art: 'bedingung' | 'ablauf';
    /** Wahr, wenn diese Kante zu einer Regel gehoert, die im Kreis haengt. */
    imKreis?: boolean;
}

export interface RegelKnoten {
    id: string;
    ref: string;
    position: Knotenposition;
    breite: number;
    hoehe: number;
    titel: string;
    imKreis: boolean;
}

/** Wie eine Wirkung an der Kante steht. */
const WIRKUNG_TEXT: Record<Bedingungsregel['effect'], string> = {
    show: 'zeigen',
    hide: 'verbergen',
    require: 'Pflicht',
    optional: 'freiwillig',
};

const VERGLEICH_TEXT: Record<string, string> = {
    is: 'ist',
    is_not: 'ist nicht',
    contains: 'enthält',
    not_contains: 'enthält nicht',
    filled: 'ist ausgefüllt',
    empty: 'ist leer',
    gt: '>',
    lt: '<',
};

/**
 * Die Kurzfassung einer Pruefung, wie sie an der Kante steht.
 *
 * Sie muss ohne Aufklappen lesbar sein: wer im Graphen sucht, warum ein Feld
 * verschwindet, soll es an der Kante sehen und nicht erst anklicken muessen.
 */
export function pruefungText(
    pruefung: Bedingungsregel['tests'][number],
): string {
    const vergleich = VERGLEICH_TEXT[pruefung.op] ?? pruefung.op;

    return pruefung.value === undefined
        ? `${pruefung.field} ${vergleich}`
        : `${pruefung.field} ${vergleich} „${pruefung.value}“`;
}

/**
 * Die Regel-Knoten des Graphen.
 *
 * Eine Regel bekommt einen eigenen Knoten und ist nicht bloss eine Kante:
 * sie kann mehrere Pruefungen haben, und die muessen alle sichtbar an einer
 * Stelle zusammenlaufen. Als reine Kante waere „A und B, dann zeige C" nicht
 * von „A oder B" zu unterscheiden.
 */
export function regelKnoten(
    definition: FormularDefinition,
    zyklen: string[],
    /**
     * Unterkante der Struktur. Die Regeln liegen darunter, in einer eigenen
     * Bahn — an einer festen Stelle abgelegt liefen sie bei einem Formular
     * mit Schritten mitten durch die Knoten.
     */
    unterkante = 0,
): RegelKnoten[] {
    const gespeichert = definition.graph?.positions ?? {};

    return (definition.conditions ?? []).map((regel, index) => {
        const id = knotenId('regel', regel.id);

        return {
            id,
            ref: regel.id,
            position: gespeichert[id] ?? {
                x: MASSE.rand + index * (MASSE.feldBreite + MASSE.luecke),
                y: unterkante,
            },
            breite: MASSE.feldBreite,
            hoehe: MASSE.feldHoehe,
            titel: `${WIRKUNG_TEXT[regel.effect]} · ${regel.match === 'any' ? 'oder' : 'und'}`,
            imKreis: zyklen.includes(regel.id),
        };
    });
}

/**
 * Alle Kanten: von den geprueften Feldern in die Regel, von der Regel ans
 * Ziel, und die Verzweigungen zwischen Schritten.
 */
export function kantenAusDefinition(
    definition: FormularDefinition,
    zyklen: string[] = [],
): GraphKante[] {
    const kanten: GraphKante[] = [];

    for (const regel of definition.conditions ?? []) {
        const regelKnotenId = knotenId('regel', regel.id);
        const imKreis = zyklen.includes(regel.id);

        for (const [index, pruefung] of regel.tests.entries()) {
            kanten.push({
                id: `${regel.id}__test${index}`,
                quelle: knotenId('feld', pruefung.field),
                ziel: regelKnotenId,
                beschriftung: pruefungText(pruefung),
                art: 'bedingung',
                ...(imKreis ? { imKreis } : {}),
            });
        }

        const zielArt =
            regel.target.kind === 'field'
                ? 'feld'
                : regel.target.kind === 'group'
                  ? 'gruppe'
                  : 'schritt';

        kanten.push({
            id: `${regel.id}__ziel`,
            quelle: regelKnotenId,
            ziel: knotenId(zielArt, regel.target.ref),
            beschriftung: '',
            art: 'bedingung',
            ...(imKreis ? { imKreis } : {}),
        });
    }

    for (const kante of definition.flow ?? []) {
        kanten.push({
            id: kante.id,
            quelle: knotenId('schritt', kante.from),
            ziel: knotenId('schritt', kante.to),
            beschriftung: (kante.tests ?? []).map(pruefungText).join(
                kante.match === 'any' ? ' oder ' : ' und ',
            ),
            art: 'ablauf',
        });
    }

    return kanten;
}

/**
 * Was beim Ziehen einer Verbindung entstehen soll.
 *
 * Die eine Geste, die zaehlt: von einem Feld auf ein Ziel gezogen heisst
 * „zeige das Ziel, wenn dieses Feld ausgefuellt ist". Das ist die Bedingung,
 * die fast jeder zuerst braucht, und sie laesst sich danach verfeinern.
 *
 * Von Schritt zu Schritt gezogen entsteht ein unbedingter Weg.
 *
 * Alles andere ergibt nichts — insbesondere eine Kante auf sich selbst. Sie
 * waere sofort ein Kreis, und der Editor haette ihn gerade erst gebaut.
 */
export function verbindungVerarbeiten(
    definition: FormularDefinition,
    quelleId: string,
    zielId: string,
): FormularDefinition | null {
    const quelle = knotenRef(quelleId);
    const ziel = knotenRef(zielId);

    if (!quelle || !ziel || quelleId === zielId) {
        return null;
    }

    if (quelle.art === 'schritt' && ziel.art === 'schritt') {
        return ablaufAnlegen(definition, quelle.ref, ziel.ref);
    }

    if (quelle.art !== 'feld') {
        return null;
    }

    const zielArt = zielArtVon(ziel.art);

    if (!zielArt) {
        return null;
    }

    return regelAnlegen(definition, quelle.ref, { kind: zielArt, ref: ziel.ref });
}

export function regelAnlegen(
    definition: FormularDefinition,
    feld: string,
    ziel: Bedingungsregel['target'],
): FormularDefinition {
    const vorhanden = definition.conditions ?? [];

    // Dieselbe Verbindung zweimal ziehen soll keine zweite Regel anlegen —
    // sie waere deckungsgleich und im Graphen nicht zu unterscheiden.
    const doppelt = vorhanden.some(
        (regel) =>
            regel.target.kind === ziel.kind &&
            regel.target.ref === ziel.ref &&
            regel.tests.length === 1 &&
            regel.tests[0]?.field === feld,
    );

    if (doppelt) {
        return definition;
    }

    const regel: Bedingungsregel = {
        id: naechsteKennung(
            vorhanden.map((eintrag) => eintrag.id),
            'r',
        ),
        target: ziel,
        effect: 'show',
        match: 'all',
        tests: [{ field: feld, op: 'filled' }],
    };

    return { ...definition, conditions: [...vorhanden, regel] };
}

export function ablaufAnlegen(
    definition: FormularDefinition,
    von: string,
    nach: string,
): FormularDefinition {
    const vorhanden = definition.flow ?? [];

    if (vorhanden.some((kante) => kante.from === von && kante.to === nach)) {
        return definition;
    }

    const kante: Ablaufkante = {
        id: naechsteKennung(
            vorhanden.map((eintrag) => eintrag.id),
            'k',
        ),
        from: von,
        to: nach,
    };

    return { ...definition, flow: [...vorhanden, kante] };
}

/**
 * Entfernt, was zu einer Kante gehoert.
 *
 * Eine Kante vom Feld in die Regel loescht nur DIESE Pruefung; erst die
 * letzte nimmt die ganze Regel mit. Eine Regel ohne Pruefung waere sonst
 * dauerhaft unerfuellbar — und das Ziel damit fuer immer verborgen.
 */
export function kanteEntfernen(
    definition: FormularDefinition,
    kantenId: string,
): FormularDefinition {
    const flow = definition.flow ?? [];

    if (flow.some((kante) => kante.id === kantenId)) {
        const uebrig = flow.filter((kante) => kante.id !== kantenId);

        return uebrig.length > 0
            ? { ...definition, flow: uebrig }
            : ohneSchluessel(definition, 'flow');
    }

    const zielTrenner = kantenId.indexOf('__');

    if (zielTrenner < 1) {
        return definition;
    }

    const regelId = kantenId.slice(0, zielTrenner);
    const rest = kantenId.slice(zielTrenner + 2);

    // Die Kante zum Ziel ist die Regel selbst — ohne Ziel gibt es sie nicht.
    if (rest === 'ziel') {
        return regelEntfernen(definition, regelId);
    }

    const index = Number(rest.replace('test', ''));

    if (Number.isNaN(index)) {
        return definition;
    }

    const regeln = (definition.conditions ?? []).flatMap((regel) => {
        if (regel.id !== regelId) {
            return [regel];
        }

        const tests = regel.tests.filter((_, position) => position !== index);

        return tests.length > 0 ? [{ ...regel, tests }] : [];
    });

    return regeln.length > 0
        ? { ...definition, conditions: regeln }
        : ohneSchluessel(definition, 'conditions');
}

export function regelEntfernen(
    definition: FormularDefinition,
    regelId: string,
): FormularDefinition {
    const uebrig = (definition.conditions ?? []).filter(
        (regel) => regel.id !== regelId,
    );

    return uebrig.length > 0
        ? { ...definition, conditions: uebrig }
        : ohneSchluessel(definition, 'conditions');
}

/**
 * Entfernt einen Schluessel ganz, statt ihn leer stehen zu lassen.
 *
 * Ein `conditions: []` waere ein Unterschied in der gespeicherten Definition,
 * den niemand gemacht hat — und er taucht in jedem Vergleich auf.
 */
function ohneSchluessel(
    definition: FormularDefinition,
    schluessel: 'conditions' | 'flow',
): FormularDefinition {
    const kopie = { ...definition };
    delete kopie[schluessel];

    return kopie;
}
