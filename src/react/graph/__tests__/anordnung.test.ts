import { describe, expect, it } from 'vitest';

import type { FormularDefinition, FormularFeld } from '../../../core';
import {
    anordnungVergessen,
    groesseSchreiben,
    knotenAusDefinition,
    MASSE,
    positionenSchreiben,
} from '../anordnung';
import { knotenId } from '../kennung';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

describe('knotenAusDefinition', () => {
    it('macht aus jedem Feld einen Knoten', () => {
        const knoten = knotenAusDefinition({ fields: [feld('a'), feld('b')] });

        // Mit Praefix: ein Feld `g1` und eine Gruppe `g1` sind zwei Dinge.
        // Ohne waeren sie im Graphen ein einziger Knoten.
        expect(knoten.map((k) => k.id)).toEqual(['feld:a', 'feld:b']);
        expect(knoten.map((k) => k.ref)).toEqual(['a', 'b']);
        expect(knoten.every((k) => k.art === 'feld')).toBe(true);
    });

    it('haelt Feld und Gruppe mit gleichem Namen auseinander', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('g1')],
            layout: [
                { type: 'group', id: 'g1', children: [{ type: 'row', columns: [['g1']] }] },
            ],
        });

        const kennungen = knoten.map((k) => k.id);

        expect(new Set(kennungen).size).toBe(kennungen.length);
        expect(kennungen).toContain('feld:g1');
        expect(kennungen).toContain('gruppe:g1');
    });

    it('ordnet dieselbe Definition immer gleich an', () => {
        // Ohne diese Zusicherung springt der Editor bei jedem Oeffnen — und
        // wer eine Anordnung von Hand gebaut hat, findet sie nicht wieder.
        const definition: FormularDefinition = { fields: [feld('a'), feld('b')] };

        expect(knotenAusDefinition(definition)).toEqual(
            knotenAusDefinition(definition),
        );
    });

    it('haengt Felder einer Gruppe an den Rahmen', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('a')],
            layout: [
                {
                    type: 'group',
                    id: 'g1',
                    title: 'Anreise',
                    children: [{ type: 'row', columns: [['a']] }],
                },
            ],
        });

        expect(knoten.find((k) => k.id === 'gruppe:g1')?.art).toBe('gruppe');
        expect(knoten.find((k) => k.id === 'feld:a')?.parentId).toBe('gruppe:g1');
    });

    it('macht den Rahmen gross genug fuer seinen Inhalt', () => {
        // React Flow haelt Kinder mit `extent: parent` innerhalb der Flaeche
        // des Rahmens. Ist die zu klein, laesst sich ein Knoten nicht mehr
        // dorthin ziehen, wo er hingehoert — und es sieht aus, als haenge der
        // Editor.
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b')],
            layout: [
                {
                    type: 'group',
                    id: 'g1',
                    children: [
                        { type: 'row', columns: [['a']] },
                        { type: 'row', columns: [['b']] },
                    ],
                },
            ],
        });

        const rahmen = knoten.find((k) => k.id === 'gruppe:g1')!;
        const unterstes = knoten.find((k) => k.id === 'feld:b')!;

        expect(rahmen.hoehe).toBeGreaterThanOrEqual(
            unterstes.position.y + unterstes.hoehe,
        );
        expect(rahmen.breite).toBeGreaterThanOrEqual(
            unterstes.position.x + unterstes.breite,
        );
    });

    it('laesst gespeicherten Positionen den Vortritt', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('a')],
            graph: { positions: { [knotenId('feld', 'a')]: { x: 500, y: 300 } } },
        });

        expect(knoten[0]!.position).toEqual({ x: 500, y: 300 });
    });

    it('kennt Schritte als eigene Rahmenart', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('a')],
            layout: [
                { type: 'step', id: 's1', children: [{ type: 'row', columns: [['a']] }] },
            ],
        });

        expect(knoten.find((k) => k.id === 'schritt:s1')?.art).toBe('schritt');
        expect(knoten.find((k) => k.id === 'feld:a')?.parentId).toBe('schritt:s1');
    });

    it('nimmt auch ein Feld auf, das im Layout keinen Platz hat', () => {
        // Dieselbe Regel wie im Renderer: ein Feld darf nicht verschwinden,
        // nur weil das Layout es nicht kennt.
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('vergessen')],
            layout: [{ type: 'row', columns: [['a']] }],
        });

        expect(knoten.map((k) => k.ref)).toContain('vergessen');
    });

    it('stapelt Knoten ohne gespeicherte Position ueberschneidungsfrei', () => {
        const knoten = knotenAusDefinition({ fields: [feld('a'), feld('b')] });

        expect(knoten[1]!.position.y).toBeGreaterThanOrEqual(
            knoten[0]!.position.y + MASSE.feldHoehe,
        );
    });
});

describe('positionenSchreiben', () => {
    it('legt kein leeres graph an', () => {
        // Ein `graph: {}` waere ein Unterschied in der gespeicherten
        // Definition, den niemand gemacht hat — und er taucht in jedem
        // Vergleich auf.
        const definition: FormularDefinition = { fields: [feld('a')] };

        expect(positionenSchreiben(definition, {})).toEqual(definition);
    });

    it('entfernt eine vorhandene Anordnung beim Zuruecksetzen', () => {
        const definition: FormularDefinition = {
            fields: [feld('a')],
            graph: { positions: { 'feld:a': { x: 5, y: 5 } } },
        };

        expect(positionenSchreiben(definition, {})).not.toHaveProperty('graph');
    });

    it('laesst Felder und Layout unangetastet', () => {
        const definition: FormularDefinition = {
            fields: [feld('a')],
            layout: [{ type: 'row', columns: [['a']] }],
            conditions: [
                {
                    id: 'r1',
                    target: { kind: 'field', ref: 'a' },
                    effect: 'show',
                    match: 'all',
                    tests: [{ field: 'a', op: 'filled' }],
                },
            ],
        };

        const danach = positionenSchreiben(definition, { 'feld:a': { x: 1, y: 2 } });

        expect(danach.fields).toEqual(definition.fields);
        expect(danach.layout).toEqual(definition.layout);
        // Der Graph ist Kosmetik — er darf an der Definition nichts sonst
        // anfassen.
        expect(danach.conditions).toEqual(definition.conditions);
    });
});

describe('Rahmengröße', () => {
    const mitGruppe: FormularDefinition = {
        fields: [feld('a')],
        layout: [
            { type: 'group', id: 'g1', children: [{ type: 'row', columns: [['a']] }] },
        ],
    };

    it('meldet die Mindestgröße aus dem Inhalt', () => {
        const rahmen = knotenAusDefinition(mitGruppe).find((k) => k.id === 'gruppe:g1')!;

        // Kleiner darf niemand ziehen: sonst lägen die Felder sichtbar neben
        // ihrem eigenen Rahmen.
        expect(rahmen.mindestBreite).toBe(rahmen.breite);
        expect(rahmen.mindestHoehe).toBe(rahmen.hoehe);
    });

    it('lässt eine von Hand gesetzte Größe gewinnen', () => {
        const groesser = groesseSchreiben(mitGruppe, 'gruppe:g1', {
            breite: 900,
            hoehe: 700,
        });

        const rahmen = knotenAusDefinition(groesser).find((k) => k.id === 'gruppe:g1')!;

        expect(rahmen.breite).toBe(900);
        expect(rahmen.hoehe).toBe(700);
    });

    it('lässt sich nicht unter den Inhalt drücken', () => {
        // Auch wenn jemand eine zu kleine Größe in die Definition schreibt.
        const zuKlein = groesseSchreiben(mitGruppe, 'gruppe:g1', {
            breite: 10,
            hoehe: 10,
        });

        const rahmen = knotenAusDefinition(zuKlein).find((k) => k.id === 'gruppe:g1')!;

        expect(rahmen.breite).toBeGreaterThan(10);
        expect(rahmen.hoehe).toBeGreaterThan(10);
    });
});

describe('anordnungVergessen', () => {
    it('nimmt Position und Größe eines Knotens heraus', () => {
        // Nötig beim Rahmenwechsel: die gespeicherte Position war relativ zum
        // alten Rahmen und zeigt im neuen irgendwohin.
        const definition: FormularDefinition = {
            fields: [feld('a'), feld('b')],
            graph: {
                positions: { 'feld:a': { x: 1, y: 2 }, 'feld:b': { x: 3, y: 4 } },
                sizes: { 'gruppe:g1': { breite: 100, hoehe: 100 } },
            },
        };

        const danach = anordnungVergessen(definition, 'feld:a');

        expect(danach.graph?.positions).toEqual({ 'feld:b': { x: 3, y: 4 } });
        expect(danach.graph?.sizes).toEqual({ 'gruppe:g1': { breite: 100, hoehe: 100 } });
    });

    it('wirft graph ganz weg, wenn nichts übrig bleibt', () => {
        const definition: FormularDefinition = {
            fields: [feld('a')],
            graph: { positions: { 'feld:a': { x: 1, y: 2 } } },
        };

        expect(anordnungVergessen(definition, 'feld:a')).not.toHaveProperty('graph');
    });
});

describe('Spaltigkeit am Knoten', () => {
    it('nennt Spalte und Spaltenzahl bei einer mehrspaltigen Zeile', () => {
        // Im Graphen ist die Zeilenzugehörigkeit sonst nur an der Anordnung
        // zu erkennen — und die ist Kosmetik. Wer einen Knoten verschiebt,
        // verliert den Hinweis, obwohl sich an der Zeile nichts geändert hat.
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b'), feld('c')],
            layout: [{ type: 'row', columns: [['a'], ['b'], ['c']] }],
        });

        expect(knoten.map((k) => [k.ref, k.spalte, k.spalten])).toEqual([
            ['a', 1, 3],
            ['b', 2, 3],
            ['c', 3, 3],
        ]);
    });

    it('meldet auch die einspaltige Zeile — die Anzeige entscheidet, nicht die Anordnung', () => {
        const knoten = knotenAusDefinition({ fields: [feld('a')] });

        expect(knoten[0]!.spalte).toBe(1);
        expect(knoten[0]!.spalten).toBe(1);
    });

    it('zählt je Zeile getrennt', () => {
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b'), feld('c')],
            layout: [
                { type: 'row', columns: [['a'], ['b']] },
                { type: 'row', columns: [['c']] },
            ],
        });

        expect(knoten.find((k) => k.ref === 'b')!.spalten).toBe(2);
        expect(knoten.find((k) => k.ref === 'c')!.spalten).toBe(1);
    });

    it('zählt Felder untereinander in derselben Spalte gleich', () => {
        // Eine Spalte kann mehrere Felder tragen — sie stehen dann
        // untereinander, gehören aber zur selben Spalte.
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('b'), feld('c')],
            layout: [{ type: 'row', columns: [['a', 'b'], ['c']] }],
        });

        expect(knoten.find((k) => k.ref === 'a')!.spalte).toBe(1);
        expect(knoten.find((k) => k.ref === 'b')!.spalte).toBe(1);
        expect(knoten.find((k) => k.ref === 'c')!.spalte).toBe(2);
    });
});
