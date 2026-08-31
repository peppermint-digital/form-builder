import { describe, expect, it } from 'vitest';

import type { FormularDefinition, FormularFeld } from '../../../core';
import { knotenAusDefinition, MASSE, positionenSchreiben } from '../anordnung';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

describe('knotenAusDefinition', () => {
    it('macht aus jedem Feld einen Knoten', () => {
        const knoten = knotenAusDefinition({ fields: [feld('a'), feld('b')] });

        expect(knoten.map((k) => k.id)).toEqual(['a', 'b']);
        expect(knoten.every((k) => k.art === 'feld')).toBe(true);
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

        expect(knoten.find((k) => k.id === 'g1')?.art).toBe('gruppe');
        expect(knoten.find((k) => k.id === 'a')?.parentId).toBe('g1');
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

        const rahmen = knoten.find((k) => k.id === 'g1')!;
        const unterstes = knoten.find((k) => k.id === 'b')!;

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
            graph: { positions: { a: { x: 500, y: 300 } } },
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

        expect(knoten.find((k) => k.id === 's1')?.art).toBe('schritt');
        expect(knoten.find((k) => k.id === 'a')?.parentId).toBe('s1');
    });

    it('nimmt auch ein Feld auf, das im Layout keinen Platz hat', () => {
        // Dieselbe Regel wie im Renderer: ein Feld darf nicht verschwinden,
        // nur weil das Layout es nicht kennt.
        const knoten = knotenAusDefinition({
            fields: [feld('a'), feld('vergessen')],
            layout: [{ type: 'row', columns: [['a']] }],
        });

        expect(knoten.map((k) => k.id)).toContain('vergessen');
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
            graph: { positions: { a: { x: 5, y: 5 } } },
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

        const danach = positionenSchreiben(definition, { a: { x: 1, y: 2 } });

        expect(danach.fields).toEqual(definition.fields);
        expect(danach.layout).toEqual(definition.layout);
        // Der Graph ist Kosmetik — er darf an der Definition nichts sonst
        // anfassen.
        expect(danach.conditions).toEqual(definition.conditions);
    });
});
