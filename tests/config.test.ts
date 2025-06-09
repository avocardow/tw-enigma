import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import {
  loadConfig,
  loadConfigSync,
  getConfig,
  getConfigSync,
  createSampleConfig,
  ConfigError,
  EnigmaConfigSchema,
} from "../src/config.js";
import type { CliArguments, EnigmaConfig } from "../src/config.js";

const TEST_DIR = join(process.cwd(), "test-config");
const TEST_CONFIG_FILE = join(TEST_DIR, ".enigmarc.json");
const TEST_JS_CONFIG_FILE = join(TEST_DIR, "enigma.config.js");

describe("Configuration System", () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("Schema Validation", () => {
    it("should validate a complete valid configuration", () => {
      const validConfig = {
        pretty: true,
        input: "./src",
        output: "./dist",
        minify: false,
        removeUnused: true,
        verbose: true,
        debug: false,
        maxConcurrency: 6,
        classPrefix: "tw-",
        excludePatterns: ["*.test.*"],
        preserveComments: true,
        sourceMaps: false,
      };

      const result = EnigmaConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it("should apply defaults for missing optional fields", () => {
      const minimalConfig = {};
      const result = EnigmaConfigSchema.parse(minimalConfig);

      expect(result).toEqual({
        pretty: false,
        minify: true,
        removeUnused: true,
        verbose: false,
        debug: false,
        maxConcurrency: 4,
        classPrefix: "",
        excludePatterns: [],
        preserveComments: false,
        sourceMaps: false,
      });
    });

    it("should reject invalid maxConcurrency values", () => {
      expect(() => {
        EnigmaConfigSchema.parse({ maxConcurrency: 0 });
      }).toThrow();

      expect(() => {
        EnigmaConfigSchema.parse({ maxConcurrency: 11 });
      }).toThrow();
    });

    it("should reject invalid types", () => {
      expect(() => {
        EnigmaConfigSchema.parse({ pretty: "true" });
      }).toThrow();

      expect(() => {
        EnigmaConfigSchema.parse({ excludePatterns: "pattern" });
      }).toThrow();
    });
  });

  describe("Configuration File Loading", () => {
    it("should load JSON configuration file", async () => {
      const testConfig = {
        pretty: true,
        verbose: true,
        input: "./test-src",
        classPrefix: "test-",
      };

      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(testConfig, null, 2));

      const result = await loadConfig({}, TEST_DIR);
      expect(result.config.pretty).toBe(true);
      expect(result.config.verbose).toBe(true);
      expect(result.config.input).toBe("./test-src");
      expect(result.config.classPrefix).toBe("test-");
      expect(result.filepath).toBe(TEST_CONFIG_FILE);
    });

    it("should handle missing configuration file gracefully", async () => {
      const result = await loadConfig({}, TEST_DIR);
      expect(result.config).toEqual({
        pretty: false,
        minify: true,
        removeUnused: true,
        verbose: false,
        debug: false,
        maxConcurrency: 4,
        classPrefix: "",
        excludePatterns: [],
        preserveComments: false,
        sourceMaps: false,
      });
      expect(result.filepath).toBeUndefined();
    });

    it("should throw ConfigError for invalid configuration file", async () => {
      writeFileSync(TEST_CONFIG_FILE, '{ "maxConcurrency": 15 }'); // Invalid value

      await expect(loadConfig({}, TEST_DIR)).rejects.toThrow(ConfigError);
    });

    it("should handle JavaScript configuration file loading limitations", async () => {
      // Note: cosmiconfig@8.1.3 has limitations with CommonJS modules in ES module environments
      // This test verifies that the error is handled gracefully
      const configContent = `
        module.exports = {
          pretty: false,
          minify: true,
          output: "./js-output",
          maxConcurrency: 8
        };
      `;

      writeFileSync(TEST_JS_CONFIG_FILE, configContent);

      // cosmiconfig@8.1.3 cannot load CommonJS modules in ES module environment
      // so we expect this to throw a ConfigError
      await expect(loadConfig({ config: TEST_JS_CONFIG_FILE })).rejects.toThrow(
        ConfigError,
      );
    });
  });

  describe("Synchronous Configuration Loading", () => {
    it("should load configuration synchronously", () => {
      const testConfig = {
        pretty: true,
        debug: true,
        input: "./sync-src",
      };

      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(testConfig));

      const result = loadConfigSync({}, TEST_DIR);
      expect(result.config.pretty).toBe(true);
      expect(result.config.debug).toBe(true);
      expect(result.config.input).toBe("./sync-src");
    });

    it("should handle sync loading errors", () => {
      writeFileSync(TEST_CONFIG_FILE, "invalid json");

      expect(() => {
        loadConfigSync({}, TEST_DIR);
      }).toThrow(ConfigError);
    });
  });

  describe("CLI Arguments Integration", () => {
    it("should merge CLI arguments with defaults", async () => {
      const cliArgs: CliArguments = {
        pretty: true,
        verbose: true,
        input: "./cli-input",
        maxConcurrency: 2,
      };

      const result = await loadConfig(cliArgs, TEST_DIR);
      expect(result.config.pretty).toBe(true);
      expect(result.config.verbose).toBe(true);
      expect(result.config.input).toBe("./cli-input");
      expect(result.config.maxConcurrency).toBe(2);
      // Defaults should still apply
      expect(result.config.minify).toBe(true);
      expect(result.config.removeUnused).toBe(true);
    });

    it("should give CLI arguments precedence over config file", async () => {
      const fileConfig = {
        pretty: false,
        verbose: false,
        input: "./file-input",
        output: "./file-output",
        minify: false,
      };

      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(fileConfig));

      const cliArgs: CliArguments = {
        pretty: true,
        input: "./cli-input",
        verbose: true,
      };

      const result = await loadConfig(cliArgs, TEST_DIR);

      // CLI args should override file config
      expect(result.config.pretty).toBe(true);
      expect(result.config.input).toBe("./cli-input");
      expect(result.config.verbose).toBe(true);

      // File config should be used where CLI doesn't override
      expect(result.config.output).toBe("./file-output");
      expect(result.config.minify).toBe(false);
    });

    it("should handle undefined CLI arguments gracefully", async () => {
      const cliArgs: CliArguments = {
        pretty: undefined,
        verbose: undefined,
        input: "./defined-input",
      };

      const result = await loadConfig(cliArgs, TEST_DIR);
      expect(result.config.input).toBe("./defined-input");
      expect(result.config.pretty).toBe(false); // Default
      expect(result.config.verbose).toBe(false); // Default
    });
  });

  describe("Configuration Merging", () => {
    it("should merge nested configuration correctly", async () => {
      const fileConfig = {
        excludePatterns: ["*.test.*", "*.spec.*"],
        classPrefix: "file-",
        maxConcurrency: 6,
      };

      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(fileConfig));

      const cliArgs: CliArguments = {
        excludePatterns: ["*.e2e.*"],
        maxConcurrency: 8,
      };

      const result = await loadConfig(cliArgs, TEST_DIR);

      // CLI should override arrays completely, not merge
      expect(result.config.excludePatterns).toEqual(["*.e2e.*"]);
      expect(result.config.maxConcurrency).toBe(8);
      expect(result.config.classPrefix).toBe("file-");
    });

    it("should handle complex merging scenarios", async () => {
      const fileConfig = {
        pretty: true,
        input: "./file-input",
        output: "./file-output",
        minify: false,
        verbose: true,
        excludePatterns: ["file-pattern"],
      };

      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(fileConfig));

      const cliArgs: CliArguments = {
        output: "./cli-output",
        debug: true,
        excludePatterns: ["cli-pattern1", "cli-pattern2"],
      };

      const result = await loadConfig(cliArgs, TEST_DIR);

      expect(result.config).toEqual({
        pretty: true, // from file
        input: "./file-input", // from file
        output: "./cli-output", // CLI override
        minify: false, // from file
        removeUnused: true, // default
        verbose: true, // from file
        debug: true, // from CLI
        maxConcurrency: 4, // default
        classPrefix: "", // default
        excludePatterns: ["cli-pattern1", "cli-pattern2"], // CLI override
        preserveComments: false, // default
        sourceMaps: false, // default
      });
    });
  });

  describe("Error Handling", () => {
    it("should provide helpful error messages for validation failures", async () => {
      const invalidConfig = {
        maxConcurrency: 15, // Invalid: max is 10
        pretty: "yes", // Invalid: should be boolean
      };

      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(invalidConfig));

      try {
        await loadConfig({}, TEST_DIR);
        expect.fail("Should have thrown ConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).message).toContain(
          "Invalid configuration",
        );
        expect((error as ConfigError).message).toContain("maxConcurrency");
        expect((error as ConfigError).message).toContain("pretty");
        expect((error as ConfigError).filepath).toBe(TEST_CONFIG_FILE);
      }
    });

    it("should handle file loading errors", async () => {
      const nonExistentFile = join(TEST_DIR, "nonexistent.js");

      try {
        await loadConfig({ config: nonExistentFile });
        expect.fail("Should have thrown ConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).message).toContain(
          "Failed to load configuration",
        );
        expect((error as ConfigError).filepath).toBe(nonExistentFile);
      }
    });
  });

  describe("Convenience Functions", () => {
    it("should provide getConfig convenience function", async () => {
      const cliArgs: CliArguments = {
        pretty: true,
        input: "./convenience-test",
      };

      const config = await getConfig(cliArgs);
      expect(config.pretty).toBe(true);
      expect(config.input).toBe("./convenience-test");
      expect(config.minify).toBe(true); // Default
    });

    it("should provide getConfigSync convenience function", () => {
      const cliArgs: CliArguments = {
        verbose: true,
        output: "./sync-convenience",
      };

      const config = getConfigSync(cliArgs);
      expect(config.verbose).toBe(true);
      expect(config.output).toBe("./sync-convenience");
      expect(config.removeUnused).toBe(true); // Default
    });
  });

  describe("Sample Configuration", () => {
    it("should generate valid sample configuration", () => {
      const sampleConfig = createSampleConfig();
      expect(sampleConfig).toContain("module.exports");
      expect(sampleConfig).toContain("pretty: false");
      expect(sampleConfig).toContain('input: "./src"');
      expect(sampleConfig).toContain('output: "./dist"');
      expect(sampleConfig).toContain("maxConcurrency: 4");
    });
  });

  describe("Type Safety", () => {
    it("should enforce TypeScript types for CliArguments", () => {
      // This test ensures TypeScript compilation catches type errors
      const validArgs: CliArguments = {
        pretty: true,
        config: "./config.js",
        verbose: false,
        debug: true,
        input: "./src",
        output: "./dist",
        minify: true,
        removeUnused: false,
        maxConcurrency: 6,
        classPrefix: "prefix-",
        excludePatterns: ["pattern1", "pattern2"],
        preserveComments: true,
        sourceMaps: false,
      };

      expect(validArgs).toBeDefined();
    });

    it("should enforce TypeScript types for EnigmaConfig", () => {
      const validConfig: EnigmaConfig = {
        pretty: false,
        minify: true,
        removeUnused: true,
        verbose: false,
        debug: false,
        maxConcurrency: 4,
        classPrefix: "",
        excludePatterns: [],
        preserveComments: false,
        sourceMaps: false,
      };

      expect(validConfig).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty configuration file", async () => {
      writeFileSync(TEST_CONFIG_FILE, "{}");

      const result = await loadConfig({}, TEST_DIR);
      expect(result.config).toEqual({
        pretty: false,
        minify: true,
        removeUnused: true,
        verbose: false,
        debug: false,
        maxConcurrency: 4,
        classPrefix: "",
        excludePatterns: [],
        preserveComments: false,
        sourceMaps: false,
      });
    });

    it("should handle configuration with only some fields", async () => {
      const partialConfig = {
        pretty: true,
        input: "./partial",
      };

      writeFileSync(TEST_CONFIG_FILE, JSON.stringify(partialConfig));

      const result = await loadConfig({}, TEST_DIR);
      expect(result.config.pretty).toBe(true);
      expect(result.config.input).toBe("./partial");
      expect(result.config.minify).toBe(true); // Default
      expect(result.config.verbose).toBe(false); // Default
    });

    it("should handle boolean CLI arguments correctly", async () => {
      const cliArgs: CliArguments = {
        pretty: false, // Explicitly false
        verbose: true, // Explicitly true
        minify: false, // Override default true
      };

      const result = await loadConfig(cliArgs);
      expect(result.config.pretty).toBe(false);
      expect(result.config.verbose).toBe(true);
      expect(result.config.minify).toBe(false);
    });
  });
});
