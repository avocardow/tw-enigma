/**
 * TW-Enigma Benchmark Profiling Integration
 *
 * Integrates profiling tools to capture resource usage (CPU, memory, I/O) during benchmarks.
 * Automates identification of performance bottlenecks and correlates with benchmark results.
 * Supports exporting profiling data for further analysis.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import { PerformanceMonitor } from '../../optimization/performanceMonitor';
import { ProfilingAnalyzer } from '../../optimization/profilingAnalyzer';
import { PerformanceProfiler } from '../../performance/profiler';
import { createLogger } from '../../utils/logger';
import type {
  BenchmarkContext,
  PerformanceProfiler as IPerformanceProfiler,
  PerformanceAnalysis,
  ProfilerData,
} from '../types';

const logger = createLogger('BenchmarkProfiler');

/**
 * Profiling configuration for benchmarks
 */
export interface BenchmarkProfilingConfig {
  enabled: boolean;
  captureSystemMetrics: boolean;
  captureMemorySnapshots: boolean;
  captureCPUProfile: boolean;
  captureIOMetrics: boolean;
  captureGCEvents: boolean;
  captureEventLoopLag: boolean;
  captureStackTraces: boolean;
  sampleInterval: number;
  maxSamples: number;
  exportFormats: ('json' | 'flamegraph' | 'csv')[];
  outputDirectory: string;
  enableBottleneckDetection: boolean;
  bottleneckThreshold: number;
  enableRealTimeAnalysis: boolean;
  retainRawData: boolean;
}

/**
 * Comprehensive profiling data for benchmark runs
 */
export interface BenchmarkProfilingData extends ProfilerData {
  benchmarkName: string;
  benchmarkId: string;
  iteration: number;
  startTime: number;
  endTime: number;
  systemMetrics: {
    cpuUsage: number[];
    memoryUsage: number[];
    ioOperations: number[];
    gcEvents: GCEvent[];
    eventLoopLag: number[];
    loadAverage: number[];
  };
  resourceSnapshots: ResourceSnapshot[];
  bottlenecks: PerformanceBottleneck[];
  hotspots: Hotspot[];
  callStacks: CallStack[];
  correlations: PerformanceCorrelation[];
}

/**
 * Performance bottleneck detected during benchmark
 */
export interface PerformanceBottleneck {
  operation: string;
  function: string;
  duration: number;
  frequency: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  severity: number;
  description: string;
  recommendations: string[];
  stackTrace?: string[];
  correlatedMetrics: Record<string, number>;
}

/**
 * Performance hotspot identification
 */
export interface Hotspot {
  name: string;
  totalTime: number;
  selfTime: number;
  callCount: number;
  averageTime: number;
  location: {
    file?: string;
    line?: number;
    column?: number;
  };
  callers: string[];
  callees: string[];
}

/**
 * Call stack frame information
 */
export interface CallStack {
  timestamp: number;
  frames: StackFrame[];
  duration: number;
  context: Record<string, any>;
}

export interface StackFrame {
  function: string;
  file: string;
  line: number;
  column: number;
}

/**
 * System resource snapshot
 */
export interface ResourceSnapshot {
  timestamp: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
    percent: number;
  };
  io: {
    readBytes: number;
    writeBytes: number;
    readOperations: number;
    writeOperations: number;
  };
  gc: GCEvent[];
  eventLoop: {
    lag: number;
    utilization: number;
  };
}

/**
 * Garbage collection event
 */
export interface GCEvent {
  type: string;
  startTime: number;
  duration: number;
  beforeSize: number;
  afterSize: number;
  freedBytes: number;
}

/**
 * Performance correlation analysis
 */
export interface PerformanceCorrelation {
  metric1: string;
  metric2: string;
  correlation: number;
  significance: number;
  description: string;
}

/**
 * Benchmark profiler that integrates with various profiling tools
 */
export class BenchmarkProfiler extends EventEmitter implements IPerformanceProfiler {
  public readonly name = 'BenchmarkProfiler';
  public enabled = true;

  private config: BenchmarkProfilingConfig;
  private profiler: PerformanceProfiler;
  private analyzer: ProfilingAnalyzer;
  private monitor: PerformanceMonitor;

  private currentSession?: string;
  private profilingData: Map<string, BenchmarkProfilingData> = new Map();
  private performanceObserver?: PerformanceObserver;
  private gcObserver?: PerformanceObserver;
  private samplingInterval?: NodeJS.Timeout;

  private resourceSnapshots: ResourceSnapshot[] = [];
  private bottlenecks: PerformanceBottleneck[] = [];
  private callStacks: CallStack[] = [];

  constructor(config: Partial<BenchmarkProfilingConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      captureSystemMetrics: true,
      captureMemorySnapshots: true,
      captureCPUProfile: true,
      captureIOMetrics: true,
      captureGCEvents: true,
      captureEventLoopLag: true,
      captureStackTraces: false, // Expensive operation
      sampleInterval: 100, // 100ms
      maxSamples: 10000,
      exportFormats: ['json', 'csv'],
      outputDirectory: './profiling-reports',
      enableBottleneckDetection: true,
      bottleneckThreshold: 10, // 10ms
      enableRealTimeAnalysis: true,
      retainRawData: true,
      ...config,
    };

    // Initialize profiling components
    this.profiler = new PerformanceProfiler({
      enabled: this.config.enabled,
      sampleInterval: this.config.sampleInterval,
      enableMemoryProfiling: this.config.captureMemorySnapshots,
      enableCPUProfiling: this.config.captureCPUProfile,
      outputDirectory: this.config.outputDirectory,
    });

    this.analyzer = new ProfilingAnalyzer({
      sampleInterval: this.config.sampleInterval,
      enableStackTraces: this.config.captureStackTraces,
      trackCPU: this.config.captureCPUProfile,
      trackMemory: this.config.captureMemorySnapshots,
      trackIO: this.config.captureIOMetrics,
      trackGC: this.config.captureGCEvents,
      enableHotspotDetection: this.config.enableBottleneckDetection,
      hotspotThreshold: this.config.bottleneckThreshold,
    });

    this.monitor = new PerformanceMonitor({
      sampleInterval: this.config.sampleInterval,
    });

    this.setupObservers();
    this.setupEventHandlers();

    logger.info('BenchmarkProfiler initialized', {
      enabled: this.config.enabled,
      sampleInterval: this.config.sampleInterval,
      outputDirectory: this.config.outputDirectory,
    });
  }

  /**
   * Start profiling for a benchmark
   */
  async start(context: BenchmarkContext): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('Profiling disabled, skipping start');
      return;
    }

    const benchmarkId = this.generateBenchmarkId(context);
    this.currentSession = benchmarkId;

    logger.info('Starting benchmark profiling', {
      benchmarkId,
      benchmarkName: context.config?.name || 'unknown',
    });

    // Initialize profiling data structure
    const profilingData: BenchmarkProfilingData = {
      benchmarkName: context.config?.name || 'unknown',
      benchmarkId,
      iteration: context.iteration || 0,
      timestamp: Date.now(),
      duration: 0,
      startTime: performance.now(),
      endTime: 0,
      systemMetrics: {
        cpuUsage: [],
        memoryUsage: [],
        ioOperations: [],
        gcEvents: [],
        eventLoopLag: [],
        loadAverage: [],
      },
      resourceSnapshots: [],
      bottlenecks: [],
      hotspots: [],
      callStacks: [],
      correlations: [],
    };

    this.profilingData.set(benchmarkId, profilingData);

    // Start profiling components
    await Promise.all([
      this.profiler.startSession(),
      this.analyzer.startProfiling(),
      this.monitor.startSession('benchmark-profiling'),
    ]);

    // Start system monitoring
    if (this.config.captureSystemMetrics) {
      this.startSystemMonitoring();
    }

    // Start observers
    this.enableObservers();

    this.emit('profiler-started', { profiler: this, benchmarkName: context.config?.name });
  }

  /**
   * Stop profiling and return collected data
   */
  async stop(context: BenchmarkContext): Promise<ProfilerData> {
    if (!this.config.enabled || !this.currentSession) {
      logger.debug('No active profiling session to stop');
      return {} as ProfilerData;
    }

    const benchmarkId = this.currentSession;
    const profilingData = this.profilingData.get(benchmarkId);

    if (!profilingData) {
      throw new Error(`No profiling data found for benchmark ${benchmarkId}`);
    }

    logger.info('Stopping benchmark profiling', {
      benchmarkId,
      duration: performance.now() - profilingData.startTime,
    });

    // Update timing
    profilingData.endTime = performance.now();
    profilingData.duration = profilingData.endTime - profilingData.startTime;

    // Stop system monitoring
    this.stopSystemMonitoring();

    // Disable observers
    this.disableObservers();

    // Stop profiling components and collect data
    const [profilerAnalysis, analyzerReport] = await Promise.all([
      this.profiler.stopSession(),
      this.analyzer.stopProfiling(),
      this.monitor.stopSession(),
    ]);

    // Consolidate profiling data
    if (profilerAnalysis) {
      profilingData.bottlenecks.push(...this.convertToBottlenecks(profilerAnalysis.bottlenecks));
    }

    if (analyzerReport) {
      profilingData.hotspots.push(...this.convertToHotspots(analyzerReport.topHotspots));
    }

    // Add final resource snapshots
    profilingData.resourceSnapshots = this.resourceSnapshots;
    profilingData.callStacks = this.callStacks;

    // Perform correlation analysis
    if (this.config.enableRealTimeAnalysis) {
      profilingData.correlations = this.performCorrelationAnalysis(profilingData);
    }

    // Export profiling data
    if (this.config.exportFormats.length > 0) {
      await this.exportProfilingData(profilingData);
    }

    this.emit('profiler-stopped', { profiler: this, data: profilingData });

    this.currentSession = undefined;
    return profilingData;
  }

  /**
   * Analyze collected profiling data
   */
  analyze(data: ProfilerData[]): PerformanceAnalysis {
    if (!Array.isArray(data) || data.length === 0) {
      return this.createEmptyAnalysis();
    }

    logger.info('Analyzing profiling data', { dataPoints: data.length });

    const benchmarkData = data.filter((d) => 'benchmarkName' in d) as BenchmarkProfilingData[];

    // Aggregate metrics across all benchmark runs
    const aggregatedMetrics = this.aggregateMetrics(benchmarkData);

    // Identify cross-benchmark bottlenecks
    const globalBottlenecks = this.identifyGlobalBottlenecks(benchmarkData);

    // Calculate performance trends
    const trends = this.calculateTrends(benchmarkData);

    // Generate recommendations
    const recommendations = this.generateRecommendations(aggregatedMetrics, globalBottlenecks);

    return {
      summary: {
        totalDuration: aggregatedMetrics.totalDuration,
        operationCount: aggregatedMetrics.operationCount,
        averageOperationTime: aggregatedMetrics.averageOperationTime,
        peakMemoryUsage: aggregatedMetrics.peakMemoryUsage,
        peakCpuUsage: aggregatedMetrics.peakCpuUsage,
        gcPressure: aggregatedMetrics.gcPressure,
        eventLoopLag: aggregatedMetrics.eventLoopLag,
      },
      bottlenecks: globalBottlenecks.map((b) => ({
        operation: b.operation,
        duration: b.duration,
        frequency: b.frequency,
        impact: b.impact,
        recommendations: b.recommendations,
      })),
      trends,
      recommendations,
    };
  }

  /**
   * Export profiling data to various formats
   */
  private async exportProfilingData(data: BenchmarkProfilingData): Promise<void> {
    const baseFilename = `benchmark-profile-${data.benchmarkId}-${Date.now()}`;
    const outputDir = this.config.outputDirectory;

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    for (const format of this.config.exportFormats) {
      try {
        const outputPath = path.join(outputDir, `${baseFilename}.${format}`);

        switch (format) {
          case 'json':
            await this.exportJSON(data, outputPath);
            break;
          case 'csv':
            await this.exportCSV(data, outputPath);
            break;
          case 'flamegraph':
            await this.exportFlamegraph(data, outputPath);
            break;
        }

        logger.info(`Profiling data exported`, { format, path: outputPath });
      } catch (error) {
        logger.error(`Failed to export profiling data in ${format} format`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Export profiling data as JSON
   */
  private async exportJSON(data: BenchmarkProfilingData, outputPath: string): Promise<void> {
    const jsonData = {
      ...data,
      exportTime: new Date().toISOString(),
      version: '1.0.0',
    };

    await fs.writeFile(outputPath, JSON.stringify(jsonData, null, 2));
  }

  /**
   * Export profiling data as CSV
   */
  private async exportCSV(data: BenchmarkProfilingData, outputPath: string): Promise<void> {
    const headers = [
      'Timestamp',
      'Operation',
      'Duration',
      'Memory (MB)',
      'CPU (%)',
      'IO Operations',
      'GC Events',
    ];

    const rows = data.resourceSnapshots.map((snapshot) => [
      snapshot.timestamp,
      'resource-snapshot',
      '-',
      (snapshot.memory.heapUsed / 1024 / 1024).toFixed(2),
      snapshot.cpu.percent.toFixed(2),
      snapshot.io.readOperations + snapshot.io.writeOperations,
      snapshot.gc.length,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    await fs.writeFile(outputPath, csvContent);
  }

  /**
   * Export profiling data as flame graph
   */
  private async exportFlamegraph(data: BenchmarkProfilingData, outputPath: string): Promise<void> {
    // Simplified flame graph format - in real implementation would use proper flame graph library
    const flamegraphData = data.callStacks.map((stack) => ({
      name: stack.frames.map((f) => f.function).join(';'),
      value: stack.duration,
      timestamp: stack.timestamp,
    }));

    await fs.writeFile(
      outputPath.replace('.flamegraph', '.json'),
      JSON.stringify(flamegraphData, null, 2)
    );
  }

  /**
   * Setup performance observers
   */
  private setupObservers(): void {
    // Performance observer for general performance entries
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processPerformanceEntry(entry);
      }
    });

    // GC observer
    if (this.config.captureGCEvents) {
      this.gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processGCEntry(entry);
        }
      });
    }
  }

  /**
   * Setup event handlers for profiling components
   */
  private setupEventHandlers(): void {
    this.profiler.on('bottleneckDetected', (data) => {
      this.handleBottleneckDetected(data);
    });

    this.analyzer.on('hotspotDetected', (data) => {
      this.handleHotspotDetected(data);
    });

    this.monitor.on('performanceRegression', (data) => {
      this.handlePerformanceRegression(data);
    });
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    this.samplingInterval = setInterval(() => {
      this.captureResourceSnapshot();
    }, this.config.sampleInterval);
  }

  /**
   * Stop system monitoring
   */
  private stopSystemMonitoring(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = undefined;
    }
  }

  /**
   * Enable performance observers
   */
  private enableObservers(): void {
    try {
      this.performanceObserver?.observe({ entryTypes: ['measure', 'mark', 'function'] });
      this.gcObserver?.observe({ entryTypes: ['gc'] });
    } catch (error) {
      logger.warn('Failed to enable performance observers', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Disable performance observers
   */
  private disableObservers(): void {
    this.performanceObserver?.disconnect();
    this.gcObserver?.disconnect();
  }

  /**
   * Capture current resource snapshot
   */
  private captureResourceSnapshot(): void {
    const now = performance.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const snapshot: ResourceSnapshot = {
      timestamp: now,
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user / 1000, // Convert to ms
        system: cpuUsage.system / 1000,
        percent: this.calculateCPUPercent(cpuUsage),
      },
      io: {
        readBytes: 0, // Would need additional monitoring
        writeBytes: 0,
        readOperations: 0,
        writeOperations: 0,
      },
      gc: [], // Populated by GC observer
      eventLoop: {
        lag: this.measureEventLoopLag(),
        utilization: 0, // Would need additional monitoring
      },
    };

    this.resourceSnapshots.push(snapshot);

    // Limit snapshot history
    if (this.resourceSnapshots.length > this.config.maxSamples) {
      this.resourceSnapshots.shift();
    }
  }

  /**
   * Process performance entry from observer
   */
  private processPerformanceEntry(entry: PerformanceEntry): void {
    if (!this.currentSession) return;

    const data = this.profilingData.get(this.currentSession);
    if (!data) return;

    // Check for bottlenecks
    if (this.config.enableBottleneckDetection && entry.duration > this.config.bottleneckThreshold) {
      const bottleneck: PerformanceBottleneck = {
        operation: entry.name,
        function: entry.name,
        duration: entry.duration,
        frequency: 1,
        impact: this.classifyImpact(entry.duration),
        severity: entry.duration / this.config.bottleneckThreshold,
        description: `Operation ${entry.name} took ${entry.duration.toFixed(2)}ms`,
        recommendations: this.generateBottleneckRecommendations(entry.name, entry.duration),
        correlatedMetrics: {
          duration: entry.duration,
          startTime: entry.startTime,
        },
      };

      data.bottlenecks.push(bottleneck);
    }
  }

  /**
   * Process GC entry from observer
   */
  private processGCEntry(entry: PerformanceEntry): void {
    if (!this.currentSession) return;

    const gcEvent: GCEvent = {
      type: (entry as any).kind || 'unknown',
      startTime: entry.startTime,
      duration: entry.duration,
      beforeSize: 0, // Would need additional monitoring
      afterSize: 0,
      freedBytes: 0,
    };

    // Add to current resource snapshot or latest snapshot
    const latestSnapshot = this.resourceSnapshots[this.resourceSnapshots.length - 1];
    if (latestSnapshot) {
      latestSnapshot.gc.push(gcEvent);
    }
  }

  /**
   * Helper methods
   */
  private generateBenchmarkId(context: BenchmarkContext): string {
    const benchmarkName = context.benchmark?.name || 'unknown';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${benchmarkName}-${timestamp}-${random}`;
  }

  private calculateCPUPercent(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU calculation - in real implementation would track deltas
    return ((cpuUsage.user + cpuUsage.system) / 1000000) * 100; // Convert to percentage
  }

  private measureEventLoopLag(): number {
    const start = performance.now();
    setImmediate(() => {
      const lag = performance.now() - start;
      return lag;
    });
    return 0; // Simplified - real implementation would track async
  }

  private classifyImpact(duration: number): 'low' | 'medium' | 'high' | 'critical' {
    if (duration > 1000) return 'critical';
    if (duration > 500) return 'high';
    if (duration > 100) return 'medium';
    return 'low';
  }

  private generateBottleneckRecommendations(operation: string, duration: number): string[] {
    const recommendations: string[] = [];

    if (duration > 1000) {
      recommendations.push('Consider breaking this operation into smaller chunks');
      recommendations.push('Investigate if this operation can be optimized or cached');
    }

    if (operation.includes('file') || operation.includes('io')) {
      recommendations.push('Consider using streaming or async I/O');
    }

    if (operation.includes('parse') || operation.includes('analyze')) {
      recommendations.push('Consider parallelizing this operation');
    }

    return recommendations;
  }

  // Event handlers
  private handleBottleneckDetected(data: any): void {
    this.emit('bottleneckDetected', data);
  }

  private handleHotspotDetected(data: any): void {
    this.emit('hotspotDetected', data);
  }

  private handlePerformanceRegression(data: any): void {
    this.emit('performanceRegression', data);
  }

  // Analysis methods
  private convertToBottlenecks(bottlenecks: any[]): PerformanceBottleneck[] {
    return bottlenecks.map((b) => ({
      operation: b.operation,
      function: b.operation,
      duration: b.duration,
      frequency: b.frequency,
      impact: b.impact,
      severity: b.duration / 100, // Normalized
      description: `Bottleneck in ${b.operation}`,
      recommendations: b.recommendations || [],
      correlatedMetrics: {},
    }));
  }

  private convertToHotspots(hotspots: any[]): Hotspot[] {
    return hotspots.map((h) => ({
      name: h.name,
      totalTime: h.totalTime,
      selfTime: h.selfTime || h.totalTime,
      callCount: h.callCount,
      averageTime: h.averageTime,
      location: h.location || {},
      callers: h.callers || [],
      callees: h.callees || [],
    }));
  }

  private aggregateMetrics(data: BenchmarkProfilingData[]): any {
    const totalDuration = data.reduce((sum, d) => sum + d.duration, 0);
    const totalSnapshots = data.reduce((sum, d) => sum + d.resourceSnapshots.length, 0);

    return {
      totalDuration,
      operationCount: data.length,
      averageOperationTime: totalDuration / data.length,
      peakMemoryUsage: Math.max(
        ...data.flatMap((d) => d.resourceSnapshots.map((s) => s.memory.heapUsed))
      ),
      peakCpuUsage: Math.max(...data.flatMap((d) => d.resourceSnapshots.map((s) => s.cpu.percent))),
      gcPressure: data.reduce((sum, d) => sum + d.systemMetrics.gcEvents.length, 0) / data.length,
      eventLoopLag:
        data.reduce((sum, d) => sum + d.systemMetrics.eventLoopLag.reduce((a, b) => a + b, 0), 0) /
        totalSnapshots,
    };
  }

  private identifyGlobalBottlenecks(data: BenchmarkProfilingData[]): PerformanceBottleneck[] {
    const bottleneckMap = new Map<string, PerformanceBottleneck>();

    // Aggregate bottlenecks across all benchmark runs
    for (const benchmark of data) {
      for (const bottleneck of benchmark.bottlenecks) {
        const existing = bottleneckMap.get(bottleneck.operation);
        if (existing) {
          existing.frequency += bottleneck.frequency;
          existing.duration += bottleneck.duration;
        } else {
          bottleneckMap.set(bottleneck.operation, { ...bottleneck });
        }
      }
    }

    return Array.from(bottleneckMap.values())
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  private calculateTrends(data: BenchmarkProfilingData[]): any {
    // Simplified trend analysis
    return {
      memoryTrend: 'stable',
      cpuTrend: 'stable',
      performanceTrend: 'stable',
    };
  }

  private performCorrelationAnalysis(data: BenchmarkProfilingData): PerformanceCorrelation[] {
    // Simplified correlation analysis
    return [];
  }

  private generateRecommendations(metrics: any, bottlenecks: PerformanceBottleneck[]): string[] {
    const recommendations: string[] = [];

    if (metrics.peakMemoryUsage > 100 * 1024 * 1024) {
      // > 100MB
      recommendations.push('Consider optimizing memory usage - peak usage exceeds 100MB');
    }

    if (metrics.peakCpuUsage > 80) {
      recommendations.push('High CPU usage detected - consider optimizing algorithms');
    }

    if (bottlenecks.length > 5) {
      recommendations.push(
        `${bottlenecks.length} performance bottlenecks detected - review and optimize`
      );
    }

    return recommendations;
  }

  private createEmptyAnalysis(): PerformanceAnalysis {
    return {
      summary: {
        totalDuration: 0,
        operationCount: 0,
        averageOperationTime: 0,
        peakMemoryUsage: 0,
        peakCpuUsage: 0,
        gcPressure: 0,
        eventLoopLag: 0,
      },
      bottlenecks: [],
      trends: {
        memoryTrend: 'stable',
        cpuTrend: 'stable',
        performanceTrend: 'stable',
      },
      recommendations: [],
    };
  }
}

/**
 * Factory function to create benchmark profiler
 */
export function createBenchmarkProfiler(
  config: Partial<BenchmarkProfilingConfig> = {}
): BenchmarkProfiler {
  return new BenchmarkProfiler(config);
}

/**
 * Create profiler optimized for CI environments
 */
export function createCIBenchmarkProfiler(): BenchmarkProfiler {
  return new BenchmarkProfiler({
    enabled: true,
    captureStackTraces: false, // Reduce overhead in CI
    sampleInterval: 500, // Less frequent sampling
    maxSamples: 1000,
    exportFormats: ['json'],
    enableRealTimeAnalysis: false,
    retainRawData: false,
  });
}

/**
 * Create profiler optimized for development
 */
export function createDevelopmentBenchmarkProfiler(): BenchmarkProfiler {
  return new BenchmarkProfiler({
    enabled: true,
    captureStackTraces: true,
    sampleInterval: 100,
    maxSamples: 10000,
    exportFormats: ['json', 'csv', 'flamegraph'],
    enableRealTimeAnalysis: true,
    retainRawData: true,
  });
}
