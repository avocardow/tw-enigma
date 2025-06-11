import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, stat, copyFile, unlink, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, basename, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip, createDeflate, createBrotliCompress, createGunzip, createInflate, createBrotliDecompress, constants as zlibConstants } from 'node:zlib';
import { z } from 'zod';
import { createLogger } from './logger.js';
import { ConfigError } from './errors.js';

/**
 * File integrity validation options schema
 */
export const FileIntegrityOptionsSchema = z.object({
  /** Hash algorithm to use for checksums (default: 'sha256') */
  algorithm: z.enum(['md5', 'sha1', 'sha256', 'sha512']).default('sha256'),
  
  /** Whether to create backups before file modifications (default: true) */
  createBackups: z.boolean().default(true),
  
  /** Directory for storing backup files (default: '.backups') */
  backupDirectory: z.string().default('.backups'),
  
  /** Maximum age of backup files in days before cleanup (default: 7) */
  backupRetentionDays: z.number().min(1).max(365).default(7),
  
  /** Maximum file size to process in bytes (default: 100MB) */
  maxFileSize: z.number().min(1).default(100 * 1024 * 1024),
  
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
  compressionAlgorithm: z.enum(['gzip', 'deflate', 'brotli']).default('gzip'),
  
  /** Compression level (1-9 for gzip/deflate, 0-11 for brotli, default: 6) */
  compressionLevel: z.number().min(0).max(11).default(6),
  
  /** Minimum file size in bytes to compress (default: 1KB) */
  compressionThreshold: z.number().min(0).default(1024),
  
  // === DEDUPLICATION OPTIONS ===
  /** Whether to enable deduplication for backup files (default: false) */
  enableDeduplication: z.boolean().default(false),
  
  /** Directory for storing deduplicated content (default: '.dedup') */
  deduplicationDirectory: z.string().default('.dedup'),
  
  /** Hash algorithm for content deduplication (default: 'sha256') */
  deduplicationAlgorithm: z.enum(['md5', 'sha1', 'sha256', 'sha512']).default('sha256'),
  
  /** Minimum file size in bytes to deduplicate (default: 1KB) */
  deduplicationThreshold: z.number().min(0).default(1024),
  
  /** Whether to use hard links for deduplication (platform dependent, default: true) */
  useHardLinks: z.boolean().default(true),
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
  compressionAlgorithm?: 'gzip' | 'deflate' | 'brotli';
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
  operation: 'checksum' | 'validation' | 'backup' | 'rollback' | 'cleanup' | 'deduplication';
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
  compressionAlgorithm?: 'gzip' | 'deflate' | 'brotli';
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
 * Custom error class for file integrity validation errors
 */
export class IntegrityError extends Error {
  public readonly code: string;
  public readonly filePath?: string;
  public readonly operation?: string;
  
  constructor(
    message: string,
    code: string = 'INTEGRITY_ERROR',
    filePath?: string,
    operation?: string,
    cause?: Error
  ) {
    super(message, { cause });
    this.name = 'IntegrityError';
    this.code = code;
    this.filePath = filePath;
    this.operation = operation;
  }
}

/**
 * Custom error class for checksum calculation errors
 */
export class ChecksumError extends IntegrityError {
  constructor(
    message: string,
    filePath?: string,
    cause?: Error
  ) {
    super(message, 'CHECKSUM_ERROR', filePath, 'checksum', cause);
    this.name = 'ChecksumError';
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends IntegrityError {
  constructor(
    message: string,
    filePath?: string,
    cause?: Error
  ) {
    super(message, 'VALIDATION_ERROR', filePath, 'validation', cause);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for rollback operation errors
 */
export class RollbackError extends IntegrityError {
  constructor(
    message: string,
    filePath?: string,
    cause?: Error
  ) {
    super(message, 'ROLLBACK_ERROR', filePath, 'rollback', cause);
    this.name = 'RollbackError';
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
  
  constructor(options: Partial<FileIntegrityOptions> = {}) {
    // Validate and merge options with defaults
    try {
      this.options = FileIntegrityOptionsSchema.parse(options);
    } catch (error) {
      throw new ConfigError(
        'Invalid file integrity validation options',
        undefined,
        error as Error,
        { providedOptions: options }
      );
    }
    
    this.logger = createLogger('FileIntegrity');
    
    // Initialize deduplication index path
    this.deduplicationIndexPath = join(this.options.deduplicationDirectory, 'dedup-index.json');
    
    this.logger.debug('FileIntegrityValidator initialized', {
      algorithm: this.options.algorithm,
      createBackups: this.options.createBackups,
      backupDirectory: this.options.backupDirectory,
      maxFileSize: this.options.maxFileSize,
      timeout: this.options.timeout,
      enableCaching: this.options.enableCaching,
      enableDeduplication: this.options.enableDeduplication,
      deduplicationDirectory: this.options.deduplicationDirectory
    });
  }

  /**
   * Calculate checksum for a file
   */
  async calculateChecksum(filePath: string): Promise<ChecksumInfo> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    
    this.logger.debug('Calculating checksum', {
      filePath: resolvedPath,
      algorithm: this.options.algorithm
    });

    try {
      // Verify file exists and get stats first
      const stats = await stat(resolvedPath);
      
      // Check cache first if enabled (after getting stats to validate file modification time)
      if (this.options.enableCaching) {
        const cached = this.checksumCache.get(resolvedPath);
        if (cached && cached.timestamp >= stats.mtime) {
          this.logger.debug('Using cached checksum', { filePath: resolvedPath });
          return cached;
        } else if (cached && cached.timestamp < stats.mtime) {
          // File was modified since cache entry, remove stale cache
          this.checksumCache.delete(resolvedPath);
          this.logger.debug('Invalidated stale cache entry', { 
            filePath: resolvedPath, 
            cached: cached.timestamp, 
            modified: stats.mtime 
          });
        }
      }
      
      if (!stats.isFile()) {
        throw new ChecksumError(`Path is not a file: ${resolvedPath}`, resolvedPath);
      }
      
      if (stats.size > this.options.maxFileSize) {
        throw new ChecksumError(
          `File size (${stats.size}) exceeds maximum allowed size (${this.options.maxFileSize})`,
          resolvedPath
        );
      }

      // Calculate checksum using streaming for efficiency
      const hash = createHash(this.options.algorithm);
      const stream = createReadStream(resolvedPath);
      
      return new Promise<ChecksumInfo>((resolve, reject) => {
        const timeout = setTimeout(() => {
          stream.destroy();
          reject(new ChecksumError(
            `Checksum calculation timed out after ${this.options.timeout}ms`,
            resolvedPath
          ));
        }, this.options.timeout);

        stream.on('data', (chunk) => {
          hash.update(chunk);
        });

        stream.on('end', () => {
          clearTimeout(timeout);
          const processingTime = Date.now() - startTime;
          
          const checksumInfo: ChecksumInfo = {
            hash: hash.digest('hex'),
            algorithm: this.options.algorithm,
            fileSize: stats.size,
            filePath: resolvedPath,
            timestamp: new Date(),
            processingTime
          };

          // Cache the result if enabled
          if (this.options.enableCaching) {
            this.addToCache(resolvedPath, checksumInfo);
          }

          this.logger.debug('Checksum calculated successfully', {
            filePath: resolvedPath,
            hash: checksumInfo.hash,
            processingTime
          });

          resolve(checksumInfo);
        });

        stream.on('error', (error) => {
          clearTimeout(timeout);
          reject(new ChecksumError(
            `Failed to read file for checksum calculation: ${error.message}`,
            resolvedPath,
            error
          ));
        });
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Checksum calculation failed', {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });
      
      if (error instanceof ChecksumError) {
        throw error;
      }
      
      throw new ChecksumError(
        `Checksum calculation failed: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error as Error
      );
    }
  }

  /**
   * Calculate checksum synchronously (for smaller files)
   */
  async calculateChecksumSync(filePath: string): Promise<ChecksumInfo> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    
    this.logger.debug('Calculating checksum (sync)', {
      filePath: resolvedPath,
      algorithm: this.options.algorithm
    });

    try {
      // Get file stats first to check modification time
      const stats = await stat(resolvedPath);
      
      // Check cache first if enabled (after getting stats to validate file modification time)
      if (this.options.enableCaching) {
        const cached = this.checksumCache.get(resolvedPath);
        if (cached && cached.timestamp >= stats.mtime) {
          this.logger.debug('Using cached checksum', { filePath: resolvedPath });
          return cached;
        } else if (cached && cached.timestamp < stats.mtime) {
          // File was modified since cache entry, remove stale cache
          this.checksumCache.delete(resolvedPath);
          this.logger.debug('Invalidated stale cache entry', { 
            filePath: resolvedPath, 
            cached: cached.timestamp, 
            modified: stats.mtime 
          });
        }
      }

      // Read file and calculate checksum
      const fileBuffer = await readFile(resolvedPath);
      
      if (stats.size > this.options.maxFileSize) {
        throw new ChecksumError(
          `File size (${stats.size}) exceeds maximum allowed size (${this.options.maxFileSize})`,
          resolvedPath
        );
      }

      const hash = createHash(this.options.algorithm);
      hash.update(fileBuffer);
      
      const processingTime = Date.now() - startTime;
      
      const checksumInfo: ChecksumInfo = {
        hash: hash.digest('hex'),
        algorithm: this.options.algorithm,
        fileSize: stats.size,
        filePath: resolvedPath,
        timestamp: new Date(),
        processingTime
      };

      // Cache the result if enabled
      if (this.options.enableCaching) {
        this.addToCache(resolvedPath, checksumInfo);
      }

      this.logger.debug('Checksum calculated successfully (sync)', {
        filePath: resolvedPath,
        hash: checksumInfo.hash,
        processingTime
      });

      return checksumInfo;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Checksum calculation failed (sync)', {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });
      
      if (error instanceof ChecksumError) {
        throw error;
      }
      
      throw new ChecksumError(
        `Checksum calculation failed: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error as Error
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
    this.logger.debug('Checksum cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.checksumCache.size,
      maxSize: this.options.cacheSize
    };
  }

  /**
   * Validate file integrity by comparing current checksum with expected
   */
  async validateFile(
    filePath: string,
    expectedChecksum: string | ChecksumInfo
  ): Promise<FileValidationResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    
    this.logger.debug('Validating file integrity', {
      filePath: resolvedPath,
      expectedChecksum: typeof expectedChecksum === 'string' ? expectedChecksum : expectedChecksum.hash
    });

    try {
      // Calculate current checksum
      const currentChecksum = await this.calculateChecksum(resolvedPath);
      
      // Extract expected hash
      const expectedHash = typeof expectedChecksum === 'string' 
        ? expectedChecksum 
        : expectedChecksum.hash;
      
      const isValid = currentChecksum.hash === expectedHash;
      const processingTime = Date.now() - startTime;
      
      const result: FileValidationResult = {
        filePath: resolvedPath,
        isValid,
        currentChecksum,
        originalChecksum: typeof expectedChecksum === 'object' ? expectedChecksum : undefined,
        validatedAt: new Date(),
        processingTime
      };

      if (!isValid) {
        result.error = `Checksum mismatch: expected ${expectedHash}, got ${currentChecksum.hash}`;
        this.logger.warn('File integrity validation failed', {
          filePath: resolvedPath,
          expected: expectedHash,
          actual: currentChecksum.hash,
          processingTime
        });
      } else {
        this.logger.debug('File integrity validation passed', {
          filePath: resolvedPath,
          checksum: currentChecksum.hash,
          processingTime
        });
      }

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('File integrity validation error', {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      return {
        filePath: resolvedPath,
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
        validatedAt: new Date(),
        processingTime
      };
    }
  }

  /**
   * Validate multiple files in batch
   */
  async validateBatch(
    files: Array<{ path: string; expectedChecksum: string | ChecksumInfo }>
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();
    
    this.logger.debug('Starting batch validation', {
      fileCount: files.length,
      batchSize: this.options.batchSize
    });

    const results: FileValidationResult[] = [];
    let validFiles = 0;
    let invalidFiles = 0;

    try {
      // Process files in batches to avoid overwhelming the system
      for (let i = 0; i < files.length; i += this.options.batchSize) {
        const batch = files.slice(i, i + this.options.batchSize);
        
        this.logger.debug(`Processing batch ${Math.floor(i / this.options.batchSize) + 1}`, {
          batchStart: i,
          batchSize: batch.length
        });

        // Process batch in parallel
        const batchPromises = batch.map(file => 
          this.validateFile(file.path, file.expectedChecksum)
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
        processedAt: new Date()
      };

      this.logger.info('Batch validation completed', {
        totalFiles: files.length,
        validFiles,
        invalidFiles,
        totalProcessingTime
      });

      return batchResult;

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      this.logger.error('Batch validation failed', {
        error: error instanceof Error ? error.message : String(error),
        processedFiles: results.length,
        totalFiles: files.length,
        totalProcessingTime
      });

      throw new ValidationError(
        `Batch validation failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Compare checksums of two files
   */
  async compareFiles(filePath1: string, filePath2: string): Promise<{
    match: boolean;
    checksum1: ChecksumInfo;
    checksum2: ChecksumInfo;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    this.logger.debug('Comparing files', {
      file1: filePath1,
      file2: filePath2
    });

    try {
      // Calculate checksums for both files in parallel
      const [checksum1, checksum2] = await Promise.all([
        this.calculateChecksum(filePath1),
        this.calculateChecksum(filePath2)
      ]);

      const match = checksum1.hash === checksum2.hash;
      const processingTime = Date.now() - startTime;

      this.logger.debug('File comparison completed', {
        file1: filePath1,
        file2: filePath2,
        match,
        processingTime
      });

      return {
        match,
        checksum1,
        checksum2,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('File comparison failed', {
        file1: filePath1,
        file2: filePath2,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      throw new ValidationError(
        `File comparison failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error as Error
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
          error: 'Path exists but is not a file'
        };
      }

      return {
        exists: true,
        readable: true,
        size: stats.size
      };

    } catch (error) {
      this.logger.debug('File access verification failed', {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        exists: false,
        readable: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate validation metadata for reporting
   */
  generateMetadata(
    operation: 'checksum' | 'validation' | 'backup' | 'rollback' | 'cleanup',
    processingTime: number,
    context?: Record<string, unknown>
  ): ValidationMetadata {
    return {
      source: 'FileIntegrityValidator',
      operation,
      timestamp: new Date(),
      processingTime,
      options: this.options,
      context
    };
  }

  /**
   * Create a compression stream based on the configured algorithm
   */
  private createCompressionStream() {
    const { compressionAlgorithm, compressionLevel } = this.options;
    
    switch (compressionAlgorithm) {
      case 'gzip':
        return createGzip({ level: Math.min(compressionLevel, 9) });
      case 'deflate':
        return createDeflate({ level: Math.min(compressionLevel, 9) });
      case 'brotli':
        return createBrotliCompress({
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: Math.min(compressionLevel, 11)
          }
        });
      default:
        throw new IntegrityError(`Unsupported compression algorithm: ${compressionAlgorithm}`);
    }
  }

  /**
   * Create a decompression stream based on file extension
   */
  private createDecompressionStream(filePath: string) {
    const ext = extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.gz':
        return createGunzip();
      case '.deflate':
        return createInflate();
      case '.br':
        return createBrotliDecompress();
      default:
        throw new IntegrityError(`Cannot determine decompression method for file: ${filePath}`);
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
      case 'gzip':
        return '.gz';
      case 'deflate':
        return '.deflate';
      case 'brotli':
        return '.br';
      default:
        return '.gz';
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
      const indexData = await readFile(this.deduplicationIndexPath, 'utf-8');
      this.deduplicationIndex = JSON.parse(indexData);
      
      this.logger.debug('Deduplication index loaded', {
        indexPath: this.deduplicationIndexPath,
        totalEntries: this.deduplicationIndex?.totalEntries
      });
      
      return this.deduplicationIndex!;
    } catch {
      // Create new index if file doesn't exist
      this.deduplicationIndex = {
        version: '1.0.0',
        totalEntries: 0,
        spaceSaved: 0,
        lastUpdated: new Date(),
        entries: {},
        stats: {
          totalOriginalSize: 0,
          totalDeduplicatedSize: 0,
          duplicatesFound: 0,
          averageReferenceCount: 0
        }
      };
      
      await this.saveDeduplicationIndex();
      
      this.logger.debug('Created new deduplication index', {
        indexPath: this.deduplicationIndexPath
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
        const { mkdir } = await import('node:fs/promises');
        await mkdir(dedupDir, { recursive: true });
        this.logger.debug('Created deduplication directory', { dedupDir });
      }

      // Update timestamp and stats
      this.deduplicationIndex.lastUpdated = new Date();
      this.updateDeduplicationStats();

      // Save to disk
      const indexData = JSON.stringify(this.deduplicationIndex, null, 2);
      await import('node:fs/promises').then(fs => 
        fs.writeFile(this.deduplicationIndexPath, indexData, 'utf-8')
      );

      this.logger.debug('Deduplication index saved', {
        indexPath: this.deduplicationIndexPath,
        totalEntries: this.deduplicationIndex.totalEntries
      });
    } catch (error) {
      this.logger.error('Failed to save deduplication index', {
        indexPath: this.deduplicationIndexPath,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new IntegrityError(
        `Failed to save deduplication index: ${error instanceof Error ? error.message : String(error)}`,
        'DEDUP_INDEX_SAVE_ERROR'
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

    this.deduplicationIndex.spaceSaved = totalOriginalSize - totalDeduplicatedSize;
    this.deduplicationIndex.stats = {
      totalOriginalSize,
      totalDeduplicatedSize,
      duplicatesFound,
      averageReferenceCount: entries.length > 0 ? totalReferences / entries.length : 0
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
          reject(new IntegrityError(
            `Content hash calculation timed out after ${this.options.timeout}ms`,
            'CONTENT_HASH_TIMEOUT',
            resolvedPath
          ));
        }, this.options.timeout);

        stream.on('data', (chunk) => {
          hash.update(chunk);
        });

        stream.on('end', () => {
          clearTimeout(timeout);
          const contentHash = hash.digest('hex');
          const processingTime = Date.now() - startTime;
          
          this.logger.debug('Content hash calculated', {
            filePath: resolvedPath,
            contentHash,
            algorithm: this.options.deduplicationAlgorithm,
            processingTime
          });
          
          resolve(contentHash);
        });

        stream.on('error', (error) => {
          clearTimeout(timeout);
          reject(new IntegrityError(
            `Failed to calculate content hash: ${error.message}`,
            'CONTENT_HASH_ERROR',
            resolvedPath,
            'deduplication',
            error
          ));
        });
      });
    } catch (error) {
      throw new IntegrityError(
        `Content hash calculation failed: ${error instanceof Error ? error.message : String(error)}`,
        'CONTENT_HASH_ERROR',
        resolvedPath,
        'deduplication',
        error as Error
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
  async deduplicateFile(filePath: string, targetPath?: string): Promise<DeduplicationResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    const finalTargetPath = targetPath ? resolve(targetPath) : resolvedPath;
    
    this.logger.debug('Starting file deduplication', {
      filePath: resolvedPath,
      targetPath: finalTargetPath,
      threshold: this.options.deduplicationThreshold
    });

    try {
      // Check if file exists first
      try {
        await stat(resolvedPath);
      } catch (error) {
        const processingTime = Date.now() - startTime;
        return {
          deduplicated: false,
          contentHash: '',
          isNewEntry: false,
          referenceCount: 0,
          spaceSaved: 0,
          error: `File does not exist: ${resolvedPath}`,
          processingTime
        };
      }

      // Check if deduplication should be performed
      const shouldDeduplicate = await this.shouldDeduplicateFile(resolvedPath);
      if (!shouldDeduplicate) {
        return {
          deduplicated: false,
          contentHash: '',
          isNewEntry: false,
          referenceCount: 0,
          spaceSaved: 0,
          processingTime: Date.now() - startTime
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
            const { link } = await import('node:fs/promises');
            await link(existingEntry.storagePath, finalTargetPath);
            this.logger.debug('Created hard link for deduplicated content', {
              source: existingEntry.storagePath,
              target: finalTargetPath
            });
          } catch (error) {
            // Fallback to copy if hard linking fails
            await copyFile(existingEntry.storagePath, finalTargetPath);
            this.logger.debug('Hard link failed, used copy for deduplicated content', {
              source: existingEntry.storagePath,
              target: finalTargetPath,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        } else {
          await copyFile(existingEntry.storagePath, finalTargetPath);
          this.logger.debug('Copied deduplicated content', {
            source: existingEntry.storagePath,
            target: finalTargetPath
          });
        }

        await this.saveDeduplicationIndex();

        const processingTime = Date.now() - startTime;
        const spaceSaved = fileSize; // We saved the full file size

        this.logger.info('File deduplicated (existing content)', {
          filePath: resolvedPath,
          contentHash,
          referenceCount: existingEntry.referenceCount,
          spaceSaved,
          processingTime
        });

        return {
          deduplicated: true,
          contentHash,
          storagePath: existingEntry.storagePath,
          isNewEntry: false,
          referenceCount: existingEntry.referenceCount,
          spaceSaved,
          processingTime
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
          compressed: false // TODO: Add compression support
        };

        index.entries[contentHash] = entry;

        // If target is different from source, create link/copy to target
        if (finalTargetPath !== resolvedPath) {
          if (this.options.useHardLinks) {
            try {
              const { link } = await import('node:fs/promises');
              await link(storagePath, finalTargetPath);
              this.logger.debug('Created hard link for new deduplicated content', {
                source: storagePath,
                target: finalTargetPath
              });
            } catch (error) {
              await copyFile(storagePath, finalTargetPath);
              this.logger.debug('Hard link failed, used copy for new deduplicated content', {
                source: storagePath,
                target: finalTargetPath,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else {
            await copyFile(storagePath, finalTargetPath);
          }
        }

        await this.saveDeduplicationIndex();

        const processingTime = Date.now() - startTime;

        this.logger.info('File deduplicated (new content)', {
          filePath: resolvedPath,
          contentHash,
          storagePath,
          fileSize,
          processingTime
        });

        return {
          deduplicated: true,
          contentHash,
          storagePath,
          isNewEntry: true,
          referenceCount: 1,
          spaceSaved: 0, // No space saved for first occurrence
          processingTime
        };
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('File deduplication failed', {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      return {
        deduplicated: false,
        contentHash: '',
        isNewEntry: false,
        referenceCount: 0,
        spaceSaved: 0,
        error: error instanceof Error ? error.message : String(error),
        processingTime
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
        indexPath: this.deduplicationIndexPath
      };
    }

    const index = await this.loadDeduplicationIndex();
    
    return {
      enabled: true,
      totalEntries: index.totalEntries,
      spaceSaved: index.spaceSaved,
      duplicatesFound: index.stats.duplicatesFound,
      averageReferenceCount: index.stats.averageReferenceCount,
      indexPath: this.deduplicationIndexPath
    };
  }

  /**
   * Create a backup of a file before modification
   */
  async createBackup(filePath: string): Promise<BackupResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    
    this.logger.debug('Creating backup', {
      filePath: resolvedPath,
      backupDirectory: this.options.backupDirectory,
      compressionEnabled: this.options.enableCompression,
      deduplicationEnabled: this.options.enableDeduplication
    });

    try {
      // Verify source file exists
      const fileAccess = await this.verifyFileAccess(resolvedPath);
      if (!fileAccess.exists || !fileAccess.readable) {
        throw new RollbackError(
          `Cannot backup file: ${fileAccess.error || 'File not accessible'}`,
          resolvedPath
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
        const { mkdir } = await import('node:fs/promises');
        await mkdir(backupDir, { recursive: true });
        this.logger.debug('Created backup directory', { backupDir });
      }

      // Check if deduplication should be attempted first
      const shouldDeduplicate = await this.shouldDeduplicateFile(resolvedPath);
      let deduplicationResult: DeduplicationResult | null = null;
      
      if (shouldDeduplicate) {
        this.logger.debug('Attempting deduplication for backup', { filePath: resolvedPath });
        deduplicationResult = await this.deduplicateFile(resolvedPath);
      }

      // Determine if compression should be used (if not using deduplication)
      const shouldCompress = !shouldDeduplicate && await this.shouldCompressFile(resolvedPath);
      
      // Generate backup file path with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
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
          type: 'deduplication_reference',
          originalPath: resolvedPath,
          contentHash: deduplicationResult.contentHash,
          storagePath: deduplicationResult.storagePath,
          referenceCount: deduplicationResult.referenceCount,
          timestamp: new Date(),
          algorithm: this.options.deduplicationAlgorithm
        };
        
        await import('node:fs/promises').then(fs => 
          fs.writeFile(backupPath, JSON.stringify(dedupMetadata, null, 2), 'utf-8')
        );
        
        const metadataStats = await stat(backupPath);
        backupSize = metadataStats.size;
        
        this.logger.debug('Created deduplication reference backup', {
          originalPath: resolvedPath,
          backupPath,
          contentHash: deduplicationResult.contentHash,
          referenceCount: deduplicationResult.referenceCount
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
        compressionAlgorithm: shouldCompress ? this.options.compressionAlgorithm : undefined,
        compressionRatio: shouldCompress ? (originalSize / backupSize) : undefined,
        deduplicated: deduplicationResult?.deduplicated || false,
        contentHash: deduplicationResult?.contentHash,
        referenceCount: deduplicationResult?.referenceCount,
        deduplicationPath: deduplicationResult?.storagePath
      };

      this.logger.info('Backup created successfully', {
        originalPath: resolvedPath,
        backupPath,
        originalSize,
        backupSize,
        compressed: shouldCompress,
        compressionRatio: result.compressionRatio,
        deduplicated: result.deduplicated,
        contentHash: result.contentHash,
        spaceSaved: deduplicationResult?.spaceSaved || 0,
        processingTime
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Backup creation failed', {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      if (error instanceof RollbackError) {
        throw error;
      }

      throw new RollbackError(
        `Backup creation failed: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error as Error
      );
    }
  }

  /**
   * Create a compressed backup using streaming compression
   */
  private async createCompressedBackup(sourcePath: string, backupPath: string): Promise<void> {
    try {
      const source = createReadStream(sourcePath);
      const destination = createWriteStream(backupPath);
      const compressor = this.createCompressionStream();

      // Use pipeline for efficient streaming compression
      await pipeline(source, compressor, destination);
      
      this.logger.debug('Compressed backup created successfully', {
        sourcePath,
        backupPath,
        algorithm: this.options.compressionAlgorithm
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
        error as Error
      );
    }
  }

  /**
   * Check if a backup file is compressed based on its extension
   */
  private isCompressedBackup(backupPath: string): boolean {
    const fileName = basename(backupPath);
    return fileName.endsWith('.backup.gz') || 
           fileName.endsWith('.backup.deflate') || 
           fileName.endsWith('.backup.br');
  }

  /**
   * Restore a file from a compressed backup using streaming decompression
   */
  private async restoreCompressedBackup(backupPath: string, targetPath: string): Promise<void> {
    try {
      const source = createReadStream(backupPath);
      const destination = createWriteStream(targetPath);
      const decompressor = this.createDecompressionStream(backupPath);

      // Use pipeline for efficient streaming decompression
      await pipeline(source, decompressor, destination);
      
      this.logger.debug('Compressed backup restored successfully', {
        backupPath,
        targetPath
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
        error as Error
      );
    }
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(
    filePath: string,
    backupPath: string
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    const resolvedBackupPath = resolve(backupPath);
    
    this.logger.debug('Restoring from backup', {
      filePath: resolvedPath,
      backupPath: resolvedBackupPath
    });

    try {
      // Verify backup file exists
      const backupAccess = await this.verifyFileAccess(resolvedBackupPath);
      if (!backupAccess.exists || !backupAccess.readable) {
        throw new RollbackError(
          `Cannot restore from backup: ${backupAccess.error || 'Backup file not accessible'}`,
          resolvedPath
        );
      }

      // Create backup of current file if it exists (nested backup for safety)
      let currentFileBackupPath: string | undefined;
      const currentFileAccess = await this.verifyFileAccess(resolvedPath);
      if (currentFileAccess.exists) {
        try {
          // Add a small delay to ensure unique timestamp for safety backup
          await new Promise(resolve => setTimeout(resolve, 2));
          const currentBackup = await this.createBackup(resolvedPath);
          currentFileBackupPath = currentBackup.backupPath;
          this.logger.debug('Created safety backup of current file', {
            originalPath: resolvedPath,
            safetyBackupPath: currentFileBackupPath
          });
        } catch (error) {
          this.logger.warn('Failed to create safety backup, proceeding anyway', {
            error: error instanceof Error ? error.message : String(error)
          });
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
      await new Promise(resolve => setTimeout(resolve, 1));

      // Verify restoration if configured
      let integrityVerified = false;
      if (this.options.verifyAfterRollback) {
        try {
          // For compressed backups, we can't directly compare checksums,
          // so we verify that the file was restored successfully by checking it exists and is readable
          if (isCompressed) {
            const restoredAccess = await this.verifyFileAccess(resolvedPath);
            integrityVerified = restoredAccess.exists && restoredAccess.readable;
            
            if (!integrityVerified) {
              throw new RollbackError(
                'Rollback verification failed: restored file is not accessible',
                resolvedPath
              );
            }
          } else {
            // For uncompressed backups, we can compare checksums
            const comparison = await this.compareFiles(resolvedPath, resolvedBackupPath);
            integrityVerified = comparison.match;
            
            if (!integrityVerified) {
              // Restoration failed, try to restore from safety backup if available
              if (currentFileBackupPath) {
                const safetyIsCompressed = this.isCompressedBackup(currentFileBackupPath);
                if (safetyIsCompressed) {
                  await this.restoreCompressedBackup(currentFileBackupPath, resolvedPath);
                } else {
                  await copyFile(currentFileBackupPath, resolvedPath);
                }
                this.logger.warn('Restored original file due to rollback verification failure');
              }
              throw new RollbackError(
                'Rollback verification failed: restored file checksum does not match backup',
                resolvedPath
              );
            }
          }
        } catch (error) {
          this.logger.error('Rollback verification failed', {
            error: error instanceof Error ? error.message : String(error)
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
        processingTime
      };

      this.logger.info('File restored from backup successfully', {
        filePath: resolvedPath,
        backupPath: resolvedBackupPath,
        integrityVerified,
        processingTime
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Rollback failed', {
        filePath: resolvedPath,
        backupPath: resolvedBackupPath,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      if (error instanceof RollbackError) {
        throw error;
      }

      throw new RollbackError(
        `Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
        resolvedPath,
        error as Error
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
    
    this.logger.debug('Starting backup cleanup', {
      backupDirectory: backupDir,
      retentionDays: this.options.backupRetentionDays
    });

    try {
      // Check if backup directory exists
      const { readdir, stat: statFile } = await import('node:fs/promises');
      let files: string[];
      
      try {
        files = await readdir(backupDir);
      } catch {
        // Directory doesn't exist, nothing to clean
        return { cleaned: 0, errors: [], totalSize: 0 };
      }

      const now = Date.now();
      const retentionMs = this.options.backupRetentionDays * 24 * 60 * 60 * 1000;
      const cutoffTime = now - retentionMs;

      let cleaned = 0;
      let totalSize = 0;
      const errors: string[] = [];

      for (const file of files) {
        // Check for both compressed and uncompressed backup files
        const isBackupFile = file.endsWith('.backup') || 
                           file.endsWith('.backup.gz') || 
                           file.endsWith('.backup.deflate') || 
                           file.endsWith('.backup.br');
        
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
            
            this.logger.debug('Cleaned up old backup', {
              file: filePath,
              age: Math.round((now - stats.mtime.getTime()) / (24 * 60 * 60 * 1000)),
              size: stats.size
            });
          }
        } catch (error) {
          const errorMsg = `Failed to clean backup ${file}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.warn('Backup cleanup error', { file, error: errorMsg });
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.info('Backup cleanup completed', {
        cleaned,
        errors: errors.length,
        totalSize,
        processingTime
      });

      return { cleaned, errors, totalSize };

    } catch (error) {
      this.logger.error('Backup cleanup failed', {
        backupDirectory: backupDir,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new RollbackError(
        `Backup cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        backupDir,
        error as Error
      );
    }
  }
}

/**
 * Convenience factory function for creating FileIntegrityValidator instances
 */
export function createFileIntegrityValidator(
  options: Partial<FileIntegrityOptions> = {}
): FileIntegrityValidator {
  return new FileIntegrityValidator(options);
}

/**
 * Convenience function for quick checksum calculation
 */
export async function calculateFileChecksum(
  filePath: string,
  algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256'
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
  algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256'
): Promise<boolean> {
  try {
    const checksumInfo = await calculateFileChecksum(filePath, algorithm);
    return checksumInfo.hash === expectedChecksum;
  } catch {
    return false;
  }
} 