/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BaseMetric,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
  MetricsCollector,
  MetricType,
  TimerMetric,
  ClassAnalysisMetric,
  PerformanceMetric,
  OptimizationMetric,
  MemoryMetric,
  TimingMetric,
  ErrorMetric,
} from '../../src/metrics/collector.js';

describe('MetricsCollector - Enhanced Tests', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  afterEach(() => {
    collector.reset();
  });

  describe('Advanced Metric Types', () => {
    it('should record class analysis metrics', () => {
      const classMetric: ClassAnalysisMetric = {
        id: 'class_1',
        timestamp: new Date(),
        type: MetricType.CLASS_ANALYSIS,
        source: 'test',
        data: {
          className: 'bg-blue-500',
          frequency: 15,
          variants: ['hover:bg-blue-600', 'md:bg-blue-700'],
          category: 'utility',
          complexity: 2,
          consolidationOpportunities: 3,
          semanticGroup: 'colors',
          responsiveBreakpoints: ['md', 'lg'],
          stateVariants: ['hover', 'focus'],
        },
        tags: { framework: 'tailwind' },
      };

      collector.recordClassAnalysis(classMetric);

      const metrics = collector.getAllMetrics();
      expect(Object.keys(metrics)).toContain('class_1');
      expect(metrics['class_1'].type).toBe(MetricType.CLASS_ANALYSIS);
    });

    it('should record optimization metrics', () => {
      const optimizationMetric: OptimizationMetric = {
        id: 'opt_1',
        timestamp: new Date(),
        type: MetricType.OPTIMIZATION,
        source: 'test',
        data: {
          originalSize: 10000,
          optimizedSize: 7500,
          compressionRatio: 0.75,
          classesRemoved: 50,
          classesConsolidated: 25,
          duplicatesEliminated: 15,
          passes: 3,
          strategy: 'multi-pass',
          timeToOptimize: 150,
        },
        tags: { phase: 'final' },
      };

      collector.recordOptimization(optimizationMetric);

      const metrics = collector.getAllMetrics();
      expect(metrics['opt_1']).toBeDefined();
      expect(metrics['opt_1'].type).toBe(MetricType.OPTIMIZATION);
    });

    it('should record memory metrics', () => {
      const memoryMetric: MemoryMetric = {
        id: 'mem_1',
        timestamp: new Date(),
        type: MetricType.MEMORY,
        source: 'test',
        data: {
          heapUsed: 1024 * 1024,
          heapTotal: 2048 * 1024,
          external: 512 * 1024,
          arrayBuffers: 128 * 1024,
          rss: 3072 * 1024,
          gcPause: 5,
          gcFrequency: 10,
        },
        tags: { component: 'parser' },
      };

      collector.recordMemory(memoryMetric);

      const metrics = collector.getAllMetrics();
      expect(metrics['mem_1']).toBeDefined();
      expect(metrics['mem_1'].type).toBe(MetricType.MEMORY);
    });

    it('should record timing metrics', () => {
      const timingMetric: TimingMetric = {
        id: 'time_1',
        timestamp: new Date(),
        type: MetricType.TIMING,
        source: 'test',
        data: {
          operationName: 'css_generation',
          startTime: Date.now() - 1000,
          endTime: Date.now(),
          duration: 1000,
          phase: 'optimization',
          subOperations: [
            { name: 'parsing', duration: 300 },
            { name: 'analysis', duration: 400 },
            { name: 'generation', duration: 300 },
          ],
        },
        tags: { stage: 'production' },
      };

      collector.recordTiming(timingMetric);

      const metrics = collector.getAllMetrics();
      expect(metrics['time_1']).toBeDefined();
      expect(metrics['time_1'].type).toBe(MetricType.TIMING);
    });
  });

  describe('Metric Collection Control', () => {
    it('should start and stop collection with proper state management', () => {
      expect(collector.isCollecting()).toBe(false);

      collector.startCollection();
      expect(collector.isCollecting()).toBe(true);

      collector.stopCollection();
      expect(collector.isCollecting()).toBe(false);
    });

    it('should emit collection events', () => {
      const onStart = vi.fn();
      const onStop = vi.fn();

      collector.on('collection_started', onStart);
      collector.on('collection_stopped', onStop);

      collector.startCollection();
      expect(onStart).toHaveBeenCalled();

      collector.stopCollection();
      expect(onStop).toHaveBeenCalled();
    });

    it('should handle repeated start/stop calls gracefully', () => {
      // Multiple starts should not cause issues
      collector.startCollection();
      collector.startCollection();
      expect(collector.isCollecting()).toBe(true);

      // Multiple stops should not cause issues
      collector.stopCollection();
      collector.stopCollection();
      expect(collector.isCollecting()).toBe(false);
    });
  });

  describe('Advanced Metric Queries', () => {
    beforeEach(() => {
      // Set up test data
      collector.incrementCounter('api_calls', 10, { service: 'auth', env: 'prod' });
      collector.incrementCounter('api_calls', 5, { service: 'user', env: 'prod' });
      collector.incrementCounter('api_calls', 3, { service: 'auth', env: 'dev' });
      collector.setGauge('memory_usage', 75, 'percent', { server: 'web1' });
      collector.setGauge('cpu_usage', 45, 'percent', { server: 'web1' });
      collector.recordHistogram('latency', 150, 'ms', { endpoint: '/api' });
    });

    it('should filter metrics by complex tag queries', () => {
      const prodMetrics = collector.getMetricsByTags({ env: 'prod' });
      expect(prodMetrics.length).toBe(2);

      const authMetrics = collector.getMetricsByTags({ service: 'auth' });
      expect(authMetrics.length).toBe(2);

      const prodAuthMetrics = collector.getMetricsByTags({ env: 'prod', service: 'auth' });
      expect(prodAuthMetrics.length).toBe(1);
    });

    it('should get metrics by name pattern', () => {
      const apiMetrics = collector.getMetricsByPattern(/api/);
      expect(apiMetrics.length).toBeGreaterThan(0);
      expect(apiMetrics.every(m => m.name.includes('api'))).toBe(true);
    });

    it('should get metrics within time range', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const oneMinuteFromNow = new Date(now.getTime() + 60000);

      const metricsInRange = collector.getMetricsByTimeRange(oneMinuteAgo, oneMinuteFromNow);
      expect(metricsInRange.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        bufferSize: 5000,
        flushInterval: 2000,
        enableCompression: true,
      };

      collector.updateConfig(newConfig);

      const config = collector.getConfig();
      expect(config.bufferSize).toBe(5000);
      expect(config.flushInterval).toBe(2000);
      expect(config.enableCompression).toBe(true);
    });

    it('should emit configuration change events', () => {
      const onConfigChange = vi.fn();
      collector.on('config_changed', onConfigChange);

      collector.updateConfig({ bufferSize: 5000 });

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          bufferSize: 5000,
        })
      );
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

  describe('Metric Aggregation and Statistics', () => {
    beforeEach(() => {
      // Record multiple data points for aggregation
      for (let i = 1; i <= 10; i++) {
        collector.recordHistogram('response_time', i * 10, 'ms');
        collector.incrementCounter('requests', i);
      }
    });

    it('should calculate percentiles for histogram metrics', () => {
      const metric = collector.getMetric('response_time') as HistogramMetric;
      
      expect(metric.percentiles).toBeDefined();
      expect(metric.percentiles!.p50).toBeGreaterThan(0);
      expect(metric.percentiles!.p95).toBeGreaterThan(0);
      expect(metric.percentiles!.p99).toBeGreaterThan(0);
    });

    it('should provide statistical summaries', () => {
      const summary = collector.getStatisticalSummary();
      
      expect(summary).toBeDefined();
      expect(summary.totalMetrics).toBeGreaterThan(0);
      expect(summary.metricsByType).toBeDefined();
      expect(summary.timeRange).toBeDefined();
    });

    it('should calculate metric correlations', () => {
      // Add correlated metrics
      collector.setGauge('cpu_usage', 80, 'percent');
      collector.recordHistogram('response_time', 200, 'ms');
      
      const correlations = collector.calculateCorrelations(['cpu_usage', 'response_time']);
      expect(correlations).toBeDefined();
    });
  });

  describe('Storage and Persistence', () => {
    it('should export metrics to JSON', () => {
      collector.incrementCounter('test', 1);
      collector.setGauge('memory', 50, 'MB');

      const exported = collector.exportToJSON();
      
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
      
      const parsed = JSON.parse(exported);
      expect(parsed.metrics).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });

    it('should import metrics from JSON', () => {
      const originalData = {
        metrics: {
          test_counter: {
            id: 'test_counter',
            type: MetricType.COUNTER,
            value: 5,
            timestamp: new Date().toISOString(),
            source: 'import',
          },
        },
        metadata: {
          exportTime: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      collector.importFromJSON(JSON.stringify(originalData));

      const metrics = collector.getAllMetrics();
      expect(metrics['test_counter']).toBeDefined();
      expect(metrics['test_counter'].value).toBe(5);
    });

    it('should handle corrupted import data gracefully', () => {
      expect(() => {
        collector.importFromJSON('invalid json');
      }).toThrow();

      expect(() => {
        collector.importFromJSON('{"invalid": "structure"}');
      }).toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of metrics efficiently', () => {
      const startTime = Date.now();

      // Create 1000 metrics
      for (let i = 0; i < 1000; i++) {
        collector.incrementCounter(`counter_${i}`, 1);
        collector.setGauge(`gauge_${i}`, Math.random() * 100, 'units');
        collector.recordHistogram(`histogram_${i}`, Math.random() * 1000, 'ms');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(collector.getMetricCount()).toBe(3000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should manage memory efficiently with large datasets', () => {
      const initialCount = collector.getMetricCount();

      // Create many metrics
      for (let i = 0; i < 5000; i++) {
        collector.incrementCounter(`stress_test_${i}`, 1);
      }

      expect(collector.getMetricCount()).toBe(initialCount + 5000);

      // Reset should clear everything
      collector.reset();
      expect(collector.getMetricCount()).toBe(0);
    });
  });

  describe('Real-time Processing', () => {
    it('should process metrics in real-time when enabled', async () => {
      collector.enableRealTimeProcessing();

      const processor = vi.fn();
      collector.addRealTimeProcessor('test', processor);

      collector.incrementCounter('realtime_test', 1);

      // Allow time for async processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(processor).toHaveBeenCalled();
    });

    it('should support custom real-time processors', () => {
      const customProcessor = vi.fn((metric: BaseMetric) => {
        return { ...metric, processed: true };
      });

      collector.addRealTimeProcessor('custom', customProcessor);
      collector.enableRealTimeProcessing();

      collector.incrementCounter('test', 1);

      expect(customProcessor).toHaveBeenCalled();
    });

    it('should handle processor errors gracefully', () => {
      const errorProcessor = vi.fn(() => {
        throw new Error('Processor error');
      });

      collector.addRealTimeProcessor('error', errorProcessor);
      collector.enableRealTimeProcessing();

      expect(() => {
        collector.incrementCounter('test', 1);
      }).not.toThrow();
    });
  });

  describe('Buffering and Flushing', () => {
    it('should buffer metrics when buffering is enabled', () => {
      collector.enableBuffering();

      collector.incrementCounter('buffered', 1);
      collector.setGauge('buffered_gauge', 50, 'units');

      const bufferSize = collector.getBufferSize();
      expect(bufferSize).toBe(2);
    });

    it('should flush buffer manually', () => {
      const onFlush = vi.fn();
      collector.on('buffer_flushed', onFlush);

      collector.enableBuffering();
      collector.incrementCounter('test', 1);

      collector.flushBuffer();

      expect(onFlush).toHaveBeenCalled();
      expect(collector.getBufferSize()).toBe(0);
    });

    it('should auto-flush buffer when size limit reached', () => {
      const onFlush = vi.fn();
      collector.on('buffer_flushed', onFlush);

      collector.updateConfig({ bufferSize: 2, autoFlush: true });
      collector.enableBuffering();

      collector.incrementCounter('test1', 1);
      collector.incrementCounter('test2', 1);
      collector.incrementCounter('test3', 1); // Should trigger flush

      expect(onFlush).toHaveBeenCalled();
    });
  });
});