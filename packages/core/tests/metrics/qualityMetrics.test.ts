/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QualityConfig,
  QualityIssue,
  QualityMetricsCollector,
} from '../../src/metrics/qualityMetrics.js';

describe('QualityMetricsCollector', () => {
  let collector: QualityMetricsCollector;

  beforeEach(() => {
    collector = new QualityMetricsCollector();
  });

  afterEach(() => {
    collector.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = collector.getConfig();
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<QualityConfig> = {
        enabled: true,
        accuracyThreshold: 0.95,
        performanceThreshold: 500,
      };

      const customCollector = new QualityMetricsCollector(customConfig);
      const config = customCollector.getConfig();

      expect(config.accuracyThreshold).toBe(0.95);
      expect(config.performanceThreshold).toBe(500);
    });
  });

  describe('CSS Quality Metrics', () => {
    it('should analyze CSS quality', () => {
      const cssContent = `
        .button {
          color: red;
          background: blue;
        }
        .btn {
          color: red;
          background: blue;
        }
      `;

      const result = collector.analyzeCssQuality(cssContent);

      expect(result).toBeDefined();
      expect(result.duplicatedRules).toBeGreaterThan(0);
      expect(result.totalRules).toBeGreaterThan(0);
    });

    it('should detect unused CSS rules', () => {
      const cssContent = '.unused-class { color: red; }';
      const htmlContent = '<div class="used-class">Test</div>';

      const result = collector.analyzeUnusedCss(cssContent, htmlContent);

      expect(result.unusedSelectors).toContain('.unused-class');
      expect(result.totalSelectors).toBe(1);
      expect(result.usageRate).toBe(0);
    });

    it('should calculate CSS complexity', () => {
      const complexCss = `
        .complex {
          color: red;
          background: linear-gradient(to right, red, blue);
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          transform: rotate(45deg) scale(1.2);
        }
      `;

      const result = collector.calculateCssComplexity(complexCss);

      expect(result.complexity).toBeGreaterThan(0);
      expect(result.selectors).toBeGreaterThan(0);
      expect(result.properties).toBeGreaterThan(0);
    });
  });

  describe('Performance Quality Metrics', () => {
    it('should track optimization accuracy', () => {
      collector.recordOptimizationResult({
        originalSize: 1000,
        optimizedSize: 600,
        expectedSize: 580,
        successful: true,
      });

      const stats = collector.getQualityStats();
      expect(stats.optimization.accuracy).toBeGreaterThan(0);
      expect(stats.optimization.successRate).toBe(1);
    });

    it('should track file integrity', () => {
      collector.recordFileIntegrity({
        filename: 'test.css',
        originalHash: 'abc123',
        processedHash: 'abc123',
        isIntact: true,
      });

      const stats = collector.getQualityStats();
      expect(stats.integrity.filesProcessed).toBe(1);
      expect(stats.integrity.integrityRate).toBe(1);
    });

    it('should track error rates', () => {
      collector.recordProcessingError({
        type: 'parsing',
        message: 'Invalid CSS syntax',
        file: 'test.css',
        severity: 'medium',
      });

      const stats = collector.getQualityStats();
      expect(stats.errors.totalErrors).toBe(1);
      expect(stats.errors.errorsByType.parsing).toBe(1);
    });
  });

  describe('Quality Issues Tracking', () => {
    it('should detect and track quality issues', () => {
      const issue: QualityIssue = {
        id: 'test-issue',
        type: 'performance',
        severity: 'high',
        message: 'Large file size detected',
        file: 'large.css',
        line: 1,
        suggestion: 'Consider minification',
      };

      collector.recordQualityIssue(issue);

      const issues = collector.getQualityIssues();
      expect(issues.length).toBe(1);
      expect(issues[0].type).toBe('performance');
    });

    it('should filter quality issues by severity', () => {
      collector.recordQualityIssue({
        id: 'low-issue',
        type: 'style',
        severity: 'low',
        message: 'Minor style issue',
      });

      collector.recordQualityIssue({
        id: 'high-issue',
        type: 'performance',
        severity: 'high',
        message: 'Major performance issue',
      });

      const highIssues = collector.getQualityIssuesBySeverity('high');
      const lowIssues = collector.getQualityIssuesBySeverity('low');

      expect(highIssues.length).toBe(1);
      expect(lowIssues.length).toBe(1);
      expect(highIssues[0].severity).toBe('high');
    });
  });

  describe('Validation and Compliance', () => {
    it('should validate CSS against standards', () => {
      const validCss = '.valid { color: red; }';
      const invalidCss = '.invalid { invalid-property: value; }';

      const validResult = collector.validateCssStandards(validCss);
      const invalidResult = collector.validateCssStandards(invalidCss);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.violations.length).toBeGreaterThan(0);
    });

    it('should check accessibility compliance', () => {
      const cssWithA11y = '.text { color: #000; background: #fff; }'; // Good contrast
      const cssWithoutA11y = '.text { color: #ccc; background: #fff; }'; // Poor contrast

      const goodResult = collector.checkAccessibilityCompliance(cssWithA11y);
      const poorResult = collector.checkAccessibilityCompliance(cssWithoutA11y);

      expect(goodResult.score).toBeGreaterThan(poorResult.score);
    });
  });

  describe('Trend Analysis', () => {
    it('should track quality trends over time', () => {
      // Record multiple quality measurements
      for (let i = 0; i < 5; i++) {
        collector.recordQualityMeasurement({
          timestamp: new Date(Date.now() + i * 1000),
          score: 0.8 + i * 0.02, // Improving trend
          category: 'overall',
        });
      }

      const trend = collector.getQualityTrend('overall');
      expect(trend.direction).toBe('improving');
      expect(trend.slope).toBeGreaterThan(0);
    });

    it('should calculate quality score over time', () => {
      collector.recordQualityMeasurement({
        timestamp: new Date(),
        score: 0.85,
        category: 'css',
      });

      const stats = collector.getQualityStats();
      expect(stats.overall.currentScore).toBe(0.85);
    });
  });

  describe('Reporting and Statistics', () => {
    beforeEach(() => {
      // Set up test data
      collector.recordOptimizationResult({
        originalSize: 1000,
        optimizedSize: 700,
        expectedSize: 650,
        successful: true,
      });

      collector.recordQualityIssue({
        id: 'test-issue',
        type: 'performance',
        severity: 'medium',
        message: 'Test issue',
      });
    });

    it('should generate comprehensive quality statistics', () => {
      const stats = collector.getQualityStats();

      expect(stats.overall).toBeDefined();
      expect(stats.optimization).toBeDefined();
      expect(stats.integrity).toBeDefined();
      expect(stats.errors).toBeDefined();
      expect(stats.issues).toBeDefined();
    });

    it('should export quality data for external analysis', () => {
      const exportData = collector.exportQualityData();

      expect(exportData.metadata).toBeDefined();
      expect(exportData.measurements).toBeDefined();
      expect(exportData.issues).toBeDefined();
      expect(exportData.trends).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        accuracyThreshold: 0.9,
        performanceThreshold: 300,
      };

      collector.updateConfig(newConfig);
      const config = collector.getConfig();

      expect(config.accuracyThreshold).toBe(0.9);
      expect(config.performanceThreshold).toBe(300);
    });

    it('should emit configuration change events', () => {
      const changeHandler = vi.fn();
      collector.on('configChanged', changeHandler);

      collector.updateConfig({ accuracyThreshold: 0.95 });

      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid CSS gracefully', () => {
      const invalidCss = 'not css at all!';

      expect(() => {
        collector.analyzeCssQuality(invalidCss);
      }).not.toThrow();
    });

    it('should continue processing after errors', () => {
      // Simulate an error condition
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      collector.recordProcessingError({
        type: 'system',
        message: 'Critical error',
        severity: 'critical',
      });

      // Should still be able to record other metrics
      collector.recordQualityMeasurement({
        timestamp: new Date(),
        score: 0.8,
        category: 'test',
      });

      const stats = collector.getQualityStats();
      expect(stats).toBeDefined();

      errorSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should handle large CSS files efficiently', () => {
      const largeCss = '.class' + '{ color: red; }'.repeat(10000);

      const startTime = Date.now();
      collector.analyzeCssQuality(largeCss);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in <5s
    });

    it('should maintain performance with many quality issues', () => {
      const startTime = Date.now();

      // Record many issues
      for (let i = 0; i < 1000; i++) {
        collector.recordQualityIssue({
          id: `issue-${i}`,
          type: 'style',
          severity: 'low',
          message: `Issue ${i}`,
        });
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in <1s
    });
  });
});
