/**
 * Order Handling Configuration System
 *
 * Provides comprehensive configuration management for CSS order dependency
 * handling with validation, presets, and dynamic updates.
 */

import { DEFAULT_ORDER_CONFIG } from './constants';
import { ConflictType, OrderHandlingOptions, ReportFormat, StrictnessLevel } from './types';

/**
 * Configuration validation errors
 */
export class ConfigurationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Configuration presets for different use cases
 */
export const CONFIGURATION_PRESETS = {
  STRICT: {
    strictness: 'strict' as StrictnessLevel,
    enableDependencyDetection: true,
    enableAutoResolution: false,
    enableCaching: true,
    enableParallelProcessing: true,
    maxProcessingTime: 30000,
    cacheSize: 1000,
    reportFormat: [ReportFormat.CONSOLE, ReportFormat.JSON],
    ignoredProperties: [],
    preserveOrderSelectors: ['*:hover', '*:focus', '*:active'],
    suppressWarningTypes: [],
    escalateWarningTypes: [ConflictType.CIRCULAR_DEPENDENCY, ConflictType.ORDER_VIOLATION],
    enableSpecificityDetection: true,
    enableCascadeDetection: true,
    enableOrderDetection: true,
    enableInheritanceDetection: true,
    enableResetDetection: true,
    enableFallbackDetection: true,
    specificityThreshold: 100,
    dependencyThreshold: 0.8,
    performanceTracking: true,
  },

  BALANCED: {
    strictness: 'balanced' as StrictnessLevel,
    enableDependencyDetection: true,
    enableAutoResolution: true,
    enableCaching: true,
    enableParallelProcessing: true,
    maxProcessingTime: 15000,
    cacheSize: 500,
    reportFormat: [ReportFormat.CONSOLE],
    ignoredProperties: ['z-index'],
    preserveOrderSelectors: ['*:hover', '*:focus'],
    suppressWarningTypes: [ConflictType.CASCADE_INTERFERENCE],
    escalateWarningTypes: [ConflictType.CIRCULAR_DEPENDENCY],
    enableSpecificityDetection: true,
    enableCascadeDetection: true,
    enableOrderDetection: true,
    enableInheritanceDetection: false,
    enableResetDetection: true,
    enableFallbackDetection: false,
    specificityThreshold: 50,
    dependencyThreshold: 0.6,
    performanceTracking: true,
  },

  PERMISSIVE: {
    strictness: 'permissive' as StrictnessLevel,
    enableDependencyDetection: true,
    enableAutoResolution: true,
    enableCaching: true,
    enableParallelProcessing: true,
    maxProcessingTime: 5000,
    cacheSize: 200,
    reportFormat: [ReportFormat.CONSOLE],
    ignoredProperties: ['z-index', 'position'],
    preserveOrderSelectors: [],
    suppressWarningTypes: [ConflictType.CASCADE_INTERFERENCE, ConflictType.INHERITANCE],
    escalateWarningTypes: [],
    enableSpecificityDetection: true,
    enableCascadeDetection: false,
    enableOrderDetection: false,
    enableInheritanceDetection: false,
    enableResetDetection: false,
    enableFallbackDetection: false,
    specificityThreshold: 20,
    dependencyThreshold: 0.4,
    performanceTracking: false,
  },

  PRESERVE_ALL: {
    strictness: 'preserve-all' as StrictnessLevel,
    enableDependencyDetection: false,
    enableAutoResolution: false,
    enableCaching: false,
    enableParallelProcessing: false,
    maxProcessingTime: 1000,
    cacheSize: 0,
    reportFormat: [ReportFormat.JSON],
    ignoredProperties: [],
    preserveOrderSelectors: ['*'],
    suppressWarningTypes: [],
    escalateWarningTypes: [],
    enableSpecificityDetection: false,
    enableCascadeDetection: false,
    enableOrderDetection: false,
    enableInheritanceDetection: false,
    enableResetDetection: false,
    enableFallbackDetection: false,
    specificityThreshold: 0,
    dependencyThreshold: 1.0,
    performanceTracking: false,
  },
} as const;

/**
 * Configuration management system
 */
export class OrderHandlingConfig {
  private options: OrderHandlingOptions;
  private changeListeners: ((config: OrderHandlingOptions) => void)[];

  constructor(options: Partial<OrderHandlingOptions> = {}) {
    this.options = { ...DEFAULT_ORDER_CONFIG };
    this.changeListeners = [];
    this.updateConfig(options);
  }

  /**
   * Get current configuration
   */
  public getConfig(): OrderHandlingOptions {
    return { ...this.options };
  }

  /**
   * Update configuration with validation
   */
  public updateConfig(updates: Partial<OrderHandlingOptions>): void {
    this.validateUpdates(updates);

    const previousConfig = { ...this.options };
    this.options = { ...this.options, ...updates };
    this.notifyListeners(previousConfig);
  }

  /**
   * Set strictness level
   */
  public setStrictness(level: StrictnessLevel): void {
    this.updateConfig({ strictness: level });
  }

  /**
   * Add configuration change listener
   */
  public addChangeListener(listener: (config: OrderHandlingOptions) => void): () => void {
    this.changeListeners.push(listener);

    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Reset to default configuration
   */
  public reset(): void {
    this.updateConfig(DEFAULT_ORDER_CONFIG);
  }

  /**
   * Export configuration as JSON
   */
  public exportConfig(): string {
    return JSON.stringify(this.options, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  public importConfig(jsonConfig: string): void {
    try {
      const config = JSON.parse(jsonConfig);
      this.updateConfig(config);
    } catch (error) {
      throw new ConfigurationError(
        `Failed to parse configuration JSON: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get configuration statistics
   */
  public getStats(): {
    strictnessLevel: StrictnessLevel;
    enabledFeatures: string[];
  } {
    const enabledFeatures: string[] = [];

    if (this.options.enableDependencyDetection) enabledFeatures.push('Dependency Detection');
    if (this.options.enableAutoResolution) enabledFeatures.push('Auto Resolution');
    if (this.options.enableCaching) enabledFeatures.push('Caching');
    if (this.options.enableParallelProcessing) enabledFeatures.push('Parallel Processing');

    return {
      strictnessLevel: this.options.strictness,
      enabledFeatures,
    };
  }

  /**
   * Validate configuration updates
   */
  private validateUpdates(updates: Partial<OrderHandlingOptions>): void {
    const errors: string[] = [];

    if (updates.maxProcessingTime !== undefined) {
      if (typeof updates.maxProcessingTime !== 'number' || updates.maxProcessingTime <= 0) {
        errors.push('maxProcessingTime must be a positive number');
      }
    }

    if (updates.cacheSize !== undefined) {
      if (typeof updates.cacheSize !== 'number' || updates.cacheSize < 0) {
        errors.push('cacheSize must be a non-negative number');
      }
    }

    if (updates.strictness !== undefined) {
      if (!['strict', 'balanced', 'permissive', 'preserve-all'].includes(updates.strictness)) {
        errors.push('strictness must be one of: strict, balanced, permissive, preserve-all');
      }
    }

    if (errors.length > 0) {
      throw new ConfigurationError(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Notify configuration change listeners
   */
  private notifyListeners(previousConfig: OrderHandlingOptions): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(this.options);
      } catch (error) {
        console.error('Configuration change listener error:', error);
      }
    });
  }
}

/**
 * Factory function for creating configuration instances
 */
export function createOrderHandlingConfig(
  options?: Partial<OrderHandlingOptions> | keyof typeof CONFIGURATION_PRESETS
): OrderHandlingConfig {
  if (typeof options === 'string') {
    const config = new OrderHandlingConfig();
    config.updateConfig(CONFIGURATION_PRESETS[options]);
    return config;
  }

  return new OrderHandlingConfig(options);
}

/**
 * Configuration validation utility
 */
export function validateOrderHandlingConfig(config: any): { isValid: boolean; errors: string[] } {
  const tempConfig = new OrderHandlingConfig();

  try {
    tempConfig.updateConfig(config);
    return { isValid: true, errors: [] };
  } catch (error) {
    return {
      isValid: false,
      errors: [(error as ConfigurationError).message],
    };
  }
}
