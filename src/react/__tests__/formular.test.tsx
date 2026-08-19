import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularFeld } from '../../core';
import FormularRenderer from '../formular';
import type { EigenerFeldTypProps, TextEingabeProps } from '../typen';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

const zeichne = (props: Partial<Parameters<typeof FormularRenderer>[0]> = {}) =>
    render(
        <FormularRenderer
            definition={{ fields: [feld('vorname')] }}
            werte={{}}
            onChange={() => {}}
            {...props}
        />,
    );

describe('FormularRenderer', () => {
    it('zeigt ein Feld, das im Layout keinen Platz hat, trotzdem an', () => {
        zeichne({
            definition: {
                fields: [feld('vorname'), feld('email', { type: 'email' })],
                layout: [{ type: 'row', columns: [['vorname']] }],
            },
        });

        expect(screen.getByLabelText('vorname')).toBeDefined();
        // Ohne die Regel waere dieses Pflichtfeld lautlos aus dem Formular
        // verschwunden, weil das Layout es nicht kennt.
        expect(screen.getByLabelText('email')).toBeDefined();
    });

    it('legt eine zweispaltige Zeile als Zweier-Raster an', () => {
        const { container } = zeichne({
            definition: {
                fields: [feld('vorname'), feld('nachname')],
                layout: [{ type: 'row', columns: [['vorname'], ['nachname']] }],
            },
        });

        expect(container.querySelector('.pm-fb-zeile--2')).not.toBeNull();
        expect(container.querySelectorAll('.pm-fb-spalte')).toHaveLength(2);
    });

    it('nimmt auch die nackte Feldliste alter Bestaende an', () => {
        zeichne({ definition: [feld('vorname')] });

        expect(screen.getByLabelText('vorname')).toBeDefined();
    });

    it('zeigt einen gespeicherten Wert, der nicht mehr zur Auswahl steht', () => {
        zeichne({
            definition: { fields: [feld('anrede', { type: 'select', options: ['Frau', 'Herr'] })] },
            werte: { anrede: 'Divers' },
        });

        // Ohne diese Regel zeigte die Maske ein leeres Feld, und das naechste
        // Speichern wuerfe den Wert stillschweigend weg.
        expect(screen.getByText('Divers (nicht mehr zur Auswahl)')).toBeDefined();
    });

    it('gibt Ankreuzfelder als "1" und "0" zurueck, nicht als Wahrheitswert', () => {
        const onChange = vi.fn();
        zeichne({
            definition: { fields: [feld('agb', { type: 'checkbox' })] },
            werte: { agb: '0' },
            onChange,
        });

        fireEvent.click(screen.getByLabelText('agb'));

        expect(onChange).toHaveBeenCalledWith('agb', '1');
    });

    it('zeichnet die Beschriftung eines Ankreuzfeldes nur einmal', () => {
        zeichne({ definition: { fields: [feld('agb', { type: 'checkbox' })] } });

        expect(screen.getAllByText('agb')).toHaveLength(1);
    });

    it('benutzt die mitgegebene Komponente statt der schlichten', () => {
        const Eigen = ({ wert, onChange, id }: TextEingabeProps) => (
            <input data-testid="eigen" id={id} value={wert} onChange={(e) => onChange(e.target.value)} />
        );

        zeichne({ komponenten: { Text: Eigen } });

        expect(screen.getByTestId('eigen')).toBeDefined();
    });

    it('nimmt einen produkteigenen Feldtyp an und laesst dessen Label weg', () => {
        const Hotel = ({ feld: f }: EigenerFeldTypProps) => (
            <div data-testid="hotel">{f.label}</div>
        );

        zeichne({
            definition: { fields: [feld('hotel', { type: 'hotel_booking' })] },
            eigeneTypen: { hotel_booking: { komponente: Hotel, labelImFeld: true } },
        });

        expect(screen.getByTestId('hotel')).toBeDefined();
        // Das aeussere Label muss fehlen, sonst steht die Beschriftung doppelt.
        expect(screen.getAllByText('hotel')).toHaveLength(1);
    });

    it('trennt zwei Masken auf einer Seite ueber den idPrefix', () => {
        const { container } = render(
            <>
                <FormularRenderer
                    definition={{ fields: [feld('vorname')] }}
                    werte={{}}
                    onChange={() => {}}
                    idPrefix="links_"
                />
                <FormularRenderer
                    definition={{ fields: [feld('vorname')] }}
                    werte={{}}
                    onChange={() => {}}
                    idPrefix="rechts_"
                />
            </>,
        );

        expect(container.querySelector('#links_vorname')).not.toBeNull();
        expect(container.querySelector('#rechts_vorname')).not.toBeNull();
    });

    it('verknuepft die Fehlermeldung mit dem Feld', () => {
        zeichne({ fehler: { vorname: 'Pflichtfeld' } });

        const eingabe = screen.getByLabelText('vorname');

        expect(eingabe.getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByText('Pflichtfeld').id).toBe(
            eingabe.getAttribute('aria-describedby'),
        );
    });

    it('macht aus einem unbekannten Typ ein Textfeld statt einer Luecke', () => {
        zeichne({ definition: { fields: [feld('neu', { type: 'was_auch_immer' })] } });

        expect(screen.getByLabelText('neu').getAttribute('type')).toBe('text');
    });
});
