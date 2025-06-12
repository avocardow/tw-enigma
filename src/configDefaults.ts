import { z } from 'zod';
import { join } from 'path';
import { homedir, tmpdir, cpus } from 'os';
import { existsSync } from 'fs';
import { EnigmaConfigSchema, type EnigmaConfig } from './config.js';
import { createLogger } from './logger.js';

// Use EnigmaConfig as the primary type
type Config = EnigmaConfig;

const logger = createLogger('config-defaults');

/**
 * Environment types for configuration defaults
 */
export type Environment = 'development' | 'production' | 'test' | 'ci';

/**
 * Fallback priority levels
 */
export enum FallbackPriority {
  USER = 1,           // User-provided configuration
  PROJECT = 2,        // Project-specific configuration
  ENVIRONMENT = 3,    // Environment-specific defaults
  GLOBAL = 4,         // Global system defaults
  SYSTEM = 5          // System fallback defaults
}

/**
 * Configuration source metadata
 */
export interface ConfigSource {
  priority: FallbackPriority;
  source: string;
  environment?: Environment;
  timestamp: Date;
  validated: boolean;
}

/**
 * Default configuration values by environment
 */
export const ENVIRONMENT_DEFAULTS: Record<Environment, Partial<Config>> = {
  development: {
    verbose: true,
    output: './dist',
    maxConcurrency: Math.min(10, Math.max(1, Math.floor(cpus().length / 2))), // Respect schema max limit
    minify: false,
    removeUnused: false,
    sourceMaps: true,
    preserveComments: true,
    dev: {
      enabled: true,
      watch: true,
      server: {
        enabled: false,
        port: 3000,
        host: 'localhost',
        open: false,
      },
      diagnostics: {
        enabled: true,
        performance: true,
        memory: true,
        fileWatcher: true,
        classAnalysis: true,
        thresholds: {
          memoryWarning: 512,
          memoryError: 1024,
          cpuWarning: 80,
          cpuError: 95,
        },
      },
      preview: {
        enabled: false,
        autoRefresh: true,
        showDiff: true,
        highlightChanges: true,
      },
      dashboard: {
        enabled: false,
        port: 3001,
        host: 'localhost',
        updateInterval: 1000,
        showMetrics: true,
        showLogs: true,
        maxLogEntries: 100,
      },
    }
  },
  
  production: {
    verbose: false,
    output: './dist',
    maxConcurrency: Math.min(10, cpus().length), // Respect schema max limit
    minify: true,
    removeUnused: true,
    sourceMaps: false,
    preserveComments: false,
    dev: {
      enabled: false,
      watch: false,
      server: {
        enabled: false,
        port: 3000,
        host: 'localhost',
        open: false,
      },
      diagnostics: {
        enabled: true,
        performance: true,
        memory: true,
        fileWatcher: true,
        classAnalysis: true,
        thresholds: {
          memoryWarning: 512,
          memoryError: 1024,
          cpuWarning: 80,
          cpuError: 95,
        },
      },
      preview: {
        enabled: false,
        autoRefresh: true,
        showDiff: true,
        highlightChanges: true,
      },
      dashboard: {
        enabled: false,
        port: 3001,
        host: 'localhost',
        updateInterval: 1000,
        showMetrics: true,
        showLogs: true,
        maxLogEntries: 100,
      },
    }
  },
  
  test: {
    verbose: false,
    output: './test-output',
    maxConcurrency: 1,
    minify: false,
    sourceMaps: false,
    preserveComments: true,
    dev: {
      enabled: false,
      watch: false,
    }
  },
  
  ci: {
    verbose: true,
    output: './dist',
    maxConcurrency: Math.min(10, cpus().length), // Respect schema max limit
    minify: true,
    sourceMaps: true,
    preserveComments: false,
    dev: {
      enabled: false,
      watch: false,
    }
  }
};

/**
 * System-level safe defaults (lowest priority fallback)
 */
export const SYSTEM_DEFAULTS: Config = {
  pretty: false,
  input: './src',
  output: './dist',
  minify: false,
  removeUnused: true,
  verbose: false,
  veryVerbose: false,
  quiet: false,
  debug: false,
  maxConcurrency: 1,
  classPrefix: '',
  excludePatterns: [],
  followSymlinks: false,
  excludeExtensions: [],
  preserveComments: true,
  sourceMaps: false,
  dev: {
    enabled: false,
    watch: false,
    server: {
      enabled: false,
      port: 3000,
      host: 'localhost',
      open: false,
    },
    diagnostics: {
      enabled: true,
      performance: true,
      memory: true,
      fileWatcher: true,
      classAnalysis: true,
      thresholds: {
        memoryWarning: 512,
        memoryError: 1024,
        cpuWarning: 80,
        cpuError: 95,
      },
    },
    preview: {
      enabled: false,
      autoRefresh: true,
      showDiff: true,
      highlightChanges: true,
    },
    dashboard: {
      enabled: false,
      port: 3001,
      host: 'localhost',
      updateInterval: 1000,
      showMetrics: true,
      showLogs: true,
      maxLogEntries: 100,
    },
  },
  validation: {
    enabled: true,
    validateOnLoad: true,
    validateOnChange: true,
    strictMode: false,
    warnOnDeprecated: true,
    failOnInvalid: true,
    crossFieldValidation: true,
    securityValidation: true,
    performanceValidation: true,
    customRules: [],
  },
  runtime: {
    enabled: false,
    checkInterval: 5000,
    resourceThresholds: {
      memory: 1024 * 1024 * 1024,
      cpu: 80,
      fileHandles: 1000,
      diskSpace: 100 * 1024 * 1024,
    },
    autoCorrection: {
      enabled: false,
      maxAttempts: 3,
      fallbackToDefaults: true,
    },
  },
  watcher: {
    enabled: false,
    debounceMs: 300,
    followSymlinks: false,
    ignoreInitial: true,
    validateOnChange: true,
    backupOnChange: true,
    maxBackups: 10,
    watchPatterns: ["**/.enigmarc*", "**/enigma.config.*", "**/package.json"],
    ignorePatterns: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  },
  safeUpdates: {
    enabled: true,
    validateBeforeWrite: true,
    createBackup: true,
    atomicWrite: true,
    verifyAfterWrite: true,
    rollbackOnFailure: true,
    maxBackups: 10,
    retryAttempts: 3,
    retryDelay: 100,
  },
};

/**
 * Global configuration paths for fallback resolution
 */
export const GLOBAL_CONFIG_PATHS = [
  join(homedir(), '.tw-enigma', 'config.json'),
  join(homedir(), '.config', 'tw-enigma', 'config.json'),
  '/etc/tw-enigma/config.json',
  '/usr/local/etc/tw-enigma/config.json'
];

/**
 * Project-level configuration paths
 */
export const PROJECT_CONFIG_PATHS = [
  './tw-enigma.config.js',
  './tw-enigma.config.json',
  './tw-enigma.config.ts',
  './.tw-enigma/config.json',
  './config/tw-enigma.js',
  './config/tw-enigma.json'
];

/**
 * Configuration defaults manager
 */
export class ConfigDefaults {
  private environment: Environment;
  private fallbackChain: ConfigSource[] = [];
  
  constructor(environment?: Environment) {
    this.environment = environment || this.detectEnvironment();
    logger.debug(`Initialized ConfigDefaults for environment: ${this.environment}`);
  }
  
  /**
   * Detect current environment
   */
  private detectEnvironment(): Environment {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    const ciEnv = process.env.CI;
    
    if (ciEnv) return 'ci';
    if (nodeEnv === 'test') return 'test';
    if (nodeEnv === 'production') return 'production';
    return 'development';
  }
  
  /**
   * Get comprehensive defaults with progressive fallback
   */
  public getDefaults(): Config {
    const defaults = this.buildFallbackChain();
    this.logFallbackChain();
    return defaults;
  }
  
  /**
   * Build configuration using progressive fallback strategy
   */
  private buildFallbackChain(): Config {
    this.fallbackChain = [];
    
    // Start with system defaults (highest priority fallback)
    let config = { ...SYSTEM_DEFAULTS };
    this.addToChain(FallbackPriority.SYSTEM, 'system-defaults', config);
    
    // Apply global defaults
    const globalDefaults = this.getGlobalDefaults();
    if (globalDefaults) {
      config = this.mergeConfigs(config, globalDefaults);
      this.addToChain(FallbackPriority.GLOBAL, 'global-config', globalDefaults);
    }
    
    // Apply environment-specific defaults
    const envDefaults = ENVIRONMENT_DEFAULTS[this.environment];
    if (envDefaults) {
      config = this.mergeConfigs(config, envDefaults);
      this.addToChain(FallbackPriority.ENVIRONMENT, `environment-${this.environment}`, envDefaults);
    }
    
    // Apply project defaults
    const projectDefaults = this.getProjectDefaults();
    if (projectDefaults) {
      config = this.mergeConfigs(config, projectDefaults);
      this.addToChain(FallbackPriority.PROJECT, 'project-config', projectDefaults);
    }
    
    return this.validateDefaults(config);
  }
  
  /**
   * Get global configuration defaults
   */
  private getGlobalDefaults(): Partial<Config> | null {
    for (const configPath of GLOBAL_CONFIG_PATHS) {
      if (existsSync(configPath)) {
        try {
          const globalConfig = require(configPath);
          logger.debug(`Loaded global defaults from: ${configPath}`);
          return globalConfig;
        } catch (error) {
          logger.warn(`Failed to load global config from ${configPath}:`, error);
        }
      }
    }
    return null;
  }
  
  /**
   * Get project-level configuration defaults
   */
  private getProjectDefaults(): Partial<Config> | null {
    for (const configPath of PROJECT_CONFIG_PATHS) {
      if (existsSync(configPath)) {
        try {
          const projectConfig = require(configPath);
          logger.debug(`Loaded project defaults from: ${configPath}`);
          return projectConfig;
        } catch (error) {
          logger.warn(`Failed to load project config from ${configPath}:`, error);
        }
      }
    }
    return null;
  }
  
  /**
   * Merge configurations with deep merge strategy
   */
  private mergeConfigs(base: Partial<Config>, override: Partial<Config>): Config {
    const merged = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && typeof merged[key as keyof Config] === 'object') {
          // Deep merge for nested objects
          merged[key as keyof Config] = {
            ...merged[key as keyof Config] as object,
            ...value
          } as any;
        } else {
          // Direct assignment for primitives and arrays
          merged[key as keyof Config] = value as any;
        }
      }
    }
    
    return merged as Config;
  }
  
  /**
   * Add configuration source to fallback chain
   */
  private addToChain(priority: FallbackPriority, source: string, config: Partial<Config>): void {
    this.fallbackChain.push({
      priority,
      source,
      environment: this.environment,
      timestamp: new Date(),
      validated: this.isValidConfig(config)
    });
  }
  
  /**
   * Validate configuration defaults
   */
  private validateDefaults(config: Config): Config {
    try {
      return EnigmaConfigSchema.parse(config);
    } catch (error) {
      logger.error('Default configuration validation failed:', error);
      
      // Return system defaults as ultimate fallback
      logger.warn('Falling back to system defaults due to validation failure');
      return SYSTEM_DEFAULTS;
    }
  }
  
  /**
   * Check if configuration is valid
   */
  private isValidConfig(config: Partial<Config>): boolean {
    try {
      EnigmaConfigSchema.partial().parse(config);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Log fallback chain for debugging
   */
  private logFallbackChain(): void {
    if (logger.level === 'debug') {
      logger.debug('Configuration fallback chain:');
      this.fallbackChain.forEach((source, index) => {
        logger.debug(`  ${index + 1}. ${source.source} (priority: ${source.priority}, valid: ${source.validated})`);
      });
    }
  }
  
  /**
   * Get fallback chain information
   */
  public getFallbackChain(): ConfigSource[] {
    return [...this.fallbackChain];
  }
  
  /**
   * Get environment-specific defaults
   */
  public getEnvironmentDefaults(env?: Environment): Partial<Config> {
    const targetEnv = env || this.environment;
    return { ...ENVIRONMENT_DEFAULTS[targetEnv] };
  }

  /**
   * Create configuration with defaults applied (expected by tests)
   */
  public createConfigWithDefaults(partialConfig: Partial<Config>): Config {
    const defaults = this.getDefaults();
    return this.mergeConfigs(defaults, partialConfig);
  }
  
  /**
   * Check if path is safe for configuration
   */
  public isSafePath(path: string): boolean {
    const normalizedPath = require('path').resolve(path);
    const cwd = process.cwd();
    const home = homedir();
    
    // Allow paths within current working directory or user home
    return normalizedPath.startsWith(cwd) || normalizedPath.startsWith(home);
  }
  
  /**
   * Get safe default paths for different purposes
   */
  public getSafeDefaults(): {
    outputDir: string;
    cacheDir: string;
    tempDir: string;
    logDir: string;
  } {
    const cwd = process.cwd();
    const userCache = join(homedir(), '.cache', 'tw-enigma');
    
    return {
      outputDir: join(cwd, 'dist'),
      cacheDir: existsSync(userCache) ? userCache : join(cwd, '.cache'),
      tempDir: join(tmpdir(), 'tw-enigma'),
      logDir: join(userCache, 'logs')
    };
  }
  
  /**
   * Create environment-specific configuration
   */
  public createEnvironmentConfig(env: Environment, overrides?: Partial<Config>): Config {
    const envDefaults = ENVIRONMENT_DEFAULTS[env];
    const baseConfig = this.mergeConfigs(SYSTEM_DEFAULTS, envDefaults);
    
    if (overrides) {
      return this.mergeConfigs(baseConfig, overrides);
    }
    
    return baseConfig;
  }
  
  /**
   * Validate configuration against environment constraints
   */
  public validateEnvironmentConfig(config: Config, env?: Environment): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const targetEnv = env || this.environment;
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Environment-specific validation rules
    switch (targetEnv) {
      case 'production':
        if (config.dryRun) {
          warnings.push('Dry run mode enabled in production environment');
        }
        if (config.verbose) {
          warnings.push('Verbose logging enabled in production environment');
        }
        if (!config.minify) {
          warnings.push('Minification disabled in production environment');
        }
        break;
        
      case 'development':
        if (!config.sourceMaps) {
          warnings.push('Source maps disabled in development environment');
        }
        if (config.minify) {
          warnings.push('Minification enabled in development environment');
        }
        break;
        
      case 'test':
        if (!config.dryRun) {
          warnings.push('Dry run mode disabled in test environment');
        }
        if (config.concurrency > 1) {
          warnings.push('High concurrency in test environment may cause race conditions');
        }
        break;
        
      case 'ci':
        if (config.watch) {
          errors.push('Watch mode should not be enabled in CI environment');
        }
        if (config.dryRun) {
          warnings.push('Dry run mode enabled in CI environment');
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }
}

/**
 * Create default configuration manager
 */
export function createConfigDefaults(environment?: Environment): ConfigDefaults {
  return new ConfigDefaults(environment);
}

/**
 * Get quick defaults for current environment
 */
export function getQuickDefaults(): Config {
  const defaults = new ConfigDefaults();
  return defaults.getDefaults();
}

/**
 * Get safe defaults with minimal configuration
 */
export function getSafeDefaults(): Config {
  return { ...SYSTEM_DEFAULTS };
}

/**
 * Get environment-specific defaults (expected by tests)
 */
export function getEnvironmentDefaults(environment: Environment): Partial<Config> {
  return { ...ENVIRONMENT_DEFAULTS[environment] };
}

/**
 * Export for testing and advanced usage
 */
export {
  SYSTEM_DEFAULTS as systemDefaults,
  ENVIRONMENT_DEFAULTS as environmentDefaults,
  GLOBAL_CONFIG_PATHS as globalConfigPaths,
  PROJECT_CONFIG_PATHS as projectConfigPaths
}; 