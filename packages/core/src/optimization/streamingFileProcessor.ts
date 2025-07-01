/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform, Readable, Writable } from 'stream';
import { createGzip, createGunzip } from 'zlib';
import { join, dirname } from 'path';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { MetricsCollector } from '../metrics/collector.js';

/**
 * Streaming file processor configuration schema
 */
export const StreamingFileConfigSchema = z.object({
  // Streaming configuration
  streaming: z.object({
    highWaterMark: z.number().min(1024).max(1024 * 1024).default(64 * 1024), // 64KB
    encoding: z.string().default('utf8'),
    enableBackpressure: z.boolean().default(true),
    maxConcurrentStreams: z.number().min(1).max(100).default(16),
  }).default({}),

  // Compression configuration
  compression: z.object({
    enabled: z.boolean().default(true),
    algorithm: z.enum(['gzip', 'deflate', 'brotli']).default('gzip'),
    level: z.number().min(1).max(9).default(6),
    threshold: z.number().min(0).default(1024), // Compress files larger than 1KB
  }).default({}),

  // Chunked processing
  chunking: z.object({
    enabled: z.boolean().default(true),
    chunkSize: z.number().min(1024).max(10 * 1024 * 1024).default(256 * 1024), // 256KB
    overlap: z.number().min(0).max(0.5).default(0.1), // 10% overlap between chunks
    enableParallelChunks: z.boolean().default(true),
  }).default({}),

  // Caching configuration
  caching: z.object({
    enabled: z.boolean().default(true),
    maxSize: z.number().min(1).max(1000).default(100), // MB
    ttl: z.number().min(1000).max(24 * 60 * 60 * 1000).default(5 * 60 * 1000), // 5 minutes
    persistToDisk: z.boolean().default(false),
    cacheDirectory: z.string().default('.cache/streaming'),
  }).default({}),

  // Zero-copy optimization
  zeroCopy: z.object({
    enabled: z.boolean().default(true),
    useSendfile: z.boolean().default(true),
    enableMemoryMapping: z.boolean().default(false), // Experimental
    mmapThreshold: z.number().min(1024).default(10 * 1024 * 1024), // 10MB
  }).default({}),

  // Error handling and recovery
  errorHandling: z.object({
    maxRetries: z.number().min(0).max(10).default(3),
    retryDelay: z.number().min(100).max(10000).default(1000),
    enablePartialRecovery: z.boolean().default(true),
    skipCorruptedChunks: z.boolean().default(false),
  }).default({}),

  // Performance monitoring
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    metricsInterval: z.number().min(1000).max(60000).default(5000),
    trackThroughput: z.boolean().default(true),
    trackLatency: z.boolean().default(true),
  }).default({}),
});

export type StreamingFileConfig = z.infer<typeof StreamingFileConfigSchema>;

/**
 * Stream processing task definition
 */
export interface StreamProcessingTask<TInput = any, TOutput = any> {
  id: string;
  input: TInput;
  transform: (chunk: Buffer, metadata: ChunkMetadata) => Promise<Buffer | null>;
  validate?: (chunk: Buffer) => boolean;
  onProgress?: (progress: StreamProgress) => void;
  onComplete?: (result: TOutput) => void;
  onError?: (error: Error) => void;
}

/**
 * Chunk metadata for tracking processing context
 */
export interface ChunkMetadata {
  index: number;
  offset: number;
  size: number;
  isFirst: boolean;
  isLast: boolean;
  totalChunks: number;
  timestamp: number;
}

/**
 * Stream processing progress information
 */
export interface StreamProgress {
  taskId: string;
  bytesProcessed: number;
  totalBytes: number;
  chunksProcessed: number;
  totalChunks: number;
  throughput: number; // bytes per second
  elapsedTime: number;
  estimatedTimeRemaining: number;
}

/**
 * Cache entry for streaming operations
 */
interface StreamCacheEntry {
  data: Buffer;
  metadata: {
    size: number;
    checksum: string;
    lastAccessed: number;
    compressionType?: string;
  };
}

/**
 * High-performance streaming file processor
 */
export class StreamingFileProcessor extends EventEmitter {
  private config: StreamingFileConfig;
  private activeStreams = new Map<string, AbortController>();
  private streamCache = new Map<string, StreamCacheEntry>();
  private metricsCollector?: MetricsCollector;
  private streamPool: Set<Readable> = new Set();
  private throughputMetrics = {
    totalBytes: 0,
    startTime: Date.now(),
    operationCount: 0,
  };

  constructor(config: Partial<StreamingFileConfig> = {}, metricsCollector?: MetricsCollector) {
    super();
    this.config = StreamingFileConfigSchema.parse(config);
    this.metricsCollector = metricsCollector;

    this.setupCacheDirectory();
    this.startMetricsCollection();
  }

  /**
   * Process file using streaming with transformation
   */
  async processFileStream<TOutput = Buffer>(
    inputPath: string,
    outputPath: string,
    transform: (chunk: Buffer, metadata: ChunkMetadata) => Promise<Buffer | null>,
    options: {
      validate?: (chunk: Buffer) => boolean;
      compress?: boolean;
      enableZeroCopy?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    totalBytes: number;
    chunksProcessed: number;
    throughput: number;
    result?: TOutput;
    error?: Error;
  }> {
    const taskId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    let totalBytes = 0;
    let chunksProcessed = 0;
    
    try {
      // Check cache first
      const cachedResult = await this.checkCache(inputPath);
      if (cachedResult) {
        return {
          success: true,
          totalBytes: cachedResult.metadata.size,
          chunksProcessed: 1,
          throughput: cachedResult.metadata.size / ((Date.now() - startTime) / 1000),
          result: cachedResult.data as TOutput,
        };
      }

      const abortController = new AbortController();
      this.activeStreams.set(taskId, abortController);

      // Get file stats
      const stats = await fs.stat(inputPath);
      const fileSize = stats.size;
      
      // Ensure output directory exists
      await fs.mkdir(dirname(outputPath), { recursive: true });

      // Create input stream
      const inputStream = createReadStream(inputPath, {
        highWaterMark: this.config.streaming.highWaterMark,
        signal: abortController.signal,
      });

      // Create output stream
      const outputStream = createWriteStream(outputPath, {
        highWaterMark: this.config.streaming.highWaterMark,
      });

      // Optional compression
      const streams: NodeJS.ReadWriteStream[] = [];
      if (options.compress && this.config.compression.enabled && fileSize > this.config.compression.threshold) {
        streams.push(createGzip({ level: this.config.compression.level }));
      }

      // Create transform stream
      const transformStream = new Transform({
        highWaterMark: this.config.streaming.highWaterMark,
        objectMode: false,
        async transform(chunk: Buffer, encoding, callback) {
          try {
            const metadata: ChunkMetadata = {
              index: chunksProcessed,
              offset: totalBytes,
              size: chunk.length,
              isFirst: chunksProcessed === 0,
              isLast: false, // Will be determined later
              totalChunks: Math.ceil(fileSize / this.readableHighWaterMark),
              timestamp: Date.now(),
            };

            // Validate chunk if validator provided
            if (options.validate && !options.validate(chunk)) {
              if (this.config.errorHandling.skipCorruptedChunks) {
                callback(null, null); // Skip corrupted chunk
                return;
              } else {
                callback(new Error(`Invalid chunk at offset ${totalBytes}`));
                return;
              }
            }

            const transformedChunk = await transform(chunk, metadata);
            
            if (transformedChunk) {
              totalBytes += chunk.length;
              chunksProcessed++;
              
              // Emit progress
              this.emit('progress', {
                taskId,
                bytesProcessed: totalBytes,
                totalBytes: fileSize,
                chunksProcessed,
                totalChunks: metadata.totalChunks,
                throughput: totalBytes / ((Date.now() - startTime) / 1000),
                elapsedTime: Date.now() - startTime,
                estimatedTimeRemaining: ((fileSize - totalBytes) / (totalBytes / ((Date.now() - startTime) / 1000))) || 0,
              });
              
              callback(null, transformedChunk);
            } else {
              callback(null, null); // Filtered out
            }
          } catch (error) {
            callback(error);
          }
        },
      });

      streams.push(transformStream);

      // Execute pipeline
      await pipeline(
        inputStream,
        ...streams,
        outputStream,
        { signal: abortController.signal }
      );

      // Cache result if enabled
      if (this.config.caching.enabled && totalBytes < this.config.caching.maxSize * 1024 * 1024) {
        await this.cacheResult(inputPath, await fs.readFile(outputPath), {
          size: totalBytes,
          checksum: await this.calculateChecksum(inputPath),
          lastAccessed: Date.now(),
          compressionType: options.compress ? this.config.compression.algorithm : undefined,
        });
      }

      // Update metrics
      this.updateThroughputMetrics(totalBytes);
      
      if (this.metricsCollector) {
        this.metricsCollector.recordPerformance('streaming_file_processor', {
          duration: Date.now() - startTime,
          memory: process.memoryUsage().heapUsed / 1024 / 1024,
          cpu: 0, // Would need process.cpuUsage()
          stage: 'stream_processing',
          operationName: 'processFileStream',
        });
      }

      return {
        success: true,
        totalBytes,
        chunksProcessed,
        throughput: totalBytes / ((Date.now() - startTime) / 1000),
      };

    } catch (error) {
      this.emit('error', { taskId, error });
      
      return {
        success: false,
        totalBytes,
        chunksProcessed,
        throughput: 0,
        error: error as Error,
      };
    } finally {
      this.activeStreams.delete(taskId);
    }
  }

  /**
   * Process multiple files concurrently with streaming
   */
  async processMultipleFiles<TOutput = Buffer>(
    tasks: Array<{
      inputPath: string;
      outputPath: string;
      transform: (chunk: Buffer, metadata: ChunkMetadata) => Promise<Buffer | null>;
      options?: {
        validate?: (chunk: Buffer) => boolean;
        compress?: boolean;
        priority?: number;
      };
    }>
  ): Promise<Array<{
    inputPath: string;
    success: boolean;
    totalBytes: number;
    chunksProcessed: number;
    throughput: number;
    result?: TOutput;
    error?: Error;
  }>> {
    const concurrencyLimit = this.config.streaming.maxConcurrentStreams;
    const results: Array<any> = [];
    
    // Sort by priority if provided
    const sortedTasks = tasks.sort((a, b) => (b.options?.priority || 0) - (a.options?.priority || 0));
    
    // Process in batches to respect concurrency limits
    for (let i = 0; i < sortedTasks.length; i += concurrencyLimit) {
      const batch = sortedTasks.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (task) => {
        const result = await this.processFileStream(
          task.inputPath,
          task.outputPath,
          task.transform,
          task.options
        );
        
        return {
          inputPath: task.inputPath,
          ...result,
        };
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            inputPath: 'unknown',
            success: false,
            totalBytes: 0,
            chunksProcessed: 0,
            throughput: 0,
            error: result.reason,
          });
        }
      });
    }
    
    return results;
  }

  /**
   * Stream large file in chunks for memory-efficient processing
   */
  async processLargeFileInChunks<TOutput = any>(
    filePath: string,
    processor: (chunk: Buffer, metadata: ChunkMetadata) => Promise<TOutput | null>,
    options: {
      chunkSize?: number;
      overlap?: number;
      enableParallel?: boolean;
      maxConcurrency?: number;
    } = {}
  ): Promise<{
    success: boolean;
    results: TOutput[];
    totalChunks: number;
    processingTime: number;
    throughput: number;
  }> {
    const startTime = Date.now();
    const chunkSize = options.chunkSize || this.config.chunking.chunkSize;
    const overlap = options.overlap || this.config.chunking.overlap;
    const enableParallel = options.enableParallel ?? this.config.chunking.enableParallelChunks;
    const maxConcurrency = options.maxConcurrency || this.config.streaming.maxConcurrentStreams;
    
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      const overlapBytes = Math.floor(chunkSize * overlap);
      const totalChunks = Math.ceil(fileSize / (chunkSize - overlapBytes));
      
      const results: TOutput[] = [];
      const chunks: Array<{ offset: number; size: number; index: number }> = [];
      
      // Calculate chunk boundaries
      for (let i = 0; i < totalChunks; i++) {
        const offset = i * (chunkSize - overlapBytes);
        const size = Math.min(chunkSize, fileSize - offset);
        chunks.push({ offset, size, index: i });
      }
      
      // Process chunks
      if (enableParallel) {
        // Parallel processing with concurrency limit
        const semaphore = new Array(maxConcurrency).fill(null);
        let chunkIndex = 0;
        
        const processChunk = async (): Promise<void> => {
          while (chunkIndex < chunks.length) {
            const chunk = chunks[chunkIndex++];
            const buffer = Buffer.alloc(chunk.size);
            
            const fileHandle = await fs.open(filePath, 'r');
            try {
              await fileHandle.read(buffer, 0, chunk.size, chunk.offset);
              
              const metadata: ChunkMetadata = {
                index: chunk.index,
                offset: chunk.offset,
                size: chunk.size,
                isFirst: chunk.index === 0,
                isLast: chunk.index === totalChunks - 1,
                totalChunks,
                timestamp: Date.now(),
              };
              
              const result = await processor(buffer, metadata);
              if (result !== null) {
                results[chunk.index] = result;
              }
            } finally {
              await fileHandle.close();
            }
          }
        };
        
        await Promise.all(semaphore.map(() => processChunk()));
      } else {
        // Sequential processing
        const fileHandle = await fs.open(filePath, 'r');
        try {
          for (const chunk of chunks) {
            const buffer = Buffer.alloc(chunk.size);
            await fileHandle.read(buffer, 0, chunk.size, chunk.offset);
            
            const metadata: ChunkMetadata = {
              index: chunk.index,
              offset: chunk.offset,
              size: chunk.size,
              isFirst: chunk.index === 0,
              isLast: chunk.index === totalChunks - 1,
              totalChunks,
              timestamp: Date.now(),
            };
            
            const result = await processor(buffer, metadata);
            if (result !== null) {
              results[chunk.index] = result;
            }
          }
        } finally {
          await fileHandle.close();
        }
      }
      
      const processingTime = Date.now() - startTime;
      const throughput = fileSize / (processingTime / 1000);
      
      // Update metrics
      this.updateThroughputMetrics(fileSize);
      
      return {
        success: true,
        results: results.filter(r => r !== undefined),
        totalChunks,
        processingTime,
        throughput,
      };
      
    } catch (error) {
      this.emit('error', { operation: 'processLargeFileInChunks', error });
      throw error;
    }
  }

  /**
   * Zero-copy file operations using sendfile or similar optimizations
   */
  async zeroCopyOperation(
    sourcePath: string,
    destinationPath: string,
    options: {
      enableCompression?: boolean;
      preserveMetadata?: boolean;
      verifyIntegrity?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    bytesCopied: number;
    throughput: number;
    method: 'sendfile' | 'mmap' | 'stream';
  }> {
    const startTime = Date.now();
    
    try {
      const stats = await fs.stat(sourcePath);
      const fileSize = stats.size;
      
      // Ensure destination directory exists
      await fs.mkdir(dirname(destinationPath), { recursive: true });
      
      let method: 'sendfile' | 'mmap' | 'stream' = 'stream';
      
      if (this.config.zeroCopy.enabled && this.config.zeroCopy.useSendfile && !options.enableCompression) {
        // Use sendfile for zero-copy when possible
        method = 'sendfile';
        await this.sendfileOperation(sourcePath, destinationPath);
      } else if (this.config.zeroCopy.enableMemoryMapping && fileSize > this.config.zeroCopy.mmapThreshold) {
        // Use memory mapping for very large files
        method = 'mmap';
        await this.mmapOperation(sourcePath, destinationPath, options);
      } else {
        // Fall back to optimized streaming
        method = 'stream';
        await this.optimizedStreamCopy(sourcePath, destinationPath, options);
      }
      
      // Preserve metadata if requested
      if (options.preserveMetadata) {
        await fs.utimes(destinationPath, stats.atime, stats.mtime);
        await fs.chmod(destinationPath, stats.mode);
      }
      
      // Verify integrity if requested
      if (options.verifyIntegrity) {
        const sourceChecksum = await this.calculateChecksum(sourcePath);
        const destChecksum = await this.calculateChecksum(destinationPath);
        
        if (sourceChecksum !== destChecksum) {
          throw new Error('File integrity verification failed');
        }
      }
      
      const processingTime = Date.now() - startTime;
      const throughput = fileSize / (processingTime / 1000);
      
      // Update metrics
      this.updateThroughputMetrics(fileSize);
      
      return {
        success: true,
        bytesCopied: fileSize,
        throughput,
        method,
      };
      
    } catch (error) {
      this.emit('error', { operation: 'zeroCopyOperation', error });
      throw error;
    }
  }

  /**
   * Cancel active stream operations
   */
  async cancelOperations(taskIds?: string[]): Promise<void> {
    const toCancel = taskIds || Array.from(this.activeStreams.keys());
    
    for (const taskId of toCancel) {
      const controller = this.activeStreams.get(taskId);
      if (controller) {
        controller.abort();
        this.activeStreams.delete(taskId);
      }
    }
  }

  /**
   * Get current streaming statistics
   */
  getStreamingStats(): {
    activeStreams: number;
    totalOperations: number;
    totalBytes: number;
    averageThroughput: number;
    cacheHitRate: number;
    cacheSize: number;
  } {
    const now = Date.now();
    const uptime = (now - this.throughputMetrics.startTime) / 1000;
    const averageThroughput = uptime > 0 ? this.throughputMetrics.totalBytes / uptime : 0;
    
    return {
      activeStreams: this.activeStreams.size,
      totalOperations: this.throughputMetrics.operationCount,
      totalBytes: this.throughputMetrics.totalBytes,
      averageThroughput,
      cacheHitRate: this.calculateCacheHitRate(),
      cacheSize: this.streamCache.size,
    };
  }

  /**
   * Cleanup resources and shutdown
   */
  async shutdown(): Promise<void> {
    // Cancel all active operations
    await this.cancelOperations();
    
    // Clear caches
    this.streamCache.clear();
    this.streamPool.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }

  // Private helper methods

  private async setupCacheDirectory(): Promise<void> {
    if (this.config.caching.persistToDisk) {
      await fs.mkdir(this.config.caching.cacheDirectory, { recursive: true });
    }
  }

  private startMetricsCollection(): void {
    if (!this.config.monitoring.enableMetrics) return;
    
    setInterval(() => {
      const stats = this.getStreamingStats();
      this.emit('metrics', {
        timestamp: new Date(),
        stats,
      });
    }, this.config.monitoring.metricsInterval);
  }

  private async checkCache(filePath: string): Promise<StreamCacheEntry | null> {
    if (!this.config.caching.enabled) return null;
    
    const cacheKey = await this.calculateChecksum(filePath);
    const entry = this.streamCache.get(cacheKey);
    
    if (entry) {
      const isExpired = Date.now() - entry.metadata.lastAccessed > this.config.caching.ttl;
      if (!isExpired) {
        entry.metadata.lastAccessed = Date.now();
        return entry;
      } else {
        this.streamCache.delete(cacheKey);
      }
    }
    
    return null;
  }

  private async cacheResult(filePath: string, data: Buffer, metadata: Omit<StreamCacheEntry['metadata'], 'lastAccessed'>): Promise<void> {
    if (!this.config.caching.enabled) return;
    
    const cacheKey = await this.calculateChecksum(filePath);
    
    // Check cache size limit
    if (this.streamCache.size >= this.config.caching.maxSize) {
      this.evictOldestCacheEntry();
    }
    
    this.streamCache.set(cacheKey, {
      data,
      metadata: {
        ...metadata,
        lastAccessed: Date.now(),
      },
    });
  }

  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.streamCache.entries()) {
      if (entry.metadata.lastAccessed < oldestTime) {
        oldestTime = entry.metadata.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.streamCache.delete(oldestKey);
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private updateThroughputMetrics(bytes: number): void {
    this.throughputMetrics.totalBytes += bytes;
    this.throughputMetrics.operationCount++;
  }

  private calculateCacheHitRate(): number {
    // Simplified cache hit rate calculation
    // In a real implementation, you'd track hits and misses
    return 0.0; // Placeholder
  }

  private async sendfileOperation(sourcePath: string, destinationPath: string): Promise<void> {
    // Simplified sendfile implementation
    // In production, you'd use platform-specific sendfile system calls
    await fs.copyFile(sourcePath, destinationPath);
  }

  private async mmapOperation(
    sourcePath: string,
    destinationPath: string,
    options: { enableCompression?: boolean }
  ): Promise<void> {
    // Simplified memory mapping implementation
    // In production, you'd use actual memory mapping APIs
    const sourceHandle = await fs.open(sourcePath, 'r');
    const destHandle = await fs.open(destinationPath, 'w');
    
    try {
      const buffer = Buffer.alloc(this.config.zeroCopy.mmapThreshold);
      let offset = 0;
      let bytesRead: number;
      
      do {
        const result = await sourceHandle.read(buffer, 0, buffer.length, offset);
        bytesRead = result.bytesRead;
        
        if (bytesRead > 0) {
          await destHandle.write(buffer, 0, bytesRead, offset);
          offset += bytesRead;
        }
      } while (bytesRead > 0);
    } finally {
      await sourceHandle.close();
      await destHandle.close();
    }
  }

  private async optimizedStreamCopy(
    sourcePath: string,
    destinationPath: string,
    options: { enableCompression?: boolean }
  ): Promise<void> {
    const sourceStream = createReadStream(sourcePath, {
      highWaterMark: this.config.streaming.highWaterMark,
    });
    
    const destStream = createWriteStream(destinationPath, {
      highWaterMark: this.config.streaming.highWaterMark,
    });
    
    const streams: NodeJS.ReadWriteStream[] = [];
    
    if (options.enableCompression && this.config.compression.enabled) {
      streams.push(createGzip({ level: this.config.compression.level }));
    }
    
    await pipeline(sourceStream, ...streams, destStream);
  }
}