/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * PostCSS Plugin System Types
 * Defines the API contracts for the plugin system integration
 */

import type { Root, Result, Plugin, PluginCreator } from 'postcss';
import type { z } from 'zod';

/**
 * Core plugin configuration interface
 */
export interface PluginConfig {
  /** Plugin name identifier */
  name: string;
  /** Plugin version */
  version?: string;
  /** Plugin options */
  options?: Record<string, unknown>;
  /** Whether plugin is enabled */
  enabled?: boolean;
  /** Plugin execution order priority (lower = earlier) */
  priority?: number;
}

/**
 * Plugin result metadata
 */
export interface PluginResult {
  /** Plugin that generated this result */
  pluginName: string;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Number of transformations applied */
  transformations: number;
  /** Memory usage in bytes */
  memoryUsage?: number;
  /** Warnings generated during processing */
  warnings: string[];
  /** Dependencies discovered during processing */
  dependencies: string[];
  /** Whether processing was successful */
  success: boolean;
}

/**
 * Plugin context passed to plugins during execution
 */
export interface PluginContext {
  /** Current CSS processing result */
  result: Result;
  /** Plugin configuration */
  config: PluginConfig;
  /** Frequency analysis data from pattern analysis */
  frequencyData?: FrequencyAnalysisResult;
  /** Pattern classification data */
  patternData?: PatternAnalysisResult;
  /** Project configuration */
  projectConfig: EnigmaConfig;
  /** Performance metrics collector */
  metrics: PluginMetrics;
  /** Logger instance */
  logger: Logger;
}

/**
 * Plugin metrics for performance monitoring
 */
export interface PluginMetrics {
  /** Start timing measurement */
  startTimer(label: string): void;
  /** End timing measurement */
  endTimer(label: string): number;
  /** Record memory usage */
  recordMemory(usage: number): void;
  /** Add warning */
  addWarning(message: string): void;
  /** Add dependency */
  addDependency(file: string): void;
  /** Get current metrics */
  getMetrics(): PluginResult;
}

/**
 * Enigma-specific PostCSS plugin interface
 */
export interface EnigmaPlugin {
  /** Plugin metadata */
  readonly meta: {
    name: string;
    version: string;
    description: string;
    author?: string;
  };

  /** Plugin configuration schema (Zod) */
  readonly configSchema: z.ZodSchema;

  /** Initialize plugin with configuration */
  initialize(config: PluginConfig): Promise<void> | void;

  /** Create PostCSS plugin instance */
  createPlugin(context: PluginContext): Plugin;

  /** Cleanup plugin resources */
  cleanup?(): Promise<void> | void;

  /** Plugin dependencies (other plugin names) */
  dependencies?: string[];

  /** Plugin conflicts (incompatible plugin names) */
  conflicts?: string[];
}

/**
 * Plugin manager interface
 */
export interface PluginManager {
  /** Register a plugin */
  register(plugin: EnigmaPlugin): void;

  /** Unregister a plugin */
  unregister(pluginName: string): void;

  /** Get registered plugin */
  getPlugin(pluginName: string): EnigmaPlugin | undefined;

  /** Get all registered plugins */
  getAllPlugins(): EnigmaPlugin[];

  /** Check if plugin is registered */
  hasPlugin(pluginName: string): boolean;

  /** Validate plugin dependencies */
  validateDependencies(pluginNames: string[]): ValidationResult;

  /** Get execution order for plugins */
  getExecutionOrder(pluginNames: string[]): string[];

  /** Initialize all plugins */
  initializePlugins(configs: PluginConfig[]): Promise<void>;

  /** Cleanup all plugins */
  cleanup(): Promise<void>;
}

/**
 * Plugin validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Missing dependencies */
  missingDependencies: string[];
  /** Circular dependencies detected */
  circularDependencies: string[][];
  /** Plugin conflicts */
  conflicts: Array<{ plugin1: string; plugin2: string; reason: string }>;
}

/**
 * PostCSS processor configuration
 */
export interface ProcessorConfig {
  /** Plugins to apply */
  plugins: PluginConfig[];
  /** Input source map */
  sourceMap?: boolean | 'inline' | string;
  /** Output source map */
  outputSourceMap?: boolean | 'inline' | string;
  /** Input file path for source maps */
  from?: string;
  /** Output file path for source maps */
  to?: string;
  /** CSS parser to use */
  parser?: string | object;
  /** CSS stringifier to use */
  stringifier?: string | object;
  /** CSS syntax to use */
  syntax?: string | object;
}

/**
 * CSS processing result
 */
export interface ProcessingResult {
  /** Processed CSS content */
  css: string;
  /** Source map if generated */
  map?: string;
  /** Plugin results */
  pluginResults: PluginResult[];
  /** Processing warnings */
  warnings: Array<{
    plugin: string;
    text: string;
    line?: number;
    column?: number;
  }>;
  /** Dependencies discovered */
  dependencies: string[];
  /** Total processing time */
  totalTime: number;
  /** Peak memory usage */
  peakMemory?: number;
}

/**
 * Plugin discovery options
 */
export interface PluginDiscoveryOptions {
  /** Directories to search for plugins */
  searchPaths: string[];
  /** NPM package prefixes to discover */
  npmPrefixes: string[];
  /** Local plugin files to load */
  localPlugins: string[];
  /** Whether to include built-in plugins */
  includeBuiltins: boolean;
}

// Re-export frequently used types from dependencies
export type { Root, Result, Plugin, PluginCreator } from 'postcss';
export type { FrequencyAnalysisResult, PatternAnalysisResult } from '../patternAnalysis';
export type { EnigmaConfig } from '../config';
export type { Logger } from '../logger'; 