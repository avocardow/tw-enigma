import { promises as fs } from 'fs';
import { dirname } from 'path';
import { createLogger } from '../../utils/logger';
import { BenchmarkResult } from '../types';

const logger = createLogger('CSVReporter');

/**
 * CSV report configuration
 */
export interface CSVReportConfig {
  outputPath: string;
  delimiter: ',' | ';' | '\t' | '|';
  includeHeaders: boolean;
  includeMetadata: boolean;
  includeSummary: boolean;
  format: 'standard' | 'detailed' | 'minimal' | 'statistical';
  encoding: 'utf8' | 'utf16le' | 'ascii';
  dateFormat: 'iso' | 'locale' | 'timestamp';
  precision: number; // decimal places for numbers
  filtering: {
    includeSuccessful: boolean;
    includeFailed: boolean;
    columns: string[];
  };
  export: {
    generateZip: boolean;
    splitLargeFiles: boolean;
    maxRowsPerFile: number;
  };
}

/**
 * CSV column definition
 */
export interface CSVColumn {
  name: string;
  header: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  format?: (value: any, result: BenchmarkResult) => string;
  required: boolean;
}

/**
 * CSV export result
 */
export interface CSVExportResult {
  files: string[];
  totalRows: number;
  totalSize: number;
  metadata: {
    generatedAt: string;
    format: string;
    delimiter: string;
    encoding: string;
  };
}

/**
 * Comprehensive CSV reporter for benchmark results
 */
export class CSVReporter {
  private config: CSVReportConfig;
  private columns: Map<string, CSVColumn> = new Map();

  constructor(config: Partial<CSVReportConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.initializeColumns();
  }

  /**
   * Generate CSV report from benchmark results
   */
  async generateReport(results: BenchmarkResult[]): Promise<CSVExportResult> {
    try {
      logger.info('Generating CSV report', {
        resultCount: results.length,
        format: this.config.format,
        outputPath: this.config.outputPath,
      });

      // Filter results if needed
      const filteredResults = this.filterResults(results);

      // Generate CSV content based on format
      const csvContent = this.generateCSVContent(filteredResults);

      // Handle file splitting if needed
      const files = await this.writeCSVFiles(csvContent);

      // Generate summary file if requested
      if (this.config.includeSummary) {
        const summaryFile = await this.generateSummaryFile(filteredResults);
        files.push(summaryFile);
      }

      const result: CSVExportResult = {
        files,
        totalRows: filteredResults.length,
        totalSize: csvContent.reduce((sum, content) => sum + content.length, 0),
        metadata: {
          generatedAt: new Date().toISOString(),
          format: this.config.format,
          delimiter: this.config.delimiter,
          encoding: this.config.encoding,
        },
      };

      logger.info('CSV report generated successfully', {
        files: files.length,
        totalRows: result.totalRows,
        totalSize: result.totalSize,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate CSV report', { error });
      throw error;
    }
  }

  /**
   * Initialize column definitions based on format
   */
  private initializeColumns(): void {
    const standardColumns: CSVColumn[] = [
      {
        name: 'name',
        header: 'Benchmark Name',
        type: 'string',
        required: true,
      },
      {
        name: 'success',
        header: 'Success',
        type: 'boolean',
        format: (value) => (value ? 'true' : 'false'),
        required: true,
      },
      {
        name: 'duration',
        header: 'Duration (ms)',
        type: 'number',
        format: (value) => value.toFixed(this.config.precision),
        required: true,
      },
      {
        name: 'memoryHeapUsed',
        header: 'Memory Heap Used (MB)',
        type: 'number',
        format: (value, result) =>
          (result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(this.config.precision),
        required: false,
      },
      {
        name: 'memoryHeapTotal',
        header: 'Memory Heap Total (MB)',
        type: 'number',
        format: (value, result) =>
          (result.metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(this.config.precision),
        required: false,
      },
      {
        name: 'cpuUser',
        header: 'CPU User (ms)',
        type: 'number',
        format: (value, result) =>
          (result.metrics.cpuUsage.user / 1000).toFixed(this.config.precision),
        required: false,
      },
      {
        name: 'cpuSystem',
        header: 'CPU System (ms)',
        type: 'number',
        format: (value, result) =>
          (result.metrics.cpuUsage.system / 1000).toFixed(this.config.precision),
        required: false,
      },
    ];

    const detailedColumns: CSVColumn[] = [
      ...standardColumns,
      {
        name: 'memoryExternal',
        header: 'Memory External (MB)',
        type: 'number',
        format: (value, result) =>
          (result.metrics.memoryUsage.external / 1024 / 1024).toFixed(this.config.precision),
        required: false,
      },
      {
        name: 'memoryRSS',
        header: 'Memory RSS (MB)',
        type: 'number',
        format: (value, result) =>
          (result.metrics.memoryUsage.rss / 1024 / 1024).toFixed(this.config.precision),
        required: false,
      },
      {
        name: 'errorType',
        header: 'Error Type',
        type: 'string',
        format: (value, result) => result.error?.constructor.name || '',
        required: false,
      },
      {
        name: 'errorMessage',
        header: 'Error Message',
        type: 'string',
        format: (value, result) => this.escapeCSVValue(result.error?.message || ''),
        required: false,
      },
      {
        name: 'timestamp',
        header: 'Timestamp',
        type: 'date',
        format: () => this.formatDate(new Date()),
        required: false,
      },
    ];

    const minimalColumns: CSVColumn[] = [
      standardColumns[0], // name
      standardColumns[1], // success
      standardColumns[2], // duration
    ];

    const statisticalColumns: CSVColumn[] = [
      ...standardColumns,
      {
        name: 'cpuTotal',
        header: 'CPU Total (ms)',
        type: 'number',
        format: (value, result) =>
          ((result.metrics.cpuUsage.user + result.metrics.cpuUsage.system) / 1000).toFixed(
            this.config.precision
          ),
        required: false,
      },
      {
        name: 'memoryEfficiency',
        header: 'Memory Efficiency (%)',
        type: 'number',
        format: (value, result) => {
          const used = result.metrics.memoryUsage.heapUsed;
          const total = result.metrics.memoryUsage.heapTotal;
          return ((used / total) * 100).toFixed(this.config.precision);
        },
        required: false,
      },
      {
        name: 'performanceScore',
        header: 'Performance Score',
        type: 'number',
        format: (value, result) => {
          // Simple scoring algorithm based on duration and memory
          const durationScore = Math.max(0, 100 - result.duration);
          const memoryScore = Math.max(0, 100 - result.metrics.memoryUsage.heapUsed / 1024 / 1024);
          return ((durationScore + memoryScore) / 2).toFixed(this.config.precision);
        },
        required: false,
      },
    ];

    // Select columns based on format
    let selectedColumns: CSVColumn[];
    switch (this.config.format) {
      case 'detailed':
        selectedColumns = detailedColumns;
        break;
      case 'minimal':
        selectedColumns = minimalColumns;
        break;
      case 'statistical':
        selectedColumns = statisticalColumns;
        break;
      default:
        selectedColumns = standardColumns;
    }

    // Filter columns based on configuration
    if (this.config.filtering.columns.length > 0) {
      selectedColumns = selectedColumns.filter(
        (col) => this.config.filtering.columns.includes(col.name) || col.required
      );
    }

    // Store columns
    selectedColumns.forEach((col) => this.columns.set(col.name, col));
  }

  /**
   * Filter results based on configuration
   */
  private filterResults(results: BenchmarkResult[]): BenchmarkResult[] {
    let filtered = results;

    if (!this.config.filtering.includeSuccessful) {
      filtered = filtered.filter((r) => !r.success);
    }

    if (!this.config.filtering.includeFailed) {
      filtered = filtered.filter((r) => r.success);
    }

    return filtered;
  }

  /**
   * Generate CSV content
   */
  private generateCSVContent(results: BenchmarkResult[]): string[] {
    const chunks: string[] = [];
    const maxRows = this.config.export.splitLargeFiles
      ? this.config.export.maxRowsPerFile
      : results.length;

    for (let i = 0; i < results.length; i += maxRows) {
      const chunk = results.slice(i, i + maxRows);
      const csvContent = this.generateCSVChunk(chunk, i === 0);
      chunks.push(csvContent);
    }

    return chunks;
  }

  /**
   * Generate a single CSV chunk
   */
  private generateCSVChunk(results: BenchmarkResult[], includeHeaders: boolean): string {
    const lines: string[] = [];
    const columns = Array.from(this.columns.values());

    // Add headers
    if (includeHeaders && this.config.includeHeaders) {
      const headers = columns.map((col) => this.escapeCSVValue(col.header));
      lines.push(headers.join(this.config.delimiter));
    }

    // Add data rows
    results.forEach((result) => {
      const row = columns.map((col) => {
        try {
          if (col.format) {
            return col.format(null, result);
          }

          // Default formatting based on column name
          switch (col.name) {
            case 'name':
              return this.escapeCSVValue(result.name);
            case 'success':
              return result.success ? 'true' : 'false';
            case 'duration':
              return result.duration.toFixed(this.config.precision);
            default:
              return '';
          }
        } catch (error) {
          logger.warn('Failed to format column value', {
            column: col.name,
            benchmark: result.name,
            error,
          });
          return '';
        }
      });

      lines.push(row.join(this.config.delimiter));
    });

    return lines.join('\n');
  }

  /**
   * Write CSV files to disk
   */
  private async writeCSVFiles(csvContents: string[]): Promise<string[]> {
    const files: string[] = [];

    for (let i = 0; i < csvContents.length; i++) {
      const content = csvContents[i];
      const filename =
        csvContents.length === 1
          ? this.config.outputPath
          : this.config.outputPath.replace(/\.csv$/, `_part${i + 1}.csv`);

      // Ensure directory exists
      await fs.mkdir(dirname(filename), { recursive: true });

      // Write file
      await fs.writeFile(filename, content, this.config.encoding);
      files.push(filename);

      logger.debug('CSV file written', {
        filename,
        size: content.length,
        part: i + 1,
        totalParts: csvContents.length,
      });
    }

    return files;
  }

  /**
   * Generate summary statistics file
   */
  private async generateSummaryFile(results: BenchmarkResult[]): Promise<string> {
    const summaryPath = this.config.outputPath.replace(/\.csv$/, '_summary.csv');

    const durations = results.map((r) => r.duration);
    const memoryUsages = results.map((r) => r.metrics.memoryUsage.heapUsed);
    const successful = results.filter((r) => r.success).length;

    const summaryData = [
      ['Metric', 'Value', 'Unit'],
      ['Total Benchmarks', results.length.toString(), 'count'],
      ['Successful', successful.toString(), 'count'],
      ['Failed', (results.length - successful).toString(), 'count'],
      ['Success Rate', ((successful / results.length) * 100).toFixed(2), '%'],
      [
        'Average Duration',
        (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(this.config.precision),
        'ms',
      ],
      ['Min Duration', Math.min(...durations).toFixed(this.config.precision), 'ms'],
      ['Max Duration', Math.max(...durations).toFixed(this.config.precision), 'ms'],
      [
        'Average Memory',
        (memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length / 1024 / 1024).toFixed(
          this.config.precision
        ),
        'MB',
      ],
      [
        'Peak Memory',
        (Math.max(...memoryUsages) / 1024 / 1024).toFixed(this.config.precision),
        'MB',
      ],
      ['Generated At', this.formatDate(new Date()), 'timestamp'],
    ];

    const summaryContent = summaryData
      .map((row) => row.map((cell) => this.escapeCSVValue(cell)).join(this.config.delimiter))
      .join('\n');

    await fs.writeFile(summaryPath, summaryContent, this.config.encoding);

    logger.info('Summary file generated', { path: summaryPath });
    return summaryPath;
  }

  /**
   * Utility functions
   */
  private escapeCSVValue(value: string): string {
    if (value.includes(this.config.delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private formatDate(date: Date): string {
    switch (this.config.dateFormat) {
      case 'locale':
        return date.toLocaleString();
      case 'timestamp':
        return date.getTime().toString();
      default:
        return date.toISOString();
    }
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<CSVReportConfig>): CSVReportConfig {
    const defaultFiltering = {
      includeSuccessful: true,
      includeFailed: true,
      columns: [],
    };

    const defaultExport = {
      generateZip: false,
      splitLargeFiles: false,
      maxRowsPerFile: 10000,
    };

    const { filtering: configFiltering, export: configExport, ...restConfig } = config;

    return {
      outputPath: './benchmark-report.csv',
      delimiter: ',',
      includeHeaders: true,
      includeMetadata: false,
      includeSummary: true,
      format: 'standard',
      encoding: 'utf8',
      dateFormat: 'iso',
      precision: 2,
      ...restConfig,
      filtering: {
        ...defaultFiltering,
        ...configFiltering,
      },
      export: {
        ...defaultExport,
        ...configExport,
      },
    };
  }
}

/**
 * Factory function for creating CSV reporter
 */
export function createCSVReporter(config?: Partial<CSVReportConfig>): CSVReporter {
  return new CSVReporter(config);
}

/**
 * Convenience function for generating CSV report
 */
export async function generateCSVReport(
  results: BenchmarkResult[],
  config?: Partial<CSVReportConfig>
): Promise<CSVExportResult> {
  const reporter = createCSVReporter(config);
  return reporter.generateReport(results);
}
