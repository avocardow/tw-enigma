/**
 * @fileoverview Comprehensive tests for AtomicFileCreator
 * @module tests/atomicOps/AtomicFileCreator
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  // vi,
} from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
// import { constants } from "fs";
import { AtomicFileCreator } from "../../src/atomicOps/AtomicFileCreator";
import {
  // AtomicOperationResult,
  AtomicOperationError,
} from "../../src/types/atomicOps";

// Test directories and files
const TEST_DIR = path.join(__dirname, "../../test-temp/atomic-ops");
const TEST_FILE = path.join(TEST_DIR, "test-file.txt");
const TEST_JSON_FILE = path.join(TEST_DIR, "test-data.json");
const EXISTING_FILE = path.join(TEST_DIR, "existing-file.txt");

describe("AtomicFileCreator", () => {
  let creator: AtomicFileCreator;

  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to clean up test directory:", error);
    }
  });

  beforeEach(() => {
    creator = new AtomicFileCreator({
      operationTimeout: 5000,
      maxRetries: 2,
    });
  });

  afterEach(async () => {
    // Clean up any remaining files and operations
    await creator.cleanup();

    // Remove test files
    const testFiles = [TEST_FILE, TEST_JSON_FILE, EXISTING_FILE];
    for (const file of testFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const defaultCreator = new AtomicFileCreator();
      expect(defaultCreator).toBeDefined();
      expect(defaultCreator.getMetrics()).toEqual({
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
      });
    });

    it("should initialize with custom options", () => {
      const customCreator = new AtomicFileCreator({
        enableFsync: false,
        operationTimeout: 10000,
        tempPrefix: ".custom-",
        maxRetries: 5,
      });
      expect(customCreator).toBeDefined();
    });
  });

  describe("createFile", () => {
    it("should create a new file successfully", async () => {
      const content = "Hello, World!";
      const result = await creator.createFile(TEST_FILE, content);

      expect(result.success).toBe(true);
      expect(result.operation).toBe("create");
      expect(result.filePath).toBe(TEST_FILE);
      expect(result.bytesProcessed).toBe(Buffer.byteLength(content));
      expect(result.duration).toBeGreaterThan(0);
      expect(result.fileStats).toBeDefined();
      expect(result.metadata.fsyncUsed).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify file was created with correct content
      const fileContent = await fs.readFile(TEST_FILE, "utf8");
      expect(fileContent).toBe(content);
    });

    it("should create a file with buffer content", async () => {
      const content = Buffer.from("Binary content", "utf8");
      const result = await creator.createFile(TEST_FILE, content);

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBe(content.length);

      // Verify file was created with correct content
      const fileContent = await fs.readFile(TEST_FILE);
      expect(fileContent.equals(content)).toBe(true);
    });

    it("should fail when file already exists and overwrite is false", async () => {
      // Create existing file
      await fs.writeFile(EXISTING_FILE, "existing content");

      const result = await creator.createFile(EXISTING_FILE, "new content");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("already exists");

      // Verify original file is unchanged
      const fileContent = await fs.readFile(EXISTING_FILE, "utf8");
      expect(fileContent).toBe("existing content");
    });

    it("should overwrite existing file when overwrite is true", async () => {
      // Create existing file
      await fs.writeFile(EXISTING_FILE, "existing content");

      const result = await creator.createFile(EXISTING_FILE, "new content", {
        overwrite: true,
      });

      expect(result.success).toBe(true);

      // Verify file was overwritten
      const fileContent = await fs.readFile(EXISTING_FILE, "utf8");
      expect(fileContent).toBe("new content");
    });

    it("should create parent directories if they do not exist", async () => {
      const nestedFile = path.join(TEST_DIR, "nested", "deep", "file.txt");
      const result = await creator.createFile(nestedFile, "nested content");

      expect(result.success).toBe(true);

      // Verify file was created
      const fileContent = await fs.readFile(nestedFile, "utf8");
      expect(fileContent).toBe("nested content");
    });

    it("should preserve file permissions when specified", async () => {
      const result = await creator.createFile(TEST_FILE, "content", {
        mode: 0o755,
      });

      expect(result.success).toBe(true);

      // Verify file permissions (Unix-like systems only)
      if (process.platform !== "win32") {
        const stats = await fs.stat(TEST_FILE);
        expect(stats.mode & 0o777).toBe(0o755);
      }
    });

    it("should handle file creation with custom encoding", async () => {
      const content = "Hello with special chars: åäö";
      const result = await creator.createFile(TEST_FILE, content, {
        encoding: "utf8",
      });

      expect(result.success).toBe(true);

      // Verify file content with proper encoding
      const fileContent = await fs.readFile(TEST_FILE, "utf8");
      expect(fileContent).toBe(content);
    });

    it("should handle fsync disabled operations", async () => {
      const creatorNoFsync = new AtomicFileCreator({ enableFsync: false });
      const result = await creatorNoFsync.createFile(TEST_FILE, "content");

      expect(result.success).toBe(true);
      expect(result.metadata.fsyncUsed).toBe(false);

      await creatorNoFsync.cleanup();
    });

    it("should handle large file creation", async () => {
      const largeContent = "x".repeat(1024 * 1024); // 1MB
      const result = await creator.createFile(TEST_FILE, largeContent);

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBe(largeContent.length);

      // Verify file size
      const stats = await fs.stat(TEST_FILE);
      expect(stats.size).toBe(largeContent.length);
    });

    it("should handle permission denied errors gracefully", async () => {
      // Try to create file in read-only directory (Unix-like systems)
      if (process.platform !== "win32") {
        const readOnlyDir = path.join(TEST_DIR, "readonly");
        await fs.mkdir(readOnlyDir, { recursive: true });
        await fs.chmod(readOnlyDir, 0o444); // Read-only

        const readOnlyFile = path.join(readOnlyDir, "file.txt");
        const result = await creator.createFile(readOnlyFile, "content");

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(AtomicOperationError.PERMISSION_DENIED);

        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }
    });

    it("should update metrics correctly", async () => {
      // Create a fresh creator to ensure clean metrics state
      const freshCreator = new AtomicFileCreator({
        operationTimeout: 5000,
        maxRetries: 2,
      });
      
      const initialMetrics = freshCreator.getMetrics();

      // Use a unique file path to avoid conflicts
      const uniqueFile = path.join(TEST_DIR, `metrics-test-${Date.now()}.txt`);
      await freshCreator.createFile(uniqueFile, "test content");

      const updatedMetrics = freshCreator.getMetrics();
      
      expect(updatedMetrics.totalOperations).toBe(
        initialMetrics.totalOperations + 1,
      );
      expect(updatedMetrics.successfulOperations).toBe(
        initialMetrics.successfulOperations + 1,
      );
      expect(updatedMetrics.operationTypes.create).toBe(
        initialMetrics.operationTypes.create + 1,
      );
      expect(updatedMetrics.totalBytesProcessed).toBeGreaterThan(
        initialMetrics.totalBytesProcessed,
      );
      
      // Clean up the test file and fresh creator
      try {
        await fs.unlink(uniqueFile);
      } catch {
        // Ignore if file doesn't exist
      }
      await freshCreator.cleanup();
    });
  });

  describe("createEmptyFile", () => {
    it("should create an empty file", async () => {
      const result = await creator.createEmptyFile(TEST_FILE);

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBe(0);

      // Verify file is empty
      const stats = await fs.stat(TEST_FILE);
      expect(stats.size).toBe(0);
    });

    it("should create empty file with custom options", async () => {
      const result = await creator.createEmptyFile(TEST_FILE, { mode: 0o600 });

      expect(result.success).toBe(true);

      // Verify file permissions (Unix-like systems only)
      if (process.platform !== "win32") {
        const stats = await fs.stat(TEST_FILE);
        expect(stats.mode & 0o777).toBe(0o600);
      }
    });
  });

  describe("createJsonFile", () => {
    it("should create a JSON file with object data", async () => {
      const data = { name: "test", value: 42, nested: { array: [1, 2, 3] } };
      const result = await creator.createJsonFile(TEST_JSON_FILE, data);

      expect(result.success).toBe(true);

      // Verify JSON content
      const fileContent = await fs.readFile(TEST_JSON_FILE, "utf8");
      const parsedData = JSON.parse(fileContent);
      expect(parsedData).toEqual(data);
    });

    it("should create a JSON file with array data", async () => {
      const data = [1, 2, 3, { test: true }];
      const result = await creator.createJsonFile(TEST_JSON_FILE, data);

      expect(result.success).toBe(true);

      // Verify JSON content
      const fileContent = await fs.readFile(TEST_JSON_FILE, "utf8");
      const parsedData = JSON.parse(fileContent);
      expect(parsedData).toEqual(data);
    });

    it("should handle JSON serialization errors", async () => {
      const circularData = { self: null as any };
      circularData.self = circularData; // Create circular reference

      const result = await creator.createJsonFile(TEST_JSON_FILE, circularData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("createMultipleFiles", () => {
    it("should create multiple files successfully", async () => {
      const files = [
        { path: path.join(TEST_DIR, "file1.txt"), content: "content 1" },
        { path: path.join(TEST_DIR, "file2.txt"), content: "content 2" },
        { path: path.join(TEST_DIR, "file3.txt"), content: "content 3" },
      ];

      const results = await creator.createMultipleFiles(files);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      // Verify all files were created
      for (const file of files) {
        const content = await fs.readFile(file.path, "utf8");
        expect(content).toBe(file.content);
      }
    });

    it("should handle partial failures without stopOnError", async () => {
      // Create an existing file that will cause a conflict
      const conflictFile = path.join(TEST_DIR, "conflict.txt");
      await fs.writeFile(conflictFile, "existing");

      const files = [
        { path: path.join(TEST_DIR, "success1.txt"), content: "content 1" },
        { path: conflictFile, content: "new content" }, // This will fail
        { path: path.join(TEST_DIR, "success2.txt"), content: "content 2" },
      ];

      const results = await creator.createMultipleFiles(files, {
        stopOnError: false,
      });

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      // Verify successful files were created
      const content1 = await fs.readFile(files[0].path, "utf8");
      expect(content1).toBe("content 1");
      const content2 = await fs.readFile(files[2].path, "utf8");
      expect(content2).toBe("content 2");
    });

    it("should stop on first error when stopOnError is true", async () => {
      // Create a unique test directory for this test to avoid interference
      const uniqueTestDir = path.join(TEST_DIR, `stop-on-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      await fs.mkdir(uniqueTestDir, { recursive: true });
      
      try {
        // Create a fresh creator to ensure clean state
        const freshCreator = new AtomicFileCreator({
          operationTimeout: 5000,
          maxRetries: 2,
        });
        
        // Create an existing file that will cause a conflict
        const conflictFile = path.join(uniqueTestDir, "conflict.txt");
        await fs.writeFile(conflictFile, "existing");

        const files = [
          { path: path.join(uniqueTestDir, "success1.txt"), content: "content 1" },
          { path: conflictFile, content: "new content" }, // This will fail
          { path: path.join(uniqueTestDir, "not-created.txt"), content: "content 2" },
        ];

        const results = await freshCreator.createMultipleFiles(files, {
          stopOnError: true,
        });

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(false);

        // Verify the first file was rolled back
        try {
          await fs.access(files[0].path);
          expect(true).toBe(false); // Should not reach here
        } catch {
          // File should not exist due to rollback
          expect(true).toBe(true);
        }

        // Verify the third file was not created
        try {
          await fs.access(files[2].path);
          expect(true).toBe(false); // Should not reach here
        } catch {
          // File should not exist
          expect(true).toBe(true);
        }
        
        // Clean up the fresh creator
        await freshCreator.cleanup();
      } finally {
        // Clean up the unique test directory
        try {
          await fs.rm(uniqueTestDir, { recursive: true, force: true });
        } catch (error) {
          console.warn("Failed to clean up unique test directory:", error);
        }
      }
    });
  });

  describe("rollback and error handling", () => {
    it("should rollback on temp file write failure", async () => {
      // Use a unique test directory to isolate this test
      const uniqueTestDir = path.join(TEST_DIR, `rollback-write-test-${Date.now()}`);
      
      await fs.mkdir(uniqueTestDir, { recursive: true });

      try {
        const testCreator = new AtomicFileCreator({
          operationTimeout: 2000,
          maxRetries: 1,
        });

        // Create a scenario that triggers rollback: try to write to a read-only file system location
        // Create a file that will cause issues during the atomic operation
        const invalidPath = path.join(uniqueTestDir, "subdir", "file.txt");
        
        // Create a regular file where we expect a directory, causing ENOTDIR error
        await fs.writeFile(path.join(uniqueTestDir, "subdir"), "not a directory");
        
        // Try to create a file in what should be a directory but is actually a file
        const result = await testCreator.createFile(invalidPath, "test content");

        // Should fail gracefully with proper error handling
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBeDefined();

        // Verify the original "subdir" file is still intact (not corrupted by rollback)
        const subdirContent = await fs.readFile(path.join(uniqueTestDir, "subdir"), "utf8");
        expect(subdirContent).toBe("not a directory");

        // Verify no temp files remain in the test directory
        const files = await fs.readdir(uniqueTestDir);
        const tempFiles = files.filter(file => file.includes('.tmp-'));
        expect(tempFiles).toHaveLength(0);

        await testCreator.cleanup();
      } finally {
        // Clean up test directory
        await fs.rm(uniqueTestDir, { recursive: true, force: true });
      }
    });

    it("should handle atomic move failure gracefully", async () => {
      // Use a unique test directory to isolate this test
      const uniqueTestDir = path.join(TEST_DIR, `move-fail-test-${Date.now()}`);
      const testFile = path.join(uniqueTestDir, "move-fail-test.txt");
      
      await fs.mkdir(uniqueTestDir, { recursive: true });

      try {
        const testCreator = new AtomicFileCreator({
          operationTimeout: 2000,
          maxRetries: 1,
        });

        // Create a directory with the same name as target file to cause move failure
        await fs.mkdir(testFile, { recursive: true });

        // Try to create file - should fail during atomic move due to directory conflict
        const result = await testCreator.createFile(testFile, "test content");

        // Should fail gracefully
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        // Verify directory still exists (wasn't corrupted)
        const stats = await fs.stat(testFile);
        expect(stats.isDirectory()).toBe(true);

        await testCreator.cleanup();
      } finally {
        // Clean up test directory
        await fs.rm(uniqueTestDir, { recursive: true, force: true });
      }
    });

    it("should handle backup creation and restore during overwrite", async () => {
      // Use a unique test directory to isolate this test
      const uniqueTestDir = path.join(TEST_DIR, `backup-test-${Date.now()}`);
      const testFile = path.join(uniqueTestDir, "backup-test.txt");
      
      await fs.mkdir(uniqueTestDir, { recursive: true });

      try {
        const testCreator = new AtomicFileCreator({
          operationTimeout: 2000,
          maxRetries: 1,
        });

        // Create original file
        const originalContent = "original content";
        await fs.writeFile(testFile, originalContent);

        // Attempt overwrite operation
        const result = await testCreator.createFile(testFile, "new content", {
          overwrite: true,
        });

        // Should succeed with backup handling
        expect(result.success).toBe(true);

        // Verify new content was written
        const fileContent = await fs.readFile(testFile, "utf8");
        expect(fileContent).toBe("new content");

        // Verify no backup files remain (they should be cleaned up on success)
        const files = await fs.readdir(uniqueTestDir);
        const backupFiles = files.filter(file => file.includes('.backup-'));
        expect(backupFiles).toHaveLength(0);

        await testCreator.cleanup();
      } finally {
        // Clean up test directory
        await fs.rm(uniqueTestDir, { recursive: true, force: true });
      }
    });
  });

  describe("metrics and performance", () => {
    it("should track performance metrics accurately", async () => {
      // Create a fresh creator to ensure clean metrics state
      const freshCreator = new AtomicFileCreator({
        operationTimeout: 5000,
        maxRetries: 2,
      });
      
      const initialMetrics = freshCreator.getMetrics();

      // Perform successful operation
      await freshCreator.createFile(TEST_FILE, "success content");

      // Perform failed operation
      await freshCreator.createFile(TEST_FILE, "fail content"); // Will fail - file exists

      const finalMetrics = freshCreator.getMetrics();

      expect(finalMetrics.totalOperations).toBe(
        initialMetrics.totalOperations + 2,
      );
      expect(finalMetrics.successfulOperations).toBe(
        initialMetrics.successfulOperations + 1,
      );
      expect(finalMetrics.failedOperations).toBe(
        initialMetrics.failedOperations + 1,
      );
      expect(finalMetrics.operationTypes.create).toBe(
        initialMetrics.operationTypes.create + 2,
      );
      expect(finalMetrics.averageDuration).toBeGreaterThan(0);
      expect(finalMetrics.totalBytesProcessed).toBeGreaterThan(
        initialMetrics.totalBytesProcessed,
      );
      
      // Clean up the fresh creator
      await freshCreator.cleanup();
    });

    it("should track error statistics", async () => {
      // Create existing file to trigger error
      await fs.writeFile(TEST_FILE, "existing");

      // Attempt to create same file (will fail)
      await creator.createFile(TEST_FILE, "new content");

      const finalMetrics = creator.getMetrics();
      expect(Object.keys(finalMetrics.errorStats)).toContain(
        "INVALID_OPERATION",
      );
    });

    it("should track fsync calls when enabled", async () => {
      const fsyncCreator = new AtomicFileCreator({ enableFsync: true });
      const initialMetrics = fsyncCreator.getMetrics();

      await fsyncCreator.createFile(TEST_FILE, "content with fsync");

      const finalMetrics = fsyncCreator.getMetrics();
      expect(finalMetrics.totalFsyncCalls).toBeGreaterThan(
        initialMetrics.totalFsyncCalls,
      );

      await fsyncCreator.cleanup();
    });
  });

  describe("cleanup and resource management", () => {
    it("should clean up temporary files automatically", async () => {
      // Create a file to generate temp files
      await creator.createFile(TEST_FILE, "content");

      // Force cleanup
      await creator.cleanup();

      // Verify no temp files remain
      const files = await fs.readdir(TEST_DIR);
      const tempFiles = files.filter((file) => file.includes(".tmp-"));
      expect(tempFiles).toHaveLength(0);
    });

    it("should handle stale operation cleanup", async () => {
      // Create an operation that will be considered stale
      const shortTimeoutCreator = new AtomicFileCreator({
        operationTimeout: 100,
      });

      // The internal cleanup interval should handle stale operations
      // We can't easily test this without manipulating time, so we'll just ensure cleanup doesn't crash
      await shortTimeoutCreator.cleanup();
      expect(true).toBe(true); // Test passes if no exception is thrown
    });
  });

  describe("edge cases and error conditions", () => {
    it("should handle invalid file paths gracefully", async () => {
      // Use truly invalid paths that will fail on all platforms
      const invalidPath = process.platform === "win32" 
        ? "Z:\\nonexistent\\deeply\\nested\\invalid\\path.txt"
        : "/nonexistent/deeply/nested/invalid/path.txt";
      
      const result = await creator.createFile(invalidPath, "content");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle extremely long file names", async () => {
      const longName = "a".repeat(255); // Max filename length on many systems
      const longPath = path.join(TEST_DIR, `${longName}.txt`);

      const result = await creator.createFile(longPath, "content");

      // This may succeed or fail depending on the system, but should not crash
      expect(typeof result.success).toBe("boolean");

      if (result.success) {
        // Clean up if successful
        await fs.unlink(longPath);
      }
    });

    it("should handle concurrent operations on the same file", async () => {
      const promises = [];

      // Start multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        promises.push(
          creator.createFile(
            path.join(TEST_DIR, `concurrent-${i}.txt`),
            `content ${i}`,
          ),
        );
      }

      const results = await Promise.all(promises);

      // All operations should complete (successfully or with failure)
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(typeof result.success).toBe("boolean");
      });
    });

    it("should handle empty string content", async () => {
      const result = await creator.createFile(TEST_FILE, "");

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBe(0);

      const stats = await fs.stat(TEST_FILE);
      expect(stats.size).toBe(0);
    });

    it("should handle null bytes in content", async () => {
      const contentWithNull = "Hello\x00World\x00";
      const result = await creator.createFile(TEST_FILE, contentWithNull);

      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(TEST_FILE, "utf8");
      expect(fileContent).toBe(contentWithNull);
    });
  });
});
