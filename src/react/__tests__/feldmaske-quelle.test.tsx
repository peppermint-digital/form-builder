import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularFeld } from '../../core';
import Feldmaske from '../editor/feldmaske';

const feld: FormularFeld = { name: 'liefertermin', label: 'Liefertermin', type: 'text' };

const quellen = [
    { wert: 'order.delivery_date', label: 'Auftrag: Liefertermin' },
    { wert: 'order.project_name', label: 'Auftrag: Projektname' },
];

describe('Vorbelegung aus einer Quelle', () => {
    /**
     * Ein leeres Auswahlfeld, das nichts anzubieten hat, ist schlimmer als
     * keines — es verspricht etwas. Produkte ohne Quellen sollen die Zeile
     * gar nicht sehen.
     */
    it('zeigt die Auswahl nicht, wenn das Produkt keine Quellen anbietet', () => {
        render(<Feldmaske feld={feld} onChange={vi.fn()} />);

        expect(screen.queryByText('Vorbelegen aus')).toBeNull();
    });

    it('zeigt die angebotenen Quellen zur Auswahl', () => {
        render(<Feldmaske feld={feld} onChange={vi.fn()} quellen={quellen} />);

        expect(screen.getByText('Vorbelegen aus')).toBeTruthy();
        expect(screen.getByText('Auftrag: Liefertermin')).toBeTruthy();
        expect(screen.getByText('Auftrag: Projektname')).toBeTruthy();
    });

    it('meldet die gewaehlte Quelle als Pfad, nicht als Beschriftung', () => {
        const onChange = vi.fn();
        render(<Feldmaske feld={feld} onChange={onChange} quellen={quellen} />);

        fireEvent.change(screen.getByDisplayValue('— keine —'), {
            target: { value: 'order.delivery_date' },
        });

        expect(onChange).toHaveBeenCalledWith({ quelle: 'order.delivery_date' });
    });

    /**
     * Ohne den leeren Eintrag liesse sich eine einmal gesetzte Quelle nicht
     * mehr loesen — man koennte sie nur noch gegen eine andere tauschen.
     */
    it('laesst eine gesetzte Quelle wieder entfernen', () => {
        const onChange = vi.fn();
        render(
            <Feldmaske
                feld={{ ...feld, quelle: 'order.delivery_date' }}
                onChange={onChange}
                quellen={quellen}
            />,
        );

        fireEvent.change(screen.getByDisplayValue('Auftrag: Liefertermin'), {
            target: { value: '' },
        });

        expect(onChange).toHaveBeenCalledWith({ quelle: '' });
    });
});
