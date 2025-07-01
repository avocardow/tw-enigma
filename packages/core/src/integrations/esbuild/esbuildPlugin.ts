/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ESBuild Plugin for Tailwind Enigma
 * Integrates CSS optimization into the ESBuild process
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

const logger = createLogger('esbuild-plugin');

// Minimal ESBuild types for plugin interface
interface ESBuildPlugin {
  name: string;
  setup(build: any): void;
}

/**
 * ESBuild-specific configuration
 */
export interface ESBuildPluginConfig extends BuildToolPluginConfig {
  buildTool: BuildToolPluginConfig['buildTool'] & {
    type: 'esbuild';
    esbuild?: {
      platform?: 'browser' | 'node' | 'neutral';
      format?: 'esm' | 'cjs' | 'iife';
      bundle?: boolean;
      minify?: boolean;
      sourcemap?: boolean | 'linked' | 'inline' | 'external' | 'both';
      outdir?: string;
      loader?: Record<string, string>;
    };
  };
}

/**
 * Configuration schema
 */
export const esbuildPluginConfigSchema = z
  .object({
    name: z.string(),
    enabled: z.boolean().default(true),
    priority: z.number().default(10),
    buildTool: z.object({
      type: z.literal('esbuild'),
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
      esbuild: z
        .object({
          platform: z.enum(['browser', 'node', 'neutral']).default('browser'),
          format: z.enum(['esm', 'cjs', 'iife']).default('esm'),
          bundle: z.boolean().default(true),
          minify: z.boolean().default(false),
          sourcemap: z
            .union([z.boolean(), z.enum(['linked', 'inline', 'external', 'both'])])
            .default(false),
          outdir: z.string().optional(),
          loader: z.record(z.string()).optional(),
        })
        .optional(),
    }),
  })
  .strict();

/**
 * ESBuild Plugin for Tailwind Enigma CSS Optimization
 */
export class EnigmaESBuildPlugin implements BuildToolPlugin {
  readonly pluginType = 'build-tool' as const;
  readonly supportedBuildTools = ['esbuild'] as const;
  readonly buildToolConfigSchema = esbuildPluginConfigSchema;
  readonly name: string;
  readonly meta = {
    name: 'EnigmaESBuildPlugin',
    version: '1.0.0',
    description: 'ESBuild plugin for Tailwind Enigma CSS optimization',
  };
  readonly configSchema = esbuildPluginConfigSchema;
  readonly hooks: BuildToolHooks = {
    transform: async (context: BuildToolContext, code: string, filePath: string) => {
      if (this.isCSSFile(filePath)) {
        const optimized = await this.optimizeCSS(code, {
          filePath,
          isDevelopment: context.isDevelopment,
          isProduction: context.isProduction,
          sourceMaps: this.config.buildTool.esbuild?.sourcemap,
        });
        return optimized.css;
      }
      return code;
    },
  };

  private config: ESBuildPluginConfig;
  private hmrHandler = createHMRHandler();
  private context?: BuildToolContext;

  constructor(config: Partial<ESBuildPluginConfig> = {}) {
    const defaultConfig: ESBuildPluginConfig = {
      name: 'enigma-esbuild-plugin',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'esbuild',
        autoDetect: true,
        development: { hmr: true, hmrDelay: 100, liveReload: true },
        production: { sourceMaps: true, minify: true, extractCSS: true },
        esbuild: {
          platform: 'browser',
          format: 'esm',
          bundle: true,
          minify: false,
          sourcemap: false,
        },
      },
    };

    this.config = { ...defaultConfig, ...config } as ESBuildPluginConfig;
    this.name = this.config.name;

    const validation = esbuildPluginConfigSchema.safeParse(this.config);
    if (!validation.success) {
      logger.error('Invalid ESBuild plugin configuration', { errors: validation.error.errors });
      throw new Error(`Invalid configuration: ${validation.error.message}`);
    }

    logger.debug('Enigma ESBuild plugin initialized', {
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
   * Create ESBuild plugin
   */
  createESBuildPlugin(): ESBuildPlugin {
    return {
      name: this.name,
      setup: (build) => {
        build.onLoad({ filter: /\.(css|scss|sass|less|styl)($|\?)/ }, async (args: any) => {
          const filePath = args.path;
          const startTime = performance.now();

          try {
            const fs = await import('fs/promises');
            const content = await fs.readFile(filePath, 'utf8');

            logger.debug('Processing CSS file with ESBuild plugin', {
              filePath,
              size: content.length,
            });

            const optimized = await this.optimizeCSS(content, {
              filePath,
              isDevelopment: this.context?.isDevelopment ?? false,
              isProduction: this.context?.isProduction ?? false,
              sourceMaps: this.config.buildTool.esbuild?.sourcemap,
            });

            const endTime = performance.now();
            logger.debug('ESBuild CSS processing completed', {
              filePath,
              duration: endTime - startTime,
              originalSize: content.length,
              optimizedSize: optimized.css.length,
              savings: content.length - optimized.css.length,
            });

            return { contents: optimized.css, loader: 'css', watchFiles: [filePath] };
          } catch (error) {
            logger.error('ESBuild CSS processing failed', { filePath, error });
            return {
              errors: [
                {
                  text: `Failed to process CSS: ${error instanceof Error ? error.message : String(error)}`,
                  location: { file: filePath },
                },
              ],
            };
          }
        });

        build.onStart(() => {
          logger.debug('ESBuild started', {
            platform: this.config.buildTool.esbuild?.platform,
            format: this.config.buildTool.esbuild?.format,
          });
        });

        build.onEnd((result: any) => {
          if (result.errors.length > 0) {
            logger.error('ESBuild completed with errors', {
              errorCount: result.errors.length,
              warningCount: result.warnings.length,
            });
          } else {
            logger.info('ESBuild completed successfully', { warningCount: result.warnings.length });
          }
        });
      },
    };
  }

  private async optimizeCSS(
    css: string,
    options: {
      filePath: string;
      isDevelopment: boolean;
      isProduction: boolean;
      sourceMaps?: boolean | string;
    }
  ): Promise<{ css: string; map?: any }> {
    logger.debug('CSS optimization through ESBuild plugin', {
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
    this.config = config as ESBuildPluginConfig;

    logger.info('ESBuild plugin initialized', {
      projectRoot: context.projectRoot,
      isDevelopment: context.isDevelopment,
      platform: this.config.buildTool.esbuild?.platform,
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
      logger.info('ESBuild processing completed', {
        duration: endTime - startTime,
        assetsCount: context.assets.size,
      });

      return result;
    } catch (error) {
      logger.error('ESBuild processing failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        assets: {},
        metrics: context.metrics,
        warnings: [],
      };
    }
  }

  getBuildToolConfig(): any {
    return {
      plugins: [this.createESBuildPlugin()],
      platform: this.config.buildTool.esbuild?.platform || 'browser',
      format: this.config.buildTool.esbuild?.format || 'esm',
      bundle: this.config.buildTool.esbuild?.bundle ?? true,
      minify: this.config.buildTool.esbuild?.minify ?? false,
      sourcemap: this.config.buildTool.esbuild?.sourcemap ?? false,
      outdir: this.config.buildTool.esbuild?.outdir,
      loader: this.config.buildTool.esbuild?.loader,
    };
  }
}

/**
 * Factory function to create ESBuild plugin
 */
export function enigmaESBuild(config: Partial<ESBuildPluginConfig> = {}): EnigmaESBuildPlugin {
  return new EnigmaESBuildPlugin(config);
}

/**
 * Default ESBuild plugin configuration
 */
export const defaultESBuildConfig: ESBuildPluginConfig = {
  name: 'enigma-esbuild-plugin',
  enabled: true,
  priority: 10,
  buildTool: {
    type: 'esbuild',
    autoDetect: true,
    development: { hmr: true, hmrDelay: 100, liveReload: true },
    production: { sourceMaps: true, minify: true, extractCSS: true },
    esbuild: { platform: 'browser', format: 'esm', bundle: true, minify: false, sourcemap: false },
  },
};

export default enigmaESBuild;
