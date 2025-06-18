/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { shouldWarn, warnForHighLength, WarningConfig } from './warningSystem';

/**
 * Options for length validation with warnings
 */
export interface LengthValidationOptions {
  /** Whether to display warnings for high values */
  enableWarnings: boolean;
  /** Custom warning configuration */
  warningConfig?: Partial<WarningConfig>;
  /** Whether to suppress warnings (quiet mode) */
  suppressWarnings: boolean;
}

/**
 * Result of length validation
 */
export interface LengthValidationResult {
  /** Whether the length is valid */
  isValid: boolean;
  /** Validated length value */
  length: number;
  /** Whether a warning was generated */
  warningGenerated: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Default options for length validation
 */
const DEFAULT_VALIDATION_OPTIONS: LengthValidationOptions = {
  enableWarnings: true,
  suppressWarnings: false,
};

/**
 * Validate length with integrated warning system
 *
 * @param value - Length value to validate (string or number)
 * @param options - Validation options
 * @returns Validation result with warning information
 */
export function validateLengthWithWarnings(
  value: string | number,
  options: Partial<LengthValidationOptions> = {}
): LengthValidationResult {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

  // Parse the length value
  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  // Basic validation
  if (isNaN(num)) {
    return {
      isValid: false,
      length: 0,
      warningGenerated: false,
      error: `Invalid length value: ${value}. Must be a number.`,
    };
  }

  if (num < 1 || num > 26) {
    return {
      isValid: false,
      length: num,
      warningGenerated: false,
      error: `Invalid length value: ${value}. Must be a number between 1 and 26.`,
    };
  }

  // Generate warning if needed
  let warningGenerated = false;
  if (opts.enableWarnings && !opts.suppressWarnings && shouldWarn(num)) {
    warnForHighLength(num, opts.warningConfig);
    warningGenerated = true;
  }

  return {
    isValid: true,
    length: num,
    warningGenerated,
  };
}

/**
 * Check if a length value should trigger performance warnings
 *
 * @param length - Length value to check
 * @param threshold - Warning threshold (default: 15)
 * @returns Whether a warning should be shown
 */
export function shouldShowPerformanceWarning(length: number, threshold: number = 15): boolean {
  return shouldWarn(length, threshold);
}

/**
 * Validate length for CLI usage with proper error handling
 *
 * @param value - Raw CLI input value
 * @param quietWarnings - Whether to suppress warnings
 * @returns Validated length or throws error
 */
export function validateCliLength(value: string | number, quietWarnings: boolean = false): number {
  const result = validateLengthWithWarnings(value, {
    enableWarnings: true,
    suppressWarnings: quietWarnings,
  });

  if (!result.isValid) {
    throw new Error(result.error);
  }

  return result.length;
}

/**
 * Create warning configuration for specific use cases
 *
 * @param threshold - Custom warning threshold
 * @param showTables - Whether to show capacity tables
 * @param showPerformance - Whether to show performance info
 * @returns Warning configuration
 */
export function createWarningConfig(
  threshold: number = 15,
  showTables: boolean = true,
  showPerformance: boolean = true
): Partial<WarningConfig> {
  return {
    lengthThreshold: threshold,
    showCapacityTable: showTables,
    showPerformanceInfo: showPerformance,
    enabled: true,
  };
}

/**
 * Validate multiple length values with batch warning suppression
 *
 * @param values - Array of length values to validate
 * @param options - Validation options
 * @returns Array of validation results
 */
export function validateMultipleLengths(
  values: (string | number)[],
  options: Partial<LengthValidationOptions> = {}
): LengthValidationResult[] {
  const results: LengthValidationResult[] = [];

  // For batch operations, we might want to show warnings only once per unique high value
  const warningsShown = new Set<number>();

  for (const value of values) {
    const result = validateLengthWithWarnings(value, {
      ...options,
      // Suppress warnings if we've already shown them for this value
      suppressWarnings:
        options.suppressWarnings ||
        (typeof value === 'number' && warningsShown.has(value)) ||
        (typeof value === 'string' &&
          !isNaN(parseInt(value, 10)) &&
          warningsShown.has(parseInt(value, 10))),
    });

    if (result.warningGenerated && result.isValid) {
      warningsShown.add(result.length);
    }

    results.push(result);
  }

  return results;
}
