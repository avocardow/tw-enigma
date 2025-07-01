/**
 * Configuration Manager
 * Central configuration management with file parsing, overrides, and validation
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { z } from 'zod';
import { TWEnigmaConfig, TWEnigmaConfigSchema, DEFAULT_PRESETS } from './configSchema';
import { ConfigFileParser, ConfigFileParseError, ParsedConfig } from './configFileParser';
import { ConfigOverrideProcessor, OverrideResult, ConfigOverrideOptions } from './configOverrides';
import { ConfigValidator, ValidationResult, ConfigValidatorOptions } from './configValidation';
import { IntelligentDefaultsEngine, DefaultsResult, IntelligentDefaultsOptions } from './intelligentDefaults';
import { Logger } from '../utils/logger';

export interface ConfigManagerOptions {
  /** Root directory to search for config files */
  root?: string;
  /** Config file names to search for (without extensions) */
  configNames?: string[];
  /** Whether to search parent directories for config files */
  searchParents?: boolean;
  /** Maximum depth to search for config files */
  maxSearchDepth?: number;
  /** Override options for CLI/env processing */
  overrideOptions?: ConfigOverrideOptions;
  /** Validation options */
  validationOptions?: ConfigValidatorOptions;
  /** Intelligent defaults options */
  defaultsOptions?: IntelligentDefaultsOptions;
  /** Whether to cache loaded configurations */
  cache?: boolean;
  /** Whether to watch config files for changes */
  watch?: boolean;
  /** Custom default configuration */
  defaultConfig?: Partial<TWEnigmaConfig>;
}

export interface LoadedConfig {
  /** Final merged configuration */
  config: TWEnigmaConfig;
  /** Source file information */
  source: {
    filePath?: string;
    format?: string;
    exists: boolean;
  };
  /** Applied overrides */
  overrides: OverrideResult;
  /** Validation result */
  validation: ValidationResult;
  /** Intelligent defaults result */
  defaults: DefaultsResult;
  /** Configuration metadata */
  metadata: {
    loadTime: number;
    cacheHit: boolean;
    searchedPaths: string[];
  };
  /** Any warnings during loading */
  warnings: ConfigManagerWarning[];
}

export interface ConfigManagerWarning {
  type: 'config_not_found' | 'parse_warning' | 'override_warning' | 'validation_warning';
  message: string;
  source?: string;
  details?: any;
}

export class ConfigManagerError extends Error {
  constructor(
    message: string,
    public configPath?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ConfigManagerError';
  }
}

export class ConfigManager {
  private logger: Logger;
  private options: Required<ConfigManagerOptions>;
  private fileParser: ConfigFileParser;
  private overrideProcessor: ConfigOverrideProcessor;
  private validator: ConfigValidator;
  private defaultsEngine: IntelligentDefaultsEngine;
  private configCache = new Map<string, LoadedConfig>();
  private watchers = new Map<string, fs.FSWatcher>();

  constructor(options: ConfigManagerOptions = {}) {
    this.options = {
      root: process.cwd(),
      configNames: ['tw-enigma', 'tailwind-enigma', '.tw-enigma'],
      searchParents: true,
      maxSearchDepth: 5,
      overrideOptions: {},
      validationOptions: {},
      defaultsOptions: {},
      cache: true,
      watch: false,
      defaultConfig: {},
      ...options,
    };

    this.logger = new Logger({ component: 'ConfigManager' });
    this.fileParser = new ConfigFileParser({
      validateOnParse: false, // We'll validate after applying overrides
      followExtends: true,
    });
    this.overrideProcessor = new ConfigOverrideProcessor(this.options.overrideOptions);
    this.validator = new ConfigValidator(this.options.validationOptions);
    this.defaultsEngine = new IntelligentDefaultsEngine(this.options.defaultsOptions);
  }

  /**
   * Load configuration with full processing pipeline
   */
  async loadConfig(): Promise<LoadedConfig> {
    const startTime = Date.now();
    const warnings: ConfigManagerWarning[] = [];
    const searchedPaths: string[] = [];

    // Check cache first
    const cacheKey = this.getCacheKey();
    if (this.options.cache && this.configCache.has(cacheKey)) {
      const cached = this.configCache.get(cacheKey)!;
      cached.metadata.cacheHit = true;
      return cached;
    }

    try {
      // 1. Find and parse configuration file
      const configFile = await this.findConfigFile(searchedPaths);
      let baseConfig: TWEnigmaConfig;
      let source: LoadedConfig['source'];
      let defaults: DefaultsResult;

      if (configFile) {
        this.logger.debug(`Loading config from: ${configFile.filePath}`);
        
        const parsedConfig = await this.fileParser.parseFile(configFile.filePath);
        
        // Add any parser warnings
        for (const warning of parsedConfig.warnings) {
          warnings.push({
            type: 'parse_warning',
            message: warning.message,
            source: configFile.filePath,
            details: warning,
          });
        }

        // Apply intelligent defaults first, then merge with any custom defaults
        defaults = await this.defaultsEngine.applyDefaults(parsedConfig.config, {
          workingDir: this.options.root,
        });
        baseConfig = this.mergeWithDefaults(defaults.config);
        
        source = {
          filePath: configFile.filePath,
          format: configFile.format,
          exists: true,
        };
      } else {
        this.logger.debug('No config file found, using defaults');
        
        warnings.push({
          type: 'config_not_found',
          message: `No configuration file found in searched paths: ${searchedPaths.join(', ')}`,
        });

        // Apply intelligent defaults to empty config, then merge with custom defaults
        defaults = await this.defaultsEngine.applyDefaults({}, {
          workingDir: this.options.root,
        });
        baseConfig = this.mergeWithDefaults(defaults.config);
        source = { exists: false };
      }

      // 2. Apply environment and CLI overrides
      const overrides = await this.overrideProcessor.applyOverrides(baseConfig);
      
      // Add override warnings
      for (const warning of overrides.warnings) {
        warnings.push({
          type: 'override_warning',
          message: warning.message,
          source: warning.source,
          details: warning,
        });
      }

      // 3. Comprehensive validation
      const validation = await this.validator.validate(overrides.config, {
        rootDir: this.options.root,
        environment: 'development', // TODO: detect from NODE_ENV or config
      });

      // Add validation warnings
      for (const issue of validation.issues) {
        if (issue.severity === 'warning' || issue.severity === 'info') {
          warnings.push({
            type: 'validation_warning',
            message: issue.message,
            source: source.filePath,
            details: issue,
          });
        }
      }

      // Throw on validation errors
      if (!validation.valid) {
        const errorMessages = validation.issuesBySeverity.errors.map(e => e.message);
        throw new ConfigManagerError(
          `Configuration validation failed with ${validation.issuesBySeverity.errors.length} errors: ${errorMessages.join(', ')}`,
          source.filePath
        );
      }

      // 4. Create loaded config result
      const loadedConfig: LoadedConfig = {
        config: overrides.config,
        source,
        overrides,
        validation,
        defaults,
        metadata: {
          loadTime: Date.now() - startTime,
          cacheHit: false,
          searchedPaths,
        },
        warnings,
      };

      // 5. Cache the result
      if (this.options.cache) {
        this.configCache.set(cacheKey, loadedConfig);
      }

      // 6. Setup file watching if enabled
      if (this.options.watch && source.filePath) {
        await this.setupFileWatcher(source.filePath);
      }

      this.logger.info(`Configuration loaded successfully in ${loadedConfig.metadata.loadTime}ms`, {
        source: source.filePath || 'defaults',
        warnings: warnings.length,
        overrides: Object.keys(overrides.appliedOverrides.cli).length + Object.keys(overrides.appliedOverrides.env).length,
        validationErrors: validation.issuesBySeverity.errors.length,
        validationWarnings: validation.issuesBySeverity.warnings.length,
        defaultRulesApplied: defaults.appliedRules.length,
      });

      return loadedConfig;

    } catch (error) {
      if (error instanceof ConfigManagerError) {
        throw error;
      }

      throw new ConfigManagerError(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Find configuration file in search paths
   */
  private async findConfigFile(searchedPaths: string[]): Promise<{ filePath: string; format: string } | null> {
    const searchPaths = await this.getSearchPaths();
    
    for (const dirPath of searchPaths) {
      searchedPaths.push(dirPath);
      
      const foundFiles = await this.fileParser.findConfigFiles(dirPath, this.options.configNames);
      
      if (foundFiles.length > 0) {
        // Use the first found config file
        const configPath = foundFiles[0];
        const format = path.extname(configPath).slice(1);
        
        this.logger.debug(`Found config file: ${configPath}`);
        return { filePath: configPath, format };
      }
    }

    return null;
  }

  /**
   * Get search paths for configuration files
   */
  private async getSearchPaths(): Promise<string[]> {
    const paths: string[] = [];
    let currentDir = path.resolve(this.options.root);
    
    // Always search the root directory first
    paths.push(currentDir);
    
    if (this.options.searchParents) {
      for (let i = 0; i < this.options.maxSearchDepth; i++) {
        const parentDir = path.dirname(currentDir);
        
        // Stop if we've reached the filesystem root
        if (parentDir === currentDir) {
          break;
        }
        
        paths.push(parentDir);
        currentDir = parentDir;
      }
    }
    
    return paths;
  }

  /**
   * Merge parsed config with defaults and presets
   */
  private mergeWithDefaults(config: any): TWEnigmaConfig {
    // Start with base schema defaults
    const defaultConfig = this.getDefaultConfig();
    
    // Apply environment-specific presets if specified
    let presetConfig = {};
    if (config.preset && DEFAULT_PRESETS[config.preset]) {
      presetConfig = DEFAULT_PRESETS[config.preset];
      this.logger.debug(`Applying preset: ${config.preset}`);
    }
    
    // Deep merge: defaults -> preset -> user config -> custom defaults
    return this.deepMerge(
      this.deepMerge(
        this.deepMerge(defaultConfig, presetConfig),
        config
      ),
      this.options.defaultConfig
    );
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): TWEnigmaConfig {
    return TWEnigmaConfigSchema.parse({});
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }
    
    if (target === null || target === undefined) {
      return source;
    }
    
    if (typeof target !== 'object' || typeof source !== 'object') {
      return source;
    }
    
    if (Array.isArray(source)) {
      return source.slice();
    }
    
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Get cache key for current configuration
   */
  private getCacheKey(): string {
    return `${this.options.root}:${JSON.stringify(this.options.configNames)}:${JSON.stringify(this.options.overrideOptions)}`;
  }

  /**
   * Setup file watcher for configuration changes
   */
  private async setupFileWatcher(filePath: string): Promise<void> {
    if (this.watchers.has(filePath)) {
      return; // Already watching
    }

    try {
      const watcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
          this.logger.debug(`Config file changed: ${filePath}`);
          this.clearCache();
        }
      });

      this.watchers.set(filePath, watcher as any);
      this.logger.debug(`Watching config file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to setup file watcher for ${filePath}`, { error });
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
    this.logger.debug('Configuration cache cleared');
  }

  /**
   * Stop all file watchers
   */
  async dispose(): Promise<void> {
    for (const [filePath, watcher] of this.watchers) {
      try {
        await (watcher as any).close();
        this.logger.debug(`Stopped watching: ${filePath}`);
      } catch (error) {
        this.logger.warn(`Failed to close watcher for ${filePath}`, { error });
      }
    }
    
    this.watchers.clear();
    this.clearCache();
  }

  /**
   * Reload configuration (bypasses cache)
   */
  async reloadConfig(): Promise<LoadedConfig> {
    this.clearCache();
    return this.loadConfig();
  }

  /**
   * Get current configuration file path
   */
  async getConfigPath(): Promise<string | null> {
    const searchedPaths: string[] = [];
    const configFile = await this.findConfigFile(searchedPaths);
    return configFile?.filePath || null;
  }

  /**
   * Validate configuration at given path
   */
  async validateConfigFile(filePath: string): Promise<{ valid: boolean; errors: string[]; validation?: ValidationResult }> {
    try {
      const parsedConfig = await this.fileParser.parseFile(filePath);
      const mergedConfig = this.mergeWithDefaults(parsedConfig.config);
      
      const validation = await this.validator.validate(mergedConfig, {
        rootDir: path.dirname(filePath),
      });

      const errors = validation.issuesBySeverity.errors.map(e => e.message);
      
      return { 
        valid: validation.valid, 
        errors,
        validation,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { valid: false, errors: [errorMessage] };
    }
  }

  /**
   * Update configuration manager options
   */
  updateOptions(options: Partial<ConfigManagerOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (options.overrideOptions) {
      this.overrideProcessor.updateOptions(options.overrideOptions);
    }
    
    if (options.validationOptions) {
      this.validator.updateOptions(options.validationOptions);
    }
    
    if (options.defaultsOptions) {
      this.defaultsEngine.updateOptions(options.defaultsOptions);
    }
    
    this.clearCache(); // Clear cache when options change
  }

  /**
   * Get available configuration file paths
   */
  async getAvailableConfigPaths(): Promise<string[]> {
    const searchPaths = await this.getSearchPaths();
    const availablePaths: string[] = [];
    
    for (const dirPath of searchPaths) {
      const foundFiles = await this.fileParser.findConfigFiles(dirPath, this.options.configNames);
      availablePaths.push(...foundFiles);
    }
    
    return availablePaths;
  }
}

/**
 * Create a configuration manager
 */
export function createConfigManager(options?: ConfigManagerOptions): ConfigManager {
  return new ConfigManager(options);
}

/**
 * Quick utility to load configuration
 */
export async function loadTWEnigmaConfig(options?: ConfigManagerOptions): Promise<LoadedConfig> {
  const manager = createConfigManager(options);
  return manager.loadConfig();
}

export default ConfigManager;