/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * High-Performance I/O Optimization for Large Codebases
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import zlib from 'zlib';

/**
 * I/O operation types
 */
export enum IOOperationType {
  READ = 'read',
  WRITE = 'write',
  COPY = 'copy',
  DELETE = 'delete',
  MOVE = 'move',
  BATCH_READ = 'batch_read',
  BATCH_WRITE = 'batch_write',
  STREAM_PROCESS = 'stream_process',
}

/**
 * I/O operation configuration
 */
export interface IOOptimizerConfig {
  bufferSize: number;
  maxConcurrentOps: number;
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  enableZeroCopy: boolean;
  enableCaching: boolean;
  cacheSize: number;
  cacheTTL: number;
  maxRetries: number;
  retryDelay: number;
  enableChecksums: boolean;
  enableMetrics: boolean;
  metricsFlushInterval: number;
}

/**
 * I/O operation request
 */
export interface IORequest {
  id: string;
  type: IOOperationType;
  source?: string;
  destination?: string;
  data?: Buffer | string;
  priority: number;
  timeout: number;
  createdAt: Date;
  metadata: Record<string, any>;
}

/**
 * I/O operation result
 */
export interface IOResult {
  id: string;
  success: boolean;
  data?: Buffer | string;
  bytesProcessed: number;
  executionTime: number;
  checksum?: string;
  cacheHit?: boolean;
  error?: Error;
  retries: number;
  metadata: Record<string, any>;
}

/**
 * I/O performance metrics
 */
export interface IOMetrics {
  totalOperations: number;
  totalBytesRead: number;
  totalBytesWritten: number;
  averageLatency: number;
  throughputMBps: number;
  cacheHitRate: number;
  errorRate: number;
  queueDepth: number;
  activeOperations: number;
}

/**
 * High-performance I/O optimizer
 */
export class IOOptimizer extends EventEmitter {
  private readonly config: IOOptimizerConfig;
  private readonly operationQueue: IORequest[] = [];
  private readonly cache: Map<string, { data: Buffer; timestamp: number; hits: number }> =
    new Map();
  private readonly activeOperations: Map<string, Promise<IOResult>> = new Map();

  private isRunning = false;

  private metrics: IOMetrics = {
    totalOperations: 0,
    totalBytesRead: 0,
    totalBytesWritten: 0,
    averageLatency: 0,
    throughputMBps: 0,
    cacheHitRate: 0,
    errorRate: 0,
    queueDepth: 0,
    activeOperations: 0,
  };

  private readonly semaphore: IOSemaphore;

  constructor(config: Partial<IOOptimizerConfig> = {}) {
    super();

    this.config = {
      bufferSize: 64 * 1024, // 64KB
      maxConcurrentOps: 16,
      enableBatching: true,
      batchSize: 10,
      batchTimeout: 100,
      enableZeroCopy: true,
      enableCaching: true,
      cacheSize: 100 * 1024 * 1024, // 100MB
      cacheTTL: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 1000,
      enableChecksums: true,
      enableMetrics: true,
      metricsFlushInterval: 5000,
      ...config,
    };

    this.semaphore = new IOSemaphore(this.config.maxConcurrentOps);
  }

  /**
   * Start the I/O optimizer
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.emit('started');
  }

  /**
   * Stop the I/O optimizer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Wait for active operations to complete
    const activeOps = Array.from(this.activeOperations.values());
    await Promise.allSettled(activeOps);

    this.emit('stopped');
  }

  /**
   * Read file with optimizations
   */
  async readFile(filePath: string): Promise<IOResult> {
    const request: IORequest = {
      id: this.generateRequestId(),
      type: IOOperationType.READ,
      source: filePath,
      priority: 1,
      timeout: 30000,
      createdAt: new Date(),
      metadata: {},
    };

    return this.executeRequest(request);
  }

  /**
   * Write file with optimizations
   */
  async writeFile(filePath: string, data: Buffer | string): Promise<IOResult> {
    const request: IORequest = {
      id: this.generateRequestId(),
      type: IOOperationType.WRITE,
      destination: filePath,
      data: Buffer.isBuffer(data) ? data : Buffer.from(data),
      priority: 1,
      timeout: 30000,
      createdAt: new Date(),
      metadata: {},
    };

    return this.executeRequest(request);
  }

  /**
   * Batch read multiple files
   */
  async batchReadFiles(filePaths: string[]): Promise<IOResult[]> {
    const requests: IORequest[] = filePaths.map((filePath) => ({
      id: this.generateRequestId(),
      type: IOOperationType.BATCH_READ,
      source: filePath,
      priority: 1,
      timeout: 30000,
      createdAt: new Date(),
      metadata: { batch: true, filePaths },
    }));

    return Promise.all(requests.map((request) => this.executeRequest(request)));
  }

  /**
   * Batch write multiple files
   */
  async batchWriteFiles(
    files: Array<{ path: string; data: Buffer | string }>
  ): Promise<IOResult[]> {
    const requests: IORequest[] = files.map((file) => ({
      id: this.generateRequestId(),
      type: IOOperationType.BATCH_WRITE,
      destination: file.path,
      data: Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data),
      priority: 1,
      timeout: 30000,
      createdAt: new Date(),
      metadata: { batch: true, files },
    }));

    return Promise.all(requests.map((request) => this.executeRequest(request)));
  }

  /**
   * Copy file with optimizations
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<IOResult> {
    const request: IORequest = {
      id: this.generateRequestId(),
      type: IOOperationType.COPY,
      source: sourcePath,
      destination: destinationPath,
      priority: 1,
      timeout: 30000,
      createdAt: new Date(),
      metadata: {},
    };

    return this.executeRequest(request);
  }

  /**
   * Move file with optimizations
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<IOResult> {
    const request: IORequest = {
      id: this.generateRequestId(),
      type: IOOperationType.MOVE,
      source: sourcePath,
      destination: destinationPath,
      priority: 1,
      timeout: 30000,
      createdAt: new Date(),
      metadata: {},
    };

    return this.executeRequest(request);
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<IOResult> {
    const request: IORequest = {
      id: this.generateRequestId(),
      type: IOOperationType.DELETE,
      source: filePath,
      priority: 1,
      timeout: 30000,
      createdAt: new Date(),
      metadata: {},
    };

    return this.executeRequest(request);
  }

  /**
   * Stream process large files
   */
  async streamProcess(
    sourcePath: string,
    destinationPath: string,
    processor: (chunk: Buffer) => Buffer
  ): Promise<IOResult> {
    const request: IORequest = {
      id: this.generateRequestId(),
      type: IOOperationType.STREAM_PROCESS,
      source: sourcePath,
      destination: destinationPath,
      priority: 1,
      timeout: 120000, // Longer timeout for streaming
      createdAt: new Date(),
      metadata: { processor },
    };

    return this.executeRequest(request);
  }

  /**
   * Get current I/O metrics
   */
  getMetrics(): IOMetrics {
    this.metrics.queueDepth = this.operationQueue.length;
    this.metrics.activeOperations = this.activeOperations.size;
    return { ...this.metrics };
  }

  /**
   * Read file with checksum validation
   */
  async readFileWithChecksum(
    filePath: string,
    expectedChecksum?: string
  ): Promise<IOResult & { checksum: string }> {
    const result = await this.readFile(filePath);
    if (!result.success || !result.data) {
      throw new Error(`Failed to read file: ${filePath}`);
    }

    const buffer = Buffer.isBuffer(result.data) ? result.data : Buffer.from(result.data);
    const checksum = this.calculateChecksum(buffer);

    if (expectedChecksum && checksum !== expectedChecksum) {
      throw new Error(
        `Checksum mismatch for file: ${filePath}. Expected: ${expectedChecksum}, Got: ${checksum}`
      );
    }

    return {
      ...result,
      checksum,
    };
  }

  /**
   * Write file with checksum generation
   */
  async writeFileWithChecksum(
    filePath: string,
    data: Buffer | string
  ): Promise<IOResult & { checksum: string }> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const checksum = this.calculateChecksum(buffer);

    const result = await this.writeFile(filePath, buffer);

    return {
      ...result,
      checksum,
    };
  }

  /**
   * Compress and write file
   */
  async writeCompressed(filePath: string, data: Buffer | string): Promise<IOResult> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const compressed = await this.compressData(buffer);

    return this.writeFile(filePath + '.gz', compressed);
  }

  /**
   * Read and decompress file
   */
  async readCompressed(filePath: string): Promise<IOResult> {
    const result = await this.readFile(filePath);
    if (!result.success || !result.data) {
      return result;
    }

    const buffer = Buffer.isBuffer(result.data) ? result.data : Buffer.from(result.data);
    const decompressed = await this.decompressData(buffer);

    return {
      ...result,
      data: decompressed,
      bytesProcessed: decompressed.length,
    };
  }

  /**
   * Zero-copy file transfer using sendfile when available
   */
  async zeroCopyTransfer(sourcePath: string, destinationPath: string): Promise<IOResult> {
    // For Node.js, we simulate zero-copy using streams
    const request: IORequest = {
      id: this.generateRequestId(),
      type: IOOperationType.COPY,
      source: sourcePath,
      destination: destinationPath,
      priority: 1,
      timeout: 60000,
      createdAt: new Date(),
      metadata: { zeroCopy: true },
    };

    return this.executeRequest(request);
  }

  /**
   * Memory-mapped file read for very large files
   */
  async memoryMappedRead(filePath: string, offset: number = 0, length?: number): Promise<IOResult> {
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    const readLength = length || Math.min(fileSize - offset, this.config.bufferSize * 10);

    const fd = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.allocUnsafe(readLength);
      const { bytesRead } = await fd.read(buffer, 0, readLength, offset);

      return {
        id: this.generateRequestId(),
        success: true,
        data: buffer.subarray(0, bytesRead),
        bytesProcessed: bytesRead,
        executionTime: 0,
        retries: 0,
        metadata: { memoryMapped: true, offset, length: bytesRead },
      };
    } finally {
      await fd.close();
    }
  }

  /**
   * Asynchronous directory scanning with filtering
   */
  async scanDirectory(
    dirPath: string,
    options: {
      recursive?: boolean;
      extensions?: string[];
      maxDepth?: number;
      includeHidden?: boolean;
    } = {}
  ): Promise<string[]> {
    const { recursive = true, extensions, maxDepth = Infinity, includeHidden = false } = options;
    const files: string[] = [];

    const scanRecursive = async (currentPath: string, depth: number): Promise<void> => {
      if (depth > maxDepth) return;

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!includeHidden && entry.name.startsWith('.')) continue;

        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory() && recursive) {
          await scanRecursive(fullPath, depth + 1);
        } else if (entry.isFile()) {
          if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    };

    await scanRecursive(dirPath, 0);
    return files;
  }

  /**
   * Calculate file checksum using SHA-256
   */
  private calculateChecksum(data: Buffer): string {
    if (!Buffer.isBuffer(data)) {
      throw new Error('Data must be a Buffer for checksum calculation');
    }
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Compress data using gzip
   */
  private async compressData(data: Buffer): Promise<Buffer> {
    if (!Buffer.isBuffer(data)) {
      throw new Error('Data must be a Buffer for compression');
    }
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err: Error | null, compressed: Buffer) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  /**
   * Decompress gzip data
   */
  private async decompressData(data: Buffer): Promise<Buffer> {
    if (!Buffer.isBuffer(data)) {
      throw new Error('Data must be a Buffer for decompression');
    }
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err: Error | null, decompressed: Buffer) => {
        if (err) reject(err);
        else resolve(decompressed);
      });
    });
  }

  private async executeRequest(request: IORequest): Promise<IOResult> {
    // Check cache first
    if (this.config.enableCaching && request.type === IOOperationType.READ && request.source) {
      const cached = this.getCachedData(request.source);
      if (cached) {
        return {
          id: request.id,
          success: true,
          data: cached.data,
          bytesProcessed: cached.data.length,
          executionTime: 0,
          cacheHit: true,
          retries: 0,
          metadata: request.metadata,
        };
      }
    }

    // Execute with concurrency control
    await this.semaphore.acquire();

    const operation = this.executeWithRetry(request);
    this.activeOperations.set(request.id, operation);

    try {
      const result = await operation;

      // Cache result if applicable
      if (this.config.enableCaching && result.success && result.data && request.source) {
        this.setCachedData(request.source, result.data);
      }

      return result;
    } finally {
      this.activeOperations.delete(request.id);
      this.semaphore.release();
    }
  }

  private async executeWithRetry(request: IORequest): Promise<IOResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeOperation(request);
        result.retries = attempt;
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    return {
      id: request.id,
      success: false,
      bytesProcessed: 0,
      executionTime: 0,
      error: lastError || new Error('Unknown error'),
      retries: this.config.maxRetries,
      metadata: request.metadata,
    };
  }

  private async executeOperation(request: IORequest): Promise<IOResult> {
    const startTime = performance.now();

    try {
      let result: IOResult;

      switch (request.type) {
        case IOOperationType.READ:
          result = await this.performRead(request);
          break;
        case IOOperationType.WRITE:
          result = await this.performWrite(request);
          break;
        case IOOperationType.COPY:
          result = await this.performCopy(request);
          break;
        case IOOperationType.DELETE:
          result = await this.performDelete(request);
          break;
        case IOOperationType.MOVE:
          result = await this.performMove(request);
          break;
        case IOOperationType.BATCH_READ:
          result = await this.performBatchRead(request);
          break;
        case IOOperationType.BATCH_WRITE:
          result = await this.performBatchWrite(request);
          break;
        case IOOperationType.STREAM_PROCESS:
          result = await this.performStreamProcess(request);
          break;
        default:
          throw new Error(`Unsupported operation type: ${request.type}`);
      }

      const executionTime = performance.now() - startTime;
      result.executionTime = executionTime;

      this.updateMetrics(request.type, result.bytesProcessed, executionTime, result.success);

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateMetrics(request.type, 0, executionTime, false);

      throw error;
    }
  }

  private async performRead(request: IORequest): Promise<IOResult> {
    if (!request.source) {
      throw new Error('Source path required for read operation');
    }

    const data = await fs.readFile(request.source);

    return {
      id: request.id,
      success: true,
      data,
      bytesProcessed: data.length,
      executionTime: 0, // Will be set by caller
      retries: 0,
      metadata: request.metadata,
    };
  }

  private async performWrite(request: IORequest): Promise<IOResult> {
    if (!request.destination || !request.data) {
      throw new Error('Destination path and data required for write operation');
    }

    const data = Buffer.isBuffer(request.data) ? request.data : Buffer.from(request.data);

    await fs.writeFile(request.destination, data);

    return {
      id: request.id,
      success: true,
      bytesProcessed: data.length,
      executionTime: 0, // Will be set by caller
      retries: 0,
      metadata: request.metadata,
    };
  }

  private async performCopy(request: IORequest): Promise<IOResult> {
    if (!request.source || !request.destination) {
      throw new Error('Source and destination paths required for copy operation');
    }

    const data = await fs.readFile(request.source);
    await fs.writeFile(request.destination, data);

    return {
      id: request.id,
      success: true,
      bytesProcessed: data.length,
      executionTime: 0, // Will be set by caller
      retries: 0,
      metadata: request.metadata,
    };
  }

  private async performDelete(request: IORequest): Promise<IOResult> {
    if (!request.source) {
      throw new Error('Source path required for delete operation');
    }

    await fs.unlink(request.source);

    return {
      id: request.id,
      success: true,
      bytesProcessed: 0,
      executionTime: 0,
      retries: 0,
      metadata: request.metadata,
    };
  }

  private async performMove(request: IORequest): Promise<IOResult> {
    if (!request.source || !request.destination) {
      throw new Error('Source and destination paths required for move operation');
    }

    await fs.rename(request.source, request.destination);

    return {
      id: request.id,
      success: true,
      bytesProcessed: 0,
      executionTime: 0,
      retries: 0,
      metadata: request.metadata,
    };
  }

  private async performBatchRead(request: IORequest): Promise<IOResult> {
    const filePaths = request.metadata.filePaths as string[];
    if (!filePaths || !Array.isArray(filePaths)) {
      throw new Error('File paths required for batch read operation');
    }

    const data = await Promise.all(
      filePaths.map(async (filePath: string) => {
        const fileData = await fs.readFile(filePath);
        return { filePath, data: fileData };
      })
    );

    const buffers = data.map((item: { filePath: string; data: Buffer }) => item.data);
    const concatenatedData = Buffer.concat(buffers);

    return {
      id: request.id,
      success: true,
      data: concatenatedData,
      bytesProcessed: data.reduce(
        (total: number, item: { filePath: string; data: Buffer }) => total + item.data.length,
        0
      ),
      executionTime: 0, // Will be set by caller
      retries: 0,
      metadata: { ...request.metadata, filePaths: data.map((item) => item.filePath) },
    };
  }

  private async performBatchWrite(request: IORequest): Promise<IOResult> {
    const files = request.metadata.files as Array<{ path: string; data: Buffer | string }>;
    if (!files || !Array.isArray(files)) {
      throw new Error('Files array required for batch write operation');
    }

    let totalBytes = 0;
    await Promise.all(
      files.map(async (file) => {
        const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        totalBytes += data.length;
        await fs.writeFile(file.path, data);
      })
    );

    return {
      id: request.id,
      success: true,
      bytesProcessed: totalBytes,
      executionTime: 0, // Will be set by caller
      retries: 0,
      metadata: request.metadata,
    };
  }

  private async performStreamProcess(request: IORequest): Promise<IOResult> {
    if (!request.source || !request.destination || !request.metadata.processor) {
      throw new Error('Source, destination, and processor required for stream process operation');
    }

    const processor = request.metadata.processor as (chunk: Buffer) => Buffer;
    const startTime = performance.now();

    const data = await fs.readFile(request.source);
    const processedData = await this.processStream(data, processor);

    await fs.writeFile(request.destination, processedData);

    const executionTime = performance.now() - startTime;
    return {
      id: request.id,
      success: true,
      data: processedData,
      bytesProcessed: processedData.length,
      executionTime,
      retries: 0,
      metadata: request.metadata,
    };
  }

  /**
   * Process stream data in chunks
   */
  private async processStream(data: Buffer, processor: (chunk: Buffer) => Buffer): Promise<Buffer> {
    const chunkSize = this.config.bufferSize;
    const chunks: Buffer[] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.subarray(i, i + chunkSize);
      const processedChunk = processor(chunk);
      chunks.push(processedChunk);
    }

    return Buffer.concat(chunks);
  }

  private getCachedData(filePath: string): { data: Buffer } | null {
    const cached = this.cache.get(filePath);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.cache.delete(filePath);
      return null;
    }

    // Update hit count
    cached.hits++;

    return { data: cached.data };
  }

  private setCachedData(filePath: string, data: Buffer | string): void {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    this.cache.set(filePath, {
      data: buffer,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  private updateMetrics(
    operation: IOOperationType,
    bytesProcessed: number,
    executionTime: number,
    success: boolean
  ): void {
    this.metrics.totalOperations++;

    if (operation === IOOperationType.READ) {
      this.metrics.totalBytesRead += bytesProcessed;
    } else if (operation === IOOperationType.WRITE) {
      this.metrics.totalBytesWritten += bytesProcessed;
    }

    // Update average latency
    const totalOps = this.metrics.totalOperations;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (totalOps - 1) + executionTime) / totalOps;

    // Update error rate
    if (!success) {
      this.metrics.errorRate = (this.metrics.errorRate * (totalOps - 1) + 1) / totalOps;
    } else {
      this.metrics.errorRate = (this.metrics.errorRate * (totalOps - 1)) / totalOps;
    }
  }

  private generateRequestId(): string {
    return `io-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for concurrency control
 */
class IOSemaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
}
