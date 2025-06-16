/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Optimization Cache Integration Layer
 * 
 * Provides seamless integration between the optimization cache and the existing
 * optimization pipeline. Handles storage and retrieval with fallback mechanisms
 * and ensures compatibility with all optimization workflows.
 * 
 * Features:
 * - Transparent cache integration with existing optimization flows
 * - Circuit breaker pattern for cache service unavailability
 * - Multi-layered cache checks (memory -> disk -> original processing)
 * - Thread safety and concurrent operation support
 * - Graceful cache miss handling
 * - Performance monitoring and metrics collection
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { 
  OptimizationCache, 
  CachedOptimizationResult, 
  OptimizationCacheConfig,
  getOptimizationCache 
} from './optimizationCache';
import type { EnigmaConfig } from './config';
import type { OptimizationResult } from './output/assetHasher';

/**
 * Circuit breaker states for cache availability
 */
type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Reset timeout in milliseconds */
  resetTimeout: number;
  /** Number of successful operations needed to close circuit */
  successThreshold: number;
  /** Timeout for cache operations in milliseconds */
  operationTimeout: number;
}

/**
 * Optimization operation context
 */
interface OptimizationContext {
  /** Input files being optimized */
  inputFiles: string[];
  /** Configuration for optimization */
  config: EnigmaConfig;
  /** Framework/integration type */
  framework?: string;
  /** Unique operation ID for tracking */
  operationId: string;
  /** Start time for performance measurement */
  startTime: number;
  /** Whether to bypass cache for this operation */
  bypassCache?: boolean;
}

/**
 * Storage and retrieval statistics
 */
interface StorageRetrievalStats {
  /** Total get operations attempted */
  getOperations: number;
  /** Total set operations attempted */
  setOperations: number;
  /** Successful get operations */
  successfulGets: number;
  /** Successful set operations */
  successfulSets: number;
  /** Cache hit rate */
  hitRate: number;
  /** Average retrieval time (ms) */
  averageRetrievalTime: number;
  /** Average storage time (ms) */
  averageStorageTime: number;
  /** Circuit breaker state */
  circuitBreakerState: CircuitBreakerState;
  /** Number of fallback operations */
  fallbackOperations: number;
}

/**
 * Optimization cache integration manager
 */
export class OptimizationCacheIntegration extends EventEmitter {
  private readonly cache: OptimizationCache;
  private readonly circuitBreakerConfig: CircuitBreakerConfig;
  private circuitBreakerState: CircuitBreakerState = 'closed';
  private circuitBreakerFailureCount = 0;
  private circuitBreakerLastFailureTime = 0;
  private circuitBreakerSuccessCount = 0;
  private readonly stats: StorageRetrievalStats;
  private readonly operationTimers = new Map<string, NodeJS.Timeout>();
  private readonly activeOperations = new Map<string, OptimizationContext>();

  constructor(cacheConfig?: Partial<OptimizationCacheConfig>) {
    super();

    // Initialize cache with provided configuration
    this.cache = getOptimizationCache(cacheConfig);

    // Circuit breaker configuration
    this.circuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      successThreshold: 3,
      operationTimeout: 5000, // 5 seconds
    };

    // Initialize statistics
    this.stats = {
      getOperations: 0,
      setOperations: 0,
      successfulGets: 0,
      successfulSets: 0,
      hitRate: 0,
      averageRetrievalTime: 0,
      averageStorageTime: 0,
      circuitBreakerState: 'closed',
      fallbackOperations: 0,
    };

    this.setupEventHandlers();
  }

  /**
   * Attempt to retrieve optimization result from cache
   * Implements multi-layered cache checking with fallback mechanisms
   */
  async retrieveOptimizationResult(
    inputFiles: string[],
    config: EnigmaConfig,
    framework?: string,
    options: { bypassCache?: boolean; operationId?: string } = {}
  ): Promise<CachedOptimizationResult | null> {
    const operationId = options.operationId || this.generateOperationId();
    const startTime = performance.now();
    
    this.stats.getOperations++;

    // Create operation context
    const context: OptimizationContext = {
      inputFiles,
      config,
      framework,
      operationId,
      startTime,
      bypassCache: options.bypassCache,
    };

    this.activeOperations.set(operationId, context);

    try {
      // Check if cache should be bypassed
      if (context.bypassCache || !this.isCacheAvailable()) {
        this.stats.fallbackOperations++;
        this.emit('cache-bypassed', { operationId, reason: context.bypassCache ? 'manual' : 'circuit-breaker' });
        return null;
      }

      // Set operation timeout
      const timeoutPromise = this.createOperationTimeout(operationId);
      
      // Attempt cache retrieval with timeout
      const retrievalPromise = this.performCacheRetrieval(context);
      
      const result = await Promise.race([retrievalPromise, timeoutPromise]);

      if (result) {
        this.recordSuccessfulGet(startTime);
        this.handleCircuitBreakerSuccess();
        this.emit('cache-hit', { 
          operationId, 
          cacheKey: result.cacheKey,
          timeSaved: result.stats.optimizationTime,
          hitCount: result.hitCount 
        });
        
        return result;
      } else {
        this.recordMissedGet(startTime);
        this.handleCircuitBreakerSuccess(); // Cache miss is still a successful operation
        this.emit('cache-miss', { operationId, inputFiles });
        return null;
      }

    } catch (error) {
      this.handleCircuitBreakerFailure();
      this.recordFailedGet(startTime);
      this.emit('cache-error', { operationId, error, operation: 'get' });
      
      // Fallback: return null to trigger normal optimization
      this.stats.fallbackOperations++;
      return null;
    } finally {
      this.activeOperations.delete(operationId);
      this.clearOperationTimeout(operationId);
    }
  }

  /**
   * Store optimization result in cache with fallback handling
   */
  async storeOptimizationResult(
    inputFiles: string[],
    config: EnigmaConfig,
    result: OptimizationResult,
    framework?: string,
    options: { operationId?: string } = {}
  ): Promise<boolean> {
    const operationId = options.operationId || this.generateOperationId();
    const startTime = performance.now();
    
    this.stats.setOperations++;

    // Create operation context
    const context: OptimizationContext = {
      inputFiles,
      config,
      framework,
      operationId,
      startTime,
    };

    this.activeOperations.set(operationId, context);

    try {
      // Check if cache is available
      if (!this.isCacheAvailable()) {
        this.stats.fallbackOperations++;
        this.emit('cache-bypassed', { operationId, reason: 'circuit-breaker' });
        return false;
      }

      // Set operation timeout
      const timeoutPromise = this.createOperationTimeout(operationId);
      
      // Attempt cache storage with timeout
      const storagePromise = this.performCacheStorage(context, result);
      
      const success = await Promise.race([storagePromise, timeoutPromise]);

      if (success) {
        this.recordSuccessfulSet(startTime);
        this.handleCircuitBreakerSuccess();
        this.emit('cache-stored', { 
          operationId, 
          inputFiles, 
          size: this.estimateResultSize(result),
          cacheKey: await this.cache.generateCacheKey(inputFiles, config, framework) 
        });
        
        return true;
      } else {
        this.recordFailedSet(startTime);
        return false;
      }

    } catch (error) {
      this.handleCircuitBreakerFailure();
      this.recordFailedSet(startTime);
      this.emit('cache-error', { operationId, error, operation: 'set' });
      
      // Graceful degradation: continue without caching
      return false;
    } finally {
      this.activeOperations.delete(operationId);
      this.clearOperationTimeout(operationId);
    }
  }

  /**
   * Invalidate cache entries (with circuit breaker protection)
   */
  async invalidateCache(
    files?: string[],
    config?: EnigmaConfig,
    reason: string = 'manual'
  ): Promise<number> {
    if (!this.isCacheAvailable()) {
      this.emit('cache-bypassed', { reason: 'circuit-breaker', operation: 'invalidate' });
      return 0;
    }

    try {
      let invalidatedCount = 0;

      if (files) {
        invalidatedCount = await this.cache.invalidateByFiles(files, reason as any);
      } else if (config) {
        invalidatedCount = await this.cache.invalidateByConfig(config);
      } else {
        await this.cache.clear();
        invalidatedCount = -1; // Indicates full clear
      }

      this.emit('cache-invalidated', { reason, files, config, count: invalidatedCount });
      return invalidatedCount;

    } catch (error) {
      this.handleCircuitBreakerFailure();
      this.emit('cache-error', { error, operation: 'invalidate' });
      return 0;
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): StorageRetrievalStats {
    return {
      ...this.stats,
      hitRate: this.stats.getOperations > 0 
        ? (this.stats.successfulGets / this.stats.getOperations) * 100 
        : 0,
      circuitBreakerState: this.circuitBreakerState,
    };
  }

  /**
   * Get detailed cache analytics
   */
  getCacheAnalytics() {
    return this.cache.getAnalytics();
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = 'closed';
    this.circuitBreakerFailureCount = 0;
    this.circuitBreakerSuccessCount = 0;
    this.emit('circuit-breaker-reset');
  }

  /**
   * Perform actual cache retrieval
   */
  private async performCacheRetrieval(context: OptimizationContext): Promise<CachedOptimizationResult | null> {
    const { inputFiles, config, framework } = context;
    
    // Multi-layered cache check
    try {
      // Layer 1: Memory cache
      const result = await this.cache.get(inputFiles, config, framework);
      
      if (result) {
        return result;
      }

      // Layer 2: If persistence is enabled, the cache manager handles disk cache internally
      // Layer 3: Return null to trigger fallback to original optimization
      return null;

    } catch (error) {
      // Log error and re-throw to trigger circuit breaker
      this.emit('cache-retrieval-error', { context, error });
      throw error;
    }
  }

  /**
   * Perform actual cache storage
   */
  private async performCacheStorage(
    context: OptimizationContext, 
    result: OptimizationResult
  ): Promise<boolean> {
    const { inputFiles, config, framework } = context;
    
    try {
      return await this.cache.set(inputFiles, config, result, framework);
    } catch (error) {
      this.emit('cache-storage-error', { context, error });
      throw error;
    }
  }

  /**
   * Check if cache is available based on circuit breaker state
   */
  private isCacheAvailable(): boolean {
    const now = Date.now();
    
    switch (this.circuitBreakerState) {
      case 'closed':
        return true;
        
      case 'open':
        // Check if enough time has passed to try half-open
        if (now - this.circuitBreakerLastFailureTime >= this.circuitBreakerConfig.resetTimeout) {
          this.circuitBreakerState = 'half-open';
          this.circuitBreakerSuccessCount = 0;
          this.emit('circuit-breaker-half-open');
          return true;
        }
        return false;
        
      case 'half-open':
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Handle circuit breaker failure
   */
  private handleCircuitBreakerFailure(): void {
    this.circuitBreakerFailureCount++;
    this.circuitBreakerLastFailureTime = Date.now();

    if (this.circuitBreakerState === 'half-open') {
      // Immediately open circuit if failure occurs in half-open state
      this.circuitBreakerState = 'open';
      this.circuitBreakerSuccessCount = 0;
      this.emit('circuit-breaker-opened', { reason: 'half-open-failure' });
    } else if (
      this.circuitBreakerState === 'closed' &&
      this.circuitBreakerFailureCount >= this.circuitBreakerConfig.failureThreshold
    ) {
      // Open circuit if failure threshold is reached
      this.circuitBreakerState = 'open';
      this.emit('circuit-breaker-opened', { reason: 'failure-threshold' });
    }
  }

  /**
   * Handle circuit breaker success
   */
  private handleCircuitBreakerSuccess(): void {
    if (this.circuitBreakerState === 'half-open') {
      this.circuitBreakerSuccessCount++;
      
      if (this.circuitBreakerSuccessCount >= this.circuitBreakerConfig.successThreshold) {
        this.circuitBreakerState = 'closed';
        this.circuitBreakerFailureCount = 0;
        this.circuitBreakerSuccessCount = 0;
        this.emit('circuit-breaker-closed');
      }
    } else if (this.circuitBreakerState === 'closed') {
      // Reset failure count on successful operation
      this.circuitBreakerFailureCount = Math.max(0, this.circuitBreakerFailureCount - 1);
    }
  }

  /**
   * Create operation timeout promise
   */
  private createOperationTimeout(operationId: string): Promise<null> {
    return new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Cache operation timeout for ${operationId}`));
      }, this.circuitBreakerConfig.operationTimeout);
      
      this.operationTimers.set(operationId, timer);
    });
  }

  /**
   * Clear operation timeout
   */
  private clearOperationTimeout(operationId: string): void {
    const timer = this.operationTimers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.operationTimers.delete(operationId);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate result size for metrics
   */
  private estimateResultSize(result: OptimizationResult): number {
    return JSON.stringify(result).length * 2; // Rough UTF-16 estimate
  }

  /**
   * Record successful get operation
   */
  private recordSuccessfulGet(startTime: number): void {
    this.stats.successfulGets++;
    const duration = performance.now() - startTime;
    this.updateAverageRetrievalTime(duration);
  }

  /**
   * Record missed get operation
   */
  private recordMissedGet(startTime: number): void {
    const duration = performance.now() - startTime;
    this.updateAverageRetrievalTime(duration);
  }

  /**
   * Record failed get operation
   */
  private recordFailedGet(startTime: number): void {
    const duration = performance.now() - startTime;
    this.updateAverageRetrievalTime(duration);
  }

  /**
   * Record successful set operation
   */
  private recordSuccessfulSet(startTime: number): void {
    this.stats.successfulSets++;
    const duration = performance.now() - startTime;
    this.updateAverageStorageTime(duration);
  }

  /**
   * Record failed set operation
   */
  private recordFailedSet(startTime: number): void {
    const duration = performance.now() - startTime;
    this.updateAverageStorageTime(duration);
  }

  /**
   * Update average retrieval time
   */
  private updateAverageRetrievalTime(duration: number): void {
    const totalOperations = this.stats.getOperations;
    const currentAverage = this.stats.averageRetrievalTime;
    this.stats.averageRetrievalTime = 
      (currentAverage * (totalOperations - 1) + duration) / totalOperations;
  }

  /**
   * Update average storage time
   */
  private updateAverageStorageTime(duration: number): void {
    const totalOperations = this.stats.setOperations;
    const currentAverage = this.stats.averageStorageTime;
    this.stats.averageStorageTime = 
      (currentAverage * (totalOperations - 1) + duration) / totalOperations;
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    this.cache.on('cache-hit', (data) => {
      this.emit('cache-operation', { type: 'hit', ...data });
    });

    this.cache.on('cache-miss', (data) => {
      this.emit('cache-operation', { type: 'miss', ...data });
    });

    this.cache.on('cache-set', (data) => {
      this.emit('cache-operation', { type: 'set', ...data });
    });

    this.cache.on('cache-invalidated', (data) => {
      this.emit('cache-operation', { type: 'invalidated', ...data });
    });

    this.cache.on('error', (error) => {
      this.emit('cache-error', { error, source: 'cache-manager' });
    });
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    // Clear all timers
    for (const timer of this.operationTimers.values()) {
      clearTimeout(timer);
    }
    this.operationTimers.clear();

    // Clear active operations
    this.activeOperations.clear();

    // Destroy cache
    await this.cache.destroy();

    this.removeAllListeners();
  }
}

/**
 * Global optimization cache integration instance
 */
let globalIntegration: OptimizationCacheIntegration | null = null;

/**
 * Get or create global optimization cache integration instance
 */
export function getOptimizationCacheIntegration(
  cacheConfig?: Partial<OptimizationCacheConfig>
): OptimizationCacheIntegration {
  if (!globalIntegration) {
    globalIntegration = new OptimizationCacheIntegration(cacheConfig);
  }
  return globalIntegration;
}

/**
 * Create a new optimization cache integration instance
 */
export function createOptimizationCacheIntegration(
  cacheConfig?: Partial<OptimizationCacheConfig>
): OptimizationCacheIntegration {
  return new OptimizationCacheIntegration(cacheConfig);
} 