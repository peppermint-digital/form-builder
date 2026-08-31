import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularDefinition, FormularFeld } from '../../../core';
import GraphEditor from '../editor';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

/**
 * Was hier geprueft wird und was nicht.
 *
 * Geprueft: welche Knoten aus einer Definition entstehen und was auf ihnen
 * steht. Nicht geprueft: wo sie auf dem Bildschirm landen — jsdom misst
 * nichts, und ein Test, der Koordinaten behauptet, behauptet nur die eigene
 * Vorstellung. Das Aussehen gehoert vor ein echtes Auge.
 */
describe('GraphEditor', () => {
    it('zeichnet je einen Knoten pro Feld, mit seinem Typ', () => {
        render(
            <GraphEditor
                definition={{
                    fields: [feld('vorname'), feld('mail_adresse', { type: 'email' })],
                }}
                onChange={() => {}}
            />,
        );

        expect(screen.getByText('vorname')).toBeDefined();
        expect(screen.getByText('mail_adresse')).toBeDefined();
        // Der Typ steht am Knoten, sonst sehen alle Felder gleich aus.
        expect(screen.getByText('email')).toBeDefined();
    });

    it('zeigt Gruppen und Schritte als eigene Rahmen', () => {
        const definition: FormularDefinition = {
            fields: [feld('a')],
            layout: [
                {
                    type: 'step',
                    id: 's1',
                    title: 'Person',
                    children: [
                        {
                            type: 'group',
                            id: 'g1',
                            title: 'Anreise',
                            children: [{ type: 'row', columns: [['a']] }],
                        },
                    ],
                },
            ],
        };

        render(<GraphEditor definition={definition} onChange={() => {}} />);

        expect(screen.getByText('Person')).toBeDefined();
        expect(screen.getByText('Anreise')).toBeDefined();
    });

    it('zeigt die Sperre eines Feldes an, unter dem Daten liegen', () => {
        render(
            <GraphEditor
                definition={{ fields: [feld('email')] }}
                onChange={() => {}}
                gesperrteFelder={{ email: 'Darunter liegen 42 Anmeldungen.' }}
            />,
        );

        const sperre = screen.getByText('gesperrt');

        expect(sperre).toBeDefined();
        // Die Begruendung gehoert dazu — „gesperrt" allein laesst den
        // Benutzer raten, warum er nicht darf.
        expect(sperre.getAttribute('title')).toBe('Darunter liegen 42 Anmeldungen.');
    });

    it('wirft die Anordnung weg, statt sie auf null zu setzen', () => {
        const onChange = vi.fn();

        render(
            <GraphEditor
                definition={{
                    fields: [feld('a')],
                    graph: { positions: { a: { x: 500, y: 300 } } },
                }}
                onChange={onChange}
            />,
        );

        screen.getByText('Anordnung zurücksetzen').click();

        // Kein leeres `graph`: das waere ein Unterschied in der gespeicherten
        // Definition, den niemand gemacht hat.
        expect(onChange).toHaveBeenCalledWith({ fields: [feld('a')] });
    });

    it('macht aus einer Bestandsdefinition ohne graph trotzdem einen Graphen', () => {
        // Kein bestehendes Formular hat Positionen. Liesse sich so eines
        // nicht oeffnen, waere der Editor fuer den gesamten Bestand nutzlos.
        render(
            <GraphEditor definition={[feld('vorname'), feld('nachname')]} onChange={() => {}} />,
        );

        expect(screen.getByText('vorname')).toBeDefined();
        expect(screen.getByText('nachname')).toBeDefined();
    });
});
