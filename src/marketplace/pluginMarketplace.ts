import { createLogger } from "../logger";
import { EnigmaPlugin, PluginConfig } from "../types/plugins";
import { PluginRegistry } from "../registry/pluginRegistry";
import * as fs from "fs/promises";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  downloadUrl: string;
  homepage?: string;
  repository?: string;
  license: string;
  dependencies: string[];
  size: number;
  downloads: number;
  rating: number;
  lastUpdated: string;
  verified: boolean;
}

interface MarketplaceSearchOptions {
  query?: string;
  tags?: string[];
  author?: string;
  verified?: boolean;
  minRating?: number;
  sortBy?: "downloads" | "rating" | "updated" | "name";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  [key: string]: unknown; // Add index signature for compatibility with ErrorContext
}

interface MarketplaceConfig {
  registryUrl: string;
  cacheDir: string;
  cacheTtl: number;
  enableCache: boolean;
  verifySignatures: boolean;
  allowUnverified: boolean;
  downloadTimeout: number;
  maxFileSize: number;
}

interface PluginInstallOptions {
  version?: string;
  force?: boolean;
  skipDependencies?: boolean;
  installPath?: string;
}

/**
 * Plugin Marketplace for discovering and installing plugins
 */
export class PluginMarketplace {
  private logger = createLogger("plugin-marketplace");
  private config: Required<MarketplaceConfig>;
  private cache = new Map<
    string,
    { data: MarketplacePlugin[]; timestamp: number }
  >();

  constructor(
    private registry: PluginRegistry,
    config: Partial<MarketplaceConfig> = {},
  ) {
    this.config = {
      registryUrl: "https://registry.enigma-plugins.dev",
      cacheDir: "./cache/marketplace",
      cacheTtl: 3600000, // 1 hour
      enableCache: true,
      verifySignatures: true,
      allowUnverified: false,
      downloadTimeout: 30000, // 30 seconds
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ...config,
    };

    this.logger.info("Plugin marketplace initialized", {
      registryUrl: this.config.registryUrl,
      cacheEnabled: this.config.enableCache,
    });

    this.ensureCacheDir();
  }

  /**
   * Search for plugins in the marketplace
   */
  async searchPlugins(
    options: MarketplaceSearchOptions = {},
  ): Promise<MarketplacePlugin[]> {
    this.logger.info("Searching marketplace plugins", options);

    try {
      const cacheKey = this.getCacheKey("search", options);

      // Check cache first
      if (this.config.enableCache) {
        const cached = this.getCachedData(cacheKey);
        if (cached) {
          this.logger.debug("Returning cached search results");
          return cached;
        }
      }

      // Build search URL
      const searchUrl = this.buildSearchUrl(options);

      // Fetch from marketplace
      const plugins = await this.fetchPlugins(searchUrl);

      // Cache results
      if (this.config.enableCache) {
        this.setCachedData(cacheKey, plugins);
      }

      this.logger.info("Found marketplace plugins", { count: plugins.length });
      return plugins;
    } catch (error) {
      this.logger.error("Failed to search marketplace", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get detailed information about a specific plugin
   */
  async getPluginInfo(
    name: string,
    version?: string,
  ): Promise<MarketplacePlugin | null> {
    this.logger.info("Getting plugin info", { name, version });

    try {
      const cacheKey = this.getCacheKey("info", { name, version });

      // Check cache first
      if (this.config.enableCache) {
        const cached = this.getCachedData(cacheKey);
        if (cached && cached.length > 0) {
          return cached[0];
        }
      }

      // Fetch from marketplace
      const url = `${this.config.registryUrl}/plugins/${name}${version ? `/${version}` : ""}`;
      const plugins = await this.fetchPlugins(url);

      const plugin = plugins.length > 0 ? plugins[0] : null;

      // Cache result
      if (this.config.enableCache && plugin) {
        this.setCachedData(cacheKey, [plugin]);
      }

      return plugin;
    } catch (error) {
      this.logger.error("Failed to get plugin info", {
        name,
        version,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Install a plugin from the marketplace
   */
  async installPlugin(
    name: string,
    options: PluginInstallOptions = {},
  ): Promise<EnigmaPlugin> {
    this.logger.info("Installing plugin from marketplace", { name, options });

    try {
      // Get plugin info
      const pluginInfo = await this.getPluginInfo(name, options.version);
      if (!pluginInfo) {
        throw new Error(`Plugin ${name} not found in marketplace`);
      }

      // Verify plugin if required
      if (
        this.config.verifySignatures &&
        !pluginInfo.verified &&
        !this.config.allowUnverified
      ) {
        throw new Error(
          `Plugin ${name} is not verified and unverified plugins are not allowed`,
        );
      }

      // Check if already installed
      const existingPlugin = this.registry.getPlugin(name, pluginInfo.version);
      if (existingPlugin && !options.force) {
        this.logger.info("Plugin already installed", {
          name,
          version: pluginInfo.version,
        });
        return existingPlugin;
      }

      // Install dependencies first
      if (!options.skipDependencies && pluginInfo.dependencies.length > 0) {
        await this.installDependencies(pluginInfo.dependencies);
      }

      // Download plugin
      const pluginPath = await this.downloadPlugin(
        pluginInfo,
        options.installPath,
      );

      // Load and validate plugin
      const plugin = await this.loadPluginFromFile(pluginPath);

      // Create plugin config
      const config: PluginConfig = {
        name: plugin.meta.name,
        enabled: true,
        priority: 100,
        options: {},
      };

      // Register with registry
      await this.registry.registerPlugin(plugin, config, pluginPath);

      this.logger.info("Plugin installed successfully", {
        name: plugin.meta.name,
        version: plugin.meta.version,
        path: pluginPath,
      });

      return plugin;
    } catch (error) {
      this.logger.error("Failed to install plugin", {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(name: string, version?: string): Promise<void> {
    this.logger.info("Uninstalling plugin", { name, version });

    try {
      // Check dependencies
      const dependents = this.registry.getDependents(name);
      if (dependents.length > 0) {
        throw new Error(
          `Cannot uninstall ${name}: required by ${dependents.join(", ")}`,
        );
      }

      // Unregister from registry
      await this.registry.unregisterPlugin(name, version);

      // Remove plugin files
      await this.removePluginFiles(name, version);

      this.logger.info("Plugin uninstalled successfully", { name, version });
    } catch (error) {
      this.logger.error("Failed to uninstall plugin", {
        name,
        version,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update a plugin to the latest version
   */
  async updatePlugin(name: string): Promise<EnigmaPlugin | null> {
    this.logger.info("Updating plugin", { name });

    try {
      // Get current plugin
      const currentPlugin = this.registry.getPlugin(name);
      if (!currentPlugin) {
        throw new Error(`Plugin ${name} is not installed`);
      }

      // Get latest version from marketplace
      const latestInfo = await this.getPluginInfo(name);
      if (!latestInfo) {
        throw new Error(`Plugin ${name} not found in marketplace`);
      }

      // Check if update is needed
      if (currentPlugin.meta.version === latestInfo.version) {
        this.logger.info("Plugin is already up to date", {
          name,
          version: latestInfo.version,
        });
        return currentPlugin;
      }

      // Install latest version
      const updatedPlugin = await this.installPlugin(name, {
        version: latestInfo.version,
        force: true,
      });

      this.logger.info("Plugin updated successfully", {
        name,
        from: currentPlugin.meta.version,
        to: updatedPlugin.meta.version,
      });

      return updatedPlugin;
    } catch (error) {
      this.logger.error("Failed to update plugin", {
        name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * List installed plugins with marketplace info
   */
  async listInstalledPlugins(): Promise<
    Array<{
      plugin: EnigmaPlugin;
      marketplaceInfo?: MarketplacePlugin;
      updateAvailable: boolean;
    }>
  > {
    this.logger.info("Listing installed plugins with marketplace info");

    const results: Array<{
      plugin: EnigmaPlugin;
      marketplaceInfo?: MarketplacePlugin;
      updateAvailable: boolean;
    }> = [];

    // Get all installed plugins from registry
    const installedPlugins = this.registry.searchPlugins({ status: "active" });

    for (const entry of installedPlugins) {
      const plugin = entry.plugin;

      // Get marketplace info
      const marketplaceInfo = await this.getPluginInfo(plugin.meta.name);

      // Check if update is available
      const updateAvailable = marketplaceInfo
        ? this.isUpdateAvailable(plugin.meta.version, marketplaceInfo.version)
        : false;

      results.push({
        plugin,
        marketplaceInfo: marketplaceInfo || undefined,
        updateAvailable,
      });
    }

    return results;
  }

  /**
   * Clear marketplace cache
   */
  async clearCache(): Promise<void> {
    this.logger.info("Clearing marketplace cache");

    this.cache.clear();

    try {
      await fs.rm(this.config.cacheDir, { recursive: true, force: true });
      await this.ensureCacheDir();
    } catch (error) {
      this.logger.warn("Failed to clear cache directory", { error });
    }
  }

  /**
   * Get marketplace statistics
   */
  getStats(): Record<string, unknown> {
    return {
      registryUrl: this.config.registryUrl,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      verifySignatures: this.config.verifySignatures,
      allowUnverified: this.config.allowUnverified,
    };
  }

  /**
   * Build search URL with parameters
   */
  private buildSearchUrl(options: MarketplaceSearchOptions): string {
    const url = new URL(`${this.config.registryUrl}/search`);

    if (options.query) url.searchParams.set("q", options.query);
    if (options.tags) url.searchParams.set("tags", options.tags.join(","));
    if (options.author) url.searchParams.set("author", options.author);
    if (options.verified !== undefined)
      url.searchParams.set("verified", String(options.verified));
    if (options.minRating)
      url.searchParams.set("minRating", String(options.minRating));
    if (options.sortBy) url.searchParams.set("sortBy", options.sortBy);
    if (options.sortOrder) url.searchParams.set("sortOrder", options.sortOrder);
    if (options.limit) url.searchParams.set("limit", String(options.limit));
    if (options.offset) url.searchParams.set("offset", String(options.offset));

    return url.toString();
  }

  /**
   * Fetch plugins from URL
   */
  private async fetchPlugins(url: string): Promise<MarketplacePlugin[]> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === "https:" ? https : http;

      const request = client.get(
        url,
        { timeout: this.config.downloadTimeout },
        (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `HTTP ${response.statusCode}: ${response.statusMessage}`,
              ),
            );
            return;
          }

          let data = "";
          response.on("data", (chunk) => {
            data += chunk;
          });

          response.on("end", () => {
            try {
              const plugins = JSON.parse(data);
              resolve(Array.isArray(plugins) ? plugins : [plugins]);
            } catch (error) {
              reject(new Error(`Invalid JSON response: ${error}`));
            }
          });
        },
      );

      request.on("error", reject);
      request.on("timeout", () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    });
  }

  /**
   * Download plugin from marketplace
   */
  private async downloadPlugin(
    pluginInfo: MarketplacePlugin,
    installPath?: string,
  ): Promise<string> {
    const targetDir = installPath || path.join(this.config.cacheDir, "plugins");
    const targetPath = path.join(
      targetDir,
      `${pluginInfo.name}-${pluginInfo.version}.js`,
    );

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const urlObj = new URL(pluginInfo.downloadUrl);
      const client = urlObj.protocol === "https:" ? https : http;

      const request = client.get(
        pluginInfo.downloadUrl,
        { timeout: this.config.downloadTimeout },
        (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `HTTP ${response.statusCode}: ${response.statusMessage}`,
              ),
            );
            return;
          }

          const fileStream = require("fs").createWriteStream(targetPath);
          let downloadedSize = 0;

          response.on("data", (chunk) => {
            downloadedSize += chunk.length;
            if (downloadedSize > this.config.maxFileSize) {
              fileStream.destroy();
              reject(new Error(`File too large: ${downloadedSize} bytes`));
              return;
            }
          });

          response.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close();
            resolve(targetPath);
          });

          fileStream.on("error", reject);
        },
      );

      request.on("error", reject);
      request.on("timeout", () => {
        request.destroy();
        reject(new Error("Download timeout"));
      });
    });
  }

  /**
   * Install plugin dependencies
   */
  private async installDependencies(dependencies: string[]): Promise<void> {
    this.logger.info("Installing plugin dependencies", { dependencies });

    for (const dep of dependencies) {
      try {
        const existingPlugin = this.registry.getPlugin(dep);
        if (!existingPlugin) {
          await this.installPlugin(dep);
        }
      } catch (error) {
        this.logger.warn("Failed to install dependency", {
          dependency: dep,
          error,
        });
        throw new Error(`Failed to install dependency ${dep}: ${error}`);
      }
    }
  }

  /**
   * Load plugin from file
   */
  private async loadPluginFromFile(filePath: string): Promise<EnigmaPlugin> {
    try {
      // Clear require cache for fresh load
      delete require.cache[require.resolve(filePath)];

      const pluginModule = require(filePath);
      const plugin = pluginModule.default || pluginModule;

      if (!plugin || typeof plugin !== "object") {
        throw new Error(`Invalid plugin export from ${filePath}`);
      }

      return plugin;
    } catch (error) {
      throw new Error(`Failed to load plugin from ${filePath}: ${error}`);
    }
  }

  /**
   * Remove plugin files
   */
  private async removePluginFiles(
    name: string,
    version?: string,
  ): Promise<void> {
    const pluginDir = path.join(this.config.cacheDir, "plugins");

    try {
      const files = await fs.readdir(pluginDir);
      const pattern = version ? `${name}-${version}.js` : `${name}-`;

      for (const file of files) {
        if (file.startsWith(pattern)) {
          await fs.unlink(path.join(pluginDir, file));
          this.logger.debug("Removed plugin file", { file });
        }
      }
    } catch (error) {
      this.logger.warn("Failed to remove plugin files", {
        name,
        version,
        error,
      });
    }
  }

  /**
   * Check if update is available
   */
  private isUpdateAvailable(
    currentVersion: string,
    latestVersion: string,
  ): boolean {
    // Simple version comparison (assumes semantic versioning)
    const current = currentVersion.split(".").map(Number);
    const latest = latestVersion.split(".").map(Number);

    for (let i = 0; i < Math.max(current.length, latest.length); i++) {
      const currentPart = current[i] || 0;
      const latestPart = latest[i] || 0;

      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }

    return false;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(type: string, params: Record<string, unknown>): string {
    return `${type}:${JSON.stringify(params)}`;
  }

  /**
   * Get cached data
   */
  private getCachedData(key: string): MarketplacePlugin[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheTtl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data
   */
  private setCachedData(key: string, data: MarketplacePlugin[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      this.logger.warn("Failed to create cache directory", {
        dir: this.config.cacheDir,
        error,
      });
    }
  }
}

/**
 * Create a new plugin marketplace instance
 */
export function createPluginMarketplace(
  registry: PluginRegistry,
  config?: Partial<MarketplaceConfig>,
): PluginMarketplace {
  return new PluginMarketplace(registry, config);
}
