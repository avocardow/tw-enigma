/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { extname, relative } from 'path';
import { createLogger } from '../utils/logger';
import {
  EnhancedIncrementalOptimizer,
  IncrementalConfig,
  OptimizationStrategy,
} from './enhancedIncrementalOptimizer';
import type { OptimizationContext, OptimizationResult, WatchEvent } from './types';

const logger = createLogger('FastModeOptimizer');

/**
 * Fast mode configuration options
 */
export interface FastModeConfig {
  enabled: boolean;
  mode: 'ultra' | 'balanced' | 'conservative';

  // Performance settings
  skipNonCritical: boolean;
  useInMemoryCache: boolean;
  aggressiveDebouncing: boolean;
  partialProcessing: boolean;

  // Thresholds
  maxProcessingTimeMs: number;
  maxFileSize: number; // Skip optimization for large files
  maxConcurrentFiles: number;

  // Heuristics
  enableSmartSkipping: boolean;
  skipUnchangedImports: boolean;
  useFastParsing: boolean;
  enableQuickValidation: boolean;

  // Caching
  inMemoryCacheSize: number;
  cacheExpiryMs: number;
  preloadCommonFiles: boolean;

  // Debouncing
  debounceMs: number;
  batchSize: number;
  throttleMs: number;

  // Output
  showFastModeIndicator: boolean;
  verboseLogging: boolean;
  showSkippedFiles: boolean;

  // Safety
  preserveCriticalPaths: string[];
  forceFullOptimization: string[];
  maxSkipRatio: number; // Maximum ratio of files that can be skipped
}

/**
 * Fast mode processing result
 */
export interface FastModeResult extends OptimizationResult {
  fastMode: {
    enabled: boolean;
    mode: string;
    skipped: boolean;
    reason?: string;
    processingTime: number;
    cacheHit: boolean;
    heuristicApplied?: string;
  };
}

/**
 * File processing heuristics
 */
export interface ProcessingHeuristic {
  id: string;
  name: string;
  priority: number;
  condition: (filePath: string, content?: string, metadata?: any) => boolean;
  action: 'skip' | 'partial' | 'cache' | 'defer';
  reason: string;
}

/**
 * In-memory cache entry
 */
interface CacheEntry {
  result: OptimizationResult;
  hash: string;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

/**
 * Performance metrics for fast mode
 */
export interface FastModeMetrics {
  totalProcessed: number;
  totalSkipped: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  speedGainRatio: number;
  heuristicsApplied: Record<string, number>;
  safetyCriticalOverrides: number;
}

/**
 * Fast mode optimizer that prioritizes speed over thoroughness
 * for rapid development feedback
 */
export class FastModeOptimizer extends EventEmitter {
  private baseOptimizer: EnhancedIncrementalOptimizer;
  private config: FastModeConfig;
  private inMemoryCache: Map<string, CacheEntry> = new Map();
  private heuristics: Map<string, ProcessingHeuristic> = new Map();
  private metrics: FastModeMetrics;
  private pendingQueue: Map<string, WatchEvent> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastProcessingTime: Map<string, number> = new Map();
  private preloadedFiles: Set<string> = new Set();

  constructor(
    baseConfig: Partial<IncrementalConfig> = {},
    fastConfig: Partial<FastModeConfig> = {}
  ) {
    super();

    // Initialize base optimizer with fast mode tweaks
    const optimizedBaseConfig: Partial<IncrementalConfig> = {
      ...baseConfig,
      parallelOptimization: true,
      maxConcurrency: fastConfig.maxConcurrentFiles || 8,
      checksumAlgorithm: 'md5', // Faster than sha256
    };

    this.baseOptimizer = new EnhancedIncrementalOptimizer(optimizedBaseConfig);
    this.config = this.mergeConfig(fastConfig);
    this.metrics = this.initializeMetrics();

    // Setup event forwarding
    this.setupEventForwarding();

    // Initialize heuristics
    this.setupDefaultHeuristics();

    // Preload common files if enabled
    if (this.config.preloadCommonFiles) {
      this.preloadCommonFiles();
    }

    logger.info('FastModeOptimizer initialized', {
      mode: this.config.mode,
      enabled: this.config.enabled,
      config: this.config,
    });
  }

  /**
   * Process file change with fast mode optimizations
   */
  async processChange(event: WatchEvent): Promise<FastModeResult[]> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      const results = await this.baseOptimizer.processChange(event);
      return results.map((result) => this.wrapResult(result, false, 'fast-mode-disabled'));
    }

    // Show fast mode indicator
    if (this.config.showFastModeIndicator) {
      this.logFastModeStatus(event);
    }

    try {
      // Apply debouncing if enabled
      if (this.config.aggressiveDebouncing) {
        return await this.processWithDebouncing(event);
      }

      // Check if we should skip processing entirely
      const skipResult = await this.shouldSkipProcessing(event.path);
      if (skipResult.shouldSkip) {
        this.updateMetrics('skipped', Date.now() - startTime);
        return [this.createSkipResult(event.path, skipResult.reason, Date.now() - startTime)];
      }

      // Process with fast mode optimizations
      const results = await this.fastProcess(event);

      this.updateMetrics('processed', Date.now() - startTime);
      this.emit('fast_mode_processed', { event, results, duration: Date.now() - startTime });

      return results;
    } catch (error) {
      logger.warn('Fast mode processing failed, falling back to full optimization', {
        path: event.path,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to base optimizer
      const results = await this.baseOptimizer.processChange(event);
      return results.map((result) => this.wrapResult(result, false, 'fast-mode-fallback'));
    }
  }

  /**
   * Fast processing pipeline
   */
  private async fastProcess(event: WatchEvent): Promise<FastModeResult[]> {
    const filePath = event.path;

    // Check cache first
    const cacheResult = this.checkCache(filePath);
    if (cacheResult) {
      this.updateMetrics('cache-hit');
      return [this.wrapResult(cacheResult, true, 'cache-hit')];
    }

    // Apply heuristics to determine processing strategy
    const heuristic = this.applyHeuristics(filePath);
    if (heuristic) {
      return await this.processWithHeuristic(event, heuristic);
    }

    // Check if this is a critical path that must be fully processed
    if (this.isCriticalPath(filePath)) {
      const results = await this.baseOptimizer.processChange(event);
      return results.map((result) => this.wrapResult(result, false, 'critical-path'));
    }

    // Use partial processing if enabled
    if (this.config.partialProcessing) {
      return await this.partialProcess(event);
    }

    // Standard fast processing
    return await this.standardFastProcess(event);
  }

  /**
   * Standard fast processing with optimizations
   */
  private async standardFastProcess(event: WatchEvent): Promise<FastModeResult[]> {
    const startTime = Date.now();

    // Create optimized context
    const context: OptimizationContext = {
      changedFiles: [event.path],
      event,
      config: {
        enabled: true,
        mode: 'development',
        hotReload: true,
        autoRefresh: true,
        notifications: false, // Reduce noise in fast mode
        performance: {
          throttleMs: this.config.throttleMs,
          batchSize: this.config.batchSize,
          maxConcurrency: this.config.maxConcurrentFiles,
        },
        integrations: {
          devServer: false,
          browser: false,
          editor: false,
          terminal: true,
        },
        caching: {
          enabled: this.config.useInMemoryCache,
          strategy: 'memory',
          maxAge: this.config.cacheExpiryMs,
          maxSize: this.config.inMemoryCacheSize,
        },
        logging: {
          level: this.config.verboseLogging ? 'debug' : 'warn',
          verbose: this.config.verboseLogging,
          timestamped: false, // Reduce log overhead
        },
      },
      cache: new Map(),
      startTime: new Date(startTime),
      metadata: { fastMode: true, mode: this.config.mode },
    };

    // Get optimized strategy for this file type
    const strategy = this.getFastStrategy(event.path);
    if (!strategy) {
      const results = await this.baseOptimizer.processChange(event);
      return results.map((result) => this.wrapResult(result, false, 'no-fast-strategy'));
    }

    // Execute fast optimization
    try {
      const result = await strategy.optimize(event.path, context);

      // Cache successful results
      if (result.success && this.config.useInMemoryCache) {
        this.cacheResult(event.path, result);
      }

      return [this.wrapResult(result, true, 'fast-optimized')];
    } catch (error) {
      logger.warn('Fast strategy failed, using base optimizer', {
        path: event.path,
        strategy: strategy.id,
        error: error instanceof Error ? error.message : String(error),
      });

      const results = await this.baseOptimizer.processChange(event);
      return results.map((result) => this.wrapResult(result, false, 'fast-strategy-failed'));
    }
  }

  /**
   * Partial processing for non-critical optimizations
   */
  private async partialProcess(event: WatchEvent): Promise<FastModeResult[]> {
    const filePath = event.path;
    const ext = extname(filePath).toLowerCase();

    // For CSS files, do quick syntax validation only
    if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
      return await this.quickCSSValidation(filePath);
    }

    // For JS files, do basic syntax check
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      return await this.quickJSValidation(filePath);
    }

    // For other files, just verify they exist and are readable
    return await this.basicFileValidation(filePath);
  }

  /**
   * Quick CSS validation without full optimization
   */
  private async quickCSSValidation(filePath: string): Promise<FastModeResult[]> {
    const startTime = Date.now();

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Basic syntax validation
      const hasBasicSyntaxErrors = this.checkBasicCSSSyntax(content);
      const warnings: string[] = [];
      const errors: string[] = [];

      if (hasBasicSyntaxErrors.length > 0) {
        errors.push(...hasBasicSyntaxErrors);
      }

      const result: OptimizationResult = {
        success: errors.length === 0,
        duration: Date.now() - startTime,
        filesProcessed: 1,
        bytesOptimized: 0, // No actual optimization
        warnings,
        errors,
        metadata: {
          partialProcessing: true,
          validationOnly: true,
          filePath,
        },
      };

      return [this.wrapResult(result, true, 'partial-css-validation')];
    } catch (error) {
      return [this.createErrorResult(filePath, error, Date.now() - startTime)];
    }
  }

  /**
   * Quick JavaScript validation without full processing
   */
  private async quickJSValidation(filePath: string): Promise<FastModeResult[]> {
    const startTime = Date.now();

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Basic syntax validation
      const syntaxErrors = this.checkBasicJSSyntax(content);
      const warnings: string[] = [];
      const errors: string[] = [];

      if (syntaxErrors.length > 0) {
        errors.push(...syntaxErrors);
      }

      const result: OptimizationResult = {
        success: errors.length === 0,
        duration: Date.now() - startTime,
        filesProcessed: 1,
        bytesOptimized: 0,
        warnings,
        errors,
        metadata: {
          partialProcessing: true,
          validationOnly: true,
          filePath,
        },
      };

      return [this.wrapResult(result, true, 'partial-js-validation')];
    } catch (error) {
      return [this.createErrorResult(filePath, error, Date.now() - startTime)];
    }
  }

  /**
   * Basic file validation
   */
  private async basicFileValidation(filePath: string): Promise<FastModeResult[]> {
    const startTime = Date.now();

    try {
      const stats = await fs.stat(filePath);

      const result: OptimizationResult = {
        success: true,
        duration: Date.now() - startTime,
        filesProcessed: 1,
        bytesOptimized: 0,
        warnings: [],
        errors: [],
        metadata: {
          basicValidation: true,
          fileSize: stats.size,
          filePath,
        },
      };

      return [this.wrapResult(result, true, 'basic-validation')];
    } catch (error) {
      return [this.createErrorResult(filePath, error, Date.now() - startTime)];
    }
  }

  /**
   * Process with debouncing to handle rapid changes
   */
  private async processWithDebouncing(event: WatchEvent): Promise<FastModeResult[]> {
    const filePath = event.path;

    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Add to pending queue
    this.pendingQueue.set(filePath, event);

    // Return a promise that resolves when debouncing is complete
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        const pendingEvent = this.pendingQueue.get(filePath);
        this.pendingQueue.delete(filePath);
        this.debounceTimers.delete(filePath);

        if (pendingEvent) {
          const results = await this.fastProcess(pendingEvent);
          resolve(results);
        } else {
          resolve([this.createSkipResult(filePath, 'debounce-cancelled', 0)]);
        }
      }, this.config.debounceMs);

      this.debounceTimers.set(filePath, timer);
    });
  }

  /**
   * Check if processing should be skipped
   */
  private async shouldSkipProcessing(
    filePath: string
  ): Promise<{ shouldSkip: boolean; reason: string }> {
    // Check file size threshold
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > this.config.maxFileSize) {
        return { shouldSkip: true, reason: `file-too-large (${stats.size} bytes)` };
      }
    } catch {
      return { shouldSkip: true, reason: 'file-not-accessible' };
    }

    // Check if recently processed
    const lastProcessed = this.lastProcessingTime.get(filePath);
    if (lastProcessed && Date.now() - lastProcessed < this.config.throttleMs) {
      return { shouldSkip: true, reason: 'recently-processed' };
    }

    // Check skip ratio to maintain safety
    const totalProcessed = this.metrics.totalProcessed + this.metrics.totalSkipped;
    const currentSkipRatio = totalProcessed > 0 ? this.metrics.totalSkipped / totalProcessed : 0;

    if (currentSkipRatio > this.config.maxSkipRatio) {
      return { shouldSkip: false, reason: 'max-skip-ratio-reached' };
    }

    return { shouldSkip: false, reason: 'should-process' };
  }

  /**
   * Apply processing heuristics
   */
  private applyHeuristics(filePath: string): ProcessingHeuristic | null {
    for (const [id, heuristic] of this.heuristics) {
      if (heuristic.condition(filePath)) {
        this.metrics.heuristicsApplied[id] = (this.metrics.heuristicsApplied[id] || 0) + 1;
        return heuristic;
      }
    }
    return null;
  }

  /**
   * Process with specific heuristic
   */
  private async processWithHeuristic(
    event: WatchEvent,
    heuristic: ProcessingHeuristic
  ): Promise<FastModeResult[]> {
    const startTime = Date.now();

    switch (heuristic.action) {
      case 'skip':
        return [
          this.createSkipResult(
            event.path,
            `heuristic: ${heuristic.reason}`,
            Date.now() - startTime
          ),
        ];

      case 'cache':
        const cached = this.checkCache(event.path);
        if (cached) {
          return [this.wrapResult(cached, true, `heuristic-cache: ${heuristic.reason}`)];
        }
        // Fall through to normal processing if no cache
        break;

      case 'partial':
        return await this.partialProcess(event);

      case 'defer':
        // Add to queue for later processing
        this.pendingQueue.set(event.path, event);
        return [
          this.createSkipResult(
            event.path,
            `deferred: ${heuristic.reason}`,
            Date.now() - startTime
          ),
        ];
    }

    // Default to normal fast processing
    return await this.standardFastProcess(event);
  }

  /**
   * Check if file is on critical path
   */
  private isCriticalPath(filePath: string): boolean {
    return (
      this.config.preserveCriticalPaths.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      }) ||
      this.config.forceFullOptimization.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      })
    );
  }

  /**
   * Get fast optimization strategy for file type
   */
  private getFastStrategy(filePath: string): OptimizationStrategy | null {
    const ext = extname(filePath).toLowerCase();

    // Create lightweight strategies for common file types
    switch (ext) {
      case '.css':
      case '.scss':
      case '.sass':
      case '.less':
        return this.createFastCSSStrategy();

      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx':
        return this.createFastJSStrategy();

      default:
        return null;
    }
  }

  /**
   * Create fast CSS optimization strategy
   */
  private createFastCSSStrategy(): OptimizationStrategy {
    return {
      id: 'fast-css',
      name: 'Fast CSS Optimizer',
      priority: 100,
      canOptimize: (filePath) => /\.(css|scss|sass|less)$/.test(filePath),
      extractDependencies: async (_filePath, content) => {
        // Quick import extraction without full parsing
        const imports = content.match(/@import\s+['""]([^'""]+)['""];?/g) || [];
        return imports
          .map((imp) => {
            const match = imp.match(/@import\s+['""]([^'""]+)['""];?/);
            return match ? match[1] : '';
          })
          .filter(Boolean);
      },
      optimize: async (filePath, _context) => {
        const startTime = Date.now();

        // In fast mode, just validate syntax and check for obvious issues
        const content = await fs.readFile(filePath, 'utf-8');
        const errors = this.checkBasicCSSSyntax(content);

        return {
          success: errors.length === 0,
          duration: Date.now() - startTime,
          filesProcessed: 1,
          bytesOptimized: 0,
          warnings: [],
          errors,
          metadata: {
            strategy: 'fast-css',
            validationOnly: true,
            filePath,
          },
        };
      },
    };
  }

  /**
   * Create fast JavaScript optimization strategy
   */
  private createFastJSStrategy(): OptimizationStrategy {
    return {
      id: 'fast-js',
      name: 'Fast JavaScript Optimizer',
      priority: 100,
      canOptimize: (filePath) => /\.(js|jsx|ts|tsx)$/.test(filePath),
      extractDependencies: async (_filePath, content) => {
        // Quick import/require extraction
        const imports = content.match(/(?:import|require)\s*\(['""]([^'""]+)['"']\)/g) || [];
        return imports
          .map((imp) => {
            const match = imp.match(/(?:import|require)\s*\(['""]([^'""]+)['"']\)/);
            return match ? match[1] : '';
          })
          .filter(Boolean);
      },
      optimize: async (filePath, _context) => {
        const startTime = Date.now();

        // In fast mode, just do basic syntax validation
        const content = await fs.readFile(filePath, 'utf-8');
        const errors = this.checkBasicJSSyntax(content);

        return {
          success: errors.length === 0,
          duration: Date.now() - startTime,
          filesProcessed: 1,
          bytesOptimized: 0,
          warnings: [],
          errors,
          metadata: {
            strategy: 'fast-js',
            validationOnly: true,
            filePath,
          },
        };
      },
    };
  }

  /**
   * Basic CSS syntax checking
   */
  private checkBasicCSSSyntax(content: string): string[] {
    const errors: string[] = [];

    // Check for unmatched braces
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Unmatched braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for basic syntax issues
    if (content.includes(';;')) {
      errors.push('Double semicolons detected');
    }

    return errors;
  }

  /**
   * Basic JavaScript syntax checking
   */
  private checkBasicJSSyntax(content: string): string[] {
    const errors: string[] = [];

    try {
      // Simple syntax checks without full parsing

      // Check for unmatched parentheses
      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push(`Unmatched parentheses: ${openParens} open, ${closeParens} close`);
      }

      // Check for unmatched braces
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push(`Unmatched braces: ${openBraces} open, ${closeBraces} close`);
      }

      // Check for unmatched brackets
      const openBrackets = (content.match(/\[/g) || []).length;
      const closeBrackets = (content.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push(`Unmatched brackets: ${openBrackets} open, ${closeBrackets} close`);
      }
    } catch (error) {
      errors.push(
        `Syntax validation error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return errors;
  }

  /**
   * Cache management methods
   */
  private checkCache(filePath: string): OptimizationResult | null {
    if (!this.config.useInMemoryCache) return null;

    const entry = this.inMemoryCache.get(filePath);
    if (!entry) return null;

    // Check expiry
    if (Date.now() - entry.timestamp > this.config.cacheExpiryMs) {
      this.inMemoryCache.delete(filePath);
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.result;
  }

  private cacheResult(filePath: string, result: OptimizationResult): void {
    if (!this.config.useInMemoryCache) return;

    // Clean cache if too large
    if (this.inMemoryCache.size >= this.config.inMemoryCacheSize) {
      this.cleanCache();
    }

    const hash = createHash('md5')
      .update(filePath + Date.now())
      .digest('hex');
    this.inMemoryCache.set(filePath, {
      result,
      hash,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
    });
  }

  private cleanCache(): void {
    const entries = Array.from(this.inMemoryCache.entries());

    // Sort by last access (oldest first)
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.inMemoryCache.delete(entries[i][0]);
    }

    logger.debug('Cleaned cache', {
      removed: toRemove,
      remaining: this.inMemoryCache.size,
    });
  }

  /**
   * Preload common files for faster access
   */
  private async preloadCommonFiles(): Promise<void> {
    const commonPatterns = [
      '**/package.json',
      '**/tsconfig.json',
      '**/babel.config.*',
      '**/webpack.config.*',
      '**/vite.config.*',
    ];

    // This would be implemented to preload commonly accessed configuration files
    logger.debug('Preloading common files', { patterns: commonPatterns });
  }

  /**
   * Setup default heuristics
   */
  private setupDefaultHeuristics(): void {
    // Skip test files in fast mode
    this.heuristics.set('skip-tests', {
      id: 'skip-tests',
      name: 'Skip Test Files',
      priority: 1,
      condition: (filePath) => /\.(test|spec)\.(js|jsx|ts|tsx)$/.test(filePath),
      action: 'skip',
      reason: 'test file',
    });

    // Skip node_modules
    this.heuristics.set('skip-node-modules', {
      id: 'skip-node-modules',
      name: 'Skip Node Modules',
      priority: 1,
      condition: (filePath) => filePath.includes('node_modules'),
      action: 'skip',
      reason: 'node_modules file',
    });

    // Use cache for recently modified files
    this.heuristics.set('cache-recent', {
      id: 'cache-recent',
      name: 'Cache Recent Files',
      priority: 2,
      condition: (filePath) => {
        const lastProcessed = this.lastProcessingTime.get(filePath);
        return lastProcessed ? Date.now() - lastProcessed < 5000 : false; // 5 seconds
      },
      action: 'cache',
      reason: 'recently processed',
    });

    // Partial processing for large files
    this.heuristics.set('partial-large', {
      id: 'partial-large',
      name: 'Partial Processing for Large Files',
      priority: 3,
      condition: (filePath) => {
        try {
          const stats = require('fs').statSync(filePath);
          return stats.size > 100000; // 100KB
        } catch {
          return false;
        }
      },
      action: 'partial',
      reason: 'large file',
    });
  }

  /**
   * Setup event forwarding from base optimizer
   */
  private setupEventForwarding(): void {
    this.baseOptimizer.on('corruption_detected', (data) => {
      this.emit('corruption_detected', data);
    });

    this.baseOptimizer.on('operation_failure', (data) => {
      this.emit('operation_failure', data);
    });
  }

  /**
   * Utility methods
   */
  private wrapResult(
    result: OptimizationResult,
    usedFastMode: boolean,
    reason: string
  ): FastModeResult {
    return {
      ...result,
      fastMode: {
        enabled: this.config.enabled,
        mode: this.config.mode,
        skipped: !usedFastMode && reason.includes('skip'),
        reason,
        processingTime: result.duration,
        cacheHit: reason.includes('cache'),
        heuristicApplied: reason.includes('heuristic') ? reason : undefined,
      },
    };
  }

  private createSkipResult(filePath: string, reason: string, duration: number): FastModeResult {
    return {
      success: true,
      duration,
      filesProcessed: 0,
      bytesOptimized: 0,
      warnings: [reason],
      errors: [],
      metadata: { filePath, skipped: true, reason },
      fastMode: {
        enabled: this.config.enabled,
        mode: this.config.mode,
        skipped: true,
        reason,
        processingTime: duration,
        cacheHit: false,
      },
    };
  }

  private createErrorResult(filePath: string, error: unknown, duration: number): FastModeResult {
    return {
      success: false,
      duration,
      filesProcessed: 0,
      bytesOptimized: 0,
      warnings: [],
      errors: [error instanceof Error ? error.message : String(error)],
      metadata: { filePath, error: true },
      fastMode: {
        enabled: this.config.enabled,
        mode: this.config.mode,
        skipped: false,
        reason: 'error',
        processingTime: duration,
        cacheHit: false,
      },
    };
  }

  private logFastModeStatus(event: WatchEvent): void {
    const indicator =
      this.config.mode === 'ultra' ? '⚡' : this.config.mode === 'balanced' ? '🚀' : '⚙️';

    logger.info(
      `${indicator} Fast Mode (${this.config.mode}): ${relative(process.cwd(), event.path)}`
    );
  }

  private updateMetrics(type: 'processed' | 'skipped' | 'cache-hit', duration?: number): void {
    if (type === 'processed') {
      this.metrics.totalProcessed++;
      if (duration) {
        const count = this.metrics.totalProcessed;
        this.metrics.averageProcessingTime =
          (this.metrics.averageProcessingTime * (count - 1) + duration) / count;
      }
    } else if (type === 'skipped') {
      this.metrics.totalSkipped++;
    } else if (type === 'cache-hit') {
      const total = this.metrics.totalProcessed + this.metrics.totalSkipped;
      this.metrics.cacheHitRate =
        total > 0 ? (this.metrics.cacheHitRate * total + 1) / (total + 1) : 1;
    }

    this.metrics.memoryUsage = process.memoryUsage().heapUsed;
  }

  private mergeConfig(config: Partial<FastModeConfig>): FastModeConfig {
    return {
      enabled: true,
      mode: 'balanced',

      // Performance settings
      skipNonCritical: true,
      useInMemoryCache: true,
      aggressiveDebouncing: true,
      partialProcessing: true,

      // Thresholds
      maxProcessingTimeMs: 1000,
      maxFileSize: 1024 * 1024, // 1MB
      maxConcurrentFiles: 6,

      // Heuristics
      enableSmartSkipping: true,
      skipUnchangedImports: true,
      useFastParsing: true,
      enableQuickValidation: true,

      // Caching
      inMemoryCacheSize: 100,
      cacheExpiryMs: 30000, // 30 seconds
      preloadCommonFiles: true,

      // Debouncing
      debounceMs: 150,
      batchSize: 5,
      throttleMs: 100,

      // Output
      showFastModeIndicator: true,
      verboseLogging: false,
      showSkippedFiles: false,

      // Safety
      preserveCriticalPaths: ['**/package.json', '**/tsconfig.json', '**/*.config.*'],
      forceFullOptimization: [],
      maxSkipRatio: 0.7, // Max 70% of files can be skipped

      ...config,
    };
  }

  private initializeMetrics(): FastModeMetrics {
    return {
      totalProcessed: 0,
      totalSkipped: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      speedGainRatio: 0,
      heuristicsApplied: {},
      safetyCriticalOverrides: 0,
    };
  }

  /**
   * Public API methods
   */

  /**
   * Toggle fast mode on/off
   */
  toggleFastMode(enabled?: boolean): void {
    this.config.enabled = enabled !== undefined ? enabled : !this.config.enabled;
    logger.info(`Fast mode ${this.config.enabled ? 'enabled' : 'disabled'}`);
    this.emit('fast_mode_toggled', { enabled: this.config.enabled });
  }

  /**
   * Change fast mode intensity
   */
  setMode(mode: 'ultra' | 'balanced' | 'conservative'): void {
    const oldMode = this.config.mode;
    this.config.mode = mode;

    // Adjust settings based on mode
    switch (mode) {
      case 'ultra':
        this.config.maxProcessingTimeMs = 500;
        this.config.debounceMs = 50;
        this.config.maxSkipRatio = 0.8;
        break;
      case 'balanced':
        this.config.maxProcessingTimeMs = 1000;
        this.config.debounceMs = 150;
        this.config.maxSkipRatio = 0.7;
        break;
      case 'conservative':
        this.config.maxProcessingTimeMs = 2000;
        this.config.debounceMs = 300;
        this.config.maxSkipRatio = 0.5;
        break;
    }

    logger.info(`Fast mode changed from ${oldMode} to ${mode}`);
    this.emit('fast_mode_changed', { oldMode, newMode: mode });
  }

  /**
   * Get current metrics
   */
  getMetrics(): FastModeMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current configuration
   */
  getConfig(): FastModeConfig {
    return { ...this.config };
  }

  /**
   * Add custom heuristic
   */
  addHeuristic(heuristic: ProcessingHeuristic): void {
    this.heuristics.set(heuristic.id, heuristic);
    logger.debug('Custom heuristic added', { id: heuristic.id, name: heuristic.name });
  }

  /**
   * Remove heuristic
   */
  removeHeuristic(id: string): void {
    this.heuristics.delete(id);
    logger.debug('Heuristic removed', { id });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.inMemoryCache.clear();
    logger.info('Fast mode cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number; totalEntries: number } {
    return {
      size: this.inMemoryCache.size,
      hitRate: this.metrics.cacheHitRate,
      totalEntries: this.metrics.totalProcessed + this.metrics.totalSkipped,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down fast mode optimizer');

    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear cache
    this.inMemoryCache.clear();

    // Shutdown base optimizer
    await this.baseOptimizer.shutdown();

    logger.info('Fast mode optimizer shutdown complete');
  }
}

/**
 * Factory function for creating fast mode optimizer
 */
export function createFastModeOptimizer(
  baseConfig?: Partial<IncrementalConfig>,
  fastConfig?: Partial<FastModeConfig>
): FastModeOptimizer {
  return new FastModeOptimizer(baseConfig, fastConfig);
}

/**
 * Create mode-specific configurations
 */
export const FAST_MODE_PRESETS = {
  ultra: {
    mode: 'ultra' as const,
    maxProcessingTimeMs: 500,
    debounceMs: 50,
    maxSkipRatio: 0.8,
    skipNonCritical: true,
    partialProcessing: true,
    aggressiveDebouncing: true,
  },
  balanced: {
    mode: 'balanced' as const,
    maxProcessingTimeMs: 1000,
    debounceMs: 150,
    maxSkipRatio: 0.7,
    skipNonCritical: true,
    partialProcessing: true,
    aggressiveDebouncing: true,
  },
  conservative: {
    mode: 'conservative' as const,
    maxProcessingTimeMs: 2000,
    debounceMs: 300,
    maxSkipRatio: 0.5,
    skipNonCritical: true,
    partialProcessing: false,
    aggressiveDebouncing: false,
  },
} as const;
