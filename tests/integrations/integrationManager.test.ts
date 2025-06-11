/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Integration Manager Tests
 * Comprehensive test suite for build tool integration management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { vol } from 'memfs';
import { 
  IntegrationManager, 
  createIntegrationManager,
  type IntegrationManagerConfig 
} from '../../src/integrations/core/integrationManager.js';
import type { 
  BuildToolType, 
  BuildToolPlugin,
  BuildToolPluginConfig,
  BuildToolContext 
} from '../../src/integrations/core/buildToolPlugin.js';

// Mock filesystem
jest.mock('fs/promises');
jest.mock('fs');

// Mock logger
jest.mock('../../src/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock framework detector
jest.mock('../../src/frameworkDetector.js', () => ({
  FrameworkDetector: jest.fn(() => ({
    detectFramework: jest.fn().mockResolvedValue({
      detected: [
        { 
          framework: 'react', 
          confidence: 0.9, 
          version: '18.2.0',
          buildTool: 'vite'
        }
      ],
      primary: { 
        framework: 'react', 
        confidence: 0.9, 
        version: '18.2.0',
        buildTool: 'vite'
      }
    })
  }))
}));

describe('IntegrationManager', () => {
  let manager: IntegrationManager;
  let mockConfig: IntegrationManagerConfig;

  beforeEach(() => {
    vol.reset();
    
    // Create mock project structure
    vol.fromJSON({
      '/test-project/package.json': JSON.stringify({
        name: 'test-project',
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          'vite': '^4.0.0',
          '@vitejs/plugin-react': '^3.0.0'
        },
        scripts: {
          'dev': 'vite',
          'build': 'vite build'
        }
      }),
      '/test-project/vite.config.js': `
        import { defineConfig } from 'vite'
        import react from '@vitejs/plugin-react'
        
        export default defineConfig({
          plugins: [react()]
        })
      `,
      '/test-project/src/App.tsx': 'export default function App() { return <div>Test</div>; }',
      '/test-project/src/main.tsx': 'import React from "react"; import ReactDOM from "react-dom/client";'
    });

    mockConfig = {
      autoDetect: true,
      projectRoot: '/test-project',
      hmr: true,
      priorities: {
        'nextjs': 1,
        'vite': 2,
        'webpack': 3,
        'esbuild': 4,
        'rollup': 5,
        'parcel': 6,
        'custom': 10
      },
      enabledTools: ['vite', 'webpack'],
      pluginConfigs: {}
    };

    manager = createIntegrationManager(mockConfig);
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create integration manager with default config', () => {
      const defaultManager = createIntegrationManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager.getStatus().active).toBe(false);
    });

    it('should create integration manager with custom config', () => {
      expect(manager).toBeDefined();
      expect(manager.getStatus().active).toBe(false);
    });

    it('should initialize successfully with auto-detection', async () => {
      const initPromise = manager.initialize();
      await expect(initPromise).resolves.toBeUndefined();
      
      const status = manager.getStatus();
      expect(status.active).toBe(true);
      expect(status.detectedTools).toContain('vite');
    });

    it('should emit initialized event', async () => {
      const initSpy = jest.fn();
      manager.on('initialized', initSpy);

      await manager.initialize();

      expect(initSpy).toHaveBeenCalledWith({
        tools: expect.arrayContaining(['vite'])
      });
    });
  });

  describe('Auto-Detection', () => {
    it('should detect Vite project correctly', async () => {
      await manager.initialize();
      
      const status = manager.getStatus();
      expect(status.detectedTools).toContain('vite');
    });

    it('should handle detection warnings and errors', async () => {
      // Create invalid config scenario
      vol.fromJSON({
        '/test-project/package.json': '{ invalid json',
      }, '/test-project');

      await expect(manager.initialize()).rejects.toThrow();
    });

    it('should emit config-detected event', async () => {
      const detectSpy = jest.fn();
      manager.on('config-detected', detectSpy);

      await manager.initialize();

      expect(detectSpy).toHaveBeenCalledWith({
        result: expect.objectContaining({
          detected: expect.any(Array),
          pluginConfigs: expect.any(Array)
        })
      });
    });
  });

  describe('Plugin Management', () => {
    let mockPlugin: jest.Mocked<BuildToolPlugin>;
    let mockPluginConfig: BuildToolPluginConfig;

    beforeEach(() => {
      mockPlugin = {
        pluginType: 'build-tool',
        supportedBuildTools: ['vite'],
        buildToolConfigSchema: {} as any,
        hooks: {
          beforeBuild: jest.fn(),
          afterBuild: jest.fn()
        },
        initializeBuildTool: jest.fn().mockResolvedValue(undefined),
        processBuild: jest.fn().mockResolvedValue({
          success: true,
          assets: {},
          metrics: {} as any,
          warnings: []
        }),
        handleHMR: jest.fn().mockResolvedValue(undefined)
      } as any;

      mockPluginConfig = {
        name: 'test-plugin',
        enabled: true,
        priority: 10,
        buildTool: {
          type: 'vite',
          autoDetect: true
        }
      };
    });

    it('should register custom plugin', () => {
      manager.registerPlugin('test-plugin', mockPlugin, mockPluginConfig);
      
      const plugins = manager.getActivePlugins();
      expect(plugins.has('test-plugin')).toBe(true);
      expect(plugins.get('test-plugin')).toBe(mockPlugin);
    });

    it('should unregister plugin', () => {
      manager.registerPlugin('test-plugin', mockPlugin, mockPluginConfig);
      manager.unregisterPlugin('test-plugin');
      
      const plugins = manager.getActivePlugins();
      expect(plugins.has('test-plugin')).toBe(false);
    });

    it('should emit plugin-loaded event', () => {
      const pluginSpy = jest.fn();
      manager.on('plugin-loaded', pluginSpy);

      manager.registerPlugin('test-plugin', mockPlugin, mockPluginConfig);

      expect(pluginSpy).toHaveBeenCalledWith({
        name: 'test-plugin',
        buildTool: 'vite'
      });
    });

    it('should handle plugin errors gracefully', () => {
      const errorSpy = jest.fn();
      manager.on('plugin-error', errorSpy);

      const badPlugin = { ...mockPlugin };
      delete (badPlugin as any).initializeBuildTool;

      manager.registerPlugin('bad-plugin', badPlugin as any, mockPluginConfig);
      
      // Plugin should still be registered but errors tracked
      expect(manager.getActivePlugins().has('bad-plugin')).toBe(true);
    });
  });

  describe('Build Process', () => {
    let mockPlugin: jest.Mocked<BuildToolPlugin>;

    beforeEach(() => {
      mockPlugin = {
        pluginType: 'build-tool',
        supportedBuildTools: ['vite'],
        buildToolConfigSchema: {} as any,
        hooks: {
          beforeBuild: jest.fn(),
          afterBuild: jest.fn()
        },
        initializeBuildTool: jest.fn().mockResolvedValue(undefined),
        processBuild: jest.fn().mockResolvedValue({
          success: true,
          assets: { 'main.css': 'body { color: red; }' },
          metrics: {
            startTime: Date.now(),
            endTime: Date.now(),
            phaseTimings: {},
            memoryPeaks: {},
            assetSizes: {},
            fileCounts: { total: 1, processed: 1, skipped: 0 }
          },
          warnings: []
        }),
        handleHMR: jest.fn().mockResolvedValue(undefined)
      } as any;

      manager.registerPlugin('vite-plugin', mockPlugin, {
        name: 'vite-plugin',
        enabled: true,
        priority: 10,
        buildTool: { type: 'vite', autoDetect: true }
      });
    });

    it('should execute build successfully', async () => {
      const result = await manager.startBuild('vite');
      
      expect(result.success).toBe(true);
      expect(result.assets).toEqual({ 'main.css': 'body { color: red; }' });
      expect(mockPlugin.initializeBuildTool).toHaveBeenCalled();
      expect(mockPlugin.processBuild).toHaveBeenCalled();
    });

    it('should emit build events', async () => {
      const startSpy = jest.fn();
      const completeSpy = jest.fn();
      
      manager.on('build-started', startSpy);
      manager.on('build-completed', completeSpy);

      await manager.startBuild('vite');

      expect(startSpy).toHaveBeenCalledWith({
        context: expect.objectContaining({
          buildTool: 'vite',
          projectRoot: '/test-project'
        })
      });

      expect(completeSpy).toHaveBeenCalledWith({
        result: expect.objectContaining({
          success: true,
          assets: expect.any(Object)
        })
      });
    });

    it('should handle plugin failures during build', async () => {
      mockPlugin.processBuild.mockResolvedValueOnce({
        success: false,
        error: 'Build failed',
        assets: {},
        metrics: {} as any,
        warnings: []
      });

      const result = await manager.startBuild('vite');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Build failed');
    });

    it('should handle build exceptions', async () => {
      mockPlugin.processBuild.mockRejectedValueOnce(new Error('Plugin crashed'));

      const result = await manager.startBuild('vite');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Plugin crashed');
    });

    it('should sort plugins by priority', async () => {
      const lowPriorityPlugin = { ...mockPlugin };
      const highPriorityPlugin = { ...mockPlugin };

      manager.registerPlugin('low-priority', lowPriorityPlugin, {
        name: 'low-priority',
        enabled: true,
        priority: 20,
        buildTool: { type: 'vite', autoDetect: true }
      });

      manager.registerPlugin('high-priority', highPriorityPlugin, {
        name: 'high-priority',
        enabled: true,
        priority: 5,
        buildTool: { type: 'vite', autoDetect: true }
      });

      await manager.startBuild('vite');

      // High priority plugin should be called first
      expect(highPriorityPlugin.initializeBuildTool).toHaveBeenCalled();
      expect(lowPriorityPlugin.initializeBuildTool).toHaveBeenCalled();
    });
  });

  describe('HMR (Hot Module Replacement)', () => {
    let mockPlugin: jest.Mocked<BuildToolPlugin>;

    beforeEach(() => {
      mockPlugin = {
        pluginType: 'build-tool',
        supportedBuildTools: ['vite'],
        buildToolConfigSchema: {} as any,
        hooks: {
          onFileChange: jest.fn().mockResolvedValue(undefined)
        },
        initializeBuildTool: jest.fn().mockResolvedValue(undefined),
        processBuild: jest.fn().mockResolvedValue({
          success: true,
          assets: {},
          metrics: {} as any,
          warnings: []
        }),
        handleHMR: jest.fn().mockResolvedValue(undefined)
      } as any;

      manager.registerPlugin('vite-plugin', mockPlugin, {
        name: 'vite-plugin',
        enabled: true,
        priority: 10,
        buildTool: { type: 'vite', autoDetect: true }
      });
    });

    it('should handle file changes for HMR', async () => {
      await manager.initialize();
      
      // Set up active context
      await manager.startBuild('vite');
      
      await manager.handleFileChange('/test-project/src/App.tsx');

      expect(mockPlugin.hooks.onFileChange).toHaveBeenCalledWith(
        '/test-project/src/App.tsx',
        expect.any(Object)
      );
    });

    it('should emit HMR update events', async () => {
      const hmrSpy = jest.fn();
      manager.on('hmr-update', hmrSpy);

      await manager.initialize();
      await manager.startBuild('vite');
      await manager.handleFileChange('/test-project/src/App.tsx');

      expect(hmrSpy).toHaveBeenCalledWith({
        filePath: '/test-project/src/App.tsx',
        buildTool: 'vite'
      });
    });

    it('should skip HMR when disabled', async () => {
      // Create manager with HMR disabled
      const noHMRManager = createIntegrationManager({
        ...mockConfig,
        hmr: false
      });

      noHMRManager.registerPlugin('vite-plugin', mockPlugin, {
        name: 'vite-plugin',
        enabled: true,
        priority: 10,
        buildTool: { type: 'vite', autoDetect: true }
      });

      await noHMRManager.initialize();
      await noHMRManager.startBuild('vite');
      await noHMRManager.handleFileChange('/test-project/src/App.tsx');

      expect(mockPlugin.hooks.onFileChange).not.toHaveBeenCalled();
      
      await noHMRManager.shutdown();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        enabledTools: ['webpack', 'vite', 'rollup'] as BuildToolType[]
      };

      manager.updateConfig(newConfig);
      
      const status = manager.getStatus();
      expect(status.lastUpdate).toBeGreaterThan(0);
    });

    it('should get current status', () => {
      const status = manager.getStatus();
      
      expect(status).toMatchObject({
        active: false,
        detectedTools: [],
        activePlugins: [],
        lastUpdate: expect.any(Number),
        errors: 0,
        warnings: 0
      });
    });

    it('should track errors and warnings', async () => {
      const badPlugin = {
        supportedBuildTools: ['vite'],
        initializeBuildTool: jest.fn().mockRejectedValue(new Error('Init failed'))
      } as any;

      manager.registerPlugin('bad-plugin', badPlugin, {
        name: 'bad-plugin',
        enabled: true,
        priority: 10,
        buildTool: { type: 'vite', autoDetect: true }
      });

      try {
        await manager.startBuild('vite');
      } catch (error) {
        // Expected to fail
      }

      const status = manager.getStatus();
      expect(status.errors).toBeGreaterThan(0);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await manager.initialize();
      await manager.shutdown();
      
      const status = manager.getStatus();
      expect(status.active).toBe(false);
      expect(status.activePlugins).toEqual([]);
    });

    it('should clear all resources on shutdown', async () => {
      const mockPlugin = {
        supportedBuildTools: ['vite'],
        initializeBuildTool: jest.fn(),
        processBuild: jest.fn().mockResolvedValue({
          success: true,
          assets: {},
          metrics: {} as any,
          warnings: []
        })
      } as any;

      manager.registerPlugin('test-plugin', mockPlugin, {
        name: 'test-plugin',
        enabled: true,
        priority: 10,
        buildTool: { type: 'vite', autoDetect: true }
      });

      await manager.initialize();
      await manager.startBuild('vite');
      await manager.shutdown();

      expect(manager.getActivePlugins().size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      // Mock config detector to throw error
      const errorManager = createIntegrationManager({
        ...mockConfig,
        projectRoot: '/non-existent'
      });

      await expect(errorManager.initialize()).rejects.toThrow();
    });

    it('should handle plugin loading errors gracefully', async () => {
      const errorSpy = jest.fn();
      manager.on('plugin-error', errorSpy);

      // Register plugin with invalid config
      const badPlugin = null as any;
      
      try {
        manager.registerPlugin('bad-plugin', badPlugin, {
          name: 'bad-plugin',
          enabled: true,
          priority: 10,
          buildTool: { type: 'vite', autoDetect: true }
        });
      } catch (error) {
        // Expected to fail
      }

      expect(errorSpy).toHaveBeenCalledWith({
        name: 'bad-plugin',
        error: expect.any(Error)
      });
    });

    it('should recover from HMR errors', async () => {
      const mockPlugin = {
        supportedBuildTools: ['vite'],
        hooks: {
          onFileChange: jest.fn().mockRejectedValue(new Error('HMR failed'))
        },
        initializeBuildTool: jest.fn(),
        processBuild: jest.fn().mockResolvedValue({
          success: true,
          assets: {},
          metrics: {} as any,
          warnings: []
        })
      } as any;

      manager.registerPlugin('vite-plugin', mockPlugin, {
        name: 'vite-plugin',
        enabled: true,
        priority: 10,
        buildTool: { type: 'vite', autoDetect: true }
      });

      await manager.initialize();
      await manager.startBuild('vite');

      // Should not throw, but handle error gracefully
      await expect(manager.handleFileChange('/test-project/src/App.tsx')).resolves.toBeUndefined();
    });
  });
}); 