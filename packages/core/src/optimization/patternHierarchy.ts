/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import type { AggregatedClassData, CoOccurrencePattern } from '../processors/patternAnalysis';
import { createParallelProcessor } from './parallelProcessor';
import { createPerformanceMonitor } from './performanceMonitor';

/**
 * Trie node for efficient pattern subset detection
 */
interface TrieNode {
  token: string;
  patterns: Set<string>;
  children: Map<string, TrieNode>;
  isEndOfPattern: boolean;
}

/**
 * Configuration for pattern hierarchy analysis
 */
export const PatternHierarchyConfigSchema = z.object({
  /** Enable subset detection algorithms */
  enableSubsetDetection: z.boolean().default(true),
  /** Enable overlap analysis */
  enableOverlapAnalysis: z.boolean().default(true),
  /** Enable pattern scoring */
  enablePatternScoring: z.boolean().default(true),
  /** Enable graph-based relationship mapping */
  enableGraphMapping: z.boolean().default(true),
  /** Enable performance monitoring */
  enablePerformanceMonitoring: z.boolean().default(true),
  /** Enable parallel processing for large datasets */
  enableParallelProcessing: z.boolean().default(true),
  /** Minimum pattern frequency for analysis */
  minimumFrequency: z.number().min(1).default(2),
  /** Maximum depth for subset detection */
  maxSubsetDepth: z.number().min(1).default(10),
  /** Minimum overlap strength to consider significant */
  minOverlapStrength: z.number().min(0).max(1).default(0.3),
  /** Cache size for relationship computations */
  cacheSize: z.number().min(10).default(1000),
  /** Timeout for individual operations (ms) */
  operationTimeout: z.number().min(1000).default(30000),
  /** Enable verbose logging */
  verbose: z.boolean().default(false),
});

export type PatternHierarchyConfig = z.infer<typeof PatternHierarchyConfigSchema>;

/**
 * Pattern relationship types
 */
export enum RelationshipType {
  SUBSET = 'subset',
  SUPERSET = 'superset',
  OVERLAP = 'overlap',
  DISJOINT = 'disjoint',
  IDENTICAL = 'identical',
  SEMANTIC = 'semantic',
  FREQUENCY = 'frequency',
  STRUCTURAL = 'structural',
}

/**
 * Pattern relationship definition
 */
export interface PatternRelationship {
  id: string;
  sourcePattern: string;
  targetPattern: string;
  type: RelationshipType;
  strength: number; // 0-1
  confidence: number; // 0-1
  evidence: RelationshipEvidence[];
  metadata: {
    detectedAt: number;
    algorithm: string;
    computationTime: number;
  };
}

/**
 * Evidence supporting a pattern relationship
 */
export interface RelationshipEvidence {
  type: 'frequency' | 'cooccurrence' | 'lexical' | 'structural' | 'semantic';
  value: number;
  description: string;
  sourceData?: any;
}

/**
 * Pattern hierarchy node
 */
export interface HierarchyNode {
  pattern: string;
  data: AggregatedClassData;
  parent?: HierarchyNode;
  children: HierarchyNode[];
  level: number;
  score: number;
  relationships: PatternRelationship[];
}

/**
 * Pattern overlap information
 */
export interface PatternOverlap {
  patterns: string[];
  overlapSize: number;
  overlapClasses: string[];
  strength: number; // 0-1
  type: 'partial' | 'complete' | 'hierarchical';
  conflictLevel: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Pattern subset information
 */
export interface PatternSubset {
  subset: string;
  superset: string;
  subsetClasses: string[];
  coverage: number; // 0-1 (what portion of subset is covered by superset)
  precision: number; // 0-1 (what portion of superset matches subset)
}

/**
 * Pattern scoring criteria
 */
export interface PatternScore {
  pattern: string;
  frequency: number;
  reusability: number; // 0-1
  specificity: number; // 0-1
  maintainability: number; // 0-1
  optimization: number; // 0-1
  overall: number; // 0-1 weighted sum
  breakdown: {
    frequencyScore: number;
    reusabilityScore: number;
    specificityScore: number;
    maintainabilityScore: number;
    optimizationScore: number;
  };
}

/**
 * Graph representation of pattern relationships
 */
export interface PatternGraph {
  nodes: Map<string, HierarchyNode>;
  edges: Map<string, PatternRelationship>;
  adjacencyList: Map<string, string[]>;
  components: string[][]; // Connected components
  cycles: string[][]; // Detected cycles
  metrics: GraphMetrics;
}

/**
 * Graph analysis metrics
 */
export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number; // 0-1
  averageDegree: number;
  maxDegree: number;
  componentCount: number;
  cycleCount: number;
  diameter: number;
  averagePathLength: number;
}

/**
 * Pattern hierarchy analysis result
 */
export interface HierarchyAnalysisResult {
  hierarchy: HierarchyNode[];
  relationships: PatternRelationship[];
  overlaps: PatternOverlap[];
  subsets: PatternSubset[];
  scores: Map<string, PatternScore>;
  graph: PatternGraph;
  recommendations: HierarchyRecommendation[];
  metadata: {
    processedAt: number;
    processingTime: number;
    patternCount: number;
    relationshipCount: number;
    config: PatternHierarchyConfig;
  };
}

/**
 * Optimization recommendations based on hierarchy analysis
 */
export interface HierarchyRecommendation {
  type: 'consolidation' | 'splitting' | 'refactoring' | 'optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  patterns: string[];
  description: string;
  rationale: string;
  estimatedImpact: {
    bundleSize: number; // bytes saved/added
    maintainability: number; // -1 to 1
    performance: number; // -1 to 1
    complexity: number; // -1 to 1
  };
  actionItems: string[];
}

/**
 * Advanced pattern hierarchy analysis system
 * Extends existing pattern relationship analysis functionality
 */
export class PatternHierarchy {
  private config: PatternHierarchyConfig;
  private performanceMonitor = createPerformanceMonitor({ enabled: true });
  private parallelProcessor = createParallelProcessor(
    async (data: any) => data, // Placeholder processor
    { maxConcurrency: 4, enableProgressTracking: true }
  );
  private relationshipCache = new Map<string, PatternRelationship>();
  private scoreCache = new Map<string, PatternScore>();

  constructor(config: Partial<PatternHierarchyConfig> = {}) {
    this.config = PatternHierarchyConfigSchema.parse(config);
  }

  /**
   * Analyze pattern hierarchy from aggregated class data
   */
  public async analyzeHierarchy(
    patterns: AggregatedClassData[],
    coOccurrencePatterns: CoOccurrencePattern[] = []
  ): Promise<HierarchyAnalysisResult> {
    const sessionId = this.config.enablePerformanceMonitoring
      ? this.performanceMonitor.startSession('hierarchy-analysis')
      : null;

    try {
      const startTime = Date.now();

      // Filter patterns by minimum frequency
      const filteredPatterns = patterns.filter(
        (p) => p.totalFrequency >= this.config.minimumFrequency
      );

      // Build pattern graph
      const graph = await this.buildPatternGraph(filteredPatterns, coOccurrencePatterns);

      // Detect relationships
      const relationships = await this.detectRelationships(filteredPatterns, coOccurrencePatterns);

      // Analyze overlaps
      const overlaps = this.config.enableOverlapAnalysis
        ? await this.analyzeOverlaps(filteredPatterns)
        : [];

      // Detect subsets
      const subsets = this.config.enableSubsetDetection
        ? await this.detectSubsets(filteredPatterns)
        : [];

      // Calculate pattern scores
      const scores = this.config.enablePatternScoring
        ? await this.calculatePatternScores(filteredPatterns, relationships)
        : new Map<string, PatternScore>();

      // Build hierarchy
      const hierarchy = await this.buildHierarchy(filteredPatterns, relationships, scores);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        hierarchy,
        relationships,
        overlaps,
        subsets,
        scores
      );

      const processingTime = Date.now() - startTime;

      return {
        hierarchy,
        relationships,
        overlaps,
        subsets,
        scores,
        graph,
        recommendations,
        metadata: {
          processedAt: Date.now(),
          processingTime,
          patternCount: filteredPatterns.length,
          relationshipCount: relationships.length,
          config: this.config,
        },
      };
    } catch (error) {
      throw new Error(
        `Pattern hierarchy analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      if (sessionId && this.config.enablePerformanceMonitoring) {
        this.performanceMonitor.stopSession();
      }
    }
  }

  /**
   * Build pattern graph representation
   */
  private async buildPatternGraph(
    patterns: AggregatedClassData[],
    coOccurrencePatterns: CoOccurrencePattern[]
  ): Promise<PatternGraph> {
    if (!this.config.enableGraphMapping) {
      return this.createEmptyGraph();
    }

    const measurementId = this.performanceMonitor.startMeasurement('build-pattern-graph');

    try {
      const nodes = new Map<string, HierarchyNode>();
      const edges = new Map<string, PatternRelationship>();
      const adjacencyList = new Map<string, string[]>();

      // Create nodes
      for (const pattern of patterns) {
        const node: HierarchyNode = {
          pattern: pattern.name,
          data: pattern,
          children: [],
          level: 0,
          score: 0,
          relationships: [],
        };
        nodes.set(pattern.name, node);
        adjacencyList.set(pattern.name, []);
      }

      // Add co-occurrence edges
      for (const coOccurrence of coOccurrencePatterns) {
        for (let i = 0; i < coOccurrence.classes.length; i++) {
          for (let j = i + 1; j < coOccurrence.classes.length; j++) {
            const source = coOccurrence.classes[i];
            const target = coOccurrence.classes[j];

            if (nodes.has(source) && nodes.has(target)) {
              const edgeId = `${source}-${target}`;
              const relationship: PatternRelationship = {
                id: edgeId,
                sourcePattern: source,
                targetPattern: target,
                type: RelationshipType.FREQUENCY,
                strength: coOccurrence.strength,
                confidence: Math.min(coOccurrence.frequency / 10, 1),
                evidence: [
                  {
                    type: 'cooccurrence',
                    value: coOccurrence.frequency,
                    description: `Co-occurs ${coOccurrence.frequency} times`,
                    sourceData: coOccurrence,
                  },
                ],
                metadata: {
                  detectedAt: Date.now(),
                  algorithm: 'cooccurrence-analysis',
                  computationTime: 0,
                },
              };

              edges.set(edgeId, relationship);
              adjacencyList.get(source)?.push(target);
              adjacencyList.get(target)?.push(source);
            }
          }
        }
      }

      // Calculate graph metrics
      const metrics = this.calculateGraphMetrics(nodes, edges, adjacencyList);

      // Detect connected components
      const components = this.detectConnectedComponents(adjacencyList);

      // Detect cycles
      const cycles = this.detectCycles(adjacencyList);

      this.performanceMonitor.endMeasurement(measurementId);

      return {
        nodes,
        edges,
        adjacencyList,
        components,
        cycles,
        metrics,
      };
    } catch (error) {
      this.performanceMonitor.endMeasurement(measurementId, {
        success: false,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Detect relationships between patterns
   */
  private async detectRelationships(
    patterns: AggregatedClassData[],
    coOccurrencePatterns: CoOccurrencePattern[]
  ): Promise<PatternRelationship[]> {
    const measurementId = this.performanceMonitor.startMeasurement('detect-relationships');

    try {
      const relationships: PatternRelationship[] = [];

      // Use parallel processing for large datasets
      if (this.config.enableParallelProcessing && patterns.length > 100) {
        const tasks = patterns.map((pattern, index) => ({
          id: `relationship-${index}`,
          data: { pattern, allPatterns: patterns, coOccurrencePatterns },
          operation: 'relationship-detection',
        }));

        const results = await this.parallelProcessor.processInParallel(tasks);
        for (const result of results) {
          if (result.success && result.result) {
            relationships.push(...result.result);
          }
        }
      } else {
        // Sequential processing for smaller datasets
        // Use optimized subset detection with trie structure
        const patternTrie = this.buildPatternTrie(patterns);

        for (let i = 0; i < patterns.length; i++) {
          for (let j = i + 1; j < patterns.length; j++) {
            const sourcePattern = patterns[i];
            const targetPattern = patterns[j];

            const relationship = await this.analyzePatternPairOptimized(
              sourcePattern,
              targetPattern,
              coOccurrencePatterns,
              patternTrie
            );

            if (relationship) {
              relationships.push(relationship);
            }
          }
        }
      }

      this.performanceMonitor.endMeasurement(measurementId);
      return relationships;
    } catch (error) {
      this.performanceMonitor.endMeasurement(measurementId, {
        success: false,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Build trie structure for efficient subset detection
   */

  /**
   * Build trie structure for efficient subset detection
   */
  private buildPatternTrie(patterns: AggregatedClassData[]): TrieNode {
    const root: TrieNode = {
      token: '',
      patterns: new Set(),
      children: new Map(),
      isEndOfPattern: false,
    };

    for (const pattern of patterns) {
      const tokens = this.extractClassTokens(pattern.name);
      let current = root;

      for (const token of tokens) {
        if (!current.children.has(token)) {
          current.children.set(token, {
            token,
            patterns: new Set(),
            children: new Map(),
            isEndOfPattern: false,
          });
        }
        current = current.children.get(token)!;
        current.patterns.add(pattern.name);
      }
      current.isEndOfPattern = true;
    }

    return root;
  }

  /**
   * Find subset relationships using trie
   */
  private findSubsetsInTrie(
    tokens: string[],
    trie: TrieNode,
    maxDepth = this.config.maxSubsetDepth
  ): Array<{ pattern: string; coverage: number }> {
    const results: Array<{ pattern: string; coverage: number }> = [];

    const searchTrie = (
      tokenIndex: number,
      node: TrieNode,
      depth: number,
      matchedTokens: number
    ): void => {
      if (depth > maxDepth || tokenIndex >= tokens.length) return;

      const token = tokens[tokenIndex];

      // Check if current token exists in this node's children
      if (node.children.has(token)) {
        const child = node.children.get(token)!;

        // If this child represents end of a pattern, calculate coverage
        if (child.isEndOfPattern) {
          const coverage = (matchedTokens + 1) / tokens.length;
          for (const pattern of child.patterns) {
            results.push({ pattern, coverage });
          }
        }

        // Continue searching
        searchTrie(tokenIndex + 1, child, depth + 1, matchedTokens + 1);
      }

      // Also try skipping current token (for partial matches)
      if (tokenIndex < tokens.length - 1) {
        searchTrie(tokenIndex + 1, node, depth + 1, matchedTokens);
      }
    };

    searchTrie(0, trie, 0, 0);
    return results.filter((r) => r.coverage >= 0.8); // Only high-coverage subsets
  }

  /**
   * Optimized pattern pair analysis using trie structure
   */
  private async analyzePatternPairOptimized(
    source: AggregatedClassData,
    target: AggregatedClassData,
    coOccurrencePatterns: CoOccurrencePattern[],
    trie: TrieNode
  ): Promise<PatternRelationship | null> {
    const cacheKey = `${source.name}-${target.name}`;
    const cached = this.relationshipCache.get(cacheKey);
    if (cached) return cached;

    const evidence: RelationshipEvidence[] = [];
    let relationshipType = RelationshipType.DISJOINT;
    let strength = 0;
    let confidence = 0;

    // Fast lexical similarity using optimized algorithm
    const lexicalSimilarity = this.calculateOptimizedLexicalSimilarity(source.name, target.name);
    if (lexicalSimilarity > 0.7) {
      evidence.push({
        type: 'lexical',
        value: lexicalSimilarity,
        description: `High lexical similarity (${(lexicalSimilarity * 100).toFixed(1)}%)`,
      });
      relationshipType = RelationshipType.SEMANTIC;
      strength = Math.max(strength, lexicalSimilarity);
    }

    // Optimized frequency correlation
    const frequencyRatio = this.calculateFrequencyCorrelation(source, target);
    if (frequencyRatio > 0.5) {
      evidence.push({
        type: 'frequency',
        value: frequencyRatio,
        description: `Similar usage frequency (ratio: ${frequencyRatio.toFixed(2)})`,
      });
      strength = Math.max(strength, frequencyRatio * 0.5);
    }

    // Fast co-occurrence lookup using Map
    const coOccurrence = this.findCoOccurrenceFast(source.name, target.name, coOccurrencePatterns);
    if (coOccurrence) {
      evidence.push({
        type: 'cooccurrence',
        value: coOccurrence.strength,
        description: `Co-occurs with strength ${coOccurrence.strength.toFixed(2)}`,
        sourceData: coOccurrence,
      });
      relationshipType = RelationshipType.FREQUENCY;
      strength = Math.max(strength, coOccurrence.strength);
    }

    // Optimized subset detection using trie
    const subsetResult = this.checkSubsetRelationshipOptimized(source, target, trie);
    if (subsetResult.isSubset) {
      evidence.push({
        type: 'structural',
        value: subsetResult.coverage,
        description: `Subset relationship (coverage: ${(subsetResult.coverage * 100).toFixed(1)}%)`,
      });
      relationshipType =
        subsetResult.direction === 'source-subset'
          ? RelationshipType.SUBSET
          : RelationshipType.SUPERSET;
      strength = Math.max(strength, subsetResult.coverage);
    }

    // Calculate confidence based on evidence count and strength
    confidence =
      evidence.length > 0
        ? Math.min(evidence.reduce((sum, e) => sum + e.value, 0) / evidence.length, 1)
        : 0;

    // Only create relationship if significant
    if (strength < 0.1 || evidence.length === 0) {
      return null;
    }

    const relationship: PatternRelationship = {
      id: `${source.name}-${target.name}`,
      sourcePattern: source.name,
      targetPattern: target.name,
      type: relationshipType,
      strength,
      confidence,
      evidence,
      metadata: {
        detectedAt: Date.now(),
        algorithm: 'optimized-pattern-pair-analysis',
        computationTime: 0,
      },
    };

    // Cache the result
    this.relationshipCache.set(cacheKey, relationship);
    return relationship;
  }

  /**
   * Analyze relationship between two patterns
   */
  private async analyzePatternPair(
    source: AggregatedClassData,
    target: AggregatedClassData,
    coOccurrencePatterns: CoOccurrencePattern[]
  ): Promise<PatternRelationship | null> {
    const cacheKey = `${source.name}-${target.name}`;
    const cached = this.relationshipCache.get(cacheKey);
    if (cached) return cached;

    const evidence: RelationshipEvidence[] = [];
    let relationshipType = RelationshipType.DISJOINT;
    let strength = 0;
    let confidence = 0;

    // Check for lexical similarity
    const lexicalSimilarity = this.calculateLexicalSimilarity(source.name, target.name);
    if (lexicalSimilarity > 0.7) {
      evidence.push({
        type: 'lexical',
        value: lexicalSimilarity,
        description: `High lexical similarity (${(lexicalSimilarity * 100).toFixed(1)}%)`,
      });
      relationshipType = RelationshipType.SEMANTIC;
      strength = Math.max(strength, lexicalSimilarity);
    }

    // Check for frequency correlation
    const frequencyRatio =
      Math.min(source.totalFrequency, target.totalFrequency) /
      Math.max(source.totalFrequency, target.totalFrequency);
    if (frequencyRatio > 0.5) {
      evidence.push({
        type: 'frequency',
        value: frequencyRatio,
        description: `Similar usage frequency (ratio: ${frequencyRatio.toFixed(2)})`,
      });
      strength = Math.max(strength, frequencyRatio * 0.5);
    }

    // Check for co-occurrence
    const coOccurrence = coOccurrencePatterns.find(
      (pattern) => pattern.classes.includes(source.name) && pattern.classes.includes(target.name)
    );

    if (coOccurrence) {
      evidence.push({
        type: 'cooccurrence',
        value: coOccurrence.strength,
        description: `Co-occurs with strength ${coOccurrence.strength.toFixed(2)}`,
        sourceData: coOccurrence,
      });
      relationshipType = RelationshipType.FREQUENCY;
      strength = Math.max(strength, coOccurrence.strength);
    }

    // Check for subset relationships
    const subsetResult = this.checkSubsetRelationship(source, target);
    if (subsetResult.isSubset) {
      evidence.push({
        type: 'structural',
        value: subsetResult.coverage,
        description: `Subset relationship (coverage: ${(subsetResult.coverage * 100).toFixed(1)}%)`,
      });
      relationshipType =
        subsetResult.direction === 'source-subset'
          ? RelationshipType.SUBSET
          : RelationshipType.SUPERSET;
      strength = Math.max(strength, subsetResult.coverage);
    }

    // Calculate confidence based on evidence count and strength
    confidence =
      evidence.length > 0
        ? Math.min(evidence.reduce((sum, e) => sum + e.value, 0) / evidence.length, 1)
        : 0;

    // Only create relationship if significant
    if (strength < 0.1 || evidence.length === 0) {
      return null;
    }

    const relationship: PatternRelationship = {
      id: `${source.name}-${target.name}`,
      sourcePattern: source.name,
      targetPattern: target.name,
      type: relationshipType,
      strength,
      confidence,
      evidence,
      metadata: {
        detectedAt: Date.now(),
        algorithm: 'pattern-pair-analysis',
        computationTime: 0,
      },
    };

    // Cache the result
    this.relationshipCache.set(cacheKey, relationship);
    return relationship;
  }

  /**
   * Optimized lexical similarity using Set operations
   */
  private calculateOptimizedLexicalSimilarity(pattern1: string, pattern2: string): number {
    // Use character n-grams with Set operations for better performance
    const ngrams1 = new Set(this.getNGrams(pattern1, 2));
    const ngrams2 = new Set(this.getNGrams(pattern2, 2));

    let intersection = 0;
    for (const gram of ngrams1) {
      if (ngrams2.has(gram)) intersection++;
    }

    const union = ngrams1.size + ngrams2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Calculate frequency correlation between patterns
   */
  private calculateFrequencyCorrelation(
    source: AggregatedClassData,
    target: AggregatedClassData
  ): number {
    return (
      Math.min(source.totalFrequency, target.totalFrequency) /
      Math.max(source.totalFrequency, target.totalFrequency)
    );
  }

  /**
   * Fast co-occurrence lookup using optimized search
   */
  private findCoOccurrenceFast(
    pattern1: string,
    pattern2: string,
    coOccurrencePatterns: CoOccurrencePattern[]
  ): CoOccurrencePattern | null {
    // Use binary search if patterns are sorted, otherwise linear search
    for (const pattern of coOccurrencePatterns) {
      if (pattern.classes.includes(pattern1) && pattern.classes.includes(pattern2)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Optimized subset relationship check using trie
   */
  private checkSubsetRelationshipOptimized(
    source: AggregatedClassData,
    target: AggregatedClassData,
    trie: TrieNode
  ): { isSubset: boolean; direction?: 'source-subset' | 'target-subset'; coverage: number } {
    const sourceTokens = this.extractClassTokens(source.name);
    const targetTokens = this.extractClassTokens(target.name);

    // Use trie for fast subset detection
    const sourceSubsets = this.findSubsetsInTrie(sourceTokens, trie);
    const targetSubsets = this.findSubsetsInTrie(targetTokens, trie);

    // Check if source is subset of target
    const sourceInTarget = sourceSubsets.find((s) => s.pattern === target.name);
    if (sourceInTarget && sourceInTarget.coverage >= 0.8) {
      return { isSubset: true, direction: 'source-subset', coverage: sourceInTarget.coverage };
    }

    // Check if target is subset of source
    const targetInSource = targetSubsets.find((s) => s.pattern === source.name);
    if (targetInSource && targetInSource.coverage >= 0.8) {
      return { isSubset: true, direction: 'target-subset', coverage: targetInSource.coverage };
    }

    // Fallback to original algorithm for accuracy
    return this.checkSubsetRelationship(source, target);
  }

  /**
   * Calculate lexical similarity between two pattern names
   */
  private calculateLexicalSimilarity(pattern1: string, pattern2: string): number {
    // Simple Jaccard similarity on character n-grams
    const ngrams1 = this.getNGrams(pattern1, 2);
    const ngrams2 = this.getNGrams(pattern2, 2);

    const intersection = ngrams1.filter((gram) => ngrams2.includes(gram));
    const union = [...new Set([...ngrams1, ...ngrams2])];

    return union.length > 0 ? intersection.length / union.length : 0;
  }

  /**
   * Get n-grams from a string
   */
  private getNGrams(str: string, n: number): string[] {
    const grams: string[] = [];
    for (let i = 0; i <= str.length - n; i++) {
      grams.push(str.slice(i, i + n));
    }
    return grams;
  }

  /**
   * Check if patterns have subset relationship
   */
  private checkSubsetRelationship(
    source: AggregatedClassData,
    target: AggregatedClassData
  ): { isSubset: boolean; direction?: 'source-subset' | 'target-subset'; coverage: number } {
    // Extract class tokens from pattern names
    const sourceTokens = this.extractClassTokens(source.name);
    const targetTokens = this.extractClassTokens(target.name);

    const sourceSet = new Set(sourceTokens);
    const targetSet = new Set(targetTokens);

    // Check if source is subset of target
    const sourceInTarget = [...sourceSet].filter((token) => targetSet.has(token));
    const sourceCoverage = sourceInTarget.length / sourceSet.size;

    // Check if target is subset of source
    const targetInSource = [...targetSet].filter((token) => sourceSet.has(token));
    const targetCoverage = targetInSource.length / targetSet.size;

    if (sourceCoverage >= 0.8) {
      return { isSubset: true, direction: 'source-subset', coverage: sourceCoverage };
    } else if (targetCoverage >= 0.8) {
      return { isSubset: true, direction: 'target-subset', coverage: targetCoverage };
    }

    return { isSubset: false, coverage: Math.max(sourceCoverage, targetCoverage) };
  }

  /**
   * Extract meaningful tokens from class name
   */
  private extractClassTokens(className: string): string[] {
    // Split on common delimiters and extract meaningful parts
    return className
      .split(/[-_\s]+/)
      .filter((token) => token.length > 1)
      .map((token) => token.toLowerCase());
  }

  /**
   * Analyze pattern overlaps with hierarchical overlap detection
   * Extends existing analyzePatternRelationships functionality
   */
  private async analyzeOverlaps(patterns: AggregatedClassData[]): Promise<PatternOverlap[]> {
    const measurementId = this.performanceMonitor.startMeasurement('analyze-overlaps');

    try {
      const overlaps: PatternOverlap[] = [];

      // Build overlap matrix for efficient computation
      const overlapMatrix = this.buildOverlapMatrix(patterns);

      // Use hierarchical overlap graph (HOG) approach for efficient computation
      const hierarchicalOverlaps = this.detectHierarchicalOverlaps(patterns, overlapMatrix);

      // Process pairwise overlaps
      for (let i = 0; i < patterns.length; i++) {
        for (let j = i + 1; j < patterns.length; j++) {
          const pattern1 = patterns[i];
          const pattern2 = patterns[j];

          const overlap = this.calculatePatternOverlapExtended(
            pattern1,
            pattern2,
            overlapMatrix[i][j],
            hierarchicalOverlaps
          );

          if (overlap.strength >= this.config.minOverlapStrength) {
            overlaps.push(overlap);
          }
        }
      }

      // Add multi-way overlaps (more than 2 patterns)
      const multiWayOverlaps = this.detectMultiWayOverlaps(patterns, overlapMatrix);
      overlaps.push(...multiWayOverlaps);

      this.performanceMonitor.endMeasurement(measurementId);
      return overlaps.sort((a, b) => b.strength - a.strength);
    } catch (error) {
      this.performanceMonitor.endMeasurement(measurementId, {
        success: false,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Build overlap matrix for efficient computation
   */
  private buildOverlapMatrix(patterns: AggregatedClassData[]): number[][] {
    const matrix: number[][] = [];

    for (let i = 0; i < patterns.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < patterns.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0; // Perfect self-overlap
        } else {
          const tokens1 = new Set(this.extractClassTokens(patterns[i].name));
          const tokens2 = new Set(this.extractClassTokens(patterns[j].name));

          let intersection = 0;
          for (const token of tokens1) {
            if (tokens2.has(token)) intersection++;
          }

          const union = tokens1.size + tokens2.size - intersection;
          matrix[i][j] = union > 0 ? intersection / union : 0;
        }
      }
    }

    return matrix;
  }

  /**
   * Detect hierarchical overlaps using HOG concepts
   */
  private detectHierarchicalOverlaps(
    patterns: AggregatedClassData[],
    overlapMatrix: number[][]
  ): Map<string, Set<number>> {
    const hierarchicalOverlaps = new Map<string, Set<number>>();

    // Group patterns by hierarchical levels based on complexity
    const levels = new Map<number, number[]>();

    patterns.forEach((pattern, index) => {
      const complexity = this.calculatePatternComplexity(pattern);
      const level = Math.floor(complexity / 2); // Group by complexity levels

      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(index);
    });

    // Detect overlaps within and between levels
    for (const [level, patternIndices] of levels) {
      const levelKey = `level-${level}`;
      const overlappingPatterns = new Set<number>();

      // Find patterns with significant overlap within this level
      for (let i = 0; i < patternIndices.length; i++) {
        for (let j = i + 1; j < patternIndices.length; j++) {
          const idx1 = patternIndices[i];
          const idx2 = patternIndices[j];

          if (overlapMatrix[idx1][idx2] > 0.5) {
            overlappingPatterns.add(idx1);
            overlappingPatterns.add(idx2);
          }
        }
      }

      if (overlappingPatterns.size > 1) {
        hierarchicalOverlaps.set(levelKey, overlappingPatterns);
      }
    }

    return hierarchicalOverlaps;
  }

  /**
   * Calculate pattern complexity for hierarchical grouping
   */
  private calculatePatternComplexity(pattern: AggregatedClassData): number {
    const tokens = this.extractClassTokens(pattern.name);
    const frequency = pattern.totalFrequency || 1;
    const contexts = (pattern.contexts?.html?.length || 0) + (pattern.contexts?.jsx?.length || 0);

    // Complexity based on token count, frequency, and usage contexts
    return tokens.length + Math.log(frequency + 1) + Math.log(contexts + 1);
  }

  /**
   * Detect multi-way overlaps between 3 or more patterns
   */
  private detectMultiWayOverlaps(
    patterns: AggregatedClassData[],
    overlapMatrix: number[][]
  ): PatternOverlap[] {
    const multiWayOverlaps: PatternOverlap[] = [];
    const n = patterns.length;

    // Check for 3-way overlaps (can be extended to more)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const overlap_ij = overlapMatrix[i][j];
          const overlap_ik = overlapMatrix[i][k];
          const overlap_jk = overlapMatrix[j][k];

          // All pairs must have significant overlap
          if (overlap_ij > 0.4 && overlap_ik > 0.4 && overlap_jk > 0.4) {
            const avgOverlap = (overlap_ij + overlap_ik + overlap_jk) / 3;

            if (avgOverlap >= this.config.minOverlapStrength) {
              multiWayOverlaps.push({
                patterns: [patterns[i].name, patterns[j].name, patterns[k].name],
                overlapSize: this.calculateMultiWayOverlapSize([
                  patterns[i],
                  patterns[j],
                  patterns[k],
                ]),
                overlapClasses: this.getCommonTokens([patterns[i], patterns[j], patterns[k]]),
                strength: avgOverlap,
                type: 'hierarchical',
                conflictLevel: avgOverlap > 0.8 ? 'high' : avgOverlap > 0.6 ? 'medium' : 'low',
              });
            }
          }
        }
      }
    }

    return multiWayOverlaps;
  }

  /**
   * Calculate multi-way overlap size
   */
  private calculateMultiWayOverlapSize(patterns: AggregatedClassData[]): number {
    const tokenSets = patterns.map((p) => new Set(this.extractClassTokens(p.name)));

    if (tokenSets.length === 0) return 0;

    // Find intersection of all sets
    let intersection = tokenSets[0];
    for (let i = 1; i < tokenSets.length; i++) {
      const newIntersection = new Set<string>();
      for (const token of intersection) {
        if (tokenSets[i].has(token)) {
          newIntersection.add(token);
        }
      }
      intersection = newIntersection;
    }

    return intersection.size;
  }

  /**
   * Get common tokens across multiple patterns
   */
  private getCommonTokens(patterns: AggregatedClassData[]): string[] {
    const tokenSets = patterns.map((p) => new Set(this.extractClassTokens(p.name)));

    if (tokenSets.length === 0) return [];

    // Find intersection of all sets
    let intersection = tokenSets[0];
    for (let i = 1; i < tokenSets.length; i++) {
      const newIntersection = new Set<string>();
      for (const token of intersection) {
        if (tokenSets[i].has(token)) {
          newIntersection.add(token);
        }
      }
      intersection = newIntersection;
    }

    return Array.from(intersection);
  }

  /**
   * Calculate extended pattern overlap with hierarchical context
   */
  private calculatePatternOverlapExtended(
    pattern1: AggregatedClassData,
    pattern2: AggregatedClassData,
    precomputedOverlap: number,
    hierarchicalOverlaps: Map<string, Set<number>>
  ): PatternOverlap {
    const tokens1 = this.extractClassTokens(pattern1.name);
    const tokens2 = this.extractClassTokens(pattern2.name);

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = [...set1].filter((token) => set2.has(token));
    const overlapSize = intersection.length;
    const strength = precomputedOverlap;

    let type: 'partial' | 'complete' | 'hierarchical' = 'partial';

    // Check if this is a hierarchical overlap
    for (const [levelKey] of hierarchicalOverlaps) {
      // This would need pattern indices to check membership
      // Simplified to use pattern names for now
      if (levelKey.includes('level')) {
        type = 'hierarchical';
        break;
      }
    }

    if (overlapSize === Math.min(tokens1.length, tokens2.length)) {
      type = tokens1.length === tokens2.length ? 'complete' : 'hierarchical';
    }

    let conflictLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (strength > 0.8) conflictLevel = 'high';
    else if (strength > 0.6) conflictLevel = 'medium';
    else if (strength > 0.3) conflictLevel = 'low';

    return {
      patterns: [pattern1.name, pattern2.name],
      overlapSize,
      overlapClasses: intersection,
      strength,
      type,
      conflictLevel,
    };
  }

  /**
   * Calculate overlap between two patterns
   */
  private calculatePatternOverlap(
    pattern1: AggregatedClassData,
    pattern2: AggregatedClassData
  ): PatternOverlap {
    const tokens1 = this.extractClassTokens(pattern1.name);
    const tokens2 = this.extractClassTokens(pattern2.name);

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = [...set1].filter((token) => set2.has(token));
    const union = [...new Set([...tokens1, ...tokens2])];

    const overlapSize = intersection.length;
    const strength = union.length > 0 ? overlapSize / union.length : 0;

    let type: 'partial' | 'complete' | 'hierarchical' = 'partial';
    if (overlapSize === Math.min(tokens1.length, tokens2.length)) {
      type = tokens1.length === tokens2.length ? 'complete' : 'hierarchical';
    }

    let conflictLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (strength > 0.8) conflictLevel = 'high';
    else if (strength > 0.6) conflictLevel = 'medium';
    else if (strength > 0.3) conflictLevel = 'low';

    return {
      patterns: [pattern1.name, pattern2.name],
      overlapSize,
      overlapClasses: intersection,
      strength,
      type,
      conflictLevel,
    };
  }

  /**
   * Detect subset relationships
   */
  private async detectSubsets(patterns: AggregatedClassData[]): Promise<PatternSubset[]> {
    const measurementId = this.performanceMonitor.startMeasurement('detect-subsets');

    try {
      const subsets: PatternSubset[] = [];

      for (let i = 0; i < patterns.length; i++) {
        for (let j = 0; j < patterns.length; j++) {
          if (i === j) continue;

          const subset = this.calculateSubsetRelationship(patterns[i], patterns[j]);
          if (subset.coverage >= 0.8) {
            subsets.push(subset);
          }
        }
      }

      this.performanceMonitor.endMeasurement(measurementId);
      return subsets.sort((a, b) => b.coverage - a.coverage);
    } catch (error) {
      this.performanceMonitor.endMeasurement(measurementId, {
        success: false,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate subset relationship between patterns
   */
  private calculateSubsetRelationship(
    potential_subset: AggregatedClassData,
    potential_superset: AggregatedClassData
  ): PatternSubset {
    const subsetTokens = this.extractClassTokens(potential_subset.name);
    const supersetTokens = this.extractClassTokens(potential_superset.name);

    const subsetSet = new Set(subsetTokens);
    const supersetSet = new Set(supersetTokens);

    const covered = [...subsetSet].filter((token) => supersetSet.has(token));
    const coverage = subsetSet.size > 0 ? covered.length / subsetSet.size : 0;
    const precision = supersetSet.size > 0 ? covered.length / supersetSet.size : 0;

    return {
      subset: potential_subset.name,
      superset: potential_superset.name,
      subsetClasses: covered,
      coverage,
      precision,
    };
  }

  /**
   * Calculate pattern scores
   */
  private async calculatePatternScores(
    patterns: AggregatedClassData[],
    relationships: PatternRelationship[]
  ): Promise<Map<string, PatternScore>> {
    const measurementId = this.performanceMonitor.startMeasurement('calculate-pattern-scores');

    try {
      const scores = new Map<string, PatternScore>();
      const maxFrequency = Math.max(...patterns.map((p) => p.totalFrequency));

      for (const pattern of patterns) {
        const cached = this.scoreCache.get(pattern.name);
        if (cached) {
          scores.set(pattern.name, cached);
          continue;
        }

        const score = this.calculateIndividualPatternScore(pattern, relationships, maxFrequency);
        scores.set(pattern.name, score);
        this.scoreCache.set(pattern.name, score);
      }

      this.performanceMonitor.endMeasurement(measurementId);
      return scores;
    } catch (error) {
      this.performanceMonitor.endMeasurement(measurementId, {
        success: false,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate score for individual pattern with comprehensive criteria
   */
  private calculateIndividualPatternScore(
    pattern: AggregatedClassData,
    relationships: PatternRelationship[],
    maxFrequency: number
  ): PatternScore {
    // Enhanced frequency score with logarithmic scaling
    const frequencyScore = this.calculateFrequencyScore(pattern.totalFrequency, maxFrequency);

    // Enhanced reusability score with multiple factors
    const reusabilityScore = this.calculateReusabilityScore(pattern, relationships);

    // Enhanced specificity score with semantic analysis
    const specificityScore = this.calculateSpecificityScore(pattern);

    // Enhanced maintainability score with complexity metrics
    const maintainabilityScore = this.calculateMaintainabilityScore(pattern);

    // Enhanced optimization score with relationship quality
    const optimizationScore = this.calculateOptimizationScore(pattern, relationships);

    // Calculate weighted overall score with adaptive weights
    const weights = this.calculateAdaptiveWeights(pattern, relationships);

    const overall =
      frequencyScore * weights.frequency +
      reusabilityScore * weights.reusability +
      specificityScore * weights.specificity +
      maintainabilityScore * weights.maintainability +
      optimizationScore * weights.optimization;

    return {
      pattern: pattern.name,
      frequency: pattern.totalFrequency,
      reusability: reusabilityScore,
      specificity: specificityScore,
      maintainability: maintainabilityScore,
      optimization: optimizationScore,
      overall,
      breakdown: {
        frequencyScore,
        reusabilityScore,
        specificityScore,
        maintainabilityScore,
        optimizationScore,
      },
    };
  }

  /**
   * Calculate enhanced frequency score with logarithmic scaling
   */
  private calculateFrequencyScore(frequency: number, maxFrequency: number): number {
    if (maxFrequency === 0) return 0;

    // Use logarithmic scaling for better distribution
    const logFreq = Math.log(frequency + 1);
    const logMax = Math.log(maxFrequency + 1);

    return logMax > 0 ? logFreq / logMax : 0;
  }

  /**
   * Calculate enhanced reusability score
   */
  private calculateReusabilityScore(
    pattern: AggregatedClassData,
    relationships: PatternRelationship[]
  ): number {
    const coOccurrenceCount = pattern.coOccurrences.size;
    const coOccurrenceScore = Math.min(coOccurrenceCount / 10, 1);

    // Factor in relationship strength
    const patternRelationships = relationships.filter(
      (r) => r.sourcePattern === pattern.name || r.targetPattern === pattern.name
    );

    const relationshipStrength =
      patternRelationships.length > 0
        ? patternRelationships.reduce((sum, r) => sum + r.strength, 0) / patternRelationships.length
        : 0;

    // Factor in usage diversity
    const htmlUsage = pattern.htmlFrequency || 0;
    const jsxUsage = pattern.jsxFrequency || 0;
    const usageDiversity = htmlUsage > 0 && jsxUsage > 0 ? 1 : 0.5;

    return coOccurrenceScore * 0.5 + relationshipStrength * 0.3 + usageDiversity * 0.2;
  }

  /**
   * Calculate enhanced specificity score with semantic analysis
   */
  private calculateSpecificityScore(pattern: AggregatedClassData): number {
    const tokens = this.extractClassTokens(pattern.name);

    // Base complexity from token count
    const tokenComplexity = Math.max(0, 1 - (tokens.length - 1) / 10);

    // Semantic specificity based on token types
    const semanticScore = this.calculateSemanticSpecificity(tokens);

    // Naming convention consistency
    const conventionScore = this.calculateNamingConventionScore(pattern.name);

    return tokenComplexity * 0.5 + semanticScore * 0.3 + conventionScore * 0.2;
  }

  /**
   * Calculate semantic specificity from tokens
   */
  private calculateSemanticSpecificity(tokens: string[]): number {
    // Common utility prefixes/suffixes that indicate high specificity
    const specificPrefixes = ['hover', 'focus', 'active', 'disabled', 'sm', 'md', 'lg', 'xl'];
    const specificSuffixes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];

    let specificityCount = 0;
    for (const token of tokens) {
      if (
        specificPrefixes.some((prefix) => token.startsWith(prefix)) ||
        specificSuffixes.some((suffix) => token.endsWith(suffix))
      ) {
        specificityCount++;
      }
    }

    return tokens.length > 0 ? specificityCount / tokens.length : 0;
  }

  /**
   * Calculate naming convention consistency score
   */
  private calculateNamingConventionScore(className: string): number {
    // Check for consistent patterns like kebab-case, camelCase, etc.
    const hasConsistentCase =
      /^[a-z]+(-[a-z0-9]+)*$/.test(className) || // kebab-case
      /^[a-z]+([A-Z][a-z0-9]*)*$/.test(className); // camelCase

    const hasReasonableLength = className.length >= 2 && className.length <= 50;
    const hasNoSpecialChars = !/[^a-zA-Z0-9\-_]/.test(className);

    let score = 0;
    if (hasConsistentCase) score += 0.4;
    if (hasReasonableLength) score += 0.3;
    if (hasNoSpecialChars) score += 0.3;

    return score;
  }

  /**
   * Calculate enhanced maintainability score
   */
  private calculateMaintainabilityScore(pattern: AggregatedClassData): number {
    // Source diversity
    const sourceTypes = pattern.sources.extractionTypes.size;
    const sourceScore = Math.min(sourceTypes / 4, 1);

    // Framework compatibility
    const frameworks = pattern.sources.frameworks.size;
    const frameworkScore = Math.min(frameworks / 3, 1);

    // Context diversity
    const htmlContexts = pattern.contexts?.html?.length || 0;
    const jsxContexts = pattern.contexts?.jsx?.length || 0;
    const contextScore = Math.min((htmlContexts + jsxContexts) / 10, 1);

    // Pattern stability (inverse of how often it changes)
    const stabilityScore = 0.8; // Placeholder - would need historical data

    return sourceScore * 0.3 + frameworkScore * 0.2 + contextScore * 0.2 + stabilityScore * 0.3;
  }

  /**
   * Calculate enhanced optimization score
   */
  private calculateOptimizationScore(
    pattern: AggregatedClassData,
    relationships: PatternRelationship[]
  ): number {
    const patternRelationships = relationships.filter(
      (r) => r.sourcePattern === pattern.name || r.targetPattern === pattern.name
    );

    // Relationship count score
    const relationshipScore = Math.min(patternRelationships.length / 5, 1);

    // Relationship quality score
    const qualityScore =
      patternRelationships.length > 0
        ? patternRelationships.reduce((sum, r) => sum + r.strength * r.confidence, 0) /
          patternRelationships.length
        : 0;

    // Optimization potential (based on consolidation opportunities)
    const consolidationPotential = this.calculateConsolidationPotential(
      pattern,
      patternRelationships
    );

    return relationshipScore * 0.4 + qualityScore * 0.4 + consolidationPotential * 0.2;
  }

  /**
   * Calculate consolidation potential for optimization
   */
  private calculateConsolidationPotential(
    pattern: AggregatedClassData,
    relationships: PatternRelationship[]
  ): number {
    // High potential if many subset/superset relationships
    const structuralRelationships = relationships.filter(
      (r) => r.type === RelationshipType.SUBSET || r.type === RelationshipType.SUPERSET
    );

    // High potential if many semantic relationships
    const semanticRelationships = relationships.filter((r) => r.type === RelationshipType.SEMANTIC);

    const structuralScore = Math.min(structuralRelationships.length / 3, 1);
    const semanticScore = Math.min(semanticRelationships.length / 3, 1);

    return structuralScore * 0.6 + semanticScore * 0.4;
  }

  /**
   * Calculate adaptive weights based on pattern characteristics
   */
  private calculateAdaptiveWeights(
    pattern: AggregatedClassData,
    relationships: PatternRelationship[]
  ): {
    frequency: number;
    reusability: number;
    specificity: number;
    maintainability: number;
    optimization: number;
  } {
    // Base weights
    const baseWeights = {
      frequency: 0.25,
      reusability: 0.25,
      specificity: 0.2,
      maintainability: 0.15,
      optimization: 0.15,
    };

    // Adjust weights based on pattern characteristics
    const isHighFrequency = pattern.totalFrequency > 10;
    const hasManyRelationships =
      relationships.filter(
        (r) => r.sourcePattern === pattern.name || r.targetPattern === pattern.name
      ).length > 3;

    if (isHighFrequency) {
      baseWeights.frequency += 0.1;
      baseWeights.specificity -= 0.05;
      baseWeights.maintainability -= 0.05;
    }

    if (hasManyRelationships) {
      baseWeights.optimization += 0.1;
      baseWeights.reusability += 0.05;
      baseWeights.frequency -= 0.1;
      baseWeights.specificity -= 0.05;
    }

    // Normalize weights to sum to 1
    const total = Object.values(baseWeights).reduce((sum, weight) => sum + weight, 0);
    for (const key in baseWeights) {
      baseWeights[key as keyof typeof baseWeights] /= total;
    }

    return baseWeights;
  }

  /**
   * Build pattern hierarchy
   */
  private async buildHierarchy(
    patterns: AggregatedClassData[],
    relationships: PatternRelationship[],
    scores: Map<string, PatternScore>
  ): Promise<HierarchyNode[]> {
    const measurementId = this.performanceMonitor.startMeasurement('build-hierarchy');

    try {
      const nodes = new Map<string, HierarchyNode>();

      // Create nodes
      for (const pattern of patterns) {
        const score = scores.get(pattern.name)?.overall || 0;
        const patternRelationships = relationships.filter(
          (r) => r.sourcePattern === pattern.name || r.targetPattern === pattern.name
        );

        const node: HierarchyNode = {
          pattern: pattern.name,
          data: pattern,
          children: [],
          level: 0,
          score,
          relationships: patternRelationships,
        };

        nodes.set(pattern.name, node);
      }

      // Build hierarchy based on subset relationships
      for (const relationship of relationships) {
        if (relationship.type === RelationshipType.SUBSET) {
          const parent = nodes.get(relationship.targetPattern);
          const child = nodes.get(relationship.sourcePattern);

          if (parent && child && relationship.strength > 0.8) {
            child.parent = parent;
            parent.children.push(child);
            child.level = parent.level + 1;
          }
        }
      }

      // Return root nodes (nodes without parents)
      const hierarchy = Array.from(nodes.values())
        .filter((node) => !node.parent)
        .sort((a, b) => b.score - a.score);

      this.performanceMonitor.endMeasurement(measurementId);
      return hierarchy;
    } catch (error) {
      this.performanceMonitor.endMeasurement(measurementId, {
        success: false,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Generate optimization recommendations
   */
  private async generateRecommendations(
    hierarchy: HierarchyNode[],
    relationships: PatternRelationship[],
    overlaps: PatternOverlap[],
    subsets: PatternSubset[],
    scores: Map<string, PatternScore>
  ): Promise<HierarchyRecommendation[]> {
    const recommendations: HierarchyRecommendation[] = [];

    // Recommend consolidation for high-overlap patterns
    for (const overlap of overlaps) {
      if (overlap.strength > 0.8 && overlap.conflictLevel === 'high') {
        recommendations.push({
          type: 'consolidation',
          priority: 'high',
          patterns: overlap.patterns,
          description: `Consolidate highly overlapping patterns`,
          rationale: `Patterns share ${(overlap.strength * 100).toFixed(1)}% of their tokens`,
          estimatedImpact: {
            bundleSize: -200, // Estimated bytes saved
            maintainability: 0.3,
            performance: 0.1,
            complexity: -0.2,
          },
          actionItems: [
            'Analyze shared functionality',
            'Create unified pattern',
            'Update usage across codebase',
          ],
        });
      }
    }

    // Recommend refactoring for low-score patterns
    const lowScorePatterns = Array.from(scores.entries())
      .filter(([, score]) => score.overall < 0.3)
      .map(([pattern]) => pattern);

    if (lowScorePatterns.length > 0) {
      recommendations.push({
        type: 'refactoring',
        priority: 'medium',
        patterns: lowScorePatterns,
        description: 'Refactor low-value patterns',
        rationale: 'These patterns have low reusability and optimization scores',
        estimatedImpact: {
          bundleSize: 0,
          maintainability: 0.2,
          performance: 0,
          complexity: -0.1,
        },
        actionItems: [
          'Review pattern usage',
          'Consider combining with similar patterns',
          'Improve naming conventions',
        ],
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate graph metrics
   */
  private calculateGraphMetrics(
    nodes: Map<string, HierarchyNode>,
    edges: Map<string, PatternRelationship>,
    adjacencyList: Map<string, string[]>
  ): GraphMetrics {
    const nodeCount = nodes.size;
    const edgeCount = edges.size;
    const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;

    const degrees = Array.from(adjacencyList.values()).map((adj) => adj.length);
    const averageDegree =
      degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
    const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;

    // Simplified metrics - would need more sophisticated algorithms for accurate calculations
    return {
      nodeCount,
      edgeCount,
      density,
      averageDegree,
      maxDegree,
      componentCount: 1, // Placeholder
      cycleCount: 0, // Placeholder
      diameter: nodeCount > 0 ? Math.ceil(Math.log2(nodeCount)) : 0, // Approximation
      averagePathLength: nodeCount > 1 ? Math.log(nodeCount) : 0, // Approximation
    };
  }

  /**
   * Detect connected components in the graph
   */
  private detectConnectedComponents(adjacencyList: Map<string, string[]>): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const node of adjacencyList.keys()) {
      if (!visited.has(node)) {
        const component: string[] = [];
        this.dfs(node, adjacencyList, visited, component);
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Depth-first search for component detection
   */
  private dfs(
    node: string,
    adjacencyList: Map<string, string[]>,
    visited: Set<string>,
    component: string[]
  ): void {
    visited.add(node);
    component.push(node);

    const neighbors = adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.dfs(neighbor, adjacencyList, visited, component);
      }
    }
  }

  /**
   * Detect cycles in the graph
   */
  private detectCycles(_adjacencyList: Map<string, string[]>): string[][] {
    // Simplified cycle detection - returns empty array
    // Would need more sophisticated algorithm for accurate cycle detection
    return [];
  }

  /**
   * Create empty graph structure
   */
  private createEmptyGraph(): PatternGraph {
    return {
      nodes: new Map(),
      edges: new Map(),
      adjacencyList: new Map(),
      components: [],
      cycles: [],
      metrics: {
        nodeCount: 0,
        edgeCount: 0,
        density: 0,
        averageDegree: 0,
        maxDegree: 0,
        componentCount: 0,
        cycleCount: 0,
        diameter: 0,
        averagePathLength: 0,
      },
    };
  }

  /**
   * Get configuration
   */
  public getConfig(): PatternHierarchyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<PatternHierarchyConfig>): void {
    this.config = PatternHierarchyConfigSchema.parse({ ...this.config, ...updates });
  }

  /**
   * Clear caches
   */
  public clearCaches(): void {
    this.relationshipCache.clear();
    this.scoreCache.clear();
  }

  /**
   * Shutdown and cleanup
   */
  public async shutdown(): Promise<void> {
    await this.parallelProcessor.shutdown();
    this.clearCaches();
  }
}

/**
 * Factory function to create pattern hierarchy analyzer
 */
export function createPatternHierarchy(
  config: Partial<PatternHierarchyConfig> = {}
): PatternHierarchy {
  return new PatternHierarchy(config);
}

/**
 * Utility function to analyze pattern hierarchy from existing data
 */
export async function analyzePatternHierarchy(
  patterns: AggregatedClassData[],
  coOccurrencePatterns: CoOccurrencePattern[] = [],
  config: Partial<PatternHierarchyConfig> = {}
): Promise<HierarchyAnalysisResult> {
  const analyzer = createPatternHierarchy(config);
  try {
    return await analyzer.analyzeHierarchy(patterns, coOccurrencePatterns);
  } finally {
    await analyzer.shutdown();
  }
}
