import { promises as fs } from 'fs';
import { cpus, hostname, release, totalmem } from 'os';
import { dirname } from 'path';
import { gzipSync } from 'zlib';
import { createLogger } from '../../utils/logger';
import { BenchmarkResult } from '../types';

const logger = createLogger('JSONReporter');

/**
 * JSON report configuration
 */
export interface JSONReportConfig {
  outputPath: string;
  pretty: boolean;
  includeMetadata: boolean;
  includeRawMetrics: boolean;
  includeTimestamps: boolean;
  compression: 'none' | 'gzip';
  schema: 'v1' | 'v2' | 'compact';
  filtering: {
    includeSuccessful: boolean;
    includeFailed: boolean;
    minDuration?: number;
    maxDuration?: number;
    categories?: string[];
  };
}

/**
 * JSON report structure
 */
export interface JSONReport {
  version: string;
  schema: string;
  metadata: JSONReportMetadata;
  summary: JSONReportSummary;
  results: JSONBenchmarkResult[];
  environment: JSONEnvironmentInfo;
  configuration: Record<string, any>;
}

/**
 * JSON report metadata
 */
export interface JSONReportMetadata {
  generatedAt: string;
  generatedBy: string;
  reportVersion: string;
  totalResults: number;
  successfulResults: number;
  failedResults: number;
  totalDuration: number;
  filters: Record<string, any>;
}

/**
 * JSON report summary
 */
export interface JSONReportSummary {
  performance: {
    fastest: JSONPerformanceMetric;
    slowest: JSONPerformanceMetric;
    average: number;
    median: number;
    standardDeviation: number;
    percentiles: Record<string, number>;
  };
  memory: {
    minimum: number;
    maximum: number;
    average: number;
    peakUsage: number;
  };
  reliability: {
    successRate: number;
    errorRate: number;
    commonErrors: JSONErrorSummary[];
  };
  trends: {
    performanceDirection: 'improving' | 'degrading' | 'stable';
    memoryDirection: 'improving' | 'degrading' | 'stable';
    reliability: 'improving' | 'degrading' | 'stable';
  };
}

/**
 * JSON performance metric
 */
export interface JSONPerformanceMetric {
  name: string;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * JSON error summary
 */
export interface JSONErrorSummary {
  type: string;
  message: string;
  count: number;
  percentage: number;
  affectedBenchmarks: string[];
}

/**
 * JSON benchmark result
 */
export interface JSONBenchmarkResult {
  id: string;
  name: string;
  success: boolean;
  duration: number;
  timestamp: string;
  metrics: {
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    cpu: {
      user: number;
      system: number;
      total: number;
    };
    custom: Record<string, number>;
  };
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  metadata: Record<string, any>;
}

/**
 * JSON environment information
 */
export interface JSONEnvironmentInfo {
  platform: string;
  architecture: string;
  nodeVersion: string;
  v8Version: string;
  cpuCores: number;
  totalMemory: number;
  osRelease: string;
  hostname: string;
  timestamp: string;
}

/**
 * Comprehensive JSON reporter for benchmark results
 */
export class JSONReporter {
  private config: JSONReportConfig;

  constructor(config: Partial<JSONReportConfig> = {}) {
    this.config = this.mergeConfig(config);
  }

  /**
   * Generate JSON report from benchmark results
   */
  async generateReport(results: BenchmarkResult[]): Promise<string> {
    try {
      logger.info('Generating JSON report', {
        resultCount: results.length,
        outputPath: this.config.outputPath,
      });

      // Filter results if needed
      const filteredResults = this.filterResults(results);

      // Generate report structure
      const report: JSONReport = {
        version: '1.0.0',
        schema: this.config.schema,
        metadata: this.generateMetadata(filteredResults),
        summary: this.generateSummary(filteredResults),
        results: this.convertResults(filteredResults),
        environment: this.generateEnvironmentInfo(),
        configuration: this.config.includeMetadata ? { reportConfig: this.config } : {},
      };

      // Convert to JSON
      const jsonOutput = this.config.pretty
        ? JSON.stringify(report, null, 2)
        : JSON.stringify(report);

      // Write to file
      await this.writeReport(jsonOutput);

      logger.info('JSON report generated successfully', {
        outputPath: this.config.outputPath,
        size: jsonOutput.length,
        resultCount: filteredResults.length,
      });

      return this.config.outputPath;
    } catch (error) {
      logger.error('Failed to generate JSON report', { error });
      throw error;
    }
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

    if (this.config.filtering.minDuration !== undefined) {
      filtered = filtered.filter((r) => r.duration >= this.config.filtering.minDuration!);
    }

    if (this.config.filtering.maxDuration !== undefined) {
      filtered = filtered.filter((r) => r.duration <= this.config.filtering.maxDuration!);
    }

    return filtered;
  }

  /**
   * Generate report metadata
   */
  private generateMetadata(results: BenchmarkResult[]): JSONReportMetadata {
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    return {
      generatedAt: new Date().toISOString(),
      generatedBy: 'TW-Enigma Benchmarking System',
      reportVersion: '1.0.0',
      totalResults: results.length,
      successfulResults: successful,
      failedResults: failed,
      totalDuration,
      filters: this.config.filtering,
    };
  }

  /**
   * Generate report summary
   */
  private generateSummary(results: BenchmarkResult[]): JSONReportSummary {
    const durations = results.map((r) => r.duration).sort((a, b) => a - b);
    const memoryUsages = results.map((r) => r.metrics.memoryUsage.heapUsed);
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Performance metrics
    const fastest = this.findFastest(results);
    const slowest = this.findSlowest(results);
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const median = this.calculateMedian(durations);
    const standardDeviation = this.calculateStandardDeviation(durations, average);

    // Memory metrics
    const minMemory = Math.min(...memoryUsages);
    const maxMemory = Math.max(...memoryUsages);
    const avgMemory = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length;

    // Error analysis
    const errorCounts = this.analyzeErrors(failed);

    return {
      performance: {
        fastest,
        slowest,
        average,
        median,
        standardDeviation,
        percentiles: this.calculatePercentiles(durations),
      },
      memory: {
        minimum: minMemory,
        maximum: maxMemory,
        average: avgMemory,
        peakUsage: maxMemory,
      },
      reliability: {
        successRate: successful.length / results.length,
        errorRate: failed.length / results.length,
        commonErrors: errorCounts,
      },
      trends: {
        performanceDirection: 'stable', // Could be enhanced with historical data
        memoryDirection: 'stable',
        reliability: 'stable',
      },
    };
  }

  /**
   * Convert benchmark results to JSON format
   */
  private convertResults(results: BenchmarkResult[]): JSONBenchmarkResult[] {
    return results.map((result) => ({
      id: `bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: result.name,
      success: result.success,
      duration: result.duration,
      timestamp: this.config.includeTimestamps ? new Date().toISOString() : '',
      metrics: {
        memory: {
          heapUsed: result.metrics.memoryUsage.heapUsed,
          heapTotal: result.metrics.memoryUsage.heapTotal,
          external: result.metrics.memoryUsage.external,
          rss: result.metrics.memoryUsage.rss,
        },
        cpu: {
          user: result.metrics.cpuUsage.user,
          system: result.metrics.cpuUsage.system,
          total: result.metrics.cpuUsage.user + result.metrics.cpuUsage.system,
        },
        custom: this.config.includeRawMetrics ? result.metrics.customMetrics : {},
      },
      error: result.error
        ? {
            type: result.error.constructor.name,
            message: result.error.message,
            stack: result.error.stack,
          }
        : undefined,
      metadata: result.metadata,
    }));
  }

  /**
   * Generate environment information
   */
  private generateEnvironmentInfo(): JSONEnvironmentInfo {
    return {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      v8Version: process.versions.v8,
      cpuCores: cpus().length,
      totalMemory: totalmem(),
      osRelease: release(),
      hostname: hostname(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Statistical calculations
   */
  private findFastest(results: BenchmarkResult[]): JSONPerformanceMetric {
    const fastest = results.reduce((min, current) =>
      current.duration < min.duration ? current : min
    );

    return {
      name: fastest.name,
      duration: fastest.duration,
      memoryUsage: fastest.metrics.memoryUsage.heapUsed,
      cpuUsage: fastest.metrics.cpuUsage.user + fastest.metrics.cpuUsage.system,
    };
  }

  private findSlowest(results: BenchmarkResult[]): JSONPerformanceMetric {
    const slowest = results.reduce((max, current) =>
      current.duration > max.duration ? current : max
    );

    return {
      name: slowest.name,
      duration: slowest.duration,
      memoryUsage: slowest.metrics.memoryUsage.heapUsed,
      cpuUsage: slowest.metrics.cpuUsage.user + slowest.metrics.cpuUsage.system,
    };
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculatePercentiles(values: number[]): Record<string, number> {
    const sorted = [...values].sort((a, b) => a - b);

    return {
      p10: this.percentile(sorted, 0.1),
      p25: this.percentile(sorted, 0.25),
      p50: this.percentile(sorted, 0.5),
      p75: this.percentile(sorted, 0.75),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  private percentile(sorted: number[], percentile: number): number {
    const index = percentile * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private analyzeErrors(failedResults: BenchmarkResult[]): JSONErrorSummary[] {
    const errorMap = new Map<string, JSONErrorSummary>();

    failedResults.forEach((result) => {
      if (!result.error) return;

      const errorType = result.error.constructor.name;
      const errorMessage = result.error.message;
      const key = `${errorType}:${errorMessage}`;

      if (errorMap.has(key)) {
        const summary = errorMap.get(key)!;
        summary.count++;
        summary.affectedBenchmarks.push(result.name);
      } else {
        errorMap.set(key, {
          type: errorType,
          message: errorMessage,
          count: 1,
          percentage: 0, // Will be calculated after
          affectedBenchmarks: [result.name],
        });
      }
    });

    // Calculate percentages
    const errors = Array.from(errorMap.values());
    errors.forEach((error) => {
      error.percentage = (error.count / failedResults.length) * 100;
    });

    return errors.sort((a, b) => b.count - a.count);
  }

  /**
   * Write report to file
   */
  private async writeReport(jsonOutput: string): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.config.outputPath), { recursive: true });

      // Handle compression if needed
      let finalOutput = jsonOutput;
      if (this.config.compression === 'gzip') {
        finalOutput = gzipSync(jsonOutput).toString('base64');
      }

      // Write file
      await fs.writeFile(this.config.outputPath, finalOutput, 'utf-8');

      logger.info('JSON report written successfully', {
        path: this.config.outputPath,
        size: finalOutput.length,
        compressed: this.config.compression !== 'none',
      });
    } catch (error) {
      logger.error('Failed to write JSON report', { error, path: this.config.outputPath });
      throw error;
    }
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<JSONReportConfig>): JSONReportConfig {
    const defaultFiltering = {
      includeSuccessful: true,
      includeFailed: true,
    };

    const { filtering: configFiltering, ...restConfig } = config;

    return {
      outputPath: './benchmark-report.json',
      pretty: true,
      includeMetadata: true,
      includeRawMetrics: true,
      includeTimestamps: true,
      compression: 'none',
      schema: 'v2',
      ...restConfig,
      filtering: {
        ...defaultFiltering,
        ...configFiltering,
      },
    };
  }
}

/**
 * Factory function for creating JSON reporter
 */
export function createJSONReporter(config?: Partial<JSONReportConfig>): JSONReporter {
  return new JSONReporter(config);
}

/**
 * Convenience function for generating JSON report
 */
export async function generateJSONReport(
  results: BenchmarkResult[],
  config?: Partial<JSONReportConfig>
): Promise<string> {
  const reporter = createJSONReporter(config);
  return reporter.generateReport(results);
}
