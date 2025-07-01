# TW-Enigma Pattern Selection API Reference

## Table of Contents

- [Pattern Selection Engine](#pattern-selection-engine)
- [Hierarchy Integration Manager](#hierarchy-integration-manager)
- [Conflict Resolution Framework](#conflict-resolution-framework)
- [Data Types and Interfaces](#data-types-and-interfaces)
- [Configuration Types](#configuration-types)
- [Error Types](#error-types)
- [Utility Functions](#utility-functions)

## Pattern Selection Engine

### Class: `PatternSelectionEngine`

The main class for pattern selection operations.

#### Constructor

```typescript
constructor(
  config: Partial<PatternSelectionConfig> = {},
  conflictResolutionConfig?: Partial<ConflictResolutionConfig>
)
```

**Parameters:**

- `config`: Partial configuration for pattern selection
- `conflictResolutionConfig`: Optional conflict resolution configuration

#### Methods

##### `selectOptimalPatterns()`

```typescript
async selectOptimalPatterns(
  patterns: AggregatedClassData[],
  hierarchyResult?: HierarchyAnalysisResult
): Promise<PatternSelectionResult>
```

Selects optimal patterns based on configured criteria and algorithms.

**Parameters:**

- `patterns`: Array of aggregated class data to analyze
- `hierarchyResult`: Optional hierarchy analysis result for enhanced selection

**Returns:** Promise resolving to `PatternSelectionResult`

**Throws:**

- `PatternSelectionError`: When selection fails
- `ValidationError`: When input validation fails

##### `getPerformanceStats()`

```typescript
getPerformanceStats(): {
  averageProcessingTime: number;
  totalSelections: number;
  cacheHitRate: number;
  failureRate: number;
}
```

Returns performance statistics for monitoring.

**Returns:** Object containing performance metrics

##### `updateConfig()`

```typescript
updateConfig(config: Partial<PatternSelectionConfig>): void
```

Updates engine configuration dynamically.

**Parameters:**

- `config`: Partial configuration to merge with existing config

##### `reset()`

```typescript
reset(): void
```

Resets the engine state, clearing caches and statistics.

## Hierarchy Integration Manager

### Class: `HierarchyIntegrationManager`

Manages hierarchical structure integration in pattern selection.

#### Constructor

```typescript
constructor(config: HierarchyIntegrationConfig)
```

**Parameters:**

- `config`: Configuration for hierarchy integration

#### Methods

##### `integrateHierarchy()`

```typescript
async integrateHierarchy(
  patterns: AggregatedClassData[],
  hierarchyResult: HierarchyAnalysisResult,
  config?: Partial<HierarchyIntegrationConfig>
): Promise<HierarchyIntegrationResult>
```

Integrates hierarchical structures into pattern data.

**Parameters:**

- `patterns`: Input patterns to enhance
- `hierarchyResult`: Hierarchy analysis result
- `config`: Optional configuration override

**Returns:** Promise resolving to `HierarchyIntegrationResult`

##### `detectCircularDependencies()`

```typescript
detectCircularDependencies(patterns: AggregatedClassData[]): CircularDependencyResult
```

Detects circular dependencies in pattern hierarchies.

**Parameters:**

- `patterns`: Patterns to analyze for circular dependencies

**Returns:** `CircularDependencyResult` with detection results

##### `traverseHierarchy()`

```typescript
traverseHierarchy(
  rootPatterns: AggregatedClassData[],
  strategy: TraversalOrder
): AggregatedClassData[]
```

Traverses pattern hierarchy using specified strategy.

**Parameters:**

- `rootPatterns`: Starting patterns for traversal
- `strategy`: Traversal strategy to use

**Returns:** Array of patterns in traversal order

##### `applyInheritanceRules()`

```typescript
applyInheritanceRules(
  pattern: AggregatedClassData,
  parentPattern: AggregatedClassData,
  strategy: InheritanceStrategy
): AggregatedClassData
```

Applies inheritance rules between parent and child patterns.

**Parameters:**

- `pattern`: Child pattern to modify
- `parentPattern`: Parent pattern to inherit from
- `strategy`: Inheritance strategy to apply

**Returns:** Enhanced pattern with inherited properties

## Conflict Resolution Framework

### Class: `ConflictResolutionFramework`

Provides conflict detection and resolution capabilities.

#### Constructor

```typescript
constructor(config: ConflictResolutionConfig)
```

**Parameters:**

- `config`: Configuration for conflict resolution

#### Methods

##### `detectConflicts()`

```typescript
async detectConflicts(
  patterns: AggregatedClassData[],
  hierarchyResult?: HierarchyAnalysisResult
): Promise<PatternConflict[]>
```

Detects conflicts between patterns.

**Parameters:**

- `patterns`: Patterns to analyze for conflicts
- `hierarchyResult`: Optional hierarchy context

**Returns:** Promise resolving to array of detected conflicts

##### `resolveConflicts()`

```typescript
async resolveConflicts(
  conflicts: PatternConflict[],
  patterns: AggregatedClassData[]
): Promise<ConflictResolution[]>
```

Resolves detected conflicts.

**Parameters:**

- `conflicts`: Conflicts to resolve
- `patterns`: Context patterns for resolution

**Returns:** Promise resolving to array of conflict resolutions

##### `getConfig()`

```typescript
getConfig(): ConflictResolutionConfig
```

Returns current configuration.

**Returns:** Current conflict resolution configuration

## Data Types and Interfaces

### `PatternSelectionResult`

Result of pattern selection operation.

```typescript
interface PatternSelectionResult {
  selectedPatterns: SelectedPattern[];
  rejectedPatterns: Array<{
    pattern: AggregatedClassData;
    reason: string;
    alternatives?: string[];
  }>;
  quality: {
    coverage: number;
    performance: number;
    maintainability: number;
    complexity: number;
    conflictResolution: number;
    semanticCoherence: number;
    hierarchicalCoherence: number;
  };
  optimization: {
    algorithm: SelectionAlgorithm;
    iterations: number;
    convergenceAchieved: boolean;
    finalScore: number;
    improvementOverBaseline: number;
  };
  resources: {
    processingTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  conflicts: {
    detected: PatternConflict[];
    resolved: ConflictResolution[];
    unresolved: PatternConflict[];
  };
  recommendations: OptimizationRecommendation[];
  metadata: {
    timestamp: number;
    configSnapshot: PatternSelectionConfig;
    inputPatternCount: number;
    hierarchyUsed: boolean;
    hierarchyIntegration?: {
      rulesApplied: number;
      conflictsResolved: number;
      circularDependencies: boolean;
      processingTime: number;
    };
  };
}
```

### `SelectedPattern`

Represents a selected pattern with metadata.

```typescript
interface SelectedPattern {
  pattern: AggregatedClassData;
  selectionReason: string;
  score: number;
  rank: number;
  optimizations: Array<{
    type: 'consolidation' | 'conflict-resolution' | 'hierarchy-optimization';
    description: string;
    benefit: number;
  }>;
  relationships: Array<{
    relatedPattern: string;
    relationshipType: string;
    strength: number;
  }>;
  metadata: {
    originalRank?: number;
    improvementFactor: number;
    confidenceScore: number;
    hierarchyLevel?: number;
    parentChain?: string[];
  };
}
```

### `HierarchyIntegrationResult`

Result of hierarchy integration operation.

```typescript
interface HierarchyIntegrationResult {
  enhancedPatterns: Array<{
    pattern: AggregatedClassData;
    hierarchyLevel: number;
    parentChain: string[];
    inheritedRules: string[];
    appliedStrategies: InheritanceStrategy[];
  }>;
  traversalPath: string[];
  appliedRules: number;
  resolvedConflicts: number;
  circularDependencies: CircularDependencyResult;
  performance: {
    processingTime: number;
    cacheHits: number;
    traversalSteps: number;
  };
  metadata: {
    strategy: TraversalOrder;
    inheritanceStrategy: InheritanceStrategy;
    maxDepth: number;
    totalPatterns: number;
  };
}
```

### `CircularDependencyResult`

Result of circular dependency detection.

```typescript
interface CircularDependencyResult {
  hasCircularDependencies: boolean;
  cycles: Array<{
    patterns: string[];
    type: 'direct' | 'indirect';
    severity: 'low' | 'medium' | 'high';
    resolution?: string;
  }>;
  affectedPatterns: string[];
  recommendations: string[];
}
```

### `PatternConflict`

Represents a conflict between patterns.

```typescript
interface PatternConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  patterns: string[];
  description: string;
  conflictDetails: {
    property: string;
    values: unknown[];
    context?: string;
  };
  detectionMethod: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

### `ConflictResolution`

Represents a resolution to a pattern conflict.

```typescript
interface ConflictResolution {
  conflictId: string;
  strategy: ResolutionStrategy;
  resolution: string;
  affectedPatterns: string[];
  changes: Array<{
    pattern: string;
    property: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  confidence: number;
  reasoning: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

### `OptimizationRecommendation`

Represents an optimization recommendation.

```typescript
interface OptimizationRecommendation {
  type: 'consolidation' | 'split' | 'hierarchy' | 'performance' | 'semantic';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  patterns: string[];
  estimatedBenefit: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  requiredActions: string[];
}
```

## Configuration Types

### `PatternSelectionConfig`

Main configuration for pattern selection.

```typescript
interface PatternSelectionConfig {
  algorithm: SelectionAlgorithm;
  fallbackAlgorithm: SelectionAlgorithm;
  criteria: SelectionCriteria;
  constraints: SelectionConstraints;
  integration: {
    useHierarchyAnalysis: boolean;
    useConflictResolution: boolean;
    enableIncrementalOptimization: boolean;
    enableParallelProcessing: boolean;
  };
  advanced: {
    genetic: GeneticAlgorithmConfig;
    simulatedAnnealing: SimulatedAnnealingConfig;
    heuristic: HeuristicConfig;
  };
  performance: {
    enableCaching: boolean;
    cacheSize: number;
    enableProfiling: boolean;
    timeoutThreshold: number;
  };
}
```

### `SelectionCriteria`

Weights for different selection criteria.

```typescript
interface SelectionCriteria {
  frequency: number;
  performance: number;
  maintainability: number;
  hierarchy: number;
  conflicts: number;
  consolidation: number;
  semantics: number;
  dependencies: number;
}
```

### `SelectionConstraints`

Constraints for pattern selection.

```typescript
interface SelectionConstraints {
  maxPatterns: number;
  minCoverage: number;
  maxComplexity: number;
  performanceThreshold: number;
  qualityThreshold: number;
  maxMemoryUsage: number;
  maxProcessingTime: number;
  minSemanticCoherence: number;
  maxSemanticRedundancy: number;
  allowCircularDependencies: boolean;
  maxDependencyDepth: number;
}
```

### `HierarchyIntegrationConfig`

Configuration for hierarchy integration.

```typescript
interface HierarchyIntegrationConfig {
  traversalOrder: TraversalOrder;
  inheritanceStrategy: InheritanceStrategy;
  enableCircularDetection: boolean;
  maxTraversalDepth: number;
  cacheResults: boolean;
  conflictResolution: {
    strategy: string;
    maxAttempts: number;
    fallbackToParent: boolean;
  };
  performance: {
    enableParallelTraversal: boolean;
    batchSize: number;
    timeoutPerLevel: number;
  };
}
```

### `ConflictResolutionConfig`

Configuration for conflict resolution.

```typescript
interface ConflictResolutionConfig {
  resolutionStrategy: ResolutionStrategy;
  maxResolutionDepth: number;
  enableAutoResolution: boolean;
  conflictSeverityThreshold: ConflictSeverity;
  timeoutThreshold: number;
  retryAttempts: number;
  fallbackStrategy: ResolutionStrategy;
  logging: {
    enableDetailedLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
}
```

## Enumeration Types

### `SelectionAlgorithm`

Available selection algorithms.

```typescript
type SelectionAlgorithm =
  | 'greedy'
  | 'optimal'
  | 'heuristic'
  | 'machine-learning'
  | 'genetic'
  | 'simulated-annealing'
  | 'dynamic-programming';
```

### `TraversalOrder`

Hierarchy traversal strategies.

```typescript
type TraversalOrder = 'breadth-first' | 'depth-first' | 'level-based' | 'priority-based';
```

### `InheritanceStrategy`

Inheritance rule application strategies.

```typescript
type InheritanceStrategy = 'strict' | 'override' | 'merge' | 'selective';
```

### `ConflictType`

Types of pattern conflicts.

```typescript
type ConflictType = 'semantic' | 'structural' | 'performance' | 'dependency' | 'hierarchy';
```

### `ConflictSeverity`

Severity levels for conflicts.

```typescript
type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';
```

### `ResolutionStrategy`

Conflict resolution strategies.

```typescript
type ResolutionStrategy = 'priority-based' | 'consensus' | 'rule-based' | 'machine-learning';
```

## Error Types

### `PatternSelectionError`

Base error for pattern selection operations.

```typescript
class PatternSelectionError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'PATTERN_SELECTION_ERROR',
    context?: Record<string, unknown>
  );
}
```

### `HierarchyIntegrationError`

Error for hierarchy integration operations.

```typescript
class HierarchyIntegrationError extends PatternSelectionError {
  constructor(message: string, context?: Record<string, unknown>);
}
```

### `ConflictResolutionError`

Error for conflict resolution operations.

```typescript
class ConflictResolutionError extends PatternSelectionError {
  constructor(message: string, context?: Record<string, unknown>);
}
```

### `ValidationError`

Error for input validation failures.

```typescript
class ValidationError extends PatternSelectionError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[], context?: Record<string, unknown>);
}
```

## Utility Functions

### `createPatternSelectionEngine()`

Factory function for creating pattern selection engines.

```typescript
function createPatternSelectionEngine(
  config?: Partial<PatternSelectionConfig>,
  conflictResolutionConfig?: Partial<ConflictResolutionConfig>
): PatternSelectionEngine;
```

**Parameters:**

- `config`: Optional pattern selection configuration
- `conflictResolutionConfig`: Optional conflict resolution configuration

**Returns:** Configured `PatternSelectionEngine` instance

### `selectPatterns()`

Convenience function for one-time pattern selection.

```typescript
async function selectPatterns(
  patterns: AggregatedClassData[],
  hierarchyResult?: HierarchyAnalysisResult,
  config?: Partial<PatternSelectionConfig>
): Promise<PatternSelectionResult>;
```

**Parameters:**

- `patterns`: Patterns to select from
- `hierarchyResult`: Optional hierarchy analysis result
- `config`: Optional configuration

**Returns:** Promise resolving to `PatternSelectionResult`

### `validatePatternSelectionConfig()`

Validates pattern selection configuration.

```typescript
function validatePatternSelectionConfig(config: Partial<PatternSelectionConfig>): ValidationResult;
```

**Parameters:**

- `config`: Configuration to validate

**Returns:** `ValidationResult` with validation status and errors

### `getDefaultPatternSelectionConfig()`

Returns default pattern selection configuration.

```typescript
function getDefaultPatternSelectionConfig(): PatternSelectionConfig;
```

**Returns:** Default configuration object

### `mergePatternSelectionConfigs()`

Merges multiple configuration objects.

```typescript
function mergePatternSelectionConfigs(
  ...configs: Partial<PatternSelectionConfig>[]
): PatternSelectionConfig;
```

**Parameters:**

- `configs`: Configuration objects to merge

**Returns:** Merged configuration

## Constants

### `DEFAULT_PATTERN_SELECTION_CONFIG`

Default configuration for pattern selection.

```typescript
const DEFAULT_PATTERN_SELECTION_CONFIG: PatternSelectionConfig;
```

### `DEFAULT_CONFLICT_RESOLUTION_CONFIG`

Default configuration for conflict resolution.

```typescript
const DEFAULT_CONFLICT_RESOLUTION_CONFIG: ConflictResolutionConfig;
```

### `DEFAULT_HIERARCHY_INTEGRATION_CONFIG`

Default configuration for hierarchy integration.

```typescript
const DEFAULT_HIERARCHY_INTEGRATION_CONFIG: HierarchyIntegrationConfig;
```

## Type Guards

### `isPatternSelectionResult()`

Type guard for pattern selection results.

```typescript
function isPatternSelectionResult(obj: unknown): obj is PatternSelectionResult;
```

### `isSelectedPattern()`

Type guard for selected patterns.

```typescript
function isSelectedPattern(obj: unknown): obj is SelectedPattern;
```

### `isPatternConflict()`

Type guard for pattern conflicts.

```typescript
function isPatternConflict(obj: unknown): obj is PatternConflict;
```

### `isConflictResolution()`

Type guard for conflict resolutions.

```typescript
function isConflictResolution(obj: unknown): obj is ConflictResolution;
```

## Event System

The pattern selection system supports event-driven architecture:

### Events

#### `PatternSelectionStarted`

Emitted when pattern selection begins.

```typescript
interface PatternSelectionStarted {
  timestamp: number;
  patternCount: number;
  algorithm: SelectionAlgorithm;
  config: PatternSelectionConfig;
}
```

#### `PatternSelectionCompleted`

Emitted when pattern selection completes.

```typescript
interface PatternSelectionCompleted {
  timestamp: number;
  result: PatternSelectionResult;
  processingTime: number;
}
```

#### `ConflictDetected`

Emitted when a conflict is detected.

```typescript
interface ConflictDetected {
  timestamp: number;
  conflict: PatternConflict;
  context: string;
}
```

#### `ConflictResolved`

Emitted when a conflict is resolved.

```typescript
interface ConflictResolved {
  timestamp: number;
  resolution: ConflictResolution;
  success: boolean;
}
```

### Event Listener Registration

```typescript
engine.on('selection-started', (event: PatternSelectionStarted) => {
  console.log('Selection started with', event.patternCount, 'patterns');
});

engine.on('conflict-detected', (event: ConflictDetected) => {
  console.log('Conflict detected:', event.conflict.description);
});
```
