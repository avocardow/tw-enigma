/**
 * Breakpoint Compatibility System for TW-Enigma
 *
 * Provides configurable breakpoint handling, validation, and extensibility
 * for all pattern optimization components. Ensures consistent breakpoint
 * behavior across the entire optimization pipeline.
 */

import { z } from 'zod';
import { createPerformanceMonitor, type PerformanceMonitor } from './performanceMonitor';

// ===== CORE SCHEMAS AND TYPES =====

/**
 * Breakpoint definition with configurable properties
 */
export const BreakpointDefinitionSchema = z.object({
  name: z.string().min(1),
  minWidth: z.number().min(0),
  maxWidth: z.number().optional(),
  order: z.number().int().min(0),
  enabled: z.boolean().default(true),
  alias: z.array(z.string()).default([]),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type BreakpointDefinition = z.infer<typeof BreakpointDefinitionSchema>;

/**
 * Breakpoint configuration with validation rules
 */
export const BreakpointConfigSchema = z.object({
  breakpoints: z.array(BreakpointDefinitionSchema).min(1),
  defaultBreakpoint: z.string().optional(),
  mobileFirst: z.boolean().default(true),
  customBreakpoints: z.record(BreakpointDefinitionSchema).default({}),
  validation: z
    .object({
      enforceOrder: z.boolean().default(true),
      allowOverlaps: z.boolean().default(false),
      requireMinWidth: z.boolean().default(true),
      maxBreakpoints: z.number().int().min(1).max(20).default(10),
    })
    .default({}),
  extensibility: z
    .object({
      allowCustomBreakpoints: z.boolean().default(true),
      allowBreakpointAliases: z.boolean().default(true),
      allowRuntimeModification: z.boolean().default(false),
      customValidators: z.array(z.function()).default([]),
    })
    .default({}),
});

export type BreakpointConfig = z.infer<typeof BreakpointConfigSchema>;

/**
 * Breakpoint analysis results
 */
export const BreakpointAnalysisSchema = z.object({
  totalBreakpoints: z.number().int().min(0),
  enabledBreakpoints: z.number().int().min(0),
  orderConflicts: z.array(z.string()),
  overlapWarnings: z.array(z.string()),
  missingDefaults: z.array(z.string()),
  recommendations: z.array(z.string()),
  compatibilityScore: z.number().min(0).max(100),
  isValid: z.boolean(),
});

export type BreakpointAnalysis = z.infer<typeof BreakpointAnalysisSchema>;

/**
 * Breakpoint resolution result
 */
export const BreakpointResolutionSchema = z.object({
  resolved: z.array(BreakpointDefinitionSchema),
  conflicts: z.array(z.string()),
  warnings: z.array(z.string()),
  fallbacks: z.array(z.string()),
});

export type BreakpointResolution = z.infer<typeof BreakpointResolutionSchema>;

// ===== DEFAULT CONFIGURATIONS =====

/**
 * Default Tailwind CSS breakpoints
 */
export const DEFAULT_TAILWIND_BREAKPOINTS: BreakpointDefinition[] = [
  {
    name: 'sm',
    minWidth: 640,
    order: 1,
    enabled: true,
    alias: ['small'],
    description: 'Small devices (landscape phones)',
    metadata: { type: 'standard' },
  },
  {
    name: 'md',
    minWidth: 768,
    order: 2,
    enabled: true,
    alias: ['medium'],
    description: 'Medium devices (tablets)',
    metadata: { type: 'standard' },
  },
  {
    name: 'lg',
    minWidth: 1024,
    order: 3,
    enabled: true,
    alias: ['large'],
    description: 'Large devices (desktops)',
    metadata: { type: 'standard' },
  },
  {
    name: 'xl',
    minWidth: 1280,
    order: 4,
    enabled: true,
    alias: ['extra-large'],
    description: 'Extra large devices',
    metadata: { type: 'standard' },
  },
  {
    name: '2xl',
    minWidth: 1536,
    order: 5,
    enabled: true,
    alias: ['2x-large'],
    description: 'Extra extra large devices',
    metadata: { type: 'standard' },
  },
];

/**
 * Extended breakpoint set with additional common breakpoints
 */
export const EXTENDED_BREAKPOINTS: BreakpointDefinition[] = [
  ...DEFAULT_TAILWIND_BREAKPOINTS,
  {
    name: 'xs',
    minWidth: 475,
    order: 0,
    enabled: false,
    alias: ['extra-small'],
    description: 'Extra small devices',
    metadata: { type: 'extended' },
  },
  {
    name: '3xl',
    minWidth: 1920,
    order: 6,
    enabled: false,
    alias: ['3x-large'],
    description: 'Ultra wide screens',
    metadata: { type: 'extended' },
  },
];

// ===== MAIN COMPATIBILITY ENGINE =====

/**
 * Breakpoint compatibility engine providing centralized breakpoint management
 */
export class BreakpointCompatibilityEngine {
  private config: BreakpointConfig;
  private breakpointMap: Map<string, BreakpointDefinition>;
  private aliasMap: Map<string, string>;
  private perfMonitor: PerformanceMonitor;
  private cache: Map<string, BreakpointAnalysis>;

  constructor(config?: Partial<BreakpointConfig>) {
    this.perfMonitor = createPerformanceMonitor();
    this.config = this.validateAndNormalizeConfig(config);
    this.breakpointMap = new Map();
    this.aliasMap = new Map();
    this.cache = new Map();

    this.initializeBreakpoints();
  }

  /**
   * Initialize breakpoint maps and aliases
   */
  private initializeBreakpoints(): void {
    this.perfMonitor.startMeasurement('initializeBreakpoints');

    try {
      // Clear existing maps
      this.breakpointMap.clear();
      this.aliasMap.clear();

      // Process configured breakpoints
      for (const breakpoint of this.config.breakpoints) {
        this.breakpointMap.set(breakpoint.name, breakpoint);

        // Register aliases
        for (const alias of breakpoint.alias) {
          this.aliasMap.set(alias, breakpoint.name);
        }
      }

      // Process custom breakpoints
      for (const [name, breakpoint] of Object.entries(this.config.customBreakpoints)) {
        this.breakpointMap.set(name, breakpoint);

        for (const alias of breakpoint.alias) {
          this.aliasMap.set(alias, name);
        }
      }
    } finally {
      this.perfMonitor.endMeasurement('initializeBreakpoints');
    }
  }

  /**
   * Validate and normalize configuration
   */
  private validateAndNormalizeConfig(config?: Partial<BreakpointConfig>): BreakpointConfig {
    const defaultConfig: BreakpointConfig = {
      breakpoints: [...DEFAULT_TAILWIND_BREAKPOINTS],
      defaultBreakpoint: 'sm',
      mobileFirst: true,
      customBreakpoints: {},
      validation: {
        enforceOrder: true,
        allowOverlaps: false,
        requireMinWidth: true,
        maxBreakpoints: 10,
      },
      extensibility: {
        allowCustomBreakpoints: true,
        allowBreakpointAliases: true,
        allowRuntimeModification: false,
        customValidators: [],
      },
    };

    const mergedConfig = { ...defaultConfig, ...config };
    return BreakpointConfigSchema.parse(mergedConfig);
  }

  /**
   * Get all available breakpoints
   */
  public getBreakpoints(): BreakpointDefinition[] {
    return Array.from(this.breakpointMap.values())
      .filter((bp) => bp.enabled)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get breakpoint by name or alias
   */
  public getBreakpoint(nameOrAlias: string): BreakpointDefinition | null {
    // Try direct lookup first
    let breakpoint = this.breakpointMap.get(nameOrAlias);

    if (!breakpoint) {
      // Try alias lookup
      const realName = this.aliasMap.get(nameOrAlias);
      if (realName) {
        breakpoint = this.breakpointMap.get(realName);
      }
    }

    return breakpoint || null;
  }

  /**
   * Validate breakpoint name
   */
  public isValidBreakpoint(nameOrAlias: string): boolean {
    return this.getBreakpoint(nameOrAlias) !== null;
  }

  /**
   * Get breakpoint order
   */
  public getBreakpointOrder(nameOrAlias: string): number {
    const breakpoint = this.getBreakpoint(nameOrAlias);
    return breakpoint?.order ?? -1;
  }

  /**
   * Compare breakpoint order
   */
  public compareBreakpoints(a: string, b: string): number {
    const orderA = this.getBreakpointOrder(a);
    const orderB = this.getBreakpointOrder(b);

    if (orderA === -1 || orderB === -1) {
      throw new Error(`Invalid breakpoint comparison: ${a} vs ${b}`);
    }

    return orderA - orderB;
  }

  /**
   * Get breakpoint CSS media query
   */
  public getMediaQuery(nameOrAlias: string): string {
    const breakpoint = this.getBreakpoint(nameOrAlias);

    if (!breakpoint) {
      throw new Error(`Unknown breakpoint: ${nameOrAlias}`);
    }

    if (this.config.mobileFirst) {
      if (breakpoint.maxWidth) {
        return `@media (min-width: ${breakpoint.minWidth}px) and (max-width: ${breakpoint.maxWidth}px)`;
      }
      return `@media (min-width: ${breakpoint.minWidth}px)`;
    } else {
      // Desktop-first approach
      if (breakpoint.maxWidth) {
        return `@media (max-width: ${breakpoint.maxWidth}px)`;
      }
      return `@media (max-width: ${breakpoint.minWidth - 1}px)`;
    }
  }

  /**
   * Extract breakpoint from class name
   */
  public extractBreakpoint(className: string): string | null {
    const match = className.match(/^([^:]+):/);

    if (!match) {
      return null;
    }

    const prefix = match[1];
    return this.isValidBreakpoint(prefix) ? prefix : null;
  }

  /**
   * Generate regex pattern for all breakpoints
   */
  public getBreakpointRegex(): RegExp {
    const breakpointNames = Array.from(this.breakpointMap.keys());
    const allAliases = Array.from(this.aliasMap.keys());
    const allPatterns = [...breakpointNames, ...allAliases];

    return new RegExp(`^(${allPatterns.join('|')}):`);
  }

  /**
   * Analyze breakpoint configuration
   */
  public analyzeBreakpoints(): BreakpointAnalysis {
    const cacheKey = 'analysis';

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    this.perfMonitor.startMeasurement('analyzeBreakpoints');

    try {
      const breakpoints = Array.from(this.breakpointMap.values());
      const analysis: BreakpointAnalysis = {
        totalBreakpoints: breakpoints.length,
        enabledBreakpoints: breakpoints.filter((bp) => bp.enabled).length,
        orderConflicts: [],
        overlapWarnings: [],
        missingDefaults: [],
        recommendations: [],
        compatibilityScore: 100,
        isValid: true,
      };

      // Check for order conflicts
      const orders = new Map<number, string[]>();
      for (const bp of breakpoints) {
        if (!orders.has(bp.order)) {
          orders.set(bp.order, []);
        }
        orders.get(bp.order)!.push(bp.name);
      }

      for (const [order, names] of orders) {
        if (names.length > 1) {
          analysis.orderConflicts.push(`Order ${order}: ${names.join(', ')}`);
          analysis.compatibilityScore -= 10;
          analysis.isValid = false;
        }
      }

      // Check for overlaps (if not allowed)
      if (!this.config.validation.allowOverlaps) {
        const sortedBreakpoints = breakpoints
          .filter((bp) => bp.enabled)
          .sort((a, b) => a.order - b.order);

        for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
          const current = sortedBreakpoints[i];
          const next = sortedBreakpoints[i + 1];

          if (current.maxWidth && current.maxWidth >= next.minWidth) {
            analysis.overlapWarnings.push(
              `${current.name} (max: ${current.maxWidth}) overlaps with ${next.name} (min: ${next.minWidth})`
            );
            analysis.compatibilityScore -= 5;
          }
        }
      }

      // Check for missing default
      if (this.config.defaultBreakpoint && !this.isValidBreakpoint(this.config.defaultBreakpoint)) {
        analysis.missingDefaults.push(
          `Default breakpoint '${this.config.defaultBreakpoint}' not found`
        );
        analysis.compatibilityScore -= 15;
        analysis.isValid = false;
      }

      // Generate recommendations
      if (analysis.enabledBreakpoints < 3) {
        analysis.recommendations.push(
          'Consider enabling more breakpoints for better responsive design'
        );
      }

      if (analysis.enabledBreakpoints > 7) {
        analysis.recommendations.push('Consider reducing breakpoints to improve performance');
      }

      if (analysis.orderConflicts.length > 0) {
        analysis.recommendations.push('Resolve order conflicts to ensure predictable behavior');
      }

      this.cache.set(cacheKey, analysis);
      return analysis;
    } finally {
      this.perfMonitor.endMeasurement('analyzeBreakpoints');
    }
  }

  /**
   * Add custom breakpoint at runtime
   */
  public addCustomBreakpoint(breakpoint: BreakpointDefinition): boolean {
    if (!this.config.extensibility.allowCustomBreakpoints) {
      return false;
    }

    if (!this.config.extensibility.allowRuntimeModification) {
      return false;
    }

    try {
      // Validate breakpoint
      const validated = BreakpointDefinitionSchema.parse(breakpoint);

      // Check for conflicts
      if (this.breakpointMap.has(validated.name)) {
        return false;
      }

      // Add to maps
      this.breakpointMap.set(validated.name, validated);
      for (const alias of validated.alias) {
        if (!this.aliasMap.has(alias)) {
          this.aliasMap.set(alias, validated.name);
        }
      }

      // Clear cache
      this.cache.clear();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove custom breakpoint
   */
  public removeCustomBreakpoint(name: string): boolean {
    if (!this.config.extensibility.allowRuntimeModification) {
      return false;
    }

    const breakpoint = this.breakpointMap.get(name);
    if (!breakpoint || breakpoint.metadata?.type === 'standard') {
      return false;
    }

    // Remove from maps
    this.breakpointMap.delete(name);
    for (const alias of breakpoint.alias) {
      this.aliasMap.delete(alias);
    }

    // Clear cache
    this.cache.clear();

    return true;
  }

  /**
   * Resolve breakpoint conflicts and provide fallbacks
   */
  public resolveBreakpoints(requestedBreakpoints: string[]): BreakpointResolution {
    const resolution: BreakpointResolution = {
      resolved: [],
      conflicts: [],
      warnings: [],
      fallbacks: [],
    };

    for (const requested of requestedBreakpoints) {
      const breakpoint = this.getBreakpoint(requested);

      if (!breakpoint) {
        resolution.conflicts.push(`Unknown breakpoint: ${requested}`);

        // Try to find fallback
        const fallback = this.findFallbackBreakpoint(requested);
        if (fallback) {
          resolution.fallbacks.push(`${requested} -> ${fallback.name}`);
          resolution.resolved.push(fallback);
        }
      } else if (!breakpoint.enabled) {
        resolution.warnings.push(`Breakpoint '${requested}' is disabled`);
      } else {
        resolution.resolved.push(breakpoint);
      }
    }

    return resolution;
  }

  /**
   * Find fallback breakpoint for unknown breakpoint
   */
  private findFallbackBreakpoint(unknownBreakpoint: string): BreakpointDefinition | null {
    // Try to find similar breakpoint by name similarity
    const enabledBreakpoints = this.getBreakpoints();

    // Simple similarity check (starts with same letter)
    const similar = enabledBreakpoints.find(
      (bp) => bp.name[0].toLowerCase() === unknownBreakpoint[0].toLowerCase()
    );

    if (similar) {
      return similar;
    }

    // Fallback to default breakpoint
    if (this.config.defaultBreakpoint) {
      return this.getBreakpoint(this.config.defaultBreakpoint);
    }

    // Last resort: return first enabled breakpoint
    return enabledBreakpoints[0] || null;
  }

  /**
   * Export current configuration
   */
  public exportConfig(): BreakpointConfig {
    return { ...this.config };
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics() {
    return this.perfMonitor.getCurrentMetrics();
  }
}

// ===== FACTORY FUNCTIONS =====

/**
 * Create breakpoint compatibility engine with default Tailwind config
 */
export function createTailwindBreakpointEngine(): BreakpointCompatibilityEngine {
  return new BreakpointCompatibilityEngine({
    breakpoints: DEFAULT_TAILWIND_BREAKPOINTS,
    defaultBreakpoint: 'sm',
    mobileFirst: true,
  });
}

/**
 * Create breakpoint compatibility engine with extended breakpoints
 */
export function createExtendedBreakpointEngine(): BreakpointCompatibilityEngine {
  return new BreakpointCompatibilityEngine({
    breakpoints: EXTENDED_BREAKPOINTS,
    defaultBreakpoint: 'sm',
    mobileFirst: true,
  });
}

/**
 * Create custom breakpoint compatibility engine
 */
export function createCustomBreakpointEngine(
  config: Partial<BreakpointConfig>
): BreakpointCompatibilityEngine {
  return new BreakpointCompatibilityEngine(config);
}

// ===== UTILITY FUNCTIONS =====

/**
 * Validate breakpoint configuration
 */
export function validateBreakpointConfig(config: unknown): config is BreakpointConfig {
  try {
    BreakpointConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create breakpoint definition from simple config
 */
export function createBreakpointDefinition(
  name: string,
  minWidth: number,
  order: number,
  options?: Partial<Omit<BreakpointDefinition, 'name' | 'minWidth' | 'order'>>
): BreakpointDefinition {
  return BreakpointDefinitionSchema.parse({
    name,
    minWidth,
    order,
    enabled: true,
    alias: [],
    ...options,
  });
}

/**
 * Migrate legacy breakpoint names to new system
 */
export function migrateBreakpointNames(
  classNames: string[],
  engine: BreakpointCompatibilityEngine
): { migrated: string[]; warnings: string[] } {
  const migrated: string[] = [];
  const warnings: string[] = [];

  for (const className of classNames) {
    const breakpointMatch = className.match(/^([^:]+):(.*)/);

    if (!breakpointMatch) {
      migrated.push(className);
      continue;
    }

    const [, breakpointPart, rest] = breakpointMatch;

    if (engine.isValidBreakpoint(breakpointPart)) {
      migrated.push(className);
    } else {
      warnings.push(`Unknown breakpoint '${breakpointPart}' in '${className}'`);

      // Try to resolve to a fallback
      const resolution = engine.resolveBreakpoints([breakpointPart]);
      if (resolution.resolved.length > 0) {
        const fallback = resolution.resolved[0];
        migrated.push(`${fallback.name}:${rest}`);
        warnings.push(`Migrated '${breakpointPart}' to '${fallback.name}'`);
      } else {
        migrated.push(className); // Keep original if no fallback
      }
    }
  }

  return { migrated, warnings };
}

// Export the default engine instance
export const defaultBreakpointEngine = createTailwindBreakpointEngine();
