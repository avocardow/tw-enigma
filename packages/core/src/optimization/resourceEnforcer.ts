/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { ResourceManager, type ResourceQuotaConfig, type OperationContext } from './resourceManager.js';
import { MetricsCollector } from '../metrics/collector.js';

/**
 * Resource enforcement configuration
 */
export const ResourceEnforcementConfigSchema = z.object({
  // Enforcement strategies
  enforcement: z.object({
    strategy: z.enum(['fail_fast', 'queue', 'throttle', 'graceful_degradation']).default('throttle'),
    enablePreemption: z.boolean().default(true),
    enableAdaptiveScaling: z.boolean().default(true),
    enablePriorityQueuing: z.boolean().default(true),
  }).default({}),

  // Queue management
  queuing: z.object({
    maxQueueSize: z.number().min(1).max(10000).default(1000),
    queueTimeout: z.number().min(1000).max(3600000).default(300000), // 5 minutes
    enablePriorityQueues: z.boolean().default(true),
    enableQueueMetrics: z.boolean().default(true),
  }).default({}),

  // Throttling configuration
  throttling: z.object({
    enableDynamicThrottling: z.boolean().default(true),
    throttleBackoffMs: z.number().min(100).max(60000).default(1000),
    maxThrottleBackoffMs: z.number().min(1000).max(300000).default(30000),
    throttleRecoveryFactor: z.number().min(0.1).max(0.9).default(0.5),
  }).default({}),

  // Adaptive scaling
  adaptive: z.object({
    enableAutoScaling: z.boolean().default(true),
    scaleUpThreshold: z.number().min(0.1).max(0.9).default(0.7), // 70%
    scaleDownThreshold: z.number().min(0.1).max(0.8).default(0.3), // 30%
    scaleUpFactor: z.number().min(1.1).max(3.0).default(1.5),
    scaleDownFactor: z.number().min(0.3).max(0.9).default(0.8,
    cooldownPeriodMs: z.number().min(5000).max(300000).default(30000), // 30 seconds
  }).default({}),
});

export type ResourceEnforcementConfig = z.infer<typeof ResourceEnforcementConfigSchema>;

/**
 * Queued operation with priority
 */
export interface QueuedOperation {
  id: string;
  context: OperationContext;
  queuedAt: Date;
  priority: number; // Higher number = higher priority
  retryCount: number;
  maxRetries: number;
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
}

/**
 * Resource allocation result
 */
export interface AllocationResult {
  granted: boolean;
  reason?: string;
  estimatedWaitTime?: number;
  queuePosition?: number;
  alternativeAction?: string;
}

/**
 * Scaling event
 */
export interface ScalingEvent {
  timestamp: Date;
  type: 'scale_up' | 'scale_down';
  resource: string;
  fromValue: number;
  toValue: number;
  trigger: string;
  reason: string;
}

/**
 * Advanced resource enforcement system with adaptive scaling and intelligent queuing
 */
export class ResourceEnforcer extends EventEmitter {
  private readonly config: ResourceEnforcementConfig;
  private readonly resourceManager: ResourceManager;
  private readonly metricsCollector: MetricsCollector;

  // Operation queues by priority
  private readonly highPriorityQueue: QueuedOperation[] = [];
  private readonly mediumPriorityQueue: QueuedOperation[] = [];
  private readonly lowPriorityQueue: QueuedOperation[] = [];
  
  // Throttling state
  private throttleState = {
    active: false,
    backoffMs: 0,
    throttledOperations: 0,
    lastThrottleTime: 0,
  };

  // Adaptive scaling state
  private scalingState = {
    lastScaleTime: 0,
    currentLimits: new Map<string, number>(),
    targetUtilization: new Map<string, number>(),
    scalingHistory: [] as ScalingEvent[],
  };

  // Statistics
  private stats = {
    totalRequests: 0,
    grantedRequests: 0,
    deniedRequests: 0,
    queuedRequests: 0,
    timeoutRequests: 0,
    throttledRequests: 0,
    averageQueueTime: 0,
    scalingEvents: 0,
  };

  constructor(
    config: Partial<ResourceEnforcementConfig>,
    resourceManager: ResourceManager,
    metricsCollector: MetricsCollector
  ) {
    super();
    
    this.config = ResourceEnforcementConfigSchema.parse(config);
    this.resourceManager = resourceManager;
    this.metricsCollector = metricsCollector;

    this.initializeScalingLimits();
    this.startQueueProcessor();
    this.startAdaptiveScaling();
    
    // Listen to resource manager events
    this.resourceManager.on('resourceViolation', this.handleResourceViolation.bind(this));
    this.resourceManager.on('memoryReclamationRequested', this.handleMemoryPressure.bind(this));
  }

  /**
   * Request resource allocation for an operation
   */
  public async requestAllocation(context: OperationContext): Promise<AllocationResult> {
    this.stats.totalRequests++;
    
    try {
      // Check if operation can start immediately
      const canStart = await this.resourceManager.startOperation(context);
      
      if (canStart) {
        this.stats.grantedRequests++;
        return { granted: true };
      }

      // Apply enforcement strategy
      return await this.applyEnforcementStrategy(context);
      
    } catch (error) {
      this.stats.deniedRequests++;
      return {
        granted: false,
        reason: `Resource allocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Complete an operation and update quotas
   */
  public completeOperation(operationId: string, success: boolean = true): void {
    this.resourceManager.completeOperation(operationId, success);
    
    // Trigger queue processing to handle waiting operations
    this.processQueue();
  }

  /**
   * Apply configured enforcement strategy
   */
  private async applyEnforcementStrategy(context: OperationContext): Promise<AllocationResult> {
    const strategy = this.config.enforcement.strategy;
    
    switch (strategy) {
      case 'fail_fast':
        this.stats.deniedRequests++;
        return {
          granted: false,
          reason: 'Resource limit exceeded - fail fast mode',
          alternativeAction: 'Retry later or increase resource limits',
        };

      case 'queue':
        return await this.queueOperation(context);

      case 'throttle':
        return await this.throttleOperation(context);

      case 'graceful_degradation':
        return await this.degradeOperation(context);

      default:
        return { granted: false, reason: 'Unknown enforcement strategy' };
    }
  }

  /**
   * Queue operation for later execution
   */
  private async queueOperation(context: OperationContext): Promise<AllocationResult> {
    const totalQueueSize = this.getTotalQueueSize();
    
    if (totalQueueSize >= this.config.queuing.maxQueueSize) {
      this.stats.deniedRequests++;
      return {
        granted: false,
        reason: 'Queue is full',
        alternativeAction: 'Wait for queue space or increase maxQueueSize',
      };
    }

    const priority = this.calculateOperationPriority(context);
    const queuedOperation: QueuedOperation = {
      id: context.id,
      context,
      queuedAt: new Date(),
      priority,
      retryCount: 0,
      maxRetries: 3,
      resolve: () => {}, // Will be set by promise
      reject: () => {},  // Will be set by promise
    };

    return new Promise<AllocationResult>((resolve, reject) => {
      queuedOperation.resolve = (granted: boolean) => {
        resolve({
          granted,
          queuePosition: this.getQueuePosition(queuedOperation),
          estimatedWaitTime: this.estimateWaitTime(queuedOperation),
        });
      };
      queuedOperation.reject = reject;

      // Add to appropriate priority queue
      if (context.priority === 'critical' || context.priority === 'high') {
        this.highPriorityQueue.push(queuedOperation);
        this.highPriorityQueue.sort((a, b) => b.priority - a.priority);
      } else if (context.priority === 'medium') {
        this.mediumPriorityQueue.push(queuedOperation);
      } else {
        this.lowPriorityQueue.push(queuedOperation);
      }

      this.stats.queuedRequests++;

      // Set timeout for queued operation
      setTimeout(() => {
        this.timeoutQueuedOperation(queuedOperation);
      }, this.config.queuing.queueTimeout);
    });
  }

  /**
   * Apply throttling to operation
   */
  private async throttleOperation(context: OperationContext): Promise<AllocationResult> {
    if (!this.throttleState.active) {
      this.activateThrottling();
    }

    const backoffTime = Math.min(
      this.throttleState.backoffMs * Math.pow(2, this.throttleState.throttledOperations),
      this.config.throttling.maxThrottleBackoffMs
    );

    this.stats.throttledRequests++;

    // Wait for backoff period
    await new Promise(resolve => setTimeout(resolve, backoffTime));

    // Try again after backoff
    const canStart = await this.resourceManager.startOperation(context);
    
    if (canStart) {
      this.stats.grantedRequests++;
      return { granted: true };
    } else {
      // Queue if still can't start
      return await this.queueOperation(context);
    }
  }

  /**
   * Apply graceful degradation
   */
  private async degradeOperation(context: OperationContext): Promise<AllocationResult> {
    // Reduce operation requirements or scope
    const degradedContext: OperationContext = {
      ...context,
      resourceRequirements: {
        memory: context.resourceRequirements?.memory ? context.resourceRequirements.memory * 0.5 : undefined,
        cpu: context.resourceRequirements?.cpu ? context.resourceRequirements.cpu * 0.7 : undefined,
        disk: context.resourceRequirements?.disk ? context.resourceRequirements.disk * 0.8 : undefined,
      },
      priority: context.priority === 'high' ? 'medium' : context.priority === 'medium' ? 'low' : 'low',
    };

    const canStart = await this.resourceManager.startOperation(degradedContext);
    
    if (canStart) {
      this.stats.grantedRequests++;
      this.emit('operationDegraded', {
        originalContext: context,
        degradedContext,
        timestamp: new Date(),
      });
      return { 
        granted: true,
        alternativeAction: 'Operation degraded to fit resource constraints',
      };
    } else {
      return await this.queueOperation(degradedContext);
    }
  }

  /**
   * Process queued operations
   */
  private processQueue(): void {
    const queues = [this.highPriorityQueue, this.mediumPriorityQueue, this.lowPriorityQueue];
    
    for (const queue of queues) {
      while (queue.length > 0) {
        const operation = queue[0];
        
        // Try to start the operation
        this.resourceManager.startOperation(operation.context)
          .then(canStart => {
            if (canStart) {
              queue.shift(); // Remove from queue
              operation.resolve(true);
              
              const queueTime = Date.now() - operation.queuedAt.getTime();
              this.updateAverageQueueTime(queueTime);
            } else {
              // Can't start yet, leave in queue
              break;
            }
          })
          .catch(error => {
            queue.shift(); // Remove from queue
            operation.reject(error);
          });
      }
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 1000); // Process every second
  }

  /**
   * Activate throttling mechanism
   */
  private activateThrottling(): void {
    this.throttleState.active = true;
    this.throttleState.backoffMs = this.config.throttling.throttleBackoffMs;
    this.throttleState.lastThrottleTime = Date.now();
    
    this.emit('throttlingActivated', {
      backoffMs: this.throttleState.backoffMs,
      timestamp: new Date(),
    });

    // Auto-deactivate after period
    setTimeout(() => {
      this.deactivateThrottling();
    }, this.config.throttling.maxThrottleBackoffMs);
  }

  /**
   * Deactivate throttling mechanism
   */
  private deactivateThrottling(): void {
    this.throttleState.active = false;
    this.throttleState.throttledOperations = 0;
    
    this.emit('throttlingDeactivated', {
      timestamp: new Date(),
    });
  }

  /**
   * Handle resource violation from resource manager
   */
  private handleResourceViolation(violation: any): void {
    if (violation.type === 'critical') {
      // Activate emergency throttling
      this.activateThrottling();
      
      // Clear low priority operations from queue
      this.lowPriorityQueue.length = 0;
      
      this.emit('emergencyThrottling', {
        violation,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle memory pressure events
   */
  private handleMemoryPressure(): void {
    // Clear queues of low priority operations
    const removedOps = this.lowPriorityQueue.splice(0);
    
    for (const op of removedOps) {
      op.reject(new Error('Operation cancelled due to memory pressure'));
    }

    this.emit('memoryPressureResponse', {
      cancelledOperations: removedOps.length,
      timestamp: new Date(),
    });
  }

  /**
   * Initialize adaptive scaling limits
   */
  private initializeScalingLimits(): void {
    if (!this.config.adaptive.enableAutoScaling) return;

    const usage = this.resourceManager.getCurrentUsage();
    
    this.scalingState.currentLimits.set('memory', usage.memory.heapTotal);
    this.scalingState.currentLimits.set('cpu', 100); // 100% CPU
    this.scalingState.currentLimits.set('concurrency', usage.processing.activeFiles);
    
    this.scalingState.targetUtilization.set('memory', this.config.adaptive.scaleUpThreshold);
    this.scalingState.targetUtilization.set('cpu', this.config.adaptive.scaleUpThreshold);
    this.scalingState.targetUtilization.set('concurrency', this.config.adaptive.scaleUpThreshold);
  }

  /**
   * Start adaptive scaling monitoring
   */
  private startAdaptiveScaling(): void {
    if (!this.config.adaptive.enableAutoScaling) return;

    setInterval(() => {
      this.checkScalingConditions();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Check if scaling is needed
   */
  private checkScalingConditions(): void {
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.scalingState.lastScaleTime < this.config.adaptive.cooldownPeriodMs) {
      return;
    }

    const usage = this.resourceManager.getCurrentUsage();
    
    // Check memory scaling
    this.checkResourceScaling('memory', usage.memory.percentage);
    
    // Check queue-based concurrency scaling
    const queueUtilization = this.getTotalQueueSize() / this.config.queuing.maxQueueSize;
    this.checkResourceScaling('concurrency', queueUtilization);
  }

  /**
   * Check scaling for specific resource
   */
  private checkResourceScaling(resource: string, utilization: number): void {
    const currentLimit = this.scalingState.currentLimits.get(resource) || 0;
    const scaleUpThreshold = this.config.adaptive.scaleUpThreshold;
    const scaleDownThreshold = this.config.adaptive.scaleDownThreshold;

    if (utilization > scaleUpThreshold) {
      this.scaleUp(resource, currentLimit);
    } else if (utilization < scaleDownThreshold) {
      this.scaleDown(resource, currentLimit);
    }
  }

  /**
   * Scale resource up
   */
  private scaleUp(resource: string, currentLimit: number): void {
    const newLimit = currentLimit * this.config.adaptive.scaleUpFactor;
    this.scalingState.currentLimits.set(resource, newLimit);
    this.scalingState.lastScaleTime = Date.now();

    const event: ScalingEvent = {
      timestamp: new Date(),
      type: 'scale_up',
      resource,
      fromValue: currentLimit,
      toValue: newLimit,
      trigger: 'high_utilization',
      reason: `Utilization exceeded ${this.config.adaptive.scaleUpThreshold}`,
    };

    this.scalingState.scalingHistory.push(event);
    this.stats.scalingEvents++;

    this.emit('resourceScaled', event);
  }

  /**
   * Scale resource down
   */
  private scaleDown(resource: string, currentLimit: number): void {
    const newLimit = currentLimit * this.config.adaptive.scaleDownFactor;
    this.scalingState.currentLimits.set(resource, newLimit);
    this.scalingState.lastScaleTime = Date.now();

    const event: ScalingEvent = {
      timestamp: new Date(),
      type: 'scale_down',
      resource,
      fromValue: currentLimit,
      toValue: newLimit,
      trigger: 'low_utilization',
      reason: `Utilization below ${this.config.adaptive.scaleDownThreshold}`,
    };

    this.scalingState.scalingHistory.push(event);
    this.stats.scalingEvents++;

    this.emit('resourceScaled', event);
  }

  /**
   * Calculate operation priority
   */
  private calculateOperationPriority(context: OperationContext): number {
    let priority = 0;
    
    switch (context.priority) {
      case 'critical': priority += 100; break;
      case 'high': priority += 75; break;
      case 'medium': priority += 50; break;
      case 'low': priority += 25; break;
    }

    // Boost priority for operations with lower resource requirements
    if (context.resourceRequirements?.memory && context.resourceRequirements.memory < 100) {
      priority += 10;
    }

    return priority;
  }

  /**
   * Remove timed out queued operation
   */
  private timeoutQueuedOperation(operation: QueuedOperation): void {
    const queues = [this.highPriorityQueue, this.mediumPriorityQueue, this.lowPriorityQueue];
    
    for (const queue of queues) {
      const index = queue.findIndex(op => op.id === operation.id);
      if (index !== -1) {
        queue.splice(index, 1);
        operation.reject(new Error('Operation timed out in queue'));
        this.stats.timeoutRequests++;
        break;
      }
    }
  }

  /**
   * Get total queue size across all priorities
   */
  private getTotalQueueSize(): number {
    return this.highPriorityQueue.length + this.mediumPriorityQueue.length + this.lowPriorityQueue.length;
  }

  /**
   * Get queue position for operation
   */
  private getQueuePosition(operation: QueuedOperation): number {
    let position = 1;
    
    // Count higher priority operations ahead
    if (operation.context.priority === 'low') {
      position += this.highPriorityQueue.length + this.mediumPriorityQueue.length;
      position += this.lowPriorityQueue.findIndex(op => op.id === operation.id);
    } else if (operation.context.priority === 'medium') {
      position += this.highPriorityQueue.length;
      position += this.mediumPriorityQueue.findIndex(op => op.id === operation.id);
    } else {
      position += this.highPriorityQueue.findIndex(op => op.id === operation.id);
    }
    
    return Math.max(1, position);
  }

  /**
   * Estimate wait time for queued operation
   */
  private estimateWaitTime(operation: QueuedOperation): number {
    const position = this.getQueuePosition(operation);
    const averageProcessingTime = 5000; // 5 seconds estimate
    return position * averageProcessingTime;
  }

  /**
   * Update average queue time
   */
  private updateAverageQueueTime(queueTime: number): void {
    const alpha = 0.1; // Exponential moving average
    this.stats.averageQueueTime = alpha * queueTime + (1 - alpha) * this.stats.averageQueueTime;
  }

  /**
   * Get enforcement statistics
   */
  public getStatistics() {
    return {
      ...this.stats,
      throttling: this.throttleState,
      scaling: {
        ...this.scalingState,
        currentLimits: Object.fromEntries(this.scalingState.currentLimits),
        targetUtilization: Object.fromEntries(this.scalingState.targetUtilization),
      },
      queues: {
        high: this.highPriorityQueue.length,
        medium: this.mediumPriorityQueue.length,
        low: this.lowPriorityQueue.length,
        total: this.getTotalQueueSize(),
      },
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Clear all queues
    for (const op of this.highPriorityQueue) {
      op.reject(new Error('Resource enforcer shutting down'));
    }
    for (const op of this.mediumPriorityQueue) {
      op.reject(new Error('Resource enforcer shutting down'));
    }
    for (const op of this.lowPriorityQueue) {
      op.reject(new Error('Resource enforcer shutting down'));
    }
    
    this.highPriorityQueue.length = 0;
    this.mediumPriorityQueue.length = 0;
    this.lowPriorityQueue.length = 0;
  }
}

/**
 * Factory function to create resource enforcer
 */
export function createResourceEnforcer(
  config: Partial<ResourceEnforcementConfig>,
  resourceManager: ResourceManager,
  metricsCollector: MetricsCollector
): ResourceEnforcer {
  return new ResourceEnforcer(config, resourceManager, metricsCollector);
}