import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        'core/index': 'src/core/index.ts',
        'react/index': 'src/react/index.tsx',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    // Kein Bundling der Peer-Abhaengigkeiten: zwei React-Instanzen im selben
    // Baum brechen die Hooks der einbindenden Anwendung.
    external: ['react', 'react-dom', 'vue'],
});
