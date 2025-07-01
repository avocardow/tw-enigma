/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { WorkerPool } from '../performance/workerPool.js';
import { MetricsCollector } from '../metrics/collector.js';
import { ErrorHandler } from '../errorHandler/errorHandler.js';
import { StateManager } from './stateManagement.js';

/**
 * Configuration schema for incremental pipeline
 */
export const IncrementalPipelineConfigSchema = z.object({
  // Processing modes
  mode: z.enum(['batch', 'streaming', 'hybrid']).default('hybrid'),
  batchSize: z.number().min(1).max(10000).default(100),
  streamingBufferSize: z.number().min(1024).max(1048576).default(65536), // 64KB
  
  // Parallelism settings
  maxConcurrency: z.number().min(1).max(32).default(4),
  enableWorkerThreads: z.boolean().default(true),
  workerPoolSize: z.number().min(1).max(16).default(4),
  
  // Checkpointing and fault tolerance
  enableCheckpointing: z.boolean().default(true),
  checkpointInterval: z.number().min(1000).max(300000).default(30000), // 30 seconds
  maxRetries: z.number().min(0).max(10).default(3),
  retryBackoffMs: z.number().min(100).max(10000).default(1000),
  
  // Performance optimization
  enableCaching: z.boolean().default(true),
  cacheStrategy: z.enum(['lru', 'lfu', 'ttl', 'arc']).default('arc'),
  cacheMaxSize: z.number().min(100).max(100000).default(10000),
  cacheTtlMs: z.number().min(60000).max(3600000).default(300000), // 5 minutes
  
  // Data consistency
  enableConsistencyChecks: z.boolean().default(true),
  consistencyLevel: z.enum(['eventual', 'strong']).default('strong'),
  dataIntegrityChecks: z.boolean().default(true),
  
  // Resource management
  memoryLimitMB: z.number().min(128).max(8192).default(2048),
  enableMemoryPressureHandling: z.boolean().default(true),
  gcThresholdMB: z.number().min(64).max(4096).default(512),
});

export type IncrementalPipelineConfig = z.infer<typeof IncrementalPipelineConfigSchema>;

/**
 * Interface for pipeline stage data transformation
 */
export interface PipelineStageData<TInput = any, TOutput = any> {
  input: TInput;
  output?: TOutput;
  metadata: {
    stageId: string;
    timestamp: Date;
    batchId?: string;
    checkpointId?: string;
    retryCount: number;
  };
  context: Map<string, any>;
}

/**
 * Interface for pipeline stage implementation
 */
export interface PipelineStage<TInput = any, TOutput = any> {
  readonly id: string;
  readonly name: string;
  readonly dependencies: string[];
  readonly isParallel: boolean;
  readonly supportsBatching: boolean;
  readonly supportsStreaming: boolean;
  
  /**
   * Initialize the stage
   */
  initialize(config: IncrementalPipelineConfig): Promise<void>;
  
  /**
   * Process data through this stage
   */
  process(data: PipelineStageData<TInput, TOutput>): Promise<PipelineStageData<TInput, TOutput>>;
  
  /**
   * Process batch of data (if supported)
   */
  processBatch?(batch: PipelineStageData<TInput, TOutput>[]): Promise<PipelineStageData<TInput, TOutput>[]>;
  
  /**
   * Handle stage rollback for error recovery
   */
  rollback?(data: PipelineStageData<TInput, TOutput>): Promise<void>;
  
  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}

/**
 * Interface for data source abstraction
 */
export interface DataSource<T = any> {
  readonly id: string;
  readonly supportsStreaming: boolean;
  readonly supportsBatching: boolean;
  
  /**
   * Read data from source
   */
  read(): AsyncIterable<T>;
  
  /**
   * Read batch of data
   */
  readBatch(size: number): Promise<T[]>;
  
  /**
   * Get total count if available
   */
  count(): Promise<number | undefined>;
  
  /**
   * Check if more data is available
   */
  hasMore(): Promise<boolean>;
}

/**
 * Interface for data sink abstraction
 */
export interface DataSink<T = any> {
  readonly id: string;
  readonly supportsStreaming: boolean;
  readonly supportsBatching: boolean;
  
  /**
   * Write single item to sink
   */
  write(data: T): Promise<void>;
  
  /**
   * Write batch of items
   */
  writeBatch(batch: T[]): Promise<void>;
  
  /**
   * Finalize and flush all data
   */
  finalize(): Promise<void>;
}

/**
 * Checkpoint data structure
 */
export interface Checkpoint {
  id: string;
  timestamp: Date;
  stageId: string;
  batchId?: string;
  processedCount: number;
  state: Record<string, any>;
  metrics: Record<string, number>;
}

/**
 * Pipeline execution context
 */
export interface PipelineContext {
  readonly executionId: string;
  readonly startTime: Date;
  readonly config: IncrementalPipelineConfig;
  stages: Map<string, PipelineStage>;
  checkpoints: Map<string, Checkpoint>;
  metrics: MetricsCollector;
  errorHandler: ErrorHandler;
  workerPool?: WorkerPool;
  cache: Map<string, any>;
}

/**
 * Pipeline execution statistics
 */
export interface PipelineStats {
  executionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  retryCount: number;
  checkpointCount: number;
  throughputPerSecond: number;
  memoryUsageMB: number;
  stageStats: Map<string, {
    processedCount: number;
    averageLatencyMs: number;
    errorCount: number;
    throughputPerSecond: number;
  }>;
}

/**
 * Main incremental processing pipeline
 */
export class IncrementalPipeline extends EventEmitter {
  private readonly config: IncrementalPipelineConfig;
  private readonly stages: Map<string, PipelineStage> = new Map();
  private readonly dataSources: Map<string, DataSource> = new Map();
  private readonly dataSinks: Map<string, DataSink> = new Map();
  private readonly stageGraph: Map<string, Set<string>> = new Map();
  
  private context?: PipelineContext;
  private isRunning = false;
  private isPaused = false;
  private currentBatch?: string;
  private stats?: PipelineStats;
  
  constructor(config: Partial<IncrementalPipelineConfig> = {}) {
    super();
    this.config = IncrementalPipelineConfigSchema.parse(config);
  }

  /**
   * Add a pipeline stage
   */
  public addStage(stage: PipelineStage): IncrementalPipeline {
    if (this.isRunning) {
      throw new Error('Cannot add stages while pipeline is running');
    }
    
    this.stages.set(stage.id, stage);
    this.stageGraph.set(stage.id, new Set(stage.dependencies));
    
    this.emit('stage_added', { stageId: stage.id, stageName: stage.name });
    return this;
  }

  /**
   * Add a data source
   */
  public addDataSource(source: DataSource): IncrementalPipeline {
    this.dataSources.set(source.id, source);
    this.emit('source_added', { sourceId: source.id });
    return this;
  }

  /**
   * Add a data sink
   */
  public addDataSink(sink: DataSink): IncrementalPipeline {
    this.dataSinks.set(sink.id, sink);
    this.emit('sink_added', { sinkId: sink.id });
    return this;
  }

  /**
   * Validate pipeline configuration and dependencies
   */
  public validate(): boolean {
    try {
      // Check for circular dependencies
      if (this.hasCyclicDependencies()) {
        throw new Error('Circular dependencies detected in pipeline stages');
      }
      
      // Validate stage dependencies exist
      for (const [stageId, dependencies] of this.stageGraph.entries()) {
        for (const depId of dependencies) {
          if (!this.stages.has(depId)) {
            throw new Error(`Stage ${stageId} depends on non-existent stage ${depId}`);
          }
        }
      }
      
      // Ensure at least one data source and sink
      if (this.dataSources.size === 0) {
        throw new Error('Pipeline must have at least one data source');
      }
      
      if (this.dataSinks.size === 0) {
        throw new Error('Pipeline must have at least one data sink');
      }
      
      return true;
    } catch (error) {
      this.emit('validation_error', { error: error.message });
      return false;
    }
  }

  /**
   * Start pipeline execution
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Pipeline is already running');
    }
    
    if (!this.validate()) {
      throw new Error('Pipeline validation failed');
    }
    
    this.isRunning = true;
    this.isPaused = false;
    
    try {
      await this.initializePipeline();
      
      this.emit('pipeline_started', { 
        executionId: this.context!.executionId,
        stageCount: this.stages.size,
        mode: this.config.mode
      });
      
      await this.executePipeline();
      
    } catch (error) {
      this.emit('pipeline_error', { 
        error: error.message,
        executionId: this.context?.executionId 
      });
      throw error;
    } finally {
      this.isRunning = false;
      await this.cleanupPipeline();
    }
  }

  /**
   * Stop pipeline execution
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    this.emit('pipeline_stopping', { executionId: this.context?.executionId });
    
    // Allow current operations to complete gracefully
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.emit('pipeline_stopped', { executionId: this.context?.executionId });
  }

  /**
   * Pause pipeline execution
   */
  public pause(): void {
    if (!this.isRunning) {
      throw new Error('Cannot pause: pipeline is not running');
    }
    
    this.isPaused = true;
    this.emit('pipeline_paused', { executionId: this.context?.executionId });
  }

  /**
   * Resume pipeline execution
   */
  public resume(): void {
    if (!this.isRunning) {
      throw new Error('Cannot resume: pipeline is not running');
    }
    
    this.isPaused = false;
    this.emit('pipeline_resumed', { executionId: this.context?.executionId });
  }

  /**
   * Get current pipeline statistics
   */
  public getStats(): PipelineStats | undefined {
    return this.stats;
  }

  /**
   * Get pipeline configuration
   */
  public getConfig(): IncrementalPipelineConfig {
    return { ...this.config };
  }

  /**
   * Create checkpoint for current state
   */
  public async createCheckpoint(): Promise<Checkpoint> {
    if (!this.context) {
      throw new Error('Cannot create checkpoint: pipeline not initialized');
    }
    
    const checkpoint: Checkpoint = {
      id: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      stageId: 'pipeline',
      batchId: this.currentBatch,
      processedCount: this.stats?.totalProcessed || 0,
      state: this.serializeState(),
      metrics: this.collectMetrics(),
    };
    
    this.context.checkpoints.set(checkpoint.id, checkpoint);
    this.emit('checkpoint_created', { checkpointId: checkpoint.id });
    
    return checkpoint;
  }

  /**
   * Restore from checkpoint
   */
  public async restoreFromCheckpoint(checkpointId: string): Promise<void> {
    if (!this.context) {
      throw new Error('Cannot restore: pipeline not initialized');
    }
    
    const checkpoint = this.context.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    
    await this.deserializeState(checkpoint.state);
    this.emit('checkpoint_restored', { checkpointId });
  }

  /**
   * Initialize pipeline context and resources
   */
  private async initializePipeline(): Promise<void> {
    const executionId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.context = {
      executionId,
      startTime: new Date(),
      config: this.config,
      stages: new Map(this.stages),
      checkpoints: new Map(),
      metrics: new MetricsCollector(),
      errorHandler: new ErrorHandler(),
      cache: new Map(),
    };
    
    // Initialize worker pool if enabled
    if (this.config.enableWorkerThreads) {
      this.context.workerPool = new WorkerPool({
        maxWorkers: this.config.workerPoolSize,
        taskTimeout: 60000,
      });
    }
    
    // Initialize all stages
    for (const stage of this.stages.values()) {
      await stage.initialize(this.config);
    }
    
    // Initialize statistics
    this.stats = {
      executionId,
      startTime: new Date(),
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      retryCount: 0,
      checkpointCount: 0,
      throughputPerSecond: 0,
      memoryUsageMB: 0,
      stageStats: new Map(),
    };
    
    // Start periodic checkpointing if enabled
    if (this.config.enableCheckpointing) {
      this.startPeriodicCheckpointing();
    }
  }

  /**
   * Execute the main pipeline processing
   */
  private async executePipeline(): Promise<void> {
    const executionOrder = this.getExecutionOrder();
    
    for (const sourceId of this.dataSources.keys()) {
      const source = this.dataSources.get(sourceId)!;
      
      if (this.config.mode === 'streaming' || (this.config.mode === 'hybrid' && source.supportsStreaming)) {
        await this.executeStreamingPipeline(source, executionOrder);
      } else {
        await this.executeBatchPipeline(source, executionOrder);
      }
    }
    
    // Finalize all sinks
    for (const sink of this.dataSinks.values()) {
      await sink.finalize();
    }
    
    this.finalizeStats();
  }

  /**
   * Execute pipeline in streaming mode
   */
  private async executeStreamingPipeline(source: DataSource, executionOrder: string[][]): Promise<void> {
    for await (const data of source.read()) {
      if (!this.isRunning) break;
      
      while (this.isPaused && this.isRunning) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await this.processDataThroughStages(data, executionOrder);
      this.updateStats();
    }
  }

  /**
   * Execute pipeline in batch mode
   */
  private async executeBatchPipeline(source: DataSource, executionOrder: string[][]): Promise<void> {
    while (await source.hasMore() && this.isRunning) {
      while (this.isPaused && this.isRunning) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const batch = await source.readBatch(this.config.batchSize);
      if (batch.length === 0) break;
      
      this.currentBatch = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      for (const data of batch) {
        await this.processDataThroughStages(data, executionOrder);
        this.updateStats();
      }
      
      this.currentBatch = undefined;
    }
  }

  /**
   * Process data through all pipeline stages
   */
  private async processDataThroughStages(inputData: any, executionOrder: string[][]): Promise<void> {
    let currentData: PipelineStageData = {
      input: inputData,
      metadata: {
        stageId: 'input',
        timestamp: new Date(),
        batchId: this.currentBatch,
        retryCount: 0,
      },
      context: new Map(),
    };
    
    // Process through each level of stages (parallel execution within levels)
    for (const stageLevel of executionOrder) {
      if (stageLevel.length === 1) {
        // Single stage - execute sequentially
        const stage = this.stages.get(stageLevel[0])!;
        currentData = await this.executeStageWithRetry(stage, currentData);
      } else {
        // Multiple stages - execute in parallel
        const results = await Promise.all(
          stageLevel.map(stageId => {
            const stage = this.stages.get(stageId)!;
            return this.executeStageWithRetry(stage, { ...currentData });
          })
        );
        
        // Merge results (last stage wins for conflicts)
        currentData = results[results.length - 1];
      }
    }
    
    // Write to all sinks
    for (const sink of this.dataSinks.values()) {
      await sink.write(currentData.output || currentData.input);
    }
  }

  /**
   * Execute stage with retry logic
   */
  private async executeStageWithRetry(stage: PipelineStage, data: PipelineStageData): Promise<PipelineStageData> {
    let lastError: Error | undefined;
    
    for (let retry = 0; retry <= this.config.maxRetries; retry++) {
      try {
        data.metadata.retryCount = retry;
        data.metadata.stageId = stage.id;
        
        const result = await stage.process(data);
        
        // Update stage statistics
        this.updateStageStats(stage.id, true);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.updateStageStats(stage.id, false);
        
        if (retry < this.config.maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.retryBackoffMs * Math.pow(2, retry))
          );
        }
      }
    }
    
    // All retries failed
    this.stats!.errorCount++;
    this.emit('stage_error', {
      stageId: stage.id,
      error: lastError!.message,
      retryCount: this.config.maxRetries,
    });
    
    throw lastError!;
  }

  /**
   * Get stage execution order based on dependencies
   */
  private getExecutionOrder(): string[][] {
    const order: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (stageId: string): number => {
      if (visiting.has(stageId)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(stageId)) {
        return 0;
      }
      
      visiting.add(stageId);
      
      let maxDepth = 0;
      const dependencies = this.stageGraph.get(stageId) || new Set();
      
      for (const depId of dependencies) {
        maxDepth = Math.max(maxDepth, visit(depId) + 1);
      }
      
      visiting.delete(stageId);
      visited.add(stageId);
      
      // Ensure the order array has enough levels
      while (order.length <= maxDepth) {
        order.push([]);
      }
      
      order[maxDepth].push(stageId);
      return maxDepth;
    };
    
    for (const stageId of this.stages.keys()) {
      if (!visited.has(stageId)) {
        visit(stageId);
      }
    }
    
    return order;
  }

  /**
   * Check for cyclic dependencies in stage graph
   */
  private hasCyclicDependencies(): boolean {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const hasCycle = (stageId: string): boolean => {
      if (visiting.has(stageId)) {
        return true;
      }
      if (visited.has(stageId)) {
        return false;
      }
      
      visiting.add(stageId);
      
      const dependencies = this.stageGraph.get(stageId) || new Set();
      for (const depId of dependencies) {
        if (hasCycle(depId)) {
          return true;
        }
      }
      
      visiting.delete(stageId);
      visited.add(stageId);
      
      return false;
    };
    
    for (const stageId of this.stages.keys()) {
      if (!visited.has(stageId) && hasCycle(stageId)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Start periodic checkpointing
   */
  private startPeriodicCheckpointing(): void {
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }
      
      try {
        await this.createCheckpoint();
      } catch (error) {
        this.emit('checkpoint_error', { error: error.message });
      }
    }, this.config.checkpointInterval);
  }

  /**
   * Update pipeline statistics
   */
  private updateStats(): void {
    if (!this.stats) return;
    
    this.stats.totalProcessed++;
    this.stats.successCount++;
    
    const now = Date.now();
    const duration = now - this.stats.startTime.getTime();
    this.stats.throughputPerSecond = this.stats.totalProcessed / (duration / 1000);
    
    // Update memory usage
    if (process.memoryUsage) {
      this.stats.memoryUsageMB = process.memoryUsage().heapUsed / (1024 * 1024);
    }
  }

  /**
   * Update stage-specific statistics
   */
  private updateStageStats(stageId: string, success: boolean): void {
    if (!this.stats) return;
    
    let stageStats = this.stats.stageStats.get(stageId);
    if (!stageStats) {
      stageStats = {
        processedCount: 0,
        averageLatencyMs: 0,
        errorCount: 0,
        throughputPerSecond: 0,
      };
      this.stats.stageStats.set(stageId, stageStats);
    }
    
    stageStats.processedCount++;
    if (!success) {
      stageStats.errorCount++;
    }
  }

  /**
   * Finalize statistics
   */
  private finalizeStats(): void {
    if (!this.stats) return;
    
    this.stats.endTime = new Date();
    this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
  }

  /**
   * Serialize current pipeline state
   */
  private serializeState(): Record<string, any> {
    return {
      currentBatch: this.currentBatch,
      stats: this.stats,
      // Add more state as needed
    };
  }

  /**
   * Deserialize pipeline state
   */
  private async deserializeState(state: Record<string, any>): Promise<void> {
    this.currentBatch = state.currentBatch;
    if (state.stats) {
      this.stats = { ...this.stats, ...state.stats };
    }
  }

  /**
   * Collect metrics for checkpointing
   */
  private collectMetrics(): Record<string, number> {
    return {
      totalProcessed: this.stats?.totalProcessed || 0,
      errorCount: this.stats?.errorCount || 0,
      memoryUsage: this.stats?.memoryUsageMB || 0,
      throughput: this.stats?.throughputPerSecond || 0,
    };
  }

  /**
   * Clean up pipeline resources
   */
  private async cleanupPipeline(): Promise<void> {
    // Clean up all stages
    for (const stage of this.stages.values()) {
      try {
        await stage.cleanup();
      } catch (error) {
        this.emit('cleanup_error', { 
          stageId: stage.id, 
          error: error.message 
        });
      }
    }
    
    // Clean up worker pool
    if (this.context?.workerPool) {
      await this.context.workerPool.terminate();
    }
    
    this.emit('pipeline_cleaned_up', { 
      executionId: this.context?.executionId 
    });
  }
}

/**
 * Factory function to create pipeline instances
 */
export function createIncrementalPipeline(config?: Partial<IncrementalPipelineConfig>): IncrementalPipeline {
  return new IncrementalPipeline(config);
}

/**
 * Utility function to validate pipeline configuration
 */
export function validatePipelineConfig(config: any): config is IncrementalPipelineConfig {
  try {
    IncrementalPipelineConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}