/**
 * Tests for Length Enforcement functionality
 */

import { describe, expect, test } from 'vitest';
import {
  calculatePaddingNeeded,
  enforceMinimumLength,
  isValidMinimumLength,
  LengthEnforcementError,
} from '../src/processors/lengthEnforcement';
import { isValidCssIdentifier } from '../src/processors/nameGeneration';

describe('enforceMinimumLength', () => {
  test('returns original name when it already meets minimum length', () => {
    expect(enforceMinimumLength('abc', 3)).toBe('abc');
    expect(enforceMinimumLength('hello', 4)).toBe('hello');
    expect(enforceMinimumLength('test', 2)).toBe('test');
  });

  test('pads short names to minimum length', () => {
    const result1 = enforceMinimumLength('a', 3);
    const result2 = enforceMinimumLength('ab', 5);

    expect(result1).toHaveLength(3);
    expect(result2).toHaveLength(5);
    expect(result1.startsWith('a')).toBe(true);
    expect(result2.startsWith('ab')).toBe(true);
  });

  test('generates different random padding on multiple calls', () => {
    const results = new Set();
    for (let i = 0; i < 10; i++) {
      results.add(enforceMinimumLength('x', 5));
    }
    // Should have multiple different results due to random padding
    expect(results.size).toBeGreaterThan(1);
  });

  test('ensures padded names are valid CSS identifiers by default', () => {
    for (let i = 0; i < 20; i++) {
      const result = enforceMinimumLength('test', 10);
      expect(isValidCssIdentifier(result)).toBe(true);
    }
  });

  test('respects custom alphabet option', () => {
    const customAlphabet = 'xyz';
    const result = enforceMinimumLength('a', 5, { alphabet: customAlphabet });

    expect(result).toHaveLength(5);
    expect(result.startsWith('a')).toBe(true);

    // All padding characters should be from custom alphabet
    const padding = result.slice(1);
    for (const char of padding) {
      expect(customAlphabet.includes(char)).toBe(true);
    }
  });

  test('handles ensureCssValid option disabled', () => {
    // Using an alphabet that might generate invalid CSS identifiers
    const result = enforceMinimumLength('test', 8, {
      ensureCssValid: false,
      alphabet: '123456789',
    });

    expect(result).toHaveLength(8);
    expect(result.startsWith('test')).toBe(true);
  });

  test('handles maxAttempts option', () => {
    // This should fail quickly with limited attempts and restrictive conditions
    expect(() => {
      enforceMinimumLength('test', 10, {
        maxAttempts: 1,
        alphabet: '!@#$%', // Invalid CSS characters
        ensureCssValid: true,
      });
    }).toThrow(LengthEnforcementError);
  });

  test('handles edge case minimum lengths', () => {
    const result1 = enforceMinimumLength('', 1);
    const result26 = enforceMinimumLength('a', 26);

    expect(result1).toHaveLength(1);
    expect(result26).toHaveLength(26);
    expect(isValidCssIdentifier(result1)).toBe(true);
    expect(isValidCssIdentifier(result26)).toBe(true);
  });
});

describe('enforceMinimumLength input validation', () => {
  test('throws error for non-string name', () => {
    expect(() => enforceMinimumLength(123 as any, 3)).toThrow(LengthEnforcementError);
    expect(() => enforceMinimumLength(null as any, 3)).toThrow(LengthEnforcementError);
    expect(() => enforceMinimumLength(undefined as any, 3)).toThrow(LengthEnforcementError);
  });

  test('throws error for invalid minimum length', () => {
    expect(() => enforceMinimumLength('test', 0)).toThrow(LengthEnforcementError);
    expect(() => enforceMinimumLength('test', 27)).toThrow(LengthEnforcementError);
    expect(() => enforceMinimumLength('test', -1)).toThrow(LengthEnforcementError);
    expect(() => enforceMinimumLength('test', 1.5)).toThrow(LengthEnforcementError);
    expect(() => enforceMinimumLength('test', NaN)).toThrow(LengthEnforcementError);
  });

  test('throws error for empty alphabet', () => {
    expect(() => enforceMinimumLength('test', 5, { alphabet: '' })).toThrow(LengthEnforcementError);
    // Note: undefined alphabet should use default, so it's valid
  });
});

describe('LengthEnforcementError', () => {
  test('contains proper error information', () => {
    const error = new LengthEnforcementError('Test message', 'testName', 5, 3);

    expect(error.name).toBe('LengthEnforcementError');
    expect(error.message).toBe('Test message');
    expect(error.originalName).toBe('testName');
    expect(error.minimumLength).toBe(5);
    expect(error.attempts).toBe(3);
    expect(error instanceof Error).toBe(true);
  });
});

describe('isValidMinimumLength', () => {
  test('validates correct minimum length values', () => {
    expect(isValidMinimumLength(1)).toBe(true);
    expect(isValidMinimumLength(5)).toBe(true);
    expect(isValidMinimumLength(26)).toBe(true);
  });

  test('rejects invalid minimum length values', () => {
    expect(isValidMinimumLength(0)).toBe(false);
    expect(isValidMinimumLength(27)).toBe(false);
    expect(isValidMinimumLength(-1)).toBe(false);
    expect(isValidMinimumLength(1.5)).toBe(false);
    expect(isValidMinimumLength('5')).toBe(false);
    expect(isValidMinimumLength(null)).toBe(false);
    expect(isValidMinimumLength(undefined)).toBe(false);
    expect(isValidMinimumLength(NaN)).toBe(false);
  });
});

describe('calculatePaddingNeeded', () => {
  test('calculates correct padding amounts', () => {
    expect(calculatePaddingNeeded(2, 5)).toBe(3);
    expect(calculatePaddingNeeded(0, 3)).toBe(3);
    expect(calculatePaddingNeeded(10, 5)).toBe(0); // Already sufficient
    expect(calculatePaddingNeeded(5, 5)).toBe(0); // Exactly minimum
  });

  test('handles edge cases', () => {
    expect(calculatePaddingNeeded(0, 1)).toBe(1);
    expect(calculatePaddingNeeded(1, 26)).toBe(25);
    expect(calculatePaddingNeeded(26, 1)).toBe(0);
  });
});

describe('cryptographic security tests', () => {
  test('padding is sufficiently random', () => {
    const results = new Map<string, number>();
    const sampleSize = 1000;

    // Generate many samples and count occurrences
    for (let i = 0; i < sampleSize; i++) {
      const result = enforceMinimumLength('x', 3);
      const padding = result.slice(1); // Remove original 'x'
      results.set(padding, (results.get(padding) || 0) + 1);
    }

    // Should have high diversity (low collision rate)
    const uniqueResults = results.size;
    const collisionRate = 1 - uniqueResults / sampleSize;

    // For 2-character strings from 52-character alphabet, collision rate should be reasonable
    // Theoretical maximum unique combinations: 52^2 = 2704
    // With 1000 samples, some collisions are expected due to birthday paradox
    expect(collisionRate).toBeLessThan(0.25); // Less than 25% collision rate
    expect(uniqueResults).toBeGreaterThan(sampleSize * 0.75); // At least 75% unique
  });

  test('character distribution is roughly uniform', () => {
    const charCount = new Map<string, number>();
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const sampleSize = 2600; // 100 samples per character

    // Generate samples and count character occurrences
    for (let i = 0; i < sampleSize; i++) {
      const result = enforceMinimumLength('', 1, { alphabet });
      const char = result[0];
      charCount.set(char, (charCount.get(char) || 0) + 1);
    }

    // Check that distribution is roughly uniform
    const expectedCount = sampleSize / alphabet.length;
    const tolerance = expectedCount * 0.3; // 30% tolerance

    for (const char of alphabet) {
      const count = charCount.get(char) || 0;
      expect(count).toBeGreaterThan(expectedCount - tolerance);
      expect(count).toBeLessThan(expectedCount + tolerance);
    }
  });
});

describe('integration with CSS validation', () => {
  test('works with existing isValidCssIdentifier function', () => {
    // Test various scenarios to ensure compatibility
    const testCases = [
      { name: 'a', length: 5 },
      { name: 'test', length: 10 },
      { name: 'x', length: 3 },
      { name: '_valid', length: 8 },
    ];

    for (const testCase of testCases) {
      const result = enforceMinimumLength(testCase.name, testCase.length);
      expect(isValidCssIdentifier(result)).toBe(true);
      expect(result).toHaveLength(testCase.length);
      expect(result.startsWith(testCase.name)).toBe(true);
    }
  });

  test('handles edge cases with CSS validation', () => {
    // Test with names that are already CSS-valid
    const validNames = ['validName', 'valid-name', 'valid_name', 'ValidName123'];

    for (const name of validNames) {
      const result = enforceMinimumLength(name, name.length + 3);
      expect(isValidCssIdentifier(result)).toBe(true);
      expect(result.startsWith(name)).toBe(true);
    }
  });
});

describe('performance tests', () => {
  test('completes within reasonable time for normal usage', () => {
    const startTime = Date.now();

    // Generate 100 padded names
    for (let i = 0; i < 100; i++) {
      enforceMinimumLength(`name${i}`, 10);
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  test('handles maximum length efficiently', () => {
    const startTime = Date.now();

    const result = enforceMinimumLength('a', 26);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(100); // Should be very fast
    expect(result).toHaveLength(26);
    expect(isValidCssIdentifier(result)).toBe(true);
  });
});
