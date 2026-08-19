import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        // Ohne `globals` haengt sich das automatische Aufraeumen von
        // @testing-library/react nicht ein: die Baeume frueherer Tests bleiben
        // im Dokument stehen, und jede Abfrage findet ihr Element mehrfach.
        globals: true,
    },
    esbuild: {
        jsx: 'automatic',
    },
});
