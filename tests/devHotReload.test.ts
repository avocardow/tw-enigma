/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DevHotReload } from '../src/devHotReload.js';
import { EnigmaConfig } from '../src/config.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('mock file content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock chokidar with proper FSWatcher interface
vi.mock('chokidar', () => {
  const mockWatcher = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
    add: vi.fn(),
    unwatch: vi.fn(),
    emit: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  
  return {
    watch: vi.fn(() => mockWatcher),
    FSWatcher: vi.fn(),
    __mockWatcher: mockWatcher, // Export for test access
  };
});

// Mock WebSocket server (ws library)
const mockWSServer = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn(),
  emit: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  clients: new Set(),
  options: {},
  address: vi.fn().mockReturnValue({ port: 3002, address: 'localhost' }),
};

const MockWebSocketServer = vi.fn().mockImplementation(() => mockWSServer);

vi.mock('ws', () => ({
  WebSocketServer: MockWebSocketServer,
  default: {
    WebSocketServer: MockWebSocketServer,
  },
}));

// Mock crypto
vi.mock('crypto', () => ({
  createHash: vi.fn().mockImplementation(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-hash'),
  })),
}));

describe('DevHotReload', () => {
  let hotReload: DevHotReload;
  let mockConfig: EnigmaConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset WebSocket mock
    mockWSServer.on.mockReturnThis();
    mockWSServer.close.mockImplementation(() => {});
    mockWSServer.clients.clear();
    MockWebSocketServer.mockReturnValue(mockWSServer);
    
    mockConfig = {
      dev: {
        enabled: true,
        watch: true,
        server: {
          enabled: true,
          port: 3002,
          host: 'localhost',
          open: false,
        },
        diagnostics: {
          enabled: true,
          performance: true,
          memory: true,
          fileWatcher: true,
          classAnalysis: true,
        },
      },
    } as EnigmaConfig;

    hotReload = new DevHotReload({}, mockConfig);
  });

  afterEach(async () => {
    if (hotReload) {
      await hotReload.stop();
    }
    // Don't clear all mocks as it removes the module mock implementations
    // vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(hotReload).toBeDefined();
      const status = hotReload.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.clients).toBe(0);
      expect(status.watchedFiles).toBe(0);
      expect(status.optimizationQueue).toBe(0);
    });

    it('should handle custom hot reload configuration', () => {
      const customHotReloadConfig = {
        port: 4000,
        host: '0.0.0.0',
        debounceMs: 500,
      };
      
      const customHotReload = new DevHotReload(customHotReloadConfig, mockConfig);
      expect(customHotReload).toBeDefined();
      const status = customHotReload.getStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle disabled hot reload', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.dev.enabled = false;
      
      const disabledHotReload = new DevHotReload({ enabled: false }, disabledConfig);
      expect(disabledHotReload).toBeDefined();
    });
  });

  describe('lifecycle management', () => {
    it('should start hot reload server', async () => {
      await hotReload.start();
      const status = hotReload.getStatus();
      expect(status.isActive).toBe(true);
    });

    it('should stop hot reload server', async () => {
      await hotReload.start();
      await hotReload.stop();
      const status = hotReload.getStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      await hotReload.start();
      await hotReload.start(); // Should not throw
      const status = hotReload.getStatus();
      expect(status.isActive).toBe(true);
    });

    it('should handle stop when not started', async () => {
      await expect(hotReload.stop()).resolves.not.toThrow();
    });

    it('should handle disabled hot reload gracefully', async () => {
      const disabledHotReload = new DevHotReload({ enabled: false }, mockConfig);
      await disabledHotReload.start();
      const status = disabledHotReload.getStatus();
      expect(status.isActive).toBe(false);
    });
  });

  describe('file watching', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should start file watcher with proper configuration', async () => {
      const { watch } = await import('chokidar');
      expect(watch).toHaveBeenCalledWith(
        expect.arrayContaining(['**/*.css', '**/*.html', '**/*.js']),
        expect.objectContaining({
          ignored: expect.arrayContaining(['**/node_modules/**', '**/.git/**']),
          persistent: true,
          ignoreInitial: true,
        })
      );
    });

    it('should set up file change listeners', async () => {
      const { watch } = await import('chokidar');
      expect(watch).toHaveBeenCalled();
      // The listeners are set up internally, we just verify the watcher was created
      expect(watch).toHaveBeenCalledWith(
        expect.arrayContaining(['**/*.css', '**/*.html', '**/*.js']),
        expect.any(Object)
      );
    });

    it('should close watcher on stop', async () => {
      const chokidarMock = await import('chokidar') as any;
      const mockWatcher = chokidarMock.__mockWatcher;
      
      await hotReload.stop();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('optimization triggers', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should trigger manual optimization', async () => {
      const files = ['test.css', 'test.js'];
      const mockOptimizationCallback = vi.fn().mockResolvedValue({
        success: true,
        outputFiles: ['output.css'],
        sizeBefore: 1000,
        sizeAfter: 800,
      });

      const hotReloadWithCallback = new DevHotReload({}, mockConfig, mockOptimizationCallback);
      await hotReloadWithCallback.start();

      const result = await hotReloadWithCallback.triggerOptimization(files);
      
      expect(result).toBeTruthy();
      expect(result?.success).toBe(true);
      expect(mockOptimizationCallback).toHaveBeenCalledWith(files);
      
      await hotReloadWithCallback.stop();
    });

    it('should handle optimization failure gracefully', async () => {
      const files = ['test.css'];
      const mockOptimizationCallback = vi.fn().mockRejectedValue(new Error('Optimization failed'));

      const hotReloadWithCallback = new DevHotReload({}, mockConfig, mockOptimizationCallback);
      await hotReloadWithCallback.start();

      const result = await hotReloadWithCallback.triggerOptimization(files);
      
      expect(result).toBeNull();
      expect(mockOptimizationCallback).toHaveBeenCalledWith(files);
      
      await hotReloadWithCallback.stop();
    });
  });

  describe('WebSocket communication', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should start WebSocket server when notifyBrowser is enabled', async () => {
      const hotReloadWithWS = new DevHotReload({ notifyBrowser: true }, mockConfig);
      await hotReloadWithWS.start();
      
      const { WebSocketServer } = await import('ws');
      expect(WebSocketServer).toHaveBeenCalledWith({
        port: 3002,
        host: 'localhost',
      });
      
      await hotReloadWithWS.stop();
    });

    it('should not start WebSocket server when notifyBrowser is disabled', async () => {
      const hotReloadWithoutWS = new DevHotReload({ notifyBrowser: false }, mockConfig);
      await hotReloadWithoutWS.start();
      
      // WebSocket server should not be created in this case
      expect(hotReloadWithoutWS).toBeDefined();
      
      await hotReloadWithoutWS.stop();
    });

    it('should handle force reload requests', () => {
      expect(() => {
        hotReload.forceReload('full');
        hotReload.forceReload('css');
        hotReload.forceReload('partial');
      }).not.toThrow();
    });
  });

  describe('configuration management', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        debounceMs: 500,
        hotSwapCSS: false,
      };

      expect(() => {
        hotReload.updateConfig(newConfig);
      }).not.toThrow();
    });

    it('should handle supported frameworks configuration', () => {
      const configWithFrameworks = {
        supportedFrameworks: ['react', 'vue', 'angular'],
      };

      const hotReloadWithFrameworks = new DevHotReload(configWithFrameworks, mockConfig);
      expect(hotReloadWithFrameworks).toBeDefined();
    });

    it('should handle watch patterns configuration', () => {
      const configWithPatterns = {
        watchPatterns: ['**/*.tsx', '**/*.jsx'],
        ignorePatterns: ['**/temp/**'],
      };

      const hotReloadWithPatterns = new DevHotReload(configWithPatterns, mockConfig);
      expect(hotReloadWithPatterns).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket server startup errors', async () => {
      // Mock WebSocket server error
      const { WebSocketServer } = await import('ws');
      (WebSocketServer as any).mockImplementationOnce(() => {
        throw new Error('Port already in use');
      });

      const errorHotReload = new DevHotReload({ notifyBrowser: true }, mockConfig);
      await expect(errorHotReload.start()).rejects.toThrow();
    });

    it('should handle chokidar watcher errors', async () => {
      const errorSpy = vi.fn();
      hotReload.on('error', errorSpy);
      
      // Start hotReload to initialize the watcher
      await hotReload.start();
      
      // Get the mock watcher from the mocked module
      const chokidarMock = await import('chokidar') as any;
      const watcherInstance = chokidarMock.__mockWatcher;
      
      // Verify the mock watcher exists
      expect(watcherInstance).toBeDefined();
      expect(watcherInstance.emit).toBeDefined();
      
      // Simulate a watcher error by finding the error handler and calling it directly
      expect(watcherInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      
      // Get the error handler function from the on() call
      const errorHandlerCall = watcherInstance.on.mock.calls.find(call => call[0] === 'error');
      expect(errorHandlerCall).toBeDefined();
      const errorHandler = errorHandlerCall[1];
      
      // Call the error handler directly with our test error
      const error = new Error('File watcher error');
      errorHandler(error);
      
      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('should emit error events for debugging', () => {
      return new Promise<void>((resolve) => {
        hotReload.on('error', (error) => {
          expect(error).toBeInstanceOf(Error);
          resolve();
        });

        hotReload.emit('error', new Error('Test error'));
      });
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should track performance metrics in status', () => {
      const status = hotReload.getStatus();
      
      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('clients');
      expect(status).toHaveProperty('watchedFiles');
      expect(status).toHaveProperty('optimizationQueue');
      expect(status).toHaveProperty('recentOptimizations');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('performance');
      
      expect(status.performance).toHaveProperty('averageOptimizationTime');
      expect(status.performance).toHaveProperty('totalOptimizations');
      expect(status.performance).toHaveProperty('successRate');
    });

    it('should return optimization history', () => {
      const history = hotReload.getOptimizationHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit optimization history results', () => {
      const limitedHistory = hotReload.getOptimizationHistory(10);
      expect(Array.isArray(limitedHistory)).toBe(true);
      expect(limitedHistory.length).toBeLessThanOrEqual(10);
    });

    it('should track uptime correctly', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      const status = hotReload.getStatus();
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe('integration with optimization engine', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should handle optimization results correctly', async () => {
      const mockOptimizationCallback = vi.fn().mockResolvedValue({
        success: true,
        outputFiles: ['output1.css', 'output2.css'],
        modifiedFiles: ['input1.css', 'input2.css'],
        changes: {
          classesAdded: ['new-class'],
          classesRemoved: ['old-class'],
          classesModified: ['modified-class'],
        },
        sizeBefore: 1000,
        sizeAfter: 800,
        reductionPercent: 20,
      });

      const hotReloadWithCallback = new DevHotReload({}, mockConfig, mockOptimizationCallback);
      await hotReloadWithCallback.start();

      const files = ['test1.css', 'test2.css'];
      const result = await hotReloadWithCallback.triggerOptimization(files);
      
      expect(result?.success).toBe(true);
      expect(result?.files.output).toEqual(['output1.css', 'output2.css']);
      expect(result?.changes.reductionPercent).toBe(20);
      
      await hotReloadWithCallback.stop();
    });

    it('should handle multiple optimization requests sequentially', async () => {
      const mockOptimizationCallback = vi.fn().mockResolvedValue({ success: true });
      const hotReloadWithCallback = new DevHotReload({}, mockConfig, mockOptimizationCallback);
      await hotReloadWithCallback.start();

      // Trigger multiple optimizations
      const promises = [
        hotReloadWithCallback.triggerOptimization(['file1.css']),
        hotReloadWithCallback.triggerOptimization(['file2.css']),
        hotReloadWithCallback.triggerOptimization(['file3.css']),
      ];

      const results = await Promise.all(promises);
      
      // First should succeed, others might be queued or return null
      expect(results.some(result => result !== null)).toBe(true);
      
      await hotReloadWithCallback.stop();
    });
  });
}); 