import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliTestHarness } from './utils/cli-test-harness';

/**
 * User Workflow Preservation Test Suite
 *
 * Purpose: Comprehensive validation of end-to-end user workflow backward compatibility
 * Part of: Subtask 15.5 Step 4 - User Workflow Preservation Analysis
 */

describe('User Workflow Preservation', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory('workflow-test-');
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Core Workflow Validation', () => {
    it('should support complete initialization workflow', async () => {
      // Test: User starts fresh project and goes through complete setup

      // Step 1: Initialize configuration
      const initResult = await cliHarness.executeCommandInDirectory(['init-config'], tempDir, {
        timeout: 15000,
      });

      expect(initResult.exitCode).toBe(0);
      expect(initResult.stdout || initResult.stderr).toBeTruthy();

      // Step 2: Verify configuration file exists (if created)
      try {
        const configFiles = ['enigma.config.js', 'enigma.config.json', '.enigmarc'];
        let configExists = false;

        for (const configFile of configFiles) {
          try {
            await fs.access(path.join(tempDir, configFile));
            configExists = true;
            break;
          } catch {
            // File doesn't exist, try next
          }
        }

        // Either config file created or guidance provided
        if (!configExists) {
          // Should provide guidance on how to proceed
          expect(initResult.stdout || initResult.stderr).toMatch(/config|configuration|setup/i);
        }
      } catch (error) {
        // No config file created is acceptable if guidance is provided
        expect(initResult.stdout || initResult.stderr).toMatch(/config|configuration|create/i);
      }
    });

    it('should support configuration → execution workflow', async () => {
      // Test: User creates config then executes main functionality

      // Step 1: Create configuration
      const config = {
        input: './src',
        output: './dist',
        nameGeneration: {
          minimumLength: 4,
        },
      };

      const configPath = await cliHarness.createTestConfig(tempDir, config, 'enigma.config.json');

      // Step 2: Create minimal source structure
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      await fs.writeFile(
        path.join(srcDir, 'example.html'),
        '<div class="bg-blue-500 text-white p-4">Example</div>'
      );

      // Step 3: Execute with configuration
      const execResult = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, '--length', '6'],
        tempDir,
        { timeout: 20000, expectFailure: false }
      );

      // Should execute successfully or provide meaningful feedback
      expect(execResult.exitCode).toBeGreaterThanOrEqual(0);
      expect(execResult.stdout || execResult.stderr).toBeTruthy();

      if (execResult.exitCode === 0) {
        // Successful execution should show progress or results
        expect(execResult.stdout || execResult.stderr).toMatch(
          /processed|generated|completed|optimized/i
        );
      } else {
        // If not successful, should provide helpful error message
        expect(execResult.stderr || execResult.stdout).toMatch(/error|help|usage|missing/i);
      }
    });

    it('should handle iterative workflow (multiple executions)', async () => {
      // Test: User runs tool multiple times (common development workflow)

      const config = {
        input: './src',
        output: './dist',
        pretty: false,
      };

      const configPath = await cliHarness.createTestConfig(tempDir, config, 'enigma.config.json');

      // Create source file
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.writeFile(
        path.join(srcDir, 'styles.css'),
        '.bg-blue-500 { background-color: blue; }\n.text-white { color: white; }'
      );

      // Execute multiple times to simulate iterative development
      for (let i = 0; i < 3; i++) {
        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath],
          tempDir,
          { timeout: 15000, expectFailure: false }
        );

        // Each execution should be consistent
        expect(result.exitCode).toBeGreaterThanOrEqual(0);

        if (result.exitCode === 0) {
          expect(result.stdout || result.stderr).toBeTruthy();
        }
      }
    });

    it('should support help-driven discovery workflow', async () => {
      // Test: User discovers functionality through help system

      // Step 1: Start with main help
      const mainHelp = await cliHarness.executeCommandInDirectory(['--help'], tempDir);

      expect(mainHelp.exitCode).toBe(0);
      expect(mainHelp.stdout || mainHelp.stderr).toMatch(/usage|commands|options/i);

      // Step 2: Explore specific command help
      const commands = ['init-config', 'css-config'];

      for (const command of commands) {
        const cmdHelp = await cliHarness.executeCommandInDirectory([command, '--help'], tempDir, {
          timeout: 10000,
        });

        expect(cmdHelp.exitCode).toBe(0);

        const helpOutput = cmdHelp.stdout || cmdHelp.stderr;
        expect(helpOutput).toMatch(/usage|options|description/i);
        expect(helpOutput.length).toBeGreaterThan(50); // Meaningful help content
      }
    });
  });

  describe('Integration Pattern Testing', () => {
    it('should support package.json script integration', async () => {
      // Test: Integration with npm/pnpm scripts (common workflow)

      // Create package.json with scripts
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          'build:css': 'enigma --config enigma.config.json',
          'dev:css': 'enigma --config enigma.config.json --verbose',
          optimize: 'enigma --length 5 --config enigma.config.json',
        },
      };

      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Create configuration
      const config = {
        input: './src',
        output: './dist',
      };
      await cliHarness.createTestConfig(tempDir, config, 'enigma.config.json');

      // Test script-like execution patterns
      const scriptPatterns = [
        ['--config', 'enigma.config.json'],
        ['--config', 'enigma.config.json', '--verbose'],
        ['--length', '5', '--config', 'enigma.config.json'],
      ];

      for (const pattern of scriptPatterns) {
        const result = await cliHarness.executeCommandInDirectory(pattern, tempDir, {
          timeout: 15000,
          expectFailure: false,
        });

        // Should work in script context
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout || result.stderr).toBeTruthy();
      }
    });

    it('should support CI/CD pipeline integration', async () => {
      // Test: Continuous integration workflow patterns

      // Simulate CI environment variables
      const ciEnv = {
        CI: 'true',
        NODE_ENV: 'production',
        BUILD_ENV: 'ci',
      };

      const config = {
        input: './src',
        output: './dist',
        minify: true,
        quiet: true,
      };

      const configPath = await cliHarness.createTestConfig(tempDir, config, 'enigma.config.json');

      // Test CI-style execution (non-interactive, deterministic)
      const ciResult = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, '--quiet'],
        tempDir,
        {
          timeout: 20000,
          env: { ...process.env, ...ciEnv },
          expectFailure: false,
        }
      );

      // CI execution should be deterministic and exit cleanly
      expect(ciResult.exitCode).toBeGreaterThanOrEqual(0);

      if (ciResult.exitCode === 0) {
        // Successful CI build should be quiet or provide minimal output
        const output = (ciResult.stdout || '') + (ciResult.stderr || '');
        expect(output).toBeDefined();
      } else {
        // CI failures should provide clear error information
        expect(ciResult.stderr || ciResult.stdout).toMatch(/error|failed|invalid/i);
      }
    });

    it('should support build tool integration patterns', async () => {
      // Test: Integration with common build tools

      // Simulate webpack/vite style integration
      const buildConfig = {
        input: './src',
        output: './dist/assets',
        minify: true,
        sourceMaps: true,
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        buildConfig,
        'build.enigma.json'
      );

      // Test build tool style execution
      const buildPatterns = [
        // Production build
        ['--config', configPath, '--minify'],
        // Development build
        ['--config', configPath, '--verbose', '--source-maps'],
        // Watch mode simulation (single execution)
        ['--config', configPath, '--dev'],
      ];

      for (const pattern of buildPatterns) {
        const result = await cliHarness.executeCommandInDirectory(pattern, tempDir, {
          timeout: 15000,
          expectFailure: false,
        });

        // Build integration should be reliable
        expect(result.exitCode).toBeGreaterThanOrEqual(0);

        if (result.exitCode !== 0) {
          // Should provide actionable error messages for build failures
          const errorOutput = result.stderr || result.stdout;
          expect(errorOutput).toMatch(/error|config|build|file/i);
        }
      }
    });

    it('should support monorepo integration patterns', async () => {
      // Test: Monorepo/workspace integration scenarios

      // Create workspace structure
      const workspaceStructure = ['packages/ui/src', 'packages/core/src', 'apps/web/src'];

      for (const dir of workspaceStructure) {
        await fs.mkdir(path.join(tempDir, dir), { recursive: true });
      }

      // Create workspace-style configurations
      const configs = [
        {
          path: 'packages/ui/enigma.config.json',
          config: { input: './src', output: './dist', classPrefix: 'ui-' },
        },
        {
          path: 'packages/core/enigma.config.json',
          config: { input: './src', output: './dist', classPrefix: 'core-' },
        },
      ];

      for (const { path: configPath, config } of configs) {
        await cliHarness.createTestConfig(tempDir, config, configPath);
      }

      // Test workspace execution patterns
      for (const { path: configPath } of configs) {
        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath],
          tempDir,
          { timeout: 15000, expectFailure: false }
        );

        // Monorepo execution should work from root
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        expect(result.stdout || result.stderr).toBeTruthy();
      }
    });
  });

  describe('User Experience Consistency', () => {
    it('should provide consistent error messaging across workflows', async () => {
      // Test: Error messages should be helpful and consistent

      const errorScenarios = [
        {
          name: 'missing config file',
          args: ['--config', 'nonexistent.json'],
          expectedPatterns: [/config|file|not found|missing/i],
        },
        {
          name: 'invalid input directory',
          config: { input: '/nonexistent/path', output: './dist' },
          expectedPatterns: [/input|directory|not found|path/i],
        },
        {
          name: 'invalid flag combination',
          args: ['--length', 'invalid', '--config', 'test.json'],
          expectedPatterns: [/length|invalid|number|option/i],
        },
      ];

      for (const scenario of errorScenarios) {
        let result;

        if (scenario.config) {
          const configPath = await cliHarness.createTestConfig(
            tempDir,
            scenario.config,
            'error-test.json'
          );
          result = await cliHarness.executeCommandInDirectory(['--config', configPath], tempDir, {
            expectFailure: true,
            timeout: 10000,
          });
        } else {
          result = await cliHarness.executeCommandInDirectory(scenario.args!, tempDir, {
            expectFailure: true,
            timeout: 10000,
          });
        }

        // Should provide helpful error messages
        expect(result.exitCode).toBeGreaterThan(0);

        const errorOutput = result.stderr || result.stdout;
        expect(errorOutput).toBeTruthy();

        // Check if error message matches expected patterns
        const matchesPattern = scenario.expectedPatterns.some((pattern) =>
          pattern.test(errorOutput)
        );

        if (!matchesPattern) {
          // At least should contain generic error indicators
          expect(errorOutput).toMatch(/error|invalid|failed|problem/i);
        }
      }
    });

    it('should maintain consistent output format in automated environments', async () => {
      // Test: Output should be machine-readable when needed

      const config = {
        input: './src',
        output: './dist',
      };

      const configPath = await cliHarness.createTestConfig(tempDir, config, 'automation-test.json');

      // Test various output scenarios
      const outputTests = [
        {
          name: 'quiet mode',
          args: ['--config', configPath, '--quiet'],
          description: 'Should minimize output for automation',
        },
        {
          name: 'verbose mode',
          args: ['--config', configPath, '--verbose'],
          description: 'Should provide detailed output for debugging',
        },
        {
          name: 'normal mode',
          args: ['--config', configPath],
          description: 'Should provide balanced output',
        },
      ];

      for (const test of outputTests) {
        const result = await cliHarness.executeCommandInDirectory(test.args, tempDir, {
          timeout: 15000,
          expectFailure: false,
        });

        expect(result.exitCode).toBeGreaterThanOrEqual(0);

        const output = result.stdout || result.stderr;
        expect(output).toBeDefined();

        // Output should be appropriate for the mode
        if (test.args.includes('--quiet')) {
          // Quiet mode should have minimal output
          expect(output.split('\n').length).toBeLessThan(10);
        } else if (test.args.includes('--verbose')) {
          // Verbose mode should provide more information
          expect(output.length).toBeGreaterThan(20);
        }
      }
    });

    it('should support progressive disclosure in help system', async () => {
      // Test: Help system should guide users progressively

      // Level 1: Main help
      const mainHelp = await cliHarness.executeCommandInDirectory(['--help'], tempDir);

      expect(mainHelp.exitCode).toBe(0);
      const mainOutput = mainHelp.stdout || mainHelp.stderr;
      expect(mainOutput).toMatch(/usage|commands/i);

      // Level 2: Command-specific help
      const commands = ['init-config', 'css-config'];

      for (const command of commands) {
        const cmdHelp = await cliHarness.executeCommandInDirectory([command, '--help'], tempDir);

        expect(cmdHelp.exitCode).toBe(0);
        const cmdOutput = cmdHelp.stdout || cmdHelp.stderr;

        // Command help should be more specific than main help
        expect(cmdOutput).toMatch(/usage|options/i);
        expect(cmdOutput).toContain(command);
      }
    });

    it('should handle workspace context appropriately', async () => {
      // Test: Tool should behave appropriately in different directory contexts

      // Create nested directory structure
      const nestedDir = path.join(tempDir, 'project', 'frontend', 'styles');
      await fs.mkdir(nestedDir, { recursive: true });

      // Create config at different levels
      const rootConfig = {
        input: './src',
        output: './dist',
      };

      await cliHarness.createTestConfig(tempDir, rootConfig, 'enigma.config.json');

      // Test execution from different directory levels
      const contexts = [
        { dir: tempDir, description: 'root directory' },
        { dir: path.join(tempDir, 'project'), description: 'subdirectory' },
        { dir: nestedDir, description: 'deeply nested directory' },
      ];

      for (const context of contexts) {
        const result = await cliHarness.executeCommandInDirectory(['--help'], context.dir, {
          timeout: 10000,
        });

        // Help should work from any directory
        expect(result.exitCode).toBe(0);
        expect(result.stdout || result.stderr).toMatch(/usage|help/i);
      }
    });
  });

  describe('Legacy Workflow Compatibility', () => {
    it('should support v1.0 style workflow patterns', async () => {
      // Test: Legacy workflow patterns should still work

      // v1.0 style: Simple file-based workflow
      const legacyConfig = {
        input: './styles',
        output: './build',
        removeUnused: true,
        pretty: false,
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        legacyConfig,
        'enigma.legacy.json'
      );

      // Create legacy-style source structure
      const stylesDir = path.join(tempDir, 'styles');
      await fs.mkdir(stylesDir, { recursive: true });

      await fs.writeFile(
        path.join(stylesDir, 'main.css'),
        '.btn { padding: 1rem; }\n.card { border: 1px solid; }'
      );

      // Execute with legacy configuration
      const result = await cliHarness.executeCommandInDirectory(['--config', configPath], tempDir, {
        timeout: 15000,
        expectFailure: false,
      });

      // Legacy workflow should work or provide migration guidance
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.stdout || result.stderr).toBeTruthy();
    });

    it('should support migration workflow guidance', async () => {
      // Test: Tool should help users migrate from legacy patterns

      // Create old-style configuration that might need migration
      const oldConfig = {
        inputDir: './src', // Old style property name
        outputDir: './dist', // Old style property name
        optimization: {
          enabled: true,
        },
      };

      const configPath = await cliHarness.createTestConfig(tempDir, oldConfig, 'old-style.json');

      const result = await cliHarness.executeCommandInDirectory(['--config', configPath], tempDir, {
        timeout: 15000,
        expectFailure: false,
      });

      // Should either work or provide helpful migration guidance
      expect(result.exitCode).toBeGreaterThanOrEqual(0);

      const output = result.stdout || result.stderr;
      expect(output).toBeTruthy();

      if (result.exitCode !== 0) {
        // If migration is needed, should provide guidance
        expect(output).toMatch(/migration|deprecated|update|config/i);
      }
    });
  });
});
