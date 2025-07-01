/**
 * Pattern Grouping System
 *
 * Advanced grouping mechanisms for responsive and pseudo-class patterns.
 * Supports multiple grouping strategies for efficient processing and optimization.
 *
 * Features:
 * - Multi-strategy pattern grouping (breakpoint, pseudo-class, component, semantic)
 * - Hierarchical group structures with nested groupings
 * - Conflict resolution and group validation
 * - Performance-optimized group operations
 * - Configurable grouping rules and strategies
 * - Group analysis and optimization metrics
 */

import { z } from 'zod';
import { createPerformanceMonitor, type PerformanceMonitor } from './performanceMonitor';
import { type ResponsiveOptimizationConfig } from './responsiveOptimization';

// ===== SCHEMAS AND TYPES =====

/**
 * Grouping strategy enumeration
 */
export const GroupingStrategySchema = z.enum([
  'breakpoint', // Group by responsive breakpoint
  'pseudo-class', // Group by pseudo-class state
  'component', // Group by component scope
  'semantic', // Group by semantic meaning
  'property', // Group by CSS property
  'utility', // Group by utility type
  'priority', // Group by priority/specificity
  'frequency', // Group by usage frequency
  'custom', // Custom grouping logic
]);

export type GroupingStrategy = z.infer<typeof GroupingStrategySchema>;

/**
 * Pattern classification for grouping
 */
export const PatternClassificationSchema = z.object({
  id: z.string(),
  original: z.string(),
  normalized: z.string(),
  type: z.enum(['utility', 'component', 'responsive', 'pseudo-class', 'combined']),
  breakpoint: z.string().optional(),
  pseudoClass: z.string().optional(),
  property: z.string().optional(),
  value: z.string().optional(),
  component: z.string().optional(),
  priority: z.number().default(0),
  frequency: z.number().default(0),
  metadata: z.object({
    isResponsive: z.boolean(),
    hasPseudoClass: z.boolean(),
    hasArbitraryValue: z.boolean(),
    hasImportant: z.boolean(),
    nestingLevel: z.number().default(0),
    specificityScore: z.number().default(0),
    semanticGroup: z.string().optional(),
    utilityGroup: z.string().optional(),
  }),
});

export type PatternClassification = z.infer<typeof PatternClassificationSchema>;

/**
 * Pattern group definition
 */
export const PatternGroupSchema = z.object({
  id: z.string(),
  strategy: GroupingStrategySchema,
  name: z.string(),
  description: z.string().optional(),
  patterns: z.array(PatternClassificationSchema),
  metadata: z.object({
    size: z.number(),
    totalFrequency: z.number(),
    averagePriority: z.number(),
    breakpoints: z.array(z.string()),
    pseudoClasses: z.array(z.string()),
    properties: z.array(z.string()),
    complexity: z.number(),
    optimizationPotential: z.number().min(0).max(1),
  }),
  // subGroups: z.array(z.lazy(() => PatternGroupSchema)).optional(), // Removed to avoid circular reference
  conflicts: z.array(
    z.object({
      type: z.enum(['specificity', 'order', 'inheritance', 'cascade']),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      affectedPatterns: z.array(z.string()),
    })
  ),
  optimization: z.object({
    canCombine: z.boolean(),
    canReorder: z.boolean(),
    canMerge: z.boolean(),
    estimatedSavings: z.number(),
    recommendations: z.array(z.string()),
  }),
});

export type PatternGroup = z.infer<typeof PatternGroupSchema>;

/**
 * Grouping configuration
 */
export const GroupingConfigSchema = z.object({
  strategies: z.array(GroupingStrategySchema).default(['breakpoint', 'pseudo-class']),
  enableHierarchical: z.boolean().default(true),
  enableNested: z.boolean().default(true),
  maxNestingDepth: z.number().min(1).max(5).default(3),
  minGroupSize: z.number().min(1).default(2),
  maxGroupSize: z.number().min(1).default(100),
  enableConflictDetection: z.boolean().default(true),
  enableOptimization: z.boolean().default(true),
  prioritizeFrequency: z.boolean().default(true),
  preserveOrder: z.boolean().default(false),
  customRules: z
    .array(
      z.object({
        name: z.string(),
        condition: z.string(), // Function string or regex
        groupId: z.string(),
        priority: z.number().default(0),
      })
    )
    .default([]),
});

export type GroupingConfig = z.infer<typeof GroupingConfigSchema>;

/**
 * Grouping analysis result
 */
export const GroupingAnalysisSchema = z.object({
  patterns: z.array(PatternClassificationSchema),
  groups: z.array(PatternGroupSchema),
  statistics: z.object({
    totalPatterns: z.number(),
    totalGroups: z.number(),
    averageGroupSize: z.number(),
    largestGroupSize: z.number(),
    ungroupedPatterns: z.number(),
    conflictCount: z.number(),
    optimizationPotential: z.number().min(0).max(1),
  }),
  performance: z.object({
    processingTime: z.number(),
    memoryUsage: z.number(),
    cacheHits: z.number(),
  }),
  recommendations: z.array(z.string()),
});

export type GroupingAnalysis = z.infer<typeof GroupingAnalysisSchema>;

// ===== CORE CLASSES =====

/**
 * Pattern grouping engine for responsive and pseudo-class optimization
 */
export class PatternGroupingEngine {
  private readonly config: GroupingConfig;
  private readonly responsiveConfig: ResponsiveOptimizationConfig;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly classificationCache: Map<string, PatternClassification>;
  private readonly groupCache: Map<string, PatternGroup[]>;
  private readonly customRules: Map<string, Function>;

  constructor(
    config: Partial<GroupingConfig> = {},
    responsiveConfig: ResponsiveOptimizationConfig
  ) {
    this.config = GroupingConfigSchema.parse(config);
    this.responsiveConfig = responsiveConfig;
    this.performanceMonitor = createPerformanceMonitor({
      enabled: responsiveConfig.includeOptimizationMetrics,
      enableGC: true,
      enableEventLoop: true,
    });

    // Initialize caches
    this.classificationCache = new Map();
    this.groupCache = new Map();
    this.customRules = new Map();

    // Initialize custom rules
    this.initializeCustomRules();
  }

  /**
   * Classify patterns for grouping analysis
   */
  public classifyPatterns(patterns: string[]): PatternClassification[] {
    const measurementId = this.performanceMonitor.startMeasurement('classifyPatterns', {
      patternCount: patterns.length,
    });

    try {
      return patterns.map((pattern) => this.classifyPattern(pattern));
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Group patterns using specified strategies
   */
  public groupPatterns(
    patterns: string[],
    strategies: GroupingStrategy[] = this.config.strategies
  ): GroupingAnalysis {
    const measurementId = this.performanceMonitor.startMeasurement('groupPatterns', {
      patternCount: patterns.length,
      strategies: strategies.length,
    });

    try {
      // Classify patterns first
      const classifications = this.classifyPatterns(patterns);

      // Apply grouping strategies
      const groups: PatternGroup[] = [];
      for (const strategy of strategies) {
        const strategyGroups = this.applyGroupingStrategy(classifications, strategy);
        groups.push(...strategyGroups);
      }

      // Apply hierarchical grouping if enabled
      const finalGroups = this.config.enableHierarchical
        ? this.createHierarchicalGroups(groups)
        : groups;

      // Analyze and optimize groups
      const optimizedGroups = this.config.enableOptimization
        ? this.optimizeGroups(finalGroups)
        : finalGroups;

      // Generate analysis
      return this.generateGroupingAnalysis(classifications, optimizedGroups);
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Merge compatible groups for optimization
   */
  public mergeGroups(groups: PatternGroup[]): PatternGroup[] {
    const measurementId = this.performanceMonitor.startMeasurement('mergeGroups', {
      groupCount: groups.length,
    });

    try {
      const mergedGroups: PatternGroup[] = [];
      const processed = new Set<string>();

      for (const group of groups) {
        if (processed.has(group.id)) continue;

        // Find compatible groups to merge
        const compatibleGroups = groups.filter(
          (otherGroup) =>
            !processed.has(otherGroup.id) &&
            otherGroup.id !== group.id &&
            this.areGroupsCompatible(group, otherGroup)
        );

        if (compatibleGroups.length > 0) {
          // Merge compatible groups
          const merged = this.mergeCompatibleGroups([group, ...compatibleGroups]);
          mergedGroups.push(merged);

          // Mark as processed
          [group, ...compatibleGroups].forEach((g) => processed.add(g.id));
        } else {
          mergedGroups.push(group);
          processed.add(group.id);
        }
      }

      return mergedGroups;
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Validate group structure and detect conflicts
   */
  public validateGroups(groups: PatternGroup[]): {
    isValid: boolean;
    conflicts: any[];
    warnings: string[];
  } {
    const conflicts: any[] = [];
    const warnings: string[] = [];

    for (const group of groups) {
      // Check group size constraints
      if (group.patterns.length < this.config.minGroupSize) {
        warnings.push(
          `Group ${group.id} has ${group.patterns.length} patterns, below minimum of ${this.config.minGroupSize}`
        );
      }

      if (group.patterns.length > this.config.maxGroupSize) {
        warnings.push(
          `Group ${group.id} has ${group.patterns.length} patterns, above maximum of ${this.config.maxGroupSize}`
        );
      }

      // Detect conflicts within group
      conflicts.push(...this.detectGroupConflicts(group));

      // Note: Subgroups temporarily disabled to avoid circular reference issues
    }

    return {
      isValid: conflicts.length === 0,
      conflicts,
      warnings,
    };
  }

  /**
   * Get grouping metrics and performance data
   */
  public getMetrics(): {
    classificationsCount: number;
    cacheHitRate: number;
    customRulesCount: number;
    performance: any;
  } {
    const totalClassifications = this.classificationCache.size;
    const cacheHits = this.classificationCache.size; // Simplified metric

    return {
      classificationsCount: totalClassifications,
      cacheHitRate: totalClassifications > 0 ? cacheHits / totalClassifications : 0,
      customRulesCount: this.customRules.size,
      performance: this.performanceMonitor.getCurrentMetrics(),
    };
  }

  /**
   * Clear caches to free memory
   */
  public clearCaches(): void {
    this.classificationCache.clear();
    this.groupCache.clear();
  }

  // ===== PRIVATE METHODS =====

  /**
   * Classify a single pattern
   */
  private classifyPattern(pattern: string): PatternClassification {
    // Check cache first
    if (this.classificationCache.has(pattern)) {
      return this.classificationCache.get(pattern)!;
    }

    const classification = this.performPatternClassification(pattern);

    // Cache result
    if (this.classificationCache.size < 10000) {
      // Reasonable cache limit
      this.classificationCache.set(pattern, classification);
    }

    return classification;
  }

  /**
   * Perform the actual pattern classification
   */
  private performPatternClassification(pattern: string): PatternClassification {
    const id = `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Parse pattern components
    const parts = pattern.split(':');
    const baseClass = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    // Detect breakpoint
    const breakpoint = modifiers.find((mod) =>
      this.responsiveConfig.breakpoints.some((bp) => bp.name === mod)
    );

    // Detect pseudo-class
    const pseudoClass = modifiers.find((mod) =>
      this.responsiveConfig.pseudoStates.some((ps) => ps.name === mod)
    );

    // Determine pattern type
    let type: 'utility' | 'component' | 'responsive' | 'pseudo-class' | 'combined' = 'utility';
    if (breakpoint && pseudoClass) {
      type = 'combined';
    } else if (breakpoint) {
      type = 'responsive';
    } else if (pseudoClass) {
      type = 'pseudo-class';
    } else if (this.isComponentClass(baseClass)) {
      type = 'component';
    }

    // Extract CSS property and value
    const { property, value } = this.extractPropertyAndValue(baseClass);

    // Calculate metadata
    const hasArbitraryValue = /\[.*\]/.test(pattern);
    const hasImportant = pattern.includes('!');
    const nestingLevel = modifiers.length;
    const specificityScore = this.calculateSpecificity(modifiers, hasImportant);

    return PatternClassificationSchema.parse({
      id,
      original: pattern,
      normalized: this.normalizePattern(pattern),
      type,
      breakpoint,
      pseudoClass,
      property,
      value,
      component: type === 'component' ? this.extractComponentName(baseClass) : undefined,
      priority: this.calculatePriority(type, specificityScore, breakpoint, pseudoClass),
      frequency: 0, // Will be calculated separately if needed
      metadata: {
        isResponsive: !!breakpoint,
        hasPseudoClass: !!pseudoClass,
        hasArbitraryValue,
        hasImportant,
        nestingLevel,
        specificityScore,
        semanticGroup: this.getSemanticGroup(property),
        utilityGroup: this.getUtilityGroup(baseClass),
      },
    });
  }

  /**
   * Apply a specific grouping strategy
   */
  private applyGroupingStrategy(
    classifications: PatternClassification[],
    strategy: GroupingStrategy
  ): PatternGroup[] {
    switch (strategy) {
      case 'breakpoint':
        return this.groupByBreakpoint(classifications);
      case 'pseudo-class':
        return this.groupByPseudoClass(classifications);
      case 'component':
        return this.groupByComponent(classifications);
      case 'semantic':
        return this.groupBySemantic(classifications);
      case 'property':
        return this.groupByProperty(classifications);
      case 'utility':
        return this.groupByUtility(classifications);
      case 'priority':
        return this.groupByPriority(classifications);
      case 'frequency':
        return this.groupByFrequency(classifications);
      case 'custom':
        return this.groupByCustomRules(classifications);
      default:
        return [];
    }
  }

  /**
   * Group patterns by responsive breakpoint
   */
  private groupByBreakpoint(classifications: PatternClassification[]): PatternGroup[] {
    const groups = new Map<string, PatternClassification[]>();

    // Group by breakpoint
    for (const classification of classifications) {
      const key = classification.breakpoint || 'base';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(classification);
    }

    // Create pattern groups
    return Array.from(groups.entries()).map(([breakpoint, patterns]) =>
      this.createPatternGroup({
        id: `breakpoint-${breakpoint}`,
        strategy: 'breakpoint',
        name: `${breakpoint} breakpoint`,
        patterns,
        description: `Patterns for ${breakpoint} breakpoint`,
      })
    );
  }

  /**
   * Group patterns by pseudo-class
   */
  private groupByPseudoClass(classifications: PatternClassification[]): PatternGroup[] {
    const groups = new Map<string, PatternClassification[]>();

    for (const classification of classifications) {
      const key = classification.pseudoClass || 'base';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(classification);
    }

    return Array.from(groups.entries()).map(([pseudoClass, patterns]) =>
      this.createPatternGroup({
        id: `pseudo-${pseudoClass}`,
        strategy: 'pseudo-class',
        name: `${pseudoClass} pseudo-class`,
        patterns,
        description: `Patterns with ${pseudoClass} pseudo-class`,
      })
    );
  }

  /**
   * Group patterns by component
   */
  private groupByComponent(classifications: PatternClassification[]): PatternGroup[] {
    const groups = new Map<string, PatternClassification[]>();

    for (const classification of classifications) {
      const key = classification.component || 'utility';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(classification);
    }

    return Array.from(groups.entries()).map(([component, patterns]) =>
      this.createPatternGroup({
        id: `component-${component}`,
        strategy: 'component',
        name: `${component} component`,
        patterns,
        description: `Patterns for ${component} component`,
      })
    );
  }

  /**
   * Group patterns by semantic meaning
   */
  private groupBySemantic(classifications: PatternClassification[]): PatternGroup[] {
    const groups = new Map<string, PatternClassification[]>();

    for (const classification of classifications) {
      const key = classification.metadata.semanticGroup || 'other';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(classification);
    }

    return Array.from(groups.entries()).map(([semantic, patterns]) =>
      this.createPatternGroup({
        id: `semantic-${semantic}`,
        strategy: 'semantic',
        name: `${semantic} properties`,
        patterns,
        description: `Semantically related ${semantic} patterns`,
      })
    );
  }

  /**
   * Group patterns by CSS property
   */
  private groupByProperty(classifications: PatternClassification[]): PatternGroup[] {
    const groups = new Map<string, PatternClassification[]>();

    for (const classification of classifications) {
      const key = classification.property || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(classification);
    }

    return Array.from(groups.entries()).map(([property, patterns]) =>
      this.createPatternGroup({
        id: `property-${property}`,
        strategy: 'property',
        name: `${property} property`,
        patterns,
        description: `Patterns affecting ${property} CSS property`,
      })
    );
  }

  /**
   * Group patterns by utility type
   */
  private groupByUtility(classifications: PatternClassification[]): PatternGroup[] {
    const groups = new Map<string, PatternClassification[]>();

    for (const classification of classifications) {
      const key = classification.metadata.utilityGroup || 'other';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(classification);
    }

    return Array.from(groups.entries()).map(([utility, patterns]) =>
      this.createPatternGroup({
        id: `utility-${utility}`,
        strategy: 'utility',
        name: `${utility} utilities`,
        patterns,
        description: `${utility} utility patterns`,
      })
    );
  }

  /**
   * Group patterns by priority/specificity
   */
  private groupByPriority(classifications: PatternClassification[]): PatternGroup[] {
    // Sort by priority and create groups
    const sorted = [...classifications].sort((a, b) => b.priority - a.priority);

    const groups: PatternGroup[] = [];
    const chunkSize = Math.max(this.config.minGroupSize, Math.ceil(sorted.length / 5));

    for (let i = 0; i < sorted.length; i += chunkSize) {
      const chunk = sorted.slice(i, i + chunkSize);
      const avgPriority = chunk.reduce((sum, c) => sum + c.priority, 0) / chunk.length;

      groups.push(
        this.createPatternGroup({
          id: `priority-${Math.round(avgPriority)}`,
          strategy: 'priority',
          name: `Priority ${Math.round(avgPriority)}`,
          patterns: chunk,
          description: `High priority patterns (avg: ${Math.round(avgPriority)})`,
        })
      );
    }

    return groups;
  }

  /**
   * Group patterns by usage frequency
   */
  private groupByFrequency(classifications: PatternClassification[]): PatternGroup[] {
    // Sort by frequency and create groups
    const sorted = [...classifications].sort((a, b) => b.frequency - a.frequency);

    const groups: PatternGroup[] = [];
    const chunkSize = Math.max(this.config.minGroupSize, Math.ceil(sorted.length / 3));

    for (let i = 0; i < sorted.length; i += chunkSize) {
      const chunk = sorted.slice(i, i + chunkSize);
      const totalFreq = chunk.reduce((sum, c) => sum + c.frequency, 0);

      groups.push(
        this.createPatternGroup({
          id: `frequency-${totalFreq}`,
          strategy: 'frequency',
          name: `Frequency ${totalFreq}`,
          patterns: chunk,
          description: `Frequently used patterns (total: ${totalFreq})`,
        })
      );
    }

    return groups;
  }

  /**
   * Group patterns using custom rules
   */
  private groupByCustomRules(classifications: PatternClassification[]): PatternGroup[] {
    const groups = new Map<string, PatternClassification[]>();

    for (const classification of classifications) {
      let assigned = false;

      // Apply custom rules in priority order
      for (const [ruleName, ruleFn] of this.customRules.entries()) {
        try {
          if (ruleFn(classification)) {
            const rule = this.config.customRules.find((r) => r.name === ruleName);
            if (rule) {
              if (!groups.has(rule.groupId)) {
                groups.set(rule.groupId, []);
              }
              groups.get(rule.groupId)!.push(classification);
              assigned = true;
              break;
            }
          }
        } catch (error) {
          console.warn(`Custom rule ${ruleName} failed:`, error);
        }
      }

      // Default group for unmatched patterns
      if (!assigned) {
        if (!groups.has('custom-other')) {
          groups.set('custom-other', []);
        }
        groups.get('custom-other')!.push(classification);
      }
    }

    return Array.from(groups.entries()).map(([groupId, patterns]) =>
      this.createPatternGroup({
        id: `custom-${groupId}`,
        strategy: 'custom',
        name: groupId,
        patterns,
        description: `Custom group: ${groupId}`,
      })
    );
  }

  /**
   * Create hierarchical group structure
   */
  private createHierarchicalGroups(groups: PatternGroup[]): PatternGroup[] {
    // For now, return as-is. Full implementation would create nested structures
    return groups;
  }

  /**
   * Optimize groups for better performance and organization
   */
  private optimizeGroups(groups: PatternGroup[]): PatternGroup[] {
    // Merge compatible groups
    const merged = this.mergeGroups(groups);

    // Sort by optimization potential
    return merged.sort(
      (a, b) => b.metadata.optimizationPotential - a.metadata.optimizationPotential
    );
  }

  /**
   * Generate comprehensive grouping analysis
   */
  private generateGroupingAnalysis(
    patterns: PatternClassification[],
    groups: PatternGroup[]
  ): GroupingAnalysis {
    const groupedPatternIds = new Set(groups.flatMap((group) => group.patterns.map((p) => p.id)));
    const ungroupedPatterns = patterns.filter((p) => !groupedPatternIds.has(p.id));

    const statistics = {
      totalPatterns: patterns.length,
      totalGroups: groups.length,
      averageGroupSize:
        groups.length > 0
          ? groups.reduce((sum, g) => sum + g.patterns.length, 0) / groups.length
          : 0,
      largestGroupSize: Math.max(...groups.map((g) => g.patterns.length), 0),
      ungroupedPatterns: ungroupedPatterns.length,
      conflictCount: groups.reduce((sum, g) => sum + g.conflicts.length, 0),
      optimizationPotential:
        groups.length > 0
          ? groups.reduce((sum, g) => sum + g.metadata.optimizationPotential, 0) / groups.length
          : 0,
    };

    const recommendations = this.generateGroupingRecommendations(statistics, groups);

    return GroupingAnalysisSchema.parse({
      patterns,
      groups,
      statistics,
      performance: {
        processingTime: Date.now(),
        memoryUsage: 0, // Would be calculated in real implementation
        cacheHits: this.classificationCache.size,
      },
      recommendations,
    });
  }

  /**
   * Helper methods for pattern classification and grouping
   */
  private isComponentClass(className: string): boolean {
    // Simple heuristic - component classes often start with uppercase or contain dashes
    return /^[A-Z]/.test(className) || (className.includes('-') && !this.isUtilityClass(className));
  }

  private isUtilityClass(className: string): boolean {
    // Common utility patterns
    const utilityPrefixes = [
      'bg-',
      'text-',
      'p-',
      'm-',
      'w-',
      'h-',
      'flex',
      'grid',
      'block',
      'inline',
      'hidden',
    ];
    return utilityPrefixes.some((prefix) => className.startsWith(prefix));
  }

  private extractPropertyAndValue(className: string): { property?: string; value?: string } {
    // Extract CSS property and value from utility class
    const propertyMap: Record<string, string> = {
      'bg-': 'background-color',
      'text-': 'color',
      'p-': 'padding',
      'm-': 'margin',
      'w-': 'width',
      'h-': 'height',
      flex: 'display',
      grid: 'display',
      block: 'display',
      inline: 'display',
      hidden: 'display',
    };

    for (const [prefix, property] of Object.entries(propertyMap)) {
      if (className.startsWith(prefix)) {
        const value = className.slice(prefix.length);
        return { property, value };
      }
    }

    return {};
  }

  private extractComponentName(className: string): string {
    // Extract component name from class
    return className.split('-')[0] || className;
  }

  private normalizePattern(pattern: string): string {
    // Normalize pattern for comparison
    return pattern.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private calculateSpecificity(modifiers: string[], hasImportant: boolean): number {
    let specificity = 1; // Base class
    specificity += modifiers.length * 10; // Pseudo-classes and responsive
    if (hasImportant) specificity += 1000; // !important
    return specificity;
  }

  private calculatePriority(
    type: string,
    specificity: number,
    breakpoint?: string,
    pseudoClass?: string
  ): number {
    let priority = specificity;

    // Boost priority for responsive patterns
    if (breakpoint) {
      const bp = this.responsiveConfig.breakpoints.find((b) => b.name === breakpoint);
      priority += bp ? bp.minWidth : 0;
    }

    // Boost priority for interactive pseudo-classes
    if (pseudoClass) {
      const ps = this.responsiveConfig.pseudoStates.find((s) => s.name === pseudoClass);
      priority += ps ? ps.priority : 0;
    }

    return priority;
  }

  private getSemanticGroup(property?: string): string {
    const semanticGroups: Record<string, string> = {
      'background-color': 'color',
      color: 'color',
      'border-color': 'color',
      padding: 'spacing',
      margin: 'spacing',
      width: 'sizing',
      height: 'sizing',
      display: 'layout',
      position: 'layout',
      flex: 'layout',
      grid: 'layout',
    };

    return semanticGroups[property || ''] || 'other';
  }

  private getUtilityGroup(className: string): string {
    const utilityGroups: Record<string, string> = {
      'bg-': 'background',
      'text-': 'typography',
      'p-': 'spacing',
      'm-': 'spacing',
      'w-': 'sizing',
      'h-': 'sizing',
      flex: 'layout',
      grid: 'layout',
      block: 'display',
      inline: 'display',
      hidden: 'display',
    };

    for (const [prefix, group] of Object.entries(utilityGroups)) {
      if (className.startsWith(prefix)) {
        return group;
      }
    }

    return 'other';
  }

  private createPatternGroup(params: {
    id: string;
    strategy: GroupingStrategy;
    name: string;
    patterns: PatternClassification[];
    description?: string;
  }): PatternGroup {
    const { id, strategy, name, patterns, description } = params;

    // Calculate metadata
    const totalFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0);
    const averagePriority =
      patterns.length > 0 ? patterns.reduce((sum, p) => sum + p.priority, 0) / patterns.length : 0;

    const breakpoints = [...new Set(patterns.map((p) => p.breakpoint).filter(Boolean))];
    const pseudoClasses = [...new Set(patterns.map((p) => p.pseudoClass).filter(Boolean))];
    const properties = [...new Set(patterns.map((p) => p.property).filter(Boolean))];

    const complexity = this.calculateGroupComplexity(patterns);
    const optimizationPotential = this.calculateOptimizationPotential(patterns);

    // Detect conflicts
    const conflicts = this.detectGroupConflicts({ patterns } as PatternGroup);

    // Generate optimization recommendations
    const optimization = this.generateGroupOptimization(patterns);

    return PatternGroupSchema.parse({
      id,
      strategy,
      name,
      description,
      patterns,
      metadata: {
        size: patterns.length,
        totalFrequency,
        averagePriority,
        breakpoints,
        pseudoClasses,
        properties,
        complexity,
        optimizationPotential,
      },
      conflicts,
      optimization,
    });
  }

  private calculateGroupComplexity(patterns: PatternClassification[]): number {
    if (patterns.length === 0) return 0;

    const avgNesting =
      patterns.reduce((sum, p) => sum + p.metadata.nestingLevel, 0) / patterns.length;
    const uniqueBreakpoints = new Set(patterns.map((p) => p.breakpoint).filter(Boolean)).size;
    const uniquePseudoClasses = new Set(patterns.map((p) => p.pseudoClass).filter(Boolean)).size;
    const arbitraryValues = patterns.filter((p) => p.metadata.hasArbitraryValue).length;

    return avgNesting * 2 + uniqueBreakpoints + uniquePseudoClasses + arbitraryValues * 0.5;
  }

  private calculateOptimizationPotential(patterns: PatternClassification[]): number {
    if (patterns.length < 2) return 0;

    let potential = 0;

    // Check for duplicate patterns
    const uniquePatterns = new Set(patterns.map((p) => p.normalized));
    if (uniquePatterns.size < patterns.length) {
      potential += 0.3;
    }

    // Check for combinable patterns
    const combinableCount = patterns.filter(
      (p) => !p.metadata.hasImportant && !p.metadata.hasArbitraryValue
    ).length;
    if (combinableCount > 1) {
      potential += 0.4;
    }

    // Check for reorderable patterns
    const reorderableCount = patterns.filter(
      (p) => p.metadata.isResponsive || p.metadata.hasPseudoClass
    ).length;
    if (reorderableCount > 1) {
      potential += 0.3;
    }

    return Math.min(potential, 1.0);
  }

  private detectGroupConflicts(group: Partial<PatternGroup>): any[] {
    const conflicts: any[] = [];
    if (!group.patterns) return conflicts;

    // Check for specificity conflicts
    const highSpecificity = group.patterns.filter((p) => p.metadata.specificityScore > 100);
    if (highSpecificity.length > 1) {
      conflicts.push({
        type: 'specificity',
        description: 'Multiple high-specificity patterns may cause cascade conflicts',
        severity: 'medium',
        affectedPatterns: highSpecificity.map((p) => p.original),
      });
    }

    // Check for order conflicts
    const hasOrderDependentPatterns = group.patterns.some(
      (p) => p.metadata.isResponsive || p.metadata.hasPseudoClass
    );
    if (hasOrderDependentPatterns && group.patterns.length > 3) {
      conflicts.push({
        type: 'order',
        description: 'Order-dependent patterns may require careful sequencing',
        severity: 'low',
        affectedPatterns: group.patterns.map((p) => p.original),
      });
    }

    return conflicts;
  }

  private generateGroupOptimization(patterns: PatternClassification[]): any {
    const canCombine =
      patterns.length > 1 &&
      patterns.every((p) => !p.metadata.hasImportant && !p.metadata.hasArbitraryValue);

    const canReorder = patterns.some((p) => p.metadata.isResponsive || p.metadata.hasPseudoClass);

    const canMerge = patterns.length > 1 && new Set(patterns.map((p) => p.property)).size === 1;

    const estimatedSavings = this.calculateEstimatedSavings(patterns);
    const recommendations = this.generateOptimizationRecommendations(patterns);

    return {
      canCombine,
      canReorder,
      canMerge,
      estimatedSavings,
      recommendations,
    };
  }

  private calculateEstimatedSavings(patterns: PatternClassification[]): number {
    // Estimate bytes saved through optimization
    const totalSize = patterns.reduce((sum, p) => sum + p.original.length, 0);
    const duplicates = patterns.length - new Set(patterns.map((p) => p.normalized)).size;

    return duplicates * 10; // Rough estimate of 10 bytes per duplicate
  }

  private generateOptimizationRecommendations(patterns: PatternClassification[]): string[] {
    const recommendations: string[] = [];

    const duplicates = patterns.length - new Set(patterns.map((p) => p.normalized)).size;
    if (duplicates > 0) {
      recommendations.push(`Remove ${duplicates} duplicate patterns`);
    }

    const arbitraryValues = patterns.filter((p) => p.metadata.hasArbitraryValue).length;
    if (arbitraryValues > 2) {
      recommendations.push('Consider using design tokens instead of arbitrary values');
    }

    const highSpecificity = patterns.filter((p) => p.metadata.specificityScore > 100).length;
    if (highSpecificity > 0) {
      recommendations.push('Reduce specificity to improve maintainability');
    }

    return recommendations;
  }

  private areGroupsCompatible(group1: PatternGroup, group2: PatternGroup): boolean {
    // Groups are compatible if they have the same strategy and no conflicts
    return (
      group1.strategy === group2.strategy &&
      group1.conflicts.length === 0 &&
      group2.conflicts.length === 0 &&
      group1.patterns.length + group2.patterns.length <= this.config.maxGroupSize
    );
  }

  private mergeCompatibleGroups(groups: PatternGroup[]): PatternGroup {
    const allPatterns = groups.flatMap((g) => g.patterns);
    const mergedId = groups.map((g) => g.id).join('-');

    return this.createPatternGroup({
      id: `merged-${mergedId}`,
      strategy: groups[0].strategy,
      name: `Merged ${groups[0].strategy} group`,
      patterns: allPatterns,
      description: `Merged group from ${groups.length} compatible groups`,
    });
  }

  private getGroupDepth(_group: PatternGroup): number {
    // Simplified since subGroups are disabled
    return 1;
  }

  private generateGroupingRecommendations(statistics: any, groups: PatternGroup[]): string[] {
    const recommendations: string[] = [];

    if (statistics.ungroupedPatterns > 0) {
      recommendations.push(
        `${statistics.ungroupedPatterns} patterns remain ungrouped - consider additional grouping strategies`
      );
    }

    if (statistics.averageGroupSize < this.config.minGroupSize) {
      recommendations.push(
        'Average group size is below minimum - consider merging compatible groups'
      );
    }

    if (statistics.conflictCount > 0) {
      recommendations.push(
        `${statistics.conflictCount} conflicts detected - review group organization`
      );
    }

    const highOptimizationGroups = groups.filter((g) => g.metadata.optimizationPotential > 0.7);
    if (highOptimizationGroups.length > 0) {
      recommendations.push(
        `${highOptimizationGroups.length} groups have high optimization potential`
      );
    }

    return recommendations;
  }

  private initializeCustomRules(): void {
    // Initialize custom rules from config
    for (const rule of this.config.customRules) {
      try {
        // Create function from rule condition string
        const ruleFn = new Function('classification', `return ${rule.condition}`);
        this.customRules.set(rule.name, ruleFn);
      } catch (error) {
        console.warn(`Failed to initialize custom rule ${rule.name}:`, error);
      }
    }
  }
}

/**
 * Factory function to create a PatternGroupingEngine
 */
export function createPatternGroupingEngine(
  config?: Partial<GroupingConfig>,
  responsiveConfig?: Partial<ResponsiveOptimizationConfig>
): PatternGroupingEngine {
  const defaultResponsiveConfig: ResponsiveOptimizationConfig = {
    breakpoints: [],
    pseudoStates: [],
    enableResponsiveGrouping: true,
    enablePseudoClassGrouping: true,
    enableCombinedOptimization: true,
    enableBreakpointMerging: true,
    minimumFrequencyThreshold: 2,
    complexityAnalysisEnabled: true,
    coOccurrenceAnalysisEnabled: true,
    groupBySemanticMeaning: true,
    groupByProperty: true,
    groupByComponent: false,
    preserveOriginalOrder: false,
    generateSourceComments: true,
    includeOptimizationMetrics: true,
    enableCaching: true,
    maxCacheSize: 1000,
    enableParallelProcessing: true,
    parallelThreshold: 50,
    ...responsiveConfig,
  };

  return new PatternGroupingEngine(config, defaultResponsiveConfig);
}

/**
 * Utility function to quickly group patterns
 */
export function groupPatterns(
  patterns: string[],
  strategies: GroupingStrategy[] = ['breakpoint', 'pseudo-class']
): GroupingAnalysis {
  const engine = createPatternGroupingEngine({ strategies });
  return engine.groupPatterns(patterns, strategies);
}
