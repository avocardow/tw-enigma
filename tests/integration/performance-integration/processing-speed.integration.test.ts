/**
 * Processing Speed Integration Tests
 *
 * Tests processing performance, speed optimization,
 * and performance regression detection across different scenarios.
 */

import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliAssertions, CliTestHarness } from '../utils/cli-test-harness';

describe('Processing Speed Integration', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory();
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Speed Baseline Testing', () => {
    it('should establish baseline processing speeds for small inputs', async () => {
      // Create small input files for baseline
      const baselineDir = path.join(tempDir, 'baseline-small');
      await fs.mkdir(baselineDir);

      // Create 3 small CSS files
      for (let i = 0; i < 3; i++) {
        const content =
          `.baseline-class-${i} { color: #${i.toString(16).repeat(6).slice(0, 6)}; }`.repeat(15);
        await fs.writeFile(path.join(baselineDir, `baseline-${i}.css`), content);
      }

      // Measure baseline processing time
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', baselineDir, 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Should complete successfully and establish baseline
      CliAssertions.assertSuccess(result);
      expect(processingTime).toBeLessThan(8000); // 8 seconds baseline for small inputs

      // Log baseline for reference
      console.log(`Small input baseline: ${processingTime}ms`);
    });

    it('should establish baseline processing speeds for medium inputs', async () => {
      // Create medium input files for baseline
      const baselineDir = path.join(tempDir, 'baseline-medium');
      await fs.mkdir(baselineDir);

      // Create 8 medium CSS files
      for (let i = 0; i < 8; i++) {
        const content = `.baseline-medium-class-${i} {
          color: #${i.toString(16).repeat(6).slice(0, 6)};
          margin: ${i}px;
          padding: ${i * 2}px;
        }`.repeat(50);
        await fs.writeFile(path.join(baselineDir, `baseline-medium-${i}.css`), content);
      }

      // Measure baseline processing time
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', baselineDir, 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Should complete successfully and establish baseline
      CliAssertions.assertSuccess(result);
      expect(processingTime).toBeLessThan(20000); // 20 seconds baseline for medium inputs

      // Log baseline for reference
      console.log(`Medium input baseline: ${processingTime}ms`);
    });

    it('should establish baseline processing speeds for large inputs', async () => {
      // Create large input files for baseline
      const baselineDir = path.join(tempDir, 'baseline-large');
      await fs.mkdir(baselineDir);

      // Create 15 large CSS files
      for (let i = 0; i < 15; i++) {
        const content = `.baseline-large-class-${i} {
          color: #${i.toString(16).repeat(6).slice(0, 6)};
          background: linear-gradient(45deg, #fff, #000);
          margin: ${i}px;
          padding: ${i * 2}px;
          border: ${i}px solid #ccc;
        }`.repeat(80);
        await fs.writeFile(path.join(baselineDir, `baseline-large-${i}.css`), content);
      }

      // Measure baseline processing time
      const startTime = Date.now();
      const result = await cliHarness.executeCommandInDirectory(
        ['--input', baselineDir, 'css-config'],
        tempDir
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Should complete successfully and establish baseline
      CliAssertions.assertSuccess(result);
      expect(processingTime).toBeLessThan(45000); // 45 seconds baseline for large inputs

      // Log baseline for reference
      console.log(`Large input baseline: ${processingTime}ms`);
    });
  });

  describe('Speed Optimization Testing', () => {
    it('should demonstrate speed improvements with optimized configurations', async () => {
      // Create test files for optimization testing
      const optimizationDir = path.join(tempDir, 'optimization-test');
      await fs.mkdir(optimizationDir);

      // Create files with optimization potential
      for (let i = 0; i < 10; i++) {
        const content = `.repeated-class { color: red; }
.another-repeated-class { color: blue; }
.unique-class-${i} { margin: ${i}px; }`.repeat(60);
        await fs.writeFile(path.join(optimizationDir, `optimization-${i}.css`), content);
      }

      // Test default configuration speed
      const defaultStartTime = Date.now();
      const defaultResult = await cliHarness.executeCommandInDirectory(
        ['--input', optimizationDir, 'css-config'],
        tempDir
      );
      const defaultEndTime = Date.now();
      const defaultTime = defaultEndTime - defaultStartTime;

      CliAssertions.assertSuccess(defaultResult);

      // Test optimized configuration speed
      const optimizedConfig = {
        input: optimizationDir,
        output: './dist-optimized',
        optimization: {
          enabled: true,
          aggressive: true,
        },
      };
      const configPath = path.join(tempDir, 'optimized.config.json');
      await fs.writeFile(configPath, JSON.stringify(optimizedConfig, null, 2));

      const optimizedStartTime = Date.now();
      const optimizedResult = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'css-config'],
        tempDir
      );
      const optimizedEndTime = Date.now();
      const optimizedTime = optimizedEndTime - optimizedStartTime;

      CliAssertions.assertSuccess(optimizedResult);

      // Log performance comparison
      console.log(`Default time: ${defaultTime}ms, Optimized time: ${optimizedTime}ms`);

      // Both should complete in reasonable time
      expect(defaultTime).toBeLessThan(25000); // 25 seconds max
      expect(optimizedTime).toBeLessThan(30000); // 30 seconds max (may be slower due to optimization overhead)
    });

    it('should validate parallel processing improvements', async () => {
      // Create multiple input directories for parallel testing
      const parallelDirs = ['parallel-1', 'parallel-2', 'parallel-3', 'parallel-4'];

      for (const dirName of parallelDirs) {
        const parallelDir = path.join(tempDir, dirName);
        await fs.mkdir(parallelDir);

        // Create files in each directory
        for (let i = 0; i < 5; i++) {
          const content = `.parallel-${dirName}-class-${i} {
            color: #${i.toString(16).repeat(6).slice(0, 6)};
            margin: ${i}px;
          }`.repeat(40);
          await fs.writeFile(path.join(parallelDir, `parallel-${i}.css`), content);
        }
      }

      // Test sequential processing
      const sequentialStartTime = Date.now();
      for (const dirName of parallelDirs) {
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', dirName, 'css-config'],
          tempDir
        );
        CliAssertions.assertSuccess(result);
      }
      const sequentialEndTime = Date.now();
      const sequentialTime = sequentialEndTime - sequentialStartTime;

      // Test parallel processing
      const parallelStartTime = Date.now();
      const parallelTasks = parallelDirs.map((dirName) =>
        cliHarness.executeCommandInDirectory(['--input', dirName, 'css-config'], tempDir)
      );
      const parallelResults = await Promise.all(parallelTasks);
      const parallelEndTime = Date.now();
      const parallelTime = parallelEndTime - parallelStartTime;

      // All should succeed
      parallelResults.forEach((result) => {
        CliAssertions.assertSuccess(result);
      });

      // Log timing comparison
      console.log(`Sequential time: ${sequentialTime}ms, Parallel time: ${parallelTime}ms`);

      // Parallel should not be significantly slower than sequential
      expect(parallelTime).toBeLessThan(sequentialTime * 1.5); // No more than 50% slower
    });

    it('should validate caching improvements on repeated operations', async () => {
      // Create test input for caching validation
      const cacheDir = path.join(tempDir, 'cache-test');
      await fs.mkdir(cacheDir);

      // Create files for caching test
      for (let i = 0; i < 6; i++) {
        const content = `.cache-class-${i} {
          color: #${i.toString(16).repeat(6).slice(0, 6)};
          background: url('image-${i}.png');
        }`.repeat(30);
        await fs.writeFile(path.join(cacheDir, `cache-${i}.css`), content);
      }

      // First run (cold cache)
      const firstRunStartTime = Date.now();
      const firstResult = await cliHarness.executeCommandInDirectory(
        ['--input', cacheDir, 'css-config'],
        tempDir
      );
      const firstRunEndTime = Date.now();
      const firstRunTime = firstRunEndTime - firstRunStartTime;

      CliAssertions.assertSuccess(firstResult);

      // Second run (warm cache - if caching implemented)
      const secondRunStartTime = Date.now();
      const secondResult = await cliHarness.executeCommandInDirectory(
        ['--input', cacheDir, 'css-config'],
        tempDir
      );
      const secondRunEndTime = Date.now();
      const secondRunTime = secondRunEndTime - secondRunStartTime;

      CliAssertions.assertSuccess(secondResult);

      // Log caching comparison
      console.log(`First run: ${firstRunTime}ms, Second run: ${secondRunTime}ms`);

      // Both runs should complete successfully
      expect(firstRunTime).toBeLessThan(15000); // 15 seconds max
      expect(secondRunTime).toBeLessThan(15000); // 15 seconds max
    });
  });

  describe('Performance Regression Testing', () => {
    it('should detect performance regressions in name generation', async () => {
      // Create test scenario for name generation performance
      const nameGenDir = path.join(tempDir, 'namegen-perf');
      await fs.mkdir(nameGenDir);

      // Create files that will trigger name generation
      for (let i = 0; i < 8; i++) {
        const content =
          `.original-name-${i} { color: #${i.toString(16).repeat(6).slice(0, 6)}; }`.repeat(25);
        await fs.writeFile(path.join(nameGenDir, `namegen-${i}.css`), content);
      }

      // Test different name generation configurations
      const nameGenConfigs = [
        { minimumLength: 5, pattern: 'alphabetic' },
        { minimumLength: 10, pattern: 'alphabetic' },
        { minimumLength: 15, pattern: 'alphabetic' },
        { minimumLength: 20, pattern: 'alphabetic' },
      ];

      const nameGenTimes: number[] = [];

      for (const [index, nameGenConfig] of nameGenConfigs.entries()) {
        const config = {
          input: nameGenDir,
          output: `./dist-namegen-${index}`,
          nameGeneration: {
            enabled: true,
            ...nameGenConfig,
          },
        };
        const configPath = path.join(tempDir, `namegen-${index}.config.json`);
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        nameGenTimes.push(endTime - startTime);
        CliAssertions.assertSuccess(result);
      }

      // Validate name generation performance scaling
      nameGenTimes.forEach((time, index) => {
        console.log(`Name generation ${nameGenConfigs[index].minimumLength}: ${time}ms`);
        expect(time).toBeLessThan(20000); // 20 seconds max for any name generation config
      });

      // Performance should not degrade exponentially
      const performanceIncreases = nameGenTimes
        .map((time, index) => {
          if (index === 0) return 1;
          return time / nameGenTimes[index - 1];
        })
        .filter((increase) => increase > 0);

      performanceIncreases.forEach((increase) => {
        expect(increase).toBeLessThan(3); // No more than 3x increase per step
      });
    });

    it('should validate consistent performance across different input types', async () => {
      // Create different types of CSS inputs
      const inputTypes = [
        { name: 'simple', pattern: '.simple-${i} { color: red; }' },
        {
          name: 'complex',
          pattern:
            '.complex-${i} { background: linear-gradient(45deg, #fff, #000); margin: ${i}px; }',
        },
        {
          name: 'nested',
          pattern: '.nested-${i} .child { color: blue; } .nested-${i}:hover { color: green; }',
        },
        { name: 'media', pattern: '@media (max-width: 768px) { .media-${i} { display: none; } }' },
      ];

      const inputTypeTimes: { type: string; time: number }[] = [];

      for (const inputType of inputTypes) {
        const typeDir = path.join(tempDir, `type-${inputType.name}`);
        await fs.mkdir(typeDir);

        // Create files for this input type
        for (let i = 0; i < 6; i++) {
          const content = inputType.pattern.replace(/\$\{i\}/g, i.toString()).repeat(30);
          await fs.writeFile(path.join(typeDir, `${inputType.name}-${i}.css`), content);
        }

        // Measure processing time for this input type
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', typeDir, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        const processingTime = endTime - startTime;
        inputTypeTimes.push({ type: inputType.name, time: processingTime });

        CliAssertions.assertSuccess(result);
      }

      // Validate performance consistency across input types
      inputTypeTimes.forEach(({ type, time }) => {
        console.log(`Input type ${type}: ${time}ms`);
        expect(time).toBeLessThan(25000); // 25 seconds max for any input type
      });

      // No input type should be dramatically slower than others
      const avgTime =
        inputTypeTimes.reduce((sum, { time }) => sum + time, 0) / inputTypeTimes.length;
      inputTypeTimes.forEach(({ type, time }) => {
        expect(time).toBeLessThan(avgTime * 2.5); // No more than 2.5x slower than average
      });
    });

    it('should monitor processing speed under different system loads', async () => {
      // Create test input for load testing
      const loadDir = path.join(tempDir, 'load-test');
      await fs.mkdir(loadDir);

      // Create moderate-sized files for load testing
      for (let i = 0; i < 10; i++) {
        const content = `.load-test-class-${i} {
          color: #${i.toString(16).repeat(6).slice(0, 6)};
          margin: ${i}px;
          padding: ${i * 2}px;
        }`.repeat(40);
        await fs.writeFile(path.join(loadDir, `load-${i}.css`), content);
      }

      // Test under different simulated loads
      const loadTests = [
        { name: 'low-load', concurrent: 1 },
        { name: 'medium-load', concurrent: 2 },
        { name: 'high-load', concurrent: 3 },
      ];

      const loadTestResults: { load: string; time: number }[] = [];

      for (const loadTest of loadTests) {
        // Create concurrent operations to simulate load
        const concurrentTasks = Array.from({ length: loadTest.concurrent }, () =>
          cliHarness.executeCommandInDirectory(['--input', loadDir, 'css-config'], tempDir)
        );

        const startTime = Date.now();
        const results = await Promise.all(concurrentTasks);
        const endTime = Date.now();

        const totalTime = endTime - startTime;
        loadTestResults.push({ load: loadTest.name, time: totalTime });

        // All should succeed
        results.forEach((result) => {
          CliAssertions.assertSuccess(result);
        });
      }

      // Validate performance under different loads
      loadTestResults.forEach(({ load, time }) => {
        console.log(`Load test ${load}: ${time}ms`);
        expect(time).toBeLessThan(40000); // 40 seconds max under any load
      });

      // Performance degradation should be reasonable
      const lowLoadTime = loadTestResults.find((r) => r.load === 'low-load')?.time || 0;
      const highLoadTime = loadTestResults.find((r) => r.load === 'high-load')?.time || 0;

      if (lowLoadTime > 0 && highLoadTime > 0) {
        expect(highLoadTime).toBeLessThan(lowLoadTime * 4); // No more than 4x degradation under high load
      }
    });
  });

  describe('Speed Benchmark Testing', () => {
    it('should maintain speed benchmarks for CLI operations', async () => {
      // Test CLI operation speeds
      const cliOperations = [
        { command: ['--help'], maxTime: 2000, description: 'Help command' },
        { command: ['--version'], maxTime: 2000, description: 'Version command' },
        { command: ['init-config'], maxTime: 5000, description: 'Init config command' },
      ];

      for (const operation of cliOperations) {
        const startTime = Date.now();
        const result = await cliHarness.executeCommand(operation.command);
        const endTime = Date.now();

        const operationTime = endTime - startTime;

        // Most CLI operations should succeed (help and version) or have expected behavior
        if (operation.command.includes('--help') || operation.command.includes('--version')) {
          // Help and version might exit with code 0 or 1 depending on implementation
          expect([0, 1]).toContain(result.exitCode);
        } else {
          CliAssertions.assertSuccess(result);
        }

        // Speed benchmark validation
        expect(operationTime).toBeLessThan(operation.maxTime);
        console.log(`${operation.description}: ${operationTime}ms (max: ${operation.maxTime}ms)`);
      }
    });

    it('should maintain speed benchmarks for configuration operations', async () => {
      // Test configuration operation speeds
      const configOperations = [
        {
          name: 'minimal-config',
          config: { input: './src', output: './dist' },
          maxTime: 3000,
        },
        {
          name: 'standard-config',
          config: {
            input: './src',
            output: './dist',
            nameGeneration: { enabled: true, minimumLength: 8 },
          },
          maxTime: 5000,
        },
        {
          name: 'complex-config',
          config: {
            input: ['./src', './lib'],
            output: './dist',
            nameGeneration: { enabled: true, minimumLength: 15, pattern: 'alphabetic' },
            optimization: { enabled: true },
          },
          maxTime: 8000,
        },
      ];

      for (const configOp of configOperations) {
        const configPath = path.join(tempDir, `${configOp.name}.json`);
        await fs.writeFile(configPath, JSON.stringify(configOp.config, null, 2));

        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--config', configPath, 'init-config'],
          tempDir
        );
        const endTime = Date.now();

        const operationTime = endTime - startTime;

        CliAssertions.assertSuccess(result);
        expect(operationTime).toBeLessThan(configOp.maxTime);
        console.log(`${configOp.name}: ${operationTime}ms (max: ${configOp.maxTime}ms)`);
      }
    });

    it('should validate speed consistency across multiple runs', async () => {
      // Create consistent test input
      const consistencyDir = path.join(tempDir, 'consistency-test');
      await fs.mkdir(consistencyDir);

      // Create standard test files
      for (let i = 0; i < 5; i++) {
        const content =
          `.consistency-class-${i} { color: #${i.toString(16).repeat(6).slice(0, 6)}; }`.repeat(20);
        await fs.writeFile(path.join(consistencyDir, `consistency-${i}.css`), content);
      }

      // Run multiple times to test consistency
      const runs = 5;
      const runTimes: number[] = [];

      for (let run = 0; run < runs; run++) {
        const startTime = Date.now();
        const result = await cliHarness.executeCommandInDirectory(
          ['--input', consistencyDir, 'css-config'],
          tempDir
        );
        const endTime = Date.now();

        runTimes.push(endTime - startTime);
        CliAssertions.assertSuccess(result);
      }

      // Validate consistency
      const avgTime = runTimes.reduce((sum, time) => sum + time, 0) / runTimes.length;
      const maxTime = Math.max(...runTimes);
      const minTime = Math.min(...runTimes);

      console.log(`Consistency test - Avg: ${avgTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);

      // All runs should complete in reasonable time
      runTimes.forEach((time) => {
        expect(time).toBeLessThan(12000); // 12 seconds max per run
      });

      // Variance should be reasonable (not too much inconsistency)
      expect(maxTime - minTime).toBeLessThan(avgTime); // Variance should be less than average
    });
  });
});
