/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * PostCSS Integration Layer
 * Provides the main processor factory and CSS processing pipeline
 */

import postcss, { type Root, type Result, type ProcessOptions } from "postcss";
import { readFile, writeFile } from "fs/promises";
import { createLogger } from "./logger.ts";
import { createPluginMetrics } from "./core/postcssPlugin.ts";
import type {
  ProcessorConfig,
  ProcessingResult,
  PluginConfig,
  PluginContext,
  PluginManager,
  EnigmaPlugin,
} from "./types/plugins.ts";
import type { EnigmaConfig } from "./config.ts";
import type {
  FrequencyAnalysisResult,

} from "./patternAnalysis.ts";

const logger = createLogger("postcss-integration");

/**
 * PostCSS processor for Enigma
 */
export class EnigmaPostCSSProcessor {
  private pluginManager: PluginManager;
  private config: EnigmaConfig;

  constructor(pluginManager: PluginManager, config: EnigmaConfig) {
    this.pluginManager = pluginManager;
    this.config = config;
  }

  /**
   * Process CSS content with configured plugins
   */
  async processCss(
    css: string,
    options: ProcessorConfig,
    frequencyData?: FrequencyAnalysisResult,
    patternData?: any,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const pluginResults: ProcessingResult["pluginResults"] = [];
    const warnings: ProcessingResult["warnings"] = [];
    const dependencies: string[] = [];
    let peakMemory = this.getMemoryUsage();

    try {
      // Validate and prepare plugins
      const enabledPlugins = options.plugins.filter((p) => p.enabled !== false);
      const validationResult = this.pluginManager.validateDependencies(
        enabledPlugins.map((p) => p.name),
      );

      if (!validationResult.valid) {
        throw new Error(
          `Plugin validation failed: ${validationResult.errors.join(", ")}`,
        );
      }

      // Get execution order
      const executionOrder = this.pluginManager.getExecutionOrder(
        enabledPlugins.map((p) => p.name),
      );

      // Create PostCSS plugins array
      const postcssPlugins = [];

      for (const pluginName of executionOrder) {
        const pluginConfig = enabledPlugins.find((p) => p.name === pluginName);
        if (!pluginConfig) continue;

        const plugin = this.pluginManager.getPlugin(pluginName);
        if (!plugin) {
          logger.warn(`Plugin ${pluginName} not found, skipping`);
          continue;
        }

        try {
          // Create plugin metrics
          const metrics = createPluginMetrics(pluginName);

          // Create plugin context
          const context: Omit<PluginContext, "result"> = {
            config: pluginConfig,
            frequencyData,
            patternData,
            projectConfig: this.config,
            metrics,
            logger: createLogger(`plugin:${pluginName}`),
          };

          // Create PostCSS plugin instance
          const postcssPlugin = plugin.createPlugin({
            ...context,
            result: {} as Result, // Will be set by PostCSS
          });

          // Wrap plugin to capture context
          const wrappedPlugin =
            typeof postcssPlugin === "function"
              ? postcssPlugin({ context })
              : postcssPlugin;

          postcssPlugins.push(wrappedPlugin);

          logger.debug(`Added plugin ${pluginName} to processing pipeline`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(
            `Failed to create plugin ${pluginName}: ${errorMessage}`,
          );
          warnings.push({
            plugin: pluginName,
            text: `Plugin creation failed: ${errorMessage}`,
          });
        }
      }

      // Configure PostCSS options
      const processOptions: ProcessOptions = {
        from: options.from,
        to: options.to,
        map: options.sourceMap
          ? {
              inline: options.sourceMap === "inline",
              annotation:
                typeof options.sourceMap === "string"
                  ? options.sourceMap
                  : undefined,
            }
          : false,
        parser: options.parser,
        stringifier: options.stringifier,
        syntax: options.syntax,
      };

      // Process CSS
      logger.debug("Starting PostCSS processing", {
        pluginCount: postcssPlugins.length,
        options: processOptions,
      });

      const processor = postcss(postcssPlugins);
      const result = await processor.process(css, processOptions);

      // Update memory usage
      peakMemory = Math.max(peakMemory, this.getMemoryUsage());

      // Collect plugin results and metrics
      for (const pluginName of executionOrder) {
        const plugin = this.pluginManager.getPlugin(pluginName);
        if (plugin) {
          // Note: In a real implementation, we'd need to track metrics per plugin
          // For now, we'll create basic results
          pluginResults.push({
            pluginName,
            processingTime: 0, // Would be tracked during execution
            transformations: 0, // Would be tracked during execution
            warnings: [],
            dependencies: [],
            success: true,
          });
        }
      }

      // Collect warnings from PostCSS result
      result.warnings().forEach((warning) => {
        warnings.push({
          plugin: warning.plugin || "postcss",
          text: warning.text,
          line: warning.line,
          column: warning.column,
        });
      });

      // Collect dependencies from messages
      result.messages.forEach((message) => {
        if (message.type === "dependency" && message.file) {
          dependencies.push(message.file);
        }
      });

      const totalTime = Date.now() - startTime;

      logger.debug("PostCSS processing completed", {
        totalTime,
        warningCount: warnings.length,
        dependencyCount: dependencies.length,
      });

      return {
        css: result.css,
        map: result.map?.toString(),
        pluginResults,
        warnings,
        dependencies,
        totalTime,
        peakMemory: peakMemory > 0 ? peakMemory : undefined,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;

      // Handle PostCSS-specific errors
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "CssSyntaxError"
      ) {
        const cssError = error as any;
        logger.error("CSS syntax error during processing", {
          message: cssError.message,
          line: cssError.line,
          column: cssError.column,
          source: cssError.source,
        });

        throw new Error(
          `CSS Syntax Error: ${cssError.message}${
            cssError.line ? ` at line ${cssError.line}` : ""
          }${cssError.column ? `, column ${cssError.column}` : ""}`,
        );
      }

      logger.error("PostCSS processing failed", {
        error: error instanceof Error ? error.message : String(error),
        totalTime,
      });

      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Process CSS from file
   */
  async processFile(
    inputPath: string,
    outputPath: string,
    options: Omit<ProcessorConfig, "from" | "to">,
    frequencyData?: FrequencyAnalysisResult,
    patternData?: any,
  ): Promise<ProcessingResult> {
    try {
      logger.debug("Processing CSS file", { inputPath, outputPath });

      const css = await readFile(inputPath, "utf-8");

      const result = await this.processCss(
        css,
        {
          ...options,
          from: inputPath,
          to: outputPath,
        },
        frequencyData,
        patternData,
      );

      // Write output file
      await writeFile(outputPath, result.css, "utf-8");

      // Write source map if available
      if (result.map && options.outputSourceMap) {
        const mapPath =
          typeof options.outputSourceMap === "string"
            ? options.outputSourceMap
            : `${outputPath}.map`;
        await writeFile(mapPath, result.map, "utf-8");
      }

      logger.debug("CSS file processing completed", {
        inputPath,
        outputPath,
        outputSize: result.css.length,
      });

      return result;
    } catch (error) {
      logger.error("File processing failed", {
        inputPath,
        outputPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
}

/**
 * Create a PostCSS processor instance
 */
export function createProcessor(
  pluginManager: PluginManager,
  config: EnigmaConfig,
): EnigmaPostCSSProcessor {
  return new EnigmaPostCSSProcessor(pluginManager, config);
}

/**
 * Utility function to validate PostCSS processor configuration
 */
export function validateProcessorConfig(config: unknown): ProcessorConfig {
  if (!config || typeof config !== "object") {
    throw new Error("Processor configuration must be an object");
  }

  const typedConfig = config as any;

  if (!Array.isArray(typedConfig.plugins)) {
    throw new Error("Processor configuration must include plugins array");
  }

  // Validate each plugin config
  typedConfig.plugins.forEach((plugin: unknown, index: number) => {
    if (!plugin || typeof plugin !== "object") {
      throw new Error(`Plugin at index ${index} must be an object`);
    }

    const typedPlugin = plugin as any;
    if (!typedPlugin.name || typeof typedPlugin.name !== "string") {
      throw new Error(`Plugin at index ${index} must have a string name`);
    }
  });

  return typedConfig as ProcessorConfig;
}

/**
 * Helper function to create default processor configuration
 */
export function createDefaultProcessorConfig(): ProcessorConfig {
  return {
    plugins: [],
    sourceMap: false,
    outputSourceMap: false,
  };
}
