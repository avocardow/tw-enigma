/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from 'crypto';
import { isValidCssIdentifier } from './nameGeneration';

/**
 * Configuration options for length enforcement
 */
export interface LengthEnforcementOptions {
  /**
   * Alphabet to use for random padding characters
   * @default 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
   */
  alphabet?: string;

  /**
   * Maximum number of attempts to generate a valid CSS identifier
   * @default 10
   */
  maxAttempts?: number;

  /**
   * Whether to ensure the result is a valid CSS identifier
   * @default true
   */
  ensureCssValid?: boolean;
}

/**
 * Error thrown when length enforcement fails
 */
export class LengthEnforcementError extends Error {
  public originalName: string;
  public minimumLength: number;
  public attempts: number;

  constructor(message: string, originalName: string, minimumLength: number, attempts: number) {
    super(message);
    this.name = 'LengthEnforcementError';
    this.originalName = originalName;
    this.minimumLength = minimumLength;
    this.attempts = attempts;
  }
}

/**
 * Default alphabet for random padding (CSS-safe characters)
 */
const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Enforces minimum length for class names by padding with cryptographically secure random characters
 *
 * @param name - The original class name
 * @param minimumLength - The minimum length to enforce (1-26)
 * @param options - Configuration options
 * @returns The padded name meeting minimum length requirements
 *
 * @throws {LengthEnforcementError} When length enforcement fails after maximum attempts
 *
 * @example
 * ```typescript
 * enforceMinimumLength('a', 3) // Returns 'aXy' (where X,y are random chars)
 * enforceMinimumLength('ab', 5) // Returns 'abXyz' (where X,y,z are random chars)
 * enforceMinimumLength('abc', 2) // Returns 'abc' (already meets minimum)
 * ```
 */
export function enforceMinimumLength(
  name: string,
  minimumLength: number,
  options: LengthEnforcementOptions = {}
): string {
  // Input validation
  if (typeof name !== 'string') {
    throw new LengthEnforcementError('Name must be a string', String(name), minimumLength, 0);
  }

  if (!Number.isInteger(minimumLength) || minimumLength < 1 || minimumLength > 26) {
    throw new LengthEnforcementError(
      'Minimum length must be an integer between 1 and 26',
      name,
      minimumLength,
      0
    );
  }

  // If name already meets minimum length, return as-is
  if (name.length >= minimumLength) {
    return name;
  }

  // Check for explicitly passed empty/undefined alphabet before applying defaults
  if (options.alphabet !== undefined && (!options.alphabet || options.alphabet.length === 0)) {
    throw new LengthEnforcementError('Alphabet cannot be empty', name, minimumLength, 0);
  }

  // Configuration with defaults
  const { alphabet = DEFAULT_ALPHABET, maxAttempts = 10, ensureCssValid = true } = options;

  // Validate alphabet - check both empty string and undefined
  if (!alphabet || alphabet.length === 0) {
    throw new LengthEnforcementError('Alphabet cannot be empty', name, minimumLength, 0);
  }

  let attempts = 0;
  const paddingLength = minimumLength - name.length;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // Generate cryptographically secure random padding
      const padding = generateRandomPadding(paddingLength, alphabet);
      const paddedName = name + padding;

      // Validate CSS identifier if required
      if (ensureCssValid && !isValidCssIdentifier(paddedName)) {
        continue; // Try again with different random padding
      }

      return paddedName;
    } catch {
      // Continue to next attempt if padding generation fails
      continue;
    }
  }

  // If we reach here, all attempts failed
  throw new LengthEnforcementError(
    `Failed to generate valid padded name after ${maxAttempts} attempts`,
    name,
    minimumLength,
    attempts
  );
}

/**
 * Generates cryptographically secure random padding characters
 *
 * @param length - Number of characters to generate
 * @param alphabet - Character set to choose from
 * @returns Random string of specified length
 *
 * @throws {Error} When random generation fails
 */
function generateRandomPadding(length: number, alphabet: string): string {
  if (length <= 0) {
    return '';
  }

  try {
    // Generate cryptographically secure random bytes
    const randomBytesBuffer = randomBytes(length);
    let result = '';

    for (let i = 0; i < length; i++) {
      // Use modulo to map byte value to alphabet index
      const randomIndex = randomBytesBuffer[i] % alphabet.length;
      result += alphabet[randomIndex];
    }

    return result;
  } catch (error) {
    throw new Error(
      `Failed to generate random padding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validates that a minimum length value is acceptable
 *
 * @param minimumLength - The minimum length to validate
 * @returns True if valid, false otherwise
 */
export function isValidMinimumLength(minimumLength: unknown): minimumLength is number {
  return (
    typeof minimumLength === 'number' &&
    Number.isInteger(minimumLength) &&
    minimumLength >= 1 &&
    minimumLength <= 26
  );
}

/**
 * Calculates how many padding characters are needed
 *
 * @param currentLength - Current length of the name
 * @param minimumLength - Required minimum length
 * @returns Number of padding characters needed (0 if already sufficient)
 */
export function calculatePaddingNeeded(currentLength: number, minimumLength: number): number {
  return Math.max(0, minimumLength - currentLength);
}
