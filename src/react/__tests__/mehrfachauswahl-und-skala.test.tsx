import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularFeld } from '../../core';
import FormularRenderer from '../formular';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

const workshops = feld('workshops', {
    label: 'Welche Workshops?',
    type: 'checkboxes',
    options: ['Workshop A', 'Workshop B', 'Workshop C'],
});

const zeichne = (
    definition: FormularFeld[],
    werte: Record<string, string | string[]> = {},
    onChange = vi.fn(),
) => {
    render(
        <FormularRenderer
            definition={{ fields: definition }}
            werte={werte}
            onChange={onChange}
        />,
    );

    return onChange;
};

describe('Mehrfachauswahl', () => {
    it('reicht die vollstaendige Liste heraus, nicht das umgeschaltete Element', () => {
        const onChange = zeichne([workshops], { workshops: ['Workshop A'] });

        fireEvent.click(screen.getByLabelText('Workshop C'));

        // Der Adapter muss sich damit nicht merken, was vorher galt — und zwei
        // Adapter koennen nicht verschieden entscheiden, was ein doppeltes
        // Kreuz bedeutet.
        expect(onChange).toHaveBeenCalledWith('workshops', [
            'Workshop A',
            'Workshop C',
        ]);
    });

    it('ordnet nach den Optionen, nicht nach der Reihenfolge des Anklickens', () => {
        const onChange = zeichne([workshops], { workshops: ['Workshop C'] });

        fireEvent.click(screen.getByLabelText('Workshop A'));

        // Sonst waeren ['A','C'] und ['C','A'] zwei verschiedene Antworten auf
        // dieselbe Frage — und jede Auswertung muesste sie erst sortieren.
        expect(onChange).toHaveBeenCalledWith('workshops', [
            'Workshop A',
            'Workshop C',
        ]);
    });

    it('nimmt ein Kreuz wieder weg', () => {
        const onChange = zeichne([workshops], {
            workshops: ['Workshop A', 'Workshop B'],
        });

        fireEvent.click(screen.getByLabelText('Workshop A'));

        expect(onChange).toHaveBeenCalledWith('workshops', ['Workshop B']);
    });

    it('haelt einen Wert sichtbar, der nicht mehr zur Auswahl steht', () => {
        zeichne([workshops], { workshops: ['Workshop A', 'Abgesagter Workshop'] });

        // Ohne diese Zeile zeigte die Maske das Kreuz nicht, und das naechste
        // Speichern wuerfe den Wert stillschweigend weg. Es faellt niemandem
        // auf: Die Maske sieht aus, als waere dort nie etwas gewesen.
        const bestand = screen.getByLabelText(/Abgesagter Workshop/);
        expect(bestand).toBeTruthy();
        expect((bestand as HTMLInputElement).checked).toBe(true);
    });

    it('liest eine einzelne Zeichenkette als einelementige Liste', () => {
        // Der Fall tritt auf, wenn jemand ein radio-Feld auf checkboxes
        // umstellt: die gespeicherten Antworten sind dann Text.
        zeichne([workshops], { workshops: 'Workshop B' });

        expect((screen.getByLabelText('Workshop B') as HTMLInputElement).checked).toBe(
            true,
        );
    });

    it('gilt als leer, solange kein Kreuz gesetzt ist', () => {
        const pflicht = { ...workshops, required: true };
        const schritte: FormularFeld[] = [pflicht, feld('zweitens')];

        render(
            <FormularRenderer
                definition={{
                    fields: schritte,
                    layout: [
                        {
                            type: 'step',
                            id: 's1',
                            children: [{ type: 'row', columns: [['workshops']] }],
                        },
                        {
                            type: 'step',
                            id: 's2',
                            children: [{ type: 'row', columns: [['zweitens']] }],
                        },
                    ],
                }}
                werte={{ workshops: [] }}
                onChange={() => {}}
            />,
        );

        fireEvent.click(screen.getByText('Weiter'));

        // `[] === ''` ist falsch — ohne den eigenen Schnitt galte ein
        // Pflicht-Mehrfachfeld als ausgefuellt, sobald der Browser den
        // Schluessel ueberhaupt mitschickt. Also immer.
        expect(screen.queryByLabelText('zweitens')).toBeNull();
    });
});

describe('Bewertungsskala', () => {
    const note = feld('note', {
        label: 'Wie zufrieden warst du?',
        type: 'scale',
        stufen: 5,
        skalaVon: 'gar nicht',
        skalaBis: 'sehr',
    });

    it('zeichnet so viele Stufen wie angegeben', () => {
        zeichne([note]);

        expect(screen.getByLabelText('1')).toBeTruthy();
        expect(screen.getByLabelText('5')).toBeTruthy();
        expect(screen.queryByLabelText('6')).toBeNull();
    });

    it('zeichnet ohne Angabe fuenf Stufen', () => {
        zeichne([feld('note', { type: 'scale' })]);

        expect(screen.getByLabelText('5')).toBeTruthy();
        expect(screen.queryByLabelText('6')).toBeNull();
    });

    it('weist eine unsinnige Stufenzahl in die Schranken', () => {
        // Der Wert kommt aus einer JSON-Spalte und damit von aussen. Ohne
        // Begrenzung stuenden hier 5000 Knoepfe.
        zeichne([feld('note', { type: 'scale', stufen: 5000 })]);

        expect(screen.getByLabelText('11')).toBeTruthy();
        expect(screen.queryByLabelText('12')).toBeNull();
    });

    it('gibt die Stufe als Zeichenkette heraus', () => {
        const onChange = zeichne([note]);

        fireEvent.click(screen.getByLabelText('4'));

        // Als Zeichenkette und nicht als Zahl — dieselbe Regel wie beim
        // Ankreuzfeld ('1'/'0'). gt/lt rechnen trotzdem richtig.
        expect(onChange).toHaveBeenCalledWith('note', '4');
    });

    it('zeigt die Beschriftung der Enden', () => {
        zeichne([note]);

        expect(screen.getByText('gar nicht')).toBeTruthy();
        expect(screen.getByText('sehr')).toBeTruthy();
    });
});

describe('Weiterempfehlung (NPS)', () => {
    const nps = feld('nps', { label: 'Empfiehlst du uns weiter?', type: 'nps' });

    it('laeuft von null bis zehn', () => {
        zeichne([nps]);

        // Der ganze Wert eines NPS liegt darin, dass er branchenweit dieselbe
        // Skala hat. Eine eigene waere ein Wert, der aussieht wie ein NPS und
        // keiner ist.
        expect(screen.getByLabelText('0')).toBeTruthy();
        expect(screen.getByLabelText('10')).toBeTruthy();
        expect(screen.queryByLabelText('11')).toBeNull();
    });

    it('laesst sich von stufen nicht verbiegen', () => {
        zeichne([{ ...nps, stufen: 5 }]);

        expect(screen.getByLabelText('10')).toBeTruthy();
    });

    it('geht durch denselben Baustein wie die Skala', () => {
        // Jeder neue Eintrag in `KomponentenSatz` ist eine Komponente, die
        // JEDE Anwendung nachreichen muss, bevor der Typ bei ihr ankommt.
        const onChange = zeichne([nps]);

        fireEvent.click(screen.getByLabelText('9'));

        expect(onChange).toHaveBeenCalledWith('nps', '9');
    });
});
