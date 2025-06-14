/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Intelligent Caching System for Tailwind Enigma Core
 *
 * Provides multi-tier caching with different strategies:
 * - LRU (Least Recently Used)
 * - LFU (Least Frequently Used)
 * - TTL (Time To Live)
 * - ARC (Adaptive Replacement Cache)
 *
 * Features:
 * - Memory-aware cache sizing
 * - Cache analytics and monitoring
 * - Optional persistence layer
 * - Configurable eviction policies
 * - Performance metrics collection
 */

import { EventEmitter } from "events";
import { promises as fs } from "fs";
import path from "path";
import { performance } from "perf_hooks";
import type {
  CacheConfig,
  // CacheStrategy - removed, not used
  // PerformanceMetrics - removed, not used
} from "./config";

/**
 * Cache entry with metadata
 */
interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  size: number;
  accessCount: number;
  lastAccessed: number;
  created: number;
  ttl?: number;
  compressed?: boolean;
}

/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  hitRate: number;
  averageAccessTime: number;
  memoryUsage: number;
}

/**
 * ARC (Adaptive Replacement Cache) specific structures
 */
interface ARCLists<T> {
  t1: Map<string, CacheEntry<T>>; // Recent cache misses
  t2: Map<string, CacheEntry<T>>; // Frequent items
  b1: Set<string>; // Ghost entries for t1
  b2: Set<string>; // Ghost entries for t2
  p: number; // Target size for t1
}

/**
 * Intelligent cache manager with multiple strategies and analytics
 */
export class CacheManager<T = unknown> extends EventEmitter {
  private readonly config: CacheConfig;
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly stats: CacheStats;
  private readonly arcLists?: ARCLists<T>;
  private persistenceTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private compressionEnabled: boolean;

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      maxSize: 100 * 1024 * 1024, // 100MB
      strategy: "lru",
      ttl: 3600000, // 1 hour
      persistence: false,
      compressionEnabled: false,
      memoryPressureThreshold: 0.8,
      ...config,
    };

    this.compressionEnabled = this.config.compressionEnabled;

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
    };

    // Initialize ARC-specific structures if using ARC strategy
    if (this.config.strategy === "arc") {
      this.arcLists = {
        t1: new Map(),
        t2: new Map(),
        b1: new Set(),
        b2: new Set(),
        p: 0,
      };
    }

    this.startPeriodicCleanup();

    if (this.config.persistence) {
      this.startPersistence();
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<T | undefined> {
    const startTime = performance.now();

    if (!this.config.enabled) {
      return undefined;
    }

    try {
      let entry = this.cache.get(key);

      if (!entry) {
        // Try loading from persistence if enabled
        if (this.config.persistence) {
          const persistedEntry = await this.loadFromPersistence(key);
          if (persistedEntry) {
            entry = persistedEntry;
            this.cache.set(key, entry);
          }
        }
      }

      if (entry) {
        // Check TTL expiration
        if (this.isExpired(entry)) {
          await this.delete(key);
          this.recordMiss(startTime);
          return undefined;
        }

        // Update access metadata
        this.updateAccessMetadata(entry);

        // Handle strategy-specific logic
        if (this.config.strategy === "arc" && this.arcLists) {
          this.arcOnHit(key, entry);
        }

        this.recordHit(startTime);
        this.emit("hit", key, entry.value);

        return entry.value;
      }

      this.recordMiss(startTime);
      this.emit("miss", key);
      return undefined;
    } catch (error) {
      this.emit("error", error);
      this.recordMiss(startTime);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: T,
    options: { ttl?: number; priority?: number } = {},
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const size = this.calculateSize(value);
      const now = Date.now();

      const entry: CacheEntry<T> = {
        key,
        value,
        size,
        accessCount: 1,
        lastAccessed: now,
        created: now,
        ttl: options.ttl || this.config.ttl,
        compressed: this.compressionEnabled,
      };

      // Check if we need to evict entries to make space
      await this.ensureSpace(size);

      // Handle strategy-specific insertion
      if (this.config.strategy === "arc" && this.arcLists) {
        this.arcOnInsert(key, entry);
      } else {
        this.cache.set(key, entry);
      }

      this.updateStats(entry, "add");
      this.emit("set", key, value, size);

      // Persist if enabled
      if (this.config.persistence) {
        await this.persistEntry(key, entry);
      }

      return true;
    } catch (error) {
      this.emit("error", error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (entry) {
      this.cache.delete(key);
      this.updateStats(entry, "remove");

      if (this.config.strategy === "arc" && this.arcLists) {
        this.arcOnDelete(key);
      }

      this.emit("delete", key);

      // Remove from persistence
      if (this.config.persistence) {
        await this.removeFromPersistence(key);
      }

      return true;
    }

    return false;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const entryCount = this.cache.size;
    this.cache.clear();

    if (this.arcLists) {
      this.arcLists.t1.clear();
      this.arcLists.t2.clear();
      this.arcLists.b1.clear();
      this.arcLists.b2.clear();
      this.arcLists.p = 0;
    }

    this.resetStats();
    this.emit("clear", entryCount);

    if (this.config.persistence) {
      await this.clearPersistence();
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { config: CacheConfig } {
    this.updateHitRate();
    return {
      ...this.stats,
      config: { ...this.config },
    };
  }

  /**
   * Get cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries
   */
  private async cleanup(): Promise<void> {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.emit("cleanup", expiredKeys.length);
    }
  }

  /**
   * Ensure there's enough space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    let iterations = 0;
    while (
      this.stats.totalSize + requiredSize > this.config.maxSize &&
      this.cache.size > 0
    ) {
      iterations++;
      if (iterations > 10) {
        console.error(
          "ensureSpace: Too many iterations, breaking to prevent infinite loop",
        );
        break;
      }

      const keyToEvict = this.selectEvictionCandidate();

      if (keyToEvict) {
        await this.evict(keyToEvict);
      } else {
        break;
      }
    }
  }

  /**
   * Select candidate for eviction based on strategy
   */
  private selectEvictionCandidate(): string | null {
    if (this.cache.size === 0) return null;

    switch (this.config.strategy) {
      case "lru":
        return this.selectLRUCandidate();
      case "lfu":
        return this.selectLFUCandidate();
      case "ttl":
        return this.selectTTLCandidate();
      case "arc":
        return this.selectARCCandidate();
      default:
        return this.selectLRUCandidate();
    }
  }

  /**
   * LRU eviction candidate selection
   */
  private selectLRUCandidate(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * LFU eviction candidate selection
   */
  private selectLFUCandidate(): string | null {
    let leastUsedKey: string | null = null;
    let leastCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < leastCount) {
        leastCount = entry.accessCount;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  /**
   * TTL eviction candidate selection
   */
  private selectTTLCandidate(): string | null {
    // First, find expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        return key;
      }
    }

    // If no expired entries, fall back to LRU
    return this.selectLRUCandidate();
  }

  /**
   * ARC eviction candidate selection
   */
  private selectARCCandidate(): string | null {
    if (!this.arcLists) return this.selectLRUCandidate();

    // ARC eviction logic - simplified version
    if (this.arcLists.t1.size > this.arcLists.p) {
      // Evict from t1
      const keys = Array.from(this.arcLists.t1.keys());
      return keys[0] || null;
    } else {
      // Evict from t2
      const keys = Array.from(this.arcLists.t2.keys());
      return keys[0] || null;
    }
  }

  /**
   * Evict entry from cache
   */
  private async evict(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      await this.delete(key);
      this.stats.evictions++;
      this.emit("evict", key, "space");
    }
  }

  /**
   * ARC strategy: handle cache hit
   */
  private arcOnHit(key: string, entry: CacheEntry<T>): void {
    if (!this.arcLists) return;

    if (this.arcLists.t1.has(key)) {
      // Move from t1 to t2
      this.arcLists.t1.delete(key);
      this.arcLists.t2.set(key, entry);
    }
    // If in t2, just update access time (already done)
  }

  /**
   * ARC strategy: handle cache insertion
   */
  private arcOnInsert(key: string, entry: CacheEntry<T>): void {
    if (!this.arcLists) return;

    if (this.arcLists.b1.has(key)) {
      // Recently evicted from t1, increase p
      this.arcLists.p = Math.min(this.arcLists.p + 1, this.config.maxSize);
      this.arcLists.b1.delete(key);
      this.arcLists.t2.set(key, entry);
    } else if (this.arcLists.b2.has(key)) {
      // Recently evicted from t2, decrease p
      this.arcLists.p = Math.max(this.arcLists.p - 1, 0);
      this.arcLists.b2.delete(key);
      this.arcLists.t2.set(key, entry);
    } else {
      // New entry, add to t1
      this.arcLists.t1.set(key, entry);
    }

    this.cache.set(key, entry);
  }

  /**
   * ARC strategy: handle deletion
   */
  private arcOnDelete(key: string): void {
    if (!this.arcLists) return;

    if (this.arcLists.t1.has(key)) {
      this.arcLists.t1.delete(key);
      this.arcLists.b1.add(key);
    } else if (this.arcLists.t2.has(key)) {
      this.arcLists.t2.delete(key);
      this.arcLists.b2.add(key);
    }
  }

  /**
   * Update access metadata for entry
   */
  private updateAccessMetadata(entry: CacheEntry<T>): void {
    entry.lastAccessed = Date.now();
    entry.accessCount++;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.ttl) return false;
    return Date.now() > entry.created + entry.ttl;
  }

  /**
   * Calculate size of value for memory management
   */
  private calculateSize(value: T): number {
    if (value === null || value === undefined) return 0;

    try {
      const json = JSON.stringify(value);
      return Buffer.byteLength(json, "utf8");
    } catch {
      // Fallback for circular references or non-serializable objects
      return 1024; // Estimate 1KB for complex objects
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(entry: CacheEntry<T>, operation: "add" | "remove"): void {
    if (operation === "add") {
      this.stats.totalSize += entry.size;
      this.stats.entryCount++;
    } else {
      this.stats.totalSize -= entry.size;
      this.stats.entryCount--;
    }

    this.stats.memoryUsage = (this.stats.totalSize / this.config.maxSize) * 100;
  }

  /**
   * Record cache hit
   */
  private recordHit(startTime: number): void {
    this.stats.hits++;
    this.updateAverageAccessTime(startTime);
  }

  /**
   * Record cache miss
   */
  private recordMiss(startTime: number): void {
    this.stats.misses++;
    this.updateAverageAccessTime(startTime);
  }

  /**
   * Update average access time
   */
  private updateAverageAccessTime(startTime: number): void {
    const accessTime = performance.now() - startTime;
    const totalAccesses = this.stats.hits + this.stats.misses;

    if (totalAccesses === 1) {
      this.stats.averageAccessTime = accessTime;
    } else {
      this.stats.averageAccessTime =
        (this.stats.averageAccessTime * (totalAccesses - 1) + accessTime) /
        totalAccesses;
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const totalAccesses = this.stats.hits + this.stats.misses;
    this.stats.hitRate =
      totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    Object.assign(this.stats, {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
    });
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startPeriodicCleanup(): void {
    const interval = this.config.cleanupInterval || 60000; // Default to 1 minute
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error) => this.emit("error", error));
    }, interval);
  }

  /**
   * Start persistence operations
   */
  private startPersistence(): void {
    if (!this.config.persistencePath) return;

    this.persistenceTimer = setInterval(() => {
      this.persistAll().catch((error) => this.emit("error", error));
    }, 30000); // Persist every 30 seconds
  }

  /**
   * Load entry from persistent storage
   */
  private async loadFromPersistence(
    key: string,
  ): Promise<CacheEntry<T> | null> {
    if (!this.config.persistencePath) return null;

    try {
      const filePath = path.join(this.config.persistencePath, `${key}.json`);
      const data = await fs.readFile(filePath, "utf8");
      const entry = JSON.parse(data) as CacheEntry<T>;

      // Check if entry is still valid
      if (this.isExpired(entry)) {
        await this.removeFromPersistence(key);
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Persist single entry
   */
  private async persistEntry(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.config.persistencePath) return;

    try {
      const filePath = path.join(this.config.persistencePath, `${key}.json`);
      await fs.mkdir(this.config.persistencePath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(entry), "utf8");
    } catch (error) {
      this.emit("error", error);
    }
  }

  /**
   * Persist all entries
   */
  private async persistAll(): Promise<void> {
    const promises = Array.from(this.cache.entries()).map(([key, entry]) =>
      this.persistEntry(key, entry),
    );
    await Promise.allSettled(promises);
  }

  /**
   * Remove entry from persistent storage
   */
  private async removeFromPersistence(key: string): Promise<void> {
    if (!this.config.persistencePath) return;

    try {
      const filePath = path.join(this.config.persistencePath, `${key}.json`);
      await fs.unlink(filePath);
    } catch {
      // File might not exist, ignore error
    }
  }

  /**
   * Clear persistent storage
   */
  private async clearPersistence(): Promise<void> {
    if (!this.config.persistencePath) return;

    try {
      const files = await fs.readdir(this.config.persistencePath);
      const promises = files
        .filter((file) => file.endsWith(".json"))
        .map((file) =>
          fs.unlink(path.join(this.config.persistencePath!, file)),
        );
      await Promise.allSettled(promises);
    } catch (error) {
      this.emit("error", error);
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }

    if (this.config.persistence) {
      await this.persistAll();
    }

    this.removeAllListeners();
  }
}

/**
 * Factory function to create cache manager with validation
 */
export function createCacheManager<T = unknown>(
  config: Partial<CacheConfig> = {},
): CacheManager<T> {
  return new CacheManager<T>(config);
}

/**
 * Global cache manager instance
 */
let globalCacheManager: CacheManager | null = null;

/**
 * Get or create global cache manager instance
 */
export function getGlobalCacheManager<T = unknown>(
  config?: Partial<CacheConfig>,
): CacheManager<T> {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager<T>(config);
  }
  return globalCacheManager as CacheManager<T>;
}
