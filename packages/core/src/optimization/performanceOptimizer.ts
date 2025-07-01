import { EventEmitter } from 'events';
import * as os from 'os';
import { Worker } from 'worker_threads';

/**
 * Performance metrics for monitoring resource utilization
 */
export interface PerformanceMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  gcStats: {
    collections: number;
    duration: number;
    reclaimedMemory: number;
  };
  operationTiming: {
    vectorizedOps: number;
    parallelOps: number;
    sequentialOps: number;
  };
  resourceLimits: {
    memoryThreshold: number;
    cpuThreshold: number;
    timeoutThreshold: number;
  };
  performance: {
    throughput: number; // operations per second
    latency: number; // average operation time
    efficiency: number; // performance score 0-1
  };
}

/**
 * Configuration options for performance optimization
 */
export interface PerformanceOptimizerConfig {
  // Parallelization settings
  maxWorkers: number;
  workerPoolSize: number;
  enableParallelization: boolean;

  // Memory management
  memoryLimit: number; // in MB
  gcThreshold: number; // trigger GC at this heap usage %
  enableMemoryOptimization: boolean;

  // Vectorization settings
  enableVectorization: boolean;
  batchSize: number;
  vectorThreshold: number; // minimum items for vectorization

  // Resource monitoring
  monitoringInterval: number; // ms
  resourceCheckInterval: number; // ms
  enableResourceMonitoring: boolean;

  // Performance tuning
  operationTimeout: number; // ms
  retryAttempts: number;
  adaptiveOptimization: boolean;

  // Fallback mechanisms
  enableFallbacks: boolean;
  fallbackStrategy: 'sequential' | 'reduced-batch' | 'memory-efficient';
}

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceOptimizerConfig = {
  maxWorkers: Math.min(os.cpus().length, 8),
  workerPoolSize: 4,
  enableParallelization: true,

  memoryLimit: 2048, // 2GB
  gcThreshold: 80,
  enableMemoryOptimization: true,

  enableVectorization: true,
  batchSize: 1000,
  vectorThreshold: 100,

  monitoringInterval: 1000,
  resourceCheckInterval: 5000,
  enableResourceMonitoring: true,

  operationTimeout: 30000,
  retryAttempts: 3,
  adaptiveOptimization: true,

  enableFallbacks: true,
  fallbackStrategy: 'reduced-batch',
};

/**
 * Worker thread task definition
 */
export interface WorkerTask<TInput = any, TOutput = any> {
  id: string;
  type: string;
  data: TInput;
  options?: Record<string, any>;
  timeout?: number;
}

/**
 * Worker thread result
 */
export interface WorkerResult<TOutput = any> {
  taskId: string;
  success: boolean;
  result?: TOutput;
  error?: string;
  metrics?: {
    executionTime: number;
    memoryUsed: number;
  };
}

/**
 * Vectorized operation definition
 */
export interface VectorizedOperation<TInput, TOutput> {
  name: string;
  operation: (batch: TInput[]) => Promise<TOutput[]>;
  validator?: (input: TInput) => boolean;
  batchSize?: number;
}

/**
 * Memory pool for efficient object reuse
 */
export class MemoryPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (item: T) => void;
  private maxSize: number;

  constructor(factory: () => T, reset: (item: T) => void, maxSize: number = 100) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(item: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(item);
      this.pool.push(item);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }

  get size(): number {
    return this.pool.length;
  }
}

/**
 * Advanced performance optimizer with vectorization, parallelization, and resource management
 */
export class PerformanceOptimizer extends EventEmitter {
  private config: PerformanceOptimizerConfig;
  private metrics: PerformanceMetrics;
  private workers: Worker[] = [];
  private workerQueue: Map<string, WorkerTask> = new Map();
  private activeOperations: Set<string> = new Set();
  private memoryPools: Map<string, MemoryPool<any>> = new Map();
  private resourceMonitor: NodeJS.Timeout | null = null;
  private gcStats = { collections: 0, duration: 0, reclaimedMemory: 0 };
  private operationTimers: Map<string, number> = new Map();

  constructor(config: Partial<PerformanceOptimizerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.metrics = this.initializeMetrics();

    if (this.config.enableResourceMonitoring) {
      this.startResourceMonitoring();
    }

    if (this.config.enableParallelization) {
      this.initializeWorkerPool();
    }

    // Set up GC monitoring
    if (this.config.enableMemoryOptimization) {
      this.setupGCMonitoring();
    }
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        arrayBuffers: memUsage.arrayBuffers || 0,
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      gcStats: { ...this.gcStats },
      operationTiming: {
        vectorizedOps: 0,
        parallelOps: 0,
        sequentialOps: 0,
      },
      resourceLimits: {
        memoryThreshold: this.config.memoryLimit * 1024 * 1024,
        cpuThreshold: 80, // 80% CPU usage
        timeoutThreshold: this.config.operationTimeout,
      },
      performance: {
        throughput: 0,
        latency: 0,
        efficiency: 1.0,
      },
    };
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      this.updateMetrics();
      this.checkResourceLimits();
      this.emit('metrics-updated', this.metrics);
    }, this.config.monitoringInterval);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
    };

    this.metrics.cpuUsage = {
      user: cpuUsage.user,
      system: cpuUsage.system,
    };

    this.metrics.gcStats = { ...this.gcStats };

    // Calculate performance metrics
    this.calculatePerformanceScores();
  }

  /**
   * Calculate performance scores
   */
  private calculatePerformanceScores(): void {
    const totalOps =
      this.metrics.operationTiming.vectorizedOps +
      this.metrics.operationTiming.parallelOps +
      this.metrics.operationTiming.sequentialOps;

    if (totalOps > 0) {
      this.metrics.performance.throughput = totalOps / (Date.now() / 1000);

      // Calculate efficiency based on vectorized vs sequential operations
      const vectorizedRatio = this.metrics.operationTiming.vectorizedOps / totalOps;
      const parallelRatio = this.metrics.operationTiming.parallelOps / totalOps;
      this.metrics.performance.efficiency = vectorizedRatio * 0.5 + parallelRatio * 0.3 + 0.2;
    }
  }

  /**
   * Check resource limits and trigger actions if needed
   */
  private checkResourceLimits(): void {
    const { memoryUsage, resourceLimits } = this.metrics;

    // Check memory usage
    if (memoryUsage.heapUsed > resourceLimits.memoryThreshold * 0.8) {
      this.emit('resource-warning', {
        type: 'memory',
        usage: memoryUsage.heapUsed,
        limit: resourceLimits.memoryThreshold,
      });

      if (this.config.enableMemoryOptimization) {
        this.triggerGarbageCollection();
      }
    }

    // Check if we're approaching memory limit
    if (memoryUsage.heapUsed > resourceLimits.memoryThreshold) {
      this.emit('resource-critical', {
        type: 'memory',
        usage: memoryUsage.heapUsed,
        limit: resourceLimits.memoryThreshold,
      });

      if (this.config.enableFallbacks) {
        this.activateFallbackStrategy();
      }
    }
  }

  /**
   * Set up garbage collection monitoring
   */
  private setupGCMonitoring(): void {
    // Note: In production, you might want to use external monitoring tools
    // This is a simplified implementation
    const originalGC = global.gc;
    if (originalGC) {
      global.gc = () => {
        const before = process.memoryUsage().heapUsed;
        const start = process.hrtime.bigint();

        originalGC();

        const after = process.memoryUsage().heapUsed;
        const duration = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms

        this.gcStats.collections++;
        this.gcStats.duration += duration;
        this.gcStats.reclaimedMemory += Math.max(0, before - after);
      };
    }
  }

  /**
   * Trigger garbage collection if available
   */
  private triggerGarbageCollection(): void {
    if (global.gc && this.config.enableMemoryOptimization) {
      global.gc();
      this.emit('gc-triggered', this.gcStats);
    }
  }

  /**
   * Initialize worker pool for parallel processing
   */
  private initializeWorkerPool(): void {
    const workerScript = `
      const { parentPort } = require('worker_threads');

      parentPort.on('message', async (task) => {
        const startTime = process.hrtime.bigint();
        const startMemory = process.memoryUsage().heapUsed;

        try {
          // Execute the task based on type
          let result;
          switch (task.type) {
            case 'css-optimization':
              result = await optimizeCSS(task.data);
              break;
            case 'pattern-analysis':
              result = await analyzePatterns(task.data);
              break;
            case 'vectorized-operation':
              result = await executeVectorizedOperation(task.data);
              break;
            default:
              throw new Error(\`Unknown task type: \${task.type}\`);
          }

          const endTime = process.hrtime.bigint();
          const endMemory = process.memoryUsage().heapUsed;

          parentPort.postMessage({
            taskId: task.id,
            success: true,
            result,
            metrics: {
              executionTime: Number(endTime - startTime) / 1e6,
              memoryUsed: endMemory - startMemory
            }
          });
        } catch (error) {
          parentPort.postMessage({
            taskId: task.id,
            success: false,
            error: error.message
          });
        }
      });

      // Placeholder functions - these would be implemented based on actual needs
      async function optimizeCSS(data) {
        // CSS optimization logic
        return { optimized: true, data };
      }

      async function analyzePatterns(data) {
        // Pattern analysis logic
        return { patterns: [], data };
      }

      async function executeVectorizedOperation(data) {
        // Vectorized operation logic
        return { result: data.map(item => item * 2) }; // Example
      }
    `;

    // Create worker pool
    for (let i = 0; i < this.config.workerPoolSize; i++) {
      try {
        const worker = new Worker(workerScript, { eval: true });

        worker.on('message', (result: WorkerResult) => {
          this.handleWorkerResult(result);
        });

        worker.on('error', (error) => {
          this.emit('worker-error', { workerId: i, error: error.message });
        });

        this.workers.push(worker);
      } catch (error) {
        // Worker threads might not be available in all environments
        console.warn('Worker thread creation failed:', error);
        this.config.enableParallelization = false;
        break;
      }
    }
  }

  /**
   * Handle worker result
   */
  private handleWorkerResult(result: WorkerResult): void {
    const task = this.workerQueue.get(result.taskId);
    if (task) {
      this.workerQueue.delete(result.taskId);
      this.activeOperations.delete(result.taskId);

      if (result.success) {
        this.metrics.operationTiming.parallelOps++;
      }

      this.emit('task-completed', { task, result });
    }
  }

  /**
   * Execute vectorized operations on batch data
   */
  async executeVectorizedOperation<TInput, TOutput>(
    operation: VectorizedOperation<TInput, TOutput>,
    data: TInput[]
  ): Promise<TOutput[]> {
    const startTime = Date.now();
    const operationId = `vectorized-${operation.name}-${startTime}`;

    this.operationTimers.set(operationId, startTime);
    this.activeOperations.add(operationId);

    try {
      if (!this.config.enableVectorization || data.length < this.config.vectorThreshold) {
        // Fall back to sequential processing
        return await this.executeSequentialOperation(operation, data, operationId);
      }

      const batchSize = operation.batchSize || this.config.batchSize;
      const results: TOutput[] = [];

      // Process in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        // Validate batch if validator is provided
        if (operation.validator) {
          const validBatch = batch.filter(operation.validator);
          if (validBatch.length !== batch.length) {
            this.emit('validation-warning', {
              operation: operation.name,
              invalid: batch.length - validBatch.length,
              total: batch.length,
            });
          }
        }

        try {
          const batchResults = await Promise.race([
            operation.operation(batch),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Operation timeout')), this.config.operationTimeout)
            ),
          ]);

          results.push(...batchResults);
        } catch (error) {
          if (this.config.enableFallbacks) {
            // Fallback to sequential processing for this batch
            const fallbackResults = await this.executeSequentialBatch(operation, batch);
            results.push(...fallbackResults);
          } else {
            throw error;
          }
        }
      }

      this.metrics.operationTiming.vectorizedOps++;
      this.emit('vectorized-operation-completed', {
        operation: operation.name,
        inputSize: data.length,
        outputSize: results.length,
        duration: Date.now() - startTime,
      });

      return results;
    } catch (error) {
      this.emit('operation-error', {
        operation: operation.name,
        error: error instanceof Error ? error.message : String(error),
        inputSize: data.length,
      });
      throw error;
    } finally {
      this.operationTimers.delete(operationId);
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Execute sequential operation as fallback
   */
  private async executeSequentialOperation<TInput, TOutput>(
    operation: VectorizedOperation<TInput, TOutput>,
    data: TInput[],
    operationId: string
  ): Promise<TOutput[]> {
    const results: TOutput[] = [];

    for (const item of data) {
      try {
        const result = await operation.operation([item]);
        results.push(...result);
      } catch (error) {
        this.emit('sequential-item-error', {
          operation: operation.name,
          error: error instanceof Error ? error.message : String(error),
        });

        if (!this.config.enableFallbacks) {
          throw error;
        }
      }
    }

    this.metrics.operationTiming.sequentialOps++;
    return results;
  }

  /**
   * Execute sequential batch processing
   */
  private async executeSequentialBatch<TInput, TOutput>(
    operation: VectorizedOperation<TInput, TOutput>,
    batch: TInput[]
  ): Promise<TOutput[]> {
    const results: TOutput[] = [];

    for (const item of batch) {
      try {
        const result = await operation.operation([item]);
        results.push(...result);
      } catch (error) {
        // Skip individual items that fail
        continue;
      }
    }

    return results;
  }

  /**
   * Execute parallel task
   */
  async executeParallelTask<TInput, TOutput>(
    task: Omit<WorkerTask<TInput, TOutput>, 'id'>
  ): Promise<TOutput> {
    if (!this.config.enableParallelization || this.workers.length === 0) {
      throw new Error('Parallel processing not available');
    }

    const taskId = `parallel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullTask: WorkerTask<TInput, TOutput> = {
      ...task,
      id: taskId,
      timeout: task.timeout || this.config.operationTimeout,
    };

    return new Promise((resolve, reject) => {
      // Find available worker
      const worker = this.workers[this.workerQueue.size % this.workers.length];

      // Set up timeout
      const timeout = setTimeout(() => {
        this.workerQueue.delete(taskId);
        this.activeOperations.delete(taskId);
        reject(new Error(`Task ${taskId} timed out`));
      }, fullTask.timeout);

      // Set up result handler
      const resultHandler = (result: WorkerResult<TOutput>) => {
        if (result.taskId === taskId) {
          clearTimeout(timeout);
          worker.off('message', resultHandler);

          if (result.success) {
            resolve(result.result!);
          } else {
            reject(new Error(result.error || 'Task failed'));
          }
        }
      };

      worker.on('message', resultHandler);

      // Queue and send task
      this.workerQueue.set(taskId, fullTask);
      this.activeOperations.add(taskId);
      worker.postMessage(fullTask);
    });
  }

  /**
   * Create memory pool for efficient object reuse
   */
  createMemoryPool<T>(
    name: string,
    factory: () => T,
    reset: (item: T) => void,
    maxSize?: number
  ): MemoryPool<T> {
    const pool = new MemoryPool(factory, reset, maxSize);
    this.memoryPools.set(name, pool);
    return pool;
  }

  /**
   * Get memory pool by name
   */
  getMemoryPool<T>(name: string): MemoryPool<T> | undefined {
    return this.memoryPools.get(name);
  }

  /**
   * Activate fallback strategy when resources are constrained
   */
  private activateFallbackStrategy(): void {
    switch (this.config.fallbackStrategy) {
      case 'sequential':
        this.config.enableParallelization = false;
        this.config.enableVectorization = false;
        break;

      case 'reduced-batch':
        this.config.batchSize = Math.max(10, Math.floor(this.config.batchSize / 2));
        this.config.workerPoolSize = Math.max(1, Math.floor(this.config.workerPoolSize / 2));
        break;

      case 'memory-efficient':
        this.config.batchSize = Math.max(10, Math.floor(this.config.batchSize / 4));
        this.triggerGarbageCollection();
        this.clearMemoryPools();
        break;
    }

    this.emit('fallback-activated', {
      strategy: this.config.fallbackStrategy,
      newConfig: this.config,
    });
  }

  /**
   * Clear all memory pools to free memory
   */
  private clearMemoryPools(): void {
    this.memoryPools.forEach((pool) => pool.clear());
    this.emit('memory-pools-cleared', { pools: this.memoryPools.size });
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceOptimizerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PerformanceOptimizerConfig>): void {
    this.config = { ...this.config, ...updates };

    // Apply configuration changes
    if (updates.enableResourceMonitoring !== undefined) {
      if (updates.enableResourceMonitoring && !this.resourceMonitor) {
        this.startResourceMonitoring();
      } else if (!updates.enableResourceMonitoring && this.resourceMonitor) {
        clearInterval(this.resourceMonitor);
        this.resourceMonitor = null;
      }
    }

    this.emit('config-updated', this.config);
  }

  /**
   * Get resource utilization summary
   */
  getResourceSummary(): {
    memory: { usage: number; percentage: number };
    activeOperations: number;
    workerQueue: number;
    memoryPools: number;
  } {
    const memoryUsage = this.metrics.memoryUsage.heapUsed;
    const memoryLimit = this.metrics.resourceLimits.memoryThreshold;

    return {
      memory: {
        usage: memoryUsage,
        percentage: (memoryUsage / memoryLimit) * 100,
      },
      activeOperations: this.activeOperations.size,
      workerQueue: this.workerQueue.size,
      memoryPools: this.memoryPools.size,
    };
  }

  /**
   * Shutdown performance optimizer and clean up resources
   */
  async shutdown(): Promise<void> {
    // Stop resource monitoring
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }

    // Terminate workers
    const terminationPromises = this.workers.map(
      (worker) =>
        new Promise<void>((resolve) => {
          worker
            .terminate()
            .then(() => resolve())
            .catch(() => resolve());
        })
    );

    await Promise.all(terminationPromises);
    this.workers.length = 0;

    // Clear queues and pools
    this.workerQueue.clear();
    this.activeOperations.clear();
    this.clearMemoryPools();
    this.operationTimers.clear();

    this.emit('shutdown-complete');
  }
}

/**
 * Create performance optimizer with default configuration
 */
export function createPerformanceOptimizer(
  config?: Partial<PerformanceOptimizerConfig>
): PerformanceOptimizer {
  return new PerformanceOptimizer(config);
}

/**
 * Performance optimization utilities
 */
export class PerformanceUtils {
  /**
   * Benchmark operation execution time
   */
  static async benchmark<T>(
    operation: () => Promise<T> | T,
    iterations: number = 1
  ): Promise<{ result: T; averageTime: number; totalTime: number }> {
    const times: number[] = [];
    let result: T;

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      result = await operation();
      const end = process.hrtime.bigint();

      times.push(Number(end - start) / 1e6); // Convert to milliseconds
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;

    return {
      result: result!,
      averageTime,
      totalTime,
    };
  }

  /**
   * Memory-efficient chunk processing
   */
  static async processInChunks<TInput, TOutput>(
    data: TInput[],
    processor: (chunk: TInput[]) => Promise<TOutput[]>,
    chunkSize: number = 1000
  ): Promise<TOutput[]> {
    const results: TOutput[] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);

      // Allow garbage collection between chunks
      if (global.gc && i > 0 && i % (chunkSize * 10) === 0) {
        global.gc();
      }
    }

    return results;
  }

  /**
   * Create optimized array for large datasets
   */
  static createOptimizedArray<T>(size: number, initialValue?: T): T[] {
    const array = new Array(size);
    if (initialValue !== undefined) {
      array.fill(initialValue);
    }
    return array;
  }

  /**
   * Efficient array deduplication
   */
  static deduplicateArray<T>(array: T[], keyExtractor?: (item: T) => string | number): T[] {
    if (keyExtractor) {
      const seen = new Set<string | number>();
      return array.filter((item) => {
        const key = keyExtractor(item);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    return [...new Set(array)];
  }
}

export default PerformanceOptimizer;
