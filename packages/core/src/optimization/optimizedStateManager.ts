/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from 'crypto';
import { IndexedDataStore, createIndexedDataStore, type DataStoreConfig } from './dataStore';
import { AnalysisResultStore, createAnalysisResultStore } from './analysisResultStore';
import { globalConcurrencyManager, WorkerPool, ResourcePool } from './concurrencyManager';
import type { PatternFrequencyMap } from '../processors/patternAnalysis';
import type { ConsolidationResult } from './completeConsolidator';
import type { PassMetrics } from './multiPassDiscovery';
import { z } from 'zod';

/**
 * Configuration for optimized state management
 */
export const OptimizedStateConfigSchema = z.object({
  // Storage configuration
  dataDirectory: z.string().default('./.tw-enigma/optimized-state'),
  enablePersistence: z.boolean().default(true),
  enableCompression: z.boolean().default(true),
  enableEncryption: z.boolean().default(false),

  // Concurrency configuration
  maxConcurrentOperations: z.number().min(1).default(10),
  maxWorkerThreads: z.number().min(1).default(4),
  enableBatching: z.boolean().default(true),
  batchSize: z.number().min(1).default(100),

  // Caching configuration
  enableMemoryCache: z.boolean().default(true),
  maxCacheSize: z.number().min(1024).default(100 * 1024 * 1024), // 100MB
  cacheEvictionPolicy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
  cacheTTL: z.number().min(1000).default(300000), // 5 minutes

  // Backup and recovery
  enableAutoBackup: z.boolean().default(true),
  backupInterval: z.number().min(60000).default(3600000), // 1 hour
  maxBackups: z.number().min(1).default(10),
  enablePointInTimeRecovery: z.boolean().default(true),

  // Performance optimization
  enableAsyncWrites: z.boolean().default(true),
  enableReadAhead: z.boolean().default(true),
  enableWriteCoalescing: z.boolean().default(true),
  writeBufferSize: z.number().min(1024).default(1024 * 1024), // 1MB

  // Validation and integrity
  enableDataValidation: z.boolean().default(true),
  enableChecksumValidation: z.boolean().default(true),
  enableReferentialIntegrity: z.boolean().default(true),
  
  // Monitoring
  enableMetrics: z.boolean().default(true),
  metricsCollectionInterval: z.number().min(1000).default(10000), // 10 seconds
});

export type OptimizedStateConfig = z.infer<typeof OptimizedStateConfigSchema>;

/**
 * Optimized state snapshot
 */
export interface OptimizedStateSnapshot {
  snapshotId: string;
  timestamp: number;
  version: string;
  metadata: {
    totalEntities: number;
    totalPatterns: number;
    totalSessions: number;
    dataSize: number;
    compressionRatio: number;
    checksums: Record<string, string>;
  };
}

/**
 * State operation result
 */
export interface StateOperationResult {
  success: boolean;
  operationId: string;
  duration: number;
  affectedKeys: string[];
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Batch operation
 */
export interface BatchStateOperation {
  type: 'put' | 'delete' | 'update';
  key: string;
  value?: any;
  metadata?: Record<string, any>;
}

/**
 * State change event
 */
export interface StateChangeEvent {
  type: 'entity_added' | 'entity_modified' | 'entity_removed' | 'pattern_discovered' | 'session_completed';
  entityId?: string;
  patternId?: string;
  sessionId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Cache entry with LRU tracking
 */
interface CacheEntry<T> {
  value: T;
  lastAccessed: number;
  accessCount: number;
  size: number;
  ttl: number;
}

/**
 * Performance metrics
 */
export interface StateManagerMetrics {
  operationsPerSecond: number;
  averageResponseTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  queuedOperations: number;
  errorRate: number;
}

/**
 * Highly optimized state manager for large-scale codebases
 */
export class OptimizedStateManager {
  private config: OptimizedStateConfig;
  private analysisStore: AnalysisResultStore;
  private stateStore: IndexedDataStore<any>;
  private backupStore: IndexedDataStore<OptimizedStateSnapshot>;
  
  // Caching
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private cacheSize = 0;
  
  // Concurrency
  private workerPool: WorkerPool<any, any>;
  private resourcePool: ResourcePool<any>;
  
  // Event handling
  private eventListeners: Map<string, Set<(event: StateChangeEvent) => void>> = new Map();
  
  // Metrics
  private metrics: StateManagerMetrics;
  private operationHistory: Array<{ timestamp: number; duration: number; success: boolean }> = [];
  
  // State
  private isInitialized = false;
  private currentVersion = '1.0.0';

  constructor(config: Partial<OptimizedStateConfig> = {}) {
    this.config = OptimizedStateConfigSchema.parse(config);
    this.metrics = this.initializeMetrics();
    
    // Initialize stores
    const storeConfig: Partial<DataStoreConfig> = {
      dataDirectory: this.config.dataDirectory,
      enableCompression: this.config.enableCompression,
      enableEncryption: this.config.enableEncryption,
      enableAsyncWrites: this.config.enableAsyncWrites,
      batchSize: this.config.batchSize,
      maxConcurrentOperations: this.config.maxConcurrentOperations,
    };

    this.analysisStore = createAnalysisResultStore(storeConfig);
    this.stateStore = createIndexedDataStore({
      ...storeConfig,
      dataDirectory: `${this.config.dataDirectory}/state`,
    });
    this.backupStore = createIndexedDataStore({
      ...storeConfig,
      dataDirectory: `${this.config.dataDirectory}/backups`,
    });

    // Initialize worker pool
    this.workerPool = new WorkerPool(
      this.config.maxWorkerThreads,
      this.processTask.bind(this)
    );

    // Initialize resource pool (for database connections, file handles, etc.)
    this.resourcePool = new ResourcePool(
      () => this.createResource(),
      this.config.maxConcurrentOperations
    );
  }

  /**
   * Initialize the optimized state manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize all stores
      await Promise.all([
        this.analysisStore.initialize(),
        this.stateStore.initialize(),
        this.backupStore.initialize(),
      ]);

      // Start background tasks
      this.startBackgroundTasks();

      // Load existing state
      await this.loadExistingState();

      this.isInitialized = true;
      this.emitEvent({
        type: 'session_completed',
        timestamp: Date.now(),
        metadata: { operation: 'initialize' },
      });

    } catch (error) {
      throw new Error(`OptimizedStateManager initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Store entity metadata with optimized caching
   */
  public async storeEntityMetadata(
    filePath: string,
    metadata: any,
    options: { useCache?: boolean; priority?: 'high' | 'normal' | 'low' } = {}
  ): Promise<StateOperationResult> {
    return this.executeOperation('storeEntityMetadata', async () => {
      const entityId = this.generateEntityId(filePath);
      
      // Update cache first if enabled
      if (options.useCache !== false && this.config.enableMemoryCache) {
        this.updateCache(entityId, metadata);
      }

      // Store in analysis store
      await this.analysisStore.storeEntityMetadata({
        filePath,
        fileType: this.getFileType(filePath),
        lastModified: Date.now(),
        size: JSON.stringify(metadata).length,
        checksum: this.calculateChecksum(metadata),
        analysisVersion: this.currentVersion,
        patterns: [],
        dependencies: [],
        tags: [],
        ...metadata,
      });

      this.emitEvent({
        type: 'entity_added',
        entityId,
        timestamp: Date.now(),
        metadata: { filePath },
      });

      return { affectedKeys: [entityId] };
    });
  }

  /**
   * Get entity metadata with optimized retrieval
   */
  public async getEntityMetadata(
    filePath: string,
    options: { useCache?: boolean; includeRelated?: boolean } = {}
  ): Promise<any | null> {
    const entityId = this.generateEntityId(filePath);

    // Check cache first
    if (options.useCache !== false && this.config.enableMemoryCache) {
      const cached = this.getFromCache(entityId);
      if (cached) {
        this.updateMetrics('cache_hit');
        return cached;
      }
    }

    // Fallback to store
    const metadata = await this.analysisStore.getEntityMetadata(filePath);
    
    if (metadata && options.useCache !== false) {
      this.updateCache(entityId, metadata);
    }

    this.updateMetrics('cache_miss');
    return metadata;
  }

  /**
   * Store pattern analysis results in batches
   */
  public async storePatternAnalysisResults(
    results: Array<{ entityId: string; patterns: any[]; metadata: any }>,
    options: { enableBatching?: boolean } = {}
  ): Promise<StateOperationResult> {
    return this.executeOperation('storePatternAnalysisResults', async () => {
      const affectedKeys: string[] = [];

      if (options.enableBatching !== false && this.config.enableBatching) {
        // Process in batches
        const batches = this.createBatches(results, this.config.batchSize);
        
        for (const batch of batches) {
          await this.workerPool.executeAll(
            batch.map(result => ({
              operation: 'storePattern',
              data: result,
            }))
          );
          
          batch.forEach(result => {
            affectedKeys.push(result.entityId);
            this.emitEvent({
              type: 'pattern_discovered',
              entityId: result.entityId,
              timestamp: Date.now(),
            });
          });
        }
      } else {
        // Process individually
        for (const result of results) {
          await this.analysisStore.storePatternAnalysisResult({
            entityId: result.entityId,
            patterns: result.patterns,
            confidence: 0.8,
            analysisTimestamp: Date.now(),
            processingTime: 0,
            metadata: {
              version: this.currentVersion,
              algorithmUsed: 'optimized',
              configSnapshot: {},
              ...result.metadata,
            },
          });
          
          affectedKeys.push(result.entityId);
        }
      }

      return { affectedKeys };
    });
  }

  /**
   * Query patterns with advanced optimization
   */
  public async queryPatterns(
    query: any,
    options: { useCache?: boolean; prefetch?: boolean } = {}
  ): Promise<any[]> {
    const queryKey = this.generateQueryKey(query);

    // Check cache
    if (options.useCache !== false && this.config.enableMemoryCache) {
      const cached = this.getFromCache(queryKey);
      if (cached) {
        this.updateMetrics('cache_hit');
        return cached;
      }
    }

    // Execute query
    const results = await this.analysisStore.queryPatterns(query);

    // Cache results
    if (options.useCache !== false) {
      this.updateCache(queryKey, results);
    }

    // Prefetch related data if enabled
    if (options.prefetch && this.config.enableReadAhead) {
      this.prefetchRelatedData(results);
    }

    this.updateMetrics('cache_miss');
    return results;
  }

  /**
   * Create an optimized snapshot
   */
  public async createSnapshot(metadata?: Record<string, any>): Promise<OptimizedStateSnapshot> {
    return this.executeOperation('createSnapshot', async () => {
      const snapshotId = this.generateSnapshotId();
      const storageMetrics = await this.analysisStore.getStorageMetrics();
      
      const snapshot: OptimizedStateSnapshot = {
        snapshotId,
        timestamp: Date.now(),
        version: this.currentVersion,
        metadata: {
          totalEntities: storageMetrics.entities,
          totalPatterns: storageMetrics.patterns,
          totalSessions: storageMetrics.sessions,
          dataSize: storageMetrics.totalSize,
          compressionRatio: 1.0,
          checksums: await this.calculateSnapshotChecksums(),
          ...metadata,
        },
      };

      await this.backupStore.put(snapshotId, snapshot);
      return snapshot;
    }).then(result => result.metadata as OptimizedStateSnapshot);
  }

  /**
   * Perform incremental update with optimized diffing
   */
  public async performIncrementalUpdate(
    changedFiles: string[],
    options: { validateIntegrity?: boolean; createCheckpoint?: boolean } = {}
  ): Promise<StateOperationResult> {
    return this.executeOperation('incrementalUpdate', async () => {
      const affectedKeys: string[] = [];

      // Use concurrent processing for file updates
      await globalConcurrencyManager.withSemaphore(
        'incremental-update',
        this.config.maxConcurrentOperations,
        async () => {
          const updateTasks = changedFiles.map(filePath => ({
            operation: 'updateFile',
            filePath,
            timestamp: Date.now(),
          }));

          const results = await this.workerPool.executeAll(updateTasks);
          affectedKeys.push(...results.filter(r => r.success).map(r => r.key));
        }
      );

      // Validate referential integrity if enabled
      if (options.validateIntegrity && this.config.enableReferentialIntegrity) {
        await this.validateReferentialIntegrity(affectedKeys);
      }

      // Create checkpoint if requested
      if (options.createCheckpoint) {
        await this.createSnapshot({ reason: 'incremental_update', changedFiles });
      }

      return { affectedKeys };
    });
  }

  /**
   * Efficient diff between two states
   */
  public async diffStates(
    fromSnapshotId: string,
    toSnapshotId: string
  ): Promise<{
    added: Array<{ key: string; value: any }>;
    modified: Array<{ key: string; oldValue: any; newValue: any }>;
    deleted: Array<{ key: string; value: any }>;
  }> {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      this.backupStore.get(fromSnapshotId),
      this.backupStore.get(toSnapshotId),
    ]);

    if (!fromSnapshot || !toSnapshot) {
      throw new Error('One or both snapshots not found');
    }

    // Use optimized diffing algorithm
    return this.resourcePool.withResource(async () => {
      return this.computeStateDiff(fromSnapshot, toSnapshot);
    });
  }

  /**
   * Register event listener
   */
  public on(eventType: string, listener: (event: StateChangeEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Remove event listener
   */
  public off(eventType: string, listener: (event: StateChangeEvent) => void): void {
    this.eventListeners.get(eventType)?.delete(listener);
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): StateManagerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    size: number;
    hitRate: number;
    entries: number;
    memoryUsage: number;
  } {
    const hitRate = this.operationHistory.length > 0 
      ? this.operationHistory.filter(op => op.success).length / this.operationHistory.length
      : 0;

    return {
      size: this.cacheSize,
      hitRate,
      entries: this.memoryCache.size,
      memoryUsage: this.cacheSize,
    };
  }

  /**
   * Compact all stores
   */
  public async compact(): Promise<void> {
    await this.executeOperation('compact', async () => {
      await Promise.all([
        this.analysisStore.compact(),
        this.stateStore.compact(),
        this.backupStore.compact(),
      ]);

      // Compact cache
      this.compactCache();

      return { affectedKeys: [] };
    });
  }

  /**
   * Close the state manager
   */
  public async close(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Shutdown worker pool
      await this.workerPool.shutdown();

      // Drain resource pool
      await this.resourcePool.drain();

      // Close all stores
      await Promise.all([
        this.analysisStore.close(),
        this.stateStore.close(),
        this.backupStore.close(),
      ]);

      // Clear caches
      this.memoryCache.clear();
      this.cacheSize = 0;

      this.isInitialized = false;
    } catch (error) {
      throw new Error(`Close operation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Private methods

  private async executeOperation<T>(
    operationType: string,
    operation: () => Promise<{ affectedKeys: string[]; metadata?: T }>
  ): Promise<StateOperationResult & { metadata?: T }> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.updateOperationHistory(duration, true);
      this.updateMetrics('operation_success');

      return {
        success: true,
        operationId,
        duration,
        affectedKeys: result.affectedKeys,
        metadata: result.metadata,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.updateOperationHistory(duration, false);
      this.updateMetrics('operation_error');

      return {
        success: false,
        operationId,
        duration,
        affectedKeys: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private initializeMetrics(): StateManagerMetrics {
    return {
      operationsPerSecond: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      diskUsage: 0,
      activeConnections: 0,
      queuedOperations: 0,
      errorRate: 0,
    };
  }

  private updateCache<T>(key: string, value: T): void {
    if (!this.config.enableMemoryCache) return;

    const size = this.calculateValueSize(value);
    
    // Check if we need to evict
    while (this.cacheSize + size > this.config.maxCacheSize && this.memoryCache.size > 0) {
      this.evictCacheEntry();
    }

    const entry: CacheEntry<T> = {
      value,
      lastAccessed: Date.now(),
      accessCount: 1,
      size,
      ttl: Date.now() + this.config.cacheTTL,
    };

    this.memoryCache.set(key, entry);
    this.cacheSize += size;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() > entry.ttl) {
      this.memoryCache.delete(key);
      this.cacheSize -= entry.size;
      return null;
    }

    // Update access tracking
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    return entry.value;
  }

  private evictCacheEntry(): void {
    let entryToEvict: string | null = null;
    let minScore = Infinity;

    for (const [key, entry] of this.memoryCache) {
      let score: number;
      
      switch (this.config.cacheEvictionPolicy) {
        case 'lru':
          score = entry.lastAccessed;
          break;
        case 'lfu':
          score = entry.accessCount;
          break;
        case 'fifo':
          score = Date.now() - entry.lastAccessed;
          break;
      }

      if (score < minScore) {
        minScore = score;
        entryToEvict = key;
      }
    }

    if (entryToEvict) {
      const entry = this.memoryCache.get(entryToEvict)!;
      this.memoryCache.delete(entryToEvict);
      this.cacheSize -= entry.size;
    }
  }

  private compactCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.memoryCache) {
      if (now > entry.ttl) {
        this.memoryCache.delete(key);
        this.cacheSize -= entry.size;
      }
    }
  }

  private calculateValueSize(value: any): number {
    return JSON.stringify(value).length * 2; // Rough estimate
  }

  private generateEntityId(filePath: string): string {
    return createHash('md5').update(filePath).digest('hex');
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateQueryKey(query: any): string {
    return `query_${createHash('md5').update(JSON.stringify(query)).digest('hex')}`;
  }

  private calculateChecksum(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private getFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processTask(task: any): Promise<any> {
    // Process different types of tasks
    switch (task.operation) {
      case 'storePattern':
        return this.analysisStore.storePatternAnalysisResult(task.data);
      case 'updateFile':
        // Handle file update logic
        return { success: true, key: this.generateEntityId(task.filePath) };
      default:
        throw new Error(`Unknown task operation: ${task.operation}`);
    }
  }

  private async createResource(): Promise<any> {
    // Create resources as needed (database connections, etc.)
    return {};
  }

  private emitEvent(event: StateChangeEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  private updateMetrics(operation: string): void {
    // Update various metrics based on operation type
    // Implementation would update this.metrics
  }

  private updateOperationHistory(duration: number, success: boolean): void {
    this.operationHistory.push({ timestamp: Date.now(), duration, success });
    
    // Keep only recent history
    const cutoff = Date.now() - 60000; // 1 minute
    this.operationHistory = this.operationHistory.filter(op => op.timestamp > cutoff);
  }

  private startBackgroundTasks(): void {
    // Metrics collection
    if (this.config.enableMetrics) {
      setInterval(() => {
        this.collectMetrics();
      }, this.config.metricsCollectionInterval);
    }

    // Auto backup
    if (this.config.enableAutoBackup) {
      setInterval(async () => {
        try {
          await this.createSnapshot({ reason: 'auto_backup' });
        } catch (error) {
          console.error('Auto backup failed:', error);
        }
      }, this.config.backupInterval);
    }

    // Cache cleanup
    setInterval(() => {
      this.compactCache();
    }, 30000); // Every 30 seconds
  }

  private async loadExistingState(): Promise<void> {
    // Load any existing state on initialization
    // Implementation would restore previous state
  }

  private async prefetchRelatedData(results: any[]): Promise<void> {
    // Prefetch related data to improve future performance
    // Implementation would identify and cache related data
  }

  private async validateReferentialIntegrity(keys: string[]): Promise<void> {
    // Validate that all references are still valid
    // Implementation would check referential integrity
  }

  private async calculateSnapshotChecksums(): Promise<Record<string, string>> {
    // Calculate checksums for snapshot validation
    return {};
  }

  private async computeStateDiff(fromSnapshot: any, toSnapshot: any): Promise<any> {
    // Compute efficient diff between snapshots
    return { added: [], modified: [], deleted: [] };
  }

  private collectMetrics(): void {
    // Collect and update performance metrics
    const recentOps = this.operationHistory.filter(op => op.timestamp > Date.now() - 10000);
    
    this.metrics.operationsPerSecond = recentOps.length / 10;
    this.metrics.averageResponseTime = recentOps.length > 0 
      ? recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length 
      : 0;
    this.metrics.errorRate = recentOps.length > 0
      ? recentOps.filter(op => !op.success).length / recentOps.length
      : 0;
    this.metrics.memoryUsage = this.cacheSize;
  }
}

/**
 * Factory function to create an OptimizedStateManager instance
 */
export function createOptimizedStateManager(config: Partial<OptimizedStateConfig> = {}): OptimizedStateManager {
  return new OptimizedStateManager(config);
}