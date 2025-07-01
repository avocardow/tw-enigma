/**
 * Pseudo-Class Handler
 *
 * Core system for handling pseudo-class variants in Tailwind CSS optimization.
 * Supports detection, analysis, validation, and optimization of pseudo-class patterns.
 *
 * Features:
 * - Advanced pseudo-class pattern detection and parsing
 * - LVHA+ order validation and enforcement
 * - Pseudo-class variant optimization and grouping
 * - Complex pseudo-class combination analysis
 * - Performance-optimized caching and processing
 * - Configurable pseudo-class behavior management
 */

import { z } from 'zod';
import { createPerformanceMonitor, type PerformanceMonitor } from './performanceMonitor';
import {
  DEFAULT_PSEUDO_STATES,
  type PseudoClassState,
  type ResponsiveOptimizationConfig,
} from './responsiveOptimization';

// ===== SCHEMAS AND TYPES =====

/**
 * Parsed pseudo-class information from a class name
 */
export const ParsedPseudoClassSchema = z.object({
  original: z.string(),
  pseudoClass: z.string(),
  baseClass: z.string(),
  variants: z.array(z.string()),
  isValid: z.boolean(),
  priority: z.number(),
  metadata: z.object({
    isInteractive: z.boolean(),
    isStateful: z.boolean(),
    canCombine: z.boolean(),
    cssSelector: z.string(),
    nestingLevel: z.number().default(1),
    hasArbitraryValues: z.boolean().default(false),
    hasImportantModifier: z.boolean().default(false),
  }),
});

export type ParsedPseudoClass = z.infer<typeof ParsedPseudoClassSchema>;

/**
 * Pseudo-class pattern analysis result
 */
export const PseudoClassAnalysisSchema = z.object({
  className: z.string(),
  parsedClasses: z.array(ParsedPseudoClassSchema),
  totalPseudoClasses: z.number(),
  uniquePseudoClasses: z.number(),
  hasValidOrder: z.boolean(),
  orderViolations: z.array(z.string()),
  optimizationPotential: z.number().min(0).max(1),
  recommendedOptimizations: z.array(z.string()),
  conflicts: z.array(
    z.object({
      type: z.enum(['order-violation', 'specificity-conflict', 'behavior-conflict']),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      affectedClasses: z.array(z.string()),
    })
  ),
  metrics: z.object({
    interactiveStates: z.number(),
    statefulClasses: z.number(),
    combinableStates: z.number(),
    nestingComplexity: z.number(),
    specificityScore: z.number(),
  }),
});

export type PseudoClassAnalysis = z.infer<typeof PseudoClassAnalysisSchema>;

/**
 * Pseudo-class optimization result
 */
export const PseudoClassOptimizationSchema = z.object({
  original: z.array(z.string()),
  optimized: z.array(z.string()),
  reduction: z.object({
    classCount: z.number(),
    bytes: z.number(),
    percentage: z.number(),
  }),
  optimizations: z.array(
    z.object({
      type: z.enum(['reorder', 'combine', 'deduplicate', 'shorthand']),
      description: z.string(),
      impact: z.object({
        classesAffected: z.number(),
        sizeReduction: z.number(),
      }),
    })
  ),
  warnings: z.array(z.string()),
  metadata: z.object({
    processingTime: z.number(),
    cacheHits: z.number(),
    validationsPassed: z.number(),
  }),
});

export type PseudoClassOptimization = z.infer<typeof PseudoClassOptimizationSchema>;

/**
 * Pseudo-class validation configuration
 */
export const PseudoClassValidationConfigSchema = z.object({
  enforceValidOrder: z.boolean().default(true),
  allowUnknownPseudoClasses: z.boolean().default(false),
  maxNestingLevel: z.number().min(1).max(10).default(3),
  requireExplicitStatePriority: z.boolean().default(false),
  validateSpecificity: z.boolean().default(true),
  strictLVHAOrder: z.boolean().default(true),
  allowCustomPseudoClasses: z.boolean().default(true),
});

export type PseudoClassValidationConfig = z.infer<typeof PseudoClassValidationConfigSchema>;

// ===== CORE CLASSES =====

/**
 * Core pseudo-class handler for detection, analysis, and optimization
 */
export class PseudoClassHandler {
  private readonly pseudoStates: Map<string, PseudoClassState>;
  private readonly config: ResponsiveOptimizationConfig;
  private readonly validationConfig: PseudoClassValidationConfig;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly cache: Map<string, ParsedPseudoClass>;
  private readonly analysisCache: Map<string, PseudoClassAnalysis>;

  constructor(
    config: ResponsiveOptimizationConfig,
    validationConfig: Partial<PseudoClassValidationConfig> = {}
  ) {
    this.config = config;
    this.validationConfig = PseudoClassValidationConfigSchema.parse(validationConfig);
    this.performanceMonitor = createPerformanceMonitor({
      enabled: config.includeOptimizationMetrics,
      enableGC: true,
      enableEventLoop: true,
    });

    // Initialize pseudo-states map for fast lookup
    this.pseudoStates = new Map();
    config.pseudoStates.forEach((state) => {
      this.pseudoStates.set(state.name, state);
    });

    // Initialize caches
    this.cache = new Map();
    this.analysisCache = new Map();
  }

  /**
   * Parse a class name to extract pseudo-class information
   */
  public parsePseudoClass(className: string): ParsedPseudoClass {
    // Check cache first
    if (this.cache.has(className)) {
      return this.cache.get(className)!;
    }

    const measurementId = this.performanceMonitor.startMeasurement('parsePseudoClass', {
      className,
    });

    try {
      const result = this.performPseudoClassParsing(className);

      // Cache successful results
      if (this.config.enableCaching && this.cache.size < this.config.maxCacheSize) {
        this.cache.set(className, result);
      }

      return result;
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Analyze multiple class names for pseudo-class patterns
   */
  public analyzeClasses(classNames: string[]): PseudoClassAnalysis {
    const cacheKey = classNames.sort().join('|');

    // Check analysis cache
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    const measurementId = this.performanceMonitor.startMeasurement('analyzeClasses', {
      classCount: classNames.length,
    });

    try {
      const parsedClasses = classNames.map((name) => this.parsePseudoClass(name));
      const analysis = this.performClassAnalysis(classNames, parsedClasses);

      // Cache analysis results
      if (this.config.enableCaching && this.analysisCache.size < this.config.maxCacheSize) {
        this.analysisCache.set(cacheKey, analysis);
      }

      return analysis;
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Optimize pseudo-class usage in class names
   */
  public optimizeClasses(classNames: string[]): PseudoClassOptimization {
    const measurementId = this.performanceMonitor.startMeasurement('optimizeClasses', {
      classCount: classNames.length,
    });

    try {
      const analysis = this.analyzeClasses(classNames);
      const optimized = this.performOptimization(classNames, analysis);

      return {
        ...optimized,
        metadata: {
          ...optimized.metadata,
          processingTime: Date.now(),
        },
      };
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Validate pseudo-class order according to LVHA+ rules
   */
  public validatePseudoClassOrder(pseudoClasses: string[]): {
    isValid: boolean;
    violations: string[];
    corrections: string[];
  } {
    const violations: string[] = [];
    const corrections: string[] = [];

    // Get states for all pseudo-classes
    const states = pseudoClasses
      .map((pc) => this.pseudoStates.get(pc))
      .filter(Boolean) as PseudoClassState[];

    // Check LVHA order for interactive states
    const interactiveStates = states.filter((state) => state.isInteractive);
    const lvhaOrder = ['visited', 'hover', 'focus', 'active'];

    if (this.validationConfig.strictLVHAOrder && interactiveStates.length > 1) {
      const orderedInteractive = interactiveStates.sort((a, b) => {
        const aIndex = lvhaOrder.indexOf(a.name);
        const bIndex = lvhaOrder.indexOf(b.name);
        return aIndex - bIndex;
      });

      const correctOrder = orderedInteractive.map((state) => state.name);
      const actualOrder = interactiveStates.map((state) => state.name);

      if (JSON.stringify(correctOrder) !== JSON.stringify(actualOrder)) {
        violations.push(
          `LVHA order violation: expected [${correctOrder.join(', ')}], got [${actualOrder.join(', ')}]`
        );
        corrections.push(`Reorder to: ${correctOrder.join(', ')}`);
      }
    }

    // Check general priority order
    const sortedByPriority = states.sort((a, b) => a.priority - b.priority);
    const priorityOrder = sortedByPriority.map((state) => state.name);
    const actualPriorityOrder = states.map((state) => state.name);

    if (JSON.stringify(priorityOrder) !== JSON.stringify(actualPriorityOrder)) {
      violations.push(
        `Priority order violation: expected [${priorityOrder.join(', ')}], got [${actualPriorityOrder.join(', ')}]`
      );
      corrections.push(`Reorder by priority: ${priorityOrder.join(', ')}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      corrections,
    };
  }

  /**
   * Get metrics about current pseudo-class usage
   */
  public getMetrics(): {
    cacheSize: number;
    cacheHitRate: number;
    knownPseudoStates: number;
    performance: any;
  } {
    const totalRequests = this.cache.size + this.analysisCache.size;
    const cacheHits = this.cache.size; // Simplified metric

    return {
      cacheSize: this.cache.size,
      cacheHitRate: totalRequests > 0 ? cacheHits / totalRequests : 0,
      knownPseudoStates: this.pseudoStates.size,
      performance: this.performanceMonitor.getCurrentMetrics(),
    };
  }

  /**
   * Clear caches to free memory
   */
  public clearCaches(): void {
    this.cache.clear();
    this.analysisCache.clear();
  }

  // ===== PRIVATE METHODS =====

  /**
   * Perform the actual pseudo-class parsing logic
   */
  private performPseudoClassParsing(className: string): ParsedPseudoClass {
    // Split on colons to find pseudo-class variants
    const parts = className.split(':');

    if (parts.length === 1) {
      // No pseudo-classes
      return ParsedPseudoClassSchema.parse({
        original: className,
        pseudoClass: '',
        baseClass: className,
        variants: [],
        isValid: true,
        priority: 0,
        metadata: {
          isInteractive: false,
          isStateful: false,
          canCombine: true,
          cssSelector: '',
          nestingLevel: 0,
          hasArbitraryValues: this.hasArbitraryValues(className),
          hasImportantModifier: className.includes('!'),
        },
      });
    }

    // Extract base class (last part) and pseudo-classes (all but last)
    const baseClass = parts[parts.length - 1];
    const pseudoClassParts = parts.slice(0, -1);

    // Find the primary pseudo-class (first recognized one)
    let primaryPseudoClass = '';
    let primaryState: PseudoClassState | null = null;

    for (const part of pseudoClassParts) {
      const state = this.pseudoStates.get(part);
      if (state) {
        primaryPseudoClass = part;
        primaryState = state;
        break;
      }
    }

    // Validate pseudo-class
    const isValid = this.validatePseudoClass(pseudoClassParts);

    return ParsedPseudoClassSchema.parse({
      original: className,
      pseudoClass: primaryPseudoClass,
      baseClass: baseClass,
      variants: pseudoClassParts,
      isValid: isValid,
      priority: primaryState?.priority || 0,
      metadata: {
        isInteractive: primaryState?.isInteractive || false,
        isStateful: primaryState?.isStateful || false,
        canCombine: primaryState?.canCombine || false,
        cssSelector: primaryState?.cssSelector || '',
        nestingLevel: pseudoClassParts.length,
        hasArbitraryValues: this.hasArbitraryValues(className),
        hasImportantModifier: className.includes('!'),
      },
    });
  }

  /**
   * Perform class analysis for multiple parsed classes
   */
  private performClassAnalysis(
    classNames: string[],
    parsedClasses: ParsedPseudoClass[]
  ): PseudoClassAnalysis {
    const pseudoClassCount = parsedClasses.filter((pc) => pc.pseudoClass).length;
    const uniquePseudoClasses = new Set(parsedClasses.map((pc) => pc.pseudoClass).filter(Boolean))
      .size;

    // Validate order
    const allPseudoClasses = parsedClasses.map((pc) => pc.pseudoClass).filter(Boolean);

    const orderValidation = this.validatePseudoClassOrder(allPseudoClasses);

    // Calculate metrics
    const metrics = {
      interactiveStates: parsedClasses.filter((pc) => pc.metadata.isInteractive).length,
      statefulClasses: parsedClasses.filter((pc) => pc.metadata.isStateful).length,
      combinableStates: parsedClasses.filter((pc) => pc.metadata.canCombine).length,
      nestingComplexity: Math.max(...parsedClasses.map((pc) => pc.metadata.nestingLevel), 0),
      specificityScore: this.calculateSpecificityScore(parsedClasses),
    };

    // Detect conflicts
    const conflicts = this.detectConflicts(parsedClasses);

    // Calculate optimization potential
    const optimizationPotential = this.calculateOptimizationPotential(parsedClasses, conflicts);

    // Generate recommendations
    const recommendations = this.generateRecommendations(parsedClasses, conflicts, metrics);

    return PseudoClassAnalysisSchema.parse({
      className: classNames.join(' '),
      parsedClasses: parsedClasses,
      totalPseudoClasses: pseudoClassCount,
      uniquePseudoClasses: uniquePseudoClasses,
      hasValidOrder: orderValidation.isValid,
      orderViolations: orderValidation.violations,
      optimizationPotential: optimizationPotential,
      recommendedOptimizations: recommendations,
      conflicts: conflicts,
      metrics: metrics,
    });
  }

  /**
   * Perform optimization on the analyzed classes
   */
  private performOptimization(
    classNames: string[],
    analysis: PseudoClassAnalysis
  ): PseudoClassOptimization {
    const startLength = classNames.join(' ').length;
    let optimizedClasses = [...classNames];
    const appliedOptimizations: any[] = [];

    // 1. Reorder pseudo-classes to correct order
    if (!analysis.hasValidOrder && this.config.enablePseudoClassGrouping) {
      optimizedClasses = this.reorderClasses(optimizedClasses, analysis);
      appliedOptimizations.push({
        type: 'reorder',
        description: 'Reordered pseudo-classes to follow LVHA+ priority',
        impact: {
          classesAffected: optimizedClasses.length,
          sizeReduction: 0, // Reordering doesn't reduce size
        },
      });
    }

    // 2. Remove duplicate classes
    const uniqueClasses = [...new Set(optimizedClasses)];
    if (uniqueClasses.length < optimizedClasses.length) {
      const duplicatesRemoved = optimizedClasses.length - uniqueClasses.length;
      optimizedClasses = uniqueClasses;
      appliedOptimizations.push({
        type: 'deduplicate',
        description: `Removed ${duplicatesRemoved} duplicate classes`,
        impact: {
          classesAffected: duplicatesRemoved,
          sizeReduction: duplicatesRemoved * 10, // Estimate
        },
      });
    }

    // 3. Combine compatible pseudo-classes where possible
    if (this.config.enableCombinedOptimization) {
      const combinedClasses = this.combineCompatibleClasses(optimizedClasses, analysis);
      if (combinedClasses.length < optimizedClasses.length) {
        const combined = optimizedClasses.length - combinedClasses.length;
        optimizedClasses = combinedClasses;
        appliedOptimizations.push({
          type: 'combine',
          description: `Combined ${combined} compatible pseudo-class patterns`,
          impact: {
            classesAffected: combined,
            sizeReduction: combined * 15, // Estimate
          },
        });
      }
    }

    // Calculate final metrics
    const endLength = optimizedClasses.join(' ').length;
    const reduction = {
      classCount: classNames.length - optimizedClasses.length,
      bytes: startLength - endLength,
      percentage: startLength > 0 ? ((startLength - endLength) / startLength) * 100 : 0,
    };

    return PseudoClassOptimizationSchema.parse({
      original: classNames,
      optimized: optimizedClasses,
      reduction: reduction,
      optimizations: appliedOptimizations,
      warnings: analysis.orderViolations,
      metadata: {
        processingTime: 0, // Will be set by caller
        cacheHits: 0,
        validationsPassed: analysis.hasValidOrder ? 1 : 0,
      },
    });
  }

  /**
   * Validate pseudo-class parts
   */
  private validatePseudoClass(pseudoClassParts: string[]): boolean {
    // Check nesting level
    if (pseudoClassParts.length > this.validationConfig.maxNestingLevel) {
      return false;
    }

    // Check for unknown pseudo-classes
    if (!this.validationConfig.allowUnknownPseudoClasses) {
      const unknownParts = pseudoClassParts.filter((part) => !this.pseudoStates.has(part));
      if (unknownParts.length > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if class name has arbitrary values
   */
  private hasArbitraryValues(className: string): boolean {
    return /\[.*\]/.test(className);
  }

  /**
   * Calculate specificity score for parsed classes
   */
  private calculateSpecificityScore(parsedClasses: ParsedPseudoClass[]): number {
    return parsedClasses.reduce((score, pc) => {
      let classScore = 1; // Base class
      classScore += pc.metadata.nestingLevel * 10; // Pseudo-classes
      if (pc.metadata.hasImportantModifier) classScore += 1000; // !important
      return score + classScore;
    }, 0);
  }

  /**
   * Detect conflicts between pseudo-classes
   */
  private detectConflicts(parsedClasses: ParsedPseudoClass[]): any[] {
    const conflicts: any[] = [];

    // Check for order violations
    const orderViolations = this.validatePseudoClassOrder(
      parsedClasses.map((pc) => pc.pseudoClass).filter(Boolean)
    );

    orderViolations.violations.forEach((violation) => {
      conflicts.push({
        type: 'order-violation',
        description: violation,
        severity: 'medium',
        affectedClasses: parsedClasses.map((pc) => pc.original),
      });
    });

    // Check for specificity conflicts
    const highSpecificity = parsedClasses.filter(
      (pc) => pc.metadata.nestingLevel > 2 || pc.metadata.hasImportantModifier
    );

    if (highSpecificity.length > 0) {
      conflicts.push({
        type: 'specificity-conflict',
        description: 'High specificity classes detected, may cause maintenance issues',
        severity: 'low',
        affectedClasses: highSpecificity.map((pc) => pc.original),
      });
    }

    return conflicts;
  }

  /**
   * Calculate optimization potential score
   */
  private calculateOptimizationPotential(
    parsedClasses: ParsedPseudoClass[],
    conflicts: any[]
  ): number {
    let potential = 0;

    // Add potential for order fixes
    if (conflicts.some((c) => c.type === 'order-violation')) {
      potential += 0.3;
    }

    // Add potential for deduplication
    const uniqueClasses = new Set(parsedClasses.map((pc) => pc.original));
    if (uniqueClasses.size < parsedClasses.length) {
      potential += 0.4;
    }

    // Add potential for combination
    const combinableClasses = parsedClasses.filter((pc) => pc.metadata.canCombine);
    if (combinableClasses.length > 1) {
      potential += 0.3;
    }

    return Math.min(potential, 1.0);
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    parsedClasses: ParsedPseudoClass[],
    conflicts: any[],
    metrics: any
  ): string[] {
    const recommendations: string[] = [];

    if (conflicts.length > 0) {
      recommendations.push('Fix pseudo-class order violations to ensure consistent behavior');
    }

    if (metrics.nestingComplexity > 3) {
      recommendations.push(
        'Consider reducing pseudo-class nesting complexity for better maintainability'
      );
    }

    if (metrics.specificityScore > 100) {
      recommendations.push(
        'High specificity detected, consider using lower-specificity alternatives'
      );
    }

    const duplicates = parsedClasses.length - new Set(parsedClasses.map((pc) => pc.original)).size;
    if (duplicates > 0) {
      recommendations.push(`Remove ${duplicates} duplicate classes to reduce bundle size`);
    }

    return recommendations;
  }

  /**
   * Reorder classes according to proper pseudo-class order
   */
  private reorderClasses(classes: string[], analysis: PseudoClassAnalysis): string[] {
    // Implementation would reorder based on priority
    return classes.sort((a, b) => {
      const parsedA = analysis.parsedClasses.find((pc) => pc.original === a);
      const parsedB = analysis.parsedClasses.find((pc) => pc.original === b);

      if (!parsedA || !parsedB) return 0;

      return parsedA.priority - parsedB.priority;
    });
  }

  /**
   * Combine compatible pseudo-classes where possible
   */
  private combineCompatibleClasses(classes: string[], _analysis: PseudoClassAnalysis): string[] {
    // For now, return as-is. Full implementation would combine compatible patterns
    return classes;
  }
}

/**
 * Factory function to create a PseudoClassHandler with default configuration
 */
export function createPseudoClassHandler(
  config?: Partial<ResponsiveOptimizationConfig>,
  validationConfig?: Partial<PseudoClassValidationConfig>
): PseudoClassHandler {
  const defaultConfig = {
    breakpoints: [],
    pseudoStates: DEFAULT_PSEUDO_STATES,
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
    ...config,
  };

  return new PseudoClassHandler(defaultConfig, validationConfig);
}

/**
 * Utility function to quickly validate pseudo-class order
 */
export function validatePseudoClassOrder(
  pseudoClasses: string[],
  states: PseudoClassState[] = DEFAULT_PSEUDO_STATES
): { isValid: boolean; violations: string[]; corrections: string[] } {
  const handler = createPseudoClassHandler({ pseudoStates: states });
  return handler.validatePseudoClassOrder(pseudoClasses);
}

/**
 * Utility function to quickly parse a single pseudo-class
 */
export function parsePseudoClass(
  className: string,
  config?: Partial<ResponsiveOptimizationConfig>
): ParsedPseudoClass {
  const handler = createPseudoClassHandler(config);
  return handler.parsePseudoClass(className);
}
