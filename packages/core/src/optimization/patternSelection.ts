/**
 * Core Pattern Selection Algorithms for Intelligent Pattern Optimization
 *
 * This module implements advanced pattern selection algorithms that work with the
 * ConflictResolutionFramework and PatternHierarchy to optimize pattern selection.
 *
 * @file packages/core/src/optimization/patternSelection.ts
 */

import type { AggregatedClassData } from '../processors/patternAnalysis';
import type { HierarchyAnalysisResult } from './patternHierarchy';

import type {
  ConflictResolution,
  ConflictResolutionConfig,
  PatternConflict,
} from './conflictResolution';

import { ConflictResolutionFramework } from './conflictResolution';
import type { HierarchyIntegrationResult } from './hierarchyIntegration';
import { HierarchyIntegrationManager } from './hierarchyIntegration';

/**
 * Selection algorithm types supported
 */
export type SelectionAlgorithm =
  | 'greedy' // Greedy selection based on scores
  | 'optimal' // Branch and bound optimal selection
  | 'heuristic' // Multi-criteria heuristic selection
  | 'machine-learning' // ML-based selection (future enhancement)
  | 'genetic' // Genetic algorithm optimization
  | 'simulated-annealing' // Simulated annealing optimization
  | 'dynamic-programming'; // Dynamic programming approach

/**
 * Selection criteria weights for multi-criteria optimization
 */
export interface SelectionCriteria {
  frequency: number; // Pattern usage frequency weight
  performance: number; // Performance impact weight
  maintainability: number; // Maintainability score weight
  hierarchy: number; // Hierarchy relationship weight
  conflicts: number; // Conflict resolution weight
  consolidation: number; // Consolidation opportunity weight
  semantics: number; // Semantic similarity weight
  dependencies: number; // Dependency chain weight
}

/**
 * Optimization constraints for pattern selection
 */
export interface SelectionConstraints {
  maxPatterns: number; // Maximum number of patterns to select
  minCoverage: number; // Minimum coverage requirement (0-1)
  maxComplexity: number; // Maximum overall complexity score
  performanceThreshold: number; // Minimum performance improvement required
  qualityThreshold: number; // Minimum quality score required

  // Resource constraints
  maxMemoryUsage: number; // Maximum memory usage (bytes)
  maxProcessingTime: number; // Maximum processing time (ms)

  // Semantic constraints
  minSemanticCoherence: number; // Minimum semantic coherence
  maxSemanticRedundancy: number; // Maximum semantic redundancy

  // Dependency constraints
  allowCircularDependencies: boolean; // Allow circular dependencies
  maxDependencyDepth: number; // Maximum dependency chain depth
}

/**
 * Pattern selection result
 */
export interface PatternSelectionResult {
  // Selected patterns
  selectedPatterns: SelectedPattern[];

  // Rejected patterns with reasons
  rejectedPatterns: Array<{
    pattern: AggregatedClassData;
    reason: string;
    alternatives?: string[];
  }>;

  // Quality metrics
  quality: {
    coverage: number; // Pattern coverage achieved (0-1)
    performance: number; // Performance improvement (0-1)
    maintainability: number; // Maintainability score (0-1)
    complexity: number; // Overall complexity score (0-1)
    conflictResolution: number; // Conflict resolution success rate (0-1)
    semanticCoherence: number; // Semantic coherence score (0-1)
    hierarchicalCoherence: number; // Hierarchical coherence score (0-1)
  };

  // Optimization details
  optimization: {
    algorithm: SelectionAlgorithm;
    iterations: number;
    convergenceAchieved: boolean;
    finalScore: number;
    improvementOverBaseline: number;
  };

  // Resource usage
  resources: {
    processingTime: number; // Processing time (ms)
    memoryUsage: number; // Memory usage (bytes)
    cpuUsage: number; // CPU usage percentage
  };

  // Conflict analysis
  conflicts: {
    detected: PatternConflict[];
    resolved: ConflictResolution[];
    unresolved: PatternConflict[];
  };

  // Recommendations for further optimization
  recommendations: OptimizationRecommendation[];

  // Metadata
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

/**
 * Selected pattern with optimization metadata
 */
export interface SelectedPattern {
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

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  type: 'consolidation' | 'split' | 'hierarchy' | 'performance' | 'semantic';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  patterns: string[];
  estimatedBenefit: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  requiredActions: string[];
}

/**
 * Configuration for pattern selection algorithms
 */
export interface PatternSelectionConfig {
  // Algorithm configuration
  algorithm: SelectionAlgorithm;
  fallbackAlgorithm: SelectionAlgorithm;

  // Selection criteria weights
  criteria: SelectionCriteria;

  // Optimization constraints
  constraints: SelectionConstraints;

  // Integration configuration
  integration: {
    useHierarchyAnalysis: boolean; // Use PatternHierarchy analysis
    useConflictResolution: boolean; // Use ConflictResolution framework
    enableIncrementalOptimization: boolean; // Enable incremental optimization
    enableParallelProcessing: boolean; // Enable parallel processing
  };

  // Advanced algorithm settings
  advanced: {
    // Genetic algorithm settings
    genetic: {
      populationSize: number; // Population size for genetic algorithm
      generations: number; // Number of generations
      mutationRate: number; // Mutation rate (0-1)
      crossoverRate: number; // Crossover rate (0-1)
      eliteSize: number; // Elite size for preservation
    };

    // Simulated annealing settings
    simulatedAnnealing: {
      initialTemperature: number; // Initial temperature
      coolingRate: number; // Cooling rate (0-1)
      minTemperature: number; // Minimum temperature
      maxIterations: number; // Maximum iterations
    };

    // Heuristic settings
    heuristic: {
      lookaheadDepth: number; // Lookahead depth for heuristics
      explorationFactor: number; // Exploration vs exploitation factor
      adaptiveLearning: boolean; // Enable adaptive learning
      localSearchSteps: number; // Local search steps
    };
  };

  // Performance tuning
  performance: {
    enableCaching: boolean; // Enable result caching
    cacheSize: number; // Cache size limit
    enableProfiling: boolean; // Enable performance profiling
    timeoutThreshold: number; // Timeout threshold (ms)
  };
}

/**
 * Default configuration for pattern selection
 */
export const DEFAULT_PATTERN_SELECTION_CONFIG: PatternSelectionConfig = {
  algorithm: 'heuristic',
  fallbackAlgorithm: 'greedy',

  criteria: {
    frequency: 0.25,
    performance: 0.2,
    maintainability: 0.15,
    hierarchy: 0.15,
    conflicts: 0.1,
    consolidation: 0.1,
    semantics: 0.03,
    dependencies: 0.02,
  },

  constraints: {
    maxPatterns: 1000,
    minCoverage: 0.8,
    maxComplexity: 0.7,
    performanceThreshold: 0.05,
    qualityThreshold: 0.6,
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    maxProcessingTime: 30000, // 30 seconds
    minSemanticCoherence: 0.7,
    maxSemanticRedundancy: 0.3,
    allowCircularDependencies: false,
    maxDependencyDepth: 10,
  },

  integration: {
    useHierarchyAnalysis: true,
    useConflictResolution: true,
    enableIncrementalOptimization: true,
    enableParallelProcessing: true,
  },

  advanced: {
    genetic: {
      populationSize: 50,
      generations: 100,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      eliteSize: 5,
    },
    simulatedAnnealing: {
      initialTemperature: 1000,
      coolingRate: 0.95,
      minTemperature: 0.1,
      maxIterations: 10000,
    },
    heuristic: {
      lookaheadDepth: 3,
      explorationFactor: 0.2,
      adaptiveLearning: true,
      localSearchSteps: 100,
    },
  },

  performance: {
    enableCaching: true,
    cacheSize: 1000,
    enableProfiling: false,
    timeoutThreshold: 25000, // 25 seconds (5 second buffer)
  },
};

/**
 * Core Pattern Selection Engine
 *
 * Implements advanced pattern selection algorithms with conflict resolution
 * and hierarchy analysis integration.
 */
export class PatternSelectionEngine {
  private config: PatternSelectionConfig;
  private conflictResolver: ConflictResolutionFramework;
  private selectionCache = new Map<string, PatternSelectionResult>();
  private performanceTracker = new Map<string, number>();
  private learningData: Array<{
    input: string;
    output: PatternSelectionResult;
    feedback?: number;
  }> = [];
  private hierarchyIntegrationManager: HierarchyIntegrationManager;

  constructor(
    config: Partial<PatternSelectionConfig> = {},
    conflictResolutionConfig?: Partial<ConflictResolutionConfig>
  ) {
    this.config = { ...DEFAULT_PATTERN_SELECTION_CONFIG, ...config };
    this.conflictResolver = new ConflictResolutionFramework(conflictResolutionConfig);

    // Initialize hierarchy integration manager
    this.hierarchyIntegrationManager = new HierarchyIntegrationManager({
      traversal: {
        order: 'breadth-first',
        maxDepth: 10,
        includeLeafNodes: true,
        respectPriority: true,
      },
      inheritance: {
        strategy: 'merge',
        propagateConflicts: true,
        mergeThreshold: 0.7,
        overridePermissions: ['style', 'behavior', 'structure'],
      },
      circularDependency: {
        detection: 'strict',
        resolution: 'break',
        maxIterations: 1000,
      },
      aggregation: {
        method: 'weighted',
        weights: {
          parent: 0.3,
          child: 0.5,
          sibling: 0.2,
        },
        consensusThreshold: 0.8,
      },
      performance: {
        enableCaching: true,
        parallelTraversal: false,
        lazyEvaluation: false,
      },
    });
  }

  /**
   * Select optimal patterns using the configured algorithm
   */
  public async selectOptimalPatterns(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult
  ): Promise<PatternSelectionResult> {
    const startTime = Date.now();

    try {
      // Validate inputs
      this.validateInputs(patterns);

      // Check cache
      const cacheKey = this.generateCacheKey(patterns, hierarchyResult);
      if (this.config.performance.enableCaching) {
        const cached = this.selectionCache.get(cacheKey);
        if (cached) return cached;
      }

      // Detect and resolve conflicts first
      const conflicts = await this.detectAndResolveConflicts(patterns, hierarchyResult);

      // Apply the main selection algorithm
      const result = await this.executeSelectionAlgorithm(patterns, hierarchyResult, conflicts);

      // Validate results
      const validatedResult = this.validateResult(result);

      // Cache successful results
      if (
        this.config.performance.enableCaching &&
        validatedResult.quality.coverage >= this.config.constraints.minCoverage
      ) {
        this.selectionCache.set(cacheKey, validatedResult);
      }

      // Record performance metrics
      this.performanceTracker.set(`selection-${Date.now()}`, Date.now() - startTime);

      // Update learning data
      if (this.config.advanced.heuristic.adaptiveLearning) {
        this.learningData.push({
          input: cacheKey,
          output: validatedResult,
        });
      }

      return validatedResult;
    } catch (error) {
      // Fallback to simpler algorithm
      if (this.config.algorithm !== this.config.fallbackAlgorithm) {
        return this.executeFallbackSelection(patterns, error, hierarchyResult);
      }
      throw error;
    }
  }

  /**
   * Execute the configured selection algorithm
   */
  private async executeSelectionAlgorithm(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult,
    conflicts?: { detected: PatternConflict[]; resolved: ConflictResolution[] }
  ): Promise<PatternSelectionResult> {
    // Apply hierarchy integration if enabled and hierarchy data available
    let enhancedPatterns = patterns;
    let hierarchyIntegrationResult;

    if (hierarchyResult && this.config.integration.useHierarchyAnalysis) {
      hierarchyIntegrationResult = await this.hierarchyIntegrationManager.integrateHierarchy(
        patterns,
        hierarchyResult
      );

      // Use enhanced patterns with hierarchy metadata
      enhancedPatterns = hierarchyIntegrationResult.enhancedPatterns.map((ep) => ep.pattern);
    }

    let result: PatternSelectionResult;
    switch (this.config.algorithm) {
      case 'greedy':
        result = await this.executeGreedySelection(enhancedPatterns, hierarchyResult, conflicts);
        break;

      case 'optimal':
        result = await this.executeOptimalSelection(enhancedPatterns, hierarchyResult, conflicts);
        break;

      case 'heuristic':
        result = await this.executeHeuristicSelection(enhancedPatterns, hierarchyResult, conflicts);
        break;

      case 'genetic':
        result = await this.executeGeneticSelection(enhancedPatterns, hierarchyResult, conflicts);
        break;

      case 'simulated-annealing':
        result = await this.executeSimulatedAnnealingSelection(
          enhancedPatterns,
          hierarchyResult,
          conflicts
        );
        break;

      case 'dynamic-programming':
        result = await this.executeDynamicProgrammingSelection(
          enhancedPatterns,
          hierarchyResult,
          conflicts
        );
        break;

      default:
        throw new Error(`Unknown selection algorithm: ${this.config.algorithm}`);
    }

    // Enhance result with hierarchy integration data
    if (hierarchyIntegrationResult) {
      // Update selected patterns with hierarchy metadata
      result.selectedPatterns = result.selectedPatterns.map((sp) => {
        const enhancedPattern = hierarchyIntegrationResult.enhancedPatterns.find(
          (ep: any) => ep.pattern.name === sp.pattern.name
        );

        if (enhancedPattern) {
          // Add hierarchy-specific optimizations
          const hierarchyOptimization = {
            type: 'hierarchy-optimization' as const,
            description: `Level ${enhancedPattern.hierarchyLevel} pattern with ${enhancedPattern.childrenCount} children`,
            benefit: enhancedPattern.effectiveRules.size * 0.1,
          };

          sp.optimizations.push(hierarchyOptimization);

          // Update metadata with hierarchy info
          sp.metadata = {
            ...sp.metadata,
            hierarchyLevel: enhancedPattern.hierarchyLevel,
            parentChain: enhancedPattern.parentChain,
          };
        }

        return sp;
      });

      // Add hierarchy metrics to quality assessment
      result.quality = {
        ...result.quality,
        hierarchicalCoherence: this.calculateHierarchicalCoherence(
          result.selectedPatterns,
          hierarchyIntegrationResult
        ),
      };

      // Add hierarchy recommendations
      const hierarchyRecommendations = this.generateHierarchyRecommendations(
        result.selectedPatterns,
        hierarchyIntegrationResult
      );
      result.recommendations.push(...hierarchyRecommendations);

      // Update metadata
      result.metadata = {
        ...result.metadata,
        hierarchyIntegration: {
          rulesApplied: hierarchyIntegrationResult.propagation.rulesApplied,
          conflictsResolved: hierarchyIntegrationResult.propagation.conflictsResolved,
          circularDependencies:
            hierarchyIntegrationResult.circularDependencies.hasCircularDependency,
          processingTime: hierarchyIntegrationResult.metrics.traversalTime,
        },
      };
    }

    return result;
  }

  /**
   * Greedy selection algorithm - selects patterns with highest scores first
   */
  private async executeGreedySelection(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult,
    conflicts?: { detected: PatternConflict[]; resolved: ConflictResolution[] }
  ): Promise<PatternSelectionResult> {
    const startTime = Date.now();

    // Calculate scores for all patterns
    const scoredPatterns = patterns.map((pattern, index) => ({
      pattern,
      score: this.calculatePatternScore(pattern, hierarchyResult),
      rank: index,
    }));

    // Sort by score (highest first)
    scoredPatterns.sort((a, b) => b.score - a.score);

    // Greedy selection respecting constraints
    const selected: SelectedPattern[] = [];
    const rejected: Array<{
      pattern: AggregatedClassData;
      reason: string;
      alternatives?: string[];
    }> = [];

    let currentComplexity = 0;
    for (const { pattern, score, rank } of scoredPatterns) {
      const patternComplexity = this.calculatePatternComplexity(pattern);

      // Check constraints
      if (selected.length >= this.config.constraints.maxPatterns) {
        rejected.push({
          pattern,
          reason: 'Maximum pattern limit reached',
          alternatives: this.findPatternAlternatives(pattern, selected),
        });
        continue;
      }

      if (currentComplexity + patternComplexity > this.config.constraints.maxComplexity) {
        rejected.push({
          pattern,
          reason: 'Would exceed complexity threshold',
          alternatives: this.findLowerComplexityAlternatives(pattern, patterns),
        });
        continue;
      }

      // Add to selection
      selected.push({
        pattern,
        selectionReason: `Greedy selection - score: ${score.toFixed(3)}`,
        score,
        rank: selected.length,
        optimizations: this.identifyPatternOptimizations(pattern, hierarchyResult),
        relationships: this.identifyPatternRelationships(pattern, hierarchyResult),
        metadata: {
          originalRank: rank,
          improvementFactor: score,
          confidenceScore: 0.8, // High confidence for greedy selection
        },
      });

      currentComplexity += patternComplexity;
    }

    return this.buildSelectionResult(
      selected,
      rejected,
      conflicts || { detected: [], resolved: [] },
      'greedy',
      {
        processingTime: Date.now() - startTime,
        iterations: patterns.length,
        convergenceAchieved: true,
      }
    );
  }

  /**
   * Heuristic selection algorithm - multi-criteria optimization
   */
  private async executeHeuristicSelection(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult,
    conflicts?: { detected: PatternConflict[]; resolved: ConflictResolution[] }
  ): Promise<PatternSelectionResult> {
    const startTime = Date.now();
    let iterations = 0;
    let bestSolution = await this.executeGreedySelection(patterns, hierarchyResult, conflicts);
    let currentSolution = bestSolution;

    // Multi-criteria heuristic optimization
    while (iterations < this.config.advanced.heuristic.localSearchSteps) {
      iterations++;

      // Generate neighboring solution
      const neighborSolution = await this.generateNeighborSolution(
        currentSolution,
        patterns,
        hierarchyResult,
        conflicts
      );

      // Evaluate neighbor
      const neighborScore = this.calculateSolutionScore(neighborSolution);
      const currentScore = this.calculateSolutionScore(currentSolution);
      const bestScore = this.calculateSolutionScore(bestSolution);

      // Update current solution (exploration vs exploitation)
      const explorationThreshold = this.config.advanced.heuristic.explorationFactor;
      if (neighborScore > currentScore || Math.random() < explorationThreshold) {
        currentSolution = neighborSolution;
      }

      // Update best solution
      if (neighborScore > bestScore) {
        bestSolution = neighborSolution;
      }

      // Early convergence check
      if (iterations % 10 === 0) {
        const improvement = this.calculateImprovement(bestSolution, currentSolution);
        if (improvement < 0.001) break; // Converged
      }

      // Timeout check
      if (Date.now() - startTime > this.config.performance.timeoutThreshold) {
        break;
      }
    }

    // Update metadata
    bestSolution.optimization = {
      algorithm: 'heuristic',
      iterations,
      convergenceAchieved: iterations < this.config.advanced.heuristic.localSearchSteps,
      finalScore: this.calculateSolutionScore(bestSolution),
      improvementOverBaseline: this.calculateImprovement(
        bestSolution,
        await this.executeGreedySelection(patterns, hierarchyResult, conflicts)
      ),
    };

    bestSolution.resources.processingTime = Date.now() - startTime;

    return bestSolution;
  }

  /**
   * Detect and resolve conflicts using the ConflictResolutionFramework
   */
  private async detectAndResolveConflicts(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult
  ): Promise<{ detected: PatternConflict[]; resolved: ConflictResolution[] }> {
    if (!this.config.integration.useConflictResolution) {
      return { detected: [], resolved: [] };
    }

    // Detect conflicts
    const detected = await this.conflictResolver.detectConflicts(patterns, hierarchyResult);

    // Resolve conflicts
    const resolved = await this.conflictResolver.resolveConflicts(
      detected,
      patterns,
      hierarchyResult
    );

    return { detected, resolved };
  }

  /**
   * Calculate comprehensive pattern score using multiple criteria
   */
  private calculatePatternScore(
    pattern: AggregatedClassData,
    hierarchyResult?: HierarchyAnalysisResult,
    _hierarchyIntegration?: HierarchyIntegrationResult
  ): number {
    const criteria = this.config.criteria;
    let score = 0;

    // Frequency score
    const frequencyScore = Math.min(pattern.totalFrequency / 100, 1);
    score += frequencyScore * criteria.frequency;

    // Performance score
    const performanceScore = this.calculatePatternPerformanceScore(pattern);
    score += performanceScore * criteria.performance;

    // Maintainability score
    const maintainabilityScore = this.calculateMaintainabilityScore(pattern);
    score += maintainabilityScore * criteria.maintainability;

    // Hierarchy score
    if (hierarchyResult && this.config.integration.useHierarchyAnalysis) {
      const hierarchyScore = hierarchyResult.scores.get(pattern.name)?.overall || 0;
      score += hierarchyScore * criteria.hierarchy;
    }

    // Consolidation potential score
    const consolidationScore = this.calculateConsolidationPotential(pattern, hierarchyResult);
    score += consolidationScore * criteria.consolidation;

    // Semantic score
    const semanticScore = this.calculateSemanticScore(pattern);
    score += semanticScore * criteria.semantics;

    // Dependency score
    const dependencyScore = this.calculateDependencyScore(pattern);
    score += dependencyScore * criteria.dependencies;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate pattern complexity for constraint checking
   */
  private calculatePatternComplexity(pattern: AggregatedClassData): number {
    // Simple complexity based on name structure and usage patterns
    const nameComplexity = pattern.name.split('-').length * 0.1;
    const coOccurrenceComplexity = pattern.coOccurrences.size * 0.05;
    const contextComplexity = (pattern.contexts.html.length + pattern.contexts.jsx.length) * 0.02;

    return Math.min(nameComplexity + coOccurrenceComplexity + contextComplexity, 1.0);
  }

  /**
   * Calculate pattern coverage contribution
   */
  private calculatePatternCoverage(
    pattern: AggregatedClassData,
    allPatterns: AggregatedClassData[]
  ): number {
    const totalFrequency = allPatterns.reduce((sum, p) => sum + p.totalFrequency, 0);
    return pattern.totalFrequency / totalFrequency;
  }

  /**
   * Build comprehensive selection result
   */
  private buildSelectionResult(
    selected: SelectedPattern[],
    rejected: Array<{ pattern: AggregatedClassData; reason: string; alternatives?: string[] }>,
    conflicts: { detected: PatternConflict[]; resolved: ConflictResolution[] },
    algorithm: SelectionAlgorithm,
    optimizationData: {
      processingTime: number;
      iterations: number;
      convergenceAchieved: boolean;
    }
  ): PatternSelectionResult {
    const allPatterns = [...selected.map((s) => s.pattern), ...rejected.map((r) => r.pattern)];

    return {
      selectedPatterns: selected,
      rejectedPatterns: rejected,

      quality: {
        coverage: this.calculateTotalCoverage(selected, allPatterns),
        performance: this.calculatePerformanceQuality(selected),
        maintainability: this.calculateMaintainabilityQuality(selected),
        complexity: this.calculateComplexityQuality(selected),
        conflictResolution:
          conflicts.resolved.length > 0
            ? conflicts.resolved.filter((r) => r.success).length / conflicts.resolved.length
            : 1.0,
        semanticCoherence: this.calculateSemanticCoherence(selected),
        hierarchicalCoherence: 0, // Will be calculated if needed
      },

      optimization: {
        algorithm,
        iterations: optimizationData.iterations,
        convergenceAchieved: optimizationData.convergenceAchieved,
        finalScore: this.calculateFinalScore(selected),
        improvementOverBaseline: 0, // Will be calculated if needed
      },

      resources: {
        processingTime: optimizationData.processingTime,
        memoryUsage: this.estimateMemoryUsage(selected),
        cpuUsage: this.estimateCpuUsage(optimizationData.processingTime),
      },

      conflicts: {
        detected: conflicts.detected,
        resolved: conflicts.resolved,
        unresolved: conflicts.detected.filter(
          (d) => !conflicts.resolved.some((r) => r.conflictId === d.id && r.success)
        ),
      },

      recommendations: this.generateOptimizationRecommendations(selected, rejected),

      metadata: {
        timestamp: Date.now(),
        configSnapshot: { ...this.config },
        inputPatternCount: allPatterns.length,
        hierarchyUsed: this.config.integration.useHierarchyAnalysis,
      },
    };
  }

  // Additional helper methods would be implemented here...
  // For brevity, I'll provide placeholder implementations

  private validateInputs(patterns: AggregatedClassData[]): void {
    if (!patterns || patterns.length === 0) {
      throw new Error('No patterns provided for selection');
    }
  }

  private generateCacheKey(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult
  ): string {
    const patternHash = patterns
      .map((p) => p.name)
      .sort()
      .join(',');
    const configHash = JSON.stringify(this.config);
    const hierarchyHash = hierarchyResult
      ? JSON.stringify({
          hierarchy: hierarchyResult.hierarchy.length,
          relationships: hierarchyResult.relationships.length,
        })
      : 'no-hierarchy';

    return `${patternHash}-${configHash}-${hierarchyHash}`;
  }

  private validateResult(result: PatternSelectionResult): PatternSelectionResult {
    if (result.quality.coverage < this.config.constraints.minCoverage) {
      throw new Error(
        `Coverage ${result.quality.coverage.toFixed(3)} below minimum ${this.config.constraints.minCoverage}`
      );
    }

    return result;
  }

  private async executeFallbackSelection(
    patterns: AggregatedClassData[],
    _error: unknown,
    hierarchyResult?: HierarchyAnalysisResult
  ): Promise<PatternSelectionResult> {
    const fallbackConfig = { ...this.config, algorithm: this.config.fallbackAlgorithm };
    const fallbackEngine = new PatternSelectionEngine(fallbackConfig);

    const result = await fallbackEngine.selectOptimalPatterns(patterns, hierarchyResult);
    result.optimization.algorithm = this.config.fallbackAlgorithm;
    result.metadata.configSnapshot.algorithm = this.config.fallbackAlgorithm;

    return result;
  }

  // Placeholder implementations for additional algorithms
  private async executeOptimalSelection(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult,
    conflicts?: { detected: PatternConflict[]; resolved: ConflictResolution[] }
  ): Promise<PatternSelectionResult> {
    // Would implement branch-and-bound optimal selection
    return this.executeGreedySelection(patterns, hierarchyResult, conflicts);
  }

  private async executeGeneticSelection(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult,
    conflicts?: { detected: PatternConflict[]; resolved: ConflictResolution[] }
  ): Promise<PatternSelectionResult> {
    // Would implement genetic algorithm
    return this.executeHeuristicSelection(patterns, hierarchyResult, conflicts);
  }

  private async executeSimulatedAnnealingSelection(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult,
    conflicts?: { detected: PatternConflict[]; resolved: ConflictResolution[] }
  ): Promise<PatternSelectionResult> {
    // Would implement simulated annealing
    return this.executeHeuristicSelection(patterns, hierarchyResult, conflicts);
  }

  private async executeDynamicProgrammingSelection(
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult,
    conflicts?: { detected: PatternConflict[]; resolved: ConflictResolution[] }
  ): Promise<PatternSelectionResult> {
    // Would implement dynamic programming approach
    return this.executeOptimalSelection(patterns, hierarchyResult, conflicts);
  }

  // Placeholder helper methods
  private calculatePatternPerformanceScore(pattern: AggregatedClassData): number {
    const complexity = pattern.name.split('-').length;
    return Math.max(1 - complexity * 0.1, 0);
  }

  private calculateMaintainabilityScore(pattern: AggregatedClassData): number {
    const readability = pattern.name.length <= 20 ? 1 : 0.5;
    const consistency = pattern.patterns.prefixes.length <= 3 ? 1 : 0.7;
    return (readability + consistency) / 2;
  }

  private calculateConsolidationPotential(
    pattern: AggregatedClassData,
    hierarchyResult?: HierarchyAnalysisResult
  ): number {
    if (!hierarchyResult) return 0;

    const recommendations = hierarchyResult.recommendations.filter(
      (r) => r.type === 'consolidation' && r.patterns.includes(pattern.name)
    );

    return recommendations.length > 0 ? 0.8 : 0.2;
  }

  private calculateSemanticScore(pattern: AggregatedClassData): number {
    // Simple semantic score based on pattern structure
    const hasSemanticName = /^(text|bg|border|m|p|w|h|flex|grid)-/.test(pattern.name);
    return hasSemanticName ? 0.8 : 0.4;
  }

  private calculateDependencyScore(pattern: AggregatedClassData): number {
    // Dependency score based on co-occurrence patterns
    return Math.min(pattern.coOccurrences.size / 10, 1);
  }

  private findPatternAlternatives(
    pattern: AggregatedClassData,
    selected: SelectedPattern[]
  ): string[] {
    // Find similar patterns in selected set
    return selected
      .filter((s) => this.calculatePatternSimilarity(pattern, s.pattern) > 0.5)
      .map((s) => s.pattern.name)
      .slice(0, 3);
  }

  private findLowerComplexityAlternatives(
    pattern: AggregatedClassData,
    patterns: AggregatedClassData[]
  ): string[] {
    const patternComplexity = this.calculatePatternComplexity(pattern);

    return patterns
      .filter(
        (p) =>
          this.calculatePatternComplexity(p) < patternComplexity &&
          this.calculatePatternSimilarity(pattern, p) > 0.3
      )
      .map((p) => p.name)
      .slice(0, 3);
  }

  private calculatePatternSimilarity(
    pattern1: AggregatedClassData,
    pattern2: AggregatedClassData
  ): number {
    // Simple similarity based on name prefix matching
    const parts1 = pattern1.name.split('-');
    const parts2 = pattern2.name.split('-');

    let commonParts = 0;
    const maxParts = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) commonParts++;
    }

    return commonParts / maxParts;
  }

  private identifyPatternOptimizations(
    pattern: AggregatedClassData,
    hierarchyResult?: HierarchyAnalysisResult
  ): Array<{
    type: 'consolidation' | 'conflict-resolution' | 'hierarchy-optimization';
    description: string;
    benefit: number;
  }> {
    const optimizations: Array<{
      type: 'consolidation' | 'conflict-resolution' | 'hierarchy-optimization';
      description: string;
      benefit: number;
    }> = [];

    if (hierarchyResult) {
      const recommendations = hierarchyResult.recommendations.filter((r) =>
        r.patterns.includes(pattern.name)
      );

      for (const rec of recommendations) {
        optimizations.push({
          type: rec.type as any,
          description: rec.description,
          benefit: rec.estimatedImpact.performance,
        });
      }
    }

    return optimizations;
  }

  private identifyPatternRelationships(
    pattern: AggregatedClassData,
    hierarchyResult?: HierarchyAnalysisResult
  ): Array<{
    relatedPattern: string;
    relationshipType: string;
    strength: number;
  }> {
    if (!hierarchyResult) return [];

    return hierarchyResult.relationships
      .filter((r) => r.sourcePattern === pattern.name || r.targetPattern === pattern.name)
      .map((r) => ({
        relatedPattern: r.sourcePattern === pattern.name ? r.targetPattern : r.sourcePattern,
        relationshipType: r.type,
        strength: r.strength,
      }));
  }

  private async generateNeighborSolution(
    currentSolution: PatternSelectionResult,
    patterns: AggregatedClassData[],
    hierarchyResult?: HierarchyAnalysisResult,
    conflicts?: { detected: PatternConflict[]; resolved: ConflictResolution[] }
  ): Promise<PatternSelectionResult> {
    // Simple neighbor generation: swap one selected pattern with one rejected pattern
    const selected = [...currentSolution.selectedPatterns];
    const rejected = [...currentSolution.rejectedPatterns];

    if (selected.length === 0 || rejected.length === 0) {
      return currentSolution;
    }

    // Random swap
    const selectedIndex = Math.floor(Math.random() * selected.length);
    const rejectedIndex = Math.floor(Math.random() * rejected.length);

    const swapOut = selected[selectedIndex];
    const swapIn = rejected[rejectedIndex];

    // Create new solution
    const newSelected = selected.filter((_, i) => i !== selectedIndex);
    newSelected.push({
      pattern: swapIn.pattern,
      selectionReason: 'Neighbor generation swap',
      score: this.calculatePatternScore(swapIn.pattern, hierarchyResult),
      rank: newSelected.length,
      optimizations: this.identifyPatternOptimizations(swapIn.pattern, hierarchyResult),
      relationships: this.identifyPatternRelationships(swapIn.pattern, hierarchyResult),
      metadata: {
        improvementFactor: 1,
        confidenceScore: 0.5,
      },
    });

    const newRejected = rejected.filter((_, i) => i !== rejectedIndex);
    newRejected.push({
      pattern: swapOut.pattern,
      reason: 'Neighbor generation swap',
    });

    return this.buildSelectionResult(
      newSelected,
      newRejected,
      conflicts || { detected: [], resolved: [] },
      'heuristic',
      {
        processingTime: 0,
        iterations: 1,
        convergenceAchieved: false,
      }
    );
  }

  private calculateSolutionScore(solution: PatternSelectionResult): number {
    const weights = {
      coverage: 0.3,
      performance: 0.25,
      maintainability: 0.2,
      complexity: -0.15, // Negative because lower complexity is better
      conflictResolution: 0.1,
    };

    return (
      solution.quality.coverage * weights.coverage +
      solution.quality.performance * weights.performance +
      solution.quality.maintainability * weights.maintainability +
      (1 - solution.quality.complexity) * Math.abs(weights.complexity) +
      solution.quality.conflictResolution * weights.conflictResolution
    );
  }

  private calculateImprovement(
    solution1: PatternSelectionResult,
    solution2: PatternSelectionResult
  ): number {
    const score1 = this.calculateSolutionScore(solution1);
    const score2 = this.calculateSolutionScore(solution2);
    return score1 - score2;
  }

  // Quality calculation methods
  private calculateTotalCoverage(
    selected: SelectedPattern[],
    allPatterns: AggregatedClassData[]
  ): number {
    const selectedFrequency = selected.reduce((sum, s) => sum + s.pattern.totalFrequency, 0);
    const totalFrequency = allPatterns.reduce((sum, p) => sum + p.totalFrequency, 0);
    return totalFrequency > 0 ? selectedFrequency / totalFrequency : 0;
  }

  private calculatePerformanceQuality(selected: SelectedPattern[]): number {
    const avgPerformanceScore =
      selected.reduce((sum, s) => sum + this.calculatePatternPerformanceScore(s.pattern), 0) /
      selected.length;
    return avgPerformanceScore;
  }

  private calculateMaintainabilityQuality(selected: SelectedPattern[]): number {
    const avgMaintainabilityScore =
      selected.reduce((sum, s) => sum + this.calculateMaintainabilityScore(s.pattern), 0) /
      selected.length;
    return avgMaintainabilityScore;
  }

  private calculateComplexityQuality(selected: SelectedPattern[]): number {
    const avgComplexity =
      selected.reduce((sum, s) => sum + this.calculatePatternComplexity(s.pattern), 0) /
      selected.length;
    return avgComplexity;
  }

  private calculateSemanticCoherence(selected: SelectedPattern[]): number {
    // Simple semantic coherence based on pattern naming consistency
    const patterns = selected.map((s) => s.pattern.name);
    const prefixes = patterns.map((p) => p.split('-')[0]);
    const uniquePrefixes = new Set(prefixes);

    // Higher coherence when patterns share common prefixes
    return 1 - uniquePrefixes.size / patterns.length;
  }

  private calculateFinalScore(selected: SelectedPattern[]): number {
    return selected.reduce((sum, s) => sum + s.score, 0) / selected.length;
  }

  private estimateMemoryUsage(selected: SelectedPattern[]): number {
    // Rough memory estimation in bytes
    const baseUsage = 10240; // 10KB base
    const perPatternUsage = 512; // 512 bytes per pattern
    return baseUsage + selected.length * perPatternUsage;
  }

  private estimateCpuUsage(processingTime: number): number {
    // Rough CPU usage percentage estimate
    const baselineTime = 1000; // 1 second baseline
    return Math.min((processingTime / baselineTime) * 100, 100);
  }

  private generateOptimizationRecommendations(
    selected: SelectedPattern[],
    rejected: Array<{ pattern: AggregatedClassData; reason: string; alternatives?: string[] }>
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Recommend consolidation for similar selected patterns
    const similarGroups = this.findSimilarPatternGroups(selected);
    for (const group of similarGroups) {
      if (group.length > 1) {
        recommendations.push({
          type: 'consolidation',
          priority: 'medium',
          description: `Consider consolidating ${group.length} similar patterns`,
          patterns: group.map((p) => p.pattern.name),
          estimatedBenefit: group.length * 0.1,
          implementationComplexity: 'medium',
          requiredActions: [
            'Analyze pattern usage',
            'Create consolidated pattern',
            'Update references',
          ],
        });
      }
    }

    // Recommend alternatives for high-complexity rejected patterns
    const highComplexityRejected = rejected.filter(
      (r) => this.calculatePatternComplexity(r.pattern) > 0.5 && r.alternatives
    );

    for (const rejected_pattern of highComplexityRejected) {
      recommendations.push({
        type: 'split',
        priority: 'low',
        description: `Consider splitting complex pattern: ${rejected_pattern.pattern.name}`,
        patterns: [rejected_pattern.pattern.name],
        estimatedBenefit: 0.2,
        implementationComplexity: 'high',
        requiredActions: [
          'Analyze pattern components',
          'Create simpler alternatives',
          'Migrate usage',
        ],
      });
    }

    return recommendations;
  }

  private findSimilarPatternGroups(selected: SelectedPattern[]): SelectedPattern[][] {
    const groups: SelectedPattern[][] = [];
    const processed = new Set<string>();

    for (const pattern of selected) {
      if (processed.has(pattern.pattern.name)) continue;

      const similarPatterns = selected.filter(
        (s) =>
          !processed.has(s.pattern.name) &&
          this.calculatePatternSimilarity(pattern.pattern, s.pattern) > 0.7
      );

      if (similarPatterns.length > 1) {
        groups.push(similarPatterns);
        similarPatterns.forEach((p) => processed.add(p.pattern.name));
      }
    }

    return groups;
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats() {
    const processingTimes = Array.from(this.performanceTracker.values());
    return {
      cacheSize: this.selectionCache.size,
      averageProcessingTime:
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length || 0,
      totalSelections: this.performanceTracker.size,
      learningDataSize: this.learningData.length,
    };
  }

  /**
   * Clear caches and reset performance monitoring
   */
  public reset(): void {
    this.selectionCache.clear();
    this.performanceTracker.clear();
    this.learningData.length = 0;
    this.conflictResolver.reset();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PatternSelectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate hierarchical coherence score
   */
  private calculateHierarchicalCoherence(
    selectedPatterns: SelectedPattern[],
    hierarchyIntegration: HierarchyIntegrationResult
  ): number {
    if (!hierarchyIntegration || selectedPatterns.length === 0) {
      return 1.0;
    }

    let coherenceScore = 0;
    let pairCount = 0;

    // Check coherence between selected patterns
    for (let i = 0; i < selectedPatterns.length; i++) {
      for (let j = i + 1; j < selectedPatterns.length; j++) {
        const pattern1 = selectedPatterns[i].pattern.name;
        const pattern2 = selectedPatterns[j].pattern.name;

        const enhanced1 = hierarchyIntegration.enhancedPatterns.find(
          (ep: any) => ep.pattern.name === pattern1
        );
        const enhanced2 = hierarchyIntegration.enhancedPatterns.find(
          (ep: any) => ep.pattern.name === pattern2
        );

        if (enhanced1 && enhanced2) {
          // Check if patterns are in the same hierarchy branch
          const shareParent = enhanced1.parentChain.some((p: string) =>
            enhanced2.parentChain.includes(p)
          );
          const levelDiff = Math.abs(enhanced1.hierarchyLevel - enhanced2.hierarchyLevel);

          // Higher score for patterns that are related and at similar levels
          const pairCoherence = shareParent ? 0.8 : 0.4;
          const levelFactor = 1 - levelDiff * 0.1;

          coherenceScore += pairCoherence * levelFactor;
          pairCount++;
        }
      }
    }

    return pairCount > 0 ? coherenceScore / pairCount : 0.5;
  }

  /**
   * Generate hierarchy-based recommendations
   */
  private generateHierarchyRecommendations(
    selectedPatterns: SelectedPattern[],
    hierarchyIntegration: HierarchyIntegrationResult
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for missing parent patterns
    const selectedNames = new Set(selectedPatterns.map((sp) => sp.pattern.name));
    const missingParents = new Set<string>();

    hierarchyIntegration.enhancedPatterns.forEach((ep: any) => {
      if (selectedNames.has(ep.pattern.name)) {
        ep.parentChain.forEach((parent: string) => {
          if (!selectedNames.has(parent)) {
            missingParents.add(parent);
          }
        });
      }
    });

    if (missingParents.size > 0) {
      recommendations.push({
        type: 'hierarchy',
        priority: 'high',
        description: 'Consider including parent patterns for better hierarchical consistency',
        patterns: Array.from(missingParents),
        estimatedBenefit: 0.2 * missingParents.size,
        implementationComplexity: 'low',
        requiredActions: [
          'Review parent patterns',
          'Assess if parent patterns provide valuable abstractions',
          'Include parent patterns if they improve maintainability',
        ],
      });
    }

    // Check for circular dependencies
    if (hierarchyIntegration.circularDependencies.hasCircularDependency) {
      recommendations.push({
        type: 'hierarchy',
        priority: 'critical',
        description: 'Circular dependencies detected in pattern hierarchy',
        patterns: Array.from(hierarchyIntegration.circularDependencies.affectedPatterns),
        estimatedBenefit: 0.5,
        implementationComplexity: 'high',
        requiredActions: [
          'Analyze circular dependency cycles',
          'Refactor patterns to break cycles',
          'Consider merging or splitting patterns',
        ],
      });
    }

    // Check for orphaned leaf patterns
    const leafPatterns = hierarchyIntegration.enhancedPatterns.filter(
      (ep) => ep.childrenCount === 0 && ep.hierarchyLevel > 2
    );

    if (leafPatterns.length > selectedPatterns.length * 0.3) {
      recommendations.push({
        type: 'consolidation',
        priority: 'medium',
        description: 'Many isolated leaf patterns detected',
        patterns: leafPatterns.slice(0, 5).map((ep) => ep.pattern.name),
        estimatedBenefit: 0.3,
        implementationComplexity: 'medium',
        requiredActions: [
          'Review leaf patterns for consolidation opportunities',
          'Group similar leaf patterns under common parents',
          'Create intermediate abstraction levels',
        ],
      });
    }

    return recommendations;
  }
}

/**
 * Factory function to create a pattern selection engine
 */
export function createPatternSelectionEngine(
  config?: Partial<PatternSelectionConfig>,
  conflictResolutionConfig?: Partial<ConflictResolutionConfig>
): PatternSelectionEngine {
  return new PatternSelectionEngine(config, conflictResolutionConfig);
}

/**
 * Utility function for quick pattern selection with default configuration
 */
export async function selectPatterns(
  patterns: AggregatedClassData[],
  hierarchyResult?: HierarchyAnalysisResult,
  config?: Partial<PatternSelectionConfig>
): Promise<PatternSelectionResult> {
  const engine = createPatternSelectionEngine(config);
  return engine.selectOptimalPatterns(patterns, hierarchyResult);
}
