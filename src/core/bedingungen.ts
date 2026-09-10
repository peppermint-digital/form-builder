import type {
    Bedingungsregel,
    FormularDefinition,
    Pruefung,
    Vergleich,
    Wirkung,
} from './types';

/**
 * Die Handgriffe an den Bedingungen — als DATENarbeit, nicht als Graphik.
 *
 * Sie lagen bis zum 10.09.2026 in `react/graph/kanten.ts`. Dort gehoerten sie
 * nur zur Haelfte hin: „welche Kante entspricht dieser Regel" ist Graphik,
 * „lege eine Regel an" ist es nicht. Solange beides zusammenlag, konnte eine
 * zweite Ansicht die Regeln nur bedienen, indem sie den Graph-Einstiegspunkt
 * importiert — und damit React Flow mitzieht, das sie gar nicht braucht.
 *
 * Der Graph benutzt sie unveraendert weiter. Es gibt keine zweite Fassung.
 */

/**
 * Die naechste freie Regel-Kennung.
 *
 * Ueber die vergebenen und nicht ueber `length`: Nach dem Loeschen einer Regel
 * traefe `r{n+1}` eine, die es schon gibt — und zwei Regeln mit derselben
 * Kennung sind im Graphen ein Knoten.
 */
export function naechsteRegelkennung(vergeben: string[]): string {
    let nummer = 1;

    while (vergeben.includes(`r${nummer}`)) {
        nummer++;
    }

    return `r${nummer}`;
}

/**
 * Legt eine Regel an: „zeige ZIEL, wenn FELD …".
 *
 * Die Vorgabe ist `show` mit `filled` — „sobald das Feld beantwortet ist".
 * Das ist die haeufigste Absicht und die einzige, die ohne einen
 * Vergleichswert auskommt; alles Schaerfere wird danach eingestellt.
 *
 * Dieselbe Verbindung zweimal anzulegen erzeugt KEINE zweite Regel. Sie waere
 * deckungsgleich, im Graphen nicht zu unterscheiden und in der Liste eine
 * Zeile, die man nur loeschen kann, indem man raet, welche der beiden gemeint
 * ist.
 */
export function regelAnlegen(
    definition: FormularDefinition,
    feld: string,
    ziel: Bedingungsregel['target'],
): FormularDefinition {
    const vorhanden = definition.conditions ?? [];

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
        id: naechsteRegelkennung(vorhanden.map((eintrag) => eintrag.id)),
        target: ziel,
        effect: 'show',
        match: 'all',
        tests: [{ field: feld, op: 'filled' }],
    };

    return { ...definition, conditions: [...vorhanden, regel] };
}

/** Aendert Wirkung oder Verknuepfung einer Regel. */
export function regelAendern(
    definition: FormularDefinition,
    regelId: string,
    aenderungen: { effect?: Wirkung; match?: 'all' | 'any' },
): FormularDefinition {
    const regeln = (definition.conditions ?? []).map((regel) =>
        regel.id === regelId ? { ...regel, ...aenderungen } : regel,
    );

    return { ...definition, conditions: regeln };
}

/**
 * Aendert eine einzelne Pruefung einer Regel.
 *
 * `filled` und `empty` tragen keinen Vergleichswert. Wer auf sie umstellt,
 * verliert den getippten Wert — und wer zurueckstellt, faengt bei leer an. Das
 * ist richtig so: Ein `value`, der neben `filled` stehenbleibt, ist eine
 * Angabe, die nichts bedeutet und die der naechste Leser anders auslegt.
 */
export function pruefungAendern(
    definition: FormularDefinition,
    regelId: string,
    index: number,
    aenderungen: { field?: string; op?: Vergleich; value?: string },
): FormularDefinition {
    const regeln = (definition.conditions ?? []).map((regel) => {
        if (regel.id !== regelId) {
            return regel;
        }

        const tests = regel.tests.map((pruefung, position) => {
            if (position !== index) {
                return pruefung;
            }

            const neu: Pruefung = { ...pruefung, ...aenderungen };

            if (neu.op === 'filled' || neu.op === 'empty') {
                delete neu.value;
            }

            return neu;
        });

        return { ...regel, tests };
    });

    return { ...definition, conditions: regeln };
}

/** Haengt eine weitere Pruefung an eine Regel. */
export function pruefungAnlegen(
    definition: FormularDefinition,
    regelId: string,
    feld: string,
): FormularDefinition {
    const regeln = (definition.conditions ?? []).map((regel) =>
        regel.id === regelId
            ? { ...regel, tests: [...regel.tests, { field: feld, op: 'filled' as Vergleich }] }
            : regel,
    );

    return { ...definition, conditions: regeln };
}

/**
 * Entfernt eine Pruefung — und mit der letzten die ganze Regel.
 *
 * Eine Regel ohne Pruefung waere eine Bedingung, die immer zutrifft. Sie
 * stehenzulassen hiesse, ein Feld dauerhaft ein- oder auszublenden, ohne dass
 * irgendwo steht, warum.
 */
export function pruefungEntfernen(
    definition: FormularDefinition,
    regelId: string,
    index: number,
): FormularDefinition {
    const regeln = (definition.conditions ?? []).flatMap((regel) => {
        if (regel.id !== regelId) {
            return [regel];
        }

        const tests = regel.tests.filter((_, position) => position !== index);

        return tests.length > 0 ? [{ ...regel, tests }] : [];
    });

    return aufraeumen(definition, regeln);
}

export function regelEntfernen(
    definition: FormularDefinition,
    regelId: string,
): FormularDefinition {
    return aufraeumen(
        definition,
        (definition.conditions ?? []).filter((regel) => regel.id !== regelId),
    );
}

/**
 * Alle Regeln, die auf dieses Ziel wirken.
 *
 * Fuer eine Ansicht, die Bedingungen AN DER FRAGE zeigt statt als Kante: Sie
 * fragt „was entscheidet ueber diese Frage?" und nicht „welche Kanten gibt es?".
 */
export function regelnFuerZiel(
    definition: FormularDefinition,
    art: Bedingungsregel['target']['kind'],
    ref: string,
): Bedingungsregel[] {
    return (definition.conditions ?? []).filter(
        (regel) => regel.target.kind === art && regel.target.ref === ref,
    );
}

/**
 * Ein `conditions: []` waere ein Unterschied in der gespeicherten Definition,
 * den niemand gemacht hat — und er taucht in jedem Vergleich auf.
 */
function aufraeumen(
    definition: FormularDefinition,
    regeln: Bedingungsregel[],
): FormularDefinition {
    if (regeln.length > 0) {
        return { ...definition, conditions: regeln };
    }

    const kopie = { ...definition };
    delete kopie.conditions;

    return kopie;
}
