/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Webpack Plugin for Tailwind Enigma
 * Integrates CSS optimization into the Webpack build process
 */

import type { Compiler, Configuration, WebpackPluginInstance } from "webpack";
import type { Plugin } from "postcss";
import { z } from "zod";
import { createLogger } from "../../logger";
import { createHMRHandler } from "../core/hmrHandler";
import type { PluginContext } from "../../types/plugins";
import type {
  BuildToolPlugin,
  BuildToolPluginConfig,
  BuildToolContext,
  BuildToolResult,
  BuildToolHooks,
  HMRUpdate,
  OptimizationResult,
} from "../core/buildToolPlugin.ts";

const logger = createLogger("webpack-plugin");

/**
 * Webpack-specific configuration
 */
export interface WebpackPluginConfig extends BuildToolPluginConfig {
  buildTool: BuildToolPluginConfig["buildTool"] & {
    type: "webpack";
    webpack?: {
      /** Enable webpack dev server integration */
      devServer?: boolean;
      /** Extract CSS to separate files */
      extractCSS?: boolean;
      /** Generate source maps */
      sourceMaps?: boolean;
      /** CSS loader configuration */
      cssLoader?: {
        modules?: boolean;
        importLoaders?: number;
      };
      /** MiniCssExtractPlugin options */
      extractOptions?: Record<string, any>;
    };
  };
}

/**
 * Webpack plugin configuration schema
 */
export const webpackPluginConfigSchema = z
  .object({
    name: z.string(),
    enabled: z.boolean().default(true),
    priority: z.number().default(10),
    buildTool: z.object({
      type: z.literal("webpack"),
      autoDetect: z.boolean().default(true),
      configPath: z.string().optional(),
      development: z
        .object({
          hmr: z.boolean().default(true),
          hmrDelay: z.number().default(100),
          liveReload: z.boolean().default(true),
        })
        .optional(),
      production: z
        .object({
          sourceMaps: z.boolean().default(true),
          minify: z.boolean().default(true),
          extractCSS: z.boolean().default(true),
        })
        .optional(),
      hooks: z
        .object({
          enabledPhases: z
            .array(
              z.enum([
                "beforeBuild",
                "buildStart",
                "compilation",
                "transform",
                "generateBundle",
                "emit",
                "afterBuild",
                "development",
                "production",
              ]),
            )
            .optional(),
          priority: z.number().default(10),
        })
        .optional(),
      webpack: z
        .object({
          devServer: z.boolean().default(true),
          extractCSS: z.boolean().default(true),
          sourceMaps: z.boolean().default(true),
          cssLoader: z
            .object({
              modules: z.boolean().default(false),
              importLoaders: z.number().default(1),
            })
            .optional(),
          extractOptions: z.record(z.any()).optional(),
        })
        .optional(),
    }),
  })
  .strict();

/**
 * HMR server implementation for Webpack
 */
class WebpackHMRServer {
  private clients: Set<any> = new Set();
  private _isRunning = false;

  async start(port?: number): Promise<void> {
    this._isRunning = true;
    logger.debug("Webpack HMR server started", { port });
  }

  async stop(): Promise<void> {
    this._isRunning = false;
    this.clients.clear();
    logger.debug("Webpack HMR server stopped");
  }

  broadcast(payload: any): void {
    for (const client of Array.from(this.clients)) {
      if (client && typeof client.send === "function") {
        client.send(JSON.stringify(payload));
      }
    }
    logger.debug("HMR update broadcasted to webpack clients", {
      clientCount: this.clients.size,
      type: payload.type,
    });
  }

  getClients(): any[] {
    return Array.from(this.clients);
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  addClient(client: any): void {
    this.clients.add(client);
  }

  removeClient(client: any): void {
    this.clients.delete(client);
  }
}

/**
 * Webpack Plugin for Tailwind Enigma CSS Optimization
 */
export class EnigmaWebpackPlugin
  implements WebpackPluginInstance, BuildToolPlugin
{
  readonly pluginType = "build-tool" as const;
  readonly supportedBuildTools = ["webpack"] as const;
  readonly buildToolConfigSchema = webpackPluginConfigSchema;
  readonly name: string;
  readonly meta = {
    name: "EnigmaWebpackPlugin",
    version: "1.0.0",
    description: "Webpack plugin for Tailwind Enigma CSS optimization",
  };
  readonly configSchema = webpackPluginConfigSchema;

  // Plugin methods for BuildToolPlugin interface
  async initialize(): Promise<void> {
    // Already handled in constructor
  }

  createPlugin(context: PluginContext): Plugin {
    const plugin = {
      postcssPlugin: this.name,
      Once: async (root: any, { result }: { result: any }) => {
        // This is a build tool integration plugin, not a direct CSS processor
        // The actual CSS processing happens through webpack lifecycle hooks
        // Just mark that this plugin was executed
        result.messages.push({
          type: "dependency",
          plugin: this.name,
          file: this.name,
        });
      },
    };
    (plugin as any).postcssPlugin = this.name;
    return plugin;
  }

  private config: WebpackPluginConfig;
  private hmrHandler = createHMRHandler();
  private hmrServer = new WebpackHMRServer();
  private context?: BuildToolContext;

  constructor(config: Partial<WebpackPluginConfig> = {}) {
    // Set default configuration
    const defaultConfig: WebpackPluginConfig = {
      name: "enigma-webpack-plugin",
      enabled: true,
      priority: 10,
      buildTool: {
        type: "webpack",
        autoDetect: true,
        development: {
          hmr: true,
          hmrDelay: 100,
          liveReload: true,
        },
        production: {
          sourceMaps: true,
          minify: true,
          extractCSS: true,
        },
        webpack: {
          devServer: true,
          extractCSS: true,
          sourceMaps: true,
          cssLoader: {
            modules: false,
            importLoaders: 1,
          },
        },
      },
    };

    this.config = { ...defaultConfig, ...config } as WebpackPluginConfig;
    this.name = this.config.name;

    // Validate configuration
    const validation = webpackPluginConfigSchema.safeParse(this.config);
    if (!validation.success) {
      logger.error("Invalid webpack plugin configuration", {
        errors: validation.error.errors,
      });
      throw new Error(`Invalid configuration: ${validation.error.message}`);
    }

    logger.debug("Enigma Webpack plugin initialized", {
      config: this.config.name,
      enabled: this.config.enabled,
    });
  }

  /**
   * Webpack plugin apply method
   */
  apply(compiler: Compiler): void {
    if (!this.config.enabled) {
      logger.debug("Plugin disabled, skipping webpack integration");
      return;
    }

    const isDevelopment = compiler.options.mode === "development";
    const isProduction = compiler.options.mode === "production";

    logger.info("Applying Enigma Webpack plugin", {
      mode: compiler.options.mode,
      hmr: isDevelopment && this.config.buildTool.development?.hmr,
    });

    // Initialize build context
    this.context = this.createWebpackContext(
      compiler,
      isDevelopment,
      isProduction,
    );

    // Register lifecycle hooks
    this.registerHooks(compiler);

    // Setup HMR if in development mode
    if (isDevelopment && this.config.buildTool.development?.hmr) {
      this.setupHMR(compiler);
    }
  }

  /**
   * Create webpack-specific build context
   */
  private createWebpackContext(
    compiler: Compiler,
    isDevelopment: boolean,
    isProduction: boolean,
  ): BuildToolContext {
    return {
      buildTool: "webpack",
      phase: "beforeBuild",
      isDevelopment,
      isProduction,
      projectRoot: compiler.context || process.cwd(),
      buildConfig: compiler.options,
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
          skipped: 0,
        },
      },
    };
  }

  /**
   * Register webpack lifecycle hooks
   */
  private registerHooks(compiler: Compiler): void {
    // Before build starts
    compiler.hooks.beforeRun.tapAsync(
      "EnigmaWebpackPlugin",
      async (compiler, callback) => {
        try {
          if (this.context) {
            this.context.phase = "beforeBuild";
            await this.hooks.beforeBuild?.(this.context);
          }
          callback();
        } catch (error) {
          logger.error("Error in beforeRun hook", { error });
          callback(error as Error);
        }
      },
    );

    // Compilation hook
    compiler.hooks.compilation.tap("EnigmaWebpackPlugin", (compilation) => {
      try {
        if (this.context) {
          this.context.phase = "compilation";
          this.hooks.compilation?.(this.context);
        }

        // Process CSS assets during compilation
        compilation.hooks.processAssets.tapAsync(
          {
            name: "EnigmaWebpackPlugin",
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
          },
          async (assets, callback) => {
            try {
              await this.processAssets(compilation, assets);
              callback();
            } catch (error) {
              logger.error("Error processing assets", { error });
              callback(error as Error);
            }
          },
        );
      } catch (error) {
        logger.error("Error in compilation hook", { error });
      }
    });

    // Emit hook
    compiler.hooks.emit.tapAsync(
      "EnigmaWebpackPlugin",
      async (compilation, callback) => {
        try {
          if (this.context) {
            this.context.phase = "emit";
            await this.hooks.emit?.(this.context);
          }
          callback();
        } catch (error) {
          logger.error("Error in emit hook", { error });
          callback(error as Error);
        }
      },
    );

    // After build completes
    compiler.hooks.done.tap("EnigmaWebpackPlugin", (stats) => {
      try {
        if (this.context) {
          this.context.phase = "afterBuild";
          this.context.metrics.endTime = Date.now();
          this.hooks.afterBuild?.(this.context);
        }

        logger.info("Webpack build completed", {
          duration: stats.endTime - stats.startTime,
          errors: stats.hasErrors(),
          warnings: stats.hasWarnings(),
        });
      } catch (error) {
        logger.error("Error in done hook", { error });
      }
    });
  }

  /**
   * Setup HMR integration
   */
  private setupHMR(compiler: Compiler): void {
    if (!this.config.buildTool.development?.hmr) {
      return;
    }

    try {
      // Initialize HMR handler with webpack server
      this.hmrHandler.initialize("webpack", this.hmrServer);

      // Watch for CSS file changes
      compiler.hooks.watchRun.tapAsync(
        "EnigmaWebpackPlugin",
        async (compiler, callback) => {
          try {
            if (this.context) {
              this.context.phase = "development";
              await this.hooks.development?.(this.context);
            }
            callback();
          } catch (error) {
            logger.error("Error in watchRun hook", { error });
            callback(error as Error);
          }
        },
      );

      logger.debug("HMR setup completed for webpack");
    } catch (error) {
      logger.error("Failed to setup HMR", { error });
    }
  }

  /**
   * Process CSS assets during compilation
   */
  private async processAssets(compilation: any, assets: any): Promise<void> {
    const cssAssets = Object.keys(assets).filter(
      (name) => name.endsWith(".css") || name.includes(".css"),
    );

    for (const assetName of cssAssets) {
      try {
        const asset = assets[assetName];
        const originalCSS = asset.source();

        // Here we would integrate with the actual CSS optimization engine
        // For now, we'll simulate the optimization
        const optimizedResult = await this.optimizeCSS(originalCSS, assetName);

        if (optimizedResult) {
          // Replace asset with optimized version
          compilation.updateAsset(
            assetName,
            new compilation.constructor.webpack.sources.RawSource(
              optimizedResult.css,
            ),
          );

          // Update context with optimization results
          if (this.context) {
            this.context.optimizationResults = optimizedResult;
            this.context.assets.set(assetName, optimizedResult.css);
          }

          // Send HMR update if in development
          if (
            this.context?.isDevelopment &&
            this.config.buildTool.development?.hmr
          ) {
            await this.hmrHandler.handleCSSUpdate(
              assetName,
              optimizedResult.css,
              this.context,
              optimizedResult,
            );
          }

          logger.debug("CSS asset optimized", {
            asset: assetName,
            originalSize: optimizedResult.originalSize,
            optimizedSize: optimizedResult.optimizedSize,
            reduction: optimizedResult.reductionPercentage,
          });
        }
      } catch (error) {
        logger.error(`Failed to optimize CSS asset: ${assetName}`, { error });
      }
    }
  }

  /**
   * Optimize CSS content (placeholder implementation)
   */
  private async optimizeCSS(
    css: string,
    _fileName: string,
  ): Promise<OptimizationResult> {
    const startTime = performance.now();

    // This is a placeholder - in the real implementation, this would call
    // the actual Tailwind Enigma CSS optimization engine
    const optimizedCSS = css; // No actual optimization for now

    const endTime = performance.now();
    const originalSize = Buffer.byteLength(css, "utf-8");
    const optimizedSize = Buffer.byteLength(optimizedCSS, "utf-8");

    return {
      originalSize,
      optimizedSize,
      reductionPercentage:
        ((originalSize - optimizedSize) / originalSize) * 100,
      classesProcessed: 0, // Would be calculated by the optimization engine
      classesRemoved: 0, // Would be calculated by the optimization engine
      processingTime: endTime - startTime,
      css: optimizedCSS,
    };
  }

  /**
   * Build tool lifecycle hooks implementation
   */
  readonly hooks: BuildToolHooks = {
    beforeBuild: async (context: BuildToolContext) => {
      logger.debug("Webpack beforeBuild hook", { phase: context.phase });
      context.metrics.phaseTimings.beforeBuild = performance.now();
    },

    compilation: (context: BuildToolContext) => {
      logger.debug("Webpack compilation hook", { phase: context.phase });
      context.metrics.phaseTimings.compilation = performance.now();
    },

    emit: async (context: BuildToolContext) => {
      logger.debug("Webpack emit hook", { phase: context.phase });
      context.metrics.phaseTimings.emit = performance.now();
    },

    afterBuild: (context: BuildToolContext) => {
      logger.debug("Webpack afterBuild hook", { phase: context.phase });
      context.metrics.phaseTimings.afterBuild = performance.now();

      // Log build metrics
      const duration =
        (context.metrics.endTime || Date.now()) - context.metrics.startTime;
      logger.info("Webpack build metrics", {
        duration,
        phases: context.metrics.phaseTimings,
        assets: context.assets.size,
      });
    },

    development: async (context: BuildToolContext) => {
      logger.debug("Webpack development hook", { phase: context.phase });
      context.metrics.phaseTimings.development = performance.now();
    },

    onHMRUpdate: async (update: HMRUpdate, context: BuildToolContext) => {
      logger.debug("Webpack HMR update", {
        type: update.type,
        filePath: update.filePath,
      });
    },
  };

  /**
   * Initialize build tool plugin
   */
  async initializeBuildTool(
    context: BuildToolContext,
    config: BuildToolPluginConfig,
  ): Promise<void> {
    this.context = context;
    this.config = config as WebpackPluginConfig;

    logger.info("Webpack plugin initialized", {
      projectRoot: context.projectRoot,
      isDevelopment: context.isDevelopment,
      hmr: this.config.buildTool.development?.hmr,
    });
  }

  /**
   * Process build
   */
  async processBuild(context: BuildToolContext): Promise<BuildToolResult> {
    const startTime = performance.now();

    try {
      // Process would happen through webpack hooks
      // This is called if the plugin is used standalone

      const result: BuildToolResult = {
        success: true,
        assets: Object.fromEntries(context.assets),
        optimization: context.optimizationResults,
        metrics: {
          ...context.metrics,
          endTime: Date.now(),
        },
        warnings: [],
      };

      const endTime = performance.now();
      logger.info("Webpack build processed", {
        duration: endTime - startTime,
        assetsCount: context.assets.size,
      });

      return result;
    } catch (error) {
      logger.error("Webpack build processing failed", { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        assets: {},
        metrics: context.metrics,
        warnings: [],
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
   * Get webpack-specific configuration
   */
  getBuildToolConfig(): Configuration {
    const config: Configuration = {};

    // Add CSS optimization rules
    if (!config.module) config.module = {};
    if (!config.module.rules) config.module.rules = [];

    // Add CSS handling rules
    config.module.rules.push({
      test: /\.css$/,
      use: [
        this.config.buildTool.webpack?.extractCSS
          ? "mini-css-extract-plugin"
          : "style-loader",
        {
          loader: "css-loader",
          options: this.config.buildTool.webpack?.cssLoader || {},
        },
      ],
    });

    // Add plugins
    if (!config.plugins) config.plugins = [];

    // Add self to plugins if not already added
    const hasEnigmaPlugin = config.plugins.some(
      (plugin) => plugin instanceof EnigmaWebpackPlugin,
    );

    if (!hasEnigmaPlugin) {
      config.plugins.push(this);
    }

    return config;
  }
}

/**
 * Create Enigma Webpack plugin instance
 */
export function createWebpackPlugin(
  config?: Partial<WebpackPluginConfig>,
): EnigmaWebpackPlugin {
  return new EnigmaWebpackPlugin(config);
}

/**
 * Default webpack plugin configuration
 */
export const defaultWebpackConfig: WebpackPluginConfig = {
  name: "enigma-webpack-plugin",
  enabled: true,
  priority: 10,
  buildTool: {
    type: "webpack",
    autoDetect: true,
    development: {
      hmr: true,
      hmrDelay: 100,
      liveReload: true,
    },
    production: {
      sourceMaps: true,
      minify: true,
      extractCSS: true,
    },
    webpack: {
      devServer: true,
      extractCSS: true,
      sourceMaps: true,
      cssLoader: {
        modules: false,
        importLoaders: 1,
      },
    },
  },
};
