import {
  // Constants and configurations
  ALPHABET_CONFIGS,
  CacheError,
  // Aesthetic scoring
  calculateAestheticScore,
  calculateAestheticScoresBatch,
  calculateOptimalLength,
  clearAestheticCache,
  CollisionError,
  // Pretty name generation
  createEnhancedPrettyNameCache,
  CSS_IDENTIFIER_PATTERNS,
  CSS_RESERVED_KEYWORDS,
  fromBase26,
  generatePermutationsWithoutRepetition,
  generatePrettyName,
  // Sequential generation
  generateSequentialName,
  generateSequentialNames,
  getAestheticCacheStats,
  getNextPermutationOptimized,
  InvalidNameError,
  isReservedName,
  // CSS validation
  isValidCssIdentifier,
  // Error classes
  NameGenerationError,
  // Base conversion utilities
  toBase26,
  toBase36,
  toCustomBase,
  validateBaseConversions,
  // Configuration and validation
  validateNameGenerationOptions,
  // Types
  type NameGenerationOptions,
} from '@tw-enigma/core';
import { beforeEach, describe, expect, test } from 'vitest';

// Test environment setup and cleanup
beforeEach(() => {
  console.log('🧹 Cleaning up test environment...');
  // Clear any caches
  clearAestheticCache();
  console.log('✨ Test environment ready');
});

describe('Name Generation Core Functions', () => {
  test('ALPHABET_CONFIGS contains expected configurations', () => {
    expect(ALPHABET_CONFIGS.minimal).toBeTruthy();
    expect(ALPHABET_CONFIGS.standard).toBeTruthy();
    expect(ALPHABET_CONFIGS.full).toBeTruthy();
  });

  test('toBase26 generates correct sequence', () => {
    expect(toBase26(0)).toBe('a');
    expect(toBase26(25)).toBe('z');
    expect(toBase26(26)).toBe('aa');
  });

  test('fromBase26 correctly reverses toBase26', () => {
    expect(fromBase26('a')).toBe(0);
    expect(fromBase26('z')).toBe(25);
    expect(fromBase26('aa')).toBe(26);
  });

  test('generateSequentialName creates valid CSS identifiers', () => {
    const options: NameGenerationOptions = {
      strategy: 'sequential',
      alphabet: ALPHABET_CONFIGS.minimal,
      minimumLength: 1,
    };

    const name = generateSequentialName(0, options);
    expect(isValidCssIdentifier(name)).toBe(true);
  });

  test('isValidCssIdentifier validates CSS identifiers', () => {
    expect(isValidCssIdentifier('validName')).toBe(true);
    expect(isValidCssIdentifier('valid-name')).toBe(true);
    expect(isValidCssIdentifier('123invalid')).toBe(false);
  });

  test('calculateAestheticScore returns valid scores', () => {
    const score = calculateAestheticScore('hello');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('Name Generation Module', () => {
  describe('Constants and Configurations', () => {
    test('CSS_RESERVED_KEYWORDS contains expected keywords', () => {
      expect(CSS_RESERVED_KEYWORDS.has('auto')).toBe(true);
      expect(CSS_RESERVED_KEYWORDS.has('inherit')).toBe(true);
      expect(CSS_RESERVED_KEYWORDS.has('none')).toBe(true);
    });

    test('CSS_IDENTIFIER_PATTERNS contains validation patterns', () => {
      expect(CSS_IDENTIFIER_PATTERNS).toBeDefined();
      expect(typeof CSS_IDENTIFIER_PATTERNS).toBe('object');
    });
  });

  describe('Base Conversion Utilities', () => {
    test('toBase36 generates CSS-safe names', () => {
      const name = toBase36(0);
      expect(isValidCssIdentifier(name)).toBe(true);
    });

    test('toCustomBase handles different alphabets', () => {
      const alphabet = 'abc';
      const result = toCustomBase(5, alphabet);
      expect(result).toMatch(/^[abc]+$/);
    });

    test('calculateOptimalLength provides accurate capacity calculations', () => {
      const result = calculateOptimalLength(100, 'abc');
      expect(result.minLength).toBeGreaterThan(0);
      expect(result.capacity).toBeGreaterThanOrEqual(100);
    });

    test('validateBaseConversions catches conversion errors', () => {
      const results = validateBaseConversions(5);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(5);
    });

    test('base conversion error handling', () => {
      expect(() => toBase26(-1)).toThrow(NameGenerationError);
      expect(() => fromBase26('')).toThrow(NameGenerationError);
    });
  });

  describe('Sequential Name Generation', () => {
    test('generateSequentialNames creates multiple names efficiently', () => {
      const options: NameGenerationOptions = {
        strategy: 'sequential',
        alphabet: ALPHABET_CONFIGS.minimal,
        minimumLength: 1,
      };

      const names = generateSequentialNames(5, options);
      expect(names).toHaveLength(5);
      names.forEach((name) => {
        expect(isValidCssIdentifier(name)).toBe(true);
      });
    });

    test('sequential names avoid reserved words', () => {
      const options: NameGenerationOptions = {
        strategy: 'sequential',
        alphabet: ALPHABET_CONFIGS.minimal,
        minimumLength: 1,
      };

      const name = generateSequentialName(0, options);
      expect(isValidCssIdentifier(name)).toBe(true);
      expect(isReservedName(name)).toBe(false);
    });
  });

  describe('CSS Validation', () => {
    test('isReservedName checks reserved keywords', () => {
      expect(isReservedName('auto')).toBe(true);
      expect(isReservedName('inherit')).toBe(true);
      expect(isReservedName('customName')).toBe(false);
    });
  });

  describe('Pretty Name Generation', () => {
    test('createEnhancedPrettyNameCache creates valid cache', () => {
      const cache = createEnhancedPrettyNameCache('abc', 3, [1, 2]);
      expect(cache).toBeDefined();
      expect(cache.maxCacheSize).toBeGreaterThan(0);
    });

    test('getNextPermutationOptimized returns valid permutations', () => {
      const cache = createEnhancedPrettyNameCache('abc', 2, [1, 2]);
      const permutation = getNextPermutationOptimized(cache, 2, 'abc');
      expect(permutation).toBeDefined();
      if (permutation) {
        expect(permutation.length).toBe(2);
      }
    });

    test('generatePrettyName with valid options', () => {
      const options: NameGenerationOptions = {
        strategy: 'pretty',
        alphabet: ALPHABET_CONFIGS.standard, // Use standard alphabet (longer than minimal requirement)
        minimumLength: 2,
      };

      const result = generatePrettyName(0, options);
      expect(result.name).toBeDefined();
      expect(result.name.length).toBeGreaterThanOrEqual(2);
      expect(isValidCssIdentifier(result.name)).toBe(true);
    });
  });

  describe('Aesthetic Scoring', () => {
    test('calculateAestheticScoresBatch processes multiple names', () => {
      const names = ['a', 'hello', 'world'];
      const scores = calculateAestheticScoresBatch(names);
      expect(scores).toHaveLength(3);
      scores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    test('aesthetic cache functions work', () => {
      clearAestheticCache();
      const stats1 = getAestheticCacheStats();

      calculateAestheticScore('test');
      const stats2 = getAestheticCacheStats();

      expect(stats2.size).toBeGreaterThan(stats1.size);
    });
  });

  describe('Permutation Generation', () => {
    test('generatePermutationsWithoutRepetition creates valid permutations', () => {
      const permutations = generatePermutationsWithoutRepetition('abc', 2);
      expect(Array.isArray(permutations)).toBe(true);
      expect(permutations.length).toBeGreaterThan(0);

      permutations.forEach((perm) => {
        expect(perm.length).toBeLessThanOrEqual(2);
        expect(/^[abc]+$/.test(perm)).toBe(true);
      });
    });

    test('generatePermutationsWithoutRepetition handles edge cases', () => {
      // Empty alphabet
      const emptyResult = generatePermutationsWithoutRepetition('', 2);
      expect(emptyResult).toEqual([]);

      // Zero length
      const zeroLengthResult = generatePermutationsWithoutRepetition('abc', 0);
      expect(zeroLengthResult).toEqual(['']);
    });
  });

  describe('Configuration and Validation', () => {
    test('validateNameGenerationOptions accepts valid options', () => {
      const options = {
        strategy: 'sequential' as const,
        alphabet: ALPHABET_CONFIGS.minimal,
        minimumLength: 1,
      };

      const result = validateNameGenerationOptions(options);
      expect(result.strategy).toBe('sequential');
      expect(result.minimumLength).toBe(1);
    });

    test('validateNameGenerationOptions handles default values', () => {
      const options = {
        strategy: 'sequential' as const,
      };

      const result = validateNameGenerationOptions(options);
      expect(result.strategy).toBe('sequential');
      expect(result.minimumLength).toBe(1); // Default value
    });

    test('validateNameGenerationOptions validates input types', () => {
      expect(() => validateNameGenerationOptions(null)).toThrow(NameGenerationError);
      expect(() => validateNameGenerationOptions({ minimumLength: 'invalid' })).toThrow(
        NameGenerationError
      );
      expect(() => validateNameGenerationOptions({ minimumLength: 0 })).toThrow(
        NameGenerationError
      );
      expect(() => validateNameGenerationOptions({ minimumLength: 27 })).toThrow(
        NameGenerationError
      );
    });

    test('minimumLength validation accepts valid values', () => {
      const validOptions = {
        strategy: 'sequential' as const,
        minimumLength: 3,
      };

      const result = validateNameGenerationOptions(validOptions);
      expect(result.minimumLength).toBe(3);
    });

    test('minimumLength validation rejects invalid values', () => {
      expect(() => validateNameGenerationOptions({ minimumLength: 0 })).toThrow();
      expect(() => validateNameGenerationOptions({ minimumLength: 27 })).toThrow();
      expect(() => validateNameGenerationOptions({ minimumLength: -1 })).toThrow();
    });

    test('uses default minimumLength when not specified', () => {
      const options = { strategy: 'sequential' as const };
      const result = validateNameGenerationOptions(options);
      expect(result.minimumLength).toBe(1);
    });

    test('minimumLength field is included in validated result', () => {
      const options = { strategy: 'sequential' as const, minimumLength: 5 };
      const result = validateNameGenerationOptions(options);
      expect(result).toHaveProperty('minimumLength', 5);
    });

    test('isValidCssIdentifier correctly validates CSS names', () => {
      expect(isValidCssIdentifier('a')).toBe(true);
      expect(isValidCssIdentifier('abc')).toBe(true);
      expect(isValidCssIdentifier('a-b')).toBe(true);
      expect(isValidCssIdentifier('_abc')).toBe(true);
      expect(isValidCssIdentifier('123')).toBe(false);
      expect(isValidCssIdentifier('')).toBe(false);
    });

    test('isReservedName detects CSS keywords and custom reserved names', () => {
      expect(isReservedName('auto')).toBe(true);
      expect(isReservedName('inherit')).toBe(true);
      expect(isReservedName('none')).toBe(true);
      expect(isReservedName('normalName')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('NameGenerationError includes cause information', () => {
      const cause = new Error('Root cause');
      const error = new NameGenerationError('Test error', { cause });
      expect(error.message).toBe('Test error');
      expect(error.cause).toBe(cause);
    });

    test('CollisionError includes conflict details', () => {
      const error = new CollisionError('Collision detected', 'existing', 'attempted');
      expect(error.conflictingName).toBe('existing');
      expect(error.attemptedName).toBe('attempted');
    });

    test('InvalidNameError includes validation details', () => {
      const error = new InvalidNameError('Invalid name', 'test', 'css-invalid');
      expect(error.invalidName).toBe('test');
      expect(error.reason).toBe('css-invalid');
    });

    test('CacheError includes operation details', () => {
      const error = new CacheError('Cache failed', 'read');
      expect(error.operation).toBe('read');
    });
  });

  describe('Base Conversion Functions with minimumLength', () => {
    test('toBase26 respects minimumLength parameter', () => {
      const result = toBase26(0, 3);
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result).toBe('aaa');
    });

    test('toBase36 respects minimumLength parameter', () => {
      const result = toBase36(0, 2);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(isValidCssIdentifier(result)).toBe(true);
    });

    test('toCustomBase respects minimumLength parameter', () => {
      const result = toCustomBase(0, 'abc', 3);
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result).toBe('aaa');
    });

    test('base conversion functions integrate with generateSequentialName', () => {
      const options: NameGenerationOptions = {
        strategy: 'sequential',
        alphabet: ALPHABET_CONFIGS.minimal,
        minimumLength: 3,
      };

      const name = generateSequentialName(0, options);
      expect(name.length).toBeGreaterThanOrEqual(3);
      expect(isValidCssIdentifier(name)).toBe(true);
    });
  });
});
