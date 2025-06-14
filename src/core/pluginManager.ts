/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Plugin Manager - Enhanced Plugin System Architecture
 * Handles plugin lifecycle management, discovery, registration, dependency resolution,
 * security sandboxing, and error handling with circuit breaker pattern
 */

import { readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { pathToFileURL } from "url";
import { createLogger } from "../logger.ts";
import { isEnigmaPlugin, validatePluginConfig } from "./postcssPlugin.ts";
import {
  PluginSandbox,
  createPluginSandbox,
  PluginPermission,
  type SandboxConfig,
} from "../security/pluginSandbox.ts";
import {
  PluginErrorHandler,
  createPluginErrorHandler,
  type ErrorHandlerConfig,
  type PluginHealth,
} from "../errorHandler/pluginErrorHandler.ts";
import type {
  PluginManager,
  EnigmaPlugin,
  PluginConfig,
  ValidationResult,
  PluginDiscoveryOptions,
  PluginResult,
} from "../types/plugins.ts";

const logger = createLogger("plugin-manager");

/**
 * Enhanced plugin execution options
 */
export interface PluginExecutionOptions {
  timeout?: number;
  sandbox?: boolean;
  permissions?: PluginPermission[];
  retryOnFailure?: boolean;
  fallbackOnError?: boolean;
}

/**
 * Plugin execution context with security and monitoring
 */
export interface PluginExecutionContext {
  pluginName: string;
  sandboxId?: string;
  startTime: number;
  memoryBefore: number;
  config: PluginConfig;
  options: PluginExecutionOptions;
}

/**
 * Enhanced plugin manager implementation with security and error handling
 */
export class EnigmaPluginManager implements PluginManager {
  private plugins = new Map<string, EnigmaPlugin>();
  private pluginConfigs = new Map<string, PluginConfig>();
  private pluginCache = new Map<string, any>();
  private resourceMonitor = new Map<
    string,
    {
      memoryUsage: number;
      executionTime: number;
      lastAccess: number;
    }
  >();

  // Security and error handling systems
  private sandbox: PluginSandbox;
  private errorHandler: PluginErrorHandler;
  private activeSandboxes = new Map<string, string>(); // pluginName -> sandboxId
  private securityEnabled: boolean;

  constructor(
    sandboxConfig?: Partial<SandboxConfig>,
    errorHandlerConfig?: Partial<ErrorHandlerConfig>,
  ) {
    this.sandbox = createPluginSandbox(sandboxConfig);
    this.errorHandler = createPluginErrorHandler(errorHandlerConfig);
    this.securityEnabled = sandboxConfig?.enabled !== false;

    // Set up event listeners
    this.setupEventListeners();

    logger.debug("Enhanced plugin manager initialized", {
      securityEnabled: this.securityEnabled,
      sandboxIsolation: sandboxConfig?.isolationLevel || "basic",
      errorHandling: errorHandlerConfig?.enabled !== false,
    });
  }

  /**
   * Register a plugin with security validation
   */
  register(plugin: EnigmaPlugin): void {
    if (!this.isValidEnigmaPlugin(plugin)) {
      throw new Error("Invalid plugin: must implement EnigmaPlugin interface");
    }

    if (this.plugins.has(plugin.meta.name)) {
      logger.warn(
        `Plugin ${plugin.meta.name} is already registered, overwriting`,
      );
    }

    // Security validation for external plugins
    if (this.securityEnabled && !this.isBuiltinPlugin(plugin.meta.name)) {
      this.validatePluginSecurity(plugin);
    }

    this.plugins.set(plugin.meta.name, plugin);

    // Initialize resource monitor for the plugin
    this.resourceMonitor.set(plugin.meta.name, {
      memoryUsage: 0,
      executionTime: 0,
      lastAccess: Date.now(),
    });

    // Auto-configure plugin with default config if not already configured
    if (!this.pluginConfigs.has(plugin.meta.name)) {
      const defaultConfig: PluginConfig = {
        name: plugin.meta.name,
        version: plugin.meta.version,
        enabled: true,
        priority: 100,
        options: {},
      };
      this.pluginConfigs.set(plugin.meta.name, defaultConfig);
    }

    logger.debug(`Plugin ${plugin.meta.name} registered`, {
      version: plugin.meta.version,
      description: plugin.meta.description,
      security: this.securityEnabled,
    });
  }

  /**
   * Unregister a plugin with cleanup
   */
  unregister(pluginName: string): void {
    if (!this.plugins.has(pluginName)) {
      logger.warn(`Plugin ${pluginName} is not registered`);
      return;
    }

    // Clean up sandbox if exists
    const sandboxId = this.activeSandboxes.get(pluginName);
    if (sandboxId) {
      this.sandbox
        .terminateSandbox(sandboxId, "Plugin unregistered")
        .catch((error) => {
          logger.error(`Error terminating sandbox for ${pluginName}`, {
            error,
          });
        });
      this.activeSandboxes.delete(pluginName);
    }

    // Plugin cleanup
    const plugin = this.plugins.get(pluginName);
    if (plugin?.cleanup) {
      try {
        const cleanupResult = plugin.cleanup();
        if (cleanupResult && typeof cleanupResult.catch === "function") {
          cleanupResult.catch((error) => {
            logger.error(`Error during plugin ${pluginName} cleanup`, {
              error,
            });
          });
        }
      } catch (error) {
        logger.error(`Error during plugin ${pluginName} cleanup`, { error });
      }
    }

    // Clear all data
    this.plugins.delete(pluginName);
    this.pluginConfigs.delete(pluginName);
    this.pluginCache.delete(pluginName);
    this.resourceMonitor.delete(pluginName);

    // Reset error handler stats
    this.errorHandler.resetPluginStats(pluginName);

    logger.debug(`Plugin ${pluginName} unregistered and cleaned up`);
  }

  /**
   * Execute plugin with enhanced security and error handling
   */
  async executePlugin<T = PluginResult>(
    pluginName: string,
    operation: () => Promise<T>,
    options: PluginExecutionOptions = {},
  ): Promise<T | null> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not registered`);
    }

    const config = this.pluginConfigs.get(pluginName);
    if (!config) {
      throw new Error(`Plugin ${pluginName} is not configured`);
    }

    // Create execution context
    const context: PluginExecutionContext = {
      pluginName,
      startTime: performance.now(),
      memoryBefore: process.memoryUsage().heapUsed,
      config,
      options: {
        sandbox: this.securityEnabled,
        retryOnFailure: true,
        fallbackOnError: true,
        ...options,
      },
    };

    // Set up sandbox if required
    if (context.options.sandbox && this.securityEnabled) {
      try {
        const sandboxResult = await this.sandbox.createSandbox(plugin, config);
        context.sandboxId = sandboxResult.sandboxId;
        this.activeSandboxes.set(pluginName, sandboxResult.sandboxId);
      } catch (error) {
        logger.error(`Failed to create sandbox for plugin ${pluginName}`, {
          error,
        });
        if (!context.options.fallbackOnError) {
          throw error;
        }
      }
    }

    try {
      // Execute with error handling and monitoring
      const result = await this.errorHandler.executeWithErrorHandling(
        pluginName,
        async () => {
          if (context.sandboxId) {
            // Execute in sandbox
            return await this.sandbox.executeInSandbox(
              context.sandboxId,
              operation,
              context.options.timeout,
            );
          } else {
            // Execute normally with timeout
            if (context.options.timeout) {
              return await Promise.race([
                operation(),
                this.createTimeoutPromise(context.options.timeout, pluginName),
              ]);
            }
            return await operation();
          }
        },
      );

      // Record successful execution
      this.recordSuccessfulExecution(context);
      return result as T;
    } catch (error) {
      // Record failed execution
      this.recordFailedExecution(context, error);
      throw error;
    } finally {
      // Clean up sandbox if it was created for this execution
      if (context.sandboxId && !this.isLongRunningPlugin(pluginName)) {
        await this.sandbox.terminateSandbox(
          context.sandboxId,
          "Execution completed",
        );
        this.activeSandboxes.delete(pluginName);
      }
    }
  }

  /**
   * Get plugin health status
   */
  getPluginHealth(pluginName: string): PluginHealth {
    return this.errorHandler.getPluginHealth(pluginName);
  }

  /**
   * Get resource statistics for all plugins
   */
  getResourceStats(): Record<
    string,
    { executionTime: number; memoryUsage: number; callCount: number }
  > {
    const stats: Record<
      string,
      { executionTime: number; memoryUsage: number; callCount: number }
    > = {};

    for (const [pluginName] of this.plugins) {
      const health = this.getPluginHealth(pluginName);
      stats[pluginName] = {
        executionTime: health.averageResponseTime || 0,
        memoryUsage: 0, // Would need actual memory tracking
        callCount: health.totalCalls || 0,
      };
    }

    return stats;
  }

  /**
   * Get all plugin health statuses
   */
  getAllPluginHealth(): PluginHealth[] {
    return this.errorHandler.getAllPluginHealth();
  }

  /**
   * Manually disable a plugin
   */
  disablePlugin(pluginName: string, reason: string): void {
    this.errorHandler.disablePlugin(pluginName, reason);
  }

  /**
   * Re-enable a plugin
   */
  enablePlugin(pluginName: string): void {
    this.errorHandler.enablePlugin(pluginName);
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
   * Validate plugin dependencies (enhanced with security checks)
   */
  validateDependencies(pluginNames: string[]): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      missingDependencies: [],
      circularDependencies: [],
      conflicts: [],
    };

    // Check if all plugins exist
    for (const name of pluginNames) {
      if (!this.plugins.has(name)) {
        result.errors.push(`Plugin ${name} is not registered`);
        result.valid = false;
      }
    }

    // Enhanced security validation
    if (this.securityEnabled) {
      for (const name of pluginNames) {
        const health = this.errorHandler.getPluginHealth(name);
        if (health.isDisabled) {
          result.warnings.push(
            `Plugin ${name} is disabled: ${health.disabledReason}`,
          );
        }
        if (!health.isHealthy) {
          result.warnings.push(
            `Plugin ${name} is unhealthy with ${health.consecutiveFailures} consecutive failures`,
          );
        }
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
            result.errors.push(
              `Plugin ${name} requires dependency ${dep} which is not enabled`,
            );
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
              reason: `Plugin ${name} conflicts with ${conflict}`,
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
      result.errors.push(
        `Circular dependencies detected: ${circular.map((c) => c.join(" -> ")).join(", ")}`,
      );
      result.valid = false;
    }

    logger.debug("Enhanced plugin dependency validation completed", {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      securityEnabled: this.securityEnabled,
    });

    return result;
  }

  /**
   * Get execution order for plugins using topological sort (enhanced)
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

    // Sort by priority first, then by health status (prioritize healthy plugins)
    const sortedNames = [...pluginNames].sort((a, b) => {
      const configA = this.pluginConfigs.get(a);
      const configB = this.pluginConfigs.get(b);
      const priorityA = configA?.priority ?? 50;
      const priorityB = configB?.priority ?? 50;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If security is enabled, prioritize healthy plugins
      if (this.securityEnabled) {
        const healthA = this.errorHandler.getPluginHealth(a);
        const healthB = this.errorHandler.getPluginHealth(b);

        if (healthA.isHealthy !== healthB.isHealthy) {
          return healthA.isHealthy ? -1 : 1;
        }
      }

      return 0;
    });

    for (const name of sortedNames) {
      // Skip disabled plugins
      if (this.securityEnabled) {
        const health = this.errorHandler.getPluginHealth(name);
        if (health.isDisabled) {
          logger.warn(`Skipping disabled plugin ${name} in execution order`);
          continue;
        }
      }

      visit(name);
    }

    logger.debug("Enhanced plugin execution order determined", {
      order: result,
      skipped: pluginNames.length - result.length,
    });
    return result;
  }

  /**
   * Initialize all plugins with enhanced error handling
   */
  async initializePlugins(configs: PluginConfig[]): Promise<void> {
    logger.debug("Initializing plugins with enhanced security", {
      count: configs.length,
    });

    // Initialize plugins in dependency order
    const pluginNames = configs.map((c) => c.name);
    const initOrder = this.getExecutionOrder(pluginNames);

    for (const pluginName of initOrder) {
      const config = configs.find((c) => c.name === pluginName);
      if (!config) continue;

      try {
        // Validate configuration
        const validatedConfig = validatePluginConfig(config);

        const plugin = this.plugins.get(config.name);
        if (!plugin) {
          logger.warn(
            `Plugin ${config.name} not found, skipping initialization`,
          );
          continue;
        }

        // Execute initialization with error handling
        await this.executePlugin(
          pluginName,
          async () => {
            if (plugin.initialize) {
              await plugin.initialize(validatedConfig);
            }
            return { success: true };
          },
          {
            timeout: 30000, // 30 second timeout for initialization
            sandbox: this.securityEnabled && !this.isBuiltinPlugin(pluginName),
            retryOnFailure: false, // Don't retry initialization failures
          },
        );

        this.pluginConfigs.set(config.name, validatedConfig);

        // Initialize resource monitoring
        this.resourceMonitor.set(config.name, {
          memoryUsage: 0,
          executionTime: 0,
          lastAccess: Date.now(),
        });

        logger.debug(`Plugin ${config.name} initialized successfully`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Failed to initialize plugin ${config.name}`, {
          error: errorMessage,
        });

        // Disable plugin on initialization failure
        if (this.securityEnabled) {
          this.errorHandler.disablePlugin(
            config.name,
            `Initialization failed: ${errorMessage}`,
          );
        }

        throw new Error(
          `Plugin initialization failed for ${config.name}: ${errorMessage}`,
        );
      }
    }

    logger.info("All plugins initialized successfully with enhanced security");
  }

  /**
   * Cleanup all plugins and security systems
   */
  async cleanup(): Promise<void> {
    logger.debug("Cleaning up enhanced plugin manager");

    // Cleanup all active sandboxes
    const sandboxCleanup = Array.from(this.activeSandboxes.entries()).map(
      async ([pluginName, sandboxId]) => {
        try {
          await this.sandbox.terminateSandbox(sandboxId, "Manager cleanup");
        } catch (error) {
          logger.error(`Error terminating sandbox for ${pluginName}`, {
            error,
          });
        }
      },
    );

    // Cleanup plugins
    const pluginCleanup = Array.from(this.plugins.entries()).map(
      async ([name, plugin]) => {
        try {
          if (plugin.cleanup) {
            await plugin.cleanup();
          }
          logger.debug(`Plugin ${name} cleaned up successfully`);
        } catch (error) {
          logger.error(`Error cleaning up plugin ${name}`, { error });
        }
      },
    );

    // Wait for all cleanups
    await Promise.allSettled([...sandboxCleanup, ...pluginCleanup]);

    // Cleanup security systems
    await Promise.allSettled([
      this.sandbox.cleanup(),
      this.errorHandler.cleanup(),
    ]);

    // Clear all caches and monitors
    this.pluginCache.clear();
    this.resourceMonitor.clear();
    this.pluginConfigs.clear();
    this.activeSandboxes.clear();

    logger.info("Enhanced plugin manager cleanup completed");
  }

  /**
   * Discover plugins from various sources
   */
  async discoverPlugins(
    options: PluginDiscoveryOptions,
  ): Promise<EnigmaPlugin[]> {
    logger.debug("Starting plugin discovery", { options });

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
        logger.warn("Failed to discover npm plugins", { error });
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
      plugins: discoveredPlugins.map((p) => p.meta.name),
    });

    return discoveredPlugins;
  }

  /**
   * Update resource usage for a plugin (enhanced with security monitoring)
   */
  updateResourceUsage(
    pluginName: string,
    memoryUsage: number,
    executionTime: number,
  ): void {
    // Create entry if it doesn't exist
    if (!this.resourceMonitor.has(pluginName)) {
      this.resourceMonitor.set(pluginName, {
        memoryUsage: 0,
        executionTime: 0,
        lastAccess: Date.now(),
      });
    }

    const monitor = this.resourceMonitor.get(pluginName)!;
    monitor.memoryUsage = memoryUsage;
    monitor.executionTime = executionTime;
    monitor.lastAccess = Date.now();

    // Enhanced security monitoring
    if (this.securityEnabled) {
      // Check for suspicious resource usage
      if (memoryUsage > 500 * 1024 * 1024) {
        // 500MB
        logger.warn(`Plugin ${pluginName} is using excessive memory`, {
          memoryUsage,
        });
        this.errorHandler.disablePlugin(
          pluginName,
          "Excessive memory usage detected",
        );
      }

      if (executionTime > 30000) {
        // 30 seconds
        logger.warn(`Plugin ${pluginName} is taking too long to execute`, {
          executionTime,
        });
        // This could indicate a stuck plugin or infinite loop
      }
    }

    // Log warning if resource usage is high (existing logic)
    if (memoryUsage > 100 * 1024 * 1024) {
      // 100MB
      logger.warn(`Plugin ${pluginName} is using high memory`, {
        memoryUsage,
      });
    }

    if (executionTime > 5000) {
      // 5 seconds
      logger.warn(`Plugin ${pluginName} is taking a long time to execute`, {
        executionTime,
      });
    }
  }

  /**
   * Private: Set up event listeners for security systems
   */
  private setupEventListeners(): void {
    if (!this.securityEnabled) return;

    // Listen for security violations
    this.sandbox.on("securityViolation", (violation) => {
      logger.error("Security violation detected", violation);

      // Auto-disable plugin on critical security violations
      if (
        violation.type === "malicious_code" ||
        violation.type === "signature_invalid"
      ) {
        this.errorHandler.disablePlugin(
          violation.pluginName,
          `Security violation: ${violation.type}`,
        );
      }
    });

    // Listen for plugin errors
    this.errorHandler.on("pluginError", (error) => {
      logger.debug("Plugin error handled by error handler", {
        plugin: error.pluginName,
        category: error.category,
        severity: error.severity,
      });
    });

    // Listen for plugin disable/enable events
    this.errorHandler.on("pluginDisabled", ({ pluginName, reason }) => {
      logger.warn(`Plugin ${pluginName} has been disabled`, { reason });

      // Terminate any active sandbox
      const sandboxId = this.activeSandboxes.get(pluginName);
      if (sandboxId) {
        this.sandbox
          .terminateSandbox(sandboxId, "Plugin disabled")
          .catch((error) => {
            logger.error(
              `Error terminating sandbox for disabled plugin ${pluginName}`,
              { error },
            );
          });
        this.activeSandboxes.delete(pluginName);
      }
    });

    this.errorHandler.on("pluginEnabled", ({ pluginName }) => {
      logger.info(`Plugin ${pluginName} has been re-enabled`);
    });
  }

  /**
   * Private: Validate plugin security
   */
  private validatePluginSecurity(plugin: EnigmaPlugin): void {
    // Basic security validation
    if (!plugin.meta.name || !plugin.meta.version) {
      throw new Error("Plugin must have valid name and version");
    }

    // Check for suspicious patterns in plugin code
    if (
      plugin.meta.name.includes("eval") ||
      plugin.meta.name.includes("unsafe")
    ) {
      logger.warn(`Plugin ${plugin.meta.name} has suspicious name patterns`);
    }

    // Additional security checks could be added here
    logger.debug(`Security validation passed for plugin ${plugin.meta.name}`);
  }

  /**
   * Private: Validate enhanced Enigma plugin
   */
  private isValidEnigmaPlugin(value: unknown): value is EnigmaPlugin {
    return (
      typeof value === "object" &&
      value !== null &&
      "meta" in value &&
      typeof (value as any).meta === "object" &&
      typeof (value as any).meta.name === "string" &&
      typeof (value as any).meta.version === "string" &&
      typeof (value as any).meta.description === "string"
    );
  }

  /**
   * Private: Check if plugin is built-in
   */
  private isBuiltinPlugin(pluginName: string): boolean {
    return ["tailwindOptimizer", "cssMinifier", "sourceMapper"].includes(
      pluginName,
    );
  }

  /**
   * Private: Check if plugin is long-running
   */
  private isLongRunningPlugin(pluginName: string): boolean {
    // Built-in plugins are typically long-running
    return this.isBuiltinPlugin(pluginName);
  }

  /**
   * Private: Record successful execution
   */
  private recordSuccessfulExecution(context: PluginExecutionContext): void {
    const executionTime = performance.now() - context.startTime;
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDiff = memoryAfter - context.memoryBefore;

    this.updateResourceUsage(context.pluginName, memoryDiff, executionTime);

    logger.debug(`Plugin ${context.pluginName} executed successfully`, {
      executionTime,
      memoryUsage: memoryDiff,
      sandboxed: !!context.sandboxId,
    });
  }

  /**
   * Private: Record failed execution
   */
  private recordFailedExecution(
    context: PluginExecutionContext,
    error: unknown,
  ): void {
    const executionTime = performance.now() - context.startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Plugin ${context.pluginName} execution failed`, {
      error: errorMessage,
      executionTime,
      sandboxed: !!context.sandboxId,
    });
  }

  /**
   * Private: Create timeout promise
   */
  private createTimeoutPromise<T>(
    timeout: number,
    pluginName: string,
  ): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Plugin ${pluginName} execution timeout after ${timeout}ms`,
          ),
        );
      }, timeout);
    });
  }

  /**
   * Discover plugins from directory
   */
  private async discoverFromDirectory(
    searchPath: string,
  ): Promise<EnigmaPlugin[]> {
    const plugins: EnigmaPlugin[] = [];

    try {
      const entries = await readdir(searchPath);

      for (const entry of entries) {
        const fullPath = join(searchPath, entry);
        const stats = await stat(fullPath);

        if (
          stats.isFile() &&
          (entry.endsWith(".js") || entry.endsWith(".mjs"))
        ) {
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
  private async discoverFromNpm(_prefixes: string[]): Promise<EnigmaPlugin[]> {
    const plugins: EnigmaPlugin[] = [];

    // This would typically involve scanning node_modules for packages
    // matching the prefixes (e.g., 'enigma-plugin-', 'postcss-enigma-')
    // For now, we'll return empty array as this requires more complex logic

    logger.debug("NPM plugin discovery not yet implemented");
    return plugins;
  }

  /**
   * Load plugin from file
   */
  private async loadPluginFromFile(
    filePath: string,
  ): Promise<EnigmaPlugin | null> {
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
      const builtinsPath = join(
        dirname(new URL(import.meta.url).pathname),
        "plugins",
      );
      const builtins = await this.discoverFromDirectory(builtinsPath);
      plugins.push(...builtins);
    } catch (error) {
      logger.debug("No built-in plugins directory found", { error });
    }

    return plugins;
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
   * Disable security for testing purposes
   */
  disableSecurity(): void {
    this.securityEnabled = false;
    logger.debug("Security disabled");
  }

  /**
   * Enable security
   */
  enableSecurity(): void {
    this.securityEnabled = true;
    logger.debug("Security enabled");
  }

  /**
   * Get resource metrics for all plugins
   */
  getResourceMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [pluginName, stats] of this.resourceMonitor.entries()) {
      metrics[pluginName] = {
        memoryUsage: stats.memoryUsage,
        executionTime: stats.executionTime,
        lastAccess: stats.lastAccess,
        health: this.getPluginHealth(pluginName)
      };
    }
    
    return metrics;
  }
}

/**
 * Create a plugin manager instance with enhanced security and error handling
 */
export function createPluginManager(
  sandboxConfig?: Partial<SandboxConfig>,
  errorHandlerConfig?: Partial<ErrorHandlerConfig>,
): PluginManager {
  return new EnigmaPluginManager(sandboxConfig, errorHandlerConfig);
}

/**
 * Create enhanced plugin manager with default security settings
 */
export function createSecurePluginManager(options?: {
  enableSandbox?: boolean;
  enableErrorHandling?: boolean;
  enableResourceMonitoring?: boolean;
}): PluginManager {
  return new EnigmaPluginManager(
    {
      enabled: options?.enableSandbox !== false,
      strictMode: true,
      isolationLevel: "basic",
      signatureVerification: false,
      permissions: [PluginPermission.READ_FILES, PluginPermission.WRITE_FILES],
    },
    {
      enabled: options?.enableErrorHandling !== false,
      maxRetries: 3,
      gracefulDegradation: true,
      enableFallbacks: true,
      autoDisableThreshold: 5,
    },
  );
}

/**
 * Default plugin discovery options
 */
export function createDefaultDiscoveryOptions(): PluginDiscoveryOptions {
  return {
    searchPaths: ["./plugins", "./node_modules"],
    npmPrefixes: ["enigma-plugin-", "postcss-enigma-"],
    localPlugins: [],
    includeBuiltins: true,
  };
}
