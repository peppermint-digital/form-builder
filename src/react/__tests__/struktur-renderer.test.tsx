import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FormularDefinition, FormularFeld } from '../../core';
import FormularRenderer from '../formular';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

function zeichne(
    definition: FormularDefinition,
    werte: Record<string, string> = {},
    weitere: Partial<Parameters<typeof FormularRenderer>[0]> = {},
) {
    return render(
        <FormularRenderer
            definition={definition}
            werte={werte}
            onChange={() => {}}
            {...weitere}
        />,
    );
}

const zeigeWenn = (ziel: string, feldname: string, wert: string) => ({
    id: `r-${ziel}`,
    target: { kind: 'field' as const, ref: ziel },
    effect: 'show' as const,
    match: 'all' as const,
    tests: [{ field: feldname, op: 'is' as const, value: wert }],
});

describe('Gruppen', () => {
    it('zeichnet eine Gruppe als fieldset mit legend', () => {
        const { container } = zeichne({
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

        // fieldset/legend statt div/Ueberschrift: fuer einen Screenreader ist
        // das der Unterschied zwischen „ein paar Felder" und „diese Felder
        // gehoeren zusammen".
        const rahmen = container.querySelector('fieldset.pm-fb-gruppe');

        expect(rahmen).not.toBeNull();
        expect(rahmen?.querySelector('legend')?.textContent).toBe('Anreise');
        expect(screen.getByLabelText('a')).toBeDefined();
    });

    it('laesst eine verborgene Gruppe samt Inhalt weg', () => {
        zeichne(
            {
                fields: [feld('a'), feld('b')],
                layout: [
                    { type: 'row', columns: [['a']] },
                    {
                        type: 'group',
                        id: 'g1',
                        title: 'Anreise',
                        children: [{ type: 'row', columns: [['b']] }],
                    },
                ],
                conditions: [
                    {
                        id: 'r1',
                        target: { kind: 'group', ref: 'g1' },
                        effect: 'show',
                        match: 'all',
                        tests: [{ field: 'a', op: 'is', value: 'ja' }],
                    },
                ],
            },
            { a: 'nein' },
        );

        expect(screen.queryByText('Anreise')).toBeNull();
        expect(screen.queryByLabelText('b')).toBeNull();
    });
});

describe('Bedingungen', () => {
    it('zeigt ein bedingtes Feld erst, wenn die Bedingung zutrifft', () => {
        const definition: FormularDefinition = {
            fields: [feld('anreise'), feld('hotel')],
            conditions: [zeigeWenn('hotel', 'anreise', 'ja')],
        };

        const { unmount } = zeichne(definition, { anreise: 'nein' });
        expect(screen.queryByLabelText('hotel')).toBeNull();
        unmount();

        zeichne(definition, { anreise: 'ja' });
        expect(screen.getByLabelText('hotel')).toBeDefined();
    });

    it('setzt den Pflicht-Stern nur, solange das Feld wirklich Pflicht ist', () => {
        const definition: FormularDefinition = {
            fields: [feld('rechnung'), feld('ust_id')],
            conditions: [
                {
                    id: 'r1',
                    target: { kind: 'field', ref: 'ust_id' },
                    effect: 'require',
                    match: 'all',
                    tests: [{ field: 'rechnung', op: 'is', value: 'firma' }],
                },
            ],
        };

        // Truege das Feld dauerhaft den Stern, suchte der Besucher nach einem
        // Feld, das er gar nicht ausfuellen muss.
        const { container, unmount } = zeichne(definition, { rechnung: 'privat' });
        expect(container.querySelector('#ust_id')?.hasAttribute('required')).toBe(false);
        unmount();

        const zweiter = zeichne(definition, { rechnung: 'firma' });
        expect(
            zweiter.container.querySelector('#ust_id')?.hasAttribute('required'),
        ).toBe(true);
    });
});

describe('Schritte', () => {
    const zweiSchritte: FormularDefinition = {
        fields: [feld('a'), feld('b')],
        layout: [
            {
                type: 'step',
                id: 's1',
                title: 'Person',
                children: [{ type: 'row', columns: [['a']] }],
            },
            {
                type: 'step',
                id: 's2',
                title: 'Anreise',
                children: [{ type: 'row', columns: [['b']] }],
            },
        ],
    };

    it('zeigt bei einem Formular ohne Schritte keine Steuerung', () => {
        // Bestandsschutz: aus einem bestehenden Formular darf kein
        // „Schritt 1 von 1" werden.
        const { container } = zeichne({ fields: [feld('a')] });

        expect(container.querySelector('.pm-fb-steuerung')).toBeNull();
    });

    it('zeigt zunaechst nur den ersten Schritt', () => {
        zeichne(zweiSchritte);

        expect(screen.getByLabelText('a')).toBeDefined();
        expect(screen.queryByLabelText('b')).toBeNull();
        expect(screen.getByText('Schritt 1 von 2')).toBeDefined();
    });

    it('blaettert mit Weiter zum naechsten Schritt', () => {
        zeichne(zweiSchritte);

        fireEvent.click(screen.getByText('Weiter'));

        expect(screen.getByLabelText('b')).toBeDefined();
        expect(screen.queryByLabelText('a')).toBeNull();
    });

    it('haelt beim Weiterblaettern an, solange ein Pflichtfeld leer ist', () => {
        zeichne({
            ...zweiSchritte,
            fields: [feld('a', { required: true }), feld('b')],
        });

        fireEvent.click(screen.getByText('Weiter'));

        // Ohne den Riegel blaettert man bis zum Ende durch und bekommt dort
        // Fehler zu Feldern, die Seiten zurueckliegen.
        expect(screen.queryByLabelText('b')).toBeNull();
        expect(screen.getByText('Bitte ausfüllen.')).toBeDefined();
    });

    it('ueberspringt einen verborgenen Schritt', () => {
        zeichne(
            {
                fields: [feld('a'), feld('b'), feld('c')],
                layout: [
                    { type: 'step', id: 's1', children: [{ type: 'row', columns: [['a']] }] },
                    { type: 'step', id: 's2', children: [{ type: 'row', columns: [['b']] }] },
                    { type: 'step', id: 's3', children: [{ type: 'row', columns: [['c']] }] },
                ],
                conditions: [
                    {
                        id: 'r1',
                        target: { kind: 'step', ref: 's2' },
                        effect: 'show',
                        match: 'all',
                        tests: [{ field: 'a', op: 'is', value: 'ja' }],
                    },
                ],
            },
            { a: 'nein' },
        );

        fireEvent.click(screen.getByText('Weiter'));

        expect(screen.getByLabelText('c')).toBeDefined();
    });

    it('folgt einer Verzweigung aus dem Ablauf', () => {
        zeichne(
            {
                fields: [feld('weg'), feld('b'), feld('c')],
                layout: [
                    { type: 'step', id: 's1', children: [{ type: 'row', columns: [['weg']] }] },
                    { type: 'step', id: 's2', children: [{ type: 'row', columns: [['b']] }] },
                    { type: 'step', id: 's3', children: [{ type: 'row', columns: [['c']] }] },
                ],
                flow: [
                    {
                        id: 'k1',
                        from: 's1',
                        to: 's3',
                        match: 'all',
                        tests: [{ field: 'weg', op: 'is', value: 'kurz' }],
                    },
                ],
            },
            { weg: 'kurz' },
        );

        fireEvent.click(screen.getByText('Weiter'));

        // Ohne die Kante waere s2 an der Reihe.
        expect(screen.getByLabelText('c')).toBeDefined();
        expect(screen.queryByLabelText('b')).toBeNull();
    });

    it('geht ueber den zurueckgelegten Weg zurueck, nicht ueber die Reihenfolge', () => {
        zeichne(
            {
                fields: [feld('weg'), feld('b'), feld('c')],
                layout: [
                    { type: 'step', id: 's1', children: [{ type: 'row', columns: [['weg']] }] },
                    { type: 'step', id: 's2', children: [{ type: 'row', columns: [['b']] }] },
                    { type: 'step', id: 's3', children: [{ type: 'row', columns: [['c']] }] },
                ],
                flow: [
                    {
                        id: 'k1',
                        from: 's1',
                        to: 's3',
                        match: 'all',
                        tests: [{ field: 'weg', op: 'is', value: 'kurz' }],
                    },
                ],
            },
            { weg: 'kurz' },
        );

        fireEvent.click(screen.getByText('Weiter'));
        fireEvent.click(screen.getByText('Zurück'));

        // Der Schritt davor waere s2 — dort war man aber nie.
        expect(screen.getByLabelText('weg')).toBeDefined();
        expect(screen.queryByLabelText('b')).toBeNull();
    });

    it('sagt der Anwendung, wann die letzte Seite erreicht ist', () => {
        // Die Absende-Schaltflaeche gehoert der Anwendung — aber sie darf nur
        // auf der letzten Seite stehen.
        zeichne(zweiSchritte, {}, {
            children: ({ istLetzter }) =>
                istLetzter ? <button type="submit">Absenden</button> : null,
        });

        expect(screen.queryByText('Absenden')).toBeNull();

        fireEvent.click(screen.getByText('Weiter'));

        expect(screen.getByText('Absenden')).toBeDefined();
    });

    it('überspringt einen Schritt, dessen Felder alle verborgen sind', () => {
        // Bei einem bedingten Formular ist das der Normalfall: „zeig die
        // Hotelfragen nur bei Übernachtung" heißt für alle anderen eine leere
        // Seite, durch die sie klicken müssen — und es sieht aus wie ein
        // Fehler in der Anmeldung.
        zeichne(
            {
                fields: [feld('anreise'), feld('hotel'), feld('ende')],
                layout: [
                    { type: 'step', id: 's1', children: [{ type: 'row', columns: [['anreise']] }] },
                    { type: 'step', id: 's2', children: [{ type: 'row', columns: [['hotel']] }] },
                    { type: 'step', id: 's3', children: [{ type: 'row', columns: [['ende']] }] },
                ],
                conditions: [zeigeWenn('hotel', 'anreise', 'ja')],
            },
            { anreise: 'nein' },
        );

        expect(screen.getByText('Schritt 1 von 2')).toBeDefined();

        fireEvent.click(screen.getByText('Weiter'));

        // Nicht die leere Hotel-Seite, sondern gleich die letzte.
        expect(screen.getByLabelText('ende')).toBeDefined();
    });

    it('behält einen Schritt, der gar keine Felder hat', () => {
        // Eine gewollte Textseite darf nicht verschwinden, nur weil nichts
        // auszufüllen ist.
        zeichne({
            fields: [feld('a')],
            layout: [
                {
                    type: 'step',
                    id: 's1',
                    children: [{ type: 'section', title: 'Willkommen' }],
                },
                { type: 'step', id: 's2', children: [{ type: 'row', columns: [['a']] }] },
            ],
        });

        expect(screen.getByText('Willkommen')).toBeDefined();
        expect(screen.getByText('Schritt 1 von 2')).toBeDefined();
    });

    it('zeigt den Schritt wieder, sobald die Bedingung zutrifft', () => {
        const definition: FormularDefinition = {
            fields: [feld('anreise'), feld('hotel')],
            layout: [
                { type: 'step', id: 's1', children: [{ type: 'row', columns: [['anreise']] }] },
                { type: 'step', id: 's2', children: [{ type: 'row', columns: [['hotel']] }] },
            ],
            conditions: [zeigeWenn('hotel', 'anreise', 'ja')],
        };

        const { unmount } = zeichne(definition, { anreise: 'nein' });
        // Nur noch eine Seite — die zweite hätte nichts zu zeigen.
        expect(screen.queryByText('Schritt 1 von 2')).toBeNull();
        unmount();

        zeichne(definition, { anreise: 'ja' });
        expect(screen.getByText('Schritt 1 von 2')).toBeDefined();
    });
});
