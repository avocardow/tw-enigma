/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { FileWatcher } from '../../src/watch/fileWatcher';
import type { WatchConfig, WatchEvent, WatchEventType } from '../../src/watch/types';

describe('FileWatcher', () => {
  let fileWatcher: FileWatcher;
  let testDir: string;
  let testFile: string;
  let events: WatchEvent[] = [];

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `tw-enigma-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFile = join(testDir, 'test.txt');

    // Reset events array
    events = [];

    // Initialize file watcher
    fileWatcher = new FileWatcher({
      cwd: testDir,
      ignoreInitial: true,
      persistent: true,
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

  describe('Basic File Watching', () => {
    test('should watch file creation', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create test file
      await fs.writeFile(testFile, 'test content');

      // Wait for event
      await waitForEvents(1, 3000);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('add');
      expect(events[0].path).toBe(resolve(testFile));
    });

    test('should watch file modification', async () => {
      // Create file first
      await fs.writeFile(testFile, 'initial content');

      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Modify file
      await fs.writeFile(testFile, 'modified content');

      // Wait for event
      await waitForEvents(1, 3000);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('change');
      expect(events[0].path).toBe(resolve(testFile));
    });

    test('should watch file deletion', async () => {
      // Create file first
      await fs.writeFile(testFile, 'content to delete');

      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Delete file
      await fs.unlink(testFile);

      // Wait for event
      await waitForEvents(1, 3000);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('unlink');
      expect(events[0].path).toBe(resolve(testFile));
    });

    test('should watch directory creation', async () => {
      await fileWatcher.watch(['**/*']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      const testSubDir = join(testDir, 'subdir');
      await fs.mkdir(testSubDir);

      // Wait for event
      await waitForEvents(1, 3000);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('addDir');
      expect(events[0].path).toBe(resolve(testSubDir));
    });

    test('should watch directory deletion', async () => {
      const testSubDir = join(testDir, 'subdir');
      await fs.mkdir(testSubDir);

      await fileWatcher.watch(['**/*']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      await fs.rmdir(testSubDir);

      // Wait for event
      await waitForEvents(1, 3000);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('unlinkDir');
      expect(events[0].path).toBe(resolve(testSubDir));
    });
  });

  describe('Pattern Matching', () => {
    test('should watch only matching patterns', async () => {
      await fileWatcher.watch(['**/*.js']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create files with different extensions
      await fs.writeFile(join(testDir, 'test.js'), 'console.log("test");');
      await fs.writeFile(join(testDir, 'test.txt'), 'text content');
      await fs.writeFile(join(testDir, 'test.css'), '.test { color: red; }');

      // Wait for events
      await waitForEvents(1, 2000);

      // Should only detect the .js file
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('add');
      expect(events[0].path).toContain('test.js');
    });

    test('should handle multiple patterns', async () => {
      await fileWatcher.watch(['**/*.js', '**/*.css']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create files with different extensions
      await fs.writeFile(join(testDir, 'test.js'), 'console.log("test");');
      await fs.writeFile(join(testDir, 'test.txt'), 'text content');
      await fs.writeFile(join(testDir, 'test.css'), '.test { color: red; }');

      // Wait for events
      await waitForEvents(2, 2000);

      // Should detect both .js and .css files
      expect(events.length).toBeGreaterThanOrEqual(2);
      const paths = events.map(e => e.path);
      expect(paths.some(p => p.includes('test.js'))).toBe(true);
      expect(paths.some(p => p.includes('test.css'))).toBe(true);
    });

    test('should respect ignored patterns', async () => {
      const config: Partial<WatchConfig> = {
        ignored: ['**/ignored/**', '**/*.log'],
      };

      fileWatcher = new FileWatcher({ ...config, cwd: testDir });
      events = [];
      fileWatcher.on('watch-event', (event: WatchEvent) => {
        events.push(event);
      });

      await fileWatcher.watch(['**/*']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Small delay to ensure watcher is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create ignored directory and file
      const ignoredDir = join(testDir, 'ignored');
      await fs.mkdir(ignoredDir);
      await fs.writeFile(join(ignoredDir, 'file.txt'), 'ignored content');
      await fs.writeFile(join(testDir, 'test.log'), 'log content');
      await fs.writeFile(join(testDir, 'regular.txt'), 'regular content');

      // Wait for events
      await waitForEvents(1, 2000);

      // Should only detect the regular file
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.some(e => e.path.includes('regular.txt'))).toBe(true);
    });
  });

  describe('Event Debouncing', () => {
    test('should debounce rapid file changes', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Rapidly modify file multiple times
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(testFile, `content ${i}`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for debounced events
      await waitForEvents(1, 2000);

      // Should receive fewer events due to debouncing
      expect(events.length).toBeLessThan(5);
      expect(events[0].type).toBe('change');
    });
  });

  describe('Resource Management', () => {
    test('should handle watcher errors gracefully', async () => {
      const errorHandler = vi.fn();
      fileWatcher.on('error', errorHandler);

      // Try to watch an invalid pattern
      try {
        await fileWatcher.watch(['/nonexistent/path/**']);
      } catch (error) {
        // Expected to fail
      }

      // Should emit error event
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(errorHandler).toHaveBeenCalled();
    });

    test('should clean up resources on close', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Verify watcher is active
      expect(fileWatcher.getWatched()).toContain('**/*.txt');

      await fileWatcher.close();

      // Verify cleanup
      expect(fileWatcher.getWatched()).toHaveLength(0);
    });

    test('should provide performance metrics', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Create some file events
      await fs.writeFile(testFile, 'content');
      await waitForEvents(1);

      const metrics = fileWatcher.getMetrics();

      expect(metrics).toHaveProperty('eventProcessingTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('fileSystemStats');
      expect(metrics.fileSystemStats.totalWatched).toBeGreaterThan(0);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('should handle symlinks when configured', async () => {
      // Skip on Windows due to permission requirements
      if (process.platform === 'win32') {
        return;
      }

      const realFile = join(testDir, 'real.txt');
      const symlinkFile = join(testDir, 'symlink.txt');

      await fs.writeFile(realFile, 'real content');
      await fs.symlink(realFile, symlinkFile);

      const config: Partial<WatchConfig> = {
        followSymlinks: true,
      };

      fileWatcher = new FileWatcher({ ...config, cwd: testDir });
      events = [];
      fileWatcher.on('watch-event', (event: WatchEvent) => {
        events.push(event);
      });

      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Modify the real file
      await fs.writeFile(realFile, 'modified content');

      // Wait for events
      await waitForEvents(1);

      expect(events.length).toBeGreaterThan(0);
    });

    test('should handle permission errors gracefully', async () => {
      const config: Partial<WatchConfig> = {
        ignorePermissionErrors: true,
      };

      fileWatcher = new FileWatcher({ ...config, cwd: testDir });

      // Should not throw on permission errors
      await expect(fileWatcher.watch(['**/*'])).resolves.not.toThrow();
    });
  });

  describe('Advanced Features', () => {
    test('should add and remove paths dynamically', async () => {
      await fileWatcher.watch(['**/*.txt']);

      // Add new path
      const newPattern = '**/*.js';
      fileWatcher.add([newPattern]);

      expect(fileWatcher.getWatched()).toContain(newPattern);

      // Remove path
      fileWatcher.remove([newPattern]);

      expect(fileWatcher.getWatched()).not.toContain(newPattern);
    });

    test('should support atomic writes', async () => {
      const config: Partial<WatchConfig> = {
        atomic: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      };

      fileWatcher = new FileWatcher({ ...config, cwd: testDir });
      events = [];
      fileWatcher.on('watch-event', (event: WatchEvent) => {
        events.push(event);
      });

      await fileWatcher.watch(['**/*.txt']);

      // Wait for watcher to be ready
      await new Promise((resolve) => {
        fileWatcher.on('ready', resolve);
      });

      // Write file atomically
      const tempFile = join(testDir, 'temp.txt');
      await fs.writeFile(tempFile, 'atomic content');
      await fs.rename(tempFile, testFile);

      // Wait for events
      await waitForEvents(1, 1000);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('add');
    });

    test('should validate patterns', async () => {
      await expect(fileWatcher.watch([])).rejects.toThrow('At least one watch pattern must be specified');
      await expect(fileWatcher.watch([''])).rejects.toThrow('Invalid watch pattern');
      await expect(fileWatcher.watch([null as any])).rejects.toThrow('Invalid watch pattern');
    });
  });

  /**
   * Helper function to wait for a specific number of events
   */
  function waitForEvents(count: number, timeout = 2000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${count} events, got ${events.length}`));
      }, timeout);

      const checkEvents = () => {
        if (events.length >= count) {
          clearTimeout(timer);
          resolve();
        } else {
          setTimeout(checkEvents, 10);
        }
      };

      checkEvents();
    });
  }
});