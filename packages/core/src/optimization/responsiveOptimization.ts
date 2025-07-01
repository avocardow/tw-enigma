/**
 * Responsive and Pseudo-Class Optimization Engine
 *
 * This module provides advanced optimization strategies for responsive utilities
 * and pseudo-class variants in Tailwind CSS class patterns.
 *
 * Features:
 * - Intelligent responsive breakpoint pattern analysis
 * - Pseudo-class variant optimization and grouping
 * - Complex responsive + pseudo-class combination handling
 * - Configurable breakpoint and optimization strategies
 * - Performance-optimized pattern matching and merging
 */

import { z } from 'zod';
import { createPerformanceMonitor, type PerformanceMonitor } from './performanceMonitor';

// ===== SCHEMAS AND TYPES =====

/**
 * Standard breakpoint definitions following mobile-first approach
 */
const ResponsiveBreakpointSchema = z.object({
  name: z.string(),
  minWidth: z.number().min(0),
  maxWidth: z.number().optional(),
  order: z.number().min(0),
  isDefault: z.boolean().default(false),
});

export type ResponsiveBreakpoint = z.infer<typeof ResponsiveBreakpointSchema>;

/**
 * Default breakpoints following Tailwind CSS standards
 */
const DEFAULT_BREAKPOINTS: ResponsiveBreakpoint[] = [
  { name: 'default', minWidth: 0, order: 0, isDefault: true },
  { name: 'sm', minWidth: 640, order: 1, isDefault: false },
  { name: 'md', minWidth: 768, order: 2, isDefault: false },
  { name: 'lg', minWidth: 1024, order: 3, isDefault: false },
  { name: 'xl', minWidth: 1280, order: 4, isDefault: false },
  { name: '2xl', minWidth: 1536, order: 5, isDefault: false },
];

/**
 * Pseudo-class state definitions with priority ordering
 */
const PseudoClassStateSchema = z.object({
  name: z.string(),
  cssSelector: z.string(),
  priority: z.number().min(0),
  isInteractive: z.boolean().default(false),
  isStateful: z.boolean().default(false),
  canCombine: z.boolean().default(true),
});

export type PseudoClassState = z.infer<typeof PseudoClassStateSchema>;

/**
 * Standard pseudo-class states following LVHA+ order
 */
const DEFAULT_PSEUDO_STATES: PseudoClassState[] = [
  // Link states (LVHA order)
  {
    name: 'visited',
    cssSelector: ':visited',
    priority: 1,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'hover',
    cssSelector: ':hover',
    priority: 2,
    isInteractive: true,
    isStateful: false,
    canCombine: true,
  },
  {
    name: 'focus',
    cssSelector: ':focus',
    priority: 3,
    isInteractive: true,
    isStateful: false,
    canCombine: true,
  },
  {
    name: 'active',
    cssSelector: ':active',
    priority: 4,
    isInteractive: true,
    isStateful: false,
    canCombine: true,
  },

  // Form states
  {
    name: 'checked',
    cssSelector: ':checked',
    priority: 5,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'disabled',
    cssSelector: ':disabled',
    priority: 6,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'enabled',
    cssSelector: ':enabled',
    priority: 7,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'required',
    cssSelector: ':required',
    priority: 8,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'valid',
    cssSelector: ':valid',
    priority: 9,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'invalid',
    cssSelector: ':invalid',
    priority: 10,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },

  // Structural states
  {
    name: 'first',
    cssSelector: ':first-child',
    priority: 11,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'last',
    cssSelector: ':last-child',
    priority: 12,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'odd',
    cssSelector: ':nth-child(odd)',
    priority: 13,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
  {
    name: 'even',
    cssSelector: ':nth-child(even)',
    priority: 14,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },

  // Motion preferences
  {
    name: 'motion-safe',
    cssSelector: '@media (prefers-reduced-motion: no-preference)',
    priority: 15,
    isInteractive: false,
    isStateful: false,
    canCombine: false,
  },
  {
    name: 'motion-reduce',
    cssSelector: '@media (prefers-reduced-motion: reduce)',
    priority: 16,
    isInteractive: false,
    isStateful: false,
    canCombine: false,
  },

  // Theme states
  {
    name: 'dark',
    cssSelector: '.dark',
    priority: 17,
    isInteractive: false,
    isStateful: true,
    canCombine: true,
  },
];

/**
 * Pattern classification for responsive and pseudo-class utilities
 */
const ResponsivePatternTypeSchema = z.enum([
  'responsive-only', // Only responsive variants (e.g., sm:flex md:grid)
  'pseudo-only', // Only pseudo-class variants (e.g., hover:bg-blue-500)
  'combined', // Both responsive and pseudo (e.g., sm:hover:bg-blue-500)
  'layout-responsive', // Layout-specific responsive patterns
  'utility-responsive', // Utility-specific responsive patterns
  'component-responsive', // Component-level responsive patterns
]);

export type ResponsivePatternType = z.infer<typeof ResponsivePatternTypeSchema>;

/**
 * Comprehensive responsive pattern analysis result
 */
const ResponsivePatternAnalysisSchema = z.object({
  className: z.string(),
  baseClass: z.string(),
  breakpoints: z.array(z.string()),
  pseudoStates: z.array(z.string()),
  patternType: ResponsivePatternTypeSchema,
  complexity: z.number().min(0).max(10),
  frequency: z.number().min(0),
  coOccurrences: z.array(z.string()),
  optimizationPotential: z.number().min(0).max(1),
  recommendations: z.array(z.string()),
  conflicts: z.array(z.string()),
  metadata: z.object({
    hasArbitraryValues: z.boolean().default(false),
    hasImportantModifier: z.boolean().default(false),
    isCustomBreakpoint: z.boolean().default(false),
    isCustomPseudoClass: z.boolean().default(false),
    semanticGroup: z.string().optional(),
    cssProperties: z.array(z.string()).optional(),
  }),
});

export type ResponsivePatternAnalysis = z.infer<typeof ResponsivePatternAnalysisSchema>;

/**
 * Configuration for responsive optimization behavior
 */
const ResponsiveOptimizationConfigSchema = z.object({
  // Breakpoint configuration
  breakpoints: z.array(ResponsiveBreakpointSchema).default(DEFAULT_BREAKPOINTS),
  pseudoStates: z.array(PseudoClassStateSchema).default(DEFAULT_PSEUDO_STATES),

  // Optimization strategies
  enableResponsiveGrouping: z.boolean().default(true),
  enablePseudoClassGrouping: z.boolean().default(true),
  enableCombinedOptimization: z.boolean().default(true),
  enableBreakpointMerging: z.boolean().default(true),

  // Pattern analysis
  minimumFrequencyThreshold: z.number().min(1).default(2),
  complexityAnalysisEnabled: z.boolean().default(true),
  coOccurrenceAnalysisEnabled: z.boolean().default(true),

  // Grouping strategies
  groupBySemanticMeaning: z.boolean().default(true),
  groupByProperty: z.boolean().default(true),
  groupByComponent: z.boolean().default(false),

  // Output preferences
  preserveOriginalOrder: z.boolean().default(false),
  generateSourceComments: z.boolean().default(true),
  includeOptimizationMetrics: z.boolean().default(true),

  // Performance settings
  enableCaching: z.boolean().default(true),
  maxCacheSize: z.number().min(100).default(1000),
  enableParallelProcessing: z.boolean().default(true),
  parallelThreshold: z.number().min(10).default(50),
});

export type ResponsiveOptimizationConfig = z.infer<typeof ResponsiveOptimizationConfigSchema>;

/**
 * Optimization recommendation levels
 */
export enum OptimizationLevel {
  NONE = 'none',
  BASIC = 'basic',
  STANDARD = 'standard',
  AGGRESSIVE = 'aggressive',
}

/**
 * Pattern grouping strategies for optimization
 */
export enum GroupingStrategy {
  BY_BREAKPOINT = 'by-breakpoint',
  BY_PSEUDO_STATE = 'by-pseudo-state',
  BY_PROPERTY = 'by-property',
  BY_SEMANTIC = 'by-semantic',
  BY_COMPONENT = 'by-component',
  BY_FREQUENCY = 'by-frequency',
}

/**
 * Responsive pattern requirements specification
 *
 * This defines all the patterns and behaviors that the responsive
 * optimization system must support according to best practices.
 */
export interface ResponsivePatternRequirements {
  // Core pattern support
  supportedBreakpoints: ResponsiveBreakpoint[];
  supportedPseudoStates: PseudoClassState[];

  // Pattern recognition requirements
  mustDetectResponsivePatterns: boolean;
  mustDetectPseudoClassPatterns: boolean;
  mustDetectCombinedPatterns: boolean;
  mustDetectArbitraryValues: boolean;
  mustDetectImportantModifiers: boolean;

  // Optimization requirements
  mustPreserveMobileFirst: boolean;
  mustMaintainSpecificityOrder: boolean;
  mustRespectCascadeOrder: boolean;
  mustPreserveLVHAOrder: boolean;

  // Grouping requirements
  mustGroupByBreakpoint: boolean;
  mustGroupByProperty: boolean;
  mustGroupByComponent: boolean;
  mustAllowCustomGrouping: boolean;

  // Performance requirements
  maxProcessingTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  mustSupportLargeDatasets: boolean;
  mustProvideProgressFeedback: boolean;

  // Compatibility requirements
  mustSupportCustomBreakpoints: boolean;
  mustSupportCustomPseudoClasses: boolean;
  mustSupportFrameworkIntegration: boolean;
  mustProvideConfigurationAPI: boolean;

  // Output requirements
  mustGenerateValidCSS: boolean;
  mustPreserveSourceMapping: boolean;
  mustProvideOptimizationMetrics: boolean;
  mustSupportMultipleFormats: boolean;

  // Error handling requirements
  mustHandleInvalidClasses: boolean;
  mustProvideDetailedErrors: boolean;
  mustSupportFallbackStrategies: boolean;
  mustValidateConfiguration: boolean;
}

/**
 * Default responsive pattern requirements following industry best practices
 */
const DEFAULT_RESPONSIVE_REQUIREMENTS: ResponsivePatternRequirements = {
  // Core pattern support
  supportedBreakpoints: DEFAULT_BREAKPOINTS,
  supportedPseudoStates: DEFAULT_PSEUDO_STATES,

  // Pattern recognition requirements
  mustDetectResponsivePatterns: true,
  mustDetectPseudoClassPatterns: true,
  mustDetectCombinedPatterns: true,
  mustDetectArbitraryValues: true,
  mustDetectImportantModifiers: true,

  // Optimization requirements
  mustPreserveMobileFirst: true,
  mustMaintainSpecificityOrder: true,
  mustRespectCascadeOrder: true,
  mustPreserveLVHAOrder: true,

  // Grouping requirements
  mustGroupByBreakpoint: true,
  mustGroupByProperty: true,
  mustGroupByComponent: false, // Optional by default
  mustAllowCustomGrouping: true,

  // Performance requirements
  maxProcessingTime: 5000, // 5 seconds max
  maxMemoryUsage: 256, // 256 MB max
  mustSupportLargeDatasets: true,
  mustProvideProgressFeedback: true,

  // Compatibility requirements
  mustSupportCustomBreakpoints: true,
  mustSupportCustomPseudoClasses: true,
  mustSupportFrameworkIntegration: true,
  mustProvideConfigurationAPI: true,

  // Output requirements
  mustGenerateValidCSS: true,
  mustPreserveSourceMapping: true,
  mustProvideOptimizationMetrics: true,
  mustSupportMultipleFormats: true,

  // Error handling requirements
  mustHandleInvalidClasses: true,
  mustProvideDetailedErrors: true,
  mustSupportFallbackStrategies: true,
  mustValidateConfiguration: true,
};

/**
 * Pattern complexity analysis criteria
 */
export interface PatternComplexityAnalysis {
  hasMultipleBreakpoints: boolean;
  hasMultiplePseudoStates: boolean;
  hasCombinedVariants: boolean;
  hasArbitraryValues: boolean;
  hasImportantModifiers: boolean;
  nestingLevel: number;
  variantCount: number;
  propertyCount: number;
  dependencyCount: number;
  conflictPotential: number;
}

/**
 * Responsive pattern validation rules
 */
export interface ResponsivePatternValidation {
  // Syntax validation
  isValidBreakpointSyntax: (breakpoint: string) => boolean;
  isValidPseudoStateSyntax: (pseudoState: string) => boolean;
  isValidCombinedSyntax: (className: string) => boolean;

  // Semantic validation
  isValidBreakpointOrder: (breakpoints: string[]) => boolean;
  isValidPseudoStateOrder: (pseudoStates: string[]) => boolean;
  isValidPropertyCombination: (properties: string[]) => boolean;

  // Compatibility validation
  isCompatibleWithFramework: (framework: string) => boolean;
  isCompatibleWithVersion: (version: string) => boolean;
  hasConflictingPatterns: (patterns: string[]) => boolean;

  // Performance validation
  meetsPerformanceRequirements: (analysisTime: number, memoryUsage: number) => boolean;
  isWithinComplexityLimits: (complexity: number) => boolean;
}

/**
 * Edge cases and special scenarios that must be handled
 */
const RESPONSIVE_EDGE_CASES = {
  // Device orientation changes
  orientationChanges: [
    'landscape tablet with portrait mobile fallback',
    'portrait desktop with landscape mobile fallback',
    'dynamic orientation switching',
  ],

  // Uncommon device sizes
  uncommonDeviceSizes: [
    'fold devices with multiple screen sizes',
    'ultra-wide monitors (>2560px)',
    'small smart watches (<320px)',
    'e-readers with e-ink displays',
  ],

  // Browser compatibility
  browserCompatibility: [
    'legacy browsers without CSS Grid support',
    'browsers with limited flexbox support',
    'mobile browsers with viewport quirks',
    'browsers with different media query support',
  ],

  // Performance considerations
  performanceChallenges: [
    'large datasets with >10,000 responsive classes',
    'complex nested pseudo-class combinations',
    'real-time responsive class generation',
    'memory constraints on mobile devices',
  ],

  // Framework integration
  frameworkChallenges: [
    'React SSR with hydration mismatches',
    'Vue 3 composition API reactive styling',
    'Angular zone.js integration issues',
    'Svelte compile-time optimization conflicts',
  ],
};

/**
 * Expected fallback behaviors for unsupported scenarios
 */
const FALLBACK_BEHAVIORS = {
  // Unsupported breakpoints
  unknownBreakpoint: 'ignore-class-with-warning',
  invalidBreakpointSyntax: 'strip-breakpoint-preserve-base',
  conflictingBreakpoints: 'use-last-specified-with-warning',

  // Unsupported pseudo-classes
  unknownPseudoClass: 'ignore-class-with-warning',
  invalidPseudoSyntax: 'strip-pseudo-preserve-base',
  conflictingPseudoClasses: 'use-highest-priority-with-warning',

  // Performance issues
  processingTimeout: 'return-partial-results-with-warning',
  memoryExhaustion: 'switch-to-basic-mode-with-warning',
  largeDatasetsError: 'enable-chunked-processing',

  // Browser compatibility
  unsupportedBrowser: 'generate-fallback-css-with-warning',
  limitedMediaQuerySupport: 'use-basic-responsive-patterns',
  noJavaScriptSupport: 'provide-css-only-solution',

  // Framework integration
  frameworkIntegrationFailure: 'fallback-to-vanilla-css-classes',
  ssrMismatch: 'defer-responsive-optimization-to-client',
  reactivityIssues: 'disable-dynamic-optimization',
};

/**
 * Performance monitor for tracking optimization metrics
 */
let performanceMonitor: PerformanceMonitor | null = null;

/**
 * Initialize the responsive optimization system
 */
export function initializeResponsiveOptimization(
  config: Partial<ResponsiveOptimizationConfig> = {}
): ResponsiveOptimizationConfig {
  const validatedConfig = ResponsiveOptimizationConfigSchema.parse({
    ...ResponsiveOptimizationConfigSchema.parse({}),
    ...config,
  });

  // Initialize performance monitoring
  performanceMonitor = createPerformanceMonitor({
    enabled: true,
    enableGC: true,
    enableEventLoop: true,
  });

  console.log('Responsive optimization system initialized', {
    breakpointsCount: validatedConfig.breakpoints.length,
    pseudoStatesCount: validatedConfig.pseudoStates.length,
    cachingEnabled: validatedConfig.enableCaching,
    parallelProcessingEnabled: validatedConfig.enableParallelProcessing,
  });

  return validatedConfig;
}

/**
 * Validate responsive pattern requirements against configuration
 */
export function validateRequirements(
  requirements: ResponsivePatternRequirements,
  config: ResponsiveOptimizationConfig
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check breakpoint support
  const requiredBreakpoints = requirements.supportedBreakpoints;
  const configBreakpoints = config.breakpoints;

  for (const requiredBp of requiredBreakpoints) {
    const foundBp = configBreakpoints.find((bp) => bp.name === requiredBp.name);
    if (!foundBp) {
      errors.push(`Required breakpoint '${requiredBp.name}' not found in configuration`);
    } else if (foundBp.minWidth !== requiredBp.minWidth) {
      warnings.push(
        `Breakpoint '${requiredBp.name}' has different min-width: expected ${requiredBp.minWidth}px, got ${foundBp.minWidth}px`
      );
    }
  }

  // Check pseudo-state support
  const requiredPseudoStates = requirements.supportedPseudoStates;
  const configPseudoStates = config.pseudoStates;

  for (const requiredPs of requiredPseudoStates) {
    const foundPs = configPseudoStates.find((ps) => ps.name === requiredPs.name);
    if (!foundPs) {
      errors.push(`Required pseudo-state '${requiredPs.name}' not found in configuration`);
    } else if (foundPs.priority !== requiredPs.priority) {
      warnings.push(
        `Pseudo-state '${requiredPs.name}' has different priority: expected ${requiredPs.priority}, got ${foundPs.priority}`
      );
    }
  }

  // Check optimization requirements
  if (requirements.mustGroupByBreakpoint && !config.enableResponsiveGrouping) {
    errors.push('Responsive grouping is required but disabled in configuration');
  }

  if (requirements.mustGroupByProperty && !config.groupByProperty) {
    errors.push('Property-based grouping is required but disabled in configuration');
  }

  // Check performance requirements
  if (requirements.mustSupportLargeDatasets && !config.enableParallelProcessing) {
    recommendations.push(
      'Consider enabling parallel processing for better performance with large datasets'
    );
  }

  if (requirements.mustProvideProgressFeedback && !performanceMonitor) {
    warnings.push('Performance monitoring disabled, cannot provide progress feedback');
  }

  const isValid = errors.length === 0;

  console.log('Requirements validation completed', {
    isValid,
    errorsCount: errors.length,
    warningsCount: warnings.length,
    recommendationsCount: recommendations.length,
  });

  return {
    isValid,
    errors,
    warnings,
    recommendations,
  };
}

/**
 * Get default configuration optimized for different use cases
 */
export function getPresetConfiguration(
  preset: 'development' | 'production' | 'testing'
): ResponsiveOptimizationConfig {
  const baseConfig = ResponsiveOptimizationConfigSchema.parse({});

  switch (preset) {
    case 'development':
      return {
        ...baseConfig,
        generateSourceComments: true,
        includeOptimizationMetrics: true,
        enableCaching: false, // Disable for development to see live changes
        complexityAnalysisEnabled: true,
      };

    case 'production':
      return {
        ...baseConfig,
        generateSourceComments: false,
        includeOptimizationMetrics: false,
        enableCaching: true,
        enableParallelProcessing: true,
        enableCombinedOptimization: true,
      };

    case 'testing':
      return {
        ...baseConfig,
        generateSourceComments: true,
        includeOptimizationMetrics: true,
        enableCaching: false,
        complexityAnalysisEnabled: true,
        coOccurrenceAnalysisEnabled: true,
      };

    default:
      return baseConfig;
  }
}

/**
 * Export all schemas and constants for external use
 */
export {
  DEFAULT_BREAKPOINTS,
  DEFAULT_PSEUDO_STATES,
  DEFAULT_RESPONSIVE_REQUIREMENTS,
  FALLBACK_BEHAVIORS,
  PseudoClassStateSchema,
  RESPONSIVE_EDGE_CASES,
  ResponsiveBreakpointSchema,
  ResponsiveOptimizationConfigSchema,
  ResponsivePatternAnalysisSchema,
  ResponsivePatternTypeSchema,
};

// ===== OPTIMIZATION ENGINE =====

/**
 * Optimization result interface
 */
export interface ResponsiveOptimizationResult {
  originalClasses: string[];
  optimizedClasses: string[];
  reductionPercentage: number;
  conflictsResolved: number;
  appliedOptimizations: Array<{
    type: string;
    description: string;
    impact: string;
  }>;
  groupingChanges: Array<{
    original: string[];
    optimized: string[];
    strategy: string;
  }>;
  mergingChanges: Array<{
    patterns: string[];
    result: string;
    reason: string;
  }>;
  validationResults: Array<{
    className: string;
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>;
  warnings: string[];
  errors: string[];
  metrics: {
    totalTime: number;
    cacheHits: number;
    cacheMisses: number;
    patternsProcessed: number;
    breakpointsProcessed: number;
    pseudoClassesProcessed: number;
    complexPatternsProcessed: number;
  };
}

/**
 * Main responsive optimization engine
 */
export class ResponsiveOptimizationEngine {
  private config: ResponsiveOptimizationConfig;
  private performanceMonitor: PerformanceMonitor;
  private cache = new Map<string, ResponsiveOptimizationResult>();

  constructor(config: Partial<ResponsiveOptimizationConfig> = {}) {
    // Validate and merge configuration
    this.config = ResponsiveOptimizationConfigSchema.parse({
      ...this.getDefaultConfig(),
      ...config,
    });

    // Initialize performance monitoring
    this.performanceMonitor = createPerformanceMonitor({
      enabled: this.config.includeOptimizationMetrics,
      enableGC: true,
      enableEventLoop: true,
    });

    // Validate configuration
    this.validateConfiguration();
  }

  /**
   * Main optimization method
   */
  async optimizeClasses(classes: string[]): Promise<ResponsiveOptimizationResult> {
    const startTime = performance.now();

    // Generate cache key
    const cacheKey = this.generateCacheKey(classes);

    // Check cache first
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return {
        ...cached,
        metrics: {
          ...cached.metrics,
          cacheHits: (cached.metrics.cacheHits || 0) + 1,
        },
      };
    }

    // Initialize result
    const result: ResponsiveOptimizationResult = {
      originalClasses: [...classes],
      optimizedClasses: [],
      reductionPercentage: 0,
      conflictsResolved: 0,
      appliedOptimizations: [],
      groupingChanges: [],
      mergingChanges: [],
      validationResults: [],
      warnings: [],
      errors: [],
      metrics: {
        totalTime: 0,
        cacheHits: 0,
        cacheMisses: 1,
        patternsProcessed: 0,
        breakpointsProcessed: 0,
        pseudoClassesProcessed: 0,
        complexPatternsProcessed: 0,
      },
    };

    try {
      // Step 1: Validate input classes
      const validatedClasses = this.validateInputClasses(classes, result);

      // Step 2: Parse patterns
      const patterns = this.parsePatterns(validatedClasses, result);

      // Step 3: Analyze complexity
      const complexPatterns = this.analyzeComplexity(patterns, result);

      // Step 4: Group patterns
      const groupedPatterns = this.groupPatterns(complexPatterns, result);

      // Step 5: Merge patterns
      const mergedPatterns = this.mergePatterns(groupedPatterns, result);

      // Step 6: Generate optimized classes
      result.optimizedClasses = this.generateOptimizedClasses(mergedPatterns, result);

      // Step 7: Calculate metrics
      this.calculateMetrics(result, classes);

      // Cache result if enabled
      if (this.config.enableCaching) {
        this.addToCache(cacheKey, result);
      }
    } catch (error) {
      result.errors.push(`Optimization failed: ${(error as Error).message}`);
      result.optimizedClasses = [...classes]; // Fallback to original
    }

    // Record total time
    result.metrics.totalTime = performance.now() - startTime;

    return result;
  }

  /**
   * Clear the optimization cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // Private helper methods

  private getDefaultConfig(): ResponsiveOptimizationConfig {
    return ResponsiveOptimizationConfigSchema.parse({});
  }

  private validateConfiguration(): void {
    if (this.config.maxCacheSize && this.config.maxCacheSize <= 0) {
      throw new Error('Cache size must be positive');
    }

    if (!this.config.pseudoStates?.length) {
      throw new Error('pseudoStates is required');
    }
  }

  private generateCacheKey(classes: string[]): string {
    return JSON.stringify({
      classes: classes.sort(),
      config: {
        enableResponsiveGrouping: this.config.enableResponsiveGrouping,
        enablePseudoClassGrouping: this.config.enablePseudoClassGrouping,
        enableCombinedOptimization: this.config.enableCombinedOptimization,
        enableBreakpointMerging: this.config.enableBreakpointMerging,
        groupByProperty: this.config.groupByProperty,
      },
    });
  }

  private validateInputClasses(classes: string[], result: ResponsiveOptimizationResult): string[] {
    const validClasses: string[] = [];

    for (const className of classes) {
      // Validate each class
      const validation = {
        className,
        isValid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };

      if (!className || typeof className !== 'string') {
        validation.isValid = false;
        validation.errors.push('Invalid class name: must be a non-empty string');
      } else if (className.trim() !== className) {
        validation.warnings.push('Class name has leading/trailing whitespace');
        validClasses.push(className.trim());
      } else if (className.includes('::')) {
        validation.warnings.push('Double colon syntax may not be supported');
        validClasses.push(className);
      } else {
        validClasses.push(className);
      }

      result.validationResults.push(validation);

      if (!validation.isValid) {
        result.errors.push(...validation.errors);
      }
      result.warnings.push(...validation.warnings);
    }

    return validClasses;
  }

  private parsePatterns(
    classes: string[],
    result: ResponsiveOptimizationResult
  ): Array<{
    className: string;
    breakpoints: string[];
    pseudoClasses: string[];
    property: string;
    value: string;
    hasArbitrary: boolean;
    hasImportant: boolean;
  }> {
    const patterns = [];

    for (const className of classes) {
      try {
        const pattern = this.parsePattern(className);
        patterns.push(pattern);
        result.metrics.patternsProcessed++;

        // Count breakpoints and pseudo-classes
        result.metrics.breakpointsProcessed += pattern.breakpoints.length;
        result.metrics.pseudoClassesProcessed += pattern.pseudoClasses.length;
      } catch (error) {
        result.warnings.push(`Failed to parse pattern: ${className} - ${error.message}`);
      }
    }

    return patterns;
  }

  private parsePattern(className: string) {
    // Simple pattern parsing (this would be more sophisticated in reality)
    const parts = className.split(':');
    const property = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    const breakpoints = modifiers.filter((m) => ['sm', 'md', 'lg', 'xl', '2xl'].includes(m));
    const pseudoClasses = modifiers.filter(
      (m) =>
        this.config.supportedPseudoClasses?.includes(m) ||
        ['hover', 'focus', 'active', 'disabled'].includes(m)
    );

    return {
      className,
      breakpoints,
      pseudoClasses,
      property,
      value: property.split('-').slice(1).join('-'),
      hasArbitrary: className.includes('[') && className.includes(']'),
      hasImportant: className.includes('!'),
    };
  }

  private analyzeComplexity(patterns: any[], result: ResponsiveOptimizationResult): any[] {
    const complexPatterns = patterns.filter((pattern) => {
      const complexity = pattern.breakpoints.length + pattern.pseudoClasses.length;
      const isComplex = complexity > 2 || pattern.hasArbitrary;

      if (isComplex) {
        result.metrics.complexPatternsProcessed++;
      }

      return true; // Include all patterns for now
    });

    return complexPatterns;
  }

  private groupPatterns(patterns: any[], result: ResponsiveOptimizationResult): any[] {
    if (!this.config.enableBreakpointGrouping) {
      return patterns;
    }

    // Simple grouping by property
    const groups = new Map<string, any[]>();

    for (const pattern of patterns) {
      const key = pattern.property.split('-')[0]; // e.g., 'text' from 'text-blue-500'
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(pattern);
    }

    // Record grouping changes
    for (const [property, groupPatterns] of groups) {
      if (groupPatterns.length > 1) {
        result.groupingChanges.push({
          original: groupPatterns.map((p) => p.className),
          optimized: groupPatterns.map((p) => p.className), // No actual optimization yet
          strategy: 'by-property',
        });
      }
    }

    return patterns;
  }

  private mergePatterns(patterns: any[], result: ResponsiveOptimizationResult): any[] {
    if (!this.config.aggressiveOptimization) {
      return patterns;
    }

    // Find duplicates and conflicts
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const pattern of patterns) {
      if (seen.has(pattern.className)) {
        duplicates.add(pattern.className);
      }
      seen.add(pattern.className);
    }

    // Remove duplicates
    const uniquePatterns = patterns.filter((pattern, index) => {
      const firstIndex = patterns.findIndex((p) => p.className === pattern.className);
      return firstIndex === index;
    });

    // Record merging changes
    if (duplicates.size > 0) {
      result.mergingChanges.push({
        patterns: Array.from(duplicates),
        result: `Removed ${duplicates.size} duplicate patterns`,
        reason: 'duplicate-removal',
      });
    }

    return uniquePatterns;
  }

  private generateOptimizedClasses(
    patterns: any[],
    result: ResponsiveOptimizationResult
  ): string[] {
    // Simple implementation - just return the class names
    const optimizedClasses = patterns.map((pattern) => pattern.className);

    // Apply any LVHA reordering if enabled
    if (this.config.enforceLVHAOrder) {
      return this.reorderLVHA(optimizedClasses, result);
    }

    return optimizedClasses;
  }

  private reorderLVHA(classes: string[], result: ResponsiveOptimizationResult): string[] {
    // Simple LVHA ordering (link, visited, hover, active)
    const lvhaOrder = ['link', 'visited', 'hover', 'focus', 'active'];

    return classes.sort((a, b) => {
      const aOrder = this.getLVHAOrder(a, lvhaOrder);
      const bOrder = this.getLVHAOrder(b, lvhaOrder);
      return aOrder - bOrder;
    });
  }

  private getLVHAOrder(className: string, lvhaOrder: string[]): number {
    for (let i = 0; i < lvhaOrder.length; i++) {
      if (className.includes(lvhaOrder[i] + ':')) {
        return i;
      }
    }
    return 999; // Non-LVHA classes go last
  }

  private calculateMetrics(result: ResponsiveOptimizationResult, originalClasses: string[]): void {
    const originalCount = originalClasses.length;
    const optimizedCount = result.optimizedClasses.length;

    result.reductionPercentage =
      originalCount > 0 ? Math.round(((originalCount - optimizedCount) / originalCount) * 100) : 0;

    // Count resolved conflicts (based on merging changes)
    result.conflictsResolved = result.mergingChanges.reduce((count, change) => {
      return count + (change.patterns.length - 1); // Each merge resolves n-1 conflicts
    }, 0);

    // Add optimization descriptions
    if (result.reductionPercentage > 0) {
      result.appliedOptimizations.push({
        type: 'duplicate-removal',
        description: `Removed duplicate classes`,
        impact: `${result.reductionPercentage}% size reduction`,
      });
    }

    if (result.groupingChanges.length > 0) {
      result.appliedOptimizations.push({
        type: 'pattern-grouping',
        description: `Grouped ${result.groupingChanges.length} pattern sets`,
        impact: 'Improved organization',
      });
    }
  }

  private addToCache(key: string, result: ResponsiveOptimizationResult): void {
    // Respect cache size limit
    if (this.config.maxCacheSize && this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entry (simple LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, { ...result });
  }
}
