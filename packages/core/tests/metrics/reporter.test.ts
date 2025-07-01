/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricType, MetricsCollector } from '../../src/metrics/collector.js';
import { MetricsReporter, ReportFormat } from '../../src/metrics/reporter.js';

describe('MetricsReporter', () => {
  let reporter: MetricsReporter;
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    reporter = new MetricsReporter(collector);
  });

  afterEach(() => {
    collector.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = reporter.getConfig();
      expect(config).toBeDefined();
      expect(config.includeTimestamps).toBe(true);
      expect(config.verbosity).toBe('standard');
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        verbosity: 'detailed' as const,
        includeTimestamps: false,
      };

      const customReporter = new MetricsReporter(collector, customConfig);
      const config = customReporter.getConfig();

      expect(config.verbosity).toBe('detailed');
      expect(config.includeTimestamps).toBe(false);
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      // Add some test metrics
      collector.incrementCounter('requests_total', 100, { method: 'GET' });
      collector.setGauge('memory_usage', 75.5, 'percent');
      collector.recordHistogram('response_time', 150, 'ms');
    });

    it('should generate JSON reports', async () => {
      reporter.updateConfig({ format: ReportFormat.JSON });

      const report = await reporter.generateReport();

      expect(typeof report).toBe('string');
      const parsed = JSON.parse(report);
      expect(parsed.metrics).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
    });

    it('should generate Prometheus reports', async () => {
      reporter.updateConfig({ format: ReportFormat.PROMETHEUS });

      const report = await reporter.generateReport();

      expect(typeof report).toBe('string');
      expect(report).toContain('# TYPE');
      expect(report).toContain('requests_total');
      expect(report).toContain('memory_usage');
    });

    it('should generate CSV reports', async () => {
      reporter.updateConfig({ format: ReportFormat.CSV });

      const report = await reporter.generateReport();

      expect(typeof report).toBe('string');
      expect(report).toContain('name,type,value,timestamp');
    });

    it('should include metadata in reports', async () => {
      const report = await reporter.generateReport();
      const parsed = JSON.parse(report);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.collectionPeriod).toBeDefined();
      expect(parsed.metadata.metricCount).toBeDefined();
    });
  });

  describe('Report Filtering', () => {
    beforeEach(() => {
      collector.incrementCounter('api_requests', 50, { endpoint: '/users' });
      collector.incrementCounter('db_queries', 25, { table: 'users' });
      collector.setGauge('cpu_usage', 80, 'percent');
      collector.recordHistogram('latency', 200, 'ms');
    });

    it('should filter metrics by type', async () => {
      reporter.updateConfig({
        filters: {
          includeTypes: [MetricType.COUNTER],
        },
      });

      const report = await reporter.generateReport();
      const parsed = JSON.parse(report);

      const metricTypes = Object.values(parsed.metrics).map((m: any) => m.type);
      expect(metricTypes.every((type: string) => type === MetricType.COUNTER)).toBe(true);
    });

    it('should filter metrics by name pattern', async () => {
      reporter.updateConfig({
        filters: {
          namePattern: '^api_.*',
        },
      });

      const report = await reporter.generateReport();
      const parsed = JSON.parse(report);

      const metricNames = Object.keys(parsed.metrics);
      expect(metricNames.every((name) => name.startsWith('api_'))).toBe(true);
    });

    it('should filter metrics by tags', async () => {
      reporter.updateConfig({
        filters: {
          requiredTags: { endpoint: '/users' },
        },
      });

      const report = await reporter.generateReport();
      const parsed = JSON.parse(report);

      // Should only include metrics with the required tag
      expect(Object.keys(parsed.metrics).length).toBeGreaterThan(0);
    });
  });

  describe('Scheduled Reporting', () => {
    it('should start scheduled reporting', () => {
      const config = {
        enabled: true,
        interval: 100, // 100ms for testing
        destination: ReportDestination.CONSOLE,
      };

      reporter.updateConfig(config);
      reporter.start();

      expect(reporter.isRunning()).toBe(true);
    });

    it('should stop scheduled reporting', () => {
      reporter.start();
      expect(reporter.isRunning()).toBe(true);

      reporter.stop();
      expect(reporter.isRunning()).toBe(false);
    });

    it('should emit reports on schedule', async () => {
      const reportHandler = vi.fn();
      reporter.on('report', reportHandler);

      reporter.updateConfig({ interval: 50 });
      reporter.start();

      await new Promise((resolve) => setTimeout(resolve, 150));
      reporter.stop();

      expect(reportHandler).toHaveBeenCalled();
    });
  });

  describe('Report Destinations', () => {
    it('should send reports to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      reporter.updateConfig({ destination: ReportDestination.CONSOLE });
      await reporter.sendReport();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should send reports to file', async () => {
      const writeSpy = vi.spyOn(reporter, 'writeToFile').mockResolvedValue();

      reporter.updateConfig({
        destination: ReportDestination.FILE,
        filePath: '/tmp/metrics.json',
      });

      await reporter.sendReport();

      expect(writeSpy).toHaveBeenCalledWith('/tmp/metrics.json', expect.any(String));
    });

    it('should send reports to HTTP endpoint', async () => {
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('OK', { status: 200 }));

      reporter.updateConfig({
        destination: ReportDestination.HTTP,
        httpEndpoint: 'http://localhost:8080/metrics',
      });

      await reporter.sendReport();

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8080/metrics',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      fetchSpy.mockRestore();
    });
  });

  describe('Report History', () => {
    it('should maintain report history when enabled', async () => {
      reporter.updateConfig({
        keepHistory: true,
        maxHistorySize: 10,
      });

      await reporter.generateReport();
      await reporter.generateReport();
      await reporter.generateReport();

      const history = reporter.getReportHistory();
      expect(history.length).toBe(3);
    });

    it('should limit history size', async () => {
      reporter.updateConfig({
        keepHistory: true,
        maxHistorySize: 2,
      });

      for (let i = 0; i < 5; i++) {
        await reporter.generateReport();
      }

      const history = reporter.getReportHistory();
      expect(history.length).toBe(2);
    });

    it('should clear history', async () => {
      reporter.updateConfig({ keepHistory: true });

      await reporter.generateReport();
      await reporter.generateReport();

      reporter.clearHistory();

      const history = reporter.getReportHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle file write errors gracefully', async () => {
      const writeSpy = vi
        .spyOn(reporter, 'writeToFile')
        .mockRejectedValue(new Error('Permission denied'));

      reporter.updateConfig({ destination: ReportDestination.FILE });

      await expect(reporter.sendReport()).rejects.toThrow('Permission denied');

      writeSpy.mockRestore();
    });

    it('should handle HTTP errors gracefully', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      reporter.updateConfig({ destination: ReportDestination.HTTP });

      await expect(reporter.sendReport()).rejects.toThrow('Network error');

      fetchSpy.mockRestore();
    });

    it('should continue reporting after errors', async () => {
      const reportHandler = vi.fn();
      const errorHandler = vi.fn();

      reporter.on('report', reportHandler);
      reporter.on('error', errorHandler);

      // Mock failure then success
      const writeSpy = vi
        .spyOn(reporter, 'writeToFile')
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue();

      reporter.updateConfig({
        destination: ReportDestination.FILE,
        interval: 50,
        continueOnError: true,
      });

      reporter.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      reporter.stop();

      expect(errorHandler).toHaveBeenCalled();
      expect(reportHandler).toHaveBeenCalled();

      writeSpy.mockRestore();
    });
  });

  describe('Custom Formatters', () => {
    it('should support custom report formatters', async () => {
      const customFormatter = (metrics: any) => {
        return `CUSTOM: ${Object.keys(metrics).length} metrics`;
      };

      reporter.addCustomFormatter('custom', customFormatter);
      reporter.updateConfig({ format: 'custom' as ReportFormat });

      const report = await reporter.generateReport();
      expect(report).toContain('CUSTOM:');
      expect(report).toContain('metrics');
    });

    it('should validate custom formatter output', async () => {
      const invalidFormatter = () => null;

      reporter.addCustomFormatter('invalid', invalidFormatter);
      reporter.updateConfig({ format: 'invalid' as ReportFormat });

      await expect(reporter.generateReport()).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large metric sets efficiently', async () => {
      // Generate many metrics
      for (let i = 0; i < 1000; i++) {
        collector.incrementCounter(`metric_${i}`, 1);
      }

      const startTime = Date.now();
      await reporter.generateReport();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in <1s
    });

    it('should support report compression', async () => {
      reporter.updateConfig({
        compression: true,
        format: ReportFormat.JSON,
      });

      // Add substantial metrics data
      for (let i = 0; i < 100; i++) {
        collector.recordHistogram('large_metric', Math.random() * 1000);
      }

      const uncompressed = await reporter.generateReport(false);
      const compressed = await reporter.generateReport(true);

      expect(compressed.length).toBeLessThan(uncompressed.length);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration dynamically', () => {
      const initialConfig = reporter.getConfig();

      reporter.updateConfig({
        format: ReportFormat.PROMETHEUS,
        interval: 2000,
      });

      const updatedConfig = reporter.getConfig();
      expect(updatedConfig.format).toBe(ReportFormat.PROMETHEUS);
      expect(updatedConfig.interval).toBe(2000);
      expect(updatedConfig.enabled).toBe(initialConfig.enabled);
    });

    it('should emit configuration change events', () => {
      const changeHandler = vi.fn();
      reporter.on('configChanged', changeHandler);

      reporter.updateConfig({ interval: 3000 });

      expect(changeHandler).toHaveBeenCalled();
    });

    it('should validate configuration updates', () => {
      expect(() => {
        reporter.updateConfig({ interval: -1000 });
      }).toThrow();

      expect(() => {
        reporter.updateConfig({ format: 'invalid' as ReportFormat });
      }).toThrow();
    });
  });
});
