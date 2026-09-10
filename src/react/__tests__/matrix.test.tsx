import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularDefinition } from '../../core';
import FormularRenderer from '../formular';

/**
 * Eine Matrix ist LAYOUT, kein Feldtyp.
 *
 * Der Prüfgegenstand ist genau das: Die Zeilen bleiben gewöhnliche Felder mit
 * eigenem Datenschlüssel. Fällt die Matrix-Angabe weg, stehen dieselben Fragen
 * untereinander — vollständig, nur unschöner. Kein Datenverlust.
 */
const spalten = ['Sehr gut', 'Gut', 'Schlecht'];

const zeile = (name: string, label: string) => ({
    name,
    label,
    type: 'radio' as const,
    options: spalten,
});

const definition = (matrix: unknown = { spalten }): FormularDefinition => ({
    fields: [zeile('ref_a', 'Frau Meier'), zeile('ref_b', 'Herr Schmidt')],
    layout: [
        {
            type: 'group',
            id: 'g1',
            title: 'Wie fandest du die Vorträge?',
            ...(matrix ? { matrix } : {}),
            children: [
                { type: 'row', columns: [['ref_a']] },
                { type: 'row', columns: [['ref_b']] },
            ],
        } as never,
    ],
});

const zeichne = (
    def: FormularDefinition,
    werte: Record<string, string> = {},
    onChange = vi.fn(),
) => {
    render(
        <FormularRenderer definition={def} werte={werte} onChange={onChange} />,
    );

    return onChange;
};

describe('Matrix', () => {
    it('zeichnet eine Tabelle mit einer Zeile je Feld', () => {
        zeichne(definition());

        expect(screen.getByRole('table')).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'Sehr gut' })).toBeTruthy();
        expect(screen.getByRole('rowheader', { name: /Frau Meier/ })).toBeTruthy();
        expect(screen.getByRole('rowheader', { name: /Herr Schmidt/ })).toBeTruthy();
    });

    it('speichert je Zeile unter ihrem eigenen Schluessel', () => {
        const onChange = zeichne(definition());

        fireEvent.click(screen.getByLabelText('Frau Meier: Sehr gut'));

        // Der springende Punkt: EIN Datenschlüssel je Zeile, kein
        // verschachtelter Wert. Bedingungen greifen damit je Zeile, der Export
        // hat eine Spalte je Zeile, die Auswertung rechnet ohne Sonderfall.
        expect(onChange).toHaveBeenCalledWith('ref_a', 'Sehr gut');
    });

    it('haelt die Zeilen unabhaengig voneinander', () => {
        const onChange = zeichne(definition(), { ref_a: 'Gut' });

        fireEvent.click(screen.getByLabelText('Herr Schmidt: Schlecht'));

        expect(onChange).toHaveBeenCalledWith('ref_b', 'Schlecht');
        expect(
            (screen.getByLabelText('Frau Meier: Gut') as HTMLInputElement).checked,
        ).toBe(true);
    });

    it('faellt ohne Matrix-Angabe auf untereinander zurueck — ohne Datenverlust', () => {
        const { container } = render(
            <FormularRenderer
                definition={definition(null)}
                werte={{ ref_a: 'Gut' }}
                onChange={() => {}}
            />,
        );

        // Keine Tabelle mehr, aber beide Fragen da und die Antwort steht.
        //
        // Ueber die `id` und nicht ueber die Beschriftung: Ohne Matrix hat
        // JEDE Zeile ihre eigene „Gut"-Option, es gibt sie also zweimal. Das
        // ist genau der Unterschied, den die Tabelle einspart — und der Grund,
        // warum sie in der Anzeige etwas taugt.
        expect(container.querySelector('table')).toBeNull();
        expect(screen.getByText('Frau Meier')).toBeTruthy();
        expect(screen.getByText('Herr Schmidt')).toBeTruthy();

        const gewaehlt = container.querySelector<HTMLInputElement>('#ref_a_Gut');
        expect(gewaehlt?.checked).toBe(true);
        expect(
            container.querySelector<HTMLInputElement>('#ref_b_Gut')?.checked,
        ).toBe(false);
    });

    it('ist mit einer Spalte keine Matrix', () => {
        // Eine Tabelle mit einer Spalte sieht aus wie ein Fehler, und der
        // Zusammenhang zur kurzen Spaltenliste ist von außen nicht zu sehen.
        zeichne(definition({ spalten: ['Nur eine'] }));

        expect(screen.queryByRole('table')).toBeNull();
    });

    it('nimmt eine bedingt verborgene Zeile aus der Tabelle', () => {
        const def = definition();
        def.conditions = [
            {
                id: 'r1',
                target: { kind: 'field', ref: 'ref_b' },
                effect: 'hide',
                match: 'all',
                tests: [{ field: 'ref_a', op: 'is', value: 'Schlecht' }],
            },
        ];

        zeichne(def, { ref_a: 'Schlecht' });

        expect(screen.getByRole('rowheader', { name: /Frau Meier/ })).toBeTruthy();
        expect(screen.queryByRole('rowheader', { name: /Herr Schmidt/ })).toBeNull();
    });

    it('macht einen gespeicherten Wert sichtbar, den die Spalten nicht kennen', () => {
        // Eine Spalte wurde nach der Antwort umbenannt. Ihn still wegzulassen
        // hieße, eine gespeicherte Antwort unsichtbar zu machen — und das
        // nächste Speichern würfe sie weg.
        zeichne(definition(), { ref_a: 'Ausgezeichnet' });

        expect(screen.getByText(/Ausgezeichnet/)).toBeTruthy();
    });
});
