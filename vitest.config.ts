import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        // Ohne `globals` haengt sich das automatische Aufraeumen von
        // @testing-library/react nicht ein: die Baeume frueherer Tests bleiben
        // im Dokument stehen, und jede Abfrage findet ihr Element mehrfach.
        globals: true,
        // Stubs fuer das, was jsdom fehlt und React Flow braucht. Steht hier
        // und nicht in den Testdateien: sonst haengt es daran, dass jede
        // einzelne daran denkt.
        setupFiles: ['./src/test-setup.ts'],
    },
    esbuild: {
        jsx: 'automatic',
    },
});
