/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from 'crypto';
import { mkdir, readFile, writeFile, unlink, readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import { z } from 'zod';

/**
 * Configuration for the indexed data store
 */
export const DataStoreConfigSchema = z.object({
  // Storage settings
  dataDirectory: z.string().default('./.tw-enigma/data'),
  enableCompression: z.boolean().default(true),
  enableEncryption: z.boolean().default(false),
  encryptionKey: z.string().optional(),

  // Indexing settings
  indexStrategy: z.enum(['hash', 'btree', 'lsm']).default('hash'),
  maxIndexSize: z.number().min(1000).default(100000),
  enableMemoryIndex: z.boolean().default(true),
  indexFlushInterval: z.number().min(1000).default(30000),

  // Performance settings
  batchSize: z.number().min(1).default(1000),
  maxConcurrentOperations: z.number().min(1).default(10),
  enableAsyncWrites: z.boolean().default(true),
  writeBufferSize: z.number().min(1024).default(1024 * 1024), // 1MB

  // Persistence settings
  enableWAL: z.boolean().default(true), // Write-ahead logging
  checkpointInterval: z.number().min(1000).default(60000),
  enableAutoCompaction: z.boolean().default(true),
  compactionThreshold: z.number().min(0.1).max(1.0).default(0.3),

  // Transaction settings
  transactionTimeout: z.number().min(1000).default(30000),
  enableIsolation: z.boolean().default(true),
  maxTransactionSize: z.number().min(1).default(10000),
});

export type DataStoreConfig = z.infer<typeof DataStoreConfigSchema>;

/**
 * Data entry structure
 */
export interface DataEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  version: number;
  checksum: string;
  metadata?: Record<string, any>;
}

/**
 * Index entry for fast lookups
 */
export interface IndexEntry {
  key: string;
  offset: number;
  size: number;
  timestamp: number;
  version: number;
  checksum: string;
}

/**
 * Transaction context
 */
export interface Transaction {
  id: string;
  startTime: number;
  operations: TransactionOperation[];
  isolated: boolean;
  status: 'active' | 'committed' | 'aborted';
}

/**
 * Transaction operation
 */
export interface TransactionOperation {
  type: 'put' | 'delete' | 'batch';
  key: string;
  value?: any;
  previousValue?: any;
  timestamp: number;
}

/**
 * Batch operation
 */
export interface BatchOperation {
  type: 'put' | 'delete';
  key: string;
  value?: any;
}

/**
 * Query options
 */
export interface QueryOptions {
  prefix?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'key' | 'timestamp' | 'version';
  sortOrder?: 'asc' | 'desc';
  includeMetadata?: boolean;
}

/**
 * Diff result
 */
export interface DiffResult<T = any> {
  added: Array<{ key: string; value: T }>;
  modified: Array<{ key: string; oldValue: T; newValue: T }>;
  deleted: Array<{ key: string; value: T }>;
  unchanged: Array<{ key: string; value: T }>;
}

/**
 * Performance metrics
 */
export interface DataStoreMetrics {
  totalKeys: number;
  totalSize: number;
  indexSize: number;
  hitRate: number;
  averageResponseTime: number;
  transactionsCommitted: number;
  transactionsAborted: number;
  lastCompactionTime: number;
  compressionRatio: number;
}

/**
 * High-performance indexed data store
 */
export class IndexedDataStore<T = any> {
  private config: DataStoreConfig;
  private index: Map<string, IndexEntry> = new Map();
  private memoryCache: Map<string, DataEntry<T>> = new Map();
  private writeBuffer: Map<string, DataEntry<T>> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private walFile: string;
  private dataFile: string;
  private indexFile: string;
  private isInitialized = false;
  private isCompacting = false;
  private metrics: DataStoreMetrics;

  constructor(config: Partial<DataStoreConfig> = {}) {
    this.config = DataStoreConfigSchema.parse(config);
    this.walFile = join(this.config.dataDirectory, 'wal.log');
    this.dataFile = join(this.config.dataDirectory, 'data.db');
    this.indexFile = join(this.config.dataDirectory, 'index.db');
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize the data store
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create data directory
      await mkdir(this.config.dataDirectory, { recursive: true });

      // Load existing index
      await this.loadIndex();

      // Recover from WAL if exists
      if (this.config.enableWAL) {
        await this.recoverFromWAL();
      }

      // Start background tasks
      this.startBackgroundTasks();

      this.isInitialized = true;
      this.logDebug('IndexedDataStore initialized');
    } catch (error) {
      throw new Error(`DataStore initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Put a key-value pair
   */
  public async put(key: string, value: T, metadata?: Record<string, any>): Promise<void> {
    this.ensureInitialized();

    const startTime = Date.now();
    const entry: DataEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      version: this.getNextVersion(key),
      checksum: this.calculateChecksum(value),
      metadata,
    };

    try {
      if (this.config.enableAsyncWrites) {
        this.writeBuffer.set(key, entry);
        if (this.writeBuffer.size >= this.config.batchSize) {
          await this.flushWriteBuffer();
        }
      } else {
        await this.writeEntry(entry);
      }

      // Update memory cache
      if (this.config.enableMemoryIndex) {
        this.memoryCache.set(key, entry);
      }

      this.updateMetrics('put', Date.now() - startTime);
    } catch (error) {
      throw new Error(`Put operation failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a value by key
   */
  public async get(key: string): Promise<T | null> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      // Check memory cache first
      if (this.config.enableMemoryIndex && this.memoryCache.has(key)) {
        const entry = this.memoryCache.get(key)!;
        this.updateMetrics('get', Date.now() - startTime, true);
        return entry.value;
      }

      // Check write buffer
      if (this.writeBuffer.has(key)) {
        const entry = this.writeBuffer.get(key)!;
        this.updateMetrics('get', Date.now() - startTime, true);
        return entry.value;
      }

      // Check index
      const indexEntry = this.index.get(key);
      if (!indexEntry) {
        this.updateMetrics('get', Date.now() - startTime, false);
        return null;
      }

      // Read from disk
      const entry = await this.readEntry(indexEntry);
      
      // Update memory cache
      if (this.config.enableMemoryIndex) {
        this.memoryCache.set(key, entry);
      }

      this.updateMetrics('get', Date.now() - startTime, true);
      return entry.value;
    } catch (error) {
      this.updateMetrics('get', Date.now() - startTime, false);
      throw new Error(`Get operation failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a key
   */
  public async delete(key: string): Promise<boolean> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      const exists = this.index.has(key) || this.writeBuffer.has(key) || this.memoryCache.has(key);
      
      if (!exists) {
        this.updateMetrics('delete', Date.now() - startTime, false);
        return false;
      }

      // Remove from all caches
      this.index.delete(key);
      this.writeBuffer.delete(key);
      this.memoryCache.delete(key);

      // Write deletion to WAL
      if (this.config.enableWAL) {
        await this.writeToWAL({ type: 'delete', key, timestamp: Date.now() });
      }

      this.updateMetrics('delete', Date.now() - startTime, true);
      return true;
    } catch (error) {
      this.updateMetrics('delete', Date.now() - startTime, false);
      throw new Error(`Delete operation failed for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a batch of operations
   */
  public async batch(operations: BatchOperation[]): Promise<void> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      // Group operations for efficiency
      const putOps = operations.filter(op => op.type === 'put');
      const deleteOps = operations.filter(op => op.type === 'delete');

      // Execute puts
      for (const op of putOps) {
        if (op.value !== undefined) {
          await this.put(op.key, op.value);
        }
      }

      // Execute deletes
      for (const op of deleteOps) {
        await this.delete(op.key);
      }

      this.updateMetrics('batch', Date.now() - startTime, true);
    } catch (error) {
      this.updateMetrics('batch', Date.now() - startTime, false);
      throw new Error(`Batch operation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Query data with filtering options
   */
  public async query(options: QueryOptions = {}): Promise<Array<{ key: string; value: T; metadata?: Record<string, any> }>> {
    this.ensureInitialized();

    const results: Array<{ key: string; value: T; metadata?: Record<string, any> }> = [];
    let keys = Array.from(this.index.keys());

    // Apply prefix filter
    if (options.prefix) {
      keys = keys.filter(key => key.startsWith(options.prefix!));
    }

    // Apply sorting
    if (options.sortBy) {
      keys = this.sortKeys(keys, options.sortBy, options.sortOrder);
    }

    // Apply pagination
    const startIndex = options.offset || 0;
    const endIndex = options.limit ? startIndex + options.limit : keys.length;
    keys = keys.slice(startIndex, endIndex);

    // Fetch values
    for (const key of keys) {
      try {
        const value = await this.get(key);
        if (value !== null) {
          const result: any = { key, value };
          if (options.includeMetadata) {
            const indexEntry = this.index.get(key);
            if (indexEntry) {
              result.metadata = { timestamp: indexEntry.timestamp, version: indexEntry.version };
            }
          }
          results.push(result);
        }
      } catch (error) {
        this.logDebug(`Failed to fetch value for key ${key}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Create an efficient diff between two snapshots
   */
  public async diff(oldSnapshot: Map<string, T>, newSnapshot: Map<string, T>): Promise<DiffResult<T>> {
    const result: DiffResult<T> = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
    };

    const allKeys = new Set([...oldSnapshot.keys(), ...newSnapshot.keys()]);

    for (const key of allKeys) {
      const oldValue = oldSnapshot.get(key);
      const newValue = newSnapshot.get(key);

      if (oldValue === undefined && newValue !== undefined) {
        result.added.push({ key, value: newValue });
      } else if (oldValue !== undefined && newValue === undefined) {
        result.deleted.push({ key, value: oldValue });
      } else if (oldValue !== undefined && newValue !== undefined) {
        const oldChecksum = this.calculateChecksum(oldValue);
        const newChecksum = this.calculateChecksum(newValue);
        
        if (oldChecksum !== newChecksum) {
          result.modified.push({ key, oldValue, newValue });
        } else {
          result.unchanged.push({ key, value: newValue });
        }
      }
    }

    return result;
  }

  /**
   * Create a snapshot of current data
   */
  public async createSnapshot(): Promise<Map<string, T>> {
    this.ensureInitialized();

    const snapshot = new Map<string, T>();
    
    // Flush write buffer first
    await this.flushWriteBuffer();

    // Collect all keys
    for (const key of this.index.keys()) {
      try {
        const value = await this.get(key);
        if (value !== null) {
          snapshot.set(key, value);
        }
      } catch (error) {
        this.logDebug(`Failed to read key ${key} for snapshot: ${error}`);
      }
    }

    return snapshot;
  }

  /**
   * Begin a transaction
   */
  public beginTransaction(isolated: boolean = true): string {
    this.ensureInitialized();

    const transactionId = this.generateTransactionId();
    const transaction: Transaction = {
      id: transactionId,
      startTime: Date.now(),
      operations: [],
      isolated,
      status: 'active',
    };

    this.transactions.set(transactionId, transaction);
    return transactionId;
  }

  /**
   * Commit a transaction
   */
  public async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'active') {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    try {
      // Apply all operations
      for (const op of transaction.operations) {
        switch (op.type) {
          case 'put':
            await this.put(op.key, op.value);
            break;
          case 'delete':
            await this.delete(op.key);
            break;
        }
      }

      transaction.status = 'committed';
      this.metrics.transactionsCommitted++;
    } catch (error) {
      transaction.status = 'aborted';
      this.metrics.transactionsAborted++;
      throw error;
    } finally {
      this.transactions.delete(transactionId);
    }
  }

  /**
   * Abort a transaction
   */
  public abortTransaction(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (transaction) {
      transaction.status = 'aborted';
      this.metrics.transactionsAborted++;
      this.transactions.delete(transactionId);
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): DataStoreMetrics {
    return { ...this.metrics };
  }

  /**
   * Compact the data store
   */
  public async compact(): Promise<void> {
    if (this.isCompacting) return;

    this.isCompacting = true;
    try {
      await this.flushWriteBuffer();
      await this.rebuildDataFile();
      await this.saveIndex();
      this.metrics.lastCompactionTime = Date.now();
    } finally {
      this.isCompacting = false;
    }
  }

  /**
   * Close the data store
   */
  public async close(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Flush any pending writes
      await this.flushWriteBuffer();

      // Save index
      await this.saveIndex();

      // Clear caches
      this.index.clear();
      this.memoryCache.clear();
      this.writeBuffer.clear();

      this.isInitialized = false;
    } catch (error) {
      throw new Error(`Close operation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Private methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('DataStore not initialized. Call initialize() first.');
    }
  }

  private initializeMetrics(): DataStoreMetrics {
    return {
      totalKeys: 0,
      totalSize: 0,
      indexSize: 0,
      hitRate: 0,
      averageResponseTime: 0,
      transactionsCommitted: 0,
      transactionsAborted: 0,
      lastCompactionTime: 0,
      compressionRatio: 1.0,
    };
  }

  private calculateChecksum(value: any): string {
    const serialized = JSON.stringify(value);
    return createHash('sha256').update(serialized).digest('hex');
  }

  private getNextVersion(key: string): number {
    const existing = this.index.get(key);
    return existing ? existing.version + 1 : 1;
  }

  private async writeEntry(entry: DataEntry<T>): Promise<void> {
    const serialized = JSON.stringify(entry);
    const offset = await this.appendToDataFile(serialized);
    
    const indexEntry: IndexEntry = {
      key: entry.key,
      offset,
      size: Buffer.byteLength(serialized, 'utf8'),
      timestamp: entry.timestamp,
      version: entry.version,
      checksum: entry.checksum,
    };

    this.index.set(entry.key, indexEntry);

    if (this.config.enableWAL) {
      await this.writeToWAL({ type: 'put', key: entry.key, value: entry.value, timestamp: entry.timestamp });
    }
  }

  private async readEntry(indexEntry: IndexEntry): Promise<DataEntry<T>> {
    const data = await readFile(this.dataFile, { encoding: 'utf8' });
    const entryData = data.substring(indexEntry.offset, indexEntry.offset + indexEntry.size);
    return JSON.parse(entryData);
  }

  private async appendToDataFile(data: string): Promise<number> {
    try {
      const stats = await stat(this.dataFile);
      const offset = stats.size;
      
      await writeFile(this.dataFile, data + '\n', { flag: 'a', encoding: 'utf8' });
      return offset;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        await writeFile(this.dataFile, data + '\n', { encoding: 'utf8' });
        return 0;
      }
      throw error;
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const data = await readFile(this.indexFile, 'utf8');
      const indexData = JSON.parse(data) as IndexEntry[];
      
      for (const entry of indexData) {
        this.index.set(entry.key, entry);
      }

      this.metrics.totalKeys = this.index.size;
      this.metrics.indexSize = Buffer.byteLength(data, 'utf8');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logDebug(`Failed to load index: ${error.message}`);
      }
    }
  }

  private async saveIndex(): Promise<void> {
    const indexData = Array.from(this.index.values());
    const serialized = JSON.stringify(indexData, null, 2);
    await writeFile(this.indexFile, serialized, 'utf8');
    this.metrics.indexSize = Buffer.byteLength(serialized, 'utf8');
  }

  private async flushWriteBuffer(): Promise<void> {
    if (this.writeBuffer.size === 0) return;

    const entries = Array.from(this.writeBuffer.values());
    this.writeBuffer.clear();

    for (const entry of entries) {
      await this.writeEntry(entry);
    }
  }

  private async writeToWAL(operation: TransactionOperation): Promise<void> {
    const logEntry = JSON.stringify(operation) + '\n';
    await writeFile(this.walFile, logEntry, { flag: 'a', encoding: 'utf8' });
  }

  private async recoverFromWAL(): Promise<void> {
    try {
      const walData = await readFile(this.walFile, 'utf8');
      const lines = walData.trim().split('\n').filter(line => line.length > 0);

      for (const line of lines) {
        try {
          const operation = JSON.parse(line) as TransactionOperation;
          
          switch (operation.type) {
            case 'put':
              if (operation.value !== undefined) {
                await this.put(operation.key, operation.value);
              }
              break;
            case 'delete':
              await this.delete(operation.key);
              break;
          }
        } catch (error) {
          this.logDebug(`Failed to recover WAL operation: ${error}`);
        }
      }

      // Clear WAL after recovery
      await unlink(this.walFile);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logDebug(`WAL recovery failed: ${error.message}`);
      }
    }
  }

  private startBackgroundTasks(): void {
    // Periodic index flush
    setInterval(async () => {
      try {
        await this.flushWriteBuffer();
      } catch (error) {
        this.logDebug(`Background flush failed: ${error}`);
      }
    }, this.config.indexFlushInterval);

    // Periodic compaction
    if (this.config.enableAutoCompaction) {
      setInterval(async () => {
        try {
          if (this.shouldCompact()) {
            await this.compact();
          }
        } catch (error) {
          this.logDebug(`Background compaction failed: ${error}`);
        }
      }, this.config.checkpointInterval);
    }
  }

  private shouldCompact(): boolean {
    // Simple heuristic: compact if fragmentation is above threshold
    const totalEntries = this.index.size;
    const memoryEntries = this.memoryCache.size;
    const fragmentation = totalEntries > 0 ? 1 - (memoryEntries / totalEntries) : 0;
    
    return fragmentation > this.config.compactionThreshold;
  }

  private async rebuildDataFile(): Promise<void> {
    const tempFile = this.dataFile + '.tmp';
    let offset = 0;

    try {
      // Write all current entries to temp file
      for (const [key, indexEntry] of this.index.entries()) {
        try {
          const entry = await this.readEntry(indexEntry);
          const serialized = JSON.stringify(entry);
          
          await writeFile(tempFile, serialized + '\n', { flag: 'a', encoding: 'utf8' });
          
          // Update index with new offset
          indexEntry.offset = offset;
          indexEntry.size = Buffer.byteLength(serialized, 'utf8');
          offset += indexEntry.size + 1; // +1 for newline
        } catch (error) {
          this.logDebug(`Failed to rebuild entry for key ${key}: ${error}`);
          this.index.delete(key);
        }
      }

      // Replace original file
      await unlink(this.dataFile);
      await writeFile(this.dataFile, await readFile(tempFile, 'utf8'));
      await unlink(tempFile);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  private sortKeys(keys: string[], sortBy: string, order: string = 'asc'): string[] {
    return keys.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'key':
          comparison = a.localeCompare(b);
          break;
        case 'timestamp':
          const aEntry = this.index.get(a);
          const bEntry = this.index.get(b);
          comparison = (aEntry?.timestamp || 0) - (bEntry?.timestamp || 0);
          break;
        case 'version':
          const aVer = this.index.get(a);
          const bVer = this.index.get(b);
          comparison = (aVer?.version || 0) - (bVer?.version || 0);
          break;
      }
      
      return order === 'desc' ? -comparison : comparison;
    });
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private updateMetrics(operation: string, duration: number, success: boolean = true): void {
    // Update response time
    const count = this.metrics.transactionsCommitted + this.metrics.transactionsAborted + 1;
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime * (count - 1) + duration) / count;

    // Update hit rate for get operations
    if (operation === 'get') {
      const totalGets = (this.metrics as any).totalGets || 0;
      const hits = (this.metrics as any).hits || 0;
      
      (this.metrics as any).totalGets = totalGets + 1;
      (this.metrics as any).hits = hits + (success ? 1 : 0);
      
      this.metrics.hitRate = (this.metrics as any).hits / (this.metrics as any).totalGets;
    }

    // Update total keys
    this.metrics.totalKeys = this.index.size;
  }

  private logDebug(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[IndexedDataStore] ${message}`);
    }
  }
}

/**
 * Factory function to create an IndexedDataStore instance
 */
export function createIndexedDataStore<T = any>(config: Partial<DataStoreConfig> = {}): IndexedDataStore<T> {
  return new IndexedDataStore<T>(config);
}

/**
 * Utility function to validate data store configuration
 */
export function validateDataStoreConfig(config: unknown): DataStoreConfig {
  return DataStoreConfigSchema.parse(config);
}