import { layoutAufloesen } from './definition';
import type { AufgeloesterKnoten } from './definition';
import type { Bedingungsregel, FormularDefinition, Pruefung } from './types';

/**
 * Was von einem Formular bei diesem Antwortstand gilt.
 *
 * Bewusst hier und nicht in den Komponenten: dieselbe Aussage muss auf der
 * Serverseite noch einmal getroffen werden, und die Anwendung, die dieses
 * Paket einsetzt, kann Frontend-Verhalten oft gar nicht testen. Eine Regel,
 * die in einer React-Komponente wohnt, ist eine Regel, die es zweimal gibt.
 */
export interface Sichtbarkeit {
    sichtbareFelder: Set<string>;
    /**
     * Felder, die bei DIESEM Antwortstand Pflicht sind.
     *
     * Immer eine Teilmenge von `sichtbareFelder`. Ein verborgenes Pflichtfeld
     * waere ein Formular, das sich nicht abschicken laesst, ohne dass zu sehen
     * ist, woran es liegt.
     */
    pflichtFelder: Set<string>;
    sichtbareGruppen: Set<string>;
    sichtbareSchritte: Set<string>;
    /**
     * Regeln, die einander im Kreis bedingen.
     *
     * Sie werden NICHT ausgewertet — das Ziel behaelt seine Vorgabe und bleibt
     * damit sichtbar. Die andere Richtung waere schlimmer: ein Feld, das
     * niemand mehr ausfuellen kann, weil zwei Regeln sich gegenseitig
     * blockieren.
     */
    zyklen: string[];
}

/** Der Antwortstand, so wie er aus einem Formular kommt. */
export type Werte = Record<string, unknown>;

const MAX_DURCHLAEUFE = 50;

/**
 * Wertet alle Bedingungen gegen einen Antwortstand aus.
 *
 * Die Vorgaben ohne jede Regel: alles sichtbar, Pflicht ist, was am Feld
 * steht. Erst eine Regel weicht davon ab.
 *
 * Drei Entscheidungen, die man nicht raten sollte:
 *
 * 1. **Eine `show`-Regel dreht die Vorgabe um.** Sobald es fuer ein Ziel eine
 *    gibt, ist es verborgen, bis eine davon zutrifft. Ohne diese Umkehr waere
 *    „zeige X, wenn Y" wirkungslos — X waere ohnehin schon sichtbar.
 * 2. **Verbergen gewinnt.** Treffen `show` und `hide` zugleich zu, ist das
 *    Ziel verborgen. Ein Feld, das sichtbar ist, obwohl es niemand sehen
 *    sollte, sammelt Angaben ein, die nicht erhoben werden duerfen.
 * 3. **`optional` gewinnt ueber `require`.** Widersprechen sich zwei Regeln,
 *    ist der Ausgang „Feld ist freiwillig" — die andere Richtung waere ein
 *    Formular, das sich nicht absenden laesst.
 */
export function sichtbarkeit(
    definition: FormularDefinition,
    werte: Werte = {},
): Sichtbarkeit {
    const regeln = definition.conditions ?? [];
    const zyklen = zyklenFinden(regeln);
    const anwendbar = regeln.filter((regel) => !zyklen.includes(regel.id));

    const gruppen = kennungenSammeln(layoutAufloesen(definition), 'group');
    const schritte = kennungenSammeln(layoutAufloesen(definition), 'step');
    const elternschaft = elternKarte(layoutAufloesen(definition));
    const alleFelder = definition.fields.map((feld) => feld.name);

    let sichtbareFelder = new Set(alleFelder);
    let sichtbareGruppen = new Set(gruppen);
    let sichtbareSchritte = new Set(schritte);

    // Bis sich nichts mehr aendert: eine Bedingung kann auf ein Feld zeigen,
    // das selbst bedingt ist. Der Wert eines verborgenen Feldes zaehlt als
    // leer — genau so wirft ihn auch die Serverseite weg, und zwei
    // verschiedene Antworten auf „ist das gefuellt?" waeren der Fehler, den
    // niemand findet.
    for (let durchlauf = 0; durchlauf < MAX_DURCHLAEUFE; durchlauf++) {
        const naechste = einDurchlauf(
            anwendbar,
            werte,
            sichtbareFelder,
            new Set(alleFelder),
            new Set(gruppen),
            new Set(schritte),
        );

        // Die Vererbung gehoert IN die Schleife, nicht dahinter. Ein Feld in
        // einer verborgenen Gruppe ist verborgen — und eine Regel, die dieses
        // Feld prueft, muss es als leer lesen. Stuende die Vererbung erst
        // danach, laese der Browser den alten Wert weiter mit, waehrend der
        // Server ihn schon weggeworfen hat: dieselbe Definition, zwei
        // verschiedene Formulare.
        vererben(naechste, elternschaft, gruppen, schritte);

        const stabil =
            gleich(naechste.felder, sichtbareFelder) &&
            gleich(naechste.gruppen, sichtbareGruppen) &&
            gleich(naechste.schritte, sichtbareSchritte);

        sichtbareFelder = naechste.felder;
        sichtbareGruppen = naechste.gruppen;
        sichtbareSchritte = naechste.schritte;

        if (stabil) {
            break;
        }
    }

    return {
        sichtbareFelder,
        pflichtFelder: pflichtBestimmen(definition, anwendbar, werte, sichtbareFelder),
        sichtbareGruppen,
        sichtbareSchritte,
        zyklen,
    };
}

/**
 * Ein Feld in einem verborgenen Rahmen ist verborgen.
 *
 * Die Regel steht hier und nicht in jeder Bedingung: sonst muesste jeder, der
 * eine Gruppe ausblendet, dieselbe Regel von Hand auf jedes Feld darin
 * schreiben — und beim naechsten hinzugefuegten Feld vergisst er es.
 */
function vererben(
    stand: { felder: Set<string>; gruppen: Set<string>; schritte: Set<string> },
    elternschaft: Map<string, string[]>,
    alleGruppen: string[],
    alleSchritte: string[],
): void {
    for (const [feld, vorfahren] of elternschaft) {
        const versteckt = vorfahren.some(
            (kennung) =>
                (alleGruppen.includes(kennung) && !stand.gruppen.has(kennung)) ||
                (alleSchritte.includes(kennung) && !stand.schritte.has(kennung)),
        );

        if (versteckt) {
            stand.felder.delete(feld);
        }
    }
}

function einDurchlauf(
    regeln: Bedingungsregel[],
    werte: Werte,
    sichtbareFelder: Set<string>,
    alleFelder: Set<string>,
    alleGruppen: Set<string>,
    alleSchritte: Set<string>,
): { felder: Set<string>; gruppen: Set<string>; schritte: Set<string> } {
    const felder = new Set(alleFelder);
    const gruppen = new Set(alleGruppen);
    const schritte = new Set(alleSchritte);

    // Ein Ziel mit `show`-Regel startet verborgen.
    for (const regel of regeln) {
        if (regel.effect !== 'show') {
            continue;
        }

        mengeFuer(regel.target.kind, felder, gruppen, schritte).delete(regel.target.ref);
    }

    for (const regel of regeln) {
        if (regel.effect !== 'show' || !regelTrifftZu(regel, werte, sichtbareFelder)) {
            continue;
        }

        mengeFuer(regel.target.kind, felder, gruppen, schritte).add(regel.target.ref);
    }

    // Zuletzt, damit Verbergen gewinnt.
    for (const regel of regeln) {
        if (regel.effect !== 'hide' || !regelTrifftZu(regel, werte, sichtbareFelder)) {
            continue;
        }

        mengeFuer(regel.target.kind, felder, gruppen, schritte).delete(regel.target.ref);
    }

    return { felder, gruppen, schritte };
}

function pflichtBestimmen(
    definition: FormularDefinition,
    regeln: Bedingungsregel[],
    werte: Werte,
    sichtbareFelder: Set<string>,
): Set<string> {
    const pflicht = new Set(
        definition.fields
            .filter((feld) => feld.required === true)
            .map((feld) => feld.name),
    );

    for (const regel of regeln) {
        if (
            regel.effect !== 'require' ||
            regel.target.kind !== 'field' ||
            !regelTrifftZu(regel, werte, sichtbareFelder)
        ) {
            continue;
        }

        pflicht.add(regel.target.ref);
    }

    for (const regel of regeln) {
        if (
            regel.effect !== 'optional' ||
            regel.target.kind !== 'field' ||
            !regelTrifftZu(regel, werte, sichtbareFelder)
        ) {
            continue;
        }

        pflicht.delete(regel.target.ref);
    }

    // Was niemand sieht, kann niemand ausfuellen.
    for (const name of [...pflicht]) {
        if (!sichtbareFelder.has(name)) {
            pflicht.delete(name);
        }
    }

    return pflicht;
}

function mengeFuer(
    art: Bedingungsregel['target']['kind'],
    felder: Set<string>,
    gruppen: Set<string>,
    schritte: Set<string>,
): Set<string> {
    if (art === 'group') {
        return gruppen;
    }

    if (art === 'step') {
        return schritte;
    }

    return felder;
}

function regelTrifftZu(
    regel: Bedingungsregel,
    werte: Werte,
    sichtbareFelder: Set<string>,
): boolean {
    if (regel.tests.length === 0) {
        return false;
    }

    const treffer = regel.tests.map((pruefung) =>
        pruefungTrifftZu(pruefung, werte, sichtbareFelder),
    );

    return regel.match === 'any' ? treffer.some(Boolean) : treffer.every(Boolean);
}

function pruefungTrifftZu(
    pruefung: Pruefung,
    werte: Werte,
    sichtbareFelder: Set<string>,
): boolean {
    const wert = wertLesen(pruefung.field, werte, sichtbareFelder);
    const vergleich = pruefung.value ?? '';

    switch (pruefung.op) {
        case 'is':
            return wert === vergleich;
        case 'is_not':
            return wert !== vergleich;
        case 'contains':
            return vergleich !== '' && wert.includes(vergleich);
        case 'not_contains':
            return vergleich === '' || !wert.includes(vergleich);
        case 'filled':
            return wert !== '';
        case 'empty':
            return wert === '';
        case 'gt':
        case 'lt': {
            // Nur Zahlen. Ein Groessenvergleich auf Text sieht im Editor
            // richtig aus und liefert im Formular Ergebnisse, die niemand
            // vorhersagt ('10' < '9').
            const links = Number(wert);
            const rechts = Number(vergleich);

            if (wert === '' || vergleich === '' || Number.isNaN(links) || Number.isNaN(rechts)) {
                return false;
            }

            return pruefung.op === 'gt' ? links > rechts : links < rechts;
        }
        default:
            return false;
    }
}

/**
 * Der Wert eines Feldes als Text — und leer, wenn das Feld verborgen ist.
 *
 * Die zweite Haelfte ist die wichtige: die Serverseite wirft die Werte
 * verborgener Felder weg. Zaehlte hier der alte Inhalt eines inzwischen
 * ausgeblendeten Feldes weiter mit, entschieden Browser und Server
 * verschieden darueber, was sichtbar ist.
 */
function wertLesen(
    name: string,
    werte: Werte,
    sichtbareFelder: Set<string>,
): string {
    if (!sichtbareFelder.has(name)) {
        return '';
    }

    const roh = werte[name];

    if (roh === null || roh === undefined || roh === false) {
        return '';
    }

    if (roh === true) {
        return '1';
    }

    return String(roh);
}

/**
 * Regeln, die einander im Kreis bedingen.
 *
 * Eine Kante laeuft vom geprueften Feld zum Ziel der Regel: „X entscheidet
 * ueber Y". Fuehrt vom Ziel ein Weg zurueck zum geprueften Feld, haengt die
 * Regel in einem Kreis — es gibt keinen Antwortstand, bei dem sie stabil
 * erfuellt ist.
 *
 * Bewusst je Kante gefragt statt einmal quer durch den Graphen gelaufen: eine
 * Tiefensuche mit Merkliste findet je nach Startpunkt nur EINE der beteiligten
 * Regeln, und welche das ist, haengt an der Reihenfolge der Eintraege. Ein
 * Ergebnis, das von der Speicherreihenfolge abhaengt, ist beim naechsten
 * Umsortieren ein anderes.
 */
function zyklenFinden(regeln: Bedingungsregel[]): string[] {
    const nachfolger = new Map<string, string[]>();
    const kanten: { von: string; nach: string; regel: string }[] = [];

    for (const regel of regeln) {
        for (const pruefung of regel.tests) {
            kanten.push({
                von: pruefung.field,
                nach: regel.target.ref,
                regel: regel.id,
            });
            nachfolger.set(pruefung.field, [
                ...(nachfolger.get(pruefung.field) ?? []),
                regel.target.ref,
            ]);
        }
    }

    const erreichbar = (start: string, ziel: string): boolean => {
        const offen = [start];
        const gesehen = new Set<string>();

        while (offen.length > 0) {
            const knoten = offen.pop()!;

            if (knoten === ziel) {
                return true;
            }

            if (gesehen.has(knoten)) {
                continue;
            }

            gesehen.add(knoten);
            offen.push(...(nachfolger.get(knoten) ?? []));
        }

        return false;
    };

    const betroffen = new Set<string>();

    for (const kante of kanten) {
        // `von === nach`: „zeige A, wenn A gefuellt ist" — dieselbe Sackgasse,
        // nur ohne Umweg.
        if (kante.von === kante.nach || erreichbar(kante.nach, kante.von)) {
            betroffen.add(kante.regel);
        }
    }

    return [...betroffen].sort();
}

function kennungenSammeln(
    knoten: AufgeloesterKnoten[],
    art: 'group' | 'step',
): string[] {
    return knoten.flatMap((eintrag) => {
        if (eintrag.type === 'group' || eintrag.type === 'step') {
            const eigene = eintrag.type === art ? [eintrag.id] : [];

            return [...eigene, ...kennungenSammeln(eintrag.children, art)];
        }

        return [];
    });
}

/** Feldname → Kennungen aller Rahmen darueber, von aussen nach innen. */
function elternKarte(
    knoten: AufgeloesterKnoten[],
    vorfahren: string[] = [],
    karte: Map<string, string[]> = new Map(),
): Map<string, string[]> {
    for (const eintrag of knoten) {
        if (eintrag.type === 'row') {
            for (const feld of eintrag.columns.flat()) {
                karte.set(feld.name, vorfahren);
            }
            continue;
        }

        if (eintrag.type === 'group' || eintrag.type === 'step') {
            elternKarte(eintrag.children, [...vorfahren, eintrag.id], karte);
        }
    }

    return karte;
}

function gleich(a: Set<string>, b: Set<string>): boolean {
    return a.size === b.size && [...a].every((eintrag) => b.has(eintrag));
}
