import { describe, expect, it } from 'vitest';

import type { FormularDefinition } from '../../../core';
import { knotenAusDefinition } from '../anordnung';
import { knotenId } from '../kennung';

/**
 * Eine gespeicherte Position gilt nur in dem Rahmen, in dem sie entstand.
 *
 * ## Der Fehler, den das festhält
 *
 * Beobachtet am 28.10.2026 in peppermint-connect. Dort legt die Anwendung
 * serverseitig eine Gruppe „Rechnungsangaben" um vorhandene Zeilen, und der
 * Betreiber sortierte danach in der Listenansicht um.
 *
 * Im Graphen überlappten sich daraufhin drei Felder: Gemessen standen sie auf
 * y=705, y=727 und y=766 bei 44 px Höhe — „Unternehmen" wurde von „Vorname"
 * überdeckt, „Anrede" von „Straße".
 *
 * Ursache: Eine gespeicherte Position schlägt die berechnete. Die
 * gespeicherten stammten aber aus der Zeit, als die Felder AUSSERHALB der
 * Gruppe standen; innerhalb zählt eine Position relativ zum Rahmen.
 *
 * `anordnungVergessen()` gab es schon — aber nur der Graph-Editor rief es,
 * beim Hineinziehen mit der Maus. Listenansicht, Schnittstelle und eine
 * Anwendung, die selbst gruppiert, gingen daran vorbei.
 */
function definitionMit(positionen: FormularDefinition['graph']): FormularDefinition {
    return {
        fields: [
            { name: 'company', label: 'Unternehmen', type: 'text' },
            { name: 'first_name', label: 'Vorname', type: 'text' },
        ],
        layout: [
            {
                type: 'group',
                id: 'system_rechnungsangaben',
                title: 'Rechnungsangaben',
                children: [
                    { type: 'row', columns: [['company']] },
                    { type: 'row', columns: [['first_name']] },
                ],
            },
        ],
        ...(positionen ? { graph: positionen } : {}),
    } as FormularDefinition;
}

describe('Gespeicherte Position und Rahmenwechsel', () => {
    it('uebergeht eine Position aus der obersten Ebene, wenn das Feld jetzt im Rahmen liegt', () => {
        /*
         * Genau der beobachtete Fall: „company" trägt eine Position von
         * früher, als es oben stand. Im Rahmen muss sie ignoriert werden —
         * sonst landet das Feld auf seinem Nachbarn.
         */
        const knoten = knotenAusDefinition(
            definitionMit({
                positions: { [knotenId('feld', 'company')]: { x: 999, y: 999 } },
            }),
        );

        const company = knoten.find((k) => k.ref === 'company');
        const vorname = knoten.find((k) => k.ref === 'first_name');

        expect(company?.position).not.toEqual({ x: 999, y: 999 });

        // Und die beiden überlappen sich nicht mehr.
        expect(company && vorname).toBeTruthy();
        expect(
            Math.abs((company?.position.y ?? 0) - (vorname?.position.y ?? 0)),
        ).toBeGreaterThanOrEqual(company?.hoehe ?? 0);
    });

    it('behaelt eine Position, die zum SELBEN Rahmen gehoert', () => {
        // Wer ein Feld innerhalb der Gruppe verschoben hat, soll das behalten.
        const knoten = knotenAusDefinition(
            definitionMit({
                positions: {
                    [knotenId('feld', 'company')]: {
                        x: 42,
                        y: 84,
                        parent: knotenId('gruppe', 'system_rechnungsangaben'),
                    },
                },
            }),
        );

        expect(knoten.find((k) => k.ref === 'company')?.position).toEqual({
            x: 42,
            y: 84,
            parent: knotenId('gruppe', 'system_rechnungsangaben'),
        });
    });

    it('liest eine Position ohne Rahmenangabe als oberste Ebene', () => {
        /*
         * Bestandsdefinitionen tragen keinen `parent`. Sie stammen aus einer
         * Zeit, in der entweder nur die oberste Ebene existierte oder der
         * Graph-Editor beim Hineinziehen selbst aufgeräumt hat — dort ist die
         * Angabe also richtig und muss gelten.
         */
        const flach = {
            fields: [{ name: 'company', label: 'Unternehmen', type: 'text' }],
            layout: [{ type: 'row', columns: [['company']] }],
            graph: { positions: { [knotenId('feld', 'company')]: { x: 7, y: 9 } } },
        } as FormularDefinition;

        expect(knotenAusDefinition(flach).find((k) => k.ref === 'company')?.position)
            .toEqual({ x: 7, y: 9 });
    });

    it('uebergeht auch die Position eines Rahmens, der den Rahmen gewechselt hat', () => {
        // Dieselbe Regel gilt für verschachtelte Gruppen, nicht nur für Felder.
        const verschachtelt = {
            fields: [{ name: 'a', label: 'A', type: 'text' }],
            layout: [
                {
                    type: 'group',
                    id: 'aussen',
                    children: [
                        {
                            type: 'group',
                            id: 'innen',
                            children: [{ type: 'row', columns: [['a']] }],
                        },
                    ],
                },
            ],
            graph: { positions: { [knotenId('gruppe', 'innen')]: { x: 500, y: 500 } } },
        } as FormularDefinition;

        expect(
            knotenAusDefinition(verschachtelt).find(
                (k) => k.id === knotenId('gruppe', 'innen'),
            )?.position,
        ).not.toEqual({ x: 500, y: 500 });
    });
});
