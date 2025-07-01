import { join } from 'path';
import { createLogger } from '../../utils/logger';
import { BenchmarkResult } from '../types';

// HTML Reporter
export {
  createHTMLReporter,
  generateHTMLReport,
  HTMLReporter,
  type BenchmarkSummary,
  type HTMLReportConfig,
  type ReportMetadata,
} from './HTMLReporter';

// JSON Reporter
export {
  createJSONReporter,
  generateJSONReport,
  JSONReporter,
  type JSONBenchmarkResult,
  type JSONEnvironmentInfo,
  type JSONErrorSummary,
  type JSONPerformanceMetric,
  type JSONReport,
  type JSONReportConfig,
  type JSONReportMetadata,
  type JSONReportSummary,
} from './JSONReporter';

// CSV Reporter
export {
  createCSVReporter,
  CSVReporter,
  generateCSVReport,
  type CSVColumn,
  type CSVExportResult,
  type CSVReportConfig,
} from './CSVReporter';

/**
 * Supported report formats
 */
export type ReportFormat = 'html' | 'json' | 'csv';

/**
 * Universal report configuration
 */
export interface UniversalReportConfig {
  formats: ReportFormat[];
  outputDirectory: string;
  baseFilename: string;
  htmlConfig?: Partial<import('./HTMLReporter').HTMLReportConfig>;
  jsonConfig?: Partial<import('./JSONReporter').JSONReportConfig>;
  csvConfig?: Partial<import('./CSVReporter').CSVReportConfig>;
}

/**
 * Multi-format report result
 */
export interface MultiFormatReportResult {
  html?: string;
  json?: string;
  csv?: import('./CSVReporter').CSVExportResult;
  metadata: {
    generatedAt: string;
    totalFormats: number;
    successful: string[];
    failed: string[];
  };
}

/**
 * Generate reports in multiple formats
 */
export async function generateMultiFormatReport(
  results: BenchmarkResult[],
  config: UniversalReportConfig
): Promise<MultiFormatReportResult> {
  const logger = createLogger('MultiFormatReporter');
  const reportResult: MultiFormatReportResult = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalFormats: config.formats.length,
      successful: [],
      failed: [],
    },
  };

  // Generate HTML report
  if (config.formats.includes('html')) {
    try {
      const htmlPath = join(config.outputDirectory, `${config.baseFilename}.html`);
      const { createHTMLReporter } = await import('./HTMLReporter');
      const htmlReporter = createHTMLReporter({
        outputPath: htmlPath,
        ...config.htmlConfig,
      });
      reportResult.html = await htmlReporter.generateReport(results);
      reportResult.metadata.successful.push('html');
      logger.info('HTML report generated successfully', { path: htmlPath });
    } catch (error) {
      logger.error('Failed to generate HTML report', { error });
      reportResult.metadata.failed.push('html');
    }
  }

  // Generate JSON report
  if (config.formats.includes('json')) {
    try {
      const jsonPath = join(config.outputDirectory, `${config.baseFilename}.json`);
      const { createJSONReporter } = await import('./JSONReporter');
      const jsonReporter = createJSONReporter({
        outputPath: jsonPath,
        ...config.jsonConfig,
      });
      reportResult.json = await jsonReporter.generateReport(results);
      reportResult.metadata.successful.push('json');
      logger.info('JSON report generated successfully', { path: jsonPath });
    } catch (error) {
      logger.error('Failed to generate JSON report', { error });
      reportResult.metadata.failed.push('json');
    }
  }

  // Generate CSV report
  if (config.formats.includes('csv')) {
    try {
      const csvPath = join(config.outputDirectory, `${config.baseFilename}.csv`);
      const { createCSVReporter } = await import('./CSVReporter');
      const csvReporter = createCSVReporter({
        outputPath: csvPath,
        ...config.csvConfig,
      });
      reportResult.csv = await csvReporter.generateReport(results);
      reportResult.metadata.successful.push('csv');
      logger.info('CSV report generated successfully', { files: reportResult.csv.files });
    } catch (error) {
      logger.error('Failed to generate CSV report', { error });
      reportResult.metadata.failed.push('csv');
    }
  }

  logger.info('Multi-format report generation completed', {
    successful: reportResult.metadata.successful,
    failed: reportResult.metadata.failed,
    total: config.formats.length,
  });

  return reportResult;
}

/**
 * Convenience function for generating all supported formats
 */
export async function generateAllFormats(
  results: BenchmarkResult[],
  outputDirectory: string = './reports',
  baseFilename: string = 'benchmark-report'
): Promise<MultiFormatReportResult> {
  return generateMultiFormatReport(results, {
    formats: ['html', 'json', 'csv'],
    outputDirectory,
    baseFilename,
  });
}
