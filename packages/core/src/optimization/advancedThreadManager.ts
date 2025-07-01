/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import { cpus } from 'os';
import { z } from 'zod';
import { globalConcurrencyManager, Mutex, ReadWriteLock } from './concurrencyManager.js';
import { MetricsCollector } from '../metrics/collector.js';
import { ResourceManager } from './resourceManager.js';

/**
 * Advanced thread manager configuration schema
 */
export const AdvancedThreadConfigSchema = z.object({
  // Thread pool configuration
  pool: z.object({
    minThreads: z.number().min(1).max(64).default(2),
    maxThreads: z.number().min(1).max(64).default(Math.min(16, cpus().length * 2)),
    idleTimeout: z.number().min(1000).max(300000).default(30000), // 30 seconds
    enableWorkStealing: z.boolean().default(true),
    enableLoadBalancing: z.boolean().default(true),
  }).default({}),

  // Task scheduling
  scheduling: z.object({
    strategy: z.enum(['round_robin', 'least_loaded', 'work_stealing', 'priority']).default('work_stealing'),
    enablePriorityQueues: z.boolean().default(true),
    maxQueueSize: z.number().min(10).max(100000).default(10000),
    taskTimeout: z.number().min(1000).max(3600000).default(60000), // 1 minute
  }).default({}),

  // Deadlock detection and recovery
  deadlockDetection: z.object({
    enabled: z.boolean().default(true),
    checkInterval: z.number().min(1000).max(60000).default(5000), // 5 seconds
    timeoutThreshold: z.number().min(10000).max(300000).default(30000), // 30 seconds
    enableRecovery: z.boolean().default(true),
    maxRecoveryAttempts: z.number().min(1).max(10).default(3),
  }).default({}),

  // Thread safety auditing
  threadSafety: z.object({
    enableAuditing: z.boolean().default(true),
    trackLockContention: z.boolean().default(true),
    enableRaceConditionDetection: z.boolean().default(true),
    auditInterval: z.number().min(1000).max(60000).default(10000), // 10 seconds
  }).default({}),

  // Performance optimization
  performance: z.object({
    enableCpuAffinity: z.boolean().default(false),
    enableNuma: z.boolean().default(false),
    enableHyperthreading: z.boolean().default(true),
    gcOptimization: z.boolean().default(true),
  }).default({}),

  // Monitoring and metrics
  monitoring: z.object({
    enableRealTimeMetrics: z.boolean().default(true),
    metricsInterval: z.number().min(1000).max(60000).default(5000), // 5 seconds
    enablePerformanceProfiler: z.boolean().default(true),
    enableThreadDumps: z.boolean().default(false),
  }).default({}),
});

export type AdvancedThreadConfig = z.infer<typeof AdvancedThreadConfigSchema>;

/**
 * Thread-safe task with priority and dependencies
 */
export interface AdvancedTask<T = any, R = any> {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: T;
  dependencies?: string[];
  maxRetries?: number;
  timeout?: number;
  requiresLock?: string[];
  metadata?: Record<string, any>;
}

/**
 * Work-stealing queue implementation
 */
export class WorkStealingQueue<T> {
  private queue: T[] = [];
  private mutex = new Mutex();
  private stealingEnabled = true;

  /**
   * Add task to the bottom of the queue (owner thread)
   */
  public async push(item: T): Promise<void> {
    await this.mutex.withLock(() => {
      this.queue.push(item);
    });
  }

  /**
   * Take task from the bottom of the queue (owner thread)
   */
  public async pop(): Promise<T | undefined> {
    return await this.mutex.withLock(() => {
      return this.queue.pop();
    });
  }

  /**
   * Steal task from the top of the queue (other threads)
   */
  public async steal(): Promise<T | undefined> {
    if (!this.stealingEnabled) return undefined;
    
    return await this.mutex.withLock(() => {
      return this.queue.shift();
    });
  }

  /**
   * Get queue size
   */
  public async size(): Promise<number> {
    return await this.mutex.withLock(() => {
      return this.queue.length;
    });
  }

  /**
   * Check if queue is empty
   */
  public async isEmpty(): Promise<boolean> {
    return await this.mutex.withLock(() => {
      return this.queue.length === 0;
    });
  }

  /**
   * Enable/disable work stealing
   */
  public setStealingEnabled(enabled: boolean): void {
    this.stealingEnabled = enabled;
  }

  /**
   * Clear all tasks
   */
  public async clear(): Promise<T[]> {
    return await this.mutex.withLock(() => {
      const items = [...this.queue];
      this.queue.length = 0;
      return items;
    });
  }
}

/**
 * Deadlock detector for identifying circular wait conditions
 */
export class DeadlockDetector {
  private lockGraph = new Map<string, Set<string>>();
  private threadLocks = new Map<string, Set<string>>();
  private lockWaiters = new Map<string, Set<string>>();
  private detectionMutex = new Mutex();

  /**
   * Record lock acquisition
   */
  public async recordLockAcquisition(threadId: string, lockId: string): Promise<void> {
    await this.detectionMutex.withLock(() => {
      if (!this.threadLocks.has(threadId)) {
        this.threadLocks.set(threadId, new Set());
      }
      this.threadLocks.get(threadId)!.add(lockId);
      
      // Remove from waiters
      if (this.lockWaiters.has(lockId)) {
        this.lockWaiters.get(lockId)!.delete(threadId);
      }
    });
  }

  /**
   * Record lock release
   */
  public async recordLockRelease(threadId: string, lockId: string): Promise<void> {
    await this.detectionMutex.withLock(() => {
      if (this.threadLocks.has(threadId)) {
        this.threadLocks.get(threadId)!.delete(lockId);
      }
    });
  }

  /**
   * Record lock wait
   */
  public async recordLockWait(threadId: string, lockId: string): Promise<void> {
    await this.detectionMutex.withLock(() => {
      if (!this.lockWaiters.has(lockId)) {
        this.lockWaiters.set(lockId, new Set());
      }
      this.lockWaiters.get(lockId)!.add(threadId);
    });
  }

  /**
   * Detect deadlocks using cycle detection in the wait-for graph
   */
  public async detectDeadlocks(): Promise<string[][]> {
    return await this.detectionMutex.withLock(() => {
      const waitForGraph = this.buildWaitForGraph();
      const deadlocks: string[][] = [];
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      for (const node of waitForGraph.keys()) {
        if (!visited.has(node)) {
          const cycle = this.findCycleInGraph(waitForGraph, node, visited, recursionStack, []);
          if (cycle.length > 0) {
            deadlocks.push(cycle);
          }
        }
      }

      return deadlocks;
    });
  }

  /**
   * Build wait-for graph from current lock state
   */
  private buildWaitForGraph(): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    // For each lock, find threads waiting and threads holding
    for (const [lockId, waitingThreads] of this.lockWaiters.entries()) {
      const holdingThreads = new Set<string>();
      
      for (const [threadId, locks] of this.threadLocks.entries()) {
        if (locks.has(lockId)) {
          holdingThreads.add(threadId);
        }
      }

      // Create edges from waiting threads to holding threads
      for (const waitingThread of waitingThreads) {
        if (!graph.has(waitingThread)) {
          graph.set(waitingThread, new Set());
        }
        
        for (const holdingThread of holdingThreads) {
          if (waitingThread !== holdingThread) {
            graph.get(waitingThread)!.add(holdingThread);
          }
        }
      }
    }

    return graph;
  }

  /**
   * Find cycles in the wait-for graph using DFS
   */
  private findCycleInGraph(
    graph: Map<string, Set<string>>,
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = this.findCycleInGraph(graph, neighbor, visited, recursionStack, [...path]);
        if (cycle.length > 0) {
          return cycle;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart);
      }
    }

    recursionStack.delete(node);
    return [];
  }

  /**
   * Get current lock statistics
   */
  public async getLockStats(): Promise<{
    totalLocks: number;
    activeLocks: number;
    waitingThreads: number;
    lockContention: Map<string, number>;
  }> {
    return await this.detectionMutex.withLock(() => {
      const activeLocks = Array.from(this.threadLocks.values())
        .reduce((sum, locks) => sum + locks.size, 0);
      
      const waitingThreads = Array.from(this.lockWaiters.values())
        .reduce((sum, waiters) => sum + waiters.size, 0);

      const lockContention = new Map<string, number>();
      for (const [lockId, waiters] of this.lockWaiters.entries()) {
        lockContention.set(lockId, waiters.size);
      }

      return {
        totalLocks: this.lockGraph.size,
        activeLocks,
        waitingThreads,
        lockContention,
      };
    });
  }

  /**
   * Clear all tracking data
   */
  public async clear(): Promise<void> {
    await this.detectionMutex.withLock(() => {
      this.lockGraph.clear();
      this.threadLocks.clear();
      this.lockWaiters.clear();
    });
  }
}

/**
 * Thread safety auditor for detecting race conditions and contention
 */
export class ThreadSafetyAuditor {
  private accessPatterns = new Map<string, Array<{
    threadId: string;
    timestamp: number;
    operation: 'read' | 'write';
    location: string;
  }>>();
  private contentionMetrics = new Map<string, {
    totalWaitTime: number;
    maxWaitTime: number;
    contentionCount: number;
  }>();
  private raceConditions = new Set<string>();
  private auditMutex = new Mutex();

  /**
   * Record a memory access for race condition detection
   */
  public async recordAccess(
    resourceId: string,
    threadId: string,
    operation: 'read' | 'write',
    location: string
  ): Promise<void> {
    await this.auditMutex.withLock(() => {
      if (!this.accessPatterns.has(resourceId)) {
        this.accessPatterns.set(resourceId, []);
      }

      const pattern = this.accessPatterns.get(resourceId)!;
      pattern.push({
        threadId,
        timestamp: Date.now(),
        operation,
        location,
      });

      // Keep only recent accesses (last 1000 accesses)
      if (pattern.length > 1000) {
        pattern.shift();
      }

      // Check for potential race conditions
      this.checkForRaceConditions(resourceId, pattern);
    });
  }

  /**
   * Record lock contention metrics
   */
  public async recordContention(
    lockId: string,
    waitTime: number
  ): Promise<void> {
    await this.auditMutex.withLock(() => {
      if (!this.contentionMetrics.has(lockId)) {
        this.contentionMetrics.set(lockId, {
          totalWaitTime: 0,
          maxWaitTime: 0,
          contentionCount: 0,
        });
      }

      const metrics = this.contentionMetrics.get(lockId)!;
      metrics.totalWaitTime += waitTime;
      metrics.maxWaitTime = Math.max(metrics.maxWaitTime, waitTime);
      metrics.contentionCount++;
    });
  }

  /**
   * Check for race conditions in access patterns
   */
  private checkForRaceConditions(
    resourceId: string,
    accesses: Array<{
      threadId: string;
      timestamp: number;
      operation: 'read' | 'write';
      location: string;
    }>
  ): void {
    // Look for concurrent writes or write-read conflicts
    const recentWindow = 100; // ms
    const now = Date.now();
    
    const recentAccesses = accesses.filter(
      access => now - access.timestamp < recentWindow
    );

    // Check for write-write or write-read conflicts
    const writes = recentAccesses.filter(a => a.operation === 'write');
    const reads = recentAccesses.filter(a => a.operation === 'read');

    // Multiple concurrent writes from different threads
    if (writes.length > 1) {
      const threads = new Set(writes.map(w => w.threadId));
      if (threads.size > 1) {
        this.raceConditions.add(`${resourceId}: Concurrent writes detected`);
      }
    }

    // Write-read conflicts
    for (const write of writes) {
      for (const read of reads) {
        if (write.threadId !== read.threadId &&
            Math.abs(write.timestamp - read.timestamp) < 10) {
          this.raceConditions.add(
            `${resourceId}: Write-read race condition between ${write.threadId} and ${read.threadId}`
          );
        }
      }
    }
  }

  /**
   * Get race condition report
   */
  public async getRaceConditionReport(): Promise<{
    raceConditions: string[];
    contentionHotspots: Array<{
      lockId: string;
      averageWaitTime: number;
      maxWaitTime: number;
      contentionCount: number;
    }>;
    recommendations: string[];
  }> {
    return await this.auditMutex.withLock(() => {
      const contentionHotspots = Array.from(this.contentionMetrics.entries())
        .map(([lockId, metrics]) => ({
          lockId,
          averageWaitTime: metrics.totalWaitTime / metrics.contentionCount,
          maxWaitTime: metrics.maxWaitTime,
          contentionCount: metrics.contentionCount,
        }))
        .sort((a, b) => b.averageWaitTime - a.averageWaitTime);

      const recommendations: string[] = [];
      
      // Generate recommendations based on findings
      if (this.raceConditions.size > 0) {
        recommendations.push('Critical: Race conditions detected. Add proper synchronization.');
      }
      
      const highContentionLocks = contentionHotspots.filter(h => h.averageWaitTime > 10);
      if (highContentionLocks.length > 0) {
        recommendations.push('High contention detected on locks. Consider using read-write locks or reducing critical section size.');
      }

      if (contentionHotspots.some(h => h.maxWaitTime > 1000)) {
        recommendations.push('Very long lock wait times detected. Review lock ordering and consider timeout mechanisms.');
      }

      return {
        raceConditions: Array.from(this.raceConditions),
        contentionHotspots,
        recommendations,
      };
    });
  }

  /**
   * Clear audit data
   */
  public async clear(): Promise<void> {
    await this.auditMutex.withLock(() => {
      this.accessPatterns.clear();
      this.contentionMetrics.clear();
      this.raceConditions.clear();
    });
  }
}

/**
 * Enhanced worker thread with advanced capabilities
 */
export class AdvancedWorkerThread {
  public readonly id: string;
  public readonly worker: Worker;
  private workStealingQueue: WorkStealingQueue<AdvancedTask>;
  private currentTask?: AdvancedTask;
  private stats = {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    idleTime: 0,
    lastActivity: Date.now(),
  };

  constructor(
    id: string,
    workerScript: string,
    private config: AdvancedThreadConfig
  ) {
    this.id = id;
    this.workStealingQueue = new WorkStealingQueue<AdvancedTask>();
    
    this.worker = new Worker(workerScript, {
      workerData: { threadId: id, config },
    });

    this.setupWorkerEventHandlers();
  }

  /**
   * Assign a task to this worker
   */
  public async assignTask(task: AdvancedTask): Promise<void> {
    await this.workStealingQueue.push(task);
    this.processNextTask();
  }

  /**
   * Steal a task from this worker's queue
   */
  public async stealTask(): Promise<AdvancedTask | undefined> {
    return await this.workStealingQueue.steal();
  }

  /**
   * Get current workload
   */
  public async getWorkload(): Promise<number> {
    return await this.workStealingQueue.size();
  }

  /**
   * Check if worker is idle
   */
  public isIdle(): boolean {
    return !this.currentTask;
  }

  /**
   * Get worker statistics
   */
  public getStats() {
    const now = Date.now();
    const totalTime = now - this.stats.lastActivity;
    const utilizationRate = this.stats.totalExecutionTime / totalTime;

    return {
      ...this.stats,
      utilizationRate,
      currentLoad: this.currentTask ? 1 : 0,
    };
  }

  /**
   * Shutdown the worker
   */
  public async shutdown(): Promise<void> {
    // Clear remaining tasks
    const remainingTasks = await this.workStealingQueue.clear();
    
    // Terminate worker
    await this.worker.terminate();
    
    return Promise.resolve();
  }

  /**
   * Setup worker event handlers
   */
  private setupWorkerEventHandlers(): void {
    this.worker.on('message', (message) => {
      this.handleWorkerMessage(message);
    });

    this.worker.on('error', (error) => {
      this.handleWorkerError(error);
    });

    this.worker.on('exit', (code) => {
      this.handleWorkerExit(code);
    });
  }

  /**
   * Process the next task in the queue
   */
  private async processNextTask(): Promise<void> {
    if (this.currentTask) return; // Worker is busy

    const task = await this.workStealingQueue.pop();
    if (!task) return; // No tasks available

    this.currentTask = task;
    const startTime = Date.now();

    try {
      // Send task to worker thread
      this.worker.postMessage({
        type: 'execute',
        task,
      });

    } catch (error) {
      this.handleTaskError(task, error);
    }
  }

  /**
   * Handle messages from worker thread
   */
  private handleWorkerMessage(message: any): void {
    const { type, taskId, result, error } = message;

    switch (type) {
      case 'taskComplete':
        this.handleTaskComplete(taskId, result, error);
        break;
      case 'metrics':
        // Update worker-specific metrics
        break;
      default:
        console.warn(`Unknown message type from worker ${this.id}:`, type);
    }
  }

  /**
   * Handle task completion
   */
  private handleTaskComplete(taskId: string, result: any, error: any): void {
    if (!this.currentTask || this.currentTask.id !== taskId) {
      console.warn(`Unexpected task completion for ${taskId}`);
      return;
    }

    const executionTime = Date.now() - this.stats.lastActivity;
    
    if (error) {
      this.stats.tasksFailed++;
    } else {
      this.stats.tasksCompleted++;
      this.stats.totalExecutionTime += executionTime;
      this.stats.averageExecutionTime = 
        this.stats.totalExecutionTime / this.stats.tasksCompleted;
    }

    this.currentTask = undefined;
    this.stats.lastActivity = Date.now();

    // Process next task
    this.processNextTask();
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: Error): void {
    console.error(`Worker ${this.id} error:`, error);
    
    if (this.currentTask) {
      this.handleTaskError(this.currentTask, error);
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(code: number): void {
    console.warn(`Worker ${this.id} exited with code ${code}`);
  }

  /**
   * Handle task execution errors
   */
  private handleTaskError(task: AdvancedTask, error: any): void {
    this.stats.tasksFailed++;
    this.currentTask = undefined;
    
    // Could implement retry logic here
    console.error(`Task ${task.id} failed:`, error);
  }
}

/**
 * Advanced thread manager with comprehensive multi-threading capabilities
 */
export class AdvancedThreadManager extends EventEmitter {
  private readonly config: AdvancedThreadConfig;
  private workers: Map<string, AdvancedWorkerThread> = new Map();
  private deadlockDetector: DeadlockDetector;
  private threadSafetyAuditor: ThreadSafetyAuditor;
  private resourceManager?: ResourceManager;
  private metricsCollector?: MetricsCollector;
  
  // Monitoring intervals
  private deadlockCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private auditInterval?: NodeJS.Timeout;
  
  // Task management
  private globalTaskQueue: AdvancedTask[] = [];
  private runningTasks = new Map<string, {
    task: AdvancedTask;
    workerId: string;
    startTime: number;
  }>();
  
  // Performance statistics
  private stats = {
    totalTasksExecuted: 0,
    totalTasksFailed: 0,
    totalExecutionTime: 0,
    averageTaskTime: 0,
    deadlocksDetected: 0,
    deadlocksResolved: 0,
    raceConditionsDetected: 0,
  };

  constructor(
    config: Partial<AdvancedThreadConfig> = {},
    metricsCollector?: MetricsCollector,
    resourceManager?: ResourceManager
  ) {
    super();
    
    this.config = AdvancedThreadConfigSchema.parse(config);
    this.metricsCollector = metricsCollector;
    this.resourceManager = resourceManager;
    
    this.deadlockDetector = new DeadlockDetector();
    this.threadSafetyAuditor = new ThreadSafetyAuditor();
    
    if (!isMainThread) {
      throw new Error('AdvancedThreadManager can only be used in the main thread');
    }
  }

  /**
   * Initialize the advanced thread manager
   */
  public async initialize(workerScript: string): Promise<void> {
    // Create initial worker pool
    await this.createWorkerPool(workerScript);
    
    // Start monitoring systems
    this.startDeadlockDetection();
    this.startThreadSafetyAuditing();
    this.startMetricsCollection();
    
    this.emit('initialized', {
      workerCount: this.workers.size,
      config: this.config,
    });
  }

  /**
   * Execute a task with advanced thread management
   */
  public async executeTask<T, R>(task: AdvancedTask<T, R>): Promise<R> {
    // Validate dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      await this.waitForDependencies(task.dependencies);
    }

    // Find optimal worker for task
    const worker = await this.selectOptimalWorker(task);
    
    if (!worker) {
      throw new Error('No available workers');
    }

    // Record task start
    this.runningTasks.set(task.id, {
      task,
      workerId: worker.id,
      startTime: Date.now(),
    });

    try {
      // Execute task
      await worker.assignTask(task);
      
      // Return a promise that resolves when task completes
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Task ${task.id} timed out`));
        }, task.timeout || this.config.scheduling.taskTimeout);

        // Set up completion handler
        const handleCompletion = (result: R, error?: Error) => {
          clearTimeout(timeout);
          this.runningTasks.delete(task.id);
          
          if (error) {
            this.stats.totalTasksFailed++;
            reject(error);
          } else {
            this.stats.totalTasksExecuted++;
            resolve(result);
          }
        };

        // Store completion handler (simplified for this example)
        (task as any)._completionHandler = handleCompletion;
      });
      
    } catch (error) {
      this.runningTasks.delete(task.id);
      throw error;
    }
  }

  /**
   * Execute multiple tasks in parallel with dependency management
   */
  public async executeTasks<T, R>(tasks: AdvancedTask<T, R>[]): Promise<R[]> {
    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(tasks);
    
    // Execute tasks in dependency order
    const results: R[] = new Array(tasks.length);
    const executionPromises = new Map<string, Promise<R>>();
    
    const executeTaskWithDependencies = async (task: AdvancedTask<T, R>, index: number): Promise<void> => {
      // Wait for dependencies
      if (task.dependencies) {
        const dependencyPromises = task.dependencies.map(depId => executionPromises.get(depId));
        await Promise.all(dependencyPromises.filter(p => p !== undefined));
      }
      
      // Execute task
      const promise = this.executeTask(task);
      executionPromises.set(task.id, promise);
      
      try {
        results[index] = await promise;
      } catch (error) {
        throw new Error(`Task ${task.id} failed: ${error}`);
      }
    };
    
    // Start all tasks (dependency management will handle ordering)
    await Promise.all(
      tasks.map((task, index) => executeTaskWithDependencies(task, index))
    );
    
    return results;
  }

  /**
   * Get comprehensive thread manager statistics
   */
  public async getStatistics() {
    const workerStats = Array.from(this.workers.values()).map(w => w.getStats());
    const deadlockStats = await this.deadlockDetector.getLockStats();
    const auditReport = await this.threadSafetyAuditor.getRaceConditionReport();
    
    return {
      threads: {
        total: this.workers.size,
        active: workerStats.filter(s => s.currentLoad > 0).length,
        idle: workerStats.filter(s => s.currentLoad === 0).length,
        averageUtilization: workerStats.reduce((sum, s) => sum + s.utilizationRate, 0) / workerStats.length,
      },
      tasks: {
        running: this.runningTasks.size,
        queued: this.globalTaskQueue.length,
        completed: this.stats.totalTasksExecuted,
        failed: this.stats.totalTasksFailed,
        averageExecutionTime: this.stats.averageTaskTime,
      },
      deadlocks: {
        detected: this.stats.deadlocksDetected,
        resolved: this.stats.deadlocksResolved,
        currentLocks: deadlockStats.activeLocks,
        contentionLevel: deadlockStats.waitingThreads,
      },
      threadSafety: {
        raceConditions: auditReport.raceConditions.length,
        contentionHotspots: auditReport.contentionHotspots.length,
        recommendations: auditReport.recommendations,
      },
      performance: {
        cpuUtilization: this.calculateCpuUtilization(),
        memoryUsage: this.calculateMemoryUsage(),
        throughput: this.calculateThroughput(),
      },
    };
  }

  /**
   * Shutdown the thread manager
   */
  public async shutdown(): Promise<void> {
    // Stop monitoring
    if (this.deadlockCheckInterval) clearInterval(this.deadlockCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.auditInterval) clearInterval(this.auditInterval);
    
    // Shutdown all workers
    const shutdownPromises = Array.from(this.workers.values()).map(w => w.shutdown());
    await Promise.all(shutdownPromises);
    
    this.workers.clear();
    this.emit('shutdown');
  }

  /**
   * Create the initial worker pool
   */
  private async createWorkerPool(workerScript: string): Promise<void> {
    const workerPromises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.pool.minThreads; i++) {
      const workerId = `worker-${i}`;
      const worker = new AdvancedWorkerThread(workerId, workerScript, this.config);
      this.workers.set(workerId, worker);
    }
    
    await Promise.all(workerPromises);
  }

  /**
   * Select optimal worker for a task
   */
  private async selectOptimalWorker(task: AdvancedTask): Promise<AdvancedWorkerThread | null> {
    const workers = Array.from(this.workers.values());
    
    switch (this.config.scheduling.strategy) {
      case 'least_loaded':
        // Find worker with smallest queue
        let minLoad = Infinity;
        let bestWorker: AdvancedWorkerThread | null = null;
        
        for (const worker of workers) {
          const load = await worker.getWorkload();
          if (load < minLoad) {
            minLoad = load;
            bestWorker = worker;
          }
        }
        
        return bestWorker;
        
      case 'work_stealing':
        // Find idle worker, or least loaded if none idle
        const idleWorker = workers.find(w => w.isIdle());
        if (idleWorker) return idleWorker;
        
        return await this.selectOptimalWorker({ ...task }); // Fallback to least_loaded
        
      case 'priority':
        // Consider task priority and worker capabilities
        return workers.find(w => w.isIdle()) || workers[0];
        
      default: // round_robin
        return workers[this.stats.totalTasksExecuted % workers.length];
    }
  }

  /**
   * Wait for task dependencies to complete
   */
  private async waitForDependencies(dependencies: string[]): Promise<void> {
    const waitPromises = dependencies.map(depId => {
      const runningTask = this.runningTasks.get(depId);
      if (runningTask) {
        // Create a promise that resolves when the task completes
        return new Promise<void>((resolve) => {
          const checkCompletion = setInterval(() => {
            if (!this.runningTasks.has(depId)) {
              clearInterval(checkCompletion);
              resolve();
            }
          }, 100);
        });
      }
      return Promise.resolve(); // Dependency already completed
    });
    
    await Promise.all(waitPromises);
  }

  /**
   * Build dependency graph for tasks
   */
  private buildDependencyGraph(tasks: AdvancedTask[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const task of tasks) {
      graph.set(task.id, task.dependencies || []);
    }
    
    return graph;
  }

  /**
   * Start deadlock detection monitoring
   */
  private startDeadlockDetection(): void {
    if (!this.config.deadlockDetection.enabled) return;
    
    this.deadlockCheckInterval = setInterval(async () => {
      try {
        const deadlocks = await this.deadlockDetector.detectDeadlocks();
        
        if (deadlocks.length > 0) {
          this.stats.deadlocksDetected += deadlocks.length;
          
          this.emit('deadlockDetected', {
            deadlocks,
            timestamp: new Date(),
          });
          
          if (this.config.deadlockDetection.enableRecovery) {
            await this.recoverFromDeadlocks(deadlocks);
          }
        }
      } catch (error) {
        console.error('Error in deadlock detection:', error);
      }
    }, this.config.deadlockDetection.checkInterval);
  }

  /**
   * Start thread safety auditing
   */
  private startThreadSafetyAuditing(): void {
    if (!this.config.threadSafety.enableAuditing) return;
    
    this.auditInterval = setInterval(async () => {
      try {
        const report = await this.threadSafetyAuditor.getRaceConditionReport();
        
        if (report.raceConditions.length > 0) {
          this.stats.raceConditionsDetected += report.raceConditions.length;
          
          this.emit('raceConditionDetected', {
            raceConditions: report.raceConditions,
            recommendations: report.recommendations,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error('Error in thread safety auditing:', error);
      }
    }, this.config.threadSafety.auditInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.monitoring.enableRealTimeMetrics) return;
    
    this.metricsInterval = setInterval(async () => {
      try {
        const stats = await this.getStatistics();
        
        this.emit('metrics', {
          statistics: stats,
          timestamp: new Date(),
        });
        
        // Record metrics in collector if available
        if (this.metricsCollector) {
          this.metricsCollector.recordPerformance('thread_manager', {
            duration: 0,
            memory: stats.performance.memoryUsage,
            cpu: stats.performance.cpuUtilization,
            stage: 'monitoring',
            operationName: 'metrics_collection',
          });
        }
      } catch (error) {
        console.error('Error in metrics collection:', error);
      }
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Recover from detected deadlocks
   */
  private async recoverFromDeadlocks(deadlocks: string[][]): Promise<void> {
    for (const deadlock of deadlocks) {
      try {
        // Simple recovery strategy: terminate one thread in the cycle
        const threadToTerminate = deadlock[0];
        
        // Find and restart the worker
        const worker = this.workers.get(threadToTerminate);
        if (worker) {
          await worker.shutdown();
          this.workers.delete(threadToTerminate);
          
          // Create a new worker to replace it
          const newWorker = new AdvancedWorkerThread(
            threadToTerminate,
            '', // Would need worker script path
            this.config
          );
          this.workers.set(threadToTerminate, newWorker);
        }
        
        this.stats.deadlocksResolved++;
        
        this.emit('deadlockRecovered', {
          deadlock,
          recoveryAction: 'thread_restart',
          timestamp: new Date(),
        });
        
      } catch (error) {
        console.error('Error recovering from deadlock:', error);
      }
    }
  }

  /**
   * Calculate CPU utilization across all workers
   */
  private calculateCpuUtilization(): number {
    const workers = Array.from(this.workers.values());
    const totalUtilization = workers.reduce((sum, w) => sum + w.getStats().utilizationRate, 0);
    return workers.length > 0 ? totalUtilization / workers.length : 0;
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed / (1024 * 1024); // MB
  }

  /**
   * Calculate current throughput
   */
  private calculateThroughput(): number {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    // Simplified calculation - would need more sophisticated tracking
    return this.stats.totalTasksExecuted / (timeWindow / 1000);
  }
}

/**
 * Factory function to create advanced thread manager
 */
export function createAdvancedThreadManager(
  config?: Partial<AdvancedThreadConfig>,
  metricsCollector?: MetricsCollector,
  resourceManager?: ResourceManager
): AdvancedThreadManager {
  return new AdvancedThreadManager(config, metricsCollector, resourceManager);
}