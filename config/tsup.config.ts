import { defineConfig } from "tsup";

export default defineConfig([
  // Library build (ESM)
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: false, // Skip DTS due to errors
    splitting: false,
    sourcemap: false,
    clean: true,
    external: ["postcss", "os", "path", "fs", "fs/promises", "memfs"],
    banner: {
      js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
      `.trim()
    },
  },
  // CLI build (ESM with externals)
  {
    entry: ["bin/enigma.ts"],
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    target: "node16",
    platform: "node",
    external: ["postcss", "os", "path", "fs", "fs/promises"],
    banner: {
      js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
      `.trim()
    },
  },
]);
