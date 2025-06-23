import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry point
  {
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
      // Webpack types (not bundled)
      'webpack',
    ],
  },
  // Webpack plugin entry point
  {
    entry: ['src/webpack.ts'],
    format: ['cjs', 'esm'],
    dts: {
      compilerOptions: {
        incremental: false,
        composite: false,
      },
    },
    splitting: false,
    sourcemap: true,
    target: 'es2020',
    minify: false,
    outDir: 'dist',
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.js',
        dts: '.d.ts',
      };
    },
    clean: false, // Don't clean since we have multiple entries
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
      // Webpack types (not bundled)
      'webpack',
    ],
  },
  // Tailwind plugin entry point
  {
    entry: ['src/tailwindPlugin.js'],
    format: ['cjs', 'esm'],
    dts: {
      compilerOptions: {
        incremental: false,
        composite: false,
      },
    },
    splitting: false,
    sourcemap: true,
    target: 'es2020',
    minify: false,
    outDir: 'dist',
    outExtension({ format }) {
      return {
        js: format === 'esm' ? '.mjs' : '.js',
      };
    },
    clean: false,
    external: ['tailwindcss/plugin', 'fs', 'path'],
  },
]);
