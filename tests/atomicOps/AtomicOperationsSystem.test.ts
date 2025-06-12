/**
 * @fileoverview Integration tests for the comprehensive atomic operations system
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { AtomicOperationsSystem } from "../../src/atomicOps";

describe("AtomicOperationsSystem Integration", () => {
  let system: AtomicOperationsSystem;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), "test-integration");
    await fs.mkdir(testDir, { recursive: true });

    system = new AtomicOperationsSystem({
      tempDirectory: testDir,
      enableFsync: false, // Faster tests
      preservePermissions: true,
    });
  });

  afterEach(async () => {
    await system.shutdown();

    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Component Integration", () => {
    it("should have all components accessible", () => {
      expect(system.creator).toBeDefined();
      expect(system.reader).toBeDefined();
      expect(system.writer).toBeDefined();
      expect(system.manager).toBeDefined();
      expect(system.rollback).toBeDefined();
      expect(system.permissions).toBeDefined();
    });

    it("should perform atomic create operation", async () => {
      const testFile = path.join(testDir, "atomic-create.txt");
      const content = "Atomic create test content";

      const result = await system.performAtomicOperation({
        type: "create",
        filePath: testFile,
        content,
        permissions: 0o644,
      });

      expect(result.success).toBe(true);

      // Verify file exists with correct content
      const fileContent = await fs.readFile(testFile, "utf8");
      expect(fileContent).toBe(content);

      // Verify permissions
      const stats = await fs.stat(testFile);
      expect(stats.mode & 0o777).toBe(0o644);
    });

    it("should perform atomic read operation", async () => {
      const testFile = path.join(testDir, "atomic-read.txt");
      const content = "Atomic read test content";

      // Create file first
      await fs.writeFile(testFile, content);

      const result = await system.performAtomicOperation({
        type: "read",
        filePath: testFile,
      });

      expect(result.success).toBe(true);
      expect(result.fileContent).toBe(content);
    });

    it("should perform atomic write operation", async () => {
      const testFile = path.join(testDir, "atomic-write.txt");
      const originalContent = "Original content";
      const newContent = "New atomic content";

      // Create file first
      await fs.writeFile(testFile, originalContent);

      const result = await system.performAtomicOperation({
        type: "write",
        filePath: testFile,
        content: newContent,
        permissions: 0o755,
      });

      expect(result.success).toBe(true);

      // Verify content changed
      const fileContent = await fs.readFile(testFile, "utf8");
      expect(fileContent).toBe(newContent);

      // Verify permissions
      const stats = await fs.stat(testFile);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it("should handle operation failures with rollback", async () => {
      const nonExistentFile = path.join(testDir, "non-existent", "test.txt");

      // This should fail due to non-existent directory
      await expect(
        system.performAtomicOperation({
          type: "create",
          filePath: nonExistentFile,
          content: "test",
        }),
      ).rejects.toThrow();

      // Verify rollback worked (no partial state)
      const fileExists = await fs.access(nonExistentFile).then(
        () => true,
        () => false,
      );
      expect(fileExists).toBe(false);
    });
  });

  describe("System Metrics and Health", () => {
    it("should provide comprehensive system metrics", async () => {
      // Perform some operations to generate metrics
      await system.performAtomicOperation({
        type: "create",
        filePath: path.join(testDir, "metrics-test.txt"),
        content: "test",
      });

      const metrics = system.getSystemMetrics();

      expect(metrics).toHaveProperty("creator");
      expect(metrics).toHaveProperty("reader");
      expect(metrics).toHaveProperty("writer");
      expect(metrics).toHaveProperty("manager");
      expect(metrics).toHaveProperty("rollback");
      expect(metrics).toHaveProperty("permissions");

      expect(metrics.creator.totalOperations).toBeGreaterThan(0);
    });

    it("should perform system health check", async () => {
      const health = await system.healthCheck();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("components");
      expect(health).toHaveProperty("metrics");

      expect(["healthy", "degraded", "unhealthy"]).toContain(health.status);
      expect(health.components).toHaveProperty("creator");
      expect(health.components).toHaveProperty("reader");
      expect(health.components).toHaveProperty("writer");
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle multiple concurrent operations", async () => {
      const operations = [];

      for (let i = 0; i < 5; i++) {
        operations.push(
          system.performAtomicOperation({
            type: "create",
            filePath: path.join(testDir, `concurrent-${i}.txt`),
            content: `Content ${i}`,
          }),
        );
      }

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Verify all files exist
      for (let i = 0; i < 5; i++) {
        const fileExists = await fs
          .access(path.join(testDir, `concurrent-${i}.txt`))
          .then(
            () => true,
            () => false,
          );
        expect(fileExists).toBe(true);
      }
    });

    it("should maintain data integrity under stress", async () => {
      const testFile = path.join(testDir, "stress-test.txt");
      const operations = [];

      // Perform multiple write operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          system.performAtomicOperation({
            type: "write",
            filePath: testFile,
            content: `Stress test content ${i}`,
          }),
        );
      }

      await Promise.all(operations);

      // File should exist and have valid content
      const fileExists = await fs.access(testFile).then(
        () => true,
        () => false,
      );
      expect(fileExists).toBe(true);

      const content = await fs.readFile(testFile, "utf8");
      expect(content).toMatch(/^Stress test content \d+$/);
    });
  });

  describe("Error Recovery", () => {
    it("should recover from system errors gracefully", async () => {
      // Test with invalid operation type
      await expect(
        system.performAtomicOperation({
          type: "invalid" as any,
          filePath: path.join(testDir, "error-test.txt"),
          content: "test",
        }),
      ).rejects.toThrow("Unsupported operation type");

      // System should still be functional
      const health = await system.healthCheck();
      expect(health.status).not.toBe("unhealthy");
    });

    it("should handle shutdown gracefully", async () => {
      await system.shutdown();

      // Create new system to verify no lingering state
      const newSystem = new AtomicOperationsSystem();
      const health = await newSystem.healthCheck();
      expect(health.status).toBe("healthy");

      await newSystem.shutdown();
    });
  });
});
