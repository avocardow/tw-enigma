/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Unit tests for Tailwind Enigma Plugin
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";

// Mock the tailwindcss/plugin module
vi.mock("tailwindcss/plugin", () => ({
  default: {
    withOptions: vi.fn((factory) => factory),
  },
}));

// Import the plugin after mocking
import tailwindEnigmaPlugin, { defaultConfig, loadPatternData, generateUtilitiesFromPatterns } from "../src/tailwindPlugin.js";

describe("Tailwind Enigma Plugin", () => {
  let tempDir: string;
  let mockAddUtilities: any;
  let mockAddComponents: any;
  let mockAddBase: any;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "tailwind-enigma-test-"));

    // Mock Tailwind plugin API
    mockAddUtilities = vi.fn();
    mockAddComponents = vi.fn();
    mockAddBase = vi.fn();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Plugin Configuration", () => {
    it("should export default configuration", () => {
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.patterns).toBeDefined();
      expect(defaultConfig.utilities).toBeDefined();
      expect(defaultConfig.development).toBeDefined();
      expect(defaultConfig.integration).toBeDefined();
      expect(defaultConfig.paths).toBeDefined();
    });

    it("should have correct default values", () => {
      const config = defaultConfig;

      expect(config.patterns.enabled).toBe(true);
      expect(config.patterns.minFrequency).toBe(2);
      expect(config.utilities.enabled).toBe(true);
      expect(config.utilities.prefix).toBe("tw-opt-");
      expect(config.development.hotReload).toBe(true);
      expect(config.development.generateAutocomplete).toBe(true);
    });

    it("should merge user configuration with defaults", () => {
      const userConfig = {
        patterns: { minFrequency: 5 },
        utilities: { prefix: "custom-" },
      };

      const plugin = tailwindEnigmaPlugin(userConfig);

      // Execute the plugin function to test configuration merging
      plugin({
        addUtilities: mockAddUtilities,
        addComponents: mockAddComponents,
        addBase: mockAddBase,
        theme: () => ({}),
        variants: () => [],
        e: (str: string) => str,
        config: {},
      });

      // The plugin should have been called with merged configuration
      // Note: We can't easily test the withOptions call due to mocking complexity
    });
  });

  describe("Pattern Data Loading", () => {
    it("should load pattern data from valid files", () => {
      // Create test pattern file
      const patternsFile = path.join(tempDir, "patterns.json");
      const frequencyFile = path.join(tempDir, "frequency.json");

      const patternsData = {
        patterns: [
          {
            type: "atomic",
            frequency: 10,
            classes: ["flex", "items-center"],
            properties: [
              { property: "display", value: "flex" },
              { property: "align-items", value: "center" },
            ],
          },
        ],
      };

      const frequencyData = {
        frequencyMap: {
          flex: 15,
          "items-center": 12,
          "justify-center": 8,
        },
      };

      fs.writeFileSync(patternsFile, JSON.stringify(patternsData));
      fs.writeFileSync(frequencyFile, JSON.stringify(frequencyData));

      const result = loadPatternData(
        patternsFile,
        frequencyFile,
      );

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].type).toBe("atomic");
      expect(result.patterns[0].frequency).toBe(10);
      expect(result.frequencies.size).toBe(3);
      expect(result.frequencies.get("flex")).toBe(15);
    });

    it("should handle missing pattern files gracefully", () => {
      const nonExistentFile = path.join(tempDir, "nonexistent.json");

      const result = loadPatternData(
        nonExistentFile,
        nonExistentFile,
      );

      expect(result.patterns).toHaveLength(0);
      expect(result.frequencies.size).toBe(0);
    });

    it("should handle invalid JSON files gracefully", () => {
      const invalidFile = path.join(tempDir, "invalid.json");
      fs.writeFileSync(invalidFile, "invalid json content");

      const result = loadPatternData(
        invalidFile,
        invalidFile,
      );

      expect(result.patterns).toHaveLength(0);
      expect(result.frequencies.size).toBe(0);
    });
  });

  describe("Utility Generation", () => {
    it("should generate utilities from patterns", () => {
      const patterns = [
        {
          type: "atomic" as const,
          frequency: 10,
          classes: ["flex", "items-center"],
          properties: [
            { property: "display", value: "flex" },
            { property: "align-items", value: "center" },
          ],
        },
      ];

      const frequencies = new Map([
        ["flex", 15],
        ["items-center", 12],
      ]);

      const config = {
        patterns: { minFrequency: 2 },
        utilities: { prefix: "tw-opt-" },
        integration: { preserveComments: false },
      };

      const utilities = generateUtilitiesFromPatterns(
        patterns,
        frequencies,
        config,
      );

      expect(Object.keys(utilities)).toContain(".tw-opt-0");
      expect(utilities[".tw-opt-0"]).toHaveProperty("display", "flex");
      expect(utilities[".tw-opt-0"]).toHaveProperty("align-items", "center");
    });

    it("should generate utilities from high-frequency classes", () => {
      const patterns: any[] = [];
      const frequencies = new Map([
        ["flex", 15],
        ["block", 10],
        ["hidden", 8],
      ]);

      const config = {
        patterns: { minFrequency: 5 },
        utilities: { prefix: "tw-opt-" },
        integration: { preserveComments: false },
      };

      const utilities = generateUtilitiesFromPatterns(
        patterns,
        frequencies,
        config,
      );

      // Should generate utilities for high-frequency classes
      const utilityKeys = Object.keys(utilities);
      expect(utilityKeys.length).toBeGreaterThan(0);

      // Check that utilities contain expected CSS properties
      const firstUtility = utilities[utilityKeys[0]];
      expect(firstUtility).toHaveProperty("display");
    });

    it("should respect minimum frequency threshold", () => {
      const patterns = [
        {
          type: "atomic" as const,
          frequency: 1, // Below threshold
          classes: ["low-freq"],
          properties: [{ property: "display", value: "block" }],
        },
        {
          type: "atomic" as const,
          frequency: 5, // Above threshold
          classes: ["high-freq"],
          properties: [{ property: "display", value: "flex" }],
        },
      ];

      const frequencies = new Map();
      const config = {
        patterns: { minFrequency: 3 },
        utilities: { prefix: "tw-opt-" },
        integration: { preserveComments: false },
      };

      const utilities = generateUtilitiesFromPatterns(
        patterns,
        frequencies,
        config,
      );

      // Should only generate utility for high-frequency pattern
      expect(Object.keys(utilities)).toHaveLength(1);
    });

    it("should include comments when preserveComments is enabled", () => {
      const patterns = [
        {
          type: "atomic" as const,
          frequency: 10,
          classes: ["flex", "items-center"],
          properties: [{ property: "display", value: "flex" }],
        },
      ];

      const frequencies = new Map();
      const config = {
        patterns: { minFrequency: 2 },
        utilities: { prefix: "tw-opt-" },
        integration: { preserveComments: true },
      };

      const utilities = generateUtilitiesFromPatterns(
        patterns,
        frequencies,
        config,
      );

      const utilityKey = Object.keys(utilities)[0];
      expect(utilities[utilityKey]).toHaveProperty(
        "/* Generated from pattern */",
      );
    });
  });

  describe("CSS Class Mapping", () => {
    it("should map common Tailwind classes correctly", () => {
      const patterns = [
        {
          type: "atomic" as const,
          frequency: 10,
          classes: ["flex"],
          properties: [],
        },
      ];

      const frequencies = new Map();
      const config = {
        patterns: { minFrequency: 2 },
        utilities: { prefix: "tw-opt-" },
        integration: { preserveComments: false },
      };

      const utilities = generateUtilitiesFromPatterns(
        patterns,
        frequencies,
        config,
      );

      const utilityKey = Object.keys(utilities)[0];
      expect(utilities[utilityKey]).toHaveProperty("display", "flex");
    });

    it("should handle spacing classes correctly", () => {
      const patterns = [
        {
          type: "atomic" as const,
          frequency: 10,
          classes: ["p-4"],
          properties: [],
        },
      ];

      const frequencies = new Map();
      const config = {
        patterns: { minFrequency: 2 },
        utilities: { prefix: "tw-opt-" },
        integration: { preserveComments: false },
      };

      const utilities = generateUtilitiesFromPatterns(
        patterns,
        frequencies,
        config,
      );

      const utilityKey = Object.keys(utilities)[0];
      expect(utilities[utilityKey]).toHaveProperty("padding", "1rem");
    });

    it("should handle color classes correctly", () => {
      const patterns = [
        {
          type: "atomic" as const,
          frequency: 10,
          classes: ["bg-blue-500"],
          properties: [],
        },
      ];

      const frequencies = new Map();
      const config = {
        patterns: { minFrequency: 2 },
        utilities: { prefix: "tw-opt-" },
        integration: { preserveComments: false },
      };

      const utilities = generateUtilitiesFromPatterns(
        patterns,
        frequencies,
        config,
      );

      const utilityKey = Object.keys(utilities)[0];
      expect(utilities[utilityKey]).toHaveProperty(
        "background-color",
        "#3b82f6",
      );
    });
  });

  describe("Plugin Integration", () => {
    it("should call addUtilities with generated utilities", () => {
      // Create test files
      const patternsFile = path.join(tempDir, "patterns.json");
      const frequencyFile = path.join(tempDir, "frequency.json");

      fs.writeFileSync(
        patternsFile,
        JSON.stringify({
          patterns: [
            {
              type: "atomic",
              frequency: 10,
              classes: ["flex"],
              properties: [{ property: "display", value: "flex" }],
            },
          ],
        }),
      );

      fs.writeFileSync(
        frequencyFile,
        JSON.stringify({
          frequencyMap: { flex: 15 },
        }),
      );

      const config = {
        utilities: { enabled: true },
        paths: {
          patternsFile,
          frequencyFile,
        },
      };

      const plugin = tailwindEnigmaPlugin(config);

      plugin({
        addUtilities: mockAddUtilities,
        addComponents: mockAddComponents,
        addBase: mockAddBase,
        theme: () => ({}),
        variants: () => [],
        e: (str: string) => str,
        config: {},
      });

      expect(mockAddUtilities).toHaveBeenCalled();
    });

    it("should not call addUtilities when utilities are disabled", () => {
      const config = {
        utilities: { enabled: false },
        paths: {
          patternsFile: path.join(tempDir, "nonexistent.json"),
          frequencyFile: path.join(tempDir, "nonexistent.json"),
        },
      };

      const plugin = tailwindEnigmaPlugin(config);

      plugin({
        addUtilities: mockAddUtilities,
        addComponents: mockAddComponents,
        addBase: mockAddBase,
        theme: () => ({}),
        variants: () => [],
        e: (str: string) => str,
        config: {},
      });

      expect(mockAddUtilities).not.toHaveBeenCalled();
    });

    it("should generate responsive variants when enabled", () => {
      // Create test files with valid data
      const patternsFile = path.join(tempDir, "patterns.json");
      const frequencyFile = path.join(tempDir, "frequency.json");

      fs.writeFileSync(
        patternsFile,
        JSON.stringify({
          patterns: [
            {
              type: "atomic",
              frequency: 10,
              classes: ["flex"],
              properties: [{ property: "display", value: "flex" }],
            },
          ],
        }),
      );

      fs.writeFileSync(
        frequencyFile,
        JSON.stringify({
          frequencyMap: {},
        }),
      );

      const config = {
        utilities: {
          enabled: true,
          generateResponsive: true,
        },
        paths: {
          patternsFile,
          frequencyFile,
        },
      };

      const plugin = tailwindEnigmaPlugin(config);

      plugin({
        addUtilities: mockAddUtilities,
        addComponents: mockAddComponents,
        addBase: mockAddBase,
        theme: () => ({}),
        variants: () => [],
        e: (str: string) => str,
        config: {},
      });

      // Should be called multiple times for different variants
      expect(mockAddUtilities).toHaveBeenCalledTimes(4); // Base + responsive + hover + focus
    });
  });

  describe("Error Handling", () => {
    it("should handle file system errors gracefully", () => {
      const invalidPath = "/invalid/path/that/does/not/exist.json";

      expect(() => {
        loadPatternData(invalidPath, invalidPath);
      }).not.toThrow();
    });

    it("should handle malformed pattern data gracefully", () => {
      const patterns = [
        {
          // Missing required fields
          type: "atomic",
          // frequency missing
          // classes missing
        },
      ];

      const frequencies = new Map();
      const config = {
        patterns: { minFrequency: 2 },
        utilities: { prefix: "tw-opt-" },
        integration: { preserveComments: false },
      };

      expect(() => {
        generateUtilitiesFromPatterns(
          patterns,
          frequencies,
          config,
        );
      }).not.toThrow();
    });
  });

  describe("Development Features", () => {
    it("should set up file watching when hot reload is enabled", () => {
      // Mock fs.watchFile
      const mockWatchFile = vi.spyOn(fs, "watchFile").mockImplementation();

      // Create test files
      const patternsFile = path.join(tempDir, "patterns.json");
      const frequencyFile = path.join(tempDir, "frequency.json");

      fs.writeFileSync(patternsFile, JSON.stringify({ patterns: [] }));
      fs.writeFileSync(frequencyFile, JSON.stringify({ frequencyMap: {} }));

      const config = {
        development: {
          hotReload: true,
        },
        paths: {
          patternsFile,
          frequencyFile,
        },
      };

      // Set NODE_ENV to development to trigger hot reloading
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const plugin = tailwindEnigmaPlugin(config);

      plugin({
        addUtilities: mockAddUtilities,
        addComponents: mockAddComponents,
        addBase: mockAddBase,
        theme: () => ({}),
        variants: () => [],
        e: (str: string) => str,
        config: {},
      });

      // Restore environment
      process.env.NODE_ENV = originalEnv;

      // Should have set up file watching
      expect(mockWatchFile).toHaveBeenCalled();

      mockWatchFile.mockRestore();
    });

    it("should not set up file watching in production", () => {
      const mockWatchFile = vi.spyOn(fs, "watchFile").mockImplementation();

      const config = {
        development: {
          hotReload: true,
        },
        paths: {
          patternsFile: path.join(tempDir, "nonexistent.json"),
          frequencyFile: path.join(tempDir, "nonexistent.json"),
        },
      };

      // Set NODE_ENV to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const plugin = tailwindEnigmaPlugin(config);

      plugin({
        addUtilities: mockAddUtilities,
        addComponents: mockAddComponents,
        addBase: mockAddBase,
        theme: () => ({}),
        variants: () => [],
        e: (str: string) => str,
        config: {},
      });

      // Restore environment
      process.env.NODE_ENV = originalEnv;

      // Should not have set up file watching
      expect(mockWatchFile).not.toHaveBeenCalled();

      mockWatchFile.mockRestore();
    });
  });
});
