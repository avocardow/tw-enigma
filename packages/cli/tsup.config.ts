import { defineConfig } from 'tsup';

export default defineConfig([
  // Build src/index.ts without shebang
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
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
  // Build bin/enigma.ts with shebang
  {
    entry: ['bin/enigma.ts'],
    format: ['cjs'],
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
