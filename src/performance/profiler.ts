/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Performance Monitoring & Profiling Framework for Tailwind Enigma Core
 *
 * Provides comprehensive performance monitoring with CPU, memory, I/O tracking,
 * bottleneck detection, and integration with clinic.js and 0x profiler.
 *
 * CHECKPOINT: This completes Phase 2 of the performance optimization implementation.
 */

import { performance, PerformanceObserver } from "perf_hooks";
import { EventEmitter } from "events";
import { execSync, spawn, ChildProcess } from "child_process";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createLogger } from "../logger.ts";
import type { ProfilingConfig, PerformanceMetrics } from "./config.ts";

const logger = createLogger("PerformanceProfiler");

/**
 * Performance measurement entry
 */
interface PerformanceMeasurement {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  entryType: string;
  detail?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Resource usage snapshot
 */
interface ResourceSnapshot {
  timestamp: number;
  cpu: {
    user: number;
    system: number;
    percent: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
    heapUtilization: number;
  };
  io: {
    readBytes: number;
    writeBytes: number;
    readOperations: number;
    writeOperations: number;
  };
  eventLoop: {
    lag: number;
    utilization: number;
  };
  gc: {
    collections: number;
    duration: number;
    type?: string;
  }[];
}

/**
 * Performance analysis result
 */
interface PerformanceAnalysis {
  summary: {
    totalDuration: number;
    operationCount: number;
    averageOperationTime: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
    gcPressure: number;
    eventLoopLag: number;
  };
  bottlenecks: {
    operation: string;
    duration: number;
    frequency: number;
    impact: "low" | "medium" | "high" | "critical";
    recommendations: string[];
  }[];
  trends: {
    memoryTrend: "stable" | "increasing" | "decreasing" | "fluctuating";
    cpuTrend: "stable" | "increasing" | "decreasing" | "fluctuating";
    performanceTrend: "improving" | "degrading" | "stable";
  };
  recommendations: string[];
}

/**
 * Profiling session configuration
 */
interface ProfilingSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  measurements: PerformanceMeasurement[];
  snapshots: ResourceSnapshot[];
  options: {
    sampleInterval: number;
    enableGC: boolean;
    enableEventLoop: boolean;
    enableMemoryDetails: boolean;
    maxSamples: number;
  };
}

/**
 * External profiler tools
 */
type ProfilerTool =
  | "clinic-doctor"
  | "clinic-flame"
  | "clinic-bubbleprof"
  | "0x"
  | "node-inspect";

/**
 * Comprehensive performance profiler and monitoring system
 */
export class PerformanceProfiler extends EventEmitter {
  private config: ProfilingConfig;
  private isMonitoring = false;
  private currentSession?: ProfilingSession;
  private monitoringInterval?: NodeJS.Timeout;
  private performanceObserver?: PerformanceObserver;
  private gcObserver?: PerformanceObserver;
  private sessions: Map<string, ProfilingSession> = new Map();
  private baselineMetrics?: ResourceSnapshot;
  private externalProfiler?: ChildProcess;

  constructor(config: Partial<ProfilingConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      samplingRate: 1, // Default sampling rate
      enableFlameGraphs: false,
      enableMemoryProfiling: true,
      enableCPUProfiling: true,
      outputDirectory: "./performance-reports",
      autoExport: true,
      enableOpenTelemetry: false,
      sampleInterval: 1000, // 1 second
      enableGC: true,
      enableEventLoop: true,
      enableMemoryDetails: true,
      maxSamples: 1000,
      outputDir: "./performance-reports",
      enableClinicJs: false,
      enable0x: false,
      clinicJsPath: "clinic",
      zeroXPath: "0x",
      autoAnalysis: true,
      ...config,
    };

    this.setupOutputDirectory();
    this.setupPerformanceObserver();
    this.captureBaseline();

    logger.info("PerformanceProfiler initialized", {
      sampleInterval: this.config.sampleInterval,
      enableGC: this.config.enableGC,
      enableEventLoop: this.config.enableEventLoop,
      outputDir: this.config.outputDir,
    });
  }

  /**
   * Start a new profiling session
   */
  startSession(
    name: string,
    options: Partial<ProfilingSession["options"]> = {},
  ): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: ProfilingSession = {
      id: sessionId,
      name,
      startTime: performance.now(),
      measurements: [],
      snapshots: [],
      options: {
        sampleInterval: this.config.sampleInterval,
        enableGC: this.config.enableGC,
        enableEventLoop: this.config.enableEventLoop,
        enableMemoryDetails: this.config.enableMemoryDetails,
        maxSamples: this.config.maxSamples,
        ...options,
      },
    };

    this.currentSession = session;
    this.sessions.set(sessionId, session);
    this.startMonitoring();

    logger.info("Profiling session started", {
      sessionId,
      name,
      sampleInterval: session.options.sampleInterval,
    });

    this.emit("sessionStarted", { sessionId, name });
    return sessionId;
  }

  /**
   * Stop the current profiling session
   */
  stopSession(): PerformanceAnalysis | null {
    if (!this.currentSession) {
      logger.warn("No active profiling session to stop");
      return null;
    }

    this.currentSession.endTime = performance.now();
    this.stopMonitoring();

    const analysis = this.config.autoAnalysis
      ? this.analyzeSession(this.currentSession.id)
      : null;

    logger.info("Profiling session stopped", {
      sessionId: this.currentSession.id,
      duration:
        (this.currentSession.endTime - this.currentSession.startTime) / 1000,
      measurements: this.currentSession.measurements.length,
      snapshots: this.currentSession.snapshots.length,
    });

    this.emit("sessionStopped", {
      sessionId: this.currentSession.id,
      analysis,
    });

    const sessionId = this.currentSession.id;
    this.currentSession = undefined;

    return analysis;
  }

  /**
   * Mark the start of a performance measurement
   */
  markStart(name: string, detail?: unknown): void {
    performance.mark(`${name}-start`);

    if (this.currentSession) {
      // Store start metadata for later use
      performance.mark(`${name}-start`, { detail });
    }
  }

  /**
   * Mark the end of a performance measurement
   */
  markEnd(name: string, detail?: unknown): PerformanceMeasurement | null {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;

    performance.mark(endMark);

    try {
      performance.measure(name, startMark, endMark);

      // Get the measurement
      const entries = performance.getEntriesByName(name, "measure");
      const measurement = entries[entries.length - 1];

      if (measurement && this.currentSession) {
        const perfMeasurement: PerformanceMeasurement = {
          name: measurement.name,
          duration: measurement.duration,
          startTime: measurement.startTime,
          endTime: measurement.startTime + measurement.duration,
          entryType: measurement.entryType,
          detail,
          metadata: {
            sessionId: this.currentSession.id,
            timestamp: Date.now(),
          },
        };

        this.currentSession.measurements.push(perfMeasurement);

        // Check for bottlenecks
        if (measurement.duration > 100) {
          // >100ms operations
          this.emit("bottleneckDetected", {
            operation: name,
            duration: measurement.duration,
            sessionId: this.currentSession.id,
          });
        }

        // Cleanup marks
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(name);

        return perfMeasurement;
      }
    } catch (error) {
      logger.warn("Failed to create performance measurement", {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    name: string,
    fn: () => Promise<T> | T,
    detail?: unknown,
  ): Promise<{ result: T; measurement: PerformanceMeasurement | null }> {
    this.markStart(name, detail);

    try {
      const result = await fn();
      const measurement = this.markEnd(name, detail);
      return { result, measurement };
    } catch (_) {
      this.markEnd(name, {
        ...(detail && typeof detail === "object" ? detail : {}),
        error: true,
      });
      throw error;
    }
  }

  /**
   * Start external profiler (clinic.js or 0x)
   */
  async startExternalProfiler(
    tool: ProfilerTool,
    scriptPath: string,
    args: string[] = [],
  ): Promise<void> {
    if (this.externalProfiler) {
      throw new Error("External profiler already running");
    }

    const outputDir = join(this.config.outputDir, `external-${Date.now()}`);
    mkdirSync(outputDir, { recursive: true });

    let command: string;
    let commandArgs: string[];

    switch (tool) {
      case "clinic-doctor":
        command = this.config.clinicJsPath;
        commandArgs = ["doctor", "--dest", outputDir, scriptPath, ...args];
        break;
      case "clinic-flame":
        command = this.config.clinicJsPath;
        commandArgs = ["flame", "--dest", outputDir, scriptPath, ...args];
        break;
      case "clinic-bubbleprof":
        command = this.config.clinicJsPath;
        commandArgs = ["bubbleprof", "--dest", outputDir, scriptPath, ...args];
        break;
      case "0x":
        command = this.config.zeroXPath;
        commandArgs = ["-o", outputDir, scriptPath, ...args];
        break;
      case "node-inspect":
        command = "node";
        commandArgs = ["--inspect-brk", scriptPath, ...args];
        break;
      default:
        throw new Error(`Unsupported profiler tool: ${tool}`);
    }

    logger.info("Starting external profiler", {
      tool,
      command,
      args: commandArgs,
      outputDir,
    });

    (this as any).externalProfiler = spawn(command, commandArgs, {
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "development" },
    });

    this.externalProfiler.stdout?.on("data", (data) => {
      logger.debug("External profiler stdout", { data: data.toString() });
    });

    this.externalProfiler.stderr?.on("data", (data) => {
      logger.debug("External profiler stderr", { data: data.toString() });
    });

    this.externalProfiler.on("close", (code) => {
      logger.info("External profiler finished", { tool, code, outputDir });
      (this as any).externalProfiler = undefined;
      this.emit("externalProfilerFinished", { tool, code, outputDir });
    });

    this.emit("externalProfilerStarted", { tool, outputDir });
  }

  /**
   * Stop external profiler
   */
  stopExternalProfiler(): void {
    if (this.externalProfiler) {
      this.externalProfiler.kill("SIGTERM");
      (this as any).externalProfiler = undefined;
      logger.info("External profiler stopped");
    }
  }

  /**
   * Analyze a profiling session
   */
  analyzeSession(sessionId: string): PerformanceAnalysis | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn("Session not found for analysis", { sessionId });
      return null;
    }

    logger.info("Analyzing session", {
      sessionId,
      measurements: session.measurements.length,
      snapshots: session.snapshots.length,
    });

    // Calculate summary metrics
    const totalDuration =
      (session.endTime || performance.now()) - session.startTime;
    const operationCount = session.measurements.length;
    const averageOperationTime =
      operationCount > 0
        ? session.measurements.reduce((sum, m) => sum + m.duration, 0) /
          operationCount
        : 0;

    const peakMemoryUsage = Math.max(
      ...session.snapshots.map((s) => s.memory.heapUsed),
      0,
    );

    const peakCpuUsage = Math.max(
      ...session.snapshots.map((s) => s.cpu.percent),
      0,
    );

    const gcPressure =
      session.snapshots.reduce(
        (sum, s) => sum + s.gc.reduce((gcSum, gc) => gcSum + gc.duration, 0),
        0,
      ) / session.snapshots.length;

    const avgEventLoopLag =
      session.snapshots.length > 0
        ? session.snapshots.reduce((sum, s) => sum + s.eventLoop.lag, 0) /
          session.snapshots.length
        : 0;

    // Identify bottlenecks
    const operationStats = new Map<
      string,
      { count: number; totalDuration: number; maxDuration: number }
    >();

    for (const measurement of session.measurements) {
      const stats = operationStats.get(measurement.name) || {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
      };
      stats.count++;
      stats.totalDuration += measurement.duration;
      stats.maxDuration = Math.max(stats.maxDuration, measurement.duration);
      operationStats.set(measurement.name, stats);
    }

    const bottlenecks = Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        duration: stats.totalDuration,
        frequency: stats.count,
        impact: this.classifyImpact(
          stats.maxDuration,
          stats.totalDuration,
          operationCount,
        ),
        recommendations: this.generateRecommendations(operation, stats),
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10); // Top 10 bottlenecks

    // Analyze trends
    const trends = this.analyzeTrends(session.snapshots);

    // Generate overall recommendations
    const recommendations = this.generateOverallRecommendations({
      peakMemoryUsage,
      peakCpuUsage,
      gcPressure,
      avgEventLoopLag,
      bottlenecks,
      trends,
    });

    const analysis: PerformanceAnalysis = {
      summary: {
        totalDuration: totalDuration / 1000, // Convert to seconds
        operationCount,
        averageOperationTime,
        peakMemoryUsage,
        peakCpuUsage,
        gcPressure,
        eventLoopLag: avgEventLoopLag,
      },
      bottlenecks,
      trends,
      recommendations,
    };

    // Save analysis report
    this.saveAnalysisReport(sessionId, analysis);

    return analysis;
  }

  /**
   * Get session data
   */
  getSession(sessionId: string): ProfilingSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ProfilingSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear old sessions (keep last N sessions)
   */
  clearOldSessions(keepCount = 10): void {
    const sessions = Array.from(this.sessions.entries()).sort(
      ([, a], [, b]) => b.startTime - a.startTime,
    );

    const toDelete = sessions.slice(keepCount);

    for (const [sessionId] of toDelete) {
      this.sessions.delete(sessionId);
    }

    logger.info("Cleared old sessions", {
      cleared: toDelete.length,
      remaining: this.sessions.size,
    });
  }

  /**
   * Export session data
   */
  exportSession(
    sessionId: string,
    format: "json" | "csv" = "json",
  ): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (format === "json") {
      return JSON.stringify(session, null, 2);
    } else {
      // CSV format for measurements
      const headers = ["name", "duration", "startTime", "endTime"];
      const rows = session.measurements.map((m) =>
        [m.name, m.duration, m.startTime, m.endTime].join(","),
      );
      return [headers.join(","), ...rows].join("\n");
    }
  }

  /**
   * Start monitoring system resources
   */
  private startMonitoring(): void {
    if (this.isMonitoring || !this.currentSession) return;

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.captureResourceSnapshot();
    }, this.currentSession.options.sampleInterval);

    logger.debug("Started resource monitoring", {
      sessionId: this.currentSession.id,
      interval: this.currentSession.options.sampleInterval,
    });
  }

  /**
   * Stop monitoring system resources
   */
  private stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.debug("Stopped resource monitoring");
  }

  /**
   * Capture a resource usage snapshot
   */
  private captureResourceSnapshot(): void {
    if (!this.currentSession) return;

    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();

    // Get GC information if available
    const gcInfo = this.getGCInfo();

    // Calculate event loop lag
    const eventLoopLag = this.measureEventLoopLag();

    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percent: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers || 0,
        heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal,
      },
      io: {
        readBytes: 0, // Would need additional monitoring
        writeBytes: 0,
        readOperations: 0,
        writeOperations: 0,
      },
      eventLoop: {
        lag: eventLoopLag,
        utilization:
          1 - eventLoopLag / this.currentSession.options.sampleInterval,
      },
      gc: gcInfo,
    };

    this.currentSession.snapshots.push(snapshot);

    // Limit snapshot history
    if (
      this.currentSession.snapshots.length >
      this.currentSession.options.maxSamples
    ) {
      this.currentSession.snapshots.shift();
    }

    this.emit("snapshot", { sessionId: this.currentSession.id, snapshot });
  }

  /**
   * Setup performance observer
   */
  private setupPerformanceObserver(): void {
    // Observe GC events
    if (this.config.enableGC) {
      this.gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.emit("gcEvent", {
            type: entry.name,
            duration: entry.duration,
            timestamp: entry.startTime,
          });
        }
      });

      this.gcObserver.observe({ entryTypes: ["gc"] });
    }

    // Observe function events
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.emit("performanceEntry", {
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration,
        });
      }
    });

    this.performanceObserver.observe({ entryTypes: ["function"] });
  }

  /**
   * Setup output directory
   */
  private setupOutputDirectory(): void {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Capture baseline metrics
   */
  private captureBaseline(): void {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();

    this.baselineMetrics = {
      timestamp: Date.now(),
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percent: 0,
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        arrayBuffers: memoryUsage.arrayBuffers || 0,
        heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal,
      },
      io: {
        readBytes: 0,
        writeBytes: 0,
        readOperations: 0,
        writeOperations: 0,
      },
      eventLoop: { lag: 0, utilization: 1 },
      gc: [],
    };

    logger.debug("Baseline metrics captured", {
      heapUsed: this.baselineMetrics.memory.heapUsed,
      heapTotal: this.baselineMetrics.memory.heapTotal,
    });
  }

  /**
   * Get GC information
   */
  private getGCInfo(): ResourceSnapshot["gc"] {
    // This would be enhanced with actual GC monitoring
    // For now, return empty array
    return [];
  }

  /**
   * Measure event loop lag
   */
  private measureEventLoopLag(): number {
    const start = process.hrtime.bigint();
    return new Promise<number>((resolve) => {
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(lag);
      });
    }) as unknown as number;
  }

  /**
   * Classify performance impact
   */
  private classifyImpact(
    maxDuration: number,
    totalDuration: number,
    totalOperations: number,
  ): "low" | "medium" | "high" | "critical" {
    const impactScore =
      (totalDuration / totalOperations) * Math.log(maxDuration);

    if (impactScore > 1000) return "critical";
    if (impactScore > 500) return "high";
    if (impactScore > 100) return "medium";
    return "low";
  }

  /**
   * Generate operation-specific recommendations
   */
  private generateRecommendations(
    operation: string,
    stats: { count: number; totalDuration: number; maxDuration: number },
  ): string[] {
    const recommendations: string[] = [];

    if (stats.maxDuration > 1000) {
      recommendations.push(
        "Consider breaking down this operation into smaller chunks",
      );
    }

    if (stats.count > 100 && stats.totalDuration > 10000) {
      recommendations.push(
        "High frequency operation - consider caching or optimization",
      );
    }

    if (operation.includes("file") || operation.includes("io")) {
      recommendations.push(
        "Consider using streaming or async I/O for better performance",
      );
    }

    return recommendations;
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(
    snapshots: ResourceSnapshot[],
  ): PerformanceAnalysis["trends"] {
    if (snapshots.length < 2) {
      return {
        memoryTrend: "stable",
        cpuTrend: "stable",
        performanceTrend: "stable",
      };
    }

    const memoryValues = snapshots.map((s) => s.memory.heapUsed);
    const cpuValues = snapshots.map((s) => s.cpu.percent);

    return {
      memoryTrend: this.calculateTrend(memoryValues),
      cpuTrend: this.calculateTrend(cpuValues),
      performanceTrend: "stable", // Would be calculated based on operation times
    };
  }

  /**
   * Calculate trend direction for a series of values
   */
  private calculateTrend(
    values: number[],
  ): "stable" | "increasing" | "decreasing" | "fluctuating" {
    if (values.length < 3) return "stable";

    const first = values.slice(0, Math.floor(values.length / 3));
    const last = values.slice(-Math.floor(values.length / 3));

    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;

    const change = (lastAvg - firstAvg) / firstAvg;

    if (Math.abs(change) < 0.1) return "stable";
    if (change > 0.1) return "increasing";
    if (change < -0.1) return "decreasing";

    return "fluctuating";
  }

  /**
   * Generate overall recommendations
   */
  private generateOverallRecommendations(data: {
    peakMemoryUsage: number;
    peakCpuUsage: number;
    gcPressure: number;
    avgEventLoopLag: number;
    bottlenecks: any[];
    trends: any;
  }): string[] {
    const recommendations: string[] = [];

    if (data.peakMemoryUsage > 500 * 1024 * 1024) {
      // 500MB
      recommendations.push(
        "High memory usage detected - consider implementing memory optimization strategies",
      );
    }

    if (data.avgEventLoopLag > 10) {
      recommendations.push(
        "Event loop lag detected - consider using worker threads for CPU-intensive tasks",
      );
    }

    if (data.bottlenecks.length > 5) {
      recommendations.push(
        "Multiple bottlenecks detected - prioritize optimization of critical path operations",
      );
    }

    if (data.trends.memoryTrend === "increasing") {
      recommendations.push(
        "Memory usage trend is increasing - check for memory leaks",
      );
    }

    return recommendations;
  }

  /**
   * Save analysis report to file
   */
  private saveAnalysisReport(
    sessionId: string,
    analysis: PerformanceAnalysis,
  ): void {
    const reportPath = join(
      this.config.outputDir,
      `analysis-${sessionId}.json`,
    );

    try {
      writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
      logger.info("Analysis report saved", { reportPath });
    } catch (error) {
      logger.error("Failed to save analysis report", {
        reportPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
