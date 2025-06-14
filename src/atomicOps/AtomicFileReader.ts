/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @fileoverview Atomic file reading operations with verification and caching
 * @module atomicOps/AtomicFileReader
 */

import { promises as fs } from "fs";
import type { Stats } from "fs";
import { createReadStream } from "fs";
import { createHash } from "crypto";
import { pipeline } from "stream/promises";

import {
  AtomicFileOptions,
  AtomicOperationResult,
  AtomicOperationMetrics,
  AtomicOperationError,
  FileReadOptions,
} from "../types/atomicOps";

/** Default options for atomic file operations */
const DEFAULT_OPTIONS: Required<AtomicFileOptions> = {
  enableFsync: true,
  tempDirectory: "",
  tempPrefix: ".tmp-",
  tempSuffix: ".tmp",
  operationTimeout: 30000,
  preservePermissions: true,
  preserveOwnership: false,
  bufferSize: 64 * 1024, // 64KB
  maxRetryAttempts: 3,
  enableWAL: false,
  walDirectory: ".wal",
  maxRetries: 3,
  retryDelay: 100,
};

/** Default file read options */
const DEFAULT_READ_OPTIONS: Required<FileReadOptions> = {
  encoding: "utf8",
  verifyChecksum: false,
  expectedChecksum: "",
  checksumAlgorithm: "sha256",
  bufferSize: 64 * 1024, // 64KB
  enableCaching: false,
  cacheTimeout: 5000, // 5 seconds
  maxFileSize: 100 * 1024 * 1024, // 100MB
  abortOnFirstError: true,
  readTimeout: 30000,
  validateSchema: () => true, // Default validation function that always passes
};

/** Cache entry for file content */
interface FileCacheEntry {
  content: string | Buffer;
  checksum: string;
  mtime: number;
  size: number;
  expiresAt: number;
}

/**
 * AtomicFileReader provides safe, verified file reading operations
 * with optional caching, checksum verification, and large file support
 */
export class AtomicFileReader {
  private readonly options: Required<AtomicFileOptions>;
  private readonly metrics: AtomicOperationMetrics;
  private readonly cache = new Map<string, FileCacheEntry>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: AtomicFileOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.metrics = this.initializeMetrics();
    this.startCacheCleanup();
  }

  /**
   * Reads a file atomically with optional verification
   * @param filePath - Path to the file to read
   * @param options - Read operation options
   * @returns Promise resolving to operation result with file content
   */
  async readFile(
    filePath: string,
    options: FileReadOptions = {},
  ): Promise<AtomicOperationResult & { content?: string | Buffer }> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_READ_OPTIONS, ...options };

    const result: AtomicOperationResult & { content?: string | Buffer } = {
      success: false,
      operation: "read",
      filePath,
      duration: 0,
      bytesProcessed: 0,
      metadata: {
        startTime,
        endTime: 0,
        fsyncUsed: false, // Reads don't need fsync
        retryAttempts: 0,
        walUsed: false,
        backupCreated: false,
        checksumVerified: false,
        fromCache: false,
        checksum: undefined,
      },
    };

    try {
      // Step 1: Check if file exists and is accessible
      const stats = await this.getFileStats(filePath);

      // Step 2: Validate file size
      if (stats.size > mergedOptions.maxFileSize) {
        throw new Error(
          `File size (${stats.size}) exceeds maximum allowed size (${mergedOptions.maxFileSize})`,
        );
      }

      // Step 3: Check cache if enabled
      if (mergedOptions.enableCaching) {
        const cachedContent = this.getCachedContent(filePath, stats);
        if (cachedContent) {
          result.success = true;
          result.content = cachedContent.content;
          result.bytesProcessed = stats.size;
          result.metadata.checksum = cachedContent.checksum;
          result.metadata.fromCache = true;
          result.metadata.checksumVerified = !!mergedOptions.verifyChecksum;
          result.fileStats = stats;
          this.updateMetrics("read", true, Date.now() - startTime, stats.size);
          return result;
        }
      }

      // Step 4: Read file content
      let content: string | Buffer;
      if (stats.size > mergedOptions.bufferSize) {
        // Use streaming for large files
        content = await this.readFileStreaming(filePath, mergedOptions);
      } else {
        // Use direct read for small files
        content = await this.readFileDirectly(filePath, mergedOptions);
      }

      // Step 5: Verify checksum if required
      if (mergedOptions.verifyChecksum && mergedOptions.expectedChecksum) {
        const actualChecksum = this.calculateChecksum(
          content,
          mergedOptions.checksumAlgorithm,
        );
        if (actualChecksum !== mergedOptions.expectedChecksum) {
          throw new Error(
            `Checksum verification failed: expected ${mergedOptions.expectedChecksum}, got ${actualChecksum}`,
          );
        }
        result.metadata.checksum = actualChecksum;
        result.metadata.checksumVerified = true;
      }

      // Step 6: Cache content if enabled
      if (mergedOptions.enableCaching) {
        this.cacheContent(filePath, content, stats, mergedOptions);
      }

      // Step 7: Set result
      result.success = true;
      result.content = content;
      result.bytesProcessed = stats.size;
      result.fileStats = stats;

      this.updateMetrics("read", true, Date.now() - startTime, stats.size);
    } catch (_error) {
      result.error = {
        code: this.getErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };

      this.updateMetrics(
        "read",
        false,
        Date.now() - startTime,
        0,
        result.error.code,
      );
    } finally {
      result.metadata.endTime = Date.now();
      result.duration = Math.max(result.metadata.endTime - startTime, 0.1);
    }

    return result;
  }

  /**
   * Reads a JSON file and parses it atomically
   * @param filePath - Path to the JSON file
   * @param options - Read operation options
   * @returns Promise resolving to parsed JSON data
   */
  async readJsonFile(
    filePath: string,
    options: FileReadOptions = {},
  ): Promise<AtomicOperationResult & { content?: unknown }> {
    const readResult = await this.readFile(filePath, {
      ...options,
      encoding: "utf8",
    });

    if (!readResult.success || !readResult.content) {
      return { ...readResult, content: undefined };
    }

    try {
      const data = JSON.parse(readResult.content as string);

      // Schema validation if provided
      if (options.validateSchema && !options.validateSchema(data)) {
        return {
          ...readResult,
          success: false,
          content: undefined,
          error: {
            code: "SCHEMA_VALIDATION_ERROR",
            message: "Schema validation failed for JSON data",
          },
        };
      }

      return { ...readResult, content: data };
    } catch (_error) {
      return {
        ...readResult,
        success: false,
        content: undefined,
        error: {
          code: "JSON_PARSE_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to parse JSON content",
        },
      };
    }
  }

  /**
   * Reads multiple files in parallel or sequentially
   * @param files - Array of file read requests
   * @param options - Read operation options
   * @returns Promise resolving to array of read results
   */
  async readMultipleFiles(
    files: Array<{ path: string; options?: FileReadOptions }>,
    options: { abortOnFirstError?: boolean } = {},
  ): Promise<Array<AtomicOperationResult & { content?: string | Buffer }>> {
    const { abortOnFirstError = false } = options;
    const results: Array<
      AtomicOperationResult & { content?: string | Buffer }
    > = [];

    if (abortOnFirstError) {
      // Sequential processing with early termination
      for (const file of files) {
        const result = await this.readFile(file.path, file.options);
        results.push(result);

        if (!result.success) {
          break;
        }
      }
    } else {
      // Parallel processing
      const promises = files.map((file) =>
        this.readFile(file.path, file.options),
      );
      const allResults = await Promise.allSettled(promises);

      results.push(
        ...allResults.map((result) =>
          result.status === "fulfilled"
            ? result.value
            : {
                success: false,
                operation: "read" as const,
                filePath: "",
                duration: 0,
                bytesProcessed: 0,
                error: {
                  code: "UNKNOWN_ERROR",
                  message: result.reason?.message || "Unknown error",
                },
                metadata: {
                  startTime: Date.now(),
                  endTime: Date.now(),
                  fsyncUsed: false,
                  retryAttempts: 0,
                  walUsed: false,
                  backupCreated: false,
                  checksumVerified: false,
                  fromCache: false,
                  checksum: undefined,
                },
              },
        ),
      );
    }

    return results;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): AtomicOperationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache size (number of entries)
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Clear cache entries
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean up resources and clear cache
   */
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.cache.clear();
  }

  /**
   * Shuts down the file reader and cleans up resources
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    await this.cleanup();
    console.log("AtomicFileReader shutdown complete.");
  }

  // Private methods

  private initializeMetrics(): AtomicOperationMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      operationTypes: {
        create: 0,
        read: 0,
        write: 0,
        delete: 0,
      },
      totalBytesProcessed: 0,
      averageDuration: 0,
      operationsPerSecond: 0,
      totalFsyncCalls: 0,
      totalRetryAttempts: 0,
      errorStats: {},
    };
  }

  private startCacheCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
    }, 30000); // Every 30 seconds
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [filePath, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(filePath);
      }
    }
  }

  private async getFileStats(filePath: string): Promise<Stats> {
    try {
      return await fs.stat(filePath);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === "ENOENT") {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  private getCachedContent(
    filePath: string,
    stats: Stats,
  ): FileCacheEntry | null {
    const entry = this.cache.get(filePath);
    if (!entry) {
      return null;
    }

    // Check if entry is still valid
    if (
      entry.expiresAt < Date.now() ||
      entry.mtime !== stats.mtime.getTime() ||
      entry.size !== stats.size
    ) {
      this.cache.delete(filePath);
      return null;
    }

    return entry;
  }

  private async readFileDirectly(
    filePath: string,
    options: Required<FileReadOptions>,
  ): Promise<string | Buffer> {
    if (options.encoding === "buffer") {
      return await fs.readFile(filePath);
    } else {
      return await fs.readFile(filePath, options.encoding);
    }
  }

  private async readFileStreaming(
    filePath: string,
    options: Required<FileReadOptions>,
  ): Promise<string | Buffer> {
    const chunks: Buffer[] = [];
    const readStream = createReadStream(filePath, {
      highWaterMark: options.bufferSize,
    });

    await pipeline(readStream, async function* (source) {
      for await (const chunk of source) {
        chunks.push(chunk);
        yield chunk;
      }
    });

    const buffer = Buffer.concat(chunks);

    if (options.encoding === "buffer") {
      return buffer;
    } else {
      return buffer.toString(options.encoding);
    }
  }

  private calculateChecksum(
    content: string | Buffer,
    algorithm: string,
  ): string {
    const hash = createHash(algorithm);
    hash.update(content);
    return hash.digest("hex");
  }

  private cacheContent(
    filePath: string,
    content: string | Buffer,
    stats: Stats,
    options: Required<FileReadOptions>,
  ): void {
    const checksum = this.calculateChecksum(content, options.checksumAlgorithm);
    const entry: FileCacheEntry = {
      content,
      checksum,
      mtime: stats.mtime.getTime(),
      size: stats.size,
      expiresAt: Date.now() + options.cacheTimeout,
    };

    this.cache.set(filePath, entry);
  }

  private updateMetrics(
    operation: "read" | "write" | "delete" | "create",
    success: boolean,
    duration: number,
    bytesProcessed: number,
    errorCode?: string,
  ): void {
    this.metrics.totalOperations++;
    this.metrics.operationTypes[operation]++;

    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
      if (errorCode) {
        this.metrics.errorStats[errorCode] =
          (this.metrics.errorStats[errorCode] || 0) + 1;
      }
    }

    this.metrics.totalBytesProcessed += bytesProcessed;

    // Ensure minimum duration for tracking purposes (avoid division by zero)
    const measuredDuration = Math.max(duration, 0.1);

    // Update average duration
    if (this.metrics.totalOperations === 1) {
      this.metrics.averageDuration = measuredDuration;
    } else {
      const totalDuration =
        this.metrics.averageDuration * (this.metrics.totalOperations - 1) +
        measuredDuration;
      this.metrics.averageDuration =
        totalDuration / this.metrics.totalOperations;
    }

    // Calculate operations per second (simple approximation)
    if (this.metrics.averageDuration > 0) {
      this.metrics.operationsPerSecond = 1000 / this.metrics.averageDuration;
    }
  }

  private getErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
      switch (error.code) {
        case "ENOENT":
          return AtomicOperationError.FILE_NOT_FOUND;
        case "EACCES":
          return AtomicOperationError.PERMISSION_DENIED;
        case "EISDIR":
          return AtomicOperationError.INVALID_OPERATION;
        case "EMFILE":
        case "ENFILE":
          return AtomicOperationError.TEMP_FILE_CREATION_FAILED;
        default:
          return error.code;
      }
    }

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      if (error.message.includes("File not found")) {
        return AtomicOperationError.FILE_NOT_FOUND;
      }

      if (error.message.includes("timeout")) {
        return AtomicOperationError.TIMEOUT;
      }

      if (error.message.includes("Checksum")) {
        return "CHECKSUM_MISMATCH";
      }

      if (error.message.includes("Schema validation")) {
        return "SCHEMA_VALIDATION_ERROR";
      }
    }

    return AtomicOperationError.INVALID_OPERATION;
  }
}
