/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * DOM Element Registry Types
 * Defines the data structures for mapping CSS rules to DOM elements
 */

/**
 * CSS rule information extracted from stylesheets
 */
export interface CSSRuleInfo {
  /** The CSS rule object */
  rule: CSSStyleRule;
  /** Original selector text */
  originalSelector: string;
  /** Class name without the leading dot */
  className: string;
  /** Source stylesheet href or null for inline styles */
  stylesheetHref: string | null;
}

/**
 * Element reference using WeakRef for automatic garbage collection
 */
export interface ElementReference {
  /** Weak reference to the DOM element */
  weakRef: WeakRef<Element>;
  /** Element tag name for debugging */
  tagName: string;
  /** Element's current class list snapshot */
  classListSnapshot: string[];
  /** Timestamp when this reference was created */
  createdAt: number;
  /** Whether this element is still connected to the DOM (last known state) */
  isConnected: boolean;
}

/**
 * Registry entry for a single CSS class
 */
export interface ClassRegistryEntry {
  /** CSS rule information */
  cssRule: CSSStyleRule;
  /** Elements that have this class */
  elements: ElementReference[];
  /** Original class name */
  originalClassName: string;
  /** Computed styles cache for performance */
  computedStylesCache?: Map<string, CSSStyleDeclaration>;
  /** Last update timestamp */
  lastUpdated: number;
  /** Usage statistics */
  stats: {
    /** Number of times this class was queried */
    queryCount: number;
    /** Number of elements currently using this class */
    activeElementCount: number;
    /** Peak number of elements that used this class */
    peakElementCount: number;
  };
}

/**
 * Main registry data structure
 */
export interface ClassRegistry {
  /** Map of class names to registry entries */
  [className: string]: ClassRegistryEntry;
}

/**
 * Registry configuration options
 */
export interface RegistryConfig {
  /** Maximum number of classes to track */
  maxRegistrySize: number;
  /** Maximum number of elements per class to track */
  maxElementsPerClass: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Whether to enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Whether to cache computed styles */
  enableComputedStylesCache: boolean;
  /** Debug logging enabled */
  debug: boolean;
}

/**
 * Registry statistics and metrics
 */
export interface RegistryStats {
  /** Total number of tracked classes */
  totalClasses: number;
  /** Total number of tracked elements */
  totalElements: number;
  /** Number of stale element references */
  staleReferences: number;
  /** Memory usage estimate in bytes */
  memoryUsage: number;
  /** Last cleanup timestamp */
  lastCleanup: number;
  /** Cleanup count */
  cleanupCount: number;
  /** Performance metrics */
  performance: {
    /** Average query time in milliseconds */
    averageQueryTime: number;
    /** Average update time in milliseconds */
    averageUpdateTime: number;
    /** Average cleanup time in milliseconds */
    averageCleanupTime: number;
  };
}

/**
 * Registry event types
 */
export type RegistryEventType =
  | 'element-added'
  | 'element-removed'
  | 'class-added'
  | 'class-removed'
  | 'cleanup-completed'
  | 'stats-updated';

/**
 * Registry event data
 */
export interface RegistryEvent {
  type: RegistryEventType;
  className?: string;
  element?: Element;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Registry event handler
 */
export type RegistryEventHandler = (event: RegistryEvent) => void;

/**
 * DOM element registry interface
 */
export interface DOMElementRegistry {
  /** Current registry data */
  readonly registry: ClassRegistry;

  /** Registry configuration */
  readonly config: RegistryConfig;

  /** Current statistics */
  readonly stats: RegistryStats;

  /**
   * Initialize the registry with CSS rule information
   * @param selectors Array of CSS rule information
   * @returns Promise resolving to the built registry
   */
  initialize(selectors: CSSRuleInfo[]): Promise<ClassRegistry>;

  /**
   * Add a class and its elements to the registry
   * @param className Class name to add
   * @param cssRule CSS rule for the class
   * @param elements Elements that have this class
   */
  addClass(className: string, cssRule: CSSStyleRule, elements: Element[]): void;

  /**
   * Remove a class from the registry
   * @param className Class name to remove
   */
  removeClass(className: string): void;

  /**
   * Add an element to an existing class entry
   * @param className Class name
   * @param element Element to add
   */
  addElement(className: string, element: Element): void;

  /**
   * Remove an element from a class entry
   * @param className Class name
   * @param element Element to remove
   */
  removeElement(className: string, element: Element): void;

  /**
   * Get all elements for a class
   * @param className Class name
   * @returns Array of live elements
   */
  getElements(className: string): Element[];

  /**
   * Get CSS rule for a class
   * @param className Class name
   * @returns CSS rule or undefined
   */
  getCSSRule(className: string): CSSStyleRule | undefined;

  /**
   * Check if a class is tracked in the registry
   * @param className Class name
   * @returns True if class is tracked
   */
  hasClass(className: string): boolean;

  /**
   * Get all tracked class names
   * @returns Array of class names
   */
  getClassNames(): string[];

  /**
   * Clean up stale element references and unused classes
   * @returns Number of cleaned up references
   */
  cleanup(): number;

  /**
   * Force a full cleanup of all references
   * @returns Registry statistics after cleanup
   */
  forceCleanup(): RegistryStats;

  /**
   * Get current registry statistics
   * @returns Current statistics
   */
  getStats(): RegistryStats;

  /**
   * Update registry configuration
   * @param config New configuration options
   */
  updateConfig(config: Partial<RegistryConfig>): void;

  /**
   * Add event listener
   * @param type Event type
   * @param handler Event handler
   */
  addEventListener(type: RegistryEventType, handler: RegistryEventHandler): void;

  /**
   * Remove event listener
   * @param type Event type
   * @param handler Event handler
   */
  removeEventListener(type: RegistryEventType, handler: RegistryEventHandler): void;

  /**
   * Destroy the registry and clean up all resources
   */
  destroy(): void;
}

/**
 * Registry Builder interface
 * High-level component for managing registry lifecycle
 */
export interface RegistryBuilder {
  /** Builder configuration */
  readonly config: any;

  /** Performance metrics */
  readonly metrics: any;

  /** Check if builder is destroyed */
  readonly isDestroyed: boolean;

  /** All registry instances */
  readonly registries: ReadonlyMap<string, any>;

  /** Create a new registry instance */
  createRegistry(
    id: string,
    config?: Partial<RegistryConfig>,
    selectors?: CSSRuleInfo[]
  ): Promise<DOMElementRegistry>;

  /** Get an existing registry by ID */
  getRegistry(id: string): DOMElementRegistry | undefined;

  /** Update a registry with new CSS rules */
  updateRegistry(id: string, selectors: CSSRuleInfo[]): Promise<void>;

  /** Destroy a registry instance */
  destroyRegistry(id: string): Promise<void>;

  /** Bulk operations for multiple registries */
  bulkOperation<T>(
    operation: (registry: DOMElementRegistry, id: string) => Promise<T> | T,
    registryIds?: string[]
  ): Promise<Map<string, T | Error>>;

  /** Add event listener to all registries */
  addEventListener(type: RegistryEventType, handler: RegistryEventHandler): void;

  /** Remove event listener from all registries */
  removeEventListener(type: RegistryEventType, handler: RegistryEventHandler): void;

  /** Get aggregated statistics from all registries */
  getAggregatedStats(): RegistryStats & { registryCount: number };

  /** Cleanup all registries */
  cleanup(): Promise<void>;

  /** Destroy the builder and all registries */
  destroy(): Promise<void>;
}

/**
 * Default registry configuration
 */
export const DEFAULT_REGISTRY_CONFIG: RegistryConfig = {
  maxRegistrySize: 1000,
  maxElementsPerClass: 100,
  cleanupInterval: 30000, // 30 seconds
  enablePerformanceMonitoring: true,
  enableComputedStylesCache: false,
  debug: false,
};
