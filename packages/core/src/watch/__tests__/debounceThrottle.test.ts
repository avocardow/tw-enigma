/**
 * Tests for debouncing and throttling functionality in watch mode
 */

import { WatchEventHandler } from '../eventHandler';
import { WatchEvent, WatchContext, WatchModeConfig } from '../types';

describe('Debouncing and Throttling', () => {
  let eventHandler: WatchEventHandler;
  let mockContext: WatchContext;

  beforeEach(() => {
    eventHandler = new WatchEventHandler();
    
    const mockConfig: WatchModeConfig = {
      enabled: true,
      mode: 'development',
      hotReload: true,
      autoRefresh: true,
      notifications: false,
      performance: {
        throttleMs: 100,
        batchSize: 5,
        maxConcurrency: 2,
      },
      integrations: {
        devServer: false,
        browser: false,
        editor: false,
        terminal: false,
      },
      caching: {
        enabled: false,
        strategy: 'memory',
        maxAge: 1000,
        maxSize: 1024,
        enablePredictivePrefetch: false,
        compressionEnabled: false,
        analyticsEnabled: false,
        evictionStrategy: 'lru',
        prefetchThreshold: 0.5,
        maxPrefetchSize: 512,
        prefetchConcurrency: 1,
        enableDeduplication: false,
        enableCacheWarming: false,
        fileChangeDebounce: 100,
      },
      logging: {
        level: 'error',
        verbose: false,
        timestamped: false,
      },
    };

    mockContext = {
      projectRoot: '/test',
      workingDirectory: '/test',
      config: mockConfig,
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
      isActive: true,
    };
  });

  afterEach(() => {
    eventHandler.clearAllTimers();
  });

  describe('Event Statistics', () => {
    it('should track event counts correctly', async () => {
      const event: WatchEvent = {
        type: 'change',
        path: '/test/file.js',
        timestamp: new Date(),
      };

      // Handle multiple events
      await eventHandler.handleEvent(event, mockContext);
      await eventHandler.handleEvent(event, mockContext);
      await eventHandler.handleEvent(event, mockContext);

      const stats = eventHandler.getEventStats();
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.eventsByPath.size).toBeGreaterThan(0);
    });

    it('should reset statistics correctly', () => {
      const event: WatchEvent = {
        type: 'change',
        path: '/test/file.js',
        timestamp: new Date(),
      };

      eventHandler.handleEvent(event, mockContext);
      
      let stats = eventHandler.getEventStats();
      expect(stats.totalEvents).toBeGreaterThan(0);

      eventHandler.resetEventStats();
      
      stats = eventHandler.getEventStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.eventsByPath.size).toBe(0);
    });
  });

  describe('Timer Management', () => {
    it('should clear all timers', () => {
      const event: WatchEvent = {
        type: 'change',
        path: '/test/file.js',
        timestamp: new Date(),
      };

      eventHandler.handleEvent(event, mockContext);
      
      let stats = eventHandler.getEventStats();
      // Might have active timers
      
      eventHandler.clearAllTimers();
      
      stats = eventHandler.getEventStats();
      expect(stats.activeDebounceTimers).toBe(0);
      expect(stats.activeThrottleWindows).toBe(0);
    });
  });

  describe('Event Key Generation', () => {
    it('should generate consistent event keys', () => {
      const handler = eventHandler as any; // Access private method for testing
      
      const event1: WatchEvent = {
        type: 'change',
        path: '/test/file.js',
        timestamp: new Date(),
      };

      const event2: WatchEvent = {
        type: 'change',
        path: '/test/file.js',
        timestamp: new Date(),
      };

      const key1 = handler.getEventKey(event1);
      const key2 = handler.getEventKey(event2);
      
      expect(key1).toBe(key2);
      expect(key1).toBe('/test/file.js:change');
    });
  });

  describe('File Type Detection', () => {
    it('should determine correct debounce times for different file types', () => {
      const handler = eventHandler as any; // Access private method for testing
      
      const jsEvent: WatchEvent = {
        type: 'change',
        path: '/test/file.js',
        timestamp: new Date(),
      };

      const cssEvent: WatchEvent = {
        type: 'change',
        path: '/test/style.css',
        timestamp: new Date(),
      };

      const htmlEvent: WatchEvent = {
        type: 'change',
        path: '/test/template.html',
        timestamp: new Date(),
      };

      const jsDebounce = handler.getDebounceMs(jsEvent, mockContext);
      const cssDebounce = handler.getDebounceMs(cssEvent, mockContext);
      const htmlDebounce = handler.getDebounceMs(htmlEvent, mockContext);

      expect(jsDebounce).toBe(200);
      expect(cssDebounce).toBe(300);
      expect(htmlDebounce).toBe(500);
    });
  });
});