/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';
import { z } from 'zod';

/**
 * Configuration source types
 */
export enum ConfigSource {
  DEFAULT = 'default',
  FILE = 'file',
  ENVIRONMENT = 'environment',
  PROGRAMMATIC = 'programmatic',
  RUNTIME = 'runtime',
}

/**
 * Configuration precedence (higher number = higher priority)
 */
const CONFIG_PRECEDENCE = {
  [ConfigSource.DEFAULT]: 0,
  [ConfigSource.FILE]: 1,
  [ConfigSource.ENVIRONMENT]: 2,
  [ConfigSource.PROGRAMMATIC]: 3,
  [ConfigSource.RUNTIME]: 4,
};

/**
 * Multi-pass discovery configuration schema
 */
export const MultiPassConfigSchema = z.object({
  maxPasses: z.number().min(1).max(100).default(10),
  convergenceThreshold: z.number().min(0).max(1).default(0.05),
  minIterations: z.number().min(1).default(2),
  adaptiveThreshold: z.boolean().default(true),
  earlyStoppingEnabled: z.boolean().default(true),
  oscillationDetection: z.boolean().default(true),
  qualityAssurance: z.boolean().default(true),
});

/**
 * Performance optimization configuration schema
 */
export const PerformanceConfigSchema = z.object({
  enableParallelProcessing: z.boolean().default(false),
  maxWorkers: z.number().min(1).max(32).default(4),
  chunkSize: z.number().min(100).max(10000).default(1000),
  memoryLimit: z.number().min(100).default(512), // MB
  enableLazyLoading: z.boolean().default(true),
  cacheEnabled: z.boolean().default(true),
  cacheSize: z.number().min(10).max(10000).default(1000),
  enableCompression: z.boolean().default(false),
  batchProcessing: z.boolean().default(true),
  resourceMonitoring: z.boolean().default(true),
});

/**
 * State management configuration schema
 */
export const StateConfigSchema = z.object({
  enableCheckpointing: z.boolean().default(false),
  checkpointInterval: z.number().min(1).default(5),
  maxCheckpoints: z.number().min(1).max(100).default(10),
  checkpointDirectory: z.string().default('./.tw-enigma/checkpoints'),
  enableCompression: z.boolean().default(true),
  autoRestore: z.boolean().default(true),
  backupEnabled: z.boolean().default(true),
  atomicWrites: z.boolean().default(true),
  checksumValidation: z.boolean().default(true),
  encryptionEnabled: z.boolean().default(false),
  encryptionKey: z.string().optional(),
});

/**
 * Metrics tracking configuration schema
 */
export const MetricsConfigSchema = z.object({
  enableCollection: z.boolean().default(true),
  enableReporting: z.boolean().default(true),
  reportingInterval: z.number().min(1).default(1),
  enableDetailedMetrics: z.boolean().default(false),
  enableExport: z.boolean().default(false),
  exportFormat: z.enum(['json', 'csv', 'yaml']).default('json'),
  exportDirectory: z.string().default('./.tw-enigma/metrics'),
  enableRealTimeTracking: z.boolean().default(true),
  enableAggregation: z.boolean().default(true),
  retentionPeriod: z.number().min(1).default(30), // days
  enableAlerting: z.boolean().default(false),
  alertThresholds: z
    .object({
      memoryUsage: z.number().min(0).max(100).default(80),
      processingTime: z.number().min(0).default(300), // seconds
      errorRate: z.number().min(0).max(100).default(5),
    })
    .default({}),
});

/**
 * Integration configuration schema
 */
export const IntegrationConfigSchema = z.object({
  enableRestApi: z.boolean().default(false),
  restApiPort: z.number().min(1000).max(65535).default(3000),
  restApiHost: z.string().default('localhost'),
  enableGrpcApi: z.boolean().default(false),
  grpcPort: z.number().min(1000).max(65535).default(50051),
  grpcHost: z.string().default('localhost'),
  enableDirectLibrary: z.boolean().default(true),
  requestTimeout: z.number().min(1000).default(30000), // ms
  maxConcurrentRequests: z.number().min(1).max(1000).default(100),
  enableRequestLogging: z.boolean().default(true),
  enableRateLimiting: z.boolean().default(false),
  rateLimit: z.number().min(1).default(100),
  enableCaching: z.boolean().default(false),
  cacheExpiration: z.number().min(1).default(3600), // seconds
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  enableConsole: z.boolean().default(true),
  enableFile: z.boolean().default(false),
  logDirectory: z.string().default('./.tw-enigma/logs'),
  maxFileSize: z.number().min(1).default(10), // MB
  maxFiles: z.number().min(1).default(5),
  enableColors: z.boolean().default(true),
  enableTimestamps: z.boolean().default(true),
  enableStackTraces: z.boolean().default(false),
  format: z.enum(['json', 'text']).default('text'),
  enableStructuredLogging: z.boolean().default(false),
});

/**
 * Complete configuration schema
 */
export const FullConfigSchema = z.object({
  multiPass: MultiPassConfigSchema.default({}),
  performance: PerformanceConfigSchema.default({}),
  state: StateConfigSchema.default({}),
  metrics: MetricsConfigSchema.default({}),
  integration: IntegrationConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  environment: z.enum(['development', 'production', 'test']).default('development'),
  debug: z.boolean().default(false),
  version: z.string().default('1.0.0'),
});

export type FullConfig = z.infer<typeof FullConfigSchema>;
export type MultiPassConfig = z.infer<typeof MultiPassConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type StateConfig = z.infer<typeof StateConfigSchema>;
export type MetricsConfig = z.infer<typeof MetricsConfigSchema>;
export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

/**
 * Configuration value with metadata
 */
interface ConfigValue {
  value: any;
  source: ConfigSource;
  timestamp: Date;
  readonly: boolean;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  path: string;
  oldValue: any;
  newValue: any;
  source: ConfigSource;
  timestamp: Date;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  path?: string;
}

/**
 * Configuration file format
 */
export enum ConfigFormat {
  JSON = 'json',
  YAML = 'yaml',
  YML = 'yml',
}

/**
 * Configuration manager options
 */
export interface ConfigManagerOptions {
  enableEnvironmentVariables?: boolean;
  environmentPrefix?: string;
  enableFileWatching?: boolean;
  enableValidation?: boolean;
  enableChangeEvents?: boolean;
  defaultConfigPaths?: string[];
  allowDynamicReconfiguration?: boolean;
}

/**
 * Comprehensive configuration manager
 */
export class ConfigurationManager {
  private config: Map<string, ConfigValue> = new Map();
  private listeners: Map<string, Array<(event: ConfigChangeEvent) => void>> = new Map();
  private fileWatchers: Map<string, fs.FileHandle | null> = new Map();
  private options: Required<ConfigManagerOptions>;
  private validationSchema: z.ZodSchema = FullConfigSchema;

  constructor(options: ConfigManagerOptions = {}) {
    this.options = {
      enableEnvironmentVariables: true,
      environmentPrefix: 'TW_ENIGMA_',
      enableFileWatching: false,
      enableValidation: true,
      enableChangeEvents: true,
      defaultConfigPaths: [
        './tw-enigma.config.json',
        './tw-enigma.config.yaml',
        './tw-enigma.config.yml',
        './.tw-enigma/config.json',
        './.tw-enigma/config.yaml',
      ],
      allowDynamicReconfiguration: true,
      ...options,
    };

    // Initialize with default configuration
    this.initializeDefaults();
  }

  /**
   * Initialize default configuration
   */
  private initializeDefaults(): void {
    const defaults = FullConfigSchema.parse({});
    this.setConfigFromObject(defaults, ConfigSource.DEFAULT, true);
  }

  /**
   * Load configuration from multiple sources
   */
  public async loadConfiguration(): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. Load from default config files
      for (const configPath of this.options.defaultConfigPaths) {
        try {
          await this.loadFromFile(configPath);
          break; // Use first found config file
        } catch (error) {
          // Continue to next config path
        }
      }

      // 2. Load from environment variables
      if (this.options.enableEnvironmentVariables) {
        this.loadFromEnvironment();
      }

      // 3. Validate final configuration
      if (this.options.enableValidation) {
        const validation = this.validateConfiguration();
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        isValid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Load configuration from file
   */
  public async loadFromFile(filePath: string): Promise<void> {
    try {
      const resolvedPath = path.resolve(filePath);
      const fileContent = await fs.readFile(resolvedPath, 'utf-8');
      const format = this.detectFileFormat(resolvedPath);

      let configData: any;
      switch (format) {
        case ConfigFormat.JSON:
          configData = JSON.parse(fileContent);
          break;
        case ConfigFormat.YAML:
        case ConfigFormat.YML:
          configData = yaml.load(fileContent);
          break;
        default:
          throw new Error(`Unsupported config file format: ${format}`);
      }

      this.setConfigFromObject(configData, ConfigSource.FILE, false);

      // Enable file watching if requested
      if (this.options.enableFileWatching) {
        this.watchConfigFile(resolvedPath);
      }
    } catch (error) {
      throw new Error(
        `Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    const envConfig: any = {};
    const prefix = this.options.environmentPrefix;

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        const configPath = this.convertEnvKeyToPath(configKey);
        this.setNestedValue(envConfig, configPath, this.parseEnvValue(value || ''));
      }
    }

    if (Object.keys(envConfig).length > 0) {
      this.setConfigFromObject(envConfig, ConfigSource.ENVIRONMENT, false);
    }
  }

  /**
   * Set configuration from object
   */
  private setConfigFromObject(obj: any, source: ConfigSource, readonly: boolean): void {
    const flatConfig = this.flattenObject(obj);
    for (const [key, value] of Object.entries(flatConfig)) {
      this.setConfigValue(key, value, source, readonly);
    }
  }

  /**
   * Set individual configuration value
   */
  public setConfigValue(
    path: string,
    value: any,
    source: ConfigSource = ConfigSource.PROGRAMMATIC,
    readonly: boolean = false
  ): boolean {
    const existing = this.config.get(path);

    // Check if existing value is readonly
    if (existing?.readonly && source !== ConfigSource.RUNTIME) {
      return false;
    }

    // Check precedence
    if (existing && CONFIG_PRECEDENCE[existing.source] > CONFIG_PRECEDENCE[source]) {
      return false;
    }

    // Check if dynamic reconfiguration is allowed
    if (existing && !this.options.allowDynamicReconfiguration && source === ConfigSource.RUNTIME) {
      return false;
    }

    const oldValue = existing?.value;
    const newConfigValue: ConfigValue = {
      value,
      source,
      timestamp: new Date(),
      readonly,
    };

    this.config.set(path, newConfigValue);

    // Emit change event
    if (this.options.enableChangeEvents && oldValue !== value) {
      this.emitConfigChange({
        path,
        oldValue,
        newValue: value,
        source,
        timestamp: new Date(),
      });
    }

    return true;
  }

  /**
   * Get configuration value
   */
  public getConfigValue<T = any>(path: string, defaultValue?: T): T {
    const configValue = this.config.get(path);
    return configValue?.value ?? defaultValue;
  }

  /**
   * Get complete configuration object
   */
  public getConfiguration(): FullConfig {
    const flatConfig: any = {};
    for (const [key, configValue] of this.config) {
      this.setNestedValue(flatConfig, key, configValue.value);
    }
    return FullConfigSchema.parse(flatConfig);
  }

  /**
   * Get configuration section
   */
  public getConfigSection<T = any>(section: string): T {
    const sectionPrefix = `${section}.`;
    const sectionConfig: any = {};

    for (const [key, configValue] of this.config) {
      if (key.startsWith(sectionPrefix)) {
        const subKey = key.slice(sectionPrefix.length);
        this.setNestedValue(sectionConfig, subKey, configValue.value);
      }
    }

    return sectionConfig;
  }

  /**
   * Update configuration at runtime
   */
  public updateConfiguration(updates: Partial<FullConfig>): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate updates
      if (this.options.enableValidation) {
        const validation = this.validatePartialConfiguration(updates);
        if (!validation.isValid) {
          return validation;
        }
        warnings.push(...validation.warnings);
      }

      // Apply updates
      const flatUpdates = this.flattenObject(updates);
      for (const [key, value] of Object.entries(flatUpdates)) {
        const success = this.setConfigValue(key, value, ConfigSource.RUNTIME, false);
        if (!success) {
          warnings.push(`Failed to update configuration at path: ${key}`);
        }
      }

      return {
        isValid: true,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(
        `Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        isValid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Validate configuration
   */
  public validateConfiguration(): ConfigValidationResult {
    try {
      const config = this.getConfiguration();
      const result = this.validationSchema.safeParse(config);

      if (result.success) {
        return {
          isValid: true,
          errors: [],
          warnings: [],
        };
      } else {
        return {
          isValid: false,
          errors: result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
          warnings: [],
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate partial configuration
   */
  private validatePartialConfiguration(updates: Partial<FullConfig>): ConfigValidationResult {
    try {
      // Create merged configuration for validation
      const currentConfig = this.getConfiguration();
      const mergedConfig = this.deepMerge(currentConfig, updates);

      const result = this.validationSchema.safeParse(mergedConfig);

      if (result.success) {
        return {
          isValid: true,
          errors: [],
          warnings: [],
        };
      } else {
        return {
          isValid: false,
          errors: result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
          warnings: [],
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  /**
   * Add configuration change listener
   */
  public addChangeListener(path: string, listener: (event: ConfigChangeEvent) => void): void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    this.listeners.get(path)!.push(listener);
  }

  /**
   * Remove configuration change listener
   */
  public removeChangeListener(path: string, listener: (event: ConfigChangeEvent) => void): void {
    const pathListeners = this.listeners.get(path);
    if (pathListeners) {
      const index = pathListeners.indexOf(listener);
      if (index > -1) {
        pathListeners.splice(index, 1);
      }
    }
  }

  /**
   * Export configuration to file
   */
  public async exportConfiguration(
    filePath: string,
    format: ConfigFormat = ConfigFormat.JSON
  ): Promise<void> {
    const config = this.getConfiguration();
    const resolvedPath = path.resolve(filePath);

    let content: string;
    switch (format) {
      case ConfigFormat.JSON:
        content = JSON.stringify(config, null, 2);
        break;
      case ConfigFormat.YAML:
      case ConfigFormat.YML:
        content = yaml.dump(config, { indent: 2 });
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    await fs.writeFile(resolvedPath, content, 'utf-8');
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): void {
    this.config.clear();
    this.initializeDefaults();
  }

  /**
   * Get configuration metadata
   */
  public getConfigurationMetadata(): Array<{
    path: string;
    source: ConfigSource;
    timestamp: Date;
    readonly: boolean;
  }> {
    return Array.from(this.config.entries()).map(([path, configValue]) => ({
      path,
      source: configValue.source,
      timestamp: configValue.timestamp,
      readonly: configValue.readonly,
    }));
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // Close file watchers
    for (const [, watcher] of this.fileWatchers) {
      if (watcher) {
        await watcher.close();
      }
    }
    this.fileWatchers.clear();

    // Clear listeners
    this.listeners.clear();

    // Clear configuration
    this.config.clear();
  }

  // Helper methods

  private detectFileFormat(filePath: string): ConfigFormat {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    switch (ext) {
      case 'json':
        return ConfigFormat.JSON;
      case 'yaml':
        return ConfigFormat.YAML;
      case 'yml':
        return ConfigFormat.YML;
      default:
        throw new Error(`Unknown config file extension: ${ext}`);
    }
  }

  private convertEnvKeyToPath(envKey: string): string {
    return envKey.split('_').join('.');
  }

  private parseEnvValue(value: string): any {
    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // If not JSON, try boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;

      // Try number
      const num = Number(value);
      if (!isNaN(num)) return num;

      // Default to string
      return value;
    }
  }

  private flattenObject(obj: any, prefix: string = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  private deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || typeof source !== 'object') {
      return source;
    }

    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private emitConfigChange(event: ConfigChangeEvent): void {
    const listeners = this.listeners.get(event.path) || [];
    const wildcardListeners = this.listeners.get('*') || [];

    [...listeners, ...wildcardListeners].forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Error in config change listener:', error);
      }
    });
  }

  private async watchConfigFile(filePath: string): Promise<void> {
    try {
      // Note: In a real implementation, you would use fs.watch or a library like chokidar
      // For now, we'll just store the path for cleanup
      this.fileWatchers.set(filePath, null);
    } catch (error) {
      console.warn(`Failed to watch config file ${filePath}:`, error);
    }
  }
}

/**
 * Create configuration manager instance
 */
export function createConfigurationManager(
  options: ConfigManagerOptions = {}
): ConfigurationManager {
  return new ConfigurationManager(options);
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: ConfigurationManager | null = null;

/**
 * Get or create global configuration manager
 */
export function getGlobalConfigManager(options: ConfigManagerOptions = {}): ConfigurationManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigurationManager(options);
  }
  return globalConfigManager;
}

/**
 * Reset global configuration manager
 */
export function resetGlobalConfigManager(): void {
  if (globalConfigManager) {
    globalConfigManager.cleanup();
    globalConfigManager = null;
  }
}

/**
 * Configuration helper utilities
 */
export const ConfigUtils = {
  /**
   * Load configuration from CLI arguments
   */
  loadFromCliArgs(args: any): Partial<FullConfig> {
    const config: Partial<FullConfig> = {};

    // Map CLI arguments to configuration
    if (args.maxPasses !== undefined) {
      config.multiPass = { ...config.multiPass, maxPasses: parseInt(args.maxPasses) };
    }

    if (args.convergenceThreshold !== undefined) {
      config.multiPass = {
        ...config.multiPass,
        convergenceThreshold: parseFloat(args.convergenceThreshold),
      };
    }

    if (args.enableCheckpointing !== undefined) {
      config.state = { ...config.state, enableCheckpointing: args.enableCheckpointing };
    }

    if (args.enableMetrics !== undefined) {
      config.metrics = { ...config.metrics, enableCollection: args.enableMetrics };
    }

    if (args.debug !== undefined) {
      config.debug = args.debug;
      config.logging = { ...config.logging, level: args.debug ? 'debug' : 'info' };
    }

    return config;
  },

  /**
   * Validate configuration section
   */
  validateSection(section: string, data: any): ConfigValidationResult {
    let schema: z.ZodSchema;

    switch (section) {
      case 'multiPass':
        schema = MultiPassConfigSchema;
        break;
      case 'performance':
        schema = PerformanceConfigSchema;
        break;
      case 'state':
        schema = StateConfigSchema;
        break;
      case 'metrics':
        schema = MetricsConfigSchema;
        break;
      case 'integration':
        schema = IntegrationConfigSchema;
        break;
      case 'logging':
        schema = LoggingConfigSchema;
        break;
      default:
        return {
          isValid: false,
          errors: [`Unknown configuration section: ${section}`],
          warnings: [],
        };
    }

    const result = schema.safeParse(data);
    if (result.success) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    } else {
      return {
        isValid: false,
        errors: result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
      };
    }
  },

  /**
   * Merge configuration objects
   */
  mergeConfigs(...configs: Partial<FullConfig>[]): Partial<FullConfig> {
    const manager = new ConfigurationManager();
    return configs.reduce((merged, config) => manager['deepMerge'](merged, config), {});
  },
};

export default ConfigurationManager;
