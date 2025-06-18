/**
 * Create a sample configuration file content for users
 */
export function createSampleConfig(minimumLength?: number): string {
  // Step 3: Generate nameGeneration section conditionally
  const nameGenerationSection = minimumLength
    ? `
  // Name Generation Options
  nameGeneration: {
    // Minimum length for generated class names (enforce consistent naming)
    minimumLength: ${minimumLength},

    // Strategy for name generation
    strategy: "sequential", // "sequential", "frequency-optimized", "hybrid", "pretty"

    // Custom alphabet for name generation
    // alphabet: "abcdefghijklmnopqrstuvwxyz",

    // Prefix and suffix for generated names
    // prefix: "",
    // suffix: "",

    // Whether to use numeric suffixes (e.g., a1, a2)
    // numericSuffix: false,

    // Whether generated names must be CSS-valid
    // ensureCssValid: true
  },`
    : `
  // Name Generation Options
  // nameGeneration: {
  //   // Minimum length for generated class names (enforce consistent naming)
  //   minimumLength: 1,
  //
  //   // Strategy for name generation
  //   strategy: "sequential", // "sequential", "frequency-optimized", "hybrid", "pretty"
  //
  //   // Custom alphabet for name generation
  //   // alphabet: "abcdefghijklmnopqrstuvwxyz",
  //
  //   // Prefix and suffix for generated names
  //   // prefix: "",
  //   // suffix: "",
  //
  //   // Whether to use numeric suffixes (e.g., a1, a2)
  //   // numericSuffix: false,
  //
  //   // Whether generated names must be CSS-valid
  //   // ensureCssValid: true
  // },`;

  // Step 3: Generate nameGeneration section conditionally
  const nameGenerationSection = minimumLength
    ? `
  // Name Generation Options
  nameGeneration: {
    // Minimum length for generated class names (enforce consistent naming)
    minimumLength: ${minimumLength},

    // Strategy for name generation
    strategy: "sequential", // "sequential", "frequency-optimized", "hybrid", "pretty"

    // Custom alphabet for name generation
    // alphabet: "abcdefghijklmnopqrstuvwxyz",

    // Prefix and suffix for generated names
    // prefix: "",
    // suffix: "",

    // Whether to use numeric suffixes (e.g., a1, a2)
    // numericSuffix: false,

    // Whether generated names must be CSS-valid
    // ensureCssValid: true
  },`
    : `
  // Name Generation Options
  // nameGeneration: {
  //   // Minimum length for generated class names (enforce consistent naming)
  //   minimumLength: 1,
  //
  //   // Strategy for name generation
  //   strategy: "sequential", // "sequential", "frequency-optimized", "hybrid", "pretty"
  //
  //   // Custom alphabet for name generation
  //   // alphabet: "abcdefghijklmnopqrstuvwxyz",
  //
  //   // Prefix and suffix for generated names
  //   // prefix: "",
  //   // suffix: "",
  //
  //   // Whether to use numeric suffixes (e.g., a1, a2)
  //   // numericSuffix: false,
  //
  //   // Whether generated names must be CSS-valid
  //   // ensureCssValid: true
  // },`;

  return `// enigma.config.js
module.exports = {
  // Output settings
  pretty: false,

  // File processing
  input: "./src",
  output: "./dist",

  // Processing options
  minify: true,
  removeUnused: true,

  // Debug and logging
  verbose: false,
  debug: false,

  // Performance settings
  maxConcurrency: 4,

  // Output customization
  classPrefix: "",
  excludePatterns: ["node_modules/**", "*.test.*"],

  // File Discovery Options
  followSymlinks: false,
  // maxFiles: 1000,
  // includeFileTypes: ["HTML", "JAVASCRIPT"],
  excludeExtensions: [".min.js", ".min.css"],

  // Advanced options
  preserveComments: false,
  sourceMaps: false,
${nameGenerationSection}

  // Environment Variable Support for Name Generation:
  // You can also configure name generation using environment variables:
  // TW_ENIGMA_NAME_GENERATION_MINIMUM_LENGTH=3
  // TW_ENIGMA_NAME_GENERATION_STRATEGY=sequential
  // TW_ENIGMA_NAME_GENERATION_ALPHABET=abcdefghijklm
  // TW_ENIGMA_NAME_GENERATION_PREFIX=tw-
  // TW_ENIGMA_NAME_GENERATION_SUFFIX=-gen
  // TW_ENIGMA_NAME_GENERATION_NUMERIC_SUFFIX=false
  // TW_ENIGMA_NAME_GENERATION_ENSURE_CSS_VALID=true
  //
  // Configuration Priority: CLI flags > Environment variables > Config file
};
`;
}
