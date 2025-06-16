/**
 * Engine Module - Core CSS Optimization Engines
 *
 * This module contains the core optimization engines that power
 * the Tailwind Enigma CSS optimization system.
 */

// CSS Generation Engine
export * from './cssGeneration';

// CSS Injection System
export * from './cssInjector';

// Optimization Caching
export * from './optimizationCache';
export * from './optimizationCacheIntegration';

// Plugin System
export * from './core/pluginManager';
export * from './core/postcssPlugin';

// Version export for engine module
export const engineVersion = '0.1.0';
