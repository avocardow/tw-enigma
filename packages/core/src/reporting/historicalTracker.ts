/**
 * Historical Tracking and Comparison for TW-Enigma Reports
 * Manages storage, retrieval, and comparison of optimization reports over time
 */

import { promises as fs } from 'fs';
import path from 'path';
import { OptimizationReport, OptimizationSummary } from './schema.js';

interface HistoricalEntry {
  /** Unique identifier for the report */
  id: string;
  /** ISO 8601 timestamp of the report */
  timestamp: string;
  /** File path where the report is stored */
  filePath: string;
  /** Summary metrics for quick comparison */
  summary: OptimizationSummary;
  /** Metadata about the optimization context */
  metadata: {
    version: string;
    projectName?: string;
    revision?: string;
    configPath?: string;
  };
  /** File hash for integrity checking */
  hash?: string;
}

interface TrendData {
  /** Metric name */
  metric: string;
  /** Historical values over time */
  values: Array<{
    timestamp: string;
    value: number;
  }>;
  /** Trend direction */
  trend: 'improving' | 'declining' | 'stable';
  /** Percentage change from first to last measurement */
  percentChange: number;
}

interface ComparisonResult {
  /** Current report being compared */
  current: OptimizationReport;
  /** Previous report for comparison */
  previous: OptimizationReport;
  /** Calculated differences */
  differences: {
    /** Size savings comparison */
    sizeSaved: {
      absolute: number;
      percent: number;
    };
    /** Processing time comparison */
    processingTime: {
      absolute: number;
      percent: number;
    };
    /** Optimization rate comparison */
    optimizationRate: {
      absolute: number;
      percent: number;
    };
    /** Memory usage comparison */
    memoryUsage: {
      absolute: number;
      percent: number;
    };
    /** File count comparison */
    fileCount: {
      absolute: number;
      percent: number;
    };
  };
  /** Trend assessment */
  assessment: 'improved' | 'degraded' | 'stable';
}

export class HistoricalTracker {
  private historyDir: string;
  private reportsDir: string;
  private indexFile: string;
  private maxHistoryEntries: number;

  constructor(
    projectRoot: string,
    options: {
      historyDir?: string;
      maxHistoryEntries?: number;
    } = {}
  ) {
    this.historyDir = options.historyDir || path.join(projectRoot, '.tw-enigma', 'history');
    this.reportsDir = path.join(this.historyDir, 'reports');
    this.indexFile = path.join(this.historyDir, 'index.json');
    this.maxHistoryEntries = options.maxHistoryEntries || 100;
  }

  /**
   * Initialize the historical tracking system
   */
  async initialize(): Promise<void> {
    try {
      // Create directories
      await fs.mkdir(this.historyDir, { recursive: true });
      await fs.mkdir(this.reportsDir, { recursive: true });

      // Create index file if it doesn't exist
      try {
        await fs.access(this.indexFile);
      } catch {
        await this.saveIndex([]);
      }
    } catch (error) {
      throw new Error(`Failed to initialize historical tracker: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Store a new optimization report
   */
  async storeReport(report: OptimizationReport): Promise<string> {
    try {
      await this.initialize();

      // Generate unique ID
      const id = this.generateReportId(report);
      const filename = `${id}.json`;
      const filePath = path.join(this.reportsDir, filename);

      // Save the report
      await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');

      // Update index
      const index = await this.loadIndex();
      const entry: HistoricalEntry = {
        id,
        timestamp: report.metadata.timestamp,
        filePath: path.relative(this.historyDir, filePath),
        summary: report.summary,
        metadata: {
          version: report.metadata.version,
          projectName: report.metadata.context.projectName,
          revision: report.metadata.context.revision,
          configPath: report.metadata.context.configPath
        },
        hash: await this.calculateHash(report)
      };

      // Add new entry and maintain size limit
      index.push(entry);
      index.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (index.length > this.maxHistoryEntries) {
        // Remove oldest entries and their files
        const removedEntries = index.splice(this.maxHistoryEntries);
        for (const removedEntry of removedEntries) {
          try {
            await fs.unlink(path.join(this.historyDir, removedEntry.filePath));
          } catch {
            // Ignore errors when cleaning up old files
          }
        }
      }

      await this.saveIndex(index);
      return id;
    } catch (error) {
      throw new Error(`Failed to store report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve a specific report by ID
   */
  async getReport(id: string): Promise<OptimizationReport | null> {
    try {
      const index = await this.loadIndex();
      const entry = index.find(e => e.id === id);
      
      if (!entry) {
        return null;
      }

      const reportPath = path.join(this.historyDir, entry.filePath);
      const reportContent = await fs.readFile(reportPath, 'utf8');
      return JSON.parse(reportContent) as OptimizationReport;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the most recent report
   */
  async getLatestReport(): Promise<OptimizationReport | null> {
    try {
      const index = await this.loadIndex();
      if (index.length === 0) {
        return null;
      }

      return await this.getReport(index[0].id);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the previous report (second most recent)
   */
  async getPreviousReport(): Promise<OptimizationReport | null> {
    try {
      const index = await this.loadIndex();
      if (index.length < 2) {
        return null;
      }

      return await this.getReport(index[1].id);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get historical entries with optional filtering
   */
  async getHistory(options: {
    limit?: number;
    since?: Date;
    until?: Date;
    projectName?: string;
    version?: string;
  } = {}): Promise<HistoricalEntry[]> {
    try {
      let index = await this.loadIndex();

      // Apply filters
      if (options.since) {
        index = index.filter(e => new Date(e.timestamp) >= options.since!);
      }

      if (options.until) {
        index = index.filter(e => new Date(e.timestamp) <= options.until!);
      }

      if (options.projectName) {
        index = index.filter(e => e.metadata.projectName === options.projectName);
      }

      if (options.version) {
        index = index.filter(e => e.metadata.version === options.version);
      }

      // Apply limit
      if (options.limit) {
        index = index.slice(0, options.limit);
      }

      return index;
    } catch (error) {
      return [];
    }
  }

  /**
   * Compare two reports and return detailed differences
   */
  async compareReports(currentId: string, previousId: string): Promise<ComparisonResult | null> {
    try {
      const current = await this.getReport(currentId);
      const previous = await this.getReport(previousId);

      if (!current || !previous) {
        return null;
      }

      return this.calculateComparison(current, previous);
    } catch (error) {
      return null;
    }
  }

  /**
   * Compare the latest report with the previous one
   */
  async compareLatestWithPrevious(): Promise<ComparisonResult | null> {
    try {
      const index = await this.loadIndex();
      if (index.length < 2) {
        return null;
      }

      return await this.compareReports(index[0].id, index[1].id);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate trend data for specific metrics
   */
  async getTrendData(
    metric: 'sizeSaved' | 'processingTime' | 'optimizationRate' | 'memoryUsage',
    options: {
      limit?: number;
      since?: Date;
    } = {}
  ): Promise<TrendData | null> {
    try {
      const history = await this.getHistory(options);
      if (history.length < 2) {
        return null;
      }

      const values = history.map(entry => ({
        timestamp: entry.timestamp,
        value: this.extractMetricValue(entry.summary, metric)
      })).reverse(); // Reverse to get chronological order

      // Calculate trend
      const firstValue = values[0].value;
      const lastValue = values[values.length - 1].value;
      const percentChange = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
      
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      const threshold = 5; // 5% threshold for trend determination

      if (metric === 'sizeSaved' || metric === 'optimizationRate') {
        // For these metrics, higher is better
        if (percentChange > threshold) trend = 'improving';
        else if (percentChange < -threshold) trend = 'declining';
      } else {
        // For processing time and memory usage, lower is better
        if (percentChange < -threshold) trend = 'improving';
        else if (percentChange > threshold) trend = 'declining';
      }

      return {
        metric,
        values,
        trend,
        percentChange
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get performance regression alerts
   */
  async getPerformanceAlerts(): Promise<Array<{
    type: 'warning' | 'error';
    metric: string;
    message: string;
    currentValue: number;
    previousValue: number;
    changePercent: number;
  }>> {
    const alerts: Array<{
      type: 'warning' | 'error';
      metric: string;
      message: string;
      currentValue: number;
      previousValue: number;
      changePercent: number;
    }> = [];

    try {
      const comparison = await this.compareLatestWithPrevious();
      if (!comparison) {
        return alerts;
      }

      const { differences } = comparison;
      const thresholds = {
        warning: 10, // 10% change triggers warning
        error: 25    // 25% change triggers error
      };

      // Check processing time regression
      if (differences.processingTime.percent > thresholds.error) {
        alerts.push({
          type: 'error',
          metric: 'Processing Time',
          message: `Processing time increased significantly by ${differences.processingTime.percent.toFixed(1)}%`,
          currentValue: comparison.current.summary.totalProcessingTimeMs,
          previousValue: comparison.previous.summary.totalProcessingTimeMs,
          changePercent: differences.processingTime.percent
        });
      } else if (differences.processingTime.percent > thresholds.warning) {
        alerts.push({
          type: 'warning',
          metric: 'Processing Time',
          message: `Processing time increased by ${differences.processingTime.percent.toFixed(1)}%`,
          currentValue: comparison.current.summary.totalProcessingTimeMs,
          previousValue: comparison.previous.summary.totalProcessingTimeMs,
          changePercent: differences.processingTime.percent
        });
      }

      // Check memory usage regression
      if (differences.memoryUsage.percent > thresholds.error) {
        alerts.push({
          type: 'error',
          metric: 'Memory Usage',
          message: `Memory usage increased significantly by ${differences.memoryUsage.percent.toFixed(1)}%`,
          currentValue: comparison.current.performance.memory.peakUsageBytes,
          previousValue: comparison.previous.performance.memory.peakUsageBytes,
          changePercent: differences.memoryUsage.percent
        });
      } else if (differences.memoryUsage.percent > thresholds.warning) {
        alerts.push({
          type: 'warning',
          metric: 'Memory Usage',
          message: `Memory usage increased by ${differences.memoryUsage.percent.toFixed(1)}%`,
          currentValue: comparison.current.performance.memory.peakUsageBytes,
          previousValue: comparison.previous.performance.memory.peakUsageBytes,
          changePercent: differences.memoryUsage.percent
        });
      }

      // Check optimization rate regression
      if (differences.optimizationRate.percent < -thresholds.error) {
        alerts.push({
          type: 'error',
          metric: 'Optimization Rate',
          message: `Optimization rate decreased significantly by ${Math.abs(differences.optimizationRate.percent).toFixed(1)}%`,
          currentValue: comparison.current.summary.classOptimizationPercent,
          previousValue: comparison.previous.summary.classOptimizationPercent,
          changePercent: differences.optimizationRate.percent
        });
      } else if (differences.optimizationRate.percent < -thresholds.warning) {
        alerts.push({
          type: 'warning',
          metric: 'Optimization Rate',
          message: `Optimization rate decreased by ${Math.abs(differences.optimizationRate.percent).toFixed(1)}%`,
          currentValue: comparison.current.summary.classOptimizationPercent,
          previousValue: comparison.previous.summary.classOptimizationPercent,
          changePercent: differences.optimizationRate.percent
        });
      }

      return alerts;
    } catch (error) {
      return alerts;
    }
  }

  /**
   * Clean up old reports beyond the retention period
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const index = await this.loadIndex();
      const toRemove = index.filter(entry => new Date(entry.timestamp) < cutoffDate);
      const toKeep = index.filter(entry => new Date(entry.timestamp) >= cutoffDate);

      // Remove old report files
      for (const entry of toRemove) {
        try {
          await fs.unlink(path.join(this.historyDir, entry.filePath));
        } catch {
          // Ignore errors when cleaning up files
        }
      }

      // Update index
      await this.saveIndex(toKeep);

      return toRemove.length;
    } catch (error) {
      return 0;
    }
  }

  private async loadIndex(): Promise<HistoricalEntry[]> {
    try {
      const content = await fs.readFile(this.indexFile, 'utf8');
      return JSON.parse(content) as HistoricalEntry[];
    } catch {
      return [];
    }
  }

  private async saveIndex(index: HistoricalEntry[]): Promise<void> {
    await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2), 'utf8');
  }

  private generateReportId(report: OptimizationReport): string {
    const timestamp = new Date(report.metadata.timestamp);
    const dateStr = timestamp.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = timestamp.toTimeString().split(':').slice(0, 2).join('');
    const randomSuffix = Math.random().toString(36).substr(2, 4);
    return `${dateStr}-${timeStr}-${randomSuffix}`;
  }

  private async calculateHash(report: OptimizationReport): Promise<string> {
    // Simple hash based on key metrics
    const hashInput = JSON.stringify({
      timestamp: report.metadata.timestamp,
      totalSizeSaved: report.summary.totalSizeSavedBytes,
      filesOptimized: report.summary.filesOptimized,
      processingTime: report.summary.totalProcessingTimeMs
    });

    // Simple hash function (not cryptographically secure, just for integrity checking)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private calculateComparison(current: OptimizationReport, previous: OptimizationReport): ComparisonResult {
    const differences = {
      sizeSaved: this.calculateDifference(
        current.summary.totalSizeSavedBytes,
        previous.summary.totalSizeSavedBytes
      ),
      processingTime: this.calculateDifference(
        current.summary.totalProcessingTimeMs,
        previous.summary.totalProcessingTimeMs
      ),
      optimizationRate: this.calculateDifference(
        current.summary.classOptimizationPercent,
        previous.summary.classOptimizationPercent
      ),
      memoryUsage: this.calculateDifference(
        current.performance.memory.peakUsageBytes,
        previous.performance.memory.peakUsageBytes
      ),
      fileCount: this.calculateDifference(
        current.summary.totalFiles,
        previous.summary.totalFiles
      )
    };

    // Assess overall trend
    let assessment: 'improved' | 'degraded' | 'stable' = 'stable';
    const significantThreshold = 5; // 5% threshold

    // Positive changes: more size saved, better optimization rate
    // Negative changes: more processing time, more memory usage
    const positiveChanges = [
      differences.sizeSaved.percent > significantThreshold,
      differences.optimizationRate.percent > significantThreshold
    ].filter(Boolean).length;

    const negativeChanges = [
      differences.processingTime.percent > significantThreshold,
      differences.memoryUsage.percent > significantThreshold,
      differences.optimizationRate.percent < -significantThreshold,
      differences.sizeSaved.percent < -significantThreshold
    ].filter(Boolean).length;

    if (positiveChanges > negativeChanges) {
      assessment = 'improved';
    } else if (negativeChanges > positiveChanges) {
      assessment = 'degraded';
    }

    return {
      current,
      previous,
      differences,
      assessment
    };
  }

  private calculateDifference(current: number, previous: number): { absolute: number; percent: number } {
    const absolute = current - previous;
    const percent = previous > 0 ? (absolute / previous) * 100 : 0;
    return { absolute, percent };
  }

  private extractMetricValue(summary: OptimizationSummary, metric: string): number {
    switch (metric) {
      case 'sizeSaved':
        return summary.totalSizeSavedBytes;
      case 'processingTime':
        return summary.totalProcessingTimeMs;
      case 'optimizationRate':
        return summary.classOptimizationPercent;
      case 'memoryUsage':
        // This would need to be extracted from performance data in a full implementation
        return 0;
      default:
        return 0;
    }
  }
}

/**
 * Utility function to create and initialize a historical tracker
 */
export async function createHistoricalTracker(
  projectRoot: string,
  options?: { historyDir?: string; maxHistoryEntries?: number }
): Promise<HistoricalTracker> {
  const tracker = new HistoricalTracker(projectRoot, options);
  await tracker.initialize();
  return tracker;
}