/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import { enforceMinimumLength } from './lengthEnforcement';

/**
 * Configuration options for name generation
 */
export const NameGenerationOptionsSchema = z.object({
  // Base configuration
  alphabet: z.string().min(2).default('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'),

  /**
   * Minimum length for generated class names
   *
   * Ensures all generated names meet a minimum character count.
   * Names shorter than this will be padded with alphabet characters.
   * Range: 1-26 characters (integers only)
   *
   * @default 1
   * @example
   * // With minimumLength: 3
   * // 'a' becomes 'aaa'
   * // 'ab' becomes 'aab'
   * // 'abc' stays 'abc'
   */
  minimumLength: z.number().int().min(1).max(26).optional(),

  numericSuffix: z.boolean().default(true), // Allow 0-9 in names (but not at start)

  // Generation strategy
  strategy: z
    .enum(['sequential', 'frequency-optimized', 'hybrid', 'pretty'])
    .default('frequency-optimized'),
  startIndex: z.number().min(0).default(0),

  // Pretty name generation options
  prettyNameMaxLength: z.number().min(1).max(10).default(6), // Maximum length for pretty names
  prettyNamePreferShorter: z.boolean().default(true), // Prefer shorter names when possible
  prettyNameExhaustionStrategy: z
    .enum(['fallback-sequential', 'fallback-hybrid', 'error'])
    .default('fallback-hybrid'),

  // Frequency optimization
  enableFrequencyOptimization: z.boolean().default(true),
  frequencyThreshold: z.number().min(0).default(1), // Minimum frequency for optimization

  // Collision avoidance
  reservedNames: z.array(z.string()).default([
    // CSS keywords
    'auto',
    'inherit',
    'initial',
    'unset',
    'revert',
    'none',
    'all',
    // Common framework classes that shouldn't be minified
    'container',
    'wrapper',
    'main',
    'header',
    'footer',
    'nav',
    'aside',
  ]),
  avoidConflicts: z.boolean().default(true),

  // Performance options
  enableCaching: z.boolean().default(true),
  batchSize: z.number().min(1).default(1000),
  maxCacheSize: z.number().min(100).default(50000),

  // Output format
  prefix: z.string().default(''),
  suffix: z.string().default(''),
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
    strategy: NameGenerationOptions['strategy'];
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
  strategy: 'shortest' | 'short' | 'medium' | 'standard';
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
  generationStrategy: 'permutation' | 'fallback-sequential' | 'fallback-hybrid';
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

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'NameGenerationError';
    this.cause = cause;
  }
}

export class CollisionError extends NameGenerationError {
  public conflictingName: string;
  public attemptedName: string;

  constructor(message: string, conflictingName: string, attemptedName: string, cause?: Error) {
    super(message, cause);
    this.name = 'CollisionError';
    this.conflictingName = conflictingName;
    this.attemptedName = attemptedName;
  }
}

export class CacheError extends NameGenerationError {
  public operation: 'read' | 'write' | 'clear' | 'validate';

  constructor(message: string, operation: 'read' | 'write' | 'clear' | 'validate', cause?: Error) {
    super(message, cause);
    this.name = 'CacheError';
    this.operation = operation;
  }
}

export class InvalidNameError extends NameGenerationError {
  public invalidName: string;
  public reason: 'css-invalid' | 'reserved' | 'collision' | 'format';

  constructor(
    message: string,
    invalidName: string,
    reason: 'css-invalid' | 'reserved' | 'collision' | 'format',
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'InvalidNameError';
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
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'PrettyNameExhaustionError';
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
  'auto',
  'inherit',
  'initial',
  'unset',
  'revert',
  'none',
  'all',
  'normal',
  'bold',
  'italic',
  'block',
  'inline',
  'hidden',
  'visible',
  'absolute',
  'relative',
  'fixed',
  'static',
  'sticky',

  // CSS units (shouldn't conflict but good to avoid)
  'px',
  'em',
  'rem',
  'vh',
  'vw',
  'vmin',
  'vmax',
  'ch',
  'ex',

  // Color keywords
  'red',
  'blue',
  'green',
  'white',
  'black',
  'gray',
  'yellow',
  'orange',
  'purple',
  'pink',
  'transparent',
  'currentcolor',

  // Flexbox/Grid keywords
  'flex',
  'grid',
  'start',
  'end',
  'center',
  'stretch',
  'baseline',

  // Common framework classes (preserve semantic meaning)
  'container',
  'wrapper',
  'content',
  'main',
  'header',
  'footer',
  'nav',
  'aside',
  'section',
  'article',
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/**
 * Base alphabet configurations for different optimization strategies
 */
export const ALPHABET_CONFIGS = {
  // Shortest names: lowercase only
  minimal: 'abcdefghijklmnopqrstuvwxyz',

  // Standard: lowercase + uppercase
  standard: 'abcdefghijklmnopqrstuvwxyz',

  // Full: letters + numbers (numbers not at start due to CSS rules)
  full: 'abcdefghijklmnopqrstuvwxyz',

  // CSS-safe: excludes potentially confusing characters
  cssSafe: 'abcdefghijklmnopqrstuvwxyz',
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

export function isReservedName(name: string, additionalReserved: Set<string> = new Set()): boolean {
  return CSS_RESERVED_KEYWORDS.has(name.toLowerCase()) || additionalReserved.has(name);
}

export function validateNameGenerationOptions(options: unknown): NameGenerationOptions {
  try {
    // First validate that the input is an object
    if (typeof options !== 'object' || options === null) {
      throw new Error('Options must be an object');
    }

    const inputOptions = options as Record<string, unknown>;

    // If minimumLength is provided, validate it strictly before Zod parsing
    if ('minimumLength' in inputOptions) {
      const minLength = inputOptions.minimumLength;

      // Check type first
      if (typeof minLength !== 'number') {
        throw new Error(`minimumLength must be a number, received ${typeof minLength}`);
      }

      // Check if it's an integer
      if (!Number.isInteger(minLength)) {
        throw new Error(`minimumLength must be an integer, received ${minLength}`);
      }

      // Check range
      if (minLength < 1 || minLength > 26) {
        throw new Error(`minimumLength must be between 1 and 26, received ${minLength}`);
      }
    }

    const parsed = NameGenerationOptionsSchema.parse(options);

    // Handle default values manually to ensure proper validation
    return {
      ...parsed,
      minimumLength: parsed.minimumLength ?? 1, // Set default value manually
    };
  } catch (error) {
    throw new NameGenerationError(
      `Invalid name generation options: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
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
 * @param minimumLength - Optional minimum length for the result (pads with random characters)
 * @returns Base-26 string representation
 *
 * @example
 * toBase26(0) => 'a'
 * toBase26(25) => 'z'
 * toBase26(26) => 'aa'
 * toBase26(51) => 'az'
 * toBase26(0, 3) => 'aXY' (where XY are cryptographically random)
 */
export function toBase26(num: number, minimumLength?: number): string {
  if (num < 0) {
    throw new NameGenerationError(
      `Invalid input for base-26 conversion: ${num}. Must be non-negative.`
    );
  }

  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';

  // Special case for single digit
  if (num < 26) {
    result = alphabet[num];
  } else {
    // Convert using bijective base-26 (like Excel column names)
    let n = num;
    while (n >= 0) {
      result = alphabet[n % 26] + result;
      n = Math.floor(n / 26) - 1;
      if (n < 0) break;
    }
  }

  // Apply minimum length enforcement if specified
  if (minimumLength && minimumLength > 1) {
    result = enforceMinimumLength(result, minimumLength, {
      alphabet,
      ensureCssValid: true,
    });
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
      `Invalid base-26 string: "${str}". Must contain only lowercase letters.`
    );
  }

  let result = 0;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

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
 * @param minimumLength - Optional minimum length for the result (pads with random characters)
 * @returns Base-36 string representation
 */
export function toBase36(num: number, useNumbers: boolean = true, minimumLength?: number): string {
  if (num < 0) {
    throw new NameGenerationError(
      `Invalid input for base-36 conversion: ${num}. Must be non-negative.`
    );
  }

  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';

  if (!useNumbers) {
    // Letters only - use toBase26 with minimumLength passed through
    return toBase26(num, minimumLength);
  }

  // CSS-compliant base-36: letter first, then numbers+letters for subsequent positions
  const numbers = '0123456789';
  const secondPosAlphabet = numbers + letters; // Numbers first for CSS: a0, a1, ..., a9, aa, ab, ...

  if (num < letters.length) {
    // 0-25: a, b, ..., z
    result = letters[num];
  } else {
    // 26+: Two-char pattern starting with letters
    const remaining = num - letters.length; // 0-based after z

    const firstChar = letters[Math.floor(remaining / secondPosAlphabet.length)];
    const secondChar = secondPosAlphabet[remaining % secondPosAlphabet.length];

    result = firstChar + secondChar;
  }

  // Apply minimum length enforcement if specified
  if (minimumLength && minimumLength > 1) {
    const alphabet = useNumbers ? letters + numbers : letters;
    result = enforceMinimumLength(result, minimumLength, {
      alphabet,
      ensureCssValid: true,
    });
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
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const alphabet = _useNumbers ? letters + numbers : letters;
  const base = alphabet.length;

  if (
    !str ||
    (_useNumbers && !/^[a-z][a-z0-9]*$/.test(str)) ||
    (!_useNumbers && !/^[a-z]+$/.test(str))
  ) {
    throw new NameGenerationError(
      `Invalid base-36 string: "${str}". Must start with letter and contain only valid characters.`
    );
  }

  let result = 0;

  for (let i = 0; i < str.length; i++) {
    const charIndex = alphabet.indexOf(str[i]);
    if (charIndex === -1) {
      throw new NameGenerationError(`Invalid character "${str[i]}" in base-36 string "${str}".`);
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
 * @param minimumLength - Optional minimum length for the result (pads with random characters)
 * @returns String representation using custom alphabet
 */
export function toCustomBase(
  num: number,
  alphabet: string,
  ensureCssValid: boolean = true,
  minimumLength?: number
): string {
  if (num < 0) {
    throw new NameGenerationError(`Invalid input: ${num}. Must be non-negative.`);
  }

  if (!alphabet || alphabet.length < 2) {
    throw new NameGenerationError(
      `Invalid alphabet: "${alphabet}". Must have at least 2 characters.`
    );
  }

  const base = alphabet.length;
  const cssValidStart = /^[a-zA-Z_]$/;

  let result = '';

  if (num < alphabet.length) {
    const char = alphabet[num];
    if (ensureCssValid && !cssValidStart.test(char)) {
      // Find first CSS-valid character in alphabet
      for (let i = 0; i < alphabet.length; i++) {
        if (cssValidStart.test(alphabet[i])) {
          result = alphabet[i];
          break;
        }
      }
      if (!result) {
        throw new NameGenerationError(
          `No CSS-valid starting characters found in alphabet: "${alphabet}"`
        );
      }
    } else {
      result = char;
    }
  } else {
    let n = num;

    while (n >= 0) {
      const charIndex = n % base;
      const char = alphabet[charIndex];

      // For first character, ensure CSS validity
      if (result === '' && ensureCssValid && !cssValidStart.test(char)) {
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
            `No CSS-valid starting characters in alphabet: "${alphabet}"`
          );
        }
        result = alphabet[validIndex] + result;
      } else {
        result = char + result;
      }

      n = Math.floor(n / base) - 1;
      if (n < 0) break;
    }
  }

  // Apply minimum length enforcement if specified
  if (minimumLength && minimumLength > 1) {
    result = enforceMinimumLength(result, minimumLength, {
      alphabet,
      ensureCssValid,
    });
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
  alphabet: string
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
  let totalCapacity = 0;
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
        `Calculation exceeded maximum length of 10 for ${count} identifiers.`
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
export function validateBaseConversions(testCount: number = 1000): BaseConversionResult[] {
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
        errors.push(`Base-26 conversion failed for ${i}: ${base26} -> ${back26}`);
      }

      // Test base-36
      const base36 = toBase36(i);
      const back36 = fromBase36(base36);
      const valid36 = back36 === i && isValidCssIdentifier(base36);

      if (!valid36) {
        errors.push(`Base-36 conversion failed for ${i}: ${base36} -> ${back36}`);
      }
    } catch (error) {
      errors.push(
        `Error testing conversion for ${i}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (errors.length > 0) {
    throw new NameGenerationError(
      `Base conversion validation failed with ${errors.length} errors: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? '...' : ''}`
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
export function generateSequentialName(index: number, options: NameGenerationOptions): string {
  if (index < 0) {
    throw new NameGenerationError(`Invalid index: ${index}. Must be non-negative.`);
  }

  // Ensure options have proper defaults applied
  const validatedOptions = validateNameGenerationOptions(options);
  const { alphabet, numericSuffix, prefix, suffix, ensureCssValid, minimumLength } =
    validatedOptions;

  let baseName: string;

  // Choose conversion method based on alphabet
  if (alphabet === ALPHABET_CONFIGS.minimal) {
    baseName = toBase26(index, minimumLength);
  } else if (numericSuffix && alphabet.includes('0')) {
    baseName = toBase36(index, true, minimumLength);
  } else {
    baseName = toCustomBase(index, alphabet, ensureCssValid, minimumLength);
  }

  // The base conversion functions now handle minimumLength internally

  // Apply prefix and suffix
  const fullName = `${prefix}${baseName}${suffix}`;

  // Validate CSS compliance if required
  if (ensureCssValid && !isValidCssIdentifier(fullName)) {
    throw new InvalidNameError(
      `Generated name "${fullName}" is not a valid CSS identifier`,
      fullName,
      'css-invalid'
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
  startIndex: number = 0
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
 * Streaming permutation iterator for memory-efficient generation
 * Replaces the memory-intensive generatePermutationsOfLength for large sets
 */
export class PermutationIterator {
  private chars: string[];
  private length: number;
  private currentIndices: number[];
  private finished: boolean = false;
  private generatedCount: number = 0;
  private maxResults: number;

  constructor(alphabet: string, length: number, maxResults: number = 10000) {
    this.chars = [...new Set(alphabet)]; // Remove duplicates
    this.length = length;
    this.maxResults = maxResults;

    if (length <= 0 || this.chars.length === 0 || length > this.chars.length) {
      this.finished = true;
      this.currentIndices = [];
    } else {
      // Initialize with first permutation indices (0, 1, 2, ..., length-1)
      this.currentIndices = Array.from({ length }, (_, i) => i);
    }
  }

  *generate(): Generator<string, void, unknown> {
    if (this.finished) return;

    while (!this.finished && this.generatedCount < this.maxResults) {
      // Generate current permutation
      const permutation = this.currentIndices.map((i) => this.chars[i]).join('');
      yield permutation;
      this.generatedCount++;

      // Move to next permutation using Heap's algorithm variant
      this.nextPermutation();
    }
  }

  private nextPermutation(): void {
    // Generate next lexicographic permutation of indices
    let i = this.length - 2;

    // Find the largest index i such that indices[i] < indices[i + 1]
    while (i >= 0 && this.currentIndices[i] >= this.currentIndices[i + 1]) {
      i--;
    }

    if (i < 0) {
      // No more permutations
      this.finished = true;
      return;
    }

    // Find the largest index j such that indices[i] < indices[j]
    let j = this.length - 1;
    while (this.currentIndices[i] >= this.currentIndices[j]) {
      j--;
    }

    // Swap indices[i] and indices[j]
    [this.currentIndices[i], this.currentIndices[j]] = [
      this.currentIndices[j],
      this.currentIndices[i],
    ];

    // Reverse the suffix starting at indices[i + 1]
    const suffix = this.currentIndices.slice(i + 1).reverse();
    this.currentIndices.splice(i + 1, suffix.length, ...suffix);
  }

  getTotalCount(): number {
    return this.generatedCount;
  }

  isFinished(): boolean {
    return this.finished;
  }
}

/**
 * Generate all permutations of alphabet characters without repetition up to maxLength
 *
 * @param alphabet - Available characters for generation
 * @param maxLength - Maximum length for generated names
 * @returns Sorted array of permutations by length then aesthetic score
 */
export function generatePermutationsWithoutRepetition(
  alphabet: string,
  maxLength: number
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
 * Memory-efficient permutation generation using streaming iterator
 * Replaces generatePermutationsOfLength for better memory usage
 *
 * @param chars - Array of available characters
 * @param length - Target length for permutations
 * @param maxResults - Maximum number of permutations to generate
 * @param sortByAesthetic - Whether to sort by aesthetic score (memory intensive)
 * @returns Array of permutations (or generator if streaming mode)
 */
export function generatePermutationsOfLengthOptimized(
  chars: string[],
  length: number,
  maxResults: number = 10000,
  sortByAesthetic: boolean = true
): string[] {
  if (length === 0) return [''];
  if (length > chars.length) return [];
  if (length === 1) return chars.slice(0, Math.min(maxResults, chars.length));

  const iterator = new PermutationIterator(chars.join(''), length, maxResults);
  const result: string[] = [];

  for (const permutation of iterator.generate()) {
    result.push(permutation);
  }

  // Sort by aesthetic score only if requested and the result set is manageable
  if (sortByAesthetic && result.length <= 5000) {
    // Threshold for sorting
    return result.sort((a, b) => calculateAestheticScore(b) - calculateAestheticScore(a));
  }

  return result;
}

/**
 * Memoized aesthetic scoring cache for performance optimization
 */
class AestheticScoreCache {
  private cache: Map<string, number> = new Map();
  private maxCacheSize: number = 10000;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(maxCacheSize: number = 10000) {
    this.maxCacheSize = maxCacheSize;
  }

  get(name: string): number | undefined {
    const cached = this.cache.get(name);
    if (cached !== undefined) {
      this.hitCount++;
      return cached;
    }
    this.missCount++;
    return undefined;
  }

  set(name: string, score: number): void {
    // Simple LRU eviction when cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(name, score);
  }

  getStats(): { hitCount: number; missCount: number; hitRate: number; size: number } {
    const total = this.hitCount + this.missCount;
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      size: this.cache.size,
    };
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// Global aesthetic score cache instance
const globalAestheticCache = new AestheticScoreCache(10000);

/**
 * Calculate aesthetic score for a name with memoization (0-1, higher is better)
 * Enhanced version with caching for better performance
 *
 * @param name - Name to score
 * @param useCache - Whether to use memoization (default: true)
 * @returns Aesthetic score between 0 and 1
 */
export function calculateAestheticScore(name: string, useCache: boolean = true): number {
  if (!name || name.length === 0) return 0;

  // Check cache first if enabled
  if (useCache) {
    const cached = globalAestheticCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
  }

  let score = 0.3; // Lower base score to allow for differentiation
  const lower = name.toLowerCase();

  // Prefer shorter names (more moderate preference)
  score += Math.max(0, (6 - name.length) * 0.05); // Reduced from 0.1

  // Vowel-consonant alternation bonus (more pronounceable)
  const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
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
  const awkwardCombos = ['xz', 'qw', 'zx', 'bk', 'gk', 'pk', 'tk'];
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
  if (name[0] >= 'a' && name[0] <= 'z') {
    score += 0.01; // Reduced from 0.02
  }

  const finalScore = Math.max(0, Math.min(1, score));

  // Cache the result if caching is enabled
  if (useCache) {
    globalAestheticCache.set(name, finalScore);
  }

  return finalScore;
}

/**
 * Batch calculate aesthetic scores for multiple names efficiently
 * Optimized for bulk operations with better cache utilization
 *
 * @param names - Array of names to score
 * @param useCache - Whether to use memoization (default: true)
 * @returns Array of aesthetic scores corresponding to input names
 */
export function calculateAestheticScoresBatch(names: string[], useCache: boolean = true): number[] {
  const scores: number[] = [];

  for (const name of names) {
    scores.push(calculateAestheticScore(name, useCache));
  }

  return scores;
}

/**
 * Get aesthetic scoring cache statistics for performance monitoring
 *
 * @returns Cache statistics including hit rate and size
 */
export function getAestheticCacheStats(): {
  hitCount: number;
  missCount: number;
  hitRate: number;
  size: number;
} {
  return globalAestheticCache.getStats();
}

/**
 * Clear the aesthetic scoring cache (useful for testing or memory management)
 */
export function clearAestheticCache(): void {
  globalAestheticCache.clear();
}

/**
 * Generate all permutations of specified length without character repetition
 * Internal function that uses the optimized version
 *
 * @param chars - Array of available characters
 * @param length - Target length for permutations
 * @returns Array of permutations of specified length
 */
function generatePermutationsOfLength(chars: string[], length: number): string[] {
  return generatePermutationsOfLengthOptimized(chars, length, 10000, true);
}

/**
 * Enhanced pretty name cache with performance optimizations
 */
export interface EnhancedPrettyNameCache extends PrettyNameCache {
  // Performance enhancements
  precomputedLengths: Set<number>; // Lengths that have been pre-computed
  hitCount: number; // Cache hit counter for analytics
  missCount: number; // Cache miss counter for analytics
  lastAccessTime: Map<number, number>; // LRU tracking
  maxCacheSize: number; // Memory limit for permutations

  // Streaming support
  iterators: Map<number, PermutationIterator>; // Active iterators per length
  streamingMode: boolean; // Whether to use streaming for large sets
}

/**
 * Create an enhanced pretty name cache with performance optimizations
 *
 * @param alphabet - Available characters
 * @param maxLength - Maximum length for generated names
 * @param precomputeLengths - Lengths to pre-compute (defaults to 1-6 for common use)
 * @param maxCacheSize - Maximum number of permutations to cache in memory
 * @returns Enhanced pretty name cache with performance features
 */
export function createEnhancedPrettyNameCache(
  alphabet: string,
  maxLength: number,
  precomputeLengths: number[] = [1, 2, 3, 4, 5, 6],
  maxCacheSize: number = 50000
): EnhancedPrettyNameCache {
  // Create base cache manually since createPrettyNameCache might not exist yet
  const baseCache: PrettyNameCache = {
    permutations: new Map(),
    usedPermutations: new Set(),
    currentIndex: new Map(),
    totalGenerated: 0,
    totalExhausted: 0,
  };

  // Initialize indices for each length
  for (let length = 1; length <= maxLength; length++) {
    baseCache.currentIndex.set(length, 0);
  }

  const enhancedCache: EnhancedPrettyNameCache = {
    ...baseCache,
    precomputedLengths: new Set(),
    hitCount: 0,
    missCount: 0,
    lastAccessTime: new Map(),
    maxCacheSize,
    iterators: new Map(),
    streamingMode: false,
  };

  // Pre-compute common lengths for instant access
  const chars = [...new Set(alphabet)];
  for (const length of precomputeLengths) {
    if (length <= maxLength && length <= chars.length) {
      const permutations = generatePermutationsOfLengthOptimized(chars, length, 5000, true);

      // Only cache if the set is manageable
      if (permutations.length <= maxCacheSize / precomputeLengths.length) {
        enhancedCache.permutations.set(length, permutations);
        enhancedCache.precomputedLengths.add(length);
        enhancedCache.lastAccessTime.set(length, Date.now());
      }
    }
  }

  return enhancedCache;
}

/**
 * Get next permutation from enhanced cache with performance tracking
 *
 * @param cache - Enhanced pretty name cache
 * @param length - Desired length
 * @param alphabet - Available alphabet
 * @returns Next permutation or null if exhausted
 */
export function getNextPermutationOptimized(
  cache: EnhancedPrettyNameCache,
  length: number,
  alphabet: string
): string | null {
  // Update access time for LRU
  cache.lastAccessTime.set(length, Date.now());

  // Check if we have pre-computed permutations
  if (cache.precomputedLengths.has(length) && cache.permutations.has(length)) {
    cache.hitCount++;
    const permutations = cache.permutations.get(length)!;
    let currentIndex = cache.currentIndex.get(length) || 0;

    // Find next unused permutation in pre-computed set
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

    // Pre-computed set exhausted, fall back to streaming
    cache.streamingMode = true;
  }

  // Use streaming mode for large sets or when pre-computed sets are exhausted
  if (cache.streamingMode || !cache.precomputedLengths.has(length)) {
    cache.missCount++;

    // Get or create iterator for this length
    if (!cache.iterators.has(length)) {
      const iterator = new PermutationIterator(alphabet, length, 10000);
      cache.iterators.set(length, iterator);
    }

    const iterator = cache.iterators.get(length)!;

    // Generate next permutation that hasn't been used
    for (const candidate of iterator.generate()) {
      if (!cache.usedPermutations.has(candidate)) {
        cache.usedPermutations.add(candidate);
        cache.totalGenerated++;
        cache.lastGenerated = candidate;
        return candidate;
      }
    }
  }

  // This length is exhausted
  cache.totalExhausted++;
  return null;
}

/**
 * Generate a pretty name for a given index with exhaustion handling
 * This is a simplified version for testing purposes
 *
 * @param index - Sequential index for consistent generation
 * @param options - Name generation options
 * @returns Pretty name generation result
 */
export function generatePrettyName(
  index: number,
  options: NameGenerationOptions
): PrettyNameResult {
  // For now, this is a simple implementation for testing
  // The full implementation would be more complex and integrated with existing systems
  const validatedOptions = validateNameGenerationOptions(options);
  const { alphabet, minimumLength, prefix, suffix } = validatedOptions;

  // Simple fallback to sequential generation for high minimum lengths
  const minLength = minimumLength || 1;
  if (minLength >= 10) {
    const sequentialName = generateSequentialName(index, options);
    return {
      name: sequentialName,
      length: sequentialName.length,
      aestheticScore: calculateAestheticScore(sequentialName),
      isExhausted: false,
      fallbackUsed: true,
      generationStrategy: 'fallback-sequential',
    };
  }

  // For shorter lengths, try to generate a more aesthetic name
  const chars = [...new Set(alphabet)];
  const targetLength = Math.max(minLength, 2);

  if (targetLength <= chars.length) {
    const permutations = generatePermutationsOfLengthOptimized(chars, targetLength, 100, true);
    if (permutations.length > 0) {
      const selectedPerm = permutations[index % permutations.length];
      const fullName = `${prefix}${selectedPerm}${suffix}`;

      return {
        name: fullName,
        length: fullName.length,
        aestheticScore: calculateAestheticScore(selectedPerm),
        isExhausted: false,
        fallbackUsed: false,
        generationStrategy: 'permutation',
      };
    }
  }

  // Fallback to sequential if permutation fails
  const sequentialName = generateSequentialName(index, options);
  return {
    name: sequentialName,
    length: sequentialName.length,
    aestheticScore: calculateAestheticScore(sequentialName),
    isExhausted: false,
    fallbackUsed: true,
    generationStrategy: 'fallback-sequential',
  };
}
