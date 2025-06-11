/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @fileoverview Atomic permission manager with comprehensive permission and ownership handling
 * @module atomicOps/AtomicPermissionManager  
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import {
  AtomicFileOptions,
  AtomicOperationResult,
  AtomicOperationMetrics
} from '../types/atomicOps';

/** Permission change information */
interface PermissionChange {
  filePath: string;
  oldPermissions: number;
  newPermissions: number;
  oldOwnership?: { uid: number; gid: number };
  newOwnership?: { uid: number; gid: number };
  timestamp: number;
}

/**
 * Manages file permissions and ownership with atomic guarantees
 * and comprehensive rollback capabilities
 */
export class AtomicPermissionManager {
  private readonly options: Required<AtomicFileOptions>;
  private readonly permissionHistory: PermissionChange[];
  private readonly metrics: AtomicOperationMetrics;

  constructor(options: AtomicFileOptions = {}) {
    this.options = {
      tempDirectory: '',
      tempPrefix: '.perm-',
      tempSuffix: '.bak',
      operationTimeout: 30000,
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
    
    this.permissionHistory = [];
    this.metrics = this.initializeMetrics();
  }

  /**
   * Atomically changes file permissions with rollback support
   * @param filePath - Path to the file
   * @param newPermissions - New permission mode
   * @param preserveOwnership - Whether to preserve ownership
   * @returns Promise resolving to operation result
   */
  async changePermissions(
    filePath: string, 
    newPermissions: number,
    preserveOwnership: boolean = this.options.preserveOwnership
  ): Promise<AtomicOperationResult> {
    const startTime = Date.now();
    const result: AtomicOperationResult = {
      success: false,
      operation: 'permission_change',
      filePath,
      rollbackOperation: null,
      bytesProcessed: 0,
      duration: 0,
      metadata: {
        startTime,
        endTime: 0,
        fsyncUsed: false,
        retryAttempts: 0,
        walUsed: false,
        backupCreated: false,
        checksumVerified: false
      }
    };

    try {
      // Get current file stats
      const stats = await fs.stat(filePath);
      const oldPermissions = stats.mode;
      
      // Store old ownership if preserving
      let oldOwnership: { uid: number; gid: number } | undefined;
      if (preserveOwnership) {
        oldOwnership = { uid: stats.uid, gid: stats.gid };
      }

      // Validate permissions
      this.validatePermissions(newPermissions);

      // Create permission change record
      const permissionChange: PermissionChange = {
        filePath,
        oldPermissions,
        newPermissions,
        oldOwnership,
        timestamp: Date.now()
      };

      // Apply permission change
      await fs.chmod(filePath, newPermissions);

      // Create rollback operation
      result.rollbackOperation = {
        type: 'permission_change',
        filePath,
        originalPermissions: oldPermissions,
        timestamp: Date.now()
      };

      // Store in history
      this.permissionHistory.push(permissionChange);

      // Success
      result.success = true;
      result.duration = Date.now() - startTime;
      result.metadata.endTime = Date.now();
      
      this.updateMetrics('write', true, result.duration, 0);
      
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Permission change failed';
      result.duration = Date.now() - startTime;
      result.metadata.endTime = Date.now();
      
      this.updateMetrics('write', false, result.duration, 0, 'PERMISSION_FAILED');
      
      return result;
    }
  }

  /**
   * Atomically changes file ownership (requires appropriate privileges)
   * @param filePath - Path to the file
   * @param uid - New user ID
   * @param gid - New group ID
   * @returns Promise resolving to operation result
   */
  async changeOwnership(filePath: string, uid: number, gid: number): Promise<AtomicOperationResult> {
    const startTime = Date.now();
    const result: AtomicOperationResult = {
      success: false,
      operation: 'ownership_change',
      filePath,
      rollbackOperation: null,
      bytesProcessed: 0,
      duration: 0,
      metadata: {
        startTime,
        endTime: 0,
        fsyncUsed: false,
        retryAttempts: 0,
        walUsed: false,
        backupCreated: false,
        checksumVerified: false
      }
    };

    try {
      // Get current file stats
      const stats = await fs.stat(filePath);
      const oldOwnership = { uid: stats.uid, gid: stats.gid };

      // Validate ownership values
      this.validateOwnership(uid, gid);

      // Apply ownership change
      await fs.chown(filePath, uid, gid);

      // Create rollback operation
      result.rollbackOperation = {
        type: 'permission_change',
        filePath,
        originalPermissions: stats.mode,
        timestamp: Date.now()
      };

      // Success
      result.success = true;
      result.duration = Date.now() - startTime;
      result.metadata.endTime = Date.now();
      
      this.updateMetrics('write', true, result.duration, 0);
      
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Ownership change failed';
      result.duration = Date.now() - startTime;
      result.metadata.endTime = Date.now();
      
      this.updateMetrics('write', false, result.duration, 0, 'OWNERSHIP_FAILED');
      
      return result;
    }
  }

  /**
   * Preserves permissions from source to target file
   * @param sourcePath - Source file path
   * @param targetPath - Target file path
   * @returns Promise resolving to operation result
   */
  async preservePermissions(sourcePath: string, targetPath: string): Promise<AtomicOperationResult> {
    try {
      const sourceStats = await fs.stat(sourcePath);
      
      const result = await this.changePermissions(targetPath, sourceStats.mode);
      
      // Also preserve ownership if enabled
      if (this.options.preserveOwnership) {
        const ownershipResult = await this.changeOwnership(targetPath, sourceStats.uid, sourceStats.gid);
        if (!ownershipResult.success) {
          // If ownership fails but permissions succeeded, still return partial success
          result.error = `Permissions preserved but ownership failed: ${ownershipResult.error}`;
        }
      }
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        operation: 'preserve_permissions',
        filePath: targetPath,
        rollbackOperation: null,
        bytesProcessed: 0,
        duration: 0,
        error: error instanceof Error ? error.message : 'Failed to preserve permissions',
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
    }
  }

  /**
   * Validates permission mode
   * @param permissions - Permission mode to validate
   */
  private validatePermissions(permissions: number): void {
    if (permissions < 0 || permissions > 0o777) {
      throw new Error(`Invalid permission mode: ${permissions.toString(8)}`);
    }
  }

  /**
   * Validates ownership values
   * @param uid - User ID
   * @param gid - Group ID
   */
  private validateOwnership(uid: number, gid: number): void {
    if (uid < 0 || !Number.isInteger(uid)) {
      throw new Error(`Invalid user ID: ${uid}`);
    }
    if (gid < 0 || !Number.isInteger(gid)) {
      throw new Error(`Invalid group ID: ${gid}`);
    }
  }

  /**
   * Gets permission change history
   * @param limit - Maximum number of entries to return
   * @returns Array of permission changes
   */
  getPermissionHistory(limit: number = 100): PermissionChange[] {
    return this.permissionHistory.slice(-limit);
  }

  /**
   * Gets current operation metrics
   * @returns Current metrics object
   */
  getMetrics(): AtomicOperationMetrics {
    return { ...this.metrics };
  }

  /**
   * Cleans up resources and history
   * @returns Promise that resolves when cleanup is complete
   */
  async shutdown(): Promise<void> {
    this.permissionHistory.length = 0;
    console.log('AtomicPermissionManager shutdown complete.');
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

    // Update operations per second
    if (this.metrics.averageDuration > 0) {
      this.metrics.operationsPerSecond = 1000 / this.metrics.averageDuration;
    }
  }
} 