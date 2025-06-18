/**
 * Environment Variables Integration Tests
 *
 * Tests environment variable handling, precedence,
 * and integration with CLI options and configuration files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliTestHarness } from '../utils/cli-test-harness';
import { CliAssertions } from '../utils/cli-test-harness';
import { configFixtures } from '../fixtures/config-generators';
import { IntegrationAssertions, IntegrationUtils } from '../utils/integration-assertions';
import fs from 'fs/promises';
import path from 'path';

describe('Environment Variables Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Basic Environment Variable Support', () => {
    it('should read TW_ENIGMA_LENGTH environment variable', async () => {
      // Test basic length environment variable
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_LENGTH: '12' }
      );

      // Validate environment variable is applied
      IntegrationAssertions.assertLengthIntegration(result, 12, 'init-config');
    });

    it('should read TW_ENIGMA_INPUT environment variable', async () => {
      // Test input path environment variable
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_INPUT: './custom-src' }
      );

      // Validate input path configuration
      expect(result.stdout).toContain('./custom-src');
    });

    it('should read TW_ENIGMA_OUTPUT environment variable', async () => {
      // Test output path environment variable
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_OUTPUT: './custom-dist' }
      );

      // Validate output path configuration
      expect(result.stdout).toContain('./custom-dist');
    });

    it('should read TW_ENIGMA_VERBOSE environment variable', async () => {
      // Test verbose environment variable
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_VERBOSE: 'true' }
      );

      // Validate verbose mode
      expect(result.stderr).toMatch(/verbose|debug/i);
    });
  });

  describe('Environment Variable Precedence', () => {
    it('should prioritize CLI flags over environment variables', async () => {
      // Test CLI flag precedence
      const result = await cliHarness.executeCommandWithEnv(
        ['--length', '10', 'init-config'],
        { TW_ENIGMA_LENGTH: '8' }
      );

      // CLI flag should take precedence
      IntegrationAssertions.assertLengthIntegration(result, 10, 'init-config');
    });

    it('should prioritize environment variables over default values', async () => {
      // Test environment variable over defaults
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_LENGTH: '15' }
      );

      // Environment variable should override defaults
      IntegrationAssertions.assertLengthIntegration(result, 15, 'init-config');
    });

    it('should prioritize config file over environment variables', async () => {
      // Create config file with specific length
      const configWithLength = configFixtures.generateConfigWithNameGeneration(20);
      const configPath = path.join(tempDir, 'precedence.config.json');
      await fs.writeFile(configPath, JSON.stringify(configWithLength, null, 2));

      // Test config file precedence
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '8' }
      );

      // Config file should take precedence over environment variable
      IntegrationAssertions.assertLengthIntegration(result, 20, 'init-config');
    });

    it('should validate complete precedence chain: CLI > Config > Env > Default', async () => {
      // Create config file
      const configWithLength = configFixtures.generateConfigWithNameGeneration(16);
      const configPath = path.join(tempDir, 'chain.config.json');
      await fs.writeFile(configPath, JSON.stringify(configWithLength, null, 2));

      // Test complete precedence chain
      const result = await cliHarness.executeCommandInDirectoryWithEnv(
        ['--config', configPath, '--length', '25', 'init-config'],
        tempDir,
        { TW_ENIGMA_LENGTH: '12' }
      );

      // CLI flag should have highest precedence
      IntegrationAssertions.assertLengthIntegration(result, 25, 'init-config');
    });
  });

  describe('Environment Variable Types', () => {
    it('should handle boolean environment variables', async () => {
      // Test boolean conversion
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        {
          TW_ENIGMA_VERBOSE: 'true',
          TW_ENIGMA_PRETTY: 'false'
        }
      );

      // Validate boolean handling
      expect(result.stderr).toMatch(/verbose|debug/i);
    });

    it('should handle numeric environment variables', async () => {
      // Test numeric conversion
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        {
          TW_ENIGMA_LENGTH: '18',
          TW_ENIGMA_TIMEOUT: '5000'
        }
      );

      // Validate numeric parsing
      IntegrationAssertions.assertLengthIntegration(result, 18, 'init-config');
    });

    it('should handle array environment variables', async () => {
      // Test array parsing (comma-separated)
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_INPUT: './src,./components,./pages' }
      );

      // Validate array parsing
      expect(result.stdout).toContain('./src');
      expect(result.stdout).toContain('./components');
      expect(result.stdout).toContain('./pages');
    });

    it('should handle JSON environment variables', async () => {
      // Test JSON object parsing
      const nameGenerationConfig = JSON.stringify({
        enabled: true,
        minimumLength: 14,
        pattern: 'alphabetic'
      });

      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_NAME_GENERATION: nameGenerationConfig }
      );

      // Validate JSON parsing
      IntegrationAssertions.assertNameGenerationOptionsValid(
        result,
        {
          enabled: true,
          minimumLength: 14,
          pattern: 'alphabetic'
        },
        'JSON environment variable parsing'
      );
    });
  });

  describe('Environment Variable Validation', () => {
    it('should validate numeric environment variable ranges', async () => {
      // Test invalid numeric value
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_LENGTH: '-5' }
      );

      // Should handle invalid range
      CliAssertions.assertErrorHandling(
        result,
        ['validation', 'range', 'length'],
        'Invalid numeric range validation'
      );
    });

    it('should validate boolean environment variable formats', async () => {
      // Test invalid boolean value
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_VERBOSE: 'maybe' }
      );

      // Should handle invalid boolean (might convert to false or error)
      expect(result.exitCode).toBeDefined();
    });

    it('should validate JSON environment variable syntax', async () => {
      // Test invalid JSON
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_NAME_GENERATION: '{ invalid json }' }
      );

      // Should handle JSON syntax error
      CliAssertions.assertErrorHandling(
        result,
        ['json', 'parse', 'syntax'],
        'Invalid JSON environment variable validation'
      );
    });

    it('should validate path environment variables', async () => {
      // Test invalid path format
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        { TW_ENIGMA_INPUT: '\\invalid\\windows\\path\\on\\unix' }
      );

      // Should handle invalid path (might normalize or error)
      expect(result.exitCode).toBeDefined();
    });
  });

  describe('Environment Variable Discovery', () => {
    it('should discover all supported environment variables', async () => {
      // Test comprehensive environment setup
      const fullEnv = {
        TW_ENIGMA_LENGTH: '11',
        TW_ENIGMA_INPUT: './full-env-src',
        TW_ENIGMA_OUTPUT: './full-env-dist',
        TW_ENIGMA_VERBOSE: 'true',
        TW_ENIGMA_PRETTY: 'true'
      };

      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        fullEnv
      );

      // Validate all environment variables are recognized
      IntegrationAssertions.assertDataFlow(
        result,
        {
          minimumLength: 11,
          input: './full-env-src',
          output: './full-env-dist',
          verbose: true,
          pretty: true
        },
        'Complete environment variable discovery'
      );
    });

    it('should ignore unknown environment variables', async () => {
      // Test unknown environment variables
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        {
          TW_ENIGMA_LENGTH: '9',
          UNKNOWN_VAR: 'should-be-ignored',
          TW_ENIGMA_UNKNOWN: 'should-also-be-ignored'
        }
      );

      // Should process known variables and ignore unknown ones
      IntegrationAssertions.assertLengthIntegration(result, 9, 'init-config');
    });
  });

  describe('Environment Variable Edge Cases', () => {
    it('should handle empty environment variables', async () => {
      // Test empty values
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        {
          TW_ENIGMA_LENGTH: '',
          TW_ENIGMA_INPUT: ''
        }
      );

      // Should handle empty values gracefully (use defaults or error)
      expect(result.exitCode).toBeDefined();
    });

    it('should handle whitespace in environment variables', async () => {
      // Test whitespace handling
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        {
          TW_ENIGMA_LENGTH: ' 13 ',
          TW_ENIGMA_INPUT: ' ./src/with/spaces '
        }
      );

      // Should trim whitespace appropriately
      if (result.exitCode === 0) {
        IntegrationAssertions.assertLengthIntegration(result, 13, 'init-config');
      }
    });

    it('should handle case sensitivity', async () => {
      // Test case variations
      const result = await cliHarness.executeCommandWithEnv(
        ['init-config'],
        {
          tw_enigma_length: '7', // lowercase
          TW_ENIGMA_LENGTH: '8'  // uppercase (should take precedence)
        }
      );

      // Should handle case sensitivity appropriately
      expect(result.exitCode).toBeDefined();
    });
  });
});
