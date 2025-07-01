/**
 * Performance System - Main Entry Point
 * Exports all performance testing and benchmarking components
 */

export { TemplateLiteralPerformanceTester } from './templateLiteralPerformanceTester';
export { PerformanceBenchmarkRunner } from './performanceBenchmarkRunner';

// Re-export types for convenience
export type {
  PerformanceTestConfig,
  PerformanceMetrics,
  StressTestResult,
} from './templateLiteralPerformanceTester';

export type {
  BenchmarkConfig,
  BenchmarkResult,
} from './performanceBenchmarkRunner';