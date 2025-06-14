import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { createLogger } from './logger';
import { EnigmaConfigSchema } from './config';

const logger = createLogger('config-migration');

/**
 * Configuration version schema
 */
export const ConfigVersionSchema = z.object({
  version: z.string(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  migratedFrom: z.string().optional()
});

export type ConfigVersion = z.infer<typeof ConfigVersionSchema>;

/**
 * Migration script interface
 */
export interface MigrationScript {
  fromVersion: string;
  toVersion: string;
  schemaVersion: number;
  description: string;
  migrate: (config: any) => Promise<any>;
  rollback?: (config: any) => Promise<any>;
  validate?: (config: any) => boolean;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migrationsApplied: string[];
  warnings: string[];
  errors: string[];
  backupPath?: string;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  autoMigrate?: boolean;
  createBackup?: boolean;
  dryRun?: boolean;
  force?: boolean;
  targetVersion?: string;
}

/**
 * Current configuration schema version
 */
export const CURRENT_SCHEMA_VERSION = 3;
export const CURRENT_CONFIG_VERSION = '1.0.0';

/**
 * Configuration migration manager
 */
export class ConfigMigration {
  private migrations: Map<string, MigrationScript> = new Map();
  private configPath: string;
  private backupDir: string;
  
  constructor(configPath: string, backupDir?: string) {
    this.configPath = configPath;
    this.backupDir = backupDir || join(dirname(configPath), '.migrations');
    this.initializeMigrations();
    
    // Ensure backup directory exists
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }
  
  /**
   * Initialize built-in migration scripts
   */
  private initializeMigrations(): void {
    // Migration from v0.1.0 to v0.2.0 (schema v1 to v2)
    this.addMigration({
      fromVersion: '0.1.0',
      toVersion: '0.2.0',
      schemaVersion: 2,
      description: 'Add optimization and performance configuration',
      migrate: async (config: any) => {
        const {
          removeUnused,
          mergeDuplicates,
          minifyClassNames,
          treeshake,
          deadCodeElimination,
          maxMemoryUsage,
          timeout,
          retries,
          ...rest
        } = config;
        return {
          ...rest,
          optimization: {
            removeUnused: removeUnused ?? true,
            mergeDuplicates: mergeDuplicates ?? false,
            minifyClassNames: minifyClassNames ?? false,
            treeshake: treeshake ?? false,
            deadCodeElimination: deadCodeElimination ?? false
          },
          performance: {
            maxMemoryUsage: maxMemoryUsage ?? '256MB',
            timeout: timeout ?? 15000,
            retries: retries ?? 1
          },
          validation: {
            enabled: true,
            strict: false,
            customRules: [],
            errorHandling: 'warn',
            skipValidation: []
          },
          runtime: {
            enabled: true,
            checkInterval: 5000,
            resourceThresholds: {
              memory: 128 * 1024 * 1024,
              cpu: 80,
              fileHandles: 1000,
              diskSpace: 100 * 1024 * 1024,
            },
            autoCorrection: {
              enabled: false,
              maxAttempts: 3,
              fallbackToDefaults: true,
            }
          }
        };
      },
      rollback: async (config: any) => {
        const { optimization, performance, ...rest } = config;
        return {
          ...rest,
          removeUnused: optimization?.removeUnused,
          mergeDuplicates: optimization?.mergeDuplicates,
          minifyClassNames: optimization?.minifyClassNames,
          treeshake: optimization?.treeshake,
          deadCodeElimination: optimization?.deadCodeElimination,
          maxMemoryUsage: performance?.maxMemoryUsage,
          timeout: performance?.timeout,
          retries: performance?.retries
        };
      }
    });
    
    // Migration from v0.2.0 to v1.0.0 (schema v2 to v3)
    this.addMigration({
      fromVersion: '0.2.0',
      toVersion: '1.0.0',
      schemaVersion: 3,
      description: 'Add output configuration and Tailwind integration',
      migrate: async (config: any) => {
        const {
          outputFormat,
          outputFilename,
          preserveOriginal,
          tailwindConfig,
          tailwindCss,
          ...rest
        } = config;
        return {
          ...rest,
          output: {
            format: outputFormat ?? 'css',
            filename: outputFilename ?? 'optimized.css',
            preserveOriginal: preserveOriginal ?? true
          },
          tailwind: {
            configPath: tailwindConfig ?? './tailwind.config.js',
            cssPath: tailwindCss ?? './src/styles/tailwind.css'
          }
        };
      },
      rollback: async (config: any) => {
        const { output, tailwind, ...rest } = config;
        return {
          ...rest,
          outputFormat: output?.format,
          outputFilename: output?.filename,
          preserveOriginal: output?.preserveOriginal,
          tailwindConfig: tailwind?.configPath,
          tailwindCss: tailwind?.cssPath
        };
      }
    });
    
    logger.debug(`Initialized ${this.migrations.size} migration scripts`);
  }
  
  /**
   * Add a migration script
   */
  public addMigration(migration: MigrationScript): void {
    const key = `${migration.fromVersion}->${migration.toVersion}`;
    this.migrations.set(key, migration);
    logger.debug(`Added migration: ${key}`);
  }
  
  /**
   * Detect configuration version
   */
  public detectVersion(config: any): ConfigVersion {
    // Check for explicit version information
    if (config._version) {
      return ConfigVersionSchema.parse(config._version);
    }
    
    // Infer version from configuration structure
    const inferredVersion = this.inferVersionFromStructure(config);
    
    return {
      version: inferredVersion,
      schemaVersion: this.getSchemaVersionForConfigVersion(inferredVersion),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  
  /**
   * Infer version from configuration structure
   */
  private inferVersionFromStructure(config: any): string {
    // Check for v1.0.0 features
    if (config.output && config.tailwind) {
      return '1.0.0';
    }
    
    // Check for v0.2.0 features
    if (config.optimization && config.performance) {
      return '0.2.0';
    }
    
    // Default to earliest version
    return '0.1.0';
  }
  
  /**
   * Get schema version for configuration version
   */
  private getSchemaVersionForConfigVersion(version: string): number {
    switch (version) {
      case '1.0.0': return 3;
      case '0.2.0': return 2;
      case '0.1.0': return 1;
      default: return 1;
    }
  }
  
  /**
   * Check if migration is needed
   */
  public needsMigration(config: any): boolean {
    const currentVersion = this.detectVersion(config);
    return currentVersion.version !== CURRENT_CONFIG_VERSION ||
           currentVersion.schemaVersion !== CURRENT_SCHEMA_VERSION;
  }
  
  /**
   * Get migration path from current version to target version
   */
  public getMigrationPath(fromVersion: string, toVersion?: string): MigrationScript[] {
    const targetVersion = toVersion || CURRENT_CONFIG_VERSION;
    const path: MigrationScript[] = [];
    
    let currentVersion = fromVersion;
    const visited = new Set<string>();
    
    while (currentVersion !== targetVersion && !visited.has(currentVersion)) {
      visited.add(currentVersion);
      
      // Find migration from current version
      const migration = Array.from(this.migrations.values())
        .find(m => m.fromVersion === currentVersion);
      
      if (!migration) {
        logger.warn(`No migration found from version ${currentVersion}`);
        break;
      }
      
      path.push(migration);
      currentVersion = migration.toVersion;
    }
    
    return path;
  }
  
  /**
   * Migrate configuration
   */
  public async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const {
      autoMigrate = false,
      createBackup = true,
      dryRun = false,
      force = false,
      targetVersion
    } = options;
    
    const result: MigrationResult = {
      success: false,
      fromVersion: '',
      toVersion: targetVersion || CURRENT_CONFIG_VERSION,
      migrationsApplied: [],
      warnings: [],
      errors: []
    };
    
    try {
      // Load current configuration
      if (!existsSync(this.configPath)) {
        result.errors.push(`Configuration file not found: ${this.configPath}`);
        return result;
      }
      
      const configContent = readFileSync(this.configPath, 'utf-8');
      let config: any;
      
      try {
        config = JSON.parse(configContent);
      } catch (error) {
        result.errors.push(`Invalid JSON in configuration file: ${error}`);
        return result;
      }
      
      // Detect current version
      const currentVersion = this.detectVersion(config);
      result.fromVersion = currentVersion.version;
      
      // Check if migration is needed
      if (!this.needsMigration(config) && !force) {
        result.success = true;
        result.warnings.push('Configuration is already up to date');
        return result;
      }
      
      // Get migration path
      const migrationPath = this.getMigrationPath(currentVersion.version, targetVersion);
      
      if (migrationPath.length === 0 && this.needsMigration(config)) {
        result.errors.push(`No migration path found from ${currentVersion.version} to ${result.toVersion}`);
        return result;
      }
      
      // Create backup if requested
      if (createBackup && !dryRun) {
        const backupPath = await this.createBackup(config, currentVersion);
        result.backupPath = backupPath;
      }
      
      // Apply migrations
      let migratedConfig = { ...config };
      
      for (const migration of migrationPath) {
        logger.info(`Applying migration: ${migration.fromVersion} -> ${migration.toVersion}`);
        
        if (!autoMigrate && !force) {
          result.warnings.push(`Manual approval required for migration: ${migration.description}`);
          continue;
        }
        
        try {
          migratedConfig = await migration.migrate(migratedConfig);
          result.migrationsApplied.push(`${migration.fromVersion}->${migration.toVersion}`);
          
          // Validate migration result if validator exists
          if (migration.validate && !migration.validate(migratedConfig)) {
            result.errors.push(`Migration validation failed: ${migration.fromVersion} -> ${migration.toVersion}`);
            return result;
          }
          
        } catch (error) {
          result.errors.push(`Migration failed: ${migration.fromVersion} -> ${migration.toVersion}: ${error}`);
          return result;
        }
      }
      
      // Add version metadata
      migratedConfig._version = {
        version: result.toVersion,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        createdAt: currentVersion.createdAt,
        updatedAt: new Date().toISOString(),
        migratedFrom: currentVersion.version
      };
      
      // Validate final configuration
      try {
        EnigmaConfigSchema.parse(migratedConfig);
      } catch (error) {
        result.errors.push(`Final configuration validation failed: ${error}`);
        return result;
      }
      
      // Write migrated configuration
      if (!dryRun) {
        const migratedContent = JSON.stringify(migratedConfig, null, 2);
        writeFileSync(this.configPath, migratedContent, 'utf-8');
        logger.info(`Configuration migrated successfully to version ${result.toVersion}`);
      } else {
        logger.info('Dry run: Configuration migration would succeed');
      }
      
      result.success = true;
      
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      logger.error('Configuration migration failed', { error: error instanceof Error ? error.message : String(error) });
    }
    
    return result;
  }
  
  /**
   * Create configuration backup
   */
  private async createBackup(config: any, version: ConfigVersion): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `config-backup-${version.version}-${timestamp}.json`;
    const _backupPath = join(this.backupDir, backupFilename);
    
    const backupData = {
      _backup: {
        originalPath: this.configPath,
        version: version,
        createdAt: new Date().toISOString()
      },
      ...config
    };
    
    writeFileSync(_backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    logger.info(`Configuration backup created: ${_backupPath}`);
    
    return _backupPath;
  }
  
  /**
   * Restore configuration from backup
   */
  public async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      if (!existsSync(backupPath)) {
        logger.error(`Backup file not found: ${backupPath}`);
        return false;
      }
      
      const backupContent = readFileSync(backupPath, 'utf-8');
      const backupData = JSON.parse(backupContent);
      
      // Extract original configuration (remove backup metadata)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _backup, ...originalConfig } = backupData;
      
      // Write restored configuration
      const restoredContent = JSON.stringify(originalConfig, null, 2);
      writeFileSync(this.configPath, restoredContent, 'utf-8');
      
      logger.info(`Configuration restored from backup: ${backupPath}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to restore configuration from backup', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
  
  /**
   * List available backups
   */
  public listBackups(): Array<{
    path: string;
    version: string;
    createdAt: string;
    size: number;
  }> {
    const backups: Array<{
      path: string;
      version: string;
      createdAt: string;
      size: number;
    }> = [];
    
    if (!existsSync(this.backupDir)) {
      return backups;
    }
    
    const files = readdirSync(this.backupDir);
    
    for (const file of files) {
      if (file.startsWith('config-backup-') && file.endsWith('.json')) {
        const filePath = join(this.backupDir, file);
        
        try {
          const content = readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          const stats = statSync(filePath);
          
          backups.push({
            path: filePath,
            version: data._backup?.version?.version || 'unknown',
            createdAt: data._backup?.createdAt || stats.ctime.toISOString(),
            size: stats.size
          });
        } catch (error) {
          logger.warn(`Failed to read backup file ${file}`, { error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
    
    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  /**
   * Get deprecation warnings for current configuration
   */
  public getDeprecationWarnings(config: any): string[] {
    const warnings: string[] = [];
    const version = this.detectVersion(config);
    
    // Check for deprecated configuration options
    if (version.schemaVersion < 2) {
      if (config.removeUnused !== undefined) {
        warnings.push('removeUnused is deprecated, use optimization.removeUnused instead');
      }
      if (config.mergeDuplicates !== undefined) {
        warnings.push('mergeDuplicates is deprecated, use optimization.mergeDuplicates instead');
      }
    }
    
    if (version.schemaVersion < 3) {
      if (config.outputFormat !== undefined) {
        warnings.push('outputFormat is deprecated, use output.format instead');
      }
      if (config.tailwindConfig !== undefined) {
        warnings.push('tailwindConfig is deprecated, use tailwind.configPath instead');
      }
    }
    
    return warnings;
  }
  
  /**
   * Get upgrade suggestions
   */
  public getUpgradeSuggestions(config: any): string[] {
    const suggestions: string[] = [];
    const version = this.detectVersion(config);
    
    if (version.version !== CURRENT_CONFIG_VERSION) {
      suggestions.push(`Upgrade to version ${CURRENT_CONFIG_VERSION} for latest features and improvements`);
    }
    
    if (version.schemaVersion < CURRENT_SCHEMA_VERSION) {
      suggestions.push('Run migration to update configuration schema to latest version');
    }
    
    // Feature-specific suggestions
    if (!config.optimization) {
      suggestions.push('Add optimization configuration for better performance');
    }
    
    if (!config.performance) {
      suggestions.push('Add performance configuration for resource management');
    }
    
    if (!config.output) {
      suggestions.push('Add output configuration for better control over generated files');
    }
    
    return suggestions;
  }
  
  /**
   * Create migration from current configuration
   */
  public async createMigrationFromCurrent(
    toVersion: string,
    description: string,
    migrationFn: (config: any) => Promise<any>
  ): Promise<void> {
    if (!existsSync(this.configPath)) {
      throw new Error(`Configuration file not found: ${this.configPath}`);
    }
    
    const configContent = readFileSync(this.configPath, 'utf-8');
    const config = JSON.parse(configContent);
    const currentVersion = this.detectVersion(config);
    
    const migration: MigrationScript = {
      fromVersion: currentVersion.version,
      toVersion,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      description,
      migrate: migrationFn
    };
    
    this.addMigration(migration);
    logger.info(`Created migration from ${currentVersion.version} to ${toVersion}`);
  }
}

/**
 * Create configuration migration manager
 */
export function createConfigMigration(configPath: string, backupDir?: string): ConfigMigration {
  return new ConfigMigration(configPath, backupDir);
}

/**
 * Quick migration utility
 */
export async function migrateConfig(
  configPath: string,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const migration = new ConfigMigration(configPath);
  return migration.migrate(options);
}

/**
 * Check if configuration needs migration
 */
export function needsConfigMigration(configPath: string): boolean {
  if (!existsSync(configPath)) {
    return false;
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    const migration = new ConfigMigration(configPath);
    return migration.needsMigration(config);
  } catch {
    return false;
  }
}

/**
 * Export for testing and advanced usage
 */
export {
  CURRENT_SCHEMA_VERSION as currentSchemaVersion,
  CURRENT_CONFIG_VERSION as currentConfigVersion
}; 