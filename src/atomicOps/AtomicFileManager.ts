/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @fileoverview Atomic file manager with comprehensive temporary file lifecycle management
 * @module atomicOps/AtomicFileManager
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

import {
  AtomicFileOptions,
  TempFileInfo,
  AtomicOperationMetrics
} from '../types/atomicOps';

/** Default options for temporary file management */
const DEFAULT_TEMP_OPTIONS: Required<Pick<AtomicFileOptions, 'tempDirectory' | 'tempPrefix' | 'tempSuffix' | 'operationTimeout'>> = {
  tempDirectory: '',
  tempPrefix: '.tmp-',
  tempSuffix: '.tmp',
  operationTimeout: 30000
};

/**
 * Manages temporary files with comprehensive lifecycle management,
 * cleanup routines, and automatic resource management
 */
export class AtomicFileManager {
  private readonly options: Required<AtomicFileOptions>;
  private readonly activeTempFiles: Map<string, TempFileInfo>;
  private readonly cleanupIntervals: Set<NodeJS.Timeout>;
  private readonly metrics: AtomicOperationMetrics;
  private isShuttingDown: boolean = false;

  constructor(options: AtomicFileOptions = {}) {
    this.options = {
      ...DEFAULT_TEMP_OPTIONS,
      enableFsync: true,
      preservePermissions: true,
      preserveOwnership: false,
      bufferSize: 64 * 1024,
      maxRetryAttempts: 3,
      enableWAL: false,
      walDirectory: '.wal',
      maxRetries: 3,
      retryDelay: 100,
      ...options
    };
    
    this.activeTempFiles = new Map();
    this.cleanupIntervals = new Set();
    this.metrics = this.initializeMetrics();
    
    // Increase max listeners to handle multiple instances in tests
    if (process.getMaxListeners() < 20) {
      process.setMaxListeners(20);
    }
    
    // Set up automatic cleanup on process exit
    this.setupProcessExitHandlers();
    
    // Start periodic cleanup of abandoned files
    this.startPeriodicCleanup();
  }

  /**
   * Creates a new temporary file with unique naming and tracking
   * @param targetPath - The final destination path for the file
   * @param options - Creation options
   * @returns Promise resolving to temporary file information
   */
  async createTempFile(targetPath: string, options: { cleanupTimeout?: number } = {}): Promise<TempFileInfo> {
    if (this.isShuttingDown) {
      throw new Error('File manager is shutting down, cannot create new temp files');
    }

    // Use target path's directory if no specific temp directory is configured
    const tempDir = this.options.tempDirectory || path.dirname(targetPath);
    const operationId = uuidv4();
    const tempFileName = `${this.options.tempPrefix}${operationId}${this.options.tempSuffix}`;
    const tempPath = path.join(tempDir, tempFileName);

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    const tempInfo: TempFileInfo = {
      path: tempPath,
      targetPath,
      createdAt: Date.now(),
      pid: process.pid,
      threadId: 0, // Node.js is single-threaded
      operationId,
      cleanupTimeout: options.cleanupTimeout || this.options.operationTimeout
    };

    // Track the temporary file
    this.activeTempFiles.set(operationId, tempInfo);
    
    // Update metrics
    this.updateMetrics('create', true, 0, 0);

    return tempInfo;
  }

  /**
   * Cleans up a specific temporary file
   * @param operationId - The operation ID of the temp file to clean up
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanupTempFile(operationId: string): Promise<void> {
    const tempInfo = this.activeTempFiles.get(operationId);
    if (!tempInfo) {
      return; // Already cleaned up or doesn't exist
    }

    try {
      // Remove the temporary file
      await fs.unlink(tempInfo.path).catch(error => {
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to remove temp file ${tempInfo.path}:`, error);
        }
      });

      // Remove from tracking
      this.activeTempFiles.delete(operationId);
      
      // Update metrics
      this.updateMetrics('delete', true, Date.now() - tempInfo.createdAt, 0);
      
    } catch (error) {
      console.error(`Error cleaning up temp file ${tempInfo.path}:`, error);
      this.updateMetrics('delete', false, Date.now() - tempInfo.createdAt, 0, 'CLEANUP_FAILED');
    }
  }

  /**
   * Promotes a temporary file to its final location atomically
   * @param operationId - The operation ID of the temp file
   * @param finalPath - The final destination path (optional, uses targetPath from tempInfo)
   * @returns Promise that resolves when promotion is complete
   */
  async promoteTempFile(operationId: string, finalPath?: string): Promise<void> {
    const tempInfo = this.activeTempFiles.get(operationId);
    if (!tempInfo) {
      throw new Error(`Temporary file with operation ID ${operationId} not found`);
    }

    const targetPath = finalPath || tempInfo.targetPath;
    
    try {
      // Ensure target directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      
      // Atomically move temp file to final location
      await fs.rename(tempInfo.path, targetPath);
      
      // Remove from tracking (successful promotion)
      this.activeTempFiles.delete(operationId);
      
      // Update metrics
      this.updateMetrics('write', true, Date.now() - tempInfo.createdAt, 0);
      
    } catch (error) {
      // Keep in tracking for cleanup, but mark as failed
      console.error(`Failed to promote temp file ${tempInfo.path} to ${targetPath}:`, error);
      this.updateMetrics('write', false, Date.now() - tempInfo.createdAt, 0, 'RENAME_FAILED');
      throw error;
    }
  }

  /**
   * Gets information about all active temporary files
   * @returns Array of temporary file information
   */
  getActiveTempFiles(): TempFileInfo[] {
    return Array.from(this.activeTempFiles.values());
  }

  /**
   * Cleans up abandoned temporary files based on timeout
   * @param maxAge - Maximum age in milliseconds (default: uses operationTimeout)
   * @returns Promise resolving to number of files cleaned up
   */
  async cleanupAbandonedFiles(maxAge?: number): Promise<number> {
    const now = Date.now();
    const timeout = maxAge || this.options.operationTimeout;
    const abandonedFiles: string[] = [];

    for (const [operationId, tempInfo] of this.activeTempFiles.entries()) {
      if (now - tempInfo.createdAt > timeout) {
        abandonedFiles.push(operationId);
      }
    }

    // Clean up abandoned files
    await Promise.allSettled(
      abandonedFiles.map(operationId => this.cleanupTempFile(operationId))
    );

    return abandonedFiles.length;
  }

  /**
   * Cleans up all temporary files and shuts down the manager
   * @returns Promise that resolves when all cleanup is complete
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop periodic cleanup
    for (const interval of this.cleanupIntervals) {
      clearInterval(interval);
    }
    this.cleanupIntervals.clear();

    // Clean up all active temp files
    const activeOperations = Array.from(this.activeTempFiles.keys());
    await Promise.allSettled(
      activeOperations.map(operationId => this.cleanupTempFile(operationId))
    );

    console.log(`AtomicFileManager shutdown complete. Cleaned up ${activeOperations.length} temp files.`);
  }

  /**
   * Gets current operation metrics
   * @returns Current metrics object
   */
  getMetrics(): AtomicOperationMetrics {
    return { ...this.metrics };
  }

  /**
   * Scans for and cleans up stale temporary files in the temp directory
   * that were created by previous processes or operations
   * @returns Promise resolving to number of stale files cleaned up
   */
  async cleanupStaleFiles(): Promise<number> {
    const tempDir = this.options.tempDirectory || '.';
    let cleanedCount = 0;

    try {
      const files = await fs.readdir(tempDir);
      const tempFiles = files.filter(file => 
        file.startsWith(this.options.tempPrefix) && 
        file.endsWith(this.options.tempSuffix)
      );

      for (const fileName of tempFiles) {
        const filePath = path.join(tempDir, fileName);
        
        try {
          const stats = await fs.stat(filePath);
          const fileAge = Date.now() - stats.mtime.getTime();
          
          // Clean up files older than timeout and not in our active tracking
          if (fileAge > this.options.operationTimeout) {
            // Extract operation ID from filename to check if it's in our tracking
            const operationId = fileName
              .replace(this.options.tempPrefix, '')
              .replace(this.options.tempSuffix, '');
            
            if (!this.activeTempFiles.has(operationId)) {
              await fs.unlink(filePath);
              cleanedCount++;
            }
          }
        } catch (error) {
          // Skip files that can't be accessed or are already deleted
          if (error.code !== 'ENOENT') {
            console.warn(`Failed to clean stale temp file ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan temp directory ${tempDir}:`, error);
    }

    return cleanedCount;
  }

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
        create: 0
      }
    };
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
    this.metrics.totalBytesProcessed += bytesProcessed;

    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
      if (errorCode) {
        this.metrics.errorStats[errorCode] = (this.metrics.errorStats[errorCode] || 0) + 1;
      }
    }

    // Update average duration
    const totalDuration = this.metrics.averageDuration * (this.metrics.totalOperations - 1) + duration;
    this.metrics.averageDuration = totalDuration / this.metrics.totalOperations;

    // Update operations per second (simple calculation based on average)
    if (this.metrics.averageDuration > 0) {
      this.metrics.operationsPerSecond = 1000 / this.metrics.averageDuration;
    }
  }

  private setupProcessExitHandlers(): void {
    const cleanupHandler = () => {
      // Synchronous cleanup for process exit
      const activeOperations = Array.from(this.activeTempFiles.keys());
      console.log(`Process exiting, cleaning up ${activeOperations.length} temp files...`);
      this.shutdown().catch(console.error);
    };

    process.on('exit', cleanupHandler);
    process.on('SIGINT', cleanupHandler);
    process.on('SIGTERM', cleanupHandler);
    process.on('uncaughtException', cleanupHandler);
  }

  private startPeriodicCleanup(): void {
    // Clean up abandoned files every 30 seconds
    const cleanupInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        try {
          const abandonedCount = await this.cleanupAbandonedFiles();
          const staleCount = await this.cleanupStaleFiles();
          
          if (abandonedCount > 0 || staleCount > 0) {
            console.log(`Periodic cleanup: ${abandonedCount} abandoned, ${staleCount} stale temp files removed`);
          }
        } catch (error) {
          console.warn('Periodic cleanup failed:', error);
        }
      }
    }, 30000);

    this.cleanupIntervals.add(cleanupInterval);
  }
} 