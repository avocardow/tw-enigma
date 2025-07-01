/**
 * Enhanced logging specifically for watch mode operations
 * Provides clear, informative, and color-coded console output
 */

import chalk from 'chalk';
import { Logger, createLogger, LogLevel, ErrorContext } from '../utils/logger';
import { WatchEvent, WatchModeConfig, WatchStats } from './types';

/**
 * Watch-specific logging context
 */
export interface WatchLogContext extends ErrorContext {
  eventType?: string;
  filePath?: string;
  processingTime?: number;
  cacheHit?: boolean;
  batchSize?: number;
  throttled?: boolean;
  debounced?: boolean;
  optimizationPassed?: boolean;
}

/**
 * Enhanced logger for watch mode with specialized methods
 */
export class WatchLogger {
  private logger: Logger;
  private config: WatchModeConfig;
  private startTime: Date;
  private eventCounts: Map<string, number> = new Map();

  constructor(config: WatchModeConfig, component: string = 'WatchMode') {
    this.config = config;
    this.startTime = new Date();
    
    // Create logger with watch-specific configuration
    this.logger = createLogger(component, {
      level: this.parseLogLevel(config.logging.level),
      verbose: config.logging.verbose,
      timestamp: config.logging.timestamped,
      colorize: true,
      enableProgressTracking: true,
    });
  }

  /**
   * Parse log level from config
   */
  private parseLogLevel(level: string): LogLevel {
    const levelMap: Record<string, LogLevel> = {
      'trace': LogLevel.TRACE,
      'debug': LogLevel.DEBUG,
      'info': LogLevel.INFO,
      'warn': LogLevel.WARN,
      'error': LogLevel.ERROR,
      'fatal': LogLevel.FATAL,
    };
    
    return levelMap[level.toLowerCase()] || LogLevel.INFO;
  }

  /**
   * Log watch mode startup
   */
  logWatchStart(patterns: string[], projectRoot: string): void {
    const message = `🚀 Watch mode started`;
    const context: WatchLogContext = {
      component: 'WatchMode',
      operation: 'start',
      filePath: projectRoot,
    };
    
    if (this.config.logging.verbose) {
      this.logger.info(`${message} (${patterns.length} patterns, ${this.config.mode} mode)`, context);
      patterns.forEach((pattern, index) => {
        this.logger.debug(`  Pattern ${index + 1}: ${pattern}`);
      });
    } else {
      this.logger.info(message, context);
    }
  }

  /**
   * Log watch mode shutdown
   */
  logWatchStop(duration: number): void {
    const message = `🛑 Watch mode stopped`;
    const context: WatchLogContext = {
      component: 'WatchMode',
      operation: 'stop',
      processingTime: duration,
    };
    
    this.logger.info(`${message} (ran for ${Math.round(duration / 1000)}s)`, context);
  }

  /**
   * Log file system events
   */
  logFileEvent(event: WatchEvent, processed: boolean = true, reason?: string): void {
    const relativePath = event.metadata?.relativePath || event.path;
    const eventKey = `${event.type}:${this.getFileExtension(event.path)}`;
    
    // Update event counts
    const currentCount = this.eventCounts.get(eventKey) || 0;
    this.eventCounts.set(eventKey, currentCount + 1);
    
    const context: WatchLogContext = {
      component: 'FileWatcher',
      operation: 'file-event',
      eventType: event.type,
      filePath: relativePath,
    };

    if (!processed && reason) {
      context.throttled = reason.includes('throttle');
      context.debounced = reason.includes('debounce');
    }

    // Use different icons and colors for different event types
    const eventIcons: Record<string, string> = {
      'add': '📄',
      'change': '✏️',
      'unlink': '🗑️',
      'addDir': '📁',
      'unlinkDir': '🗂️',
    };

    const icon = eventIcons[event.type] || '📝';
    const statusIndicator = processed ? '' : chalk.gray(' (filtered)');
    
    if (this.config.logging.verbose || !processed) {
      const message = `${icon} ${event.type.toUpperCase()}: ${relativePath}${statusIndicator}`;
      
      if (processed) {
        this.logger.debug(message, context);
      } else {
        this.logger.trace(`${message} - ${reason}`, context);
      }
    }
  }

  /**
   * Log optimization events
   */
  logOptimization(
    files: string[], 
    duration: number, 
    success: boolean, 
    cacheHit: boolean = false,
    results?: { filesProcessed: number; bytesOptimized: number }
  ): void {
    const context: WatchLogContext = {
      component: 'Optimizer',
      operation: 'optimize',
      processingTime: duration,
      cacheHit,
      optimizationPassed: success,
      batchSize: files.length,
    };

    if (cacheHit) {
      this.logger.info(`⚡ Optimization completed (cache hit) - ${duration}ms`, context);
    } else if (success) {
      let message = `✅ Optimization completed - ${duration}ms`;
      
      if (results) {
        const savings = results.bytesOptimized > 0 ? 
          ` (${Math.round(results.bytesOptimized / 1024)}KB saved)` : '';
        message += ` - ${results.filesProcessed} files${savings}`;
      }
      
      this.logger.info(message, context);
    } else {
      this.logger.error(`❌ Optimization failed - ${duration}ms`, context);
    }

    // Log individual files in verbose mode
    if (this.config.logging.verbose && files.length > 0) {
      files.forEach(file => {
        this.logger.debug(`  Processed: ${file}`);
      });
    }
  }

  /**
   * Log cache operations
   */
  logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'invalidate', key: string, details?: any): void {
    const context: WatchLogContext = {
      component: 'Cache',
      operation: `cache-${operation}`,
      cacheHit: operation === 'hit',
    };

    const icons = {
      'hit': '💾',
      'miss': '🔍',
      'set': '💿',
      'invalidate': '🧹',
    };

    const colors = {
      'hit': chalk.green,
      'miss': chalk.yellow,
      'set': chalk.blue,
      'invalidate': chalk.red,
    };

    const icon = icons[operation];
    const colorFn = colors[operation];
    const message = `${icon} Cache ${operation.toUpperCase()}: ${key}`;

    if (this.config.logging.verbose) {
      this.logger.debug(colorFn(message), { ...context, ...details });
    } else if (operation === 'invalidate') {
      this.logger.debug(colorFn(message), context);
    }
  }

  /**
   * Log batch processing
   */
  logBatchProcessing(eventCount: number, duration: number, concurrency: number): void {
    const context: WatchLogContext = {
      component: 'EventHandler',
      operation: 'batch-process',
      processingTime: duration,
      batchSize: eventCount,
    };

    const message = `📦 Batch processed ${eventCount} events in ${duration}ms (concurrency: ${concurrency})`;
    
    if (eventCount > 1) {
      this.logger.info(message, context);
    } else if (this.config.logging.verbose) {
      this.logger.debug(message, context);
    }
  }

  /**
   * Log performance statistics
   */
  logPerformanceStats(stats: WatchStats): void {
    if (!this.config.logging.verbose) return;

    const uptimeSeconds = Math.round(stats.uptime / 1000);
    const memoryMB = Math.round(stats.memoryUsage.heapUsed / 1024 / 1024);
    const eventsPerSecond = stats.uptime > 0 ? 
      Math.round((stats.totalEvents / stats.uptime) * 1000) : 0;

    const context: WatchLogContext = {
      component: 'Performance',
      operation: 'stats',
      processingTime: stats.averageEventProcessingTime,
      memoryUsage: stats.memoryUsage.heapUsed,
    };

    this.logger.info(
      `📊 Performance: ${stats.totalEvents} events, ${eventsPerSecond}/s, ${memoryMB}MB heap, ${uptimeSeconds}s uptime`,
      context
    );

    // Log event breakdown
    const eventTypes = Object.entries(stats.eventsByType)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `${type}:${count}`)
      .join(', ');
    
    if (eventTypes) {
      this.logger.debug(`  Event breakdown: ${eventTypes}`);
    }
  }

  /**
   * Log error with enhanced context
   */
  logError(error: Error, operation: string, additionalContext?: WatchLogContext): void {
    const context: WatchLogContext = {
      component: 'WatchMode',
      operation,
      ...additionalContext,
    };

    this.logger.error(`💥 ${operation} failed: ${error.message}`, context);
    
    if (this.config.logging.verbose && error.stack) {
      this.logger.debug(error.stack);
    }
  }

  /**
   * Log warning with context
   */
  logWarning(message: string, operation: string, context?: WatchLogContext): void {
    const warningContext: WatchLogContext = {
      component: 'WatchMode',
      operation,
      ...context,
    };

    this.logger.warn(`⚠️  ${message}`, warningContext);
  }

  /**
   * Create progress tracker for long operations
   */
  startProgress(id: string, total: number, label: string): void {
    this.logger.startProgress(id, {
      total,
      label,
      showPercentage: true,
      showETA: true,
    });
  }

  /**
   * Update progress tracker
   */
  updateProgress(id: string, current: number, info?: string): void {
    this.logger.updateProgress(id, current, info);
  }

  /**
   * Complete progress tracker
   */
  completeProgress(id: string, summary?: string): void {
    this.logger.completeProgress(id, summary);
  }

  /**
   * Log configuration changes
   */
  logConfigChange(oldConfig: Partial<WatchModeConfig>, newConfig: Partial<WatchModeConfig>): void {
    const context: WatchLogContext = {
      component: 'Configuration',
      operation: 'config-update',
    };

    this.logger.info('⚙️  Configuration updated', context);
    
    if (this.config.logging.verbose) {
      const changes = this.getConfigDifferences(oldConfig, newConfig);
      changes.forEach(change => {
        this.logger.debug(`  ${change}`);
      });
    }
  }

  /**
   * Get file extension for event categorization
   */
  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : 'unknown';
  }

  /**
   * Get configuration differences for logging
   */
  private getConfigDifferences(oldConfig: any, newConfig: any): string[] {
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
    
    for (const key of allKeys) {
      const oldVal = oldConfig[key];
      const newVal = newConfig[key];
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push(`${key}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`);
      }
    }
    
    return changes;
  }

  /**
   * Get current event statistics for reporting
   */
  getEventStats(): Map<string, number> {
    return new Map(this.eventCounts);
  }

  /**
   * Reset event statistics
   */
  resetEventStats(): void {
    this.eventCounts.clear();
  }

  /**
   * Log startup banner with configuration
   */
  logStartupBanner(): void {
    if (this.config.logging.verbose) {
      this.logger.info(chalk.cyan('═'.repeat(60)));
      this.logger.info(chalk.cyan.bold('  TW-Enigma Watch Mode'));
      this.logger.info(chalk.cyan(`  Mode: ${this.config.mode}`));
      this.logger.info(chalk.cyan(`  Hot Reload: ${this.config.hotReload ? 'enabled' : 'disabled'}`));
      this.logger.info(chalk.cyan(`  Caching: ${this.config.caching.enabled ? this.config.caching.strategy : 'disabled'}`));
      this.logger.info(chalk.cyan(`  Batch Size: ${this.config.performance.batchSize}`));
      this.logger.info(chalk.cyan(`  Concurrency: ${this.config.performance.maxConcurrency}`));
      this.logger.info(chalk.cyan('═'.repeat(60)));
    }
  }

  /**
   * Clean up logger resources
   */
  cleanup(): void {
    this.logger.cleanup();
    this.eventCounts.clear();
  }
}

/**
 * Create a watch logger with the given configuration
 */
export function createWatchLogger(config: WatchModeConfig, component?: string): WatchLogger {
  return new WatchLogger(config, component);
}