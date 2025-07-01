/**
 * @fileoverview Hierarchy Integration Manager for pattern selection
 * @module tw-enigma/optimization/hierarchyIntegration
 * @remarks
 * This module provides comprehensive hierarchy integration capabilities for
 * the pattern selection engine, handling parent-child relationships, rule
 * inheritance, circular dependency detection, and result aggregation.
 */

import type { AggregatedClassData } from '../processors/patternAnalysis';
import type { HierarchyAnalysisResult, PatternRelationship } from './patternHierarchy';
import { RelationshipType } from './patternHierarchy';

/**
 * Pattern conflict interface for hierarchy integration
 */
export interface PatternConflict {
  sourcePattern: string;
  targetPattern: string;
  conflictType: 'rule-inheritance' | 'propagated' | 'semantic' | 'structural';
  affectedClasses: Set<string>;
  resolution?: string;
}

/**
 * Conflict resolution interface
 */
export interface ConflictResolution {
  conflictId: string;
  strategy: 'merge' | 'override' | 'isolate';
  resolvedAt: number;
  result: any;
}

/**
 * Hierarchy level interface
 */
export interface HierarchyLevel {
  level: number;
  patterns: Array<{ name: string; frequency: number }>;
  relationships: PatternRelationship[];
}

/**
 * Hierarchy traversal order options
 */
export type TraversalOrder = 'breadth-first' | 'depth-first' | 'level-based' | 'priority-based';

/**
 * Rule inheritance strategy
 */
export type InheritanceStrategy =
  | 'strict' // Child inherits all parent rules without modification
  | 'override' // Child can override specific parent rules
  | 'merge' // Merge parent and child rules with conflict resolution
  | 'selective'; // Selective inheritance based on rule types

/**
 * Hierarchy integration configuration
 */
export interface HierarchyIntegrationConfig {
  // Traversal settings
  traversal: {
    order: TraversalOrder;
    maxDepth: number; // Maximum hierarchy depth to traverse
    includeLeafNodes: boolean; // Include leaf nodes in traversal
    respectPriority: boolean; // Consider pattern priority during traversal
  };

  // Inheritance settings
  inheritance: {
    strategy: InheritanceStrategy;
    propagateConflicts: boolean; // Propagate conflicts up the hierarchy
    mergeThreshold: number; // Threshold for merging similar rules (0-1)
    overridePermissions: string[]; // Rule types that can be overridden
  };

  // Circular dependency handling
  circularDependency: {
    detection: 'strict' | 'relaxed'; // Detection sensitivity
    resolution: 'break' | 'warn' | 'allow'; // How to handle circular dependencies
    maxIterations: number; // Max iterations for detection algorithm
  };

  // Aggregation settings
  aggregation: {
    method: 'weighted' | 'priority' | 'consensus' | 'hierarchical';
    weights: {
      parent: number; // Weight for parent patterns
      child: number; // Weight for child patterns
      sibling: number; // Weight for sibling patterns
    };
    consensusThreshold: number; // Threshold for consensus decisions
  };

  // Performance settings
  performance: {
    enableCaching: boolean; // Cache hierarchy traversal results
    parallelTraversal: boolean; // Enable parallel processing
    lazyEvaluation: boolean; // Delay evaluation until needed
  };
}

/**
 * Default hierarchy integration configuration
 */
export const DEFAULT_HIERARCHY_INTEGRATION_CONFIG: HierarchyIntegrationConfig = {
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
    overridePermissions: ['optimization', 'performance', 'consolidation'],
  },
  circularDependency: {
    detection: 'strict',
    resolution: 'warn',
    maxIterations: 1000,
  },
  aggregation: {
    method: 'hierarchical',
    weights: {
      parent: 0.4,
      child: 0.4,
      sibling: 0.2,
    },
    consensusThreshold: 0.6,
  },
  performance: {
    enableCaching: true,
    parallelTraversal: true,
    lazyEvaluation: false,
  },
};

/**
 * Hierarchy node with metadata for traversal
 */
interface HierarchyNode {
  pattern: AggregatedClassData;
  level: number;
  parent?: HierarchyNode;
  children: HierarchyNode[];
  metadata: {
    visited: boolean;
    inheritedRules: Map<string, any>;
    localRules: Map<string, any>;
    conflicts: PatternConflict[];
    resolutions: ConflictResolution[];
  };
}

/**
 * Circular dependency detection result
 */
export interface CircularDependencyResult {
  hasCircularDependency: boolean;
  cycles: string[][];
  affectedPatterns: Set<string>;
  resolutionStrategy?: 'break' | 'merge' | 'isolate';
}

/**
 * Hierarchy integration result
 */
export interface HierarchyIntegrationResult {
  // Enhanced patterns with hierarchy metadata
  enhancedPatterns: Array<{
    pattern: AggregatedClassData;
    hierarchyLevel: number;
    inheritedProperties: Map<string, any>;
    effectiveRules: Map<string, any>;
    parentChain: string[];
    childrenCount: number;
  }>;

  // Propagation results
  propagation: {
    rulesApplied: number;
    conflictsResolved: number;
    inheritanceChains: Array<{
      source: string;
      target: string;
      rules: string[];
    }>;
  };

  // Circular dependency analysis
  circularDependencies: CircularDependencyResult;

  // Aggregation results
  aggregation: {
    method: string;
    aggregatedScores: Map<string, number>;
    consensusReached: boolean;
    outliers: string[];
  };

  // Performance metrics
  metrics: {
    traversalTime: number;
    nodesProcessed: number;
    cacheHits: number;
    cacheMisses: number;
  };
}

/**
 * Hierarchy Integration Manager
 *
 * Manages the integration of hierarchical structures into pattern selection
 */
export class HierarchyIntegrationManager {
  private config: HierarchyIntegrationConfig;
  private traversalCache = new Map<string, HierarchyNode[]>();
  private dependencyGraph = new Map<string, Set<string>>();
  private visitedNodes = new Set<string>();
  private performanceMetrics = {
    traversalTime: 0,
    nodesProcessed: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(config: Partial<HierarchyIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_HIERARCHY_INTEGRATION_CONFIG, ...config };
  }

  /**
   * Integrate hierarchy into pattern selection
   */
  public async integrateHierarchy(
    patterns: AggregatedClassData[],
    hierarchyResult: HierarchyAnalysisResult
  ): Promise<HierarchyIntegrationResult> {
    const startTime = Date.now();

    // Build hierarchy tree structure
    const hierarchyTree = this.buildHierarchyTree(patterns, hierarchyResult);

    // Detect circular dependencies
    const circularDependencies = await this.detectCircularDependencies(hierarchyTree);

    // Handle circular dependencies if found
    if (circularDependencies.hasCircularDependency) {
      await this.handleCircularDependencies(circularDependencies, hierarchyTree);
    }

    // Traverse hierarchy and apply rules
    const traversalResult = await this.traverseHierarchy(hierarchyTree);

    // Apply inheritance rules
    const inheritanceResult = await this.applyInheritance(traversalResult);

    // Aggregate results across hierarchy levels
    const aggregationResult = await this.aggregateResults(inheritanceResult);

    // Build final result
    return {
      enhancedPatterns: this.buildEnhancedPatterns(aggregationResult),
      propagation: this.buildPropagationResult(inheritanceResult),
      circularDependencies,
      aggregation: this.buildAggregationResult(aggregationResult),
      metrics: {
        ...this.performanceMetrics,
        traversalTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Build hierarchical tree structure from patterns
   */
  private buildHierarchyTree(
    patterns: AggregatedClassData[],
    hierarchyResult: HierarchyAnalysisResult
  ): HierarchyNode[] {
    const nodeMap = new Map<string, HierarchyNode>();
    const rootNodes: HierarchyNode[] = [];

    // Create nodes for all patterns
    patterns.forEach((pattern) => {
      const level = this.findPatternLevel(pattern.name, hierarchyResult.hierarchy);
      const node: HierarchyNode = {
        pattern,
        level,
        children: [],
        metadata: {
          visited: false,
          inheritedRules: new Map(),
          localRules: new Map(),
          conflicts: [],
          resolutions: [],
        },
      };
      nodeMap.set(pattern.name, node);
    });

    // Build parent-child relationships
    hierarchyResult.relationships.forEach((rel) => {
      if (rel.type === RelationshipType.SUBSET || rel.type === RelationshipType.SUPERSET) {
        const parentNode = nodeMap.get(rel.sourcePattern);
        const childNode = nodeMap.get(rel.targetPattern);

        if (parentNode && childNode) {
          childNode.parent = parentNode;
          parentNode.children.push(childNode);
        }
      }
    });

    // Identify root nodes
    nodeMap.forEach((node) => {
      if (!node.parent) {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  /**
   * Find pattern's level in hierarchy
   */
  private findPatternLevel(
    patternName: string,
    hierarchy: HierarchyAnalysisResult['hierarchy']
  ): number {
    // Simply iterate through the hierarchy to find the pattern
    for (let i = 0; i < hierarchy.length; i++) {
      const node = hierarchy[i];
      if (node.pattern === patternName) {
        return node.level;
      }
    }
    return 0; // Default to root level
  }

  /**
   * Detect circular dependencies in hierarchy
   */
  private async detectCircularDependencies(
    roots: HierarchyNode[]
  ): Promise<CircularDependencyResult> {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const affectedPatterns = new Set<string>();

    // Build dependency graph
    this.buildDependencyGraph(roots);

    // DFS-based cycle detection
    for (const [node] of this.dependencyGraph) {
      if (!visited.has(node)) {
        const currentPath: string[] = [];
        if (this.detectCycleDFS(node, visited, recursionStack, currentPath, cycles)) {
          currentPath.forEach((p) => affectedPatterns.add(p));
        }
      }
    }

    return {
      hasCircularDependency: cycles.length > 0,
      cycles,
      affectedPatterns,
      resolutionStrategy: cycles.length > 0 ? this.determineResolutionStrategy(cycles) : undefined,
    };
  }

  /**
   * Build dependency graph from hierarchy tree
   */
  private buildDependencyGraph(roots: HierarchyNode[]): void {
    const processNode = (node: HierarchyNode) => {
      if (!this.dependencyGraph.has(node.pattern.name)) {
        this.dependencyGraph.set(node.pattern.name, new Set());
      }

      // Add dependencies based on co-occurrences
      node.pattern.coOccurrences.forEach((_, depName) => {
        this.dependencyGraph.get(node.pattern.name)!.add(depName);
      });

      // Process children
      node.children.forEach((child) => processNode(child));
    };

    roots.forEach((root) => processNode(root));
  }

  /**
   * DFS-based cycle detection
   */
  private detectCycleDFS(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    currentPath: string[],
    cycles: string[][]
  ): boolean {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const dependencies = this.dependencyGraph.get(node) || new Set();
    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        if (this.detectCycleDFS(dep, visited, recursionStack, currentPath, cycles)) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        const cycleStart = currentPath.indexOf(dep);
        const cycle = currentPath.slice(cycleStart);
        cycles.push([...cycle, dep]);
        return true;
      }
    }

    recursionStack.delete(node);
    currentPath.pop();
    return false;
  }

  /**
   * Determine resolution strategy for circular dependencies
   */
  private determineResolutionStrategy(cycles: string[][]): 'break' | 'merge' | 'isolate' {
    const maxCycleLength = Math.max(...cycles.map((c) => c.length));

    if (maxCycleLength <= 2) {
      return 'merge'; // Simple cycles can be merged
    } else if (maxCycleLength <= 4) {
      return 'break'; // Medium cycles should be broken
    } else {
      return 'isolate'; // Complex cycles need isolation
    }
  }

  /**
   * Handle circular dependencies based on configuration
   */
  private async handleCircularDependencies(
    circularDeps: CircularDependencyResult,
    roots: HierarchyNode[]
  ): Promise<void> {
    switch (this.config.circularDependency.resolution) {
      case 'break':
        await this.breakCircularDependencies(circularDeps, roots);
        break;
      case 'warn':
        console.warn('Circular dependencies detected:', circularDeps.cycles);
        break;
      case 'allow':
        // Do nothing, allow circular dependencies
        break;
    }
  }

  /**
   * Break circular dependencies
   */
  private async breakCircularDependencies(
    circularDeps: CircularDependencyResult,
    roots: HierarchyNode[]
  ): Promise<void> {
    for (const cycle of circularDeps.cycles) {
      // Find the weakest link in the cycle
      let weakestLink = { from: '', to: '', strength: Infinity };

      for (let i = 0; i < cycle.length; i++) {
        const from = cycle[i];
        const to = cycle[(i + 1) % cycle.length];
        const strength = this.calculateDependencyStrength(from, to, roots);

        if (strength < weakestLink.strength) {
          weakestLink = { from, to, strength };
        }
      }

      // Break the weakest link
      const fromDeps = this.dependencyGraph.get(weakestLink.from);
      if (fromDeps) {
        fromDeps.delete(weakestLink.to);
      }
    }
  }

  /**
   * Calculate dependency strength between patterns
   */
  private calculateDependencyStrength(from: string, to: string, roots: HierarchyNode[]): number {
    // Find nodes in tree
    const fromNode = this.findNodeInTree(from, roots);
    const toNode = this.findNodeInTree(to, roots);

    if (!fromNode || !toNode) return 0;

    // Calculate strength based on co-occurrence frequency
    const coOccurrence = fromNode.pattern.coOccurrences.get(to) || 0;
    const totalFrequency = fromNode.pattern.totalFrequency;

    return totalFrequency > 0 ? coOccurrence / totalFrequency : 0;
  }

  /**
   * Find node in hierarchy tree
   */
  private findNodeInTree(patternName: string, roots: HierarchyNode[]): HierarchyNode | null {
    const searchQueue: HierarchyNode[] = [...roots];

    while (searchQueue.length > 0) {
      const node = searchQueue.shift()!;
      if (node.pattern.name === patternName) {
        return node;
      }
      searchQueue.push(...node.children);
    }

    return null;
  }

  /**
   * Traverse hierarchy based on configured order
   */
  private async traverseHierarchy(roots: HierarchyNode[]): Promise<HierarchyNode[]> {
    const traversalResult: HierarchyNode[] = [];

    switch (this.config.traversal.order) {
      case 'breadth-first':
        await this.breadthFirstTraversal(roots, traversalResult);
        break;
      case 'depth-first':
        await this.depthFirstTraversal(roots, traversalResult);
        break;
      case 'level-based':
        await this.levelBasedTraversal(roots, traversalResult);
        break;
      case 'priority-based':
        await this.priorityBasedTraversal(roots, traversalResult);
        break;
    }

    return traversalResult;
  }

  /**
   * Breadth-first traversal
   */
  private async breadthFirstTraversal(
    roots: HierarchyNode[],
    result: HierarchyNode[]
  ): Promise<void> {
    const queue: HierarchyNode[] = [...roots];

    while (queue.length > 0) {
      const node = queue.shift()!;

      if (!node.metadata.visited && node.level <= this.config.traversal.maxDepth) {
        node.metadata.visited = true;
        result.push(node);
        this.performanceMetrics.nodesProcessed++;

        if (this.config.traversal.includeLeafNodes || node.children.length > 0) {
          queue.push(...node.children);
        }
      }
    }
  }

  /**
   * Depth-first traversal
   */
  private async depthFirstTraversal(
    roots: HierarchyNode[],
    result: HierarchyNode[]
  ): Promise<void> {
    const stack: HierarchyNode[] = [...roots].reverse();

    while (stack.length > 0) {
      const node = stack.pop()!;

      if (!node.metadata.visited && node.level <= this.config.traversal.maxDepth) {
        node.metadata.visited = true;
        result.push(node);
        this.performanceMetrics.nodesProcessed++;

        if (this.config.traversal.includeLeafNodes || node.children.length > 0) {
          stack.push(...[...node.children].reverse());
        }
      }
    }
  }

  /**
   * Level-based traversal
   */
  private async levelBasedTraversal(
    roots: HierarchyNode[],
    result: HierarchyNode[]
  ): Promise<void> {
    const levelMap = new Map<number, HierarchyNode[]>();

    // Group nodes by level
    const groupByLevel = (node: HierarchyNode) => {
      if (!levelMap.has(node.level)) {
        levelMap.set(node.level, []);
      }
      levelMap.get(node.level)!.push(node);
      node.children.forEach((child) => groupByLevel(child));
    };

    roots.forEach((root) => groupByLevel(root));

    // Process levels in order
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);

    for (const level of sortedLevels) {
      if (level <= this.config.traversal.maxDepth) {
        const nodes = levelMap.get(level)!;
        for (const node of nodes) {
          if (!node.metadata.visited) {
            node.metadata.visited = true;
            result.push(node);
            this.performanceMetrics.nodesProcessed++;
          }
        }
      }
    }
  }

  /**
   * Priority-based traversal
   */
  private async priorityBasedTraversal(
    roots: HierarchyNode[],
    result: HierarchyNode[]
  ): Promise<void> {
    // Create priority queue based on pattern frequency
    const priorityQueue: Array<{ node: HierarchyNode; priority: number }> = [];

    const addToPriorityQueue = (node: HierarchyNode) => {
      priorityQueue.push({
        node,
        priority: node.pattern.totalFrequency,
      });
      node.children.forEach((child) => addToPriorityQueue(child));
    };

    roots.forEach((root) => addToPriorityQueue(root));

    // Sort by priority (highest first)
    priorityQueue.sort((a, b) => b.priority - a.priority);

    // Process in priority order
    for (const { node } of priorityQueue) {
      if (!node.metadata.visited && node.level <= this.config.traversal.maxDepth) {
        node.metadata.visited = true;
        result.push(node);
        this.performanceMetrics.nodesProcessed++;
      }
    }
  }

  /**
   * Apply inheritance rules across hierarchy
   */
  private async applyInheritance(nodes: HierarchyNode[]): Promise<HierarchyNode[]> {
    for (const node of nodes) {
      if (node.parent) {
        await this.inheritFromParent(node, node.parent);
      }
    }

    // Handle conflict propagation if enabled
    if (this.config.inheritance.propagateConflicts) {
      await this.propagateConflicts(nodes);
    }

    return nodes;
  }

  /**
   * Inherit rules from parent node
   */
  private async inheritFromParent(child: HierarchyNode, parent: HierarchyNode): Promise<void> {
    switch (this.config.inheritance.strategy) {
      case 'strict':
        // Copy all parent rules without modification
        parent.metadata.inheritedRules.forEach((value, key) => {
          child.metadata.inheritedRules.set(key, value);
        });
        parent.metadata.localRules.forEach((value, key) => {
          child.metadata.inheritedRules.set(key, value);
        });
        break;

      case 'override':
        // Copy parent rules but allow child to override
        parent.metadata.inheritedRules.forEach((value, key) => {
          if (!child.metadata.localRules.has(key)) {
            child.metadata.inheritedRules.set(key, value);
          }
        });
        parent.metadata.localRules.forEach((value, key) => {
          if (
            !child.metadata.localRules.has(key) &&
            this.config.inheritance.overridePermissions.includes(key)
          ) {
            child.metadata.inheritedRules.set(key, value);
          }
        });
        break;

      case 'merge':
        // Merge parent and child rules with conflict resolution
        await this.mergeRules(child, parent);
        break;

      case 'selective':
        // Selective inheritance based on rule types
        await this.selectiveInheritance(child, parent);
        break;
    }
  }

  /**
   * Merge rules from parent with child rules
   */
  private async mergeRules(child: HierarchyNode, parent: HierarchyNode): Promise<void> {
    // Merge inherited rules
    parent.metadata.inheritedRules.forEach((value, key) => {
      const childValue = child.metadata.localRules.get(key);
      if (childValue) {
        // Conflict detected
        const merged = this.mergeConflictingRules(key, value, childValue);
        child.metadata.inheritedRules.set(key, merged);

        // Record conflict
        child.metadata.conflicts.push({
          sourcePattern: parent.pattern.name,
          targetPattern: child.pattern.name,
          conflictType: 'rule-inheritance',
          affectedClasses: new Set([key]),
          resolution: 'merged',
        });
      } else {
        child.metadata.inheritedRules.set(key, value);
      }
    });

    // Merge local parent rules
    parent.metadata.localRules.forEach((value, key) => {
      const childValue = child.metadata.localRules.get(key);
      if (childValue) {
        const similarity = this.calculateRuleSimilarity(value, childValue);
        if (similarity >= this.config.inheritance.mergeThreshold) {
          const merged = this.mergeConflictingRules(key, value, childValue);
          child.metadata.inheritedRules.set(key, merged);
        }
      } else {
        child.metadata.inheritedRules.set(key, value);
      }
    });
  }

  /**
   * Apply selective inheritance based on rule types
   */
  private async selectiveInheritance(child: HierarchyNode, parent: HierarchyNode): Promise<void> {
    const inheritanceRules = this.config.inheritance.overridePermissions;

    // Selectively inherit based on rule type
    const processRules = (rules: Map<string, any>, target: Map<string, any>) => {
      rules.forEach((value, key) => {
        // Check if this rule type should be inherited
        const shouldInherit = inheritanceRules.some((rule) => key.startsWith(rule));
        if (shouldInherit && !child.metadata.localRules.has(key)) {
          target.set(key, value);
        }
      });
    };

    processRules(parent.metadata.inheritedRules, child.metadata.inheritedRules);
    processRules(parent.metadata.localRules, child.metadata.inheritedRules);
  }

  /**
   * Merge conflicting rules
   */
  private mergeConflictingRules(key: string, parentValue: any, childValue: any): any {
    // Simple merge strategy - can be enhanced based on rule types
    if (typeof parentValue === 'object' && typeof childValue === 'object') {
      return { ...parentValue, ...childValue };
    }
    // Child value takes precedence for non-objects
    return childValue;
  }

  /**
   * Calculate similarity between two rules
   */
  private calculateRuleSimilarity(rule1: any, rule2: any): number {
    if (rule1 === rule2) return 1;
    if (typeof rule1 !== typeof rule2) return 0;

    if (typeof rule1 === 'object') {
      const keys1 = Object.keys(rule1);
      const keys2 = Object.keys(rule2);
      const commonKeys = keys1.filter((k) => keys2.includes(k));
      return commonKeys.length / Math.max(keys1.length, keys2.length);
    }

    return 0;
  }

  /**
   * Propagate conflicts up the hierarchy
   */
  private async propagateConflicts(nodes: HierarchyNode[]): Promise<void> {
    // Build conflict propagation map
    const conflictMap = new Map<string, PatternConflict[]>();

    // Collect all conflicts
    nodes.forEach((node) => {
      if (node.metadata.conflicts.length > 0) {
        conflictMap.set(node.pattern.name, node.metadata.conflicts);
      }
    });

    // Propagate conflicts to parent nodes
    nodes.forEach((node) => {
      if (node.parent && conflictMap.has(node.pattern.name)) {
        const conflicts = conflictMap.get(node.pattern.name)!;
        conflicts.forEach((conflict) => {
          // Create propagated conflict
          const propagatedConflict: PatternConflict = {
            ...conflict,
            conflictType: 'propagated',
            affectedClasses: new Set([...conflict.affectedClasses]),
          };
          node.parent!.metadata.conflicts.push(propagatedConflict);
        });
      }
    });
  }

  /**
   * Aggregate results across hierarchy levels
   */
  private async aggregateResults(nodes: HierarchyNode[]): Promise<HierarchyNode[]> {
    switch (this.config.aggregation.method) {
      case 'weighted':
        return this.weightedAggregation(nodes);
      case 'priority':
        return this.priorityAggregation(nodes);
      case 'consensus':
        return this.consensusAggregation(nodes);
      case 'hierarchical':
        return this.hierarchicalAggregation(nodes);
      default:
        return nodes;
    }
  }

  /**
   * Weighted aggregation based on hierarchy level
   */
  private weightedAggregation(nodes: HierarchyNode[]): HierarchyNode[] {
    const weights = this.config.aggregation.weights;

    nodes.forEach((node) => {
      let aggregatedScore = 0;
      let totalWeight = 0;

      // Add parent weight
      if (node.parent) {
        aggregatedScore += node.parent.pattern.totalFrequency * weights.parent;
        totalWeight += weights.parent;
      }

      // Add own weight
      aggregatedScore += node.pattern.totalFrequency * weights.child;
      totalWeight += weights.child;

      // Add sibling weights
      if (node.parent) {
        node.parent.children.forEach((sibling) => {
          if (sibling !== node) {
            aggregatedScore += sibling.pattern.totalFrequency * weights.sibling;
            totalWeight += weights.sibling;
          }
        });
      }

      // Store aggregated score
      if (totalWeight > 0) {
        (node as any).aggregatedScore = aggregatedScore / totalWeight;
      }
    });

    return nodes;
  }

  /**
   * Priority-based aggregation
   */
  private priorityAggregation(nodes: HierarchyNode[]): HierarchyNode[] {
    // Sort by priority (frequency) and process in order
    const sortedNodes = [...nodes].sort(
      (a, b) => b.pattern.totalFrequency - a.pattern.totalFrequency
    );

    sortedNodes.forEach((node, index) => {
      (node as any).aggregatedPriority = sortedNodes.length - index;
    });

    return nodes;
  }

  /**
   * Consensus-based aggregation
   */
  private consensusAggregation(nodes: HierarchyNode[]): HierarchyNode[] {
    const threshold = this.config.aggregation.consensusThreshold;
    const groupMap = new Map<number, HierarchyNode[]>();

    // Group by level
    nodes.forEach((node) => {
      if (!groupMap.has(node.level)) {
        groupMap.set(node.level, []);
      }
      groupMap.get(node.level)!.push(node);
    });

    // Check consensus at each level
    groupMap.forEach((levelNodes, _level) => {
      const avgFrequency =
        levelNodes.reduce((sum, n) => sum + n.pattern.totalFrequency, 0) / levelNodes.length;

      levelNodes.forEach((node) => {
        const deviation = Math.abs(node.pattern.totalFrequency - avgFrequency) / avgFrequency;
        (node as any).consensusReached = deviation <= 1 - threshold;
      });
    });

    return nodes;
  }

  /**
   * Hierarchical aggregation preserving hierarchy structure
   */
  private hierarchicalAggregation(nodes: HierarchyNode[]): HierarchyNode[] {
    // Process from bottom to top
    const maxLevel = Math.max(...nodes.map((n) => n.level));

    for (let level = maxLevel; level >= 0; level--) {
      const levelNodes = nodes.filter((n) => n.level === level);

      levelNodes.forEach((node) => {
        let childrenScore = 0;
        if (node.children.length > 0) {
          childrenScore =
            node.children.reduce(
              (sum, child) =>
                sum + ((child as any).hierarchicalScore || child.pattern.totalFrequency),
              0
            ) / node.children.length;
        }

        (node as any).hierarchicalScore = (node.pattern.totalFrequency + childrenScore) / 2;
      });
    }

    return nodes;
  }

  /**
   * Build enhanced patterns with hierarchy metadata
   */
  private buildEnhancedPatterns(
    nodes: HierarchyNode[]
  ): HierarchyIntegrationResult['enhancedPatterns'] {
    return nodes.map((node) => {
      const parentChain: string[] = [];
      let current: HierarchyNode | undefined = node.parent;
      while (current) {
        parentChain.push(current.pattern.name);
        current = current.parent;
      }

      return {
        pattern: node.pattern,
        hierarchyLevel: node.level,
        inheritedProperties: new Map(node.metadata.inheritedRules),
        effectiveRules: new Map([...node.metadata.inheritedRules, ...node.metadata.localRules]),
        parentChain,
        childrenCount: node.children.length,
      };
    });
  }

  /**
   * Build propagation result
   */
  private buildPropagationResult(
    nodes: HierarchyNode[]
  ): HierarchyIntegrationResult['propagation'] {
    let rulesApplied = 0;
    let conflictsResolved = 0;
    const inheritanceChains: Array<{ source: string; target: string; rules: string[] }> = [];

    nodes.forEach((node) => {
      rulesApplied += node.metadata.inheritedRules.size;
      conflictsResolved += node.metadata.resolutions.length;

      if (node.parent && node.metadata.inheritedRules.size > 0) {
        inheritanceChains.push({
          source: node.parent.pattern.name,
          target: node.pattern.name,
          rules: Array.from(node.metadata.inheritedRules.keys()),
        });
      }
    });

    return {
      rulesApplied,
      conflictsResolved,
      inheritanceChains,
    };
  }

  /**
   * Build aggregation result
   */
  private buildAggregationResult(
    nodes: HierarchyNode[]
  ): HierarchyIntegrationResult['aggregation'] {
    const aggregatedScores = new Map<string, number>();
    const outliers: string[] = [];
    let consensusReached = true;

    // Calculate mean and standard deviation
    const scores = nodes.map((n) => (n as any).hierarchicalScore || n.pattern.totalFrequency);
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const stdDev = Math.sqrt(
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
    );

    nodes.forEach((node) => {
      const score = (node as any).hierarchicalScore || node.pattern.totalFrequency;
      aggregatedScores.set(node.pattern.name, score);

      // Identify outliers (2 standard deviations from mean)
      if (Math.abs(score - mean) > 2 * stdDev) {
        outliers.push(node.pattern.name);
      }

      // Check consensus
      if ((node as any).consensusReached === false) {
        consensusReached = false;
      }
    });

    return {
      method: this.config.aggregation.method,
      aggregatedScores,
      consensusReached,
      outliers,
    };
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): HierarchyIntegrationConfig {
    return DEFAULT_HIERARCHY_INTEGRATION_CONFIG;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<HierarchyIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.performanceMetrics = {
      traversalTime: 0,
      nodesProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Clear caches
   */
  public clearCaches(): void {
    this.traversalCache.clear();
    this.dependencyGraph.clear();
    this.visitedNodes.clear();
  }
}
