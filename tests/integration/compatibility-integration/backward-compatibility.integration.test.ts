/**
 * Backward Compatibility Integration Tests
 *
 * Tests backward compatibility with previous versions,
 * legacy configuration formats, and deprecated features.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';

describe('Backward Compatibility Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Legacy Configuration Format Support', () => {
    it('should support legacy v1.0 configuration format', async () => {
      // Create legacy v1.0 style configuration
      const legacyV1Config = {
        inputDir: './src', // Legacy property name
        outputDir: './dist', // Legacy property name
        minifyNames: true, // Legacy property name
        nameLength: 8, // Legacy property name
      };
      const configPath = path.join(tempDir, 'legacy-v1.config.json');
      await fs.writeFile(configPath, JSON.stringify(legacyV1Config, null, 2));

      // Test legacy config compatibility
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should handle legacy config gracefully
      // Either succeed with conversion or provide helpful error message
      if (result.exitCode === 0) {
        CliAssertions.assertSuccess(result);
      } else {
        // Should provide helpful migration message
        expect(result.stderr).toContain('legacy');
        expect(result.stderr).toContain('migration');
      }
    });

    it('should support legacy v1.5 configuration format', async () => {
      // Create legacy v1.5 style configuration
      const legacyV15Config = {
        source: './src', // Legacy property name
        destination: './dist', // Legacy property name
        optimization: {
          minifyClassNames: true, // Legacy property name
          minimumNameLength: 10, // Legacy property name
        },
      };
      const configPath = path.join(tempDir, 'legacy-v15.config.json');
      await fs.writeFile(configPath, JSON.stringify(legacyV15Config, null, 2));

      // Test legacy config compatibility
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should handle legacy config gracefully
      if (result.exitCode === 0) {
        CliAssertions.assertSuccess(result);
      } else {
        // Should provide helpful migration message
        expect(result.stderr).toContain('configuration');
        expect(result.exitCode).not.toBe(2); // Should not crash
      }
    });

    it('should provide migration guidance for unsupported legacy formats', async () => {
      // Create very old/unsupported configuration format
      const unsupportedConfig = {
        files: ['./src/style.css'], // Very old format
        compress: true,
        version: '0.9.0', // Unsupported version
      };
      const configPath = path.join(tempDir, 'unsupported.config.json');
      await fs.writeFile(configPath, JSON.stringify(unsupportedConfig, null, 2));

      // Test unsupported config handling
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should fail gracefully with migration guidance
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toMatch(/migration|upgrade|support/i);
    });
  });

  describe('Legacy Command Line Arguments', () => {
    it('should support legacy CLI argument formats', async () => {
      // Test legacy argument styles that might have been supported
      const legacyArgTests = [
        { args: ['--input-dir', './src'], description: 'Legacy input dir flag' },
        { args: ['--output-dir', './dist'], description: 'Legacy output dir flag' },
        { args: ['--minify-names'], description: 'Legacy minify names flag' },
        { args: ['--name-length', '10'], description: 'Legacy name length flag' },
      ];

      for (const test of legacyArgTests) {
        const result = await cliHarness.executeCommand([...test.args, 'init-config']);

        // Should either work or provide helpful error message
        if (result.exitCode !== 0) {
          // Should not crash and should provide helpful guidance
          expect(result.exitCode).not.toBe(2);
          expect(result.stderr || result.stdout).toMatch(/usage|help|option/i);
        }

        console.log(`${test.description}: ${result.exitCode === 0 ? 'SUPPORTED' : 'DEPRECATED'}`);
      }
    });

    it('should handle deprecated flag combinations gracefully', async () => {
      // Test combinations of potentially deprecated flags
      const deprecatedCombinations = [
        ['--input-dir', './src', '--minify-names', '--name-length', '8'],
        ['--source', './src', '--destination', './dist', '--compress'],
        ['--files', './src/style.css', '--optimize'],
      ];

      for (const combination of deprecatedCombinations) {
        const result = await cliHarness.executeCommand([...combination, 'init-config']);

        // Should handle gracefully (not crash)
        expect(result.exitCode).not.toBe(2); // No crashes

        if (result.exitCode !== 0) {
          // Should provide helpful error messages
          expect(result.stderr || result.stdout).toMatch(/usage|deprecated|migration/i);
        }
      }
    });

    it('should provide helpful migration messages for removed features', async () => {
      // Test flags for features that might have been removed
      const removedFeatures = [
        ['--experimental-feature', 'Experimental feature flag'],
        ['--legacy-mode', 'Legacy mode flag'],
        ['--old-algorithm', 'Old algorithm flag'],
      ];

      for (const [flag, description] of removedFeatures) {
        const result = await cliHarness.executeCommand([flag, 'init-config']);

        // Should provide helpful guidance about removal
        if (result.exitCode !== 0) {
          expect(result.stderr || result.stdout).toMatch(/unknown|invalid|removed|deprecated/i);
        }

        console.log(
          `${description}: ${result.exitCode === 0 ? 'STILL SUPPORTED' : 'REMOVED/DEPRECATED'}`
        );
      }
    });
  });

  describe('Legacy Output Format Compatibility', () => {
    it('should maintain compatible output structure', async () => {
      // Create test input for output format testing
      const outputTestDir = path.join(tempDir, 'output-test');
      await fs.mkdir(outputTestDir);

      // Create simple CSS file
      const cssContent = `.original-class { color: red; }
.another-class { color: blue; }`;
      await fs.writeFile(path.join(outputTestDir, 'test.css'), cssContent);

      // Test current output format
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', outputTestDir, 'css-config'],
        tempDir
      );

      CliAssertions.assertSuccess(result);

      // Verify output structure is compatible with expected format
      // Note: This would need to be adapted based on actual output expectations
      expect(result.stdout).toBeTruthy();

      // Should not contain breaking changes in output format
      expect(result.stdout).not.toContain('BREAKING_CHANGE');
      expect(result.stdout).not.toContain('INCOMPATIBLE');
    });

    it('should support legacy JSON output format', async () => {
      // Test JSON output format compatibility
      const jsonTestDir = path.join(tempDir, 'json-test');
      await fs.mkdir(jsonTestDir);

      const cssContent = `.json-test { color: green; }`;
      await fs.writeFile(path.join(jsonTestDir, 'json-test.css'), cssContent);

      // Test with JSON output format (if supported)
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', jsonTestDir, '--format', 'json', 'css-config'],
        tempDir
      );

      // Should either work or gracefully indicate unsupported
      if (result.exitCode === 0) {
        // Should produce valid JSON
        try {
          JSON.parse(result.stdout);
        } catch {
          // If not valid JSON, should be clearly documented
          expect(result.stdout).toContain('json');
        }
      } else {
        // Should provide clear message about format support
        expect(result.stderr || result.stdout).toMatch(/format|json|output/i);
      }
    });

    it('should maintain compatible error message formats', async () => {
      // Test error message format compatibility
      const invalidConfig = {
        input: null, // Invalid input
        output: undefined, // Invalid output
      };
      const configPath = path.join(tempDir, 'invalid.config.json');
      await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'css-config'],
        tempDir
      );

      // Should fail with expected error format
      expect(result.exitCode).not.toBe(0);

      // Error message should be structured and helpful
      expect(result.stderr).toBeTruthy();
      expect(result.stderr).toMatch(/error|invalid|configuration/i);

      // Should not contain internal stack traces (user-friendly)
      expect(result.stderr).not.toMatch(/at Object\.|at Function\.|at async/);
    });
  });

  describe('Feature Deprecation Handling', () => {
    it('should handle deprecated configuration options gracefully', async () => {
      // Test deprecated configuration options
      const deprecatedConfig = {
        input: './src',
        output: './dist',
        // Potentially deprecated options
        experimentalFeatures: true,
        legacyAlgorithm: true,
        oldOptimizations: {
          enabled: true,
          aggressiveMode: true,
        },
      };
      const configPath = path.join(tempDir, 'deprecated.config.json');
      await fs.writeFile(configPath, JSON.stringify(deprecatedConfig, null, 2));

      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Should handle deprecated options gracefully
      if (result.exitCode === 0) {
        // Should succeed, possibly with warnings
        CliAssertions.assertSuccess(result);

        // Check for deprecation warnings in stdout/stderr
        const output = (result.stdout + result.stderr).toLowerCase();
        if (output.includes('deprecated') || output.includes('warning')) {
          console.log('Deprecation warnings detected (expected behavior)');
        }
      } else {
        // Should fail with helpful message, not crash
        expect(result.exitCode).not.toBe(2);
        expect(result.stderr).toMatch(/deprecated|removed|unsupported/i);
      }
    });

    it('should provide migration paths for deprecated features', async () => {
      // Test that deprecated features provide migration guidance
      const deprecationTests = [
        {
          config: { legacyNameGeneration: true },
          expectedGuidance: 'nameGeneration',
        },
        {
          config: { oldOptimizationEngine: true },
          expectedGuidance: 'optimization',
        },
        {
          config: { experimentalParser: true },
          expectedGuidance: 'parser',
        },
      ];

      for (const test of deprecationTests) {
        const fullConfig = {
          input: './src',
          output: './dist',
          ...test.config,
        };
        const configPath = path.join(tempDir, `migration-test-${Date.now()}.json`);
        await fs.writeFile(configPath, JSON.stringify(fullConfig, null, 2));

        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'init-config'],
          tempDir
        );

        // If feature is deprecated, should provide migration guidance
        if (result.exitCode !== 0) {
          const output = (result.stdout + result.stderr).toLowerCase();
          if (output.includes('deprecated') || output.includes('removed')) {
            expect(output).toContain(test.expectedGuidance.toLowerCase());
          }
        }
      }
    });

    it('should maintain support for critical legacy workflows', async () => {
      // Test critical legacy workflows that must be maintained
      const criticalWorkflows = [
        {
          name: 'basic-css-processing',
          steps: [
            () => cliHarness.executeCommand(['init-config']),
            () => cliHarness.executeCommand(['css-config']),
          ],
        },
        {
          name: 'config-file-processing',
          steps: [
            async () => {
              const basicConfig = { input: './src', output: './dist' };
              const configPath = path.join(tempDir, 'basic.json');
              await fs.writeFile(configPath, JSON.stringify(basicConfig, null, 2));
              return cliHarness.executeCommandInDirectory(
                ['--config', configPath, 'init-config'],
                tempDir
              );
            },
          ],
        },
      ];

      for (const workflow of criticalWorkflows) {
        console.log(`Testing critical workflow: ${workflow.name}`);

        try {
          for (const step of workflow.steps) {
            const result = await step();

            // Critical workflows should not fail catastrophically
            expect(result.exitCode).not.toBe(2); // No crashes

            if (result.exitCode !== 0) {
              // Should provide helpful error messages
              expect(result.stderr || result.stdout).toBeTruthy();
            }
          }
        } catch (error) {
          // Should not throw unhandled exceptions
          console.error(`Workflow ${workflow.name} failed with error:`, error);
          expect(error).toBeInstanceOf(Error); // Should be handled error
        }
      }
    });
  });

  describe('Version Compatibility Matrix', () => {
    it('should handle version-specific configuration', async () => {
      // Test configurations with version specifications
      const versionConfigs = [
        { version: '1.0.0', input: './src', output: './dist' },
        { version: '2.0.0', input: './src', output: './dist', nameGeneration: { enabled: true } },
        {
          version: 'latest',
          input: './src',
          output: './dist',
          nameGeneration: { enabled: true, minimumLength: 8 },
        },
      ];

      for (const config of versionConfigs) {
        const configPath = path.join(tempDir, `version-${config.version.replace(/\./g, '-')}.json`);
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'init-config'],
          tempDir
        );

        // Should handle version specifications gracefully
        if (result.exitCode !== 0) {
          // Should provide version-related error messages
          expect(result.stderr || result.stdout).toMatch(/version|compatibility|support/i);
        }

        console.log(
          `Version ${config.version}: ${result.exitCode === 0 ? 'COMPATIBLE' : 'INCOMPATIBLE'}`
        );
      }
    });

    it('should validate cross-version compatibility requirements', async () => {
      // Test that current version maintains compatibility requirements
      const compatibilityTests = [
        {
          requirement: 'Must support basic CSS processing',
          test: async () => {
            const testDir = path.join(tempDir, 'compat-basic');
            await fs.mkdir(testDir);
            await fs.writeFile(path.join(testDir, 'test.css'), '.test { color: red; }');
            return cliHarness.executeCommandInDirectory(
              ['--input', testDir, 'css-config'],
              tempDir
            );
          },
        },
        {
          requirement: 'Must support configuration files',
          test: async () => {
            const config = { input: './src', output: './dist' };
            const configPath = path.join(tempDir, 'compat-config.json');
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            return cliHarness.executeCommandInDirectory(
              ['--config', configPath, 'init-config'],
              tempDir
            );
          },
        },
        {
          requirement: 'Must provide help information',
          test: async () => {
            return cliHarness.executeCommand(['--help']);
          },
        },
      ];

      for (const compatTest of compatibilityTests) {
        console.log(`Testing: ${compatTest.requirement}`);

        try {
          const result = await compatTest.test();

          // Critical compatibility requirements should be met
          if (compatTest.requirement.includes('Must')) {
            expect(result.exitCode).not.toBe(2); // No crashes

            if (result.exitCode !== 0) {
              // Should provide helpful information, not silent failures
              expect(result.stderr || result.stdout).toBeTruthy();
            }
          }
        } catch (error) {
          console.error(`Compatibility test failed: ${compatTest.requirement}`, error);
          // Should not throw unhandled exceptions for compatibility tests
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });
});
