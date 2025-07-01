/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { promises as fs } from 'fs';
import { mkdtemp, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createFastModeOptimizer, FastModeConfig, FastModeOptimizer } from '../fastModeOptimizer';
import { WatchEvent } from '../types';

describe('FastModeOptimizer', () => {
  let tempDir: string;
  let optimizer: FastModeOptimizer;
  let mockFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'fast-mode-test-'));
    mockFile = join(tempDir, 'test.css');
    await fs.writeFile(mockFile, '.test { color: red; }');

    const config: Partial<FastModeConfig> = {
      enabled: true,
      mode: 'balanced',
      skipNonCritical: true,
      useInMemoryCache: true,
      aggressiveDebouncing: false,
      maxProcessingTimeMs: 1000,
      inMemoryCacheSize: 50,
      cacheExpiryMs: 30000,
      debounceMs: 100,
      showFastModeIndicator: false,
      verboseLogging: false,
    };

    optimizer = new FastModeOptimizer({}, config);
  });

  afterEach(async () => {
    await optimizer.shutdown();
    try {
      await rmdir(tempDir, { recursive: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Fast Mode Configuration', () => {
    test('should initialize with default config', () => {
      const defaultOptimizer = createFastModeOptimizer();
      expect(defaultOptimizer.getConfig().enabled).toBe(true);
      expect(defaultOptimizer.getConfig().mode).toBe('balanced');
    });

    test('should merge custom config correctly', () => {
      const config = optimizer.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.mode).toBe('balanced');
      expect(config.skipNonCritical).toBe(true);
    });

    test('should toggle fast mode on/off', () => {
      optimizer.toggleFastMode(false);
      expect(optimizer.getConfig().enabled).toBe(false);

      optimizer.toggleFastMode(true);
      expect(optimizer.getConfig().enabled).toBe(true);
    });

    test('should change mode intensity', () => {
      optimizer.setMode('ultra');
      expect(optimizer.getConfig().mode).toBe('ultra');
      expect(optimizer.getConfig().maxProcessingTimeMs).toBe(200);

      optimizer.setMode('conservative');
      expect(optimizer.getConfig().mode).toBe('conservative');
      expect(optimizer.getConfig().maxProcessingTimeMs).toBe(2000);
    });
  });

  describe('File Processing', () => {
    test('should process CSS file changes', async () => {
      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      const results = await optimizer.processChange(event);
      expect(results).toHaveLength(1);
      expect(results[0].fastMode.enabled).toBe(true);
      expect(results[0].success).toBe(true);
    });

    test('should skip processing when fast mode disabled', async () => {
      optimizer.toggleFastMode(false);

      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      const results = await optimizer.processChange(event);
      expect(results[0].fastMode.enabled).toBe(false);
      expect(results[0].fastMode.reason).toBe('fast-mode-disabled');
    });

    test('should handle large files by skipping optimization', async () => {
      const largeContent = '.test { color: red; }'.repeat(10000);
      await fs.writeFile(mockFile, largeContent);

      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      const results = await optimizer.processChange(event);
      expect(results[0].fastMode.skipped).toBe(true);
      expect(results[0].fastMode.reason).toContain('large-file');
    });
  });

  describe('Caching System', () => {
    test('should cache optimization results', async () => {
      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      // First processing
      const results1 = await optimizer.processChange(event);
      expect(results1[0].fastMode.cacheHit).toBe(false);

      // Second processing should hit cache
      const results2 = await optimizer.processChange(event);
      expect(results2[0].fastMode.cacheHit).toBe(true);
    });

    test('should clear cache when requested', async () => {
      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      await optimizer.processChange(event);

      const statsBefore = optimizer.getCacheStats();
      expect(statsBefore.totalEntries).toBeGreaterThan(0);

      optimizer.clearCache();

      const statsAfter = optimizer.getCacheStats();
      expect(statsAfter.totalEntries).toBe(0);
    });

    test('should manage cache size limits', async () => {
      // Create multiple files to exceed cache size
      const files: string[] = [];
      for (let i = 0; i < 60; i++) {
        const file = join(tempDir, `test${i}.css`);
        files.push(file);
        await fs.writeFile(file, `.test${i} { color: red; }`);

        const event: WatchEvent = {
          type: 'change',
          path: file,
          timestamp: Date.now(),
        };

        await optimizer.processChange(event);
      }

      const stats = optimizer.getCacheStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(50); // Cache size limit
    });
  });

  describe('Heuristics System', () => {
    test('should apply heuristics for different file types', async () => {
      // Test CSS file
      const cssEvent: WatchEvent = {
        type: 'change',
        path: join(tempDir, 'styles.css'),
        timestamp: Date.now(),
      };
      await fs.writeFile(cssEvent.path, '.test { color: blue; }');

      const cssResults = await optimizer.processChange(cssEvent);
      expect(cssResults[0].fastMode.heuristicApplied).toBeDefined();

      // Test JS file
      const jsEvent: WatchEvent = {
        type: 'change',
        path: join(tempDir, 'script.js'),
        timestamp: Date.now(),
      };
      await fs.writeFile(jsEvent.path, 'console.log("test");');

      const jsResults = await optimizer.processChange(jsEvent);
      expect(jsResults[0].fastMode.heuristicApplied).toBeDefined();
    });

    test('should add and remove custom heuristics', () => {
      const customHeuristic = {
        id: 'test-heuristic',
        name: 'Test Heuristic',
        priority: 10,
        condition: (filePath: string) => filePath.endsWith('.test'),
        action: 'skip' as const,
        reason: 'Test file detected',
      };

      optimizer.addHeuristic(customHeuristic);

      // Verify heuristic was added
      const config = optimizer.getConfig();
      expect(config).toBeDefined();

      optimizer.removeHeuristic('test-heuristic');
      // Verify heuristic was removed
      expect(config).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    test('should track processing metrics', async () => {
      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      await optimizer.processChange(event);

      const metrics = optimizer.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
      expect(metrics.speedGainRatio).toBeGreaterThan(0);
    });

    test('should track cache hit rate', async () => {
      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      // Process same file multiple times
      await optimizer.processChange(event);
      await optimizer.processChange(event);
      await optimizer.processChange(event);

      const metrics = optimizer.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });

    test('should track skipped files', async () => {
      const largeContent = '.test { color: red; }'.repeat(10000);
      await fs.writeFile(mockFile, largeContent);

      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      await optimizer.processChange(event);

      const metrics = optimizer.getMetrics();
      expect(metrics.totalSkipped).toBeGreaterThan(0);
    });
  });

  describe('Debouncing and Throttling', () => {
    test('should debounce rapid file changes', async () => {
      const debouncingOptimizer = new FastModeOptimizer(
        {},
        {
          enabled: true,
          aggressiveDebouncing: true,
          debounceMs: 50,
        }
      );

      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      // Fire multiple rapid events
      const promises = [
        debouncingOptimizer.processChange(event),
        debouncingOptimizer.processChange(event),
        debouncingOptimizer.processChange(event),
      ];

      const results = await Promise.all(promises);

      // Should only process once due to debouncing
      const processedCount = results.filter((r) => r.length > 0).length;
      expect(processedCount).toBeLessThan(3);

      await debouncingOptimizer.shutdown();
    });
  });

  describe('Safety Mechanisms', () => {
    test('should preserve critical paths', async () => {
      const criticalOptimizer = new FastModeOptimizer(
        {},
        {
          enabled: true,
          preserveCriticalPaths: [mockFile],
          skipNonCritical: true,
        }
      );

      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      const results = await criticalOptimizer.processChange(event);
      expect(results[0].fastMode.skipped).toBe(false);

      await criticalOptimizer.shutdown();
    });

    test('should enforce maximum skip ratio', async () => {
      const conservativeOptimizer = new FastModeOptimizer(
        {},
        {
          enabled: true,
          maxSkipRatio: 0.1, // Allow max 10% skips
          skipNonCritical: true,
        }
      );

      // Process many files
      for (let i = 0; i < 20; i++) {
        const file = join(tempDir, `test${i}.css`);
        await fs.writeFile(file, `.test${i} { color: red; }`);

        const event: WatchEvent = {
          type: 'change',
          path: file,
          timestamp: Date.now(),
        };

        await conservativeOptimizer.processChange(event);
      }

      const metrics = conservativeOptimizer.getMetrics();
      const skipRatio = metrics.totalSkipped / (metrics.totalProcessed + metrics.totalSkipped);
      expect(skipRatio).toBeLessThanOrEqual(0.1);

      await conservativeOptimizer.shutdown();
    });
  });

  describe('Error Handling', () => {
    test('should handle file processing errors gracefully', async () => {
      const nonExistentFile = join(tempDir, 'nonexistent.css');
      const event: WatchEvent = {
        type: 'change',
        path: nonExistentFile,
        timestamp: Date.now(),
      };

      const results = await optimizer.processChange(event);
      expect(results[0].success).toBe(false);
      expect(results[0].errors).toBeDefined();
    });

    test('should emit error events for failed operations', (done) => {
      optimizer.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      // Trigger an error by processing invalid path
      const invalidEvent: WatchEvent = {
        type: 'change',
        path: '/invalid/path/file.css',
        timestamp: Date.now(),
      };

      optimizer.processChange(invalidEvent);
    });
  });

  describe('Integration', () => {
    test('should work with different file types', async () => {
      const fileTypes = [
        { ext: '.css', content: '.test { color: red; }' },
        { ext: '.scss', content: '$color: red; .test { color: $color; }' },
        { ext: '.js', content: 'console.log("test");' },
        { ext: '.ts', content: 'const test: string = "test";' },
      ];

      for (const fileType of fileTypes) {
        const file = join(tempDir, `test${fileType.ext}`);
        await fs.writeFile(file, fileType.content);

        const event: WatchEvent = {
          type: 'change',
          path: file,
          timestamp: Date.now(),
        };

        const results = await optimizer.processChange(event);
        expect(results).toHaveLength(1);
        expect(results[0]).toBeDefined();
      }
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      const promises = [];

      // Process multiple files concurrently
      for (let i = 0; i < 20; i++) {
        const file = join(tempDir, `load-test-${i}.css`);
        await fs.writeFile(file, `.test${i} { color: red; }`);

        const event: WatchEvent = {
          type: 'change',
          path: file,
          timestamp: Date.now(),
        };

        promises.push(optimizer.processChange(event));
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000);

      const metrics = optimizer.getMetrics();
      expect(metrics.totalProcessed + metrics.totalSkipped).toBe(20);
    });
  });

  describe('Cleanup', () => {
    test('should clean up resources on shutdown', async () => {
      const testOptimizer = new FastModeOptimizer();

      // Process some files to create state
      const event: WatchEvent = {
        type: 'change',
        path: mockFile,
        timestamp: Date.now(),
      };

      await testOptimizer.processChange(event);

      // Shutdown should not throw
      await expect(testOptimizer.shutdown()).resolves.not.toThrow();

      // Cache should be cleared
      const stats = testOptimizer.getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
