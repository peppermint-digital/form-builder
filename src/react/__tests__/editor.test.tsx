import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularDefinition } from '../../core';
import FormularEditor from '../editor/editor';

const definition = (namen: string[]): FormularDefinition => ({
    fields: namen.map((name) => ({ name, label: name, type: 'text' })),
});

describe('FormularEditor', () => {
    it('zeigt jedes Feld der Definition', () => {
        render(
            <FormularEditor definition={definition(['vorname', 'nachname'])} onChange={() => {}} />,
        );

        expect(screen.getByText('vorname')).toBeDefined();
        expect(screen.getByText('nachname')).toBeDefined();
    });

    it('vergibt beim Hinzufuegen einen freien Namen statt eines belegten', () => {
        const onChange = vi.fn();
        render(<FormularEditor definition={definition(['field_2'])} onChange={onChange} />);

        fireEvent.click(screen.getByText('Feld hinzufügen'));

        // `fields.length + 1` haette field_2 getroffen — der Waechter lehnt
        // doppelte Namen ab, und das Speichern schluege fehl.
        const neu = onChange.mock.calls[0]?.[0] as FormularDefinition;
        expect(neu.fields.map((f) => f.name)).toEqual(['field_2', 'field_3']);
    });

    it('entfernt ein Feld samt seiner Stelle im Layout', () => {
        const onChange = vi.fn();
        render(<FormularEditor definition={definition(['a', 'b'])} onChange={onChange} />);

        fireEvent.click(screen.getByLabelText('a entfernen'));

        const neu = onChange.mock.calls[0]?.[0] as FormularDefinition;
        expect(neu.fields.map((f) => f.name)).toEqual(['b']);
        expect(JSON.stringify(neu.layout)).not.toContain('"a"');
    });

    it('laesst sich ohne Maus bedienen — jede Bewegung hat eine Schaltflaeche', () => {
        const onChange = vi.fn();
        render(<FormularEditor definition={definition(['a', 'b'])} onChange={onChange} />);

        fireEvent.click(screen.getByLabelText('b nach oben'));

        const neu = onChange.mock.calls[0]?.[0] as FormularDefinition;
        expect(JSON.stringify(neu.layout?.[0])).toContain('"b"');
    });

    it('oeffnet die Maske und aendert die Beschriftung', () => {
        const onChange = vi.fn();
        render(<FormularEditor definition={definition(['a'])} onChange={onChange} />);

        fireEvent.click(screen.getByText('Bearbeiten'));
        // Beschriftung und Feldname tragen beide 'a' — das erste Feld ist die
        // Beschriftung.
        const beschriftung = screen.getAllByDisplayValue('a')[0]!;
        fireEvent.change(beschriftung, { target: { value: 'Vorname' } });

        const neu = onChange.mock.calls[0]?.[0] as FormularDefinition;
        expect(neu.fields[0]?.label).toBe('Vorname');
    });

    it('sperrt den Schluessel eines gesperrten Feldes', () => {
        render(
            <FormularEditor
                definition={definition(['termin'])}
                onChange={() => {}}
                gesperrteFelder={{ termin: 'Hier liegen bereits Antworten.' }}
            />,
        );

        fireEvent.click(screen.getByText('Bearbeiten'));

        const namensfeld = screen.getAllByDisplayValue('termin')[1] as HTMLInputElement;

        expect(namensfeld.disabled).toBe(true);
    });

    it('zeigt die Begruendung des Produkts, nicht eine eigene', () => {
        // Der Kern der Schnittstelle: Das Paket weiss nicht, WARUM ein Feld
        // gesperrt ist. Frueher stand hier ein fester Satz ueber bereits
        // vorhandene Antworten — fuer ein Produkt, das Felder aus einem anderen
        // Grund sperrt, war der schlicht falsch.
        render(
            <FormularEditor
                definition={definition(['termin'])}
                onChange={() => {}}
                gesperrteFelder={{ termin: 'Wird für die Rechnung gebraucht.' }}
            />,
        );

        fireEvent.click(screen.getByText('Bearbeiten'));

        expect(screen.getByText('Wird für die Rechnung gebraucht.')).toBeDefined();
    });

    it('laesst ein gesperrtes Feld nicht entfernen', () => {
        const onChange = vi.fn();

        render(
            <FormularEditor
                definition={definition(['termin'])}
                onChange={onChange}
                gesperrteFelder={{ termin: 'Wird für die Rechnung gebraucht.' }}
            />,
        );

        const loeschen = screen.getByLabelText('termin entfernen') as HTMLButtonElement;

        expect(loeschen.disabled).toBe(true);

        fireEvent.click(loeschen);

        expect(onChange).not.toHaveBeenCalled();
    });

    it('laesst die Beschriftung auch bei gesperrtem Schluessel frei', () => {
        render(
            <FormularEditor
                definition={definition(['termin'])}
                onChange={() => {}}
                gesperrteFelder={{ termin: 'Hier liegen bereits Antworten.' }}
            />,
        );

        fireEvent.click(screen.getByText('Bearbeiten'));

        const beschriftung = screen.getAllByDisplayValue('termin')[0] as HTMLInputElement;

        expect(beschriftung.disabled).toBe(false);
    });

    it('bietet produkteigene Feldtypen in der Auswahl an', () => {
        render(
            <FormularEditor
                definition={definition(['a'])}
                onChange={() => {}}
                zusatzTypen={[{ wert: 'hotel_booking', label: 'Hotelbuchung' }]}
            />,
        );

        fireEvent.click(screen.getByText('Bearbeiten'));

        expect(screen.getByText('Hotelbuchung')).toBeDefined();
    });

    it('zeigt das Optionenfeld nur bei Auswahltypen', () => {
        const { rerender } = render(
            <FormularEditor definition={definition(['a'])} onChange={() => {}} />,
        );

        fireEvent.click(screen.getByText('Bearbeiten'));
        expect(screen.queryByText(/Optionen/)).toBeNull();

        rerender(
            <FormularEditor
                definition={{ fields: [{ name: 'a', label: 'a', type: 'select' }] }}
                onChange={() => {}}
            />,
        );

        expect(screen.getByText(/Optionen/)).toBeDefined();
    });

    it('raeumt beim Tippen keine angefangene Optionszeile weg', () => {
        const onChange = vi.fn();
        render(
            <FormularEditor
                definition={{ fields: [{ name: 'a', label: 'a', type: 'select', options: ['Frau'] }] }}
                onChange={onChange}
            />,
        );

        fireEvent.click(screen.getByText('Bearbeiten'));
        fireEvent.change(screen.getByDisplayValue('Frau'), { target: { value: 'Frau\n' } });

        // Der leere Eintrag bleibt in der Maske stehen — sonst verschwaende
        // die neue Zeile unter dem Cursor. Weggeraeumt wird beim Speichern.
        const neu = onChange.mock.calls[0]?.[0] as FormularDefinition;
        expect(neu.fields[0]?.options).toEqual(['Frau', '']);
    });

    it('sagt es, wenn noch nichts da ist', () => {
        render(<FormularEditor definition={{ fields: [] }} onChange={() => {}} />);

        expect(screen.getByText(/Noch keine Felder/)).toBeDefined();
    });
});
