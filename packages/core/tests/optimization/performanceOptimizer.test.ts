import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPerformanceOptimizer,
  MemoryPool,
  PerformanceOptimizer,
  PerformanceUtils,
  type PerformanceOptimizerConfig,
  type VectorizedOperation,
} from '../../src/optimization/performanceOptimizer';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  const defaultConfig: Partial<PerformanceOptimizerConfig> = {
    maxWorkers: 4,
    enableParallelization: true,
    memoryLimit: 1024,
    enableVectorization: true,
    batchSize: 100,
    enableResourceMonitoring: false, // Disable for testing
  };

  beforeEach(() => {
    optimizer = new PerformanceOptimizer(defaultConfig);
  });

  afterEach(async () => {
    await optimizer.shutdown();
    vi.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultOptimizer = new PerformanceOptimizer();
      expect(defaultOptimizer).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<PerformanceOptimizerConfig> = {
        maxWorkers: 8,
        batchSize: 200,
      };

      const customOptimizer = new PerformanceOptimizer(customConfig);
      const config = customOptimizer.getConfig();

      expect(config.maxWorkers).toBe(8);
      expect(config.batchSize).toBe(200);
    });

    it('should allow runtime configuration updates', () => {
      const newConfig: Partial<PerformanceOptimizerConfig> = {
        maxWorkers: 6,
        enableVectorization: false,
      };

      optimizer.updateConfig(newConfig);
      const updatedConfig = optimizer.getConfig();

      expect(updatedConfig.maxWorkers).toBe(6);
      expect(updatedConfig.enableVectorization).toBe(false);
    });
  });

  describe('Vectorized Operations', () => {
    it('should execute vectorized operations successfully', async () => {
      const operation: VectorizedOperation<number, number> = {
        name: 'multiply',
        operation: async (batch: number[]) => {
          return batch.map((n) => n * 2);
        },
      };

      const data = [1, 2, 3, 4, 5];
      const result = await optimizer.executeVectorizedOperation(operation, data);

      expect(result).toEqual([2, 4, 6, 8, 10]);
    });

    it('should handle empty input data', async () => {
      const operation: VectorizedOperation<number, number> = {
        name: 'multiply',
        operation: async (batch: number[]) => {
          return batch.map((n) => n * 2);
        },
      };

      const result = await optimizer.executeVectorizedOperation(operation, []);
      expect(result).toEqual([]);
    });

    it('should process large batches efficiently', async () => {
      const operation: VectorizedOperation<number, number> = {
        name: 'process',
        operation: async (batch: number[]) => {
          return batch.map((n) => n + 1);
        },
        batchSize: 50,
      };

      const largeData = Array.from({ length: 200 }, (_, i) => i);
      const result = await optimizer.executeVectorizedOperation(operation, largeData);

      expect(result.length).toBe(200);
      expect(result[0]).toBe(1);
      expect(result[199]).toBe(200);
    });

    it('should handle operation validation', async () => {
      const operation: VectorizedOperation<number, number> = {
        name: 'positive-only',
        operation: async (batch: number[]) => {
          return batch.map((n) => n * 2);
        },
        validator: (input: number) => input > 0,
      };

      const mixedData = [-1, 2, -3, 4, 5];
      const result = await optimizer.executeVectorizedOperation(operation, mixedData);

      // Should process all items but emit validation warning
      expect(result.length).toBe(5);
    });

    it('should fallback to sequential processing for small datasets', async () => {
      const smallOptimizer = new PerformanceOptimizer({
        enableVectorization: true,
        vectorThreshold: 10, // Require at least 10 items for vectorization
      });

      const operation: VectorizedOperation<number, number> = {
        name: 'small-batch',
        operation: async (batch: number[]) => {
          return batch.map((n) => n * 3);
        },
      };

      const smallData = [1, 2, 3]; // Below threshold
      const result = await smallOptimizer.executeVectorizedOperation(operation, smallData);

      expect(result).toEqual([3, 6, 9]);
      await smallOptimizer.shutdown();
    });
  });

  describe('Memory Pool Management', () => {
    it('should create and manage memory pools', () => {
      const pool = optimizer.createMemoryPool<string>(
        'string-pool',
        () => '',
        (item) => {
          item = '';
        }
      );

      expect(pool).toBeInstanceOf(MemoryPool);
    });

    it('should retrieve existing memory pools', () => {
      const poolName = 'test-pool';
      const originalPool = optimizer.createMemoryPool<number>(
        poolName,
        () => 0,
        (item) => {
          item = 0;
        }
      );

      const retrievedPool = optimizer.getMemoryPool<number>(poolName);
      expect(retrievedPool).toBe(originalPool);
    });

    it('should return undefined for non-existent pools', () => {
      const nonExistentPool = optimizer.getMemoryPool('non-existent');
      expect(nonExistentPool).toBeUndefined();
    });
  });

  describe('Memory Pool Class', () => {
    let pool: MemoryPool<{ value: number }>;

    beforeEach(() => {
      pool = new MemoryPool(
        () => ({ value: 0 }),
        (item) => {
          item.value = 0;
        },
        5 // Max size
      );
    });

    it('should acquire new objects from factory', () => {
      const obj1 = pool.acquire();
      const obj2 = pool.acquire();

      expect(obj1).toBeDefined();
      expect(obj2).toBeDefined();
      expect(obj1).not.toBe(obj2);
    });

    it('should reuse released objects', () => {
      const obj1 = pool.acquire();
      obj1.value = 42;

      pool.release(obj1);
      const obj2 = pool.acquire();

      expect(obj2).toBe(obj1);
      expect(obj2.value).toBe(0); // Should be reset
    });

    it('should respect maximum pool size', () => {
      const objects = Array.from({ length: 10 }, () => pool.acquire());

      // Release all objects
      objects.forEach((obj) => pool.release(obj));

      // Pool should only retain up to maxSize
      expect(pool.size).toBeLessThanOrEqual(5);
    });

    it('should clear all pooled objects', () => {
      const obj = pool.acquire();
      pool.release(obj);

      expect(pool.size).toBe(1);
      pool.clear();
      expect(pool.size).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should provide current performance metrics', () => {
      const metrics = optimizer.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.cpuUsage).toBeDefined();
      expect(metrics.operationTiming).toBeDefined();
      expect(metrics.performance).toBeDefined();
    });

    it('should track operation timing', async () => {
      const operation: VectorizedOperation<number, number> = {
        name: 'timing-test',
        operation: async (batch: number[]) => {
          await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
          return batch.map((n) => n);
        },
      };

      await optimizer.executeVectorizedOperation(operation, [1, 2, 3]);

      const metrics = optimizer.getMetrics();
      expect(metrics.operationTiming.vectorizedOps).toBeGreaterThan(0);
    });

    it('should provide resource utilization summary', () => {
      const summary = optimizer.getResourceSummary();

      expect(summary).toBeDefined();
      expect(summary.memory).toBeDefined();
      expect(summary.memory.usage).toBeGreaterThan(0);
      expect(summary.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(summary.activeOperations).toBeGreaterThanOrEqual(0);
      expect(summary.memoryPools).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle operation errors gracefully', async () => {
      const errorOperation: VectorizedOperation<number, number> = {
        name: 'error-operation',
        operation: async () => {
          throw new Error('Test error');
        },
      };

      await expect(optimizer.executeVectorizedOperation(errorOperation, [1, 2, 3])).rejects.toThrow(
        'Test error'
      );
    });

    it('should use fallback strategies when enabled', async () => {
      const fallbackOptimizer = new PerformanceOptimizer({
        enableFallbacks: true,
        fallbackStrategy: 'sequential',
      });

      const partialErrorOperation: VectorizedOperation<number, number> = {
        name: 'partial-error',
        operation: async (batch: number[]) => {
          // Simulate partial failure
          if (batch.length > 2) {
            throw new Error('Batch too large');
          }
          return batch.map((n) => n * 2);
        },
      };

      const result = await fallbackOptimizer.executeVectorizedOperation(
        partialErrorOperation,
        [1, 2, 3, 4, 5]
      );

      // Should complete with some results using fallback
      expect(result).toBeDefined();
      await fallbackOptimizer.shutdown();
    });
  });

  describe('Event Handling', () => {
    it('should emit events during operation', async () => {
      const events: string[] = [];

      optimizer.on('vectorized-operation-completed', () => {
        events.push('completed');
      });

      const operation: VectorizedOperation<number, number> = {
        name: 'event-test',
        operation: async (batch: number[]) => batch.map((n) => n),
      };

      await optimizer.executeVectorizedOperation(operation, [1, 2, 3]);

      expect(events).toContain('completed');
    });

    it('should emit configuration update events', () => {
      const events: any[] = [];

      optimizer.on('config-updated', (config) => {
        events.push(config);
      });

      optimizer.updateConfig({ maxWorkers: 10 });

      expect(events.length).toBe(1);
      expect(events[0].maxWorkers).toBe(10);
    });
  });

  describe('Factory Functions', () => {
    it('should create optimizer with factory function', () => {
      const factoryOptimizer = createPerformanceOptimizer(defaultConfig);

      expect(factoryOptimizer).toBeInstanceOf(PerformanceOptimizer);

      factoryOptimizer.shutdown();
    });

    it('should create optimizer with default config via factory', () => {
      const defaultFactoryOptimizer = createPerformanceOptimizer();

      expect(defaultFactoryOptimizer).toBeInstanceOf(PerformanceOptimizer);

      defaultFactoryOptimizer.shutdown();
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      const testOptimizer = new PerformanceOptimizer(defaultConfig);

      await expect(testOptimizer.shutdown()).resolves.not.toThrow();
    });

    it('should clean up resources on shutdown', async () => {
      const testOptimizer = new PerformanceOptimizer({
        enableResourceMonitoring: true,
      });

      // Create some memory pools
      testOptimizer.createMemoryPool(
        'test1',
        () => ({}),
        () => {}
      );
      testOptimizer.createMemoryPool(
        'test2',
        () => ({}),
        () => {}
      );

      await testOptimizer.shutdown();

      // Should have cleaned up
      const summary = testOptimizer.getResourceSummary();
      expect(summary.activeOperations).toBe(0);
    });
  });
});

describe('PerformanceUtils', () => {
  describe('Benchmarking', () => {
    it('should benchmark operation execution time', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      };

      const benchmark = await PerformanceUtils.benchmark(operation, 3);

      expect(benchmark.result).toBe('result');
      expect(benchmark.averageTime).toBeGreaterThan(5); // Should be around 10ms
      expect(benchmark.totalTime).toBeGreaterThan(15); // 3 iterations * ~10ms
    });

    it('should handle synchronous operations', async () => {
      const operation = () => {
        return 42;
      };

      const benchmark = await PerformanceUtils.benchmark(operation, 5);

      expect(benchmark.result).toBe(42);
      expect(benchmark.averageTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Chunk Processing', () => {
    it('should process data in chunks', async () => {
      const data = Array.from({ length: 100 }, (_, i) => i);
      const processor = async (chunk: number[]) => {
        return chunk.map((n) => n * 2);
      };

      const result = await PerformanceUtils.processInChunks(data, processor, 25);

      expect(result.length).toBe(100);
      expect(result[0]).toBe(0);
      expect(result[99]).toBe(198);
    });

    it('should handle empty input', async () => {
      const processor = async (chunk: number[]) => chunk;
      const result = await PerformanceUtils.processInChunks([], processor);

      expect(result).toEqual([]);
    });
  });

  describe('Array Utilities', () => {
    it('should create optimized arrays', () => {
      const array = PerformanceUtils.createOptimizedArray(1000, 42);

      expect(array.length).toBe(1000);
      expect(array[0]).toBe(42);
      expect(array[999]).toBe(42);
    });

    it('should create arrays without initial value', () => {
      const array = PerformanceUtils.createOptimizedArray<number>(100);

      expect(array.length).toBe(100);
    });

    it('should deduplicate arrays', () => {
      const array = [1, 2, 2, 3, 3, 3, 4];
      const deduplicated = PerformanceUtils.deduplicateArray(array);

      expect(deduplicated).toEqual([1, 2, 3, 4]);
    });

    it('should deduplicate arrays with key extractor', () => {
      const array = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'A duplicate' },
        { id: 3, name: 'C' },
      ];

      const deduplicated = PerformanceUtils.deduplicateArray(array, (item) => item.id);

      expect(deduplicated.length).toBe(3);
      expect(deduplicated.map((item) => item.id)).toEqual([1, 2, 3]);
    });
  });
});
