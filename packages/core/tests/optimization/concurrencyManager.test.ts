/**
 * Tests for ConcurrencyManager and related classes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Mutex,
  ReadWriteLock,
  Semaphore,
  ConditionVariable,
  WorkerPool,
  ResourcePool,
  RateLimiter,
  ConcurrencyManager,
  globalConcurrencyManager,
} from '../../src/optimization/concurrencyManager';

describe('Mutex', () => {
  let mutex: Mutex;

  beforeEach(() => {
    mutex = new Mutex();
  });

  it('should acquire and release locks correctly', async () => {
    expect(mutex.isLocked()).toBe(false);

    await mutex.acquire();
    expect(mutex.isLocked()).toBe(true);

    mutex.release();
    expect(mutex.isLocked()).toBe(false);
  });

  it('should queue operations when locked', async () => {
    const results: number[] = [];
    
    // Start long operation
    const longOp = mutex.withLock(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      results.push(1);
    });

    // Queue short operations
    const shortOp1 = mutex.withLock(async () => {
      results.push(2);
    });

    const shortOp2 = mutex.withLock(async () => {
      results.push(3);
    });

    await Promise.all([longOp, shortOp1, shortOp2]);

    expect(results).toEqual([1, 2, 3]);
    expect(mutex.getWaitingCount()).toBe(0);
  });

  it('should handle exceptions within withLock', async () => {
    const error = new Error('Test error');
    
    await expect(
      mutex.withLock(async () => {
        throw error;
      })
    ).rejects.toThrow('Test error');

    // Mutex should be unlocked after exception
    expect(mutex.isLocked()).toBe(false);
  });

  it('should track waiting count', async () => {
    const acquire1 = mutex.acquire();
    await acquire1; // First acquire succeeds immediately
    
    expect(mutex.getWaitingCount()).toBe(0);

    // These will be queued
    const acquire2 = mutex.acquire();
    const acquire3 = mutex.acquire();
    
    expect(mutex.getWaitingCount()).toBe(2);

    mutex.release();
    await acquire2;
    expect(mutex.getWaitingCount()).toBe(1);

    mutex.release();
    await acquire3;
    expect(mutex.getWaitingCount()).toBe(0);

    mutex.release();
  });

  it('should throw when releasing unlocked mutex', () => {
    expect(() => mutex.release()).toThrow('Mutex is not locked');
  });
});

describe('ReadWriteLock', () => {
  let lock: ReadWriteLock;

  beforeEach(() => {
    lock = new ReadWriteLock();
  });

  it('should allow multiple concurrent readers', async () => {
    const results: number[] = [];

    const readers = [
      lock.withReadLock(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        results.push(1);
      }),
      lock.withReadLock(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        results.push(2);
      }),
      lock.withReadLock(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(3);
      }),
    ];

    await Promise.all(readers);

    expect(results).toHaveLength(3);
    expect(results).toContain(1);
    expect(results).toContain(2);
    expect(results).toContain(3);
  });

  it('should block writers when readers are active', async () => {
    const results: number[] = [];

    // Start reader
    const reader = lock.withReadLock(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      results.push(1);
    });

    // Start writer (should be blocked)
    const writer = lock.withWriteLock(async () => {
      results.push(2);
    });

    await Promise.all([reader, writer]);

    expect(results).toEqual([1, 2]);
  });

  it('should block readers when writer is active', async () => {
    const results: number[] = [];

    // Start writer
    const writer = lock.withWriteLock(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      results.push(1);
    });

    // Start readers (should be blocked)
    const reader1 = lock.withReadLock(async () => {
      results.push(2);
    });

    const reader2 = lock.withReadLock(async () => {
      results.push(3);
    });

    await Promise.all([writer, reader1, reader2]);

    expect(results).toEqual([1, 2, 3]);
  });

  it('should provide correct status information', async () => {
    let status = lock.getStatus();
    expect(status.readers).toBe(0);
    expect(status.writer).toBe(false);

    await lock.acquireRead();
    await lock.acquireRead();
    
    status = lock.getStatus();
    expect(status.readers).toBe(2);
    expect(status.writer).toBe(false);

    lock.releaseRead();
    lock.releaseRead();

    await lock.acquireWrite();
    
    status = lock.getStatus();
    expect(status.readers).toBe(0);
    expect(status.writer).toBe(true);

    lock.releaseWrite();
  });

  it('should handle release errors', () => {
    expect(() => lock.releaseRead()).toThrow('No active readers');
    expect(() => lock.releaseWrite()).toThrow('No active writer');
  });
});

describe('Semaphore', () => {
  let semaphore: Semaphore;

  beforeEach(() => {
    semaphore = new Semaphore(2);
  });

  it('should limit concurrent access', async () => {
    let activeCount = 0;
    let maxActiveCount = 0;

    const tasks = Array.from({ length: 5 }, (_, i) =>
      semaphore.withPermit(async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        await new Promise(resolve => setTimeout(resolve, 20));
        activeCount--;
        return i;
      })
    );

    const results = await Promise.all(tasks);

    expect(maxActiveCount).toBe(2);
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(semaphore.getAvailablePermits()).toBe(2);
    expect(semaphore.getWaitingCount()).toBe(0);
  });

  it('should track available permits', async () => {
    expect(semaphore.getAvailablePermits()).toBe(2);

    await semaphore.acquire();
    expect(semaphore.getAvailablePermits()).toBe(1);

    await semaphore.acquire();
    expect(semaphore.getAvailablePermits()).toBe(0);

    semaphore.release();
    expect(semaphore.getAvailablePermits()).toBe(1);

    semaphore.release();
    expect(semaphore.getAvailablePermits()).toBe(2);
  });

  it('should handle permit overflow', async () => {
    // First acquire all permits to bring count to 0
    await semaphore.acquire();
    await semaphore.acquire();
    
    // Now release them back to bring count to 2 (max)
    semaphore.release();
    semaphore.release();
    
    // Trying to release one more should throw
    expect(() => semaphore.release()).toThrow('Cannot release more permits than maximum');
  });
});

describe('ConditionVariable', () => {
  let condition: ConditionVariable;

  beforeEach(() => {
    condition = new ConditionVariable();
  });

  it('should signal one waiting thread', async () => {
    const results: number[] = [];

    const waiter1 = condition.wait().then(() => results.push(1));
    const waiter2 = condition.wait().then(() => results.push(2));

    expect(condition.getWaitingCount()).toBe(2);

    condition.signal();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(results).toHaveLength(1);
    expect(condition.getWaitingCount()).toBe(1);

    condition.signal();
    await Promise.all([waiter1, waiter2]);

    expect(results).toHaveLength(2);
    expect(condition.getWaitingCount()).toBe(0);
  });

  it('should signal all waiting threads', async () => {
    const results: number[] = [];

    const waiters = [
      condition.wait().then(() => results.push(1)),
      condition.wait().then(() => results.push(2)),
      condition.wait().then(() => results.push(3)),
    ];

    expect(condition.getWaitingCount()).toBe(3);

    condition.signalAll();
    await Promise.all(waiters);

    expect(results).toHaveLength(3);
    expect(condition.getWaitingCount()).toBe(0);
  });
});

describe('WorkerPool', () => {
  let workerPool: WorkerPool<number, number>;

  beforeEach(() => {
    workerPool = new WorkerPool(2, async (input: number) => input * 2);
  });

  afterEach(async () => {
    await workerPool.shutdown();
  });

  it('should process tasks in parallel', async () => {
    const startTime = Date.now();
    
    const tasks = [1, 2, 3, 4, 5].map(n => workerPool.execute(n));
    const results = await Promise.all(tasks);

    const endTime = Date.now();

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(endTime - startTime).toBeLessThan(300); // Should be faster than sequential
  });

  it('should handle task errors', async () => {
    const errorPool = new WorkerPool<number, number>(2, async (input: number) => {
      if (input === 3) throw new Error('Test error');
      return input * 2;
    });

    try {
      const results = await Promise.allSettled([
        errorPool.execute(1),
        errorPool.execute(2),
        errorPool.execute(3),
        errorPool.execute(4),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('rejected');
      expect(results[3].status).toBe('fulfilled');

      if (results[2].status === 'rejected') {
        expect(results[2].reason.message).toBe('Test error');
      }
    } finally {
      await errorPool.shutdown();
    }
  });

  it('should provide pool statistics', async () => {
    const stats = workerPool.getStats();
    
    expect(stats.maxWorkers).toBe(2);
    expect(stats.activeWorkers).toBe(0);
    expect(stats.activeTasks).toBe(0);
    expect(stats.queuedTasks).toBe(0);
  });

  it('should reject tasks after shutdown', async () => {
    await workerPool.shutdown();

    await expect(workerPool.execute(1)).rejects.toThrow('WorkerPool is shutdown');
  });

  it('should execute multiple tasks efficiently', async () => {
    const inputs = Array.from({ length: 10 }, (_, i) => i + 1);
    const results = await workerPool.executeAll(inputs);

    expect(results).toEqual(inputs.map(n => n * 2));
  });
});

describe('ResourcePool', () => {
  let resourcePool: ResourcePool<string>;
  let resourceCounter = 0;

  beforeEach(() => {
    resourceCounter = 0;
    resourcePool = new ResourcePool(
      () => `resource-${++resourceCounter}`,
      2
    );
  });

  afterEach(async () => {
    await resourcePool.drain();
  });

  it('should manage resource lifecycle', async () => {
    const resource1 = await resourcePool.acquire();
    expect(resource1).toBe('resource-1');

    const resource2 = await resourcePool.acquire();
    expect(resource2).toBe('resource-2');

    resourcePool.release(resource1);
    resourcePool.release(resource2);

    const stats = resourcePool.getStats();
    expect(stats.available).toBe(2);
    expect(stats.inUse).toBe(0);
  });

  it('should limit resource creation', async () => {
    const resource1 = await resourcePool.acquire();
    const resource2 = await resourcePool.acquire();

    // This should wait since we're at the limit
    const resource3Promise = resourcePool.acquire();

    let stats = resourcePool.getStats();
    expect(stats.inUse).toBe(2);
    expect(stats.waiting).toBe(1);

    resourcePool.release(resource1);
    const resource3 = await resource3Promise;

    expect(resource3).toBe(resource1); // Should reuse the released resource

    resourcePool.release(resource2);
    resourcePool.release(resource3);
  });

  it('should work with withResource pattern', async () => {
    const result = await resourcePool.withResource(async (resource) => {
      expect(resource).toBe('resource-1');
      return 'processed';
    });

    expect(result).toBe('processed');

    const stats = resourcePool.getStats();
    expect(stats.inUse).toBe(0);
    expect(stats.available).toBe(1);
  });

  it('should handle resource creation errors', async () => {
    const errorPool = new ResourcePool<string>(
      () => {
        throw new Error('Resource creation failed');
      },
      1
    );

    await expect(errorPool.acquire()).rejects.toThrow('Resource creation failed');
    await errorPool.drain();
  });

  it('should handle release of non-existent resource', () => {
    expect(() => resourcePool.release('unknown')).toThrow('Resource not in use');
  });
});

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(2, 1); // 2 tokens, 1 token per second
  });

  it('should allow operations within rate limit', async () => {
    const startTime = Date.now();

    await rateLimiter.acquire();
    await rateLimiter.acquire();

    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(100); // Should be immediate
  });

  it('should throttle operations exceeding rate limit', async () => {
    const results: number[] = [];

    const tasks = [
      rateLimiter.withRateLimit(async () => results.push(1)),
      rateLimiter.withRateLimit(async () => results.push(2)),
      rateLimiter.withRateLimit(async () => results.push(3)),
    ];

    await Promise.all(tasks);

    expect(results).toEqual([1, 2, 3]);
    expect(rateLimiter.getWaitingCount()).toBe(0);
  });

  it('should track available tokens', () => {
    expect(rateLimiter.getAvailableTokens()).toBe(2);
    
    // Note: We can't easily test token refill without waiting
    // or mocking timers, so we'll keep this test simple
  });
});

describe('ConcurrencyManager', () => {
  let manager: ConcurrencyManager;

  beforeEach(() => {
    manager = new ConcurrencyManager();
  });

  it('should provide named mutexes', async () => {
    const mutex1 = manager.getMutex('test');
    const mutex2 = manager.getMutex('test');

    expect(mutex1).toBe(mutex2); // Should return same instance

    const result = await manager.withMutex('test', async () => {
      return 'locked';
    });

    expect(result).toBe('locked');
  });

  it('should provide named read-write locks', async () => {
    const lock1 = manager.getReadWriteLock('test');
    const lock2 = manager.getReadWriteLock('test');

    expect(lock1).toBe(lock2);

    const readResult = await manager.withReadLock('test', async () => {
      return 'read';
    });

    const writeResult = await manager.withWriteLock('test', async () => {
      return 'write';
    });

    expect(readResult).toBe('read');
    expect(writeResult).toBe('write');
  });

  it('should provide named semaphores', async () => {
    const semaphore1 = manager.getSemaphore('test', 2);
    const semaphore2 = manager.getSemaphore('test', 3); // Should return existing with original permits

    expect(semaphore1).toBe(semaphore2);

    const result = await manager.withSemaphore('test', 2, async () => {
      return 'permitted';
    });

    expect(result).toBe('permitted');
  });

  it('should provide statistics', () => {
    manager.getMutex('mutex1');
    manager.getMutex('mutex2');
    manager.getReadWriteLock('lock1');
    manager.getSemaphore('sem1', 3);

    const stats = manager.getStats();

    expect(stats.mutexes).toHaveLength(2);
    expect(stats.locks).toHaveLength(1);
    expect(stats.semaphores).toHaveLength(1);

    expect(stats.mutexes[0].name).toBe('mutex1');
    expect(stats.mutexes[1].name).toBe('mutex2');
    expect(stats.locks[0].name).toBe('lock1');
    expect(stats.semaphores[0].name).toBe('sem1');
  });
});

describe('Global ConcurrencyManager', () => {
  it('should provide global instance', () => {
    expect(globalConcurrencyManager).toBeInstanceOf(ConcurrencyManager);
  });

  it('should maintain state across calls', async () => {
    const result1 = await globalConcurrencyManager.withMutex('global-test', async () => {
      return 'first';
    });

    const result2 = await globalConcurrencyManager.withMutex('global-test', async () => {
      return 'second';
    });

    expect(result1).toBe('first');
    expect(result2).toBe('second');
  });
});

describe('Concurrency Edge Cases', () => {
  it('should handle rapid acquire/release cycles', async () => {
    const mutex = new Mutex();
    const results: number[] = [];

    const operations = Array.from({ length: 100 }, (_, i) =>
      mutex.withLock(async () => {
        results.push(i);
      })
    );

    await Promise.all(operations);

    expect(results).toHaveLength(100);
    expect(new Set(results).size).toBe(100); // All unique
    expect(mutex.isLocked()).toBe(false);
    expect(mutex.getWaitingCount()).toBe(0);
  });

  it('should handle mixed concurrent operations', async () => {
    const lock = new ReadWriteLock();
    const results: string[] = [];

    const operations = [
      lock.withReadLock(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push('read1');
      }),
      lock.withReadLock(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push('read2');
      }),
      lock.withWriteLock(async () => {
        results.push('write1');
      }),
      lock.withReadLock(async () => {
        results.push('read3');
      }),
    ];

    await Promise.all(operations);

    expect(results).toHaveLength(4);
    expect(results).toContain('read1');
    expect(results).toContain('read2');
    expect(results).toContain('write1');
    expect(results).toContain('read3');

    // Write should be after all reads that started before it
    const write1Index = results.indexOf('write1');
    const read1Index = results.indexOf('read1');
    const read2Index = results.indexOf('read2');
    
    expect(write1Index).toBeGreaterThan(Math.max(read1Index, read2Index));
  });

  it('should handle worker pool with varying task durations', async () => {
    const workerPool = new WorkerPool<number, number>(3, async (input: number) => {
      await new Promise(resolve => setTimeout(resolve, input * 10));
      return input;
    });

    try {
      const tasks = [5, 1, 3, 2, 4].map(n => workerPool.execute(n));
      const results = await Promise.all(tasks);

      expect(results).toEqual([5, 1, 3, 2, 4]);
    } finally {
      await workerPool.shutdown();
    }
  });
});