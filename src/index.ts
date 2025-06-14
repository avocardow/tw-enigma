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
export * from "./config";
export * from "./fileDiscovery";
export * from "./htmlExtractor";
export * from "./jsExtractor";
export * from "./cssInjector";
export * from "./performance/index";

// Core Utilities
export { createLogger as logger } from "./logger";
export { ErrorHandler } from "./errorHandler/errorHandler";

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
} from "./fileIntegrity";

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
} from "./htmlRewriter";

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
} from "./patternAnalysis";

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
} from "./nameGeneration";

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
} from "./frameworkDetector";

// Framework-specific detectors
export { ReactDetector } from "./detectors/reactDetector";
export { NextjsDetector } from "./detectors/nextjsDetector";
export { ViteDetector } from "./detectors/viteDetector";

// Build Tool Integrations
export {
  IntegrationManager,
  createIntegrationManager,
  type IntegrationManagerConfig,
  type IntegrationStatus,
} from "./integrations/core/integrationManager";

// Build Tool Plugins
export {
  EnigmaWebpackPlugin,
  createWebpackPlugin,
} from "./integrations/webpack/webpackPlugin";

export {
  EnigmaVitePlugin,
  createVitePlugin,
  enigmaVite,
} from "./integrations/vite/vitePlugin";

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
} from "./integrations/core/buildToolPlugin";

export {
  ConfigDetector,
  type AutoConfigResult,
  type DetectedBuildConfig,
} from "./integrations/core/configDetector";

export {
  createHMRHandler,
  type HMRHandler,
  type HMRConfig,
} from "./integrations/core/hmrHandler";

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
} from "./output/cssOutputOrchestrator";

export {
  CssOutputConfig,
  createProductionConfig,
  createDevelopmentConfig,
  validateProductionConfig,
  type CssOutputConfigSchema,
} from "./output/cssOutputConfig";

export {
  CssChunker,
  createCssChunker,
  type CssChunk,
} from "./output/cssChunker";

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
} from "./output/assetHasher";

export {
  CriticalCssExtractor,
  createCriticalCssExtractor,
} from "./output/criticalCssExtractor";

export {
  CssAnalyzer,
  createCssAnalyzer,
} from "./output/cssAnalyzer";

// Atomic Operations exports
export * from "./atomicOps/index";

// #endregion
