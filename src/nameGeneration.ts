/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";
import type {
  PatternFrequencyMap,
  AggregatedClassData,
} from "./patternAnalysis.ts";

/**
 * Configuration options for name generation
 */
export const NameGenerationOptionsSchema = z.object({
  // Base configuration
  alphabet: z
    .string()
    .min(2)
    .default("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  numericSuffix: z.boolean().default(true), // Allow 0-9 in names (but not at start)

  // Generation strategy
  strategy: z
    .enum(["sequential", "frequency-optimized", "hybrid", "pretty"])
    .default("frequency-optimized"),
  startIndex: z.number().min(0).default(0),

  // Pretty name generation options
  prettyNameMaxLength: z.number().min(1).max(10).default(6), // Maximum length for pretty names
  prettyNamePreferShorter: z.boolean().default(true), // Prefer shorter names when possible
  prettyNameExhaustionStrategy: z
    .enum(["fallback-sequential", "fallback-hybrid", "error"])
    .default("fallback-hybrid"),

  // Frequency optimization
  enableFrequencyOptimization: z.boolean().default(true),
  frequencyThreshold: z.number().min(0).default(1), // Minimum frequency for optimization

  // Collision avoidance
  reservedNames: z.array(z.string()).default([
    // CSS keywords
    "auto",
    "inherit",
    "initial",
    "unset",
    "revert",
    "none",
    "all",
    // Common framework classes that shouldn't be minified
    "container",
    "wrapper",
    "main",
    "header",
    "footer",
    "nav",
    "aside",
  ]),
  avoidConflicts: z.boolean().default(true),

  // Performance options
  enableCaching: z.boolean().default(true),
  batchSize: z.number().min(1).default(1000),
  maxCacheSize: z.number().min(100).default(50000),

  // Output format
  prefix: z.string().default(""),
  suffix: z.string().default(""),
  ensureCssValid: z.boolean().default(true), // Ensure CSS identifier validity
});

export type NameGenerationOptions = z.infer<typeof NameGenerationOptionsSchema>;

/**
 * Generated name result with metadata
 */
export interface GeneratedName {
  original: string;
  optimized: string;
  length: number;
  index: number;
  frequency: number;
  compressionRatio: number; // original.length / optimized.length
}

/**
 * Name generation result containing all mappings and metadata
 */
export interface NameGenerationResult {
  nameMap: Map<string, string>; // original -> optimized
  reverseMap: Map<string, string>; // optimized -> original
  generatedNames: GeneratedName[];
  metadata: {
    totalNames: number;
    totalOriginalLength: number;
    totalOptimizedLength: number;
    overallCompressionRatio: number;
    averageNameLength: number;
    collisionCount: number;
    generationTime: number;
    strategy: NameGenerationOptions["strategy"];
    options: NameGenerationOptions;
  };
  statistics: {
    lengthDistribution: Map<number, number>; // length -> count
    frequencyBuckets: Array<{
      range: string;
      count: number;
      averageCompression: number;
    }>;
    mostCompressed: GeneratedName[];
    leastCompressed: GeneratedName[];
  };
}

/**
 * Cache for collision detection and name persistence
 */
export interface NameCollisionCache {
  usedNames: Set<string>;
  reservedNames: Set<string>;
  nameIndex: number;
  lastGenerated: Map<string, string>; // For consistency across runs
}

/**
 * Base conversion result for debugging and analysis
 */
export interface BaseConversionResult {
  input: number;
  output: string;
  base: number;
  length: number;
  valid: boolean;
}

/**
 * Frequency bucket for optimization strategies
 */
export interface FrequencyBucket {
  range: [number, number]; // [min, max) frequency
  names: string[];
  strategy: "shortest" | "short" | "medium" | "standard";
}

/**
 * Pretty name permutation cache for performance optimization
 */
export interface PrettyNameCache {
  permutations: Map<number, string[]>; // length -> sorted permutations array
  usedPermutations: Set<string>; // track exhaustion
  currentIndex: Map<number, number>; // length -> current index in permutations
  totalGenerated: number;
  totalExhausted: number;
  lastGenerated?: string;
}

/**
 * Pretty name generation result with aesthetic scoring
 */
export interface PrettyNameResult {
  name: string;
  length: number;
  aestheticScore: number; // 0-1, higher is more aesthetic
  isExhausted: boolean; // true if we've run out of permutations
  fallbackUsed: boolean; // true if fallback strategy was used
  generationStrategy: "permutation" | "fallback-sequential" | "fallback-hybrid";
}

/**
 * Pretty name generation statistics
 */
export interface PrettyNameStatistics {
  totalPermutations: number;
  usedPermutations: number;
  exhaustionRate: number; // percentage of permutations used
  averageAestheticScore: number;
  fallbackUsageRate: number;
  lengthDistribution: Map<number, number>;
}

/**
 * Error classes for name generation operations
 */
export class NameGenerationError extends Error {
  public cause?: Error;

  constructor(
    message: string,
    cause?: Error,
  ) {
    super(message);
    this.name = "NameGenerationError";
    this.cause = cause;
  }
}

export class CollisionError extends NameGenerationError {
  public conflictingName: string;
  public attemptedName: string;

  constructor(
    message: string,
    conflictingName: string,
    attemptedName: string,
    cause?: Error,
  ) {
    super(message, cause);
    this.name = "CollisionError";
    this.conflictingName = conflictingName;
    this.attemptedName = attemptedName;
  }
}

export class CacheError extends NameGenerationError {
  public operation: "read" | "write" | "clear" | "validate";

  constructor(
    message: string,
    operation: "read" | "write" | "clear" | "validate",
    cause?: Error,
  ) {
    super(message, cause);
    this.name = "CacheError";
    this.operation = operation;
  }
}

export class InvalidNameError extends NameGenerationError {
  public invalidName: string;
  public reason: "css-invalid" | "reserved" | "collision" | "format";

  constructor(
    message: string,
    invalidName: string,
    reason: "css-invalid" | "reserved" | "collision" | "format",
    cause?: Error,
  ) {
    super(message, cause);
    this.name = "InvalidNameError";
    this.invalidName = invalidName;
    this.reason = reason;
  }
}

export class PrettyNameExhaustionError extends NameGenerationError {
  public maxLength: number;
  public totalGenerated: number;
  public availableStrategies: string[];

  constructor(
    message: string,
    maxLength: number,
    totalGenerated: number,
    availableStrategies: string[],
    cause?: Error,
  ) {
    super(message, cause);
    this.name = "PrettyNameExhaustionError";
    this.maxLength = maxLength;
    this.totalGenerated = totalGenerated;
    this.availableStrategies = availableStrategies;
  }
}

/**
 * CSS keyword and framework reserved names that should not be used for generation
 */
export const CSS_RESERVED_KEYWORDS = new Set([
  // CSS property values
  "auto",
  "inherit",
  "initial",
  "unset",
  "revert",
  "none",
  "all",
  "normal",
  "bold",
  "italic",
  "block",
  "inline",
  "hidden",
  "visible",
  "absolute",
  "relative",
  "fixed",
  "static",
  "sticky",

  // CSS units (shouldn't conflict but good to avoid)
  "px",
  "em",
  "rem",
  "vh",
  "vw",
  "vmin",
  "vmax",
  "ch",
  "ex",

  // Color keywords
  "red",
  "blue",
  "green",
  "white",
  "black",
  "gray",
  "yellow",
  "orange",
  "purple",
  "pink",
  "transparent",
  "currentcolor",

  // Flexbox/Grid keywords
  "flex",
  "grid",
  "start",
  "end",
  "center",
  "stretch",
  "baseline",

  // Common framework classes (preserve semantic meaning)
  "container",
  "wrapper",
  "content",
  "main",
  "header",
  "footer",
  "nav",
  "aside",
  "section",
  "article",
  "div",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/**
 * Base alphabet configurations for different optimization strategies
 */
export const ALPHABET_CONFIGS = {
  // Shortest names: lowercase only
  minimal: "abcdefghijklmnopqrstuvwxyz",

  // Standard: lowercase + uppercase
  standard: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",

  // Full: letters + numbers (numbers not at start due to CSS rules)
  full: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",

  // CSS-safe: excludes potentially confusing characters
  cssSafe: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
} as const;

/**
 * Validation patterns for CSS identifiers
 */
export const CSS_IDENTIFIER_PATTERNS = {
  // Must start with letter or underscore, followed by letters, numbers, hyphens, underscores
  valid: /^[a-zA-Z_][a-zA-Z0-9_-]*$/,

  // Start character (letters and underscore only)
  validStart: /^[a-zA-Z_]/,

  // Continuation characters
  validContinuation: /^[a-zA-Z0-9_-]$/,
} as const;

/**
 * Type guards and utility functions
 */
export function isValidCssIdentifier(name: string): boolean {
  return CSS_IDENTIFIER_PATTERNS.valid.test(name);
}

export function isReservedName(
  name: string,
  additionalReserved: Set<string> = new Set(),
): boolean {
  return (
    CSS_RESERVED_KEYWORDS.has(name.toLowerCase()) ||
    additionalReserved.has(name)
  );
}

export function validateNameGenerationOptions(
  options: unknown,
): NameGenerationOptions {
  try {
    return NameGenerationOptionsSchema.parse(options);
  } catch (error) {
    throw new NameGenerationError(
      `Invalid name generation options: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * ===================================================================
 * BASE CONVERSION UTILITIES (Step 2)
 * ===================================================================
 */

/**
 * Convert a number to base-26 representation using lowercase letters (a-z)
 * This generates the shortest possible names: a, b, c, ..., z, aa, ab, etc.
 *
 * @param num - The number to convert (0-based)
 * @returns Base-26 string representation
 *
 * @example
 * toBase26(0) => 'a'
 * toBase26(25) => 'z'
 * toBase26(26) => 'aa'
 * toBase26(51) => 'az'
 */
export function toBase26(num: number): string {
  if (num < 0) {
    throw new NameGenerationError(
      `Invalid input for base-26 conversion: ${num}. Must be non-negative.`,
    );
  }

  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let result = "";

  // Special case for single digit
  if (num < 26) {
    return alphabet[num];
  }

  // Convert using bijective base-26 (like Excel column names)
  let n = num;
  while (n >= 0) {
    result = alphabet[n % 26] + result;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }

  return result;
}

/**
 * Convert a base-26 string back to a number
 *
 * @param str - Base-26 string to convert
 * @returns The corresponding number (0-based)
 */
export function fromBase26(str: string): number {
  if (!str || !/^[a-z]+$/.test(str)) {
    throw new NameGenerationError(
      `Invalid base-26 string: "${str}". Must contain only lowercase letters.`,
    );
  }

  let result = 0;
  const alphabet = "abcdefghijklmnopqrstuvwxyz";

  for (let i = 0; i < str.length; i++) {
    const charIndex = alphabet.indexOf(str[i]);
    result = result * 26 + charIndex + 1;
  }

  return result - 1; // Convert to 0-based
}

/**
 * Convert a number to base-36 representation using letters and numbers
 * Provides more characters for longer sequences: a-z, 0-9
 * Note: Numbers are only used in non-first positions due to CSS rules
 *
 * @param num - The number to convert (0-based)
 * @param useNumbers - Whether to include numbers (0-9) in the alphabet
 * @returns Base-36 string representation
 */
export function toBase36(num: number, useNumbers: boolean = true): string {
  if (num < 0) {
    throw new NameGenerationError(
      `Invalid input for base-36 conversion: ${num}. Must be non-negative.`,
    );
  }

  const letters = "abcdefghijklmnopqrstuvwxyz";

  // Always start with letters for CSS validity, then allow numbers
  if (num < letters.length) {
    return letters[num];
  }

  // For larger numbers, use base-26 for first char, then base-36 for rest
  let remaining = num - letters.length;
  let result = "";

  // Generate with letters first, then append numbers if needed
  if (useNumbers) {
    const numbers = "0123456789";
    const extendedAlphabet = letters + numbers;

    // Use simple bijective base conversion starting with letters
    result = letters[remaining % letters.length];
    remaining = Math.floor(remaining / letters.length);

    while (remaining > 0) {
      result += extendedAlphabet[remaining % extendedAlphabet.length];
      remaining = Math.floor(remaining / extendedAlphabet.length);
    }
  } else {
    // Letters only - use toBase26
    return toBase26(num);
  }

  return result;
}

/**
 * Convert a base-36 string back to a number
 *
 * @param str - Base-36 string to convert
 * @param useNumbers - Whether numbers were used in generation
 * @returns The corresponding number (0-based)
 */
export function fromBase36(str: string, _useNumbers: boolean = true): number {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const alphabet = useNumbers ? letters + numbers : letters;
  const base = alphabet.length;

  if (
    !str ||
    (useNumbers && !/^[a-z][a-z0-9]*$/.test(str)) ||
    (!useNumbers && !/^[a-z]+$/.test(str))
  ) {
    throw new NameGenerationError(
      `Invalid base-36 string: "${str}". Must start with letter and contain only valid characters.`,
    );
  }

  let result = 0;

  for (let i = 0; i < str.length; i++) {
    const charIndex = alphabet.indexOf(str[i]);
    if (charIndex === -1) {
      throw new NameGenerationError(
        `Invalid character "${str[i]}" in base-36 string "${str}".`,
      );
    }
    result = result * base + charIndex + 1;
  }

  return result - 1; // Convert to 0-based
}

/**
 * Convert number to custom alphabet representation
 *
 * @param num - The number to convert
 * @param alphabet - Custom alphabet to use
 * @param ensureCssValid - Ensure first character is CSS-valid (letter or underscore)
 * @returns String representation using custom alphabet
 */
export function toCustomBase(
  num: number,
  alphabet: string,
  ensureCssValid: boolean = true,
): string {
  if (num < 0) {
    throw new NameGenerationError(
      `Invalid input: ${num}. Must be non-negative.`,
    );
  }

  if (!alphabet || alphabet.length < 2) {
    throw new NameGenerationError(
      `Invalid alphabet: "${alphabet}". Must have at least 2 characters.`,
    );
  }

  const base = alphabet.length;
  const cssValidStart = /^[a-zA-Z_]$/;

  if (num < alphabet.length) {
    const char = alphabet[num];
    if (ensureCssValid && !cssValidStart.test(char)) {
      // Find first CSS-valid character in alphabet
      for (let i = 0; i < alphabet.length; i++) {
        if (cssValidStart.test(alphabet[i])) {
          return alphabet[i];
        }
      }
      throw new NameGenerationError(
        `No CSS-valid starting characters found in alphabet: "${alphabet}"`,
      );
    }
    return char;
  }

  let result = "";
  let n = num;

  while (n >= 0) {
    const charIndex = n % base;
    const char = alphabet[charIndex];

    // For first character, ensure CSS validity
    if (result === "" && ensureCssValid && !cssValidStart.test(char)) {
      // Find a valid starting character
      let validIndex = -1;
      for (let i = 0; i < alphabet.length; i++) {
        if (cssValidStart.test(alphabet[i])) {
          validIndex = i;
          break;
        }
      }
      if (validIndex === -1) {
        throw new NameGenerationError(
          `No CSS-valid starting characters in alphabet: "${alphabet}"`,
        );
      }
      result = alphabet[validIndex] + result;
    } else {
      result = char + result;
    }

    n = Math.floor(n / base) - 1;
    if (n < 0) break;
  }

  return result;
}

/**
 * Calculate the optimal name length for a given number of unique identifiers
 *
 * @param count - Number of unique identifiers needed
 * @param alphabet - Alphabet to use for calculation
 * @returns Object with length requirements and capacity information
 */
export function calculateOptimalLength(
  count: number,
  alphabet: string,
): {
  minLength: number;
  capacity: number;
  efficiency: number; // percentage of alphabet space used
  charactersPerLength: number[];
} {
  if (count <= 0) {
    throw new NameGenerationError(`Invalid count: ${count}. Must be positive.`);
  }

  const base = alphabet.length;
  let length = 1;
  const charactersPerLength: number[] = [];

  // Calculate capacity for each length until we can accommodate the count
  while (totalCapacity < count) {
    const capacityAtLength = Math.pow(base, length);
    charactersPerLength.push(capacityAtLength);
    totalCapacity += capacityAtLength;

    if (totalCapacity >= count) {
      return {
        minLength: length,
        capacity: totalCapacity,
        efficiency: (count / totalCapacity) * 100,
        charactersPerLength,
      };
    }

    length++;

    // Safety check to prevent infinite loops
    if (length > 10) {
      throw new NameGenerationError(
        `Calculation exceeded maximum length of 10 for ${count} identifiers.`,
      );
    }
  }

  return {
    minLength: length,
    capacity: totalCapacity,
    efficiency: (count / totalCapacity) * 100,
    charactersPerLength,
  };
}

/**
 * Test and validate base conversion functions
 *
 * @param testCount - Number of values to test
 * @returns Validation result with any errors found
 */
export function validateBaseConversions(
  testCount: number = 1000,
): BaseConversionResult[] {
  const results: BaseConversionResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < testCount; i++) {
    try {
      // Test base-26
      const base26 = toBase26(i);
      const back26 = fromBase26(base26);
      const valid26 = back26 === i && isValidCssIdentifier(base26);

      results.push({
        input: i,
        output: base26,
        base: 26,
        length: base26.length,
        valid: valid26,
      });

      if (!valid26) {
        errors.push(
          `Base-26 conversion failed for ${i}: ${base26} -> ${back26}`,
        );
      }

      // Test base-36
      const base36 = toBase36(i);
      const back36 = fromBase36(base36);
      const valid36 = back36 === i && isValidCssIdentifier(base36);

      if (!valid36) {
        errors.push(
          `Base-36 conversion failed for ${i}: ${base36} -> ${back36}`,
        );
      }
    } catch (error) {
      errors.push(
        `Error testing conversion for ${i}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (errors.length > 0) {
    throw new NameGenerationError(
      `Base conversion validation failed with ${errors.length} errors: ${errors.slice(0, 5).join(", ")}${errors.length > 5 ? "..." : ""}`,
    );
  }

  return results;
}

/**
 * ===================================================================
 * SEQUENTIAL NAME GENERATION ALGORITHM (Step 3)
 * ===================================================================
 */

/**
 * Generate a sequential name for a given index using the specified strategy
 *
 * @param index - The sequential index (0-based)
 * @param options - Name generation options
 * @returns Generated name string
 */
export function generateSequentialName(
  index: number,
  options: NameGenerationOptions,
): string {
  if (index < 0) {
    throw new NameGenerationError(
      `Invalid index: ${index}. Must be non-negative.`,
    );
  }

  const { alphabet, numericSuffix, prefix, suffix, ensureCssValid } = options;

  let baseName: string;

  // Choose conversion method based on alphabet
  if (alphabet === ALPHABET_CONFIGS.minimal) {
    baseName = toBase26(index);
  } else if (numericSuffix && alphabet.includes("0")) {
    baseName = toBase36(index, true);
  } else {
    baseName = toCustomBase(index, alphabet, ensureCssValid);
  }

  // Apply prefix and suffix
  const fullName = `${prefix}${baseName}${suffix}`;

  // Validate CSS compliance if required
  if (ensureCssValid && !isValidCssIdentifier(fullName)) {
    throw new InvalidNameError(
      `Generated name "${fullName}" is not a valid CSS identifier`,
      fullName,
      "css-invalid",
    );
  }

  return fullName;
}

/**
 * Generate multiple sequential names efficiently
 *
 * @param count - Number of names to generate
 * @param options - Name generation options
 * @param startIndex - Starting index (default: 0)
 * @returns Array of generated names
 */
export function generateSequentialNames(
  count: number,
  options: NameGenerationOptions,
  startIndex: number = 0,
): string[] {
  if (count <= 0) {
    throw new NameGenerationError(`Invalid count: ${count}. Must be positive.`);
  }

  const names: string[] = [];
  const { batchSize } = options;

  // Process in batches for memory efficiency
  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, count);

    for (let i = batchStart; i < batchEnd; i++) {
      const name = generateSequentialName(startIndex + i, options);
      names.push(name);
    }

    // Allow garbage collection between batches for large sets
    if (batchEnd < count && count > 10000) {
      // Small delay to prevent memory pressure
      setTimeout(() => {}, 0);
    }
  }

  return names;
}

/**
 * ===================================================================
 * PRETTY NAME GENERATION ALGORITHM (Step 2: Permutation Algorithm)
 * ===================================================================
 */

/**
 * Generate all permutations of alphabet characters without repetition up to maxLength
 *
 * @param alphabet - Available characters for generation
 * @param maxLength - Maximum length for generated names
 * @returns Sorted array of permutations by length then aesthetic score
 */
export function generatePermutationsWithoutRepetition(
  alphabet: string,
  maxLength: number,
): string[] {
  if (maxLength <= 0 || alphabet.length === 0) {
    return [];
  }

  const result: string[] = [];
  const chars = [...new Set(alphabet)]; // Remove duplicates

  // Generate permutations for each length from 1 to maxLength
  for (let length = 1; length <= Math.min(maxLength, chars.length); length++) {
    const permutations = generatePermutationsOfLength(chars, length);
    result.push(...permutations);
  }

  // Sort by aesthetic criteria: shorter first, then by aesthetic score
  return result.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    return calculateAestheticScore(b) - calculateAestheticScore(a); // Higher score first
  });
}

/**
 * Generate all permutations of specified length without character repetition
 *
 * @param chars - Array of available characters
 * @param length - Target length for permutations
 * @returns Array of permutations of specified length
 */
function generatePermutationsOfLength(
  chars: string[],
  length: number,
): string[] {
  if (length === 0) return [""];
  if (length > chars.length) return [];
  if (length === 1) return chars.slice();

  const result: string[] = [];
  const maxResults = 10000; // Safety limit to prevent memory issues

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const remaining = chars.slice(0, i).concat(chars.slice(i + 1));
    const subPermutations = generatePermutationsOfLength(remaining, length - 1);

    for (const subPerm of subPermutations) {
      if (result.length >= maxResults) {
        console.warn(
          `Permutation generation limited to ${maxResults} results for performance`,
        );
        return result;
      }
      result.push(char + subPerm);
    }
  }

  return result;
}

/**
 * Calculate aesthetic score for a name (0-1, higher is better)
 * Considers factors like pronounceability, character flow, and visual appeal
 *
 * @param name - Name to score
 * @returns Aesthetic score between 0 and 1
 */
export function calculateAestheticScore(name: string): number {
  if (!name || name.length === 0) return 0;

  let score = 0.3; // Lower base score to allow for differentiation
  const lower = name.toLowerCase();

  // Prefer shorter names (more moderate preference)
  score += Math.max(0, (6 - name.length) * 0.05); // Reduced from 0.1

  // Vowel-consonant alternation bonus (more pronounceable)
  const vowels = new Set(["a", "e", "i", "o", "u"]);
  let alternationBonus = 0;
  for (let i = 0; i < lower.length - 1; i++) {
    const isVowel = vowels.has(lower[i]);
    const nextIsVowel = vowels.has(lower[i + 1]);
    if (isVowel !== nextIsVowel) {
      alternationBonus += 0.03; // Reduced from 0.05
    }
  }
  score += Math.min(0.15, alternationBonus); // Reduced from 0.2

  // Avoid awkward letter combinations
  const awkwardCombos = ["xz", "qw", "zx", "bk", "gk", "pk", "tk"];
  for (const combo of awkwardCombos) {
    if (lower.includes(combo)) {
      score -= 0.08; // Reduced from 0.1
    }
  }

  // Prefer names that start with common letters (with different weights)
  const commonStartWeights: Record<string, number> = {
    a: 0.08,
    b: 0.06,
    c: 0.05,
    d: 0.04,
    e: 0.07, // Reduced weights
    f: 0.03,
    g: 0.02,
    h: 0.02,
    l: 0.03,
    m: 0.04,
    n: 0.03,
    p: 0.02,
    r: 0.04,
    s: 0.05,
    t: 0.04,
  };
  const startWeight = commonStartWeights[lower[0]] || 0.01; // Reduced from 0.02
  score += startWeight;

  // Small bonus for lowercase start (CSS convention)
  if (name[0] >= "a" && name[0] <= "z") {
    score += 0.01; // Reduced from 0.02
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Create a pretty name cache for performance optimization
 *
 * @param alphabet - Available characters
 * @param maxLength - Maximum length for generated names
 * @returns Initialized pretty name cache
 */
export function createPrettyNameCache(
  alphabet: string,
  maxLength: number,
): PrettyNameCache {
  const cache: PrettyNameCache = {
    permutations: new Map(),
    usedPermutations: new Set(),
    currentIndex: new Map(),
    totalGenerated: 0,
    totalExhausted: 0,
  };

  // Pre-generate permutations for each length (lazy loading approach)
  for (let length = 1; length <= maxLength; length++) {
    cache.currentIndex.set(length, 0);
  }

  return cache;
}

/**
 * Get next permutation from cache, generating on demand
 *
 * @param cache - Pretty name cache
 * @param length - Desired length
 * @param alphabet - Available alphabet
 * @returns Next permutation or null if exhausted
 */
function getNextPermutation(
  cache: PrettyNameCache,
  length: number,
  alphabet: string,
): string | null {
  // Get or generate permutations for this length
  if (!cache.permutations.has(length)) {
    const chars = [...new Set(alphabet)];
    if (length > chars.length) return null;

    const perms = generatePermutationsOfLength(chars, length);
    const sortedPerms = perms.sort(
      (a, b) => calculateAestheticScore(b) - calculateAestheticScore(a),
    );
    cache.permutations.set(length, sortedPerms);
  }

  const permutations = cache.permutations.get(length)!;
  let currentIndex = cache.currentIndex.get(length) || 0;

  // Find next unused permutation
  while (currentIndex < permutations.length) {
    const candidate = permutations[currentIndex];
    currentIndex++;
    cache.currentIndex.set(length, currentIndex);

    if (!cache.usedPermutations.has(candidate)) {
      cache.usedPermutations.add(candidate);
      cache.totalGenerated++;
      cache.lastGenerated = candidate;
      return candidate;
    }
  }

  // This length is exhausted
  cache.totalExhausted++;
  return null;
}

/**
 * Generate a pretty name for a given index with exhaustion handling
 *
 * @param index - Sequential index for consistent generation
 * @param options - Name generation options
 * @returns Pretty name generation result
 */
// Global cache for pretty name generation (shared across calls)
const globalPrettyCache = new Map<string, PrettyNameCache>();

export function generatePrettyName(
  index: number,
  options: NameGenerationOptions,
): PrettyNameResult {
  if (index < 0) {
    throw new NameGenerationError(
      `Invalid index: ${index}. Must be non-negative.`,
    );
  }

  const {
    alphabet,
    prettyNameMaxLength,
    prettyNamePreferShorter,
  } = options;
  const maxLength = prettyNameMaxLength ?? 6; // Use nullish coalescing instead of || to handle 0 properly

  // Add validation for invalid options
  if (maxLength <= 0) {
    throw new NameGenerationError(
      `Invalid prettyNameMaxLength: ${maxLength}. Must be positive.`,
    );
  }

  if (!alphabet || alphabet.length === 0) {
    throw new NameGenerationError(`Invalid alphabet: empty or undefined.`);
  }

  // Create or reuse cache based on alphabet and maxLength
  const cacheKey = `${alphabet}-${maxLength}`;
  let cache = globalPrettyCache.get(cacheKey);
  if (!cache) {
    cache = createPrettyNameCache(alphabet, maxLength);
    globalPrettyCache.set(cacheKey, cache);
  }

  // Try to generate a pretty name
  let result: PrettyNameResult | null = null;

  // Strategy: try shorter lengths first if preferred
  const lengths = prettyNamePreferShorter
    ? Array.from({ length: maxLength }, (_, i) => i + 1)
    : Array.from({ length: maxLength }, (_, i) => maxLength - i);

  for (const length of lengths) {
    const permutation = getNextPermutation(cache, length, alphabet);
    if (permutation) {
      const aestheticScore = calculateAestheticScore(permutation);
      result = {
        name: permutation,
        length,
        aestheticScore,
        isExhausted: false,
        fallbackUsed: false,
        generationStrategy: "permutation",
      };
      break;
    }
  }

  // Handle exhaustion with fallback strategies
  if (!result) {
    result = handlePrettyNameExhaustion(index, options, cache);
  }

  // Apply prefix/suffix
  const finalName = `${options.prefix || ""}${result.name}${options.suffix || ""}`;

  // Validate CSS compliance
  if (options.ensureCssValid && !isValidCssIdentifier(finalName)) {
    // Try fallback if CSS validation fails
    if (!result.fallbackUsed) {
      return handlePrettyNameExhaustion(index, options, cache);
    }
    throw new InvalidNameError(
      `Generated pretty name "${finalName}" is not a valid CSS identifier`,
      finalName,
      "css-invalid",
    );
  }

  return {
    ...result,
    name: finalName,
  };
}

/**
 * Handle pretty name exhaustion with configured fallback strategy
 *
 * @param index - Current generation index
 * @param options - Name generation options
 * @param cache - Pretty name cache with exhaustion info
 * @returns Fallback result
 */
function handlePrettyNameExhaustion(
  index: number,
  options: NameGenerationOptions,
  cache: PrettyNameCache,
): PrettyNameResult {
  const strategy = options.prettyNameExhaustionStrategy || "fallback-hybrid";

  switch (strategy) {
    case "error":
      throw new PrettyNameExhaustionError(
        `Pretty name generation exhausted after ${cache.totalGenerated} names`,
        options.prettyNameMaxLength || 6,
        cache.totalGenerated,
        ["fallback-sequential", "fallback-hybrid"],
      );

    case "fallback-sequential": {
      // Handle single-character alphabets specially
      if (options.alphabet.length === 1) {
        const char = options.alphabet[0];
        const fallbackName = char.repeat(Math.min(index + 1, 6)); // Repeat character
        return {
          name: fallbackName,
          length: fallbackName.length,
          aestheticScore: 0.1, // Low aesthetic score for fallback
          isExhausted: true,
          fallbackUsed: true,
          generationStrategy: "fallback-sequential",
        };
      }

      const sequentialName = generateSequentialName(index, options);
      return {
        name: sequentialName,
        length: sequentialName.length,
        aestheticScore: 0.1, // Low aesthetic score for fallback
        isExhausted: true,
        fallbackUsed: true,
        generationStrategy: "fallback-sequential",
      };
    }

    case "fallback-hybrid":
    default: {
      // Handle single-character alphabets specially
      if (options.alphabet.length === 1) {
        const char = options.alphabet[0];
        const fallbackName = char + (index % 10).toString(); // Add number suffix
        return {
          name: fallbackName,
          length: fallbackName.length,
          aestheticScore: 0.15, // Slightly better than sequential
          isExhausted: true,
          fallbackUsed: true,
          generationStrategy: "fallback-hybrid",
        };
      }

      // Use hybrid approach: try to make sequential names more aesthetic
      const baseName = generateSequentialName(index, options);
      const enhancedName = enhanceNameAesthetics(baseName, options);
      return {
        name: enhancedName,
        length: enhancedName.length,
        aestheticScore: calculateAestheticScore(enhancedName),
        isExhausted: true,
        fallbackUsed: true,
        generationStrategy: "fallback-hybrid",
      };
    }
  }
}

/**
 * Enhance the aesthetics of a generated name by applying transformations
 *
 * @param name - Base name to enhance
 * @param options - Generation options
 * @returns Enhanced name with better aesthetics
 */
function enhanceNameAesthetics(
  name: string,
  options: NameGenerationOptions,
): string {
  // Simple enhancement: try to add vowels or replace awkward combinations
  // This is a fallback, so we keep it simple
  let enhanced = name.toLowerCase();

  // Replace awkward combinations with more aesthetic alternatives
  const replacements: Record<string, string> = {
    aa: "ab",
    bb: "ba",
    cc: "ca",
    dd: "da",
    ff: "fa",
    gg: "ga",
    hh: "ha",
    jj: "ja",
    kk: "ka",
    ll: "la",
    mm: "ma",
    nn: "na",
    pp: "pa",
    qq: "qa",
    rr: "ra",
    ss: "sa",
    tt: "ta",
    vv: "va",
    ww: "wa",
    xx: "xa",
    yy: "ya",
    zz: "za",
  };

  for (const [awkward, better] of Object.entries(replacements)) {
    enhanced = enhanced.replace(new RegExp(awkward, "g"), better);
  }

  return enhanced;
}

/**
 * Create a name collision cache instance
 *
 * @param options - Name generation options
 * @returns Initialized collision cache
 */
export function createNameCollisionCache(
  options: NameGenerationOptions,
): NameCollisionCache {
  const reservedNames = new Set([
    ...CSS_RESERVED_KEYWORDS,
    ...(options.reservedNames || []),
  ]);

  return {
    usedNames: new Set(),
    reservedNames,
    nameIndex: options.startIndex || 0,
    lastGenerated: new Map(),
  };
}

/**
 * Check if a name conflicts with existing names or reserved words
 *
 * @param name - Name to check
 * @param cache - Collision cache
 * @returns True if there's a conflict
 */
export function hasNameCollision(
  name: string,
  cache: NameCollisionCache,
): boolean {
  return (
    cache.usedNames.has(name) || cache.reservedNames.has(name.toLowerCase())
  );
}

/**
 * Generate the next available name, skipping conflicts
 *
 * @param cache - Collision cache
 * @param options - Name generation options
 * @returns Next available name and updated index
 */
export function generateNextAvailableName(
  cache: NameCollisionCache,
  options: NameGenerationOptions,
): { name: string; index: number } {
  let attempts = 0;
  const maxAttempts = Math.min(10000, options.alphabet.length * 100); // More aggressive for small alphabets

  // Check if we have any possible names left
  const alphabetSize = options.alphabet.length;
  const reservedSize = cache.reservedNames.size;
  const usedSize = cache.usedNames.size;

  // Rough estimate: if we've reserved/used nearly all possible short names, fail faster
  if (reservedSize + usedSize >= alphabetSize && alphabetSize < 10) {
    throw new CollisionError(
      `Alphabet exhausted: ${alphabetSize} chars, ${reservedSize} reserved, ${usedSize} used`,
      Array.from(cache.reservedNames).join(","),
      "alphabet-exhausted",
    );
  }

  while (attempts < maxAttempts) {
    const candidate = generateSequentialName(cache.nameIndex, options);

    if (!hasNameCollision(candidate, cache)) {
      // Found available name
      cache.usedNames.add(candidate);
      const currentIndex = cache.nameIndex;
      cache.nameIndex++;

      return { name: candidate, index: currentIndex };
    }

    // Name collision, try next index
    cache.nameIndex++;
    attempts++;
  }

  throw new CollisionError(
    `Failed to generate available name after ${maxAttempts} attempts`,
    "unknown",
    `index-${cache.nameIndex}`,
  );
}

/**
 * Batch generate available names with collision checking
 *
 * @param count - Number of names to generate
 * @param cache - Collision cache
 * @param options - Name generation options
 * @returns Array of generated names with metadata
 */
export function batchGenerateAvailableNames(
  count: number,
  cache: NameCollisionCache,
  options: NameGenerationOptions,
): Array<{ name: string; index: number }> {
  if (count <= 0) {
    throw new NameGenerationError(`Invalid count: ${count}. Must be positive.`);
  }

  const results: Array<{ name: string; index: number }> = [];
  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    const result = generateNextAvailableName(cache, options);
    results.push(result);

    // Performance monitoring for large batches
    if (i > 0 && i % 1000 === 0) {
      const elapsed = Date.now() - startTime;
      const rate = i / (elapsed / 1000);

      if (rate < 100) {
        // Less than 100 names/second indicates potential issues
        console.warn(
          `Name generation rate is low: ${rate.toFixed(1)} names/second`,
        );
      }
    }
  }

  return results;
}

/**
 * Calculate name generation statistics for planning
 *
 * @param count - Expected number of names
 * @param options - Name generation options
 * @returns Statistics about expected name generation
 */
export function calculateGenerationStatistics(
  count: number,
  options: NameGenerationOptions,
): {
  expectedLength: number;
  minLength: number;
  maxLength: number;
  efficiency: number;
  estimatedCollisions: number;
  totalCapacity: number;
} {
  const { alphabet, prefix, suffix } = options;
  const baseCapacity = calculateOptimalLength(count, alphabet);

  const prefixSuffixLength = prefix.length + suffix.length;
  const expectedLength = baseCapacity.minLength + prefixSuffixLength;
  const minLength = 1 + prefixSuffixLength;
  const maxLength =
    Math.min(baseCapacity.minLength + 2, 8) + prefixSuffixLength; // Reasonable max

  // Estimate collision rate based on reserved names
  const reservedCount =
    CSS_RESERVED_KEYWORDS.size + (options.reservedNames?.length || 0);
  const estimatedCollisions = Math.min(reservedCount, count * 0.01); // Assume max 1% collision rate

  return {
    expectedLength,
    minLength,
    maxLength,
    efficiency: baseCapacity.efficiency,
    estimatedCollisions,
    totalCapacity: baseCapacity.capacity,
  };
}

/**
 * Validate name generation options and cache compatibility
 *
 * @param options - Options to validate
 * @param cache - Optional cache to validate against
 * @returns Validation result with any warnings
 */
export function validateGenerationSetup(
  options: NameGenerationOptions,
  cache?: NameCollisionCache,
): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate alphabet
  if (options.alphabet.length < 2) {
    errors.push("Alphabet must have at least 2 characters");
  }

  // Check for CSS validity of alphabet
  const cssValidChars = options.alphabet
    .split("")
    .filter((char) => /^[a-zA-Z0-9_-]$/.test(char));

  if (cssValidChars.length !== options.alphabet.length) {
    warnings.push(
      "Alphabet contains non-CSS-safe characters that may cause issues",
    );
  }

  // Check for CSS-valid starting characters
  const validStartChars = options.alphabet
    .split("")
    .filter((char) => /^[a-zA-Z_]$/.test(char));

  if (validStartChars.length === 0 && options.ensureCssValid) {
    errors.push(
      "No CSS-valid starting characters in alphabet (letters or underscore)",
    );
  }

  // Validate prefix/suffix CSS compliance
  if (options.prefix && !isValidCssIdentifier(options.prefix + "a")) {
    errors.push(
      `Prefix "${options.prefix}" would create invalid CSS identifiers`,
    );
  }

  if (options.suffix && !isValidCssIdentifier("a" + options.suffix)) {
    errors.push(
      `Suffix "${options.suffix}" would create invalid CSS identifiers`,
    );
  }

  // Check cache compatibility
  if (cache) {
    if (cache.nameIndex < options.startIndex) {
      warnings.push(
        "Cache index is behind options.startIndex, may cause duplicates",
      );
    }

    if (cache.reservedNames.size > options.maxCacheSize / 2) {
      warnings.push(
        "Reserved names set is large relative to cache size, may impact performance",
      );
    }
  }

  // Performance warnings
  if (options.batchSize > 10000) {
    warnings.push("Large batch size may cause memory issues");
  }

  if (options.reservedNames.length > 1000) {
    warnings.push("Large reserved names list may impact performance");
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * ===================================================================
 * FREQUENCY-BASED OPTIMIZATION (Step 4)
 * ===================================================================
 */

/**
 * Sort class names by frequency for optimal name assignment
 *
 * @param frequencyMap - Pattern frequency data from analysis
 * @param options - Name generation options
 * @returns Sorted array of class names with frequency data
 */
export function sortByFrequency(
  frequencyMap: PatternFrequencyMap,
  options: NameGenerationOptions,
): Array<{ name: string; frequency: number; data: AggregatedClassData }> {
  const entries = Array.from(frequencyMap.entries())
    .filter(([_, data]) => data.totalFrequency >= options.frequencyThreshold)
    .map(([name, data]) => ({
      name,
      frequency: data.totalFrequency,
      data,
    }))
    .sort((a, b) => b.frequency - a.frequency); // Highest frequency first

  return entries;
}

/**
 * Create frequency buckets for different optimization strategies
 *
 * @param sortedClasses - Classes sorted by frequency
 * @param options - Name generation options
 * @returns Frequency buckets with optimization strategies
 */
export function createFrequencyBuckets(
  sortedClasses: Array<{
    name: string;
    frequency: number;
    data: AggregatedClassData;
  }>,
  options: NameGenerationOptions,
): FrequencyBucket[] {
  if (sortedClasses.length === 0) {
    return [];
  }

  const totalClasses = sortedClasses.length;
  const maxFrequency = sortedClasses[0].frequency;
  const minFrequency = sortedClasses[totalClasses - 1].frequency;

  // Define frequency ranges based on distribution
  const buckets: FrequencyBucket[] = [];

  // Top 5% - shortest possible names (single chars)
  const topThreshold = Math.ceil(totalClasses * 0.05);
  const topClasses = sortedClasses.slice(0, topThreshold);
  if (topClasses.length > 0) {
    buckets.push({
      range: [topClasses[topClasses.length - 1].frequency, maxFrequency],
      names: topClasses.map((c) => c.name),
      strategy: "shortest",
    });
  }

  // Next 15% - short names (2 chars)
  const shortThreshold = Math.ceil(totalClasses * 0.2);
  const shortClasses = sortedClasses.slice(topThreshold, shortThreshold);
  if (shortClasses.length > 0) {
    buckets.push({
      range: [
        shortClasses[shortClasses.length - 1].frequency,
        topClasses[topClasses.length - 1].frequency - 1,
      ],
      names: shortClasses.map((c) => c.name),
      strategy: "short",
    });
  }

  // Next 30% - medium names (3 chars)
  const mediumThreshold = Math.ceil(totalClasses * 0.5);
  const mediumClasses = sortedClasses.slice(shortThreshold, mediumThreshold);
  if (mediumClasses.length > 0) {
    buckets.push({
      range: [
        mediumClasses[mediumClasses.length - 1].frequency,
        shortClasses.length > 0
          ? shortClasses[shortClasses.length - 1].frequency - 1
          : maxFrequency,
      ],
      names: mediumClasses.map((c) => c.name),
      strategy: "medium",
    });
  }

  // Remaining 50% - standard names (4+ chars)
  const standardClasses = sortedClasses.slice(mediumThreshold);
  if (standardClasses.length > 0) {
    buckets.push({
      range: [
        minFrequency,
        mediumClasses.length > 0
          ? mediumClasses[mediumClasses.length - 1].frequency - 1
          : maxFrequency,
      ],
      names: standardClasses.map((c) => c.name),
      strategy: "standard",
    });
  }

  return buckets;
}

/**
 * Generate optimized names based on frequency analysis
 *
 * @param frequencyMap - Pattern frequency data
 * @param options - Name generation options
 * @returns Map of original names to optimized names
 */
export function optimizeByFrequency(
  frequencyMap: PatternFrequencyMap,
  options: NameGenerationOptions,
): Map<string, string> {
  // Ensure options are properly validated with defaults applied
  const validatedOptions = validateNameGenerationOptions(options);

  const nameMap = new Map<string, string>();
  const globalCache = createNameCollisionCache(validatedOptions);

  // Sort classes by frequency (highest first)
  const sortedClasses = sortByFrequency(frequencyMap, validatedOptions);

  if (sortedClasses.length === 0) {
    return nameMap;
  }

  // Create frequency buckets for different strategies
  const buckets = createFrequencyBuckets(sortedClasses, validatedOptions);

  // Process each bucket with its specific strategy and separate index
  for (const bucket of buckets) {
    const bucketOptions = createBucketOptions(
      validatedOptions,
      bucket.strategy,
    );
    const bucketCache = createNameCollisionCache(bucketOptions);

    // Copy used names from global cache to avoid collisions
    for (const usedName of globalCache.usedNames) {
      bucketCache.usedNames.add(usedName);
    }

    for (const className of bucket.names) {
      // Generate optimized name for this class using bucket-specific settings
      const result = generateNextAvailableName(bucketCache, bucketOptions);
      nameMap.set(className, result.name);

      // Add to global cache to prevent future collisions
      globalCache.usedNames.add(result.name);
    }
  }

  return nameMap;
}

/**
 * Create bucket-specific options for different optimization strategies
 *
 * @param baseOptions - Base name generation options
 * @param strategy - Bucket strategy
 * @returns Modified options for the strategy
 */
function createBucketOptions(
  baseOptions: NameGenerationOptions,
  strategy: FrequencyBucket["strategy"],
): NameGenerationOptions {
  const options = { ...baseOptions };

  switch (strategy) {
    case "shortest":
      // Use minimal alphabet for shortest names
      options.alphabet = ALPHABET_CONFIGS.minimal;
      options.numericSuffix = false;
      break;

    case "short":
      // Use standard alphabet, no numeric suffix
      options.alphabet = ALPHABET_CONFIGS.standard;
      options.numericSuffix = false;
      break;

    case "medium":
      // Use standard alphabet with numeric suffix
      options.alphabet = ALPHABET_CONFIGS.standard;
      options.numericSuffix = true;
      break;

    case "standard":
      // Use full alphabet for longer names
      options.alphabet = ALPHABET_CONFIGS.full;
      options.numericSuffix = true;
      break;
  }

  return options;
}

/**
 * Calculate compression statistics for frequency-based optimization
 *
 * @param originalMap - Original class names with frequency data
 * @param optimizedMap - Map of original to optimized names
 * @returns Compression statistics
 */
export function calculateCompressionStats(
  originalMap: Map<string, AggregatedClassData>,
  optimizedMap: Map<string, string>,
): {
  totalOriginalLength: number;
  totalOptimizedLength: number;
  overallCompressionRatio: number;
  classCompressionRatios: GeneratedName[];
  frequencyWeightedCompression: number;
  bestCompressed: GeneratedName[];
  worstCompressed: GeneratedName[];
} {
  let totalOriginalLength = 0;
  let totalOptimizedLength = 0;
  let frequencyWeightedOriginal = 0;
  let frequencyWeightedOptimized = 0;

  const classCompressionRatios: GeneratedName[] = [];

  for (const [original, optimized] of optimizedMap.entries()) {
    const data = originalMap.get(original);
    if (!data) continue;

    const originalLength = original.length;
    const optimizedLength = optimized.length;
    const compressionRatio = originalLength / optimizedLength;
    const frequency = data.totalFrequency;

    totalOriginalLength += originalLength;
    totalOptimizedLength += optimizedLength;

    // Weight by frequency for more accurate savings calculation
    frequencyWeightedOriginal += originalLength * frequency;
    frequencyWeightedOptimized += optimizedLength * frequency;

    classCompressionRatios.push({
      original,
      optimized,
      length: optimizedLength,
      index: -1, // Not applicable for this context
      frequency,
      compressionRatio,
    });
  }

  // Sort by compression ratio for analysis
  classCompressionRatios.sort(
    (a, b) => b.compressionRatio - a.compressionRatio,
  );

  const overallCompressionRatio = totalOriginalLength / totalOptimizedLength;
  const frequencyWeightedCompression =
    frequencyWeightedOriginal / frequencyWeightedOptimized;

  return {
    totalOriginalLength,
    totalOptimizedLength,
    overallCompressionRatio,
    classCompressionRatios,
    frequencyWeightedCompression,
    bestCompressed: classCompressionRatios.slice(0, 10),
    worstCompressed: classCompressionRatios.slice(-10).reverse(),
  };
}

/**
 * Analyze frequency distribution and suggest optimization strategies
 *
 * @param frequencyMap - Pattern frequency data
 * @returns Analysis and recommendations
 */
export function analyzeFrequencyDistribution(
  frequencyMap: PatternFrequencyMap,
): {
  totalClasses: number;
  averageFrequency: number;
  medianFrequency: number;
  frequencyRanges: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  recommendations: string[];
} {
  const frequencies = Array.from(frequencyMap.values())
    .map((data) => data.totalFrequency)
    .sort((a, b) => b - a);

  if (frequencies.length === 0) {
    return {
      totalClasses: 0,
      averageFrequency: 0,
      medianFrequency: 0,
      frequencyRanges: [],
      recommendations: ["No classes found for analysis"],
    };
  }

  const totalClasses = frequencies.length;
  const averageFrequency =
    frequencies.reduce((sum, freq) => sum + freq, 0) / totalClasses;
  const medianFrequency = frequencies[Math.floor(totalClasses / 2)];
  const maxFrequency = frequencies[0];

  // Define frequency ranges
  const ranges = [
    {
      min: Math.floor(maxFrequency * 0.8),
      max: maxFrequency,
      label: "Very High (80-100%)",
    },
    {
      min: Math.floor(maxFrequency * 0.6),
      max: Math.floor(maxFrequency * 0.8) - 1,
      label: "High (60-80%)",
    },
    {
      min: Math.floor(maxFrequency * 0.4),
      max: Math.floor(maxFrequency * 0.6) - 1,
      label: "Medium (40-60%)",
    },
    {
      min: Math.floor(maxFrequency * 0.2),
      max: Math.floor(maxFrequency * 0.4) - 1,
      label: "Low (20-40%)",
    },
    {
      min: 1,
      max: Math.floor(maxFrequency * 0.2) - 1,
      label: "Very Low (1-20%)",
    },
  ];

  const frequencyRanges = ranges.map((range) => {
    const count = frequencies.filter(
      (freq) => freq >= range.min && freq <= range.max,
    ).length;
    return {
      range: range.label,
      count,
      percentage: (count / totalClasses) * 100,
    };
  });

  // Generate recommendations
  const recommendations: string[] = [];

  const veryHighCount = frequencyRanges[0].count;
  const highCount = frequencyRanges[1].count;
  const lowCombined = frequencyRanges[3].count + frequencyRanges[4].count;

  if (veryHighCount > totalClasses * 0.1) {
    recommendations.push(
      `${veryHighCount} classes have very high frequency - excellent candidates for single-character names`,
    );
  }

  if (highCount > totalClasses * 0.15) {
    recommendations.push(
      `${highCount} classes have high frequency - good candidates for 2-character names`,
    );
  }

  if (lowCombined > totalClasses * 0.5) {
    recommendations.push(
      `${lowCombined} classes have low frequency - can use longer optimized names`,
    );
  }

  if (averageFrequency < 3) {
    recommendations.push(
      "Many classes are used infrequently - focus optimization on top 20% by frequency",
    );
  }

  if (totalClasses > 10000) {
    recommendations.push(
      "Large number of classes detected - consider using full alphabet with numeric suffixes",
    );
  }

  return {
    totalClasses,
    averageFrequency,
    medianFrequency,
    frequencyRanges,
    recommendations,
  };
}

/**
 * ===================================================================
 * MAIN API & INTEGRATION (Steps 5-7)
 * ===================================================================
 */

/**
 * Enhanced collision cache with persistence and performance optimization
 */
export class NameCollisionManager {
  private cache: NameCollisionCache;
  private options: NameGenerationOptions;
  private persistenceEnabled: boolean;

  constructor(
    options: NameGenerationOptions,
    persistenceEnabled: boolean = false,
  ) {
    this.options = options;
    this.persistenceEnabled = persistenceEnabled;
    this.cache = createNameCollisionCache(options);
    // Ensure nameIndex is properly initialized
    if (this.cache.nameIndex === undefined || this.cache.nameIndex === null) {
      this.cache.nameIndex = options.startIndex || 0;
    }
  }

  /**
   * Load cached names from previous runs for consistency
   */
  async loadFromCache(cacheData?: Map<string, string>): Promise<void> {
    if (cacheData) {
      this.cache.lastGenerated = new Map(cacheData);

      // Populate used names from cache
      for (const optimizedName of cacheData.values()) {
        this.cache.usedNames.add(optimizedName);
      }

      // Update index to prevent collisions - ensure it's at least the size of cached data
      const currentIndex = this.cache.nameIndex || 0;
      this.cache.nameIndex = Math.max(currentIndex, cacheData.size);
    }
  }

  /**
   * Save current state for future consistency
   */
  async saveToCache(): Promise<Map<string, string>> {
    return new Map(this.cache.lastGenerated);
  }

  /**
   * Check and reserve a name, handling collisions
   */
  reserveName(name: string, originalName?: string): boolean {
    if (hasNameCollision(name, this.cache)) {
      return false;
    }

    this.cache.usedNames.add(name);
    if (originalName) {
      this.cache.lastGenerated.set(originalName, name);
    }
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    usedNames: number;
    reservedNames: number;
    cacheHitRate: number;
    currentIndex: number;
  } {
    const totalAttempts = this.cache.nameIndex;
    const successfulGenerations = this.cache.usedNames.size;

    return {
      usedNames: this.cache.usedNames.size,
      reservedNames: this.cache.reservedNames.size,
      cacheHitRate:
        totalAttempts > 0 ? (successfulGenerations / totalAttempts) * 100 : 0,
      currentIndex: this.cache.nameIndex ?? this.options.startIndex,
    };
  }

  /**
   * Clear cache for fresh start
   */
  clear(): void {
    this.cache.usedNames.clear();
    this.cache.lastGenerated.clear();
    this.cache.nameIndex = this.options.startIndex || 0;
  }
}

/**
 * Main function to generate optimized names from pattern frequency data
 *
 * @param frequencyMap - Pattern frequency data from analysis
 * @param options - Name generation options
 * @param existingCache - Optional existing cache for consistency
 * @returns Complete name generation result
 */
export async function generateOptimizedNames(
  frequencyMap: PatternFrequencyMap,
  options: Partial<NameGenerationOptions> = {},
  existingCache?: Map<string, string>,
): Promise<NameGenerationResult> {
  const startTime = Date.now();
  const defaultOptions: NameGenerationOptions = {
    strategy: "frequency-optimized",
    batchSize: 1000,
    alphabet: "abcdefghijklmnopqrstuvwxyz",
    numericSuffix: false,
    startIndex: 0,
    enableFrequencyOptimization: true,
    frequencyThreshold: 1,
    enableCaching: false,
    reservedNames: ["a", "an", "and", "or", "not"],
    avoidConflicts: true,
    maxCacheSize: 50000,
    prefix: "",
    suffix: "",
    ensureCssValid: true,
    prettyNameMaxLength: 6,
    prettyNamePreferShorter: true,
    prettyNameExhaustionStrategy: "fallback-hybrid",
  };
  const validatedOptions = validateNameGenerationOptions({
    ...defaultOptions,
    ...options,
  });

  // Validate setup
  const validation = validateGenerationSetup(validatedOptions);
  if (!validation.valid) {
    throw new NameGenerationError(
      `Setup validation failed: ${validation.errors.join(", ")}`,
    );
  }

  // Create collision manager
  const collisionManager = new NameCollisionManager(
    validatedOptions,
    validatedOptions.enableCaching,
  );
  await collisionManager.loadFromCache(existingCache);

  // Generate optimized names based on strategy
  let nameMap: Map<string, string>;

  switch (validatedOptions.strategy) {
    case "frequency-optimized":
      nameMap = optimizeByFrequency(frequencyMap, validatedOptions);
      break;

    case "sequential":
      nameMap = generateSequentialMapping(frequencyMap, validatedOptions);
      break;

    case "hybrid":
      nameMap = generateHybridMapping(frequencyMap, validatedOptions);
      break;

    case "pretty":
      nameMap = generatePrettyMapping(frequencyMap, validatedOptions);
      break;

    default:
      throw new NameGenerationError(
        `Unknown strategy: ${validatedOptions.strategy}`,
      );
  }

  // Calculate statistics
  const compressionStats = calculateCompressionStats(frequencyMap, nameMap);
  const generatedNames = createGeneratedNameArray(frequencyMap, nameMap);

  const endTime = Date.now();
  const generationTime = endTime - startTime;

  // Create result
  const result: NameGenerationResult = {
    nameMap,
    reverseMap: new Map(Array.from(nameMap.entries()).map(([k, v]) => [v, k])),
    generatedNames,
    metadata: {
      totalNames: nameMap.size,
      totalOriginalLength: compressionStats.totalOriginalLength,
      totalOptimizedLength: compressionStats.totalOptimizedLength,
      overallCompressionRatio: compressionStats.overallCompressionRatio,
      averageNameLength: compressionStats.totalOptimizedLength / nameMap.size,
      collisionCount: 0, // TODO: Track collisions in manager
      generationTime,
      strategy: validatedOptions.strategy,
      options: validatedOptions,
    },
    statistics: {
      lengthDistribution: calculateLengthDistribution(generatedNames),
      frequencyBuckets: calculateFrequencyBucketStats(generatedNames),
      mostCompressed: compressionStats.bestCompressed.slice(0, 5),
      leastCompressed: compressionStats.worstCompressed.slice(0, 5),
    },
  };

  // Save cache if enabled
  if (validatedOptions.enableCaching) {
    await collisionManager.saveToCache();
  }

  return result;
}

/**
 * Generate sequential mapping without frequency optimization
 */
function generateSequentialMapping(
  frequencyMap: PatternFrequencyMap,
  options: NameGenerationOptions,
): Map<string, string> {
  const nameMap = new Map<string, string>();
  const classNames = Array.from(frequencyMap.keys()).sort(); // Alphabetical order
  const cache = createNameCollisionCache(options);

  for (const className of classNames) {
    const result = generateNextAvailableName(cache, options);
    nameMap.set(className, result.name);
  }

  return nameMap;
}

/**
 * Generate hybrid mapping combining frequency and sequential strategies
 */
function generateHybridMapping(
  frequencyMap: PatternFrequencyMap,
  options: NameGenerationOptions,
): Map<string, string> {
  const nameMap = new Map<string, string>();
  const sortedClasses = sortByFrequency(frequencyMap, options);

  // Use frequency optimization for top 50%, sequential for rest
  const splitPoint = Math.floor(sortedClasses.length * 0.5);
  const highFrequencyClasses = sortedClasses.slice(0, splitPoint);
  const lowFrequencyClasses = sortedClasses.slice(splitPoint);

  // Generate frequency-optimized names for high-frequency classes
  const highFreqMap = new Map(
    highFrequencyClasses.map((item) => [item.name, item.data]),
  );
  const optimizedMap = optimizeByFrequency(highFreqMap, options);

  // Add to result
  for (const [className, optimizedName] of optimizedMap.entries()) {
    nameMap.set(className, optimizedName);
  }

  // Generate sequential names for low-frequency classes
  const cache = createNameCollisionCache(options);
  // Update cache with already used names
  for (const optimizedName of optimizedMap.values()) {
    cache.usedNames.add(optimizedName);
  }

  for (const item of lowFrequencyClasses) {
    const result = generateNextAvailableName(cache, options);
    nameMap.set(item.name, result.name);
  }

  return nameMap;
}

/**
 * Generate pretty name mapping using permutation-based approach
 */
function generatePrettyMapping(
  frequencyMap: PatternFrequencyMap,
  options: NameGenerationOptions,
): Map<string, string> {
  const nameMap = new Map<string, string>();
  const sortedClasses = sortByFrequency(frequencyMap, options);

  // Create a shared pretty name cache for efficient permutation management
  const prettyCache = createPrettyNameCache(
    options.alphabet,
    options.prettyNameMaxLength || 6,
  );
  const collisionCache = createNameCollisionCache(options);

  let index = 0;
  const statistics = {
    permutationCount: 0,
    fallbackCount: 0,
    totalAestheticScore: 0,
  };

  for (const classItem of sortedClasses) {
    try {
      // Generate pretty name for this class
      const prettyResult = generatePrettyNameWithCache(
        index,
        options,
        prettyCache,
        collisionCache,
      );

      // Track statistics
      statistics.totalAestheticScore += prettyResult.aestheticScore;
      if (prettyResult.fallbackUsed) {
        statistics.fallbackCount++;
      } else {
        statistics.permutationCount++;
      }

      nameMap.set(classItem.name, prettyResult.name);
      index++;
    } catch (error) {
      // If pretty name generation fails completely, fall back to sequential
      if (
        error instanceof PrettyNameExhaustionError &&
        options.prettyNameExhaustionStrategy === "error"
      ) {
        throw error; // Re-throw if error strategy is selected
      }

      // Fallback to sequential generation
      const fallbackResult = generateNextAvailableName(collisionCache, options);
      nameMap.set(classItem.name, fallbackResult.name);
      statistics.fallbackCount++;
      index++;
    }
  }

  // Log statistics for debugging
  console.debug(
    `Pretty name generation complete: ${statistics.permutationCount} permutations, ${statistics.fallbackCount} fallbacks, average aesthetic score: ${statistics.totalAestheticScore / sortedClasses.length}`,
  );

  return nameMap;
}

/**
 * Generate pretty name with shared cache management and collision detection
 */
function generatePrettyNameWithCache(
  index: number,
  options: NameGenerationOptions,
  prettyCache: PrettyNameCache,
  collisionCache: NameCollisionCache,
): PrettyNameResult {
  const maxAttempts = 1000; // Prevent infinite loops
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = generatePrettyNameFromCache(
      index + attempts,
      options,
      prettyCache,
    );

    // Check for collisions with existing names
    if (!hasNameCollision(result.name, collisionCache)) {
      // Success - add to collision cache and return
      collisionCache.usedNames.add(result.name);
      return result;
    }

    // Collision detected, try next permutation
    attempts++;

    // If we're using fallback strategy, collision handling is different
    if (result.fallbackUsed) {
      // For fallback names, we can modify them to avoid collisions
      const modifiedName = result.name + attempts;
      if (!hasNameCollision(modifiedName, collisionCache)) {
        collisionCache.usedNames.add(modifiedName);
        return {
          ...result,
          name: modifiedName,
        };
      }
    }
  }

  // If we can't find a non-colliding name, throw an error
  throw new CollisionError(
    `Unable to generate non-colliding pretty name after ${maxAttempts} attempts`,
    "multiple-collisions",
    "pretty-name-generation",
  );
}

/**
 * Generate pretty name from cache without collision checking (internal use)
 */
function generatePrettyNameFromCache(
  index: number,
  options: NameGenerationOptions,
  cache: PrettyNameCache,
): PrettyNameResult {
  const {
    alphabet,
    prettyNameMaxLength,
    prettyNamePreferShorter,
  } = options;
  const maxLength = prettyNameMaxLength || 6;

  // Try to generate a pretty name from permutations
  let result: PrettyNameResult | null = null;

  // Strategy: try lengths in order based on preference
  const lengths = prettyNamePreferShorter
    ? Array.from({ length: maxLength }, (_, i) => i + 1)
    : Array.from({ length: maxLength }, (_, i) => maxLength - i);

  for (const length of lengths) {
    const permutation = getNextPermutation(cache, length, alphabet);
    if (permutation) {
      const aestheticScore = calculateAestheticScore(permutation);
      result = {
        name: permutation,
        length,
        aestheticScore,
        isExhausted: false,
        fallbackUsed: false,
        generationStrategy: "permutation",
      };
      break;
    }
  }

  // Handle exhaustion with fallback strategies
  if (!result) {
    result = handlePrettyNameExhaustion(index, options, cache);
  }

  // Apply prefix/suffix
  const finalName = `${options.prefix || ""}${result.name}${options.suffix || ""}`;

  // Validate CSS compliance
  if (options.ensureCssValid && !isValidCssIdentifier(finalName)) {
    // Try fallback if CSS validation fails
    if (!result.fallbackUsed) {
      return handlePrettyNameExhaustion(index, options, cache);
    }
    throw new InvalidNameError(
      `Generated pretty name "${finalName}" is not a valid CSS identifier`,
      finalName,
      "css-invalid",
    );
  }

  return {
    ...result,
    name: finalName,
  };
}

/**
 * Create array of GeneratedName objects with full metadata
 */
function createGeneratedNameArray(
  frequencyMap: PatternFrequencyMap,
  nameMap: Map<string, string>,
): GeneratedName[] {
  const generatedNames: GeneratedName[] = [];
  let index = 0;

  for (const [original, optimized] of nameMap.entries()) {
    const data = frequencyMap.get(original);
    if (data) {
      generatedNames.push({
        original,
        optimized,
        length: optimized.length,
        index: index++,
        frequency: data.totalFrequency,
        compressionRatio: original.length / optimized.length,
      });
    }
  }

  return generatedNames;
}

/**
 * Calculate length distribution statistics
 */
function calculateLengthDistribution(
  generatedNames: GeneratedName[],
): Map<number, number> {
  const distribution = new Map<number, number>();

  for (const name of generatedNames) {
    const length = name.length;
    distribution.set(length, (distribution.get(length) || 0) + 1);
  }

  return distribution;
}

/**
 * Calculate frequency bucket statistics
 */
function calculateFrequencyBucketStats(generatedNames: GeneratedName[]): Array<{
  range: string;
  count: number;
  averageCompression: number;
}> {
  if (generatedNames.length === 0) return [];

  const sortedByFreq = [...generatedNames].sort(
    (a, b) => b.frequency - a.frequency,
  );
  const maxFreq = sortedByFreq[0].frequency;
  const minFreq = sortedByFreq[sortedByFreq.length - 1].frequency;

  const buckets = [
    { min: maxFreq * 0.8, max: maxFreq, label: "Very High" },
    { min: maxFreq * 0.6, max: maxFreq * 0.8, label: "High" },
    { min: maxFreq * 0.4, max: maxFreq * 0.6, label: "Medium" },
    { min: maxFreq * 0.2, max: maxFreq * 0.4, label: "Low" },
    { min: minFreq, max: maxFreq * 0.2, label: "Very Low" },
  ];

  return buckets.map((bucket) => {
    const bucketNames = generatedNames.filter(
      (name) => name.frequency >= bucket.min && name.frequency < bucket.max,
    );

    const averageCompression =
      bucketNames.length > 0
        ? bucketNames.reduce((sum, name) => sum + name.compressionRatio, 0) /
          bucketNames.length
        : 0;

    return {
      range: bucket.label,
      count: bucketNames.length,
      averageCompression,
    };
  });
}

/**
 * Export name generation result to JSON format
 *
 * @param result - Name generation result
 * @returns JSON-serializable export format
 */
export function exportNameGenerationResult(result: NameGenerationResult): {
  nameMap: Record<string, string>;
  reverseMap: Record<string, string>;
  metadata: NameGenerationResult["metadata"];
  statistics: {
    lengthDistribution: Record<number, number>;
    frequencyBuckets: NameGenerationResult["statistics"]["frequencyBuckets"];
    mostCompressed: GeneratedName[];
    leastCompressed: GeneratedName[];
  };
} {
  return {
    nameMap: Object.fromEntries(result.nameMap),
    reverseMap: Object.fromEntries(result.reverseMap),
    metadata: result.metadata,
    statistics: {
      lengthDistribution: Object.fromEntries(
        result.statistics.lengthDistribution,
      ),
      frequencyBuckets: result.statistics.frequencyBuckets,
      mostCompressed: result.statistics.mostCompressed,
      leastCompressed: result.statistics.leastCompressed,
    },
  };
}

/**
 * Quick utility function for simple name generation without frequency data
 *
 * @param classNames - Array of class names to optimize
 * @param options - Name generation options
 * @returns Simple mapping of original to optimized names
 */
export async function generateSimpleNames(
  classNames: string[],
  options: Partial<NameGenerationOptions> = {},
): Promise<Map<string, string>> {
  const defaultOptions: NameGenerationOptions = {
    strategy: "sequential",
    batchSize: 1000,
    alphabet: "abcdefghijklmnopqrstuvwxyz",
    numericSuffix: false,
    startIndex: 0,
    enableFrequencyOptimization: false,
    frequencyThreshold: 1,
    enableCaching: false,
    reservedNames: ["a", "an", "and", "or", "not"],
    avoidConflicts: true,
    maxCacheSize: 50000,
    prefix: "",
    suffix: "",
    ensureCssValid: true,
    prettyNameMaxLength: 6,
    prettyNamePreferShorter: true,
    prettyNameExhaustionStrategy: "fallback-hybrid",
  };
  const validatedOptions = validateNameGenerationOptions({
    ...defaultOptions,
    ...options,
  });
  const nameMap = new Map<string, string>();
  const cache = createNameCollisionCache(validatedOptions);

  for (const className of classNames) {
    const result = generateNextAvailableName(cache, validatedOptions);
    nameMap.set(className, result.name);
  }

  return nameMap;
}
