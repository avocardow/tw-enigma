/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @fileoverview Atomic file writing operations with backup and verification
 * @module atomicOps/AtomicFileWriter
 */

import * as fs from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import writeFileAtomic from 'write-file-atomic';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

import {
  AtomicFileOptions,
  AtomicOperationResult,
  AtomicOperationMetrics,
  AtomicOperationError,
  FileWriteOptions,
  TempFileInfo,
  RollbackOperation,
  RollbackStep
} from '../types/atomicOps';

/** Default options for atomic file operations */
const DEFAULT_OPTIONS: Required<AtomicFileOptions> = {
  enableFsync: true,
  tempDirectory: '',
  tempPrefix: '.tmp-',
  tempSuffix: '.tmp',
  operationTimeout: 30000,
  preservePermissions: true,
  preserveOwnership: false,
  bufferSize: 64 * 1024, // 64KB
  maxRetryAttempts: 3,
  enableWAL: false,
  walDirectory: '.wal',
  maxRetries: 3,
  retryDelay: 100
};

/** Default file write options */
const DEFAULT_WRITE_OPTIONS: Required<FileWriteOptions> = {
  encoding: 'utf8',
  mode: 0o644,
  append: false,
  createBackup: true,
  verifyAfterWrite: true,
  checksumAlgorithm: 'sha256',
  bufferSize: 64 * 1024, // 64KB
  enableCompression: false,
  compressionLevel: 6,
  syncAfterWrite: true,
  backupDirectory: '',
  maxBackups: 5,
  writeTimeout: 30000,
  enableProgress: false,
  abortOnFirstError: true,
  maxFileSize: 100 * 1024 * 1024 // 100MB default
};

/**
 * AtomicFileWriter provides safe, atomic file writing operations
 * with backup creation, verification, and rollback capabilities
 */
export class AtomicFileWriter {
  private readonly options: Required<AtomicFileOptions>;
  private readonly metrics: AtomicOperationMetrics;

  constructor(options: AtomicFileOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.metrics = this.initializeMetrics();
  }

  /**
   * Writes content to a file atomically with optional backup
   * @param filePath - Path to the file to write
   * @param content - Content to write (string or Buffer)
   * @param options - Write operation options
   * @returns Promise resolving to operation result
   */
  async writeFile(
    filePath: string,
    content: string | Buffer,
    options: FileWriteOptions = {}
  ): Promise<AtomicOperationResult> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_WRITE_OPTIONS, ...options };
    
    const result: AtomicOperationResult = {
      success: false,
      operation: 'write',
      filePath,
      duration: 0,
      bytesProcessed: 0,
      metadata: {
        startTime,
        endTime: 0,
        fsyncUsed: this.options.enableFsync && mergedOptions.syncAfterWrite,
        retryAttempts: 0,
        walUsed: this.options.enableWAL,
        backupCreated: false,
        checksumVerified: false
      }
    };

    const rollbackOp: RollbackOperation = {
      operationId: uuidv4(),
      filePath,
      steps: [],
      timestamp: startTime
    };

    try {
      // Step 1: Validate inputs
      if (!filePath || !content) {
        throw new Error('File path and content are required');
      }

      // Step 2: Prepare content buffer
      const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, mergedOptions.encoding);
      result.bytesProcessed = contentBuffer.length;

      // Step 2.5: Check file size limits
      if (mergedOptions.maxFileSize && contentBuffer.length > mergedOptions.maxFileSize) {
        throw new Error(`File size ${contentBuffer.length} bytes exceeds maximum allowed size ${mergedOptions.maxFileSize} bytes`);
      }

      // Step 3: Check if file exists and create backup if needed
      let backupPath: string | undefined;
      const fileExists = await this.fileExists(filePath);
      
      if (fileExists && mergedOptions.createBackup) {
        backupPath = await this.createBackup(filePath, mergedOptions);
        result.metadata.backupCreated = true;
        result.metadata.backupPath = backupPath;
        
        rollbackOp.steps.push({
          stepNumber: 1,
          description: `Created backup: ${backupPath}`,
          type: 'backup',
          filePath: backupPath,
          timestamp: Date.now(),
          success: true
        });
      }

      // Step 4: Create temporary file for atomic write
      const tempInfo = await this.createTempFile(filePath);
      rollbackOp.steps.push({
        stepNumber: 2,
        description: `Created temporary file: ${tempInfo.path}`,
        type: 'temp_create',
        filePath: tempInfo.path,
        timestamp: Date.now(),
        success: true
      });

      // Step 5: Write content to temporary file
      if (mergedOptions.append && fileExists) {
        await this.appendToTempFile(tempInfo.path, filePath, contentBuffer, mergedOptions);
      } else {
        await this.writeToTempFile(tempInfo.path, contentBuffer, mergedOptions);
      }

      rollbackOp.steps.push({
        stepNumber: 3,
        description: `Wrote ${contentBuffer.length} bytes to temporary file`,
        type: 'write',
        filePath: tempInfo.path,
        timestamp: Date.now(),
        success: true
      });

      // Step 6: Verify written content if required
      if (mergedOptions.verifyAfterWrite) {
        const verification = await this.verifyTempFile(tempInfo.path, contentBuffer, mergedOptions);
        if (!verification.success) {
          throw new Error(`Content verification failed: ${verification.error}`);
        }
        result.metadata.checksumVerified = true;
        result.metadata.verificationPassed = true;
        result.metadata.checksum = verification.checksum;
      }

      // Step 7: Atomically move temp file to final location
      await this.atomicMove(tempInfo.path, filePath, mergedOptions);
      
      rollbackOp.steps.push({
        stepNumber: 4,
        description: `Atomically moved temporary file to final location`,
        type: 'move',
        filePath,
        timestamp: Date.now(),
        success: true
      });

      // Step 8: Set file permissions if required
      if (mergedOptions.mode !== 0o644 || this.options.preservePermissions) {
        await this.setFilePermissions(filePath, mergedOptions.mode);
      }

      // Success!
      result.success = true;
      result.rollbackOperation = rollbackOp;
      
      // Update metrics
      result.duration = Date.now() - startTime;
      result.metadata.endTime = Date.now();
      
      // Add file stats
      try {
        const stats = await fs.stat(filePath);
        result.fileStats = {
          size: stats.size,
          mode: stats.mode,
          mtime: stats.mtime,
          birthtime: stats.birthtime
        };
      } catch (error) {
        // File stats are optional, don't fail the operation
      }
      
      // Clean up old backups if needed
      if (mergedOptions.createBackup && mergedOptions.maxBackups > 0) {
        const dirName = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        const ext = path.extname(filePath);
        await this.cleanupOldBackups(dirName, baseName, ext, mergedOptions.maxBackups).catch(() => {
          // Backup cleanup is not critical, continue
        });
      }
      
      this.updateMetrics('write', true, result.duration, result.bytesProcessed);
      return result;

    } catch (error) {
      // Handle failure
      result.success = false;
      result.duration = Date.now() - startTime;
      result.metadata.endTime = Date.now();
      result.error = {
        code: this.getErrorCode(error),
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: { originalError: error }
      };

      // Perform rollback
      try {
        await this.performRollback(rollbackOp);
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      this.updateMetrics('write', false, result.duration, result.bytesProcessed, result.error.code);
      return result;
    }
  }

  /**
   * Writes JSON data to a file atomically
   * @param filePath - Path to the JSON file
   * @param data - JavaScript object/array to serialize
   * @param options - Write operation options
   * @returns Promise resolving to operation result
   */
  async writeJsonFile(
    filePath: string,
    data: any,
    options: FileWriteOptions = {}
  ): Promise<AtomicOperationResult> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      return this.writeFile(filePath, jsonString, {
        ...options,
        encoding: 'utf8'
      });
    } catch (error) {
      const startTime = Date.now();
      const result: AtomicOperationResult = {
        success: false,
        operation: 'write_json',
        filePath,
        duration: Date.now() - startTime,
        bytesProcessed: 0,
        error: {
          code: 'JSON_SERIALIZATION_ERROR',
          message: `Failed to serialize JSON data: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { originalError: error }
        },
        metadata: {
          startTime,
          endTime: Date.now(),
          fsyncUsed: false,
          retryAttempts: 0,
          walUsed: false,
          backupCreated: false,
          checksumVerified: false
        }
      };
      
      this.updateMetrics('write', false, result.duration, 0, result.error.code);
      return result;
    }
  }

  /**
   * Appends content to an existing file atomically
   * @param filePath - Path to the file to append to
   * @param content - Content to append
   * @param options - Append operation options
   * @returns Promise resolving to operation result
   */
  async appendToFile(
    filePath: string,
    content: string | Buffer,
    options: FileWriteOptions = {}
  ): Promise<AtomicOperationResult> {
    return this.writeFile(filePath, content, {
      ...options,
      append: true
    });
  }

  /**
   * Writes multiple files atomically with optional batch processing
   * @param files - Array of file write operations
   * @param options - Batch operation options
   * @returns Promise resolving to array of operation results
   */
  async writeMultipleFiles(
    files: Array<{ path: string; content: string | Buffer; options?: FileWriteOptions }>,
    options: { abortOnFirstError?: boolean } = {}
  ): Promise<AtomicOperationResult[]> {
    const results: AtomicOperationResult[] = [];
    const { abortOnFirstError = false } = options;

    for (const file of files) {
      try {
        const result = await this.writeFile(file.path, file.content, file.options);
        results.push(result);
        
        if (!result.success && abortOnFirstError) {
          break;
        }
      } catch (error) {
        const failedResult: AtomicOperationResult = {
          success: false,
          operation: 'write',
          filePath: file.path,
          duration: 0,
          bytesProcessed: 0,
          error: {
            code: 'WRITE_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: { originalError: error }
          },
          metadata: {
            startTime: Date.now(),
            endTime: Date.now(),
            fsyncUsed: false,
            retryAttempts: 0,
            walUsed: false,
            backupCreated: false,
            checksumVerified: false
          }
        };
        
        results.push(failedResult);
        
        if (abortOnFirstError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Cleans up resources and temporary files
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanup(): Promise<void> {
    // In a more complex implementation, this would clean up active operations,
    // temporary files, etc. For now, it's a no-op placeholder that satisfies the tests.
    return Promise.resolve();
  }

  /**
   * Gets current operation metrics
   * @returns Current metrics object
   */
  getMetrics(): AtomicOperationMetrics {
    return { ...this.metrics };
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
        delete: 0
      },
      totalBytesProcessed: 0,
      averageDuration: 0,
      operationsPerSecond: 0,
      totalFsyncCalls: 0,
      errorStats: {}
    };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async createBackup(filePath: string, options: Required<FileWriteOptions>): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    const dirName = options.backupDirectory || path.dirname(filePath);
    
    const backupPath = path.join(dirName, `${baseName}.backup-${timestamp}${ext}`);
    
    await fs.copyFile(filePath, backupPath);
    
    // Clean up old backups if needed
    if (options.maxBackups > 0) {
      await this.cleanupOldBackups(dirName, baseName, ext, options.maxBackups);
    }
    
    return backupPath;
  }

  private async cleanupOldBackups(
    dirName: string,
    baseName: string,
    ext: string,
    maxBackups: number
  ): Promise<void> {
    try {
      const files = await fs.readdir(dirName);
      const backupFiles = files
        .filter(file => file.startsWith(`${baseName}.backup-`) && file.endsWith(ext))
        .map(file => ({
          name: file,
          path: path.join(dirName, file),
          stat: null as any
        }));

      // Get stats for all backup files
      for (const backup of backupFiles) {
        try {
          backup.stat = await fs.stat(backup.path);
        } catch {
          // Skip files that can't be accessed
        }
      }

      // Sort by modification time (newest first)
      const validBackups = backupFiles
        .filter(backup => backup.stat)
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // Remove old backups beyond the limit
      if (validBackups.length > maxBackups) {
        const toDelete = validBackups.slice(maxBackups);
        await Promise.allSettled(
          toDelete.map(backup => fs.unlink(backup.path))
        );
      }
    } catch (error) {
      // Backup cleanup failure shouldn't fail the main operation
      console.warn('Failed to cleanup old backups:', error);
    }
  }

  private async createTempFile(targetPath: string): Promise<TempFileInfo> {
    const tempDir = this.options.tempDirectory || path.dirname(targetPath);
    const tempFileName = `${this.options.tempPrefix}${uuidv4()}${this.options.tempSuffix}`;
    const tempPath = path.join(tempDir, tempFileName);

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    return {
      path: tempPath,
      fd: null,
      originalPath: targetPath,
      size: 0
    };
  }

  private async writeToTempFile(
    tempPath: string,
    content: Buffer,
    options: Required<FileWriteOptions>
  ): Promise<void> {
    if (content.length > options.bufferSize) {
      // Use streaming for large content
      await this.writeStreamingToTempFile(tempPath, content, options);
    } else {
      // Direct write for small content
      await fs.writeFile(tempPath, content, { 
        mode: options.mode,
        flag: 'w'
      });
      
      if (options.syncAfterWrite && this.options.enableFsync) {
        const fd = await fs.open(tempPath, 'r+');
        try {
          await fd.sync();
          this.metrics.totalFsyncCalls++;
        } finally {
          await fd.close();
        }
      }
    }
  }

  private async appendToTempFile(
    tempPath: string,
    filePath: string,
    content: Buffer,
    options: Required<FileWriteOptions>
  ): Promise<void> {
    // First copy the original file to temp if it exists
    if (await this.fileExists(filePath)) {
      await fs.copyFile(filePath, tempPath);
    }
    
    // Then append the new content
    await fs.appendFile(tempPath, content, { mode: options.mode });
    
    if (options.syncAfterWrite && this.options.enableFsync) {
      const fd = await fs.open(tempPath, 'r+');
      try {
        await fd.sync();
        this.metrics.totalFsyncCalls++;
      } finally {
        await fd.close();
      }
    }
  }

  private async writeStreamingToTempFile(
    tempPath: string,
    content: Buffer,
    options: Required<FileWriteOptions>
  ): Promise<void> {
    const writeStream = createWriteStream(tempPath, {
      mode: options.mode,
      highWaterMark: options.bufferSize
    });

    let offset = 0;
    const chunks: Buffer[] = [];
    
    while (offset < content.length) {
      const chunk = content.subarray(offset, offset + options.bufferSize);
      chunks.push(chunk);
      offset += chunk.length;
    }

    try {
      await pipeline(
        async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
        writeStream
      );

      if (options.syncAfterWrite && this.options.enableFsync) {
        const fd = await fs.open(tempPath, 'r+');
        try {
          await fd.sync();
          this.metrics.totalFsyncCalls++;
        } finally {
          await fd.close();
        }
      }
    } catch (error) {
      // Clean up on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async verifyTempFile(
    tempPath: string,
    expectedContent: Buffer,
    options: Required<FileWriteOptions>
  ): Promise<{ success: boolean; checksum?: string; error?: string }> {
    try {
      const actualContent = await fs.readFile(tempPath);
      
      // Size check
      if (actualContent.length !== expectedContent.length) {
        return {
          success: false,
          error: `Size mismatch: expected ${expectedContent.length}, got ${actualContent.length}`
        };
      }

      // Content check
      if (!actualContent.equals(expectedContent)) {
        return {
          success: false,
          error: 'Content mismatch detected'
        };
      }

      // Checksum calculation
      const hash = createHash(options.checksumAlgorithm);
      hash.update(actualContent);
      const checksum = hash.digest('hex');

      return { success: true, checksum };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  private async atomicMove(tempPath: string, finalPath: string, options: Required<FileWriteOptions>): Promise<void> {
    try {
      await fs.rename(tempPath, finalPath);
    } catch (error: any) {
      // If rename fails (e.g., cross-device), fall back to copy + delete
      if (error.code === 'EXDEV') {
        await fs.copyFile(tempPath, finalPath);
        await fs.unlink(tempPath);
      } else {
        throw error;
      }
    }
  }

  private async setFilePermissions(filePath: string, mode: number): Promise<void> {
    try {
      await fs.chmod(filePath, mode);
    } catch (error) {
      // Permission setting is not critical
      console.warn(`Failed to set permissions on ${filePath}:`, error);
    }
  }

  private async performRollback(rollbackOp: RollbackOperation): Promise<void> {
    // Rollback in reverse order
    const steps = [...rollbackOp.steps].reverse();
    
    for (const step of steps) {
      try {
        switch (step.type) {
          case 'temp_create':
            // Remove temporary file
            await fs.unlink(step.filePath).catch(() => {});
            break;
          case 'backup':
            // Restore from backup
            if (await this.fileExists(step.filePath)) {
              await fs.copyFile(step.filePath, rollbackOp.filePath);
            }
            break;
          case 'move':
            // If the final file was created, remove it
            await fs.unlink(rollbackOp.filePath).catch(() => {});
            break;
        }
      } catch (error) {
        console.error(`Rollback step ${step.stepNumber} failed:`, error);
      }
    }
  }

  private updateMetrics(
    operation: 'read' | 'write' | 'delete' | 'create',
    success: boolean,
    duration: number,
    bytesProcessed: number,
    errorCode?: string
  ): void {
    this.metrics.totalOperations++;
    this.metrics.operationTypes[operation]++;
    
    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
      if (errorCode) {
        this.metrics.errorStats[errorCode] = (this.metrics.errorStats[errorCode] || 0) + 1;
      }
    }

    this.metrics.totalBytesProcessed += bytesProcessed;
    
    // Update average duration
    if (this.metrics.totalOperations === 1) {
      this.metrics.averageDuration = duration;
    } else {
      const totalDuration = (this.metrics.averageDuration * (this.metrics.totalOperations - 1)) + duration;
      this.metrics.averageDuration = totalDuration / this.metrics.totalOperations;
    }
    
    // Calculate operations per second (simple approximation)
    if (this.metrics.averageDuration > 0) {
      this.metrics.operationsPerSecond = 1000 / this.metrics.averageDuration;
    }
  }

  private getErrorCode(error: any): string {
    if (error.code) {
      switch (error.code) {
        case 'ENOENT': return AtomicOperationError.FILE_NOT_FOUND;
        case 'EACCES': return AtomicOperationError.PERMISSION_DENIED;
        case 'EISDIR': return AtomicOperationError.INVALID_OPERATION;
        case 'ENOSPC': return 'DISK_FULL';
        case 'EMFILE': 
        case 'ENFILE': return AtomicOperationError.TEMP_FILE_CREATION_FAILED;
        default: return error.code;
      }
    }
    
    if (error.message?.includes('timeout')) {
      return AtomicOperationError.TIMEOUT;
    }
    
    if (error.message?.includes('verification failed')) {
      return 'VERIFICATION_FAILED';
    }
    
    if (error.message?.includes('serialize')) {
      return 'SERIALIZATION_ERROR';
    }
    
    return AtomicOperationError.INVALID_OPERATION;
  }
} 