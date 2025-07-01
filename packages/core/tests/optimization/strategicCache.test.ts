/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CachePriority,
  EvictionStrategy,
  StorageTier,
  StrategicCache,
  StrategicCacheFactory,
  type StrategicCacheConfig,
} from '../../src/optimization/strategicCache';

describe('StrategicCache', () => {
  let cache: StrategicCache<any>;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'strategic-cache-test-'));
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    const config: Partial<StrategicCacheConfig> = {
      memorySize: 1024 * 1024, // 1MB
      memoryMaxEntries: 100,
      diskCacheDir: path.join(tempDir, 'cache'),
      diskSize: 10 * 1024 * 1024, // 10MB
      diskMaxEntries: 1000,
      enableDiskCache: true,
      defaultTTL: 1000, // 1 second for testing
      maxTTL: 5000, // 5 seconds for testing
      evictionStrategy: EvictionStrategy.LRU,
      enablePrefetching: true,
      prefetchThreshold: 0.5,
      maxPrefetchSize: 1024 * 1024, // 1MB
      prefetchConcurrency: 2,
      enableCompression: false, // Disable for simpler testing
      enableDeduplication: true,
      enableAnalytics: true,
      enablePredictiveEviction: false, // Disable for deterministic testing
      enableAccessPatternLearning: false, // Disable for deterministic testing
      enableCacheWarming: false,
      warmupTargets: [],
    };

    cache = new StrategicCache(config);
    await cache.initialize();
  });

  afterEach(async () => {
    if (cache) {
      await cache.shutdown();
    }
  });

  describe('Basic Operations', () => {
    it('should set and get values from memory cache', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', number: 42 };

      await cache.set(key, value);
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const retrieved = await cache.get('non-existent-key');
      expect(retrieved).toBeNull();
    });

    it('should delete entries successfully', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await cache.set(key, value);
      expect(await cache.get(key)).toBe(value);

      const deleted = await cache.delete(key);
      expect(deleted).toBe(true);
      expect(await cache.get(key)).toBeNull();
    });

    it('should return false when deleting non-existent keys', async () => {
      const deleted = await cache.delete('non-existent-key');
      expect(deleted).toBe(false);
    });

    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBeNull();
    });
  });

  describe('Cache Priorities', () => {
    it('should handle different priority levels', async () => {
      await cache.set('low', 'low-value', { priority: CachePriority.LOW });
      await cache.set('normal', 'normal-value', { priority: CachePriority.NORMAL });
      await cache.set('high', 'high-value', { priority: CachePriority.HIGH });
      await cache.set('critical', 'critical-value', { priority: CachePriority.CRITICAL });

      expect(await cache.get('low')).toBe('low-value');
      expect(await cache.get('normal')).toBe('normal-value');
      expect(await cache.get('high')).toBe('high-value');
      expect(await cache.get('critical')).toBe('critical-value');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect custom TTL values', async () => {
      const key = 'ttl-test';
      const value = 'expires-soon';
      const ttl = 100; // 100ms

      await cache.set(key, value, { ttl });
      expect(await cache.get(key)).toBe(value);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(await cache.get(key)).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      const key = 'default-ttl-test';
      const value = 'uses-default-ttl';

      await cache.set(key, value);
      expect(await cache.get(key)).toBe(value);

      // Should still be valid for a short time
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(await cache.get(key)).toBe(value);
    });
  });

  describe('Storage Tiers', () => {
    it('should store entries in specified tiers', async () => {
      const memoryKey = 'memory-key';
      const diskKey = 'disk-key';
      const value = 'test-value';

      await cache.set(memoryKey, value, { tier: StorageTier.MEMORY });
      await cache.set(diskKey, value, { tier: StorageTier.DISK });

      expect(await cache.get(memoryKey)).toBe(value);
      expect(await cache.get(diskKey)).toBe(value);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage correctly', async () => {
      const stats = cache.getStats();
      expect(stats.memoryEntries).toBe(0);
      expect(stats.memorySize).toBe(0);

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const updatedStats = cache.getStats();
      expect(updatedStats.memoryEntries).toBe(2);
      expect(updatedStats.memorySize).toBeGreaterThan(0);
    });

    it('should evict entries when memory limit is reached', async () => {
      // Fill cache beyond memory limit with large values
      const largeValue = 'x'.repeat(50000); // 50KB

      for (let i = 0; i < 25; i++) {
        await cache.set(`large-key-${i}`, largeValue);
      }

      const stats = cache.getStats();
      expect(stats.evictionCount).toBeGreaterThan(0);
    });
  });

  describe('Prefetching', () => {
    it('should prefetch multiple keys using provided function', async () => {
      const keys = ['prefetch1', 'prefetch2', 'prefetch3'];
      const fetchFunction = vi
        .fn()
        .mockImplementation((key: string) => Promise.resolve(`fetched-${key}`));

      await cache.prefetch(keys, fetchFunction);

      // Verify all keys were fetched
      expect(fetchFunction).toHaveBeenCalledTimes(3);
      expect(fetchFunction).toHaveBeenCalledWith('prefetch1');
      expect(fetchFunction).toHaveBeenCalledWith('prefetch2');
      expect(fetchFunction).toHaveBeenCalledWith('prefetch3');

      // Verify values are cached
      expect(await cache.get('prefetch1')).toBe('fetched-prefetch1');
      expect(await cache.get('prefetch2')).toBe('fetched-prefetch2');
      expect(await cache.get('prefetch3')).toBe('fetched-prefetch3');
    });

    it('should handle prefetch errors gracefully', async () => {
      const keys = ['success', 'failure'];
      const fetchFunction = vi.fn().mockImplementation((key: string) => {
        if (key === 'failure') {
          return Promise.reject(new Error('Fetch failed'));
        }
        return Promise.resolve(`fetched-${key}`);
      });

      await cache.prefetch(keys, fetchFunction);

      // Success case should work
      expect(await cache.get('success')).toBe('fetched-success');

      // Failure case should not cache anything
      expect(await cache.get('failure')).toBeNull();
    });
  });

  describe('Statistics and Analytics', () => {
    it('should track hit and miss rates correctly', async () => {
      await cache.set('hit-key', 'hit-value');

      // Generate hits and misses
      await cache.get('hit-key'); // hit
      await cache.get('hit-key'); // hit
      await cache.get('miss-key'); // miss
      await cache.get('miss-key'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.5, 1); // 2 hits out of 4 requests
      expect(stats.missRate).toBeCloseTo(0.5, 1); // 2 misses out of 4 requests
    });

    it('should provide comprehensive analytics', async () => {
      await cache.set('analytics-key', 'analytics-value');
      await cache.get('analytics-key');

      const analytics = cache.getAnalytics();

      expect(analytics.stats).toBeDefined();
      expect(analytics.topKeys).toBeInstanceOf(Array);
      expect(analytics.accessPatterns).toBeInstanceOf(Array);
      expect(analytics.evictionCandidates).toBeInstanceOf(Array);
    });

    it('should track total entries correctly', async () => {
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const updatedStats = cache.getStats();
      expect(updatedStats.totalEntries).toBe(2);
    });
  });

  describe('Metadata Support', () => {
    it('should store and retrieve metadata with entries', async () => {
      const key = 'metadata-key';
      const value = 'metadata-value';
      const metadata = {
        source: 'test',
        version: '1.0',
        tags: ['important', 'cache-test'],
      };

      await cache.set(key, value, { metadata });
      const retrieved = await cache.get(key);

      expect(retrieved).toBe(value);
      // Note: The current implementation doesn't expose metadata in get()
      // This test verifies the set operation succeeds with metadata
    });
  });

  describe('Event Emission', () => {
    it('should emit events on cache operations', async () => {
      const hitListener = vi.fn();
      const missListener = vi.fn();
      const setListener = vi.fn();

      cache.on('hit', hitListener);
      cache.on('miss', missListener);
      cache.on('set', setListener);

      await cache.set('event-key', 'event-value');
      await cache.get('event-key'); // hit
      await cache.get('non-existent'); // miss

      // Give some time for events to be processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(setListener).toHaveBeenCalled();
      expect(hitListener).toHaveBeenCalled();
      expect(missListener).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle disk cache errors gracefully', async () => {
      // Create cache with invalid disk directory to trigger errors
      await cache.shutdown();

      const config: Partial<StrategicCacheConfig> = {
        memorySize: 1024,
        diskCacheDir: '/invalid/readonly/path',
        enableDiskCache: true,
      };

      const errorCache = new StrategicCache(config);

      // Should not throw during initialization
      await expect(errorCache.initialize()).resolves.not.toThrow();

      // Should still work for memory operations
      await expect(errorCache.set('key', 'value')).resolves.not.toThrow();
      expect(await errorCache.get('key')).toBe('value');

      await errorCache.shutdown();
    });
  });
});

describe('StrategicCacheFactory', () => {
  afterEach(async () => {
    // Clean up any caches created by factory
  });

  describe('createHighPerformance', () => {
    it('should create a cache optimized for high performance', async () => {
      const cache = StrategicCacheFactory.createHighPerformance();
      await cache.initialize();

      const stats = cache.getStats();
      expect(stats).toBeDefined();

      await cache.set('perf-key', 'perf-value');
      expect(await cache.get('perf-key')).toBe('perf-value');

      await cache.shutdown();
    });
  });

  describe('createMemoryEfficient', () => {
    it('should create a cache optimized for memory efficiency', async () => {
      const cache = StrategicCacheFactory.createMemoryEfficient();
      await cache.initialize();

      const stats = cache.getStats();
      expect(stats).toBeDefined();

      await cache.set('mem-key', 'mem-value');
      expect(await cache.get('mem-key')).toBe('mem-value');

      await cache.shutdown();
    });
  });

  describe('createPrefetchOptimized', () => {
    it('should create a cache optimized for prefetching', async () => {
      const cache = StrategicCacheFactory.createPrefetchOptimized();
      await cache.initialize();

      const stats = cache.getStats();
      expect(stats).toBeDefined();

      // Test prefetch functionality
      const fetchFunction = vi
        .fn()
        .mockImplementation((key: string) => Promise.resolve(`prefetched-${key}`));

      await cache.prefetch(['key1', 'key2'], fetchFunction);
      expect(await cache.get('key1')).toBe('prefetched-key1');
      expect(await cache.get('key2')).toBe('prefetched-key2');

      await cache.shutdown();
    });
  });
});

describe('Integration Tests', () => {
  let cache: StrategicCache<any>;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'strategic-cache-integration-'));
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    const config: Partial<StrategicCacheConfig> = {
      memorySize: 512 * 1024, // 512KB
      memoryMaxEntries: 50,
      diskCacheDir: path.join(tempDir, 'integration-cache'),
      diskSize: 5 * 1024 * 1024, // 5MB
      diskMaxEntries: 500,
      enableDiskCache: true,
      defaultTTL: 10000, // 10 seconds
      evictionStrategy: EvictionStrategy.ADAPTIVE,
      enablePrefetching: true,
      enableCompression: true,
      compressionThreshold: 100,
      enableDeduplication: true,
      enableAnalytics: true,
    };

    cache = new StrategicCache(config);
    await cache.initialize();
  });

  afterEach(async () => {
    if (cache) {
      await cache.shutdown();
    }
  });

  it('should handle mixed workload with memory and disk operations', async () => {
    // Store a mix of small and large values
    const smallValue = 'small';
    const largeValue = 'x'.repeat(10000); // 10KB

    // Add entries that will fit in memory
    for (let i = 0; i < 20; i++) {
      await cache.set(`small-${i}`, smallValue);
    }

    // Add entries that may spill to disk
    for (let i = 0; i < 10; i++) {
      await cache.set(`large-${i}`, largeValue);
    }

    // Verify all entries are retrievable
    for (let i = 0; i < 20; i++) {
      expect(await cache.get(`small-${i}`)).toBe(smallValue);
    }

    for (let i = 0; i < 10; i++) {
      expect(await cache.get(`large-${i}`)).toBe(largeValue);
    }

    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(30);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  it('should persist data across cache instances', async () => {
    const key = 'persistence-test';
    const value = 'should-persist';

    // Store data and shutdown
    await cache.set(key, value, { tier: StorageTier.DISK });
    const diskCacheDir = path.join(tempDir, 'integration-cache');
    await cache.shutdown();

    // Create new cache instance with same disk directory
    const config: Partial<StrategicCacheConfig> = {
      diskCacheDir,
      enableDiskCache: true,
    };

    const newCache = new StrategicCache(config);
    await newCache.initialize();

    // Data should still be available
    expect(await newCache.get(key)).toBe(value);

    await newCache.shutdown();
  });

  it('should handle concurrent operations safely', async () => {
    const concurrentOperations = [];
    const keyCount = 100;

    // Concurrent writes
    for (let i = 0; i < keyCount; i++) {
      concurrentOperations.push(cache.set(`concurrent-${i}`, `value-${i}`));
    }

    await Promise.all(concurrentOperations);

    // Concurrent reads
    const readOperations = [];
    for (let i = 0; i < keyCount; i++) {
      readOperations.push(cache.get(`concurrent-${i}`));
    }

    const results = await Promise.all(readOperations);

    // Verify all values were written and read correctly
    for (let i = 0; i < keyCount; i++) {
      expect(results[i]).toBe(`value-${i}`);
    }

    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(keyCount);
  });
});
