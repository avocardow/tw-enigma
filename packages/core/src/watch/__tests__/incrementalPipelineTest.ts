/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { promises as fs } from 'fs';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { atomicOpManager } from '../atomicOpManager';
import { EnhancedIncrementalOptimizer } from '../enhancedIncrementalOptimizer';
import type { WatchEvent } from '../types';

describe('EnhancedIncrementalOptimizer', () => {
  let optimizer: EnhancedIncrementalOptimizer;
  let tempDir: string;
  let cacheDir: string;

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = await mkdtemp(join(tmpdir(), 'incremental-test-'));
    cacheDir = join(tempDir, '.cache');

    // Initialize optimizer with test configuration
    optimizer = new EnhancedIncrementalOptimizer({
      enabled: true,
      cacheDir,
      maxCacheSize: 10,
      maxCacheAge: 60000, // 1 minute for testing
      trackDependencies: true,
      fallbackToFullRebuild: false,
      checksumAlgorithm: 'sha256',
      parallelOptimization: true,
      maxConcurrency: 2,
    });

    // Ensure clean state
    await optimizer.clearCache();
  });

  afterEach(async () => {
    // Cleanup
    await optimizer.shutdown();

    // Remove temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('Basic Incremental Optimization', () => {
    it('should process file changes incrementally', async () => {
      // Create test files
      const file1 = join(tempDir, 'test1.css');
      const file2 = join(tempDir, 'test2.css');

      await fs.writeFile(file1, '.test1 { color: red; }');
      await fs.writeFile(file2, '.test2 { color: blue; }');

      // Process file changes
      const event1: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };
      const event2: WatchEvent = { type: 'add', path: file2, timestamp: new Date() };

      const results1 = await optimizer.processChange(event1);
      const results2 = await optimizer.processChange(event2);

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0].success).toBe(true);
      expect(results2[0].success).toBe(true);

      // Check that dependency graph was updated
      const stats = optimizer.getStats();
      expect(stats.files).toBe(2);
    });

    it('should skip unchanged files', async () => {
      const file1 = join(tempDir, 'unchanged.css');
      await fs.writeFile(file1, '.unchanged { color: green; }');

      const event: WatchEvent = { type: 'change', path: file1, timestamp: new Date() };

      // First change should process
      const results1 = await optimizer.processChange(event);
      expect(results1).toHaveLength(1);
      expect(results1[0].success).toBe(true);

      // Second change with same content should skip
      const results2 = await optimizer.processChange(event);
      expect(results2).toHaveLength(0); // Skipped due to unchanged hash
    });

    it('should handle file deletion', async () => {
      const file1 = join(tempDir, 'to-delete.css');
      await fs.writeFile(file1, '.to-delete { color: orange; }');

      // Add file first
      const addEvent: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };
      await optimizer.processChange(addEvent);

      let stats = optimizer.getStats();
      expect(stats.files).toBe(1);

      // Delete file
      const deleteEvent: WatchEvent = { type: 'unlink', path: file1, timestamp: new Date() };
      const results = await optimizer.processChange(deleteEvent);

      stats = optimizer.getStats();
      expect(stats.files).toBe(0);
    });
  });

  describe('Atomic Operations', () => {
    it('should handle concurrent file changes atomically', async () => {
      const file1 = join(tempDir, 'concurrent1.css');
      const file2 = join(tempDir, 'concurrent2.css');

      await fs.writeFile(file1, '.concurrent1 { color: red; }');
      await fs.writeFile(file2, '.concurrent2 { color: blue; }');

      const event1: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };
      const event2: WatchEvent = { type: 'add', path: file2, timestamp: new Date() };

      // Process changes concurrently
      const [results1, results2] = await Promise.all([
        optimizer.processChange(event1),
        optimizer.processChange(event2),
      ]);

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0].success).toBe(true);
      expect(results2[0].success).toBe(true);

      // Verify atomic operations manager stats
      const atomicStats = atomicOpManager.getStats();
      expect(atomicStats.totalOperations).toBeGreaterThanOrEqual(2);
    });

    it('should prevent race conditions in dependency updates', async () => {
      const file1 = join(tempDir, 'dependency1.css');
      const file2 = join(tempDir, 'dependency2.css');

      await fs.writeFile(file1, '@import "dependency2.css"; .dep1 { color: red; }');
      await fs.writeFile(file2, '.dep2 { color: blue; }');

      const event1: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };
      const event2: WatchEvent = { type: 'change', path: file2, timestamp: new Date() };

      // Add dependency file first
      await optimizer.processChange(event1);

      // Modify dependent file concurrently
      const results = await Promise.all([
        optimizer.processChange(event2),
        optimizer.processChange(event2), // Duplicate to test race condition
      ]);

      // Both should succeed without race conditions
      expect(results[0]).toHaveLength(1);
      expect(results[1]).toHaveLength(0); // Second should be skipped due to same hash
    });
  });

  describe('Corruption Detection and Recovery', () => {
    it('should detect and report corruption', async () => {
      const file1 = join(tempDir, 'corrupt-test.css');
      await fs.writeFile(file1, '.corrupt { color: red; }');

      // Add file to dependency graph
      const event: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };
      await optimizer.processChange(event);

      // Manually corrupt the dependency graph by removing the file
      await fs.unlink(file1);

      // Check for corruption
      const corruption = await optimizer.checkForCorruption();

      expect(corruption.isCorrupt).toBe(true);
      expect(corruption.issues).toContain(`File no longer exists: ${file1}`);
      expect(corruption.affectedFiles).toContain(file1);
      expect(corruption.recommendedAction).toBe('repair');
    });

    it('should recover from cache corruption', async () => {
      const file1 = join(tempDir, 'cache-test.css');
      await fs.writeFile(file1, '.cache-test { color: blue; }');

      // Add file and save cache
      const event: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };
      await optimizer.processChange(event);

      // Manually corrupt cache file
      const cacheFile = join(cacheDir, 'incremental-cache.json');
      await fs.writeFile(cacheFile, 'invalid json content');

      // Create new optimizer instance to trigger cache load
      const newOptimizer = new EnhancedIncrementalOptimizer({
        enabled: true,
        cacheDir,
        trackDependencies: true,
      });

      // Should start with empty cache due to corruption
      const stats = newOptimizer.getStats();
      expect(stats.files).toBe(0);

      await newOptimizer.shutdown();
    });
  });

  describe('Failure Simulation and Testing', () => {
    it('should simulate dependency corruption failures', async () => {
      const file1 = join(tempDir, 'failure-test.css');
      await fs.writeFile(file1, '.failure { color: red; }');

      // Enable failure simulation
      optimizer.enableFailureSimulation({
        enabled: true,
        failureRate: 1.0, // 100% failure rate for testing
        failureTypes: ['dependency_corruption'],
        targetOperations: ['dependency_update'],
        maxFailures: 1,
      });

      const event: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };

      // Should throw error due to simulated failure
      await expect(optimizer.processChange(event)).rejects.toThrow(
        'Simulated dependency corruption'
      );

      // Disable simulation and retry
      optimizer.disableFailureSimulation();

      const results = await optimizer.processChange(event);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should handle cache corruption simulation', async () => {
      const file1 = join(tempDir, 'cache-failure.css');
      await fs.writeFile(file1, '.cache-failure { color: green; }');

      // Enable cache corruption simulation
      optimizer.enableFailureSimulation({
        enabled: true,
        failureRate: 1.0,
        failureTypes: ['cache_corruption'],
        targetOperations: ['cache_save'],
        maxFailures: 1,
      });

      const event: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };

      // Should handle cache save failure gracefully
      await expect(optimizer.processChange(event)).rejects.toThrow('Simulated cache corruption');
    });

    it('should respect maximum failure count', async () => {
      const file1 = join(tempDir, 'max-failures.css');
      await fs.writeFile(file1, '.max-failures { color: purple; }');

      // Enable simulation with max 2 failures
      optimizer.enableFailureSimulation({
        enabled: true,
        failureRate: 1.0,
        failureTypes: ['optimization_error'],
        targetOperations: ['process_change'],
        maxFailures: 2,
      });

      const event: WatchEvent = { type: 'add', path: file1, timestamp: new Date() };

      // First two attempts should fail
      await expect(optimizer.processChange(event)).rejects.toThrow('Simulated optimization error');
      await expect(optimizer.processChange(event)).rejects.toThrow('Simulated optimization error');

      // Third attempt should succeed (no more failures allowed)
      const results = await optimizer.processChange(event);
      expect(results).toHaveLength(1);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle parallel optimization correctly', async () => {
      const files = Array.from({ length: 5 }, (_, i) => join(tempDir, `parallel${i}.css`));

      // Create test files
      await Promise.all(
        files.map((file, i) =>
          fs.writeFile(file, `.parallel${i} { color: hsl(${i * 60}, 50%, 50%); }`)
        )
      );

      const events: WatchEvent[] = files.map((file) => ({
        type: 'add',
        path: file,
        timestamp: new Date(),
      }));

      // Process all files in parallel
      const startTime = Date.now();
      const results = await Promise.all(events.map((event) => optimizer.processChange(event)));
      const duration = Date.now() - startTime;

      // All should succeed
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(true);
      });

      // Check final state
      const stats = optimizer.getStats();
      expect(stats.files).toBe(5);

      // Should complete reasonably quickly with parallel processing
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should respect concurrency limits', async () => {
      // Create optimizer with low concurrency
      const limitedOptimizer = new EnhancedIncrementalOptimizer({
        enabled: true,
        cacheDir: join(tempDir, '.cache-limited'),
        maxConcurrency: 1,
        parallelOptimization: true,
      });

      const files = Array.from({ length: 3 }, (_, i) => join(tempDir, `limited${i}.css`));

      await Promise.all(files.map((file, i) => fs.writeFile(file, `.limited${i} { color: red; }`)));

      const events: WatchEvent[] = files.map((file) => ({
        type: 'add',
        path: file,
        timestamp: new Date(),
      }));

      // Should still process all files correctly despite low concurrency
      const results = await Promise.all(
        events.map((event) => limitedOptimizer.processChange(event))
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(true);
      });

      await limitedOptimizer.shutdown();
    });
  });

  describe('Integration and Edge Cases', () => {
    it('should handle mixed file operations', async () => {
      const file1 = join(tempDir, 'mixed1.css');
      const file2 = join(tempDir, 'mixed2.css');

      await fs.writeFile(file1, '.mixed1 { color: red; }');
      await fs.writeFile(file2, '.mixed2 { color: blue; }');

      // Add files
      await optimizer.processChange({ type: 'add', path: file1, timestamp: new Date() });
      await optimizer.processChange({ type: 'add', path: file2, timestamp: new Date() });

      // Modify first file
      await fs.writeFile(file1, '.mixed1 { color: green; background: white; }');
      await optimizer.processChange({ type: 'change', path: file1, timestamp: new Date() });

      // Delete second file
      await optimizer.processChange({ type: 'unlink', path: file2, timestamp: new Date() });

      const stats = optimizer.getStats();
      expect(stats.files).toBe(1); // Only file1 should remain
    });

    it('should provide comprehensive statistics', async () => {
      const file1 = join(tempDir, 'stats-test.css');
      await fs.writeFile(file1, '.stats { color: red; }');

      await optimizer.processChange({ type: 'add', path: file1, timestamp: new Date() });

      const stats = optimizer.getStats();
      expect(stats).toHaveProperty('files');
      expect(stats).toHaveProperty('lastBuild');
      expect(stats).toHaveProperty('strategies');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('processQueueSize');

      const enhancedStats = optimizer.getEnhancedStats();
      expect(enhancedStats).toHaveProperty('base');
      expect(enhancedStats).toHaveProperty('atomic');
      expect(enhancedStats).toHaveProperty('integrity');
      expect(enhancedStats).toHaveProperty('simulation');
    });

    it('should handle optimization strategies correctly', async () => {
      // Add custom strategy
      optimizer.addStrategy({
        id: 'test-strategy',
        name: 'Test Strategy',
        priority: 10,
        canOptimize: (filePath) => filePath.endsWith('.test'),
        extractDependencies: async () => [],
        optimize: async (filePath) => ({
          success: true,
          duration: 100,
          filesProcessed: 1,
          bytesOptimized: 50,
          warnings: [],
          errors: [],
          metadata: { custom: true, filePath },
        }),
      });

      const testFile = join(tempDir, 'custom.test');
      await fs.writeFile(testFile, 'test content');

      const results = await optimizer.processChange({
        type: 'add',
        path: testFile,
        timestamp: new Date(),
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].metadata.custom).toBe(true);

      // Remove strategy
      optimizer.removeStrategy('test-strategy');

      // Should now skip optimization
      const file2 = join(tempDir, 'custom2.test');
      await fs.writeFile(file2, 'test content 2');

      const results2 = await optimizer.processChange({
        type: 'add',
        path: file2,
        timestamp: new Date(),
      });
      expect(results2).toHaveLength(1);
      expect(results2[0].warnings).toContain('No optimization strategy found');
    });
  });
});

describe('Atomic Operations Manager Integration', () => {
  it('should track atomic operations correctly', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'atomic-test-'));
    const optimizer = new EnhancedIncrementalOptimizer({
      cacheDir: join(tempDir, '.cache'),
    });

    try {
      const file1 = join(tempDir, 'atomic.css');
      await fs.writeFile(file1, '.atomic { color: red; }');

      await optimizer.processChange({ type: 'add', path: file1, timestamp: new Date() });

      const atomicStats = atomicOpManager.getStats();
      expect(atomicStats.totalOperations).toBeGreaterThan(0);
      expect(atomicStats.successfulOperations).toBeGreaterThan(0);
      expect(atomicStats.failedOperations).toBe(0);
    } finally {
      await optimizer.shutdown();
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
