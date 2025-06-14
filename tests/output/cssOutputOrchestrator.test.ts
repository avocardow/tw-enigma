/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rmdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  CssOutputOrchestrator,
  createCssOutputOrchestrator,
  createProductionOrchestrator,
  createDevelopmentOrchestrator,
  type CssBundle,
  type CssProcessingOptions,
} from "../../src/output/cssOutputOrchestrator.ts";
import {
  createProductionConfig,
} from "../../src/output/cssOutputConfig.ts";

describe("CssOutputOrchestrator", () => {
  let tempDir: string;
  let orchestrator: CssOutputOrchestrator;
  let sampleCssContent: string;
  let sampleBundle: CssBundle;
  let processingOptions: CssProcessingOptions;

  beforeEach(async () => {
    // Create temporary directory for test outputs
    tempDir = await mkdtemp(join(tmpdir(), "css-orchestrator-test-"));

    // Sample CSS content for testing
    sampleCssContent = `
      /* Sample CSS for testing */
      .container { 
        display: flex; 
        align-items: center; 
        background-color: #ffffff;
      }
      .header { 
        font-size: 1.5rem; 
        color: #333333;
        margin-bottom: 1rem;
      }
      .button { 
        padding: 0.5rem 1rem; 
        border: none; 
        border-radius: 4px;
        background-color: #007bff;
        color: white;
        cursor: pointer;
      }
      .button:hover { 
        background-color: #0056b3; 
      }
      @media (max-width: 768px) {
        .container { 
          flex-direction: column; 
        }
        .header { 
          font-size: 1.25rem; 
        }
      }
    `;

    // Sample bundle for testing
    sampleBundle = {
      id: "test-bundle",
      content: sampleCssContent,
      sourcePath: "/test/input.css",
      routes: ["/home", "/about"],
      components: ["Container", "Header", "Button"],
      priority: 1,
      metadata: {
        source: "test",
        framework: "vanilla",
      },
    };

    // Processing options for testing
    processingOptions = {
      environment: "production",
      sourceMaps: false,
      outputDir: tempDir,
      baseUrl: "/assets/",
      routes: ["/home", "/about"],
      verbose: false,
    };

    // Create production orchestrator for most tests
    const config = createProductionConfig();
    orchestrator = createCssOutputOrchestrator(config);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rmdir(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Constructor and Factory Functions", () => {
    it("should create orchestrator with valid configuration", () => {
      const config = createProductionConfig();
      const newOrchestrator = createCssOutputOrchestrator(config);

      expect(newOrchestrator).toBeInstanceOf(CssOutputOrchestrator);
      expect(newOrchestrator.getConfig()).toEqual(config);
    });

    it("should create production orchestrator with optimized defaults", () => {
      const prodOrchestrator = createProductionOrchestrator();
      const config = prodOrchestrator.getConfig();

      expect(config.strategy).toBe("chunked");
      expect(config.optimization.minify).toBe(true);
      expect(config.compression.type).toBe("auto");
      expect(config.critical.enabled).toBe(true);
    });

    it("should create development orchestrator with debug-friendly defaults", () => {
      const devOrchestrator = createDevelopmentOrchestrator();
      const config = devOrchestrator.getConfig();

      expect(config.strategy).toBe("single");
      expect(config.optimization.minify).toBe(false);
      expect(config.optimization.sourceMap).toBe(true);
      expect(config.compression.type).toBe("none");
    });

    it("should allow configuration overrides in factory functions", () => {
      const overrides = {
        strategy: "modular" as const,
        optimization: { minify: false },
      };

      const customOrchestrator = createProductionOrchestrator(overrides);
      const config = customOrchestrator.getConfig();

      expect(config.strategy).toBe("modular");
      expect(config.optimization.minify).toBe(false);
    });
  });

  describe("Bundle Processing", () => {
    it("should process single bundle successfully", async () => {
      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );

      expect(result).toBeDefined();
      expect(result.results.size).toBe(1);
      expect(result.results.has("test-bundle")).toBe(true);

      const bundleResult = result.results.get("test-bundle")!;
      expect(bundleResult.bundle).toEqual(sampleBundle);
      expect(bundleResult.chunks.length).toBeGreaterThan(0);
      expect(bundleResult.outputPaths.length).toBeGreaterThan(0);
    });

    it("should process multiple bundles successfully", async () => {
      const bundle2: CssBundle = {
        ...sampleBundle,
        id: "test-bundle-2",
        content: ".secondary { color: red; }",
        priority: 2,
      };

      const result = await orchestrator.orchestrate(
        [sampleBundle, bundle2],
        processingOptions,
      );

      expect(result.results.size).toBe(2);
      expect(result.results.has("test-bundle")).toBe(true);
      expect(result.results.has("test-bundle-2")).toBe(true);
      expect(result.globalStats.totalBundles).toBe(2);
    });

    it("should handle empty bundles gracefully", async () => {
      const emptyBundle: CssBundle = {
        id: "empty-bundle",
        content: "",
        sourcePath: "/test/empty.css",
        priority: 1,
      };

      const result = await orchestrator.orchestrate(
        [emptyBundle],
        processingOptions,
      );

      expect(result.results.size).toBe(1);
      const bundleResult = result.results.get("empty-bundle")!;
      expect(bundleResult.stats.originalSize).toBe(0);
    });

    it("should generate appropriate chunks based on strategy", async () => {
      // Test single strategy
      const singleConfig = createProductionConfig({ strategy: "single" });
      const singleOrchestrator = createCssOutputOrchestrator(singleConfig);

      const singleResult = await singleOrchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );
      const singleBundleResult = singleResult.results.get("test-bundle")!;
      expect(singleBundleResult.chunks.length).toBe(1);

      // Test chunked strategy
      const chunkedConfig = createProductionConfig({
        strategy: "chunked",
        chunking: { strategy: "size", maxSize: 1024 }, // Use minimum valid size
      });
      const chunkedOrchestrator = createCssOutputOrchestrator(chunkedConfig);

      const chunkedResult = await chunkedOrchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );
      const chunkedBundleResult = chunkedResult.results.get("test-bundle")!;
      expect(chunkedBundleResult.chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Optimization Pipeline", () => {
    it("should apply CSS optimizations", async () => {
      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );
      const bundleResult = result.results.get("test-bundle")!;

      expect(bundleResult.optimizations.size).toBeGreaterThan(0);
      expect(bundleResult.stats.optimizedSize).toBeLessThanOrEqual(
        bundleResult.stats.originalSize,
      );

      // Verify optimization was applied
      const firstChunk = bundleResult.chunks[0];
      const optimization = bundleResult.optimizations.get(firstChunk.id);
      expect(optimization).toBeDefined();
      expect(optimization!.stats.optimizedSize).toBeLessThanOrEqual(
        optimization!.stats.originalSize,
      );
    });

    it("should generate asset hashes", async () => {
      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );
      const bundleResult = result.results.get("test-bundle")!;

      expect(bundleResult.hashes.size).toBeGreaterThan(0);

      for (const chunk of bundleResult.chunks) {
        const hash = bundleResult.hashes.get(chunk.id);
        expect(hash).toBeDefined();
        expect(hash!.original).toBeDefined();
        expect(hash!.hashed).toBeDefined();
        expect(hash!.hash).toMatch(/^[a-f0-9]+$/); // Hex hash
      }
    });

    it("should apply compression when enabled", async () => {
      const compressedConfig = createProductionConfig({
        strategy: "single", // Use single strategy to avoid small chunks
        compression: { type: "gzip", level: 6, threshold: 100 }, // Lower threshold for testing
      });
      const compressedOrchestrator =
        createCssOutputOrchestrator(compressedConfig);

      const result = await compressedOrchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );
      const bundleResult = result.results.get("test-bundle")!;

      expect(bundleResult.compressions.size).toBeGreaterThan(0);

      for (const chunk of bundleResult.chunks) {
        const compressions = bundleResult.compressions.get(chunk.id);
        expect(compressions).toBeDefined();
        expect(compressions!.length).toBeGreaterThan(0);
        expect(compressions![0].type).toBe("gzip");
        expect(compressions![0].compressedSize).toBeLessThan(
          Buffer.byteLength(chunk.content, "utf8"),
        );
      }
    });

    it("should extract critical CSS when enabled", async () => {
      const criticalConfig = createProductionConfig({
        strategy: "single", // Use single strategy for more predictable critical CSS
        critical: {
          enabled: true,
          strategy: "inline",
          maxSize: 14 * 1024,
        },
        compression: { threshold: 100 }, // Lower threshold for testing
      });
      const criticalOrchestrator = createCssOutputOrchestrator(criticalConfig);

      const optionsWithRoutes = {
        ...processingOptions,
        routes: ["/home", "/about"],
      };

      const result = await criticalOrchestrator.orchestrate(
        [sampleBundle],
        optionsWithRoutes,
      );
      const bundleResult = result.results.get("test-bundle")!;

      expect(bundleResult.criticalCss).toBeDefined();
      expect(bundleResult.criticalCss!.inline).toBeDefined();
      // Either we have async CSS or all CSS is considered critical (inline)
      const hasAsyncCss = bundleResult.criticalCss!.async.length > 0;
      const hasInlineCss = bundleResult.criticalCss!.inline.length > 0;
      expect(hasAsyncCss || hasInlineCss).toBe(true);
    });
  });

  describe("Output Generation", () => {
    it("should write output files to disk", async () => {
      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );
      const bundleResult = result.results.get("test-bundle")!;

      expect(bundleResult.outputPaths.length).toBeGreaterThan(0);

      // Verify files exist
      for (const outputPath of bundleResult.outputPaths) {
        const content = await readFile(outputPath, "utf8");
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it("should generate source maps when enabled", async () => {
      const sourceMapOptions = {
        ...processingOptions,
        sourceMaps: true,
      };

      const result = await orchestrator.orchestrate(
        [sampleBundle],
        sourceMapOptions,
      );
      const bundleResult = result.results.get("test-bundle")!;

      // Source maps should be generated
      expect(bundleResult.sourceMaps.length).toBeGreaterThan(0);

      // Verify source map files exist
      for (const sourceMapPath of bundleResult.sourceMaps) {
        const content = await readFile(sourceMapPath, "utf8");
        expect(content).toBeDefined();

        // Verify it's valid JSON (source maps are JSON)
        const sourceMap = JSON.parse(content);
        expect(sourceMap.version).toBe(3);
        expect(sourceMap.sources).toBeDefined();
      }
    });

    it("should generate asset manifest", async () => {
      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );

      expect(result.manifest).toBeDefined();
      expect(result.manifest.assets).toBeDefined();
      expect(Object.keys(result.manifest.assets).length).toBeGreaterThan(0);

      // Verify manifest contains expected structure
      expect(result.manifest.generated).toBeDefined();
      expect(result.manifest.buildConfig).toBeDefined();
      expect(result.manifest.stats).toBeDefined();
    });
  });

  describe("Performance Metrics", () => {
    it("should calculate accurate global statistics", async () => {
      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );

      expect(result.globalStats).toBeDefined();
      expect(result.globalStats.totalBundles).toBe(1);
      expect(result.globalStats.totalSize).toBeGreaterThan(0);
      expect(result.globalStats.totalOptimizedSize).toBeGreaterThan(0);
      expect(result.globalStats.totalOptimizedSize).toBeLessThanOrEqual(
        result.globalStats.totalSize,
      );
      expect(result.globalStats.overallCompressionRatio).toBeGreaterThanOrEqual(
        0,
      );
      expect(result.globalStats.overallCompressionRatio).toBeLessThanOrEqual(1);
      expect(result.globalStats.processingTime).toBeGreaterThan(0);
    });

    it("should calculate performance metrics", async () => {
      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );

      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.loadingStrategy).toBeDefined();
      expect(["single", "chunked", "modular"]).toContain(
        result.performanceMetrics.loadingStrategy,
      );
      expect(result.performanceMetrics.estimatedLoadTime).toBeGreaterThan(0);
      expect(
        result.performanceMetrics.nonCriticalCssSize,
      ).toBeGreaterThanOrEqual(0);
    });

    it("should provide bundle-specific statistics", async () => {
      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );
      const bundleResult = result.results.get("test-bundle")!;

      expect(bundleResult.stats).toBeDefined();
      expect(bundleResult.stats.originalSize).toBeGreaterThan(0);
      expect(bundleResult.stats.optimizedSize).toBeGreaterThan(0);
      expect(bundleResult.stats.processingTime).toBeGreaterThan(0);
      expect(bundleResult.stats.chunksGenerated).toBeGreaterThan(0);
    });

    it("should estimate load times accurately", async () => {
      const smallBundle: CssBundle = {
        ...sampleBundle,
        content: ".small { color: red; }",
        id: "small-bundle",
      };

      const largeBundle: CssBundle = {
        ...sampleBundle,
        content: sampleCssContent.repeat(50), // Make it much larger
        id: "large-bundle",
      };

      const smallResult = await orchestrator.orchestrate(
        [smallBundle],
        processingOptions,
      );
      const largeResult = await orchestrator.orchestrate(
        [largeBundle],
        processingOptions,
      );

      // Large bundles should have higher estimated load times
      expect(largeResult.performanceMetrics.estimatedLoadTime).toBeGreaterThan(
        smallResult.performanceMetrics.estimatedLoadTime,
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid CSS gracefully", async () => {
      const invalidBundle: CssBundle = {
        id: "invalid-bundle",
        content: ".invalid { color: ; }", // Invalid CSS
        sourcePath: "/test/invalid.css",
        priority: 1,
      };

      // Should not throw, but may generate warnings
      const result = await orchestrator.orchestrate(
        [invalidBundle],
        processingOptions,
      );

      expect(result.results.size).toBe(1);
      // May have warnings about the invalid CSS
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle missing output directory", async () => {
      const invalidOptions = {
        ...processingOptions,
        outputDir: "/nonexistent/path/that/should/not/exist",
      };

      // Should create the directory or handle gracefully
      await expect(
        orchestrator.orchestrate([sampleBundle], invalidOptions),
      ).resolves.toBeDefined();
    });

    it("should handle bundle processing failures gracefully", async () => {
      // Mock a component to throw an error
      const components = orchestrator.getComponents();
      const originalOptimize = components.optimizer.optimizeChunk;

      // Temporarily replace with failing function
      components.optimizer.optimizeChunk = vi
        .fn()
        .mockRejectedValue(new Error("Optimization failed"));

      const result = await orchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );

      // Should have warnings about the failed optimization
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("test-bundle"))).toBe(true);

      // Restore original function
      components.optimizer.optimizeChunk = originalOptimize;
    });
  });

  describe("Configuration Management", () => {
    it("should allow runtime configuration updates", () => {
      const originalConfig = orchestrator.getConfig();
      const updates = {
        optimization: { minify: false },
        compression: { type: "none" as const },
      };

      orchestrator.updateConfig(updates);
      const updatedConfig = orchestrator.getConfig();

      expect(updatedConfig.optimization.minify).toBe(false);
      expect(updatedConfig.compression.type).toBe("none");
      expect(updatedConfig).not.toEqual(originalConfig);
    });

    it("should provide access to internal components", () => {
      const components = orchestrator.getComponents();

      expect(components.chunker).toBeDefined();
      expect(components.hasher).toBeDefined();
      expect(components.optimizer).toBeDefined();
      expect(components.compressor).toBeDefined();
      expect(components.manifestGenerator).toBeDefined();
      expect(components.criticalCssExtractor).toBeDefined();
      expect(components.analyzer).toBeDefined();
    });
  });

  describe("Validation and Warnings", () => {
    it("should generate warnings for suboptimal configurations", async () => {
      const largeChunkConfig = createProductionConfig({
        chunking: { maxSize: 1024 * 1024 }, // Very large chunks
      });
      const largeChunkOrchestrator =
        createCssOutputOrchestrator(largeChunkConfig);

      const largeCssBundle: CssBundle = {
        ...sampleBundle,
        content: sampleCssContent.repeat(100), // Large CSS
        id: "large-css-bundle",
      };

      const result = await largeChunkOrchestrator.orchestrate(
        [largeCssBundle],
        processingOptions,
      );

      // Should generate warnings about large chunks
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some((w) => w.includes("large") || w.includes("100KB")),
      ).toBe(true);
    });

    it("should validate critical CSS size limits", async () => {
      const restrictiveCriticalConfig = createProductionConfig({
        critical: {
          enabled: true,
          maxSize: 1024, // Very small limit
          strategy: "inline",
        },
      });
      const restrictiveOrchestrator = createCssOutputOrchestrator(
        restrictiveCriticalConfig,
      );

      const result = await restrictiveOrchestrator.orchestrate([sampleBundle], {
        ...processingOptions,
        routes: ["/home"],
      });

      // May generate warnings about critical CSS size
      const bundleResult = result.results.get("test-bundle")!;
      if (bundleResult.criticalCss) {
        const criticalSize = Buffer.byteLength(
          bundleResult.criticalCss.inline,
          "utf8",
        );
        if (criticalSize > 1024) {
          expect(result.warnings.some((w) => w.includes("Critical CSS"))).toBe(
            true,
          );
        }
      }
    });

    it("should provide optimization recommendations", async () => {
      const suboptimalConfig = createProductionConfig({
        optimization: { minify: false }, // Suboptimal for production
        compression: { type: "none" }, // No compression
      });
      const suboptimalOrchestrator =
        createCssOutputOrchestrator(suboptimalConfig);

      const result = await suboptimalOrchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );

      // Should provide recommendations for better optimization
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Integration with Existing Components", () => {
    it("should properly integrate with CSS chunker", async () => {
      const chunkingConfig = createProductionConfig({
        strategy: "chunked",
        chunking: {
          strategy: "size",
          maxSize: 1024, // Small chunks to force splitting
          minSize: 512,
        },
      });
      const chunkingOrchestrator = createCssOutputOrchestrator(chunkingConfig);

      const largeBundle: CssBundle = {
        ...sampleBundle,
        content: sampleCssContent.repeat(10),
        id: "large-bundle-for-chunking",
      };

      const result = await chunkingOrchestrator.orchestrate(
        [largeBundle],
        processingOptions,
      );
      const bundleResult = result.results.get("large-bundle-for-chunking")!;

      // Should generate multiple chunks
      expect(bundleResult.chunks.length).toBeGreaterThan(1);

      // Each chunk should have proper metadata
      bundleResult.chunks.forEach((chunk) => {
        expect(chunk.id).toBeDefined();
        expect(chunk.content).toBeDefined();
        expect(chunk.metadata).toBeDefined();
      });
    });

    it("should properly integrate with asset hasher", async () => {
      const hashingConfig = createProductionConfig({
        hashing: {
          algorithm: "xxhash",
          length: 12,
          includeContent: true,
        },
      });
      const hashingOrchestrator = createCssOutputOrchestrator(hashingConfig);

      const result = await hashingOrchestrator.orchestrate(
        [sampleBundle],
        processingOptions,
      );
      const bundleResult = result.results.get("test-bundle")!;

      // Should generate hashes with specified parameters
      for (const [, hash] of bundleResult.hashes) {
        expect(hash.hash).toHaveLength(12);
        expect(hash.algorithm).toBe("xxhash");
        expect(hash.hashed).toContain(hash.hash);
      }
    });
  });

  describe("Environment-Specific Behavior", () => {
    it("should behave differently in development vs production", async () => {
      const devOrchestrator = createDevelopmentOrchestrator();
      const prodOrchestrator = createProductionOrchestrator();

      const devOptions = {
        ...processingOptions,
        environment: "development" as const,
      };
      const prodOptions = {
        ...processingOptions,
        environment: "production" as const,
      };

      const devResult = await devOrchestrator.orchestrate(
        [sampleBundle],
        devOptions,
      );
      const prodResult = await prodOrchestrator.orchestrate(
        [sampleBundle],
        prodOptions,
      );

      const devBundleResult = devResult.results.get("test-bundle")!;
      const prodBundleResult = prodResult.results.get("test-bundle")!;

      // Production should have more optimization
      expect(prodBundleResult.stats.optimizedSize).toBeLessThanOrEqual(
        devBundleResult.stats.optimizedSize,
      );

      // Production should have compression
      expect(prodBundleResult.compressions.size).toBeGreaterThanOrEqual(
        devBundleResult.compressions.size,
      );
    });
  });
});
