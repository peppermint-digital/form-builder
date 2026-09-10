import { describe, expect, it } from 'vitest';

import {
    abschnittHinzufuegen,
    definitionBereinigen,
    feldAendern,
    feldDuplizieren,
    feldEntfernen,
    feldHinzufuegen,
    feldUmordnen,
    feldVerschieben,
    knotenEntfernen,
    layoutSicherstellen,
    naechsterFeldname,
    zeileVerschieben,
} from '../bearbeiten';
import { felderInReihenfolge } from '../definition';
import type { FormularDefinition, FormularFeld, LayoutZeile } from '../types';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

const mit = (...namen: string[]): FormularDefinition => ({
    fields: namen.map((n) => feld(n)),
});

const zeilen = (definition: FormularDefinition): LayoutZeile[] =>
    (definition.layout ?? []).filter((k): k is LayoutZeile => k.type === 'row');

describe('layoutSicherstellen', () => {
    it('macht aus der Feldreihenfolge ein ausdrueckliches Layout', () => {
        const { layout } = layoutSicherstellen(mit('a', 'b'));

        expect(layout).toHaveLength(2);
        expect(layout[0]).toEqual({ type: 'row', columns: [['a']] });
    });

    it('laesst ein vorhandenes Layout unangetastet', () => {
        const vorhanden: FormularDefinition = {
            fields: [feld('a'), feld('b')],
            layout: [{ type: 'row', columns: [['a'], ['b']] }],
        };

        expect(layoutSicherstellen(vorhanden).layout).toHaveLength(1);
    });
});

describe('naechsterFeldname', () => {
    it('ueberspringt einen bereits vergebenen Namen', () => {
        // Nach dem Loeschen von field_1 haette `length + 1` field_2 getroffen —
        // und der Waechter haette das Speichern abgelehnt.
        const definition = mit('field_2', 'field_3');

        expect(naechsterFeldname(definition)).toBe('field_4');
    });

    it('faengt bei einem leeren Formular mit field_1 an', () => {
        expect(naechsterFeldname({ fields: [] })).toBe('field_1');
    });
});

describe('feldEntfernen', () => {
    it('nimmt das Feld auch aus dem Layout', () => {
        const definition = feldEntfernen(
            {
                fields: [feld('a'), feld('b')],
                layout: [{ type: 'row', columns: [['a'], ['b']] }],
            },
            'a',
        );

        expect(definition.fields).toHaveLength(1);
        expect(zeilen(definition)[0]?.columns).toEqual([['b']]);
    });

    it('raeumt eine leer gewordene Zeile weg', () => {
        const definition = feldEntfernen(
            {
                fields: [feld('a'), feld('b')],
                layout: [
                    { type: 'row', columns: [['a']] },
                    { type: 'row', columns: [['b']] },
                ],
            },
            'a',
        );

        expect(zeilen(definition)).toHaveLength(1);
    });
});

describe('feldAendern', () => {
    it('zieht das Layout beim Umbenennen mit', () => {
        const definition = feldAendern(
            {
                fields: [feld('a'), feld('b')],
                layout: [{ type: 'row', columns: [['a'], ['b']] }],
            },
            'a',
            { name: 'vorname' },
        );

        // Ohne das Mitziehen zeigte das Layout ins Leere, und das Feld waere
        // aus seiner Spalte ans Ende des Formulars gerutscht.
        expect(zeilen(definition)[0]?.columns).toEqual([['vorname'], ['b']]);
        expect(felderInReihenfolge(definition).map((f) => f.name)).toEqual(['vorname', 'b']);
    });

    it('laesst das Layout in Ruhe, wenn nur die Beschriftung wechselt', () => {
        const definition = feldAendern(mit('a'), 'a', { label: 'Neue Beschriftung' });

        expect(definition.fields[0]?.label).toBe('Neue Beschriftung');
        expect(zeilen(definition)[0]?.columns).toEqual([['a']]);
    });
});

describe('feldVerschieben', () => {
    it('legt ein Feld neben ein anderes und macht daraus zwei Spalten', () => {
        const definition = feldVerschieben(mit('a', 'b'), 'b', {
            art: 'spalte',
            zeile: 0,
            position: 1,
        });

        expect(zeilen(definition)).toHaveLength(1);
        expect(zeilen(definition)[0]?.columns).toEqual([['a'], ['b']]);
    });

    it('nimmt hoechstens drei Spalten je Zeile an', () => {
        const voll: FormularDefinition = {
            fields: [feld('a'), feld('b'), feld('c'), feld('d')],
            layout: [
                { type: 'row', columns: [['a'], ['b'], ['c']] },
                { type: 'row', columns: [['d']] },
            ],
        };

        const definition = feldVerschieben(voll, 'd', { art: 'spalte', zeile: 0, position: 3 });

        expect(zeilen(definition)[0]?.columns).toHaveLength(3);
        // Das Feld bleibt, wo es war, statt zu verschwinden.
        expect(felderInReihenfolge(definition).map((f) => f.name)).toContain('d');
    });

    it('zieht ein Feld in eine neue Zeile an der gewuenschten Stelle', () => {
        const definition = feldVerschieben(mit('a', 'b', 'c'), 'c', {
            art: 'neueZeile',
            position: 0,
        });

        expect(felderInReihenfolge(definition).map((f) => f.name)).toEqual(['c', 'a', 'b']);
    });

    it('verliert kein Feld, wenn das Ziel durch das Herausnehmen wegfaellt', () => {
        const definition = feldVerschieben(mit('a'), 'a', {
            art: 'spalte',
            zeile: 0,
            position: 0,
        });

        expect(felderInReihenfolge(definition).map((f) => f.name)).toEqual(['a']);
    });

    it('laesst eine Definition unveraendert, wenn das Feld gar nicht existiert', () => {
        const vorher = mit('a');

        expect(feldVerschieben(vorher, 'gibtsnicht', { art: 'neueZeile', position: 0 }))
            .toEqual(vorher);
    });
});

describe('zeileVerschieben', () => {
    it('tauscht zwei Zeilen', () => {
        const definition = zeileVerschieben(mit('a', 'b'), 1, 0);

        expect(felderInReihenfolge(definition).map((f) => f.name)).toEqual(['b', 'a']);
    });

    it('ignoriert eine Position ausserhalb der Liste', () => {
        const definition = zeileVerschieben(mit('a', 'b'), 0, 9);

        expect(felderInReihenfolge(definition).map((f) => f.name)).toEqual(['a', 'b']);
    });
});

describe('feldHinzufuegen und Abschnitte', () => {
    it('haengt ein neues Feld als eigene Zeile an', () => {
        const definition = feldHinzufuegen(mit('a'), feld('b'));

        expect(zeilen(definition)).toHaveLength(2);
    });

    it('setzt einen Abschnitt an die gewuenschte Stelle', () => {
        const definition = abschnittHinzufuegen(mit('a', 'b'), 'Anreise', 1);

        expect(definition.layout?.[1]).toEqual({ type: 'section', title: 'Anreise' });
    });
});

describe('definitionBereinigen', () => {
    it('wirft leere Optionen beim Speichern weg — der Riegel an der Quelle', () => {
        const definition = definitionBereinigen({
            fields: [feld('anrede', { type: 'select', options: ['Frau', ' Herr ', '', 'Frau'] })],
        });

        expect(definition.fields[0]?.options).toEqual(['Frau', 'Herr']);
    });

    it('laesst ein Feld ohne Optionen unangetastet', () => {
        const definition = definitionBereinigen({ fields: [feld('name')] });

        expect(definition.fields[0]?.options).toBeUndefined();
    });
});

describe('Bearbeiten innerhalb eines Rahmens', () => {
    /**
     * Ohne Pfad las jede dieser Funktionen `layout[index]` — also die oberste
     * Ebene, egal aus welcher Gruppe der Griff kam. In einem Formular mit
     * Gruppen traf damit jeder Pfeil und jede Ablage die falsche Zeile.
     */
    const inGruppe = (): FormularDefinition => ({
        fields: [feld('a'), feld('b'), feld('c')],
        layout: [
            { type: 'row', columns: [['c']] },
            {
                type: 'group',
                id: 'g1',
                title: 'Anreise',
                children: [
                    { type: 'row', columns: [['a']] },
                    { type: 'row', columns: [['b']] },
                ],
            },
        ],
    });

    /**
     * Die Gruppe ueber ihren Typ suchen, nicht ueber ihren Index.
     *
     * Wird `c` aus seiner eigenen Zeile genommen, faellt die leere Zeile weg
     * und die Gruppe rueckt von Stelle 1 auf Stelle 0 — genau die Verschiebung,
     * wegen der die Funktion selbst mit der Rahmen-Kennung arbeitet.
     */
    const gruppeVon = (definition: FormularDefinition) => {
        const knoten = definition.layout?.find((eintrag) => eintrag.type === 'group');

        return knoten && knoten.type === 'group' ? knoten.children : [];
    };

    it('legt ein Feld in eine Spalte INNERHALB der Gruppe', () => {
        const danach = feldVerschieben(inGruppe(), 'c', {
            art: 'spalte',
            pfad: [1],
            zeile: 0,
            position: 1,
        });

        expect(gruppeVon(danach)[0]).toEqual({
            type: 'row',
            columns: [['a'], ['c']],
        });
    });

    it('legt eine neue Zeile INNERHALB der Gruppe an', () => {
        const danach = feldVerschieben(inGruppe(), 'c', {
            art: 'neueZeile',
            pfad: [1],
            position: 0,
        });

        expect(gruppeVon(danach)[0]).toEqual({ type: 'row', columns: [['c']] });
        expect(gruppeVon(danach)).toHaveLength(3);
    });

    it('vertauscht zwei Zeilen INNERHALB der Gruppe', () => {
        const danach = zeileVerschieben(inGruppe(), 1, 0, [1]);

        expect(gruppeVon(danach).map((k) => (k.type === 'row' ? k.columns : null))).toEqual([
            [['b']],
            [['a']],
        ]);
    });

    it('laesst alles in Ruhe, wenn der Pfad ins Leere zeigt', () => {
        // Ein Griff, der nichts trifft, darf nichts zerstoeren — und ein Feld,
        // das dabei irgendwo landet, waere schlimmer als eines, das bleibt.
        const vorher = inGruppe();
        const danach = feldVerschieben(vorher, 'c', {
            art: 'neueZeile',
            pfad: [7],
            position: 0,
        });

        expect(danach.layout).toEqual(vorher.layout);
    });

    it('entfernt einen Abschnitt INNERHALB der Gruppe', () => {
        const mitAbschnitt: FormularDefinition = {
            fields: [feld('a')],
            layout: [
                {
                    type: 'group',
                    id: 'g1',
                    children: [
                        { type: 'section', title: 'Zwischenueberschrift' },
                        { type: 'row', columns: [['a']] },
                    ],
                },
            ],
        };

        const danach = knotenEntfernen(mitAbschnitt, 0, [0]);
        const gruppe = danach.layout?.[0];

        expect(gruppe && gruppe.type === 'group' ? gruppe.children : []).toEqual([
            { type: 'row', columns: [['a']] },
        ]);
    });
});

describe('feldDuplizieren', () => {
    const basis = (): FormularDefinition => ({
        fields: [
            { name: 'a', label: 'Erste Frage', type: 'radio', options: ['x', 'y'], required: true },
            { name: 'b', label: 'Zweite Frage', type: 'text' },
        ],
        layout: [
            { type: 'row', columns: [['a']] },
            { type: 'row', columns: [['b']] },
        ],
    });

    it('legt die Kopie direkt unter das Original', () => {
        const neu = feldDuplizieren(basis(), 'a');
        const reihenfolge = neu.layout!.flatMap((k) =>
            k.type === 'row' ? k.columns.flat() : [],
        );

        // Am Ende des Formulars wäre die Kopie ein Sprung ohne Grund.
        expect(reihenfolge).toEqual(['a', expect.any(String), 'b']);
        expect(reihenfolge[1]).not.toBe('a');
    });

    it('gibt der Kopie einen neuen Datenschluessel', () => {
        const neu = feldDuplizieren(basis(), 'a');
        const namen = neu.fields.map((f) => f.name);

        // Zwei Felder mit demselben Namen beschreiben dieselbe Stelle in den
        // Antworten — die zweite überschriebe die erste.
        expect(new Set(namen).size).toBe(namen.length);
    });

    it('nimmt alles mit, was man sonst abtippen muesste', () => {
        const kopie = feldDuplizieren(basis(), 'a').fields.at(-1)!;

        expect(kopie.label).toBe('Erste Frage');
        expect(kopie.options).toEqual(['x', 'y']);
        expect(kopie.required).toBe(true);
    });

    it('kopiert die id NICHT mit', () => {
        const mitId: FormularDefinition = {
            fields: [{ id: 'f1', name: 'a', label: 'A', type: 'text' }],
            layout: [{ type: 'row', columns: [['a']] }],
        };

        // Zweimal dieselbe `id`, und der Editor bearbeitet beim Klick auf die
        // eine die andere.
        expect(feldDuplizieren(mitId, 'a').fields.at(-1)!.id).toBeUndefined();
    });

    it('laesst Bedingungen und Verzweigungen unangetastet', () => {
        const mitRegeln: FormularDefinition = {
            ...basis(),
            conditions: [
                {
                    id: 'r1',
                    target: { kind: 'field', ref: 'b' },
                    effect: 'show',
                    match: 'all',
                    tests: [{ field: 'a', op: 'is', value: 'x' }],
                },
            ],
        };

        expect(feldDuplizieren(mitRegeln, 'a').conditions).toEqual(mitRegeln.conditions);
    });
});

describe('feldUmordnen', () => {
    const inSchritt = (): FormularDefinition => ({
        fields: [
            { name: 'a', label: 'A', type: 'text' },
            { name: 'b', label: 'B', type: 'text' },
            { name: 'c', label: 'C', type: 'text' },
        ],
        layout: [
            {
                type: 'step',
                id: 's1',
                children: [
                    { type: 'row', columns: [['a']] },
                    { type: 'row', columns: [['b']] },
                ],
            },
            { type: 'row', columns: [['c']] },
        ],
    });

    const reihenfolgeIn = (d: FormularDefinition, i: number): string[] => {
        const knoten = d.layout![i]!;

        return knoten.type === 'step' || knoten.type === 'group'
            ? knoten.children.flatMap((k) => (k.type === 'row' ? k.columns.flat() : []))
            : [];
    };

    it('findet die Frage ueber ihren Namen, nicht ueber einen Index', () => {
        // Ein linearer Builder kennt keine Indizes und keine Pfade — er kennt
        // Fragen.
        expect(reihenfolgeIn(feldUmordnen(inSchritt(), 'b', 'hoch'), 0)).toEqual(['b', 'a']);
    });

    it('holt eine Frage nicht aus ihrem Schritt heraus', () => {
        // Ein Pfeil, der eine Frage aus ihrem Schritt befördert, wäre ein Umzug
        // und keine Reihenfolge.
        const neu = feldUmordnen(inSchritt(), 'a', 'hoch');

        expect(reihenfolgeIn(neu, 0)).toEqual(['a', 'b']);
        expect(neu.layout![1]).toEqual({ type: 'row', columns: [['c']] });
    });

    it('laesst eine unbekannte Frage die Definition unveraendert', () => {
        const vorher = inSchritt();

        expect(feldUmordnen(vorher, 'gibtsnicht', 'runter')).toEqual(vorher);
    });
});
