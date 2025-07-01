import { Logger } from '../utils/logger';
import { EnigmaConfig } from './config';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface ConfigCacheOptions {
  enabled?: boolean;
  ttl?: number;
  maxSize?: number;
  cleanupInterval?: number;
}

/**
 * Configuration cache with TTL support and automatic cleanup
 */
export class ConfigCache {
  private cache: Map<string, CacheEntry<EnigmaConfig>> = new Map();
  private logger: Logger;
  private options: Required<ConfigCacheOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: ConfigCacheOptions = {}) {
    this.logger = new Logger({ component: 'ConfigCache' });
    this.options = {
      enabled: options.enabled ?? true,
      ttl: options.ttl ?? 5 * 60 * 1000, // 5 minutes
      maxSize: options.maxSize ?? 100,
      cleanupInterval: options.cleanupInterval ?? 60 * 1000, // 1 minute
    };

    if (this.options.enabled && this.options.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Get configuration from cache
   */
  async get(key: string): Promise<EnigmaConfig | null> {
    if (!this.options.enabled) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      this.logger.debug('Cache miss', { key });
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.logger.debug('Cache entry expired', { key, age: now - entry.timestamp });
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    this.logger.debug('Cache hit', { key, accessCount: entry.accessCount });
    return structuredClone(entry.value);
  }

  /**
   * Set configuration in cache
   */
  async set(key: string, value: EnigmaConfig, customTtl?: number): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const now = Date.now();
    const ttl = customTtl ?? this.options.ttl;

    // Check if we need to make space
    if (this.cache.size >= this.options.maxSize) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry<EnigmaConfig> = {
      value: structuredClone(value),
      timestamp: now,
      ttl,
      accessCount: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
    this.logger.debug('Cache set', { key, ttl, cacheSize: this.cache.size });
  }

  /**
   * Check if a key exists in cache and is valid
   */
  has(key: string): boolean {
    if (!this.options.enabled) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    if (!this.options.enabled) {
      return false;
    }

    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug('Cache entry deleted', { key });
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info('Cache cleared', { previousSize: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    enabled: boolean;
    totalAccessCount: number;
    averageAccessCount: number;
    oldestEntry?: { key: string; age: number };
    newestEntry?: { key: string; age: number };
  } {
    const now = Date.now();
    let totalAccessCount = 0;
    let oldestTimestamp = now;
    let newestTimestamp = 0;
    let oldestKey = '';
    let newestKey = '';

    for (const [key, entry] of this.cache) {
      totalAccessCount += entry.accessCount;

      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }

      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
        newestKey = key;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      enabled: this.options.enabled,
      totalAccessCount,
      averageAccessCount: this.cache.size > 0 ? totalAccessCount / this.cache.size : 0,
      oldestEntry: oldestKey ? { key: oldestKey, age: now - oldestTimestamp } : undefined,
      newestEntry: newestKey ? { key: newestKey, age: now - newestTimestamp } : undefined,
    };
  }

  /**
   * Evict expired entries
   */
  private cleanupExpired(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug('Cleaned up expired entries', {
        removedCount,
        remainingSize: this.cache.size,
      });
    }

    return removedCount;
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastUsed(): void {
    if (this.cache.size === 0) {
      return;
    }

    let lruKey = '';
    let lruScore = Infinity;

    const now = Date.now();

    for (const [key, entry] of this.cache) {
      // Score based on access count and recency (lower is worse)
      const recencyScore = (now - entry.lastAccessed) / (24 * 60 * 60 * 1000); // Days since last access
      const accessScore = Math.max(1, entry.accessCount);
      const score = recencyScore / accessScore;

      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.logger.debug('Evicted LRU entry', { key: lruKey, score: lruScore });
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.options.cleanupInterval);

    // Ensure cleanup timer doesn't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer and clear cache
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
    this.logger.info('ConfigCache destroyed');
  }
}
