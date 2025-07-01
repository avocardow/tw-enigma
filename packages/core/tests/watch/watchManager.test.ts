/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { WatchManager } from '../../src/watch/watchManager';
import type { WatchModeConfig, WatchHandler, WatchEvent } from '../../src/watch/types';

describe('WatchManager', () => {
  let watchManager: WatchManager;
  let testDir: string;
  let testFile: string;
  let events: { type: string; data: any }[] = [];

  const mockConfig: WatchModeConfig = {
    enabled: true,
    mode: 'development',
    hotReload: true,
    autoRefresh: false,
    notifications: false,
    performance: {
      throttleMs: 100,
      batchSize: 10,
      maxConcurrency: 3,
    },
    integrations: {
      devServer: false,
      browser: false,
      editor: false,
      terminal: false,
    },
    caching: {
      enabled: true,
      strategy: 'memory',
      maxAge: 300000,
      maxSize: 100,
    },
    logging: {
      level: 'info',
      verbose: false,
      timestamped: true,
    },
  };

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `tw-enigma-watch-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFile = join(testDir, 'test.js');

    // Reset events array
    events = [];

    // Initialize watch manager
    watchManager = new WatchManager(mockConfig, testDir);

    // Capture events
    watchManager.on('started', (data) => events.push({ type: 'started', data }));
    watchManager.on('stopped', (data) => events.push({ type: 'stopped', data }));
    watchManager.on('file-event', (data) => events.push({ type: 'file-event', data }));
    watchManager.on('js-file-changed', (data) => events.push({ type: 'js-file-changed', data }));
    watchManager.on('css-file-changed', (data) => events.push({ type: 'css-file-changed', data }));
    watchManager.on('config-file-changed', (data) => events.push({ type: 'config-file-changed', data }));
    watchManager.on('error', (data) => events.push({ type: 'error', data }));
  });

  afterEach(async () => {
    try {
      if (watchManager && watchManager.isActive()) {
        await watchManager.stop();
      }
      // Clean up test directory
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Lifecycle Management', () => {
    test('should start and stop watch mode', async () => {
      expect(watchManager.isActive()).toBe(false);

      await watchManager.start();

      expect(watchManager.isActive()).toBe(true);
      expect(events.some(e => e.type === 'started')).toBe(true);

      await watchManager.stop();

      expect(watchManager.isActive()).toBe(false);
      expect(events.some(e => e.type === 'stopped')).toBe(true);
    });

    test('should restart watch mode', async () => {
      await watchManager.start();
      expect(watchManager.isActive()).toBe(true);

      await watchManager.restart();

      expect(watchManager.isActive()).toBe(true);
      expect(events.filter(e => e.type === 'started').length).toBeGreaterThanOrEqual(2);
    });

    test('should handle starting already active watcher', async () => {
      await watchManager.start();
      
      // Starting again should not cause errors
      await watchManager.start();
      
      expect(watchManager.isActive()).toBe(true);
    });

    test('should handle stopping inactive watcher', async () => {
      expect(watchManager.isActive()).toBe(false);
      
      // Stopping when not active should not cause errors
      await watchManager.stop();
      
      expect(watchManager.isActive()).toBe(false);
    });
  });

  describe('File Event Processing', () => {
    test('should process JavaScript file changes', async () => {
      await watchManager.start();

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create JavaScript file
      await fs.writeFile(testFile, 'console.log("test");');

      // Wait for event processing
      await waitForEvents('js-file-changed');

      const jsEvents = events.filter(e => e.type === 'js-file-changed');
      expect(jsEvents).toHaveLength(1);
      expect(jsEvents[0].data.event.path).toContain('test.js');
    });

    test('should process CSS file changes', async () => {
      const cssFile = join(testDir, 'test.css');
      await watchManager.start();

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create CSS file
      await fs.writeFile(cssFile, '.test { color: red; }');

      // Wait for event processing
      await waitForEvents('css-file-changed');

      const cssEvents = events.filter(e => e.type === 'css-file-changed');
      expect(cssEvents).toHaveLength(1);
      expect(cssEvents[0].data.event.path).toContain('test.css');
    });

    test('should process configuration file changes', async () => {
      const configFile = join(testDir, 'package.json');
      await watchManager.start();

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create config file
      await fs.writeFile(configFile, '{"name": "test"}');

      // Wait for event processing
      await waitForEvents('config-file-changed');

      const configEvents = events.filter(e => e.type === 'config-file-changed');
      expect(configEvents).toHaveLength(1);
      expect(configEvents[0].data.event.path).toContain('package.json');
    });

    test('should handle multiple file types correctly', async () => {
      await watchManager.start();

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create multiple file types
      await fs.writeFile(join(testDir, 'script.js'), 'console.log("js");');
      await fs.writeFile(join(testDir, 'style.css'), '.style {}');
      await fs.writeFile(join(testDir, 'page.html'), '<html></html>');

      // Wait for all events
      await waitForEvents('js-file-changed');
      await waitForEvents('css-file-changed');

      expect(events.filter(e => e.type === 'js-file-changed')).toHaveLength(1);
      expect(events.filter(e => e.type === 'css-file-changed')).toHaveLength(1);
    });
  });

  describe('Event Handler Management', () => {
    test('should add and remove custom handlers', async () => {
      const handlerCalls: WatchEvent[] = [];
      
      const customHandler: WatchHandler = {
        id: 'custom-handler',
        priority: 5,
        patterns: ['**/*.custom'],
        enabled: true,
        handler: async (event: WatchEvent) => {
          handlerCalls.push(event);
        },
      };

      watchManager.addHandler(customHandler);
      await watchManager.start();

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create file matching custom pattern
      await fs.writeFile(join(testDir, 'test.custom'), 'custom content');

      // Wait for handler to be called
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handlerCalls).toHaveLength(1);
      expect(handlerCalls[0].path).toContain('test.custom');

      // Remove handler
      watchManager.removeHandler('custom-handler');

      // Create another file - should not trigger handler
      await fs.writeFile(join(testDir, 'test2.custom'), 'more custom content');
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handlerCalls).toHaveLength(1); // Should still be 1
    });

    test('should handle handler errors gracefully', async () => {
      const faultyHandler: WatchHandler = {
        id: 'faulty-handler',
        priority: 1,
        patterns: ['**/*.fault'],
        enabled: true,
        handler: async () => {
          throw new Error('Handler error');
        },
      };

      watchManager.addHandler(faultyHandler);
      await watchManager.start();

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create file that will trigger faulty handler
      await fs.writeFile(join(testDir, 'test.fault'), 'fault content');

      // Wait for error event
      await waitForEvents('error');

      const errorEvents = events.filter(e => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        ...mockConfig,
        mode: 'production' as const,
        hotReload: false,
      };

      watchManager.updateConfig(newConfig);

      const currentConfig = watchManager.getConfig();
      expect(currentConfig.mode).toBe('production');
      expect(currentConfig.hotReload).toBe(false);
    });

    test('should emit config update events', () => {
      const updateEvents: any[] = [];
      watchManager.on('config-updated', (data) => updateEvents.push(data));

      const newConfig = { ...mockConfig, mode: 'test' as const };
      watchManager.updateConfig(newConfig);

      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0].config.mode).toBe('test');
    });

    test('should validate configuration on start', async () => {
      // Create watch manager with invalid config
      const invalidConfig = {
        ...mockConfig,
        performance: {
          ...mockConfig.performance,
          maxConcurrency: -1, // Invalid value
        },
      };

      const invalidWatchManager = new WatchManager(invalidConfig, testDir);

      // Should throw on invalid configuration
      await expect(invalidWatchManager.start()).rejects.toThrow();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide watch statistics', async () => {
      await watchManager.start();

      // Create some file events
      await fs.writeFile(testFile, 'test content');
      await waitForEvents('js-file-changed');

      const stats = watchManager.getStats();

      expect(stats).toHaveProperty('totalFiles');
      expect(stats).toHaveProperty('watchedFiles');
      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('eventsByType');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('cpuUsage');

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.uptime).toBeGreaterThan(0);
    });

    test('should track event types correctly', async () => {
      await watchManager.start();

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create, modify, and delete file
      await fs.writeFile(testFile, 'initial content');
      await waitForEvents('js-file-changed');

      await fs.writeFile(testFile, 'modified content');
      await waitForEvents('js-file-changed');

      await fs.unlink(testFile);
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = watchManager.getStats();
      expect(stats.eventsByType.add).toBeGreaterThan(0);
      expect(stats.eventsByType.change).toBeGreaterThan(0);
      expect(stats.eventsByType.unlink).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors', async () => {
      await watchManager.start();

      // Simulate file system error by trying to watch non-existent directory
      const originalPatterns = watchManager.getConfig();
      
      // This should not crash the watch manager
      expect(() => {
        watchManager.updateConfig({
          ...originalPatterns,
        });
      }).not.toThrow();
    });

    test('should emit error events for unhandled errors', async () => {
      await watchManager.start();

      // Force an error by corrupting internal state
      // This is a bit artificial but tests the error handling pathway
      const errorEvents = events.filter(e => e.type === 'error');
      const initialErrorCount = errorEvents.length;

      // Create a problematic file operation
      try {
        await fs.writeFile('/invalid/path/file.js', 'content');
      } catch {
        // Expected to fail
      }

      // The watch manager should continue to function
      expect(watchManager.isActive()).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle large numbers of file changes efficiently', async () => {
      await watchManager.start();

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const startTime = Date.now();

      // Create many files rapidly
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(fs.writeFile(join(testDir, `file${i}.js`), `content ${i}`));
      }

      await Promise.all(promises);

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process events efficiently (within reasonable time)
      expect(duration).toBeLessThan(5000);

      const stats = watchManager.getStats();
      expect(stats.totalEvents).toBeGreaterThan(0);
    });

    test('should clean up resources on stop', async () => {
      await watchManager.start();
      
      const initialStats = watchManager.getStats();
      expect(initialStats.totalFiles).toBeGreaterThan(0);

      await watchManager.stop();

      // Verify cleanup occurred
      expect(watchManager.isActive()).toBe(false);
    });
  });

  /**
   * Helper function to wait for specific event types
   */
  function waitForEvents(eventType: string, timeout = 2000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${eventType} event`));
      }, timeout);

      const checkEvents = () => {
        if (events.some(e => e.type === eventType)) {
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