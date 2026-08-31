import { describe, expect, it } from 'vitest';

import {
    feldInRahmen,
    rahmenAendern,
    rahmenEntfernen,
    rahmenHinzufuegen,
    rahmenListe,
    rahmenVonFeld,
} from '../bearbeiten';
import { felderInReihenfolge, layoutAufloesen } from '../definition';
import type { FormularDefinition, FormularFeld } from '../types';

const feld = (name: string): FormularFeld => ({ name, label: name, type: 'text' });

const mitGruppe: FormularDefinition = {
    fields: [feld('a'), feld('b')],
    layout: [
        {
            type: 'group',
            id: 'g1',
            title: 'Anreise',
            children: [{ type: 'row', columns: [['a']] }],
        },
        { type: 'row', columns: [['b']] },
    ],
};

describe('Rahmen anlegen', () => {
    it('legt eine leere Gruppe an', () => {
        const danach = rahmenHinzufuegen({ fields: [feld('a')] }, 'group', 'Anreise');

        expect(rahmenListe(danach)).toEqual([
            { id: 'g1', art: 'group', titel: 'Anreise' },
        ]);
    });

    it('zeigt einen leeren Rahmen im Editor, aber nicht im Formular', () => {
        // Wer eine Gruppe anlegt, hat sie zuerst leer. Ein Rahmen, der erst
        // beim ersten Feld erscheint, laesst sich nicht befuellen — im
        // fertigen Formular waere derselbe Rahmen dagegen eine leere
        // Umrandung mit Ueberschrift.
        const danach = rahmenHinzufuegen({ fields: [feld('a')] }, 'group', 'Anreise');

        expect(layoutAufloesen(danach).some((k) => k.type === 'group')).toBe(false);
        expect(
            layoutAufloesen(danach, { leereRahmenBehalten: true }).some(
                (k) => k.type === 'group',
            ),
        ).toBe(true);
    });

    it('vergibt keine Kennung zweimal, auch nicht über Ebenen hinweg', () => {
        const einmal = rahmenHinzufuegen(mitGruppe, 'group', 'Zweite');
        const zweimal = rahmenHinzufuegen(einmal, 'step', 'Erster Schritt');

        const kennungen = rahmenListe(zweimal).map((r) => r.id);

        expect(new Set(kennungen).size).toBe(kennungen.length);
    });
});

describe('Rahmen auflösen', () => {
    it('lässt die Felder stehen', () => {
        // Der wichtigste Satz an dieser Stelle: ein Rahmen ist Darstellung,
        // ein Feld ist ein Datenschlüssel, unter dem Antworten liegen.
        const danach = rahmenEntfernen(mitGruppe, 'g1');

        expect(rahmenListe(danach)).toEqual([]);
        expect(felderInReihenfolge(danach).map((f) => f.name)).toEqual(['a', 'b']);
    });

    it('nimmt Bedingungen mit, die auf den Rahmen zeigten', () => {
        // Sie hätten sonst ein Ziel, das es nicht mehr gibt, und träfen
        // still nie zu.
        const mitRegel: FormularDefinition = {
            ...mitGruppe,
            conditions: [
                {
                    id: 'r1',
                    target: { kind: 'group', ref: 'g1' },
                    effect: 'show',
                    match: 'all',
                    tests: [{ field: 'b', op: 'filled' }],
                },
            ],
        };

        expect(rahmenEntfernen(mitRegel, 'g1')).not.toHaveProperty('conditions');
    });

    it('lässt Bedingungen stehen, die andere Ziele haben', () => {
        const mitRegel: FormularDefinition = {
            ...mitGruppe,
            conditions: [
                {
                    id: 'r1',
                    target: { kind: 'field', ref: 'a' },
                    effect: 'show',
                    match: 'all',
                    tests: [{ field: 'b', op: 'filled' }],
                },
            ],
        };

        expect(rahmenEntfernen(mitRegel, 'g1').conditions).toHaveLength(1);
    });
});

describe('Feld einem Rahmen zuordnen', () => {
    it('verschiebt ein freies Feld hinein', () => {
        const danach = feldInRahmen(mitGruppe, 'b', 'g1');

        expect(rahmenVonFeld(danach, 'b')).toBe('g1');
        expect(rahmenVonFeld(danach, 'a')).toBe('g1');
    });

    it('holt ein Feld wieder heraus', () => {
        // Ohne das rekursive Entfernen bliebe das Feld in der Gruppe stehen
        // und läge danach zweimal im Baum — sichtbar wäre das erste
        // Vorkommen, die Bewegung sähe aus, als wäre sie nicht passiert.
        const danach = feldInRahmen(mitGruppe, 'a', null);

        expect(rahmenVonFeld(danach, 'a')).toBeNull();
        expect(felderInReihenfolge(danach).map((f) => f.name).sort()).toEqual(['a', 'b']);
    });

    it('zeigt ein Feld nur einmal, auch nach mehrfachem Verschieben', () => {
        let stand = feldInRahmen(mitGruppe, 'b', 'g1');
        stand = feldInRahmen(stand, 'b', null);
        stand = feldInRahmen(stand, 'b', 'g1');

        const namen = felderInReihenfolge(stand).map((f) => f.name);

        expect(namen).toEqual(['a', 'b']);
    });

    it('verschluckt ein Feld nicht, wenn der Rahmen nicht existiert', () => {
        const danach = feldInRahmen(mitGruppe, 'b', 'gibtsnicht');

        expect(felderInReihenfolge(danach).map((f) => f.name)).toContain('b');
    });

    it('behält Bedingungen und Anordnung', () => {
        const voll: FormularDefinition = {
            ...mitGruppe,
            conditions: [
                {
                    id: 'r1',
                    target: { kind: 'field', ref: 'a' },
                    effect: 'show',
                    match: 'all',
                    tests: [{ field: 'b', op: 'filled' }],
                },
            ],
            graph: { positions: { 'feld:a': { x: 1, y: 2 } } },
        };

        const danach = feldInRahmen(voll, 'b', 'g1');

        expect(danach.conditions).toEqual(voll.conditions);
        expect(danach.graph).toEqual(voll.graph);
    });
});

describe('Rahmen umbenennen', () => {
    it('ändert den Titel und lässt den Inhalt in Ruhe', () => {
        const danach = rahmenAendern(mitGruppe, 'g1', { title: 'Hotel' });

        expect(rahmenListe(danach)[0]!.titel).toBe('Hotel');
        expect(rahmenVonFeld(danach, 'a')).toBe('g1');
    });
});
