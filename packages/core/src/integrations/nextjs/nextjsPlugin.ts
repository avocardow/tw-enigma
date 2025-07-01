/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Next.js Plugin for Tailwind Enigma
 * Integrates CSS optimization into the Next.js build process
 */

import type { Plugin as PostCSSPlugin } from 'postcss';
import { z } from 'zod';

import type { PluginContext } from '../../types/plugins';
import { createLogger } from '../../utils/logger';
import type {
  BuildToolContext,
  BuildToolHooks,
  BuildToolPlugin,
  BuildToolPluginConfig,
  BuildToolResult,
} from '../core/buildToolPlugin';
import { createHMRHandler } from '../core/hmrHandler';

const logger = createLogger('nextjs-plugin');

// Minimal Next.js types for plugin interface
interface NextConfig {
  webpack?: (config: any, context: any) => any;
  experimental?: Record<string, any>;
  env?: Record<string, string>;
  publicRuntimeConfig?: Record<string, any>;
  serverRuntimeConfig?: Record<string, any>;
}

/**
 * Next.js-specific configuration
 */
export interface NextJSPluginConfig extends BuildToolPluginConfig {
  buildTool: BuildToolPluginConfig['buildTool'] & {
    type: 'nextjs';
    nextjs?: {
      /** Next.js configuration mode */
      configMode?: 'merge' | 'override';
      /** Webpack configuration customization */
      webpack?: {
        /** Enable webpack optimization */
        optimize?: boolean;
        /** Custom webpack rules */
        rules?: any[];
        /** Custom webpack plugins */
        plugins?: any[];
        /** Webpack alias configuration */
        alias?: Record<string, string>;
        /** External dependencies */
        externals?: string[] | Record<string, string>;
      };
      /** Experimental features */
      experimental?: {
        /** Enable app directory */
        appDir?: boolean;
        /** Enable Turbopack */
        turbo?: boolean;
        /** Enable server components */
        serverComponents?: boolean;
        /** Enable concurrent features */
        concurrentFeatures?: boolean;
      };
      /** Environment variables */
      env?: Record<string, string>;
      /** Image optimization */
      images?: {
        /** Image domains */
        domains?: string[];
        /** Image sizes */
        deviceSizes?: number[];
        /** Image formats */
        formats?: string[];
      };
      /** Internationalization */
      i18n?: {
        /** Supported locales */
        locales?: string[];
        /** Default locale */
        defaultLocale?: string;
        /** Domain locales */
        domains?: Array<{
          domain: string;
          defaultLocale: string;
          locales?: string[];
        }>;
      };
      /** Output configuration */
      output?: 'standalone' | 'export';
      /** Trailing slash configuration */
      trailingSlash?: boolean;
      /** Asset prefix */
      assetPrefix?: string;
      /** Base path */
      basePath?: string;
    };
  };
}

/**
 * Configuration schema
 */
export const nextjsPluginConfigSchema = z
  .object({
    name: z.string(),
    enabled: z.boolean().default(true),
    priority: z.number().default(10),
    buildTool: z.object({
      type: z.literal('nextjs'),
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
                'beforeBuild',
                'buildStart',
                'compilation',
                'transform',
                'generateBundle',
                'emit',
                'afterBuild',
                'development',
                'production',
              ])
            )
            .optional(),
          priority: z.number().default(10),
        })
        .optional(),
      nextjs: z
        .object({
          configMode: z.enum(['merge', 'override']).default('merge'),
          webpack: z
            .object({
              optimize: z.boolean().default(true),
              rules: z.array(z.any()).optional(),
              plugins: z.array(z.any()).optional(),
              alias: z.record(z.string()).optional(),
              externals: z.union([z.array(z.string()), z.record(z.string())]).optional(),
            })
            .optional(),
          experimental: z
            .object({
              appDir: z.boolean().optional(),
              turbo: z.boolean().optional(),
              serverComponents: z.boolean().optional(),
              concurrentFeatures: z.boolean().optional(),
            })
            .optional(),
          env: z.record(z.string()).optional(),
          images: z
            .object({
              domains: z.array(z.string()).optional(),
              deviceSizes: z.array(z.number()).optional(),
              formats: z.array(z.string()).optional(),
            })
            .optional(),
          i18n: z
            .object({
              locales: z.array(z.string()).optional(),
              defaultLocale: z.string().optional(),
              domains: z
                .array(
                  z.object({
                    domain: z.string(),
                    defaultLocale: z.string(),
                    locales: z.array(z.string()).optional(),
                  })
                )
                .optional(),
            })
            .optional(),
          output: z.enum(['standalone', 'export']).optional(),
          trailingSlash: z.boolean().optional(),
          assetPrefix: z.string().optional(),
          basePath: z.string().optional(),
        })
        .optional(),
    }),
  })
  .strict();

/**
 * Next.js Plugin for Tailwind Enigma CSS Optimization
 */
export class EnigmaNextJSPlugin implements BuildToolPlugin {
  readonly pluginType = 'build-tool' as const;
  readonly supportedBuildTools = ['nextjs'] as const;
  readonly buildToolConfigSchema = nextjsPluginConfigSchema;
  readonly name: string;
  readonly meta = {
    name: 'EnigmaNextJSPlugin',
    version: '1.0.0',
    description: 'Next.js plugin for Tailwind Enigma CSS optimization',
  };
  readonly configSchema = nextjsPluginConfigSchema;
  readonly hooks: BuildToolHooks = {
    transform: async (context: BuildToolContext, code: string, filePath: string) => {
      if (this.isCSSFile(filePath)) {
        const optimized = await this.optimizeCSS(code, {
          filePath,
          isDevelopment: context.isDevelopment,
          isProduction: context.isProduction,
          sourceMaps: this.config.buildTool.production?.sourceMaps,
        });
        return optimized.css;
      }
      return code;
    },
  };

  private config: NextJSPluginConfig;
  private hmrHandler = createHMRHandler();
  private context?: BuildToolContext;

  constructor(config: Partial<NextJSPluginConfig> = {}) {
    const defaultConfig: NextJSPluginConfig = {
      name: 'enigma-nextjs-plugin',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'nextjs',
        autoDetect: true,
        development: { hmr: true, hmrDelay: 100, liveReload: true },
        production: { sourceMaps: true, minify: true, extractCSS: true },
        nextjs: {
          configMode: 'merge',
          webpack: { optimize: true },
          experimental: {},
        },
      },
    };

    this.config = { ...defaultConfig, ...config } as NextJSPluginConfig;
    this.name = this.config.name;

    const validation = nextjsPluginConfigSchema.safeParse(this.config);
    if (!validation.success) {
      logger.error('Invalid Next.js plugin configuration', { errors: validation.error.errors });
      throw new Error(`Invalid configuration: ${validation.error.message}`);
    }

    logger.debug('Enigma Next.js plugin initialized', {
      config: this.config.name,
      enabled: this.config.enabled,
    });
  }

  async initialize(): Promise<void> {
    // Already handled in constructor
  }

  createPlugin(_context: PluginContext): PostCSSPlugin {
    const plugin = {
      postcssPlugin: this.name,
      Once: async (root: any, { result }: { result: any }) => {
        result.messages.push({ type: 'dependency', plugin: this.name, file: this.name });
      },
    };
    (plugin as any).postcssPlugin = this.name;
    return plugin;
  }

  /**
   * Create Next.js configuration with TW-Enigma integration
   */
  createNextConfig(existingConfig: NextConfig = {}): NextConfig {
    const enigmaConfig: NextConfig = {
      ...existingConfig,
      webpack: (config: any, context: any) => {
        // Call existing webpack function if it exists
        if (existingConfig.webpack) {
          config = existingConfig.webpack(config, context);
        }

        // Add TW-Enigma CSS processing rule
        config.module.rules.push({
          test: /\.(css|scss|sass|less|styl)$/,
          use: [
            {
              loader: 'enigma-css-loader',
              options: {
                isDevelopment: context.dev,
                isProduction: !context.dev,
                config: this.config,
              },
            },
          ],
        });

        // Add custom webpack optimizations if enabled
        if (this.config.buildTool.nextjs?.webpack?.optimize) {
          this.addWebpackOptimizations(config, context);
        }

        // Add custom rules and plugins
        if (this.config.buildTool.nextjs?.webpack?.rules) {
          config.module.rules.push(...this.config.buildTool.nextjs.webpack.rules);
        }

        if (this.config.buildTool.nextjs?.webpack?.plugins) {
          config.plugins.push(...this.config.buildTool.nextjs.webpack.plugins);
        }

        // Add custom aliases
        if (this.config.buildTool.nextjs?.webpack?.alias) {
          config.resolve.alias = {
            ...config.resolve.alias,
            ...this.config.buildTool.nextjs.webpack.alias,
          };
        }

        // Add externals
        if (this.config.buildTool.nextjs?.webpack?.externals) {
          const externals = this.config.buildTool.nextjs.webpack.externals;
          if (Array.isArray(externals)) {
            config.externals = [...(config.externals || []), ...externals];
          } else {
            config.externals = { ...(config.externals || {}), ...externals };
          }
        }

        logger.debug('Next.js webpack configuration enhanced with TW-Enigma', {
          isDevelopment: context.dev,
          isServer: context.isServer,
        });

        return config;
      },
    };

    // Merge experimental features
    if (this.config.buildTool.nextjs?.experimental) {
      enigmaConfig.experimental = {
        ...existingConfig.experimental,
        ...this.config.buildTool.nextjs.experimental,
      };
    }

    // Merge environment variables
    if (this.config.buildTool.nextjs?.env) {
      enigmaConfig.env = {
        ...existingConfig.env,
        ...this.config.buildTool.nextjs.env,
      };
    }

    // Add other Next.js configurations
    if (this.config.buildTool.nextjs?.output) {
      enigmaConfig.output = this.config.buildTool.nextjs.output;
    }

    if (this.config.buildTool.nextjs?.trailingSlash !== undefined) {
      enigmaConfig.trailingSlash = this.config.buildTool.nextjs.trailingSlash;
    }

    if (this.config.buildTool.nextjs?.assetPrefix) {
      enigmaConfig.assetPrefix = this.config.buildTool.nextjs.assetPrefix;
    }

    if (this.config.buildTool.nextjs?.basePath) {
      enigmaConfig.basePath = this.config.buildTool.nextjs.basePath;
    }

    logger.info('Next.js configuration created with TW-Enigma integration', {
      configMode: this.config.buildTool.nextjs?.configMode,
      hasWebpack: !!enigmaConfig.webpack,
      hasExperimental: !!enigmaConfig.experimental,
    });

    return enigmaConfig;
  }

  /**
   * Add webpack optimizations for TW-Enigma
   */
  private addWebpackOptimizations(config: any, context: any): void {
    // Add CSS optimization for production builds
    if (!context.dev) {
      config.optimization = config.optimization || {};
      config.optimization.minimizer = config.optimization.minimizer || [];

      // Add CSS-specific minimizer configuration
      config.optimization.minimizer.push({
        apply: (compiler: any) => {
          compiler.hooks.compilation.tap('EnigmaCSSMinimizer', (compilation: any) => {
            compilation.hooks.optimizeAssets.tapAsync(
              'EnigmaCSSMinimizer',
              async (assets: any, callback: any) => {
                for (const [assetName, asset] of Object.entries(assets)) {
                  if (this.isCSSFile(assetName)) {
                    try {
                      const source = (asset as any).source();
                      const optimized = await this.optimizeCSS(source, {
                        filePath: assetName,
                        isDevelopment: false,
                        isProduction: true,
                        sourceMaps: this.config.buildTool.production?.sourceMaps,
                      });

                      // Replace asset with optimized version
                      (assets as any)[assetName] = {
                        source: () => optimized.css,
                        size: () => optimized.css.length,
                      };
                    } catch (error) {
                      logger.error('Failed to optimize CSS asset', { assetName, error });
                    }
                  }
                }
                callback();
              }
            );
          });
        },
      });
    }

    // Add cache configuration for better performance
    if (context.dev) {
      config.cache = config.cache || {};
      config.cache.type = 'filesystem';
      config.cache.cacheDirectory = config.cache.cacheDirectory || '.next/cache/webpack';
    }
  }

  private async optimizeCSS(
    css: string,
    options: {
      filePath: string;
      isDevelopment: boolean;
      isProduction: boolean;
      sourceMaps?: boolean;
    }
  ): Promise<{ css: string; map?: any }> {
    logger.debug('CSS optimization through Next.js plugin', {
      filePath: options.filePath,
      mode: options.isDevelopment ? 'development' : 'production',
      sourceMaps: options.sourceMaps,
    });

    return {
      css,
      map: options.sourceMaps ? this.generateSourceMap(css, options.filePath) : undefined,
    };
  }

  private generateSourceMap(css: string, filePath: string): any {
    return {
      version: 3,
      sources: [filePath],
      names: [],
      mappings: '',
      file: filePath.replace(/\.css$/, '.min.css'),
    };
  }

  private isCSSFile(file: string): boolean {
    return /\.(css|scss|sass|less|styl)($|\?)/.test(file);
  }

  async initializeBuildTool(
    context: BuildToolContext,
    config: BuildToolPluginConfig
  ): Promise<void> {
    this.context = context;
    this.config = config as NextJSPluginConfig;

    logger.info('Next.js plugin initialized', {
      projectRoot: context.projectRoot,
      isDevelopment: context.isDevelopment,
      configMode: this.config.buildTool.nextjs?.configMode,
    });
  }

  async processBuild(context: BuildToolContext): Promise<BuildToolResult> {
    const startTime = performance.now();

    try {
      const result: BuildToolResult = {
        success: true,
        assets: Object.fromEntries(context.assets),
        optimization: context.optimizationResults,
        metrics: { ...context.metrics, endTime: Date.now() },
        warnings: [],
      };

      const endTime = performance.now();
      logger.info('Next.js processing completed', {
        duration: endTime - startTime,
        assetsCount: context.assets.size,
      });

      return result;
    } catch (error) {
      logger.error('Next.js processing failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        assets: {},
        metrics: context.metrics,
        warnings: [],
      };
    }
  }

  getBuildToolConfig(): NextConfig {
    return this.createNextConfig();
  }
}

/**
 * Factory function to create Next.js plugin
 */
export function enigmaNextJS(config: Partial<NextJSPluginConfig> = {}): EnigmaNextJSPlugin {
  return new EnigmaNextJSPlugin(config);
}

/**
 * Convenience function to wrap Next.js config
 */
export function withEnigma(
  nextConfig: NextConfig = {},
  pluginConfig: Partial<NextJSPluginConfig> = {}
): NextConfig {
  const plugin = new EnigmaNextJSPlugin(pluginConfig);
  return plugin.createNextConfig(nextConfig);
}

/**
 * Default Next.js plugin configuration
 */
export const defaultNextJSConfig: NextJSPluginConfig = {
  name: 'enigma-nextjs-plugin',
  enabled: true,
  priority: 10,
  buildTool: {
    type: 'nextjs',
    autoDetect: true,
    development: { hmr: true, hmrDelay: 100, liveReload: true },
    production: { sourceMaps: true, minify: true, extractCSS: true },
    nextjs: {
      configMode: 'merge',
      webpack: { optimize: true },
      experimental: {},
    },
  },
};

export default enigmaNextJS;
