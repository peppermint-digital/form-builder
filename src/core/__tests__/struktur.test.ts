import { describe, expect, it } from 'vitest';

import {
    abschnittHinzufuegen,
    definitionBereinigen,
    feldAendern,
    feldEntfernen,
    feldHinzufuegen,
    feldVerschieben,
    layoutSicherstellen,
    zeileVerschieben,
} from '../bearbeiten';
import {
    definitionLesen,
    felderInReihenfolge,
    layoutAufloesen,
    schritteAufloesen,
} from '../definition';
import type { Bedingungsregel, FormularDefinition } from '../types';

const feld = (name: string) => ({ name, label: name, type: 'text' as const });

const regel: Bedingungsregel = {
    id: 'r1',
    target: { kind: 'field', ref: 'hotel' },
    effect: 'show',
    match: 'all',
    tests: [{ field: 'anreise', op: 'is', value: 'ja' }],
};

describe('definitionLesen', () => {
    it('reicht Bedingungen, Ablauf und Anordnung durch', () => {
        // Der Editor liest hierdurch und schreibt zurueck, was er haelt.
        // Faellt hier etwas weg, sind die Bedingungen nach dem naechsten
        // Speichern verschwunden — ohne dass irgendetwas fehlschlaegt.
        const gelesen = definitionLesen({
            fields: [feld('anreise'), feld('hotel')],
            conditions: [regel],
            flow: [{ id: 'k1', from: 's1', to: 's2' }],
            graph: { positions: { hotel: { x: 10, y: 20 } } },
        });

        expect(gelesen.conditions).toEqual([regel]);
        expect(gelesen.flow).toHaveLength(1);
        expect(gelesen.graph?.positions?.hotel).toEqual({ x: 10, y: 20 });
    });

    it('wirft eine halbe Bedingungsregel weg', () => {
        const gelesen = definitionLesen({
            fields: [feld('hotel')],
            conditions: [
                regel,
                // Ohne Ziel: was diese Regel sichtbar machen soll, waere Zufall.
                { id: 'r2', effect: 'show', match: 'all', tests: [] },
            ],
        } as never);

        expect(gelesen.conditions).toEqual([regel]);
    });

    it('gibt einem Bestandsformular keine neuen Schluessel', () => {
        // Ein `conditions: []` im gespeicherten JSON waere ein Unterschied,
        // den niemand gemacht hat — und er taucht in jedem Vergleich auf.
        const gelesen = definitionLesen([feld('email')]);

        expect(gelesen).toEqual({ fields: [feld('email')] });
    });
});

describe('layoutAufloesen mit Gruppen', () => {
    it('loest eine Gruppe mit ihrem Inhalt auf', () => {
        const knoten = layoutAufloesen({
            fields: [feld('a'), feld('b')],
            layout: [
                {
                    type: 'group',
                    id: 'g1',
                    title: 'Anreise',
                    children: [{ type: 'row', columns: [['a'], ['b']] }],
                },
            ],
        });

        expect(knoten).toHaveLength(1);
        expect(knoten[0]).toMatchObject({ type: 'group', id: 'g1', title: 'Anreise' });
        expect(knoten[0]!.type === 'group' && knoten[0]!.children).toHaveLength(1);
    });

    it('laesst eine leer geraeumte Gruppe weg', () => {
        // Sonst steht im Formular ein Rahmen ohne Inhalt — entsteht, sobald
        // jemand die Felder darin loescht.
        const knoten = layoutAufloesen({
            fields: [feld('a')],
            layout: [
                { type: 'group', id: 'g1', children: [{ type: 'row', columns: [['weg']] }] },
                { type: 'row', columns: [['a']] },
            ],
        });

        expect(knoten.map((k) => k.type)).toEqual(['row']);
    });

    it('zeigt ein Feld nur einmal, auch ueber Gruppengrenzen hinweg', () => {
        // Zwei Eingabefelder auf denselben Datenschluessel ueberschreiben
        // sich gegenseitig; welches gewinnt, waere Zufall.
        const knoten = layoutAufloesen({
            fields: [feld('a')],
            layout: [
                { type: 'group', id: 'g1', children: [{ type: 'row', columns: [['a']] }] },
                { type: 'group', id: 'g2', children: [{ type: 'row', columns: [['a']] }] },
            ],
        });

        expect(knoten).toHaveLength(1);
    });

    it('haengt ein Feld an, das in keinem Layout-Knoten steht', () => {
        // Ein Feld darf niemals unsichtbar werden, nur weil das Layout es
        // nicht kennt — sonst faellt ein Pflichtfeld lautlos aus dem Formular.
        const felder = felderInReihenfolge({
            fields: [feld('a'), feld('vergessen')],
            layout: [
                { type: 'group', id: 'g1', children: [{ type: 'row', columns: [['a']] }] },
            ],
        });

        expect(felder.map((f) => f.name)).toEqual(['a', 'vergessen']);
    });

    it('ueberspringt einen Knoten ohne Spalten, statt die Seite mitzureissen', () => {
        // Vorher griff der Rueckfall blind auf `columns` zu.
        const knoten = layoutAufloesen({
            fields: [feld('a')],
            layout: [{ type: 'unbekannt' } as never, { type: 'row', columns: [['a']] }],
        });

        expect(knoten).toHaveLength(1);
    });
});

describe('schritteAufloesen', () => {
    const einstufig: FormularDefinition = {
        fields: [feld('a')],
        layout: [{ type: 'row', columns: [['a']] }],
    };

    it('macht aus einem Formular ohne Schritte einen impliziten Schritt', () => {
        const schritte = schritteAufloesen(einstufig);

        expect(schritte).toHaveLength(1);
        // Die Zeichenseite braucht das Kennzeichen: ohne es wuerde aus jedem
        // bestehenden Formular ein „Schritt 1 von 1" mit Fortschrittsanzeige.
        expect(schritte[0]!.implizit).toBe(true);
    });

    it('gibt die Schritte in Reihenfolge zurueck', () => {
        const schritte = schritteAufloesen({
            fields: [feld('a'), feld('b')],
            layout: [
                { type: 'step', id: 's1', title: 'Person', children: [{ type: 'row', columns: [['a']] }] },
                { type: 'step', id: 's2', title: 'Anreise', children: [{ type: 'row', columns: [['b']] }] },
            ],
        });

        expect(schritte.map((s) => s.id)).toEqual(['s1', 's2']);
        expect(schritte[0]!.implizit).toBeUndefined();
    });

    it('faengt einen losen Knoten vor dem ersten Schritt in einem impliziten auf', () => {
        const schritte = schritteAufloesen({
            fields: [feld('a'), feld('b')],
            layout: [
                { type: 'row', columns: [['a']] },
                { type: 'step', id: 's2', children: [{ type: 'row', columns: [['b']] }] },
            ],
        });

        expect(schritte.map((s) => s.id)).toEqual(['schritt-1', 's2']);
        expect(schritte[0]!.implizit).toBe(true);
    });

    it('schlaegt ein Feld ohne Layout-Platz dem letzten Schritt zu', () => {
        // Auf der letzten Seite ist es sichtbar — nirgends waere es weg.
        const schritte = schritteAufloesen({
            fields: [feld('a'), feld('vergessen')],
            layout: [
                { type: 'step', id: 's1', children: [{ type: 'row', columns: [['a']] }] },
            ],
        });

        expect(schritte).toHaveLength(1);
        expect(felderAus(schritte[0]!.knoten)).toEqual(['a', 'vergessen']);
    });
});

function felderAus(knoten: ReturnType<typeof layoutAufloesen>): string[] {
    return knoten.flatMap((eintrag) => {
        if (eintrag.type === 'row') {
            return eintrag.columns.flat().map((f) => f.name);
        }

        if (eintrag.type === 'group' || eintrag.type === 'step') {
            return felderAus(eintrag.children);
        }

        return [];
    });
}

describe('layoutSicherstellen', () => {
    it('behaelt die Bedingungen, wenn es ein Layout ergaenzt', () => {
        // Der Editor ruft das bei jedem Handgriff. Ging hier etwas verloren,
        // waeren die Bedingungen nach dem ersten Verschieben weg.
        const ergaenzt = layoutSicherstellen({
            fields: [feld('a')],
            conditions: [regel],
        });

        expect(ergaenzt.layout).toHaveLength(1);
        expect(ergaenzt.conditions).toEqual([regel]);
    });

    it('behaelt die Bedingungen auch bei vorhandenem Layout', () => {
        const ergaenzt = layoutSicherstellen({
            fields: [feld('a')],
            layout: [{ type: 'row', columns: [['a']] }],
            conditions: [regel],
        });

        expect(ergaenzt.conditions).toEqual([regel]);
    });
});

describe('Jeder Editor-Handgriff behält die Bedingungen', () => {
    /**
     * Der Fehler, der hier abgefangen wird, war in JEDER Bearbeitungsfunktion.
     *
     * Sie bauten ihr Ergebnis als `{ fields, layout }` neu auf. Alles, was
     * sonst noch an der Definition hängt — Bedingungen, Ablauf, Anordnung —
     * fiel damit bei jedem Ziehen, Umbenennen und Hinzufügen weg. Lautlos:
     * ein Formular ohne Bedingungen sieht aus wie eines, bei dem nie welche
     * eingestellt waren.
     */
    const mitAllem: FormularDefinition = {
        fields: [feld('a'), feld('b')],
        layout: [
            { type: 'row', columns: [['a']] },
            { type: 'row', columns: [['b']] },
        ],
        conditions: [regel],
        flow: [{ id: 'k1', from: 's1', to: 's2' }],
        graph: { positions: { 'feld:a': { x: 5, y: 5 } } },
    };

    const behaeltAlles = (danach: FormularDefinition) => {
        expect(danach.conditions).toEqual(mitAllem.conditions);
        expect(danach.flow).toEqual(mitAllem.flow);
        expect(danach.graph).toEqual(mitAllem.graph);
    };

    it('beim Hinzufügen', () => {
        behaeltAlles(feldHinzufuegen(mitAllem, feld('c')));
    });

    it('beim Entfernen', () => {
        behaeltAlles(feldEntfernen(mitAllem, 'b'));
    });

    it('beim Ändern der Beschriftung', () => {
        behaeltAlles(feldAendern(mitAllem, 'a', { label: 'Neu' }));
    });

    it('beim Umbenennen', () => {
        behaeltAlles(feldAendern(mitAllem, 'a', { name: 'a_neu' }));
    });

    it('beim Verschieben', () => {
        behaeltAlles(
            feldVerschieben(mitAllem, 'b', { art: 'neueZeile', position: 0 }),
        );
    });

    it('beim Verschieben einer Zeile', () => {
        behaeltAlles(zeileVerschieben(mitAllem, 0, 1));
    });

    it('beim Hinzufügen eines Abschnitts', () => {
        behaeltAlles(abschnittHinzufuegen(mitAllem, 'Überschrift'));
    });

    it('beim Bereinigen vor dem Speichern', () => {
        behaeltAlles(definitionBereinigen(mitAllem));
    });
});
