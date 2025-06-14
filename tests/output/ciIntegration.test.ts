/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CiIntegration,
  createCiIntegration,
} from "../../src/output/ciIntegration.ts";
import type { CssOutputConfig } from "../../src/output/cssOutputConfig.ts";
import type { CssPerformanceReport } from "../../src/output/cssReportGenerator.ts";

describe("CiIntegration", () => {
  let config: CssOutputConfig;
  let ciIntegration: CiIntegration;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };

    config = {
      strategy: "chunked",
      chunking: {
        strategy: "route",
        minSize: 10 * 1024,
        maxSize: 100 * 1024,
        targetCount: 5,
      },
      optimization: {
        minify: true,
        removeUnused: true,
        enableSourceMaps: false,
      },
      compression: {
        gzip: true,
        brotli: true,
        level: 9,
      },
      environment: "production",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("CI environment detection", () => {
    it("should detect GitHub Actions environment", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_RUN_ID = "123456";
      process.env.GITHUB_REF_NAME = "main";
      process.env.GITHUB_SHA = "abcdef123456";
      process.env.GITHUB_EVENT_NAME = "push";
      process.env.GITHUB_REPOSITORY = "owner/repo";

      const ci = new CiIntegration(config);
      const env = ci.getCiEnvironment();

      expect(env.provider).toBe("github");
      expect(env.buildId).toBe("123456");
      expect(env.branch).toBe("main");
      expect(env.commit).toBe("abcdef123456");
      expect(env.isCI).toBe(true);
      expect(env.env.GITHUB_REPOSITORY).toBe("owner/repo");
    });

    it("should detect GitHub Actions pull request", () => {
      process.env.GITHUB_ACTIONS = "true";
      process.env.GITHUB_EVENT_NAME = "pull_request";
      process.env.GITHUB_EVENT_NUMBER = "42";

      const ci = new CiIntegration(config);
      const env = ci.getCiEnvironment();

      expect(env.provider).toBe("github");
      expect(env.pullRequest).toBe("42");
    });

    it("should detect GitLab CI environment", () => {
      process.env.GITLAB_CI = "true";
      process.env.CI_PIPELINE_ID = "789012";
      process.env.CI_COMMIT_REF_NAME = "feature/test";
      process.env.CI_COMMIT_SHA = "def456789012";
      process.env.CI_MERGE_REQUEST_IID = "15";

      const ci = new CiIntegration(config);
      const env = ci.getCiEnvironment();

      expect(env.provider).toBe("gitlab");
      expect(env.buildId).toBe("789012");
      expect(env.branch).toBe("feature/test");
      expect(env.commit).toBe("def456789012");
      expect(env.pullRequest).toBe("15");
      expect(env.isCI).toBe(true);
    });

    it("should detect Jenkins environment", () => {
      process.env.JENKINS_URL = "https://jenkins.example.com";
      process.env.BUILD_NUMBER = "42";
      process.env.GIT_BRANCH = "origin/main";
      process.env.GIT_COMMIT = "abc123def456";

      const ci = new CiIntegration(config);
      const env = ci.getCiEnvironment();

      expect(env.provider).toBe("jenkins");
      expect(env.buildId).toBe("42");
      expect(env.branch).toBe("origin/main");
      expect(env.commit).toBe("abc123def456");
    });

    it("should detect CircleCI environment", () => {
      process.env.CIRCLECI = "true";
      process.env.CIRCLE_BUILD_NUM = "999";
      process.env.CIRCLE_BRANCH = "develop";
      process.env.CIRCLE_SHA1 = "circle123";
      process.env.CIRCLE_PULL_REQUEST = "https://github.com/owner/repo/pull/33";

      const ci = new CiIntegration(config);
      const env = ci.getCiEnvironment();

      expect(env.provider).toBe("circleci");
      expect(env.buildId).toBe("999");
      expect(env.branch).toBe("develop");
      expect(env.commit).toBe("circle123");
      expect(env.pullRequest).toBe("33"); // Extracted from URL
    });

    it("should detect generic CI environment", () => {
      process.env.CI = "true";
      process.env.BUILD_NUMBER = "100";

      const ci = new CiIntegration(config);
      const env = ci.getCiEnvironment();

      expect(env.provider).toBe("unknown");
      expect(env.buildId).toBe("100");
      expect(env.isCI).toBe(true);
    });

    it("should detect non-CI environment", () => {
      // Clear all CI environment variables
      Object.keys(process.env).forEach((key) => {
        if (
          key.includes("CI") ||
          key.includes("GITHUB") ||
          key.includes("GITLAB")
        ) {
          delete process.env[key];
        }
      });

      const ci = new CiIntegration(config);
      const env = ci.getCiEnvironment();

      expect(env.isCI).toBe(false);
      expect(env.provider).toBe("unknown");
    });
  });

  describe("processReport", () => {
    let mockReport: CssPerformanceReport;

    beforeEach(() => {
      mockReport = {
        metadata: {
          timestamp: "2025-01-20T12:00:00.000Z",
          version: "1.0.0",
          environment: "production",
          configHash: "abc123",
        },
        metrics: {
          totalOriginalSize: 100000,
          totalOptimizedSize: 70000,
          totalCompressedSize: 30000,
          bundleCount: 2,
          totalChunkCount: 5,
          overallCompressionRatio: 0.7,
          totalCriticalCssSize: 10000,
          averageLoadTime: 1500,
          totalOptimizationTime: 200,
          performanceScore: 85,
          bundles: [],
        },
        budgetAnalysis: {
          passed: true,
          violations: [],
          score: 100,
        },
        recommendations: [],
        configuration: config,
        assets: [],
        chunkAnalysis: [],
      };
    });

    it("should pass when performance meets thresholds", async () => {
      const ci = new CiIntegration(config, {
        minPerformanceScore: 80,
        failOnBudgetViolation: true,
      });

      const result = await ci.processReport(mockReport);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.summary).toContain("✅ Performance score: 85/100");
      expect(result.summary).toContain("✅ All performance budgets passed");
    });

    it("should fail when performance score below threshold", async () => {
      mockReport.metrics.performanceScore = 60;

      const ci = new CiIntegration(config, {
        minPerformanceScore: 70,
        failOnBudgetViolation: true,
      });

      const result = await ci.processReport(mockReport);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.summary).toContain(
        "❌ Performance score 60 below threshold 70",
      );
    });

    it("should fail when budget violations detected", async () => {
      mockReport.budgetAnalysis.passed = false;
      mockReport.budgetAnalysis.violations = [
        {
          type: "bundle_size",
          actual: 60000,
          limit: 50000,
          severity: "error",
          message: "Bundle exceeds size limit",
          recommendations: ["Optimize CSS"],
        },
      ];

      const ci = new CiIntegration(config, {
        failOnBudgetViolation: true,
      });

      const result = await ci.processReport(mockReport);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.summary).toContain("❌ 1 budget violation(s) detected");
    });

    it("should handle performance comparison with baseline", async () => {
      const baseline: CssPerformanceReport = {
        ...mockReport,
        metrics: {
          ...mockReport.metrics,
          performanceScore: 80,
          totalCompressedSize: 25000,
          averageLoadTime: 1200,
        },
      };

      // Mock file system operations
      vi.doMock("fs/promises", () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(baseline)),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      }));

      const ci = new CiIntegration(config, {
        baselinePath: "./baseline.json",
        maxSizeIncrease: 15,
      });

      const result = await ci.processReport(mockReport);

      expect(result.comparison).toBeDefined();
      expect(result.comparison?.delta.scoreChange).toBe(5); // 85 - 80
      expect(result.comparison?.delta.sizeChange).toBe(20); // ((30000 - 25000) / 25000) * 100
      expect(result.comparison?.delta.loadTimeChange).toBe(300); // 1500 - 1200
    });

    it("should fail when size increase exceeds threshold", async () => {
      const baseline: CssPerformanceReport = {
        ...mockReport,
        metrics: {
          ...mockReport.metrics,
          totalCompressedSize: 20000, // Much smaller baseline
        },
      };

      vi.doMock("fs/promises", () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(baseline)),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      }));

      const ci = new CiIntegration(config, {
        baselinePath: "./baseline.json",
        maxSizeIncrease: 10, // 10% threshold
      });

      const result = await ci.processReport(mockReport);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.summary).toContain("Size increase");
      expect(result.summary).toContain("exceeds threshold 10%");
    });

    it("should fail when major regressions detected", async () => {
      const baseline: CssPerformanceReport = {
        ...mockReport,
        metrics: {
          ...mockReport.metrics,
          performanceScore: 95, // Much higher baseline
          totalCompressedSize: 15000, // Much smaller baseline
          averageLoadTime: 500, // Much faster baseline
        },
      };

      vi.doMock("fs/promises", () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(baseline)),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      }));

      const ci = new CiIntegration(config, {
        baselinePath: "./baseline.json",
        failOnRegression: true,
      });

      const result = await ci.processReport(mockReport);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.comparison?.regressions.length).toBeGreaterThan(0);

      // Should detect score decrease regression
      const scoreRegression = result.comparison?.regressions.find(
        (r) => r.type === "score_decrease",
      );
      expect(scoreRegression).toBeDefined();
      expect(scoreRegression?.severity).toBe("minor"); // -10 points

      // Should detect size increase regression
      const sizeRegression = result.comparison?.regressions.find(
        (r) => r.type === "size_increase",
      );
      expect(sizeRegression).toBeDefined();
      expect(sizeRegression?.severity).toBe("major"); // 100% increase
    });
  });

  describe("regression detection", () => {
    it("should detect performance score regression", async () => {
      const current: CssPerformanceReport = {
        metadata: {
          timestamp: "",
          version: "",
          environment: "",
          configHash: "",
        },
        metrics: {
          performanceScore: 70,
          totalOriginalSize: 0,
          totalOptimizedSize: 0,
          totalCompressedSize: 0,
          bundleCount: 0,
          totalChunkCount: 0,
          overallCompressionRatio: 0,
          totalCriticalCssSize: 0,
          averageLoadTime: 0,
          totalOptimizationTime: 0,
          bundles: [],
        },
        budgetAnalysis: { passed: true, violations: [], score: 100 },
        recommendations: [],
        configuration: config,
        assets: [],
        chunkAnalysis: [],
      };

      const baseline: CssPerformanceReport = {
        ...current,
        metrics: { ...current.metrics, performanceScore: 90 },
      };

      vi.doMock("fs/promises", () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(baseline)),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      }));

      const ci = new CiIntegration(config, {
        baselinePath: "./baseline.json",
      });

      const result = await ci.processReport(current);

      const scoreRegression = result.comparison?.regressions.find(
        (r) => r.type === "score_decrease",
      );
      expect(scoreRegression).toBeDefined();
      expect(scoreRegression?.current).toBe(70);
      expect(scoreRegression?.previous).toBe(90);
      expect(scoreRegression?.changePercent).toBe(-20);
      expect(scoreRegression?.severity).toBe("major"); // -20 points
    });

    it("should detect size increase regression", async () => {
      const current: CssPerformanceReport = {
        metadata: {
          timestamp: "",
          version: "",
          environment: "",
          configHash: "",
        },
        metrics: {
          totalCompressedSize: 50000,
          performanceScore: 0,
          totalOriginalSize: 0,
          totalOptimizedSize: 0,
          bundleCount: 0,
          totalChunkCount: 0,
          overallCompressionRatio: 0,
          totalCriticalCssSize: 0,
          averageLoadTime: 0,
          totalOptimizationTime: 0,
          bundles: [],
        },
        budgetAnalysis: { passed: true, violations: [], score: 100 },
        recommendations: [],
        configuration: config,
        assets: [],
        chunkAnalysis: [],
      };

      const baseline: CssPerformanceReport = {
        ...current,
        metrics: { ...current.metrics, totalCompressedSize: 40000 },
      };

      vi.doMock("fs/promises", () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(baseline)),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      }));

      const ci = new CiIntegration(config, {
        baselinePath: "./baseline.json",
      });

      const result = await ci.processReport(current);

      const sizeRegression = result.comparison?.regressions.find(
        (r) => r.type === "size_increase",
      );
      expect(sizeRegression).toBeDefined();
      expect(sizeRegression?.current).toBe(50000);
      expect(sizeRegression?.previous).toBe(40000);
      expect(sizeRegression?.changePercent).toBe(25); // 25% increase
      expect(sizeRegression?.severity).toBe("major"); // >20%
    });

    it("should detect load time regression", async () => {
      const current: CssPerformanceReport = {
        metadata: {
          timestamp: "",
          version: "",
          environment: "",
          configHash: "",
        },
        metrics: {
          averageLoadTime: 3000,
          performanceScore: 0,
          totalOriginalSize: 0,
          totalOptimizedSize: 0,
          bundleCount: 0,
          totalChunkCount: 0,
          overallCompressionRatio: 0,
          totalCriticalCssSize: 0,
          totalCompressedSize: 0,
          totalOptimizationTime: 0,
          bundles: [],
        },
        budgetAnalysis: { passed: true, violations: [], score: 100 },
        recommendations: [],
        configuration: config,
        assets: [],
        chunkAnalysis: [],
      };

      const baseline: CssPerformanceReport = {
        ...current,
        metrics: { ...current.metrics, averageLoadTime: 1500 },
      };

      vi.doMock("fs/promises", () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(baseline)),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      }));

      const ci = new CiIntegration(config, {
        baselinePath: "./baseline.json",
      });

      const result = await ci.processReport(current);

      const loadTimeRegression = result.comparison?.regressions.find(
        (r) => r.type === "load_time_increase",
      );
      expect(loadTimeRegression).toBeDefined();
      expect(loadTimeRegression?.current).toBe(3000);
      expect(loadTimeRegression?.previous).toBe(1500);
      expect(loadTimeRegression?.changePercent).toBe(100); // 100% increase
      expect(loadTimeRegression?.severity).toBe("major"); // >2000ms increase
    });
  });

  describe("improvement detection", () => {
    it("should detect performance improvements", async () => {
      const current: CssPerformanceReport = {
        metadata: {
          timestamp: "",
          version: "",
          environment: "",
          configHash: "",
        },
        metrics: {
          performanceScore: 90,
          totalCompressedSize: 20000,
          averageLoadTime: 800,
          overallCompressionRatio: 0.5,
          totalOriginalSize: 0,
          totalOptimizedSize: 0,
          bundleCount: 0,
          totalChunkCount: 0,
          totalCriticalCssSize: 0,
          totalOptimizationTime: 0,
          bundles: [],
        },
        budgetAnalysis: { passed: true, violations: [], score: 100 },
        recommendations: [],
        configuration: config,
        assets: [],
        chunkAnalysis: [],
      };

      const baseline: CssPerformanceReport = {
        ...current,
        metrics: {
          ...current.metrics,
          performanceScore: 80,
          totalCompressedSize: 25000,
          averageLoadTime: 1200,
          overallCompressionRatio: 0.7,
        },
      };

      vi.doMock("fs/promises", () => ({
        readFile: vi.fn().mockResolvedValue(JSON.stringify(baseline)),
        writeFile: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      }));

      const ci = new CiIntegration(config, {
        baselinePath: "./baseline.json",
      });

      const result = await ci.processReport(current);

      expect(result.comparison?.improvements.length).toBeGreaterThan(0);

      // Should detect score improvement
      const scoreImprovement = result.comparison?.improvements.find(
        (i) => i.type === "score_increase",
      );
      expect(scoreImprovement).toBeDefined();
      expect(scoreImprovement?.improvementPercent).toBe(10);

      // Should detect size reduction
      const sizeImprovement = result.comparison?.improvements.find(
        (i) => i.type === "size_reduction",
      );
      expect(sizeImprovement).toBeDefined();
      expect(sizeImprovement?.improvementPercent).toBe(20);

      // Should detect load time improvement
      const loadTimeImprovement = result.comparison?.improvements.find(
        (i) => i.type === "load_time_improvement",
      );
      expect(loadTimeImprovement).toBeDefined();

      // Should detect compression improvement
      const compressionImprovement = result.comparison?.improvements.find(
        (i) => i.type === "compression_improvement",
      );
      expect(compressionImprovement).toBeDefined();
    });
  });

  describe("createCiIntegration", () => {
    it("should create CI integration with default options", () => {
      const ci = createCiIntegration(config);
      expect(ci).toBeInstanceOf(CiIntegration);
    });

    it("should create CI integration with custom options", () => {
      const options = {
        failOnBudgetViolation: false,
        minPerformanceScore: 90,
        maxSizeIncrease: 5,
      };

      const ci = createCiIntegration(config, options);
      expect(ci).toBeInstanceOf(CiIntegration);
    });
  });

  describe("webhook notifications", () => {
    it("should send webhook notification on success", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const ci = new CiIntegration(config, {
        webhookUrl: "https://webhook.example.com/css-performance",
      });

      const mockReport: CssPerformanceReport = {
        metadata: {
          timestamp: "",
          version: "",
          environment: "",
          configHash: "",
        },
        metrics: {
          performanceScore: 85,
          totalCompressedSize: 30000,
          totalOriginalSize: 0,
          totalOptimizedSize: 0,
          bundleCount: 0,
          totalChunkCount: 0,
          overallCompressionRatio: 0,
          totalCriticalCssSize: 0,
          averageLoadTime: 0,
          totalOptimizationTime: 0,
          bundles: [],
        },
        budgetAnalysis: { passed: true, violations: [], score: 100 },
        recommendations: [],
        configuration: config,
        assets: [],
        chunkAnalysis: [],
      };

      await ci.processReport(mockReport);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://webhook.example.com/css-performance",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"performanceScore":85'),
        }),
      );
    });
  });
});
