/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { z } from 'zod';

/**
 * Performance monitoring configuration
 */
export const PerformanceMonitorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sampleInterval: z.number().min(100).default(1000), // ms
  maxSamples: z.number().min(10).default(1000),
  enableGC: z.boolean().default(true),
  enableEventLoop: z.boolean().default(true),
  enableMemoryDetails: z.boolean().default(true),
  warningThresholds: z.object({
    memoryUsageMB: z.number().default(512),
    cpuUsagePercent: z.number().default(80),
    eventLoopLagMs: z.number().default(10),
    operationDurationMs: z.number().default(100),
  }).default({}),
  outputDir: z.string().default('./performance-reports'),
  autoAnalysis: z.boolean().default(true),
});

export type PerformanceMonitorConfig = z.infer<typeof PerformanceMonitorConfigSchema>;

/**
 * Performance measurement data
 */
export interface PerformanceMeasurement {
  id: string;
  name: string;
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  cpuBefore: NodeJS.CpuUsage;
  cpuAfter: NodeJS.CpuUsage;
  metadata: Record<string, any>;
  tags: string[];
}

/**
 * System resource snapshot
 */
export interface ResourceSnapshot {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
    heapUtilization: number;
  };
  cpu: {
    user: number;
    system: number;
    percent: number;
  };
  eventLoop: {
    lag: number;
    utilization: number;
  };
  gc: {
    collections: number;
    duration: number;
    type: string;
  }[];
}

/**
 * Performance bottleneck detection
 */
export interface PerformanceBottleneck {
  operation: string;
  frequency: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
  memoryImpact: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

/**
 * Performance analysis results
 */
export interface PerformanceAnalysisResult {
  sessionId: string;
  period: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    totalOperations: number;
    totalDuration: number;
    averageOperationTime: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
    eventLoopLagAverage: number;
  };
  bottlenecks: PerformanceBottleneck[];
  trends: {
    memoryTrend: 'stable' | 'increasing' | 'decreasing' | 'fluctuating';
    cpuTrend: 'stable' | 'increasing' | 'decreasing' | 'fluctuating';
    performanceTrend: 'improving' | 'degrading' | 'stable';
  };
  recommendations: string[];
  regressions: {
    operation: string;
    previousDuration: number;
    currentDuration: number;
    degradationPercent: number;
  }[];
}

/**
 * Performance monitoring session
 */
export interface MonitoringSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  measurements: PerformanceMeasurement[];
  snapshots: ResourceSnapshot[];
  config: PerformanceMonitorConfig;
}

/**
 * Advanced performance monitor for pattern analysis operations
 */
export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitorConfig;
  private isMonitoring = false;
  private currentSession?: MonitoringSession;
  private sessions: Map<string, MonitoringSession> = new Map();
  private measurements: Map<string, PerformanceMeasurement> = new Map();
  private snapshots: ResourceSnapshot[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;
  private gcObserver?: PerformanceObserver;
  private baselineMetrics?: ResourceSnapshot;
  private operationBaselines: Map<string, { duration: number; memory: number }> = new Map();

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    super();
    this.config = PerformanceMonitorConfigSchema.parse(config);
    
    if (this.config.enabled) {
      this.setupObservers();
      this.captureBaseline();
    }
  }

  /**
   * Start a new monitoring session
   */
  public startSession(name: string): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      name,
      startTime: Date.now(),
      measurements: [],
      snapshots: [],
      config: this.config,
    };

    this.sessions.set(sessionId, this.currentSession);
    this.startMonitoring();

    this.emit('sessionStarted', { sessionId, name });
    return sessionId;
  }

  /**
   * Stop the current monitoring session
   */
  public stopSession(): PerformanceAnalysisResult | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = Date.now();
    this.stopMonitoring();

    const analysis = this.config.autoAnalysis 
      ? this.analyzeSession(this.currentSession.id) 
      : null;

    this.emit('sessionStopped', { 
      sessionId: this.currentSession.id, 
      analysis 
    });

    this.currentSession = undefined;
    return analysis;
  }

  /**
   * Start measuring a specific operation
   */
  public startMeasurement(operation: string, metadata: Record<string, any> = {}): string {
    if (!this.config.enabled) return '';

    const measurementId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const measurement: PerformanceMeasurement = {
      id: measurementId,
      name: operation,
      operation,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      memoryBefore: process.memoryUsage(),
      memoryAfter: process.memoryUsage(),
      cpuBefore: process.cpuUsage(),
      cpuAfter: process.cpuUsage(),
      metadata,
      tags: [],
    };

    this.measurements.set(measurementId, measurement);
    performance.mark(`${measurementId}-start`);

    return measurementId;
  }

  /**
   * End a measurement
   */
  public endMeasurement(measurementId: string, metadata: Record<string, any> = {}): PerformanceMeasurement | null {
    if (!this.config.enabled || !measurementId) return null;

    const measurement = this.measurements.get(measurementId);
    if (!measurement) return null;

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;
    measurement.memoryAfter = process.memoryUsage();
    measurement.cpuAfter = process.cpuUsage(measurement.cpuBefore);
    measurement.metadata = { ...measurement.metadata, ...metadata };

    performance.mark(`${measurementId}-end`);

    try {
      performance.measure(measurement.operation, `${measurementId}-start`, `${measurementId}-end`);
    } catch (error) {
      // Mark might not exist, continue silently
    }

    // Add to current session if active
    if (this.currentSession) {
      this.currentSession.measurements.push(measurement);
    }

    // Check for performance warnings
    this.checkPerformanceWarnings(measurement);

    // Update operation baseline
    this.updateOperationBaseline(measurement);

    this.measurements.delete(measurementId);
    this.emit('measurementCompleted', measurement);

    return measurement;
  }

  /**
   * Measure a function execution
   */
  public async measureFunction<T>(
    operation: string,
    fn: () => Promise<T> | T,
    metadata: Record<string, any> = {}
  ): Promise<{ result: T; measurement: PerformanceMeasurement | null }> {
    const measurementId = this.startMeasurement(operation, metadata);
    
    try {
      const result = await fn();
      const measurement = this.endMeasurement(measurementId, { success: true });
      return { result, measurement };
    } catch (error) {
      const measurement = this.endMeasurement(measurementId, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Get current performance metrics
   */
  public getCurrentMetrics(): ResourceSnapshot {
    return this.captureResourceSnapshot();
  }

  /**
   * Analyze a monitoring session
   */
  public analyzeSession(sessionId: string): PerformanceAnalysisResult | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const endTime = session.endTime || Date.now();
    const duration = endTime - session.startTime;

    // Calculate summary metrics
    const totalOperations = session.measurements.length;
    const totalDuration = session.measurements.reduce((sum, m) => sum + m.duration, 0);
    const averageOperationTime = totalOperations > 0 ? totalDuration / totalOperations : 0;

    const peakMemoryUsage = Math.max(
      ...session.snapshots.map(s => s.memory.heapUsed),
      ...session.measurements.map(m => m.memoryAfter.heapUsed)
    );

    const peakCpuUsage = Math.max(...session.snapshots.map(s => s.cpu.percent));

    const eventLoopLagAverage = session.snapshots.length > 0
      ? session.snapshots.reduce((sum, s) => sum + s.eventLoop.lag, 0) / session.snapshots.length
      : 0;

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(session.measurements);

    // Analyze trends
    const trends = this.analyzeTrends(session.snapshots);

    // Check for regressions
    const regressions = this.detectRegressions(session.measurements);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      peakMemoryUsage,
      peakCpuUsage,
      eventLoopLagAverage,
      bottlenecks,
      trends,
      regressions,
    });

    return {
      sessionId,
      period: {
        start: session.startTime,
        end: endTime,
        duration,
      },
      summary: {
        totalOperations,
        totalDuration,
        averageOperationTime,
        peakMemoryUsage,
        peakCpuUsage,
        eventLoopLagAverage,
      },
      bottlenecks,
      trends,
      recommendations,
      regressions,
    };
  }

  /**
   * Get all monitoring sessions
   */
  public getSessions(): MonitoringSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear old sessions (keep last N)
   */
  public clearOldSessions(keepCount = 10): void {
    const sessions = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => b.startTime - a.startTime);

    const toDelete = sessions.slice(keepCount);
    for (const [sessionId] of toDelete) {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Setup performance observers
   */
  private setupObservers(): void {
    // GC observer
    if (this.config.enableGC) {
      try {
        this.gcObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.emit('gcEvent', {
              type: entry.name,
              duration: entry.duration,
              timestamp: entry.startTime,
            });
          }
        });
        this.gcObserver.observe({ entryTypes: ['gc'] });
      } catch (error) {
        // GC observer not supported in this Node.js version
      }
    }

    // General performance observer
    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.emit('performanceEntry', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }
      });
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      // Observer not supported
    }
  }

  /**
   * Start monitoring resources
   */
  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.capturePeriodicSnapshot();
    }, this.config.sampleInterval);
  }

  /**
   * Stop monitoring resources
   */
  private stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Capture baseline metrics
   */
  private captureBaseline(): void {
    this.baselineMetrics = this.captureResourceSnapshot();
  }

  /**
   * Capture a resource snapshot
   */
  private captureResourceSnapshot(): ResourceSnapshot {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers || 0,
        heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percent: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
      },
      eventLoop: {
        lag: this.measureEventLoopLag(),
        utilization: 1.0, // Would need more sophisticated measurement
      },
      gc: [], // Would be populated by GC observer
    };
  }

  /**
   * Capture periodic snapshot
   */
  private capturePeriodicSnapshot(): void {
    if (!this.currentSession) return;

    const snapshot = this.captureResourceSnapshot();
    this.currentSession.snapshots.push(snapshot);
    this.snapshots.push(snapshot);

    // Limit snapshot history
    if (this.currentSession.snapshots.length > this.config.maxSamples) {
      this.currentSession.snapshots.shift();
    }

    if (this.snapshots.length > this.config.maxSamples) {
      this.snapshots.shift();
    }

    this.emit('snapshot', snapshot);
  }

  /**
   * Measure event loop lag
   */
  private measureEventLoopLag(): number {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      this.emit('eventLoopLag', lag);
    });
    return 0; // Immediate measurement not possible
  }

  /**
   * Check for performance warnings
   */
  private checkPerformanceWarnings(measurement: PerformanceMeasurement): void {
    const { warningThresholds } = this.config;

    // Check operation duration
    if (measurement.duration > warningThresholds.operationDurationMs) {
      this.emit('performanceWarning', {
        type: 'slowOperation',
        operation: measurement.operation,
        duration: measurement.duration,
        threshold: warningThresholds.operationDurationMs,
      });
    }

    // Check memory usage
    const memoryUsageMB = measurement.memoryAfter.heapUsed / (1024 * 1024);
    if (memoryUsageMB > warningThresholds.memoryUsageMB) {
      this.emit('performanceWarning', {
        type: 'highMemoryUsage',
        operation: measurement.operation,
        memoryUsageMB,
        threshold: warningThresholds.memoryUsageMB,
      });
    }
  }

  /**
   * Update operation baseline
   */
  private updateOperationBaseline(measurement: PerformanceMeasurement): void {
    const existing = this.operationBaselines.get(measurement.operation);
    const memoryUsed = measurement.memoryAfter.heapUsed - measurement.memoryBefore.heapUsed;

    if (!existing) {
      this.operationBaselines.set(measurement.operation, {
        duration: measurement.duration,
        memory: memoryUsed,
      });
    } else {
      // Update with exponential moving average
      const alpha = 0.1;
      existing.duration = existing.duration * (1 - alpha) + measurement.duration * alpha;
      existing.memory = existing.memory * (1 - alpha) + memoryUsed * alpha;
    }
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottlenecks(measurements: PerformanceMeasurement[]): PerformanceBottleneck[] {
    const operationStats = new Map<string, {
      count: number;
      totalDuration: number;
      maxDuration: number;
      totalMemory: number;
      durations: number[];
    }>();

    // Aggregate measurements by operation
    for (const measurement of measurements) {
      const stats = operationStats.get(measurement.operation) || {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        totalMemory: 0,
        durations: [],
      };

      stats.count++;
      stats.totalDuration += measurement.duration;
      stats.maxDuration = Math.max(stats.maxDuration, measurement.duration);
      stats.totalMemory += measurement.memoryAfter.heapUsed - measurement.memoryBefore.heapUsed;
      stats.durations.push(measurement.duration);

      operationStats.set(measurement.operation, stats);
    }

    // Convert to bottlenecks
    return Array.from(operationStats.entries())
      .map(([operation, stats]) => {
        const averageDuration = stats.totalDuration / stats.count;
        const severity = this.classifyBottleneckSeverity(stats.maxDuration, averageDuration, stats.count);

        return {
          operation,
          frequency: stats.count,
          totalDuration: stats.totalDuration,
          averageDuration,
          maxDuration: stats.maxDuration,
          memoryImpact: stats.totalMemory / stats.count,
          severity,
          recommendations: this.generateBottleneckRecommendations(operation, stats),
        };
      })
      .filter(bottleneck => bottleneck.severity !== 'low')
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 10); // Top 10 bottlenecks
  }

  /**
   * Classify bottleneck severity
   */
  private classifyBottleneckSeverity(
    maxDuration: number,
    averageDuration: number,
    frequency: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const impactScore = averageDuration * frequency * Math.log(maxDuration + 1);

    if (impactScore > 10000 || maxDuration > 5000) return 'critical';
    if (impactScore > 5000 || maxDuration > 2000) return 'high';
    if (impactScore > 1000 || maxDuration > 500) return 'medium';
    return 'low';
  }

  /**
   * Generate bottleneck recommendations
   */
  private generateBottleneckRecommendations(operation: string, stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.maxDuration > 1000) {
      recommendations.push('Consider breaking down this operation into smaller chunks');
    }

    if (stats.count > 100) {
      recommendations.push('High frequency operation - consider caching results');
    }

    if (operation.includes('file') || operation.includes('io')) {
      recommendations.push('Consider using streaming or async I/O for better performance');
    }

    if (operation.includes('pattern') || operation.includes('analysis')) {
      recommendations.push('Consider parallelizing pattern analysis with worker threads');
    }

    return recommendations;
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(snapshots: ResourceSnapshot[]): PerformanceAnalysisResult['trends'] {
    if (snapshots.length < 3) {
      return {
        memoryTrend: 'stable',
        cpuTrend: 'stable',
        performanceTrend: 'stable',
      };
    }

    const memoryValues = snapshots.map(s => s.memory.heapUsed);
    const cpuValues = snapshots.map(s => s.cpu.percent);

    return {
      memoryTrend: this.calculateTrend(memoryValues),
      cpuTrend: this.calculateTrend(cpuValues),
      performanceTrend: 'stable', // Would need operation time trends
    };
  }

  /**
   * Calculate trend for values
   */
  private calculateTrend(values: number[]): 'stable' | 'increasing' | 'decreasing' | 'fluctuating' {
    if (values.length < 3) return 'stable';

    const third = Math.floor(values.length / 3);
    const first = values.slice(0, third);
    const last = values.slice(-third);

    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;

    const change = (lastAvg - firstAvg) / firstAvg;

    if (Math.abs(change) < 0.1) return 'stable';
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'fluctuating';
  }

  /**
   * Detect performance regressions
   */
  private detectRegressions(measurements: PerformanceMeasurement[]): PerformanceAnalysisResult['regressions'] {
    const regressions: PerformanceAnalysisResult['regressions'] = [];

    for (const measurement of measurements) {
      const baseline = this.operationBaselines.get(measurement.operation);
      if (baseline) {
        const degradationPercent = ((measurement.duration - baseline.duration) / baseline.duration) * 100;
        
        if (degradationPercent > 20) { // 20% degradation threshold
          regressions.push({
            operation: measurement.operation,
            previousDuration: baseline.duration,
            currentDuration: measurement.duration,
            degradationPercent,
          });
        }
      }
    }

    return regressions.sort((a, b) => b.degradationPercent - a.degradationPercent);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(data: {
    peakMemoryUsage: number;
    peakCpuUsage: number;
    eventLoopLagAverage: number;
    bottlenecks: PerformanceBottleneck[];
    trends: any;
    regressions: any[];
  }): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    if (data.peakMemoryUsage > 500 * 1024 * 1024) { // 500MB
      recommendations.push('High memory usage detected - consider implementing memory optimization strategies');
    }

    // Event loop recommendations
    if (data.eventLoopLagAverage > 10) {
      recommendations.push('Event loop lag detected - consider using worker threads for CPU-intensive tasks');
    }

    // Bottleneck recommendations
    if (data.bottlenecks.length > 5) {
      recommendations.push('Multiple bottlenecks detected - prioritize optimization of critical path operations');
    }

    // Trend recommendations
    if (data.trends.memoryTrend === 'increasing') {
      recommendations.push('Memory usage trend is increasing - check for memory leaks');
    }

    // Regression recommendations
    if (data.regressions.length > 0) {
      recommendations.push('Performance regressions detected - review recent changes and optimizations');
    }

    return recommendations;
  }
}

/**
 * Factory function to create a performance monitor
 */
export function createPerformanceMonitor(config: Partial<PerformanceMonitorConfig> = {}): PerformanceMonitor {
  return new PerformanceMonitor(config);
}