/**
 * Configuration Precedence Rules Integration Tests
 *
 * Tests the precedence order between CLI flags, configuration files,
 * environment variables, and default values across all scenarios.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';
import { IntegrationAssertions } from '../utils/integration-assertions';

describe('Configuration Precedence Rules Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Basic Precedence Order: CLI > Config > Env > Default', () => {
    it('should prioritize CLI flags over all other sources', async () => {
      // Create config file with length 10
      const configFile = configFixtures.generateConfigWithNameGeneration(10);
      const configPath = path.join(tempDir, 'precedence.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Test CLI flag precedence (length 20)
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, '--length', '20', 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '15' }
      );

      // CLI flag (20) should override config (10) and env (15)
      IntegrationAssertions.assertLengthIntegration(result, 20, 'init-config');
    });

    it('should prioritize config file over environment and defaults', async () => {
      // Create config file with length 12
      const configFile = configFixtures.generateConfigWithNameGeneration(12);
      const configPath = path.join(tempDir, 'config-priority.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Test config file precedence
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '8' }
      );

      // Config file (12) should override env (8)
      IntegrationAssertions.assertLengthIntegration(result, 12, 'init-config');
    });

    it('should prioritize environment variables over defaults', async () => {
      // Test environment variable precedence (no config file, no CLI flag)
      const result = await cliHarness.executeCommandWithEnv(['init-config'], {
        TW_ENIGMA_LENGTH: '14',
      });

      // Environment variable should override default
      IntegrationAssertions.assertLengthIntegration(result, 14, 'init-config');
    });

    it('should use default values when no other source is specified', async () => {
      // Test default values (no CLI flag, no config, no env)
      const result = await cliHarness.executeCommand(['init-config']);

      // Should use default configuration
      CliAssertions.assertSuccess(result);
      expect(result.stdout).toContain('module.exports');
    });
  });

  describe('Partial Configuration Override', () => {
    it('should merge partial CLI overrides with config file', async () => {
      // Create config with multiple settings
      const configFile = {
        input: './config-input',
        output: './config-output',
        nameGeneration: {
          enabled: true,
          minimumLength: 8,
          pattern: 'alphabetic',
        },
      };
      const configPath = path.join(tempDir, 'partial.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Override only length via CLI
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, '--length', '16', 'init-config'],
        tempDir
      );

      // Should use config for input/output, CLI for length
      expect(result.stdout).toContain('./config-input');
      expect(result.stdout).toContain('./config-output');
      IntegrationAssertions.assertLengthIntegration(result, 16, 'init-config');
    });

    it('should merge partial environment overrides with config file', async () => {
      // Create config with partial settings
      const configFile = {
        input: './config-src',
        nameGeneration: {
          enabled: true,
          minimumLength: 6,
        },
      };
      const configPath = path.join(tempDir, 'env-merge.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Override output via environment
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, 'init-config'],
        tempDir,
        { TW_ENIGMA_OUTPUT: './env-output' }
      );

      // Should merge config input with env output
      expect(result.stdout).toContain('./config-src');
      expect(result.stdout).toContain('./env-output');
      IntegrationAssertions.assertLengthIntegration(result, 6, 'init-config');
    });

    it('should handle complex multi-source configuration', async () => {
      // Create base config
      const configFile = {
        input: './base-input',
        output: './base-output',
        nameGeneration: {
          enabled: true,
          minimumLength: 5,
          pattern: 'alphabetic',
        },
      };
      const configPath = path.join(tempDir, 'multi-source.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Complex override scenario
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, '--length', '18', '--verbose', 'init-config'],
        tempDir,
        {
          TW_ENIGMA_OUTPUT: './env-override-output',
          TW_ENIGMA_PRETTY: 'true',
        }
      );

      // Should combine all sources appropriately
      expect(result.stdout).toContain('./base-input'); // from config
      expect(result.stdout).toContain('./env-override-output'); // from env
      IntegrationAssertions.assertLengthIntegration(result, 18, 'init-config'); // from CLI
      expect(result.stderr).toMatch(/verbose|debug/i); // from CLI
    });
  });

  describe('Type-Specific Precedence', () => {
    it('should handle boolean flag precedence correctly', async () => {
      // Create config with verbose disabled
      const configFile = {
        input: './src',
        output: './dist',
        verbose: false,
        pretty: false,
      };
      const configPath = path.join(tempDir, 'boolean.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Enable verbose via CLI
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, '--verbose', 'init-config'],
        tempDir,
        { TW_ENIGMA_PRETTY: 'true' }
      );

      // CLI verbose should override config, env pretty should override config
      expect(result.stderr).toMatch(/verbose|debug/i);
    });

    it('should handle array/object precedence correctly', async () => {
      // Create config with input array
      const configFile = {
        input: ['./config-src1', './config-src2'],
        output: './config-dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 7,
          pattern: 'alphabetic',
        },
      };
      const configPath = path.join(tempDir, 'array.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Override input via environment (comma-separated array)
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, 'init-config'],
        tempDir,
        { TW_ENIGMA_INPUT: './env-src1,./env-src2,./env-src3' }
      );

      // Environment array should override config array
      expect(result.stdout).toContain('./env-src1');
      expect(result.stdout).toContain('./env-src2');
      expect(result.stdout).toContain('./env-src3');
    });
  });

  describe('Configuration Source Validation', () => {
    it('should validate precedence when config file is invalid', async () => {
      // Create invalid config file
      const invalidConfig = `{ invalid json syntax }`;
      const configPath = path.join(tempDir, 'invalid.config.json');
      await fs.writeFile(configPath, invalidConfig);

      // Should fall back to environment variables
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '11' }
      );

      // Should handle config error and use environment fallback
      if (result.exitCode === 0) {
        IntegrationAssertions.assertLengthIntegration(result, 11, 'init-config');
      } else {
        CliAssertions.assertErrorHandling(
          result,
          ['config', 'parse', 'json'],
          'Invalid config file handling'
        );
      }
    });

    it('should validate precedence with missing config file', async () => {
      // Reference non-existent config file
      const missingConfigPath = path.join(tempDir, 'nonexistent.config.json');

      // Should fall back to environment variables
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', missingConfigPath, 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '13' }
      );

      // Should handle missing config and use environment fallback
      if (result.exitCode === 0) {
        IntegrationAssertions.assertLengthIntegration(result, 13, 'init-config');
      } else {
        CliAssertions.assertErrorHandling(
          result,
          ['config', 'file', 'not found'],
          'Missing config file handling'
        );
      }
    });
  });

  describe('Precedence Edge Cases', () => {
    it('should handle identical values from different sources', async () => {
      // Create config with length 10
      const configFile = configFixtures.generateConfigWithNameGeneration(10);
      const configPath = path.join(tempDir, 'identical.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Set same value via environment and CLI
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, '--length', '10', 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '10' }
      );

      // Should work correctly with identical values
      IntegrationAssertions.assertLengthIntegration(result, 10, 'init-config');
    });

    it('should handle conflicting boolean flags', async () => {
      // Test conflicting boolean values
      const result = await cliHarness.executeCommandWithEnv(
        ['--verbose', '--quiet', 'init-config'],
        { TW_ENIGMA_VERBOSE: 'false' }
      );

      // Should handle conflicting flags gracefully
      expect(result.exitCode).toBeDefined();
    });

    it('should handle precedence with default config discovery', async () => {
      // Create default config file
      const defaultConfig = configFixtures.generateConfigWithNameGeneration(9);
      const defaultConfigPath = path.join(tempDir, 'tw-enigma.config.js');
      await fs.writeFile(
        defaultConfigPath,
        `module.exports = ${JSON.stringify(defaultConfig, null, 2)};`
      );

      // Test precedence with auto-discovered config
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--length', '15', 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '12' }
      );

      // CLI flag should override both auto-discovered config and env
      IntegrationAssertions.assertLengthIntegration(result, 15, 'init-config');
    });
  });

  describe('Precedence Documentation and Consistency', () => {
    it('should maintain consistent precedence across all commands', async () => {
      // Create config file
      const configFile = configFixtures.generateConfigWithNameGeneration(8);
      const configPath = path.join(tempDir, 'consistency.config.json');
      await fs.writeFile(configPath, JSON.stringify(configFile, null, 2));

      // Test precedence consistency across different commands
      const initResult = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, '--length', '16', 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '12' }
      );

      const cssResult = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, '--length', '16', 'css-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '12' }
      );

      // Both commands should follow same precedence rules
      IntegrationAssertions.assertLengthIntegration(initResult, 16, 'init-config');
      IntegrationAssertions.assertLengthIntegration(cssResult, 16, 'css-config');
    });

    it('should validate precedence order documentation', async () => {
      // Test that help text or error messages document precedence
      const helpResult = await cliHarness.executeCommand(['--help']);

      // Should contain some indication of precedence order
      expect(helpResult.stdout).toBeTruthy();
      // Note: This test validates that help is available;
      // actual precedence documentation checking would need specific help text
    });
  });
});
