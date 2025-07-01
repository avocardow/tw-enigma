/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, relative, resolve } from 'path';
import { createLogger } from '../utils/logger';
import { AtomicContext, atomicOpManager } from './atomicOpManager';
import type { OptimizationContext, OptimizationResult, WatchEvent } from './types';

const logger = createLogger('EnhancedIncrementalOptimizer');

/**
 * File metadata for dependency tracking
 */
export interface FileMetadata {
  path: string;
  hash: string;
  mtime: number;
  size: number;
  dependencies: string[];
  dependents: string[];
  lastOptimized?: number;
  optimizationResult?: OptimizationResult;
}

/**
 * Dependency graph for tracking file relationships
 */
export interface DependencyGraph {
  files: Map<string, FileMetadata>;
  lastBuild: number;
  version: string;
}

/**
 * Incremental optimization configuration
 */
export interface IncrementalConfig {
  enabled: boolean;
  cacheDir: string;
  maxCacheSize: number;
  maxCacheAge: number;
  trackDependencies: boolean;
  fallbackToFullRebuild: boolean;
  checksumAlgorithm: 'md5' | 'sha1' | 'sha256';
  parallelOptimization: boolean;
  maxConcurrency: number;
}

/**
 * Optimization strategy for incremental processing
 */
export interface OptimizationStrategy {
  id: string;
  name: string;
  canOptimize: (filePath: string) => boolean;
  extractDependencies: (filePath: string, content: string) => Promise<string[]>;
  optimize: (filePath: string, context: OptimizationContext) => Promise<OptimizationResult>;
  priority: number;
}

/**
 * Corruption detection result
 */
export interface CorruptionCheckResult {
  isCorrupt: boolean;
  issues: string[];
  recoverable: boolean;
  affectedFiles: string[];
  recommendedAction: 'repair' | 'rebuild' | 'ignore';
}

/**
 * Partial failure simulation configuration
 */
export interface FailureSimulationConfig {
  enabled: boolean;
  failureRate: number; // 0.0 to 1.0
  failureTypes: (
    | 'dependency_corruption'
    | 'cache_corruption'
    | 'lock_timeout'
    | 'optimization_error'
  )[];
  targetOperations: string[];
  maxFailures: number;
}

/**
 * Enhanced incremental optimizer with atomic operations and advanced failure handling
 */
export class EnhancedIncrementalOptimizer extends EventEmitter {
  protected dependencyGraph: DependencyGraph;
  protected strategies: Map<string, OptimizationStrategy> = new Map();
  protected config: IncrementalConfig;
  protected cacheFile: string;
  private isProcessing = false;
  private processQueue: WatchEvent[] = [];
  private corruptionCheckInterval?: NodeJS.Timeout;
  private failureSimulation: FailureSimulationConfig;
  private failureCount = 0;

  constructor(
    config: Partial<IncrementalConfig> = {},
    failureSimConfig: Partial<FailureSimulationConfig> = {}
  ) {
    super();

    this.config = this.mergeConfig(config);
    this.cacheFile = join(this.config.cacheDir, 'incremental-cache.json');
    this.dependencyGraph = this.createEmptyGraph();

    this.failureSimulation = {
      enabled: false,
      failureRate: 0.0,
      failureTypes: ['dependency_corruption', 'cache_corruption'],
      targetOperations: ['dependency_update', 'cache_save'],
      maxFailures: 5,
      ...failureSimConfig,
    };

    // Setup default strategies
    this.setupDefaultStrategies();

    // Load existing cache
    this.loadCache().catch((error) => {
      logger.warn('Failed to load incremental cache', { error });
    });

    // Start periodic corruption checking
    this.startCorruptionChecking();

    logger.debug('EnhancedIncrementalOptimizer initialized', {
      config: this.config,
      failureSimulation: this.failureSimulation,
    });
  }

  /**
   * Process file change events with atomic operations
   */
  async processChange(event: WatchEvent): Promise<OptimizationResult[]> {
    const filePath = resolve(event.path);

    return atomicOpManager.executeWrite(
      'process_file_change',
      [`dependency_graph`, `file:${filePath}`],
      async (context: AtomicContext<WatchEvent>) => {
        logger.debug('Processing incremental change atomically', {
          path: relative(process.cwd(), filePath),
          type: event.type,
          contextId: context.id,
        });

        try {
          // Simulate failures if enabled
          this.simulateFailure('process_change');

          // Handle different event types
          switch (event.type) {
            case 'add':
            case 'change':
              return await this.handleFileChange(filePath);
            case 'unlink':
              return await this.handleFileDelete(filePath);
            case 'addDir':
            case 'unlinkDir':
              // Directory events don't require optimization
              return [];
            default:
              logger.warn('Unknown event type', { type: event.type, path: filePath });
              return [];
          }
        } catch (error) {
          logger.error('Error in atomic file change processing', {
            error: error instanceof Error ? error.message : String(error),
            path: filePath,
            contextId: context.id,
          });

          // Check for corruption and potentially recover
          await this.handleOptimizationFailure(filePath, error);

          // Fallback to full rebuild if configured
          if (this.config.fallbackToFullRebuild) {
            return await this.performFullRebuild();
          }

          throw error;
        }
      },
      event
    );
  }

  /**
   * Handle file change (add/modify) with enhanced error handling
   */
  private async handleFileChange(filePath: string): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    try {
      // Get current file metadata
      const currentMetadata = await this.getFileMetadata(filePath);
      const existingMetadata = this.dependencyGraph.files.get(filePath);

      // Check if file actually changed
      if (existingMetadata && currentMetadata.hash === existingMetadata.hash) {
        logger.debug('File hash unchanged, skipping optimization', {
          path: relative(process.cwd(), filePath),
        });
        return results;
      }

      // Update dependency graph atomically
      await this.updateDependencies(filePath, currentMetadata);

      // Find all files that need to be re-optimized
      const filesToOptimize = await this.findAffectedFiles(filePath);

      logger.info('Incremental optimization required', {
        changed: relative(process.cwd(), filePath),
        affected: filesToOptimize.length,
        files: filesToOptimize.map((f) => relative(process.cwd(), f)).slice(0, 5),
      });

      // Optimize affected files
      if (this.config.parallelOptimization) {
        results.push(...(await this.optimizeFilesParallel(filesToOptimize)));
      } else {
        results.push(...(await this.optimizeFilesSequential(filesToOptimize)));
      }

      // Update graph with optimization results
      this.updateOptimizationResults(filesToOptimize, results);

      // Save cache atomically
      await this.saveCache();

      this.emit('incremental-optimization-complete', {
        changedFile: filePath,
        affectedFiles: filesToOptimize,
        results,
      });
    } catch (error) {
      logger.error('Error handling file change', { error, path: filePath });
      results.push(this.createErrorResult(filePath, error));
    }

    return results;
  }

  /**
   * Handle file deletion with atomic operations
   */
  private async handleFileDelete(filePath: string): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    try {
      const metadata = this.dependencyGraph.files.get(filePath);
      if (!metadata) {
        logger.debug('File not in dependency graph, skipping delete', {
          path: relative(process.cwd(), filePath),
        });
        return results;
      }

      // Find dependents that need re-optimization
      const dependents = [...metadata.dependents];

      // Remove from graph
      this.removeFromGraph(filePath);

      // Re-optimize dependents
      if (dependents.length > 0) {
        logger.info('Re-optimizing dependents after file deletion', {
          deleted: relative(process.cwd(), filePath),
          dependents: dependents.length,
        });

        for (const dependent of dependents) {
          try {
            const result = await this.optimizeFile(dependent);
            results.push(result);
          } catch (error) {
            logger.error('Failed to optimize dependent after deletion', {
              dependent,
              error: error instanceof Error ? error.message : String(error),
            });
            results.push(this.createErrorResult(dependent, error));
          }
        }
      }

      // Save updated cache
      await this.saveCache();

      this.emit('file-deleted', {
        deletedFile: filePath,
        affectedFiles: dependents,
        results,
      });
    } catch (error) {
      logger.error('Error handling file deletion', { error, path: filePath });
      results.push(this.createErrorResult(filePath, error));
    }

    return results;
  }

  /**
   * Find affected files that need re-optimization
   */
  private async findAffectedFiles(changedFile: string): Promise<string[]> {
    const affected = new Set<string>();
    const visited = new Set<string>();

    const collectAffected = (filePath: string) => {
      if (visited.has(filePath)) return;
      visited.add(filePath);

      affected.add(filePath);

      const metadata = this.dependencyGraph.files.get(filePath);
      if (metadata) {
        for (const dependent of metadata.dependents) {
          collectAffected(dependent);
        }
      }
    };

    collectAffected(changedFile);
    return Array.from(affected);
  }

  /**
   * Optimize files in parallel
   */
  private async optimizeFilesParallel(files: string[]): Promise<OptimizationResult[]> {
    const concurrency = Math.min(this.config.maxConcurrency, files.length);
    const results: OptimizationResult[] = [];

    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((file) =>
          this.optimizeFile(file).catch((error) => this.createErrorResult(file, error))
        )
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Optimize files sequentially
   */
  private async optimizeFilesSequential(files: string[]): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    for (const file of files) {
      try {
        const result = await this.optimizeFile(file);
        results.push(result);
      } catch (error) {
        results.push(this.createErrorResult(file, error));
      }
    }

    return results;
  }

  /**
   * Optimize a single file
   */
  private async optimizeFile(filePath: string): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      const strategy = this.findStrategy(filePath);
      if (!strategy) {
        return this.createSkipResult(filePath, 'No optimization strategy found');
      }

      const context: OptimizationContext = {
        changedFiles: [filePath],
        event: { type: 'change', path: filePath, timestamp: new Date() },
        config: {
          enabled: true,
          mode: 'development',
          hotReload: false,
          autoRefresh: false,
          notifications: false,
          performance: {
            throttleMs: 100,
            batchSize: 10,
            maxConcurrency: this.config.maxConcurrency,
          },
          integrations: {
            devServer: false,
            browser: false,
            editor: false,
            terminal: false,
          },
          caching: {
            enabled: true,
            strategy: 'memory',
            maxAge: 300000,
            maxSize: 1000,
          },
          logging: {
            level: 'info',
            verbose: false,
            timestamped: true,
          },
        },
        cache: new Map(),
        startTime: new Date(startTime),
        metadata: {},
      };

      const result = await strategy.optimize(filePath, context);

      logger.debug('File optimized successfully', {
        path: relative(process.cwd(), filePath),
        duration: Date.now() - startTime,
        strategy: strategy.name,
      });

      return result;
    } catch (error) {
      logger.error('Optimization failed', {
        path: relative(process.cwd(), filePath),
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Find optimization strategy for file
   */
  private findStrategy(filePath: string): OptimizationStrategy | null {
    const strategies = Array.from(this.strategies.values())
      .filter((strategy) => strategy.canOptimize(filePath))
      .sort((a, b) => b.priority - a.priority);

    return strategies[0] || null;
  }

  /**
   * Atomically update dependency graph
   */
  private async updateDependencies(filePath: string, metadata: FileMetadata): Promise<void> {
    await atomicOpManager.executeWrite(
      'update_dependencies',
      [`dependency_graph`, `file:${filePath}`],
      async (context: AtomicContext<{ filePath: string; metadata: FileMetadata }>) => {
        logger.debug('Updating dependencies atomically', {
          filePath: relative(process.cwd(), filePath),
          contextId: context.id,
        });

        try {
          // Simulate failures if enabled
          this.simulateFailure('dependency_update');

          // Extract dependencies using strategies
          await this.extractAndUpdateDependencies(filePath, metadata);

          // Validate graph integrity
          await this.validateDependencyIntegrity(filePath);
        } catch (error) {
          logger.error('Failed to update dependencies atomically', {
            error: error instanceof Error ? error.message : String(error),
            filePath,
            contextId: context.id,
          });
          throw error;
        }
      },
      { filePath, metadata }
    );
  }

  /**
   * Extract and update file dependencies with enhanced error handling
   */
  private async extractAndUpdateDependencies(
    filePath: string,
    metadata: FileMetadata
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const strategy = this.findStrategy(filePath);

      if (strategy) {
        metadata.dependencies = await strategy.extractDependencies(filePath, content);

        // Validate dependencies exist and are accessible
        const validDependencies: string[] = [];
        for (const dep of metadata.dependencies) {
          try {
            await fs.access(dep);
            validDependencies.push(dep);
          } catch (error) {
            logger.warn('Dependency not accessible, excluding from graph', {
              dependency: dep,
              source: filePath,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        metadata.dependencies = validDependencies;
      }

      // Update the dependency graph
      this.dependencyGraph.files.set(filePath, metadata);
      this.updateReverseDependencies(filePath, metadata);
    } catch (error) {
      logger.error('Failed to extract dependencies', {
        error: error instanceof Error ? error.message : String(error),
        filePath,
      });
      throw error;
    }
  }

  /**
   * Update reverse dependencies (dependents)
   */
  private updateReverseDependencies(filePath: string, metadata: FileMetadata): void {
    const oldMetadata = this.dependencyGraph.files.get(filePath);

    // Remove old reverse dependencies
    if (oldMetadata) {
      for (const dep of oldMetadata.dependencies) {
        const depMetadata = this.dependencyGraph.files.get(dep);
        if (depMetadata) {
          depMetadata.dependents = depMetadata.dependents.filter((d) => d !== filePath);
        }
      }
    }

    // Add new reverse dependencies
    for (const dep of metadata.dependencies) {
      const depMetadata = this.dependencyGraph.files.get(dep);
      if (depMetadata) {
        if (!depMetadata.dependents.includes(filePath)) {
          depMetadata.dependents.push(filePath);
        }
      }
    }
  }

  /**
   * Remove file from dependency graph
   */
  private removeFromGraph(filePath: string): void {
    const metadata = this.dependencyGraph.files.get(filePath);
    if (!metadata) return;

    // Remove reverse dependencies
    for (const dep of metadata.dependencies) {
      const depMetadata = this.dependencyGraph.files.get(dep);
      if (depMetadata) {
        depMetadata.dependents = depMetadata.dependents.filter((d) => d !== filePath);
      }
    }

    // Remove from dependents of other files
    for (const dependent of metadata.dependents) {
      const depMetadata = this.dependencyGraph.files.get(dependent);
      if (depMetadata) {
        depMetadata.dependencies = depMetadata.dependencies.filter((d) => d !== filePath);
      }
    }

    // Remove from graph
    this.dependencyGraph.files.delete(filePath);
  }

  /**
   * Get file metadata
   */
  private async getFileMetadata(filePath: string): Promise<FileMetadata> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath);
      const hash = createHash(this.config.checksumAlgorithm).update(content).digest('hex');

      return {
        path: filePath,
        hash,
        mtime: stats.mtimeMs,
        size: stats.size,
        dependencies: [],
        dependents: [],
      };
    } catch (error) {
      logger.error('Failed to get file metadata', { error, path: filePath });
      throw error;
    }
  }

  /**
   * Update optimization results in graph
   */
  private updateOptimizationResults(files: string[], results: OptimizationResult[]): void {
    const now = Date.now();

    for (let i = 0; i < files.length && i < results.length; i++) {
      const filePath = files[i];
      const result = results[i];
      const metadata = this.dependencyGraph.files.get(filePath);

      if (metadata) {
        metadata.lastOptimized = now;
        metadata.optimizationResult = result;
      }
    }
  }

  /**
   * Perform full rebuild fallback
   */
  private async performFullRebuild(): Promise<OptimizationResult[]> {
    logger.info('Performing full rebuild fallback');

    // Clear dependency graph
    this.dependencyGraph = this.createEmptyGraph();

    // This would trigger a full optimization pipeline
    // For now, return empty results
    return [];
  }

  /**
   * Atomically save cache with corruption detection
   */
  private async saveCache(): Promise<void> {
    await atomicOpManager.executeWrite(
      'save_cache',
      ['cache_file'],
      async (context: AtomicContext<void>) => {
        logger.debug('Saving cache atomically', { contextId: context.id });

        try {
          // Simulate failures if enabled
          this.simulateFailure('cache_save');

          // Validate cache integrity before saving
          const validation = await this.validateCacheIntegrity();
          if (!validation.isValid) {
            throw new Error(`Cache corruption detected: ${validation.issues.join(', ')}`);
          }

          // Create backup of existing cache
          const backupPath = `${this.cacheFile}.backup.${Date.now()}`;
          try {
            await fs.copyFile(this.cacheFile, backupPath);
          } catch (error) {
            // Backup creation is optional, continue if it fails
            logger.warn('Failed to create cache backup', {
              error: error instanceof Error ? error.message : String(error),
            });
          }

          // Save cache with checksum
          await this.saveCacheWithChecksum();

          // Verify saved cache
          await this.verifySavedCache();

          // Clean up old backups (keep last 5)
          await this.cleanupCacheBackups();
        } catch (error) {
          logger.error('Failed to save cache atomically', {
            error: error instanceof Error ? error.message : String(error),
            contextId: context.id,
          });

          // Attempt cache recovery
          await this.recoverCorruptedCache();
          throw error;
        }
      },
      undefined
    );
  }

  /**
   * Load cache from disk with validation
   */
  private async loadCache(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });

      const cacheData = await fs.readFile(this.cacheFile, 'utf-8');
      const parsed = JSON.parse(cacheData);

      // Validate cache integrity
      const validation = await this.validateCacheIntegrity();
      if (!validation.isValid) {
        logger.warn('Cache integrity check failed, starting fresh', {
          issues: validation.issues,
        });
        return;
      }

      // Validate and convert cache data
      if (parsed.version === this.dependencyGraph.version) {
        this.dependencyGraph.files = new Map(parsed.files || []);
        this.dependencyGraph.lastBuild = parsed.lastBuild || 0;

        logger.debug('Incremental cache loaded', {
          files: this.dependencyGraph.files.size,
          lastBuild: new Date(this.dependencyGraph.lastBuild),
        });
      } else {
        logger.info('Cache version mismatch, starting fresh');
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.warn('Failed to load cache', { error });
      }
    }
  }

  /**
   * Setup default optimization strategies
   */
  private setupDefaultStrategies(): void {
    // CSS/SCSS strategy
    this.addStrategy({
      id: 'css-optimizer',
      name: 'CSS/SCSS Optimizer',
      priority: 1,
      canOptimize: (filePath) => /\.(css|scss|sass|less|styl)$/.test(filePath),
      extractDependencies: async (filePath, content) => {
        // Extract @import statements
        const imports = content.match(/@import\s+['"]([^'"]+)['"]/g) || [];
        return imports
          .map((imp) => {
            const match = imp.match(/@import\s+['"]([^'"]+)['"]/);
            return match ? resolve(filePath, '..', match[1]) : '';
          })
          .filter(Boolean);
      },
      optimize: async (filePath, _context) => {
        // Placeholder CSS optimization
        return {
          success: true,
          duration: 0,
          filesProcessed: 1,
          bytesOptimized: 0,
          warnings: [],
          errors: [],
          metadata: { type: 'css', filePath },
        };
      },
    });

    // JavaScript/TypeScript strategy
    this.addStrategy({
      id: 'js-optimizer',
      name: 'JavaScript/TypeScript Optimizer',
      priority: 2,
      canOptimize: (filePath) => /\.(js|jsx|ts|tsx)$/.test(filePath),
      extractDependencies: async (filePath, content) => {
        // Extract import/require statements (simplified)
        const imports = content.match(/(?:import|require)\s*\(['""]([^'""]+)['"]\)/g) || [];
        return imports
          .map((imp) => {
            const match = imp.match(/(?:import|require)\s*\(['""]([^'""]+)['"]\)/);
            return match ? resolve(filePath, '..', match[1]) : '';
          })
          .filter(Boolean);
      },
      optimize: async (filePath, _context) => {
        // Placeholder JavaScript optimization
        return {
          success: true,
          duration: 0,
          filesProcessed: 1,
          bytesOptimized: 0,
          warnings: [],
          errors: [],
          metadata: { type: 'javascript', filePath },
        };
      },
    });
  }

  /**
   * Add optimization strategy
   */
  addStrategy(strategy: OptimizationStrategy): void {
    this.strategies.set(strategy.id, strategy);
    logger.debug('Optimization strategy added', { id: strategy.id, name: strategy.name });
  }

  /**
   * Remove optimization strategy
   */
  removeStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
    logger.debug('Optimization strategy removed', { id: strategyId });
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.dependencyGraph = this.createEmptyGraph();

    try {
      await fs.unlink(this.cacheFile);
      logger.info('Cache cleared');
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.warn('Failed to delete cache file', { error });
      }
    }
  }

  /**
   * Create empty dependency graph
   */
  private createEmptyGraph(): DependencyGraph {
    return {
      files: new Map(),
      lastBuild: 0,
      version: '1.0.0',
    };
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<IncrementalConfig>): IncrementalConfig {
    return {
      enabled: true,
      cacheDir: '.cache/incremental',
      maxCacheSize: 100,
      maxCacheAge: 86400000, // 24 hours
      trackDependencies: true,
      fallbackToFullRebuild: true,
      checksumAlgorithm: 'sha256',
      parallelOptimization: true,
      maxConcurrency: 4,
      ...config,
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(filePath: string, error: any, duration = 0): OptimizationResult {
    return {
      success: false,
      duration,
      filesProcessed: 0,
      bytesOptimized: 0,
      warnings: [],
      errors: [error instanceof Error ? error.message : String(error)],
      metadata: { filePath, error: true },
    };
  }

  /**
   * Create skip result
   */
  private createSkipResult(filePath: string, reason: string): OptimizationResult {
    return {
      success: true,
      duration: 0,
      filesProcessed: 0,
      bytesOptimized: 0,
      warnings: [reason],
      errors: [],
      metadata: { filePath, skipped: true, reason },
    };
  }

  /**
   * Validate dependency graph integrity
   */
  private async validateDependencyIntegrity(filePath?: string): Promise<void> {
    const filesToCheck = filePath ? [filePath] : Array.from(this.dependencyGraph.files.keys());

    for (const file of filesToCheck) {
      const metadata = this.dependencyGraph.files.get(file);
      if (!metadata) continue;

      // Check for circular dependencies
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const hasCycle = (currentFile: string): boolean => {
        if (recursionStack.has(currentFile)) {
          throw new Error(`Circular dependency detected starting from ${currentFile}`);
        }

        if (visited.has(currentFile)) {
          return false;
        }

        visited.add(currentFile);
        recursionStack.add(currentFile);

        const currentMetadata = this.dependencyGraph.files.get(currentFile);
        if (currentMetadata) {
          for (const dep of currentMetadata.dependencies) {
            if (hasCycle(dep)) {
              return true;
            }
          }
        }

        recursionStack.delete(currentFile);
        return false;
      };

      hasCycle(file);

      // Validate bidirectional consistency
      for (const dep of metadata.dependencies) {
        const depMetadata = this.dependencyGraph.files.get(dep);
        if (depMetadata && !depMetadata.dependents.includes(file)) {
          logger.warn('Inconsistent reverse dependency, fixing', {
            file,
            dependency: dep,
          });
          depMetadata.dependents.push(file);
        }
      }
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): any {
    return {
      files: this.dependencyGraph.files.size,
      lastBuild: this.dependencyGraph.lastBuild,
      strategies: this.strategies.size,
      isProcessing: this.isProcessing,
      processQueueSize: this.processQueue.length,
    };
  }

  /**
   * Check for corruption in the optimization state
   */
  async checkForCorruption(): Promise<CorruptionCheckResult> {
    const issues: string[] = [];
    const affectedFiles: string[] = [];
    let recoverable = true;

    try {
      // Check dependency graph consistency
      for (const [filePath, metadata] of this.dependencyGraph.files.entries()) {
        // Check if file still exists
        try {
          await fs.access(filePath);
        } catch (error) {
          issues.push(`File no longer exists: ${filePath}`);
          affectedFiles.push(filePath);
          continue;
        }

        // Check metadata integrity
        if (!metadata.hash || !metadata.mtime || !Array.isArray(metadata.dependencies)) {
          issues.push(`Corrupted metadata for ${filePath}`);
          affectedFiles.push(filePath);
          recoverable = false;
        }

        // Check reverse dependencies consistency
        for (const dep of metadata.dependencies) {
          const depMetadata = this.dependencyGraph.files.get(dep);
          if (depMetadata && !depMetadata.dependents.includes(filePath)) {
            issues.push(`Missing reverse dependency: ${dep} -> ${filePath}`);
            affectedFiles.push(filePath);
          }
        }
      }

      // Check cache file integrity
      if (await this.cacheFileExists()) {
        const cacheValidation = await this.validateCacheIntegrity();
        if (!cacheValidation.isValid) {
          issues.push(...cacheValidation.issues);
          recoverable = cacheValidation.recoverable;
        }
      }
    } catch (_error) {
      issues.push(
        `Corruption check failed: ${_error instanceof Error ? _error.message : String(_error)}`
      );
      recoverable = false;
    }

    const isCorrupt = issues.length > 0;
    const recommendedAction: 'repair' | 'rebuild' | 'ignore' = !isCorrupt
      ? 'ignore'
      : recoverable
        ? 'repair'
        : 'rebuild';

    return {
      isCorrupt,
      issues,
      recoverable,
      affectedFiles,
      recommendedAction,
    };
  }

  /**
   * Handle optimization failures with recovery strategies
   */
  private async handleOptimizationFailure(filePath: string, error: unknown): Promise<void> {
    logger.warn('Handling optimization failure', {
      filePath: relative(process.cwd(), filePath),
      error: error instanceof Error ? error.message : String(error),
    });

    // Check for corruption
    const corruption = await this.checkForCorruption();

    if (corruption.isCorrupt) {
      logger.error('Corruption detected after failure', {
        issues: corruption.issues,
        recommendedAction: corruption.recommendedAction,
        affectedFiles: corruption.affectedFiles.length,
      });

      if (corruption.recommendedAction === 'repair' && corruption.recoverable) {
        await this.repairCorruption(corruption);
      } else if (corruption.recommendedAction === 'rebuild') {
        await this.performFullRebuild();
      }
    }
  }

  /**
   * Repair corrupted optimization state
   */
  private async repairCorruption(corruption: CorruptionCheckResult): Promise<void> {
    logger.info('Attempting to repair corruption', {
      issueCount: corruption.issues.length,
      affectedFiles: corruption.affectedFiles.length,
    });

    // Remove corrupted files from graph
    for (const filePath of corruption.affectedFiles) {
      this.removeFromGraph(filePath);
    }

    // Rebuild dependencies for remaining files
    for (const [filePath, _metadata] of this.dependencyGraph.files.entries()) {
      try {
        const updatedMetadata = await this.getFileMetadata(filePath);
        await this.updateDependencies(filePath, updatedMetadata);
      } catch (error) {
        logger.warn('Failed to repair file, removing from graph', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
        this.removeFromGraph(filePath);
      }
    }

    // Save repaired state
    await this.saveCache();

    logger.info('Corruption repair completed');
  }

  /**
   * Validate cache file integrity
   */
  private async validateCacheIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    recoverable: boolean;
  }> {
    const issues: string[] = [];
    let recoverable = true;

    try {
      if (!(await this.cacheFileExists())) {
        return { isValid: true, issues: [], recoverable: true }; // No cache file is valid
      }

      const cacheData = await fs.readFile(this.cacheFile, 'utf-8');
      const parsed = JSON.parse(cacheData);

      // Validate structure
      if (!parsed.version || !parsed.files || !Array.isArray(parsed.files)) {
        issues.push('Invalid cache file structure');
        recoverable = false;
      }

      // Validate checksum if present
      if (parsed.checksum) {
        const content = JSON.stringify({
          version: parsed.version,
          files: parsed.files,
          lastBuild: parsed.lastBuild,
        });
        const expectedChecksum = createHash('sha256').update(content).digest('hex');
        if (parsed.checksum !== expectedChecksum) {
          issues.push('Cache checksum mismatch');
          recoverable = true; // Can rebuild cache
        }
      }
    } catch (error) {
      issues.push(
        `Cache validation error: ${error instanceof Error ? error.message : String(error)}`
      );
      recoverable = true;
    }

    return {
      isValid: issues.length === 0,
      issues,
      recoverable,
    };
  }

  /**
   * Save cache with integrity checksum
   */
  private async saveCacheWithChecksum(): Promise<void> {
    const cacheData = {
      version: this.dependencyGraph.version,
      lastBuild: Date.now(),
      files: Array.from(this.dependencyGraph.files.entries()),
    };

    // Calculate checksum
    const content = JSON.stringify(cacheData);
    const checksum = createHash('sha256').update(content).digest('hex');

    const cacheWithChecksum = {
      ...cacheData,
      checksum,
    };

    await fs.writeFile(this.cacheFile, JSON.stringify(cacheWithChecksum, null, 2));
  }

  /**
   * Verify saved cache file
   */
  private async verifySavedCache(): Promise<void> {
    const validation = await this.validateCacheIntegrity();
    if (!validation.isValid) {
      throw new Error(`Saved cache is invalid: ${validation.issues.join(', ')}`);
    }
  }

  /**
   * Recover from corrupted cache
   */
  private async recoverCorruptedCache(): Promise<void> {
    logger.warn('Attempting cache recovery');

    // Try to restore from backup
    const backupFiles = await this.findCacheBackups();

    for (const backupFile of backupFiles) {
      try {
        await fs.copyFile(backupFile, this.cacheFile);
        const validation = await this.validateCacheIntegrity();

        if (validation.isValid) {
          logger.info('Successfully recovered cache from backup', { backupFile });
          return;
        }
      } catch (error) {
        logger.warn('Failed to restore from backup', {
          backupFile,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // If no backup worked, clear cache and rebuild
    logger.warn('No valid backup found, clearing cache');
    await this.clearCache();
  }

  /**
   * Find cache backup files
   */
  private async findCacheBackups(): Promise<string[]> {
    try {
      const cacheDir = join(this.cacheFile, '..');
      const files = await fs.readdir(cacheDir);

      return files
        .filter((file) => file.startsWith('incremental-cache.json.backup.'))
        .map((file) => join(cacheDir, file))
        .sort((a, b) => {
          // Sort by timestamp (newest first)
          const timestampA = parseInt(a.split('.').pop() || '0');
          const timestampB = parseInt(b.split('.').pop() || '0');
          return timestampB - timestampA;
        });
    } catch (error) {
      logger.warn('Failed to find cache backups', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Clean up old cache backups
   */
  private async cleanupCacheBackups(): Promise<void> {
    try {
      const backups = await this.findCacheBackups();

      // Keep only the 5 most recent backups
      const toDelete = backups.slice(5);

      for (const backup of toDelete) {
        await fs.unlink(backup);
        logger.debug('Deleted old cache backup', { backup });
      }
    } catch (error) {
      logger.warn('Failed to cleanup cache backups', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if cache file exists
   */
  private async cacheFileExists(): Promise<boolean> {
    try {
      await fs.access(this.cacheFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start periodic corruption checking
   */
  private startCorruptionChecking(): void {
    // Check for corruption every 5 minutes
    this.corruptionCheckInterval = setInterval(
      async () => {
        try {
          const corruption = await this.checkForCorruption();

          if (corruption.isCorrupt) {
            logger.warn('Periodic corruption check found issues', {
              issueCount: corruption.issues.length,
              recommendedAction: corruption.recommendedAction,
            });

            this.emit('corruption_detected', corruption);

            if (corruption.recommendedAction === 'repair') {
              await this.repairCorruption(corruption);
            }
          }
        } catch (error) {
          logger.error('Periodic corruption check failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      5 * 60 * 1000
    ); // 5 minutes
  }

  /**
   * Simulate failures for testing purposes
   */
  private simulateFailure(operation: string): void {
    if (!this.failureSimulation.enabled) return;
    if (this.failureCount >= this.failureSimulation.maxFailures) return;
    if (!this.failureSimulation.targetOperations.includes(operation)) return;

    if (Math.random() < this.failureSimulation.failureRate) {
      this.failureCount++;

      const failureType =
        this.failureSimulation.failureTypes[
          Math.floor(Math.random() * this.failureSimulation.failureTypes.length)
        ];

      logger.debug('Simulating failure', {
        operation,
        failureType,
        failureCount: this.failureCount,
      });

      switch (failureType) {
        case 'dependency_corruption':
          throw new Error(`Simulated dependency corruption in ${operation}`);
        case 'cache_corruption':
          throw new Error(`Simulated cache corruption in ${operation}`);
        case 'lock_timeout':
          throw new Error(`Simulated lock timeout in ${operation}`);
        case 'optimization_error':
          throw new Error(`Simulated optimization error in ${operation}`);
        default:
          throw new Error(`Simulated unknown error in ${operation}`);
      }
    }
  }

  /**
   * Enable failure simulation for testing
   */
  enableFailureSimulation(config: Partial<FailureSimulationConfig>): void {
    this.failureSimulation = { ...this.failureSimulation, ...config, enabled: true };
    this.failureCount = 0;
    logger.info('Failure simulation enabled', { config: this.failureSimulation });
  }

  /**
   * Disable failure simulation
   */
  disableFailureSimulation(): void {
    this.failureSimulation.enabled = false;
    this.failureCount = 0;
    logger.info('Failure simulation disabled');
  }

  /**
   * Get comprehensive statistics including atomic operations
   */
  getEnhancedStats(): {
    base: ReturnType<EnhancedIncrementalOptimizer['getStats']>;
    atomic: ReturnType<typeof atomicOpManager.getStats>;
    integrity: { lastCorruptionCheck?: Date; corruptionFound: boolean };
    simulation: { enabled: boolean; failureCount: number };
  } {
    return {
      base: this.getStats(),
      atomic: atomicOpManager.getStats(),
      integrity: {
        corruptionFound: false, // Would need to track this
      },
      simulation: {
        enabled: this.failureSimulation.enabled,
        failureCount: this.failureCount,
      },
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down enhanced incremental optimizer');

    // Stop corruption checking
    if (this.corruptionCheckInterval) {
      clearInterval(this.corruptionCheckInterval);
    }

    // Shutdown atomic operations manager
    await atomicOpManager.shutdown();

    // Save final state
    try {
      await this.saveCache();
    } catch (error) {
      logger.warn('Failed to save cache during shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('Enhanced incremental optimizer shutdown complete');
  }
}
