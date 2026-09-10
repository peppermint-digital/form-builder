import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularDefinition } from '../../core';
import { UmfrageBuilder } from '../umfrage';

const basis = (): FormularDefinition => ({
    fields: [
        { name: 'f1', label: 'Wie zufrieden warst du?', type: 'scale', stufen: 5 },
        { name: 'f2', label: 'Was können wir besser machen?', type: 'textarea' },
    ],
    layout: [
        { type: 'row', columns: [['f1']] },
        { type: 'row', columns: [['f2']] },
    ],
});

const zeichne = (definition = basis(), onChange = vi.fn()) => {
    render(<UmfrageBuilder definition={definition} onChange={onChange} />);

    return onChange;
};

describe('UmfrageBuilder', () => {
    it('zeigt die Fragen in Layout-Reihenfolge', () => {
        zeichne();

        expect(screen.getByDisplayValue('Wie zufrieden warst du?')).toBeTruthy();
        expect(screen.getByText('Frage 1 von 2')).toBeTruthy();
        expect(screen.getByText('Frage 2 von 2')).toBeTruthy();
    });

    it('zeigt den Datenschluessel NICHT in der Hauptansicht', () => {
        zeichne();

        // Der Datenschlüssel geht niemanden an, der eine Feedback-Umfrage
        // schreibt — und ihn zu ändern macht gespeicherte Antworten
        // unauffindbar.
        expect(screen.queryByDisplayValue('f1')).toBeNull();
        expect(screen.queryByText('Datenschlüssel')).toBeNull();
    });

    it('zeigt ihn unter Erweitert — mit der Warnung', () => {
        zeichne();

        fireEvent.click(screen.getAllByRole('button', { name: 'Erweitert' })[0]!);

        expect(screen.getByDisplayValue('f1')).toBeTruthy();
        expect(screen.getByText(/unauffindbar/)).toBeTruthy();
    });

    it('bietet fertige Fragen an, nicht Feldtypen', () => {
        zeichne();

        fireEvent.click(screen.getByRole('button', { name: '+ Frage hinzufügen' }));

        // Über die Rolle und nicht über den Text: Die Typnamen stehen auch in
        // den `<option>`s jeder Karte. Die Vorschläge sind Schaltflächen.
        //
        // „Bewertung" und nicht „Auswahlknöpfe": Der Unterschied ist der ganze
        // Punkt dieser Ansicht. Und das Beispiel gehört dazu — es sagt, was man
        // bekommt, statt wie es heißt.
        expect(screen.getByRole('button', { name: /Bewertung/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Mehrere Antworten/ })).toBeTruthy();
        expect(screen.getByText('★ ★ ★ ★ ☆')).toBeTruthy();
    });

    it('haelt die seltenen Arten hinter „Mehr Arten“ zurueck', () => {
        zeichne();

        fireEvent.click(screen.getByRole('button', { name: '+ Frage hinzufügen' }));
        expect(screen.queryByRole('button', { name: /Telefon/ })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Mehr Arten' }));
        expect(screen.getByRole('button', { name: /Telefon/ })).toBeTruthy();
    });

    it('legt eine Auswahlfrage mit zwei leeren Antwortzeilen an', () => {
        const onChange = zeichne();

        fireEvent.click(screen.getByRole('button', { name: '+ Frage hinzufügen' }));
        fireEvent.click(screen.getByRole('button', { name: /Mehrere Antworten/ }));

        // Eine Auswahlfrage ohne Antworten ist keine, und ein leerer Kasten
        // sagt nicht, dass dort etwas hingehört.
        const neu = onChange.mock.calls[0]![0].fields.at(-1);
        expect(neu.type).toBe('checkboxes');
        expect(neu.options).toEqual(['', '']);
    });

    it('dupliziert eine Frage', () => {
        const onChange = zeichne();

        fireEvent.click(screen.getAllByRole('button', { name: 'Duplizieren' })[0]!);

        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        expect(neu.fields).toHaveLength(3);
        expect(neu.fields.at(-1)!.label).toBe('Wie zufrieden warst du?');
        expect(neu.fields.at(-1)!.name).not.toBe('f1');
    });

    it('sagt es, wenn die Umfrage eine Verzweigung hat', () => {
        const mitFlow = basis();
        mitFlow.flow = [{ id: 'k1', from: 's1', to: 's2' }];

        zeichne(mitFlow);

        // Ein Hinweis und keine Sperre: Die Ansicht KANN die Verzweigung nicht
        // verlieren — jeder Handgriff des Kerns reicht die Definition durch.
        expect(screen.getByText(/lässt sich hier nicht darstellen/)).toBeTruthy();
    });

    it('laesst Verzweigung und Bedingungen beim Bearbeiten unangetastet', () => {
        const mitRegeln = basis();
        mitRegeln.flow = [{ id: 'k1', from: 's1', to: 's2' }];
        mitRegeln.conditions = [
            {
                id: 'r1',
                target: { kind: 'field', ref: 'f2' },
                effect: 'show',
                match: 'all',
                tests: [{ field: 'f1', op: 'lt', value: '3' }],
            },
        ];

        const onChange = zeichne(mitRegeln);

        fireEvent.click(screen.getAllByRole('button', { name: 'Duplizieren' })[0]!);

        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        expect(neu.flow).toEqual(mitRegeln.flow);
        expect(neu.conditions).toEqual(mitRegeln.conditions);
    });

    it('nennt die Dinge, wie das Produkt sie nennt', () => {
        render(
            <UmfrageBuilder
                definition={basis()}
                onChange={() => {}}
                woerter={{ einzahl: 'Feld', mehrzahl: 'Felder' }}
            />,
        );

        // „Frage" ist für eine Umfrage richtig und für ein Anmeldeformular
        // falsch. Das Paket kann die Ansicht, das Produkt benennt sie.
        expect(screen.getByText('Feld 1 von 2')).toBeTruthy();
        expect(screen.getByRole('button', { name: '+ Feld hinzufügen' })).toBeTruthy();
    });

    it('sperrt Loeschen und Umbenennen eines gesperrten Feldes', () => {
        render(
            <UmfrageBuilder
                definition={basis()}
                onChange={() => {}}
                gesperrteFelder={{ f1: 'Darunter liegen bereits Antworten.' }}
            />,
        );

        expect(
            (screen.getAllByRole('button', { name: 'Löschen' })[0] as HTMLButtonElement)
                .disabled,
        ).toBe(true);

        fireEvent.click(screen.getAllByRole('button', { name: 'Erweitert' })[0]!);
        expect((screen.getByDisplayValue('f1') as HTMLInputElement).disabled).toBe(true);
        expect(screen.getByText('Darunter liegen bereits Antworten.')).toBeTruthy();
    });
});
