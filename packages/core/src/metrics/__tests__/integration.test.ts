/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsCollector, MetricType } from '../collector.js';
import { MetricsConfigManager } from '../config.js';
import {
  createMetricsIntegrationManager,
  createMultiPassDiscoveryIntegration,
  IntegrationPoint,
  MetricEvent,
  MetricsIntegrationConfig,
  MetricsIntegrationManager,
} from '../integration.js';

// Mock integrations for testing
class TestIntegration implements IntegrationPoint {
  public connected = false;
  public messages: any[] = [];
  public shouldFail = false;

  constructor(
    public name: string,
    public type: 'logging' | 'monitoring' | 'alerting' | 'subsystem',
    public enabled = true
  ) {}

  async connect(): Promise<boolean> {
    if (this.shouldFail) return false;
    this.connected = true;
    return this.enabled;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.messages = [];
  }

  async send(data: any): Promise<boolean> {
    if (!this.connected || this.shouldFail) return false;
    this.messages.push(data);
    return true;
  }

  async health(): Promise<{ status: 'healthy' | 'degraded' | 'down'; details?: any }> {
    return {
      status: this.connected && !this.shouldFail ? 'healthy' : 'down',
      details: { messages: this.messages.length },
    };
  }
}

describe('MetricsIntegrationManager', () => {
  let metricsCollector: MetricsCollector;
  let configManager: MetricsConfigManager;
  let integrationManager: MetricsIntegrationManager;
  let testIntegration: TestIntegration;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    configManager = new MetricsConfigManager();
    integrationManager = createMetricsIntegrationManager(metricsCollector, configManager, {
      dataFlow: { flushInterval: 100 },
    });

    testIntegration = new TestIntegration('test', 'monitoring');
    integrationManager.addIntegration('test', testIntegration);
  });

  afterEach(async () => {
    await integrationManager.stop();
  });

  describe('Initialization', () => {
    it('should create integration manager with default config', () => {
      const manager = createMetricsIntegrationManager(metricsCollector, configManager);
      expect(manager).toBeDefined();
      expect(manager.getStatistics().totalEvents).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const config: Partial<MetricsIntegrationConfig> = {
        integrations: {
          logging: { enabled: false },
          monitoring: { enabled: true },
        },
        dataFlow: {
          bufferSize: 500,
          flushInterval: 2000,
        },
      };

      const manager = createMetricsIntegrationManager(metricsCollector, configManager, config);
      expect(manager).toBeDefined();
    });
  });

  describe('Integration Management', () => {
    it('should start and connect integrations', async () => {
      const result = await integrationManager.start();

      expect(result.connected).toContain('test');
      expect(result.metrics.activeConnections).toBeGreaterThan(0);
      expect(testIntegration.connected).toBe(true);
    });

    it('should handle failed connections', async () => {
      testIntegration.shouldFail = true;
      const result = await integrationManager.start();

      expect(result.failed.some((f) => f.name === 'test')).toBe(true);
      expect(testIntegration.connected).toBe(false);
    });

    it('should stop and disconnect integrations', async () => {
      await integrationManager.start();
      expect(testIntegration.connected).toBe(true);

      await integrationManager.stop();
      expect(testIntegration.connected).toBe(false);
    });

    it('should get health status of integrations', async () => {
      await integrationManager.start();
      const health = await integrationManager.getHealthStatus();

      expect(health.test).toBeDefined();
      expect(health.test.status).toBe('healthy');
    });

    it('should get connection status', async () => {
      await integrationManager.start();
      const status = integrationManager.getConnectionStatus();

      expect(status.connected).toContain('test');
      expect(status.metrics.totalIntegrations).toBeGreaterThan(0);
    });
  });

  describe('Event Processing', () => {
    beforeEach(async () => {
      await integrationManager.start();
    });

    it('should send metric events to integrations', async () => {
      const event: MetricEvent = {
        id: 'test-metric-1',
        metric: {
          name: 'test_counter',
          type: MetricType.COUNTER,
          value: 1,
          unit: 'count',
        },
        timestamp: new Date(),
        source: 'test',
        tags: { category: 'test' },
      };

      await integrationManager.sendMetric(event);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(testIntegration.messages.length).toBeGreaterThan(0);
      const receivedEvent = testIntegration.messages[0];
      expect(receivedEvent.metric.name).toBe('test_counter');
      expect(receivedEvent.integration).toBeDefined();
    });

    it('should buffer events and flush periodically', async () => {
      const events: MetricEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `test-metric-${i}`,
        metric: {
          name: `test_metric_${i}`,
          type: MetricType.GAUGE,
          value: i,
          unit: 'count',
        },
        timestamp: new Date(),
        source: 'test',
        tags: { category: 'test', index: i.toString() },
      }));

      for (const event of events) {
        await integrationManager.sendMetric(event);
      }

      // Wait for flush
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(testIntegration.messages.length).toBe(5);
    });

    it('should handle integration failures gracefully', async () => {
      testIntegration.shouldFail = true;

      const event: MetricEvent = {
        id: 'test-metric-fail',
        metric: {
          name: 'test_fail',
          type: MetricType.ERROR,
          value: 1,
        },
        timestamp: new Date(),
        source: 'test',
      };

      await integrationManager.sendMetric(event);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stats = integrationManager.getStatistics();
      expect(stats.failedDeliveries).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await integrationManager.start();
    });

    it('should track delivery statistics', async () => {
      const event: MetricEvent = {
        id: 'test-stats',
        metric: {
          name: 'test_stats',
          type: MetricType.GAUGE,
          value: 42,
        },
        timestamp: new Date(),
        source: 'test',
      };

      await integrationManager.sendMetric(event);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stats = integrationManager.getStatistics();
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.successfulDeliveries).toBeGreaterThan(0);
    });

    it('should handle errors and continue processing', async () => {
      const errorEvent: MetricEvent = {
        id: 'error-test',
        metric: {
          name: 'error_metric',
          type: MetricType.ERROR,
          value: 'test error',
        },
        timestamp: new Date(),
        source: 'test',
      };

      const normalEvent: MetricEvent = {
        id: 'normal-test',
        metric: {
          name: 'normal_metric',
          type: MetricType.COUNTER,
          value: 1,
        },
        timestamp: new Date(),
        source: 'test',
      };

      await integrationManager.sendMetric(errorEvent);
      await integrationManager.sendMetric(normalEvent);
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(testIntegration.messages.length).toBe(2);
    });
  });

  describe('Integration Point Management', () => {
    it('should add custom integration', () => {
      const customIntegration = new TestIntegration('custom', 'alerting');
      integrationManager.addIntegration('custom', customIntegration);

      const retrieved = integrationManager.getIntegration('custom');
      expect(retrieved).toBe(customIntegration);
    });

    it('should remove integration', async () => {
      await integrationManager.start();
      expect(testIntegration.connected).toBe(true);

      const removed = await integrationManager.removeIntegration('test');
      expect(removed).toBe(true);
      expect(testIntegration.connected).toBe(false);

      const retrieved = integrationManager.getIntegration('test');
      expect(retrieved).toBeUndefined();
    });

    it('should handle removal of non-existent integration', async () => {
      const removed = await integrationManager.removeIntegration('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    it('should listen to metrics collector events', async () => {
      await integrationManager.start();

      // Simulate metrics collector emitting an event
      const event: MetricEvent = {
        id: 'collector-event',
        metric: {
          name: 'collector_metric',
          type: MetricType.PERFORMANCE,
          value: 100,
        },
        timestamp: new Date(),
        source: 'collector',
      };

      metricsCollector.emit('metric', event);
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(testIntegration.messages.length).toBeGreaterThan(0);
    });

    it('should handle errors from metrics collector', async () => {
      await integrationManager.start();

      const errorListener = vi.fn();
      integrationManager.on('error', errorListener);

      metricsCollector.emit('error', new Error('Test error'));

      expect(errorListener).toHaveBeenCalledWith({
        type: 'integration_error',
        message: 'Test error',
        timestamp: expect.any(Date),
      });
    });

    it('should handle config changes', async () => {
      await integrationManager.start();

      const configListener = vi.fn();
      integrationManager.on('configChange', configListener);

      configManager.emit('configChanged', { setting: 'updated' });

      expect(configListener).toHaveBeenCalledWith({ setting: 'updated' });
    });
  });
});

describe('MultiPassDiscovery Integration', () => {
  let integrationManager: MetricsIntegrationManager;
  let testIntegration: TestIntegration;
  let mockMultiPassDiscovery: any;

  beforeEach(async () => {
    const metricsCollector = new MetricsCollector();
    const configManager = new MetricsConfigManager();
    integrationManager = createMetricsIntegrationManager(metricsCollector, configManager);

    testIntegration = new TestIntegration('test', 'monitoring');
    integrationManager.addIntegration('test', testIntegration);
    await integrationManager.start();

    // Mock MultiPassDiscovery
    mockMultiPassDiscovery = {
      optimize: vi.fn().mockResolvedValue({
        totalPassesExecuted: 3,
        convergence: { hasConverged: true },
      }),
    };
  });

  afterEach(async () => {
    await integrationManager.stop();
  });

  it('should enhance MultiPassDiscovery with metrics integration', async () => {
    const integration = createMultiPassDiscoveryIntegration(integrationManager);
    const enhanced = integration.enhanceMultiPassDiscovery(mockMultiPassDiscovery);

    expect(enhanced).toBe(mockMultiPassDiscovery);
    expect(typeof enhanced.optimize).toBe('function');
  });

  it('should send metrics on optimization start and completion', async () => {
    const integration = createMultiPassDiscoveryIntegration(integrationManager);
    const enhanced = integration.enhanceMultiPassDiscovery(mockMultiPassDiscovery);

    const result = await enhanced.optimize({ test: 'input' });

    // Wait for metrics to be processed
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(mockMultiPassDiscovery.optimize).toHaveBeenCalledWith({ test: 'input' });
    expect(result.totalPassesExecuted).toBe(3);
    expect(testIntegration.messages.length).toBeGreaterThan(0);

    // Check for start and completion events
    const metricNames = testIntegration.messages.map((m) => m.metric.name);
    expect(metricNames).toContain('optimization_started');
    expect(metricNames).toContain('optimization_completed');
  });

  it('should send error metrics on optimization failure', async () => {
    mockMultiPassDiscovery.optimize.mockRejectedValue(new Error('Optimization failed'));

    const integration = createMultiPassDiscoveryIntegration(integrationManager);
    const enhanced = integration.enhanceMultiPassDiscovery(mockMultiPassDiscovery);

    await expect(enhanced.optimize({ test: 'input' })).rejects.toThrow('Optimization failed');

    // Wait for metrics to be processed
    await new Promise((resolve) => setTimeout(resolve, 150));

    const metricNames = testIntegration.messages.map((m) => m.metric.name);
    expect(metricNames).toContain('optimization_started');
    expect(metricNames).toContain('optimization_error');
  });

  it('should include optimization metadata in completion metrics', async () => {
    const integration = createMultiPassDiscoveryIntegration(integrationManager);
    const enhanced = integration.enhanceMultiPassDiscovery(mockMultiPassDiscovery);

    await enhanced.optimize({ test: 'input' });
    await new Promise((resolve) => setTimeout(resolve, 150));

    const completionEvent = testIntegration.messages.find(
      (m) => m.metric.name === 'optimization_completed'
    );

    expect(completionEvent).toBeDefined();
    expect(completionEvent.tags.passes).toBe('3');
    expect(completionEvent.tags.converged).toBe('true');
  });

  it('should preserve original MultiPassDiscovery functionality', async () => {
    const integration = createMultiPassDiscoveryIntegration(integrationManager);
    const enhanced = integration.enhanceMultiPassDiscovery(mockMultiPassDiscovery);

    const result = await enhanced.optimize({ test: 'input' });

    expect(result).toEqual({
      totalPassesExecuted: 3,
      convergence: { hasConverged: true },
    });
    expect(mockMultiPassDiscovery.optimize).toHaveBeenCalledWith({ test: 'input' });
  });
});

describe('Integration Configuration', () => {
  it('should validate configuration schema', () => {
    const validConfig: Partial<MetricsIntegrationConfig> = {
      integrations: {
        logging: { enabled: true, logLevel: 'info' },
        monitoring: {
          prometheus: { enabled: true, prefix: 'custom_' },
          dashboard: { updateInterval: 3000 },
        },
        alerting: {
          enabled: true,
          channels: ['console', 'webhook'],
          thresholds: {
            performance: { latencyMs: 2000 },
            quality: { accuracy: 0.9 },
          },
        },
      },
      dataFlow: {
        bufferSize: 2000,
        flushInterval: 3000,
        batchSize: 50,
      },
    };

    expect(() => {
      createMetricsIntegrationManager(
        new MetricsCollector(),
        new MetricsConfigManager(),
        validConfig
      );
    }).not.toThrow();
  });

  it('should handle missing configuration gracefully', () => {
    expect(() => {
      createMetricsIntegrationManager(new MetricsCollector(), new MetricsConfigManager());
    }).not.toThrow();
  });
});

describe('Error Handling', () => {
  let integrationManager: MetricsIntegrationManager;
  let testIntegration: TestIntegration;

  beforeEach(async () => {
    integrationManager = createMetricsIntegrationManager(
      new MetricsCollector(),
      new MetricsConfigManager(),
      {
        errorHandling: { continueOnError: true },
        dataFlow: { flushInterval: 100 },
      }
    );

    testIntegration = new TestIntegration('test', 'monitoring');
    integrationManager.addIntegration('test', testIntegration);
    await integrationManager.start();
  });

  afterEach(async () => {
    await integrationManager.stop();
  });

  it('should continue processing after integration failures', async () => {
    const workingIntegration = new TestIntegration('working', 'monitoring');
    integrationManager.addIntegration('working', workingIntegration);

    testIntegration.shouldFail = true;

    const event: MetricEvent = {
      id: 'test-resilience',
      metric: {
        name: 'resilience_test',
        type: MetricType.COUNTER,
        value: 1,
      },
      timestamp: new Date(),
      source: 'test',
    };

    await integrationManager.sendMetric(event);
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Working integration should still receive the event
    expect(workingIntegration.messages.length).toBeGreaterThan(0);
    expect(testIntegration.messages.length).toBe(0); // Failed integration
  });

  it('should track failed deliveries', async () => {
    testIntegration.shouldFail = true;

    const event: MetricEvent = {
      id: 'test-failure',
      metric: {
        name: 'failure_test',
        type: MetricType.ERROR,
        value: 1,
      },
      timestamp: new Date(),
      source: 'test',
    };

    await integrationManager.sendMetric(event);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const stats = integrationManager.getStatistics();
    expect(stats.failedDeliveries).toBeGreaterThan(0);
  });
});
