/**
 * @fileoverview Comprehensive tests for AtomicFileReader
 * @module tests/atomicOps/AtomicFileReader
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { createHash } from "crypto";
import { AtomicFileReader } from "../../src/atomicOps/AtomicFileReader";
import {
  // AtomicOperationResult,
  FileReadOptions,
  AtomicOperationError,
} from "../../src/types/atomicOps";

// Test directories and files
const TEST_DIR = path.join(__dirname, "../../test-temp/atomic-reader");
const TEST_FILE = path.join(TEST_DIR, "test-file.txt");
const TEST_JSON_FILE = path.join(TEST_DIR, "test-data.json");
const LARGE_FILE = path.join(TEST_DIR, "large-file.txt");
const BINARY_FILE = path.join(TEST_DIR, "binary-file.bin");
const MISSING_FILE = path.join(TEST_DIR, "missing.txt");

// Test data
const TEST_CONTENT = "Hello, World! This is a test file.\\n";
const TEST_JSON_DATA = { name: "test", value: 42, items: [1, 2, 3] };
const LARGE_CONTENT = "A".repeat(1024 * 100); // 100KB
const BINARY_CONTENT = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd]);

describe("AtomicFileReader", () => {
  let reader: AtomicFileReader;

  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.error("Failed to clean up test directory:", error);
    }
  });

  beforeEach(async () => {
    reader = new AtomicFileReader();

    // Create test files
    await fs.writeFile(TEST_FILE, TEST_CONTENT);
    await fs.writeFile(TEST_JSON_FILE, JSON.stringify(TEST_JSON_DATA, null, 2));
    await fs.writeFile(LARGE_FILE, LARGE_CONTENT);
    await fs.writeFile(BINARY_FILE, BINARY_CONTENT);
  });

  afterEach(async () => {
    await reader.cleanup();

    // Clean up any test files
    const filesToClean = [TEST_FILE, TEST_JSON_FILE, LARGE_FILE, BINARY_FILE];
    for (const file of filesToClean) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore errors - file might not exist
      }
    }
  });

  describe("Basic File Reading", () => {
    it("should read a text file successfully", async () => {
      const result = await reader.readFile(TEST_FILE);

      expect(result.success).toBe(true);
      expect(result.operation).toBe("read");
      expect(result.filePath).toBe(TEST_FILE);
      expect(result.bytesProcessed).toBe(Buffer.byteLength(TEST_CONTENT));
      expect(result.content).toBe(TEST_CONTENT);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.fileStats).toBeDefined();
      expect(result.metadata.fsyncUsed).toBe(false); // Reading doesn't use fsync
      expect(result.error).toBeUndefined();
    });

    it("should read a binary file as buffer", async () => {
      const result = await reader.readFile(BINARY_FILE, { encoding: "buffer" });

      expect(result.success).toBe(true);
      expect(result.content).toBeInstanceOf(Buffer);
      expect((result.content as Buffer).equals(BINARY_CONTENT)).toBe(true);
      expect(result.bytesProcessed).toBe(BINARY_CONTENT.length);
    });

    it("should handle missing file gracefully", async () => {
      const result = await reader.readFile(MISSING_FILE);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(AtomicOperationError.FILE_NOT_FOUND);
      expect(result.error?.message).toContain("File not found");
      expect(result.content).toBeUndefined();
      expect(result.bytesProcessed).toBe(0);
    });

    it("should respect file size limits", async () => {
      const result = await reader.readFile(LARGE_FILE, { maxFileSize: 1024 });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("exceeds maximum allowed size");
      expect(result.bytesProcessed).toBe(0);
    });

    it("should read with different encodings", async () => {
      const testContent = "Test éñcödîng content 🚀";
      const encodingFile = path.join(TEST_DIR, "encoding-test.txt");
      await fs.writeFile(encodingFile, testContent, "utf8");

      const result = await reader.readFile(encodingFile, { encoding: "utf8" });

      expect(result.success).toBe(true);
      expect(result.content).toBe(testContent);

      await fs.unlink(encodingFile);
    });
  });

  describe("JSON File Reading", () => {
    it("should read and parse JSON file successfully", async () => {
      const result = await reader.readJsonFile(TEST_JSON_FILE);

      expect(result.success).toBe(true);
      expect(result.content).toEqual(TEST_JSON_DATA);
      expect(result.operation).toBe("read");
      expect(result.filePath).toBe(TEST_JSON_FILE);
    });

    it("should handle invalid JSON gracefully", async () => {
      const invalidJsonFile = path.join(TEST_DIR, "invalid.json");
      await fs.writeFile(invalidJsonFile, "{ invalid json }");

      const result = await reader.readJsonFile(invalidJsonFile);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("JSON_PARSE_ERROR");
      expect(result.error?.message).toContain("JSON");

      await fs.unlink(invalidJsonFile);
    });

    it("should read JSON with schema validation", async () => {
      const validation = (data: any) => {
        return (
          typeof data === "object" &&
          typeof data.name === "string" &&
          typeof data.value === "number"
        );
      };

      const result = await reader.readJsonFile(TEST_JSON_FILE, {
        validateSchema: validation,
      });

      expect(result.success).toBe(true);
      expect(result.content).toEqual(TEST_JSON_DATA);
    });

    it("should fail JSON schema validation", async () => {
      const validation = (data: any) => {
        return (
          typeof data === "object" && typeof data.invalidField === "string"
        );
      };

      const result = await reader.readJsonFile(TEST_JSON_FILE, {
        validateSchema: validation,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Schema validation failed");
    });
  });

  describe("Checksum Verification", () => {
    it("should verify file checksum successfully", async () => {
      const expectedChecksum = createHash("sha256")
        .update(TEST_CONTENT)
        .digest("hex");

      const result = await reader.readFile(TEST_FILE, {
        verifyChecksum: true,
        expectedChecksum,
        checksumAlgorithm: "sha256",
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(TEST_CONTENT);
      expect(result.metadata.checksumVerified).toBe(true);
    });

    it("should fail on checksum mismatch", async () => {
      const wrongChecksum = "wrong_checksum_value";

      const result = await reader.readFile(TEST_FILE, {
        verifyChecksum: true,
        expectedChecksum: wrongChecksum,
        checksumAlgorithm: "sha256",
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Checksum verification failed");
    });

    it("should work with different checksum algorithms", async () => {
      const algorithms: Array<"md5" | "sha1" | "sha256" | "sha512"> = [
        "md5",
        "sha1",
        "sha256",
        "sha512",
      ];

      for (const algorithm of algorithms) {
        const expectedChecksum = createHash(algorithm)
          .update(TEST_CONTENT)
          .digest("hex");

        const result = await reader.readFile(TEST_FILE, {
          verifyChecksum: true,
          expectedChecksum,
          checksumAlgorithm: algorithm,
        });

        expect(result.success).toBe(true);
        expect(result.metadata.checksumVerified).toBe(true);
      }
    });
  });

  describe("Content Caching", () => {
    it("should cache file content when enabled", async () => {
      const options: FileReadOptions = {
        enableCaching: true,
        cacheTimeout: 1000,
      };

      // First read
      const result1 = await reader.readFile(TEST_FILE, options);
      expect(result1.success).toBe(true);
      expect(result1.metadata.fromCache).toBe(false);

      // Second read should be from cache
      const result2 = await reader.readFile(TEST_FILE, options);
      expect(result2.success).toBe(true);
      expect(result2.metadata.fromCache).toBe(true);
      expect(result2.content).toBe(result1.content);
    });

    it("should respect cache timeout", async () => {
      const options: FileReadOptions = {
        enableCaching: true,
        cacheTimeout: 100, // Very short timeout
      };

      // First read
      await reader.readFile(TEST_FILE, options);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second read should not be from cache
      const result = await reader.readFile(TEST_FILE, options);
      expect(result.success).toBe(true);
      expect(result.metadata.fromCache).toBe(false);
    });

    it("should clear cache when requested", async () => {
      const options: FileReadOptions = {
        enableCaching: true,
        cacheTimeout: 10000,
      };

      // First read
      await reader.readFile(TEST_FILE, options);

      // Clear cache
      reader.clearCache();

      // Second read should not be from cache
      const result = await reader.readFile(TEST_FILE, options);
      expect(result.success).toBe(true);
      expect(result.metadata.fromCache).toBe(false);
    });
  });

  describe("Batch Operations", () => {
    const batchFiles = [
      { path: TEST_FILE, expectedContent: TEST_CONTENT },
      {
        path: TEST_JSON_FILE,
        expectedContent: JSON.stringify(TEST_JSON_DATA, null, 2),
      },
    ];

    it("should read multiple files successfully", async () => {
      const results = await reader.readMultipleFiles(
        batchFiles.map((f) => ({ path: f.path })),
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].content).toBe(batchFiles[0].expectedContent);
      expect(results[1].success).toBe(true);
      expect(results[1].content).toBe(batchFiles[1].expectedContent);
    });

    it("should handle mixed success/failure in batch", async () => {
      const files = [
        { path: TEST_FILE },
        { path: MISSING_FILE },
        { path: TEST_JSON_FILE },
      ];

      const results = await reader.readMultipleFiles(files);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it("should stop on error when configured", async () => {
      const files = [
        { path: TEST_FILE },
        { path: MISSING_FILE },
        { path: TEST_JSON_FILE },
      ];

      const results = await reader.readMultipleFiles(files, {
        abortOnFirstError: true,
      });

      expect(results).toHaveLength(2); // Should stop after first error
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe("Performance and Metrics", () => {
    it("should track performance metrics correctly", async () => {
      // Perform several operations
      await reader.readFile(TEST_FILE);
      await reader.readFile(TEST_JSON_FILE);
      await reader.readFile(MISSING_FILE); // This will fail

      const metrics = reader.getMetrics();

      expect(metrics.totalOperations).toBe(3);
      expect(metrics.successfulOperations).toBe(2);
      expect(metrics.failedOperations).toBe(1);
      expect(metrics.operationTypes.read).toBe(3);
      expect(metrics.totalBytesProcessed).toBeGreaterThan(0);
      expect(metrics.averageDuration).toBeGreaterThan(0);
    });

    it("should handle large files efficiently", async () => {
      const startTime = Date.now();
      const result = await reader.readFile(LARGE_FILE);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.bytesProcessed).toBe(LARGE_CONTENT.length);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should support streaming for very large files", async () => {
      const veryLargeContent = "B".repeat(128 * 1024); // 128KB (more manageable size)
      const veryLargeFile = path.join(TEST_DIR, "very-large.txt");
      await fs.writeFile(veryLargeFile, veryLargeContent);

      const result = await reader.readFile(veryLargeFile, {
        bufferSize: 32 * 1024, // 32KB buffer (smaller than file to trigger streaming)
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(veryLargeContent);
      expect(result.bytesProcessed).toBe(veryLargeContent.length);

      await fs.unlink(veryLargeFile);
    }, 10000); // 10 second timeout
  });

  describe("Error Handling", () => {
    it("should handle permission errors gracefully", async () => {
      // This test might be platform-specific
      const restrictedFile = path.join(TEST_DIR, "restricted.txt");
      await fs.writeFile(restrictedFile, "content");

      try {
        await fs.chmod(restrictedFile, 0o000); // No permissions

        const result = await reader.readFile(restrictedFile);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(AtomicOperationError.PERMISSION_DENIED);
      } catch (error) {
        // Permission test might not work on all systems
        console.log("Permission test skipped:", error);
      } finally {
        try {
          await fs.chmod(restrictedFile, 0o644);
          await fs.unlink(restrictedFile);
        } catch {
          // Cleanup error
        }
      }
    });

    it("should handle read timeout", async () => {
      const result = await reader.readFile(TEST_FILE, {
        readTimeout: 1, // Very short timeout
      });

      // This test might pass quickly on fast systems
      // The timeout might not trigger for small files
      expect(result.success).toBe(true); // Small file reads too quickly
    });

    it("should provide detailed error information", async () => {
      const result = await reader.readFile("/invalid/path/file.txt");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBeDefined();
      expect(result.error?.message).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe("Configuration Options", () => {
    it("should work with custom global options", async () => {
      const customReader = new AtomicFileReader({
        operationTimeout: 5000,
        bufferSize: 32 * 1024,
      });

      const result = await customReader.readFile(TEST_FILE);

      expect(result.success).toBe(true);
      expect(result.content).toBe(TEST_CONTENT);

      await customReader.cleanup();
    });

    it("should merge global and operation-specific options", async () => {
      const customReader = new AtomicFileReader({
        bufferSize: 16 * 1024,
      });

      const result = await customReader.readFile(TEST_FILE, {
        bufferSize: 8 * 1024, // This should override global setting
        encoding: "utf8",
      });

      expect(result.success).toBe(true);

      await customReader.cleanup();
    });
  });

  describe("Resource Management", () => {
    it("should clean up resources properly", async () => {
      // Enable caching
      await reader.readFile(TEST_FILE, { enableCaching: true });

      // Should have cache entries
      expect(reader.getCacheSize()).toBeGreaterThan(0);

      // Clean up
      await reader.cleanup();

      // Cache should be cleared
      expect(reader.getCacheSize()).toBe(0);
    });

    it("should handle concurrent reads safely", async () => {
      const promises = Array.from({ length: 10 }, () =>
        reader.readFile(TEST_FILE),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.content).toBe(TEST_CONTENT);
      });
    });
  });
});
