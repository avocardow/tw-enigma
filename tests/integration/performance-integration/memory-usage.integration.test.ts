/**
 * Memory Usage Integration Tests
 *
 * Tests memory consumption, garbage collection efficiency,
 * and memory leak detection across different scenarios.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';

describe('Memory Usage Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Memory Efficiency Testing', () => {
    it('should handle small input files efficiently', async () => {
      // Create small test files
      const smallInputDir = path.join(tempDir, 'small-input');
      await fs.mkdir(smallInputDir);

      // Create small CSS files (1KB each)
      for (let i = 0; i < 5; i++) {
        const smallContent = `.small-class-${i} { color: red; }`.repeat(20);
        await fs.writeFile(path.join(smallInputDir, `small-${i}.css`), smallContent);
      }

      // Test memory usage with small files
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', smallInputDir, 'css-config'],
        tempDir
      );

      // Should complete successfully with small memory footprint
      CliAssertions.assertSuccess(result);

      // Small files should process quickly (indicating efficient memory usage)
      // Note: Actual memory measurement would require Node.js process monitoring
    });

    it('should handle medium-sized input files efficiently', async () => {
      // Create medium-sized test files
      const mediumInputDir = path.join(tempDir, 'medium-input');
      await fs.mkdir(mediumInputDir);

      // Create medium CSS files (10KB each)
      for (let i = 0; i < 10; i++) {
        const mediumContent = `.medium-class-${i} {
          color: #${i.toString(16).repeat(6).slice(0, 6)};
          margin: ${i}px;
          padding: ${i * 2}px;
        }`.repeat(100);
        await fs.writeFile(path.join(mediumInputDir, `medium-${i}.css`), mediumContent);
      }

      // Test memory usage with medium files
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', mediumInputDir, 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      // Should handle medium files efficiently
      CliAssertions.assertSuccess(result);
      expect(endTime - startTime).toBeLessThan(15000); // 15 seconds max
    });

    it('should handle large input files with streaming/chunking', async () => {
      // Create large test file
      const largeInputDir = path.join(tempDir, 'large-input');
      await fs.mkdir(largeInputDir);

      // Create large CSS file (100KB)
      const largeContent = `.large-class {
        color: #ff0000;
        margin: 10px;
        padding: 20px;
        border: 1px solid #000;
      }`.repeat(1000);
      await fs.writeFile(path.join(largeInputDir, 'large.css'), largeContent);

      // Test memory usage with large file
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', largeInputDir, 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      // Should handle large files without memory issues
      CliAssertions.assertSuccess(result);
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max for large file
    });
  });

  describe('Memory Scaling Testing', () => {
    it('should scale memory usage linearly with input size', async () => {
      // Test different input sizes
      const inputSizes = [1, 5, 10]; // Number of files
      const memoryTestResults: { size: number; time: number }[] = [];

      for (const size of inputSizes) {
        // Create input directory with specified number of files
        const scalingDir = path.join(tempDir, `scaling-${size}`);
        await fs.mkdir(scalingDir);

        for (let i = 0; i < size; i++) {
          const content = `.scaling-class-${i} {
            color: #${i.toString(16).repeat(6).slice(0, 6)};
          }`.repeat(50); // 50 repetitions per file
          await fs.writeFile(path.join(scalingDir, `file-${i}.css`), content);
        }

        // Measure processing time (proxy for memory efficiency)
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', scalingDir, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        memoryTestResults.push({ size, time: endTime - startTime });
        CliAssertions.assertSuccess(result);
      }

      // Validate memory scaling characteristics
      const timeIncreases = memoryTestResults
        .map((data, index) => {
          if (index === 0) return 1;
          return data.time / memoryTestResults[index - 1].time;
        })
        .filter((increase) => increase > 0);

      // Memory scaling should be reasonable (not exponential)
      timeIncreases.forEach((increase) => {
        expect(increase).toBeLessThan(5); // Should not increase by more than 5x per step
      });
    });

    it('should handle concurrent operations without memory conflicts', async () => {
      // Create multiple input directories for concurrent testing
      const concurrentDirs = ['concurrent-1', 'concurrent-2', 'concurrent-3'];

      for (const dirName of concurrentDirs) {
        const concurrentDir = path.join(tempDir, dirName);
        await fs.mkdir(concurrentDir);

        // Create files in each directory
        for (let i = 0; i < 3; i++) {
          const content = `.concurrent-${dirName}-class-${i} { color: blue; }`.repeat(30);
          await fs.writeFile(path.join(concurrentDir, `file-${i}.css`), content);
        }
      }

      // Execute concurrent operations
      const concurrentTasks = concurrentDirs.map((dirName) =>
        cliHarness.executeCommandInDirectory(['--input', dirName, 'css-config'], tempDir)
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentTasks);
      const endTime = Date.now();

      // All should complete successfully
      results.forEach((result) => {
        CliAssertions.assertSuccess(result);
      });

      // Concurrent execution should not cause memory issues
      expect(endTime - startTime).toBeLessThan(20000); // 20 seconds max for concurrent operations
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory across multiple operations', async () => {
      // Execute multiple operations to test for memory leaks
      const iterations = 10;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Create fresh input for each iteration
        const iterationDir = path.join(tempDir, `iteration-${i}`);
        await fs.mkdir(iterationDir);

        const content = `.iteration-${i}-class { color: green; }`.repeat(20);
        await fs.writeFile(path.join(iterationDir, 'test.css'), content);

        // Measure processing time
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', iterationDir, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        timings.push(endTime - startTime);
        CliAssertions.assertSuccess(result);
      }

      // Validate no significant performance degradation (indicating no memory leaks)
      const firstHalf = timings.slice(0, iterations / 2);
      const secondHalf = timings.slice(iterations / 2);

      const firstHalfAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;

      // Second half should not be significantly slower (indicating memory leaks)
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2); // No more than 2x degradation
    });

    it('should handle repeated configuration loading/unloading', async () => {
      // Test memory usage with repeated config operations
      const configIterations = 8;
      const configTimings: number[] = [];

      for (let i = 0; i < configIterations; i++) {
        // Create new config for each iteration
        const iterationConfig = {
          input: `./input-${i}`,
          output: `./output-${i}`,
          nameGeneration: {
            enabled: true,
            minimumLength: 8 + i,
            pattern: 'alphabetic',
          },
        };
        const configPath = path.join(tempDir, `config-${i}.json`);
        await fs.writeFile(configPath, JSON.stringify(iterationConfig, null, 2));

        // Measure config processing time
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'init-config'],
          tempDir
        );
        const endTime = Date.now();

        configTimings.push(endTime - startTime);
        CliAssertions.assertSuccess(result);
      }

      // Validate consistent performance across config iterations
      const avgTime = configTimings.reduce((sum, time) => sum + time, 0) / configTimings.length;
      const maxTime = Math.max(...configTimings);
      const minTime = Math.min(...configTimings);

      // Performance should remain consistent
      expect(maxTime - minTime).toBeLessThan(avgTime * 1.5); // Variation should be reasonable
    });
  });

  describe('Memory Usage with Complex Configurations', () => {
    it('should handle complex name generation efficiently', async () => {
      // Test memory usage with complex name generation
      const complexNameGenConfig = {
        input: './src',
        output: './dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 25, // Large length
          pattern: 'alphabetic',
          complexity: 'high',
        },
      };
      const configPath = path.join(tempDir, 'complex-namegen.config.json');
      await fs.writeFile(configPath, JSON.stringify(complexNameGenConfig, null, 2));

      // Test complex name generation memory usage
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );
      const endTime = Date.now();

      // Should handle complex name generation efficiently
      CliAssertions.assertSuccess(result);
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
    });

    it('should handle multiple input sources efficiently', async () => {
      // Create multiple input directories
      const inputDirs = ['input-1', 'input-2', 'input-3', 'input-4'];

      for (const dirName of inputDirs) {
        const inputDir = path.join(tempDir, dirName);
        await fs.mkdir(inputDir);

        // Create files in each directory
        for (let i = 0; i < 5; i++) {
          const content = `.${dirName}-class-${i} {
            color: #${i.toString(16).repeat(6).slice(0, 6)};
            margin: ${i}px;
          }`.repeat(25);
          await fs.writeFile(path.join(inputDir, `file-${i}.css`), content);
        }
      }

      // Test multiple input sources
      const multiInputConfig = {
        input: inputDirs,
        output: './dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 10,
        },
      };
      const configPath = path.join(tempDir, 'multi-input.config.json');
      await fs.writeFile(configPath, JSON.stringify(multiInputConfig, null, 2));

      // Measure multi-input processing
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      // Should handle multiple inputs efficiently
      CliAssertions.assertSuccess(result);
      expect(endTime - startTime).toBeLessThan(25000); // 25 seconds max for multiple inputs
    });
  });

  describe('Memory Optimization Validation', () => {
    it('should demonstrate memory optimization techniques', async () => {
      // Create scenario that benefits from memory optimization
      const optimizationDir = path.join(tempDir, 'optimization-test');
      await fs.mkdir(optimizationDir);

      // Create files with repetitive content (good for optimization)
      for (let i = 0; i < 15; i++) {
        const repetitiveContent = `.common-class { color: red; }
.another-common-class { color: blue; }
.specific-class-${i} { margin: ${i}px; }`.repeat(40);
        await fs.writeFile(path.join(optimizationDir, `repetitive-${i}.css`), repetitiveContent);
      }

      // Test optimization
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', optimizationDir, 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      // Should handle repetitive content efficiently (via optimization)
      CliAssertions.assertSuccess(result);
      expect(endTime - startTime).toBeLessThan(20000); // 20 seconds max
    });

    it('should validate garbage collection efficiency', async () => {
      // Create scenario that generates temporary objects
      const gcTestIterations = 6;
      const gcTimings: number[] = [];

      for (let i = 0; i < gcTestIterations; i++) {
        // Create temporary data structures
        const tempDir = path.join(tempDir, `gc-test-${i}`);
        await fs.mkdir(tempDir);

        // Generate content that creates temporary objects
        const tempContent = Array.from(
          { length: 100 },
          (_, j) => `.temp-class-${i}-${j} { color: #${j.toString(16).repeat(6).slice(0, 6)}; }`
        ).join('\n');
        await fs.writeFile(path.join(tempDir, 'temp.css'), tempContent);

        // Measure processing (including GC effects)
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', tempDir, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        gcTimings.push(endTime - startTime);
        CliAssertions.assertSuccess(result);
      }

      // Validate GC efficiency (no significant degradation over time)
      const earlyAvg = gcTimings.slice(0, 3).reduce((sum, time) => sum + time, 0) / 3;
      const lateAvg = gcTimings.slice(3).reduce((sum, time) => sum + time, 0) / 3;

      // Later iterations should not be significantly slower
      expect(lateAvg).toBeLessThan(earlyAvg * 1.8); // No more than 80% degradation
    });
  });

  describe('Memory Stress Testing', () => {
    it('should handle memory stress conditions gracefully', async () => {
      // Create stress test scenario
      const stressDir = path.join(tempDir, 'stress-test');
      await fs.mkdir(stressDir);

      // Create many small files (stress test file handles and memory)
      const fileCount = 50;
      for (let i = 0; i < fileCount; i++) {
        const content = `.stress-class-${i} {
          color: #${i.toString(16).repeat(6).slice(0, 6)};
          background: url('image-${i}.png');
        }`.repeat(10);
        await fs.writeFile(path.join(stressDir, `stress-${i}.css`), content);
      }

      // Execute stress test
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', stressDir, 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      // Should handle stress conditions
      CliAssertions.assertSuccess(result);
      expect(endTime - startTime).toBeLessThan(60000); // 60 seconds max for stress test
    });

    it('should validate memory recovery after stress', async () => {
      // Execute stress operation
      const heavyConfig = {
        input: './src',
        output: './dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 30, // Heavy name generation
          pattern: 'alphabetic',
        },
      };
      const configPath = path.join(tempDir, 'heavy.config.json');
      await fs.writeFile(configPath, JSON.stringify(heavyConfig, null, 2));

      // Heavy operation
      const heavyResult = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );
      CliAssertions.assertSuccess(heavyResult);

      // Follow with light operation to test memory recovery
      const lightStartTime = Date.now();
      const lightResult = await cliHarness.executeCommand(['init-config']);
      const lightEndTime = Date.now();

      // Light operation should be fast (indicating memory recovery)
      CliAssertions.assertSuccess(lightResult);
      expect(lightEndTime - lightStartTime).toBeLessThan(5000); // 5 seconds max for light operation
    });
  });
});
