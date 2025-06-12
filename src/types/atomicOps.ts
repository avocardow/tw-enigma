/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @fileoverview TypeScript interfaces and types for atomic file operations
 * @module types/atomicOps
 */

import { Stats } from "fs";

/** Configuration options for atomic file operations */
export interface AtomicFileOptions {
  /** Whether to enable fsync for durability (default: true) */
  enableFsync?: boolean;

  /** Temporary file directory (default: same as target file) */
  tempDirectory?: string;

  /** Temporary file prefix (default: '.tmp-') */
  tempPrefix?: string;

  /** Temporary file suffix (default: '.tmp') */
  tempSuffix?: string;

  /** Timeout for operations in milliseconds (default: 30000) */
  operationTimeout?: number;

  /** Whether to preserve file permissions (default: true) */
  preservePermissions?: boolean;

  /** Whether to preserve file ownership (default: true) */
  preserveOwnership?: boolean;

  /** Buffer size for read/write operations (default: 64KB) */
  bufferSize?: number;

  /** Whether to enable write-ahead logging (default: false) */
  enableWAL?: boolean;

  /** WAL directory path (default: '.wal') */
  walDirectory?: string;

  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Maximum number of retry attempts (alias for maxRetries) */
  maxRetryAttempts?: number;

  /** Retry delay in milliseconds (default: 100) */
  retryDelay?: number;
}

/** Result of an atomic file operation */
export interface AtomicOperationResult {
  /** Whether the operation was successful */
  success: boolean;

  /** Operation type performed */
  operation: "read" | "write" | "delete" | "create";

  /** Target file path */
  filePath: string;

  /** Temporary file path used (if any) */
  tempFilePath?: string;

  /** Operation duration in milliseconds */
  duration: number;

  /** Number of bytes processed */
  bytesProcessed: number;

  /** File stats after operation */
  fileStats?: Stats;

  /** Error information if operation failed */
  error?: {
    code: string;
    message: string;
    stack?: string;
  };

  /** Operation metadata */
  metadata: AtomicOperationResultMetadata;
}

/** File creation options */
export interface FileCreationOptions extends AtomicFileOptions {
  /** File encoding (default: 'utf8') */
  encoding?: BufferEncoding;

  /** File mode/permissions (default: 0o644) */
  mode?: number;

  /** Whether to overwrite existing files (default: false) */
  overwrite?: boolean;

  /** Initial file content */
  initialContent?: string | Buffer;
}

/** File read options with enhanced features */
export interface FileReadOptions {
  /** Text encoding for reading files (default: 'utf8', use 'buffer' for binary) */
  encoding?: BufferEncoding | "buffer";

  /** Whether to verify file checksum (default: false) */
  verifyChecksum?: boolean;

  /** Expected checksum for verification */
  expectedChecksum?: string;

  /** Checksum algorithm to use (default: 'sha256') */
  checksumAlgorithm?: "md5" | "sha1" | "sha256" | "sha512";

  /** Buffer size for streaming large files (default: 64KB) */
  bufferSize?: number;

  /** Whether to enable content caching (default: false) */
  enableCaching?: boolean;

  /** Cache timeout in milliseconds (default: 5000) */
  cacheTimeout?: number;

  /** Maximum file size to read (default: 100MB) */
  maxFileSize?: number;

  /** Whether to abort on first error in batch operations (default: true) */
  abortOnFirstError?: boolean;

  /** Read timeout in milliseconds (default: 30000) */
  readTimeout?: number;

  /** Schema validation function */
  validateSchema?: (data: any) => boolean;
}

/** Options for file write operations */
export interface FileWriteOptions {
  /** Text encoding for string content */
  encoding?: BufferEncoding;
  /** File mode/permissions */
  mode?: number;
  /** Whether to append to existing file */
  append?: boolean;
  /** Whether to create backup of existing file */
  createBackup?: boolean;
  /** Whether to verify content after writing */
  verifyAfterWrite?: boolean;
  /** Checksum algorithm for verification */
  checksumAlgorithm?: "md5" | "sha1" | "sha256";
  /** Buffer size for streaming operations */
  bufferSize?: number;
  /** Enable compression for large files */
  enableCompression?: boolean;
  /** Compression level (0-9) */
  compressionLevel?: number;
  /** Whether to sync after write */
  syncAfterWrite?: boolean;
  /** Directory for backup files */
  backupDirectory?: string;
  /** Maximum number of backup files to keep */
  maxBackups?: number;
  /** Operation timeout in milliseconds */
  writeTimeout?: number;
  /** Enable progress reporting */
  enableProgress?: boolean;
  /** Stop on first error in batch operations */
  abortOnFirstError?: boolean;
  /** Maximum file size allowed */
  maxFileSize?: number;
}

/** Atomic read options */
export interface AtomicReadOptions extends AtomicFileOptions {
  /** File encoding (default: 'utf8') */
  encoding?: BufferEncoding;

  /** Whether to fallback to temp file if main file doesn't exist */
  fallbackToTemp?: boolean;
}

/** Atomic write options */
export interface AtomicWriteOptions extends AtomicFileOptions {
  /** File encoding (default: 'utf8') */
  encoding?: BufferEncoding;

  /** File mode/permissions (inherit from existing file if not specified) */
  mode?: number;

  /** Whether to append to file (default: false - overwrite) */
  append?: boolean;
}

/** Temporary file information */
export interface TempFileInfo {
  /** Temporary file path */
  path: string;

  /** Target file path */
  targetPath: string;

  /** Creation timestamp */
  createdAt: number;

  /** Process ID that created the temp file */
  pid: number;

  /** Thread ID (if applicable) */
  threadId?: number;

  /** Unique operation ID */
  operationId: string;

  /** Cleanup timeout in milliseconds */
  cleanupTimeout: number;
}

/** Rollback operation for atomic file operations */
export interface RollbackOperation {
  /** Type of rollback operation */
  type:
    | "file_create"
    | "file_overwrite"
    | "file_delete"
    | "directory_create"
    | "permission_change";
  /** Path to the file/directory involved */
  filePath: string;
  /** Optional backup file path */
  backupPath?: string;
  /** Original file size (for metrics) */
  fileSize?: number;
  /** Original permissions (for restoration) */
  originalPermissions?: number;
  /** Operation timestamp */
  timestamp: number;
  /** Unique operation identifier */
  operationId?: string;
  /** Operation index for checkpoint tracking */
  operationIndex?: number;
  /** Individual rollback steps */
  steps?: RollbackStep[];
  /** Whether the operation is completed */
  completed?: boolean;
  /** Operation start time */
  startTime?: number;
  /** Operation name/description */
  operation?: string;
}

/** Individual rollback step */
export interface RollbackStep {
  /** Step number */
  stepNumber: number;

  /** Step description */
  description: string;

  /** Step type */
  type: "backup" | "write" | "rename" | "delete" | "permissions";

  /** File path affected by this step */
  filePath: string;

  /** Timestamp when step was performed */
  timestamp: number;

  /** Whether step was successful */
  success: boolean;

  /** Rollback action for this step */
  rollbackAction?: () => Promise<void>;
}

/** Performance metrics for atomic operations */
export interface AtomicOperationMetrics {
  /** Total operations performed */
  totalOperations: number;

  /** Successful operations */
  successfulOperations: number;

  /** Failed operations */
  failedOperations: number;

  /** Average operation duration */
  averageDuration: number;

  /** Total bytes processed */
  totalBytesProcessed: number;

  /** Operations per second */
  operationsPerSecond: number;

  /** Total fsync calls */
  totalFsyncCalls: number;

  /** Total retry attempts */
  totalRetryAttempts: number;

  /** Error statistics */
  errorStats: {
    [errorCode: string]: number;
  };

  /** Performance by operation type */
  operationTypes: {
    read: number;
    write: number;
    delete: number;
    create: number;
  };
}

/** WAL (Write-Ahead Log) entry */
export interface WALEntry {
  /** Unique entry ID */
  id: string;

  /** Operation ID this entry belongs to */
  operationId: string;

  /** Entry type */
  type: "begin" | "step" | "commit" | "rollback";

  /** Timestamp */
  timestamp: number;

  /** File path involved */
  filePath: string;

  /** Entry data */
  data: {
    operation: string;
    stepNumber?: number;
    description: string;
    metadata?: Record<string, any>;
  };

  /** Checksum for integrity */
  checksum: string;
}

/** Batch operation options */
export interface BatchOperationOptions extends AtomicFileOptions {
  /** Number of operations to process in parallel (default: 5) */
  concurrency?: number;

  /** Whether to stop on first error (default: false) */
  stopOnError?: boolean;

  /** Progress callback */
  onProgress?: (completed: number, total: number, current: string) => void;
}

/** Batch operation result */
export interface BatchOperationResult {
  /** Total operations attempted */
  totalOperations: number;

  /** Successful operations */
  successfulOperations: number;

  /** Failed operations */
  failedOperations: number;

  /** Individual operation results */
  results: AtomicOperationResult[];

  /** Total duration */
  totalDuration: number;

  /** Operations that failed */
  failures: Array<{
    filePath: string;
    error: string;
    operationResult: AtomicOperationResult;
  }>;
}

/** Error types for atomic operations */
export enum AtomicOperationError {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  TEMP_FILE_CREATION_FAILED = "TEMP_FILE_CREATION_FAILED",
  WRITE_FAILED = "WRITE_FAILED",
  FSYNC_FAILED = "FSYNC_FAILED",
  RENAME_FAILED = "RENAME_FAILED",
  CLEANUP_FAILED = "CLEANUP_FAILED",
  TIMEOUT = "TIMEOUT",
  ROLLBACK_FAILED = "ROLLBACK_FAILED",
  WAL_CORRUPTION = "WAL_CORRUPTION",
  INVALID_OPERATION = "INVALID_OPERATION",
  DISK_FULL = "DISK_FULL",
  LOCK_FAILED = "LOCK_FAILED",
}

/** Metadata about an atomic operation */
export interface AtomicOperationResultMetadata {
  /** Operation start timestamp */
  startTime: number;
  /** Operation end timestamp */
  endTime: number;
  /** Whether fsync was used */
  fsyncUsed: boolean;
  /** Number of retry attempts */
  retryAttempts: number;
  /** Whether write-ahead logging was used */
  walUsed: boolean;
  /** Whether backup was created */
  backupCreated: boolean;
  /** Whether content verification was performed */
  checksumVerified: boolean;
  /** Whether content verification passed */
  verificationPassed?: boolean;
  /** Backup file path if created */
  backupPath?: string;
  /** Content checksum if verified */
  checksum?: string;
  /** Whether content was loaded from cache */
  fromCache?: boolean;
}
