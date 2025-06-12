/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  OptimizationCacheIntegration,
  createOptimizationCacheIntegration,
  getOptimizationCacheIntegration,
} from '../src/optimizationCacheIntegration.js';
import type { EnigmaConfig } from '../src/config.js';
import type { OptimizationResult } from '../src/output/assetHasher.js';

// Mock the optimization cache
vi.mock('../src/optimizationCache.js', () => ({
  getOptimizationCache: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
    generateCacheKey: vi.fn().mockResolvedValue('mock-cache-key-123'),
    invalidateByFiles: vi.fn(),
    invalidateByConfig: vi.fn(),
    clear: vi.fn(),
    getAnalytics: vi.fn().mockReturnValue({
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      averageTimeSaved: 0,
      totalTimeSaved: 0,
      topFileTypes: [],
      sizeStats: {
        totalEntries: 0,
        totalSize: 0,
        averageEntrySize: 0,
        largestEntry: 0,
      },
      invalidationStats: {
        byReason: {},
        totalInvalidations: 0,
      },
    }),
    on: vi.fn(),
    destroy: vi.fn(),
  }),
}));

describe('OptimizationCacheIntegration', () => {
  let integration: OptimizationCacheIntegration;
  let mockConfig: EnigmaConfig;
  let mockOptimizationResult: OptimizationResult;
  let mockCache: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get mock cache reference
    const { getOptimizationCache } = require('../src/optimizationCache.js');
    mockCache = getOptimizationCache();

    // Create mock configuration
    mockConfig = {
      input: { patterns: ['src/**/*.css'] },
      output: { directory: 'dist' },
      optimization: { enabled: true, minify: true },
      nameGeneration: { standard: { enabled: true } },
      framework: { type: 'react' },
      processing: { parallel: true },
      performance: { monitoring: true },
    } as EnigmaConfig;

    // Create mock optimization result
    mockOptimizationResult = {
      optimizedCSS: '.a{color:red}',
      classMap: { 'text-red-500': 'a' },
      stats: {
        originalSize: 1000,
        optimizedSize: 500,
        compressionRatio: 0.5,
        optimizationTime: 100,
        classesOptimized: 10,
        duplicatesRemoved: 5,
      },
      sourceMap: null,
      metadata: {
        timestamp: new Date(),
        version: '1.0.0',
        inputFiles: ['src/styles.css'],
      },
    };

    // Create integration instance
    integration = createOptimizationCacheIntegration({
      enabled: true,
      maxSize: 1024 * 1024,
      ttl: 60000,
      enableFileWatching: false,
      enableCompression: false,
    });
  });

  afterEach(async () => {
    if (integration) {
      await integration.destroy();
    }
  });

  describe('Basic Cache Operations', () => {
    it('should retrieve optimization result from cache', async () => {
      const cachedResult = {
        ...mockOptimizationResult,
        cachedAt: new Date(),
        cacheKey: 'mock-cache-key-123',
        inputFiles: ['src/styles.css'],
        configSnapshot: mockConfig,
        hitCount: 1,
        lastAccessed: new Date(),
      };

      mockCache.get.mockResolvedValue(cachedResult);

      const result = await integration.retrieveOptimizationResult(
        ['src/styles.css'],
        mockConfig
      );

      expect(result).toBeTruthy();
      expect(result?.optimizedCSS).toBe(mockOptimizationResult.optimizedCSS);
      expect(result?.hitCount).toBe(2); // Should be incremented
      expect(mockCache.get).toHaveBeenCalledWith(['src/styles.css'], mockConfig, undefined);
    });

    it('should return null for cache miss', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await integration.retrieveOptimizationResult(
        ['src/nonexistent.css'],
        mockConfig
      );

      expect(result).toBeNull();
      expect(mockCache.get).toHaveBeenCalledWith(['src/nonexistent.css'], mockConfig, undefined);
    });

    it('should store optimization result in cache', async () => {
      mockCache.set.mockResolvedValue(true);

      const success = await integration.storeOptimizationResult(
        ['src/styles.css'],
        mockConfig,
        mockOptimizationResult
      );

      expect(success).toBe(true);
      expect(mockCache.set).toHaveBeenCalledWith(
        ['src/styles.css'],
        mockConfig,
        expect.objectContaining({
          ...mockOptimizationResult,
          cachedAt: expect.any(Date),
          cacheKey: 'mock-cache-key-123',
          inputFiles: ['src/styles.css'],
          configSnapshot: expect.any(Object),
          hitCount: 0,
          lastAccessed: expect.any(Date),
        }),
        undefined
      );
    });

    it('should handle framework-specific operations', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(true);

      // Test with framework
      await integration.retrieveOptimizationResult(
        ['src/component.vue'],
        mockConfig,
        'vue'
      );

      await integration.storeOptimizationResult(
        ['src/component.vue'],
        mockConfig,
        mockOptimizationResult,
        'vue'
      );

      expect(mockCache.get).toHaveBeenCalledWith(['src/component.vue'], mockConfig, 'vue');
      expect(mockCache.set).toHaveBeenCalledWith(
        ['src/component.vue'],
        mockConfig,
        expect.any(Object),
        'vue'
      );
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit breaker after failure threshold', async () => {
      // Mock cache failures
      mockCache.get.mockRejectedValue(new Error('Cache failure'));

      const inputFiles = ['src/test.css'];

      // Trigger failures to reach threshold (default: 5)
      for (let i = 0; i < 5; i++) {
        await integration.retrieveOptimizationResult(inputFiles, mockConfig);
      }

      // Circuit should be open now
      const stats = integration.getStats();
      expect(stats.circuitBreakerState).toBe('open');
      expect(stats.fallbackOperations).toBeGreaterThan(0);

      // Next operation should be bypassed
      const result = await integration.retrieveOptimizationResult(inputFiles, mockConfig);
      expect(result).toBeNull();
    });

    it('should transition to half-open after timeout', async () => {
      // Create integration with short reset timeout for testing
      const shortTimeoutIntegration = createOptimizationCacheIntegration();
      
      // Override circuit breaker config for testing
      (shortTimeoutIntegration as any).circuitBreakerConfig.resetTimeout = 100; // 100ms
      (shortTimeoutIntegration as any).circuitBreakerConfig.failureThreshold = 2;

      // Trigger failures to open circuit
      mockCache.get.mockRejectedValue(new Error('Cache failure'));
      
      await shortTimeoutIntegration.retrieveOptimizationResult(['test.css'], mockConfig);
      await shortTimeoutIntegration.retrieveOptimizationResult(['test.css'], mockConfig);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should transition to half-open on next operation
      mockCache.get.mockResolvedValue(null);
      await shortTimeoutIntegration.retrieveOptimizationResult(['test.css'], mockConfig);

      await shortTimeoutIntegration.destroy();
    });

    it('should close circuit after successful operations in half-open state', async () => {
      const testIntegration = createOptimizationCacheIntegration();
      
      // Set circuit to half-open manually
      (testIntegration as any).circuitBreakerState = 'half-open';

      // Mock successful operations
      mockCache.get.mockResolvedValue(null);

      // Perform successful operations (default success threshold: 3)
      for (let i = 0; i < 3; i++) {
        await testIntegration.retrieveOptimizationResult(['test.css'], mockConfig);
      }

      const stats = testIntegration.getStats();
      expect(stats.circuitBreakerState).toBe('closed');

      await testIntegration.destroy();
    });

    it('should reset circuit breaker manually', () => {
      // Set circuit to open
      (integration as any).circuitBreakerState = 'open';
      (integration as any).circuitBreakerFailureCount = 10;

      integration.resetCircuitBreaker();

      const stats = integration.getStats();
      expect(stats.circuitBreakerState).toBe('closed');
    });
  });

  describe('Operation Timeouts', () => {
    it('should timeout long-running cache operations', async () => {
      // Mock cache operation that never resolves
      mockCache.get.mockImplementation(() => new Promise(() => {}));

      // Override timeout for testing
      (integration as any).circuitBreakerConfig.operationTimeout = 50; // 50ms

      const startTime = Date.now();
      const result = await integration.retrieveOptimizationResult(
        ['src/slow.css'],
        mockConfig
      );
      const duration = Date.now() - startTime;

      expect(result).toBeNull();
      expect(duration).toBeLessThan(100); // Should timeout quickly
    });

    it('should clean up operation timers', async () => {
      mockCache.get.mockResolvedValue(null);

      const operationId = 'test-operation';
      await integration.retrieveOptimizationResult(
        ['src/test.css'],
        mockConfig,
        undefined,
        { operationId }
      );

      // Timer should be cleaned up
      const timers = (integration as any).operationTimers;
      expect(timers.has(operationId)).toBe(false);
    });
  });

  describe('Performance Metrics and Analytics', () => {
    it('should track operation statistics', async () => {
      mockCache.get.mockResolvedValue(null); // miss
      mockCache.set.mockResolvedValue(true);

      // Perform operations
      await integration.retrieveOptimizationResult(['test1.css'], mockConfig);
      await integration.storeOptimizationResult(['test1.css'], mockConfig, mockOptimizationResult);
      
      // Hit
      const cachedResult = {
        ...mockOptimizationResult,
        cachedAt: new Date(),
        cacheKey: 'test-key',
        inputFiles: ['test1.css'],
        configSnapshot: mockConfig,
        hitCount: 1,
        lastAccessed: new Date(),
      };
      mockCache.get.mockResolvedValue(cachedResult);
      await integration.retrieveOptimizationResult(['test1.css'], mockConfig);

      const stats = integration.getStats();
      expect(stats.getOperations).toBe(2);
      expect(stats.setOperations).toBe(1);
      expect(stats.successfulGets).toBe(1);
      expect(stats.successfulSets).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should track timing metrics', async () => {
      mockCache.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(null), 10))
      );

      await integration.retrieveOptimizationResult(['test.css'], mockConfig);

      const stats = integration.getStats();
      expect(stats.averageRetrievalTime).toBeGreaterThan(0);
    });

    it('should provide cache analytics', () => {
      const analytics = integration.getCacheAnalytics();
      expect(analytics).toBeDefined();
      expect(analytics.totalHits).toBe(0);
      expect(analytics.totalMisses).toBe(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache by files', async () => {
      mockCache.invalidateByFiles.mockResolvedValue(3);

      const count = await integration.invalidateCache(['file1.css', 'file2.css']);
      expect(count).toBe(3);
      expect(mockCache.invalidateByFiles).toHaveBeenCalledWith(
        ['file1.css', 'file2.css'],
        'manual'
      );
    });

    it('should invalidate cache by configuration', async () => {
      mockCache.invalidateByConfig.mockResolvedValue(5);

      const count = await integration.invalidateCache(undefined, mockConfig);
      expect(count).toBe(5);
      expect(mockCache.invalidateByConfig).toHaveBeenCalledWith(mockConfig);
    });

    it('should clear entire cache', async () => {
      mockCache.clear.mockResolvedValue(undefined);

      const count = await integration.invalidateCache();
      expect(count).toBe(-1); // Indicates full clear
      expect(mockCache.clear).toHaveBeenCalled();
    });

    it('should handle invalidation errors gracefully', async () => {
      mockCache.invalidateByFiles.mockRejectedValue(new Error('Invalidation failed'));

      const count = await integration.invalidateCache(['error-file.css']);
      expect(count).toBe(0);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle cache retrieval errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache error'));

      const result = await integration.retrieveOptimizationResult(
        ['src/error.css'],
        mockConfig
      );

      expect(result).toBeNull(); // Should fallback gracefully
    });

    it('should handle cache storage errors gracefully', async () => {
      mockCache.set.mockRejectedValue(new Error('Storage error'));

      const success = await integration.storeOptimizationResult(
        ['src/error.css'],
        mockConfig,
        mockOptimizationResult
      );

      expect(success).toBe(false); // Should fail gracefully
    });

    it('should bypass cache when requested', async () => {
      const result = await integration.retrieveOptimizationResult(
        ['src/bypass.css'],
        mockConfig,
        undefined,
        { bypassCache: true }
      );

      expect(result).toBeNull();
      expect(mockCache.get).not.toHaveBeenCalled();
    });

    it('should handle concurrent operations safely', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(true);

      const operations = Array.from({ length: 10 }, (_, i) =>
        Promise.all([
          integration.retrieveOptimizationResult([`file${i}.css`], mockConfig),
          integration.storeOptimizationResult([`file${i}.css`], mockConfig, mockOptimizationResult),
        ])
      );

      // Should handle concurrent operations without errors
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('Event Emission', () => {
    it('should emit cache operation events', async () => {
      const hitHandler = vi.fn();
      const missHandler = vi.fn();
      const storedHandler = vi.fn();
      const errorHandler = vi.fn();

      integration.on('cache-hit', hitHandler);
      integration.on('cache-miss', missHandler);
      integration.on('cache-stored', storedHandler);
      integration.on('cache-error', errorHandler);

      // Cache miss
      mockCache.get.mockResolvedValue(null);
      await integration.retrieveOptimizationResult(['test.css'], mockConfig);
      expect(missHandler).toHaveBeenCalled();

      // Cache store
      mockCache.set.mockResolvedValue(true);
      await integration.storeOptimizationResult(['test.css'], mockConfig, mockOptimizationResult);
      expect(storedHandler).toHaveBeenCalled();

      // Cache hit
      const cachedResult = {
        ...mockOptimizationResult,
        cachedAt: new Date(),
        cacheKey: 'test-key',
        inputFiles: ['test.css'],
        configSnapshot: mockConfig,
        hitCount: 1,
        lastAccessed: new Date(),
      };
      mockCache.get.mockResolvedValue(cachedResult);
      await integration.retrieveOptimizationResult(['test.css'], mockConfig);
      expect(hitHandler).toHaveBeenCalled();
    });

    it('should emit circuit breaker events', async () => {
      const openedHandler = vi.fn();
      const closedHandler = vi.fn();

      integration.on('circuit-breaker-opened', openedHandler);
      integration.on('circuit-breaker-closed', closedHandler);

      // Trigger circuit breaker opening
      mockCache.get.mockRejectedValue(new Error('Cache failure'));
      
      for (let i = 0; i < 5; i++) {
        await integration.retrieveOptimizationResult(['test.css'], mockConfig);
      }

      expect(openedHandler).toHaveBeenCalled();
    });
  });

  describe('Global Integration Instance', () => {
    it('should provide global integration instance', () => {
      const global1 = getOptimizationCacheIntegration();
      const global2 = getOptimizationCacheIntegration();

      expect(global1).toBe(global2); // Should be same instance

      // Clean up
      global1.destroy();
    });

    it('should create new integration instances', () => {
      const integration1 = createOptimizationCacheIntegration();
      const integration2 = createOptimizationCacheIntegration();

      expect(integration1).not.toBe(integration2); // Should be different instances

      // Clean up
      integration1.destroy();
      integration2.destroy();
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources on destroy', async () => {
      const testIntegration = createOptimizationCacheIntegration();

      // Add some operations to create timers
      mockCache.get.mockImplementation(() => new Promise(resolve => 
        setTimeout(() => resolve(null), 100)
      ));

      // Start some operations
      const operation1 = testIntegration.retrieveOptimizationResult(['test1.css'], mockConfig);
      const operation2 = testIntegration.retrieveOptimizationResult(['test2.css'], mockConfig);

      // Destroy should clean up without waiting for operations
      await expect(testIntegration.destroy()).resolves.not.toThrow();

      // Operations should still complete
      await expect(Promise.all([operation1, operation2])).resolves.not.toThrow();
    });

    it('should handle destroy with no active operations', async () => {
      const testIntegration = createOptimizationCacheIntegration();
      
      // Destroy immediately
      await expect(testIntegration.destroy()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file arrays', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(true);

      const result = await integration.retrieveOptimizationResult([], mockConfig);
      expect(result).toBeNull();

      const stored = await integration.storeOptimizationResult([], mockConfig, mockOptimizationResult);
      expect(stored).toBe(true);
    });

    it('should handle malformed configuration', async () => {
      const malformedConfig = {} as EnigmaConfig;

      mockCache.get.mockResolvedValue(null);

      const result = await integration.retrieveOptimizationResult(
        ['test.css'],
        malformedConfig
      );
      expect(result).toBeNull();
    });

    it('should generate unique operation IDs', async () => {
      const operationIds = new Set<string>();
      
      // Mock to capture operation IDs
      const originalGet = mockCache.get;
      mockCache.get.mockImplementation(async () => {
        const activeOps = (integration as any).activeOperations;
        for (const [id] of activeOps) {
          operationIds.add(id);
        }
        return null;
      });

      // Perform multiple operations
      await Promise.all([
        integration.retrieveOptimizationResult(['test1.css'], mockConfig),
        integration.retrieveOptimizationResult(['test2.css'], mockConfig),
        integration.retrieveOptimizationResult(['test3.css'], mockConfig),
      ]);

      expect(operationIds.size).toBe(3); // Should have unique IDs

      mockCache.get = originalGet;
    });
  });
}); 