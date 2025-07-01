/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

/**
 * Configuration schema for metrics collection
 */
export const MetricsCollectorConfigSchema = z.object({
  // Collection settings
  enabled: z.boolean().default(true),
  collectClassMetrics: z.boolean().default(true),
  collectPerformanceMetrics: z.boolean().default(true),
  collectOptimizationMetrics: z.boolean().default(true),
  collectMemoryMetrics: z.boolean().default(true),
  collectTimingMetrics: z.boolean().default(true),

  // Buffer and storage settings
  bufferSize: z.number().min(1).max(100000).default(10000),
  flushInterval: z.number().min(100).max(300000).default(5000), // 5 seconds
  autoFlush: z.boolean().default(true),
  enableCompression: z.boolean().default(false),

  // Real-time processing
  enableRealTimeProcessing: z.boolean().default(true),
  realTimeThrottleMs: z.number().min(10).max(5000).default(100),
  enableAggregation: z.boolean().default(true),
  aggregationWindow: z.number().min(1000).max(3600000).default(60000), // 1 minute

  // Sampling and filtering
  samplingRate: z.number().min(0).max(1).default(1.0), // 100% by default
  enableSmartSampling: z.boolean().default(false),
  maxMetricsPerType: z.number().min(100).max(1000000).default(50000),

  // Retention and cleanup
  maxRetentionDays: z.number().min(1).max(365).default(30),
  enableAutoCleanup: z.boolean().default(true),
  cleanupInterval: z.number().min(3600000).max(86400000).default(86400000), // 24 hours

  // Export and reporting
  enableAutoExport: z.boolean().default(false),
  exportInterval: z.number().min(60000).max(86400000).default(3600000), // 1 hour
  exportFormats: z.array(z.enum(['json', 'csv', 'prometheus'])).default(['json']),
  exportPath: z.string().default('./metrics-exports'),

  // Performance thresholds for alerting
  thresholds: z
    .object({
      maxProcessingTimeMs: z.number().default(5000),
      maxMemoryUsageMB: z.number().default(1000),
      maxErrorRate: z.number().default(0.05),
      minOptimizationRatio: z.number().default(0.1),
    })
    .default({}),
});

export type MetricsCollectorConfig = z.infer<typeof MetricsCollectorConfigSchema>;

/**
 * Base metric interface
 */
export interface BaseMetric {
  id: string;
  timestamp: Date;
  type: MetricType;
  source: string;
  tags?: Record<string, string>;
}

/**
 * Types of metrics that can be collected
 */
export enum MetricType {
  CLASS_ANALYSIS = 'class_analysis',
  PERFORMANCE = 'performance',
  OPTIMIZATION = 'optimization',
  MEMORY = 'memory',
  TIMING = 'timing',
  ERROR = 'error',
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
}

/**
 * Class-level analysis metrics
 */
export interface ClassAnalysisMetric extends BaseMetric {
  type: MetricType.CLASS_ANALYSIS;
  data: {
    className: string;
    frequency: number;
    variants: string[];
    category: 'utility' | 'component' | 'responsive' | 'state' | 'custom';
    complexity: number;
    optimizable: boolean;
    consolidationPotential: number;
    responsiveBreakpoints?: string[];
    pseudoClasses?: string[];
    modifiers?: string[];
    conflicts?: string[];
  };
}

/**
 * Performance metrics for optimization operations
 */
export interface PerformanceMetric extends BaseMetric {
  type: MetricType.PERFORMANCE;
  data: {
    operation: string;
    duration: number;
    throughput: number;
    itemsProcessed: number;
    successRate: number;
    errorCount: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    resourceUtilization: {
      cpu: number;
      memory: number;
      io: number;
    };
  };
}

/**
 * Optimization-specific metrics
 */
export interface OptimizationMetric extends BaseMetric {
  type: MetricType.OPTIMIZATION;
  data: {
    inputSize: number;
    outputSize: number;
    compressionRatio: number;
    patternsFound: number;
    patternsConsolidated: number;
    duplicatesRemoved: number;
    sizeSavings: number;
    optimizationLevel: 'basic' | 'advanced' | 'aggressive';
    qualityScore: number;
    stabilityScore: number;
    techniques: string[];
    warnings: string[];
  };
}

/**
 * Memory usage metrics
 */
export interface MemoryMetric extends BaseMetric {
  type: MetricType.MEMORY;
  data: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
    peak: number;
    gc: {
      collections: number;
      duration: number;
      reclaimed: number;
    };
  };
}

/**
 * Timing metrics for various operations
 */
export interface TimingMetric extends BaseMetric {
  type: MetricType.TIMING;
  data: {
    operation: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    phase: string;
    subOperations?: Array<{
      name: string;
      duration: number;
      percentage: number;
    }>;
  };
}

/**
 * Error tracking metrics
 */
export interface ErrorMetric extends BaseMetric {
  type: MetricType.ERROR;
  data: {
    error: string;
    stack?: string;
    context: Record<string, any>;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverable: boolean;
    operation?: string;
    phase?: string;
  };
}

/**
 * Counter metrics for simple counting
 */
export interface CounterMetric extends BaseMetric {
  type: MetricType.COUNTER;
  data: {
    name: string;
    value: number;
    delta: number;
    rate?: number;
  };
}

/**
 * Gauge metrics for point-in-time values
 */
export interface GaugeMetric extends BaseMetric {
  type: MetricType.GAUGE;
  data: {
    name: string;
    value: number;
    unit: string;
    threshold?: {
      min?: number;
      max?: number;
      target?: number;
    };
  };
}

/**
 * Histogram metrics for distribution analysis
 */
export interface HistogramMetric extends BaseMetric {
  type: MetricType.HISTOGRAM;
  data: {
    name: string;
    buckets: Array<{
      upperBound: number;
      count: number;
    }>;
    totalCount: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    percentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
}

/**
 * Union type for all metric types
 */
export type Metric =
  | ClassAnalysisMetric
  | PerformanceMetric
  | OptimizationMetric
  | MemoryMetric
  | TimingMetric
  | ErrorMetric
  | CounterMetric
  | GaugeMetric
  | HistogramMetric;

/**
 * Aggregated metrics summary
 */
export interface MetricsSummary {
  timeRange: {
    start: Date;
    end: Date;
    duration: number;
  };
  totalMetrics: number;
  metricsByType: Record<MetricType, number>;
  averagesByType: Record<string, number>;
  trends: Record<string, Array<{ timestamp: Date; value: number }>>;
  alerts: Array<{
    type: string;
    message: string;
    severity: 'warning' | 'error' | 'critical';
    timestamp: Date;
  }>;
  performance: {
    totalOptimizations: number;
    averageCompressionRatio: number;
    totalSizeSavings: number;
    averageProcessingTime: number;
    errorRate: number;
    successRate: number;
  };
}

/**
 * Metrics filter for querying
 */
export interface MetricsFilter {
  types?: MetricType[];
  sources?: string[];
  tags?: Record<string, string>;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Real-time metrics processor interface
 */
export interface MetricsProcessor {
  process(metric: Metric): Promise<void>;
  flush(): Promise<void>;
  getStats(): Record<string, any>;
}

/**
 * Storage backend interface for metrics
 */
export interface MetricsStorage {
  store(metrics: Metric[]): Promise<void>;
  query(filter: MetricsFilter): Promise<Metric[]>;
  clear(filter?: MetricsFilter): Promise<number>;
  export(format: 'json' | 'csv' | 'prometheus', filter?: MetricsFilter): Promise<string>;
  getStats(): Promise<Record<string, any>>;
}

/**
 * Main metrics collector class
 */
export class MetricsCollector extends EventEmitter {
  private config: MetricsCollectorConfig;
  private buffer: Metric[] = [];
  private processors: Map<string, MetricsProcessor> = new Map();
  private storage: MetricsStorage | null = null;
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private timers: Map<string, Date> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private exportTimer: NodeJS.Timeout | null = null;
  private isStarted = false;

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    super();
    this.config = MetricsCollectorConfigSchema.parse(config);
    this.setupTimers();
  }

  /**
   * Start the metrics collector
   */
  public start(): void {
    if (this.isStarted) return;

    this.isStarted = true;
    this.setupTimers();
    this.emit('started');
  }

  /**
   * Stop the metrics collector
   */
  public async stop(): Promise<void> {
    if (!this.isStarted) return;

    this.isStarted = false;
    this.clearTimers();
    await this.flush();
    this.emit('stopped');
  }

  /**
   * Record a class analysis metric
   */
  public recordClassAnalysis(
    className: string,
    frequency: number,
    options: Partial<ClassAnalysisMetric['data']> = {}
  ): void {
    if (!this.shouldCollect()) return;

    const metric: ClassAnalysisMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      type: MetricType.CLASS_ANALYSIS,
      source: 'collector',
      data: {
        className,
        frequency,
        variants: [],
        category: 'utility',
        complexity: 1,
        optimizable: true,
        consolidationPotential: 0,
        ...options,
      },
    };

    this.addMetric(metric);
  }

  /**
   * Record a performance metric
   */
  public recordPerformance(
    operation: string,
    duration: number,
    options: Partial<PerformanceMetric['data']> = {}
  ): void {
    if (!this.shouldCollect()) return;

    const metric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      type: MetricType.PERFORMANCE,
      source: 'collector',
      data: {
        operation,
        duration,
        throughput: 0,
        itemsProcessed: 0,
        successRate: 1,
        errorCount: 0,
        averageLatency: duration,
        p95Latency: duration,
        p99Latency: duration,
        resourceUtilization: {
          cpu: 0,
          memory: 0,
          io: 0,
        },
        ...options,
      },
    };

    this.addMetric(metric);
  }

  /**
   * Record an optimization metric
   */
  public recordOptimization(
    inputSize: number,
    outputSize: number,
    options: Partial<OptimizationMetric['data']> = {}
  ): void {
    if (!this.shouldCollect()) return;

    const compressionRatio = inputSize > 0 ? (inputSize - outputSize) / inputSize : 0;
    const sizeSavings = Math.max(0, inputSize - outputSize);

    const metric: OptimizationMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      type: MetricType.OPTIMIZATION,
      source: 'collector',
      data: {
        inputSize,
        outputSize,
        compressionRatio,
        sizeSavings,
        patternsFound: 0,
        patternsConsolidated: 0,
        duplicatesRemoved: 0,
        optimizationLevel: 'basic',
        qualityScore: 1,
        stabilityScore: 1,
        techniques: [],
        warnings: [],
        ...options,
      },
    };

    this.addMetric(metric);
  }

  /**
   * Record memory usage metric
   */
  public recordMemory(customData?: Partial<MemoryMetric['data']>): void {
    if (!this.shouldCollect()) return;

    const memUsage = process.memoryUsage();

    const metric: MemoryMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      type: MetricType.MEMORY,
      source: 'collector',
      data: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        arrayBuffers: memUsage.arrayBuffers || 0,
        peak: Math.max(memUsage.heapUsed, customData?.peak || 0),
        gc: {
          collections: 0,
          duration: 0,
          reclaimed: 0,
        },
        ...customData,
      },
    };

    this.addMetric(metric);
  }

  /**
   * Start timing an operation
   */
  public startTimer(operation: string): void {
    this.timers.set(operation, new Date());
  }

  /**
   * End timing an operation and record the metric
   */
  public endTimer(operation: string, phase?: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      throw new Error(`Timer not found for operation: ${operation}`);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    this.timers.delete(operation);

    if (this.shouldCollect()) {
      const metric: TimingMetric = {
        id: this.generateId(),
        timestamp: new Date(),
        type: MetricType.TIMING,
        source: 'collector',
        data: {
          operation,
          startTime,
          endTime,
          duration,
          phase: phase || 'default',
        },
      };

      this.addMetric(metric);
    }

    return duration;
  }

  /**
   * Record an error metric
   */
  public recordError(
    error: string | Error,
    context: Record<string, any> = {},
    severity: ErrorMetric['data']['severity'] = 'medium'
  ): void {
    if (!this.shouldCollect()) return;

    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;

    const metric: ErrorMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      type: MetricType.ERROR,
      source: 'collector',
      data: {
        error: errorMessage,
        stack,
        context,
        severity,
        recoverable: severity !== 'critical',
      },
    };

    this.addMetric(metric);
    this.emit('error', metric);
  }

  /**
   * Increment a counter metric
   */
  public incrementCounter(name: string, delta = 1): void {
    const current = this.counters.get(name) || 0;
    const newValue = current + delta;
    this.counters.set(name, newValue);

    if (this.shouldCollect()) {
      const metric: CounterMetric = {
        id: this.generateId(),
        timestamp: new Date(),
        type: MetricType.COUNTER,
        source: 'collector',
        data: {
          name,
          value: newValue,
          delta,
        },
      };

      this.addMetric(metric);
    }
  }

  /**
   * Set a gauge metric value
   */
  public setGauge(
    name: string,
    value: number,
    unit = '',
    threshold?: GaugeMetric['data']['threshold']
  ): void {
    this.gauges.set(name, value);

    if (this.shouldCollect()) {
      const metric: GaugeMetric = {
        id: this.generateId(),
        timestamp: new Date(),
        type: MetricType.GAUGE,
        source: 'collector',
        data: {
          name,
          value,
          unit,
          threshold,
        },
      };

      this.addMetric(metric);
    }
  }

  /**
   * Record a value in a histogram
   */
  public recordHistogram(name: string, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }

    const values = this.histograms.get(name)!;
    values.push(value);

    // Keep only recent values to prevent memory leaks
    if (values.length > this.config.maxMetricsPerType) {
      values.splice(0, values.length - this.config.maxMetricsPerType);
    }

    if (this.shouldCollect()) {
      const histogram = this.calculateHistogram(values);
      const metric: HistogramMetric = {
        id: this.generateId(),
        timestamp: new Date(),
        type: MetricType.HISTOGRAM,
        source: 'collector',
        data: {
          name,
          ...histogram,
        },
      };

      this.addMetric(metric);
    }
  }

  /**
   * Add a custom processor for real-time metric processing
   */
  public addProcessor(name: string, processor: MetricsProcessor): void {
    this.processors.set(name, processor);
  }

  /**
   * Remove a processor
   */
  public removeProcessor(name: string): void {
    this.processors.delete(name);
  }

  /**
   * Set storage backend
   */
  public setStorage(storage: MetricsStorage): void {
    this.storage = storage;
  }

  /**
   * Manually flush buffered metrics
   */
  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const metricsToFlush = [...this.buffer];
    this.buffer.length = 0;

    // Process with real-time processors
    for (const processor of Array.from(this.processors.values())) {
      for (const metric of metricsToFlush) {
        try {
          await processor.process(metric);
        } catch (error) {
          this.emit('processorError', error);
        }
      }
    }

    // Store in backend
    if (this.storage) {
      try {
        await this.storage.store(metricsToFlush);
      } catch (error) {
        this.emit('storageError', error);
      }
    }

    this.emit('flushed', metricsToFlush.length);
  }

  /**
   * Query metrics from storage
   */
  public async query(filter: MetricsFilter = {}): Promise<Metric[]> {
    if (!this.storage) {
      throw new Error('No storage backend configured');
    }
    return this.storage.query(filter);
  }

  /**
   * Get metrics summary
   */
  public async getSummary(filter: MetricsFilter = {}): Promise<MetricsSummary> {
    const metrics = await this.query(filter);
    return this.calculateSummary(metrics);
  }

  /**
   * Export metrics in specified format
   */
  public async export(
    format: 'json' | 'csv' | 'prometheus',
    filter: MetricsFilter = {}
  ): Promise<string> {
    if (!this.storage) {
      throw new Error('No storage backend configured');
    }
    return this.storage.export(format, filter);
  }

  /**
   * Clear metrics
   */
  public async clear(filter?: MetricsFilter): Promise<number> {
    if (!this.storage) {
      throw new Error('No storage backend configured');
    }
    return this.storage.clear(filter);
  }

  /**
   * Get current configuration
   */
  public getConfig(): MetricsCollectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<MetricsCollectorConfig>): void {
    this.config = MetricsCollectorConfigSchema.parse({ ...this.config, ...updates });
    this.setupTimers();
  }

  /**
   * Get collector statistics
   */
  public getStats(): Record<string, any> {
    return {
      isStarted: this.isStarted,
      bufferSize: this.buffer.length,
      maxBufferSize: this.config.bufferSize,
      processorCount: this.processors.size,
      hasStorage: !!this.storage,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histogramCount: this.histograms.size,
      timerCount: this.timers.size,
      config: this.config,
    };
  }

  /**
   * Update metrics based on new data - Core tracking mechanism
   * Handles both cumulative and instantaneous metrics with robust validation
   */
  public update(
    metricType: MetricType,
    name: string,
    value: number | Metric,
    options: {
      operation?: 'increment' | 'set' | 'aggregate' | 'append';
      tags?: Record<string, string>;
      context?: Record<string, any>;
      timestamp?: Date;
      validation?: boolean;
    } = {}
  ): void {
    try {
      // Input validation
      if (!this.validateUpdateInput(metricType, name, value, options)) {
        return;
      }

      const { operation = 'set', tags = {}, context = {}, timestamp = new Date() } = options;

      // Thread safety - ensure atomic operations
      this.performAtomicUpdate(() => {
        switch (metricType) {
          case MetricType.COUNTER:
            this.updateCounter(name, value as number, operation, tags, timestamp);
            break;
          case MetricType.GAUGE:
            this.updateGauge(name, value as number, operation, tags, timestamp);
            break;
          case MetricType.HISTOGRAM:
            this.updateHistogram(name, value as number, tags, timestamp);
            break;
          case MetricType.CLASS_ANALYSIS:
          case MetricType.PERFORMANCE:
          case MetricType.OPTIMIZATION:
          case MetricType.MEMORY:
          case MetricType.TIMING:
          case MetricType.ERROR:
            if (typeof value === 'object' && value !== null) {
              this.updateComplexMetric(value as Metric, context);
            }
            break;
          default:
            throw new Error(`Unsupported metric type: ${metricType}`);
        }
      });

      this.emit('metricUpdated', { metricType, name, value, operation, timestamp });
    } catch (error) {
      this.handleUpdateError(error, metricType, name, value, options);
    }
  }

  /**
   * Compute aggregate values and derived metrics - Core computation mechanism
   */
  public compute(
    computationType: 'summary' | 'aggregate' | 'trend' | 'comparison',
    options: {
      metricTypes?: MetricType[];
      timeRange?: { start: Date; end: Date };
      groupBy?: string[];
      aggregationFunction?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percentile';
      percentile?: number;
      windowSize?: number;
    } = {}
  ): Record<string, any> {
    try {
      const {
        metricTypes = Object.values(MetricType),
        timeRange,
        groupBy = [],
        aggregationFunction = 'avg',
        windowSize = 100,
      } = options;

      // Input validation for compute parameters
      this.validateComputeInput(computationType, options);

      switch (computationType) {
        case 'summary':
          return this.computeSummaryMetrics(metricTypes, timeRange);
        case 'aggregate':
          return this.computeAggregateMetrics(metricTypes, aggregationFunction, groupBy);
        case 'trend':
          return this.computeTrendMetrics(metricTypes, windowSize, timeRange);
        case 'comparison':
          return this.computeComparisonMetrics(metricTypes, timeRange);
        default:
          throw new Error(`Unsupported computation type: ${computationType}`);
      }
    } catch (error) {
      this.handleComputeError(error, computationType, options);
      return {};
    }
  }

  /**
   * Reset metrics with selective clearing - Core reset mechanism
   */
  public reset(
    resetType: 'all' | 'type' | 'name' | 'timeRange' | 'buffer',
    options: {
      metricTypes?: MetricType[];
      names?: string[];
      timeRange?: { start: Date; end: Date };
      preserveCounters?: boolean;
      preserveGauges?: boolean;
      preserveHistograms?: boolean;
      confirm?: boolean;
    } = {}
  ): { cleared: number; preserved: number; errors: string[] } {
    try {
      const {
        metricTypes = [],
        names = [],
        timeRange,
        preserveCounters = false,
        preserveGauges = false,
        preserveHistograms = false,
        confirm = false,
      } = options;

      // Safety confirmation for destructive operations
      if (!confirm && resetType === 'all') {
        throw new Error('Reset operation requires explicit confirmation for type "all"');
      }

      let clearedCount = 0;
      let preservedCount = 0;
      const errors: string[] = [];

      // Thread safety - ensure atomic reset operations
      this.performAtomicUpdate(() => {
        switch (resetType) {
          case 'all': {
            const result = this.resetAllMetrics(
              preserveCounters,
              preserveGauges,
              preserveHistograms
            );
            clearedCount = result.cleared;
            preservedCount = result.preserved;
            break;
          }
          case 'type': {
            const typeResult = this.resetByType(metricTypes);
            clearedCount = typeResult.cleared;
            preservedCount = typeResult.preserved;
            break;
          }
          case 'name': {
            const nameResult = this.resetByName(names);
            clearedCount = nameResult.cleared;
            preservedCount = nameResult.preserved;
            break;
          }
          case 'timeRange': {
            if (!timeRange) {
              throw new Error('Time range is required for timeRange reset type');
            }
            const timeResult = this.resetByTimeRange(timeRange);
            clearedCount = timeResult.cleared;
            preservedCount = timeResult.preserved;
            break;
          }
          case 'buffer':
            clearedCount = this.buffer.length;
            this.buffer.length = 0;
            break;
          default:
            throw new Error(`Unsupported reset type: ${resetType}`);
        }
      });

      this.emit('metricsReset', { resetType, clearedCount, preservedCount, errors });

      return { cleared: clearedCount, preserved: preservedCount, errors };
    } catch (error) {
      this.handleResetError(error, resetType, options);
      return {
        cleared: 0,
        preserved: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Validate input for update operations
   */
  private validateUpdateInput(
    metricType: MetricType,
    name: string,
    value: number | Metric,
    options: any
  ): boolean {
    try {
      // Basic validation
      if (!metricType || typeof metricType !== 'string') {
        throw new Error('Invalid metric type');
      }
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Invalid metric name');
      }

      // Value validation based on metric type
      if ([MetricType.COUNTER, MetricType.GAUGE, MetricType.HISTOGRAM].includes(metricType)) {
        if (typeof value !== 'number' || !isFinite(value)) {
          throw new Error('Numeric value required for counter/gauge/histogram metrics');
        }
      }

      // Timestamp validation
      if (options.timestamp && !(options.timestamp instanceof Date)) {
        throw new Error('Invalid timestamp format');
      }

      // Tags validation
      if (options.tags && typeof options.tags !== 'object') {
        throw new Error('Tags must be an object');
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.recordError(
        errorMessage,
        {
          operation: 'validateUpdateInput',
          metricType,
          name,
          value: typeof value,
        },
        'medium'
      );
      return false;
    }
  }

  /**
   * Validate input for compute operations
   */
  private validateComputeInput(computationType: string, options: any): void {
    if (!['summary', 'aggregate', 'trend', 'comparison'].includes(computationType)) {
      throw new Error(`Invalid computation type: ${computationType}`);
    }

    if (options.timeRange) {
      const { start, end } = options.timeRange;
      if (!(start instanceof Date) || !(end instanceof Date)) {
        throw new Error('Invalid time range format');
      }
      if (start >= end) {
        throw new Error('Start time must be before end time');
      }
    }

    if (options.percentile !== undefined) {
      if (
        typeof options.percentile !== 'number' ||
        options.percentile < 0 ||
        options.percentile > 100
      ) {
        throw new Error('Percentile must be a number between 0 and 100');
      }
    }

    if (options.windowSize !== undefined) {
      if (typeof options.windowSize !== 'number' || options.windowSize <= 0) {
        throw new Error('Window size must be a positive number');
      }
    }
  }

  /**
   * Perform atomic updates to ensure thread safety
   */
  private performAtomicUpdate(operation: () => void): void {
    // Simple locking mechanism - can be enhanced with more sophisticated locking
    if (this.isStarted) {
      try {
        operation();
      } catch (error) {
        this.emit('atomicUpdateError', error);
        throw error;
      }
    }
  }

  /**
   * Update counter with different operations
   */
  private updateCounter(
    name: string,
    value: number,
    operation: string,
    tags: Record<string, string>,
    timestamp: Date
  ): void {
    const current = this.counters.get(name) || 0;
    let newValue: number;

    switch (operation) {
      case 'increment':
        newValue = current + value;
        break;
      case 'set':
        newValue = value;
        break;
      case 'aggregate':
        newValue = current + value;
        break;
      default:
        newValue = value;
    }

    this.counters.set(name, newValue);

    if (this.shouldCollect()) {
      const metric: CounterMetric = {
        id: this.generateId(),
        timestamp,
        type: MetricType.COUNTER,
        source: 'collector',
        tags,
        data: {
          name,
          value: newValue,
          delta: newValue - current,
          rate: this.calculateRate(name, newValue, timestamp),
        },
      };

      this.addMetric(metric);
    }
  }

  /**
   * Update gauge with different operations
   */
  private updateGauge(
    name: string,
    value: number,
    operation: string,
    tags: Record<string, string>,
    timestamp: Date
  ): void {
    const current = this.gauges.get(name) || 0;
    let newValue: number;

    switch (operation) {
      case 'set':
        newValue = value;
        break;
      case 'increment':
        newValue = current + value;
        break;
      case 'aggregate':
        newValue = (current + value) / 2; // Simple averaging
        break;
      default:
        newValue = value;
    }

    this.gauges.set(name, newValue);

    if (this.shouldCollect()) {
      const metric: GaugeMetric = {
        id: this.generateId(),
        timestamp,
        type: MetricType.GAUGE,
        source: 'collector',
        tags,
        data: {
          name,
          value: newValue,
          unit: '',
        },
      };

      this.addMetric(metric);
    }
  }

  /**
   * Update histogram with new value
   */
  private updateHistogram(
    name: string,
    value: number,
    tags: Record<string, string>,
    timestamp: Date
  ): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }

    const values = this.histograms.get(name)!;
    values.push(value);

    // Keep only recent values to prevent memory leaks
    if (values.length > this.config.maxMetricsPerType) {
      values.splice(0, values.length - this.config.maxMetricsPerType);
    }

    if (this.shouldCollect()) {
      const histogram = this.calculateHistogram(values);
      const metric: HistogramMetric = {
        id: this.generateId(),
        timestamp,
        type: MetricType.HISTOGRAM,
        source: 'collector',
        tags,
        data: {
          name,
          ...histogram,
        },
      };

      this.addMetric(metric);
    }
  }

  /**
   * Update complex metrics (non-numeric)
   */
  private updateComplexMetric(metric: Metric, context: Record<string, any>): void {
    // Add context to the metric if provided
    if (Object.keys(context).length > 0) {
      metric.tags = { ...metric.tags, ...context };
    }

    this.addMetric(metric);
  }

  /**
   * Compute summary metrics
   */
  private computeSummaryMetrics(
    metricTypes: MetricType[],
    timeRange?: { start: Date; end: Date }
  ): Record<string, any> {
    const summary: Record<string, any> = {
      totalMetrics: this.buffer.length,
      metricsByType: {},
      timeRange: timeRange || { start: new Date(0), end: new Date() },
    };

    for (const type of metricTypes) {
      const typeMetrics = this.buffer.filter((m) => m.type === type);
      if (timeRange) {
        const filteredMetrics = typeMetrics.filter(
          (m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
        );
        summary.metricsByType[type] = filteredMetrics.length;
      } else {
        summary.metricsByType[type] = typeMetrics.length;
      }
    }

    return summary;
  }

  /**
   * Compute aggregate metrics
   */
  private computeAggregateMetrics(
    metricTypes: MetricType[],
    aggregationFunction: string,
    _groupBy: string[]
  ): Record<string, any> {
    const aggregates: Record<string, any> = {};

    for (const type of metricTypes) {
      const typeMetrics = this.buffer.filter((m) => m.type === type);

      if (type === MetricType.COUNTER) {
        const values = typeMetrics
          .map((m) => (m as CounterMetric).data.value)
          .filter((v) => typeof v === 'number');
        aggregates[type] = this.applyAggregationFunction(values, aggregationFunction);
      } else if (type === MetricType.GAUGE) {
        const values = typeMetrics
          .map((m) => (m as GaugeMetric).data.value)
          .filter((v) => typeof v === 'number');
        aggregates[type] = this.applyAggregationFunction(values, aggregationFunction);
      }
    }

    return aggregates;
  }

  /**
   * Compute trend metrics
   */
  private computeTrendMetrics(
    metricTypes: MetricType[],
    windowSize: number,
    timeRange?: { start: Date; end: Date }
  ): Record<string, any> {
    const trends: Record<string, any> = {};

    for (const type of metricTypes) {
      let typeMetrics = this.buffer.filter((m) => m.type === type);

      if (timeRange) {
        typeMetrics = typeMetrics.filter(
          (m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
        );
      }

      // Sort by timestamp
      typeMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Take last windowSize metrics
      const recentMetrics = typeMetrics.slice(-windowSize);

      if (recentMetrics.length >= 2) {
        trends[type] = this.calculateTrend(recentMetrics);
      }
    }

    return trends;
  }

  /**
   * Compute comparison metrics
   */
  private computeComparisonMetrics(
    metricTypes: MetricType[],
    timeRange?: { start: Date; end: Date }
  ): Record<string, any> {
    const comparisons: Record<string, any> = {};

    if (!timeRange) {
      return comparisons;
    }

    const midpoint = new Date((timeRange.start.getTime() + timeRange.end.getTime()) / 2);

    for (const type of metricTypes) {
      const firstHalf = this.buffer.filter(
        (m) => m.type === type && m.timestamp >= timeRange.start && m.timestamp < midpoint
      );
      const secondHalf = this.buffer.filter(
        (m) => m.type === type && m.timestamp >= midpoint && m.timestamp <= timeRange.end
      );

      comparisons[type] = {
        firstHalf: firstHalf.length,
        secondHalf: secondHalf.length,
        change: secondHalf.length - firstHalf.length,
        percentageChange:
          firstHalf.length > 0
            ? ((secondHalf.length - firstHalf.length) / firstHalf.length) * 100
            : 0,
      };
    }

    return comparisons;
  }

  /**
   * Reset all metrics with preservation options
   */
  private resetAllMetrics(
    preserveCounters: boolean,
    preserveGauges: boolean,
    preserveHistograms: boolean
  ): { cleared: number; preserved: number } {
    let cleared = 0;
    let preserved = 0;

    // Reset buffer
    cleared += this.buffer.length;
    this.buffer.length = 0;

    // Reset counters
    if (!preserveCounters) {
      cleared += this.counters.size;
      this.counters.clear();
    } else {
      preserved += this.counters.size;
    }

    // Reset gauges
    if (!preserveGauges) {
      cleared += this.gauges.size;
      this.gauges.clear();
    } else {
      preserved += this.gauges.size;
    }

    // Reset histograms
    if (!preserveHistograms) {
      cleared += this.histograms.size;
      this.histograms.clear();
    } else {
      preserved += this.histograms.size;
    }

    // Reset timers
    cleared += this.timers.size;
    this.timers.clear();

    return { cleared, preserved };
  }

  /**
   * Reset metrics by type
   */
  private resetByType(metricTypes: MetricType[]): { cleared: number; preserved: number } {
    let cleared = 0;
    let preserved = 0;

    // Filter buffer
    const originalBufferSize = this.buffer.length;
    this.buffer = this.buffer.filter((m) => !metricTypes.includes(m.type));
    cleared += originalBufferSize - this.buffer.length;
    preserved += this.buffer.length;

    return { cleared, preserved };
  }

  /**
   * Reset metrics by name
   */
  private resetByName(names: string[]): { cleared: number; preserved: number } {
    let cleared = 0;
    let preserved = 0;

    // Reset counters by name
    for (const name of names) {
      if (this.counters.has(name)) {
        this.counters.delete(name);
        cleared++;
      }
      if (this.gauges.has(name)) {
        this.gauges.delete(name);
        cleared++;
      }
      if (this.histograms.has(name)) {
        this.histograms.delete(name);
        cleared++;
      }
    }

    preserved += this.counters.size + this.gauges.size + this.histograms.size;

    return { cleared, preserved };
  }

  /**
   * Reset metrics by time range
   */
  private resetByTimeRange(timeRange: { start: Date; end: Date }): {
    cleared: number;
    preserved: number;
  } {
    const originalBufferSize = this.buffer.length;
    this.buffer = this.buffer.filter(
      (m) => m.timestamp < timeRange.start || m.timestamp > timeRange.end
    );

    return {
      cleared: originalBufferSize - this.buffer.length,
      preserved: this.buffer.length,
    };
  }

  /**
   * Apply aggregation function to numeric values
   */
  private applyAggregationFunction(values: number[], func: string): number {
    if (values.length === 0) return 0;

    switch (func) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return values.reduce((a, b) => a + b, 0) / values.length; // Default to average
    }
  }

  /**
   * Calculate trend from metrics
   */
  private calculateTrend(metrics: BaseMetric[]): {
    direction: 'up' | 'down' | 'stable';
    rate: number;
  } {
    if (metrics.length < 2) {
      return { direction: 'stable', rate: 0 };
    }

    const first = metrics[0];
    const last = metrics[metrics.length - 1];

    // Simple trend calculation based on count
    const rate = (metrics.length - 1) / (last.timestamp.getTime() - first.timestamp.getTime());

    if (rate > 0.1) return { direction: 'up', rate };
    if (rate < -0.1) return { direction: 'down', rate };
    return { direction: 'stable', rate };
  }

  /**
   * Calculate rate for counter metrics
   */
  private calculateRate(name: string, value: number, timestamp: Date): number {
    // Simple rate calculation - can be enhanced with more sophisticated algorithms
    return value / (timestamp.getTime() / 1000); // per second
  }

  /**
   * Handle update errors with proper logging
   */
  private handleUpdateError(
    error: unknown,
    metricType: MetricType,
    name: string,
    value: number | Metric,
    options: any
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.recordError(
      errorObj,
      {
        operation: 'update',
        metricType,
        name,
        valueType: typeof value,
        options,
      },
      'high'
    );
    this.emit('updateError', { error: errorMessage, metricType, name, value, options });
  }

  /**
   * Handle compute errors with proper logging
   */
  private handleComputeError(error: unknown, computationType: string, options: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.recordError(
      errorObj,
      {
        operation: 'compute',
        computationType,
        options,
      },
      'high'
    );
    this.emit('computeError', { error: errorMessage, computationType, options });
  }

  /**
   * Handle reset errors with proper logging
   */
  private handleResetError(error: unknown, resetType: string, options: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));
    this.recordError(
      errorObj,
      {
        operation: 'reset',
        resetType,
        options,
      },
      'critical'
    );
    this.emit('resetError', { error: errorMessage, resetType, options });
  }

  private addMetric(metric: Metric): void {
    if (!this.config.enabled) return;

    // Apply sampling
    if (Math.random() > this.config.samplingRate) return;

    this.buffer.push(metric);

    // Check buffer size
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush().catch((error) => this.emit('flushError', error));
    }

    this.emit('metric', metric);
  }

  private shouldCollect(): boolean {
    return this.config.enabled && this.isStarted;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupTimers(): void {
    this.clearTimers();

    if (this.config.autoFlush && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch((error) => this.emit('flushError', error));
      }, this.config.flushInterval);
    }

    if (this.config.enableAutoCleanup && this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup().catch((error) => this.emit('cleanupError', error));
      }, this.config.cleanupInterval);
    }

    if (this.config.enableAutoExport && this.config.exportInterval > 0) {
      this.exportTimer = setInterval(() => {
        this.performAutoExport().catch((error) => this.emit('exportError', error));
      }, this.config.exportInterval);
    }
  }

  private clearTimers(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = null;
    }
  }

  private async performCleanup(): Promise<void> {
    if (!this.storage) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxRetentionDays);

    const filter: MetricsFilter = {
      endTime: cutoffDate,
    };

    try {
      const deletedCount = await this.storage.clear(filter);
      this.emit('cleanup', { deletedCount, cutoffDate });
    } catch (error) {
      this.emit('cleanupError', error);
    }
  }

  private async performAutoExport(): Promise<void> {
    if (!this.config.enableAutoExport) return;

    for (const format of this.config.exportFormats) {
      try {
        const exported = await this.export(format);
        this.emit('exported', { format, size: exported.length });
      } catch (error) {
        this.emit('exportError', error);
      }
    }
  }

  private calculateHistogram(values: number[]): Omit<HistogramMetric['data'], 'name'> {
    if (values.length === 0) {
      return {
        buckets: [],
        totalCount: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        stdDev: 0,
        percentiles: { p50: 0, p95: 0, p99: 0 },
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    // Create buckets (simple linear buckets for now)
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const bucketCount = Math.min(10, sorted.length);
    const bucketSize = (max - min) / bucketCount;

    const buckets: Array<{ upperBound: number; count: number }> = [];
    for (let i = 0; i < bucketCount; i++) {
      const upperBound = min + (i + 1) * bucketSize;
      const count =
        sorted.filter((v) => v <= upperBound).length -
        (i > 0 ? sorted.filter((v) => v <= min + i * bucketSize).length : 0);
      buckets.push({ upperBound, count });
    }

    return {
      buckets,
      totalCount: sorted.length,
      sum,
      min,
      max,
      mean,
      stdDev,
      percentiles: {
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      },
    };
  }

  private calculateSummary(metrics: Metric[]): MetricsSummary {
    if (metrics.length === 0) {
      return {
        timeRange: { start: new Date(), end: new Date(), duration: 0 },
        totalMetrics: 0,
        metricsByType: {} as Record<MetricType, number>,
        averagesByType: {},
        trends: {},
        alerts: [],
        performance: {
          totalOptimizations: 0,
          averageCompressionRatio: 0,
          totalSizeSavings: 0,
          averageProcessingTime: 0,
          errorRate: 0,
          successRate: 0,
        },
      };
    }

    const timestamps = metrics.map((m) => m.timestamp);
    const start = new Date(Math.min(...timestamps.map((t) => t.getTime())));
    const end = new Date(Math.max(...timestamps.map((t) => t.getTime())));

    const metricsByType = {} as Record<MetricType, number>;
    Object.values(MetricType).forEach((type) => {
      metricsByType[type] = metrics.filter((m) => m.type === type).length;
    });

    // Calculate optimization performance
    const optimizationMetrics = metrics.filter(
      (m) => m.type === MetricType.OPTIMIZATION
    ) as OptimizationMetric[];
    const performanceMetrics = metrics.filter(
      (m) => m.type === MetricType.PERFORMANCE
    ) as PerformanceMetric[];
    const errorMetrics = metrics.filter((m) => m.type === MetricType.ERROR) as ErrorMetric[];

    const totalOptimizations = optimizationMetrics.length;
    const averageCompressionRatio =
      totalOptimizations > 0
        ? optimizationMetrics.reduce((sum, m) => sum + m.data.compressionRatio, 0) /
          totalOptimizations
        : 0;
    const totalSizeSavings = optimizationMetrics.reduce((sum, m) => sum + m.data.sizeSavings, 0);
    const averageProcessingTime =
      performanceMetrics.length > 0
        ? performanceMetrics.reduce((sum, m) => sum + m.data.duration, 0) /
          performanceMetrics.length
        : 0;
    const errorRate = metrics.length > 0 ? errorMetrics.length / metrics.length : 0;
    const successRate = 1 - errorRate;

    return {
      timeRange: {
        start,
        end,
        duration: end.getTime() - start.getTime(),
      },
      totalMetrics: metrics.length,
      metricsByType,
      averagesByType: {},
      trends: {},
      alerts: [],
      performance: {
        totalOptimizations,
        averageCompressionRatio,
        totalSizeSavings,
        averageProcessingTime,
        errorRate,
        successRate,
      },
    };
  }
}

/**
 * Create a new metrics collector instance
 */
export function createMetricsCollector(
  config: Partial<MetricsCollectorConfig> = {}
): MetricsCollector {
  return new MetricsCollector(config);
}

/**
 * Validate metrics collector configuration
 */
export function validateConfig(config: unknown): MetricsCollectorConfig {
  return MetricsCollectorConfigSchema.parse(config);
}
