/**
 * @tw-enigma/core - Core CSS Optimization Engine
 *
 * Main entry point for the Tailwind Enigma core optimization engine.
 * Provides CSS extraction, processing, and optimization functionality.
 */

/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Type imports for internal use
import type { OptimizationResult } from './output/assetHasher';

// =============================================================================
// VERSION EXPORTS
// =============================================================================

export const version = '0.1.0';
export const coreVersion = '0.1.0';

// =============================================================================
// CORE ENGINE EXPORTS
// =============================================================================

// Primary Engine Modules
export * from './engine/cssGeneration';
export * from './engine/cssInjector';
export * from './engine/optimizationCache';
export * from './engine/optimizationCacheIntegration';

// =============================================================================
// PROCESSORS EXPORTS
// =============================================================================

// HTML Extractor
export {
  createHtmlExtractor,
  extractClassesFromFile,
  extractClassesFromHtml,
  HtmlExtractor,
} from './processors/htmlExtractor';

export type {
  ClassData,
  HtmlClassExtractionResult,
  HtmlExtractionOptions,
} from './processors/htmlExtractor';

export { FileReadError, HtmlParsingError } from './processors/htmlExtractor';

// HTML Rewriter
export {
  BackupError,
  ConflictResolutionError,
  createHtmlRewriter,
  HtmlRewriteError,
  HtmlRewriter,
  HtmlValidationError,
  PatternValidationError,
  rewriteHtmlFile,
  rewriteHtmlString,
} from './processors/htmlRewriter';

export type {
  BackupConfig,
  BatchOperationOptions,
  BatchOperationResult,
  FileOperationOptions,
  FormatAnalysis,
  FormatPreservationOptions,
  HtmlPattern,
  HtmlRewriteOptions,
  HtmlRewriteResult,
  HtmlRewriterIntegration,
  PatternCondition,
  PatternMatchResult,
  PatternReplacement,
  PatternSet,
  RewriteCache,
} from './processors/htmlRewriter';

// JS Extractor
export {
  createJsExtractor,
  extractClassesFromJs,
  extractClassesFromJsFile,
  JsExtractionOptionsSchema,
  JsExtractor,
  JsParsingError,
} from './processors/jsExtractor';

// Other processors
export * from './processors/jsRewriter';
export * from './processors/nameGeneration';
export * from './processors/patternAnalysis';

// =============================================================================
// UTILITIES EXPORTS
// =============================================================================

// Core utilities
export * from './utils/debugUtils';
export * from './utils/pathUtils';

// File Discovery
export {
  deduplicateAndSort,
  discoverFiles,
  discoverFilesFromConfig,
  discoverFilesFromConfigAsync,
  discoverFilesSync,
  getFileType,
  shouldIncludeFile,
  validateGlobPattern,
  validateOptions,
} from './utils/fileDiscovery';

export type { FileDiscoveryOptions, FileDiscoveryResult } from './utils/fileDiscovery';

export { FileDiscoveryError } from './utils/fileDiscovery';

// File Integrity
export {
  calculateFileChecksum,
  createFileIntegrityValidator,
  FileIntegrityOptionsSchema,
  FileIntegrityValidator,
  IntegrityError,
  validateFileIntegrity,
} from './utils/fileIntegrity';

export type { FileIntegrityOptions } from './utils/fileIntegrity';

// Logger - Export both instance and class
export { createLogger, Logger, logger, LogLevel, LogLevelNames } from './utils/logger';

export type { ErrorContext, FileOutputOptions, LogEntry, PerformanceMetrics } from './utils/logger';

// Errors - Core error classes
export {
  CliError,
  ConfigError,
  CssProcessingError,
  DependencyError,
  EnigmaError,
  TimeoutError,
  FileDiscoveryError as UtilsFileDiscoveryError,
  HtmlParsingError as UtilsHtmlParsingError,
  JsParsingError as UtilsJsParsingError,
  ValidationError,
} from './utils/errors';

// Error Handler
export {
  categorizeError,
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  CircuitBreakerState,
  ErrorCategory,
  ErrorHandler,
  ErrorSeverity,
  getErrorHandler,
  getSystemHealth,
  handleError,
  HealthStatus,
  initializeErrorHandling,
  isEnigmaError,
  severityToNumber,
  shutdownErrorHandling,
  withCircuitBreaker,
} from './errorHandler';

// =============================================================================
// CONFIGURATION EXPORTS
// =============================================================================

// Configuration Management
export * from './config/configBackup';
export * from './config/configDefaults';
export * from './config/configMigration';
export * from './config/configSafeUpdater';
export * from './config/configWatcher';

// Config
export {
  createSampleConfig,
  getConfig,
  getConfigSync,
  loadConfig,
  loadConfigSync,
} from './config/config';

export type { EnigmaConfig } from './config/config';

// Config Validator
export { validateConfig } from './config/configValidator';

export type { ValidationResult } from './config/configValidator';

// CSS Output Configuration
export {
  createPerformanceBudget,
  createProductionConfigManager,
  generateConfigDocs,
  validateProductionConfig,
} from './output/cssOutputConfig';

export type { CssOutputConfig, PerformanceBudget } from './output/cssOutputConfig';

// CSS Report Generator
export { CssReportGenerator } from './output/cssReportGenerator';
export type { CssPerformanceReport } from './output/cssReportGenerator';

// Asset Hasher Types
export type { OptimizationResult } from './output/assetHasher';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

// Essential Types
export * from './types/atomicOps';
export * from './types/plugins';

// =============================================================================
// INTEGRATIONS (Essential)
// =============================================================================

// Core integrations that should work
export * from './integrations/core';

// =============================================================================
// FRAMEWORK DETECTION
// =============================================================================

export { createFrameworkDetector } from './frameworkDetector';

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

export * from './performance';

// =============================================================================
// DEFAULT EXPORT & MAIN FUNCTIONS
// =============================================================================

// Provide a default export with essential functionality
export { EnhancedCSSGenerator } from './engine/cssGeneration';
export { logger as defaultLogger } from './utils/logger';

// Placeholder optimizeCSS function - returns basic optimization result
export function optimizeCSS(input: string, _data?: any, _options?: any): OptimizationResult {
  // Simple placeholder implementation
  return {
    original: input,
    optimized: input, // Return input as-is for now
    stats: {
      originalSize: input.length,
      optimizedSize: input.length,
      reduction: 0,
      rulesRemoved: 0,
      declarationsOptimized: 0,
      optimizationTime: 0,
    },
    plugins: [],
  };
}
