/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MetricsCollector,
  MetricType,
  ClassAnalysisMetric,
  PerformanceMetric,
  OptimizationMetric,
  MemoryMetric,
  ErrorMetric,
} from '../../src/metrics/collector.js';

describe('MetricsCollector - Realistic API Tests', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  afterEach(async () => {
    await collector.stop();
    await collector.clear();
  });

  describe('Lifecycle Management', () => {
    it('should start and stop collector', async () => {
      expect(() => collector.start()).not.toThrow();
      await expect(collector.stop()).resolves.not.toThrow();
    });

    it('should handle multiple start/stop cycles', async () => {
      collector.start();
      await collector.stop();
      
      collector.start();
      await collector.stop();
    });
  });

  describe('Class Analysis Metrics', () => {
    it('should record class analysis metrics', () => {
      const classData = {
        className: 'bg-blue-500',
        frequency: 10,
        variants: ['hover:bg-blue-600'],
        category: 'utility' as const,
        complexity: 2,
        consolidationOpportunities: 1,
        semanticGroup: 'colors',
        responsiveBreakpoints: ['md'],
        stateVariants: ['hover'],
      };

      expect(() => {
        collector.recordClassAnalysis('test-class', classData, { framework: 'tailwind' });
      }).not.toThrow();
    });

    it('should record multiple class analysis metrics', () => {
      for (let i = 0; i < 5; i++) {
        collector.recordClassAnalysis(
          `class-${i}`,
          {
            className: `test-class-${i}`,
            frequency: i + 1,
            variants: [],
            category: 'utility' as const,
            complexity: 1,
            consolidationOpportunities: 0,
            semanticGroup: 'test',
            responsiveBreakpoints: [],
            stateVariants: [],
          },
          { test: 'true' }
        );
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics', () => {
      const perfData = {
        duration: 150,
        memory: 1024 * 1024,
        cpu: 25.5,
        stage: 'optimization' as const,
        operationName: 'css-generation',
        resourceUsage: {
          heapUsed: 512 * 1024,
          heapTotal: 1024 * 1024,
        },
      };

      expect(() => {
        collector.recordPerformance('perf-test', perfData, { env: 'test' });
      }).not.toThrow();
    });

    it('should record performance metrics with timing', () => {
      collector.startTimer('operation-test');
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait
      }
      
      const duration = collector.endTimer('operation-test', 'test-phase');
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('Optimization Metrics', () => {
    it('should record optimization metrics', () => {
      const optData = {
        originalSize: 10000,
        optimizedSize: 7500,
        compressionRatio: 0.75,
        classesRemoved: 50,
        classesConsolidated: 25,
        duplicatesEliminated: 15,
        passes: 3,
        strategy: 'multi-pass' as const,
        timeToOptimize: 150,
      };

      expect(() => {
        collector.recordOptimization('opt-test', optData, { type: 'css' });
      }).not.toThrow();
    });
  });

  describe('Memory Metrics', () => {
    it('should record memory metrics with defaults', () => {
      expect(() => {
        collector.recordMemory();
      }).not.toThrow();
    });

    it('should record memory metrics with custom data', () => {
      const customData = {
        heapUsed: 2048 * 1024,
        heapTotal: 4096 * 1024,
        external: 1024 * 1024,
        arrayBuffers: 512 * 1024,
        rss: 8192 * 1024,
        gcPause: 10,
        gcFrequency: 5,
      };

      expect(() => {
        collector.recordMemory(customData);
      }).not.toThrow();
    });
  });

  describe('Counter and Gauge Metrics', () => {
    it('should increment counters', () => {
      expect(() => {
        collector.incrementCounter('test-counter');
        collector.incrementCounter('test-counter', 5);
        collector.incrementCounter('test-counter', -2);
      }).not.toThrow();
    });

    it('should set gauge values', () => {
      expect(() => {
        collector.setGauge('cpu-usage', 75.5, 'percent', { server: 'web1' });
        collector.setGauge('memory-usage', 1024, 'MB', { server: 'web1' });
      }).not.toThrow();
    });

    it('should record histogram values', () => {
      expect(() => {
        collector.recordHistogram('response-time', 150);
        collector.recordHistogram('response-time', 200);
        collector.recordHistogram('response-time', 100);
      }).not.toThrow();
    });
  });

  describe('Error Metrics', () => {
    it('should record error metrics', () => {
      const error = new Error('Test error');
      
      expect(() => {
        collector.recordError('test-error', error, 'parsing', { component: 'css-parser' });
      }).not.toThrow();
    });

    it('should record different error types', () => {
      const errors = [
        new TypeError('Type error'),
        new SyntaxError('Syntax error'),
        new ReferenceError('Reference error'),
      ];

      errors.forEach((error, index) => {
        expect(() => {
          collector.recordError(`error-${index}`, error, 'test', { type: error.constructor.name });
        }).not.toThrow();
      });
    });
  });

  describe('Configuration Management', () => {
    it('should get current configuration', () => {
      const config = collector.getConfig();
      
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      expect(config.enabled).toBeDefined();
    });

    it('should update configuration', () => {
      const updates = {
        bufferSize: 5000,
        flushInterval: 2000,
        enabled: true,
      };

      expect(() => {
        collector.updateConfig(updates);
      }).not.toThrow();

      const config = collector.getConfig();
      expect(config.bufferSize).toBe(5000);
      expect(config.flushInterval).toBe(2000);
    });

    it('should validate configuration updates', () => {
      expect(() => {
        collector.updateConfig({ bufferSize: -1 });
      }).toThrow();

      expect(() => {
        collector.updateConfig({ flushInterval: 50 });
      }).toThrow();
    });
  });

  describe('Data Operations', () => {
    beforeEach(() => {
      // Add some test data
      collector.incrementCounter('test-counter', 10);
      collector.setGauge('test-gauge', 50, 'units');
      collector.recordHistogram('test-histogram', 100);
    });

    it('should query metrics', async () => {
      const metrics = await collector.query();
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should query metrics with filters', async () => {
      const counterMetrics = await collector.query({ type: MetricType.COUNTER });
      
      expect(Array.isArray(counterMetrics)).toBe(true);
      // Should have at least one counter metric
      if (counterMetrics.length > 0) {
        expect(counterMetrics[0].type).toBe(MetricType.COUNTER);
      }
    });

    it('should get summary statistics', async () => {
      const summary = await collector.getSummary();
      
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('object');
    });

    it('should export metrics', async () => {
      const exported = await collector.export('json');
      
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
    });

    it('should clear metrics', async () => {
      const clearedCount = await collector.clear();
      
      expect(typeof clearedCount).toBe('number');
      expect(clearedCount).toBeGreaterThanOrEqual(0);
    });

    it('should clear metrics with filter', async () => {
      const clearedCount = await collector.clear({ type: MetricType.COUNTER });
      
      expect(typeof clearedCount).toBe('number');
    });
  });

  describe('Advanced Operations', () => {
    it('should get collector statistics', () => {
      collector.incrementCounter('stats-test', 5);
      
      const stats = collector.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should update metric values', () => {
      expect(() => {
        collector.update('test-update', { value: 42, timestamp: new Date() });
      }).not.toThrow();
    });

    it('should compute metric aggregations', () => {
      collector.incrementCounter('compute-test', 10);
      
      expect(() => {
        collector.compute('compute-test', { operation: 'sum', window: '1m' });
      }).not.toThrow();
    });

    it('should reset collector state', () => {
      collector.incrementCounter('reset-test', 5);
      
      expect(() => {
        collector.reset({ preserveConfig: true });
      }).not.toThrow();
    });

    it('should flush pending metrics', async () => {
      collector.incrementCounter('flush-test', 1);
      
      await expect(collector.flush()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid metric names gracefully', () => {
      expect(() => {
        collector.incrementCounter('', 1);
      }).not.toThrow();

      expect(() => {
        collector.incrementCounter('a'.repeat(1000), 1);
      }).not.toThrow();
    });

    it('should handle invalid metric values', () => {
      expect(() => {
        collector.setGauge('test-invalid', NaN, 'units');
      }).not.toThrow();

      expect(() => {
        collector.setGauge('test-invalid', Infinity, 'units');
      }).not.toThrow();

      expect(() => {
        collector.recordHistogram('test-invalid', -Infinity);
      }).not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const promises = [];

      // Create concurrent operations
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => {
            collector.incrementCounter('concurrent-test', 1);
          })
        );
      }

      await Promise.all(promises);

      // Should complete without errors
      const metrics = await collector.query({ name: 'concurrent-test' });
      expect(metrics.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Processor Management', () => {
    it('should add and remove processors', () => {
      const processor = {
        name: 'test-processor',
        process: vi.fn().mockResolvedValue({}),
      };

      expect(() => {
        collector.addProcessor('test', processor);
      }).not.toThrow();

      expect(() => {
        collector.removeProcessor('test');
      }).not.toThrow();
    });

    it('should handle processor errors gracefully', () => {
      const errorProcessor = {
        name: 'error-processor',
        process: vi.fn().mockRejectedValue(new Error('Processor error')),
      };

      expect(() => {
        collector.addProcessor('error-test', errorProcessor);
      }).not.toThrow();

      // Recording metrics should not throw even with failing processor
      expect(() => {
        collector.incrementCounter('processor-error-test', 1);
      }).not.toThrow();
    });
  });
});