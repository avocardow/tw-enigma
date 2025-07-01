/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger('AtomicOpManager');

/**
 * Lock types for different operations
 */
export enum LockType {
  READ = 'read',
  WRITE = 'write',
  EXCLUSIVE = 'exclusive',
}

/**
 * Lock request structure
 */
export interface LockRequest {
  id: string;
  type: LockType;
  resource: string;
  timeout: number;
  created: Date;
  owner: string;
}

/**
 * Lock manager for atomic operations
 */
class LockManager {
  private activeLocks: Map<string, LockRequest> = new Map();
  private lockQueue: Map<string, LockRequest[]> = new Map();
  private lockWaiters: Map<
    string,
    Array<{ resolve: (value: string) => void; reject: (reason?: any) => void }>
  > = new Map();

  /**
   * Acquire a lock for a resource
   */
  async acquireLock(
    resource: string,
    type: LockType,
    timeout = 5000,
    owner = 'default'
  ): Promise<string> {
    const lockId = `${resource}:${type}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

    const request: LockRequest = {
      id: lockId,
      type,
      resource,
      timeout,
      created: new Date(),
      owner,
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeLockRequest(lockId);
        reject(new Error(`Lock timeout for resource ${resource} after ${timeout}ms`));
      }, timeout);

      const tryAcquire = () => {
        if (this.canAcquireLock(resource, type)) {
          this.activeLocks.set(lockId, request);
          clearTimeout(timeoutId);
          logger.debug('Lock acquired', { lockId, resource, type, owner });
          resolve(lockId);
        } else {
          // Add to queue
          if (!this.lockQueue.has(resource)) {
            this.lockQueue.set(resource, []);
          }
          this.lockQueue.get(resource)!.push(request);

          if (!this.lockWaiters.has(lockId)) {
            this.lockWaiters.set(lockId, []);
          }
          this.lockWaiters.get(lockId)!.push({ resolve, reject });
        }
      };

      tryAcquire();
    });
  }

  /**
   * Release a lock
   */
  releaseLock(lockId: string): void {
    const lock = this.activeLocks.get(lockId);
    if (!lock) {
      logger.warn('Attempted to release non-existent lock', { lockId });
      return;
    }

    this.activeLocks.delete(lockId);
    logger.debug('Lock released', { lockId, resource: lock.resource, type: lock.type });

    // Process queue for this resource
    this.processLockQueue(lock.resource);
  }

  /**
   * Check if a lock can be acquired
   */
  private canAcquireLock(resource: string, type: LockType): boolean {
    const existingLocks = Array.from(this.activeLocks.values()).filter(
      (l) => l.resource === resource
    );

    if (existingLocks.length === 0) {
      return true;
    }

    // Exclusive locks cannot coexist with any other locks
    if (type === LockType.EXCLUSIVE || existingLocks.some((l) => l.type === LockType.EXCLUSIVE)) {
      return false;
    }

    // Write locks cannot coexist with read or write locks
    if (type === LockType.WRITE || existingLocks.some((l) => l.type === LockType.WRITE)) {
      return false;
    }

    // Multiple read locks can coexist
    return type === LockType.READ && existingLocks.every((l) => l.type === LockType.READ);
  }

  /**
   * Process queued lock requests for a resource
   */
  private processLockQueue(resource: string): void {
    const queue = this.lockQueue.get(resource);
    if (!queue || queue.length === 0) {
      return;
    }

    const processed: string[] = [];

    for (const request of queue) {
      if (this.canAcquireLock(resource, request.type)) {
        this.activeLocks.set(request.id, request);
        processed.push(request.id);

        // Resolve waiting promises
        const waiters = this.lockWaiters.get(request.id);
        if (waiters) {
          waiters.forEach(({ resolve }) => resolve(request.id));
          this.lockWaiters.delete(request.id);
        }

        logger.debug('Queued lock acquired', {
          lockId: request.id,
          resource: request.resource,
          type: request.type,
        });
      }
    }

    // Remove processed requests from queue
    if (processed.length > 0) {
      this.lockQueue.set(
        resource,
        queue.filter((r) => !processed.includes(r.id))
      );
    }
  }

  /**
   * Remove a lock request from queue
   */
  private removeLockRequest(lockId: string): void {
    // Remove from all queues
    for (const [resource, queue] of this.lockQueue.entries()) {
      const filtered = queue.filter((r) => r.id !== lockId);
      this.lockQueue.set(resource, filtered);
    }

    // Remove waiters
    this.lockWaiters.delete(lockId);
  }

  /**
   * Get lock statistics
   */
  getStats(): { activeLocks: number; queuedLocks: number; resources: string[] } {
    const queuedCount = Array.from(this.lockQueue.values()).reduce(
      (sum, queue) => sum + queue.length,
      0
    );
    const resources = Array.from(
      new Set([
        ...Array.from(this.activeLocks.values()).map((l) => l.resource),
        ...Array.from(this.lockQueue.keys()),
      ])
    );

    return {
      activeLocks: this.activeLocks.size,
      queuedLocks: queuedCount,
      resources,
    };
  }

  /**
   * Force release all locks (emergency cleanup)
   */
  forceReleaseAll(): void {
    logger.warn('Force releasing all locks');
    this.activeLocks.clear();
    this.lockQueue.clear();
    this.lockWaiters.clear();
  }
}

/**
 * Atomic operation execution context
 */
export interface AtomicContext<T = any> {
  id: string;
  operation: string;
  data: T;
  lockIds: string[];
  startTime: Date;
  timeout: number;
  retryCount: number;
  maxRetries: number;
}

/**
 * Atomic operation manager for ensuring race-condition-free updates
 */
export class AtomicOpManager extends EventEmitter {
  private lockManager = new LockManager();
  private activeOperations: Map<string, AtomicContext> = new Map();
  private operationHistory: AtomicContext[] = [];
  private maxHistorySize = 1000;

  /**
   * Execute an atomic operation with proper locking
   */
  async executeAtomic<T, R>(
    operation: string,
    resources: string[],
    lockTypes: LockType[],
    operation_fn: (context: AtomicContext<T>, data: T) => Promise<R>,
    data: T,
    options: {
      timeout?: number;
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ): Promise<R> {
    const { timeout = 10000, maxRetries = 3, retryDelay = 1000 } = options;

    const contextId = `atomic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const context: AtomicContext<T> = {
          id: contextId,
          operation,
          data,
          lockIds: [],
          startTime: new Date(),
          timeout,
          retryCount: attempt,
          maxRetries,
        };

        this.activeOperations.set(contextId, context);

        logger.debug('Starting atomic operation', {
          contextId,
          operation,
          resources,
          attempt: attempt + 1,
          maxRetries,
        });

        // Acquire all required locks
        for (let i = 0; i < resources.length; i++) {
          const resource = resources[i];
          const lockType = lockTypes[i] || LockType.EXCLUSIVE;

          const lockId = await this.lockManager.acquireLock(resource, lockType, timeout, contextId);

          context.lockIds.push(lockId);
        }

        try {
          // Execute the operation
          const result = await operation_fn(context, data);

          logger.debug('Atomic operation completed successfully', {
            contextId,
            operation,
            duration: Date.now() - context.startTime.getTime(),
          });

          // Add to history
          this.addToHistory(context);

          this.emit('operation_success', { contextId, operation, result });

          return result;
        } finally {
          // Release all locks
          context.lockIds.forEach((lockId) => this.lockManager.releaseLock(lockId));
          this.activeOperations.delete(contextId);
        }
      } catch (error) {
        attempt++;

        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.warn('Atomic operation failed', {
          contextId,
          operation,
          attempt,
          maxRetries,
          error: errorMessage,
        });

        if (attempt >= maxRetries) {
          this.emit('operation_failure', { contextId, operation, error, attempts: attempt });
          throw new Error(`Atomic operation failed after ${maxRetries} attempts: ${errorMessage}`);
        }

        // Wait before retry
        if (retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw new Error('Atomic operation failed to complete');
  }

  /**
   * Execute a read-only operation with shared locking
   */
  async executeReadOnly<T, R>(
    operation: string,
    resources: string[],
    operation_fn: (data: T) => Promise<R>,
    data: T,
    timeout = 5000
  ): Promise<R> {
    return this.executeAtomic(
      operation,
      resources,
      resources.map(() => LockType.READ),
      async (_, operationData) => operation_fn(operationData),
      data,
      { timeout, maxRetries: 1 }
    );
  }

  /**
   * Execute a write operation with exclusive locking
   */
  async executeWrite<T, R>(
    operation: string,
    resources: string[],
    operation_fn: (context: AtomicContext<T>, data: T) => Promise<R>,
    data: T,
    options?: { timeout?: number; maxRetries?: number }
  ): Promise<R> {
    return this.executeAtomic(
      operation,
      resources,
      resources.map(() => LockType.EXCLUSIVE),
      operation_fn,
      data,
      options
    );
  }

  /**
   * Add operation to history for debugging
   */
  private addToHistory(context: AtomicContext): void {
    this.operationHistory.push({ ...context });

    // Trim history if too large
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory = this.operationHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    lockStats: { activeLocks: number; queuedLocks: number; resources: string[] };
    operationStats: { active: number; historySize: number };
  } {
    return {
      lockStats: this.lockManager.getStats(),
      operationStats: {
        active: this.activeOperations.size,
        historySize: this.operationHistory.length,
      },
    };
  }

  /**
   * Get operation history for debugging
   */
  getOperationHistory(limit = 50): AtomicContext[] {
    return this.operationHistory.slice(-limit);
  }

  /**
   * Emergency cleanup - force release all locks and clear operations
   */
  emergencyCleanup(): void {
    logger.error('Performing emergency cleanup of atomic operations');

    this.lockManager.forceReleaseAll();
    this.activeOperations.clear();

    this.emit('emergency_cleanup');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(timeout = 10000): Promise<void> {
    logger.info('Shutting down atomic operation manager');

    const startTime = Date.now();

    // Wait for active operations to complete
    while (this.activeOperations.size > 0 && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.activeOperations.size > 0) {
      logger.warn(`Force stopping ${this.activeOperations.size} active operations`);
      this.emergencyCleanup();
    }

    logger.info('Atomic operation manager shutdown complete');
  }
}

/**
 * Global singleton instance
 */
export const atomicOpManager = new AtomicOpManager();
