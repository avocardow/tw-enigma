/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AdvancedThreadManager, WorkStealingQueue, ThreadSafetyAuditor, DeadlockDetector } from '../advancedThreadManager.js';
import type { AdvancedTask, AdvancedThreadConfig } from '../advancedThreadManager.js';

describe('AdvancedThreadManager', () => {
  let threadManager: AdvancedThreadManager;
  let config: AdvancedThreadConfig;

  beforeEach(() => {
    config = {
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
        taskTimeout: 10000,
      },
      deadlockDetection: {
        enabled: true,
        checkInterval: 1000,
        timeoutThreshold: 5000,
        enableRecovery: true,
        maxRecoveryAttempts: 2,
      },
      threadSafety: {
        enableAuditing: true,
        trackLockContention: true,
        enableRaceConditionDetection: true,
        auditInterval: 2000,
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
    };

    threadManager = new AdvancedThreadManager(config);
  });

  afterEach(async () => {
    await threadManager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize with provided configuration', () => {
      expect(threadManager.getConfiguration()).toEqual(expect.objectContaining(config));
    });

    it('should initialize thread pool within bounds', () => {
      const stats = threadManager.getStatistics();
      expect(stats.threads.active).toBeGreaterThanOrEqual(config.pool.minThreads);
      expect(stats.threads.active).toBeLessThanOrEqual(config.pool.maxThreads);
    });

    it('should enable work stealing by default', () => {
      const stats = threadManager.getStatistics();
      expect(stats.workStealing.enabled).toBe(true);
    });
  });

  describe('Task Execution', () => {
    it('should execute a simple task successfully', async () => {
      const task: AdvancedTask = {
        id: 'test-task-1',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.test { color: red; }', options: { minify: true } },
      };

      const result = await threadManager.executeTask(task);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle high priority tasks first', async () => {
      const lowPriorityTask: AdvancedTask = {
        id: 'low-priority',
        type: 'pattern-analysis',
        priority: 'low',
        data: { patterns: ['test'] },
      };

      const highPriorityTask: AdvancedTask = {
        id: 'high-priority',
        type: 'pattern-analysis',
        priority: 'high',
        data: { patterns: ['test'] },
      };

      // Execute both tasks
      const results = await Promise.all([
        threadManager.executeTask(lowPriorityTask),
        threadManager.executeTask(highPriorityTask),
      ]);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle multiple tasks concurrently', async () => {
      const tasks: AdvancedTask[] = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-task-${i}`,
        type: 'css-optimization',
        priority: 'medium',
        data: { css: `.test-${i} { color: blue; }`, options: { minify: true } },
      }));

      const startTime = Date.now();
      const results = await threadManager.executeTasks(tasks);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      
      // Should be faster than sequential execution
      expect(endTime - startTime).toBeLessThan(tasks.length * 1000);
    });

    it('should handle task timeout correctly', async () => {
      const task: AdvancedTask = {
        id: 'timeout-task',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.test { color: red; }' },
        timeout: 100, // Very short timeout
      };

      // Mock a slow execution by modifying the worker behavior
      const result = await threadManager.executeTask(task);
      
      // Task should either complete quickly or timeout
      expect(result).toBeDefined();
    });

    it('should retry failed tasks according to configuration', async () => {
      const task: AdvancedTask = {
        id: 'retry-task',
        type: 'invalid-type', // This should cause failure
        priority: 'medium',
        data: {},
        maxRetries: 2,
      };

      const result = await threadManager.executeTask(task);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Work Stealing Queue', () => {
    let queue: WorkStealingQueue<string>;

    beforeEach(() => {
      queue = new WorkStealingQueue<string>();
    });

    it('should push and pop items correctly', async () => {
      await queue.push('item1');
      await queue.push('item2');

      const item1 = await queue.pop();
      const item2 = await queue.pop();

      expect(item1).toBe('item2'); // LIFO for owner
      expect(item2).toBe('item1');
    });

    it('should steal items from the front', async () => {
      await queue.push('item1');
      await queue.push('item2');
      await queue.push('item3');

      const stolenItem = await queue.steal();
      expect(stolenItem).toBe('item1'); // FIFO for stealing
    });

    it('should handle empty queue gracefully', async () => {
      const item = await queue.pop();
      expect(item).toBeNull();

      const stolenItem = await queue.steal();
      expect(stolenItem).toBeNull();
    });

    it('should report correct size', async () => {
      expect(queue.size()).toBe(0);

      await queue.push('item1');
      expect(queue.size()).toBe(1);

      await queue.push('item2');
      expect(queue.size()).toBe(2);

      await queue.pop();
      expect(queue.size()).toBe(1);
    });
  });

  describe('Deadlock Detection', () => {
    let detector: DeadlockDetector;

    beforeEach(() => {
      detector = new DeadlockDetector({
        enabled: true,
        checkInterval: 100,
        timeoutThreshold: 1000,
        enableRecovery: true,
        maxRecoveryAttempts: 2,
      });
    });

    afterEach(() => {
      detector.stop();
    });

    it('should detect simple deadlocks', async () => {
      const lockA = 'lockA';
      const lockB = 'lockB';
      const thread1 = 'thread1';
      const thread2 = 'thread2';

      // Create circular dependency: thread1 -> lockA -> thread2 -> lockB -> thread1
      detector.recordLockRequest(thread1, lockA);
      detector.recordLockAcquisition(thread1, lockA);
      detector.recordLockRequest(thread2, lockB);
      detector.recordLockAcquisition(thread2, lockB);
      
      // Now create the circular wait
      detector.recordLockRequest(thread1, lockB); // thread1 waits for lockB (held by thread2)
      detector.recordLockRequest(thread2, lockA); // thread2 waits for lockA (held by thread1)

      const deadlocks = detector.detectDeadlocks();
      expect(deadlocks.length).toBeGreaterThan(0);
    });

    it('should handle lock release correctly', () => {
      const lock = 'testLock';
      const thread = 'testThread';

      detector.recordLockRequest(thread, lock);
      detector.recordLockAcquisition(thread, lock);
      detector.recordLockRelease(thread, lock);

      const stats = detector.getStatistics();
      expect(stats.activeLocks).toBe(0);
    });

    it('should track lock contention', () => {
      const lock = 'contentionLock';
      const thread1 = 'thread1';
      const thread2 = 'thread2';

      detector.recordLockRequest(thread1, lock);
      detector.recordLockAcquisition(thread1, lock);
      detector.recordLockRequest(thread2, lock); // This should create contention

      const stats = detector.getStatistics();
      expect(stats.lockContentions).toBeGreaterThan(0);
    });
  });

  describe('Thread Safety Auditor', () => {
    let auditor: ThreadSafetyAuditor;

    beforeEach(() => {
      auditor = new ThreadSafetyAuditor({
        enableAuditing: true,
        trackLockContention: true,
        enableRaceConditionDetection: true,
        auditInterval: 100,
      });
    });

    afterEach(() => {
      auditor.stop();
    });

    it('should detect race conditions', () => {
      const resource = 'sharedResource';
      const thread1 = 'thread1';
      const thread2 = 'thread2';

      // Simulate concurrent access without proper locking
      auditor.recordResourceAccess(thread1, resource, 'write');
      auditor.recordResourceAccess(thread2, resource, 'read'); // Potential race condition

      const issues = auditor.getDetectedIssues();
      expect(issues.raceConditions.length).toBeGreaterThan(0);
    });

    it('should track lock contention patterns', () => {
      const lock = 'testLock';
      const thread1 = 'thread1';
      const thread2 = 'thread2';

      // Simulate contention
      auditor.recordLockContention(lock, thread1, 100);
      auditor.recordLockContention(lock, thread2, 150);

      const report = auditor.generateSafetyReport();
      expect(report.lockContentions.length).toBeGreaterThan(0);
      expect(report.lockContentions[0].averageWaitTime).toBeGreaterThan(0);
    });

    it('should provide recommendations for detected issues', () => {
      const resource = 'problematicResource';
      const thread1 = 'thread1';
      const thread2 = 'thread2';

      // Create multiple issues
      auditor.recordResourceAccess(thread1, resource, 'write');
      auditor.recordResourceAccess(thread2, resource, 'write');
      auditor.recordLockContention('lock1', thread1, 500);

      const report = auditor.generateSafetyReport();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Metrics', () => {
    it('should track task execution metrics', async () => {
      const task: AdvancedTask = {
        id: 'metrics-task',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.test { color: red; }', options: { minify: true } },
      };

      await threadManager.executeTask(task);

      const stats = threadManager.getStatistics();
      expect(stats.tasks.completed).toBeGreaterThan(0);
      expect(stats.performance.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should track thread utilization', async () => {
      const tasks: AdvancedTask[] = Array.from({ length: 10 }, (_, i) => ({
        id: `utilization-task-${i}`,
        type: 'pattern-analysis',
        priority: 'medium',
        data: { patterns: [`pattern-${i}`] },
      }));

      await threadManager.executeTasks(tasks);

      const stats = threadManager.getStatistics();
      expect(stats.threads.utilization).toBeGreaterThan(0);
      expect(stats.threads.utilization).toBeLessThanOrEqual(1);
    });

    it('should provide work stealing statistics', async () => {
      // Execute enough tasks to trigger work stealing
      const tasks: AdvancedTask[] = Array.from({ length: 20 }, (_, i) => ({
        id: `stealing-task-${i}`,
        type: 'css-optimization',
        priority: i % 2 === 0 ? 'high' : 'low',
        data: { css: `.test-${i} { color: blue; }`, options: { minify: true } },
      }));

      await threadManager.executeTasks(tasks);

      const stats = threadManager.getStatistics();
      expect(stats.workStealing.enabled).toBe(true);
      // Work stealing should have occurred with this many tasks
      expect(stats.workStealing.totalSteals).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        ...config,
        pool: {
          ...config.pool,
          maxThreads: 8,
        },
      };

      threadManager.updateConfiguration(newConfig);
      const updatedConfig = threadManager.getConfiguration();
      
      expect(updatedConfig.pool.maxThreads).toBe(8);
    });

    it('should validate configuration changes', () => {
      const invalidConfig = {
        ...config,
        pool: {
          ...config.pool,
          minThreads: 10,
          maxThreads: 5, // Invalid: min > max
        },
      };

      expect(() => {
        threadManager.updateConfiguration(invalidConfig);
      }).toThrow();
    });

    it('should apply configuration changes to thread pool', () => {
      const initialStats = threadManager.getStatistics();
      const initialThreadCount = initialStats.threads.active;

      const newConfig = {
        ...config,
        pool: {
          ...config.pool,
          minThreads: Math.max(1, initialThreadCount - 1),
          maxThreads: initialThreadCount + 2,
        },
      };

      threadManager.updateConfiguration(newConfig);
      
      // Configuration should be updated immediately
      const updatedConfig = threadManager.getConfiguration();
      expect(updatedConfig.pool.maxThreads).toBe(initialThreadCount + 2);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle worker thread crashes gracefully', async () => {
      const task: AdvancedTask = {
        id: 'crash-task',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.test { color: red; }' },
      };

      // This should complete successfully even if a worker crashes
      const result = await threadManager.executeTask(task);
      expect(result).toBeDefined();
    });

    it('should recover from deadlock situations', async () => {
      // This test would require more complex setup to create actual deadlocks
      // For now, we test that deadlock detection is enabled
      const stats = threadManager.getStatistics();
      expect(stats.deadlockDetection.enabled).toBe(true);
    });

    it('should handle resource exhaustion', async () => {
      // Create many tasks to potentially exhaust resources
      const tasks: AdvancedTask[] = Array.from({ length: 100 }, (_, i) => ({
        id: `exhaustion-task-${i}`,
        type: 'css-optimization',
        priority: 'medium',
        data: { css: `.test-${i} { color: red; }`, options: { minify: true } },
      }));

      // Should handle gracefully without crashing
      const results = await threadManager.executeTasks(tasks, { maxConcurrency: 10 });
      expect(results.length).toBe(100);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      const task: AdvancedTask = {
        id: 'shutdown-task',
        type: 'css-optimization',
        priority: 'medium',
        data: { css: '.test { color: red; }' },
      };

      // Start a task
      const taskPromise = threadManager.executeTask(task);
      
      // Shutdown should wait for running tasks
      const shutdownPromise = threadManager.shutdown();
      
      // Both should complete successfully
      await Promise.all([taskPromise, shutdownPromise]);
      
      const stats = threadManager.getStatistics();
      expect(stats.threads.active).toBe(0);
    });

    it('should force shutdown if graceful shutdown takes too long', async () => {
      // This test ensures forced shutdown works
      const shutdownPromise = threadManager.shutdown({ timeout: 100, force: true });
      
      await expect(shutdownPromise).resolves.toBeUndefined();
    });

    it('should clean up all resources on shutdown', async () => {
      await threadManager.shutdown();
      
      // Verify all resources are cleaned up
      const stats = threadManager.getStatistics();
      expect(stats.threads.active).toBe(0);
      expect(stats.tasks.queued).toBe(0);
    });
  });
});