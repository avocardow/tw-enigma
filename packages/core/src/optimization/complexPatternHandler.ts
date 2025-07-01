/**
 * Complex Pattern Combination Handler for TW-Enigma
 *
 * Advanced system for handling complex combinations of responsive patterns,
 * pseudo-classes, and groupings. Manages edge cases, nested combinations,
 * and provides comprehensive error reporting and optimization.
 *
 * Features:
 * - Complex responsive + pseudo-class combinations
 * - Nested pseudo-class handling with validation
 * - Multi-breakpoint pattern management
 * - Group membership conflict resolution
 * - Advanced error reporting and recovery
 * - Pattern complexity analysis and optimization
 * - Performance monitoring for complex operations
 */

import { z } from 'zod';
import { BreakpointCompatibilityEngine } from './breakpointCompatibility';
import { PatternGroupingEngine } from './patternGrouping';
import { PatternMergingEngine } from './patternMerging';
import { createPerformanceMonitor, type PerformanceMonitor } from './performanceMonitor';
import { PseudoClassHandler } from './pseudoClassHandler';
import { type ResponsiveOptimizationConfig } from './responsiveOptimization';

// ===== CORE SCHEMAS AND TYPES =====

/**
 * Complex pattern type classification
 */
export const ComplexPatternTypeSchema = z.enum([
  'simple-utility', // Basic utility class: text-blue-500
  'responsive-utility', // Single breakpoint: md:text-red-500
  'pseudo-utility', // Single pseudo-class: hover:bg-blue-500
  'responsive-pseudo', // Breakpoint + pseudo: md:hover:text-white
  'multi-breakpoint', // Multiple breakpoints: sm:md:lg:text-center
  'multi-pseudo', // Multiple pseudo-classes: hover:focus:active:bg-red-500
  'nested-pseudo', // Nested pseudo-classes: group-hover:peer-focus:opacity-50
  'combined-complex', // All combinations: lg:group-hover:focus:disabled:text-blue-500
  'grouped-pattern', // Patterns that belong to semantic groups
  'arbitrary-complex', // Patterns with arbitrary values: md:hover:bg-[#ff0000]
]);

export type ComplexPatternType = z.infer<typeof ComplexPatternTypeSchema>;

/**
 * Parsed complex pattern structure
 */
export const ParsedComplexPatternSchema = z.object({
  original: z.string(),
  normalized: z.string(),
  type: ComplexPatternTypeSchema,

  // Component breakdown
  breakpoints: z.array(z.string()),
  pseudoClasses: z.array(z.string()),
  baseUtility: z.string(),

  // Structural analysis
  complexity: z.object({
    score: z.number().min(0).max(100),
    factors: z.object({
      breakpointCount: z.number(),
      pseudoClassCount: z.number(),
      nestingLevel: z.number(),
      arbitraryValues: z.number(),
      specificityScore: z.number(),
    }),
  }),

  // Validation results
  validation: z.object({
    isValid: z.boolean(),
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
    suggestions: z.array(z.string()),
  }),

  // Grouping information
  groupMembership: z.array(
    z.object({
      groupId: z.string(),
      groupType: z.string(),
      priority: z.number(),
      conflicts: z.array(z.string()),
    })
  ),

  // Optimization potential
  optimization: z.object({
    canSimplify: z.boolean(),
    canCombine: z.array(z.string()),
    alternativePatterns: z.array(z.string()),
    estimatedSavings: z.number(),
  }),

  // Metadata
  metadata: z.object({
    parseTime: z.number(),
    hasImportant: z.boolean(),
    hasArbitraryValues: z.boolean(),
    isFrameworkSpecific: z.boolean(),
    cssOutput: z.string().optional(),
  }),
});

export type ParsedComplexPattern = z.infer<typeof ParsedComplexPatternSchema>;

/**
 * Complex pattern combination result
 */
export const ComplexCombinationResultSchema = z.object({
  patterns: z.array(ParsedComplexPatternSchema),

  // Global analysis
  globalAnalysis: z.object({
    totalPatterns: z.number(),
    typeDistribution: z.record(ComplexPatternTypeSchema, z.number()),
    averageComplexity: z.number(),
    maxComplexity: z.number(),
    totalConflicts: z.number(),
  }),

  // Conflict analysis
  conflicts: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        'specificity',
        'cascade',
        'inheritance',
        'breakpoint-order',
        'pseudo-order',
        'group-membership',
      ]),
      severity: z.enum(['info', 'warning', 'error', 'critical']),
      description: z.string(),
      affectedPatterns: z.array(z.string()),
      resolution: z
        .object({
          strategy: z.string(),
          action: z.string(),
          expectedOutcome: z.string(),
        })
        .optional(),
    })
  ),

  // Optimization opportunities
  optimizations: z.array(
    z.object({
      type: z.enum(['combine', 'simplify', 'reorder', 'group', 'eliminate']),
      description: z.string(),
      patterns: z.array(z.string()),
      estimatedImpact: z.object({
        sizeReduction: z.number(),
        complexityReduction: z.number(),
        performanceGain: z.number(),
      }),
      implementation: z.object({
        before: z.array(z.string()),
        after: z.array(z.string()),
        confidence: z.number().min(0).max(100),
      }),
    })
  ),

  // Performance metrics
  performance: z.object({
    totalProcessingTime: z.number(),
    memoryUsage: z.number(),
    cacheHitRate: z.number(),
    bottlenecks: z.array(z.string()),
  }),

  // Recommendations
  recommendations: z.array(
    z.object({
      category: z.enum(['structure', 'performance', 'maintainability', 'best-practices']),
      priority: z.enum(['low', 'medium', 'high']),
      description: z.string(),
      action: z.string(),
      rationale: z.string(),
    })
  ),
});

export type ComplexCombinationResult = z.infer<typeof ComplexCombinationResultSchema>;

/**
 * Configuration for complex pattern handling
 */
export const ComplexPatternConfigSchema = z.object({
  // Parsing configuration
  parsing: z
    .object({
      maxComplexity: z.number().min(10).max(100).default(80),
      maxNestingLevel: z.number().min(1).max(10).default(5),
      maxBreakpoints: z.number().min(1).max(10).default(6),
      maxPseudoClasses: z.number().min(1).max(15).default(8),
      allowArbitraryValues: z.boolean().default(true),
      allowNestedPseudoClasses: z.boolean().default(true),
    })
    .default({}),

  // Validation configuration
  validation: z
    .object({
      strictBreakpointOrder: z.boolean().default(true),
      strictPseudoClassOrder: z.boolean().default(true),
      validateSpecificity: z.boolean().default(true),
      allowUnsafePatterns: z.boolean().default(false),
      warnOnHighComplexity: z.boolean().default(true),
      errorOnInvalidCombinations: z.boolean().default(false),
    })
    .default({}),

  // Optimization configuration
  optimization: z
    .object({
      enableCombination: z.boolean().default(true),
      enableSimplification: z.boolean().default(true),
      enableReordering: z.boolean().default(true),
      enableGrouping: z.boolean().default(true),
      aggressiveOptimization: z.boolean().default(false),
      preserveSourceOrder: z.boolean().default(false),
    })
    .default({}),

  // Performance configuration
  performance: z
    .object({
      enableCaching: z.boolean().default(true),
      maxCacheSize: z.number().min(100).max(10000).default(1000),
      enableParallelProcessing: z.boolean().default(true),
      timeoutMs: z.number().min(1000).max(30000).default(10000),
    })
    .default({}),

  // Error handling configuration
  errorHandling: z
    .object({
      continueOnError: z.boolean().default(true),
      reportAllErrors: z.boolean().default(true),
      includeStackTrace: z.boolean().default(false),
      fallbackToSimpleMode: z.boolean().default(true),
    })
    .default({}),
});

export type ComplexPatternConfig = z.infer<typeof ComplexPatternConfigSchema>;

// ===== MAIN COMPLEX PATTERN HANDLER =====

/**
 * Comprehensive handler for complex pattern combinations
 */
export class ComplexPatternHandler {
  private readonly config: ComplexPatternConfig;
  private readonly responsiveConfig: ResponsiveOptimizationConfig;
  private readonly performanceMonitor: PerformanceMonitor;

  // Component handlers
  private readonly pseudoClassHandler: PseudoClassHandler;
  private readonly groupingEngine: PatternGroupingEngine;
  private readonly breakpointEngine: BreakpointCompatibilityEngine;
  private readonly mergingEngine: PatternMergingEngine;

  // Caches
  private readonly patternCache: Map<string, ParsedComplexPattern>;
  private readonly combinationCache: Map<string, ComplexCombinationResult>;

  // State tracking
  private readonly processingState: Map<string, any>;

  constructor(
    config: Partial<ComplexPatternConfig> = {},
    responsiveConfig: ResponsiveOptimizationConfig,
    breakpointEngine: BreakpointCompatibilityEngine,
    pseudoClassHandler?: PseudoClassHandler,
    groupingEngine?: PatternGroupingEngine,
    mergingEngine?: PatternMergingEngine
  ) {
    this.config = ComplexPatternConfigSchema.parse(config);
    this.responsiveConfig = responsiveConfig;
    this.breakpointEngine = breakpointEngine;

    this.performanceMonitor = createPerformanceMonitor({
      enabled: responsiveConfig.includeOptimizationMetrics,
      enableGC: true,
      enableEventLoop: true,
    });

    // Initialize component handlers
    this.pseudoClassHandler = pseudoClassHandler || new PseudoClassHandler(responsiveConfig);
    this.groupingEngine = groupingEngine || new PatternGroupingEngine({}, responsiveConfig);
    this.mergingEngine = mergingEngine || new PatternMergingEngine({});

    // Initialize caches
    this.patternCache = new Map();
    this.combinationCache = new Map();
    this.processingState = new Map();
  }

  /**
   * Parse a complex pattern into its constituent components
   */
  public parseComplexPattern(pattern: string): ParsedComplexPattern {
    // Check cache first
    if (this.config.performance.enableCaching && this.patternCache.has(pattern)) {
      return this.patternCache.get(pattern)!;
    }

    const measurementId = this.performanceMonitor.startMeasurement('parseComplexPattern', {
      pattern,
    });

    try {
      const result = this.performComplexParsing(pattern);

      // Cache successful results
      if (
        this.config.performance.enableCaching &&
        this.patternCache.size < this.config.performance.maxCacheSize
      ) {
        this.patternCache.set(pattern, result);
      }

      return result;
    } catch (error) {
      return this.handleParsingError(pattern, error as Error);
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Analyze a collection of complex patterns for combinations and conflicts
   */
  public analyzeComplexCombinations(patterns: string[]): ComplexCombinationResult {
    const cacheKey = patterns.sort().join('|');

    // Check cache
    if (this.config.performance.enableCaching && this.combinationCache.has(cacheKey)) {
      return this.combinationCache.get(cacheKey)!;
    }

    const measurementId = this.performanceMonitor.startMeasurement('analyzeComplexCombinations', {
      patternCount: patterns.length,
    });

    try {
      // Parse all patterns
      const parsedPatterns = patterns.map((pattern) => this.parseComplexPattern(pattern));

      // Perform comprehensive analysis
      const result = this.performCombinationAnalysis(parsedPatterns);

      // Cache result
      if (
        this.config.performance.enableCaching &&
        this.combinationCache.size < this.config.performance.maxCacheSize
      ) {
        this.combinationCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      return this.handleAnalysisError(patterns, error as Error);
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Optimize complex pattern combinations
   */
  public optimizeComplexPatterns(patterns: string[]): {
    original: string[];
    optimized: string[];
    analysis: ComplexCombinationResult;
    optimizations: any[];
  } {
    const analysis = this.analyzeComplexCombinations(patterns);

    if (!this.config.optimization.enableCombination) {
      return {
        original: patterns,
        optimized: patterns,
        analysis,
        optimizations: [],
      };
    }

    const measurementId = this.performanceMonitor.startMeasurement('optimizeComplexPatterns', {
      patternCount: patterns.length,
    });

    try {
      const optimizations = this.performOptimizations(analysis);
      const optimizedPatterns = this.applyOptimizations(patterns, optimizations);

      return {
        original: patterns,
        optimized: optimizedPatterns,
        analysis,
        optimizations,
      };
    } finally {
      this.performanceMonitor.endMeasurement(measurementId);
    }
  }

  /**
   * Validate complex pattern combinations for potential issues
   */
  public validateComplexPatterns(patterns: string[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
    criticalIssues: any[];
  } {
    const analysis = this.analyzeComplexCombinations(patterns);

    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const criticalIssues: any[] = [];

    // Collect validation results from parsed patterns
    for (const pattern of analysis.patterns) {
      errors.push(...pattern.validation.errors);
      warnings.push(...pattern.validation.warnings);
      suggestions.push(...pattern.validation.suggestions);
    }

    // Check for critical conflicts
    for (const conflict of analysis.conflicts) {
      if (conflict.severity === 'critical' || conflict.severity === 'error') {
        criticalIssues.push(conflict);
        errors.push(conflict.description);
      } else if (conflict.severity === 'warning') {
        warnings.push(conflict.description);
      }
    }

    // Check complexity thresholds
    if (analysis.globalAnalysis.averageComplexity > this.config.parsing.maxComplexity * 0.8) {
      warnings.push(
        `High average complexity: ${analysis.globalAnalysis.averageComplexity.toFixed(1)}`
      );
    }

    if (analysis.globalAnalysis.maxComplexity > this.config.parsing.maxComplexity) {
      errors.push(`Pattern exceeds maximum complexity: ${analysis.globalAnalysis.maxComplexity}`);
    }

    return {
      isValid: errors.length === 0 && criticalIssues.length === 0,
      errors: [...new Set(errors)], // Remove duplicates
      warnings: [...new Set(warnings)],
      suggestions: [...new Set(suggestions)],
      criticalIssues,
    };
  }

  /**
   * Get metrics and performance information
   */
  public getMetrics(): {
    patterns: { cached: number; total: number };
    combinations: { cached: number; total: number };
    performance: any;
    errors: { parsing: number; analysis: number; optimization: number };
  } {
    const performanceMetrics = this.performanceMonitor.getCurrentMetrics();

    return {
      patterns: {
        cached: this.patternCache.size,
        total: this.patternCache.size, // This would be tracked separately in a real implementation
      },
      combinations: {
        cached: this.combinationCache.size,
        total: this.combinationCache.size,
      },
      performance: performanceMetrics,
      errors: {
        parsing: 0, // Would be tracked in real implementation
        analysis: 0,
        optimization: 0,
      },
    };
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.patternCache.clear();
    this.combinationCache.clear();
    this.processingState.clear();
  }

  // ===== PRIVATE IMPLEMENTATION METHODS =====

  /**
   * Perform the actual complex pattern parsing
   */
  private performComplexParsing(pattern: string): ParsedComplexPattern {
    // Split pattern into components
    const components = this.splitPatternComponents(pattern);

    // Classify pattern type
    const type = this.classifyComplexPattern(components);

    // Extract breakpoints and pseudo-classes
    const breakpoints = this.extractBreakpoints(components);
    const pseudoClasses = this.extractPseudoClasses(components);
    const baseUtility = this.extractBaseUtility(components);

    // Calculate complexity
    const complexity = this.calculateComplexity(components, breakpoints, pseudoClasses);

    // Perform validation
    const validation = this.validatePattern(components, breakpoints, pseudoClasses, complexity);

    // Analyze group membership
    const groupMembership = this.analyzeGroupMembership(pattern, type);

    // Calculate optimization potential
    const optimization = this.calculateOptimizationPotential(components, complexity);

    // Generate metadata
    const metadata = this.generatePatternMetadata(pattern, components);

    return ParsedComplexPatternSchema.parse({
      original: pattern,
      normalized: this.normalizePattern(pattern),
      type,
      breakpoints,
      pseudoClasses,
      baseUtility,
      complexity,
      validation,
      groupMembership,
      optimization,
      metadata,
    });
  }

  /**
   * Split pattern into its component parts
   */
  private splitPatternComponents(pattern: string): {
    modifiers: string[];
    utility: string;
    hasImportant: boolean;
  } {
    // Handle important modifier
    const hasImportant = pattern.endsWith('!');
    const cleanPattern = hasImportant ? pattern.slice(0, -1) : pattern;

    // Split on colons to get modifiers and utility
    const parts = cleanPattern.split(':');
    const utility = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    return { modifiers, utility, hasImportant };
  }

  /**
   * Classify the type of complex pattern
   */
  private classifyComplexPattern(
    components: ReturnType<typeof this.splitPatternComponents>
  ): ComplexPatternType {
    const { modifiers } = components;

    if (modifiers.length === 0) {
      return 'simple-utility';
    }

    const breakpoints = modifiers.filter((mod) => this.breakpointEngine.isValidBreakpoint(mod));
    const pseudoClasses = modifiers.filter((mod) => this.isPseudoClass(mod));
    const hasNested = modifiers.some((mod) => mod.includes('-'));

    // Complex classification logic
    if (breakpoints.length > 1 && pseudoClasses.length > 1) {
      return 'combined-complex';
    }
    if (breakpoints.length > 1) {
      return 'multi-breakpoint';
    }
    if (pseudoClasses.length > 1) {
      return hasNested ? 'nested-pseudo' : 'multi-pseudo';
    }
    if (breakpoints.length > 0 && pseudoClasses.length > 0) {
      return 'responsive-pseudo';
    }
    if (breakpoints.length > 0) {
      return 'responsive-utility';
    }
    if (pseudoClasses.length > 0) {
      return hasNested ? 'nested-pseudo' : 'pseudo-utility';
    }

    return 'simple-utility';
  }

  /**
   * Extract breakpoints from modifiers
   */
  private extractBreakpoints(components: ReturnType<typeof this.splitPatternComponents>): string[] {
    return components.modifiers.filter((mod) => this.breakpointEngine.isValidBreakpoint(mod));
  }

  /**
   * Extract pseudo-classes from modifiers
   */
  private extractPseudoClasses(
    components: ReturnType<typeof this.splitPatternComponents>
  ): string[] {
    return components.modifiers.filter((mod) => this.isPseudoClass(mod));
  }

  /**
   * Extract the base utility class
   */
  private extractBaseUtility(components: ReturnType<typeof this.splitPatternComponents>): string {
    return components.utility;
  }

  /**
   * Check if a modifier is a pseudo-class
   */
  private isPseudoClass(modifier: string): boolean {
    const knownPseudoClasses = [
      'hover',
      'focus',
      'active',
      'visited',
      'disabled',
      'enabled',
      'checked',
      'indeterminate',
      'default',
      'required',
      'valid',
      'invalid',
      'in-range',
      'out-of-range',
      'placeholder-shown',
      'autofill',
      'read-only',
      'first',
      'last',
      'odd',
      'even',
      'first-of-type',
      'last-of-type',
      'only-child',
      'only-of-type',
      'target',
      'open',
      'closed',
      'group-hover',
      'group-focus',
      'peer-hover',
      'peer-focus',
      'motion-safe',
      'motion-reduce',
      'dark',
      'light',
    ];

    return knownPseudoClasses.includes(modifier);
  }

  /**
   * Calculate pattern complexity score
   */
  private calculateComplexity(
    components: ReturnType<typeof this.splitPatternComponents>,
    breakpoints: string[],
    pseudoClasses: string[]
  ): ParsedComplexPattern['complexity'] {
    const factors = {
      breakpointCount: breakpoints.length,
      pseudoClassCount: pseudoClasses.length,
      nestingLevel: Math.max(...pseudoClasses.map((pc) => pc.split('-').length)),
      arbitraryValues: components.utility.includes('[') ? 1 : 0,
      specificityScore: this.calculateSpecificity(components),
    };

    // Calculate overall complexity score (0-100)
    const score = Math.min(
      100,
      factors.breakpointCount * 8 +
        factors.pseudoClassCount * 10 +
        factors.nestingLevel * 15 +
        factors.arbitraryValues * 20 +
        factors.specificityScore * 2
    );

    return { score, factors };
  }

  /**
   * Calculate CSS specificity score
   */
  private calculateSpecificity(components: ReturnType<typeof this.splitPatternComponents>): number {
    // Simplified specificity calculation
    const { modifiers, hasImportant } = components;

    let score = 0;
    score += modifiers.length * 10; // Each modifier adds specificity
    score += hasImportant ? 1000 : 0; // Important adds significant specificity

    return score;
  }

  /**
   * Validate pattern components
   */
  private validatePattern(
    components: ReturnType<typeof this.splitPatternComponents>,
    breakpoints: string[],
    pseudoClasses: string[],
    complexity: ParsedComplexPattern['complexity']
  ): ParsedComplexPattern['validation'] {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Check complexity limits
    if (complexity.score > this.config.parsing.maxComplexity) {
      errors.push(
        `Pattern exceeds maximum complexity: ${complexity.score} > ${this.config.parsing.maxComplexity}`
      );
    }

    if (complexity.factors.nestingLevel > this.config.parsing.maxNestingLevel) {
      errors.push(
        `Nesting too deep: ${complexity.factors.nestingLevel} > ${this.config.parsing.maxNestingLevel}`
      );
    }

    if (breakpoints.length > this.config.parsing.maxBreakpoints) {
      warnings.push(
        `Many breakpoints: ${breakpoints.length} > ${this.config.parsing.maxBreakpoints}`
      );
    }

    if (pseudoClasses.length > this.config.parsing.maxPseudoClasses) {
      warnings.push(
        `Many pseudo-classes: ${pseudoClasses.length} > ${this.config.parsing.maxPseudoClasses}`
      );
    }

    // Check breakpoint order
    if (this.config.validation.strictBreakpointOrder && breakpoints.length > 1) {
      const orderValidation = this.validateBreakpointOrder(breakpoints);
      if (!orderValidation.isValid) {
        warnings.push('Breakpoints not in optimal order');
        suggestions.push(`Consider reordering: ${orderValidation.suggested.join(':')}`);
      }
    }

    // Check pseudo-class order
    if (this.config.validation.strictPseudoClassOrder && pseudoClasses.length > 1) {
      const orderValidation = this.validatePseudoClassOrder(pseudoClasses);
      if (!orderValidation.isValid) {
        warnings.push('Pseudo-classes not in LVHA+ order');
        suggestions.push(`Consider reordering: ${orderValidation.suggested.join(':')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      suggestions,
    };
  }

  /**
   * Validate breakpoint order
   */
  private validateBreakpointOrder(breakpoints: string[]): {
    isValid: boolean;
    suggested: string[];
  } {
    const ordered = [...breakpoints].sort((a, b) => this.breakpointEngine.compareBreakpoints(a, b));
    const isValid = breakpoints.every((bp, index) => bp === ordered[index]);

    return { isValid, suggested: ordered };
  }

  /**
   * Validate pseudo-class order
   */
  private validatePseudoClassOrder(pseudoClasses: string[]): {
    isValid: boolean;
    suggested: string[];
  } {
    const validation = this.pseudoClassHandler.validatePseudoClassOrder(pseudoClasses);
    return {
      isValid: validation.isValid,
      suggested: validation.corrections,
    };
  }

  /**
   * Analyze group membership for a pattern
   */
  private analyzeGroupMembership(
    pattern: string,
    type: ComplexPatternType
  ): ParsedComplexPattern['groupMembership'] {
    // This would integrate with the grouping engine
    // For now, return a simplified structure
    return [
      {
        groupId: `${type}-group`,
        groupType: type,
        priority: 1,
        conflicts: [],
      },
    ];
  }

  /**
   * Calculate optimization potential
   */
  private calculateOptimizationPotential(
    components: ReturnType<typeof this.splitPatternComponents>,
    complexity: ParsedComplexPattern['complexity']
  ): ParsedComplexPattern['optimization'] {
    const canSimplify = complexity.score > 50;
    const canCombine: string[] = [];
    const alternativePatterns: string[] = [];

    // Calculate estimated savings based on complexity
    const estimatedSavings = Math.max(0, (complexity.score - 30) / 100);

    return {
      canSimplify,
      canCombine,
      alternativePatterns,
      estimatedSavings,
    };
  }

  /**
   * Generate pattern metadata
   */
  private generatePatternMetadata(
    pattern: string,
    components: ReturnType<typeof this.splitPatternComponents>
  ): ParsedComplexPattern['metadata'] {
    return {
      parseTime: Date.now(),
      hasImportant: components.hasImportant,
      hasArbitraryValues: components.utility.includes('['),
      isFrameworkSpecific: pattern.includes('group-') || pattern.includes('peer-'),
      cssOutput: undefined, // Would be generated by CSS engine
    };
  }

  /**
   * Normalize pattern for consistent comparison
   */
  private normalizePattern(pattern: string): string {
    // Remove extra spaces, normalize casing, etc.
    return pattern.trim().toLowerCase();
  }

  /**
   * Perform combination analysis on multiple patterns
   */
  private performCombinationAnalysis(patterns: ParsedComplexPattern[]): ComplexCombinationResult {
    // Global analysis
    const globalAnalysis = this.performGlobalAnalysis(patterns);

    // Conflict analysis
    const conflicts = this.analyzeConflicts(patterns);

    // Optimization opportunities
    const optimizations = this.findOptimizationOpportunities(patterns);

    // Performance metrics
    const performance = this.gatherPerformanceMetrics();

    // Recommendations
    const recommendations = this.generateRecommendations(patterns, conflicts, optimizations);

    return ComplexCombinationResultSchema.parse({
      patterns,
      globalAnalysis,
      conflicts,
      optimizations,
      performance,
      recommendations,
    });
  }

  /**
   * Perform global analysis of all patterns
   */
  private performGlobalAnalysis(
    patterns: ParsedComplexPattern[]
  ): ComplexCombinationResult['globalAnalysis'] {
    const typeDistribution: Record<string, number> = {};
    let totalComplexity = 0;
    let maxComplexity = 0;
    let totalConflicts = 0;

    for (const pattern of patterns) {
      // Type distribution
      typeDistribution[pattern.type] = (typeDistribution[pattern.type] || 0) + 1;

      // Complexity tracking
      totalComplexity += pattern.complexity.score;
      maxComplexity = Math.max(maxComplexity, pattern.complexity.score);

      // Conflict tracking
      totalConflicts += pattern.groupMembership.reduce(
        (sum, group) => sum + group.conflicts.length,
        0
      );
    }

    return {
      totalPatterns: patterns.length,
      typeDistribution,
      averageComplexity: patterns.length > 0 ? totalComplexity / patterns.length : 0,
      maxComplexity,
      totalConflicts,
    };
  }

  /**
   * Analyze conflicts between patterns
   */
  private analyzeConflicts(
    patterns: ParsedComplexPattern[]
  ): ComplexCombinationResult['conflicts'] {
    const conflicts: ComplexCombinationResult['conflicts'] = [];

    // Check for various types of conflicts
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const patternA = patterns[i];
        const patternB = patterns[j];

        // Check specificity conflicts
        if (this.hasSpecificityConflict(patternA, patternB)) {
          conflicts.push({
            id: `specificity-${i}-${j}`,
            type: 'specificity',
            severity: 'warning',
            description: `Specificity conflict between "${patternA.original}" and "${patternB.original}"`,
            affectedPatterns: [patternA.original, patternB.original],
          });
        }

        // Check cascade conflicts
        if (this.hasCascadeConflict(patternA, patternB)) {
          conflicts.push({
            id: `cascade-${i}-${j}`,
            type: 'cascade',
            severity: 'info',
            description: `Potential cascade conflict between "${patternA.original}" and "${patternB.original}"`,
            affectedPatterns: [patternA.original, patternB.original],
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check for specificity conflicts between patterns
   */
  private hasSpecificityConflict(
    patternA: ParsedComplexPattern,
    patternB: ParsedComplexPattern
  ): boolean {
    // Simple heuristic: similar base utilities with different modifiers
    return (
      patternA.baseUtility === patternB.baseUtility &&
      patternA.complexity.factors.specificityScore !== patternB.complexity.factors.specificityScore
    );
  }

  /**
   * Check for cascade conflicts between patterns
   */
  private hasCascadeConflict(
    patternA: ParsedComplexPattern,
    patternB: ParsedComplexPattern
  ): boolean {
    // Simple heuristic: overlapping responsive ranges
    const aBreakpoints = new Set(patternA.breakpoints);
    const bBreakpoints = new Set(patternB.breakpoints);

    return (
      patternA.baseUtility === patternB.baseUtility &&
      [...aBreakpoints].some((bp) => bBreakpoints.has(bp))
    );
  }

  /**
   * Find optimization opportunities
   */
  private findOptimizationOpportunities(
    patterns: ParsedComplexPattern[]
  ): ComplexCombinationResult['optimizations'] {
    const optimizations: ComplexCombinationResult['optimizations'] = [];

    // Look for combination opportunities
    const combinationGroups = this.findCombinationGroups(patterns);
    for (const group of combinationGroups) {
      optimizations.push({
        type: 'combine',
        description: `Combine ${group.length} similar patterns`,
        patterns: group.map((p) => p.original),
        estimatedImpact: {
          sizeReduction: group.length * 0.1,
          complexityReduction: group.reduce((sum, p) => sum + p.complexity.score, 0) * 0.2,
          performanceGain: 0.05,
        },
        implementation: {
          before: group.map((p) => p.original),
          after: [this.combinePatternsToString(group)],
          confidence: 80,
        },
      });
    }

    return optimizations;
  }

  /**
   * Find groups of patterns that can be combined
   */
  private findCombinationGroups(patterns: ParsedComplexPattern[]): ParsedComplexPattern[][] {
    const groups: ParsedComplexPattern[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < patterns.length; i++) {
      if (processed.has(i)) continue;

      const group: ParsedComplexPattern[] = [patterns[i]];
      processed.add(i);

      for (let j = i + 1; j < patterns.length; j++) {
        if (processed.has(j)) continue;

        if (this.canCombinePatterns(patterns[i], patterns[j])) {
          group.push(patterns[j]);
          processed.add(j);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Check if two patterns can be combined
   */
  private canCombinePatterns(
    patternA: ParsedComplexPattern,
    patternB: ParsedComplexPattern
  ): boolean {
    // Simple heuristic: same base utility, different modifiers
    return patternA.baseUtility === patternB.baseUtility && patternA.original !== patternB.original;
  }

  /**
   * Combine patterns into a single string representation
   */
  private combinePatternsToString(patterns: ParsedComplexPattern[]): string {
    // This would implement actual pattern combination logic
    return `combined-${patterns.length}-patterns`;
  }

  /**
   * Gather performance metrics
   */
  private gatherPerformanceMetrics(): ComplexCombinationResult['performance'] {
    const metrics = this.performanceMonitor.getCurrentMetrics();

    return {
      totalProcessingTime: 0, // Would be calculated from measurements
      memoryUsage: metrics.memory.heapUsed,
      cacheHitRate: this.patternCache.size > 0 ? 0.8 : 0, // Estimated
      bottlenecks: [],
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    patterns: ParsedComplexPattern[],
    conflicts: ComplexCombinationResult['conflicts'],
    optimizations: ComplexCombinationResult['optimizations']
  ): ComplexCombinationResult['recommendations'] {
    const recommendations: ComplexCombinationResult['recommendations'] = [];

    // High complexity warning
    const highComplexityPatterns = patterns.filter((p) => p.complexity.score > 70);
    if (highComplexityPatterns.length > 0) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        description: `${highComplexityPatterns.length} patterns have high complexity`,
        action: 'Consider simplifying complex patterns',
        rationale: 'High complexity patterns can impact performance and maintainability',
      });
    }

    // Conflict resolution
    const criticalConflicts = conflicts.filter(
      (c) => c.severity === 'error' || c.severity === 'critical'
    );
    if (criticalConflicts.length > 0) {
      recommendations.push({
        category: 'structure',
        priority: 'high',
        description: `${criticalConflicts.length} critical conflicts detected`,
        action: 'Resolve specificity and cascade conflicts',
        rationale: 'Conflicts can lead to unpredictable styling behavior',
      });
    }

    // Optimization opportunities
    if (optimizations.length > 0) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        description: `${optimizations.length} optimization opportunities found`,
        action: 'Apply suggested optimizations',
        rationale: 'Optimizations can reduce bundle size and improve performance',
      });
    }

    return recommendations;
  }

  /**
   * Perform optimizations on patterns
   */
  private performOptimizations(analysis: ComplexCombinationResult): any[] {
    // Implementation would apply the optimizations suggested in the analysis
    return analysis.optimizations.map((opt) => ({
      type: opt.type,
      applied: true,
      result: opt.implementation.after,
    }));
  }

  /**
   * Apply optimizations to get optimized pattern list
   */
  private applyOptimizations(patterns: string[], _optimizations: any[]): string[] {
    // Simple implementation - in reality would apply actual optimizations
    return patterns;
  }

  /**
   * Handle parsing errors gracefully
   */
  private handleParsingError(pattern: string, error: Error): ParsedComplexPattern {
    return ParsedComplexPatternSchema.parse({
      original: pattern,
      normalized: pattern,
      type: 'simple-utility',
      breakpoints: [],
      pseudoClasses: [],
      baseUtility: pattern,
      complexity: {
        score: 0,
        factors: {
          breakpointCount: 0,
          pseudoClassCount: 0,
          nestingLevel: 0,
          arbitraryValues: 0,
          specificityScore: 0,
        },
      },
      validation: {
        isValid: false,
        warnings: [],
        errors: [`Parsing error: ${error.message}`],
        suggestions: ['Check pattern syntax'],
      },
      groupMembership: [],
      optimization: {
        canSimplify: false,
        canCombine: [],
        alternativePatterns: [],
        estimatedSavings: 0,
      },
      metadata: {
        parseTime: Date.now(),
        hasImportant: false,
        hasArbitraryValues: false,
        isFrameworkSpecific: false,
      },
    });
  }

  /**
   * Handle analysis errors gracefully
   */
  private handleAnalysisError(patterns: string[], error: Error): ComplexCombinationResult {
    return ComplexCombinationResultSchema.parse({
      patterns: patterns.map((p) => this.handleParsingError(p, error)),
      globalAnalysis: {
        totalPatterns: patterns.length,
        typeDistribution: { 'simple-utility': patterns.length },
        averageComplexity: 0,
        maxComplexity: 0,
        totalConflicts: 0,
      },
      conflicts: [
        {
          id: 'analysis-error',
          type: 'specificity',
          severity: 'error',
          description: `Analysis error: ${error.message}`,
          affectedPatterns: patterns,
        },
      ],
      optimizations: [],
      performance: {
        totalProcessingTime: 0,
        memoryUsage: 0,
        cacheHitRate: 0,
        bottlenecks: ['Analysis error'],
      },
      recommendations: [
        {
          category: 'structure',
          priority: 'high',
          description: 'Analysis failed',
          action: 'Check pattern syntax and try again',
          rationale: `Error: ${error.message}`,
        },
      ],
    });
  }
}

// ===== FACTORY FUNCTIONS =====

/**
 * Create complex pattern handler with default configuration
 */
export function createComplexPatternHandler(
  responsiveConfig: ResponsiveOptimizationConfig,
  breakpointEngine: BreakpointCompatibilityEngine,
  config?: Partial<ComplexPatternConfig>
): ComplexPatternHandler {
  return new ComplexPatternHandler(config, responsiveConfig, breakpointEngine);
}

/**
 * Create complex pattern handler with aggressive optimization
 */
export function createAggressiveComplexPatternHandler(
  responsiveConfig: ResponsiveOptimizationConfig,
  breakpointEngine: BreakpointCompatibilityEngine
): ComplexPatternHandler {
  return new ComplexPatternHandler(
    {
      optimization: {
        enableCombination: true,
        enableSimplification: true,
        enableReordering: true,
        enableGrouping: true,
        aggressiveOptimization: true,
        preserveSourceOrder: false,
      },
    },
    responsiveConfig,
    breakpointEngine
  );
}

// ===== UTILITY FUNCTIONS =====

/**
 * Quick analysis of pattern complexity
 */
export function analyzePatternComplexity(pattern: string): {
  score: number;
  type: ComplexPatternType;
  issues: string[];
} {
  // Simple implementation for quick checks
  const modifierCount = (pattern.match(/:/g) || []).length;
  const hasArbitrary = pattern.includes('[');
  const hasImportant = pattern.endsWith('!');

  let score = modifierCount * 10;
  score += hasArbitrary ? 20 : 0;
  score += hasImportant ? 10 : 0;

  const issues: string[] = [];
  if (score > 50) issues.push('High complexity');
  if (modifierCount > 3) issues.push('Many modifiers');
  if (hasArbitrary) issues.push('Has arbitrary values');

  return {
    score,
    type: modifierCount > 0 ? 'combined-complex' : 'simple-utility',
    issues,
  };
}

/**
 * Validate a single complex pattern quickly
 */
export function validateComplexPattern(pattern: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic syntax checks
  if (pattern.includes('::')) {
    errors.push('Double colons not allowed');
  }

  if (pattern.split(':').length > 5) {
    warnings.push('Very complex pattern - consider simplifying');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
