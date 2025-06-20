/**
 * Core type definitions for @tw-enigma/core
 */

/**
 * CSS content and metadata
 */
export interface CSSInput {
  content: string;
  filePath?: string;
  sourceMap?: string;
}

/**
 * Optimization metrics and statistics
 */
export interface OptimizationMetrics {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  classesOptimized: number;
  timeElapsed: number;
}

/**
 * Core optimization options
 */
export interface CoreOptimizationOptions {
  minify?: boolean;
  preserveComments?: boolean;
  generateSourceMap?: boolean;
  outputFormat?: 'css' | 'json' | 'both';
}

// Placeholder exports for future development
export type OptimizationEngine = 'default' | 'aggressive' | 'conservative';
export type OutputFormat = 'css' | 'json' | 'both';

// Registry types
export * from './types/registry';
