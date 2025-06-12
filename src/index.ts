/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// #region Main Library Exports

// Main entry point for the library
export { version } from "../package.json";

// Core Modules
export * from "./config.js";
export * from "./fileDiscovery.js";
export * from "./htmlExtractor.js";
export * from "./jsExtractor.js";
export * from "./cssInjector.js";
export * from "./performance/index.js";

// Core Utilities
export { createLogger as logger } from "./logger.js";
export { ErrorHandler } from "./errorHandler/errorHandler.js";

// Explicit exports from fileIntegrity.ts to avoid conflicts
export {
  FileIntegrityOptionsSchema,
  type FileIntegrityOptions,
  type ChecksumInfo,
  type FileValidationResult,
  type BackupResult,
  type RollbackResult,
  type BatchValidationResult,
  type ValidationMetadata,
  type DeduplicationEntry,
  type DeduplicationIndex,
  type DeduplicationResult,
  type FileChangeState,
  type IncrementalBackupEntry,
  type IncrementalIndex,
  type IncrementalBackupResult,
  type DifferentialBackupEntry,
  type DifferentialIndex,
  type DifferentialBackupResult,
  type SystemMetrics,
  type BatchProcessingConfig,
  type ProgressInfo,
  type BatchOperationResult as FileIntegrityBatchResult, // Aliased export
  type LargeProjectResult,
  IntegrityError,
  ChecksumError,
  ValidationError,
  RollbackError,
  FileIntegrityValidator,
  createFileIntegrityValidator,
  calculateFileChecksum,
  validateFileIntegrity,
} from "./fileIntegrity.js";

// Explicit exports from htmlRewriter.ts to avoid conflicts
export {
  HtmlRewriteOptionsSchema,
  type HtmlRewriteOptions,
  type PatternMatchResult,
  type PatternCondition,
  type PatternSet,
  type HtmlPattern,
  type PatternReplacement,
  type HtmlRewriteResult,
  type BackupConfig,
  type RewriteCache,
  type BatchOperationResult as HtmlRewriterBatchResult, // Aliased export
  type FormatPreservationOptions,
  type FormatAnalysis,
  type HtmlRewriterIntegration,
  type BatchOperationOptions,
  type FileOperationOptions,
  HtmlRewriteError,
  PatternValidationError,
  BackupError,
  ConflictResolutionError,
  HtmlValidationError,
  HtmlRewriter,
  createHtmlRewriter,
} from "./htmlRewriter.js";

// #endregion

// #region Granular Feature Exports

// Pattern Analysis exports
export {
  // Core functions
  analyzePatterns,
  aggregateExtractionResults,
  generateFrequencyMap,
  generatePatternGroups,
  quickFrequencyAnalysis,

  // Statistics and analysis
  calculateFrequencyStatistics,
  generateCoOccurrenceAnalysis,
  generateFrameworkAnalysis,

  // Utility functions
  sortFrequencyMap,
  filterFrequencyMap,
  exportToJson,

  // Types and schemas
  type PatternAnalysisOptions,
  type AggregatedClassData,
  type PatternFrequencyMap,
  type FrequencyAnalysisResult,
  type CoOccurrencePattern,
  type FrameworkAnalysis,
  type PatternGroup,
  PatternAnalysisOptionsSchema,

  // Error classes
  PatternAnalysisError,
  DataAggregationError,
  FrequencyCalculationError,
} from "./patternAnalysis.js";

// Name Generation exports
export {
  // Base conversion utilities
  toBase26,
  fromBase26,
  toBase36,
  fromBase36,
  toCustomBase,
  calculateOptimalLength,
  validateBaseConversions,

  // Sequential generation
  generateSequentialName,
  generateSequentialNames,
  createNameCollisionCache,
  hasNameCollision,
  generateNextAvailableName,
  batchGenerateAvailableNames,
  calculateGenerationStatistics,
  validateGenerationSetup,

  // Frequency-based optimization
  sortByFrequency,
  createFrequencyBuckets,
  optimizeByFrequency,
  calculateCompressionStats,
  analyzeFrequencyDistribution,

  // Main API
  NameCollisionManager,
  generateOptimizedNames,
  exportNameGenerationResult,
  generateSimpleNames,

  // Configuration and validation
  validateNameGenerationOptions,
  isValidCssIdentifier,
  isReservedName,

  // Constants and types
  ALPHABET_CONFIGS,
  CSS_RESERVED_KEYWORDS,
  type NameGenerationOptions,
  type NameGenerationResult,
  type GeneratedName,
  type NameCollisionCache,
  type BaseConversionResult,
  type FrequencyBucket,
  NameGenerationOptionsSchema,

  // Error classes
  NameGenerationError,
  CollisionError,
  InvalidNameError,
  CacheError,
} from "./nameGeneration.js";

// Framework Detection
export {
  FrameworkDetector,
  createFrameworkDetector,
  detectFramework,
  FrameworkDetectionError,
  type FrameworkType,
  type FrameworkInfo,
  type DetectionResult,
  type DetectionContext,
  type DetectionSource,
  type IFrameworkDetector,
  type FrameworkDetectorOptions,
} from "./frameworkDetector.js";

// Framework-specific detectors
export { ReactDetector } from "./detectors/reactDetector.js";
export { NextjsDetector } from "./detectors/nextjsDetector.js";
export { ViteDetector } from "./detectors/viteDetector.js";

// Build Tool Integrations
export {
  IntegrationManager,
  createIntegrationManager,
  type IntegrationManagerConfig,
  type IntegrationStatus,
} from "./integrations/core/integrationManager.js";

// Build Tool Plugins
export {
  EnigmaWebpackPlugin,
  createWebpackPlugin,
} from "./integrations/webpack/webpackPlugin.js";

export {
  EnigmaVitePlugin,
  createVitePlugin,
  enigmaVite,
} from "./integrations/vite/vitePlugin.js";

// Core Integration Types and Utilities
export type {
  BuildToolPlugin,
  BuildToolPluginConfig,
  BuildToolContext,
  BuildToolResult,
  BuildToolType,
  BuildToolHooks,
  OptimizationResult,
  HMRUpdate,
} from "./integrations/core/buildToolPlugin.js";

export {
  ConfigDetector,
  type AutoConfigResult,
  type DetectedBuildConfig,
} from "./integrations/core/configDetector.js";

export {
  createHMRHandler,
  type HMRHandler,
  type HMRConfig,
} from "./integrations/core/hmrHandler.js";

// #endregion
