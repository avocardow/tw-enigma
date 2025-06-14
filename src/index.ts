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
export * from "./config.ts";
export * from "./fileDiscovery.ts";
export * from "./htmlExtractor.ts";
export * from "./jsExtractor.ts";
export * from "./cssInjector.ts";
export * from "./performance/index.ts";

// Core Utilities
export { createLogger as logger } from "./logger.ts";
export { ErrorHandler } from "./errorHandler/errorHandler.ts";

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
} from "./fileIntegrity.ts";

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
} from "./htmlRewriter.ts";

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
} from "./patternAnalysis.ts";

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
} from "./nameGeneration.ts";

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
} from "./frameworkDetector.ts";

// Framework-specific detectors
export { ReactDetector } from "./detectors/reactDetector.ts";
export { NextjsDetector } from "./detectors/nextjsDetector.ts";
export { ViteDetector } from "./detectors/viteDetector.ts";

// Build Tool Integrations
export {
  IntegrationManager,
  createIntegrationManager,
  type IntegrationManagerConfig,
  type IntegrationStatus,
} from "./integrations/core/integrationManager.ts";

// Build Tool Plugins
export {
  EnigmaWebpackPlugin,
  createWebpackPlugin,
} from "./integrations/webpack/webpackPlugin.ts";

export {
  EnigmaVitePlugin,
  createVitePlugin,
  enigmaVite,
} from "./integrations/vite/vitePlugin.ts";

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
} from "./integrations/core/buildToolPlugin.ts";

export {
  ConfigDetector,
  type AutoConfigResult,
  type DetectedBuildConfig,
} from "./integrations/core/configDetector.ts";

export {
  createHMRHandler,
  type HMRHandler,
  type HMRConfig,
} from "./integrations/core/hmrHandler.ts";

// CSS Output Processing exports
export {
  CssOutputOrchestrator,
  createCssOutputOrchestrator,
  createProductionOrchestrator,
  createDevelopmentOrchestrator,
  type CssBundle,
  type CssOutputResult,
  type CssOrchestrationResult,
  type CssProcessingOptions,
} from "./output/cssOutputOrchestrator.ts";

export {
  CssOutputConfig,
  createProductionConfig,
  createDevelopmentConfig,
  validateProductionConfig,
  type CssOutputConfigSchema,
} from "./output/cssOutputConfig.ts";

export {
  CssChunker,
  createCssChunker,
  type CssChunk,
} from "./output/cssChunker.ts";

export {
  AssetHasher,
  createAssetHasher,
  createCssOptimizer,
  createCompressionEngine,
  createManifestGenerator,
  type AssetHash,
  type OptimizationResult as AssetOptimizationResult,
  type CompressionResult,
  type ManifestGenerator,
} from "./output/assetHasher.ts";

export {
  CriticalCssExtractor,
  createCriticalCssExtractor,
} from "./output/criticalCssExtractor.ts";

export {
  CssAnalyzer,
  createCssAnalyzer,
} from "./output/cssAnalyzer.ts";

// Atomic Operations exports
export * from "./atomicOps/index.ts";

// #endregion
