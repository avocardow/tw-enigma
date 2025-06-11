/**
 * Batch Processing Coordinator for Tailwind Enigma Core
 * 
 * Orchestrates multiple optimization tasks with intelligent batching,
 * resource management, and performance optimization strategies.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { cpus } from 'os';
import { createLogger } from '../logger.js';
import type { 
  BatchConfig, 
  PerformanceMetrics, 
  WorkerConfig, 
  CacheConfig 
} from './config.js';

const logger = createLogger('BatchCoordinator');

/**
 * Batch job definition
 */
interface BatchJob<T = unknown, R = unknown> {
  id: string;
  type: string;
  input: T;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration?: number;
  dependencies?: string[];
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Batch execution result
 */
interface BatchResult<R = unknown> {
  jobId: string;
  success: boolean;
  result?: R;
  error?: Error;
  duration: number;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Batch processing statistics
 */
interface BatchStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageDuration: number;
  totalDuration: number;
  throughput: number; // jobs per second
  successRate: number;
  errorRate: number;
  currentConcurrency: number;
  maxConcurrency: number;
  queueLength: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    activeWorkers: number;
  };
}

/**
 * Batch execution options
 */
interface BatchExecutionOptions {
  maxConcurrency?: number;
  batchSize?: number;
  timeout?: number;
  retryStrategy?: 'none' | 'linear' | 'exponential';
  priorityQueue?: boolean;
  enableDependencies?: boolean;
  resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
  };
  groupingStrategy?: 'type' | 'priority' | 'size' | 'mixed';
}

/**
 * Job processor function type
 */
type JobProcessor<T = unknown, R = unknown> = (
  input: T,
  job: BatchJob<T, R>
) => Promise<R> | R;

/**
 * Batch processing coordinator that efficiently manages multiple optimization tasks
 */
export class BatchCoordinator extends EventEmitter {
  private config: BatchConfig;
  private jobQueue: Map<string, BatchJob> = new Map();
  private priorityQueues: Map<string, BatchJob[]> = new Map();
  private processingJobs: Map<string, Promise<BatchResult>> = new Map();
  private completedJobs: Map<string, BatchResult> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private stats: BatchStats;
  private isProcessing = false;
  private resourceMonitor?: NodeJS.Timeout;

  constructor(config: Partial<BatchConfig> = {}) {
    super();
    
    const cpuCount = cpus().length;
    this.config = {
      enabled: true,
      defaultBatchSize: 50,
      maxBatchSize: 1000,
      processingDelay: 10,
      enablePrioritization: true,
      maxConcurrentBatches: 5,
      maxConcurrency: Math.max(2, Math.floor(cpuCount * 0.8)),
      batchSize: 50,
      queueTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      priorityLevels: ['critical', 'high', 'medium', 'low'],
      enableDependencies: true,
      resourceLimits: {
        maxMemoryUsage: 0.8, // 80% of available memory
        maxCpuUsage: 0.8,    // 80% of available CPU
      },
      ...config,
    };

    this.stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageDuration: 0,
      totalDuration: 0,
      throughput: 0,
      successRate: 0,
      errorRate: 0,
      currentConcurrency: 0,
      maxConcurrency: this.config.maxConcurrency,
      queueLength: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        activeWorkers: 0,
      },
    };

    // Initialize priority queues
    this.config.priorityLevels.forEach(priority => {
      this.priorityQueues.set(priority, []);
    });

    this.setupResourceMonitoring();

    logger.info('BatchCoordinator initialized', {
      maxConcurrency: this.config.maxConcurrency,
      batchSize: this.config.batchSize,
      priorityLevels: this.config.priorityLevels,
    });
  }

  /**
   * Register a job processor for a specific job type
   */
  registerProcessor<T, R>(
    jobType: string,
    processor: JobProcessor<T, R>
  ): void {
    this.processors.set(jobType, processor as JobProcessor);
    logger.debug('Registered processor for job type', { jobType });
  }

  /**
   * Add a single job to the batch queue
   */
  addJob<T, R>(job: BatchJob<T, R>): string {
    if (!this.processors.has(job.type)) {
      throw new Error(`No processor registered for job type: ${job.type}`);
    }

    // Generate ID if not provided
    if (!job.id) {
      job.id = `${job.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set defaults
    job.retryCount = job.retryCount || 0;
    job.maxRetries = job.maxRetries || this.config.retryAttempts;
    job.timeout = job.timeout || this.config.queueTimeout;

    this.jobQueue.set(job.id, job);
    this.addToPriorityQueue(job);
    
    // Handle dependencies
    if (this.config.enableDependencies && job.dependencies) {
      this.buildDependencyGraph(job);
    }

    this.stats.totalJobs++;
    this.stats.queueLength = this.jobQueue.size;

    logger.debug('Job added to queue', {
      jobId: job.id,
      type: job.type,
      priority: job.priority,
      dependencies: job.dependencies?.length || 0,
    });

    this.emit('jobAdded', { job });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return job.id;
  }

  /**
   * Add multiple jobs to the batch queue
   */
  addBatch<T, R>(jobs: Array<Omit<BatchJob<T, R>, 'id'>>): string[] {
    const jobIds: string[] = [];
    
    for (const jobData of jobs) {
      const job: BatchJob<T, R> = {
        id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...jobData,
      };
      jobIds.push(this.addJob(job));
    }

    logger.info('Batch of jobs added', {
      batchSize: jobs.length,
      jobIds: jobIds.slice(0, 5), // Log first 5 IDs
    });

    return jobIds;
  }

  /**
   * Execute all jobs in the queue with optimal batching and concurrency
   */
  async executeBatch(options: BatchExecutionOptions = {}): Promise<BatchResult[]> {
    const startTime = performance.now();
    const executionOptions = {
      maxConcurrency: this.config.maxConcurrency,
      batchSize: this.config.batchSize,
      timeout: this.config.queueTimeout,
      retryStrategy: 'exponential' as const,
      priorityQueue: true,
      enableDependencies: this.config.enableDependencies,
      groupingStrategy: 'mixed' as const,
      ...options,
    };

    logger.info('Starting batch execution', {
      totalJobs: this.stats.totalJobs,
      queueLength: this.stats.queueLength,
      maxConcurrency: executionOptions.maxConcurrency,
      groupingStrategy: executionOptions.groupingStrategy,
    });

    this.isProcessing = true;
    const results: BatchResult[] = [];

    try {
      // Group jobs by strategy
      const jobGroups = this.groupJobs(executionOptions.groupingStrategy);
      
      // Process groups with concurrency control
      for (const group of jobGroups) {
        const groupResults = await this.processJobGroup(group, executionOptions);
        results.push(...groupResults);
        
        // Emit progress
        this.emit('batchProgress', {
          completed: results.length,
          total: this.stats.totalJobs,
          percentage: (results.length / this.stats.totalJobs) * 100,
        });
      }

      // Update final statistics
      const endTime = performance.now();
      const totalDuration = (endTime - startTime) / 1000;
      
      this.updateFinalStats(results, totalDuration);
      
      logger.info('Batch execution completed', {
        totalJobs: results.length,
        successfulJobs: results.filter(r => r.success).length,
        failedJobs: results.filter(r => !r.success).length,
        totalDuration,
        throughput: this.stats.throughput,
        successRate: this.stats.successRate,
      });

      this.emit('batchCompleted', {
        results,
        stats: this.stats,
        duration: totalDuration,
      });

      return results;

    } catch (error) {
      logger.error('Batch execution failed', {
        error: error instanceof Error ? error.message : String(error),
        processedJobs: results.length,
        totalJobs: this.stats.totalJobs,
      });

      this.emit('batchFailed', { error, results });
      throw error;

    } finally {
      this.isProcessing = false;
      this.cleanup();
    }
  }

  /**
   * Get current batch processing statistics
   */
  getStats(): BatchStats {
    this.updateRuntimeStats();
    return { ...this.stats };
  }

  /**
   * Get job status and result
   */
  getJobResult(jobId: string): BatchResult | null {
    return this.completedJobs.get(jobId) || null;
  }

  /**
   * Cancel a pending job
   */
  cancelJob(jobId: string): boolean {
    if (this.jobQueue.has(jobId) && !this.processingJobs.has(jobId)) {
      this.jobQueue.delete(jobId);
      this.removeFromPriorityQueues(jobId);
      this.stats.queueLength = this.jobQueue.size;
      
      logger.debug('Job cancelled', { jobId });
      this.emit('jobCancelled', { jobId });
      
      return true;
    }
    return false;
  }

  /**
   * Clear all pending jobs
   */
  clearQueue(): void {
    const cancelledCount = this.jobQueue.size;
    this.jobQueue.clear();
    this.priorityQueues.forEach(queue => queue.length = 0);
    this.dependencyGraph.clear();
    this.stats.queueLength = 0;

    logger.info('Job queue cleared', { cancelledJobs: cancelledCount });
    this.emit('queueCleared', { cancelledJobs: cancelledCount });
  }

  /**
   * Shutdown the batch coordinator gracefully
   */
  async shutdown(timeout = 30000): Promise<void> {
    logger.info('Shutting down BatchCoordinator', { timeout });
    
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }

    // Wait for current processing to complete or timeout
    const startTime = Date.now();
    while (this.processingJobs.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force cleanup
    this.cleanup();
    this.emit('shutdown');
    
    logger.info('BatchCoordinator shutdown complete');
  }

  /**
   * Start the main processing loop
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing || this.jobQueue.size === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      while (this.jobQueue.size > 0 && this.isProcessing) {
        const availableSlots = this.config.maxConcurrency - this.processingJobs.size;
        
        if (availableSlots <= 0) {
          // Wait for a job to complete
          await Promise.race(Array.from(this.processingJobs.values()));
          continue;
        }

        // Get next jobs to process
        const jobsToProcess = this.getNextJobs(availableSlots);
        
        if (jobsToProcess.length === 0) {
          // No jobs available (might be waiting for dependencies)
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // Start processing jobs
        for (const job of jobsToProcess) {
          this.processJob(job);
        }
      }
    } catch (error) {
      logger.error('Processing loop error', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single job
   */
  private async processJob<T, R>(job: BatchJob<T, R>): Promise<void> {
    const startTime = performance.now();
    const processor = this.processors.get(job.type) as JobProcessor<T, R>;

    if (!processor) {
      const error = new Error(`No processor found for job type: ${job.type}`);
      this.handleJobResult(job, { success: false, error, duration: 0 });
      return;
    }

    this.stats.currentConcurrency++;
    this.stats.resourceUtilization.activeWorkers++;

    const processingPromise = this.executeJobWithTimeout(job, processor, startTime);
    this.processingJobs.set(job.id, processingPromise);

    logger.debug('Job processing started', {
      jobId: job.id,
      type: job.type,
      priority: job.priority,
      retryCount: job.retryCount,
    });

    this.emit('jobStarted', { job });

    try {
      const result = await processingPromise;
      this.handleJobResult(job, result);
    } catch (error) {
      this.handleJobResult(job, {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: (performance.now() - startTime) / 1000,
      });
    } finally {
      this.processingJobs.delete(job.id);
      this.jobQueue.delete(job.id);
      this.removeFromPriorityQueues(job.id);
      this.stats.currentConcurrency--;
      this.stats.resourceUtilization.activeWorkers--;
      this.stats.queueLength = this.jobQueue.size;
    }
  }

  /**
   * Execute a job with timeout protection
   */
  private async executeJobWithTimeout<T, R>(
    job: BatchJob<T, R>,
    processor: JobProcessor<T, R>,
    startTime: number
  ): Promise<BatchResult<R>> {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        const duration = (performance.now() - startTime) / 1000;
        resolve({
          jobId: job.id,
          success: false,
          error: new Error(`Job timeout after ${duration}s`),
          duration,
          retryCount: job.retryCount || 0,
        });
      }, job.timeout || this.config.queueTimeout);

      try {
        const result = await processor(job.input, job);
        const duration = (performance.now() - startTime) / 1000;
        
        clearTimeout(timeout);
        resolve({
          jobId: job.id,
          success: true,
          result,
          duration,
          retryCount: job.retryCount || 0,
          metadata: job.metadata,
        });
      } catch (error) {
        clearTimeout(timeout);
        const duration = (performance.now() - startTime) / 1000;
        
        resolve({
          jobId: job.id,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          duration,
          retryCount: job.retryCount || 0,
        });
      }
    });
  }

  /**
   * Handle job completion result
   */
  private handleJobResult<R>(job: BatchJob, result: Partial<BatchResult<R>>): void {
    const finalResult: BatchResult<R> = {
      jobId: job.id,
      success: false,
      duration: 0,
      retryCount: job.retryCount || 0,
      ...result,
    };

    if (!finalResult.success && (job.retryCount || 0) < (job.maxRetries || 0)) {
      // Retry the job
      job.retryCount = (job.retryCount || 0) + 1;
      
      // Exponential backoff delay
      const delay = Math.min(
        this.config.retryDelay * Math.pow(2, job.retryCount - 1),
        30000
      );
      
      setTimeout(() => {
        this.addToPriorityQueue(job, true);
        logger.debug('Job scheduled for retry', {
          jobId: job.id,
          retryCount: job.retryCount,
          delay,
        });
      }, delay);
      
      return;
    }

    // Job completed (success or max retries reached)
    this.completedJobs.set(job.id, finalResult);
    
    if (finalResult.success) {
      this.stats.completedJobs++;
      this.emit('jobCompleted', { job, result: finalResult });
    } else {
      this.stats.failedJobs++;
      this.emit('jobFailed', { job, result: finalResult });
    }

    // Update statistics
    this.stats.totalDuration += finalResult.duration;
    this.stats.averageDuration = this.stats.totalDuration / (this.stats.completedJobs + this.stats.failedJobs);
    this.stats.successRate = this.stats.completedJobs / (this.stats.completedJobs + this.stats.failedJobs);
    this.stats.errorRate = 1 - this.stats.successRate;

    logger.debug('Job result processed', {
      jobId: job.id,
      success: finalResult.success,
      duration: finalResult.duration,
      retryCount: finalResult.retryCount,
    });

    // Release any dependent jobs
    this.releaseDependentJobs(job.id);
  }

  /**
   * Group jobs by the specified strategy
   */
  private groupJobs(strategy: string): BatchJob[][] {
    const jobs = Array.from(this.jobQueue.values());
    
    switch (strategy) {
      case 'type':
        return this.groupByType(jobs);
      case 'priority':
        return this.groupByPriority(jobs);
      case 'size':
        return this.groupBySize(jobs);
      case 'mixed':
      default:
        return this.groupMixed(jobs);
    }
  }

  /**
   * Group jobs by type
   */
  private groupByType(jobs: BatchJob[]): BatchJob[][] {
    const groups = new Map<string, BatchJob[]>();
    
    for (const job of jobs) {
      if (!groups.has(job.type)) {
        groups.set(job.type, []);
      }
      groups.get(job.type)!.push(job);
    }
    
    return Array.from(groups.values());
  }

  /**
   * Group jobs by priority
   */
  private groupByPriority(jobs: BatchJob[]): BatchJob[][] {
    const groups = new Map<string, BatchJob[]>();
    
    for (const job of jobs) {
      if (!groups.has(job.priority)) {
        groups.set(job.priority, []);
      }
      groups.get(job.priority)!.push(job);
    }
    
    // Return in priority order
    return this.config.priorityLevels
      .map(priority => groups.get(priority) || [])
      .filter(group => group.length > 0);
  }

  /**
   * Group jobs by estimated size/duration
   */
  private groupBySize(jobs: BatchJob[]): BatchJob[][] {
    const smallJobs = jobs.filter(j => (j.estimatedDuration || 0) < 1000);
    const mediumJobs = jobs.filter(j => (j.estimatedDuration || 0) >= 1000 && (j.estimatedDuration || 0) < 5000);
    const largeJobs = jobs.filter(j => (j.estimatedDuration || 0) >= 5000);
    
    return [smallJobs, mediumJobs, largeJobs].filter(group => group.length > 0);
  }

  /**
   * Mixed grouping strategy (balanced approach)
   */
  private groupMixed(jobs: BatchJob[]): BatchJob[][] {
    // Sort by priority first, then by type
    const sortedJobs = jobs.sort((a, b) => {
      const priorityOrder = this.config.priorityLevels.indexOf(a.priority) - 
                           this.config.priorityLevels.indexOf(b.priority);
      if (priorityOrder !== 0) return priorityOrder;
      return a.type.localeCompare(b.type);
    });
    
    // Create batches of optimal size
    const groups: BatchJob[][] = [];
    for (let i = 0; i < sortedJobs.length; i += this.config.batchSize) {
      groups.push(sortedJobs.slice(i, i + this.config.batchSize));
    }
    
    return groups;
  }

  /**
   * Process a group of jobs with concurrency control
   */
  private async processJobGroup(
    jobs: BatchJob[],
    options: BatchExecutionOptions
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const processing: Promise<BatchResult>[] = [];
    
    for (const job of jobs) {
      // Check dependencies
      if (options.enableDependencies && !this.areDependenciesSatisfied(job)) {
        continue; // Skip for now, will be picked up later
      }
      
      // Check concurrency limit
      if (processing.length >= (options.maxConcurrency || this.config.maxConcurrency)) {
        const result = await Promise.race(processing);
        results.push(result);
        processing.splice(processing.findIndex(p => p === Promise.resolve(result)), 1);
      }
      
      // Start processing job
      const processingPromise = this.executeJobWithTimeout(
        job,
        this.processors.get(job.type)!,
        performance.now()
      );
      processing.push(processingPromise);
    }
    
    // Wait for remaining jobs
    const remainingResults = await Promise.all(processing);
    results.push(...remainingResults);
    
    return results;
  }

  /**
   * Get next jobs to process based on priorities and dependencies
   */
  private getNextJobs(maxJobs: number): BatchJob[] {
    const jobs: BatchJob[] = [];
    
    // Process by priority order
    for (const priority of this.config.priorityLevels) {
      const queue = this.priorityQueues.get(priority) || [];
      
      for (const job of queue) {
        if (jobs.length >= maxJobs) break;
        
        // Check dependencies
        if (this.config.enableDependencies && !this.areDependenciesSatisfied(job)) {
          continue;
        }
        
        jobs.push(job);
      }
      
      if (jobs.length >= maxJobs) break;
    }
    
    return jobs;
  }

  /**
   * Add job to priority queue
   */
  private addToPriorityQueue(job: BatchJob, isRetry = false): void {
    const queue = this.priorityQueues.get(job.priority);
    if (queue) {
      if (isRetry) {
        // Add retries to front of queue
        queue.unshift(job);
      } else {
        queue.push(job);
      }
    }
  }

  /**
   * Remove job from all priority queues
   */
  private removeFromPriorityQueues(jobId: string): void {
    this.priorityQueues.forEach(queue => {
      const index = queue.findIndex(job => job.id === jobId);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    });
  }

  /**
   * Build dependency graph for a job
   */
  private buildDependencyGraph(job: BatchJob): void {
    if (!job.dependencies) return;
    
    for (const depId of job.dependencies) {
      if (!this.dependencyGraph.has(depId)) {
        this.dependencyGraph.set(depId, new Set());
      }
      this.dependencyGraph.get(depId)!.add(job.id);
    }
  }

  /**
   * Check if job dependencies are satisfied
   */
  private areDependenciesSatisfied(job: BatchJob): boolean {
    if (!job.dependencies) return true;
    
    return job.dependencies.every(depId => {
      const result = this.completedJobs.get(depId);
      return result && result.success;
    });
  }

  /**
   * Release jobs that were waiting for a dependency
   */
  private releaseDependentJobs(completedJobId: string): void {
    const dependentJobs = this.dependencyGraph.get(completedJobId);
    if (!dependentJobs) return;
    
    for (const jobId of dependentJobs) {
      const job = this.jobQueue.get(jobId);
      if (job && this.areDependenciesSatisfied(job)) {
        // Job is now ready to process
        this.emit('jobReady', { job });
      }
    }
  }

  /**
   * Setup resource monitoring
   */
  private setupResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      this.updateResourceUtilization();
    }, 1000); // Update every second
  }

  /**
   * Update resource utilization metrics
   */
  private updateResourceUtilization(): void {
    const memoryUsage = process.memoryUsage();
    const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    this.stats.resourceUtilization = {
      cpu: process.cpuUsage().user / 1000000, // Convert to percentage
      memory: memoryPercent,
      activeWorkers: this.processingJobs.size,
    };
  }

  /**
   * Update runtime statistics
   */
  private updateRuntimeStats(): void {
    const totalProcessed = this.stats.completedJobs + this.stats.failedJobs;
    this.stats.throughput = totalProcessed > 0 ? 
      totalProcessed / (this.stats.totalDuration || 1) : 0;
  }

  /**
   * Update final batch statistics
   */
  private updateFinalStats(results: BatchResult[], totalDuration: number): void {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    this.stats.completedJobs = successful;
    this.stats.failedJobs = failed;
    this.stats.totalDuration = totalDuration;
    this.stats.throughput = results.length / totalDuration;
    this.stats.successRate = successful / results.length;
    this.stats.errorRate = failed / results.length;
    this.stats.averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.processingJobs.clear();
    this.completedJobs.clear();
    this.dependencyGraph.clear();
    this.priorityQueues.forEach(queue => queue.length = 0);
    
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = undefined;
    }
  }
} 