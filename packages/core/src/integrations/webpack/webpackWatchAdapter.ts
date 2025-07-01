/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Compilation, Compiler } from 'webpack';
import { createLogger } from '../../utils/logger';
import type {
  BuildToolWatchConfig,
  WatchIntegrationResult,
} from '../core/buildToolWatchIntegration';
import { createBuildToolWatchIntegration } from '../core/buildToolWatchIntegration';
import { EnigmaWebpackPlugin } from './webpackPlugin';

const logger = createLogger('WebpackWatchAdapter');

/**
 * Webpack-specific watch configuration
 */
export interface WebpackWatchConfig extends BuildToolWatchConfig {
  buildTool: 'webpack';
  webpack?: {
    /** Enable webpack dev server integration */
    enableDevServer?: boolean;
    /** Watch for additional file types */
    additionalExtensions?: string[];
    /** Custom webpack watch options */
    watchOptions?: {
      aggregateTimeout?: number;
      poll?: boolean | number;
      ignored?: string | string[];
    };
    /** HMR configuration */
    hmr?: {
      /** HMR client port */
      port?: number;
      /** HMR client host */
      host?: string;
      /** Enable overlay on errors */
      overlay?: boolean;
    };
  };
}

/**
 * Enhanced webpack plugin with watch mode integration
 */
export class EnigmaWebpackWatchPlugin extends EnigmaWebpackPlugin {
  private watchIntegration?: any;
  private watchConfig: WebpackWatchConfig;
  private isWatchMode = false;
  private compiler?: Compiler;

  constructor(config: Partial<WebpackWatchConfig> = {}) {
    // Call parent constructor with build tool config
    const buildToolConfig = {
      ...config,
      buildTool: { ...config.buildTool, type: 'webpack' as const },
    };
    super(buildToolConfig as any);

    // Merge watch-specific config
    this.watchConfig = this.mergeWatchConfig(config);

    logger.info('EnigmaWebpackWatchPlugin initialized', {
      watchEnabled: this.watchConfig.enabled,
      fastMode: this.watchConfig.fastMode.enabled,
      hmr: this.watchConfig.hmr.enabled,
    });
  }

  /**
   * Override apply method to add watch capabilities
   */
  apply(compiler: Compiler): void {
    // Call parent apply first
    super.apply(compiler);

    this.compiler = compiler;
    this.setupWatchIntegration(compiler);
  }

  /**
   * Setup watch mode integration
   */
  private setupWatchIntegration(compiler: Compiler): void {
    // Initialize watch integration
    this.watchIntegration = createBuildToolWatchIntegration(this.watchConfig);

    // Hook into webpack's watch mode
    compiler.hooks.watchRun.tapAsync('EnigmaWebpackWatchPlugin', async (compilation, callback) => {
      this.isWatchMode = true;

      try {
        await this.initializeWatchMode();
        callback();
      } catch (error) {
        logger.error('Failed to initialize watch mode', { error });
        callback(error as Error);
      }
    });

    // Hook into file changes
    compiler.hooks.invalid.tap('EnigmaWebpackWatchPlugin', (fileName, changeTime) => {
      if (fileName && this.isWatchMode) {
        this.handleFileChange(fileName, 'change', changeTime);
      }
    });

    // Hook into compilation for CSS extraction
    compiler.hooks.compilation.tap('EnigmaWebpackWatchPlugin', (compilation: Compilation) => {
      if (this.isWatchMode) {
        this.setupCompilationHooks(compilation);
      }
    });

    // Setup shutdown hooks
    compiler.hooks.watchClose.tap('EnigmaWebpackWatchPlugin', () => {
      this.shutdownWatchMode();
    });

    // Setup HMR if enabled
    if (this.watchConfig.hmr.enabled) {
      this.setupHMRIntegration(compiler);
    }
  }

  /**
   * Initialize watch mode
   */
  private async initializeWatchMode(): Promise<void> {
    if (!this.watchIntegration) {
      return;
    }

    try {
      await this.watchIntegration.initialize();
      await this.watchIntegration.startWatch();

      logger.info('Webpack watch mode initialized', {
        projectRoot: this.watchConfig.projectRoot,
        includes: this.watchConfig.watch.include,
      });
    } catch (error) {
      logger.error('Failed to initialize watch mode', { error });
      throw error;
    }
  }

  /**
   * Handle file change events
   */
  private async handleFileChange(
    filePath: string,
    changeType: 'add' | 'change' | 'unlink' = 'change',
    _changeTime?: number
  ): Promise<void> {
    if (!this.watchIntegration || !this.isWatchMode) {
      return;
    }

    try {
      const result = await this.watchIntegration.handleFileChange(filePath, changeType);

      // Log result
      if (result.success) {
        logger.debug('File change processed', {
          filePath,
          duration: result.duration,
          bytesOptimized: result.bytesOptimized,
          cacheHit: result.watchMode.cacheHit,
        });
      } else {
        logger.warn('File change processing failed', {
          filePath,
          errors: result.errors,
        });
      }

      // Trigger HMR if needed
      if (this.watchConfig.hmr.enabled && result.success) {
        await this.triggerHMRUpdate(filePath, result);
      }
    } catch (error) {
      logger.error('Error handling file change', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Setup compilation hooks for CSS processing
   */
  private setupCompilationHooks(compilation: Compilation): void {
    // Hook into additional assets processing
    compilation.hooks.additionalAssets.tapAsync('EnigmaWebpackWatchPlugin', async (callback) => {
      try {
        await this.processWatchAssets(compilation);
        callback();
      } catch (error) {
        logger.error('Error processing watch assets', { error });
        callback(error as Error);
      }
    });
  }

  /**
   * Process assets in watch mode
   */
  private async processWatchAssets(compilation: Compilation): Promise<void> {
    const assets = compilation.assets;
    const cssAssets = Object.keys(assets).filter((name) => name.endsWith('.css'));

    if (cssAssets.length === 0) {
      return;
    }

    for (const assetName of cssAssets) {
      const asset = assets[assetName];
      const source = asset.source();

      if (typeof source === 'string' && source.length > 0) {
        // Process CSS through watch integration
        // This would integrate with fast mode optimizer
        logger.debug('Processing CSS asset in watch mode', {
          assetName,
          size: source.length,
        });
      }
    }
  }

  /**
   * Setup HMR integration
   */
  private setupHMRIntegration(compiler: Compiler): void {
    if (!compiler.options.devServer) {
      logger.debug('DevServer not configured, skipping HMR setup');
      return;
    }

    // Hook into webpack-dev-server's socket system
    compiler.hooks.done.tap('EnigmaWebpackWatchPlugin-HMR', (stats) => {
      if (this.isWatchMode && !stats.hasErrors()) {
        this.broadcastHMRUpdate(stats);
      }
    });
  }

  /**
   * Trigger HMR update
   */
  private async triggerHMRUpdate(filePath: string, result: WatchIntegrationResult): Promise<void> {
    if (!this.watchIntegration) {
      return;
    }

    try {
      const hmrUpdate = {
        type: 'css' as const,
        path: filePath,
        content: '', // Would contain optimized CSS
        timestamp: Date.now(),
        metadata: {
          bytesOptimized: result.bytesOptimized,
          duration: result.duration,
          fastMode: result.watchMode.fastMode,
        },
      };

      await this.watchIntegration.triggerHMR(hmrUpdate);
    } catch (error) {
      logger.error('Failed to trigger HMR update', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast HMR update to clients
   */
  private broadcastHMRUpdate(stats: any): void {
    const hmrPayload = {
      type: 'css-update',
      timestamp: Date.now(),
      stats: {
        hasErrors: stats.hasErrors(),
        hasWarnings: stats.hasWarnings(),
      },
      enigmaOptimizations: {
        filesProcessed: 1, // Would be actual count
        bytesOptimized: 0, // Would be actual amount
      },
    };

    // This would integrate with webpack-dev-server's HMR system
    logger.debug('Broadcasting HMR update', { payload: hmrPayload });
  }

  /**
   * Shutdown watch mode
   */
  private async shutdownWatchMode(): Promise<void> {
    if (this.watchIntegration) {
      try {
        await this.watchIntegration.cleanup();
        logger.info('Webpack watch mode shutdown complete');
      } catch (error) {
        logger.error('Error during watch mode shutdown', { error });
      }
    }
    this.isWatchMode = false;
  }

  /**
   * Get watch metrics
   */
  getWatchMetrics(): Record<string, any> {
    if (!this.watchIntegration) {
      return { watchMode: false };
    }

    return {
      watchMode: this.isWatchMode,
      ...this.watchIntegration.getMetrics(),
    };
  }

  /**
   * Toggle fast mode during development
   */
  toggleFastMode(enabled?: boolean): void {
    if (this.watchIntegration) {
      this.watchIntegration.toggleFastMode(enabled);
    }
  }

  /**
   * Merge watch configuration with defaults
   */
  private mergeWatchConfig(config: Partial<WebpackWatchConfig>): WebpackWatchConfig {
    return {
      enabled: true,
      buildTool: 'webpack',
      projectRoot: process.cwd(),
      watch: {
        include: ['**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        recursive: true,
        debounceMs: 300, // Webpack typically uses longer debounce
      },
      fastMode: {
        enabled: true,
        mode: 'balanced',
        showIndicators: true,
      },
      incremental: {
        enabled: true,
        cacheDir: '.tw-enigma/cache/webpack',
        maxCacheSize: 100,
        trackDependencies: true,
      },
      hmr: {
        enabled: true,
        delay: 100,
        liveReload: true,
      },
      hooks: {
        onBuildStart: true,
        onFileChange: true,
        onBuildEnd: true,
        onError: true,
      },
      webpack: {
        enableDevServer: true,
        additionalExtensions: ['.vue', '.jsx', '.tsx'],
        watchOptions: {
          aggregateTimeout: 300,
          poll: false,
          ignored: /node_modules/,
        },
        hmr: {
          port: 8080,
          host: 'localhost',
          overlay: true,
        },
      },
      ...config,
    };
  }
}

/**
 * Factory function for webpack watch plugin
 */
export function createWebpackWatchPlugin(
  config?: Partial<WebpackWatchConfig>
): EnigmaWebpackWatchPlugin {
  return new EnigmaWebpackWatchPlugin(config);
}

/**
 * Webpack watch configuration presets
 */
export const WEBPACK_WATCH_PRESETS = {
  development: {
    enabled: true,
    fastMode: { enabled: true, mode: 'ultra' as const },
    hmr: { enabled: true, delay: 50 },
    watch: { debounceMs: 200 },
  },
  production: {
    enabled: false, // Typically no watch in production
    fastMode: { enabled: false, mode: 'conservative' as const },
    hmr: { enabled: false },
  },
  testing: {
    enabled: true,
    fastMode: { enabled: true, mode: 'balanced' as const },
    hmr: { enabled: false },
    watch: { debounceMs: 100 },
  },
} as const;
