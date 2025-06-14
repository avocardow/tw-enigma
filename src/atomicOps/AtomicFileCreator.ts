/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @fileoverview Atomic file creation system with transaction safety
 * @module atomicOps/AtomicFileCreator
 */

import * as fs from "fs/promises";
import { createWriteStream, createReadStream, constants } from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import writeFileAtomic from "write-file-atomic";
import { pipeline } from "stream/promises";

import {
  AtomicFileOptions,
  FileCreationOptions,
  AtomicOperationResult,
  TempFileInfo,
  RollbackOperation,
  RollbackStep,
  AtomicOperationError,
  AtomicOperationMetrics,
} from "../types/atomicOps";

/** Default options for atomic file operations */
const DEFAULT_OPTIONS: Required<AtomicFileOptions> = {
  enableFsync: true,
  tempDirectory: "",
  tempPrefix: ".tmp-",
  tempSuffix: ".tmp",
  operationTimeout: 30000,
  preservePermissions: true,
  preserveOwnership: true,
  bufferSize: 64 * 1024, // 64KB
  enableWAL: false,
  walDirectory: ".wal",
  maxRetries: 3,
  maxRetryAttempts: 3, // Alias for maxRetries
  retryDelay: 100,
};

/** Default file creation options */
const DEFAULT_CREATION_OPTIONS: Required<FileCreationOptions> = {
  ...DEFAULT_OPTIONS,
  encoding: "utf8",
  mode: 0o644,
  overwrite: false,
  initialContent: "",
};

/**
 * AtomicFileCreator provides safe, atomic file creation operations
 * with automatic rollback, temporary file management, and data integrity guarantees
 */
export class AtomicFileCreator {
  private readonly options: Required<AtomicFileOptions>;
  private readonly activeTempFiles = new Map<string, TempFileInfo>();
  private readonly activeOperations = new Map<string, RollbackOperation>();
  private readonly metrics: AtomicOperationMetrics;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: AtomicFileOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.metrics = this.initializeMetrics();
    this.startCleanupInterval();
  }

  /**
   * Creates a new file atomically with the specified content
   * @param filePath - Path where the file should be created
   * @param content - Content to write to the file
   * @param options - File creation options
   * @returns Promise resolving to operation result
   */
  async createFile(
    filePath: string,
    content: string | Buffer,
    options: FileCreationOptions = {},
  ): Promise<AtomicOperationResult> {
    const startTime = Date.now();
    const operationId = uuidv4();
    const mergedOptions = { ...DEFAULT_CREATION_OPTIONS, ...options };

    const result: AtomicOperationResult = {
      success: false,
      operation: "create",
      filePath,
      duration: 0,
      bytesProcessed: 0,
      metadata: {
        startTime,
        endTime: 0,
        fsyncUsed: false, // Will be set correctly later
        retryAttempts: 0,
        walUsed: mergedOptions.enableWAL,
        backupCreated: false,
        checksumVerified: false,
      },
    };

    let rollbackOp: RollbackOperation | undefined;

    try {
      // Step 1: Check if file exists and handle overwrite logic
      const fileExists = await this.fileExists(filePath);
      if (fileExists && !mergedOptions.overwrite) {
        throw new Error(`File already exists: ${filePath}`);
      }

      // Step 2: Create rollback operation
      rollbackOp = this.createRollbackOperation(
        operationId,
        "create",
        filePath,
      );
      this.activeOperations.set(operationId, rollbackOp);

      // Step 3: Validate file path and create directory if needed
      await this.ensureDirectoryExists(path.dirname(filePath));

      // Step 4: Create and manage temporary file
      const tempInfo = await this.createTempFile(filePath, operationId);
      result.tempFilePath = tempInfo.path;

      const step1: RollbackStep = {
        stepNumber: 1,
        description: `Created temporary file: ${tempInfo.path}`,
        type: "write",
        filePath: tempInfo.path,
        timestamp: Date.now(),
        success: true,
        rollbackAction: async () => {
          await this.cleanupTempFile(tempInfo.path);
        },
      };
      if (rollbackOp.steps) {
        rollbackOp.steps.push(step1);
      }

      // Step 5: Write content to temporary file
      const contentBuffer = Buffer.isBuffer(content)
        ? content
        : Buffer.from(content, mergedOptions.encoding);

      // Determine actual fsync usage (class setting AND option setting)
      const actualFsyncUsed =
        this.options.enableFsync && mergedOptions.enableFsync;
      const finalOptions = { ...mergedOptions, enableFsync: actualFsyncUsed };

      await this.writeToTempFile(tempInfo.path, contentBuffer, finalOptions);

      // Track fsync usage for metadata
      result.metadata.fsyncUsed = actualFsyncUsed;

      const step2: RollbackStep = {
        stepNumber: 2,
        description: `Wrote content to temporary file: ${contentBuffer.length} bytes`,
        type: "write",
        filePath: tempInfo.path,
        timestamp: Date.now(),
        success: true,
      };
      if (rollbackOp.steps) {
        rollbackOp.steps.push(step2);
      }

      // Step 6: Set file permissions
      if (mergedOptions.preservePermissions) {
        await fs.chmod(tempInfo.path, mergedOptions.mode);

        const step3: RollbackStep = {
          stepNumber: 3,
          description: `Set file permissions: ${mergedOptions.mode.toString(8)}`,
          type: "permissions",
          filePath: tempInfo.path,
          timestamp: Date.now(),
          success: true,
        };
        if (rollbackOp.steps) {
          rollbackOp.steps.push(step3);
        }
      }

      // Step 7: Create backup if file exists (for overwrite case)
      let backupPath: string | undefined;
      if (fileExists && mergedOptions.overwrite) {
        backupPath = await this.createBackup(filePath, operationId);
        rollbackOp.backupPath = backupPath;

        const step4: RollbackStep = {
          stepNumber: 4,
          description: `Created backup: ${backupPath}`,
          type: "backup",
          filePath: backupPath,
          timestamp: Date.now(),
          success: true,
          rollbackAction: async () => {
            if (backupPath) {
              await fs.rename(backupPath, filePath);
            }
          },
        };
        if (rollbackOp.steps) {
          rollbackOp.steps.push(step4);
        }
      }

      // Step 8: Atomically move temp file to final location
      await this.atomicMove(tempInfo.path, filePath, finalOptions);

      const step5: RollbackStep = {
        stepNumber: 5,
        description: `Atomically moved temp file to target location`,
        type: "rename",
        filePath,
        timestamp: Date.now(),
        success: true,
        rollbackAction: async () => {
          if (backupPath) {
            await fs.rename(backupPath, filePath);
          } else {
            await fs.unlink(filePath);
          }
        },
      };
      if (rollbackOp.steps) {
        rollbackOp.steps.push(step5);
      }

      // Step 9: Clean up temporary file tracking
      this.activeTempFiles.delete(tempInfo.operationId);

      // Step 10: Get final file stats
      result.fileStats = await fs.stat(filePath);
      result.bytesProcessed = contentBuffer.length;
      result.success = true;

      // Step 11: Clean up backup file if operation successful
      if (backupPath) {
        await this.cleanupTempFile(backupPath);
      }

      rollbackOp.completed = true;
      this.updateMetrics(
        "create",
        true,
        Date.now() - startTime,
        contentBuffer.length,
      );
    } catch (_error) {
      // Handle operation failure and rollback
      result.error = {
        code: this.getErrorCode(error),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };

      if (rollbackOp) {
        await this.executeRollback(rollbackOp);
      }

      this.updateMetrics(
        "create",
        false,
        Date.now() - startTime,
        0,
        result.error.code,
      );
    } finally {
      result.metadata.endTime = Date.now();
      result.duration = result.metadata.endTime - startTime;

      if (rollbackOp) {
        this.activeOperations.delete(operationId);
      }
    }

    return result;
  }

  /**
   * Creates a new empty file atomically
   */
  async createEmptyFile(
    filePath: string,
    options: FileCreationOptions = {},
  ): Promise<AtomicOperationResult> {
    return this.createFile(filePath, "", options);
  }

  /**
   * Creates a file with JSON content atomically
   */
  async createJsonFile(
    filePath: string,
    data: unknown,
    options: FileCreationOptions = {},
  ): Promise<AtomicOperationResult> {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      return this.createFile(filePath, jsonContent, {
        ...options,
        encoding: "utf8",
      });
    } catch (_error) {
      // Handle JSON serialization errors
      const result: AtomicOperationResult = {
        success: false,
        operation: "create",
        filePath,
        duration: 0,
        bytesProcessed: 0,
        error: {
          code: "JSON_SERIALIZATION_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to serialize data to JSON",
        },
        metadata: {
          startTime: Date.now(),
          endTime: Date.now(),
          fsyncUsed: false,
          retryAttempts: 0,
          walUsed: false,
          backupCreated: false,
          checksumVerified: false,
        },
      };
      return result;
    }
  }

  /**
   * Creates multiple files atomically in a batch operation
   */
  async createMultipleFiles(
    files: Array<{
      path: string;
      content: string | Buffer;
      options?: FileCreationOptions;
    }>,
    options: { stopOnError?: boolean } = {},
  ): Promise<AtomicOperationResult[]> {
    const results: AtomicOperationResult[] = [];
    const successfulFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const result = await this.createFile(
          file.path,
          file.content,
          file.options,
        );
        results.push(result);

        if (result.success) {
          successfulFiles.push(file.path);
        } else if (options.stopOnError) {
          // Rollback all successful files and stop processing
          await this.rollbackMultipleFiles(successfulFiles);
          break; // Stop processing after adding the failed result
        }
      } catch (_error) {
        // Convert thrown errors to failed results
        const failedResult: AtomicOperationResult = {
          success: false,
          operation: "create",
          filePath: file.path,
          duration: 0,
          bytesProcessed: 0,
          error: {
            code: this.getErrorCode(error),
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          metadata: {
            startTime: Date.now(),
            endTime: Date.now(),
            fsyncUsed: false,
            retryAttempts: 0,
            walUsed: false,
            backupCreated: false,
            checksumVerified: false,
          },
        };
        
        results.push(failedResult);
        
        if (options.stopOnError) {
          // Rollback all successful files and stop processing
          await this.rollbackMultipleFiles(successfulFiles);
          break; // Stop processing after adding the failed result
        }
      }
    }

    return results;
  }

  /**
   * Gets current performance metrics
   */
  getMetrics(): AtomicOperationMetrics {
    return { 
      ...this.metrics,
      operationTypes: { ...this.metrics.operationTypes },
      errorStats: { ...this.metrics.errorStats }
    };
  }

  /**
   * Cleans up all temporary files and active operations
   */
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clean up temporary files
    const tempCleanupPromises = Array.from(this.activeTempFiles.values()).map(
      (tempInfo) => this.cleanupTempFile(tempInfo.path),
    );
    await Promise.allSettled(tempCleanupPromises);

    // Rollback any incomplete operations
    const rollbackPromises = Array.from(this.activeOperations.values()).map(
      (operation) => this.executeRollback(operation),
    );
    await Promise.allSettled(rollbackPromises);

    this.activeTempFiles.clear();
    this.activeOperations.clear();
  }

  /**
   * Shuts down the file creator and cleans up resources
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    await this.cleanup();
    console.log("AtomicFileCreator shutdown complete.");
  }

  /**
   * Private Methods
   */

  private initializeMetrics(): AtomicOperationMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      totalBytesProcessed: 0,
      operationsPerSecond: 0,
      totalFsyncCalls: 0,
      totalRetryAttempts: 0,
      errorStats: {},
      operationTypes: {
        read: 0,
        write: 0,
        delete: 0,
        create: 0,
      },
    };
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupStaleOperations();
    }, 60000); // Run every minute
  }

  private async cleanupStaleOperations(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    // Clean up stale temp files
    for (const [operationId, tempInfo] of this.activeTempFiles.entries()) {
      if (now - tempInfo.createdAt > staleThreshold) {
        await this.cleanupTempFile(tempInfo.path);
        this.activeTempFiles.delete(operationId);
      }
    }

    // Clean up stale operations
    for (const [operationId, operation] of this.activeOperations.entries()) {
      const age = Date.now() - (operation.startTime || operation.timestamp);
      if (!operation.completed && age > this.options.operationTimeout) {
        await this.executeRollback(operation);
        this.activeOperations.delete(operationId);
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  private async createTempFile(
    targetPath: string,
    operationId: string,
  ): Promise<TempFileInfo> {
    const tempDir = this.options.tempDirectory || path.dirname(targetPath);
    const tempFileName = `${this.options.tempPrefix}${path.basename(targetPath)}-${operationId}${this.options.tempSuffix}`;
    const tempPath = path.join(tempDir, tempFileName);

    const tempInfo: TempFileInfo = {
      path: tempPath,
      targetPath,
      createdAt: Date.now(),
      pid: process.pid,
      operationId,
      cleanupTimeout: this.options.operationTimeout,
    };

    this.activeTempFiles.set(operationId, tempInfo);
    return tempInfo;
  }

  private async writeToTempFile(
    tempPath: string,
    content: Buffer,
    options: Required<FileCreationOptions>,
  ): Promise<void> {
    if (options.enableFsync) {
      // Use write-file-atomic for fsync support
      const atomicOptions: {
        encoding?: string;
        mode: number;
      } = {
        encoding: options.encoding === "utf8" ? "utf8" : undefined,
        mode: options.mode,
      };
      
      // Only set chown if we want to preserve ownership
      if (options.preserveOwnership) {
        // Let write-file-atomic handle ownership automatically
        // Don't set chown option to let it preserve existing ownership
      }
      
      await writeFileAtomic(tempPath, content, atomicOptions);
      this.metrics.totalFsyncCalls++;
    } else {
      // Use regular write without fsync
      const writeOptions: Parameters<typeof fs.writeFile>[2] = {
        mode: options.mode,
      };
      if (options.encoding) {
        (writeOptions as { encoding?: string }).encoding = options.encoding;
      }
      await fs.writeFile(tempPath, content, writeOptions);
    }
  }

  private async atomicMove(
    sourcePath: string,
    targetPath: string,
    options: Required<FileCreationOptions>,
  ): Promise<void> {
    try {
      await fs.rename(sourcePath, targetPath);
    } catch (error: unknown) {
      // If rename fails (e.g., cross-device), fall back to copy + delete
      if (error && typeof error === 'object' && 'code' in error && error.code === "EXDEV") {
        await this.copyFile(sourcePath, targetPath, _options);
        await fs.unlink(sourcePath);
      } else {
        throw error;
      }
    }
  }

  private async copyFile(
    sourcePath: string,
    targetPath: string,
    options: Required<FileCreationOptions>,
  ): Promise<void> {
    const readStream = createReadStream(sourcePath, {
      highWaterMark: options.bufferSize,
    });
    const writeStream = createWriteStream(targetPath, {
      mode: options.mode,
      highWaterMark: options.bufferSize,
    });

    await pipeline(readStream, writeStream);

    if (options.enableFsync) {
      await writeStream.close();
      this.metrics.totalFsyncCalls++;
    }
  }

  private async createBackup(
    filePath: string,
    operationId: string,
  ): Promise<string> {
    const backupPath = `${filePath}.backup-${operationId}`;
    await fs.copyFile(filePath, backupPath);
    return backupPath;
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      // Ignore if file doesn't exist
      if (error && typeof error === 'object' && 'code' in error && error.code !== "ENOENT") {
        const message = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
        console.warn(`Failed to cleanup temp file ${filePath}:`, message);
      }
    }
  }

  private createRollbackOperation(
    operationId: string,
    operation: "create" | "write" | "delete",
    filePath: string,
  ): RollbackOperation {
    return {
      type: operation === "create" ? "file_create" : operation === "write" ? "file_overwrite" : "file_delete",
      filePath,
      timestamp: Date.now(),
      operationId,
      steps: [],
      completed: false,
      startTime: Date.now(),
      operation,
    };
  }

  private async executeRollback(operation: RollbackOperation): Promise<void> {
    console.warn(`Executing rollback for operation ${operation.operationId}`);

    // Execute rollback steps in reverse order
    if (operation.steps) {
      for (let i = operation.steps.length - 1; i >= 0; i--) {
        const step = operation.steps[i];
      if (step.rollbackAction) {
        try {
          await step.rollbackAction();
        } catch (_error) {
          console.error(`Rollback step ${step.stepNumber} failed:`, error);
        }
      }
    }
  }
  }

  private async rollbackMultipleFiles(filePaths: string[]): Promise<void> {
    const rollbackPromises = filePaths.map((filePath) =>
      fs.unlink(filePath).catch((error) => {
        // Only log error if it's not "file not found" (ENOENT)
        if (!(error && typeof error === 'object' && 'code' in error && error.code === "ENOENT")) {
          console.error(`Failed to rollback file ${filePath}:`, error);
        }
      }),
    );
    await Promise.allSettled(rollbackPromises);
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

    // Update average duration
    const totalDuration =
      this.metrics.averageDuration * (this.metrics.totalOperations - 1) +
      duration;
    this.metrics.averageDuration = totalDuration / this.metrics.totalOperations;

    // Calculate operations per second (approximate)
    this.metrics.operationsPerSecond =
      (this.metrics.totalOperations /
        (Date.now() -
          (Date.now() -
            this.metrics.averageDuration * this.metrics.totalOperations))) *
      1000;
  }

  private getErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
      switch (error.code) {
        case "ENOENT":
          return AtomicOperationError.FILE_NOT_FOUND;
        case "EACCES":
          return AtomicOperationError.PERMISSION_DENIED;
        case "ENOSPC":
          return AtomicOperationError.DISK_FULL;
        case "EMFILE":
        case "ENFILE":
          return AtomicOperationError.TEMP_FILE_CREATION_FAILED;
        default:
          return error.code;
      }
    }

    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes("timeout")) {
      return AtomicOperationError.TIMEOUT;
    }

    return AtomicOperationError.INVALID_OPERATION;
  }
}
