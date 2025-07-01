/**
 * External Crash Reporting and Monitoring Integration
 * 
 * This module provides comprehensive integration with external monitoring
 * and crash reporting platforms such as Sentry, Datadog, LogRocket, etc.
 * Features include:
 * - Configurable adapters for multiple platforms
 * - Automatic error payload transformation
 * - Network failure handling with retry logic
 * - Rate limiting and throttling
 * - Context enrichment and filtering
 */

import { EventEmitter } from 'events';
import { ErrorCategory, ErrorSeverity } from './types';
import { createLogger, Logger } from '../utils/logger';

export interface ExternalReportingConfig {
  /** Enable external reporting */
  enabled: boolean;
  /** Environment (development/staging/production) */
  environment: 'development' | 'staging' | 'production';
  /** Application release version */
  release?: string;
  /** Maximum number of reports per minute */
  rateLimitPerMinute: number;
  /** Enable sampling (percentage of errors to report) */
  sampleRate: number;
  /** Include source maps in reports */
  includeSourceMaps: boolean;
  /** Include user context */
  includeUserContext: boolean;
  /** Include device/system context */
  includeSystemContext: boolean;
  /** Network retry configuration */
  retryConfig: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  /** Enable offline queue */
  enableOfflineQueue: boolean;
  /** Maximum queue size */
  maxQueueSize: number;
}

export interface ReportingProvider {
  /** Provider name */
  name: string;
  /** Provider configuration */
  config: Record<string, any>;
  /** Whether provider is enabled */
  enabled: boolean;
  /** Send error report to provider */
  send: (payload: ErrorPayload) => Promise<ReportResponse>;
  /** Initialize provider */
  initialize?: () => Promise<void>;
  /** Shutdown provider */
  shutdown?: () => Promise<void>;
  /** Health check */
  healthCheck?: () => Promise<boolean>;
}

export interface ErrorPayload {
  /** Unique error ID */
  id: string;
  /** Error message */
  message: string;
  /** Error type/name */
  type: string;
  /** Stack trace */
  stackTrace?: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Timestamp */
  timestamp: string;
  /** Environment */
  environment: string;
  /** Release version */
  release?: string;
  /** User context */
  user?: {
    id?: string;
    email?: string;
    username?: string;
    ipAddress?: string;
  };
  /** Device/system context */
  device?: {
    os?: string;
    osVersion?: string;
    architecture?: string;
    nodeVersion?: string;
    memory?: NodeJS.MemoryUsage;
    cpu?: number;
  };
  /** Application context */
  context?: {
    operation?: string;
    component?: string;
    filePath?: string;
    lineNumber?: number;
    columnNumber?: number;
    requestId?: string;
    sessionId?: string;
    correlationId?: string;
  };
  /** Custom tags */
  tags?: Record<string, string>;
  /** Additional metadata */
  extra?: Record<string, any>;
  /** Breadcrumbs (sequence of events leading to error) */
  breadcrumbs?: Breadcrumb[];
}

export interface Breadcrumb {
  /** Breadcrumb timestamp */
  timestamp: string;
  /** Breadcrumb message */
  message: string;
  /** Breadcrumb category */
  category: string;
  /** Breadcrumb level */
  level: 'info' | 'warning' | 'error' | 'debug';
  /** Breadcrumb data */
  data?: Record<string, any>;
}

export interface ReportResponse {
  /** Whether report was successful */
  success: boolean;
  /** Response status code */
  statusCode?: number;
  /** Response message */
  message?: string;
  /** Report ID from provider */
  reportId?: string;
  /** Error details if failed */
  error?: Error;
}

export interface ReportingMetrics {
  /** Total reports sent */
  totalReports: number;
  /** Successful reports */
  successfulReports: number;
  /** Failed reports */
  failedReports: number;
  /** Reports in queue */
  queuedReports: number;
  /** Rate limit hits */
  rateLimitHits: number;
  /** Average response time */
  avgResponseTime: number;
  /** Reports by provider */
  byProvider: Record<string, {
    sent: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  }>;
}

export class ExternalReportingManager extends EventEmitter {
  private config: ExternalReportingConfig;
  private logger: Logger;
  private providers = new Map<string, ReportingProvider>();
  private reportQueue: { payload: ErrorPayload; providers: string[]; timestamp: Date }[] = [];
  private rateLimitTracker: Date[] = [];
  private breadcrumbs: Breadcrumb[] = [];
  private metrics: ReportingMetrics = {
    totalReports: 0,
    successfulReports: 0,
    failedReports: 0,
    queuedReports: 0,
    rateLimitHits: 0,
    avgResponseTime: 0,
    byProvider: {}
  };
  private responseTimes: number[] = [];

  constructor(config: Partial<ExternalReportingConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      rateLimitPerMinute: 60,
      sampleRate: 1.0,
      includeSourceMaps: true,
      includeUserContext: true,
      includeSystemContext: true,
      retryConfig: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      },
      enableOfflineQueue: true,
      maxQueueSize: 1000,
      ...config
    };

    this.logger = createLogger({
      name: 'ExternalReportingManager',
      level: 'info',
      outputs: ['console']
    });

    this.startPeriodicTasks();
  }

  private startPeriodicTasks(): void {
    // Process queue every 5 seconds
    setInterval(() => {
      this.processQueue();
    }, 5000);

    // Clean rate limit tracker every minute
    setInterval(() => {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      this.rateLimitTracker = this.rateLimitTracker.filter(ts => ts > oneMinuteAgo);
    }, 60000);

    // Clean old breadcrumbs every 10 minutes
    setInterval(() => {
      const tenMinutesAgo = new Date(Date.now() - 600000);
      this.breadcrumbs = this.breadcrumbs.filter(
        b => new Date(b.timestamp) > tenMinutesAgo
      );
    }, 600000);
  }

  public registerProvider(provider: ReportingProvider): void {
    this.providers.set(provider.name, provider);
    this.metrics.byProvider[provider.name] = {
      sent: 0,
      successful: 0,
      failed: 0,
      avgResponseTime: 0
    };
    
    this.logger.info(`Registered reporting provider: ${provider.name}`);
  }

  public async initializeProviders(): Promise<void> {
    const initPromises: Promise<void>[] = [];
    
    for (const [name, provider] of this.providers) {
      if (provider.enabled && provider.initialize) {
        initPromises.push(
          provider.initialize().catch(error => {
            this.logger.error(`Failed to initialize provider ${name}:`, error);
          })
        );
      }
    }
    
    await Promise.allSettled(initPromises);
    this.logger.info('External reporting providers initialized');
  }

  public addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs = this.breadcrumbs.slice(-100);
    }
  }

  public async reportError(
    error: Error,
    context: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      operation?: string;
      component?: string;
      user?: ErrorPayload['user'];
      tags?: Record<string, string>;
      extra?: Record<string, any>;
    } = {}
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // Apply sampling
    if (Math.random() > this.config.sampleRate) {
      return false;
    }

    // Check rate limiting
    if (!this.checkRateLimit()) {
      this.metrics.rateLimitHits++;
      this.logger.warn('Rate limit exceeded, skipping error report');
      return false;
    }

    const payload = this.createErrorPayload(error, context);
    const enabledProviders = Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.enabled)
      .map(([name]) => name);

    if (enabledProviders.length === 0) {
      this.logger.warn('No enabled providers for error reporting');
      return false;
    }

    this.metrics.totalReports++;
    
    if (this.config.enableOfflineQueue) {
      this.addToQueue(payload, enabledProviders);
      return true;
    } else {
      return this.sendToProviders(payload, enabledProviders);
    }
  }

  private createErrorPayload(
    error: Error,
    context: Parameters<ExternalReportingManager['reportError']>[1] = {}
  ): ErrorPayload {
    const payload: ErrorPayload = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      type: error.name,
      stackTrace: error.stack,
      category: context.category || ErrorCategory.OPERATIONAL,
      severity: context.severity || ErrorSeverity.MEDIUM,
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      release: this.config.release,
      breadcrumbs: [...this.breadcrumbs]
    };

    // Add user context
    if (this.config.includeUserContext && context.user) {
      payload.user = context.user;
    }

    // Add system context
    if (this.config.includeSystemContext) {
      payload.device = {
        os: process.platform,
        architecture: process.arch,
        nodeVersion: process.version,
        memory: process.memoryUsage()
      };
    }

    // Add application context
    payload.context = {
      operation: context.operation,
      component: context.component,
      requestId: this.generateRequestId(),
      sessionId: this.getSessionId()
    };

    // Add tags and extra data
    if (context.tags) {
      payload.tags = context.tags;
    }

    if (context.extra) {
      payload.extra = context.extra;
    }

    return payload;
  }

  private checkRateLimit(): boolean {
    const now = new Date();
    this.rateLimitTracker.push(now);
    return this.rateLimitTracker.length <= this.config.rateLimitPerMinute;
  }

  private addToQueue(payload: ErrorPayload, providers: string[]): void {
    if (this.reportQueue.length >= this.config.maxQueueSize) {
      // Remove oldest item
      this.reportQueue.shift();
    }
    
    this.reportQueue.push({
      payload,
      providers,
      timestamp: new Date()
    });
    
    this.metrics.queuedReports = this.reportQueue.length;
  }

  private async processQueue(): Promise<void> {
    if (this.reportQueue.length === 0) return;

    const batchSize = Math.min(10, this.reportQueue.length);
    const batch = this.reportQueue.splice(0, batchSize);
    
    for (const item of batch) {
      try {
        await this.sendToProviders(item.payload, item.providers);
      } catch (error) {
        this.logger.error('Failed to process queued report:', error);
      }
    }
    
    this.metrics.queuedReports = this.reportQueue.length;
  }

  private async sendToProviders(payload: ErrorPayload, providerNames: string[]): Promise<boolean> {
    const sendPromises: Promise<{ provider: string; response: ReportResponse }>[] = [];
    
    for (const providerName of providerNames) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;
      
      sendPromises.push(
        this.sendToProvider(provider, payload).then(response => ({
          provider: providerName,
          response
        }))
      );
    }
    
    const results = await Promise.allSettled(sendPromises);
    let successCount = 0;
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { provider, response } = result.value;
        this.updateProviderMetrics(provider, response);
        
        if (response.success) {
          successCount++;
        }
        
        this.emit('report-sent', {
          provider,
          payload,
          response,
          success: response.success
        });
      } else {
        this.logger.error('Provider send failed:', result.reason);
      }
    }
    
    const overallSuccess = successCount > 0;
    if (overallSuccess) {
      this.metrics.successfulReports++;
    } else {
      this.metrics.failedReports++;
    }
    
    return overallSuccess;
  }

  private async sendToProvider(provider: ReportingProvider, payload: ErrorPayload): Promise<ReportResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.retryWithBackoff(
        () => provider.send(payload),
        this.config.retryConfig
      );
      
      const responseTime = Date.now() - startTime;
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > 100) {
        this.responseTimes = this.responseTimes.slice(-100);
      }
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    config: ExternalReportingConfig['retryConfig']
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === config.maxRetries) {
          break;
        }
        
        const delay = Math.min(
          config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateProviderMetrics(providerName: string, response: ReportResponse): void {
    const metrics = this.metrics.byProvider[providerName];
    if (!metrics) return;
    
    metrics.sent++;
    
    if (response.success) {
      metrics.successful++;
    } else {
      metrics.failed++;
    }
    
    // Update average response time
    if (this.responseTimes.length > 0) {
      const avgTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
      metrics.avgResponseTime = avgTime;
      this.metrics.avgResponseTime = avgTime;
    }
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSessionId(): string {
    // In a real implementation, this would retrieve the current session ID
    return `session-${process.pid}`;
  }

  public async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, provider] of this.providers) {
      if (provider.enabled && provider.healthCheck) {
        try {
          results[name] = await provider.healthCheck();
        } catch (error) {
          results[name] = false;
          this.logger.warn(`Health check failed for provider ${name}:`, error);
        }
      } else {
        results[name] = provider.enabled;
      }
    }
    
    return results;
  }

  public getMetrics(): ReportingMetrics {
    return { ...this.metrics };
  }

  public clearQueue(): void {
    this.reportQueue = [];
    this.metrics.queuedReports = 0;
  }

  public updateConfig(updates: Partial<ExternalReportingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public async shutdown(): Promise<void> {
    // Process remaining queue
    await this.processQueue();
    
    // Shutdown providers
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [name, provider] of this.providers) {
      if (provider.shutdown) {
        shutdownPromises.push(
          provider.shutdown().catch(error => {
            this.logger.error(`Failed to shutdown provider ${name}:`, error);
          })
        );
      }
    }
    
    await Promise.allSettled(shutdownPromises);
    
    this.removeAllListeners();
    this.logger.info('External reporting manager shutdown complete');
  }
}

// Provider implementations

export class SentryProvider implements ReportingProvider {
  name = 'sentry';
  enabled = true;
  config: { dsn: string; environment?: string };

  constructor(config: { dsn: string; environment?: string }) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize Sentry SDK
    // In a real implementation, this would import and configure @sentry/node
    console.log('Sentry provider initialized');
  }

  async send(payload: ErrorPayload): Promise<ReportResponse> {
    // Transform payload to Sentry format and send
    // This is a simulation - real implementation would use Sentry SDK
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      // Simulate occasional failures
      if (Math.random() < 0.05) {
        throw new Error('Sentry API error');
      }
      
      return {
        success: true,
        statusCode: 200,
        reportId: `sentry-${Date.now()}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    // Check Sentry API health
    return true;
  }
}

export class DatadogProvider implements ReportingProvider {
  name = 'datadog';
  enabled = true;
  config: { apiKey: string; appKey: string; site?: string };

  constructor(config: { apiKey: string; appKey: string; site?: string }) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize Datadog
    console.log('Datadog provider initialized');
  }

  async send(payload: ErrorPayload): Promise<ReportResponse> {
    // Transform payload to Datadog format and send
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 300));
      
      // Simulate occasional failures
      if (Math.random() < 0.03) {
        throw new Error('Datadog API error');
      }
      
      return {
        success: true,
        statusCode: 200,
        reportId: `datadog-${Date.now()}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    // Check Datadog API health
    return true;
  }
}

export class LogRocketProvider implements ReportingProvider {
  name = 'logrocket';
  enabled = true;
  config: { appId: string };

  constructor(config: { appId: string }) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Initialize LogRocket
    console.log('LogRocket provider initialized');
  }

  async send(payload: ErrorPayload): Promise<ReportResponse> {
    // Transform payload to LogRocket format and send
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 150));
      
      // Simulate occasional failures
      if (Math.random() < 0.02) {
        throw new Error('LogRocket API error');
      }
      
      return {
        success: true,
        statusCode: 200,
        reportId: `logrocket-${Date.now()}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    // Check LogRocket API health
    return true;
  }
}

// Global instance
let globalReportingManager: ExternalReportingManager | null = null;

export function getExternalReportingManager(): ExternalReportingManager {
  if (!globalReportingManager) {
    globalReportingManager = new ExternalReportingManager();
  }
  return globalReportingManager;
}

export function setExternalReportingManager(manager: ExternalReportingManager): void {
  if (globalReportingManager) {
    globalReportingManager.shutdown();
  }
  globalReportingManager = manager;
}

// Convenience functions
export async function reportToExternal(
  error: Error,
  context?: Parameters<ExternalReportingManager['reportError']>[1]
): Promise<boolean> {
  return getExternalReportingManager().reportError(error, context);
}

export function addReportingBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
  getExternalReportingManager().addBreadcrumb(breadcrumb);
}

// Export types
export type {
  ExternalReportingConfig,
  ReportingProvider,
  ErrorPayload,
  Breadcrumb,
  ReportResponse,
  ReportingMetrics
};