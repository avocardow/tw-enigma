/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CssOutputConfigManager,
  createProductionConfig,
  createDevelopmentConfig,
  validateCssOutputConfig,
  mergeCssOutputConfig,
  CssOutputConfig,
  OutputStrategy,
  ChunkingStrategy,
  CompressionType,
  HashAlgorithm,
  DeliveryMethod,
  ConfigPreset,
} from "../../src/output/cssOutputConfig.ts";

// =============================================================================
// TEST DATA AND FIXTURES
// =============================================================================

const validCompleteConfig: CssOutputConfig = {
  strategy: "chunked",
  chunking: {
    strategy: "hybrid",
    maxChunkSize: 50000,
    minChunkSize: 10000,
    targetChunks: 3,
    enableTreeShaking: true,
    preserveComments: false,
    splitVendor: true,
    splitCritical: true,
    routeBased: true,
    componentBased: true,
  },
  optimization: {
    minify: true,
    removeComments: true,
    mergeDuplicates: true,
    normalizeColors: true,
    optimizeCalc: true,
    removeEmpty: true,
    sourceMap: false,
  },
  compression: {
    type: "auto",
    level: 6,
    threshold: 1024,
    includeBrotli: true,
    includeGzip: true,
  },
  hashing: {
    algorithm: "xxhash",
    length: 8,
    includeContent: true,
    includeMetadata: false,
    generateIntegrity: true,
    integrityAlgorithm: "sha384",
  },
  critical: {
    enabled: true,
    inlineThreshold: 4096,
    extractionMethod: "automatic",
    viewports: [{ width: 1200, height: 800 }],
    timeout: 30000,
    routes: ["/", "/dashboard"],
    components: ["Header", "Navigation"],
    fallback: true,
  },
  delivery: {
    method: "preload",
    priority: "high",
    crossorigin: "anonymous",
    integrity: true,
    cache: {
      strategy: "immutable",
      maxAge: 31536000,
      staleWhileRevalidate: 86400,
    },
    resourceHints: {
      preload: true,
      prefetch: false,
      preconnect: true,
    },
  },
  paths: {
    css: "dist/css",
    assets: "dist/assets",
    manifest: "dist/manifest.json",
    reports: "dist/reports",
  },
  reporting: {
    enabled: true,
    sizeAnalysis: true,
    performance: true,
    compression: true,
    criticalAnalysis: true,
    dependencyGraphs: false,
    format: "json",
    perChunkAnalysis: true,
    budgets: {},
  },
};

const minimalValidConfig: CssOutputConfig = {
  strategy: "single",
  chunking: {
    strategy: "size",
    maxChunkSize: 100000,
    minChunkSize: 5000,
    targetChunks: 1,
    enableTreeShaking: false,
    preserveComments: true,
    splitVendor: false,
    splitCritical: false,
    routeBased: false,
    componentBased: false,
  },
  optimization: {
    minify: false,
    removeComments: false,
    mergeDuplicates: false,
    normalizeColors: false,
    optimizeCalc: false,
    removeEmpty: false,
    sourceMap: true,
  },
  compression: {
    type: "none",
    level: 1,
    threshold: 10240,
    includeBrotli: false,
    includeGzip: false,
  },
  hashing: {
    algorithm: "md5",
    length: 8,
    includeContent: true,
    includeMetadata: false,
    generateIntegrity: false,
    integrityAlgorithm: "sha256",
  },
  critical: {
    enabled: false,
    inlineThreshold: 2048,
    extractionMethod: "manual",
    viewports: [{ width: 768, height: 1024 }],
    timeout: 10000,
    routes: [],
    components: [],
    fallback: false,
  },
  delivery: {
    method: "standard",
    priority: "low",
    crossorigin: "use-credentials",
    integrity: false,
    cache: {
      strategy: "no-cache",
      maxAge: 0,
      staleWhileRevalidate: 0,
    },
    resourceHints: {
      preload: false,
      prefetch: false,
      preconnect: false,
    },
  },
  paths: {
    css: "build/css",
    assets: "build/assets",
    manifest: "build/manifest.json",
    reports: "build/reports",
  },
  reporting: {
    enabled: false,
    sizeAnalysis: false,
    performance: false,
    compression: false,
    criticalAnalysis: false,
    dependencyGraphs: false,
    format: "json",
    perChunkAnalysis: false,
    budgets: {},
  },
};

// =============================================================================
// SCHEMA VALIDATION TESTS
// =============================================================================

describe("Schema Validation", () => {
  describe("OutputStrategy validation", () => {
    it("should accept valid output strategies", () => {
      const validStrategies: OutputStrategy[] = [
        "single",
        "chunked",
        "modular",
      ];

      for (const strategy of validStrategies) {
        expect(() => {
          validateCssOutputConfig({ ...validCompleteConfig, strategy });
        }).not.toThrow();
      }
    });

    it("should reject invalid output strategies", () => {
      expect(() => {
        validateCssOutputConfig({
          ...validCompleteConfig,
          strategy: "invalid" as any,
        });
      }).toThrow();
    });
  });

  describe("ChunkingStrategy validation", () => {
    it("should accept valid chunking strategies", () => {
      const validStrategies: ChunkingStrategy[] = [
        "size",
        "usage",
        "route",
        "component",
        "hybrid",
      ];

      for (const strategy of validStrategies) {
        const config = {
          ...validCompleteConfig,
          chunking: { ...validCompleteConfig.chunking, strategy },
        };

        expect(() => validateCssOutputConfig(config)).not.toThrow();
      }
    });

    it("should reject invalid chunking strategies", () => {
      const config = {
        ...validCompleteConfig,
        chunking: {
          ...validCompleteConfig.chunking,
          strategy: "invalid" as any,
        },
      };

      expect(() => validateCssOutputConfig(config)).toThrow();
    });
  });

  describe("CompressionType validation", () => {
    it("should accept valid compression types", () => {
      const validTypes: CompressionType[] = ["none", "gzip", "brotli", "auto"];

      for (const type of validTypes) {
        const config = {
          ...validCompleteConfig,
          compression: { ...validCompleteConfig.compression, type },
        };

        expect(() => validateCssOutputConfig(config)).not.toThrow();
      }
    });

    it("should validate compression level ranges", () => {
      // Valid levels
      for (const level of [1, 6, 9]) {
        const config = {
          ...validCompleteConfig,
          compression: { ...validCompleteConfig.compression, level },
        };

        expect(() => validateCssOutputConfig(config)).not.toThrow();
      }

      // Invalid levels
      for (const level of [-1, 0, 15]) {
        const config = {
          ...validCompleteConfig,
          compression: { ...validCompleteConfig.compression, level },
        };

        expect(() => validateCssOutputConfig(config)).toThrow();
      }
    });
  });

  describe("HashAlgorithm validation", () => {
    it("should accept valid hash algorithms", () => {
      const validAlgorithms: HashAlgorithm[] = [
        "md5",
        "sha1",
        "sha256",
        "xxhash",
      ];

      for (const algorithm of validAlgorithms) {
        const config = {
          ...validCompleteConfig,
          hashing: { ...validCompleteConfig.hashing, algorithm },
        };

        expect(() => validateCssOutputConfig(config)).not.toThrow();
      }
    });

    it("should validate hash length ranges", () => {
      // Valid lengths
      for (const length of [4, 8, 16, 32]) {
        const config = {
          ...validCompleteConfig,
          hashing: { ...validCompleteConfig.hashing, length },
        };

        expect(() => validateCssOutputConfig(config)).not.toThrow();
      }

      // Invalid lengths
      for (const length of [3, 33, 64]) {
        const config = {
          ...validCompleteConfig,
          hashing: { ...validCompleteConfig.hashing, length },
        };

        expect(() => validateCssOutputConfig(config)).toThrow();
      }
    });
  });

  describe("DeliveryMethod validation", () => {
    it("should accept valid delivery methods", () => {
      const validMethods: DeliveryMethod[] = [
        "standard",
        "preload",
        "prefetch",
        "async",
      ];

      for (const method of validMethods) {
        const config = {
          ...validCompleteConfig,
          delivery: { ...validCompleteConfig.delivery, method },
        };

        expect(() => validateCssOutputConfig(config)).not.toThrow();
      }
    });
  });

  describe("Numeric range validation", () => {
    it("should validate chunk size ranges", () => {
      // Valid sizes
      const validConfig = {
        ...validCompleteConfig,
        chunking: {
          ...validCompleteConfig.chunking,
          maxChunkSize: 100000,
          minChunkSize: 10000,
        },
      };

      expect(() => validateCssOutputConfig(validConfig)).not.toThrow();

      // Invalid: min > max
      const invalidConfig = {
        ...validCompleteConfig,
        chunking: {
          ...validCompleteConfig.chunking,
          maxChunkSize: 10000,
          minChunkSize: 50000,
        },
      };

      expect(() => validateCssOutputConfig(invalidConfig)).toThrow();
    });

    it("should validate target chunks range", () => {
      // Valid target
      const config = {
        ...validCompleteConfig,
        chunking: { ...validCompleteConfig.chunking, targetChunks: 5 },
      };

      expect(() => validateCssOutputConfig(config)).not.toThrow();

      // Invalid target (too low)
      const invalidConfig = {
        ...validCompleteConfig,
        chunking: { ...validCompleteConfig.chunking, targetChunks: 0 },
      };

      expect(() => validateCssOutputConfig(invalidConfig)).toThrow();
    });
  });

  describe("Complex validation scenarios", () => {
    it("should validate complete valid configuration", () => {
      expect(() => validateCssOutputConfig(validCompleteConfig)).not.toThrow();
    });

    it("should validate minimal valid configuration", () => {
      expect(() => validateCssOutputConfig(minimalValidConfig)).not.toThrow();
    });

    it("should reject configuration with missing required fields", () => {
      const invalidConfig = { ...validCompleteConfig };
      delete (invalidConfig as any).strategy;

      expect(() => validateCssOutputConfig(invalidConfig)).toThrow();
    });

    it("should apply default values for optional fields", () => {
      const partialConfig = {
        strategy: "single" as OutputStrategy,
        paths: {
          css: "dist/css",
          assets: "dist/assets",
          manifest: "dist/manifest.json",
          reports: "dist/reports",
        },
      };

      const validated = validateCssOutputConfig(partialConfig);

      expect(validated.chunking).toBeDefined();
      expect(validated.optimization).toBeDefined();
      expect(validated.compression).toBeDefined();
      expect(validated.hashing).toBeDefined();
      expect(validated.critical).toBeDefined();
      expect(validated.delivery).toBeDefined();
    });
  });
});

// =============================================================================
// CONFIGURATION PRESETS TESTS
// =============================================================================

describe("Configuration Presets", () => {
  describe("createProductionConfig", () => {
    it("should create optimized production configuration", () => {
      const config = createProductionConfig();

      expect(config.strategy).toBe("chunked");
      expect(config.optimization.minify).toBe(true);
      expect(config.compression.type).toBe("auto");
      expect(config.hashing.generateIntegrity).toBe(true);
      expect(config.critical.enabled).toBe(true);
      expect(config.delivery.method).toBe("preload");
    });

    it("should allow overrides of production defaults", () => {
      const overrides = {
        strategy: "single" as OutputStrategy,
        optimization: { minify: false },
      };

      const config = createProductionConfig(overrides);

      expect(config.strategy).toBe("single");
      expect(config.optimization.minify).toBe(false);

      // Other production defaults should remain
      expect(config.compression.type).toBe("auto");
      expect(config.hashing.generateIntegrity).toBe(true);
    });

    it("should pass validation", () => {
      const config = createProductionConfig();
      expect(() => validateCssOutputConfig(config)).not.toThrow();
    });
  });

  describe("createDevelopmentConfig", () => {
    it("should create development-friendly configuration", () => {
      const config = createDevelopmentConfig();

      expect(config.strategy).toBe("single");
      expect(config.optimization.minify).toBe(false);
      expect(config.optimization.sourceMap).toBe(true);
      expect(config.compression.type).toBe("none");
      expect(config.hashing.generateIntegrity).toBe(false);
      expect(config.critical.enabled).toBe(false);
    });

    it("should allow overrides of development defaults", () => {
      const overrides = {
        optimization: { minify: true, sourceMap: false },
      };

      const config = createDevelopmentConfig(overrides);

      expect(config.optimization.minify).toBe(true);
      expect(config.optimization.sourceMap).toBe(false);

      // Other development defaults should remain
      expect(config.strategy).toBe("single");
      expect(config.compression.type).toBe("none");
    });

    it("should pass validation", () => {
      const config = createDevelopmentConfig();
      expect(() => validateCssOutputConfig(config)).not.toThrow();
    });
  });

  describe("preset differences", () => {
    it("should have different optimization strategies", () => {
      const prodConfig = createProductionConfig();
      const devConfig = createDevelopmentConfig();

      expect(prodConfig.optimization.minify).toBe(true);
      expect(devConfig.optimization.minify).toBe(false);

      expect(prodConfig.optimization.sourceMap).toBe(false);
      expect(devConfig.optimization.sourceMap).toBe(true);
    });

    it("should have different delivery strategies", () => {
      const prodConfig = createProductionConfig();
      const devConfig = createDevelopmentConfig();

      expect(prodConfig.delivery.method).toBe("preload");
      expect(devConfig.delivery.method).toBe("standard");

      expect(prodConfig.delivery.cache.strategy).toBe("immutable");
      expect(devConfig.delivery.cache.strategy).toBe("no-cache");
    });
  });
});

// =============================================================================
// CONFIGURATION MERGING TESTS
// =============================================================================

describe("Configuration Merging", () => {
  describe("mergeCssOutputConfig", () => {
    it("should merge shallow properties", () => {
      const base = createDevelopmentConfig();
      const override = { strategy: "chunked" as OutputStrategy };

      const merged = mergeCssOutputConfig(base, override);

      expect(merged.strategy).toBe("chunked");
      expect(merged.optimization.minify).toBe(false); // From base
    });

    it("should merge nested properties", () => {
      const base = createDevelopmentConfig();
      const override = {
        optimization: { minify: true },
        compression: { type: "gzip" as CompressionType },
      };

      const merged = mergeCssOutputConfig(base, override);

      expect(merged.optimization.minify).toBe(true);
      expect(merged.optimization.sourceMap).toBe(true); // From base
      expect(merged.compression.type).toBe("gzip");
      expect(merged.compression.level).toBe(base.compression.level); // From base
    });

    it("should handle deep nested merging", () => {
      const base = createProductionConfig();
      const override = {
        delivery: {
          cache: { maxAge: 86400 },
        },
      };

      const merged = mergeCssOutputConfig(base, override);

      expect(merged.delivery.cache.maxAge).toBe(86400);
      expect(merged.delivery.cache.strategy).toBe(base.delivery.cache.strategy);
      expect(merged.delivery.method).toBe(base.delivery.method);
    });

    it("should handle array properties correctly", () => {
      const base = createProductionConfig();
      const override = {
        critical: {
          routes: ["/custom", "/page"],
          viewports: [{ width: 1920, height: 1080 }],
        },
      };

      const merged = mergeCssOutputConfig(base, override);

      expect(merged.critical.routes).toEqual(["/custom", "/page"]);
      expect(merged.critical.viewports).toEqual([
        { width: 1920, height: 1080 },
      ]);
      expect(merged.critical.enabled).toBe(base.critical.enabled);
    });

    it("should not mutate original configurations", () => {
      const base = createDevelopmentConfig();
      const baseOptimizationMinify = base.optimization.minify;

      const override = { optimization: { minify: true } };

      mergeCssOutputConfig(base, override);

      expect(base.optimization.minify).toBe(baseOptimizationMinify);
    });
  });
});

// =============================================================================
// CONFIGURATION MANAGER TESTS
// =============================================================================

describe("CssOutputConfigManager", () => {
  let manager: CssOutputConfigManager;

  beforeEach(() => {
    manager = new CssOutputConfigManager();
  });

  describe("constructor", () => {
    it("should create configuration manager", () => {
      expect(manager).toBeInstanceOf(CssOutputConfigManager);
    });

    it("should accept custom search paths", () => {
      const customManager = new CssOutputConfigManager({
        searchPlaces: ["custom.config.js", ".customrc.json"],
      });

      expect(customManager).toBeInstanceOf(CssOutputConfigManager);
    });
  });

  describe("loadConfig", () => {
    it("should load and validate configuration", async () => {
      // Mock cosmiconfig to return a valid config
      const mockConfig = createProductionConfig();
      const mockSearchFn = vi.fn().mockResolvedValue({
        config: mockConfig,
        filepath: "/test/config.js",
      });

      const mockExplorer = { search: mockSearchFn };
      const manager = new CssOutputConfigManager({}, mockExplorer);

      const result = await manager.loadConfig();

      expect(result.config).toBeDefined();
      expect(result.filepath).toBeDefined();
      expect(result.config.strategy).toBe(mockConfig.strategy);
    });

    it("should return default config when no config file found", async () => {
      const mockSearchFn = vi.fn().mockResolvedValue(null);
      const mockExplorer = { search: mockSearchFn };
      const manager = new CssOutputConfigManager({}, mockExplorer);

      const result = await manager.loadConfig();

      expect(result.config).toBeDefined();
      expect(result.filepath).toBeUndefined();
      expect(result.config.strategy).toBe("single"); // Default
    });

    it("should handle configuration errors gracefully", async () => {
      const mockSearchFn = vi.fn().mockRejectedValue(new Error("Config error"));
      const mockExplorer = { search: mockSearchFn };
      const manager = new CssOutputConfigManager({}, mockExplorer);

      await expect(manager.loadConfig()).rejects.toThrow("Config error");
    });

    it("should validate loaded configuration", async () => {
      const invalidConfig = { strategy: "invalid" };
      const mockSearchFn = vi.fn().mockResolvedValue({
        config: invalidConfig,
        filepath: "/test/config.js",
      });
      const mockExplorer = { search: mockSearchFn };
      const manager = new CssOutputConfigManager({}, mockExplorer);

      await expect(manager.loadConfig()).rejects.toThrow();
    });
  });

  describe("loadConfigFromPath", () => {
    it("should load configuration from specific path", async () => {
      const mockConfig = createDevelopmentConfig();
      const mockLoadFn = vi.fn().mockResolvedValue({
        config: mockConfig,
        filepath: "/custom/path/config.js",
      });

      const mockExplorer = { load: mockLoadFn };
      const manager = new CssOutputConfigManager({}, mockExplorer);

      const result = await manager.loadConfigFromPath("/custom/path/config.js");

      expect(result.config).toBeDefined();
      expect(result.filepath).toBe("/custom/path/config.js");
    });

    it("should handle file not found", async () => {
      const mockLoadFn = vi.fn().mockResolvedValue(null);
      const mockExplorer = { load: mockLoadFn };
      const manager = new CssOutputConfigManager({}, mockExplorer);

      await expect(
        manager.loadConfigFromPath("/nonexistent/config.js"),
      ).rejects.toThrow("Configuration file not found");
    });
  });

  describe("validateAndNormalize", () => {
    it("should validate and normalize valid configuration", () => {
      const config = {
        strategy: "chunked" as OutputStrategy,
        optimization: { minify: true },
      };

      const normalized = manager.validateAndNormalize(config);

      expect(normalized.strategy).toBe("chunked");
      expect(normalized.optimization.minify).toBe(true);
      expect(normalized.chunking).toBeDefined(); // Should be filled with defaults
    });

    it("should reject invalid configuration", () => {
      const invalidConfig = { strategy: "invalid" };

      expect(() => manager.validateAndNormalize(invalidConfig)).toThrow();
    });

    it("should normalize configuration with defaults", () => {
      const partialConfig = { strategy: "single" as OutputStrategy };

      const normalized = manager.validateAndNormalize(partialConfig);

      expect(normalized.chunking).toBeDefined();
      expect(normalized.optimization).toBeDefined();
      expect(normalized.compression).toBeDefined();
      expect(normalized.hashing).toBeDefined();
      expect(normalized.critical).toBeDefined();
      expect(normalized.delivery).toBeDefined();
      expect(normalized.paths).toBeDefined();
    });
  });

  describe("applyPreset", () => {
    it("should apply production preset", () => {
      const config = manager.applyPreset("production");

      expect(config.strategy).toBe("chunked");
      expect(config.optimization.minify).toBe(true);
      expect(config.compression.type).toBe("auto");
    });

    it("should apply development preset", () => {
      const config = manager.applyPreset("development");

      expect(config.strategy).toBe("single");
      expect(config.optimization.minify).toBe(false);
      expect(config.optimization.sourceMap).toBe(true);
    });

    it("should apply preset with overrides", () => {
      const config = manager.applyPreset("production", {
        strategy: "single",
        optimization: { sourceMap: true },
      });

      expect(config.strategy).toBe("single");
      expect(config.optimization.sourceMap).toBe(true);
      expect(config.optimization.minify).toBe(true); // From preset
    });

    it("should reject invalid presets", () => {
      expect(() => {
        manager.applyPreset("invalid" as ConfigPreset);
      }).toThrow();
    });
  });

  describe("caching", () => {
    it("should cache loaded configurations", async () => {
      const mockConfig = createProductionConfig();
      const mockSearchFn = vi.fn().mockResolvedValue({
        config: mockConfig,
        filepath: "/test/config.js",
      });

      const mockExplorer = { search: mockSearchFn };
      const manager = new CssOutputConfigManager({}, mockExplorer);

      // Load twice
      await manager.loadConfig();
      await manager.loadConfig();

      // Should only call search once due to caching
      expect(mockSearchFn).toHaveBeenCalledTimes(1);
    });

    it("should clear cache when requested", async () => {
      const mockConfig = createProductionConfig();
      const mockSearchFn = vi.fn().mockResolvedValue({
        config: mockConfig,
        filepath: "/test/config.js",
      });
      const mockClearCaches = vi.fn();

      const mockExplorer = { search: mockSearchFn, clearCaches: mockClearCaches };
      const manager = new CssOutputConfigManager({}, mockExplorer);

      await manager.loadConfig();
      manager.clearCache();
      await manager.loadConfig();

      // Should call search twice after cache clear
      expect(mockSearchFn).toHaveBeenCalledTimes(2);
      expect(mockClearCaches).toHaveBeenCalledTimes(1);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("Integration Tests", () => {
  it("should create complete configuration flow", async () => {
    const manager = new CssOutputConfigManager();

    // Start with development preset
    const devConfig = manager.applyPreset("development");
    expect(devConfig.optimization.minify).toBe(false);

    // Override for production-like settings
    const productionOverrides = {
      optimization: { minify: true, sourceMap: false },
      compression: { type: "gzip" as CompressionType },
    };

    const mergedConfig = mergeCssOutputConfig(devConfig, productionOverrides);

    // Validate the final configuration
    const finalConfig = manager.validateAndNormalize(mergedConfig);

    expect(finalConfig.optimization.minify).toBe(true);
    expect(finalConfig.optimization.sourceMap).toBe(false);
    expect(finalConfig.compression.type).toBe("gzip");
    expect(finalConfig.strategy).toBe("single"); // From dev preset
  });

  it("should handle complex configuration scenarios", () => {
    const manager = new CssOutputConfigManager();

    // Start with production preset
    const baseConfig = manager.applyPreset("production");

    // Apply multiple layers of overrides
    const teamDefaults = {
      chunking: { targetChunks: 5, enableTreeShaking: false },
      delivery: { cache: { maxAge: 604800 } },
    };

    const projectSpecific = {
      critical: { routes: ["/app", "/dashboard"] },
      paths: { css: "public/assets/css" },
    };

    const environmentSpecific = {
      hashing: { length: 12 },
      compression: { level: 9 },
    };

    // Merge all configurations
    let finalConfig = mergeCssOutputConfig(baseConfig, teamDefaults);
    finalConfig = mergeCssOutputConfig(finalConfig, projectSpecific);
    finalConfig = mergeCssOutputConfig(finalConfig, environmentSpecific);

    // Validate final result
    const validated = manager.validateAndNormalize(finalConfig);

    expect(validated.chunking.targetChunks).toBe(5);
    expect(validated.delivery.cache.maxAge).toBe(604800);
    expect(validated.critical.routes).toEqual(["/app", "/dashboard"]);
    expect(validated.paths.css).toBe("public/assets/css");
    expect(validated.hashing.length).toBe(12);
    expect(validated.compression.level).toBe(9);
  });

  it("should maintain consistency across all configurations", () => {
    const configurations = [
      createProductionConfig(),
      createDevelopmentConfig(),
      createProductionConfig({ strategy: "modular" }),
      createDevelopmentConfig({ optimization: { minify: true } }),
    ];

    for (const config of configurations) {
      // All configurations should pass validation
      expect(() => validateCssOutputConfig(config)).not.toThrow();

      // All configurations should have required properties
      expect(config).toHaveProperty("strategy");
      expect(config).toHaveProperty("chunking");
      expect(config).toHaveProperty("optimization");
      expect(config).toHaveProperty("compression");
      expect(config).toHaveProperty("hashing");
      expect(config).toHaveProperty("critical");
      expect(config).toHaveProperty("delivery");
      expect(config).toHaveProperty("paths");
    }
  });
});
