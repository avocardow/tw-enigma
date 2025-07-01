/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { MetricsCollector } from '../metrics/collector.js';
import { PerformanceMonitor } from '../metrics/performanceMonitor.js';
import { MemoryMonitor } from '../metrics/memoryMonitor.js';

/**
 * Resource quota configuration schema
 */
export const ResourceQuotaConfigSchema = z.object({
  // Processing limits
  processing: z.object({
    maxFileSize: z.number().min(1024).max(1024 * 1024 * 1024).default(50 * 1024 * 1024), // 50MB
    maxProcessingTime: z.number().min(1000).max(3600000).default(300000), // 5 minutes
    maxConcurrentFiles: z.number().min(1).max(1000).default(100),
    maxFilesPerBatch: z.number().min(1).max(10000).default(1000),
    maxTotalFiles: z.number().min(1).max(1000000).default(100000),
    enableTimeoutChecks: z.boolean().default(true),
    enableSizeValidation: z.boolean().default(true),
  }).default({}),

  // Memory quotas
  memory: z.object({
    maxHeapUsage: z.number().min(128).max(32768).default(2048), // 2GB in MB
    maxTotalMemory: z.number().min(256).max(65536).default(4096), // 4GB in MB
    gcTriggerThreshold: z.number().min(0.1).max(0.95).default(0.8), // 80%
    memoryPressureThreshold: z.number().min(0.5).max(0.99).default(0.9), // 90%
    enableAutomaticGC: z.boolean().default(true),
    enableMemoryReclamation: z.boolean().default(true),
    memoryCheckInterval: z.number().min(1000).max(60000).default(5000), // 5 seconds
  }).default({}),

  // CPU and performance quotas
  cpu: z.object({
    maxCpuUsage: z.number().min(0.1).max(1.0).default(0.8), // 80%
    maxConcurrentOperations: z.number().min(1).max(100).default(10),
    maxWorkerThreads: z.number().min(1).max(32).default(8),
    cpuThrottleThreshold: z.number().min(0.7).max(0.99).default(0.9), // 90%
    enableCpuThrottling: z.boolean().default(true),
  }).default({}),

  // Network and I/O quotas
  network: z.object({
    maxConnections: z.number().min(1).max(1000).default(50),
    connectionTimeout: z.number().min(1000).max(300000).default(30000), // 30 seconds
    requestTimeout: z.number().min(1000).max(600000).default(60000), // 60 seconds
    maxRequestsPerSecond: z.number().min(1).max(10000).default(100),
    maxBandwidthMBps: z.number().min(1).max(1000).default(100), // 100 MB/s
    enableRateLimiting: z.boolean().default(true),
  }).default({}),

  // Disk I/O quotas
  disk: z.object({
    maxDiskUsage: z.number().min(100).max(1000000).default(10000), // 10GB in MB
    maxOpenFileHandles: z.number().min(10).max(10000).default(1000),
    maxReadOperationsPerSecond: z.number().min(1).max(10000).default(1000),
    maxWriteOperationsPerSecond: z.number().min(1).max(10000).default(500),
    enableDiskQuotas: z.boolean().default(true),
  }).default({}),

  // Resource enforcement policies
  enforcement: z.object({
    enableHardLimits: z.boolean().default(true),
    enableSoftLimits: z.boolean().default(true),
    gracefulDegradation: z.boolean().default(true),
    emergencyShutdown: z.boolean().default(true),
    warningThreshold: z.number().min(0.1).max(0.95).default(0.8), // 80% of limit
    criticalThreshold: z.number().min(0.5).max(0.99).default(0.95), // 95% of limit
  }).default({}),

  // Monitoring and alerting
  monitoring: z.object({
    enableRealTimeMonitoring: z.boolean().default(true),
    monitoringInterval: z.number().min(100).max(60000).default(1000), // 1 second
    enableAlerting: z.boolean().default(true),
    alertCooldownMs: z.number().min(1000).max(3600000).default(60000), // 1 minute
    enableMetricsCollection: z.boolean().default(true),
    retentionPeriodHours: z.number().min(1).max(168).default(24), // 24 hours
  }).default({}),
});

export type ResourceQuotaConfig = z.infer<typeof ResourceQuotaConfigSchema>;

/**
 * Resource usage snapshot
 */
export interface ResourceUsageSnapshot {
  timestamp: Date;
  processing: {
    activeFiles: number;
    activeBatches: number;
    totalFilesProcessed: number;
    averageProcessingTime: number;
    longestRunningOperation: number;
  };
  memory: {
    heapUsed: number; // MB
    heapTotal: number; // MB
    external: number; // MB
    rss: number; // MB
    percentage: number; // % of limit
  };
  cpu: {
    usage: number; // %
    activeOperations: number;
    workerThreads: number;
    loadAverage: number[];
  };
  network: {
    activeConnections: number;
    requestsPerSecond: number;
    bandwidthUsage: number; // MB/s
  };
  disk: {
    usage: number; // MB
    openFileHandles: number;
    readOpsPerSecond: number;
    writeOpsPerSecond: number;
  };
}

/**
 * Resource violation alert
 */
export interface ResourceViolation {
  id: string;
  timestamp: Date;
  type: 'warning' | 'critical' | 'hard_limit';
  category: 'processing' | 'memory' | 'cpu' | 'network' | 'disk';
  resource: string;
  currentValue: number;
  limitValue: number;
  percentage: number;
  message: string;
  actionTaken?: string;
}

/**
 * Operation context for resource tracking
 */
export interface OperationContext {
  id: string;
  type: 'file_processing' | 'batch_processing' | 'optimization' | 'analysis';
  startTime: Date;
  expectedDuration?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  resourceRequirements?: {
    memory?: number; // MB
    cpu?: number; // % (0-1)
    disk?: number; // MB
  };
  metadata?: Record<string, any>;
}

/**
 * Comprehensive resource manager with configurable quotas and enforcement
 */
export class ResourceManager extends EventEmitter {
  private readonly config: ResourceQuotaConfig;
  private readonly metricsCollector: MetricsCollector;
  private readonly performanceMonitor?: PerformanceMonitor;
  private readonly memoryMonitor?: MemoryMonitor;

  // Resource tracking
  private activeOperations = new Map<string, OperationContext>();
  private resourceUsageHistory: ResourceUsageSnapshot[] = [];
  private currentViolations = new Map<string, ResourceViolation>();
  
  // Monitoring intervals
  private monitoringInterval?: NodeJS.Timeout;
  private memoryCheckInterval?: NodeJS.Timeout;
  
  // Rate limiting and throttling
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private cpuThrottleActive = false;
  private memoryPressureActive = false;
  
  // Statistics
  private stats = {
    totalOperationsStarted: 0,
    totalOperationsCompleted: 0,
    totalViolations: 0,
    totalEmergencyShutdowns: 0,
    averageResourceUtilization: {
      memory: 0,
      cpu: 0,
      disk: 0,
      network: 0,
    },
  };

  constructor(
    config: Partial<ResourceQuotaConfig> = {},
    metricsCollector: MetricsCollector,
    performanceMonitor?: PerformanceMonitor,
    memoryMonitor?: MemoryMonitor
  ) {
    super();
    
    this.config = ResourceQuotaConfigSchema.parse(config);
    this.metricsCollector = metricsCollector;
    this.performanceMonitor = performanceMonitor;
    this.memoryMonitor = memoryMonitor;
    
    this.setupEnvironmentOverrides();
    this.startMonitoring();
  }

  /**
   * Start a tracked operation with resource validation
   */
  public async startOperation(context: OperationContext): Promise<boolean> {
    // Check if operation can be started within current quotas
    const canStart = await this.validateOperationStart(context);
    
    if (!canStart) {
      this.emit('operationRejected', {
        operationId: context.id,
        reason: 'Resource quota exceeded',
        timestamp: new Date(),
      });
      return false;
    }

    // Reserve resources
    this.activeOperations.set(context.id, {
      ...context,
      startTime: new Date(),
    });

    this.stats.totalOperationsStarted++;
    
    this.emit('operationStarted', {
      operationId: context.id,
      type: context.type,
      timestamp: new Date(),
    });

    // Set up timeout if configured
    if (this.config.processing.enableTimeoutChecks && context.expectedDuration) {
      setTimeout(() => {
        this.checkOperationTimeout(context.id);
      }, context.expectedDuration);
    }

    return true;
  }

  /**
   * Complete a tracked operation
   */
  public completeOperation(operationId: string, success: boolean = true): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      return;
    }

    const duration = Date.now() - operation.startTime.getTime();
    
    this.activeOperations.delete(operationId);
    this.stats.totalOperationsCompleted++;

    this.emit('operationCompleted', {
      operationId,
      duration,
      success,
      timestamp: new Date(),
    });

    // Record performance metrics
    this.metricsCollector.recordPerformance(`operation_${operation.type}`, {
      duration,
      memory: this.getCurrentMemoryUsage(),
      cpu: 0,
      stage: operation.type,
      operationName: operationId,
    });
  }

  /**
   * Validate if file can be processed within quotas
   */
  public validateFileProcessing(filePath: string, fileSize: number): {
    allowed: boolean;
    reason?: string;
    suggestedAction?: string;
  } {
    // Check file size limit
    if (this.config.processing.enableSizeValidation && 
        fileSize > this.config.processing.maxFileSize) {
      return {
        allowed: false,
        reason: `File size ${this.formatBytes(fileSize)} exceeds limit of ${this.formatBytes(this.config.processing.maxFileSize)}`,
        suggestedAction: 'Split file into smaller chunks or increase maxFileSize limit',
      };
    }

    // Check concurrent file limit
    const activeFiles = Array.from(this.activeOperations.values())
      .filter(op => op.type === 'file_processing').length;
    
    if (activeFiles >= this.config.processing.maxConcurrentFiles) {
      return {
        allowed: false,
        reason: `Maximum concurrent files (${this.config.processing.maxConcurrentFiles}) reached`,
        suggestedAction: 'Wait for other files to complete or increase maxConcurrentFiles limit',
      };
    }

    // Check memory availability
    if (this.memoryPressureActive) {
      return {
        allowed: false,
        reason: 'System under memory pressure',
        suggestedAction: 'Wait for memory pressure to subside or increase memory limits',
      };
    }

    return { allowed: true };
  }

  /**
   * Apply CPU throttling if usage exceeds threshold
   */
  public async applyCpuThrottling(): Promise<void> {
    if (!this.config.cpu.enableCpuThrottling) return;

    const cpuUsage = await this.getCurrentCpuUsage();
    
    if (cpuUsage > this.config.cpu.cpuThrottleThreshold && !this.cpuThrottleActive) {
      this.cpuThrottleActive = true;
      
      // Reduce concurrent operations
      const targetOps = Math.max(1, Math.floor(this.config.cpu.maxConcurrentOperations * 0.5));
      
      this.emit('cpuThrottleActivated', {
        currentUsage: cpuUsage,
        threshold: this.config.cpu.cpuThrottleThreshold,
        reducedConcurrency: targetOps,
        timestamp: new Date(),
      });

      // Wait for CPU usage to decrease
      setTimeout(() => {
        this.cpuThrottleActive = false;
        this.emit('cpuThrottleDeactivated', { timestamp: new Date() });
      }, 10000); // 10 second throttle period
      
    } else if (cpuUsage < this.config.cpu.cpuThrottleThreshold * 0.8) {
      this.cpuThrottleActive = false;
    }
  }

  /**
   * Check for memory pressure and take corrective action
   */
  public async handleMemoryPressure(): Promise<void> {
    const memoryUsage = this.getCurrentMemoryUsage();
    const memoryPercentage = memoryUsage / this.config.memory.maxHeapUsage;

    if (memoryPercentage > this.config.memory.memoryPressureThreshold) {
      if (!this.memoryPressureActive) {
        this.memoryPressureActive = true;
        
        this.createViolation({
          category: 'memory',
          resource: 'heap_usage',
          currentValue: memoryUsage,
          limitValue: this.config.memory.maxHeapUsage,
          type: 'critical',
          message: `Memory pressure detected: ${memoryUsage.toFixed(2)}MB / ${this.config.memory.maxHeapUsage}MB`,
        });

        // Trigger memory reclamation
        if (this.config.memory.enableMemoryReclamation) {
          await this.reclaimMemory();
        }

        // Force garbage collection if enabled
        if (this.config.memory.enableAutomaticGC && global.gc) {
          global.gc();
        }
      }
    } else if (memoryPercentage < this.config.memory.memoryPressureThreshold * 0.8) {
      this.memoryPressureActive = false;
    }
  }

  /**
   * Enforce network rate limiting
   */
  public checkRateLimit(clientId: string): boolean {
    if (!this.config.network.enableRateLimiting) return true;

    const now = Date.now();
    const windowStart = now - 1000; // 1 second window
    
    const clientRequests = this.requestCounts.get(clientId) || { count: 0, resetTime: now };
    
    // Reset counter if window expired
    if (now >= clientRequests.resetTime) {
      clientRequests.count = 0;
      clientRequests.resetTime = now + 1000;
    }
    
    clientRequests.count++;
    this.requestCounts.set(clientId, clientRequests);
    
    if (clientRequests.count > this.config.network.maxRequestsPerSecond) {
      this.createViolation({
        category: 'network',
        resource: 'requests_per_second',
        currentValue: clientRequests.count,
        limitValue: this.config.network.maxRequestsPerSecond,
        type: 'warning',
        message: `Rate limit exceeded for client ${clientId}`,
      });
      return false;
    }
    
    return true;
  }

  /**
   * Get current resource usage snapshot
   */
  public getCurrentUsage(): ResourceUsageSnapshot {
    const memoryUsage = process.memoryUsage();
    
    return {
      timestamp: new Date(),
      processing: {
        activeFiles: Array.from(this.activeOperations.values())
          .filter(op => op.type === 'file_processing').length,
        activeBatches: Array.from(this.activeOperations.values())
          .filter(op => op.type === 'batch_processing').length,
        totalFilesProcessed: this.stats.totalOperationsCompleted,
        averageProcessingTime: this.calculateAverageProcessingTime(),
        longestRunningOperation: this.getLongestRunningOperationDuration(),
      },
      memory: {
        heapUsed: memoryUsage.heapUsed / (1024 * 1024),
        heapTotal: memoryUsage.heapTotal / (1024 * 1024),
        external: memoryUsage.external / (1024 * 1024),
        rss: memoryUsage.rss / (1024 * 1024),
        percentage: (memoryUsage.heapUsed / (1024 * 1024)) / this.config.memory.maxHeapUsage,
      },
      cpu: {
        usage: 0, // Would need additional monitoring
        activeOperations: this.activeOperations.size,
        workerThreads: 0, // Would need worker thread tracking
        loadAverage: [],
      },
      network: {
        activeConnections: 0, // Would need connection tracking
        requestsPerSecond: this.calculateRequestsPerSecond(),
        bandwidthUsage: 0, // Would need bandwidth monitoring
      },
      disk: {
        usage: 0, // Would need disk usage monitoring
        openFileHandles: 0, // Would need file handle tracking
        readOpsPerSecond: 0, // Would need I/O monitoring
        writeOpsPerSecond: 0,
      },
    };
  }

  /**
   * Get all active violations
   */
  public getActiveViolations(): ResourceViolation[] {
    return Array.from(this.currentViolations.values());
  }

  /**
   * Get resource utilization statistics
   */
  public getStatistics() {
    return {
      ...this.stats,
      config: this.config,
      currentUsage: this.getCurrentUsage(),
      activeOperations: this.activeOperations.size,
      activeViolations: this.currentViolations.size,
    };
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(updates: Partial<ResourceQuotaConfig>): void {
    const newConfig = ResourceQuotaConfigSchema.parse({
      ...this.config,
      ...updates,
    });
    
    Object.assign(this.config, newConfig);
    
    this.emit('configUpdated', {
      updates,
      timestamp: new Date(),
    });
  }

  /**
   * Validate if operation can start within current quotas
   */
  private async validateOperationStart(context: OperationContext): Promise<boolean> {
    // Check processing limits
    if (this.activeOperations.size >= this.config.processing.maxConcurrentFiles) {
      return false;
    }

    // Check memory pressure
    if (this.memoryPressureActive && context.priority !== 'critical') {
      return false;
    }

    // Check CPU throttling
    if (this.cpuThrottleActive && context.priority !== 'critical') {
      return false;
    }

    // Check resource requirements if specified
    if (context.resourceRequirements) {
      const currentUsage = this.getCurrentUsage();
      
      if (context.resourceRequirements.memory) {
        const projectedMemory = currentUsage.memory.heapUsed + context.resourceRequirements.memory;
        if (projectedMemory > this.config.memory.maxHeapUsage) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if operation has exceeded timeout
   */
  private checkOperationTimeout(operationId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const duration = Date.now() - operation.startTime.getTime();
    const maxDuration = this.config.processing.maxProcessingTime;

    if (duration > maxDuration) {
      this.createViolation({
        category: 'processing',
        resource: 'processing_time',
        currentValue: duration,
        limitValue: maxDuration,
        type: 'critical',
        message: `Operation ${operationId} exceeded timeout: ${duration}ms > ${maxDuration}ms`,
        actionTaken: 'Operation will be terminated',
      });

      // Force complete the operation
      this.completeOperation(operationId, false);
      
      this.emit('operationTimeout', {
        operationId,
        duration,
        maxDuration,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Create and track a resource violation
   */
  private createViolation(params: {
    category: 'processing' | 'memory' | 'cpu' | 'network' | 'disk';
    resource: string;
    currentValue: number;
    limitValue: number;
    type: 'warning' | 'critical' | 'hard_limit';
    message: string;
    actionTaken?: string;
  }): void {
    const violation: ResourceViolation = {
      id: `${params.category}_${params.resource}_${Date.now()}`,
      timestamp: new Date(),
      type: params.type,
      category: params.category,
      resource: params.resource,
      currentValue: params.currentValue,
      limitValue: params.limitValue,
      percentage: (params.currentValue / params.limitValue) * 100,
      message: params.message,
      actionTaken: params.actionTaken,
    };

    this.currentViolations.set(violation.id, violation);
    this.stats.totalViolations++;

    this.emit('resourceViolation', violation);

    // Remove violation after cooldown period
    setTimeout(() => {
      this.currentViolations.delete(violation.id);
    }, this.config.monitoring.alertCooldownMs);
  }

  /**
   * Attempt to reclaim memory
   */
  private async reclaimMemory(): Promise<void> {
    // Clear low-priority operations
    for (const [id, operation] of this.activeOperations.entries()) {
      if (operation.priority === 'low') {
        this.completeOperation(id, false);
      }
    }

    // Emit event for external cleanup
    this.emit('memoryReclamationRequested', {
      currentUsage: this.getCurrentMemoryUsage(),
      timestamp: new Date(),
    });
  }

  /**
   * Start resource monitoring
   */
  private startMonitoring(): void {
    if (!this.config.monitoring.enableRealTimeMonitoring) return;

    this.monitoringInterval = setInterval(() => {
      this.collectResourceMetrics();
    }, this.config.monitoring.monitoringInterval);

    this.memoryCheckInterval = setInterval(() => {
      this.handleMemoryPressure();
      this.applyCpuThrottling();
    }, this.config.memory.memoryCheckInterval);
  }

  /**
   * Collect and store resource metrics
   */
  private collectResourceMetrics(): void {
    const snapshot = this.getCurrentUsage();
    
    this.resourceUsageHistory.push(snapshot);
    
    // Maintain history size
    const maxHistory = Math.floor(
      (this.config.monitoring.retentionPeriodHours * 3600000) / 
      this.config.monitoring.monitoringInterval
    );
    
    if (this.resourceUsageHistory.length > maxHistory) {
      this.resourceUsageHistory.shift();
    }

    // Update average utilization
    this.updateAverageUtilization(snapshot);

    // Check for violations
    this.checkResourceThresholds(snapshot);
  }

  /**
   * Check resource thresholds and create violations
   */
  private checkResourceThresholds(snapshot: ResourceUsageSnapshot): void {
    const enforcement = this.config.enforcement;
    
    // Memory checks
    if (snapshot.memory.percentage > enforcement.warningThreshold) {
      const type = snapshot.memory.percentage > enforcement.criticalThreshold ? 'critical' : 'warning';
      
      this.createViolation({
        category: 'memory',
        resource: 'heap_usage',
        currentValue: snapshot.memory.heapUsed,
        limitValue: this.config.memory.maxHeapUsage,
        type,
        message: `Memory usage at ${(snapshot.memory.percentage * 100).toFixed(1)}%`,
      });
    }

    // Processing checks
    if (snapshot.processing.activeFiles > this.config.processing.maxConcurrentFiles * enforcement.warningThreshold) {
      this.createViolation({
        category: 'processing',
        resource: 'concurrent_files',
        currentValue: snapshot.processing.activeFiles,
        limitValue: this.config.processing.maxConcurrentFiles,
        type: 'warning',
        message: `High concurrent file processing: ${snapshot.processing.activeFiles}`,
      });
    }
  }

  /**
   * Update rolling average utilization
   */
  private updateAverageUtilization(snapshot: ResourceUsageSnapshot): void {
    const alpha = 0.1; // Exponential moving average factor
    
    this.stats.averageResourceUtilization.memory = 
      alpha * snapshot.memory.percentage + (1 - alpha) * this.stats.averageResourceUtilization.memory;
  }

  /**
   * Setup environment variable overrides
   */
  private setupEnvironmentOverrides(): void {
    // Processing overrides
    if (process.env.TW_ENIGMA_MAX_FILE_SIZE) {
      this.config.processing.maxFileSize = parseInt(process.env.TW_ENIGMA_MAX_FILE_SIZE, 10);
    }
    if (process.env.TW_ENIGMA_MAX_PROCESSING_TIME) {
      this.config.processing.maxProcessingTime = parseInt(process.env.TW_ENIGMA_MAX_PROCESSING_TIME, 10);
    }
    if (process.env.TW_ENIGMA_MAX_CONCURRENT_FILES) {
      this.config.processing.maxConcurrentFiles = parseInt(process.env.TW_ENIGMA_MAX_CONCURRENT_FILES, 10);
    }

    // Memory overrides
    if (process.env.TW_ENIGMA_MAX_HEAP_USAGE) {
      this.config.memory.maxHeapUsage = parseInt(process.env.TW_ENIGMA_MAX_HEAP_USAGE, 10);
    }
    if (process.env.TW_ENIGMA_GC_TRIGGER_THRESHOLD) {
      this.config.memory.gcTriggerThreshold = parseFloat(process.env.TW_ENIGMA_GC_TRIGGER_THRESHOLD);
    }

    // Network overrides
    if (process.env.TW_ENIGMA_MAX_CONNECTIONS) {
      this.config.network.maxConnections = parseInt(process.env.TW_ENIGMA_MAX_CONNECTIONS, 10);
    }
    if (process.env.TW_ENIGMA_CONNECTION_TIMEOUT) {
      this.config.network.connectionTimeout = parseInt(process.env.TW_ENIGMA_CONNECTION_TIMEOUT, 10);
    }
  }

  /**
   * Utility methods
   */
  private getCurrentMemoryUsage(): number {
    return process.memoryUsage().heapUsed / (1024 * 1024);
  }

  private async getCurrentCpuUsage(): Promise<number> {
    // Simplified CPU usage - would need more sophisticated monitoring
    return 0;
  }

  private calculateAverageProcessingTime(): number {
    if (this.stats.totalOperationsCompleted === 0) return 0;
    // Would need to track operation durations
    return 0;
  }

  private getLongestRunningOperationDuration(): number {
    let longest = 0;
    const now = Date.now();
    
    for (const operation of this.activeOperations.values()) {
      const duration = now - operation.startTime.getTime();
      longest = Math.max(longest, duration);
    }
    
    return longest;
  }

  private calculateRequestsPerSecond(): number {
    // Would need request tracking
    return 0;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    this.activeOperations.clear();
    this.currentViolations.clear();
    this.requestCounts.clear();
  }
}

/**
 * Factory function to create resource manager
 */
export function createResourceManager(
  config?: Partial<ResourceQuotaConfig>,
  metricsCollector?: MetricsCollector,
  performanceMonitor?: PerformanceMonitor,
  memoryMonitor?: MemoryMonitor
): ResourceManager {
  const collector = metricsCollector || new MetricsCollector();
  return new ResourceManager(config, collector, performanceMonitor, memoryMonitor);
}

/**
 * Validate resource quota configuration
 */
export function validateResourceConfig(config: unknown): ResourceQuotaConfig {
  return ResourceQuotaConfigSchema.parse(config);
}