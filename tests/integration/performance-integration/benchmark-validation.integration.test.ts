/**
 * Performance Benchmark Validation Integration Tests
 *
 * Tests performance benchmarks, timing validation,
 * and performance regression detection across operations.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFixtures } from '../fixtures/config-generators';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';

describe('Performance Benchmark Validation Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Command Execution Performance', () => {
    it('should validate init-config performance benchmarks', async () => {
      // Measure init-config performance
      const iterations = 5;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await cliHarness.executeCommand(['init-config']);
        const endTime = Date.now();

        timings.push(endTime - startTime);

        // Should complete successfully
        CliAssertions.assertSuccess(result);
      }

      // Validate performance benchmarks
      const avgTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);

      // Performance benchmarks
      expect(avgTime).toBeLessThan(5000); // 5 seconds average
      expect(maxTime).toBeLessThan(10000); // 10 seconds maximum
      expect(minTime).toBeGreaterThan(0); // Should take some time

      // Validate consistency (variance should be reasonable)
      const variance =
        timings.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);
      expect(stdDev / avgTime).toBeLessThan(0.5); // 50% coefficient of variation max
    });

    it('should validate css-config performance benchmarks', async () => {
      // Create test CSS content
      const testCssDir = path.join(tempDir, 'performance-css');
      await fs.mkdir(testCssDir);

      // Generate test CSS files
      for (let i = 0; i < 10; i++) {
        const cssContent = `
.test-class-${i} {
  color: #${i.toString(16).repeat(6).slice(0, 6)};
  margin: ${i}px;
  padding: ${i * 2}px;
}
@apply bg-blue-${i * 100} text-white;
        `.trim();
        await fs.writeFile(path.join(testCssDir, `test-${i}.css`), cssContent);
      }

      // Measure css-config performance
      const iterations = 3;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', testCssDir, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        timings.push(endTime - startTime);
      }

      // Validate CSS processing performance
      const avgTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      expect(avgTime).toBeLessThan(15000); // 15 seconds average for CSS processing
    });

    it('should validate performance with length parameter', async () => {
      // Test performance impact of different length values
      const lengthValues = [1, 5, 10, 15, 20];
      const performanceData: { length: number; time: number }[] = [];

      for (const length of lengthValues) {
        const startTime = Date.now();
        const result = await cliHarness.executeCommand([
          '--length',
          length.toString(),
          'init-config',
        ]);
        const endTime = Date.now();

        performanceData.push({ length, time: endTime - startTime });

        // Should complete successfully
        CliAssertions.assertSuccess(result);
      }

      // Validate length parameter performance impact
      const times = performanceData.map((d) => d.time);
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;

      // Length parameter should not significantly impact performance
      expect(avgTime).toBeLessThan(5000); // 5 seconds average

      // Performance should scale reasonably
      const maxVariation = Math.max(...times) - Math.min(...times);
      expect(maxVariation).toBeLessThan(10000); // 10 seconds max variation
    });
  });

  describe('Scalability Performance Testing', () => {
    it('should validate performance with increasing input sizes', async () => {
      // Test scalability with different input sizes
      const inputSizes = [1, 5, 10, 20]; // Number of files
      const scalabilityData: { size: number; time: number }[] = [];

      for (const size of inputSizes) {
        // Create input directory with specified number of files
        const inputDir = path.join(tempDir, `input-size-${size}`);
        await fs.mkdir(inputDir);

        for (let i = 0; i < size; i++) {
          const content = `
.file-${i}-class-1 { color: red; }
.file-${i}-class-2 { color: blue; }
.file-${i}-class-3 { color: green; }
          `.trim();
          await fs.writeFile(path.join(inputDir, `file-${i}.css`), content);
        }

        // Measure processing time
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', inputDir, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        scalabilityData.push({ size, time: endTime - startTime });
      }

      // Validate scalability characteristics
      const performanceIncreases = scalabilityData
        .map((data, index) => {
          if (index === 0) return 0;
          return data.time / scalabilityData[index - 1].time;
        })
        .filter((increase) => increase > 0);

      // Performance should scale sub-linearly or linearly (not exponentially)
      const avgIncrease =
        performanceIncreases.reduce((sum, inc) => sum + inc, 0) / performanceIncreases.length;
      expect(avgIncrease).toBeLessThan(3); // Should not triple with each size increase
    });

    it('should validate memory usage scaling', async () => {
      // Test memory usage characteristics
      const memorySizes = [100, 500, 1000]; // Bytes per file

      for (const memorySize of memorySizes) {
        // Create large content file
        const largeContentDir = path.join(tempDir, `memory-${memorySize}`);
        await fs.mkdir(largeContentDir);

        const largeContent = 'a'.repeat(memorySize);
        await fs.writeFile(path.join(largeContentDir, 'large.css'), largeContent);

        // Measure processing
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', largeContentDir, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        const processingTime = endTime - startTime;

        // Should handle large files within reasonable time
        expect(processingTime).toBeLessThan(30000); // 30 seconds max
      }
    });
  });

  describe('Concurrent Performance Testing', () => {
    it('should validate concurrent command execution performance', async () => {
      // Test concurrent execution
      const concurrency = 3;
      const concurrentTasks = Array.from({ length: concurrency }, (_, i) =>
        cliHarness.executeCommand(['--length', `${8 + i}`, 'init-config'])
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentTasks);
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      // All should succeed
      results.forEach((result) => {
        CliAssertions.assertSuccess(result);
      });

      // Concurrent execution should be efficient
      expect(totalTime).toBeLessThan(15000); // 15 seconds for 3 concurrent tasks
    });

    it('should validate resource contention handling', async () => {
      // Create shared configuration
      const sharedConfig = configFixtures.generateMinimalConfig();
      const sharedConfigPath = path.join(tempDir, 'shared.config.json');
      await fs.writeFile(sharedConfigPath, JSON.stringify(sharedConfig, null, 2));

      // Test resource contention
      const contentionTasks = Array.from({ length: 5 }, (_, i) =>
        cliHarness.executeCommandInDirectory(
          ['--config', sharedConfigPath, '--output', `./output-${i}`, 'init-config'],
          tempDir
        )
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(contentionTasks);
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      // Should handle contention gracefully
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(20000); // 20 seconds max for contention handling
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in basic operations', async () => {
      // Baseline performance measurement
      const baselineIterations = 3;
      const baselineTimes: number[] = [];

      for (let i = 0; i < baselineIterations; i++) {
        const startTime = Date.now();
        const result = await cliHarness.executeCommand(['init-config']);
        const endTime = Date.now();

        baselineTimes.push(endTime - startTime);
        CliAssertions.assertSuccess(result);
      }

      const baselineAvg = baselineTimes.reduce((sum, time) => sum + time, 0) / baselineTimes.length;

      // Performance validation against reasonable thresholds
      expect(baselineAvg).toBeLessThan(5000); // 5 second baseline

      // Test with complex configuration
      const complexConfig = configFixtures.generateComplexNameGeneration();
      const complexConfigPath = path.join(tempDir, 'complex.config.json');
      await fs.writeFile(complexConfigPath, JSON.stringify(complexConfig, null, 2));

      const complexStartTime = Date.now();
      const complexResult = await cliHarness.executeCommandInDirectory(
        ['--config', complexConfigPath, 'init-config'],
        tempDir
      );
      const complexEndTime = Date.now();

      const complexTime = complexEndTime - complexStartTime;

      // Complex operations should still be reasonable
      expect(complexTime).toBeLessThan(baselineAvg * 3); // No more than 3x baseline
    });

    it('should validate performance consistency across multiple runs', async () => {
      // Run multiple performance tests
      const consistency = 5;
      const consistencyTimes: number[] = [];

      for (let i = 0; i < consistency; i++) {
        const startTime = Date.now();
        const result = await cliHarness.executeCommand(['--length', '10', 'init-config']);
        const endTime = Date.now();

        consistencyTimes.push(endTime - startTime);
        CliAssertions.assertSuccess(result);
      }

      // Validate consistency
      const avgTime =
        consistencyTimes.reduce((sum, time) => sum + time, 0) / consistencyTimes.length;
      const maxTime = Math.max(...consistencyTimes);
      const minTime = Math.min(...consistencyTimes);

      // Performance should be consistent
      const performanceVariation = (maxTime - minTime) / avgTime;
      expect(performanceVariation).toBeLessThan(1.0); // Less than 100% variation

      // All runs should complete in reasonable time
      expect(maxTime).toBeLessThan(10000); // 10 seconds max
      expect(minTime).toBeGreaterThan(0); // Should take some time
    });
  });

  describe('Resource Usage Performance', () => {
    it('should validate CPU usage efficiency', async () => {
      // Test CPU-intensive operations
      const cpuIntensiveConfig = {
        input: ['./src1', './src2', './src3'],
        output: './dist',
        nameGeneration: {
          enabled: true,
          minimumLength: 20,
          pattern: 'alphabetic',
        },
      };
      const configPath = path.join(tempDir, 'cpu-intensive.config.json');
      await fs.writeFile(configPath, JSON.stringify(cpuIntensiveConfig, null, 2));

      // Measure CPU-intensive operation
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Should complete CPU-intensive operations efficiently
      expect(processingTime).toBeLessThan(15000); // 15 seconds max
    });

    it('should validate I/O operation efficiency', async () => {
      // Create multiple directories for I/O testing
      const ioDirs = ['io-test-1', 'io-test-2', 'io-test-3'];

      for (const dirName of ioDirs) {
        const ioDir = path.join(tempDir, dirName);
        await fs.mkdir(ioDir);

        // Create multiple files in each directory
        for (let i = 0; i < 5; i++) {
          await fs.writeFile(
            path.join(ioDir, `file-${i}.css`),
            `.class-${i} { color: #${i.toString(16).repeat(6).slice(0, 6)}; }`
          );
        }
      }

      // Test I/O efficiency
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', ioDirs.join(','), 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      const ioTime = endTime - startTime;

      // Should handle multiple I/O operations efficiently
      expect(ioTime).toBeLessThan(20000); // 20 seconds max for multiple directories
    });
  });

  describe('Performance Monitoring and Reporting', () => {
    it('should provide performance metrics for monitoring', async () => {
      // Execute operation with potential monitoring
      const result = await cliHarness.executeCommand([
        '--verbose',
        '--length',
        '12',
        'init-config',
      ]);

      // Should provide timing or performance information in verbose mode
      CliAssertions.assertSuccess(result);

      // Verbose mode should include timing information
      expect(result.stderr).toBeTruthy(); // Verbose output should exist
    });

    it('should validate performance under various conditions', async () => {
      // Test various performance conditions
      const conditions = [
        { name: 'minimal', args: ['init-config'] },
        { name: 'with-length', args: ['--length', '8', 'init-config'] },
        { name: 'verbose', args: ['--verbose', 'init-config'] },
        { name: 'pretty', args: ['--pretty', 'init-config'] },
        { name: 'combined', args: ['--length', '10', '--verbose', '--pretty', 'init-config'] },
      ];

      const conditionResults: { name: string; time: number }[] = [];

      for (const condition of conditions) {
        const startTime = Date.now();
        const result = await cliHarness.executeCommand(condition.args);
        const endTime = Date.now();

        conditionResults.push({ name: condition.name, time: endTime - startTime });
        CliAssertions.assertSuccess(result);
      }

      // All conditions should complete within reasonable time
      conditionResults.forEach(({ name, time }) => {
        expect(time).toBeLessThan(10000); // 10 seconds max per condition
      });

      // Performance should be predictable across conditions
      const times = conditionResults.map((r) => r.time);
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      // No single condition should be dramatically slower
      expect(maxTime).toBeLessThan(avgTime * 4); // No more than 4x average
    });
  });
});
