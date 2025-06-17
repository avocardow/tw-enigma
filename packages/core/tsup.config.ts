import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      incremental: false,
      composite: false,
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  minify: false,
  external: [
    // External dependencies that should not be bundled
    'postcss',
    'tailwindcss',
    '@babel/parser',
    '@babel/traverse',
    '@babel/generator',
    '@babel/types',
    // Node.js built-ins
    'fs',
    'path',
    'crypto',
    'util',
    'stream',
    'events',
  ],
});
