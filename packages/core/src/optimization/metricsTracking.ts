/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { z } from 'zod';
import type { PassMetrics } from './multiPassDiscovery';

/**
 * Configuration schema for metrics tracking
 */
export const MetricsTrackingConfigSchema = z.object({
  // Collection settings
  enableMetricsCollection: z.boolean().default(true),
  collectMemoryMetrics: z.boolean().default(true),
  collectTimingMetrics: z.boolean().default(true),
  collectPatternMetrics: z.boolean().default(true),
  collectQualityMetrics: z.boolean().default(true),
  collectResourceMetrics: z.boolean().default(true),

  // Performance settings
  metricsBufferSize: z.number().min(1).max(10000).default(1000),
  enableAsyncCollection: z.boolean().default(true),
  collectIntervalMs: z.number().min(10).max(60000).default(100),
  enableMetricsCompression: z.boolean().default(false),

  // Export settings
  enableAutoExport: z.boolean().default(false),
  exportFormat: z.enum(['json', 'csv', 'yaml']).default('json'),
  exportPath: z.string().default('./optimization-metrics'),
  exportFilePrefix: z.string().default('metrics'),
  enableTimestampSuffix: z.boolean().default(true),

  // Aggregation settings
  enableRealTimeAggregation: z.boolean().default(true),
  aggregationWindowSize: z.number().min(1).max(1000).default(10),
  enableStatisticalAggregation: z.boolean().default(true),
  enableTrendCalculation: z.boolean().default(true),

  // Storage settings
  maxStoredMetrics: z.number().min(10).max(100000).default(10000),
  enableMetricsPersistence: z.boolean().default(false),
  persistenceFormat: z.enum(['json', 'binary', 'sqlite']).default('json'),

  // Monitoring and alerting
  enableMetricsMonitoring: z.boolean().default(false),
  performanceThresholds: z
    .object({
      maxMemoryUsageMB: z.number().default(1000),
      maxPassDurationMs: z.number().default(30000),
      minEfficiencyScore: z.number().default(0.1),
      maxErrorRate: z.number().default(0.05),
    })
    .default({}),

  // Visualization hooks
  enableVisualizationHooks: z.boolean().default(false),
  visualizationEndpoint: z.string().optional(),
  enableRealTimeUpdates: z.boolean().default(false),
});

export type MetricsTrackingConfig = z.infer<typeof MetricsTrackingConfigSchema>;

/**
 * Custom metric definition interface
 */
export interface CustomMetricDefinition {
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  unit?: string;
  tags?: Record<string, string>;
  collectFn: (context: MetricsCollectionContext) => number | null;
  aggregationFn?: (values: number[]) => number;
}

/**
 * Context provided to custom metric collection functions
 */
export interface MetricsCollectionContext {
  passNumber: number;
  timestamp: Date;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  passMetrics?: PassMetrics;
  previousMetrics?: PassMetrics[];
  customData?: Record<string, any>;
}

/**
 * Enhanced metrics interface extending PassMetrics
 */
export interface EnhancedPassMetrics extends PassMetrics {
  // System metrics
  systemMetrics: {
    cpuUsage: number;
    memoryUsageDetailed: NodeJS.MemoryUsage;
    diskUsage?: number;
    networkStats?: any;
  };

  // Performance metrics
  performanceMetrics: {
    throughputPatternsPerSecond: number;
    memoryEfficiency: number;
    processingSpeed: number;
    resourceUtilization: number;
  };

  // Quality metrics
  qualityMetrics: {
    patternQualityScore: number;
    consolidationAccuracy: number;
    errorRate: number;
    warningRate: number;
  };

  // Custom metrics
  customMetrics: Record<string, number>;

  // Metadata
  metadata: {
    collectionTimestamp: Date;
    collectionDuration: number;
    metricsVersion: string;
  };
}

/**
 * Aggregated metrics result
 */
export interface AggregatedMetrics {
  period: {
    startPass: number;
    endPass: number;
    startTime: Date;
    endTime: Date;
    totalDuration: number;
  };

  // Statistical aggregations
  statistics: {
    count: number;
    mean: Record<string, number>;
    median: Record<string, number>;
    standardDeviation: Record<string, number>;
    min: Record<string, number>;
    max: Record<string, number>;
    percentiles: Record<string, Record<string, number>>;
  };

  // Trend analysis
  trends: {
    improvementRate: number;
    convergenceRate: number;
    stabilityTrend: number;
    performanceTrend: number;
  };

  // Summaries
  summaries: {
    totalPatternsProcessed: number;
    totalReplacements: number;
    averageEfficiency: number;
    bestPass: number;
    worstPass: number;
  };
}

/**
 * Metrics export result
 */
export interface MetricsExportResult {
  success: boolean;
  filePath?: string;
  format: string;
  recordCount: number;
  exportDuration: number;
  error?: string;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  type: 'warning' | 'error' | 'critical';
  metric: string;
  threshold: number;
  currentValue: number;
  passNumber: number;
  timestamp: Date;
  message: string;
  suggestion?: string;
}

/**
 * Comprehensive metrics tracking system
 */
export class MetricsTracker {
  private config: MetricsTrackingConfig;
  private metrics: EnhancedPassMetrics[] = [];
  private customMetrics: Map<string, CustomMetricDefinition> = new Map();
  private metricsBuffer: EnhancedPassMetrics[] = [];
  private aggregationCache: Map<string, AggregatedMetrics> = new Map();
  private alerts: PerformanceAlert[] = [];
  private isCollecting: boolean = false;
  private collectionTimer?: NodeJS.Timeout;

  constructor(config: Partial<MetricsTrackingConfig> = {}) {
    this.config = MetricsTrackingConfigSchema.parse(config);
  }

  /**
   * Start metrics collection
   */
  public startCollection(): void {
    if (this.isCollecting) {
      console.warn('Metrics collection is already active');
      return;
    }

    this.isCollecting = true;
    this.logDebug('Started metrics collection');

    if (this.config.enableAsyncCollection) {
      this.startAsyncCollection();
    }
  }

  /**
   * Stop metrics collection
   */
  public stopCollection(): void {
    if (!this.isCollecting) return;

    this.isCollecting = false;

    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }

    this.logDebug('Stopped metrics collection');
  }

  /**
   * Collect metrics for a specific pass
   */
  public async collectPassMetrics(
    baseMetrics: PassMetrics,
    context: Partial<MetricsCollectionContext> = {}
  ): Promise<EnhancedPassMetrics> {
    if (!this.config.enableMetricsCollection) {
      // Return basic metrics if collection is disabled
      return this.createMinimalEnhancedMetrics(baseMetrics);
    }

    const startTime = Date.now();
    const memoryUsage = process.memoryUsage();

    const fullContext: MetricsCollectionContext = {
      passNumber: baseMetrics.passNumber,
      timestamp: baseMetrics.timestamp,
      duration: baseMetrics.duration,
      memoryUsage,
      passMetrics: baseMetrics,
      previousMetrics: this.metrics.map((m) => m as PassMetrics),
      ...context,
    };

    // Collect enhanced metrics
    const enhancedMetrics: EnhancedPassMetrics = {
      ...baseMetrics,

      // System metrics
      systemMetrics: await this.collectSystemMetrics(),

      // Performance metrics
      performanceMetrics: this.calculatePerformanceMetrics(baseMetrics, fullContext),

      // Quality metrics
      qualityMetrics: this.calculateQualityMetrics(baseMetrics),

      // Custom metrics
      customMetrics: await this.collectCustomMetrics(fullContext),

      // Metadata
      metadata: {
        collectionTimestamp: new Date(),
        collectionDuration: Date.now() - startTime,
        metricsVersion: '1.0.0',
      },
    };

    // Store metrics
    await this.storeMetrics(enhancedMetrics);

    // Check performance thresholds
    if (this.config.enableMetricsMonitoring) {
      this.checkPerformanceThresholds(enhancedMetrics);
    }

    // Trigger real-time aggregation if enabled
    if (this.config.enableRealTimeAggregation) {
      this.updateRealTimeAggregation(enhancedMetrics);
    }

    // Auto-export if enabled
    if (this.config.enableAutoExport && this.shouldAutoExport()) {
      await this.exportMetrics();
    }

    return enhancedMetrics;
  }

  /**
   * Register a custom metric
   */
  public registerCustomMetric(metric: CustomMetricDefinition): void {
    if (this.customMetrics.has(metric.name)) {
      throw new Error(`Custom metric '${metric.name}' is already registered`);
    }

    this.customMetrics.set(metric.name, metric);
    this.logDebug(`Registered custom metric: ${metric.name}`);
  }

  /**
   * Unregister a custom metric
   */
  public unregisterCustomMetric(name: string): boolean {
    const result = this.customMetrics.delete(name);
    if (result) {
      this.logDebug(`Unregistered custom metric: ${name}`);
    }
    return result;
  }

  /**
   * Get aggregated metrics for a specific period
   */
  public getAggregatedMetrics(startPass?: number, endPass?: number): AggregatedMetrics | null {
    const relevantMetrics = this.filterMetricsByPassRange(startPass, endPass);
    if (relevantMetrics.length === 0) return null;

    return this.calculateAggregatedMetrics(relevantMetrics);
  }

  /**
   * Export metrics to file
   */
  public async exportMetrics(
    format?: 'json' | 'csv' | 'yaml',
    filePath?: string
  ): Promise<MetricsExportResult> {
    const startTime = Date.now();
    const exportFormat = format || this.config.exportFormat;

    try {
      const outputPath = filePath || this.generateExportPath(exportFormat);

      // Ensure directory exists
      await mkdir(dirname(outputPath), { recursive: true });

      let content: string;
      switch (exportFormat) {
        case 'json':
          content = JSON.stringify(this.metrics, null, 2);
          break;
        case 'csv':
          content = this.convertToCSV(this.metrics);
          break;
        case 'yaml':
          content = this.convertToYAML(this.metrics);
          break;
        default:
          throw new Error(`Unsupported export format: ${exportFormat}`);
      }

      await writeFile(outputPath, content, 'utf8');

      return {
        success: true,
        filePath: outputPath,
        format: exportFormat,
        recordCount: this.metrics.length,
        exportDuration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        format: exportFormat,
        recordCount: this.metrics.length,
        exportDuration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get current metrics summary
   */
  public getMetricsSummary(): {
    totalMetrics: number;
    latestPass: number;
    collectionPeriod: { start: Date; end: Date } | null;
    alerts: PerformanceAlert[];
    customMetricsCount: number;
  } {
    const totalMetrics = this.metrics.length;
    const latestPass = totalMetrics > 0 ? this.metrics[totalMetrics - 1].passNumber : 0;

    const collectionPeriod =
      totalMetrics > 0
        ? {
            start: this.metrics[0].timestamp,
            end: this.metrics[totalMetrics - 1].timestamp,
          }
        : null;

    return {
      totalMetrics,
      latestPass,
      collectionPeriod,
      alerts: [...this.alerts],
      customMetricsCount: this.customMetrics.size,
    };
  }

  /**
   * Clear all stored metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
    this.metricsBuffer = [];
    this.aggregationCache.clear();
    this.alerts = [];
    this.logDebug('Cleared all metrics data');
  }

  /**
   * Get performance alerts
   */
  public getAlerts(type?: 'warning' | 'error' | 'critical'): PerformanceAlert[] {
    return type ? this.alerts.filter((alert) => alert.type === type) : [...this.alerts];
  }

  /**
   * Clear performance alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  // Private methods

  private createMinimalEnhancedMetrics(baseMetrics: PassMetrics): EnhancedPassMetrics {
    return {
      ...baseMetrics,
      systemMetrics: {
        cpuUsage: 0,
        memoryUsageDetailed: process.memoryUsage(),
      },
      performanceMetrics: {
        throughputPatternsPerSecond: 0,
        memoryEfficiency: 1,
        processingSpeed: 1,
        resourceUtilization: 0,
      },
      qualityMetrics: {
        patternQualityScore: 1,
        consolidationAccuracy: 1,
        errorRate: 0,
        warningRate: 0,
      },
      customMetrics: {},
      metadata: {
        collectionTimestamp: new Date(),
        collectionDuration: 0,
        metricsVersion: '1.0.0',
      },
    };
  }

  private async collectSystemMetrics(): Promise<EnhancedPassMetrics['systemMetrics']> {
    const memoryUsageDetailed = process.memoryUsage();

    // CPU usage estimation (simplified)
    const startTime = process.hrtime();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const endTime = process.hrtime(startTime);
    const cpuUsage = (endTime[0] * 1000 + endTime[1] / 1000000) / 10; // Rough estimate

    return {
      cpuUsage,
      memoryUsageDetailed,
    };
  }

  private calculatePerformanceMetrics(
    baseMetrics: PassMetrics,
    context: MetricsCollectionContext
  ): EnhancedPassMetrics['performanceMetrics'] {
    const throughputPatternsPerSecond =
      baseMetrics.duration > 0 ? baseMetrics.totalPatternsFound / (baseMetrics.duration / 1000) : 0;

    const memoryEfficiency =
      context.memoryUsage.heapUsed > 0
        ? Math.min(1, (100 * 1024 * 1024) / context.memoryUsage.heapUsed) // 100MB baseline
        : 1;

    const processingSpeed =
      baseMetrics.duration > 0
        ? Math.min(1, 1000 / baseMetrics.duration) // 1 second baseline
        : 1;

    const resourceUtilization = context.memoryUsage.heapUsed / context.memoryUsage.heapTotal || 0;

    return {
      throughputPatternsPerSecond,
      memoryEfficiency,
      processingSpeed,
      resourceUtilization,
    };
  }

  private calculateQualityMetrics(baseMetrics: PassMetrics): EnhancedPassMetrics['qualityMetrics'] {
    const patternQualityScore =
      baseMetrics.patternDiversity > 0 ? Math.min(1, baseMetrics.patternDiversity / 10) : 0;

    const consolidationAccuracy = baseMetrics.consolidationEfficiency;
    const errorRate = baseMetrics.errors.length / Math.max(baseMetrics.totalPatternsFound, 1);
    const warningRate = baseMetrics.warnings.length / Math.max(baseMetrics.totalPatternsFound, 1);

    return {
      patternQualityScore,
      consolidationAccuracy,
      errorRate,
      warningRate,
    };
  }

  private async collectCustomMetrics(
    context: MetricsCollectionContext
  ): Promise<Record<string, number>> {
    const customMetrics: Record<string, number> = {};

    for (const [name, definition] of this.customMetrics) {
      try {
        const value = definition.collectFn(context);
        if (value !== null) {
          customMetrics[name] = value;
        }
      } catch (error) {
        this.logDebug(`Failed to collect custom metric '${name}': ${error}`);
      }
    }

    return customMetrics;
  }

  private async storeMetrics(metrics: EnhancedPassMetrics): Promise<void> {
    // Add to main storage
    this.metrics.push(metrics);

    // Maintain size limit
    if (this.metrics.length > this.config.maxStoredMetrics) {
      this.metrics.shift();
    }

    // Add to buffer for batch operations
    this.metricsBuffer.push(metrics);
    if (this.metricsBuffer.length > this.config.metricsBufferSize) {
      this.metricsBuffer.shift();
    }

    // Persist if enabled
    if (this.config.enableMetricsPersistence) {
      await this.persistMetrics(metrics);
    }
  }

  private async persistMetrics(metrics: EnhancedPassMetrics): Promise<void> {
    // TODO: Implement persistence based on config.persistenceFormat
    // For now, just log that persistence would happen
    this.logDebug(`Would persist metrics for pass ${metrics.passNumber}`);
  }

  private checkPerformanceThresholds(metrics: EnhancedPassMetrics): void {
    const thresholds = this.config.performanceThresholds;

    // Check memory usage
    const memoryUsageMB = metrics.systemMetrics.memoryUsageDetailed.heapUsed / (1024 * 1024);
    if (memoryUsageMB > thresholds.maxMemoryUsageMB) {
      this.addAlert({
        type: 'warning',
        metric: 'memoryUsage',
        threshold: thresholds.maxMemoryUsageMB,
        currentValue: memoryUsageMB,
        passNumber: metrics.passNumber,
        timestamp: metrics.timestamp,
        message: `Memory usage (${memoryUsageMB.toFixed(1)}MB) exceeds threshold (${thresholds.maxMemoryUsageMB}MB)`,
        suggestion: 'Consider enabling memory-efficient mode or reducing batch size',
      });
    }

    // Check pass duration
    if (metrics.duration > thresholds.maxPassDurationMs) {
      this.addAlert({
        type: 'warning',
        metric: 'passDuration',
        threshold: thresholds.maxPassDurationMs,
        currentValue: metrics.duration,
        passNumber: metrics.passNumber,
        timestamp: metrics.timestamp,
        message: `Pass duration (${metrics.duration}ms) exceeds threshold (${thresholds.maxPassDurationMs}ms)`,
        suggestion: 'Consider optimizing pattern analysis or reducing complexity',
      });
    }

    // Check efficiency score
    if (metrics.consolidationEfficiency < thresholds.minEfficiencyScore) {
      this.addAlert({
        type: 'error',
        metric: 'efficiency',
        threshold: thresholds.minEfficiencyScore,
        currentValue: metrics.consolidationEfficiency,
        passNumber: metrics.passNumber,
        timestamp: metrics.timestamp,
        message: `Efficiency score (${metrics.consolidationEfficiency.toFixed(3)}) below threshold (${thresholds.minEfficiencyScore})`,
        suggestion: 'Review pattern detection settings or input quality',
      });
    }

    // Check error rate
    if (metrics.qualityMetrics.errorRate > thresholds.maxErrorRate) {
      this.addAlert({
        type: 'critical',
        metric: 'errorRate',
        threshold: thresholds.maxErrorRate,
        currentValue: metrics.qualityMetrics.errorRate,
        passNumber: metrics.passNumber,
        timestamp: metrics.timestamp,
        message: `Error rate (${(metrics.qualityMetrics.errorRate * 100).toFixed(2)}%) exceeds threshold (${(thresholds.maxErrorRate * 100).toFixed(2)}%)`,
        suggestion: 'Check input data quality and validation logic',
      });
    }
  }

  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Maintain reasonable alert history
    if (this.alerts.length > 1000) {
      this.alerts.splice(0, 100); // Remove oldest 100 alerts
    }
  }

  private updateRealTimeAggregation(metrics: EnhancedPassMetrics): void {
    // TODO: Implement real-time aggregation updates
    // For now, just invalidate cache to force recalculation
    this.aggregationCache.clear();
  }

  private shouldAutoExport(): boolean {
    // Export every 10 passes or when buffer is full
    return (
      this.metrics.length % 10 === 0 || this.metricsBuffer.length >= this.config.metricsBufferSize
    );
  }

  private filterMetricsByPassRange(startPass?: number, endPass?: number): EnhancedPassMetrics[] {
    return this.metrics.filter((metric) => {
      if (startPass !== undefined && metric.passNumber < startPass) return false;
      if (endPass !== undefined && metric.passNumber > endPass) return false;
      return true;
    });
  }

  private calculateAggregatedMetrics(metrics: EnhancedPassMetrics[]): AggregatedMetrics {
    if (metrics.length === 0) {
      throw new Error('Cannot aggregate empty metrics array');
    }

    const firstMetric = metrics[0];
    const lastMetric = metrics[metrics.length - 1];

    // Calculate statistics for numerical fields
    const numericalFields = [
      'duration',
      'totalPatternsFound',
      'patternsConsolidated',
      'compressionRatio',
      'consolidationEfficiency',
      'stabilityScore',
      'memoryUsage',
    ];

    const statistics = {
      count: metrics.length,
      mean: {} as Record<string, number>,
      median: {} as Record<string, number>,
      standardDeviation: {} as Record<string, number>,
      min: {} as Record<string, number>,
      max: {} as Record<string, number>,
      percentiles: {} as Record<string, Record<string, number>>,
    };

    for (const field of numericalFields) {
      const values = metrics
        .map((m) => (m as any)[field] || 0)
        .filter((v) => typeof v === 'number');
      if (values.length > 0) {
        statistics.mean[field] = values.reduce((sum, val) => sum + val, 0) / values.length;
        statistics.median[field] = this.calculateMedian(values);
        statistics.standardDeviation[field] = this.calculateStandardDeviation(values);
        statistics.min[field] = Math.min(...values);
        statistics.max[field] = Math.max(...values);
        statistics.percentiles[field] = this.calculatePercentiles(values);
      }
    }

    // Calculate trends
    const trends = {
      improvementRate: this.calculateImprovementRate(metrics),
      convergenceRate: this.calculateConvergenceRate(metrics),
      stabilityTrend: this.calculateStabilityTrend(metrics),
      performanceTrend: this.calculatePerformanceTrend(metrics),
    };

    // Calculate summaries
    const summaries = {
      totalPatternsProcessed: metrics.reduce((sum, m) => sum + m.totalPatternsFound, 0),
      totalReplacements: metrics.reduce((sum, m) => sum + m.totalReplacements, 0),
      averageEfficiency: statistics.mean.consolidationEfficiency || 0,
      bestPass: metrics.reduce((best, m) =>
        m.consolidationEfficiency > best.consolidationEfficiency ? m : best
      ).passNumber,
      worstPass: metrics.reduce((worst, m) =>
        m.consolidationEfficiency < worst.consolidationEfficiency ? m : worst
      ).passNumber,
    };

    return {
      period: {
        startPass: firstMetric.passNumber,
        endPass: lastMetric.passNumber,
        startTime: firstMetric.timestamp,
        endTime: lastMetric.timestamp,
        totalDuration: lastMetric.timestamp.getTime() - firstMetric.timestamp.getTime(),
      },
      statistics,
      trends,
      summaries,
    };
  }

  private generateExportPath(format: string): string {
    const timestamp = this.config.enableTimestampSuffix
      ? `-${new Date().toISOString().replace(/[:.]/g, '-')}`
      : '';
    const filename = `${this.config.exportFilePrefix}${timestamp}.${format}`;
    return join(this.config.exportPath, filename);
  }

  private convertToCSV(metrics: EnhancedPassMetrics[]): string {
    if (metrics.length === 0) return '';

    // Define CSV headers
    const headers = [
      'passNumber',
      'timestamp',
      'duration',
      'totalPatternsFound',
      'patternsConsolidated',
      'compressionRatio',
      'consolidationEfficiency',
      'stabilityScore',
      'memoryUsage',
      'cpuUsage',
      'throughputPatternsPerSecond',
      'patternQualityScore',
      'errorRate',
    ];

    const csvLines = [headers.join(',')];

    for (const metric of metrics) {
      const row = [
        metric.passNumber,
        metric.timestamp.toISOString(),
        metric.duration,
        metric.totalPatternsFound,
        metric.patternsConsolidated,
        metric.compressionRatio,
        metric.consolidationEfficiency,
        metric.stabilityScore,
        metric.memoryUsage,
        metric.systemMetrics.cpuUsage,
        metric.performanceMetrics.throughputPatternsPerSecond,
        metric.qualityMetrics.patternQualityScore,
        metric.qualityMetrics.errorRate,
      ];
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  private convertToYAML(metrics: EnhancedPassMetrics[]): string {
    // Simple YAML conversion (would use a proper YAML library in production)
    return `metrics:\n${metrics.map((m) => `  - passNumber: ${m.passNumber}\n    timestamp: ${m.timestamp.toISOString()}\n    duration: ${m.duration}\n    efficiency: ${m.consolidationEfficiency}`).join('\n')}`;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculatePercentiles(values: number[]): Record<string, number> {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      '25': sorted[Math.floor(sorted.length * 0.25)],
      '50': sorted[Math.floor(sorted.length * 0.5)],
      '75': sorted[Math.floor(sorted.length * 0.75)],
      '90': sorted[Math.floor(sorted.length * 0.9)],
      '95': sorted[Math.floor(sorted.length * 0.95)],
      '99': sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  private calculateImprovementRate(metrics: EnhancedPassMetrics[]): number {
    if (metrics.length < 2) return 0;

    const first = metrics[0].consolidationEfficiency;
    const last = metrics[metrics.length - 1].consolidationEfficiency;
    return (last - first) / Math.max(first, 0.001);
  }

  private calculateConvergenceRate(metrics: EnhancedPassMetrics[]): number {
    if (metrics.length < 3) return 0;

    // Calculate rate of change in improvement
    const improvements = [];
    for (let i = 1; i < metrics.length; i++) {
      improvements.push(
        metrics[i].consolidationEfficiency - metrics[i - 1].consolidationEfficiency
      );
    }

    // Return rate of convergence (decreasing improvements indicate convergence)
    return improvements.length > 1
      ? (improvements[0] - improvements[improvements.length - 1]) / improvements.length
      : 0;
  }

  private calculateStabilityTrend(metrics: EnhancedPassMetrics[]): number {
    if (metrics.length < 2) return 0;

    const stabilities = metrics.map((m) => m.stabilityScore);
    return stabilities.length > 1
      ? (stabilities[stabilities.length - 1] - stabilities[0]) / stabilities.length
      : 0;
  }

  private calculatePerformanceTrend(metrics: EnhancedPassMetrics[]): number {
    if (metrics.length < 2) return 0;

    const throughputs = metrics.map((m) => m.performanceMetrics.throughputPatternsPerSecond);
    return throughputs.length > 1
      ? (throughputs[throughputs.length - 1] - throughputs[0]) / throughputs.length
      : 0;
  }

  private startAsyncCollection(): void {
    this.collectionTimer = setInterval(() => {
      // Placeholder for periodic collection tasks
      this.logDebug('Async metrics collection heartbeat');
    }, this.config.collectIntervalMs);
  }

  private logDebug(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[MetricsTracker] ${message}`);
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): MetricsTrackingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<MetricsTrackingConfig>): void {
    this.config = MetricsTrackingConfigSchema.parse({
      ...this.config,
      ...newConfig,
    });
  }
}

/**
 * Factory function to create a MetricsTracker instance
 */
export function createMetricsTracker(config: Partial<MetricsTrackingConfig> = {}): MetricsTracker {
  return new MetricsTracker(config);
}

/**
 * Utility function to validate metrics tracking configuration
 */
export function validateMetricsTrackingConfig(config: unknown): MetricsTrackingConfig {
  return MetricsTrackingConfigSchema.parse(config);
}

/**
 * Pre-defined custom metrics for common use cases
 */
export const CommonCustomMetrics = {
  /**
   * Tracks the rate of new pattern discovery per pass
   */
  patternDiscoveryRate: {
    name: 'patternDiscoveryRate',
    description: 'Rate of new pattern discovery per pass',
    type: 'gauge' as const,
    unit: 'patterns/pass',
    collectFn: (context: MetricsCollectionContext) => {
      if (!context.passMetrics) return null;
      return context.passNumber > 1 ? context.passMetrics.newPatternsDiscovered : 0;
    },
  },

  /**
   * Tracks memory efficiency over time
   */
  memoryEfficiencyTrend: {
    name: 'memoryEfficiencyTrend',
    description: 'Memory efficiency trend over optimization passes',
    type: 'gauge' as const,
    unit: 'ratio',
    collectFn: (context: MetricsCollectionContext) => {
      const heapUsed = context.memoryUsage.heapUsed;
      const heapTotal = context.memoryUsage.heapTotal;
      return heapTotal > 0 ? 1 - heapUsed / heapTotal : 1;
    },
  },

  /**
   * Tracks processing velocity (patterns per second)
   */
  processingVelocity: {
    name: 'processingVelocity',
    description: 'Processing velocity in patterns per second',
    type: 'gauge' as const,
    unit: 'patterns/sec',
    collectFn: (context: MetricsCollectionContext) => {
      if (!context.passMetrics || context.duration === 0) return null;
      return context.passMetrics.totalPatternsFound / (context.duration / 1000);
    },
  },
} as const;
