/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { performance } from 'perf_hooks';
import { createPerformanceMonitor } from './performanceMonitor';
import { z } from 'zod';

/**
 * Configuration for parallel processing
 */
export const ParallelProcessorConfigSchema = z.object({
  maxConcurrency: z.number().min(1).default(cpus().length),
  chunkSize: z.number().min(1).default(100),
  timeoutMs: z.number().min(1000).default(30000),
  enableProgressTracking: z.boolean().default(true),
  enablePerformanceMonitoring: z.boolean().default(true),
  retryAttempts: z.number().min(0).default(2),
  gracefulShutdownTimeoutMs: z.number().min(1000).default(5000),
});

export type ParallelProcessorConfig = z.infer<typeof ParallelProcessorConfigSchema>;

/**
 * Task definition for parallel processing
 */
export interface ProcessingTask<T, R> {
  id: string;
  data: T;
  operation: string;
  metadata?: Record<string, any>;
}

/**
 * Result of a processing task
 */
export interface ProcessingResult<R> {
  taskId: string;
  success: boolean;
  result?: R;
  error?: string;
  duration: number;
  metadata?: Record<string, any>;
}

/**
 * Progress information for parallel processing
 */
export interface ProcessingProgress {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeWorkers: number;
  averageTaskDuration: number;
  estimatedTimeRemaining: number;
  throughputPerSecond: number;
}

/**
 * Parallel processor for CPU-intensive pattern analysis operations
 */
export class ParallelProcessor<T, R> {
  private config: ParallelProcessorConfig;
  private workers: Worker[] = [];
  private taskQueue: ProcessingTask<T, R>[] = [];
  private activeTasksCount = 0;
  private results: ProcessingResult<R>[] = [];
  private performanceMonitor = createPerformanceMonitor({
    enabled: true,
    enableGC: true,
    enableEventLoop: true,
  });
  private startTime = 0;
  private isShuttingDown = false;

  constructor(
    private processor: (data: T) => Promise<R> | R,
    config: Partial<ParallelProcessorConfig> = {}
  ) {
    this.config = ParallelProcessorConfigSchema.parse(config);
  }

  /**
   * Process tasks in parallel with performance monitoring
   */
  public async processInParallel(
    tasks: ProcessingTask<T, R>[],
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult<R>[]> {
    if (this.isShuttingDown) {
      throw new Error('Processor is shutting down');
    }

    this.results = [];
    this.taskQueue = [...tasks];
    this.activeTasksCount = 0;
    this.startTime = performance.now();

    const sessionId = this.config.enablePerformanceMonitoring
      ? this.performanceMonitor.startSession('parallel-processing')
      : null;

    try {
      // Process in chunks to manage memory usage
      const chunks = this.createChunks(tasks, this.config.chunkSize);
      
      for (const chunk of chunks) {
        if (this.isShuttingDown) break;
        
        await this.processChunk(chunk, onProgress);
        
        // Allow garbage collection between chunks
        await this.yieldControl();
      }

      return this.results;
    } catch (error) {
      throw new Error(`Parallel processing failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (sessionId && this.config.enablePerformanceMonitoring) {
        const analysis = this.performanceMonitor.stopSession();
        if (analysis && analysis.bottlenecks.length > 0) {
          console.warn('Performance bottlenecks detected in parallel processing:', 
            analysis.bottlenecks.map(b => `${b.operation}: ${b.averageDuration.toFixed(2)}ms avg`));
        }
      }
    }
  }

  /**
   * Process a single chunk of tasks with concurrency control
   */
  private async processChunk(
    chunk: ProcessingTask<T, R>[],
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<void> {
    const semaphore = new Semaphore(this.config.maxConcurrency);
    
    const chunkPromises = chunk.map(async (task) => {
      if (this.isShuttingDown) return;
      
      await semaphore.acquire();
      this.activeTasksCount++;
      
      try {
        const result = await this.processTaskWithTimeout(task);
        this.results.push(result);
        
        if (onProgress) {
          onProgress(this.calculateProgress());
        }
      } catch (error) {
        const errorResult: ProcessingResult<R> = {
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
        };
        this.results.push(errorResult);
      } finally {
        this.activeTasksCount--;
        semaphore.release();
      }
    });

    await Promise.all(chunkPromises);
  }

  /**
   * Process a single task with timeout and retry logic
   */
  private async processTaskWithTimeout(task: ProcessingTask<T, R>): Promise<ProcessingResult<R>> {
    const measurementId = this.config.enablePerformanceMonitoring
      ? this.performanceMonitor.startMeasurement(`task-${task.operation}`, {
          taskId: task.id,
          operation: task.operation,
        })
      : null;

    let lastError: Error | null = null;
    const startTime = performance.now();

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          () => this.processor(task.data),
          this.config.timeoutMs
        );

        const duration = performance.now() - startTime;
        
        if (measurementId) {
          this.performanceMonitor.endMeasurement(measurementId, {
            success: true,
            attempt: attempt + 1,
          });
        }

        return {
          taskId: task.id,
          success: true,
          result,
          duration,
          metadata: {
            ...task.metadata,
            attempt: attempt + 1,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff for retries
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    const duration = performance.now() - startTime;
    
    if (measurementId) {
      this.performanceMonitor.endMeasurement(measurementId, {
        success: false,
        error: lastError?.message,
        finalAttempt: this.config.retryAttempts + 1,
      });
    }

    return {
      taskId: task.id,
      success: false,
      error: lastError?.message || 'Unknown error',
      duration,
      metadata: {
        ...task.metadata,
        attempts: this.config.retryAttempts + 1,
      },
    };
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn())
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  /**
   * Calculate current processing progress
   */
  private calculateProgress(): ProcessingProgress {
    const completedTasks = this.results.filter(r => r.success).length;
    const failedTasks = this.results.filter(r => !r.success).length;
    const totalTasks = this.taskQueue.length;
    const elapsedTime = performance.now() - this.startTime;
    
    const averageTaskDuration = this.results.length > 0
      ? this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length
      : 0;

    const remainingTasks = totalTasks - this.results.length;
    const estimatedTimeRemaining = remainingTasks > 0 && averageTaskDuration > 0
      ? (remainingTasks * averageTaskDuration) / this.config.maxConcurrency
      : 0;

    const throughputPerSecond = elapsedTime > 0
      ? (this.results.length / elapsedTime) * 1000
      : 0;

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      activeWorkers: this.activeTasksCount,
      averageTaskDuration,
      estimatedTimeRemaining,
      throughputPerSecond,
    };
  }

  /**
   * Create chunks from task array
   */
  private createChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Yield control to allow garbage collection
   */
  private async yieldControl(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gracefully shutdown the processor
   */
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Wait for active tasks to complete or timeout
    const shutdownStart = performance.now();
    while (this.activeTasksCount > 0 && 
           (performance.now() - shutdownStart) < this.config.gracefulShutdownTimeoutMs) {
      await this.delay(100);
    }

    // Force cleanup if needed
    if (this.activeTasksCount > 0) {
      console.warn(`Forced shutdown with ${this.activeTasksCount} active tasks`);
    }
  }

  /**
   * Get current processor statistics
   */
  public getStats(): {
    isProcessing: boolean;
    activeTasks: number;
    queuedTasks: number;
    completedTasks: number;
    failedTasks: number;
    config: ParallelProcessorConfig;
  } {
    return {
      isProcessing: this.activeTasksCount > 0,
      activeTasks: this.activeTasksCount,
      queuedTasks: this.taskQueue.length - this.results.length,
      completedTasks: this.results.filter(r => r.success).length,
      failedTasks: this.results.filter(r => !r.success).length,
      config: this.config,
    };
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
}

/**
 * Factory function to create a parallel processor
 */
export function createParallelProcessor<T, R>(
  processor: (data: T) => Promise<R> | R,
  config: Partial<ParallelProcessorConfig> = {}
): ParallelProcessor<T, R> {
  return new ParallelProcessor(processor, config);
}

/**
 * Handle out-of-memory errors gracefully
 */
export function handleMemoryErrors<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const originalHandler = process.listeners('uncaughtException');
    
    const memoryHandler = (error: Error) => {
      if (error.message.includes('out of memory') || 
          error.message.includes('Maximum call stack')) {
        console.error('Memory error detected, attempting graceful degradation:', error.message);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        reject(new Error('Operation failed due to memory constraints'));
        return;
      }
      
      // Re-throw non-memory errors
      throw error;
    };

    process.once('uncaughtException', memoryHandler);
    
    Promise.resolve(fn())
      .then(resolve)
      .catch(reject)
      .finally(() => {
        process.removeListener('uncaughtException', memoryHandler);
      });
  });
}