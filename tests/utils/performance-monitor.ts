import { performance, PerformanceObserver } from 'perf_hooks';
import { cpus, freemem, totalmem } from 'os';

export interface PerformanceMetrics {
  duration: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  timestamp: number;
  operation: string;
  metadata?: Record<string, any>;
}

export interface BenchmarkResult {
  operation: string;
  metrics: PerformanceMetrics[];
  summary: {
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalDuration: number;
    iterations: number;
    throughput: number; // operations per second
    memoryPeak: number;
    memoryAverage: number;
  };
  baseline?: BenchmarkResult;
  comparison?: {
    speedup: number; // positive means faster, negative means slower
    memoryReduction: number; // positive means less memory, negative means more
    throughputImprovement: number;
  };
}

export interface SystemMetrics {
  timestamp: number;
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  cpu: {
    cores: number;
    loadAverage: number[];
    frequency: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private observers: PerformanceObserver[] = [];
  private baselines = new Map<string, BenchmarkResult>();
  private isMonitoring = false;

  constructor() {
    this.setupPerformanceObservers();
  }

  /**
   * Start monitoring an operation
   */
  startOperation(operation: string, metadata?: Record<string, any>): PerformanceTimer {
    const startTime = performance.now();
    const startCpuUsage = process.cpuUsage();
    const startMemory = process.memoryUsage();

    return {
      end: (): PerformanceMetrics => {
        const endTime = performance.now();
        const endCpuUsage = process.cpuUsage(startCpuUsage);
        const endMemory = process.memoryUsage();

        const metrics: PerformanceMetrics = {
          duration: endTime - startTime,
          memoryUsage: endMemory,
          cpuUsage: {
            user: endCpuUsage.user / 1000, // Convert microseconds to milliseconds
            system: endCpuUsage.system / 1000
          },
          timestamp: Date.now(),
          operation,
          metadata
        };

        this.metrics.push(metrics);
        return metrics;
      }
    };
  }

  /**
   * Benchmark an operation multiple times
   */
  async benchmark(
    operation: string,
    fn: () => Promise<any> | any,
    options: {
      iterations?: number;
      warmupIterations?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<BenchmarkResult> {
    const {
      iterations = 100,
      warmupIterations = 10,
      metadata = {}
    } = options;

    // Warmup runs
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Actual benchmark runs
    const metrics: PerformanceMetrics[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const timer = this.startOperation(operation, { ...metadata, iteration: i });
      
      try {
        await fn();
      } catch (error) {
        timer.end();
        throw new Error(`Benchmark failed on iteration ${i}: ${error}`);
      }
      
      const metric = timer.end();
      metrics.push(metric);

      // Allow event loop to breathe
      if (i % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    const summary = this.calculateSummary(metrics);
    
    const result: BenchmarkResult = {
      operation,
      metrics,
      summary
    };

    // Compare with baseline if available
    const baseline = this.baselines.get(operation);
    if (baseline) {
      result.baseline = baseline;
      result.comparison = this.compareResults(result, baseline);
    }

    return result;
  }

  /**
   * Set baseline for an operation
   */
  setBaseline(operation: string, result: BenchmarkResult): void {
    this.baselines.set(operation, result);
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const memTotal = totalmem();
    const memFree = freemem();
    const memUsed = memTotal - memFree;

    return {
      timestamp: Date.now(),
      memory: {
        total: memTotal,
        free: memFree,
        used: memUsed,
        percentage: (memUsed / memTotal) * 100
      },
      cpu: {
        cores: cpus().length,
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
        frequency: cpus()[0]?.speed || 0
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(interval: number = 1000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    const monitoringTimer = setInterval(() => {
      const metrics = this.getSystemMetrics();
      this.emit('systemMetrics', metrics);
    }, interval);

    // Store timer for cleanup
    (this as any).monitoringTimer = monitoringTimer;
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if ((this as any).monitoringTimer) {
      clearInterval((this as any).monitoringTimer);
      delete (this as any).monitoringTimer;
    }
  }

  /**
   * Get metrics for an operation
   */
  getMetrics(operation?: string): PerformanceMetrics[] {
    if (!operation) {
      return [...this.metrics];
    }
    
    return this.metrics.filter(m => m.operation === operation);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      baselines: Object.fromEntries(this.baselines),
      timestamp: Date.now(),
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: cpus().length
      }
    }, null, 2);
  }

  /**
   * Import metrics from JSON
   */
  importMetrics(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      this.metrics = data.metrics || [];
      
      if (data.baselines) {
        this.baselines = new Map(Object.entries(data.baselines));
      }
    } catch (error) {
      throw new Error(`Failed to import metrics: ${error}`);
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(metrics: PerformanceMetrics[]): BenchmarkResult['summary'] {
    const durations = metrics.map(m => m.duration);
    const memoryUsages = metrics.map(m => m.memoryUsage.heapUsed);
    
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    const memoryPeak = Math.max(...memoryUsages);
    const memoryAverage = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length;
    
    // Calculate throughput (operations per second)
    const throughput = durations.length / (totalDuration / 1000);

    return {
      averageDuration,
      minDuration,
      maxDuration,
      totalDuration,
      iterations: durations.length,
      throughput,
      memoryPeak,
      memoryAverage
    };
  }

  /**
   * Compare two benchmark results
   */
  private compareResults(current: BenchmarkResult, baseline: BenchmarkResult): BenchmarkResult['comparison'] {
    const speedup = (baseline.summary.averageDuration - current.summary.averageDuration) / baseline.summary.averageDuration;
    const memoryReduction = (baseline.summary.memoryAverage - current.summary.memoryAverage) / baseline.summary.memoryAverage;
    const throughputImprovement = (current.summary.throughput - baseline.summary.throughput) / baseline.summary.throughput;

    return {
      speedup,
      memoryReduction,
      throughputImprovement
    };
  }

  /**
   * Setup performance observers
   */
  private setupPerformanceObservers(): void {
    // Mark observer for performance marks
    const markObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.emit('performanceMark', entry);
      }
    });

    markObserver.observe({ entryTypes: ['mark'] });
    this.observers.push(markObserver);

    // Measure observer for performance measures
    const measureObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.emit('performanceMeasure', entry);
      }
    });

    measureObserver.observe({ entryTypes: ['measure'] });
    this.observers.push(measureObserver);
  }

  /**
   * Simple event emitter functionality
   */
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(data);
        } catch (error) {
          console.warn(`Error in performance monitor listener:`, error);
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopMonitoring();
    
    for (const observer of this.observers) {
      observer.disconnect();
    }
    
    this.observers = [];
    this.listeners.clear();
  }
}

export interface PerformanceTimer {
  end(): PerformanceMetrics;
}

// Utility functions for common performance patterns
export class PerformanceUtils {
  /**
   * Measure memory usage of a function
   */
  static async measureMemory<T>(fn: () => Promise<T> | T): Promise<{ result: T; memoryDelta: number }> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const beforeMemory = process.memoryUsage();
    const result = await fn();
    
    if (global.gc) {
      global.gc();
    }
    
    const afterMemory = process.memoryUsage();
    const memoryDelta = afterMemory.heapUsed - beforeMemory.heapUsed;

    return { result, memoryDelta };
  }

  /**
   * Time a function execution
   */
  static async time<T>(fn: () => Promise<T> | T): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    return { result, duration };
  }

  /**
   * Create a throttled function for performance testing
   */
  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): T & { flush(): void; cancel(): void } {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastArgs: Parameters<T>;

    const throttled = (...args: Parameters<T>) => {
      lastArgs = args;
      
      if (timeoutId === null) {
        timeoutId = setTimeout(() => {
          fn.apply(null, lastArgs);
          timeoutId = null;
        }, delay);
      }
    };

    throttled.flush = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        fn.apply(null, lastArgs);
      }
    };

    throttled.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    return throttled as T & { flush(): void; cancel(): void };
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format duration to human readable string
   */
  static formatDuration(ms: number): string {
    if (ms < 1) return `${Math.round(ms * 1000)}μs`;
    if (ms < 1000) return `${Math.round(ms * 100) / 100}ms`;
    if (ms < 60000) return `${Math.round(ms / 10) / 100}s`;
    return `${Math.round(ms / 60000 * 100) / 100}min`;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor(); 