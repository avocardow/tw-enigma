import { defineConfig } from 'tsup';

export default defineConfig([
  // Build src/index.ts as ES module
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: {
      compilerOptions: {
        incremental: false,
        composite: false,
      },
    },
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
    minify: false,
    external: ['@tw-enigma/core'],
  },
  // Build bin/enigma.ts as ES module (no banner since source has shebang)
  {
    entry: ['bin/enigma.ts'],
    format: ['esm'],
    dts: {
      compilerOptions: {
        incremental: false,
        composite: false,
      },
    },
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
    minify: false,
    external: ['@tw-enigma/core'],
  },
]);
