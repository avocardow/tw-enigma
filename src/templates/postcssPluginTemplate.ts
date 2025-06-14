import {
  BasePostCSSEnigmaPlugin,
  EnigmaPluginContext,
  PluginConfig,
} from "../types/plugins";
import { createLogger } from "../logger";
import { Root, Rule, Declaration, AtRule } from "postcss";

/**
 * PostCSS Plugin Template
 *
 * This template provides a starting point for creating PostCSS-based Enigma plugins.
 * Copy this file and modify it to implement your custom PostCSS optimization.
 */

interface MyPostCSSPluginOptions {
  // Define your plugin-specific options here
  enabled?: boolean;
  removeComments?: boolean;
  optimizeSelectors?: boolean;
  minifyValues?: boolean;
}

export class MyPostCSSPlugin extends BasePostCSSEnigmaPlugin {
  readonly meta = {
    name: "my-postcss-plugin",
    version: "1.0.0",
    description: "A custom PostCSS plugin for advanced CSS optimization",
    author: "Your Name",
    tags: ["postcss", "css", "optimization", "custom"],
  };

  private options: MyPostCSSPluginOptions;
  private logger = createLogger(`plugin:${this.meta.name}`);

  constructor(config: PluginConfig = {}) {
    super(config);

    // Merge default options with provided config
    this.options = {
      enabled: true,
      removeComments: true,
      optimizeSelectors: false,
      minifyValues: true,
      ...config.options,
    };
  }

  /**
   * Initialize the plugin
   */
  async initialize(context: EnigmaPluginContext): Promise<void> {
    this.logger.info("Initializing PostCSS plugin", {
      options: this.options,
      projectPath: context.projectPath,
    });

    if (!this.options.enabled) {
      this.logger.warn("Plugin is disabled");
      return;
    }
  }

  /**
   * Create the PostCSS plugin instance
   * This is the main method that returns the actual PostCSS plugin
   */
  createPostCSSPlugin() {
    const options = this.options;
    const logger = this.logger;

    return {
      postcssPlugin: this.meta.name,
      Once(root: Root) {
        logger.debug("Processing CSS with PostCSS", {
          totalRules: root.nodes.length,
        });

        // Remove comments if enabled
        if (options.removeComments) {
          root.walkComments((comment) => {
            comment.remove();
          });
        }

        // Optimize selectors if enabled
        if (options.optimizeSelectors) {
          root.walkRules((rule: Rule) => {
            // Example: remove duplicate selectors
            const selectors = rule.selector.split(",").map((s) => s.trim());
            const uniqueSelectors = [...new Set(selectors)];
            if (uniqueSelectors.length !== selectors.length) {
              rule.selector = uniqueSelectors.join(", ");
              logger.debug("Optimized selectors", {
                original: selectors.length,
                optimized: uniqueSelectors.length,
              });
            }
          });
        }

        // Minify values if enabled
        if (options.minifyValues) {
          root.walkDecls((decl: Declaration) => {
            // Example: minify margin/padding values
            if (["margin", "padding"].includes(decl.prop)) {
              const values = decl.value.split(/\s+/);
              if (
                values.length === 4 &&
                values[0] === values[2] &&
                values[1] === values[3]
              ) {
                // Convert "10px 5px 10px 5px" to "10px 5px"
                decl.value = `${values[0]} ${values[1]}`;
              } else if (
                values.length === 4 &&
                values[0] === values[1] &&
                values[1] === values[2] &&
                values[2] === values[3]
              ) {
                // Convert "10px 10px 10px 10px" to "10px"
                decl.value = values[0];
              }
            }

            // Example: remove unnecessary quotes from font-family
            if (decl.prop === "font-family") {
              decl.value = decl.value.replace(
                /["']([^"']+)["']/g,
                (match, font) => {
                  // Only remove quotes if font name doesn't contain spaces
                  return font.includes(" ") ? match : font;
                },
              );
            }
          });
        }

        logger.debug("PostCSS processing completed");
      },

      // Handle at-rules (like @media, @keyframes)
      AtRule: {
        media(atRule: AtRule) {
          if (options.optimizeSelectors) {
            // Example: optimize media queries
            logger.debug("Processing media query", { params: atRule.params });
          }
        },
        keyframes(atRule: AtRule) {
          if (options.minifyValues) {
            // Example: optimize keyframe values
            logger.debug("Processing keyframes", { name: atRule.params });
          }
        },
      },
    };
  }

  /**
   * Process CSS using PostCSS
   */
  async processCss(css: string, context: EnigmaPluginContext): Promise<string> {
    this.logger.debug("Processing CSS with PostCSS plugin", {
      inputLength: css.length,
      filePath: context.filePath,
    });

    if (!this.options.enabled) {
      return css;
    }

    try {
      const postcss = await import("postcss");
      const plugin = this.createPostCSSPlugin();

      const result = await postcss.default([plugin]).process(css, {
        from: context.filePath || "unknown",
        to: context.filePath || "unknown",
      });

      this.logger.debug("PostCSS processing completed", {
        originalLength: css.length,
        processedLength: result.css.length,
        warnings: result.warnings().length,
      });

      // Log any warnings
      result.warnings().forEach((warning) => {
        this.logger.warn("PostCSS warning", {
          message: warning.toString(),
          line: warning.line,
          column: warning.column,
        });
      });

      return result.css;
    } catch (error) {
      this.logger.error("PostCSS processing failed", { error });
      throw error;
    }
  }

  /**
   * Validate plugin configuration
   */
  async validate(context: EnigmaPluginContext): Promise<boolean> {
    this.logger.debug("Validating PostCSS plugin configuration");

    try {
      // Check if PostCSS is available
      await import("postcss");

      // Validate options
      if (typeof this.options.enabled !== "boolean") {
        this.logger.error("enabled option must be a boolean");
        return false;
      }

      if (typeof this.options.removeComments !== "boolean") {
        this.logger.error("removeComments option must be a boolean");
        return false;
      }

      this.logger.debug("PostCSS plugin validation passed");
      return true;
    } catch (error) {
      this.logger.error("PostCSS plugin validation failed", { error });
      return false;
    }
  }

  /**
   * Get plugin health status
   */
  getHealth(): Record<string, unknown> {
    return {
      name: this.meta.name,
      version: this.meta.version,
      enabled: this.options.enabled,
      type: "postcss",
      lastProcessed: new Date().toISOString(),
      options: this.options,
      status: this.options.enabled ? "active" : "disabled",
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.logger.info("Cleaning up PostCSS plugin");
    // Implement cleanup logic if needed
  }
}

/**
 * Export the plugin class
 */
export default MyPostCSSPlugin;

/**
 * Plugin factory function
 */
export function createMyPostCSSPlugin(
  options: MyPostCSSPluginOptions = {},
): MyPostCSSPlugin {
  return new MyPostCSSPlugin({ options });
}

/**
 * Plugin metadata for discovery
 */
export const pluginInfo = {
  name: "my-postcss-plugin",
  version: "1.0.0",
  description: "A template for creating PostCSS-based Enigma plugins",
  author: "Enigma Team",
  tags: ["template", "postcss", "example"],
  requiresConfig: false,
  defaultEnabled: true,
  type: "postcss",
};
