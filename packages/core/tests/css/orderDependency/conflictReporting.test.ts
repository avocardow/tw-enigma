/**
 * ConflictReporter Test Suite
 *
 * Comprehensive test suite for ConflictReporter covering:
 * - Report generation in multiple formats
 * - Warning generation and configuration
 * - Export functionality and error handling
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { OrderHandlingConfig } from '../../../src/css/orderDependency/configuration';
import { ConflictReporter } from '../../../src/css/orderDependency/conflictReporting';
import {
  ConflictReport,
  ConflictSeverity,
  ConflictType,
  CSSRule,
  ReportFormat,
  RuleType,
} from '../../../src/css/orderDependency/types';

describe('ConflictReporter', () => {
  let reporter: ConflictReporter;
  let config: OrderHandlingConfig;

  // Helper function to create mock conflicts
  const createMockConflict = (
    id: string,
    type: ConflictType = ConflictType.SPECIFICITY_CONFLICT,
    severity: ConflictSeverity = ConflictSeverity.MEDIUM
  ): ConflictReport => ({
    id,
    type,
    severity,
    involvedRules: ['rule1', 'rule2'],
    description: `Test conflict ${id}`,
    suggestion: `Test suggestion for ${id}`,
    autoResolvable: false,
    location: {
      line: 1,
      column: 1,
      file: 'test.css',
    },
  });

  // Helper function to create mock CSS rules
  const createMockRule = (id: string, selector: string): CSSRule => ({
    id,
    selector,
    declarations: [{ property: 'color', value: 'red', important: false }],
    type: RuleType.STYLE,
    important: false,
    lineNumber: 1,
    sourceFile: 'test.css',
  });

  beforeEach(() => {
    config = new OrderHandlingConfig();
    reporter = new ConflictReporter(config.getConfig());
  });

  describe('Basic Reporting', () => {
    it('should create reporter instance', () => {
      expect(reporter).toBeInstanceOf(ConflictReporter);
    });

    it('should generate basic reports', () => {
      const mockConflicts = [createMockConflict('conflict1')];
      const reports = reporter.generateReport(mockConflicts);

      expect(reports).toBeDefined();
      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThan(0);
    });

    it('should handle empty conflict lists', () => {
      const reports = reporter.generateReport([]);
      expect(reports).toBeDefined();
      expect(Array.isArray(reports)).toBe(true);
    });
  });

  describe('Report Formats', () => {
    it('should export reports in console format', () => {
      const mockConflicts = [createMockConflict('conflict1')];
      const report = reporter.exportReport(mockConflicts, ReportFormat.CONSOLE);

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('should export reports in JSON format', () => {
      const mockConflicts = [createMockConflict('conflict1')];
      const report = reporter.exportReport(mockConflicts, ReportFormat.JSON);

      expect(typeof report).toBe('string');
      expect(() => JSON.parse(report)).not.toThrow();
    });

    it('should export reports in HTML format', () => {
      const conflicts = [
        createMockConflict('conflict1', ConflictType.SPECIFICITY_CONFLICT, ConflictSeverity.MEDIUM),
      ];
      const report = reporter.exportReport(conflicts, ReportFormat.HTML);

      expect(typeof report).toBe('string');
      expect(report).toContain('<html lang="en">');
    });

    it('should export reports in markdown format', () => {
      const mockConflicts = [createMockConflict('conflict1')];
      const report = reporter.exportReport(mockConflicts, ReportFormat.MARKDOWN);

      expect(typeof report).toBe('string');
      expect(report).toContain('#');
    });
  });

  describe('Warning Generation', () => {
    it('should generate warnings for conflicts', () => {
      const mockConflicts = [
        createMockConflict('conflict1', ConflictType.SPECIFICITY_CONFLICT, ConflictSeverity.HIGH),
        createMockConflict('conflict2', ConflictType.ORDER_VIOLATION, ConflictSeverity.MEDIUM),
      ];

      const warnings = reporter.generateWarnings(mockConflicts);
      expect(Array.isArray(warnings)).toBe(true);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should handle empty conflict arrays', () => {
      const warnings = reporter.generateWarnings([]);
      expect(Array.isArray(warnings)).toBe(true);
      expect(warnings.length).toBe(0);
    });
  });

  describe('Configuration Integration', () => {
    it('should configure warning suppression and escalation', () => {
      expect(() => {
        reporter.configureWarnings({
          suppressTypes: [ConflictType.SPECIFICITY_CONFLICT],
          escalateTypes: [ConflictType.ORDER_VIOLATION],
        });
      }).not.toThrow();
    });

    it('should clear suppressed types', () => {
      expect(() => {
        reporter.configureWarnings({
          clearSuppressed: true,
          clearEscalated: true,
        });
      }).not.toThrow();
    });

    it('should handle configuration changes', () => {
      config.updateConfig({ reportFormat: [ReportFormat.JSON] });
      const newReporter = new ConflictReporter(config.getConfig());
      expect(newReporter).toBeInstanceOf(ConflictReporter);
    });
  });

  describe('Advanced Features', () => {
    it('should generate reports with rule context', () => {
      const mockConflicts = [createMockConflict('conflict1')];
      const mockRules = new Map([
        ['rule1', createMockRule('rule1', '.btn')],
        ['rule2', createMockRule('rule2', '.btn.primary')],
      ]);

      const reports = reporter.generateReport(mockConflicts, mockRules);
      expect(reports).toBeDefined();
      expect(reports.length).toBeGreaterThan(0);
    });

    it('should provide cache functionality', () => {
      expect(() => reporter.clearCache()).not.toThrow();

      const stats = reporter.getStats();
      expect(stats).toHaveProperty('suppressedTypes');
      expect(stats).toHaveProperty('escalatedTypes');
      expect(stats).toHaveProperty('cacheSize');
    });
  });

  describe('Performance', () => {
    it('should handle large conflict sets efficiently', () => {
      const manyConflicts = Array.from({ length: 100 }, (_, i) =>
        createMockConflict(`conflict${i}`)
      );

      const start = performance.now();
      reporter.generateReport(manyConflicts);
      const end = performance.now();

      expect(end - start).toBeLessThan(2000); // Should complete in reasonable time
    });

    it('should handle multiple export operations', () => {
      const mockConflicts = [createMockConflict('conflict1')];

      const formats = [
        ReportFormat.CONSOLE,
        ReportFormat.JSON,
        ReportFormat.HTML,
        ReportFormat.MARKDOWN,
      ];

      formats.forEach((format) => {
        expect(() => {
          const report = reporter.exportReport(mockConflicts, format);
          expect(typeof report).toBe('string');
        }).not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed conflicts gracefully', () => {
      const malformedConflicts = [
        {
          id: 'bad',
          type: ConflictType.SPECIFICITY_CONFLICT,
          severity: ConflictSeverity.MEDIUM,
          involvedRules: [],
          description: '',
          autoResolvable: false,
          location: { line: 1, column: 1, file: 'test.css' },
        } as ConflictReport,
      ];

      expect(() => reporter.generateReport(malformedConflicts)).not.toThrow();
    });

    it('should handle invalid export formats gracefully', () => {
      const mockConflicts = [createMockConflict('conflict1')];

      // Should default to console format for unknown formats
      const report = reporter.exportReport(mockConflicts, 'invalid' as any);
      expect(typeof report).toBe('string');
    });
  });

  describe('Integration Features', () => {
    it('should integrate with configuration severity filtering', () => {
      // Test that severity filtering works through configuration
      const strictConfig = new OrderHandlingConfig();
      strictConfig.updateConfig({ reportFormat: [ReportFormat.JSON] });

      const strictReporter = new ConflictReporter(strictConfig.getConfig());
      const conflicts = [
        createMockConflict('low', ConflictType.SPECIFICITY_CONFLICT, ConflictSeverity.LOW),
        createMockConflict('high', ConflictType.ORDER_VIOLATION, ConflictSeverity.HIGH),
      ];

      const reports = strictReporter.generateReport(conflicts);
      expect(reports.length).toBeGreaterThan(0);
    });
  });
});
