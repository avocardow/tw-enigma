/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Plugin API Integration Layer
 * Provides the main API contract, hooks, and validation for the PostCSS plugin system
 */

import { z } from "zod";
import { createLogger } from "./logger.ts";
import { EnigmaPostCSSProcessor } from "./postcssIntegration.ts";
import {
  createPluginManager,
  createDefaultDiscoveryOptions,
} from "./core/pluginManager.ts";
import { createTailwindOptimizer } from "./core/plugins/tailwindOptimizer.ts";
import { createCssMinifier } from "./core/plugins/cssMinifier.ts";
import { createSourceMapper } from "./core/plugins/sourceMapper.ts";
import type {
  PluginManager,
  EnigmaPlugin,
  PluginConfig,
  ProcessorConfig,
  ProcessingResult,
  ValidationResult,
} from "./types/plugins.ts";
import type { EnigmaConfig } from "./config.ts";
import type {
  FrequencyAnalysisResult,
} from "./patternAnalysis.ts";

const logger = createLogger("plugin-api");

/**
 * Plugin API configuration schema
 */
export const PluginApiConfigSchema = z.object({
  plugins: z
    .array(
      z.object({
        name: z.string(),
        enabled: z.boolean().optional().default(true),
        options: z.record(z.unknown()).optional().default({}),
      }),
    )
    .optional()
    .default([]),
  discovery: z
    .object({
      autoDiscover: z.boolean().optional().default(true),
      searchPaths: z.array(z.string()).optional().default(["./plugins"]),
      includeBuiltins: z.boolean().optional().default(true),
    })
    .optional(),
  processing: z
    .object({
      parallel: z.boolean().optional().default(false),
      maxConcurrency: z.number().min(1).max(10).optional().default(3),
      timeout: z.number().min(1000).max(30000).optional().default(10000),
      retryAttempts: z.number().min(0).max(5).optional().default(1),
    })
    .optional(),
});

type PluginApiConfig = z.infer<typeof PluginApiConfigSchema>;

/**
 * Plugin API hooks for lifecycle events
 */
export interface ApiHooks {
  onPluginRegistered?: (plugin: EnigmaPlugin) => void;
  onPluginUnregistered?: (pluginName: string) => void;
  onProcessingStart?: (inputCss: string, config: ProcessorConfig) => void;
  onProcessingComplete?: (result: ProcessingResult) => void;
  onError?: (error: Error, context: string) => void;
}

/**
 * Main Plugin API class
 */
export class EnigmaPluginApi {
  private manager: PluginManager;
  private processor: EnigmaPostCSSProcessor;
  private hooks: ApiHooks = {};
  private isInitialized = false;

  constructor(config?: EnigmaConfig) {
    this.manager = createPluginManager();
    this.processor = new EnigmaPostCSSProcessor(this.manager, config);

    logger.debug("Plugin API initialized");
  }

  /**
   * Initialize the plugin system
   */
  async initialize(config: PluginApiConfig = {}): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Plugin API already initialized");
      return;
    }

    try {
      logger.info("Initializing plugin API", { config });

      // Validate configuration
      const validatedConfig = PluginApiConfigSchema.parse(config);

      // Register built-in plugins if enabled
      if (validatedConfig.discovery?.includeBuiltins !== false) {
        await this.registerBuiltinPlugins();
      }

      // Discover and register plugins
      if (validatedConfig.discovery?.autoDiscover !== false) {
        await this.discoverPlugins(validatedConfig.discovery);
      }

      // Register explicitly configured plugins
      for (const pluginConfig of validatedConfig.plugins) {
        if (pluginConfig.enabled && this.manager.hasPlugin(pluginConfig.name)) {
          await this.configurePlugin(pluginConfig.name, pluginConfig.options);
        }
      }

      // Initialize plugins
      await this.manager.initializePlugins(validatedConfig.plugins);

      this.isInitialized = true;
      logger.info("Plugin API initialization completed");
    } catch (error) {
      logger.error("Plugin API initialization failed", { error });
      throw new Error(
        `Plugin API initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: EnigmaPlugin): void {
    try {
      this.manager.register(plugin);

      // Trigger hook
      if (this.hooks.onPluginRegistered) {
        this.hooks.onPluginRegistered(plugin);
      }

      logger.debug(`Plugin ${plugin.meta.name} registered via API`);
    } catch (error) {
      logger.error(`Failed to register plugin ${plugin.meta.name}`, { error });
      throw error;
    }
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(pluginName: string): void {
    try {
      this.manager.unregister(pluginName);

      // Trigger hook
      if (this.hooks.onPluginUnregistered) {
        this.hooks.onPluginUnregistered(pluginName);
      }

      logger.debug(`Plugin ${pluginName} unregistered via API`);
    } catch (error) {
      logger.error(`Failed to unregister plugin ${pluginName}`, { error });
      throw error;
    }
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): EnigmaPlugin[] {
    return this.manager.getAllPlugins();
  }

  /**
   * Check if a plugin is registered
   */
  hasPlugin(pluginName: string): boolean {
    return this.manager.hasPlugin(pluginName);
  }

  /**
   * Process CSS through the plugin pipeline
   */
  async processCss(
    css: string,
    options: {
      filename?: string;
      frequencyData?: FrequencyAnalysisResult;
      patternData?: any;
      sourceMap?: boolean;
    } = {},
  ): Promise<ProcessingResult> {
    if (!this.isInitialized) {
      throw new Error("Plugin API not initialized. Call initialize() first.");
    }

    try {
      // Trigger start hook
      const processorConfig: ProcessorConfig = {
        filename: options.filename,
        sourceMap: options.sourceMap ?? false,
        frequencyData: options.frequencyData,
        patternData: options.patternData,
      };

      if (this.hooks.onProcessingStart) {
        this.hooks.onProcessingStart(css, processorConfig);
      }

      // Process through PostCSS pipeline
      const result = await this.processor.process(css, processorConfig);

      // Trigger completion hook
      if (this.hooks.onProcessingComplete) {
        this.hooks.onProcessingComplete(result);
      }

      logger.debug("CSS processing completed via API", {
        inputSize: css.length,
        outputSize: result.css.length,
        duration: result.processingTime,
      });

      return result;
    } catch (error) {
      logger.error("CSS processing failed via API", { error });

      // Trigger error hook
      if (this.hooks.onError) {
        this.hooks.onError(
          error instanceof Error ? error : new Error(String(error)),
          "processCss",
        );
      }

      throw error;
    }
  }

  /**
   * Validate plugin configuration
   */
  validateConfig(config: PluginApiConfig): ValidationResult {
    try {
      PluginApiConfigSchema.parse(config);

      // Additional plugin-specific validation
      const pluginNames = config.plugins?.map((p) => p.name) || [];
      const validation = this.manager.validateDependencies(pluginNames);

      return validation;
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        missingDependencies: [],
        circularDependencies: [],
        conflicts: [],
      };
    }
  }

  /**
   * Set API hooks
   */
  setHooks(hooks: Partial<ApiHooks>): void {
    this.hooks = { ...this.hooks, ...hooks };
    logger.debug("API hooks updated", {
      hookCount: Object.keys(this.hooks).length,
    });
  }

  /**
   * Get plugin execution statistics
   */
  getStats(): Record<string, any> {
    return {
      registeredPlugins: this.manager.getAllPlugins().length,
      resourceStats: this.manager.getResourceStats(),
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.manager.cleanup();
      this.isInitialized = false;
      this.hooks = {};

      logger.info("Plugin API cleanup completed");
    } catch (error) {
      logger.error("Plugin API cleanup failed", { error });
      throw error;
    }
  }

  /**
   * Register built-in plugins
   */
  private async registerBuiltinPlugins(): Promise<void> {
    const builtinPlugins = [
      createTailwindOptimizer(),
      createCssMinifier(),
      createSourceMapper(),
    ];

    for (const plugin of builtinPlugins) {
      try {
        this.manager.register(plugin);
        logger.debug(`Built-in plugin ${plugin.meta.name} registered`);
      } catch (error) {
        logger.warn(`Failed to register built-in plugin ${plugin.meta.name}`, {
          error,
        });
      }
    }
  }

  /**
   * Discover plugins from configured sources
   */
  private async discoverPlugins(discoveryConfig: any): Promise<void> {
    try {
      const discoveryOptions = {
        ...createDefaultDiscoveryOptions(),
        ...discoveryConfig,
      };

      const discoveredPlugins =
        await this.manager.discoverPlugins(discoveryOptions);

      for (const plugin of discoveredPlugins) {
        if (!this.manager.hasPlugin(plugin.meta.name)) {
          this.manager.register(plugin);
        }
      }

      logger.debug(`Discovered ${discoveredPlugins.length} plugins`);
    } catch (error) {
      logger.warn("Plugin discovery failed", { error });
    }
  }

  /**
   * Configure a specific plugin
   */
  private async configurePlugin(
    pluginName: string,
    options: Record<string, unknown>,
  ): Promise<void> {
    const plugin = this.manager.getPlugin(pluginName);
    if (!plugin) {
      logger.warn(`Plugin ${pluginName} not found for configuration`);
      return;
    }

    // Plugin configuration is handled during initialization
    logger.debug(`Plugin ${pluginName} configured`, { options });
  }
}

/**
 * Create a new Plugin API instance
 */
export function createPluginApi(config?: EnigmaConfig): EnigmaPluginApi {
  return new EnigmaPluginApi(config);
}

/**
 * Default plugin configuration
 */
export function createDefaultPluginConfig(): PluginApiConfig {
  return {
    plugins: [
      { name: "tailwind-optimizer", enabled: true },
      { name: "css-minifier", enabled: true },
      { name: "source-mapper", enabled: true },
    ],
    discovery: {
      autoDiscover: true,
      includeBuiltins: true,
    },
    processing: {
      parallel: false,
      maxConcurrency: 3,
      timeout: 10000,
    },
  };
}

// Export types for external use
export type {
  PluginApiConfig,
  ApiHooks,
  EnigmaPlugin,
  PluginConfig,
  ProcessorConfig,
  ProcessingResult,
  ValidationResult,
};
