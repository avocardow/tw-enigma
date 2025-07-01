import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { WatchConfiguration } from './config';
import { WatchEventHandler } from './eventHandler';
import { FileWatcher } from './fileWatcher';
import { WatchLogger, createWatchLogger } from './watchLogger';
import { StrategicCache, StrategicCacheFactory, CachePriority } from '../optimization/strategicCache';
import { OptimizationCache, createOptimizationCache } from '../engine/optimizationCache';
import {
  EventProcessor,
  IWatchManager,
  WatchContext,
  WatchEvent,
  WatchHandler,
  WatchModeConfig,
  WatchStats,
} from './types';
import path from 'path';

const logger = createLogger('WatchManager');

/**
 * Main watch manager that coordinates file watching, event handling,
 * and optimization processes
 */
export class WatchManager extends EventEmitter implements IWatchManager {
  private fileWatcher: FileWatcher;
  private eventHandler: WatchEventHandler;
  private configuration: WatchConfiguration;
  private context: WatchContext;
  private active = false;
  private startTime?: Date;
  private strategicCache: StrategicCache;
  private optimizationCache: OptimizationCache;
  private watchLogger: WatchLogger;

  constructor(config?: Partial<WatchModeConfig>, projectRoot?: string) {
    super();

    this.configuration = new WatchConfiguration(config, undefined, undefined, projectRoot);
    this.fileWatcher = new FileWatcher(this.configuration.getWatchConfig());
    this.eventHandler = new WatchEventHandler();

    this.context = this.createContext();

    // Initialize watch-specific logger
    this.watchLogger = createWatchLogger(this.context.config, 'WatchManager');

    // Set logger on event handler for consistent logging
    this.eventHandler.setWatchLogger(this.watchLogger);

    // Initialize caching layer based on configuration
    this.initializeCaches(projectRoot);

    // Log startup banner if in verbose mode
    this.watchLogger.logStartupBanner();

    logger.debug('WatchManager initialized', {
      projectRoot: this.context.projectRoot,
      mode: this.context.config.mode,
      cachingEnabled: this.context.config.caching.enabled,
    });

    this.setupEventHandlers();
  }

  /**
   * Start watch mode
   */
  async start(config?: WatchModeConfig): Promise<void> {
    if (this.active) {
      logger.warn('Watch mode is already active');
      return;
    }

    if (config) {
      this.configuration.updateConfig(config);
      this.context = this.createContext();
    }

    const patterns = this.configuration.getWatchPatterns().map((p) => p.glob);
    this.watchLogger.logWatchStart(patterns, this.context.projectRoot);

    try {
      // Validate configuration
      const validation = this.configuration.validate();
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Initialize caches if enabled
      if (this.context.config.caching.enabled) {
        await this.strategicCache.initialize();
        logger.info('Caching layer initialized', {
          strategy: this.context.config.caching.strategy,
          maxSize: this.context.config.caching.maxSize,
        });
      }

      // Start file watcher
      await this.fileWatcher.watch(patterns);

      this.active = true;
      this.startTime = new Date();
      this.context.startTime = this.startTime;
      this.context.isActive = true;

      // Setup default event processors
      this.setupDefaultProcessors();

      logger.info('Watch mode started successfully');
      this.emit('started', { context: this.context });
    } catch (error) {
      logger.error('Failed to start watch mode', { error });
      this.emit('error', { error, context: this.context });
      throw error;
    }
  }

  /**
   * Stop watch mode
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      logger.warn('Watch mode is not active');
      return;
    }

    const duration = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    this.watchLogger.logWatchStop(duration);

    try {
      // Stop file watcher
      await this.fileWatcher.close();

      // Clean up event handler timers
      this.eventHandler.clearAllTimers();

      // Clean up caches
      if (this.context.config.caching.enabled) {
        await Promise.all([
          this.strategicCache.shutdown(),
          this.optimizationCache.destroy(),
        ]);
      }

      // Clean up logger resources
      this.watchLogger.cleanup();

      this.isActive = false;
      this.context.isActive = false;

      logger.info('Watch mode stopped successfully');
      this.emit('stopped', { context: this.context });
    } catch (error) {
      logger.error('Failed to stop watch mode', { error });
      this.emit('error', { error, context: this.context });
      throw error;
    }
  }

  /**
   * Restart watch mode
   */
  async restart(): Promise<void> {
    logger.info('Restarting watch mode');

    if (this.isActive) {
      await this.stop();
    }

    await this.start();
  }

  /**
   * Add event handler
   */
  addHandler(handler: WatchHandler): void {
    const processor: EventProcessor = {
      id: handler.id,
      name: handler.id,
      priority: handler.priority,
      patterns: handler.patterns,
      process: async (event, _context) => {
        await handler.handler(event);
      },
      enabled: handler.enabled,
    };

    this.eventHandler.addProcessor(processor);
    this.context.handlers.set(handler.id, handler);

    logger.debug('Watch handler added', { id: handler.id, patterns: handler.patterns });
  }

  /**
   * Remove event handler
   */
  removeHandler(handlerId: string): void {
    this.eventHandler.removeProcessor(handlerId);
    this.context.handlers.delete(handlerId);

    logger.debug('Watch handler removed', { id: handlerId });
  }

  /**
   * Get watch statistics including cache metrics
   */
  getStats(): WatchStats & { cacheStats?: any } {
    const now = Date.now();
    const uptime = this.startTime ? now - this.startTime.getTime() : 0;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const stats: WatchStats & { cacheStats?: any } = {
      totalFiles: this.fileWatcher.getWatched().length,
      watchedFiles: this.fileWatcher.getWatched().length,
      ignoredFiles: 0, // Would need to calculate from ignored patterns
      totalEvents: this.context.stats.totalEvents,
      eventsByType: this.context.stats.eventsByType,
      lastEvent: this.context.stats.lastEvent,
      averageEventProcessingTime: this.context.stats.averageEventProcessingTime,
      uptime,
      memoryUsage,
      cpuUsage,
    };

    // Add cache statistics if caching is enabled
    if (this.context.config.caching.enabled) {
      stats.cacheStats = {
        strategic: this.strategicCache.getStats(),
        optimization: this.optimizationCache.getAnalytics(),
      };
    }

    // Log performance statistics if verbose logging is enabled
    if (this.context.config.logging.verbose) {
      this.watchLogger.logPerformanceStats(stats);
    }

    return stats;
  }

  /**
   * Get detailed cache analytics
   */
  getCacheAnalytics(): any {
    if (!this.context.config.caching.enabled) {
      return { enabled: false };
    }

    return {
      enabled: true,
      strategic: this.strategicCache.getAnalytics(),
      optimization: this.optimizationCache.getAnalytics(),
    };
  }

  /**
   * Get event handler statistics
   */
  getEventHandlerStats(): any {
    return {
      eventStats: this.eventHandler.getEventStats(),
      processingStats: {
        processors: this.eventHandler.getProcessors().length,
        optimizationStages: this.eventHandler.getOptimizationStages().length,
      },
    };
  }

  /**
   * Reset event handler statistics
   */
  resetEventStats(): void {
    this.eventHandler.resetEventStats();
    logger.info('Event handler statistics reset');
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    if (this.context.config.caching.enabled) {
      await Promise.all([
        this.strategicCache.clear(),
        this.optimizationCache.clear(),
      ]);
      
      logger.info('All caches cleared');
      this.emit('caches-cleared');
    }
  }

  /**
   * Invalidate caches for specific files
   */
  async invalidateCacheForFiles(files: string[]): Promise<void> {
    if (this.context.config.caching.enabled) {
      const invalidationPromises = [];
      
      // Invalidate optimization cache
      invalidationPromises.push(
        this.optimizationCache.invalidateByFiles(files, 'file-changed')
      );
      
      // Invalidate strategic cache entries related to these files
      for (const file of files) {
        const cacheKey = this.generateEventCacheKey({
          type: 'change',
          path: file,
          timestamp: new Date(),
        });
        invalidationPromises.push(this.strategicCache.delete(cacheKey));
      }
      
      await Promise.all(invalidationPromises);
      
      logger.info('Cache invalidated for files', { files });
      this.emit('cache-invalidated', { files, reason: 'manual' });
    }
  }

  /**
   * Check if watch mode is active
   */
  isActive(): boolean {
    return this.isActive;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WatchModeConfig>): void {
    const oldConfig = this.configuration.getConfig();
    this.configuration.updateConfig(config);
    this.context.config = this.configuration.getConfig();

    // Log configuration changes
    this.watchLogger.logConfigChange(oldConfig, this.context.config);

    logger.info('Configuration updated', { config });
    this.emit('config-updated', { config, context: this.context });
  }

  /**
   * Get current configuration
   */
  getConfig(): WatchModeConfig {
    return this.configuration.getConfig();
  }

  /**
   * Create watch context
   */
  private createContext(): WatchContext {
    return {
      projectRoot: process.cwd(),
      workingDirectory: process.cwd(),
      config: this.configuration.getConfig(),
      handlers: new Map(),
      watchers: new Map(),
      stats: {
        totalFiles: 0,
        watchedFiles: 0,
        ignoredFiles: 0,
        totalEvents: 0,
        eventsByType: {
          add: 0,
          change: 0,
          unlink: 0,
          addDir: 0,
          unlinkDir: 0,
          ready: 0,
          error: 0,
        },
        averageEventProcessingTime: 0,
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
      startTime: new Date(),
      isActive: false,
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // File watcher events
    this.fileWatcher.on('watch-event', (event: WatchEvent) => {
      this.handleFileEvent(event);
    });

    this.fileWatcher.on('error', (data: { error: Error; patterns: string[] }) => {
      logger.error('File watcher error', data);
      this.emit('error', { error: data.error, context: this.context });
    });

    this.fileWatcher.on('ready', (data: { patterns: string[] }) => {
      logger.debug('File watcher ready', data);
      this.emit('ready', { context: this.context });
    });

    // Event handler events
    this.eventHandler.on(
      'batch-processed',
      (data: { events: WatchEvent[]; context: WatchContext }) => {
        logger.debug('Event batch processed', { count: data.events.length });
        this.emit('batch-processed', data);
      }
    );

    this.eventHandler.on('optimization-completed', (data: any) => {
      logger.debug('Optimization completed', { duration: data.duration });
      this.emit('optimization-completed', data);
    });

    this.eventHandler.on('optimization-error', (data: any) => {
      logger.error('Optimization error', { error: data.error });
      this.emit('optimization-error', data);
    });
  }

  /**
   * Initialize caching layer
   */
  private initializeCaches(projectRoot?: string): void {
    const cachingConfig = this.context.config.caching;
    
    if (!cachingConfig.enabled) {
      // Create minimal disabled caches
      this.strategicCache = new StrategicCache({ enableDiskCache: false, memorySize: 0 });
      this.optimizationCache = createOptimizationCache({ enabled: false });
      return;
    }

    // Initialize StrategicCache based on configuration
    if (cachingConfig.strategy === 'memory') {
      this.strategicCache = StrategicCacheFactory.createMemoryEfficient();
    } else if (cachingConfig.enablePredictivePrefetch) {
      this.strategicCache = StrategicCacheFactory.createPrefetchOptimized();
    } else {
      this.strategicCache = StrategicCacheFactory.createHighPerformance();
    }

    // Initialize OptimizationCache
    this.optimizationCache = createOptimizationCache({
      enabled: cachingConfig.enabled,
      maxSize: cachingConfig.maxSize,
      ttl: cachingConfig.maxAge,
      enableFileWatching: true,
      persistenceDir: cachingConfig.diskCacheDir || 
        path.join(projectRoot || process.cwd(), '.tw-enigma/cache'),
      enableCompression: cachingConfig.compressionEnabled,
      enableAnalytics: cachingConfig.analyticsEnabled,
      fileChangeDebounce: cachingConfig.fileChangeDebounce,
    });

    // Set up cache event handlers
    this.setupCacheEventHandlers();
  }

  /**
   * Set up cache event handlers
   */
  private setupCacheEventHandlers(): void {
    this.strategicCache.on('hit', (data) => {
      this.watchLogger.logCacheOperation('hit', data.key || 'unknown', data);
      this.emit('cache-hit', { type: 'strategic', ...data });
    });

    this.strategicCache.on('miss', (data) => {
      this.watchLogger.logCacheOperation('miss', data.key || 'unknown', data);
      this.emit('cache-miss', { type: 'strategic', ...data });
    });

    this.optimizationCache.on('cache-hit', (data) => {
      this.watchLogger.logCacheOperation('hit', data.key || 'unknown', data);
      this.emit('cache-hit', { type: 'optimization', ...data });
    });

    this.optimizationCache.on('cache-miss', (data) => {
      this.watchLogger.logCacheOperation('miss', data.key || 'unknown', data);
      this.emit('cache-miss', { type: 'optimization', ...data });
    });

    this.optimizationCache.on('cache-invalidated', (data) => {
      this.watchLogger.logCacheOperation('invalidate', data.reason || 'unknown', data);
      this.emit('cache-invalidated', data);
    });
  }

  /**
   * Handle file system events with caching support
   */
  private async handleFileEvent(event: WatchEvent): Promise<void> {
    try {
      // Update statistics
      this.updateStats(event);

      // Check if we have cached optimization results for this file
      if (this.context.config.caching.enabled && event.type === 'change') {
        const cacheKey = this.generateEventCacheKey(event);
        const cachedResult = await this.strategicCache.get(cacheKey);

        if (cachedResult) {
          // Log file event as processed from cache
          this.watchLogger.logFileEvent(event, true);
          
          // Log optimization completion from cache
          this.watchLogger.logOptimization(
            [event.path], 
            0, // No processing time for cache hit
            true, 
            true // Cache hit
          );

          // Emit cached result and skip expensive processing
          this.emit('optimization-completed', { 
            result: cachedResult, 
            fromCache: true,
            event,
            context: this.context 
          });
          this.emit('file-event', { event, context: this.context, fromCache: true });
          return;
        }
      }

      // Log file event as being processed
      this.watchLogger.logFileEvent(event, true);

      // Forward to event handler for processing
      const startTime = Date.now();
      await this.eventHandler.handleEvent(event, this.context);
      const processingTime = Date.now() - startTime;

      // Log optimization completion
      this.watchLogger.logOptimization(
        [event.path], 
        processingTime, 
        true, 
        false // Not from cache
      );

      // Cache the result if optimization was successful
      if (this.context.config.caching.enabled) {
        await this.cacheEventResult(event);
      }

      // Emit for external listeners
      this.emit('file-event', { event, context: this.context });
    } catch (error) {
      this.watchLogger.logError(error as Error, 'file-event-handling', {
        eventType: event.type,
        filePath: event.path,
      });
      this.emit('error', { error, context: this.context });
    }
  }

  /**
   * Generate cache key for file event
   */
  private generateEventCacheKey(event: WatchEvent): string {
    const keyData = {
      path: event.path,
      type: event.type,
      timestamp: event.timestamp?.getTime(),
      configHash: this.getConfigHash(),
    };
    
    return JSON.stringify(keyData);
  }

  /**
   * Cache optimization result for future use
   */
  private async cacheEventResult(event: WatchEvent): Promise<void> {
    try {
      const cacheKey = this.generateEventCacheKey(event);
      
      // Create a simple optimization result representation
      const optimizationResult = {
        success: true,
        path: event.path,
        timestamp: new Date(),
        optimizationTime: 0, // Would be set by actual optimization
        metadata: event.metadata || {},
      };

      await this.strategicCache.set(cacheKey, optimizationResult, {
        priority: CachePriority.NORMAL,
        ttl: this.context.config.caching.maxAge,
        metadata: { fileType: path.extname(event.path) },
      });

      logger.debug('Cached optimization result', { path: event.path, cacheKey });
    } catch (error) {
      logger.warn('Failed to cache optimization result', { error, event });
    }
  }

  /**
   * Get configuration hash for cache invalidation
   */
  private getConfigHash(): string {
    const relevantConfig = {
      mode: this.context.config.mode,
      caching: this.context.config.caching,
      performance: this.context.config.performance,
    };
    
    return JSON.stringify(relevantConfig);
  }

  /**
   * Update watch statistics
   */
  private updateStats(event: WatchEvent): void {
    this.context.stats.totalEvents++;
    this.context.stats.eventsByType[event.type]++;
    this.context.stats.lastEvent = event.timestamp;

    // Update memory usage periodically
    if (this.context.stats.totalEvents % 100 === 0) {
      this.context.stats.memoryUsage = process.memoryUsage();
      this.context.stats.cpuUsage = process.cpuUsage();
    }
  }

  /**
   * Setup default event processors
   */
  private setupDefaultProcessors(): void {
    // JavaScript/TypeScript processor
    this.eventHandler.addProcessor({
      id: 'js-ts-processor',
      name: 'JavaScript/TypeScript Processor',
      priority: 1,
      patterns: ['**/*.{js,jsx,ts,tsx}'],
      process: async (event, _context) => {
        logger.debug('Processing JS/TS file', {
          path: event.metadata?.relativePath || event.path,
          type: event.type,
        });

        // Emit specific event for JS/TS files
        this.emit('js-file-changed', { event, context: this.context });
      },
      enabled: true,
    });

    // CSS processor
    this.eventHandler.addProcessor({
      id: 'css-processor',
      name: 'CSS Processor',
      priority: 2,
      patterns: ['**/*.{css,scss,sass,less,styl}'],
      process: async (event, _context) => {
        logger.debug('Processing CSS file', {
          path: event.metadata?.relativePath || event.path,
          type: event.type,
        });

        // Emit specific event for CSS files
        this.emit('css-file-changed', { event, context: this.context });
      },
      enabled: true,
    });

    // HTML/Template processor
    this.eventHandler.addProcessor({
      id: 'html-processor',
      name: 'HTML/Template Processor',
      priority: 3,
      patterns: ['**/*.{html,htm,vue,svelte}'],
      process: async (event, _context) => {
        logger.debug('Processing HTML/template file', {
          path: event.metadata?.relativePath || event.path,
          type: event.type,
        });

        // Emit specific event for HTML/template files
        this.emit('html-file-changed', { event, context: this.context });
      },
      enabled: true,
    });

    // Configuration processor
    this.eventHandler.addProcessor({
      id: 'config-processor',
      name: 'Configuration Processor',
      priority: 0, // High priority
      patterns: ['**/package.json', '**/*.config.{js,ts,json}', '**/.env*'],
      process: async (event, context) => {
        logger.info('Configuration file changed', {
          path: event.metadata?.relativePath || event.path,
          type: event.type,
        });

        // Emit specific event for config files
        this.emit('config-file-changed', { event, context });

        // Restart if needed
        if (context.config.autoRefresh) {
          logger.info('Auto-restarting due to configuration change');
          setTimeout(() => this.restart(), 1000);
        }
      },
      enabled: true,
    });
  }
}
