import { createLogger } from "../logger";
import { normalizePath } from "../pathUtils";

/**
 * Utility interface for plugin developers
 */
export interface PluginUtils {
  /**
   * Create a logger scoped to the plugin
   */
  createLogger: (name: string) => ReturnType<typeof createLogger>;

  /**
   * Path utilities for safe file operations
   */
  path: {
    normalize: typeof normalizePath;
  };

  /**
   * Validation helpers
   */
  validation: {
    isValidClassName: (className: string) => boolean;
    isTailwindClass: (className: string) => boolean;
  };
}

// Implementation of plugin utilities
export const pluginUtils: PluginUtils = {
  createLogger,
  path: {
    normalize: normalizePath,
  },
  validation: {
    isValidClassName: (className: string) =>
      /^[a-zA-Z_][\w-]*$/.test(className),
    isTailwindClass: (className: string) =>
      /^(sm:|md:|lg:|xl:|2xl:)?(hover:|focus:|active:|disabled:)?[\w-]+$/.test(
        className,
      ),
  },
};
