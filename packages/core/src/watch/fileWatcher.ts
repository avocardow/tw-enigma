import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { relative, resolve } from 'path';
import { createLogger } from '../utils/logger';
import { IFileWatcher, PerformanceMetrics, WatchConfig, WatchEvent, WatchEventType } from './types';

interface DebouncedEvent {
  event: WatchEvent;
  timeout: NodeJS.Timeout;
}

interface ThrottledQueue {
  events: WatchEvent[];
  timeout?: NodeJS.Timeout;
  lastFlush: number;
}

/**
 * Robust file watcher implementation with cross-platform support
 * Provides event-driven file system monitoring with debouncing and throttling
 */
export class FileWatcher extends EventEmitter implements IFileWatcher {
  private logger = createLogger('FileWatcher');
  private watchers: Map<string, FSWatcher> = new Map();
  private watchedPaths: Set<string> = new Set();
  private debouncedEvents: Map<string, DebouncedEvent> = new Map();
  private throttleQueues: Map<string, ThrottledQueue> = new Map();
  private config: WatchConfig;
  private isActive = false;
  private stats = {
    totalEvents: 0,
    eventsPerSecond: 0,
    lastEventTime: 0,
    processingTimes: [] as number[],
    memoryUsage: process.memoryUsage(),
  };
  private metricsInterval?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor(config: Partial<WatchConfig> = {}) {
    super();

    this.config = this.mergeConfig(config);
    this.logger.debug('FileWatcher initialized', { config: this.config });

    // Setup performance monitoring
    this.setupPerformanceMonitoring();

    // Handle process cleanup
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  /**
   * Start watching file patterns
   */
  async watch(patterns: string[], config?: Partial<WatchConfig>): Promise<void> {
    const watchConfig = config ? this.mergeConfig(config) : this.config;

    this.logger.info('Starting file watching', {
      patterns,
      ignored: watchConfig.ignored,
      cwd: watchConfig.cwd || process.cwd(),
    });

    try {
      // Validate patterns
      this.validatePatterns(patterns);

      // Create watcher instance
      const watcher = chokidar.watch(patterns, {
        ignored: watchConfig.ignored,
        persistent: watchConfig.persistent,
        ignoreInitial: watchConfig.ignoreInitial,
        followSymlinks: watchConfig.followSymlinks,
        depth: watchConfig.depth,
        awaitWriteFinish: watchConfig.awaitWriteFinish,
        usePolling: watchConfig.usePolling,
        interval: watchConfig.interval,
        binaryInterval: watchConfig.binaryInterval,
        atomic: watchConfig.atomic,
        ignorePermissionErrors: watchConfig.ignorePermissionErrors,
        cwd: watchConfig.cwd,
        useFsEvents: watchConfig.useFsEvents,
        alwaysStat: watchConfig.alwaysStat,
      });

      // Setup event handlers
      this.setupWatcherEvents(watcher, patterns);

      // Store watcher
      const watcherId = this.generateWatcherId(patterns);
      this.watchers.set(watcherId, watcher);
      patterns.forEach((pattern) => this.watchedPaths.add(pattern));

      this.isActive = true;
      this.logger.info('File watching started successfully', { watcherId, patterns });
    } catch (error) {
      this.logger.error('Failed to start file watching', { error, patterns });
      throw error;
    }
  }

  /**
   * Stop watching patterns
   */
  async unwatch(patterns?: string[]): Promise<void> {
    if (!patterns) {
      // Unwatch all
      await this.close();
      return;
    }

    this.logger.info('Stopping file watching for patterns', { patterns });

    try {
      for (const [watcherId, watcher] of this.watchers) {
        const watcherPatterns = this.parseWatcherId(watcherId);
        const shouldRemove = patterns.some((pattern) => watcherPatterns.includes(pattern));

        if (shouldRemove) {
          await watcher.close();
          this.watchers.delete(watcherId);
          watcherPatterns.forEach((pattern) => this.watchedPaths.delete(pattern));
        }
      }

      this.logger.info('File watching stopped for patterns', { patterns });
    } catch (error) {
      this.logger.error('Failed to stop file watching', { error, patterns });
      throw error;
    }
  }

  /**
   * Add paths to existing watchers
   */
  add(paths: string | string[]): void {
    const pathArray = Array.isArray(paths) ? paths : [paths];

    this.logger.debug('Adding paths to watchers', { paths: pathArray });

    try {
      for (const watcher of this.watchers.values()) {
        watcher.add(pathArray);
      }

      pathArray.forEach((path) => this.watchedPaths.add(path));
    } catch (error) {
      this.logger.error('Failed to add paths to watchers', { error, paths: pathArray });
      throw error;
    }
  }

  /**
   * Remove paths from existing watchers
   */
  remove(paths: string | string[]): void {
    const pathArray = Array.isArray(paths) ? paths : [paths];

    this.logger.debug('Removing paths from watchers', { paths: pathArray });

    try {
      for (const watcher of this.watchers.values()) {
        watcher.unwatch(pathArray);
      }

      pathArray.forEach((path) => this.watchedPaths.delete(path));
    } catch (error) {
      this.logger.error('Failed to remove paths from watchers', { error, paths: pathArray });
      throw error;
    }
  }

  /**
   * Get all watched paths
   */
  getWatched(): string[] {
    return Array.from(this.watchedPaths);
  }

  /**
   * Close all watchers
   */
  async close(): Promise<void> {
    this.logger.info('Closing all file watchers');

    try {
      // Clear debounced events
      for (const debouncedEvent of this.debouncedEvents.values()) {
        clearTimeout(debouncedEvent.timeout);
      }
      this.debouncedEvents.clear();

      // Clear throttle queues
      for (const queue of this.throttleQueues.values()) {
        if (queue.timeout) {
          clearTimeout(queue.timeout);
        }
      }
      this.throttleQueues.clear();

      // Close all watchers
      const closePromises = Array.from(this.watchers.values()).map((watcher) => watcher.close());
      await Promise.all(closePromises);

      this.watchers.clear();
      this.watchedPaths.clear();
      this.isActive = false;

      // Stop performance monitoring
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = undefined;
      }

      this.logger.info('All file watchers closed');
    } catch (error) {
      this.logger.error('Failed to close file watchers', { error });
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const processingTimes = this.stats.processingTimes;

    return {
      eventProcessingTime: {
        min: Math.min(...processingTimes) || 0,
        max: Math.max(...processingTimes) || 0,
        avg: processingTimes.length
          ? processingTimes.reduce((a, b) => a + b) / processingTimes.length
          : 0,
        p95: this.percentile(processingTimes, 0.95),
        p99: this.percentile(processingTimes, 0.99),
      },
      memoryUsage: {
        heapUsed: this.stats.memoryUsage.heapUsed,
        heapTotal: this.stats.memoryUsage.heapTotal,
        external: this.stats.memoryUsage.external,
        rss: this.stats.memoryUsage.rss,
      },
      cpuUsage: {
        user: process.cpuUsage().user,
        system: process.cpuUsage().system,
      },
      fileSystemStats: {
        totalWatched: this.watchedPaths.size,
        eventsPerSecond: this.stats.eventsPerSecond,
        diskReadOps: 0, // Would need OS-specific implementation
        diskWriteOps: 0, // Would need OS-specific implementation
      },
      optimizationMetrics: {
        totalOptimizations: 0, // To be implemented by optimization system
        successRate: 0,
        averageOptimizationTime: 0,
        bytesOptimized: 0,
      },
    };
  }

  /**
   * Setup watcher event handlers
   */
  private setupWatcherEvents(watcher: FSWatcher, patterns: string[]): void {
    const eventTypes: WatchEventType[] = ['add', 'change', 'unlink', 'addDir', 'unlinkDir'];

    eventTypes.forEach((eventType) => {
      watcher.on(eventType, (path: string, stats?: any) => {
        this.handleFileEvent(eventType, path, stats, patterns);
      });
    });

    watcher.on('ready', () => {
      this.logger.debug('File watcher ready', { patterns });
      this.emit('ready', { patterns });
    });

    watcher.on('error', (error: Error) => {
      this.logger.error('File watcher error', { error, patterns });
      this.emit('error', { error, patterns });
    });
  }

  /**
   * Handle file system events with debouncing and throttling
   */
  private handleFileEvent(
    type: WatchEventType,
    path: string,
    stats: any,
    patterns: string[]
  ): void {
    const startTime = Date.now();

    try {
      // Create watch event
      const event: WatchEvent = {
        type,
        path: resolve(path),
        stats,
        timestamp: new Date(),
        metadata: {
          patterns,
          relativePath: relative(this.config.cwd || process.cwd(), path),
          size: stats?.size,
          mtime: stats?.mtime,
        },
      };

      // Update statistics
      this.updateStats(startTime);

      // Apply debouncing if configured
      if (this.shouldDebounce(path, patterns)) {
        this.debounceEvent(event);
        return;
      }

      // Apply throttling if configured
      if (this.shouldThrottle(path, patterns)) {
        this.throttleEvent(event);
        return;
      }

      // Emit event immediately
      this.emitWatchEvent(event);
    } catch (error) {
      this.logger.error('Error handling file event', { error, type, path });
    }
  }

  /**
   * Debounce file events
   */
  private debounceEvent(event: WatchEvent): void {
    const key = event.path;
    const debounceMs = this.getDebounceMs(event.path);

    // Clear existing timeout
    const existing = this.debouncedEvents.get(key);
    if (existing) {
      clearTimeout(existing.timeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.debouncedEvents.delete(key);
      this.emitWatchEvent(event);
    }, debounceMs);

    this.debouncedEvents.set(key, { event, timeout });
  }

  /**
   * Throttle file events
   */
  private throttleEvent(event: WatchEvent): void {
    const key = event.path;
    const throttleMs = this.getThrottleMs(event.path);
    const now = Date.now();

    let queue = this.throttleQueues.get(key);
    if (!queue) {
      queue = {
        events: [],
        lastFlush: now,
      };
      this.throttleQueues.set(key, queue);
    }

    queue.events.push(event);

    // Setup throttle timeout if not already set
    if (!queue.timeout && now - queue.lastFlush >= throttleMs) {
      queue.timeout = setTimeout(() => {
        this.flushThrottleQueue(key);
      }, throttleMs);
    }
  }

  /**
   * Flush throttled events
   */
  private flushThrottleQueue(key: string): void {
    const queue = this.throttleQueues.get(key);
    if (!queue || queue.events.length === 0) {
      return;
    }

    // Emit the most recent event
    const lastEvent = queue.events[queue.events.length - 1];
    this.emitWatchEvent(lastEvent);

    // Clear queue
    queue.events = [];
    queue.timeout = undefined;
    queue.lastFlush = Date.now();
  }

  /**
   * Emit watch event
   */
  private emitWatchEvent(event: WatchEvent): void {
    this.logger.debug('Emitting watch event', {
      type: event.type,
      path: event.metadata?.relativePath || event.path,
    });

    this.emit('watch-event', event);
    this.emit(event.type, event);
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<WatchConfig>): WatchConfig {
    return {
      enabled: true,
      patterns: [],
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/coverage/**',
        '**/*.log',
        '**/.DS_Store',
        '**/Thumbs.db',
      ],
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
      atomic: true,
      ignorePermissionErrors: true,
      cwd: process.cwd(),
      ...config,
    };
  }

  /**
   * Validate watch patterns
   */
  private validatePatterns(patterns: string[]): void {
    if (!patterns || patterns.length === 0) {
      throw new Error('At least one watch pattern must be specified');
    }

    for (const pattern of patterns) {
      if (typeof pattern !== 'string' || pattern.trim().length === 0) {
        throw new Error(`Invalid watch pattern: ${pattern}`);
      }
    }
  }

  /**
   * Generate unique watcher ID
   */
  private generateWatcherId(patterns: string[]): string {
    return patterns.sort().join('|');
  }

  /**
   * Parse watcher ID back to patterns
   */
  private parseWatcherId(watcherId: string): string[] {
    return watcherId.split('|');
  }

  /**
   * Check if event should be debounced
   */
  private shouldDebounce(path: string, patterns: string[]): boolean {
    return this.getDebounceMs(path) > 0;
  }

  /**
   * Check if event should be throttled
   */
  private shouldThrottle(path: string, patterns: string[]): boolean {
    return this.getThrottleMs(path) > 0;
  }

  /**
   * Get debounce time for path
   */
  private getDebounceMs(path: string): number {
    // Default debounce based on file type
    if (path.match(/\.(css|scss|less|styl)$/)) return 300;
    if (path.match(/\.(js|jsx|ts|tsx|vue|svelte)$/)) return 200;
    if (path.match(/\.(html|htm|md|mdx)$/)) return 500;
    return 100;
  }

  /**
   * Get throttle time for path
   */
  private getThrottleMs(path: string): number {
    // No throttling by default, can be configured per pattern
    return 0;
  }

  /**
   * Update performance statistics
   */
  private updateStats(startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.stats.totalEvents++;
    this.stats.lastEventTime = Date.now();
    this.stats.processingTimes.push(processingTime);

    // Keep only last 1000 processing times
    if (this.stats.processingTimes.length > 1000) {
      this.stats.processingTimes = this.stats.processingTimes.slice(-1000);
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    this.metricsInterval = setInterval(() => {
      this.stats.memoryUsage = process.memoryUsage();

      // Calculate events per second
      const now = Date.now();
      const timeDiff = (now - this.startTime) / 1000;
      this.stats.eventsPerSecond = timeDiff > 0 ? this.stats.totalEvents / timeDiff : 0;
    }, 5000);
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.isActive) {
      this.close().catch((error) => {
        this.logger.error('Error during cleanup', { error });
      });
    }
  }
}
