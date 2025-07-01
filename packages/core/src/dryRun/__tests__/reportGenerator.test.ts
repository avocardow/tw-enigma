/**
 * Dry Run Report Generator Tests
 * Tests for the dry run report generation system
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { DryRunReportGenerator, generatePreviewReport } from '../reportGenerator';
import type { DryRunResult, DryRunContext } from '../dryRunManager';

describe('DryRunReportGenerator', () => {
  let generator: DryRunReportGenerator;
  let mockResult: DryRunResult;

  beforeEach(() => {
    generator = new DryRunReportGenerator();

    // Create mock dry run result
    mockResult = {
      context: {
        sessionId: 'test-session-123',
        startTime: Date.now() - 5000,
        config: {
          enabled: true,
          logOperations: true,
          validateOperations: true,
          maxOperations: 10000,
          includeFileSystemChecks: true,
          simulateLatency: false,
          operationTimeout: 5000,
        },
        operations: [
          {
            type: 'file-write',
            id: 'op-1',
            target: '/project/src/styles.css',
            description: 'Create optimized CSS file',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: 2048,
          },
          {
            type: 'file-modify',
            id: 'op-2',
            target: '/project/src/index.html',
            description: 'Update HTML with scrambled classes',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: 512,
          },
          {
            type: 'file-delete',
            id: 'op-3',
            target: '/project/temp/old-styles.css',
            description: 'Remove temporary CSS file',
            timestamp: Date.now(),
            wouldSucceed: false,
            potentialError: 'File may not exist',
            sizeImpact: -1024,
          },
        ],
        operationCounts: {
          'file-write': 1,
          'file-modify': 1,
          'file-delete': 1,
        },
        metadata: {
          projectRoot: '/project',
          optimizationLevel: 'aggressive',
          targetFramework: 'react',
        },
      } as DryRunContext,
      totalOperations: 3,
      operationsByType: {
        'file-write': [
          {
            type: 'file-write',
            id: 'op-1',
            target: '/project/src/styles.css',
            description: 'Create optimized CSS file',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: 2048,
          },
        ],
        'file-modify': [
          {
            type: 'file-modify',
            id: 'op-2',
            target: '/project/src/index.html',
            description: 'Update HTML with scrambled classes',
            timestamp: Date.now(),
            wouldSucceed: true,
            sizeImpact: 512,
          },
        ],
        'file-delete': [
          {
            type: 'file-delete',
            id: 'op-3',
            target: '/project/temp/old-styles.css',
            description: 'Remove temporary CSS file',
            timestamp: Date.now(),
            wouldSucceed: false,
            potentialError: 'File may not exist',
            sizeImpact: -1024,
          },
        ],
      },
      summary: {
        filesWouldBeCreated: 1,
        filesWouldBeModified: 1,
        filesWouldBeDeleted: 1,
        directoriesWouldBeCreated: 0,
        directoriesWouldBeDeleted: 0,
        totalSizeImpact: 1536, // 2048 + 512 - 1024
        estimatedDuration: 150,
        potentialErrors: 1,
      },
      duration: 4500,
    };
  });

  describe('Report Generation', () => {
    test('should generate basic report', () => {
      const report = generator.generateReport(mockResult);

      expect(report).toBeDefined();
      expect(report.metadata).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.sections).toHaveLength(4); // File ops, dir ops, performance, safety
      expect(report.issues).toBeDefined();
    });

    test('should include correct metadata', () => {
      const report = generator.generateReport(mockResult);

      expect(report.metadata.session.id).toBe('test-session-123');
      expect(report.metadata.project.root).toBe('/project');
      expect(report.metadata.project.framework).toBe('react');
      expect(report.metadata.project.optimizationLevel).toBe('aggressive');
    });

    test('should generate executive summary', () => {
      const report = generator.generateReport(mockResult);

      expect(report.summary.title).toBe('Executive Summary');
      expect(report.summary.content).toContain('Total Operations: 3');
      expect(report.summary.content).toContain('1 files would be created');
      expect(report.summary.content).toContain('1 files would be modified');
      expect(report.summary.content).toContain('1 files would be deleted');
    });

    test('should detect issues correctly', () => {
      const report = generator.generateReport(mockResult);

      expect(report.issues.errors).toHaveLength(1);
      expect(report.issues.errors[0]).toContain('File may not exist');
      expect(report.issues.warnings).toHaveLength(1);
      expect(report.issues.warnings[0]).toContain('1 operations may encounter issues');
    });

    test('should respect configuration options', () => {
      const config = {
        includeRawData: true,
        maxOperationsPerSection: 1,
      };

      const report = generator.generateReport(mockResult, config);

      expect(report.data.operations).toHaveLength(3);
      expect(report.metadata.config.includeRawData).toBe(true);
      expect(report.metadata.config.maxOperationsPerSection).toBe(1);
    });
  });

  describe('Export Formats', () => {
    test('should export to JSON', () => {
      const report = generator.generateReport(mockResult);
      const exported = generator.exportReport(report, 'json');

      expect(() => JSON.parse(exported)).not.toThrow();
      const parsed = JSON.parse(exported);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.summary).toBeDefined();
    });

    test('should export to HTML', () => {
      const report = generator.generateReport(mockResult);
      const exported = generator.exportReport(report, 'html');

      expect(exported).toContain('<!DOCTYPE html>');
      expect(exported).toContain('Dry Run Preview Report');
      expect(exported).toContain('Executive Summary');
    });

    test('should export to Markdown', () => {
      const report = generator.generateReport(mockResult);
      const exported = generator.exportReport(report, 'markdown');

      expect(exported).toContain('# Dry Run Preview Report');
      expect(exported).toContain('## Executive Summary');
      expect(exported).toContain('```');
    });

    test('should export to text', () => {
      const report = generator.generateReport(mockResult);
      const exported = generator.exportReport(report, 'text');

      expect(exported).toContain('DRY RUN PREVIEW REPORT');
      expect(exported).toContain('EXECUTIVE SUMMARY');
      expect(exported).toContain('='.repeat(60));
    });

    test('should handle custom styling in HTML', () => {
      const config = {
        styling: {
          theme: 'dark' as const,
          showIcons: true,
          compact: false,
        },
      };

      const report = generator.generateReport(mockResult, config);
      const exported = generator.exportReport(report, 'html');

      expect(exported).toContain('background: #1a1a1a');
      expect(exported).toContain('📊'); // Report icon
    });
  });

  describe('Section Generation', () => {
    test('should generate file operations section', () => {
      const report = generator.generateReport(mockResult);
      const fileSection = report.sections.find(s => s.title === 'File Operations');

      expect(fileSection).toBeDefined();
      expect(fileSection!.subsections).toHaveLength(3); // Create, modify, delete
      expect(fileSection!.metadata?.creates).toBe(1);
      expect(fileSection!.metadata?.modifies).toBe(1);
      expect(fileSection!.metadata?.deletes).toBe(1);
    });

    test('should generate performance section', () => {
      const report = generator.generateReport(mockResult);
      const perfSection = report.sections.find(s => s.title === 'Performance Analysis');

      expect(perfSection).toBeDefined();
      expect(perfSection!.content).toContain('Estimated Duration: 150ms');
      expect(perfSection!.content).toContain('Session Duration: 4500ms');
    });

    test('should generate safety section', () => {
      const report = generator.generateReport(mockResult);
      const safetySection = report.sections.find(s => s.title === 'Safety Validation');

      expect(safetySection).toBeDefined();
      expect(safetySection!.content).toContain('Potential Errors: 1');
      expect(safetySection!.metadata?.safe).toBe(false);
    });

    test('should skip empty sections', () => {
      // Create result with no directory operations
      const resultNoDirs = {
        ...mockResult,
        operationsByType: {
          'file-write': mockResult.operationsByType['file-write'],
          'file-modify': mockResult.operationsByType['file-modify'],
          'file-delete': mockResult.operationsByType['file-delete'],
        },
      };

      const report = generator.generateReport(resultNoDirs);
      const dirSection = report.sections.find(s => s.title === 'Directory Operations');

      expect(dirSection).toBeDefined();
      expect(dirSection!.content).toContain('No directory operations');
      expect(dirSection!.subsections).toEqual([]);
    });
  });

  describe('Utility Functions', () => {
    test('should format bytes correctly', () => {
      const report = generator.generateReport(mockResult);

      expect(report.summary.content).toContain('+1.50 KB'); // 1536 bytes
    });

    test('should handle operation limits', () => {
      const config = { maxOperationsPerSection: 1 };
      const report = generator.generateReport(mockResult, config);

      const fileSection = report.sections.find(s => s.title === 'File Operations');
      const createSubsection = fileSection?.subsections?.find(s => s.title.includes('Create'));

      expect(createSubsection?.content).not.toContain('... and');
    });

    test('should truncate long operation lists', () => {
      // Create a result with many operations
      const manyOps = Array.from({ length: 60 }, (_, i) => ({
        type: 'file-write' as const,
        id: `op-${i}`,
        target: `/project/file-${i}.css`,
        description: `Create file ${i}`,
        timestamp: Date.now(),
        wouldSucceed: true,
        sizeImpact: 100,
      }));

      const resultManyOps = {
        ...mockResult,
        operationsByType: {
          'file-write': manyOps,
        },
        totalOperations: manyOps.length,
      };

      const config = { maxOperationsPerSection: 10 };
      const report = generator.generateReport(resultManyOps, config);

      const fileSection = report.sections.find(s => s.title === 'File Operations');
      const createSubsection = fileSection?.subsections?.find(s => s.title.includes('Create'));

      expect(createSubsection?.content).toContain('... and 50 more operations');
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = { format: 'markdown' as const };
      generator.updateConfig(newConfig);

      const config = generator.getConfig();
      expect(config.format).toBe('markdown');
    });

    test('should preserve existing configuration', () => {
      const originalConfig = generator.getConfig();
      generator.updateConfig({ format: 'json' });

      const updatedConfig = generator.getConfig();
      expect(updatedConfig.includeOperationDetails).toBe(originalConfig.includeOperationDetails);
      expect(updatedConfig.format).toBe('json');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid export format', () => {
      const report = generator.generateReport(mockResult);

      expect(() => {
        generator.exportReport(report, 'invalid' as any);
      }).toThrow('Unsupported export format: invalid');
    });

    test('should handle malformed result data', () => {
      const invalidResult = {
        ...mockResult,
        context: null as any,
      };

      expect(() => {
        generator.generateReport(invalidResult);
      }).toThrow();
    });
  });

  describe('Global Functions', () => {
    test('should generate preview report', () => {
      const reportText = generatePreviewReport(mockResult, { format: 'text' });

      expect(reportText).toContain('DRY RUN PREVIEW REPORT');
      expect(reportText).toContain('Total Operations: 3');
    });
  });
});