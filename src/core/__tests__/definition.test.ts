import { describe, expect, it } from 'vitest';

import {
    definitionLesen,
    felderInReihenfolge,
    labelStehtImFeld,
    layoutAufloesen,
    nutzbareOptionen,
    optionenMitBestandswert,
} from '../definition';
import type { FormularFeld } from '../types';

const feld = (name: string, rest: Partial<FormularFeld> = {}): FormularFeld => ({
    name,
    label: name,
    type: 'text',
    ...rest,
});

describe('definitionLesen', () => {
    it('nimmt die nackte Feldliste aelterer Bestaende an', () => {
        const gelesen = definitionLesen([feld('email')]);

        expect(gelesen.fields).toHaveLength(1);
        expect(gelesen.layout).toBeUndefined();
    });

    it('nimmt das Objekt mit fields an', () => {
        const gelesen = definitionLesen({ fields: [feld('email')] });

        expect(gelesen.fields).toHaveLength(1);
    });

    it('macht aus null eine leere Definition statt zu werfen', () => {
        expect(definitionLesen(null).fields).toEqual([]);
        expect(definitionLesen(undefined).fields).toEqual([]);
    });

    it('verwirft Eintraege ohne Namen — sie haetten keinen Datenschluessel', () => {
        const gelesen = definitionLesen({
            fields: [feld('email'), { label: 'kaputt' } as FormularFeld],
        });

        expect(gelesen.fields.map((f) => f.name)).toEqual(['email']);
    });
});

describe('nutzbareOptionen', () => {
    it('verwirft den leeren Eintrag aus dem abschliessenden Zeilenumbruch', () => {
        const optionen = nutzbareOptionen(
            feld('anrede', { options: ['Frau', 'Herr', ''] }),
        );

        expect(optionen).toEqual(['Frau', 'Herr']);
    });

    it('trimmt und fasst Doppeltes zusammen', () => {
        const optionen = nutzbareOptionen(
            feld('anrede', { options: [' Frau ', 'Frau', 'Herr'] }),
        );

        expect(optionen).toEqual(['Frau', 'Herr']);
    });

    it('kommt ohne options aus', () => {
        expect(nutzbareOptionen(feld('name'))).toEqual([]);
    });
});

describe('labelStehtImFeld', () => {
    it('gilt fuer Ankreuzfelder', () => {
        expect(labelStehtImFeld('checkbox')).toBe(true);
        expect(labelStehtImFeld('text')).toBe(false);
    });

    it('kennt produkteigene Typen nur, wenn die Anwendung sie anmeldet', () => {
        expect(labelStehtImFeld('hotel_booking')).toBe(false);
        expect(labelStehtImFeld('hotel_booking', ['hotel_booking'])).toBe(true);
    });
});

describe('layoutAufloesen', () => {
    it('rendert ohne Layout alles einspaltig in Feldreihenfolge', () => {
        const knoten = layoutAufloesen({
            fields: [feld('vorname'), feld('nachname')],
        });

        expect(knoten).toHaveLength(2);
        expect(knoten.every((k) => k.type === 'row')).toBe(true);
        expect(felderInReihenfolge({ fields: [feld('vorname'), feld('nachname')] }).map((f) => f.name))
            .toEqual(['vorname', 'nachname']);
    });

    it('baut zweispaltige Zeilen aus den Feldnamen', () => {
        const knoten = layoutAufloesen({
            fields: [feld('vorname'), feld('nachname')],
            layout: [{ type: 'row', columns: [['vorname'], ['nachname']] }],
        });

        expect(knoten).toHaveLength(1);
        expect(knoten[0]).toMatchObject({ type: 'row' });
        expect((knoten[0] as { columns: FormularFeld[][] }).columns).toHaveLength(2);
    });

    it('haengt ein Feld, das im Layout fehlt, hinten an statt es zu verschlucken', () => {
        const knoten = layoutAufloesen({
            fields: [feld('vorname'), feld('email')],
            layout: [{ type: 'row', columns: [['vorname']] }],
        });

        expect(felderInReihenfolge({
            fields: [feld('vorname'), feld('email')],
            layout: [{ type: 'row', columns: [['vorname']] }],
        }).map((f) => f.name)).toEqual(['vorname', 'email']);
        expect(knoten).toHaveLength(2);
    });

    it('ueberspringt Verweise auf geloeschte Felder', () => {
        const knoten = layoutAufloesen({
            fields: [feld('vorname')],
            layout: [{ type: 'row', columns: [['vorname'], ['weg']] }],
        });

        expect((knoten[0] as { columns: FormularFeld[][] }).columns).toHaveLength(1);
    });

    it('laesst eine Zeile weg, deren Felder alle geloescht wurden', () => {
        const knoten = layoutAufloesen({
            fields: [feld('vorname')],
            layout: [
                { type: 'row', columns: [['weg']] },
                { type: 'row', columns: [['vorname']] },
            ],
        });

        expect(knoten).toHaveLength(1);
    });

    it('rendert denselben Namen nur einmal — zwei Eingaben auf einen Schluessel wuerden sich ueberschreiben', () => {
        const definition = {
            fields: [feld('email')],
            layout: [
                { type: 'row' as const, columns: [['email'], ['email']] },
            ],
        };

        expect(felderInReihenfolge(definition).map((f) => f.name)).toEqual(['email']);
    });

    it('reicht Abschnitte durch', () => {
        const knoten = layoutAufloesen({
            fields: [feld('vorname')],
            layout: [
                { type: 'section', title: 'Anreise', description: 'Bitte ausfuellen' },
                { type: 'row', columns: [['vorname']] },
            ],
        });

        expect(knoten[0]).toEqual({
            type: 'section',
            title: 'Anreise',
            description: 'Bitte ausfuellen',
        });
    });
});

describe('optionenMitBestandswert', () => {
    it('haengt einen gespeicherten Wert an, der nicht mehr zur Auswahl steht', () => {
        const optionen = optionenMitBestandswert(
            feld('anrede', { options: ['Frau', 'Herr'] }),
            'Divers',
        );

        expect(optionen).toHaveLength(3);
        expect(optionen[2]).toEqual({
            wert: 'Divers',
            label: 'Divers (nicht mehr zur Auswahl)',
            bestandswert: true,
        });
    });

    it('haengt nichts an, wenn der Wert zur Auswahl steht', () => {
        const optionen = optionenMitBestandswert(
            feld('anrede', { options: ['Frau', 'Herr'] }),
            'Frau',
        );

        expect(optionen).toHaveLength(2);
    });

    it('haengt nichts an, wenn nichts gespeichert ist', () => {
        expect(
            optionenMitBestandswert(feld('anrede', { options: ['Frau'] }), ''),
        ).toHaveLength(1);
    });

    it('laesst ein Freitextfeld unangetastet — dort gibt es keine Abweichung', () => {
        expect(optionenMitBestandswert(feld('name'), 'Irgendwas')).toEqual([]);
    });
});
