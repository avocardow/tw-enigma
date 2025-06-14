import {
  BaseEnigmaPlugin,
  EnigmaPluginContext,
  PluginConfig,
} from "../types/plugins";
import { createLogger } from "../logger";

/**
 * Basic Plugin Template
 *
 * This template provides a starting point for creating new Enigma plugins.
 * Copy this file and modify it to implement your custom plugin.
 */

interface MyCustomPluginOptions {
  // Define your plugin-specific options here
  enabled?: boolean;
  customOption?: string;
  threshold?: number;
}

export class MyCustomPlugin extends BaseEnigmaPlugin {
  readonly meta = {
    name: "my-custom-plugin",
    version: "1.0.0",
    description: "A custom plugin for CSS optimization",
    author: "Your Name",
    tags: ["css", "optimization", "custom"],
  };

  private options: MyCustomPluginOptions;
  private logger = createLogger(`plugin:${this.meta.name}`);

  constructor(config: PluginConfig = {}) {
    super(config);

    // Merge default options with provided config
    this.options = {
      enabled: true,
      customOption: "default-value",
      threshold: 100,
      ...config.options,
    };
  }

  /**
   * Initialize the plugin
   * This method is called when the plugin is loaded
   */
  async initialize(context: EnigmaPluginContext): Promise<void> {
    this.logger.info("Initializing custom plugin", {
      options: this.options,
      projectPath: context.projectPath,
    });

    // Perform any initialization logic here
    // e.g., validate configuration, set up resources, etc.

    if (!this.options.enabled) {
      this.logger.warn("Plugin is disabled");
      return;
    }

    // Example: validate required options
    if (!this.options.customOption) {
      throw new Error("customOption is required");
    }
  }

  /**
   * Process CSS content
   * This is the main processing method for CSS optimization
   */
  async processCss(css: string, context: EnigmaPluginContext): Promise<string> {
    this.logger.debug("Processing CSS", {
      inputLength: css.length,
      filePath: context.filePath,
    });

    // Implement your CSS processing logic here
    // Example: simple comment removal
    let processedCss = css;

    if (this.options.enabled) {
      // Remove single-line comments (example processing)
      processedCss = css.replace(/\/\*.*?\*\//g, "");

      this.logger.debug("CSS processing completed", {
        originalLength: css.length,
        processedLength: processedCss.length,
        reduction: css.length - processedCss.length,
      });
    }

    return processedCss;
  }

  /**
   * Validate plugin configuration
   * This method is called to ensure the plugin is properly configured
   */
  async validate(context: EnigmaPluginContext): Promise<boolean> {
    this.logger.debug("Validating plugin configuration");

    // Implement validation logic here
    try {
      // Example validations
      if (this.options.threshold && this.options.threshold < 0) {
        this.logger.error("Threshold must be non-negative");
        return false;
      }

      if (
        this.options.customOption &&
        typeof this.options.customOption !== "string"
      ) {
        this.logger.error("customOption must be a string");
        return false;
      }

      this.logger.debug("Plugin validation passed");
      return true;
    } catch (error) {
      this.logger.error("Plugin validation failed", { error });
      return false;
    }
  }

  /**
   * Get plugin health status
   * This method provides information about the plugin's current state
   */
  getHealth(): Record<string, unknown> {
    return {
      name: this.meta.name,
      version: this.meta.version,
      enabled: this.options.enabled,
      lastProcessed: new Date().toISOString(),
      options: this.options,
      status: this.options.enabled ? "active" : "disabled",
    };
  }

  /**
   * Cleanup resources
   * This method is called when the plugin is being unloaded
   */
  async cleanup(): Promise<void> {
    this.logger.info("Cleaning up custom plugin");

    // Implement cleanup logic here
    // e.g., close file handles, clear caches, etc.
  }
}

/**
 * Export the plugin class for use
 * This is the standard export format for Enigma plugins
 */
export default MyCustomPlugin;

/**
 * Plugin factory function (alternative export method)
 * This allows for more complex initialization if needed
 */
export function createMyCustomPlugin(
  options: MyCustomPluginOptions = {},
): MyCustomPlugin {
  return new MyCustomPlugin({ options });
}

/**
 * Plugin metadata for discovery
 * This helps the plugin system identify and categorize the plugin
 */
export const pluginInfo = {
  name: "my-custom-plugin",
  version: "1.0.0",
  description: "A template for creating custom Enigma plugins",
  author: "Enigma Team",
  tags: ["template", "example"],
  requiresConfig: false,
  defaultEnabled: true,
};
