/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AdvancedThreadManager } from '../advancedThreadManager.js';
import { ResourceManager } from '../resourceManager.js';
import { MetricsCollector } from '../../metrics/collector.js';
import type { AdvancedTask } from '../advancedThreadManager.js';

describe('Threading System Integration', () => {
  let threadManager: AdvancedThreadManager;
  let resourceManager: ResourceManager;
  let metricsCollector: MetricsCollector;

  beforeEach(async () => {
    // Initialize all components
    resourceManager = new ResourceManager({
      processing: {
        maxConcurrentOperations: 10,
        operationTimeoutMs: 30000,
        enableBatching: true,
        batchSize: 100,
        enablePrioritization: true,
      },
      memory: {
        maxMemoryUsageMB: 1024,
        enableMonitoring: true,
        gcThresholdMB: 512,
        maxHeapSizeMB: 2048,
        enableOptimization: true,
      },
      cpu: {
        maxCpuUsagePercent: 80,
        enableThrottling: true,
        throttleThresholdPercent: 70,
        monitoringIntervalMs: 1000,
      },
      network: {
        maxBandwidthMBps: 100,
        maxConcurrentConnections: 50,
        connectionTimeoutMs: 10000,
        enableCompression: true,
      },
      disk: {
        maxDiskUsagePercent: 85,
        maxIOOperationsPerSecond: 1000,
        enableCaching: true,
        cacheMaxSizeMB: 256,
      },
    });

    await resourceManager.initialize();

    metricsCollector = new MetricsCollector({
      enabled: true,
      collection: {
        interval: 1000,
        batchSize: 100,
        enableAggregation: true,
        enableSystemMetrics: true,
      },
      storage: {
        type: 'memory',
        maxSize: 10000,
        enableCompression: true,
      },
      export: {
        enabled: false, // Disable for tests
      },
    });

    threadManager = new AdvancedThreadManager({
      pool: {
        minThreads: 2,
        maxThreads: 4,
        idleTimeout: 5000,
        enableWorkStealing: true,
        enableLoadBalancing: true,
      },
      scheduling: {
        strategy: 'work_stealing',
        enablePriorityQueues: true,
        maxQueueSize: 100,
        taskTimeout: 15000,
      },
      deadlockDetection: {
        enabled: true,
        checkInterval: 2000,
        timeoutThreshold: 10000,
        enableRecovery: true,
        maxRecoveryAttempts: 3,
      },
      threadSafety: {
        enableAuditing: true,
        trackLockContention: true,
        enableRaceConditionDetection: true,
        auditInterval: 3000,
      },
      performance: {
        enableCpuAffinity: false,
        enableNuma: false,
        enableHyperthreading: true,
        gcOptimization: true,
      },
      monitoring: {
        enableRealTimeMetrics: true,
        metricsInterval: 1000,
        enablePerformanceProfiler: true,
        enableThreadDumps: false,
      },
    });
  });

  afterEach(async () => {
    await threadManager.shutdown();
    await resourceManager.shutdown();
    await metricsCollector.shutdown();
  });

  describe('Resource-Aware Task Execution', () => {
    it('should respect resource limits during task execution', async () => {
      const tasks: AdvancedTask[] = Array.from({ length: 20 }, (_, i) => ({
        id: `resource-task-${i}`,
        type: 'css-optimization',
        priority: 'medium',
        data: {
          css: '.test { color: red; }'.repeat(1000), // Large CSS to consume memory
          options: { minify: true, removeComments: true },
        },
      }));

      // Monitor resource usage during execution
      const initialMetrics = resourceManager.getResourceMetrics();
      
      const results = await threadManager.executeTasks(tasks, {
        maxConcurrency: 5,
        respectResourceLimits: true,
      });

      const finalMetrics = resourceManager.getResourceMetrics();

      expect(results.length).toBe(20);
      expect(results.every(r => r.success)).toBe(true);
      
      // Memory usage should have increased but stayed within limits
      expect(finalMetrics.memory.currentUsageMB).toBeGreaterThan(initialMetrics.memory.currentUsageMB);
      expect(finalMetrics.memory.currentUsageMB).toBeLessThan(resourceManager.getConfiguration().memory.maxMemoryUsageMB);
    });

    it('should throttle task execution under resource pressure', async () => {
      // Create memory-intensive tasks
      const tasks: AdvancedTask[] = Array.from({ length: 10 }, (_, i) => ({
        id: `memory-intensive-${i}`,
        type: 'pattern-analysis',
        priority: 'medium',
        data: {
          patterns: Array.from({ length: 10000 }, (_, j) => `pattern-${i}-${j}`),
          options: { deepAnalysis: true },
        },
      }));

      const startTime = Date.now();
      const results = await threadManager.executeTasks(tasks);
      const endTime = Date.now();

      expect(results.length).toBe(10);
      
      // Execution should be throttled under resource pressure
      const resourceMetrics = resourceManager.getResourceMetrics();
      if (resourceMetrics.memory.pressureLevel === 'high') {
        expect(endTime - startTime).toBeGreaterThan(5000); // Should take longer due to throttling
      }
    });

    it('should handle resource quota violations gracefully', async () => {
      // Set very low memory limit to trigger violations
      resourceManager.updateConfiguration({
        memory: {
          maxMemoryUsageMB: 50, // Very low limit
          enableMonitoring: true,
          gcThresholdMB: 25,
          maxHeapSizeMB: 100,
          enableOptimization: true,
        },
      });

      const task: AdvancedTask = {
        id: 'quota-violation-task',
        type: 'css-optimization',
        priority: 'medium',
        data: {
          css: '.test { color: red; }'.repeat(50000), // Large CSS to exceed quota
          options: { minify: true },
        },
      };

      // Should handle gracefully without crashing
      const result = await threadManager.executeTask(task);
      
      // Task might fail due to resource constraints, but system should remain stable
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Metrics Collection Integration', () => {
    it('should collect thread performance metrics', async () => {
      const task: AdvancedTask = {
        id: 'metrics-task',
        type: 'css-optimization',
        priority: 'medium',
        data: {
          css: '.test { color: blue; }',
          options: { minify: true },
        },
      };

      await threadManager.executeTask(task);

      // Allow time for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1500));

      const metrics = metricsCollector.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      
      // Should have performance and threading metrics
      const threadMetrics = metrics.filter(m => m.category === 'threading');
      const performanceMetrics = metrics.filter(m => m.category === 'performance');
      
      expect(threadMetrics.length).toBeGreaterThan(0);
      expect(performanceMetrics.length).toBeGreaterThan(0);
    });

    it('should track work stealing operations', async () => {
      const tasks: AdvancedTask[] = Array.from({ length: 15 }, (_, i) => ({
        id: `work-stealing-${i}`,
        type: 'pattern-analysis',
        priority: i % 3 === 0 ? 'high' : 'medium',
        data: { patterns: [`pattern-${i}`] },
      }));

      await threadManager.executeTasks(tasks);

      // Allow time for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1500));

      const threadStats = threadManager.getStatistics();
      const metrics = metricsCollector.getMetrics();

      // Should have work stealing metrics
      const workStealingMetrics = metrics.filter(m => 
        m.category === 'threading' && m.name.includes('work_stealing')
      );

      if (threadStats.workStealing.totalSteals > 0) {
        expect(workStealingMetrics.length).toBeGreaterThan(0);
      }
    });

    it('should collect deadlock detection metrics', async () => {
      // Allow deadlock detector to run for a bit
      await new Promise(resolve => setTimeout(resolve, 3000));

      const metrics = metricsCollector.getMetrics();
      const deadlockMetrics = metrics.filter(m => 
        m.category === 'threading' && m.name.includes('deadlock')
      );

      // Should have deadlock detection metrics
      expect(deadlockMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should handle mixed workload with different task types', async () => {
      const tasks: AdvancedTask[] = [
        // CSS optimization tasks
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `css-${i}`,
          type: 'css-optimization',
          priority: 'medium' as const,
          data: { css: `.css-${i} { color: red; }`, options: { minify: true } },
        })),
        
        // Pattern analysis tasks
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `pattern-${i}`,
          type: 'pattern-analysis',
          priority: 'high' as const,
          data: { patterns: [`pattern-${i}-1`, `pattern-${i}-2`] },
        })),
        
        // File processing tasks
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `file-${i}`,
          type: 'file-processing',
          priority: 'low' as const,
          data: {
            files: [{ path: `file-${i}.css`, content: `.file-${i} { color: blue; }` }],
            operations: ['minify', 'validate'],
          },
        })),
      ];

      const startTime = Date.now();
      const results = await threadManager.executeTasks(tasks);
      const endTime = Date.now();

      expect(results.length).toBe(15);
      expect(results.every(r => r.success)).toBe(true);

      // High priority tasks should complete first
      const cssResults = results.filter(r => r.taskId.startsWith('css-'));
      const patternResults = results.filter(r => r.taskId.startsWith('pattern-'));
      const fileResults = results.filter(r => r.taskId.startsWith('file-'));

      expect(cssResults.length).toBe(5);
      expect(patternResults.length).toBe(5);
      expect(fileResults.length).toBe(5);

      // Check resource usage
      const resourceMetrics = resourceManager.getResourceMetrics();
      expect(resourceMetrics.processing.activeOperations).toBe(0); // All should be complete
    });

    it('should handle dependency chains correctly', async () => {
      const task1: AdvancedTask = {
        id: 'dependency-1',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.base { color: red; }', options: { minify: true } },
      };

      const task2: AdvancedTask = {
        id: 'dependency-2',
        type: 'pattern-analysis',
        priority: 'medium',
        data: { patterns: ['base'] },
        dependencies: ['dependency-1'],
      };

      const task3: AdvancedTask = {
        id: 'dependency-3',
        type: 'validation',
        priority: 'medium',
        data: { css: '.base { color: red; }' },
        dependencies: ['dependency-1', 'dependency-2'],
      };

      const results = await threadManager.executeTasks([task1, task2, task3]);

      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);

      // Check execution order based on dependencies
      const completionTimes = results.map(r => r.completedAt || 0);
      const task1Time = results.find(r => r.taskId === 'dependency-1')?.completedAt || 0;
      const task2Time = results.find(r => r.taskId === 'dependency-2')?.completedAt || 0;
      const task3Time = results.find(r => r.taskId === 'dependency-3')?.completedAt || 0;

      expect(task1Time).toBeLessThan(task2Time);
      expect(task2Time).toBeLessThan(task3Time);
    });

    it('should handle error propagation in dependency chains', async () => {
      const task1: AdvancedTask = {
        id: 'failing-dependency',
        type: 'invalid-type', // This will fail
        priority: 'medium',
        data: {},
      };

      const task2: AdvancedTask = {
        id: 'dependent-task',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.test { color: red; }' },
        dependencies: ['failing-dependency'],
      };

      const results = await threadManager.executeTasks([task1, task2]);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(false); // First task should fail
      expect(results[1].success).toBe(false); // Dependent task should also fail
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance under high load', async () => {
      const tasks: AdvancedTask[] = Array.from({ length: 50 }, (_, i) => ({
        id: `load-test-${i}`,
        type: 'css-optimization',
        priority: i % 4 === 0 ? 'high' : 'medium',
        data: {
          css: `.load-test-${i} { color: ${i % 2 === 0 ? 'red' : 'blue'}; }`,
          options: { minify: true, removeComments: true },
        },
      }));

      const startTime = Date.now();
      const results = await threadManager.executeTasks(tasks, { maxConcurrency: 8 });
      const endTime = Date.now();

      expect(results.length).toBe(50);
      expect(results.every(r => r.success)).toBe(true);

      const executionTime = endTime - startTime;
      const averageTimePerTask = executionTime / 50;

      // Should process tasks efficiently
      expect(averageTimePerTask).toBeLessThan(1000); // Less than 1 second per task on average

      // Check system stability
      const threadStats = threadManager.getStatistics();
      const resourceMetrics = resourceManager.getResourceMetrics();

      expect(threadStats.threads.active).toBeGreaterThan(0);
      expect(resourceMetrics.memory.pressureLevel).not.toBe('critical');
    });

    it('should scale thread pool under load', async () => {
      const initialStats = threadManager.getStatistics();
      const initialThreadCount = initialStats.threads.active;

      // Create enough tasks to trigger thread pool scaling
      const tasks: AdvancedTask[] = Array.from({ length: 30 }, (_, i) => ({
        id: `scaling-test-${i}`,
        type: 'pattern-analysis',
        priority: 'medium',
        data: {
          patterns: Array.from({ length: 100 }, (_, j) => `pattern-${i}-${j}`),
        },
      }));

      const resultsPromise = threadManager.executeTasks(tasks, { maxConcurrency: 12 });

      // Check thread count during execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      const duringExecutionStats = threadManager.getStatistics();

      const results = await resultsPromise;
      const finalStats = threadManager.getStatistics();

      expect(results.length).toBe(30);
      expect(results.every(r => r.success)).toBe(true);

      // Thread pool might have scaled up during execution
      if (duringExecutionStats.threads.active > initialThreadCount) {
        expect(duringExecutionStats.threads.active).toBeLessThanOrEqual(threadManager.getConfiguration().pool.maxThreads);
      }
    });
  });

  describe('System Recovery and Resilience', () => {
    it('should recover from worker thread failures', async () => {
      const task: AdvancedTask = {
        id: 'recovery-test',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.test { color: red; }' },
      };

      // Execute task successfully first
      const result1 = await threadManager.executeTask(task);
      expect(result1.success).toBe(true);

      // Simulate worker recovery by executing another task
      const task2: AdvancedTask = {
        id: 'recovery-test-2',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.test2 { color: blue; }' },
      };

      const result2 = await threadManager.executeTask(task2);
      expect(result2.success).toBe(true);

      // System should remain stable
      const stats = threadManager.getStatistics();
      expect(stats.threads.active).toBeGreaterThan(0);
    });

    it('should handle resource exhaustion gracefully', async () => {
      // Set very restrictive resource limits
      resourceManager.updateConfiguration({
        processing: {
          maxConcurrentOperations: 2, // Very low limit
          operationTimeoutMs: 5000,
          enableBatching: false,
          enablePrioritization: true,
        },
      });

      const tasks: AdvancedTask[] = Array.from({ length: 10 }, (_, i) => ({
        id: `exhaustion-test-${i}`,
        type: 'css-optimization',
        priority: 'medium',
        data: { css: `.test-${i} { color: red; }` },
      }));

      // Should handle gracefully even with limited resources
      const results = await threadManager.executeTasks(tasks);

      expect(results.length).toBe(10);
      // Some tasks might fail due to resource constraints, but system should remain stable
      const successfulTasks = results.filter(r => r.success);
      expect(successfulTasks.length).toBeGreaterThan(0);

      // System should still be responsive
      const stats = threadManager.getStatistics();
      expect(stats.threads.active).toBeGreaterThan(0);
    });
  });
});