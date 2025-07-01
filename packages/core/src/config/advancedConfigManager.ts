import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/logger';
import { ConfigCache } from './configCache';
import { ConfigMigrator } from './configMigrator';
import { ConfigValidator } from './configValidator';
import { ConfigSource, EnigmaConfig } from './types';

/**
 * Advanced Configuration Manager for TW-Enigma
 * Handles complex configuration scenarios including schema validation,
 * environment-based configs, file inheritance, and dynamic loading
 */
export class AdvancedConfigManager {
  private logger: Logger;
  private validator: ConfigValidator;
  private migrator: ConfigMigrator;
  private cache: ConfigCache;
  private loadedConfigs: Map<string, EnigmaConfig> = new Map();
  private configSources: ConfigSource[] = [];
  private watchedFiles: Set<string> = new Set();
  private isWatching = false;

  constructor(
    options: {
      cacheEnabled?: boolean;
      watchEnabled?: boolean;
      migrationEnabled?: boolean;
      validationEnabled?: boolean;
    } = {}
  ) {
    this.logger = new Logger('AdvancedConfigManager');
    this.validator = new ConfigValidator();
    this.migrator = new ConfigMigrator();
    this.cache = new ConfigCache({
      enabled: options.cacheEnabled ?? true,
      ttl: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Load configuration with advanced features
   */
  async loadConfig(
    configPath?: string,
    options: {
      environment?: string;
      validate?: boolean;
      migrate?: boolean;
      enableInheritance?: boolean;
      mergeStrategy?: 'deep' | 'shallow' | 'replace';
    } = {}
  ): Promise<EnigmaConfig> {
    const {
      environment = process.env.NODE_ENV || 'development',
      validate = true,
      migrate = true,
      enableInheritance = true,
      mergeStrategy = 'deep',
    } = options;

    this.logger.info('Loading advanced configuration', {
      configPath,
      environment,
      validate,
      migrate,
      enableInheritance,
    });

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(configPath, environment, options);
      const cachedConfig = await this.cache.get(cacheKey);
      if (cachedConfig) {
        this.logger.debug('Returning cached configuration');
        return cachedConfig;
      }

      // Discover configuration sources
      const sources = await this.discoverConfigSources(configPath, environment);
      this.configSources = sources;

      // Load and merge configurations
      let config = await this.loadAndMergeConfigs(sources, {
        enableInheritance,
        mergeStrategy,
      });

      // Apply migrations if enabled
      if (migrate) {
        config = await this.migrator.migrate(config);
      }

      // Validate configuration if enabled
      if (validate) {
        const validationResult = await this.validator.validate(config);
        if (!validationResult.isValid) {
          throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Process environment variables and dynamic values
      config = await this.processEnvironmentVariables(config, environment);
      config = await this.processDynamicValues(config);

      // Cache the final configuration
      await this.cache.set(cacheKey, config);

      // Set up file watching if enabled
      if (options.validate !== false) {
        this.setupFileWatching(sources);
      }

      this.logger.info('Configuration loaded successfully', {
        sources: sources.length,
        environment,
        cacheKey,
      });

      return config;
    } catch (error) {
      this.logger.error('Failed to load configuration', { error, configPath, environment });
      throw error;
    }
  }

  /**
   * Discover all configuration sources
   */
  private async discoverConfigSources(
    basePath?: string,
    environment?: string
  ): Promise<ConfigSource[]> {
    const sources: ConfigSource[] = [];
    const searchPaths = this.getConfigSearchPaths(basePath);

    for (const searchPath of searchPaths) {
      // Base configuration files
      const baseFiles = [
        'tw-enigma.config.js',
        'tw-enigma.config.json',
        'tw-enigma.config.ts',
        'enigma.config.js',
        'enigma.config.json',
        'enigma.config.ts',
        '.tw-enigmarc',
        '.tw-enigmarc.json',
        '.tw-enigmarc.js',
      ];

      for (const fileName of baseFiles) {
        const filePath = path.join(searchPath, fileName);
        if (await this.fileExists(filePath)) {
          sources.push({
            type: 'file',
            path: filePath,
            priority: this.getFilePriority(fileName),
            environment: 'base',
          });
        }
      }

      // Environment-specific configurations
      if (environment) {
        const envFiles = [
          `tw-enigma.config.${environment}.js`,
          `tw-enigma.config.${environment}.json`,
          `enigma.config.${environment}.js`,
          `enigma.config.${environment}.json`,
          `.tw-enigmarc.${environment}`,
          `.tw-enigmarc.${environment}.json`,
        ];

        for (const fileName of envFiles) {
          const filePath = path.join(searchPath, fileName);
          if (await this.fileExists(filePath)) {
            sources.push({
              type: 'file',
              path: filePath,
              priority: this.getFilePriority(fileName) + 100, // Higher priority for env-specific
              environment,
            });
          }
        }
      }

      // Package.json configuration
      const packageJsonPath = path.join(searchPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = await this.loadJsonFile(packageJsonPath);
        if (packageJson.twEnigma || packageJson.enigma) {
          sources.push({
            type: 'package',
            path: packageJsonPath,
            priority: 50,
            environment: 'base',
          });
        }
      }
    }

    // Environment variables source
    sources.push({
      type: 'env',
      path: 'process.env',
      priority: 200,
      environment: environment || 'base',
    });

    // Sort by priority (higher priority last for proper merging)
    return sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Load and merge configurations from multiple sources
   */
  private async loadAndMergeConfigs(
    sources: ConfigSource[],
    options: { enableInheritance?: boolean; mergeStrategy?: string }
  ): Promise<EnigmaConfig> {
    let mergedConfig: Partial<EnigmaConfig> = {};

    for (const source of sources) {
      try {
        let sourceConfig: Partial<EnigmaConfig>;

        switch (source.type) {
          case 'file':
            sourceConfig = await this.loadConfigFile(source.path);
            break;
          case 'package':
            sourceConfig = await this.loadPackageJsonConfig(source.path);
            break;
          case 'env':
            sourceConfig = await this.loadEnvironmentConfig();
            break;
          default:
            continue;
        }

        // Handle inheritance
        if (options.enableInheritance && sourceConfig.extends) {
          const inheritedConfig = await this.loadInheritedConfig(sourceConfig.extends, source.path);
          sourceConfig = this.mergeConfigs(inheritedConfig, sourceConfig, options.mergeStrategy);
        }

        // Merge with accumulated config
        mergedConfig = this.mergeConfigs(mergedConfig, sourceConfig, options.mergeStrategy);

        this.logger.debug('Merged configuration from source', {
          source: source.path,
          type: source.type,
          priority: source.priority,
        });
      } catch (error) {
        this.logger.warn('Failed to load configuration source', {
          source: source.path,
          error: (error as Error).message,
        });
      }
    }

    return mergedConfig as EnigmaConfig;
  }

  /**
   * Load inherited configuration
   */
  private async loadInheritedConfig(
    extendsPath: string,
    currentConfigPath: string
  ): Promise<Partial<EnigmaConfig>> {
    let resolvedPath: string;

    if (path.isAbsolute(extendsPath)) {
      resolvedPath = extendsPath;
    } else {
      resolvedPath = path.resolve(path.dirname(currentConfigPath), extendsPath);
    }

    // Prevent circular inheritance
    if (this.loadedConfigs.has(resolvedPath)) {
      this.logger.warn('Circular inheritance detected, skipping', { path: resolvedPath });
      return {};
    }

    this.loadedConfigs.set(resolvedPath, {} as EnigmaConfig);

    try {
      const inheritedConfig = await this.loadConfigFile(resolvedPath);

      // Handle nested inheritance
      if (inheritedConfig.extends) {
        const nestedInherited = await this.loadInheritedConfig(
          inheritedConfig.extends,
          resolvedPath
        );
        return this.mergeConfigs(nestedInherited, inheritedConfig, 'deep');
      }

      return inheritedConfig;
    } finally {
      this.loadedConfigs.delete(resolvedPath);
    }
  }

  /**
   * Process environment variables in configuration
   */
  private async processEnvironmentVariables(
    config: EnigmaConfig,
    environment: string
  ): Promise<EnigmaConfig> {
    const processedConfig = JSON.parse(JSON.stringify(config));

    const processValue = (value: any): any => {
      if (typeof value === 'string') {
        // Replace environment variable references
        return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
          const envValue = process.env[envVar];
          if (envValue === undefined) {
            this.logger.warn('Environment variable not found', { envVar, match });
            return match;
          }
          return envValue;
        });
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (value && typeof value === 'object') {
        const processed: any = {};
        for (const [key, val] of Object.entries(value)) {
          processed[key] = processValue(val);
        }
        return processed;
      }
      return value;
    };

    return processValue(processedConfig);
  }

  /**
   * Process dynamic values in configuration
   */
  private async processDynamicValues(config: EnigmaConfig): Promise<EnigmaConfig> {
    const processedConfig = JSON.parse(JSON.stringify(config));

    const processDynamic = async (value: any): Promise<any> => {
      if (typeof value === 'object' && value !== null && value.__dynamic) {
        const { type, value: dynamicValue, options = {} } = value;

        switch (type) {
          case 'function':
            // Execute dynamic function
            try {
              const fn = new Function(
                'config',
                'options',
                `return (${dynamicValue})(config, options)`
              );
              return await fn(config, options);
            } catch (error) {
              this.logger.error('Failed to execute dynamic function', { error, dynamicValue });
              return undefined;
            }

          case 'file':
            // Load value from file
            try {
              const content = await fs.readFile(dynamicValue, 'utf-8');
              return options.json ? JSON.parse(content) : content;
            } catch (error) {
              this.logger.error('Failed to load dynamic file', { error, file: dynamicValue });
              return undefined;
            }

          case 'computed':
            // Compute based on other config values
            try {
              return this.computeValue(dynamicValue, config, options);
            } catch (error) {
              this.logger.error('Failed to compute dynamic value', {
                error,
                expression: dynamicValue,
              });
              return undefined;
            }

          default:
            this.logger.warn('Unknown dynamic value type', { type, value: dynamicValue });
            return value;
        }
      } else if (Array.isArray(value)) {
        return Promise.all(value.map(processDynamic));
      } else if (value && typeof value === 'object') {
        const processed: any = {};
        for (const [key, val] of Object.entries(value)) {
          processed[key] = await processDynamic(val);
        }
        return processed;
      }

      return value;
    };

    return await processDynamic(processedConfig);
  }

  /**
   * Merge two configuration objects
   */
  private mergeConfigs(
    target: Partial<EnigmaConfig>,
    source: Partial<EnigmaConfig>,
    strategy: string = 'deep'
  ): Partial<EnigmaConfig> {
    switch (strategy) {
      case 'shallow':
        return { ...target, ...source };

      case 'replace':
        return source;

      case 'deep':
      default:
        return this.deepMerge(target, source);
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    if (target === null || target === undefined) {
      return source;
    }

    if (Array.isArray(source)) {
      return [...source];
    }

    if (typeof source !== 'object') {
      return source;
    }

    const result = Array.isArray(target) ? [] : { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Setup file watching for configuration changes
   */
  private setupFileWatching(sources: ConfigSource[]): void {
    if (this.isWatching) {
      return;
    }

    this.isWatching = true;

    // Add file sources to watch list
    for (const source of sources) {
      if (source.type === 'file' || source.type === 'package') {
        this.watchedFiles.add(source.path);
      }
    }

    this.logger.debug('Set up file watching for configuration changes', {
      files: Array.from(this.watchedFiles),
    });
  }

  /**
   * Utility methods
   */
  private getConfigSearchPaths(basePath?: string): string[] {
    const paths = [];

    if (basePath) {
      paths.push(basePath);
    }

    paths.push(process.cwd());
    paths.push(path.join(process.cwd(), 'config'));
    paths.push(path.join(process.cwd(), '.config'));

    return paths;
  }

  private getFilePriority(fileName: string): number {
    // Configuration file priority order
    if (fileName.endsWith('.js') || fileName.endsWith('.ts')) return 90;
    if (fileName.endsWith('.json')) return 80;
    if (fileName.startsWith('.tw-enigmarc')) return 70;
    if (fileName.includes('tw-enigma.config')) return 60;
    if (fileName.includes('enigma.config')) return 50;
    return 40;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async loadConfigFile(filePath: string): Promise<Partial<EnigmaConfig>> {
    const ext = path.extname(filePath);

    switch (ext) {
      case '.js':
      case '.ts':
        // Dynamic import for JS/TS files
        delete require.cache[require.resolve(filePath)];
        const module = require(filePath);
        return module.default || module;

      case '.json':
        return this.loadJsonFile(filePath);

      default:
        // Try to parse as JSON for rc files
        return this.loadJsonFile(filePath);
    }
  }

  private async loadJsonFile(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private async loadPackageJsonConfig(filePath: string): Promise<Partial<EnigmaConfig>> {
    const packageJson = await this.loadJsonFile(filePath);
    return packageJson.twEnigma || packageJson.enigma || {};
  }

  private async loadEnvironmentConfig(): Promise<Partial<EnigmaConfig>> {
    const config: any = {};

    // Map environment variables to configuration
    const envPrefix = 'TW_ENIGMA_';

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(envPrefix)) {
        const configKey = key.substring(envPrefix.length).toLowerCase().replace(/_/g, '.');
        this.setNestedValue(config, configKey, this.parseEnvValue(value));
      }
    }

    return config;
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

  private parseEnvValue(value: string | undefined): any {
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private computeValue(expression: string, config: EnigmaConfig, options: any): any {
    // Simple expression evaluator for computed values
    // For security, only allow basic operations
    const safeExpression = expression.replace(/config\.([a-zA-Z0-9_.]+)/g, (match, path) => {
      const value = this.getNestedValue(config, path);
      return JSON.stringify(value);
    });

    try {
      return Function(`"use strict"; return (${safeExpression})`)();
    } catch (error) {
      this.logger.error('Failed to compute expression', { error, expression, safeExpression });
      throw error;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private generateCacheKey(
    configPath: string | undefined,
    environment: string,
    options: any
  ): string {
    return `config:${configPath || 'default'}:${environment}:${JSON.stringify(options)}`;
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.loadedConfigs.clear();
    this.logger.info('Configuration cache cleared');
  }

  /**
   * Get configuration sources information
   */
  getConfigSources(): ConfigSource[] {
    return [...this.configSources];
  }

  /**
   * Reload configuration
   */
  async reloadConfig(configPath?: string, options?: any): Promise<EnigmaConfig> {
    await this.clearCache();
    return this.loadConfig(configPath, options);
  }
}
