/**
 * Configuration Override System
 * Handles CLI flags and environment variable overrides with proper precedence
 */

import { z } from 'zod';
import { TWEnigmaConfig, TWEnigmaConfigSchema, ENV_VAR_MAPPING, CLI_FLAG_MAPPING } from './configSchema';
import { Logger } from '../utils/logger';

export interface ConfigOverrideOptions {
  /** CLI arguments to process */
  cliArgs?: string[];
  /** Environment variables to process */
  envVars?: Record<string, string>;
  /** Whether to warn about unknown flags/variables */
  warnUnknown?: boolean;
  /** Whether to validate overrides against schema */
  validateOverrides?: boolean;
  /** Custom override mappings */
  customMappings?: {
    env?: Record<string, string>;
    cli?: Record<string, string>;
  };
}

export interface OverrideResult {
  /** Merged configuration with overrides applied */
  config: TWEnigmaConfig;
  /** Overrides that were applied */
  appliedOverrides: {
    cli: Record<string, any>;
    env: Record<string, any>;
  };
  /** Warnings about unknown or invalid overrides */
  warnings: OverrideWarning[];
  /** Override sources for each config key */
  sources: Record<string, 'default' | 'config' | 'env' | 'cli'>;
}

export interface OverrideWarning {
  type: 'unknown_flag' | 'unknown_env' | 'type_coercion' | 'invalid_value' | 'deprecated';
  message: string;
  source: 'cli' | 'env';
  key?: string;
  value?: any;
}

export class ConfigOverrideError extends Error {
  constructor(
    message: string,
    public source: 'cli' | 'env',
    public key?: string,
    public value?: any,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ConfigOverrideError';
  }
}

export class ConfigOverrideProcessor {
  private logger: Logger;
  private options: Required<ConfigOverrideOptions>;

  constructor(options: ConfigOverrideOptions = {}) {
    this.options = {
      cliArgs: [],
      envVars: process.env,
      warnUnknown: true,
      validateOverrides: true,
      customMappings: { env: {}, cli: {} },
      ...options,
    };

    this.logger = new Logger({ component: 'ConfigOverrideProcessor' });
  }

  /**
   * Apply overrides to base configuration
   */
  async applyOverrides(baseConfig: TWEnigmaConfig): Promise<OverrideResult> {
    const warnings: OverrideWarning[] = [];
    const appliedOverrides = { cli: {}, env: {} };
    const sources: Record<string, 'default' | 'config' | 'env' | 'cli'> = {};
    
    // Initialize sources with base config
    this.initializeSources(baseConfig, sources);

    // Process environment variable overrides first (lower precedence)
    const envOverrides = this.processEnvironmentVariables(warnings);
    Object.assign(appliedOverrides.env, envOverrides);

    // Process CLI argument overrides second (higher precedence)
    const cliOverrides = this.processCLIArguments(warnings);
    Object.assign(appliedOverrides.cli, cliOverrides);

    // Merge overrides with precedence: CLI > ENV > Config > Defaults
    const mergedConfig = this.mergeWithPrecedence(
      baseConfig,
      envOverrides,
      cliOverrides,
      sources
    );

    // Validate final configuration if requested
    if (this.options.validateOverrides) {
      try {
        TWEnigmaConfigSchema.parse(mergedConfig);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ConfigOverrideError(
            `Configuration validation failed after applying overrides: ${error.message}`,
            'cli' // Most likely source of validation errors
          );
        }
        throw error;
      }
    }

    return {
      config: mergedConfig,
      appliedOverrides,
      warnings,
      sources,
    };
  }

  /**
   * Process environment variable overrides
   */
  private processEnvironmentVariables(warnings: OverrideWarning[]): Record<string, any> {
    const overrides: Record<string, any> = {};
    const envMapping = { ...ENV_VAR_MAPPING, ...this.options.customMappings.env };

    for (const [envVar, configPath] of Object.entries(envMapping)) {
      const value = this.options.envVars[envVar];
      
      if (value !== undefined) {
        try {
          const parsedValue = this.parseEnvironmentValue(value, configPath);
          this.setNestedValue(overrides, configPath, parsedValue);
          
          this.logger.debug(`Applied environment override: ${envVar} -> ${configPath} = ${parsedValue}`);
        } catch (error) {
          warnings.push({
            type: 'invalid_value',
            message: `Failed to parse environment variable ${envVar}: ${error instanceof Error ? error.message : String(error)}`,
            source: 'env',
            key: envVar,
            value,
          });
        }
      }
    }

    // Check for unknown environment variables
    if (this.options.warnUnknown) {
      this.checkUnknownEnvironmentVariables(warnings, envMapping);
    }

    return overrides;
  }

  /**
   * Process CLI argument overrides
   */
  private processCLIArguments(warnings: OverrideWarning[]): Record<string, any> {
    const overrides: Record<string, any> = {};
    const cliMapping = { ...CLI_FLAG_MAPPING, ...this.options.customMappings.cli };
    const parsedArgs = this.parseCliArguments(this.options.cliArgs);

    for (const [flag, configPath] of Object.entries(cliMapping)) {
      if (parsedArgs.has(flag)) {
        const value = parsedArgs.get(flag);
        
        try {
          const parsedValue = this.parseCliValue(value, configPath, flag);
          this.setNestedValue(overrides, configPath, parsedValue);
          
          this.logger.debug(`Applied CLI override: ${flag} -> ${configPath} = ${parsedValue}`);
        } catch (error) {
          warnings.push({
            type: 'invalid_value',
            message: `Failed to parse CLI argument ${flag}: ${error instanceof Error ? error.message : String(error)}`,
            source: 'cli',
            key: flag,
            value,
          });
        }
      }
    }

    // Check for unknown CLI flags
    if (this.options.warnUnknown) {
      this.checkUnknownCliFlags(warnings, cliMapping, parsedArgs);
    }

    return overrides;
  }

  /**
   * Parse CLI arguments into a map of flag -> value
   */
  private parseCliArguments(args: string[]): Map<string, string | boolean> {
    const parsed = new Map<string, string | boolean>();
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        if (arg.includes('=')) {
          // Handle --flag=value format
          const [flag, ...valueParts] = arg.split('=');
          parsed.set(flag, valueParts.join('='));
        } else {
          // Handle --flag value format or boolean flags
          const nextArg = args[i + 1];
          
          if (nextArg && !nextArg.startsWith('-')) {
            parsed.set(arg, nextArg);
            i++; // Skip next argument as it's the value
          } else {
            // Boolean flag
            parsed.set(arg, true);
          }
        }
      } else if (arg.startsWith('-') && arg.length === 2) {
        // Handle short flags like -v
        const nextArg = args[i + 1];
        
        if (nextArg && !nextArg.startsWith('-')) {
          parsed.set(arg, nextArg);
          i++;
        } else {
          parsed.set(arg, true);
        }
      }
    }
    
    return parsed;
  }

  /**
   * Parse environment variable value with type coercion
   */
  private parseEnvironmentValue(value: string, configPath: string): any {
    // Try to determine type from config path and apply appropriate parsing
    const lowerValue = value.toLowerCase();
    
    // Boolean values
    if (lowerValue === 'true' || lowerValue === 'false') {
      return lowerValue === 'true';
    }
    
    // Numeric values
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    
    if (/^\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Array values (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(v => v.trim());
    }
    
    // String values
    return value;
  }

  /**
   * Parse CLI value with type coercion
   */
  private parseCliValue(value: string | boolean, configPath: string, flag: string): any {
    if (typeof value === 'boolean') {
      // Handle boolean flags and negation flags
      if (flag.startsWith('--no-')) {
        return false;
      }
      return true;
    }
    
    // Use same parsing logic as environment variables for string values
    return this.parseEnvironmentValue(value, configPath);
  }

  /**
   * Set nested value in object using dot notation path
   */
  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get nested value from object using dot notation path
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Deep merge objects with precedence tracking
   */
  private mergeWithPrecedence(
    baseConfig: TWEnigmaConfig,
    envOverrides: Record<string, any>,
    cliOverrides: Record<string, any>,
    sources: Record<string, 'default' | 'config' | 'env' | 'cli'>
  ): TWEnigmaConfig {
    const merged = JSON.parse(JSON.stringify(baseConfig)); // Deep clone
    
    // Apply environment overrides
    this.deepMerge(merged, envOverrides, sources, 'env');
    
    // Apply CLI overrides (highest precedence)
    this.deepMerge(merged, cliOverrides, sources, 'cli');
    
    return merged;
  }

  /**
   * Deep merge with source tracking
   */
  private deepMerge(
    target: any,
    source: any,
    sources: Record<string, 'default' | 'config' | 'env' | 'cli'>,
    sourceType: 'env' | 'cli',
    keyPath = ''
  ): void {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const fullPath = keyPath ? `${keyPath}.${key}` : key;
        
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (target[key] === null || typeof target[key] !== 'object' || Array.isArray(target[key])) {
            target[key] = {};
          }
          this.deepMerge(target[key], source[key], sources, sourceType, fullPath);
        } else {
          target[key] = source[key];
          sources[fullPath] = sourceType;
        }
      }
    }
  }

  /**
   * Initialize sources map with config values
   */
  private initializeSources(config: any, sources: Record<string, any>, keyPath = ''): void {
    for (const key in config) {
      if (config.hasOwnProperty(key)) {
        const fullPath = keyPath ? `${keyPath}.${key}` : key;
        
        if (config[key] !== null && typeof config[key] === 'object' && !Array.isArray(config[key])) {
          this.initializeSources(config[key], sources, fullPath);
        } else {
          sources[fullPath] = 'config';
        }
      }
    }
  }

  /**
   * Check for unknown environment variables
   */
  private checkUnknownEnvironmentVariables(
    warnings: OverrideWarning[],
    knownMapping: Record<string, string>
  ): void {
    const twEnigmaEnvVars = Object.keys(this.options.envVars).filter(key => 
      key.startsWith('TW_ENIGMA_')
    );
    
    for (const envVar of twEnigmaEnvVars) {
      if (!(envVar in knownMapping)) {
        warnings.push({
          type: 'unknown_env',
          message: `Unknown TW-Enigma environment variable: ${envVar}`,
          source: 'env',
          key: envVar,
          value: this.options.envVars[envVar],
        });
      }
    }
  }

  /**
   * Check for unknown CLI flags
   */
  private checkUnknownCliFlags(
    warnings: OverrideWarning[],
    knownMapping: Record<string, string>,
    parsedArgs: Map<string, string | boolean>
  ): void {
    for (const flag of parsedArgs.keys()) {
      if (!(flag in knownMapping)) {
        warnings.push({
          type: 'unknown_flag',
          message: `Unknown CLI flag: ${flag}`,
          source: 'cli',
          key: flag,
          value: parsedArgs.get(flag),
        });
      }
    }
  }

  /**
   * Update processor options
   */
  updateOptions(options: Partial<ConfigOverrideOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current override mappings
   */
  getMappings(): { env: Record<string, string>; cli: Record<string, string> } {
    return {
      env: { ...ENV_VAR_MAPPING, ...this.options.customMappings.env },
      cli: { ...CLI_FLAG_MAPPING, ...this.options.customMappings.cli },
    };
  }

  /**
   * Validate that a config path exists in the schema
   */
  validateConfigPath(path: string): boolean {
    try {
      // Try to set a dummy value at the path to see if it's valid
      const testConfig = {};
      this.setNestedValue(testConfig, path, 'test');
      TWEnigmaConfigSchema.partial().parse(testConfig);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a configuration override processor
 */
export function createConfigOverrideProcessor(options?: ConfigOverrideOptions): ConfigOverrideProcessor {
  return new ConfigOverrideProcessor(options);
}

/**
 * Quick utility to apply overrides to a config
 */
export async function applyConfigOverrides(
  baseConfig: TWEnigmaConfig,
  options?: ConfigOverrideOptions
): Promise<OverrideResult> {
  const processor = createConfigOverrideProcessor(options);
  return processor.applyOverrides(baseConfig);
}

export default ConfigOverrideProcessor;