/**
 * Tests for IndexedDataStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { IndexedDataStore, createIndexedDataStore } from '../../src/optimization/dataStore';

describe('IndexedDataStore', () => {
  let tempDir: string;
  let store: IndexedDataStore<any>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tw-enigma-datastore-test-'));
    store = createIndexedDataStore({
      dataDirectory: tempDir,
      enableMemoryIndex: true,
      enableAsyncWrites: false, // Disable for deterministic testing
      enableWAL: false, // Disable for simpler testing
    });
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', number: 42 };

      await store.put(key, value);
      const retrieved = await store.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete keys', async () => {
      const key = 'delete-test';
      const value = { data: 'to-be-deleted' };

      await store.put(key, value);
      expect(await store.get(key)).toEqual(value);

      const deleted = await store.delete(key);
      expect(deleted).toBe(true);
      expect(await store.get(key)).toBeNull();
    });

    it('should handle deleting non-existent keys', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });

    it('should update existing values with new versions', async () => {
      const key = 'version-test';
      const value1 = { version: 1 };
      const value2 = { version: 2 };

      await store.put(key, value1);
      await store.put(key, value2);

      const retrieved = await store.get(key);
      expect(retrieved).toEqual(value2);
    });
  });

  describe('Batch Operations', () => {
    it('should execute batch operations', async () => {
      const operations = [
        { type: 'put' as const, key: 'batch1', value: { data: 'batch-value-1' } },
        { type: 'put' as const, key: 'batch2', value: { data: 'batch-value-2' } },
        { type: 'put' as const, key: 'batch3', value: { data: 'batch-value-3' } },
      ];

      await store.batch(operations);

      for (const op of operations) {
        const retrieved = await store.get(op.key);
        expect(retrieved).toEqual(op.value);
      }
    });

    it('should handle mixed batch operations', async () => {
      // First, put some values
      await store.put('batch-mixed-1', { data: 'initial' });
      await store.put('batch-mixed-2', { data: 'to-delete' });

      const operations = [
        { type: 'put' as const, key: 'batch-mixed-1', value: { data: 'updated' } },
        { type: 'delete' as const, key: 'batch-mixed-2' },
        { type: 'put' as const, key: 'batch-mixed-3', value: { data: 'new' } },
      ];

      await store.batch(operations);

      expect(await store.get('batch-mixed-1')).toEqual({ data: 'updated' });
      expect(await store.get('batch-mixed-2')).toBeNull();
      expect(await store.get('batch-mixed-3')).toEqual({ data: 'new' });
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Set up test data
      const testData = [
        { key: 'user:1', value: { name: 'Alice', age: 30 } },
        { key: 'user:2', value: { name: 'Bob', age: 25 } },
        { key: 'user:3', value: { name: 'Charlie', age: 35 } },
        { key: 'post:1', value: { title: 'First Post', author: 'Alice' } },
        { key: 'post:2', value: { title: 'Second Post', author: 'Bob' } },
      ];

      for (const { key, value } of testData) {
        await store.put(key, value);
      }
    });

    it('should query with prefix filter', async () => {
      const results = await store.query({ prefix: 'user:' });
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.key.startsWith('user:'))).toBe(true);
    });

    it('should apply limit and offset', async () => {
      const results = await store.query({ limit: 2, offset: 1 });
      
      expect(results).toHaveLength(2);
    });

    it('should sort by key', async () => {
      const results = await store.query({ 
        prefix: 'user:', 
        sortBy: 'key', 
        sortOrder: 'asc' 
      });
      
      expect(results).toHaveLength(3);
      expect(results[0].key).toBe('user:1');
      expect(results[1].key).toBe('user:2');
      expect(results[2].key).toBe('user:3');
    });

    it('should include metadata when requested', async () => {
      const results = await store.query({ 
        prefix: 'user:', 
        includeMetadata: true 
      });
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.metadata).toBeDefined();
        expect(result.metadata.timestamp).toBeTypeOf('number');
        expect(result.metadata.version).toBeTypeOf('number');
      });
    });
  });

  describe('Snapshot and Diff Operations', () => {
    it('should create snapshots', async () => {
      await store.put('snap1', { data: 'snapshot-data-1' });
      await store.put('snap2', { data: 'snapshot-data-2' });

      const snapshot = await store.createSnapshot();
      
      expect(snapshot.size).toBe(2);
      expect(snapshot.get('snap1')).toEqual({ data: 'snapshot-data-1' });
      expect(snapshot.get('snap2')).toEqual({ data: 'snapshot-data-2' });
    });

    it('should compute diffs between snapshots', async () => {
      // Create initial state
      await store.put('same', { data: 'unchanged' });
      await store.put('modify', { data: 'original' });
      await store.put('delete', { data: 'to-be-deleted' });

      const oldSnapshot = await store.createSnapshot();

      // Modify state
      await store.put('modify', { data: 'modified' });
      await store.delete('delete');
      await store.put('add', { data: 'newly-added' });

      const newSnapshot = await store.createSnapshot();

      const diff = await store.diff(oldSnapshot, newSnapshot);

      expect(diff.added).toHaveLength(1);
      expect(diff.added[0].key).toBe('add');
      
      expect(diff.modified).toHaveLength(1);
      expect(diff.modified[0].key).toBe('modify');
      
      expect(diff.deleted).toHaveLength(1);
      expect(diff.deleted[0].key).toBe('delete');
      
      expect(diff.unchanged).toHaveLength(1);
      expect(diff.unchanged[0].key).toBe('same');
    });
  });

  describe('Transaction Support', () => {
    it('should support transactions', async () => {
      const txId = store.beginTransaction();
      
      expect(typeof txId).toBe('string');
      
      await store.commitTransaction(txId);
    });

    it('should abort transactions', async () => {
      const txId = store.beginTransaction();
      
      store.abortTransaction(txId);
      
      // Should not throw
    });
  });

  describe('Performance and Metrics', () => {
    it('should provide performance metrics', async () => {
      await store.put('metrics-test', { data: 'test' });
      await store.get('metrics-test');

      const metrics = store.getMetrics();
      
      expect(metrics).toHaveProperty('totalKeys');
      expect(metrics).toHaveProperty('totalSize');
      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics.totalKeys).toBeGreaterThan(0);
    });
  });

  describe('Compaction', () => {
    it('should compact the store', async () => {
      // Add some data
      for (let i = 0; i < 10; i++) {
        await store.put(`compact-test-${i}`, { index: i });
      }

      // Compact
      await store.compact();

      // Verify data integrity
      for (let i = 0; i < 10; i++) {
        const value = await store.get(`compact-test-${i}`);
        expect(value).toEqual({ index: i });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent operations gracefully', async () => {
      const promises = [];
      
      // Create multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        promises.push(store.put(`concurrent-${i}`, { index: i }));
      }

      await Promise.all(promises);

      // Verify all data was stored
      for (let i = 0; i < 10; i++) {
        const value = await store.get(`concurrent-${i}`);
        expect(value).toEqual({ index: i });
      }
    });

    it('should handle large values', async () => {
      const largeValue = {
        data: 'x'.repeat(10000),
        array: Array(1000).fill({ nested: 'value' }),
      };

      await store.put('large-value', largeValue);
      const retrieved = await store.get('large-value');
      
      expect(retrieved).toEqual(largeValue);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration on creation', async () => {
      expect(() => {
        createIndexedDataStore({
          batchSize: 0, // Invalid
        });
      }).toThrow();
    });

    it('should use default configuration values', async () => {
      const defaultStore = createIndexedDataStore();
      
      // Should not throw
      await defaultStore.initialize();
      await defaultStore.close();
    });
  });

  describe('Memory Management', () => {
    it('should manage memory cache effectively', async () => {
      const store = createIndexedDataStore({
        dataDirectory: tempDir + '/memory-test',
        enableMemoryIndex: true,
      });

      await store.initialize();

      try {
        // Fill cache
        for (let i = 0; i < 100; i++) {
          await store.put(`cache-${i}`, { data: `cached-data-${i}` });
        }

        // Access some items to update LRU
        for (let i = 0; i < 50; i++) {
          await store.get(`cache-${i}`);
        }

        const metrics = store.getMetrics();
        expect(metrics.totalKeys).toBe(100);
      } finally {
        await store.close();
      }
    });
  });
});