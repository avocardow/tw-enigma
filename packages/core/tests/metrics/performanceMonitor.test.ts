/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PerformanceConfig,
  PerformanceMonitor,
  createPerformanceMonitor,
} from '../../src/metrics/performanceMonitor.js';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = createPerformanceMonitor();
  });

  afterEach(() => {
    monitor.stop();
    monitor.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(monitor).toBeDefined();
      expect(monitor.isRunning()).toBe(false);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<PerformanceConfig> = {
        sampleInterval: 500,
        enableGC: true,
      };

      const customMonitor = createPerformanceMonitor(customConfig);
      expect(customMonitor).toBeDefined();
    });
  });

  describe('Basic Monitoring', () => {
    it('should start and stop monitoring', () => {
      expect(monitor.isRunning()).toBe(false);

      monitor.start();
      expect(monitor.isRunning()).toBe(true);

      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it('should collect performance statistics', async () => {
      monitor.start();

      // Let it collect some data
      await new Promise((resolve) => setTimeout(resolve, 100));

      monitor.stop();

      const stats = monitor.getStats();
      expect(stats).toBeDefined();
      expect(stats.cpu).toBeDefined();
      expect(stats.memory).toBeDefined();
    });
  });

  describe('CPU Monitoring', () => {
    it('should track CPU usage', async () => {
      monitor.start();

      // Simulate some CPU work
      const start = Date.now();
      while (Date.now() - start < 50) {
        // Busy wait to consume CPU
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      monitor.stop();

      const stats = monitor.getStats();
      expect(stats.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(stats.cpu.usage).toBeLessThanOrEqual(100);
    });

    it('should track CPU load trends', async () => {
      monitor.start();

      // Generate multiple CPU load measurements
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Busy wait
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      monitor.stop();

      const stats = monitor.getStats();
      expect(stats.cpu.samples).toBeGreaterThan(0);
      expect(stats.cpu.trend).toBeDefined();
    });
  });

  describe('Memory Monitoring', () => {
    it('should track memory usage', () => {
      monitor.start();

      // Allocate some memory
      const largeArray = new Array(100000).fill('test');

      monitor.stop();

      const stats = monitor.getStats();
      expect(stats.memory.heapUsed).toBeGreaterThan(0);
      expect(stats.memory.heapTotal).toBeGreaterThan(0);
      expect(stats.memory.external).toBeGreaterThanOrEqual(0);

      // Clean up
      largeArray.length = 0;
    });

    it('should detect memory leaks', async () => {
      monitor.start();

      const initialStats = monitor.getStats();

      // Simulate potential memory leak
      const leakArray: any[] = [];
      for (let i = 0; i < 1000; i++) {
        leakArray.push(new Array(100).fill(Math.random()));
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalStats = monitor.getStats();
      monitor.stop();

      const memoryGrowth = finalStats.memory.heapUsed - initialStats.memory.heapUsed;
      expect(memoryGrowth).toBeGreaterThan(0);

      // Clean up
      leakArray.length = 0;
    });
  });

  describe('GC Monitoring', () => {
    it('should monitor garbage collection when enabled', () => {
      const gcMonitor = createPerformanceMonitor({ enableGC: true });

      gcMonitor.start();

      // Force some allocations
      for (let i = 0; i < 1000; i++) {
        const temp = new Array(100).fill(i);
      }

      gcMonitor.stop();

      const stats = gcMonitor.getStats();
      expect(stats.gc).toBeDefined();
    });
  });

  describe('Event Loop Monitoring', () => {
    it('should track event loop lag', async () => {
      monitor.start();

      // Create some event loop delay
      const start = Date.now();
      while (Date.now() - start < 50) {
        // Blocking operation
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      monitor.stop();

      const stats = monitor.getStats();
      expect(stats.eventLoop).toBeDefined();
      expect(stats.eventLoop.lag).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Snapshots', () => {
    it('should capture performance snapshots', () => {
      monitor.start();

      const snapshot1 = monitor.captureSnapshot();
      expect(snapshot1).toBeDefined();
      expect(snapshot1.timestamp).toBeDefined();
      expect(snapshot1.cpu).toBeDefined();
      expect(snapshot1.memory).toBeDefined();

      monitor.stop();
    });

    it('should compare performance snapshots', () => {
      monitor.start();

      const snapshot1 = monitor.captureSnapshot();

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 20) {
        // Some work
      }

      const snapshot2 = monitor.captureSnapshot();

      const comparison = monitor.compareSnapshots(snapshot1, snapshot2);
      expect(comparison).toBeDefined();
      expect(comparison.timeDiff).toBeGreaterThan(0);

      monitor.stop();
    });
  });

  describe('Thresholds and Alerts', () => {
    it('should trigger alerts when thresholds are exceeded', () => {
      const alertHandler = vi.fn();
      monitor.on('threshold_exceeded', alertHandler);

      monitor.setThreshold('cpu', 80); // 80% CPU threshold
      monitor.start();

      // Simulate high CPU usage by setting a mock value
      monitor.simulateHighCPU();

      monitor.stop();

      expect(alertHandler).toHaveBeenCalled();
    });

    it('should support custom threshold handlers', () => {
      const customHandler = vi.fn();

      monitor.addThresholdHandler('memory', 1000000, customHandler);
      monitor.start();

      // Simulate high memory usage
      monitor.simulateHighMemory();

      monitor.stop();

      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe('Historical Data', () => {
    it('should maintain performance history', async () => {
      monitor.start();

      // Generate some history
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      monitor.stop();

      const history = monitor.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].timestamp).toBeDefined();
    });

    it('should limit history size', async () => {
      const limitedMonitor = createPerformanceMonitor({ maxHistorySize: 3 });

      limitedMonitor.start();

      // Generate more entries than the limit
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      limitedMonitor.stop();

      const history = limitedMonitor.getHistory();
      expect(history.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Performance Analysis', () => {
    it('should analyze performance trends', async () => {
      monitor.start();

      // Generate trend data
      for (let i = 0; i < 10; i++) {
        // Gradually increase load
        const start = Date.now();
        while (Date.now() - start < i * 2) {
          // Increasing work
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      monitor.stop();

      const analysis = monitor.analyzePerformance();
      expect(analysis).toBeDefined();
      expect(analysis.trends).toBeDefined();
    });

    it('should identify performance bottlenecks', () => {
      monitor.start();

      // Simulate various bottlenecks
      monitor.simulateHighCPU();
      monitor.simulateHighMemory();
      monitor.simulateEventLoopLag();

      monitor.stop();

      const bottlenecks = monitor.identifyBottlenecks();
      expect(bottlenecks).toBeDefined();
      expect(Array.isArray(bottlenecks)).toBe(true);
    });
  });

  describe('Export and Reporting', () => {
    it('should export performance data', async () => {
      monitor.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      monitor.stop();

      const exportData = monitor.exportData();
      expect(exportData).toBeDefined();
      expect(exportData.metadata).toBeDefined();
      expect(exportData.stats).toBeDefined();
      expect(exportData.history).toBeDefined();
    });

    it('should generate performance reports', async () => {
      monitor.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      monitor.stop();

      const report = monitor.generateReport();
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle monitoring errors gracefully', () => {
      // Simulate an error condition
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        monitor.start();
        monitor.simulateMonitoringError();
        monitor.stop();
      }).not.toThrow();

      errorSpy.mockRestore();
    });

    it('should continue monitoring after errors', () => {
      monitor.start();

      // Simulate error
      monitor.simulateMonitoringError();

      // Should still be running
      expect(monitor.isRunning()).toBe(true);

      // Should still collect data
      const stats = monitor.getStats();
      expect(stats).toBeDefined();

      monitor.stop();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration at runtime', () => {
      const newConfig = {
        sampleInterval: 250,
        enableGC: true,
      };

      monitor.updateConfig(newConfig);

      const config = monitor.getConfig();
      expect(config.sampleInterval).toBe(250);
      expect(config.enableGC).toBe(true);
    });

    it('should emit configuration change events', () => {
      const changeHandler = vi.fn();
      monitor.on('config_changed', changeHandler);

      monitor.updateConfig({ sampleInterval: 500 });

      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources on stop', () => {
      monitor.start();

      const initialResourceCount = monitor.getActiveResourceCount();

      monitor.stop();

      const finalResourceCount = monitor.getActiveResourceCount();
      expect(finalResourceCount).toBeLessThanOrEqual(initialResourceCount);
    });

    it('should clean up resources on reset', async () => {
      monitor.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      monitor.reset();

      const stats = monitor.getStats();
      const history = monitor.getHistory();

      expect(Object.keys(stats).length).toBe(0);
      expect(history.length).toBe(0);
    });
  });
});
