/**
 * @fileoverview Tests for AtomicFileManager temporary file management
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { AtomicFileManager } from "../../src/atomicOps/AtomicFileManager";

describe("AtomicFileManager", () => {
  let manager: AtomicFileManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), "test-temp-files");
    await fs.mkdir(testDir, { recursive: true });

    manager = new AtomicFileManager({
      tempDirectory: testDir,
      operationTimeout: 5000, // 5 seconds for tests
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

  describe("Temporary File Creation", () => {
    it("should create temporary file with unique naming", async () => {
      const targetPath = path.join(testDir, "target.txt");
      const tempInfo = await manager.createTempFile(targetPath);

      expect(tempInfo.path).toContain(".tmp-");
      expect(tempInfo.path).toContain(".tmp");
      expect(tempInfo.targetPath).toBe(targetPath);
      expect(tempInfo.operationId).toBeDefined();
      expect(tempInfo.pid).toBe(process.pid);
      expect(tempInfo.createdAt).toBeGreaterThan(0);
    });

    it("should track created temporary files", async () => {
      const targetPath = path.join(testDir, "target.txt");
      const tempInfo = await manager.createTempFile(targetPath);

      const activeTempFiles = manager.getActiveTempFiles();
      expect(activeTempFiles).toHaveLength(1);
      expect(activeTempFiles[0].operationId).toBe(tempInfo.operationId);
    });

    it("should create temp directory if it does not exist", async () => {
      // Create a manager without a specific temp directory
      const customManager = new AtomicFileManager({ operationTimeout: 5000 });

      const nonExistentDir = path.join(testDir, "non-existent");
      const targetPath = path.join(nonExistentDir, "target.txt");

      const tempInfo = await customManager.createTempFile(targetPath);

      expect(tempInfo.path).toContain(nonExistentDir);
      const dirExists = await fs.access(nonExistentDir).then(
        () => true,
        () => false,
      );
      expect(dirExists).toBe(true);

      await customManager.shutdown();
    });

    it("should support custom cleanup timeout", async () => {
      const targetPath = path.join(testDir, "target.txt");
      const customTimeout = 10000;

      const tempInfo = await manager.createTempFile(targetPath, {
        cleanupTimeout: customTimeout,
      });

      expect(tempInfo.cleanupTimeout).toBe(customTimeout);
    });
  });

  describe("Temporary File Cleanup", () => {
    it("should clean up specific temporary file", async () => {
      const targetPath = path.join(testDir, "target.txt");
      const tempInfo = await manager.createTempFile(targetPath);

      // Create the temp file
      await fs.writeFile(tempInfo.path, "test content");

      // Verify file exists
      const fileExists = await fs.access(tempInfo.path).then(
        () => true,
        () => false,
      );
      expect(fileExists).toBe(true);

      // Clean up
      await manager.cleanupTempFile(tempInfo.operationId);

      // Verify file is removed
      const fileExistsAfter = await fs.access(tempInfo.path).then(
        () => true,
        () => false,
      );
      expect(fileExistsAfter).toBe(false);

      // Verify removed from tracking
      const activeTempFiles = manager.getActiveTempFiles();
      expect(activeTempFiles).toHaveLength(0);
    });

    it("should handle cleanup of non-existent file gracefully", async () => {
      const targetPath = path.join(testDir, "target.txt");
      const tempInfo = await manager.createTempFile(targetPath);

      // Don't create the file, just clean up
      await expect(
        manager.cleanupTempFile(tempInfo.operationId),
      ).resolves.not.toThrow();

      // Verify removed from tracking
      const activeTempFiles = manager.getActiveTempFiles();
      expect(activeTempFiles).toHaveLength(0);
    });

    it("should handle cleanup of unknown operation ID gracefully", async () => {
      await expect(
        manager.cleanupTempFile("unknown-operation-id"),
      ).resolves.not.toThrow();
    });
  });

  describe("Temporary File Promotion", () => {
    it("should promote temporary file to final location", async () => {
      const targetPath = path.join(testDir, "target.txt");
      const tempInfo = await manager.createTempFile(targetPath);
      const testContent = "test content for promotion";

      // Write content to temp file
      await fs.writeFile(tempInfo.path, testContent);

      // Promote to final location
      await manager.promoteTempFile(tempInfo.operationId);

      // Verify file exists at final location
      const finalContent = await fs.readFile(targetPath, "utf8");
      expect(finalContent).toBe(testContent);

      // Verify temp file is removed from tracking
      const activeTempFiles = manager.getActiveTempFiles();
      expect(activeTempFiles).toHaveLength(0);

      // Verify temp file no longer exists
      const tempExists = await fs.access(tempInfo.path).then(
        () => true,
        () => false,
      );
      expect(tempExists).toBe(false);
    });

    it("should support custom final path during promotion", async () => {
      const originalTarget = path.join(testDir, "original.txt");
      const customTarget = path.join(testDir, "custom.txt");
      const tempInfo = await manager.createTempFile(originalTarget);
      const testContent = "test content";

      await fs.writeFile(tempInfo.path, testContent);

      // Promote to custom location
      await manager.promoteTempFile(tempInfo.operationId, customTarget);

      // Verify file exists at custom location
      const finalContent = await fs.readFile(customTarget, "utf8");
      expect(finalContent).toBe(testContent);
    });

    it("should create target directory if it does not exist", async () => {
      const targetPath = path.join(testDir, "nested", "deep", "target.txt");
      const tempInfo = await manager.createTempFile(targetPath);

      await fs.writeFile(tempInfo.path, "content");

      await manager.promoteTempFile(tempInfo.operationId);

      const finalContent = await fs.readFile(targetPath, "utf8");
      expect(finalContent).toBe("content");
    });
  });

  describe("Metrics Tracking", () => {
    it("should track operation metrics correctly", async () => {
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.totalOperations).toBe(0);

      // Perform some operations
      const tempInfo = await manager.createTempFile(
        path.join(testDir, "target.txt"),
      );
      await fs.writeFile(tempInfo.path, "content");
      await manager.promoteTempFile(tempInfo.operationId);

      const finalMetrics = manager.getMetrics();
      expect(finalMetrics.totalOperations).toBeGreaterThan(0);
      expect(finalMetrics.successfulOperations).toBeGreaterThan(0);
      expect(finalMetrics.operationTypes.create).toBeGreaterThan(0);
      expect(finalMetrics.operationTypes.write).toBeGreaterThan(0);
    });
  });
});
