/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Parcel Transformer for Tailwind Enigma
 * Integrates CSS optimization into the Parcel build process
 */

// Note: @parcel/types would need to be installed as a dependency for production use
// For now, we'll define minimal types needed for the transformer
interface ParcelAsset {
  filePath: string;
  getCode(): Promise<string>;
  setCode(code: string): void;
  setMap(map: any): void;
}

interface ParcelTransformOptions {
  mode: 'development' | 'production';
}

interface ParcelTransformerArgs {
  asset: ParcelAsset;
  config: any;
  options: ParcelTransformOptions;
}

interface Transformer {
  transform(args: ParcelTransformerArgs): Promise<ParcelAsset[]>;
}

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

const logger = createLogger('parcel-transformer');

/**
 * Parcel-specific configuration
 */
export interface ParcelTransformerConfig extends BuildToolPluginConfig {
  buildTool: BuildToolPluginConfig['buildTool'] & {
    type: 'parcel';
    parcel?: {
      /** Enable Parcel dev server integration */
      devServer?: boolean;
      /** Target environment */
      target?: string | string[];
      /** Source map configuration */
      sourceMaps?: boolean | 'inline';
      /** Bundle configuration */
      bundle?: {
        /** Output directory */
        distDir?: string;
        /** Public URL for assets */
        publicUrl?: string;
        /** Enable cache */
        cache?: boolean;
        /** Cache directory */
        cacheDir?: string;
      };
      /** Transformer options */
      transformer?: {
        /** Asset pipeline configuration */
        assets?: Record<string, any>;
        /** CSS processing options */
        css?: {
          /** Enable CSS modules */
          modules?: boolean;
          /** PostCSS configuration */
          postcss?: Record<string, any>;
        };
      };
    };
  };
}

/**
 * Parcel transformer configuration schema
 */
export const parcelTransformerConfigSchema = z
  .object({
    name: z.string(),
    enabled: z.boolean().default(true),
    priority: z.number().default(10),
    buildTool: z.object({
      type: z.literal('parcel'),
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
      parcel: z
        .object({
          devServer: z.boolean().default(true),
          target: z.union([z.string(), z.array(z.string())]).default('web'),
          sourceMaps: z.union([z.boolean(), z.literal('inline')]).default(true),
          bundle: z
            .object({
              distDir: z.string().default('dist'),
              publicUrl: z.string().default('/'),
              cache: z.boolean().default(true),
              cacheDir: z.string().default('.parcel-cache'),
            })
            .optional(),
          transformer: z
            .object({
              assets: z.record(z.any()).optional(),
              css: z
                .object({
                  modules: z.boolean().default(false),
                  postcss: z.record(z.any()).optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    }),
  })
  .strict();

/**
 * Parcel Transformer for Tailwind Enigma CSS Optimization
 */
export class EnigmaParcelTransformer implements BuildToolPlugin {
  readonly pluginType = 'build-tool' as const;
  readonly supportedBuildTools = ['parcel'] as const;
  readonly buildToolConfigSchema = parcelTransformerConfigSchema;
  readonly name: string;
  readonly meta = {
    name: 'EnigmaParcelTransformer',
    version: '1.0.0',
    description: 'Parcel transformer for Tailwind Enigma CSS optimization',
  };
  readonly configSchema = parcelTransformerConfigSchema;
  readonly hooks: BuildToolHooks = {
    transform: async (context: BuildToolContext, code: string, filePath: string) => {
      if (this.isCSSFile(filePath)) {
        const optimized = await this.optimizeCSS(code, {
          filePath,
          isDevelopment: context.isDevelopment,
          isProduction: context.isProduction,
          sourceMaps: this.config.buildTool.parcel?.sourceMaps,
        });
        return optimized.css;
      }
      return code;
    },
  };

  // Plugin methods for BuildToolPlugin interface
  async initialize(): Promise<void> {
    // Already handled in constructor
  }

  createPlugin(_context: PluginContext): PostCSSPlugin {
    const plugin = {
      postcssPlugin: this.name,
      Once: async (root: any, { result }: { result: any }) => {
        // This is a build tool integration plugin, not a direct CSS processor
        // The actual CSS processing happens through Parcel transformer hooks
        // Just mark that this plugin was executed
        result.messages.push({
          type: 'dependency',
          plugin: this.name,
          file: this.name,
        });
      },
    };
    (plugin as any).postcssPlugin = this.name;
    return plugin;
  }

  private config: ParcelTransformerConfig;
  private hmrHandler = createHMRHandler();
  private context?: BuildToolContext;

  constructor(config: Partial<ParcelTransformerConfig> = {}) {
    // Set default configuration
    const defaultConfig: ParcelTransformerConfig = {
      name: 'enigma-parcel-transformer',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'parcel',
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
        parcel: {
          devServer: true,
          target: 'web',
          sourceMaps: true,
          bundle: {
            distDir: 'dist',
            publicUrl: '/',
            cache: true,
            cacheDir: '.parcel-cache',
          },
          transformer: {
            css: {
              modules: false,
            },
          },
        },
      },
    };

    this.config = { ...defaultConfig, ...config } as ParcelTransformerConfig;
    this.name = this.config.name;

    // Validate configuration
    const validation = parcelTransformerConfigSchema.safeParse(this.config);
    if (!validation.success) {
      logger.error('Invalid Parcel transformer configuration', {
        errors: validation.error.errors,
      });
      throw new Error(`Invalid configuration: ${validation.error.message}`);
    }

    logger.debug('Enigma Parcel transformer initialized', {
      config: this.config.name,
      enabled: this.config.enabled,
    });
  }

  /**
   * Create Parcel transformer function
   */
  createParcelTransformer(): Transformer {
    return {
      transform: async ({ asset, options }: ParcelTransformerArgs) => {
        const startTime = performance.now();

        try {
          // Get the asset content
          const content = await asset.getCode();

          // Check if this is a CSS file
          if (!this.isCSSFile(asset.filePath)) {
            // For non-CSS files, return as-is
            return [asset];
          }

          logger.debug('Processing CSS asset with Parcel transformer', {
            filePath: asset.filePath,
            size: content.length,
          });

          // Process CSS content through TW-Enigma optimization
          const optimizedContent = await this.optimizeCSS(content, {
            filePath: asset.filePath,
            isDevelopment: options.mode === 'development',
            isProduction: options.mode === 'production',
            sourceMaps: this.config.buildTool.parcel?.sourceMaps,
          });

          // Set the optimized content
          asset.setCode(optimizedContent.css);

          // Handle source maps if enabled
          if (optimizedContent.map && this.config.buildTool.parcel?.sourceMaps) {
            asset.setMap(optimizedContent.map);
          }

          // Track transformation metrics
          const endTime = performance.now();
          logger.debug('Parcel transformer completed', {
            filePath: asset.filePath,
            duration: endTime - startTime,
            originalSize: content.length,
            optimizedSize: optimizedContent.css.length,
            savings: content.length - optimizedContent.css.length,
          });

          return [asset];
        } catch (error) {
          logger.error('Parcel transformer failed', {
            filePath: asset.filePath,
            error,
          });

          // Return original asset on error to prevent build failure
          return [asset];
        }
      },
    };
  }

  /**
   * Optimize CSS content
   */
  private async optimizeCSS(
    css: string,
    options: {
      filePath: string;
      isDevelopment: boolean;
      isProduction: boolean;
      sourceMaps?: boolean | 'inline';
    }
  ): Promise<{ css: string; map?: any }> {
    // This would integrate with the TW-Enigma core optimization engine
    // For now, return the input CSS (placeholder implementation)

    // In a real implementation, this would:
    // 1. Parse the CSS
    // 2. Run TW-Enigma optimization
    // 3. Generate optimized CSS
    // 4. Generate source maps if requested

    logger.debug('CSS optimization through Parcel transformer', {
      filePath: options.filePath,
      mode: options.isDevelopment ? 'development' : 'production',
      sourceMaps: options.sourceMaps,
    });

    return {
      css,
      map: options.sourceMaps ? this.generateSourceMap(css, options.filePath) : undefined,
    };
  }

  /**
   * Generate source map for CSS
   */
  private generateSourceMap(css: string, filePath: string): any {
    // Placeholder source map generation
    // In a real implementation, this would generate proper source maps
    return {
      version: 3,
      sources: [filePath],
      names: [],
      mappings: '',
      file: filePath.replace(/\.css$/, '.min.css'),
    };
  }

  /**
   * Check if file is a CSS file
   */
  private isCSSFile(file: string): boolean {
    return /\.(css|scss|sass|less|styl)($|\?)/.test(file);
  }

  /**
   * Initialize build tool plugin
   */
  async initializeBuildTool(
    context: BuildToolContext,
    config: BuildToolPluginConfig
  ): Promise<void> {
    this.context = context;
    this.config = config as ParcelTransformerConfig;

    logger.info('Parcel transformer initialized', {
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
      // Process would happen through Parcel transformer hooks
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
      logger.info('Parcel build processed', {
        duration: endTime - startTime,
        assetsCount: context.assets.size,
      });

      return result;
    } catch (error) {
      logger.error('Parcel build processing failed', { error });

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
   * Get Parcel-specific configuration
   */
  getBuildToolConfig(): any {
    return {
      transformers: {
        '*.css': ['@tw-enigma/parcel-transformer'],
        '*.scss': ['@parcel/transformer-sass', '@tw-enigma/parcel-transformer'],
        '*.less': ['@parcel/transformer-less', '@tw-enigma/parcel-transformer'],
      },
      bundle: this.config.buildTool.parcel?.bundle || {},
      targets: {
        default: {
          distDir: this.config.buildTool.parcel?.bundle?.distDir || 'dist',
          publicUrl: this.config.buildTool.parcel?.bundle?.publicUrl || '/',
          sourceMaps: this.config.buildTool.parcel?.sourceMaps,
        },
      },
    };
  }
}

/**
 * Factory function to create Parcel transformer
 */
export function enigmaParcel(
  config: Partial<ParcelTransformerConfig> = {}
): EnigmaParcelTransformer {
  return new EnigmaParcelTransformer(config);
}

/**
 * Default Parcel transformer configuration
 */
export const defaultParcelConfig: ParcelTransformerConfig = {
  name: 'enigma-parcel-transformer',
  enabled: true,
  priority: 10,
  buildTool: {
    type: 'parcel',
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
    parcel: {
      devServer: true,
      target: 'web',
      sourceMaps: true,
      bundle: {
        distDir: 'dist',
        publicUrl: '/',
        cache: true,
        cacheDir: '.parcel-cache',
      },
      transformer: {
        css: {
          modules: false,
        },
      },
    },
  },
};

/**
 * Export for use in .parcelrc configuration
 */
export default enigmaParcel;
