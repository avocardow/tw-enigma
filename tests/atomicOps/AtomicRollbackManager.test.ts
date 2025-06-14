/**
 * @fileoverview Tests for AtomicRollbackManager transaction and rollback capabilities
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { AtomicRollbackManager } from "../../src/atomicOps/AtomicRollbackManager";
import { RollbackOperation } from "../../src/types/atomicOps";

describe("AtomicRollbackManager", () => {
  let manager: AtomicRollbackManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), "test-rollback");
    await fs.mkdir(testDir, { recursive: true });

    manager = new AtomicRollbackManager({
      tempDirectory: testDir,
      operationTimeout: 5000,
    });
  });

  afterEach(async () => {
    await manager.shutdown();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Transaction Management", () => {
    it("should create new transaction with unique ID", () => {
      const transactionId = manager.beginTransaction("Test transaction");

      expect(transactionId).toBeDefined();
      expect(typeof transactionId).toBe("string");
      expect(transactionId.length).toBeGreaterThan(0);
    });

    it("should track active transactions", () => {
      const transactionId = manager.beginTransaction("Test transaction");

      const activeTransactions = manager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(1);
      expect(activeTransactions[0].id).toBe(transactionId);
      expect(activeTransactions[0].status).toBe("active");
    });

    it("should create transaction with description", () => {
      const description = "Test transaction with description";
      manager.beginTransaction(description);

      const activeTransactions = manager.getActiveTransactions();
      expect(activeTransactions[0].metadata.description).toBe(description);
    });

    it("should commit transaction successfully", async () => {
      const transactionId = manager.beginTransaction("Test commit");

      // Add a test operation
      const operation: RollbackOperation = {
        type: "file_create",
        filePath: path.join(testDir, "test.txt"),
        timestamp: Date.now(),
      };
      manager.addRollbackOperation(transactionId, operation);

      await manager.commitTransaction(transactionId);

      // Transaction should no longer be active
      const activeTransactions = manager.getActiveTransactions();
      expect(activeTransactions).toHaveLength(0);

      // Operation should be in history
      const history = manager.getRollbackHistory();
      expect(history).toHaveLength(1);
      expect(history[0].filePath).toBe(operation.filePath);
    });

    it("should reject operations on non-existent transaction", () => {
      const operation: RollbackOperation = {
        type: "file_create",
        filePath: path.join(testDir, "test.txt"),
        timestamp: Date.now(),
      };

      expect(() => {
        manager.addRollbackOperation("non-existent-id", operation);
      }).toThrow("Transaction non-existent-id not found");
    });

    it("should reject operations on committed transaction", async () => {
      const transactionId = manager.beginTransaction("Test commit");
      await manager.commitTransaction(transactionId);

      const operation: RollbackOperation = {
        type: "file_create",
        filePath: path.join(testDir, "test.txt"),
        timestamp: Date.now(),
      };

      expect(() => {
        manager.addRollbackOperation(transactionId, operation);
      }).toThrow("Cannot add operations to committed transaction");
    });
  });

  describe("Rollback Operations", () => {
    it("should rollback file creation", async () => {
      const transactionId = manager.beginTransaction("File creation test");
      const testFile = path.join(testDir, "created-file.txt");

      // Create file and add rollback operation
      await fs.writeFile(testFile, "test content");

      const operation: RollbackOperation = {
        type: "file_create",
        filePath: testFile,
        timestamp: Date.now(),
      };
      manager.addRollbackOperation(transactionId, operation);

      // Verify file exists
      const fileExists = await fs.access(testFile).then(
        () => true,
        () => false,
      );
      expect(fileExists).toBe(true);

      // Rollback
      const result = await manager.rollbackTransaction(transactionId);

      expect(result.success).toBe(true);

      // Verify file is deleted
      const fileExistsAfter = await fs.access(testFile).then(
        () => true,
        () => false,
      );
      expect(fileExistsAfter).toBe(false);
    });

    it("should rollback file overwrite with backup", async () => {
      const transactionId = manager.beginTransaction("File overwrite test");
      const testFile = path.join(testDir, "overwritten-file.txt");
      const backupFile = path.join(testDir, "backup-file.txt");

      const originalContent = "original content";
      const newContent = "new content";

      // Create original file and backup
      await fs.writeFile(testFile, originalContent);
      await fs.writeFile(backupFile, originalContent);

      // Overwrite the file
      await fs.writeFile(testFile, newContent);

      const operation: RollbackOperation = {
        type: "file_overwrite",
        filePath: testFile,
        backupPath: backupFile,
        timestamp: Date.now(),
      };
      manager.addRollbackOperation(transactionId, operation);

      // Verify file has new content
      const currentContent = await fs.readFile(testFile, "utf8");
      expect(currentContent).toBe(newContent);

      // Rollback
      const result = await manager.rollbackTransaction(transactionId);

      expect(result.success).toBe(true);

      // Verify original content is restored
      const restoredContent = await fs.readFile(testFile, "utf8");
      expect(restoredContent).toBe(originalContent);
    });

    it("should rollback file deletion with backup", async () => {
      const transactionId = manager.beginTransaction("File deletion test");
      const testFile = path.join(testDir, "deleted-file.txt");
      const backupFile = path.join(testDir, "deleted-backup.txt");

      const originalContent = "original content";

      // Create backup
      await fs.writeFile(backupFile, originalContent);

      const operation: RollbackOperation = {
        type: "file_delete",
        filePath: testFile,
        backupPath: backupFile,
        timestamp: Date.now(),
      };
      manager.addRollbackOperation(transactionId, operation);

      // Rollback
      const result = await manager.rollbackTransaction(transactionId);

      expect(result.success).toBe(true);

      // Verify file is restored
      const restoredContent = await fs.readFile(testFile, "utf8");
      expect(restoredContent).toBe(originalContent);
    });

    it("should rollback directory creation", async () => {
      const transactionId = manager.beginTransaction("Directory creation test");
      const testDirPath = path.join(testDir, "created-dir");

      // Create directory
      await fs.mkdir(testDirPath);

      const operation: RollbackOperation = {
        type: "directory_create",
        filePath: testDirPath,
        timestamp: Date.now(),
      };
      manager.addRollbackOperation(transactionId, operation);

      // Verify directory exists
      const dirExists = await fs.access(testDirPath).then(
        () => true,
        () => false,
      );
      expect(dirExists).toBe(true);

      // Rollback
      const result = await manager.rollbackTransaction(transactionId);

      expect(result.success).toBe(true);

      // Verify directory is removed
      const dirExistsAfter = await fs.access(testDirPath).then(
        () => true,
        () => false,
      );
      expect(dirExistsAfter).toBe(false);
    });

    it("should handle rollback errors gracefully", async () => {
      const transactionId = manager.beginTransaction("Error handling test");

      const operation: RollbackOperation = {
        type: "file_overwrite",
        filePath: path.join(testDir, "non-existent.txt"),
        // No backup path - will cause error
        timestamp: Date.now(),
      };
      manager.addRollbackOperation(transactionId, operation);

      const result = await manager.rollbackTransaction(transactionId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("No backup path available");
    });

    it("should rollback multiple operations in reverse order", async () => {
      const transactionId = manager.beginTransaction(
        "Multiple operations test",
      );

      const file1 = path.join(testDir, "file1.txt");
      const file2 = path.join(testDir, "file2.txt");

      // Create files in order
      await fs.writeFile(file1, "content1");
      await fs.writeFile(file2, "content2");

      // Add rollback operations in order
      manager.addRollbackOperation(transactionId, {
        type: "file_create",
        filePath: file1,
        timestamp: Date.now(),
      });

      manager.addRollbackOperation(transactionId, {
        type: "file_create",
        filePath: file2,
        timestamp: Date.now() + 1,
      });

      // Rollback
      const result = await manager.rollbackTransaction(transactionId);

      expect(result.success).toBe(true);

      // Verify both files are deleted
      const file1Exists = await fs.access(file1).then(
        () => true,
        () => false,
      );
      const file2Exists = await fs.access(file2).then(
        () => true,
        () => false,
      );
      expect(file1Exists).toBe(false);
      expect(file2Exists).toBe(false);
    });
  });

  describe("Checkpoint Management", () => {
    it("should create checkpoint in transaction", () => {
      const transactionId = manager.beginTransaction("Checkpoint test");

      manager.createCheckpoint(transactionId, "checkpoint1");

      const activeTransactions = manager.getActiveTransactions();
      expect(activeTransactions[0].metadata.checkpoints).toContain(
        "checkpoint1:0",
      );
    });

    it("should rollback to checkpoint", async () => {
      const transactionId = manager.beginTransaction(
        "Checkpoint rollback test",
      );

      const file1 = path.join(testDir, "before-checkpoint.txt");
      const file2 = path.join(testDir, "after-checkpoint.txt");

      // Create first file and add operation
      await fs.writeFile(file1, "content1");
      manager.addRollbackOperation(transactionId, {
        type: "file_create",
        filePath: file1,
        timestamp: Date.now(),
      });

      // Create checkpoint
      manager.createCheckpoint(transactionId, "mid-transaction");

      // Create second file and add operation
      await fs.writeFile(file2, "content2");
      manager.addRollbackOperation(transactionId, {
        type: "file_create",
        filePath: file2,
        timestamp: Date.now() + 1,
      });

      // Rollback to checkpoint (should only rollback file2)
      const result = await manager.rollbackTransaction(
        transactionId,
        "mid-transaction",
      );

      expect(result.success).toBe(true);

      // Verify file1 still exists (before checkpoint)
      const file1Exists = await fs.access(file1).then(
        () => true,
        () => false,
      );
      expect(file1Exists).toBe(true);

      // Verify file2 is deleted (after checkpoint)
      const file2Exists = await fs.access(file2).then(
        () => true,
        () => false,
      );
      expect(file2Exists).toBe(false);
    });

    it("should reject rollback to non-existent checkpoint", async () => {
      const transactionId = manager.beginTransaction("Invalid checkpoint test");

      const result = await manager.rollbackTransaction(
        transactionId,
        "non-existent-checkpoint",
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        "Checkpoint non-existent-checkpoint not found",
      );
    });
  });

  describe("Metrics and History", () => {
    it("should track operation metrics", async () => {
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.totalOperations).toBe(0);

      const transactionId = manager.beginTransaction("Metrics test");
      await manager.commitTransaction(transactionId);

      const finalMetrics = manager.getMetrics();
      expect(finalMetrics.totalOperations).toBeGreaterThan(0);
      expect(finalMetrics.successfulOperations).toBeGreaterThan(0);
    });

    it("should maintain rollback history", async () => {
      const transactionId = manager.beginTransaction("History test");

      const operation: RollbackOperation = {
        type: "file_create",
        filePath: path.join(testDir, "history-test.txt"),
        timestamp: Date.now(),
      };
      manager.addRollbackOperation(transactionId, operation);

      await manager.commitTransaction(transactionId);

      const history = manager.getRollbackHistory();
      expect(history).toHaveLength(1);
      expect(history[0].filePath).toBe(operation.filePath);
    });

    it("should limit history size", async () => {
      // Create many transactions to test history cleanup
      const operations = [];
      for (let i = 0; i < 5; i++) {
        const transactionId = manager.beginTransaction(`History test ${i}`);
        const operation: RollbackOperation = {
          type: "file_create",
          filePath: path.join(testDir, `test-${i}.txt`),
          timestamp: Date.now() + i,
        };
        manager.addRollbackOperation(transactionId, operation);
        operations.push(operation);
        await manager.commitTransaction(transactionId);
      }

      const history = manager.getRollbackHistory();
      expect(history.length).toBeLessThanOrEqual(1000); // Max history size
    });
  });

  describe("Shutdown and Cleanup", () => {
    it("should rollback active transactions on shutdown", async () => {
      const transactionId = manager.beginTransaction("Shutdown test");
      const testFile = path.join(testDir, "shutdown-test.txt");

      await fs.writeFile(testFile, "content");
      manager.addRollbackOperation(transactionId, {
        type: "file_create",
        filePath: testFile,
        timestamp: Date.now(),
      });

      // Verify file exists
      const fileExists = await fs.access(testFile).then(
        () => true,
        () => false,
      );
      expect(fileExists).toBe(true);

      // Shutdown should rollback active transactions
      await manager.shutdown();

      // Verify file is cleaned up
      const fileExistsAfter = await fs.access(testFile).then(
        () => true,
        () => false,
      );
      expect(fileExistsAfter).toBe(false);
    });

    it("should clear all data on shutdown", async () => {
      const transactionId = manager.beginTransaction("Cleanup test");
      await manager.commitTransaction(transactionId);

      // Add some history
      expect(manager.getRollbackHistory()).toHaveLength(0);

      await manager.shutdown();

      // Verify everything is cleared
      expect(manager.getActiveTransactions()).toHaveLength(0);
      expect(manager.getRollbackHistory()).toHaveLength(0);
    });
  });
});
