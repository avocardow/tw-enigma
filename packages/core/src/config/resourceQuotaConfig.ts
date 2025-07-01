/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import { ResourceQuotaConfigSchema, type ResourceQuotaConfig } from '../optimization/resourceManager.js';
import { ResourceEnforcementConfigSchema, type ResourceEnforcementConfig } from '../optimization/resourceEnforcer.js';

/**
 * Extended configuration schema that includes resource quota management
 */
export const ExtendedResourceConfigSchema = z.object({
  // Core resource quotas
  resourceQuotas: ResourceQuotaConfigSchema.optional().describe('Resource quota configuration'),
  
  // Resource enforcement policies
  resourceEnforcement: ResourceEnforcementConfigSchema.optional().describe('Resource enforcement configuration'),
  
  // Integration settings
  resourceIntegration: z.object({
    // Enable resource management system
    enabled: z.boolean().default(true).describe('Enable resource quota management'),
    
    // Auto-scaling settings
    autoScaling: z.object({
      enabled: z.boolean().default(true).describe('Enable automatic resource scaling'),
      scaleUpFactor: z.number().min(1.1).max(5.0).default(1.5).describe('Scale up multiplier'),
      scaleDownFactor: z.number().min(0.1).max(0.9).default(0.8).describe('Scale down multiplier'),
      cooldownPeriodMs: z.number().min(5000).max(300000).default(30000).describe('Cooldown between scaling events'),
    }).default({}),
    
    // Monitoring and alerting
    monitoring: z.object({
      enabled: z.boolean().default(true).describe('Enable resource monitoring'),
      alertingEnabled: z.boolean().default(true).describe('Enable resource violation alerts'),
      metricsRetentionHours: z.number().min(1).max(168).default(24).describe('How long to retain metrics'),
      realTimeUpdates: z.boolean().default(true).describe('Enable real-time monitoring updates'),
    }).default({}),
    
    // Performance optimization
    optimization: z.object({
      enableAdaptiveLimits: z.boolean().default(true).describe('Automatically adjust limits based on usage patterns'),
      enablePredictiveScaling: z.boolean().default(false).describe('Use ML to predict resource needs'),
      enableLoadBalancing: z.boolean().default(true).describe('Balance load across available resources'),
    }).default({}),
    
    // Integration with existing systems
    integration: z.object({
      enableMetricsCollectorIntegration: z.boolean().default(true).describe('Integrate with metrics collector'),
      enablePerformanceMonitorIntegration: z.boolean().default(true).describe('Integrate with performance monitor'),
      enableMemoryMonitorIntegration: z.boolean().default(true).describe('Integrate with memory monitor'),
      enableFileProcessorIntegration: z.boolean().default(true).describe('Integrate with file processor'),
    }).default({}),
  }).default({}),
});

export type ExtendedResourceConfig = z.infer<typeof ExtendedResourceConfigSchema>;

/**
 * Environment variable mappings for resource configuration
 */
export const RESOURCE_ENV_MAPPINGS = {
  // Processing limits
  'TW_ENIGMA_MAX_FILE_SIZE': 'resourceQuotas.processing.maxFileSize',
  'TW_ENIGMA_MAX_PROCESSING_TIME': 'resourceQuotas.processing.maxProcessingTime',
  'TW_ENIGMA_MAX_CONCURRENT_FILES': 'resourceQuotas.processing.maxConcurrentFiles',
  'TW_ENIGMA_MAX_FILES_PER_BATCH': 'resourceQuotas.processing.maxFilesPerBatch',
  'TW_ENIGMA_MAX_TOTAL_FILES': 'resourceQuotas.processing.maxTotalFiles',
  
  // Memory limits
  'TW_ENIGMA_MAX_HEAP_USAGE': 'resourceQuotas.memory.maxHeapUsage',
  'TW_ENIGMA_MAX_TOTAL_MEMORY': 'resourceQuotas.memory.maxTotalMemory',
  'TW_ENIGMA_GC_TRIGGER_THRESHOLD': 'resourceQuotas.memory.gcTriggerThreshold',
  'TW_ENIGMA_MEMORY_PRESSURE_THRESHOLD': 'resourceQuotas.memory.memoryPressureThreshold',
  
  // CPU limits
  'TW_ENIGMA_MAX_CPU_USAGE': 'resourceQuotas.cpu.maxCpuUsage',
  'TW_ENIGMA_MAX_CONCURRENT_OPERATIONS': 'resourceQuotas.cpu.maxConcurrentOperations',
  'TW_ENIGMA_MAX_WORKER_THREADS': 'resourceQuotas.cpu.maxWorkerThreads',
  
  // Network limits
  'TW_ENIGMA_MAX_CONNECTIONS': 'resourceQuotas.network.maxConnections',
  'TW_ENIGMA_CONNECTION_TIMEOUT': 'resourceQuotas.network.connectionTimeout',
  'TW_ENIGMA_REQUEST_TIMEOUT': 'resourceQuotas.network.requestTimeout',
  'TW_ENIGMA_MAX_REQUESTS_PER_SECOND': 'resourceQuotas.network.maxRequestsPerSecond',
  
  // Disk limits
  'TW_ENIGMA_MAX_DISK_USAGE': 'resourceQuotas.disk.maxDiskUsage',
  'TW_ENIGMA_MAX_OPEN_FILE_HANDLES': 'resourceQuotas.disk.maxOpenFileHandles',
  
  // Enforcement strategy
  'TW_ENIGMA_ENFORCEMENT_STRATEGY': 'resourceEnforcement.enforcement.strategy',
  'TW_ENIGMA_MAX_QUEUE_SIZE': 'resourceEnforcement.queuing.maxQueueSize',
  'TW_ENIGMA_QUEUE_TIMEOUT': 'resourceEnforcement.queuing.queueTimeout',
  
  // Integration settings
  'TW_ENIGMA_RESOURCE_MANAGEMENT_ENABLED': 'resourceIntegration.enabled',
  'TW_ENIGMA_AUTO_SCALING_ENABLED': 'resourceIntegration.autoScaling.enabled',
  'TW_ENIGMA_MONITORING_ENABLED': 'resourceIntegration.monitoring.enabled',
} as const;

/**
 * Load resource configuration from environment variables
 */
export function loadResourceConfigFromEnv(): Partial<ExtendedResourceConfig> {
  const config: any = {};
  
  for (const [envVar, configPath] of Object.entries(RESOURCE_ENV_MAPPINGS)) {
    const value = process.env[envVar];
    if (value !== undefined) {
      setNestedProperty(config, configPath, parseEnvValue(value));
    }
  }
  
  return config;
}

/**
 * Parse environment variable value to appropriate type
 */
function parseEnvValue(value: string): any {
  // Boolean values
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  // Numeric values
  const numericValue = Number(value);
  if (!isNaN(numericValue)) return numericValue;
  
  // String values
  return value;
}

/**
 * Set nested property in object using dot notation
 */
function setNestedProperty(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * Get default resource configuration for different environments
 */
export function getDefaultResourceConfig(environment: 'development' | 'production' | 'test' = 'development'): ExtendedResourceConfig {
  const baseConfig: ExtendedResourceConfig = {
    resourceQuotas: {
      processing: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxProcessingTime: 300000, // 5 minutes
        maxConcurrentFiles: 100,
        maxFilesPerBatch: 1000,
        maxTotalFiles: 100000,
        enableTimeoutChecks: true,
        enableSizeValidation: true,
      },
      memory: {
        maxHeapUsage: 2048, // 2GB
        maxTotalMemory: 4096, // 4GB
        gcTriggerThreshold: 0.8,
        memoryPressureThreshold: 0.9,
        enableAutomaticGC: true,
        enableMemoryReclamation: true,
        memoryCheckInterval: 5000,
      },
      cpu: {
        maxCpuUsage: 0.8,
        maxConcurrentOperations: 10,
        maxWorkerThreads: 8,
        cpuThrottleThreshold: 0.9,
        enableCpuThrottling: true,
      },
      network: {
        maxConnections: 50,
        connectionTimeout: 30000,
        requestTimeout: 60000,
        maxRequestsPerSecond: 100,
        maxBandwidthMBps: 100,
        enableRateLimiting: true,
      },
      disk: {
        maxDiskUsage: 10000, // 10GB
        maxOpenFileHandles: 1000,
        maxReadOperationsPerSecond: 1000,
        maxWriteOperationsPerSecond: 500,
        enableDiskQuotas: true,
      },
      enforcement: {
        enableHardLimits: true,
        enableSoftLimits: true,
        gracefulDegradation: true,
        emergencyShutdown: true,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
      },
      monitoring: {
        enableRealTimeMonitoring: true,
        monitoringInterval: 1000,
        enableAlerting: true,
        alertCooldownMs: 60000,
        enableMetricsCollection: true,
        retentionPeriodHours: 24,
      },
    },
    resourceEnforcement: {
      enforcement: {
        strategy: 'throttle',
        enablePreemption: true,
        enableAdaptiveScaling: true,
        enablePriorityQueuing: true,
      },
      queuing: {
        maxQueueSize: 1000,
        queueTimeout: 300000,
        enablePriorityQueues: true,
        enableQueueMetrics: true,
      },
      throttling: {
        enableDynamicThrottling: true,
        throttleBackoffMs: 1000,
        maxThrottleBackoffMs: 30000,
        throttleRecoveryFactor: 0.5,
      },
      adaptive: {
        enableAutoScaling: true,
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        scaleUpFactor: 1.5,
        scaleDownFactor: 0.8,
        cooldownPeriodMs: 30000,
      },
    },
    resourceIntegration: {
      enabled: true,
      autoScaling: {
        enabled: true,
        scaleUpFactor: 1.5,
        scaleDownFactor: 0.8,
        cooldownPeriodMs: 30000,
      },
      monitoring: {
        enabled: true,
        alertingEnabled: true,
        metricsRetentionHours: 24,
        realTimeUpdates: true,
      },
      optimization: {
        enableAdaptiveLimits: true,
        enablePredictiveScaling: false,
        enableLoadBalancing: true,
      },
      integration: {
        enableMetricsCollectorIntegration: true,
        enablePerformanceMonitorIntegration: true,
        enableMemoryMonitorIntegration: true,
        enableFileProcessorIntegration: true,
      },
    },
  };

  // Environment-specific adjustments
  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        resourceQuotas: {
          ...baseConfig.resourceQuotas!,
          processing: {
            ...baseConfig.resourceQuotas!.processing,
            maxConcurrentFiles: 200,
            maxFilesPerBatch: 2000,
            maxTotalFiles: 1000000,
          },
          memory: {
            ...baseConfig.resourceQuotas!.memory,
            maxHeapUsage: 4096, // 4GB
            maxTotalMemory: 8192, // 8GB
          },
          cpu: {
            ...baseConfig.resourceQuotas!.cpu,
            maxConcurrentOperations: 20,
            maxWorkerThreads: 16,
          },
          enforcement: {
            ...baseConfig.resourceQuotas!.enforcement,
            emergencyShutdown: true,
            enableHardLimits: true,
          },
        },
        resourceEnforcement: {
          ...baseConfig.resourceEnforcement!,
          enforcement: {
            ...baseConfig.resourceEnforcement!.enforcement,
            strategy: 'queue', // More robust for production
          },
          queuing: {
            ...baseConfig.resourceEnforcement!.queuing,
            maxQueueSize: 5000,
            queueTimeout: 600000, // 10 minutes
          },
        },
      };

    case 'test':
      return {
        ...baseConfig,
        resourceQuotas: {
          ...baseConfig.resourceQuotas!,
          processing: {
            ...baseConfig.resourceQuotas!.processing,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxProcessingTime: 60000, // 1 minute
            maxConcurrentFiles: 10,
            maxFilesPerBatch: 100,
            maxTotalFiles: 1000,
          },
          memory: {
            ...baseConfig.resourceQuotas!.memory,
            maxHeapUsage: 512, // 512MB
            maxTotalMemory: 1024, // 1GB
          },
          cpu: {
            ...baseConfig.resourceQuotas!.cpu,
            maxConcurrentOperations: 2,
            maxWorkerThreads: 2,
          },
          monitoring: {
            ...baseConfig.resourceQuotas!.monitoring,
            enableRealTimeMonitoring: false,
            monitoringInterval: 5000,
            enableAlerting: false,
          },
        },
        resourceEnforcement: {
          ...baseConfig.resourceEnforcement!,
          enforcement: {
            ...baseConfig.resourceEnforcement!.enforcement,
            strategy: 'fail_fast', // Fail fast in tests
          },
          queuing: {
            ...baseConfig.resourceEnforcement!.queuing,
            maxQueueSize: 10,
            queueTimeout: 10000, // 10 seconds
          },
        },
        resourceIntegration: {
          ...baseConfig.resourceIntegration,
          monitoring: {
            ...baseConfig.resourceIntegration.monitoring,
            alertingEnabled: false,
            realTimeUpdates: false,
          },
        },
      };

    default: // development
      return baseConfig;
  }
}

/**
 * Merge resource configuration with environment variables
 */
export function mergeResourceConfigWithEnv(config: Partial<ExtendedResourceConfig>): ExtendedResourceConfig {
  const envConfig = loadResourceConfigFromEnv();
  const defaultConfig = getDefaultResourceConfig();
  
  // Deep merge: defaults <- config <- env vars
  return deepMergeResourceConfig(defaultConfig, config, envConfig);
}

/**
 * Deep merge resource configuration objects
 */
function deepMergeResourceConfig(...configs: Array<Partial<ExtendedResourceConfig>>): ExtendedResourceConfig {
  const result: any = {};
  
  for (const config of configs) {
    if (!config) continue;
    
    for (const [key, value] of Object.entries(config)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = deepMergeResourceConfig(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
  }
  
  return ExtendedResourceConfigSchema.parse(result);
}

/**
 * Validate resource configuration
 */
export function validateResourceConfig(config: unknown): ExtendedResourceConfig {
  return ExtendedResourceConfigSchema.parse(config);
}

/**
 * Export configuration schemas for external use
 */
export {
  ResourceQuotaConfigSchema,
  ResourceEnforcementConfigSchema,
  type ResourceQuotaConfig,
  type ResourceEnforcementConfig,
};