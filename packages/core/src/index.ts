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
// REGISTRY EXPORTS - DOM Element Mapping
// =============================================================================

// DOM Element Registry - Task 4 Implementation
export {
  buildRegistry,
  createMemoryManager,
  createRegistry,
  createRegistryBuilder,
  createTestRegistry,
  DEFAULT_MEMORY_CONFIG,
  DEFAULT_REGISTRY_CONFIG,
  destroyGlobalMemoryManager,
  destroyGlobalRegistryBuilder,
  DOMElementRegistryImpl,
  getGlobalMemoryManager,
  getGlobalRegistryBuilder,
  // Memory Manager exports
  MemoryManager,
  RegistryBuilderError,
  // Registry Builder exports
  RegistryBuilderImpl,
  // Stress Tester exports
  StressTester,
} from './registry';

export type {
  BuilderMetrics,
  ClassRegistry,
  ClassRegistryEntry,
  CSSRuleInfo,
  DOMElementRegistry,
  ElementReference,
  FrameworkLifecycleManager,
  MemoryLeakReport,
  // Memory Manager types
  MemoryManagerConfig,
  MemoryPressureLevel,
  MemoryStats,
  RegistryBuilder,
  RegistryBuilderConfig,
  RegistryConfig,
  RegistryEvent,
  RegistryEventHandler,
  RegistryEventType,
  RegistryInstance,
  RegistryStats,
  // Stress Tester types
  ScenarioName,
  ScenarioOptions,
  StressTestReport,
} from './registry';

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

// Performance optimization exports (Task 11)
export {
  ALPHABET_CONFIGS,
  calculateAestheticScoresBatch,
  clearAestheticCache,
  createEnhancedPrettyNameCache,
  CSS_IDENTIFIER_PATTERNS,
  CSS_RESERVED_KEYWORDS,
  generatePrettyName,
  getAestheticCacheStats,
  getNextPermutationOptimized,
  PermutationIterator,
} from './processors/nameGeneration';

export type { EnhancedPrettyNameCache } from './processors/nameGeneration';

// =============================================================================
// UTILITIES EXPORTS
// =============================================================================

// Core utilities
export * from './utils/debugUtils';
export * from './utils/pathUtils';

// File Discovery
export {
  ALL_SUPPORTED_EXTENSIONS,
  deduplicateAndSort,
  discoverFiles,
  discoverFilesFromConfig,
  discoverFilesFromConfigAsync,
  discoverFilesSync,
  getFileType,
  shouldIncludeFile,
  SUPPORTED_FILE_TYPES,
  validateGlobPattern,
  validateOptions,
} from './utils/fileDiscovery';

export type { FileDiscoveryOptions, FileDiscoveryResult } from './utils/fileDiscovery';

export { FileDiscoveryError } from './utils/fileDiscovery';

// File Integrity
export {
  calculateFileChecksum,
  ChecksumError,
  createFileIntegrityValidator,
  FileIntegrityOptionsSchema,
  FileIntegrityValidator,
  IntegrityError,
  RollbackError,
  validateFileIntegrity,
  ValidationError,
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
  ValidationError as GeneralValidationError,
  TimeoutError,
  FileDiscoveryError as UtilsFileDiscoveryError,
  HtmlParsingError as UtilsHtmlParsingError,
  JsParsingError as UtilsJsParsingError,
} from './utils/errors';

// Error Handler (Legacy)
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

// Enhanced Error Handling & Validation (Task 13)
export * from './errors';
export {
  CommonValidationSchemas,
  createEnhancedSchema,
  DEFAULT_VALIDATION_CONFIG,
  validate as validateWithChain,
  ValidationChain,
} from './validation/ValidationChain';

export type {
  ValidationResult as ChainValidationResult,
  ValidationConfig,
  ValidationRule,
} from './validation/ValidationChain';

// Warning System (Task 12)
export {
  generateCapacityTable,
  getDefaultWarningSystem,
  shouldWarn,
  warnForHighLength,
  WarningLevel,
  WarningSystem,
} from './utils/warningSystem';

export type {
  CapacityInfo,
  LengthWarningData,
  PerformanceInfo,
  WarningConfig,
} from './utils/warningSystem';

// Length Validation with Warnings (Task 12)
export {
  createWarningConfig,
  shouldShowPerformanceWarning,
  validateCliLength,
  validateLengthWithWarnings,
  validateMultipleLengths,
} from './utils/lengthValidation';

export type { LengthValidationOptions, LengthValidationResult } from './utils/lengthValidation';

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
  EnigmaConfigSchema,
  getConfig,
  getConfigSync,
  loadConfig,
  loadConfigSync,
  normalizeCliArguments,
  validateBasicConfigSchema,
} from './config/config';

export type { EnigmaConfig } from './config/config';

// Config Validator
export { validateConfig } from './config/configValidator';

export type { ValidationResult as ConfigValidationResult } from './config/configValidator';

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

// Webpack Integration
export {
  createWebpackPlugin,
  defaultWebpackConfig,
  EnigmaWebpackPlugin,
} from './integrations/webpack/webpackPlugin';

export type { WebpackPluginConfig } from './integrations/webpack/webpackPlugin';

// =============================================================================
// FRAMEWORK DETECTION
// =============================================================================

export { createFrameworkDetector, detectFramework, FrameworkDetector } from './frameworkDetector';

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

export * from './performance';

// =============================================================================
// REPORTING & PLUGINS
// =============================================================================

// Reporter
export { default as Reporter } from './reporter.js';

// Tailwind Plugin
export { default as tailwindEnigmaPlugin } from './tailwindPlugin.js';

// =============================================================================
// DEFAULT EXPORT & MAIN FUNCTIONS
// =============================================================================

// Provide a default export with essential functionality
export { EnhancedCSSGenerator } from './engine/cssGeneration';
export { logger as defaultLogger } from './utils/logger';

// CSS optimization function with Tailwind class scrambling
export function optimizeCSS(input: string, _data?: any, options?: {
  scrambleClassNames?: boolean;
  enableOptimization?: boolean;
  preserveSourceMaps?: boolean;
}): OptimizationResult {
  const startTime = performance.now();
  
  // If scrambling is disabled, return basic optimization
  if (!options?.scrambleClassNames) {
    return {
      original: input,
      optimized: input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim(),
      stats: {
        originalSize: input.length,
        optimizedSize: input.length,
        reduction: 0,
        rulesRemoved: 0,
        declarationsOptimized: 0,
        optimizationTime: performance.now() - startTime,
      },
      plugins: [],
    };
  }

  try {
    let optimizedCSS = input;
    let rulesProcessed = 0;
    let classesScrambled = 0;
    
    // Generate mapping of original class names to scrambled names
    const classMap = new Map<string, string>();
    const usedNames = new Set<string>();
    
    // Generate a random scrambled class name
    const generateScrambledName = (): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyz';
      let name: string;
      do {
        name = chars[Math.floor(Math.random() * chars.length)];
        for (let i = 1; i < 6; i++) {
          name += chars[Math.floor(Math.random() * chars.length)];
        }
      } while (usedNames.has(name));
      usedNames.add(name);
      return name;
    };

    // Find and replace Tailwind utility classes
    const tailwindClassPattern = /\.([\w-]+(?:\/[\w-]+)?(?:\[[\w%-]+\])?(?::\w+)*)\s*\{/g;
    let match;
    
    while ((match = tailwindClassPattern.exec(input)) !== null) {
      const originalClass = match[1];
      
      // Skip non-Tailwind classes (heuristic: Tailwind classes are usually short utility names)
      if (originalClass.length > 20 || originalClass.includes('__') || originalClass.includes('container')) {
        continue;
      }
      
      if (!classMap.has(originalClass)) {
        const scrambledName = generateScrambledName();
        classMap.set(originalClass, scrambledName);
        classesScrambled++;
      }
    }
    
    // Apply class name replacements in CSS
    for (const [originalClass, scrambledClass] of classMap) {
      const classSelector = new RegExp(`\\.${originalClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      optimizedCSS = optimizedCSS.replace(classSelector, `.${scrambledClass}`);
      rulesProcessed++;
    }
    
    // Basic CSS minification
    if (options?.enableOptimization) {
      optimizedCSS = optimizedCSS
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/\s*{\s*/g, '{') // Remove whitespace around braces
        .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
        .replace(/:\s+/g, ':') // Remove whitespace after colons
        .replace(/;\s+/g, ';') // Remove whitespace after semicolons
        .trim();
    }

    const endTime = performance.now();
    const originalSize = Buffer.byteLength(input, 'utf-8');
    const optimizedSize = Buffer.byteLength(optimizedCSS, 'utf-8');

    return {
      original: input,
      optimized: optimizedCSS,
      stats: {
        originalSize,
        optimizedSize,
        reduction: Math.max(0, ((originalSize - optimizedSize) / originalSize) * 100),
        rulesRemoved: rulesProcessed,
        declarationsOptimized: classesScrambled,
        optimizationTime: endTime - startTime,
      },
      plugins: [`tailwind-scrambler (${classesScrambled} classes scrambled)`],
    };
  } catch (error) {
    // Fallback: return original CSS if optimization fails
    return {
      original: input,
      optimized: input,
      stats: {
        originalSize: input.length,
        optimizedSize: input.length,
        reduction: 0,
        rulesRemoved: 0,
        declarationsOptimized: 0,
        optimizationTime: performance.now() - startTime,
      },
      plugins: [`error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
