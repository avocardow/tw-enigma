/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { promises as fs } from 'fs';
import { join, resolve, relative } from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { MetricsCollector } from '../metrics/collector.js';
import { ResourceManager } from './resourceManager.js';

/**
 * Parallel file discovery configuration schema
 */
export const ParallelFileDiscoveryConfigSchema = z.object({
  // Parallelization settings
  parallel: z.object({
    enabled: z.boolean().default(true),
    maxWorkers: z.number().min(1).max(32).default(Math.min(8, require('os').cpus().length)),
    workerPoolSize: z.number().min(1).max(16).default(4),
    enableWorkStealing: z.boolean().default(true),
    taskTimeout: z.number().min(1000).max(300000).default(30000),
  }).default({}),

  // Pattern processing
  patterns: z.object({
    enableCaching: z.boolean().default(true),
    cacheSize: z.number().min(10).max(10000).default(1000),
    cacheTTL: z.number().min(1000).max(3600000).default(300000), // 5 minutes
    enableDeduplication: z.boolean().default(true),
    enableSorting: z.boolean().default(true),
  }).default({}),

  // File system optimization
  filesystem: z.object({
    useReaddir: z.boolean().default(true),
    enableStatCache: z.boolean().default(true),
    statCacheSize: z.number().min(100).max(100000).default(10000),
    statCacheTTL: z.number().min(1000).max(3600000).default(60000), // 1 minute
    followSymlinks: z.boolean().default(false),
    enableMetadataCollection: z.boolean().default(true),
  }).default({}),

  // Performance tuning
  performance: z.object({
    maxConcurrentOperations: z.number().min(1).max(1000).default(100),
    batchSize: z.number().min(1).max(10000).default(1000),
    enableProgressReporting: z.boolean().default(true),
    progressInterval: z.number().min(100).max(10000).default(1000),
  }).default({}),

  // Error handling
  errorHandling: z.object({
    ignorePermissionErrors: z.boolean().default(true),
    ignoreSymlinkErrors: z.boolean().default(true),
    maxErrorsPerWorker: z.number().min(1).max(1000).default(100),
    retryFailedPaths: z.boolean().default(true),
    maxRetries: z.number().min(0).max(10).default(3),
  }).default({}),

  // Result filtering
  filtering: z.object({
    enableSizeFiltering: z.boolean().default(true),
    minFileSize: z.number().min(0).default(0),
    maxFileSize: z.number().min(0).default(100 * 1024 * 1024), // 100MB
    excludeDirectories: z.array(z.string()).default(['.git', 'node_modules', '.DS_Store']),
    excludeExtensions: z.array(z.string()).default(['.log', '.tmp', '.cache']),
  }).default({}),
});

export type ParallelFileDiscoveryConfig = z.infer<typeof ParallelFileDiscoveryConfigSchema>;

/**
 * File discovery result with metadata
 */
export interface FileDiscoveryResult {
  files: Array<{
    path: string;
    absolutePath: string;
    relativePath: string;
    size: number;
    modified: Date;
    extension: string;
    directory: string;
    metadata?: {
      isSymlink: boolean;
      permissions: number;
      uid: number;
      gid: number;
    };
  }>;
  directories: string[];
  statistics: {
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    processingTime: number;
    averageFileSize: number;
    extensionCounts: Record<string, number>;
    directoryCounts: Record<string, number>;
  };
  performance: {
    workersUsed: number;
    parallelEfficiency: number;
    throughput: number; // files per second
    cacheHitRate: number;
  };
}

/**
 * File discovery task for worker threads
 */
export interface FileDiscoveryTask {
  id: string;
  patterns: string[];
  baseDirectory: string;
  options: {
    includeMetadata: boolean;
    followSymlinks: boolean;
    maxDepth?: number;
    excludePatterns?: string[];
  };
}

/**
 * Worker thread file discovery result
 */
export interface WorkerDiscoveryResult {
  taskId: string;
  files: Array<{
    path: string;
    size: number;
    modified: number;
    extension: string;
    directory: string;
    metadata?: any;
  }>;
  directories: string[];
  errors: Array<{
    path: string;
    error: string;
  }>;
  statistics: {
    filesFound: number;
    directoriesTraversed: number;
    totalSize: number;
    processingTime: number;
  };
}

/**
 * Cache entry for file system operations
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

/**
 * High-performance parallel file discovery system
 */
export class ParallelFileDiscovery extends EventEmitter {
  private config: ParallelFileDiscoveryConfig;
  private workers: Worker[] = [];
  private taskQueue: FileDiscoveryTask[] = [];
  private resultCache = new Map<string, CacheEntry<FileDiscoveryResult>>();
  private statCache = new Map<string, CacheEntry<fs.Stats>>();
  private isShuttingDown = false;
  private metricsCollector?: MetricsCollector;
  private resourceManager?: ResourceManager;
  private activeWorkers = new Set<string>();
  private completedTasks = new Map<string, WorkerDiscoveryResult>();

  constructor(
    config: Partial<ParallelFileDiscoveryConfig> = {},
    metricsCollector?: MetricsCollector,
    resourceManager?: ResourceManager
  ) {
    super();
    this.config = ParallelFileDiscoveryConfigSchema.parse(config);
    this.metricsCollector = metricsCollector;
    this.resourceManager = resourceManager;

    if (this.config.parallel.enabled) {
      this.initializeWorkerPool();
    }

    this.setupCacheCleanup();
  }

  /**
   * Discover files using parallel pattern matching
   */
  async discoverFiles(
    patterns: string[],
    baseDirectory: string = process.cwd(),
    options: {
      includeMetadata?: boolean;
      followSymlinks?: boolean;
      maxDepth?: number;
      excludePatterns?: string[];
      enableCaching?: boolean;
    } = {}
  ): Promise<FileDiscoveryResult> {
    const startTime = Date.now();
    
    try {
      // Normalize patterns and base directory
      const normalizedPatterns = patterns.map(p => resolve(baseDirectory, p));
      const normalizedBase = resolve(baseDirectory);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(normalizedPatterns, normalizedBase, options);
      if (options.enableCaching !== false && this.config.patterns.enableCaching) {
        const cachedResult = this.getFromCache(cacheKey);
        if (cachedResult) {
          this.emit('cacheHit', { patterns, baseDirectory, cacheKey });
          return cachedResult;
        }
      }

      // Determine discovery strategy
      const useParallel = this.config.parallel.enabled && 
                         patterns.length > 1 && 
                         this.workers.length > 0;

      let result: FileDiscoveryResult;

      if (useParallel) {
        result = await this.parallelDiscovery(normalizedPatterns, normalizedBase, options);
      } else {
        result = await this.sequentialDiscovery(normalizedPatterns, normalizedBase, options);
      }

      // Update processing time
      result.statistics.processingTime = Date.now() - startTime;
      result.performance.throughput = result.statistics.totalFiles / (result.statistics.processingTime / 1000);

      // Cache result
      if (options.enableCaching !== false && this.config.patterns.enableCaching) {
        this.cacheResult(cacheKey, result);
      }

      // Record metrics
      if (this.metricsCollector) {
        this.metricsCollector.recordPerformance('parallel_file_discovery', {
          duration: result.statistics.processingTime,
          memory: process.memoryUsage().heapUsed / 1024 / 1024,
          cpu: 0, // Would need process.cpuUsage()
          stage: 'file_discovery',
          operationName: 'discoverFiles',
        });
      }

      this.emit('discoveryComplete', {
        patterns,
        baseDirectory,
        result,
        strategy: useParallel ? 'parallel' : 'sequential',
      });

      return result;

    } catch (error) {
      this.emit('error', { operation: 'discoverFiles', patterns, baseDirectory, error });
      throw error;
    }
  }

  /**
   * Discover files in multiple directories concurrently
   */
  async discoverInMultipleDirectories(
    requests: Array<{
      patterns: string[];
      baseDirectory: string;
      options?: {
        includeMetadata?: boolean;
        followSymlinks?: boolean;
        maxDepth?: number;
        excludePatterns?: string[];
      };
    }>
  ): Promise<Array<{
    baseDirectory: string;
    result: FileDiscoveryResult;
    success: boolean;
    error?: Error;
  }>> {
    const concurrency = Math.min(requests.length, this.config.performance.maxConcurrentOperations);
    const results: Array<any> = [];

    // Process requests in batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (request) => {
        try {
          const result = await this.discoverFiles(
            request.patterns,
            request.baseDirectory,
            request.options
          );
          
          return {
            baseDirectory: request.baseDirectory,
            result,
            success: true,
          };
        } catch (error) {
          return {
            baseDirectory: request.baseDirectory,
            result: this.createEmptyResult(),
            success: false,
            error: error as Error,
          };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            baseDirectory: 'unknown',
            result: this.createEmptyResult(),
            success: false,
            error: result.reason,
          });
        }
      });
    }

    return results;
  }

  /**
   * Watch directories for file changes and update discovery cache
   */
  async watchDirectories(
    directories: string[],
    callback: (event: {
      type: 'added' | 'removed' | 'changed';
      path: string;
      stats?: fs.Stats;
    }) => void
  ): Promise<() => void> {
    const watchers: fs.FSWatcher[] = [];
    
    for (const directory of directories) {
      try {
        const watcher = fs.watch(directory, { recursive: true }, async (eventType, filename) => {
          if (!filename) return;
          
          const fullPath = join(directory, filename);
          
          try {
            const stats = await this.getFileStats(fullPath);
            
            if (eventType === 'rename') {
              // File might be added or removed
              try {
                await fs.access(fullPath);
                callback({ type: 'added', path: fullPath, stats });
              } catch {
                callback({ type: 'removed', path: fullPath });
                this.invalidateCacheForPath(fullPath);
              }
            } else if (eventType === 'change') {
              callback({ type: 'changed', path: fullPath, stats });
              this.invalidateCacheForPath(fullPath);
            }
          } catch (error) {
            // File might have been deleted
            callback({ type: 'removed', path: fullPath });
            this.invalidateCacheForPath(fullPath);
          }
        });
        
        watchers.push(watcher);
      } catch (error) {
        this.emit('error', { operation: 'watchDirectory', directory, error });
      }
    }
    
    // Return cleanup function
    return () => {
      watchers.forEach(watcher => watcher.close());
    };
  }

  /**
   * Get discovery statistics and performance metrics
   */
  getStatistics(): {
    cache: {
      size: number;
      hitRate: number;
      totalHits: number;
      totalMisses: number;
    };
    workers: {
      active: number;
      total: number;
      tasksCompleted: number;
      averageTaskTime: number;
    };
    performance: {
      totalDiscoveries: number;
      averageDiscoveryTime: number;
      filesPerSecond: number;
    };
  } {
    const cacheStats = this.calculateCacheStats();
    
    return {
      cache: cacheStats,
      workers: {
        active: this.activeWorkers.size,
        total: this.workers.length,
        tasksCompleted: this.completedTasks.size,
        averageTaskTime: this.calculateAverageTaskTime(),
      },
      performance: {
        totalDiscoveries: cacheStats.totalHits + cacheStats.totalMisses,
        averageDiscoveryTime: this.calculateAverageDiscoveryTime(),
        filesPerSecond: this.calculateFilesPerSecond(),
      },
    };
  }

  /**
   * Clear all caches and reset statistics
   */
  clearCaches(): void {
    this.resultCache.clear();
    this.statCache.clear();
    this.completedTasks.clear();
    
    this.emit('cachesCleared');
  }

  /**
   * Shutdown the discovery system and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Terminate all workers
    const terminationPromises = this.workers.map(worker => 
      new Promise<void>((resolve) => {
        worker.terminate().then(() => resolve()).catch(() => resolve());
      })
    );
    
    await Promise.allSettled(terminationPromises);
    this.workers.length = 0;
    
    // Clear caches
    this.clearCaches();
    
    // Remove all listeners
    this.removeAllListeners();
  }

  // Private methods

  private async initializeWorkerPool(): Promise<void> {
    const workerScript = this.createWorkerScript();
    
    for (let i = 0; i < this.config.parallel.workerPoolSize; i++) {
      try {
        const worker = new Worker(workerScript, {
          eval: true,
          workerData: { workerId: `discovery-worker-${i}`, config: this.config },
        });
        
        worker.on('message', (result: WorkerDiscoveryResult) => {
          this.handleWorkerResult(result);
        });
        
        worker.on('error', (error) => {
          this.emit('workerError', { workerId: i, error });
        });
        
        worker.on('exit', (code) => {
          if (code !== 0 && !this.isShuttingDown) {
            this.emit('workerExit', { workerId: i, code });
          }
        });
        
        this.workers.push(worker);
      } catch (error) {
        console.warn('Failed to create discovery worker:', error);
      }
    }
  }

  private createWorkerScript(): string {
    return `
      const { parentPort, workerData } = require('worker_threads');
      const fs = require('fs').promises;
      const path = require('path');
      
      if (!parentPort) {
        throw new Error('Worker must be run with parentPort');
      }
      
      class FileDiscoveryWorker {
        constructor(config) {
          this.config = config;
          this.stats = {
            filesFound: 0,
            directoriesTraversed: 0,
            totalSize: 0,
            errors: [],
          };
        }
        
        async discoverFiles(task) {
          const startTime = Date.now();
          const files = [];
          const directories = [];
          
          try {
            for (const pattern of task.patterns) {
              await this.processPattern(pattern, task.baseDirectory, files, directories, task.options);
            }
            
            return {
              taskId: task.id,
              files: files.map(f => ({
                path: f.path,
                size: f.size,
                modified: f.modified.getTime(),
                extension: path.extname(f.path),
                directory: path.dirname(f.path),
                metadata: f.metadata,
              })),
              directories,
              errors: this.stats.errors,
              statistics: {
                filesFound: this.stats.filesFound,
                directoriesTraversed: this.stats.directoriesTraversed,
                totalSize: this.stats.totalSize,
                processingTime: Date.now() - startTime,
              },
            };
          } catch (error) {
            return {
              taskId: task.id,
              files: [],
              directories: [],
              errors: [{ path: task.baseDirectory, error: error.message }],
              statistics: {
                filesFound: 0,
                directoriesTraversed: 0,
                totalSize: 0,
                processingTime: Date.now() - startTime,
              },
            };
          }
        }
        
        async processPattern(pattern, baseDir, files, directories, options) {
          try {
            const entries = await fs.readdir(baseDir, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = path.join(baseDir, entry.name);
              
              if (this.shouldExclude(entry.name, fullPath)) {
                continue;
              }
              
              if (entry.isDirectory()) {
                directories.push(fullPath);
                this.stats.directoriesTraversed++;
                
                if (!options.maxDepth || this.getDepth(fullPath, baseDir) < options.maxDepth) {
                  await this.processPattern(pattern, fullPath, files, directories, options);
                }
              } else if (entry.isFile() || (entry.isSymbolicLink() && options.followSymlinks)) {
                if (this.matchesPattern(fullPath, pattern)) {
                  try {
                    const stats = await fs.stat(fullPath);
                    
                    const fileInfo = {
                      path: fullPath,
                      size: stats.size,
                      modified: stats.mtime,
                      metadata: options.includeMetadata ? {
                        isSymlink: entry.isSymbolicLink(),
                        permissions: stats.mode,
                        uid: stats.uid,
                        gid: stats.gid,
                      } : undefined,
                    };
                    
                    files.push(fileInfo);
                    this.stats.filesFound++;
                    this.stats.totalSize += stats.size;
                  } catch (error) {
                    this.stats.errors.push({ path: fullPath, error: error.message });
                  }
                }
              }
            }
          } catch (error) {
            this.stats.errors.push({ path: baseDir, error: error.message });
          }
        }
        
        shouldExclude(name, fullPath) {
          const excludeDirectories = this.config.filtering.excludeDirectories || [];
          const excludeExtensions = this.config.filtering.excludeExtensions || [];
          
          if (excludeDirectories.includes(name)) {
            return true;
          }
          
          const ext = path.extname(name);
          if (excludeExtensions.includes(ext)) {
            return true;
          }
          
          return false;
        }
        
        matchesPattern(filePath, pattern) {
          // Simplified pattern matching - in production, use a proper glob library
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\\*/g, '.*'));
            return regex.test(filePath);
          }
          return filePath.includes(pattern);
        }
        
        getDepth(fullPath, baseDir) {
          const relativePath = path.relative(baseDir, fullPath);
          return relativePath.split(path.sep).length - 1;
        }
      }
      
      parentPort.on('message', async (task) => {
        const worker = new FileDiscoveryWorker(workerData.config);
        const result = await worker.discoverFiles(task);
        parentPort.postMessage(result);
      });
    `;
  }

  private async parallelDiscovery(
    patterns: string[],
    baseDirectory: string,
    options: any
  ): Promise<FileDiscoveryResult> {
    const tasks: FileDiscoveryTask[] = patterns.map((pattern, index) => ({
      id: `task-${Date.now()}-${index}`,
      patterns: [pattern],
      baseDirectory,
      options: {
        includeMetadata: options.includeMetadata || false,
        followSymlinks: options.followSymlinks || false,
        maxDepth: options.maxDepth,
        excludePatterns: options.excludePatterns,
      },
    }));

    // Distribute tasks to workers
    const taskPromises = tasks.map((task, index) => {
      const worker = this.workers[index % this.workers.length];
      this.activeWorkers.add(task.id);
      
      return new Promise<WorkerDiscoveryResult>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Task ${task.id} timed out`));
        }, this.config.parallel.taskTimeout);
        
        const messageHandler = (result: WorkerDiscoveryResult) => {
          if (result.taskId === task.id) {
            clearTimeout(timeout);
            worker.off('message', messageHandler);
            this.activeWorkers.delete(task.id);
            resolve(result);
          }
        };
        
        worker.on('message', messageHandler);
        worker.postMessage(task);
      });
    });

    // Wait for all tasks to complete
    const results = await Promise.allSettled(taskPromises);
    
    // Aggregate results
    return this.aggregateResults(results, Date.now());
  }

  private async sequentialDiscovery(
    patterns: string[],
    baseDirectory: string,
    options: any
  ): Promise<FileDiscoveryResult> {
    const allFiles: any[] = [];
    const allDirectories: string[] = [];
    const startTime = Date.now();
    let totalSize = 0;
    
    for (const pattern of patterns) {
      const result = await this.discoverSinglePattern(pattern, baseDirectory, options);
      allFiles.push(...result.files);
      allDirectories.push(...result.directories);
      totalSize += result.totalSize;
    }
    
    // Remove duplicates if enabled
    const finalFiles = this.config.patterns.enableDeduplication 
      ? this.deduplicateFiles(allFiles)
      : allFiles;
    
    const finalDirectories = this.config.patterns.enableDeduplication
      ? [...new Set(allDirectories)]
      : allDirectories;
    
    return this.createResult(finalFiles, finalDirectories, totalSize, Date.now() - startTime);
  }

  private async discoverSinglePattern(pattern: string, baseDirectory: string, options: any): Promise<{
    files: any[];
    directories: string[];
    totalSize: number;
  }> {
    const files: any[] = [];
    const directories: string[] = [];
    let totalSize = 0;
    
    const processDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
      if (options.maxDepth && depth > options.maxDepth) {
        return;
      }
      
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);
          
          if (this.shouldExcludePath(entry.name, fullPath)) {
            continue;
          }
          
          if (entry.isDirectory()) {
            directories.push(fullPath);
            await processDirectory(fullPath, depth + 1);
          } else if (entry.isFile()) {
            if (this.matchesPattern(fullPath, pattern)) {
              const stats = await this.getFileStats(fullPath);
              
              if (this.passesFilters(stats)) {
                const fileInfo = {
                  path: fullPath,
                  absolutePath: resolve(fullPath),
                  relativePath: relative(baseDirectory, fullPath),
                  size: stats.size,
                  modified: stats.mtime,
                  extension: this.getFileExtension(fullPath),
                  directory: dirPath,
                  metadata: options.includeMetadata ? {
                    isSymlink: entry.isSymbolicLink(),
                    permissions: stats.mode,
                    uid: stats.uid,
                    gid: stats.gid,
                  } : undefined,
                };
                
                files.push(fileInfo);
                totalSize += stats.size;
              }
            }
          }
        }
      } catch (error) {
        if (!this.config.errorHandling.ignorePermissionErrors || 
            (error as any).code !== 'EPERM') {
          this.emit('error', { operation: 'processDirectory', path: dirPath, error });
        }
      }
    };
    
    await processDirectory(baseDirectory);
    
    return { files, directories, totalSize };
  }

  private handleWorkerResult(result: WorkerDiscoveryResult): void {
    this.completedTasks.set(result.taskId, result);
    this.activeWorkers.delete(result.taskId);
    
    this.emit('taskComplete', result);
  }

  private aggregateResults(
    results: PromiseSettledResult<WorkerDiscoveryResult>[],
    processingTime: number
  ): FileDiscoveryResult {
    const allFiles: any[] = [];
    const allDirectories: string[] = [];
    let totalSize = 0;
    let workersUsed = 0;
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const workerResult = result.value;
        allFiles.push(...workerResult.files.map(f => ({
          ...f,
          modified: new Date(f.modified),
        })));
        allDirectories.push(...workerResult.directories);
        totalSize += workerResult.statistics.totalSize;
        workersUsed++;
      }
    }
    
    // Remove duplicates
    const finalFiles = this.config.patterns.enableDeduplication 
      ? this.deduplicateFiles(allFiles)
      : allFiles;
    
    const finalDirectories = this.config.patterns.enableDeduplication
      ? [...new Set(allDirectories)]
      : allDirectories;
    
    return this.createResult(finalFiles, finalDirectories, totalSize, processingTime, workersUsed);
  }

  private createResult(
    files: any[],
    directories: string[],
    totalSize: number,
    processingTime: number,
    workersUsed: number = 1
  ): FileDiscoveryResult {
    const extensionCounts: Record<string, number> = {};
    const directoryCounts: Record<string, number> = {};
    
    // Calculate statistics
    for (const file of files) {
      const ext = file.extension || 'none';
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
      
      const dir = file.directory;
      directoryCounts[dir] = (directoryCounts[dir] || 0) + 1;
    }
    
    return {
      files,
      directories,
      statistics: {
        totalFiles: files.length,
        totalDirectories: directories.length,
        totalSize,
        processingTime,
        averageFileSize: files.length > 0 ? totalSize / files.length : 0,
        extensionCounts,
        directoryCounts,
      },
      performance: {
        workersUsed,
        parallelEfficiency: workersUsed > 1 ? Math.min(1, files.length / (workersUsed * 100)) : 1,
        throughput: files.length / (processingTime / 1000),
        cacheHitRate: this.calculateCacheHitRate(),
      },
    };
  }

  private createEmptyResult(): FileDiscoveryResult {
    return {
      files: [],
      directories: [],
      statistics: {
        totalFiles: 0,
        totalDirectories: 0,
        totalSize: 0,
        processingTime: 0,
        averageFileSize: 0,
        extensionCounts: {},
        directoryCounts: {},
      },
      performance: {
        workersUsed: 0,
        parallelEfficiency: 0,
        throughput: 0,
        cacheHitRate: 0,
      },
    };
  }

  private deduplicateFiles(files: any[]): any[] {
    const seen = new Set<string>();
    return files.filter(file => {
      if (seen.has(file.absolutePath)) {
        return false;
      }
      seen.add(file.absolutePath);
      return true;
    });
  }

  private async getFileStats(filePath: string): Promise<fs.Stats> {
    if (this.config.filesystem.enableStatCache) {
      const cached = this.statCache.get(filePath);
      if (cached && Date.now() - cached.timestamp < this.config.filesystem.statCacheTTL) {
        cached.hits++;
        return cached.data;
      }
    }
    
    const stats = await fs.stat(filePath);
    
    if (this.config.filesystem.enableStatCache) {
      this.statCache.set(filePath, {
        data: stats,
        timestamp: Date.now(),
        hits: 1,
      });
      
      // Cleanup old entries
      if (this.statCache.size > this.config.filesystem.statCacheSize) {
        this.cleanupStatCache();
      }
    }
    
    return stats;
  }

  private passesFilters(stats: fs.Stats): boolean {
    if (!this.config.filtering.enableSizeFiltering) {
      return true;
    }
    
    return stats.size >= this.config.filtering.minFileSize &&
           stats.size <= this.config.filtering.maxFileSize;
  }

  private shouldExcludePath(name: string, fullPath: string): boolean {
    return this.config.filtering.excludeDirectories.includes(name) ||
           this.config.filtering.excludeExtensions.includes(this.getFileExtension(fullPath));
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simplified pattern matching - in production, use minimatch or similar
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  }

  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot > 0 ? filePath.substring(lastDot) : '';
  }

  private generateCacheKey(patterns: string[], baseDirectory: string, options: any): string {
    return `${patterns.join('|')}:${baseDirectory}:${JSON.stringify(options)}`;
  }

  private getFromCache(key: string): FileDiscoveryResult | null {
    const entry = this.resultCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.config.patterns.cacheTTL) {
      entry.hits++;
      return entry.data;
    }
    return null;
  }

  private cacheResult(key: string, result: FileDiscoveryResult): void {
    this.resultCache.set(key, {
      data: result,
      timestamp: Date.now(),
      hits: 1,
    });
    
    // Cleanup if cache is too large
    if (this.resultCache.size > this.config.patterns.cacheSize) {
      this.cleanupResultCache();
    }
  }

  private invalidateCacheForPath(path: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.resultCache.entries()) {
      if (key.includes(path)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.resultCache.delete(key));
  }

  private cleanupResultCache(): void {
    const entries = Array.from(this.resultCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = entries.slice(0, Math.floor(entries.length * 0.2));
    toDelete.forEach(([key]) => this.resultCache.delete(key));
  }

  private cleanupStatCache(): void {
    const entries = Array.from(this.statCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = entries.slice(0, Math.floor(entries.length * 0.2));
    toDelete.forEach(([key]) => this.statCache.delete(key));
  }

  private setupCacheCleanup(): void {
    setInterval(() => {
      this.cleanupResultCache();
      this.cleanupStatCache();
    }, this.config.patterns.cacheTTL);
  }

  private calculateCacheStats(): {
    size: number;
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  } {
    let totalHits = 0;
    let totalRequests = 0;
    
    for (const entry of this.resultCache.values()) {
      totalHits += entry.hits;
      totalRequests += entry.hits;
    }
    
    // Add cache misses (simplified)
    const totalMisses = totalRequests - totalHits;
    
    return {
      size: this.resultCache.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalHits,
      totalMisses,
    };
  }

  private calculateAverageTaskTime(): number {
    const tasks = Array.from(this.completedTasks.values());
    if (tasks.length === 0) return 0;
    
    const totalTime = tasks.reduce((sum, task) => sum + task.statistics.processingTime, 0);
    return totalTime / tasks.length;
  }

  private calculateAverageDiscoveryTime(): number {
    // Simplified calculation
    return this.calculateAverageTaskTime();
  }

  private calculateFilesPerSecond(): number {
    const tasks = Array.from(this.completedTasks.values());
    if (tasks.length === 0) return 0;
    
    const totalFiles = tasks.reduce((sum, task) => sum + task.statistics.filesFound, 0);
    const totalTime = tasks.reduce((sum, task) => sum + task.statistics.processingTime, 0);
    
    return totalTime > 0 ? (totalFiles / totalTime) * 1000 : 0;
  }

  private calculateCacheHitRate(): number {
    return this.calculateCacheStats().hitRate;
  }
}