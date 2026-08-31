import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sichtbarkeit } from '../sichtbarkeit';
import type { FormularDefinition } from '../types';

interface Prueffall {
    name: string;
    warum: string;
    definition: FormularDefinition;
    werte: Record<string, unknown>;
    erwartet: {
        sichtbareFelder: string[];
        pflichtFelder: string[];
        sichtbareGruppen: string[];
        sichtbareSchritte: string[];
        zyklen: string[];
    };
}

const ordner = join(__dirname, '..', '..', '..', 'faelle', 'sichtbarkeit');

function sortiert(menge: Set<string>): string[] {
    return [...menge].sort();
}

/**
 * Derselbe Satz faehrt gegen die PHP-Portierung.
 *
 * Die Sichtbarkeit wird zweimal entschieden: im Browser, damit das Formular
 * die richtigen Felder zeigt, und auf dem Server, damit er die richtigen
 * verlangt und die uebrigen wegwirft. Zwei Umsetzungen derselben Regel laufen
 * auseinander — und der Unterschied faellt nicht beim Programmieren auf,
 * sondern dann, wenn jemand ein Formular nicht abschicken kann.
 *
 * Deshalb liegen die Faelle als JSON neben beiden Sprachen und nicht als
 * Testcode in einer davon.
 */
describe('Sichtbarkeit — gemeinsamer Prueffallsatz', () => {
    const dateien = readdirSync(ordner).filter((datei) => datei.endsWith('.json'));

    it('findet den Prueffallordner', () => {
        // Ein leerer Ordner liesse die ganze Beschreibung gruen durchlaufen,
        // ohne dass eine einzige Regel geprueft waere.
        expect(dateien.length).toBeGreaterThan(10);
    });

    for (const datei of dateien) {
        const fall = JSON.parse(
            readFileSync(join(ordner, datei), 'utf-8'),
        ) as Prueffall;

        it(`${datei}: ${fall.name}`, () => {
            const ergebnis = sichtbarkeit(fall.definition, fall.werte);

            expect(sortiert(ergebnis.sichtbareFelder), fall.warum).toEqual(
                fall.erwartet.sichtbareFelder,
            );
            expect(sortiert(ergebnis.pflichtFelder), fall.warum).toEqual(
                fall.erwartet.pflichtFelder,
            );
            expect(sortiert(ergebnis.sichtbareGruppen)).toEqual(
                fall.erwartet.sichtbareGruppen,
            );
            expect(sortiert(ergebnis.sichtbareSchritte)).toEqual(
                fall.erwartet.sichtbareSchritte,
            );
            expect([...ergebnis.zyklen].sort()).toEqual(fall.erwartet.zyklen);
        });
    }
});
