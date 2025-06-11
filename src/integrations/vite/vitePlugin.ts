/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Vite Plugin for Tailwind Enigma
 * Integrates CSS optimization into the Vite build process with HMR support
 */

import type { Plugin, ViteDevServer, ResolvedConfig } from 'vite';
import type { Plugin as PostCSSPlugin } from 'postcss';
import { z } from 'zod';
import { createLogger } from '../../logger.js';
import { createHMRHandler } from '../core/hmrHandler.js';
import type { PluginContext } from '../../types/plugins.js';
import type { 
  BuildToolPlugin, 
  BuildToolPluginConfig,
  BuildToolContext,
  BuildToolResult,
  BuildToolHooks,
  HMRUpdate,
  OptimizationResult
} from '../core/buildToolPlugin.js';

const logger = createLogger('vite-plugin');

/**
 * Vite-specific configuration
 */
export interface VitePluginConfig extends BuildToolPluginConfig {
  buildTool: BuildToolPluginConfig['buildTool'] & {
    type: 'vite';
    vite?: {
      /** Enable Vite dev server integration */
      devServer?: boolean;
      /** CSS preprocessing options */
      css?: {
        /** Enable CSS modules */
        modules?: boolean;
        /** PostCSS plugins */
        postcss?: Record<string, any>;
        /** CSS preprocessor options */
        preprocessorOptions?: Record<string, any>;
      };
      /** Build options */
      build?: {
        /** Output directory */
        outDir?: string;
        /** CSS code splitting */
        cssCodeSplit?: boolean;
        /** Rollup options */
        rollupOptions?: Record<string, any>;
      };
    };
  };
}

/**
 * Vite plugin configuration schema
 */
export const vitePluginConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  priority: z.number().default(10),
  buildTool: z.object({
    type: z.literal('vite'),
    autoDetect: z.boolean().default(true),
    configPath: z.string().optional(),
    development: z.object({
      hmr: z.boolean().default(true),
      hmrDelay: z.number().default(50), // Vite is faster
      liveReload: z.boolean().default(true)
    }).optional(),
    production: z.object({
      sourceMaps: z.boolean().default(true),
      minify: z.boolean().default(true),
      extractCSS: z.boolean().default(true)
    }).optional(),
    hooks: z.object({
      enabledPhases: z.array(z.enum([
        'beforeBuild', 'buildStart', 'compilation', 'transform', 
        'generateBundle', 'emit', 'afterBuild', 'development', 'production'
      ])).optional(),
      priority: z.number().default(10)
    }).optional(),
    vite: z.object({
      devServer: z.boolean().default(true),
      css: z.object({
        modules: z.boolean().default(false),
        postcss: z.record(z.any()).optional(),
        preprocessorOptions: z.record(z.any()).optional()
      }).optional(),
      build: z.object({
        outDir: z.string().default('dist'),
        cssCodeSplit: z.boolean().default(true),
        rollupOptions: z.record(z.any()).optional()
      }).optional()
    }).optional()
  })
}).strict();

/**
 * HMR server implementation for Vite
 */
class ViteHMRServer {
  private devServer?: ViteDevServer;
  private _isRunning = false;

  constructor(devServer?: ViteDevServer) {
    this.devServer = devServer;
  }

  async start(port?: number): Promise<void> {
    this._isRunning = true;
    logger.debug('Vite HMR server started', { port });
  }

  async stop(): Promise<void> {
    this._isRunning = false;
    logger.debug('Vite HMR server stopped');
  }

  broadcast(payload: any): void {
    if (this.devServer?.ws) {
      this.devServer.ws.send({
        type: 'custom',
        event: 'enigma:css-update',
        data: payload
      });
      
      logger.debug('HMR update sent via Vite WebSocket', { 
        type: payload.type,
        filePath: payload.filePath 
      });
    }
  }

  getClients(): any[] {
    // Vite manages clients internally
    return [];
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  setDevServer(devServer: ViteDevServer): void {
    this.devServer = devServer;
  }
}

/**
 * Vite Plugin for Tailwind Enigma CSS Optimization
 */
export class EnigmaVitePlugin implements BuildToolPlugin {
  readonly pluginType = 'build-tool' as const;
  readonly supportedBuildTools = ['vite'] as const;
  readonly buildToolConfigSchema = vitePluginConfigSchema;
  readonly name: string;
  readonly meta = {
    name: 'EnigmaVitePlugin',
    version: '1.0.0',
    description: 'Vite plugin for Tailwind Enigma CSS optimization'
  };
  readonly configSchema = vitePluginConfigSchema;

  // Plugin methods for BuildToolPlugin interface
  async initialize(): Promise<void> {
    // Already handled in constructor
  }

  createPlugin(context: PluginContext): PostCSSPlugin {
    const plugin = {
      postcssPlugin: this.name,
      Once: async (root: any, { result }: { result: any }) => {
        // This is a build tool integration plugin, not a direct CSS processor
        // The actual CSS processing happens through vite lifecycle hooks
        // Just mark that this plugin was executed
        result.messages.push({
          type: 'dependency',
          plugin: this.name,
          file: this.name
        });
      }
    };
    (plugin as any).postcssPlugin = this.name;
    return plugin;
  }

  private config: VitePluginConfig;
  private hmrHandler = createHMRHandler();
  private hmrServer = new ViteHMRServer();
  private context?: BuildToolContext;
  private viteConfig?: ResolvedConfig;

  constructor(config: Partial<VitePluginConfig> = {}) {
    // Set default configuration
    const defaultConfig: VitePluginConfig = {
      name: 'enigma-vite-plugin',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'vite',
        autoDetect: true,
        development: {
          hmr: true,
          hmrDelay: 50,
          liveReload: true
        },
        production: {
          sourceMaps: true,
          minify: true,
          extractCSS: true
        },
        vite: {
          devServer: true,
          css: {
            modules: false
          },
          build: {
            outDir: 'dist',
            cssCodeSplit: true
          }
        }
      }
    };

    this.config = { ...defaultConfig, ...config } as VitePluginConfig;
    this.name = this.config.name;
    
    // Validate configuration
    const validation = vitePluginConfigSchema.safeParse(this.config);
    if (!validation.success) {
      logger.error('Invalid vite plugin configuration', { 
        errors: validation.error.errors 
      });
      throw new Error(`Invalid configuration: ${validation.error.message}`);
    }

    logger.debug('Enigma Vite plugin initialized', { 
      config: this.config.name,
      enabled: this.config.enabled 
    });
  }

  /**
   * Create Vite plugin object
   */
  createVitePlugin(): Plugin {
    return {
      name: this.config.name,
      
      configResolved: (config: ResolvedConfig) => {
        this.viteConfig = config;
        
        const isDevelopment = config.command === 'serve';
        const isProduction = config.command === 'build';

        // Initialize build context
        this.context = this.createViteContext(config, isDevelopment, isProduction);

        logger.info('Vite config resolved', {
          command: config.command,
          mode: config.mode,
          hmr: isDevelopment && this.config.buildTool.development?.hmr
        });
      },

      configureServer: (server: ViteDevServer) => {
        if (!this.config.buildTool.development?.hmr) {
          return;
        }

        // Setup HMR server
        this.hmrServer.setDevServer(server);
        this.hmrHandler.initialize('vite', this.hmrServer);

        logger.debug('Vite dev server configured with Enigma HMR');

        // Add HMR client code injection
        server.middlewares.use('/enigma-hmr-client.js', (req, res) => {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(this.getHMRClientCode());
        });
      },

      buildStart: async () => {
        if (this.context) {
          this.context.phase = 'buildStart';
          await this.hooks.buildStart?.(this.context);
        }
      },

      transform: async (code: string, id: string) => {
        if (!this.shouldTransform(id)) {
          return null;
        }

        if (this.context) {
          this.context.phase = 'transform';
          const transformedCode = await this.hooks.transform?.(this.context, code, id);
          return transformedCode || null;
        }

        return null;
      },

      generateBundle: async () => {
        if (this.context) {
          this.context.phase = 'generateBundle';
          await this.hooks.generateBundle?.(this.context);
        }
      },

      writeBundle: async (options, bundle) => {
        if (!this.context) return;

        this.context.phase = 'afterBuild';
        this.context.metrics.endTime = Date.now();

        // Process CSS assets in the bundle
        await this.processBundleAssets(bundle);
        
        await this.hooks.afterBuild?.(this.context);

        logger.info('Vite bundle written', {
          assetsCount: Object.keys(bundle).length,
          duration: this.context.metrics.endTime - this.context.metrics.startTime
        });
      },

      handleHotUpdate: async (ctx) => {
        if (!this.config.buildTool.development?.hmr || !this.context) {
          return;
        }

        const { file, modules } = ctx;
        
        // Handle CSS file updates
        if (this.isCSSFile(file)) {
          try {
            const cssContent = await ctx.read();
            const optimized = await this.optimizeCSS(cssContent, file);
            
            if (optimized) {
              await this.hmrHandler.handleCSSUpdate(
                file,
                optimized.css,
                this.context,
                optimized
              );

              logger.debug('CSS HMR update processed', {
                file,
                originalSize: optimized.originalSize,
                optimizedSize: optimized.optimizedSize
              });
            }
          } catch (error) {
            logger.error('Error processing CSS HMR update', { file, error });
          }
        }

        // Let Vite handle the default HMR behavior
        return undefined;
      }
    };
  }

  /**
   * Create Vite-specific build context
   */
  private createViteContext(
    config: ResolvedConfig,
    isDevelopment: boolean,
    isProduction: boolean
  ): BuildToolContext {
    return {
      buildTool: 'vite',
      phase: 'beforeBuild',
      isDevelopment,
      isProduction,
      projectRoot: config.root,
      buildConfig: config,
      outputDir: config.build.outDir,
      sourceFiles: [],
      assets: new Map(),
      metrics: {
        startTime: Date.now(),
        phaseTimings: {},
        memoryPeaks: {},
        assetSizes: {},
        fileCounts: {
          total: 0,
          processed: 0,
          skipped: 0
        }
      }
    };
  }

  /**
   * Check if file should be transformed
   */
  private shouldTransform(id: string): boolean {
    return this.isCSSFile(id);
  }

  /**
   * Check if file is a CSS file
   */
  private isCSSFile(file: string): boolean {
    return /\.(css|scss|sass|less|styl)($|\?)/.test(file);
  }

  /**
   * Process bundle assets for optimization
   */
  private async processBundleAssets(bundle: any): Promise<void> {
    if (!this.context) return;

    for (const [fileName, asset] of Object.entries(bundle)) {
      if (this.isCSSFile(fileName) && asset && typeof asset === 'object' && 'source' in asset) {
        try {
          const cssContent = asset.source as string;
          const optimized = await this.optimizeCSS(cssContent, fileName);
          
          if (optimized) {
            // Replace asset source with optimized CSS
            (asset as any).source = optimized.css;
            this.context.assets.set(fileName, optimized.css);
            this.context.optimizationResults = optimized;

            logger.debug('Bundle CSS asset optimized', {
              asset: fileName,
              originalSize: optimized.originalSize,
              optimizedSize: optimized.optimizedSize,
              reduction: optimized.reductionPercentage
            });
          }
        } catch (error) {
          logger.error(`Failed to optimize CSS bundle asset: ${fileName}`, { error });
        }
      }
    }
  }

  /**
   * Optimize CSS content (placeholder implementation)
   */
  private async optimizeCSS(css: string, fileName: string): Promise<OptimizationResult> {
    const startTime = performance.now();
    
    // This is a placeholder - in the real implementation, this would call
    // the actual Tailwind Enigma CSS optimization engine
    const optimizedCSS = css; // No actual optimization for now
    
    const endTime = performance.now();
    const originalSize = Buffer.byteLength(css, 'utf-8');
    const optimizedSize = Buffer.byteLength(optimizedCSS, 'utf-8');

    return {
      originalSize,
      optimizedSize,
      reductionPercentage: ((originalSize - optimizedSize) / originalSize) * 100,
      classesProcessed: 0, // Would be calculated by the optimization engine
      classesRemoved: 0,   // Would be calculated by the optimization engine
      processingTime: endTime - startTime,
      css: optimizedCSS
    };
  }

  /**
   * Get HMR client code
   */
  private getHMRClientCode(): string {
    return `
// Enigma HMR Client for Vite
if (import.meta.hot) {
  import.meta.hot.on('enigma:css-update', (data) => {
    console.log('[Enigma] CSS updated:', data.filePath);
    
    // Update CSS in the browser
    if (data.css) {
      const styleElements = document.querySelectorAll('style[data-vite-dev-id]');
      styleElements.forEach(el => {
        if (el.getAttribute('data-vite-dev-id')?.includes(data.filePath)) {
          el.textContent = data.css;
        }
      });
    }
    
    // Log optimization results
    if (data.optimization) {
      console.log('[Enigma] Optimization:', {
        originalSize: data.optimization.originalSize,
        optimizedSize: data.optimization.optimizedSize,
        reduction: data.optimization.reductionPercentage.toFixed(2) + '%'
      });
    }
  });
}
`;
  }

  /**
   * Build tool lifecycle hooks implementation
   */
  readonly hooks: BuildToolHooks = {
    buildStart: async (context: BuildToolContext) => {
      logger.debug('Vite buildStart hook', { phase: context.phase });
      context.metrics.phaseTimings.buildStart = performance.now();
    },

    transform: async (context: BuildToolContext, code: string, filePath: string) => {
      if (!this.isCSSFile(filePath)) {
        return code;
      }

      logger.debug('Vite transform hook for CSS', { filePath });
      context.metrics.phaseTimings.transform = performance.now();
      
      // Optimize CSS during transform
      const optimized = await this.optimizeCSS(code, filePath);
      return optimized.css;
    },

    generateBundle: async (context: BuildToolContext) => {
      logger.debug('Vite generateBundle hook', { phase: context.phase });
      context.metrics.phaseTimings.generateBundle = performance.now();
    },

    afterBuild: (context: BuildToolContext) => {
      logger.debug('Vite afterBuild hook', { phase: context.phase });
      context.metrics.phaseTimings.afterBuild = performance.now();
      
      // Log build metrics
      const duration = (context.metrics.endTime || Date.now()) - context.metrics.startTime;
      logger.info('Vite build metrics', {
        duration,
        phases: context.metrics.phaseTimings,
        assets: context.assets.size
      });
    },

    development: async (context: BuildToolContext) => {
      logger.debug('Vite development hook', { phase: context.phase });
      context.metrics.phaseTimings.development = performance.now();
    },

    onHMRUpdate: async (update: HMRUpdate, context: BuildToolContext) => {
      logger.debug('Vite HMR update', { 
        type: update.type, 
        filePath: update.filePath 
      });
    }
  };

  /**
   * Initialize build tool plugin
   */
  async initializeBuildTool(context: BuildToolContext, config: BuildToolPluginConfig): Promise<void> {
    this.context = context;
    this.config = config as VitePluginConfig;
    
    logger.info('Vite plugin initialized', {
      projectRoot: context.projectRoot,
      isDevelopment: context.isDevelopment,
      hmr: this.config.buildTool.development?.hmr
    });
  }

  /**
   * Process build
   */
  async processBuild(context: BuildToolContext): Promise<BuildToolResult> {
    const startTime = performance.now();
    
    try {
      // Process would happen through Vite plugin hooks
      // This is called if the plugin is used standalone
      
      const result: BuildToolResult = {
        success: true,
        assets: Object.fromEntries(context.assets),
        optimization: context.optimizationResults,
        metrics: {
          ...context.metrics,
          endTime: Date.now()
        },
        warnings: []
      };

      const endTime = performance.now();
      logger.info('Vite build processed', {
        duration: endTime - startTime,
        assetsCount: context.assets.size
      });

      return result;
    } catch (error) {
      logger.error('Vite build processing failed', { error });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        assets: {},
        metrics: context.metrics,
        warnings: []
      };
    }
  }

  /**
   * Handle HMR updates
   */
  async handleHMR(update: HMRUpdate, context: BuildToolContext): Promise<void> {
    await this.hooks.onHMRUpdate?.(update, context);
  }

  /**
   * Get Vite-specific configuration
   */
  getBuildToolConfig(): any {
    return {
      css: this.config.buildTool.vite?.css || {},
      build: this.config.buildTool.vite?.build || {},
      plugins: [this.createVitePlugin()]
    };
  }
}

/**
 * Create Enigma Vite plugin factory function
 */
export function enigmaVite(config?: Partial<VitePluginConfig>): Plugin {
  const plugin = new EnigmaVitePlugin(config);
  return plugin.createVitePlugin();
}

/**
 * Create Enigma Vite plugin instance
 */
export function createVitePlugin(config?: Partial<VitePluginConfig>): EnigmaVitePlugin {
  return new EnigmaVitePlugin(config);
}

/**
 * Default Vite plugin configuration
 */
export const defaultViteConfig: VitePluginConfig = {
  name: 'enigma-vite-plugin',
  enabled: true,
  priority: 10,
  buildTool: {
    type: 'vite',
    autoDetect: true,
    development: {
      hmr: true,
      hmrDelay: 50,
      liveReload: true
    },
    production: {
      sourceMaps: true,
      minify: true,
      extractCSS: true
    },
    vite: {
      devServer: true,
      css: {
        modules: false
      },
      build: {
        outDir: 'dist',
        cssCodeSplit: true
      }
    }
  }
}; 