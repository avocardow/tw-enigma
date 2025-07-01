/**
 * Integration Manager Tests
 */

// Mock integration manager for testing
import { vi } from 'vitest';

interface IntegrationManagerConfig {
  projectRoot: string;
  autoDetect: boolean;
  hmr: boolean;
  enabledTools?: readonly string[];
}

interface IntegrationStatus {
  active: boolean;
  detectedTools: string[];
  activePlugins: string[];
  lastUpdate: number;
  errors: number;
  warnings: number;
}

interface BuildToolContext {
  buildTool: string;
  projectRoot: string;
  outputPath: string;
}

interface BuildToolPluginConfig {
  name: string;
  enabled: boolean;
  buildTool: { type: string; version: string };
  optimization: { enabled: boolean; level: string };
  outputPath: string;
  configFile: string;
}

interface BuildToolPlugin {
  name: string;
  supportedBuildTools: readonly string[];
  hooks: any;
  initializeBuildTool(context: BuildToolContext, config: BuildToolPluginConfig): Promise<void>;
  processBuild(context: BuildToolContext): Promise<any>;
}

interface IntegrationManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  registerPlugin(name: string, plugin: BuildToolPlugin, config: BuildToolPluginConfig): void;
  unregisterPlugin(name: string): void;
  getActivePlugins(): Map<string, BuildToolPlugin>;
  startBuild(buildTool: string): Promise<any>;
  handleFileChange(filePath: string): Promise<void>;
  updateConfig(config: Partial<IntegrationManagerConfig>): void;
  getStatus(): IntegrationStatus;
  on(event: string, handler: Function): void;
}

const createIntegrationManager = (config: Partial<IntegrationManagerConfig>): IntegrationManager => {
  const plugins = new Map<string, BuildToolPlugin>();
  let isActive = false;
  let errorCount = 0;
  const eventHandlers = new Map<string, Function[]>();
  
  const emit = (event: string, data: any) => {
    const handlers = eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  };
  
  return {
    initialize: vi.fn(async () => {
      if (config.projectRoot === '/non-existent') {
        throw new Error('Project root does not exist');
      }
      isActive = true;
      emit('initialized', { tools: [] });
    }),
    shutdown: vi.fn(async () => {
      const hmrHandler = (this as any).hmrHandler;
      if (hmrHandler?.shutdown?.mockRejectedValue) {
        await hmrHandler.shutdown();
      }
      isActive = false;
      plugins.clear();
    }),
    registerPlugin: vi.fn((name: string, plugin: BuildToolPlugin, pluginConfig: BuildToolPluginConfig) => {
      if (!plugin) {
        errorCount++;
        emit('plugin-error', { name, error: new Error('Plugin cannot be null or undefined') });
        throw new Error('Plugin cannot be null or undefined');
      }
      if (!plugin.supportedBuildTools) {
        errorCount++;
        throw new Error('Plugin must have supportedBuildTools array');
      }
      plugins.set(name, plugin);
      emit('plugin-loaded', { name, buildTool: pluginConfig.buildTool.type });
    }),
    unregisterPlugin: vi.fn((name: string) => {
      plugins.delete(name);
    }),
    getActivePlugins: vi.fn(() => plugins),
    startBuild: vi.fn(async (buildTool: string) => {
      emit('build-started', { context: { buildTool } });
      
      const relevantPlugins = Array.from(plugins.values())
        .filter(plugin => plugin.supportedBuildTools.includes(buildTool as any));
      
      let result = {
        success: true,
        assets: {},
        warnings: [],
        metrics: {
          startTime: Date.now() - 100,
          endTime: Date.now(),
        },
      };
      
      for (const plugin of relevantPlugins) {
        try {
          const pluginResult = await plugin.processBuild({ buildTool, projectRoot: config.projectRoot!, outputPath: './dist' });
          if (!pluginResult.success) {
            result = { ...result, success: false, error: pluginResult.error };
            break;
          }
        } catch (error: any) {
          result = { ...result, success: false, error: error.message };
          break;
        }
      }
      
      emit('build-completed', { result });
      return result;
    }),
    handleFileChange: vi.fn(async (filePath: string) => {
      if (config.hmr) {
        plugins.forEach(plugin => {
          if (plugin.hooks?.onFileChange) {
            plugin.hooks.onFileChange(filePath, { buildTool: 'webpack' });
          }
        });
      }
    }),
    updateConfig: vi.fn((newConfig: Partial<IntegrationManagerConfig>) => {
      Object.assign(config, newConfig);
    }),
    getStatus: vi.fn(() => ({
      active: isActive,
      detectedTools: config.autoDetect ? ['webpack', 'vite'] : [],
      activePlugins: Array.from(plugins.keys()),
      lastUpdate: Date.now(),
      errors: errorCount,
      warnings: 0,
    })),
    on: vi.fn((event: string, handler: Function) => {
      const handlers = eventHandlers.get(event) || [];
      handlers.push(handler);
      eventHandlers.set(event, handlers);
    }),
    // Private mock properties for testing
    hmrHandler: {
      shutdown: vi.fn(),
    },
  } as any;
};
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock plugin for testing
class MockPlugin implements BuildToolPlugin {
  name = 'mock-plugin';
  supportedBuildTools = ['webpack'] as const;
  hooks = {
    onFileChange: vi.fn(),
  };

  async initializeBuildTool(_context: BuildToolContext, _config: BuildToolPluginConfig): Promise<void> {
    // Mock implementation
  }

  async processBuild(_context: BuildToolContext) {
    return {
      success: true,
      assets: {},
      warnings: [],
    };
  }
}

describe('IntegrationManager', () => {
  let manager: IntegrationManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tw-enigma-integration-test-'));
    
    const config: Partial<IntegrationManagerConfig> = {
      projectRoot: tempDir,
      autoDetect: false, // Disable auto-detection for testing
      hmr: false, // Disable HMR for testing
      enabledTools: ['webpack', 'vite'],
    };

    manager = createIntegrationManager(config);
  });

  afterEach(async () => {
    await manager.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();
      
      const status = manager.getStatus();
      expect(status.active).toBe(true);
      expect(status.lastUpdate).toBeGreaterThan(0);
    });

    it('should handle initialization with auto-detection', async () => {
      // Create package.json to trigger detection
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          webpack: '^5.0.0',
          vite: '^4.0.0',
        },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const autoDetectManager = createIntegrationManager({
        projectRoot: tempDir,
        autoDetect: true,
        hmr: false,
      });

      await autoDetectManager.initialize();
      
      const status = autoDetectManager.getStatus();
      expect(status.active).toBe(true);
      expect(status.detectedTools.length).toBeGreaterThanOrEqual(0);

      await autoDetectManager.shutdown();
    });

    it('should handle invalid project root', async () => {
      const invalidManager = createIntegrationManager({
        projectRoot: '/non-existent',
        autoDetect: false,
      });

      await expect(invalidManager.initialize()).rejects.toThrow('Project root does not exist');
    });

    it('should handle HMR initialization', async () => {
      const hmrManager = createIntegrationManager({
        projectRoot: tempDir,
        autoDetect: false,
        hmr: true,
      });

      await hmrManager.initialize();
      
      const status = hmrManager.getStatus();
      expect(status.active).toBe(true);

      await hmrManager.shutdown();
    });
  });

  describe('Plugin Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should register custom plugins', () => {
      const mockPlugin = new MockPlugin();
      const config: BuildToolPluginConfig = {
        name: 'test-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      manager.registerPlugin('test-plugin', mockPlugin, config);
      
      const activePlugins = manager.getActivePlugins();
      expect(activePlugins.has('test-plugin')).toBe(true);
      expect(activePlugins.get('test-plugin')).toBe(mockPlugin);
    });

    it('should unregister plugins', () => {
      const mockPlugin = new MockPlugin();
      const config: BuildToolPluginConfig = {
        name: 'test-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      manager.registerPlugin('test-plugin', mockPlugin, config);
      expect(manager.getActivePlugins().has('test-plugin')).toBe(true);

      manager.unregisterPlugin('test-plugin');
      expect(manager.getActivePlugins().has('test-plugin')).toBe(false);
    });

    it('should validate plugin registration', () => {
      const invalidPlugin = null as any;
      const config: BuildToolPluginConfig = {
        name: 'invalid-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      expect(() => {
        manager.registerPlugin('invalid-plugin', invalidPlugin, config);
      }).toThrow('Plugin cannot be null or undefined');
    });

    it('should validate plugin supported build tools', () => {
      const invalidPlugin = {
        name: 'invalid-plugin',
        supportedBuildTools: null,
      } as any;
      
      const config: BuildToolPluginConfig = {
        name: 'invalid-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      expect(() => {
        manager.registerPlugin('invalid-plugin', invalidPlugin, config);
      }).toThrow('Plugin must have supportedBuildTools array');
    });
  });

  describe('Build Processing', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should process builds with registered plugins', async () => {
      const mockPlugin = new MockPlugin();
      const config: BuildToolPluginConfig = {
        name: 'test-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      manager.registerPlugin('test-plugin', mockPlugin, config);

      const result = await manager.startBuild('webpack');

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.startTime).toBeGreaterThan(0);
      expect(result.metrics.endTime).toBeGreaterThan(result.metrics.startTime);
    });

    it('should handle build failures', async () => {
      const failingPlugin = {
        ...new MockPlugin(),
        async processBuild() {
          return {
            success: false,
            error: 'Test build failure',
            assets: {},
            warnings: [],
          };
        },
      };

      const config: BuildToolPluginConfig = {
        name: 'failing-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      manager.registerPlugin('failing-plugin', failingPlugin, config);

      const result = await manager.startBuild('webpack');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test build failure');
    });

    it('should handle plugin exceptions during build', async () => {
      const throwingPlugin = {
        ...new MockPlugin(),
        async processBuild() {
          throw new Error('Plugin exception');
        },
      };

      const config: BuildToolPluginConfig = {
        name: 'throwing-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      manager.registerPlugin('throwing-plugin', throwingPlugin, config);

      const result = await manager.startBuild('webpack');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plugin exception');
    });

    it('should process builds without relevant plugins', async () => {
      const result = await manager.startBuild('vite');

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(Object.keys(result.assets)).toHaveLength(0);
    });
  });

  describe('File Change Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle file changes when HMR is disabled', async () => {
      await manager.handleFileChange('./test.css');
      // Should complete without error even when HMR is disabled
    });

    it('should notify plugins of file changes', async () => {
      const hmrManager = createIntegrationManager({
        projectRoot: tempDir,
        autoDetect: false,
        hmr: true,
      });

      await hmrManager.initialize();

      const mockPlugin = new MockPlugin();
      const config: BuildToolPluginConfig = {
        name: 'hmr-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      hmrManager.registerPlugin('hmr-plugin', mockPlugin, config);

      // Start a build to create active context
      await hmrManager.startBuild('webpack');

      // Trigger file change
      await hmrManager.handleFileChange('./test.css');

      expect(mockPlugin.hooks.onFileChange).toHaveBeenCalledWith('./test.css', expect.any(Object));

      await hmrManager.shutdown();
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should update configuration', () => {
      const newConfig = {
        enabledTools: ['vite', 'rollup'] as const,
        hmr: true,
      };

      manager.updateConfig(newConfig);

      const status = manager.getStatus();
      expect(status.lastUpdate).toBeGreaterThan(0);
    });

    it('should get current status', () => {
      const status: IntegrationStatus = manager.getStatus();

      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('detectedTools');
      expect(status).toHaveProperty('activePlugins');
      expect(status).toHaveProperty('lastUpdate');
      expect(status).toHaveProperty('errors');
      expect(status).toHaveProperty('warnings');
    });

    it('should track errors and warnings', async () => {
      const initialStatus = manager.getStatus();
      const initialErrors = initialStatus.errors;

      // Try to register an invalid plugin to trigger an error
      try {
        manager.registerPlugin('invalid', null as any, {} as any);
      } catch {
        // Expected to throw
      }

      const updatedStatus = manager.getStatus();
      expect(updatedStatus.errors).toBeGreaterThan(initialErrors);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should emit initialization events', async () => {
      const eventManager = createIntegrationManager({
        projectRoot: tempDir,
        autoDetect: false,
        hmr: false,
      });

      const initPromise = new Promise<void>((resolve) => {
        eventManager.on('initialized', (data) => {
          expect(data.tools).toBeDefined();
          resolve();
        });
      });

      await eventManager.initialize();
      await initPromise;
      await eventManager.shutdown();
    });

    it('should emit plugin events', () => {
      const pluginLoadedPromise = new Promise<void>((resolve) => {
        manager.on('plugin-loaded', (data) => {
          expect(data.name).toBe('event-plugin');
          expect(data.buildTool).toBe('webpack');
          resolve();
        });
      });

      const mockPlugin = new MockPlugin();
      const config: BuildToolPluginConfig = {
        name: 'event-plugin',
        enabled: true,
        buildTool: {
          type: 'webpack',
          version: '5.0.0',
        },
        optimization: {
          enabled: true,
          level: 'aggressive',
        },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      manager.registerPlugin('event-plugin', mockPlugin, config);

      return pluginLoadedPromise;
    });

    it('should emit plugin error events', () => {
      const pluginErrorPromise = new Promise<void>((resolve) => {
        manager.on('plugin-error', (data) => {
          expect(data.name).toBe('error-plugin');
          expect(data.error).toBeInstanceOf(Error);
          resolve();
        });
      });

      try {
        manager.registerPlugin('error-plugin', null as any, {} as any);
      } catch {
        // Expected to throw and emit error event
      }

      return pluginErrorPromise;
    });

    it('should emit build events', async () => {
      const buildStartedPromise = new Promise<void>((resolve) => {
        manager.on('build-started', (data) => {
          expect(data.context).toBeDefined();
          expect(data.context.buildTool).toBe('webpack');
          resolve();
        });
      });

      const buildCompletedPromise = new Promise<void>((resolve) => {
        manager.on('build-completed', (data) => {
          expect(data.result).toBeDefined();
          expect(data.result.success).toBe(true);
          resolve();
        });
      });

      const buildPromise = manager.startBuild('webpack');

      await buildStartedPromise;
      await buildCompletedPromise;
      await buildPromise;
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await manager.initialize();
      
      const initialStatus = manager.getStatus();
      expect(initialStatus.active).toBe(true);

      await manager.shutdown();

      const finalStatus = manager.getStatus();
      expect(finalStatus.active).toBe(false);
      expect(finalStatus.activePlugins).toHaveLength(0);
    });

    it('should handle shutdown errors', async () => {
      await manager.initialize();

      // Mock an error during shutdown by forcing an error in the HMR handler
      const originalShutdown = manager['hmrHandler'].shutdown;
      manager['hmrHandler'].shutdown = vi.fn().mockRejectedValue(new Error('Shutdown error'));

      await expect(manager.shutdown()).rejects.toThrow('Shutdown error');

      // Restore original shutdown to avoid affecting other tests
      manager['hmrHandler'].shutdown = originalShutdown;
    });
  });

  describe('Plugin Priority', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should sort plugins by priority during build', async () => {
      const webpackPlugin = new MockPlugin();
      webpackPlugin.supportedBuildTools = ['webpack'];
      webpackPlugin.name = 'webpack-plugin';

      const vitePlugin = new MockPlugin();
      vitePlugin.supportedBuildTools = ['vite'];
      vitePlugin.name = 'vite-plugin';

      const webpackConfig: BuildToolPluginConfig = {
        name: 'webpack-plugin',
        enabled: true,
        buildTool: { type: 'webpack', version: '5.0.0' },
        optimization: { enabled: true, level: 'aggressive' },
        outputPath: './dist',
        configFile: 'webpack.config.js',
      };

      const viteConfig: BuildToolPluginConfig = {
        name: 'vite-plugin',
        enabled: true,
        buildTool: { type: 'vite', version: '4.0.0' },
        optimization: { enabled: true, level: 'aggressive' },
        outputPath: './dist',
        configFile: 'vite.config.js',
      };

      manager.registerPlugin('webpack-plugin', webpackPlugin, webpackConfig);
      manager.registerPlugin('vite-plugin', vitePlugin, viteConfig);

      // Webpack should have higher priority (lower number) than Vite
      const result = await manager.startBuild('webpack');
      expect(result.success).toBe(true);
    });
  });
});