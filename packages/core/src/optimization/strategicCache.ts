/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Strategic Caching Layer for Large Codebases
 *
 * Provides intelligent cache management with predictive prefetching,
 * multi-level storage (memory/disk), cache warming, and smart eviction strategies.
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

/**
 * Cache entry priority levels
 */
export enum CachePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Cache eviction strategies
 */
export enum EvictionStrategy {
  LRU = 'lru', // Least Recently Used
  LFU = 'lfu', // Least Frequently Used
  FIFO = 'fifo', // First In, First Out
  ADAPTIVE = 'adaptive', // Adaptive Replacement Cache
  TTL = 'ttl', // Time To Live based
}

/**
 * Cache storage tiers
 */
export enum StorageTier {
  MEMORY = 'memory',
  DISK = 'disk',
  NETWORK = 'network',
}

/**
 * Strategic cache configuration
 */
export interface StrategicCacheConfig {
  // Memory cache settings
  memorySize: number; // bytes
  memoryMaxEntries: number;

  // Disk cache settings
  diskCacheDir: string;
  diskSize: number; // bytes
  diskMaxEntries: number;
  enableDiskCache: boolean;

  // Eviction and TTL
  defaultTTL: number; // milliseconds
  maxTTL: number; // milliseconds
  evictionStrategy: EvictionStrategy;

  // Prefetching
  enablePrefetching: boolean;
  prefetchThreshold: number; // 0-1 access probability
  maxPrefetchSize: number; // bytes
  prefetchConcurrency: number;

  // Performance optimization
  enableCompression: boolean;
  compressionThreshold: number; // bytes
  enableDeduplication: boolean;
  enableAnalytics: boolean;

  // Smart features
  enablePredictiveEviction: boolean;
  enableAccessPatternLearning: boolean;
  enableCacheWarming: boolean;
  warmupTargets: string[];
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  size: number;
  priority: CachePriority;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  ttl: number;
  isCompressed: boolean;
  checksum: string;
  metadata: Record<string, any>;
  storageLocation: StorageTier;
  prefetched: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  memoryEntries: number;
  diskEntries: number;
  totalSize: number;
  memorySize: number;
  diskSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  prefetchHitRate: number;
  compressionRatio: number;
  averageAccessTime: number;
}

/**
 * Access pattern for predictive caching
 */
interface AccessPattern {
  key: string;
  frequency: number;
  recency: number;
  timeOfDay: number[];
  dayOfWeek: number[];
  accessSequence: string[];
  predictedNextAccess: Date;
  confidence: number;
}

/**
 * Strategic cache implementation
 */
export class StrategicCache<T = any> extends EventEmitter {
  private readonly config: StrategicCacheConfig;
  private readonly memoryCache: Map<string, CacheEntry<T>> = new Map();
  private readonly diskCacheIndex: Map<string, string> = new Map(); // key -> disk path
  private readonly accessPatterns: Map<string, AccessPattern> = new Map();
  private readonly prefetchQueue: Set<string> = new Set();

  private stats: CacheStats = {
    totalEntries: 0,
    memoryEntries: 0,
    diskEntries: 0,
    totalSize: 0,
    memorySize: 0,
    diskSize: 0,
    hitRate: 0,
    missRate: 0,
    evictionCount: 0,
    prefetchHitRate: 0,
    compressionRatio: 0,
    averageAccessTime: 0,
  };

  private totalRequests = 0;
  private totalHits = 0;
  private totalMisses = 0;
  private prefetchHits = 0;
  private prefetchRequests = 0;

  private cleanupTimer: NodeJS.Timeout | null = null;
  private analyticsTimer: NodeJS.Timeout | null = null;
  private prefetchTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<StrategicCacheConfig> = {}) {
    super();

    this.config = {
      memorySize: 100 * 1024 * 1024, // 100MB
      memoryMaxEntries: 10000,
      diskCacheDir: '.cache',
      diskSize: 1024 * 1024 * 1024, // 1GB
      diskMaxEntries: 100000,
      enableDiskCache: true,
      defaultTTL: 3600000, // 1 hour
      maxTTL: 24 * 3600000, // 24 hours
      evictionStrategy: EvictionStrategy.ADAPTIVE,
      enablePrefetching: true,
      prefetchThreshold: 0.7,
      maxPrefetchSize: 10 * 1024 * 1024, // 10MB
      prefetchConcurrency: 3,
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      enableDeduplication: true,
      enableAnalytics: true,
      enablePredictiveEviction: true,
      enableAccessPatternLearning: true,
      enableCacheWarming: false,
      warmupTargets: [],
      ...config,
    };
  }

  /**
   * Initialize the cache system
   */
  async initialize(): Promise<void> {
    // Create disk cache directory if needed
    if (this.config.enableDiskCache) {
      await this.ensureDiskCacheDir();
      await this.loadDiskCacheIndex();
    }

    // Start background tasks
    this.startCleanupTimer();

    if (this.config.enableAnalytics) {
      this.startAnalyticsTimer();
    }

    if (this.config.enablePrefetching) {
      this.startPrefetchTimer();
    }

    // Perform cache warming if enabled
    if (this.config.enableCacheWarming && this.config.warmupTargets.length > 0) {
      await this.performCacheWarming();
    }

    this.emit('initialized');
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<T | null> {
    const startTime = performance.now();
    this.totalRequests++;

    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && this.isEntryValid(memoryEntry)) {
        this.updateAccessStats(memoryEntry);
        this.totalHits++;

        // Track if this was a prefetch hit
        if (memoryEntry.prefetched) {
          this.prefetchHits++;
        }

        this.recordAccess(key, startTime);
        return memoryEntry.value;
      }

      // Check disk cache if enabled
      if (this.config.enableDiskCache) {
        const diskEntry = await this.getDiskEntry(key);
        if (diskEntry && this.isEntryValid(diskEntry)) {
          // Promote to memory cache
          await this.promoteToMemory(diskEntry);
          this.updateAccessStats(diskEntry);
          this.totalHits++;

          this.recordAccess(key, startTime);
          return diskEntry.value;
        }
      }

      this.totalMisses++;
      this.recordAccess(key, startTime, false);

      // Update access patterns for learning
      if (this.config.enableAccessPatternLearning) {
        this.updateAccessPattern(key);
      }

      return null;
    } finally {
      const executionTime = performance.now() - startTime;
      this.updateStats();
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: T,
    options: {
      priority?: CachePriority;
      ttl?: number;
      tier?: StorageTier;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const {
      priority = CachePriority.NORMAL,
      ttl = this.config.defaultTTL,
      tier = StorageTier.MEMORY,
      metadata = {},
    } = options;

    const entry: CacheEntry<T> = {
      key,
      value,
      size: this.calculateSize(value),
      priority,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      ttl: Math.min(ttl, this.config.maxTTL),
      isCompressed: false,
      checksum: this.calculateChecksum(value),
      metadata,
      storageLocation: tier,
      prefetched: false,
    };

    // Compress if threshold is met
    if (this.config.enableCompression && entry.size >= this.config.compressionThreshold) {
      await this.compressEntry(entry);
    }

    // Handle memory cache
    if (tier === StorageTier.MEMORY || tier === StorageTier.DISK) {
      await this.setMemoryEntry(entry);
    }

    // Handle disk cache
    if (
      this.config.enableDiskCache &&
      (tier === StorageTier.DISK || this.shouldPromoteToDisk(entry))
    ) {
      await this.setDiskEntry(entry);
    }

    this.emit('entrySet', { key, size: entry.size, tier });
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    let deleted = false;

    // Remove from memory
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
      deleted = true;
    }

    // Remove from disk if enabled
    if (this.config.enableDiskCache && this.diskCacheIndex.has(key)) {
      const diskPath = this.diskCacheIndex.get(key)!;
      try {
        await fs.unlink(diskPath);
        this.diskCacheIndex.delete(key);
        deleted = true;
      } catch (error) {
        // Ignore file not found errors
      }
    }

    // Remove access pattern
    this.accessPatterns.delete(key);

    if (deleted) {
      this.emit('entryDeleted', { key });
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear disk cache if enabled
    if (this.config.enableDiskCache) {
      for (const diskPath of this.diskCacheIndex.values()) {
        try {
          await fs.unlink(diskPath);
        } catch (error) {
          // Ignore errors
        }
      }
      this.diskCacheIndex.clear();
    }

    // Clear access patterns
    this.accessPatterns.clear();

    // Reset stats
    this.resetStats();

    this.emit('cleared');
  }

  /**
   * Prefetch keys that are likely to be accessed
   */
  async prefetch(keys: string[], fetchFunction: (key: string) => Promise<T>): Promise<void> {
    if (!this.config.enablePrefetching) return;

    const prefetchTasks = keys
      .filter((key) => !this.memoryCache.has(key) && !this.prefetchQueue.has(key))
      .slice(0, this.config.prefetchConcurrency)
      .map(async (key) => {
        this.prefetchQueue.add(key);
        this.prefetchRequests++;

        try {
          const value = await fetchFunction(key);
          await this.set(key, value, {
            priority: CachePriority.LOW,
            metadata: { prefetched: true },
          });

          // Mark as prefetched
          const entry = this.memoryCache.get(key);
          if (entry) {
            entry.prefetched = true;
          }
        } catch (error) {
          this.emit('prefetchError', { key, error });
        } finally {
          this.prefetchQueue.delete(key);
        }
      });

    await Promise.allSettled(prefetchTasks);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get detailed analytics
   */
  getAnalytics(): {
    stats: CacheStats;
    topKeys: Array<{ key: string; accessCount: number; lastAccessed: Date }>;
    accessPatterns: AccessPattern[];
    evictionCandidates: string[];
  } {
    const topKeys = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    const accessPatterns = Array.from(this.accessPatterns.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);

    const evictionCandidates = this.getEvictionCandidates(10);

    return {
      stats: this.getStats(),
      topKeys,
      accessPatterns,
      evictionCandidates,
    };
  }

  /**
   * Shutdown the cache system
   */
  async shutdown(): Promise<void> {
    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
      this.analyticsTimer = null;
    }

    if (this.prefetchTimer) {
      clearInterval(this.prefetchTimer);
      this.prefetchTimer = null;
    }

    // Save disk cache index
    if (this.config.enableDiskCache) {
      await this.saveDiskCacheIndex();
    }

    this.emit('shutdown');
  }

  private async setMemoryEntry(entry: CacheEntry<T>): Promise<void> {
    // Check if we need to evict entries
    await this.ensureMemoryCapacity(entry.size);

    this.memoryCache.set(entry.key, entry);
  }

  private async setDiskEntry(entry: CacheEntry<T>): Promise<void> {
    const diskPath = path.join(this.config.diskCacheDir, `${entry.checksum}.cache`);

    const diskData = {
      key: entry.key,
      value: entry.value,
      metadata: entry,
    };

    await fs.writeFile(diskPath, JSON.stringify(diskData));
    this.diskCacheIndex.set(entry.key, diskPath);
  }

  private async getDiskEntry(key: string): Promise<CacheEntry<T> | null> {
    const diskPath = this.diskCacheIndex.get(key);
    if (!diskPath) return null;

    try {
      const diskData = JSON.parse(await fs.readFile(diskPath, 'utf-8'));
      return {
        ...diskData.metadata,
        value: diskData.value,
      };
    } catch (error) {
      // Remove invalid entry
      this.diskCacheIndex.delete(key);
      return null;
    }
  }

  private async promoteToMemory(entry: CacheEntry<T>): Promise<void> {
    await this.ensureMemoryCapacity(entry.size);
    entry.storageLocation = StorageTier.MEMORY;
    this.memoryCache.set(entry.key, entry);
  }

  private async ensureMemoryCapacity(requiredSize: number): Promise<void> {
    while (
      this.getCurrentMemorySize() + requiredSize > this.config.memorySize ||
      this.memoryCache.size >= this.config.memoryMaxEntries
    ) {
      const candidate = this.selectEvictionCandidate();
      if (!candidate) break;

      await this.evictEntry(candidate);
    }
  }

  private selectEvictionCandidate(): string | null {
    if (this.memoryCache.size === 0) return null;

    switch (this.config.evictionStrategy) {
      case EvictionStrategy.LRU:
        return this.selectLRUCandidate();
      case EvictionStrategy.LFU:
        return this.selectLFUCandidate();
      case EvictionStrategy.FIFO:
        return this.selectFIFOCandidate();
      case EvictionStrategy.TTL:
        return this.selectTTLCandidate();
      case EvictionStrategy.ADAPTIVE:
      default:
        return this.selectAdaptiveCandidate();
    }
  }

  private selectLRUCandidate(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache) {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime();
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private selectLFUCandidate(): string | null {
    let leastUsedKey: string | null = null;
    let leastCount = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.accessCount < leastCount) {
        leastCount = entry.accessCount;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  private selectFIFOCandidate(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache) {
      if (entry.createdAt.getTime() < oldestTime) {
        oldestTime = entry.createdAt.getTime();
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private selectTTLCandidate(): string | null {
    const now = Date.now();

    for (const [key, entry] of this.memoryCache) {
      const expiryTime = entry.createdAt.getTime() + entry.ttl;
      if (now >= expiryTime) {
        return key;
      }
    }

    // If no expired entries, fall back to LRU
    return this.selectLRUCandidate();
  }

  private selectAdaptiveCandidate(): string | null {
    // Adaptive algorithm considers multiple factors
    let bestCandidate: string | null = null;
    let bestScore = -1;

    const now = Date.now();

    for (const [key, entry] of this.memoryCache) {
      // Skip high priority entries unless they're expired
      if (entry.priority >= CachePriority.HIGH) {
        const expiryTime = entry.createdAt.getTime() + entry.ttl;
        if (now < expiryTime) continue;
      }

      // Calculate composite score (lower is better for eviction)
      const ageScore = (now - entry.lastAccessed.getTime()) / (60 * 60 * 1000); // hours since last access
      const frequencyScore = 1 / (entry.accessCount + 1); // inverse frequency
      const sizeScore = entry.size / (1024 * 1024); // size in MB
      const priorityScore = 1 / entry.priority; // inverse priority

      const compositeScore = ageScore + frequencyScore + sizeScore + priorityScore;

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestCandidate = key;
      }
    }

    return bestCandidate;
  }

  private getEvictionCandidates(count: number): string[] {
    const candidates: Array<{ key: string; score: number }> = [];
    const now = Date.now();

    for (const [key, entry] of this.memoryCache) {
      const ageScore = (now - entry.lastAccessed.getTime()) / (60 * 60 * 1000);
      const frequencyScore = 1 / (entry.accessCount + 1);
      const sizeScore = entry.size / (1024 * 1024);
      const priorityScore = 1 / entry.priority;

      const compositeScore = ageScore + frequencyScore + sizeScore + priorityScore;
      candidates.push({ key, score: compositeScore });
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((c) => c.key);
  }

  private async evictEntry(key: string): Promise<void> {
    const entry = this.memoryCache.get(key);
    if (!entry) return;

    // Move to disk if valuable enough and disk cache is enabled
    if (this.config.enableDiskCache && this.shouldPromoteToDisk(entry)) {
      await this.setDiskEntry(entry);
    }

    this.memoryCache.delete(key);
    this.stats.evictionCount++;

    this.emit('entryEvicted', { key, reason: 'capacity' });
  }

  private shouldPromoteToDisk(entry: CacheEntry<T>): boolean {
    // Promote if high priority or frequently accessed
    return (
      entry.priority >= CachePriority.HIGH ||
      entry.accessCount >= 5 ||
      entry.size >= this.config.compressionThreshold
    );
  }

  private isEntryValid(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    const expiryTime = entry.createdAt.getTime() + entry.ttl;
    return now < expiryTime;
  }

  private updateAccessStats(entry: CacheEntry<T>): void {
    entry.lastAccessed = new Date();
    entry.accessCount++;
  }

  private recordAccess(key: string, startTime: number, hit: boolean = true): void {
    const executionTime = performance.now() - startTime;

    // Update average access time
    if (this.totalRequests > 0) {
      this.stats.averageAccessTime =
        (this.stats.averageAccessTime * (this.totalRequests - 1) + executionTime) /
        this.totalRequests;
    } else {
      this.stats.averageAccessTime = executionTime;
    }
  }

  private updateAccessPattern(key: string): void {
    if (!this.config.enableAccessPatternLearning) return;

    const now = new Date();
    const pattern = this.accessPatterns.get(key) || {
      key,
      frequency: 0,
      recency: 0,
      timeOfDay: [],
      dayOfWeek: [],
      accessSequence: [],
      predictedNextAccess: now,
      confidence: 0,
    };

    pattern.frequency++;
    pattern.recency = now.getTime();
    pattern.timeOfDay.push(now.getHours());
    pattern.dayOfWeek.push(now.getDay());

    // Keep only recent access sequence
    pattern.accessSequence.push(now.toISOString());
    if (pattern.accessSequence.length > 10) {
      pattern.accessSequence.shift();
    }

    // Update prediction
    this.updatePrediction(pattern);

    this.accessPatterns.set(key, pattern);
  }

  private updatePrediction(pattern: AccessPattern): void {
    // Simple prediction based on frequency and time patterns
    const avgTimeBetweenAccesses = this.calculateAverageInterval(pattern.accessSequence);

    if (avgTimeBetweenAccesses > 0) {
      pattern.predictedNextAccess = new Date(Date.now() + avgTimeBetweenAccesses);
      pattern.confidence = Math.min(pattern.frequency / 10, 1); // Max confidence at 10 accesses
    }
  }

  private calculateAverageInterval(accessSequence: string[]): number {
    if (accessSequence.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < accessSequence.length; i++) {
      const prev = new Date(accessSequence[i - 1]).getTime();
      const curr = new Date(accessSequence[i]).getTime();
      intervals.push(curr - prev);
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  private async compressEntry(entry: CacheEntry<T>): Promise<void> {
    // Simple compression simulation - in real implementation, use zlib
    const serialized = JSON.stringify(entry.value);
    const originalSize = Buffer.byteLength(serialized);

    // Simulate 60% compression ratio
    entry.size = Math.floor(originalSize * 0.6);
    entry.isCompressed = true;
  }

  private calculateSize(value: T): number {
    // Simple size estimation
    return Buffer.byteLength(JSON.stringify(value));
  }

  private calculateChecksum(value: T): string {
    return createHash('md5').update(JSON.stringify(value)).digest('hex');
  }

  private getCurrentMemorySize(): number {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private updateStats(): void {
    this.stats.totalEntries = this.memoryCache.size + this.diskCacheIndex.size;
    this.stats.memoryEntries = this.memoryCache.size;
    this.stats.diskEntries = this.diskCacheIndex.size;
    this.stats.memorySize = this.getCurrentMemorySize();

    if (this.totalRequests > 0) {
      this.stats.hitRate = this.totalHits / this.totalRequests;
      this.stats.missRate = this.totalMisses / this.totalRequests;
    }

    if (this.prefetchRequests > 0) {
      this.stats.prefetchHitRate = this.prefetchHits / this.prefetchRequests;
    }
  }

  private resetStats(): void {
    this.stats = {
      totalEntries: 0,
      memoryEntries: 0,
      diskEntries: 0,
      totalSize: 0,
      memorySize: 0,
      diskSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      prefetchHitRate: 0,
      compressionRatio: 0,
      averageAccessTime: 0,
    };

    this.totalRequests = 0;
    this.totalHits = 0;
    this.totalMisses = 0;
    this.prefetchHits = 0;
    this.prefetchRequests = 0;
  }

  private async ensureDiskCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.diskCacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async loadDiskCacheIndex(): Promise<void> {
    const indexPath = path.join(this.config.diskCacheDir, 'index.json');

    try {
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexData);

      for (const [key, diskPath] of Object.entries(index)) {
        this.diskCacheIndex.set(key, diskPath as string);
      }
    } catch (error) {
      // Index doesn't exist yet
    }
  }

  private async saveDiskCacheIndex(): Promise<void> {
    const indexPath = path.join(this.config.diskCacheDir, 'index.json');
    const index = Object.fromEntries(this.diskCacheIndex);

    try {
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      this.emit('error', { operation: 'saveDiskIndex', error });
    }
  }

  private async performCacheWarming(): Promise<void> {
    this.emit('warmupStarted', { targets: this.config.warmupTargets.length });

    // Cache warming implementation would go here
    // This is a placeholder for the actual implementation

    this.emit('warmupCompleted');
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60000); // Clean up every minute
  }

  private startAnalyticsTimer(): void {
    this.analyticsTimer = setInterval(() => {
      this.emit('analytics', this.getAnalytics());
    }, 300000); // Analytics every 5 minutes
  }

  private startPrefetchTimer(): void {
    this.prefetchTimer = setInterval(() => {
      this.performPredictivePrefetch();
    }, 30000); // Prefetch analysis every 30 seconds
  }

  private performCleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.memoryCache) {
      const expiryTime = entry.createdAt.getTime() + entry.ttl;
      if (now >= expiryTime) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
      this.emit('entryEvicted', { key, reason: 'expired' });
    }
  }

  private performPredictivePrefetch(): void {
    if (!this.config.enablePrefetching) return;

    const now = Date.now();
    const candidatesForPrefetch: string[] = [];

    for (const pattern of this.accessPatterns.values()) {
      if (
        pattern.confidence >= this.config.prefetchThreshold &&
        pattern.predictedNextAccess.getTime() <= now + 60000 && // Next hour
        !this.memoryCache.has(pattern.key) &&
        !this.prefetchQueue.has(pattern.key)
      ) {
        candidatesForPrefetch.push(pattern.key);
      }
    }

    if (candidatesForPrefetch.length > 0) {
      this.emit('prefetchCandidates', { keys: candidatesForPrefetch });
    }
  }
}

/**
 * Factory for creating different cache configurations
 */
export class StrategicCacheFactory {
  /**
   * Create cache optimized for high-performance scenarios
   */
  static createHighPerformance<T>(): StrategicCache<T> {
    return new StrategicCache<T>({
      memorySize: 500 * 1024 * 1024, // 500MB
      memoryMaxEntries: 50000,
      evictionStrategy: EvictionStrategy.ADAPTIVE,
      enablePrefetching: true,
      prefetchThreshold: 0.8,
      enableCompression: true,
      enableAccessPatternLearning: true,
    });
  }

  /**
   * Create cache optimized for memory-constrained environments
   */
  static createMemoryEfficient<T>(): StrategicCache<T> {
    return new StrategicCache<T>({
      memorySize: 50 * 1024 * 1024, // 50MB
      memoryMaxEntries: 5000,
      enableDiskCache: true,
      diskSize: 200 * 1024 * 1024, // 200MB
      evictionStrategy: EvictionStrategy.LRU,
      enableCompression: true,
      compressionThreshold: 512, // 512 bytes
      enablePrefetching: false,
    });
  }

  /**
   * Create cache with aggressive prefetching
   */
  static createPrefetchOptimized<T>(): StrategicCache<T> {
    return new StrategicCache<T>({
      enablePrefetching: true,
      prefetchThreshold: 0.5,
      prefetchConcurrency: 8,
      enableAccessPatternLearning: true,
      enablePredictiveEviction: true,
      enableCacheWarming: true,
      evictionStrategy: EvictionStrategy.ADAPTIVE,
    });
  }
}
