import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularDefinition, FormularFeld } from '../../core';
import GraphEditor from '../graph/editor';
import FormularRenderer from '../formular';
import type { Systembaustein } from '../typen';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

const bausteine: Systembaustein[] = [
    {
        id: 'termin',
        titel: 'Terminauswahl',
        beschreibung: '3 Ticketarten',
        position: 'vorher',
    },
    { id: 'workshops', titel: 'Workshops', position: 'nachher' },
];

/**
 * Systembausteine sind ANZEIGE und sonst nichts.
 *
 * Terminauswahl und Workshops haben keinen Datenschlüssel: `ticket_type_id`
 * steht in einer eigenen Spalte, `workshop_ids` in einer Beziehung. Ein
 * Editor, der sie als Felder anlegt, erzeugt Namen, unter denen nie eine
 * Antwort liegt — genau die Verwechslung, gegen die die Trennung von `fields`
 * und `layout` gebaut ist.
 */
describe('Systembausteine im Renderer', () => {
    it('zeichnet sie über und unter dem Formular', () => {
        render(
            <FormularRenderer
                definition={{ fields: [feld('a')] }}
                werte={{}}
                onChange={() => {}}
                systemBausteine={bausteine}
            />,
        );

        expect(screen.getByText('Terminauswahl')).toBeDefined();
        expect(screen.getByText('3 Ticketarten')).toBeDefined();
        expect(screen.getByText('Workshops')).toBeDefined();
    });

    it('wiederholt sie bei mehreren Schritten nicht auf jeder Seite', () => {
        // Auf jeder Seite wiederholt wären sie eine Aufforderung, die
        // Terminwahl mehrfach zu treffen.
        const definition: FormularDefinition = {
            fields: [feld('a'), feld('b')],
            layout: [
                { type: 'step', id: 's1', children: [{ type: 'row', columns: [['a']] }] },
                { type: 'step', id: 's2', children: [{ type: 'row', columns: [['b']] }] },
            ],
        };

        render(
            <FormularRenderer
                definition={definition}
                werte={{}}
                onChange={() => {}}
                systemBausteine={bausteine}
            />,
        );

        // Seite 1: nur der obere.
        expect(screen.getByText('Terminauswahl')).toBeDefined();
        expect(screen.queryByText('Workshops')).toBeNull();

        fireEvent.click(screen.getByText('Weiter'));

        // Seite 2: nur der untere.
        expect(screen.queryByText('Terminauswahl')).toBeNull();
        expect(screen.getByText('Workshops')).toBeDefined();
    });
});

describe('Systembausteine im Graphen', () => {
    function flaeche(container: HTMLElement) {
        return within(container.querySelector('.react-flow') as HTMLElement);
    }

    it('zeigt sie als eigene Knoten', () => {
        const { container } = render(
            <GraphEditor
                definition={{ fields: [feld('a')] }}
                onChange={() => {}}
                systemBausteine={bausteine}
            />,
        );

        expect(flaeche(container).getByText('Terminauswahl')).toBeDefined();
        expect(flaeche(container).getByText('über dem Formular')).toBeDefined();
        expect(flaeche(container).getByText('unter dem Formular')).toBeDefined();
    });

    it('bietet sie NICHT als Ziel einer Bedingung an', () => {
        // Eine Regel auf einen Systembaustein wäre eine Regel auf etwas, das
        // gar nicht zur Definition gehört.
        render(
            <GraphEditor
                definition={{ fields: [feld('a'), feld('b')] }}
                onChange={() => {}}
                systemBausteine={bausteine}
            />,
        );

        const zielAuswahl = screen.getAllByRole('combobox')[1]!;

        expect(within(zielAuswahl).queryByText('Terminauswahl')).toBeNull();
        expect(within(zielAuswahl).queryByText('Workshops')).toBeNull();
    });

    it('schreibt sie bei keiner Änderung in die Definition', () => {
        // Der Test, an dem der ganze Baustein hängt.
        const onChange = vi.fn();

        render(
            <GraphEditor
                definition={{ fields: [feld('a')] }}
                onChange={onChange}
                systemBausteine={bausteine}
            />,
        );

        fireEvent.click(screen.getByText('Feld hinzufügen'));

        const danach: FormularDefinition = onChange.mock.calls[0]![0];

        expect(danach.fields.map((f) => f.name)).not.toContain('termin');
        expect(danach.fields.map((f) => f.name)).not.toContain('workshops');
        expect(JSON.stringify(danach)).not.toContain('Terminauswahl');
    });
});
