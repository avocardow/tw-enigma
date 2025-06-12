/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, mkdtemp, rmdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  ProductionCssConfigManager,
  parseCliArgs,
  validatePerformanceBudget,
  applyDeploymentPreset,
  validateProductionConfig,
  type CliArgs,
  type PerformanceBudget,
  type DeploymentPreset,
  createProductionConfig,
  createDevelopmentConfig,
} from "../../src/output/cssOutputConfig.js";

describe("ProductionCssConfigManager", () => {
  let tempDir: string;
  let configManager: ProductionCssConfigManager;
  let sampleCliArgs: CliArgs;
  let sampleBudget: PerformanceBudget;

  beforeEach(async () => {
    // Create temporary directory for test configs
    tempDir = await mkdtemp(join(tmpdir(), "css-config-test-"));

    // Sample CLI arguments for testing
    sampleCliArgs = {
      environment: "production",
      preset: "cdn",
      minify: true,
      compress: "gzip",
      sourceMap: false,
      chunks: "auto",
      "critical-css": true,
      "performance-budget": "100KB",
      output: tempDir,
      verbose: false,
      "asset-hash": true,
      "hash-length": 8,
    };

    // Sample performance budget
    sampleBudget = {
      maxBundleSize: 100 * 1024, // 100KB
      maxCriticalCssSize: 14 * 1024, // 14KB
      maxChunkSize: 50 * 1024, // 50KB
      maxTotalSize: 500 * 1024, // 500KB
      maxChunks: 10,
      estimatedLoadTime: 2000, // 2 seconds
    };

    // Create config manager
    configManager = new ProductionCssConfigManager();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rmdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("CLI Arguments Parsing", () => {
    it("should parse basic CLI arguments correctly", () => {
      const args = [
        "--environment=production",
        "--preset=cdn",
        "--minify=true",
        "--compress=gzip",
        "--output=/tmp/output",
      ];

      const parsed = parseCliArgs(args);

      expect(parsed.environment).toBe("production");
      expect(parsed.preset).toBe("cdn");
      expect(parsed.minify).toBe(true);
      expect(parsed.compress).toBe("gzip");
      expect(parsed.output).toBe("/tmp/output");
    });

    it("should handle boolean flags correctly", () => {
      const trueFlagArgs = [
        "--minify",
        "--critical-css",
        "--asset-hash",
        "--source-map",
      ];

      const falseFlagArgs = [
        "--no-minify",
        "--no-critical-css",
        "--no-asset-hash",
        "--no-source-map",
      ];

      const trueParsed = parseCliArgs(trueFlagArgs);
      expect(trueParsed.minify).toBe(true);
      expect(trueParsed["critical-css"]).toBe(true);
      expect(trueParsed["asset-hash"]).toBe(true);
      expect(trueParsed.sourceMap).toBe(true);

      const falseParsed = parseCliArgs(falseFlagArgs);
      expect(falseParsed.minify).toBe(false);
      expect(falseParsed["critical-css"]).toBe(false);
      expect(falseParsed["asset-hash"]).toBe(false);
      expect(falseParsed.sourceMap).toBe(false);
    });

    it("should parse performance budget arguments", () => {
      const args = [
        "--performance-budget=250KB",
        "--max-critical-css=14KB",
        "--max-chunk-size=75KB",
        "--max-chunks=15",
      ];

      const parsed = parseCliArgs(args);

      expect(parsed["performance-budget"]).toBe("250KB");
      expect(parsed["max-critical-css"]).toBe("14KB");
      expect(parsed["max-chunk-size"]).toBe("75KB");
      expect(parsed["max-chunks"]).toBe("15");
    });

    it("should provide default values for missing arguments", () => {
      const emptyArgs: string[] = [];
      const parsed = parseCliArgs(emptyArgs);

      expect(parsed.environment).toBe("production");
      expect(parsed.minify).toBe(true);
      expect(parsed.compress).toBe("auto");
      expect(parsed.chunks).toBe("auto");
      expect(parsed["critical-css"]).toBe(true);
      expect(parsed["asset-hash"]).toBe(true);
    });

    it("should handle invalid arguments gracefully", () => {
      const invalidArgs = [
        "--environment=invalid",
        "--compress=unknown",
        "--chunks=badvalue",
        "--hash-length=not-a-number",
      ];

      // Should not throw, but may provide warnings or defaults
      expect(() => parseCliArgs(invalidArgs)).not.toThrow();
    });
  });

  describe("Performance Budget Validation", () => {
    it("should validate valid performance budgets", () => {
      const validBudget: PerformanceBudget = {
        maxBundleSize: 100 * 1024,
        maxCriticalCssSize: 14 * 1024,
        maxChunkSize: 50 * 1024,
        maxTotalSize: 500 * 1024,
        maxChunks: 10,
        estimatedLoadTime: 2000,
      };

      const result = validatePerformanceBudget(validBudget);
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it("should detect excessive budget limits", () => {
      const excessiveBudget: PerformanceBudget = {
        maxBundleSize: 5 * 1024 * 1024, // 5MB - too large
        maxCriticalCssSize: 100 * 1024, // 100KB - too large for critical CSS
        maxChunkSize: 2 * 1024 * 1024, // 2MB - too large
        maxTotalSize: 20 * 1024 * 1024, // 20MB - excessive
        maxChunks: 100, // Too many chunks
        estimatedLoadTime: 30000, // 30 seconds - way too slow
      };

      const result = validatePerformanceBudget(excessiveBudget);
      expect(result.isValid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect inconsistent budget relationships", () => {
      const inconsistentBudget: PerformanceBudget = {
        maxBundleSize: 50 * 1024, // 50KB
        maxChunkSize: 100 * 1024, // 100KB - larger than max bundle
        maxTotalSize: 25 * 1024, // 25KB - smaller than max bundle
        maxCriticalCssSize: 14 * 1024,
        maxChunks: 5,
        estimatedLoadTime: 1000,
      };

      const result = validatePerformanceBudget(inconsistentBudget);
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.includes("chunk size") && e.includes("bundle size"),
        ),
      ).toBe(true);
      expect(
        result.errors.some(
          (e) => e.includes("total size") && e.includes("bundle size"),
        ),
      ).toBe(true);
    });

    it("should provide helpful error messages", () => {
      const invalidBudget: PerformanceBudget = {
        maxBundleSize: -1, // Negative value
        maxCriticalCssSize: 0, // Zero value
        maxChunkSize: 50 * 1024,
        maxTotalSize: 100 * 1024,
        maxChunks: 0, // No chunks allowed
        estimatedLoadTime: -500, // Negative time
      };

      const result = validatePerformanceBudget(invalidBudget);
      expect(result.errors.some((e) => e.includes("positive"))).toBe(true);
      expect(result.errors.some((e) => e.includes("maxChunks"))).toBe(true);
    });
  });

  describe("Deployment Presets", () => {
    it("should apply CDN preset correctly", () => {
      const baseConfig = createProductionConfig();
      const cdnConfig = applyDeploymentPreset(baseConfig, "cdn");

      expect(cdnConfig.hashing.includeContent).toBe(true);
      expect(cdnConfig.hashing.length).toBeGreaterThanOrEqual(8);
      expect(cdnConfig.compression.type).toBe("auto");
      expect(cdnConfig.criticalCss.enabled).toBe(true);
      expect(cdnConfig.optimization.minify).toBe(true);
    });

    it("should apply serverless preset correctly", () => {
      const baseConfig = createProductionConfig();
      const serverlessConfig = applyDeploymentPreset(baseConfig, "serverless");

      expect(serverlessConfig.strategy).toBe("single");
      expect(serverlessConfig.compression.type).not.toBe("none");
      expect(serverlessConfig.optimization.minify).toBe(true);
      expect(serverlessConfig.criticalCss.enabled).toBe(true);
    });

    it("should apply SPA preset correctly", () => {
      const baseConfig = createProductionConfig();
      const spaConfig = applyDeploymentPreset(baseConfig, "spa");

      expect(spaConfig.strategy).toBe("chunked");
      expect(spaConfig.criticalCss.enabled).toBe(true);
      expect(spaConfig.criticalCss.strategy).toBe("inline");
      expect(spaConfig.hashing.includeContent).toBe(true);
    });

    it("should apply SSR preset correctly", () => {
      const baseConfig = createProductionConfig();
      const ssrConfig = applyDeploymentPreset(baseConfig, "ssr");

      expect(ssrConfig.criticalCss.enabled).toBe(true);
      expect(ssrConfig.criticalCss.strategy).toBe("extract");
      expect(ssrConfig.strategy).toBe("modular");
      expect(ssrConfig.optimization.removeUnused).toBe(true);
    });

    it("should preserve custom configurations when applying presets", () => {
      const customConfig = createProductionConfig({
        optimization: {
          minify: false, // Custom setting
          removeUnused: false,
        },
        hashing: { length: 16 }, // Custom hash length
      });

      const presetConfig = applyDeploymentPreset(customConfig, "cdn");

      // Preset should not override explicitly set custom values
      expect(presetConfig.optimization.minify).toBe(false);
      expect(presetConfig.hashing.length).toBe(16);
    });
  });

  describe("Configuration Generation from CLI", () => {
    it("should generate production config from CLI args", () => {
      const config = configManager.fromCliArgs(sampleCliArgs);

      expect(config.strategy).toBeDefined();
      expect(config.optimization.minify).toBe(sampleCliArgs.minify);
      expect(config.compression.type).toBe(sampleCliArgs.compress);
      expect(config.criticalCss.enabled).toBe(sampleCliArgs["critical-css"]);
      expect(config.hashing.includeContent).toBe(sampleCliArgs["asset-hash"]);
      expect(config.hashing.length).toBe(sampleCliArgs["hash-length"]);
    });

    it("should apply performance budget from CLI args", () => {
      const argsWithBudget = {
        ...sampleCliArgs,
        "performance-budget": "150KB",
        "max-critical-css": "16KB",
        "max-chunk-size": "60KB",
      };

      const config = configManager.fromCliArgs(argsWithBudget);

      expect(config.performanceBudget).toBeDefined();
      expect(config.performanceBudget!.maxBundleSize).toBe(150 * 1024);
      expect(config.performanceBudget!.maxCriticalCssSize).toBe(16 * 1024);
      expect(config.performanceBudget!.maxChunkSize).toBe(60 * 1024);
    });

    it("should apply deployment preset from CLI args", () => {
      const argsWithPreset = {
        ...sampleCliArgs,
        preset: "serverless" as const,
      };

      const config = configManager.fromCliArgs(argsWithPreset);

      // Should have serverless-specific optimizations
      expect(config.strategy).toBe("single");
      expect(config.compression.type).not.toBe("none");
    });

    it("should handle environment-specific defaults", () => {
      const devArgs = {
        ...sampleCliArgs,
        environment: "development" as const,
      };

      const prodArgs = {
        ...sampleCliArgs,
        environment: "production" as const,
      };

      const devConfig = configManager.fromCliArgs(devArgs);
      const prodConfig = configManager.fromCliArgs(prodArgs);

      // Development should be less aggressive with optimizations
      expect(devConfig.optimization.minify).toBe(false);
      expect(devConfig.compression.type).toBe("none");
      expect(devConfig.optimization.sourceMap).toBe(true);

      // Production should be fully optimized
      expect(prodConfig.optimization.minify).toBe(true);
      expect(prodConfig.compression.type).not.toBe("none");
    });
  });

  describe("Configuration Validation", () => {
    it("should validate correct production configurations", () => {
      const validConfig = createProductionConfig();
      const result = validateProductionConfig(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should detect missing required configuration", () => {
      const incompleteConfig = createProductionConfig();
      delete (incompleteConfig as any).strategy;
      delete (incompleteConfig as any).optimization;

      const result = validateProductionConfig(incompleteConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("strategy"))).toBe(true);
      expect(result.errors.some((e) => e.includes("optimization"))).toBe(true);
    });

    it("should detect conflicting configuration options", () => {
      const conflictingConfig = createProductionConfig({
        strategy: "single", // Single file strategy
        chunking: {
          strategy: "size",
          maxSize: 50 * 1024, // But with chunking config
        },
      });

      const result = validateProductionConfig(conflictingConfig);

      expect(
        result.warnings.some(
          (w) => w.includes("single") && w.includes("chunking"),
        ),
      ).toBe(true);
    });

    it("should validate performance budget consistency", () => {
      const configWithBadBudget = createProductionConfig({
        performanceBudget: {
          maxBundleSize: 50 * 1024,
          maxChunkSize: 100 * 1024, // Larger than bundle size
          maxTotalSize: 25 * 1024, // Smaller than bundle size
          maxCriticalCssSize: 14 * 1024,
          maxChunks: 5,
          estimatedLoadTime: 1000,
        },
      });

      const result = validateProductionConfig(configWithBadBudget);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Performance Budget Calculation", () => {
    it("should calculate performance budget from string values", () => {
      const budget = configManager.calculatePerformanceBudget({
        "performance-budget": "200KB",
        "max-critical-css": "18KB",
        "max-chunk-size": "80KB",
        "max-total-size": "1MB",
        "max-chunks": "12",
        "max-load-time": "2.5s",
      });

      expect(budget.maxBundleSize).toBe(200 * 1024);
      expect(budget.maxCriticalCssSize).toBe(18 * 1024);
      expect(budget.maxChunkSize).toBe(80 * 1024);
      expect(budget.maxTotalSize).toBe(1024 * 1024);
      expect(budget.maxChunks).toBe(12);
      expect(budget.estimatedLoadTime).toBe(2500);
    });

    it("should handle different unit formats", () => {
      const budget = configManager.calculatePerformanceBudget({
        "performance-budget": "0.5MB",
        "max-critical-css": "16384B",
        "max-chunk-size": "64kb",
        "max-total-size": "2048KB",
      });

      expect(budget.maxBundleSize).toBe(0.5 * 1024 * 1024);
      expect(budget.maxCriticalCssSize).toBe(16384);
      expect(budget.maxChunkSize).toBe(64 * 1024);
      expect(budget.maxTotalSize).toBe(2048 * 1024);
    });

    it("should provide reasonable defaults for missing values", () => {
      const budget = configManager.calculatePerformanceBudget({
        "performance-budget": "100KB",
        // Other values missing
      });

      expect(budget.maxBundleSize).toBe(100 * 1024);
      expect(budget.maxCriticalCssSize).toBeGreaterThan(0);
      expect(budget.maxChunkSize).toBeGreaterThan(0);
      expect(budget.maxTotalSize).toBeGreaterThan(budget.maxBundleSize);
      expect(budget.maxChunks).toBeGreaterThan(0);
      expect(budget.estimatedLoadTime).toBeGreaterThan(0);
    });

    it("should handle invalid size formats gracefully", () => {
      const budget = configManager.calculatePerformanceBudget({
        "performance-budget": "invalid-size",
        "max-critical-css": "16KB",
        "max-chunk-size": "not-a-number",
        "max-chunks": "five",
      });

      // Should provide defaults for invalid values
      expect(budget.maxBundleSize).toBeGreaterThan(0);
      expect(budget.maxCriticalCssSize).toBe(16 * 1024);
      expect(budget.maxChunkSize).toBeGreaterThan(0);
      expect(budget.maxChunks).toBeGreaterThan(0);
    });
  });

  describe("Configuration Documentation Generation", () => {
    it("should generate configuration documentation", () => {
      const docs = configManager.generateConfigDocumentation();

      expect(docs).toBeDefined();
      expect(docs.length).toBeGreaterThan(0);
      expect(docs).toContain("CSS Output Configuration");
      expect(docs).toContain("CLI Arguments");
      expect(docs).toContain("Performance Budget");
      expect(docs).toContain("Deployment Presets");
    });

    it("should include examples in documentation", () => {
      const docs = configManager.generateConfigDocumentation();

      expect(docs).toContain("--environment=production");
      expect(docs).toContain("--preset=cdn");
      expect(docs).toContain("--performance-budget=100KB");
      expect(docs).toContain("example");
    });

    it("should document all deployment presets", () => {
      const docs = configManager.generateConfigDocumentation();

      expect(docs).toContain("cdn");
      expect(docs).toContain("serverless");
      expect(docs).toContain("spa");
      expect(docs).toContain("ssr");
    });
  });

  describe("Integration with CI/CD", () => {
    it("should detect CI environment correctly", () => {
      // Mock CI environment variables
      process.env.CI = "true";
      process.env.GITHUB_ACTIONS = "true";

      const isCI = configManager.detectCIEnvironment();

      expect(isCI.isCI).toBe(true);
      expect(isCI.provider).toBe("github-actions");

      // Clean up
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
    });

    it("should provide CI-optimized configurations", () => {
      const ciConfig = configManager.createCIConfiguration({
        environment: "production",
        preset: "cdn",
      });

      expect(ciConfig.optimization.minify).toBe(true);
      expect(ciConfig.compression.type).not.toBe("none");
      expect(ciConfig.hashing.includeContent).toBe(true);
      expect(ciConfig.performanceBudget).toBeDefined();
    });

    it("should validate configuration for CI environments", () => {
      const ciConfig = configManager.createCIConfiguration({
        environment: "production",
        preset: "serverless",
        "performance-budget": "50KB",
      });

      const result = validateProductionConfig(ciConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle malformed CLI arguments gracefully", () => {
      const malformedArgs = [
        "--environment", // Missing value
        "--minify=maybe", // Invalid boolean
        "--performance-budget", // Missing value
        "--unknown-flag=value", // Unknown flag
      ];

      expect(() => parseCliArgs(malformedArgs)).not.toThrow();
      const parsed = parseCliArgs(malformedArgs);

      // Should provide sensible defaults
      expect(parsed.environment).toBeDefined();
      expect(typeof parsed.minify).toBe("boolean");
    });

    it("should provide helpful error messages for invalid configurations", () => {
      const invalidConfig = createProductionConfig({
        strategy: "invalid-strategy" as any,
        compression: { type: "unknown-compression" as any },
        hashing: { length: -5 }, // Invalid hash length
      });

      const result = validateProductionConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("strategy"))).toBe(true);
      expect(result.errors.some((e) => e.includes("compression"))).toBe(true);
      expect(result.errors.some((e) => e.includes("hash length"))).toBe(true);
    });

    it("should suggest corrections for common mistakes", () => {
      const configWithTypos = {
        strategy: "chunk", // Should be 'chunked'
        optimization: { minfy: true }, // Should be 'minify'
        compression: { typ: "gzip" }, // Should be 'type'
      };

      const result = validateProductionConfig(configWithTypos as any);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some((s) => s.includes("chunked"))).toBe(true);
      expect(result.suggestions.some((s) => s.includes("minify"))).toBe(true);
    });
  });

  describe("Configuration Serialization", () => {
    it("should serialize configuration to JSON correctly", () => {
      const config = createProductionConfig();
      const serialized = configManager.serializeConfig(config);

      expect(() => JSON.parse(serialized)).not.toThrow();
      const parsed = JSON.parse(serialized);

      expect(parsed.strategy).toBe(config.strategy);
      expect(parsed.optimization.minify).toBe(config.optimization.minify);
    });

    it("should deserialize configuration from JSON correctly", () => {
      const originalConfig = createProductionConfig({
        strategy: "modular",
        optimization: { minify: false },
      });

      const serialized = configManager.serializeConfig(originalConfig);
      const deserialized = configManager.deserializeConfig(serialized);

      expect(deserialized.strategy).toBe("modular");
      expect(deserialized.optimization.minify).toBe(false);
    });

    it("should handle serialization of complex nested objects", () => {
      const complexConfig = createProductionConfig({
        performanceBudget: sampleBudget,
        chunking: {
          strategy: "route",
          routes: ["/home", "/about", "/contact"],
        },
      });

      const serialized = configManager.serializeConfig(complexConfig);
      const deserialized = configManager.deserializeConfig(serialized);

      expect(deserialized.performanceBudget).toEqual(sampleBudget);
      expect(deserialized.chunking?.routes).toEqual([
        "/home",
        "/about",
        "/contact",
      ]);
    });
  });
});
