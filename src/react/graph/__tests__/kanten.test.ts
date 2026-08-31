import { describe, expect, it } from 'vitest';

import type { FormularDefinition, FormularFeld } from '../../../core';
import {
    kanteEntfernen,
    kantenAusDefinition,
    regelAnlegen,
    regelEntfernen,
    regelKnoten,
    verbindungVerarbeiten,
} from '../kanten';

const feld = (name: string): FormularFeld => ({ name, label: name, type: 'text' });

const mitRegel: FormularDefinition = {
    fields: [feld('a'), feld('b'), feld('ziel')],
    conditions: [
        {
            id: 'r1',
            target: { kind: 'field', ref: 'ziel' },
            effect: 'show',
            match: 'all',
            tests: [
                { field: 'a', op: 'is', value: 'ja' },
                { field: 'b', op: 'filled' },
            ],
        },
    ],
};

describe('kantenAusDefinition', () => {
    it('fuehrt jede Pruefung in die Regel und die Regel ans Ziel', () => {
        const kanten = kantenAusDefinition(mitRegel);

        expect(kanten).toHaveLength(3);
        expect(kanten.filter((k) => k.ziel === 'regel:r1')).toHaveLength(2);
        expect(kanten.find((k) => k.quelle === 'regel:r1')?.ziel).toBe('feld:ziel');
    });

    it('schreibt die Pruefung lesbar an die Kante', () => {
        // Wer im Graphen sucht, warum ein Feld verschwindet, soll es an der
        // Kante sehen und nicht erst anklicken muessen.
        const kanten = kantenAusDefinition(mitRegel);

        expect(kanten[0]!.beschriftung).toBe('a ist „ja“');
        expect(kanten[1]!.beschriftung).toBe('b ist ausgefüllt');
    });

    it('markiert die Kanten einer Regel, die im Kreis haengt', () => {
        const kanten = kantenAusDefinition(mitRegel, ['r1']);

        expect(kanten.every((k) => k.imKreis)).toBe(true);
        expect(regelKnoten(mitRegel, ['r1'])[0]!.imKreis).toBe(true);
    });
});

describe('verbindungVerarbeiten', () => {
    const schlicht: FormularDefinition = { fields: [feld('a'), feld('b')] };

    it('macht aus Feld auf Ziel eine Zeigen-Regel', () => {
        // Die Geste, die fast jeder zuerst braucht: „zeige das, wenn hier
        // etwas steht". Verfeinern laesst sie sich danach.
        const danach = verbindungVerarbeiten(schlicht, 'feld:a', 'feld:b')!;

        expect(danach.conditions).toHaveLength(1);
        expect(danach.conditions![0]).toMatchObject({
            target: { kind: 'field', ref: 'b' },
            effect: 'show',
            tests: [{ field: 'a', op: 'filled' }],
        });
    });

    it('macht aus Schritt auf Schritt einen unbedingten Weg', () => {
        const mitSchritten: FormularDefinition = {
            fields: [feld('a'), feld('b')],
            layout: [
                { type: 'step', id: 's1', children: [{ type: 'row', columns: [['a']] }] },
                { type: 'step', id: 's2', children: [{ type: 'row', columns: [['b']] }] },
            ],
        };

        const danach = verbindungVerarbeiten(mitSchritten, 'schritt:s1', 'schritt:s2')!;

        expect(danach.flow).toEqual([{ id: 'k1', from: 's1', to: 's2' }]);
    });

    it('macht aus einer Kante auf sich selbst gar nichts', () => {
        // Sie waere sofort ein Kreis — und der Editor haette ihn gerade erst
        // gebaut.
        expect(verbindungVerarbeiten(schlicht, 'feld:a', 'feld:a')).toBeNull();
    });

    it('macht aus einer Verbindung ohne Bedeutung gar nichts', () => {
        expect(verbindungVerarbeiten(schlicht, 'regel:r1', 'feld:a')).toBeNull();
        expect(verbindungVerarbeiten(schlicht, 'kaputt', 'feld:a')).toBeNull();
    });

    it('legt dieselbe Verbindung nicht zweimal an', () => {
        const einmal = verbindungVerarbeiten(schlicht, 'feld:a', 'feld:b')!;
        const zweimal = verbindungVerarbeiten(einmal, 'feld:a', 'feld:b')!;

        expect(zweimal.conditions).toHaveLength(1);
    });
});

describe('kanteEntfernen', () => {
    it('nimmt nur die eine Pruefung, nicht die ganze Regel', () => {
        const danach = kanteEntfernen(mitRegel, 'r1__test0');

        expect(danach.conditions![0]!.tests).toEqual([{ field: 'b', op: 'filled' }]);
    });

    it('nimmt die Regel mit, wenn die letzte Pruefung faellt', () => {
        // Eine Regel ohne Pruefung waere dauerhaft unerfuellbar — und ihr
        // Ziel damit fuer immer verborgen.
        const einePruefung: FormularDefinition = {
            ...mitRegel,
            conditions: [{ ...mitRegel.conditions![0]!, tests: [{ field: 'a', op: 'filled' }] }],
        };

        expect(kanteEntfernen(einePruefung, 'r1__test0')).not.toHaveProperty('conditions');
    });

    it('nimmt bei der Ziel-Kante die ganze Regel', () => {
        expect(kanteEntfernen(mitRegel, 'r1__ziel')).not.toHaveProperty('conditions');
    });

    it('entfernt eine Ablaufkante', () => {
        const mitFluss: FormularDefinition = {
            fields: [feld('a')],
            flow: [
                { id: 'k1', from: 's1', to: 's2' },
                { id: 'k2', from: 's2', to: 's3' },
            ],
        };

        expect(kanteEntfernen(mitFluss, 'k1').flow).toEqual([
            { id: 'k2', from: 's2', to: 's3' },
        ]);
    });
});

describe('Kennungen neuer Regeln', () => {
    it('greift nach dem Loeschen nicht auf eine vergebene Kennung', () => {
        // Hochzaehlen ueber die Anzahl traefe `r2`, sobald `r1` geloescht
        // wurde — und zwei Regeln mit derselben Kennung sind eine.
        const zwei = regelAnlegen(
            regelAnlegen({ fields: [feld('a'), feld('b')] }, 'a', {
                kind: 'field',
                ref: 'b',
            }),
            'b',
            { kind: 'field', ref: 'a' },
        );

        const ohneErste = regelEntfernen(zwei, 'r1');
        const dritte = regelAnlegen(ohneErste, 'a', { kind: 'field', ref: 'b' });

        const kennungen = dritte.conditions!.map((regel) => regel.id);

        expect(new Set(kennungen).size).toBe(kennungen.length);
    });
});
