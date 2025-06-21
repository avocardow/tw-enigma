/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * DOM Element Registry Implementation
 * Maps CSS rules to their corresponding DOM elements with automatic cleanup
 */

import type {
  CSSRuleInfo,
  ClassRegistry,
  ClassRegistryEntry,
  DOMElementRegistry,
  ElementReference,
  RegistryConfig,
  RegistryEvent,
  RegistryEventHandler,
  RegistryEventType,
  RegistryStats,
} from '../types/registry';
import { DEFAULT_REGISTRY_CONFIG } from '../types/registry';

/**
 * Core DOM Element Registry implementation
 */
export class DOMElementRegistryImpl implements DOMElementRegistry {
  private _registry: ClassRegistry = {};
  private _config: RegistryConfig;
  private _stats: RegistryStats;
  private _eventHandlers: Map<RegistryEventType, Set<RegistryEventHandler>> = new Map();
  private _mutationObserver: MutationObserver | null = null;
  private _cleanupTimer: number | null = null;
  private _performanceTimers: Map<string, number> = new Map();

  constructor(config: Partial<RegistryConfig> = {}) {
    this._config = { ...DEFAULT_REGISTRY_CONFIG, ...config };
    this._stats = this._initializeStats();
    this._setupMutationObserver();
    this._startCleanupTimer();
  }

  get registry(): ClassRegistry {
    return this._registry;
  }

  get config(): RegistryConfig {
    return this._config;
  }

  get stats(): RegistryStats {
    return this._stats;
  }

  /**
   * Initialize the registry with CSS rule information
   */
  async initialize(selectors: CSSRuleInfo[]): Promise<ClassRegistry> {
    const startTime = this._startTimer('initialize');

    this._log(`Initializing registry with ${selectors.length} selectors`);

    // Clear existing registry
    this._registry = {};

    // Limit selectors to prevent performance issues
    const limitedSelectors = selectors.slice(0, this._config.maxRegistrySize);

    for (const { rule, className } of limitedSelectors) {
      try {
        // Find all elements with this class
        const elements = this._findElementsForClass(className);

        if (elements.length > 0) {
          this._addClassInternal(className, rule, elements);
        }
      } catch (error) {
        this._log(`Error mapping elements for class ${className}:`, error);
      }
    }

    this._updateStats();
    this._endTimer('initialize', startTime);
    this._log(`Registry built with ${Object.keys(this._registry).length} active classes`);

    this._emitEvent({
      type: 'stats-updated',
      timestamp: Date.now(),
      metadata: { totalClasses: this._stats.totalClasses },
    });

    return this._registry;
  }

  /**
   * Add a class and its elements to the registry
   */
  addClass(className: string, cssRule: CSSStyleRule, elements: Element[]): void {
    if (Object.keys(this._registry).length >= this._config.maxRegistrySize) {
      this._log(
        `Registry size limit reached (${this._config.maxRegistrySize}), skipping class ${className}`
      );
      return;
    }

    this._addClassInternal(className, cssRule, elements);
    this._updateStats();

    this._emitEvent({
      type: 'class-added',
      className,
      timestamp: Date.now(),
      metadata: { elementCount: elements.length },
    });
  }

  /**
   * Remove a class from the registry
   */
  removeClass(className: string): void {
    if (!this._registry[className]) {
      return;
    }

    delete this._registry[className];
    this._updateStats();

    this._emitEvent({
      type: 'class-removed',
      className,
      timestamp: Date.now(),
    });
  }

  /**
   * Add an element to an existing class entry
   */
  addElement(className: string, element: Element): void {
    const entry = this._registry[className];
    if (!entry) {
      this._log(`Cannot add element to non-existent class: ${className}`);
      return;
    }

    if (entry.elements.length >= this._config.maxElementsPerClass) {
      this._log(
        `Element limit reached for class ${className} (${this._config.maxElementsPerClass})`
      );
      return;
    }

    // Check if element is already tracked
    const existing = entry.elements.find((ref) => ref.weakRef.deref() === element);
    if (existing) {
      return;
    }

    const elementRef = this._createElementReference(element);
    entry.elements.push(elementRef);
    entry.lastUpdated = Date.now();
    entry.stats.activeElementCount = this._getActiveElementCount(entry);
    entry.stats.peakElementCount = Math.max(
      entry.stats.peakElementCount,
      entry.stats.activeElementCount
    );

    this._updateStats();

    this._emitEvent({
      type: 'element-added',
      className,
      element,
      timestamp: Date.now(),
    });
  }

  /**
   * Remove an element from a class entry
   */
  removeElement(className: string, element: Element): void {
    const entry = this._registry[className];
    if (!entry) {
      return;
    }

    const index = entry.elements.findIndex((ref) => ref.weakRef.deref() === element);
    if (index === -1) {
      return;
    }

    entry.elements.splice(index, 1);
    entry.lastUpdated = Date.now();
    entry.stats.activeElementCount = this._getActiveElementCount(entry);

    // Remove class if no elements remain
    if (entry.elements.length === 0) {
      this.removeClass(className);
      return;
    }

    this._updateStats();

    this._emitEvent({
      type: 'element-removed',
      className,
      element,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all live elements for a class
   */
  getElements(className: string): Element[] {
    const entry = this._registry[className];
    if (!entry) {
      return [];
    }

    entry.stats.queryCount++;

    // Filter out garbage collected elements
    const liveElements: Element[] = [];
    entry.elements = entry.elements.filter((ref) => {
      const element = ref.weakRef.deref();
      if (element && element.isConnected) {
        liveElements.push(element);
        return true;
      }
      return false;
    });

    entry.stats.activeElementCount = liveElements.length;

    return liveElements;
  }

  /**
   * Get CSS rule for a class
   */
  getCSSRule(className: string): CSSStyleRule | undefined {
    return this._registry[className]?.cssRule;
  }

  /**
   * Check if a class is tracked in the registry
   */
  hasClass(className: string): boolean {
    return className in this._registry;
  }

  /**
   * Get all tracked class names
   */
  getClassNames(): string[] {
    return Object.keys(this._registry);
  }

  /**
   * Clean up stale element references and unused classes
   */
  cleanup(): number {
    const startTime = this._startTimer('cleanup');
    let cleanedCount = 0;

    for (const className in this._registry) {
      const entry = this._registry[className];
      const originalLength = entry.elements.length;

      // Filter out garbage collected or disconnected elements
      entry.elements = entry.elements.filter((ref) => {
        const element = ref.weakRef.deref();
        const isAlive = element && element.isConnected;
        ref.isConnected = !!isAlive;
        return isAlive;
      });

      cleanedCount += originalLength - entry.elements.length;
      entry.stats.activeElementCount = entry.elements.length;

      // Remove classes with no elements
      if (entry.elements.length === 0) {
        delete this._registry[className];
      }
    }

    this._updateStats();
    this._endTimer('cleanup', startTime);

    this._emitEvent({
      type: 'cleanup-completed',
      timestamp: Date.now(),
      metadata: { cleanedCount },
    });

    this._log(`Cleanup completed: ${cleanedCount} stale references removed`);
    return cleanedCount;
  }

  /**
   * Force a full cleanup of all references
   */
  forceCleanup(): RegistryStats {
    this.cleanup();

    // Additional aggressive cleanup
    for (const className in this._registry) {
      const entry = this._registry[className];

      // Clear computed styles cache
      if (entry.computedStylesCache) {
        entry.computedStylesCache.clear();
      }

      // Reset statistics that might be inflated
      entry.stats.queryCount = 0;
    }

    this._stats.cleanupCount++;
    this._stats.lastCleanup = Date.now();

    return this._stats;
  }

  /**
   * Get current registry statistics
   */
  getStats(): RegistryStats {
    this._updateStats();
    return { ...this._stats };
  }

  /**
   * Update registry configuration
   */
  updateConfig(config: Partial<RegistryConfig>): void {
    this._config = { ...this._config, ...config };

    // Restart cleanup timer if interval changed
    if ('cleanupInterval' in config) {
      this._stopCleanupTimer();
      this._startCleanupTimer();
    }
  }

  /**
   * Add event listener
   */
  addEventListener(type: RegistryEventType, handler: RegistryEventHandler): void {
    if (!this._eventHandlers.has(type)) {
      this._eventHandlers.set(type, new Set());
    }
    this._eventHandlers.get(type)!.add(handler);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type: RegistryEventType, handler: RegistryEventHandler): void {
    const handlers = this._eventHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this._eventHandlers.delete(type);
      }
    }
  }

  /**
   * Destroy the registry and clean up all resources
   */
  destroy(): void {
    this._stopCleanupTimer();
    this._stopMutationObserver();
    this._eventHandlers.clear();
    this._registry = {};
    this._performanceTimers.clear();
  }

  // Private methods

  private _addClassInternal(className: string, cssRule: CSSStyleRule, elements: Element[]): void {
    const limitedElements = elements.slice(0, this._config.maxElementsPerClass);
    const elementRefs = limitedElements.map((el) => this._createElementReference(el));

    this._registry[className] = {
      cssRule,
      elements: elementRefs,
      originalClassName: className,
      lastUpdated: Date.now(),
      stats: {
        queryCount: 0,
        activeElementCount: limitedElements.length,
        peakElementCount: limitedElements.length,
      },
      ...(this._config.enableComputedStylesCache && {
        computedStylesCache: new Map<string, CSSStyleDeclaration>(),
      }),
    };
  }

  private _createElementReference(element: Element): ElementReference {
    return {
      weakRef: new WeakRef(element),
      tagName: element.tagName,
      classListSnapshot: Array.from(element.classList),
      createdAt: Date.now(),
      isConnected: element.isConnected,
    };
  }

  private _findElementsForClass(className: string): Element[] {
    try {
      return Array.from(document.querySelectorAll(`.${className}`));
    } catch (error) {
      this._log(`Error querying elements for class ${className}:`, error);
      return [];
    }
  }

  private _getActiveElementCount(entry: ClassRegistryEntry): number {
    return entry.elements.filter((ref) => {
      const element = ref.weakRef.deref();
      return element && element.isConnected;
    }).length;
  }

  private _setupMutationObserver(): void {
    if (typeof MutationObserver === 'undefined') {
      return;
    }

    this._mutationObserver = new MutationObserver((mutations) => {
      this._handleMutations(mutations);
    });

    this._mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private _stopMutationObserver(): void {
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
  }

  private _handleMutations(mutations: MutationRecord[]): void {
    const changedClasses = new Set<string>();

    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        // Handle class attribute changes
        const element = mutation.target as Element;
        const currentClasses = Array.from(element.classList);

        // Check which tracked classes are affected
        for (const className of this.getClassNames()) {
          const hasClass = currentClasses.includes(className);
          const wasTracked = this._registry[className]?.elements.some(
            (ref) => ref.weakRef.deref() === element
          );

          if (hasClass && !wasTracked) {
            this.addElement(className, element);
            changedClasses.add(className);
          } else if (!hasClass && wasTracked) {
            this.removeElement(className, element);
            changedClasses.add(className);
          }
        }
      } else if (mutation.type === 'childList') {
        // Handle added/removed nodes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Node.ELEMENT_NODE = 1
            this._handleAddedElement(node as Element);
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Node.ELEMENT_NODE = 1
            this._handleRemovedElement(node as Element);
          }
        });
      }
    }

    // Trigger cleanup if many classes changed
    if (changedClasses.size > 10) {
      this.cleanup();
    }
  }

  private _handleAddedElement(element: Element): void {
    // Check if added element has any tracked classes
    for (const className of this.getClassNames()) {
      if (element.classList.contains(className)) {
        this.addElement(className, element);
      }
    }

    // Check descendants
    const descendants = element.querySelectorAll('[class]');
    descendants.forEach((descendant) => {
      for (const className of this.getClassNames()) {
        if (descendant.classList.contains(className)) {
          this.addElement(className, descendant);
        }
      }
    });
  }

  private _handleRemovedElement(_element: Element): void {
    // Element is being removed, so we don't need to explicitly remove it
    // The cleanup process will handle stale references automatically
  }

  private _startCleanupTimer(): void {
    if (this._config.cleanupInterval > 0) {
      this._cleanupTimer = window.setInterval(() => {
        this.cleanup();
      }, this._config.cleanupInterval);
    }
  }

  private _stopCleanupTimer(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  private _initializeStats(): RegistryStats {
    return {
      totalClasses: 0,
      totalElements: 0,
      staleReferences: 0,
      memoryUsage: 0,
      lastCleanup: Date.now(),
      cleanupCount: 0,
      performance: {
        averageQueryTime: 0,
        averageUpdateTime: 0,
        averageCleanupTime: 0,
      },
    };
  }

  private _updateStats(): void {
    let totalElements = 0;
    let staleReferences = 0;

    for (const entry of Object.values(this._registry)) {
      totalElements += entry.elements.length;

      // Count stale references
      entry.elements.forEach((ref) => {
        const element = ref.weakRef.deref();
        if (!element || !element.isConnected) {
          staleReferences++;
        }
      });
    }

    this._stats.totalClasses = Object.keys(this._registry).length;
    this._stats.totalElements = totalElements;
    this._stats.staleReferences = staleReferences;
    this._stats.memoryUsage = this._estimateMemoryUsage();
  }

  private _estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0;

    for (const [className, entry] of Object.entries(this._registry)) {
      size += className.length * 2; // String characters
      size += entry.elements.length * 100; // Rough estimate per element reference
      size += entry.originalClassName.length * 2;

      if (entry.computedStylesCache) {
        size += entry.computedStylesCache.size * 500; // Rough estimate per cached style
      }
    }

    return size;
  }

  private _startTimer(operation: string): number {
    const time = performance.now();
    this._performanceTimers.set(operation, time);
    return time;
  }

  private _endTimer(operation: string, startTime: number): number {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Update average times
    if (this._config.enablePerformanceMonitoring) {
      const key =
        `average${operation.charAt(0).toUpperCase() + operation.slice(1)}Time` as keyof typeof this._stats.performance;
      const currentAvg = this._stats.performance[key];
      this._stats.performance[key] = currentAvg === 0 ? duration : (currentAvg + duration) / 2;
    }

    this._performanceTimers.delete(operation);
    return duration;
  }

  private _emitEvent(event: RegistryEvent): void {
    const handlers = this._eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          this._log(`Error in event handler for ${event.type}:`, error);
        }
      });
    }
  }

  private _log(message: string, ...args: unknown[]): void {
    if (this._config.debug) {
      console.log(`[DOMElementRegistry] ${message}`, ...args);
    }
  }
}
