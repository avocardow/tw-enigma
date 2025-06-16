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

// File Processors
export * from './processors/htmlExtractor';
export * from './processors/htmlRewriter';
export * from './processors/jsExtractor';
export * from './processors/jsRewriter';
export * from './processors/patternAnalysis';
export * from './processors/nameGeneration';

// =============================================================================
// UTILITIES EXPORTS
// =============================================================================

// Core utilities
export * from './utils/fileDiscovery';
export * from './utils/fileIntegrity';
export * from './utils/pathUtils';
export * from './utils/logger';
export * from './utils/debugUtils';
export * from './utils/errors';

// =============================================================================
// CONFIGURATION EXPORTS
// =============================================================================

// Configuration Management
export * from './config/config';
export * from './config/configValidator';
export * from './config/configDefaults';
export * from './config/configMigration';
export * from './config/configBackup';
export * from './config/configSafeUpdater';
export * from './config/configWatcher';

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
// PERFORMANCE MONITORING
// =============================================================================

export * from './performance';

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

// Provide a default export with essential functionality
export { EnhancedCSSGenerator } from './engine/cssGeneration';
export { logger as defaultLogger } from './utils/logger';
export { loadConfig } from './config/config'; 