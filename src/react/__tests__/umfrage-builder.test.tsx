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

describe('Bedingungen an der Frage', () => {
    const mitJaNein = (): FormularDefinition => ({
        fields: [
            { name: 'kommst', label: 'Kommst du?', type: 'radio', options: ['Ja', 'Nein'] },
            { name: 'warum_nicht', label: 'Warum nicht?', type: 'textarea' },
        ],
        layout: [
            { type: 'row', columns: [['kommst']] },
            { type: 'row', columns: [['warum_nicht']] },
        ],
    });

    const oeffneLogik = (nummer: number) =>
        fireEvent.click(screen.getAllByRole('button', { name: /Wann zeigen\?/ })[nummer]!);

    it('sagt bei der ersten Frage, dass sie von nichts abhaengen kann', () => {
        zeichne(mitJaNein());
        oeffneLogik(0);

        // Eine Frage kann nur von etwas abhängen, das schon beantwortet ist.
        expect(screen.getByText(/kann von nichts abhängen/)).toBeTruthy();
    });

    it('legt eine Bedingung an, die auf die vorige Frage zeigt', () => {
        const onChange = zeichne(mitJaNein());
        oeffneLogik(1);

        fireEvent.click(screen.getByRole('button', { name: '+ Bedingung' }));

        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        expect(neu.conditions).toHaveLength(1);
        expect(neu.conditions![0]).toMatchObject({
            target: { kind: 'field', ref: 'warum_nicht' },
            effect: 'show',
            tests: [{ field: 'kommst', op: 'filled' }],
        });
    });

    it('bietet als Quelle nur die Fragen DAVOR an', () => {
        const mit = mitJaNein();
        mit.conditions = [
            {
                id: 'r1',
                target: { kind: 'field', ref: 'warum_nicht' },
                effect: 'show',
                match: 'all',
                tests: [{ field: 'kommst', op: 'is', value: 'Nein' }],
            },
        ];

        zeichne(mit);
        oeffneLogik(1);

        const quelle = screen.getByLabelText('Frage') as HTMLSelectElement;
        const werte = [...quelle.options].map((o) => o.value);

        // „warum_nicht" darf nicht von sich selbst oder von einer späteren
        // Frage abhängen — das wäre eine Regel, die nie zutrifft.
        expect(werte).toEqual(['kommst']);
    });

    it('bietet bei einer Auswahlfrage die Optionen an, statt tippen zu lassen', () => {
        const mit = mitJaNein();
        mit.conditions = [
            {
                id: 'r1',
                target: { kind: 'field', ref: 'warum_nicht' },
                effect: 'show',
                match: 'all',
                tests: [{ field: 'kommst', op: 'is', value: 'Nein' }],
            },
        ];

        zeichne(mit);
        oeffneLogik(1);

        // Ein Tippfehler erzeugt sonst eine Regel, die im Editor richtig
        // aussieht und im Formular nie zutrifft.
        const wert = screen.getByLabelText('Wert') as HTMLSelectElement;
        expect([...wert.options].map((o) => o.value)).toEqual(['', 'Ja', 'Nein']);
        expect(wert.value).toBe('Nein');
    });

    it('nimmt den Vergleichswert weg, sobald er nichts mehr bedeutet', () => {
        const mit = mitJaNein();
        mit.conditions = [
            {
                id: 'r1',
                target: { kind: 'field', ref: 'warum_nicht' },
                effect: 'show',
                match: 'all',
                tests: [{ field: 'kommst', op: 'is', value: 'Nein' }],
            },
        ];

        const onChange = zeichne(mit);
        oeffneLogik(1);

        fireEvent.change(screen.getByLabelText('Vergleich'), {
            target: { value: 'filled' },
        });

        // Ein `value`, das neben `filled` stehenbleibt, ist eine Angabe, die
        // nichts bedeutet — und die der nächste Leser anders auslegt.
        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        expect(neu.conditions![0]!.tests[0]).toEqual({ field: 'kommst', op: 'filled' });
    });

    it('warnt, dass eine zeigen-Regel die Vorgabe umdreht', () => {
        const mit = mitJaNein();
        mit.conditions = [
            {
                id: 'r1',
                target: { kind: 'field', ref: 'warum_nicht' },
                effect: 'show',
                match: 'all',
                tests: [{ field: 'kommst', op: 'is', value: 'Nein' }],
            },
        ];

        zeichne(mit);
        oeffneLogik(1);

        // Wer das nicht weiß, legt zwei Regeln an und wundert sich, dass die
        // Frage verschwindet.
        expect(screen.getByText(/verborgen, bis eine davon zutrifft/)).toBeTruthy();
    });

    it('zeigt an der Frage, wie viele Bedingungen auf sie wirken', () => {
        const mit = mitJaNein();
        mit.conditions = [
            {
                id: 'r1',
                target: { kind: 'field', ref: 'warum_nicht' },
                effect: 'show',
                match: 'all',
                tests: [{ field: 'kommst', op: 'is', value: 'Nein' }],
            },
        ];

        zeichne(mit);

        // Ohne die Zahl müsste man jede Frage aufklappen, um zu sehen, ob eine
        // Regel daran hängt.
        expect(screen.getByRole('button', { name: 'Wann zeigen? (1)' })).toBeTruthy();
    });
});

describe('Bloecke — eine Bedingung fuer mehrere Fragen', () => {
    /** Genau der Aufbau, den der Nutzer am 10.09. auf demo hatte. */
    const jaNeinMitFolge = (): FormularDefinition => ({
        fields: [
            { name: 'field_1', label: 'Was geht heute Abend bei Essen ab?', type: 'radio', options: ['Ja', 'Nein'] },
            { name: 'field_2', label: 'Wie war das Essen?', type: 'scale', stufen: 5 },
            { name: 'field_3', label: 'Woanders gegessen?', type: 'text' },
        ],
        layout: [
            { type: 'row', columns: [['field_1']] },
            { type: 'row', columns: [['field_2']] },
            { type: 'row', columns: [['field_3']] },
        ],
    });

    it('legt einen Block an', () => {
        const onChange = zeichne(jaNeinMitFolge());

        fireEvent.click(screen.getByRole('button', { name: /\+ Block/ }));

        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        const gruppen = neu.layout!.filter((k) => k.type === 'group');
        expect(gruppen).toHaveLength(1);
    });

    it('zeigt einen leeren Block statt ihn zu verstecken', () => {
        const mit = jaNeinMitFolge();
        mit.layout!.push({ type: 'group', id: 'g1', title: 'Wenn Nein', children: [] });

        zeichne(mit);

        // Ein Block, der erst beim ersten Feld erscheint, lässt sich nicht
        // befüllen — man sieht nicht, wohin man schieben soll.
        expect(screen.getByDisplayValue('Wenn Nein')).toBeTruthy();
        expect(screen.getByText(/Noch leer/)).toBeTruthy();
    });

    it('legt eine Bedingung auf den BLOCK statt auf jede Frage', () => {
        const mit = jaNeinMitFolge();
        mit.layout = [
            { type: 'row', columns: [['field_1']] },
            {
                type: 'group',
                id: 'g1',
                title: 'Wenn Nein',
                children: [
                    { type: 'row', columns: [['field_2']] },
                    { type: 'row', columns: [['field_3']] },
                ],
            },
        ];

        const onChange = zeichne(mit);

        // Index 1: Karte von field_1 steht davor, der Block danach.
        fireEvent.click(screen.getAllByRole('button', { name: /Wann zeigen\?/ })[1]!);
        fireEvent.click(screen.getByRole('button', { name: '+ Bedingung' }));

        // EINE Regel für zwei Fragen — das ist der ganze Grund für Blöcke.
        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        expect(neu.conditions).toHaveLength(1);
        expect(neu.conditions![0]!.target).toEqual({ kind: 'group', ref: 'g1' });
    });

    it('nimmt als Quelle auch eine Frage AUSSERHALB des Blocks', () => {
        const mit = jaNeinMitFolge();
        mit.layout = [
            { type: 'row', columns: [['field_1']] },
            {
                type: 'group',
                id: 'g1',
                title: 'Wenn Nein',
                children: [{ type: 'row', columns: [['field_2']] }],
            },
        ];

        const onChange = zeichne(mit);

        fireEvent.click(screen.getAllByRole('button', { name: /Wann zeigen\?/ })[1]!);
        fireEvent.click(screen.getByRole('button', { name: '+ Bedingung' }));

        // Genau der Fall, um den es geht: „wenn Frage 1 Nein, zeige diesen
        // Block". Die Quelle steht außerhalb.
        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        expect(neu.conditions![0]!.tests[0]!.field).toBe('field_1');
    });

    it('laesst eine Frage in einen Block wandern', () => {
        const mit = jaNeinMitFolge();
        mit.layout!.push({ type: 'group', id: 'g1', title: 'Wenn Nein', children: [] });

        const onChange = zeichne(mit);

        // Die Blockauswahl steht unter „Erweitert" — sie ist Aufbau, nicht Inhalt.
        fireEvent.click(screen.getAllByRole('button', { name: 'Erweitert' })[1]!);
        fireEvent.change(screen.getByLabelText('Gehört zum Block'), {
            target: { value: 'g1' },
        });

        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        const gruppe = neu.layout!.find((k) => k.type === 'group');
        expect(JSON.stringify(gruppe)).toContain('field_2');
    });

    it('behaelt die Fragen, wenn der Block aufgeloest wird', () => {
        const mit = jaNeinMitFolge();
        mit.layout = [
            { type: 'row', columns: [['field_1']] },
            {
                type: 'group',
                id: 'g1',
                title: 'Wenn Nein',
                children: [{ type: 'row', columns: [['field_2']] }],
            },
        ];

        const onChange = zeichne(mit);

        fireEvent.click(screen.getByRole('button', { name: /Block auflösen/ }));

        // Ein Block ist Darstellung, eine Frage ist ein Datenschlüssel, unter
        // dem Antworten liegen. „Auflösen" darf nie Daten kosten.
        const neu: FormularDefinition = onChange.mock.calls[0]![0];
        expect(neu.fields.map((f) => f.name)).toEqual(['field_1', 'field_2', 'field_3']);
        expect(neu.layout!.some((k) => k.type === 'group')).toBe(false);
    });

    it('zaehlt die Fragen ueber den ganzen Bogen, nicht je Block', () => {
        const mit = jaNeinMitFolge();
        mit.layout = [
            { type: 'row', columns: [['field_1']] },
            {
                type: 'group',
                id: 'g1',
                title: 'Wenn Nein',
                children: [
                    { type: 'row', columns: [['field_2']] },
                    { type: 'row', columns: [['field_3']] },
                ],
            },
        ];

        zeichne(mit);

        // „Frage 3 von 3" ist die Stelle im Bogen. Sie ändert sich nicht
        // dadurch, dass jemand eine Klammer darum zieht.
        expect(screen.getByText('Frage 1 von 3')).toBeTruthy();
        expect(screen.getByText('Frage 3 von 3')).toBeTruthy();
    });
});
