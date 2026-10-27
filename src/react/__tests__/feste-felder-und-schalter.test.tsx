import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FormularDefinition } from '../../core';
import FormularEditor, { type FestesFeld } from '../editor/editor';
import type { FeldSchalter } from '../editor/feldmaske';

/**
 * Zwei Erweiterungspunkte fuer das Produkt (27.10.2026).
 *
 * ## Warum sie gebraucht werden
 *
 * In Peppermint Connect stand in einer Zahlungsliste 70-mal „Unbekannt",
 * obwohl der Name in jedem Datensatz stand: Die Maske hatte den Feldnamen
 * geraten (`name`, `first_name`, `vorname`), und das Formular nannte sein Feld
 * `Name` — mit grossem N. Vertragskonform, nur nicht vorhersehbar.
 *
 * Daraus folgen zwei Dinge, und beide gehoeren ins Paket, weil die Maske hier
 * liegt:
 *
 * 1. **`festeFelder`** — ein Katalog des Produkts. Wer daraus waehlt, bekommt
 *    einen garantierten Schluessel. Dann ist nichts mehr zu raten.
 * 2. **`feldSchalter`** — zusaetzliche Ankreuzfelder je Feld. Das Produkt
 *    braucht Entscheidungen am Feld („steht das auf der Rechnung?"), die das
 *    Paket nicht kennen soll.
 *
 * Beide folgen derselben Arbeitsteilung wie `gesperrteFelder`: Das Paket
 * zeigt, das Produkt begruendet.
 */
const KATALOG: FestesFeld[] = [
    { schluessel: 'company', label: 'Firmenname', typ: 'text' },
    { schluessel: 'email', label: 'E-Mail', typ: 'email', pflicht: true },
];

const leer: FormularDefinition = { fields: [] };

describe('festeFelder', () => {
    it('zeigt die Auswahl nur, wenn ein Katalog mitkommt', () => {
        const { rerender } = render(
            <FormularEditor definition={leer} onChange={() => {}} />,
        );

        // Ohne Katalog gar nicht — ein leeres Auswahlfeld verspricht etwas,
        // das es nicht hat.
        expect(screen.queryByLabelText('Festes Feld hinzufügen')).toBeNull();

        rerender(
            <FormularEditor
                definition={leer}
                onChange={() => {}}
                festeFelder={KATALOG}
            />,
        );

        expect(screen.getByLabelText('Festes Feld hinzufügen')).toBeDefined();
    });

    it('legt das Feld mit dem Schluessel aus dem Katalog an, nicht mit einem erfundenen', () => {
        const onChange = vi.fn();

        render(
            <FormularEditor
                definition={leer}
                onChange={onChange}
                festeFelder={KATALOG}
            />,
        );

        fireEvent.change(screen.getByLabelText('Festes Feld hinzufügen'), {
            target: { value: 'company' },
        });

        expect(onChange).toHaveBeenCalledTimes(1);

        const neu = onChange.mock.calls[0][0].fields[0];

        // Der Schluessel IST die Zusage an das Produkt — kein `feld_1`.
        expect(neu.name).toBe('company');
        expect(neu.type).toBe('text');
        expect(neu.label).toBe('Firmenname');
    });

    it('uebernimmt Pflichtfeld und eigene Beschriftung aus dem Katalog', () => {
        const onChange = vi.fn();

        render(
            <FormularEditor
                definition={leer}
                onChange={onChange}
                festeFelder={[
                    {
                        schluessel: 'email',
                        label: 'E-Mail',
                        typ: 'email',
                        pflicht: true,
                        beschriftung: 'Ihre E-Mail-Adresse',
                    },
                ]}
            />,
        );

        fireEvent.change(screen.getByLabelText('Festes Feld hinzufügen'), {
            target: { value: 'email' },
        });

        const neu = onChange.mock.calls[0][0].fields[0];

        expect(neu.required).toBe(true);
        expect(neu.label).toBe('Ihre E-Mail-Adresse');
    });

    it('legt einen Schluessel nicht zweimal an — auch nicht bei anderer Schreibweise', () => {
        /*
         * Der Fall, um den es ueberhaupt geht: Ein Bestandsformular hat
         * „Name" gross. Kaeme „name" klein dazu, ueberschrieben sich die
         * beiden in den Antworten, und welches gewinnt, waere Zufall.
         */
        const onChange = vi.fn();

        render(
            <FormularEditor
                definition={{ fields: [{ name: 'Company', label: 'Firma', type: 'text' }] }}
                onChange={onChange}
                festeFelder={KATALOG}
            />,
        );

        fireEvent.change(screen.getByLabelText('Festes Feld hinzufügen'), {
            target: { value: 'company' },
        });

        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('feldSchalter', () => {
    const schalter: FeldSchalter[] = [
        {
            schluessel: 'auf_rechnung',
            label: 'Auf der Rechnung anzeigen',
            vorgabe: true,
            nurFuer: ['name', 'company'],
        },
    ];

    const mitFeldern: FormularDefinition = {
        fields: [
            { name: 'Name', label: 'Name', type: 'text' },
            { name: 'hobby', label: 'Hobby', type: 'text' },
        ],
    };

    /**
     * Oeffnet die Maske eines bestimmten Feldes.
     *
     * Ueber die Position des Feldes und nicht „der erste Bearbeiten-Knopf":
     * Mein erster Versuch nahm immer den ersten und traf nur deshalb richtig,
     * weil „Name" zufaellig oben stand. Ein Test, der die Gegenprobe gar nicht
     * erreicht, sieht aus wie eine Pruefung und ist keine.
     */
    function maskeOeffnen(position: number) {
        fireEvent.click(screen.getAllByText('Bearbeiten')[position]);
    }

    it('zeigt den Schalter nur bei den genannten Feldern — unabhaengig von der Schreibweise', () => {
        render(
            <FormularEditor
                definition={mitFeldern}
                onChange={() => {}}
                feldSchalter={schalter}
            />,
        );

        // „Name" gross trifft `nurFuer: ['name']` — genau dafuer wird
        // kleingeschrieben verglichen.
        maskeOeffnen(0);

        expect(screen.getByText('Auf der Rechnung anzeigen')).toBeDefined();
    });

    it('zeigt den Schalter NICHT bei einem Feld ausserhalb der Liste', () => {
        // Die Gegenprobe. Ohne sie beweist der Test darueber nur, dass der
        // Schalter irgendwo erscheint.
        render(
            <FormularEditor
                definition={mitFeldern}
                onChange={() => {}}
                feldSchalter={schalter}
            />,
        );

        maskeOeffnen(1);

        expect(screen.queryByText('Auf der Rechnung anzeigen')).toBeNull();
    });

    it('zeigt den Schalter bei JEDEM Feld, wenn `nurFuer` fehlt', () => {
        render(
            <FormularEditor
                definition={mitFeldern}
                onChange={() => {}}
                feldSchalter={[
                    { schluessel: 'irgendwas', label: 'Gilt überall' },
                ]}
            />,
        );

        maskeOeffnen(1);

        expect(screen.getByText('Gilt überall')).toBeDefined();
    });

    it('gilt als AN, solange das Feld den Schluessel nicht traegt', () => {
        /*
         * Ein Bestandsfeld hat den Schalter nie gesehen. Ihn als „nein" zu
         * zeigen behauptete eine Entscheidung, die niemand getroffen hat — und
         * im konkreten Fall haette es Firmennamen von Rechnungen genommen, auf
         * denen sie standen.
         */
        render(
            <FormularEditor
                definition={mitFeldern}
                onChange={() => {}}
                feldSchalter={schalter}
            />,
        );

        maskeOeffnen(0);

        const kaestchen = screen
            .getByText('Auf der Rechnung anzeigen')
            .closest('label')
            ?.querySelector('input');

        expect((kaestchen as HTMLInputElement).checked).toBe(true);
    });

    it('schreibt den Wert unter dem Schluessel ans Feld', () => {
        const onChange = vi.fn();

        render(
            <FormularEditor
                definition={mitFeldern}
                onChange={onChange}
                feldSchalter={schalter}
            />,
        );

        maskeOeffnen(0);

        const kaestchen = screen
            .getByText('Auf der Rechnung anzeigen')
            .closest('label')
            ?.querySelector('input') as HTMLInputElement;

        fireEvent.click(kaestchen);

        expect(onChange).toHaveBeenCalled();

        const feld = onChange.mock.calls[0][0].fields.find(
            (f: { name: string }) => f.name === 'Name',
        );

        expect(feld.auf_rechnung).toBe(false);
    });
});
