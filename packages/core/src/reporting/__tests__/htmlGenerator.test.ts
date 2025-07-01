/**
 * Tests for HtmlReportGenerator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { HtmlReportGenerator, generateHtmlReport, generateHtmlString } from '../htmlGenerator.js';
import { OptimizationReport } from '../schema.js';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('HtmlReportGenerator', () => {
  let generator: HtmlReportGenerator;
  let mockReport: OptimizationReport;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new HtmlReportGenerator();
    
    mockReport = {
      metadata: {
        timestamp: '2024-01-01T12:00:00.000Z',
        version: '1.0.0',
        context: {
          projectName: 'Test Project',
          projectRoot: '/test/project'
        },
        generationTimeMs: 150
      },
      summary: {
        totalFiles: 3,
        filesOptimized: 2,
        filesFailed: 1,
        totalOriginalSizeBytes: 10000,
        totalOptimizedSizeBytes: 8000,
        totalSizeSavedBytes: 2000,
        totalSizeSavedPercent: 20,
        totalClasses: 100,
        totalClassesOptimized: 80,
        classOptimizationPercent: 80,
        totalProcessingTimeMs: 500,
        averageProcessingTimeMs: 166.67
      },
      files: [
        {
          originalPath: 'styles/main.css',
          optimizedPath: 'styles/main.css',
          originalSizeBytes: 5000,
          optimizedSizeBytes: 4000,
          sizeSavedBytes: 1000,
          sizeSavedPercent: 20,
          classCount: 50,
          classesOptimized: 40,
          processingTimeMs: 200
        },
        {
          originalPath: 'styles/components.css',
          optimizedPath: 'styles/components.css',
          originalSizeBytes: 3000,
          optimizedSizeBytes: 2500,
          sizeSavedBytes: 500,
          sizeSavedPercent: 16.67,
          classCount: 30,
          classesOptimized: 25,
          processingTimeMs: 150
        },
        {
          originalPath: 'styles/error.css',
          optimizedPath: 'styles/error.css',
          originalSizeBytes: 2000,
          optimizedSizeBytes: 2000,
          sizeSavedBytes: 0,
          sizeSavedPercent: 0,
          classCount: 20,
          classesOptimized: 0,
          processingTimeMs: 50,
          error: {
            message: 'Processing failed',
            code: 'PARSE_ERROR'
          }
        }
      ],
      performance: {
        memory: {
          peakUsageBytes: 50000000,
          startUsageBytes: 30000000,
          endUsageBytes: 35000000
        }
      },
      configuration: {
        options: {
          enableOptimization: true,
          compressionLevel: 9
        }
      },
      quality: {
        cssValidation: {
          errors: 1,
          warnings: 2,
          issues: [
            {
              type: 'error',
              message: 'Invalid property value',
              line: 10,
              file: 'styles/error.css'
            }
          ]
        }
      }
    };
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      expect(generator).toBeInstanceOf(HtmlReportGenerator);
    });

    it('should create with custom options', () => {
      const customGenerator = new HtmlReportGenerator({
        theme: 'dark',
        interactive: false,
        includeFiles: false,
        locale: 'en-GB'
      });
      expect(customGenerator).toBeInstanceOf(HtmlReportGenerator);
    });
  });

  describe('generateHtml', () => {
    it('should generate valid HTML from report', async () => {
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('TW-Enigma Optimization Report');
      expect(html).toContain('Test Project');
    });

    it('should include summary metrics in HTML', async () => {
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain('2.0 KB'); // Total savings
      expect(html).toContain('20.0%'); // Size saved percentage
      expect(html).toContain('2'); // Files optimized
      expect(html).toContain('3'); // Total files
      expect(html).toContain('80'); // Classes optimized
      expect(html).toContain('500.0ms'); // Total processing time
    });

    it('should include file details when enabled', async () => {
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain('main.css');
      expect(html).toContain('components.css');
      expect(html).toContain('error.css');
      expect(html).toContain('❌ Error'); // Error status
      expect(html).toContain('✅ Success'); // Success status
    });

    it('should exclude file details when disabled', async () => {
      const generator = new HtmlReportGenerator({ includeFiles: false });
      const html = await generator.generateHtml(mockReport);

      expect(html).not.toContain('File Details');
      expect(html).not.toContain('files-section');
    });

    it('should include performance metrics', async () => {
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain('47.7 MB'); // Peak memory (50000000 bytes)
      expect(html).toContain('28.6 MB'); // Start memory
      expect(html).toContain('33.4 MB'); // End memory
    });

    it('should include quality metrics when available', async () => {
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain('CSS Validation');
      expect(html).toContain('Errors:</span>');
      expect(html).toContain('<span class="quality-value">1</span>');
      expect(html).toContain('Warnings:</span>');
      expect(html).toContain('<span class="quality-value">2</span>');
    });

    it('should include interactive features when enabled', async () => {
      const generator = new HtmlReportGenerator({ interactive: true });
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain('Visual Analytics');
      expect(html).toContain('canvas id=');
      expect(html).toContain('<script>');
      expect(html).toContain('SimpleChart');
    });

    it('should exclude interactive features when disabled', async () => {
      const generator = new HtmlReportGenerator({ interactive: false });
      const html = await generator.generateHtml(mockReport);

      expect(html).not.toContain('Visual Analytics');
      expect(html).not.toContain('canvas id=');
      expect(html).not.toContain('SimpleChart');
    });

    it('should handle reports with comparison data', async () => {
      const reportWithComparison = {
        ...mockReport,
        comparison: {
          previousReportTimestamp: '2023-12-31T12:00:00.000Z',
          changes: {
            sizeSavedBytesDelta: 500,
            processingTimeMsDelta: -100,
            optimizationRateDelta: 5
          }
        }
      };

      const html = await generator.generateHtml(reportWithComparison);

      expect(html).toContain('Changes Since Previous Report');
      expect(html).toContain('+500 B'); // Size savings delta
      expect(html).toContain('-100.0ms'); // Processing time delta
      expect(html).toContain('+5.0%'); // Optimization rate delta
    });

    it('should handle reports with errors', async () => {
      const reportWithErrors = {
        ...mockReport,
        reportErrors: [
          {
            type: 'error' as const,
            message: 'Failed to process file',
            context: 'styles/broken.css'
          },
          {
            type: 'warning' as const,
            message: 'Deprecated configuration option used'
          }
        ]
      };

      const html = await generator.generateHtml(reportWithErrors);

      expect(html).toContain('Report Issues');
      expect(html).toContain('Failed to process file');
      expect(html).toContain('Deprecated configuration option');
      expect(html).toContain('❌'); // Error icon
      expect(html).toContain('⚠️'); // Warning icon
    });

    it('should apply custom theme', async () => {
      const generator = new HtmlReportGenerator({ theme: 'dark' });
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain('data-theme="dark"');
    });

    it('should include custom CSS when provided', async () => {
      const customCss = '.custom-style { color: red; }';
      const generator = new HtmlReportGenerator({ customCss });
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain(customCss);
    });

    it('should include custom JavaScript when provided', async () => {
      const customJs = 'console.log("Custom JS");';
      const generator = new HtmlReportGenerator({ customJs });
      const html = await generator.generateHtml(mockReport);

      expect(html).toContain(customJs);
    });
  });

  describe('generateHtmlFile', () => {
    it('should generate and save HTML file', async () => {
      const outputPath = '/test/output/report.html';

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await generator.generateHtmlFile(mockReport, outputPath);

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/output', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('<!DOCTYPE html>'),
        'utf8'
      );
    });

    it('should handle file system errors', async () => {
      const outputPath = '/test/output/report.html';

      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(generator.generateHtmlFile(mockReport, outputPath)).rejects.toThrow('Failed to generate HTML file');
    });
  });

  describe('error handling', () => {
    it('should handle invalid report data', async () => {
      const invalidReport = null as any;
      const html = await generator.generateHtml(invalidReport);

      expect(html).toContain('Report Generation Failed');
      expect(html).toContain('Invalid report data');
    });

    it('should handle reports with missing required sections', async () => {
      const incompleteReport = {
        metadata: mockReport.metadata
        // Missing summary, files, etc.
      } as any;

      const html = await generator.generateHtml(incompleteReport);

      expect(html).toContain('Report Generation Failed');
      expect(html).toContain('missing required sections');
    });

    it('should handle reports with invalid timestamp', async () => {
      const reportWithInvalidTimestamp = {
        ...mockReport,
        metadata: {
          ...mockReport.metadata,
          timestamp: 'invalid-timestamp'
        }
      };

      const html = await generator.generateHtml(reportWithInvalidTimestamp);

      expect(html).toContain('Report Generation Failed');
      expect(html).toContain('invalid timestamp');
    });

    it('should generate error report for any processing failure', async () => {
      // Mock a scenario where template rendering fails
      const problematicGenerator = new class extends HtmlReportGenerator {
        protected renderTemplate() {
          throw new Error('Template rendering failed');
        }
      }();

      const html = await problematicGenerator.generateHtml(mockReport);

      expect(html).toContain('Report Generation Failed');
      expect(html).toContain('Template rendering failed');
    });
  });

  describe('formatting methods', () => {
    it('should format bytes correctly', async () => {
      const testCases = [
        { bytes: 0, expected: '0 B' },
        { bytes: 512, expected: '512 B' },
        { bytes: 1024, expected: '1.0 KB' },
        { bytes: 1536, expected: '1.5 KB' },
        { bytes: 1048576, expected: '1.0 MB' },
        { bytes: 1073741824, expected: '1.0 GB' }
      ];

      for (const testCase of testCases) {
        const reportWithSize = {
          ...mockReport,
          summary: {
            ...mockReport.summary,
            totalSizeSavedBytes: testCase.bytes
          }
        };

        const html = await generator.generateHtml(reportWithSize);
        expect(html).toContain(testCase.expected);
      }
    });

    it('should format time correctly', async () => {
      const testCases = [
        { ms: 50, expected: '50.0ms' },
        { ms: 1500, expected: '1.50s' },
        { ms: 65000, expected: '1.08m' }
      ];

      for (const testCase of testCases) {
        const reportWithTime = {
          ...mockReport,
          summary: {
            ...mockReport.summary,
            totalProcessingTimeMs: testCase.ms
          }
        };

        const html = await generator.generateHtml(reportWithTime);
        expect(html).toContain(testCase.expected);
      }
    });

    it('should format percentages correctly', async () => {
      const reportWithPercent = {
        ...mockReport,
        summary: {
          ...mockReport.summary,
          totalSizeSavedPercent: 25.456
        }
      };

      const html = await generator.generateHtml(reportWithPercent);
      expect(html).toContain('25.5%');
    });
  });

  describe('utility functions', () => {
    describe('generateHtmlReport', () => {
      it('should generate and save HTML report', async () => {
        const outputPath = '/test/output/report.html';

        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);

        await generateHtmlReport(mockReport, outputPath);

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          outputPath,
          expect.stringContaining('<!DOCTYPE html>'),
          'utf8'
        );
      });

      it('should use custom options', async () => {
        const outputPath = '/test/output/report.html';
        const options = { theme: 'dark' as const, interactive: false };

        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);

        await generateHtmlReport(mockReport, outputPath, options);

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          outputPath,
          expect.stringContaining('data-theme="dark"'),
          'utf8'
        );
      });
    });

    describe('generateHtmlString', () => {
      it('should generate HTML string without saving', async () => {
        const html = await generateHtmlString(mockReport);

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('TW-Enigma Optimization Report');
        expect(mockFs.writeFile).not.toHaveBeenCalled();
      });

      it('should use custom options', async () => {
        const options = { theme: 'dark' as const };
        const html = await generateHtmlString(mockReport, options);

        expect(html).toContain('data-theme="dark"');
      });
    });
  });
});