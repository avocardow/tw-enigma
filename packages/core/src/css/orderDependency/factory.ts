/**
 * Factory functions for CSS Order Dependency components
 */

import { DEFAULT_ORDER_CONFIG } from './constants';
import { DependencyDetectionEngine } from './dependencyDetection';
import { OrderPreservationAnalyzer } from './orderAnalysis';
import type { OrderHandlingOptions } from './types';

/**
 * Create an OrderPreservationAnalyzer with default or custom configuration
 */
export function createOrderAnalyzer(
  config?: Partial<OrderHandlingOptions>
): OrderPreservationAnalyzer {
  return new OrderPreservationAnalyzer(config);
}

/**
 * Create a DependencyDetectionEngine with default or custom configuration
 */
export function createDependencyEngine(
  config?: Partial<OrderHandlingOptions>
): DependencyDetectionEngine {
  const finalConfig = { ...DEFAULT_ORDER_CONFIG, ...config };
  return new DependencyDetectionEngine(finalConfig);
}

/**
 * Create a complete CSS order handling suite
 */
export function createOrderHandlingSuite(config?: Partial<OrderHandlingOptions>) {
  const finalConfig = { ...DEFAULT_ORDER_CONFIG, ...config };

  return {
    analyzer: createOrderAnalyzer(finalConfig),
    dependencyEngine: createDependencyEngine(finalConfig),
    config: finalConfig,
  };
}
