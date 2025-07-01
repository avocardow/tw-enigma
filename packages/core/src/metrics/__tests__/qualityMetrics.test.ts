/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsCollector } from '../collector.js';
import {
  ClassificationResults,
  createClassificationResults,
  createQualityMetricsCollector,
  OptimizationQuality,
  QualityMetricsCollector,
  QualityMetricsConfig,
  QualityMetricType,
} from '../qualityMetrics.js';

describe('QualityMetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  let qualityCollector: QualityMetricsCollector;
  let config: Partial<QualityMetricsConfig>;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    config = {
      enabled: true,
      enableBatchAggregation: false, // Disable for simpler testing
      validateCustomMetrics: true,
      thresholds: {
        minAccuracy: 0.9,
        minPrecision: 0.85,
        minRecall: 0.85,
        maxErrorRate: 0.1,
        minF1Score: 0.85,
      },
    };
    qualityCollector = new QualityMetricsCollector(metricsCollector, config);
  });

  afterEach(() => {
    qualityCollector.stop();
    metricsCollector.stop();
  });

  describe('Constructor and Configuration', () => {
    it('should create a quality metrics collector with default config', () => {
      const collector = new QualityMetricsCollector(metricsCollector);
      expect(collector).toBeInstanceOf(QualityMetricsCollector);
    });

    it('should create using factory function', () => {
      const collector = createQualityMetricsCollector(metricsCollector, config);
      expect(collector).toBeInstanceOf(QualityMetricsCollector);
    });

    it('should update configuration', () => {
      const updateSpy = vi.fn();
      qualityCollector.on('configUpdated', updateSpy);

      qualityCollector.updateConfig({
        thresholds: {
          minAccuracy: 0.95,
          minPrecision: 0.85,
          minRecall: 0.85,
          maxErrorRate: 0.1,
          minF1Score: 0.85,
        },
      });

      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('Classification Quality Metrics', () => {
    it('should record and calculate classification quality metrics', () => {
      const results: ClassificationResults = {
        truePositives: 85,
        trueNegatives: 90,
        falsePositives: 10,
        falseNegatives: 15,
        totalSamples: 200,
      };

      const stats = qualityCollector.recordClassificationQuality(results);

      expect(stats.standardMetrics.accuracy.current).toBeCloseTo(0.875); // (85+90)/200
      expect(stats.standardMetrics.precision.current).toBeCloseTo(0.895); // 85/(85+10)
      expect(stats.standardMetrics.recall.current).toBeCloseTo(0.85); // 85/(85+15)
      expect(stats.standardMetrics.errorRate.current).toBeCloseTo(0.125); // (10+15)/200
    });

    it('should handle edge cases with zero values', () => {
      const results: ClassificationResults = {
        truePositives: 0,
        trueNegatives: 0,
        falsePositives: 0,
        falseNegatives: 0,
        totalSamples: 0,
      };

      const stats = qualityCollector.recordClassificationQuality(results);

      expect(stats.standardMetrics.accuracy.current).toBe(0);
      expect(stats.standardMetrics.precision.current).toBe(0);
      expect(stats.standardMetrics.recall.current).toBe(0);
    });

    it('should emit quality alerts for threshold violations', () => {
      const alertSpy = vi.fn();
      qualityCollector.on('qualityAlert', alertSpy);

      const poorResults: ClassificationResults = {
        truePositives: 60,
        trueNegatives: 70,
        falsePositives: 40,
        falseNegatives: 30,
        totalSamples: 200,
      };

      qualityCollector.recordClassificationQuality(poorResults);

      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('Optimization Quality Metrics', () => {
    it('should record optimization quality metrics', () => {
      const quality: OptimizationQuality = {
        originalSize: 1000,
        optimizedSize: 800,
        reductionRatio: 0.2,
        compressionEfficiency: 0.85,
        processingTime: 150,
        errorCount: 2,
        warningCount: 5,
        validationPassed: true,
        semanticAccuracy: 0.95,
      };

      const recordSpy = vi.spyOn(metricsCollector, 'recordOptimization');
      qualityCollector.recordOptimizationQuality(quality);

      expect(recordSpy).toHaveBeenCalledWith(1000, 800, expect.any(Object));
    });

    it('should calculate compression accuracy correctly', () => {
      const quality: OptimizationQuality = {
        originalSize: 1000,
        optimizedSize: 900,
        reductionRatio: 0.1,
        compressionEfficiency: 0.9,
        processingTime: 100,
        errorCount: 10,
        warningCount: 0,
        validationPassed: true,
        semanticAccuracy: 0.98,
      };

      qualityCollector.recordOptimizationQuality(quality);
      const history = qualityCollector.getMetricsHistory('compression_accuracy');

      expect(history).toHaveLength(1);
      expect(history[0].value).toBeCloseTo(0.99); // 1 - (10/1000)
    });
  });

  describe('Custom Quality Metrics', () => {
    it('should register and use custom quality metrics', () => {
      const customMetric = {
        id: 'custom-score',
        name: 'Custom Quality Score',
        description: 'A custom quality metric',
        computation: (data: any) => data.score * 0.8,
        validation: (value: number) => value >= 0 && value <= 1,
        unit: 'ratio',
        range: { min: 0, max: 1 },
        aggregationMethod: 'average' as const,
      };

      const registerSpy = vi.fn();
      qualityCollector.on('customMetricRegistered', registerSpy);

      qualityCollector.registerCustomMetric(customMetric);
      expect(registerSpy).toHaveBeenCalledWith(customMetric);

      qualityCollector.recordCustomMetric('custom-score', 0.85);
      const history = qualityCollector.getMetricsHistory('Custom Quality Score');

      expect(history).toHaveLength(1);
      expect(history[0].value).toBe(0.85);
    });

    it('should validate custom metric values', () => {
      const strictMetric = {
        id: 'strict-metric',
        name: 'Strict Metric',
        description: 'Only accepts values between 0.5 and 1.0',
        computation: (data: any) => data.value,
        validation: (value: number) => value >= 0.5 && value <= 1.0,
        unit: 'ratio',
        range: { min: 0.5, max: 1.0 },
        aggregationMethod: 'average' as const,
      };

      qualityCollector.registerCustomMetric(strictMetric);

      expect(() => {
        qualityCollector.recordCustomMetric('strict-metric', 0.3);
      }).toThrow('Invalid value 0.3 for custom metric strict-metric');
    });

    it('should unregister custom metrics', () => {
      const metric = {
        id: 'temp-metric',
        name: 'Temporary Metric',
        description: 'A temporary metric',
        computation: (data: any) => data.value,
        validation: () => true,
        unit: 'count',
        range: { min: 0, max: 100 },
        aggregationMethod: 'sum' as const,
      };

      qualityCollector.registerCustomMetric(metric);
      const unregistered = qualityCollector.unregisterCustomMetric('temp-metric');

      expect(unregistered).toBe(true);
      expect(() => {
        qualityCollector.recordCustomMetric('temp-metric', 5);
      }).toThrow('Custom metric temp-metric not registered');
    });
  });

  describe('Batch Processing', () => {
    beforeEach(() => {
      // Enable batch processing for these tests
      qualityCollector.updateConfig({
        enableBatchAggregation: true,
        batchSize: 3,
      });
    });

    it('should process data in batches', () => {
      const processSpy = vi.fn();
      qualityCollector.on('batchProcessed', processSpy);

      qualityCollector.addToBatch({ score: 0.8 });
      qualityCollector.addToBatch({ score: 0.9 });
      qualityCollector.addToBatch({ score: 0.85 });

      expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({ batchId: 1, size: 0 }));
    });

    it('should process remaining batch on stop', () => {
      const processSpy = vi.fn();
      qualityCollector.on('batchProcessed', processSpy);

      qualityCollector.addToBatch({ score: 0.8 });
      qualityCollector.addToBatch({ score: 0.9 });

      qualityCollector.stop();

      expect(processSpy).toHaveBeenCalled();
    });
  });

  describe('Quality Statistics', () => {
    it('should calculate quality statistics correctly', () => {
      // Record some metrics
      const results: ClassificationResults = {
        truePositives: 90,
        trueNegatives: 85,
        falsePositives: 10,
        falseNegatives: 15,
        totalSamples: 200,
      };

      qualityCollector.recordClassificationQuality(results);

      const stats = qualityCollector.getQualityStats();

      expect(stats.overallQuality.score).toBeGreaterThan(0);
      expect(stats.overallQuality.grade).toMatch(/^[ABCDF]$/);
      expect(stats.overallQuality.trend).toMatch(/^(improving|declining|stable)$/);
      expect(stats.batchStatistics.totalBatches).toBeGreaterThanOrEqual(0);
    });

    it('should filter metrics by time range', () => {
      const results: ClassificationResults = {
        truePositives: 80,
        trueNegatives: 90,
        falsePositives: 15,
        falseNegatives: 15,
        totalSamples: 200,
      };

      qualityCollector.recordClassificationQuality(results);

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const stats = qualityCollector.getQualityStats({
        start: oneHourAgo,
        end: now,
      });

      expect(stats.timeRange.start).toEqual(oneHourAgo);
      expect(stats.timeRange.end).toEqual(now);
    });
  });

  describe('State Management', () => {
    it('should export and import state', () => {
      const results: ClassificationResults = {
        truePositives: 75,
        trueNegatives: 80,
        falsePositives: 20,
        falseNegatives: 25,
        totalSamples: 200,
      };

      qualityCollector.recordClassificationQuality(results);
      const exportedState = qualityCollector.exportState();

      expect(exportedState.metrics.size).toBeGreaterThan(0);
      expect(exportedState.aggregatedData.totalSamples).toBeGreaterThan(0);
    });

    it('should reset all metrics and state', () => {
      const resetSpy = vi.fn();
      qualityCollector.on('reset', resetSpy);

      // Add some data
      const results: ClassificationResults = {
        truePositives: 70,
        trueNegatives: 75,
        falsePositives: 25,
        falseNegatives: 30,
        totalSamples: 200,
      };

      qualityCollector.recordClassificationQuality(results);
      qualityCollector.reset();

      expect(resetSpy).toHaveBeenCalled();

      const history = qualityCollector.getMetricsHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Metrics History', () => {
    it('should get metrics history with filtering', () => {
      const results: ClassificationResults = {
        truePositives: 85,
        trueNegatives: 90,
        falsePositives: 10,
        falseNegatives: 15,
        totalSamples: 200,
      };

      qualityCollector.recordClassificationQuality(results);

      const allHistory = qualityCollector.getMetricsHistory();
      const accuracyHistory = qualityCollector.getMetricsHistory(QualityMetricType.ACCURACY);
      const limitedHistory = qualityCollector.getMetricsHistory(undefined, 2);

      expect(allHistory.length).toBeGreaterThan(0);
      expect(accuracyHistory.length).toBe(1);
      expect(accuracyHistory[0].type).toBe(QualityMetricType.ACCURACY);
      expect(limitedHistory.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Utility Functions', () => {
    it('should create classification results from arrays', () => {
      const actual = ['cat', 'dog', 'cat', 'bird', 'dog'];
      const predicted = ['cat', 'cat', 'cat', 'bird', 'dog'];

      const results = createClassificationResults(actual, predicted, 'cat');

      expect(results.truePositives).toBe(2); // cat correctly predicted
      expect(results.falsePositives).toBe(1); // dog predicted as cat
      expect(results.falseNegatives).toBe(0); // no cats missed
      expect(results.totalSamples).toBe(5);
    });

    it('should handle multi-class classification', () => {
      const actual = ['A', 'B', 'A', 'C', 'B'];
      const predicted = ['A', 'B', 'B', 'C', 'B'];

      const results = createClassificationResults(actual, predicted);

      expect(results.truePositives).toBe(4); // A, B, C, B correctly predicted
      expect(results.falseNegatives).toBe(1); // A predicted as B
      expect(results.totalSamples).toBe(5);
    });

    it('should throw error for mismatched array lengths', () => {
      const actual = ['A', 'B', 'C'];
      const predicted = ['A', 'B'];

      expect(() => {
        createClassificationResults(actual, predicted);
      }).toThrow('Actual and predicted arrays must have the same length');
    });
  });

  describe('Error Handling', () => {
    it('should handle custom metrics when disabled', () => {
      qualityCollector.updateConfig({ allowCustomMetrics: false });

      const metric = {
        id: 'test-metric',
        name: 'Test Metric',
        description: 'Test',
        computation: () => 1,
        validation: () => true,
        unit: 'count',
        range: { min: 0, max: 10 },
        aggregationMethod: 'sum' as const,
      };

      expect(() => {
        qualityCollector.registerCustomMetric(metric);
      }).toThrow('Custom metrics are disabled');
    });

    it('should handle distributed computation when disabled', () => {
      const state = qualityCollector.exportState();

      expect(() => {
        qualityCollector.importAndMergeState([state]);
      }).toThrow('Distributed computation is disabled');
    });
  });

  describe('Event Emission', () => {
    it('should emit events for various operations', () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      const metricSpy = vi.fn();

      qualityCollector.on('started', startSpy);
      qualityCollector.on('stopped', stopSpy);
      qualityCollector.on('metricRecorded', metricSpy);

      qualityCollector.start();
      expect(startSpy).toHaveBeenCalled();

      const results: ClassificationResults = {
        truePositives: 80,
        trueNegatives: 85,
        falsePositives: 15,
        falseNegatives: 20,
        totalSamples: 200,
      };

      qualityCollector.recordClassificationQuality(results);
      expect(metricSpy).toHaveBeenCalled();

      qualityCollector.stop();
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
