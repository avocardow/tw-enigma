/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Worker Thread Pool Manager for Tailwind Enigma Core
 *
 * Provides high-performance parallel processing using Node.js worker threads
 * with intelligent load balancing, error recovery, and performance monitoring.
 */

import {
  Worker,
  isMainThread,
  // MessageChannel - removed, not used
  // MessagePort - removed, not used
} from "worker_threads";
import { EventEmitter } from "events";
import { cpus } from "os";
import { resolve } from "path";
import { createLogger } from "../logger.ts";
import type { WorkerConfig, WorkerTask /* PerformanceMetrics - removed, not used */ } from "./config.ts";

const logger = createLogger("WorkerManager");

/**
 * Worker state tracking
 */
interface WorkerState {
  id: string;
  worker: Worker;
  busy: boolean;
  tasks: number;
  errors: number;
  startTime: number;
  lastActivity: number;
  memoryUsage: number;
}

/**
 * Task execution context
 */
interface TaskContext<T = unknown, R = unknown> {
  task: WorkerTask<T, R>;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
  startTime: number;
  timeout?: NodeJS.Timeout;
}

/**
 * Worker pool statistics
 */
interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  busyWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
  throughput: number;
  errorRate: number;
}

/**
 * High-performance worker thread pool manager
 */
export class WorkerManager extends EventEmitter {
  private workers: Map<string, WorkerState> = new Map();
  private taskQueue: TaskContext<unknown, unknown>[] = [];
  private runningTasks: Map<string, TaskContext<unknown, unknown>> = new Map();
  private workerScripts: Map<string, string> = new Map();
  private stats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalExecutionTime: 0,
    startTime: Date.now(),
  };

  private config: WorkerConfig;
  private isShuttingDown = false;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: Partial<WorkerConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      poolSize: Math.max(2, Math.min(8, cpus().length)),
      taskTimeout: 30000, // 30 seconds
      maxQueueSize: 1000,
      enableFallback: true,
      ...config,
    };

    // Validate environment
    if (!isMainThread) {
      throw new Error("WorkerManager can only be used in the main thread");
    }

    logger.info("WorkerManager initialized", {
      poolSize: this.config.poolSize,
      taskTimeout: this.config.taskTimeout,
      maxQueueSize: this.config.maxQueueSize,
    });
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("Worker threads disabled, using fallback mode");
      return;
    }

    logger.info("Initializing worker pool", { poolSize: this.config.poolSize });

    // Create worker pool
    const workerPromises = Array.from(
      { length: this.config.poolSize },
      (_, i) => this.createWorker(`worker-${i}`),
    );

    await Promise.all(workerPromises);

    // Start metrics collection
    this.startMetricsCollection();

    logger.info("Worker pool initialized successfully", {
      activeWorkers: this.workers.size,
    });
  }

  /**
   * Register a worker script for specific task types
   */
  registerWorkerScript(taskType: string, scriptPath: string): void {
    const absolutePath = resolve(scriptPath);
    this.workerScripts.set(taskType, absolutePath);

    logger.debug("Registered worker script", {
      taskType,
      scriptPath: absolutePath,
    });
  }

  /**
   * Execute a task using worker threads
   */
  async executeTask<T = unknown, R = unknown>(
    task: WorkerTask<T, R>,
  ): Promise<R> {
    if (!this.config.enabled) {
      throw new Error("Worker execution is disabled. Use fallback mode.");
    }

    if (this.isShuttingDown) {
      throw new Error("Worker pool is shutting down");
    }

    if (this.taskQueue.length >= this.config.maxQueueSize) {
      throw new Error(`Task queue is full (${this.config.maxQueueSize} tasks)`);
    }

    return new Promise<R>((resolve, reject) => {
      // Generate unique ID if not provided or override the provided one
      const uniqueId =
        task.id ||
        `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const taskContext: TaskContext<T, R> = {
        task: { ...task, id: uniqueId },
        resolve,
        reject,
        startTime: Date.now(),
      };

      // Set task timeout
      if (this.config.taskTimeout > 0) {
        taskContext.timeout = setTimeout(() => {
          this.handleTaskTimeout(taskContext as TaskContext<unknown, unknown>);
        }, this.config.taskTimeout);
      }

      this.stats.totalTasks++;
      this.taskQueue.push(taskContext as TaskContext<unknown, unknown>);
      this.processQueue();

      logger.debug("Task queued", {
        taskId: taskContext.task.id,
        taskType: taskContext.task.type,
        queueSize: this.taskQueue.length,
      });
    });
  }

  /**
   * Execute multiple tasks in parallel with optional concurrency limit
   */
  async executeTasks<T = unknown, R = unknown>(
    tasks: WorkerTask<T, R>[],
    concurrency = this.config.poolSize,
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];
    let index = 0;

    for (const task of tasks) {
      const promise = this.executeTask(task).then(
        (result) => {
          results[index] = result;
        },
        (error) => {
          results[index] = error;
        },
      );

      executing.push(promise);
      index++;

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((p) => p === promise),
          1,
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Get current worker pool statistics
   */
  getStats(): WorkerPoolStats {
    const now = Date.now();
    const uptime = now - this.stats.startTime;
    const throughput = this.stats.completedTasks / (uptime / 1000);
    const errorRate =
      this.stats.failedTasks / Math.max(this.stats.totalTasks, 1);
    const averageTaskTime =
      this.stats.totalExecutionTime / Math.max(this.stats.completedTasks, 1);

    return {
      totalWorkers: this.workers.size,
      activeWorkers: Array.from(this.workers.values()).filter(
        (w) => w.worker.threadId > 0,
      ).length,
      busyWorkers: Array.from(this.workers.values()).filter((w) => w.busy)
        .length,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.stats.completedTasks,
      failedTasks: this.stats.failedTasks,
      averageTaskTime,
      throughput,
      errorRate,
    };
  }

  /**
   * Gracefully shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    logger.info("Shutting down worker pool", {
      activeWorkers: this.workers.size,
      queuedTasks: this.taskQueue.length,
    });

    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Wait for running tasks to complete (with timeout)
    const runningTasks = Array.from(this.runningTasks.values());
    if (runningTasks.length > 0) {
      logger.info("Waiting for running tasks to complete", {
        runningTasks: runningTasks.length,
      });

      await Promise.race([
        Promise.all(
          runningTasks.map(
            (ctx) =>
              new Promise((resolve) => {
                const originalResolve = ctx.resolve;
                const originalReject = ctx.reject;
                ctx.resolve = (value) => {
                  originalResolve(value);
                  resolve(value);
                };
                ctx.reject = (error) => {
                  originalReject(error);
                  resolve(error);
                };
              }),
          ),
        ),
        new Promise((resolve) => setTimeout(resolve, 5000)), // 5 second timeout
      ]);
    }

    // Terminate all workers
    const terminationPromises = Array.from(this.workers.values()).map(
      async (workerState) => {
        try {
          await workerState.worker.terminate();
          logger.debug("Worker terminated", { workerId: workerState.id });
        } catch (error) {
          logger.error("Error terminating worker", {
            workerId: workerState.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    await Promise.all(terminationPromises);
    this.workers.clear();

    logger.info("Worker pool shutdown complete");
  }

  /**
   * Create and initialize a new worker
   */
  private async createWorker(workerId: string): Promise<void> {
    try {
      // Default worker script (can be overridden per task type)
      const workerScript =
        this.config.workerScript ||
        resolve(__dirname, "../workers/batchWorker.js");

      const worker = new Worker(workerScript, {
        env: this.config.envVars,
        transferList: [],
      });

      const workerState: WorkerState = {
        id: workerId,
        worker,
        busy: false,
        tasks: 0,
        errors: 0,
        startTime: Date.now(),
        lastActivity: Date.now(),
        memoryUsage: 0,
      };

      // Set up worker event handlers
      worker.on("message", (result) => {
        this.handleWorkerMessage(workerState, result);
      });

      worker.on("error", (error) => {
        this.handleWorkerError(workerState, _error);
      });

      worker.on("exit", (code) => {
        this.handleWorkerExit(workerState, code);
      });

      this.workers.set(workerId, workerState);
      this.emit("workerStarted", workerId);

      logger.debug("Worker created", {
        workerId,
        threadId: worker.threadId,
      });
    } catch (error) {
      logger.error("Failed to create worker", {
        workerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available worker
    const availableWorker = Array.from(this.workers.values()).find(
      (worker) => !worker.busy,
    );

    if (!availableWorker) {
      return; // No workers available
    }

    // Get next task from queue
    const taskContext = this.taskQueue.shift();
    if (!taskContext) {
      return;
    }

    this.assignTaskToWorker(availableWorker, taskContext);
  }

  /**
   * Assign a task to a worker
   */
  private assignTaskToWorker(
    workerState: WorkerState,
    taskContext: TaskContext<unknown, unknown>,
  ): void {
    workerState.busy = true;
    workerState.lastActivity = Date.now();

    // Store task reference
    this.runningTasks.set(taskContext.task.id, taskContext);

    // Send task to worker
    workerState.worker.postMessage({
      type: "task",
      task: taskContext.task,
    });

    logger.debug("Task assigned to worker", {
      workerId: workerState.id,
      taskId: taskContext.task.id,
      taskType: taskContext.task.type,
    });
  }

  /**
   * Handle worker message responses
   */
  private handleWorkerMessage(workerState: WorkerState, message: any): void {
    const { type, id, result, _error } = message;

    if (type === "taskComplete") {
      this.handleTaskComplete(workerState, id, result, _error);
    } else if (type === "metrics") {
      workerState.memoryUsage = message.memoryUsage || 0;
    }
  }

  /**
   * Handle task completion
   */
  private handleTaskComplete(
    workerState: WorkerState,
    taskId: string,
    result: any,
    error: any,
  ): void {
    const taskContext = this.runningTasks.get(taskId);
    if (!taskContext) {
      logger.warn("Received result for unknown task", { taskId });
      return;
    }

    // Clear task timeout
    if (taskContext.timeout) {
      clearTimeout(taskContext.timeout);
    }

    // Update worker state
    workerState.busy = false;
    workerState.lastActivity = Date.now();

    // Update statistics
    const executionTime = Date.now() - taskContext.startTime;
    this.stats.totalExecutionTime += executionTime;

    this.runningTasks.delete(taskId);

    if (error) {
      workerState.errors++;
      this.stats.failedTasks++;
      taskContext.reject(new Error(error.message || "Worker task failed"));

      logger.error("Task failed", {
        taskId,
        workerId: workerState.id,
        error: error.message,
        executionTime,
      });
    } else {
      this.stats.completedTasks++;
      taskContext.resolve(result);

      logger.debug("Task completed", {
        taskId,
        workerId: workerState.id,
        executionTime,
      });
    }

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerState: WorkerState, error: Error): void {
    logger.error("Worker error", {
      workerId: workerState.id,
      error: error.message,
    });

    workerState.errors++;
    this.emit("error", error);

    // If worker has too many errors, restart it
    if (workerState.errors > 5) {
      this.restartWorker(workerState.id);
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerState: WorkerState, code: number): void {
    logger.warn("Worker exited", {
      workerId: workerState.id,
      exitCode: code,
    });

    this.workers.delete(workerState.id);
    this.emit("workerStopped", workerState.id);

    // Restart worker if not shutting down
    if (!this.isShuttingDown) {
      this.createWorker(workerState.id).catch((error) => {
        logger.error("Failed to restart worker", {
          workerId: workerState.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskContext: TaskContext<unknown, unknown>): void {
    const task = taskContext.task;

    logger.warn("Task timeout", {
      taskId: task.id,
      taskType: task.type,
      timeout: this.config.taskTimeout,
    });

    // Remove from running tasks
    this.runningTasks.delete(task.id);

    // Reject the promise
    taskContext.reject(
      new Error(`Task timeout after ${this.config.taskTimeout}ms`),
    );

    // Update stats
    this.stats.failedTasks++;

    // Find and reset the worker
    const workerState = Array.from(this.workers.values()).find((w) => w.busy);
    if (workerState) {
      this.restartWorker(workerState.id).catch((error) => {
        logger.error("Failed to restart worker after timeout", {
          workerId: workerState.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /**
   * Restart a worker
   */
  private async restartWorker(workerId: string): Promise<void> {
    const workerState = this.workers.get(workerId);
    if (workerState) {
      try {
        await workerState.worker.terminate();
      } catch (error) {
        logger.error("Error terminating worker during restart", {
          workerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      this.workers.delete(workerId);
    }

    await this.createWorker(workerId);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const stats = this.getStats();
      this.emit("metrics", stats);
    }, 10000); // Every 10 seconds
  }
}
