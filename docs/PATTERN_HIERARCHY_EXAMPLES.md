# Pattern Hierarchy Analysis - Usage Examples

This document provides comprehensive examples of how to use the PatternHierarchy system with existing TW-Enigma functionality.

## Table of Contents

1. [Basic Pattern Hierarchy Analysis](#basic-pattern-hierarchy-analysis)
2. [Integration with Multi-Pass Discovery](#integration-with-multi-pass-discovery)
3. [CSS Generation with Hierarchy Insights](#css-generation-with-hierarchy-insights)
4. [Advanced Configuration Examples](#advanced-configuration-examples)
5. [Performance Optimization Examples](#performance-optimization-examples)
6. [Error Handling and Fallbacks](#error-handling-and-fallbacks)

## Basic Pattern Hierarchy Analysis

### Example 1: Standalone Hierarchy Analysis

```typescript
import {
  createPatternHierarchy,
  analyzePatternHierarchy,
  generateFrequencyAnalysis,
} from '@tw-enigma/core';

async function basicHierarchyExample(htmlResults: any[], jsResults: any[]) {
  // Step 1: Generate basic pattern analysis (existing functionality)
  const patternAnalysis = await generateFrequencyAnalysis(htmlResults, jsResults, {
    minFrequency: 2,
    enableCoOccurrenceAnalysis: true,
  });

  // Step 2: Extract data for hierarchy analysis
  const patterns = Array.from(patternAnalysis.frequencyMap.values());
  const coOccurrences = patternAnalysis.coOccurrencePatterns || [];

  // Step 3: Perform hierarchy analysis
  const hierarchyResult = await analyzePatternHierarchy(patterns, coOccurrences);

  // Step 4: Use the results
  console.log(`Found ${hierarchyResult.hierarchy.length} hierarchy nodes`);
  console.log(`Detected ${hierarchyResult.relationships.length} pattern relationships`);
  console.log(`Identified ${hierarchyResult.overlaps.length} pattern overlaps`);

  // Access specific insights
  const highValuePatterns = Array.from(hierarchyResult.scores.entries())
    .filter(([_, score]) => score.overall > 0.8)
    .map(([pattern, score]) => ({ pattern, score: score.overall }));

  console.log('High-value patterns:', highValuePatterns);

  return hierarchyResult;
}
```

### Example 2: Working with Existing AggregatedClassData

```typescript
import { PatternHierarchy, PatternHierarchyConfig, AggregatedClassData } from '@tw-enigma/core';

function workWithExistingData(existingClassData: AggregatedClassData[]) {
  // Create hierarchy analyzer with custom configuration
  const hierarchy = new PatternHierarchy({
    enableSubsetDetection: true,
    enableOverlapAnalysis: true,
    enablePatternScoring: true,
    minOverlapStrength: 0.3,
    maxSubsetDepth: 5,
    performanceOptimization: {
      enableParallelProcessing: true,
      batchSize: 50,
    },
  });

  // Analyze existing data
  return hierarchy.analyzeHierarchy(existingClassData, []);
}
```

## Integration with Multi-Pass Discovery

### Example 3: Enhanced Multi-Pass with Hierarchy Analysis

```typescript
import { MultiPassDiscovery, createPatternHierarchy, PatternHierarchy } from '@tw-enigma/core';

class HierarchyEnhancedMultiPass extends MultiPassDiscovery {
  private patternHierarchy: PatternHierarchy;

  constructor(config: any) {
    super(config);
    this.patternHierarchy = createPatternHierarchy({
      enableSubsetDetection: true,
      enableOverlapAnalysis: true,
      enablePatternScoring: true,
    });
  }

  protected async executePassWithHierarchy(passNumber: number): Promise<any> {
    // Execute standard pass
    const passResult = await super.executePass(passNumber);

    // Get current patterns from the pass
    const currentPatterns = this.getCurrentPatterns();
    const coOccurrences = this.getCoOccurrencePatterns();

    // Add hierarchy analysis
    const hierarchyAnalysis = await this.patternHierarchy.analyzeHierarchy(
      currentPatterns,
      coOccurrences
    );

    // Use hierarchy insights to improve next pass
    const consolidationHints = hierarchyAnalysis.recommendations
      .filter((r) => r.type === 'consolidation')
      .map((r) => r.patterns);

    // Store hierarchy insights for next pass
    this.setConsolidationHints(consolidationHints);

    return {
      ...passResult,
      hierarchyAnalysis,
      consolidationOpportunities: consolidationHints.length,
      patternScores: hierarchyAnalysis.scores,
    };
  }

  private getCurrentPatterns(): any[] {
    // Implementation would depend on your MultiPassDiscovery structure
    return [];
  }

  private getCoOccurrencePatterns(): any[] {
    // Implementation would depend on your MultiPassDiscovery structure
    return [];
  }

  private setConsolidationHints(hints: string[][]): void {
    // Implementation would depend on your MultiPassDiscovery structure
  }
}

// Usage
async function enhancedMultiPassExample() {
  const enhancedDiscovery = new HierarchyEnhancedMultiPass({
    maxPasses: 5,
    convergenceThreshold: 0.01,
  });

  const results = await enhancedDiscovery.executePassWithHierarchy(1);

  console.log('Pass completed with hierarchy insights:');
  console.log(`- Found ${results.consolidationOpportunities} consolidation opportunities`);
  console.log(`- Analyzed ${results.hierarchyAnalysis.relationships.length} relationships`);
}
```

## CSS Generation with Hierarchy Insights

### Example 4: Optimized CSS Generation Using Hierarchy Data

```typescript
import { generateCSS, analyzePatternHierarchy, AggregatedClassData } from '@tw-enigma/core';

async function generateOptimizedCSSWithHierarchy(
  patterns: AggregatedClassData[],
  originalOptions: any
) {
  // Step 1: Perform hierarchy analysis
  const hierarchyAnalysis = await analyzePatternHierarchy(patterns, []);

  // Step 2: Extract optimization hints from hierarchy
  const consolidationGroups = hierarchyAnalysis.recommendations
    .filter((r) => r.type === 'consolidation')
    .map((r) => r.patterns);

  const highValuePatterns = Array.from(hierarchyAnalysis.scores.entries())
    .filter(([_, score]) => score.overall > 0.7)
    .map(([pattern, _]) => pattern);

  const problematicOverlaps = hierarchyAnalysis.overlaps
    .filter((overlap) => overlap.conflictLevel === 'high')
    .map((overlap) => overlap.patterns);

  // Step 3: Create enhanced CSS generation options
  const enhancedOptions = {
    ...originalOptions,

    // Use hierarchy insights for better optimization
    consolidationHints: consolidationGroups,
    priorityPatterns: highValuePatterns,
    conflictResolution: problematicOverlaps,

    // Use pattern scores for ordering
    patternWeights: new Map(
      Array.from(hierarchyAnalysis.scores.entries()).map(([pattern, score]) => [
        pattern,
        score.overall,
      ])
    ),

    // Use subset relationships for better organization
    patternHierarchy: hierarchyAnalysis.hierarchy,
  };

  // Step 4: Generate optimized CSS
  const cssResult = await generateCSS(patterns, enhancedOptions);

  return {
    css: cssResult,
    optimizationInsights: {
      consolidatedGroups: consolidationGroups.length,
      prioritizedPatterns: highValuePatterns.length,
      resolvedConflicts: problematicOverlaps.length,
      hierarchyNodes: hierarchyAnalysis.hierarchy.length,
    },
  };
}
```

### Example 5: CSS Consolidation with Subset Detection

```typescript
import { CompleteConsolidator, analyzePatternHierarchy, PatternSubset } from '@tw-enigma/core';

async function consolidateWithSubsetAwareness(patterns: AggregatedClassData[]) {
  // Analyze pattern hierarchy to find subsets
  const hierarchyAnalysis = await analyzePatternHierarchy(patterns, []);

  // Extract subset relationships
  const subsetGroups = hierarchyAnalysis.hierarchy
    .filter((node) => node.children.length > 0)
    .map((node) => ({
      parent: node.pattern,
      children: node.children.map((child) => child.pattern),
    }));

  // Create consolidator with subset awareness
  const consolidator = new CompleteConsolidator({
    enableSubsetOptimization: true,
    subsetRelationships: subsetGroups,
  });

  // Perform consolidation
  const consolidationResult = await consolidator.consolidate(patterns);

  return {
    ...consolidationResult,
    subsetOptimizations: subsetGroups.length,
  };
}
```

## Advanced Configuration Examples

### Example 6: Custom Hierarchy Configuration for Large Projects

```typescript
import { PatternHierarchyConfig, createPatternHierarchy } from '@tw-enigma/core';

function createLargeProjectHierarchy(): PatternHierarchy {
  const config: PatternHierarchyConfig = {
    // Subset detection configuration
    enableSubsetDetection: true,
    maxSubsetDepth: 8, // Allow deeper nesting for complex projects
    minSubsetCoverage: 0.8,

    // Overlap analysis configuration
    enableOverlapAnalysis: true,
    minOverlapStrength: 0.2, // Lower threshold for large projects
    maxOverlapComplexity: 1000,

    // Pattern scoring configuration
    enablePatternScoring: true,
    scoringWeights: {
      frequency: 0.35, // Higher weight on usage frequency
      reusability: 0.25,
      specificity: 0.15, // Lower weight on specificity
      maintainability: 0.15,
      optimization: 0.1,
    },

    // Performance optimization for large datasets
    performanceOptimization: {
      enableParallelProcessing: true,
      parallelismThreshold: 200, // Use parallel processing for 200+ patterns
      batchSize: 100,
      enableCaching: true,
      cacheSize: 10000,
      operationTimeout: 60000, // 1 minute timeout for complex operations
    },

    // Enhanced relationship detection
    relationshipDetection: {
      enableSemanticAnalysis: true,
      lexicalSimilarityThreshold: 0.6,
      frequencyCorrelationThreshold: 0.3,
      coOccurrenceStrengthThreshold: 0.4,
    },
  };

  return createPatternHierarchy(config);
}
```

### Example 7: Framework-Specific Configuration

```typescript
// Configuration for React/Tailwind projects
function createReactTailwindHierarchy() {
  return createPatternHierarchy({
    enableSubsetDetection: true,
    enableOverlapAnalysis: true,
    enablePatternScoring: true,

    // React-specific patterns
    frameworkSpecific: {
      reactPatterns: {
        componentPrefixes: ['jsx-', 'react-'],
        statePatterns: ['hover:', 'focus:', 'active:'],
        responsivePatterns: ['sm:', 'md:', 'lg:', 'xl:', '2xl:'],
      },
    },

    // Tailwind-specific optimization
    tailwindOptimization: {
      utilityClassDetection: true,
      componentClassDetection: true,
      modifierChainAnalysis: true,
    },
  });
}

// Configuration for Vue/Tailwind projects
function createVueTailwindHierarchy() {
  return createPatternHierarchy({
    enableSubsetDetection: true,
    enableOverlapAnalysis: true,
    enablePatternScoring: true,

    // Vue-specific patterns
    frameworkSpecific: {
      vuePatterns: {
        directivePrefixes: ['v-'],
        slotPatterns: ['slot:'],
        eventPatterns: ['@click:', '@hover:'],
      },
    },
  });
}
```

## Performance Optimization Examples

### Example 8: Large Dataset Processing with Chunking

```typescript
import { createPatternHierarchy } from '@tw-enigma/core';

async function processLargeDataset(patterns: AggregatedClassData[]) {
  const hierarchy = createPatternHierarchy({
    performanceOptimization: {
      enableParallelProcessing: true,
      batchSize: 200,
      enableCaching: true,
      memoryLimit: 1024 * 1024 * 512, // 512MB limit
    },
  });

  // Process in chunks for very large datasets
  const chunkSize = 1000;
  const results = [];

  for (let i = 0; i < patterns.length; i += chunkSize) {
    const chunk = patterns.slice(i, i + chunkSize);
    console.log(
      `Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(patterns.length / chunkSize)}`
    );

    const chunkResult = await hierarchy.analyzeHierarchy(chunk, []);
    results.push(chunkResult);

    // Optional: Clear cache between chunks to manage memory
    hierarchy.clearCache();
  }

  // Merge results
  return mergeHierarchyResults(results);
}

function mergeHierarchyResults(results: any[]): any {
  // Implementation to merge multiple hierarchy analysis results
  const merged = {
    hierarchy: [],
    relationships: [],
    overlaps: [],
    scores: new Map(),
    recommendations: [],
  };

  for (const result of results) {
    merged.hierarchy.push(...result.hierarchy);
    merged.relationships.push(...result.relationships);
    merged.overlaps.push(...result.overlaps);

    // Merge scores
    for (const [pattern, score] of result.scores) {
      merged.scores.set(pattern, score);
    }

    merged.recommendations.push(...result.recommendations);
  }

  return merged;
}
```

### Example 9: Real-time Pattern Analysis with Incremental Updates

```typescript
import { createPatternHierarchy, IncrementalAnalysisFramework } from '@tw-enigma/core';

class RealTimeHierarchyAnalyzer {
  private hierarchy: PatternHierarchy;
  private incrementalFramework: IncrementalAnalysisFramework;
  private lastAnalysisResult: any;

  constructor() {
    this.hierarchy = createPatternHierarchy({
      enableSubsetDetection: true,
      enableOverlapAnalysis: true,
      performanceOptimization: {
        enableCaching: true,
        enableParallelProcessing: true,
      },
    });

    this.incrementalFramework = new IncrementalAnalysisFramework({
      enableChangeDetection: true,
      stateValidation: true,
    });
  }

  async updatePatterns(newPatterns: AggregatedClassData[]): Promise<any> {
    // Detect changes using incremental framework
    const changeDetection = await this.incrementalFramework.detectChanges(
      this.lastAnalysisResult?.patterns || [],
      newPatterns
    );

    if (!changeDetection.hasChanges) {
      console.log('No changes detected, returning cached result');
      return this.lastAnalysisResult;
    }

    // Only analyze changed patterns for performance
    const patternsToAnalyze =
      changeDetection.modifiedEntities.length > 0 ? changeDetection.modifiedEntities : newPatterns;

    console.log(
      `Analyzing ${patternsToAnalyze.length} patterns (${changeDetection.modifiedEntities.length} changed)`
    );

    // Perform incremental hierarchy analysis
    const hierarchyResult = await this.hierarchy.analyzeHierarchy(patternsToAnalyze, []);

    // Merge with existing results if this is an incremental update
    if (this.lastAnalysisResult && changeDetection.modifiedEntities.length > 0) {
      this.lastAnalysisResult = this.mergeWithExistingResults(
        this.lastAnalysisResult,
        hierarchyResult,
        changeDetection
      );
    } else {
      this.lastAnalysisResult = hierarchyResult;
    }

    return this.lastAnalysisResult;
  }

  private mergeWithExistingResults(existing: any, newResults: any, changes: any): any {
    // Implementation for merging incremental results
    return {
      ...existing,
      // Update only the changed parts
      ...newResults,
      metadata: {
        ...existing.metadata,
        lastUpdated: Date.now(),
        incrementalUpdate: true,
        changedPatterns: changes.modifiedEntities.length,
      },
    };
  }
}

// Usage
async function realTimeExample() {
  const analyzer = new RealTimeHierarchyAnalyzer();

  // Initial analysis
  let patterns = await getInitialPatterns();
  let result = await analyzer.updatePatterns(patterns);
  console.log('Initial analysis complete:', result);

  // Simulate real-time updates
  setInterval(async () => {
    const updatedPatterns = await getCurrentPatterns();
    const updatedResult = await analyzer.updatePatterns(updatedPatterns);

    if (updatedResult.metadata?.incrementalUpdate) {
      console.log(`Incremental update: ${updatedResult.metadata.changedPatterns} patterns changed`);
    }
  }, 5000); // Check for updates every 5 seconds
}
```

## Error Handling and Fallbacks

### Example 10: Robust Error Handling with Fallbacks

```typescript
import {
  analyzePatternHierarchy,
  analyzePatternRelationships, // Fallback function
  AggregatedClassData,
} from '@tw-enigma/core';

async function robustPatternAnalysis(
  patterns: AggregatedClassData[],
  coOccurrences: any[] = []
): Promise<any> {
  try {
    // Attempt hierarchy analysis
    console.log('Attempting hierarchy analysis...');
    const hierarchyResult = await analyzePatternHierarchy(patterns, coOccurrences);

    console.log('✅ Hierarchy analysis successful');
    return {
      type: 'enhanced',
      result: hierarchyResult,
      features: {
        hierarchyDetection: true,
        overlapAnalysis: true,
        patternScoring: true,
      },
    };
  } catch (hierarchyError) {
    console.warn('⚠️ Hierarchy analysis failed, attempting fallback:', hierarchyError.message);

    try {
      // Fallback to basic pattern relationship analysis
      const basicResult = analyzePatternRelationships(patterns, {
        enableBasicRelationships: true,
      });

      console.log('✅ Basic analysis successful (fallback)');
      return {
        type: 'basic',
        result: basicResult,
        features: {
          hierarchyDetection: false,
          overlapAnalysis: false,
          patternScoring: false,
        },
        fallbackReason: hierarchyError.message,
      };
    } catch (basicError) {
      console.error('❌ Both hierarchy and basic analysis failed');

      // Final fallback - return minimal structure
      return {
        type: 'minimal',
        result: {
          patterns: patterns.map((p) => p.name),
          relationships: [],
          recommendations: [`Analysis failed: ${basicError.message}`],
        },
        features: {
          hierarchyDetection: false,
          overlapAnalysis: false,
          patternScoring: false,
        },
        errors: {
          hierarchyError: hierarchyError.message,
          basicError: basicError.message,
        },
      };
    }
  }
}

// Usage with error handling
async function safeAnalysisExample() {
  const patterns = await getPatterns();
  const result = await robustPatternAnalysis(patterns);

  switch (result.type) {
    case 'enhanced':
      console.log('Using enhanced hierarchy analysis results');
      processEnhancedResults(result.result);
      break;

    case 'basic':
      console.log('Using basic analysis results (hierarchy unavailable)');
      processBasicResults(result.result);
      break;

    case 'minimal':
      console.log('Using minimal results (analysis failed)');
      processMinimalResults(result.result);
      break;
  }

  return result;
}

function processEnhancedResults(result: any) {
  // Handle full hierarchy analysis results
  console.log(`Processing ${result.hierarchy.length} hierarchy nodes`);
  console.log(`Found ${result.overlaps.length} pattern overlaps`);
}

function processBasicResults(result: any) {
  // Handle basic relationship analysis results
  console.log(`Processing ${result.relationships?.length || 0} basic relationships`);
}

function processMinimalResults(result: any) {
  // Handle minimal fallback results
  console.log(`Processing ${result.patterns.length} patterns (minimal mode)`);
}
```

### Example 11: Monitoring and Alerting Integration

```typescript
import { createPatternHierarchy, MetricsTracker } from '@tw-enigma/core';

class MonitoredHierarchyAnalyzer {
  private hierarchy: PatternHierarchy;
  private metricsTracker: MetricsTracker;

  constructor() {
    this.hierarchy = createPatternHierarchy({
      enableSubsetDetection: true,
      enableOverlapAnalysis: true,
      performanceOptimization: {
        operationTimeout: 30000,
        memoryLimit: 1024 * 1024 * 256, // 256MB
      },
    });

    this.metricsTracker = new MetricsTracker({
      enablePerformanceMetrics: true,
      enableResourceMetrics: true,
    });
  }

  async analyzeWithMonitoring(patterns: AggregatedClassData[]): Promise<any> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      // Track metrics during analysis
      this.metricsTracker.startMeasurement('hierarchy-analysis');

      const result = await this.hierarchy.analyzeHierarchy(patterns, []);

      const metrics = this.metricsTracker.endMeasurement('hierarchy-analysis');
      const endTime = Date.now();
      const finalMemory = process.memoryUsage();

      // Calculate resource usage
      const duration = endTime - startTime;
      const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;

      // Check for performance issues
      if (duration > 30000) {
        // 30 seconds
        console.warn(`⚠️ Slow analysis detected: ${duration}ms for ${patterns.length} patterns`);
      }

      if (memoryDelta > 100 * 1024 * 1024) {
        // 100MB
        console.warn(`⚠️ High memory usage: ${Math.round(memoryDelta / 1024 / 1024)}MB delta`);
      }

      return {
        ...result,
        performance: {
          duration,
          memoryDelta,
          patternsPerSecond: patterns.length / (duration / 1000),
          memoryPerPattern: memoryDelta / patterns.length,
        },
      };
    } catch (error) {
      this.metricsTracker.recordError('hierarchy-analysis', error);

      console.error(`❌ Analysis failed after ${Date.now() - startTime}ms:`, error.message);
      throw error;
    }
  }
}
```

## Conclusion

These examples demonstrate the flexibility and power of the PatternHierarchy system when integrated with existing TW-Enigma functionality. The system is designed to enhance rather than replace existing capabilities, providing backward compatibility while offering advanced pattern analysis features.

Key integration patterns:

1. **Progressive Enhancement**: Start with basic functionality and add hierarchy analysis for deeper insights
2. **Fallback Strategies**: Always have backup plans when advanced analysis fails
3. **Performance Awareness**: Use appropriate configurations for your dataset size and performance requirements
4. **Monitoring Integration**: Track performance and resource usage for production deployments
5. **Framework Adaptation**: Customize configurations for specific frameworks and use cases

The PatternHierarchy system scales from simple standalone analysis to complex real-time systems with monitoring and error handling, making it suitable for projects of any size.
