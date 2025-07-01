import { performance } from 'perf_hooks';
import { createLogger } from '../../utils/logger';
import { BenchmarkMetrics } from '../types';

const logger = createLogger('MetricsCollector');

/**
 * Snapshot of metrics at a point in time
 */
interface MetricsSnapshot {
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  hrTime: [number, number];
  performanceMark: number;
}

/**
 * Collects performance metrics during benchmark execution
 */
export class MetricsCollector {
  private fileOpCount = 0;
  private networkOpCount = 0;
  private cacheHitCount = 0;
  private cacheMissCount = 0;
  private bytesProcessedCount = 0;
  private filesProcessedCount = 0;
  private customMetrics: Map<string, number> = new Map();

  constructor() {
    this.reset();
  }

  /**
   * Start metrics collection
   */
  start(): MetricsSnapshot {
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      hrTime: process.hrtime(),
      performanceMark: performance.now(),
    };

    // Reset counters
    this.reset();

    logger.debug('Metrics collection started', {
      timestamp: snapshot.timestamp,
      initialMemory: Math.round(snapshot.memoryUsage.heapUsed / 1024 / 1024) + 'MB',
    });

    return snapshot;
  }

  /**
   * Stop metrics collection and calculate differences
   */
  async stop(startSnapshot: MetricsSnapshot): Promise<BenchmarkMetrics> {
    const endSnapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      hrTime: process.hrtime(),
      performanceMark: performance.now(),
    };

    // Calculate CPU usage difference
    const cpuDiff = process.cpuUsage(startSnapshot.cpuUsage);

    // Calculate high-resolution time difference
    const hrTimeDiff = process.hrtime(startSnapshot.hrTime);
    const elapsedNanoseconds = hrTimeDiff[0] * 1e9 + hrTimeDiff[1];
    const elapsedMilliseconds = elapsedNanoseconds / 1e6;

    // Calculate memory usage (use peak values)
    const memoryUsage = {
      rss: Math.max(startSnapshot.memoryUsage.rss, endSnapshot.memoryUsage.rss),
      heapTotal: Math.max(startSnapshot.memoryUsage.heapTotal, endSnapshot.memoryUsage.heapTotal),
      heapUsed: Math.max(startSnapshot.memoryUsage.heapUsed, endSnapshot.memoryUsage.heapUsed),
      external: Math.max(startSnapshot.memoryUsage.external, endSnapshot.memoryUsage.external),
      arrayBuffers: Math.max(
        startSnapshot.memoryUsage.arrayBuffers,
        endSnapshot.memoryUsage.arrayBuffers
      ),
    };

    // Calculate optimization ratio
    const optimizationRatio = this.calculateOptimizationRatio();

    const metrics: BenchmarkMetrics = {
      memoryUsage,
      cpuUsage: cpuDiff,
      fileOps: this.fileOpCount,
      networkOps: this.networkOpCount,
      cacheHits: this.cacheHitCount,
      cacheMisses: this.cacheMissCount,
      bytesProcessed: this.bytesProcessedCount,
      filesProcessed: this.filesProcessedCount,
      optimizationRatio,
      customMetrics: Object.fromEntries(this.customMetrics),
    };

    logger.debug('Metrics collection stopped', {
      duration: elapsedMilliseconds,
      memoryDelta: Math.round((endSnapshot.memoryUsage.heapUsed - startSnapshot.memoryUsage.heapUsed) / 1024 / 1024) + 'MB',
      fileOps: this.fileOpCount,
      cacheHitRatio: this.getCacheHitRatio(),
    });

    return metrics;
  }

  /**
   * Record a file operation
   */
  recordFileOperation(): void {
    this.fileOpCount++;
  }

  /**
   * Record multiple file operations
   */
  recordFileOperations(count: number): void {
    this.fileOpCount += count;
  }

  /**
   * Record a network operation
   */
  recordNetworkOperation(): void {
    this.networkOpCount++;
  }

  /**
   * Record multiple network operations
   */
  recordNetworkOperations(count: number): void {
    this.networkOpCount += count;
  }

  /**
   * Record a cache hit
   */
  recordCacheHit(): void {
    this.cacheHitCount++;
  }

  /**
   * Record multiple cache hits
   */
  recordCacheHits(count: number): void {
    this.cacheHitCount += count;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(): void {
    this.cacheMissCount++;
  }

  /**
   * Record multiple cache misses
   */
  recordCacheMisses(count: number): void {
    this.cacheMissCount += count;
  }

  /**
   * Record bytes processed
   */
  recordBytesProcessed(bytes: number): void {
    this.bytesProcessedCount += bytes;
  }

  /**
   * Record files processed
   */
  recordFilesProcessed(count: number = 1): void {
    this.filesProcessedCount += count;
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name: string, value: number): void {
    this.customMetrics.set(name, value);
  }

  /**
   * Increment custom metric
   */
  incrementCustomMetric(name: string, increment: number = 1): void {
    const current = this.customMetrics.get(name) || 0;
    this.customMetrics.set(name, current + increment);
  }

  /**
   * Get current cache hit ratio
   */
  getCacheHitRatio(): number {
    const total = this.cacheHitCount + this.cacheMissCount;
    return total > 0 ? this.cacheHitCount / total : 0;
  }

  /**
   * Get current metrics snapshot without stopping collection
   */
  getCurrentMetrics(): Partial<BenchmarkMetrics> {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      fileOps: this.fileOpCount,
      networkOps: this.networkOpCount,
      cacheHits: this.cacheHitCount,
      cacheMisses: this.cacheMissCount,
      bytesProcessed: this.bytesProcessedCount,
      filesProcessed: this.filesProcessedCount,
      optimizationRatio: this.calculateOptimizationRatio(),
      customMetrics: Object.fromEntries(this.customMetrics),
    };
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.fileOpCount = 0;
    this.networkOpCount = 0;
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
    this.bytesProcessedCount = 0;
    this.filesProcessedCount = 0;
    this.customMetrics.clear();
  }

  /**
   * Calculate optimization ratio based on processed data
   */
  private calculateOptimizationRatio(): number {
    // This is a placeholder - actual implementation would depend on
    // specific optimization metrics being tracked
    if (this.bytesProcessedCount === 0) return 0;
    
    // Example: assume some baseline compression/optimization ratio
    // This should be replaced with actual optimization calculations
    const baselineSize = this.bytesProcessedCount;
    const optimizedSize = baselineSize * 0.7; // Assume 30% reduction
    return (baselineSize - optimizedSize) / baselineSize;
  }

  /**
   * Create a child collector that inherits from this one
   */
  createChild(): MetricsCollector {
    const child = new MetricsCollector();
    
    // Copy current state to child
    child.fileOpCount = this.fileOpCount;
    child.networkOpCount = this.networkOpCount;
    child.cacheHitCount = this.cacheHitCount;
    child.cacheMissCount = this.cacheMissCount;
    child.bytesProcessedCount = this.bytesProcessedCount;
    child.filesProcessedCount = this.filesProcessedCount;
    child.customMetrics = new Map(this.customMetrics);
    
    return child;
  }

  /**
   * Merge metrics from another collector
   */
  merge(other: MetricsCollector): void {
    this.fileOpCount += other.fileOpCount;
    this.networkOpCount += other.networkOpCount;
    this.cacheHitCount += other.cacheHitCount;
    this.cacheMissCount += other.cacheMissCount;
    this.bytesProcessedCount += other.bytesProcessedCount;
    this.filesProcessedCount += other.filesProcessedCount;
    
    // Merge custom metrics
    for (const [key, value] of other.customMetrics) {
      const current = this.customMetrics.get(key) || 0;
      this.customMetrics.set(key, current + value);
    }
  }

  /**
   * Get formatted metrics summary for logging
   */
  getSummary(): string {
    const cacheHitRatio = this.getCacheHitRatio();
    const memUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    
    return [
      `Memory: ${memUsageMB}MB`,
      `Files: ${this.filesProcessedCount}`,
      `Bytes: ${this.formatBytes(this.bytesProcessedCount)}`,
      `Cache: ${(cacheHitRatio * 100).toFixed(1)}%`,
      `FileOps: ${this.fileOpCount}`,
      `Custom: ${this.customMetrics.size} metrics`,
    ].join(', ');
  }

  /**
   * Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}