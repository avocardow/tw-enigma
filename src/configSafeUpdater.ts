/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile, readFile, copyFile, unlink } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { resolve, dirname, basename, join } from "path";
import { randomUUID } from "crypto";
import { logger } from "./logger.ts";
import { ConfigError } from "./errors.ts";
import { validateConfig } from "./configValidator.ts";
import type { EnigmaConfig } from "./config.ts";
import type { ValidationResult } from "./configValidator.ts";

/**
 * Safe update operation result
 */
export interface SafeUpdateResult {
  success: boolean;
  filepath: string;
  backupPath?: string;
  transactionId: string;
  timestamp: Date;
  validation?: ValidationResult;
  error?: ConfigError;
  rollbackAvailable: boolean;
  changes: {
    added: string[];
    modified: string[];
    removed: string[];
  };
}

/**
 * Update transaction for atomic operations
 */
export interface UpdateTransaction {
  id: string;
  timestamp: Date;
  filepath: string;
  originalContent: string;
  newContent: string;
  backupPath: string;
  tempPath: string;
  status: "pending" | "committed" | "rolled-back" | "failed";
  validation?: ValidationResult;
}

/**
 * Safe update options
 */
export interface SafeUpdateOptions {
  validateBeforeWrite: boolean;
  createBackup: boolean;
  backupDirectory?: string;
  maxBackups: number;
  atomicWrite: boolean;
  verifyAfterWrite: boolean;
  rollbackOnFailure: boolean;
  permissions?: number;
  encoding: BufferEncoding;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Configuration merge strategy
 */
export type MergeStrategy = "replace" | "merge-deep" | "merge-shallow" | "merge-arrays" | "custom";

/**
 * Custom merge function
 */
export type CustomMergeFunction = (existing: unknown, incoming: unknown, path: string[]) => unknown;

/**
 * Safe configuration updater with atomic operations
 */
export class ConfigSafeUpdater {
  private options: SafeUpdateOptions;
  private activeTransactions: Map<string, UpdateTransaction> = new Map();
  private backupHistory: Array<{ timestamp: Date; filepath: string; backupPath: string }> = [];

  constructor(options?: Partial<SafeUpdateOptions>) {
    this.options = {
      validateBeforeWrite: true,
      createBackup: true,
      maxBackups: 10,
      atomicWrite: true,
      verifyAfterWrite: true,
      rollbackOnFailure: true,
      permissions: 0o644,
      encoding: "utf-8",
      retryAttempts: 3,
      retryDelay: 100,
      ...options,
    };

    logger.debug("ConfigSafeUpdater initialized", { options: this.options });
  }

  /**
   * Safely update configuration file with atomic operations
   */
  public async updateConfig(
    filepath: string,
    updates: Partial<EnigmaConfig> | ((current: EnigmaConfig) => EnigmaConfig),
    mergeStrategy: MergeStrategy = "merge-deep",
    customMerge?: CustomMergeFunction
  ): Promise<SafeUpdateResult> {
    const transactionId = randomUUID();
    const timestamp = new Date();

    logger.info("Starting safe configuration update", {
      filepath,
      transactionId,
      mergeStrategy,
    });

    try {
      // Step 1: Create transaction
      const transaction = await this.createTransaction(filepath, transactionId);

      // Step 2: Load current configuration
      const currentConfig = await this.loadCurrentConfig(filepath);

      // Step 3: Apply updates
      const newConfig = await this.applyUpdates(currentConfig, updates, mergeStrategy, customMerge);

      // Step 4: Validate new configuration
      if (this.options.validateBeforeWrite) {
        const validation = await validateConfig(newConfig, filepath);
        transaction.validation = validation;

        if (!validation.isValid) {
          await this.rollbackTransaction(transaction);
          return {
            success: false,
            filepath,
            transactionId,
            timestamp,
            validation,
            error: new ConfigError(
              `Configuration validation failed: ${validation.errors.map(e => e.message).join(", ")}`,
              filepath,
              undefined,
              { operation: "updateConfig", transactionId }
            ),
            rollbackAvailable: false,
            changes: { added: [], modified: [], removed: [] },
          };
        }
      }

      // Step 5: Write new configuration atomically
      transaction.newContent = JSON.stringify(newConfig, null, 2);
      const result = await this.commitTransaction(transaction);

      // Step 6: Verify write if enabled
      if (this.options.verifyAfterWrite) {
        await this.verifyWrite(filepath, newConfig);
      }

      // Step 7: Clean up old backups
      await this.cleanupOldBackups();

      logger.info("Safe configuration update completed successfully", {
        filepath,
        transactionId,
        backupPath: result.backupPath,
      });

      return result;
    } catch (_error) {
      logger.error("Safe configuration update failed", {
        filepath,
        transactionId,
        error,
      });

      // Attempt rollback if transaction exists
      const transaction = this.activeTransactions.get(transactionId);
      if (transaction && this.options.rollbackOnFailure) {
        try {
          await this.rollbackTransaction(transaction);
        } catch (rollbackError) {
          logger.error("Rollback failed", { transactionId, rollbackError });
        }
      }

      return {
        success: false,
        filepath,
        transactionId,
        timestamp,
        error: new ConfigError(
          `Safe configuration update failed: ${error instanceof Error ? error.message : String(error)}`,
          filepath,
          error as Error,
          { operation: "updateConfig", transactionId }
        ),
        rollbackAvailable: transaction ? true : false,
        changes: { added: [], modified: [], removed: [] },
      };
    }
  }

  /**
   * Batch update multiple configuration files
   */
  public async batchUpdate(
    updates: Array<{
      filepath: string;
      updates: Partial<EnigmaConfig> | ((current: EnigmaConfig) => EnigmaConfig);
      mergeStrategy?: MergeStrategy;
      customMerge?: CustomMergeFunction;
    }>
  ): Promise<SafeUpdateResult[]> {
    logger.info("Starting batch configuration update", { count: updates.length });

    const results: SafeUpdateResult[] = [];
    const transactions: UpdateTransaction[] = [];

    try {
      // Create all transactions first
      for (const update of updates) {
        const transactionId = randomUUID();
        const transaction = await this.createTransaction(update.filepath, transactionId);
        transactions.push(transaction);
      }

      // Process all updates
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        const transaction = transactions[i];

        try {
          const result = await this.updateConfig(
            update.filepath,
            update.updates,
            update.mergeStrategy,
            update.customMerge
          );
          results.push(result);

          if (!result.success) {
            // If any update fails, rollback all successful ones
            logger.warn("Batch update failed, rolling back successful updates", {
              failedFile: update.filepath,
              successfulCount: i,
            });

            for (let j = 0; j < i; j++) {
              if (results[j].success) {
                await this.rollbackByTransactionId(results[j].transactionId);
              }
            }
            break;
          }
        } catch (_error) {
          logger.error("Batch update item failed", { filepath: update.filepath, error });
          
          results.push({
            success: false,
            filepath: update.filepath,
            transactionId: transaction.id,
            timestamp: new Date(),
            error: new ConfigError(
              `Batch update failed for ${update.filepath}: ${error instanceof Error ? error.message : String(error)}`,
              update.filepath,
              error as Error,
              { operation: "batchUpdate" }
            ),
            rollbackAvailable: true,
            changes: { added: [], modified: [], removed: [] },
          });
          break;
        }
      }

      return results;
    } catch (_error) {
      logger.error("Batch configuration update failed", { error });

      // Rollback all transactions
      for (const transaction of transactions) {
        try {
          await this.rollbackTransaction(transaction);
        } catch (rollbackError) {
          logger.error("Batch rollback failed", { transactionId: transaction.id, rollbackError });
        }
      }

      throw new ConfigError(
        `Batch configuration update failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error as Error,
        { operation: "batchUpdate" }
      );
    }
  }

  /**
   * Rollback a configuration update by transaction ID
   */
  public async rollbackByTransactionId(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      logger.warn("Transaction not found for rollback", { transactionId });
      return false;
    }

    return this.rollbackTransaction(transaction);
  }

  /**
   * Get list of available backups for a file
   */
  public getBackupHistory(filepath?: string): Array<{ timestamp: Date; filepath: string; backupPath: string }> {
    if (filepath) {
      return this.backupHistory.filter(backup => backup.filepath === resolve(filepath));
    }
    return [...this.backupHistory];
  }

  /**
   * Restore configuration from a backup
   */
  public async restoreFromBackup(backupPath: string, targetPath?: string): Promise<SafeUpdateResult> {
    const transactionId = randomUUID();
    const timestamp = new Date();

    logger.info("Restoring configuration from backup", { backupPath, targetPath });

    try {
      if (!existsSync(backupPath)) {
        throw new ConfigError(`Backup file not found: ${backupPath}`, backupPath);
      }

      // Determine target path
      const filepath = targetPath || this.getOriginalPathFromBackup(backupPath);
      if (!filepath) {
        throw new ConfigError("Cannot determine target path for restore", backupPath);
      }

      // Load and validate backup content
      const backupContent = await readFile(backupPath, this.options.encoding);
      const backupConfig = JSON.parse(backupContent);

      if (this.options.validateBeforeWrite) {
        const validation = await validateConfig(backupConfig, filepath);
        if (!validation.isValid) {
          throw new ConfigError(
            `Backup validation failed: ${validation.errors.map(e => e.message).join(", ")}`,
            backupPath
          );
        }
      }

      // Create transaction for restore
      const transaction = await this.createTransaction(filepath, transactionId);
      transaction.newContent = backupContent;

      // Commit the restore
      const result = await this.commitTransaction(transaction);

      logger.info("Configuration restored from backup successfully", {
        backupPath,
        filepath,
        transactionId,
      });

      return result;
    } catch (_error) {
      logger.error("Configuration restore failed", { backupPath, error });

      return {
        success: false,
        filepath: targetPath || backupPath,
        transactionId,
        timestamp,
        error: new ConfigError(
          `Configuration restore failed: ${error instanceof Error ? error.message : String(error)}`,
          backupPath,
          error as Error,
          { operation: "restoreFromBackup" }
        ),
        rollbackAvailable: false,
        changes: { added: [], modified: [], removed: [] },
      };
    }
  }

  /**
   * Create a new transaction
   */
  private async createTransaction(filepath: string, transactionId: string): Promise<UpdateTransaction> {
    const resolvedPath = resolve(filepath);
    const timestamp = new Date();

    // Create backup directory if needed
    const backupDir = this.options.backupDirectory || join(dirname(resolvedPath), ".enigma-backups");
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Generate paths
    const backupPath = join(backupDir, `${basename(resolvedPath)}.${timestamp.getTime()}.backup`);
    const tempPath = join(dirname(resolvedPath), `.${basename(resolvedPath)}.${transactionId}.tmp`);

    // Read original content
    let originalContent = "";
    if (existsSync(resolvedPath)) {
      originalContent = await readFile(resolvedPath, this.options.encoding);
    }

    const transaction: UpdateTransaction = {
      id: transactionId,
      timestamp,
      filepath: resolvedPath,
      originalContent,
      newContent: "",
      backupPath,
      tempPath,
      status: "pending",
    };

    this.activeTransactions.set(transactionId, transaction);
    logger.debug("Transaction created", { transactionId, filepath: resolvedPath });

    return transaction;
  }

  /**
   * Load current configuration
   */
  private async loadCurrentConfig(filepath: string): Promise<EnigmaConfig> {
    if (!existsSync(filepath)) {
      // Return default configuration if file doesn't exist
      return {} as EnigmaConfig;
    }

    try {
      const content = await readFile(filepath, this.options.encoding);
      return JSON.parse(content);
    } catch (_error) {
      throw new ConfigError(
        `Failed to load current configuration: ${error instanceof Error ? error.message : String(error)}`,
        filepath,
        error as Error,
        { operation: "loadCurrentConfig" }
      );
    }
  }

  /**
   * Apply updates to configuration
   */
  private async applyUpdates(
    currentConfig: EnigmaConfig,
    updates: Partial<EnigmaConfig> | ((current: EnigmaConfig) => EnigmaConfig),
    mergeStrategy: MergeStrategy,
    customMerge?: CustomMergeFunction
  ): Promise<EnigmaConfig> {
    if (typeof updates === "function") {
      return updates(currentConfig);
    }

    switch (mergeStrategy) {
      case "replace":
        return { ...updates } as EnigmaConfig;
      
      case "merge-shallow":
        return { ...currentConfig, ...updates };
      
      case "merge-deep":
        return this.deepMerge(currentConfig, updates);
      
      case "merge-arrays":
        return this.mergeWithArrays(currentConfig, updates);
      
      case "custom":
        if (!customMerge) {
          throw new ConfigError("Custom merge function required for custom merge strategy");
        }
        return customMerge(currentConfig, updates, []) as EnigmaConfig;
      
      default:
        return this.deepMerge(currentConfig, updates);
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Merge with special array handling
   */
  private mergeWithArrays(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (Array.isArray(source[key])) {
        result[key] = [...(target[key] || []), ...source[key]];
      } else if (source[key] !== null && typeof source[key] === "object") {
        result[key] = this.mergeWithArrays(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Commit transaction with atomic write
   */
  private async commitTransaction(transaction: UpdateTransaction): Promise<SafeUpdateResult> {
    try {
      // Create backup if enabled
      if (this.options.createBackup && transaction.originalContent) {
        await writeFile(transaction.backupPath, transaction.originalContent, this.options.encoding);
        this.backupHistory.push({
          timestamp: transaction.timestamp,
          filepath: transaction.filepath,
          backupPath: transaction.backupPath,
        });
      }

      // Atomic write using temporary file
      if (this.options.atomicWrite) {
        await writeFile(transaction.tempPath, transaction.newContent, {
          encoding: this.options.encoding,
          mode: this.options.permissions,
        });

        // Atomic move (rename)
        await copyFile(transaction.tempPath, transaction.filepath);
        await unlink(transaction.tempPath);
      } else {
        // Direct write
        await writeFile(transaction.filepath, transaction.newContent, {
          encoding: this.options.encoding,
          mode: this.options.permissions,
        });
      }

      transaction.status = "committed";
      this.activeTransactions.delete(transaction.id);

      return {
        success: true,
        filepath: transaction.filepath,
        backupPath: transaction.backupPath,
        transactionId: transaction.id,
        timestamp: transaction.timestamp,
        validation: transaction.validation,
        rollbackAvailable: this.options.createBackup,
        changes: this.calculateChanges(transaction.originalContent, transaction.newContent),
      };
    } catch (_error) {
      transaction.status = "failed";
      throw error;
    }
  }

  /**
   * Rollback transaction
   */
  private async rollbackTransaction(transaction: UpdateTransaction): Promise<boolean> {
    try {
      logger.info("Rolling back transaction", { transactionId: transaction.id });

      if (transaction.originalContent) {
        await writeFile(transaction.filepath, transaction.originalContent, this.options.encoding);
      } else {
        // If no original content, remove the file
        if (existsSync(transaction.filepath)) {
          await unlink(transaction.filepath);
        }
      }

      // Clean up temporary file if it exists
      if (existsSync(transaction.tempPath)) {
        await unlink(transaction.tempPath);
      }

      transaction.status = "rolled-back";
      this.activeTransactions.delete(transaction.id);

      logger.info("Transaction rolled back successfully", { transactionId: transaction.id });
      return true;
    } catch (_error) {
      logger.error("Transaction rollback failed", { transactionId: transaction.id, error });
      return false;
    }
  }

  /**
   * Verify write operation
   */
  private async verifyWrite(filepath: string, expectedConfig: EnigmaConfig): Promise<void> {
    try {
      const writtenContent = await readFile(filepath, this.options.encoding);
      const writtenConfig = JSON.parse(writtenContent);

      // Simple verification - could be enhanced with deep comparison
      if (JSON.stringify(writtenConfig) !== JSON.stringify(expectedConfig)) {
        throw new ConfigError("Write verification failed - content mismatch", filepath);
      }
    } catch (_error) {
      throw new ConfigError(
        `Write verification failed: ${error instanceof Error ? error.message : String(error)}`,
        filepath,
        error as Error,
        { operation: "verifyWrite" }
      );
    }
  }

  /**
   * Clean up old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    if (this.backupHistory.length <= this.options.maxBackups) {
      return;
    }

    const toRemove = this.backupHistory
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(0, this.backupHistory.length - this.options.maxBackups);

    for (const backup of toRemove) {
      try {
        if (existsSync(backup.backupPath)) {
          await unlink(backup.backupPath);
        }
        this.backupHistory = this.backupHistory.filter(b => b !== backup);
      } catch (_error) {
        logger.warn("Failed to clean up old backup", { backupPath: backup.backupPath, error });
      }
    }
  }

  /**
   * Calculate changes between configurations
   */
  private calculateChanges(oldContent: string, newContent: string): { added: string[]; modified: string[]; removed: string[] } {
    try {
      const oldConfig = oldContent ? JSON.parse(oldContent) : {};
      const newConfig = JSON.parse(newContent);

      const added: string[] = [];
      const modified: string[] = [];
      const removed: string[] = [];

      // Find added and modified
      for (const key in newConfig) {
        if (!(key in oldConfig)) {
          added.push(key);
        } else if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
          modified.push(key);
        }
      }

      // Find removed
      for (const key in oldConfig) {
        if (!(key in newConfig)) {
          removed.push(key);
        }
      }

      return { added, modified, removed };
    } catch (_error) {
      logger.warn("Failed to calculate configuration changes", { error });
      return { added: [], modified: [], removed: [] };
    }
  }

  /**
   * Get original path from backup filename
   */
  private getOriginalPathFromBackup(backupPath: string): string | null {
    // This is a simplified implementation
    // In practice, you might store metadata about backups
    const filename = basename(backupPath);
    const match = filename.match(/^(.+)\.\d+\.backup$/);
    return match ? join(dirname(backupPath), "..", match[1]) : null;
  }
}

/**
 * Factory function for creating safe updater
 */
export function createConfigSafeUpdater(options?: Partial<SafeUpdateOptions>): ConfigSafeUpdater {
  return new ConfigSafeUpdater(options);
} 