/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { MetricsCollector, MetricType } from './collector.js';
import { MetricsConfigManager } from './config.js';

/**
 * Metric event interface for integration
 */
export interface MetricEvent {
  id: string;
  metric: {
    name: string;
    type: MetricType;
    value: number | string;
    unit?: string;
  };
  timestamp: Date;
  source?: string;
  tags?: Record<string, string>;
}

/**
 * Integration configuration schema
 */
export const MetricsIntegrationConfigSchema = z.object({
  // System integrations
  integrations: z
    .object({
      logging: z
        .object({
          enabled: z.boolean().default(true),
          logLevel: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
          includeMetrics: z.boolean().default(true),
          structuredLogging: z.boolean().default(true),
        })
        .default({}),

      monitoring: z
        .object({
          enabled: z.boolean().default(true),
          prometheus: z
            .object({
              enabled: z.boolean().default(true),
              endpoint: z.string().default('/metrics'),
              prefix: z.string().default('tw_enigma_'),
              labels: z.record(z.string()).default({}),
            })
            .default({}),

          dashboard: z
            .object({
              enabled: z.boolean().default(true),
              updateInterval: z.number().min(1000).max(60000).default(5000),
              retainHistory: z.number().min(100).max(10000).default(1000),
              realTimeUpdates: z.boolean().default(true),
            })
            .default({}),
        })
        .default({}),

      alerting: z
        .object({
          enabled: z.boolean().default(true),
          channels: z.array(z.enum(['console', 'webhook', 'email', 'slack'])).default(['console']),
          thresholds: z
            .object({
              performance: z
                .object({
                  latencyMs: z.number().default(5000),
                  throughput: z.number().default(10),
                  memoryMB: z.number().default(1000),
                  cpuPercent: z.number().default(80),
                })
                .default({}),
              quality: z
                .object({
                  accuracy: z.number().min(0).max(1).default(0.95),
                  errorRate: z.number().min(0).max(1).default(0.05),
                  coverage: z.number().min(0).max(1).default(0.8),
                })
                .default({}),
            })
            .default({}),
        })
        .default({}),

      subsystems: z
        .object({
          multiPassDiscovery: z
            .object({
              enabled: z.boolean().default(true),
              enhancedMetrics: z.boolean().default(true),
              passMetricsCollection: z.boolean().default(true),
              convergenceTracking: z.boolean().default(true),
            })
            .default({}),

          patternHierarchy: z
            .object({
              enabled: z.boolean().default(true),
              hierarchyAnalysis: z.boolean().default(true),
              relationshipTracking: z.boolean().default(true),
              conflictDetection: z.boolean().default(true),
            })
            .default({}),

          optimization: z
            .object({
              enabled: z.boolean().default(true),
              passTracking: z.boolean().default(true),
              consolidationMetrics: z.boolean().default(true),
              performanceTracking: z.boolean().default(true),
            })
            .default({}),
        })
        .default({}),
    })
    .default({}),

  // Data flow configuration
  dataFlow: z
    .object({
      bufferSize: z.number().min(100).max(10000).default(1000),
      flushInterval: z.number().min(1000).max(60000).default(5000),
      batchSize: z.number().min(10).max(1000).default(100),
      enableAsync: z.boolean().default(true),
      retryPolicy: z
        .object({
          maxRetries: z.number().min(0).max(10).default(3),
          backoffMs: z.number().min(100).max(10000).default(1000),
          exponentialBackoff: z.boolean().default(true),
        })
        .default({}),
    })
    .default({}),

  // Error handling
  errorHandling: z
    .object({
      continueOnError: z.boolean().default(true),
      logErrors: z.boolean().default(true),
      enableFallback: z.boolean().default(true),
      maxErrorRate: z.number().min(0).max(1).default(0.1),
    })
    .default({}),
});

export type MetricsIntegrationConfig = z.infer<typeof MetricsIntegrationConfigSchema>;

/**
 * Integration point interface
 */
export interface IntegrationPoint {
  name: string;
  type: 'logging' | 'monitoring' | 'alerting' | 'subsystem';
  enabled: boolean;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  send(data: any): Promise<boolean>;
  health(): Promise<{ status: 'healthy' | 'degraded' | 'down'; details?: any }>;
}

/**
 * Subsystem integration result
 */
export interface SubsystemIntegrationResult {
  connected: string[];
  failed: Array<{ name: string; error: string }>;
  metrics: {
    totalIntegrations: number;
    activeConnections: number;
    failedConnections: number;
    averageResponseTime: number;
  };
}

/**
 * Alert notification interface
 */
export interface AlertNotification {
  id: string;
  type: 'performance' | 'quality' | 'system' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metric: {
    name: string;
    value: number;
    threshold: number;
    unit?: string;
  };
  timestamp: Date;
  source: string;
  tags: Record<string, string>;
  resolved: boolean;
}

/**
 * Metrics event for integration
 */
export interface IntegrationMetricEvent extends MetricEvent {
  integration: {
    source: string;
    destination: string[];
    success: boolean;
    latency: number;
  };
}

/**
 * Main metrics integration manager
 */
export class MetricsIntegrationManager extends EventEmitter {
  private config: MetricsIntegrationConfig;
  private metricsCollector: MetricsCollector;
  private configManager: MetricsConfigManager;

  // Integration points
  private integrations = new Map<string, IntegrationPoint>();
  private connectionStatus = new Map<string, boolean>();

  // Data flow management
  private eventBuffer: IntegrationMetricEvent[] = [];
  private isRunning = false;
  private flushTimer?: NodeJS.Timeout;
  private retryQueue = new Map<string, IntegrationMetricEvent[]>();

  // Statistics
  private stats = {
    totalEvents: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    retries: 0,
    lastFlush: new Date(),
  };

  constructor(
    metricsCollector: MetricsCollector,
    configManager: MetricsConfigManager,
    config: Partial<MetricsIntegrationConfig> = {}
  ) {
    super();

    this.metricsCollector = metricsCollector;
    this.configManager = configManager;
    this.config = MetricsIntegrationConfigSchema.parse(config);

    this.initializeIntegrations();
    this.setupEventListeners();
  }

  /**
   * Start the integration manager
   */
  async start(): Promise<SubsystemIntegrationResult> {
    if (this.isRunning) {
      return this.getConnectionStatus();
    }

    const startTime = Date.now();
    const connected: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    // Connect all integrations
    for (const [name, integration] of this.integrations) {
      try {
        const success = await integration.connect();
        if (success) {
          connected.push(name);
          this.connectionStatus.set(name, true);
        } else {
          failed.push({ name, error: 'Connection failed' });
          this.connectionStatus.set(name, false);
        }
      } catch (error) {
        failed.push({ name, error: String(error) });
        this.connectionStatus.set(name, false);
      }
    }

    // Start data flow
    this.isRunning = true;
    this.startFlushTimer();

    const endTime = Date.now();

    return {
      connected,
      failed,
      metrics: {
        totalIntegrations: this.integrations.size,
        activeConnections: connected.length,
        failedConnections: failed.length,
        averageResponseTime: endTime - startTime,
      },
    };
  }

  /**
   * Stop the integration manager
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining events
    await this.flushBuffer();

    // Disconnect all integrations
    for (const integration of this.integrations.values()) {
      try {
        await integration.disconnect();
      } catch (error) {
        console.error('Error disconnecting integration:', error);
      }
    }

    this.connectionStatus.clear();
  }

  /**
   * Send metric event to integrations
   */
  async sendMetric(event: MetricEvent): Promise<void> {
    if (!this.isRunning) return;

    const integrationEvent: IntegrationMetricEvent = {
      ...event,
      integration: {
        source: 'metrics-collector',
        destination: Array.from(this.integrations.keys()),
        success: false,
        latency: 0,
      },
    };

    this.eventBuffer.push(integrationEvent);
    this.stats.totalEvents++;

    // Flush immediately if buffer is full
    if (this.eventBuffer.length >= this.config.dataFlow.bufferSize) {
      await this.flushBuffer();
    }
  }

  /**
   * Get integration health status
   */
  async getHealthStatus(): Promise<Record<string, any>> {
    const health: Record<string, any> = {};

    for (const [name, integration] of this.integrations) {
      try {
        health[name] = await integration.health();
      } catch (error) {
        health[name] = {
          status: 'down',
          error: String(error),
        };
      }
    }

    return health;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): SubsystemIntegrationResult {
    const connected: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const [name, status] of this.connectionStatus) {
      if (status) {
        connected.push(name);
      } else {
        failed.push({ name, error: 'Not connected' });
      }
    }

    return {
      connected,
      failed,
      metrics: {
        totalIntegrations: this.integrations.size,
        activeConnections: connected.length,
        failedConnections: failed.length,
        averageResponseTime: 0,
      },
    };
  }

  /**
   * Get integration statistics
   */
  getStatistics(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Initialize integrations based on configuration
   */
  private initializeIntegrations(): void {
    const { integrations } = this.config;

    // Logging integration
    if (integrations.logging.enabled) {
      this.integrations.set('logging', new MockIntegration('logging', 'logging'));
    }

    // Prometheus integration
    if (integrations.monitoring.prometheus.enabled) {
      this.integrations.set('prometheus', new MockIntegration('prometheus', 'monitoring'));
    }

    // Dashboard integration
    if (integrations.monitoring.dashboard.enabled) {
      this.integrations.set('dashboard', new MockIntegration('dashboard', 'monitoring'));
    }

    // Alerting integration
    if (integrations.alerting.enabled) {
      this.integrations.set('alerting', new MockIntegration('alerting', 'alerting'));
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to metrics collector events
    this.metricsCollector.on('metric', this.handleMetricEvent.bind(this));
    this.metricsCollector.on('error', this.handleError.bind(this));

    // Listen to config changes
    this.configManager.on('configChanged', this.handleConfigChange.bind(this));
  }

  /**
   * Handle metric events
   */
  private async handleMetricEvent(event: MetricEvent): Promise<void> {
    await this.sendMetric(event);
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.emit('error', {
      type: 'integration_error',
      message: error.message,
      timestamp: new Date(),
    });
  }

  /**
   * Handle configuration changes
   */
  private handleConfigChange(event: any): void {
    // Reconfigure integrations if needed
    this.emit('configChange', event);
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flushBuffer(), this.config.dataFlow.flushInterval);
  }

  /**
   * Flush event buffer to integrations
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = this.eventBuffer.splice(0, this.config.dataFlow.batchSize);

    for (const event of events) {
      await this.deliverEvent(event);
    }

    this.stats.lastFlush = new Date();
  }

  /**
   * Deliver event to all active integrations
   */
  private async deliverEvent(event: IntegrationMetricEvent): Promise<void> {
    const startTime = Date.now();
    const destinations: string[] = [];
    let success = true;

    for (const [name, integration] of this.integrations) {
      if (!this.connectionStatus.get(name)) continue;

      try {
        const delivered = await integration.send(event);
        if (delivered) {
          destinations.push(name);
          this.stats.successfulDeliveries++;
        } else {
          success = false;
          this.stats.failedDeliveries++;

          if (this.config.errorHandling.enableFallback) {
            await this.addToRetryQueue(name, event);
          }
        }
      } catch (error) {
        success = false;
        this.stats.failedDeliveries++;
        console.error(`Integration ${name} delivery failed:`, error);

        if (this.config.errorHandling.enableFallback) {
          await this.addToRetryQueue(name, event);
        }
      }
    }

    // Update integration metadata
    event.integration.destination = destinations;
    event.integration.success = success;
    event.integration.latency = Date.now() - startTime;
  }

  /**
   * Add event to retry queue
   */
  private async addToRetryQueue(
    integrationName: string,
    event: IntegrationMetricEvent
  ): Promise<void> {
    if (!this.retryQueue.has(integrationName)) {
      this.retryQueue.set(integrationName, []);
    }

    const queue = this.retryQueue.get(integrationName)!;
    queue.push(event);

    // Limit queue size
    if (queue.length > 1000) {
      queue.shift(); // Remove oldest event
    }
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    for (const [integrationName, events] of this.retryQueue) {
      if (events.length === 0) continue;

      const integration = this.integrations.get(integrationName);
      if (!integration || !this.connectionStatus.get(integrationName)) continue;

      const event = events.shift()!;

      try {
        const success = await integration.send(event);
        if (success) {
          this.stats.successfulDeliveries++;
        } else {
          events.unshift(event); // Put back at front
        }
        this.stats.retries++;
      } catch (error) {
        events.unshift(event); // Put back at front
        console.error(`Retry failed for ${integrationName}:`, error);
      }
    }
  }

  /**
   * Get specific integration
   */
  getIntegration<T extends IntegrationPoint>(name: string): T | undefined {
    return this.integrations.get(name) as T;
  }

  /**
   * Add custom integration
   */
  addIntegration(name: string, integration: IntegrationPoint): void {
    this.integrations.set(name, integration);
  }

  /**
   * Remove integration
   */
  async removeIntegration(name: string): Promise<boolean> {
    const integration = this.integrations.get(name);
    if (!integration) return false;

    try {
      await integration.disconnect();
      this.integrations.delete(name);
      this.connectionStatus.delete(name);
      return true;
    } catch (error) {
      console.error(`Error removing integration ${name}:`, error);
      return false;
    }
  }
}

/**
 * Mock integration for testing
 */
class MockIntegration implements IntegrationPoint {
  public enabled = true;

  constructor(
    public name: string,
    public type: 'logging' | 'monitoring' | 'alerting' | 'subsystem'
  ) {}

  async connect(): Promise<boolean> {
    return this.enabled;
  }

  async disconnect(): Promise<void> {
    // Nothing to do for mock
  }

  async send(_data: any): Promise<boolean> {
    // Simulate successful send
    return true;
  }

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'down'; details?: any }> {
    return { status: 'healthy' };
  }
}

/**
 * Create metrics integration manager
 */
export function createMetricsIntegrationManager(
  metricsCollector: MetricsCollector,
  configManager: MetricsConfigManager,
  config: Partial<MetricsIntegrationConfig> = {}
): MetricsIntegrationManager {
  return new MetricsIntegrationManager(metricsCollector, configManager, config);
}

/**
 * MultiPassDiscovery integration hook
 */
export function createMultiPassDiscoveryIntegration(
  integrationManager: MetricsIntegrationManager
): {
  enhanceMultiPassDiscovery: (multiPassDiscovery: any) => any;
} {
  return {
    enhanceMultiPassDiscovery: (multiPassDiscovery: any) => {
      // Add metrics integration hooks to MultiPassDiscovery
      const originalOptimize = multiPassDiscovery.optimize;

      multiPassDiscovery.optimize = async function (input: any) {
        // Start metrics collection for this optimization run
        await integrationManager.sendMetric({
          id: `optimization_start_${Date.now()}`,
          metric: {
            name: 'optimization_started',
            type: MetricType.COUNTER,
            value: 1,
            unit: 'count',
          },
          timestamp: new Date(),
          source: 'multipass_discovery',
          tags: {
            category: 'optimization',
            phase: 'start',
          },
        });

        try {
          const result = await originalOptimize.call(this, input);

          // Send completion metrics
          await integrationManager.sendMetric({
            id: `optimization_complete_${Date.now()}`,
            metric: {
              name: 'optimization_completed',
              type: MetricType.COUNTER,
              value: 1,
              unit: 'count',
            },
            timestamp: new Date(),
            source: 'multipass_discovery',
            tags: {
              category: 'optimization',
              phase: 'complete',
              passes: result.totalPassesExecuted?.toString() || '0',
              converged: result.convergence?.hasConverged?.toString() || 'false',
            },
          });

          return result;
        } catch (error) {
          // Send error metrics
          await integrationManager.sendMetric({
            id: `optimization_error_${Date.now()}`,
            metric: {
              name: 'optimization_error',
              type: MetricType.ERROR,
              value: 1,
              unit: 'count',
            },
            timestamp: new Date(),
            source: 'multipass_discovery',
            tags: {
              category: 'optimization',
              phase: 'error',
              error: (error as Error).name,
            },
          });

          throw error;
        }
      };

      return multiPassDiscovery;
    },
  };
}
