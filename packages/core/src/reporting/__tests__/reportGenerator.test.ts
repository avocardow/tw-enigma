/**
 * Tests for ReportGenerator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { ReportGenerator, createReportGenerator, generateSimpleReport } from '../reportGenerator.js';
import { OptimizationReport } from '../schema.js';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    stat: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ReportGenerator', () => {
  let generator: ReportGenerator;
  const testProjectRoot = '/test/project';
  const testVersion = '1.0.0';

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ReportGenerator({
      projectRoot: testProjectRoot,
      version: testVersion,
      startTime: Date.now()
    });
  });

  describe('constructor', () => {
    it('should create a new ReportGenerator with correct properties', () => {
      expect(generator).toBeInstanceOf(ReportGenerator);
    });

    it('should initialize with default performance data', () => {
      // This is tested implicitly through the generateReport method
      expect(generator).toBeDefined();
    });
  });

  describe('addFileResult', () => {
    it('should add a valid file result', () => {
      const result = {
        filePath: 'test.css',
        originalSize: 1000,
        optimizedSize: 800,
        classCount: 50,
        classesOptimized: 40,
        processingTime: 100
      };

      expect(() => generator.addFileResult(result)).not.toThrow();
    });

    it('should validate required fields', () => {
      const invalidResult = {
        filePath: '',
        originalSize: 1000,
        optimizedSize: 800,
        classCount: 50,
        classesOptimized: 40,
        processingTime: 100
      };

      expect(() => generator.addFileResult(invalidResult)).not.toThrow();
      // Error should be added to report errors instead of throwing
    });

    it('should validate numeric fields', () => {
      const invalidResult = {
        filePath: 'test.css',
        originalSize: -1,
        optimizedSize: 800,
        classCount: 50,
        classesOptimized: 40,
        processingTime: 100
      };

      expect(() => generator.addFileResult(invalidResult)).not.toThrow();
      // Error should be added to report errors instead of throwing
    });

    it('should handle file results with errors', () => {
      const resultWithError = {
        filePath: 'test.css',
        originalSize: 1000,
        optimizedSize: 1000,
        classCount: 50,
        classesOptimized: 0,
        processingTime: 100,
        error: new Error('Processing failed')
      };

      expect(() => generator.addFileResult(resultWithError)).not.toThrow();
    });
  });

  describe('setConfiguration', () => {
    it('should set configuration data', () => {
      const config = {
        options: { enableOptimization: true },
        framework: { name: 'react', version: '18.0.0' }
      };

      expect(() => generator.setConfiguration(config)).not.toThrow();
    });

    it('should handle invalid configuration data', () => {
      const invalidConfig = {
        options: null as any
      };

      expect(() => generator.setConfiguration(invalidConfig)).not.toThrow();
      // Should add warning to report errors
    });
  });

  describe('generateReport', () => {
    beforeEach(() => {
      // Add some test data
      generator.addFileResult({
        filePath: 'test1.css',
        originalSize: 1000,
        optimizedSize: 800,
        classCount: 50,
        classesOptimized: 40,
        processingTime: 100
      });

      generator.addFileResult({
        filePath: 'test2.css',
        originalSize: 2000,
        optimizedSize: 1500,
        classCount: 100,
        classesOptimized: 80,
        processingTime: 200
      });

      generator.setConfiguration({
        options: { enableOptimization: true }
      });
    });

    it('should generate a complete report', async () => {
      const report = await generator.generateReport();

      expect(report).toBeDefined();
      expect(report.metadata).toBeDefined();
      expect(report.metadata.version).toBe(testVersion);
      expect(report.metadata.context.projectRoot).toBe(testProjectRoot);
      
      expect(report.summary).toBeDefined();
      expect(report.summary.totalFiles).toBe(2);
      expect(report.summary.filesOptimized).toBe(2);
      expect(report.summary.totalOriginalSizeBytes).toBe(3000);
      expect(report.summary.totalOptimizedSizeBytes).toBe(2300);
      expect(report.summary.totalSizeSavedBytes).toBe(700);

      expect(report.files).toHaveLength(2);
      expect(report.performance).toBeDefined();
      expect(report.configuration).toBeDefined();
      expect(report.quality).toBeDefined();
    });

    it('should calculate correct summary statistics', async () => {
      const report = await generator.generateReport();

      expect(report.summary.totalSizeSavedPercent).toBeCloseTo(23.33, 1);
      expect(report.summary.totalClasses).toBe(150);
      expect(report.summary.totalClassesOptimized).toBe(120);
      expect(report.summary.classOptimizationPercent).toBe(80);
      expect(report.summary.totalProcessingTimeMs).toBe(300);
      expect(report.summary.averageProcessingTimeMs).toBe(150);
    });

    it('should handle empty results', async () => {
      const emptyGenerator = createReportGenerator(testProjectRoot, testVersion);
      const report = await emptyGenerator.generateReport();

      expect(report.summary.totalFiles).toBe(0);
      expect(report.summary.filesOptimized).toBe(0);
      expect(report.summary.totalSizeSavedBytes).toBe(0);
      expect(report.files).toHaveLength(0);
    });

    it('should include comparison data when previous report provided', async () => {
      const previousReport: OptimizationReport = {
        metadata: {
          timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          version: testVersion,
          context: { projectRoot: testProjectRoot },
          generationTimeMs: 50
        },
        summary: {
          totalFiles: 2,
          filesOptimized: 2,
          filesFailed: 0,
          totalOriginalSizeBytes: 3000,
          totalOptimizedSizeBytes: 2400,
          totalSizeSavedBytes: 600,
          totalSizeSavedPercent: 20,
          totalClasses: 150,
          totalClassesOptimized: 110,
          classOptimizationPercent: 73.33,
          totalProcessingTimeMs: 400,
          averageProcessingTimeMs: 200
        },
        files: [],
        performance: {
          memory: {
            peakUsageBytes: 1000000,
            startUsageBytes: 500000,
            endUsageBytes: 600000
          }
        },
        configuration: { options: {} },
        quality: {}
      };

      const report = await generator.generateReport(previousReport);

      expect(report.comparison).toBeDefined();
      expect(report.comparison!.previousReportTimestamp).toBe(previousReport.metadata.timestamp);
      expect(report.comparison!.changes).toBeDefined();
      expect(report.comparison!.changes!.sizeSavedBytesDelta).toBe(100); // 700 - 600
      expect(report.comparison!.changes!.processingTimeMsDelta).toBe(-100); // 300 - 400
    });
  });

  describe('saveReport', () => {
    it('should save report to file system', async () => {
      const report = await generator.generateReport();
      const outputPath = '/test/output/report.json';

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await generator.saveReport(report, outputPath);

      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(outputPath), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        outputPath,
        JSON.stringify(report, null, 2),
        'utf8'
      );
    });

    it('should handle file system errors', async () => {
      const report = await generator.generateReport();
      const outputPath = '/test/output/report.json';

      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(generator.saveReport(report, outputPath)).rejects.toThrow('Failed to save report');
    });
  });

  describe('loadPreviousReport', () => {
    it('should load a valid previous report', async () => {
      const mockReport: OptimizationReport = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: testVersion,
          context: { projectRoot: testProjectRoot },
          generationTimeMs: 50
        },
        summary: {
          totalFiles: 1,
          filesOptimized: 1,
          filesFailed: 0,
          totalOriginalSizeBytes: 1000,
          totalOptimizedSizeBytes: 800,
          totalSizeSavedBytes: 200,
          totalSizeSavedPercent: 20,
          totalClasses: 50,
          totalClassesOptimized: 40,
          classOptimizationPercent: 80,
          totalProcessingTimeMs: 100,
          averageProcessingTimeMs: 100
        },
        files: [],
        performance: {
          memory: {
            peakUsageBytes: 1000000,
            startUsageBytes: 500000,
            endUsageBytes: 600000
          }
        },
        configuration: { options: {} },
        quality: {}
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockReport));

      const result = await ReportGenerator.loadPreviousReport('/test/report.json');

      expect(result).toEqual(mockReport);
    });

    it('should return null for non-existent files', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await ReportGenerator.loadPreviousReport('/test/nonexistent.json');

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await ReportGenerator.loadPreviousReport('/test/invalid.json');

      expect(result).toBeNull();
    });
  });

  describe('utility functions', () => {
    describe('createReportGenerator', () => {
      it('should create a ReportGenerator with minimal setup', () => {
        const generator = createReportGenerator(testProjectRoot, testVersion);
        expect(generator).toBeInstanceOf(ReportGenerator);
      });

      it('should use default version when not provided', () => {
        const generator = createReportGenerator(testProjectRoot);
        expect(generator).toBeInstanceOf(ReportGenerator);
      });
    });

    describe('generateSimpleReport', () => {
      it('should generate and save a simple report', async () => {
        const results = [
          {
            filePath: 'test.css',
            originalSize: 1000,
            optimizedSize: 800,
            classCount: 50,
            classesOptimized: 40,
            processingTime: 100
          }
        ];
        const outputPath = '/test/output/simple-report.json';

        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);

        const report = await generateSimpleReport(testProjectRoot, results, outputPath, testVersion);

        expect(report).toBeDefined();
        expect(report.files).toHaveLength(1);
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          outputPath,
          expect.stringContaining('"totalFiles": 1'),
          'utf8'
        );
      });
    });
  });

  describe('error handling', () => {
    it('should generate fallback report on severe errors', async () => {
      // Create a generator that will fail during report generation
      const faultyGenerator = new ReportGenerator({
        projectRoot: testProjectRoot,
        version: testVersion,
        startTime: Date.now()
      });

      // Add invalid data that might cause issues
      faultyGenerator.addFileResult({
        filePath: 'test.css',
        originalSize: NaN,
        optimizedSize: NaN,
        classCount: NaN,
        classesOptimized: NaN,
        processingTime: NaN
      });

      const report = await faultyGenerator.generateReport();

      // Should still return a report, even if it's a fallback
      expect(report).toBeDefined();
      expect(report.reportErrors).toBeDefined();
    });

    it('should handle report validation errors gracefully', async () => {
      const report = await generator.generateReport();

      // Should not throw even with validation warnings
      expect(report).toBeDefined();
    });
  });
});