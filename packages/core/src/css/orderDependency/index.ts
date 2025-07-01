/**
 * CSS Order Dependency Handling System
 *
 * This module provides comprehensive CSS order and specificity analysis
 * to preserve cascade behavior during optimization processes.
 */

// Core Analysis Components
export { DependencyDetectionEngine } from './dependencyDetection';
export { OrderPreservationAnalyzer } from './orderAnalysis';
export { ReorderingLogic } from './reorderingLogic';
export { SpecificityCalculator } from './specificityCalculation';

// Reporting and Configuration
export { OrderHandlingConfig } from './configuration';
export { ConflictReporter } from './conflictReporting';

// Types and Interfaces
export type {
  CSSRule,
  ConflictReport,
  DependencyGraph,
  OrderConstraint,
  OrderHandlingOptions,
  ReorderingResult,
  RuleOrder,
  SpecificityInfo,
} from './types';

// Utilities
export { createDependencyEngine, createOrderAnalyzer } from './factory';

// Constants
export { CONFLICT_SEVERITY_LEVELS, DEFAULT_ORDER_CONFIG, SPECIFICITY_WEIGHTS } from './constants';
