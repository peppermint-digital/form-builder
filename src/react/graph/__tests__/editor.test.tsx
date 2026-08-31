import { fireEvent, render, screen, within } from '@testing-library/react';
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
 * Nur die Zeichenflaeche abfragen, nicht die ganze Seite.
 *
 * Die Leiste bietet dieselben Feldnamen als Auswahl an — eine Abfrage ueber
 * das ganze Dokument findet sie doppelt und meldet das zu Recht.
 */
function flaeche(container: HTMLElement) {
    return within(container.querySelector('.react-flow') as HTMLElement);
}

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
        const { container } = render(
            <GraphEditor
                definition={{
                    fields: [feld('vorname'), feld('mail_adresse', { type: 'email' })],
                }}
                onChange={() => {}}
            />,
        );

        expect(flaeche(container).getByText('vorname')).toBeDefined();
        expect(flaeche(container).getByText('mail_adresse')).toBeDefined();
        // Der Typ steht am Knoten, sonst sehen alle Felder gleich aus.
        expect(flaeche(container).getByText('email')).toBeDefined();
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

        const { container } = render(
            <GraphEditor definition={definition} onChange={() => {}} />,
        );

        expect(flaeche(container).getByText('Person')).toBeDefined();
        expect(flaeche(container).getByText('Anreise')).toBeDefined();
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
                    graph: { positions: { 'feld:a': { x: 500, y: 300 } } },
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
        const { container } = render(
            <GraphEditor definition={[feld('vorname'), feld('nachname')]} onChange={() => {}} />,
        );

        expect(flaeche(container).getByText('vorname')).toBeDefined();
        expect(flaeche(container).getByText('nachname')).toBeDefined();
    });

    it('legt eine Bedingung auch ohne Maus an', () => {
        // Dieselbe Regel wie im Listen-Editor: was sich nur ziehen laesst,
        // laesst sich mit der Tastatur gar nicht.
        const onChange = vi.fn();

        render(
            <GraphEditor
                definition={{ fields: [feld('anreise'), feld('hotel')] }}
                onChange={onChange}
            />,
        );

        const auswahlen = screen.getAllByRole('combobox');

        fireEvent.change(auswahlen[0]!, { target: { value: 'anreise' } });
        fireEvent.change(auswahlen[1]!, { target: { value: 'feld:hotel' } });
        fireEvent.click(screen.getByText('Bedingung anlegen'));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0]![0].conditions[0]).toMatchObject({
            target: { kind: 'field', ref: 'hotel' },
            effect: 'show',
            tests: [{ field: 'anreise', op: 'filled' }],
        });
    });

    it('sagt es, wenn Bedingungen sich gegenseitig blockieren', () => {
        // Ein Kreis wird still nicht angewendet. Ohne Hinweis sucht man den
        // Fehler im Formular statt in der Regel.
        render(
            <GraphEditor
                definition={{
                    fields: [feld('a'), feld('b')],
                    conditions: [
                        {
                            id: 'r1',
                            target: { kind: 'field', ref: 'a' },
                            effect: 'show',
                            match: 'all',
                            tests: [{ field: 'b', op: 'filled' }],
                        },
                        {
                            id: 'r2',
                            target: { kind: 'field', ref: 'b' },
                            effect: 'show',
                            match: 'all',
                            tests: [{ field: 'a', op: 'filled' }],
                        },
                    ],
                }}
                onChange={() => {}}
            />,
        );

        expect(
            screen.getByText('2 Bedingungen hängen im Kreis und werden nicht angewendet.'),
        ).toBeDefined();
    });

    it('loescht eine Regel ueber die Schaltflaeche am Knoten', () => {
        const onChange = vi.fn();

        render(
            <GraphEditor
                definition={{
                    fields: [feld('a'), feld('b')],
                    conditions: [
                        {
                            id: 'r1',
                            target: { kind: 'field', ref: 'b' },
                            effect: 'show',
                            match: 'all',
                            tests: [{ field: 'a', op: 'filled' }],
                        },
                    ],
                }}
                onChange={onChange}
            />,
        );

        fireEvent.click(screen.getByText('Löschen'));

        // Kein leeres `conditions`: das waere ein Unterschied, den niemand
        // gemacht hat.
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0]![0]).not.toHaveProperty('conditions');
    });

    it('rendert auch, wenn die Anwendung ein Objektliteral hereinreicht', () => {
        // Der Fehler, an dem der Editor beim Bauen haengen blieb: ein
        // Objektliteral entsteht bei jedem Rendern neu, das Memo faellt durch,
        // der Effekt setzt den Zustand — und React bricht mit „Maximum update
        // depth exceeded" ab. Eine Anwendung schreibt so etwas ganz beilaeufig.
        const { container } = render(
            <GraphEditor
                definition={{ fields: [feld('a')] }}
                onChange={() => {}}
                gesperrteFelder={{ a: 'Darunter liegen Anmeldungen.' }}
            />,
        );

        expect(flaeche(container).getByText('a')).toBeDefined();
    });

    it('legt ein Feld an und behält dabei die Bedingungen', () => {
        // Ohne Felder anlegen zu koennen waere der Graph keine Hauptansicht,
        // sondern eine Zweitansicht mit Luecke.
        const onChange = vi.fn();

        render(
            <GraphEditor
                definition={{
                    fields: [feld('a')],
                    conditions: [
                        {
                            id: 'r1',
                            target: { kind: 'field', ref: 'a' },
                            effect: 'show',
                            match: 'all',
                            tests: [{ field: 'a', op: 'filled' }],
                        },
                    ],
                }}
                onChange={onChange}
            />,
        );

        fireEvent.click(screen.getByText('Feld hinzufügen'));

        const danach = onChange.mock.calls[0]![0];

        expect(danach.fields).toHaveLength(2);
        // Der Fehler, der in JEDER Bearbeitungsfunktion sass: das Ergebnis
        // wurde als { fields, layout } neu gebaut, und die Bedingungen fielen
        // lautlos weg.
        expect(danach.conditions).toHaveLength(1);
    });

    it('öffnet die Feldmaske für den angeklickten Knoten', () => {
        const { container } = render(
            <GraphEditor
                definition={{ fields: [feld('vorname')] }}
                onChange={() => {}}
            />,
        );

        fireEvent.click(flaeche(container).getByText('vorname'));

        expect(screen.getByText('Beschriftung')).toBeDefined();
        expect(screen.getByText('Feld entfernen')).toBeDefined();
    });

    it('bietet bei einem gesperrten Feld kein Entfernen an', () => {
        // Darunter liegen Antworten — die waeren danach ohne Feld. Der
        // Waechter auf der Serverseite weist es ohnehin ab; hier erspart es
        // den Fehlschlag.
        const { container } = render(
            <GraphEditor
                definition={{ fields: [feld('email')] }}
                onChange={() => {}}
                gesperrteFelder={{ email: 'Darunter liegen Anmeldungen.' }}
            />,
        );

        fireEvent.click(flaeche(container).getByText('email'));

        expect(screen.queryByText('Feld entfernen')).toBeNull();
    });
});
