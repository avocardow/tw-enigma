/**
 * External Monitoring and Error Reporting Integrations
 *
 * Provides integrations with popular monitoring and error reporting services
 * including Sentry, Datadog, webhooks, and custom monitoring solutions.
 */

import { LogLevel } from '../utils/logger';
import { CircuitBreaker } from './circuitBreaker';

// Core interfaces for monitoring configurations
export interface MonitoringConfig {
  enabled: boolean;
  serviceName: string;
  environment: string;
  version: string;
  tags?: Record<string, string>;
  batchSize?: number;
  flushInterval?: number;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
    maxBackoffMs: number;
  };
}

export interface SentryConfig extends MonitoringConfig {
  dsn: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  beforeSend?: (event: any) => any;
  beforeSendTransaction?: (transaction: any) => any;
  integrations?: any[];
  release?: string;
  dist?: string;
}

export interface DatadogConfig extends MonitoringConfig {
  apiKey: string;
  appKey?: string;
  site?: string; // datadoghq.com, datadoghq.eu, etc.
  service: string;
  hostname?: string;
  metricsConfig?: {
    prefix?: string;
    globalTags?: string[];
    bufferSize?: number;
  };
  loggingConfig?: {
    hostname?: string;
    logLevel?: LogLevel;
    source?: string;
  };
  tracingConfig?: {
    enabled?: boolean;
    sampleRate?: number;
    runtimeMetrics?: boolean;
  };
}

export interface WebhookConfig extends MonitoringConfig {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  secret?: string; // For HMAC signing
  template?: 'slack' | 'discord' | 'teams' | 'custom';
  customPayload?: (event: ErrorEvent | MetricEvent) => any;
}

// Event interfaces for monitoring data
export interface ErrorEvent {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'fatal';
  message: string;
  stack?: string;
  tags: Record<string, string>;
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    data?: any;
  };
  extra?: Record<string, any>;
  fingerprint?: string[];
  environment: string;
  release?: string;
  contexts?: Record<string, any>;
}

export interface MetricEvent {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  timestamp: Date;
  tags: Record<string, string>;
  unit?: string;
  description?: string;
}

// Health check interface for monitoring integrations
export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastSuccess?: Date;
  lastFailure?: Date;
  consecutiveFailures: number;
  responseTime?: number;
  details?: Record<string, any>;
}

/**
 * Sentry Integration for Error Reporting and Performance Monitoring
 */
export class SentryIntegration {
  private config: SentryConfig;
  private sentry: any;
  private isInitialized = false;
  private circuitBreaker: CircuitBreaker;
  private eventQueue: ErrorEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: SentryConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 30000,
      resetTimeout: 60000,
      monitoringInterval: 10000,
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled || this.isInitialized) return;

    try {
      // Lazy load Sentry SDK
      this.sentry = await import('@sentry/node');

      this.sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release || this.config.version,
        dist: this.config.dist,
        tracesSampleRate: this.config.tracesSampleRate || 0.1,
        profilesSampleRate: this.config.profilesSampleRate || 0.1,
        beforeSend: this.config.beforeSend,
        beforeSendTransaction: this.config.beforeSendTransaction,
        integrations: this.config.integrations || [],
      });

      // Configure global tags
      this.sentry.configureScope((scope: any) => {
        scope.setTag('service', this.config.serviceName);
        if (this.config.tags) {
          Object.entries(this.config.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }
      });

      this.isInitialized = true;
      this.startBatchProcessor();
    } catch (error) {
      console.error('Failed to initialize Sentry integration:', error);
      throw error;
    }
  }

  async reportError(event: ErrorEvent): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) return;

    if (this.config.batchSize && this.config.batchSize > 1) {
      this.eventQueue.push(event);
      if (this.eventQueue.length >= this.config.batchSize) {
        await this.flushEvents();
      }
      return;
    }

    await this.sendEvent(event);
  }

  async reportMetric(metric: MetricEvent): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) return;

    try {
      await this.circuitBreaker.execute(async () => {
        this.sentry.addBreadcrumb({
          message: `Metric: ${metric.name}`,
          level: 'info',
          data: {
            value: metric.value,
            type: metric.type,
            unit: metric.unit,
            tags: metric.tags,
          },
        });
      });
    } catch (error) {
      console.error('Failed to report metric to Sentry:', error);
    }
  }

  private async sendEvent(event: ErrorEvent): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        this.sentry.withScope((scope: any) => {
          // Set context
          scope.setLevel(event.level);
          scope.setFingerprint(event.fingerprint || [event.message]);

          // Set tags
          Object.entries(event.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });

          // Set user context
          if (event.user) {
            scope.setUser(event.user);
          }

          // Set request context
          if (event.request) {
            scope.setContext('request', event.request);
          }

          // Set extra data
          if (event.extra) {
            Object.entries(event.extra).forEach(([key, value]) => {
              scope.setExtra(key, value);
            });
          }

          // Set custom contexts
          if (event.contexts) {
            Object.entries(event.contexts).forEach(([key, value]) => {
              scope.setContext(key, value);
            });
          }

          // Capture the error
          if (event.stack) {
            const error = new Error(event.message);
            error.stack = event.stack;
            this.sentry.captureException(error);
          } else {
            this.sentry.captureMessage(event.message, event.level);
          }
        });
      });
    } catch (error) {
      console.error('Failed to send event to Sentry:', error);
    }
  }

  private startBatchProcessor(): void {
    if (this.config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flushEvents();
      }, this.config.flushInterval);
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0);

    try {
      await Promise.all(events.map((event) => this.sendEvent(event)));
    } catch (error) {
      console.error('Failed to flush events to Sentry:', error);
      // Re-queue failed events
      this.eventQueue.unshift(...events);
    }
  }

  async getHealthStatus(): Promise<HealthCheck> {
    return {
      status: this.circuitBreaker.getState() === 'CLOSED' ? 'healthy' : 'degraded',
      consecutiveFailures: this.circuitBreaker.getFailureCount(),
      details: {
        initialized: this.isInitialized,
        queueSize: this.eventQueue.length,
        circuitBreakerState: this.circuitBreaker.getState(),
      },
    };
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushEvents();
    if (this.sentry) {
      await this.sentry.close(2000);
    }
  }
}

/**
 * Datadog Integration for Metrics, Logging, and APM
 */
export class DatadogIntegration {
  private config: DatadogConfig;
  private dogstatsd: any;
  private tracer: any;
  private isInitialized = false;
  private circuitBreaker: CircuitBreaker;
  private metricQueue: MetricEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: DatadogConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 30000,
      resetTimeout: 60000,
      monitoringInterval: 10000,
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled || this.isInitialized) return;

    try {
      // Initialize DogStatsD client for metrics
      const { StatsD } = await import('hot-shots');
      this.dogstatsd = new StatsD({
        host: 'localhost',
        port: 8125,
        prefix: this.config.metricsConfig?.prefix || `${this.config.serviceName}.`,
        globalTags: this.config.metricsConfig?.globalTags || [],
        bufferSize: this.config.metricsConfig?.bufferSize || 1000,
      });

      // Initialize APM tracer if enabled
      if (this.config.tracingConfig?.enabled) {
        this.tracer = await import('dd-trace');
        this.tracer.init({
          service: this.config.service,
          env: this.config.environment,
          version: this.config.version,
          hostname: this.config.hostname,
          sampleRate: this.config.tracingConfig.sampleRate || 0.1,
          runtimeMetrics: this.config.tracingConfig.runtimeMetrics || true,
        });
      }

      this.isInitialized = true;
      this.startBatchProcessor();
    } catch (error) {
      console.error('Failed to initialize Datadog integration:', error);
      throw error;
    }
  }

  async reportError(event: ErrorEvent): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) return;

    try {
      await this.circuitBreaker.execute(async () => {
        // Increment error counter
        this.dogstatsd.increment('errors.count', 1, {
          level: event.level,
          environment: event.environment,
          ...event.tags,
        });

        // If tracing is enabled, add error to current span
        if (this.tracer && this.tracer.scope().active()) {
          const span = this.tracer.scope().active();
          span.setTag('error', true);
          span.setTag('error.message', event.message);
          span.setTag('error.type', event.level);
          if (event.stack) {
            span.setTag('error.stack', event.stack);
          }
        }
      });
    } catch (error) {
      console.error('Failed to report error to Datadog:', error);
    }
  }

  async reportMetric(metric: MetricEvent): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) return;

    if (this.config.batchSize && this.config.batchSize > 1) {
      this.metricQueue.push(metric);
      if (this.metricQueue.length >= this.config.batchSize) {
        await this.flushMetrics();
      }
      return;
    }

    await this.sendMetric(metric);
  }

  private async sendMetric(metric: MetricEvent): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        const tags = Object.entries(metric.tags).map(([key, value]) => `${key}:${value}`);

        switch (metric.type) {
          case 'counter':
            this.dogstatsd.increment(metric.name, metric.value, tags);
            break;
          case 'gauge':
            this.dogstatsd.gauge(metric.name, metric.value, tags);
            break;
          case 'histogram':
            this.dogstatsd.histogram(metric.name, metric.value, tags);
            break;
          case 'timer':
            this.dogstatsd.timing(metric.name, metric.value, tags);
            break;
        }
      });
    } catch (error) {
      console.error('Failed to send metric to Datadog:', error);
    }
  }

  private startBatchProcessor(): void {
    if (this.config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flushMetrics();
      }, this.config.flushInterval);
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricQueue.length === 0) return;

    const metrics = this.metricQueue.splice(0);

    try {
      await Promise.all(metrics.map((metric) => this.sendMetric(metric)));
    } catch (error) {
      console.error('Failed to flush metrics to Datadog:', error);
      // Re-queue failed metrics
      this.metricQueue.unshift(...metrics);
    }
  }

  async getHealthStatus(): Promise<HealthCheck> {
    return {
      status: this.circuitBreaker.getState() === 'CLOSED' ? 'healthy' : 'degraded',
      consecutiveFailures: this.circuitBreaker.getFailureCount(),
      details: {
        initialized: this.isInitialized,
        queueSize: this.metricQueue.length,
        circuitBreakerState: this.circuitBreaker.getState(),
        tracingEnabled: !!this.tracer,
      },
    };
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushMetrics();
    if (this.dogstatsd) {
      this.dogstatsd.close();
    }
  }
}

/**
 * Webhook Integration for Custom Monitoring and Notifications
 */
export class WebhookIntegration {
  private config: WebhookConfig;
  private circuitBreaker: CircuitBreaker;
  private eventQueue: (ErrorEvent | MetricEvent)[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: WebhookConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: this.config.timeout || 10000,
      resetTimeout: 30000,
      monitoringInterval: 10000,
    });
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) return;
    this.startBatchProcessor();
  }

  async reportError(event: ErrorEvent): Promise<void> {
    if (!this.config.enabled) return;
    await this.sendEvent(event, 'error');
  }

  async reportMetric(metric: MetricEvent): Promise<void> {
    if (!this.config.enabled) return;
    await this.sendEvent(metric, 'metric');
  }

  private async sendEvent(
    event: ErrorEvent | MetricEvent,
    type: 'error' | 'metric'
  ): Promise<void> {
    if (this.config.batchSize && this.config.batchSize > 1) {
      this.eventQueue.push(event);
      if (this.eventQueue.length >= this.config.batchSize) {
        await this.flushEvents();
      }
      return;
    }

    await this.sendWebhook(event, type);
  }

  private async sendWebhook(
    event: ErrorEvent | MetricEvent,
    type: 'error' | 'metric'
  ): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        let payload: any;

        if (this.config.customPayload) {
          payload = this.config.customPayload(event);
        } else {
          payload = this.createPayload(event, type);
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': `TW-Enigma/${this.config.version}`,
          ...this.config.headers,
        };

        // Add HMAC signature if secret is provided
        if (this.config.secret) {
          const crypto = await import('crypto');
          const signature = crypto
            .createHmac('sha256', this.config.secret)
            .update(JSON.stringify(payload))
            .digest('hex');
          headers['X-Hub-Signature-256'] = `sha256=${signature}`;
        }

        const response = await fetch(this.config.url, {
          method: this.config.method || 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout || 10000),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`);
        }
      });
    } catch (error) {
      console.error('Failed to send webhook:', error);
      throw error;
    }
  }

  private createPayload(event: ErrorEvent | MetricEvent, type: 'error' | 'metric'): any {
    const basePayload = {
      service: this.config.serviceName,
      environment: this.config.environment,
      version: this.config.version,
      timestamp: new Date().toISOString(),
      type,
    };

    switch (this.config.template) {
      case 'slack':
        return this.createSlackPayload(event, type, basePayload);
      case 'discord':
        return this.createDiscordPayload(event, type, basePayload);
      case 'teams':
        return this.createTeamsPayload(event, type, basePayload);
      default:
        return { ...basePayload, event };
    }
  }

  private createSlackPayload(
    event: ErrorEvent | MetricEvent,
    type: 'error' | 'metric',
    base: any
  ): any {
    if (type === 'error') {
      const errorEvent = event as ErrorEvent;
      return {
        text: `🚨 Error in ${base.service}`,
        attachments: [
          {
            color: errorEvent.level === 'fatal' ? 'danger' : 'warning',
            fields: [
              { title: 'Message', value: errorEvent.message, short: false },
              { title: 'Level', value: errorEvent.level, short: true },
              { title: 'Environment', value: base.environment, short: true },
              { title: 'Timestamp', value: base.timestamp, short: true },
            ],
          },
        ],
      };
    } else {
      const metricEvent = event as MetricEvent;
      return {
        text: `📊 Metric Update: ${metricEvent.name}`,
        attachments: [
          {
            color: 'good',
            fields: [
              { title: 'Metric', value: metricEvent.name, short: true },
              { title: 'Value', value: metricEvent.value.toString(), short: true },
              { title: 'Type', value: metricEvent.type, short: true },
              { title: 'Unit', value: metricEvent.unit || 'count', short: true },
            ],
          },
        ],
      };
    }
  }

  private createDiscordPayload(
    event: ErrorEvent | MetricEvent,
    type: 'error' | 'metric',
    base: any
  ): any {
    if (type === 'error') {
      const errorEvent = event as ErrorEvent;
      return {
        embeds: [
          {
            title: `🚨 Error in ${base.service}`,
            description: errorEvent.message,
            color: errorEvent.level === 'fatal' ? 0xff0000 : 0xffa500,
            fields: [
              { name: 'Level', value: errorEvent.level, inline: true },
              { name: 'Environment', value: base.environment, inline: true },
              { name: 'Timestamp', value: base.timestamp, inline: false },
            ],
            timestamp: base.timestamp,
          },
        ],
      };
    } else {
      const metricEvent = event as MetricEvent;
      return {
        embeds: [
          {
            title: `📊 Metric: ${metricEvent.name}`,
            color: 0x00ff00,
            fields: [
              { name: 'Value', value: metricEvent.value.toString(), inline: true },
              { name: 'Type', value: metricEvent.type, inline: true },
              { name: 'Unit', value: metricEvent.unit || 'count', inline: true },
            ],
            timestamp: base.timestamp,
          },
        ],
      };
    }
  }

  private createTeamsPayload(
    event: ErrorEvent | MetricEvent,
    type: 'error' | 'metric',
    base: any
  ): any {
    if (type === 'error') {
      const errorEvent = event as ErrorEvent;
      return {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: `Error in ${base.service}`,
        themeColor: errorEvent.level === 'fatal' ? 'FF0000' : 'FFA500',
        sections: [
          {
            activityTitle: `🚨 Error in ${base.service}`,
            activitySubtitle: errorEvent.message,
            facts: [
              { name: 'Level', value: errorEvent.level },
              { name: 'Environment', value: base.environment },
              { name: 'Timestamp', value: base.timestamp },
            ],
          },
        ],
      };
    } else {
      const metricEvent = event as MetricEvent;
      return {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: `Metric Update: ${metricEvent.name}`,
        themeColor: '00FF00',
        sections: [
          {
            activityTitle: `📊 Metric: ${metricEvent.name}`,
            facts: [
              { name: 'Value', value: metricEvent.value.toString() },
              { name: 'Type', value: metricEvent.type },
              { name: 'Unit', value: metricEvent.unit || 'count' },
            ],
          },
        ],
      };
    }
  }

  private startBatchProcessor(): void {
    if (this.config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flushEvents();
      }, this.config.flushInterval);
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0);

    try {
      await Promise.all(
        events.map((event) => {
          const type = 'level' in event ? 'error' : 'metric';
          return this.sendWebhook(event, type);
        })
      );
    } catch (error) {
      console.error('Failed to flush events via webhook:', error);
      // Re-queue failed events
      this.eventQueue.unshift(...events);
    }
  }

  async getHealthStatus(): Promise<HealthCheck> {
    return {
      status: this.circuitBreaker.getState() === 'CLOSED' ? 'healthy' : 'degraded',
      consecutiveFailures: this.circuitBreaker.getFailureCount(),
      details: {
        queueSize: this.eventQueue.length,
        circuitBreakerState: this.circuitBreaker.getState(),
        webhook: {
          url: this.config.url,
          method: this.config.method || 'POST',
          template: this.config.template || 'custom',
        },
      },
    };
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushEvents();
  }
}

/**
 * Monitoring Manager - Coordinates all monitoring integrations
 */
export class MonitoringManager {
  private integrations: Map<string, SentryIntegration | DatadogIntegration | WebhookIntegration> =
    new Map();
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {}

  addSentryIntegration(name: string, config: SentryConfig): void {
    this.integrations.set(name, new SentryIntegration(config));
  }

  addDatadogIntegration(name: string, config: DatadogConfig): void {
    this.integrations.set(name, new DatadogIntegration(config));
  }

  addWebhookIntegration(name: string, config: WebhookConfig): void {
    this.integrations.set(name, new WebhookIntegration(config));
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const initPromises = Array.from(this.integrations.values()).map((integration) =>
      integration.initialize().catch((error) => {
        console.error(`Failed to initialize monitoring integration:`, error);
      })
    );

    await Promise.allSettled(initPromises);
    this.isInitialized = true;
    this.startHealthChecks();
  }

  async reportError(event: ErrorEvent): Promise<void> {
    if (!this.isInitialized) return;

    const reportPromises = Array.from(this.integrations.values()).map((integration) =>
      integration.reportError(event).catch((error) => {
        console.error('Failed to report error to integration:', error);
      })
    );

    await Promise.allSettled(reportPromises);
  }

  async reportMetric(metric: MetricEvent): Promise<void> {
    if (!this.isInitialized) return;

    const reportPromises = Array.from(this.integrations.values()).map((integration) =>
      integration.reportMetric(metric).catch((error) => {
        console.error('Failed to report metric to integration:', error);
      })
    );

    await Promise.allSettled(reportPromises);
  }

  async getHealthStatus(): Promise<Record<string, HealthCheck>> {
    const healthChecks: Record<string, HealthCheck> = {};

    for (const [name, integration] of this.integrations) {
      try {
        healthChecks[name] = await integration.getHealthStatus();
      } catch (error) {
        healthChecks[name] = {
          status: 'unhealthy',
          consecutiveFailures: 999,
          details: { error: error instanceof Error ? error.message : String(error) },
        };
      }
    }

    return healthChecks;
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const healthStatus = await this.getHealthStatus();
      const unhealthyIntegrations = Object.entries(healthStatus)
        .filter(([_, health]) => health.status === 'unhealthy')
        .map(([name]) => name);

      if (unhealthyIntegrations.length > 0) {
        console.warn(`Unhealthy monitoring integrations: ${unhealthyIntegrations.join(', ')}`);
      }
    }, 30000); // Check every 30 seconds
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const shutdownPromises = Array.from(this.integrations.values()).map((integration) =>
      integration.shutdown().catch((error) => {
        console.error('Failed to shutdown monitoring integration:', error);
      })
    );

    await Promise.allSettled(shutdownPromises);
    this.isInitialized = false;
  }
}

// Default configuration factory functions
export function createDefaultSentryConfig(dsn: string, environment: string): SentryConfig {
  return {
    enabled: true,
    dsn,
    serviceName: 'tw-enigma',
    environment,
    version: process.env.npm_package_version || '1.0.0',
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    tags: {
      component: 'core',
    },
    batchSize: 10,
    flushInterval: 5000,
    retryConfig: {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 10000,
    },
  };
}

export function createDefaultDatadogConfig(apiKey: string, environment: string): DatadogConfig {
  return {
    enabled: true,
    apiKey,
    serviceName: 'tw-enigma',
    service: 'tw-enigma',
    environment,
    version: process.env.npm_package_version || '1.0.0',
    metricsConfig: {
      prefix: 'twenigma.',
      globalTags: [`env:${environment}`, 'service:tw-enigma'],
      bufferSize: 1000,
    },
    loggingConfig: {
      logLevel: LogLevel.INFO,
      source: 'nodejs',
    },
    tracingConfig: {
      enabled: true,
      sampleRate: environment === 'production' ? 0.1 : 1.0,
      runtimeMetrics: true,
    },
    tags: {
      component: 'core',
    },
    batchSize: 50,
    flushInterval: 10000,
    retryConfig: {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 10000,
    },
  };
}

export function createDefaultWebhookConfig(
  url: string,
  environment: string,
  template?: 'slack' | 'discord' | 'teams'
): WebhookConfig {
  return {
    enabled: true,
    url,
    serviceName: 'tw-enigma',
    environment,
    version: process.env.npm_package_version || '1.0.0',
    method: 'POST',
    timeout: 10000,
    template: template || 'custom',
    tags: {
      component: 'core',
    },
    batchSize: 5,
    flushInterval: 5000,
    retryConfig: {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 10000,
    },
  };
}

// Export all classes and functions
export { DatadogIntegration, MonitoringManager, SentryIntegration, WebhookIntegration };
