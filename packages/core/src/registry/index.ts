/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * DOM Element Registry Module
 * Provides factory functions and utilities for creating and managing DOM element registries
 */

export { DOMElementRegistryImpl } from './DOMElementRegistry';

// Registry Builder exports
export {
  createRegistryBuilder,
  destroyGlobalRegistryBuilder,
  getGlobalRegistryBuilder,
  RegistryBuilderError,
  RegistryBuilder as RegistryBuilderImpl,
} from './RegistryBuilder';

export type { BuilderMetrics, RegistryBuilderConfig, RegistryInstance } from './RegistryBuilder';

// Memory Manager exports
export {
  createMemoryManager,
  DEFAULT_MEMORY_CONFIG,
  destroyGlobalMemoryManager,
  getGlobalMemoryManager,
  MemoryManager,
} from './MemoryManager';

export type {
  FrameworkLifecycleManager,
  MemoryLeakReport,
  MemoryManagerConfig,
  MemoryPressureLevel,
  MemoryStats,
} from './MemoryManager';

// Stress Tester exports
export { StressTester } from './StressTester';

export type { ScenarioName, ScenarioOptions, StressTestReport } from './StressTester';

// Re-export types for convenience
export type {
  ClassRegistry,
  ClassRegistryEntry,
  CSSRuleInfo,
  DOMElementRegistry,
  ElementReference,
  RegistryBuilder,
  RegistryConfig,
  RegistryEvent,
  RegistryEventHandler,
  RegistryEventType,
  RegistryStats,
} from '../types/registry';

export { DEFAULT_REGISTRY_CONFIG } from '../types/registry';

import type { CSSRuleInfo, DOMElementRegistry, RegistryConfig } from '../types/registry';
import { DOMElementRegistryImpl } from './DOMElementRegistry';

/**
 * Create a new DOM element registry instance
 * @param config Optional configuration for the registry
 * @returns New DOM element registry instance
 */
export function createRegistry(config?: Partial<RegistryConfig>): DOMElementRegistry {
  return new DOMElementRegistryImpl(config);
}

/**
 * Build a registry from CSS rule information
 * @param selectors Array of CSS rule information
 * @param config Optional configuration for the registry
 * @returns Promise resolving to initialized registry
 */
export async function buildRegistry(
  selectors: CSSRuleInfo[],
  config?: Partial<RegistryConfig>
): Promise<DOMElementRegistry> {
  const registry = createRegistry(config);
  await registry.initialize(selectors);
  return registry;
}

/**
 * Utility function to create a simple registry for testing
 * @param classNames Array of class names to track
 * @param config Optional configuration
 * @returns Promise resolving to initialized registry
 */
export async function createTestRegistry(
  classNames: string[],
  config?: Partial<RegistryConfig>
): Promise<DOMElementRegistry> {
  const registry = createRegistry(config);

  // Create mock CSS rules for testing
  const mockSelectors: CSSRuleInfo[] = classNames.map((className) => ({
    rule: {} as CSSStyleRule, // Mock rule for testing
    originalSelector: `.${className}`,
    className,
    stylesheetHref: null,
  }));

  await registry.initialize(mockSelectors);
  return registry;
}
