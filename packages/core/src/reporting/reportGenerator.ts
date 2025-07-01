/**
 * JSON Report Generation Module for TW-Enigma
 * Aggregates optimization data and generates reports conforming to the defined schema
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  OptimizationReport,
  ReportMetadata,
  OptimizationSummary,
  FileOptimizationResult,
  PerformanceMetrics,
  ConfigurationDetails,
  QualityMetrics,
  OPTIMIZATION_REPORT_SCHEMA,
  REPORT_SCHEMA_VERSION
} from './schema.js';

interface OptimizationContext {
  projectRoot: string;
  projectName?: string;
  configPath?: string;
  revision?: string;
  startTime: number;
  version: string;
}

interface ProcessingResult {
  filePath: string;
  originalSize: number;
  optimizedSize: number;
  classCount: number;
  classesOptimized: number;
  processingTime: number;
  error?: Error;
}

interface PerformanceData {
  memoryUsage: {
    start: number;
    peak: number;
    end: number;
  };
  cpuTime?: number;
  diskIO?: {
    filesRead: number;
    filesWritten: number;
    bytesRead: number;
    bytesWritten: number;
  };
}

interface ConfigurationData {
  options: Record<string, any>;
  framework?: {
    name: string;
    version?: string;
    settings?: Record<string, any>;
  };
  patterns?: {
    strategy: string;
    customPatterns?: string[];
    statistics?: {
      totalPatterns: number;
      patternsMatched: number;
    };
  };
}

interface QualityData {
  cssValidation?: {
    errors: number;
    warnings: number;
    issues?: Array<{
      type: 'error' | 'warning';
      message: string;
      line?: number;
      column?: number;
      file?: string;
    }>;
  };
  accessibility?: {
    preserved: boolean;
    issues?: string[];
    score?: number;
  };
  compatibility?: {
    supportedBrowsers: string[];
    issues?: Array<{
      browser: string;
      version: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

export class ReportGenerator {
  private context: OptimizationContext;
  private results: ProcessingResult[] = [];
  private performanceData: PerformanceData;
  private configurationData: ConfigurationData;
  private qualityData: QualityData = {};
  private reportErrors: Array<{ type: 'error' | 'warning'; message: string; context?: string }> = [];

  constructor(context: OptimizationContext) {
    this.context = context;
    this.performanceData = {
      memoryUsage: {
        start: process.memoryUsage().heapUsed,
        peak: process.memoryUsage().heapUsed,
        end: 0
      }
    };
    this.configurationData = { options: {} };
  }

  /**
   * Add a file processing result to the report
   */
  addFileResult(result: ProcessingResult): void {
    try {
      // Validate required fields
      if (!result.filePath) {
        throw new Error('File path is required');
      }
      if (typeof result.originalSize !== 'number' || result.originalSize < 0) {
        throw new Error('Original size must be a non-negative number');
      }
      if (typeof result.optimizedSize !== 'number' || result.optimizedSize < 0) {
        throw new Error('Optimized size must be a non-negative number');
      }

      this.results.push(result);
      
      // Update peak memory usage
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory > this.performanceData.memoryUsage.peak) {
        this.performanceData.memoryUsage.peak = currentMemory;
      }
    } catch (error) {
      this.addReportError('error', `Failed to add file result: ${error instanceof Error ? error.message : String(error)}`, result.filePath);
    }
  }

  /**
   * Set configuration data for the report
   */
  setConfiguration(data: ConfigurationData): void {
    try {
      this.configurationData = { ...data };
      
      // Validate configuration data
      if (!data.options || typeof data.options !== 'object') {
        this.addReportError('warning', 'Configuration options are missing or invalid');
      }
    } catch (error) {
      this.addReportError('error', `Failed to set configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set quality metrics data for the report
   */
  setQualityData(data: QualityData): void {
    try {
      this.qualityData = { ...data };
    } catch (error) {
      this.addReportError('error', `Failed to set quality data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set performance data for the report
   */
  setPerformanceData(data: Partial<PerformanceData>): void {
    try {
      this.performanceData = {
        ...this.performanceData,
        ...data
      };
    } catch (error) {
      this.addReportError('error', `Failed to set performance data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add an error or warning to the report
   */
  addReportError(type: 'error' | 'warning', message: string, context?: string): void {
    this.reportErrors.push({ type, message, context });
  }

  /**
   * Generate the complete optimization report
   */
  async generateReport(previousReport?: OptimizationReport): Promise<OptimizationReport> {
    try {
      const generationStart = Date.now();
      
      // Finalize performance data
      this.performanceData.memoryUsage.end = process.memoryUsage().heapUsed;

      // Generate all report sections
      const metadata = this.generateMetadata(generationStart);
      const summary = this.generateSummary();
      const files = this.generateFileResults();
      const performance = this.generatePerformanceMetrics();
      const configuration = this.generateConfigurationDetails();
      const quality = this.generateQualityMetrics();
      const comparison = previousReport ? this.generateComparison(previousReport) : undefined;

      const report: OptimizationReport = {
        metadata,
        summary,
        files,
        performance,
        configuration,
        quality,
        ...(comparison && { comparison }),
        ...(this.reportErrors.length > 0 && { reportErrors: this.reportErrors })
      };

      // Validate the generated report
      await this.validateReport(report);

      return report;
    } catch (error) {
      this.addReportError('error', `Failed to generate report: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return a minimal valid report even if generation fails
      return this.generateFallbackReport();
    }
  }

  /**
   * Save report to file system
   */
  async saveReport(report: OptimizationReport, outputPath: string): Promise<void> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Write report with pretty formatting
      const reportJson = JSON.stringify(report, null, 2);
      await fs.writeFile(outputPath, reportJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save report to ${outputPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load previous report for comparison
   */
  static async loadPreviousReport(reportPath: string): Promise<OptimizationReport | null> {
    try {
      const reportContent = await fs.readFile(reportPath, 'utf8');
      const report = JSON.parse(reportContent) as OptimizationReport;
      
      // Basic validation
      if (!report.metadata || !report.summary) {
        throw new Error('Invalid report format');
      }
      
      return report;
    } catch (error) {
      return null;
    }
  }

  private generateMetadata(generationStart: number): ReportMetadata {
    return {
      timestamp: new Date().toISOString(),
      version: this.context.version,
      context: {
        projectName: this.context.projectName,
        projectRoot: this.context.projectRoot,
        configPath: this.context.configPath,
        revision: this.context.revision
      },
      generationTimeMs: Date.now() - generationStart
    };
  }

  private generateSummary(): OptimizationSummary {
    const totalFiles = this.results.length;
    const successfulResults = this.results.filter(r => !r.error);
    const failedResults = this.results.filter(r => r.error);

    const totalOriginalSize = successfulResults.reduce((sum, r) => sum + r.originalSize, 0);
    const totalOptimizedSize = successfulResults.reduce((sum, r) => sum + r.optimizedSize, 0);
    const totalSizeSaved = totalOriginalSize - totalOptimizedSize;
    const totalSizeSavedPercent = totalOriginalSize > 0 ? (totalSizeSaved / totalOriginalSize) * 100 : 0;

    const totalClasses = successfulResults.reduce((sum, r) => sum + r.classCount, 0);
    const totalClassesOptimized = successfulResults.reduce((sum, r) => sum + r.classesOptimized, 0);
    const classOptimizationPercent = totalClasses > 0 ? (totalClassesOptimized / totalClasses) * 100 : 0;

    const totalProcessingTime = successfulResults.reduce((sum, r) => sum + r.processingTime, 0);
    const averageProcessingTime = successfulResults.length > 0 ? totalProcessingTime / successfulResults.length : 0;

    return {
      totalFiles,
      filesOptimized: successfulResults.length,
      filesFailed: failedResults.length,
      totalOriginalSizeBytes: totalOriginalSize,
      totalOptimizedSizeBytes: totalOptimizedSize,
      totalSizeSavedBytes: totalSizeSaved,
      totalSizeSavedPercent: Math.round(totalSizeSavedPercent * 100) / 100,
      totalClasses,
      totalClassesOptimized,
      classOptimizationPercent: Math.round(classOptimizationPercent * 100) / 100,
      totalProcessingTimeMs: Math.round(totalProcessingTime * 100) / 100,
      averageProcessingTimeMs: Math.round(averageProcessingTime * 100) / 100
    };
  }

  private generateFileResults(): FileOptimizationResult[] {
    return this.results.map(result => {
      const sizeSaved = result.originalSize - result.optimizedSize;
      const sizeSavedPercent = result.originalSize > 0 ? (sizeSaved / result.originalSize) * 100 : 0;

      const fileResult: FileOptimizationResult = {
        originalPath: result.filePath,
        optimizedPath: result.filePath, // Assuming in-place optimization
        originalSizeBytes: result.originalSize,
        optimizedSizeBytes: result.optimizedSize,
        sizeSavedBytes: sizeSaved,
        sizeSavedPercent: Math.round(sizeSavedPercent * 100) / 100,
        classCount: result.classCount,
        classesOptimized: result.classesOptimized,
        processingTimeMs: Math.round(result.processingTime * 100) / 100
      };

      if (result.error) {
        fileResult.error = {
          message: result.error.message,
          code: result.error.name,
          stack: result.error.stack
        };
      }

      return fileResult;
    });
  }

  private generatePerformanceMetrics(): PerformanceMetrics {
    return {
      memory: {
        peakUsageBytes: this.performanceData.memoryUsage.peak,
        startUsageBytes: this.performanceData.memoryUsage.start,
        endUsageBytes: this.performanceData.memoryUsage.end
      },
      ...(this.performanceData.cpuTime && {
        cpu: {
          cpuTimeMs: this.performanceData.cpuTime,
          averageUtilizationPercent: 0 // Would need process monitoring to calculate this
        }
      }),
      ...(this.performanceData.diskIO && {
        disk: this.performanceData.diskIO
      })
    };
  }

  private generateConfigurationDetails(): ConfigurationDetails {
    const config: ConfigurationDetails = {
      options: this.configurationData.options
    };

    if (this.configurationData.framework) {
      config.framework = this.configurationData.framework;
    }

    if (this.configurationData.patterns) {
      config.patterns = {
        ...this.configurationData.patterns,
        ...(this.configurationData.patterns.statistics && {
          statistics: {
            ...this.configurationData.patterns.statistics,
            patternMatchRate: this.configurationData.patterns.statistics.totalPatterns > 0
              ? (this.configurationData.patterns.statistics.patternsMatched / this.configurationData.patterns.statistics.totalPatterns) * 100
              : 0
          }
        })
      };
    }

    return config;
  }

  private generateQualityMetrics(): QualityMetrics {
    return this.qualityData;
  }

  private generateComparison(previousReport: OptimizationReport) {
    const currentSummary = this.generateSummary();
    const previousSummary = previousReport.summary;

    return {
      previousReportTimestamp: previousReport.metadata.timestamp,
      changes: {
        sizeSavedBytesDelta: currentSummary.totalSizeSavedBytes - previousSummary.totalSizeSavedBytes,
        processingTimeMsDelta: currentSummary.totalProcessingTimeMs - previousSummary.totalProcessingTimeMs,
        optimizationRateDelta: currentSummary.classOptimizationPercent - previousSummary.classOptimizationPercent
      }
    };
  }

  private async validateReport(report: OptimizationReport): Promise<void> {
    try {
      // Basic structural validation
      if (!report.metadata || !report.summary || !report.files || !report.performance || !report.configuration || !report.quality) {
        throw new Error('Report is missing required sections');
      }

      // Validate timestamp format
      const timestamp = new Date(report.metadata.timestamp);
      if (isNaN(timestamp.getTime())) {
        throw new Error('Invalid timestamp format');
      }

      // Validate numeric constraints
      if (report.summary.totalSizeSavedPercent < 0 || report.summary.totalSizeSavedPercent > 100) {
        this.addReportError('warning', 'Total size saved percentage is outside valid range (0-100)');
      }

      if (report.summary.classOptimizationPercent < 0 || report.summary.classOptimizationPercent > 100) {
        this.addReportError('warning', 'Class optimization percentage is outside valid range (0-100)');
      }

      // Validate file results consistency
      for (const file of report.files) {
        if (file.sizeSavedPercent < 0 || file.sizeSavedPercent > 100) {
          this.addReportError('warning', `File ${file.originalPath} has invalid size saved percentage`);
        }
      }
    } catch (error) {
      throw new Error(`Report validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generateFallbackReport(): OptimizationReport {
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: this.context.version,
        context: {
          projectRoot: this.context.projectRoot
        },
        generationTimeMs: 0
      },
      summary: {
        totalFiles: 0,
        filesOptimized: 0,
        filesFailed: 0,
        totalOriginalSizeBytes: 0,
        totalOptimizedSizeBytes: 0,
        totalSizeSavedBytes: 0,
        totalSizeSavedPercent: 0,
        totalClasses: 0,
        totalClassesOptimized: 0,
        classOptimizationPercent: 0,
        totalProcessingTimeMs: 0,
        averageProcessingTimeMs: 0
      },
      files: [],
      performance: {
        memory: {
          peakUsageBytes: 0,
          startUsageBytes: 0,
          endUsageBytes: 0
        }
      },
      configuration: {
        options: {}
      },
      quality: {},
      reportErrors: this.reportErrors.length > 0 ? this.reportErrors : [
        { type: 'error', message: 'Report generation failed, using fallback report' }
      ]
    };
  }
}

/**
 * Utility function to create a report generator with minimal setup
 */
export function createReportGenerator(projectRoot: string, version: string = '1.0.0'): ReportGenerator {
  return new ReportGenerator({
    projectRoot,
    version,
    startTime: Date.now()
  });
}

/**
 * Utility function to generate a simple report from basic data
 */
export async function generateSimpleReport(
  projectRoot: string,
  results: ProcessingResult[],
  outputPath: string,
  version: string = '1.0.0'
): Promise<OptimizationReport> {
  const generator = createReportGenerator(projectRoot, version);
  
  for (const result of results) {
    generator.addFileResult(result);
  }
  
  const report = await generator.generateReport();
  await generator.saveReport(report, outputPath);
  
  return report;
}