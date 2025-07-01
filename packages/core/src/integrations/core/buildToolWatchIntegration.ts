/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { WatchModeController } from '../../watch/controller';
import { EnhancedIncrementalOptimizer } from '../../watch/enhancedIncrementalOptimizer';
import { FastModeOptimizer, createFastModeOptimizer } from '../../watch/fastModeOptimizer';
import type { OptimizationResult, WatchEvent } from '../../watch/types';
import type { BuildToolContext, HMRUpdate } from './buildToolPlugin';

const logger = createLogger('BuildToolWatchIntegration');

/**
 * Configuration for build tool watch integration
 */
export interface BuildToolWatchConfig {
  /** Enable watch mode integration */
  enabled: boolean;

  /** Build tool type */
  buildTool: 'webpack' | 'rollup' | 'vite' | 'esbuild' | 'parcel' | 'gulp' | 'npm';

  /** Project root directory */
  projectRoot: string;

  /** Watch configuration */
  watch: {
    /** Patterns to watch */
    include: string[];
    /** Patterns to exclude */
    exclude: string[];
    /** Enable deep watching */
    recursive: boolean;
    /** Debounce delay in ms */
    debounceMs: number;
  };

  /** Fast mode configuration */
  fastMode: {
    /** Enable fast mode */
    enabled: boolean;
    /** Fast mode intensity */
    mode: 'ultra' | 'balanced' | 'conservative';
    /** Show fast mode indicators */
    showIndicators: boolean;
  };

  /** Incremental optimization settings */
  incremental: {
    /** Enable incremental optimization */
    enabled: boolean;
    /** Cache directory */
    cacheDir: string;
    /** Maximum cache size */
    maxCacheSize: number;
    /** Enable dependency tracking */
    trackDependencies: boolean;
  };

  /** HMR integration */
  hmr: {
    /** Enable HMR updates */
    enabled: boolean;
    /** HMR update delay */
    delay: number;
    /** Enable live reload fallback */
    liveReload: boolean;
  };

  /** Build hooks to integrate with */
  hooks: {
    /** Hook into build start */
    onBuildStart: boolean;
    /** Hook into file change */
    onFileChange: boolean;
    /** Hook into build end */
    onBuildEnd: boolean;
    /** Hook into error */
    onError: boolean;
  };
}

/**
 * Watch integration result
 */
export interface WatchIntegrationResult {
  success: boolean;
  duration: number;
  filesProcessed: number;
  bytesOptimized: number;
  buildTool: string;
  watchMode: {
    enabled: boolean;
    fastMode: boolean;
    incremental: boolean;
    cacheHit: boolean;
  };
  errors: string[];
  warnings: string[];
  metadata: Record<string, any>;
}

/**
 * Build tool watch integration event types
 */
export interface BuildToolWatchEvents {
  'watch-started': { buildTool: string; config: BuildToolWatchConfig };
  'watch-stopped': { buildTool: string };
  'file-changed': { filePath: string; buildTool: string; event: WatchEvent };
  'optimization-complete': { result: WatchIntegrationResult; buildTool: string };
  'hmr-update': { update: HMRUpdate; buildTool: string };
  error: { error: Error; buildTool: string; context?: string };
  'fast-mode-toggled': { enabled: boolean; buildTool: string };
}

/**
 * Build tool adapter interface
 */
export interface BuildToolAdapter {
  /** Build tool name */
  name: string;

  /** Check if this adapter supports the given build tool */
  supports(buildTool: string): boolean;

  /** Initialize the adapter */
  initialize(config: BuildToolWatchConfig): Promise<void>;

  /** Start watching */
  startWatch(): Promise<void>;

  /** Stop watching */
  stopWatch(): Promise<void>;

  /** Handle file change */
  handleFileChange(event: WatchEvent): Promise<WatchIntegrationResult>;

  /** Trigger HMR update */
  triggerHMR(update: HMRUpdate): Promise<void>;

  /** Get build tool specific context */
  getContext(): BuildToolContext;

  /** Cleanup resources */
  cleanup(): Promise<void>;
}

/**
 * Main build tool watch integration class
 */
export class BuildToolWatchIntegration extends EventEmitter<BuildToolWatchEvents> {
  private config: BuildToolWatchConfig;
  private watchController?: WatchModeController;
  private fastModeOptimizer?: FastModeOptimizer;
  private incrementalOptimizer?: EnhancedIncrementalOptimizer;
  private adapter?: BuildToolAdapter;
  private isWatching = false;
  private adapters = new Map<string, BuildToolAdapter>();

  constructor(config: Partial<BuildToolWatchConfig>) {
    super();
    this.config = this.mergeConfig(config);
    this.setupDefaultAdapters();

    logger.info('BuildToolWatchIntegration initialized', {
      buildTool: this.config.buildTool,
      enabled: this.config.enabled,
      fastMode: this.config.fastMode.enabled,
      incremental: this.config.incremental.enabled,
    });
  }

  /**
   * Initialize the integration system
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Watch integration disabled');
      return;
    }

    try {
      // Initialize watch controller
      this.watchController = new WatchModeController({
        enabled: true,
        projectRoot: this.config.projectRoot,
        include: this.config.watch.include,
        exclude: this.config.watch.exclude,
        recursive: this.config.watch.recursive,
        debounceMs: this.config.watch.debounceMs,
        hotReload: this.config.hmr.enabled,
        notifications: false, // Reduce noise
      });

      // Initialize fast mode optimizer
      if (this.config.fastMode.enabled) {
        this.fastModeOptimizer = createFastModeOptimizer(
          {
            enabled: true,
            cacheDir: this.config.incremental.cacheDir,
            maxCacheSize: this.config.incremental.maxCacheSize,
            trackDependencies: this.config.incremental.trackDependencies,
          },
          {
            enabled: true,
            mode: this.config.fastMode.mode,
            showFastModeIndicator: this.config.fastMode.showIndicators,
            debounceMs: this.config.watch.debounceMs,
          }
        );
      }

      // Initialize incremental optimizer
      if (this.config.incremental.enabled) {
        this.incrementalOptimizer = new EnhancedIncrementalOptimizer({
          enabled: true,
          cacheDir: this.config.incremental.cacheDir,
          maxCacheSize: this.config.incremental.maxCacheSize,
          trackDependencies: this.config.incremental.trackDependencies,
          parallelOptimization: true,
          maxConcurrency: 4,
        });
      }

      // Get the appropriate adapter
      this.adapter = this.getAdapter(this.config.buildTool);
      if (!this.adapter) {
        throw new Error(`No adapter found for build tool: ${this.config.buildTool}`);
      }

      // Initialize the adapter
      await this.adapter.initialize(this.config);

      // Setup event forwarding
      this.setupEventForwarding();

      logger.info('BuildToolWatchIntegration initialization complete');
    } catch (error) {
      logger.error('Failed to initialize BuildToolWatchIntegration', {
        error: error instanceof Error ? error.message : String(error),
        buildTool: this.config.buildTool,
      });
      throw error;
    }
  }

  /**
   * Start watching for file changes
   */
  async startWatch(): Promise<void> {
    if (!this.config.enabled || this.isWatching) {
      return;
    }

    try {
      // Start watch controller
      if (this.watchController) {
        await this.watchController.startWatching();
      }

      // Start build tool specific watching
      if (this.adapter) {
        await this.adapter.startWatch();
      }

      this.isWatching = true;
      this.emit('watch-started', {
        buildTool: this.config.buildTool,
        config: this.config,
      });

      logger.info('Watch mode started', {
        buildTool: this.config.buildTool,
        projectRoot: this.config.projectRoot,
      });
    } catch (error) {
      logger.error('Failed to start watch mode', {
        error: error instanceof Error ? error.message : String(error),
        buildTool: this.config.buildTool,
      });
      throw error;
    }
  }

  /**
   * Stop watching
   */
  async stopWatch(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    try {
      // Stop build tool specific watching
      if (this.adapter) {
        await this.adapter.stopWatch();
      }

      // Stop watch controller
      if (this.watchController) {
        await this.watchController.stopWatching();
      }

      this.isWatching = false;
      this.emit('watch-stopped', { buildTool: this.config.buildTool });

      logger.info('Watch mode stopped', { buildTool: this.config.buildTool });
    } catch (error) {
      logger.error('Failed to stop watch mode', {
        error: error instanceof Error ? error.message : String(error),
        buildTool: this.config.buildTool,
      });
    }
  }

  /**
   * Handle file change event
   */
  async handleFileChange(
    filePath: string,
    changeType: 'add' | 'change' | 'unlink'
  ): Promise<WatchIntegrationResult> {
    const startTime = Date.now();

    const event: WatchEvent = {
      type: changeType,
      path: filePath,
      timestamp: new Date(),
    };

    this.emit('file-changed', {
      filePath,
      buildTool: this.config.buildTool,
      event,
    });

    try {
      let result: WatchIntegrationResult;

      // Use fast mode optimizer if available
      if (this.fastModeOptimizer) {
        const fastResults = await this.fastModeOptimizer.processChange(event);
        result = this.convertToWatchResult(fastResults[0], startTime);
      }
      // Use incremental optimizer if available
      else if (this.incrementalOptimizer) {
        const incrementalResults = await this.incrementalOptimizer.processChange(event);
        result = this.convertToWatchResult(incrementalResults[0], startTime);
      }
      // Use build tool adapter
      else if (this.adapter) {
        result = await this.adapter.handleFileChange(event);
      }
      // Fallback to basic processing
      else {
        result = this.createBasicResult(filePath, startTime);
      }

      // Trigger HMR if enabled
      if (this.config.hmr.enabled && result.success) {
        const hmrUpdate: HMRUpdate = {
          type: 'css',
          path: filePath,
          content: '', // Would be filled with actual content
          timestamp: Date.now(),
        };

        await this.triggerHMR(hmrUpdate);
      }

      this.emit('optimization-complete', {
        result,
        buildTool: this.config.buildTool,
      });

      return result;
    } catch (error) {
      const errorResult: WatchIntegrationResult = {
        success: false,
        duration: Date.now() - startTime,
        filesProcessed: 0,
        bytesOptimized: 0,
        buildTool: this.config.buildTool,
        watchMode: {
          enabled: this.config.enabled,
          fastMode: this.config.fastMode.enabled,
          incremental: this.config.incremental.enabled,
          cacheHit: false,
        },
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        metadata: { filePath, error: true },
      };

      this.emit('error', {
        error: error instanceof Error ? error : new Error(String(error)),
        buildTool: this.config.buildTool,
        context: 'file-change',
      });

      return errorResult;
    }
  }

  /**
   * Trigger HMR update
   */
  async triggerHMR(update: HMRUpdate): Promise<void> {
    try {
      if (this.adapter) {
        await this.adapter.triggerHMR(update);
      }

      this.emit('hmr-update', {
        update,
        buildTool: this.config.buildTool,
      });

      logger.debug('HMR update triggered', {
        type: update.type,
        path: update.path,
        buildTool: this.config.buildTool,
      });
    } catch (error) {
      logger.error('Failed to trigger HMR update', {
        error: error instanceof Error ? error.message : String(error),
        buildTool: this.config.buildTool,
        update,
      });
      throw error;
    }
  }

  /**
   * Toggle fast mode
   */
  toggleFastMode(enabled?: boolean): void {
    if (this.fastModeOptimizer) {
      this.fastModeOptimizer.toggleFastMode(enabled);
      const isEnabled = this.fastModeOptimizer.getConfig().enabled;

      this.emit('fast-mode-toggled', {
        enabled: isEnabled,
        buildTool: this.config.buildTool,
      });

      logger.info('Fast mode toggled', {
        enabled: isEnabled,
        buildTool: this.config.buildTool,
      });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): Record<string, any> {
    return {
      buildTool: this.config.buildTool,
      isWatching: this.isWatching,
      fastMode: this.fastModeOptimizer?.getMetrics(),
      incremental: this.incrementalOptimizer?.getStats(),
      config: this.config,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.stopWatch();

      if (this.adapter) {
        await this.adapter.cleanup();
      }

      if (this.fastModeOptimizer) {
        await this.fastModeOptimizer.shutdown();
      }

      if (this.incrementalOptimizer) {
        await this.incrementalOptimizer.shutdown();
      }

      logger.info('BuildToolWatchIntegration cleanup complete');
    } catch (error) {
      logger.error('Error during cleanup', {
        error: error instanceof Error ? error.message : String(error),
        buildTool: this.config.buildTool,
      });
    }
  }

  /**
   * Setup default build tool adapters
   */
  private setupDefaultAdapters(): void {
    // Register adapters for different build tools
    this.adapters.set('webpack', new WebpackWatchAdapter());
    this.adapters.set('rollup', new RollupWatchAdapter());
    this.adapters.set('vite', new ViteWatchAdapter());
    this.adapters.set('esbuild', new ESBuildWatchAdapter());
    this.adapters.set('parcel', new ParcelWatchAdapter());
    this.adapters.set('gulp', new GulpWatchAdapter());
    this.adapters.set('npm', new NPMWatchAdapter());
  }

  /**
   * Get adapter for build tool
   */
  private getAdapter(buildTool: string): BuildToolAdapter | undefined {
    return this.adapters.get(buildTool);
  }

  /**
   * Setup event forwarding between components
   */
  private setupEventForwarding(): void {
    // Forward events from watch controller
    if (this.watchController) {
      this.watchController.on('file-changed', (event) => {
        this.handleFileChange(event.path, event.type);
      });
    }

    // Forward events from fast mode optimizer
    if (this.fastModeOptimizer) {
      this.fastModeOptimizer.on('fast_mode_toggled', (data) => {
        this.emit('fast-mode-toggled', {
          enabled: data.enabled,
          buildTool: this.config.buildTool,
        });
      });
    }

    // Forward events from incremental optimizer
    if (this.incrementalOptimizer) {
      this.incrementalOptimizer.on('corruption_detected', (data) => {
        this.emit('error', {
          error: new Error(`Corruption detected: ${data.message}`),
          buildTool: this.config.buildTool,
          context: 'corruption',
        });
      });
    }
  }

  /**
   * Convert optimization result to watch integration result
   */
  private convertToWatchResult(
    result: OptimizationResult,
    startTime: number
  ): WatchIntegrationResult {
    return {
      success: result.success,
      duration: result.duration,
      filesProcessed: result.filesProcessed,
      bytesOptimized: result.bytesOptimized,
      buildTool: this.config.buildTool,
      watchMode: {
        enabled: this.config.enabled,
        fastMode: this.config.fastMode.enabled,
        incremental: this.config.incremental.enabled,
        cacheHit: (result as any).fastMode?.cacheHit || false,
      },
      errors: result.errors,
      warnings: result.warnings,
      metadata: {
        ...result.metadata,
        buildTool: this.config.buildTool,
      },
    };
  }

  /**
   * Create basic result for fallback
   */
  private createBasicResult(filePath: string, startTime: number): WatchIntegrationResult {
    return {
      success: true,
      duration: Date.now() - startTime,
      filesProcessed: 1,
      bytesOptimized: 0,
      buildTool: this.config.buildTool,
      watchMode: {
        enabled: this.config.enabled,
        fastMode: false,
        incremental: false,
        cacheHit: false,
      },
      errors: [],
      warnings: [],
      metadata: { filePath, basic: true },
    };
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<BuildToolWatchConfig>): BuildToolWatchConfig {
    return {
      enabled: true,
      buildTool: 'webpack',
      projectRoot: process.cwd(),
      watch: {
        include: ['**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        recursive: true,
        debounceMs: 150,
      },
      fastMode: {
        enabled: true,
        mode: 'balanced',
        showIndicators: true,
      },
      incremental: {
        enabled: true,
        cacheDir: '.tw-enigma/cache',
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
      ...config,
    };
  }
}

/**
 * Build tool adapter implementations
 */

/**
 * Webpack adapter
 */
class WebpackWatchAdapter implements BuildToolAdapter {
  name = 'webpack';
  private config?: BuildToolWatchConfig;
  private context?: BuildToolContext;

  supports(buildTool: string): boolean {
    return buildTool === 'webpack';
  }

  async initialize(config: BuildToolWatchConfig): Promise<void> {
    this.config = config;
    this.context = {
      buildTool: 'webpack',
      projectRoot: config.projectRoot,
      isDevelopment: true,
      isProduction: false,
      outputDir: 'dist',
      mode: 'development',
      config: {},
    };
    logger.debug('Webpack adapter initialized');
  }

  async startWatch(): Promise<void> {
    logger.debug('Webpack watch started');
  }

  async stopWatch(): Promise<void> {
    logger.debug('Webpack watch stopped');
  }

  async handleFileChange(event: WatchEvent): Promise<WatchIntegrationResult> {
    // Implementation would integrate with webpack's watch system
    return {
      success: true,
      duration: 50,
      filesProcessed: 1,
      bytesOptimized: 1024,
      buildTool: 'webpack',
      watchMode: {
        enabled: true,
        fastMode: true,
        incremental: true,
        cacheHit: false,
      },
      errors: [],
      warnings: [],
      metadata: { event },
    };
  }

  async triggerHMR(update: HMRUpdate): Promise<void> {
    logger.debug('Webpack HMR triggered', { update });
  }

  getContext(): BuildToolContext {
    return this.context!;
  }

  async cleanup(): Promise<void> {
    logger.debug('Webpack adapter cleanup');
  }
}

/**
 * Similar adapter implementations for other build tools
 */
class RollupWatchAdapter implements BuildToolAdapter {
  name = 'rollup';
  private config?: BuildToolWatchConfig;
  private context?: BuildToolContext;

  supports(buildTool: string): boolean {
    return buildTool === 'rollup';
  }

  async initialize(config: BuildToolWatchConfig): Promise<void> {
    this.config = config;
    this.context = {
      buildTool: 'rollup',
      projectRoot: config.projectRoot,
      isDevelopment: true,
      isProduction: false,
      outputDir: 'dist',
      mode: 'development',
      config: {},
    };
  }

  async startWatch(): Promise<void> {
    logger.debug('Rollup watch started');
  }

  async stopWatch(): Promise<void> {
    logger.debug('Rollup watch stopped');
  }

  async handleFileChange(event: WatchEvent): Promise<WatchIntegrationResult> {
    return {
      success: true,
      duration: 30,
      filesProcessed: 1,
      bytesOptimized: 512,
      buildTool: 'rollup',
      watchMode: {
        enabled: true,
        fastMode: true,
        incremental: true,
        cacheHit: false,
      },
      errors: [],
      warnings: [],
      metadata: { event },
    };
  }

  async triggerHMR(update: HMRUpdate): Promise<void> {
    logger.debug('Rollup HMR triggered', { update });
  }

  getContext(): BuildToolContext {
    return this.context!;
  }

  async cleanup(): Promise<void> {
    logger.debug('Rollup adapter cleanup');
  }
}

// Placeholder implementations for other adapters
class ViteWatchAdapter implements BuildToolAdapter {
  name = 'vite';
  supports = (buildTool: string) => buildTool === 'vite';
  async initialize(_config: BuildToolWatchConfig) {
    /* Vite-specific logic */
  }
  async startWatch() {
    /* Vite watch start */
  }
  async stopWatch() {
    /* Vite watch stop */
  }
  async handleFileChange(event: WatchEvent): Promise<WatchIntegrationResult> {
    return {
      success: true,
      duration: 20,
      filesProcessed: 1,
      bytesOptimized: 256,
      buildTool: 'vite',
      watchMode: { enabled: true, fastMode: true, incremental: true, cacheHit: false },
      errors: [],
      warnings: [],
      metadata: { event },
    };
  }
  async triggerHMR(_update: HMRUpdate) {
    /* Vite HMR */
  }
  getContext(): BuildToolContext {
    return {
      buildTool: 'vite',
      projectRoot: '',
      isDevelopment: true,
      isProduction: false,
      outputDir: 'dist',
      mode: 'development',
      config: {},
    };
  }
  async cleanup() {
    /* Vite cleanup */
  }
}

class ESBuildWatchAdapter implements BuildToolAdapter {
  name = 'esbuild';
  supports = (buildTool: string) => buildTool === 'esbuild';
  async initialize(_config: BuildToolWatchConfig) {
    /* ESBuild-specific logic */
  }
  async startWatch() {
    /* ESBuild watch start */
  }
  async stopWatch() {
    /* ESBuild watch stop */
  }
  async handleFileChange(event: WatchEvent): Promise<WatchIntegrationResult> {
    return {
      success: true,
      duration: 10,
      filesProcessed: 1,
      bytesOptimized: 128,
      buildTool: 'esbuild',
      watchMode: { enabled: true, fastMode: true, incremental: true, cacheHit: false },
      errors: [],
      warnings: [],
      metadata: { event },
    };
  }
  async triggerHMR(_update: HMRUpdate) {
    /* ESBuild HMR */
  }
  getContext(): BuildToolContext {
    return {
      buildTool: 'esbuild',
      projectRoot: '',
      isDevelopment: true,
      isProduction: false,
      outputDir: 'dist',
      mode: 'development',
      config: {},
    };
  }
  async cleanup() {
    /* ESBuild cleanup */
  }
}

class ParcelWatchAdapter implements BuildToolAdapter {
  name = 'parcel';
  supports = (buildTool: string) => buildTool === 'parcel';
  async initialize(_config: BuildToolWatchConfig) {
    /* Parcel-specific logic */
  }
  async startWatch() {
    /* Parcel watch start */
  }
  async stopWatch() {
    /* Parcel watch stop */
  }
  async handleFileChange(event: WatchEvent): Promise<WatchIntegrationResult> {
    return {
      success: true,
      duration: 40,
      filesProcessed: 1,
      bytesOptimized: 800,
      buildTool: 'parcel',
      watchMode: { enabled: true, fastMode: true, incremental: true, cacheHit: false },
      errors: [],
      warnings: [],
      metadata: { event },
    };
  }
  async triggerHMR(_update: HMRUpdate) {
    /* Parcel HMR */
  }
  getContext(): BuildToolContext {
    return {
      buildTool: 'parcel',
      projectRoot: '',
      isDevelopment: true,
      isProduction: false,
      outputDir: 'dist',
      mode: 'development',
      config: {},
    };
  }
  async cleanup() {
    /* Parcel cleanup */
  }
}

class GulpWatchAdapter implements BuildToolAdapter {
  name = 'gulp';
  supports = (buildTool: string) => buildTool === 'gulp';
  async initialize(_config: BuildToolWatchConfig) {
    /* Gulp-specific logic */
  }
  async startWatch() {
    /* Gulp watch start */
  }
  async stopWatch() {
    /* Gulp watch stop */
  }
  async handleFileChange(event: WatchEvent): Promise<WatchIntegrationResult> {
    return {
      success: true,
      duration: 60,
      filesProcessed: 1,
      bytesOptimized: 400,
      buildTool: 'gulp',
      watchMode: { enabled: true, fastMode: true, incremental: true, cacheHit: false },
      errors: [],
      warnings: [],
      metadata: { event },
    };
  }
  async triggerHMR(_update: HMRUpdate) {
    /* Gulp HMR */
  }
  getContext(): BuildToolContext {
    return {
      buildTool: 'gulp',
      projectRoot: '',
      isDevelopment: true,
      isProduction: false,
      outputDir: 'dist',
      mode: 'development',
      config: {},
    };
  }
  async cleanup() {
    /* Gulp cleanup */
  }
}

class NPMWatchAdapter implements BuildToolAdapter {
  name = 'npm';
  supports = (buildTool: string) => buildTool === 'npm';
  async initialize(_config: BuildToolWatchConfig) {
    /* NPM scripts logic */
  }
  async startWatch() {
    /* NPM watch start */
  }
  async stopWatch() {
    /* NPM watch stop */
  }
  async handleFileChange(event: WatchEvent): Promise<WatchIntegrationResult> {
    return {
      success: true,
      duration: 80,
      filesProcessed: 1,
      bytesOptimized: 600,
      buildTool: 'npm',
      watchMode: { enabled: true, fastMode: true, incremental: true, cacheHit: false },
      errors: [],
      warnings: [],
      metadata: { event },
    };
  }
  async triggerHMR(_update: HMRUpdate) {
    /* NPM HMR */
  }
  getContext(): BuildToolContext {
    return {
      buildTool: 'npm',
      projectRoot: '',
      isDevelopment: true,
      isProduction: false,
      outputDir: 'dist',
      mode: 'development',
      config: {},
    };
  }
  async cleanup() {
    /* NPM cleanup */
  }
}

/**
 * Factory function to create build tool watch integration
 */
export function createBuildToolWatchIntegration(
  config: Partial<BuildToolWatchConfig>
): BuildToolWatchIntegration {
  return new BuildToolWatchIntegration(config);
}

/**
 * Configuration presets for common build tools
 */
export const BUILD_TOOL_PRESETS = {
  webpack: {
    buildTool: 'webpack' as const,
    watch: {
      include: ['**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      recursive: true,
      debounceMs: 300,
    },
    fastMode: {
      enabled: true,
      mode: 'balanced' as const,
      showIndicators: true,
    },
  },
  vite: {
    buildTool: 'vite' as const,
    watch: {
      include: ['**/*.css', '**/*.scss', '**/*.vue'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      recursive: true,
      debounceMs: 100,
    },
    fastMode: {
      enabled: true,
      mode: 'ultra' as const,
      showIndicators: true,
    },
  },
  rollup: {
    buildTool: 'rollup' as const,
    watch: {
      include: ['**/*.css', '**/*.scss'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      recursive: true,
      debounceMs: 200,
    },
    fastMode: {
      enabled: true,
      mode: 'balanced' as const,
      showIndicators: false,
    },
  },
} as const;
