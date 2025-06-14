/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Core PostCSS Plugin Infrastructure
 * Provides the main plugin factory function and base plugin class
 */

import type { Plugin, PluginCreator, Root } from "postcss";
import { z } from "zod";
import { createLogger } from "../logger.ts";
import type {
  EnigmaPlugin,
  PluginConfig,
  PluginContext,
  PluginMetrics,
  PluginResult,
} from "../types/plugins.ts";

/**
 * Plugin configuration schema
 */
export const PluginConfigSchema = z.object({
  name: z.string().min(1, "Plugin name is required"),
  version: z.string().optional(),
  options: z.record(z.unknown()).optional().default({}),
  enabled: z.boolean().optional().default(true),
  priority: z.number().int().min(0).max(100).optional().default(50),
});

/**
 * Plugin metrics implementation for performance monitoring
 */
export class PluginMetricsImpl implements PluginMetrics {
  private timers = new Map<string, number>();
  private warnings: string[] = [];
  private dependencies: string[] = [];
  private transformations = 0;
  private memoryUsage = 0;

  constructor(private pluginName: string) {}

  startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  endTimer(label: string): number {
    const start = this.timers.get(label);
    if (!start) {
      throw new Error(`Timer '${label}' was not started`);
    }
    const duration = Date.now() - start;
    this.timers.delete(label);
    return duration;
  }

  recordMemory(usage: number): void {
    this.memoryUsage = Math.max(this.memoryUsage, Math.max(0, usage));
  }

  addWarning(message: string): void {
    this.warnings.push(message);
  }

  addDependency(file: string): void {
    if (!this.dependencies.includes(file)) {
      this.dependencies.push(file);
    }
  }

  incrementTransformations(): void {
    this.transformations++;
  }

  getMetrics(): PluginResult {
    return {
      pluginName: this.pluginName,
      processingTime: 0, // Will be set by processor
      transformations: this.transformations,
      memoryUsage: this.memoryUsage,
      warnings: [...this.warnings],
      dependencies: [...this.dependencies],
      success: true,
    };
  }
}

/**
 * Base plugin class providing common functionality
 */
export abstract class BaseEnigmaPlugin implements EnigmaPlugin {
  abstract readonly meta: {
    name: string;
    version: string;
    description: string;
    author?: string;
  };

  abstract readonly configSchema: z.ZodSchema;

  protected logger = createLogger(`plugin:unknown`);
  protected config?: PluginConfig;

  async initialize(config: PluginConfig): Promise<void> {
    // Update logger with actual plugin name
    this.logger = createLogger(`plugin:${this.meta.name}`);
    
    // Validate configuration
    const validationResult = this.configSchema.safeParse(config);
    if (!validationResult.success) {
      throw new Error(
        `Invalid configuration for plugin ${config.name}: ${validationResult.error.message}`,
      );
    }

    this.config = validationResult.data;
    this.logger.debug("Plugin initialized", { config: this.config });
  }

  abstract createPlugin(context: PluginContext): Plugin;

  async cleanup(): Promise<void> {
    this.logger.debug("Plugin cleanup completed");
  }

  /**
   * Helper method to create a PostCSS plugin with standard wrapper
   */
  protected createPostCSSPlugin(
    handler: (root: Root, context: PluginContext) => void | Promise<void>,
  ): PluginCreator<any> {
    const plugin = (opts: any = {}) => {
      // Pass meta and logger through opts
      opts.pluginMeta = this.meta;
      opts.pluginLogger = this.logger;
      
      return {
        postcssPlugin: this.meta.name,
        async Once(root: Root, _helpers: any) {
          const context = (opts as any).context as PluginContext;
          const pluginMeta = (opts as any).pluginMeta || { name: 'unknown' };
          const pluginLogger = (opts as any).pluginLogger;
          
          if (!context) {
            throw new Error(`Plugin ${pluginMeta.name} requires context`);
          }

          try {
            context.metrics.startTimer("plugin-execution");
            await handler(root, context);
            const duration = context.metrics.endTimer("plugin-execution");

            if (pluginLogger) {
              pluginLogger.debug("Plugin execution completed", {
                duration,
                transformations: context.metrics.getMetrics().transformations,
              });
            }
          } catch (error) {
            context.metrics.addWarning(
              `Plugin error: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
          }
        },
      };
    };
    return Object.assign(plugin, { postcss: true as const });
  }

  /**
   * Helper method to report dependencies to PostCSS
   */
  protected reportDependency(
    context: PluginContext,
    filePath: string,
    type: "file" | "dir" = "file",
  ): void {
    context.result.messages.push({
      type: type === "dir" ? "dir-dependency" : "dependency",
      plugin: this.meta.name,
      file: filePath,
      parent: context.result.opts.from || "",
    });
    context.metrics.addDependency(filePath);
  }

  /**
   * Helper method to add warnings
   */
  protected addWarning(
    context: PluginContext,
    message: string,
    node?: any,
  ): void {
    if (node && node.warn) {
      node.warn(context.result, message);
    } else {
      context.result.warn(message, { plugin: this.meta.name });
    }
    context.metrics.addWarning(message);
  }

  /**
   * Helper method to validate CSS selector
   */
  protected isValidCssSelector(selector: string): boolean {
    try {
      // Basic CSS selector validation
      if (!selector || typeof selector !== "string") return false;

      // Check for basic CSS selector patterns
      const selectorPattern =
        /^[.#]?[a-zA-Z_-][a-zA-Z0-9_-]*([:.][a-zA-Z0-9_-]+)*$/;
      return selectorPattern.test(selector.trim());
    } catch {
      return false;
    }
  }

  /**
   * Helper method to get memory usage
   */
  protected getMemoryUsage(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
}

/**
 * Plugin factory function for creating Enigma plugins
 */
export function createEnigmaPlugin<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  meta: {
    name: string;
    version: string;
    description: string;
    author?: string;
  },
  configSchema: z.ZodSchema<T>,
  pluginHandler: (context: PluginContext) => Plugin,
): EnigmaPlugin {
  return {
    meta,
    configSchema,

    async initialize(config: PluginConfig): Promise<void> {
      const validationResult = configSchema.safeParse(config.options);
      if (!validationResult.success) {
        throw new Error(
          `Invalid configuration for plugin ${config.name}: ${validationResult.error.message}`,
        );
      }
    },

    createPlugin(context: PluginContext): Plugin {
      return pluginHandler(context);
    },
  };
}

/**
 * Utility function to create plugin metrics
 */
export function createPluginMetrics(pluginName: string): PluginMetrics {
  return new PluginMetricsImpl(pluginName);
}

/**
 * Validate plugin configuration
 */
export function validatePluginConfig(config: unknown): PluginConfig {
  const result = PluginConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid plugin configuration: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Check if value is a valid Enigma plugin
 */
export function isEnigmaPlugin(value: unknown): value is EnigmaPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    "meta" in value &&
    "configSchema" in value &&
    "createPlugin" in value &&
    typeof (value as any).createPlugin === "function"
  );
}
