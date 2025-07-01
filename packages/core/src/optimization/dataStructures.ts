/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';

/**
 * Configuration schema for data structure optimization
 */
export const DataStructureConfigSchema = z.object({
  // Hash table configuration
  hashTable: z.object({
    initialCapacity: z.number().min(16).max(1048576).default(4096),
    loadFactorThreshold: z.number().min(0.1).max(0.95).default(0.75),
    maxEntries: z.number().min(1000).max(1000000).default(100000),
    enableRehashing: z.boolean().default(true),
    hashFunction: z.enum(['djb2', 'fnv1a', 'murmur3', 'xxhash']).default('fnv1a'),
  }).default({}),
  
  // B-tree configuration
  btree: z.object({
    order: z.number().min(3).max(1024).default(64),
    leafCapacity: z.number().min(16).max(4096).default(256),
    enableBulkLoading: z.boolean().default(true),
    splitStrategy: z.enum(['balanced', 'left-biased', 'right-biased']).default('balanced'),
  }).default({}),
  
  // Bloom filter configuration
  bloomFilter: z.object({
    expectedElements: z.number().min(1000).max(10000000).default(100000),
    falsePositiveRate: z.number().min(0.001).max(0.1).default(0.01),
    hashFunctions: z.number().min(1).max(16).default(7),
    enableCountingBloom: z.boolean().default(false),
  }).default({}),
  
  // Trie configuration
  trie: z.object({
    maxDepth: z.number().min(10).max(100).default(50),
    enableCompression: z.boolean().default(true),
    minSuffixLength: z.number().min(1).max(10).default(3),
    radixThreshold: z.number().min(2).max(32).default(8),
  }).default({}),
  
  // Skip list configuration
  skipList: z.object({
    maxLevel: z.number().min(8).max(32).default(16),
    probability: z.number().min(0.1).max(0.9).default(0.5),
    enableConcurrentAccess: z.boolean().default(true),
  }).default({}),
  
  // Cache configuration
  cache: z.object({
    strategy: z.enum(['lru', 'lfu', 'arc', 'clock', 'random']).default('arc'),
    maxSize: z.number().min(100).max(1000000).default(10000),
    ttlMs: z.number().min(1000).max(3600000).default(300000),
    enableMetrics: z.boolean().default(true),
  }).default({}),
  
  // Memory optimization
  memory: z.object({
    enableMemoryPressureHandling: z.boolean().default(true),
    gcThresholdMB: z.number().min(50).max(2048).default(256),
    enableObjectPooling: z.boolean().default(true),
    maxPoolSize: z.number().min(100).max(10000).default(1000),
  }).default({}),
  
  // Performance tuning
  performance: z.object({
    enablePrefetching: z.boolean().default(true),
    prefetchDistance: z.number().min(1).max(100).default(16),
    enableBatching: z.boolean().default(true),
    batchSize: z.number().min(10).max(10000).default(1000),
    enableCompression: z.boolean().default(false),
    compressionThreshold: z.number().min(100).max(10000).default(1000),
  }).default({}),
});

export type DataStructureConfig = z.infer<typeof DataStructureConfigSchema>;

/**
 * High-performance hash table with configurable hash functions and load factor management
 */
export class OptimizedHashTable<K, V> {
  private buckets: Array<Array<{ key: K; value: V; hash: number }>> = [];
  private size = 0;
  private capacity: number;
  private readonly config: DataStructureConfig['hashTable'];
  private readonly loadFactorThreshold: number;
  private rehashCount = 0;
  private collisionCount = 0;

  constructor(config: Partial<DataStructureConfig['hashTable']> = {}) {
    const defaults = DataStructureConfigSchema.shape.hashTable.parse({});
    this.config = { ...defaults, ...config };
    this.capacity = this.config.initialCapacity;
    this.loadFactorThreshold = this.config.loadFactorThreshold;
    this.initializeBuckets();
  }

  private initializeBuckets(): void {
    this.buckets = new Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.buckets[i] = [];
    }
  }

  private hash(key: K): number {
    const keyStr = String(key);
    
    switch (this.config.hashFunction) {
      case 'djb2':
        return this.djb2Hash(keyStr);
      case 'fnv1a':
        return this.fnv1aHash(keyStr);
      case 'murmur3':
        return this.murmur3Hash(keyStr);
      case 'xxhash':
        return this.xxHash(keyStr);
      default:
        return this.fnv1aHash(keyStr);
    }
  }

  private djb2Hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash) % this.capacity;
  }

  private fnv1aHash(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash % this.capacity;
  }

  private murmur3Hash(str: string): number {
    let hash = 0;
    const seed = 0;
    
    for (let i = 0; i < str.length; i++) {
      let k = str.charCodeAt(i);
      k = (k * 0xcc9e2d51) >>> 0;
      k = (k << 15) | (k >>> 17);
      k = (k * 0x1b873593) >>> 0;
      
      hash ^= k;
      hash = (hash << 13) | (hash >>> 19);
      hash = ((hash * 5) + 0xe6546b64) >>> 0;
    }
    
    hash ^= str.length;
    hash ^= hash >>> 16;
    hash = (hash * 0x85ebca6b) >>> 0;
    hash ^= hash >>> 13;
    hash = (hash * 0xc2b2ae35) >>> 0;
    hash ^= hash >>> 16;
    
    return hash % this.capacity;
  }

  private xxHash(str: string): number {
    const PRIME1 = 2654435761;
    const PRIME2 = 2246822519;
    const PRIME3 = 3266489917;
    const PRIME4 = 668265263;
    const PRIME5 = 374761393;
    
    let hash = PRIME5;
    
    for (let i = 0; i < str.length; i++) {
      hash = ((hash + str.charCodeAt(i) * PRIME5) >>> 0);
      hash = ((hash << 11) | (hash >>> 21)) >>> 0;
      hash = (hash * PRIME1) >>> 0;
    }
    
    hash ^= hash >>> 15;
    hash = (hash * PRIME2) >>> 0;
    hash ^= hash >>> 13;
    hash = (hash * PRIME3) >>> 0;
    hash ^= hash >>> 16;
    
    return hash % this.capacity;
  }

  private shouldRehash(): boolean {
    return this.config.enableRehashing && 
           (this.size / this.capacity) > this.loadFactorThreshold &&
           this.capacity < this.config.maxEntries;
  }

  private rehash(): void {
    const oldBuckets = this.buckets;
    const oldCapacity = this.capacity;
    
    this.capacity = Math.min(this.capacity * 2, this.config.maxEntries);
    this.size = 0;
    this.rehashCount++;
    this.collisionCount = 0;
    this.initializeBuckets();
    
    // Rehash all existing entries
    for (const bucket of oldBuckets) {
      for (const entry of bucket) {
        this.set(entry.key, entry.value);
      }
    }
  }

  public set(key: K, value: V): void {
    if (this.shouldRehash()) {
      this.rehash();
    }
    
    const hash = this.hash(key);
    const bucket = this.buckets[hash];
    
    // Check if key already exists
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].key === key) {
        bucket[i].value = value;
        bucket[i].hash = hash;
        return;
      }
    }
    
    // Add new entry
    if (bucket.length > 0) {
      this.collisionCount++;
    }
    
    bucket.push({ key, value, hash });
    this.size++;
  }

  public get(key: K): V | undefined {
    const hash = this.hash(key);
    const bucket = this.buckets[hash];
    
    for (const entry of bucket) {
      if (entry.key === key) {
        return entry.value;
      }
    }
    
    return undefined;
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: K): boolean {
    const hash = this.hash(key);
    const bucket = this.buckets[hash];
    
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].key === key) {
        bucket.splice(i, 1);
        this.size--;
        return true;
      }
    }
    
    return false;
  }

  public clear(): void {
    this.size = 0;
    this.collisionCount = 0;
    this.initializeBuckets();
  }

  public getSize(): number {
    return this.size;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getLoadFactor(): number {
    return this.size / this.capacity;
  }

  public getCollisionRate(): number {
    return this.size > 0 ? this.collisionCount / this.size : 0;
  }

  public getMetrics() {
    return {
      size: this.size,
      capacity: this.capacity,
      loadFactor: this.getLoadFactor(),
      collisionRate: this.getCollisionRate(),
      rehashCount: this.rehashCount,
      collisionCount: this.collisionCount,
      memoryUsageBytes: this.estimateMemoryUsage(),
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    const bucketOverhead = this.capacity * 8; // Array pointers
    const entryOverhead = this.size * (32 + 8 + 8); // key + value + hash + object overhead
    return bucketOverhead + entryOverhead;
  }

  public *entries(): IterableIterator<[K, V]> {
    for (const bucket of this.buckets) {
      for (const entry of bucket) {
        yield [entry.key, entry.value];
      }
    }
  }

  public keys(): IterableIterator<K> {
    return this.getKeys();
  }

  private *getKeys(): IterableIterator<K> {
    for (const [key] of this.entries()) {
      yield key;
    }
  }

  public values(): IterableIterator<V> {
    return this.getValues();
  }

  private *getValues(): IterableIterator<V> {
    for (const [, value] of this.entries()) {
      yield value;
    }
  }
}

/**
 * B-tree implementation optimized for range queries and sorted access
 */
export class OptimizedBTree<K, V> {
  private root: BTreeNode<K, V> | null = null;
  private readonly config: DataStructureConfig['btree'];
  private size = 0;

  constructor(
    private compareFunction: (a: K, b: K) => number,
    config: Partial<DataStructureConfig['btree']> = {}
  ) {
    const defaults = DataStructureConfigSchema.shape.btree.parse({});
    this.config = { ...defaults, ...config };
  }

  public insert(key: K, value: V): void {
    if (!this.root) {
      this.root = new BTreeNode<K, V>(this.config.order, true);
    }

    const result = this.insertInternal(this.root, key, value);
    if (result.split) {
      const newRoot = new BTreeNode<K, V>(this.config.order, false);
      newRoot.keys.push(result.median!);
      newRoot.values.push(undefined as any); // Internal nodes don't store values
      newRoot.children.push(this.root, result.newNode!);
      this.root = newRoot;
    }
    this.size++;
  }

  private insertInternal(
    node: BTreeNode<K, V>, 
    key: K, 
    value: V
  ): { split: boolean; median?: K; newNode?: BTreeNode<K, V> } {
    if (node.isLeaf) {
      // Insert into leaf node
      const insertIndex = this.findInsertPosition(node.keys, key);
      node.keys.splice(insertIndex, 0, key);
      node.values.splice(insertIndex, 0, value);

      if (node.keys.length > this.config.order - 1) {
        return this.splitNode(node);
      }
      return { split: false };
    } else {
      // Internal node - find child to insert into
      const childIndex = this.findChildIndex(node.keys, key);
      const result = this.insertInternal(node.children[childIndex], key, value);

      if (result.split) {
        // Insert median into this node
        node.keys.splice(childIndex, 0, result.median!);
        node.values.splice(childIndex, 0, undefined as any);
        node.children.splice(childIndex + 1, 0, result.newNode!);

        if (node.keys.length > this.config.order - 1) {
          return this.splitNode(node);
        }
      }
      return { split: false };
    }
  }

  private findInsertPosition(keys: K[], key: K): number {
    let left = 0;
    let right = keys.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.compareFunction(keys[mid], key) < 0) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  }

  private findChildIndex(keys: K[], key: K): number {
    for (let i = 0; i < keys.length; i++) {
      if (this.compareFunction(key, keys[i]) < 0) {
        return i;
      }
    }
    return keys.length;
  }

  private splitNode(node: BTreeNode<K, V>): { 
    split: boolean; 
    median: K; 
    newNode: BTreeNode<K, V> 
  } {
    const midIndex = Math.floor(this.config.order / 2);
    const median = node.keys[midIndex];
    const newNode = new BTreeNode<K, V>(this.config.order, node.isLeaf);

    // Split keys and values
    newNode.keys = node.keys.splice(midIndex + 1);
    newNode.values = node.values.splice(midIndex + 1);
    
    if (!node.isLeaf) {
      newNode.children = node.children.splice(midIndex + 1);
    }

    // Remove median from left node (will be promoted)
    node.keys.splice(midIndex, 1);
    node.values.splice(midIndex, 1);

    return { split: true, median, newNode };
  }

  public search(key: K): V | undefined {
    return this.searchInternal(this.root, key);
  }

  private searchInternal(node: BTreeNode<K, V> | null, key: K): V | undefined {
    if (!node) {
      return undefined;
    }

    for (let i = 0; i < node.keys.length; i++) {
      const cmp = this.compareFunction(key, node.keys[i]);
      if (cmp === 0) {
        return node.values[i];
      } else if (cmp < 0) {
        if (node.isLeaf) {
          return undefined;
        }
        return this.searchInternal(node.children[i], key);
      }
    }

    if (node.isLeaf) {
      return undefined;
    }
    return this.searchInternal(node.children[node.keys.length], key);
  }

  public rangeQuery(startKey: K, endKey: K): Array<[K, V]> {
    const results: Array<[K, V]> = [];
    this.rangeQueryInternal(this.root, startKey, endKey, results);
    return results;
  }

  private rangeQueryInternal(
    node: BTreeNode<K, V> | null,
    startKey: K,
    endKey: K,
    results: Array<[K, V]>
  ): void {
    if (!node) return;

    for (let i = 0; i < node.keys.length; i++) {
      if (!node.isLeaf && this.compareFunction(startKey, node.keys[i]) < 0) {
        this.rangeQueryInternal(node.children[i], startKey, endKey, results);
      }

      if (
        this.compareFunction(node.keys[i], startKey) >= 0 &&
        this.compareFunction(node.keys[i], endKey) <= 0
      ) {
        results.push([node.keys[i], node.values[i]]);
      }
    }

    if (!node.isLeaf) {
      this.rangeQueryInternal(
        node.children[node.keys.length],
        startKey,
        endKey,
        results
      );
    }
  }

  public getSize(): number {
    return this.size;
  }

  public getHeight(): number {
    return this.getHeightInternal(this.root);
  }

  private getHeightInternal(node: BTreeNode<K, V> | null): number {
    if (!node) return 0;
    if (node.isLeaf) return 1;
    return 1 + this.getHeightInternal(node.children[0]);
  }

  public getMetrics() {
    return {
      size: this.size,
      height: this.getHeight(),
      order: this.config.order,
      estimatedMemoryUsage: this.estimateMemoryUsage(),
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation
    const nodeCount = Math.ceil(this.size / (this.config.order / 2));
    const bytesPerNode = this.config.order * (8 + 8 + 8); // key + value + pointer
    return nodeCount * bytesPerNode;
  }
}

class BTreeNode<K, V> {
  public keys: K[] = [];
  public values: V[] = [];
  public children: BTreeNode<K, V>[] = [];

  constructor(
    public readonly order: number,
    public readonly isLeaf: boolean
  ) {}
}

/**
 * Space-efficient Bloom filter for fast membership testing
 */
export class OptimizedBloomFilter {
  private bitArray: Uint8Array;
  private readonly config: DataStructureConfig['bloomFilter'];
  private readonly numBits: number;
  private readonly numHashFunctions: number;
  private insertedElements = 0;

  constructor(config: Partial<DataStructureConfig['bloomFilter']> = {}) {
    const defaults = DataStructureConfigSchema.shape.bloomFilter.parse({});
    this.config = { ...defaults, ...config };
    
    // Calculate optimal bit array size and hash functions
    this.numBits = this.calculateOptimalBitArraySize();
    this.numHashFunctions = this.config.hashFunctions;
    this.bitArray = new Uint8Array(Math.ceil(this.numBits / 8));
  }

  private calculateOptimalBitArraySize(): number {
    const n = this.config.expectedElements;
    const p = this.config.falsePositiveRate;
    return Math.ceil((-n * Math.log(p)) / (Math.log(2) * Math.log(2)));
  }

  private hash(item: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < item.length; i++) {
      hash = (hash * 31 + item.charCodeAt(i)) >>> 0;
    }
    return hash % this.numBits;
  }

  private getHashes(item: string): number[] {
    const hashes: number[] = [];
    for (let i = 0; i < this.numHashFunctions; i++) {
      hashes.push(this.hash(item, i));
    }
    return hashes;
  }

  private setBit(bitIndex: number): void {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    this.bitArray[byteIndex] |= (1 << bitOffset);
  }

  private getBit(bitIndex: number): boolean {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = bitIndex % 8;
    return (this.bitArray[byteIndex] & (1 << bitOffset)) !== 0;
  }

  public add(item: string): void {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      this.setBit(hash);
    }
    this.insertedElements++;
  }

  public mightContain(item: string): boolean {
    const hashes = this.getHashes(item);
    for (const hash of hashes) {
      if (!this.getBit(hash)) {
        return false;
      }
    }
    return true;
  }

  public getCurrentFalsePositiveRate(): number {
    const ratio = this.insertedElements / this.config.expectedElements;
    const k = this.numHashFunctions;
    const m = this.numBits;
    const n = this.insertedElements;
    
    return Math.pow(1 - Math.exp(-k * n / m), k);
  }

  public getMetrics() {
    return {
      size: this.insertedElements,
      bitArraySize: this.numBits,
      memoryUsageBytes: this.bitArray.length,
      expectedFalsePositiveRate: this.config.falsePositiveRate,
      currentFalsePositiveRate: this.getCurrentFalsePositiveRate(),
      fillRatio: this.getFillRatio(),
      numHashFunctions: this.numHashFunctions,
    };
  }

  private getFillRatio(): number {
    let setBits = 0;
    for (let i = 0; i < this.bitArray.length; i++) {
      for (let bit = 0; bit < 8; bit++) {
        if (this.bitArray[i] & (1 << bit)) {
          setBits++;
        }
      }
    }
    return setBits / this.numBits;
  }

  public clear(): void {
    this.bitArray.fill(0);
    this.insertedElements = 0;
  }
}

/**
 * Adaptive Replacement Cache (ARC) implementation
 */
export class AdaptiveReplacementCache<K, V> {
  private readonly config: DataStructureConfig['cache'];
  private readonly capacity: number;
  
  // ARC lists
  private t1 = new Map<K, V>(); // Recent pages
  private t2 = new Map<K, V>(); // Frequent pages  
  private b1 = new Set<K>(); // Ghost list for t1
  private b2 = new Set<K>(); // Ghost list for t2
  
  private p = 0; // Target size for t1
  private hits = 0;
  private misses = 0;

  constructor(config: Partial<DataStructureConfig['cache']> = {}) {
    const defaults = DataStructureConfigSchema.shape.cache.parse({});
    this.config = { ...defaults, ...config };
    this.capacity = this.config.maxSize;
  }

  public get(key: K): V | undefined {
    // Check t1 and t2
    if (this.t1.has(key)) {
      const value = this.t1.get(key)!;
      this.t1.delete(key);
      this.t2.set(key, value);
      this.hits++;
      return value;
    }
    
    if (this.t2.has(key)) {
      // Move to end of t2 (most recently used)
      const value = this.t2.get(key)!;
      this.t2.delete(key);
      this.t2.set(key, value);
      this.hits++;
      return value;
    }
    
    this.misses++;
    return undefined;
  }

  public set(key: K, value: V): void {
    // Case 1: Page is in t1 or t2
    if (this.t1.has(key)) {
      this.t1.delete(key);
      this.t2.set(key, value);
      return;
    }
    
    if (this.t2.has(key)) {
      this.t2.set(key, value);
      return;
    }

    // Case 2: Page is in b1
    if (this.b1.has(key)) {
      this.p = Math.min(this.capacity, this.p + Math.max(1, this.b2.size / this.b1.size));
      this.replace(key);
      this.b1.delete(key);
      this.t2.set(key, value);
      return;
    }

    // Case 3: Page is in b2
    if (this.b2.has(key)) {
      this.p = Math.max(0, this.p - Math.max(1, this.b1.size / this.b2.size));
      this.replace(key);
      this.b2.delete(key);
      this.t2.set(key, value);
      return;
    }

    // Case 4: Page is not in cache
    if (this.t1.size + this.b1.size === this.capacity) {
      if (this.t1.size < this.capacity) {
        const lru = this.b1.values().next().value;
        this.b1.delete(lru);
        this.replace(key);
      } else {
        const lru = this.t1.keys().next().value;
        this.t1.delete(lru);
      }
    } else if (this.t1.size + this.t2.size + this.b1.size + this.b2.size >= this.capacity) {
      if (this.t1.size + this.t2.size + this.b1.size + this.b2.size === 2 * this.capacity) {
        const lru = this.b2.values().next().value;
        this.b2.delete(lru);
      }
      this.replace(key);
    }

    this.t1.set(key, value);
  }

  private replace(key: K): void {
    if (this.t1.size >= 1 && 
        ((this.b2.has(key) && this.t1.size === this.p) || this.t1.size > this.p)) {
      const lru = this.t1.keys().next().value;
      this.t1.delete(lru);
      this.b1.add(lru);
    } else {
      const lru = this.t2.keys().next().value;
      this.t2.delete(lru);
      this.b2.add(lru);
    }
  }

  public has(key: K): boolean {
    return this.t1.has(key) || this.t2.has(key);
  }

  public delete(key: K): boolean {
    if (this.t1.has(key)) {
      this.t1.delete(key);
      return true;
    }
    if (this.t2.has(key)) {
      this.t2.delete(key);
      return true;
    }
    return false;
  }

  public clear(): void {
    this.t1.clear();
    this.t2.clear();
    this.b1.clear();
    this.b2.clear();
    this.p = 0;
    this.hits = 0;
    this.misses = 0;
  }

  public getSize(): number {
    return this.t1.size + this.t2.size;
  }

  public getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  public getMetrics() {
    return {
      size: this.getSize(),
      capacity: this.capacity,
      hitRate: this.getHitRate(),
      hits: this.hits,
      misses: this.misses,
      t1Size: this.t1.size,
      t2Size: this.t2.size,
      b1Size: this.b1.size,
      b2Size: this.b2.size,
      targetT1Size: this.p,
    };
  }
}

/**
 * Data structure manager for coordinating optimal data structure selection
 */
export class DataStructureManager {
  private readonly config: DataStructureConfig;
  private readonly hashTables = new Map<string, OptimizedHashTable<any, any>>();
  private readonly btrees = new Map<string, OptimizedBTree<any, any>>();
  private readonly bloomFilters = new Map<string, OptimizedBloomFilter>();
  private readonly caches = new Map<string, AdaptiveReplacementCache<any, any>>();

  constructor(config: Partial<DataStructureConfig> = {}) {
    this.config = DataStructureConfigSchema.parse(config);
  }

  public createHashTable<K, V>(name: string, config?: Partial<DataStructureConfig['hashTable']>): OptimizedHashTable<K, V> {
    const hashTable = new OptimizedHashTable<K, V>({
      ...this.config.hashTable,
      ...config,
    });
    this.hashTables.set(name, hashTable);
    return hashTable;
  }

  public createBTree<K, V>(
    name: string,
    compareFunction: (a: K, b: K) => number,
    config?: Partial<DataStructureConfig['btree']>
  ): OptimizedBTree<K, V> {
    const btree = new OptimizedBTree<K, V>(compareFunction, {
      ...this.config.btree,
      ...config,
    });
    this.btrees.set(name, btree);
    return btree;
  }

  public createBloomFilter(name: string, config?: Partial<DataStructureConfig['bloomFilter']>): OptimizedBloomFilter {
    const bloomFilter = new OptimizedBloomFilter({
      ...this.config.bloomFilter,
      ...config,
    });
    this.bloomFilters.set(name, bloomFilter);
    return bloomFilter;
  }

  public createCache<K, V>(name: string, config?: Partial<DataStructureConfig['cache']>): AdaptiveReplacementCache<K, V> {
    const cache = new AdaptiveReplacementCache<K, V>({
      ...this.config.cache,
      ...config,
    });
    this.caches.set(name, cache);
    return cache;
  }

  public getHashTable<K, V>(name: string): OptimizedHashTable<K, V> | undefined {
    return this.hashTables.get(name) as OptimizedHashTable<K, V> | undefined;
  }

  public getBTree<K, V>(name: string): OptimizedBTree<K, V> | undefined {
    return this.btrees.get(name) as OptimizedBTree<K, V> | undefined;
  }

  public getBloomFilter(name: string): OptimizedBloomFilter | undefined {
    return this.bloomFilters.get(name);
  }

  public getCache<K, V>(name: string): AdaptiveReplacementCache<K, V> | undefined {
    return this.caches.get(name) as AdaptiveReplacementCache<K, V> | undefined;
  }

  public getAllMetrics() {
    const metrics = {
      hashTables: {} as Record<string, any>,
      btrees: {} as Record<string, any>,
      bloomFilters: {} as Record<string, any>,
      caches: {} as Record<string, any>,
      totalMemoryUsage: 0,
    };

    for (const [name, hashTable] of this.hashTables.entries()) {
      const hashMetrics = hashTable.getMetrics();
      metrics.hashTables[name] = hashMetrics;
      metrics.totalMemoryUsage += hashMetrics.memoryUsageBytes;
    }

    for (const [name, btree] of this.btrees.entries()) {
      const btreeMetrics = btree.getMetrics();
      metrics.btrees[name] = btreeMetrics;
      metrics.totalMemoryUsage += btreeMetrics.estimatedMemoryUsage;
    }

    for (const [name, bloomFilter] of this.bloomFilters.entries()) {
      const bloomMetrics = bloomFilter.getMetrics();
      metrics.bloomFilters[name] = bloomMetrics;
      metrics.totalMemoryUsage += bloomMetrics.memoryUsageBytes;
    }

    for (const [name, cache] of this.caches.entries()) {
      metrics.caches[name] = cache.getMetrics();
    }

    return metrics;
  }

  public cleanup(): void {
    for (const hashTable of this.hashTables.values()) {
      hashTable.clear();
    }
    for (const cache of this.caches.values()) {
      cache.clear();
    }
    for (const bloomFilter of this.bloomFilters.values()) {
      bloomFilter.clear();
    }
    
    this.hashTables.clear();
    this.btrees.clear();
    this.bloomFilters.clear();
    this.caches.clear();
  }
}

/**
 * Factory function to create a data structure manager
 */
export function createDataStructureManager(config?: Partial<DataStructureConfig>): DataStructureManager {
  return new DataStructureManager(config);
}

/**
 * Default configuration
 */
export const DEFAULT_DATA_STRUCTURE_CONFIG: DataStructureConfig = DataStructureConfigSchema.parse({});