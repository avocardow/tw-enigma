import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "bin/enigma.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
});
