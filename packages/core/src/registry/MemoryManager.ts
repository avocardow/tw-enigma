/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Advanced Memory Manager
 * Provides memory pressure detection, adaptive cleanup, and framework integration
 */

import type { DOMElementRegistry, ElementReference } from '../types/registry';

/**
 * Memory pressure levels
 */
export type MemoryPressureLevel = 'low' | 'moderate' | 'critical';

/**
 * Memory management configuration
 */
export interface MemoryManagerConfig {
  /** Enable memory pressure monitoring */
  enableMemoryPressureMonitoring?: boolean;
  /** Memory pressure check interval (ms) */
  memoryCheckInterval?: number;
  /** Memory thresholds (MB) */
  memoryThresholds?: {
    moderate: number;
    critical: number;
  };
  /** Enable object pooling */
  enableObjectPooling?: boolean;
  /** Maximum pool size */
  maxPoolSize?: number;
  /** Enable framework lifecycle integration */
  enableFrameworkIntegration?: boolean;
  /** Debug memory management */
  debug?: boolean;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Current memory pressure level */
  pressureLevel: MemoryPressureLevel;
  /** Estimated total memory usage (bytes) */
  totalMemoryUsage: number;
  /** Registry memory usage (bytes) */
  registryMemoryUsage: number;
  /** Pool memory usage (bytes) */
  poolMemoryUsage: number;
  /** JS heap used (bytes) */
  jsHeapUsed?: number;
  /** JS heap total (bytes) */
  jsHeapTotal?: number;
  /** Memory pressure events count */
  memoryPressureEvents: number;
  /** Last cleanup timestamp */
  lastCleanup: number;
  /** Adaptive cleanup interval */
  adaptiveCleanupInterval: number;
  /** Last cleanup duration (ms) */
  lastCleanupDuration?: number;
}

/**
 * Framework lifecycle manager
 */
export interface FrameworkLifecycleManager {
  /** Register cleanup callback for component unmount */
  onUnmount(callback: () => void): void;
  /** Register cleanup callback for navigation */
  onNavigation(callback: () => void): void;
  /** Check if component is still mounted */
  isMounted(): boolean;
  /** Framework name */
  framework: string;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakReport {
  /** Potential leaks detected */
  potentialLeaks: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
    affectedRegistries: string[];
  }>;
  /** Memory trends */
  memoryTrends: {
    increasing: boolean;
    rate: number; // bytes per second
    projectedExhaustion?: number; // timestamp
  };
  /** Performance impact */
  performanceImpact: {
    cleanupTime: number;
    queryTime: number;
    memoryEfficiency: number; // 0-1 scale
  };
}

/**
 * Default memory manager configuration
 */
export const DEFAULT_MEMORY_CONFIG: Required<MemoryManagerConfig> = {
  enableMemoryPressureMonitoring: true,
  memoryCheckInterval: 5000, // 5 seconds
  memoryThresholds: {
    moderate: 100, // 100MB
    critical: 200, // 200MB
  },
  enableObjectPooling: true,
  maxPoolSize: 1000,
  enableFrameworkIntegration: true,
  debug: false,
};

/**
 * Advanced Memory Manager for DOM Element Registry
 */
export class MemoryManager {
  private _config: Required<MemoryManagerConfig>;
  private _stats: MemoryStats;
  private _registries: Set<DOMElementRegistry> = new Set();
  private _memoryCheckTimer: number | null = null;
  private _elementReferencePool: ElementReference[] = [];
  private _frameworkManager: FrameworkLifecycleManager | null = null;
  private _memoryHistory: Array<{ timestamp: number; usage: number }> = [];
  private _cleanupCallbacks: Set<() => void> = new Set();

  constructor(config: MemoryManagerConfig = {}) {
    this._config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this._stats = this._initializeStats();

    if (this._config.enableMemoryPressureMonitoring) {
      this._startMemoryMonitoring();
    }

    if (this._config.enableFrameworkIntegration) {
      this._detectAndSetupFramework();
    }
  }

  /**
   * Get current memory statistics
   */
  get stats(): MemoryStats {
    this._updateStats();
    return { ...this._stats };
  }

  /**
   * Get current configuration
   */
  get config(): Required<MemoryManagerConfig> {
    return { ...this._config };
  }

  /**
   * Register a registry for memory management
   */
  registerRegistry(registry: DOMElementRegistry): void {
    if (!this._registries) return;
    this._registries.add(registry);
    this._updateStats();
  }

  /**
   * Unregister a registry from memory management
   */
  unregisterRegistry(registry: DOMElementRegistry): void {
    if (!this._registries) return;
    this._registries.delete(registry);
    this._updateStats();
  }

  /**
   * Get element reference from pool or create new one
   */
  getElementReference(element: Element): ElementReference {
    if (this._config.enableObjectPooling && this._elementReferencePool.length > 0) {
      const pooledRef = this._elementReferencePool.pop()!;

      // Reuse pooled reference with new element
      return {
        weakRef: new WeakRef(element),
        tagName: element.tagName,
        classListSnapshot: Array.from(element.classList),
        createdAt: Date.now(),
        isConnected: element.isConnected,
      };
    }

    // Create new reference
    return {
      weakRef: new WeakRef(element),
      tagName: element.tagName,
      classListSnapshot: Array.from(element.classList),
      createdAt: Date.now(),
      isConnected: element.isConnected,
    };
  }

  /**
   * Return element reference to pool for reuse
   */
  recycleElementReference(reference: ElementReference): void {
    if (
      this._config.enableObjectPooling &&
      this._elementReferencePool.length < this._config.maxPoolSize
    ) {
      // Clear reference and add to pool
      this._elementReferencePool.push(reference);
    }
  }

  /**
   * Trigger adaptive cleanup based on memory pressure
   */
  async triggerAdaptiveCleanup(): Promise<number> {
    const startTime = performance.now();
    let totalCleaned = 0;

    // Different cleanup strategies based on memory pressure
    switch (this._stats.pressureLevel) {
      case 'critical':
        // Aggressive cleanup
        for (const registry of this._registries) {
          totalCleaned += registry.forceCleanup().cleanupCount || 0;
        }
        this._clearObjectPool();
        break;

      case 'moderate':
        // Standard cleanup
        for (const registry of this._registries) {
          totalCleaned += registry.cleanup();
        }
        this._trimObjectPool();
        break;

      case 'low':
        // Light cleanup
        const oldestRegistries = Array.from(this._registries).slice(
          0,
          Math.ceil(this._registries.size / 2)
        );
        for (const registry of oldestRegistries) {
          totalCleaned += registry.cleanup();
        }
        break;
    }

    this._updateAdaptiveCleanupInterval();
    this._stats.lastCleanup = Date.now();
    const endTime = performance.now();
    this._stats.lastCleanupDuration = endTime - startTime;
    return totalCleaned;
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): MemoryLeakReport {
    // Basic leak detection logic
    const potentialLeaks: MemoryLeakReport['potentialLeaks'] = [];
    const memoryTrends = this._analyzeMemoryTrends();
    const performanceImpact = this._analyzePerformanceImpact();

    // Check for registries with continuously growing memory
    for (const registry of this._registries) {
      if (registry.stats.memoryUsage > 10 * 1024 * 1024) {
        // 10MB threshold
        potentialLeaks.push({
          description: `Registry ${registry.config.name || 'unnamed'} has high memory usage`,
          severity: 'medium',
          recommendation: 'Inspect registry for detached elements',
          affectedRegistries: [registry.config.name || 'unnamed'],
        });
      }
    }

    return {
      potentialLeaks,
      memoryTrends,
      performanceImpact,
    };
  }

  /**
   * Register a callback to be executed during cleanup
   */
  onCleanup(callback: () => void): void {
    this._cleanupCallbacks.add(callback);
  }

  /**
   * Remove a cleanup callback
   */
  offCleanup(callback: () => void): void {
    this._cleanupCallbacks.delete(callback);
  }

  /**
   * Manually trigger memory optimization
   */
  async optimizeMemory(): Promise<void> {
    const startTime = performance.now();

    for (const registry of this._registries) {
      registry.cleanup();
    }

    this._trimObjectPool();

    const endTime = performance.now();
    this._stats.lastCleanupDuration = endTime - startTime;
  }

  /**
   * Manually trigger a memory stats update.
   */
  updateMemoryStats(): void {
    this._updateMemoryStats();
  }

  /**
   * Clean up and release resources
   */
  destroy(): void {
    if (this._memoryCheckTimer) {
      clearInterval(this._memoryCheckTimer);
      this._memoryCheckTimer = null;
    }
    this._registries.clear();
    this._elementReferencePool = [];
    this._memoryHistory = [];
    this._cleanupCallbacks.clear();
  }

  private _initializeStats(): MemoryStats {
    return {
      pressureLevel: 'low',
      totalMemoryUsage: 0,
      registryMemoryUsage: 0,
      poolMemoryUsage: 0,
      memoryPressureEvents: 0,
      lastCleanup: 0,
      adaptiveCleanupInterval: this._config.memoryCheckInterval,
      lastCleanupDuration: 0,
    };
  }

  private _startMemoryMonitoring(): void {
    if (this._memoryCheckTimer) {
      clearInterval(this._memoryCheckTimer);
    }
    this._memoryCheckTimer = setInterval(
      () => this._checkMemoryPressure(),
      this._config.memoryCheckInterval
    ) as unknown as number;
  }

  private _checkMemoryPressure(): void {
    const memoryUsage = this._getCurrentMemoryUsage();
    this._memoryHistory.push({ timestamp: Date.now(), usage: memoryUsage });

    // Keep only last 100 measurements
    if (this._memoryHistory.length > 100) {
      this._memoryHistory.shift();
    }

    // Determine pressure level
    const previousLevel = this._stats.pressureLevel;
    const thresholds = this._config.memoryThresholds;

    if (memoryUsage > thresholds.critical * 1024 * 1024) {
      this._stats.pressureLevel = 'critical';
    } else if (memoryUsage > thresholds.moderate * 1024 * 1024) {
      this._stats.pressureLevel = 'moderate';
    } else {
      this._stats.pressureLevel = 'low';
    }

    // Trigger cleanup if pressure increased
    if (this._stats.pressureLevel !== previousLevel && this._stats.pressureLevel !== 'low') {
      this._stats.memoryPressureEvents++;
      this.triggerAdaptiveCleanup();
    }

    this._updateStats();
  }

  private _getCurrentMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance && performance.memory) {
      return (performance.memory as any).usedJSHeapSize;
    }
    // Fallback for environments without performance.memory
    return this._stats.registryMemoryUsage + this._stats.poolMemoryUsage;
  }

  private _updateStats(): void {
    let registryMemory = 0;
    for (const registry of this._registries) {
      registryMemory += registry.stats.memoryUsage;
    }
    this._stats.registryMemoryUsage = registryMemory;
    this._stats.poolMemoryUsage = this._elementReferencePool.length * 200; // Approx 200 bytes per ref
    this._stats.totalMemoryUsage = this._stats.registryMemoryUsage + this._stats.poolMemoryUsage;

    if (typeof performance !== 'undefined' && 'memory' in performance && performance.memory) {
      this._stats.jsHeapUsed = (performance.memory as any).usedJSHeapSize;
      this._stats.jsHeapTotal = (performance.memory as any).totalJSHeapSize;
    }
  }

  private _updateAdaptiveCleanupInterval(): void {
    // Adjust cleanup interval based on memory pressure
    switch (this._stats.pressureLevel) {
      case 'critical':
        this._stats.adaptiveCleanupInterval = Math.min(this._config.memoryCheckInterval / 4, 1000);
        break;
      case 'moderate':
        this._stats.adaptiveCleanupInterval = this._config.memoryCheckInterval / 2;
        break;
      case 'low':
        this._stats.adaptiveCleanupInterval = this._config.memoryCheckInterval;
        break;
    }
  }

  private _clearObjectPool(): void {
    this._elementReferencePool = [];
  }

  private _trimObjectPool(): void {
    const targetSize = Math.floor(this._config.maxPoolSize / 2);
    this._elementReferencePool.splice(targetSize);
  }

  private _detectAndSetupFramework(): void {
    if (typeof window !== 'undefined') {
      // Basic detection logic
      if ((window as any).React) {
        this._frameworkManager = new ReactLifecycleManager();
      } else if ((window as any).Vue) {
        this._frameworkManager = new VueLifecycleManager();
      } else {
        this._frameworkManager = new GenericLifecycleManager();
      }
    }
  }

  private _analyzeMemoryTrends(): MemoryLeakReport['memoryTrends'] {
    if (this._memoryHistory.length < 2) {
      return { increasing: false, rate: 0 };
    }
    const first = this._memoryHistory[0];
    const last = this._memoryHistory[this._memoryHistory.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000; // seconds
    const memoryDiff = last.usage - first.usage;

    if (timeDiff > 0) {
      const rate = memoryDiff / timeDiff;
      return { increasing: rate > 1024, rate }; // Increasing if > 1KB/s
    }
    return { increasing: false, rate: 0 };
  }

  private _analyzePerformanceImpact(): MemoryLeakReport['performanceImpact'] {
    // Placeholder for performance impact analysis
    return {
      cleanupTime: this._stats.lastCleanupDuration || 0,
      queryTime: 0, // Needs implementation
      memoryEfficiency: 0, // Needs implementation
    };
  }

  private _log(message: string, ...args: any[]): void {
    if (this._config.debug) {
      console.log(`[MemoryManager] ${message}`, ...args);
    }
  }
}

class ReactLifecycleManager implements FrameworkLifecycleManager {
  readonly framework = 'React';
  private _mounted = true;

  onUnmount(callback: () => void): void {
    // This is a conceptual implementation.
    // In a real scenario, this would hook into React's lifecycle.
    // e.g., using useEffect's cleanup function
    const originalComponentWillUnmount = (window as any).React.Component.prototype
      .componentWillUnmount;
    (window as any).React.Component.prototype.componentWillUnmount = function () {
      callback();
      if (originalComponentWillUnmount) {
        originalComponentWillUnmount.apply(this, arguments);
      }
    };
  }
  onNavigation(callback: () => void): void {
    // Hook into history changes
  }
  isMounted(): boolean {
    // Needs component instance context
    return this._mounted;
  }
}
class VueLifecycleManager implements FrameworkLifecycleManager {
  readonly framework = 'Vue';
  private _mounted = true;

  onUnmount(callback: () => void): void {
    // Conceptual implementation for Vue
    // Would hook into `beforeDestroy` or `unmounted` lifecycle hooks
    const originalBeforeDestroy = (window as any).Vue.prototype.$destroy;
    (window as any).Vue.prototype.$destroy = function () {
      callback();
      if (originalBeforeDestroy) {
        originalBeforeDestroy.apply(this, arguments);
      }
    };
  }
  onNavigation(callback: () => void): void {
    // Hook into Vue Router
  }
  isMounted(): boolean {
    return this._mounted;
  }
}

class GenericLifecycleManager implements FrameworkLifecycleManager {
  readonly framework = 'Generic';
  private _mounted = true;

  onUnmount(callback: () => void): void {
    // Fallback for vanilla JS or other frameworks
    const handleUnload = () => {
      callback();
      window.removeEventListener('beforeunload', handleUnload);
    };
    window.addEventListener('beforeunload', handleUnload);
  }

  onNavigation(callback: () => void): void {
    // Listen for hash changes or history API usage
    window.addEventListener('popstate', callback);
  }

  isMounted(): boolean {
    return this._mounted;
  }
}

let globalMemoryManager: MemoryManager | null = null;
export function createMemoryManager(config?: MemoryManagerConfig): MemoryManager {
  return new MemoryManager(config);
}

export function getGlobalMemoryManager(config?: MemoryManagerConfig): MemoryManager {
  if (!globalMemoryManager) {
    globalMemoryManager = new MemoryManager(config);
  }
  return globalMemoryManager;
}

export function destroyGlobalMemoryManager(): void {
  if (globalMemoryManager) {
    globalMemoryManager.destroy();
    globalMemoryManager = null;
  }
}
