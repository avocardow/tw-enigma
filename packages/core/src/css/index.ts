/**
 * CSS Processing and Analysis Modules
 *
 * Exports all CSS-related functionality including order dependency handling,
 * formatting, validation, and output integration.
 */

// Order Dependency Handling System
export * from './orderDependency';

// Core CSS Processing (existing modules)
export { ApplyDirectiveCreator } from './applyDirectiveCreator';
export { CssFormatter } from './cssFormatter';
export { CssOutputIntegration } from './cssOutputIntegration';
export { EdgeCaseHandler } from './edgeCaseHandler';
export { CssSyntaxValidator } from './syntaxValidator';

// Custom Property Detection and Optimization
export { 
  CustomPropertyDetector,
  createCustomPropertyDetector,
  scanCustomProperties
} from './customPropertyDetector';
export type {
  CustomPropertyDeclaration,
  CustomPropertyUsage,
  PropertyScope,
  VariableMap,
  DetectionOptions,
  ProcessingError
} from './customPropertyDetector';

export {
  CustomPropertyOptimizer,
  createCustomPropertyOptimizer,
  analyzeCustomPropertyOptimizations
} from './customPropertyOptimizer';
export type {
  OptimizationStrategy,
  OptimizationAction,
  OptimizationReport,
  OptimizationWarning,
  OptimizationOptions
} from './customPropertyOptimizer';

export {
  CustomPropertyConsolidator,
  createCustomPropertyConsolidator,
  createConsolidationPlan
} from './customPropertyConsolidator';
export type {
  ConsolidationGroup,
  ConsolidationResult,
  ConsolidationChange,
  ConsolidationError,
  RefactoringPlan,
  ConsolidationAction,
  ConsolidationRisk,
  VariableCategory,
  ConsolidationOptions
} from './customPropertyConsolidator';

export {
  CustomPropertyPreserver,
  createCustomPropertyPreserver,
  analyzePreservation
} from './customPropertyPreserver';
export type {
  PreservationRule,
  PreservationCondition,
  ScopeViolation,
  PreservationReport,
  ScopeOptimization,
  RollbackInfo,
  ChangeRecord,
  RollbackInstruction,
  PreservationOptions
} from './customPropertyPreserver';

export {
  CustomPropertyFallbackHandler,
  createCustomPropertyFallbackHandler,
  analyzeFallbacks
} from './customPropertyFallbackHandler';
export type {
  FallbackConfiguration,
  BrowserTarget,
  PolyfillConfiguration,
  FallbackStrategy,
  FallbackContext,
  FallbackAnalysis,
  FallbackMissing,
  FallbackInvalid,
  FallbackSuggestion,
  CompatibilityWarning,
  PolyfillRecommendation,
  FallbackTransformResult,
  FallbackTransformation,
  FallbackError,
  FallbackStats
} from './customPropertyFallbackHandler';

export {
  CustomPropertyDocumentationGenerator,
  createCustomPropertyDocumentationGenerator,
  generateCustomPropertyDocumentation
} from './customPropertyDocumentationGenerator';
export type {
  DocumentationConfiguration,
  DocumentationMetadata,
  DocumentationFormat,
  VariableDocumentation,
  ValueInfo,
  ValueComponent,
  ScopeInfo,
  UsageInfo,
  UsageContext,
  UsagePattern,
  DependencyInfo,
  ExampleInfo,
  OptimizationNote,
  DeprecationInfo,
  BrowserSupport,
  DocumentationIndex,
  DocumentationSummary,
  CategoryIndex,
  FileIndex,
  VariableIndex
} from './customPropertyDocumentationGenerator';

export {
  CustomPropertyPerformanceTuner,
  createCustomPropertyPerformanceTuner,
  analyzePerformance
} from './customPropertyPerformanceTuner';
export type {
  PerformanceConfiguration,
  PerformanceEnvironment,
  EnvironmentConfig,
  BenchmarkConfiguration,
  HtmlTemplate,
  TestScenario,
  ExpectedPerformance,
  PerformanceThresholds,
  ReportConfiguration,
  PerformanceReport,
  FileSizeAnalysis,
  SelectorAnalysis,
  RuntimeBenchmarks,
  BenchmarkResult,
  PerformanceMetric,
  RegressionAnalysis,
  OptimizationSuggestion,
  BenchmarkSuite,
  PerformanceBaseline,
  PerformanceComparison,
  PerformanceTrend
} from './customPropertyPerformanceTuner';

export {
  CustomPropertyCompatibilityTester,
  createCustomPropertyCompatibilityTester,
  runCompatibilityTests
} from './customPropertyCompatibilityTester';
export type {
  CompatibilityTestConfiguration,
  TestEnvironment,
  EnvironmentFeatures,
  EnvironmentTestConfig,
  CssInJsFramework,
  CssInJsConfig,
  CssInJsTestPattern,
  BrowserTarget,
  BrowserSupportMatrix,
  SupportLevel,
  DeviceType,
  ScreenSize,
  DevicePerformance,
  TestExpectation,
  ReportingConfiguration,
  ReportAggregation,
  CompatibilityTestResults,
  TestSummary,
  EnvironmentTestResult,
  FrameworkTestResult,
  BrowserTestResult,
  DeviceTestResult,
  TestResult,
  TestOutput,
  TestError,
  AssertionResult,
  PerformanceMetrics,
  RenderTiming,
  ResourceUsage,
  NetworkPerformance,
  CssMetrics,
  PerformanceAnalysis,
  PerformanceTrend,
  PerformanceDataPoint,
  PerformanceBottleneck,
  PerformanceOptimization,
  PerformanceRegression,
  CompatibilityMatrix,
  EnvironmentCompatibility,
  FrameworkCompatibility,
  BrowserCompatibility,
  FeatureSupport,
  CompatibilityIssue,
  CssInJsIssue,
  PolyfillEffectiveness,
  RenderingQuality,
  ResponsiveBehavior,
  BatteryImpact,
  NetworkRequest,
  Screenshot,
  CompatibilityRecommendation,
  PerformanceImpact
} from './customPropertyCompatibilityTester';
