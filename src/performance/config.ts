/**
 * Performance Configuration and Type Definitions
 * Centralizes all configuration options for performance optimizations
 */

import { EventEmitter } from 'events';

/**
 * Cache strategy options
 */
export type CacheStrategy = 'lru' | 'lfu' | 'ttl' | 'arc';

/**
 * Worker task types for type-safe worker communication
 */
export interface WorkerTask<T = unknown, R = unknown> {
  id: string;
  type: string;
  data: T;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

/**
 * Worker configuration options
 */
export interface WorkerConfig {
  enabled: boolean;
  poolSize: number;
  taskTimeout: number;
  maxQueueSize: number;
  enableFallback: boolean;
  workerScript?: string;
  envVars?: Record<string, string>;
}

/**
 * Caching configuration options
 */
export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  strategy: CacheStrategy;
  ttl?: number; // Time to live in milliseconds
  persistence: boolean;
  persistencePath?: string;
  compressionEnabled: boolean;
  memoryPressureThreshold: number;
}

/**
 * Memory optimization configuration
 */
export interface MemoryConfig {
  maxSemiSpaceSize: number; // V8 --max-semi-space-size value in MB
  maxOldSpaceSize: number;  // V8 --max-old-space-size value in MB
  enableGCOptimization: boolean;
  memoryBudget: number; // Maximum memory usage in bytes
  enableObjectPooling: boolean;
  gcThreshold: number; // Memory usage % to trigger GC
}

/**
 * Performance profiling configuration
 */
export interface ProfilingConfig {
  enabled: boolean;
  samplingRate: number; // Samples per second
  enableFlameGraphs: boolean;
  enableMemoryProfiling: boolean;
  enableCPUProfiling: boolean;
  outputDirectory: string;
  autoExport: boolean;
  enableOpenTelemetry: boolean;
}

/**
 * Stream processing configuration
 */
export interface StreamConfig {
  enabled: boolean;
  highWaterMark: number; // Buffer size for streams
  enableBackpressure: boolean;
  maxConcurrentStreams: number;
  chunkSize: number;
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  enabled: boolean;
  defaultBatchSize: number;
  maxBatchSize: number;
  processingDelay: number; // Delay between batches in ms
  enablePrioritization: boolean;
  maxConcurrentBatches: number;
}

/**
 * Complete performance configuration
 */
export interface PerformanceConfig {
  workers: WorkerConfig;
  cache: CacheConfig;
  memory: MemoryConfig;
  profiling: ProfilingConfig;
  streams: StreamConfig;
  batching: BatchConfig;
  enableAnalytics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  environmentProfile?: 'development' | 'production' | 'testing';
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  // Timing metrics
  operationDuration: number;
  totalExecutionTime: number;
  averageOperationTime: number;
  
  // Memory metrics
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  
  // Worker metrics
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  
  // Cache metrics
  cacheHits: number;
  cacheMisses: number;
  cacheSize: number;
  cacheHitRate: number;
  
  // System metrics
  cpuUsage: number;
  memoryUsage: number;
  eventLoopLag: number;
  
  // Performance indicators
  throughput: number; // Operations per second
  latency: number; // Average response time
  errorRate: number; // Percentage of failed operations
  
  timestamp: number;
}

/**
 * Resource usage information
 */
export interface SystemResources {
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
  platform: string;
  nodeVersion: string;
  v8Version: string;
  uptime: number;
}

/**
 * Performance event types for EventEmitter
 */
export interface PerformanceEvents extends EventEmitter {
  on(event: 'metrics', listener: (metrics: PerformanceMetrics) => void): this;
  on(event: 'warning', listener: (warning: { type: string; message: string; data?: unknown }) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'workerStarted', listener: (workerId: string) => void): this;
  on(event: 'workerStopped', listener: (workerId: string) => void): this;
  on(event: 'cacheEviction', listener: (key: string, reason: string) => void): this;
  on(event: 'memoryPressure', listener: (usage: number) => void): this;
  on(event: 'performanceBudgetExceeded', listener: (operation: string, duration: number) => void): this;
}

/**
 * Default performance configuration with sensible defaults
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  workers: {
    enabled: true,
    poolSize: Math.max(2, Math.min(8, require('os').cpus().length)),
    taskTimeout: 30000, // 30 seconds
    maxQueueSize: 1000,
    enableFallback: true,
  },
  
  cache: {
    enabled: true,
    maxSize: 100 * 1024 * 1024, // 100MB
    strategy: 'lru',
    ttl: 3600000, // 1 hour
    persistence: false,
    compressionEnabled: true,
    memoryPressureThreshold: 0.8,
  },
  
  memory: {
    maxSemiSpaceSize: 64, // 64MB for new generation
    maxOldSpaceSize: 2048, // 2GB for old generation  
    enableGCOptimization: true,
    memoryBudget: 1024 * 1024 * 1024, // 1GB
    enableObjectPooling: true,
    gcThreshold: 0.8,
  },
  
  profiling: {
    enabled: false, // Disabled by default for production
    samplingRate: 99, // 99 samples per second
    enableFlameGraphs: false,
    enableMemoryProfiling: false,
    enableCPUProfiling: false,
    outputDirectory: './performance-profiles',
    autoExport: false,
    enableOpenTelemetry: false,
  },
  
  streams: {
    enabled: true,
    highWaterMark: 64 * 1024, // 64KB
    enableBackpressure: true,
    maxConcurrentStreams: 10,
    chunkSize: 16 * 1024, // 16KB
  },
  
  batching: {
    enabled: true,
    defaultBatchSize: 100,
    maxBatchSize: 1000,
    processingDelay: 10, // 10ms
    enablePrioritization: true,
    maxConcurrentBatches: 5,
  },
  
  enableAnalytics: true,
  logLevel: 'info',
  environmentProfile: 'production',
};

/**
 * Environment-specific configuration profiles
 */
export const ENVIRONMENT_PROFILES = {
  development: {
    profiling: {
      enabled: true,
      enableFlameGraphs: true,
      enableMemoryProfiling: true,
    },
    logLevel: 'debug' as const,
    workers: {
      poolSize: 2, // Fewer workers for development
    },
  },
  
  testing: {
    workers: {
      enabled: false, // Disable workers for consistent testing
    },
    cache: {
      enabled: false, // Disable cache for isolation
    },
    profiling: {
      enabled: false,
    },
    logLevel: 'warn' as const,
  },
  
  production: {
    profiling: {
      enabled: false, // Performance overhead in production
    },
    memory: {
      enableGCOptimization: true,
      maxSemiSpaceSize: 128, // Larger for production workloads
    },
    logLevel: 'error' as const,
  },
} as const;

/**
 * Validates performance configuration
 */
export function validatePerformanceConfig(config: Partial<PerformanceConfig>): string[] {
  const errors: string[] = [];
  
  if (config.workers?.poolSize && config.workers.poolSize < 1) {
    errors.push('Worker pool size must be at least 1');
  }
  
  if (config.cache?.maxSize && config.cache.maxSize < 1024 * 1024) {
    errors.push('Cache size must be at least 1MB');
  }
  
  if (config.memory?.memoryBudget && config.memory.memoryBudget < 128 * 1024 * 1024) {
    errors.push('Memory budget must be at least 128MB');
  }
  
  if (config.profiling?.samplingRate && (config.profiling.samplingRate < 1 || config.profiling.samplingRate > 1000)) {
    errors.push('Profiling sampling rate must be between 1 and 1000');
  }
  
  return errors;
}

/**
 * Merges configuration with environment-specific overrides
 */
export function createEnvironmentConfig(
  baseConfig: Partial<PerformanceConfig> = {},
  environment: keyof typeof ENVIRONMENT_PROFILES = 'production'
): PerformanceConfig {
  const envOverrides = ENVIRONMENT_PROFILES[environment];
  
  return {
    ...DEFAULT_PERFORMANCE_CONFIG,
    ...baseConfig,
    workers: { ...DEFAULT_PERFORMANCE_CONFIG.workers, ...baseConfig.workers, ...envOverrides.workers },
    cache: { ...DEFAULT_PERFORMANCE_CONFIG.cache, ...baseConfig.cache, ...envOverrides.cache },
    memory: { ...DEFAULT_PERFORMANCE_CONFIG.memory, ...baseConfig.memory, ...envOverrides.memory },
    profiling: { ...DEFAULT_PERFORMANCE_CONFIG.profiling, ...baseConfig.profiling, ...envOverrides.profiling },
    logLevel: envOverrides.logLevel || baseConfig.logLevel || DEFAULT_PERFORMANCE_CONFIG.logLevel,
    environmentProfile: environment,
  };
} 