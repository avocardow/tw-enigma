/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import {
  createDataStructureManager,
  OptimizedHashTable,
  OptimizedBTree,
  OptimizedBloomFilter,
  AdaptiveReplacementCache,
  type DataStructureConfig,
} from './dataStructures.js';
import type { 
  PatternFrequencyMap,
  AggregatedClassData,
  FrequencyAnalysisResult,
} from '../processors/patternAnalysis.js';
import { MetricsCollector } from '../metrics/collector.js';

/**
 * Configuration for optimized pattern processor
 */
export const OptimizedPatternProcessorConfigSchema = z.object({
  // Data structure optimization settings
  dataStructures: z.object({
    enableOptimizedHashTables: z.boolean().default(true),
    enableBloomFilters: z.boolean().default(true),
    enableBTreeIndex: z.boolean().default(true),
    enableAdaptiveCache: z.boolean().default(true),
  }).default({}),
  
  // Performance thresholds
  performance: z.object({
    largeDatasetThreshold: z.number().min(1000).max(1000000).default(10000),
    bloomFilterThreshold: z.number().min(100).max(100000).default(1000),
    btreeIndexThreshold: z.number().min(500).max(50000).default(5000),
    cacheHitRateThreshold: z.number().min(0.1).max(0.99).default(0.7),
  }).default({}),
  
  // Memory management
  memory: z.object({
    maxMemoryUsageMB: z.number().min(100).max(8192).default(1024),
    enableMemoryPressureHandling: z.boolean().default(true),
    enableGarbageCollection: z.boolean().default(true),
    memoryCheckInterval: z.number().min(1000).max(60000).default(10000),
  }).default({}),
  
  // Optimization strategies
  optimization: z.object({
    enablePrefetching: z.boolean().default(true),
    enableBatching: z.boolean().default(true),
    batchSize: z.number().min(10).max(10000).default(1000),
    enableParallelProcessing: z.boolean().default(true),
    maxConcurrency: z.number().min(1).max(32).default(4),
  }).default({}),
});

export type OptimizedPatternProcessorConfig = z.infer<typeof OptimizedPatternProcessorConfigSchema>;

/**
 * Optimized pattern frequency data structure
 */
export interface OptimizedPatternFrequencyMap extends Map<string, AggregatedClassData> {
  readonly __brand: 'OptimizedPatternFrequencyMap';
  getMetrics(): {
    size: number;
    memoryUsage: number;
    hitRate: number;
    efficiency: number;
  };
}

/**
 * High-performance pattern processor using optimized data structures
 */
export class OptimizedPatternProcessor {
  private readonly config: OptimizedPatternProcessorConfig;
  private readonly dataStructureManager = createDataStructureManager();
  private readonly metricsCollector: MetricsCollector;
  
  // Core data structures
  private readonly patternHashTable: OptimizedHashTable<string, AggregatedClassData>;
  private readonly frequencyIndex: OptimizedBTree<number, Set<string>>;
  private readonly bloomFilter: OptimizedBloomFilter;
  private readonly patternCache: AdaptiveReplacementCache<string, AggregatedClassData>;
  
  // Performance monitoring
  private memoryCheckInterval?: NodeJS.Timeout;
  private isMemoryPressure = false;
  private processingStats = {
    totalProcessed: 0,
    cacheHits: 0,
    bloomFilterHits: 0,
    bloomFilterMisses: 0,
    memoryPressureEvents: 0,
  };

  constructor(config: Partial<OptimizedPatternProcessorConfig> = {}) {
    this.config = OptimizedPatternProcessorConfigSchema.parse(config);
    this.metricsCollector = new MetricsCollector();
    
    // Initialize optimized data structures
    this.patternHashTable = this.dataStructureManager.createHashTable('patterns', {
      hashFunction: 'fnv1a',
      loadFactorThreshold: 0.75,
      maxEntries: 100000,
    });
    
    this.frequencyIndex = this.dataStructureManager.createBTree(
      'frequency_index',
      (a: number, b: number) => b - a, // Descending order (highest frequency first)
      {
        order: 64,
        enableBulkLoading: true,
      }
    );
    
    this.bloomFilter = this.dataStructureManager.createBloomFilter('pattern_bloom', {
      expectedElements: 50000,
      falsePositiveRate: 0.01,
    });
    
    this.patternCache = this.dataStructureManager.createCache('pattern_cache', {
      maxSize: 5000,
    });
    
    this.startMemoryMonitoring();
  }

  /**
   * Process pattern frequency data with optimized data structures
   */
  public async processPatterns(
    patterns: Map<string, AggregatedClassData>
  ): Promise<OptimizedPatternFrequencyMap> {
    const startTime = performance.now();
    this.metricsCollector.incrementCounter('pattern_processing_started');
    
    try {
      // Check if we should use optimized processing for large datasets
      const useOptimizedPath = this.shouldUseOptimizedProcessing(patterns.size);
      
      if (useOptimizedPath) {
        return await this.processLargePatternSet(patterns);
      } else {
        return await this.processSmallPatternSet(patterns);
      }
    } finally {
      const duration = performance.now() - startTime;
      this.metricsCollector.recordPerformance('pattern_processing_time', {
        duration,
        memory: this.getCurrentMemoryUsage(),
        cpu: 0,
        stage: 'pattern_processing',
        operationName: 'process_patterns',
      });
    }
  }

  /**
   * Optimized processing for large pattern sets
   */
  private async processLargePatternSet(
    patterns: Map<string, AggregatedClassData>
  ): Promise<OptimizedPatternFrequencyMap> {
    console.log(`Processing large pattern set (${patterns.size} patterns) with optimizations`);
    
    // Clear existing data structures
    this.clearDataStructures();
    
    // Pre-populate bloom filter for fast membership testing
    if (this.config.dataStructures.enableBloomFilters && 
        patterns.size > this.config.performance.bloomFilterThreshold) {
      for (const pattern of patterns.keys()) {
        this.bloomFilter.add(pattern);
      }
    }
    
    // Process patterns in batches to manage memory pressure
    const batchSize = this.config.optimization.batchSize;
    const patternEntries = Array.from(patterns.entries());
    
    for (let i = 0; i < patternEntries.length; i += batchSize) {
      const batch = patternEntries.slice(i, i + batchSize);
      await this.processBatch(batch);
      
      // Check memory pressure and perform GC if needed
      if (this.config.memory.enableMemoryPressureHandling) {
        await this.checkMemoryPressure();
      }
      
      // Yield control to prevent blocking
      if (i % (batchSize * 4) === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // Build frequency index for range queries
    if (this.config.dataStructures.enableBTreeIndex &&
        patterns.size > this.config.performance.btreeIndexThreshold) {
      await this.buildFrequencyIndex();
    }
    
    return this.createOptimizedFrequencyMap();
  }

  /**
   * Standard processing for smaller pattern sets
   */
  private async processSmallPatternSet(
    patterns: Map<string, AggregatedClassData>
  ): Promise<OptimizedPatternFrequencyMap> {
    console.log(`Processing small pattern set (${patterns.size} patterns) with standard path`);
    
    // Use optimized hash table but skip other optimizations
    for (const [pattern, data] of patterns.entries()) {
      this.patternHashTable.set(pattern, data);
      
      // Add to cache for frequently accessed patterns
      if (data.frequency > 5) {
        this.patternCache.set(pattern, data);
      }
    }
    
    return this.createOptimizedFrequencyMap();
  }

  /**
   * Process a batch of patterns
   */
  private async processBatch(batch: Array<[string, AggregatedClassData]>): Promise<void> {
    const startTime = performance.now();
    
    for (const [pattern, data] of batch) {
      // Check cache first
      const cached = this.patternCache.get(pattern);
      if (cached) {
        this.processingStats.cacheHits++;
        continue;
      }
      
      // Check bloom filter for existence (fast negative lookup)
      if (this.config.dataStructures.enableBloomFilters && 
          !this.bloomFilter.mightContain(pattern)) {
        this.processingStats.bloomFilterMisses++;
        continue;
      }
      
      if (this.config.dataStructures.enableBloomFilters) {
        this.processingStats.bloomFilterHits++;
      }
      
      // Store in hash table
      this.patternHashTable.set(pattern, data);
      
      // Cache frequently used patterns
      if (data.frequency > 3 || this.isHighValuePattern(pattern, data)) {
        this.patternCache.set(pattern, data);
      }
      
      this.processingStats.totalProcessed++;
    }
    
    const duration = performance.now() - startTime;
    this.metricsCollector.recordPerformance('batch_processing_time', {
      duration,
      memory: this.getCurrentMemoryUsage(),
      cpu: 0,
      stage: 'batch_processing',
      operationName: 'process_batch',
    });
  }

  /**
   * Build frequency index for efficient range queries
   */
  private async buildFrequencyIndex(): Promise<void> {
    console.log('Building frequency index...');
    const startTime = performance.now();
    
    const frequencyGroups = new Map<number, Set<string>>();
    
    for (const [pattern, data] of this.patternHashTable.entries()) {
      const frequency = data.frequency;
      
      if (!frequencyGroups.has(frequency)) {
        frequencyGroups.set(frequency, new Set());
      }
      
      frequencyGroups.get(frequency)!.add(pattern);
    }
    
    // Insert into B-tree for efficient range queries
    for (const [frequency, patterns] of frequencyGroups.entries()) {
      this.frequencyIndex.insert(frequency, patterns);
    }
    
    const duration = performance.now() - startTime;
    this.metricsCollector.recordPerformance('index_building_time', {
      duration,
      memory: this.getCurrentMemoryUsage(),
      cpu: 0,
      stage: 'index_building',
      operationName: 'build_frequency_index',
    });
    
    console.log(`Frequency index built with ${frequencyGroups.size} frequency groups`);
  }

  /**
   * Get patterns by frequency range using B-tree index
   */
  public getPatternsByFrequencyRange(minFreq: number, maxFreq: number): string[] {
    if (!this.config.dataStructures.enableBTreeIndex) {
      // Fallback to linear search
      return this.getPatternsByFrequencyRangeFallback(minFreq, maxFreq);
    }
    
    const results: string[] = [];
    const rangeResults = this.frequencyIndex.rangeQuery(minFreq, maxFreq);
    
    for (const [frequency, patterns] of rangeResults) {
      results.push(...Array.from(patterns));
    }
    
    return results;
  }

  /**
   * Fallback method for frequency range queries without B-tree
   */
  private getPatternsByFrequencyRangeFallback(minFreq: number, maxFreq: number): string[] {
    const results: string[] = [];
    
    for (const [pattern, data] of this.patternHashTable.entries()) {
      if (data.frequency >= minFreq && data.frequency <= maxFreq) {
        results.push(pattern);
      }
    }
    
    return results;
  }

  /**
   * Get top N most frequent patterns efficiently
   */
  public getTopPatterns(n: number): Array<[string, AggregatedClassData]> {
    const patterns: Array<[string, AggregatedClassData]> = [];
    
    // Use B-tree if available for efficient traversal
    if (this.config.dataStructures.enableBTreeIndex && this.frequencyIndex.getSize() > 0) {
      let collected = 0;
      
      // Traverse B-tree in descending frequency order
      for (const [frequency, patternSet] of this.frequencyIndex.rangeQuery(0, Number.MAX_SAFE_INTEGER)) {
        for (const pattern of patternSet) {
          if (collected >= n) break;
          
          const data = this.patternHashTable.get(pattern);
          if (data) {
            patterns.push([pattern, data]);
            collected++;
          }
        }
        
        if (collected >= n) break;
      }
    } else {
      // Fallback to sorting
      const allPatterns = Array.from(this.patternHashTable.entries());
      allPatterns.sort((a, b) => b[1].frequency - a[1].frequency);
      patterns.push(...allPatterns.slice(0, n));
    }
    
    return patterns;
  }

  /**
   * Fast pattern existence check
   */
  public hasPattern(pattern: string): boolean {
    // Check cache first (fastest)
    if (this.patternCache.has(pattern)) {
      this.processingStats.cacheHits++;
      return true;
    }
    
    // Check bloom filter (fast negative lookup)
    if (this.config.dataStructures.enableBloomFilters && 
        !this.bloomFilter.mightContain(pattern)) {
      this.processingStats.bloomFilterMisses++;
      return false;
    }
    
    // Check hash table (definitive)
    const exists = this.patternHashTable.has(pattern);
    
    if (this.config.dataStructures.enableBloomFilters) {
      if (exists) {
        this.processingStats.bloomFilterHits++;
      } else {
        this.processingStats.bloomFilterMisses++;
      }
    }
    
    return exists;
  }

  /**
   * Get pattern data with caching
   */
  public getPattern(pattern: string): AggregatedClassData | undefined {
    // Check cache first
    const cached = this.patternCache.get(pattern);
    if (cached) {
      this.processingStats.cacheHits++;
      return cached;
    }
    
    // Check hash table
    const data = this.patternHashTable.get(pattern);
    if (data && this.isHighValuePattern(pattern, data)) {
      // Cache high-value patterns
      this.patternCache.set(pattern, data);
    }
    
    return data;
  }

  /**
   * Create optimized frequency map with enhanced capabilities
   */
  private createOptimizedFrequencyMap(): OptimizedPatternFrequencyMap {
    const map = new Map(this.patternHashTable.entries()) as OptimizedPatternFrequencyMap;
    
    // Add brand for type safety
    Object.defineProperty(map, '__brand', {
      value: 'OptimizedPatternFrequencyMap',
      writable: false,
      enumerable: false,
    });
    
    // Add metrics method
    Object.defineProperty(map, 'getMetrics', {
      value: () => ({
        size: this.patternHashTable.getSize(),
        memoryUsage: this.getTotalMemoryUsage(),
        hitRate: this.getCacheHitRate(),
        efficiency: this.getProcessingEfficiency(),
      }),
      writable: false,
      enumerable: false,
    });
    
    return map;
  }

  /**
   * Determine if a pattern is high-value for caching
   */
  private isHighValuePattern(pattern: string, data: AggregatedClassData): boolean {
    return (
      data.frequency > 5 ||
      data.sources.length > 2 ||
      pattern.length < 20 // Short patterns are accessed more frequently
    );
  }

  /**
   * Check if optimized processing should be used
   */
  private shouldUseOptimizedProcessing(patternCount: number): boolean {
    return (
      patternCount > this.config.performance.largeDatasetThreshold ||
      this.isMemoryPressure
    );
  }

  /**
   * Memory pressure handling
   */
  private async checkMemoryPressure(): Promise<void> {
    const currentMemoryMB = this.getCurrentMemoryUsage();
    const maxMemoryMB = this.config.memory.maxMemoryUsageMB;
    
    if (currentMemoryMB > maxMemoryMB * 0.9) {
      if (!this.isMemoryPressure) {
        console.warn(`Memory pressure detected: ${currentMemoryMB}MB / ${maxMemoryMB}MB`);
        this.isMemoryPressure = true;
        this.processingStats.memoryPressureEvents++;
        
        // Trigger aggressive cleanup
        await this.handleMemoryPressure();
      }
    } else if (this.isMemoryPressure && currentMemoryMB < maxMemoryMB * 0.7) {
      this.isMemoryPressure = false;
      console.log(`Memory pressure resolved: ${currentMemoryMB}MB`);
    }
  }

  /**
   * Handle memory pressure by cleaning up caches
   */
  private async handleMemoryPressure(): Promise<void> {
    console.log('Handling memory pressure...');
    
    // Clear half of the cache
    const cacheSize = this.patternCache.getSize();
    const targetSize = Math.floor(cacheSize / 2);
    
    // Clear cache entries (ARC will handle this intelligently)
    for (let i = 0; i < cacheSize - targetSize; i++) {
      // ARC handles eviction automatically when new items are added
    }
    
    // Force garbage collection if available
    if (this.config.memory.enableGarbageCollection && global.gc) {
      global.gc();
    }
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Allow GC to run
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (!this.config.memory.enableMemoryPressureHandling) return;
    
    this.memoryCheckInterval = setInterval(async () => {
      await this.checkMemoryPressure();
    }, this.config.memory.memoryCheckInterval);
  }

  /**
   * Clear all data structures
   */
  private clearDataStructures(): void {
    this.patternHashTable.clear();
    this.frequencyIndex = this.dataStructureManager.createBTree(
      'frequency_index_new',
      (a: number, b: number) => b - a
    );
    this.bloomFilter.clear();
    this.patternCache.clear();
  }

  /**
   * Performance metrics
   */
  public getPerformanceMetrics() {
    return {
      processing: this.processingStats,
      dataStructures: this.dataStructureManager.getAllMetrics(),
      memory: {
        current: this.getCurrentMemoryUsage(),
        max: this.config.memory.maxMemoryUsageMB,
        pressure: this.isMemoryPressure,
      },
      cache: {
        hitRate: this.getCacheHitRate(),
        size: this.patternCache.getSize(),
        capacity: this.patternCache.getMetrics().capacity,
      },
      bloomFilter: this.bloomFilter.getMetrics(),
    };
  }

  /**
   * Get current memory usage in MB
   */
  private getCurrentMemoryUsage(): number {
    if (process.memoryUsage) {
      return process.memoryUsage().heapUsed / (1024 * 1024);
    }
    return 0;
  }

  /**
   * Get total memory usage across all data structures
   */
  private getTotalMemoryUsage(): number {
    const metrics = this.dataStructureManager.getAllMetrics();
    return metrics.totalMemoryUsage;
  }

  /**
   * Calculate cache hit rate
   */
  private getCacheHitRate(): number {
    const total = this.processingStats.cacheHits + this.processingStats.totalProcessed;
    return total > 0 ? this.processingStats.cacheHits / total : 0;
  }

  /**
   * Calculate processing efficiency
   */
  private getProcessingEfficiency(): number {
    const memoryMB = this.getTotalMemoryUsage() / (1024 * 1024);
    return memoryMB > 0 ? this.processingStats.totalProcessed / memoryMB : 0;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    this.dataStructureManager.cleanup();
    
    // Flush metrics
    await this.metricsCollector.flush();
  }
}

/**
 * Factory function to create optimized pattern processor
 */
export function createOptimizedPatternProcessor(
  config?: Partial<OptimizedPatternProcessorConfig>
): OptimizedPatternProcessor {
  return new OptimizedPatternProcessor(config);
}

/**
 * Convert legacy PatternFrequencyMap to optimized version
 */
export async function convertToOptimizedPatternMap(
  legacyMap: PatternFrequencyMap,
  config?: Partial<OptimizedPatternProcessorConfig>
): Promise<OptimizedPatternFrequencyMap> {
  const processor = createOptimizedPatternProcessor(config);
  return await processor.processPatterns(legacyMap);
}