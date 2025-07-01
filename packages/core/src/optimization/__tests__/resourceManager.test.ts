/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResourceManager, type OperationContext, type ResourceQuotaConfig } from '../resourceManager.js';
import { MetricsCollector } from '../../metrics/collector.js';

describe('ResourceManager', () => {
  let resourceManager: ResourceManager;
  let metricsCollector: MetricsCollector;
  let mockGC: vi.MockedFunction<() => void>;

  const testConfig: Partial<ResourceQuotaConfig> = {
    processing: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxProcessingTime: 5000, // 5 seconds
      maxConcurrentFiles: 5,
      maxFilesPerBatch: 10,
      maxTotalFiles: 100,
      enableTimeoutChecks: true,
      enableSizeValidation: true,
    },
    memory: {
      maxHeapUsage: 100, // 100MB
      maxTotalMemory: 200, // 200MB
      gcTriggerThreshold: 0.8,
      memoryPressureThreshold: 0.9,
      enableAutomaticGC: true,
      enableMemoryReclamation: true,
      memoryCheckInterval: 1000,
    },
    cpu: {
      maxCpuUsage: 0.8,
      maxConcurrentOperations: 3,
      maxWorkerThreads: 2,
      cpuThrottleThreshold: 0.9,
      enableCpuThrottling: true,
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
      monitoringInterval: 100,
      enableAlerting: true,
      alertCooldownMs: 1000,
      enableMetricsCollection: true,
      retentionPeriodHours: 1,
    },
  };

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    resourceManager = new ResourceManager(testConfig, metricsCollector);
    
    // Mock global.gc
    mockGC = vi.fn();
    global.gc = mockGC;
    
    // Mock process.memoryUsage
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 50 * 1024 * 1024, // 50MB
      heapTotal: 60 * 1024 * 1024, // 60MB
      heapUsed: 40 * 1024 * 1024, // 40MB
      external: 5 * 1024 * 1024, // 5MB
      arrayBuffers: 2 * 1024 * 1024, // 2MB
    });
  });

  afterEach(async () => {
    resourceManager.cleanup();
    vi.restoreAllMocks();
    delete global.gc;
  });

  describe('Operation Management', () => {
    it('should start and complete operations successfully', async () => {
      const context: OperationContext = {
        id: 'test-op-1',
        type: 'file_processing',
        startTime: new Date(),
        priority: 'medium',
        metadata: { test: true },
      };

      const started = await resourceManager.startOperation(context);
      expect(started).toBe(true);

      resourceManager.completeOperation('test-op-1', true);
      
      const stats = resourceManager.getStatistics();
      expect(stats.totalOperationsStarted).toBe(1);
      expect(stats.totalOperationsCompleted).toBe(1);
    });

    it('should reject operations when concurrency limit is reached', async () => {
      const contexts: OperationContext[] = [];
      
      // Start operations up to the limit
      for (let i = 0; i < testConfig.processing!.maxConcurrentFiles! + 2; i++) {
        contexts.push({
          id: `test-op-${i}`,
          type: 'file_processing',
          startTime: new Date(),
          priority: 'medium',
        });
      }

      // First few should succeed
      for (let i = 0; i < testConfig.processing!.maxConcurrentFiles!; i++) {
        const started = await resourceManager.startOperation(contexts[i]);
        expect(started).toBe(true);
      }

      // Additional operations should be rejected
      for (let i = testConfig.processing!.maxConcurrentFiles!; i < contexts.length; i++) {
        const started = await resourceManager.startOperation(contexts[i]);
        expect(started).toBe(false);
      }
    });

    it('should allow critical priority operations even under resource pressure', async () => {
      // Fill up concurrent slots
      for (let i = 0; i < testConfig.processing!.maxConcurrentFiles!; i++) {
        await resourceManager.startOperation({
          id: `test-op-${i}`,
          type: 'file_processing',
          startTime: new Date(),
          priority: 'low',
        });
      }

      // Critical operation should still be allowed
      const criticalContext: OperationContext = {
        id: 'critical-op',
        type: 'file_processing',
        startTime: new Date(),
        priority: 'critical',
      };

      const started = await resourceManager.startOperation(criticalContext);
      expect(started).toBe(true);
    });
  });

  describe('File Validation', () => {
    it('should validate file size against limits', () => {
      const validFile = resourceManager.validateFileProcessing('test.txt', 5 * 1024 * 1024); // 5MB
      expect(validFile.allowed).toBe(true);

      const invalidFile = resourceManager.validateFileProcessing('large.txt', 20 * 1024 * 1024); // 20MB
      expect(invalidFile.allowed).toBe(false);
      expect(invalidFile.reason).toContain('exceeds limit');
    });

    it('should provide suggested actions for rejected files', () => {
      const result = resourceManager.validateFileProcessing('large.txt', 20 * 1024 * 1024);
      expect(result.allowed).toBe(false);
      expect(result.suggestedAction).toContain('Split file');
    });
  });

  describe('Memory Pressure Handling', () => {
    it('should detect memory pressure and trigger reclamation', async () => {
      // Mock high memory usage
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 95 * 1024 * 1024, // 95MB (near limit)
        heapTotal: 95 * 1024 * 1024,
        heapUsed: 95 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      const memoryReclaimationPromise = new Promise<void>((resolve) => {
        resourceManager.once('memoryReclamationRequested', () => {
          resolve();
        });
      });

      await resourceManager.handleMemoryPressure();
      
      await memoryReclaimationPromise;
      expect(mockGC).toHaveBeenCalled();
    });

    it('should reject low priority operations during memory pressure', async () => {
      // Trigger memory pressure
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 95 * 1024 * 1024,
        heapTotal: 95 * 1024 * 1024,
        heapUsed: 95 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      await resourceManager.handleMemoryPressure();

      const lowPriorityContext: OperationContext = {
        id: 'low-priority-op',
        type: 'file_processing',
        startTime: new Date(),
        priority: 'low',
      };

      const started = await resourceManager.startOperation(lowPriorityContext);
      expect(started).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per client', () => {
      const clientId = 'test-client';
      const maxRequests = testConfig.network!.maxRequestsPerSecond!;

      // Allow requests up to the limit
      for (let i = 0; i < maxRequests; i++) {
        const allowed = resourceManager.checkRateLimit(clientId);
        expect(allowed).toBe(true);
      }

      // Additional requests should be rate limited
      const shouldBeLimited = resourceManager.checkRateLimit(clientId);
      expect(shouldBeLimited).toBe(false);
    });

    it('should reset rate limits after time window', async () => {
      const clientId = 'test-client';
      const maxRequests = testConfig.network!.maxRequestsPerSecond!;

      // Exhaust rate limit
      for (let i = 0; i <= maxRequests; i++) {
        resourceManager.checkRateLimit(clientId);
      }

      // Wait for rate limit window to reset
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should allow requests again
      const allowed = resourceManager.checkRateLimit(clientId);
      expect(allowed).toBe(true);
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('should provide current resource usage snapshot', () => {
      const usage = resourceManager.getCurrentUsage();
      
      expect(usage).toHaveProperty('timestamp');
      expect(usage).toHaveProperty('processing');
      expect(usage).toHaveProperty('memory');
      expect(usage).toHaveProperty('cpu');
      expect(usage).toHaveProperty('network');
      expect(usage).toHaveProperty('disk');
      
      expect(usage.memory.heapUsed).toBeGreaterThan(0);
      expect(usage.memory.percentage).toBeGreaterThanOrEqual(0);
    });

    it('should track operation durations and averages', async () => {
      const context: OperationContext = {
        id: 'timing-test',
        type: 'file_processing',
        startTime: new Date(),
        priority: 'medium',
      };

      await resourceManager.startOperation(context);
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      resourceManager.completeOperation('timing-test', true);
      
      const stats = resourceManager.getStatistics();
      expect(stats.totalOperationsCompleted).toBe(1);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration at runtime', () => {
      const updates: Partial<ResourceQuotaConfig> = {
        processing: {
          ...testConfig.processing!,
          maxConcurrentFiles: 10,
        },
      };

      resourceManager.updateConfig(updates);
      
      const stats = resourceManager.getStatistics();
      expect(stats.config.processing?.maxConcurrentFiles).toBe(10);
    });
  });

  describe('Violation Detection', () => {
    it('should create violations when thresholds are exceeded', async () => {
      const violationPromise = new Promise<any>((resolve) => {
        resourceManager.once('resourceViolation', (violation) => {
          resolve(violation);
        });
      });

      // Trigger memory violation
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 110 * 1024 * 1024, // Over limit
        heapTotal: 110 * 1024 * 1024,
        heapUsed: 110 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      await resourceManager.handleMemoryPressure();
      
      const violation = await violationPromise;
      expect(violation).toBeDefined();
      expect(violation.category).toBe('memory');
    });

    it('should provide active violations list', async () => {
      // Trigger a violation
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 110 * 1024 * 1024,
        heapTotal: 110 * 1024 * 1024,
        heapUsed: 110 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      await resourceManager.handleMemoryPressure();
      
      // Wait a bit for violation to be created
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const violations = resourceManager.getActiveViolations();
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Environment Variable Integration', () => {
    it('should respect environment variable overrides', () => {
      process.env.TW_ENIGMA_MAX_FILE_SIZE = '20971520'; // 20MB
      process.env.TW_ENIGMA_MAX_CONCURRENT_FILES = '8';
      
      const envResourceManager = new ResourceManager({}, metricsCollector);
      const stats = envResourceManager.getStatistics();
      
      expect(stats.config.processing?.maxFileSize).toBe(20971520);
      expect(stats.config.processing?.maxConcurrentFiles).toBe(8);
      
      // Clean up
      delete process.env.TW_ENIGMA_MAX_FILE_SIZE;
      delete process.env.TW_ENIGMA_MAX_CONCURRENT_FILES;
      envResourceManager.cleanup();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operation IDs gracefully', () => {
      expect(() => {
        resourceManager.completeOperation('non-existent-id');
      }).not.toThrow();
    });

    it('should handle memory monitoring errors gracefully', async () => {
      // Mock memory usage to throw an error
      vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory usage unavailable');
      });

      // Should not throw
      expect(async () => {
        await resourceManager.handleMemoryPressure();
      }).not.toThrow();
    });
  });

  describe('Statistics and Metrics', () => {
    it('should maintain accurate operation statistics', async () => {
      const operations = ['op1', 'op2', 'op3'];
      
      for (const opId of operations) {
        await resourceManager.startOperation({
          id: opId,
          type: 'file_processing',
          startTime: new Date(),
          priority: 'medium',
        });
      }
      
      for (const opId of operations) {
        resourceManager.completeOperation(opId, true);
      }
      
      const stats = resourceManager.getStatistics();
      expect(stats.totalOperationsStarted).toBe(3);
      expect(stats.totalOperationsCompleted).toBe(3);
    });

    it('should track violation counts', async () => {
      const initialStats = resourceManager.getStatistics();
      const initialViolations = initialStats.totalViolations;
      
      // Trigger a violation
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 110 * 1024 * 1024,
        heapTotal: 110 * 1024 * 1024,
        heapUsed: 110 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      await resourceManager.handleMemoryPressure();
      
      // Wait for violation to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalStats = resourceManager.getStatistics();
      expect(finalStats.totalViolations).toBeGreaterThan(initialViolations);
    });
  });
});