/**
 * Performance Optimization Module for Tailwind Enigma Core
 * 
 * This module provides comprehensive performance optimizations for large codebases:
 * - Worker thread pool management for CPU-intensive tasks
 * - Intelligent caching with multiple strategies (LRU, LFU, TTL, ARC)
 * - Regex pattern optimization and compilation caching
 * - Memory optimization and profiling with leak detection
 * - Stream processing for large files without memory bloat
 * - Batch processing coordination with priority queues
 * - Performance monitoring and analytics
 * 
 * @example Basic Usage
 * ```typescript
 * import { WorkerManager, CacheManager, RegexOptimizer } from './performance';
 * 
 * // Initialize components
 * const workerManager = new WorkerManager();
 * const cache = new CacheManager({ strategy: 'lru', maxSize: 100 * 1024 * 1024 });
 * const regexOptimizer = new RegexOptimizer();
 * 
 * await workerManager.initialize();
 * 
 * // Use optimized regex compilation
 * const regex = regexOptimizer.compile('\\b(?:sm:|md:|lg:)?[a-zA-Z][a-zA-Z0-9-]*', 'g');
 * 
 * // Cache results
 * await cache.set('processed_css', results);
 * ```
 */

// Core performance components
export { WorkerManager } from './workerManager.js';
export { CacheManager, createCacheManager, getGlobalCacheManager } from './cacheManager.js';
export { RegexOptimizer, getGlobalRegexOptimizer, compileRegex, matchOptimized, replaceOptimized, COMMON_CSS_PATTERNS } from './regexOptimizer.js';
export { StreamOptimizer } from './streamOptimizer.js';
export { BatchCoordinator } from './batchCoordinator.js';
export { MemoryProfiler, getGlobalMemoryProfiler, getQuickMemoryStatus, forceGarbageCollection } from './memoryProfiler.js';
export { PerformanceProfiler } from './profiler.js';

// Configuration and types
export {
  type PerformanceConfig,
  type WorkerConfig,
  type CacheConfig,
  type MemoryConfig,
  type ProfilingConfig,
  type StreamConfig,
  type BatchConfig,
  type PerformanceMetrics,
  type WorkerTask,
  type CacheStrategy,
  type SystemResources,
  type PerformanceEvents,
  DEFAULT_PERFORMANCE_CONFIG,
  ENVIRONMENT_PROFILES,
  validatePerformanceConfig,
  createEnvironmentConfig
} from './config.js';

// Performance constants
export const PERFORMANCE_CONSTANTS = {
  DEFAULT_WORKER_POOL_SIZE: 4,
  DEFAULT_CACHE_SIZE: 100 * 1024 * 1024, // 100MB
  DEFAULT_BATCH_SIZE: 1000,
  MIN_MEMORY_FOR_WORKERS: 512 * 1024 * 1024, // 512MB
  PERFORMANCE_BUDGET_MS: 100, // 100ms budget for operations
  MEMORY_PRESSURE_THRESHOLD: 0.8, // 80% memory usage threshold
  
  // Cache strategies
  CACHE_STRATEGIES: ['lru', 'lfu', 'ttl', 'arc'] as const,
  
  // Performance thresholds
  REGEX_COMPILATION_THRESHOLD_MS: 10,
  MEMORY_LEAK_THRESHOLD_MB: 50,
  GC_INEFFECTIVE_THRESHOLD_MB: 5,
  
  // Worker limits
  MAX_WORKER_POOL_SIZE: 16,
  MIN_WORKER_POOL_SIZE: 1,
  WORKER_TASK_TIMEOUT_MS: 30000,
  
  // Stream processing
  DEFAULT_HIGH_WATER_MARK: 16 * 1024, // 16KB
  MAX_CONCURRENT_STREAMS: 10,
  
  // Batch processing
  MIN_BATCH_SIZE: 1,
  MAX_BATCH_SIZE: 10000,
  BATCH_PROCESSING_DELAY_MS: 100
} as const;

/**
 * Utility functions for performance monitoring and optimization
 */

/**
 * Measure performance of a function execution
 */
export function measurePerformance<T>(
  fn: () => T | Promise<T>,
  label?: string
): Promise<{ result: T; duration: number; memoryUsed: number }> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const result = await fn();
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      const duration = endTime - startTime;
      const memoryUsed = endMemory - startMemory;
      
      if (label) {
        console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms, Memory: ${formatBytes(memoryUsed)}`);
      }
      
      resolve({ result, duration, memoryUsed });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create a performance timer for tracking operation durations
 */
export function createPerformanceTimer(label?: string) {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  return {
    stop: () => {
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const duration = endTime - startTime;
      const memoryUsed = endMemory - startMemory;
      
      if (label) {
        console.log(`[Timer] ${label}: ${duration.toFixed(2)}ms, Memory: ${formatBytes(memoryUsed)}`);
      }
      
      return { duration, memoryUsed };
    },
    elapsed: () => performance.now() - startTime
  };
}

/**
 * Format bytes for human-readable output
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.abs(bytes);
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  const formatted = size.toFixed(unitIndex > 0 ? 2 : 0);
  const sign = bytes < 0 ? '-' : '';
  
  return `${sign}${formatted} ${units[unitIndex]}`;
}

/**
 * Format duration for human-readable output
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(2)}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  } else if (milliseconds < 3600000) {
    return `${(milliseconds / 60000).toFixed(2)}m`;
  } else {
    return `${(milliseconds / 3600000).toFixed(2)}h`;
  }
}

/**
 * Get current system resource information
 */
export function getSystemResources(): SystemResources {
  const os = require('os');
  
  return {
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpuCount: os.cpus().length,
    platform: os.platform(),
    nodeVersion: process.version,
    v8Version: process.versions.v8,
    uptime: process.uptime()
  };
}

/**
 * Check if current system has sufficient resources for performance optimizations
 */
export function checkSystemRequirements(): {
  sufficient: boolean;
  recommendations: string[];
  warnings: string[];
} {
  const resources = getSystemResources();
  const memoryUsage = process.memoryUsage();
  const recommendations: string[] = [];
  const warnings: string[] = [];
  
  let sufficient = true;
  
  // Check available memory
  if (resources.freeMemory < PERFORMANCE_CONSTANTS.MIN_MEMORY_FOR_WORKERS) {
    sufficient = false;
    warnings.push(`Low available memory: ${formatBytes(resources.freeMemory)} (minimum: ${formatBytes(PERFORMANCE_CONSTANTS.MIN_MEMORY_FOR_WORKERS)})`);
    recommendations.push('Consider increasing available memory or reducing worker pool size');
  }
  
  // Check CPU cores for worker pool sizing
  if (resources.cpuCount < 2) {
    warnings.push('Single-core system detected - worker threads may not provide performance benefits');
    recommendations.push('Consider disabling worker threads or using a machine with more CPU cores');
  } else if (resources.cpuCount >= 8) {
    recommendations.push('High-core system detected - consider increasing worker pool size for better performance');
  }
  
  // Check heap usage
  const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  if (heapUsagePercent > 80) {
    warnings.push(`High heap usage: ${heapUsagePercent.toFixed(1)}%`);
    recommendations.push('Consider memory optimization or increasing heap size with --max-old-space-size');
  }
  
  return { sufficient, recommendations, warnings };
}

/**
 * Create optimized performance configuration based on system resources
 */
export function createOptimizedConfig(): PerformanceConfig {
  const resources = getSystemResources();
  const baseConfig = DEFAULT_PERFORMANCE_CONFIG;
  
  // Optimize worker pool size based on CPU cores
  const workerPoolSize = Math.max(2, Math.min(resources.cpuCount, PERFORMANCE_CONSTANTS.MAX_WORKER_POOL_SIZE));
  
  // Optimize cache size based on available memory
  const availableForCache = resources.freeMemory * 0.1; // Use 10% of free memory
  const cacheSize = Math.min(availableForCache, 500 * 1024 * 1024); // Max 500MB
  
  return {
    ...baseConfig,
    workers: {
      ...baseConfig.workers,
      poolSize: workerPoolSize
    },
    cache: {
      ...baseConfig.cache,
      maxSize: cacheSize
    },
    memory: {
      ...baseConfig.memory,
      memoryBudget: Math.min(resources.freeMemory * 0.8, 2 * 1024 * 1024 * 1024) // 80% of free memory, max 2GB
    }
  };
} 