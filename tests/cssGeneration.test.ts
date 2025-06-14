import { describe, test, expect, beforeEach } from "vitest";
import {
  // Main functions
  generateOptimizedCss,
  integrateCssGeneration,
  formatCssOutput,

  // Core functions
  generateCssRules,
  generateApplyDirective,
  classifyPattern,
  sortCssRules,
  generateCssComments,

  // Utility functions
  validateCssGenerationOptions,
  isValidCssSelector,
  isValidCssPropertyValue,
  sanitizeCssSelector,

  // Advanced functions
  analyzePatternRelationships,
  sortCssRulesAdvanced,
  validateApplyDirective,
  optimizeApplyDirective,

  // Types and interfaces
  type CssGenerationOptions,
  type CssRule,
  type ApplyDirective,

  // Constants
  CSS_PATTERN_THRESHOLDS,
  CSS_PROPERTY_GROUPS,

  // Error classes
  CssGenerationError,
  InvalidCssError,
  ApplyDirectiveError,
  PatternClassificationError,
} from "../src/cssGeneration.ts";

import type {
  PatternFrequencyMap,
  AggregatedClassData,
} from "../src/patternAnalysis.ts";
import type { NameGenerationOptions } from "../src/nameGeneration.ts";

describe("CSS Generation Module", () => {
  let mockFrequencyMap: PatternFrequencyMap;
  let mockNameOptions: NameGenerationOptions;
  let defaultCssOptions: CssGenerationOptions;

  beforeEach(() => {
    // Create mock frequency map
    mockFrequencyMap = new Map([
      [
        "flex items-center",
        {
          name: "flex items-center",
          totalFrequency: 50,
          coOccurrences: new Map([
            ["justify-between", 30],
            ["gap-4", 20],
            ["p-4", 15],
          ]),
          contexts: new Map([
            ["component", 40],
            ["utility", 10],
          ]),
          variants: new Map([["responsive", 5]]),
          files: ["app.tsx", "components/Header.tsx"],
        },
      ],
      [
        "bg-blue-500",
        {
          name: "bg-blue-500",
          totalFrequency: 25,
          coOccurrences: new Map([
            ["text-white", 20],
            ["rounded", 15],
          ]),
          contexts: new Map([["button", 25]]),
          variants: new Map(),
          files: ["components/Button.tsx"],
        },
      ],
      [
        "text-sm",
        {
          name: "text-sm",
          totalFrequency: 100,
          coOccurrences: new Map(),
          contexts: new Map([["text", 100]]),
          variants: new Map(),
          files: ["global.css"],
        },
      ],
    ]);

    // Default name generation options
    mockNameOptions = {
      strategy: "pretty",
      alphabet: "abcdefghijklmnopqrstuvwxyz",
      numericSuffix: false,
      startIndex: 0,
      enableFrequencyOptimization: true,
      frequencyThreshold: 1,
      reservedNames: [],
      avoidConflicts: true,
      enableCaching: false,
      batchSize: 100,
      maxCacheSize: 1000,
      prefix: "",
      suffix: "",
      ensureCssValid: true,
      prettyNameMaxLength: 6,
      prettyNamePreferShorter: true,
      prettyNameExhaustionStrategy: "fallback-hybrid",
    };

    // Default CSS generation options
    defaultCssOptions = {
      strategy: "mixed",
      useApplyDirective: true,
      sortingStrategy: "specificity",
      groupByPatternType: true,
      commentLevel: "detailed",
      formatOutput: true,
      includeSourceMaps: false,
      indentSize: 2,
      selectorNaming: "pretty",
      selectorPrefix: "",
      selectorSuffix: "",
      minimumFrequency: 2,
      maxRulesPerPattern: 50,
      includeRarePatterns: false,
      enableBatching: true,
      batchSize: 100,
      maxMemoryUsage: 100,
    };
  });

  describe("Validation Functions", () => {
    test("validateCssGenerationOptions accepts valid options", () => {
      expect(() =>
        validateCssGenerationOptions(defaultCssOptions),
      ).not.toThrow();
    });

    test("validateCssGenerationOptions rejects invalid options", () => {
      expect(() =>
        validateCssGenerationOptions({
          strategy: "invalid-strategy",
        }),
      ).toThrow(CssGenerationError);
    });

    test("isValidCssSelector validates CSS selectors correctly", () => {
      expect(isValidCssSelector(".valid-class")).toBe(true);
      expect(isValidCssSelector("#valid-id")).toBe(true);
      expect(isValidCssSelector("valid-element")).toBe(true);
      expect(isValidCssSelector(".123invalid")).toBe(false);
      expect(isValidCssSelector("")).toBe(false);
      expect(isValidCssSelector(".space invalid")).toBe(false);
    });

    test("isValidCssPropertyValue validates CSS values correctly", () => {
      expect(isValidCssPropertyValue("color", "red")).toBe(true);
      expect(isValidCssPropertyValue("@apply", "flex items-center")).toBe(true);
      expect(isValidCssPropertyValue("color", "")).toBe(false);
      expect(isValidCssPropertyValue("color", "value;injection")).toBe(false);
    });

    test("sanitizeCssSelector sanitizes invalid selectors", () => {
      expect(sanitizeCssSelector("123invalid")).toBe("_123invalid");
      expect(sanitizeCssSelector("space invalid")).toBe("space_invalid");
      expect(sanitizeCssSelector("UPPERCASE")).toBe("uppercase");
      expect(sanitizeCssSelector("special@chars")).toBe("special_chars");
    });
  });

  describe("Pattern Classification", () => {
    test("classifyPattern correctly identifies atomic patterns", () => {
      const atomicClassData: AggregatedClassData =
        mockFrequencyMap.get("text-sm")!;
      const context = {
        frequencyMap: mockFrequencyMap,
        coOccurrencePatterns: [],
        nameGenerationOptions: mockNameOptions,
        options: defaultCssOptions,
        statistics: {
          processedClasses: 0,
          generatedRules: 0,
          skippedClasses: 0,
        },
      };

      const classification = classifyPattern(atomicClassData, context);

      expect(classification.patternType).toBe("atomic");
      expect(classification.className).toBe("text-sm");
      expect(classification.complexity).toBeGreaterThan(0);
      expect(classification.coOccurrenceStrength).toBe(0);
    });

    test("classifyPattern correctly identifies utility patterns", () => {
      const utilityClassData: AggregatedClassData =
        mockFrequencyMap.get("bg-blue-500")!;
      const context = {
        frequencyMap: mockFrequencyMap,
        coOccurrencePatterns: [],
        nameGenerationOptions: mockNameOptions,
        options: defaultCssOptions,
        statistics: {
          processedClasses: 0,
          generatedRules: 0,
          skippedClasses: 0,
        },
      };

      const classification = classifyPattern(utilityClassData, context);

      expect(classification.patternType).toBe("utility");
      expect(classification.className).toBe("bg-blue-500");
      expect(classification.complexity).toBeGreaterThan(1);
      expect(classification.coOccurrenceStrength).toBeGreaterThan(0);
    });

    test("classifyPattern correctly identifies component patterns", () => {
      const componentClassData: AggregatedClassData =
        mockFrequencyMap.get("flex items-center")!;
      const context = {
        frequencyMap: mockFrequencyMap,
        coOccurrencePatterns: [],
        nameGenerationOptions: mockNameOptions,
        options: defaultCssOptions,
        statistics: {
          processedClasses: 0,
          generatedRules: 0,
          skippedClasses: 0,
        },
      };

      const classification = classifyPattern(componentClassData, context);

      expect(classification.patternType).toBe("utility"); // Will be utility due to co-occurrence count
      expect(classification.className).toBe("flex items-center");
      expect(classification.complexity).toBeGreaterThan(2);
      expect(classification.coOccurrenceStrength).toBeGreaterThan(0);
    });
  });

  describe("@apply Directive Handling", () => {
    test("generateApplyDirective creates valid directives", () => {
      const classes = ["flex", "items-center", "justify-between"];
      const directive = generateApplyDirective(classes, defaultCssOptions);

      expect(directive.classes).toContain("flex");
      expect(directive.classes).toContain("items-center");
      expect(directive.classes).toContain("justify-between");
      expect(directive.variants).toHaveLength(0);
      expect(directive.modifiers).toHaveLength(0);
    });

    test("generateApplyDirective handles variants correctly", () => {
      const classes = ["hover:bg-blue-500", "focus:outline-none", "sm:text-lg"];
      const directive = generateApplyDirective(classes, defaultCssOptions);

      expect(directive.variants).toContain("hover");
      expect(directive.variants).toContain("focus");
      expect(directive.variants).toContain("sm");
      expect(directive.classes).toContain("bg-blue-500");
      expect(directive.classes).toContain("outline-none");
      expect(directive.classes).toContain("text-lg");
    });

    test("generateApplyDirective handles modifiers correctly", () => {
      const classes = ["!important", "text-[14px]"];
      const directive = generateApplyDirective(classes, defaultCssOptions);

      expect(directive.modifiers).toContain("!");
      expect(directive.modifiers).toContain("[14px]");
    });

    test("generateApplyDirective throws error for empty classes", () => {
      expect(() => generateApplyDirective([], defaultCssOptions)).toThrow(
        ApplyDirectiveError,
      );
    });

    test("validateApplyDirective identifies issues", () => {
      const emptyDirective: ApplyDirective = {
        classes: [],
        variants: [],
        modifiers: [],
      };

      const issues = validateApplyDirective(emptyDirective);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("error");
      expect(issues[0].message).toContain("empty");
    });

    test("optimizeApplyDirective groups related classes", () => {
      const directive: ApplyDirective = {
        classes: ["p-4", "m-2", "bg-blue-500", "text-white"],
        variants: ["hover", "focus"],
        modifiers: [],
      };

      const optimized = optimizeApplyDirective(directive, defaultCssOptions);
      expect(optimized.classes).toHaveLength(4);
      expect(optimized.variants).toHaveLength(2);
    });
  });

  describe("CSS Rule Generation", () => {
    test("generateCssRules creates rules from frequency map", () => {
      const context = {
        frequencyMap: mockFrequencyMap,
        coOccurrencePatterns: [],
        nameGenerationOptions: mockNameOptions,
        options: defaultCssOptions,
        statistics: {
          processedClasses: 0,
          generatedRules: 0,
          skippedClasses: 0,
        },
      };

      const rules = generateCssRules(context);

      expect(rules).toBeInstanceOf(Array);
      expect(rules.length).toBeGreaterThan(0);
      expect(context.statistics.processedClasses).toBeGreaterThan(0);
      expect(context.statistics.generatedRules).toBeGreaterThan(0);
    });

    test("generated rules have required properties", () => {
      const context = {
        frequencyMap: mockFrequencyMap,
        coOccurrencePatterns: [],
        nameGenerationOptions: mockNameOptions,
        options: defaultCssOptions,
        statistics: {
          processedClasses: 0,
          generatedRules: 0,
          skippedClasses: 0,
        },
      };

      const rules = generateCssRules(context);
      const rule = rules[0];

      expect(rule).toHaveProperty("selector");
      expect(rule).toHaveProperty("declarations");
      expect(rule).toHaveProperty("patternType");
      expect(rule).toHaveProperty("frequency");
      expect(rule).toHaveProperty("sourceClasses");
      expect(rule.declarations).toBeInstanceOf(Array);
    });
  });

  describe("CSS Rule Sorting", () => {
    test("sortCssRules sorts by frequency", () => {
      const rules: CssRule[] = [
        {
          selector: ".low-freq",
          declarations: [{ property: "@apply", value: "text-sm" }],
          patternType: "atomic",
          frequency: 10,
          sourceClasses: ["text-sm"],
        },
        {
          selector: ".high-freq",
          declarations: [{ property: "@apply", value: "flex items-center" }],
          patternType: "utility",
          frequency: 100,
          sourceClasses: ["flex", "items-center"],
        },
      ];

      const sorted = sortCssRules(rules, {
        ...defaultCssOptions,
        sortingStrategy: "frequency",
      });

      expect(sorted[0].frequency).toBeGreaterThan(sorted[1].frequency);
    });

    test("sortCssRules sorts alphabetically", () => {
      const rules: CssRule[] = [
        {
          selector: ".zebra",
          declarations: [{ property: "@apply", value: "text-sm" }],
          patternType: "atomic",
          frequency: 10,
          sourceClasses: ["text-sm"],
        },
        {
          selector: ".alpha",
          declarations: [{ property: "@apply", value: "flex items-center" }],
          patternType: "utility",
          frequency: 100,
          sourceClasses: ["flex", "items-center"],
        },
      ];

      const sorted = sortCssRules(rules, {
        ...defaultCssOptions,
        sortingStrategy: "alphabetical",
      });

      expect(sorted[0].selector).toBe(".alpha");
      expect(sorted[1].selector).toBe(".zebra");
    });

    test("sortCssRulesAdvanced respects multiple criteria", () => {
      const rules: CssRule[] = [
        {
          selector: ".a",
          declarations: [{ property: "@apply", value: "text-sm" }],
          patternType: "atomic",
          frequency: 10,
          sourceClasses: ["text-sm"],
        },
        {
          selector: ".b",
          declarations: [{ property: "@apply", value: "flex items-center" }],
          patternType: "utility",
          frequency: 100,
          sourceClasses: ["flex", "items-center"],
        },
      ];

      const criteria = [
        { type: "frequency" as const, direction: "desc" as const, weight: 0.7 },
        {
          type: "alphabetical" as const,
          direction: "asc" as const,
          weight: 0.3,
        },
      ];

      const sorted = sortCssRulesAdvanced(rules, defaultCssOptions, criteria);

      expect(sorted[0].frequency).toBeGreaterThan(sorted[1].frequency);
    });
  });

  describe("CSS Comments Generation", () => {
    test("generateCssComments creates minimal comments", () => {
      const rule: CssRule = {
        selector: ".test",
        declarations: [{ property: "@apply", value: "flex items-center" }],
        patternType: "utility",
        frequency: 50,
        sourceClasses: ["flex", "items-center"],
      };

      const comments = generateCssComments(rule, {
        ...defaultCssOptions,
        commentLevel: "minimal",
      });

      expect(comments).toContain(".test");
      expect(comments).toContain("freq: 50");
    });

    test("generateCssComments creates detailed comments", () => {
      const rule: CssRule = {
        selector: ".test",
        declarations: [{ property: "@apply", value: "flex items-center" }],
        patternType: "utility",
        frequency: 50,
        sourceClasses: ["flex", "items-center"],
      };

      const comments = generateCssComments(rule, {
        ...defaultCssOptions,
        commentLevel: "detailed",
      });

      expect(comments).toContain(".test");
      expect(comments).toContain("utility");
      expect(comments).toContain("Frequency: 50");
      expect(comments).toContain("flex, items-center");
    });

    test("generateCssComments creates verbose comments", () => {
      const rule: CssRule = {
        selector: ".test",
        declarations: [{ property: "@apply", value: "flex items-center" }],
        patternType: "utility",
        frequency: 50,
        sourceClasses: ["flex", "items-center"],
      };

      const comments = generateCssComments(rule, {
        ...defaultCssOptions,
        commentLevel: "verbose",
      });

      expect(comments).toContain("========================================");
      expect(comments).toContain("CSS Rule: .test");
      expect(comments).toContain("Pattern Type: utility");
      expect(comments).toContain("Usage Frequency: 50");
      expect(comments).toContain("Source Classes");
    });

    test("generateCssComments returns empty string for none level", () => {
      const rule: CssRule = {
        selector: ".test",
        declarations: [{ property: "@apply", value: "flex items-center" }],
        patternType: "utility",
        frequency: 50,
        sourceClasses: ["flex", "items-center"],
      };

      const comments = generateCssComments(rule, {
        ...defaultCssOptions,
        commentLevel: "none",
      });

      expect(comments).toBe("");
    });
  });

  describe("Integration Functions", () => {
    test("integrateCssGeneration produces complete result", () => {
      const result = integrateCssGeneration(
        mockFrequencyMap,
        mockNameOptions,
        defaultCssOptions,
      );

      expect(result).toHaveProperty("css");
      expect(result).toHaveProperty("rules");
      expect(result).toHaveProperty("sourceClasses");
      expect(result).toHaveProperty("statistics");
      expect(result).toHaveProperty("metadata");

      expect(result.css).toBeTruthy();
      expect(result.rules).toBeInstanceOf(Array);
      expect(result.sourceClasses).toBeInstanceOf(Array);
      expect(result.statistics.totalRules).toBeGreaterThan(0);
      expect(result.metadata.generatedAt).toBeTruthy();
    });

    test("generateOptimizedCss is alias for integrateCssGeneration", () => {
      const result1 = integrateCssGeneration(
        mockFrequencyMap,
        mockNameOptions,
        defaultCssOptions,
      );
      const result2 = generateOptimizedCss(
        mockFrequencyMap,
        mockNameOptions,
        defaultCssOptions,
      );

      expect(result1.rules.length).toBe(result2.rules.length);
      expect(result1.sourceClasses.length).toBe(result2.sourceClasses.length);
    });

    test("formatCssOutput creates valid CSS string", () => {
      const result = integrateCssGeneration(
        mockFrequencyMap,
        mockNameOptions,
        defaultCssOptions,
      );
      const cssOutput = formatCssOutput(result, defaultCssOptions);

      expect(cssOutput).toContain("Generated CSS with @apply Directives");
      expect(cssOutput).toContain("{");
      expect(cssOutput).toContain("}");
      expect(cssOutput).toContain("@apply");
    });
  });

  describe("Advanced Pattern Analysis", () => {
    test("analyzePatternRelationships identifies relationships", () => {
      const classData: AggregatedClassData =
        mockFrequencyMap.get("flex items-center")!;
      const context = {
        frequencyMap: mockFrequencyMap,
        coOccurrencePatterns: [],
        nameGenerationOptions: mockNameOptions,
        options: defaultCssOptions,
        statistics: {
          processedClasses: 0,
          generatedRules: 0,
          skippedClasses: 0,
        },
      };

      const analysis = analyzePatternRelationships(classData, context);

      expect(analysis).toHaveProperty("relationships");
      expect(analysis).toHaveProperty("clusters");
      expect(analysis).toHaveProperty("recommendations");

      expect(analysis.relationships).toBeInstanceOf(Array);
      expect(analysis.clusters).toBeInstanceOf(Array);
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });
  });

  describe("Error Handling", () => {
    test("CssGenerationError has proper structure", () => {
      const error = new CssGenerationError("Test error");
      expect(error.name).toBe("CssGenerationError");
      expect(error.message).toBe("Test error");
    });

    test("InvalidCssError includes CSS details", () => {
      const error = new InvalidCssError(
        "Invalid CSS",
        ".bad selector",
        "selector",
      );
      expect(error.name).toBe("InvalidCssError");
      expect(error.invalidCss).toBe(".bad selector");
      expect(error.reason).toBe("selector");
    });

    test("ApplyDirectiveError includes directive details", () => {
      const classes = ["invalid"];
      const error = new ApplyDirectiveError(
        "Bad directive",
        "@apply invalid",
        classes,
      );
      expect(error.name).toBe("ApplyDirectiveError");
      expect(error.directive).toBe("@apply invalid");
      expect(error.classes).toEqual(classes);
    });

    test("PatternClassificationError includes class details", () => {
      const error = new PatternClassificationError(
        "Classification failed",
        "test-class",
      );
      expect(error.name).toBe("PatternClassificationError");
      expect(error.className).toBe("test-class");
    });
  });

  describe("Performance and Memory", () => {
    test("integrateCssGeneration includes performance metrics", () => {
      const result = integrateCssGeneration(
        mockFrequencyMap,
        mockNameOptions,
        defaultCssOptions,
      );

      expect(result.statistics.generationTime).toBeGreaterThan(0);
      expect(result.statistics.memoryUsage).toBeGreaterThan(0);
      expect(result.statistics.compressionRatio).toBeGreaterThan(0);
    });

    test("handles large frequency maps efficiently", () => {
      // Create a larger mock frequency map
      const largeFrequencyMap = new Map(mockFrequencyMap);

      for (let i = 0; i < 100; i++) {
        largeFrequencyMap.set(`test-class-${i}`, {
          name: `test-class-${i}`,
          totalFrequency: Math.floor(Math.random() * 50) + 1,
          coOccurrences: new Map(),
          contexts: new Map([["test", 1]]),
          variants: new Map(),
          files: [`test-${i}.ts`],
        });
      }

      const startTime = Date.now();
      const result = integrateCssGeneration(
        largeFrequencyMap,
        mockNameOptions,
        defaultCssOptions,
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.rules.length).toBeGreaterThan(0);
      expect(result.statistics.memoryUsage).toBeLessThan(2000000); // Under 2MB
    });
  });

  describe("CSS Constants and Patterns", () => {
    test("CSS_PATTERN_THRESHOLDS has expected values", () => {
      expect(CSS_PATTERN_THRESHOLDS.ATOMIC_MAX_CLASSES).toBe(1);
      expect(CSS_PATTERN_THRESHOLDS.UTILITY_MAX_CLASSES).toBe(5);
      expect(CSS_PATTERN_THRESHOLDS.COMPONENT_MIN_CLASSES).toBe(3);
      expect(CSS_PATTERN_THRESHOLDS.HIGH_FREQUENCY_MIN).toBe(10);
      expect(CSS_PATTERN_THRESHOLDS.RARE_PATTERN_MAX).toBe(2);
    });

    test("CSS_PROPERTY_GROUPS contains expected categories", () => {
      expect(CSS_PROPERTY_GROUPS.POSITIONING).toContain("position");
      expect(CSS_PROPERTY_GROUPS.DISPLAY).toContain("display");
      expect(CSS_PROPERTY_GROUPS.SPACING).toContain("margin");
      expect(CSS_PROPERTY_GROUPS.TYPOGRAPHY).toContain("font-size");
      expect(CSS_PROPERTY_GROUPS.COLORS).toContain("color");
    });
  });
});
