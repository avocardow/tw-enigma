/**
 * Configuration Schema Definition
 * Comprehensive schema for TW-Enigma configuration validation
 */

import { z } from 'zod';

// Basic type schemas
const StringArraySchema = z.array(z.string());
const BooleanSchema = z.boolean();
const NumberSchema = z.number();
const StringSchema = z.string();

// Optimization level enum
const OptimizationLevelSchema = z.enum(['none', 'basic', 'aggressive', 'extreme']);

// Framework detection schema
const FrameworkSchema = z.enum([
  'react',
  'vue',
  'angular',
  'svelte',
  'solid',
  'preact',
  'lit',
  'vanilla',
  'auto'
]);

// File discovery schema
const FileDiscoverySchema = z.object({
  /** Glob patterns for files to include */
  include: StringArraySchema.default(['**/*.{html,jsx,tsx,vue,svelte}']),
  /** Glob patterns for files to exclude */
  exclude: StringArraySchema.default(['node_modules/**', '.git/**', 'dist/**', 'build/**']),
  /** Maximum file size to process (in bytes) */
  maxFileSize: NumberSchema.default(10 * 1024 * 1024), // 10MB
  /** Follow symbolic links */
  followSymlinks: BooleanSchema.default(false),
  /** Process hidden files */
  includeHidden: BooleanSchema.default(false),
  /** Cache file discovery results */
  cache: BooleanSchema.default(true),
  /** Cache TTL in milliseconds */
  cacheTTL: NumberSchema.default(300000), // 5 minutes
});

// Class extraction schema
const ClassExtractionSchema = z.object({
  /** Extract classes from HTML class attributes */
  html: BooleanSchema.default(true),
  /** Extract classes from JavaScript/TypeScript files */
  javascript: BooleanSchema.default(true),
  /** Extract classes from CSS files */
  css: BooleanSchema.default(true),
  /** Extract classes from template literals */
  templateLiterals: BooleanSchema.default(true),
  /** Extract dynamic classes */
  dynamicClasses: BooleanSchema.default(true),
  /** Case sensitive extraction */
  caseSensitive: BooleanSchema.default(true),
  /** Ignore empty classes */
  ignoreEmpty: BooleanSchema.default(true),
  /** Custom regex patterns for extraction */
  customPatterns: z.array(z.string()).default([]),
  /** Framework-specific extraction rules */
  frameworkRules: z.record(z.string(), z.any()).default({}),
});

// Optimization schema
const OptimizationSchema = z.object({
  /** Optimization level */
  level: OptimizationLevelSchema.default('basic'),
  /** Enable class name scrambling */
  scrambleClassNames: BooleanSchema.default(true),
  /** Enable CSS minification */
  minifyCSS: BooleanSchema.default(true),
  /** Remove unused CSS classes */
  removeUnused: BooleanSchema.default(true),
  /** Merge similar CSS rules */
  mergeSimilar: BooleanSchema.default(true),
  /** Optimize media queries */
  optimizeMediaQueries: BooleanSchema.default(true),
  /** Optimize keyframes */
  optimizeKeyframes: BooleanSchema.default(true),
  /** Enable tree shaking */
  treeShaking: BooleanSchema.default(true),
  /** Preserve specific classes */
  preserveClasses: StringArraySchema.default([]),
  /** Optimization presets */
  presets: z.array(z.string()).default([]),
});

// Template literal processing schema
const TemplateLiteralSchema = z.object({
  /** Enable template literal detection */
  enabled: BooleanSchema.default(true),
  /** Include tagged template literals */
  includeTagged: BooleanSchema.default(true),
  /** Include multiline templates */
  includeMultiline: BooleanSchema.default(true),
  /** Maximum template length to process */
  maxLength: NumberSchema.default(10000),
  /** Enable AST parsing for complex templates */
  enableASTParsing: BooleanSchema.default(true),
  /** Enable fallback handling */
  enableFallback: BooleanSchema.default(true),
  /** Fallback strategies */
  fallbackStrategies: StringArraySchema.default(['preserve', 'static-extraction', 'pattern-matching']),
  /** Cache template parsing results */
  cache: BooleanSchema.default(true),
  /** Cache TTL in milliseconds */
  cacheTTL: NumberSchema.default(300000), // 5 minutes
});

// Performance schema
const PerformanceSchema = z.object({
  /** Enable performance monitoring */
  monitoring: BooleanSchema.default(false),
  /** Performance thresholds */
  thresholds: z.object({
    /** Maximum processing time per file (ms) */
    fileProcessingTime: NumberSchema.default(5000),
    /** Maximum memory usage (MB) */
    memoryUsage: NumberSchema.default(500),
    /** Maximum total processing time (ms) */
    totalProcessingTime: NumberSchema.default(60000),
  }).default({}),
  /** Enable parallel processing */
  parallel: BooleanSchema.default(true),
  /** Number of worker threads */
  workers: NumberSchema.default(4),
  /** Batch size for processing */
  batchSize: NumberSchema.default(100),
  /** Enable worker thread pool */
  useWorkerPool: BooleanSchema.default(true),
});

// Output schema
const OutputSchema = z.object({
  /** Output directory */
  outDir: StringSchema.default('./dist'),
  /** CSS output file name */
  cssFileName: StringSchema.default('styles.min.css'),
  /** Source map generation */
  sourceMaps: BooleanSchema.default(false),
  /** Asset versioning */
  versioning: BooleanSchema.default(false),
  /** Compression */
  compression: z.enum(['none', 'gzip', 'brotli', 'both']).default('none'),
  /** Generate report */
  generateReport: BooleanSchema.default(false),
  /** Report format */
  reportFormat: z.enum(['json', 'html', 'markdown']).default('json'),
  /** Clean output directory before build */
  clean: BooleanSchema.default(true),
});

// Framework-specific presets
const FrameworkPresetsSchema = z.object({
  /** React/Next.js preset */
  react: z.object({
    classExtraction: ClassExtractionSchema.partial(),
    optimization: OptimizationSchema.partial(),
    templateLiterals: TemplateLiteralSchema.partial(),
  }).optional(),
  /** Vue/Nuxt preset */
  vue: z.object({
    classExtraction: ClassExtractionSchema.partial(),
    optimization: OptimizationSchema.partial(),
    templateLiterals: TemplateLiteralSchema.partial(),
  }).optional(),
  /** Angular preset */
  angular: z.object({
    classExtraction: ClassExtractionSchema.partial(),
    optimization: OptimizationSchema.partial(),
    templateLiterals: TemplateLiteralSchema.partial(),
  }).optional(),
  /** Svelte preset */
  svelte: z.object({
    classExtraction: ClassExtractionSchema.partial(),
    optimization: OptimizationSchema.partial(),
    templateLiterals: TemplateLiteralSchema.partial(),
  }).optional(),
});

// Environment-specific configuration
const EnvironmentSchema = z.object({
  /** Development configuration */
  development: z.object({
    optimization: OptimizationSchema.partial(),
    performance: PerformanceSchema.partial(),
    output: OutputSchema.partial(),
  }).optional(),
  /** Production configuration */
  production: z.object({
    optimization: OptimizationSchema.partial(),
    performance: PerformanceSchema.partial(),
    output: OutputSchema.partial(),
  }).optional(),
  /** Test configuration */
  test: z.object({
    optimization: OptimizationSchema.partial(),
    performance: PerformanceSchema.partial(),
    output: OutputSchema.partial(),
  }).optional(),
});

// Logging configuration
const LoggingSchema = z.object({
  /** Log level */
  level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Enable colored output */
  colors: BooleanSchema.default(true),
  /** Enable timestamps */
  timestamps: BooleanSchema.default(true),
  /** Log to file */
  file: StringSchema.optional(),
  /** Maximum log file size */
  maxFileSize: NumberSchema.default(10 * 1024 * 1024), // 10MB
  /** Number of log files to keep */
  maxFiles: NumberSchema.default(5),
  /** Enable performance logging */
  performance: BooleanSchema.default(false),
  /** Enable debug logging for specific components */
  debugComponents: StringArraySchema.default([]),
});

// Plugin configuration
const PluginSchema = z.object({
  /** Plugin name or path */
  name: StringSchema,
  /** Plugin options */
  options: z.record(z.string(), z.any()).default({}),
  /** Plugin priority */
  priority: NumberSchema.default(0),
  /** Enable/disable plugin */
  enabled: BooleanSchema.default(true),
});

// Cache configuration
const CacheSchema = z.object({
  /** Enable caching */
  enabled: BooleanSchema.default(true),
  /** Cache directory */
  directory: StringSchema.default('.tw-enigma-cache'),
  /** Cache TTL in milliseconds */
  ttl: NumberSchema.default(86400000), // 24 hours
  /** Maximum cache size in MB */
  maxSize: NumberSchema.default(100),
  /** Clear cache on version change */
  clearOnVersionChange: BooleanSchema.default(true),
  /** Cache compression */
  compression: BooleanSchema.default(true),
});

// Main configuration schema
export const TWEnigmaConfigSchema = z.object({
  /** Configuration schema version */
  $schema: StringSchema.optional(),
  
  /** Extend from another configuration */
  extends: z.union([StringSchema, StringArraySchema]).optional(),
  
  /** Project root directory */
  root: StringSchema.default(process.cwd()),
  
  /** Target framework */
  framework: FrameworkSchema.default('auto'),
  
  /** File discovery configuration */
  files: FileDiscoverySchema.default({}),
  
  /** Class extraction configuration */
  extraction: ClassExtractionSchema.default({}),
  
  /** Optimization configuration */
  optimization: OptimizationSchema.default({}),
  
  /** Template literal processing */
  templateLiterals: TemplateLiteralSchema.default({}),
  
  /** Performance configuration */
  performance: PerformanceSchema.default({}),
  
  /** Output configuration */
  output: OutputSchema.default({}),
  
  /** Framework-specific presets */
  presets: FrameworkPresetsSchema.default({}),
  
  /** Environment-specific configuration */
  environments: EnvironmentSchema.default({}),
  
  /** Logging configuration */
  logging: LoggingSchema.default({}),
  
  /** Plugin configuration */
  plugins: z.array(PluginSchema).default([]),
  
  /** Cache configuration */
  cache: CacheSchema.default({}),
  
  /** Custom configuration options */
  custom: z.record(z.string(), z.any()).default({}),
});

export type TWEnigmaConfig = z.infer<typeof TWEnigmaConfigSchema>;

// Partial schemas for incremental validation
export const PartialTWEnigmaConfigSchema = TWEnigmaConfigSchema.partial();

// Environment variable mapping
export const ENV_VAR_MAPPING: Record<string, string> = {
  'TW_ENIGMA_ROOT': 'root',
  'TW_ENIGMA_FRAMEWORK': 'framework',
  'TW_ENIGMA_OPTIMIZATION_LEVEL': 'optimization.level',
  'TW_ENIGMA_SCRAMBLE_CLASSES': 'optimization.scrambleClassNames',
  'TW_ENIGMA_MINIFY_CSS': 'optimization.minifyCSS',
  'TW_ENIGMA_REMOVE_UNUSED': 'optimization.removeUnused',
  'TW_ENIGMA_OUT_DIR': 'output.outDir',
  'TW_ENIGMA_CSS_FILE_NAME': 'output.cssFileName',
  'TW_ENIGMA_SOURCE_MAPS': 'output.sourceMaps',
  'TW_ENIGMA_LOG_LEVEL': 'logging.level',
  'TW_ENIGMA_CACHE_ENABLED': 'cache.enabled',
  'TW_ENIGMA_CACHE_DIR': 'cache.directory',
  'TW_ENIGMA_PERFORMANCE_MONITORING': 'performance.monitoring',
  'TW_ENIGMA_PARALLEL': 'performance.parallel',
  'TW_ENIGMA_WORKERS': 'performance.workers',
  'TW_ENIGMA_TEMPLATE_LITERALS': 'templateLiterals.enabled',
  'TW_ENIGMA_AST_PARSING': 'templateLiterals.enableASTParsing',
  'TW_ENIGMA_FALLBACK': 'templateLiterals.enableFallback',
};

// CLI flag mapping
export const CLI_FLAG_MAPPING: Record<string, string> = {
  '--root': 'root',
  '--framework': 'framework',
  '--optimization': 'optimization.level',
  '--no-scramble': 'optimization.scrambleClassNames',
  '--no-minify': 'optimization.minifyCSS',
  '--no-remove-unused': 'optimization.removeUnused',
  '--out-dir': 'output.outDir',
  '--css-file': 'output.cssFileName',
  '--source-maps': 'output.sourceMaps',
  '--log-level': 'logging.level',
  '--no-cache': 'cache.enabled',
  '--cache-dir': 'cache.directory',
  '--performance': 'performance.monitoring',
  '--no-parallel': 'performance.parallel',
  '--workers': 'performance.workers',
  '--no-template-literals': 'templateLiterals.enabled',
  '--no-ast-parsing': 'templateLiterals.enableASTParsing',
  '--no-fallback': 'templateLiterals.enableFallback',
  '--clean': 'output.clean',
  '--no-clean': 'output.clean',
  '--compression': 'output.compression',
  '--report': 'output.generateReport',
  '--report-format': 'output.reportFormat',
};

// Default configuration presets
export const DEFAULT_PRESETS = {
  development: {
    optimization: {
      level: 'basic' as const,
      scrambleClassNames: false,
      minifyCSS: false,
      removeUnused: false,
    },
    output: {
      sourceMaps: true,
      generateReport: true,
      reportFormat: 'html' as const,
    },
    logging: {
      level: 'debug' as const,
      performance: true,
    },
    performance: {
      monitoring: true,
    },
  },
  production: {
    optimization: {
      level: 'aggressive' as const,
      scrambleClassNames: true,
      minifyCSS: true,
      removeUnused: true,
      mergeSimilar: true,
      treeShaking: true,
    },
    output: {
      sourceMaps: false,
      compression: 'both' as const,
      versioning: true,
      generateReport: true,
    },
    logging: {
      level: 'warn' as const,
      performance: false,
    },
    performance: {
      monitoring: false,
      parallel: true,
    },
  },
  test: {
    optimization: {
      level: 'none' as const,
      scrambleClassNames: false,
      minifyCSS: false,
      removeUnused: false,
    },
    output: {
      sourceMaps: true,
      generateReport: false,
    },
    logging: {
      level: 'error' as const,
      performance: false,
    },
    performance: {
      monitoring: false,
      parallel: false,
    },
  },
};

export default TWEnigmaConfigSchema;