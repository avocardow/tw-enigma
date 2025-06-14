/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * PostCSS Plugin Configuration System
 * Provides schema validation, configuration management, and integration with main config
 */

import { z } from "zod";
import { createLogger } from "./logger.ts";
import type { EnigmaConfig } from "./config.ts";

const logger = createLogger("plugin-config");

/**
 * Core plugin configuration schema
 */
export const CorePluginConfigSchema = z.object({
  enabled: z.boolean().default(true),
  priority: z.number().min(-100).max(100).default(0),
  runOnce: z.boolean().default(false),
  dependencies: z.array(z.string()).default([]),
  skipOnError: z.boolean().default(false),
  timeout: z.number().positive().default(30000), // 30 seconds
  metadata: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Tailwind optimizer plugin configuration
 */
export const TailwindOptimizerConfigSchema = CorePluginConfigSchema.extend({
  extractUtilities: z.boolean().default(true),
  optimizeFrequentClasses: z.boolean().default(true),
  minFrequency: z.number().min(1).default(2),
  preserveComments: z.boolean().default(false),
  generateUtilityClasses: z.boolean().default(true),
  prefixOptimized: z.string().default("tw-opt-"),
  maxUtilityClasses: z.number().positive().default(1000),
  enableInlineOptimization: z.boolean().default(false),
});

/**
 * CSS minifier plugin configuration
 */
export const CssMinifierConfigSchema = CorePluginConfigSchema.extend({
  removeComments: z.boolean().default(true),
  removeWhitespace: z.boolean().default(true),
  compressColors: z.boolean().default(true),
  optimizeDeclarations: z.boolean().default(true),
  mergeRules: z.boolean().default(true),
  removeEmptyRules: z.boolean().default(true),
  preserveImportant: z.boolean().default(true),
  compressNumbers: z.boolean().default(true),
  optimizeShorthand: z.boolean().default(true),
  removeUnusedSelectors: z.boolean().default(false),
  aggressiveOptimization: z.boolean().default(false),
});

/**
 * Source mapper plugin configuration
 */
export const SourceMapperConfigSchema = CorePluginConfigSchema.extend({
  generateSourceMap: z.boolean().default(true),
  includeContents: z.boolean().default(false),
  sourceMapURL: z.string().optional(),
  sourceRoot: z.string().optional(),
  preserveOriginalSources: z.boolean().default(true),
  inlineSourceMap: z.boolean().default(false),
  transformPaths: z.boolean().default(true),
});

/**
 * PostCSS processor configuration
 */
export const PostCSSProcessorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  syntax: z.string().optional(),
  parser: z.string().optional(),
  stringifier: z.string().optional(),
  plugins: z.array(z.string()).default([]),
  enableAsync: z.boolean().default(true),
  preserveComments: z.boolean().default(true),
  enableSourceMaps: z.boolean().default(true),
  optimizationLevel: z
    .enum(["none", "basic", "standard", "aggressive"])
    .default("standard"),
  maxParallelPlugins: z.number().positive().default(4),
  pluginTimeout: z.number().positive().default(30000),
  memoryLimit: z
    .number()
    .positive()
    .default(512 * 1024 * 1024), // 512MB
  enablePerformanceMonitoring: z.boolean().default(true),
});

/**
 * Plugin system configuration
 */
export const PluginSystemConfigSchema = z.object({
  enabled: z.boolean().default(true),
  pluginDirectory: z.string().default("./plugins"),
  autoLoad: z.boolean().default(true),
  enableHotReload: z.boolean().default(false),
  maxPlugins: z.number().positive().default(50),
  enableValidation: z.boolean().default(true),
  errorHandling: z.enum(["ignore", "warn", "throw"]).default("warn"),
  enableMetrics: z.boolean().default(true),
  cachePlugins: z.boolean().default(true),
  enableSandbox: z.boolean().default(false),
  resourceLimits: z
    .object({
      maxMemory: z
        .number()
        .positive()
        .default(256 * 1024 * 1024), // 256MB
      maxCpuTime: z.number().positive().default(30000), // 30 seconds
      maxFileDescriptors: z.number().positive().default(100),
    })
    .default({}),
});

/**
 * Complete PostCSS integration configuration
 */
export const PostCSSIntegrationConfigSchema = z.object({
  processor: PostCSSProcessorConfigSchema.default({}),
  pluginSystem: PluginSystemConfigSchema.default({}),
  builtinPlugins: z
    .object({
      tailwindOptimizer: TailwindOptimizerConfigSchema.default({}),
      cssMinifier: CssMinifierConfigSchema.default({}),
      sourceMapper: SourceMapperConfigSchema.default({}),
    })
    .default({}),
  customPlugins: z.record(z.string(), z.unknown()).default({}),
});

// Type exports
export type CorePluginConfig = z.infer<typeof CorePluginConfigSchema>;
export type TailwindOptimizerConfig = z.infer<
  typeof TailwindOptimizerConfigSchema
>;
export type CssMinifierConfig = z.infer<typeof CssMinifierConfigSchema>;
export type SourceMapperConfig = z.infer<typeof SourceMapperConfigSchema>;
export type PostCSSProcessorConfig = z.infer<
  typeof PostCSSProcessorConfigSchema
>;
export type PluginSystemConfig = z.infer<typeof PluginSystemConfigSchema>;
export type PostCSSIntegrationConfig = z.infer<
  typeof PostCSSIntegrationConfigSchema
>;

/**
 * Configuration validation and management class
 */
export class PluginConfigManager {
  private config: PostCSSIntegrationConfig;
  private readonly logger = createLogger("plugin-config-manager");

  constructor(config: Partial<PostCSSIntegrationConfig> = {}) {
    this.config = this.validateAndNormalize(config);
    this.logger.info("Plugin configuration manager initialized", {
      enabledPlugins: this.getEnabledPlugins().length,
      processorEnabled: this.config.processor.enabled,
      pluginSystemEnabled: this.config.pluginSystem.enabled,
    });
  }

  /**
   * Validate and normalize configuration
   */
  private validateAndNormalize(
    config: Partial<PostCSSIntegrationConfig>,
  ): PostCSSIntegrationConfig {
    try {
      const result = PostCSSIntegrationConfigSchema.parse(config);
      this.logger.debug("Configuration validated successfully");
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");

        this.logger.error("Configuration validation failed", {
          errors: errorMessages,
          inputConfig: config,
        });

        throw new Error(`Invalid plugin configuration: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Get the complete configuration
   */
  getConfig(): PostCSSIntegrationConfig {
    return this.config;
  }

  /**
   * Get processor configuration
   */
  getProcessorConfig(): PostCSSProcessorConfig {
    return this.config.processor;
  }

  /**
   * Get plugin system configuration
   */
  getPluginSystemConfig(): PluginSystemConfig {
    return this.config.pluginSystem;
  }

  /**
   * Get configuration for a specific builtin plugin
   */
  getBuiltinPluginConfig<T = unknown>(
    pluginName: keyof PostCSSIntegrationConfig["builtinPlugins"],
  ): T {
    return this.config.builtinPlugins[pluginName] as T;
  }

  /**
   * Get configuration for a custom plugin
   */
  getCustomPluginConfig<T = unknown>(pluginName: string): T | undefined {
    return this.config.customPlugins[pluginName] as T | undefined;
  }

  /**
   * Update processor configuration
   */
  updateProcessorConfig(updates: Partial<PostCSSProcessorConfig>): void {
    const newConfig = { ...this.config.processor, ...updates };
    const validated = PostCSSProcessorConfigSchema.parse(newConfig);
    this.config.processor = validated;
    this.logger.debug("Processor configuration updated", updates);
  }

  /**
   * Update plugin system configuration
   */
  updatePluginSystemConfig(updates: Partial<PluginSystemConfig>): void {
    const newConfig = { ...this.config.pluginSystem, ...updates };
    const validated = PluginSystemConfigSchema.parse(newConfig);
    this.config.pluginSystem = validated;
    this.logger.debug("Plugin system configuration updated", updates);
  }

  /**
   * Update builtin plugin configuration
   */
  updateBuiltinPluginConfig<
    T extends keyof PostCSSIntegrationConfig["builtinPlugins"],
  >(
    pluginName: T,
    updates: Partial<PostCSSIntegrationConfig["builtinPlugins"][T]>,
  ): void {
    const currentConfig = this.config.builtinPlugins[pluginName];
    const newConfig = { ...currentConfig, ...updates };

    // Validate based on plugin type
    let validated;
    switch (pluginName) {
      case "tailwindOptimizer":
        validated = TailwindOptimizerConfigSchema.parse(newConfig);
        break;
      case "cssMinifier":
        validated = CssMinifierConfigSchema.parse(newConfig);
        break;
      case "sourceMapper":
        validated = SourceMapperConfigSchema.parse(newConfig);
        break;
      default:
        validated = newConfig;
    }

    (this.config.builtinPlugins as any)[pluginName] = validated;
    this.logger.debug("Builtin plugin configuration updated", {
      pluginName,
      updates,
    });
  }

  /**
   * Set custom plugin configuration
   */
  setCustomPluginConfig(pluginName: string, config: unknown): void {
    this.config.customPlugins[pluginName] = config;
    this.logger.debug("Custom plugin configuration set", { pluginName });
  }

  /**
   * Remove custom plugin configuration
   */
  removeCustomPluginConfig(pluginName: string): boolean {
    if (pluginName in this.config.customPlugins) {
      delete this.config.customPlugins[pluginName];
      this.logger.debug("Custom plugin configuration removed", { pluginName });
      return true;
    }
    return false;
  }

  /**
   * Get list of enabled plugins
   */
  getEnabledPlugins(): string[] {
    const enabled: string[] = [];

    // Check builtin plugins
    Object.entries(this.config.builtinPlugins).forEach(([name, config]) => {
      if (config.enabled) {
        enabled.push(name);
      }
    });

    // Check custom plugins (assume enabled if config exists)
    Object.keys(this.config.customPlugins).forEach((name) => {
      enabled.push(name);
    });

    return enabled;
  }

  /**
   * Validate plugin configuration by name
   */
  validatePluginConfig(pluginName: string, config: unknown): boolean {
    try {
      switch (pluginName) {
        case "tailwindOptimizer":
          TailwindOptimizerConfigSchema.parse(config);
          return true;
        case "cssMinifier":
          CssMinifierConfigSchema.parse(config);
          return true;
        case "sourceMapper":
          SourceMapperConfigSchema.parse(config);
          return true;
        default:
          // For custom plugins, we can't validate structure
          // but we can check basic requirements
          return config !== null && config !== undefined;
      }
    } catch (error) {
      this.logger.warn("Plugin configuration validation failed", {
        pluginName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Export configuration as JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Load configuration from JSON
   */
  loadConfig(jsonConfig: string): void {
    try {
      const parsed = JSON.parse(jsonConfig);
      this.config = this.validateAndNormalize(parsed);
      this.logger.info("Configuration loaded from JSON");
    } catch (error) {
      this.logger.error("Failed to load configuration from JSON", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Merge with another configuration
   */
  mergeConfig(otherConfig: Partial<PostCSSIntegrationConfig>): void {
    const merged = {
      processor: { ...this.config.processor, ...otherConfig.processor },
      pluginSystem: {
        ...this.config.pluginSystem,
        ...otherConfig.pluginSystem,
      },
      builtinPlugins: {
        tailwindOptimizer: {
          ...this.config.builtinPlugins.tailwindOptimizer,
          ...otherConfig.builtinPlugins?.tailwindOptimizer,
        },
        cssMinifier: {
          ...this.config.builtinPlugins.cssMinifier,
          ...otherConfig.builtinPlugins?.cssMinifier,
        },
        sourceMapper: {
          ...this.config.builtinPlugins.sourceMapper,
          ...otherConfig.builtinPlugins?.sourceMapper,
        },
      },
      customPlugins: {
        ...this.config.customPlugins,
        ...otherConfig.customPlugins,
      },
    };

    this.config = this.validateAndNormalize(merged);
    this.logger.debug("Configuration merged");
  }

  /**
   * Create configuration from main Enigma config
   */
  static fromEnigmaConfig(enigmaConfig: EnigmaConfig): PluginConfigManager {
    // Extract PostCSS-related configuration from the main config
    const postcssConfig: Partial<PostCSSIntegrationConfig> = {
      processor: {
        enabled: true,
        enableSourceMaps: true,
        optimizationLevel: "standard",
        enablePerformanceMonitoring: true,
      },
      pluginSystem: {
        enabled: true,
        enableValidation: true,
        enableMetrics: true,
      },
      builtinPlugins: {
        tailwindOptimizer: {
          enabled: true,
          extractUtilities: true,
          optimizeFrequentClasses: true,
        },
        cssMinifier: {
          enabled: true,
          removeComments: true,
          removeWhitespace: true,
        },
        sourceMapper: {
          enabled: true,
          generateSourceMap: true,
        },
      },
    };

    return new PluginConfigManager(postcssConfig);
  }
}

/**
 * Create a default plugin configuration manager
 */
export function createDefaultPluginConfigManager(): PluginConfigManager {
  return new PluginConfigManager();
}

/**
 * Validate a complete PostCSS integration configuration
 */
export function validatePostCSSConfig(
  config: unknown,
): PostCSSIntegrationConfig {
  return PostCSSIntegrationConfigSchema.parse(config);
}
