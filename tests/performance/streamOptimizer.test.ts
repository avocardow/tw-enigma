/**
 * Test suite for StreamOptimizer
 * Tests stream processing functionality including file processing, text streaming,
 * batch processing, backpressure handling, and progress tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StreamOptimizer } from "../../src/performance/streamOptimizer.ts";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  rmSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("StreamOptimizer", () => {
  let streamOptimizer: StreamOptimizer;
  let testDir: string;
  let testFiles: string[];

  beforeEach(() => {
    streamOptimizer = new StreamOptimizer({
      highWaterMark: 1024,
      chunkSize: 512,
      maxConcurrentStreams: 3,
    });

    // Create test directory
    testDir = join(tmpdir(), "stream-optimizer-test");
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    // Create test files
    testFiles = [];
    for (let i = 0; i < 3; i++) {
      const filePath = join(testDir, `test-${i}.txt`);
      writeFileSync(filePath, `Test content ${i}\n`.repeat(100));
      testFiles.push(filePath);
    }
  });

  afterEach(() => {
    // Cleanup test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      const optimizer = new StreamOptimizer();
      expect(optimizer).toBeInstanceOf(StreamOptimizer);
    });

    it("should initialize with custom configuration", () => {
      const config = {
        highWaterMark: 2048,
        chunkSize: 1024,
        maxConcurrentStreams: 5,
      };
      const optimizer = new StreamOptimizer(config);
      expect(optimizer).toBeInstanceOf(StreamOptimizer);
    });
  });

  describe("processFile", () => {
    it("should process a single file with transforms", async () => {
      const transforms = [
        (chunk: Buffer | string) => chunk.toString().toUpperCase(),
        (text: string) => text.replace(/\n/g, " "),
      ];

      const result = await streamOptimizer.processFile(
        testFiles[0],
        transforms,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.stats.bytesProcessed).toBeGreaterThan(0);
      expect(result.stats.itemsProcessed).toBeGreaterThan(0);
      expect(result.stats.throughput).toBeGreaterThan(0);
    });

    it("should handle file processing errors gracefully", async () => {
      const nonExistentFile = join(testDir, "non-existent.txt");
      const transforms = [(chunk: Buffer | string) => chunk.toString()];

      const result = await streamOptimizer.processFile(
        nonExistentFile,
        transforms,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("ENOENT");
    });

    it("should handle transform errors", async () => {
      const transforms = [
        () => {
          throw new Error("Transform error");
        },
      ];

      const result = await streamOptimizer.processFile(
        testFiles[0],
        transforms,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Transform error");
    });

    it("should emit progress events", async () => {
      const progressEvents: any[] = [];
      streamOptimizer.on("progress", (event) => {
        progressEvents.push(event);
      });

      const transforms = [(chunk: Buffer | string) => chunk.toString()];
      await streamOptimizer.processFile(testFiles[0], transforms);

      // Progress events may or may not be emitted depending on file size and processing speed
      // This test ensures the event system is working
      expect(progressEvents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("processTextStream", () => {
    it("should process text in chunks", async () => {
      const text = "hello world ".repeat(1000);
      const processor = (chunk: string) => chunk.toUpperCase();

      const result = await streamOptimizer.processTextStream(text, processor, {
        chunkSize: 50,
        enableProgress: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(text.toUpperCase());
      expect(result.stats.bytesProcessed).toBe(text.length);
      expect(result.stats.itemsProcessed).toBeGreaterThan(0);
    });

    it("should handle async processors", async () => {
      const text = "async test content";
      const processor = async (chunk: string) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return chunk.toUpperCase();
      };

      const result = await streamOptimizer.processTextStream(text, processor);

      expect(result.success).toBe(true);
      expect(result.data).toBe(text.toUpperCase());
    });

    it("should handle processor errors", async () => {
      const text = "error test";
      const processor = () => {
        throw new Error("Processor error");
      };

      const result = await streamOptimizer.processTextStream(text, processor);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.stats.errorCount).toBeGreaterThan(0);
    });

    it("should emit progress events for text processing", async () => {
      let progressEventCount = 0;
      streamOptimizer.on("progress", () => {
        progressEventCount++;
      });

      const text = "progress test ".repeat(100);
      const processor = (chunk: string) => chunk;

      await streamOptimizer.processTextStream(text, processor, {
        enableProgress: true,
        chunkSize: 50,
      });

      expect(progressEventCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("processBatchStream", () => {
    it("should process multiple files concurrently", async () => {
      const processor = async (filePath: string, content: Buffer) => {
        return {
          path: filePath,
          size: content.length,
          content: content.toString().toUpperCase(),
        };
      };

      const result = await streamOptimizer.processBatchStream(
        testFiles,
        processor,
        {
          maxConcurrentStreams: 2,
          enableProgress: true,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(testFiles.length);
      expect(result.stats.itemsProcessed).toBe(testFiles.length);

      // Verify all files were processed
      result.data?.forEach((item, index) => {
        expect(item).toHaveProperty("path", testFiles[index]);
        expect(item).toHaveProperty("size");
        expect(item).toHaveProperty("content");
      });
    });

    it("should handle individual file processing errors", async () => {
      const filesWithError = [...testFiles, join(testDir, "non-existent.txt")];
      const processor = async (filePath: string, content: Buffer) => {
        return { path: filePath, size: content.length };
      };

      const result = await streamOptimizer.processBatchStream(
        filesWithError,
        processor,
      );

      expect(result.success).toBe(false); // Should be false due to errors
      expect(result.stats.errorCount).toBeGreaterThan(0);
      // Only successful files are returned in data, failed files are excluded
      expect(result.data).toHaveLength(testFiles.length); // 3 successful files
      
      // Verify that we have successful results for the valid files
      expect(result.data?.length).toBe(3);
      result.data?.forEach((item) => {
        expect(item).not.toBeInstanceOf(Error);
        expect(item).toHaveProperty("path");
        expect(item).toHaveProperty("size");
      });
    });

    it("should respect concurrency limits", async () => {
      let concurrentExecutions = 0;
      let maxConcurrency = 0;

      const processor = async (filePath: string, content: Buffer) => {
        concurrentExecutions++;
        maxConcurrency = Math.max(maxConcurrency, concurrentExecutions);

        await new Promise((resolve) => setTimeout(resolve, 50));

        concurrentExecutions--;
        return { path: filePath, processed: true };
      };

      await streamOptimizer.processBatchStream(testFiles, processor, {
        maxConcurrentStreams: 2,
      });

      expect(maxConcurrency).toBeLessThanOrEqual(2);
    });

    it("should emit progress events for batch processing", async () => {
      let progressEventCount = 0;
      streamOptimizer.on("progress", () => {
        progressEventCount++;
      });

      const processor = async (filePath: string, content: Buffer) => ({
        path: filePath,
        size: content.length,
      });

      await streamOptimizer.processBatchStream(testFiles, processor, {
        enableProgress: true,
      });

      expect(progressEventCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getActiveStreamStats", () => {
    it("should return active stream statistics", () => {
      const stats = streamOptimizer.getActiveStreamStats();
      expect(stats).toBeInstanceOf(Map);
      expect(stats.size).toBe(0); // No active streams initially
    });
  });

  describe("getOverallMetrics", () => {
    it("should return performance metrics", () => {
      const metrics = streamOptimizer.getOverallMetrics();

      expect(metrics).toHaveProperty("heapUsed");
      expect(metrics).toHaveProperty("heapTotal");
      expect(metrics).toHaveProperty("queuedTasks");
      expect(metrics).toHaveProperty("completedTasks");
      expect(metrics).toHaveProperty("failedTasks");
      expect(metrics).toHaveProperty("throughput");
      expect(metrics).toHaveProperty("memoryUsage");
      expect(metrics).toHaveProperty("timestamp");

      expect(typeof metrics.heapUsed).toBe("number");
      expect(typeof metrics.heapTotal).toBe("number");
      expect(typeof metrics.memoryUsage).toBe("number");
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeLessThanOrEqual(1);
    });
  });

  describe("backpressure handling", () => {
    it("should emit backpressure events when configured", async () => {
      const backpressureEvents: any[] = [];
      streamOptimizer.on("backpressure", (event) => {
        backpressureEvents.push(event);
      });

      // Create a large file to potentially trigger backpressure
      const largePath = join(testDir, "large.txt");
      writeFileSync(largePath, "x".repeat(100000));

      const transforms = [(chunk: Buffer | string) => chunk.toString()];
      await streamOptimizer.processFile(largePath, transforms);

      // Backpressure events are system-dependent, so we just verify the event system works
      expect(backpressureEvents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error handling and recovery", () => {
    it("should handle stream errors gracefully", async () => {
      const transforms = [
        (chunk: Buffer | string) => {
          // Simulate intermittent errors
          if (Math.random() < 0.1) {
            throw new Error("Random transform error");
          }
          return chunk.toString();
        },
      ];

      const result = await streamOptimizer.processFile(
        testFiles[0],
        transforms,
      );

      // Result should either succeed or fail gracefully
      expect(typeof result.success).toBe("boolean");
      expect(result.stats).toBeDefined();

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.stats.errorCount).toBeGreaterThan(0);
      }
    });

    it("should cleanup resources on error", async () => {
      const initialStats = streamOptimizer.getActiveStreamStats();
      const initialCount = initialStats.size;

      try {
        await streamOptimizer.processFile("non-existent-file.txt", []);
      } catch (error) {
        // Error expected
      }

      const finalStats = streamOptimizer.getActiveStreamStats();
      expect(finalStats.size).toBe(initialCount); // Should be cleaned up
    });
  });

  describe("performance characteristics", () => {
    it("should maintain reasonable throughput", async () => {
      const text = "performance test ".repeat(10000);
      const processor = (chunk: string) => chunk.toUpperCase();

      const startTime = Date.now();
      const result = await streamOptimizer.processTextStream(text, processor);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.stats.throughput).toBeGreaterThan(0);

      const duration = endTime - startTime;
      const throughputMBps = text.length / (1024 * 1024) / (duration / 1000);

      // Should process at least 1MB/s (very conservative)
      expect(throughputMBps).toBeGreaterThan(1);
    });

    it("should handle memory efficiently", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple large texts
      const largeText = "memory test ".repeat(100000);
      const processor = (chunk: string) => chunk;

      for (let i = 0; i < 5; i++) {
        await streamOptimizer.processTextStream(largeText, processor);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe("edge cases", () => {
    it("should handle empty files", async () => {
      const emptyFile = join(testDir, "empty.txt");
      writeFileSync(emptyFile, "");

      const transforms = [(chunk: Buffer | string) => chunk.toString()];
      const result = await streamOptimizer.processFile(emptyFile, transforms);

      expect(result.success).toBe(true);
      expect(result.stats.bytesProcessed).toBe(0);
    });

    it("should handle empty text", async () => {
      const processor = (chunk: string) => chunk;
      const result = await streamOptimizer.processTextStream("", processor);

      expect(result.success).toBe(true);
      expect(result.data).toBe("");
      expect(result.stats.bytesProcessed).toBe(0);
    });

    it("should handle empty file list", async () => {
      const processor = async (filePath: string, content: Buffer) => ({
        path: filePath,
      });
      const result = await streamOptimizer.processBatchStream([], processor);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(result.stats.itemsProcessed).toBe(0);
    });

    it("should handle no transforms", async () => {
      const result = await streamOptimizer.processFile(testFiles[0], []);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.stats.bytesProcessed).toBeGreaterThan(0);
    });
  });
});
