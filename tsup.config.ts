import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        'core/index': 'src/core/index.ts',
        'react/index': 'src/react/index.tsx',
        // Eigener Einstiegspunkt, damit React Flow NICHT im Kernbuendel
        // landet. Wer nur Formulare zeichnet, soll keine Graphen-Bibliothek
        // mitladen — und ein Vue-Adapter kann es ohnehin nicht gebrauchen.
        'react/graph/index': 'src/react/graph/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    // Kein Bundling der Peer-Abhaengigkeiten: zwei React-Instanzen im selben
    // Baum brechen die Hooks der einbindenden Anwendung.
    external: ['react', 'react-dom', 'vue', '@xyflow/react'],
});
