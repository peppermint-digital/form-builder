import { describe, expect, it } from 'vitest';

import {
    abschnittHinzufuegen,
    definitionBereinigen,
    feldAendern,
    feldEntfernen,
    feldHinzufuegen,
    feldVerschieben,
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
