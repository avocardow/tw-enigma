/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @fileoverview Atomic rollback manager with comprehensive transaction and rollback capabilities
 * @module atomicOps/AtomicRollbackManager
 */

import * as fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

import {
  AtomicFileOptions,
  RollbackOperation,
  AtomicOperationMetrics,
  AtomicOperationResult,
} from "../types/atomicOps";

/** Transaction state for tracking operations */
interface Transaction {
  id: string;
  operations: RollbackOperation[];
  startTime: number;
  status: "active" | "committed" | "rolled_back" | "failed";
  metadata: {
    createdBy: string;
    description?: string;
    checkpoints: string[];
  };
}

/**
 * Manages rollback operations with comprehensive transaction support,
 * operation tracking, and automatic cleanup capabilities
 */
export class AtomicRollbackManager {
  private readonly options: Required<AtomicFileOptions>;
  private readonly activeTransactions: Map<string, Transaction>;
  private readonly committedTransactions: Map<string, Transaction>; // Track committed transactions briefly
  private readonly rollbackHistory: RollbackOperation[];
  private readonly metrics: AtomicOperationMetrics;
  private readonly maxHistorySize: number;

  constructor(options: AtomicFileOptions = {}) {
    this.options = {
      tempDirectory: "",
      tempPrefix: ".rollback-",
      tempSuffix: ".bak",
      operationTimeout: 30000,
      enableFsync: true,
      preservePermissions: true,
      preserveOwnership: false,
      bufferSize: 64 * 1024,
      maxRetryAttempts: 3,
      enableWAL: false,
      walDirectory: ".wal",
      maxRetries: 3,
      retryDelay: 100,
      ...options,
    };

    this.activeTransactions = new Map();
    this.committedTransactions = new Map(); // Initialize committed transactions map
    this.rollbackHistory = [];
    this.maxHistorySize = 1000; // Keep last 1000 rollback operations
    this.metrics = this.initializeMetrics();
  }

  /**
   * Begins a new transaction for grouping atomic operations
   * @param description - Optional description of the transaction
   * @returns Transaction ID for tracking operations
   */
  beginTransaction(description?: string): string {
    const transactionId = uuidv4();
    const transaction: Transaction = {
      id: transactionId,
      operations: [],
      startTime: Date.now(),
      status: "active",
      metadata: {
        createdBy: "AtomicRollbackManager",
        description,
        checkpoints: [],
      },
    };

    this.activeTransactions.set(transactionId, transaction);
    this.updateMetrics("create", true, 0, 0);

    return transactionId;
  }

  /**
   * Adds a rollback operation to a transaction
   * @param transactionId - Transaction to add the operation to
   * @param operation - Rollback operation to track
   */
  addRollbackOperation(
    transactionId: string,
    operation: RollbackOperation,
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    
    // If not in active transactions, check committed transactions for better error message
    if (!transaction) {
      const committedTransaction = this.committedTransactions.get(transactionId);
      if (committedTransaction) {
        throw new Error(`Cannot add operations to ${committedTransaction.status} transaction`);
      }
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== "active") {
      throw new Error(
        `Cannot add operations to ${transaction.status} transaction`,
      );
    }

    // Add unique operation ID if not present
    if (!operation.operationId) {
      operation.operationId = uuidv4();
    }

    // Add operation index for checkpoint tracking
    operation.operationIndex = transaction.operations.length;

    transaction.operations.push(operation);
  }

  /**
   * Creates a checkpoint in a transaction for partial rollbacks
   * @param transactionId - Transaction to checkpoint
   * @param checkpointName - Name of the checkpoint
   */
  createCheckpoint(transactionId: string, checkpointName: string): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Store checkpoint with current operation index
    const checkpointInfo = `${checkpointName}:${transaction.operations.length}`;
    transaction.metadata.checkpoints.push(checkpointInfo);
  }

  /**
   * Commits a transaction, making all operations permanent
   * @param transactionId - Transaction to commit
   * @returns Promise that resolves when transaction is committed
   */
  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== "active") {
      throw new Error(`Cannot commit ${transaction.status} transaction`);
    }

    try {
      // Mark as committed
      transaction.status = "committed";

      // Move operations to history
      this.rollbackHistory.push(...transaction.operations);

      // Cleanup history if needed
      this.cleanupHistory();

      // Move to committed transactions temporarily for better error messages
      this.committedTransactions.set(transactionId, transaction);
      
      // Remove from active transactions
      this.activeTransactions.delete(transactionId);
      
      // Clean up committed transaction after a short delay (for testing purposes)
      setTimeout(() => {
        this.committedTransactions.delete(transactionId);
      }, 1000);

      this.updateMetrics("write", true, Date.now() - transaction.startTime, 0);
    } catch (_error) {
      transaction.status = "failed";
      this.updateMetrics(
        "write",
        false,
        Date.now() - transaction.startTime,
        0,
        "COMMIT_FAILED",
      );
      throw error;
    }
  }

  /**
   * Rolls back a transaction, undoing all operations
   * @param transactionId - Transaction to roll back
   * @param toCheckpoint - Optional checkpoint to roll back to
   * @returns Promise resolving to rollback result
   */
  async rollbackTransaction(
    transactionId: string,
    toCheckpoint?: string,
  ): Promise<AtomicOperationResult> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const startTime = Date.now();
    const result: AtomicOperationResult = {
      success: false,
      operation: "delete", // Use valid operation type
      filePath: "",
      // rollbackOperation property doesn't exist in AtomicOperationResult
      bytesProcessed: 0,
      duration: 0,
      metadata: {
        startTime,
        endTime: 0,
        fsyncUsed: false,
        retryAttempts: 0,
        walUsed: false,
        backupCreated: false,
        checksumVerified: false,
      },
    };

    try {
      let operationsToRollback = [...transaction.operations];

      // If rolling back to checkpoint, filter operations
      if (toCheckpoint) {
        // Find checkpoint with operation index
        const checkpointInfo = transaction.metadata.checkpoints.find((cp) =>
          cp.startsWith(`${toCheckpoint}:`),
        );
        if (!checkpointInfo) {
          throw new Error(
            `Checkpoint ${toCheckpoint} not found in transaction`,
          );
        }

        const checkpointIndex = parseInt(checkpointInfo.split(":")[1]);
        // Only rollback operations after the checkpoint
        operationsToRollback = operationsToRollback.slice(checkpointIndex);
      }

      // Execute rollback operations in reverse order
      const errors: Error[] = [];
      let totalBytesProcessed = 0;

      for (let i = operationsToRollback.length - 1; i >= 0; i--) {
        const operation = operationsToRollback[i];

        try {
          await this.executeRollbackOperation(operation);
          totalBytesProcessed += operation.fileSize || 0;
        } catch (_error) {
          errors.push(error as Error);
          console.warn(
            `Failed to rollback operation ${operation.operationId}:`,
            error,
          );
        }
      }

      // Update transaction status
      transaction.status = errors.length === 0 ? "rolled_back" : "failed";

      // Update result
      result.success = errors.length === 0;
      result.bytesProcessed = totalBytesProcessed;
      result.duration = Date.now() - startTime;
      result.metadata.endTime = Date.now();

      if (errors.length > 0) {
        result.error = {
          code: "ROLLBACK_PARTIAL_FAILURE",
          message: `Rollback completed with ${errors.length} errors: ${errors.map((e) => e.message).join(", ")}`,
          stack: undefined,
        };
      }

      // Clean up transaction
      this.activeTransactions.delete(transactionId);

      this.updateMetrics(
        "delete",
        result.success,
        result.duration,
        totalBytesProcessed,
        result.success ? undefined : "ROLLBACK_FAILED",
      );

      return result;
    } catch (_error) {
      transaction.status = "failed";
      result.error = {
        code: "ROLLBACK_ERROR",
        message: error instanceof Error ? error.message : "Unknown rollback error",
        stack: error instanceof Error ? error.stack : undefined,
      };
      result.duration = Date.now() - startTime;
      result.metadata.endTime = Date.now();

      this.updateMetrics("delete", false, result.duration, 0, "ROLLBACK_ERROR");

      return result;
    }
  }

  /**
   * Executes a single rollback operation
   * @param operation - The rollback operation to execute
   */
  private async executeRollbackOperation(
    operation: RollbackOperation,
  ): Promise<void> {
    switch (operation.type) {
      case "file_create":
        // Delete the created file
        try {
          await fs.unlink(operation.filePath);
        } catch (_error) {
          if (!(error && typeof error === 'object' && 'code' in error && error.code === "ENOENT")) {
            throw error;
          }
        }
        break;

      case "file_overwrite":
        // Restore from backup
        if (operation.backupPath) {
          await fs.copyFile(operation.backupPath, operation.filePath);

          // Restore original permissions if preserved
          if (operation.originalPermissions) {
            await fs.chmod(operation.filePath, operation.originalPermissions);
          }

          // Clean up backup
          await fs.unlink(operation.backupPath).catch(() => {});
        } else {
          throw new Error(
            `No backup path available for file overwrite rollback: ${operation.filePath}`,
          );
        }
        break;

      case "file_delete":
        // Restore from backup
        if (operation.backupPath) {
          await fs.copyFile(operation.backupPath, operation.filePath);

          // Restore original permissions if preserved
          if (operation.originalPermissions) {
            await fs.chmod(operation.filePath, operation.originalPermissions);
          }
        } else {
          throw new Error(
            `No backup path available for file delete rollback: ${operation.filePath}`,
          );
        }
        break;

      case "directory_create":
        // Remove the created directory
        try {
          await fs.rmdir(operation.filePath);
        } catch (_error) {
          if (!(error && typeof error === 'object' && 'code' in error && error.code === "ENOENT")) {
            throw error;
          }
        }
        break;

      case "permission_change":
        // Restore original permissions
        if (operation.originalPermissions) {
          await fs.chmod(operation.filePath, operation.originalPermissions);
        }
        break;

      default:
        throw new Error(
          `Unknown rollback operation type: ${operation && typeof operation === 'object' && 'type' in operation ? operation.type : 'unknown'}`,
        );
    }
  }

  /**
   * Gets information about active transactions
   * @returns Array of active transaction information
   */
  getActiveTransactions(): Transaction[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Gets rollback history
   * @param limit - Maximum number of operations to return
   * @returns Array of historical rollback operations
   */
  getRollbackHistory(limit: number = 100): RollbackOperation[] {
    return this.rollbackHistory.slice(-limit);
  }

  /**
   * Cleans up old rollback history to prevent memory leaks
   */
  private cleanupHistory(): void {
    if (this.rollbackHistory.length > this.maxHistorySize) {
      const excessCount = this.rollbackHistory.length - this.maxHistorySize;
      this.rollbackHistory.splice(0, excessCount);
    }
  }

  /**
   * Gets current operation metrics
   * @returns Current metrics object
   */
  getMetrics(): AtomicOperationMetrics {
    return { ...this.metrics };
  }

  /**
   * Cleans up all active transactions and resources
   * @returns Promise that resolves when cleanup is complete
   */
  async shutdown(): Promise<void> {
    // Roll back all active transactions
    const activeTransactionIds = Array.from(this.activeTransactions.keys());

    for (const transactionId of activeTransactionIds) {
      try {
        await this.rollbackTransaction(transactionId);
      } catch (_error) {
        console.warn(
          `Failed to rollback transaction ${transactionId} during shutdown:`,
          error,
        );
      }
    }

    // Clear all data
    this.activeTransactions.clear();
    this.rollbackHistory.length = 0;

    console.log(
      `AtomicRollbackManager shutdown complete. Rolled back ${activeTransactionIds.length} active transactions.`,
    );
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
        create: 0,
      },
    };
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
    this.metrics.totalBytesProcessed += bytesProcessed;

    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
      if (errorCode) {
        this.metrics.errorStats[errorCode] =
          (this.metrics.errorStats[errorCode] || 0) + 1;
      }
    }

    // Update average duration
    const totalDuration =
      this.metrics.averageDuration * (this.metrics.totalOperations - 1) +
      duration;
    this.metrics.averageDuration = totalDuration / this.metrics.totalOperations;

    // Update operations per second
    if (this.metrics.averageDuration > 0) {
      this.metrics.operationsPerSecond = 1000 / this.metrics.averageDuration;
    }
  }
}
