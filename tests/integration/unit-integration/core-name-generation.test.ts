/**
 * Core Name Generation Integration Test
 *
 * Tests the internal integration points for name generation within the Core package:
 * - Name generation strategy implementation
 * - Length enforcement and validation
 * - Alphabet-based generation
 * - Sequential and random strategies
 * - Name collision handling
 * - Performance and determinism
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { IntegrationAssertions, IntegrationTestData } from '../utils/integration-assertions';

describe('Core Name Generation Integration', () => {
  beforeEach(() => {
    // Reset any global state if needed
  });

  describe('Sequential Strategy Integration', () => {
    it('should generate sequential names with correct length', async () => {
      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 5,
        strategy: 'sequential',
      });

      IntegrationAssertions.assertConfigurationValid(config);

      const names = IntegrationTestData.generateSequentialNames(5, 3);

      for (const name of names) {
        expect(name.length).toBeGreaterThanOrEqual(5);
        expect(name).toMatch(/^[a-z][a-z0-9]*$/);
      }

      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should maintain sequential order across generations', async () => {
      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 4,
        strategy: 'sequential',
      });

      // Generate two batches of names
      const batch1 = IntegrationTestData.generateSequentialNames(4, 3);
      const batch2 = IntegrationTestData.generateSequentialNames(4, 3);

      // All names should be unique across batches
      const allNames = [...batch1, ...batch2];
      const uniqueNames = new Set(allNames);
      expect(uniqueNames.size).toBe(allNames.length);

      // Verify no duplicates
      expect(batch1).not.toEqual(batch2);
    });

    it('should handle edge cases in sequential generation', async () => {
      // Test minimum length (1)
      const minNames = IntegrationTestData.generateSequentialNames(1, 10);
      minNames.forEach((name) => {
        expect(name.length).toBeGreaterThanOrEqual(1);
        expect(name).toMatch(/^[a-z][a-z0-9]*$/);
      });

      // Test longer lengths
      const longNames = IntegrationTestData.generateSequentialNames(15, 5);
      longNames.forEach((name) => {
        expect(name.length).toBeGreaterThanOrEqual(15);
        expect(name).toMatch(/^[a-z][a-z0-9]*$/);
      });
    });
  });

  describe('Random Strategy Integration', () => {
    it('should generate random names with correct length', async () => {
      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 4,
        strategy: 'random',
      });

      IntegrationAssertions.assertConfigurationValid(config);

      const names = IntegrationTestData.generateRandomNames(4, 5);

      for (const name of names) {
        expect(name.length).toBeGreaterThanOrEqual(4);
        expect(name).toMatch(/^[a-z][a-z0-9]*$/);
      }
    });

    it('should produce sufficient randomness', async () => {
      const names = IntegrationTestData.generateRandomNames(6, 50);

      // Test character distribution
      const charCounts = new Map<string, number>();
      names.forEach((name) => {
        for (const char of name) {
          charCounts.set(char, (charCounts.get(char) || 0) + 1);
        }
      });

      // Should use multiple different characters
      expect(charCounts.size).toBeGreaterThan(10);

      // Test pattern variation
      const firstChars = names.map((name) => name[0]);
      const uniqueFirstChars = new Set(firstChars);
      expect(uniqueFirstChars.size).toBeGreaterThan(1); // Should vary first characters
    });

    it('should handle deterministic seeding if supported', async () => {
      // Test deterministic generation for testing purposes
      const seed = 'test-seed-123';
      const names1 = IntegrationTestData.generateRandomNamesWithSeed(5, 5, seed);
      const names2 = IntegrationTestData.generateRandomNamesWithSeed(5, 5, seed);

      // With same seed, should produce same results
      expect(names1).toEqual(names2);

      // With different seed, should produce different results
      const names3 = IntegrationTestData.generateRandomNamesWithSeed(5, 5, 'different-seed');
      expect(names1).not.toEqual(names3);
    });
  });

  describe('Alphabet Strategy Integration', () => {
    it('should generate names using custom alphabet', async () => {
      const customAlphabet = 'abc123';
      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 3,
        strategy: 'alphabet',
        alphabet: customAlphabet,
      });

      IntegrationAssertions.assertConfigurationValid(config);

      const names = IntegrationTestData.generateAlphabetNames(3, customAlphabet, 5);

      for (const name of names) {
        expect(name.length).toBeGreaterThanOrEqual(3);

        for (const char of name) {
          expect(customAlphabet).toContain(char);
        }
      }
    });

    it('should handle different alphabet compositions', async () => {
      const alphabets = [
        'abcdef0123456789', // Hex-like
        'xyz', // Minimal
        'abcdefghijklmnopqrstuvwxyz0123456789', // Full alphanumeric
        'qwertyuiop', // Keyboard layout
      ];

      for (const alphabet of alphabets) {
        const names = IntegrationTestData.generateAlphabetNames(3, alphabet, 5);

        for (const name of names) {
          expect(name.length).toBeGreaterThanOrEqual(3);

          // Verify alphabet constraint
          for (const char of name) {
            expect(alphabet).toContain(char);
          }
        }
      }
    });

    it('should handle alphabet edge cases', async () => {
      // Single character alphabet
      const singleChar = 'a';
      const singleNames = IntegrationTestData.generateAlphabetNames(3, singleChar, 3);
      singleNames.forEach((name) => {
        expect(name).toBe('aaa');
      });

      // Letter-only alphabet
      const lettersOnly = 'abcdef';
      const letterNames = IntegrationTestData.generateAlphabetNames(4, lettersOnly, 5);
      letterNames.forEach((name) => {
        expect(name).toMatch(/^[abcdef]+$/);
      });
    });
  });

  describe('Length Enforcement Integration', () => {
    it('should enforce minimum length across all strategies', async () => {
      const strategies = ['sequential', 'random', 'alphabet'] as const;
      const testLength = 6;

      for (const strategy of strategies) {
        const config = configFixtures.generateConfigWithNameGeneration({
          minimumLength: testLength,
          strategy,
          alphabet: strategy === 'alphabet' ? 'abcdef0123456789' : undefined,
        });

        IntegrationAssertions.assertConfigurationValid(config);

        let names: string[];
        switch (strategy) {
          case 'sequential':
            names = IntegrationTestData.generateSequentialNames(testLength, 3);
            break;
          case 'random':
            names = IntegrationTestData.generateRandomNames(testLength, 3);
            break;
          case 'alphabet':
            names = IntegrationTestData.generateAlphabetNames(testLength, 'abcdef0123456789', 3);
            break;
        }

        names.forEach((name) => {
          expect(name.length).toBeGreaterThanOrEqual(testLength);
        });
      }
    });

    it('should handle length validation edge cases', async () => {
      // Test boundary values
      const boundaryTests = [
        { length: 1, shouldWork: true },
        { length: 50, shouldWork: true },
        { length: 100, shouldWork: true },
      ];

      for (const test of boundaryTests) {
        if (test.shouldWork) {
          const config = configFixtures.generateConfigWithNameGeneration({
            minimumLength: test.length,
            strategy: 'sequential',
          });

          IntegrationAssertions.assertConfigurationValid(config);

          const names = IntegrationTestData.generateSequentialNames(test.length, 2);
          names.forEach((name) => {
            expect(name.length).toBeGreaterThanOrEqual(test.length);
          });
        }
      }
    });

    it('should maintain length consistency', async () => {
      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 7,
        strategy: 'random',
      });

      // Generate multiple batches
      const batches = Array.from({ length: 3 }, () =>
        IntegrationTestData.generateRandomNames(7, 5)
      );

      // All names in all batches should meet length requirement
      batches.forEach((batch) => {
        batch.forEach((name) => {
          expect(name.length).toBeGreaterThanOrEqual(7);
        });
      });
    });
  });

  describe('CSS Validity Integration', () => {
    it('should generate CSS-valid class names', async () => {
      const names = IntegrationTestData.generateSequentialNames(5, 10);

      names.forEach((name) => {
        expect(name).toMatch(/^[a-zA-Z_][a-zA-Z0-9_-]*$/);
        expect(name).toMatch(/^[a-z]/);
      });
    });

    it('should avoid CSS reserved keywords', async () => {
      const reservedKeywords = ['auto', 'inherit', 'initial', 'unset', 'none'];
      const names = IntegrationTestData.generateSequentialNames(4, 20);

      names.forEach((name) => {
        expect(reservedKeywords).not.toContain(name.toLowerCase());
      });
    });

    it('should handle special character escaping', async () => {
      // Test with alphabets that might contain special characters
      const specialAlphabet = 'abc123-_';

      const names = IntegrationTestData.generateAlphabetNames(5, specialAlphabet, 10);

      names.forEach((name) => {
        // Should still be valid CSS identifiers
        expect(name).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
      });
    });
  });

  describe('Performance Integration', () => {
    it('should generate names efficiently', async () => {
      const startTime = Date.now();
      const names = IntegrationTestData.generateSequentialNames(6, 100);
      const duration = Date.now() - startTime;

      expect(names.length).toBe(100);
      expect(duration).toBeLessThan(1000);

      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should handle collision detection in random generation', async () => {
      // Use a small alphabet to force collisions
      const smallAlphabet = 'ab';
      const shortLength = 2;

      // With alphabet 'ab' and length 2, only 4 possible names: aa, ab, ba, bb
      const names = IntegrationTestData.generateAlphabetNames(shortLength, smallAlphabet, 10);

      // Should handle the limited space gracefully
      expect(names.length).toBeGreaterThan(0);

      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBeLessThanOrEqual(4); // Can't exceed possible combinations

      names.forEach((name) => {
        expect(name.length).toBe(shortLength);
        expect(/^[ab]+$/.test(name)).toBe(true);
      });
    });

    it('should maintain performance with longer names', async () => {
      const startTime = Date.now();

      const longNames = IntegrationTestData.generateRandomNames(25, 100);

      const duration = Date.now() - startTime;

      expect(longNames.length).toBe(100);
      expect(duration).toBeLessThan(2000); // Should still be reasonable

      longNames.forEach((name) => {
        expect(name.length).toBeGreaterThanOrEqual(25);
      });
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configuration changes', async () => {
      const config1 = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 3,
        strategy: 'sequential',
      });

      const config2 = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 8,
        strategy: 'random',
      });

      IntegrationAssertions.assertConfigurationValid(config1);
      IntegrationAssertions.assertConfigurationValid(config2);

      expect(config1.nameGeneration?.minimumLength).toBe(3);
      expect(config1.nameGeneration?.strategy).toBe('sequential');

      expect(config2.nameGeneration?.minimumLength).toBe(8);
      expect(config2.nameGeneration?.strategy).toBe('random');
    });

    it('should handle configuration validation errors', async () => {
      const invalidConfigs = [{ minimumLength: 0 }, { minimumLength: -1 }, { strategy: 'invalid' }];

      for (const invalidConfig of invalidConfigs) {
        expect(() => {
          configFixtures.generateConfigWithNameGeneration(invalidConfig as any);
        }).toThrow();
      }
    });

    it('should integrate with CLI length override', async () => {
      const baseConfig = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 5,
        strategy: 'sequential',
      });

      // Simulate CLI override
      const overrideConfig = configFixtures.mergeConfigurations(baseConfig, {
        nameGeneration: {
          minimumLength: 10,
        },
      });

      expect(overrideConfig.nameGeneration?.minimumLength).toBe(10);
      expect(overrideConfig.nameGeneration?.strategy).toBe('sequential'); // Should preserve

      IntegrationAssertions.assertConfigPriority(
        { stdout: JSON.stringify(overrideConfig) } as any,
        'cli',
        10
      );
    });
  });
});
