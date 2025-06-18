/**
 * Core Validation Chain Integration Test
 *
 * Tests the internal integration points for validation within the Core package:
 * - Configuration validation chain
 * - Input validation and sanitization
 * - Error propagation and handling
 * - Validation performance
 * - Cross-validation dependencies
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { IntegrationAssertions } from '../utils/integration-assertions';

describe('Core Validation Chain Integration', () => {
  beforeEach(() => {
    // Reset validation state if needed
  });

  describe('Configuration Validation Chain', () => {
    it('should validate complete configuration objects', async () => {
      const validConfigs = [
        configFixtures.generateMinimalConfig(),
        configFixtures.generateFullConfig(),
        configFixtures.generateComplexConfig(),
      ];

      for (const config of validConfigs) {
        IntegrationAssertions.assertConfigurationValid(config);

        // Verify required properties
        expect(config).toHaveProperty('pretty');
        expect(config).toHaveProperty('minify');
        expect(config).toHaveProperty('removeUnused');

        // Verify types
        expect(typeof config.pretty).toBe('boolean');
        expect(typeof config.minify).toBe('boolean');
        expect(typeof config.removeUnused).toBe('boolean');
      }
    });

    it('should reject invalid configuration objects', async () => {
      const invalidConfigs = [
        { pretty: 'yes' }, // Wrong type
        { minify: 123 }, // Wrong type
        { removeUnused: null }, // Wrong type
        { nameGeneration: 'invalid' }, // Wrong type
        { unknown: true }, // Unknown property
      ];

      for (const invalidConfig of invalidConfigs) {
        expect(() => {
          IntegrationAssertions.assertConfigurationValid(invalidConfig as any);
        }).toThrow();
      }
    });

    it('should validate name generation options separately', async () => {
      const validNameGenOptions = [
        { minimumLength: 5, strategy: 'sequential' },
        { minimumLength: 8, strategy: 'random' },
        { minimumLength: 3, strategy: 'alphabet', alphabet: 'abc123' },
      ];

      for (const options of validNameGenOptions) {
        IntegrationAssertions.assertNameGenerationOptionsValid(options);

        expect(options.minimumLength).toBeGreaterThan(0);
        expect(['sequential', 'random', 'alphabet']).toContain(options.strategy);

        if (options.strategy === 'alphabet') {
          expect(options.alphabet).toBeDefined();
          expect(typeof options.alphabet).toBe('string');
        }
      }
    });
  });

  describe('Input Validation Integration', () => {
    it('should validate minimum length boundaries', async () => {
      const validLengths = [1, 5, 10, 25, 50, 100];
      const invalidLengths = [0, -1, -5, 101, 150, 'invalid', null, undefined];

      // Test valid lengths
      for (const length of validLengths) {
        const config = configFixtures.generateConfigWithNameGeneration({
          minimumLength: length,
          strategy: 'sequential',
        });

        IntegrationAssertions.assertConfigurationValid(config);
        expect(config.nameGeneration?.minimumLength).toBe(length);
      }

      // Test invalid lengths
      for (const length of invalidLengths) {
        expect(() => {
          configFixtures.generateConfigWithNameGeneration({
            minimumLength: length as number,
            strategy: 'sequential',
          });
        }).toThrow();
      }
    });

    it('should validate strategy options', async () => {
      const validStrategies = ['sequential', 'random', 'alphabet'];
      const invalidStrategies = ['invalid', 'custom', '', null, undefined, 123];

      // Test valid strategies
      for (const strategy of validStrategies) {
        const config = configFixtures.generateConfigWithNameGeneration({
          minimumLength: 5,
          strategy: strategy as any,
          alphabet: strategy === 'alphabet' ? 'abc123' : undefined,
        });

        IntegrationAssertions.assertConfigurationValid(config);
        expect(config.nameGeneration?.strategy).toBe(strategy);
      }

      // Test invalid strategies
      for (const strategy of invalidStrategies) {
        expect(() => {
          configFixtures.generateConfigWithNameGeneration({
            minimumLength: 5,
            strategy: strategy as any,
          });
        }).toThrow();
      }
    });

    it('should validate alphabet requirements', async () => {
      // Valid alphabets
      const validAlphabets = ['abc', 'abcdef0123456789', 'xyz123', 'qwertyuiop'];

      for (const alphabet of validAlphabets) {
        const config = configFixtures.generateConfigWithNameGeneration({
          minimumLength: 3,
          strategy: 'alphabet',
          alphabet,
        });

        IntegrationAssertions.assertConfigurationValid(config);
        expect(config.nameGeneration?.alphabet).toBe(alphabet);
      }

      // Invalid alphabets for alphabet strategy
      const invalidAlphabets = ['', null, undefined, 123];

      for (const alphabet of invalidAlphabets) {
        expect(() => {
          configFixtures.generateConfigWithNameGeneration({
            minimumLength: 3,
            strategy: 'alphabet',
            alphabet: alphabet as any,
          });
        }).toThrow();
      }

      // Missing alphabet for alphabet strategy
      expect(() => {
        configFixtures.generateConfigWithNameGeneration({
          minimumLength: 3,
          strategy: 'alphabet',
          // No alphabet provided
        });
      }).toThrow();
    });
  });

  describe('Error Propagation Integration', () => {
    it('should propagate validation errors correctly', async () => {
      const invalidConfigs = [
        { pretty: 'invalid' },
        { minify: 'invalid' },
        { removeUnused: 'invalid' },
      ];

      for (const invalidConfig of invalidConfigs) {
        try {
          IntegrationAssertions.assertConfigurationValid(invalidConfig as any);
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeDefined();
          expect(error.message).toMatch(/type|boolean|invalid/i);

          // Test error propagation assertion
          IntegrationAssertions.assertErrorPropagation(
            { stderr: error.message } as any,
            'validation'
          );
        }
      }
    });

    it('should provide helpful error messages', async () => {
      const testCases = [
        {
          config: { pretty: 'yes' },
          expectedMessage: /pretty.*boolean/i,
        },
        {
          config: { minimumLength: 0 },
          expectedMessage: /minimum.*length.*positive/i,
        },
        {
          config: { strategy: 'invalid' },
          expectedMessage: /strategy.*valid/i,
        },
      ];

      for (const testCase of testCases) {
        try {
          if ('minimumLength' in testCase.config || 'strategy' in testCase.config) {
            configFixtures.generateConfigWithNameGeneration(testCase.config as any);
          } else {
            IntegrationAssertions.assertConfigurationValid(testCase.config as any);
          }
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error.message).toMatch(testCase.expectedMessage);
        }
      }
    });

    it('should handle nested validation errors', async () => {
      const nestedInvalidConfigs = [
        {
          pretty: true,
          nameGeneration: {
            minimumLength: 0,
            strategy: 'sequential',
          },
        },
        {
          minify: false,
          nameGeneration: {
            minimumLength: 5,
            strategy: 'alphabet',
            // Missing alphabet
          },
        },
      ];

      for (const config of nestedInvalidConfigs) {
        try {
          const fullConfig = configFixtures.mergeWithDefaults(config);
          IntegrationAssertions.assertConfigurationValid(fullConfig);
          expect.fail('Should have thrown validation error');
        } catch (error) {
          expect(error).toBeDefined();
          expect(error.message).toMatch(/nameGeneration|minimumLength|alphabet/i);
        }
      }
    });
  });

  describe('Cross-Validation Integration', () => {
    it('should validate strategy-alphabet consistency', async () => {
      // Alphabet strategy requires alphabet
      expect(() => {
        configFixtures.generateConfigWithNameGeneration({
          minimumLength: 5,
          strategy: 'alphabet',
          // Missing alphabet
        });
      }).toThrow();

      // Non-alphabet strategies should not require alphabet
      const nonAlphabetStrategies = ['sequential', 'random'];

      for (const strategy of nonAlphabetStrategies) {
        const config = configFixtures.generateConfigWithNameGeneration({
          minimumLength: 5,
          strategy: strategy as any,
          // No alphabet needed
        });

        IntegrationAssertions.assertConfigurationValid(config);
        expect(config.nameGeneration?.alphabet).toBeUndefined();
      }
    });

    it('should validate length-alphabet compatibility', async () => {
      // Short alphabet with long minimum length
      const shortAlphabet = 'ab'; // Only 2 characters

      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 10, // Much longer than alphabet allows efficiently
        strategy: 'alphabet',
        alphabet: shortAlphabet,
      });

      // Should still be valid (just inefficient)
      IntegrationAssertions.assertConfigurationValid(config);
      expect(config.nameGeneration?.alphabet).toBe(shortAlphabet);
      expect(config.nameGeneration?.minimumLength).toBe(10);
    });

    it('should validate boolean option consistency', async () => {
      const booleanCombinations = [
        { pretty: true, minify: true, removeUnused: true },
        { pretty: false, minify: false, removeUnused: false },
        { pretty: true, minify: false, removeUnused: true },
        { pretty: false, minify: true, removeUnused: false },
      ];

      for (const combination of booleanCombinations) {
        const config = configFixtures.mergeWithDefaults(combination);
        IntegrationAssertions.assertConfigurationValid(config);

        expect(config.pretty).toBe(combination.pretty);
        expect(config.minify).toBe(combination.minify);
        expect(config.removeUnused).toBe(combination.removeUnused);
      }
    });
  });

  describe('Validation Performance Integration', () => {
    it('should validate configurations efficiently', async () => {
      const configs = Array.from({ length: 100 }, () => configFixtures.generateComplexConfig());

      const startTime = Date.now();

      for (const config of configs) {
        IntegrationAssertions.assertConfigurationValid(config);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should be very fast
    });

    it('should handle large validation sets', async () => {
      const nameGenOptions = Array.from({ length: 50 }, (_, i) => ({
        minimumLength: (i % 20) + 1,
        strategy: (['sequential', 'random', 'alphabet'] as const)[i % 3],
        alphabet: i % 3 === 2 ? 'abcdef0123456789' : undefined,
      }));

      const startTime = Date.now();

      for (const options of nameGenOptions) {
        if (options.strategy === 'alphabet' && !options.alphabet) {
          options.alphabet = 'abc123';
        }

        IntegrationAssertions.assertNameGenerationOptionsValid(options);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);
    });

    it('should cache validation results efficiently', async () => {
      const sameConfig = configFixtures.generateFullConfig();

      // Multiple validations of the same config should be fast
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        IntegrationAssertions.assertConfigurationValid(sameConfig);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Environment Integration', () => {
    it('should validate environment-based configurations', async () => {
      const envConfigs = [
        {
          ENIGMA_PRETTY: 'true',
          ENIGMA_MINIFY: 'false',
          ENIGMA_LENGTH: '8',
        },
        {
          ENIGMA_PRETTY: 'false',
          ENIGMA_MINIFY: 'true',
          ENIGMA_REMOVE_UNUSED: 'false',
          ENIGMA_LENGTH: '5',
        },
      ];

      for (const envVars of envConfigs) {
        const config = configFixtures.generateConfigFromEnvironment(envVars);
        IntegrationAssertions.assertConfigurationValid(config);

        // Verify environment values were parsed correctly
        if (envVars.ENIGMA_PRETTY) {
          expect(config.pretty).toBe(envVars.ENIGMA_PRETTY === 'true');
        }
        if (envVars.ENIGMA_MINIFY) {
          expect(config.minify).toBe(envVars.ENIGMA_MINIFY === 'true');
        }
        if (envVars.ENIGMA_LENGTH) {
          expect(config.nameGeneration?.minimumLength).toBe(parseInt(envVars.ENIGMA_LENGTH));
        }
      }
    });

    it('should handle invalid environment values', async () => {
      const invalidEnvConfigs = [
        { ENIGMA_PRETTY: 'invalid' },
        { ENIGMA_MINIFY: 'yes' },
        { ENIGMA_LENGTH: 'abc' },
        { ENIGMA_LENGTH: '-5' },
      ];

      for (const envVars of invalidEnvConfigs) {
        expect(() => {
          configFixtures.generateConfigFromEnvironment(envVars);
        }).toThrow();
      }
    });
  });

  describe('Priority and Override Validation', () => {
    it('should validate configuration priority chains', async () => {
      const baseConfig = configFixtures.generateMinimalConfig();
      const overrideConfig = {
        pretty: true,
        nameGeneration: {
          minimumLength: 10,
          strategy: 'random' as const,
        },
      };

      const mergedConfig = configFixtures.mergeConfigurations(baseConfig, overrideConfig);

      IntegrationAssertions.assertConfigurationValid(mergedConfig);
      IntegrationAssertions.assertConfigPriority(
        { stdout: JSON.stringify(mergedConfig) } as any,
        'override',
        10
      );

      expect(mergedConfig.pretty).toBe(true);
      expect(mergedConfig.nameGeneration?.minimumLength).toBe(10);
      expect(mergedConfig.nameGeneration?.strategy).toBe('random');
    });

    it('should validate deep merge consistency', async () => {
      const config1 = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 5,
        strategy: 'alphabet',
        alphabet: 'abc',
      });

      const override = {
        nameGeneration: {
          minimumLength: 8,
          // strategy and alphabet should be preserved
        },
      };

      const mergedConfig = configFixtures.mergeConfigurations(config1, override);

      IntegrationAssertions.assertConfigurationValid(mergedConfig);
      expect(mergedConfig.nameGeneration?.minimumLength).toBe(8);
      expect(mergedConfig.nameGeneration?.strategy).toBe('alphabet');
      expect(mergedConfig.nameGeneration?.alphabet).toBe('abc');
    });
  });

  it('should validate configurations', async () => {
    const config = configFixtures.generateMinimalConfig();
    IntegrationAssertions.assertConfigurationValid(config);
    expect(config).toHaveProperty('pretty');
  });
});
