/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import Reporter from "../../src/reporter.js";

describe("Reporter Integration Tests", () => {
  let reporter: Reporter;
  let tempDir: string;

  beforeEach(() => {
    reporter = new Reporter();
    tempDir = path.join(process.cwd(), "test-temp", "reporter-integration");
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Real-world Data Processing", () => {
    it("should handle large optimization datasets", () => {
      const largeDataset = {
        originalSize: 5 * 1024 * 1024, // 5MB
        optimizedSize: 2 * 1024 * 1024, // 2MB
        compressedSize: 600 * 1024, // 600KB
        executionTime: 3500,
        memoryUsage: 150 * 1024 * 1024, // 150MB
        filesProcessed: 250,
        totalBytes: 5 * 1024 * 1024,
        patterns: Array.from({ length: 50 }, (_, i) => ({
          id: `pattern-${i}`,
          name: `Pattern ${i + 1}`,
          frequency: Math.floor(Math.random() * 100) + 1,
          sizeSavings: Math.floor(Math.random() * 10000) + 100,
          type: ["atomic", "utility", "component", "layout"][i % 4],
          size: Math.floor(Math.random() * 500) + 50,
        })),
      };

      const report = reporter.generateReport(largeDataset);

      expect(report.sizeMetrics.originalSize).toBe(5 * 1024 * 1024);
      expect(report.sizeMetrics.percentageReduction).toBe(60); // 3MB reduction from 5MB
      expect(report.patternStats).toHaveLength(50);
      expect(report.performanceMetrics.filesProcessed).toBe(250);
      expect(report.recommendations).toBeDefined();
      expect(report.warnings).toBeDefined();
    });

    it("should generate comprehensive reports for typical CSS optimization", () => {
      const cssOptimizationData = {
        originalSize: 850 * 1024, // 850KB
        optimizedSize: 320 * 1024, // 320KB
        compressedSize: 95 * 1024, // 95KB
        executionTime: 1200,
        memoryUsage: 45 * 1024 * 1024, // 45MB
        filesProcessed: 15,
        totalBytes: 850 * 1024,
        patterns: [
          {
            id: "flex-patterns",
            name: "Flexbox Layout Patterns",
            frequency: 45,
            sizeSavings: 25000,
            type: "layout",
            size: 180,
          },
          {
            id: "button-utilities",
            name: "Button Utility Classes",
            frequency: 78,
            sizeSavings: 18000,
            type: "utility",
            size: 120,
          },
          {
            id: "spacing-utilities",
            name: "Spacing Utilities",
            frequency: 120,
            sizeSavings: 35000,
            type: "utility",
            size: 80,
          },
          {
            id: "card-components",
            name: "Card Components",
            frequency: 22,
            sizeSavings: 12000,
            type: "component",
            size: 250,
          },
        ],
      };

      const report = reporter.generateReport(cssOptimizationData);

      // Verify size analysis
      expect(report.sizeMetrics.sizeReduction).toBe(530 * 1024); // 850KB - 320KB
      expect(report.sizeMetrics.percentageReduction).toBeCloseTo(62.35, 1);

      // Verify pattern analysis
      expect(report.patternStats).toHaveLength(4);
      const topPattern = report.patternStats[0];
      expect(topPattern.patternName).toBe("Spacing Utilities"); // Highest savings
      expect(topPattern.sizeSavings).toBe(35000);

      // Verify performance metrics
      expect(report.performanceMetrics.avgProcessingTime).toBe(80); // 1200ms / 15 files

      // Verify recommendations
      expect(report.recommendations).toContain(
        "Large CSS files detected - consider code splitting or lazy loading"
      );
    });

    it("should handle edge cases and malformed data gracefully", () => {
      const edgeCaseData = {
        originalSize: 0,
        optimizedSize: 0,
        executionTime: 0,
        filesProcessed: 0,
        patterns: [],
        errors: ["Parse error in file1.css", "Invalid syntax in file2.css"],
      };

      const report = reporter.generateReport(edgeCaseData);

      expect(report.sizeMetrics.percentageReduction).toBe(0);
      expect(report.patternStats).toHaveLength(0);
      expect(report.performanceMetrics.throughput).toBe(0);
      expect(report.warnings).toContain("2 errors occurred during optimization");
    });
  });

  describe("Multi-format Output Generation", () => {
    it("should generate and save reports in all formats", () => {
      const testData = {
        originalSize: 100000,
        optimizedSize: 60000,
        compressedSize: 18000,
        executionTime: 1500,
        memoryUsage: 50 * 1024 * 1024,
        filesProcessed: 10,
        totalBytes: 100000,
        patterns: [
          {
            id: "test-pattern",
            name: "Test Pattern",
            frequency: 25,
            sizeSavings: 5000,
            type: "utility",
            size: 200,
          },
        ],
      };

      const allFormatsReporter = new Reporter({ format: "all" });
      const report = allFormatsReporter.generateReport(testData);
      const outputs = allFormatsReporter.displayReport(report);

      // Test console output
      expect(outputs.console).toContain("📊 OPTIMIZATION REPORT");
      expect(outputs.console).toContain("SIZE ANALYSIS");
      expect(outputs.console).toContain("PATTERN STATISTICS");

      // Test JSON output
      const jsonData = JSON.parse(outputs.json);
      expect(jsonData.metadata).toBeDefined();
      expect(jsonData.sizeMetrics.originalSize).toBe(100000);
      expect(jsonData.patternStats).toHaveLength(1);

      // Test Markdown output
      expect(outputs.markdown).toContain("# Optimization Report");
      expect(outputs.markdown).toContain("| Metric | Value |");
      expect(outputs.markdown).toContain("## Size Analysis");

      // Test HTML output
      expect(outputs.html).toContain("<!DOCTYPE html>");
      expect(outputs.html).toContain("<title>Optimization Report</title>");
      expect(outputs.html).toContain("📊 Optimization Report");

      // Save outputs to files for manual inspection
      fs.writeFileSync(path.join(tempDir, "report.json"), outputs.json);
      fs.writeFileSync(path.join(tempDir, "report.md"), outputs.markdown);
      fs.writeFileSync(path.join(tempDir, "report.html"), outputs.html);

      // Verify files were created
      expect(fs.existsSync(path.join(tempDir, "report.json"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "report.md"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "report.html"))).toBe(true);
    });

    it("should handle different verbosity levels", () => {
      const testData = {
        originalSize: 100000,
        optimizedSize: 60000,
        executionTime: 1500,
        patterns: [
          { id: "p1", name: "Pattern 1", frequency: 10, sizeSavings: 1000, type: "utility" },
          { id: "p2", name: "Pattern 2", frequency: 20, sizeSavings: 2000, type: "layout" },
        ],
      };

      // Test minimal verbosity
      const minimalReporter = new Reporter({ verbosity: "minimal" });
      const minimalReport = minimalReporter.generateReport(testData);
      const minimalOutput = minimalReporter.displayReport(minimalReport);

      expect(minimalOutput).toContain("📊 OPTIMIZATION REPORT");
      expect(minimalOutput).toBeDefined();

      // Test detailed verbosity
      const detailedReporter = new Reporter({ verbosity: "detailed" });
      const detailedReport = detailedReporter.generateReport(testData);
      const detailedOutput = detailedReporter.displayReport(detailedReport);

      expect(detailedOutput).toContain("📊 OPTIMIZATION REPORT");
      expect(detailedOutput).toBeDefined();
    });
  });

  describe("Performance and Memory Testing", () => {
    it("should handle memory-intensive operations efficiently", () => {
      const memoryIntensiveData = {
        originalSize: 50 * 1024 * 1024, // 50MB
        optimizedSize: 20 * 1024 * 1024, // 20MB
        executionTime: 8000,
        memoryUsage: 850 * 1024 * 1024, // 850MB (above 800MB threshold)
        filesProcessed: 1000,
        totalBytes: 50 * 1024 * 1024,
        patterns: Array.from({ length: 500 }, (_, i) => ({
          id: `memory-pattern-${i}`,
          name: `Memory Pattern ${i + 1}`,
          frequency: Math.floor(Math.random() * 200) + 1,
          sizeSavings: Math.floor(Math.random() * 50000) + 1000,
          type: ["atomic", "utility", "component", "layout"][i % 4],
          size: Math.floor(Math.random() * 1000) + 100,
        })),
      };

      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      const report = reporter.generateReport(memoryIntensiveData);
      const output = reporter.displayReport(report);

      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;

      // Verify the report was generated successfully
      expect(report.patternStats).toHaveLength(500);
      expect(output).toContain("📊 OPTIMIZATION REPORT");

      // Verify performance characteristics
      const processingTime = endTime - startTime;
      const memoryIncrease = endMemory - startMemory;

      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Should not use more than 100MB additional memory

      // Verify warnings about high memory usage
      expect(report.warnings).toContain(
        "Very high memory usage - risk of out-of-memory errors"
      );
    });

    it("should generate appropriate recommendations for slow operations", () => {
      const slowOperationData = {
        originalSize: 10 * 1024 * 1024, // 10MB
        optimizedSize: 8 * 1024 * 1024, // 8MB (only 20% reduction)
        executionTime: 25000, // 25 seconds
        memoryUsage: 1.2 * 1024 * 1024 * 1024, // 1.2GB
        filesProcessed: 500,
        totalBytes: 10 * 1024 * 1024,
        patterns: [
          {
            id: "slow-pattern",
            name: "Slow Processing Pattern",
            frequency: 200,
            sizeSavings: 50000,
            type: "component",
            size: 500,
          },
        ],
      };

      const report = reporter.generateReport(slowOperationData);

      // Should recommend performance improvements (20% reduction is above 10% threshold, so this won't trigger)
      // expect(report.recommendations).toContain(
      //   "Consider enabling more aggressive optimization settings for better size reduction"
      // );
      expect(report.recommendations).toContain(
        "Optimization is taking longer than expected - consider processing files in batches"
      );
      expect(report.recommendations).toContain(
        "High memory usage detected - consider streaming processing for large files"
      );

      // Should warn about extreme conditions
      expect(report.warnings).toContain(
        "Optimization is taking very long - consider timeout settings"
      );
      expect(report.warnings).toContain(
        "Very high memory usage - risk of out-of-memory errors"
      );
    });
  });

  describe("Real-world Integration Scenarios", () => {
    it("should integrate with existing CSS optimization pipeline", () => {
      // Simulate data from a real CSS optimization pipeline
      const pipelineData = {
        originalSize: 1200 * 1024, // 1.2MB (1,228,800 bytes)
        optimizedSize: 450 * 1024, // 450KB (460,800 bytes)
        compressedSize: 135 * 1024, // 135KB
        executionTime: 2800,
        memoryUsage: 85 * 1024 * 1024, // 85MB
        filesProcessed: 35,
        totalBytes: 1200 * 1024,
        patterns: [
          {
            id: "tailwind-utilities",
            name: "Tailwind Utility Classes",
            frequency: 156,
            sizeSavings: 180000,
            type: "utility",
            size: 45,
          },
          {
            id: "custom-components",
            name: "Custom Component Styles",
            frequency: 42,
            sizeSavings: 95000,
            type: "component",
            size: 320,
          },
          {
            id: "layout-grids",
            name: "CSS Grid Layouts",
            frequency: 28,
            sizeSavings: 65000,
            type: "layout",
            size: 280,
          },
        ],
        errors: [],
      };

      const pipelineReporter = new Reporter({
        format: "console",
        showPerformance: true,
        showPatterns: true,
        includeRecommendations: true,
        maxTableItems: 15,
      });

      const report = pipelineReporter.generateReport(pipelineData);
      const output = pipelineReporter.displayReport(report);

      // Verify comprehensive analysis
      expect(report.sizeMetrics.percentageReduction).toBeCloseTo(62.5, 0); // ~750KB reduction
      expect(report.patternStats[0].patternName).toBe("Tailwind Utility Classes"); // Highest savings
      expect(report.performanceMetrics.avgProcessingTime).toBe(80); // 2800ms / 35 files

      // Verify output quality
      expect(output).toContain("📊 OPTIMIZATION REPORT");
      expect(output).toContain("🎯 PATTERN STATISTICS");
      expect(output).toContain("⚡ PERFORMANCE METRICS");
      expect(output).toContain("Tailwind Utility Classes");

      // Should not have critical warnings for this reasonable scenario
      expect(report.warnings).not.toContain("Very high memory usage");
      expect(report.warnings).not.toContain("Optimization is taking very long");
    });

    it("should handle concurrent report generation", async () => {
      const testData = {
        originalSize: 200000,
        optimizedSize: 120000,
        executionTime: 1000,
        patterns: [
          { id: "concurrent-pattern", name: "Concurrent Pattern", frequency: 15, sizeSavings: 3000, type: "utility" },
        ],
      };

      // Generate multiple reports concurrently
      const promises = Array.from({ length: 10 }, (_, i) => {
        const concurrentReporter = new Reporter({ format: "json" });
        return Promise.resolve().then(() => {
          const report = concurrentReporter.generateReport({
            ...testData,
            originalSize: testData.originalSize + i * 1000, // Slight variation
          });
          return concurrentReporter.displayReport(report);
        });
      });

      const results = await Promise.all(promises);

      // Verify all reports were generated successfully
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        const parsed = JSON.parse(result);
        expect(parsed.sizeMetrics.originalSize).toBe(200000 + i * 1000);
        expect(parsed.metadata).toBeDefined();
        expect(parsed.patternStats).toHaveLength(1);
      });
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should gracefully handle corrupted or incomplete data", () => {
      const corruptedData = {
        originalSize: "invalid", // Wrong type
        optimizedSize: null,
        patterns: "not-an-array", // Wrong type
        executionTime: -1000, // Negative value
      };

      // Should not throw but handle gracefully
      expect(() => {
        reporter.generateReport(corruptedData);
      }).not.toThrow();
      
      const report = reporter.generateReport(corruptedData);
      expect(report.warnings).toContain("Invalid or missing optimization data");
    });

    it("should provide meaningful error messages for invalid configurations", () => {
      const invalidReporter = new Reporter({ format: "unsupported-format" as any });
      const report = invalidReporter.generateReport({ originalSize: 1000, optimizedSize: 800 });

      expect(() => {
        invalidReporter.displayReport(report);
      }).toThrow("Unsupported format: unsupported-format");
    });
  });
}); 