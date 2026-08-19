/**
 * Kopiert `src/styles.css` nach `dist/styles.css`.
 *
 * Eigener Schritt, weil tsup nur die Einstiegspunkte kennt. Anders als beim
 * mail-builder wird hier nichts gebuendelt — es gibt keine fremde Bibliothek,
 * deren Grundstil mitmuss.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ziel = resolve(root, 'dist/styles.css');

mkdirSync(dirname(ziel), { recursive: true });
copyFileSync(resolve(root, 'src/styles.css'), ziel);

console.log('dist/styles.css geschrieben');
