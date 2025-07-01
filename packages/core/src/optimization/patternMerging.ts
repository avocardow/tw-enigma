/**
 * Pattern Merging System for TW-Enigma
 *
 * Advanced pattern merging strategies for resolving conflicts between overlapping patterns.
 * Handles responsive breakpoints, pseudo-classes, and complex pattern combinations.
 */

import { z } from 'zod';
import { createPerformanceMonitor, type PerformanceMonitor } from './performanceMonitor';

// ===== CORE SCHEMAS AND TYPES =====

// Basic merge strategy types
export const MergeStrategySchema = z.enum([
  'mobile-first',
  'desktop-first',
  'specificity',
  'precedence',
  'frequency',
  'last-wins',
]);

export type MergeStrategy = z.infer<typeof MergeStrategySchema>;

// Conflict severity levels
export const ConflictSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

export type ConflictSeverity = z.infer<typeof ConflictSeveritySchema>;

// Pattern conflict definition
export const PatternConflictSchema = z.object({
  id: z.string(),
  severity: ConflictSeveritySchema,
  type: z.enum([
    'property-override',
    'pseudo-class-order',
    'breakpoint-overlap',
    'specificity-conflict',
    'logical-contradiction',
  ]),
  description: z.string(),
  patterns: z.array(z.string()),
  affectedProperties: z.array(z.string()),
  suggestedResolution: z.string(),
  resolvable: z.boolean().default(true),
});

export type PatternConflict = z.infer<typeof PatternConflictSchema>;

// Merge result
export const MergeResultSchema = z.object({
  success: z.boolean(),
  mergedPatterns: z.array(z.string()),
  removedPatterns: z.array(z.string()),
  conflicts: z.array(PatternConflictSchema),
  warnings: z.array(z.string()),
  performance: z.object({
    processingTime: z.number(),
    conflictsResolved: z.number(),
    optimizationGain: z.number(),
  }),
  recommendations: z.array(z.string()).default([]),
});

export type MergeResult = z.infer<typeof MergeResultSchema>;

// Configuration for pattern merging
export const MergeConfigSchema = z.object({
  strategy: MergeStrategySchema.default('mobile-first'),
  enableCaching: z.boolean().default(true),
  preserveOrder: z.boolean().default(false),
  allowPartialMerges: z.boolean().default(true),
  maxConflictSeverity: ConflictSeveritySchema.default('warning'),
  customRules: z
    .array(
      z.object({
        name: z.string(),
        pattern: z.string(),
        priority: z.number().default(0),
        action: z.enum(['merge', 'skip', 'prioritize']),
      })
    )
    .default([]),
  performance: z
    .object({
      enableMetrics: z.boolean().default(true),
      cacheSize: z.number().default(1000),
      timeoutMs: z.number().default(5000),
    })
    .default({}),
});

export type MergeConfig = z.infer<typeof MergeConfigSchema>;

// Parsed pattern type
export interface ParsedPattern {
  original: string;
  baseClass: string;
  modifiers: string[];
  breakpoint?: string;
  pseudoClasses: string[];
  property: string;
  value: string;
  specificity: number;
}

// ===== PATTERN MERGING ENGINE =====

/**
 * Main pattern merging engine
 */
export class PatternMergingEngine {
  private config: MergeConfig;
  private cache = new Map<string, MergeResult>();
  private startTime = 0;
  private performanceMonitor: PerformanceMonitor;

  constructor(config: Partial<MergeConfig> = {}) {
    this.config = MergeConfigSchema.parse(config);
    this.performanceMonitor = createPerformanceMonitor();
  }

  /**
   * Merge an array of CSS class patterns
   */
  public mergePatterns(patterns: string[]): MergeResult {
    this.startTime = performance.now();

    try {
      // Validate input
      if (!patterns || patterns.length === 0) {
        return this.createEmptyResult();
      }

      if (patterns.length === 1) {
        return this.createSinglePatternResult(patterns[0]);
      }

      // Check cache
      const cacheKey = this.generateCacheKey(patterns);
      if (this.config.enableCaching && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }

      // Analyze conflicts
      const conflicts = this.analyzeConflicts(patterns);

      // Apply merge strategy
      const mergeResult = this.applyMergeStrategy(patterns, conflicts);

      // Cache result
      if (this.config.enableCaching) {
        this.cache.set(cacheKey, mergeResult);
        this.cleanupCache();
      }

      return mergeResult;
    } catch (error) {
      return this.createErrorResult(patterns, error as Error);
    }
  }

  /**
   * Analyze potential conflicts between patterns
   */
  private analyzeConflicts(patterns: string[]): PatternConflict[] {
    const conflicts: PatternConflict[] = [];

    // Parse patterns into structured format
    const parsedPatterns = patterns.map((pattern) => this.parsePattern(pattern));

    // Check pairwise conflicts
    for (let i = 0; i < parsedPatterns.length; i++) {
      for (let j = i + 1; j < parsedPatterns.length; j++) {
        const conflict = this.checkConflict(parsedPatterns[i], parsedPatterns[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    // Sort by severity
    return conflicts.sort((a, b) => {
      const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Parse a pattern into its components
   */
  private parsePattern(pattern: string): ParsedPattern {
    const parts = pattern.split(':');
    const baseClass = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    // Extract breakpoint
    const breakpoints = ['sm', 'md', 'lg', 'xl', '2xl'];
    const breakpoint = modifiers.find((mod) => breakpoints.includes(mod));

    // Extract pseudo-classes
    const pseudoClasses = ['hover', 'focus', 'active', 'visited', 'disabled'];
    const pseudo = modifiers.filter((mod) => pseudoClasses.includes(mod));

    // Extract property and value from base class
    const { property, value } = this.extractPropertyValue(baseClass);

    return {
      original: pattern,
      baseClass,
      modifiers,
      breakpoint,
      pseudoClasses: pseudo,
      property,
      value,
      specificity: this.calculateSpecificity(modifiers, pseudo),
    };
  }

  /**
   * Extract CSS property and value from class name
   */
  private extractPropertyValue(className: string): { property: string; value: string } {
    // Simple mapping for common Tailwind patterns
    const propertyMap: Record<string, string> = {
      'bg-': 'background-color',
      'text-': 'color',
      'p-': 'padding',
      'px-': 'padding-horizontal',
      'py-': 'padding-vertical',
      'm-': 'margin',
      'mx-': 'margin-horizontal',
      'my-': 'margin-vertical',
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

    // Handle special cases
    if (className === 'hidden') {
      return { property: 'display', value: 'none' };
    }
    if (className === 'block') {
      return { property: 'display', value: 'block' };
    }
    if (className === 'flex') {
      return { property: 'display', value: 'flex' };
    }

    return { property: 'unknown', value: className };
  }

  /**
   * Calculate CSS specificity
   */
  private calculateSpecificity(modifiers: string[], pseudoClasses: string[]): number {
    let specificity = 1; // Base class
    specificity += modifiers.length * 10; // Modifiers
    specificity += pseudoClasses.length * 10; // Pseudo-classes
    return specificity;
  }

  /**
   * Check for conflicts between two parsed patterns
   */
  private checkConflict(pattern1: ParsedPattern, pattern2: ParsedPattern): PatternConflict | null {
    // Same property with different values
    if (
      pattern1.property === pattern2.property &&
      pattern1.value !== pattern2.value &&
      pattern1.property !== 'unknown'
    ) {
      return PatternConflictSchema.parse({
        id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        severity: this.determineConflictSeverity(pattern1, pattern2),
        type: 'property-override',
        description: `Property '${pattern1.property}' has conflicting values: '${pattern1.value}' vs '${pattern2.value}'`,
        patterns: [pattern1.original, pattern2.original],
        affectedProperties: [pattern1.property],
        suggestedResolution: this.suggestResolution(pattern1, pattern2),
        resolvable: true,
      });
    }

    // Pseudo-class order conflicts (LVHA)
    if (
      pattern1.property === pattern2.property &&
      pattern1.pseudoClasses.length > 0 &&
      pattern2.pseudoClasses.length > 0
    ) {
      const orderIssue = this.checkPseudoClassOrder(pattern1.pseudoClasses, pattern2.pseudoClasses);
      if (orderIssue) {
        return PatternConflictSchema.parse({
          id: `pseudo-order-${Date.now()}`,
          severity: 'warning',
          type: 'pseudo-class-order',
          description: `Pseudo-class order conflict: ${orderIssue}`,
          patterns: [pattern1.original, pattern2.original],
          affectedProperties: [pattern1.property],
          suggestedResolution: 'Reorder according to LVHA (Link, Visited, Hover, Active)',
          resolvable: true,
        });
      }
    }

    return null;
  }

  /**
   * Determine conflict severity
   */
  private determineConflictSeverity(
    pattern1: ParsedPattern,
    _pattern2: ParsedPattern
  ): ConflictSeverity {
    // Critical: Display property conflicts
    if (pattern1.property === 'display') {
      return 'critical';
    }

    // Error: Important style conflicts
    const importantProps = ['position', 'z-index', 'opacity'];
    if (importantProps.includes(pattern1.property)) {
      return 'error';
    }

    // Warning: Visual property conflicts
    const visualProps = ['color', 'background-color', 'border'];
    if (visualProps.some((prop) => pattern1.property.includes(prop))) {
      return 'warning';
    }

    return 'info';
  }

  /**
   * Check pseudo-class order (LVHA rule)
   */
  private checkPseudoClassOrder(pseudo1: string[], pseudo2: string[]): string | null {
    const correctOrder = ['link', 'visited', 'hover', 'active'];
    const allPseudo = [...pseudo1, ...pseudo2];

    for (let i = 1; i < allPseudo.length; i++) {
      const current = correctOrder.indexOf(allPseudo[i]);
      const previous = correctOrder.indexOf(allPseudo[i - 1]);

      if (current !== -1 && previous !== -1 && current < previous) {
        return `${allPseudo[i]} should come before ${allPseudo[i - 1]}`;
      }
    }

    return null;
  }

  /**
   * Suggest resolution for conflicts
   */
  private suggestResolution(pattern1: ParsedPattern, pattern2: ParsedPattern): string {
    switch (this.config.strategy) {
      case 'mobile-first':
        return pattern2.breakpoint
          ? `Use '${pattern2.original}' (larger breakpoint)`
          : `Use '${pattern2.original}' (last declaration)`;

      case 'desktop-first':
        return pattern1.breakpoint
          ? `Use '${pattern1.original}' (larger breakpoint)`
          : `Use '${pattern1.original}' (first declaration)`;

      case 'specificity':
        return pattern1.specificity >= pattern2.specificity
          ? `Use '${pattern1.original}' (higher specificity)`
          : `Use '${pattern2.original}' (higher specificity)`;

      default:
        return `Choose between '${pattern1.original}' and '${pattern2.original}'`;
    }
  }

  /**
   * Apply the configured merge strategy
   */
  private applyMergeStrategy(patterns: string[], conflicts: PatternConflict[]): MergeResult {
    const startTime = performance.now();
    const removedPatterns: string[] = [];
    const warnings: string[] = [];
    let mergedPatterns = [...patterns];

    // Resolve conflicts based on strategy
    for (const conflict of conflicts) {
      if (conflict.severity === 'critical' && !this.config.allowPartialMerges) {
        warnings.push(`Critical conflict prevents merging: ${conflict.description}`);
        continue;
      }

      const resolution = this.resolveConflict(conflict);
      if (resolution.remove) {
        const toRemove = resolution.remove;
        mergedPatterns = mergedPatterns.filter((p) => p !== toRemove);
        removedPatterns.push(toRemove);
      }
    }

    // Apply custom rules
    const customResult = this.applyCustomRules(mergedPatterns);
    mergedPatterns = customResult.patterns;
    warnings.push(...customResult.warnings);

    const processingTime = performance.now() - startTime;
    const optimizationGain = this.calculateOptimizationGain(patterns, mergedPatterns);

    return MergeResultSchema.parse({
      success: true,
      mergedPatterns,
      removedPatterns,
      conflicts,
      warnings,
      performance: {
        processingTime,
        conflictsResolved: conflicts.filter((c) => c.resolvable).length,
        optimizationGain,
      },
      recommendations: this.generateRecommendations(conflicts, optimizationGain),
    });
  }

  /**
   * Resolve a single conflict
   */
  private resolveConflict(conflict: PatternConflict): { remove?: string } {
    const [pattern1, pattern2] = conflict.patterns;
    const parsed1 = this.parsePattern(pattern1);
    const parsed2 = this.parsePattern(pattern2);

    switch (this.config.strategy) {
      case 'mobile-first': {
        // Keep pattern with larger breakpoint, or later pattern if same breakpoint
        const bp1Order = this.getBreakpointOrder(parsed1.breakpoint);
        const bp2Order = this.getBreakpointOrder(parsed2.breakpoint);
        return { remove: bp1Order <= bp2Order ? pattern1 : pattern2 };
      }

      case 'desktop-first': {
        // Keep pattern with smaller breakpoint, or earlier pattern if same breakpoint
        const bp1OrderDf = this.getBreakpointOrder(parsed1.breakpoint);
        const bp2OrderDf = this.getBreakpointOrder(parsed2.breakpoint);
        return { remove: bp1OrderDf >= bp2OrderDf ? pattern1 : pattern2 };
      }

      case 'specificity':
        // Keep pattern with higher specificity
        return { remove: parsed1.specificity >= parsed2.specificity ? pattern2 : pattern1 };

      case 'last-wins':
        // Keep the later pattern (pattern2)
        return { remove: pattern1 };

      default:
        return { remove: pattern1 };
    }
  }

  /**
   * Get breakpoint order (smaller number = smaller breakpoint)
   */
  private getBreakpointOrder(breakpoint?: string): number {
    const order: Record<string, number> = { base: 0, sm: 1, md: 2, lg: 3, xl: 4, '2xl': 5 };
    return breakpoint ? order[breakpoint] || 0 : 0;
  }

  /**
   * Apply custom rules
   */
  private applyCustomRules(patterns: string[]): { patterns: string[]; warnings: string[] } {
    let resultPatterns = [...patterns];
    const warnings: string[] = [];

    for (const rule of this.config.customRules) {
      try {
        const regex = new RegExp(rule.pattern);
        const matchingPatterns = resultPatterns.filter((p) => regex.test(p));

        if (matchingPatterns.length > 0) {
          switch (rule.action) {
            case 'skip': {
              // Remove matching patterns
              resultPatterns = resultPatterns.filter((p) => !regex.test(p));
              warnings.push(
                `Custom rule '${rule.name}' removed ${matchingPatterns.length} patterns`
              );
              break;
            }
            case 'prioritize': {
              // Keep only the first matching pattern
              const toKeep = matchingPatterns[0];
              resultPatterns = resultPatterns.filter((p) => !regex.test(p) || p === toKeep);
              break;
            }
            case 'merge':
              // Custom merge logic would go here
              break;
          }
        }
      } catch (error) {
        warnings.push(`Custom rule '${rule.name}' failed: ${(error as Error).message}`);
      }
    }

    return { patterns: resultPatterns, warnings };
  }

  /**
   * Calculate optimization gain
   */
  private calculateOptimizationGain(originalPatterns: string[], mergedPatterns: string[]): number {
    const originalSize = originalPatterns.join(' ').length;
    const mergedSize = mergedPatterns.join(' ').length;
    return originalSize > 0 ? (originalSize - mergedSize) / originalSize : 0;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    conflicts: PatternConflict[],
    optimizationGain: number
  ): string[] {
    const recommendations: string[] = [];

    if (conflicts.length > 0) {
      const criticalConflicts = conflicts.filter((c) => c.severity === 'critical');
      if (criticalConflicts.length > 0) {
        recommendations.push(`Address ${criticalConflicts.length} critical conflicts`);
      }
    }

    if (optimizationGain < 0.1) {
      recommendations.push('Consider reviewing pattern usage for better optimization');
    }

    if (optimizationGain > 0.5) {
      recommendations.push('Excellent optimization - consider applying to similar patterns');
    }

    return recommendations;
  }

  /**
   * Utility methods
   */
  private generateCacheKey(patterns: string[]): string {
    return patterns.sort().join('|') + ':' + this.config.strategy;
  }

  private cleanupCache(): void {
    if (this.cache.size > this.config.performance.cacheSize) {
      const entries = Array.from(this.cache.entries());
      const toDelete = entries.slice(0, entries.length - this.config.performance.cacheSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  private createEmptyResult(): MergeResult {
    return MergeResultSchema.parse({
      success: true,
      mergedPatterns: [],
      removedPatterns: [],
      conflicts: [],
      warnings: ['No patterns provided'],
      performance: {
        processingTime: 0,
        conflictsResolved: 0,
        optimizationGain: 0,
      },
    });
  }

  private createSinglePatternResult(pattern: string): MergeResult {
    return MergeResultSchema.parse({
      success: true,
      mergedPatterns: [pattern],
      removedPatterns: [],
      conflicts: [],
      warnings: [],
      performance: {
        processingTime: performance.now() - this.startTime,
        conflictsResolved: 0,
        optimizationGain: 0,
      },
    });
  }

  private createErrorResult(patterns: string[], error: Error): MergeResult {
    return MergeResultSchema.parse({
      success: false,
      mergedPatterns: patterns,
      removedPatterns: [],
      conflicts: [],
      warnings: [`Error during merge: ${error.message}`],
      performance: {
        processingTime: performance.now() - this.startTime,
        conflictsResolved: 0,
        optimizationGain: 0,
      },
    });
  }

  /**
   * Public API methods
   */
  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.performance.cacheSize,
    };
  }

  public validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate custom rules
    for (const rule of this.config.customRules) {
      try {
        new RegExp(rule.pattern);
      } catch {
        errors.push(`Invalid regex in rule '${rule.name}': ${rule.pattern}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// ===== FACTORY FUNCTIONS =====

/**
 * Factory functions for common use cases
 */
export function createPatternMergingEngine(config?: Partial<MergeConfig>): PatternMergingEngine {
  return new PatternMergingEngine(config);
}

export function createMobileFirstMerger(): PatternMergingEngine {
  return new PatternMergingEngine({
    strategy: 'mobile-first',
    preserveOrder: false,
    allowPartialMerges: true,
  });
}

export function createDesktopFirstMerger(): PatternMergingEngine {
  return new PatternMergingEngine({
    strategy: 'desktop-first',
    preserveOrder: false,
    allowPartialMerges: true,
  });
}

export function createSpecificityMerger(): PatternMergingEngine {
  return new PatternMergingEngine({
    strategy: 'specificity',
    maxConflictSeverity: 'error',
  });
}

/**
 * Quick merge utility function
 */
export function mergePatterns(
  patterns: string[],
  strategy: MergeStrategy = 'mobile-first'
): MergeResult {
  const engine = createPatternMergingEngine({ strategy });
  return engine.mergePatterns(patterns);
}

/**
 * Conflict analysis utility
 */
export function analyzePatternConflicts(patterns: string[]): PatternConflict[] {
  const engine = createPatternMergingEngine();
  const result = engine.mergePatterns(patterns);
  return result.conflicts;
}
