/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @fileoverview Comprehensive atomic file operations system integration
 * @module atomicOps
 */

import { AtomicFileCreator } from "./AtomicFileCreator";
import { AtomicFileReader } from "./AtomicFileReader";
import { AtomicFileWriter } from "./AtomicFileWriter";
import { AtomicFileManager } from "./AtomicFileManager";
import { AtomicRollbackManager } from "./AtomicRollbackManager";
import { AtomicPermissionManager } from "./AtomicPermissionManager";

// Re-export all classes
export { AtomicFileCreator } from "./AtomicFileCreator";
export { AtomicFileReader } from "./AtomicFileReader";
export { AtomicFileWriter } from "./AtomicFileWriter";
export { AtomicFileManager } from "./AtomicFileManager";
export { AtomicRollbackManager } from "./AtomicRollbackManager";
export { AtomicPermissionManager } from "./AtomicPermissionManager";

export * from "../types/atomicOps";

/**
 * Comprehensive atomic file operations system
 * Integrates all atomic operation components with performance optimization
 * and comprehensive testing capabilities
 */
export class AtomicOperationsSystem {
  private readonly fileCreator: AtomicFileCreator;
  private readonly fileReader: AtomicFileReader;
  private readonly fileWriter: AtomicFileWriter;
  private readonly fileManager: AtomicFileManager;
  private readonly rollbackManager: AtomicRollbackManager;
  private readonly permissionManager: AtomicPermissionManager;

  constructor(options: import("../types/atomicOps").AtomicFileOptions = {}) {
    // Initialize all components with shared options
    this.fileCreator = new AtomicFileCreator(options);
    this.fileReader = new AtomicFileReader(options);
    this.fileWriter = new AtomicFileWriter(options);
    this.fileManager = new AtomicFileManager(options);
    this.rollbackManager = new AtomicRollbackManager(options);
    this.permissionManager = new AtomicPermissionManager(options);
  }

  /**
   * Gets the file creator component
   */
  get creator() {
    return this.fileCreator;
  }

  /**
   * Gets the file reader component
   */
  get reader() {
    return this.fileReader;
  }

  /**
   * Gets the file writer component
   */
  get writer() {
    return this.fileWriter;
  }

  /**
   * Gets the file manager component
   */
  get manager() {
    return this.fileManager;
  }

  /**
   * Gets the rollback manager component
   */
  get rollback() {
    return this.rollbackManager;
  }

  /**
   * Gets the permission manager component
   */
  get permissions() {
    return this.permissionManager;
  }

  /**
   * Performs a comprehensive atomic file operation with all safety features
   * @param operation - The operation to perform
   * @returns Promise resolving to operation result
   */
  async performAtomicOperation(operation: {
    type: "create" | "read" | "write" | "delete";
    filePath: string;
    content?: string | Buffer;
    permissions?: number;
    options?: any;
  }): Promise<import("../types/atomicOps").AtomicOperationResult> {
    const transactionId = this.rollbackManager.beginTransaction(
      `Atomic ${operation.type} operation on ${operation.filePath}`,
    );

    try {
      let result: import("../types/atomicOps").AtomicOperationResult;
      let rollbackOperation: any = null;

      switch (operation.type) {
        case "create":
          if (!operation.content) {
            throw new Error("Content required for create operation");
          }
          result = await this.fileCreator.createFile(
            operation.filePath,
            operation.content,
            operation.options,
          );
          break;

        case "read": {
          const readResult = await this.fileReader.readFile(
            operation.filePath,
            operation.options,
          );
          // Map content to fileContent for API consistency
          result = {
            ...readResult,
            fileContent: readResult.content,
          };
          break;
        }

        case "write":
          if (!operation.content) {
            throw new Error("Content required for write operation");
          }
          result = await this.fileWriter.writeFile(
            operation.filePath,
            operation.content,
            operation.options,
          );
          break;

        case "delete": {
          // Create backup before deletion
          const tempInfo = await this.fileManager.createTempFile(
            operation.filePath,
          );
          // Create rollback operation separately since it's not part of AtomicOperationResult
          rollbackOperation = {
            type: "file_delete" as const,
            filePath: operation.filePath,
            backupPath: tempInfo.path,
            timestamp: Date.now(),
          };
          
          result = {
            success: true,
            operation: "delete",
            filePath: operation.filePath,
            bytesProcessed: 0,
            duration: 0,
            metadata: {
              startTime: Date.now(),
              endTime: Date.now(),
              fsyncUsed: false,
              retryAttempts: 0,
              walUsed: false,
              backupCreated: true,
              checksumVerified: false,
              backupPath: tempInfo.path,
            },
          };
          break;
        }

        default:
          throw new Error(`Unsupported operation type: ${operation.type}`);
      }

      // Add rollback operation if successful (for delete operations)
      if (result.success && operation.type === "delete") {
        this.rollbackManager.addRollbackOperation(
          transactionId,
          rollbackOperation,
        );
      }

      // Handle permissions if specified
      if (operation.permissions && result.success) {
        await this.permissionManager.changePermissions(
          operation.filePath,
          operation.permissions,
        );
        // Note: Permission changes would need separate rollback tracking
      }

      // Commit transaction
      await this.rollbackManager.commitTransaction(transactionId);

      // Check if operation failed and throw error if needed
      if (!result.success && result.error) {
        throw new Error(result.error.message);
      }

      return result;
    } catch (error) {
      // Rollback on error
      await this.rollbackManager.rollbackTransaction(transactionId);
      throw error;
    }
  }

  /**
   * Gets comprehensive system metrics from all components
   */
  getSystemMetrics() {
    return {
      creator: this.fileCreator.getMetrics(),
      reader: this.fileReader.getMetrics(),
      writer: this.fileWriter.getMetrics(),
      manager: this.fileManager.getMetrics(),
      rollback: this.rollbackManager.getMetrics(),
      permissions: this.permissionManager.getMetrics(),
    };
  }

  /**
   * Performs comprehensive system health check
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    components: Record<string, boolean>;
    metrics: any;
  }> {
    const components = {
      creator: true,
      reader: true,
      writer: true,
      manager: true,
      rollback: true,
      permissions: true,
    };

    // Simple health checks for each component
    try {
      const metrics = this.getSystemMetrics();
      let healthyCount = 0;

      Object.keys(components).forEach((key) => {
        const componentMetrics = metrics[key as keyof typeof metrics];
        const errorRate =
          componentMetrics.failedOperations /
          (componentMetrics.totalOperations || 1);
        components[key as keyof typeof components] = errorRate < 0.1; // Less than 10% error rate
        if (components[key as keyof typeof components]) healthyCount++;
      });

      const status =
        healthyCount === 6
          ? "healthy"
          : healthyCount >= 4
            ? "degraded"
            : "unhealthy";

      return { status, components, metrics };
    } catch (error) {
      return {
        status: "unhealthy",
        components: Object.fromEntries(
          Object.keys(components).map((k) => [k, false]),
        ),
        metrics: null,
      };
    }
  }

  /**
   * Shuts down all components and cleans up resources
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = [];

    // Only call shutdown on components that have the method
    if (this.fileCreator && typeof this.fileCreator.shutdown === "function") {
      shutdownPromises.push(this.fileCreator.shutdown());
    }
    if (this.fileReader && typeof this.fileReader.shutdown === "function") {
      shutdownPromises.push(this.fileReader.shutdown());
    }
    if (this.fileWriter && typeof this.fileWriter.shutdown === "function") {
      shutdownPromises.push(this.fileWriter.shutdown());
    }
    if (this.fileManager && typeof this.fileManager.shutdown === "function") {
      shutdownPromises.push(this.fileManager.shutdown());
    }
    if (
      this.rollbackManager &&
      typeof this.rollbackManager.shutdown === "function"
    ) {
      shutdownPromises.push(this.rollbackManager.shutdown());
    }
    if (
      this.permissionManager &&
      typeof this.permissionManager.shutdown === "function"
    ) {
      shutdownPromises.push(this.permissionManager.shutdown());
    }

    await Promise.all(shutdownPromises);
    console.log("AtomicOperationsSystem shutdown complete.");
  }
}
