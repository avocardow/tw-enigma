/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsCollector, MetricType } from '../collector.js';
import { PerformanceMonitor } from '../performanceMonitor.js';
import { QualityMetricsCollector } from '../qualityMetrics.js';
import {
  createMetricsReporter,
  MetricsReporter,
  ReporterConfig,
  validateReporterConfig,
} from '../reporter.js';

describe('MetricsReporter', () => {
  let metricsCollector: MetricsCollector;
  let qualityCollector: QualityMetricsCollector;
  let performanceMonitor: PerformanceMonitor;
  let reporter: MetricsReporter;
  let config: Partial<ReporterConfig>;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    qualityCollector = new QualityMetricsCollector(metricsCollector);
    performanceMonitor = new PerformanceMonitor();

    config = {
      verbosity: 'standard',
      includeTimestamps: true,
      includeMetadata: true,
      colorOutput: false, // Disable for consistent testing
      json: {
        prettyPrint: true,
        indentSize: 2,
      },
    };

    reporter = new MetricsReporter(metricsCollector, config);
    reporter.setQualityCollector(qualityCollector);
    reporter.setPerformanceMonitor(performanceMonitor);
  });

  afterEach(() => {
    reporter.clearErrors();
    metricsCollector.stop();
    qualityCollector.stop();
    performanceMonitor.stop();
  });

  describe('Constructor and Configuration', () => {
    it('should create a reporter with default config', () => {
      const defaultReporter = new MetricsReporter(metricsCollector);
      expect(defaultReporter).toBeInstanceOf(MetricsReporter);
    });

    it('should create using factory function', () => {
      const factoryReporter = createMetricsReporter(metricsCollector, config);
      expect(factoryReporter).toBeInstanceOf(MetricsReporter);
    });

    it('should validate configuration', () => {
      const validConfig = validateReporterConfig({
        verbosity: 'detailed',
        includeTimestamps: true,
      });
      expect(validConfig.verbosity).toBe('detailed');
      expect(validConfig.includeTimestamps).toBe(true);
    });

    it('should update configuration', () => {
      const updateSpy = vi.fn();
      reporter.on('configUpdated', updateSpy);

      reporter.updateConfig({
        verbosity: 'verbose',
        numberPrecision: 5,
      });

      expect(updateSpy).toHaveBeenCalled();
      expect(reporter.getConfig().verbosity).toBe('verbose');
      expect(reporter.getConfig().numberPrecision).toBe(5);
    });
  });

  describe('Report Data Collection', () => {
    it('should collect comprehensive report data', async () => {
      // Add some mock metrics
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([
        {
          id: 'metric-1',
          type: MetricType.COUNTER,
          source: 'test',
          timestamp: new Date(),
          tags: { env: 'test' },
        },
        {
          id: 'metric-2',
          type: MetricType.GAUGE,
          source: 'test',
          timestamp: new Date(),
          tags: { env: 'test' },
        },
      ] as any);

      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({
        totalMetrics: 2,
        metricTypes: { counter: 1, gauge: 1 },
        timeRange: { start: new Date(), end: new Date() },
      } as any);

      const reportData = await reporter.getReportData();

      expect(reportData.metadata).toBeDefined();
      expect(reportData.metadata.reportId).toMatch(/^report_/);
      expect(reportData.metadata.version).toBe('1.0.0');
      expect(reportData.summary).toBeDefined();
      expect(reportData.metrics.raw).toHaveLength(2);
      expect(reportData.metrics.aggregated).toBeDefined();
    });

    it('should handle time range filtering', async () => {
      const timeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
      };

      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      const reportData = await reporter.getReportData({ timeRange });

      expect(reportData.metadata.timeRange).toEqual(timeRange);
    });
  });

  describe('JSON Report Generation', () => {
    it('should generate a JSON report', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      const report = await reporter.generateJsonReport();

      expect(report.format).toBe('json');
      expect(report.content).toBeDefined();
      expect(report.size).toBeGreaterThan(0);
      expect(report.generationTime).toBeGreaterThan(0);
      expect(() => JSON.parse(report.content)).not.toThrow();
    });

    it('should handle JSON formatting options', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      const compactReport = await reporter.generateJsonReport({
        json: { prettyPrint: false },
      });

      const prettyReport = await reporter.generateJsonReport({
        json: { prettyPrint: true, indentSize: 4 },
      });

      expect(compactReport.content).not.toContain('\n');
      expect(prettyReport.content).toContain('\n');
      expect(prettyReport.size).toBeGreaterThan(compactReport.size);
    });
  });

  describe('Human-Readable Report Generation', () => {
    it('should generate a human-readable report', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({
        totalMetrics: 5,
        metricTypes: { counter: 3, gauge: 2 },
      } as any);

      const report = await reporter.generateHumanReport();

      expect(report.format).toBe('human');
      expect(report.content).toContain('TW-Enigma Metrics Report');
      expect(report.content).toContain('Report Metadata');
      expect(report.content).toContain('Summary Statistics');
      expect(report.content).toContain('Total Metrics: 5.000');
    });

    it('should respect verbosity levels', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      const minimalReport = await reporter.generateHumanReport({
        verbosity: 'minimal',
      });

      const verboseReport = await reporter.generateHumanReport({
        verbosity: 'verbose',
      });

      expect(verboseReport.size).toBeGreaterThan(minimalReport.size);
    });

    it('should include quality metrics when available', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      // Mock quality stats
      vi.spyOn(qualityCollector, 'getQualityStats').mockReturnValue({
        overallQuality: { score: 0.95, grade: 'A', trend: 'improving' },
        standardMetrics: {
          accuracy: { current: 0.95, average: 0.93, trend: 'improving' },
          precision: { current: 0.92, average: 0.9, trend: 'stable' },
          recall: { current: 0.9, average: 0.88, trend: 'improving' },
          f1Score: { current: 0.91, average: 0.89, trend: 'improving' },
          errorRate: { current: 0.05, average: 0.07, trend: 'improving' },
        },
      } as any);

      const report = await reporter.generateHumanReport({
        verbosity: 'detailed',
      });

      expect(report.content).toContain('Quality Metrics');
      expect(report.content).toContain('Overall Quality: A');
      expect(report.content).toContain('95.000%');
    });
  });

  describe('CSV Report Generation', () => {
    it('should generate a CSV report', async () => {
      const mockMetrics = [
        {
          id: 'metric-1',
          type: MetricType.COUNTER,
          source: 'test',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          tags: { env: 'test', service: 'api' },
          data: { value: 100 },
        },
        {
          id: 'metric-2',
          type: MetricType.GAUGE,
          source: 'monitor',
          timestamp: new Date('2024-01-01T10:01:00Z'),
          tags: { env: 'prod' },
          data: { value: 75.5 },
        },
      ];

      vi.spyOn(metricsCollector, 'query').mockResolvedValue(mockMetrics as any);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      const report = await reporter.generateCsvReport();

      expect(report.format).toBe('csv');
      expect(report.content).toContain('Timestamp,Type,Source,Value,Unit,Tags,Metadata');
      expect(report.content).toContain('COUNTER');
      expect(report.content).toContain('GAUGE');
      expect(report.content).toContain('test');
      expect(report.content).toContain('monitor');
    });
  });

  describe('Markdown Report Generation', () => {
    it('should generate a Markdown report', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({
        totalMetrics: 10,
        metricTypes: { counter: 6, gauge: 4 },
      } as any);

      const report = await reporter.generateMarkdownReport();

      expect(report.format).toBe('markdown');
      expect(report.content).toContain('# TW-Enigma Metrics Report');
      expect(report.content).toContain('## 📊 Report Metadata');
      expect(report.content).toContain('## 📈 Summary Statistics');
      expect(report.content).toContain('| Metric | Value |');
      expect(report.content).toContain('| Total Metrics | 10.000 |');
    });

    it('should include quality metrics table in markdown', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      vi.spyOn(qualityCollector, 'getQualityStats').mockReturnValue({
        overallQuality: { score: 0.88, grade: 'B', trend: 'stable' },
        standardMetrics: {
          accuracy: { current: 0.88, average: 0.85, trend: 'improving' },
          precision: { current: 0.86, average: 0.84, trend: 'stable' },
          recall: { current: 0.9, average: 0.89, trend: 'improving' },
          f1Score: { current: 0.88, average: 0.86, trend: 'improving' },
          errorRate: { current: 0.12, average: 0.15, trend: 'improving' },
        },
      } as any);

      const report = await reporter.generateMarkdownReport();

      expect(report.content).toContain('## 🎯 Quality Metrics');
      expect(report.content).toContain('| Overall Quality | B (88.0%) |');
      expect(report.content).toContain('| Accuracy | 88.0% |');
    });
  });

  describe('HTML Report Generation', () => {
    it('should generate an HTML report', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({
        totalMetrics: 15,
        metricTypes: { counter: 10, gauge: 5 },
      } as any);

      const report = await reporter.generateHtmlReport();

      expect(report.format).toBe('html');
      expect(report.content).toContain('<!DOCTYPE html>');
      expect(report.content).toContain('<title>TW-Enigma Metrics Report</title>');
      expect(report.content).toContain('<h1>🚀 TW-Enigma Metrics Report</h1>');
      expect(report.content).toContain('15.000');
      expect(report.content).toContain('</html>');
    });

    it('should include CSS styles', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      const report = await reporter.generateHtmlReport();

      expect(report.content).toContain('<style>');
      expect(report.content).toContain('font-family:');
      expect(report.content).toContain('.container');
      expect(report.content).toContain('.stat-card');
    });
  });

  describe('Error Handling', () => {
    it('should handle report generation errors', async () => {
      vi.spyOn(metricsCollector, 'query').mockRejectedValue(new Error('Query failed'));

      await expect(reporter.generateReport('json')).rejects.toThrow();

      const errors = reporter.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Report generation failed');
    });

    it('should accumulate and limit error history', () => {
      // Add more errors than the limit
      for (let i = 0; i < 150; i++) {
        reporter['logError'](`Test error ${i}`, new Error(`Error ${i}`), 'low');
      }

      const errors = reporter.getErrors();
      expect(errors.length).toBeLessThanOrEqual(100); // Default max error count
    });

    it('should clear errors', () => {
      reporter['logError']('Test error', new Error('Test'), 'medium');
      expect(reporter.getErrors()).toHaveLength(1);

      const clearSpy = vi.fn();
      reporter.on('errorsCleared', clearSpy);

      reporter.clearErrors();
      expect(reporter.getErrors()).toHaveLength(0);
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should emit error events when logging enabled', () => {
      const errorSpy = vi.fn();
      reporter.on('error', errorSpy);

      reporter['logError']('Test error', new Error('Test'), 'critical');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Test error'),
          severity: 'critical',
        })
      );
    });
  });

  describe('Report Validation and Warnings', () => {
    it('should validate report data and return warnings', async () => {
      // Mock empty metrics to trigger warnings
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({
        totalMetrics: 0,
        metricTypes: {},
      } as any);

      const report = await reporter.generateJsonReport();

      expect(report.warnings).toContain('No metrics data available for the specified time range');
    });

    it('should warn about high error rates', async () => {
      // Add many errors to trigger warning
      for (let i = 0; i < 85; i++) {
        reporter['logError'](`Error ${i}`, new Error(), 'medium');
      }

      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      const report = await reporter.generateJsonReport();

      expect(report.warnings).toContain('High number of errors detected during collection');
    });
  });

  describe('Format-Specific Features', () => {
    it('should handle different date formats', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      const isoReport = await reporter.generateJsonReport({
        dateFormat: 'iso',
      });

      const readableReport = await reporter.generateJsonReport({
        dateFormat: 'readable',
      });

      const timestampReport = await reporter.generateJsonReport({
        dateFormat: 'timestamp',
      });

      const isoData = JSON.parse(isoReport.content);
      const readableData = JSON.parse(readableReport.content);
      const timestampData = JSON.parse(timestampReport.content);

      expect(isoData.metadata.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(readableData.metadata.generatedAt).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(timestampData.metadata.generatedAt).toMatch(/^\d+$/);
    });

    it('should handle different number precision', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({
        totalMetrics: 5,
        collectionRate: 1.23456789,
      } as any);

      const lowPrecisionReport = await reporter.generateHumanReport({
        numberPrecision: 1,
      });

      const highPrecisionReport = await reporter.generateHumanReport({
        numberPrecision: 6,
      });

      expect(lowPrecisionReport.content).toContain('1.2');
      expect(highPrecisionReport.content).toContain('1.234568');
    });
  });

  describe('Performance Metrics Integration', () => {
    it('should include performance metrics when available', async () => {
      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      vi.spyOn(performanceMonitor, 'getStats').mockReturnValue({
        activeOperations: 5,
        totalOperations: 1000,
        averageLatency: 45.7,
        p95Latency: 89.3,
        throughput: 125.6,
        resourceUsage: {
          memoryUsage: 85.5,
          cpuUsage: 23.4,
        },
      } as any);

      const report = await reporter.generateHumanReport({
        verbosity: 'detailed',
      });

      expect(report.content).toContain('Performance Metrics');
      expect(report.content).toContain('Active Operations: 5');
      expect(report.content).toContain('45.700ms');
      expect(report.content).toContain('125.600 ops/sec');
    });
  });

  describe('Event Emission', () => {
    it('should emit reportGenerated event', async () => {
      const reportSpy = vi.fn();
      reporter.on('reportGenerated', reportSpy);

      vi.spyOn(metricsCollector, 'query').mockResolvedValue([]);
      vi.spyOn(metricsCollector, 'getSummary').mockResolvedValue({} as any);

      await reporter.generateJsonReport();

      expect(reportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'json',
          content: expect.any(String),
          size: expect.any(Number),
          generationTime: expect.any(Number),
        })
      );
    });

    it('should emit configUpdated event', () => {
      const configSpy = vi.fn();
      reporter.on('configUpdated', configSpy);

      reporter.updateConfig({ verbosity: 'verbose' });

      expect(configSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          verbosity: 'verbose',
        })
      );
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration schema', () => {
      expect(() => {
        validateReporterConfig({
          verbosity: 'invalid',
        });
      }).toThrow();

      expect(() => {
        validateReporterConfig({
          numberPrecision: -1,
        });
      }).toThrow();

      expect(() => {
        validateReporterConfig({
          humanReadable: {
            maxTableWidth: 300, // Over max
          },
        });
      }).toThrow();
    });

    it('should use default values for missing config', () => {
      const config = validateReporterConfig({});

      expect(config.verbosity).toBe('standard');
      expect(config.includeTimestamps).toBe(true);
      expect(config.colorOutput).toBe(true);
      expect(config.json.prettyPrint).toBe(true);
      expect(config.humanReadable.indentSize).toBe(2);
    });
  });
});
