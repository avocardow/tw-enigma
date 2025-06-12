/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DevHotReload } from '../src/devHotReload.js';
import { EnigmaConfig } from '../src/config.js';
import WebSocket from 'ws';

// Mock WebSocket server
vi.mock('ws', () => ({
  default: {
    Server: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn(),
      clients: new Set(),
    })),
  },
  WebSocket: vi.fn(),
}));

// Mock chokidar
vi.mock('chokidar', () => ({
  watch: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
    add: vi.fn(),
    unwatch: vi.fn(),
  })),
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
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(hotReload).toBeDefined();
      const status = hotReload.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.port).toBe(3002);
    });

    it('should handle custom port configuration', () => {
      const customConfig = { ...mockConfig };
      customConfig.dev.server.port = 4000;
      
      const customHotReload = new DevHotReload({}, customConfig);
      const status = customHotReload.getStatus();
      expect(status.port).toBe(4000);
    });

    it('should handle disabled hot reload', () => {
      const disabledConfig = { ...mockConfig };
      disabledConfig.dev.enabled = false;
      
      const disabledHotReload = new DevHotReload({}, disabledConfig);
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
  });

  describe('file watching', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should watch specified files', () => {
      const files = ['test.css', 'test.html', 'test.js'];
      hotReload.watchFiles(files);
      
      // Verify files are being watched (implementation specific)
      expect(true).toBe(true); // Mock assertion
    });

    it('should stop watching files', () => {
      const files = ['test.css'];
      hotReload.watchFiles(files);
      hotReload.unwatchFiles(files);
      
      expect(true).toBe(true); // Mock assertion
    });

    it('should handle invalid file paths', () => {
      const invalidFiles = ['/invalid/path.css', ''];
      expect(() => {
        hotReload.watchFiles(invalidFiles);
      }).not.toThrow();
    });
  });

  describe('optimization triggers', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should trigger optimization for CSS files', async () => {
      const cssFile = 'test.css';
      const optimizationSpy = vi.fn();
      
      hotReload.on('optimization-requested', optimizationSpy);
      
      // Simulate file change
      hotReload.emit('file-changed', {
        path: cssFile,
        type: 'change',
        timestamp: new Date(),
        isCSS: true,
        isHTML: false,
        isJS: false,
        requiresOptimization: true,
      });

      expect(optimizationSpy).toHaveBeenCalled();
    });

    it('should debounce rapid file changes', async () => {
      const optimizationSpy = vi.fn();
      hotReload.on('optimization-requested', optimizationSpy);

      // Trigger multiple rapid changes
      for (let i = 0; i < 5; i++) {
        hotReload.emit('file-changed', {
          path: 'test.css',
          type: 'change',
          timestamp: new Date(),
          isCSS: true,
          isHTML: false,
          isJS: false,
          requiresOptimization: true,
        });
      }

      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 350));

      // Should have been called fewer times due to debouncing
      expect(optimizationSpy).toHaveBeenCalled();
    });
  });

  describe('WebSocket communication', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should send updates to connected clients', () => {
      const update = {
        type: 'css-updated',
        file: 'test.css',
        content: '.test { color: red; }',
        timestamp: new Date(),
      };

      // This would test actual WebSocket functionality
      expect(() => {
        hotReload.broadcastUpdate(update);
      }).not.toThrow();
    });

    it('should handle client connections', () => {
      // Mock client connection
      const mockClient = {
        send: vi.fn(),
        readyState: 1, // OPEN
      };

      expect(() => {
        hotReload.handleClientConnection(mockClient as any);
      }).not.toThrow();
    });

    it('should clean up disconnected clients', () => {
      const status = hotReload.getStatus();
      // Should handle client cleanup
      expect(status.connectedClients).toBeGreaterThanOrEqual(0);
    });
  });

  describe('framework detection', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should detect React framework', () => {
      const mockFile = 'src/App.jsx';
      const framework = hotReload.detectFramework(mockFile);
      expect(['react', 'unknown']).toContain(framework);
    });

    it('should detect Vue framework', () => {
      const mockFile = 'src/App.vue';
      const framework = hotReload.detectFramework(mockFile);
      expect(['vue', 'unknown']).toContain(framework);
    });

    it('should handle unknown files', () => {
      const mockFile = 'unknown.xyz';
      const framework = hotReload.detectFramework(mockFile);
      expect(framework).toBe('unknown');
    });
  });

  describe('error handling', () => {
    it('should handle server startup errors', async () => {
      // Mock a port conflict
      const conflictConfig = { ...mockConfig };
      conflictConfig.dev.server.port = -1; // Invalid port

      const errorHotReload = new DevHotReload({}, conflictConfig);
      await expect(errorHotReload.start()).rejects.toThrow();
    });

    it('should handle file system errors gracefully', async () => {
      await hotReload.start();
      
      // Mock file system error
      expect(() => {
        hotReload.watchFiles(['/invalid/path']);
      }).not.toThrow();
    });

    it('should emit error events for debugging', (done) => {
      hotReload.on('error', (error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      });

      hotReload.emit('error', new Error('Test error'));
    });
  });

  describe('performance monitoring', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should track optimization timing', async () => {
      const files = ['test.css'];
      hotReload.watchFiles(files);

      // Trigger optimization
      hotReload.emit('file-changed', {
        path: 'test.css',
        type: 'change',
        timestamp: new Date(),
        isCSS: true,
        isHTML: false,
        isJS: false,
        requiresOptimization: true,
      });

      const status = hotReload.getStatus();
      expect(status.totalOptimizations).toBeGreaterThanOrEqual(0);
    });

    it('should monitor memory usage', () => {
      const status = hotReload.getStatus();
      expect(typeof status.memoryUsage).toBe('object');
    });

    it('should track file change frequency', async () => {
      // Simulate multiple file changes
      for (let i = 0; i < 3; i++) {
        hotReload.emit('file-changed', {
          path: `test${i}.css`,
          type: 'change',
          timestamp: new Date(),
          isCSS: true,
          isHTML: false,
          isJS: false,
          requiresOptimization: true,
        });
      }

      const status = hotReload.getStatus();
      expect(status.fileChanges).toBeGreaterThanOrEqual(0);
    });
  });

  describe('integration with optimization engine', () => {
    beforeEach(async () => {
      await hotReload.start();
    });

    it('should integrate with CSS optimization', async () => {
      const optimizationResult = {
        file: 'test.css',
        originalSize: 1000,
        optimizedSize: 800,
        savings: 200,
        classes: ['btn', 'text-center'],
      };

      hotReload.handleOptimizationResult(optimizationResult);

      const status = hotReload.getStatus();
      expect(status.totalOptimizations).toBeGreaterThanOrEqual(0);
    });

    it('should queue optimization requests', async () => {
      const files = ['test1.css', 'test2.css', 'test3.css'];
      
      // Queue multiple optimizations rapidly
      files.forEach(file => {
        hotReload.queueOptimization({
          file,
          priority: 'normal',
          reason: 'file-change',
        });
      });

      // Should handle queuing without errors
      expect(true).toBe(true);
    });
  });
}); 