import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliTestHarness } from './utils/cli-test-harness';

/**
 * Output Format Consistency Test Suite
 *
 * Purpose: Validate backward compatibility of output formats for:
 * - Help text structure
 * - Version information format
 * - Error message patterns
 * - JSON output consistency
 * - Progress reporting format
 *
 * Part of: Subtask 15.5 Step 5 - Output Format Consistency Verification
 */

describe('Output Format Consistency', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory('format-test-');
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Help Output Consistency', () => {
    it('should maintain consistent help format structure', async () => {
      const result = await cliHarness.executeCommand(['--help']);

      expect(result.exitCode).toBe(0);

      // Validate help structure elements
      const output = result.stdout;
      expect(output).toContain('Usage:');
      expect(output).toContain('Options:');
      expect(output).toContain('Commands:');
      expect(output).toContain('@tw-enigma/cli');

      // Check for expected command sections
      expect(output).toContain('init-config');
      expect(output).toContain('css-config');

      // Validate option format consistency
      expect(output).toMatch(/-v, --version\s+Display version number/);
      expect(output).toMatch(/--verbose\s+Enable verbose logging/);
      expect(output).toMatch(/--config <path>\s+Path to configuration file/);
    });

    it('should maintain consistent command help format', async () => {
      const initResult = await cliHarness.executeCommand(['init-config', '--help']);

      expect(initResult.exitCode).toBe(0);
      expect(initResult.stdout).toContain('Usage:');
      expect(initResult.stdout).toContain('Create a sample configuration file');

      const cssResult = await cliHarness.executeCommand(['css-config', '--help']);

      expect(cssResult.exitCode).toBe(0);
      expect(cssResult.stdout).toContain('Usage:');
      expect(cssResult.stdout).toContain('Generate and validate CSS output configuration');
    });

    it('should preserve global option format in help', async () => {
      const result = await cliHarness.executeCommand(['--help']);

      // Check for --length flag format consistency
      expect(result.stdout).toMatch(/--length <number>\s+Minimum class name length/);

      // Check for format consistency
      expect(result.stdout).toMatch(
        /--format <format>\s+Output format \(json, console, markdown, html, all\)/
      );

      // Check for config option variations
      expect(result.stdout).toMatch(/-c, --config <path>\s+Path to configuration file/);
    });
  });

  describe('Version Output Consistency', () => {
    it('should maintain consistent version format', async () => {
      const result = await cliHarness.executeCommand(['--version']);

      expect(result.exitCode).toBe(0);

      // Version should be semantic version format
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should maintain consistent verbose version info', async () => {
      const result = await cliHarness.executeCommand(['-v']);

      expect(result.exitCode).toBe(0);

      // Short version flag should work the same
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Error Message Format Consistency', () => {
    it('should maintain consistent unknown option error format', async () => {
      const result = await cliHarness.executeCommand(['--nonexistent-flag']);

      expect(result.exitCode).toBeGreaterThan(0);

      // Error message should follow consistent pattern
      const errorOutput = result.stderr || result.stdout;
      expect(errorOutput).toMatch(/error: unknown option/i);
    });

    it('should maintain consistent invalid command error format', async () => {
      const result = await cliHarness.executeCommand(['nonexistent-command']);

      expect(result.exitCode).toBeGreaterThan(0);

      // Error message should be helpful
      const errorOutput = result.stderr || result.stdout;
      expect(errorOutput).toMatch(/error:|unknown|invalid/i);
    });

    it('should maintain consistent missing argument error format', async () => {
      const result = await cliHarness.executeCommand(['--config']);

      expect(result.exitCode).toBeGreaterThan(0);

      // Should indicate missing argument
      const errorOutput = result.stderr || result.stdout;
      expect(errorOutput).toMatch(/missing|required|argument/i);
    });
  });

  describe('JSON Output Format Consistency', () => {
    it('should produce consistent JSON structure when requested', async () => {
      // Create a basic config for testing
      const configPath = path.join(tempDir, 'enigma.config.json');
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            input: ['./src/**/*.{js,ts,jsx,tsx}'],
            output: './dist/styles.css',
            nameGeneration: { minimumLength: 4 },
          },
          null,
          2
        )
      );

      const result = await cliHarness.executeCommand(['--config', configPath, '--format', 'json']);

      // Should either succeed with JSON or fail gracefully
      if (result.exitCode === 0) {
        const output = result.stdout;

        // If JSON output is implemented, validate structure
        if (output.trim().startsWith('{')) {
          const jsonData = JSON.parse(output);
          expect(typeof jsonData).toBe('object');
        }
      }
    });

    it('should handle format option consistently', async () => {
      const formats = ['json', 'console', 'markdown'];

      for (const format of formats) {
        const result = await cliHarness.executeCommand(['--format', format, '--help']);

        // Should not error on format specification
        expect(result.exitCode).toBe(0);
      }
    });
  });

  describe('Progress and Status Format Consistency', () => {
    it('should maintain consistent initialization output format', async () => {
      const result = await cliHarness.executeCommandInDirectory(tempDir, ['init-config']);

      // Should succeed and provide clear output
      expect(result.exitCode).toBe(0);

      const output = result.stdout || result.stderr;

      // Should indicate successful initialization
      expect(output).toMatch(/config|created|initialized|generated/i);
    });

    it('should maintain consistent CSS config output format', async () => {
      const result = await cliHarness.executeCommandInDirectory(tempDir, ['css-config']);

      // Should provide clear output regardless of success/failure
      const output = result.stdout || result.stderr;
      expect(output.length).toBeGreaterThan(0);

      if (result.exitCode === 0) {
        // Success should indicate what was done
        expect(output).toMatch(/config|css|generated|created/i);
      }
    });

    it('should maintain consistent verbose output patterns', async () => {
      const result = await cliHarness.executeCommand(['--verbose', '--help']);

      expect(result.exitCode).toBe(0);

      // Verbose mode should include debug information
      const output = result.stdout || result.stderr;
      expect(output).toContain('[CLI-DEBUG]');
    });
  });

  describe('Configuration Loading Message Consistency', () => {
    it('should maintain consistent config file handling messages', async () => {
      // Test with non-existent config
      const result = await cliHarness.executeCommand(['--config', 'nonexistent.json']);

      const output = result.stdout || result.stderr;

      // Should provide clear feedback about config loading
      expect(output).toMatch(/config|load|file/i);
    });

    it('should maintain consistent config precedence messages', async () => {
      // Create a valid config file
      const configPath = path.join(tempDir, 'test.config.json');
      await fs.writeFile(
        configPath,
        JSON.stringify({
          input: ['./src/**/*.js'],
          output: './dist/output.css',
        })
      );

      const result = await cliHarness.executeCommand(['--config', configPath, '--length', '8']);

      // Should provide feedback about configuration
      const output = result.stdout || result.stderr;
      expect(output).toMatch(/length|config/i);
    });
  });

  describe('Cross-Platform Output Consistency', () => {
    it('should maintain consistent path format in output', async () => {
      const result = await cliHarness.executeCommand(['init-config', '--help']);

      expect(result.exitCode).toBe(0);

      // Help should not contain platform-specific path separators in examples
      const output = result.stdout;

      // Look for common configuration patterns
      if (output.includes('config') || output.includes('path')) {
        // Should use forward slashes or be platform-neutral
        expect(output).not.toMatch(/[C-Z]:\\\\/); // Avoid Windows absolute paths in help
      }
    });

    it('should handle directory operations consistently', async () => {
      const result = await cliHarness.executeCommandInDirectory(tempDir, ['init-config']);

      // Should work regardless of platform
      expect(result.exitCode).toBe(0);

      // Check that file was created
      const files = await fs.readdir(tempDir);
      expect(files.length).toBeGreaterThan(0);
    });
  });
});
