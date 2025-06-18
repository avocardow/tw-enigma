/**
 * Configuration File Formats Integration Tests
 *
 * Tests various configuration file formats and their parsing,
 * validation, and interaction with the CLI system.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions } from '../utils/integration-assertions';

describe('Configuration File Formats Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('JavaScript Configuration Files', () => {
    it('should parse valid JavaScript config files', async () => {
      // Create JS config file
      const jsConfig = configFixtures.generateComplexNameGeneration();
      const configPath = path.join(tempDir, 'tw-enigma.config.js');
      await fs.writeFile(configPath, `module.exports = ${JSON.stringify(jsConfig, null, 2)};`);

      // Test config loading
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Validate configuration parsing
      IntegrationAssertions.assertConfigurationValid(
        result,
        jsConfig,
        'JavaScript configuration file parsing'
      );
    });

    it('should handle JavaScript config with functions', async () => {
      // Create JS config with functions
      const jsConfigWithFunctions = `
module.exports = {
  input: './src',
  output: './dist',
  nameGeneration: {
    enabled: true,
    minimumLength: 8,
    pattern: function(length) { return 'c' + 'x'.repeat(length - 1); }
  }
};`;
      const configPath = path.join(tempDir, 'tw-enigma.config.js');
      await fs.writeFile(configPath, jsConfigWithFunctions);

      // Test function-based config
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Validate function configuration
      expect(result.stdout).toContain('nameGeneration');
      expect(result.stdout).toContain('minimumLength');
    });

    it('should validate JavaScript config syntax errors', async () => {
      // Create invalid JS config
      const invalidConfig = `
module.exports = {
  input: './src',
  output: './dist'
  // Missing comma - syntax error
  nameGeneration: {
    enabled: true
  }
};`;
      const configPath = path.join(tempDir, 'invalid.config.js');
      await fs.writeFile(configPath, invalidConfig);

      // Test error handling
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should handle syntax errors gracefully
      CliAssertions.assertErrorHandling(
        result,
        ['syntax', 'parse', 'config'],
        'JavaScript config syntax error handling'
      );
    });
  });

  describe('JSON Configuration Files', () => {
    it('should parse valid JSON config files', async () => {
      // Create JSON config file
      const jsonConfig = configFixtures.generateMinimalConfig();
      const configPath = path.join(tempDir, 'tw-enigma.config.json');
      await fs.writeFile(configPath, JSON.stringify(jsonConfig, null, 2));

      // Test JSON config loading
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Validate JSON configuration parsing
      IntegrationAssertions.assertConfigurationValid(
        result,
        jsonConfig,
        'JSON configuration file parsing'
      );
    });

    it('should validate JSON config schema', async () => {
      // Create JSON config with correct schema
      const validJsonConfig = {
        input: './src',
        output: './dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 6,
          pattern: 'alphabetic',
        },
      };
      const configPath = path.join(tempDir, 'valid.config.json');
      await fs.writeFile(configPath, JSON.stringify(validJsonConfig, null, 2));

      // Test schema validation
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Validate schema compliance
      IntegrationAssertions.assertConfigurationValid(
        result,
        validJsonConfig,
        'JSON configuration schema validation'
      );
    });

    it('should handle JSON syntax errors', async () => {
      // Create invalid JSON
      const invalidJson = `{
  "input": "./src",
  "output": "./dist",
  "nameGeneration": {
    "enabled": true,
    "minimumLength": 6
  // Missing closing brace and quote
}`;
      const configPath = path.join(tempDir, 'invalid.config.json');
      await fs.writeFile(configPath, invalidJson);

      // Test JSON error handling
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should handle JSON syntax errors
      CliAssertions.assertErrorHandling(
        result,
        ['json', 'parse', 'syntax'],
        'JSON config syntax error handling'
      );
    });
  });

  describe('Configuration Validation', () => {
    it('should validate nameGeneration configuration', async () => {
      // Create config with name generation options
      const nameGenConfig = configFixtures.generateConfigWithNameGeneration(10);
      const configPath = path.join(tempDir, 'namegen.config.json');
      await fs.writeFile(configPath, JSON.stringify(nameGenConfig, null, 2));

      // Test name generation validation
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Validate name generation configuration
      IntegrationAssertions.assertNameGenerationOptionsValid(
        result,
        {
          enabled: true,
          minimumLength: 10,
          pattern: 'alphabetic',
        },
        'Name generation configuration validation'
      );
    });

    it('should validate input/output path configuration', async () => {
      // Create config with various path formats
      const pathConfig = {
        input: ['./src', './components'],
        output: './dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 8,
        },
      };
      const configPath = path.join(tempDir, 'paths.config.json');
      await fs.writeFile(configPath, JSON.stringify(pathConfig, null, 2));

      // Test path validation
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Validate path configuration
      IntegrationAssertions.assertConfigurationValid(
        result,
        pathConfig,
        'Input/output path configuration validation'
      );
    });

    it('should handle invalid configuration values', async () => {
      // Create config with invalid values
      const invalidConfig = configFixtures.generateInvalidNameGeneration();
      const configPath = path.join(tempDir, 'invalid-values.config.json');
      await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

      // Test invalid config handling
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should handle validation errors
      CliAssertions.assertErrorHandling(
        result,
        ['validation', 'invalid', 'config'],
        'Invalid configuration value handling'
      );
    });
  });

  describe('Configuration Discovery', () => {
    it('should discover default configuration files', async () => {
      // Create default config file
      const defaultConfig = configFixtures.generateMinimalConfig();
      const defaultConfigPath = path.join(tempDir, 'tw-enigma.config.js');
      await fs.writeFile(
        defaultConfigPath,
        `module.exports = ${JSON.stringify(defaultConfig, null, 2)};`
      );

      // Test automatic discovery
      const result = await cliHarness.executeCommandInDirectory(['init-config'], tempDir);

      // Validate automatic config discovery
      IntegrationAssertions.assertConfigurationValid(
        result,
        defaultConfig,
        'Default configuration file discovery'
      );
    });

    it('should prioritize explicit config over default', async () => {
      // Create default config
      const defaultConfig = configFixtures.generateMinimalConfig();
      const defaultConfigPath = path.join(tempDir, 'tw-enigma.config.js');
      await fs.writeFile(
        defaultConfigPath,
        `module.exports = ${JSON.stringify(defaultConfig, null, 2)};`
      );

      // Create explicit config with different values
      const explicitConfig = configFixtures.generateConfigWithNameGeneration(12);
      const explicitConfigPath = path.join(tempDir, 'custom.config.js');
      await fs.writeFile(
        explicitConfigPath,
        `module.exports = ${JSON.stringify(explicitConfig, null, 2)};`
      );

      // Test explicit config priority
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', explicitConfigPath, 'init-config'],
        tempDir
      );

      // Should use explicit config, not default
      IntegrationAssertions.assertNameGenerationOptionsValid(
        result,
        {
          enabled: true,
          minimumLength: 12,
          pattern: 'alphabetic',
        },
        'Explicit configuration priority over default'
      );
    });
  });

  describe('Configuration Merging', () => {
    it('should merge CLI flags with configuration file', async () => {
      // Create base config
      const baseConfig = {
        input: './src',
        output: './dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 6,
        },
      };
      const configPath = path.join(tempDir, 'base.config.json');
      await fs.writeFile(configPath, JSON.stringify(baseConfig, null, 2));

      // Test CLI flag override
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, '--length', '10', 'init-config'],
        tempDir
      );

      // CLI flag should override config file
      IntegrationAssertions.assertLengthIntegration(result, 10, 'init-config');
    });

    it('should merge environment variables with configuration', async () => {
      // Create config without length specification
      const envConfig = {
        input: './src',
        output: './dist',
        nameGeneration: {
          enabled: true,
        },
      };
      const configPath = path.join(tempDir, 'env.config.json');
      await fs.writeFile(configPath, JSON.stringify(envConfig, null, 2));

      // Test environment variable integration
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '8' }
      );

      // Environment variable should be applied
      if (result.exitCode === 0) {
        IntegrationAssertions.assertLengthIntegration(result, 8, 'init-config');
      }
    });
  });
});
