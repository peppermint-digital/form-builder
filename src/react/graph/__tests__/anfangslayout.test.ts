import { describe, expect, it } from 'vitest';

import type { FormularDefinition, FormularFeld } from '../../../core';
import { knotenAusDefinition, unterkanteVon, type GraphKnoten } from '../anordnung';
import { regelKnoten } from '../kanten';

const feld = (name: string): FormularFeld => ({ name, label: name, type: 'text' });

const finde = (knoten: GraphKnoten[], id: string) =>
    knoten.find((eintrag) => eintrag.id === id)!;

/**
 * Ueberschneiden sich zwei Knoten derselben Ebene?
 *
 * Die Zusicherung, an der die ganze Anordnung haengt: ein Knoten, der unter
 * einem anderen liegt, ist nicht anklickbar — und der Editor sieht aus, als
 * fehle die Haelfte des Formulars.
 */
function ueberschneidungen(knoten: GraphKnoten[]): string[] {
    const treffer: string[] = [];

    for (const [index, a] of knoten.entries()) {
        for (const b of knoten.slice(index + 1)) {
            if (a.parentId !== b.parentId) {
                continue;
            }

            const getrennt =
                a.position.x + a.breite <= b.position.x ||
                b.position.x + b.breite <= a.position.x ||
                a.position.y + a.hoehe <= b.position.y ||
                b.position.y + b.hoehe <= a.position.y;

            if (!getrennt) {
                treffer.push(`${a.id} ↔ ${b.id}`);
            }
        }
    }

    return treffer;
}

describe('Anfangslayout', () => {
    it('legt die Spalten einer Zeile nebeneinander', () => {
        // „Vorname | Nachname" steht im Graphen so, wie es im Formular steht.
        const knoten = knotenAusDefinition({
            fields: [feld('vorname'), feld('nachname')],
            layout: [{ type: 'row', columns: [['vorname'], ['nachname']] }],
        });

        const links = finde(knoten, 'feld:vorname');
        const rechts = finde(knoten, 'feld:nachname');

        expect(links.position.y).toBe(rechts.position.y);
        expect(rechts.position.x).toBeGreaterThan(links.position.x);
    });

    it('stapelt Zeilen untereinander', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b')],
            layout: [
                { type: 'row', columns: [['a']] },
                { type: 'row', columns: [['b']] },
            ],
        });

        expect(finde(knoten, 'feld:b').position.y).toBeGreaterThan(
            finde(knoten, 'feld:a').position.y,
        );
        expect(finde(knoten, 'feld:b').position.x).toBe(
            finde(knoten, 'feld:a').position.x,
        );
    });

    it('stellt Schritte nebeneinander — in Richtung der Verzweigungspfeile', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b')],
            layout: [
                { type: 'step', id: 's1', children: [{ type: 'row', columns: [['a']] }] },
                { type: 'step', id: 's2', children: [{ type: 'row', columns: [['b']] }] },
            ],
        });

        const erster = finde(knoten, 'schritt:s1');
        const zweiter = finde(knoten, 'schritt:s2');

        expect(zweiter.position.x).toBeGreaterThanOrEqual(
            erster.position.x + erster.breite,
        );
        expect(zweiter.position.y).toBe(erster.position.y);
    });

    it('stapelt ein Bestandsformular ohne Schritte, wie man es liest', () => {
        // Der haeufigste Fall ueberhaupt: keine Schritte, kein Layout, kein
        // `graph`. Er soll aussehen wie das Formular, das er ist.
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b'), feld('c')],
        });

        expect(knoten.map((k) => k.position.x)).toEqual([
            knoten[0]!.position.x,
            knoten[0]!.position.x,
            knoten[0]!.position.x,
        ]);
        expect(knoten[2]!.position.y).toBeGreaterThan(knoten[1]!.position.y);
    });

    it('stapelt innerhalb eines Rahmens auch dann, wenn aussen waagerecht laeuft', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b')],
            layout: [
                {
                    type: 'step',
                    id: 's1',
                    children: [
                        { type: 'row', columns: [['a']] },
                        { type: 'row', columns: [['b']] },
                    ],
                },
            ],
        });

        expect(finde(knoten, 'feld:b').position.y).toBeGreaterThan(
            finde(knoten, 'feld:a').position.y,
        );
    });

    it('laesst keine zwei Knoten derselben Ebene uebereinander liegen', () => {
        // Ein verdeckter Knoten ist nicht anklickbar, und der Editor sieht
        // aus, als fehle die Haelfte des Formulars.
        const verschachtelt: FormularDefinition = {
            fields: [feld('a'), feld('b'), feld('c'), feld('d'), feld('lose')],
            layout: [
                {
                    type: 'step',
                    id: 's1',
                    title: 'Person',
                    children: [
                        { type: 'row', columns: [['a'], ['b']] },
                        {
                            type: 'group',
                            id: 'g1',
                            title: 'Anschrift',
                            children: [{ type: 'row', columns: [['c']] }],
                        },
                    ],
                },
                {
                    type: 'step',
                    id: 's2',
                    title: 'Anreise',
                    children: [{ type: 'row', columns: [['d']] }],
                },
            ],
        };

        expect(ueberschneidungen(knotenAusDefinition(verschachtelt))).toEqual([]);
    });

    it('haelt einen Rahmen gross genug fuer alles darin', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b')],
            layout: [
                {
                    type: 'group',
                    id: 'g1',
                    children: [{ type: 'row', columns: [['a'], ['b']] }],
                },
            ],
        });

        const rahmen = finde(knoten, 'gruppe:g1');
        const kinder = knoten.filter((k) => k.parentId === rahmen.id);

        for (const kind of kinder) {
            expect(kind.position.x + kind.breite).toBeLessThanOrEqual(rahmen.breite);
            expect(kind.position.y + kind.hoehe).toBeLessThanOrEqual(rahmen.hoehe);
        }
    });

    it('legt die Regeln unter die Struktur, nicht mitten hinein', () => {
        const definition: FormularDefinition = {
            fields: [feld('a'), feld('b')],
            layout: [
                { type: 'step', id: 's1', children: [{ type: 'row', columns: [['a']] }] },
                { type: 'step', id: 's2', children: [{ type: 'row', columns: [['b']] }] },
            ],
            conditions: [
                {
                    id: 'r1',
                    target: { kind: 'field', ref: 'b' },
                    effect: 'show',
                    match: 'all',
                    tests: [{ field: 'a', op: 'filled' }],
                },
            ],
        };

        const struktur = knotenAusDefinition(definition);
        const unterkante = unterkanteVon(struktur);
        const regeln = regelKnoten(definition, [], unterkante);

        const tiefste = Math.max(
            ...struktur
                .filter((k) => k.parentId === undefined)
                .map((k) => k.position.y + k.hoehe),
        );

        expect(regeln[0]!.position.y).toBeGreaterThanOrEqual(tiefste);
    });
});
