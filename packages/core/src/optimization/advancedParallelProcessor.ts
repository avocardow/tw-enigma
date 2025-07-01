/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Advanced Multi-threading and Parallelism Implementation for Large Codebases
 *
 * Provides thread-safe processing with worker pools, work-stealing queues,
 * fine-grained locking, and deadlock detection for maximum CPU utilization.
 */

import { EventEmitter } from 'events';
import { cpus } from 'os';
import path from 'path';
import { Worker } from 'worker_threads';

/**
 * Work item interface for task queue
 */
export interface WorkItem<T = any, R = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  timeout: number;
  createdAt: Date;
  dependencies: string[];
  metadata: Record<string, any>;
}

/**
 * Work result interface
 */
export interface WorkResult<R = any> {
  id: string;
  success: boolean;
  result?: R;
  error?: Error;
  executionTime: number;
  workerId: string;
  memoryUsage: number;
  metadata: Record<string, any>;
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number; // milliseconds
  taskTimeout: number; // milliseconds
  enableWorkStealing: boolean;
  enableDeadlockDetection: boolean;
  enableResourceMonitoring: boolean;
  maxMemoryPerWorker: number; // bytes
  maxCpuPerWorker: number; // 0-1 scale
  workerScript?: string;
  workerOptions: any;
}

/**
 * Thread safety configuration
 */
export interface ThreadSafetyConfig {
  enableFineLocks: boolean;
  lockTimeout: number; // milliseconds
  deadlockDetectionInterval: number; // milliseconds
  maxLockWaitTime: number; // milliseconds
  enableLockOrderValidation: boolean;
  enableRaceConditionDetection: boolean;
}

/**
 * Work queue statistics
 */
export interface QueueStats {
  totalItems: number;
  pendingItems: number;
  completedItems: number;
  failedItems: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  throughputPerSecond: number;
  workerUtilization: number;
  memoryPressure: number;
}

/**
 * Worker information
 */
interface WorkerInfo {
  id: string;
  worker: Worker;
  isIdle: boolean;
  isBusy: boolean;
  lastActivity: Date;
  tasksCompleted: number;
  tasksFailed: number;
  memoryUsage: number;
  cpuUsage: number;
  workQueue: WorkItem[];
  locks: Set<string>;
}

/**
 * Resource lock for thread safety
 */
class ResourceLock {
  private isLocked = false;
  private waitingQueue: Array<{ resolve: () => void; timeout: NodeJS.Timeout }> = [];
  private lockHolder: string | null = null;
  private lockStartTime: number = 0;

  constructor(
    public readonly resource: string,
    private readonly timeout: number = 5000
  ) {}

  async acquire(workerId: string): Promise<void> {
    if (!this.isLocked) {
      this.isLocked = true;
      this.lockHolder = workerId;
      this.lockStartTime = Date.now();
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.waitingQueue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Lock timeout for resource ${this.resource} by worker ${workerId}`));
      }, this.timeout);

      this.waitingQueue.push({ resolve, timeout: timeoutId });
    });
  }

  release(workerId: string): void {
    if (this.lockHolder !== workerId) {
      throw new Error(`Worker ${workerId} cannot release lock held by ${this.lockHolder}`);
    }

    this.isLocked = false;
    this.lockHolder = null;
    this.lockStartTime = 0;

    if (this.waitingQueue.length > 0) {
      const next = this.waitingQueue.shift()!;
      clearTimeout(next.timeout);

      this.isLocked = true;
      this.lockHolder = workerId;
      this.lockStartTime = Date.now();

      next.resolve();
    }
  }

  isLockedBy(workerId: string): boolean {
    return this.lockHolder === workerId;
  }

  getLockDuration(): number {
    return this.isLocked ? Date.now() - this.lockStartTime : 0;
  }
}

/**
 * Work-stealing queue implementation
 */
class WorkStealingQueue<T> {
  private items: T[] = [];
  private lock = false;

  async push(item: T): Promise<void> {
    await this.acquireLock();
    try {
      this.items.push(item);
    } finally {
      this.releaseLock();
    }
  }

  async pop(): Promise<T | null> {
    await this.acquireLock();
    try {
      return this.items.pop() || null;
    } finally {
      this.releaseLock();
    }
  }

  async steal(): Promise<T | null> {
    await this.acquireLock();
    try {
      return this.items.shift() || null;
    } finally {
      this.releaseLock();
    }
  }

  get length(): number {
    return this.items.length;
  }

  private async acquireLock(): Promise<void> {
    while (this.lock) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    this.lock = true;
  }

  private releaseLock(): void {
    this.lock = false;
  }
}

/**
 * Deadlock detector
 */
class DeadlockDetector {
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private detectionInterval: NodeJS.Timeout | null = null;

  constructor(private interval: number = 5000) {}

  start(): void {
    if (this.detectionInterval) return;

    this.detectionInterval = setInterval(() => {
      this.detectDeadlocks();
    }, this.interval);
  }

  stop(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  addDependency(from: string, to: string): void {
    if (!this.dependencyGraph.has(from)) {
      this.dependencyGraph.set(from, new Set());
    }
    this.dependencyGraph.get(from)!.add(to);
  }

  removeDependency(from: string, to: string): void {
    const dependencies = this.dependencyGraph.get(from);
    if (dependencies) {
      dependencies.delete(to);
      if (dependencies.size === 0) {
        this.dependencyGraph.delete(from);
      }
    }
  }

  private detectDeadlocks(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const deadlocks: string[] = [];

    for (const node of this.dependencyGraph.keys()) {
      if (!visited.has(node)) {
        this.dfsDetectCycle(node, visited, recursionStack, deadlocks);
      }
    }

    if (deadlocks.length > 0) {
      console.warn('Deadlock detected involving:', deadlocks);
    }

    return deadlocks;
  }

  private dfsDetectCycle(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    deadlocks: string[]
  ): boolean {
    visited.add(node);
    recursionStack.add(node);

    const dependencies = this.dependencyGraph.get(node);
    if (dependencies) {
      for (const dependency of dependencies) {
        if (!visited.has(dependency)) {
          if (this.dfsDetectCycle(dependency, visited, recursionStack, deadlocks)) {
            deadlocks.push(node);
            return true;
          }
        } else if (recursionStack.has(dependency)) {
          deadlocks.push(node);
          return true;
        }
      }
    }

    recursionStack.delete(node);
    return false;
  }
}

/**
 * Advanced parallel processor with threading capabilities
 */
export class AdvancedParallelProcessor extends EventEmitter {
  private readonly config: WorkerPoolConfig;
  private readonly threadConfig: ThreadSafetyConfig;
  private readonly workers: Map<string, WorkerInfo> = new Map();
  private readonly workQueues: Map<string, WorkStealingQueue<WorkItem>> = new Map();
  private readonly globalQueue: WorkStealingQueue<WorkItem> = new WorkStealingQueue();
  private readonly resourceLocks: Map<string, ResourceLock> = new Map();
  private readonly deadlockDetector: DeadlockDetector;
  private readonly completedWork: Map<string, WorkResult> = new Map();

  private isRunning = false;
  private workerIdCounter = 0;
  private taskIdCounter = 0;

  private stats: QueueStats = {
    totalItems: 0,
    pendingItems: 0,
    completedItems: 0,
    failedItems: 0,
    averageWaitTime: 0,
    averageExecutionTime: 0,
    throughputPerSecond: 0,
    workerUtilization: 0,
    memoryPressure: 0,
  };

  constructor(
    config: Partial<WorkerPoolConfig> = {},
    threadConfig: Partial<ThreadSafetyConfig> = {}
  ) {
    super();

    this.config = {
      minWorkers: Math.max(1, cpus().length - 1),
      maxWorkers: cpus().length * 2,
      idleTimeout: 30000, // 30 seconds
      taskTimeout: 60000, // 60 seconds
      enableWorkStealing: true,
      enableDeadlockDetection: true,
      enableResourceMonitoring: true,
      maxMemoryPerWorker: 512 * 1024 * 1024, // 512MB
      maxCpuPerWorker: 0.8,
      workerScript: path.join(__dirname, 'worker.js'),
      workerOptions: {},
      ...config,
    };

    this.threadConfig = {
      enableFineLocks: true,
      lockTimeout: 5000,
      deadlockDetectionInterval: 5000,
      maxLockWaitTime: 10000,
      enableLockOrderValidation: true,
      enableRaceConditionDetection: true,
      ...threadConfig,
    };

    this.deadlockDetector = new DeadlockDetector(this.threadConfig.deadlockDetectionInterval);
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    // Create minimum number of workers
    for (let i = 0; i < this.config.minWorkers; i++) {
      await this.createWorker();
    }

    // Start deadlock detection if enabled
    if (this.config.enableDeadlockDetection) {
      this.deadlockDetector.start();
    }

    // Start monitoring
    this.startMonitoring();

    this.emit('initialized', { workerCount: this.workers.size });
  }

  /**
   * Shutdown the worker pool
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Stop deadlock detection
    this.deadlockDetector.stop();

    // Gracefully terminate all workers
    const shutdownPromises = Array.from(this.workers.values()).map((workerInfo) =>
      this.terminateWorker(workerInfo.id)
    );

    await Promise.allSettled(shutdownPromises);

    // Clear all data structures
    this.workers.clear();
    this.workQueues.clear();
    this.resourceLocks.clear();
    this.completedWork.clear();

    this.emit('shutdown');
  }

  /**
   * Submit work item for processing
   */
  async submitWork<T, R>(
    type: string,
    data: T,
    options: {
      priority?: number;
      timeout?: number;
      dependencies?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    if (!this.isRunning) {
      throw new Error('Processor is not running');
    }

    const workId = `work-${this.taskIdCounter++}`;
    const workItem: WorkItem<T, R> = {
      id: workId,
      type,
      data,
      priority: options.priority || 1,
      timeout: options.timeout || this.config.taskTimeout,
      createdAt: new Date(),
      dependencies: options.dependencies || [],
      metadata: options.metadata || {},
    };

    // Add to global queue
    await this.globalQueue.push(workItem);
    this.stats.totalItems++;
    this.stats.pendingItems++;

    // Try to assign to an idle worker
    await this.scheduleWork();

    this.emit('workSubmitted', { workId, type });
    return workId;
  }

  /**
   * Get work result
   */
  async getResult(workId: string, timeout: number = 30000): Promise<WorkResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkResult = () => {
        const result = this.completedWork.get(workId);
        if (result) {
          resolve(result);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          reject(new Error(`Timeout waiting for result of work ${workId}`));
          return;
        }

        setTimeout(checkResult, 100);
      };

      checkResult();
    });
  }

  /**
   * Acquire resource lock
   */
  async acquireResourceLock(resource: string, workerId: string): Promise<void> {
    if (!this.threadConfig.enableFineLocks) return;

    let lock = this.resourceLocks.get(resource);
    if (!lock) {
      lock = new ResourceLock(resource, this.threadConfig.lockTimeout);
      this.resourceLocks.set(resource, lock);
    }

    // Add dependency for deadlock detection
    if (this.config.enableDeadlockDetection) {
      const currentLocks = this.getCurrentLocks(workerId);
      for (const currentLock of currentLocks) {
        this.deadlockDetector.addDependency(workerId, currentLock);
      }
    }

    await lock.acquire(workerId);

    // Update worker locks
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.locks.add(resource);
    }
  }

  /**
   * Release resource lock
   */
  releaseResourceLock(resource: string, workerId: string): void {
    if (!this.threadConfig.enableFineLocks) return;

    const lock = this.resourceLocks.get(resource);
    if (lock) {
      lock.release(workerId);

      // Update worker locks
      const workerInfo = this.workers.get(workerId);
      if (workerInfo) {
        workerInfo.locks.delete(resource);
      }

      // Remove dependencies for deadlock detection
      if (this.config.enableDeadlockDetection) {
        const currentLocks = this.getCurrentLocks(workerId);
        for (const currentLock of currentLocks) {
          this.deadlockDetector.removeDependency(workerId, currentLock);
        }
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats(): QueueStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get worker information
   */
  getWorkerInfo(): Array<{
    id: string;
    isIdle: boolean;
    tasksCompleted: number;
    memoryUsage: number;
    queueLength: number;
  }> {
    return Array.from(this.workers.values()).map((worker) => ({
      id: worker.id,
      isIdle: worker.isIdle,
      tasksCompleted: worker.tasksCompleted,
      memoryUsage: worker.memoryUsage,
      queueLength: worker.workQueue.length,
    }));
  }

  private async createWorker(): Promise<string> {
    const workerId = `worker-${this.workerIdCounter++}`;

    const worker = new Worker(this.config.workerScript!, {
      ...this.config.workerOptions,
      workerData: { workerId },
    });

    const workerInfo: WorkerInfo = {
      id: workerId,
      worker,
      isIdle: true,
      isBusy: false,
      lastActivity: new Date(),
      tasksCompleted: 0,
      tasksFailed: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      workQueue: [],
      locks: new Set(),
    };

    // Set up worker message handling
    worker.on('message', (message) => {
      this.handleWorkerMessage(workerId, message);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(workerId, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(workerId, code);
    });

    this.workers.set(workerId, workerInfo);
    this.workQueues.set(workerId, new WorkStealingQueue());

    this.emit('workerCreated', { workerId });
    return workerId;
  }

  private async terminateWorker(workerId: string): Promise<void> {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    try {
      await workerInfo.worker.terminate();
    } catch (error) {
      console.error(`Error terminating worker ${workerId}:`, error);
    }

    this.workers.delete(workerId);
    this.workQueues.delete(workerId);

    this.emit('workerTerminated', { workerId });
  }

  private async scheduleWork(): Promise<void> {
    // Find idle workers
    const idleWorkers = Array.from(this.workers.values()).filter((w) => w.isIdle);

    if (idleWorkers.length === 0) {
      // Create new worker if under max limit
      if (this.workers.size < this.config.maxWorkers) {
        await this.createWorker();
      }
      return;
    }

    // Assign work to idle workers
    for (const worker of idleWorkers) {
      const workItem = await this.globalQueue.pop();
      if (!workItem) break;

      await this.assignWorkToWorker(worker.id, workItem);
    }
  }

  private async assignWorkToWorker(workerId: string, workItem: WorkItem): Promise<void> {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    const workerQueue = this.workQueues.get(workerId);
    if (!workerQueue) return;

    await workerQueue.push(workItem);

    workerInfo.isIdle = false;
    workerInfo.isBusy = true;
    workerInfo.lastActivity = new Date();

    // Send work to worker
    workerInfo.worker.postMessage({
      type: 'work',
      workItem,
    });
  }

  private handleWorkerMessage(workerId: string, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    switch (message.type) {
      case 'workComplete':
        this.handleWorkComplete(workerId, message.result);
        break;
      case 'workError':
        this.handleWorkError(workerId, message.error);
        break;
      case 'statusUpdate':
        this.handleStatusUpdate(workerId, message.status);
        break;
      case 'stealWork':
        this.handleWorkStealRequest(workerId);
        break;
    }
  }

  private handleWorkComplete(workerId: string, result: WorkResult): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    workerInfo.tasksCompleted++;
    workerInfo.isIdle = true;
    workerInfo.isBusy = false;

    this.completedWork.set(result.id, result);
    this.stats.completedItems++;
    this.stats.pendingItems--;

    this.emit('workCompleted', { workerId, resultId: result.id });

    // Try to assign more work
    this.scheduleWork();
  }

  private handleWorkError(workerId: string, error: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    workerInfo.tasksFailed++;
    workerInfo.isIdle = true;
    workerInfo.isBusy = false;

    this.stats.failedItems++;
    this.stats.pendingItems--;

    this.emit('workError', { workerId, error });

    // Try to assign more work
    this.scheduleWork();
  }

  private handleStatusUpdate(workerId: string, status: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    workerInfo.memoryUsage = status.memoryUsage || 0;
    workerInfo.cpuUsage = status.cpuUsage || 0;
    workerInfo.lastActivity = new Date();
  }

  private async handleWorkStealRequest(workerId: string): Promise<void> {
    if (!this.config.enableWorkStealing) return;

    // Find workers with work to steal
    const busyWorkers = Array.from(this.workers.values())
      .filter((w) => !w.isIdle && w.workQueue.length > 1)
      .sort((a, b) => b.workQueue.length - a.workQueue.length);

    if (busyWorkers.length === 0) return;

    const targetWorker = busyWorkers[0];
    const targetQueue = this.workQueues.get(targetWorker.id);
    if (!targetQueue) return;

    const stolenWork = await targetQueue.steal();
    if (stolenWork) {
      await this.assignWorkToWorker(workerId, stolenWork);
      this.emit('workStolen', { from: targetWorker.id, to: workerId });
    }
  }

  private handleWorkerError(workerId: string, error: Error): void {
    console.error(`Worker ${workerId} error:`, error);
    this.emit('workerError', { workerId, error });

    // Restart worker if needed
    if (this.isRunning) {
      this.terminateWorker(workerId);
      this.createWorker();
    }
  }

  private handleWorkerExit(workerId: string, code: number): void {
    console.log(`Worker ${workerId} exited with code ${code}`);
    this.workers.delete(workerId);
    this.workQueues.delete(workerId);

    this.emit('workerExit', { workerId, code });

    // Restart worker if needed
    if (this.isRunning && this.workers.size < this.config.minWorkers) {
      this.createWorker();
    }
  }

  private getCurrentLocks(workerId: string): string[] {
    const workerInfo = this.workers.get(workerId);
    return workerInfo ? Array.from(workerInfo.locks) : [];
  }

  private updateStats(): void {
    const totalWorkers = this.workers.size;
    const busyWorkers = Array.from(this.workers.values()).filter((w) => w.isBusy).length;

    this.stats.workerUtilization = totalWorkers > 0 ? busyWorkers / totalWorkers : 0;

    // Calculate memory pressure
    const totalMemory = Array.from(this.workers.values()).reduce(
      (sum, w) => sum + w.memoryUsage,
      0
    );
    const maxTotalMemory = totalWorkers * this.config.maxMemoryPerWorker;
    this.stats.memoryPressure = maxTotalMemory > 0 ? totalMemory / maxTotalMemory : 0;
  }

  private startMonitoring(): void {
    setInterval(() => {
      if (this.isRunning) {
        this.updateStats();
        this.emit('statsUpdate', this.stats);
      }
    }, 5000);
  }
}

/**
 * Factory for creating advanced parallel processors
 */
export class AdvancedParallelProcessorFactory {
  /**
   * Create processor optimized for CPU-intensive tasks
   */
  static createCPUIntensive(): AdvancedParallelProcessor {
    return new AdvancedParallelProcessor({
      minWorkers: cpus().length,
      maxWorkers: cpus().length * 2,
      enableWorkStealing: true,
      taskTimeout: 120000, // 2 minutes
    });
  }

  /**
   * Create processor optimized for I/O-bound tasks
   */
  static createIOIntensive(): AdvancedParallelProcessor {
    return new AdvancedParallelProcessor({
      minWorkers: cpus().length * 2,
      maxWorkers: cpus().length * 4,
      enableWorkStealing: false,
      taskTimeout: 30000, // 30 seconds
    });
  }

  /**
   * Create processor with maximum thread safety
   */
  static createThreadSafe(): AdvancedParallelProcessor {
    return new AdvancedParallelProcessor(
      {
        enableDeadlockDetection: true,
        enableResourceMonitoring: true,
      },
      {
        enableFineLocks: true,
        enableLockOrderValidation: true,
        enableRaceConditionDetection: true,
        deadlockDetectionInterval: 1000, // 1 second
      }
    );
  }
}
