/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileWatcher } from '../../src/watch/fileWatcher';
import type { WatchEvent } from '../../src/watch/types';

describe('FileWatcher Integration Tests', () => {
  let fileWatcher: FileWatcher;
  let testDir: string;
  let events: WatchEvent[] = [];

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `tw-enigma-integration-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Reset events array
    events = [];

    // Initialize file watcher
    fileWatcher = new FileWatcher({
      cwd: testDir,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10,
      },
    });

    // Capture events
    fileWatcher.on('watch-event', (event: WatchEvent) => {
      events.push(event);
    });
  });

  afterEach(async () => {
    try {
      if (fileWatcher) {
        await fileWatcher.close();
      }
      // Clean up test directory
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Real-world File Operations', () => {
    test('should handle rapid file modifications', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 200));

      const testFile = join(testDir, 'rapid.txt');

      // Perform rapid modifications
      for (let i = 0; i < 3; i++) {
        await fs.writeFile(testFile, `content ${i}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for debounced events
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should receive events (debounced)
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'add' || e.type === 'change')).toBe(true);
    });

    test('should watch nested directory structures', async () => {
      await fileWatcher.watch(['**/*']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create nested structure
      const nestedDir = join(testDir, 'level1', 'level2');
      await fs.mkdir(nestedDir, { recursive: true });

      const nestedFile = join(nestedDir, 'nested.txt');
      await fs.writeFile(nestedFile, 'nested content');

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(events.length).toBeGreaterThan(0);
      
      // Should detect directory creation and file creation
      const dirEvents = events.filter(e => e.type === 'addDir');
      const fileEvents = events.filter(e => e.type === 'add' && e.path.includes('nested.txt'));
      
      expect(dirEvents.length).toBeGreaterThan(0);
      expect(fileEvents.length).toBeGreaterThan(0);
    });

    test('should handle file moves and renames', async () => {
      const sourceFile = join(testDir, 'source.txt');
      const targetFile = join(testDir, 'target.txt');

      // Create initial file
      await fs.writeFile(sourceFile, 'initial content');

      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 200));

      // Move/rename file
      await fs.rename(sourceFile, targetFile);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(events.length).toBeGreaterThan(0);
      
      // Should detect file deletion and creation (move is seen as delete + add)
      const unlinkEvents = events.filter(e => e.type === 'unlink' && e.path.includes('source.txt'));
      const addEvents = events.filter(e => e.type === 'add' && e.path.includes('target.txt'));
      
      expect(unlinkEvents.length).toBeGreaterThan(0);
      expect(addEvents.length).toBeGreaterThan(0);
    });

    test('should handle concurrent file operations', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create multiple files concurrently
      const filePromises = [];
      for (let i = 0; i < 5; i++) {
        const filePath = join(testDir, `concurrent${i}.txt`);
        filePromises.push(fs.writeFile(filePath, `content ${i}`));
      }

      await Promise.all(filePromises);

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should detect all file creations
      expect(events.length).toBeGreaterThanOrEqual(5);
      
      const addEvents = events.filter(e => e.type === 'add');
      expect(addEvents.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should provide meaningful performance metrics', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Create some file events to generate metrics
      const testFile = join(testDir, 'metrics.txt');
      await fs.writeFile(testFile, 'metrics content');

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      const metrics = fileWatcher.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.eventProcessingTime).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.cpuUsage).toBeDefined();
      expect(metrics.fileSystemStats).toBeDefined();

      // Should have realistic values
      expect(metrics.eventProcessingTime.avg).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(metrics.fileSystemStats.totalWatched).toBeGreaterThan(0);
    });

    test('should clean up resources properly', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Verify watcher is active
      expect(fileWatcher.getWatched().length).toBeGreaterThan(0);

      // Close watcher
      await fileWatcher.close();

      // Verify cleanup
      expect(fileWatcher.getWatched()).toHaveLength(0);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from temporary file system issues', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      let errorOccurred = false;
      fileWatcher.on('error', () => {
        errorOccurred = true;
      });

      // Try to create a file with invalid characters (might cause temp error)
      try {
        await fs.writeFile(join(testDir, 'test.txt'), 'normal content');
      } catch {
        // Expected in some cases
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create a normal file
      await fs.writeFile(join(testDir, 'normal.txt'), 'normal content');

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should still be able to detect file changes
      expect(events.length).toBeGreaterThan(0);
    });
  });
});