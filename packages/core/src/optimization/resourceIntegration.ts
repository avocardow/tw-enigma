/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { ResourceManager, type OperationContext } from './resourceManager.js';
import { ResourceEnforcer } from './resourceEnforcer.js';
import { MetricsCollector } from '../metrics/collector.js';
import { PerformanceMonitor } from '../metrics/performanceMonitor.js';
import { MemoryMonitor } from '../metrics/memoryMonitor.js';
import { type ExtendedResourceConfig, getDefaultResourceConfig, mergeResourceConfigWithEnv } from '../config/resourceQuotaConfig.js';

/**
 * File processing context with resource requirements
 */
export interface FileProcessingContext extends OperationContext {
  type: 'file_processing';
  filePath: string;
  fileSize: number;
  estimatedMemoryUsage?: number;
  estimatedProcessingTime?: number;
}

/**
 * Batch processing context with resource requirements
 */
export interface BatchProcessingContext extends OperationContext {
  type: 'batch_processing';
  batchId: string;
  fileCount: number;
  totalSize: number;
  estimatedMemoryUsage?: number;
  estimatedProcessingTime?: number;
}

/**
 * Resource integration events
 */
export interface ResourceIntegrationEvents {
  'file.processing.started': { context: FileProcessingContext };
  'file.processing.completed': { context: FileProcessingContext; success: boolean; duration: number };
  'file.processing.rejected': { filePath: string; reason: string };
  'batch.processing.started': { context: BatchProcessingContext };
  'batch.processing.completed': { context: BatchProcessingContext; success: boolean; duration: number };
  'batch.processing.rejected': { batchId: string; reason: string };
  'resource.violation': { category: string; message: string; severity: string };
  'resource.scaled': { resource: string; fromValue: number; toValue: number };
  'queue.overflow': { queueType: string; size: number; limit: number };
  'throttling.activated': { reason: string; backoffMs: number };
  'memory.pressure': { usage: number; limit: number; action: string };
}

/**
 * Comprehensive resource integration system that connects resource management
 * with TW-Enigma's file processing pipeline
 */
export class ResourceIntegration extends EventEmitter {
  private readonly config: ExtendedResourceConfig;
  private readonly resourceManager: ResourceManager;
  private readonly resourceEnforcer: ResourceEnforcer;
  private readonly metricsCollector: MetricsCollector;
  private readonly performanceMonitor?: PerformanceMonitor;
  private readonly memoryMonitor?: MemoryMonitor;

  // Processing tracking
  private activeFileProcessing = new Map<string, FileProcessingContext>();
  private activeBatchProcessing = new Map<string, BatchProcessingContext>();
  
  // Performance statistics
  private stats = {
    totalFilesProcessed: 0,
    totalBatchesProcessed: 0,
    totalFilesRejected: 0,
    totalBatchesRejected: 0,
    averageFileProcessingTime: 0,
    averageBatchProcessingTime: 0,
    totalResourceViolations: 0,
    totalMemoryPressureEvents: 0,
  };

  constructor(
    config?: Partial<ExtendedResourceConfig>,
    metricsCollector?: MetricsCollector,
    performanceMonitor?: PerformanceMonitor,
    memoryMonitor?: MemoryMonitor
  ) {
    super();
    
    // Merge configuration with environment variables and defaults
    this.config = mergeResourceConfigWithEnv(config || {});
    
    // Initialize core systems
    this.metricsCollector = metricsCollector || new MetricsCollector();
    this.performanceMonitor = performanceMonitor;
    this.memoryMonitor = memoryMonitor;
    
    // Initialize resource management systems
    this.resourceManager = new ResourceManager(
      this.config.resourceQuotas,
      this.metricsCollector,
      this.performanceMonitor,
      this.memoryMonitor
    );
    
    this.resourceEnforcer = new ResourceEnforcer(
      this.config.resourceEnforcement || {},
      this.resourceManager,
      this.metricsCollector
    );
    
    this.setupEventListeners();
  }

  /**
   * Request permission to process a file
   */
  public async requestFileProcessing(
    filePath: string,
    fileSize: number,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      estimatedProcessingTime?: number;
      estimatedMemoryUsage?: number;
    } = {}
  ): Promise<{
    allowed: boolean;
    operationId?: string;
    reason?: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
  }> {
    // Validate file size if enabled
    if (this.config.resourceQuotas?.processing?.enableSizeValidation) {
      const validation = this.resourceManager.validateFileProcessing(filePath, fileSize);
      if (!validation.allowed) {
        this.stats.totalFilesRejected++;
        this.emit('file.processing.rejected', { filePath, reason: validation.reason! });
        return {
          allowed: false,
          reason: validation.reason,
        };
      }
    }

    // Create processing context
    const context: FileProcessingContext = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'file_processing',
      filePath,
      fileSize,
      startTime: new Date(),
      priority: options.priority || 'medium',
      estimatedMemoryUsage: options.estimatedMemoryUsage,
      estimatedProcessingTime: options.estimatedProcessingTime,
      resourceRequirements: {
        memory: options.estimatedMemoryUsage,
        disk: fileSize,
      },
      metadata: {
        filePath,
        fileSize,
      },
    };

    // Request resource allocation
    const allocation = await this.resourceEnforcer.requestAllocation(context);
    
    if (allocation.granted) {
      this.activeFileProcessing.set(context.id, context);
      this.emit('file.processing.started', { context });
      
      return {
        allowed: true,
        operationId: context.id,
      };
    } else {
      this.stats.totalFilesRejected++;
      this.emit('file.processing.rejected', { filePath, reason: allocation.reason! });
      
      return {
        allowed: false,
        reason: allocation.reason,
        queuePosition: allocation.queuePosition,
        estimatedWaitTime: allocation.estimatedWaitTime,
      };
    }
  }

  /**
   * Complete file processing
   */
  public completeFileProcessing(
    operationId: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): void {
    const context = this.activeFileProcessing.get(operationId);
    if (!context) {
      return;
    }

    const duration = Date.now() - context.startTime.getTime();
    
    // Update statistics
    this.stats.totalFilesProcessed++;
    this.updateAverageProcessingTime('file', duration);
    
    // Complete resource allocation
    this.resourceEnforcer.completeOperation(operationId, success);
    
    // Clean up
    this.activeFileProcessing.delete(operationId);
    
    this.emit('file.processing.completed', { context, success, duration });
    
    // Record metrics
    this.metricsCollector.recordPerformance('file_processing', {
      duration,
      memory: this.getCurrentMemoryUsage(),
      cpu: 0,
      stage: 'file_processing',
      operationName: operationId,
    });
  }

  /**
   * Request permission to process a batch of files
   */
  public async requestBatchProcessing(
    batchId: string,
    files: Array<{ path: string; size: number }>,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      estimatedProcessingTime?: number;
      estimatedMemoryUsage?: number;
    } = {}
  ): Promise<{
    allowed: boolean;
    operationId?: string;
    reason?: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
  }> {
    const fileCount = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    // Check batch size limits
    const maxBatch = this.config.resourceQuotas?.processing?.maxFilesPerBatch || 1000;
    if (fileCount > maxBatch) {
      this.stats.totalBatchesRejected++;
      const reason = `Batch size ${fileCount} exceeds limit of ${maxBatch} files`;
      this.emit('batch.processing.rejected', { batchId, reason });
      return {
        allowed: false,
        reason,
      };
    }

    // Create batch processing context
    const context: BatchProcessingContext = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'batch_processing',
      batchId,
      fileCount,
      totalSize,
      startTime: new Date(),
      priority: options.priority || 'medium',
      estimatedMemoryUsage: options.estimatedMemoryUsage,
      estimatedProcessingTime: options.estimatedProcessingTime,
      resourceRequirements: {
        memory: options.estimatedMemoryUsage,
        disk: totalSize,
      },
      metadata: {
        batchId,
        fileCount,
        totalSize,
        files: files.map(f => ({ path: f.path, size: f.size })),
      },
    };

    // Request resource allocation
    const allocation = await this.resourceEnforcer.requestAllocation(context);
    
    if (allocation.granted) {
      this.activeBatchProcessing.set(context.id, context);
      this.emit('batch.processing.started', { context });
      
      return {
        allowed: true,
        operationId: context.id,
      };
    } else {
      this.stats.totalBatchesRejected++;
      this.emit('batch.processing.rejected', { batchId, reason: allocation.reason! });
      
      return {
        allowed: false,
        reason: allocation.reason,
        queuePosition: allocation.queuePosition,
        estimatedWaitTime: allocation.estimatedWaitTime,
      };
    }
  }

  /**
   * Complete batch processing
   */
  public completeBatchProcessing(
    operationId: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): void {
    const context = this.activeBatchProcessing.get(operationId);
    if (!context) {
      return;
    }

    const duration = Date.now() - context.startTime.getTime();
    
    // Update statistics
    this.stats.totalBatchesProcessed++;
    this.updateAverageProcessingTime('batch', duration);
    
    // Complete resource allocation
    this.resourceEnforcer.completeOperation(operationId, success);
    
    // Clean up
    this.activeBatchProcessing.delete(operationId);
    
    this.emit('batch.processing.completed', { context, success, duration });
    
    // Record metrics
    this.metricsCollector.recordPerformance('batch_processing', {
      duration,
      memory: this.getCurrentMemoryUsage(),
      cpu: 0,
      stage: 'batch_processing',
      operationName: operationId,
    });
  }

  /**
   * Get current resource usage and statistics
   */
  public getResourceStatus() {
    return {
      config: this.config,
      currentUsage: this.resourceManager.getCurrentUsage(),
      enforcement: this.resourceEnforcer.getStatistics(),
      violations: this.resourceManager.getActiveViolations(),
      activeOperations: {
        files: this.activeFileProcessing.size,
        batches: this.activeBatchProcessing.size,
        total: this.activeFileProcessing.size + this.activeBatchProcessing.size,
      },
      statistics: this.stats,
      resourceManager: this.resourceManager.getStatistics(),
    };
  }

  /**
   * Update resource configuration at runtime
   */
  public updateConfiguration(updates: Partial<ExtendedResourceConfig>): void {
    // Merge updates with current config
    const newConfig = mergeResourceConfigWithEnv({ ...this.config, ...updates });
    
    // Update resource manager configuration
    if (updates.resourceQuotas) {
      this.resourceManager.updateConfig(updates.resourceQuotas);
    }
    
    // Update internal config
    Object.assign(this.config, newConfig);
    
    this.emit('configuration.updated', { updates });
  }

  /**
   * Force cleanup of resources (emergency use)
   */
  public async emergencyCleanup(): Promise<void> {
    // Complete all active operations as failed
    for (const [id, context] of this.activeFileProcessing.entries()) {
      this.completeFileProcessing(id, false);
    }
    
    for (const [id, context] of this.activeBatchProcessing.entries()) {
      this.completeBatchProcessing(id, false);
    }
    
    // Trigger memory reclamation
    this.emit('memory.pressure', {
      usage: this.getCurrentMemoryUsage(),
      limit: this.config.resourceQuotas?.memory?.maxHeapUsage || 2048,
      action: 'emergency_cleanup',
    });
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get performance recommendations based on current usage patterns
   */
  public getPerformanceRecommendations(): Array<{
    category: string;
    recommendation: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
  }> {
    const recommendations: Array<{
      category: string;
      recommendation: string;
      impact: 'low' | 'medium' | 'high';
      effort: 'low' | 'medium' | 'high';
    }> = [];
    
    const status = this.getResourceStatus();
    const usage = status.currentUsage;
    
    // Memory recommendations
    if (usage.memory.percentage > 0.8) {
      recommendations.push({
        category: 'memory',
        recommendation: 'Consider increasing memory limits or enabling more aggressive garbage collection',
        impact: 'high',
        effort: 'low',
      });
    }
    
    // Concurrency recommendations
    if (status.activeOperations.total > this.config.resourceQuotas?.processing?.maxConcurrentFiles! * 0.8) {
      recommendations.push({
        category: 'concurrency',
        recommendation: 'Consider increasing concurrent file processing limits or implementing better queueing',
        impact: 'medium',
        effort: 'medium',
      });
    }
    
    // Queue recommendations
    if (status.enforcement.queues.total > status.enforcement.queues.total * 0.7) {
      recommendations.push({
        category: 'queuing',
        recommendation: 'Consider increasing queue size or optimizing processing speed',
        impact: 'medium',
        effort: 'low',
      });
    }
    
    // Rejection rate recommendations
    const rejectionRate = (this.stats.totalFilesRejected + this.stats.totalBatchesRejected) / 
                         (this.stats.totalFilesProcessed + this.stats.totalBatchesProcessed + 
                          this.stats.totalFilesRejected + this.stats.totalBatchesRejected);
    
    if (rejectionRate > 0.1) {
      recommendations.push({
        category: 'limits',
        recommendation: 'High rejection rate detected. Consider increasing resource limits or optimizing processing',
        impact: 'high',
        effort: 'medium',
      });
    }
    
    return recommendations;
  }

  /**
   * Setup event listeners for resource management systems
   */
  private setupEventListeners(): void {
    // Resource manager events
    this.resourceManager.on('resourceViolation', (violation) => {
      this.stats.totalResourceViolations++;
      this.emit('resource.violation', {
        category: violation.category,
        message: violation.message,
        severity: violation.type,
      });
    });

    this.resourceManager.on('memoryReclamationRequested', () => {
      this.stats.totalMemoryPressureEvents++;
      this.emit('memory.pressure', {
        usage: this.getCurrentMemoryUsage(),
        limit: this.config.resourceQuotas?.memory?.maxHeapUsage || 2048,
        action: 'memory_reclamation',
      });
    });

    // Resource enforcer events
    this.resourceEnforcer.on('resourceScaled', (event) => {
      this.emit('resource.scaled', {
        resource: event.resource,
        fromValue: event.fromValue,
        toValue: event.toValue,
      });
    });

    this.resourceEnforcer.on('throttlingActivated', (event) => {
      this.emit('throttling.activated', {
        reason: 'resource_pressure',
        backoffMs: event.backoffMs,
      });
    });

    // Monitor queue overflow
    setInterval(() => {
      const stats = this.resourceEnforcer.getStatistics();
      const queueLimit = this.config.resourceEnforcement?.queuing?.maxQueueSize || 1000;
      
      if (stats.queues.total > queueLimit * 0.9) {
        this.emit('queue.overflow', {
          queueType: 'processing',
          size: stats.queues.total,
          limit: queueLimit,
        });
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Update average processing time using exponential moving average
   */
  private updateAverageProcessingTime(type: 'file' | 'batch', duration: number): void {
    const alpha = 0.1; // Smoothing factor
    
    if (type === 'file') {
      this.stats.averageFileProcessingTime = 
        alpha * duration + (1 - alpha) * this.stats.averageFileProcessingTime;
    } else {
      this.stats.averageBatchProcessingTime = 
        alpha * duration + (1 - alpha) * this.stats.averageBatchProcessingTime;
    }
  }

  /**
   * Get current memory usage in MB
   */
  private getCurrentMemoryUsage(): number {
    if (process.memoryUsage) {
      return process.memoryUsage().heapUsed / (1024 * 1024);
    }
    return 0;
  }

  /**
   * Cleanup all resources
   */
  public async cleanup(): Promise<void> {
    // Complete all active operations
    for (const id of this.activeFileProcessing.keys()) {
      this.completeFileProcessing(id, false);
    }
    
    for (const id of this.activeBatchProcessing.keys()) {
      this.completeBatchProcessing(id, false);
    }
    
    // Cleanup resource management systems
    this.resourceManager.cleanup();
    this.resourceEnforcer.cleanup();
    
    // Flush metrics
    await this.metricsCollector.flush();
  }
}

/**
 * Factory function to create resource integration system
 */
export function createResourceIntegration(
  config?: Partial<ExtendedResourceConfig>,
  metricsCollector?: MetricsCollector,
  performanceMonitor?: PerformanceMonitor,
  memoryMonitor?: MemoryMonitor
): ResourceIntegration {
  return new ResourceIntegration(config, metricsCollector, performanceMonitor, memoryMonitor);
}

/**
 * Create resource integration with automatic system detection
 */
export async function createAutoResourceIntegration(
  config?: Partial<ExtendedResourceConfig>
): Promise<ResourceIntegration> {
  // Initialize metrics systems
  const metricsCollector = new MetricsCollector();
  
  let performanceMonitor: PerformanceMonitor | undefined;
  let memoryMonitor: MemoryMonitor | undefined;
  
  try {
    // Try to create performance monitor
    performanceMonitor = new PerformanceMonitor(metricsCollector);
  } catch (error) {
    console.warn('Failed to initialize performance monitor:', error);
  }
  
  try {
    // Try to create memory monitor
    const { MemoryMonitor } = await import('../metrics/memoryMonitor.js');
    memoryMonitor = new MemoryMonitor({}, metricsCollector, performanceMonitor);
  } catch (error) {
    console.warn('Failed to initialize memory monitor:', error);
  }
  
  return new ResourceIntegration(config, metricsCollector, performanceMonitor, memoryMonitor);
}