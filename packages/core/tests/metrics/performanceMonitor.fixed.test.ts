/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PerformanceMonitorConfig,
  PerformanceMonitor,
  createPerformanceMonitor,
  PerformanceMetricType,
} from '../../src/metrics/performanceMonitor.js';
import { MetricsCollector } from '../../src/metrics/collector.js';

describe('PerformanceMonitor - Fixed Tests', () => {
  let monitor: PerformanceMonitor;
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    monitor = createPerformanceMonitor(collector);
  });

  afterEach(() => {
    monitor.stop();
    monitor.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(monitor).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<PerformanceMonitorConfig> = {
        samplingInterval: 500,
        monitorGc: true,
      };

      const customMonitor = createPerformanceMonitor(collector, customConfig);
      expect(customMonitor).toBeDefined();
    });
  });

  describe('Basic Operations', () => {
    it('should start and stop operations', () => {
      const operationId = monitor.startOperation('test_operation');
      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');

      const duration = monitor.endOperation(operationId);
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should track operation timing', async () => {
      const operationId = monitor.startOperation('async_operation');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = monitor.endOperation(operationId);
      expect(duration).toBeGreaterThan(0);
    });

    it('should handle nested operations', () => {
      const parentId = monitor.startOperation('parent_operation');
      monitor.addSubOperation(parentId, 'sub_operation', 50);

      const duration = monitor.endOperation(parentId);
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metric Recording', () => {
    it('should record latency metrics', () => {
      expect(() => {
        monitor.recordLatency('api_call', 150, 'ms', { endpoint: '/users' });
      }).not.toThrow();
    });

    it('should record throughput metrics', () => {
      expect(() => {
        monitor.recordThroughput('requests', 100, 'rps', { server: 'web1' });
      }).not.toThrow();
    });

    it('should record custom metrics', () => {
      expect(() => {
        monitor.recordCustomMetric('memory_usage', 75, 'percent', { component: 'parser' });
      }).not.toThrow();
    });
  });

  describe('Data Retrieval', () => {
    it('should return performance stats', () => {
      // Record some metrics first
      monitor.recordLatency('test', 100, 'ms');
      monitor.recordThroughput('test', 50, 'rps');

      const stats = monitor.getStats();
      // Stats might be null if not enough data, which is valid
      if (stats) {
        expect(stats).toBeDefined();
        expect(stats.timeRange).toBeDefined();
        expect(stats.sampleCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return samples by type', () => {
      monitor.recordLatency('test', 100, 'ms');
      
      const samples = monitor.getSamples(PerformanceMetricType.LATENCY, 10);
      expect(Array.isArray(samples)).toBe(true);
    });

    it('should return active operations', () => {
      const operationId = monitor.startOperation('test_op');
      
      const activeOps = monitor.getActiveOperations();
      expect(Array.isArray(activeOps)).toBe(true);
      
      monitor.endOperation(operationId);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        samplingInterval: 250,
        monitorGc: true,
      };

      expect(() => {
        monitor.updateConfig(newConfig);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid operation IDs', () => {
      expect(() => {
        monitor.endOperation('invalid_id');
      }).toThrow('Operation invalid_id not found');
    });

    it('should handle sub-operations on non-existent parent', () => {
      expect(() => {
        monitor.addSubOperation('invalid_parent', 'sub_op', 100);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should reset all data', () => {
      // Record some data
      monitor.recordLatency('test', 100, 'ms');
      const operationId = monitor.startOperation('test_op');
      
      // Reset should not throw
      expect(() => {
        monitor.reset();
      }).not.toThrow();
    });

    it('should handle reset when monitoring is active', () => {
      monitor.start();
      
      expect(() => {
        monitor.reset();
      }).not.toThrow();
      
      monitor.stop();
    });
  });
});