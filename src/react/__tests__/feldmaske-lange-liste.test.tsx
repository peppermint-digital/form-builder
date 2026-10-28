import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Feldmaske from '../editor/feldmaske';
import type { FormularFeld } from '../../core';

/**
 * Lange Optionslisten in der Feldmaske.
 *
 * ## Warum das gebaut wurde
 *
 * Seit dem 28.10.2026 bietet das Landfeld 250 Einträge an. Das Textfeld der
 * Maske zeigte davon vier Zeilen — es verdeckte mehr, als es zeigte, und wer
 * darin scrollte, bearbeitete eine Liste, die die Anwendung selbst pflegt.
 *
 * Wörtlich der Nutzer: „können wir das Landfeld in unserem Baukasten noch ein
 * bisschen einfacher darstellen? Also da sind ja jetzt ultra viele Länder
 * unten dran."
 */
function feldMit(anzahl: number): FormularFeld {
    return {
        id: 'f1',
        name: 'country',
        label: 'Land',
        type: 'select',
        options: Array.from({ length: anzahl }, (_, i) => `Land ${i + 1}`),
    } as FormularFeld;
}

describe('Feldmaske mit langer Optionsliste', () => {
    it('zeigt eine kurze Liste weiterhin als Textfeld', () => {
        // Die Gegenprobe. Die allermeisten Auswahlfelder haben drei bis fünf
        // Einträge, und die sollen sich unverändert bearbeiten lassen.
        const { container } = render(
            <Feldmaske feld={feldMit(3)} onChange={vi.fn()} />,
        );

        /*
         * Direkt am DOM und nicht ueber `getByDisplayValue`: Testing Library
         * normalisiert Leerraum, und ein mehrzeiliger Wert ist danach nicht
         * mehr der, den man sucht.
         */
        expect(container.querySelector('textarea')?.value).toBe(
            'Land 1\nLand 2\nLand 3',
        );
    });

    it('klappt eine lange Liste zu und nennt nur, was drinsteht', () => {
        const { container } = render(
            <Feldmaske feld={feldMit(250)} onChange={vi.fn()} />,
        );

        // Kein Textfeld mit 250 Zeilen.
        expect(screen.queryByDisplayValue(/Land 1\nLand 2/)).toBeNull();

        // Stattdessen die Anzahl und ein Anfang.
        // Der Satz ist über mehrere Knoten verteilt (Zahl, Liste, Knopf) —
        // deshalb über den Textinhalt und nicht über einen einzelnen Knoten.
        expect(container.textContent).toContain('250 Einträge');
        expect(container.textContent).toContain('Land 1, Land 2, Land 3');
    });

    it('oeffnet sie auf Klick — aendern bleibt moeglich', () => {
        /*
         * Zuklappen heißt nicht wegsperren. Wer die Liste wirklich ändern
         * will, kommt heran; es ist dann nur eine Entscheidung und kein
         * Versehen beim Scrollen.
         */
        render(<Feldmaske feld={feldMit(250)} onChange={vi.fn()} />);

        const { container } = render(
            <Feldmaske feld={feldMit(250)} onChange={vi.fn()} />,
        );
        fireEvent.click(
            container.querySelector('.pm-fb-maske__mehr') as HTMLElement,
        );

        expect(container.querySelector('textarea')?.value).toContain('Land 1');
    });

    it('reicht eine Aenderung weiter wie zuvor', () => {
        const onChange = vi.fn();
        const { container } = render(
            <Feldmaske feld={feldMit(250)} onChange={onChange} />,
        );

        fireEvent.click(
            container.querySelector('.pm-fb-maske__mehr') as HTMLElement,
        );
        fireEvent.change(container.querySelector('textarea') as HTMLElement, {
            target: { value: 'Eins\nZwei' },
        });

        expect(onChange).toHaveBeenCalledWith({ options: ['Eins', 'Zwei'] });
    });
});
