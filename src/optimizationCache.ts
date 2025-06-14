/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Optimization Results Caching System
 * 
 * Provides intelligent caching for optimization results to dramatically speed up
 * subsequent optimizations of the same project. Uses the existing CacheManager
 * infrastructure with optimization-specific enhancements.
 * 
 * Features:
 * - File content hash-based caching
 * - Configuration-aware cache keys
 * - Automatic cache invalidation on file changes
 * - Version-aware caching for tool updates
 * - Performance metrics and analytics
 * - Multi-level cache hierarchy (memory + disk persistence)
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { CacheManager, createCacheManager } from './performance/cacheManager.ts';
import type { EnigmaConfig } from './config.ts';
import type { OptimizationResult } from './output/assetHasher.ts';

/**
 * Cache key components for optimization results
 */
export interface OptimizationCacheKey {
  /** Hash of input file contents */
  contentHash: string;
  /** Hash of configuration that affects optimization */
  configHash: string;
  /** Version of the optimization engine */
  engineVersion: string;
  /** Framework/integration type */
  framework?: string;
  /** File type (html, js, vue, etc.) */
  fileType: string;
}

/**
 * Cached optimization entry with metadata
 */
export interface CachedOptimizationResult extends OptimizationResult {
  /** When this result was cached */
  cachedAt: Date;
  /** Cache key used to store this result */
  cacheKey: string;
  /** Input files that contributed to this result */
  inputFiles: string[];
  /** Configuration snapshot */
  configSnapshot: Partial<EnigmaConfig>;
  /** Cache hit statistics */
  hitCount: number;
  /** Last time this cache entry was accessed */
  lastAccessed: Date;
}

/**
 * Cache invalidation reasons
 */
export type InvalidationReason = 
  | 'file-changed'
  | 'config-changed'
  | 'engine-updated'
  | 'manual'
  | 'expired'
  | 'dependency-changed';

/**
 * Configuration for optimization cache
 */
export interface OptimizationCacheConfig {
  /** Enable caching */
  enabled: boolean;
  /** Maximum cache size in bytes */
  maxSize: number;
  /** Cache TTL in milliseconds (default: 7 days) */
  ttl: number;
  /** Enable file watching for auto-invalidation */
  enableFileWatching: boolean;
  /** Cache persistence directory */
  persistenceDir?: string;
  /** Enable compression for cached data */
  enableCompression: boolean;
  /** Maximum number of cached results per project */
  maxEntriesPerProject: number;
  /** Enable performance analytics */
  enableAnalytics: boolean;
  /** Debounce delay for file change events (ms) */
  fileChangeDebounce: number;
}

/**
 * Cache analytics and performance metrics
 */
export interface CacheAnalytics {
  /** Total cache hits */
  totalHits: number;
  /** Total cache misses */
  totalMisses: number;
  /** Cache hit rate percentage */
  hitRate: number;
  /** Average optimization time saved per hit (ms) */
  averageTimeSaved: number;
  /** Total time saved by caching (ms) */
  totalTimeSaved: number;
  /** Most frequently cached file types */
  topFileTypes: Array<{ type: string; count: number }>;
  /** Cache size statistics */
  sizeStats: {
    totalEntries: number;
    totalSize: number;
    averageEntrySize: number;
    largestEntry: number;
  };
  /** Invalidation statistics */
  invalidationStats: {
    byReason: Record<InvalidationReason, number>;
    totalInvalidations: number;
  };
}

/**
 * Optimization cache manager
 */
export class OptimizationCache extends EventEmitter {
  private readonly config: OptimizationCacheConfig;
  private readonly cache: CacheManager<CachedOptimizationResult>;
  private readonly fileWatcher?: any;
  private readonly watchedFiles = new Set<string>();
  private readonly analytics: CacheAnalytics;
  private readonly configHashes = new Map<string, string>();
  private readonly fileChangeTimers = new Map<string, NodeJS.Timeout>();

  constructor(config: Partial<OptimizationCacheConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      maxSize: 500 * 1024 * 1024, // 500MB
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
      enableFileWatching: true,
      enableCompression: true,
      maxEntriesPerProject: 10000,
      enableAnalytics: true,
      fileChangeDebounce: 1000, // 1 second
      ...config,
    };

    // Initialize cache manager with optimization-specific settings
    this.cache = createCacheManager<CachedOptimizationResult>({
      enabled: this.config.enabled,
      maxSize: this.config.maxSize,
      strategy: 'lru',
      ttl: this.config.ttl,
      persistence: !!this.config.persistenceDir,
      persistencePath: this.config.persistenceDir,
      compressionEnabled: this.config.enableCompression,
    });

    // Initialize analytics
    this.analytics = {
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
        byReason: {
          'file-changed': 0,
          'config-changed': 0,
          'engine-updated': 0,
          'manual': 0,
          'expired': 0,
          'dependency-changed': 0,
        },
        totalInvalidations: 0,
      },
    };

    // Set up file watching if enabled
    if (this.config.enableFileWatching) {
      this.setupFileWatching();
    }

    this.setupEventHandlers();
  }

  /**
   * Get cached optimization result if available
   */
  async get(
    inputFiles: string[],
    config: EnigmaConfig,
    framework?: string
  ): Promise<CachedOptimizationResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const cacheKey = await this.generateCacheKey(inputFiles, config, framework);
      const cached = await this.cache.get(cacheKey);

      if (cached) {
        // Update access metadata
        cached.hitCount++;
        cached.lastAccessed = new Date();
        
        // Re-cache with updated metadata
        await this.cache.set(cacheKey, cached);

        this.recordCacheHit(cached);
        this.emit('cache-hit', { cacheKey, inputFiles, timeSaved: cached.stats.optimizationTime });

        return cached;
      }

      this.recordCacheMiss(inputFiles);
      this.emit('cache-miss', { cacheKey, inputFiles });

      return null;
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Store optimization result in cache
   */
  async set(
    inputFiles: string[],
    config: EnigmaConfig,
    result: OptimizationResult,
    framework?: string
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const cacheKey = await this.generateCacheKey(inputFiles, config, framework);
      
      const cachedResult: CachedOptimizationResult = {
        ...result,
        cachedAt: new Date(),
        cacheKey,
        inputFiles: [...inputFiles],
        configSnapshot: this.extractRelevantConfig(config),
        hitCount: 0,
        lastAccessed: new Date(),
      };

      const success = await this.cache.set(cacheKey, cachedResult);

      if (success) {
        // Start watching input files for changes
        this.watchFiles(inputFiles);
        
        this.updateAnalytics(cachedResult);
        this.emit('cache-set', { cacheKey, inputFiles, size: this.estimateSize(cachedResult) });
      }

      return success;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Invalidate cache entries based on file changes
   */
  async invalidateByFiles(files: string[], reason: InvalidationReason = 'file-changed'): Promise<number> {
    let invalidatedCount = 0;

    try {
      const allKeys = this.cache.keys();
      
      for (const key of allKeys) {
        const cached = await this.cache.get(key);
        if (!cached) continue;

        // Check if any of the changed files affect this cache entry
        const hasAffectedFile = files.some(file => 
          cached.inputFiles.some(inputFile => 
            path.resolve(inputFile) === path.resolve(file)
          )
        );

        if (hasAffectedFile) {
          await this.cache.delete(key);
          invalidatedCount++;
          this.recordInvalidation(reason);
          this.emit('cache-invalidated', { cacheKey: key, reason, files });
        }
      }

      return invalidatedCount;
    } catch (error) {
      this.emit('error', error);
      return 0;
    }
  }

  /**
   * Invalidate cache entries based on configuration changes
   */
  async invalidateByConfig(newConfig: EnigmaConfig): Promise<number> {
    let invalidatedCount = 0;

    try {
      const newConfigHash = this.hashConfig(newConfig);
      const allKeys = this.cache.keys();

      for (const key of allKeys) {
        const cached = await this.cache.get(key);
        if (!cached) continue;

        const oldConfigHash = this.hashConfig(cached.configSnapshot as EnigmaConfig);
        
        if (oldConfigHash !== newConfigHash) {
          await this.cache.delete(key);
          invalidatedCount++;
          this.recordInvalidation('config-changed');
          this.emit('cache-invalidated', { cacheKey: key, reason: 'config-changed' });
        }
      }

      return invalidatedCount;
    } catch (error) {
      this.emit('error', error);
      return 0;
    }
  }

  /**
   * Clear all cached optimization results
   */
  async clear(): Promise<void> {
    await this.cache.clear();
    this.watchedFiles.clear();
    this.configHashes.clear();
    this.resetAnalytics();
    this.emit('cache-cleared');
  }

  /**
   * Get cache analytics and performance metrics
   */
  getAnalytics(): CacheAnalytics {
    const cacheStats = this.cache.getStats();
    
    return {
      ...this.analytics,
      hitRate: this.analytics.totalHits + this.analytics.totalMisses > 0 
        ? (this.analytics.totalHits / (this.analytics.totalHits + this.analytics.totalMisses)) * 100
        : 0,
      sizeStats: {
        totalEntries: cacheStats.entryCount,
        totalSize: cacheStats.totalSize,
        averageEntrySize: cacheStats.entryCount > 0 ? cacheStats.totalSize / cacheStats.entryCount : 0,
        largestEntry: this.analytics.sizeStats.largestEntry,
      },
    };
  }

  /**
   * Generate a unique cache key for the given inputs
   */
  async generateCacheKey(
    inputFiles: string[],
    config: EnigmaConfig,
    framework?: string
  ): Promise<string> {
    // Generate content hash from all input files
    const contentHash = await this.generateContentHash(inputFiles);
    
    // Generate config hash from optimization-relevant configuration
    const configHash = this.hashConfig(config);
    
    // Use package.json version as engine version
    const engineVersion = process.env.npm_package_version || '1.0.0';
    
    // Determine file type from file extensions
    const fileType = this.determineFileType(inputFiles);

    const keyComponents: OptimizationCacheKey = {
      contentHash,
      configHash,
      engineVersion,
      framework,
      fileType,
    };

    // Create deterministic cache key
    const keyString = JSON.stringify(keyComponents);
    try {
      return createHash('sha256').update(keyString).digest('hex');
    } catch (_) {
      // Fallback for test environments or crypto issues
      // Use a simple hash of the keyString for deterministic results
      let hash = 0;
      for (let i = 0; i < keyString.length; i++) {
        const char = keyString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `cache-key-${Math.abs(hash)}-${keyString.length}`;
    }
  }

  /**
   * Generate hash of file contents
   */
  private async generateContentHash(files: string[]): Promise<string> {
    try {
      const hash = createHash('sha256');
      
      // Sort files for deterministic hashing
      const sortedFiles = [...files].sort();
      
      for (const file of sortedFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          hash.update(file); // Include file path
          hash.update(content); // Include file content
        } catch (error) {
          // If file can't be read, include error in hash
          hash.update(`ERROR:${file}:${error}`);
        }
      }

      return hash.digest('hex');
    } catch (_) {
      // Fallback if crypto operations fail (e.g., in tests)
      const content = files.join('-');
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `fallback-hash-${Math.abs(hash)}`;
    }
  }

  /**
   * Generate hash of optimization-relevant configuration
   */
  private hashConfig(config: Partial<EnigmaConfig>): string {
    try {
      // Extract only optimization-relevant config properties
      const relevantConfig = this.extractRelevantConfig(config);
      
      // Sort keys recursively for deterministic serialization
      const configString = JSON.stringify(relevantConfig, (key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const sorted: any = {};
          Object.keys(value).sort().forEach(k => {
            sorted[k] = value[k];
          });
          return sorted;
        }
        return value;
      });
      return createHash('sha256').update(configString).digest('hex');
    } catch (_) {
      // Fallback for test environments or crypto issues
      const relevantConfig = this.extractRelevantConfig(config);
      
      // Sort keys recursively for deterministic serialization
      const configString = JSON.stringify(relevantConfig, (key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const sorted: any = {};
          Object.keys(value).sort().forEach(k => {
            sorted[k] = value[k];
          });
          return sorted;
        }
        return value;
      });
      
      let hash = 0;
      for (let i = 0; i < configString.length; i++) {
        const char = configString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `config-hash-${Math.abs(hash)}`;
    }
  }

  /**
   * Extract configuration properties that affect optimization results
   */
  private extractRelevantConfig(config: Partial<EnigmaConfig>): Partial<EnigmaConfig> {
    const configAny = config as any;
          const result: any = {};
      
      // Add only existing properties to avoid type issues
      if (config.input !== undefined) result.input = config.input;
      if (config.output !== undefined) result.output = config.output;
      if (configAny.optimization !== undefined) result.optimization = configAny.optimization;
      if (configAny.nameGeneration !== undefined) result.nameGeneration = configAny.nameGeneration;
      if (configAny.framework !== undefined) result.framework = configAny.framework;
      if (configAny.processing !== undefined) result.processing = configAny.processing;
      if (configAny.performance !== undefined) result.performance = configAny.performance;
      
      return result;
  }

  /**
   * Determine file type from input files
   */
  private determineFileType(files: string[]): string {
    const extensions = files.map(file => path.extname(file).toLowerCase());
    const uniqueExtensions = [...new Set(extensions)];
    
    if (uniqueExtensions.length === 1) {
      return uniqueExtensions[0].substring(1); // Remove the dot
    }
    
    return 'mixed';
  }

  /**
   * Set up file watching for cache invalidation
   */
  private setupFileWatching(): void {
    // File watcher will be created lazily when files are first watched
  }

  /**
   * Watch files for changes and invalidate cache accordingly
   */
  private watchFiles(files: string[]): void {
    if (!this.config.enableFileWatching) return;

    for (const file of files) {
      if (this.watchedFiles.has(file)) continue;

      this.watchedFiles.add(file);

      // Set up file watcher lazily
      if (!this.fileWatcher) {
        (this as any).fileWatcher = chokidar.watch([], {
          ignoreInitial: true,
          persistent: false,
        });

        this.fileWatcher!.on('change', (filePath: string) => {
          this.handleFileChange(filePath);
        });

        this.fileWatcher!.on('unlink', (filePath: string) => {
          this.handleFileChange(filePath);
        });
      }

      this.fileWatcher!.add(file);
    }
  }

  /**
   * Handle file change events with debouncing
   */
  private handleFileChange(filePath: string): void {
    const absolutePath = path.resolve(filePath);
    
    // Clear existing timer for this file
    if (this.fileChangeTimers.has(absolutePath)) {
      clearTimeout(this.fileChangeTimers.get(absolutePath)!);
    }

    // Set new debounced timer
    const timer = setTimeout(async () => {
      await this.invalidateByFiles([absolutePath], 'file-changed');
      this.fileChangeTimers.delete(absolutePath);
    }, this.config.fileChangeDebounce);

    this.fileChangeTimers.set(absolutePath, timer);
  }

  /**
   * Set up event handlers for cache events
   */
  private setupEventHandlers(): void {
    this.cache.on('hit', (key, value) => {
      this.emit('cache-access', { type: 'hit', key });
    });

    this.cache.on('miss', (key) => {
      this.emit('cache-access', { type: 'miss', key });
    });

    this.cache.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Record cache hit for analytics
   */
  private recordCacheHit(result: CachedOptimizationResult): void {
    if (!this.config.enableAnalytics) return;

    this.analytics.totalHits++;
    this.analytics.totalTimeSaved += result.stats.optimizationTime;
    this.analytics.averageTimeSaved = this.analytics.totalTimeSaved / this.analytics.totalHits;
  }

  /**
   * Record cache miss for analytics
   */
  private recordCacheMiss(inputFiles: string[]): void {
    if (!this.config.enableAnalytics) return;

    this.analytics.totalMisses++;
    
    // Track file types
    const fileType = this.determineFileType(inputFiles);
    const existingType = this.analytics.topFileTypes.find(t => t.type === fileType);
    
    if (existingType) {
      existingType.count++;
    } else {
      this.analytics.topFileTypes.push({ type: fileType, count: 1 });
    }
    
    // Keep only top 10 file types
    this.analytics.topFileTypes.sort((a, b) => b.count - a.count);
    this.analytics.topFileTypes = this.analytics.topFileTypes.slice(0, 10);
  }

  /**
   * Record cache invalidation for analytics
   */
  private recordInvalidation(reason: InvalidationReason): void {
    if (!this.config.enableAnalytics) return;

    this.analytics.invalidationStats.byReason[reason]++;
    this.analytics.invalidationStats.totalInvalidations++;
  }

  /**
   * Update analytics with new cache entry
   */
  private updateAnalytics(result: CachedOptimizationResult): void {
    if (!this.config.enableAnalytics) return;

    const size = this.estimateSize(result);
    
    if (size > this.analytics.sizeStats.largestEntry) {
      this.analytics.sizeStats.largestEntry = size;
    }
  }

  /**
   * Estimate size of cached result in bytes
   */
  private estimateSize(result: CachedOptimizationResult): number {
    return JSON.stringify(result).length * 2; // Rough estimate (UTF-16)
  }

  /**
   * Reset analytics data
   */
  private resetAnalytics(): void {
    Object.assign(this.analytics, {
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
        byReason: {
          'file-changed': 0,
          'config-changed': 0,
          'engine-updated': 0,
          'manual': 0,
          'expired': 0,
          'dependency-changed': 0,
        },
        totalInvalidations: 0,
      },
    });
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    // Clear all timers
    for (const timer of this.fileChangeTimers.values()) {
      clearTimeout(timer);
    }
    this.fileChangeTimers.clear();

    // Close file watcher
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }

    // Destroy cache
    await this.cache.destroy();

    this.removeAllListeners();
  }
}

/**
 * Global optimization cache instance
 */
let globalOptimizationCache: OptimizationCache | null = null;

/**
 * Get or create global optimization cache instance
 */
export function getOptimizationCache(config?: Partial<OptimizationCacheConfig>): OptimizationCache {
  if (!globalOptimizationCache) {
    globalOptimizationCache = new OptimizationCache(config);
  }
  return globalOptimizationCache;
}

/**
 * Create a new optimization cache instance
 */
export function createOptimizationCache(config?: Partial<OptimizationCacheConfig>): OptimizationCache {
  return new OptimizationCache(config);
} 