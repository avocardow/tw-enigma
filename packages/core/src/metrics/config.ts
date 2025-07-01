/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

/**
 * Verbosity levels for metrics collection and reporting
 */
export enum VerbosityLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
}

/**
 * Metrics categories for selective enablement
 */
export enum MetricsCategory {
  PERFORMANCE = 'performance',
  QUALITY = 'quality',
  OPTIMIZATION = 'optimization',
  SYSTEM = 'system',
  USER = 'user',
  CUSTOM = 'custom',
}

/**
 * Configuration for metric collection behavior
 */
export const MetricsConfigSchema = z.object({
  // Global settings
  enabled: z.boolean().default(true),
  verbosity: z.nativeEnum(VerbosityLevel).default(VerbosityLevel.INFO),

  // Collection settings
  collection: z
    .object({
      bufferSize: z.number().min(1).max(100000).default(1000),
      flushInterval: z.number().min(100).max(300000).default(30000), // ms
      maxBufferAge: z.number().min(1000).max(3600000).default(60000), // ms
      autoFlush: z.boolean().default(true),
      enableSampling: z.boolean().default(false),
      samplingRate: z.number().min(0).max(1).default(0.1),
    })
    .default({}),

  // Category-specific enablement
  categories: z
    .object({
      performance: z.boolean().default(true),
      quality: z.boolean().default(true),
      optimization: z.boolean().default(true),
      system: z.boolean().default(true),
      user: z.boolean().default(false),
      custom: z.boolean().default(true),
    })
    .default({}),

  // Aggregation settings
  aggregation: z
    .object({
      enabled: z.boolean().default(true),
      strategy: z
        .enum(['sum', 'average', 'weighted_average', 'median', 'p95', 'p99'])
        .default('average'),
      windowSize: z.number().min(1000).max(3600000).default(300000), // 5 minutes
      resolution: z.number().min(1000).max(60000).default(5000), // 5 seconds
    })
    .default({}),

  // Storage settings
  storage: z
    .object({
      type: z.enum(['memory', 'file', 'database', 'redis', 'elasticsearch']).default('memory'),
      connectionString: z.string().optional(),
      retentionPeriod: z
        .number()
        .min(3600000)
        .max(365 * 24 * 3600000)
        .default(7 * 24 * 3600000), // 7 days
      compression: z.boolean().default(true),
      encryption: z.boolean().default(false),
    })
    .default({}),

  // Export settings
  export: z
    .object({
      enabled: z.boolean().default(false),
      formats: z.array(z.enum(['json', 'csv', 'prometheus', 'influxdb'])).default(['json']),
      interval: z.number().min(5000).max(86400000).default(60000), // 1 minute
      endpoints: z.array(z.string().url()).default([]),
      batchSize: z.number().min(1).max(10000).default(100),
    })
    .default({}),

  // Reporting settings
  reporting: z
    .object({
      enabled: z.boolean().default(true),
      defaultFormat: z.enum(['json', 'human', 'csv', 'markdown', 'html']).default('human'),
      includeMetadata: z.boolean().default(true),
      includeTimestamps: z.boolean().default(true),
      includeTags: z.boolean().default(true),
      colorOutput: z.boolean().default(true),
      verbosity: z.enum(['minimal', 'standard', 'detailed', 'verbose']).default('standard'),
    })
    .default({}),

  // Performance settings
  performance: z
    .object({
      enableHighResolution: z.boolean().default(true),
      trackMemoryUsage: z.boolean().default(true),
      trackCpuUsage: z.boolean().default(true),
      trackGcMetrics: z.boolean().default(false),
      operationTimeoutMs: z.number().min(100).max(300000).default(30000),
    })
    .default({}),

  // Quality monitoring settings
  quality: z
    .object({
      enableAutomaticAssessment: z.boolean().default(true),
      enableAlerting: z.boolean().default(true),
      thresholds: z
        .object({
          minAccuracy: z.number().min(0).max(1).default(0.95),
          minPrecision: z.number().min(0).max(1).default(0.9),
          minRecall: z.number().min(0).max(1).default(0.85),
          maxErrorRate: z.number().min(0).max(1).default(0.05),
          minF1Score: z.number().min(0).max(1).default(0.9),
        })
        .default({}),
      alertChannels: z.array(z.enum(['console', 'email', 'webhook', 'slack'])).default(['console']),
    })
    .default({}),

  // Debug and development settings
  debug: z
    .object({
      enabled: z.boolean().default(false),
      logLevel: z.nativeEnum(VerbosityLevel).default(VerbosityLevel.INFO),
      enableStackTraces: z.boolean().default(false),
      enableTimingDetails: z.boolean().default(false),
      logToFile: z.boolean().default(false),
      logFilePath: z.string().default('./metrics-debug.log'),
    })
    .default({}),

  // Real-time processing
  processors: z
    .array(
      z.object({
        name: z.string(),
        enabled: z.boolean().default(true),
        type: z.enum(['aggregator', 'filter', 'transformer', 'validator', 'alerter']),
        config: z.record(z.unknown()).default({}),
        priority: z.number().min(0).max(100).default(50),
      })
    )
    .default([]),

  // Runtime configuration
  runtime: z
    .object({
      allowDynamicReconfiguration: z.boolean().default(true),
      configReloadInterval: z.number().min(5000).max(3600000).default(60000), // 1 minute
      enableConfigValidation: z.boolean().default(true),
      enableConfigBackup: z.boolean().default(true),
      maxConfigHistory: z.number().min(1).max(100).default(10),
    })
    .default({}),
});

export type MetricsConfig = z.infer<typeof MetricsConfigSchema>;

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  timestamp: Date;
  changes: Partial<MetricsConfig>;
  previousConfig: MetricsConfig;
  newConfig: MetricsConfig;
  source: 'api' | 'file' | 'environment' | 'default';
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Centralized configuration manager for the metrics system
 */
export class MetricsConfigManager extends EventEmitter {
  private config: MetricsConfig;
  private configHistory: Array<{ timestamp: Date; config: MetricsConfig; source: string }> = [];
  private watchers: Map<string, (config: MetricsConfig) => void> = new Map();
  private reloadTimer?: NodeJS.Timeout;

  constructor(initialConfig: Partial<MetricsConfig> = {}) {
    super();
    this.config = this.parseAndValidateConfig(initialConfig);
    this.addToHistory(this.config, 'constructor');

    if (this.config.runtime.allowDynamicReconfiguration) {
      this.startConfigReloader();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): MetricsConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Update configuration with partial updates
   */
  public updateConfig(
    updates: Partial<MetricsConfig>,
    source: 'api' | 'file' | 'environment' = 'api'
  ): ConfigValidationResult {
    const previousConfig = this.getConfig();

    try {
      // Merge with existing config
      const newConfig = this.mergeConfigs(this.config, updates);

      // Validate new configuration
      const validationResult = this.validateConfig(newConfig);

      if (!validationResult.valid) {
        return validationResult;
      }

      // Apply configuration
      this.config = newConfig;
      this.addToHistory(this.config, source);

      // Emit change event
      const changeEvent: ConfigChangeEvent = {
        timestamp: new Date(),
        changes: updates,
        previousConfig,
        newConfig: this.config,
        source,
      };

      this.emit('configChanged', changeEvent);
      this.notifyWatchers();

      return {
        valid: true,
        errors: [],
        warnings: validationResult.warnings,
        suggestions: validationResult.suggestions,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Configuration update failed: ${error}`],
        warnings: [],
        suggestions: ['Check configuration syntax and try again'],
      };
    }
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): void {
    const defaultConfig = MetricsConfigSchema.parse({});
    this.updateConfig(defaultConfig, 'api');
  }

  /**
   * Load configuration from file
   */
  public async loadFromFile(filePath: string): Promise<ConfigValidationResult> {
    try {
      const fs = await import('fs/promises');
      const configData = await fs.readFile(filePath, 'utf-8');
      const parsedConfig = JSON.parse(configData);

      return this.updateConfig(parsedConfig, 'file');
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to load configuration from file: ${error}`],
        warnings: [],
        suggestions: ['Check file path and format'],
      };
    }
  }

  /**
   * Save configuration to file
   */
  public async saveToFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const configJson = JSON.stringify(this.config, null, 2);
      await fs.writeFile(filePath, configJson, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  public loadFromEnvironment(prefix = 'TW_ENIGMA_METRICS_'): ConfigValidationResult {
    try {
      const envConfig: any = {};

      // Map environment variables to config structure
      Object.keys(process.env).forEach((key) => {
        if (key.startsWith(prefix)) {
          const configKey = key.slice(prefix.length).toLowerCase();
          const value = process.env[key];

          if (value !== undefined) {
            this.setNestedValue(envConfig, configKey, this.parseEnvValue(value));
          }
        }
      });

      return this.updateConfig(envConfig, 'environment');
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to load environment configuration: ${error}`],
        warnings: [],
        suggestions: ['Check environment variable format'],
      };
    }
  }

  /**
   * Get configuration for specific category
   */
  public getCategoryConfig(category: MetricsCategory): boolean {
    return this.config.categories[category] ?? false;
  }

  /**
   * Enable/disable specific category
   */
  public setCategoryEnabled(category: MetricsCategory, enabled: boolean): void {
    this.updateConfig({
      categories: {
        ...this.config.categories,
        [category]: enabled,
      },
    });
  }

  /**
   * Get verbosity level
   */
  public getVerbosity(): VerbosityLevel {
    return this.config.verbosity;
  }

  /**
   * Set verbosity level
   */
  public setVerbosity(level: VerbosityLevel): void {
    this.updateConfig({ verbosity: level });
  }

  /**
   * Check if verbosity level is sufficient for logging
   */
  public shouldLog(level: VerbosityLevel): boolean {
    return level <= this.config.verbosity;
  }

  /**
   * Watch for configuration changes
   */
  public watchConfig(watcherId: string, callback: (config: MetricsConfig) => void): void {
    this.watchers.set(watcherId, callback);
  }

  /**
   * Stop watching configuration changes
   */
  public unwatchConfig(watcherId: string): void {
    this.watchers.delete(watcherId);
  }

  /**
   * Get configuration history
   */
  public getConfigHistory(): Array<{ timestamp: Date; config: MetricsConfig; source: string }> {
    return [...this.configHistory];
  }

  /**
   * Validate configuration
   */
  public validateConfig(config: unknown): ConfigValidationResult {
    try {
      MetricsConfigSchema.parse(config);

      const warnings: string[] = [];
      const suggestions: string[] = [];

      // Additional validation logic
      const cfg = config as MetricsConfig;

      // Check for potential performance issues
      if (cfg.collection.bufferSize > 10000) {
        warnings.push('Large buffer size may impact memory usage');
        suggestions.push('Consider reducing buffer size or enabling auto-flush');
      }

      if (cfg.collection.flushInterval < 1000) {
        warnings.push('Very frequent flushing may impact performance');
        suggestions.push('Consider increasing flush interval');
      }

      // Check for conflicting settings
      if (
        !cfg.collection.autoFlush &&
        cfg.collection.maxBufferAge > cfg.collection.flushInterval * 10
      ) {
        warnings.push('Buffer age is much larger than flush interval with auto-flush disabled');
        suggestions.push('Enable auto-flush or adjust timing settings');
      }

      return {
        valid: true,
        errors: [],
        warnings,
        suggestions,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
          warnings: [],
          suggestions: ['Check configuration schema documentation'],
        };
      }

      return {
        valid: false,
        errors: [`Configuration validation failed: ${error}`],
        warnings: [],
        suggestions: ['Check configuration format'],
      };
    }
  }

  /**
   * Get configuration schema
   */
  public getSchema(): typeof MetricsConfigSchema {
    return MetricsConfigSchema;
  }

  /**
   * Export configuration as JSON
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  public importConfig(json: string): ConfigValidationResult {
    try {
      const config = JSON.parse(json);
      return this.updateConfig(config, 'api');
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to parse configuration JSON: ${error}`],
        warnings: [],
        suggestions: ['Check JSON syntax'],
      };
    }
  }

  /**
   * Stop configuration manager
   */
  public stop(): void {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = undefined;
    }
    this.watchers.clear();
    this.removeAllListeners();
  }

  /**
   * Parse and validate initial configuration
   */
  private parseAndValidateConfig(config: Partial<MetricsConfig>): MetricsConfig {
    const validationResult = this.validateConfig(config);

    if (!validationResult.valid) {
      console.warn('Configuration validation failed, using defaults:', validationResult.errors);
    }

    return MetricsConfigSchema.parse(config);
  }

  /**
   * Merge configurations deeply
   */
  private mergeConfigs(base: MetricsConfig, updates: Partial<MetricsConfig>): MetricsConfig {
    const merged = JSON.parse(JSON.stringify(base));

    const merge = (target: any, source: any): void => {
      Object.keys(source).forEach((key) => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      });
    };

    merge(merged, updates);
    return MetricsConfigSchema.parse(merged);
  }

  /**
   * Add configuration to history
   */
  private addToHistory(config: MetricsConfig, source: string): void {
    this.configHistory.push({
      timestamp: new Date(),
      config: JSON.parse(JSON.stringify(config)),
      source,
    });

    // Keep history size within limits
    if (this.configHistory.length > this.config.runtime.maxConfigHistory) {
      this.configHistory.shift();
    }
  }

  /**
   * Notify all watchers of configuration changes
   */
  private notifyWatchers(): void {
    const config = this.getConfig();
    this.watchers.forEach((callback) => {
      try {
        callback(config);
      } catch (error) {
        console.error('Error in config watcher:', error);
      }
    });
  }

  /**
   * Start configuration reloader
   */
  private startConfigReloader(): void {
    if (this.reloadTimer) return;

    this.reloadTimer = setInterval(() => {
      this.emit('configReloadCheck');
    }, this.config.runtime.configReloadInterval);
  }

  /**
   * Parse environment variable value
   */
  private parseEnvValue(value: string): any {
    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // Fall back to string
      return value;
    }
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('_');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }
}

/**
 * Create metrics configuration manager
 */
export function createMetricsConfigManager(
  config: Partial<MetricsConfig> = {}
): MetricsConfigManager {
  return new MetricsConfigManager(config);
}

/**
 * Validate metrics configuration
 */
export function validateMetricsConfig(config: unknown): ConfigValidationResult {
  const manager = new MetricsConfigManager();
  return manager.validateConfig(config);
}

/**
 * Get default metrics configuration
 */
export function getDefaultMetricsConfig(): MetricsConfig {
  return MetricsConfigSchema.parse({});
}

/**
 * Configuration presets for common scenarios
 */
export const ConfigPresets = {
  /**
   * Development configuration with verbose logging
   */
  development: (): Partial<MetricsConfig> => ({
    verbosity: VerbosityLevel.DEBUG,
    debug: {
      enabled: true,
      logLevel: VerbosityLevel.DEBUG,
      enableStackTraces: true,
      enableTimingDetails: true,
    },
    collection: {
      bufferSize: 100,
      flushInterval: 5000,
    },
    reporting: {
      verbosity: 'verbose',
      colorOutput: true,
    },
  }),

  /**
   * Production configuration optimized for performance
   */
  production: (): Partial<MetricsConfig> => ({
    verbosity: VerbosityLevel.WARN,
    debug: {
      enabled: false,
    },
    collection: {
      bufferSize: 5000,
      flushInterval: 30000,
      enableSampling: true,
      samplingRate: 0.1,
    },
    storage: {
      type: 'database',
      retentionPeriod: 30 * 24 * 3600000, // 30 days
      compression: true,
    },
    export: {
      enabled: true,
      formats: ['prometheus'],
      interval: 60000,
    },
  }),

  /**
   * Testing configuration with minimal overhead
   */
  testing: (): Partial<MetricsConfig> => ({
    verbosity: VerbosityLevel.ERROR,
    enabled: false,
    collection: {
      bufferSize: 10,
      flushInterval: 1000,
    },
    storage: {
      type: 'memory',
    },
    export: {
      enabled: false,
    },
  }),

  /**
   * High-performance configuration for heavy workloads
   */
  highPerformance: (): Partial<MetricsConfig> => ({
    verbosity: VerbosityLevel.ERROR,
    collection: {
      bufferSize: 10000,
      flushInterval: 60000,
      enableSampling: true,
      samplingRate: 0.05,
    },
    aggregation: {
      enabled: true,
      strategy: 'average',
      windowSize: 600000, // 10 minutes
    },
    categories: {
      performance: true,
      quality: false,
      optimization: true,
      system: false,
      user: false,
      custom: false,
    },
  }),
};
