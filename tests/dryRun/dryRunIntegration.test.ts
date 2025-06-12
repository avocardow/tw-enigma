/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDryRunSimulator,
  simulateDryRun,
} from "../../src/dryRun/dryRunSimulator";
import { createMockFileSystem } from "../../src/dryRun/mockFileSystem";
import { exportReport } from "../../src/dryRun/dryRunReport";

describe("DryRun Integration Tests", () => {
  let mockFs: any;

  beforeEach(() => {
    mockFs = createMockFileSystem();
  });

  afterEach(() => {
    mockFs.reset();
  });

  it("should simulate file operations without actual modifications", async () => {
    const simulator = createDryRunSimulator({
      verbose: true,
      includeContent: true,
    });

    // Simulate some file operations
    const { dryRunResult } = await simulator.executeInDryRun(async () => {
      const fs = require("fs");

      // These operations should be intercepted and simulated
      fs.writeFileSync("test.css", "body { margin: 0; }");
      fs.writeFileSync("styles.css", "h1 { color: blue; }");
      fs.mkdirSync("dist", { recursive: true });
      fs.writeFileSync("dist/output.css", "body{margin:0}h1{color:blue}");

      return { success: true };
    });

    // Verify the simulation captured the operations
    expect(dryRunResult.success).toBe(true);
    expect(dryRunResult.statistics.totalOperations).toBeGreaterThan(0);
    expect(dryRunResult.statistics.filesCreated).toBeGreaterThan(0);
    expect(dryRunResult.statistics.directoriesCreated).toBeGreaterThan(0);
    expect(dryRunResult.operations.length).toBeGreaterThan(0);
  });

  it("should generate comprehensive reports in different formats", async () => {
    const { dryRunResult } = await simulateDryRun(
      async () => {
        const fs = require("fs");
        fs.writeFileSync("input.css", ".test { color: red; }");
        fs.writeFileSync("output.css", ".test{color:red}");
        return { processed: true };
      },
      {
        includeContent: true,
        maxContentPreview: 100,
      },
    );

    // Test different report formats
    const jsonReport = exportReport(dryRunResult.report, "json");
    const markdownReport = exportReport(dryRunResult.report, "markdown");
    const textReport = exportReport(dryRunResult.report, "text");
    const htmlReport = exportReport(dryRunResult.report, "html");

    expect(jsonReport).toContain('"metadata"');
    expect(markdownReport).toContain("# Dry Run Report");
    expect(textReport).toContain("DRY RUN REPORT");
    expect(htmlReport).toContain("<html");

    // Verify report contains expected data
    const report = dryRunResult.report;
    expect(report.metadata.timestamp).toBeDefined();
    expect(report.summary.statistics.totalOperations).toBeGreaterThan(0);
    expect(report.changes.created.length).toBeGreaterThan(0);
  });

  it("should provide accurate statistics and performance metrics", async () => {
    const { dryRunResult } = await simulateDryRun(
      async () => {
        const fs = require("fs");

        // Create various operations for statistics
        fs.writeFileSync("large.css", "a".repeat(10000)); // Large file
        fs.writeFileSync("small.css", ".small{}"); // Small file
        fs.mkdirSync("nested/dir", { recursive: true }); // Directory creation
        fs.readFileSync("large.css"); // Read operation

        return { complete: true };
      },
      {
        enableMetrics: true,
      },
    );

    const stats = dryRunResult.statistics;

    expect(stats.totalOperations).toBeGreaterThan(0);
    expect(stats.totalBytesWritten).toBeGreaterThan(10000); // Should include large file
    expect(stats.sizeImpact.netSizeChange).toBeGreaterThan(0);
    expect(stats.fileTypeDistribution).toHaveProperty("css");
    expect(stats.operationsByType).toHaveProperty("create"); // Files are created, not written to existing files
    expect(stats.operationsByType).toHaveProperty("mkdir");

    // Performance metrics should be calculated
    expect(
      dryRunResult.report.summary.performance.operationsPerSecond,
    ).toBeGreaterThan(0);
  });

  it("should handle errors gracefully in dry run mode", async () => {
    const { dryRunResult } = await simulateDryRun(async () => {
      const fs = require("fs");

      // This should work fine in dry run
      fs.writeFileSync("valid.css", ".test{}");

      // Simulate some processing that might throw
      try {
        throw new Error("Simulated processing error");
      } catch (error) {
        // Error is caught and handled
      }

      return { processed: true };
    });

    // Should complete successfully even with internal errors
    expect(dryRunResult.success).toBe(true);
    expect(dryRunResult.statistics.totalOperations).toBeGreaterThan(0);
  });

  it("should support content previews and diffs", async () => {
    const { dryRunResult } = await simulateDryRun(
      async () => {
        const fs = require("fs");

        // Create a file and then modify it
        fs.writeFileSync("style.css", ".original { color: red; }");
        fs.writeFileSync("style.css", ".modified { color: blue; }");

        return { updated: true };
      },
      {
        includeContent: true,
        maxContentPreview: 500,
      },
    );

    expect(dryRunResult.report.previews).toBeDefined();
    expect(Object.keys(dryRunResult.report.previews!).length).toBeGreaterThan(
      0,
    );

    const preview = dryRunResult.report.previews!["style.css"];
    expect(preview).toBeDefined();
    expect(preview.after).toContain(".modified");
  });

  it("should provide optimization recommendations", async () => {
    const { dryRunResult } = await simulateDryRun(
      async () => {
        const fs = require("fs");

        // Create many operations to trigger recommendations
        for (let i = 0; i < 50; i++) {
          fs.writeFileSync(`file${i}.css`, `.rule${i} { color: red; }`);
        }

        // Create large files to trigger size-based recommendations
        fs.writeFileSync("huge.css", "a".repeat(2 * 1024 * 1024)); // 2MB

        return { batched: true };
      },
      {
        enableMetrics: true,
      },
    );

    const insights = dryRunResult.report.insights;

    // Should have recommendations due to many operations
    expect(insights.recommendations.length).toBeGreaterThan(0);

    // Should detect large file
    const largFileRecommendations = insights.recommendations.filter(
      (r) => r.includes("large files") || r.includes("compression"),
    );
    expect(largFileRecommendations.length).toBeGreaterThan(0);
  });
});

describe("Mock File System", () => {
  it("should accurately simulate file system operations", async () => {
    const mockFs = createMockFileSystem();

    // Test file operations
    mockFs.writeFileSync("test.txt", "Hello World");
    expect(mockFs.existsSync("test.txt")).toBe(true);

    const content = mockFs.readFileSync("test.txt", "utf8");
    expect(content).toBe("Hello World");

    const stats = mockFs.statSync("test.txt");
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBe(11); // "Hello World" is 11 bytes

    // Test directory operations
    mockFs.mkdirSync("testdir", { recursive: true });
    expect(mockFs.existsSync("testdir")).toBe(true);

    const dirStats = mockFs.statSync("testdir");
    expect(dirStats.isDirectory()).toBe(true);

    // Test operation tracking
    const operations = mockFs.getOperations();
    expect(operations.length).toBeGreaterThan(0);
    expect(operations.some((op) => op.type === "create")).toBe(true); // New files are 'create' operations
    expect(operations.some((op) => op.type === "mkdir")).toBe(true);
  });

  it("should track file operations with proper metadata", async () => {
    const mockFs = createMockFileSystem();

    mockFs.writeFileSync("tracked.css", ".test { color: red; }");

    const operations = mockFs.getOperations();
    const writeOp = operations.find((op) => op.type === "create");

    expect(writeOp).toBeDefined();
    expect(writeOp!.path).toBe("tracked.css");
    expect(writeOp!.success).toBe(true);
    expect(writeOp!.newContent).toBe(".test { color: red; }");
    expect(writeOp!.timestamp).toBeInstanceOf(Date);
  });
});
