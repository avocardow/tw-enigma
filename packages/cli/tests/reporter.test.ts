/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Reporter from "../src/reporter.js";

describe("Reporter", () => {
  let reporter: Reporter;
  let mockData: any;

  beforeEach(() => {
    reporter = new Reporter();
    mockData = {
      originalSize: 100000,
      optimizedSize: 60000,
      compressedSize: 18000,
      executionTime: 1500,
      memoryUsage: 50 * 1024 * 1024, // 50MB
      filesProcessed: 10,
      totalBytes: 100000,
      patterns: [
        {
          id: "pattern1",
          name: "Flex Layout Pattern",
          frequency: 25,
          sizeSavings: 5000,
          type: "layout",
          size: 200,
        },
        {
          id: "pattern2",
          name: "Button Utility",
          frequency: 50,
          sizeSavings: 8000,
          type: "utility",
          size: 160,
        },
        {
          id: "pattern3",
          name: "Card Component",
          frequency: 15,
          sizeSavings: 3000,
          type: "component",
          size: 300,
        },
      ],
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor and Configuration", () => {
    it("should create reporter with default configuration", () => {
      const defaultReporter = new Reporter();
      
      expect(defaultReporter.config.format).toBe("console");
      expect(defaultReporter.config.verbosity).toBe("summary");
      expect(defaultReporter.config.colors).toBe(true);
      expect(defaultReporter.config.showPerformance).toBe(true);
      expect(defaultReporter.config.showPatterns).toBe(true);
      expect(defaultReporter.config.showSizeAnalysis).toBe(true);
      expect(defaultReporter.config.maxTableItems).toBe(10);
      expect(defaultReporter.config.includeRecommendations).toBe(true);
    });

    it("should merge custom configuration with defaults", () => {
      const customConfig = {
        format: "json" as const,
        colors: false,
        maxTableItems: 5,
      };
      
      const customReporter = new Reporter(customConfig);
      
      expect(customReporter.config.format).toBe("json");
      expect(customReporter.config.colors).toBe(false);
      expect(customReporter.config.maxTableItems).toBe(5);
      expect(customReporter.config.verbosity).toBe("summary"); // Should keep default
    });

    it("should initialize with empty reports array", () => {
      expect(reporter.getReports()).toEqual([]);
    });

    it("should track start time", () => {
      const beforeTime = Date.now();
      const newReporter = new Reporter();
      const afterTime = Date.now();
      
      const stats = newReporter.getStats();
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.uptime).toBeLessThan(afterTime - beforeTime + 100); // Allow some margin
    });
  });

  describe("Size Calculations", () => {
    it("should calculate size reductions correctly", () => {
      const result = reporter.calculateSizeReductions(100000, 60000, 18000);
      
      expect(result.originalSize).toBe(100000);
      expect(result.optimizedSize).toBe(60000);
      expect(result.compressedSize).toBe(18000);
      expect(result.sizeReduction).toBe(40000);
      expect(result.percentageReduction).toBe(40);
      expect(result.compressionRatio).toBe(0.6);
    });

    it("should handle zero original size", () => {
      const result = reporter.calculateSizeReductions(0, 0);
      
      expect(result.percentageReduction).toBe(0);
      expect(result.compressionRatio).toBe(1);
    });

    it("should estimate compressed size when not provided", () => {
      const result = reporter.calculateSizeReductions(100000, 60000);
      
      expect(result.compressedSize).toBe(18000); // 60000 * 0.3
    });

    it("should calculate compression metrics", () => {
      const result = reporter.calculateCompressionMetrics(100000, 30000);
      
      expect(result.compressionRatio).toBe(0.3);
      expect(result.compressionSavings).toBe(70000);
      expect(result.compressionPercentage).toBe(70);
      expect(result.estimatedGzipSize).toBe(30000); // 100000 * 0.3
      expect(result.estimatedBrotliSize).toBe(25000); // 100000 * 0.25
    });

    it("should calculate optimization savings from file data", () => {
      const fileData = {
        files: [
          { originalSize: 50000, optimizedSize: 30000 },
          { originalSize: 40000, optimizedSize: 25000 },
          { originalSize: 30000, optimizedSize: 20000 },
        ],
      };
      
      const result = reporter.calculateOptimizationSavings(fileData);
      
      expect(result.totalSavings).toBe(45000); // 20000 + 15000 + 10000
      expect(result.averageSavings).toBeCloseTo(15000, 1);
      expect(result.maxSavings).toBe(20000);
      expect(result.minSavings).toBe(10000);
      expect(result.filesOptimized).toBe(3);
    });

    it("should handle missing file data gracefully", () => {
      const result = reporter.calculateOptimizationSavings({});
      
      expect(result.totalSavings).toBe(0);
      expect(result.averageSavings).toBe(0);
      expect(result.maxSavings).toBe(0);
      expect(result.minSavings).toBe(0);
    });
  });

  describe("Pattern Statistics", () => {
    it("should generate pattern statistics correctly", () => {
      const patterns = reporter.generatePatternStats(mockData);
      
      expect(patterns).toHaveLength(3);
      expect(patterns[0].patternName).toBe("Button Utility"); // Highest savings first
      expect(patterns[0].sizeSavings).toBe(8000);
      expect(patterns[1].patternName).toBe("Flex Layout Pattern");
      expect(patterns[2].patternName).toBe("Card Component");
    });

    it("should calculate pattern efficiency", () => {
      const pattern = {
        frequency: 50,
        sizeSavings: 8000,
        size: 160,
      };
      
      const efficiency = reporter.calculatePatternEfficiency(pattern);
      
      // Efficiency = (8000/50) / 160 = 160 / 160 = 1.0
      expect(efficiency).toBe(1.0);
    });

    it("should handle zero frequency patterns", () => {
      const pattern = {
        frequency: 0,
        sizeSavings: 1000,
        size: 100,
      };
      
      const efficiency = reporter.calculatePatternEfficiency(pattern);
      expect(efficiency).toBe(0);
    });

    it("should cap efficiency at 1.0", () => {
      const pattern = {
        frequency: 10,
        sizeSavings: 10000,
        size: 50,
      };
      
      const efficiency = reporter.calculatePatternEfficiency(pattern);
      expect(efficiency).toBe(1.0); // Should be capped at 1.0
    });

    it("should generate pattern breakdown by type", () => {
      const patterns = reporter.generatePatternStats(mockData);
      const breakdown = reporter.generatePatternBreakdown(patterns);
      
      expect(breakdown.utility.count).toBe(1);
      expect(breakdown.utility.totalSavings).toBe(8000);
      expect(breakdown.layout.count).toBe(1);
      expect(breakdown.layout.totalSavings).toBe(5000);
      expect(breakdown.component.count).toBe(1);
      expect(breakdown.component.totalSavings).toBe(3000);
      expect(breakdown.atomic.count).toBe(0);
    });

    it("should handle missing pattern data", () => {
      const patterns = reporter.generatePatternStats({});
      expect(patterns).toEqual([]);
    });
  });

  describe("Performance Metrics", () => {
    it("should calculate performance metrics correctly", () => {
      const metrics = reporter.calculatePerformanceMetrics(mockData);
      
      expect(metrics.executionTime).toBe(1500);
      expect(metrics.memoryUsage).toBe(50 * 1024 * 1024);
      expect(metrics.filesProcessed).toBe(10);
      expect(metrics.throughput).toBeCloseTo(66666.67, 1); // (100000 / 1500) * 1000
      expect(metrics.avgProcessingTime).toBe(150); // 1500 / 10
    });

    it("should handle zero execution time", () => {
      const data = { ...mockData, executionTime: 0 };
      const metrics = reporter.calculatePerformanceMetrics(data);
      
      expect(metrics.throughput).toBe(0);
    });

    it("should handle zero files processed", () => {
      const data = { ...mockData, filesProcessed: 0 };
      const metrics = reporter.calculatePerformanceMetrics(data);
      
      expect(metrics.avgProcessingTime).toBe(0);
    });

    it("should use process memory when not provided", () => {
      const data = { ...mockData };
      delete data.memoryUsage;
      
      const metrics = reporter.calculatePerformanceMetrics(data);
      
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe("Report Generation", () => {
    it("should generate a complete optimization report", () => {
      const report = reporter.generateReport(mockData);
      
      expect(report.metadata).toBeDefined();
      expect(report.metadata.timestamp).toBeDefined();
      expect(report.metadata.version).toBe("1.0.0");
      expect(report.metadata.environment).toBeDefined();
      
      expect(report.sizeMetrics).toBeDefined();
      expect(report.sizeMetrics.originalSize).toBe(100000);
      expect(report.sizeMetrics.optimizedSize).toBe(60000);
      
      expect(report.patternStats).toHaveLength(3);
      expect(report.performanceMetrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.warnings).toBeDefined();
    });

    it("should store generated reports", () => {
      const report1 = reporter.generateReport(mockData);
      const report2 = reporter.generateReport(mockData);
      
      const reports = reporter.getReports();
      expect(reports).toHaveLength(2);
      expect(reports[0]).toBe(report1);
      expect(reports[1]).toBe(report2);
    });

    it("should handle errors during report generation", () => {
      const invalidData = null;
      
      expect(() => {
        reporter.generateReport(invalidData);
      }).toThrow("Failed to generate report");
    });
  });

  describe("Recommendations and Warnings", () => {
    it("should generate size-based recommendations", () => {
      const lowReductionData = {
        ...mockData,
        optimizedSize: 95000, // Only 5% reduction
      };
      
      const recommendations = reporter.generateRecommendations(lowReductionData);
      
      expect(recommendations).toContain(
        "Consider enabling more aggressive optimization settings for better size reduction"
      );
    });

    it("should generate performance-based recommendations", () => {
      const slowData = {
        ...mockData,
        executionTime: 15000, // 15 seconds
        memoryUsage: 600 * 1024 * 1024, // 600MB
      };
      
      const recommendations = reporter.generateRecommendations(slowData);
      
      expect(recommendations).toContain(
        "Optimization is taking longer than expected - consider processing files in batches"
      );
      expect(recommendations).toContain(
        "High memory usage detected - consider streaming processing for large files"
      );
    });

    it("should generate pattern-based recommendations", () => {
      const lowEfficiencyData = {
        ...mockData,
        patterns: [
          {
            id: "pattern1",
            name: "Low Efficiency Pattern",
            frequency: 100,
            sizeSavings: 100,
            type: "utility",
            size: 1000, // Very low efficiency
          },
          {
            id: "pattern2",
            name: "High Frequency Pattern",
            frequency: 150, // Very high frequency
            sizeSavings: 5000,
            type: "utility",
            size: 100,
          },
        ],
      };
      
      const recommendations = reporter.generateRecommendations(lowEfficiencyData);
      
      expect(recommendations.some(rec => rec.includes("low efficiency"))).toBe(true);
      expect(recommendations.some(rec => rec.includes("very frequently"))).toBe(true);
    });

    it("should generate size-based warnings", () => {
      const negativeReductionData = {
        ...mockData,
        optimizedSize: 110000, // Larger than original
      };
      
      const warnings = reporter.generateWarnings(negativeReductionData);
      
      expect(warnings).toContain(
        "Optimization resulted in larger file size - check configuration"
      );
    });

    it("should generate performance warnings", () => {
      const extremeData = {
        ...mockData,
        executionTime: 35000, // 35 seconds
        memoryUsage: 1.5 * 1024 * 1024 * 1024, // 1.5GB
      };
      
      const warnings = reporter.generateWarnings(extremeData);
      
      expect(warnings).toContain(
        "Optimization is taking very long - consider timeout settings"
      );
      expect(warnings).toContain(
        "Very high memory usage - risk of out-of-memory errors"
      );
    });

    it("should generate data validation warnings", () => {
      const invalidData = null;
      const warnings = reporter.generateWarnings(invalidData);
      
      expect(warnings).toContain("Invalid or missing optimization data");
    });

    it("should warn about errors in data", () => {
      const errorData = {
        ...mockData,
        errors: ["Error 1", "Error 2", "Error 3"],
      };
      
      const warnings = reporter.generateWarnings(errorData);
      
      expect(warnings).toContain("3 errors occurred during optimization");
    });
  });

  describe("Utility Functions", () => {
    it("should format bytes correctly", () => {
      expect(reporter.formatBytes(0)).toBe("0 B");
      expect(reporter.formatBytes(1024)).toBe("1 KB");
      expect(reporter.formatBytes(1536)).toBe("1.5 KB");
      expect(reporter.formatBytes(1024 * 1024)).toBe("1 MB");
      expect(reporter.formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
      expect(reporter.formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("should format percentages correctly", () => {
      expect(reporter.formatPercentage(0.1234)).toBe("12.3%");
      expect(reporter.formatPercentage(0.5)).toBe("50.0%");
      expect(reporter.formatPercentage(1.0)).toBe("100.0%");
    });

    it("should format duration correctly", () => {
      expect(reporter.formatDuration(500)).toBe("500ms");
      expect(reporter.formatDuration(1500)).toBe("1.5s");
      expect(reporter.formatDuration(65000)).toBe("1.1m");
    });
  });

  describe("Report Display", () => {
    let report: any;

    beforeEach(() => {
      report = reporter.generateReport(mockData);
    });

    it("should display console report", () => {
      const output = reporter.displayReport(report);
      
      expect(output).toContain("📊 OPTIMIZATION REPORT");
      expect(output).toContain("Generated:");
      expect(output).toContain("SIZE ANALYSIS");
      expect(output).toContain("PATTERN STATISTICS");
      expect(output).toContain("PERFORMANCE METRICS");
    });

    it("should display JSON report", () => {
      const jsonReporter = new Reporter({ format: "json" });
      const jsonReport = jsonReporter.generateReport(mockData);
      const output = jsonReporter.displayReport(jsonReport);
      
      const parsed = JSON.parse(output);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.sizeMetrics).toBeDefined();
      expect(parsed.patternStats).toBeDefined();
    });

    it("should display Markdown report", () => {
      const mdReporter = new Reporter({ format: "markdown" });
      const mdReport = mdReporter.generateReport(mockData);
      const output = mdReporter.displayReport(mdReport);
      
      expect(output).toContain("# Optimization Report");
      expect(output).toContain("## Size Analysis");
      expect(output).toContain("## Pattern Statistics");
      expect(output).toContain("## Performance Metrics");
      expect(output).toContain("| Metric | Value |");
    });

    it("should display HTML report", () => {
      const htmlReporter = new Reporter({ format: "html" });
      const htmlReport = htmlReporter.generateReport(mockData);
      const output = htmlReporter.displayReport(htmlReport);
      
      expect(output).toContain("<!DOCTYPE html>");
      expect(output).toContain("<title>Optimization Report</title>");
      expect(output).toContain("📊 Optimization Report");
      expect(output).toContain("<table class=\"table\">");
    });

    it("should display all formats when format is 'all'", () => {
      const allReporter = new Reporter({ format: "all" });
      const allReport = allReporter.generateReport(mockData);
      const output = allReporter.displayReport(allReport);
      
      expect(output).toHaveProperty("console");
      expect(output).toHaveProperty("json");
      expect(output).toHaveProperty("markdown");
      expect(output).toHaveProperty("html");
      
      expect(output.console).toContain("📊 OPTIMIZATION REPORT");
      expect(output.markdown).toContain("# Optimization Report");
      expect(output.html).toContain("<!DOCTYPE html>");
    });

    it("should throw error for unsupported format", () => {
      const invalidReporter = new Reporter({ format: "invalid" as any });
      const invalidReport = invalidReporter.generateReport(mockData);
      
      expect(() => {
        invalidReporter.displayReport(invalidReport);
      }).toThrow("Unsupported format: invalid");
    });
  });

  describe("Reporter Management", () => {
    it("should clear all reports", () => {
      reporter.generateReport(mockData);
      reporter.generateReport(mockData);
      
      expect(reporter.getReports()).toHaveLength(2);
      
      reporter.clearReports();
      
      expect(reporter.getReports()).toHaveLength(0);
    });

    it("should provide reporter statistics", async () => {
      reporter.generateReport(mockData);
      reporter.generateReport(mockData);
      
      // Small delay to ensure uptime is measurable
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const stats = reporter.getStats();
      
      expect(stats.reportsGenerated).toBe(2);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.config).toEqual(reporter.config);
    });

    it("should not mutate original reports array", () => {
      reporter.generateReport(mockData);
      
      const reports = reporter.getReports();
      reports.push({} as any);
      
      expect(reporter.getReports()).toHaveLength(1);
    });
  });

  describe("Configuration Edge Cases", () => {
    it("should handle disabled colors", () => {
      const noColorReporter = new Reporter({ colors: false });
      const report = noColorReporter.generateReport(mockData);
      const output = noColorReporter.displayReport(report);
      
      // Should not contain ANSI color codes
      const ansiRegex = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m');
      expect(output).not.toMatch(ansiRegex);
    });

    it("should respect maxTableItems setting", () => {
      const limitedReporter = new Reporter({ maxTableItems: 2 });
      const manyPatternsData = {
        ...mockData,
        patterns: [
          ...mockData.patterns,
          { id: "pattern4", name: "Pattern 4", frequency: 10, sizeSavings: 1000, type: "utility" },
          { id: "pattern5", name: "Pattern 5", frequency: 5, sizeSavings: 500, type: "atomic" },
        ],
      };
      
      const report = limitedReporter.generateReport(manyPatternsData);
      const output = limitedReporter.displayReport(report);
      
      expect(output).toContain("Showing top 2 of 5 patterns");
    });

    it("should handle compact table style", () => {
      const compactReporter = new Reporter({
        tableStyle: { head: ["cyan"], border: ["grey"], compact: true },
      });
      
      const report = compactReporter.generateReport(mockData);
      const output = compactReporter.displayReport(report);
      
      expect(output).toBeDefined();
      expect(output).toContain("📊 OPTIMIZATION REPORT");
    });
  });
}); 