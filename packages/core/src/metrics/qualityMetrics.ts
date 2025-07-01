/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { MetricsCollector } from './collector.js';

/**
 * Quality metrics configuration schema
 */
export const QualityMetricsConfigSchema = z.object({
  // Collection settings
  enabled: z.boolean().default(true),

  // Aggregation settings
  enableBatchAggregation: z.boolean().default(true),
  batchSize: z.number().min(1).max(10000).default(100),
  windowSize: z.number().min(10).max(100000).default(1000),

  // Quality thresholds for alerting
  thresholds: z
    .object({
      minAccuracy: z.number().min(0).max(1).default(0.95),
      minPrecision: z.number().min(0).max(1).default(0.9),
      minRecall: z.number().min(0).max(1).default(0.9),
      maxErrorRate: z.number().min(0).max(1).default(0.05),
      minF1Score: z.number().min(0).max(1).default(0.9),
    })
    .default({}),

  // Distributed computation settings
  enableDistributedComputation: z.boolean().default(false),
  aggregationStrategy: z.enum(['sum', 'average', 'weighted_average', 'median']).default('average'),

  // State management
  persistState: z.boolean().default(true),
  stateRetentionPeriod: z.number().min(3600000).max(2592000000).default(86400000), // 24 hours
  enableStateSynchronization: z.boolean().default(false),

  // Extension and customization
  allowCustomMetrics: z.boolean().default(true),
  maxCustomMetrics: z.number().min(1).max(100).default(50),
  validateCustomMetrics: z.boolean().default(true),
});

export type QualityMetricsConfig = z.infer<typeof QualityMetricsConfigSchema>;

/**
 * Standard quality metric types
 */
export enum QualityMetricType {
  ACCURACY = 'accuracy',
  PRECISION = 'precision',
  RECALL = 'recall',
  F1_SCORE = 'f1_score',
  SPECIFICITY = 'specificity',
  SENSITIVITY = 'sensitivity',
  ERROR_RATE = 'error_rate',
  FALSE_POSITIVE_RATE = 'false_positive_rate',
  FALSE_NEGATIVE_RATE = 'false_negative_rate',
  CUSTOM = 'custom',
}

/**
 * Classification results for binary/multi-class metrics
 */
export interface ClassificationResults {
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  totalSamples: number;
  classLabels?: string[];
  confusionMatrix?: number[][];
}

/**
 * Optimization quality assessment
 */
export interface OptimizationQuality {
  originalSize: number;
  optimizedSize: number;
  reductionRatio: number;
  compressionEfficiency: number;
  processingTime: number;
  errorCount: number;
  warningCount: number;
  validationPassed: boolean;
  semanticAccuracy: number; // How well the optimized output preserves meaning
}

/**
 * Quality metric definition
 */
export interface QualityMetric {
  id: string;
  name: string;
  type: QualityMetricType;
  value: number;
  unit: string;
  timestamp: Date;
  metadata: Record<string, any>;
  tags: Record<string, string>;
  aggregationInfo?: {
    sampleCount: number;
    batchId?: string;
    distributedNodeId?: string;
    aggregationMethod: string;
  };
}

/**
 * Custom quality metric definition
 */
export interface CustomQualityMetric {
  id: string;
  name: string;
  description: string;
  computation: (data: any) => number;
  validation: (value: number) => boolean;
  unit: string;
  range: { min: number; max: number };
  aggregationMethod: 'sum' | 'average' | 'max' | 'min' | 'custom';
  customAggregation?: (values: number[]) => number;
}

/**
 * Quality metrics state for aggregation
 */
export interface QualityMetricsState {
  id: string;
  timestamp: Date;
  metrics: Map<string, QualityMetric>;
  aggregatedData: {
    batchCount: number;
    totalSamples: number;
    windowStart: Date;
    windowEnd: Date;
  };
  distributedState?: {
    nodeId: string;
    contributionWeight: number;
    lastSyncTimestamp: Date;
  };
}

/**
 * Aggregated quality statistics
 */
export interface QualityStats {
  timeRange: { start: Date; end: Date };
  overallQuality: {
    score: number; // Composite quality score 0-1
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    trend: 'improving' | 'declining' | 'stable';
  };
  standardMetrics: {
    accuracy: { current: number; average: number; trend: string };
    precision: { current: number; average: number; trend: string };
    recall: { current: number; average: number; trend: string };
    f1Score: { current: number; average: number; trend: string };
    errorRate: { current: number; average: number; trend: string };
  };
  customMetrics: Record<
    string,
    {
      current: number;
      average: number;
      trend: string;
      unit: string;
    }
  >;
  qualityAlerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metric: string;
    threshold: number;
    actualValue: number;
    timestamp: Date;
  }>;
  batchStatistics: {
    totalBatches: number;
    averageBatchSize: number;
    processingEfficiency: number;
  };
}

/**
 * Comprehensive quality metrics collection system
 */
export class QualityMetricsCollector extends EventEmitter {
  private config: QualityMetricsConfig;
  private metricsCollector: MetricsCollector;
  private isRunning = false;

  // State management
  private currentState: QualityMetricsState;
  private stateHistory: QualityMetricsState[] = [];
  private customMetrics = new Map<string, CustomQualityMetric>();

  // Batch processing
  private currentBatch: Array<{ data: any; timestamp: Date }> = [];
  private batchCounter = 0;

  // Quality tracking
  private qualityHistory: QualityMetric[] = [];
  private alerts = new Set<string>();

  constructor(metricsCollector: MetricsCollector, config: Partial<QualityMetricsConfig> = {}) {
    super();
    this.config = QualityMetricsConfigSchema.parse(config);
    this.metricsCollector = metricsCollector;
    this.currentState = this.initializeState();
  }

  /**
   * Start quality metrics collection
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('started');
  }

  /**
   * Stop quality metrics collection
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Process any remaining batch data
    if (this.currentBatch.length > 0) {
      this.processBatch();
    }

    this.emit('stopped');
  }

  /**
   * Record classification quality metrics
   */
  public recordClassificationQuality(
    results: ClassificationResults,
    metadata: Record<string, any> = {}
  ): QualityStats {
    const accuracy = this.calculateAccuracy(results);
    const precision = this.calculatePrecision(results);
    const recall = this.calculateRecall(results);
    const f1Score = this.calculateF1Score(precision, recall);
    const errorRate = this.calculateErrorRate(results);

    // Record individual metrics
    this.recordMetric(QualityMetricType.ACCURACY, accuracy, metadata);
    this.recordMetric(QualityMetricType.PRECISION, precision, metadata);
    this.recordMetric(QualityMetricType.RECALL, recall, metadata);
    this.recordMetric(QualityMetricType.F1_SCORE, f1Score, metadata);
    this.recordMetric(QualityMetricType.ERROR_RATE, errorRate, metadata);

    // Check thresholds
    this.checkQualityThresholds({
      accuracy,
      precision,
      recall,
      f1Score,
      errorRate,
    });

    return this.getQualityStats();
  }

  /**
   * Record optimization quality metrics
   */
  public recordOptimizationQuality(
    quality: OptimizationQuality,
    metadata: Record<string, any> = {}
  ): void {
    const compressionAccuracy =
      quality.reductionRatio > 0 ? 1 - quality.errorCount / Math.max(quality.originalSize, 1) : 0;

    const processingEfficiency =
      quality.processingTime > 0 ? quality.originalSize / quality.processingTime : 0;

    const validationScore = quality.validationPassed ? 1.0 : 0.0;

    // Record quality metrics
    this.recordMetric('compression_accuracy', compressionAccuracy, {
      ...metadata,
      originalSize: quality.originalSize,
      optimizedSize: quality.optimizedSize,
      reductionRatio: quality.reductionRatio,
    });

    this.recordMetric('processing_efficiency', processingEfficiency, {
      ...metadata,
      processingTime: quality.processingTime,
    });

    this.recordMetric('semantic_accuracy', quality.semanticAccuracy, metadata);
    this.recordMetric('validation_score', validationScore, metadata);

    // Record in main metrics collector
    this.metricsCollector.recordOptimization(quality.originalSize, quality.optimizedSize, {
      compressionRatio: quality.reductionRatio,
      patternsFound: 0,
      patternsConsolidated: 0,
      duplicatesRemoved: 0,
      sizeSavings: quality.originalSize - quality.optimizedSize,
      optimizationLevel: 'basic' as const,
      qualityScore: quality.semanticAccuracy,
      stabilityScore: quality.validationPassed ? 1.0 : 0.0,
      techniques: ['quality-assessment'],
      warnings: quality.errorCount > 0 ? [`${quality.errorCount} errors detected`] : [],
    });
  }

  /**
   * Record a custom quality metric
   */
  public recordCustomMetric(
    metricId: string,
    value: number,
    metadata: Record<string, any> = {}
  ): void {
    const customMetric = this.customMetrics.get(metricId);
    if (!customMetric) {
      throw new Error(`Custom metric ${metricId} not registered`);
    }

    // Validate value
    if (this.config.validateCustomMetrics && !customMetric.validation(value)) {
      throw new Error(`Invalid value ${value} for custom metric ${metricId}`);
    }

    this.recordMetric(customMetric.name, value, {
      ...metadata,
      customMetricId: metricId,
      unit: customMetric.unit,
    });
  }

  /**
   * Register a custom quality metric
   */
  public registerCustomMetric(metric: CustomQualityMetric): void {
    if (!this.config.allowCustomMetrics) {
      throw new Error('Custom metrics are disabled');
    }

    if (this.customMetrics.size >= this.config.maxCustomMetrics) {
      throw new Error(`Maximum custom metrics limit (${this.config.maxCustomMetrics}) reached`);
    }

    // Validate metric definition
    this.validateCustomMetric(metric);

    this.customMetrics.set(metric.id, metric);
    this.emit('customMetricRegistered', metric);
  }

  /**
   * Unregister a custom quality metric
   */
  public unregisterCustomMetric(metricId: string): boolean {
    const existed = this.customMetrics.delete(metricId);
    if (existed) {
      this.emit('customMetricUnregistered', metricId);
    }
    return existed;
  }

  /**
   * Add data to current batch for batch processing
   */
  public addToBatch(data: any): void {
    if (!this.config.enableBatchAggregation) {
      // Process immediately
      this.processDataPoint(data);
      return;
    }

    this.currentBatch.push({ data, timestamp: new Date() });

    if (this.currentBatch.length >= this.config.batchSize) {
      this.processBatch();
    }
  }

  /**
   * Get current quality statistics
   */
  public getQualityStats(timeRange?: { start: Date; end: Date }): QualityStats {
    const now = new Date();
    const range = timeRange || {
      start: new Date(now.getTime() - this.config.stateRetentionPeriod),
      end: now,
    };

    const relevantMetrics = this.qualityHistory.filter(
      (m) => m.timestamp >= range.start && m.timestamp <= range.end
    );

    // Calculate standard metrics
    const standardMetrics = this.calculateStandardMetricsStats(relevantMetrics);

    // Calculate custom metrics stats
    const customMetrics = this.calculateCustomMetricsStats(relevantMetrics);

    // Calculate overall quality score
    const overallQuality = this.calculateOverallQuality(standardMetrics);

    return {
      timeRange: range,
      overallQuality,
      standardMetrics,
      customMetrics,
      qualityAlerts: this.getActiveAlerts(),
      batchStatistics: {
        totalBatches: this.batchCounter,
        averageBatchSize:
          this.currentBatch.length > 0 ? this.currentBatch.length : this.config.batchSize,
        processingEfficiency: this.calculateProcessingEfficiency(),
      },
    };
  }

  /**
   * Get quality metrics history
   */
  public getMetricsHistory(
    metricType?: QualityMetricType | string,
    limit?: number
  ): QualityMetric[] {
    let filtered = this.qualityHistory;

    if (metricType) {
      filtered = filtered.filter((m) => m.type === metricType || m.name === metricType);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Reset all quality metrics and state
   */
  public reset(): void {
    this.currentState = this.initializeState();
    this.stateHistory = [];
    this.qualityHistory = [];
    this.currentBatch = [];
    this.batchCounter = 0;
    this.alerts.clear();
    this.emit('reset');
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<QualityMetricsConfig>): void {
    this.config = QualityMetricsConfigSchema.parse({ ...this.config, ...updates });
    this.emit('configUpdated', this.config);
  }

  /**
   * Export quality metrics state for distributed aggregation
   */
  public exportState(): QualityMetricsState {
    return { ...this.currentState };
  }

  /**
   * Import and merge quality metrics state from distributed nodes
   */
  public importAndMergeState(states: QualityMetricsState[]): void {
    if (!this.config.enableDistributedComputation) {
      throw new Error('Distributed computation is disabled');
    }

    for (const state of states) {
      this.mergeDistributedState(state);
    }

    this.emit('statesMerged', states.length);
  }

  /**
   * Calculate accuracy from classification results
   */
  private calculateAccuracy(results: ClassificationResults): number {
    if (results.totalSamples === 0) return 0;

    const correct = results.truePositives + results.trueNegatives;
    return correct / results.totalSamples;
  }

  /**
   * Calculate precision from classification results
   */
  private calculatePrecision(results: ClassificationResults): number {
    const totalPositives = results.truePositives + results.falsePositives;
    if (totalPositives === 0) return 0;

    return results.truePositives / totalPositives;
  }

  /**
   * Calculate recall from classification results
   */
  private calculateRecall(results: ClassificationResults): number {
    const actualPositives = results.truePositives + results.falseNegatives;
    if (actualPositives === 0) return 0;

    return results.truePositives / actualPositives;
  }

  /**
   * Calculate F1 score from precision and recall
   */
  private calculateF1Score(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;

    return (2 * precision * recall) / (precision + recall);
  }

  /**
   * Calculate error rate from classification results
   */
  private calculateErrorRate(results: ClassificationResults): number {
    if (results.totalSamples === 0) return 0;

    const errors = results.falsePositives + results.falseNegatives;
    return errors / results.totalSamples;
  }

  /**
   * Record a quality metric
   */
  private recordMetric(
    typeOrName: QualityMetricType | string,
    value: number,
    metadata: Record<string, any> = {}
  ): void {
    const metric: QualityMetric = {
      id: this.generateMetricId(),
      name: typeof typeOrName === 'string' ? typeOrName : typeOrName,
      type: Object.values(QualityMetricType).includes(typeOrName as QualityMetricType)
        ? (typeOrName as QualityMetricType)
        : QualityMetricType.CUSTOM,
      value,
      unit: metadata.unit || (value <= 1 ? 'ratio' : 'count'),
      timestamp: new Date(),
      metadata,
      tags: metadata.tags || {},
    };

    this.qualityHistory.push(metric);

    // Maintain history size
    if (this.qualityHistory.length > this.config.windowSize) {
      this.qualityHistory.splice(0, this.qualityHistory.length - this.config.windowSize);
    }

    // Update current state
    this.currentState.metrics.set(metric.name, metric);
    this.currentState.aggregatedData.totalSamples++;

    this.emit('metricRecorded', metric);
  }

  /**
   * Initialize quality metrics state
   */
  private initializeState(): QualityMetricsState {
    return {
      id: this.generateStateId(),
      timestamp: new Date(),
      metrics: new Map(),
      aggregatedData: {
        batchCount: 0,
        totalSamples: 0,
        windowStart: new Date(),
        windowEnd: new Date(),
      },
    };
  }

  /**
   * Process current batch of data
   */
  private processBatch(): void {
    if (this.currentBatch.length === 0) return;

    this.batchCounter++;

    // Process each data point in the batch
    for (const { data } of this.currentBatch) {
      this.processDataPoint(data);
    }

    // Update state
    this.currentState.aggregatedData.batchCount = this.batchCounter;

    // Clear batch
    this.currentBatch = [];

    this.emit('batchProcessed', {
      batchId: this.batchCounter,
      size: this.currentBatch.length,
    });
  }

  /**
   * Process a single data point
   */
  private processDataPoint(data: any): void {
    // This would contain logic to extract quality metrics from data
    // Implementation depends on the specific data format and requirements
    this.emit('dataPointProcessed', data);
  }

  /**
   * Validate custom metric definition
   */
  private validateCustomMetric(metric: CustomQualityMetric): void {
    if (!metric.id || typeof metric.id !== 'string') {
      throw new Error('Custom metric must have a valid ID');
    }

    if (!metric.name || typeof metric.name !== 'string') {
      throw new Error('Custom metric must have a valid name');
    }

    if (typeof metric.computation !== 'function') {
      throw new Error('Custom metric must have a computation function');
    }

    if (typeof metric.validation !== 'function') {
      throw new Error('Custom metric must have a validation function');
    }

    if (this.customMetrics.has(metric.id)) {
      throw new Error(`Custom metric with ID ${metric.id} already exists`);
    }
  }

  /**
   * Check quality thresholds and generate alerts
   */
  private checkQualityThresholds(metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    errorRate: number;
  }): void {
    const { thresholds } = this.config;

    if (metrics.accuracy < thresholds.minAccuracy) {
      this.generateAlert('accuracy', 'low', metrics.accuracy, thresholds.minAccuracy);
    }

    if (metrics.precision < thresholds.minPrecision) {
      this.generateAlert('precision', 'low', metrics.precision, thresholds.minPrecision);
    }

    if (metrics.recall < thresholds.minRecall) {
      this.generateAlert('recall', 'low', metrics.recall, thresholds.minRecall);
    }

    if (metrics.f1Score < thresholds.minF1Score) {
      this.generateAlert('f1_score', 'medium', metrics.f1Score, thresholds.minF1Score);
    }

    if (metrics.errorRate > thresholds.maxErrorRate) {
      this.generateAlert('error_rate', 'high', metrics.errorRate, thresholds.maxErrorRate);
    }
  }

  /**
   * Generate a quality alert
   */
  private generateAlert(
    metric: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    actualValue: number,
    threshold: number
  ): void {
    const alertId = `${metric}-${severity}-${Date.now()}`;
    this.alerts.add(alertId);

    this.emit('qualityAlert', {
      id: alertId,
      type: 'quality_threshold',
      severity,
      metric,
      actualValue,
      threshold,
      message: `Quality metric ${metric} (${actualValue.toFixed(3)}) below threshold (${threshold})`,
      timestamp: new Date(),
    });
  }

  /**
   * Calculate standard metrics statistics
   */
  private calculateStandardMetricsStats(metrics: QualityMetric[]): any {
    const metricsByType = new Map<string, number[]>();

    for (const metric of metrics) {
      const values = metricsByType.get(metric.name) || [];
      values.push(metric.value);
      metricsByType.set(metric.name, values);
    }

    const result: any = {};

    for (const [metricName, values] of Array.from(metricsByType)) {
      if (values.length > 0) {
        result[metricName] = {
          current: values[values.length - 1],
          average: values.reduce((a, b) => a + b, 0) / values.length,
          trend: this.calculateTrend(values),
        };
      }
    }

    return result;
  }

  /**
   * Calculate custom metrics statistics
   */
  private calculateCustomMetricsStats(metrics: QualityMetric[]): Record<string, any> {
    const customMetrics = metrics.filter((m) => m.type === QualityMetricType.CUSTOM);
    const result: Record<string, any> = {};

    const metricsByName = new Map<string, { values: number[]; unit: string }>();

    for (const metric of customMetrics) {
      const existing = metricsByName.get(metric.name) || { values: [], unit: metric.unit };
      existing.values.push(metric.value);
      metricsByName.set(metric.name, existing);
    }

    for (const [name, { values, unit }] of Array.from(metricsByName)) {
      result[name] = {
        current: values[values.length - 1] || 0,
        average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
        trend: this.calculateTrend(values),
        unit,
      };
    }

    return result;
  }

  /**
   * Calculate overall quality score and grade
   */
  private calculateOverallQuality(standardMetrics: any): {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    trend: 'improving' | 'declining' | 'stable';
  } {
    // Weighted average of key quality metrics
    const weights = {
      accuracy: 0.3,
      precision: 0.25,
      recall: 0.25,
      f1Score: 0.2,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [metric, weight] of Object.entries(weights)) {
      if (standardMetrics[metric]) {
        totalScore += standardMetrics[metric].current * weight;
        totalWeight += weight;
      }
    }

    const score = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Assign letter grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 0.95) grade = 'A';
    else if (score >= 0.85) grade = 'B';
    else if (score >= 0.75) grade = 'C';
    else if (score >= 0.65) grade = 'D';
    else grade = 'F';

    // Calculate trend (simplified)
    const trends = Object.values(standardMetrics).map((m: any) => m.trend);
    const improvingCount = trends.filter((t) => t === 'improving').length;
    const decliningCount = trends.filter((t) => t === 'declining').length;

    let trend: 'improving' | 'declining' | 'stable';
    if (improvingCount > decliningCount) trend = 'improving';
    else if (decliningCount > improvingCount) trend = 'declining';
    else trend = 'stable';

    return { score, grade, trend };
  }

  /**
   * Calculate trend from values
   */
  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-Math.min(10, values.length));
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    if (firstHalf.length === 0 || secondHalf.length === 0) return 'stable';

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.05) return 'improving';
    if (change < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Get active quality alerts
   */
  private getActiveAlerts(): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metric: string;
    threshold: number;
    actualValue: number;
    timestamp: Date;
  }> {
    // This would return actual alert objects
    // For now, return empty array as alerts are stored as IDs
    return [];
  }

  /**
   * Calculate processing efficiency
   */
  private calculateProcessingEfficiency(): number {
    // Simplified calculation - in practice, would consider timing metrics
    return this.batchCounter > 0 ? 0.95 : 1.0;
  }

  /**
   * Merge distributed state
   */
  private mergeDistributedState(state: QualityMetricsState): void {
    // Merge metrics using the configured aggregation strategy
    for (const [metricName, metric] of Array.from(state.metrics)) {
      const existing = this.currentState.metrics.get(metricName);

      if (existing) {
        // Aggregate values based on strategy
        const aggregatedValue = this.aggregateValues(
          [existing.value, metric.value],
          this.config.aggregationStrategy
        );

        existing.value = aggregatedValue;
        existing.timestamp = new Date();
      } else {
        this.currentState.metrics.set(metricName, { ...metric });
      }
    }

    // Update aggregated data
    this.currentState.aggregatedData.batchCount += state.aggregatedData.batchCount;
    this.currentState.aggregatedData.totalSamples += state.aggregatedData.totalSamples;
  }

  /**
   * Aggregate values using the specified strategy
   */
  private aggregateValues(values: number[], strategy: string): number {
    switch (strategy) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'average':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'weighted_average':
        // Simplified - would use actual weights in practice
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'median': {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      }
      default:
        return values[values.length - 1]; // Last value
    }
  }

  /**
   * Generate unique metric ID
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique state ID
   */
  private generateStateId(): string {
    return `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a quality metrics collector instance
 */
export function createQualityMetricsCollector(
  metricsCollector: MetricsCollector,
  config: Partial<QualityMetricsConfig> = {}
): QualityMetricsCollector {
  return new QualityMetricsCollector(metricsCollector, config);
}

/**
 * Validate quality metrics configuration
 */
export function validateQualityConfig(config: unknown): QualityMetricsConfig {
  return QualityMetricsConfigSchema.parse(config);
}

/**
 * Utility function to create classification results from arrays
 */
export function createClassificationResults(
  actual: string[],
  predicted: string[],
  positiveClass?: string
): ClassificationResults {
  if (actual.length !== predicted.length) {
    throw new Error('Actual and predicted arrays must have the same length');
  }

  let truePositives = 0;
  let trueNegatives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (let i = 0; i < actual.length; i++) {
    const actualValue = actual[i];
    const predictedValue = predicted[i];

    if (positiveClass) {
      // Binary classification
      const actualIsPositive = actualValue === positiveClass;
      const predictedIsPositive = predictedValue === positiveClass;

      if (actualIsPositive && predictedIsPositive) truePositives++;
      else if (!actualIsPositive && !predictedIsPositive) trueNegatives++;
      else if (!actualIsPositive && predictedIsPositive) falsePositives++;
      else if (actualIsPositive && !predictedIsPositive) falseNegatives++;
    } else {
      // Multi-class classification
      if (actualValue === predictedValue) {
        truePositives++;
      } else {
        falseNegatives++;
      }
    }
  }

  return {
    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
    totalSamples: actual.length,
    classLabels: Array.from(new Set([...actual, ...predicted])),
  };
}
