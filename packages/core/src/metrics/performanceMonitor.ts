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
 * Performance monitoring configuration schema
 */
export const PerformanceMonitorConfigSchema = z.object({
  // Monitoring settings
  enabled: z.boolean().default(true),
  autoStart: z.boolean().default(true),

  // Timing precision
  useHighResolutionTimer: z.boolean().default(true),
  timerResolution: z.enum(['milliseconds', 'microseconds', 'nanoseconds']).default('milliseconds'),

  // Resource monitoring
  monitorMemory: z.boolean().default(true),
  monitorCpu: z.boolean().default(true),
  monitorIo: z.boolean().default(false),
  monitorGc: z.boolean().default(true),

  // Sampling and collection
  samplingInterval: z.number().min(100).max(60000).default(1000), // 1 second
  maxSamplesPerMetric: z.number().min(100).max(100000).default(10000),
  enableAdaptiveSampling: z.boolean().default(true),

  // Thresholds for alerting
  thresholds: z
    .object({
      maxLatencyMs: z.number().default(5000),
      minThroughput: z.number().default(10),
      maxMemoryUsageMB: z.number().default(1000),
      maxCpuUsagePercent: z.number().default(80),
      maxGcPauseMs: z.number().default(100),
    })
    .default({}),

  // Aggregation and reporting
  enableRealTimeAggregation: z.boolean().default(true),
  aggregationWindow: z.number().min(1000).max(300000).default(60000), // 1 minute
  retentionPeriod: z.number().min(3600000).max(2592000000).default(86400000), // 24 hours
});

export type PerformanceMonitorConfig = z.infer<typeof PerformanceMonitorConfigSchema>;

/**
 * Performance metric types for specialized monitoring
 */
export enum PerformanceMetricType {
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
  RESOURCE_USAGE = 'resource_usage',
  GC_PERFORMANCE = 'gc_performance',
  OPERATION_TIMING = 'operation_timing',
  SYSTEM_HEALTH = 'system_health',
  CUSTOM = 'custom',
}

/**
 * Timer precision utilities
 */
export interface TimerPrecision {
  start(): bigint;
  end(startTime: bigint): number;
  now(): number;
  resolution: 'milliseconds' | 'microseconds' | 'nanoseconds';
}

/**
 * Resource usage measurement
 */
export interface ResourceUsage {
  timestamp: Date;
  memory: {
    used: number;
    total: number;
    free: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    usage: number;
    userTime: number;
    systemTime: number;
    idleTime: number;
  };
  io?: {
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
  };
  gc: {
    collections: number;
    duration: number;
    reclaimed: number;
    pauseTime: number;
  };
}

/**
 * Performance sample for time-series data
 */
export interface PerformanceSample {
  id: string;
  timestamp: Date;
  type: PerformanceMetricType;
  operation?: string;
  value: number;
  unit: string;
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

/**
 * Aggregated performance statistics
 */
export interface PerformanceStats {
  timeRange: { start: Date; end: Date };
  sampleCount: number;
  metrics: {
    latency: {
      min: number;
      max: number;
      mean: number;
      p50: number;
      p90: number;
      p95: number;
      p99: number;
      stdDev: number;
    };
    throughput: {
      average: number;
      peak: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
    resourceUsage: {
      memory: { average: number; peak: number; trend: string };
      cpu: { average: number; peak: number; trend: string };
    };
    errorRate: number;
    availability: number;
  };
  alerts: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    resolved: boolean;
  }>;
}

/**
 * Performance operation tracker
 */
export interface PerformanceOperation {
  id: string;
  name: string;
  startTime: bigint;
  endTime?: bigint;
  duration?: number;
  metadata: Record<string, any>;
  tags: Record<string, string>;
  subOperations: Array<{
    name: string;
    startTime: bigint;
    endTime: bigint;
    duration: number;
    percentage?: number;
  }>;
}

/**
 * Comprehensive performance monitoring system
 */
export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitorConfig;
  private metricsCollector: MetricsCollector;
  private timer: TimerPrecision;
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Performance tracking
  private activeOperations = new Map<string, PerformanceOperation>();
  private samples = new Map<PerformanceMetricType, PerformanceSample[]>();
  private resourceBaseline: ResourceUsage | null = null;
  private lastGcStats = { collections: 0, duration: 0 };

  // Aggregation and statistics
  private aggregationTimer: NodeJS.Timeout | null = null;
  private currentStats: PerformanceStats | null = null;
  private alerts = new Set<string>();

  constructor(metricsCollector: MetricsCollector, config: Partial<PerformanceMonitorConfig> = {}) {
    super();
    this.config = PerformanceMonitorConfigSchema.parse(config);
    this.metricsCollector = metricsCollector;
    this.timer = this.createTimer();

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start performance monitoring
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.captureResourceBaseline();
    this.startResourceMonitoring();
    this.startAggregation();

    this.emit('started');
  }

  /**
   * Stop performance monitoring
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    // Complete any active operations
    for (const operationId of Array.from(this.activeOperations.keys())) {
      this.endOperation(operationId);
    }

    this.emit('stopped');
  }

  /**
   * Start a performance operation
   */
  public startOperation(
    name: string,
    metadata: Record<string, any> = {},
    tags: Record<string, string> = {}
  ): string {
    const id = this.generateOperationId();
    const operation: PerformanceOperation = {
      id,
      name,
      startTime: this.timer.start(),
      metadata: { ...metadata },
      tags: { ...tags },
      subOperations: [],
    };

    this.activeOperations.set(id, operation);
    this.emit('operationStarted', { id, name, metadata, tags });

    return id;
  }

  /**
   * End a performance operation
   */
  public endOperation(operationId: string): number {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.endTime = process.hrtime.bigint();
    operation.duration = this.timer.end(operation.startTime);

    // Calculate sub-operation percentages
    const totalDuration = operation.duration;
    for (const subOp of operation.subOperations) {
      subOp.percentage = (subOp.duration / totalDuration) * 100;
    }

    // Record performance metric
    this.recordLatency(operation.name, operation.duration, {
      operationId,
      subOperationCount: operation.subOperations.length,
      ...operation.metadata,
    });

    // Record in metrics collector
    this.metricsCollector.recordPerformance(operation.name, operation.duration, {
      itemsProcessed: operation.metadata.itemsProcessed || 1,
      successRate: operation.metadata.errors ? 0.0 : 1.0,
      errorCount: operation.metadata.errors || 0,
      resourceUtilization: this.getCurrentResourceUtilization(),
    });

    this.activeOperations.delete(operationId);
    this.emit('operationEnded', {
      id: operationId,
      name: operation.name,
      duration: operation.duration,
      subOperations: operation.subOperations,
    });

    return operation.duration;
  }

  /**
   * Add a sub-operation to an active operation
   */
  public addSubOperation(operationId: string, subOperationName: string, duration: number): void {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      operation.subOperations.push({
        name: subOperationName,
        startTime: process.hrtime.bigint(),
        endTime: process.hrtime.bigint(),
        duration,
      });
    }
  }

  /**
   * Record latency measurement
   */
  public recordLatency(
    operation: string,
    latency: number,
    metadata: Record<string, any> = {}
  ): void {
    const sample: PerformanceSample = {
      id: this.generateSampleId(),
      timestamp: new Date(),
      type: PerformanceMetricType.LATENCY,
      operation,
      value: latency,
      unit: this.timer.resolution,
      metadata,
      tags: { operation },
    };

    this.addSample(sample);
    this.checkLatencyThreshold(latency);
  }

  /**
   * Record throughput measurement
   */
  public recordThroughput(
    operation: string,
    itemsProcessed: number,
    timeWindow: number,
    metadata: Record<string, any> = {}
  ): void {
    const throughput = itemsProcessed / (timeWindow / 1000); // items per second

    const sample: PerformanceSample = {
      id: this.generateSampleId(),
      timestamp: new Date(),
      type: PerformanceMetricType.THROUGHPUT,
      operation,
      value: throughput,
      unit: 'items/second',
      metadata: { itemsProcessed, timeWindow, ...metadata },
      tags: { operation },
    };

    this.addSample(sample);
    this.checkThroughputThreshold(throughput);
  }

  /**
   * Record custom performance metric
   */
  public recordCustomMetric(
    name: string,
    value: number,
    unit: string,
    metadata: Record<string, any> = {}
  ): void {
    const sample: PerformanceSample = {
      id: this.generateSampleId(),
      timestamp: new Date(),
      type: PerformanceMetricType.CUSTOM,
      operation: name,
      value,
      unit,
      metadata,
      tags: { metric: name },
    };

    this.addSample(sample);
  }

  /**
   * Get current performance statistics
   */
  public getStats(timeRange?: { start: Date; end: Date }): PerformanceStats | null {
    if (!timeRange && this.currentStats) {
      return this.currentStats;
    }

    return this.calculateStats(timeRange);
  }

  /**
   * Get samples for a specific metric type
   */
  public getSamples(type: PerformanceMetricType, limit?: number): PerformanceSample[] {
    const samples = this.samples.get(type) || [];
    return limit ? samples.slice(-limit) : samples;
  }

  /**
   * Get active operations
   */
  public getActiveOperations(): PerformanceOperation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Clear all samples and reset statistics
   */
  public reset(): void {
    this.samples.clear();
    this.currentStats = null;
    this.alerts.clear();
    this.activeOperations.clear();
    this.emit('reset');
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<PerformanceMonitorConfig>): void {
    this.config = PerformanceMonitorConfigSchema.parse({ ...this.config, ...updates });

    // Restart monitoring with new config if running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Create high-resolution timer based on configuration
   */
  private createTimer(): TimerPrecision {
    const { timerResolution, useHighResolutionTimer } = this.config;

    if (!useHighResolutionTimer) {
      return {
        start: () => BigInt(Date.now()) * BigInt(1000000), // Convert to nanoseconds
        end: (startTime: bigint) => Number((process.hrtime.bigint() - startTime) / BigInt(1000000)),
        now: () => Date.now(),
        resolution: 'milliseconds',
      };
    }

    switch (timerResolution) {
      case 'microseconds':
        return {
          start: () => process.hrtime.bigint(),
          end: (startTime: bigint) => Number((process.hrtime.bigint() - startTime) / BigInt(1000)),
          now: () => Number(process.hrtime.bigint() / BigInt(1000000)),
          resolution: 'microseconds',
        };
      case 'nanoseconds':
        return {
          start: () => process.hrtime.bigint(),
          end: (startTime: bigint) => Number(process.hrtime.bigint() - startTime),
          now: () => Number(process.hrtime.bigint()),
          resolution: 'nanoseconds',
        };
      default: // milliseconds
        return {
          start: () => process.hrtime.bigint(),
          end: (startTime: bigint) =>
            Number((process.hrtime.bigint() - startTime) / BigInt(1000000)),
          now: () => Number(process.hrtime.bigint() / BigInt(1000000)),
          resolution: 'milliseconds',
        };
    }
  }

  /**
   * Capture baseline resource usage
   */
  private captureResourceBaseline(): void {
    this.resourceBaseline = this.getCurrentResourceUsage();
  }

  /**
   * Start resource monitoring loop
   */
  private startResourceMonitoring(): void {
    if (!this.config.enabled) return;

    this.monitoringInterval = setInterval(() => {
      try {
        const usage = this.getCurrentResourceUsage();
        this.recordResourceUsage(usage);
        this.checkResourceThresholds(usage);
      } catch (error) {
        this.emit('monitoringError', error);
      }
    }, this.config.samplingInterval);
  }

  /**
   * Start aggregation timer
   */
  private startAggregation(): void {
    if (!this.config.enableRealTimeAggregation) return;

    this.aggregationTimer = setInterval(() => {
      try {
        this.currentStats = this.calculateStats();
        this.emit('statsUpdated', this.currentStats);
      } catch (error) {
        this.emit('aggregationError', error);
      }
    }, this.config.aggregationWindow);
  }

  /**
   * Get current resource usage
   */
  private getCurrentResourceUsage(): ResourceUsage {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Get GC stats if available
    const gcStats = this.getGcStats();

    return {
      timestamp: new Date(),
      memory: {
        used: memUsage.rss,
        total: memUsage.rss + memUsage.heapTotal,
        free: 0, // Not easily available in Node.js
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
      cpu: {
        usage: 0, // Calculated from deltas
        userTime: cpuUsage.user / 1000, // Convert to milliseconds
        systemTime: cpuUsage.system / 1000,
        idleTime: 0, // Not available in Node.js
      },
      gc: gcStats,
    };
  }

  /**
   * Get current resource utilization for metrics
   */
  private getCurrentResourceUtilization(): { cpu: number; memory: number; io: number } {
    const usage = this.getCurrentResourceUsage();
    const memoryPercent = this.resourceBaseline
      ? (usage.memory.used / this.resourceBaseline.memory.used) * 100
      : 0;

    return {
      cpu: 0, // Would need more sophisticated CPU monitoring
      memory: Math.min(memoryPercent, 100),
      io: 0, // Not easily available in Node.js
    };
  }

  /**
   * Get garbage collection statistics
   */
  private getGcStats(): {
    collections: number;
    duration: number;
    reclaimed: number;
    pauseTime: number;
  } {
    // This is a simplified implementation
    // In a real system, you might use performance hooks or gc-stats module
    return {
      collections: 0,
      duration: 0,
      reclaimed: 0,
      pauseTime: 0,
    };
  }

  /**
   * Record resource usage as performance sample
   */
  private recordResourceUsage(usage: ResourceUsage): void {
    if (this.config.monitorMemory) {
      const memorySample: PerformanceSample = {
        id: this.generateSampleId(),
        timestamp: usage.timestamp,
        type: PerformanceMetricType.RESOURCE_USAGE,
        value: usage.memory.used,
        unit: 'bytes',
        metadata: { type: 'memory', details: usage.memory },
        tags: { resource: 'memory' },
      };
      this.addSample(memorySample);
    }

    if (this.config.monitorCpu) {
      const cpuSample: PerformanceSample = {
        id: this.generateSampleId(),
        timestamp: usage.timestamp,
        type: PerformanceMetricType.RESOURCE_USAGE,
        value: usage.cpu.usage,
        unit: 'percent',
        metadata: { type: 'cpu', details: usage.cpu },
        tags: { resource: 'cpu' },
      };
      this.addSample(cpuSample);
    }

    if (this.config.monitorGc && usage.gc.collections > 0) {
      const gcSample: PerformanceSample = {
        id: this.generateSampleId(),
        timestamp: usage.timestamp,
        type: PerformanceMetricType.GC_PERFORMANCE,
        value: usage.gc.pauseTime,
        unit: 'milliseconds',
        metadata: { type: 'gc', details: usage.gc },
        tags: { resource: 'gc' },
      };
      this.addSample(gcSample);
    }
  }

  /**
   * Add a performance sample
   */
  private addSample(sample: PerformanceSample): void {
    const samples = this.samples.get(sample.type) || [];
    samples.push(sample);

    // Maintain sample limit
    if (samples.length > this.config.maxSamplesPerMetric) {
      samples.splice(0, samples.length - this.config.maxSamplesPerMetric);
    }

    this.samples.set(sample.type, samples);
    this.emit('sampleAdded', sample);
  }

  /**
   * Calculate performance statistics
   */
  private calculateStats(timeRange?: { start: Date; end: Date }): PerformanceStats {
    const now = new Date();
    const defaultTimeRange = {
      start: new Date(now.getTime() - this.config.aggregationWindow),
      end: now,
    };
    const range = timeRange || defaultTimeRange;

    // Get samples in time range
    const allSamples: PerformanceSample[] = [];
    for (const samples of Array.from(this.samples.values())) {
      const filteredSamples = samples.filter(
        (s) => s.timestamp >= range.start && s.timestamp <= range.end
      );
      allSamples.push(...filteredSamples);
    }

    // Calculate latency statistics
    const latencySamples = allSamples
      .filter((s) => s.type === PerformanceMetricType.LATENCY)
      .map((s) => s.value)
      .sort((a, b) => a - b);

    const latencyStats =
      latencySamples.length > 0
        ? {
            min: Math.min(...latencySamples),
            max: Math.max(...latencySamples),
            mean: latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length,
            p50: this.percentile(latencySamples, 50),
            p90: this.percentile(latencySamples, 90),
            p95: this.percentile(latencySamples, 95),
            p99: this.percentile(latencySamples, 99),
            stdDev: this.standardDeviation(latencySamples),
          }
        : {
            min: 0,
            max: 0,
            mean: 0,
            p50: 0,
            p90: 0,
            p95: 0,
            p99: 0,
            stdDev: 0,
          };

    // Calculate throughput statistics
    const throughputSamples = allSamples
      .filter((s) => s.type === PerformanceMetricType.THROUGHPUT)
      .map((s) => s.value);

    const throughputStats =
      throughputSamples.length > 0
        ? {
            average: throughputSamples.reduce((a, b) => a + b, 0) / throughputSamples.length,
            peak: Math.max(...throughputSamples),
            trend: this.calculateTrend(throughputSamples) as 'increasing' | 'decreasing' | 'stable',
          }
        : {
            average: 0,
            peak: 0,
            trend: 'stable' as const,
          };

    // Resource usage statistics
    const memorySamples = allSamples
      .filter(
        (s) => s.type === PerformanceMetricType.RESOURCE_USAGE && s.tags?.resource === 'memory'
      )
      .map((s) => s.value);

    const cpuSamples = allSamples
      .filter((s) => s.type === PerformanceMetricType.RESOURCE_USAGE && s.tags?.resource === 'cpu')
      .map((s) => s.value);

    return {
      timeRange: range,
      sampleCount: allSamples.length,
      metrics: {
        latency: latencyStats,
        throughput: throughputStats,
        resourceUsage: {
          memory: {
            average:
              memorySamples.length > 0
                ? memorySamples.reduce((a, b) => a + b, 0) / memorySamples.length
                : 0,
            peak: memorySamples.length > 0 ? Math.max(...memorySamples) : 0,
            trend: this.calculateTrend(memorySamples),
          },
          cpu: {
            average:
              cpuSamples.length > 0 ? cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length : 0,
            peak: cpuSamples.length > 0 ? Math.max(...cpuSamples) : 0,
            trend: this.calculateTrend(cpuSamples),
          },
        },
        errorRate: 0, // Would need error tracking
        availability: 100, // Would need uptime tracking
      },
      alerts: Array.from(this.alerts).map((alertId) => ({
        type: 'performance',
        message: alertId,
        severity: 'medium' as const,
        timestamp: new Date(),
        resolved: false,
      })),
    };
  }

  /**
   * Check latency threshold
   */
  private checkLatencyThreshold(latency: number): void {
    if (latency > this.config.thresholds.maxLatencyMs) {
      const alertId = `high-latency-${Date.now()}`;
      this.alerts.add(alertId);
      this.emit('alert', {
        type: 'latency',
        message: `High latency detected: ${latency}ms > ${this.config.thresholds.maxLatencyMs}ms`,
        severity: 'high',
        value: latency,
        threshold: this.config.thresholds.maxLatencyMs,
      });
    }
  }

  /**
   * Check throughput threshold
   */
  private checkThroughputThreshold(throughput: number): void {
    if (throughput < this.config.thresholds.minThroughput) {
      const alertId = `low-throughput-${Date.now()}`;
      this.alerts.add(alertId);
      this.emit('alert', {
        type: 'throughput',
        message: `Low throughput detected: ${throughput} < ${this.config.thresholds.minThroughput}`,
        severity: 'medium',
        value: throughput,
        threshold: this.config.thresholds.minThroughput,
      });
    }
  }

  /**
   * Check resource thresholds
   */
  private checkResourceThresholds(usage: ResourceUsage): void {
    const memoryMB = usage.memory.used / (1024 * 1024);
    if (memoryMB > this.config.thresholds.maxMemoryUsageMB) {
      const alertId = `high-memory-${Date.now()}`;
      this.alerts.add(alertId);
      this.emit('alert', {
        type: 'memory',
        message: `High memory usage: ${memoryMB.toFixed(2)}MB > ${this.config.thresholds.maxMemoryUsageMB}MB`,
        severity: 'high',
        value: memoryMB,
        threshold: this.config.thresholds.maxMemoryUsageMB,
      });
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    if (firstHalf.length === 0 || secondHalf.length === 0) return 'stable';

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique sample ID
   */
  private generateSampleId(): string {
    return `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a performance monitor instance
 */
export function createPerformanceMonitor(
  metricsCollector: MetricsCollector,
  config: Partial<PerformanceMonitorConfig> = {}
): PerformanceMonitor {
  return new PerformanceMonitor(metricsCollector, config);
}

/**
 * Validate performance monitor configuration
 */
export function validatePerformanceConfig(config: unknown): PerformanceMonitorConfig {
  return PerformanceMonitorConfigSchema.parse(config);
}
