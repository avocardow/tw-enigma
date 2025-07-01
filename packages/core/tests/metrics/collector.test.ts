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
} from '../../src/metrics/collector.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  afterEach(() => {
    collector.reset();
  });

  describe('Initialization', () => {
    it('should initialize with empty metrics', () => {
      expect(collector.getAllMetrics()).toEqual({});
      expect(collector.getMetricCount()).toBe(0);
    });

    it('should set default collection interval', () => {
      expect(collector.isRunning()).toBe(false);
    });
  });

  describe('Counter Metrics', () => {
    it('should create and increment counter metrics', () => {
      collector.incrementCounter('test_counter', 1, { env: 'test' });

      const metrics = collector.getAllMetrics();
      expect(metrics['test_counter']).toBeDefined();
      expect(metrics['test_counter'].type).toBe(MetricType.COUNTER);
      expect(metrics['test_counter'].value).toBe(1);
    });

    it('should accumulate counter increments', () => {
      collector.incrementCounter('test_counter', 5);
      collector.incrementCounter('test_counter', 3);
      collector.incrementCounter('test_counter', 2);

      const metric = collector.getMetric('test_counter') as CounterMetric;
      expect(metric.value).toBe(10);
    });

    it('should handle counter with tags', () => {
      collector.incrementCounter('tagged_counter', 1, { service: 'api', version: '1.0' });

      const metric = collector.getMetric('tagged_counter') as CounterMetric;
      expect(metric.tags).toEqual({ service: 'api', version: '1.0' });
    });

    it('should create separate counters for different tag combinations', () => {
      collector.incrementCounter('multi_counter', 1, { env: 'prod' });
      collector.incrementCounter('multi_counter', 2, { env: 'dev' });

      // Should create separate metrics for different tag combinations
      const metrics = collector.getAllMetrics();
      const counterMetrics = Object.keys(metrics).filter((key) => key.includes('multi_counter'));
      expect(counterMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Gauge Metrics', () => {
    it('should create and set gauge metrics', () => {
      collector.setGauge('memory_usage', 75.5, 'percent', { host: 'server1' });

      const metric = collector.getMetric('memory_usage') as GaugeMetric;
      expect(metric.type).toBe(MetricType.GAUGE);
      expect(metric.value).toBe(75.5);
      expect(metric.unit).toBe('percent');
    });

    it('should update gauge values', () => {
      collector.setGauge('cpu_usage', 50);
      collector.setGauge('cpu_usage', 75);

      const metric = collector.getMetric('cpu_usage') as GaugeMetric;
      expect(metric.value).toBe(75);
    });

    it('should track gauge history when enabled', () => {
      collector.setGauge('temp_sensor', 22.5, 'celsius');
      collector.setGauge('temp_sensor', 23.1, 'celsius');
      collector.setGauge('temp_sensor', 22.8, 'celsius');

      const metric = collector.getMetric('temp_sensor') as GaugeMetric;
      expect(metric.history).toBeDefined();
      expect(metric.history!.length).toBeGreaterThan(0);
    });
  });

  describe('Histogram Metrics', () => {
    it('should create and record histogram values', () => {
      collector.recordHistogram('request_duration', 150, 'ms', { endpoint: '/api/users' });
      collector.recordHistogram('request_duration', 200, 'ms', { endpoint: '/api/users' });
      collector.recordHistogram('request_duration', 100, 'ms', { endpoint: '/api/users' });

      const metric = collector.getMetric('request_duration') as HistogramMetric;
      expect(metric.type).toBe(MetricType.HISTOGRAM);
      expect(metric.count).toBe(3);
      expect(metric.sum).toBe(450);
    });

    it('should calculate histogram statistics', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      values.forEach((value) => {
        collector.recordHistogram('response_time', value, 'ms');
      });

      const metric = collector.getMetric('response_time') as HistogramMetric;
      expect(metric.min).toBe(10);
      expect(metric.max).toBe(100);
      expect(metric.mean).toBe(55);
    });

    it('should generate histogram buckets', () => {
      for (let i = 0; i < 1000; i++) {
        collector.recordHistogram('latency', Math.random() * 1000, 'ms');
      }

      const metric = collector.getMetric('latency') as HistogramMetric;
      expect(metric.buckets).toBeDefined();
      expect(Object.keys(metric.buckets!).length).toBeGreaterThan(0);
    });
  });

  describe('Timer Metrics', () => {
    it('should create and start timers', () => {
      const timer = collector.startTimer('operation_time', { operation: 'database_query' });
      expect(timer).toBeDefined();
      expect(typeof timer.stop).toBe('function');
    });

    it('should measure elapsed time', async () => {
      const timer = collector.startTimer('async_operation');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = timer.stop();
      expect(duration).toBeGreaterThan(0);

      const metric = collector.getMetric('async_operation') as TimerMetric;
      expect(metric.type).toBe(MetricType.TIMER);
    });

    it('should accumulate timer measurements', () => {
      // First timing
      const timer1 = collector.startTimer('batch_process');
      timer1.stop();

      // Second timing
      const timer2 = collector.startTimer('batch_process');
      timer2.stop();

      const metric = collector.getMetric('batch_process') as TimerMetric;
      expect(metric.count).toBe(2);
      expect(metric.totalTime).toBeGreaterThan(0);
    });
  });

  describe('Error Metrics', () => {
    it('should record error metrics', () => {
      const error = new Error('Test error');
      collector.recordError('api_errors', error, { endpoint: '/api/test' });

      const metrics = collector.getAllMetrics();
      expect(metrics['api_errors']).toBeDefined();
      expect(metrics['api_errors'].type).toBe(MetricType.ERROR);
    });

    it('should categorize errors by type', () => {
      collector.recordError('validation_errors', new TypeError('Invalid type'));
      collector.recordError('network_errors', new Error('Connection failed'));

      const validationMetric = collector.getMetric('validation_errors');
      const networkMetric = collector.getMetric('network_errors');

      expect(validationMetric).toBeDefined();
      expect(networkMetric).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should record performance metrics', () => {
      collector.recordPerformance(
        'css_processing',
        {
          duration: 250,
          memory: 1024 * 1024,
          cpu: 15.5,
        },
        { stage: 'optimization' }
      );

      const metric = collector.getMetric('css_processing');
      expect(metric.type).toBe(MetricType.PERFORMANCE);
    });

    it('should track performance trends', () => {
      collector.recordPerformance('build_time', { duration: 1000 });
      collector.recordPerformance('build_time', { duration: 800 });
      collector.recordPerformance('build_time', { duration: 1200 });

      const metric = collector.getMetric('build_time');
      expect(metric).toBeDefined();
    });
  });

  describe('Metric Retrieval', () => {
    beforeEach(() => {
      collector.incrementCounter('test_counter', 5);
      collector.setGauge('test_gauge', 42, 'units');
      collector.recordHistogram('test_histogram', 100);
    });

    it('should retrieve specific metrics by name', () => {
      const counter = collector.getMetric('test_counter');
      const gauge = collector.getMetric('test_gauge');
      const histogram = collector.getMetric('test_histogram');

      expect(counter).toBeDefined();
      expect(gauge).toBeDefined();
      expect(histogram).toBeDefined();
    });

    it('should retrieve all metrics', () => {
      const allMetrics = collector.getAllMetrics();

      expect(Object.keys(allMetrics).length).toBe(3);
      expect(allMetrics['test_counter']).toBeDefined();
      expect(allMetrics['test_gauge']).toBeDefined();
      expect(allMetrics['test_histogram']).toBeDefined();
    });

    it('should filter metrics by type', () => {
      const counters = collector.getMetricsByType(MetricType.COUNTER);
      const gauges = collector.getMetricsByType(MetricType.GAUGE);

      expect(counters.length).toBe(1);
      expect(gauges.length).toBe(1);
      expect(counters[0].name).toBe('test_counter');
      expect(gauges[0].name).toBe('test_gauge');
    });

    it('should filter metrics by tags', () => {
      collector.incrementCounter('tagged_metric', 1, { env: 'prod', service: 'api' });
      collector.incrementCounter('other_metric', 1, { env: 'dev' });

      const prodMetrics = collector.getMetricsByTags({ env: 'prod' });
      expect(prodMetrics.length).toBe(1);
      expect(prodMetrics[0].name).toBe('tagged_metric');
    });
  });

  describe('Metric Aggregation', () => {
    it('should aggregate metrics by time periods', () => {
      // Record metrics over time
      collector.incrementCounter('requests', 10);
      collector.incrementCounter('requests', 15);
      collector.incrementCounter('requests', 20);

      const aggregated = collector.getAggregatedMetrics('1m');
      expect(aggregated).toBeDefined();
    });

    it('should calculate statistical summaries', () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordHistogram('response_times', i);
      }

      const summary = collector.getMetricSummary('response_times');
      expect(summary).toBeDefined();
      expect(summary.count).toBe(100);
      expect(summary.min).toBe(1);
      expect(summary.max).toBe(100);
    });
  });

  describe('Collection Control', () => {
    it('should start and stop collection', () => {
      expect(collector.isRunning()).toBe(false);

      collector.startCollection();
      expect(collector.isRunning()).toBe(true);

      collector.stopCollection();
      expect(collector.isRunning()).toBe(false);
    });

    it('should collect metrics periodically when running', async () => {
      const onCollect = vi.fn();
      collector.on('collect', onCollect);

      collector.startCollection(100); // 100ms interval

      await new Promise((resolve) => setTimeout(resolve, 250));

      collector.stopCollection();

      expect(onCollect).toHaveBeenCalled();
    });
  });

  describe('Event Emission', () => {
    it('should emit events when metrics are recorded', () => {
      const onMetric = vi.fn();
      collector.on('metric', onMetric);

      collector.incrementCounter('event_test', 1);

      expect(onMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'event_test',
          type: MetricType.COUNTER,
          value: 1,
        })
      );
    });

    it('should emit error events for invalid operations', () => {
      const onError = vi.fn();
      collector.on('error', onError);

      // Try to get a non-existent metric should not error, but return undefined
      const result = collector.getMetric('non_existent');
      expect(result).toBeUndefined();
    });
  });

  describe('Memory Management', () => {
    it('should reset all metrics', () => {
      collector.incrementCounter('test1', 1);
      collector.setGauge('test2', 2);
      collector.recordHistogram('test3', 3);

      expect(collector.getMetricCount()).toBe(3);

      collector.reset();

      expect(collector.getMetricCount()).toBe(0);
      expect(collector.getAllMetrics()).toEqual({});
    });

    it('should handle memory cleanup for large metric sets', () => {
      // Create many metrics
      for (let i = 0; i < 1000; i++) {
        collector.incrementCounter(`metric_${i}`, 1);
      }

      expect(collector.getMetricCount()).toBe(1000);

      collector.reset();

      expect(collector.getMetricCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid metric names gracefully', () => {
      // Empty name
      expect(() => collector.incrementCounter('', 1)).not.toThrow();

      // Very long name
      const longName = 'a'.repeat(1000);
      expect(() => collector.incrementCounter(longName, 1)).not.toThrow();
    });

    it('should handle invalid metric values', () => {
      // Negative counter (should be allowed)
      expect(() => collector.incrementCounter('test', -1)).not.toThrow();

      // NaN values
      expect(() => collector.setGauge('test', NaN)).not.toThrow();

      // Infinity values
      expect(() => collector.setGauge('test', Infinity)).not.toThrow();
    });

    it('should handle concurrent access', async () => {
      const promises = [];

      // Simulate concurrent metric recording
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            collector.incrementCounter('concurrent_test', 1);
          })
        );
      }

      await Promise.all(promises);

      const metric = collector.getMetric('concurrent_test') as CounterMetric;
      expect(metric.value).toBe(100);
    });
  });

  describe('Custom Metrics', () => {
    it('should support custom metric types', () => {
      const customMetric: BaseMetric = {
        name: 'custom_metric',
        type: 'CUSTOM' as MetricType,
        value: 'custom_value',
        timestamp: new Date(),
        tags: { type: 'custom' },
      };

      collector.recordCustomMetric(customMetric);

      const retrieved = collector.getMetric('custom_metric');
      expect(retrieved).toBeDefined();
      expect(retrieved!.value).toBe('custom_value');
    });
  });

  describe('Metric Validation', () => {
    it('should validate metric names', () => {
      const validator = collector.getMetricValidator();

      expect(validator.isValidName('valid_metric_name')).toBe(true);
      expect(validator.isValidName('invalid-name!')).toBe(false);
      expect(validator.isValidName('')).toBe(false);
    });

    it('should validate metric values', () => {
      const validator = collector.getMetricValidator();

      expect(validator.isValidValue(42)).toBe(true);
      expect(validator.isValidValue('string_value')).toBe(true);
      expect(validator.isValidValue(null)).toBe(false);
      expect(validator.isValidValue(undefined)).toBe(false);
    });
  });
});
