/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Profiling and Hotspot Analysis for Large Codebases
 *
 * Provides real-time performance profiling, hotspot detection, bottleneck analysis,
 * and automated optimization recommendations for CSS processing workflows.
 */

import { EventEmitter } from 'events';
import { cpus } from 'os';
import { performance, PerformanceObserver } from 'perf_hooks';

/**
 * Profiling metric types
 */
export enum MetricType {
  CPU_TIME = 'cpu_time',
  MEMORY_USAGE = 'memory_usage',
  IO_OPERATIONS = 'io_operations',
  FUNCTION_CALLS = 'function_calls',
  ASYNC_OPERATIONS = 'async_operations',
  GC_EVENTS = 'gc_events',
  EVENT_LOOP_LAG = 'event_loop_lag',
}

/**
 * Hotspot severity levels
 */
export enum HotspotSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Performance measurement data
 */
export interface PerformanceMeasurement {
  id: string;
  name: string;
  type: MetricType;
  startTime: number;
  endTime: number;
  duration: number;
  cpuUsage?: number;
  memoryDelta?: number;
  metadata: Record<string, any>;
  stackTrace?: string[];
}

/**
 * Hotspot detection result
 */
export interface Hotspot {
  id: string;
  name: string;
  type: MetricType;
  severity: HotspotSeverity;
  frequency: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
  stdDeviation: number;
  impact: number; // 0-1 scale
  location: {
    file?: string;
    function?: string;
    line?: number;
  };
  recommendations: string[];
  relatedHotspots: string[];
}

/**
 * Profiling session configuration
 */
export interface ProfilingConfig {
  // Sampling configuration
  sampleInterval: number; // milliseconds
  maxSamples: number;
  enableStackTraces: boolean;
  stackTraceDepth: number;

  // Measurement tracking
  trackCPU: boolean;
  trackMemory: boolean;
  trackIO: boolean;
  trackAsyncOps: boolean;
  trackGC: boolean;
  trackEventLoop: boolean;

  // Hotspot detection
  hotspotThreshold: number; // milliseconds
  hotspotFrequencyThreshold: number;
  enableHotspotDetection: boolean;
  hotspotAnalysisInterval: number; // milliseconds

  // Performance optimization
  enableAutoOptimization: boolean;
  optimizationThreshold: number; // 0-1 impact scale
  enableRecommendations: boolean;

  // Reporting
  enableRealTimeReporting: boolean;
  reportingInterval: number; // milliseconds
  maxReportHistory: number;
}

/**
 * Profiling session statistics
 */
export interface ProfilingStats {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalMeasurements: number;
  totalHotspots: number;
  criticalHotspots: number;
  averageCPU: number;
  peakMemory: number;
  totalGCTime: number;
  eventLoopLag: number;
  recommendations: string[];
}

/**
 * Performance report
 */
export interface PerformanceReport {
  sessionId: string;
  timestamp: Date;
  summary: ProfilingStats;
  topHotspots: Hotspot[];
  measurements: PerformanceMeasurement[];
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    loadAverage: number[];
  };
  optimizationOpportunities: Array<{
    type: string;
    description: string;
    potentialGain: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}

/**
 * Function profiling decorator metadata
 */
interface FunctionProfile {
  name: string;
  callCount: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
  measurements: number[];
}

/**
 * Advanced profiling and hotspot analyzer
 */
export class ProfilingAnalyzer extends EventEmitter {
  private readonly config: ProfilingConfig;
  private readonly measurements: Map<string, PerformanceMeasurement> = new Map();
  private readonly hotspots: Map<string, Hotspot> = new Map();
  private readonly functionProfiles: Map<string, FunctionProfile> = new Map();

  private sessionId: string;
  private sessionStartTime: Date;
  private isActive = false;
  private measurementCounter = 0;

  private sampleTimer: NodeJS.Timeout | null = null;
  private hotspotTimer: NodeJS.Timeout | null = null;
  private reportTimer: NodeJS.Timeout | null = null;

  private performanceObserver: PerformanceObserver | null = null;
  private gcObserver: PerformanceObserver | null = null;

  private stats: ProfilingStats;

  constructor(config: Partial<ProfilingConfig> = {}) {
    super();

    this.config = {
      sampleInterval: 100, // 100ms
      maxSamples: 10000,
      enableStackTraces: true,
      stackTraceDepth: 10,
      trackCPU: true,
      trackMemory: true,
      trackIO: true,
      trackAsyncOps: true,
      trackGC: true,
      trackEventLoop: true,
      hotspotThreshold: 10, // 10ms
      hotspotFrequencyThreshold: 5,
      enableHotspotDetection: true,
      hotspotAnalysisInterval: 5000, // 5 seconds
      enableAutoOptimization: false,
      optimizationThreshold: 0.1,
      enableRecommendations: true,
      enableRealTimeReporting: true,
      reportingInterval: 30000, // 30 seconds
      maxReportHistory: 100,
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();
    this.initializeStats();
  }

  /**
   * Start profiling session
   */
  async startProfiling(): Promise<void> {
    if (this.isActive) {
      throw new Error('Profiling session already active');
    }

    this.isActive = true;
    this.sessionStartTime = new Date();
    this.measurementCounter = 0;

    // Initialize performance observers
    await this.initializeObservers();

    // Start timers
    this.startSampling();

    if (this.config.enableHotspotDetection) {
      this.startHotspotAnalysis();
    }

    if (this.config.enableRealTimeReporting) {
      this.startReporting();
    }

    this.emit('profilingStarted', { sessionId: this.sessionId });
  }

  /**
   * Stop profiling session
   */
  async stopProfiling(): Promise<PerformanceReport> {
    if (!this.isActive) {
      throw new Error('No active profiling session');
    }

    this.isActive = false;

    // Stop timers
    this.stopTimers();

    // Stop observers
    this.stopObservers();

    // Final analysis
    const finalReport = await this.generateReport();

    this.emit('profilingStopped', { sessionId: this.sessionId, report: finalReport });

    return finalReport;
  }

  /**
   * Start measuring a specific operation
   */
  startMeasurement(name: string, type: MetricType, metadata: Record<string, any> = {}): string {
    const measurementId = `${this.sessionId}-${this.measurementCounter++}`;
    const startTime = performance.now();

    const measurement: PerformanceMeasurement = {
      id: measurementId,
      name,
      type,
      startTime,
      endTime: 0,
      duration: 0,
      metadata,
    };

    // Capture stack trace if enabled
    if (this.config.enableStackTraces) {
      measurement.stackTrace = this.captureStackTrace();
    }

    this.measurements.set(measurementId, measurement);

    return measurementId;
  }

  /**
   * End a measurement
   */
  endMeasurement(measurementId: string): PerformanceMeasurement | null {
    const measurement = this.measurements.get(measurementId);
    if (!measurement) {
      return null;
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    // Add memory delta if tracking
    if (this.config.trackMemory) {
      measurement.memoryDelta = this.getMemoryDelta();
    }

    // Update function profile
    this.updateFunctionProfile(measurement);

    // Check for hotspot
    if (
      this.config.enableHotspotDetection &&
      measurement.duration >= this.config.hotspotThreshold
    ) {
      this.analyzeForHotspot(measurement);
    }

    this.emit('measurementCompleted', measurement);

    return measurement;
  }

  /**
   * Measure a function execution
   */
  async measureFunction<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const measurementId = this.startMeasurement(name, MetricType.FUNCTION_CALLS, metadata);

    try {
      const result = await fn();
      return result;
    } finally {
      this.endMeasurement(measurementId);
    }
  }

  /**
   * Get current hotspots
   */
  getHotspots(severity?: HotspotSeverity): Hotspot[] {
    let hotspots = Array.from(this.hotspots.values());

    if (severity) {
      hotspots = hotspots.filter((h) => h.severity === severity);
    }

    return hotspots.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Get profiling statistics
   */
  getStats(): ProfilingStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(): Promise<PerformanceReport> {
    const stats = this.getStats();
    const topHotspots = this.getHotspots().slice(0, 10);
    const recentMeasurements = Array.from(this.measurements.values()).slice(-100);

    const systemMetrics = {
      cpuUsage: await this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      loadAverage: cpus().length > 0 ? [0.5, 0.3, 0.2] : [], // Simplified load average
    };

    const optimizationOpportunities = this.generateOptimizationOpportunities(topHotspots);

    return {
      sessionId: this.sessionId,
      timestamp: new Date(),
      summary: stats,
      topHotspots,
      measurements: recentMeasurements,
      systemMetrics,
      optimizationOpportunities,
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const criticalHotspots = this.getHotspots(HotspotSeverity.CRITICAL);

    for (const hotspot of criticalHotspots) {
      recommendations.push(...hotspot.recommendations);
    }

    // Add general recommendations based on patterns
    if (this.stats.totalGCTime > 1000) {
      recommendations.push('Consider reducing memory allocations to minimize GC pressure');
    }

    if (this.stats.eventLoopLag > 100) {
      recommendations.push('Break down CPU-intensive operations to avoid blocking event loop');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Clear profiling data
   */
  clearData(): void {
    this.measurements.clear();
    this.hotspots.clear();
    this.functionProfiles.clear();
    this.initializeStats();
    this.emit('dataCleared');
  }

  private async initializeObservers(): Promise<void> {
    // Performance observer for measuring function calls
    if (this.config.trackAsyncOps || this.config.trackIO) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          this.processPerformanceEntry(entry);
        }
      });

      this.performanceObserver.observe({
        entryTypes: ['measure', 'navigation', 'resource'],
      });
    }

    // GC observer
    if (this.config.trackGC) {
      try {
        this.gcObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            this.processGCEntry(entry);
          }
        });

        this.gcObserver.observe({ entryTypes: ['gc'] });
      } catch (error) {
        // GC observation might not be available
        console.warn('GC observation not available:', error);
      }
    }
  }

  private stopObservers(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = null;
    }
  }

  private startSampling(): void {
    this.sampleTimer = setInterval(() => {
      if (this.isActive) {
        this.takeSample();
      }
    }, this.config.sampleInterval);
  }

  private startHotspotAnalysis(): void {
    this.hotspotTimer = setInterval(() => {
      if (this.isActive) {
        this.analyzeHotspots();
      }
    }, this.config.hotspotAnalysisInterval);
  }

  private startReporting(): void {
    this.reportTimer = setInterval(async () => {
      if (this.isActive) {
        const report = await this.generateReport();
        this.emit('report', report);
      }
    }, this.config.reportingInterval);
  }

  private stopTimers(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }

    if (this.hotspotTimer) {
      clearInterval(this.hotspotTimer);
      this.hotspotTimer = null;
    }

    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  private takeSample(): void {
    // Sample current system metrics
    const measurementId = this.startMeasurement('system_sample', MetricType.CPU_TIME, {
      sampling: true,
    });

    // Simulate sampling work
    setImmediate(() => {
      this.endMeasurement(measurementId);
    });
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    const measurement: PerformanceMeasurement = {
      id: `perf-${Date.now()}-${Math.random()}`,
      name: entry.name,
      type: this.getMetricTypeFromEntry(entry),
      startTime: entry.startTime,
      endTime: entry.startTime + entry.duration,
      duration: entry.duration,
      metadata: {
        entryType: entry.entryType,
        detail: entry.detail || {},
      },
    };

    this.measurements.set(measurement.id, measurement);
    this.updateFunctionProfile(measurement);
  }

  private processGCEntry(entry: PerformanceEntry): void {
    const measurement: PerformanceMeasurement = {
      id: `gc-${Date.now()}-${Math.random()}`,
      name: 'garbage_collection',
      type: MetricType.GC_EVENTS,
      startTime: entry.startTime,
      endTime: entry.startTime + entry.duration,
      duration: entry.duration,
      metadata: {
        kind: (entry as any).kind || 'unknown',
      },
    };

    this.measurements.set(measurement.id, measurement);
    this.stats.totalGCTime += entry.duration;
  }

  private getMetricTypeFromEntry(entry: PerformanceEntry): MetricType {
    switch (entry.entryType) {
      case 'measure':
        return MetricType.FUNCTION_CALLS;
      case 'navigation':
        return MetricType.IO_OPERATIONS;
      case 'resource':
        return MetricType.IO_OPERATIONS;
      default:
        return MetricType.ASYNC_OPERATIONS;
    }
  }

  private updateFunctionProfile(measurement: PerformanceMeasurement): void {
    const profile = this.functionProfiles.get(measurement.name) || {
      name: measurement.name,
      callCount: 0,
      totalTime: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: Infinity,
      measurements: [],
    };

    profile.callCount++;
    profile.totalTime += measurement.duration;
    profile.averageTime = profile.totalTime / profile.callCount;
    profile.maxTime = Math.max(profile.maxTime, measurement.duration);
    profile.minTime = Math.min(profile.minTime, measurement.duration);

    // Keep only recent measurements for standard deviation calculation
    profile.measurements.push(measurement.duration);
    if (profile.measurements.length > 100) {
      profile.measurements.shift();
    }

    this.functionProfiles.set(measurement.name, profile);
  }

  private analyzeForHotspot(measurement: PerformanceMeasurement): void {
    const hotspotId = `hotspot-${measurement.name}-${measurement.type}`;
    const existingHotspot = this.hotspots.get(hotspotId);

    if (existingHotspot) {
      // Update existing hotspot
      existingHotspot.frequency++;
      existingHotspot.totalTime += measurement.duration;
      existingHotspot.averageTime = existingHotspot.totalTime / existingHotspot.frequency;
      existingHotspot.maxTime = Math.max(existingHotspot.maxTime, measurement.duration);
      existingHotspot.minTime = Math.min(existingHotspot.minTime, measurement.duration);

      // Recalculate severity and impact
      this.updateHotspotSeverity(existingHotspot);
    } else {
      // Create new hotspot
      const hotspot: Hotspot = {
        id: hotspotId,
        name: measurement.name,
        type: measurement.type,
        severity: this.calculateSeverity(measurement.duration),
        frequency: 1,
        totalTime: measurement.duration,
        averageTime: measurement.duration,
        maxTime: measurement.duration,
        minTime: measurement.duration,
        stdDeviation: 0,
        impact: this.calculateImpact(measurement.duration, 1),
        location: this.extractLocation(measurement),
        recommendations: this.generateRecommendations(measurement),
        relatedHotspots: [],
      };

      this.hotspots.set(hotspotId, hotspot);
    }
  }

  private analyzeHotspots(): void {
    for (const hotspot of this.hotspots.values()) {
      // Update standard deviation
      const profile = this.functionProfiles.get(hotspot.name);
      if (profile && profile.measurements.length > 1) {
        hotspot.stdDeviation = this.calculateStandardDeviation(profile.measurements);
      }

      // Update severity based on current metrics
      this.updateHotspotSeverity(hotspot);

      // Find related hotspots
      hotspot.relatedHotspots = this.findRelatedHotspots(hotspot);
    }

    this.emit('hotspotsAnalyzed', { count: this.hotspots.size });
  }

  private updateHotspotSeverity(hotspot: Hotspot): void {
    hotspot.impact = this.calculateImpact(hotspot.totalTime, hotspot.frequency);
    hotspot.severity = this.calculateSeverityFromImpact(hotspot.impact);
  }

  private calculateSeverity(duration: number): HotspotSeverity {
    if (duration >= 1000) return HotspotSeverity.CRITICAL;
    if (duration >= 100) return HotspotSeverity.HIGH;
    if (duration >= 50) return HotspotSeverity.MEDIUM;
    return HotspotSeverity.LOW;
  }

  private calculateSeverityFromImpact(impact: number): HotspotSeverity {
    if (impact >= 0.8) return HotspotSeverity.CRITICAL;
    if (impact >= 0.5) return HotspotSeverity.HIGH;
    if (impact >= 0.2) return HotspotSeverity.MEDIUM;
    return HotspotSeverity.LOW;
  }

  private calculateImpact(totalTime: number, frequency: number): number {
    // Impact is based on total time spent and frequency of occurrence
    const timeWeight = Math.min(totalTime / 10000, 1); // Normalize to 0-1
    const frequencyWeight = Math.min(frequency / 100, 1); // Normalize to 0-1
    return timeWeight * 0.7 + frequencyWeight * 0.3;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(variance);
  }

  private extractLocation(measurement: PerformanceMeasurement): Hotspot['location'] {
    // Extract location information from stack trace
    if (measurement.stackTrace && measurement.stackTrace.length > 0) {
      const topFrame = measurement.stackTrace[0];
      const match = topFrame.match(/at (.+) \((.+):(\d+):\d+\)/);

      if (match) {
        return {
          function: match[1],
          file: match[2],
          line: parseInt(match[3], 10),
        };
      }
    }

    return {};
  }

  private generateRecommendations(measurement: PerformanceMeasurement): string[] {
    const recommendations: string[] = [];

    switch (measurement.type) {
      case MetricType.CPU_TIME:
        recommendations.push('Consider async processing or worker threads');
        recommendations.push('Profile CPU-intensive algorithms for optimization');
        break;
      case MetricType.MEMORY_USAGE:
        recommendations.push('Review memory allocation patterns');
        recommendations.push('Consider object pooling for frequent allocations');
        break;
      case MetricType.IO_OPERATIONS:
        recommendations.push('Implement caching for frequently accessed data');
        recommendations.push('Consider batch processing for multiple I/O operations');
        break;
      case MetricType.FUNCTION_CALLS:
        recommendations.push('Analyze function complexity and consider refactoring');
        recommendations.push('Look for opportunities to memoize results');
        break;
      default:
        recommendations.push('Monitor this operation for patterns');
    }

    return recommendations;
  }

  private findRelatedHotspots(hotspot: Hotspot): string[] {
    const related: string[] = [];

    for (const [id, other] of this.hotspots) {
      if (id === hotspot.id) continue;

      // Check for name similarity or type matching
      if (
        other.type === hotspot.type ||
        other.name.includes(hotspot.name) ||
        hotspot.name.includes(other.name)
      ) {
        related.push(id);
      }
    }

    return related.slice(0, 5); // Limit to 5 related hotspots
  }

  private generateOptimizationOpportunities(hotspots: Hotspot[]): Array<{
    type: string;
    description: string;
    potentialGain: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }> {
    const opportunities: Array<{
      type: string;
      description: string;
      potentialGain: number;
      difficulty: 'easy' | 'medium' | 'hard';
    }> = [];

    for (const hotspot of hotspots.slice(0, 5)) {
      let difficulty: 'easy' | 'medium' | 'hard' = 'medium';

      if (hotspot.type === MetricType.IO_OPERATIONS) {
        difficulty = 'easy';
      } else if (hotspot.type === MetricType.CPU_TIME) {
        difficulty = 'hard';
      }

      opportunities.push({
        type: hotspot.type,
        description: `Optimize ${hotspot.name} (${hotspot.severity} impact)`,
        potentialGain: hotspot.impact,
        difficulty,
      });
    }

    return opportunities;
  }

  private captureStackTrace(): string[] {
    const stack = new Error().stack;
    if (!stack) return [];

    return stack
      .split('\n')
      .slice(2, 2 + this.config.stackTraceDepth) // Skip Error and current function
      .map((line) => line.trim());
  }

  private async getCPUUsage(): Promise<number> {
    // Simplified CPU usage calculation
    return Math.random() * 100; // Placeholder
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed / memUsage.heapTotal;
  }

  private getMemoryDelta(): number {
    // Simplified memory delta calculation
    return Math.random() * 1024 * 1024; // Placeholder
  }

  private updateStats(): void {
    this.stats.totalMeasurements = this.measurements.size;
    this.stats.totalHotspots = this.hotspots.size;
    this.stats.criticalHotspots = this.getHotspots(HotspotSeverity.CRITICAL).length;
    this.stats.recommendations = this.getRecommendations();

    // Calculate averages
    const cpuMeasurements = Array.from(this.measurements.values()).filter(
      (m) => m.type === MetricType.CPU_TIME
    );

    if (cpuMeasurements.length > 0) {
      this.stats.averageCPU =
        cpuMeasurements.reduce((sum, m) => sum + m.duration, 0) / cpuMeasurements.length;
    }
  }

  private initializeStats(): void {
    this.stats = {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      totalMeasurements: 0,
      totalHotspots: 0,
      criticalHotspots: 0,
      averageCPU: 0,
      peakMemory: 0,
      totalGCTime: 0,
      eventLoopLag: 0,
      recommendations: [],
    };
  }

  private generateSessionId(): string {
    return `prof-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Profiling decorator for automatic function measurement
 */
export function profile(
  analyzer: ProfilingAnalyzer,
  metricType: MetricType = MetricType.FUNCTION_CALLS
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const measurementId = analyzer.startMeasurement(
        `${target.constructor.name}.${propertyName}`,
        metricType,
        { args: args.length }
      );

      try {
        const result = await method.apply(this, args);
        return result;
      } finally {
        analyzer.endMeasurement(measurementId);
      }
    };

    return descriptor;
  };
}

/**
 * Factory for creating profiling analyzers
 */
export class ProfilingAnalyzerFactory {
  /**
   * Create analyzer for production monitoring
   */
  static createProductionAnalyzer(): ProfilingAnalyzer {
    return new ProfilingAnalyzer({
      sampleInterval: 1000, // 1 second
      enableStackTraces: false,
      trackGC: true,
      trackEventLoop: true,
      hotspotThreshold: 100, // 100ms
      enableRealTimeReporting: true,
      reportingInterval: 60000, // 1 minute
    });
  }

  /**
   * Create analyzer for development profiling
   */
  static createDevelopmentAnalyzer(): ProfilingAnalyzer {
    return new ProfilingAnalyzer({
      sampleInterval: 100, // 100ms
      enableStackTraces: true,
      stackTraceDepth: 20,
      trackCPU: true,
      trackMemory: true,
      trackIO: true,
      hotspotThreshold: 10, // 10ms
      enableHotspotDetection: true,
      enableRecommendations: true,
    });
  }

  /**
   * Create analyzer for performance testing
   */
  static createPerformanceTestAnalyzer(): ProfilingAnalyzer {
    return new ProfilingAnalyzer({
      sampleInterval: 50, // 50ms
      enableStackTraces: true,
      trackCPU: true,
      trackMemory: true,
      hotspotThreshold: 5, // 5ms
      enableAutoOptimization: false,
      enableRealTimeReporting: false,
    });
  }
}
