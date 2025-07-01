/**
 * Dry Run Module
 * Provides simulation and testing capabilities for safe operation preview
 */

// Core dry run system (new infrastructure)
export * from './dryRunManager';
export * from './fileSystemInterceptor';
export * from './reportGenerator';
export * from './visualDiff';
export * from './impactEstimator';
export * from './outputManager';
export * from './utils';
export * from './performanceSimulator';
export * from './performanceAnalyzer';
export * from './performanceTestRunner';
export * from './interactiveCLI';

// Legacy dry run components
export * from './dryRunSimulator';
export * from './dryRunReport';
export * from './dryRunStatistics';
export * from './mockFileSystem';

// Default exports for convenience
export { default as DryRunManager } from './dryRunManager';
export { default as FileSystemInterceptor } from './fileSystemInterceptor';
export { default as DryRunReportGenerator } from './reportGenerator';
export { default as VisualDiffGenerator } from './visualDiff';
export { default as ImpactEstimator } from './impactEstimator';
export { default as OutputManager } from './outputManager';
export { default as PerformanceSimulator } from './performanceSimulator';
export { default as PerformanceAnalyzer } from './performanceAnalyzer';
export { default as PerformanceTestRunner } from './performanceTestRunner';
export { default as InteractiveCLI } from './interactiveCLI';
