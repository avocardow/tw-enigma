import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { WatchLogger, createWatchLogger } from './watchLogger';
import {
  EventProcessor,
  IWatchEventHandler,
  OptimizationContext,
  OptimizationResult,
  OptimizationStage,
  WatchContext,
  WatchEvent,
} from './types';

const logger = createLogger('WatchEventHandler');

/**
 * Watch event handler that processes file system events
 * and coordinates with optimization pipeline
 */
export class WatchEventHandler extends EventEmitter implements IWatchEventHandler {
  private processors: Map<string, EventProcessor> = new Map();
  private optimizationStages: Map<string, OptimizationStage> = new Map();
  private processingQueue: WatchEvent[] = [];
  private isProcessing = false;
  private batchTimer?: NodeJS.Timeout;
  private readonly batchDelay = 100; // ms
  private watchLogger?: WatchLogger;
  
  // Debouncing and throttling
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly throttleTimers = new Map<string, NodeJS.Timeout>();
  private readonly eventCounts = new Map<string, number>();
  private readonly lastProcessed = new Map<string, number>();

  constructor() {
    super();
    logger.debug('WatchEventHandler initialized');

    // Setup default optimization stages
    this.setupDefaultOptimizationStages();
  }

  /**
   * Handle a watch event with debouncing and throttling
   */
  async handleEvent(event: WatchEvent, context: WatchContext): Promise<void> {
    logger.debug('Handling watch event', {
      type: event.type,
      path: event.metadata?.relativePath || event.path,
    });

    try {
      const eventKey = this.getEventKey(event);
      
      // Apply debouncing and throttling based on configuration
      if (this.shouldProcessEvent(event, context)) {
        // Add to processing queue
        this.processingQueue.push(event);

        // Setup batch processing
        this.scheduleBatchProcessing(context);
      } else {
        logger.debug('Event filtered by debounce/throttle', {
          path: event.path,
          type: event.type,
          key: eventKey,
        });
      }

      // Always emit event for listeners (even if filtered)
      this.emit('event-received', { event, context });
    } catch (error) {
      logger.error('Error handling watch event', { error, event });
      this.emit('event-error', { error, event, context });
    }
  }

  /**
   * Generate event key for debouncing/throttling
   */
  private getEventKey(event: WatchEvent): string {
    return `${event.path}:${event.type}`;
  }

  /**
   * Determine if event should be processed based on debounce/throttle settings
   */
  private shouldProcessEvent(event: WatchEvent, context: WatchContext): boolean {
    const eventKey = this.getEventKey(event);
    const now = Date.now();
    
    // Get debounce/throttle settings
    const throttleMs = context.config.performance.throttleMs;
    const debounceMs = this.getDebounceMs(event, context);
    
    // Check throttling first (prevent too frequent processing)
    if (throttleMs > 0) {
      const lastProcessedTime = this.lastProcessed.get(eventKey) || 0;
      if (now - lastProcessedTime < throttleMs) {
        // Still within throttle window
        this.incrementEventCount(eventKey);
        return false;
      }
    }
    
    // Apply debouncing (schedule for later processing)
    if (debounceMs > 0) {
      this.scheduleDebounced(eventKey, debounceMs, event, context);
      return false; // Don't process immediately
    }
    
    // Update processing time and process immediately
    this.lastProcessed.set(eventKey, now);
    this.incrementEventCount(eventKey);
    return true;
  }

  /**
   * Get debounce time for specific event
   */
  private getDebounceMs(event: WatchEvent, context: WatchContext): number {
    // Check if event has specific debounce setting
    const matchingPattern = this.findMatchingWatchPattern(event, context);
    if (matchingPattern?.debounceMs) {
      return matchingPattern.debounceMs;
    }
    
    // Default debounce based on file type
    const path = event.metadata?.relativePath || event.path;
    
    if (path.match(/\.(js|jsx|ts|tsx)$/)) {
      return 200; // Fast feedback for JS files
    } else if (path.match(/\.(css|scss|sass|less)$/)) {
      return 300; // Medium debounce for CSS
    } else if (path.match(/\.(html|htm|vue|svelte)$/)) {
      return 500; // Longer debounce for templates
    }
    
    return 100; // Default debounce
  }

  /**
   * Find matching watch pattern for event
   */
  private findMatchingWatchPattern(event: WatchEvent, context: WatchContext): any {
    // This would need access to watch patterns from configuration
    // For now, return null and use defaults
    return null;
  }

  /**
   * Schedule debounced processing
   */
  private scheduleDebounced(
    eventKey: string, 
    debounceMs: number, 
    event: WatchEvent, 
    context: WatchContext
  ): void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(eventKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new debounce timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(eventKey);
      this.lastProcessed.set(eventKey, Date.now());
      
      // Add to processing queue for debounced processing
      this.processingQueue.push(event);
      this.scheduleBatchProcessing(context);
      
      logger.debug('Debounced event processed', {
        path: event.path,
        type: event.type,
        debounceMs,
      });
    }, debounceMs);
    
    this.debounceTimers.set(eventKey, timer);
    this.incrementEventCount(eventKey);
  }

  /**
   * Increment event count for analytics
   */
  private incrementEventCount(eventKey: string): void {
    const currentCount = this.eventCounts.get(eventKey) || 0;
    this.eventCounts.set(eventKey, currentCount + 1);
  }

  /**
   * Get event processing statistics
   */
  getEventStats(): { 
    totalEvents: number; 
    filteredEvents: number; 
    activeDebounceTimers: number;
    activeThrottleWindows: number;
    eventsByPath: Map<string, number>;
  } {
    const totalEvents = Array.from(this.eventCounts.values()).reduce((sum, count) => sum + count, 0);
    const processedEvents = this.processingQueue.length;
    const filteredEvents = totalEvents - processedEvents;
    
    return {
      totalEvents,
      filteredEvents,
      activeDebounceTimers: this.debounceTimers.size,
      activeThrottleWindows: this.throttleTimers.size,
      eventsByPath: new Map(this.eventCounts),
    };
  }

  /**
   * Clear all debounce and throttle timers
   */
  clearAllTimers(): void {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Clear throttle timers
    for (const timer of this.throttleTimers.values()) {
      clearTimeout(timer);
    }
    this.throttleTimers.clear();
    
    // Clear batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    
    logger.debug('All timers cleared');
  }

  /**
   * Reset event statistics
   */
  resetEventStats(): void {
    this.eventCounts.clear();
    this.lastProcessed.clear();
    logger.debug('Event statistics reset');
  }

  /**
   * Set the watch logger for enhanced logging
   */
  setWatchLogger(watchLogger: WatchLogger): void {
    this.watchLogger = watchLogger;
  }

  /**
   * Add event processor
   */
  addProcessor(processor: EventProcessor): void {
    this.processors.set(processor.id, processor);
    logger.debug('Event processor added', { id: processor.id, name: processor.name });
  }

  /**
   * Remove event processor
   */
  removeProcessor(processorId: string): void {
    if (this.processors.delete(processorId)) {
      logger.debug('Event processor removed', { id: processorId });
    }
  }

  /**
   * Get all processors
   */
  getProcessors(): EventProcessor[] {
    return Array.from(this.processors.values());
  }

  /**
   * Add optimization stage
   */
  addOptimizationStage(stage: OptimizationStage): void {
    this.optimizationStages.set(stage.id, stage);
    logger.debug('Optimization stage added', { id: stage.id, name: stage.name });
  }

  /**
   * Remove optimization stage
   */
  removeOptimizationStage(stageId: string): void {
    if (this.optimizationStages.delete(stageId)) {
      logger.debug('Optimization stage removed', { id: stageId });
    }
  }

  /**
   * Get optimization stages
   */
  getOptimizationStages(): OptimizationStage[] {
    return Array.from(this.optimizationStages.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Schedule batch processing with configurable timing
   */
  private scheduleBatchProcessing(context: WatchContext): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Use configured throttle time or default batch delay
    const batchDelay = Math.max(this.batchDelay, context.config.performance.throttleMs / 2);
    
    // Check if we should process immediately due to batch size
    if (this.processingQueue.length >= context.config.performance.batchSize) {
      // Process immediately if batch is full
      setImmediate(() => this.processBatch(context));
    } else {
      // Schedule for later
      this.batchTimer = setTimeout(() => {
        this.processBatch(context);
      }, batchDelay);
    }
  }

  /**
   * Process batched events with concurrency control
   */
  private async processBatch(context: WatchContext): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const events = [...this.processingQueue];
    this.processingQueue = [];

    const startTime = Date.now();
    
    logger.debug('Processing event batch', { 
      count: events.length, 
      maxConcurrency: context.config.performance.maxConcurrency 
    });

    try {
      // Group events by file path and type
      const groupedEvents = this.groupEvents(events);
      const eventGroups = Array.from(groupedEvents.values());

      // Process groups with concurrency control
      await this.processEventGroupsConcurrently(eventGroups, context);

      const duration = Date.now() - startTime;

      // Log batch processing completion
      if (this.watchLogger) {
        this.watchLogger.logBatchProcessing(
          events.length, 
          duration, 
          context.config.performance.maxConcurrency
        );
      }

      this.emit('batch-processed', { events, context });
    } catch (error) {
      logger.error('Error processing event batch', { error, eventCount: events.length });
      this.emit('batch-error', { error, events, context });
    } finally {
      this.isProcessing = false;

      // Process any new events that arrived
      if (this.processingQueue.length > 0) {
        this.scheduleBatchProcessing(context);
      }
    }
  }

  /**
   * Process event groups with controlled concurrency
   */
  private async processEventGroupsConcurrently(
    eventGroups: WatchEvent[][],
    context: WatchContext
  ): Promise<void> {
    const maxConcurrency = context.config.performance.maxConcurrency;
    const semaphore = new Array(maxConcurrency).fill(null);
    
    let groupIndex = 0;
    const results: Promise<void>[] = [];

    while (groupIndex < eventGroups.length) {
      // Create batch of concurrent operations
      const currentBatch: Promise<void>[] = [];
      
      for (let i = 0; i < maxConcurrency && groupIndex < eventGroups.length; i++, groupIndex++) {
        const eventGroup = eventGroups[groupIndex];
        const processingPromise = this.processEventGroup(eventGroup, context)
          .catch(error => {
            logger.error('Error processing event group in concurrent batch', {
              error,
              groupIndex: groupIndex - 1,
              groupSize: eventGroup.length,
            });
          });
        
        currentBatch.push(processingPromise);
      }
      
      // Wait for current batch to complete
      await Promise.all(currentBatch);
      results.push(...currentBatch);
    }
  }

  /**
   * Group events by path and type for efficient processing
   */
  private groupEvents(events: WatchEvent[]): Map<string, WatchEvent[]> {
    const groups = new Map<string, WatchEvent[]>();

    for (const event of events) {
      const key = `${event.path}:${event.type}`;
      const group = groups.get(key) || [];
      group.push(event);
      groups.set(key, group);
    }

    return groups;
  }

  /**
   * Process a group of events for the same file
   */
  private async processEventGroup(events: WatchEvent[], context: WatchContext): Promise<void> {
    // Use the most recent event
    const latestEvent = events[events.length - 1];

    logger.debug('Processing event group', {
      path: latestEvent.metadata?.relativePath || latestEvent.path,
      type: latestEvent.type,
      count: events.length,
    });

    try {
      // Find matching processors
      const matchingProcessors = this.findMatchingProcessors(latestEvent);

      // Execute processors in priority order
      for (const processor of matchingProcessors) {
        if (processor.enabled) {
          await this.executeProcessor(processor, latestEvent, context);
        }
      }

      // Run optimization pipeline if needed
      if (this.shouldOptimize(latestEvent)) {
        await this.runOptimizationPipeline(latestEvent, context);
      }
    } catch (error) {
      logger.error('Error processing event group', {
        error,
        path: latestEvent.path,
        type: latestEvent.type,
      });
    }
  }

  /**
   * Find processors that match the event
   */
  private findMatchingProcessors(event: WatchEvent): EventProcessor[] {
    const matching: EventProcessor[] = [];

    for (const processor of this.processors.values()) {
      if (this.processorMatches(processor, event)) {
        matching.push(processor);
      }
    }

    return matching.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if processor matches event
   */
  private processorMatches(processor: EventProcessor, event: WatchEvent): boolean {
    const relativePath = event.metadata?.relativePath || event.path;

    return processor.patterns.some((pattern) => this.simplePatternMatch(relativePath, pattern));
  }

  /**
   * Simple pattern matching function to replace minimatch
   */
  private simplePatternMatch(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches any directory depth
      .replace(/\*/g, '[^/]*') // * matches any characters except /
      .replace(/\?/g, '.'); // ? matches any single character
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Execute event processor
   */
  private async executeProcessor(
    processor: EventProcessor,
    event: WatchEvent,
    context: WatchContext
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug('Executing processor', {
        id: processor.id,
        name: processor.name,
        path: event.metadata?.relativePath || event.path,
      });

      await processor.process(event, context);

      const duration = Date.now() - startTime;
      logger.debug('Processor completed', {
        id: processor.id,
        duration,
      });

      this.emit('processor-completed', { processor, event, context, duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Processor failed', {
        id: processor.id,
        name: processor.name,
        error,
        duration,
      });

      this.emit('processor-error', { processor, event, context, error, duration });
    }
  }

  /**
   * Check if event should trigger optimization
   */
  private shouldOptimize(event: WatchEvent): boolean {
    // Skip optimization for certain event types
    if (event.type === 'addDir' || event.type === 'unlinkDir') {
      return false;
    }

    // Skip for non-source files
    const relativePath = event.metadata?.relativePath || event.path;
    const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.vue'];

    return sourceExtensions.some((ext) => relativePath.endsWith(ext));
  }

  /**
   * Run optimization pipeline
   */
  private async runOptimizationPipeline(event: WatchEvent, context: WatchContext): Promise<void> {
    const startTime = Date.now();
    const changedFiles = [event.path];

    logger.debug('Running optimization pipeline', {
      path: event.metadata?.relativePath || event.path,
      type: event.type,
    });

    try {
      const optimizationContext: OptimizationContext = {
        changedFiles,
        event,
        config: context.config,
        cache: new Map(),
        startTime: new Date(),
        metadata: {
          triggeredBy: 'file-watch',
          batchSize: 1,
        },
      };

      // Execute optimization stages
      const stages = this.getOptimizationStages().filter((stage) => stage.enabled);
      const results: OptimizationResult[] = [];

      for (const stage of stages) {
        const result = await this.executeOptimizationStage(stage, optimizationContext);
        results.push(result);

        // Stop if stage failed and has no retry
        if (!result.success && !stage.retryCount) {
          break;
        }
      }

      const totalDuration = Date.now() - startTime;
      logger.info('Optimization pipeline completed', {
        duration: totalDuration,
        stages: results.length,
        success: results.every((r) => r.success),
      });

      this.emit('optimization-completed', {
        event,
        context,
        results,
        duration: totalDuration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Optimization pipeline failed', { error, duration });

      this.emit('optimization-error', { event, context, error, duration });
    }
  }

  /**
   * Execute optimization stage
   */
  private async executeOptimizationStage(
    stage: OptimizationStage,
    context: OptimizationContext
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing optimization stage', { id: stage.id, name: stage.name });

      const result = await this.executeWithTimeout(
        () => stage.execute(context),
        stage.timeout || 30000
      );

      const duration = Date.now() - startTime;
      result.duration = duration;

      logger.debug('Optimization stage completed', {
        id: stage.id,
        duration,
        success: result.success,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Optimization stage failed', {
        id: stage.id,
        name: stage.name,
        error,
        duration,
      });

      return {
        success: false,
        duration,
        filesProcessed: 0,
        bytesOptimized: 0,
        warnings: [],
        errors: [error instanceof Error ? error.message : String(error)],
        metadata: { stageId: stage.id, stageName: stage.name },
      };
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Setup default optimization stages
   */
  private setupDefaultOptimizationStages(): void {
    // CSS optimization stage
    this.addOptimizationStage({
      id: 'css-optimization',
      name: 'CSS Optimization',
      enabled: true,
      priority: 1,
      execute: async (context) => {
        // Placeholder for CSS optimization
        return {
          success: true,
          duration: 0,
          filesProcessed: context.changedFiles.length,
          bytesOptimized: 0,
          warnings: [],
          errors: [],
          metadata: { type: 'css' },
        };
      },
    });

    // JavaScript optimization stage
    this.addOptimizationStage({
      id: 'js-optimization',
      name: 'JavaScript Optimization',
      enabled: true,
      priority: 2,
      execute: async (context) => {
        // Placeholder for JS optimization
        return {
          success: true,
          duration: 0,
          filesProcessed: context.changedFiles.length,
          bytesOptimized: 0,
          warnings: [],
          errors: [],
          metadata: { type: 'javascript' },
        };
      },
    });

    // Pattern analysis stage
    this.addOptimizationStage({
      id: 'pattern-analysis',
      name: 'Pattern Analysis',
      enabled: true,
      priority: 3,
      execute: async (context) => {
        // Placeholder for pattern analysis
        return {
          success: true,
          duration: 0,
          filesProcessed: context.changedFiles.length,
          bytesOptimized: 0,
          warnings: [],
          errors: [],
          metadata: { type: 'analysis' },
        };
      },
    });
  }
}
