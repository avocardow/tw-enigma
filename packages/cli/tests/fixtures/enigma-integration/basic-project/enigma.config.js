export default {
  // Input/Output settings
  input: "./src",
  output: "./dist",
  
  // Processing options
  minify: true,
  removeUnused: true,
  preserveComments: false,
  sourceMaps: false,
  
  // File discovery
  followSymlinks: false,
  maxFiles: 100,
  includeFileTypes: ["HTML", "JAVASCRIPT"],
  excludeExtensions: [".min.js", ".min.css"],
  excludePatterns: ["node_modules/**", "*.test.*"],
  
  // Performance
  maxConcurrency: 4,
  
  // Logging
  verbose: false,
  debug: false,
  logLevel: "info",
  
  // Advanced options
  classPrefix: "tw-"
};