/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Mutex implementation for critical section protection
 */
export class Mutex {
  private locked = false;
  private waitQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  /**
   * Acquire the mutex lock
   */
  public async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.waitQueue.push({ resolve, reject });
      }
    });
  }

  /**
   * Release the mutex lock
   */
  public release(): void {
    if (!this.locked) {
      throw new Error('Mutex is not locked');
    }

    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next.resolve();
    } else {
      this.locked = false;
    }
  }

  /**
   * Execute a function with mutex protection
   */
  public async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Check if mutex is currently locked
   */
  public isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get number of waiting operations
   */
  public getWaitingCount(): number {
    return this.waitQueue.length;
  }
}

/**
 * Read-Write lock for concurrent read access with exclusive write access
 */
export class ReadWriteLock {
  private readers = 0;
  private writer = false;
  private readQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  private writeQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  /**
   * Acquire read lock
   */
  public async acquireRead(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.writer && this.writeQueue.length === 0) {
        this.readers++;
        resolve();
      } else {
        this.readQueue.push({ resolve, reject });
      }
    });
  }

  /**
   * Release read lock
   */
  public releaseRead(): void {
    if (this.readers <= 0) {
      throw new Error('No active readers');
    }

    this.readers--;
    
    // If no more readers and there's a waiting writer, grant write access
    if (this.readers === 0 && this.writeQueue.length > 0) {
      const next = this.writeQueue.shift()!;
      this.writer = true;
      next.resolve();
    }
  }

  /**
   * Acquire write lock
   */
  public async acquireWrite(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.writer && this.readers === 0) {
        this.writer = true;
        resolve();
      } else {
        this.writeQueue.push({ resolve, reject });
      }
    });
  }

  /**
   * Release write lock
   */
  public releaseWrite(): void {
    if (!this.writer) {
      throw new Error('No active writer');
    }

    this.writer = false;

    // Grant access to all waiting readers, or next writer if no readers
    if (this.readQueue.length > 0) {
      const readersToGrant = [...this.readQueue];
      this.readQueue.length = 0;
      this.readers = readersToGrant.length;
      readersToGrant.forEach(reader => reader.resolve());
    } else if (this.writeQueue.length > 0) {
      const next = this.writeQueue.shift()!;
      this.writer = true;
      next.resolve();
    }
  }

  /**
   * Execute a function with read lock
   */
  public async withReadLock<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquireRead();
    try {
      return await fn();
    } finally {
      this.releaseRead();
    }
  }

  /**
   * Execute a function with write lock
   */
  public async withWriteLock<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquireWrite();
    try {
      return await fn();
    } finally {
      this.releaseWrite();
    }
  }

  /**
   * Get lock status
   */
  public getStatus(): { readers: number; writer: boolean; readQueue: number; writeQueue: number } {
    return {
      readers: this.readers,
      writer: this.writer,
      readQueue: this.readQueue.length,
      writeQueue: this.writeQueue.length,
    };
  }
}

/**
 * Semaphore for limiting concurrent access
 */
export class Semaphore {
  private permits: number;
  private maxPermits: number;
  private waitQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  constructor(maxPermits: number) {
    this.maxPermits = maxPermits;
    this.permits = maxPermits;
  }

  /**
   * Acquire a permit
   */
  public async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push({ resolve, reject });
      }
    });
  }

  /**
   * Release a permit
   */
  public release(): void {
    if (this.permits >= this.maxPermits) {
      throw new Error('Cannot release more permits than maximum');
    }

    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next.resolve();
    } else {
      this.permits++;
    }
  }

  /**
   * Execute a function with semaphore protection
   */
  public async withPermit<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get available permits
   */
  public getAvailablePermits(): number {
    return this.permits;
  }

  /**
   * Get waiting count
   */
  public getWaitingCount(): number {
    return this.waitQueue.length;
  }
}

/**
 * Condition variable for coordinating between threads
 */
export class ConditionVariable {
  private waitQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  /**
   * Wait for condition to be signaled
   */
  public async wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.waitQueue.push({ resolve, reject });
    });
  }

  /**
   * Signal one waiting thread
   */
  public signal(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next.resolve();
    }
  }

  /**
   * Signal all waiting threads
   */
  public signalAll(): void {
    const waitersToSignal = [...this.waitQueue];
    this.waitQueue.length = 0;
    waitersToSignal.forEach(waiter => waiter.resolve());
  }

  /**
   * Get number of waiting threads
   */
  public getWaitingCount(): number {
    return this.waitQueue.length;
  }
}

/**
 * Concurrent worker pool for parallel task execution
 */
export class WorkerPool<TInput, TOutput> {
  private workers: Array<Promise<void>> = [];
  private taskQueue: Array<{
    input: TInput;
    resolve: (result: TOutput) => void;
    reject: (error: Error) => void;
  }> = [];
  private isShutdown = false;
  private activeTasks = 0;

  constructor(
    private maxWorkers: number,
    private taskProcessor: (input: TInput) => Promise<TOutput>
  ) {}

  /**
   * Submit a task for execution
   */
  public async execute(input: TInput): Promise<TOutput> {
    if (this.isShutdown) {
      throw new Error('WorkerPool is shutdown');
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ input, resolve, reject });
      this.scheduleWorker();
    });
  }

  /**
   * Execute multiple tasks in parallel
   */
  public async executeAll(inputs: TInput[]): Promise<TOutput[]> {
    const promises = inputs.map(input => this.execute(input));
    return Promise.all(promises);
  }

  /**
   * Get pool statistics
   */
  public getStats(): {
    activeWorkers: number;
    queuedTasks: number;
    activeTasks: number;
    maxWorkers: number;
  } {
    return {
      activeWorkers: this.workers.length,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTasks,
      maxWorkers: this.maxWorkers,
    };
  }

  /**
   * Shutdown the worker pool
   */
  public async shutdown(): Promise<void> {
    this.isShutdown = true;
    
    // Reject all queued tasks
    const queuedTasks = [...this.taskQueue];
    this.taskQueue.length = 0;
    queuedTasks.forEach(task => {
      task.reject(new Error('WorkerPool shutdown'));
    });

    // Wait for all active workers to complete
    await Promise.all(this.workers);
  }

  private scheduleWorker(): void {
    if (this.workers.length < this.maxWorkers && this.taskQueue.length > 0) {
      const worker = this.createWorker();
      this.workers.push(worker);
    }
  }

  private async createWorker(): Promise<void> {
    while (!this.isShutdown && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;

      this.activeTasks++;
      try {
        const result = await this.taskProcessor(task.input);
        task.resolve(result);
      } catch (error) {
        task.reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        this.activeTasks--;
      }
    }

    // Remove this worker from the pool
    const index = this.workers.indexOf(this.createWorker as any);
    if (index >= 0) {
      this.workers.splice(index, 1);
    }
  }
}

/**
 * Resource pool for managing limited resources
 */
export class ResourcePool<T> {
  private resources: T[] = [];
  private waitQueue: Array<{ resolve: (resource: T) => void; reject: (error: Error) => void }> = [];
  private inUse: Set<T> = new Set();

  constructor(private factory: () => T | Promise<T>, private maxSize: number) {}

  /**
   * Acquire a resource from the pool
   */
  public async acquire(): Promise<T> {
    return new Promise(async (resolve, reject) => {
      // Check if there's an available resource
      if (this.resources.length > 0) {
        const resource = this.resources.pop()!;
        this.inUse.add(resource);
        resolve(resource);
        return;
      }

      // Create new resource if under limit
      if (this.inUse.size < this.maxSize) {
        try {
          const resource = await this.factory();
          this.inUse.add(resource);
          resolve(resource);
          return;
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
      }

      // Wait for resource to become available
      this.waitQueue.push({ resolve, reject });
    });
  }

  /**
   * Release a resource back to the pool
   */
  public release(resource: T): void {
    if (!this.inUse.has(resource)) {
      throw new Error('Resource not in use');
    }

    this.inUse.delete(resource);

    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      this.inUse.add(resource);
      next.resolve(resource);
    } else {
      this.resources.push(resource);
    }
  }

  /**
   * Execute a function with a resource
   */
  public async withResource<TResult>(fn: (resource: T) => Promise<TResult> | TResult): Promise<TResult> {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      this.release(resource);
    }
  }

  /**
   * Get pool statistics
   */
  public getStats(): {
    available: number;
    inUse: number;
    waiting: number;
    maxSize: number;
  } {
    return {
      available: this.resources.length,
      inUse: this.inUse.size,
      waiting: this.waitQueue.length,
      maxSize: this.maxSize,
    };
  }

  /**
   * Drain all resources from the pool
   */
  public async drain(): Promise<void> {
    // Wait for all resources to be returned
    while (this.inUse.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Clear available resources
    this.resources.length = 0;

    // Reject all waiting requests
    const waiters = [...this.waitQueue];
    this.waitQueue.length = 0;
    waiters.forEach(waiter => {
      waiter.reject(new Error('Resource pool drained'));
    });
  }
}

/**
 * Concurrent rate limiter
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private waitQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
    private refillInterval: number = 1000 // ms
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.startRefillTimer();
  }

  /**
   * Acquire a token
   */
  public async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.refillTokens();

      if (this.tokens > 0) {
        this.tokens--;
        resolve();
      } else {
        this.waitQueue.push({ resolve, reject });
      }
    });
  }

  /**
   * Execute a function with rate limiting
   */
  public async withRateLimit<T>(fn: () => Promise<T> | T): Promise<T> {
    await this.acquire();
    return fn();
  }

  /**
   * Get available tokens
   */
  public getAvailableTokens(): number {
    this.refillTokens();
    return this.tokens;
  }

  /**
   * Get waiting count
   */
  public getWaitingCount(): number {
    return this.waitQueue.length;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 1000) * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;

      // Process waiting queue
      while (this.tokens > 0 && this.waitQueue.length > 0) {
        const next = this.waitQueue.shift()!;
        this.tokens--;
        next.resolve();
      }
    }
  }

  private startRefillTimer(): void {
    setInterval(() => {
      this.refillTokens();
    }, this.refillInterval);
  }
}

/**
 * Utility class for creating concurrent-safe operations
 */
export class ConcurrencyManager {
  private mutexes: Map<string, Mutex> = new Map();
  private readWriteLocks: Map<string, ReadWriteLock> = new Map();
  private semaphores: Map<string, Semaphore> = new Map();

  /**
   * Get or create a named mutex
   */
  public getMutex(name: string): Mutex {
    if (!this.mutexes.has(name)) {
      this.mutexes.set(name, new Mutex());
    }
    return this.mutexes.get(name)!;
  }

  /**
   * Get or create a named read-write lock
   */
  public getReadWriteLock(name: string): ReadWriteLock {
    if (!this.readWriteLocks.has(name)) {
      this.readWriteLocks.set(name, new ReadWriteLock());
    }
    return this.readWriteLocks.get(name)!;
  }

  /**
   * Get or create a named semaphore
   */
  public getSemaphore(name: string, permits: number): Semaphore {
    if (!this.semaphores.has(name)) {
      this.semaphores.set(name, new Semaphore(permits));
    }
    return this.semaphores.get(name)!;
  }

  /**
   * Execute a function with mutex protection
   */
  public async withMutex<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const mutex = this.getMutex(name);
    return mutex.withLock(fn);
  }

  /**
   * Execute a function with read lock
   */
  public async withReadLock<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const lock = this.getReadWriteLock(name);
    return lock.withReadLock(fn);
  }

  /**
   * Execute a function with write lock
   */
  public async withWriteLock<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const lock = this.getReadWriteLock(name);
    return lock.withWriteLock(fn);
  }

  /**
   * Execute a function with semaphore permit
   */
  public async withSemaphore<T>(name: string, permits: number, fn: () => Promise<T> | T): Promise<T> {
    const semaphore = this.getSemaphore(name, permits);
    return semaphore.withPermit(fn);
  }

  /**
   * Get statistics for all managed concurrency primitives
   */
  public getStats(): {
    mutexes: Array<{ name: string; locked: boolean; waiting: number }>;
    locks: Array<{ name: string; status: any }>;
    semaphores: Array<{ name: string; available: number; waiting: number }>;
  } {
    return {
      mutexes: Array.from(this.mutexes.entries()).map(([name, mutex]) => ({
        name,
        locked: mutex.isLocked(),
        waiting: mutex.getWaitingCount(),
      })),
      locks: Array.from(this.readWriteLocks.entries()).map(([name, lock]) => ({
        name,
        status: lock.getStatus(),
      })),
      semaphores: Array.from(this.semaphores.entries()).map(([name, semaphore]) => ({
        name,
        available: semaphore.getAvailablePermits(),
        waiting: semaphore.getWaitingCount(),
      })),
    };
  }
}

// Global concurrency manager instance
export const globalConcurrencyManager = new ConcurrencyManager();