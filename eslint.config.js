import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        { 
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      
      // General code quality rules
      "prefer-const": "error",
      "no-var": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      
      // Import/export rules
      "no-duplicate-imports": "error",
      
      // Performance rules
      "no-await-in-loop": "warn",
      
      // Security rules
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "*.config.js",
      "coverage/**",
      ".next/**",
      "examples/**/.next/**",
      "**/.next/**",
      "test-results/**",
      "benchmark-results/**",
      ".test-isolation/**",
      "temp_build/**",
      ".dedup*/**",
      ".differential*/**",
      ".enigma/**",
      ".incremental/**",
      "scripts/test-*.js", // Allow test scripts but exclude from strict linting
    ],
  },
);
