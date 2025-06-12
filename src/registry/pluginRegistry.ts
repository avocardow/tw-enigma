import { createLogger } from "../logger";
import { EnigmaPlugin, PluginConfig } from "../types/plugins";
import * as fs from "fs/promises";
import * as path from "path";
import { watch } from "fs";
import { EventEmitter } from "events";

interface PluginRegistryEntry {
  plugin: EnigmaPlugin;
  config: PluginConfig;
  filePath?: string;
  lastModified?: Date;
  dependencies: string[];
  dependents: string[];
  status: "active" | "inactive" | "error" | "loading";
  version: string;
  checksum?: string;
}

interface PluginSearchOptions {
  name?: string;
  version?: string;
  tags?: string[];
  author?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

interface PluginRegistryConfig {
  enableHotReload?: boolean;
  enableVersioning?: boolean;
  enableDependencyTracking?: boolean;
  registryPath?: string;
  watchPaths?: string[];
  maxVersions?: number;
}

/**
 * Advanced Plugin Registry with hot-reload, versioning, and dependency management
 */
export class PluginRegistry extends EventEmitter {
  private logger = createLogger("plugin-registry");
  private plugins = new Map<string, Map<string, PluginRegistryEntry>>();
  private watchers = new Map<string, ReturnType<typeof watch>>();
  private config: Required<PluginRegistryConfig>;
  private dependencyGraph = new Map<string, Set<string>>();

  constructor(config: PluginRegistryConfig = {}) {
    super();

    this.config = {
      enableHotReload: true,
      enableVersioning: true,
      enableDependencyTracking: true,
      registryPath: "./plugins",
      watchPaths: ["./plugins", "./src/core/plugins"],
      maxVersions: 5,
      ...config,
    };

    this.logger.info("Plugin registry initialized", {
      config: this.config,
    });

    if (this.config.enableHotReload) {
      this.setupHotReload();
    }
  }

  /**
   * Register a plugin with the registry
   */
  async registerPlugin(
    plugin: EnigmaPlugin,
    config: PluginConfig,
    filePath?: string,
  ): Promise<void> {
    const pluginName = plugin.meta.name;
    const version = plugin.meta.version;

    this.logger.info("Registering plugin", {
      name: pluginName,
      version,
      filePath,
    });

    try {
      // Validate plugin
      await this.validatePlugin(plugin);

      // Create registry entry
      const entry: PluginRegistryEntry = {
        plugin,
        config,
        filePath,
        lastModified: new Date(),
        dependencies: this.extractDependencies(plugin),
        dependents: [],
        status: "loading",
        version,
        checksum: filePath ? await this.calculateChecksum(filePath) : undefined,
      };

      // Store in registry
      if (!this.plugins.has(pluginName)) {
        this.plugins.set(pluginName, new Map());
      }

      const pluginVersions = this.plugins.get(pluginName)!;
      pluginVersions.set(version, entry);

      // Manage version limits
      if (
        this.config.enableVersioning &&
        pluginVersions.size > this.config.maxVersions
      ) {
        await this.cleanupOldVersions(pluginName);
      }

      // Update dependency graph
      if (this.config.enableDependencyTracking) {
        await this.updateDependencyGraph(pluginName, entry.dependencies);
      }

      // Initialize plugin
      if (plugin.initialize) {
        await plugin.initialize(config);
      }

      entry.status = "active";

      this.logger.info("Plugin registered successfully", {
        name: pluginName,
        version,
        dependencies: entry.dependencies.length,
      });

      this.emit("plugin:registered", { name: pluginName, version, entry });
    } catch (error) {
      this.logger.error("Failed to register plugin", {
        name: pluginName,
        version,
        error: error instanceof Error ? error.message : String(error),
      });

      // Store failed entry for debugging
      const failedEntry: PluginRegistryEntry = {
        plugin,
        config,
        filePath,
        lastModified: new Date(),
        dependencies: [],
        dependents: [],
        status: "error",
        version,
      };

      if (!this.plugins.has(pluginName)) {
        this.plugins.set(pluginName, new Map());
      }
      this.plugins.get(pluginName)!.set(version, failedEntry);

      this.emit("plugin:error", { name: pluginName, version, error });
      throw error;
    }
  }

  /**
   * Unregister a plugin from the registry
   */
  async unregisterPlugin(name: string, version?: string): Promise<void> {
    this.logger.info("Unregistering plugin", { name, version });

    const pluginVersions = this.plugins.get(name);
    if (!pluginVersions) {
      throw new Error(`Plugin ${name} not found in registry`);
    }

    if (version) {
      // Unregister specific version
      const entry = pluginVersions.get(version);
      if (!entry) {
        throw new Error(`Plugin ${name}@${version} not found in registry`);
      }

      await this.cleanupPlugin(entry);
      pluginVersions.delete(version);

      if (pluginVersions.size === 0) {
        this.plugins.delete(name);
      }
    } else {
      // Unregister all versions
      for (const entry of pluginVersions.values()) {
        await this.cleanupPlugin(entry);
      }
      this.plugins.delete(name);
    }

    // Update dependency graph
    if (this.config.enableDependencyTracking) {
      this.dependencyGraph.delete(name);
      // Remove from other plugins' dependencies
      for (const deps of this.dependencyGraph.values()) {
        deps.delete(name);
      }
    }

    this.emit("plugin:unregistered", { name, version });
    this.logger.info("Plugin unregistered", { name, version });
  }

  /**
   * Get a plugin from the registry
   */
  getPlugin(name: string, version?: string): EnigmaPlugin | undefined {
    const pluginVersions = this.plugins.get(name);
    if (!pluginVersions) {
      return undefined;
    }

    if (version) {
      return pluginVersions.get(version)?.plugin;
    }

    // Return latest version
    const versions = Array.from(pluginVersions.keys()).sort().reverse();
    return versions.length > 0
      ? pluginVersions.get(versions[0])?.plugin
      : undefined;
  }

  /**
   * Search plugins in the registry
   */
  searchPlugins(options: PluginSearchOptions = {}): PluginRegistryEntry[] {
    const results: PluginRegistryEntry[] = [];

    for (const [pluginName, versions] of this.plugins) {
      for (const [version, entry] of versions) {
        // Apply filters
        if (options.name && !pluginName.includes(options.name)) continue;
        if (options.version && version !== options.version) continue;
        if (options.status && entry.status !== options.status) continue;
        if (options.author && entry.plugin.meta.author !== options.author)
          continue;

        if (options.tags && options.tags.length > 0) {
          const pluginTags = entry.plugin.meta.tags || [];
          const hasMatchingTag = options.tags.some((tag) =>
            pluginTags.includes(tag),
          );
          if (!hasMatchingTag) continue;
        }

        results.push(entry);
      }
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get plugin dependency tree
   */
  getDependencyTree(name: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const traverse = (pluginName: string) => {
      if (visited.has(pluginName)) return;
      visited.add(pluginName);

      const dependencies = this.dependencyGraph.get(pluginName) || new Set();
      for (const dep of dependencies) {
        traverse(dep);
        result.push(dep);
      }
    };

    traverse(name);
    return result;
  }

  /**
   * Get plugins that depend on a given plugin
   */
  getDependents(name: string): string[] {
    const dependents: string[] = [];

    for (const [pluginName, dependencies] of this.dependencyGraph) {
      if (dependencies.has(name)) {
        dependents.push(pluginName);
      }
    }

    return dependents;
  }

  /**
   * Reload a plugin (hot-reload)
   */
  async reloadPlugin(name: string, version?: string): Promise<void> {
    this.logger.info("Reloading plugin", { name, version });

    const pluginVersions = this.plugins.get(name);
    if (!pluginVersions) {
      throw new Error(`Plugin ${name} not found in registry`);
    }

    const targetVersion =
      version ||
      Array.from(pluginVersions.keys()).sort((a, b) =>
        this.compareVersions(b, a),
      )[0];

    const entry = pluginVersions.get(targetVersion);
    if (!entry || !entry.filePath) {
      throw new Error(
        `Plugin ${name}@${targetVersion} cannot be reloaded (no file path)`,
      );
    }

    try {
      // Check if file has changed
      const currentChecksum = await this.calculateChecksum(entry.filePath);
      if (currentChecksum === entry.checksum) {
        this.logger.debug("Plugin file unchanged, skipping reload", {
          name,
          version: targetVersion,
        });
        return;
      }

      // Cleanup current plugin
      await this.cleanupPlugin(entry);

      // Reload plugin from file
      const newPlugin = await this.loadPluginFromFile(entry.filePath);

      // Re-register with updated plugin
      await this.registerPlugin(newPlugin, entry.config, entry.filePath);

      this.emit("plugin:reloaded", { name, version: targetVersion });
      this.logger.info("Plugin reloaded successfully", {
        name,
        version: targetVersion,
      });
    } catch (error) {
      this.logger.error("Failed to reload plugin", {
        name,
        version: targetVersion,
        error: error instanceof Error ? error.message : String(error),
      });

      // Mark as error state
      entry.status = "error";
      this.emit("plugin:reload-error", { name, version: targetVersion, error });
      throw error;
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): Record<string, unknown> {
    const totalPlugins = this.plugins.size;
    let totalVersions = 0;
    let activePlugins = 0;
    let errorPlugins = 0;

    for (const versions of this.plugins.values()) {
      totalVersions += versions.size;
      for (const entry of versions.values()) {
        if (entry.status === "active") activePlugins++;
        if (entry.status === "error") errorPlugins++;
      }
    }

    return {
      totalPlugins,
      totalVersions,
      activePlugins,
      errorPlugins,
      dependencyEdges: Array.from(this.dependencyGraph.values()).reduce(
        (sum, deps) => sum + deps.size,
        0,
      ),
      watchedPaths: this.watchers.size,
      hotReloadEnabled: this.config.enableHotReload,
      versioningEnabled: this.config.enableVersioning,
    };
  }

  /**
   * Export registry to JSON
   */
  async exportRegistry(filePath: string): Promise<void> {
    const exportData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      plugins: Array.from(this.plugins.entries()).map(([name, versions]) => ({
        name,
        versions: Array.from(versions.entries()).map(([version, entry]) => ({
          version,
          meta: entry.plugin.meta,
          config: entry.config,
          filePath: entry.filePath,
          status: entry.status,
          dependencies: entry.dependencies,
          lastModified: entry.lastModified,
        })),
      })),
    };

    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
    this.logger.info("Registry exported", {
      filePath,
      plugins: this.plugins.size,
    });
  }

  /**
   * Cleanup registry resources
   */
  async cleanup(): Promise<void> {
    this.logger.info("Cleaning up plugin registry");

    // Stop file watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    // Cleanup all plugins
    for (const versions of this.plugins.values()) {
      for (const entry of versions.values()) {
        await this.cleanupPlugin(entry);
      }
    }

    this.plugins.clear();
    this.dependencyGraph.clear();
    this.removeAllListeners();

    this.logger.info("Plugin registry cleanup completed");
  }

  /**
   * Setup hot-reload file watching
   */
  private setupHotReload(): void {
    if (!this.config.enableHotReload) return;

    this.logger.info("Setting up hot-reload", {
      watchPaths: this.config.watchPaths,
    });

    for (const watchPath of this.config.watchPaths) {
      try {
        const watcher = watch(
          watchPath,
          { recursive: true },
          async (eventType, filename) => {
            if (
              !filename ||
              (!filename.endsWith(".js") && !filename.endsWith(".ts"))
            )
              return;

            const fullPath = path.join(watchPath, filename);
            this.logger.debug("File change detected", {
              eventType,
              path: fullPath,
            });
          },
        );

        this.watchers.set(watchPath, watcher);
      } catch (error) {
        this.logger.warn("Failed to setup watcher for path", {
          watchPath,
          error,
        });
      }
    }
  }

  /**
   * Validate plugin before registration
   */
  private async validatePlugin(plugin: EnigmaPlugin): Promise<void> {
    if (!plugin.meta || !plugin.meta.name || !plugin.meta.version) {
      throw new Error(
        "Plugin must have valid meta information (name and version)",
      );
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(plugin.meta.name)) {
      throw new Error(
        "Plugin name must contain only alphanumeric characters, hyphens, and underscores",
      );
    }

    if (!/^\d+\.\d+\.\d+/.test(plugin.meta.version)) {
      throw new Error("Plugin version must follow semantic versioning (x.y.z)");
    }
  }

  /**
   * Extract dependencies from plugin
   */
  private extractDependencies(plugin: EnigmaPlugin): string[] {
    // Check if plugin has dependencies property
    if ("dependencies" in plugin && Array.isArray(plugin.dependencies)) {
      return plugin.dependencies as string[];
    }
    return [];
  }

  /**
   * Update dependency graph
   */
  private async updateDependencyGraph(
    pluginName: string,
    dependencies: string[],
  ): Promise<void> {
    this.dependencyGraph.set(pluginName, new Set(dependencies));

    // Update dependents
    for (const [name, versions] of this.plugins) {
      for (const entry of versions.values()) {
        if (entry.dependencies.includes(pluginName)) {
          entry.dependents.push(pluginName);
        }
      }
    }
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const crypto = await import("crypto");
      return crypto.createHash("sha256").update(content).digest("hex");
    } catch (error) {
      this.logger.warn("Failed to calculate checksum", { filePath, error });
      return "";
    }
  }

  /**
   * Load plugin from file
   */
  private async loadPluginFromFile(filePath: string): Promise<EnigmaPlugin> {
    // Clear require cache for hot-reload
    delete require.cache[require.resolve(filePath)];

    const pluginModule = require(filePath);
    const plugin = pluginModule.default || pluginModule;

    if (!plugin || typeof plugin !== "object") {
      throw new Error(`Invalid plugin export from ${filePath}`);
    }

    return plugin;
  }

  /**
   * Cleanup old plugin versions
   */
  private async cleanupOldVersions(pluginName: string): Promise<void> {
    const versions = this.plugins.get(pluginName);
    if (!versions || versions.size <= this.config.maxVersions) return;

    const sortedVersions = Array.from(versions.keys()).sort();
    const versionsToRemove = sortedVersions.slice(
      0,
      versions.size - this.config.maxVersions,
    );

    for (const version of versionsToRemove) {
      const entry = versions.get(version);
      if (entry) {
        await this.cleanupPlugin(entry);
        versions.delete(version);
        this.logger.debug("Removed old plugin version", {
          name: pluginName,
          version,
        });
      }
    }
  }

  /**
   * Cleanup individual plugin
   */
  private async cleanupPlugin(entry: PluginRegistryEntry): Promise<void> {
    try {
      if (entry.plugin.cleanup) {
        await entry.plugin.cleanup();
      }
    } catch (error) {
      this.logger.warn("Plugin cleanup failed", {
        name: entry.plugin.meta.name,
        version: entry.version,
        error,
      });
    }
  }
}

/**
 * Create a new plugin registry instance
 */
export function createPluginRegistry(
  config: PluginRegistryConfig = {},
): PluginRegistry {
  return new PluginRegistry(config);
}

/**
 * Global plugin registry instance
 */
let globalRegistry: PluginRegistry | null = null;

/**
 * Get or create global plugin registry
 */
export function getGlobalRegistry(
  config?: PluginRegistryConfig,
): PluginRegistry {
  if (!globalRegistry) {
    globalRegistry = createPluginRegistry(config);
  }
  return globalRegistry;
}
