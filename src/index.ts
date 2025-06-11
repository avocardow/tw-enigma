// Core configuration module
export * from "./config.js";

// File discovery module
export * from "./fileDiscovery.js";

// HTML class extraction module
export * from "./htmlExtractor.js";

// JavaScript/JSX class extraction module
export * from "./jsExtractor.js";

// CSS injection module
export * from "./cssInjector.js";

// File integrity validation module
export * from "./fileIntegrity.js";

// Main entry point for the library
export { version } from "../package.json";

// Main exports for Tailwind Enigma Core
export * from './config.js';
export * from './fileDiscovery.js';
export * from './htmlExtractor.js';
export * from './jsExtractor.js';
export * from './patternAnalysis.js';
export * from './cssInjector.js';
export * from './fileIntegrity.js';

// Core components
export { logger } from './logger.js';
export { ErrorHandler } from './errorHandler/errorHandler.js';

// Performance optimizations
export * from './performance/index.js';

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
} from './patternAnalysis.js';

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
} from './nameGeneration.js';

// HTML rewriter module
export * from "./htmlRewriter.js"; 