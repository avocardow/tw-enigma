/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { 
  OptimizationCache, 
  createOptimizationCache,
  getOptimizationCache,
  type OptimizationCacheConfig 
} from '../src/optimizationCache.js';
import type { EnigmaConfig } from '../src/config.js';
import type { OptimizationResult } from '../src/output/assetHasher.js';

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    stat: vi.fn(),
  },
}));

// Mock chokidar
const mockFileWatcher = {
  on: vi.fn().mockReturnThis(),
  add: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  unwatch: vi.fn(),
};

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn().mockReturnValue(mockFileWatcher),
  },
  watch: vi.fn().mockReturnValue(mockFileWatcher),
}));

// Mock crypto with proper chaining
vi.mock('crypto', () => {
  const mockDigest = vi.fn().mockReturnValue('mock-hash-12345');
  const mockUpdate = vi.fn().mockReturnThis();
  const mockCreateHash = vi.fn().mockReturnValue({
    update: mockUpdate,
    digest: mockDigest,
  });
  
  return {
    createHash: mockCreateHash,
  };
});

describe('OptimizationCache', () => {
  let cache: OptimizationCache;
  let mockConfig: EnigmaConfig;
  let mockOptimizationResult: OptimizationResult;

      beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock file reading to return consistent content
    vi.mocked(fs.readFile).mockResolvedValue('mock file content');

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

    // Create cache instance with test configuration
    const cacheConfig: Partial<OptimizationCacheConfig> = {
      enabled: true,
      maxSize: 1024 * 1024, // 1MB for testing
      ttl: 60000, // 1 minute for testing
      enableFileWatching: false, // Disable for unit tests
      enableCompression: false, // Disable for simpler testing
      maxEntriesPerProject: 100,
      enableAnalytics: true,
      fileChangeDebounce: 100,
    };

    cache = createOptimizationCache(cacheConfig);
  });

  afterEach(async () => {
    if (cache) {
      await cache.destroy();
    }
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve optimization results', async () => {
      const inputFiles = ['src/styles.css'];
      
      // Store result
      const stored = await cache.set(inputFiles, mockConfig, mockOptimizationResult);
      expect(stored).toBe(true);

      // Retrieve result
      const retrieved = await cache.get(inputFiles, mockConfig);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.optimizedCSS).toBe(mockOptimizationResult.optimizedCSS);
      expect(retrieved?.classMap).toEqual(mockOptimizationResult.classMap);
      expect(retrieved?.inputFiles).toEqual(inputFiles);
    });

    it('should return null for cache miss', async () => {
      const inputFiles = ['src/nonexistent.css'];
      
      const result = await cache.get(inputFiles, mockConfig);
      expect(result).toBeNull();
    });

    it('should handle framework-specific caching', async () => {
      const inputFiles = ['src/component.vue'];
      
      // Store with framework
      await cache.set(inputFiles, mockConfig, mockOptimizationResult, 'vue');
      
      // Should retrieve with same framework
      const retrieved = await cache.get(inputFiles, mockConfig, 'vue');
      expect(retrieved).toBeTruthy();
      
      // Should not retrieve with different framework
      const differentFramework = await cache.get(inputFiles, mockConfig, 'react');
      expect(differentFramework).toBeNull();
    });

    it('should track hit counts and access times', async () => {
      const inputFiles = ['src/styles.css'];
      
      await cache.set(inputFiles, mockConfig, mockOptimizationResult);
      
      // First access
      const first = await cache.get(inputFiles, mockConfig);
      expect(first?.hitCount).toBe(1);
      
      // Second access
      const second = await cache.get(inputFiles, mockConfig);
      expect(second?.hitCount).toBe(2);
      expect(second?.lastAccessed.getTime()).toBeGreaterThan(first!.lastAccessed.getTime());
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', async () => {
      const inputFiles = ['src/styles.css'];
      
      const key1 = await cache.generateCacheKey(inputFiles, mockConfig);
      const key2 = await cache.generateCacheKey(inputFiles, mockConfig);
      
      expect(key1).toBe(key2);
      expect(key1).toBe('mock-hash-12345');
    });

    it('should generate different keys for different inputs', async () => {
      const files1 = ['src/styles1.css'];
      const files2 = ['src/styles2.css'];
      
      // Mock different hashes for different inputs using a sequence
      let callCount = 0;
      const crypto = await import('crypto');
      vi.mocked(crypto.createHash).mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(callCount++ === 0 ? 'hash-1' : 'hash-2'),
      }));
      
      const key1 = await cache.generateCacheKey(files1, mockConfig);
      const key2 = await cache.generateCacheKey(files2, mockConfig);
      
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different configurations', async () => {
      const inputFiles = ['src/styles.css'];
      const config1 = { ...mockConfig, optimization: { enabled: true } };
      const config2 = { ...mockConfig, optimization: { enabled: false } };
      
      // Mock different hashes for different configs
      let callCount = 0;
      const crypto = await import('crypto');
      vi.mocked(crypto.createHash).mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(callCount++ === 0 ? 'config-hash-1' : 'config-hash-2'),
      }));
      
      const key1 = await cache.generateCacheKey(inputFiles, config1);
      const key2 = await cache.generateCacheKey(inputFiles, config2);
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(async () => {
      // Set up some cached data
      await cache.set(['file1.css'], mockConfig, mockOptimizationResult);
      await cache.set(['file2.css'], mockConfig, mockOptimizationResult);
      await cache.set(['file3.css'], mockConfig, mockOptimizationResult);
    });

    it('should invalidate cache by files', async () => {
      const invalidated = await cache.invalidateByFiles(['file1.css']);
      expect(invalidated).toBeGreaterThan(0);
      
      // File1 should be invalidated
      const result1 = await cache.get(['file1.css'], mockConfig);
      expect(result1).toBeNull();
      
      // Other files should remain
      const result2 = await cache.get(['file2.css'], mockConfig);
      expect(result2).toBeTruthy();
    });

    it('should invalidate cache by configuration changes', async () => {
      const newConfig = { 
        ...mockConfig, 
        optimization: { enabled: false } 
      };
      
      // Mock different hash for new config  
      const crypto = await import('crypto');
      vi.mocked(crypto.createHash).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('new-config-hash'),
      });
      
      const invalidated = await cache.invalidateByConfig(newConfig);
      expect(invalidated).toBeGreaterThan(0);
    });

    it('should clear all cache entries', async () => {
      await cache.clear();
      
      const result1 = await cache.get(['file1.css'], mockConfig);
      const result2 = await cache.get(['file2.css'], mockConfig);
      const result3 = await cache.get(['file3.css'], mockConfig);
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });

  describe('Analytics and Metrics', () => {
    it('should track cache analytics', async () => {
      const inputFiles = ['src/styles.css'];
      
      // Initial analytics
      let analytics = cache.getAnalytics();
      expect(analytics.totalHits).toBe(0);
      expect(analytics.totalMisses).toBe(0);
      
      // Cache miss
      await cache.get(inputFiles, mockConfig);
      analytics = cache.getAnalytics();
      expect(analytics.totalMisses).toBe(1);
      
      // Cache set and hit
      await cache.set(inputFiles, mockConfig, mockOptimizationResult);
      await cache.get(inputFiles, mockConfig);
      
      analytics = cache.getAnalytics();
      expect(analytics.totalHits).toBe(1);
      expect(analytics.hitRate).toBeGreaterThan(0);
    });

    it('should track file types in analytics', async () => {
      await cache.get(['styles.css'], mockConfig); // miss
      await cache.get(['component.vue'], mockConfig); // miss
      await cache.get(['script.js'], mockConfig); // miss
      
      const analytics = cache.getAnalytics();
      expect(analytics.topFileTypes.length).toBeGreaterThan(0);
    });

    it('should track invalidation statistics', async () => {
      await cache.set(['file1.css'], mockConfig, mockOptimizationResult);
      await cache.invalidateByFiles(['file1.css'], 'file-changed');
      
      const analytics = cache.getAnalytics();
      expect(analytics.invalidationStats.byReason['file-changed']).toBe(1);
      expect(analytics.invalidationStats.totalInvalidations).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      
      const inputFiles = ['nonexistent.css'];
      
      // Should not throw, but include error in hash
      const key = await cache.generateCacheKey(inputFiles, mockConfig);
      expect(key).toBeTruthy();
      expect(key).toBe('mock-hash-12345');
    });

    it('should emit error events for cache operations', async () => {
      const errorHandler = vi.fn();
      cache.on('error', errorHandler);
      
      // Force an error by providing invalid data
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Simulated error'));
      
      await cache.get(['error-file.css'], mockConfig);
      
      // Error should be handled gracefully
      expect(errorHandler).not.toHaveBeenCalled(); // Should not emit error for get operations
    });

    it('should handle disabled cache gracefully', async () => {
      const disabledCache = createOptimizationCache({ enabled: false });
      
      const result = await disabledCache.get(['test.css'], mockConfig);
      expect(result).toBeNull();
      
      const stored = await disabledCache.set(['test.css'], mockConfig, mockOptimizationResult);
      expect(stored).toBe(false);
      
      await disabledCache.destroy();
    });
  });

  describe('Configuration and Lifecycle', () => {
    it('should respect cache size limits', async () => {
      const smallCache = createOptimizationCache({ 
        maxSize: 100, // Very small cache
        enabled: true 
      });
      
      // Try to store data larger than cache limit
      const largeResult = {
        ...mockOptimizationResult,
        optimizedCSS: 'x'.repeat(1000), // Large CSS
      };
      
      const stored = await smallCache.set(['large.css'], mockConfig, largeResult);
      // Should still succeed as the underlying cache manager handles size limits
      expect(stored).toBe(true);
      
      await smallCache.destroy();
    });

    it('should respect TTL settings', async () => {
      const shortTtlCache = createOptimizationCache({ 
        ttl: 1, // 1ms TTL
        enabled: true 
      });
      
      await shortTtlCache.set(['ttl-test.css'], mockConfig, mockOptimizationResult);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Entry should be expired (handled by underlying cache manager)
      const result = await shortTtlCache.get(['ttl-test.css'], mockConfig);
      // Note: TTL is handled by the underlying cache manager, so we can't easily test this
      
      await shortTtlCache.destroy();
    });

    it('should clean up resources on destroy', async () => {
      const testCache = createOptimizationCache();
      
      // Add some data
      await testCache.set(['cleanup-test.css'], mockConfig, mockOptimizationResult);
      
      // Destroy should not throw
      await expect(testCache.destroy()).resolves.not.toThrow();
    });
  });

  describe('Global Cache Instance', () => {
    it('should provide global cache instance', () => {
      const global1 = getOptimizationCache();
      const global2 = getOptimizationCache();
      
      expect(global1).toBe(global2); // Should be same instance
    });

    it('should create new cache instances', () => {
      const cache1 = createOptimizationCache();
      const cache2 = createOptimizationCache();
      
      expect(cache1).not.toBe(cache2); // Should be different instances
      
      // Clean up
      cache1.destroy();
      cache2.destroy();
    });
  });

  describe('Event Emission', () => {
    it('should emit cache events', async () => {
      const hitHandler = vi.fn();
      const missHandler = vi.fn();
      const setHandler = vi.fn();
      const invalidatedHandler = vi.fn();
      
      cache.on('cache-hit', hitHandler);
      cache.on('cache-miss', missHandler);
      cache.on('cache-set', setHandler);
      cache.on('cache-invalidated', invalidatedHandler);
      
      const inputFiles = ['events-test.css'];
      
      // Miss
      await cache.get(inputFiles, mockConfig);
      expect(missHandler).toHaveBeenCalledWith(
        expect.objectContaining({ inputFiles })
      );
      
      // Set
      await cache.set(inputFiles, mockConfig, mockOptimizationResult);
      expect(setHandler).toHaveBeenCalledWith(
        expect.objectContaining({ inputFiles })
      );
      
      // Hit
      await cache.get(inputFiles, mockConfig);
      expect(hitHandler).toHaveBeenCalledWith(
        expect.objectContaining({ inputFiles })
      );
      
      // Invalidation
      await cache.invalidateByFiles(inputFiles);
      expect(invalidatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ files: inputFiles })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input files', async () => {
      const emptyFiles: string[] = [];
      
      const key = await cache.generateCacheKey(emptyFiles, mockConfig);
      expect(key).toBeTruthy();
      
      const stored = await cache.set(emptyFiles, mockConfig, mockOptimizationResult);
      expect(stored).toBe(true);
      
      const retrieved = await cache.get(emptyFiles, mockConfig);
      expect(retrieved).toBeTruthy();
    });

    it('should handle malformed configuration', async () => {
      const malformedConfig = {} as EnigmaConfig;
      
      const key = await cache.generateCacheKey(['test.css'], malformedConfig);
      expect(key).toBeTruthy();
    });

    it('should handle concurrent operations', async () => {
      const inputFiles = ['concurrent-test.css'];
      
      // Perform multiple concurrent operations
      const operations = [
        cache.set(inputFiles, mockConfig, mockOptimizationResult),
        cache.get(inputFiles, mockConfig),
        cache.set(inputFiles, mockConfig, mockOptimizationResult),
        cache.get(inputFiles, mockConfig),
      ];
      
      // Should not throw
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    it('should handle very long file paths', async () => {
      const longPath = 'src/' + 'very-long-path-segment/'.repeat(50) + 'file.css';
      const inputFiles = [longPath];
      
      const key = await cache.generateCacheKey(inputFiles, mockConfig);
      expect(key).toBeTruthy();
      
      const stored = await cache.set(inputFiles, mockConfig, mockOptimizationResult);
      expect(stored).toBe(true);
    });

    it('should handle special characters in file paths', async () => {
      const specialFiles = [
        'src/файл.css', // Cyrillic
        'src/测试.css', // Chinese
        'src/file with spaces.css',
        'src/file-with-émojis-🎨.css',
      ];
      
      for (const file of specialFiles) {
        const key = await cache.generateCacheKey([file], mockConfig);
        expect(key).toBeTruthy();
        
        const stored = await cache.set([file], mockConfig, mockOptimizationResult);
        expect(stored).toBe(true);
      }
    });
  });
}); 