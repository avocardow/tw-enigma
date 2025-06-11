/**
 * Plugin Manager - Plugin System Architecture
 * Handles plugin lifecycle management, discovery, registration, and dependency resolution
 */

import { readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { pathToFileURL } from 'url';
import { createLogger } from '../logger.js';
import { isEnigmaPlugin, validatePluginConfig } from './postcssPlugin.js';
import type {
  PluginManager,
  EnigmaPlugin,
  PluginConfig,
  ValidationResult,
  PluginDiscoveryOptions
} from '../types/plugins.js';

const logger = createLogger('plugin-manager');

/**
 * Plugin manager implementation
 */
export class EnigmaPluginManager implements PluginManager {
  private plugins = new Map<string, EnigmaPlugin>();
  private pluginConfigs = new Map<string, PluginConfig>();
  private pluginCache = new Map<string, any>();
  private resourceMonitor = new Map<string, {
    memoryUsage: number;
    executionTime: number;
    lastAccess: number;
  }>();

  constructor() {
    logger.debug('Plugin manager initialized');
  }

  /**
   * Register a plugin
   */
  register(plugin: EnigmaPlugin): void {
    if (!isEnigmaPlugin(plugin)) {
      throw new Error('Invalid plugin: must implement EnigmaPlugin interface');
    }

    if (this.plugins.has(plugin.meta.name)) {
      logger.warn(`Plugin ${plugin.meta.name} is already registered, overwriting`);
    }

    this.plugins.set(plugin.meta.name, plugin);
    logger.debug(`Plugin ${plugin.meta.name} registered`, {
      version: plugin.meta.version,
      description: plugin.meta.description
    });
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginName: string): void {
    if (!this.plugins.has(pluginName)) {
      logger.warn(`Plugin ${pluginName} is not registered`);
      return;
    }

    const plugin = this.plugins.get(pluginName);
    if (plugin?.cleanup) {
      plugin.cleanup().catch(error => {
        logger.error(`Error during plugin ${pluginName} cleanup`, { error });
      });
    }

    this.plugins.delete(pluginName);
    this.pluginConfigs.delete(pluginName);
    this.pluginCache.delete(pluginName);
    this.resourceMonitor.delete(pluginName);

    logger.debug(`Plugin ${pluginName} unregistered`);
  }

  /**
   * Get registered plugin
   */
  getPlugin(pluginName: string): EnigmaPlugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): EnigmaPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if plugin is registered
   */
  hasPlugin(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  /**
   * Validate plugin dependencies
   */
  validateDependencies(pluginNames: string[]): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      missingDependencies: [],
      circularDependencies: [],
      conflicts: []
    };

    // Check if all plugins exist
    for (const name of pluginNames) {
      if (!this.plugins.has(name)) {
        result.errors.push(`Plugin ${name} is not registered`);
        result.valid = false;
      }
    }

    // Check dependencies
    for (const name of pluginNames) {
      const plugin = this.plugins.get(name);
      if (!plugin) continue;

      // Check plugin dependencies
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!pluginNames.includes(dep)) {
            result.missingDependencies.push(dep);
            result.errors.push(`Plugin ${name} requires dependency ${dep} which is not enabled`);
            result.valid = false;
          }
        }
      }

      // Check conflicts
      if (plugin.conflicts) {
        for (const conflict of plugin.conflicts) {
          if (pluginNames.includes(conflict)) {
            result.conflicts.push({
              plugin1: name,
              plugin2: conflict,
              reason: `Plugin ${name} conflicts with ${conflict}`
            });
            result.errors.push(`Plugin ${name} conflicts with ${conflict}`);
            result.valid = false;
          }
        }
      }
    }

    // Check for circular dependencies
    const circular = this.detectCircularDependencies(pluginNames);
    if (circular.length > 0) {
      result.circularDependencies = circular;
      result.errors.push(`Circular dependencies detected: ${circular.map(c => c.join(' -> ')).join(', ')}`);
      result.valid = false;
    }

    logger.debug('Plugin dependency validation completed', {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    });

    return result;
  }

  /**
   * Get execution order for plugins using topological sort
   */
  getExecutionOrder(pluginNames: string[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving ${name}`);
      }

      visiting.add(name);

      const plugin = this.plugins.get(name);
      if (plugin?.dependencies) {
        for (const dep of plugin.dependencies) {
          if (pluginNames.includes(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    // Sort by priority first (lower priority = earlier execution)
    const sortedNames = [...pluginNames].sort((a, b) => {
      const configA = this.pluginConfigs.get(a);
      const configB = this.pluginConfigs.get(b);
      const priorityA = configA?.priority ?? 50;
      const priorityB = configB?.priority ?? 50;
      return priorityA - priorityB;
    });

    for (const name of sortedNames) {
      visit(name);
    }

    logger.debug('Plugin execution order determined', { order: result });
    return result;
  }

  /**
   * Initialize all plugins
   */
  async initializePlugins(configs: PluginConfig[]): Promise<void> {
    logger.debug('Initializing plugins', { count: configs.length });

    for (const config of configs) {
      try {
        // Validate configuration
        const validatedConfig = validatePluginConfig(config);
        
        const plugin = this.plugins.get(config.name);
        if (!plugin) {
          logger.warn(`Plugin ${config.name} not found, skipping initialization`);
          continue;
        }

        // Initialize plugin
        await plugin.initialize(validatedConfig);
        this.pluginConfigs.set(config.name, validatedConfig);

        // Initialize resource monitoring
        this.resourceMonitor.set(config.name, {
          memoryUsage: 0,
          executionTime: 0,
          lastAccess: Date.now()
        });

        logger.debug(`Plugin ${config.name} initialized successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to initialize plugin ${config.name}`, { error: errorMessage });
        throw new Error(`Plugin initialization failed for ${config.name}: ${errorMessage}`);
      }
    }

    logger.info('All plugins initialized successfully');
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    logger.debug('Cleaning up all plugins');

    const cleanupPromises = Array.from(this.plugins.entries()).map(async ([name, plugin]) => {
      try {
        if (plugin.cleanup) {
          await plugin.cleanup();
        }
        logger.debug(`Plugin ${name} cleaned up successfully`);
      } catch (error) {
        logger.error(`Error cleaning up plugin ${name}`, { error });
      }
    });

    await Promise.allSettled(cleanupPromises);

    // Clear all caches and monitors
    this.pluginCache.clear();
    this.resourceMonitor.clear();
    this.pluginConfigs.clear();

    logger.info('Plugin cleanup completed');
  }

  /**
   * Discover plugins from various sources
   */
  async discoverPlugins(options: PluginDiscoveryOptions): Promise<EnigmaPlugin[]> {
    logger.debug('Starting plugin discovery', options);

    const discoveredPlugins: EnigmaPlugin[] = [];

    // Discover from search paths
    for (const searchPath of options.searchPaths) {
      try {
        const plugins = await this.discoverFromDirectory(searchPath);
        discoveredPlugins.push(...plugins);
      } catch (error) {
        logger.warn(`Failed to discover plugins from ${searchPath}`, { error });
      }
    }

    // Discover from npm packages
    if (options.npmPrefixes.length > 0) {
      try {
        const plugins = await this.discoverFromNpm(options.npmPrefixes);
        discoveredPlugins.push(...plugins);
      } catch (error) {
        logger.warn('Failed to discover npm plugins', { error });
      }
    }

    // Load local plugins
    for (const localPlugin of options.localPlugins) {
      try {
        const plugin = await this.loadPluginFromFile(localPlugin);
        if (plugin) {
          discoveredPlugins.push(plugin);
        }
      } catch (error) {
        logger.warn(`Failed to load local plugin ${localPlugin}`, { error });
      }
    }

    // Include built-in plugins
    if (options.includeBuiltins) {
      const builtins = await this.getBuiltinPlugins();
      discoveredPlugins.push(...builtins);
    }

    logger.info(`Plugin discovery completed`, {
      discovered: discoveredPlugins.length,
      plugins: discoveredPlugins.map(p => p.meta.name)
    });

    return discoveredPlugins;
  }

  /**
   * Update resource usage for a plugin
   */
  updateResourceUsage(pluginName: string, memoryUsage: number, executionTime: number): void {
    const monitor = this.resourceMonitor.get(pluginName);
    if (monitor) {
      monitor.memoryUsage = memoryUsage;
      monitor.executionTime = executionTime;
      monitor.lastAccess = Date.now();

      // Log warning if resource usage is high
      if (memoryUsage > 100 * 1024 * 1024) { // 100MB
        logger.warn(`Plugin ${pluginName} is using high memory`, { memoryUsage });
      }

      if (executionTime > 5000) { // 5 seconds
        logger.warn(`Plugin ${pluginName} is taking a long time to execute`, { executionTime });
      }
    }
  }

  /**
   * Get resource usage statistics
   */
  getResourceStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, monitor] of this.resourceMonitor) {
      stats[name] = {
        memoryUsage: monitor.memoryUsage,
        executionTime: monitor.executionTime,
        lastAccess: monitor.lastAccess
      };
    }

    return stats;
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(pluginNames: string[]): string[][] {
    const circular: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (name: string): void => {
      if (path.includes(name)) {
        const cycleStart = path.indexOf(name);
        circular.push([...path.slice(cycleStart), name]);
        return;
      }

      if (visited.has(name)) return;

      visited.add(name);
      path.push(name);

      const plugin = this.plugins.get(name);
      if (plugin?.dependencies) {
        for (const dep of plugin.dependencies) {
          if (pluginNames.includes(dep)) {
            dfs(dep);
          }
        }
      }

      path.pop();
    };

    for (const name of pluginNames) {
      if (!visited.has(name)) {
        dfs(name);
      }
    }

    return circular;
  }

  /**
   * Discover plugins from directory
   */
  private async discoverFromDirectory(searchPath: string): Promise<EnigmaPlugin[]> {
    const plugins: EnigmaPlugin[] = [];

    try {
      const entries = await readdir(searchPath);
      
      for (const entry of entries) {
        const fullPath = join(searchPath, entry);
        const stats = await stat(fullPath);

        if (stats.isFile() && (entry.endsWith('.js') || entry.endsWith('.mjs'))) {
          try {
            const plugin = await this.loadPluginFromFile(fullPath);
            if (plugin) {
              plugins.push(plugin);
            }
          } catch (error) {
            logger.debug(`Failed to load plugin from ${fullPath}`, { error });
          }
        }
      }
    } catch (error) {
      logger.debug(`Cannot read directory ${searchPath}`, { error });
    }

    return plugins;
  }

  /**
   * Discover plugins from npm packages
   */
  private async discoverFromNpm(prefixes: string[]): Promise<EnigmaPlugin[]> {
    const plugins: EnigmaPlugin[] = [];

    // This would typically involve scanning node_modules for packages
    // matching the prefixes (e.g., 'enigma-plugin-', 'postcss-enigma-')
    // For now, we'll return empty array as this requires more complex logic
    
    logger.debug('NPM plugin discovery not yet implemented');
    return plugins;
  }

  /**
   * Load plugin from file
   */
  private async loadPluginFromFile(filePath: string): Promise<EnigmaPlugin | null> {
    try {
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);
      
      // Look for default export or named export
      const plugin = module.default || module.plugin || module;
      
      if (isEnigmaPlugin(plugin)) {
        return plugin;
      }
      
      logger.debug(`File ${filePath} does not export a valid EnigmaPlugin`);
      return null;

    } catch (error) {
      logger.debug(`Failed to load plugin from ${filePath}`, { error });
      return null;
    }
  }

  /**
   * Get built-in plugins
   */
  private async getBuiltinPlugins(): Promise<EnigmaPlugin[]> {
    const plugins: EnigmaPlugin[] = [];

    try {
      // Try to load built-in plugins from plugins directory
      const builtinsPath = join(dirname(new URL(import.meta.url).pathname), 'plugins');
      const builtins = await this.discoverFromDirectory(builtinsPath);
      plugins.push(...builtins);
    } catch (error) {
      logger.debug('No built-in plugins directory found', { error });
    }

    return plugins;
  }
}

/**
 * Create a plugin manager instance
 */
export function createPluginManager(): PluginManager {
  return new EnigmaPluginManager();
}

/**
 * Default plugin discovery options
 */
export function createDefaultDiscoveryOptions(): PluginDiscoveryOptions {
  return {
    searchPaths: ['./plugins', './node_modules'],
    npmPrefixes: ['enigma-plugin-', 'postcss-enigma-'],
    localPlugins: [],
    includeBuiltins: true
  };
} 