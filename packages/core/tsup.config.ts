import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: {
      incremental: false,
      composite: false,
    }
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  minify: false,
  external: [],
}); 