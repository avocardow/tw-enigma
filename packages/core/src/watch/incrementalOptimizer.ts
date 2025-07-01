/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, relative, resolve } from 'path';
import { createHash } from 'crypto';
import { createLogger } from '../utils/logger';
import type { WatchEvent, OptimizationContext, OptimizationResult } from './types';

const logger = createLogger('IncrementalOptimizer');

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
 * Incremental optimization pipeline that processes only changed files
 * and their dependencies, maintaining a dependency graph for efficient updates
 */
export class IncrementalOptimizer extends EventEmitter {
  private dependencyGraph: DependencyGraph;
  private strategies: Map<string, OptimizationStrategy> = new Map();
  private config: IncrementalConfig;
  private cacheFile: string;
  private isProcessing = false;
  private processQueue: WatchEvent[] = [];

  constructor(config: Partial<IncrementalConfig> = {}) {
    super();

    this.config = this.mergeConfig(config);
    this.cacheFile = join(this.config.cacheDir, 'incremental-cache.json');
    this.dependencyGraph = this.createEmptyGraph();

    logger.debug('IncrementalOptimizer initialized', { config: this.config });

    // Setup default strategies
    this.setupDefaultStrategies();

    // Load existing cache
    this.loadCache().catch((error) => {
      logger.warn('Failed to load incremental cache', { error });
    });
  }

  /**
   * Process file change events incrementally
   */
  async processChange(event: WatchEvent): Promise<OptimizationResult[]> {
    const filePath = resolve(event.path);
    
    logger.debug('Processing incremental change', {
      path: relative(process.cwd(), filePath),
      type: event.type,
    });

    try {
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
      logger.error('Error processing incremental change', { error, path: filePath });
      
      // Fallback to full rebuild if configured
      if (this.config.fallbackToFullRebuild) {
        return await this.performFullRebuild();
      }
      
      throw error;
    }
  }

  /**
   * Handle file change (add/modify)
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

      // Update dependency graph
      await this.updateDependencies(filePath, currentMetadata);
      
      // Find all files that need to be re-optimized
      const filesToOptimize = await this.findAffectedFiles(filePath);
      
      logger.info('Incremental optimization required', {
        changed: relative(process.cwd(), filePath),
        affected: filesToOptimize.length,
        files: filesToOptimize.map(f => relative(process.cwd(), f)).slice(0, 5),
      });

      // Optimize affected files
      if (this.config.parallelOptimization) {
        results.push(...await this.optimizeFilesParallel(filesToOptimize));
      } else {
        results.push(...await this.optimizeFilesSequential(filesToOptimize));
      }

      // Update graph with optimization results
      this.updateOptimizationResults(filesToOptimize, results);
      
      // Save cache
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
   * Handle file deletion
   */
  private async handleFileDelete(filePath: string): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    
    try {
      const metadata = this.dependencyGraph.files.get(filePath);
      if (!metadata) {
        return results; // File not in graph
      }

      // Find files that depended on this file
      const dependents = metadata.dependents;
      
      // Remove from dependency graph
      this.removeFromGraph(filePath);
      
      logger.info('File deleted, re-optimizing dependents', {
        deleted: relative(process.cwd(), filePath),
        dependents: dependents.length,
      });
      
      // Re-optimize dependent files
      if (dependents.length > 0) {
        if (this.config.parallelOptimization) {
          results.push(...await this.optimizeFilesParallel(dependents));
        } else {
          results.push(...await this.optimizeFilesSequential(dependents));
        }
      }
      
      // Save cache
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
   * Find all files affected by a change
   */
  private async findAffectedFiles(changedFile: string): Promise<string[]> {
    const affected = new Set<string>();
    const toProcess = [changedFile];
    
    // Add the changed file itself
    affected.add(changedFile);
    
    // Find all dependents recursively
    while (toProcess.length > 0) {
      const currentFile = toProcess.pop()!;
      const metadata = this.dependencyGraph.files.get(currentFile);
      
      if (metadata) {
        for (const dependent of metadata.dependents) {
          if (!affected.has(dependent)) {
            affected.add(dependent);
            toProcess.push(dependent);
          }
        }
      }
    }
    
    return Array.from(affected);
  }

  /**
   * Optimize files in parallel
   */
  private async optimizeFilesParallel(files: string[]): Promise<OptimizationResult[]> {
    const concurrency = Math.min(files.length, this.config.maxConcurrency);
    const results: OptimizationResult[] = [];
    
    // Process files in batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchPromises = batch.map(file => this.optimizeFile(file));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Parallel optimization failed', { error: result.reason });
          results.push(this.createErrorResult('unknown', result.reason));
        }
      }
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
        logger.error('Sequential optimization failed', { error, file });
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
      // Find appropriate strategy
      const strategy = this.findStrategy(filePath);
      if (!strategy) {
        return this.createSkipResult(filePath, 'No optimization strategy found');
      }
      
      // Create optimization context
      const context: OptimizationContext = {
        changedFiles: [filePath],
        event: { type: 'change', path: filePath, timestamp: new Date() } as WatchEvent,
        config: { enabled: true } as any, // Simplified config
        cache: new Map(),
        startTime: new Date(),
        metadata: {
          incremental: true,
          strategy: strategy.id,
        },
      };
      
      // Execute optimization
      const result = await strategy.optimize(filePath, context);
      result.duration = Date.now() - startTime;
      
      logger.debug('File optimized', {
        path: relative(process.cwd(), filePath),
        strategy: strategy.id,
        duration: result.duration,
        success: result.success,
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('File optimization failed', { error, path: filePath, duration });
      return this.createErrorResult(filePath, error, duration);
    }
  }

  /**
   * Find optimization strategy for file
   */
  private findStrategy(filePath: string): OptimizationStrategy | null {
    const strategies = Array.from(this.strategies.values())
      .filter(s => s.canOptimize(filePath))
      .sort((a, b) => a.priority - b.priority);
    
    return strategies[0] || null;
  }

  /**
   * Update file dependencies in graph
   */
  private async updateDependencies(filePath: string, metadata: FileMetadata): Promise<void> {
    try {
      // Read file content for dependency extraction
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract dependencies using appropriate strategy
      const strategy = this.findStrategy(filePath);
      if (strategy && this.config.trackDependencies) {
        const dependencies = await strategy.extractDependencies(filePath, content);
        metadata.dependencies = dependencies;
      }
      
      // Update reverse dependencies
      this.updateReverseDependencies(filePath, metadata);
      
      // Store in graph
      this.dependencyGraph.files.set(filePath, metadata);
      
    } catch (error) {
      logger.warn('Failed to update dependencies', { error, path: filePath });
      // Store metadata without dependencies
      this.dependencyGraph.files.set(filePath, metadata);
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
          depMetadata.dependents = depMetadata.dependents.filter(d => d !== filePath);
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
        depMetadata.dependents = depMetadata.dependents.filter(d => d !== filePath);
      }
    }
    
    // Remove from dependents of other files
    for (const dependent of metadata.dependents) {
      const depMetadata = this.dependencyGraph.files.get(dependent);
      if (depMetadata) {
        depMetadata.dependencies = depMetadata.dependencies.filter(d => d !== filePath);
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
   * Load cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      
      const cacheData = await fs.readFile(this.cacheFile, 'utf-8');
      const parsed = JSON.parse(cacheData);
      
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
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to load cache', { error });
      }
    }
  }

  /**
   * Save cache to disk
   */
  private async saveCache(): Promise<void> {
    try {
      const cacheData = {
        version: this.dependencyGraph.version,
        lastBuild: Date.now(),
        files: Array.from(this.dependencyGraph.files.entries()),
      };
      
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
      
      logger.debug('Incremental cache saved', {
        files: this.dependencyGraph.files.size,
      });
    } catch (error) {
      logger.error('Failed to save cache', { error });
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
        return imports.map(imp => {
          const match = imp.match(/@import\s+['"]([^'"]+)['"]/);
          return match ? resolve(filePath, '..', match[1]) : '';
        }).filter(Boolean);
      },
      optimize: async (filePath, context) => {
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
        // Extract import/require statements
        const imports = [
          ...content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [],
          ...content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [],
        ];
        
        return imports.map(imp => {
          const match = imp.match(/['"]([^'"]+)['"]/);
          if (match) {
            const importPath = match[1];
            if (importPath.startsWith('.')) {
              return resolve(filePath, '..', importPath);
            }
          }
          return '';
        }).filter(Boolean);
      },
      optimize: async (filePath, context) => {
        // Placeholder JS optimization
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
    if (this.strategies.delete(strategyId)) {
      logger.debug('Optimization strategy removed', { id: strategyId });
    }
  }

  /**
   * Get dependency graph statistics
   */
  getStats() {
    return {
      totalFiles: this.dependencyGraph.files.size,
      lastBuild: this.dependencyGraph.lastBuild,
      version: this.dependencyGraph.version,
      cacheSize: this.dependencyGraph.files.size,
      strategies: this.strategies.size,
    };
  }

  /**
   * Clear dependency graph and cache
   */
  async clearCache(): Promise<void> {
    this.dependencyGraph = this.createEmptyGraph();
    
    try {
      await fs.unlink(this.cacheFile);
      logger.info('Incremental cache cleared');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to clear cache file', { error });
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
      cacheDir: '.tw-enigma/incremental',
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
      metadata: { filePath, type: 'error' },
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
      metadata: { filePath, type: 'skip', reason },
    };
  }
}