/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cosmiconfig, cosmiconfigSync } from "cosmiconfig";
import { z } from "zod";
import {
  HtmlExtractionOptionsSchema,
  type HtmlExtractionOptions,
} from "./htmlExtractor.ts";
import {
  JsExtractionOptionsSchema,
  type JsExtractionOptions,
} from "./jsExtractor.ts";
import {
  CssInjectionOptionsSchema,
  type CssInjectionOptions,
} from "./cssInjector.ts";
import {
  FileIntegrityOptionsSchema,
  type FileIntegrityOptions,
} from "./fileIntegrity.ts";
import {
  SimpleValidatorConfigSchema,
  type SimpleValidatorConfig,
} from "./patternValidator.ts";
import { ConfigError, ValidationError } from "./errors.ts";
import { createLogger } from "./logger.ts";

// Create a logger instance for this module
const logger = createLogger('config');
import { createRuntimeValidator } from "./runtimeValidator.ts";
import { createConfigWatcher } from "./configWatcher.ts";
import type { ValidationResult } from "./configValidator.ts";
import type { RuntimeValidator } from "./runtimeValidator.ts";
import type { ConfigWatcher } from "./configWatcher.ts";
import type { ConfigSafeUpdater } from "./configSafeUpdater.ts";
import { createConfigValidator } from './configValidator.ts';
import { createConfigMigration, type ConfigMigration } from './configMigration.ts';
import { createPerformanceValidator, type PerformanceMetrics } from './performanceValidator.ts';
import { createConfigBackup, type ConfigBackup } from './configBackup.ts';
import { createConfigDefaults, type Environment } from './configDefaults.ts';

// Re-export ConfigError for backward compatibility
export { ConfigError };

/**
 * Configuration schema using Zod for validation
 * Defines all possible configuration options for Tailwind Enigma
 */
export const EnigmaConfigSchema = z.object({
  // Output settings
  pretty: z
    .boolean()
    .default(false)
    .describe("Enable pretty output formatting"),

  // File processing
  input: z.string().default('./src').describe("Input file or directory to process"),
  output: z.union([
    z.string(),
    z.object({
      format: z.string().default("css"),
      filename: z.string().default("optimized.css"),
      preserveOriginal: z.boolean().default(true),
    })
  ]).default('./dist').describe("Output file or directory or output settings"),

  // Processing options
  minify: z.boolean().default(true).describe("Minify the output CSS"),
  removeUnused: z.boolean().default(true).describe("Remove unused CSS classes"),

  // Debug and logging
  verbose: z.boolean().default(false).describe("Enable verbose logging"),
  veryVerbose: z
    .boolean()
    .default(false)
    .describe("Enable very verbose logging"),
  quiet: z
    .boolean()
    .default(false)
    .describe("Quiet mode (only warnings and errors)"),
  debug: z.boolean().default(false).describe("Enable debug mode"),
  logLevel: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .optional()
    .describe("Set the minimum log level"),
  logFile: z.string().optional().describe("Write logs to file"),
  logFormat: z
    .enum(["human", "json", "csv"])
    .optional()
    .describe("Format for file logging"),

  // Performance settings
  maxConcurrency: z
    .number()
    .min(1)
    .max(10)
    .default(4)
    .describe("Maximum concurrent file processing"),

  // Output customization
  classPrefix: z
    .string()
    .default("")
    .describe("Prefix for generated class names"),
  excludePatterns: z
    .array(z.string())
    .default([])
    .describe("Patterns to exclude from processing"),

  // File Discovery Options
  followSymlinks: z
    .boolean()
    .default(false)
    .describe("Follow symbolic links during file discovery"),
  maxFiles: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum number of files to process"),
  includeFileTypes: z
    .array(z.enum(["HTML", "JAVASCRIPT", "CSS", "TEMPLATE"]))
    .optional()
    .describe("Specific file types to include"),
  excludeExtensions: z
    .array(z.string())
    .default([])
    .describe("File extensions to exclude"),

  // Advanced options
  preserveComments: z
    .boolean()
    .default(false)
    .describe("Preserve CSS comments in output"),
  sourceMaps: z.boolean().default(false).describe("Generate source maps"),

  // Development Experience Options
  dev: z
    .object({
      enabled: z.boolean().default(false).describe("Enable development mode"),
      watch: z.boolean().default(false).describe("Watch files for changes"),
      server: z
        .object({
          enabled: z.boolean().default(false).describe("Enable development server"),
          port: z.number().min(1024).max(65535).default(3000).describe("Server port"),
          host: z.string().default("localhost").describe("Server host"),
          open: z.boolean().default(false).describe("Open browser automatically"),
        })
        .default({})
        .describe("Development server configuration"),
      diagnostics: z
        .object({
          enabled: z.boolean().default(true).describe("Enable diagnostics"),
          performance: z.boolean().default(true).describe("Track performance metrics"),
          memory: z.boolean().default(true).describe("Monitor memory usage"),
          fileWatcher: z.boolean().default(true).describe("Monitor file changes"),
          classAnalysis: z.boolean().default(true).describe("Analyze class patterns"),
          thresholds: z
            .object({
              memoryWarning: z.number().default(512).describe("Memory warning threshold (MB)"),
              memoryError: z.number().default(1024).describe("Memory error threshold (MB)"),
              cpuWarning: z.number().default(80).describe("CPU warning threshold (%)"),
              cpuError: z.number().default(95).describe("CPU error threshold (%)"),
            })
            .default({})
            .describe("Performance threshold configuration"),
        })
        .default({})
        .describe("Development diagnostics configuration"),
      preview: z
        .object({
          enabled: z.boolean().default(false).describe("Enable real-time preview"),
          autoRefresh: z.boolean().default(true).describe("Auto-refresh on changes"),
          showDiff: z.boolean().default(true).describe("Show optimization diff"),
          highlightChanges: z.boolean().default(true).describe("Highlight changed classes"),
        })
        .default({})
        .describe("Real-time preview configuration"),
      dashboard: z
        .object({
          enabled: z.boolean().default(false).describe("Enable developer dashboard"),
          port: z.number().min(1024).max(65535).default(3001).describe("Dashboard server port"),
          host: z.string().default("localhost").describe("Dashboard server host"),
          updateInterval: z.number().min(100).default(1000).describe("Update interval in ms"),
          showMetrics: z.boolean().default(true).describe("Show performance metrics"),
          showLogs: z.boolean().default(true).describe("Show recent logs"),
          maxLogEntries: z.number().min(10).max(1000).default(100).describe("Max log entries to keep"),
        })
        .default({})
        .describe("Developer dashboard configuration"),
    })
    .default({})
    .describe("Development mode configuration"),

  // HTML Class Extractor Configuration
  htmlExtractor: HtmlExtractionOptionsSchema.optional().describe(
    "HTML class extraction configuration options",
  ),

  // JavaScript/JSX Class Extractor Configuration
  jsExtractor: JsExtractionOptionsSchema.optional().describe(
    "JavaScript/JSX class extraction configuration options",
  ),

  // CSS Injection Configuration
  cssInjector: CssInjectionOptionsSchema.optional().describe(
    "CSS injection configuration options",
  ),

  // File Integrity Validation Configuration
  fileIntegrity: FileIntegrityOptionsSchema.optional().describe(
    "File integrity validation configuration options",
  ),

  // Pattern Validator Configuration
  patternValidator: SimpleValidatorConfigSchema.optional().describe(
    "Pattern validation configuration options",
  ),

  // Enhanced Configuration Validation and Safety System
  validation: z
    .object({
      enabled: z.boolean().default(true).describe("Enable enhanced configuration validation"),
      validateOnLoad: z.boolean().default(true).describe("Validate configuration when loading"),
      validateOnChange: z.boolean().default(true).describe("Validate configuration on file changes"),
      strictMode: z.boolean().default(false).describe("Enable strict validation mode"),
      warnOnDeprecated: z.boolean().default(true).describe("Warn about deprecated configuration options"),
      failOnInvalid: z.boolean().default(true).describe("Fail on invalid configuration"),
      crossFieldValidation: z.boolean().default(true).describe("Enable cross-field validation"),
      securityValidation: z.boolean().default(true).describe("Enable security validation"),
      performanceValidation: z.boolean().default(true).describe("Enable performance validation"),
      customRules: z.array(z.string()).default([]).describe("Custom validation rule files"),
    })
    .default({})
    .describe("Enhanced configuration validation settings"),

  // Runtime Validation Configuration
  runtime: z
    .object({
      enabled: z.boolean().default(false).describe("Enable runtime configuration monitoring"),
      checkInterval: z.number().min(1000).default(5000).describe("Runtime check interval in milliseconds"),
      resourceThresholds: z
        .object({
          memory: z.number().default(1024 * 1024 * 1024).describe("Memory threshold in bytes"),
          cpu: z.number().min(0).max(100).default(80).describe("CPU threshold percentage"),
          fileHandles: z.number().default(1000).describe("File handle threshold"),
          diskSpace: z.number().default(100 * 1024 * 1024).describe("Disk space threshold in bytes"),
        })
        .default({})
        .describe("Resource usage thresholds"),
      autoCorrection: z
        .object({
          enabled: z.boolean().default(false).describe("Enable automatic configuration correction"),
          maxAttempts: z.number().min(1).default(3).describe("Maximum correction attempts"),
          fallbackToDefaults: z.boolean().default(true).describe("Fallback to default values on failure"),
        })
        .default({})
        .describe("Automatic correction settings"),
    })
    .default({})
    .describe("Runtime validation configuration"),

  // File Watching Configuration
  watcher: z
    .object({
      enabled: z.boolean().default(false).describe("Enable configuration file watching"),
      debounceMs: z.number().min(100).default(300).describe("File change debounce time in milliseconds"),
      followSymlinks: z.boolean().default(false).describe("Follow symbolic links when watching"),
      ignoreInitial: z.boolean().default(true).describe("Ignore initial file events"),
      validateOnChange: z.boolean().default(true).describe("Validate configuration on file changes"),
      backupOnChange: z.boolean().default(true).describe("Create backup before applying changes"),
      maxBackups: z.number().min(1).default(10).describe("Maximum number of backups to keep"),
      watchPatterns: z
        .array(z.string())
        .default(["**/.enigmarc*", "**/enigma.config.*", "**/package.json"])
        .describe("File patterns to watch"),
      ignorePatterns: z
        .array(z.string())
        .default(["**/node_modules/**", "**/.git/**", "**/dist/**"])
        .describe("File patterns to ignore"),
    })
    .default({})
    .describe("Configuration file watching settings"),

  // Safe Update Configuration
  safeUpdates: z
    .object({
      enabled: z.boolean().default(true).describe("Enable safe configuration updates"),
      validateBeforeWrite: z.boolean().default(true).describe("Validate configuration before writing"),
      createBackup: z.boolean().default(true).describe("Create backup before updating"),
      atomicWrite: z.boolean().default(true).describe("Use atomic write operations"),
      verifyAfterWrite: z.boolean().default(true).describe("Verify configuration after writing"),
      rollbackOnFailure: z.boolean().default(true).describe("Rollback on update failure"),
      maxBackups: z.number().min(1).default(10).describe("Maximum number of backups to keep"),
      backupDirectory: z.string().optional().describe("Custom backup directory"),
      retryAttempts: z.number().min(0).default(3).describe("Number of retry attempts on failure"),
      retryDelay: z.number().min(0).default(100).describe("Delay between retry attempts in milliseconds"),
    })
         .default({})
     .describe("Safe configuration update settings"),
});

/**
 * Inferred TypeScript type from the Zod schema
 */
export type EnigmaConfig = z.infer<typeof EnigmaConfigSchema>;

/**
 * CLI arguments interface for type safety
 */
export interface CliArguments {
  pretty?: boolean;
  config?: string;
  verbose?: boolean;
  veryVerbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
  logLevel?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  logFile?: string;
  logFormat?: "human" | "json" | "csv";
  input?: string;
  output?: string;
  minify?: boolean;
  removeUnused?: boolean;
  maxConcurrency?: number;
  classPrefix?: string;
  excludePatterns?: string[];
  followSymlinks?: boolean;
  maxFiles?: number;
  includeFileTypes?: ("HTML" | "JAVASCRIPT" | "CSS" | "TEMPLATE")[];
  excludeExtensions?: string[];
  preserveComments?: boolean;
  sourceMaps?: boolean;
  // HTML extractor CLI options
  htmlCaseSensitive?: boolean;
  htmlIgnoreEmpty?: boolean;
  htmlMaxFileSize?: number;
  htmlTimeout?: number;
  htmlPreserveWhitespace?: boolean;
  // JavaScript/JSX extractor CLI options
  jsEnableFrameworkDetection?: boolean;
  jsIncludeDynamicClasses?: boolean;
  jsCaseSensitive?: boolean;
  jsIgnoreEmpty?: boolean;
  jsMaxFileSize?: number;
  jsTimeout?: number;
  jsSupportedFrameworks?: string[];
  // CSS injector CLI options
  cssPath?: string;
  htmlPath?: string;
  cssUseRelativePaths?: boolean;
  cssPreventDuplicates?: boolean;
  cssInsertPosition?: "first" | "last" | "before-existing" | "after-meta";
  cssCreateBackup?: boolean;
  cssMaxFileSize?: number;
  cssTimeout?: number;
  // File integrity CLI options
  integrityAlgorithm?: "md5" | "sha1" | "sha256" | "sha512";
  integrityCreateBackups?: boolean;
  integrityBackupDirectory?: string;
  integrityBackupRetentionDays?: number;
  integrityMaxFileSize?: number;
  integrityTimeout?: number;
  integrityVerifyAfterRollback?: boolean;
  integrityBatchSize?: number;
  integrityEnableCaching?: boolean;
  integrityCacheSize?: number;
  // File integrity compression options
  integrityEnableCompression?: boolean;
  integrityCompressionAlgorithm?: "gzip" | "deflate" | "brotli";
  integrityCompressionLevel?: number;
  integrityCompressionThreshold?: number;
  // File integrity deduplication options
  integrityEnableDeduplication?: boolean;
  integrityDeduplicationDirectory?: string;
  integrityDeduplicationAlgorithm?: "md5" | "sha1" | "sha256" | "sha512";
  integrityDeduplicationThreshold?: number;
  integrityUseHardLinks?: boolean;
  // File integrity incremental backup options
  integrityEnableIncrementalBackup?: boolean;
  integrityBackupStrategy?: "full" | "incremental" | "auto";
  integrityChangeDetectionMethod?: "mtime" | "checksum" | "hybrid";
  integrityMaxIncrementalChain?: number;
  integrityFullBackupInterval?: number;
  integrityIncrementalDirectory?: string;
  // File integrity differential backup options
  integrityEnableDifferentialBackup?: boolean;
  integrityDifferentialStrategy?: "auto" | "manual" | "threshold-based";
  integrityDifferentialFullBackupThreshold?: number;
  integrityDifferentialFullBackupInterval?: number;
  integrityDifferentialDirectory?: string;
  integrityDifferentialSizeMultiplier?: number;
  // File integrity batch processing options
  integrityEnableBatchProcessing?: boolean;
  integrityMinBatchSize?: number;
  integrityMaxBatchSize?: number;
  integrityDynamicBatchSizing?: boolean;
  integrityMemoryThreshold?: number;
  integrityCpuThreshold?: number;
  integrityEventLoopLagThreshold?: number;
  integrityBatchProcessingStrategy?: "sequential" | "parallel" | "adaptive";
  integrityEnableProgressTracking?: boolean;
  integrityProgressUpdateInterval?: number;
  // Pattern Validator CLI options (simplified)
  patternValidatorEnable?: boolean;
  patternValidatorSkipInvalid?: boolean;
  patternValidatorWarnOnInvalid?: boolean;
  patternValidatorCustomClasses?: string[];
  // Dry run mode option
  dryRun?: boolean;

  // Development mode CLI options
  dev?: boolean;
  devWatch?: boolean;
  devServer?: boolean;
  devServerPort?: number;
  devServerHost?: string;
  devServerOpen?: boolean;
  devDiagnostics?: boolean;
  devDiagnosticsPerformance?: boolean;
  devDiagnosticsMemory?: boolean;
  devDiagnosticsFileWatcher?: boolean;
  devDiagnosticsClassAnalysis?: boolean;
  devPreview?: boolean;
  devPreviewAutoRefresh?: boolean;
  devPreviewShowDiff?: boolean;
  devPreviewHighlightChanges?: boolean;
  devDashboard?: boolean;
  devDashboardUpdateInterval?: number;
  devDashboardShowMetrics?: boolean;
  devDashboardShowLogs?: boolean;
  devDashboardMaxLogEntries?: number;
}

/**
 * Configuration loading result
 */
export interface ConfigResult {
  config: EnigmaConfig;
  filepath?: string;
  isEmpty?: boolean;
  validation?: ValidationResult;
  runtimeValidator?: RuntimeValidator;
  watcher?: ConfigWatcher;
  safeUpdater?: ConfigSafeUpdater;
}

// Create a logger instance for configuration operations
const configLogger = createLogger("Config");

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: EnigmaConfig = {
  pretty: false,
  minify: true,
  removeUnused: true,
  verbose: false,
  veryVerbose: false,
  quiet: false,
  debug: false,
  maxConcurrency: 4,
  classPrefix: "",
  excludePatterns: [],
  followSymlinks: false,
  excludeExtensions: [],
  preserveComments: false,
  sourceMaps: false,
  // Add missing required properties with defaults
  validation: {
    enabled: true,
    validateOnLoad: true,
    validateOnChange: true,
    strictMode: false,
    warnOnDeprecated: true,
    failOnInvalid: true,
    crossFieldValidation: true,
    securityValidation: true,
    performanceValidation: true,
    customRules: [],
  },
  dev: {
    enabled: false,
    watch: false,
    server: {
      enabled: false,
      port: 3000,
      host: "localhost",
      open: false,
    },
    diagnostics: {
      enabled: true,
      performance: true,
      memory: true,
      fileWatcher: true,
      classAnalysis: true,
      thresholds: {
        memoryWarning: 512,
        memoryError: 1024,
        cpuWarning: 80,
        cpuError: 95,
      },
    },
    preview: {
      enabled: false,
      autoRefresh: true,
      showDiff: true,
      highlightChanges: true,
    },
    dashboard: {
      enabled: false,
      port: 3001,
      host: "localhost",
      updateInterval: 1000,
      showMetrics: true,
      showLogs: true,
      maxLogEntries: 100,
    },
  },
  runtime: {
    enabled: true,
    checkInterval: 5000,
    resourceThresholds: {
      memory: 1024 * 1024 * 1024,
      cpu: 80,
      fileHandles: 1000,
      diskSpace: 100 * 1024 * 1024,
    },
    autoCorrection: {
      enabled: true,
      maxAttempts: 3,
      fallbackToDefaults: true,
    },
  },
  watcher: {
    enabled: false,
    followSymlinks: false,
    validateOnChange: true,
    debounceMs: 300,
    ignoreInitial: false,
    backupOnChange: true,
    maxBackups: 10,
    watchPatterns: [],
    ignorePatterns: [],
  },
  safeUpdates: {
    enabled: true,
    createBackup: true,
    backupDirectory: '.config-backups',
    maxBackups: 10,
    validateBeforeWrite: true,
    rollbackOnFailure: true,
    atomicWrite: true,
    verifyAfterWrite: true,
    retryAttempts: 3,
    retryDelay: 1000,
  },
};

/**
 * Deep merge utility for configuration objects
 * Later values take precedence over earlier ones
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Partial<T>>
): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>,
        );
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Check if value is a plain object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === "object" && !Array.isArray(item);
}

/**
 * Convert CLI arguments to configuration format
 */
function normalizeCliArguments(args: CliArguments): Partial<EnigmaConfig> {
  const config: Partial<EnigmaConfig> = {};

  // Map CLI arguments to config properties
  if (args.pretty !== undefined) config.pretty = args.pretty;
  if (args.verbose !== undefined) config.verbose = args.verbose;
  if (args.veryVerbose !== undefined) config.veryVerbose = args.veryVerbose;
  if (args.quiet !== undefined) config.quiet = args.quiet;
  if (args.debug !== undefined) config.debug = args.debug;
  if (args.logLevel !== undefined) config.logLevel = args.logLevel;
  if (args.logFile !== undefined) config.logFile = args.logFile;
  if (args.logFormat !== undefined) config.logFormat = args.logFormat;
  if (args.input !== undefined) config.input = args.input;
  if (args.output !== undefined) config.output = args.output;
  if (args.minify !== undefined) config.minify = args.minify;
  if (args.removeUnused !== undefined) config.removeUnused = args.removeUnused;
  if (args.maxConcurrency !== undefined)
    config.maxConcurrency = args.maxConcurrency;
  if (args.classPrefix !== undefined) config.classPrefix = args.classPrefix;
  if (args.excludePatterns !== undefined)
    config.excludePatterns = args.excludePatterns;
  if (args.followSymlinks !== undefined)
    config.followSymlinks = args.followSymlinks;
  if (args.maxFiles !== undefined) config.maxFiles = args.maxFiles;
  if (args.includeFileTypes !== undefined)
    config.includeFileTypes = args.includeFileTypes;
  if (args.excludeExtensions !== undefined)
    config.excludeExtensions = args.excludeExtensions;
  if (args.preserveComments !== undefined)
    config.preserveComments = args.preserveComments;
  if (args.sourceMaps !== undefined) config.sourceMaps = args.sourceMaps;

  // HTML extractor options
  const htmlExtractorConfig: Partial<HtmlExtractionOptions> = {};
  if (args.htmlCaseSensitive !== undefined)
    htmlExtractorConfig.caseSensitive = args.htmlCaseSensitive;
  if (args.htmlIgnoreEmpty !== undefined)
    htmlExtractorConfig.ignoreEmpty = args.htmlIgnoreEmpty;
  if (args.htmlMaxFileSize !== undefined)
    htmlExtractorConfig.maxFileSize = args.htmlMaxFileSize;
  if (args.htmlTimeout !== undefined)
    htmlExtractorConfig.timeout = args.htmlTimeout;
  if (args.htmlPreserveWhitespace !== undefined)
    htmlExtractorConfig.preserveWhitespace = args.htmlPreserveWhitespace;

  if (Object.keys(htmlExtractorConfig).length > 0) {
    // Apply defaults using the schema to ensure all fields have proper values
    config.htmlExtractor =
      HtmlExtractionOptionsSchema.parse(htmlExtractorConfig);
  }

  // JavaScript/JSX extractor options
  const jsExtractorConfig: Partial<JsExtractionOptions> = {};
  if (args.jsEnableFrameworkDetection !== undefined)
    jsExtractorConfig.enableFrameworkDetection =
      args.jsEnableFrameworkDetection;
  if (args.jsIncludeDynamicClasses !== undefined)
    jsExtractorConfig.includeDynamicClasses = args.jsIncludeDynamicClasses;
  if (args.jsCaseSensitive !== undefined)
    jsExtractorConfig.caseSensitive = args.jsCaseSensitive;
  if (args.jsIgnoreEmpty !== undefined)
    jsExtractorConfig.ignoreEmpty = args.jsIgnoreEmpty;
  if (args.jsMaxFileSize !== undefined)
    jsExtractorConfig.maxFileSize = args.jsMaxFileSize;
  if (args.jsTimeout !== undefined) jsExtractorConfig.timeout = args.jsTimeout;
  if (args.jsSupportedFrameworks !== undefined)
    jsExtractorConfig.supportedFrameworks = args.jsSupportedFrameworks;

  if (Object.keys(jsExtractorConfig).length > 0) {
    // Apply defaults using the schema to ensure all fields have proper values
    config.jsExtractor = JsExtractionOptionsSchema.parse(jsExtractorConfig);
  }

  // CSS injector options
  const cssInjectorConfig: Partial<CssInjectionOptions> = {};
  if (args.cssPath !== undefined) cssInjectorConfig.cssPath = args.cssPath;
  if (args.htmlPath !== undefined) cssInjectorConfig.htmlPath = args.htmlPath;
  if (args.cssUseRelativePaths !== undefined)
    cssInjectorConfig.useRelativePaths = args.cssUseRelativePaths;
  if (args.cssPreventDuplicates !== undefined)
    cssInjectorConfig.preventDuplicates = args.cssPreventDuplicates;
  if (args.cssInsertPosition !== undefined)
    cssInjectorConfig.insertPosition = args.cssInsertPosition;
  if (args.cssCreateBackup !== undefined)
    cssInjectorConfig.createBackup = args.cssCreateBackup;
  if (args.cssMaxFileSize !== undefined)
    cssInjectorConfig.maxFileSize = args.cssMaxFileSize;
  if (args.cssTimeout !== undefined)
    cssInjectorConfig.timeout = args.cssTimeout;

  if (Object.keys(cssInjectorConfig).length > 0) {
    // Apply defaults using the schema to ensure all fields have proper values
    config.cssInjector = CssInjectionOptionsSchema.parse(cssInjectorConfig);
  }

  // File integrity options
  const fileIntegrityConfig: Partial<FileIntegrityOptions> = {};
  if (args.integrityAlgorithm !== undefined)
    fileIntegrityConfig.algorithm = args.integrityAlgorithm;
  if (args.integrityCreateBackups !== undefined)
    fileIntegrityConfig.createBackups = args.integrityCreateBackups;
  if (args.integrityBackupDirectory !== undefined)
    fileIntegrityConfig.backupDirectory = args.integrityBackupDirectory;
  if (args.integrityBackupRetentionDays !== undefined)
    fileIntegrityConfig.backupRetentionDays = args.integrityBackupRetentionDays;
  if (args.integrityMaxFileSize !== undefined)
    fileIntegrityConfig.maxFileSize = args.integrityMaxFileSize;
  if (args.integrityTimeout !== undefined)
    fileIntegrityConfig.timeout = args.integrityTimeout;
  if (args.integrityVerifyAfterRollback !== undefined)
    fileIntegrityConfig.verifyAfterRollback = args.integrityVerifyAfterRollback;
  if (args.integrityBatchSize !== undefined)
    fileIntegrityConfig.batchSize = args.integrityBatchSize;
  if (args.integrityEnableCaching !== undefined)
    fileIntegrityConfig.enableCaching = args.integrityEnableCaching;
  if (args.integrityCacheSize !== undefined)
    fileIntegrityConfig.cacheSize = args.integrityCacheSize;
  // Compression options
  if (args.integrityEnableCompression !== undefined)
    fileIntegrityConfig.enableCompression = args.integrityEnableCompression;
  if (args.integrityCompressionAlgorithm !== undefined)
    fileIntegrityConfig.compressionAlgorithm =
      args.integrityCompressionAlgorithm;
  if (args.integrityCompressionLevel !== undefined)
    fileIntegrityConfig.compressionLevel = args.integrityCompressionLevel;
  if (args.integrityCompressionThreshold !== undefined)
    fileIntegrityConfig.compressionThreshold =
      args.integrityCompressionThreshold;
  // Deduplication options
  if (args.integrityEnableDeduplication !== undefined)
    fileIntegrityConfig.enableDeduplication = args.integrityEnableDeduplication;
  if (args.integrityDeduplicationDirectory !== undefined)
    fileIntegrityConfig.deduplicationDirectory =
      args.integrityDeduplicationDirectory;
  if (args.integrityDeduplicationAlgorithm !== undefined)
    fileIntegrityConfig.deduplicationAlgorithm =
      args.integrityDeduplicationAlgorithm;
  if (args.integrityDeduplicationThreshold !== undefined)
    fileIntegrityConfig.deduplicationThreshold =
      args.integrityDeduplicationThreshold;
  if (args.integrityUseHardLinks !== undefined)
    fileIntegrityConfig.useHardLinks = args.integrityUseHardLinks;
  // Incremental backup options
  if (args.integrityEnableIncrementalBackup !== undefined)
    fileIntegrityConfig.enableIncrementalBackup =
      args.integrityEnableIncrementalBackup;
  if (args.integrityBackupStrategy !== undefined)
    fileIntegrityConfig.backupStrategy = args.integrityBackupStrategy;
  if (args.integrityChangeDetectionMethod !== undefined)
    fileIntegrityConfig.changeDetectionMethod =
      args.integrityChangeDetectionMethod;
  if (args.integrityMaxIncrementalChain !== undefined)
    fileIntegrityConfig.maxIncrementalChain = args.integrityMaxIncrementalChain;
  if (args.integrityFullBackupInterval !== undefined)
    fileIntegrityConfig.fullBackupInterval = args.integrityFullBackupInterval;
  if (args.integrityIncrementalDirectory !== undefined)
    fileIntegrityConfig.incrementalDirectory =
      args.integrityIncrementalDirectory;

  // Differential backup options
  if (args.integrityEnableDifferentialBackup !== undefined)
    fileIntegrityConfig.enableDifferentialBackup =
      args.integrityEnableDifferentialBackup;
  if (args.integrityDifferentialStrategy !== undefined)
    fileIntegrityConfig.differentialStrategy =
      args.integrityDifferentialStrategy;
  if (args.integrityDifferentialFullBackupThreshold !== undefined)
    fileIntegrityConfig.differentialFullBackupThreshold =
      args.integrityDifferentialFullBackupThreshold;
  if (args.integrityDifferentialFullBackupInterval !== undefined)
    fileIntegrityConfig.differentialFullBackupInterval =
      args.integrityDifferentialFullBackupInterval;
  if (args.integrityDifferentialDirectory !== undefined)
    fileIntegrityConfig.differentialDirectory =
      args.integrityDifferentialDirectory;
  if (args.integrityDifferentialSizeMultiplier !== undefined)
    fileIntegrityConfig.differentialSizeMultiplier =
      args.integrityDifferentialSizeMultiplier;

  // Batch processing options
  if (args.integrityEnableBatchProcessing !== undefined)
    fileIntegrityConfig.enableBatchProcessing =
      args.integrityEnableBatchProcessing;
  if (args.integrityMinBatchSize !== undefined)
    fileIntegrityConfig.minBatchSize = args.integrityMinBatchSize;
  if (args.integrityMaxBatchSize !== undefined)
    fileIntegrityConfig.maxBatchSize = args.integrityMaxBatchSize;
  if (args.integrityDynamicBatchSizing !== undefined)
    fileIntegrityConfig.dynamicBatchSizing = args.integrityDynamicBatchSizing;
  if (args.integrityMemoryThreshold !== undefined)
    fileIntegrityConfig.memoryThreshold = args.integrityMemoryThreshold;
  if (args.integrityCpuThreshold !== undefined)
    fileIntegrityConfig.cpuThreshold = args.integrityCpuThreshold;
  if (args.integrityEventLoopLagThreshold !== undefined)
    fileIntegrityConfig.eventLoopLagThreshold =
      args.integrityEventLoopLagThreshold;
  if (args.integrityBatchProcessingStrategy !== undefined)
    fileIntegrityConfig.batchProcessingStrategy =
      args.integrityBatchProcessingStrategy;
  if (args.integrityEnableProgressTracking !== undefined)
    fileIntegrityConfig.enableProgressTracking =
      args.integrityEnableProgressTracking;
  if (args.integrityProgressUpdateInterval !== undefined)
    fileIntegrityConfig.progressUpdateInterval =
      args.integrityProgressUpdateInterval;

  if (Object.keys(fileIntegrityConfig).length > 0) {
    // Apply defaults using the schema to ensure all fields have proper values
    config.fileIntegrity =
      FileIntegrityOptionsSchema.parse(fileIntegrityConfig);
  }

  // Pattern validator options (simplified)
  const patternValidatorConfig: Partial<SimpleValidatorConfig> = {};
  if (args.patternValidatorEnable !== undefined)
    patternValidatorConfig.enableValidation = args.patternValidatorEnable;
  if (args.patternValidatorSkipInvalid !== undefined)
    patternValidatorConfig.skipInvalidClasses =
      args.patternValidatorSkipInvalid;
  if (args.patternValidatorWarnOnInvalid !== undefined)
    patternValidatorConfig.warnOnInvalidClasses =
      args.patternValidatorWarnOnInvalid;
  if (args.patternValidatorCustomClasses !== undefined)
    patternValidatorConfig.customClasses = args.patternValidatorCustomClasses;

  if (Object.keys(patternValidatorConfig).length > 0) {
    // Apply defaults using the schema to ensure all fields have proper values
    config.patternValidator = SimpleValidatorConfigSchema.parse(
      patternValidatorConfig,
    );
  }

  // Development mode options
  const devConfig: any = {};
  if (args.dev !== undefined) devConfig.enabled = args.dev;
  if (args.devWatch !== undefined) devConfig.watch = args.devWatch;

  // Development server options
  const serverConfig: any = {};
  if (args.devServer !== undefined) serverConfig.enabled = args.devServer;
  if (args.devServerPort !== undefined) serverConfig.port = args.devServerPort;
  if (args.devServerHost !== undefined) serverConfig.host = args.devServerHost;
  if (args.devServerOpen !== undefined) serverConfig.open = args.devServerOpen;
  if (Object.keys(serverConfig).length > 0) devConfig.server = serverConfig;

  // Development diagnostics options
  const diagnosticsConfig: any = {};
  if (args.devDiagnostics !== undefined) diagnosticsConfig.enabled = args.devDiagnostics;
  if (args.devDiagnosticsPerformance !== undefined) diagnosticsConfig.performance = args.devDiagnosticsPerformance;
  if (args.devDiagnosticsMemory !== undefined) diagnosticsConfig.memory = args.devDiagnosticsMemory;
  if (args.devDiagnosticsFileWatcher !== undefined) diagnosticsConfig.fileWatcher = args.devDiagnosticsFileWatcher;
  if (args.devDiagnosticsClassAnalysis !== undefined) diagnosticsConfig.classAnalysis = args.devDiagnosticsClassAnalysis;
  if (Object.keys(diagnosticsConfig).length > 0) devConfig.diagnostics = diagnosticsConfig;

  // Development preview options
  const previewConfig: any = {};
  if (args.devPreview !== undefined) previewConfig.enabled = args.devPreview;
  if (args.devPreviewAutoRefresh !== undefined) previewConfig.autoRefresh = args.devPreviewAutoRefresh;
  if (args.devPreviewShowDiff !== undefined) previewConfig.showDiff = args.devPreviewShowDiff;
  if (args.devPreviewHighlightChanges !== undefined) previewConfig.highlightChanges = args.devPreviewHighlightChanges;
  if (Object.keys(previewConfig).length > 0) devConfig.preview = previewConfig;

  // Development dashboard options
  const dashboardConfig: any = {};
  if (args.devDashboard !== undefined) dashboardConfig.enabled = args.devDashboard;
  if (args.devDashboardUpdateInterval !== undefined) dashboardConfig.updateInterval = args.devDashboardUpdateInterval;
  if (args.devDashboardShowMetrics !== undefined) dashboardConfig.showMetrics = args.devDashboardShowMetrics;
  if (args.devDashboardShowLogs !== undefined) dashboardConfig.showLogs = args.devDashboardShowLogs;
  if (args.devDashboardMaxLogEntries !== undefined) dashboardConfig.maxLogEntries = args.devDashboardMaxLogEntries;
  if (Object.keys(dashboardConfig).length > 0) devConfig.dashboard = dashboardConfig;

  if (Object.keys(devConfig).length > 0) {
    config.dev = devConfig;
  }

  return config;
}

/**
 * Validate configuration using Zod schema
 */
function validateConfig(config: unknown, filepath?: string): EnigmaConfig {
  try {
    const validatedConfig = EnigmaConfigSchema.parse(config);
    // Always return all top-level fields with defaults
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new ConfigError(
        `Invalid configuration${filepath ? ` in ${filepath}` : ''}:\n${issues}`,
        filepath,
        error as Error,
        { operation: 'validateConfig', issueCount: error.issues.length },
      );
    }
    throw new ConfigError(
      `Configuration validation failed${filepath ? ` for ${filepath}` : ''}`,
      filepath,
      error as Error,
      { operation: 'validateConfig' },
    );
  }
}

/**
 * Asynchronously load configuration from files using cosmiconfig
 */
async function loadConfigFromFile(
  searchFrom?: string,
  configFile?: string,
): Promise<{
  config: Partial<EnigmaConfig>;
  filepath?: string;
  isEmpty?: boolean;
}> {
  configLogger.debug("Loading configuration from file", {
    searchFrom,
    configFile,
    operation: "loadConfigFromFile",
  });

  const explorer = cosmiconfig("enigma");

  try {
    let result;

    if (configFile) {
      configLogger.debug("Loading specific config file", { configFile });
      result = await explorer.load(configFile);
    } else {
      configLogger.debug("Searching for config file", { searchFrom });
      result = await explorer.search(searchFrom);
    }

    if (!result) {
      configLogger.info("No configuration file found, using defaults");
      return { config: {} };
    }

    configLogger.info("Configuration file loaded successfully", {
      filepath: result.filepath,
      isEmpty: result.isEmpty,
      hasConfig: !!result.config,
    });

    return {
      config: result.config || {},
      filepath: result.filepath,
      isEmpty: result.isEmpty,
    };
  } catch (error) {
    configLogger.error("Failed to load configuration file", {
      configFile,
      searchFrom,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw new ConfigError(
      `Failed to load configuration${configFile ? ` from ${configFile}` : ""}`,
      configFile,
      error as Error,
      { operation: "loadConfigFromFile", searchFrom },
    );
  }
}

/**
 * Synchronously load configuration from files using cosmiconfig
 */
function loadConfigFromFileSync(
  searchFrom?: string,
  configFile?: string,
): {
  config: Partial<EnigmaConfig>;
  filepath?: string;
  isEmpty?: boolean;
} {
  configLogger.debug("Loading configuration from file (sync)", {
    searchFrom,
    configFile,
    operation: "loadConfigFromFileSync",
  });

  const explorer = cosmiconfigSync("enigma");

  try {
    let result;

    if (configFile) {
      configLogger.debug("Loading specific config file (sync)", { configFile });
      result = explorer.load(configFile);
    } else {
      configLogger.debug("Searching for config file (sync)", { searchFrom });
      result = explorer.search(searchFrom);
    }

    if (!result) {
      configLogger.info("No configuration file found (sync), using defaults");
      return { config: {} };
    }

    configLogger.info("Configuration file loaded successfully (sync)", {
      filepath: result.filepath,
      isEmpty: result.isEmpty,
      hasConfig: !!result.config,
    });

    return {
      config: result.config || {},
      filepath: result.filepath,
      isEmpty: result.isEmpty,
    };
  } catch (error) {
    configLogger.error("Failed to load configuration file (sync)", {
      configFile,
      searchFrom,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw new ConfigError(
      `Failed to load configuration${configFile ? ` from ${configFile}` : ""}`,
      configFile,
      error as Error,
      { operation: "loadConfigFromFileSync", searchFrom },
    );
  }
}

/**
 * Enhanced configuration manager with comprehensive validation
 */
export class EnhancedConfigManager {
  private configPath?: string;
  private config?: EnigmaConfig;
  private validator?: ReturnType<typeof createConfigValidator>;
  private runtimeValidator?: ReturnType<typeof createRuntimeValidator>;
  private watcher?: ConfigWatcher;
  private defaultsManager?: ReturnType<typeof createConfigDefaults>;
  private migration?: ConfigMigration;
  private performanceValidator?: ReturnType<typeof createPerformanceValidator>;
  private backup?: ConfigBackup;
  private environment: Environment;
  private options: {
    enableWatching?: boolean;
    enableBackup?: boolean;
    enablePerformanceValidation?: boolean;
    enableMigration?: boolean;
    validateOnLoad?: boolean;
    createBackupOnLoad?: boolean;
  };

  constructor(
    environment: Environment = 'development',
    options: {
      enableWatching?: boolean;
      enableBackup?: boolean;
      enablePerformanceValidation?: boolean;
      enableMigration?: boolean;
      validateOnLoad?: boolean;
      createBackupOnLoad?: boolean;
    } = {}
  ) {
    this.environment = environment;
    this.options = {
      enableWatching: true,
      enableBackup: true,
      enablePerformanceValidation: true,
      enableMigration: true,
      validateOnLoad: true,
      createBackupOnLoad: false,
      ...options
    };
  }

  /**
   * Load and validate configuration with comprehensive validation
   */
  async loadConfig(searchFrom?: string): Promise<{
    config: EnigmaConfig;
    validation: ValidationResult;
    runtimeValidation: ValidationResult;
    performanceMetrics?: PerformanceMetrics;
    migrationResult?: any;
    backupId?: string;
  }> {
    try {
      logger.info('Loading configuration with enhanced validation...');

      // 1. Load configuration using cosmiconfig
      const explorer = cosmiconfig('enigma');
      const result = await explorer.search(searchFrom);

      if (!result) {
        logger.warn('No configuration file found, using defaults');
        return this.createDefaultConfig();
      }

      this.configPath = result.filepath;
      logger.info(`Found configuration at: ${this.configPath}`);

      // 2. Initialize validation components
      this.initializeValidators();

      // 3. Handle migration if needed
      let migrationResult;
      if (this.options.enableMigration && this.migration) {
        migrationResult = await this.handleMigration(result.config);
        if (migrationResult.migrated) {
          // Reload config after migration
          const migratedResult = await explorer.load(this.configPath);
          result.config = migratedResult?.config || result.config;
        }
      }

      // 4. Apply defaults and validate schema
      const configWithDefaults = this.applyDefaults(result.config);
      const validation = await this.validateSchema(configWithDefaults);

      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message || e).join(', ')}`);
      }

      this.config = configWithDefaults;

      // 5. Runtime validation
      const runtimeValidation = await this.validateRuntime(this.config);
      if (!runtimeValidation.isValid) {
        logger.warn('Runtime validation warnings', { warnings: runtimeValidation.warnings });
      }

      // 6. Performance analysis
      let performanceMetrics;
      if (this.options.enablePerformanceValidation && this.performanceValidator) {
        performanceMetrics = await this.performanceValidator.analyzePerformance();
        this.logPerformanceInsights(performanceMetrics);
      }

      // 7. Create backup if enabled
      let backupId;
      if (this.options.enableBackup && this.options.createBackupOnLoad && this.backup) {
        const backup = await this.backup.createBackup({
          description: 'Configuration loaded',
          tags: ['auto', 'load']
        });
        backupId = backup.id;
        logger.info(`Configuration backup created: ${backupId}`);
      }

      // 8. Start file watching if enabled
      if (this.options.enableWatching && this.configPath) {
        await this.startWatching();
      }

      logger.info('Configuration loaded and validated successfully');

      return {
        config: this.config,
        validation,
        runtimeValidation,
        performanceMetrics,
        migrationResult,
        backupId
      };

    } catch (error) {
      logger.error('Failed to load configuration', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Update configuration with validation and backup
   */
  async updateConfig(
    updates: Partial<EnigmaConfig>,
    options: {
      createBackup?: boolean;
      validateBeforeUpdate?: boolean;
      description?: string;
    } = {}
  ): Promise<{
    success: boolean;
    backupId?: string;
          validation?: ValidationResult;
    error?: string;
  }> {
    try {
      if (!this.config || !this.configPath) {
        throw new Error('No configuration loaded');
      }

      const {
        createBackup = true,
        validateBeforeUpdate = true,
        description = 'Configuration update'
      } = options;

      // 1. Create backup if requested
      let backupId;
      if (createBackup && this.backup) {
        const backup = await this.backup.createBackup({
          description,
          tags: ['manual', 'update']
        });
        backupId = backup.id;
      }

      // 2. Merge updates with current config
      const updatedConfig = { ...this.config, ...updates };

      // 3. Validate updated configuration
      let validation;
      if (validateBeforeUpdate) {
        validation = await this.validateSchema(updatedConfig);
        if (!validation.isValid) {
          return {
            success: false,
            error: `Validation failed: ${validation.errors.map(e => e.message || e).join(', ')}`,
            validation
          };
        }

        // Runtime validation
        const runtimeValidation = await this.validateRuntime(updatedConfig);
        if (!runtimeValidation.isValid) {
          logger.warn('Runtime validation warnings for update', { warnings: runtimeValidation.warnings });
        }
      }

      // 4. Update configuration
      this.config = updatedConfig;

      logger.info('Configuration updated successfully');

      return {
        success: true,
        backupId,
        validation
      };

    } catch (error) {
      logger.error('Failed to update configuration', { error: error instanceof Error ? error.message : String(error) });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EnigmaConfig | undefined {
    return this.config;
  }

  /**
   * Get performance metrics for current configuration
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics | undefined> {
    if (!this.performanceValidator || !this.config) {
      return undefined;
    }

    return await this.performanceValidator.analyzePerformance();
  }

  /**
   * List available backups
   */
  listBackups(filters?: {
    tags?: string[];
    isAutomatic?: boolean;
    limit?: number;
  }) {
    if (!this.backup) {
      return [];
    }

    return this.backup.listBackups(filters);
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(backupId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!this.backup || !this.configPath) {
        throw new Error('Backup system not initialized or no config path');
      }

      const result = await this.backup.restoreFromBackup(backupId);
      if (result.success) {
        // Reload configuration after restore
        await this.loadConfig();
      }

      return result;

    } catch (error) {
      logger.error('Failed to restore from backup', { error: error instanceof Error ? error.message : String(error) });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stop all watchers and cleanup
   */
  async cleanup(): Promise<void> {
    try {
      if (this.watcher) {
        await this.watcher.stop();
      }

      logger.info('Configuration manager cleaned up');
    } catch (error) {
      logger.error('Error during cleanup', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Initialize all validation components
   */
  private initializeValidators(): void {
    if (!this.configPath) return;

    // Schema validator
    this.validator = createConfigValidator();

    // Defaults manager
    this.defaultsManager = createConfigDefaults(this.environment);

    // Migration system
    if (this.options.enableMigration) {
      this.migration = createConfigMigration(this.configPath);
    }

    // Backup system
    if (this.options.enableBackup) {
      this.backup = createConfigBackup(this.configPath);
    }
  }

  /**
   * Handle configuration migration
   */
  private async handleMigration(config: any): Promise<{
    migrated: boolean;
    result?: any;
  }> {
    if (!this.migration || !this.configPath) {
      return { migrated: false };
    }

    try {
      const needsMigration = this.migration.needsMigration(config);
      if (!needsMigration) {
        return { migrated: false };
      }

      logger.info('Configuration migration needed, starting migration...');

      const result = await this.migration.migrate({
        autoMigrate: true,
        createBackup: true
      });

      if (result.success) {
        logger.info(`Configuration migrated successfully: ${result.migrationsApplied.join(', ')}`);
        return { migrated: true, result };
      } else {
        logger.error('Configuration migration failed', { errors: result.errors });
        return { migrated: false, result };
      }

    } catch (error) {
      logger.error('Error during migration', { error: error instanceof Error ? error.message : String(error) });
      return { migrated: false };
    }
  }

  /**
   * Apply defaults to configuration
   */
  private applyDefaults(config: any): EnigmaConfig {
    if (!this.defaultsManager) {
      return config;
    }

    return this.defaultsManager.createConfigWithDefaults(config);
  }

  /**
   * Validate configuration schema
   */
  private async validateSchema(config: EnigmaConfig): Promise<ValidationResult> {
    if (!this.validator) {
      throw new Error('Schema validator not initialized');
    }

    return await this.validator.validateConfiguration(config);
  }

  /**
   * Validate runtime constraints
   */
  private async validateRuntime(config: EnigmaConfig): Promise<ValidationResult> {
    if (!this.runtimeValidator) {
      this.runtimeValidator = createRuntimeValidator(config);
    }

    const pathResult = await this.runtimeValidator.validatePaths();
    const constraintResult = await this.runtimeValidator.validateConstraints();
    
    return {
      isValid: pathResult.isValid && constraintResult.isValid,
      errors: [...pathResult.errors, ...constraintResult.errors].map(e => new ValidationError(e, 'runtime')),
      warnings: [...pathResult.warnings, ...constraintResult.warnings],
      suggestions: [],
      performance: { validationTime: 0, rulesApplied: 2 }
    };
  }

  /**
   * Start file watching
   */
  private async startWatching(): Promise<void> {
    if (!this.configPath) return;

    this.watcher = createConfigWatcher({
      watchPatterns: [this.configPath],
      validateOnChange: true
    });

    this.watcher.on('change', async (event) => {
      logger.info(`Configuration file changed: ${event.filepath}`);
      
      try {
        // Reload and validate configuration
        await this.loadConfig();
        logger.info('Configuration reloaded successfully');
      } catch (error) {
        logger.error('Failed to reload configuration after change', { error: error instanceof Error ? error.message : String(error) });
      }
    });

    this.watcher.on('validation', (event) => {
      if (!event.validation.isValid) {
        logger.error('Configuration validation failed after change:', event.validation.errors);
      }
    });

    this.watcher.on('error', (error) => {
      logger.error('Configuration watcher error:', error);
    });

    await this.watcher.start();
    logger.info('Configuration file watching started');
  }

  /**
   * Create default configuration when none found
   */
  private async createDefaultConfig(): Promise<{
    config: EnigmaConfig;
    validation: ValidationResult;
    runtimeValidation: ValidationResult;
  }> {
    this.defaultsManager = createConfigDefaults(this.environment);
    const config = this.defaultsManager.createConfigWithDefaults({});

    this.validator = createConfigValidator();
    const validation = await this.validator.validateConfiguration(config);

    this.runtimeValidator = createRuntimeValidator(config);
    const pathResult = await this.runtimeValidator.validatePaths();
    const constraintResult = await this.runtimeValidator.validateConstraints();
    const runtimeValidation = {
      isValid: pathResult.isValid && constraintResult.isValid,
      errors: [...pathResult.errors, ...constraintResult.errors].map(e => new ValidationError(e, 'runtime')),
      warnings: [...pathResult.warnings, ...constraintResult.warnings],
      suggestions: [],
      performance: { validationTime: 0, rulesApplied: 2 }
    };

    this.config = config;

    return {
      config,
      validation,
      runtimeValidation
    };
  }

  /**
   * Log performance insights
   */
  private logPerformanceInsights(metrics: PerformanceMetrics): void {
    logger.info(`Configuration performance score: ${metrics.score}/100`);

    if (metrics.warnings.length > 0) {
      logger.warn('Performance warnings', { warnings: metrics.warnings });
    }

    if (metrics.bottlenecks.length > 0) {
      logger.warn('Performance bottlenecks detected', { bottlenecks: metrics.bottlenecks });
    }

    if (metrics.recommendations.length > 0) {
      logger.info('Performance recommendations', { recommendations: metrics.recommendations.map(r => r.title) });
    }
  }
}

/**
 * Create enhanced configuration manager
 */
export function createEnhancedConfigManager(
  environment: Environment = 'development',
  options?: {
    enableWatching?: boolean;
    enableBackup?: boolean;
    enablePerformanceValidation?: boolean;
    enableMigration?: boolean;
    validateOnLoad?: boolean;
    createBackupOnLoad?: boolean;
  }
): EnhancedConfigManager {
  return new EnhancedConfigManager(environment, options);
}

/**
 * Load configuration with enhanced validation (convenience function)
 */
export async function loadEnhancedConfig(
  searchFrom?: string,
  environment: Environment = 'development'
): Promise<EnigmaConfig> {
  const manager = createEnhancedConfigManager(environment, {
    enableWatching: false, // Don't start watching for one-time loads
    createBackupOnLoad: false
  });

  const result = await manager.loadConfig(searchFrom);
  await manager.cleanup();

  return result.config;
}

/**
 * Load configuration asynchronously with CLI args support
 */
export async function loadConfig(cliArgs?: CliArguments, searchFrom?: string): Promise<ConfigResult> {
  try {
    // Load config from file
    const { config: fileConfig, filepath, isEmpty } = await loadConfigFromFile(
      searchFrom || (cliArgs?.config ? undefined : process.cwd()),
      cliArgs?.config
    );

    // Normalize and merge CLI arguments
    const cliConfig = cliArgs ? normalizeCliArguments(cliArgs) : {};

    // Merge CLI args with file config (CLI args take precedence)
    const mergedConfig = deepMerge(fileConfig, cliConfig);

    // Validate and apply defaults
    const config = validateConfig(mergedConfig, filepath);

    return {
      config,
      filepath,
      isEmpty
    };
  } catch (error) {
    // If error is already a ConfigError, rethrow
    if (error instanceof ConfigError) throw error;
    // If loading fails, create default config with CLI args, but only if valid
    try {
      const cliConfig = cliArgs ? normalizeCliArguments(cliArgs) : {};
      const config = validateConfig(cliConfig);
      return {
        config,
        isEmpty: true
      };
    } catch (fallbackError) {
      // Always throw a ConfigError for consistency
      if (fallbackError instanceof ConfigError) throw fallbackError;
      throw new ConfigError("Failed to load configuration and fallback config is invalid", undefined, fallbackError);
    }
  }
}

/**
 * Load configuration synchronously with CLI args support
 */
export function loadConfigSync(cliArgs?: CliArguments, searchFrom?: string): ConfigResult {
  try {
    // Load config from file synchronously
    const { config: fileConfig, filepath, isEmpty } = loadConfigFromFileSync(
      searchFrom || (cliArgs?.config ? undefined : process.cwd()),
      cliArgs?.config
    );

    // Normalize and merge CLI arguments
    const cliConfig = cliArgs ? normalizeCliArguments(cliArgs) : {};

    // Merge CLI args with file config (CLI args take precedence)
    const mergedConfig = deepMerge(fileConfig, cliConfig);

    // Validate and apply defaults
    const config = validateConfig(mergedConfig, filepath);

    return {
      config,
      filepath,
      isEmpty
    };
  } catch (error) {
    // If error is already a ConfigError, rethrow
    if (error instanceof ConfigError) throw error;
    // If loading fails, create default config with CLI args, but only if valid
    try {
      const cliConfig = cliArgs ? normalizeCliArguments(cliArgs) : {};
      const config = validateConfig(cliConfig);
      return {
        config,
        isEmpty: true
      };
    } catch (fallbackError) {
      // Always throw a ConfigError for consistency
      if (fallbackError instanceof ConfigError) throw fallbackError;
      throw new ConfigError("Failed to load configuration and fallback config is invalid", undefined, fallbackError);
    }
  }
}

/**
 * Get configuration with sensible defaults for common use cases
 */
export async function getConfig(cliArgs?: CliArguments): Promise<EnigmaConfig> {
  const result = await loadConfig(cliArgs);
  return result.config;
}

/**
 * Get configuration synchronously with sensible defaults
 */
export function getConfigSync(cliArgs?: CliArguments): EnigmaConfig {
  const result = loadConfigSync(cliArgs);
  return result.config;
}

/**
 * Create a sample configuration file content for users
 */
export function createSampleConfig(): string {
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
};
`;
}
