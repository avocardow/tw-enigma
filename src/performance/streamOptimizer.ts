/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Stream Processing Framework for Tailwind Enigma Core
 *
 * Provides efficient stream processing for large files with backpressure handling,
 * transform stream chaining, and progress tracking for long operations.
 */

import { Transform, Readable, Writable, pipeline } from "stream";
import { createReadStream } from "fs";
import { EventEmitter } from "events";
import { performance } from "perf_hooks";
import { promisify } from "util";
import { createLogger } from "../logger.ts";
import type { StreamConfig, PerformanceMetrics } from "./config.ts";

const logger = createLogger("StreamOptimizer");
const pipelineAsync = promisify(pipeline);

/**
 * Stream processing statistics
 */
interface StreamStats {
  bytesProcessed: number;
  itemsProcessed: number;
  startTime: number;
  endTime?: number;
  throughput: number; // bytes per second
  itemThroughput: number; // items per second
  backpressureEvents: number;
  errorCount: number;
}

/**
 * Stream processing options
 */
interface StreamProcessingOptions {
  chunkSize?: number;
  highWaterMark?: number;
  enableBackpressure?: boolean;
  maxConcurrentStreams?: number;
  enableProgress?: boolean;
  progressInterval?: number;
  encoding?: BufferEncoding;
  objectMode?: boolean;
}

/**
 * Progress information for stream processing
 */
interface StreamProgress {
  totalBytes?: number;
  processedBytes: number;
  totalItems?: number;
  processedItems: number;
  percentComplete: number;
  estimatedTimeRemaining: number;
  currentThroughput: number;
  averageThroughput: number;
}

/**
 * Stream processing result
 */
interface StreamResult<T = unknown> {
  success: boolean;
  data?: T;
  stats: StreamStats;
  error?: Error;
  progress?: StreamProgress;
}

/**
 * High-performance stream optimizer for large file processing
 */
export class StreamOptimizer extends EventEmitter {
  private config: StreamConfig;
  private activeStreams: Map<string, StreamStats> = new Map();
  private transformCache: Map<string, Transform> = new Map();

  constructor(config: Partial<StreamConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      highWaterMark: 64 * 1024, // 64KB
      enableBackpressure: true,
      maxConcurrentStreams: 10,
      chunkSize: 16 * 1024, // 16KB
      ...config,
    };

    logger.info("StreamOptimizer initialized", {
      highWaterMark: this.config.highWaterMark,
      chunkSize: this.config.chunkSize,
      maxConcurrentStreams: this.config.maxConcurrentStreams,
    });
  }

  /**
   * Process a file using streaming with custom transform functions
   */
  async processFile<T = string>(
    filePath: string,
    transforms: Array<(chunk: Buffer | string) => Promise<T> | T>,
    options: StreamProcessingOptions = {},
  ): Promise<StreamResult<T[]>> {
    const streamId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    const stats: StreamStats = {
      bytesProcessed: 0,
      itemsProcessed: 0,
      startTime,
      throughput: 0,
      itemThroughput: 0,
      backpressureEvents: 0,
      errorCount: 0,
    };

    this.activeStreams.set(streamId, stats);

    try {
      logger.debug("Starting file stream processing", {
        streamId,
        filePath,
        transforms: transforms.length,
      });

      const results: T[] = [];
      const streamOptions = {
        highWaterMark: options.highWaterMark || this.config.highWaterMark,
        encoding: options.encoding,
      };

      // Create readable stream from file
      const readStream = createReadStream(filePath, streamOptions);

      // Create transform stream chain
      const transformStream = this.createTransformChain(transforms, {
        ...options,
        onProgress: (progress) => {
          this.emit("progress", { streamId, progress });
        },
        onStats: (newStats) => {
          Object.assign(stats, newStats);
        },
      });

      // Create writable stream to collect results
      const writeStream = new Writable({
        objectMode: true,
        write(chunk, encoding, callback) {
          results.push(chunk);
          stats.itemsProcessed++;
          callback();
        },
      });

      // Monitor backpressure
      if (this.config.enableBackpressure) {
        this.setupBackpressureMonitoring(
          readStream,
          transformStream,
          writeStream,
          stats,
        );
      }

      // Execute stream pipeline
      await pipelineAsync(readStream, transformStream, writeStream);

      stats.endTime = performance.now();
      const duration = (stats.endTime - stats.startTime) / 1000;
      stats.throughput = stats.bytesProcessed / duration;
      stats.itemThroughput = stats.itemsProcessed / duration;

      this.activeStreams.delete(streamId);

      logger.info("File stream processing completed", {
        streamId,
        filePath,
        bytesProcessed: stats.bytesProcessed,
        itemsProcessed: stats.itemsProcessed,
        duration,
        throughput: stats.throughput,
      });

      return {
        success: true,
        data: results,
        stats,
      };
    } catch (error) {
      stats.errorCount++;
      stats.endTime = performance.now();
      this.activeStreams.delete(streamId);

      logger.error("File stream processing failed", {
        streamId,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        stats,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Process large text data in chunks using streaming
   */
  async processTextStream(
    text: string,
    processor: (chunk: string) => Promise<string> | string,
    options: StreamProcessingOptions = {},
  ): Promise<StreamResult<string>> {
    const streamId = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const chunkSize = options.chunkSize || this.config.chunkSize;
    const startTime = performance.now();

    const stats: StreamStats = {
      bytesProcessed: 0,
      itemsProcessed: 0,
      startTime,
      throughput: 0,
      itemThroughput: 0,
      backpressureEvents: 0,
      errorCount: 0,
    };

    this.activeStreams.set(streamId, stats);

    try {
      logger.debug("Starting text stream processing", {
        streamId,
        textLength: text.length,
        chunkSize,
      });

      let result = "";
      const totalChunks = Math.ceil(text.length / chunkSize);

      // Create readable stream from text chunks
      const readStream = new Readable({
        objectMode: false,
        read() {
          // Handled by push() calls below
        },
      });

      // Create transform stream
      const transformStream = new Transform({
        objectMode: false,
        transform: async (chunk: Buffer, encoding, callback) => {
          try {
            const chunkText = chunk.toString();
            const processed = await processor(chunkText);
            stats.bytesProcessed += chunk.length;
            stats.itemsProcessed++;

            // Emit progress
            if (options.enableProgress) {
              const progress: StreamProgress = {
                processedBytes: stats.bytesProcessed,
                processedItems: stats.itemsProcessed,
                totalItems: totalChunks,
                percentComplete: (stats.itemsProcessed / totalChunks) * 100,
                estimatedTimeRemaining: this.calculateETA(stats, totalChunks),
                currentThroughput: stats.throughput,
                averageThroughput:
                  stats.bytesProcessed /
                  ((performance.now() - startTime) / 1000),
              };
              this.emit("progress", { streamId, progress });
            }

            callback(null, processed);
          } catch (error) {
            stats.errorCount++;
            callback(error instanceof Error ? error : new Error(String(error)));
          }
        },
      });

      // Create writable stream to collect results
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          result += chunk.toString();
          callback();
        },
      });

      // Push text chunks to readable stream
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        readStream.push(chunk);
      }
      readStream.push(null); // End stream

      // Execute pipeline
      await pipelineAsync(readStream, transformStream, writeStream);

      stats.endTime = performance.now();
      const duration = (stats.endTime - stats.startTime) / 1000;
      stats.throughput = stats.bytesProcessed / duration;
      stats.itemThroughput = stats.itemsProcessed / duration;

      this.activeStreams.delete(streamId);

      logger.info("Text stream processing completed", {
        streamId,
        inputLength: text.length,
        outputLength: result.length,
        duration,
        throughput: stats.throughput,
      });

      return {
        success: true,
        data: result,
        stats,
      };
    } catch (error) {
      stats.errorCount++;
      stats.endTime = performance.now();
      this.activeStreams.delete(streamId);

      logger.error("Text stream processing failed", {
        streamId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        stats,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Create a batch stream processor for handling multiple files
   */
  async processBatchStream<T>(
    filePaths: string[],
    processor: (filePath: string, content: Buffer) => Promise<T> | T,
    options: StreamProcessingOptions = {},
  ): Promise<StreamResult<T[]>> {
    const streamId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const concurrency = Math.min(
      options.maxConcurrentStreams || this.config.maxConcurrentStreams,
      filePaths.length,
    );

    const startTime = performance.now();
    const stats: StreamStats = {
      bytesProcessed: 0,
      itemsProcessed: 0,
      startTime,
      throughput: 0,
      itemThroughput: 0,
      backpressureEvents: 0,
      errorCount: 0,
    };

    this.activeStreams.set(streamId, stats);

    try {
      logger.info("Starting batch stream processing", {
        streamId,
        totalFiles: filePaths.length,
        concurrency,
      });

      const results: T[] = [];
      const errors: Error[] = [];
      let completedFiles = 0;

      // Process files with concurrency limit using Promise.allSettled in batches
      for (let i = 0; i < filePaths.length; i += concurrency) {
        const batch = filePaths.slice(i, i + concurrency);
        const batchPromises = batch.map(async (filePath, _batchIndex) => {
          try {
            const result = await this.processFileWithLimiter(
              filePath,
              processor,
              options,
            );
            stats.itemsProcessed++;
            completedFiles++;

            // Emit progress
            if (options.enableProgress) {
              const progress: StreamProgress = {
                processedItems: completedFiles,
                totalItems: filePaths.length,
                processedBytes: stats.bytesProcessed,
                percentComplete: (completedFiles / filePaths.length) * 100,
                estimatedTimeRemaining: this.calculateETA(
                  stats,
                  filePaths.length,
                ),
                currentThroughput: stats.throughput,
                averageThroughput:
                  stats.bytesProcessed /
                  ((performance.now() - startTime) / 1000),
              };
              this.emit("progress", { streamId, progress });
            }

            return { success: true as const, result, filePath };
          } catch (error) {
            stats.errorCount++;
            logger.error("File processing failed in batch", {
              filePath,
              error: error instanceof Error ? error.message : String(error),
            });
            return { success: false as const, error, filePath };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        batchResults.forEach((settledResult, _batchIndex) => {
          if (settledResult.status === "fulfilled") {
            const value = settledResult.value;
            if (value.success) {
              results.push(value.result);
            } else {
              stats.errorCount++;
              errors.push(
                value.error instanceof Error
                  ? value.error
                  : new Error(String(value.error)),
              );
            }
          } else {
            // Promise.allSettled rejection (shouldn't happen with our error handling)
            stats.errorCount++;
            const error = new Error(
              `Batch processing failed: ${settledResult.reason}`,
            );
            errors.push(error);
          }
        });
      }

      stats.endTime = performance.now();
      const duration = (stats.endTime - stats.startTime) / 1000;
      stats.throughput = stats.bytesProcessed / duration;
      stats.itemThroughput = stats.itemsProcessed / duration;

      this.activeStreams.delete(streamId);

      logger.info("Batch stream processing completed", {
        streamId,
        totalFiles: filePaths.length,
        successfulFiles: results.length,
        failedFiles: stats.errorCount,
        duration,
        throughput: stats.throughput,
      });

      return {
        success: stats.errorCount === 0,
        data: results,
        stats,
      };
    } catch (error) {
      stats.errorCount++;
      stats.endTime = performance.now();
      this.activeStreams.delete(streamId);

      logger.error("Batch stream processing failed", {
        streamId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        stats,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get statistics for all active streams
   */
  getActiveStreamStats(): Map<string, StreamStats> {
    return new Map(this.activeStreams);
  }

  /**
   * Get overall stream processing metrics
   */
  getOverallMetrics(): PerformanceMetrics {
    const allStats = Array.from(this.activeStreams.values());
    const totalItems = allStats.reduce(
      (sum, stat) => sum + stat.itemsProcessed,
      0,
    );
    const totalErrors = allStats.reduce(
      (sum, stat) => sum + stat.errorCount,
      0,
    );
    const avgThroughput =
      allStats.length > 0
        ? allStats.reduce((sum, stat) => sum + stat.throughput, 0) /
          allStats.length
        : 0;

    return {
      operationDuration: 0,
      totalExecutionTime: 0,
      averageOperationTime: 0,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      rss: process.memoryUsage().rss,
      activeWorkers: 0,
      queuedTasks: this.activeStreams.size,
      completedTasks: totalItems,
      failedTasks: totalErrors,
      cacheHits: 0,
      cacheMisses: 0,
      cacheSize: 0,
      cacheHitRate: 0,
      cpuUsage: 0,
      memoryUsage:
        process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
      eventLoopLag: 0,
      throughput: avgThroughput,
      latency: 0,
      errorRate: totalErrors / Math.max(totalItems, 1),
      timestamp: Date.now(),
    };
  }

  /**
   * Create a transform stream chain from multiple transform functions
   */
  private createTransformChain<T>(
    transforms: Array<(chunk: any) => Promise<T> | T>,
    options: StreamProcessingOptions & {
      onProgress?: (progress: StreamProgress) => void;
      onStats?: (stats: Partial<StreamStats>) => void;
    },
  ): Transform {
    return new Transform({
      objectMode: true,
      transform: async (chunk, encoding, callback) => {
        try {
          let result = chunk;

          // Apply transforms sequentially
          for (const transform of transforms) {
            result = await transform(result);
          }

          // Update stats
          if (options.onStats) {
            options.onStats({
              bytesProcessed: Buffer.isBuffer(chunk)
                ? chunk.length
                : Buffer.byteLength(String(chunk)),
            });
          }

          callback(null, result);
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
    });
  }

  /**
   * Setup backpressure monitoring for streams
   */
  private setupBackpressureMonitoring(
    readStream: Readable,
    transformStream: Transform,
    writeStream: Writable,
    stats: StreamStats,
  ): void {
    const monitors = [readStream, transformStream, writeStream];

    monitors.forEach((stream, index) => {
      stream.on("drain", () => {
        stats.backpressureEvents++;
        this.emit("backpressure", {
          streamType: ["read", "transform", "write"][index],
          timestamp: Date.now(),
        });
      });
    });
  }

  /**
   * Process a single file with memory and concurrency limiting
   */
  private async processFileWithLimiter<T>(
    filePath: string,
    processor: (filePath: string, content: Buffer) => Promise<T> | T,
    options: StreamProcessingOptions,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const readStream = createReadStream(filePath, {
        highWaterMark: options.highWaterMark || this.config.highWaterMark,
      });

      readStream.on("data", (chunk: string | Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      readStream.on("end", async () => {
        try {
          const content = Buffer.concat(chunks);
          const result = await processor(filePath, content);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      readStream.on("error", reject);
    });
  }

  /**
   * Calculate estimated time to completion
   */
  private calculateETA(stats: StreamStats, totalItems: number): number {
    if (stats.itemsProcessed === 0) return 0;

    const elapsed = (performance.now() - stats.startTime) / 1000;
    const rate = stats.itemsProcessed / elapsed;
    const remaining = totalItems - stats.itemsProcessed;

    return remaining / rate;
  }
}
