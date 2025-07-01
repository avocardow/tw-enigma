/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MetricsCollector } from './collector.js';
import { PerformanceMonitor } from './performanceMonitor.js';

/**
 * Memory monitor configuration schema
 */
export const MemoryMonitorConfigSchema = z.object({
  // Core monitoring settings
  enabled: z.boolean().default(true),
  autoStart: z.boolean().default(true),
  
  // Sampling configuration
  samplingInterval: z.number().min(100).max(60000).default(1000), // 1 second
  highFrequencySampling: z.boolean().default(false),
  highFrequencyInterval: z.number().min(10).max(1000).default(100), // 100ms for critical periods
  
  // Memory thresholds and alerting
  thresholds: z.object({
    heapUsageWarningMB: z.number().default(512),
    heapUsageCriticalMB: z.number().default(1024),
    heapGrowthRateWarning: z.number().default(10), // MB/sec
    heapFragmentationWarning: z.number().default(0.3), // 30%
    maxMemoryUsageMB: z.number().default(2048),
    gcPauseWarningMs: z.number().default(50),
    gcPauseCriticalMs: z.number().default(200),
    memoryLeakThresholdMB: z.number().default(50), // Growth without GC
  }).default({}),
  
  // Leak detection configuration
  leakDetection: z.object({
    enabled: z.boolean().default(true),
    windowSizeMinutes: z.number().min(1).max(60).default(5),
    minSamplesForDetection: z.number().min(10).max(1000).default(30),
    growthThresholdMB: z.number().default(20),
    gcEfficiencyThreshold: z.number().default(0.1), // 10% reclaim minimum
    trackObjectTypes: z.boolean().default(true),
  }).default({}),
  
  // Heap dump configuration
  heapDumps: z.object({
    enabled: z.boolean().default(true),
    autoCapture: z.boolean().default(true),
    captureOnThreshold: z.boolean().default(true),
    captureOnLeak: z.boolean().default(true),
    maxDumps: z.number().min(1).max(20).default(5),
    compressionEnabled: z.boolean().default(true),
    outputDirectory: z.string().default('./heap-dumps'),
  }).default({}),
  
  // GC monitoring
  gcMonitoring: z.object({
    enabled: z.boolean().default(true),
    trackMinorGC: z.boolean().default(true),
    trackMajorGC: z.boolean().default(true),
    trackIncrementalMarking: z.boolean().default(false),
    calculateEfficiency: z.boolean().default(true),
  }).default({}),
  
  // Memory pressure handling
  pressureHandling: z.object({
    enabled: z.boolean().default(true),
    enableAutoGC: z.boolean().default(true),
    enableCacheEviction: z.boolean().default(true),
    enableLowMemoryMode: z.boolean().default(true),
    pressureThresholds: z.object({
      low: z.number().default(0.7), // 70% of max memory
      medium: z.number().default(0.85), // 85% of max memory
      high: z.number().default(0.95), // 95% of max memory
    }).default({}),
  }).default({}),
  
  // Data retention
  retention: z.object({
    maxSamples: z.number().min(100).max(100000).default(10000),
    maxAgeHours: z.number().min(1).max(168).default(24), // 24 hours
    enableCompression: z.boolean().default(true),
  }).default({}),
});

export type MemoryMonitorConfig = z.infer<typeof MemoryMonitorConfigSchema>;

/**
 * Memory usage snapshot with detailed information
 */
export interface MemorySnapshot {
  timestamp: Date;
  process: NodeJS.MemoryUsage & {
    peak: number;
    fragmentation: number;
    efficiency: number;
  };
  heap: {
    used: number;
    total: number;
    available: number;
    limit: number;
    utilization: number;
    fragmentation: number;
    growthRate: number; // MB/sec since last measurement
  };
  gc: {
    collections: GCStats[];
    totalCollections: number;
    totalPauseTime: number;
    efficiency: number;
    pressure: number;
  };
  objects?: ObjectTypeStats[];
  system?: {
    totalMemory: number;
    freeMemory: number;
    platform: string;
  };
}

/**
 * Garbage collection statistics
 */
export interface GCStats {
  type: 'minor' | 'major' | 'incremental';
  timestamp: Date;
  duration: number;
  beforeUsed: number;
  afterUsed: number;
  reclaimed: number;
  efficiency: number;
  triggerReason?: string;
}

/**
 * Object type statistics for heap analysis
 */
export interface ObjectTypeStats {
  type: string;
  count: number;
  size: number;
  percentage: number;
  retainedSize?: number;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakDetection {
  detected: boolean;
  confidence: number; // 0-1
  type: 'heap_growth' | 'gc_inefficiency' | 'object_accumulation' | 'fragmentation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: {
    windowStart: Date;
    windowEnd: Date;
    growthMB: number;
    growthRate: number;
    gcEfficiency: number;
    suspiciousObjects?: ObjectTypeStats[];
    recommendations: string[];
  };
  timestamp: Date;
}

/**
 * Memory pressure level and response
 */
export interface MemoryPressure {
  level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  percentage: number;
  timestamp: Date;
  triggers: string[];
  actions: MemoryPressureAction[];
}

/**
 * Memory pressure response actions
 */
export interface MemoryPressureAction {
  type: 'gc_force' | 'cache_clear' | 'buffer_flush' | 'mode_switch' | 'throttle';
  description: string;
  timestamp: Date;
  success: boolean;
  reclaimedMB?: number;
}

/**
 * Memory trend analysis
 */
export interface MemoryTrend {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  rate: number; // MB per hour
  confidence: number;
  timespan: number; // hours
  projection: {
    oneHour: number;
    sixHours: number;
    twentyFourHours: number;
  };
}

/**
 * Comprehensive memory monitoring and leak detection system
 */
export class MemoryMonitor extends EventEmitter {
  private config: MemoryMonitorConfig;
  private metricsCollector: MetricsCollector;
  private performanceMonitor?: PerformanceMonitor;
  
  // Monitoring state
  private isRunning = false;
  private samplingTimer?: NodeJS.Timeout;
  private highFrequencyTimer?: NodeJS.Timeout;
  private leakDetectionTimer?: NodeJS.Timeout;
  
  // Memory tracking
  private snapshots: MemorySnapshot[] = [];
  private gcStats: GCStats[] = [];
  private leakDetections: MemoryLeakDetection[] = [];
  private pressureEvents: MemoryPressure[] = [];
  
  // State tracking
  private lastSnapshot?: MemorySnapshot;
  private baseline?: MemorySnapshot;
  private currentPressure: MemoryPressure['level'] = 'none';
  private heapDumpCount = 0;
  
  // Hooks and monitoring
  private gcObserver?: any;
  private performanceObserver?: any;

  constructor(
    metricsCollector: MetricsCollector,
    config: Partial<MemoryMonitorConfig> = {},
    performanceMonitor?: PerformanceMonitor
  ) {
    super();
    this.config = MemoryMonitorConfigSchema.parse(config);
    this.metricsCollector = metricsCollector;
    this.performanceMonitor = performanceMonitor;
    
    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start memory monitoring
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Capture baseline
    this.baseline = await this.captureSnapshot();
    this.lastSnapshot = this.baseline;
    
    // Setup GC monitoring
    if (this.config.gcMonitoring.enabled) {
      this.setupGCMonitoring();
    }
    
    // Setup heap dump directory
    if (this.config.heapDumps.enabled) {
      await this.ensureHeapDumpDirectory();
    }
    
    // Start sampling
    this.startSampling();
    
    // Start leak detection
    if (this.config.leakDetection.enabled) {
      this.startLeakDetection();
    }
    
    this.emit('started');
  }

  /**
   * Stop memory monitoring
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    // Clear timers
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = undefined;
    }
    
    if (this.highFrequencyTimer) {
      clearInterval(this.highFrequencyTimer);
      this.highFrequencyTimer = undefined;
    }
    
    if (this.leakDetectionTimer) {
      clearInterval(this.leakDetectionTimer);
      this.leakDetectionTimer = undefined;
    }
    
    // Cleanup observers
    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = undefined;
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = undefined;
    }
    
    this.emit('stopped');
  }

  /**
   * Capture current memory snapshot
   */
  public async captureSnapshot(): Promise<MemorySnapshot> {
    const timestamp = new Date();
    const memUsage = process.memoryUsage();
    
    // Calculate additional metrics
    const peak = this.calculatePeakMemory();
    const fragmentation = this.calculateFragmentation(memUsage);
    const efficiency = this.calculateHeapEfficiency(memUsage);
    const growthRate = this.calculateGrowthRate();
    
    // Get system memory info if available
    const systemInfo = await this.getSystemMemoryInfo();
    
    // Get object type statistics if enabled
    const objectStats = this.config.leakDetection.trackObjectTypes 
      ? await this.getObjectTypeStats() 
      : undefined;
    
    const snapshot: MemorySnapshot = {
      timestamp,
      process: {
        ...memUsage,
        peak,
        fragmentation,
        efficiency,
      },
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        available: memUsage.heapTotal - memUsage.heapUsed,
        limit: this.config.thresholds.maxMemoryUsageMB * 1024 * 1024,
        utilization: memUsage.heapUsed / memUsage.heapTotal,
        fragmentation,
        growthRate,
      },
      gc: {
        collections: this.getRecentGCStats(),
        totalCollections: this.gcStats.length,
        totalPauseTime: this.gcStats.reduce((sum, gc) => sum + gc.duration, 0),
        efficiency: this.calculateGCEfficiency(),
        pressure: this.calculateGCPressure(),
      },
      objects: objectStats,
      system: systemInfo,
    };
    
    // Store snapshot
    this.snapshots.push(snapshot);
    this.trimSnapshots();
    
    // Update last snapshot
    this.lastSnapshot = snapshot;
    
    // Record metrics
    this.recordSnapshotMetrics(snapshot);
    
    return snapshot;
  }

  /**
   * Force garbage collection if available
   */
  public forceGC(): boolean {
    if (global.gc) {
      try {
        global.gc();
        this.emit('gcForced', { timestamp: new Date() });
        return true;
      } catch (error) {
        this.emit('gcError', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Capture heap dump
   */
  public async captureHeapDump(reason?: string): Promise<string | null> {
    if (!this.config.heapDumps.enabled || this.heapDumpCount >= this.config.heapDumps.maxDumps) {
      return null;
    }

    try {
      const v8 = require('v8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `heap-dump-${timestamp}-${reason || 'manual'}.heapsnapshot`;
      const filepath = path.join(this.config.heapDumps.outputDirectory, filename);
      
      const heapSnapshot = v8.getHeapSnapshot();
      const writeStream = await fs.open(filepath, 'w');
      
      heapSnapshot.pipe(writeStream.createWriteStream());
      
      await new Promise((resolve, reject) => {
        heapSnapshot.on('end', resolve);
        heapSnapshot.on('error', reject);
      });
      
      this.heapDumpCount++;
      
      // Compress if enabled
      if (this.config.heapDumps.compressionEnabled) {
        await this.compressHeapDump(filepath);
      }
      
      this.emit('heapDumpCaptured', { 
        filepath, 
        reason, 
        timestamp: new Date(),
        size: (await fs.stat(filepath)).size 
      });
      
      return filepath;
    } catch (error) {
      this.emit('heapDumpError', error);
      return null;
    }
  }

  /**
   * Detect memory leaks
   */
  public async detectLeaks(): Promise<MemoryLeakDetection[]> {
    if (this.snapshots.length < this.config.leakDetection.minSamplesForDetection) {
      return [];
    }

    const detections: MemoryLeakDetection[] = [];
    const windowMs = this.config.leakDetection.windowSizeMinutes * 60 * 1000;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    // Get snapshots in detection window
    const windowSnapshots = this.snapshots.filter(
      s => s.timestamp >= windowStart && s.timestamp <= now
    );
    
    if (windowSnapshots.length < this.config.leakDetection.minSamplesForDetection) {
      return [];
    }
    
    // Detect heap growth pattern
    const heapGrowthLeak = this.detectHeapGrowthLeak(windowSnapshots, windowStart, now);
    if (heapGrowthLeak) detections.push(heapGrowthLeak);
    
    // Detect GC inefficiency
    const gcInefficiencyLeak = this.detectGCInefficiencyLeak(windowSnapshots, windowStart, now);
    if (gcInefficiencyLeak) detections.push(gcInefficiencyLeak);
    
    // Detect object accumulation
    const objectAccumulationLeak = this.detectObjectAccumulationLeak(windowSnapshots, windowStart, now);
    if (objectAccumulationLeak) detections.push(objectAccumulationLeak);
    
    // Detect fragmentation issues
    const fragmentationLeak = this.detectFragmentationLeak(windowSnapshots, windowStart, now);
    if (fragmentationLeak) detections.push(fragmentationLeak);
    
    // Store detections
    this.leakDetections.push(...detections);
    this.trimLeakDetections();
    
    // Emit events for detected leaks
    for (const detection of detections) {
      this.emit('leakDetected', detection);
      
      // Auto-capture heap dump for high severity leaks
      if (this.config.heapDumps.captureOnLeak && detection.severity === 'high') {
        await this.captureHeapDump(`leak-${detection.type}`);
      }
    }
    
    return detections;
  }

  /**
   * Handle memory pressure
   */
  public async handleMemoryPressure(): Promise<MemoryPressureAction[]> {
    if (!this.config.pressureHandling.enabled || !this.lastSnapshot) {
      return [];
    }

    const pressure = this.calculateMemoryPressure(this.lastSnapshot);
    const actions: MemoryPressureAction[] = [];
    
    if (pressure.level === 'none') {
      return actions;
    }
    
    // Force GC
    if (this.config.pressureHandling.enableAutoGC && pressure.level !== 'low') {
      const action = await this.performGCAction();
      if (action) actions.push(action);
    }
    
    // Clear caches
    if (this.config.pressureHandling.enableCacheEviction && pressure.level === 'high') {
      const action = await this.performCacheEvictionAction();
      if (action) actions.push(action);
    }
    
    // Switch to low memory mode
    if (this.config.pressureHandling.enableLowMemoryMode && pressure.level === 'critical') {
      const action = await this.performLowMemoryModeAction();
      if (action) actions.push(action);
    }
    
    // Record pressure event
    pressure.actions = actions;
    this.pressureEvents.push(pressure);
    this.currentPressure = pressure.level;
    
    this.emit('memoryPressure', pressure);
    
    return actions;
  }

  /**
   * Get memory trend analysis
   */
  public getMemoryTrend(timeSpanHours = 1): MemoryTrend {
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeSpanHours * 60 * 60 * 1000);
    
    const recentSnapshots = this.snapshots.filter(s => s.timestamp >= cutoff);
    
    if (recentSnapshots.length < 2) {
      return {
        direction: 'stable',
        rate: 0,
        confidence: 0,
        timespan: timeSpanHours,
        projection: { oneHour: 0, sixHours: 0, twentyFourHours: 0 },
      };
    }
    
    // Calculate trend using linear regression
    const values = recentSnapshots.map(s => s.heap.used / (1024 * 1024)); // MB
    const times = recentSnapshots.map(s => s.timestamp.getTime());
    
    const { slope, correlation } = this.linearRegression(times, values);
    const ratePerHour = slope * 60 * 60 * 1000; // MB per hour
    
    let direction: MemoryTrend['direction'];
    if (Math.abs(ratePerHour) < 1) {
      direction = 'stable';
    } else if (correlation < 0.7) {
      direction = 'volatile';
    } else if (ratePerHour > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }
    
    const currentMB = values[values.length - 1];
    
    return {
      direction,
      rate: ratePerHour,
      confidence: Math.abs(correlation),
      timespan: timeSpanHours,
      projection: {
        oneHour: Math.max(0, currentMB + ratePerHour),
        sixHours: Math.max(0, currentMB + ratePerHour * 6),
        twentyFourHours: Math.max(0, currentMB + ratePerHour * 24),
      },
    };
  }

  /**
   * Get comprehensive memory statistics
   */
  public getMemoryStats(): {
    current: MemorySnapshot;
    baseline: MemorySnapshot;
    trend: MemoryTrend;
    leaks: MemoryLeakDetection[];
    pressure: MemoryPressure;
    gc: {
      totalCollections: number;
      totalPauseTime: number;
      averageEfficiency: number;
      recentPauses: number[];
    };
  } {
    const current = this.lastSnapshot!;
    const trend = this.getMemoryTrend();
    const pressure = this.calculateMemoryPressure(current);
    
    const recentGC = this.gcStats.slice(-10);
    const gcStats = {
      totalCollections: this.gcStats.length,
      totalPauseTime: this.gcStats.reduce((sum, gc) => sum + gc.duration, 0),
      averageEfficiency: this.gcStats.length > 0 
        ? this.gcStats.reduce((sum, gc) => sum + gc.efficiency, 0) / this.gcStats.length 
        : 0,
      recentPauses: recentGC.map(gc => gc.duration),
    };
    
    return {
      current,
      baseline: this.baseline!,
      trend,
      leaks: this.leakDetections.slice(-5), // Last 5 detections
      pressure,
      gc: gcStats,
    };
  }

  /**
   * Setup regular sampling
   */
  private startSampling(): void {
    this.samplingTimer = setInterval(async () => {
      try {
        await this.captureSnapshot();
        
        // Check for memory pressure
        await this.handleMemoryPressure();
        
        // Check thresholds
        this.checkMemoryThresholds();
        
      } catch (error) {
        this.emit('samplingError', error);
      }
    }, this.config.samplingInterval);
    
    // High frequency sampling during pressure
    if (this.config.highFrequencySampling) {
      this.setupHighFrequencySampling();
    }
  }

  /**
   * Setup high frequency sampling during memory pressure
   */
  private setupHighFrequencySampling(): void {
    this.highFrequencyTimer = setInterval(async () => {
      if (this.currentPressure === 'high' || this.currentPressure === 'critical') {
        try {
          await this.captureSnapshot();
        } catch (error) {
          this.emit('highFrequencySamplingError', error);
        }
      }
    }, this.config.highFrequencyInterval);
  }

  /**
   * Start leak detection
   */
  private startLeakDetection(): void {
    this.leakDetectionTimer = setInterval(async () => {
      try {
        await this.detectLeaks();
      } catch (error) {
        this.emit('leakDetectionError', error);
      }
    }, this.config.leakDetection.windowSizeMinutes * 60 * 1000 / 2); // Check twice per window
  }

  /**
   * Setup GC monitoring using performance hooks
   */
  private setupGCMonitoring(): void {
    try {
      const { PerformanceObserver } = require('perf_hooks');
      
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            this.handleGCEvent(entry);
          }
        }
      });
      
      this.performanceObserver.observe({ entryTypes: ['gc'] });
    } catch (error) {
      this.emit('gcMonitoringError', error);
    }
  }

  /**
   * Handle GC event
   */
  private handleGCEvent(entry: any): void {
    const gcType = this.mapGCKind(entry.kind);
    const beforeUsed = entry.detail?.usedJSHeapSizeBefore || 0;
    const afterUsed = entry.detail?.usedJSHeapSizeAfter || 0;
    const reclaimed = beforeUsed - afterUsed;
    const efficiency = beforeUsed > 0 ? reclaimed / beforeUsed : 0;
    
    const gcStats: GCStats = {
      type: gcType,
      timestamp: new Date(entry.startTime),
      duration: entry.duration,
      beforeUsed,
      afterUsed,
      reclaimed,
      efficiency,
      triggerReason: entry.detail?.reason,
    };
    
    this.gcStats.push(gcStats);
    this.trimGCStats();
    
    // Check GC pause thresholds
    this.checkGCThresholds(gcStats);
    
    this.emit('gcEvent', gcStats);
  }

  /**
   * Map GC kind to type
   */
  private mapGCKind(kind: number): 'minor' | 'major' | 'incremental' {
    // These mappings are based on V8 GC kinds
    switch (kind) {
      case 1: return 'minor'; // Scavenge
      case 2: return 'major'; // Mark-Compact
      case 4: return 'incremental'; // Incremental marking
      default: return 'major';
    }
  }

  /**
   * Calculate peak memory usage
   */
  private calculatePeakMemory(): number {
    return this.snapshots.length > 0 
      ? Math.max(...this.snapshots.map(s => s.process.rss))
      : process.memoryUsage().rss;
  }

  /**
   * Calculate heap fragmentation
   */
  private calculateFragmentation(memUsage: NodeJS.MemoryUsage): number {
    const allocatedHeap = memUsage.heapTotal;
    const usedHeap = memUsage.heapUsed;
    const freeHeap = allocatedHeap - usedHeap;
    
    // Fragmentation = free heap / allocated heap
    return allocatedHeap > 0 ? freeHeap / allocatedHeap : 0;
  }

  /**
   * Calculate heap efficiency
   */
  private calculateHeapEfficiency(memUsage: NodeJS.MemoryUsage): number {
    return memUsage.heapTotal > 0 ? memUsage.heapUsed / memUsage.heapTotal : 0;
  }

  /**
   * Calculate memory growth rate
   */
  private calculateGrowthRate(): number {
    if (this.snapshots.length < 2) return 0;
    
    const recent = this.snapshots.slice(-2);
    const timeDiff = recent[1].timestamp.getTime() - recent[0].timestamp.getTime();
    const memDiff = recent[1].heap.used - recent[0].heap.used;
    
    // MB per second
    return timeDiff > 0 ? (memDiff / (1024 * 1024)) / (timeDiff / 1000) : 0;
  }

  /**
   * Get system memory information
   */
  private async getSystemMemoryInfo(): Promise<{
    totalMemory: number;
    freeMemory: number;
    platform: string;
  } | undefined> {
    try {
      const os = require('os');
      return {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        platform: os.platform(),
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Get object type statistics from heap
   */
  private async getObjectTypeStats(): Promise<ObjectTypeStats[] | undefined> {
    try {
      // This would require a heap analysis library or V8 heap snapshot analysis
      // For now, return undefined - this could be implemented with heapdump or v8-profiler
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get recent GC statistics
   */
  private getRecentGCStats(): GCStats[] {
    const recentCutoff = new Date(Date.now() - 60000); // Last minute
    return this.gcStats.filter(gc => gc.timestamp >= recentCutoff);
  }

  /**
   * Calculate GC efficiency
   */
  private calculateGCEfficiency(): number {
    const recentGC = this.getRecentGCStats();
    if (recentGC.length === 0) return 1;
    
    return recentGC.reduce((sum, gc) => sum + gc.efficiency, 0) / recentGC.length;
  }

  /**
   * Calculate GC pressure
   */
  private calculateGCPressure(): number {
    const recentGC = this.getRecentGCStats();
    if (recentGC.length === 0) return 0;
    
    const totalPauseTime = recentGC.reduce((sum, gc) => sum + gc.duration, 0);
    const timeWindow = 60000; // 1 minute
    
    return Math.min(1, totalPauseTime / timeWindow);
  }

  /**
   * Detect heap growth leak
   */
  private detectHeapGrowthLeak(
    snapshots: MemorySnapshot[],
    windowStart: Date,
    windowEnd: Date
  ): MemoryLeakDetection | null {
    if (snapshots.length < 5) return null;
    
    const startHeap = snapshots[0].heap.used;
    const endHeap = snapshots[snapshots.length - 1].heap.used;
    const growthMB = (endHeap - startHeap) / (1024 * 1024);
    
    if (growthMB < this.config.leakDetection.growthThresholdMB) {
      return null;
    }
    
    const windowDurationHours = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60);
    const growthRate = growthMB / windowDurationHours;
    
    // Check if growth is consistent (linear regression)
    const heapValues = snapshots.map(s => s.heap.used);
    const times = snapshots.map(s => s.timestamp.getTime());
    const { correlation } = this.linearRegression(times, heapValues);
    
    const confidence = Math.abs(correlation);
    
    if (confidence < 0.7) return null; // Not consistent enough
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (growthRate > 100) severity = 'critical';
    else if (growthRate > 50) severity = 'high';
    else if (growthRate > 20) severity = 'medium';
    else severity = 'low';
    
    return {
      detected: true,
      confidence,
      type: 'heap_growth',
      severity,
      details: {
        windowStart,
        windowEnd,
        growthMB,
        growthRate,
        gcEfficiency: this.calculateGCEfficiency(),
        recommendations: [
          'Check for object accumulation',
          'Review cache usage and eviction policies',
          'Analyze heap dumps for retained objects',
          'Consider forcing garbage collection',
        ],
      },
      timestamp: new Date(),
    };
  }

  /**
   * Detect GC inefficiency leak
   */
  private detectGCInefficiencyLeak(
    snapshots: MemorySnapshot[],
    windowStart: Date,
    windowEnd: Date
  ): MemoryLeakDetection | null {
    const recentGC = this.gcStats.filter(
      gc => gc.timestamp >= windowStart && gc.timestamp <= windowEnd
    );
    
    if (recentGC.length < 3) return null;
    
    const avgEfficiency = recentGC.reduce((sum, gc) => sum + gc.efficiency, 0) / recentGC.length;
    
    if (avgEfficiency > this.config.leakDetection.gcEfficiencyThreshold) {
      return null;
    }
    
    const confidence = 1 - avgEfficiency; // Lower efficiency = higher confidence
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (avgEfficiency < 0.05) severity = 'critical';
    else if (avgEfficiency < 0.1) severity = 'high';
    else if (avgEfficiency < 0.2) severity = 'medium';
    else severity = 'low';
    
    return {
      detected: true,
      confidence,
      type: 'gc_inefficiency',
      severity,
      details: {
        windowStart,
        windowEnd,
        growthMB: 0,
        growthRate: 0,
        gcEfficiency: avgEfficiency,
        recommendations: [
          'Investigate objects that survive multiple GC cycles',
          'Check for circular references',
          'Review event listener cleanup',
          'Analyze heap for retained DOM nodes',
        ],
      },
      timestamp: new Date(),
    };
  }

  /**
   * Detect object accumulation leak
   */
  private detectObjectAccumulationLeak(
    snapshots: MemorySnapshot[],
    windowStart: Date,
    windowEnd: Date
  ): MemoryLeakDetection | null {
    // This would require detailed object tracking
    // For now, return null - could be implemented with heap analysis
    return null;
  }

  /**
   * Detect fragmentation leak
   */
  private detectFragmentationLeak(
    snapshots: MemorySnapshot[],
    windowStart: Date,
    windowEnd: Date
  ): MemoryLeakDetection | null {
    const avgFragmentation = snapshots.reduce((sum, s) => sum + s.heap.fragmentation, 0) / snapshots.length;
    
    if (avgFragmentation < this.config.thresholds.heapFragmentationWarning) {
      return null;
    }
    
    const confidence = avgFragmentation;
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (avgFragmentation > 0.8) severity = 'critical';
    else if (avgFragmentation > 0.6) severity = 'high';
    else if (avgFragmentation > 0.4) severity = 'medium';
    else severity = 'low';
    
    return {
      detected: true,
      confidence,
      type: 'fragmentation',
      severity,
      details: {
        windowStart,
        windowEnd,
        growthMB: 0,
        growthRate: 0,
        gcEfficiency: this.calculateGCEfficiency(),
        recommendations: [
          'Force garbage collection to defragment heap',
          'Review object allocation patterns',
          'Consider reducing object size variations',
          'Implement object pooling for frequently allocated objects',
        ],
      },
      timestamp: new Date(),
    };
  }

  /**
   * Calculate memory pressure
   */
  private calculateMemoryPressure(snapshot: MemorySnapshot): MemoryPressure {
    const usedMB = snapshot.heap.used / (1024 * 1024);
    const maxMB = this.config.thresholds.maxMemoryUsageMB;
    const percentage = usedMB / maxMB;
    
    const triggers: string[] = [];
    
    if (percentage > this.config.pressureHandling.pressureThresholds.high) {
      triggers.push('high_memory_usage');
    }
    
    if (snapshot.heap.growthRate > this.config.thresholds.heapGrowthRateWarning) {
      triggers.push('rapid_growth');
    }
    
    if (snapshot.heap.fragmentation > this.config.thresholds.heapFragmentationWarning) {
      triggers.push('high_fragmentation');
    }
    
    if (snapshot.gc.efficiency < this.config.leakDetection.gcEfficiencyThreshold) {
      triggers.push('gc_inefficiency');
    }
    
    let level: MemoryPressure['level'];
    if (percentage > this.config.pressureHandling.pressureThresholds.high) {
      level = 'critical';
    } else if (percentage > this.config.pressureHandling.pressureThresholds.medium) {
      level = 'high';
    } else if (percentage > this.config.pressureHandling.pressureThresholds.low) {
      level = 'medium';
    } else if (triggers.length > 0) {
      level = 'low';
    } else {
      level = 'none';
    }
    
    return {
      level,
      percentage,
      timestamp: new Date(),
      triggers,
      actions: [],
    };
  }

  /**
   * Perform GC action
   */
  private async performGCAction(): Promise<MemoryPressureAction | null> {
    const beforeUsed = process.memoryUsage().heapUsed;
    const success = this.forceGC();
    
    if (!success) {
      return {
        type: 'gc_force',
        description: 'Force garbage collection (failed - global.gc not available)',
        timestamp: new Date(),
        success: false,
      };
    }
    
    // Wait a bit for GC to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const afterUsed = process.memoryUsage().heapUsed;
    const reclaimedMB = (beforeUsed - afterUsed) / (1024 * 1024);
    
    return {
      type: 'gc_force',
      description: 'Forced garbage collection',
      timestamp: new Date(),
      success: true,
      reclaimedMB,
    };
  }

  /**
   * Perform cache eviction action
   */
  private async performCacheEvictionAction(): Promise<MemoryPressureAction | null> {
    // This would integrate with application caches
    // For now, emit an event that the application can listen to
    this.emit('cacheEvictionRequested');
    
    return {
      type: 'cache_clear',
      description: 'Requested cache eviction',
      timestamp: new Date(),
      success: true,
    };
  }

  /**
   * Perform low memory mode action
   */
  private async performLowMemoryModeAction(): Promise<MemoryPressureAction | null> {
    // This would switch the application to low memory mode
    this.emit('lowMemoryModeRequested');
    
    return {
      type: 'mode_switch',
      description: 'Switched to low memory mode',
      timestamp: new Date(),
      success: true,
    };
  }

  /**
   * Linear regression calculation
   */
  private linearRegression(x: number[], y: number[]): { slope: number; correlation: number } {
    const n = x.length;
    if (n < 2) return { slope: 0, correlation: 0 };
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const correlation = denominator !== 0 ? numerator / denominator : 0;
    
    return { slope, correlation };
  }

  /**
   * Check memory thresholds and emit alerts
   */
  private checkMemoryThresholds(): void {
    if (!this.lastSnapshot) return;
    
    const heapUsedMB = this.lastSnapshot.heap.used / (1024 * 1024);
    
    if (heapUsedMB > this.config.thresholds.heapUsageCriticalMB) {
      this.emit('memoryAlert', {
        type: 'critical_memory_usage',
        message: `Critical memory usage: ${heapUsedMB.toFixed(2)}MB`,
        severity: 'critical',
        value: heapUsedMB,
        threshold: this.config.thresholds.heapUsageCriticalMB,
      });
    } else if (heapUsedMB > this.config.thresholds.heapUsageWarningMB) {
      this.emit('memoryAlert', {
        type: 'high_memory_usage',
        message: `High memory usage: ${heapUsedMB.toFixed(2)}MB`,
        severity: 'warning',
        value: heapUsedMB,
        threshold: this.config.thresholds.heapUsageWarningMB,
      });
    }
    
    if (this.lastSnapshot.heap.growthRate > this.config.thresholds.heapGrowthRateWarning) {
      this.emit('memoryAlert', {
        type: 'rapid_memory_growth',
        message: `Rapid memory growth: ${this.lastSnapshot.heap.growthRate.toFixed(2)}MB/sec`,
        severity: 'warning',
        value: this.lastSnapshot.heap.growthRate,
        threshold: this.config.thresholds.heapGrowthRateWarning,
      });
    }
  }

  /**
   * Check GC thresholds
   */
  private checkGCThresholds(gcStats: GCStats): void {
    if (gcStats.duration > this.config.thresholds.gcPauseCriticalMs) {
      this.emit('gcAlert', {
        type: 'critical_gc_pause',
        message: `Critical GC pause: ${gcStats.duration.toFixed(2)}ms`,
        severity: 'critical',
        value: gcStats.duration,
        threshold: this.config.thresholds.gcPauseCriticalMs,
        gcType: gcStats.type,
      });
    } else if (gcStats.duration > this.config.thresholds.gcPauseWarningMs) {
      this.emit('gcAlert', {
        type: 'long_gc_pause',
        message: `Long GC pause: ${gcStats.duration.toFixed(2)}ms`,
        severity: 'warning',
        value: gcStats.duration,
        threshold: this.config.thresholds.gcPauseWarningMs,
        gcType: gcStats.type,
      });
    }
  }

  /**
   * Record snapshot metrics in metrics collector
   */
  private recordSnapshotMetrics(snapshot: MemorySnapshot): void {
    this.metricsCollector.recordMemory({
      heapUsed: snapshot.heap.used,
      heapTotal: snapshot.heap.total,
      external: snapshot.process.external,
      rss: snapshot.process.rss,
      arrayBuffers: snapshot.process.arrayBuffers,
      peak: snapshot.process.peak,
      gc: {
        collections: snapshot.gc.totalCollections,
        duration: snapshot.gc.totalPauseTime,
        reclaimed: 0, // Would need to calculate
      },
    });
    
    this.metricsCollector.setGauge('memory_fragmentation', snapshot.heap.fragmentation, 'ratio');
    this.metricsCollector.setGauge('memory_efficiency', snapshot.process.efficiency, 'ratio');
    this.metricsCollector.setGauge('memory_growth_rate', snapshot.heap.growthRate, 'MB/sec');
    this.metricsCollector.setGauge('gc_efficiency', snapshot.gc.efficiency, 'ratio');
    this.metricsCollector.setGauge('gc_pressure', snapshot.gc.pressure, 'ratio');
  }

  /**
   * Ensure heap dump directory exists
   */
  private async ensureHeapDumpDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.heapDumps.outputDirectory, { recursive: true });
    } catch (error) {
      this.emit('heapDumpDirectoryError', error);
    }
  }

  /**
   * Compress heap dump
   */
  private async compressHeapDump(filepath: string): Promise<void> {
    try {
      const zlib = require('zlib');
      const { createReadStream, createWriteStream } = require('fs');
      
      const compressedPath = `${filepath}.gz`;
      const readStream = createReadStream(filepath);
      const writeStream = createWriteStream(compressedPath);
      const gzipStream = zlib.createGzip();
      
      await new Promise((resolve, reject) => {
        readStream
          .pipe(gzipStream)
          .pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });
      
      // Remove original file
      await fs.unlink(filepath);
      
    } catch (error) {
      this.emit('heapDumpCompressionError', error);
    }
  }

  /**
   * Trim snapshots to maintain memory usage
   */
  private trimSnapshots(): void {
    const maxAge = new Date(Date.now() - this.config.retention.maxAgeHours * 60 * 60 * 1000);
    
    this.snapshots = this.snapshots
      .filter(s => s.timestamp >= maxAge)
      .slice(-this.config.retention.maxSamples);
  }

  /**
   * Trim GC stats
   */
  private trimGCStats(): void {
    const maxAge = new Date(Date.now() - this.config.retention.maxAgeHours * 60 * 60 * 1000);
    
    this.gcStats = this.gcStats
      .filter(gc => gc.timestamp >= maxAge)
      .slice(-this.config.retention.maxSamples);
  }

  /**
   * Trim leak detections
   */
  private trimLeakDetections(): void {
    const maxAge = new Date(Date.now() - this.config.retention.maxAgeHours * 60 * 60 * 1000);
    
    this.leakDetections = this.leakDetections
      .filter(leak => leak.timestamp >= maxAge)
      .slice(-100); // Keep last 100 detections
  }
}

/**
 * Create a memory monitor instance
 */
export function createMemoryMonitor(
  metricsCollector: MetricsCollector,
  config: Partial<MemoryMonitorConfig> = {},
  performanceMonitor?: PerformanceMonitor
): MemoryMonitor {
  return new MemoryMonitor(metricsCollector, config, performanceMonitor);
}

/**
 * Validate memory monitor configuration
 */
export function validateMemoryConfig(config: unknown): MemoryMonitorConfig {
  return MemoryMonitorConfigSchema.parse(config);
}