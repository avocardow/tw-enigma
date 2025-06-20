/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Registry Builder Component
 * High-level component for managing DOM element registry lifecycle
 */

import type {
  CSSRuleInfo,
  DOMElementRegistry,
  RegistryConfig,
  RegistryEventHandler,
  RegistryEventType,
  RegistryStats,
} from '../types/registry';
import { DEFAULT_REGISTRY_CONFIG } from '../types/registry';
import { createRegistry } from './index';

/**
 * Registry builder configuration options
 */
export interface RegistryBuilderConfig extends Partial<RegistryConfig> {
  /** Unique identifier for this builder instance */
  id?: string;
  /** Auto-initialize on creation */
  autoInit?: boolean;
  /** Enable server-side rendering compatibility */
  ssrCompatible?: boolean;
  /** Max number of registries this builder can manage */
  maxRegistries?: number;
  /** Default registry config for new registries */
  defaultRegistryConfig?: Partial<RegistryConfig>;
  /** Enable performance monitoring */
  enableMetrics?: boolean;
  /** CSS rule discovery function */
  ruleDiscoveryFn?: () => Promise<CSSRuleInfo[]> | CSSRuleInfo[];
}

/**
 * Registry instance metadata
 */
export interface RegistryInstance {
  /** Unique registry ID */
  id: string;
  /** Registry instance */
  registry: DOMElementRegistry;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  lastUpdated: number;
  /** Registry configuration */
  config: RegistryConfig;
  /** Current status */
  status: 'initializing' | 'active' | 'updating' | 'destroying' | 'destroyed';
}

/**
 * Builder performance metrics
 */
export interface BuilderMetrics {
  /** Total number of registries created */
  totalRegistriesCreated: number;
  /** Number of active registries */
  activeRegistries: number;
  /** Total initialization time */
  totalInitTime: number;
  /** Average initialization time */
  averageInitTime: number;
  /** Total update operations */
  totalUpdates: number;
  /** Error count */
  errorCount: number;
  /** Memory usage estimate */
  estimatedMemoryUsage: number;
}

/**
 * Registry Builder error types
 */
export class RegistryBuilderError extends Error {
  constructor(
    message: string,
    public code: string,
    public registryId?: string
  ) {
    super(message);
    this.name = 'RegistryBuilderError';
  }
}

/**
 * Main Registry Builder class
 * Manages multiple registry instances with lifecycle management
 */
export class RegistryBuilder {
  private _config: RegistryBuilderConfig;
  private _registries: Map<string, RegistryInstance> = new Map();
  private _eventHandlers: Map<string, Set<RegistryEventHandler>> = new Map();
  private _metrics: BuilderMetrics;
  private _isDestroyed = false;
  private _initializationPromises: Map<string, Promise<DOMElementRegistry>> = new Map();

  constructor(config: RegistryBuilderConfig = {}) {
    this._config = {
      id: config.id || `registry-builder-${Date.now()}`,
      autoInit: config.autoInit ?? true,
      ssrCompatible: config.ssrCompatible ?? true,
      maxRegistries: config.maxRegistries ?? 10,
      enableMetrics: config.enableMetrics ?? true,
      defaultRegistryConfig: { ...DEFAULT_REGISTRY_CONFIG, ...config.defaultRegistryConfig },
      ...config,
    };

    this._metrics = this._initializeMetrics();

    if (this._config.autoInit && this._isClientSide()) {
      this._autoInitialize().catch((error) => {
        this._logError('Auto-initialization failed', error);
      });
    }
  }

  /**
   * Get builder configuration
   */
  get config(): RegistryBuilderConfig {
    return { ...this._config };
  }

  /**
   * Get current metrics
   */
  get metrics(): BuilderMetrics {
    this._updateMetrics();
    return { ...this._metrics };
  }

  /**
   * Check if builder is destroyed
   */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Get all registry instances
   */
  get registries(): ReadonlyMap<string, RegistryInstance> {
    return new Map(this._registries);
  }

  /**
   * Create a new registry instance
   * @param id Unique identifier for the registry
   * @param config Optional registry configuration
   * @param selectors Optional CSS selectors to initialize with
   * @returns Promise resolving to the registry instance
   */
  async createRegistry(
    id: string,
    config?: Partial<RegistryConfig>,
    selectors?: CSSRuleInfo[]
  ): Promise<DOMElementRegistry> {
    this._checkDestroyed();

    if (this._registries.has(id)) {
      this._metrics.errorCount++;
      throw new RegistryBuilderError(`Registry with ID '${id}' already exists`, 'DUPLICATE_ID', id);
    }

    if (this._registries.size >= (this._config.maxRegistries ?? 10)) {
      this._metrics.errorCount++;
      throw new RegistryBuilderError(
        `Maximum number of registries reached (${this._config.maxRegistries})`,
        'MAX_REGISTRIES_EXCEEDED'
      );
    }

    // Check if initialization is already in progress
    const existingPromise = this._initializationPromises.get(id);
    if (existingPromise) {
      return existingPromise;
    }

    const startTime = performance.now();

    try {
      const initPromise = this._createRegistryInternal(id, config, selectors);
      this._initializationPromises.set(id, initPromise);

      const registry = await initPromise;

      const endTime = performance.now();
      this._updateInitMetrics(endTime - startTime);

      return registry;
    } catch (error) {
      this._metrics.errorCount++;
      this._initializationPromises.delete(id);
      throw new RegistryBuilderError(
        `Failed to create registry '${id}': ${error.message}`,
        'CREATION_FAILED',
        id
      );
    }
  }

  /**
   * Get a registry instance by ID
   * @param id Registry identifier
   * @returns Registry instance or undefined
   */
  getRegistry(id: string): DOMElementRegistry | undefined {
    const instance = this._registries.get(id);
    return instance?.status === 'active' ? instance.registry : undefined;
  }

  /**
   * Update a registry with new CSS selectors
   * @param id Registry identifier
   * @param selectors New CSS selectors
   * @returns Promise resolving when update completes
   */
  async updateRegistry(id: string, selectors: CSSRuleInfo[]): Promise<void> {
    this._checkDestroyed();

    const instance = this._registries.get(id);
    if (!instance) {
      throw new RegistryBuilderError(`Registry '${id}' not found`, 'REGISTRY_NOT_FOUND', id);
    }

    if (instance.status !== 'active') {
      throw new RegistryBuilderError(
        `Registry '${id}' is not active (status: ${instance.status})`,
        'INVALID_STATE',
        id
      );
    }

    try {
      instance.status = 'updating';
      await instance.registry.initialize(selectors);
      instance.lastUpdated = Date.now();
      instance.status = 'active';
      this._metrics.totalUpdates++;
    } catch (error) {
      instance.status = 'active'; // Revert status on error
      this._metrics.errorCount++;
      throw new RegistryBuilderError(
        `Failed to update registry '${id}': ${error.message}`,
        'UPDATE_FAILED',
        id
      );
    }
  }

  /**
   * Destroy a registry instance
   * @param id Registry identifier
   * @returns Promise resolving when destruction completes
   */
  async destroyRegistry(id: string): Promise<void> {
    const instance = this._registries.get(id);
    if (!instance) {
      return; // Already destroyed or never existed
    }

    try {
      instance.status = 'destroying';
      instance.registry.destroy();
      instance.status = 'destroyed';
      this._registries.delete(id);
      this._initializationPromises.delete(id);
    } catch (error) {
      this._metrics.errorCount++;
      throw new RegistryBuilderError(
        `Failed to destroy registry '${id}': ${error.message}`,
        'DESTRUCTION_FAILED',
        id
      );
    }
  }

  /**
   * Bulk operations for multiple registries
   */
  async bulkOperation<T>(
    operation: (registry: DOMElementRegistry, id: string) => Promise<T> | T,
    registryIds?: string[]
  ): Promise<Map<string, T | Error>> {
    this._checkDestroyed();

    const targetIds = registryIds || Array.from(this._registries.keys());
    const results = new Map<string, T | Error>();

    await Promise.allSettled(
      targetIds.map(async (id) => {
        try {
          const registry = this.getRegistry(id);
          if (!registry) {
            results.set(
              id,
              new RegistryBuilderError(`Registry '${id}' not found`, 'REGISTRY_NOT_FOUND', id)
            );
            return;
          }

          const result = await operation(registry, id);
          results.set(id, result);
        } catch (error) {
          results.set(id, error);
          this._metrics.errorCount++;
        }
      })
    );

    return results;
  }

  /**
   * Add event listener to all registries
   * @param type Event type
   * @param handler Event handler
   */
  addEventListener(type: RegistryEventType, handler: RegistryEventHandler): void {
    if (!this._eventHandlers.has(type)) {
      this._eventHandlers.set(type, new Set());
    }
    this._eventHandlers.get(type)!.add(handler);

    // Add to existing registries
    for (const instance of this._registries.values()) {
      if (instance.status === 'active') {
        instance.registry.addEventListener(type, handler);
      }
    }
  }

  /**
   * Remove event listener from all registries
   * @param type Event type
   * @param handler Event handler
   */
  removeEventListener(type: RegistryEventType, handler: RegistryEventHandler): void {
    const handlers = this._eventHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this._eventHandlers.delete(type);
      }
    }

    // Remove from existing registries
    for (const instance of this._registries.values()) {
      if (instance.status === 'active') {
        instance.registry.removeEventListener(type, handler);
      }
    }
  }

  /**
   * Get aggregated statistics from all registries
   */
  getAggregatedStats(): RegistryStats & { registryCount: number } {
    const stats: RegistryStats = {
      totalClasses: 0,
      totalElements: 0,
      staleReferences: 0,
      memoryUsage: 0,
      lastCleanup: 0,
      cleanupCount: 0,
      performance: {
        averageQueryTime: 0,
        averageUpdateTime: 0,
        averageCleanupTime: 0,
      },
    };

    let registryCount = 0;
    const performanceMetrics: number[][] = [[], [], []]; // query, update, cleanup times

    for (const instance of this._registries.values()) {
      if (instance.status === 'active') {
        const registryStats = instance.registry.getStats();
        stats.totalClasses += registryStats.totalClasses;
        stats.totalElements += registryStats.totalElements;
        stats.staleReferences += registryStats.staleReferences;
        stats.memoryUsage += registryStats.memoryUsage;
        stats.cleanupCount += registryStats.cleanupCount;
        stats.lastCleanup = Math.max(stats.lastCleanup, registryStats.lastCleanup);

        performanceMetrics[0].push(registryStats.performance.averageQueryTime);
        performanceMetrics[1].push(registryStats.performance.averageUpdateTime);
        performanceMetrics[2].push(registryStats.performance.averageCleanupTime);

        registryCount++;
      }
    }

    // Calculate averages
    if (registryCount > 0) {
      stats.performance.averageQueryTime = this._calculateAverage(performanceMetrics[0]);
      stats.performance.averageUpdateTime = this._calculateAverage(performanceMetrics[1]);
      stats.performance.averageCleanupTime = this._calculateAverage(performanceMetrics[2]);
    }

    return { ...stats, registryCount };
  }

  /**
   * Cleanup all registries
   */
  async cleanup(): Promise<void> {
    this._checkDestroyed();

    await this.bulkOperation((registry) => {
      return registry.cleanup();
    });
  }

  /**
   * Destroy the builder and all registries
   */
  async destroy(): Promise<void> {
    if (this._isDestroyed) {
      return;
    }

    this._isDestroyed = true;

    // Destroy all registries
    const destroyPromises = Array.from(this._registries.keys()).map((id) =>
      this.destroyRegistry(id).catch((error) => {
        this._logError(`Failed to destroy registry ${id}`, error);
      })
    );

    await Promise.allSettled(destroyPromises);

    // Clear all state
    this._registries.clear();
    this._eventHandlers.clear();
    this._initializationPromises.clear();
  }

  // Private methods

  private async _createRegistryInternal(
    id: string,
    config?: Partial<RegistryConfig>,
    selectors?: CSSRuleInfo[]
  ): Promise<DOMElementRegistry> {
    const registryConfig = { ...this._config.defaultRegistryConfig, ...config };
    const registry = createRegistry(registryConfig);

    // Add event listeners
    for (const [type, handlers] of this._eventHandlers) {
      for (const handler of handlers) {
        registry.addEventListener(type, handler);
      }
    }

    const instance: RegistryInstance = {
      id,
      registry,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      config: registryConfig as RegistryConfig,
      status: 'initializing',
    };

    this._registries.set(id, instance);

    try {
      // Initialize with selectors if provided, or discover them
      const rulesToUse = selectors || (await this._discoverRules());
      await registry.initialize(rulesToUse);

      instance.status = 'active';
      instance.lastUpdated = Date.now();
      this._metrics.totalRegistriesCreated++;

      return registry;
    } catch (error) {
      // Cleanup on failure
      this._registries.delete(id);
      throw error;
    } finally {
      this._initializationPromises.delete(id);
    }
  }

  private async _discoverRules(): Promise<CSSRuleInfo[]> {
    if (this._config.ruleDiscoveryFn) {
      return await this._config.ruleDiscoveryFn();
    }

    // Default empty discovery - can be enhanced with Task 3 integration
    return [];
  }

  private async _autoInitialize(): Promise<void> {
    try {
      await this.createRegistry('default');
    } catch (error) {
      this._logError('Auto-initialization failed', error);
    }
  }

  private _isClientSide(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private _checkDestroyed(): void {
    if (this._isDestroyed) {
      throw new RegistryBuilderError('Registry builder has been destroyed', 'BUILDER_DESTROYED');
    }
  }

  private _initializeMetrics(): BuilderMetrics {
    return {
      totalRegistriesCreated: 0,
      activeRegistries: 0,
      totalInitTime: 0,
      averageInitTime: 0,
      totalUpdates: 0,
      errorCount: 0,
      estimatedMemoryUsage: 0,
    };
  }

  private _updateMetrics(): void {
    this._metrics.activeRegistries = Array.from(this._registries.values()).filter(
      (instance) => instance.status === 'active'
    ).length;

    this._metrics.estimatedMemoryUsage = Array.from(this._registries.values())
      .filter((instance) => instance.status === 'active')
      .reduce((total, instance) => total + instance.registry.getStats().memoryUsage, 0);
  }

  private _updateInitMetrics(duration: number): void {
    this._metrics.totalInitTime += duration;
    this._metrics.averageInitTime =
      this._metrics.totalInitTime / this._metrics.totalRegistriesCreated;
  }

  private _calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private _logError(message: string, error: unknown): void {
    if (this._config.defaultRegistryConfig?.debug) {
      console.error(`[RegistryBuilder] ${message}:`, error);
    }
  }
}

/**
 * Create a new registry builder instance
 * @param config Builder configuration
 * @returns New registry builder instance
 */
export function createRegistryBuilder(config?: RegistryBuilderConfig): RegistryBuilder {
  return new RegistryBuilder(config);
}

/**
 * Global registry builder singleton for convenience
 */
let globalBuilder: RegistryBuilder | null = null;

/**
 * Get or create the global registry builder instance
 * @param config Configuration for the global builder (only used on first call)
 * @returns Global registry builder instance
 */
export function getGlobalRegistryBuilder(config?: RegistryBuilderConfig): RegistryBuilder {
  if (!globalBuilder || globalBuilder.isDestroyed) {
    globalBuilder = new RegistryBuilder(config);
  }
  return globalBuilder;
}

/**
 * Destroy the global registry builder
 */
export async function destroyGlobalRegistryBuilder(): Promise<void> {
  if (globalBuilder && !globalBuilder.isDestroyed) {
    await globalBuilder.destroy();
    globalBuilder = null;
  }
}
