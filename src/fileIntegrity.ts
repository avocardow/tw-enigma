import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, copyFile, unlink, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, basename, extname, join } from 'node:path';
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
  operation: 'checksum' | 'validation' | 'backup' | 'rollback' | 'cleanup';
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
    
    this.logger.debug('FileIntegrityValidator initialized', {
      algorithm: this.options.algorithm,
      createBackups: this.options.createBackups,
      backupDirectory: this.options.backupDirectory,
      maxFileSize: this.options.maxFileSize,
      timeout: this.options.timeout,
      enableCaching: this.options.enableCaching
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
   * Create a backup of a file before modification
   */
  async createBackup(filePath: string): Promise<BackupResult> {
    const startTime = Date.now();
    const resolvedPath = resolve(filePath);
    
    this.logger.debug('Creating backup', {
      filePath: resolvedPath,
      backupDirectory: this.options.backupDirectory
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

      // Generate backup file path with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const originalName = basename(resolvedPath);
      const extension = extname(originalName);
      const nameWithoutExt = originalName.slice(0, -extension.length);
      const backupName = `${nameWithoutExt}.${timestamp}${extension}.backup`;
      const backupPath = join(backupDir, backupName);

      // Copy file to backup location
      await copyFile(resolvedPath, backupPath);

      // Verify backup integrity
      const comparison = await this.compareFiles(resolvedPath, backupPath);
      if (!comparison.match) {
        // Remove corrupted backup
        await unlink(backupPath);
        throw new RollbackError(
          'Backup verification failed: checksums do not match',
          resolvedPath
        );
      }

      const processingTime = Date.now() - startTime;
      const backupStats = await stat(backupPath);

      const result: BackupResult = {
        originalPath: resolvedPath,
        backupPath,
        success: true,
        createdAt: new Date(),
        backupSize: backupStats.size
      };

      this.logger.info('Backup created successfully', {
        originalPath: resolvedPath,
        backupPath,
        backupSize: backupStats.size,
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

      // Restore from backup
      await copyFile(resolvedBackupPath, resolvedPath);

      // Small delay to ensure file modification time is updated for cache invalidation
      await new Promise(resolve => setTimeout(resolve, 1));

      // Verify restoration if configured
      let integrityVerified = false;
      if (this.options.verifyAfterRollback) {
        try {
          const comparison = await this.compareFiles(resolvedPath, resolvedBackupPath);
          integrityVerified = comparison.match;
          
          if (!integrityVerified) {
            // Restoration failed, try to restore from safety backup if available
            if (currentFileBackupPath) {
              await copyFile(currentFileBackupPath, resolvedPath);
              this.logger.warn('Restored original file due to rollback verification failure');
            }
            throw new RollbackError(
              'Rollback verification failed: restored file checksum does not match backup',
              resolvedPath
            );
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
        if (!file.endsWith('.backup')) {
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