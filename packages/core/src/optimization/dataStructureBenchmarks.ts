/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  OptimizedHashTable,
  OptimizedBTree,
  OptimizedBloomFilter,
  AdaptiveReplacementCache,
  createDataStructureManager,
  type DataStructureConfig,
} from './dataStructures.js';

/**
 * Benchmark configuration for data structure performance testing
 */
export interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  sampleSize: number;
  enableGcMonitoring: boolean;
  enableMemoryProfiling: boolean;
  testSets: {
    small: number;    // 1K elements
    medium: number;   // 10K elements  
    large: number;    // 100K elements
    xlarge: number;   // 1M elements
  };
}

export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  iterations: 100,
  warmupIterations: 10,
  sampleSize: 1000,
  enableGcMonitoring: true,
  enableMemoryProfiling: true,
  testSets: {
    small: 1000,
    medium: 10000,
    large: 100000,
    xlarge: 1000000,
  },
};

/**
 * Benchmark result interface
 */
export interface BenchmarkResult {
  name: string;
  operation: string;
  dataSize: number;
  iterations: number;
  averageTimeMs: number;
  medianTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  standardDeviation: number;
  operationsPerSecond: number;
  memoryUsageBytes: number;
  memoryEfficiency: number; // ops per MB
  errorRate: number;
  metadata: Record<string, any>;
}

/**
 * Performance benchmark runner for data structures
 */
export class DataStructureBenchmarkRunner {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = { ...DEFAULT_BENCHMARK_CONFIG, ...config };
  }

  /**
   * Run comprehensive benchmarks on all data structures
   */
  public async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('Starting comprehensive data structure benchmarks...');
    
    this.results = [];
    
    // Hash table benchmarks
    await this.benchmarkHashTables();
    
    // B-tree benchmarks
    await this.benchmarkBTrees();
    
    // Bloom filter benchmarks
    await this.benchmarkBloomFilters();
    
    // Cache benchmarks
    await this.benchmarkCaches();
    
    // Cross-structure comparison
    await this.benchmarkCrossStructure();
    
    console.log(`Completed ${this.results.length} benchmark tests`);
    return this.results;
  }

  /**
   * Benchmark hash table performance with different configurations
   */
  private async benchmarkHashTables(): Promise<void> {
    console.log('Benchmarking hash tables...');
    
    const hashFunctions = ['djb2', 'fnv1a', 'murmur3', 'xxhash'] as const;
    const loadFactors = [0.5, 0.75, 0.9];
    
    for (const hashFunction of hashFunctions) {
      for (const loadFactor of loadFactors) {
        for (const [sizeName, size] of Object.entries(this.config.testSets)) {
          const hashTable = new OptimizedHashTable<string, number>({
            hashFunction,
            loadFactorThreshold: loadFactor,
            initialCapacity: Math.max(16, Math.floor(size / loadFactor)),
          });
          
          // Insertion benchmark
          await this.benchmarkOperation({
            name: `HashTable-${hashFunction}-${loadFactor}`,
            operation: 'insert',
            dataSize: size,
            setup: () => this.generateStringKeys(size),
            execute: (keys: string[]) => {
              for (let i = 0; i < keys.length; i++) {
                hashTable.set(keys[i], i);
              }
            },
            getMetrics: () => hashTable.getMetrics(),
          });
          
          // Lookup benchmark
          const lookupKeys = this.generateStringKeys(this.config.sampleSize);
          await this.benchmarkOperation({
            name: `HashTable-${hashFunction}-${loadFactor}`,
            operation: 'lookup',
            dataSize: size,
            setup: () => lookupKeys,
            execute: (keys: string[]) => {
              for (const key of keys) {
                hashTable.get(key);
              }
            },
            getMetrics: () => hashTable.getMetrics(),
          });
          
          hashTable.clear();
        }
      }
    }
  }

  /**
   * Benchmark B-tree performance
   */
  private async benchmarkBTrees(): Promise<void> {
    console.log('Benchmarking B-trees...');
    
    const orders = [8, 16, 32, 64, 128];
    
    for (const order of orders) {
      for (const [sizeName, size] of Object.entries(this.config.testSets)) {
        const btree = new OptimizedBTree<number, string>(
          (a, b) => a - b,
          { order }
        );
        
        // Insertion benchmark
        await this.benchmarkOperation({
          name: `BTree-order${order}`,
          operation: 'insert',
          dataSize: size,
          setup: () => this.generateNumberKeys(size),
          execute: (keys: number[]) => {
            for (const key of keys) {
              btree.insert(key, `value_${key}`);
            }
          },
          getMetrics: () => btree.getMetrics(),
        });
        
        // Search benchmark
        const searchKeys = this.generateNumberKeys(this.config.sampleSize);
        await this.benchmarkOperation({
          name: `BTree-order${order}`,
          operation: 'search',
          dataSize: size,
          setup: () => searchKeys,
          execute: (keys: number[]) => {
            for (const key of keys) {
              btree.search(key);
            }
          },
          getMetrics: () => btree.getMetrics(),
        });
        
        // Range query benchmark
        await this.benchmarkOperation({
          name: `BTree-order${order}`,
          operation: 'range_query',
          dataSize: size,
          setup: () => ({ start: 0, end: Math.floor(size * 0.1) }),
          execute: (range: { start: number; end: number }) => {
            btree.rangeQuery(range.start, range.end);
          },
          getMetrics: () => btree.getMetrics(),
        });
      }
    }
  }

  /**
   * Benchmark Bloom filter performance
   */
  private async benchmarkBloomFilters(): Promise<void> {
    console.log('Benchmarking Bloom filters...');
    
    const falsePositiveRates = [0.001, 0.01, 0.05];
    const hashFunctionCounts = [3, 7, 11];
    
    for (const falsePositiveRate of falsePositiveRates) {
      for (const hashFunctions of hashFunctionCounts) {
        for (const [sizeName, size] of Object.entries(this.config.testSets)) {
          const bloomFilter = new OptimizedBloomFilter({
            expectedElements: size,
            falsePositiveRate,
            hashFunctions,
          });
          
          // Addition benchmark
          await this.benchmarkOperation({
            name: `BloomFilter-${falsePositiveRate}-${hashFunctions}hash`,
            operation: 'add',
            dataSize: size,
            setup: () => this.generateStringKeys(size),
            execute: (keys: string[]) => {
              for (const key of keys) {
                bloomFilter.add(key);
              }
            },
            getMetrics: () => bloomFilter.getMetrics(),
          });
          
          // Membership test benchmark
          const testKeys = this.generateStringKeys(this.config.sampleSize);
          await this.benchmarkOperation({
            name: `BloomFilter-${falsePositiveRate}-${hashFunctions}hash`,
            operation: 'mightContain',
            dataSize: size,
            setup: () => testKeys,
            execute: (keys: string[]) => {
              for (const key of keys) {
                bloomFilter.mightContain(key);
              }
            },
            getMetrics: () => bloomFilter.getMetrics(),
          });
          
          bloomFilter.clear();
        }
      }
    }
  }

  /**
   * Benchmark cache performance
   */
  private async benchmarkCaches(): Promise<void> {
    console.log('Benchmarking caches...');
    
    const cacheSizes = [100, 1000, 10000];
    
    for (const cacheSize of cacheSizes) {
      for (const [sizeName, size] of Object.entries(this.config.testSets)) {
        const cache = new AdaptiveReplacementCache<string, number>({
          maxSize: cacheSize,
        });
        
        // Cache insertion benchmark
        await this.benchmarkOperation({
          name: `ARC-Cache-${cacheSize}`,
          operation: 'set',
          dataSize: size,
          setup: () => this.generateStringKeys(size),
          execute: (keys: string[]) => {
            for (let i = 0; i < keys.length; i++) {
              cache.set(keys[i], i);
            }
          },
          getMetrics: () => cache.getMetrics(),
        });
        
        // Cache retrieval benchmark
        const lookupKeys = this.generateStringKeys(Math.min(size, cacheSize * 2));
        await this.benchmarkOperation({
          name: `ARC-Cache-${cacheSize}`,
          operation: 'get',
          dataSize: size,
          setup: () => lookupKeys,
          execute: (keys: string[]) => {
            for (const key of keys) {
              cache.get(key);
            }
          },
          getMetrics: () => cache.getMetrics(),
        });
        
        cache.clear();
      }
    }
  }

  /**
   * Cross-structure comparison benchmarks
   */
  private async benchmarkCrossStructure(): Promise<void> {
    console.log('Running cross-structure comparison benchmarks...');
    
    const size = this.config.testSets.medium;
    
    // Compare Map vs OptimizedHashTable
    await this.compareMapVsHashTable(size);
    
    // Compare Set vs BloomFilter for membership testing
    await this.compareSetVsBloomFilter(size);
    
    // Compare different cache strategies
    await this.compareCacheStrategies(size);
  }

  private async compareMapVsHashTable(size: number): Promise<void> {
    const map = new Map<string, number>();
    const hashTable = new OptimizedHashTable<string, number>({
      hashFunction: 'fnv1a',
      loadFactorThreshold: 0.75,
    });
    
    const keys = this.generateStringKeys(size);
    
    // Map insertion
    await this.benchmarkOperation({
      name: 'Native-Map',
      operation: 'insert',
      dataSize: size,
      setup: () => keys,
      execute: (keys: string[]) => {
        for (let i = 0; i < keys.length; i++) {
          map.set(keys[i], i);
        }
      },
      getMetrics: () => ({
        size: map.size,
        memoryUsageBytes: this.estimateMapMemoryUsage(map),
      }),
    });
    
    // HashTable insertion
    await this.benchmarkOperation({
      name: 'OptimizedHashTable',
      operation: 'insert',
      dataSize: size,
      setup: () => keys,
      execute: (keys: string[]) => {
        for (let i = 0; i < keys.length; i++) {
          hashTable.set(keys[i], i);
        }
      },
      getMetrics: () => hashTable.getMetrics(),
    });
    
    // Lookup comparison
    const lookupKeys = keys.slice(0, this.config.sampleSize);
    
    await this.benchmarkOperation({
      name: 'Native-Map',
      operation: 'lookup',
      dataSize: size,
      setup: () => lookupKeys,
      execute: (keys: string[]) => {
        for (const key of keys) {
          map.get(key);
        }
      },
      getMetrics: () => ({
        size: map.size,
        memoryUsageBytes: this.estimateMapMemoryUsage(map),
      }),
    });
    
    await this.benchmarkOperation({
      name: 'OptimizedHashTable',
      operation: 'lookup',
      dataSize: size,
      setup: () => lookupKeys,
      execute: (keys: string[]) => {
        for (const key of keys) {
          hashTable.get(key);
        }
      },
      getMetrics: () => hashTable.getMetrics(),
    });
  }

  private async compareSetVsBloomFilter(size: number): Promise<void> {
    const set = new Set<string>();
    const bloomFilter = new OptimizedBloomFilter({
      expectedElements: size,
      falsePositiveRate: 0.01,
    });
    
    const keys = this.generateStringKeys(size);
    
    // Set insertion
    await this.benchmarkOperation({
      name: 'Native-Set',
      operation: 'add',
      dataSize: size,
      setup: () => keys,
      execute: (keys: string[]) => {
        for (const key of keys) {
          set.add(key);
        }
      },
      getMetrics: () => ({
        size: set.size,
        memoryUsageBytes: this.estimateSetMemoryUsage(set),
      }),
    });
    
    // BloomFilter insertion
    await this.benchmarkOperation({
      name: 'OptimizedBloomFilter',
      operation: 'add',
      dataSize: size,
      setup: () => keys,
      execute: (keys: string[]) => {
        for (const key of keys) {
          bloomFilter.add(key);
        }
      },
      getMetrics: () => bloomFilter.getMetrics(),
    });
    
    // Membership test comparison
    const testKeys = this.generateStringKeys(this.config.sampleSize);
    
    await this.benchmarkOperation({
      name: 'Native-Set',
      operation: 'has',
      dataSize: size,
      setup: () => testKeys,
      execute: (keys: string[]) => {
        for (const key of keys) {
          set.has(key);
        }
      },
      getMetrics: () => ({
        size: set.size,
        memoryUsageBytes: this.estimateSetMemoryUsage(set),
      }),
    });
    
    await this.benchmarkOperation({
      name: 'OptimizedBloomFilter',
      operation: 'mightContain',
      dataSize: size,
      setup: () => testKeys,
      execute: (keys: string[]) => {
        for (const key of keys) {
          bloomFilter.mightContain(key);
        }
      },
      getMetrics: () => bloomFilter.getMetrics(),
    });
  }

  private async compareCacheStrategies(size: number): Promise<void> {
    const cacheSize = Math.min(1000, size / 10);
    const arcCache = new AdaptiveReplacementCache<string, number>({
      maxSize: cacheSize,
    });
    
    // Use a simple LRU cache for comparison
    const lruCache = new Map<string, number>();
    const lruOrder: string[] = [];
    
    const keys = this.generateStringKeys(size);
    
    // ARC cache benchmark
    await this.benchmarkOperation({
      name: 'ARC-Cache',
      operation: 'mixed_operations',
      dataSize: size,
      setup: () => keys,
      execute: (keys: string[]) => {
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          
          // 70% gets, 30% sets (realistic workload)
          if (Math.random() < 0.7) {
            arcCache.get(key);
          } else {
            arcCache.set(key, i);
          }
        }
      },
      getMetrics: () => arcCache.getMetrics(),
    });
    
    // Simple LRU cache benchmark
    await this.benchmarkOperation({
      name: 'Simple-LRU-Cache',
      operation: 'mixed_operations',
      dataSize: size,
      setup: () => keys,
      execute: (keys: string[]) => {
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          
          if (Math.random() < 0.7) {
            // Get operation
            if (lruCache.has(key)) {
              // Move to end (most recent)
              lruCache.delete(key);
              lruCache.set(key, lruCache.get(key)!);
            }
          } else {
            // Set operation
            if (lruCache.size >= cacheSize) {
              const oldest = lruOrder.shift()!;
              lruCache.delete(oldest);
            }
            lruCache.set(key, i);
            lruOrder.push(key);
          }
        }
      },
      getMetrics: () => ({
        size: lruCache.size,
        memoryUsageBytes: this.estimateMapMemoryUsage(lruCache),
        hitRate: 0, // Simplified - would need tracking
      }),
    });
  }

  /**
   * Generic benchmark operation runner
   */
  private async benchmarkOperation<T>(options: {
    name: string;
    operation: string;
    dataSize: number;
    setup: () => T;
    execute: (data: T) => void;
    getMetrics: () => any;
  }): Promise<void> {
    const { name, operation, dataSize, setup, execute, getMetrics } = options;
    
    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      const data = setup();
      execute(data);
    }
    
    // Force garbage collection if available
    if (this.config.enableGcMonitoring && global.gc) {
      global.gc();
    }
    
    const times: number[] = [];
    let errors = 0;
    const memoryBefore = this.getMemoryUsage();
    
    // Run benchmark iterations
    for (let i = 0; i < this.config.iterations; i++) {
      try {
        const data = setup();
        const startTime = performance.now();
        execute(data);
        const endTime = performance.now();
        times.push(endTime - startTime);
      } catch (error) {
        errors++;
      }
    }
    
    const memoryAfter = this.getMemoryUsage();
    const metrics = getMetrics();
    
    // Calculate statistics
    times.sort((a, b) => a - b);
    const averageTimeMs = times.reduce((sum, time) => sum + time, 0) / times.length;
    const medianTimeMs = times[Math.floor(times.length / 2)];
    const minTimeMs = times[0];
    const maxTimeMs = times[times.length - 1];
    
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTimeMs, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);
    
    const operationsPerSecond = dataSize / (averageTimeMs / 1000);
    const memoryUsageBytes = metrics.memoryUsageBytes || (memoryAfter - memoryBefore);
    const memoryEfficiency = operationsPerSecond / (memoryUsageBytes / (1024 * 1024)); // ops per MB
    
    const result: BenchmarkResult = {
      name,
      operation,
      dataSize,
      iterations: this.config.iterations,
      averageTimeMs,
      medianTimeMs,
      minTimeMs,
      maxTimeMs,
      standardDeviation,
      operationsPerSecond,
      memoryUsageBytes,
      memoryEfficiency,
      errorRate: errors / this.config.iterations,
      metadata: metrics,
    };
    
    this.results.push(result);
  }

  /**
   * Generate test data
   */
  private generateStringKeys(count: number): string[] {
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      keys.push(`key_${i}_${Math.random().toString(36).substr(2, 9)}`);
    }
    return keys;
  }

  private generateNumberKeys(count: number): number[] {
    const keys: number[] = [];
    for (let i = 0; i < count; i++) {
      keys.push(Math.floor(Math.random() * count * 10));
    }
    return keys;
  }

  /**
   * Memory usage estimation helpers
   */
  private getMemoryUsage(): number {
    if (process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  private estimateMapMemoryUsage(map: Map<any, any>): number {
    // Rough estimation - 32 bytes per entry (16 for key, 16 for value) + overhead
    return map.size * 48;
  }

  private estimateSetMemoryUsage(set: Set<any>): number {
    // Rough estimation - 24 bytes per entry + overhead
    return set.size * 32;
  }

  /**
   * Export results in various formats
   */
  public exportResults(format: 'json' | 'csv' | 'markdown' = 'json'): string {
    switch (format) {
      case 'csv':
        return this.exportToCsv();
      case 'markdown':
        return this.exportToMarkdown();
      default:
        return JSON.stringify(this.results, null, 2);
    }
  }

  private exportToCsv(): string {
    if (this.results.length === 0) return '';
    
    const headers = Object.keys(this.results[0]).filter(key => key !== 'metadata');
    const csvRows = [
      headers.join(','),
      ...this.results.map(result => 
        headers.map(header => result[header as keyof BenchmarkResult]).join(',')
      )
    ];
    
    return csvRows.join('\n');
  }

  private exportToMarkdown(): string {
    if (this.results.length === 0) return '';
    
    const grouped = this.results.reduce((acc, result) => {
      const key = `${result.name}-${result.operation}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(result);
      return acc;
    }, {} as Record<string, BenchmarkResult[]>);
    
    let markdown = '# Data Structure Benchmark Results\n\n';
    
    for (const [key, results] of Object.entries(grouped)) {
      markdown += `## ${key}\n\n`;
      markdown += '| Data Size | Avg Time (ms) | Ops/sec | Memory (MB) | Efficiency (ops/MB) |\n';
      markdown += '|-----------|---------------|---------|-------------|---------------------|\n';
      
      for (const result of results) {
        const memoryMB = (result.memoryUsageBytes / (1024 * 1024)).toFixed(2);
        markdown += `| ${result.dataSize} | ${result.averageTimeMs.toFixed(2)} | ${result.operationsPerSecond.toFixed(0)} | ${memoryMB} | ${result.memoryEfficiency.toFixed(0)} |\n`;
      }
      
      markdown += '\n';
    }
    
    return markdown;
  }

  /**
   * Get performance recommendations based on benchmark results
   */
  public getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.results.length === 0) {
      return ['No benchmark results available for analysis.'];
    }
    
    // Analyze hash table performance
    const hashTableResults = this.results.filter(r => r.name.includes('HashTable'));
    if (hashTableResults.length > 0) {
      const best = hashTableResults.reduce((best, current) => 
        current.operationsPerSecond > best.operationsPerSecond ? current : best
      );
      recommendations.push(`Best hash function: ${best.name} (${best.operationsPerSecond.toFixed(0)} ops/sec)`);
    }
    
    // Analyze memory efficiency
    const memoryEfficient = this.results.reduce((best, current) => 
      current.memoryEfficiency > best.memoryEfficiency ? current : best
    );
    recommendations.push(`Most memory efficient: ${memoryEfficient.name} (${memoryEfficient.memoryEfficiency.toFixed(0)} ops/MB)`);
    
    // Analyze error rates
    const highErrorRate = this.results.filter(r => r.errorRate > 0.01);
    if (highErrorRate.length > 0) {
      recommendations.push(`Warning: High error rates detected in: ${highErrorRate.map(r => r.name).join(', ')}`);
    }
    
    return recommendations;
  }
}

/**
 * Factory function to create benchmark runner
 */
export function createBenchmarkRunner(config?: Partial<BenchmarkConfig>): DataStructureBenchmarkRunner {
  return new DataStructureBenchmarkRunner(config);
}

/**
 * Run quick performance test
 */
export async function runQuickBenchmark(): Promise<BenchmarkResult[]> {
  const runner = createBenchmarkRunner({
    iterations: 10,
    warmupIterations: 2,
    testSets: {
      small: 100,
      medium: 1000,
      large: 10000,
      xlarge: 50000,
    },
  });
  
  return await runner.runAllBenchmarks();
}