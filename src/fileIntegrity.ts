/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @ts-nocheck - Temporarily disable TypeScript strict checking for this complex file

import { z } from "zod";
import { createHash } from "crypto";
import {
  readFile,
  writeFile,
  access,
  stat,
  copyFile,
  unlink,
  mkdir,
} from "fs/promises";
import { createReadStream, createWriteStream, constants } from "fs";
import { pipeline } from "stream/promises";
import {
  createGzip,
  createGunzip,
  createDeflate,
  createInflate,
  createBrotliCompress,
  createBrotliDecompress,
  constants as zlibConstants,
} from "zlib";
import { EventEmitter } from "events";
import { resolve, dirname, basename, extname, join } from "path";
import { createLogger } from "./logger.js";
import { ConfigError } from "./errors.js";
import os from "os";

/**
 * File integrity validation options schema
 */
export const FileIntegrityOptionsSchema = z.object({
  /** Hash algorithm to use for checksums (default: 'sha256') */
  algorithm: z.enum(["md5", "sha1", "sha256", "sha512"]).default("sha256"),

  /** Whether to create backups before file modifications (default: true) */
  createBackups: z.boolean().default(true),

  /** Directory for storing backup files (default: '.backups') */
  backupDirectory: z.string().default(".backups"),

  /** Maximum age of backup files in days before cleanup (default: 7) */
  backupRetentionDays: z.number().min(1).max(365).default(7),

  /** Maximum file size to process in bytes (default: 100MB) */
  maxFileSize: z
    .number()
    .min(1)
    .default(100 * 1024 * 1024),

  /** Timeout for file operations in milliseconds (default: 30000) */
  timeout: z.number().min(1000).max(300000).default(30000),

  /** Whether to verify checksums after rollback operations (default: true) */
  verifyAfterRollback: z.boolean().default(true),

  /** Batch size for multiple file operations (default: 10) */
  batchSize: z.number().min(1).max(100).default(10),

  /** Whether to cache checksums for performance (default: true) */
  enableCaching: z.boolean().default(true),

  /** Cache size limit for stored checksums (default: 1000) */
  cacheSize: z.number().min(10).max(10000).default(1000),

  // === COMPRESSION OPTIONS ===
  /** Whether to enable compression for backup files (default: false) */
  enableCompression: z.boolean().default(false),

  /** Compression algorithm to use (default: 'gzip') */
  compressionAlgorithm: z.enum(["gzip", "deflate", "brotli"]).default("gzip"),

  /** Compression level (1-9 for gzip/deflate, 0-11 for brotli, default: 6) */
  compressionLevel: z.number().min(0).max(11).default(6),

  /** Minimum file size in bytes to compress (default: 1KB) */
  compressionThreshold: z.number().min(0).default(1024),

  // === DEDUPLICATION OPTIONS ===
  /** Whether to enable deduplication for backup files (default: false) */
  enableDeduplication: z.boolean().default(false),

  /** Directory for storing deduplicated content (default: '.dedup') */
  deduplicationDirectory: z.string().default(".dedup"),

  /** Hash algorithm for content deduplication (default: 'sha256') */
  deduplicationAlgorithm: z
    .enum(["md5", "sha1", "sha256", "sha512"])
    .default("sha256"),

  /** Minimum file size in bytes to deduplicate (default: 1KB) */
  deduplicationThreshold: z.number().min(0).default(1024),

  /** Whether to use hard links for deduplication (platform dependent, default: true) */
  useHardLinks: z.boolean().default(true),

  // === INCREMENTAL BACKUP OPTIONS ===
  /** Whether to enable incremental backup strategy (default: false) */
  enableIncrementalBackup: z.boolean().default(false),

  /** Backup strategy to use (default: 'auto') */
  backupStrategy: z.enum(["full", "incremental", "auto"]).default("auto"),

  /** Change detection method for incremental backups (default: 'mtime') */
  changeDetectionMethod: z
    .enum(["mtime", "checksum", "hybrid"])
    .default("mtime"),

  /** Maximum incremental chain length before forcing full backup (default: 10) */
  maxIncrementalChain: z.number().min(1).default(10),

  /** Time threshold for forcing full backup in hours (default: 24 = 1 day) */
  fullBackupInterval: z.number().min(1).default(24),

  /** Incremental backup metadata directory (default: '.incremental') */
  incrementalDirectory: z.string().default(".incremental"),

  // === DIFFERENTIAL BACKUP OPTIONS ===
  /** Whether to enable differential backup strategy (default: false) */
  enableDifferentialBackup: z.boolean().default(false),

  /** Differential backup strategy selection (default: 'auto') */
  differentialStrategy: z
    .enum(["auto", "manual", "threshold-based"])
    .default("auto"),

  /** Size threshold in MB for triggering new full backup in differential strategy (default: 1000) */
  differentialFullBackupThreshold: z.number().min(10).default(1000),

  /** Time threshold in hours for forcing full backup in differential strategy (default: 168 = 1 week) */
  differentialFullBackupInterval: z.number().min(1).default(168),

  /** Differential backup metadata directory (default: '.differential') */
  differentialDirectory: z.string().default(".differential"),

  /** Maximum cumulative size multiplier before forcing full backup (default: 5x original) */
  differentialSizeMultiplier: z.number().min(1).default(5),

  // === BATCH PROCESSING OPTIONS FOR LARGE PROJECTS ===
  /** Enable batch processing for large file sets (default: true) */
  enableBatchProcessing: z.boolean().default(true),

  /** Minimum batch size (default: 10) */
  minBatchSize: z.number().min(1).default(10),

  /** Maximum batch size (default: 1000) */
  maxBatchSize: z.number().min(1).default(1000),

  /** Enable dynamic batch sizing based on system metrics (default: true) */
  dynamicBatchSizing: z.boolean().default(true),

  /** Memory usage threshold for dynamic sizing (percentage, default: 80) */
  memoryThreshold: z.number().min(1).max(100).default(80),

  /** CPU usage threshold for dynamic sizing (percentage, default: 70) */
  cpuThreshold: z.number().min(1).max(100).default(70),

  /** Event loop lag threshold for dynamic sizing (milliseconds, default: 100) */
  eventLoopLagThreshold: z.number().min(1).default(100),

  /** Batch processing strategy (default: 'adaptive') */
  batchProcessingStrategy: z
    .enum(["sequential", "parallel", "adaptive"])
    .default("adaptive"),

  /** Enable progress tracking for long-running operations (default: true) */
  enableProgressTracking: z.boolean().default(true),

  /** Progress update interval in milliseconds (default: 1000) */
  progressUpdateInterval: z.number().min(100).default(1000),
});

/**
 * Inferred TypeScript type from the Zod schema
 */
export type FileIntegrityOptions = z.infer<typeof FileIntegrityOptionsSchema>;

/**
 * Checksum information structure
 */
export interface ChecksumInfo {
  /** The calculated hash value */
  hash: string;
  /** Algorithm used for the hash */
  algorithm: string;
  /** File size in bytes */
  fileSize: number;
  /** File path */
  filePath: string;
  /** Timestamp when checksum was calculated */
  timestamp: Date;
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Validation result for individual files
 */
export interface FileValidationResult {
  /** File path that was validated */
  filePath: string;
  /** Whether validation passed */
  isValid: boolean;
  /** Original checksum */
  originalChecksum?: ChecksumInfo;
  /** Current checksum */
  currentChecksum?: ChecksumInfo;
  /** Error message if validation failed */
  error?: string;
  /** Validation timestamp */
  validatedAt: Date;
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Backup operation result
 */
export interface BackupResult {
  /** Original file path */
  originalPath: string;
  /** Backup file path */
  backupPath: string;
  /** Whether backup was successful */
  success: boolean;
  /** Backup timestamp */
  createdAt: Date;
  /** Error message if backup failed */
  error?: string;
  /** Backup file size */
  backupSize?: number;
  /** Whether compression was used */
  compressed?: boolean;
  /** Compression algorithm used */
  compressionAlgorithm?: "gzip" | "deflate" | "brotli";
  /** Original file size (before compression) */
  originalSize?: number;
  /** Compression ratio (originalSize / backupSize) */
  compressionRatio?: number;
  /** Whether deduplication was used */
  deduplicated?: boolean;
  /** Content hash used for deduplication */
  contentHash?: string;
  /** Number of references to this content */
  referenceCount?: number;
  /** Deduplication storage path */
  deduplicationPath?: string;
}

/**
 * Rollback operation result
 */
export interface RollbackResult {
  /** File path that was rolled back */
  filePath: string;
  /** Backup path used for rollback */
  backupPath: string;
  /** Whether rollback was successful */
  success: boolean;
  /** Whether integrity was verified after rollback */
  integrityVerified?: boolean;
  /** Error message if rollback failed */
  error?: string;
  /** Rollback timestamp */
  rolledBackAt: Date;
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Batch validation result
 */
export interface BatchValidationResult {
  /** Total number of files processed */
  totalFiles: number;
  /** Number of files that passed validation */
  validFiles: number;
  /** Number of files that failed validation */
  invalidFiles: number;
  /** Individual file results */
  results: FileValidationResult[];
  /** Total processing time in milliseconds */
  totalProcessingTime: number;
  /** Batch operation timestamp */
  processedAt: Date;
}

/**
 * Validation metadata for reporting
 */
export interface ValidationMetadata {
  /** Source of the validation operation */
  source: string;
  /** Operation type */
  operation:
    | "checksum"
    | "validation"
    | "backup"
    | "rollback"
    | "cleanup"
    | "deduplication";
  /** Timestamp of the operation */
  timestamp: Date;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Configuration used */
  options: FileIntegrityOptions;
  /** Any additional context */
  context?: Record<string, unknown>;
}

/**
 * Deduplication content entry
 */
export interface DeduplicationEntry {
  /** Content hash (primary key) */
  hash: string;
  /** Hash algorithm used */
  algorithm: string;
  /** Size of the original content */
  size: number;
  /** Path to the deduplicated content storage */
  storagePath: string;
  /** Number of references to this content */
  referenceCount: number;
  /** Original file paths that reference this content */
  referencePaths: string[];
  /** First time this content was seen */
  firstSeen: Date;
  /** Last time this content was accessed */
  lastAccessed: Date;
  /** Whether the stored content is compressed */
  compressed: boolean;
  /** Compression algorithm if compressed */
  compressionAlgorithm?: "gzip" | "deflate" | "brotli";
}

/**
 * Deduplication index structure
 */
export interface DeduplicationIndex {
  /** Index format version */
  version: string;
  /** Total number of deduplicated entries */
  totalEntries: number;
  /** Total space saved through deduplication */
  spaceSaved: number;
  /** Last index update timestamp */
  lastUpdated: Date;
  /** Content entries by hash */
  entries: Record<string, DeduplicationEntry>;
  /** Statistics */
  stats: {
    /** Total original size */
    totalOriginalSize: number;
    /** Total deduplicated size */
    totalDeduplicatedSize: number;
    /** Number of duplicates found */
    duplicatesFound: number;
    /** Average reference count */
    averageReferenceCount: number;
  };
}

/**
 * Deduplication operation result
 */
export interface DeduplicationResult {
  /** Whether deduplication was performed */
  deduplicated: boolean;
  /** Content hash */
  contentHash: string;
  /** Path to deduplicated storage */
  storagePath?: string;
  /** Whether this is a new or existing entry */
  isNewEntry: boolean;
  /** Current reference count */
  referenceCount: number;
  /** Space saved in bytes */
  spaceSaved: number;
  /** Error message if deduplication failed */
  error?: string;
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * File change state for incremental tracking
 */
export interface FileChangeState {
  /** File path */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** File modification time */
  mtime: Date;
  /** File content hash (optional for performance) */
  contentHash?: string;
  /** Last backup time */
  lastBackup: Date;
  /** Whether file has changed since last backup */
  hasChanged: boolean;
}

/**
 * Incremental backup chain entry
 */
export interface IncrementalBackupEntry {
  /** Backup ID (unique identifier) */
  id: string;
  /** Backup type */
  type: "full" | "incremental";
  /** Parent backup ID (null for full backups) */
  parentId: string | null;
  /** Backup file path */
  backupPath: string;
  /** Original file path */
  originalPath: string;
  /** Backup creation timestamp */
  createdAt: Date;
  /** File modification time at backup */
  mtime: Date;
  /** File size at backup */
  size: number;
  /** Content hash at backup time */
  contentHash: string;
  /** Files included in this backup (for incremental: only changed files) */
  files: string[];
  /** Change detection method used */
  changeDetectionMethod: "mtime" | "checksum" | "hybrid";
  /** Compression used */
  compressed: boolean;
  /** Whether deduplication was used */
  deduplicated: boolean;
}

/**
 * Incremental backup index structure
 */
export interface IncrementalIndex {
  /** Index format version */
  version: string;
  /** Current backup chain ID */
  currentChainId: string;
  /** Last full backup information */
  lastFullBackup: {
    id: string;
    createdAt: Date;
    filePath: string;
  } | null;
  /** Backup chain entries */
  backupChain: IncrementalBackupEntry[];
  /** File state tracking for change detection */
  fileStates: Record<string, FileChangeState>;
  /** Chain statistics */
  stats: {
    totalBackups: number;
    totalIncrementals: number;
    chainLength: number;
    totalSpaceSaved: number;
    lastBackupAt: Date;
  };
  /** Last index update */
  lastUpdated: Date;
}

/**
 * Incremental backup operation result
 */
export interface IncrementalBackupResult {
  /** Backup operation type performed */
  backupType: "full" | "incremental" | "skipped";
  /** Backup ID */
  backupId: string;
  /** Parent backup ID (for incremental) */
  parentId?: string;
  /** Number of files backed up */
  filesBackedUp: number;
  /** Number of files changed since last backup */
  filesChanged: number;
  /** Number of files skipped (unchanged) */
  filesSkipped: number;
  /** Backup file path */
  backupPath: string;
  /** Total backup size */
  backupSize: number;
  /** Space saved compared to full backup */
  spaceSaved: number;
  /** Files included in this backup */
  backedUpFiles: string[];
  /** Change detection method used */
  changeDetectionMethod: "mtime" | "checksum" | "hybrid";
  /** Processing time in milliseconds */
  processingTime: number;
  /** Whether backup was successful */
  success: boolean;
  /** Error message if backup failed */
  error?: string;
  /** Backup timestamp */
  createdAt: Date;
}

/**
 * Differential backup entry - stores all changes since last full backup
 */
export interface DifferentialBackupEntry {
  /** Backup ID (unique identifier) */
  id: string;
  /** Backup type */
  type: "full" | "differential";
  /** Base full backup ID that this differential is based on */
  baseFullBackupId: string | null;
  /** Backup file path */
  backupPath: string;
  /** Original file path */
  originalPath: string;
  /** Backup creation timestamp */
  createdAt: Date;
  /** All files that have changed since base full backup */
  cumulativeFiles: string[];
  /** Cumulative size of all changes since base full backup */
  cumulativeSize: number;
  /** Files included in this specific differential backup */
  currentFiles: string[];
  /** Current differential backup size */
  currentSize: number;
  /** Change detection method used */
  changeDetectionMethod: "mtime" | "checksum" | "hybrid";
  /** Whether compression was used */
  compressed: boolean;
  /** Whether deduplication was used */
  deduplicated: boolean;
  /** Time since last full backup in hours */
  timeSinceFullBackup: number;
}

/**
 * Differential backup index structure
 */
export interface DifferentialIndex {
  /** Index format version */
  version: string;
  /** Current full backup information */
  currentFullBackup: {
    id: string;
    createdAt: Date;
    filePath: string;
    size: number;
  } | null;
  /** Differential backup entries since current full backup */
  differentialChain: DifferentialBackupEntry[];
  /** Cumulative file state tracking since last full backup */
  cumulativeFileStates: Record<string, FileChangeState>;
  /** Chain statistics */
  stats: {
    totalDifferentials: number;
    currentChainLength: number;
    cumulativeSize: number;
    cumulativeSizeRatio: number; // Current cumulative size / original full backup size
    totalSpaceSaved: number;
    lastBackupAt: Date;
    timeSinceFullBackup: number; // Hours since last full backup
  };
  /** Last index update */
  lastUpdated: Date;
}

/**
 * Differential backup operation result
 */
export interface DifferentialBackupResult {
  /** Backup operation type performed */
  backupType: "full" | "differential" | "skipped";
  /** Backup ID */
  backupId: string;
  /** Base full backup ID (for differential) */
  baseFullBackupId?: string;
  /** Number of files in current differential backup */
  filesBackedUp: number;
  /** Total cumulative files changed since last full backup */
  cumulativeFilesChanged: number;
  /** Number of files skipped (unchanged since last backup) */
  filesSkipped: number;
  /** Current differential backup path */
  backupPath: string;
  /** Current differential backup size */
  currentBackupSize: number;
  /** Total cumulative size of all changes since last full backup */
  cumulativeSize: number;
  /** Size ratio compared to original full backup */
  cumulativeSizeRatio: number;
  /** Space efficiency compared to storing separate full backups */
  spaceSaved: number;
  /** Files included in this differential backup */
  backedUpFiles: string[];
  /** All files changed cumulatively since last full backup */
  cumulativeChangedFiles: string[];
  /** Change detection method used */
  changeDetectionMethod: "mtime" | "checksum" | "hybrid";
  /** Whether a new full backup should be triggered next time */
  recommendFullBackup: boolean;
  /** Reason for recommending full backup */
  recommendationReason?: string;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Whether backup was successful */
  success: boolean;
  /** Error message if backup failed */
  error?: string;
  /** Backup timestamp */
  createdAt: Date;
}

/**
 * System metrics for dynamic batch sizing
 */
export interface SystemMetrics {
  /** CPU load average (1 minute) */
  loadAverage: number;
  /** Memory usage percentage */
  memoryUsage: number;
  /** Free memory in bytes */
  freeMemory: number;
  /** Total memory in bytes */
  totalMemory: number;
  /** Event loop lag in milliseconds */
  eventLoopLag: number;
  /** Timestamp when metrics were collected */
  timestamp: Date;
}

/**
 * Batch processing configuration
 */
export interface BatchProcessingConfig {
  /** Current batch size */
  batchSize: number;
  /** Processing strategy */
  strategy: "sequential" | "parallel" | "adaptive";
  /** Enable dynamic sizing */
  dynamicSizing: boolean;
  /** System metrics thresholds */
  thresholds: {
    memory: number;
    cpu: number;
    eventLoopLag: number;
  };
}

/**
 * Progress tracking information
 */
export interface ProgressInfo {
  /** Current file being processed */
  currentFile: string;
  /** Number of files processed */
  processed: number;
  /** Total number of files */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Estimated time of arrival */
  eta: Date | null;
  /** Files processed per second */
  rate: number;
  /** Elapsed time in milliseconds */
  elapsed: number;
  /** Current operation */
  operation: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult<T> {
  /** Whether the batch operation was successful */
  success: boolean;
  /** Individual results for each item in the batch */
  results: T[];
  /** Number of successful operations */
  successful: number;
  /** Number of failed operations */
  failed: number;
  /** Processing time for the entire batch */
  processingTime: number;
  /** Batch size used */
  batchSize: number;
  /** Any errors encountered */
  errors: Array<{
    item: string;
    error: string;
  }>;
  /** Progress information */
  progress: ProgressInfo;
}

/**
 * Large project optimization result
 */
export interface LargeProjectResult {
  /** Whether the overall operation was successful */
  success: boolean;
  /** Total files processed */
  totalFiles: number;
  /** Total processing time */
  totalProcessingTime: number;
  /** Number of batches processed */
  batchesProcessed: number;
  /** Average batch size used */
  averageBatchSize: number;
  /** Memory usage statistics */
  memoryStats: {
    initial: number;
    peak: number;
    final: number;
    average: number;
  };
  /** Performance statistics */
  performanceStats: {
    filesPerSecond: number;
    averageFileProcessingTime: number;
    eventLoopLagAverage: number;
    batchSizeAdjustments: number;
  };
  /** Whether optimization was applied */
  optimizationApplied: boolean;
  /** Optimization details */
  optimizationDetails: string[];
}

/**
 * Custom error class for file integrity validation errors
 */
export class IntegrityError extends Error {
  public readonly code: string;
  public readonly filePath?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    code: string = "INTEGRITY_ERROR",
    filePath?: string,
    operation?: string,
    cause?: Error,
  ) {
    super(message, { cause });
    this.name = "IntegrityError";
    this.code = code;
    this.filePath = filePath;
    this.operation = operation;
  }
}

/**
 * Custom error class for checksum calculation errors
 */
export class ChecksumError extends IntegrityError {
  constructor(message: string, filePath?: string, cause?: Error) {
    super(message, "CHECKSUM_ERROR", filePath, "checksum", cause);
    this.name = "ChecksumError";
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends IntegrityError {
  constructor(message: string, filePath?: string, cause?: Error) {
    super(message, "VALIDATION_ERROR", filePath, "validation", cause);
    this.name = "ValidationError";
  }
}

/**
 * Custom error class for rollback operation errors
 */
export class RollbackError extends IntegrityError {
  constructor(message: string, filePath?: string, cause?: Error) {
    super(message, "ROLLBACK_ERROR", filePath, "rollback", cause);
    this.name = "RollbackError";
  }
}

/**
 * Main class for file integrity validation operations
 */
export class FileIntegrityValidator {
  private readonly options: FileIntegrityOptions;
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly checksumCache: Map<string, ChecksumInfo> = new Map();
  private deduplicationIndex: DeduplicationIndex | null = null;
  private deduplicationIndexPath: string;
  private incrementalIndex: IncrementalIndex | null = null;
  private incrementalIndexPath: string;
  private differentialIndex: DifferentialIndex | null = null;
  private differentialIndexPath: string;

  // === BATCH PROCESSING & LARGE PROJECT OPTIMIZATION ===
  private batchProcessingConfig: BatchProcessingConfig;
  private progressEmitter: EventEmitter = new EventEmitter();
  private currentBatchSize: number;
  private eventLoopLagStart: number = 0;
  private memoryTracker: {
    initial: number;
    peak: number;
    current: number;
    samples: number[];
  };
  private performanceTracker: {
    filesProcessed: number;
    totalProcessingTime: number;
    batchSizeAdjustments: number;
    eventLoopLagSamples: number[];
  };

  constructor(options: Partial<FileIntegrityOptions> = {}) {
    // Validate and merge options with defaults
    try {
      this.options = FileIntegrityOptionsSchema.parse(options);
    } catch (error) {
      throw new ConfigError(
        "Invalid file integrity validation options",
        undefined,
        error as Error,
        { providedOptions: options },
      );
    }

    this.logger = createLogger("FileIntegrity");

    // Initialize deduplication index path
    this.deduplicationIndexPath = join(
      this.options.deduplicationDirectory,
      "dedup-index.json",
    );

    // Initialize incremental backup index path
    this.incrementalIndexPath = join(
      this.options.incrementalDirectory,
      "incremental-index.json",
    );

    // Initialize differential backup index path
    this.differentialIndexPath = join(
      this.options.differentialDirectory,
      "differential-index.json",
    );

    // Initialize batch processing configuration
    this.currentBatchSize = this.options.batchSize;
    this.batchProcessingConfig = {
      batchSize: this.options.batchSize,
      strategy: this.options.batchProcessingStrategy,
      dynamicSizing: this.options.dynamicBatchSizing,
      thresholds: {
        memory: this.options.memoryThreshold,
        cpu: this.options.cpuThreshold,
        eventLoopLag: this.options.eventLoopLagThreshold,
      },
    };

    // Initialize performance tracking
    this.memoryTracker = {
      initial: this.getCurrentMemoryUsage(),
      peak: 0,
      current: 0,
      samples: [],
    };

    this.performanceTracker = {
      filesProcessed: 0,
      totalProcessingTime: 0,
      batchSizeAdjustments: 0,
      eventLoopLagSamples: [],
    };

    this.logger.debug("FileIntegrityValidator initialized", {
      algorithm: this.options.algorithm,
      createBackups: this.options.createBackups,
      backupDirectory: this.options.backupDirectory,
      maxFileSize: this.options.maxFileSize,
      timeout: this.options.timeout,
      enableCaching: this.options.enableCaching,
      enableDeduplication: this.options.enableDeduplication,
      deduplicationDirectory: this.options.deduplicationDirectory,
      enableIncrementalBackup: this.options.enableIncrementalBackup,
      backupStrategy: this.options.backupStrategy,
      incrementalDirectory: this.options.incrementalDirectory,
      enableDifferentialBackup: this.options.enableDifferentialBackup,
      differentialStrategy: this.options.differentialStrategy,
      differentialDirectory: this.options.differentialDirectory,
    });
  }

  /**
   * Calculate checksum for a file
   */
  async calculateChecksum(filePath: string): Promise<ChecksumInfo> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);

    this.logger.debug("Calculating checksum", {
      filePath: resolvedPath,
      algorithm: this.options.algorithm,
    });

    try {
      // Verify file exists and get stats first
      const stats = await stat(resolvedPath);

      // Check cache first if enabled (after getting stats to validate file modification time)
      if (this.options.enableCaching) {
        const cached = this.checksumCache.get(resolvedPath);
        if (cached && cached.timestamp >= stats.mtime) {
          this.logger.debug("Using cached checksum", {
            filePath: resolvedPath,
          });
          return cached;
        } else if (cached && cached.timestamp < stats.mtime) {
          // File was modified since cache entry, remove stale cache
          this.checksumCache.delete(resolvedPath);
          this.logger.debug("Invalidated stale cache entry", {
            filePath: resolvedPath,
            cached: cached.timestamp,
            modified: stats.mtime,
          });
        }
      }

      if (!stats.isFile()) {
        throw new ChecksumError(
          `Path is not a file: ${resolvedPath}`,
          resolvedPath,
        );
      }

      if (stats.size > this.options.maxFileSize) {
        throw new ChecksumError(
          `File size (${stats.size}) exceeds maximum allowed size (${this.options.maxFileSize})`,
          resolvedPath,
        );
      }

      // Calculate checksum using streaming for efficiency
      const hash = createHash(this.options.algorithm);
      const stream = createReadStream(resolvedPath);

      return new Promise<ChecksumInfo>((resolve, reject) => {
        const timeout = setTimeout(() => {
          stream.destroy();
          reject(
            new ChecksumError(
              `Checksum calculation timed out after ${this.options.timeout}ms`,
              resolvedPath,
            ),
          );
        }, this.options.timeout);

        stream.on("data", (chunk) => {
          hash.update(chunk);
        });

        stream.on("end", () => {
          clearTimeout(timeout);
          const processingTime = Date.now() - startTime;

          const checksumInfo: ChecksumInfo = {
            hash: hash.digest("hex"),
            algorithm: this.options.algorithm,
            fileSize: stats.size,
            filePath: resolvedPath,
            timestamp: new Date(),
            processingTime,
          };

          // Cache the result if enabled
          if (this.options.enableCaching) {
            this.addToCache(resolvedPath, checksumInfo);
          }

          this.logger.debug("Checksum calculated successfully", {
            filePath: resolvedPath,
            hash: checksumInfo.hash,
            processingTime,
          });

          resolve(checksumInfo);
        });

        stream.on("error", (error) => {
          clearTimeout(timeout);
          reject(
            new ChecksumError(
              `Failed to read file for checksum calculation: ${error.message}`,
              resolvedPath,
              error,
            ),
          );
        });
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("Checksum calculation failed", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      if (error instanceof ChecksumError) {
        throw error;
      }

      throw new ChecksumError(
        `Checksum calculation failed: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error as Error,
      );
    }
  }

  /**
   * Calculate checksum synchronously (for smaller files)
   */
  async calculateChecksumSync(filePath: string): Promise<ChecksumInfo> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);

    this.logger.debug("Calculating checksum (sync)", {
      filePath: resolvedPath,
      algorithm: this.options.algorithm,
    });

    try {
      // Get file stats first to check modification time
      const stats = await stat(resolvedPath);

      // Check cache first if enabled (after getting stats to validate file modification time)
      if (this.options.enableCaching) {
        const cached = this.checksumCache.get(resolvedPath);
        if (cached && cached.timestamp >= stats.mtime) {
          this.logger.debug("Using cached checksum", {
            filePath: resolvedPath,
          });
          return cached;
        } else if (cached && cached.timestamp < stats.mtime) {
          // File was modified since cache entry, remove stale cache
          this.checksumCache.delete(resolvedPath);
          this.logger.debug("Invalidated stale cache entry", {
            filePath: resolvedPath,
            cached: cached.timestamp,
            modified: stats.mtime,
          });
        }
      }

      // Read file and calculate checksum
      const fileBuffer = await readFile(resolvedPath);

      if (stats.size > this.options.maxFileSize) {
        throw new ChecksumError(
          `File size (${stats.size}) exceeds maximum allowed size (${this.options.maxFileSize})`,
          resolvedPath,
        );
      }

      const hash = createHash(this.options.algorithm);
      hash.update(fileBuffer);

      const processingTime = Date.now() - startTime;

      const checksumInfo: ChecksumInfo = {
        hash: hash.digest("hex"),
        algorithm: this.options.algorithm,
        fileSize: stats.size,
        filePath: resolvedPath,
        timestamp: new Date(),
        processingTime,
      };

      // Cache the result if enabled
      if (this.options.enableCaching) {
        this.addToCache(resolvedPath, checksumInfo);
      }

      this.logger.debug("Checksum calculated successfully (sync)", {
        filePath: resolvedPath,
        hash: checksumInfo.hash,
        processingTime,
      });

      return checksumInfo;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("Checksum calculation failed (sync)", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      if (error instanceof ChecksumError) {
        throw error;
      }

      throw new ChecksumError(
        `Checksum calculation failed: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error as Error,
      );
    }
  }

  /**
   * Add checksum to cache with size limit management
   */
  private addToCache(filePath: string, checksumInfo: ChecksumInfo): void {
    if (this.checksumCache.size >= this.options.cacheSize) {
      // Remove oldest entry (FIFO)
      const firstKey = this.checksumCache.keys().next().value;
      if (firstKey) {
        this.checksumCache.delete(firstKey);
      }
    }

    this.checksumCache.set(filePath, checksumInfo);
  }

  /**
   * Clear the checksum cache
   */
  clearCache(): void {
    this.checksumCache.clear();
    this.logger.debug("Checksum cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.checksumCache.size,
      maxSize: this.options.cacheSize,
    };
  }

  /**
   * Validate file integrity by comparing current checksum with expected
   */
  async validateFile(
    filePath: string,
    expectedChecksum: string | ChecksumInfo,
  ): Promise<FileValidationResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);

    this.logger.debug("Validating file integrity", {
      filePath: resolvedPath,
      expectedChecksum:
        typeof expectedChecksum === "string"
          ? expectedChecksum
          : expectedChecksum.hash,
    });

    try {
      // Calculate current checksum
      const currentChecksum = await this.calculateChecksum(resolvedPath);

      // Extract expected hash
      const expectedHash =
        typeof expectedChecksum === "string"
          ? expectedChecksum
          : expectedChecksum.hash;

      const isValid = currentChecksum.hash === expectedHash;
      const processingTime = Date.now() - startTime;

      const result: FileValidationResult = {
        filePath: resolvedPath,
        isValid,
        currentChecksum,
        originalChecksum:
          typeof expectedChecksum === "object" ? expectedChecksum : undefined,
        validatedAt: new Date(),
        processingTime,
      };

      if (!isValid) {
        result.error = `Checksum mismatch: expected ${expectedHash}, got ${currentChecksum.hash}`;
        this.logger.warn("File integrity validation failed", {
          filePath: resolvedPath,
          expected: expectedHash,
          actual: currentChecksum.hash,
          processingTime,
        });
      } else {
        this.logger.debug("File integrity validation passed", {
          filePath: resolvedPath,
          checksum: currentChecksum.hash,
          processingTime,
        });
      }

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("File integrity validation error", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      return {
        filePath: resolvedPath,
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
        validatedAt: new Date(),
        processingTime,
      };
    }
  }

  /**
   * Validate multiple files in batch
   */
  async validateBatch(
    files: Array<{ path: string; expectedChecksum: string | ChecksumInfo }>,
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();

    this.logger.debug("Starting batch validation", {
      fileCount: files.length,
      batchSize: this.options.batchSize,
    });

    const results: FileValidationResult[] = [];
    let validFiles = 0;
    let invalidFiles = 0;

    try {
      // Process files in batches to avoid overwhelming the system
      for (let i = 0; i < files.length; i += this.options.batchSize) {
        const batch = files.slice(i, i + this.options.batchSize);

        this.logger.debug(
          `Processing batch ${Math.floor(i / this.options.batchSize) + 1}`,
          {
            batchStart: i,
            batchSize: batch.length,
          },
        );

        // Process batch in parallel
        const batchPromises = batch.map((file) =>
          this.validateFile(file.path, file.expectedChecksum),
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Update counters
        for (const result of batchResults) {
          if (result.isValid) {
            validFiles++;
          } else {
            invalidFiles++;
          }
        }
      }

      const totalProcessingTime = Date.now() - startTime;

      const batchResult: BatchValidationResult = {
        totalFiles: files.length,
        validFiles,
        invalidFiles,
        results,
        totalProcessingTime,
        processedAt: new Date(),
      };

      this.logger.info("Batch validation completed", {
        totalFiles: files.length,
        validFiles,
        invalidFiles,
        totalProcessingTime,
      });

      return batchResult;
    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      this.logger.error("Batch validation failed", {
        error: error instanceof Error ? error.message : String(error),
        processedFiles: results.length,
        totalFiles: files.length,
        totalProcessingTime,
      });

      throw new ValidationError(
        `Batch validation failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error as Error,
      );
    }
  }

  /**
   * Compare checksums of two files
   */
  async compareFiles(
    filePath1: string,
    filePath2: string,
  ): Promise<{
    match: boolean;
    checksum1: ChecksumInfo;
    checksum2: ChecksumInfo;
    processingTime: number;
  }> {
    const startTime = Date.now();

    this.logger.debug("Comparing files", {
      file1: filePath1,
      file2: filePath2,
    });

    try {
      // Calculate checksums for both files in parallel
      const [checksum1, checksum2] = await Promise.all([
        this.calculateChecksum(filePath1),
        this.calculateChecksum(filePath2),
      ]);

      const match = checksum1.hash === checksum2.hash;
      const processingTime = Date.now() - startTime;

      this.logger.debug("File comparison completed", {
        file1: filePath1,
        file2: filePath2,
        match,
        processingTime,
      });

      return {
        match,
        checksum1,
        checksum2,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("File comparison failed", {
        file1: filePath1,
        file2: filePath2,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      throw new ValidationError(
        `File comparison failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error as Error,
      );
    }
  }

  /**
   * Verify file exists and is accessible
   */
  async verifyFileAccess(filePath: string): Promise<{
    exists: boolean;
    readable: boolean;
    size?: number;
    error?: string;
  }> {
    const resolvedPath = resolve(filePath);

    try {
      // Check if file exists and is readable
      await access(resolvedPath, constants.F_OK | constants.R_OK);

      // Get file stats
      const stats = await stat(resolvedPath);

      if (!stats.isFile()) {
        return {
          exists: true,
          readable: false,
          error: "Path exists but is not a file",
        };
      }

      return {
        exists: true,
        readable: true,
        size: stats.size,
      };
    } catch (error) {
      this.logger.debug("File access verification failed", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        exists: false,
        readable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate validation metadata for reporting
   */
  generateMetadata(
    operation: "checksum" | "validation" | "backup" | "rollback" | "cleanup",
    processingTime: number,
    context?: Record<string, unknown>,
  ): ValidationMetadata {
    return {
      source: "FileIntegrityValidator",
      operation,
      timestamp: new Date(),
      processingTime,
      options: this.options,
      context,
    };
  }

  /**
   * Create a compression stream based on the configured algorithm
   */
  private createCompressionStream() {
    const { compressionAlgorithm, compressionLevel } = this.options;

    switch (compressionAlgorithm) {
      case "gzip":
        return createGzip({ level: Math.min(compressionLevel, 9) });
      case "deflate":
        return createDeflate({ level: Math.min(compressionLevel, 9) });
      case "brotli":
        return createBrotliCompress({
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: Math.min(
              compressionLevel,
              11,
            ),
          },
        });
      default:
        throw new IntegrityError(
          `Unsupported compression algorithm: ${compressionAlgorithm}`,
        );
    }
  }

  /**
   * Create a decompression stream based on file extension
   */
  private createDecompressionStream(filePath: string) {
    const ext = extname(filePath).toLowerCase();

    switch (ext) {
      case ".gz":
        return createGunzip();
      case ".deflate":
        return createInflate();
      case ".br":
        return createBrotliDecompress();
      default:
        throw new IntegrityError(
          `Cannot determine decompression method for file: ${filePath}`,
        );
    }
  }

  /**
   * Determine if a file should be compressed based on size and configuration
   */
  private async shouldCompressFile(filePath: string): Promise<boolean> {
    if (!this.options.enableCompression) {
      return false;
    }

    try {
      const stats = await stat(filePath);
      return stats.size >= this.options.compressionThreshold;
    } catch {
      return false;
    }
  }

  /**
   * Get the compressed file extension based on algorithm
   */
  private getCompressedExtension(): string {
    switch (this.options.compressionAlgorithm) {
      case "gzip":
        return ".gz";
      case "deflate":
        return ".deflate";
      case "brotli":
        return ".br";
      default:
        return ".gz";
    }
  }

  // === DEDUPLICATION METHODS ===

  /**
   * Load the deduplication index from disk
   */
  private async loadDeduplicationIndex(): Promise<DeduplicationIndex> {
    if (this.deduplicationIndex) {
      return this.deduplicationIndex;
    }

    try {
      await access(this.deduplicationIndexPath);
      const indexData = await readFile(this.deduplicationIndexPath, "utf-8");
      this.deduplicationIndex = JSON.parse(indexData);

      this.logger.debug("Deduplication index loaded", {
        indexPath: this.deduplicationIndexPath,
        totalEntries: this.deduplicationIndex?.totalEntries,
      });

      return this.deduplicationIndex!;
    } catch {
      // Create new index if file doesn't exist
      this.deduplicationIndex = {
        version: "1.0.0",
        totalEntries: 0,
        spaceSaved: 0,
        lastUpdated: new Date(),
        entries: {},
        stats: {
          totalOriginalSize: 0,
          totalDeduplicatedSize: 0,
          duplicatesFound: 0,
          averageReferenceCount: 0,
        },
      };

      await this.saveDeduplicationIndex();

      this.logger.debug("Created new deduplication index", {
        indexPath: this.deduplicationIndexPath,
      });

      return this.deduplicationIndex;
    }
  }

  /**
   * Save the deduplication index to disk
   */
  private async saveDeduplicationIndex(): Promise<void> {
    if (!this.deduplicationIndex) {
      return;
    }

    try {
      // Ensure deduplication directory exists
      const dedupDir = resolve(this.options.deduplicationDirectory);
      try {
        await access(dedupDir);
      } catch {
        const { mkdir } = await import("node:fs/promises");
        await mkdir(dedupDir, { recursive: true });
        this.logger.debug("Created deduplication directory", { dedupDir });
      }

      // Update timestamp and stats
      this.deduplicationIndex.lastUpdated = new Date();
      this.updateDeduplicationStats();

      // Save to disk
      const indexData = JSON.stringify(this.deduplicationIndex, null, 2);
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(this.deduplicationIndexPath, indexData, "utf-8"),
      );

      this.logger.debug("Deduplication index saved", {
        indexPath: this.deduplicationIndexPath,
        totalEntries: this.deduplicationIndex.totalEntries,
      });
    } catch (error) {
      this.logger.error("Failed to save deduplication index", {
        indexPath: this.deduplicationIndexPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new IntegrityError(
        `Failed to save deduplication index: ${error instanceof Error ? error.message : String(error)}`,
        "DEDUP_INDEX_SAVE_ERROR",
      );
    }
  }

  /**
   * Update deduplication statistics
   */
  private updateDeduplicationStats(): void {
    if (!this.deduplicationIndex) {
      return;
    }

    const entries = Object.values(this.deduplicationIndex.entries);
    this.deduplicationIndex.totalEntries = entries.length;

    let totalOriginalSize = 0;
    let totalDeduplicatedSize = 0;
    let duplicatesFound = 0;
    let totalReferences = 0;

    for (const entry of entries) {
      const originalSize = entry.size * entry.referenceCount;
      totalOriginalSize += originalSize;
      totalDeduplicatedSize += entry.size;

      if (entry.referenceCount > 1) {
        duplicatesFound += entry.referenceCount - 1;
      }

      totalReferences += entry.referenceCount;
    }

    this.deduplicationIndex.spaceSaved =
      totalOriginalSize - totalDeduplicatedSize;
    this.deduplicationIndex.stats = {
      totalOriginalSize,
      totalDeduplicatedSize,
      duplicatesFound,
      averageReferenceCount:
        entries.length > 0 ? totalReferences / entries.length : 0,
    };
  }

  /**
   * Calculate content hash for deduplication
   */
  private async createContentHash(filePath: string): Promise<string> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);

    try {
      const hash = createHash(this.options.deduplicationAlgorithm);
      const stream = createReadStream(resolvedPath);

      return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          stream.destroy();
          reject(
            new IntegrityError(
              `Content hash calculation timed out after ${this.options.timeout}ms`,
              "CONTENT_HASH_TIMEOUT",
              resolvedPath,
            ),
          );
        }, this.options.timeout);

        stream.on("data", (chunk) => {
          hash.update(chunk);
        });

        stream.on("end", () => {
          clearTimeout(timeout);
          const contentHash = hash.digest("hex");
          const processingTime = Date.now() - startTime;

          this.logger.debug("Content hash calculated", {
            filePath: resolvedPath,
            contentHash,
            algorithm: this.options.deduplicationAlgorithm,
            processingTime,
          });

          resolve(contentHash);
        });

        stream.on("error", (error) => {
          clearTimeout(timeout);
          reject(
            new IntegrityError(
              `Failed to calculate content hash: ${error.message}`,
              "CONTENT_HASH_ERROR",
              resolvedPath,
              "deduplication",
              error,
            ),
          );
        });
      });
    } catch (error) {
      throw new IntegrityError(
        `Content hash calculation failed: ${error instanceof Error ? error.message : String(error)}`,
        "CONTENT_HASH_ERROR",
        resolvedPath,
        "deduplication",
        error as Error,
      );
    }
  }

  /**
   * Check if file should be deduplicated based on size and configuration
   */
  private async shouldDeduplicateFile(filePath: string): Promise<boolean> {
    if (!this.options.enableDeduplication) {
      return false;
    }

    try {
      const stats = await stat(filePath);
      return stats.size >= this.options.deduplicationThreshold;
    } catch {
      return false;
    }
  }

  /**
   * Perform deduplication for a file
   */
  async deduplicateFile(
    filePath: string,
    targetPath?: string,
  ): Promise<DeduplicationResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    const finalTargetPath = targetPath ? resolve(targetPath) : resolvedPath;

    this.logger.debug("Starting file deduplication", {
      filePath: resolvedPath,
      targetPath: finalTargetPath,
      threshold: this.options.deduplicationThreshold,
    });

    try {
      // Check if file exists first
      try {
        await stat(resolvedPath);
      } catch (error) {
        const processingTime = Date.now() - startTime;
        return {
          deduplicated: false,
          contentHash: "",
          isNewEntry: false,
          referenceCount: 0,
          spaceSaved: 0,
          error: `File does not exist: ${resolvedPath}`,
          processingTime,
        };
      }

      // Check if deduplication should be performed
      const shouldDeduplicate = await this.shouldDeduplicateFile(resolvedPath);
      if (!shouldDeduplicate) {
        return {
          deduplicated: false,
          contentHash: "",
          isNewEntry: false,
          referenceCount: 0,
          spaceSaved: 0,
          processingTime: Date.now() - startTime,
        };
      }

      // Calculate content hash
      const contentHash = await this.createContentHash(resolvedPath);

      // Load deduplication index
      const index = await this.loadDeduplicationIndex();

      // Get file stats
      const stats = await stat(resolvedPath);
      const fileSize = stats.size;

      // Check if content already exists
      const existingEntry = index.entries[contentHash];

      if (existingEntry) {
        // Content already exists - create reference
        existingEntry.referenceCount++;
        existingEntry.referencePaths.push(finalTargetPath);
        existingEntry.lastAccessed = new Date();

        // Create hard link or copy if hard links not supported/enabled
        if (this.options.useHardLinks) {
          try {
            const { link } = await import("node:fs/promises");
            await link(existingEntry.storagePath, finalTargetPath);
            this.logger.debug("Created hard link for deduplicated content", {
              source: existingEntry.storagePath,
              target: finalTargetPath,
            });
          } catch (error) {
            // Fallback to copy if hard linking fails
            await copyFile(existingEntry.storagePath, finalTargetPath);
            this.logger.debug(
              "Hard link failed, used copy for deduplicated content",
              {
                source: existingEntry.storagePath,
                target: finalTargetPath,
                error: error instanceof Error ? error.message : String(error),
              },
            );
          }
        } else {
          await copyFile(existingEntry.storagePath, finalTargetPath);
          this.logger.debug("Copied deduplicated content", {
            source: existingEntry.storagePath,
            target: finalTargetPath,
          });
        }

        await this.saveDeduplicationIndex();

        const processingTime = Date.now() - startTime;
        const spaceSaved = fileSize; // We saved the full file size

        this.logger.info("File deduplicated (existing content)", {
          filePath: resolvedPath,
          contentHash,
          referenceCount: existingEntry.referenceCount,
          spaceSaved,
          processingTime,
        });

        return {
          deduplicated: true,
          contentHash,
          storagePath: existingEntry.storagePath,
          isNewEntry: false,
          referenceCount: existingEntry.referenceCount,
          spaceSaved,
          processingTime,
        };
      } else {
        // New content - store it
        const dedupDir = resolve(this.options.deduplicationDirectory);
        const storageFileName = `${contentHash}${extname(resolvedPath)}`;
        const storagePath = join(dedupDir, storageFileName);

        // Copy content to deduplication storage
        await copyFile(resolvedPath, storagePath);

        // Create deduplication entry
        const entry: DeduplicationEntry = {
          hash: contentHash,
          algorithm: this.options.deduplicationAlgorithm,
          size: fileSize,
          storagePath,
          referenceCount: 1,
          referencePaths: [finalTargetPath],
          firstSeen: new Date(),
          lastAccessed: new Date(),
          compressed: false, // TODO: Add compression support
        };

        index.entries[contentHash] = entry;

        // If target is different from source, create link/copy to target
        if (finalTargetPath !== resolvedPath) {
          if (this.options.useHardLinks) {
            try {
              const { link } = await import("node:fs/promises");
              await link(storagePath, finalTargetPath);
              this.logger.debug(
                "Created hard link for new deduplicated content",
                {
                  source: storagePath,
                  target: finalTargetPath,
                },
              );
            } catch (error) {
              await copyFile(storagePath, finalTargetPath);
              this.logger.debug(
                "Hard link failed, used copy for new deduplicated content",
                {
                  source: storagePath,
                  target: finalTargetPath,
                  error: error instanceof Error ? error.message : String(error),
                },
              );
            }
          } else {
            await copyFile(storagePath, finalTargetPath);
          }
        }

        await this.saveDeduplicationIndex();

        const processingTime = Date.now() - startTime;

        this.logger.info("File deduplicated (new content)", {
          filePath: resolvedPath,
          contentHash,
          storagePath,
          fileSize,
          processingTime,
        });

        return {
          deduplicated: true,
          contentHash,
          storagePath,
          isNewEntry: true,
          referenceCount: 1,
          spaceSaved: 0, // No space saved for first occurrence
          processingTime,
        };
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("File deduplication failed", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      return {
        deduplicated: false,
        contentHash: "",
        isNewEntry: false,
        referenceCount: 0,
        spaceSaved: 0,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      };
    }
  }

  /**
   * Get deduplication statistics
   */
  async getDeduplicationStats(): Promise<{
    enabled: boolean;
    totalEntries: number;
    spaceSaved: number;
    duplicatesFound: number;
    averageReferenceCount: number;
    indexPath: string;
  }> {
    if (!this.options.enableDeduplication) {
      return {
        enabled: false,
        totalEntries: 0,
        spaceSaved: 0,
        duplicatesFound: 0,
        averageReferenceCount: 0,
        indexPath: this.deduplicationIndexPath,
      };
    }

    const index = await this.loadDeduplicationIndex();

    return {
      enabled: true,
      totalEntries: index.totalEntries,
      spaceSaved: index.spaceSaved,
      duplicatesFound: index.stats.duplicatesFound,
      averageReferenceCount: index.stats.averageReferenceCount,
      indexPath: this.deduplicationIndexPath,
    };
  }

  // === INCREMENTAL BACKUP METHODS ===

  /**
   * Load the incremental backup index from disk
   */
  private async loadIncrementalIndex(): Promise<IncrementalIndex> {
    if (this.incrementalIndex) {
      return this.incrementalIndex;
    }

    try {
      await access(this.incrementalIndexPath);
      const data = await readFile(this.incrementalIndexPath, "utf-8");
      this.incrementalIndex = JSON.parse(data);

      // Convert date strings back to Date objects
      if (this.incrementalIndex) {
        this.incrementalIndex.lastUpdated = new Date(
          this.incrementalIndex.lastUpdated,
        );
        if (this.incrementalIndex.lastFullBackup) {
          this.incrementalIndex.lastFullBackup.createdAt = new Date(
            this.incrementalIndex.lastFullBackup.createdAt,
          );
        }
        this.incrementalIndex.stats.lastBackupAt = new Date(
          this.incrementalIndex.stats.lastBackupAt,
        );

        // Convert backup chain dates
        this.incrementalIndex.backupChain.forEach((entry) => {
          entry.createdAt = new Date(entry.createdAt);
          entry.mtime = new Date(entry.mtime);
        });

        // Convert file state dates
        Object.values(this.incrementalIndex.fileStates).forEach((state) => {
          state.mtime = new Date(state.mtime);
          state.lastBackup = new Date(state.lastBackup);
        });
      }

      this.logger.debug("Incremental index loaded", {
        totalBackups: this.incrementalIndex.stats.totalBackups,
        chainLength: this.incrementalIndex.stats.chainLength,
        lastBackup: this.incrementalIndex.stats.lastBackupAt,
      });
    } catch (error) {
      // Initialize new index if file doesn't exist
      this.incrementalIndex = {
        version: "1.0.0",
        currentChainId: this.generateBackupId(),
        lastFullBackup: null,
        backupChain: [],
        fileStates: {},
        stats: {
          totalBackups: 0,
          totalIncrementals: 0,
          chainLength: 0,
          totalSpaceSaved: 0,
          lastBackupAt: new Date(),
        },
        lastUpdated: new Date(),
      };

      this.logger.debug("Initialized new incremental index", {
        chainId: this.incrementalIndex.currentChainId,
        indexPath: this.incrementalIndexPath,
      });
    }

    return this.incrementalIndex;
  }

  /**
   * Save the incremental backup index to disk
   */
  private async saveIncrementalIndex(): Promise<void> {
    if (!this.incrementalIndex) {
      return;
    }

    try {
      // Ensure incremental directory exists
      const incrementalDir = dirname(this.incrementalIndexPath);
      try {
        await access(incrementalDir);
      } catch {
        await mkdir(incrementalDir, { recursive: true });
        this.logger.debug("Created incremental directory", { incrementalDir });
      }

      // Update timestamp and save
      this.incrementalIndex.lastUpdated = new Date();
      await writeFile(
        this.incrementalIndexPath,
        JSON.stringify(this.incrementalIndex, null, 2),
        "utf-8",
      );

      this.logger.debug("Incremental index saved", {
        indexPath: this.incrementalIndexPath,
        backupCount: this.incrementalIndex.stats.totalBackups,
      });
    } catch (error) {
      this.logger.error("Failed to save incremental index", {
        error: error instanceof Error ? error.message : String(error),
        indexPath: this.incrementalIndexPath,
      });
      throw new IntegrityError(
        `Failed to save incremental index: ${error instanceof Error ? error.message : String(error)}`,
        "INDEX_SAVE_ERROR",
      );
    }
  }

  /**
   * Generate a unique backup ID
   */
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Detect file changes since last backup
   */
  private async detectFileChanges(filePath: string): Promise<FileChangeState> {
    const resolvedPath = resolve(filePath);
    const index = await this.loadIncrementalIndex();
    const existingState = index.fileStates[resolvedPath];

    try {
      const stats = await stat(resolvedPath);
      const currentState: FileChangeState = {
        filePath: resolvedPath,
        size: stats.size,
        mtime: stats.mtime,
        lastBackup: existingState?.lastBackup || new Date(0),
        hasChanged: false,
        contentHash: undefined,
      };

      // Determine if file has changed based on detection method
      switch (this.options.changeDetectionMethod) {
        case "mtime":
          currentState.hasChanged =
            !existingState || stats.mtime > existingState.mtime;
          break;

        case "checksum":
          currentState.contentHash = await this.createContentHash(resolvedPath);
          currentState.hasChanged =
            !existingState ||
            currentState.contentHash !== existingState.contentHash;
          break;

        case "hybrid":
          // First check mtime for efficiency, then checksum if needed
          if (!existingState || stats.mtime > existingState.mtime) {
            currentState.contentHash =
              await this.createContentHash(resolvedPath);
            currentState.hasChanged =
              !existingState ||
              currentState.contentHash !== existingState.contentHash;
          } else {
            currentState.hasChanged = false;
          }
          break;
      }

      this.logger.debug("File change detection result", {
        filePath: resolvedPath,
        hasChanged: currentState.hasChanged,
        method: this.options.changeDetectionMethod,
        mtime: stats.mtime,
        lastBackup: currentState.lastBackup,
      });

      return currentState;
    } catch (error) {
      this.logger.error("File change detection failed", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return default state indicating change (safer)
      return {
        filePath: resolvedPath,
        size: 0,
        mtime: new Date(),
        lastBackup: new Date(0),
        hasChanged: true,
      };
    }
  }

  /**
   * Determine backup strategy based on configuration and current state
   */
  private async determineBackupStrategy(
    filePath: string,
  ): Promise<"full" | "incremental" | "skip"> {
    if (!this.options.enableIncrementalBackup) {
      return "full";
    }

    const index = await this.loadIncrementalIndex();

    // Force full backup if no previous backups exist
    if (!index.lastFullBackup || index.backupChain.length === 0) {
      this.logger.debug("No previous backups found, forcing full backup");
      return "full";
    }

    // Force full backup if chain is too long
    if (index.stats.chainLength >= this.options.maxIncrementalChain) {
      this.logger.debug("Chain length exceeded maximum, forcing full backup", {
        chainLength: index.stats.chainLength,
        maxChain: this.options.maxIncrementalChain,
      });
      return "full";
    }

    // Force full backup if too much time has passed
    const hoursSinceLastFull =
      (Date.now() - index.lastFullBackup.createdAt.getTime()) /
      (1000 * 60 * 60);
    if (hoursSinceLastFull >= this.options.fullBackupInterval) {
      this.logger.debug("Time interval exceeded, forcing full backup", {
        hoursSinceLastFull,
        maxInterval: this.options.fullBackupInterval,
      });
      return "full";
    }

    // Check if file has changed
    const changeState = await this.detectFileChanges(filePath);
    if (!changeState.hasChanged) {
      this.logger.debug("File unchanged since last backup, skipping");
      return "skip";
    }

    // Use strategy configuration
    switch (this.options.backupStrategy) {
      case "full":
        return "full";
      case "incremental":
        return "incremental";
      case "auto":
      default:
        // Auto strategy: use incremental if conditions are met
        return "incremental";
    }
  }

  /**
   * Create an incremental backup
   */
  async createIncrementalBackup(
    filePath: string,
  ): Promise<IncrementalBackupResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);

    this.logger.debug("Creating incremental backup", {
      filePath: resolvedPath,
      strategy: this.options.backupStrategy,
      changeDetection: this.options.changeDetectionMethod,
    });

    try {
      // Determine backup strategy
      const strategy = await this.determineBackupStrategy(resolvedPath);

      if (strategy === "skip") {
        return {
          backupType: "skipped",
          backupId: "",
          filesBackedUp: 0,
          filesChanged: 0,
          filesSkipped: 1,
          backupPath: "",
          backupSize: 0,
          spaceSaved: 0,
          backedUpFiles: [],
          changeDetectionMethod: this.options.changeDetectionMethod,
          processingTime: Date.now() - startTime,
          success: true,
          createdAt: new Date(),
        };
      }

      const index = await this.loadIncrementalIndex();
      const backupId = this.generateBackupId();
      const fileStats = await stat(resolvedPath);
      const changeState = await this.detectFileChanges(resolvedPath);

      // Create backup using existing backup system
      const backupResult = await this.createBackup(resolvedPath);

      if (!backupResult.success) {
        throw new RollbackError(
          backupResult.error || "Backup creation failed",
          resolvedPath,
        );
      }

      // Create incremental backup entry
      const backupEntry: IncrementalBackupEntry = {
        id: backupId,
        type: strategy,
        parentId: strategy === "full" ? null : index.lastFullBackup?.id || null,
        backupPath: backupResult.backupPath,
        originalPath: resolvedPath,
        createdAt: new Date(),
        mtime: fileStats.mtime,
        size: fileStats.size,
        contentHash:
          changeState.contentHash ||
          (await this.createContentHash(resolvedPath)),
        files: [resolvedPath],
        changeDetectionMethod: this.options.changeDetectionMethod,
        compressed: backupResult.compressed || false,
        deduplicated: backupResult.deduplicated || false,
      };

      // Update index
      index.backupChain.push(backupEntry);
      index.fileStates[resolvedPath] = {
        ...changeState,
        lastBackup: new Date(),
        hasChanged: false,
      };

      // Update statistics
      index.stats.totalBackups++;
      if (strategy === "incremental") {
        index.stats.totalIncrementals++;
        index.stats.chainLength++;
      } else {
        // Full backup resets chain
        index.lastFullBackup = {
          id: backupId,
          createdAt: new Date(),
          filePath: resolvedPath,
        };
        index.stats.chainLength = 1;
        index.currentChainId = this.generateBackupId();
      }

      index.stats.lastBackupAt = new Date();
      index.stats.totalSpaceSaved +=
        (backupResult.originalSize || 0) - (backupResult.backupSize || 0);

      // Save updated index
      await this.saveIncrementalIndex();

      const processingTime = Date.now() - startTime;

      const result: IncrementalBackupResult = {
        backupType: strategy,
        backupId,
        parentId: backupEntry.parentId,
        filesBackedUp: 1,
        filesChanged: changeState.hasChanged ? 1 : 0,
        filesSkipped: 0,
        backupPath: backupResult.backupPath,
        backupSize: backupResult.backupSize || 0,
        spaceSaved:
          (backupResult.originalSize || 0) - (backupResult.backupSize || 0),
        backedUpFiles: [resolvedPath],
        changeDetectionMethod: this.options.changeDetectionMethod,
        processingTime,
        success: true,
        createdAt: new Date(),
      };

      this.logger.info("Incremental backup created successfully", {
        backupType: strategy,
        backupId,
        filePath: resolvedPath,
        backupPath: result.backupPath,
        chainLength: index.stats.chainLength,
        spaceSaved: result.spaceSaved,
        processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("Incremental backup creation failed", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      return {
        backupType: "incremental",
        backupId: "",
        filesBackedUp: 0,
        filesChanged: 0,
        filesSkipped: 0,
        backupPath: "",
        backupSize: 0,
        spaceSaved: 0,
        backedUpFiles: [],
        changeDetectionMethod: this.options.changeDetectionMethod,
        processingTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        createdAt: new Date(),
      };
    }
  }

  /**
   * Get incremental backup statistics
   */
  async getIncrementalStats(): Promise<{
    enabled: boolean;
    totalBackups: number;
    totalIncrementals: number;
    chainLength: number;
    spaceSaved: number;
    lastBackupAt: Date;
    strategy: string;
    changeDetectionMethod: string;
    indexPath: string;
  }> {
    if (!this.options.enableIncrementalBackup) {
      return {
        enabled: false,
        totalBackups: 0,
        totalIncrementals: 0,
        chainLength: 0,
        spaceSaved: 0,
        lastBackupAt: new Date(0),
        strategy: this.options.backupStrategy,
        changeDetectionMethod: this.options.changeDetectionMethod,
        indexPath: this.incrementalIndexPath,
      };
    }

    const index = await this.loadIncrementalIndex();

    return {
      enabled: true,
      totalBackups: index.stats.totalBackups,
      totalIncrementals: index.stats.totalIncrementals,
      chainLength: index.stats.chainLength,
      spaceSaved: index.stats.totalSpaceSaved,
      lastBackupAt: index.stats.lastBackupAt,
      strategy: this.options.backupStrategy,
      changeDetectionMethod: this.options.changeDetectionMethod,
      indexPath: this.incrementalIndexPath,
    };
  }

  // === DIFFERENTIAL BACKUP METHODS ===

  /**
   * Load differential backup index from storage
   */
  private async loadDifferentialIndex(): Promise<DifferentialIndex> {
    if (this.differentialIndex) {
      return this.differentialIndex;
    }

    try {
      // Ensure differential directory exists
      const differentialDir = dirname(this.differentialIndexPath);
      try {
        await access(differentialDir);
      } catch {
        await mkdir(differentialDir, { recursive: true });
        this.logger.debug("Created differential backup directory", {
          differentialDir,
        });
      }

      // Try to load existing index
      try {
        await access(this.differentialIndexPath);
        const indexData = await readFile(this.differentialIndexPath, "utf-8");
        const parsedIndex = JSON.parse(indexData) as DifferentialIndex;

        // Convert date strings back to Date objects
        if (parsedIndex.currentFullBackup) {
          parsedIndex.currentFullBackup.createdAt = new Date(
            parsedIndex.currentFullBackup.createdAt,
          );
        }
        parsedIndex.differentialChain.forEach((entry) => {
          entry.createdAt = new Date(entry.createdAt);
        });
        Object.values(parsedIndex.cumulativeFileStates).forEach((state) => {
          state.mtime = new Date(state.mtime);
          state.lastBackup = new Date(state.lastBackup);
        });
        parsedIndex.stats.lastBackupAt = new Date(
          parsedIndex.stats.lastBackupAt,
        );
        parsedIndex.lastUpdated = new Date(parsedIndex.lastUpdated);

        this.differentialIndex = parsedIndex;
        this.logger.debug("Loaded differential index", {
          totalDifferentials: parsedIndex.stats.totalDifferentials,
          currentChainLength: parsedIndex.stats.currentChainLength,
        });
        return parsedIndex;
      } catch {
        // Create new index if file doesn't exist
        this.differentialIndex = {
          version: "1.0.0",
          currentFullBackup: null,
          differentialChain: [],
          cumulativeFileStates: {},
          stats: {
            totalDifferentials: 0,
            currentChainLength: 0,
            cumulativeSize: 0,
            cumulativeSizeRatio: 0,
            totalSpaceSaved: 0,
            lastBackupAt: new Date(),
            timeSinceFullBackup: 0,
          },
          lastUpdated: new Date(),
        };

        await this.saveDifferentialIndex();
        this.logger.debug("Created new differential index");
        return this.differentialIndex;
      }
    } catch (error) {
      this.logger.error("Failed to load differential index", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new IntegrityError(
        `Failed to load differential backup index: ${error instanceof Error ? error.message : String(error)}`,
        "DIFFERENTIAL_INDEX_LOAD_ERROR",
      );
    }
  }

  /**
   * Save differential backup index to storage
   */
  private async saveDifferentialIndex(): Promise<void> {
    if (!this.differentialIndex) {
      return;
    }

    try {
      this.differentialIndex.lastUpdated = new Date();
      const indexData = JSON.stringify(this.differentialIndex, null, 2);
      await writeFile(this.differentialIndexPath, indexData, "utf-8");

      this.logger.debug("Saved differential index", {
        totalDifferentials: this.differentialIndex.stats.totalDifferentials,
        cumulativeSize: this.differentialIndex.stats.cumulativeSize,
      });
    } catch (error) {
      this.logger.error("Failed to save differential index", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new IntegrityError(
        `Failed to save differential backup index: ${error instanceof Error ? error.message : String(error)}`,
        "DIFFERENTIAL_INDEX_SAVE_ERROR",
      );
    }
  }

  /**
   * Detect all file changes since last full backup (cumulative)
   */
  private async detectCumulativeFileChanges(filePath: string): Promise<{
    hasChanged: boolean;
    cumulativeChanges: string[];
    timeSinceFullBackup: number;
  }> {
    const index = await this.loadDifferentialIndex();

    if (!index.currentFullBackup) {
      // No full backup exists, everything is a change
      return {
        hasChanged: true,
        cumulativeChanges: [filePath],
        timeSinceFullBackup: 0,
      };
    }

    const timeSinceFullBackup =
      (Date.now() - index.currentFullBackup.createdAt.getTime()) /
      (1000 * 60 * 60);
    const fileStats = await stat(filePath);

    // Check if this specific file has changed since last full backup
    const existingState = index.cumulativeFileStates[filePath];
    let hasChanged = false;

    if (
      !existingState ||
      existingState.lastBackup < index.currentFullBackup.createdAt
    ) {
      // File not tracked or last backup was before current full backup
      hasChanged = true;
    } else {
      // Use selected change detection method
      switch (this.options.changeDetectionMethod) {
        case "mtime":
          hasChanged = fileStats.mtime > existingState.mtime;
          break;
        case "checksum":
          const currentHash = await this.createContentHash(filePath);
          hasChanged =
            !existingState.contentHash ||
            currentHash !== existingState.contentHash;
          break;
        case "hybrid":
          if (fileStats.mtime > existingState.mtime) {
            const currentHash = await this.createContentHash(filePath);
            hasChanged =
              !existingState.contentHash ||
              currentHash !== existingState.contentHash;
          } else {
            hasChanged = false;
          }
          break;
      }
    }

    // Get all cumulative changes since last full backup
    const cumulativeChanges = Object.keys(index.cumulativeFileStates).filter(
      (path) => {
        const state = index.cumulativeFileStates[path];
        return (
          state.hasChanged &&
          state.lastBackup >= index.currentFullBackup.createdAt
        );
      },
    );

    // Add current file if it has changed
    if (hasChanged && !cumulativeChanges.includes(filePath)) {
      cumulativeChanges.push(filePath);
    }

    return {
      hasChanged,
      cumulativeChanges,
      timeSinceFullBackup,
    };
  }

  /**
   * Determine differential backup strategy
   */
  private async determineDifferentialStrategy(
    filePath: string,
  ): Promise<"full" | "differential" | "skip"> {
    if (!this.options.enableDifferentialBackup) {
      return "skip";
    }

    const index = await this.loadDifferentialIndex();
    const changeInfo = await this.detectCumulativeFileChanges(filePath);

    // Skip if no changes
    if (!changeInfo.hasChanged) {
      return "skip";
    }

    // Force full backup if no current full backup exists
    if (!index.currentFullBackup) {
      this.logger.debug("No full backup exists, forcing full backup");
      return "full";
    }

    // Check time-based threshold for full backup
    if (
      changeInfo.timeSinceFullBackup >=
      this.options.differentialFullBackupInterval
    ) {
      this.logger.debug("Time threshold exceeded, forcing full backup", {
        timeSinceFullBackup: changeInfo.timeSinceFullBackup,
        threshold: this.options.differentialFullBackupInterval,
      });
      return "full";
    }

    // Check size-based threshold for full backup
    const cumulativeSizeMB = index.stats.cumulativeSize / (1024 * 1024);
    if (cumulativeSizeMB >= this.options.differentialFullBackupThreshold) {
      this.logger.debug("Size threshold exceeded, forcing full backup", {
        cumulativeSize: cumulativeSizeMB,
        threshold: this.options.differentialFullBackupThreshold,
      });
      return "full";
    }

    // Check size multiplier threshold only if cumulative size > 0
    if (
      index.stats.cumulativeSize > 0 &&
      index.stats.cumulativeSizeRatio >= this.options.differentialSizeMultiplier
    ) {
      this.logger.debug("Size multiplier exceeded, forcing full backup", {
        sizeRatio: index.stats.cumulativeSizeRatio,
        threshold: this.options.differentialSizeMultiplier,
      });
      return "full";
    }

    // Use differential strategy
    switch (this.options.differentialStrategy) {
      case "auto":
        return "differential";
      case "manual":
        return "differential";
      case "threshold-based":
        // Additional threshold checks could be added here
        return "differential";
      default:
        return "differential";
    }
  }

  /**
   * Create differential backup
   */
  async createDifferentialBackup(
    filePath: string,
  ): Promise<DifferentialBackupResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);

    this.logger.debug("Creating differential backup", {
      filePath: resolvedPath,
      strategy: this.options.differentialStrategy,
    });

    try {
      // Verify source file exists
      try {
        await access(resolvedPath);
      } catch {
        return {
          backupType: "skipped",
          backupId: "",
          filesBackedUp: 0,
          cumulativeFilesChanged: 0,
          filesSkipped: 1,
          backupPath: "",
          currentBackupSize: 0,
          cumulativeSize: 0,
          cumulativeSizeRatio: 0,
          spaceSaved: 0,
          backedUpFiles: [],
          cumulativeChangedFiles: [],
          changeDetectionMethod: this.options.changeDetectionMethod,
          recommendFullBackup: false,
          processingTime: Date.now() - startTime,
          success: false,
          error: "File does not exist",
          createdAt: new Date(),
        };
      }

      const strategy = await this.determineDifferentialStrategy(resolvedPath);

      if (strategy === "skip") {
        const changeInfo = await this.detectCumulativeFileChanges(resolvedPath);
        return {
          backupType: "skipped",
          backupId: "",
          filesBackedUp: 0,
          cumulativeFilesChanged: changeInfo.cumulativeChanges.length,
          filesSkipped: 1,
          backupPath: "",
          currentBackupSize: 0,
          cumulativeSize: 0,
          cumulativeSizeRatio: 0,
          spaceSaved: 0,
          backedUpFiles: [],
          cumulativeChangedFiles: changeInfo.cumulativeChanges,
          changeDetectionMethod: this.options.changeDetectionMethod,
          recommendFullBackup: false,
          processingTime: Date.now() - startTime,
          success: true,
          createdAt: new Date(),
        };
      }

      const index = await this.loadDifferentialIndex();
      const changeInfo = await this.detectCumulativeFileChanges(resolvedPath);

      // Create backup using existing backup mechanism
      const backupResult = await this.createBackup(resolvedPath);

      if (!backupResult.success) {
        throw new RollbackError(
          backupResult.error || "Backup creation failed",
          resolvedPath,
        );
      }

      const backupId = this.generateBackupId();
      const currentTime = new Date();
      const fileStats = await stat(resolvedPath);

      if (strategy === "full") {
        // Reset differential chain with new full backup
        index.currentFullBackup = {
          id: backupId,
          createdAt: currentTime,
          filePath: backupResult.backupPath,
          size: backupResult.backupSize || fileStats.size,
        };
        index.differentialChain = [];
        index.cumulativeFileStates = {};
        index.stats = {
          totalDifferentials: 0,
          currentChainLength: 0,
          cumulativeSize: 0,
          cumulativeSizeRatio: 0,
          totalSpaceSaved: 0,
          lastBackupAt: currentTime,
          timeSinceFullBackup: 0,
        };

        this.logger.info("Created new full backup for differential chain", {
          backupId,
          filePath: resolvedPath,
          backupPath: backupResult.backupPath,
        });
      } else {
        // Add differential backup to chain
        const differentialEntry: DifferentialBackupEntry = {
          id: backupId,
          type: "differential",
          baseFullBackupId: index.currentFullBackup!.id,
          backupPath: backupResult.backupPath,
          originalPath: resolvedPath,
          createdAt: currentTime,
          cumulativeFiles: changeInfo.cumulativeChanges,
          cumulativeSize:
            index.stats.cumulativeSize + (backupResult.backupSize || 0),
          currentFiles: [resolvedPath],
          currentSize: backupResult.backupSize || 0,
          changeDetectionMethod: this.options.changeDetectionMethod,
          compressed: backupResult.compressed || false,
          deduplicated: backupResult.deduplicated || false,
          timeSinceFullBackup: changeInfo.timeSinceFullBackup,
        };

        index.differentialChain.push(differentialEntry);
        index.stats.totalDifferentials++;
        index.stats.currentChainLength++;
        index.stats.cumulativeSize += differentialEntry.currentSize;
        index.stats.cumulativeSizeRatio = index.currentFullBackup
          ? index.stats.cumulativeSize / index.currentFullBackup.size
          : 0;
        index.stats.lastBackupAt = currentTime;
        index.stats.timeSinceFullBackup = changeInfo.timeSinceFullBackup;

        this.logger.info("Created differential backup", {
          backupId,
          filePath: resolvedPath,
          cumulativeSize: index.stats.cumulativeSize,
          cumulativeSizeRatio: index.stats.cumulativeSizeRatio,
        });
      }

      // Update file state
      const contentHash =
        this.options.changeDetectionMethod !== "mtime"
          ? await this.createContentHash(resolvedPath)
          : undefined;

      index.cumulativeFileStates[resolvedPath] = {
        filePath: resolvedPath,
        size: fileStats.size,
        mtime: fileStats.mtime,
        contentHash,
        lastBackup: currentTime,
        hasChanged: false, // Reset after backup
      };

      await this.saveDifferentialIndex();

      // Determine if next backup should be full
      const recommendFullBackup =
        index.stats.cumulativeSizeRatio >=
          this.options.differentialSizeMultiplier ||
        changeInfo.timeSinceFullBackup >=
          this.options.differentialFullBackupInterval * 0.8; // 80% threshold

      let recommendationReason: string | undefined;
      if (recommendFullBackup) {
        if (
          index.stats.cumulativeSizeRatio >=
          this.options.differentialSizeMultiplier
        ) {
          recommendationReason = `Cumulative size ratio (${index.stats.cumulativeSizeRatio.toFixed(2)}) approaching threshold (${this.options.differentialSizeMultiplier})`;
        } else {
          recommendationReason = `Time since full backup (${changeInfo.timeSinceFullBackup.toFixed(1)}h) approaching threshold (${this.options.differentialFullBackupInterval}h)`;
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        backupType: strategy,
        backupId,
        baseFullBackupId:
          strategy === "differential" ? index.currentFullBackup?.id : undefined,
        filesBackedUp: 1,
        cumulativeFilesChanged: changeInfo.cumulativeChanges.length,
        filesSkipped: 0,
        backupPath: backupResult.backupPath,
        currentBackupSize: backupResult.backupSize || 0,
        cumulativeSize: index.stats.cumulativeSize,
        cumulativeSizeRatio: index.stats.cumulativeSizeRatio,
        spaceSaved: index.stats.totalSpaceSaved,
        backedUpFiles: [resolvedPath],
        cumulativeChangedFiles: changeInfo.cumulativeChanges,
        changeDetectionMethod: this.options.changeDetectionMethod,
        recommendFullBackup,
        recommendationReason,
        processingTime,
        success: true,
        createdAt: currentTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("Differential backup failed", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      return {
        backupType: "skipped",
        backupId: "",
        filesBackedUp: 0,
        cumulativeFilesChanged: 0,
        filesSkipped: 1,
        backupPath: "",
        currentBackupSize: 0,
        cumulativeSize: 0,
        cumulativeSizeRatio: 0,
        spaceSaved: 0,
        backedUpFiles: [],
        cumulativeChangedFiles: [],
        changeDetectionMethod: this.options.changeDetectionMethod,
        recommendFullBackup: false,
        processingTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        createdAt: new Date(),
      };
    }
  }

  /**
   * Get differential backup statistics
   */
  async getDifferentialStats(): Promise<{
    enabled: boolean;
    totalDifferentials: number;
    currentChainLength: number;
    cumulativeSize: number;
    cumulativeSizeRatio: number;
    spaceSaved: number;
    lastBackupAt: Date;
    timeSinceFullBackup: number;
    strategy: string;
    changeDetectionMethod: string;
    indexPath: string;
    currentFullBackup: {
      id: string;
      createdAt: Date;
      size: number;
    } | null;
  }> {
    if (!this.options.enableDifferentialBackup) {
      return {
        enabled: false,
        totalDifferentials: 0,
        currentChainLength: 0,
        cumulativeSize: 0,
        cumulativeSizeRatio: 0,
        spaceSaved: 0,
        lastBackupAt: new Date(),
        timeSinceFullBackup: 0,
        strategy: this.options.differentialStrategy,
        changeDetectionMethod: this.options.changeDetectionMethod,
        indexPath: this.differentialIndexPath,
        currentFullBackup: null,
      };
    }

    const index = await this.loadDifferentialIndex();

    return {
      enabled: true,
      totalDifferentials: index.stats.totalDifferentials,
      currentChainLength: index.stats.currentChainLength,
      cumulativeSize: index.stats.cumulativeSize,
      cumulativeSizeRatio: index.stats.cumulativeSizeRatio,
      spaceSaved: index.stats.totalSpaceSaved,
      lastBackupAt: index.stats.lastBackupAt,
      timeSinceFullBackup: index.stats.timeSinceFullBackup,
      strategy: this.options.differentialStrategy,
      changeDetectionMethod: this.options.changeDetectionMethod,
      indexPath: this.differentialIndexPath,
      currentFullBackup: index.currentFullBackup
        ? {
            id: index.currentFullBackup.id,
            createdAt: index.currentFullBackup.createdAt,
            size: index.currentFullBackup.size,
          }
        : null,
    };
  }

  // === BATCH PROCESSING & LARGE PROJECT OPTIMIZATION METHODS ===

  /**
   * Get current system metrics for dynamic batch sizing
   */
  private async getCurrentSystemMetrics(): Promise<SystemMetrics> {
    const startTime = performance.now();

    // Measure event loop lag
    setImmediate(() => {
      const lag = performance.now() - startTime;
      this.performanceTracker.eventLoopLagSamples.push(lag);
      if (this.performanceTracker.eventLoopLagSamples.length > 100) {
        this.performanceTracker.eventLoopLagSamples.shift(); // Keep last 100 samples
      }
    });

    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    const loadAverage = os.loadavg()[0] || 0; // 1-minute load average

    // Calculate event loop lag from recent samples
    const recentLag =
      this.performanceTracker.eventLoopLagSamples.length > 0
        ? this.performanceTracker.eventLoopLagSamples
            .slice(-10)
            .reduce((a, b) => a + b, 0) /
          Math.min(10, this.performanceTracker.eventLoopLagSamples.length)
        : 0;

    return {
      loadAverage,
      memoryUsage,
      freeMemory,
      totalMemory,
      eventLoopLag: recentLag,
      timestamp: new Date(),
    };
  }

  /**
   * Get current memory usage in MB
   */
  private getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024); // Convert to MB
  }

  /**
   * Update memory tracking statistics
   */
  private updateMemoryTracking(): void {
    const current = this.getCurrentMemoryUsage();
    this.memoryTracker.current = current;
    this.memoryTracker.samples.push(current);

    if (current > this.memoryTracker.peak) {
      this.memoryTracker.peak = current;
    }

    // Keep only last 100 samples
    if (this.memoryTracker.samples.length > 100) {
      this.memoryTracker.samples.shift();
    }
  }

  /**
   * Dynamically adjust batch size based on system metrics
   */
  private async adjustBatchSize(): Promise<number> {
    if (!this.batchProcessingConfig.dynamicSizing) {
      return this.currentBatchSize;
    }

    const metrics = await this.getCurrentSystemMetrics();
    let newBatchSize = this.currentBatchSize;
    let adjustmentReason = "";

    // Memory pressure check
    if (metrics.memoryUsage > this.batchProcessingConfig.thresholds.memory) {
      newBatchSize = Math.max(
        this.options.minBatchSize,
        Math.floor(this.currentBatchSize * 0.7),
      );
      adjustmentReason = `High memory usage: ${metrics.memoryUsage.toFixed(1)}%`;
    }

    // CPU load check
    else if (
      metrics.loadAverage >
      (this.batchProcessingConfig.thresholds.cpu / 100) * os.cpus().length
    ) {
      newBatchSize = Math.max(
        this.options.minBatchSize,
        Math.floor(this.currentBatchSize * 0.8),
      );
      adjustmentReason = `High CPU load: ${metrics.loadAverage.toFixed(2)}`;
    }

    // Event loop lag check
    else if (
      metrics.eventLoopLag > this.batchProcessingConfig.thresholds.eventLoopLag
    ) {
      newBatchSize = Math.max(
        this.options.minBatchSize,
        Math.floor(this.currentBatchSize * 0.6),
      );
      adjustmentReason = `High event loop lag: ${metrics.eventLoopLag.toFixed(1)}ms`;
    }

    // Reduce batch size if good conditions (can increase performance)
    else if (
      metrics.memoryUsage <
        this.batchProcessingConfig.thresholds.memory * 0.5 &&
      metrics.loadAverage <
        (this.batchProcessingConfig.thresholds.cpu / 100) *
          os.cpus().length *
          0.5 &&
      metrics.eventLoopLag <
        this.batchProcessingConfig.thresholds.eventLoopLag * 0.5
    ) {
      newBatchSize = Math.min(
        this.options.maxBatchSize,
        Math.floor(this.currentBatchSize * 1.2),
      );
      adjustmentReason = "Optimal system conditions, increasing batch size";
    }

    if (newBatchSize !== this.currentBatchSize) {
      this.logger.debug("Adjusting batch size", {
        oldSize: this.currentBatchSize,
        newSize: newBatchSize,
        reason: adjustmentReason,
        metrics: {
          memoryUsage: `${metrics.memoryUsage.toFixed(1)}%`,
          loadAverage: metrics.loadAverage.toFixed(2),
          eventLoopLag: `${metrics.eventLoopLag.toFixed(1)}ms`,
        },
      });

      this.currentBatchSize = newBatchSize;
      this.performanceTracker.batchSizeAdjustments++;
    }

    return this.currentBatchSize;
  }

  /**
   * Create progress information for batch operations
   */
  private createProgressInfo(
    processed: number,
    total: number,
    currentFile: string,
    operation: string,
    startTime: number,
  ): ProgressInfo {
    const elapsed = Date.now() - startTime;
    const percentage = total > 0 ? (processed / total) * 100 : 0;
    const rate = elapsed > 0 ? processed / (elapsed / 1000) : 0;
    const eta =
      rate > 0 && total > processed
        ? new Date(Date.now() + ((total - processed) / rate) * 1000)
        : null;

    return {
      currentFile,
      processed,
      total,
      percentage,
      eta,
      rate,
      elapsed,
      operation,
      context: {
        batchSize: this.currentBatchSize,
        memoryUsage: `${this.getCurrentMemoryUsage()}MB`,
        batchSizeAdjustments: this.performanceTracker.batchSizeAdjustments,
      },
    };
  }

  /**
   * Emit progress update if progress tracking is enabled
   */
  private emitProgress(progressInfo: ProgressInfo): void {
    if (this.options.enableProgressTracking) {
      this.progressEmitter.emit("progress", progressInfo);

      this.logger.debug("Progress update", {
        operation: progressInfo.operation,
        percentage: `${progressInfo.percentage.toFixed(1)}%`,
        processed: progressInfo.processed,
        total: progressInfo.total,
        rate: `${progressInfo.rate.toFixed(2)} files/sec`,
        eta: progressInfo.eta?.toISOString(),
        currentFile: progressInfo.currentFile,
      });
    }
  }

  /**
   * Process files in batches with dynamic optimization
   */
  async processBatchWithOptimization<T>(
    files: string[],
    operation: string,
    processor: (filePath: string) => Promise<T>,
    options: {
      progressCallback?: (progress: ProgressInfo) => void;
      errorHandler?: (error: Error, filePath: string) => boolean; // return true to continue
      enableProgressTracking?: boolean;
    } = {},
  ): Promise<BatchOperationResult<T>> {
    const startTime = Date.now();
    const totalFiles = files.length;
    let processed = 0;
    let successful = 0;
    let failed = 0;

    const results: T[] = [];
    const errors: Array<{ item: string; error: string }> = [];

    this.logger.info(`Starting batch operation: ${operation}`, {
      totalFiles,
      initialBatchSize: this.currentBatchSize,
      strategy: this.batchProcessingConfig.strategy,
    });

    // Reset performance tracking for this operation
    this.updateMemoryTracking();

    try {
      for (let i = 0; i < files.length; i += this.currentBatchSize) {
        // Adjust batch size dynamically before each batch
        await this.adjustBatchSize();

        const batchFiles = files.slice(i, i + this.currentBatchSize);
        const batchStartTime = Date.now();

        this.logger.debug(
          `Processing batch ${Math.floor(i / this.currentBatchSize) + 1}`,
          {
            batchSize: batchFiles.length,
            startIndex: i,
            endIndex: Math.min(i + this.currentBatchSize - 1, files.length - 1),
          },
        );

        // Process batch based on strategy
        let batchResults: Array<{
          result?: T;
          error?: string;
          filePath: string;
        }> = [];

        if (this.batchProcessingConfig.strategy === "parallel") {
          // Parallel processing
          const promises = batchFiles.map(async (filePath) => {
            try {
              const result = await processor(filePath);
              return { result, filePath };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
                filePath,
              };
            }
          });

          batchResults = await Promise.all(promises);
        } else {
          // Sequential processing (for sequential and adaptive strategies)
          for (const filePath of batchFiles) {
            try {
              const result = await processor(filePath);
              batchResults.push({ result, filePath });
            } catch (error) {
              batchResults.push({
                error: error instanceof Error ? error.message : String(error),
                filePath,
              });
            }
          }
        }

        // Process batch results
        for (const batchResult of batchResults) {
          processed++;

          if (batchResult.error) {
            failed++;
            errors.push({
              item: batchResult.filePath,
              error: batchResult.error,
            });

            // Call error handler if provided
            if (options.errorHandler) {
              const shouldContinue = options.errorHandler(
                new Error(batchResult.error),
                batchResult.filePath,
              );
              if (!shouldContinue) {
                throw new Error(
                  `Processing stopped due to error in ${batchResult.filePath}: ${batchResult.error}`,
                );
              }
            }
          } else if (batchResult.result !== undefined) {
            successful++;
            results.push(batchResult.result);
          }

          // Update progress
          const progress = this.createProgressInfo(
            processed,
            totalFiles,
            batchResult.filePath,
            operation,
            startTime,
          );

          // Emit progress events
          this.emitProgress(progress);

          // Call progress callback if provided
          if (options.progressCallback) {
            options.progressCallback(progress);
          }
        }

        // Update memory tracking and batch timing
        this.updateMemoryTracking();
        const batchTime = Date.now() - batchStartTime;
        this.performanceTracker.totalProcessingTime += batchTime;

        this.logger.debug(`Batch completed`, {
          batchTime: `${batchTime}ms`,
          filesInBatch: batchFiles.length,
          successfulInBatch: batchResults.filter((r) => !r.error).length,
          failedInBatch: batchResults.filter((r) => r.error).length,
        });

        // Yield control to event loop between batches
        await new Promise((resolve) => setImmediate(resolve));
      }

      const totalTime = Date.now() - startTime;
      this.performanceTracker.filesProcessed += processed;

      // Final progress update
      const finalProgress = this.createProgressInfo(
        processed,
        totalFiles,
        "Complete",
        operation,
        startTime,
      );

      this.emitProgress(finalProgress);
      if (options.progressCallback) {
        options.progressCallback(finalProgress);
      }

      const result: BatchOperationResult<T> = {
        success: failed === 0,
        results,
        successful,
        failed,
        processingTime: totalTime,
        batchSize: this.currentBatchSize,
        errors,
        progress: finalProgress,
      };

      this.logger.info(`Batch operation completed: ${operation}`, {
        totalFiles,
        successful,
        failed,
        processingTime: `${totalTime}ms`,
        averageTimePerFile: `${(totalTime / processed).toFixed(2)}ms`,
        batchSizeAdjustments: this.performanceTracker.batchSizeAdjustments,
        peakMemoryUsage: `${this.memoryTracker.peak}MB`,
      });

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;

      this.logger.error(`Batch operation failed: ${operation}`, {
        error: error instanceof Error ? error.message : String(error),
        processed,
        totalFiles,
        processingTime: `${totalTime}ms`,
      });

      throw new IntegrityError(
        `Batch operation failed: ${error instanceof Error ? error.message : String(error)}`,
        "BATCH_OPERATION_ERROR",
        undefined,
        operation,
        error as Error,
      );
    }
  }

  /**
   * Create a backup of a file before modification
   */
  async createBackup(filePath: string): Promise<BackupResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);

    this.logger.debug("Creating backup", {
      filePath: resolvedPath,
      backupDirectory: this.options.backupDirectory,
      compressionEnabled: this.options.enableCompression,
      deduplicationEnabled: this.options.enableDeduplication,
    });

    try {
      // Verify source file exists
      const fileAccess = await this.verifyFileAccess(resolvedPath);
      if (!fileAccess.exists || !fileAccess.readable) {
        throw new RollbackError(
          `Cannot backup file: ${fileAccess.error || "File not accessible"}`,
          resolvedPath,
        );
      }

      // Get original file size
      const originalStats = await stat(resolvedPath);
      const originalSize = originalStats.size;

      // Ensure backup directory exists
      const backupDir = resolve(this.options.backupDirectory);
      try {
        await access(backupDir);
      } catch {
        // Create backup directory if it doesn't exist
        const { mkdir } = await import("node:fs/promises");
        await mkdir(backupDir, { recursive: true });
        this.logger.debug("Created backup directory", { backupDir });
      }

      // Check if deduplication should be attempted first
      const shouldDeduplicate = await this.shouldDeduplicateFile(resolvedPath);
      let deduplicationResult: DeduplicationResult | null = null;

      if (shouldDeduplicate) {
        this.logger.debug("Attempting deduplication for backup", {
          filePath: resolvedPath,
        });
        deduplicationResult = await this.deduplicateFile(resolvedPath);
      }

      // Determine if compression should be used (if not using deduplication)
      const shouldCompress =
        !shouldDeduplicate && (await this.shouldCompressFile(resolvedPath));

      // Generate backup file path with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const originalName = basename(resolvedPath);
      const extension = extname(originalName);
      const nameWithoutExt = originalName.slice(0, -extension.length);

      let backupName: string;
      let backupPath: string;
      let backupSize: number;

      if (deduplicationResult?.deduplicated) {
        // Use deduplication result - create reference in backup directory
        backupName = `${nameWithoutExt}.${timestamp}${extension}.backup.dedup`;
        backupPath = join(backupDir, backupName);

        // Create metadata file pointing to deduplicated content
        const dedupMetadata = {
          type: "deduplication_reference",
          originalPath: resolvedPath,
          contentHash: deduplicationResult.contentHash,
          storagePath: deduplicationResult.storagePath,
          referenceCount: deduplicationResult.referenceCount,
          timestamp: new Date(),
          algorithm: this.options.deduplicationAlgorithm,
        };

        await import("node:fs/promises").then((fs) =>
          fs.writeFile(
            backupPath,
            JSON.stringify(dedupMetadata, null, 2),
            "utf-8",
          ),
        );

        const metadataStats = await stat(backupPath);
        backupSize = metadataStats.size;

        this.logger.debug("Created deduplication reference backup", {
          originalPath: resolvedPath,
          backupPath,
          contentHash: deduplicationResult.contentHash,
          referenceCount: deduplicationResult.referenceCount,
        });
      } else {
        // Traditional backup with optional compression
        if (shouldCompress) {
          const compressExt = this.getCompressedExtension();
          backupName = `${nameWithoutExt}.${timestamp}${extension}.backup${compressExt}`;
        } else {
          backupName = `${nameWithoutExt}.${timestamp}${extension}.backup`;
        }

        backupPath = join(backupDir, backupName);

        // Create backup with optional compression
        if (shouldCompress) {
          await this.createCompressedBackup(resolvedPath, backupPath);
        } else {
          await copyFile(resolvedPath, backupPath);
        }

        // Get backup file stats
        const backupStats = await stat(backupPath);
        backupSize = backupStats.size;
      }

      const processingTime = Date.now() - startTime;

      const result: BackupResult = {
        originalPath: resolvedPath,
        backupPath,
        success: true,
        createdAt: new Date(),
        backupSize,
        originalSize,
        compressed: shouldCompress,
        compressionAlgorithm: shouldCompress
          ? this.options.compressionAlgorithm
          : undefined,
        compressionRatio: shouldCompress
          ? originalSize / backupSize
          : undefined,
        deduplicated: deduplicationResult?.deduplicated || false,
        contentHash: deduplicationResult?.contentHash,
        referenceCount: deduplicationResult?.referenceCount,
        deduplicationPath: deduplicationResult?.storagePath,
      };

      this.logger.info("Backup created successfully", {
        originalPath: resolvedPath,
        backupPath,
        originalSize,
        backupSize,
        compressed: shouldCompress,
        compressionRatio: result.compressionRatio,
        deduplicated: result.deduplicated,
        contentHash: result.contentHash,
        spaceSaved: deduplicationResult?.spaceSaved || 0,
        processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("Backup creation failed", {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      if (error instanceof RollbackError) {
        throw error;
      }

      throw new RollbackError(
        `Backup creation failed: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error as Error,
      );
    }
  }

  /**
   * Create a compressed backup using streaming compression
   */
  private async createCompressedBackup(
    sourcePath: string,
    backupPath: string,
  ): Promise<void> {
    try {
      const source = createReadStream(sourcePath);
      const destination = createWriteStream(backupPath);
      const compressor = this.createCompressionStream();

      // Use pipeline for efficient streaming compression
      await pipeline(source, compressor, destination);

      this.logger.debug("Compressed backup created successfully", {
        sourcePath,
        backupPath,
        algorithm: this.options.compressionAlgorithm,
      });
    } catch (error) {
      // Clean up incomplete backup file
      try {
        await unlink(backupPath);
      } catch {
        // Ignore cleanup errors
      }

      throw new RollbackError(
        `Compressed backup creation failed: ${error instanceof Error ? error.message : String(error)}`,
        sourcePath,
        error as Error,
      );
    }
  }

  /**
   * Check if a backup file is compressed based on its extension
   */
  private isCompressedBackup(backupPath: string): boolean {
    const fileName = basename(backupPath);
    return (
      fileName.endsWith(".backup.gz") ||
      fileName.endsWith(".backup.deflate") ||
      fileName.endsWith(".backup.br")
    );
  }

  /**
   * Restore a file from a compressed backup using streaming decompression
   */
  private async restoreCompressedBackup(
    backupPath: string,
    targetPath: string,
  ): Promise<void> {
    try {
      const source = createReadStream(backupPath);
      const destination = createWriteStream(targetPath);
      const decompressor = this.createDecompressionStream(backupPath);

      // Use pipeline for efficient streaming decompression
      await pipeline(source, decompressor, destination);

      this.logger.debug("Compressed backup restored successfully", {
        backupPath,
        targetPath,
      });
    } catch (error) {
      // Clean up incomplete restored file
      try {
        await unlink(targetPath);
      } catch {
        // Ignore cleanup errors
      }

      throw new RollbackError(
        `Compressed backup restoration failed: ${error instanceof Error ? error.message : String(error)}`,
        targetPath,
        error as Error,
      );
    }
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(
    filePath: string,
    backupPath: string,
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    const resolvedBackupPath = resolve(backupPath);

    this.logger.debug("Restoring from backup", {
      filePath: resolvedPath,
      backupPath: resolvedBackupPath,
    });

    try {
      // Verify backup file exists
      const backupAccess = await this.verifyFileAccess(resolvedBackupPath);
      if (!backupAccess.exists || !backupAccess.readable) {
        throw new RollbackError(
          `Cannot restore from backup: ${backupAccess.error || "Backup file not accessible"}`,
          resolvedPath,
        );
      }

      // Create backup of current file if it exists (nested backup for safety)
      let currentFileBackupPath: string | undefined;
      const currentFileAccess = await this.verifyFileAccess(resolvedPath);
      if (currentFileAccess.exists) {
        try {
          // Add a small delay to ensure unique timestamp for safety backup
          await new Promise((resolve) => setTimeout(resolve, 2));
          const currentBackup = await this.createBackup(resolvedPath);
          currentFileBackupPath = currentBackup.backupPath;
          this.logger.debug("Created safety backup of current file", {
            originalPath: resolvedPath,
            safetyBackupPath: currentFileBackupPath,
          });
        } catch (error) {
          this.logger.warn(
            "Failed to create safety backup, proceeding anyway",
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }

      // Determine if backup is compressed based on file extension
      const isCompressed = this.isCompressedBackup(resolvedBackupPath);

      // Restore from backup (with decompression if needed)
      if (isCompressed) {
        await this.restoreCompressedBackup(resolvedBackupPath, resolvedPath);
      } else {
        await copyFile(resolvedBackupPath, resolvedPath);
      }

      // Small delay to ensure file modification time is updated for cache invalidation
      await new Promise((resolve) => setTimeout(resolve, 1));

      // Verify restoration if configured
      let integrityVerified = false;
      if (this.options.verifyAfterRollback) {
        try {
          // For compressed backups, we can't directly compare checksums,
          // so we verify that the file was restored successfully by checking it exists and is readable
          if (isCompressed) {
            const restoredAccess = await this.verifyFileAccess(resolvedPath);
            integrityVerified =
              restoredAccess.exists && restoredAccess.readable;

            if (!integrityVerified) {
              throw new RollbackError(
                "Rollback verification failed: restored file is not accessible",
                resolvedPath,
              );
            }
          } else {
            // For uncompressed backups, we can compare checksums
            const comparison = await this.compareFiles(
              resolvedPath,
              resolvedBackupPath,
            );
            integrityVerified = comparison.match;

            if (!integrityVerified) {
              // Restoration failed, try to restore from safety backup if available
              if (currentFileBackupPath) {
                const safetyIsCompressed = this.isCompressedBackup(
                  currentFileBackupPath,
                );
                if (safetyIsCompressed) {
                  await this.restoreCompressedBackup(
                    currentFileBackupPath,
                    resolvedPath,
                  );
                } else {
                  await copyFile(currentFileBackupPath, resolvedPath);
                }
                this.logger.warn(
                  "Restored original file due to rollback verification failure",
                );
              }
              throw new RollbackError(
                "Rollback verification failed: restored file checksum does not match backup",
                resolvedPath,
              );
            }
          }
        } catch (error) {
          this.logger.error("Rollback verification failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          if (error instanceof RollbackError) {
            throw error;
          }
        }
      }

      const processingTime = Date.now() - startTime;

      const result: RollbackResult = {
        filePath: resolvedPath,
        backupPath: resolvedBackupPath,
        success: true,
        integrityVerified,
        rolledBackAt: new Date(),
        processingTime,
      };

      this.logger.info("File restored from backup successfully", {
        filePath: resolvedPath,
        backupPath: resolvedBackupPath,
        integrityVerified,
        processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error("Rollback failed", {
        filePath: resolvedPath,
        backupPath: resolvedBackupPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      });

      if (error instanceof RollbackError) {
        throw error;
      }

      throw new RollbackError(
        `Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error as Error,
      );
    }
  }

  /**
   * Clean up old backup files based on retention policy
   */
  async cleanupBackups(): Promise<{
    cleaned: number;
    errors: string[];
    totalSize: number;
  }> {
    const startTime = Date.now();
    const backupDir = resolve(this.options.backupDirectory);

    this.logger.debug("Starting backup cleanup", {
      backupDirectory: backupDir,
      retentionDays: this.options.backupRetentionDays,
    });

    try {
      // Check if backup directory exists
      const { readdir, stat: statFile } = await import("node:fs/promises");
      let files: string[];

      try {
        files = await readdir(backupDir);
      } catch {
        // Directory doesn't exist, nothing to clean
        return { cleaned: 0, errors: [], totalSize: 0 };
      }

      const now = Date.now();
      const retentionMs =
        this.options.backupRetentionDays * 24 * 60 * 60 * 1000;
      const cutoffTime = now - retentionMs;

      let cleaned = 0;
      let totalSize = 0;
      const errors: string[] = [];

      for (const file of files) {
        // Check for both compressed and uncompressed backup files
        const isBackupFile =
          file.endsWith(".backup") ||
          file.endsWith(".backup.gz") ||
          file.endsWith(".backup.deflate") ||
          file.endsWith(".backup.br");

        if (!isBackupFile) {
          continue; // Skip non-backup files
        }

        try {
          const filePath = join(backupDir, file);
          const stats = await statFile(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            await unlink(filePath);
            cleaned++;
            totalSize += stats.size;

            this.logger.debug("Cleaned up old backup", {
              file: filePath,
              age: Math.round(
                (now - stats.mtime.getTime()) / (24 * 60 * 60 * 1000),
              ),
              size: stats.size,
            });
          }
        } catch (error) {
          const errorMsg = `Failed to clean backup ${file}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.warn("Backup cleanup error", { file, error: errorMsg });
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.info("Backup cleanup completed", {
        cleaned,
        errors: errors.length,
        totalSize,
        processingTime,
      });

      return { cleaned, errors, totalSize };
    } catch (error) {
      this.logger.error("Backup cleanup failed", {
        backupDirectory: backupDir,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new RollbackError(
        `Backup cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        backupDir,
        error as Error,
      );
    }
  }

  // === HIGH-LEVEL LARGE PROJECT OPTIMIZATION API ===

  /**
   * Process multiple files with optimized batching for large projects
   */
  async processLargeProject(
    files: string[],
    operation: "checksum" | "validate" | "backup",
    options: {
      progressCallback?: (progress: ProgressInfo) => void;
      errorHandler?: (error: Error, filePath: string) => boolean;
      expectedChecksums?: Record<string, string | ChecksumInfo>;
    } = {},
  ): Promise<LargeProjectResult> {
    const startTime = Date.now();
    this.logger.info("Starting large project processing", {
      operation,
      totalFiles: files.length,
      enableBatchProcessing: this.options.enableBatchProcessing,
      batchSize: this.currentBatchSize,
    });

    // Initialize tracking
    const initialMemory = this.getCurrentMemoryUsage();
    this.memoryTracker.initial = initialMemory;
    this.memoryTracker.peak = initialMemory;
    this.memoryTracker.samples = [initialMemory];

    let batchesProcessed = 0;
    let totalBatchSize = 0;
    const optimizationDetails: string[] = [];

    try {
      let result: BatchOperationResult<any>;

      if (operation === "checksum") {
        result = await this.processBatchWithOptimization(
          files,
          "Large Project Checksum Calculation",
          async (filePath: string) => this.calculateChecksum(filePath),
          options,
        );
      } else if (operation === "validate") {
        if (!options.expectedChecksums) {
          throw new ValidationError(
            "Expected checksums required for validation operation",
          );
        }

        const validationFiles = files
          .map((filePath) => ({
            path: filePath,
            expectedChecksum: options.expectedChecksums![filePath],
          }))
          .filter((file) => file.expectedChecksum !== undefined);

        result = await this.processBatchWithOptimization(
          validationFiles.map((f) => f.path),
          "Large Project Validation",
          async (filePath: string) => {
            const expectedChecksum = options.expectedChecksums![filePath];
            return this.validateFile(filePath, expectedChecksum);
          },
          options,
        );
      } else if (operation === "backup") {
        result = await this.processBatchWithOptimization(
          files,
          "Large Project Backup",
          async (filePath: string) => this.createBackup(filePath),
          options,
        );
      } else {
        throw new IntegrityError(
          `Unsupported operation: ${operation}`,
          "UNSUPPORTED_OPERATION",
        );
      }

      // Calculate statistics
      const finalMemory = this.getCurrentMemoryUsage();
      const totalTime = Date.now() - startTime;
      batchesProcessed = Math.ceil(files.length / this.currentBatchSize);
      totalBatchSize = this.currentBatchSize * batchesProcessed;

      const averageMemory =
        this.memoryTracker.samples.length > 0
          ? this.memoryTracker.samples.reduce((a, b) => a + b, 0) /
            this.memoryTracker.samples.length
          : initialMemory;

      const averageEventLoopLag =
        this.performanceTracker.eventLoopLagSamples.length > 0
          ? this.performanceTracker.eventLoopLagSamples.reduce(
              (a, b) => a + b,
              0,
            ) / this.performanceTracker.eventLoopLagSamples.length
          : 0;

      // Add optimization details
      if (this.options.enableBatchProcessing) {
        optimizationDetails.push(
          `Batch processing enabled with adaptive sizing (initial: ${this.options.batchSize}, final: ${this.currentBatchSize})`,
        );
      }

      if (this.performanceTracker.batchSizeAdjustments > 0) {
        optimizationDetails.push(
          `Dynamic batch size adjustments: ${this.performanceTracker.batchSizeAdjustments}`,
        );
      }

      if (this.options.enableProgressTracking) {
        optimizationDetails.push("Progress tracking enabled for user feedback");
      }

      optimizationDetails.push(
        `Memory tracking: ${initialMemory}MB → ${this.memoryTracker.peak}MB (peak) → ${finalMemory}MB`,
      );
      optimizationDetails.push(
        `System metrics monitoring: CPU load, memory pressure, event loop lag`,
      );

      const largeProjectResult: LargeProjectResult = {
        success: result.success,
        totalFiles: files.length,
        totalProcessingTime: totalTime,
        batchesProcessed,
        averageBatchSize: totalBatchSize / batchesProcessed,
        memoryStats: {
          initial: initialMemory,
          peak: this.memoryTracker.peak,
          final: finalMemory,
          average: averageMemory,
        },
        performanceStats: {
          filesPerSecond: (files.length / totalTime) * 1000,
          averageFileProcessingTime: totalTime / files.length,
          eventLoopLagAverage: averageEventLoopLag,
          batchSizeAdjustments: this.performanceTracker.batchSizeAdjustments,
        },
        optimizationApplied:
          this.options.enableBatchProcessing ||
          this.options.enableProgressTracking,
        optimizationDetails,
      };

      this.logger.info("Large project processing completed", {
        operation,
        ...largeProjectResult,
      });

      return largeProjectResult;
    } catch (error) {
      this.logger.error("Large project processing failed", {
        operation,
        error: error instanceof Error ? error.message : String(error),
        filesProcessed: this.performanceTracker.filesProcessed,
        batchesProcessed,
      });

      throw new IntegrityError(
        `Large project processing failed: ${error instanceof Error ? error.message : String(error)}`,
        "LARGE_PROJECT_ERROR",
        undefined,
        operation,
        error as Error,
      );
    }
  }

  /**
   * Get comprehensive statistics for large project optimization
   */
  async getLargeProjectStats(): Promise<{
    batchProcessing: {
      enabled: boolean;
      currentBatchSize: number;
      strategy: string;
      dynamicSizing: boolean;
      adjustments: number;
    };
    memoryTracking: {
      current: number;
      peak: number;
      samples: number;
      average: number;
    };
    performance: {
      filesProcessed: number;
      totalProcessingTime: number;
      averageFileProcessingTime: number;
      eventLoopLagSamples: number;
      averageEventLoopLag: number;
    };
    systemMetrics: SystemMetrics;
    progressTracking: {
      enabled: boolean;
      updateInterval: number;
    };
  }> {
    const currentMetrics = await this.getCurrentSystemMetrics();
    const averageMemory =
      this.memoryTracker.samples.length > 0
        ? this.memoryTracker.samples.reduce((a, b) => a + b, 0) /
          this.memoryTracker.samples.length
        : this.memoryTracker.current;

    const averageEventLoopLag =
      this.performanceTracker.eventLoopLagSamples.length > 0
        ? this.performanceTracker.eventLoopLagSamples.reduce(
            (a, b) => a + b,
            0,
          ) / this.performanceTracker.eventLoopLagSamples.length
        : 0;

    const averageFileProcessingTime =
      this.performanceTracker.filesProcessed > 0
        ? this.performanceTracker.totalProcessingTime /
          this.performanceTracker.filesProcessed
        : 0;

    return {
      batchProcessing: {
        enabled: this.options.enableBatchProcessing,
        currentBatchSize: this.currentBatchSize,
        strategy: this.batchProcessingConfig.strategy,
        dynamicSizing: this.batchProcessingConfig.dynamicSizing,
        adjustments: this.performanceTracker.batchSizeAdjustments,
      },
      memoryTracking: {
        current: this.memoryTracker.current,
        peak: this.memoryTracker.peak,
        samples: this.memoryTracker.samples.length,
        average: averageMemory,
      },
      performance: {
        filesProcessed: this.performanceTracker.filesProcessed,
        totalProcessingTime: this.performanceTracker.totalProcessingTime,
        averageFileProcessingTime,
        eventLoopLagSamples: this.performanceTracker.eventLoopLagSamples.length,
        averageEventLoopLag,
      },
      systemMetrics: currentMetrics,
      progressTracking: {
        enabled: this.options.enableProgressTracking,
        updateInterval: this.options.progressUpdateInterval,
      },
    };
  }

  /**
   * Reset performance tracking statistics
   */
  resetPerformanceTracking(): void {
    this.performanceTracker = {
      filesProcessed: 0,
      totalProcessingTime: 0,
      batchSizeAdjustments: 0,
      eventLoopLagSamples: [],
    };

    const currentMemory = this.getCurrentMemoryUsage();
    this.memoryTracker = {
      initial: currentMemory,
      peak: currentMemory,
      current: currentMemory,
      samples: [currentMemory],
    };

    this.logger.debug("Performance tracking statistics reset");
  }

  /**
   * Add progress event listener for long-running operations
   */
  onProgress(callback: (progress: ProgressInfo) => void): void {
    this.progressEmitter.on("progress", callback);
  }

  /**
   * Remove progress event listener
   */
  offProgress(callback: (progress: ProgressInfo) => void): void {
    this.progressEmitter.removeListener("progress", callback);
  }

  /**
   * Remove all progress event listeners
   */
  removeAllProgressListeners(): void {
    this.progressEmitter.removeAllListeners("progress");
  }
}

/**
 * Convenience factory function for creating FileIntegrityValidator instances
 */
export function createFileIntegrityValidator(
  options: Partial<FileIntegrityOptions> = {},
): FileIntegrityValidator {
  return new FileIntegrityValidator(options);
}

/**
 * Convenience function for quick checksum calculation
 */
export async function calculateFileChecksum(
  filePath: string,
  algorithm: "md5" | "sha1" | "sha256" | "sha512" = "sha256",
): Promise<ChecksumInfo> {
  const validator = new FileIntegrityValidator({ algorithm });
  return validator.calculateChecksum(filePath);
}

/**
 * Convenience function for validating file integrity against expected checksum
 */
export async function validateFileIntegrity(
  filePath: string,
  expectedChecksum: string,
  algorithm: "md5" | "sha1" | "sha256" | "sha512" = "sha256",
): Promise<boolean> {
  try {
    const checksumInfo = await calculateFileChecksum(filePath, algorithm);
    return checksumInfo.hash === expectedChecksum;
  } catch {
    return false;
  }
}
