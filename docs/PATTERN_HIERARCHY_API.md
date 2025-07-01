# Pattern Hierarchy API Reference

This document provides a complete API reference for the PatternHierarchy system, including all classes, interfaces, types, and functions.

## Core Classes

### PatternHierarchy

Main class for pattern hierarchy analysis that extends existing pattern relationship analysis.

```typescript
class PatternHierarchy {
  constructor(config?: Partial<PatternHierarchyConfig>);

  async analyzeHierarchy(
    patterns: AggregatedClassData[],
    coOccurrencePatterns: CoOccurrencePattern[]
  ): Promise<HierarchyAnalysisResult>;

  clearCache(): void;
  getConfig(): PatternHierarchyConfig;
  updateConfig(config: Partial<PatternHierarchyConfig>): void;
}
```

#### Methods

##### `analyzeHierarchy(patterns, coOccurrencePatterns)`

**Parameters:**

- `patterns: AggregatedClassData[]` - Array of aggregated class data from existing pattern analysis
- `coOccurrencePatterns: CoOccurrencePattern[]` - Co-occurrence patterns from existing analysis

**Returns:** `Promise<HierarchyAnalysisResult>`

**Description:** Performs comprehensive hierarchy analysis including relationship detection, overlap analysis, subset detection, pattern scoring, and graph construction.

##### `clearCache()`

**Returns:** `void`

**Description:** Clears internal caches to free memory. Useful when processing large datasets in chunks.

##### `getConfig()`

**Returns:** `PatternHierarchyConfig`

**Description:** Returns the current configuration object.

##### `updateConfig(config)`

**Parameters:**

- `config: Partial<PatternHierarchyConfig>` - Configuration updates to apply

**Returns:** `void`

**Description:** Updates the configuration with the provided partial configuration object.

## Configuration Types

### PatternHierarchyConfig

```typescript
interface PatternHierarchyConfig {
  // Subset detection configuration
  enableSubsetDetection: boolean;
  maxSubsetDepth: number;
  minSubsetCoverage: number;

  // Overlap analysis configuration
  enableOverlapAnalysis: boolean;
  minOverlapStrength: number;
  maxOverlapComplexity: number;

  // Pattern scoring configuration
  enablePatternScoring: boolean;
  scoringWeights: {
    frequency: number;
    reusability: number;
    specificity: number;
    maintainability: number;
    optimization: number;
  };

  // Performance optimization
  performanceOptimization: {
    enableParallelProcessing: boolean;
    parallelismThreshold: number;
    batchSize: number;
    enableCaching: boolean;
    cacheSize: number;
    operationTimeout: number;
    memoryLimit?: number;
  };

  // Relationship detection
  relationshipDetection: {
    enableSemanticAnalysis: boolean;
    lexicalSimilarityThreshold: number;
    frequencyCorrelationThreshold: number;
    coOccurrenceStrengthThreshold: number;
  };
}
```

## Data Types

### HierarchyAnalysisResult

Main result type returned by `analyzeHierarchy()`.

```typescript
interface HierarchyAnalysisResult {
  hierarchy: HierarchyNode[];
  relationships: PatternRelationship[];
  overlaps: PatternOverlap[];
  subsets: PatternSubset[];
  scores: Map<string, PatternScore>;
  graph: PatternGraph;
  recommendations: HierarchyRecommendation[];
  metadata: {
    analysisTimestamp: number;
    totalPatterns: number;
    processingTime: number;
    cacheHits: number;
    cacheMisses: number;
    memoryUsage: number;
  };
}
```

### PatternRelationship

Represents a relationship between two patterns.

```typescript
interface PatternRelationship {
  id: string;
  sourcePattern: string;
  targetPattern: string;
  type: RelationshipType;
  strength: number;
  confidence: number;
  evidence: RelationshipEvidence[];
  metadata: {
    detectedAt: number;
    algorithm: string;
    computationTime: number;
  };
}
```

### RelationshipType

```typescript
enum RelationshipType {
  SUBSET = 'subset',
  SUPERSET = 'superset',
  OVERLAP = 'overlap',
  DISJOINT = 'disjoint',
  SEMANTIC = 'semantic',
  FREQUENCY = 'frequency',
  CO_OCCURRENCE = 'co-occurrence',
}
```

### RelationshipEvidence

```typescript
interface RelationshipEvidence {
  type: 'lexical' | 'structural' | 'frequency' | 'cooccurrence' | 'semantic';
  value: number;
  description: string;
  sourceData?: any;
}
```

### HierarchyNode

Represents a node in the pattern hierarchy tree.

```typescript
interface HierarchyNode {
  pattern: string;
  level: number;
  children: HierarchyNode[];
  parent?: string;
  metadata: {
    patternComplexity: number;
    consolidationPotential: number;
    usageFrequency: number;
  };
}
```

### PatternOverlap

Represents an overlap between patterns.

```typescript
interface PatternOverlap {
  patterns: string[];
  overlapSize: number;
  overlapClasses: string[];
  strength: number;
  type: 'partial' | 'complete' | 'hierarchical';
  conflictLevel: 'none' | 'low' | 'medium' | 'high';
}
```

### PatternSubset

Represents a subset relationship between patterns.

```typescript
interface PatternSubset {
  subsetPattern: string;
  supersetPattern: string;
  coverage: number;
  sharedTokens: string[];
  uniqueTokens: string[];
  confidence: number;
}
```

### PatternScore

Comprehensive scoring for a pattern.

```typescript
interface PatternScore {
  overall: number;
  frequency: number;
  reusability: number;
  specificity: number;
  maintainability: number;
  optimization: number;
  breakdown: {
    frequencyScore: number;
    reusabilityScore: number;
    specificityScore: number;
    maintainabilityScore: number;
    optimizationScore: number;
  };
}
```

### PatternGraph

Graph representation of pattern relationships.

```typescript
interface PatternGraph {
  nodes: Array<{
    id: string;
    pattern: string;
    score: number;
    metadata: any;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: RelationshipType;
    strength: number;
    metadata: any;
  }>;
  metrics: GraphMetrics;
}
```

### GraphMetrics

Metrics about the pattern graph structure.

```typescript
interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageClusteringCoefficient: number;
  connectedComponents: number;
  averagePathLength: number;
  modularity: number;
}
```

### HierarchyRecommendation

Actionable recommendations based on hierarchy analysis.

```typescript
interface HierarchyRecommendation {
  type: 'consolidation' | 'optimization' | 'refactoring' | 'cleanup';
  patterns: string[];
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  estimatedSavings: {
    cssSize?: number;
    complexity?: number;
    maintainability?: number;
  };
  actionSteps: string[];
}
```

## Utility Functions

### `createPatternHierarchy(config?)`

Factory function to create a PatternHierarchy instance.

```typescript
function createPatternHierarchy(config?: Partial<PatternHierarchyConfig>): PatternHierarchy;
```

### `analyzePatternHierarchy(patterns, coOccurrencePatterns)`

Convenience function for one-off hierarchy analysis.

```typescript
async function analyzePatternHierarchy(
  patterns: AggregatedClassData[],
  coOccurrencePatterns: CoOccurrencePattern[]
): Promise<HierarchyAnalysisResult>;
```

## Integration with Existing Types

### AggregatedClassData (Existing Type)

The PatternHierarchy system is fully compatible with existing `AggregatedClassData` from the pattern analysis system.

```typescript
interface AggregatedClassData {
  name: string;
  totalFrequency: number;
  htmlFrequency: number;
  jsxFrequency: number;
  sources: SourceAttribution;
  contexts: { html: any[]; jsx: any[] };
  patterns: { prefixes: string[]; modifiers: string[]; variants: string[] };
  coOccurrences: Map<string, number>;
  validation?: ValidationResult;
}
```

### CoOccurrencePattern (Existing Type)

Compatible with existing co-occurrence analysis.

```typescript
interface CoOccurrencePattern {
  classes: string[];
  frequency: number;
  strength: number;
  contexts: string[];
}
```

## Error Types

### HierarchyAnalysisError

```typescript
class HierarchyAnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public patterns?: string[],
    public originalError?: Error
  )
}
```

Common error codes:

- `INVALID_INPUT` - Invalid input patterns or configuration
- `MEMORY_LIMIT_EXCEEDED` - Analysis exceeded memory limits
- `TIMEOUT_EXCEEDED` - Analysis timed out
- `CACHE_ERROR` - Internal caching error
- `COMPUTATION_ERROR` - Error during pattern computation

## Performance Considerations

### Memory Usage

The PatternHierarchy system is designed to handle large pattern sets efficiently:

- **Small datasets (< 100 patterns)**: ~1-5MB memory usage
- **Medium datasets (100-1000 patterns)**: ~5-50MB memory usage
- **Large datasets (1000+ patterns)**: ~50-500MB memory usage

### Processing Time

Typical processing times for hierarchy analysis:

- **Small datasets (< 100 patterns)**: 100-500ms
- **Medium datasets (100-1000 patterns)**: 1-10 seconds
- **Large datasets (1000+ patterns)**: 10-60 seconds

### Optimization Recommendations

1. **Enable parallel processing** for datasets > 200 patterns
2. **Use appropriate batch sizes** (50-200 patterns per batch)
3. **Enable caching** for repeated analysis
4. **Set memory limits** to prevent out-of-memory errors
5. **Use timeouts** to prevent infinite processing

## Examples

### Basic Usage

```typescript
import { createPatternHierarchy, AggregatedClassData } from '@tw-enigma/core';

const patterns: AggregatedClassData[] = [...]; // Your pattern data
const hierarchy = createPatternHierarchy();
const result = await hierarchy.analyzeHierarchy(patterns, []);

console.log(`Found ${result.relationships.length} relationships`);
console.log(`Generated ${result.recommendations.length} recommendations`);
```

### Advanced Configuration

```typescript
const hierarchy = createPatternHierarchy({
  enableSubsetDetection: true,
  enableOverlapAnalysis: true,
  enablePatternScoring: true,
  performanceOptimization: {
    enableParallelProcessing: true,
    batchSize: 100,
    operationTimeout: 30000,
  },
  scoringWeights: {
    frequency: 0.4,
    reusability: 0.3,
    specificity: 0.1,
    maintainability: 0.1,
    optimization: 0.1,
  },
});
```

### Error Handling

```typescript
try {
  const result = await hierarchy.analyzeHierarchy(patterns, []);
  // Handle successful result
} catch (error) {
  if (error instanceof HierarchyAnalysisError) {
    switch (error.code) {
      case 'MEMORY_LIMIT_EXCEEDED':
        // Reduce batch size or clear cache
        break;
      case 'TIMEOUT_EXCEEDED':
        // Increase timeout or use simpler analysis
        break;
      default:
        // Handle other errors
        break;
    }
  }
}
```

## Compatibility Notes

### Backward Compatibility

The PatternHierarchy system is designed to be fully backward compatible with existing TW-Enigma functionality:

- ✅ Compatible with existing `AggregatedClassData` types
- ✅ Compatible with existing `CoOccurrencePattern` types
- ✅ Does not modify existing pattern analysis workflows
- ✅ Can be used alongside existing `analyzePatternRelationships()` function
- ✅ Provides enhanced data that supplements existing analysis

### Version Requirements

- **Minimum Node.js**: 16.0.0
- **TypeScript**: 4.5.0+
- **TW-Enigma Core**: 1.0.0+

## See Also

- [Pattern Hierarchy Integration Guide](./PATTERN_HIERARCHY_INTEGRATION.md)
- [Pattern Hierarchy Usage Examples](./PATTERN_HIERARCHY_EXAMPLES.md)
- [TW-Enigma Core Documentation](../README.md)
