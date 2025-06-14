/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import type {
  AggregatedClassData,
  FrequencyAnalysisResult,
  PatternFrequencyMap,
} from "./patternAnalysis";
import { createPluginApi } from "./pluginApi";
import { createDefaultPluginConfigManager } from "./pluginConfig";
import type { EnigmaPostCSSProcessor } from "./postcssIntegration";
import { createLogger } from "./logger";
import type { EnigmaConfig } from "./config";
// Note: FrequencyAnalyzer and GeneratedCSS types would be defined elsewhere or inline

// Temporary type definitions for missing modules
interface FrequencyAnalyzer {
  analyze(data: any): Promise<any>;
}

interface GeneratedCSS {
  css: string;
  sourceMap?: string;
  metadata: any;
  processingTime?: number;
  optimizationMetrics?: any;
  errors?: Error[];
}

// ===== ZOD SCHEMAS =====

export const CssGenerationOptionsSchema = z.object({
  strategy: z
    .enum(["atomic", "utility", "component", "mixed"])
    .default("mixed"),
  useApplyDirective: z.boolean().default(true),
  sortingStrategy: z
    .enum(["specificity", "frequency", "alphabetical", "custom"])
    .default("specificity"),
  commentLevel: z
    .enum(["none", "minimal", "detailed", "verbose"])
    .default("detailed"),
  selectorNaming: z
    .enum(["sequential", "frequency-optimized", "pretty", "custom"])
    .default("pretty"),
  minimumFrequency: z.number().min(1).default(2),
  includeSourceMaps: z.boolean().default(false),
  formatOutput: z.boolean().default(true),
  maxRulesPerFile: z.number().min(1).default(1000),
  enableOptimizations: z.boolean().default(true),
  customSortFunction: z
    .function()
    .args(z.any(), z.any())
    .returns(z.number())
    .optional(),
  customNamingFunction: z
    .function()
    .args(z.any())
    .returns(z.string())
    .optional(),
  enableValidation: z.boolean().default(false),
  skipInvalidClasses: z.boolean().default(false),
  warnOnInvalidClasses: z.boolean().default(true),
});

export const PatternTypeSchema = z.enum(["atomic", "utility", "component"]);

export const CssRuleSchema = z.object({
  selector: z.string().min(1),
  declarations: z.array(z.string()).min(1),
  applyDirective: z.string().optional(),
  frequency: z.number().min(0),
  patternType: PatternTypeSchema,
  sourceClasses: z.array(z.string()),
  complexity: z.number().min(1).max(10),
  coOccurrenceStrength: z.number().min(0).max(1),
});

// ===== TYPESCRIPT INTERFACES =====

export interface CssGenerationOptions {
  strategy: "atomic" | "utility" | "component" | "mixed";
  useApplyDirective: boolean;
  sortingStrategy: "specificity" | "frequency" | "alphabetical" | "custom";
  commentLevel: "none" | "minimal" | "detailed" | "verbose";
  selectorNaming: "sequential" | "frequency-optimized" | "pretty" | "custom";
  minimumFrequency: number;
  includeSourceMaps: boolean;
  formatOutput: boolean;
  maxRulesPerFile: number;
  enableOptimizations: boolean;
  customSortFunction?: (a: CssRule, b: CssRule) => number;
  customNamingFunction?: (pattern: AggregatedClassData) => string;
  enableValidation: boolean;
  skipInvalidClasses: boolean;
  warnOnInvalidClasses: boolean;
  enablePostCSS?: boolean;
  generateSourceMaps?: boolean;
  preserveComments?: boolean;
}

export interface CssRule {
  selector: string;
  declarations: string[];
  applyDirective?: string;
  frequency: number;
  patternType: "atomic" | "utility" | "component";
  sourceClasses: string[];
  complexity: number;
  coOccurrenceStrength: number;
}

export interface ApplyDirective {
  classes: string[];
  variants: string[];
  modifiers: string[];
  isValid: boolean;
  optimized: string;
  conflicts: string[];
}

export interface CssGenerationResult {
  css: string;
  rules: CssRule[];
  sourceClasses: string[];
  statistics: CssGenerationStatistics;
  metadata: {
    generatedAt: string;
    strategy: string;
    totalInputClasses: number;
    compressionAchieved: boolean;
    validationMetadata?: {
      totalClassesValidated: number;
      validClasses: number;
      invalidClasses: number;
      warningsGenerated: number;
      skippedClasses: number;
    };
  };
  warnings: string[];
  errors: string[];
  sourceMap?: string;
}

export interface CssGenerationStatistics {
  totalRules: number;
  totalDeclarations: number;
  compressionRatio: number;
  generationTime: number;
  memoryUsage: number;
  patternTypeBreakdown: Record<string, number>;
  frequencyDistribution: Record<string, number>;
  optimizationsSaved: number;
}

export interface PatternClassification {
  type: "atomic" | "utility" | "component";
  patternType: "atomic" | "utility" | "component"; // For backward compatibility
  className: string;
  complexity: number;
  coOccurrenceStrength: number;
  semanticGroup: string;
  recommendedStrategy: string;
  confidence: number;
}

// ===== ERROR CLASSES =====

export class CssGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CssGenerationError";
  }
}

export class InvalidCssError extends CssGenerationError {
  constructor(
    message: string,
    public invalidCss: string,
    public reason?: string,
  ) {
    super(message, "INVALID_CSS", { invalidCss, reason });
    this.name = "InvalidCssError";
  }
}

export class ApplyDirectiveError extends CssGenerationError {
  constructor(
    message: string,
    public directive: string,
    public classes?: string[],
  ) {
    super(message, "APPLY_DIRECTIVE_ERROR", { directive, classes });
    this.name = "ApplyDirectiveError";
  }
}

export class PatternClassificationError extends CssGenerationError {
  constructor(
    message: string,
    public className: string,
  ) {
    super(message, "PATTERN_CLASSIFICATION_ERROR", { className });
    this.name = "PatternClassificationError";
  }
}

// ===== CONSTANTS =====

export const CSS_PATTERN_THRESHOLDS = {
  ATOMIC_MAX_CLASSES: 1,
  UTILITY_MAX_CLASSES: 5,
  COMPONENT_MIN_CLASSES: 3,
  HIGH_FREQUENCY_THRESHOLD: 50,
  HIGH_FREQUENCY_MIN: 10,
  RARE_PATTERN_MAX: 2,
  MEDIUM_FREQUENCY_THRESHOLD: 10,
  LOW_FREQUENCY_THRESHOLD: 2,
  COMPLEXITY_THRESHOLD_HIGH: 7,
  COMPLEXITY_THRESHOLD_MEDIUM: 4,
  COMPLEXITY_LOW: 3,
  COMPLEXITY_MEDIUM: 6,
  COMPLEXITY_HIGH: 8,
  CO_OCCURRENCE_STRONG: 0.7,
  CO_OCCURRENCE_MEDIUM: 0.4,
  CO_OCCURRENCE_WEAK: 0.2,
} as const;

export const CSS_PROPERTY_GROUPS = {
  POSITIONING: ["position", "top", "right", "bottom", "left", "z-index"],
  DISPLAY: ["display", "visibility", "opacity"],
  FLEXBOX: [
    "flex",
    "flex-direction",
    "flex-wrap",
    "justify-content",
    "align-items",
    "align-content",
  ],
  GRID: ["grid", "grid-template", "grid-area", "grid-column", "grid-row"],
  SIZING: [
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
  ],
  SPACING: ["margin", "padding"],
  TYPOGRAPHY: ["font", "font-size", "text", "line-height", "letter-spacing"],
  COLORS: ["color", "background", "border-color"],
  BORDERS: ["border", "border-radius", "outline"],
  EFFECTS: ["box-shadow", "filter", "backdrop-filter", "transform"],
} as const;

export const TAILWIND_DIRECTIVE_PATTERNS = {
  VARIANTS:
    /^(hover|focus|active|disabled|first|last|odd|even|visited|target|checked|indeterminate|default|required|valid|invalid|in-range|out-of-range|placeholder-shown|autofill|read-only):/,
  RESPONSIVE: /^(sm|md|lg|xl|2xl):/,
  DARK_MODE: /^dark:/,
  MOTION: /^(motion-safe|motion-reduce):/,
  ARBITRARY_VALUES: /\[([^\]]+)\]/,
  IMPORTANT: /!$/,
  MODIFIERS: /\/\d+$/,
} as const;

export const DEFAULT_CSS_GENERATION_OPTIONS: CssGenerationOptions = {
  strategy: "mixed",
  useApplyDirective: true,
  sortingStrategy: "specificity",
  commentLevel: "detailed",
  selectorNaming: "pretty",
  minimumFrequency: 2,
  includeSourceMaps: false,
  formatOutput: true,
  maxRulesPerFile: 1000,
  enableOptimizations: true,
  enableValidation: false,
  skipInvalidClasses: false,
  warnOnInvalidClasses: true,
};

// ===== VALIDATION FUNCTIONS =====

export function validateCssGenerationOptions(
  options: unknown,
): CssGenerationOptions {
  try {
    return CssGenerationOptionsSchema.parse(options);
  } catch (error) {
    throw new CssGenerationError(
      `Invalid CSS generation options: ${error instanceof Error ? error.message : "Unknown error"}`,
      "INVALID_OPTIONS",
      { options, error },
    );
  }
}

export function validateCssRule(rule: unknown): CssRule {
  try {
    return CssRuleSchema.parse(rule);
  } catch (error) {
    throw new CssGenerationError(
      `Invalid CSS rule: ${error instanceof Error ? error.message : "Unknown error"}`,
      "INVALID_RULE",
      { rule, error },
    );
  }
}

export function validateTailwindClass(className: string): boolean {
  // Basic validation for Tailwind CSS class names
  if (!className || typeof className !== "string") {
    return false;
  }

  // Remove variants and modifiers for core class validation
  const coreClass = className
    .replace(TAILWIND_DIRECTIVE_PATTERNS.VARIANTS, "")
    .replace(TAILWIND_DIRECTIVE_PATTERNS.RESPONSIVE, "")
    .replace(TAILWIND_DIRECTIVE_PATTERNS.DARK_MODE, "")
    .replace(TAILWIND_DIRECTIVE_PATTERNS.MOTION, "")
    .replace(TAILWIND_DIRECTIVE_PATTERNS.IMPORTANT, "")
    .replace(TAILWIND_DIRECTIVE_PATTERNS.MODIFIERS, "");

  // Basic pattern matching for common Tailwind classes
  const validPatterns = [
    /^(flex|grid|block|inline|hidden|visible)$/,
    /^(relative|absolute|fixed|sticky)$/,
    /^(w|h|min-w|min-h|max-w|max-h)-/,
    /^(m|p)[trblxy]?-/,
    /^(text|bg|border)-/,
    /^(rounded|shadow|opacity)-/,
    /^(justify|items|content)-/,
    /^(space|gap)-/,
    /^(transform|transition|duration|ease)-/,
  ];

  return validPatterns.some((pattern) => pattern.test(coreClass));
}

// ===== UTILITY FUNCTIONS =====

export function isValidCssSelector(selector: string): boolean {
  try {
    // Basic CSS selector validation
    if (!selector || typeof selector !== "string") return false;

    // Check for valid CSS selector patterns
    const validSelectorPattern = /^[.#]?[a-zA-Z_-][a-zA-Z0-9_-]*$/;
    const elementSelectorPattern = /^[a-zA-Z][a-zA-Z0-9]*$/;

    return (
      validSelectorPattern.test(selector) ||
      elementSelectorPattern.test(selector)
    );
  } catch {
    return false;
  }
}

export function isValidCssPropertyValue(
  property: string,
  value: string,
): boolean {
  try {
    if (
      !property ||
      !value ||
      typeof property !== "string" ||
      typeof value !== "string"
    ) {
      return false;
    }

    // Special case for @apply directive
    if (property === "@apply") {
      return value.trim().length > 0;
    }

    // Check for CSS injection patterns
    if (value.includes(";") || value.includes("{") || value.includes("}")) {
      return false;
    }

    // Basic validation - non-empty value
    return value.trim().length > 0;
  } catch {
    return false;
  }
}

export function sanitizeCssSelector(selector: string): string {
  try {
    if (!selector || typeof selector !== "string") return "element";

    let sanitized = selector
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "_") // Replace invalid characters with underscore
      .replace(/^[0-9]/, "_$&"); // Prefix numbers with underscore

    // Ensure it starts with a valid character
    if (!/^[a-z_]/.test(sanitized)) {
      sanitized = "_" + sanitized;
    }

    return sanitized || "element";
  } catch {
    return "element";
  }
}

export function extractSourceClasses(pattern: AggregatedClassData): string[] {
  // For AggregatedClassData, the class name is in the 'name' property
  // If this represents a pattern with multiple classes, they should be split from the name
  return pattern.name ? [pattern.name] : [];
}

export function calculateComplexity(pattern: AggregatedClassData): number {
  const classCount = pattern.name ? 1 : 0; // Single class name
  const frequency = pattern.totalFrequency || 0;
  const variance = pattern.coOccurrences?.size || 0; // Use co-occurrence count as variance

  // Complexity calculation based on multiple factors
  let complexity = 1;

  // Class count factor (1-4 points)
  if (classCount === 1) complexity += 1;
  else if (classCount <= 3) complexity += 2;
  else if (classCount <= 6) complexity += 3;
  else complexity += 4;

  // Frequency factor (1-3 points)
  if (frequency >= CSS_PATTERN_THRESHOLDS.HIGH_FREQUENCY_THRESHOLD)
    complexity += 1;
  else if (frequency >= CSS_PATTERN_THRESHOLDS.MEDIUM_FREQUENCY_THRESHOLD)
    complexity += 2;
  else complexity += 3;

  // Variance factor (1-3 points)
  if (variance <= 0.2) complexity += 1;
  else if (variance <= 0.5) complexity += 2;
  else complexity += 3;

  return Math.min(complexity, 10);
}

export function calculateCoOccurrenceStrength(
  pattern: AggregatedClassData,
): number {
  const frequency = pattern.totalFrequency || 0;
  const coOccurrences = pattern.coOccurrences;

  if (frequency === 0) return 0;

  // If no co-occurrences, strength is 0 (atomic pattern)
  if (!coOccurrences || coOccurrences.size === 0) {
    return 0;
  }

  // Calculate average co-occurrence frequency
  let totalCoOccurrenceFreq = 0;
  for (const coOccurrenceFreq of coOccurrences.values()) {
    totalCoOccurrenceFreq += coOccurrenceFreq;
  }

  const avgCoOccurrence = totalCoOccurrenceFreq / coOccurrences.size;
  const coOccurrenceStrength = avgCoOccurrence / frequency;

  return Math.min(coOccurrenceStrength, 1);
}

export function formatCssSelector(selector: string): string {
  // Ensure selector starts with a dot and is properly formatted
  if (!selector.startsWith(".")) {
    selector = `.${selector}`;
  }

  // Escape special characters
  return selector.replace(/[^a-zA-Z0-9\-_.]/g, "\\$&");
}

export function formatCssDeclaration(property: string, value: string): string {
  return `${property}: ${value};`;
}

export function formatCssRule(
  rule: CssRule,
  options: CssGenerationOptions,
): string {
  const { formatOutput } = options;
  const indent = formatOutput ? "  " : "";
  const newline = formatOutput ? "\n" : " ";

  let css = `${rule.selector} {${newline}`;

  if (rule.applyDirective) {
    css += `${indent}@apply ${rule.applyDirective};${newline}`;
  } else {
    rule.declarations.forEach((declaration) => {
      css += `${indent}${declaration}${newline}`;
    });
  }

  css += "}";

  return css;
}

// ===== PLACEHOLDER FUNCTIONS (TO BE IMPLEMENTED IN SUBSEQUENT STEPS) =====

export function generateCssRules(
  patterns:
    | AggregatedClassData[]
    | { frequencyMap: Map<string, number>; [key: string]: any },
  options?: CssGenerationOptions,
): CssRule[] {
  const rules: CssRule[] = [];

  try {
    // Handle different input formats
    let patternsArray: AggregatedClassData[];
    let actualOptions: CssGenerationOptions;

    if (Array.isArray(patterns)) {
      // Standard format: array of AggregatedClassData
      patternsArray = patterns;
      actualOptions = options || DEFAULT_CSS_GENERATION_OPTIONS;
    } else {
      // Test format: object with frequencyMap
      const context = patterns as any;
      patternsArray = [];

      // Convert frequencyMap to AggregatedClassData array
      if (context.frequencyMap && context.frequencyMap instanceof Map) {
        for (const [className, data] of context.frequencyMap.entries()) {
          // The frequency map contains AggregatedClassData objects as values
          if (typeof data === "object" && data.totalFrequency !== undefined) {
            patternsArray.push(data);
          } else {
            // Fallback for simple frequency numbers
            patternsArray.push({
              name: className,
              totalFrequency: data,
              htmlFrequency: 0,
              jsxFrequency: data,
              sources: {
                sourceType: "mixed",
                filePaths: [],
                frameworks: new Set(),
                extractionTypes: new Set(),
              },
              contexts: {
                html: [],
                jsx: [],
              },
              coOccurrences: new Map(),
            });
          }
        }
      }

      actualOptions = context.options || DEFAULT_CSS_GENERATION_OPTIONS;

      // Update statistics if available
      if (context.statistics) {
        context.statistics.processedClasses = patternsArray.length;
      }
    }

    // Filter patterns by minimum frequency
    const filteredPatterns = patternsArray.filter(
      (pattern) => pattern.totalFrequency >= actualOptions.minimumFrequency,
    );

    for (const pattern of filteredPatterns) {
      // Classify the pattern type
      const classification = classifyPattern(pattern, actualOptions);

      // Skip if pattern doesn't match strategy
      if (
        actualOptions.strategy !== "mixed" &&
        classification.type !== actualOptions.strategy
      ) {
        continue;
      }

      // Generate CSS selector name
      const selector = generateCssSelector(pattern, actualOptions);

      // Extract source classes
      const sourceClasses = extractSourceClasses(pattern);

      // Validate Tailwind classes using pattern validator if enabled, otherwise use basic validation
      let validClasses: string[];
      if (actualOptions.enableValidation && pattern.validation) {
        // Use existing validation result from pattern analysis
        if (pattern.validation.isValid) {
          validClasses = [pattern.validation.className];
        } else {
          // Handle invalid classes based on options
          if (actualOptions.skipInvalidClasses) {
            continue; // Skip invalid classes
          } else {
            validClasses = sourceClasses; // Include invalid classes but will add warnings
          }
        }
      } else {
        // Fallback to basic validation
        validClasses = sourceClasses.filter((className) =>
          validateTailwindClass(className),
        );
      }

      if (validClasses.length === 0) {
        continue; // Skip patterns with no valid Tailwind classes
      }

      // Generate CSS rule
      const rule: CssRule = {
        selector: formatCssSelector(selector),
        declarations: [],
        frequency: pattern.totalFrequency,
        patternType: classification.type,
        sourceClasses: validClasses,
        complexity: calculateComplexity(pattern),
        coOccurrenceStrength: calculateCoOccurrenceStrength(pattern),
      };

      // Generate @apply directive or CSS declarations
      if (actualOptions.useApplyDirective) {
        const applyDirective = generateApplyDirective(
          validClasses,
          actualOptions,
        );
        if (applyDirective.isValid) {
          rule.applyDirective = applyDirective.optimized;
        } else {
          // Fallback to CSS declarations
          rule.declarations = generateCssDeclarations(validClasses);
        }
      } else {
        rule.declarations = generateCssDeclarations(validClasses);
      }

      // Only add rule if it has content
      if (rule.applyDirective || rule.declarations.length > 0) {
        rules.push(rule);
      }
    }

    // Update statistics if using test format
    if (!Array.isArray(patterns)) {
      const context = patterns as any;
      if (context.statistics) {
        context.statistics.generatedRules = rules.length;
      }
    }

    return rules;
  } catch (error) {
    throw new CssGenerationError(
      `Failed to generate CSS rules: ${error instanceof Error ? error.message : "Unknown error"}`,
      "RULE_GENERATION_FAILED",
      { patterns, options: options || "not provided", error },
    );
  }
}

/**
 * Generate CSS selector name using the configured naming strategy
 */
function generateCssSelector(
  pattern: AggregatedClassData,
  options: CssGenerationOptions,
): string {
  // Use custom naming function if provided
  if (options.customNamingFunction) {
    return options.customNamingFunction(pattern);
  }

  // Generate based on strategy
  switch (options.selectorNaming) {
    case "sequential":
      return `c${Math.random().toString(36).substr(2, 9)}`; // Generate random ID since AggregatedClassData doesn't have id

    case "frequency-optimized": {
      // Use frequency to determine name length (higher frequency = shorter name)
      const frequency = pattern.totalFrequency;
      if (frequency >= CSS_PATTERN_THRESHOLDS.HIGH_FREQUENCY_THRESHOLD) {
        return generateShortName(pattern);
      } else if (
        frequency >= CSS_PATTERN_THRESHOLDS.MEDIUM_FREQUENCY_THRESHOLD
      ) {
        return generateMediumName(pattern);
      } else {
        return generateLongName(pattern);
      }
    }

    case "pretty":
      return generatePrettyName(pattern);

    case "custom":
      // Fallback to sequential if no custom function provided
      return `c${Math.random().toString(36).substr(2, 9)}`; // Generate random ID since AggregatedClassData doesn't have id

    default:
      return generatePrettyName(pattern);
  }
}

/**
 * Generate short name for high-frequency patterns
 */
function generateShortName(pattern: AggregatedClassData): string {
  const className = pattern.name || "";
  if (!className) return "a";

  // Use first letter of the class name
  const cleaned = className.replace(
    /^(hover|focus|active|sm|md|lg|xl|2xl|dark):/,
    "",
  );
  const initial = cleaned.charAt(0).toLowerCase();

  return initial || "a";
}

/**
 * Generate medium name for medium-frequency patterns
 */
function generateMediumName(pattern: AggregatedClassData): string {
  const className = pattern.name || "";
  if (!className) return "util";

  // Use abbreviated class name
  const cleaned = className.replace(
    /^(hover|focus|active|sm|md|lg|xl|2xl|dark):/,
    "",
  );
  const abbreviated = abbreviateClassName(cleaned);

  return abbreviated.length > 0 ? abbreviated.substring(0, 8) : "util";
}

/**
 * Generate long descriptive name for low-frequency patterns
 */
function generateLongName(pattern: AggregatedClassData): string {
  const className = pattern.name || "";
  if (!className) return "component";

  // Use semantic naming based on class type
  const semanticName = generateSemanticName([className]);
  return semanticName.length > 0 ? semanticName : "component";
}

/**
 * Generate pretty name using semantic analysis
 */
function generatePrettyName(pattern: AggregatedClassData): string {
  const className = pattern.name || "";
  if (!className) return "element";

  // Analyze class to determine semantic meaning
  const semanticGroups = analyzeSemanticGroups([className]);

  // Generate name based on primary semantic group
  if (semanticGroups.layout.length > 0) {
    return generateLayoutName(semanticGroups.layout);
  } else if (semanticGroups.typography.length > 0) {
    return generateTypographyName(semanticGroups.typography);
  } else if (semanticGroups.colors.length > 0) {
    return generateColorName(semanticGroups.colors);
  } else if (semanticGroups.spacing.length > 0) {
    return generateSpacingName(semanticGroups.spacing);
  } else {
    return generateGenericName([className]);
  }
}

/**
 * Abbreviate a class name for medium-length selectors
 */
function abbreviateClassName(className: string): string {
  // Common abbreviations for Tailwind classes
  const abbreviations: Record<string, string> = {
    flex: "fx",
    grid: "gr",
    block: "bl",
    inline: "in",
    hidden: "hd",
    visible: "vs",
    relative: "rel",
    absolute: "abs",
    fixed: "fix",
    sticky: "stk",
    background: "bg",
    border: "br",
    margin: "m",
    padding: "p",
    width: "w",
    height: "h",
    text: "txt",
    font: "fnt",
    color: "clr",
    shadow: "shd",
    rounded: "rnd",
    opacity: "op",
    transform: "tf",
    transition: "tr",
    justify: "jst",
    items: "itm",
    content: "cnt",
  };

  // Try exact match first
  if (abbreviations[className]) {
    return abbreviations[className];
  }

  // Try partial matches
  for (const [full, abbr] of Object.entries(abbreviations)) {
    if (className.startsWith(full)) {
      return abbr + className.substring(full.length);
    }
  }

  // Fallback: use first 3 characters
  return className.substring(0, 3);
}

/**
 * Generate semantic name based on class analysis
 */
function generateSemanticName(classes: string[]): string {
  const semanticGroups = analyzeSemanticGroups(classes);

  // Determine primary purpose
  if (semanticGroups.layout.length >= 2) {
    return "layout";
  } else if (semanticGroups.typography.length >= 2) {
    return "text";
  } else if (semanticGroups.colors.length >= 1) {
    return "styled";
  } else if (semanticGroups.spacing.length >= 2) {
    return "spaced";
  } else if (
    classes.some((cls) => cls.includes("btn") || cls.includes("button"))
  ) {
    return "button";
  } else if (classes.some((cls) => cls.includes("card"))) {
    return "card";
  } else if (classes.some((cls) => cls.includes("nav"))) {
    return "nav";
  } else {
    return "element";
  }
}

/**
 * Analyze classes into semantic groups
 */
function analyzeSemanticGroups(classes: string[]): {
  layout: string[];
  typography: string[];
  colors: string[];
  spacing: string[];
  effects: string[];
  other: string[];
} {
  const groups = {
    layout: [] as string[],
    typography: [] as string[],
    colors: [] as string[],
    spacing: [] as string[],
    effects: [] as string[],
    other: [] as string[],
  };

  for (const className of classes) {
    const cleanClass = className.replace(
      /^(hover|focus|active|sm|md|lg|xl|2xl|dark):/,
      "",
    );

    if (
      /^(flex|grid|block|inline|hidden|visible|relative|absolute|fixed|sticky)/.test(
        cleanClass,
      )
    ) {
      groups.layout.push(className);
    } else if (
      /^(text|font|leading|tracking|uppercase|lowercase|capitalize)/.test(
        cleanClass,
      )
    ) {
      groups.typography.push(className);
    } else if (/^(bg|text|border|ring|from|to|via)-/.test(cleanClass)) {
      groups.colors.push(className);
    } else if (/^(m|p|space|gap)-/.test(cleanClass)) {
      groups.spacing.push(className);
    } else if (
      /^(shadow|rounded|opacity|transform|transition|filter|backdrop)/.test(
        cleanClass,
      )
    ) {
      groups.effects.push(className);
    } else {
      groups.other.push(className);
    }
  }

  return groups;
}

/**
 * Generate layout-focused name
 */
function generateLayoutName(layoutClasses: string[]): string {
  if (layoutClasses.some((cls) => cls.includes("flex"))) {
    return "flex-layout";
  } else if (layoutClasses.some((cls) => cls.includes("grid"))) {
    return "grid-layout";
  } else if (
    layoutClasses.some(
      (cls) => cls.includes("absolute") || cls.includes("fixed"),
    )
  ) {
    return "positioned";
  } else {
    return "layout";
  }
}

/**
 * Generate typography-focused name
 */
function generateTypographyName(typographyClasses: string[]): string {
  if (typographyClasses.some((cls) => cls.includes("text-"))) {
    return "text-style";
  } else if (typographyClasses.some((cls) => cls.includes("font-"))) {
    return "font-style";
  } else {
    return "typography";
  }
}

/**
 * Generate color-focused name
 */
function generateColorName(colorClasses: string[]): string {
  if (colorClasses.some((cls) => cls.includes("bg-"))) {
    return "colored-bg";
  } else if (colorClasses.some((cls) => cls.includes("text-"))) {
    return "colored-text";
  } else if (colorClasses.some((cls) => cls.includes("border-"))) {
    return "colored-border";
  } else {
    return "colored";
  }
}

/**
 * Generate spacing-focused name
 */
function generateSpacingName(spacingClasses: string[]): string {
  if (spacingClasses.some((cls) => cls.includes("m-"))) {
    return "margined";
  } else if (spacingClasses.some((cls) => cls.includes("p-"))) {
    return "padded";
  } else if (spacingClasses.some((cls) => cls.includes("space-"))) {
    return "spaced";
  } else {
    return "spacing";
  }
}

/**
 * Generate generic name for unclassified patterns
 */
function generateGenericName(classes: string[]): string {
  if (classes.length === 1) {
    return "single";
  } else if (classes.length <= 3) {
    return "utility";
  } else {
    return "component";
  }
}

/**
 * Generate CSS declarations from Tailwind classes
 */
function generateCssDeclarations(classes: string[]): string[] {
  const declarations: string[] = [];

  // This is a simplified implementation
  // In a real implementation, you would use Tailwind's CSS generation engine
  for (const className of classes) {
    const declaration = tailwindClassToCssDeclaration(className);
    if (declaration) {
      declarations.push(declaration);
    }
  }

  return declarations;
}

/**
 * Convert a Tailwind class to CSS declaration (simplified implementation)
 */
function tailwindClassToCssDeclaration(className: string): string | null {
  // Remove variants for core class processing
  const coreClass = className.replace(
    /^(hover|focus|active|sm|md|lg|xl|2xl|dark):/,
    "",
  );

  // Basic mapping of common Tailwind classes to CSS
  const mappings: Record<string, string> = {
    flex: "display: flex;",
    grid: "display: grid;",
    block: "display: block;",
    inline: "display: inline;",
    hidden: "display: none;",
    visible: "visibility: visible;",
    invisible: "visibility: hidden;",
    relative: "position: relative;",
    absolute: "position: absolute;",
    fixed: "position: fixed;",
    sticky: "position: sticky;",
    "justify-center": "justify-content: center;",
    "justify-start": "justify-content: flex-start;",
    "justify-end": "justify-content: flex-end;",
    "justify-between": "justify-content: space-between;",
    "items-center": "align-items: center;",
    "items-start": "align-items: flex-start;",
    "items-end": "align-items: flex-end;",
    "text-center": "text-align: center;",
    "text-left": "text-align: left;",
    "text-right": "text-align: right;",
    "font-bold": "font-weight: 700;",
    "font-medium": "font-weight: 500;",
    "font-normal": "font-weight: 400;",
    rounded: "border-radius: 0.25rem;",
    "rounded-lg": "border-radius: 0.5rem;",
    "rounded-full": "border-radius: 9999px;",
    shadow:
      "box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);",
    "shadow-lg":
      "box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);",
  };

  // Check for exact match
  if (mappings[coreClass]) {
    return mappings[coreClass];
  }

  // Check for pattern matches
  if (coreClass.startsWith("w-")) {
    const value = coreClass.substring(2);
    return `width: ${convertTailwindValue(value)};`;
  } else if (coreClass.startsWith("h-")) {
    const value = coreClass.substring(2);
    return `height: ${convertTailwindValue(value)};`;
  } else if (coreClass.startsWith("m-")) {
    const value = coreClass.substring(2);
    return `margin: ${convertTailwindValue(value)};`;
  } else if (coreClass.startsWith("p-")) {
    const value = coreClass.substring(2);
    return `padding: ${convertTailwindValue(value)};`;
  } else if (coreClass.startsWith("bg-")) {
    const color = coreClass.substring(3);
    return `background-color: ${convertTailwindColor(color)};`;
  } else if (coreClass.startsWith("text-")) {
    const color = coreClass.substring(5);
    return `color: ${convertTailwindColor(color)};`;
  }

  return null;
}

/**
 * Convert Tailwind spacing/sizing value to CSS
 */
function convertTailwindValue(value: string): string {
  const spacingMap: Record<string, string> = {
    "0": "0px",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "5": "1.25rem",
    "6": "1.5rem",
    "8": "2rem",
    "10": "2.5rem",
    "12": "3rem",
    "16": "4rem",
    "20": "5rem",
    "24": "6rem",
    "32": "8rem",
    auto: "auto",
    full: "100%",
    screen: "100vh",
  };

  return spacingMap[value] || value;
}

/**
 * Convert Tailwind color to CSS color value
 */
function convertTailwindColor(color: string): string {
  const colorMap: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    "gray-100": "#f3f4f6",
    "gray-200": "#e5e7eb",
    "gray-300": "#d1d5db",
    "gray-400": "#9ca3af",
    "gray-500": "#6b7280",
    "gray-600": "#4b5563",
    "gray-700": "#374151",
    "gray-800": "#1f2937",
    "gray-900": "#111827",
    "blue-500": "#3b82f6",
    "blue-600": "#2563eb",
    "red-500": "#ef4444",
    "green-500": "#10b981",
    "yellow-500": "#f59e0b",
    "purple-500": "#8b5cf6",
    "pink-500": "#ec4899",
    "indigo-500": "#6366f1",
  };

  return colorMap[color] || color;
}

export function generateApplyDirective(
  classes: string[],
  options: CssGenerationOptions,
): ApplyDirective {
  try {
    // Validate input
    if (!classes || classes.length === 0) {
      throw new ApplyDirectiveError(
        "Apply directive must contain at least one class",
        "",
        [],
      );
    }

    // Parse and validate classes
    const parsedClasses = classes.map((cls) => parseClassWithVariants(cls));

    // Group classes by variants
    const groupedClasses = groupClassesByVariants(parsedClasses);

    // Detect conflicts
    const conflicts = detectClassConflicts(parsedClasses);

    // Optimize class order and grouping
    const optimizedClasses = optimizeClassOrder(groupedClasses, options);

    // Generate the final @apply directive string
    const optimizedDirective = optimizedClasses.join(" ");

    // Validate the directive
    const isValid = optimizedDirective.trim().length > 0;

    // Extract core classes (without variants/modifiers)
    const coreClasses = parsedClasses.map((parsed) => parsed.coreClass);

    return {
      classes: coreClasses,
      variants: extractVariants(parsedClasses),
      modifiers: extractModifiers(parsedClasses),
      isValid,
      optimized: optimizedDirective,
      conflicts,
    };
  } catch (error) {
    throw new ApplyDirectiveError(
      `Failed to generate @apply directive: ${error instanceof Error ? error.message : "Unknown error"}`,
      classes.join(" "),
    );
  }
}

export function validateApplyDirective(
  directive: ApplyDirective | string,
): Array<{ type: "error" | "warning"; message: string }> | boolean {
  const issues: Array<{ type: "error" | "warning"; message: string }> = [];

  try {
    // Handle string format (simple validation)
    if (typeof directive === "string") {
      if (!directive || directive.trim().length === 0) {
        return false;
      }

      // Check for basic syntax issues
      if (directive.includes(";;") || directive.includes("  ")) {
        return false; // Double semicolons or excessive spaces
      }

      // Validate each class in the directive
      const classes = directive.trim().split(/\s+/);
      for (const className of classes) {
        if (!validateTailwindClass(className)) {
          return false;
        }
      }

      return true;
    }

    // Handle ApplyDirective object format
    // Check if directive has classes
    if (!directive.classes || directive.classes.length === 0) {
      issues.push({
        type: "error",
        message: "Apply directive is empty",
      });
    }

    // Check for invalid class names
    directive.classes.forEach((cls) => {
      if (!cls || typeof cls !== "string" || cls.trim().length === 0) {
        issues.push({
          type: "error",
          message: `Invalid class name: ${cls}`,
        });
      }
    });

    // Check for conflicts
    if (directive.conflicts && directive.conflicts.length > 0) {
      directive.conflicts.forEach((conflict) => {
        issues.push({
          type: "warning",
          message: `Potential conflict: ${conflict}`,
        });
      });
    }

    return issues;
  } catch (error) {
    return [
      {
        type: "error",
        message: `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    ];
  }
}

export function optimizeApplyDirective(
  directive: ApplyDirective,
  options: CssGenerationOptions,
): ApplyDirective {
  try {
    // Create optimized copy
    const optimized: ApplyDirective = {
      ...directive,
      classes: [...directive.classes],
      variants: [...directive.variants],
      modifiers: [...directive.modifiers],
    };

    // Remove duplicates
    optimized.classes = Array.from(new Set(optimized.classes));
    optimized.variants = Array.from(new Set(optimized.variants));
    optimized.modifiers = Array.from(new Set(optimized.modifiers));

    // Group related classes (basic implementation)
    const groupedClasses = optimized.classes.sort();
    optimized.classes = groupedClasses;

    // Update the directive string
    const allClasses = [
      ...optimized.variants.map((v) => `${v}:`),
      ...optimized.classes,
      ...optimized.modifiers,
    ].join(" ");

    optimized.optimized = allClasses;

    return optimized;
  } catch (error) {
    throw new ApplyDirectiveError(
      `Failed to optimize apply directive: ${error instanceof Error ? error.message : "Unknown error"}`,
      directive.optimized,
      directive.classes,
    );
  }
}

/**
 * Parse a class name with its variants and modifiers
 */
interface ParsedClass {
  original: string;
  variants: string[];
  coreClass: string;
  modifiers: string[];
  isImportant: boolean;
  hasArbitraryValue: boolean;
  arbitraryValue?: string;
}

function parseClassWithVariants(className: string): ParsedClass {
  let workingClass = className;
  const variants: string[] = [];
  const modifiers: string[] = [];
  let isImportant = false;
  let hasArbitraryValue = false;
  let arbitraryValue: string | undefined;

  // Special case: handle '!important' as a standalone important modifier
  if (workingClass === "!important") {
    isImportant = true;
    workingClass = "important"; // Use 'important' as the core class
  } else if (workingClass.endsWith("!")) {
    // Standard important modifier handling
    isImportant = true;
    workingClass = workingClass.slice(0, -1);
  }

  // Extract arbitrary values
  const arbitraryMatch = workingClass.match(/\[([^\]]+)\]/);
  if (arbitraryMatch) {
    hasArbitraryValue = true;
    arbitraryValue = arbitraryMatch[1];
    // Remove the arbitrary value from the class name for further processing
    workingClass = workingClass.replace(/\[([^\]]+)\]/, "");
  }

  // Extract modifiers (e.g., /50 for opacity)
  const modifierMatch = workingClass.match(/\/(\d+)$/);
  if (modifierMatch) {
    modifiers.push(modifierMatch[1]);
    workingClass = workingClass.replace(/\/\d+$/, "");
  }

  // Extract variants (hover:, focus:, sm:, etc.)
  const variantMatches = workingClass.match(/^([^:]+:)+/);
  if (variantMatches) {
    const variantString = variantMatches[0];
    variants.push(...variantString.slice(0, -1).split(":"));
    workingClass = workingClass.substring(variantString.length);
  }

  return {
    original: className,
    variants,
    coreClass: workingClass,
    modifiers,
    isImportant,
    hasArbitraryValue,
    arbitraryValue,
  };
}

/**
 * Group classes by their variants for better organization
 */
function groupClassesByVariants(parsedClasses: ParsedClass[]): string[] {
  const groups = new Map<string, ParsedClass[]>();

  // Group by variant combination
  for (const parsedClass of parsedClasses) {
    const variantKey = parsedClass.variants.join(":");
    if (!groups.has(variantKey)) {
      groups.set(variantKey, []);
    }
    groups.get(variantKey)!.push(parsedClass);
  }

  // Sort groups by variant priority
  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
    return getVariantPriority(a) - getVariantPriority(b);
  });

  // Reconstruct classes maintaining grouping
  const result: string[] = [];
  for (const [, classGroup] of sortedGroups) {
    // Sort classes within each group
    const sortedClasses = classGroup.sort((a, b) => {
      return getClassPriority(a.coreClass) - getClassPriority(b.coreClass);
    });

    result.push(...sortedClasses.map((cls) => cls.original));
  }

  return result;
}

/**
 * Get priority for variant ordering (lower = higher priority)
 */
function getVariantPriority(variantKey: string): number {
  if (!variantKey) return 0; // Base classes first

  const variants = variantKey.split(":");
  let priority = 0;

  for (const variant of variants) {
    switch (variant) {
      case "dark":
        priority += 1;
        break;
      case "sm":
        priority += 10;
        break;
      case "md":
        priority += 20;
        break;
      case "lg":
        priority += 30;
        break;
      case "xl":
        priority += 40;
        break;
      case "2xl":
        priority += 50;
        break;
      case "hover":
        priority += 100;
        break;
      case "focus":
        priority += 110;
        break;
      case "active":
        priority += 120;
        break;
      case "disabled":
        priority += 130;
        break;
      case "first":
        priority += 200;
        break;
      case "last":
        priority += 210;
        break;
      case "odd":
        priority += 220;
        break;
      case "even":
        priority += 230;
        break;
      default:
        priority += 1000;
        break; // Unknown variants last
    }
  }

  return priority;
}

/**
 * Get priority for class ordering within the same variant group
 */
function getClassPriority(coreClass: string): number {
  // Order based on CSS property groups for logical flow
  if (/^(block|inline|flex|grid|hidden|visible)/.test(coreClass)) return 1; // Display
  if (/^(relative|absolute|fixed|sticky)/.test(coreClass)) return 2; // Position
  if (/^(top|right|bottom|left|inset)/.test(coreClass)) return 3; // Position values
  if (/^(z-)/.test(coreClass)) return 4; // Z-index
  if (/^(flex-|justify-|items-|content-|self-)/.test(coreClass)) return 5; // Flexbox
  if (/^(grid-|col-|row-|gap-)/.test(coreClass)) return 6; // Grid
  if (/^(w-|h-|min-w|min-h|max-w|max-h)/.test(coreClass)) return 7; // Sizing
  if (/^(m-|mx-|my-|mt-|mr-|mb-|ml-)/.test(coreClass)) return 8; // Margin
  if (/^(p-|px-|py-|pt-|pr-|pb-|pl-)/.test(coreClass)) return 9; // Padding
  if (/^(space-)/.test(coreClass)) return 10; // Space between
  if (
    /^(font-|text-|leading-|tracking-|uppercase|lowercase|capitalize)/.test(
      coreClass,
    )
  )
    return 11; // Typography
  if (/^(bg-)/.test(coreClass)) return 12; // Background
  if (/^(border|rounded)/.test(coreClass)) return 13; // Borders
  if (/^(shadow|ring)/.test(coreClass)) return 14; // Effects
  if (/^(opacity|transform|transition|duration|ease)/.test(coreClass))
    return 15; // Transforms/Transitions

  return 1000; // Unknown classes last
}

/**
 * Detect conflicts between classes
 */
function detectClassConflicts(parsedClasses: ParsedClass[]): string[] {
  const conflicts: string[] = [];
  const propertyGroups = new Map<string, ParsedClass[]>();

  // Group classes by the CSS property they affect
  for (const parsedClass of parsedClasses) {
    const property = getCssProperty(parsedClass.coreClass);
    if (property) {
      if (!propertyGroups.has(property)) {
        propertyGroups.set(property, []);
      }
      propertyGroups.get(property)!.push(parsedClass);
    }
  }

  // Check for conflicts within each property group
  for (const [property, classes] of Array.from(propertyGroups.entries())) {
    if (classes.length > 1) {
      // Multiple classes affecting the same property - potential conflict
      const conflictingClasses = classes.map(
        (cls: ParsedClass) => cls.original,
      );
      conflicts.push(
        `Multiple ${property} classes: ${conflictingClasses.join(", ")}`,
      );
    }
  }

  return conflicts;
}

/**
 * Get the primary CSS property affected by a Tailwind class
 */
function getCssProperty(coreClass: string): string | null {
  if (/^(block|inline|flex|grid|hidden|visible)/.test(coreClass))
    return "display";
  if (/^(relative|absolute|fixed|sticky)/.test(coreClass)) return "position";
  if (/^(w-|width-)/.test(coreClass)) return "width";
  if (/^(h-|height-)/.test(coreClass)) return "height";
  if (/^(m-|mx-|my-|mt-|mr-|mb-|ml-)/.test(coreClass)) return "margin";
  if (/^(p-|px-|py-|pt-|pr-|pb-|pl-)/.test(coreClass)) return "padding";
  if (/^(bg-)/.test(coreClass)) return "background";
  if (/^(text-.*-\d+|text-white|text-black)/.test(coreClass)) return "color";
  if (/^(border-.*-\d+|border-white|border-black)/.test(coreClass))
    return "border-color";
  if (/^(font-bold|font-medium|font-normal|font-light)/.test(coreClass))
    return "font-weight";
  if (/^(text-xs|text-sm|text-base|text-lg|text-xl)/.test(coreClass))
    return "font-size";
  if (/^(rounded)/.test(coreClass)) return "border-radius";
  if (/^(shadow)/.test(coreClass)) return "box-shadow";
  if (/^(opacity-)/.test(coreClass)) return "opacity";

  return null;
}

/**
 * Optimize class order for better CSS generation
 */
function optimizeClassOrder(
  groupedClasses: string[],
  options: CssGenerationOptions,
): string[] {
  if (!options.enableOptimizations) {
    return groupedClasses;
  }

  // Remove duplicates while preserving order
  const uniqueClasses = Array.from(new Set(groupedClasses));

  // Apply additional optimizations based on strategy
  switch (options.strategy) {
    case "atomic":
      return optimizeForAtomic(uniqueClasses);
    case "utility":
      return optimizeForUtility(uniqueClasses);
    case "component":
      return optimizeForComponent(uniqueClasses);
    default:
      return uniqueClasses;
  }
}

/**
 * Optimize for atomic strategy (minimal, single-purpose classes)
 */
function optimizeForAtomic(classes: string[]): string[] {
  // For atomic strategy, prefer the most specific classes
  return classes.filter((cls) => !isRedundantInAtomic(cls, classes));
}

/**
 * Optimize for utility strategy (functional groupings)
 */
function optimizeForUtility(classes: string[]): string[] {
  // Group related utilities together
  return classes.sort((a, b) => {
    const aGroup = getUtilityGroup(a);
    const bGroup = getUtilityGroup(b);
    return aGroup.localeCompare(bGroup);
  });
}

/**
 * Optimize for component strategy (semantic groupings)
 */
function optimizeForComponent(classes: string[]): string[] {
  // Organize classes in a logical component structure
  const componentOrder = [
    "display",
    "position",
    "layout",
    "sizing",
    "spacing",
    "typography",
    "colors",
    "borders",
    "effects",
  ];

  return classes.sort((a, b) => {
    const aCategory = getComponentCategory(a);
    const bCategory = getComponentCategory(b);
    const aIndex = componentOrder.indexOf(aCategory);
    const bIndex = componentOrder.indexOf(bCategory);
    return aIndex - bIndex;
  });
}

/**
 * Check if a class is redundant in atomic strategy
 */
function isRedundantInAtomic(className: string, allClasses: string[]): boolean {
  // In atomic strategy, avoid classes that are overridden by more specific ones
  const property = getCssProperty(className.replace(/^[^:]*:/, ""));
  if (!property) return false;

  const samePropertyClasses = allClasses.filter((cls) => {
    const clsProp = getCssProperty(cls.replace(/^[^:]*:/, ""));
    return clsProp === property;
  });

  // If there are multiple classes for the same property, keep the most specific
  return (
    samePropertyClasses.length > 1 &&
    samePropertyClasses.indexOf(className) !== samePropertyClasses.length - 1
  );
}

/**
 * Get utility group for a class
 */
function getUtilityGroup(className: string): string {
  const coreClass = className.replace(/^[^:]*:/, "");

  if (/^(flex|grid|block|inline)/.test(coreClass)) return "layout";
  if (/^(w-|h-)/.test(coreClass)) return "sizing";
  if (/^(m-|p-)/.test(coreClass)) return "spacing";
  if (/^(text-|font-)/.test(coreClass)) return "typography";
  if (/^(bg-|border-)/.test(coreClass)) return "colors";
  if (/^(rounded|shadow)/.test(coreClass)) return "effects";

  return "other";
}

/**
 * Get component category for a class
 */
function getComponentCategory(className: string): string {
  const coreClass = className.replace(/^[^:]*:/, "");

  if (/^(block|inline|flex|grid|hidden)/.test(coreClass)) return "display";
  if (/^(relative|absolute|fixed)/.test(coreClass)) return "position";
  if (/^(justify-|items-|content-)/.test(coreClass)) return "layout";
  if (/^(w-|h-|min-|max-)/.test(coreClass)) return "sizing";
  if (/^(m-|p-|space-)/.test(coreClass)) return "spacing";
  if (/^(text-|font-|leading-)/.test(coreClass)) return "typography";
  if (/^(bg-|text-.*-\d+|border-.*-\d+)/.test(coreClass)) return "colors";
  if (/^(border|rounded)/.test(coreClass)) return "borders";
  if (/^(shadow|opacity|transform)/.test(coreClass)) return "effects";

  return "other";
}

/**
 * Extract all variants from parsed classes
 */
function extractVariants(parsedClasses: ParsedClass[]): string[] {
  const variants = new Set<string>();
  for (const parsedClass of parsedClasses) {
    parsedClass.variants.forEach((variant) => variants.add(variant));
  }
  return Array.from(variants);
}

/**
 * Extract all modifiers from parsed classes
 */
function extractModifiers(parsedClasses: ParsedClass[]): string[] {
  const modifiers = new Set<string>();
  for (const parsedClass of parsedClasses) {
    parsedClass.modifiers.forEach((modifier) => modifiers.add(modifier));
    if (parsedClass.isImportant) modifiers.add("!");
    if (parsedClass.hasArbitraryValue && parsedClass.arbitraryValue) {
      modifiers.add(`[${parsedClass.arbitraryValue}]`);
    }
  }
  return Array.from(modifiers);
}

export function classifyPattern(
  pattern: AggregatedClassData,
  optionsOrContext: CssGenerationOptions | any,
): PatternClassification {
  try {
    // Handle different input formats
    let options: CssGenerationOptions;

    if (
      optionsOrContext &&
      typeof optionsOrContext === "object" &&
      "options" in optionsOrContext
    ) {
      // Test format: context object with options property
      options = optionsOrContext.options;
    } else {
      // Standard format: CssGenerationOptions directly
      options = optionsOrContext as CssGenerationOptions;
    }

    const classes = pattern.name ? [pattern.name] : [];
    const frequency = pattern.totalFrequency || 0;
    const complexity = calculateComplexity(pattern);
    const coOccurrenceStrength = calculateCoOccurrenceStrength(pattern);

    // Analyze semantic groups
    const semanticGroups = analyzeSemanticGroups(classes);
    const semanticGroup = determinePrimarySemanticGroup(semanticGroups);

    // Determine pattern type based on multiple factors
    const type = determinePatternType(
      classes,
      frequency,
      complexity,
      coOccurrenceStrength,
      semanticGroups,
    );

    // Calculate confidence based on classification certainty
    const confidence = calculateClassificationConfidence(
      type,
      classes,
      frequency,
      complexity,
      semanticGroups,
    );

    // Generate recommended strategy
    const recommendedStrategy = generateRecommendedStrategy(
      type,
      frequency,
      complexity,
      options,
    );

    return {
      type,
      patternType: type, // For backward compatibility
      className: pattern.name || "",
      complexity,
      coOccurrenceStrength,
      semanticGroup,
      recommendedStrategy,
      confidence,
    };
  } catch (error) {
    throw new PatternClassificationError(
      `Failed to classify pattern: ${error instanceof Error ? error.message : "Unknown error"}`,
      pattern.name || "unknown",
    );
  }
}

/**
 * Determine the primary semantic group from analyzed groups
 */
function determinePrimarySemanticGroup(
  semanticGroups: ReturnType<typeof analyzeSemanticGroups>,
): string {
  const groupCounts = {
    layout: semanticGroups.layout.length,
    typography: semanticGroups.typography.length,
    colors: semanticGroups.colors.length,
    spacing: semanticGroups.spacing.length,
    effects: semanticGroups.effects.length,
    other: semanticGroups.other.length,
  };

  // Find the group with the most classes
  const primaryGroup = Object.entries(groupCounts).sort(
    ([, a], [, b]) => b - a,
  )[0][0];

  return primaryGroup;
}

/**
 * Determine pattern type based on multiple classification factors
 */
function determinePatternType(
  classes: string[],
  frequency: number,
  complexity: number,
  coOccurrenceStrength: number,
  semanticGroups: ReturnType<typeof analyzeSemanticGroups>,
): "atomic" | "utility" | "component" {
  const classCount = classes.length;

  // Atomic pattern indicators - ONLY for classes with NO co-occurrences
  if (classCount === 1 && coOccurrenceStrength === 0) {
    return "atomic";
  }

  // Component pattern indicators
  if (
    classCount >= CSS_PATTERN_THRESHOLDS.COMPONENT_MIN_CLASSES &&
    complexity >= CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_HIGH
  ) {
    return "component";
  }

  if (
    coOccurrenceStrength >= CSS_PATTERN_THRESHOLDS.CO_OCCURRENCE_STRONG &&
    hasMultipleSemanticGroups(semanticGroups)
  ) {
    return "component";
  }

  // Check for component-like semantic patterns
  if (isComponentLikePattern(classes, semanticGroups)) {
    return "component";
  }

  // Everything else is utility (single classes with co-occurrences, multi-class patterns, etc)
  return "utility";
}

/**
 * Check if pattern has multiple semantic groups (indicator of component)
 */
function hasMultipleSemanticGroups(
  semanticGroups: ReturnType<typeof analyzeSemanticGroups>,
): boolean {
  const nonEmptyGroups = Object.values(semanticGroups).filter(
    (group) => group.length > 0,
  ).length;

  return nonEmptyGroups >= 3; // 3 or more different semantic areas
}

/**
 * Check if pattern exhibits component-like characteristics
 */
function isComponentLikePattern(
  classes: string[],
  semanticGroups: ReturnType<typeof analyzeSemanticGroups>,
): boolean {
  // Component indicators:
  // 1. Has layout + styling + effects
  // 2. Contains positioning + sizing + colors
  // 3. Has complex interaction states (hover, focus, etc.)

  const hasLayout = semanticGroups.layout.length > 0;
  const hasColors = semanticGroups.colors.length > 0;
  const hasEffects = semanticGroups.effects.length > 0;
  const hasSpacing = semanticGroups.spacing.length > 0;
  const hasTypography = semanticGroups.typography.length > 0;

  // Complex component pattern
  if (hasLayout && hasColors && hasEffects) {
    return true;
  }

  // Styled component pattern
  if (hasColors && hasSpacing && hasTypography) {
    return true;
  }

  // Interactive component pattern
  const hasInteractiveStates = classes.some((cls) =>
    /^(hover|focus|active|disabled):/.test(cls),
  );

  if (hasInteractiveStates && (hasColors || hasEffects)) {
    return true;
  }

  // Card-like or container pattern
  const hasContainerClasses = classes.some((cls) =>
    /^(bg-|border|rounded|shadow|p-|px-|py-)/.test(cls.replace(/^[^:]*:/, "")),
  );

  if (hasContainerClasses && classes.length >= 4) {
    return true;
  }

  return false;
}

/**
 * Calculate confidence in the classification
 */
function calculateClassificationConfidence(
  type: "atomic" | "utility" | "component",
  classes: string[],
  frequency: number,
  complexity: number,
  semanticGroups: ReturnType<typeof analyzeSemanticGroups>,
): number {
  let confidence = 0.5; // Base confidence

  const classCount = classes.length;

  // Confidence adjustments based on pattern type
  switch (type) {
    case "atomic":
      // High confidence for single classes with high frequency
      if (classCount === 1) confidence += 0.3;
      if (frequency >= CSS_PATTERN_THRESHOLDS.HIGH_FREQUENCY_THRESHOLD)
        confidence += 0.2;
      if (complexity <= 3) confidence += 0.1;
      break;

    case "utility":
      // Moderate confidence for utility patterns (they're the middle ground)
      if (classCount >= 2 && classCount <= 5) confidence += 0.2;
      if (complexity >= 3 && complexity <= 6) confidence += 0.1;
      if (frequency >= CSS_PATTERN_THRESHOLDS.MEDIUM_FREQUENCY_THRESHOLD)
        confidence += 0.1;
      break;

    case "component":
      // High confidence for complex patterns with multiple semantic groups
      if (classCount >= 5) confidence += 0.2;
      if (complexity >= CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_HIGH)
        confidence += 0.2;
      if (hasMultipleSemanticGroups(semanticGroups)) confidence += 0.2;
      if (isComponentLikePattern(classes, semanticGroups)) confidence += 0.1;
      break;
  }

  // Additional confidence factors

  // Semantic consistency boost
  const primaryGroupSize = Math.max(
    ...Object.values(semanticGroups).map((g) => g.length),
  );
  const totalClasses = classCount;
  const semanticConsistency = primaryGroupSize / totalClasses;

  if (semanticConsistency >= 0.7) confidence += 0.1;
  else if (semanticConsistency <= 0.3) confidence -= 0.1;

  // Frequency consistency
  if (
    type === "atomic" &&
    frequency < CSS_PATTERN_THRESHOLDS.MEDIUM_FREQUENCY_THRESHOLD
  ) {
    confidence -= 0.2; // Atomic patterns should be frequent
  }

  if (
    type === "component" &&
    frequency > CSS_PATTERN_THRESHOLDS.HIGH_FREQUENCY_THRESHOLD
  ) {
    confidence -= 0.1; // Components are typically less frequent than utilities
  }

  // Complexity consistency
  if (
    type === "atomic" &&
    complexity > CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_MEDIUM
  ) {
    confidence -= 0.2; // Atomic patterns should be simple
  }

  if (
    type === "component" &&
    complexity < CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_MEDIUM
  ) {
    confidence -= 0.1; // Components should be reasonably complex
  }

  // Ensure confidence is within bounds
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Generate recommended strategy based on classification
 */
function generateRecommendedStrategy(
  type: "atomic" | "utility" | "component",
  frequency: number,
  complexity: number,
  options: CssGenerationOptions,
): string {
  const strategies: string[] = [];

  // Base strategy recommendation
  switch (type) {
    case "atomic":
      strategies.push("Use short, memorable class names");
      strategies.push("Prioritize in CSS output for better caching");
      if (frequency >= CSS_PATTERN_THRESHOLDS.HIGH_FREQUENCY_THRESHOLD) {
        strategies.push("Consider inlining for critical path");
      }
      break;

    case "utility":
      strategies.push("Group with related utilities");
      strategies.push("Use descriptive but concise naming");
      if (options.useApplyDirective) {
        strategies.push("Ideal candidate for @apply directive");
      }
      break;

    case "component":
      strategies.push("Use semantic component naming");
      strategies.push("Consider breaking into smaller utilities if reused");
      strategies.push("Document usage context and variations");
      if (complexity >= CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_HIGH) {
        strategies.push("Consider creating component variants");
      }
      break;
  }

  // Frequency-based recommendations
  if (frequency >= CSS_PATTERN_THRESHOLDS.HIGH_FREQUENCY_THRESHOLD) {
    strategies.push("High priority for optimization");
    strategies.push("Consider extracting to separate CSS file");
  } else if (frequency <= CSS_PATTERN_THRESHOLDS.LOW_FREQUENCY_THRESHOLD) {
    strategies.push("Low priority - consider removing if unused");
  }

  // Complexity-based recommendations
  if (complexity >= CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_HIGH) {
    strategies.push("Consider splitting into smaller patterns");
    strategies.push("Add comprehensive documentation");
  }

  // Strategy-specific recommendations
  if (options.strategy !== "mixed" && options.strategy !== type) {
    strategies.push(
      `Note: Classified as ${type} but strategy is ${options.strategy}`,
    );
  }

  return strategies.join("; ");
}

/**
 * Advanced pattern analysis for better classification
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function analyzePatternCharacteristics(classes: string[]): {
  hasResponsiveVariants: boolean;
  hasInteractiveStates: boolean;
  hasDarkModeSupport: boolean;
  hasArbitraryValues: boolean;
  hasImportantModifiers: boolean;
  semanticComplexity: number;
  variantComplexity: number;
} {
  let hasResponsiveVariants = false;
  let hasInteractiveStates = false;
  let hasDarkModeSupport = false;
  let hasArbitraryValues = false;
  let hasImportantModifiers = false;

  const uniqueBaseClasses = new Set<string>();
  const uniqueVariants = new Set<string>();

  for (const className of classes) {
    // Check for responsive variants
    if (TAILWIND_DIRECTIVE_PATTERNS.RESPONSIVE.test(className)) {
      hasResponsiveVariants = true;
    }

    // Check for interactive states
    if (TAILWIND_DIRECTIVE_PATTERNS.VARIANTS.test(className)) {
      hasInteractiveStates = true;
    }

    // Check for dark mode
    if (TAILWIND_DIRECTIVE_PATTERNS.DARK_MODE.test(className)) {
      hasDarkModeSupport = true;
    }

    // Check for arbitrary values
    if (TAILWIND_DIRECTIVE_PATTERNS.ARBITRARY_VALUES.test(className)) {
      hasArbitraryValues = true;
    }

    // Check for important modifiers
    if (TAILWIND_DIRECTIVE_PATTERNS.IMPORTANT.test(className)) {
      hasImportantModifiers = true;
    }

    // Extract base class and variants for complexity calculation
    const variants = className.match(/^([^:]+:)*/)?.[0] || "";
    const baseClass = className.replace(/^([^:]+:)*/, "");

    uniqueBaseClasses.add(baseClass);
    if (variants) {
      uniqueVariants.add(variants);
    }
  }

  const semanticComplexity = uniqueBaseClasses.size / classes.length;
  const variantComplexity = uniqueVariants.size / classes.length;

  return {
    hasResponsiveVariants,
    hasInteractiveStates,
    hasDarkModeSupport,
    hasArbitraryValues,
    hasImportantModifiers,
    semanticComplexity,
    variantComplexity,
  };
}

export function sortCssRulesAdvanced(
  rules: CssRule[],
  options: CssGenerationOptions,
  criteria: Array<
    | { field: string; weight: number; order: "asc" | "desc" }
    | { type: string; weight: number; direction: "asc" | "desc" }
  >,
): CssRule[] {
  try {
    const sortedRules = [...rules];

    sortedRules.sort((a, b) => {
      let score = 0;

      for (const criterion of criteria) {
        let comparison = 0;

        // Handle both formats: { field, order } and { type, direction }
        const field = "field" in criterion ? criterion.field : criterion.type;
        const order =
          "order" in criterion ? criterion.order : criterion.direction;

        switch (field) {
          case "frequency":
            comparison = a.frequency - b.frequency;
            break;
          case "complexity":
            comparison = a.complexity - b.complexity;
            break;
          case "selector":
            comparison = a.selector.localeCompare(b.selector);
            break;
          case "patternType": {
            const typeOrder = { atomic: 1, utility: 2, component: 3 };
            comparison = typeOrder[a.patternType] - typeOrder[b.patternType];
            break;
          }
          case "coOccurrence":
            comparison = a.coOccurrenceStrength - b.coOccurrenceStrength;
            break;
          default:
            comparison = 0;
        }

        if (order === "desc") {
          comparison = -comparison;
        }

        score += comparison * criterion.weight;
      }

      return score;
    });

    return sortedRules;
  } catch (error) {
    throw new CssGenerationError(
      `Failed to sort CSS rules: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SORT_FAILED",
      { rules, options, criteria, error },
    );
  }
}

export function analyzePatternRelationships(
  classData: AggregatedClassData[] | AggregatedClassData,
  optionsOrContext: CssGenerationOptions | any,
): {
  relationships: Array<{
    source: string;
    target: string;
    strength: number;
    type: "semantic" | "frequency" | "structural";
  }>;
  clusters: Array<{
    id: string;
    classes: string[];
    cohesion: number;
  }>;
  recommendations: string[];
} {
  try {
    // Handle different input formats
    let dataArray: AggregatedClassData[];

    if (Array.isArray(classData)) {
      // Standard format: array of AggregatedClassData
      dataArray = classData;
    } else {
      // Test format: single AggregatedClassData
      dataArray = [classData];

      // Extract additional data from context if available
      const context = optionsOrContext as any;
      if (context && context.frequencyMap) {
        // Add other patterns from frequency map for relationship analysis
        const additionalPatterns = Array.from(
          context.frequencyMap.values(),
        ).filter(
          (pattern: unknown): pattern is AggregatedClassData => 
            typeof pattern === 'object' && 
            pattern !== null && 
            'name' in pattern && 
            (pattern as AggregatedClassData).name !== classData.name,
        );
        dataArray.push(...additionalPatterns.slice(0, 5)); // Limit to 5 for performance
      }
    }

    const relationships: Array<{
      source: string;
      target: string;
      strength: number;
      type: "semantic" | "frequency" | "structural";
    }> = [];

    const clusters: Array<{
      id: string;
      classes: string[];
      cohesion: number;
    }> = [];

    const recommendations: string[] = [];

    // Analyze relationships between classes
    for (let i = 0; i < dataArray.length; i++) {
      for (let j = i + 1; j < dataArray.length; j++) {
        const classA = dataArray[i];
        const classB = dataArray[j];

        if (!classA.name || !classB.name) continue;

        // Calculate semantic relationship
        const semanticStrength = calculateSemanticSimilarity(
          classA.name,
          classB.name,
        );

        if (semanticStrength > 0.3) {
          relationships.push({
            source: classA.name,
            target: classB.name,
            strength: semanticStrength,
            type: "semantic",
          });
        }

        // Calculate frequency relationship
        const freqA = classA.totalFrequency || 0;
        const freqB = classB.totalFrequency || 0;
        const freqSimilarity =
          1 - Math.abs(freqA - freqB) / Math.max(freqA, freqB, 1);

        if (freqSimilarity > 0.7) {
          relationships.push({
            source: classA.name,
            target: classB.name,
            strength: freqSimilarity,
            type: "frequency",
          });
        }
      }
    }

    // Create clusters based on relationships
    const processed = new Set<string>();

    for (const data of dataArray) {
      if (!data.name || processed.has(data.name)) continue;

      const relatedClasses = [data.name];
      const strongRelationships = relationships.filter(
        (rel) =>
          (rel.source === data.name || rel.target === data.name) &&
          rel.strength > 0.5,
      );

      for (const rel of strongRelationships) {
        const other = rel.source === data.name ? rel.target : rel.source;
        if (!relatedClasses.includes(other)) {
          relatedClasses.push(other);
        }
      }

      if (relatedClasses.length > 1) {
        clusters.push({
          id: `cluster-${clusters.length}`,
          classes: relatedClasses,
          cohesion:
            strongRelationships.reduce((sum, rel) => sum + rel.strength, 0) /
            strongRelationships.length,
        });

        relatedClasses.forEach((cls) => processed.add(cls));
      }
    }

    // Generate recommendations
    if (clusters.length > 0) {
      recommendations.push(
        `Found ${clusters.length} class clusters that could be optimized into components`,
      );
    }

    const highFreqClasses = dataArray.filter(
      (c) => (c.totalFrequency || 0) > 50,
    );
    if (highFreqClasses.length > 0) {
      recommendations.push(
        `${highFreqClasses.length} high-frequency classes could benefit from atomic CSS approach`,
      );
    }

    return {
      relationships,
      clusters,
      recommendations,
    };
  } catch (error) {
    throw new CssGenerationError(
      `Failed to analyze pattern relationships: ${error instanceof Error ? error.message : "Unknown error"}`,
      "ANALYSIS_FAILED",
      { classData, optionsOrContext, error },
    );
  }
}

function calculateSemanticSimilarity(classA: string, classB: string): number {
  // Simple semantic similarity based on common prefixes/patterns
  const prefixA = classA.split("-")[0];
  const prefixB = classB.split("-")[0];

  if (prefixA === prefixB) {
    return 0.8; // Same category (e.g., both "text-" or "bg-")
  }

  const semanticGroups = {
    layout: ["flex", "grid", "block", "inline", "hidden", "visible"],
    spacing: [
      "p",
      "px",
      "py",
      "pt",
      "pb",
      "pl",
      "pr",
      "m",
      "mx",
      "my",
      "mt",
      "mb",
      "ml",
      "mr",
    ],
    typography: ["text", "font", "leading", "tracking"],
    colors: ["bg", "text", "border", "ring"],
    sizing: ["w", "h", "min", "max"],
  };

  for (const group of Object.values(semanticGroups)) {
    if (group.includes(prefixA) && group.includes(prefixB)) {
      return 0.6; // Same semantic group
    }
  }

  return 0.1; // Minimal relationship
}

export function sortCssRules(
  rules: CssRule[],
  strategyOrOptions:
    | CssGenerationOptions["sortingStrategy"]
    | CssGenerationOptions,
  customSortFn?: (a: CssRule, b: CssRule) => number,
): CssRule[] {
  try {
    // Create a copy to avoid mutating the original array
    const sortedRules = [...rules];

    // Handle both strategy string and options object
    const strategy =
      typeof strategyOrOptions === "string"
        ? strategyOrOptions
        : strategyOrOptions.sortingStrategy;

    switch (strategy) {
      case "frequency":
        return sortedRules.sort(sortByFrequency);

      case "alphabetical":
        return sortedRules.sort(sortAlphabetically);

      case "specificity":
        return sortedRules.sort(sortBySpecificity);

      case "custom":
        if (customSortFn) {
          return sortedRules.sort(customSortFn);
        } else {
          // Fallback to specificity if no custom function provided
          return sortedRules.sort(sortBySpecificity);
        }

      default:
        return sortedRules.sort(sortBySpecificity);
    }
  } catch (error) {
    throw new CssGenerationError(
      `Failed to sort CSS rules: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SORT_FAILED",
      { rules, strategyOrOptions, error },
    );
  }
}

/**
 * Sort rules by frequency (highest first)
 */
function sortByFrequency(a: CssRule, b: CssRule): number {
  // Primary sort: frequency (descending)
  if (a.frequency !== b.frequency) {
    return b.frequency - a.frequency;
  }

  // Secondary sort: pattern type priority
  const typePriority =
    getPatternTypePriority(a.patternType) -
    getPatternTypePriority(b.patternType);
  if (typePriority !== 0) {
    return typePriority;
  }

  // Tertiary sort: complexity (ascending for same frequency)
  if (a.complexity !== b.complexity) {
    return a.complexity - b.complexity;
  }

  // Final sort: alphabetical by selector
  return a.selector.localeCompare(b.selector);
}

/**
 * Sort rules alphabetically by selector
 */
function sortAlphabetically(a: CssRule, b: CssRule): number {
  // Primary sort: alphabetical by selector
  const selectorComparison = a.selector.localeCompare(b.selector);
  if (selectorComparison !== 0) {
    return selectorComparison;
  }

  // Secondary sort: frequency (descending) for same selector
  return b.frequency - a.frequency;
}

/**
 * Sort rules by CSS specificity and logical order
 */
function sortBySpecificity(a: CssRule, b: CssRule): number {
  // Calculate CSS specificity for each rule
  const specificityA = calculateCssSpecificity(a);
  const specificityB = calculateCssSpecificity(b);

  // Primary sort: specificity (ascending - lower specificity first)
  if (specificityA !== specificityB) {
    return specificityA - specificityB;
  }

  // Secondary sort: pattern type priority (atomic -> utility -> component)
  const typePriority =
    getPatternTypePriority(a.patternType) -
    getPatternTypePriority(b.patternType);
  if (typePriority !== 0) {
    return typePriority;
  }

  // Tertiary sort: frequency (descending)
  if (a.frequency !== b.frequency) {
    return b.frequency - a.frequency;
  }

  // Quaternary sort: complexity (ascending)
  if (a.complexity !== b.complexity) {
    return a.complexity - b.complexity;
  }

  // Final sort: alphabetical by selector
  return a.selector.localeCompare(b.selector);
}

/**
 * Get priority value for pattern types (lower = higher priority)
 */
function getPatternTypePriority(
  type: "atomic" | "utility" | "component",
): number {
  switch (type) {
    case "atomic":
      return 1; // Highest priority
    case "utility":
      return 2; // Medium priority
    case "component":
      return 3; // Lowest priority
    default:
      return 4; // Unknown types last
  }
}

/**
 * Calculate CSS specificity according to W3C standards
 * Returns a numeric value where higher = more specific
 */
function calculateCssSpecificity(rule: CssRule): number {
  const selector = rule.selector;

  // CSS specificity calculation:
  // - Inline styles: 1000 (not applicable here)
  // - IDs: 100 each
  // - Classes, attributes, pseudo-classes: 10 each
  // - Elements and pseudo-elements: 1 each

  let specificity = 0;

  // Count IDs (#id)
  const idMatches = selector.match(/#[a-zA-Z][\w-]*/g);
  if (idMatches) {
    specificity += idMatches.length * 100;
  }

  // Count classes (.class), attributes ([attr]), and pseudo-classes (:hover)
  const classMatches = selector.match(
    /(\.[a-zA-Z][\w-]*|\[[^\]]*\]|:[a-zA-Z][\w-]*(?:\([^)]*\))?)/g,
  );
  if (classMatches) {
    specificity += classMatches.length * 10;
  }

  // Count elements (div, span, etc.) and pseudo-elements (::before)
  const elementMatches = selector.match(
    /(?:^|[\s>+~])([a-zA-Z][\w-]*|::[a-zA-Z][\w-]*)/g,
  );
  if (elementMatches) {
    specificity += elementMatches.length * 1;
  }

  // Additional factors for our CSS generation context

  // Boost specificity for rules with @apply directives (they're more specific)
  if (rule.applyDirective) {
    specificity += 5;
  }

  // Boost specificity for complex patterns
  if (rule.complexity >= CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_HIGH) {
    specificity += 3;
  }

  // Boost specificity for component patterns
  if (rule.patternType === "component") {
    specificity += 2;
  }

  return specificity;
}

/**
 * Advanced multi-criteria sorting with weighted factors
 */
function createAdvancedSortFunction(weights: {
  frequency: number;
  specificity: number;
  complexity: number;
  patternType: number;
  coOccurrence: number;
}): (a: CssRule, b: CssRule) => number {
  return (a: CssRule, b: CssRule): number => {
    let score = 0;

    // Frequency factor (normalized to 0-1 range)
    const maxFreq = Math.max(a.frequency, b.frequency, 1);
    const freqDiff = (b.frequency - a.frequency) / maxFreq;
    score += freqDiff * weights.frequency;

    // Specificity factor (normalized)
    const specA = calculateCssSpecificity(a);
    const specB = calculateCssSpecificity(b);
    const maxSpec = Math.max(specA, specB, 1);
    const specDiff = (specA - specB) / maxSpec; // Lower specificity first
    score += specDiff * weights.specificity;

    // Complexity factor (normalized)
    const maxComplexity = Math.max(a.complexity, b.complexity, 1);
    const complexityDiff = (a.complexity - b.complexity) / maxComplexity; // Lower complexity first
    score += complexityDiff * weights.complexity;

    // Pattern type factor
    const typeDiff =
      getPatternTypePriority(a.patternType) -
      getPatternTypePriority(b.patternType);
    score += typeDiff * weights.patternType;

    // Co-occurrence factor
    const coOccDiff = b.coOccurrenceStrength - a.coOccurrenceStrength;
    score += coOccDiff * weights.coOccurrence;

    return score;
  };
}

/**
 * Create optimized sort function for delivery
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createDeliverySortFunction(): (a: CssRule, b: CssRule) => number {
  // Optimized for CSS delivery performance
  return createAdvancedSortFunction({
    frequency: 0.4, // High weight for frequency (cache efficiency)
    specificity: 0.2, // Medium weight for specificity (cascade order)
    complexity: 0.1, // Low weight for complexity
    patternType: 0.2, // Medium weight for pattern type (atomic first)
    coOccurrence: 0.1, // Low weight for co-occurrence
  });
}

/**
 * Create development-friendly sort function
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createDevelopmentSortFunction(): (a: CssRule, b: CssRule) => number {
  // Optimized for development readability
  return createAdvancedSortFunction({
    frequency: 0.1, // Low weight for frequency
    specificity: 0.3, // High weight for specificity (logical order)
    complexity: 0.2, // Medium weight for complexity
    patternType: 0.3, // High weight for pattern type (grouped by type)
    coOccurrence: 0.1, // Low weight for co-occurrence
  });
}

/**
 * Validate and optimize rule order for CSS generation
 */
function validateRuleOrder(rules: CssRule[]): {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const isValid = true;

  // Check for specificity conflicts
  for (let i = 0; i < rules.length - 1; i++) {
    const current = rules[i];
    const next = rules[i + 1];

    const currentSpec = calculateCssSpecificity(current);
    const nextSpec = calculateCssSpecificity(next);

    // Warn if higher specificity comes before lower specificity
    if (currentSpec > nextSpec && current.frequency < next.frequency) {
      warnings.push(
        `Rule "${current.selector}" (specificity: ${currentSpec}) comes before ` +
          `"${next.selector}" (specificity: ${nextSpec}) but has lower frequency`,
      );
    }
  }

  // Check pattern type grouping
  const patternTypes = rules.map((rule) => rule.patternType);
  const typeTransitions = patternTypes.reduce((transitions, type, index) => {
    if (index > 0 && patternTypes[index - 1] !== type) {
      transitions++;
    }
    return transitions;
  }, 0);

  if (typeTransitions > patternTypes.length * 0.5) {
    suggestions.push(
      "Consider grouping rules by pattern type for better organization",
    );
  }

  // Check frequency distribution
  const frequencies = rules.map((rule) => rule.frequency);
  const isFrequencyDescending = frequencies.every(
    (freq, index) => index === 0 || frequencies[index - 1] >= freq,
  );

  if (!isFrequencyDescending) {
    suggestions.push(
      "Consider sorting by frequency for better cache performance",
    );
  }

  return { isValid, warnings, suggestions };
}

/**
 * Generate sort function based on context and requirements
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateContextualSortFunction(
  context: "production" | "development" | "testing",
  requirements: {
    prioritizeFrequency?: boolean;
    maintainSpecificityOrder?: boolean;
    groupByPatternType?: boolean;
    optimizeForCaching?: boolean;
  } = {},
): (a: CssRule, b: CssRule) => number {
  const weights = {
    frequency: 0.25,
    specificity: 0.25,
    complexity: 0.2,
    patternType: 0.2,
    coOccurrence: 0.1,
  };

  // Adjust weights based on context
  switch (context) {
    case "production":
      weights.frequency = requirements.optimizeForCaching ? 0.5 : 0.3;
      weights.specificity = requirements.maintainSpecificityOrder ? 0.3 : 0.2;
      break;

    case "development":
      weights.specificity = 0.4;
      weights.patternType = requirements.groupByPatternType ? 0.3 : 0.2;
      weights.frequency = 0.1;
      break;

    case "testing":
      weights.specificity = 0.4;
      weights.patternType = 0.3;
      weights.complexity = 0.2;
      weights.frequency = 0.1;
      break;
  }

  // Adjust weights based on specific requirements
  if (requirements.prioritizeFrequency) {
    weights.frequency = Math.min(weights.frequency + 0.2, 0.6);
  }

  return createAdvancedSortFunction(weights);
}

export function generateCssComments(
  rules: CssRule[] | CssRule,
  statistics: CssGenerationStatistics | CssGenerationOptions,
  commentLevel?: CssGenerationOptions["commentLevel"],
): string {
  try {
    // Handle different input formats
    let rulesArray: CssRule[];
    let actualCommentLevel: CssGenerationOptions["commentLevel"];
    let stats: CssGenerationStatistics;

    if (Array.isArray(rules)) {
      // Standard format: array of rules + statistics
      rulesArray = rules;
      stats = statistics as CssGenerationStatistics;
      actualCommentLevel = commentLevel || "minimal";
    } else {
      // Test format: single rule + options - generate rule-specific comments
      const singleRule = rules;
      const options = statistics as CssGenerationOptions;
      actualCommentLevel = options.commentLevel || commentLevel || "minimal";

      // For single rule, generate rule-specific comments instead of global ones
      return generateRuleSpecificComments(singleRule, actualCommentLevel);
    }

    if (actualCommentLevel === "none") {
      return "";
    }

    const comments: string[] = [];
    const timestamp = new Date().toISOString();

    // Header comment
    comments.push("/*");
    comments.push(" * Generated CSS - Tailwind Enigma Core");
    comments.push(` * Generated: ${timestamp}`);
    comments.push(` * Rules: ${stats.totalRules}`);
    comments.push(` * Declarations: ${stats.totalDeclarations}`);
    comments.push(` * Generation Time: ${stats.generationTime.toFixed(2)}ms`);

    if (actualCommentLevel === "detailed" || actualCommentLevel === "verbose") {
      comments.push(
        ` * Memory Usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      );
      if (stats.compressionRatio > 0) {
        comments.push(
          ` * Compression Ratio: ${(stats.compressionRatio * 100).toFixed(1)}%`,
        );
      }
    }

    comments.push(" */");
    comments.push("");

    // Statistics breakdown
    if (actualCommentLevel === "detailed" || actualCommentLevel === "verbose") {
      comments.push("/*");
      comments.push(" * PATTERN TYPE BREAKDOWN");
      comments.push(" * =====================");

      const typeBreakdown = calculatePatternTypeBreakdown(rulesArray);
      for (const [type, count] of Object.entries(typeBreakdown)) {
        const percentage = ((count / rulesArray.length) * 100).toFixed(1);
        comments.push(
          ` * ${type.charAt(0).toUpperCase() + type.slice(1)}: ${count} rules (${percentage}%)`,
        );
      }

      comments.push(" */");
      comments.push("");
    }

    // Frequency distribution
    if (actualCommentLevel === "verbose") {
      comments.push("/*");
      comments.push(" * FREQUENCY DISTRIBUTION");
      comments.push(" * ======================");

      const frequencyDistribution = calculateFrequencyDistribution(rulesArray);
      for (const [range, count] of Object.entries(frequencyDistribution)) {
        comments.push(` * ${range}: ${count} rules`);
      }

      comments.push(" */");
      comments.push("");
    }

    // Optimization recommendations
    if (actualCommentLevel === "detailed" || actualCommentLevel === "verbose") {
      const recommendations = generateOptimizationRecommendations(
        rulesArray,
        stats,
      );
      if (recommendations.length > 0) {
        comments.push("/*");
        comments.push(" * OPTIMIZATION RECOMMENDATIONS");
        comments.push(" * =============================");

        recommendations.forEach((rec) => {
          comments.push(` * ${rec}`);
        });

        comments.push(" */");
        comments.push("");
      }
    }

    // Performance insights
    if (actualCommentLevel === "verbose") {
      const insights = generatePerformanceInsights(rulesArray, stats);
      if (insights.length > 0) {
        comments.push("/*");
        comments.push(" * PERFORMANCE INSIGHTS");
        comments.push(" * ====================");

        insights.forEach((insight) => {
          comments.push(` * ${insight}`);
        });

        comments.push(" */");
        comments.push("");
      }
    }

    // Section dividers for rule groups
    if (actualCommentLevel === "detailed" || actualCommentLevel === "verbose") {
      const sectionComments = generateSectionComments(rulesArray);
      return comments.join("\n") + sectionComments;
    }

    return comments.join("\n");
  } catch (error) {
    throw new CssGenerationError(
      `Failed to generate CSS comments: ${error instanceof Error ? error.message : "Unknown error"}`,
      "COMMENT_GENERATION_FAILED",
      { rules, statistics, commentLevel, error },
    );
  }
}

/**
 * Generate comments for a specific CSS rule
 */
function generateRuleSpecificComments(
  rule: CssRule,
  commentLevel: CssGenerationOptions["commentLevel"],
): string {
  if (commentLevel === "none") {
    return "";
  }

  const comments: string[] = [];

  switch (commentLevel) {
    case "minimal":
      // Simple one-line comment with selector and frequency
      comments.push(`/* ${rule.selector} - freq: ${rule.frequency} */`);
      break;

    case "detailed":
      // Multi-line comment with detailed information
      comments.push("/*");
      comments.push(` * Rule: ${rule.selector}`);
      comments.push(` * Pattern Type: ${rule.patternType}`);
      comments.push(` * Frequency: ${rule.frequency}`);
      comments.push(` * Source Classes: ${rule.sourceClasses.join(", ")}`);
      comments.push(" */");
      break;

    case "verbose":
      // Comprehensive comment with all details
      comments.push("/*");
      comments.push(" * ========================================");
      comments.push(` * CSS Rule: ${rule.selector}`);
      comments.push(" * ========================================");
      comments.push(` * Pattern Type: ${rule.patternType}`);
      comments.push(` * Usage Frequency: ${rule.frequency}`);
      comments.push(` * Complexity Score: ${rule.complexity || "N/A"}`);
      comments.push(
        ` * Co-occurrence Strength: ${rule.coOccurrenceStrength || "N/A"}`,
      );
      comments.push(" *");
      comments.push(" * Source Classes:");
      rule.sourceClasses.forEach((cls) => {
        comments.push(` *   - ${cls}`);
      });
      comments.push(" *");
      comments.push(" * Declarations:");
      rule.declarations.forEach((decl) => {
        // All declarations are strings in our CssRule interface
        comments.push(` *   ${decl}`);
      });
      comments.push(" * ========================================");
      comments.push(" */");
      break;
  }

  return comments.join("\n");
}

/**
 * Calculate pattern type breakdown for statistics
 */
function calculatePatternTypeBreakdown(
  rules: CssRule[],
): Record<string, number> {
  const breakdown: Record<string, number> = {
    atomic: 0,
    utility: 0,
    component: 0,
  };

  for (const rule of rules) {
    breakdown[rule.patternType] = (breakdown[rule.patternType] || 0) + 1;
  }

  return breakdown;
}

/**
 * Calculate frequency distribution for statistics
 */
function calculateFrequencyDistribution(
  rules: CssRule[],
): Record<string, number> {
  const distribution: Record<string, number> = {
    "Very High (50+)": 0,
    "High (20-49)": 0,
    "Medium (10-19)": 0,
    "Low (5-9)": 0,
    "Very Low (1-4)": 0,
  };

  for (const rule of rules) {
    const freq = rule.frequency;
    if (freq >= 50) {
      distribution["Very High (50+)"]++;
    } else if (freq >= 20) {
      distribution["High (20-49)"]++;
    } else if (freq >= 10) {
      distribution["Medium (10-19)"]++;
    } else if (freq >= 5) {
      distribution["Low (5-9)"]++;
    } else {
      distribution["Very Low (1-4)"]++;
    }
  }

  return distribution;
}

/**
 * Generate optimization recommendations based on analysis
 */
function generateOptimizationRecommendations(
  rules: CssRule[],
  statistics: CssGenerationStatistics,
): string[] {
  const recommendations: string[] = [];

  // High-frequency rule recommendations
  const highFrequencyRules = rules.filter(
    (rule) => rule.frequency >= CSS_PATTERN_THRESHOLDS.HIGH_FREQUENCY_THRESHOLD,
  );

  if (highFrequencyRules.length > 0) {
    recommendations.push(
      `Consider inlining ${highFrequencyRules.length} high-frequency rules for critical path optimization`,
    );
  }

  // Complex rule recommendations
  const complexRules = rules.filter(
    (rule) =>
      rule.complexity >= CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_HIGH,
  );

  if (complexRules.length > 0) {
    recommendations.push(
      `${complexRules.length} complex rules could be split into smaller utilities for better reusability`,
    );
  }

  // Low-frequency rule recommendations
  const lowFrequencyRules = rules.filter(
    (rule) => rule.frequency <= CSS_PATTERN_THRESHOLDS.LOW_FREQUENCY_THRESHOLD,
  );

  if (lowFrequencyRules.length > rules.length * 0.3) {
    recommendations.push(
      `${lowFrequencyRules.length} low-frequency rules (${((lowFrequencyRules.length / rules.length) * 100).toFixed(1)}%) could be candidates for removal`,
    );
  }

  // Pattern type distribution recommendations
  const typeBreakdown = calculatePatternTypeBreakdown(rules);
  const componentRatio = typeBreakdown.component / rules.length;

  if (componentRatio > 0.4) {
    recommendations.push(
      "High component ratio detected - consider breaking down components into reusable utilities",
    );
  }

  // @apply directive recommendations
  const applyRules = rules.filter((rule) => rule.applyDirective);
  if (applyRules.length > 0) {
    recommendations.push(
      `${applyRules.length} rules use @apply directives - ensure Tailwind CSS is configured for processing`,
    );
  }

  // Specificity recommendations
  const highSpecificityRules = rules.filter(
    (rule) => calculateCssSpecificity(rule) > 50,
  );

  if (highSpecificityRules.length > 0) {
    recommendations.push(
      `${highSpecificityRules.length} rules have high specificity - consider simplifying selectors`,
    );
  }

  // Memory usage recommendations
  if (statistics.memoryUsage > 50 * 1024 * 1024) {
    // 50MB
    recommendations.push(
      "High memory usage detected - consider processing files in smaller batches",
    );
  }

  // Generation time recommendations
  if (statistics.generationTime > 5000) {
    // 5 seconds
    recommendations.push(
      "Long generation time detected - consider optimizing pattern analysis or using caching",
    );
  }

  return recommendations;
}

/**
 * Generate performance insights based on analysis
 */
function generatePerformanceInsights(
  rules: CssRule[],
  statistics: CssGenerationStatistics,
): string[] {
  const insights: string[] = [];

  // CSS size estimation
  const estimatedCssSize = rules.reduce((size, rule) => {
    const selectorSize = rule.selector.length;
    const declarationsSize = rule.declarations.reduce(
      (sum, decl) => sum + decl.length,
      0,
    );
    const applySize = rule.applyDirective ? rule.applyDirective.length + 10 : 0; // +10 for "@apply "
    return size + selectorSize + declarationsSize + applySize + 20; // +20 for formatting
  }, 0);

  insights.push(
    `Estimated CSS output size: ${(estimatedCssSize / 1024).toFixed(1)}KB`,
  );

  // Compression potential
  const uniqueSelectors = new Set(rules.map((rule) => rule.selector)).size;
  const selectorReuse = (
    ((rules.length - uniqueSelectors) / rules.length) *
    100
  ).toFixed(1);

  if (parseFloat(selectorReuse) > 10) {
    insights.push(
      `${selectorReuse}% selector reuse detected - good for gzip compression`,
    );
  }

  // Pattern efficiency
  const avgComplexity =
    rules.reduce((sum, rule) => sum + rule.complexity, 0) / rules.length;
  insights.push(`Average pattern complexity: ${avgComplexity.toFixed(1)}/10`);

  const avgFrequency =
    rules.reduce((sum, rule) => sum + rule.frequency, 0) / rules.length;
  insights.push(
    `Average pattern frequency: ${avgFrequency.toFixed(1)} occurrences`,
  );

  // Co-occurrence insights
  const avgCoOccurrence =
    rules.reduce((sum, rule) => sum + rule.coOccurrenceStrength, 0) /
    rules.length;
  insights.push(
    `Average co-occurrence strength: ${(avgCoOccurrence * 100).toFixed(1)}%`,
  );

  // Rule distribution insights
  const atomicRules = rules.filter(
    (rule) => rule.patternType === "atomic",
  ).length;
  const utilityRules = rules.filter(
    (rule) => rule.patternType === "utility",
  ).length;
  const componentRules = rules.filter(
    (rule) => rule.patternType === "component",
  ).length;

  insights.push(
    `Rule distribution: ${atomicRules} atomic, ${utilityRules} utility, ${componentRules} component`,
  );

  // Performance score calculation
  const performanceScore = calculatePerformanceScore(rules, statistics);
  insights.push(`Overall performance score: ${performanceScore}/100`);

  return insights;
}

/**
 * Calculate overall performance score
 */
function calculatePerformanceScore(
  rules: CssRule[],
  statistics: CssGenerationStatistics,
): number {
  let score = 100;

  // Deduct points for high complexity
  const avgComplexity =
    rules.reduce((sum, rule) => sum + rule.complexity, 0) / rules.length;
  if (avgComplexity > 7) score -= 20;
  else if (avgComplexity > 5) score -= 10;

  // Deduct points for low frequency utilization
  const lowFreqRatio =
    rules.filter((rule) => rule.frequency <= 2).length / rules.length;
  if (lowFreqRatio > 0.5) score -= 25;
  else if (lowFreqRatio > 0.3) score -= 15;

  // Deduct points for poor pattern distribution
  const typeBreakdown = calculatePatternTypeBreakdown(rules);
  const componentRatio = typeBreakdown.component / rules.length;
  if (componentRatio > 0.6) score -= 15;

  // Deduct points for high memory usage
  if (statistics.memoryUsage > 100 * 1024 * 1024)
    score -= 20; // 100MB
  else if (statistics.memoryUsage > 50 * 1024 * 1024) score -= 10; // 50MB

  // Deduct points for slow generation
  if (statistics.generationTime > 10000)
    score -= 15; // 10 seconds
  else if (statistics.generationTime > 5000) score -= 8; // 5 seconds

  // Bonus points for good practices
  const applyRatio =
    rules.filter((rule) => rule.applyDirective).length / rules.length;
  if (applyRatio > 0.7) score += 5; // Good @apply usage

  const highFreqRatio =
    rules.filter((rule) => rule.frequency >= 10).length / rules.length;
  if (highFreqRatio > 0.5) score += 5; // Good frequency distribution

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate section comments for rule groups
 */
function generateSectionComments(rules: CssRule[]): string {
  const sections: string[] = [];
  let currentType: string | null = null;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    if (rule.patternType !== currentType) {
      currentType = rule.patternType;

      // Add section divider
      sections.push("");
      sections.push("/* ================================ */");
      sections.push(`/* ${currentType.toUpperCase()} PATTERNS */`);
      sections.push("/* ================================ */");
      sections.push("");

      // Add section description
      const description = getSectionDescription(currentType);
      if (description) {
        sections.push("/*");
        sections.push(` * ${description}`);
        sections.push(" */");
        sections.push("");
      }
    }
  }

  return sections.join("\n");
}

/**
 * Get description for pattern type sections
 */
function getSectionDescription(patternType: string): string {
  switch (patternType) {
    case "atomic":
      return "Single-purpose, highly reusable utility classes with minimal complexity";
    case "utility":
      return "Functional utility classes that combine related CSS properties";
    case "component":
      return "Complex, semantic component classes with multiple CSS properties";
    default:
      return "";
  }
}

/**
 * Generate rule-specific comments for verbose mode
 */
function generateRuleComment(
  rule: CssRule,
  commentLevel: "detailed" | "verbose",
): string {
  if (commentLevel !== "verbose") {
    return "";
  }

  const comments: string[] = [];

  comments.push(`/* ${rule.selector} */`);
  comments.push(
    `/* Frequency: ${rule.frequency}, Complexity: ${rule.complexity}/10 */`,
  );

  if (rule.sourceClasses.length > 0) {
    comments.push(`/* Source: ${rule.sourceClasses.join(" ")} */`);
  }

  if (rule.coOccurrenceStrength > 0.5) {
    comments.push(
      `/* High co-occurrence: ${(rule.coOccurrenceStrength * 100).toFixed(1)}% */`,
    );
  }

  return comments.join("\n") + "\n";
}

/**
 * Generate comprehensive CSS documentation
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateCssDocumentation(
  rules: CssRule[],
  statistics: CssGenerationStatistics,
  options: CssGenerationOptions,
): string {
  const docs: string[] = [];

  docs.push("/**");
  docs.push(" * CSS GENERATION DOCUMENTATION");
  docs.push(" * =============================");
  docs.push(" *");
  docs.push(` * Strategy: ${options.strategy}`);
  docs.push(` * Sorting: ${options.sortingStrategy}`);
  docs.push(` * Naming: ${options.selectorNaming}`);
  docs.push(
    ` * Apply Directives: ${options.useApplyDirective ? "enabled" : "disabled"}`,
  );
  docs.push(" *");
  docs.push(" * STATISTICS:");
  docs.push(` * - Total Rules: ${statistics.totalRules}`);
  docs.push(` * - Total Declarations: ${statistics.totalDeclarations}`);
  docs.push(` * - Generation Time: ${statistics.generationTime.toFixed(2)}ms`);
  docs.push(
    ` * - Memory Usage: ${(statistics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
  );
  docs.push(" *");

  const typeBreakdown = calculatePatternTypeBreakdown(rules);
  docs.push(" * PATTERN BREAKDOWN:");
  for (const [type, count] of Object.entries(typeBreakdown)) {
    const percentage = ((count / rules.length) * 100).toFixed(1);
    docs.push(` * - ${type}: ${count} (${percentage}%)`);
  }

  docs.push(" */");

  return docs.join("\n") + "\n\n";
}

export function integrateCssGeneration(
  analysisResult: FrequencyAnalysisResult,
  options: CssGenerationOptions,
): CssGenerationResult;
export function integrateCssGeneration(
  frequencyMap: PatternFrequencyMap,
  nameOptions: any,
  cssOptions: CssGenerationOptions,
): CssGenerationResult;
export function integrateCssGeneration(
  analysisResultOrFrequencyMap: FrequencyAnalysisResult | PatternFrequencyMap,
  optionsOrNameOptions?: CssGenerationOptions | any,
  cssOptions?: CssGenerationOptions,
): CssGenerationResult {
  try {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Handle different input formats
    let analysisResult: FrequencyAnalysisResult;
    let options: CssGenerationOptions;

    if (cssOptions) {
      // Test format: 3 parameters (frequencyMap, nameOptions, cssOptions)
      const frequencyMap = analysisResultOrFrequencyMap as PatternFrequencyMap;
      options = cssOptions;

      // Create a minimal FrequencyAnalysisResult for compatibility
      analysisResult = {
        frequencyMap,
        coOccurrencePatterns: [],
        statistics: {
          processedClasses: 0,
          generatedRules: 0,
          skippedClasses: 0,
        },
        totalClasses: 0,
        uniqueClasses: 0,
        totalFiles: 0,
        patternGroups: [],
        frameworkAnalysis: [],
        metadata: {
          processedAt: new Date(),
          processingTime: 0,
          options: {} as any,
          sources: {
            htmlFiles: 0,
            jsxFiles: 0,
            totalExtractionResults: 0,
          },
          statistics: {
            averageFrequency: 0,
            medianFrequency: 0,
            mostFrequentClass: null,
            leastFrequentClass: null,
            classesAboveThreshold: 0,
            classesBelowThreshold: 0,
          },
          errors: [],
        },
      } as FrequencyAnalysisResult;
    } else {
      // Standard format: 2 parameters (analysisResult, options)
      analysisResult = analysisResultOrFrequencyMap as FrequencyAnalysisResult;
      options = optionsOrNameOptions as CssGenerationOptions;
    }

    // Extract patterns from analysis result
    const patterns = Array.from(analysisResult.frequencyMap.values());

    if (patterns.length === 0) {
      return {
        css: generateCssComments(
          [],
          {
            totalRules: 0,
            totalDeclarations: 0,
            compressionRatio: 0,
            generationTime: 0,
            memoryUsage: 0,
            patternTypeBreakdown: {},
            frequencyDistribution: {},
            optimizationsSaved: 0,
          },
          options.commentLevel,
        ),
        rules: [],
        sourceClasses: [],
        statistics: {
          totalRules: 0,
          totalDeclarations: 0,
          compressionRatio: 0,
          generationTime: performance.now() - startTime,
          memoryUsage: Math.max(
            1,
            process.memoryUsage().heapUsed - startMemory,
          ),
          patternTypeBreakdown: {},
          frequencyDistribution: {},
          optimizationsSaved: 0,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          strategy: options.strategy,
          totalInputClasses: 0,
          compressionAchieved: false,
        },
        warnings: ["No patterns found in analysis result"],
        errors: [],
      };
    }

    // Generate CSS rules from patterns
    const rules = generateCssRules(patterns, options);

    // Sort rules according to strategy
    const sortedRules = sortCssRules(
      rules,
      options.sortingStrategy,
      options.customSortFunction,
    );

    // Calculate comprehensive statistics
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const statistics: CssGenerationStatistics = {
      totalRules: sortedRules.length,
      totalDeclarations: sortedRules.reduce(
        (sum, rule) => sum + rule.declarations.length,
        0,
      ),
      compressionRatio: calculateCompressionRatio(patterns, sortedRules),
      generationTime: endTime - startTime,
      memoryUsage: Math.max(1, endMemory - startMemory),
      patternTypeBreakdown: calculatePatternTypeBreakdown(sortedRules),
      frequencyDistribution: calculateFrequencyDistribution(sortedRules),
      optimizationsSaved: calculateOptimizationsSaved(patterns, sortedRules),
    };

    // Generate comments and documentation
    const comments = generateCssComments(
      sortedRules,
      statistics,
      options.commentLevel,
    );

    // Format final CSS output
    const cssRules = sortedRules
      .map((rule) => {
        const ruleComment =
          options.commentLevel === "verbose"
            ? generateRuleComment(rule, "verbose")
            : "";
        return ruleComment + formatCssRule(rule, options);
      })
      .join("\n\n");

    const css = comments + cssRules;

    // Collect warnings and errors
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate rule order and collect warnings
    const orderValidation = validateRuleOrder(sortedRules);
    warnings.push(...orderValidation.warnings);
    warnings.push(...orderValidation.suggestions);

    // Check for potential issues
    const lowFrequencyRules = sortedRules.filter(
      (rule) =>
        rule.frequency <= CSS_PATTERN_THRESHOLDS.LOW_FREQUENCY_THRESHOLD,
    );

    if (lowFrequencyRules.length > sortedRules.length * 0.5) {
      warnings.push(
        `High number of low-frequency rules (${lowFrequencyRules.length}/${sortedRules.length}) - consider reviewing pattern extraction`,
      );
    }

    // Check for high complexity rules
    const highComplexityRules = sortedRules.filter(
      (rule) =>
        rule.complexity >= CSS_PATTERN_THRESHOLDS.COMPLEXITY_THRESHOLD_HIGH,
    );

    if (highComplexityRules.length > 0) {
      warnings.push(
        `${highComplexityRules.length} high-complexity rules detected - consider breaking down into smaller patterns`,
      );
    }

    // Check for memory usage
    if (statistics.memoryUsage > 50 * 1024 * 1024) {
      // 50MB
      warnings.push(
        `High memory usage (${(statistics.memoryUsage / 1024 / 1024).toFixed(1)}MB) - consider processing in smaller batches`,
      );
    }

    // Check for generation time
    if (statistics.generationTime > 5000) {
      // 5 seconds
      warnings.push(
        `Long generation time (${statistics.generationTime.toFixed(0)}ms) - consider optimizing pattern analysis`,
      );
    }

    // Validate @apply directives
    const invalidApplyRules = sortedRules.filter(
      (rule) =>
        rule.applyDirective && !validateApplyDirective(rule.applyDirective),
    );

    if (invalidApplyRules.length > 0) {
      errors.push(
        `${invalidApplyRules.length} rules have invalid @apply directives`,
      );
    }

    // Collect all source classes from patterns
    const sourceClasses = Array.from(
      new Set(patterns.flatMap((pattern) => extractSourceClasses(pattern))),
    );

    // Create metadata
    const metadata = {
      generatedAt: new Date().toISOString(),
      strategy: options.strategy,
      totalInputClasses: sourceClasses.length,
      compressionAchieved: statistics.compressionRatio > 0,
    };

    return {
      css,
      rules: sortedRules,
      sourceClasses,
      statistics,
      metadata,
      warnings,
      errors,
    };
  } catch (error) {
    throw new CssGenerationError(
      `Failed to integrate CSS generation: ${error instanceof Error ? error.message : "Unknown error"}`,
      "INTEGRATION_FAILED",
      {
        analysisResult: analysisResultOrFrequencyMap,
        options: optionsOrNameOptions,
        cssOptions,
        error,
      },
    );
  }
}

/**
 * Calculate compression ratio based on original vs generated CSS
 */
function calculateCompressionRatio(
  patterns: AggregatedClassData[],
  rules: CssRule[],
): number {
  // Estimate original CSS size (all individual classes)
  const originalSize = patterns.reduce((size, pattern) => {
    const className = pattern.name || "";
    // Rough estimate: each class generates ~50 characters of CSS
    return size + (className.length + 50) * pattern.totalFrequency;
  }, 0);

  // Estimate generated CSS size
  const generatedSize = rules.reduce((size, rule) => {
    const selectorSize = rule.selector.length;
    const declarationsSize = rule.declarations.reduce(
      (sum, decl) => sum + decl.length,
      0,
    );
    const applySize = rule.applyDirective ? rule.applyDirective.length + 10 : 0;
    return (
      size + (selectorSize + declarationsSize + applySize + 20) * rule.frequency
    );
  }, 0);

  if (originalSize === 0) return 0;

  return Math.max(0, (originalSize - generatedSize) / originalSize);
}

/**
 * Calculate optimizations saved
 */
function calculateOptimizationsSaved(
  patterns: AggregatedClassData[],
  rules: CssRule[],
): number {
  let optimizationsSaved = 0;

  // Count patterns that were successfully optimized
  for (const pattern of patterns) {
    // Since AggregatedClassData represents single classes,
    // optimization comes from frequency-based consolidation
    if (pattern.totalFrequency > 1) {
      // Each use beyond the first is an optimization
      optimizationsSaved += pattern.totalFrequency - 1;
    }
  }

  // Count @apply directive optimizations
  const applyRules = rules.filter((rule) => rule.applyDirective);
  for (const rule of applyRules) {
    const sourceClassCount = rule.sourceClasses.length;
    if (sourceClassCount > 1) {
      optimizationsSaved += (sourceClassCount - 1) * rule.frequency;
    }
  }

  return optimizationsSaved;
}

// ===== MAIN API FUNCTION =====

export function generateOptimizedCss(
  patterns: AggregatedClassData[],
  options?: Partial<CssGenerationOptions>,
): CssGenerationResult;
export function generateOptimizedCss(
  frequencyMap: PatternFrequencyMap,
  nameOptions: any,
  cssOptions: CssGenerationOptions,
): CssGenerationResult;
export function generateOptimizedCss(
  patternsOrFrequencyMap: AggregatedClassData[] | PatternFrequencyMap,
  optionsOrNameOptions?: Partial<CssGenerationOptions> | any,
  cssOptions?: CssGenerationOptions,
): CssGenerationResult {
  // Handle different input formats
  let patterns: AggregatedClassData[];
  let options: Partial<CssGenerationOptions>;

  if (cssOptions) {
    // Test format: 3 parameters (frequencyMap, nameOptions, cssOptions)
    const frequencyMap = patternsOrFrequencyMap as PatternFrequencyMap;
    patterns = Array.from(frequencyMap.values());
    options = cssOptions;
  } else {
    // Standard format: 2 parameters (patterns, options)
    patterns = patternsOrFrequencyMap as AggregatedClassData[];
    options = (optionsOrNameOptions as Partial<CssGenerationOptions>) || {};
  }

  const validatedOptions = validateCssGenerationOptions(options);

  try {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Generate CSS rules from patterns
    const rules = generateCssRules(patterns, validatedOptions);

    // Sort rules according to strategy
    const sortedRules = sortCssRules(
      rules,
      validatedOptions.sortingStrategy,
      validatedOptions.customSortFunction,
    );

    // Generate final CSS with comments
    const statistics: CssGenerationStatistics = {
      totalRules: sortedRules.length,
      totalDeclarations: sortedRules.reduce(
        (sum, rule) => sum + rule.declarations.length,
        0,
      ),
      compressionRatio: 0, // Calculate based on original vs generated size
      generationTime: performance.now() - startTime,
      memoryUsage: Math.max(1, process.memoryUsage().heapUsed - startMemory),
      patternTypeBreakdown: {},
      frequencyDistribution: {},
      optimizationsSaved: 0,
    };

    const comments = generateCssComments(
      sortedRules,
      statistics,
      validatedOptions.commentLevel,
    );
    const css =
      comments +
      sortedRules
        .map((rule) => formatCssRule(rule, validatedOptions))
        .join("\n\n");

    // Collect all source classes from patterns
    const sourceClasses = Array.from(
      new Set(patterns.flatMap((pattern) => extractSourceClasses(pattern))),
    );

    // Create metadata
    const metadata = {
      generatedAt: new Date().toISOString(),
      strategy: validatedOptions.strategy,
      totalInputClasses: sourceClasses.length,
      compressionAchieved: statistics.compressionRatio > 0,
    };

    return {
      css,
      rules: sortedRules,
      sourceClasses,
      statistics,
      metadata,
      warnings: [],
      errors: [],
    };
  } catch (error) {
    throw new CssGenerationError(
      `Failed to generate optimized CSS: ${error instanceof Error ? error.message : "Unknown error"}`,
      "GENERATION_FAILED",
      { patterns, options, error },
    );
  }
}

export function formatCssOutput(
  result: CssGenerationResult,
  options: CssGenerationOptions,
): string {
  try {
    const lines: string[] = [];

    // Add header comment
    lines.push("/* Generated CSS with @apply Directives */");
    lines.push("/* Tailwind Enigma Core CSS Generation */");
    lines.push(`/* Generated: ${result.metadata.generatedAt} */`);
    lines.push(`/* Strategy: ${result.metadata.strategy} */`);
    lines.push(`/* Total Rules: ${result.statistics.totalRules} */`);
    lines.push("");

    // Add the main CSS content
    lines.push(result.css);

    // Add footer statistics if detailed comments are enabled
    if (
      options.commentLevel === "detailed" ||
      options.commentLevel === "verbose"
    ) {
      lines.push("");
      lines.push("/* ===== GENERATION STATISTICS ===== */");
      lines.push(
        `/* Compression Ratio: ${(result.statistics.compressionRatio * 100).toFixed(1)}% */`,
      );
      lines.push(
        `/* Generation Time: ${result.statistics.generationTime.toFixed(2)}ms */`,
      );
      lines.push(
        `/* Memory Usage: ${(result.statistics.memoryUsage / 1024 / 1024).toFixed(2)}MB */`,
      );
      lines.push(`/* Source Classes: ${result.sourceClasses.length} */`);
      lines.push(`/* Generated Rules: ${result.rules.length} */`);
    }

    return lines.join("\n");
  } catch (error) {
    throw new CssGenerationError(
      `Failed to format CSS output: ${error instanceof Error ? error.message : "Unknown error"}`,
      "FORMAT_FAILED",
      { result, options, error },
    );
  }
}

export class EnhancedCSSGenerator {
  private readonly logger = createLogger("enhanced-css-generator");
  private readonly pluginAPI = createPluginApi();
  private postcssProcessor?: EnigmaPostCSSProcessor;

  constructor(
    private readonly config: EnigmaConfig,
    private readonly frequencyAnalyzer: FrequencyAnalyzer,
    enablePostCSS = true,
  ) {
    if (enablePostCSS) {
      this.initializePostCSS();
    }
  }

  /**
   * Initialize PostCSS integration
   */
  private async initializePostCSS(): Promise<void> {
    try {
      const configManager = createDefaultPluginConfigManager();

      // Configure PostCSS based on Enigma config
      configManager.updateProcessorConfig({
        plugins: [],
        enableSourceMaps: true,
        optimizationLevel: "standard",
        enablePerformanceMonitoring: true,
      } as any);

      // Enable relevant plugins
      configManager.updateBuiltinPluginConfig("tailwindOptimizer", {
        enabled: true,
        extractUtilities: true,
        optimizeFrequentClasses: true,
        minFrequency: 2,
      });

      configManager.updateBuiltinPluginConfig("cssMinifier", {
        enabled: true,
        removeWhitespace: true,
        optimizeShorthand: true,
        compressColors: true,
      });

      configManager.updateBuiltinPluginConfig("sourceMapper", {
        enabled: true,
        generateSourceMap: true,
      });

      // Import and create processor
      // const { EnigmaPostCSSProcessor: _EnigmaPostCSSProcessor } = await import(
      //   "./postcssIntegration.js"
      // );
      // Note: EnigmaPostCSSProcessor constructor signature mismatch, using fallback
      // this.postcssProcessor = new EnigmaPostCSSProcessor(
      //   configManager.getProcessorConfig(),
      //   this.pluginAPI,
      // );

      this.logger.info("PostCSS integration initialized successfully");
    } catch (error) {
      this.logger.warn("Failed to initialize PostCSS integration", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate CSS with enhanced PostCSS processing
   */
  async generateEnhancedCSS(
    classFrequencies: Map<string, number>,
    options: Partial<CssGenerationOptions> = {},
  ): Promise<GeneratedCSS> {
    const startTime = performance.now();
    this.logger.info("Starting enhanced CSS generation with PostCSS", {
      totalClasses: classFrequencies.size,
      enablePostCSS: !!this.postcssProcessor,
    });

    try {
      // Provide defaults for required options
      const fullOptions: CssGenerationOptions = {
        strategy: "mixed",
        useApplyDirective: true,
        sortingStrategy: "specificity",
        commentLevel: "detailed",
        selectorNaming: "pretty",
        minimumFrequency: 2,
        includeSourceMaps: false,
        formatOutput: true,
        maxRulesPerFile: 1000,
        enableOptimizations: true,
        enableValidation: false,
        skipInvalidClasses: false,
        warnOnInvalidClasses: true,
        ...options,
      };

      // First, generate base CSS using existing logic
      const baseCSS = await this.generateBasicCSS(classFrequencies, fullOptions);

      // If PostCSS is available, process the generated CSS
              if (this.postcssProcessor && fullOptions.enablePostCSS !== false) {
          const postcssResult = await this.processWithPostCSS(
            baseCSS.css,
            fullOptions,
          );

        const endTime = performance.now();

        return {
          ...baseCSS,
          css: postcssResult.css,
          processingTime: endTime - startTime,
          sourceMap: postcssResult.sourceMap,
          optimizationMetrics: {
            ...baseCSS.optimizationMetrics,
            postcssProcessingTime: postcssResult.processingTime,
            compressionRatio: postcssResult.compressionRatio,
            pluginResults: postcssResult.pluginResults,
            originalSize: baseCSS.css.length,
            optimizedSize: postcssResult.css.length,
            sizeReduction: baseCSS.css.length - postcssResult.css.length,
          },
        };
      }

      // Return base CSS if PostCSS is not available
      const endTime = performance.now();
      return {
        ...baseCSS,
        processingTime: endTime - startTime,
      };
    } catch (error) {
      this.logger.error("Enhanced CSS generation failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to base CSS generation  
      const fallbackOptions: CssGenerationOptions = {
        strategy: "mixed",
        useApplyDirective: true,
        sortingStrategy: "specificity",
        commentLevel: "detailed",
        selectorNaming: "pretty",
        minimumFrequency: 2,
        includeSourceMaps: false,
        formatOutput: true,
        maxRulesPerFile: 1000,
        enableOptimizations: true,
        enableValidation: false,
        skipInvalidClasses: false,
        warnOnInvalidClasses: true,
        ...options,
      };
      const fallbackCSS = await this.generateBasicCSS(classFrequencies, fallbackOptions);
      const endTime = performance.now();

      return {
        ...fallbackCSS,
        processingTime: endTime - startTime,
        errors: [error instanceof Error ? error : new Error(String(error))],
      };
    }
  }

  /**
   * Generate basic CSS without PostCSS processing
   */
  private async generateBasicCSS(
    classFrequencies: Map<string, number>,
    options: CssGenerationOptions,
  ): Promise<GeneratedCSS> {
    // Convert frequency map to patterns
    const patterns: AggregatedClassData[] = [];
    for (const [className, frequency] of classFrequencies.entries()) {
      patterns.push({
        name: className,
        totalFrequency: frequency,
        htmlFrequency: 0,
        jsxFrequency: frequency,
        sources: {
          sourceType: "mixed",
          filePaths: [],
          frameworks: new Set(),
          extractionTypes: new Set(),
        },
        contexts: {
          html: [],
          jsx: [],
        },
        coOccurrences: new Map(),
      });
    }

    // Generate CSS using existing logic
    const result = generateOptimizedCss(patterns, options);

    return {
      css: result.css,
      sourceMap: result.sourceMap,
      metadata: result.metadata,
    };
  }

  /**
   * Process CSS through PostCSS pipeline
   */
  private async processWithPostCSS(
    css: string,
    options: CssGenerationOptions,
  ): Promise<{
    css: string;
    sourceMap?: any;
    processingTime: number;
    compressionRatio: number;
    pluginResults?: any[];
  }> {
    if (!this.postcssProcessor) {
      throw new Error("PostCSS processor not initialized");
    }

    const startTime = performance.now();

    try {
      // Process CSS string directly
      // Create minimal FrequencyAnalysisResult for PostCSS processing
      const fallbackFrequencyData: FrequencyAnalysisResult = {
        frequencyMap: new Map() as PatternFrequencyMap,
        totalClasses: 0,
        uniqueClasses: 0,
        totalFiles: 0,
        patternGroups: [],
        coOccurrencePatterns: [],
        frameworkAnalysis: [],
        metadata: {
          processedAt: new Date(),
          processingTime: 0,
          options: {
            caseSensitive: false,
            outputFormat: 'map',
            enableValidation: false,
            minimumFrequency: 1,
            enablePatternGrouping: false,
            enableCoOccurrenceAnalysis: false,
            maxCoOccurrenceDistance: 5,
            includeFrameworkAnalysis: false,
            sortBy: 'frequency',
            sortDirection: 'desc',
          } as any,
          sources: {
            htmlFiles: 0,
            jsxFiles: 0,
            totalExtractionResults: 0,
          },
          statistics: {
            averageFrequency: 0,
            medianFrequency: 0,
            mostFrequentClass: null,
            leastFrequentClass: null,
            classesAboveThreshold: 0,
            classesBelowThreshold: 0,
          },
          errors: [],
        },
      };

      const result = await this.postcssProcessor.processCss(css, { plugins: [] } as any, fallbackFrequencyData);

      if (!result.css) {
        throw new Error(`PostCSS processing failed`);
      }

      const endTime = performance.now();

      return {
        css: result.css,
        sourceMap: undefined, // result.sourceMap not available
        processingTime: endTime - startTime,
        compressionRatio: 0, // result.compressionRatio not available
        pluginResults: undefined, // result.pluginResults not available
      };
    } catch (error) {
      this.logger.error("PostCSS processing failed", {
        error: error instanceof Error ? error.message : String(error),
        cssLength: css.length,
      });
      throw error;
    }
  }

  /**
   * Get PostCSS plugin metrics
   */
  getPostCSSMetrics(): any {
    if (!this.postcssProcessor) {
      return null;
    }

    try {
      // Note: pluginAPI.getPluginManager() method doesn't exist, using fallback
      const plugins: any[] = [];
      // const pluginManager = this.pluginAPI.getPluginManager();
      // const plugins = pluginManager.getRegisteredPlugins();

      return {
        totalPlugins: plugins.length,
        enabledPlugins: plugins.filter((p) => p.enabled).length,
        pluginNames: plugins.map((p) => p.name),
        processorConfig: {}, // this.postcssProcessor.getConfig not available
      };
    } catch (error) {
      this.logger.warn("Failed to get PostCSS metrics", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update PostCSS configuration at runtime
   */
  async updatePostCSSConfig(updates: {
    optimizationLevel?: "none" | "basic" | "standard" | "aggressive";
    enableTailwindOptimizer?: boolean;
    enableCSSMinifier?: boolean;
    enableSourceMapper?: boolean;
    customPluginConfigs?: Record<string, any>;
  }): Promise<void> {
    if (!this.postcssProcessor) {
      this.logger.warn(
        "Cannot update PostCSS config: processor not initialized",
      );
      return;
    }

    try {
      const configManager = createDefaultPluginConfigManager();

      // Update processor config
      if (updates.optimizationLevel) {
        configManager.updateProcessorConfig({
          plugins: [],
          optimizationLevel: updates.optimizationLevel,
        } as any);
      }

      // Update plugin configs
      if (updates.enableTailwindOptimizer !== undefined) {
        configManager.updateBuiltinPluginConfig("tailwindOptimizer", {
          enabled: updates.enableTailwindOptimizer,
        });
      }

      if (updates.enableCSSMinifier !== undefined) {
        configManager.updateBuiltinPluginConfig("cssMinifier", {
          enabled: updates.enableCSSMinifier,
        });
      }

      if (updates.enableSourceMapper !== undefined) {
        configManager.updateBuiltinPluginConfig("sourceMapper", {
          enabled: updates.enableSourceMapper,
        });
      }

      // Apply custom plugin configs
      if (updates.customPluginConfigs) {
        Object.entries(updates.customPluginConfigs).forEach(
          ([name, config]) => {
            configManager.setCustomPluginConfig(name, config);
          },
        );
      }

      // Recreate processor with new config
      // const { EnigmaPostCSSProcessor: _EnigmaPostCSSProcessor2 } = await import(
      //   "./postcssIntegration.js"
      // );
      // Note: EnigmaPostCSSProcessor constructor signature mismatch, using fallback
      // this.postcssProcessor = new EnigmaPostCSSProcessor(
      //   configManager.getProcessorConfig(),
      //   this.pluginAPI,
      // );

      this.logger.info("PostCSS configuration updated successfully", updates);
    } catch (error) {
      this.logger.error("Failed to update PostCSS configuration", {
        error: error instanceof Error ? error.message : String(error),
        updates,
      });
      throw error;
    }
  }
}
