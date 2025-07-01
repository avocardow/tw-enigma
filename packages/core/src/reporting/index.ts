/**
 * TW-Enigma Reporting Module
 * Comprehensive reporting system for optimization analytics and export capabilities
 */

// Core schema and types
export * from './schema.js';

// Report generation
export { 
  ReportGenerator,
  createReportGenerator,
  generateSimpleReport
} from './reportGenerator.js';

// HTML report generation
export {
  HtmlReportGenerator,
  generateHtmlReport,
  generateHtmlString
} from './htmlGenerator.js';

// Historical tracking and comparison
export {
  HistoricalTracker,
  createHistoricalTracker
} from './historicalTracker.js';

// Export and sharing capabilities
export {
  ExportManager,
  createExportManager,
  exportReport
} from './exportManager.js';

// Re-export commonly used types for convenience
export type {
  OptimizationReport,
  ReportMetadata,
  OptimizationSummary,
  FileOptimizationResult,
  PerformanceMetrics,
  ConfigurationDetails,
  QualityMetrics
} from './schema.js';