/**
 * Core Configuration Processing Integration Test
 *
 * Tests the internal integration points within the Core package:
 * - Configuration loading and validation
 * - Name generation configuration processing
 * - Default value handling and overrides
 * - Configuration schema validation
 * - Internal configuration flow
 */

import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { IntegrationAssertions } from '../utils/integration-assertions';

// Import Core configuration types and utilities
import type { NameGenerationOptions } from '@tw-enigma/core';

describe('Core Configuration Processing Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'enigma-config-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Cleanup errors are not critical
    }
  });

  describe('Configuration Schema Validation', () => {
    it('should validate complete configuration objects', async () => {
      const configs = [
        configFixtures.generateFullConfig(),
        configFixtures.generateMinimalConfig(),
        configFixtures.generateComplexConfig(),
      ];

      for (const config of configs) {
        // Test configuration schema validation
        IntegrationAssertions.assertConfigurationValid(config);

        // Verify required fields are present
        expect(config).toHaveProperty('pretty');
        expect(config).toHaveProperty('minify');
        expect(config).toHaveProperty('removeUnused');

        // Verify boolean types
        expect(typeof config.pretty).toBe('boolean');
        expect(typeof config.minify).toBe('boolean');
        expect(typeof config.removeUnused).toBe('boolean');
      }
    });

    it('should validate name generation options schema', async () => {
      const nameGenConfigs: NameGenerationOptions[] = [
        {
          minimumLength: 5,
          strategy: 'sequential',
          alphabet: 'abcdef0123456789',
        },
        {
          minimumLength: 8,
          strategy: 'random',
        },
        {
          minimumLength: 3,
          strategy: 'alphabet',
          alphabet: 'xyz',
        },
      ];

      for (const nameGenConfig of nameGenConfigs) {
        IntegrationAssertions.assertNameGenerationOptionsValid(nameGenConfig);

        // Verify required fields
        expect(nameGenConfig.minimumLength).toBeGreaterThan(0);
        expect(['sequential', 'random', 'alphabet']).toContain(nameGenConfig.strategy);

        // Verify conditional fields
        if (nameGenConfig.strategy === 'alphabet') {
          expect(nameGenConfig.alphabet).toBeDefined();
          expect(typeof nameGenConfig.alphabet).toBe('string');
          expect(nameGenConfig.alphabet.length).toBeGreaterThan(0);
        }
      }
    });

    it('should reject invalid configuration schemas', async () => {
      const invalidConfigs = [
        { pretty: 'yes' }, // Wrong type
        { minify: 123 }, // Wrong type
        { removeUnused: null }, // Wrong type
        { nameGeneration: 'invalid' }, // Wrong type
        { unknownProperty: true }, // Unknown property
      ];

      for (const invalidConfig of invalidConfigs) {
        expect(() => {
          IntegrationAssertions.assertConfigurationValid(invalidConfig as any);
        }).toThrow();
      }
    });
  });

  describe('Default Configuration Processing', () => {
    it('should provide correct default values', async () => {
      const defaultConfig = configFixtures.generateMinimalConfig();

      // Verify default values match expected behavior
      expect(defaultConfig.pretty).toBe(false);
      expect(defaultConfig.minify).toBe(true);
      expect(defaultConfig.removeUnused).toBe(true);
      expect(defaultConfig.nameGeneration).toBeUndefined();
    });

    it('should handle partial configuration overrides', async () => {
      const partialConfigs = [
        { pretty: true },
        { minify: false },
        { removeUnused: false },
        { pretty: true, minify: false },
      ];

      for (const partial of partialConfigs) {
        const mergedConfig = configFixtures.mergeWithDefaults(partial);

        // Should preserve specified values
        Object.keys(partial).forEach((key) => {
          expect(mergedConfig[key]).toBe(partial[key]);
        });

        // Should provide defaults for unspecified values
        IntegrationAssertions.assertConfigurationValid(mergedConfig);
      }
    });

    it('should handle name generation defaults correctly', async () => {
      const configWithNameGen = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 6,
      });

      // Should provide strategy default
      expect(configWithNameGen.nameGeneration?.strategy).toBe('sequential');
      expect(configWithNameGen.nameGeneration?.minimumLength).toBe(6);

      // Should handle alphabet strategy
      const alphabetConfig = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 4,
        strategy: 'alphabet',
      });

      expect(alphabetConfig.nameGeneration?.strategy).toBe('alphabet');
      expect(alphabetConfig.nameGeneration?.alphabet).toBeDefined();
      expect(alphabetConfig.nameGeneration?.alphabet?.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Loading Integration', () => {
    it('should load configuration from JavaScript files', async () => {
      const configPath = path.join(tempDir, 'enigma.config.js');
      const config = configFixtures.generateComplexConfig();

      await configFixtures.writeConfigFile(configPath, config, 'js');

      // Test configuration loading
      const loadedConfig = await configFixtures.loadConfigFromFile(configPath);

      IntegrationAssertions.assertConfigurationValid(loadedConfig);
      expect(loadedConfig.pretty).toBe(config.pretty);
      expect(loadedConfig.minify).toBe(config.minify);
      expect(loadedConfig.removeUnused).toBe(config.removeUnused);
    });

    it('should load configuration from JSON files', async () => {
      const configPath = path.join(tempDir, 'enigma.config.json');
      const config = configFixtures.generateFullConfig();

      await configFixtures.writeConfigFile(configPath, config, 'json');

      const loadedConfig = await configFixtures.loadConfigFromFile(configPath);

      IntegrationAssertions.assertConfigurationValid(loadedConfig);
      expect(loadedConfig).toEqual(config);
    });

    it('should handle configuration file errors gracefully', async () => {
      const invalidPaths = [
        path.join(tempDir, 'nonexistent.config.js'),
        path.join(tempDir, 'invalid.config.js'),
      ];

      // Create invalid configuration file
      await fs.writeFile(invalidPaths[1], 'module.exports = { invalid: syntax }');

      for (const invalidPath of invalidPaths) {
        try {
          await configFixtures.loadConfigFromFile(invalidPath);
          // Should either succeed with defaults or throw
        } catch (error) {
          expect(error).toBeDefined();
          IntegrationAssertions.assertErrorPropagation(
            { stderr: error.message } as any,
            'configuration'
          );
        }
      }
    });
  });

  describe('Name Generation Configuration Processing', () => {
    it('should process sequential strategy configuration', async () => {
      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 8,
        strategy: 'sequential',
      });

      IntegrationAssertions.assertConfigurationValid(config);
      expect(config.nameGeneration?.strategy).toBe('sequential');
      expect(config.nameGeneration?.minimumLength).toBe(8);

      // Sequential strategy should not require alphabet
      expect(config.nameGeneration?.alphabet).toBeUndefined();
    });

    it('should process random strategy configuration', async () => {
      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 5,
        strategy: 'random',
      });

      IntegrationAssertions.assertConfigurationValid(config);
      expect(config.nameGeneration?.strategy).toBe('random');
      expect(config.nameGeneration?.minimumLength).toBe(5);

      // Random strategy should not require alphabet
      expect(config.nameGeneration?.alphabet).toBeUndefined();
    });

    it('should process alphabet strategy configuration', async () => {
      const customAlphabet = 'abcdef0123456789';
      const config = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 6,
        strategy: 'alphabet',
        alphabet: customAlphabet,
      });

      IntegrationAssertions.assertConfigurationValid(config);
      expect(config.nameGeneration?.strategy).toBe('alphabet');
      expect(config.nameGeneration?.minimumLength).toBe(6);
      expect(config.nameGeneration?.alphabet).toBe(customAlphabet);
    });

    it('should validate name generation boundaries', async () => {
      const validLengths = [1, 5, 10, 25, 50];
      const invalidLengths = [0, -1, 101, 'invalid'];

      // Test valid lengths
      for (const length of validLengths) {
        const config = configFixtures.generateConfigWithNameGeneration({
          minimumLength: length as number,
        });

        IntegrationAssertions.assertConfigurationValid(config);
        expect(config.nameGeneration?.minimumLength).toBe(length);
      }

      // Test invalid lengths
      for (const length of invalidLengths) {
        expect(() => {
          configFixtures.generateConfigWithNameGeneration({
            minimumLength: length as number,
          });
        }).toThrow();
      }
    });
  });

  describe('Configuration Priority and Merging', () => {
    it('should handle configuration priority correctly', async () => {
      const baseConfig = configFixtures.generateMinimalConfig();
      const overrideConfig = {
        pretty: true,
        nameGeneration: {
          minimumLength: 10,
          strategy: 'random' as const,
        },
      };

      const mergedConfig = configFixtures.mergeConfigurations(baseConfig, overrideConfig);

      // Override values should take precedence
      expect(mergedConfig.pretty).toBe(true);
      expect(mergedConfig.nameGeneration?.minimumLength).toBe(10);
      expect(mergedConfig.nameGeneration?.strategy).toBe('random');

      // Base values should be preserved where not overridden
      expect(mergedConfig.minify).toBe(baseConfig.minify);
      expect(mergedConfig.removeUnused).toBe(baseConfig.removeUnused);
    });

    it('should handle deep merging of name generation options', async () => {
      const baseConfig = configFixtures.generateConfigWithNameGeneration({
        minimumLength: 5,
        strategy: 'sequential',
      });

      const override = {
        nameGeneration: {
          minimumLength: 8,
          // strategy should remain 'sequential'
        },
      };

      const mergedConfig = configFixtures.mergeConfigurations(baseConfig, override);

      expect(mergedConfig.nameGeneration?.minimumLength).toBe(8);
      expect(mergedConfig.nameGeneration?.strategy).toBe('sequential');
    });

    it('should handle environment variable integration', async () => {
      const envOverrides = {
        ENIGMA_PRETTY: 'true',
        ENIGMA_MINIFY: 'false',
        ENIGMA_LENGTH: '7',
      };

      const config = configFixtures.generateConfigFromEnvironment(envOverrides);

      expect(config.pretty).toBe(true);
      expect(config.minify).toBe(false);
      expect(config.nameGeneration?.minimumLength).toBe(7);
    });
  });

  describe('Configuration Serialization', () => {
    it('should serialize configuration to JavaScript format', async () => {
      const config = configFixtures.generateComplexConfig();
      const jsOutput = configFixtures.serializeToJavaScript(config);

      expect(jsOutput).toContain('module.exports');
      expect(jsOutput).toContain('pretty:');
      expect(jsOutput).toContain('minify:');
      expect(jsOutput).toContain('removeUnused:');

      if (config.nameGeneration) {
        expect(jsOutput).toContain('nameGeneration:');
        expect(jsOutput).toContain('minimumLength:');
        expect(jsOutput).toContain('strategy:');
      }
    });

    it('should serialize configuration to JSON format', async () => {
      const config = configFixtures.generateFullConfig();
      const jsonOutput = configFixtures.serializeToJSON(config);

      const parsedConfig = JSON.parse(jsonOutput);
      IntegrationAssertions.assertConfigurationValid(parsedConfig);
      expect(parsedConfig).toEqual(config);
    });

    it('should maintain configuration integrity through serialization', async () => {
      const originalConfig = configFixtures.generateComplexConfig();

      // Test JavaScript serialization round-trip
      const jsOutput = configFixtures.serializeToJavaScript(originalConfig);
      const tempJsPath = path.join(tempDir, 'test.config.js');
      await fs.writeFile(tempJsPath, jsOutput);
      const loadedJsConfig = await configFixtures.loadConfigFromFile(tempJsPath);

      IntegrationAssertions.assertConfigurationValid(loadedJsConfig);
      expect(loadedJsConfig.pretty).toBe(originalConfig.pretty);
      expect(loadedJsConfig.minify).toBe(originalConfig.minify);
      expect(loadedJsConfig.removeUnused).toBe(originalConfig.removeUnused);

      // Test JSON serialization round-trip
      const jsonOutput = configFixtures.serializeToJSON(originalConfig);
      const parsedJsonConfig = JSON.parse(jsonOutput);

      IntegrationAssertions.assertConfigurationValid(parsedJsonConfig);
      expect(parsedJsonConfig).toEqual(originalConfig);
    });
  });

  describe('Performance and Error Handling', () => {
    it('should process configurations efficiently', async () => {
      const configs = Array.from({ length: 10 }, () => configFixtures.generateComplexConfig());

      const startTime = Date.now();

      for (const config of configs) {
        IntegrationAssertions.assertConfigurationValid(config);
        configFixtures.serializeToJavaScript(config);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should be very fast
    });

    it('should handle invalid configurations gracefully', async () => {
      const invalidConfigs = [null, undefined, 'string', 123, [], { invalid: 'structure' }];

      for (const invalidConfig of invalidConfigs) {
        expect(() => {
          IntegrationAssertions.assertConfigurationValid(invalidConfig as any);
        }).toThrow();
      }
    });

    it('should provide helpful validation error messages', async () => {
      try {
        IntegrationAssertions.assertConfigurationValid({ pretty: 'yes' } as any);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toMatch(/pretty|boolean|type/i);
        IntegrationAssertions.assertErrorPropagation(
          { stderr: error.message } as any,
          'validation'
        );
      }
    });
  });
});
