import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CacheManager,
  createCacheManager,
  getGlobalCacheManager,
} from "../../src/performance/cacheManager.ts";
import type { CacheConfig } from "../../src/performance/config.ts";

describe("CacheManager", () => {
  let cacheManager: CacheManager;
  const mockConfig: CacheConfig = {
    maxSize: 1024 * 1024, // 1MB
    strategy: "lru",
    ttl: 5000,
    cleanupInterval: 1000,
    compressionEnabled: false,
  };

  beforeEach(() => {
    cacheManager = new CacheManager(mockConfig);
  });

  afterEach(() => {
    cacheManager.clear();
  });

  describe("Basic Operations", () => {
    it("should set and get values", async () => {
      await cacheManager.set("key1", "value1");
      const value = await cacheManager.get("key1");
      expect(value).toBe("value1");
    });

    it("should return undefined for non-existent keys", async () => {
      const value = await cacheManager.get("nonexistent");
      expect(value).toBeUndefined();
    });

    it("should delete values", async () => {
      await cacheManager.set("key1", "value1");
      await cacheManager.delete("key1");
      const value = await cacheManager.get("key1");
      expect(value).toBeUndefined();
    });

    it("should check if key exists", async () => {
      await cacheManager.set("key1", "value1");
      expect(await cacheManager.has("key1")).toBe(true);
      expect(await cacheManager.has("nonexistent")).toBe(false);
    });

    it("should clear all values", async () => {
      await cacheManager.set("key1", "value1");
      await cacheManager.set("key2", "value2");
      cacheManager.clear();

      expect(await cacheManager.get("key1")).toBeUndefined();
      expect(await cacheManager.get("key2")).toBeUndefined();
    });

    it("should return correct size", async () => {
      await cacheManager.set("key1", "value1");
      await cacheManager.set("key2", "value2");
      expect(cacheManager.size()).toBe(2);
    });
  });

  describe("LRU Strategy", () => {
    beforeEach(() => {
      cacheManager = new CacheManager({
        ...mockConfig,
        strategy: "lru",
        maxSize: 50, // Small size to test eviction
      });
    });

    it("should evict least recently used items when size limit exceeded", async () => {
      // Fill cache to capacity
      await cacheManager.set("key1", "a".repeat(20));
      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      await cacheManager.set("key2", "b".repeat(20));

      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      // Access key1 to make it more recent
      await cacheManager.get("key1");

      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      // Add new item that should evict key2 (least recently used)
      await cacheManager.set("key3", "c".repeat(20));

      expect(await cacheManager.get("key1")).toBe("a".repeat(20));
      expect(await cacheManager.get("key2")).toBeUndefined();
      expect(await cacheManager.get("key3")).toBe("c".repeat(20));
    });

    it("should update access order on get", async () => {
      await cacheManager.set("key1", "a".repeat(15)); // 17 bytes
      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      await cacheManager.set("key2", "b".repeat(15)); // 17 bytes

      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      // Access key1 to make it most recent
      await cacheManager.get("key1");

      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      // Add item that should evict key2 (total: 17+17+17=51 > 50)
      await cacheManager.set("key3", "c".repeat(15)); // 17 bytes

      expect(await cacheManager.get("key1")).toBe("a".repeat(15));
      expect(await cacheManager.get("key2")).toBeUndefined();
    });
  });

  describe("LFU Strategy", () => {
    beforeEach(() => {
      cacheManager = new CacheManager({
        ...mockConfig,
        strategy: "lfu",
        maxSize: 50,
      });
    });

    it("should evict least frequently used items", async () => {
      await cacheManager.set("key1", "a".repeat(15));
      await cacheManager.set("key2", "b".repeat(15));

      // Access key1 multiple times to increase frequency
      await cacheManager.get("key1");
      await cacheManager.get("key1");
      await cacheManager.get("key2"); // Only once

      // Add new item that should evict key2 (less frequent)
      await cacheManager.set("key3", "c".repeat(15));

      expect(await cacheManager.get("key1")).toBe("a".repeat(15));
      expect(await cacheManager.get("key2")).toBeUndefined();
      expect(await cacheManager.get("key3")).toBe("c".repeat(15));
    });
  });

  describe("TTL Strategy", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      cacheManager = new CacheManager({
        ...mockConfig,
        strategy: "ttl",
        ttl: 1000, // 1 second
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should expire items after TTL", async () => {
      await cacheManager.set("key1", "value1");
      expect(await cacheManager.get("key1")).toBe("value1");

      // Fast forward past TTL
      vi.advanceTimersByTime(1001);

      expect(await cacheManager.get("key1")).toBeUndefined();
    });

    it("should not expire items before TTL", async () => {
      await cacheManager.set("key1", "value1");

      // Fast forward but not past TTL
      vi.advanceTimersByTime(500);

      expect(await cacheManager.get("key1")).toBe("value1");
    });
  });

  describe("ARC Strategy", () => {
    beforeEach(() => {
      cacheManager = new CacheManager({
        ...mockConfig,
        strategy: "arc",
        maxSize: 70, // Reduced to ensure eviction
      });
    });

    it("should balance between recency and frequency", async () => {
      // Add items to fill cache (each is ~22 bytes)
      await cacheManager.set("key1", "a".repeat(20)); // 22 bytes
      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      await cacheManager.set("key2", "b".repeat(20)); // 22 bytes
      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      await cacheManager.set("key3", "c".repeat(20)); // 22 bytes (total: 66 bytes)

      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      // Access patterns
      await cacheManager.get("key1"); // Make key1 recent
      await cacheManager.get("key2"); // Make key2 recent
      await cacheManager.get("key1"); // Make key1 frequent

      await new Promise((resolve) => setTimeout(resolve, 5)); // Ensure different timestamp
      // Add new item that forces eviction (66 + 22 = 88 > 70)
      await cacheManager.set("key4", "d".repeat(20));

      // key3 should be evicted (neither recent nor frequent)
      expect(await cacheManager.get("key3")).toBeUndefined();
      expect(await cacheManager.get("key1")).toBe("a".repeat(20));
      expect(await cacheManager.get("key2")).toBe("b".repeat(20));
      expect(await cacheManager.get("key4")).toBe("d".repeat(20));
    });
  });

  describe("Memory Management", () => {
    it("should calculate size correctly for strings", async () => {
      await cacheManager.set("key1", "test");
      const stats = cacheManager.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it("should calculate size correctly for objects", async () => {
      const obj = { name: "test", value: 123, nested: { data: "nested" } };
      await cacheManager.set("key1", obj);
      const stats = cacheManager.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it("should not exceed memory limit", async () => {
      const smallCache = new CacheManager({
        ...mockConfig,
        maxSize: 100,
        strategy: "lru",
      });

      // Try to add more data than the limit
      await smallCache.set("key1", "a".repeat(50));
      await smallCache.set("key2", "b".repeat(50));
      await smallCache.set("key3", "c".repeat(50));

      const stats = smallCache.getStats();
      expect(stats.memoryUsage).toBeLessThanOrEqual(100);
    });
  });

  describe("Performance Metrics", () => {
    it("should track hit and miss rates", async () => {
      await cacheManager.set("key1", "value1");

      // Hits
      await cacheManager.get("key1");
      await cacheManager.get("key1");

      // Misses
      await cacheManager.get("nonexistent");
      await cacheManager.get("missing");

      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it("should track eviction count", async () => {
      const smallCache = new CacheManager({
        ...mockConfig,
        maxSize: 50,
        strategy: "lru",
      });

      await smallCache.set("key1", "a".repeat(30));
      await smallCache.set("key2", "b".repeat(30)); // Should evict key1

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe("Cleanup and Maintenance", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should run periodic cleanup for TTL strategy", async () => {
      const ttlCache = new CacheManager({
        ...mockConfig,
        strategy: "ttl",
        ttl: 1000,
        cleanupInterval: 500,
      });

      await ttlCache.set("key1", "value1");

      // Fast forward past TTL but before cleanup
      vi.advanceTimersByTime(1001);
      expect(ttlCache.size()).toBe(1); // Still there, cleanup hasn't run

      // Fast forward to trigger cleanup
      vi.advanceTimersByTime(500);
      expect(ttlCache.size()).toBe(0); // Should be cleaned up
    });
  });

  describe("Global Cache Manager", () => {
    it("should return singleton instance", () => {
      const instance1 = getGlobalCacheManager();
      const instance2 = getGlobalCacheManager();
      expect(instance1).toBe(instance2);
    });

    it("should create cache manager with factory", () => {
      const cache = createCacheManager({
        strategy: "lru",
        maxSize: 1024,
      });
      expect(cache).toBeInstanceOf(CacheManager);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null and undefined values", async () => {
      await cacheManager.set("null", null);
      await cacheManager.set("undefined", undefined);

      expect(await cacheManager.get("null")).toBe(null);
      expect(await cacheManager.get("undefined")).toBe(undefined);
    });

    it("should handle empty strings", async () => {
      await cacheManager.set("empty", "");
      expect(await cacheManager.get("empty")).toBe("");
    });

    it("should handle complex objects", async () => {
      const complexObj = {
        array: [1, 2, 3],
        nested: { deep: { value: "test" } },
        func: () => "not serialized",
        date: new Date(),
        regex: /test/g,
      };

      await cacheManager.set("complex", complexObj);
      const retrieved = await cacheManager.get("complex");

      expect(retrieved).toEqual(
        expect.objectContaining({
          array: [1, 2, 3],
          nested: { deep: { value: "test" } },
        }),
      );
    });
  });
});
