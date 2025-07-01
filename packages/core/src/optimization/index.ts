/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export {
  CompleteConsolidator,
  ConsolidationError,
  DEFAULT_CONSOLIDATOR_OPTIONS,
  createCompleteConsolidator,
  quickConsolidate,
} from './completeConsolidator';

export type {
  CompleteConsolidatorOptions,
  ConsolidationResult,
  ExtractionResult,
  FileModification,
} from './completeConsolidator';

// Data Structures
export {
  CoOccurrenceMatrix,
  DEFAULT_DATA_STRUCTURE_CONFIG,
  DataStructureManager,
  NormalizedPatternCache,
  OptimizedFrequencyCounter,
  PatternTrie,
  createDataStructureManager,
  createFrequencyCounter,
  createPatternTrie,
} from './dataStructures';

export type { DataStructureConfig, FrequencyCounter } from './dataStructures';

// Configuration Management
export {
  ConfigFormat,
  ConfigSource,
  ConfigUtils,
  ConfigurationManager,
  FullConfigSchema,
  LoggingConfigSchema,
  MetricsConfigSchema,
  MultiPassConfigSchema,
  PerformanceConfigSchema,
  StateConfigSchema,
  createConfigurationManager,
  getGlobalConfigManager,
  resetGlobalConfigManager,
} from './configurationManager';

export type {
  ConfigChangeEvent,
  ConfigManagerOptions,
  PerformanceConfig as ConfigPerformanceConfig,
  ConfigValidationResult,
  FullConfig,
  IntegrationConfig,
  LoggingConfig,
  MetricsConfig,
  MultiPassConfig,
  StateConfig,
} from './configurationManager';

// Multi-Pass Discovery Engine
export {
  MultiPassDiscovery,
  MultiPassDiscoveryError,
  createMultiPassDiscovery,
} from './multiPassDiscovery';

export type { MultiPassDiscoveryConfig, PassMetrics } from './multiPassDiscovery';

// State Management
export { StateManager, StateSerializer, createStateManager } from './stateManagement';

export type {
  CheckpointMetadata,
  CheckpointResult,
  RecoveryResult,
  SerializableOptimizationState,
  StateManagementConfig,
  StateValidationResult,
} from './stateManagement';

// Metrics Tracking
export {
  MetricsTracker,
  createMetricsTracker,
  validateMetricsTrackingConfig,
} from './metricsTracking';

export type {
  AggregatedMetrics,
  CustomMetricDefinition,
  EnhancedPassMetrics,
  MetricsCollectionContext,
  MetricsExportResult,
  MetricsTrackingConfig,
  PerformanceAlert,
} from './metricsTracking';

// Convergence Detection
export {
  AdvancedConvergenceDetector,
  createAdvancedConvergenceDetector,
  validateConvergenceDetectionConfig,
} from './convergenceDetection';

export type {
  ConvergenceAnalysisResult,
  ConvergenceDetectionConfig,
  EarlyStoppingResult,
  OscillationResult,
  StatisticalTestResult,
  TrendAnalysisResult,
} from './convergenceDetection';

// Integration Interfaces
export {
  DirectLibraryAdapter,
  GrpcApiAdapter,
  IntegrationError,
  IntegrationManager,
  OptimizationRequestSchema,
  OptimizationResponseSchema,
  RestApiAdapter,
  createDirectLibraryAdapter,
  createGrpcApiAdapter,
  createIntegrationManager,
  createRestApiAdapter,
} from './integrationInterfaces';

export type {
  IntegrationAdapter,
  IntegrationMetrics,
  IntegrationConfig as InterfaceIntegrationConfig,
  OptimizationRequest,
  OptimizationResponse,
  ValidationResult,
} from './integrationInterfaces';

// Performance Optimization
export {
  DEFAULT_PERFORMANCE_CONFIG,
  MemoryPool,
  PerformanceOptimizer,
  PerformanceUtils,
  createPerformanceOptimizer,
} from './performanceOptimizer';

export type {
  PerformanceMetrics,
  PerformanceOptimizerConfig,
  VectorizedOperation,
} from './performanceOptimizer';

// Enhanced Discovery Engine
export {
  DiscoveryStateSchema,
  EnhancedDiscovery,
  EnhancedDiscoveryConfigSchema,
  EnhancedDiscoveryResultSchema,
  FileEntitySchema,
  compareDiscoveryResults,
  createEnhancedDiscovery,
  performEnhancedDiscovery,
  performIncrementalDiscovery,
} from './enhancedDiscovery';

export type {
  DiscoveryState,
  EnhancedDiscoveryConfig,
  EnhancedDiscoveryResult,
  FileEntity,
} from './enhancedDiscovery';

// Incremental Analysis Framework
export {
  AnalysisEntitySchema,
  AnalysisStateSchema,
  ChangeDetectionResultSchema,
  IncrementalAnalysisConfigSchema,
  IncrementalAnalysisFramework,
  IncrementalAnalysisResultSchema,
  createIncrementalAnalysisFramework,
  performQuickIncrementalAnalysis,
} from './incrementalAnalysis';

export type {
  AnalysisContext,
  AnalysisEntity,
  AnalysisState,
  ChangeDetectionResult,
  EntityAnalyzer,
  IncrementalAnalysisConfig,
  IncrementalAnalysisResult,
} from './incrementalAnalysis';

// Pattern Detection System
export {
  CSSPatternMatcher,
  KnownPatternSchema,
  PatternAnalysisResultSchema,
  PatternCategory,
  PatternDetectionConfigSchema,
  PatternDetectionEngine,
  PatternDetectionResultSchema,
  PatternEvidenceSchema,
  PatternSeverity,
  PatternType,
  analyzeFilePatterns,
  createPatternDetectionEngine,
} from './patternDetection';

export type {
  KnownPattern,
  PatternAnalysisResult,
  PatternDetectionConfig,
  PatternDetectionResult,
  PatternEvidence,
  PatternMatcher,
} from './patternDetection';

// Pattern Hierarchy Analysis System
export {
  PatternHierarchy,
  PatternHierarchyConfigSchema,
  RelationshipType,
  analyzePatternHierarchy,
  createPatternHierarchy,
} from './patternHierarchy';

export type {
  GraphMetrics,
  HierarchyAnalysisResult,
  HierarchyNode,
  HierarchyRecommendation,
  PatternGraph,
  PatternHierarchyConfig,
  PatternOverlap,
  PatternRelationship,
  PatternScore,
  PatternSubset,
  RelationshipEvidence,
} from './patternHierarchy';

// Conflict Resolution Framework
export {
  ConflictResolutionFramework,
  DEFAULT_CONFLICT_RESOLUTION_CONFIG,
  createConflictResolutionFramework,
} from './conflictResolution';

export type {
  ConflictResolution,
  ConflictResolutionConfig,
  ConflictSeverity,
  ConflictType,
  PatternConflict,
  ResolutionStrategy,
} from './conflictResolution';

// Pattern Selection Algorithms
export {
  DEFAULT_PATTERN_SELECTION_CONFIG,
  PatternSelectionEngine,
  createPatternSelectionEngine,
  selectPatterns,
} from './patternSelection';

export type {
  OptimizationRecommendation,
  PatternSelectionConfig,
  PatternSelectionResult,
  SelectedPattern,
  SelectionAlgorithm,
  SelectionConstraints,
  SelectionCriteria,
} from './patternSelection';

// Consolidation and Optimization Modules
export {
  ConsolidationOptimizationEngine,
  DEFAULT_CONSOLIDATION_CONFIG,
  createConsolidationOptimizationEngine,
  optimizePatterns,
} from './consolidationOptimization';

export type {
  BatchProcessingConfig,
  ConsolidationConfig,
  ConsolidationStrategy,
  IncrementalUpdateConfig,
  OptimizationObjective,
  OptimizationResult,
  ConsolidationResult as PatternConsolidationResult,
} from './consolidationOptimization';

// Export hierarchy integration
export {
  HierarchyIntegrationManager,
  type CircularDependencyResult,
  type HierarchyIntegrationConfig,
  type HierarchyIntegrationResult,
  type InheritanceStrategy,
  type TraversalOrder,
} from './hierarchyIntegration';
