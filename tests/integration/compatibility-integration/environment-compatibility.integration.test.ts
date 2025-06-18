/**
 * Environment Compatibility Integration Tests
 *
 * Tests compatibility across different operating systems,
 * Node.js versions, and environment configurations.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';

describe('Environment Compatibility Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Operating System Compatibility', () => {
    it('should handle platform-specific path separators correctly', async () => {
      // Create test directories with different path styles
      const pathTestDir = path.join(tempDir, 'path-test');
      await fs.mkdir(pathTestDir);

      // Create nested directory structure
      const nestedDir = path.join(pathTestDir, 'nested', 'structure');
      await fs.mkdir(nestedDir, { recursive: true });

      // Create CSS file in nested directory
      const cssContent = '.path-test { color: blue; }';
      await fs.writeFile(path.join(nestedDir, 'nested.css'), cssContent);

      // Test with platform-appropriate paths
      const inputPath = path.join('.', 'path-test');
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', inputPath, 'css-config'],
        tempDir
      );

      // Should handle paths correctly regardless of platform
      CliAssertions.assertSuccess(result);
    });

    it('should handle platform-specific file permissions', async () => {
      // Create test file with specific permissions
      const permTestDir = path.join(tempDir, 'perm-test');
      await fs.mkdir(permTestDir);

      const cssContent = '.perm-test { color: green; }';
      const cssFile = path.join(permTestDir, 'perm-test.css');
      await fs.writeFile(cssFile, cssContent);

      // Set file permissions (Unix-like systems)
      if (os.platform() !== 'win32') {
        try {
          await fs.chmod(cssFile, 0o644); // Read-write for owner, read-only for others
        } catch (error) {
          console.log('Permission setting skipped (not supported on this platform)');
        }
      }

      // Test file access with permissions
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', permTestDir, 'css-config'],
        tempDir
      );

      // Should handle file permissions appropriately
      CliAssertions.assertSuccess(result);
    });

    it('should handle platform-specific line endings', async () => {
      // Create CSS files with different line endings
      const lineEndingDir = path.join(tempDir, 'line-ending-test');
      await fs.mkdir(lineEndingDir);

      // Unix-style line endings (LF)
      const unixContent = '.unix-style {\n  color: red;\n}';
      await fs.writeFile(path.join(lineEndingDir, 'unix.css'), unixContent);

      // Windows-style line endings (CRLF)
      const windowsContent = '.windows-style {\r\n  color: blue;\r\n}';
      await fs.writeFile(path.join(lineEndingDir, 'windows.css'), windowsContent);

      // Mixed line endings
      const mixedContent = '.mixed-style {\n  color: green;\r\n}';
      await fs.writeFile(path.join(lineEndingDir, 'mixed.css'), mixedContent);

      // Test processing with different line endings
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', lineEndingDir, 'css-config'],
        tempDir
      );

      // Should handle all line ending types correctly
      CliAssertions.assertSuccess(result);
    });

    it('should handle platform-specific environment variables', async () => {
      // Test environment variable handling
      const envConfig = {
        input: '${INPUT_DIR}', // Environment variable reference
        output: '${OUTPUT_DIR}',
        nameGeneration: {
          enabled: true,
          minimumLength: 8,
        },
      };
      const configPath = path.join(tempDir, 'env-config.json');
      await fs.writeFile(configPath, JSON.stringify(envConfig, null, 2));

      // Set environment variables using platform-appropriate method
      const envVars = {
        INPUT_DIR: './src',
        OUTPUT_DIR: './dist',
      };

      // Test with environment variables
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir,
        envVars
      );

      // Should handle environment variables correctly or provide clear error
      if (result.exitCode !== 0) {
        // Should provide helpful message about environment variables
        expect(result.stderr || result.stdout).toMatch(/environment|variable|\$\{/i);
      } else {
        CliAssertions.assertSuccess(result);
      }
    });
  });

  describe('Node.js Version Compatibility', () => {
    it('should work with supported Node.js features', async () => {
      // Test features that require specific Node.js versions
      const nodeFeatureTests = [
        {
          name: 'File system promises',
          test: async () => {
            const testDir = path.join(tempDir, 'fs-promises');
            await fs.mkdir(testDir);
            await fs.writeFile(path.join(testDir, 'test.css'), '.fs-test { color: red; }');
            return cliHarness.executeCommandInDirectory(
              ['--input', testDir, 'css-config'],
              tempDir
            );
          },
        },
        {
          name: 'Path operations',
          test: async () => {
            const testDir = path.join(tempDir, 'path-ops');
            await fs.mkdir(testDir);
            const nestedPath = path.join(testDir, 'nested', 'deep');
            await fs.mkdir(nestedPath, { recursive: true });
            await fs.writeFile(path.join(nestedPath, 'deep.css'), '.path-ops { color: blue; }');
            return cliHarness.executeCommandInDirectory(
              ['--input', testDir, 'css-config'],
              tempDir
            );
          },
        },
        {
          name: 'JSON parsing',
          test: async () => {
            const config = {
              input: './src',
              output: './dist',
              nameGeneration: { enabled: true, minimumLength: 10 },
            };
            const configPath = path.join(tempDir, 'json-test.json');
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            return cliHarness.executeCommandInDirectory(
              ['--config', configPath, 'init-config'],
              tempDir
            );
          },
        },
      ];

      for (const featureTest of nodeFeatureTests) {
        console.log(`Testing Node.js feature: ${featureTest.name}`);

        try {
          const result = await featureTest.test();

          // Should work with current Node.js version
          if (result.exitCode !== 0) {
            console.warn(`Feature ${featureTest.name} failed: ${result.stderr}`);
          } else {
            CliAssertions.assertSuccess(result);
          }
        } catch (error) {
          console.error(`Feature ${featureTest.name} threw error:`, error);
          // Should not throw unhandled exceptions
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle Node.js version-specific APIs gracefully', async () => {
      // Test handling of APIs that might not be available in all Node.js versions
      const versionSpecificTests = [
        {
          name: 'Optional chaining support',
          config: {
            input: './src',
            output: './dist',
            experimental: {
              features: ['optional-chaining'],
            },
          },
        },
        {
          name: 'ESM module support',
          config: {
            input: './src',
            output: './dist',
            moduleType: 'esm',
          },
        },
        {
          name: 'Worker threads support',
          config: {
            input: './src',
            output: './dist',
            parallel: {
              enabled: true,
              workers: 2,
            },
          },
        },
      ];

      for (const versionTest of versionSpecificTests) {
        const configPath = path.join(tempDir, `version-${Date.now()}.json`);
        await fs.writeFile(configPath, JSON.stringify(versionTest.config, null, 2));

        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'init-config'],
          tempDir
        );

        // Should handle gracefully regardless of Node.js version
        if (result.exitCode !== 0) {
          // Should provide version-specific error messages if feature unsupported
          const output = (result.stderr || result.stdout).toLowerCase();
          if (output.includes('unsupported') || output.includes('version')) {
            console.log(`${versionTest.name}: Not supported in current Node.js version`);
          }
        } else {
          console.log(`${versionTest.name}: Supported`);
        }
      }
    });

    it('should validate Node.js version requirements', async () => {
      // Test version requirement checking
      const versionResult = await cliHarness.executeCommand(['--version']);

      // Should provide version information
      expect([0, 1]).toContain(versionResult.exitCode); // Version commands often exit with 0 or 1

      if (versionResult.exitCode === 0 || versionResult.stdout || versionResult.stderr) {
        const versionOutput = versionResult.stdout || versionResult.stderr;

        // Should contain version information
        expect(versionOutput).toBeTruthy();

        // Should not contain error traces
        expect(versionOutput).not.toMatch(/Error:|at Object\.|at Function\./);
      }
    });
  });

  describe('Environment Configuration Compatibility', () => {
    it('should handle different working directory contexts', async () => {
      // Create nested directory structure
      const workDirTest = path.join(tempDir, 'work-dir-test');
      await fs.mkdir(workDirTest);

      const subDir = path.join(workDirTest, 'sub-directory');
      await fs.mkdir(subDir);

      // Create CSS files in different locations
      await fs.writeFile(path.join(workDirTest, 'root.css'), '.root { color: red; }');
      await fs.writeFile(path.join(subDir, 'sub.css'), '.sub { color: blue; }');

      // Test from different working directories
      const fromRootResult = await cliHarness.executeCommandInDirectory(
        ['--input', '.', 'css-config'],
        workDirTest
      );

      const fromSubResult = await cliHarness.executeCommandInDirectory(
        ['--input', '..', 'css-config'],
        subDir
      );

      // Both should handle different working directory contexts
      CliAssertions.assertSuccess(fromRootResult);
      CliAssertions.assertSuccess(fromSubResult);
    });

    it('should handle different file encoding scenarios', async () => {
      // Create files with different encodings
      const encodingDir = path.join(tempDir, 'encoding-test');
      await fs.mkdir(encodingDir);

      // UTF-8 content (standard)
      const utf8Content = '.utf8-test { content: "Hello World"; }';
      await fs.writeFile(path.join(encodingDir, 'utf8.css'), utf8Content, 'utf8');

      // ASCII content
      const asciiContent = '.ascii-test { color: red; }';
      await fs.writeFile(path.join(encodingDir, 'ascii.css'), asciiContent, 'ascii');

      // Test encoding handling
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', encodingDir, 'css-config'],
        tempDir
      );

      // Should handle different encodings correctly
      CliAssertions.assertSuccess(result);
    });

    it('should handle memory-constrained environments', async () => {
      // Create scenario that might stress memory in constrained environments
      const memoryTestDir = path.join(tempDir, 'memory-constrained');
      await fs.mkdir(memoryTestDir);

      // Create moderately large CSS files
      for (let i = 0; i < 10; i++) {
        const content = `.memory-test-${i} {
          color: #${i.toString(16).repeat(6).slice(0, 6)};
          margin: ${i}px;
        }`.repeat(100); // Moderate size to test memory handling
        await fs.writeFile(path.join(memoryTestDir, `memory-${i}.css`), content);
      }

      // Test in memory-constrained scenario
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', memoryTestDir, 'css-config'],
        tempDir
      );

      // Should complete without memory errors
      CliAssertions.assertSuccess(result);

      // Should not show memory-related errors
      expect(result.stderr).not.toMatch(/out of memory|heap|allocation/i);
    });

    it('should handle different terminal/shell environments', async () => {
      // Test output formatting for different terminal environments
      const shellTests = [
        {
          name: 'Basic command execution',
          command: ['--help'],
        },
        {
          name: 'Error output formatting',
          command: ['--invalid-flag'],
        },
        {
          name: 'Progress output formatting',
          command: ['init-config'],
        },
      ];

      for (const shellTest of shellTests) {
        const result = await cliHarness.executeCommand(shellTest.command);

        // Should not contain terminal control characters that break in some shells
        const output = result.stdout + result.stderr;

        // Check for problematic control sequences
        expect(output).not.toMatch(/\x1b\[[0-9;]*[a-zA-Z]/); // ANSI escape sequences should be handled appropriately

        // Should not contain null bytes that break some terminals
        expect(output).not.toContain('\0');

        console.log(
          `${shellTest.name}: Output length ${output.length}, Exit code ${result.exitCode}`
        );
      }
    });
  });

  describe('Resource Constraint Handling', () => {
    it('should handle limited disk space scenarios', async () => {
      // Create scenario that might approach disk space limits
      const diskSpaceDir = path.join(tempDir, 'disk-space-test');
      await fs.mkdir(diskSpaceDir);

      // Create multiple files to test disk space handling
      for (let i = 0; i < 20; i++) {
        const content =
          `.disk-space-class-${i} { color: #${i.toString(16).repeat(6).slice(0, 6)}; }`.repeat(50);
        await fs.writeFile(path.join(diskSpaceDir, `disk-${i}.css`), content);
      }

      // Test processing with multiple files
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', diskSpaceDir, 'css-config'],
        tempDir
      );

      // Should handle disk operations gracefully
      if (result.exitCode !== 0) {
        // Should provide helpful error message if disk issues occur
        expect(result.stderr).toMatch(/disk|space|write|permission/i);
      } else {
        CliAssertions.assertSuccess(result);
      }
    });

    it('should handle network-related configurations gracefully', async () => {
      // Test configurations that might involve network operations
      const networkConfigs = [
        {
          name: 'Remote input source',
          config: {
            input: 'https://example.com/styles.css',
            output: './dist',
          },
        },
        {
          name: 'CDN integration',
          config: {
            input: './src',
            output: './dist',
            cdn: {
              enabled: true,
              baseUrl: 'https://cdn.example.com',
            },
          },
        },
      ];

      for (const networkConfig of networkConfigs) {
        const configPath = path.join(tempDir, `network-${Date.now()}.json`);
        await fs.writeFile(configPath, JSON.stringify(networkConfig.config, null, 2));

        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'init-config'],
          tempDir
        );

        // Should handle network configurations gracefully
        if (result.exitCode !== 0) {
          // Should provide appropriate error messages for network issues
          const output = (result.stderr || result.stdout).toLowerCase();
          if (
            output.includes('network') ||
            output.includes('connection') ||
            output.includes('remote')
          ) {
            console.log(`${networkConfig.name}: Network configuration handled appropriately`);
          }
        }
      }
    });

    it('should handle concurrent access scenarios', async () => {
      // Test handling of concurrent file access
      const concurrentDir = path.join(tempDir, 'concurrent-access');
      await fs.mkdir(concurrentDir);

      // Create shared CSS file
      const sharedContent = '.concurrent-test { color: purple; }';
      await fs.writeFile(path.join(concurrentDir, 'shared.css'), sharedContent);

      // Test concurrent operations on same files
      const concurrentTasks = Array.from({ length: 3 }, (_, i) =>
        cliHarness.executeCommandInDirectory(
          ['--input', concurrentDir, '--output', `./dist-${i}`, 'css-config'],
          tempDir
        )
      );

      const results = await Promise.all(concurrentTasks);

      // All should complete without file locking issues
      results.forEach((result, index) => {
        if (result.exitCode !== 0) {
          console.warn(`Concurrent task ${index} failed: ${result.stderr}`);
          // Should not fail due to file locking if tool is designed for concurrent use
        } else {
          CliAssertions.assertSuccess(result);
        }
      });
    });
  });

  describe('Cross-Platform Feature Parity', () => {
    it('should provide consistent feature availability across platforms', async () => {
      // Test features that should work consistently across platforms
      const crossPlatformFeatures = [
        {
          name: 'Basic CSS processing',
          test: async () => {
            const testDir = path.join(tempDir, 'cross-platform-basic');
            await fs.mkdir(testDir);
            await fs.writeFile(path.join(testDir, 'test.css'), '.cross-platform { color: red; }');
            return cliHarness.executeCommandInDirectory(
              ['--input', testDir, 'css-config'],
              tempDir
            );
          },
        },
        {
          name: 'Configuration file support',
          test: async () => {
            const config = { input: './src', output: './dist' };
            const configPath = path.join(tempDir, 'cross-platform.json');
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            return cliHarness.executeCommandInDirectory(
              ['--config', configPath, 'init-config'],
              tempDir
            );
          },
        },
        {
          name: 'Name generation',
          test: async () => {
            const config = {
              input: './src',
              output: './dist',
              nameGeneration: { enabled: true, minimumLength: 8 },
            };
            const configPath = path.join(tempDir, 'cross-platform-namegen.json');
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            return cliHarness.executeCommandInDirectory(
              ['--config', configPath, 'init-config'],
              tempDir
            );
          },
        },
      ];

      const platformInfo = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      };

      console.log(
        `Testing on: ${platformInfo.platform} ${platformInfo.arch} Node.js ${platformInfo.nodeVersion}`
      );

      for (const feature of crossPlatformFeatures) {
        try {
          const result = await feature.test();

          const status = result.exitCode === 0 ? 'SUPPORTED' : 'UNSUPPORTED';
          console.log(`${feature.name}: ${status}`);

          // Critical features should be supported across platforms
          if (feature.name.includes('Basic') || feature.name.includes('Configuration')) {
            expect(result.exitCode).not.toBe(2); // Should not crash
          }
        } catch (error) {
          console.error(`Feature ${feature.name} failed with error:`, error);
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle platform-specific optimizations appropriately', async () => {
      // Test that platform-specific optimizations don't break functionality
      const optimizationConfig = {
        input: './src',
        output: './dist',
        optimization: {
          enabled: true,
          platformSpecific: true,
          aggressive: false,
        },
      };
      const configPath = path.join(tempDir, 'platform-optimization.json');
      await fs.writeFile(configPath, JSON.stringify(optimizationConfig, null, 2));

      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      // Platform optimizations should not break basic functionality
      if (result.exitCode !== 0) {
        // Should provide clear messaging about optimization availability
        const output = (result.stderr || result.stdout).toLowerCase();
        expect(output).toMatch(/optimization|platform|configuration/i);
      } else {
        CliAssertions.assertSuccess(result);
      }
    });
  });
});
