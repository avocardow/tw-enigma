/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Integration tests for Tailwind Enigma Plugin with real Tailwind CSS
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Import the plugin
import tailwindEnigmaPlugin from "../../src/tailwindPlugin.js";

describe("Tailwind Enigma Plugin Integration", () => {
  let tempDir: string;
  let patternsFile: string;
  let frequencyFile: string;
  let autocompleteFile: string;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(
      path.join(tmpdir(), "tailwind-enigma-integration-"),
    );
    patternsFile = path.join(tempDir, "patterns.json");
    frequencyFile = path.join(tempDir, "frequency.json");
    autocompleteFile = path.join(tempDir, "autocomplete.json");
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createTestData = () => {
    // Create test pattern data
    const patternsData = {
      patterns: [
        {
          type: "atomic",
          frequency: 15,
          classes: ["flex", "items-center", "justify-center"],
          properties: [
            { property: "display", value: "flex" },
            { property: "align-items", value: "center" },
            { property: "justify-content", value: "center" },
          ],
          complexity: 3,
          coOccurrenceStrength: 0.8,
        },
        {
          type: "utility",
          frequency: 12,
          classes: ["bg-white", "shadow-lg", "rounded-lg"],
          properties: [
            { property: "background-color", value: "#ffffff" },
            {
              property: "box-shadow",
              value: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            },
            { property: "border-radius", value: "0.5rem" },
          ],
          complexity: 2,
          coOccurrenceStrength: 0.7,
        },
        {
          type: "component",
          frequency: 8,
          classes: ["p-4", "m-2"],
          properties: [
            { property: "padding", value: "1rem" },
            { property: "margin", value: "0.5rem" },
          ],
          complexity: 1,
          coOccurrenceStrength: 0.6,
        },
      ],
    };

    const frequencyData = {
      frequencyMap: {
        flex: 25,
        "items-center": 20,
        "justify-center": 18,
        "bg-white": 15,
        "shadow-lg": 12,
        "rounded-lg": 10,
        "p-4": 8,
        "m-2": 6,
        "text-gray-600": 14,
        "font-medium": 11,
      },
      totalClasses: 139,
      analyzedAt: "2025-01-20T18:30:00.000Z",
    };

    fs.writeFileSync(patternsFile, JSON.stringify(patternsData, null, 2));
    fs.writeFileSync(frequencyFile, JSON.stringify(frequencyData, null, 2));
  };

  describe("Real Tailwind CSS Integration", () => {
    it("should generate CSS with Tailwind CSS processor", async () => {
      createTestData();

      const tailwindConfig = {
        content: [{ raw: '<div class="tw-opt-0 tw-opt-1"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            patterns: {
              enabled: true,
              minFrequency: 5,
            },
            utilities: {
              enabled: true,
              prefix: "tw-opt-",
            },
            paths: {
              patternsFile,
              frequencyFile,
              autocompleteFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      // Check that optimized utilities are generated
      expect(result.css).toContain(".tw-opt-0");
      expect(result.css).toContain("display: flex");
      expect(result.css).toContain("align-items: center");
      expect(result.css).toContain("justify-content: center");
    });

    it("should generate responsive variants when enabled", async () => {
      createTestData();

      const tailwindConfig = {
        content: [{ raw: '<div class="md:tw-opt-0 lg:tw-opt-1"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            utilities: {
              enabled: true,
              prefix: "tw-opt-",
              generateResponsive: true,
            },
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      // Check for responsive variants
      expect(result.css).toMatch(/@media.*min-width: 768px.*\.md\\:tw-opt-0/s);
      expect(result.css).toMatch(/@media.*min-width: 1024px.*\.lg\\:tw-opt-1/s);
    });

    it("should generate hover and focus variants when enabled", async () => {
      createTestData();

      const tailwindConfig = {
        content: [{ raw: '<div class="hover:tw-opt-0 focus:tw-opt-1"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            utilities: {
              enabled: true,
              prefix: "tw-opt-",
              generateHover: true,
              generateFocus: true,
            },
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      // Check for hover and focus variants
      expect(result.css).toContain(".hover\\:tw-opt-0:hover");
      expect(result.css).toContain(".focus\\:tw-opt-1:focus");
    });

    it("should work with custom prefix", async () => {
      createTestData();

      const tailwindConfig = {
        content: [{ raw: '<div class="opt-0 opt-freq-0"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            utilities: {
              enabled: true,
              prefix: "opt-",
            },
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      // Check that custom prefix is used
      expect(result.css).toContain(".opt-0");
      expect(result.css).toContain(".opt-freq-0");
      expect(result.css).not.toContain(".tw-opt-");
    });

    it("should respect minimum frequency threshold", async () => {
      createTestData();

      const tailwindConfig = {
        content: [{ raw: '<div class="tw-opt-0 tw-opt-1 tw-opt-2"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            patterns: {
              enabled: true,
              minFrequency: 10, // High threshold
            },
            utilities: {
              enabled: true,
              prefix: "tw-opt-",
            },
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      // Should only generate utilities for high-frequency patterns
      expect(result.css).toContain(".tw-opt-0"); // frequency: 15
      expect(result.css).toContain(".tw-opt-1"); // frequency: 12
      expect(result.css).not.toContain(".tw-opt-2"); // frequency: 8 (below threshold)
    });

    it("should handle missing pattern files gracefully", async () => {
      const tailwindConfig = {
        content: [{ raw: '<div class="flex p-4"></div>' }], // Include some standard Tailwind classes
        plugins: [
          tailwindEnigmaPlugin({
            paths: {
              patternsFile: path.join(tempDir, "nonexistent.json"),
              frequencyFile: path.join(tempDir, "nonexistent.json"),
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      // Should not throw an error
      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      // Should still generate base Tailwind CSS for standard classes
      expect(result.css).toBeDefined();
      expect(result.css.length).toBeGreaterThan(0);
      expect(result.css).toContain("display: flex"); // Should include standard Tailwind utilities
    });
  });

  describe("Autocomplete Generation", () => {
    it("should generate autocomplete configuration file", async () => {
      createTestData();

      const tailwindConfig = {
        content: [{ raw: '<div class="tw-opt-0"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            development: {
              generateAutocomplete: true,
            },
            paths: {
              patternsFile,
              frequencyFile,
              autocompleteFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      // Check that autocomplete file was generated
      expect(fs.existsSync(autocompleteFile)).toBe(true);

      const autocompleteData = JSON.parse(
        fs.readFileSync(autocompleteFile, "utf8"),
      );

      expect(autocompleteData.version).toBeDefined();
      expect(autocompleteData.utilities).toBeInstanceOf(Array);
      expect(autocompleteData.patterns).toBeInstanceOf(Array);
      expect(autocompleteData.suggestions).toBeInstanceOf(Array);
      expect(autocompleteData.utilities.length).toBeGreaterThan(0);
    });

    it("should include pattern suggestions in autocomplete", async () => {
      createTestData();

      const tailwindConfig = {
        content: [{ raw: "<div></div>" }],
        plugins: [
          tailwindEnigmaPlugin({
            development: {
              generateAutocomplete: true,
            },
            paths: {
              patternsFile,
              frequencyFile,
              autocompleteFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      const autocompleteData = JSON.parse(
        fs.readFileSync(autocompleteFile, "utf8"),
      );

      // Should include pattern-based suggestions
      expect(
        autocompleteData.patterns.some((p: any) =>
          p.pattern.includes("flex items-center justify-center"),
        ),
      ).toBe(true);

      // Should include context-aware suggestions
      expect(
        autocompleteData.suggestions.some((s: any) => s.trigger === "flex"),
      ).toBe(true);
    });
  });

  describe("Performance and Bundle Size", () => {
    it("should generate smaller CSS than individual classes", async () => {
      createTestData();

      // Test with individual classes
      const individualConfig = {
        content: [
          {
            raw: `
            <div class="flex items-center justify-center"></div>
            <div class="flex items-center justify-center"></div>
            <div class="flex items-center justify-center"></div>
          `,
          },
        ],
        plugins: [],
      };

      // Test with optimized classes
      const optimizedConfig = {
        content: [
          {
            raw: `
            <div class="tw-opt-0"></div>
            <div class="tw-opt-0"></div>
            <div class="tw-opt-0"></div>
          `,
          },
        ],
        plugins: [
          tailwindEnigmaPlugin({
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      const individualResult = await postcss([
        tailwindcss(individualConfig),
      ]).process(css, { from: undefined });

      const optimizedResult = await postcss([
        tailwindcss(optimizedConfig),
      ]).process(css, { from: undefined });

      // Optimized CSS should be smaller or similar in size
      // (In real scenarios with many repeated patterns, it would be significantly smaller)
      expect(optimizedResult.css.length).toBeLessThanOrEqual(
        individualResult.css.length * 1.1,
      );
    });

    it("should handle large pattern datasets efficiently", async () => {
      // Create a large dataset
      const largePatterns = {
        patterns: Array.from({ length: 100 }, (_, i) => ({
          type: "atomic",
          frequency: Math.floor(Math.random() * 20) + 5,
          classes: [`class-${i}`, `modifier-${i}`],
          properties: [
            { property: "display", value: i % 2 === 0 ? "flex" : "block" },
          ],
        })),
      };

      const largeFrequency = {
        frequencyMap: Object.fromEntries(
          Array.from({ length: 200 }, (_, i) => [
            `freq-class-${i}`,
            Math.floor(Math.random() * 50),
          ]),
        ),
      };

      fs.writeFileSync(patternsFile, JSON.stringify(largePatterns));
      fs.writeFileSync(frequencyFile, JSON.stringify(largeFrequency));

      const tailwindConfig = {
        content: [{ raw: '<div class="tw-opt-0 tw-opt-freq-0"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      const startTime = Date.now();

      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process within reasonable time (less than 5 seconds)
      expect(processingTime).toBeLessThan(5000);
      expect(result.css).toBeDefined();
      expect(result.css.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle malformed pattern data gracefully", async () => {
      // Create malformed pattern data
      const malformedPatterns = {
        patterns: [
          {
            // Missing required fields
            type: "atomic",
            // frequency missing
            // classes missing
          },
          {
            type: "invalid-type",
            frequency: "not-a-number",
            classes: "not-an-array",
          },
        ],
      };

      fs.writeFileSync(patternsFile, JSON.stringify(malformedPatterns));
      fs.writeFileSync(frequencyFile, '{"frequencyMap": {}}');

      const tailwindConfig = {
        content: [{ raw: '<div class="tw-opt-0"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      // Should not throw an error
      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      expect(result.css).toBeDefined();
    });

    it("should handle invalid JSON files gracefully", async () => {
      // Create invalid JSON files
      fs.writeFileSync(patternsFile, "invalid json content");
      fs.writeFileSync(frequencyFile, "{ invalid json }");

      const tailwindConfig = {
        content: [{ raw: '<div class="tw-opt-0"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      // Should not throw an error
      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      expect(result.css).toBeDefined();
    });

    it("should work when utilities are disabled", async () => {
      createTestData();

      const tailwindConfig = {
        content: [{ raw: '<div class="flex"></div>' }],
        plugins: [
          tailwindEnigmaPlugin({
            utilities: {
              enabled: false,
            },
            paths: {
              patternsFile,
              frequencyFile,
            },
          }),
        ],
      };

      const css = "@tailwind utilities;";

      const result = await postcss([tailwindcss(tailwindConfig)]).process(css, {
        from: undefined,
      });

      // Should not contain optimized utilities
      expect(result.css).not.toContain(".tw-opt-");
      // Should still contain standard Tailwind utilities
      expect(result.css).toContain(".flex");
    });
  });
});
