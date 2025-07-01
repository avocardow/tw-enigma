import { Logger } from '../utils/logger';

interface MigrationRule {
  fromVersion: string;
  toVersion: string;
  transform: (config: any) => any;
  description: string;
  breaking?: boolean;
}

interface MigrationResult {
  success: boolean;
  oldVersion: string;
  newVersion: string;
  appliedMigrations: string[];
  warnings: string[];
  errors: string[];
  backupCreated?: string;
}

export interface ConfigMigratorOptions {
  createBackups?: boolean;
  allowBreakingChanges?: boolean;
  strictMode?: boolean;
}

/**
 * Configuration migration system for handling schema changes
 */
export class ConfigMigrator {
  private logger: Logger;
  private options: Required<ConfigMigratorOptions>;
  private migrations: MigrationRule[] = [];

  constructor(options: ConfigMigratorOptions = {}) {
    this.logger = new Logger({ component: 'ConfigMigrator' });
    this.options = {
      createBackups: options.createBackups ?? true,
      allowBreakingChanges: options.allowBreakingChanges ?? false,
      strictMode: options.strictMode ?? true,
    };

    this.initializeBuiltInMigrations();
  }

  /**
   * Initialize built-in migration rules
   */
  private initializeBuiltInMigrations(): void {
    // Example migrations - these would be real migrations for your config schema
    this.migrations = [
      {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Add dynamic class generation configuration',
        transform: (config: any) => {
          return {
            ...config,
            dynamicClasses: {
              enabled: true,
              templateLiteralDetection: {
                enabled: true,
                patterns: ['template', 'tw', 'classNames'],
              },
              astParsing: {
                enabled: true,
                parser: 'babel',
              },
              runtime: {
                caching: true,
                optimization: 'balanced',
              },
            },
          };
        },
      },
      {
        fromVersion: '1.1.0',
        toVersion: '1.2.0',
        description: 'Add advanced optimization settings',
        transform: (config: any) => {
          return {
            ...config,
            optimization: {
              ...config.optimization,
              advanced: {
                treeshaking: true,
                customProperties: true,
                modernCSS: true,
              },
            },
          };
        },
      },
      {
        fromVersion: '1.2.0',
        toVersion: '2.0.0',
        description: 'Breaking: Restructure configuration schema',
        breaking: true,
        transform: (config: any) => {
          // This would be a breaking change migration
          const newConfig = {
            version: '2.0.0',
            core: {
              input: config.input || config.inputDir,
              output: config.output || config.outputDir,
              framework: config.framework || 'vanilla',
            },
            processing: {
              ...config.optimization,
              ...config.dynamicClasses,
            },
            experimental: {
              ...config.experimental,
            },
          };

          return newConfig;
        },
      },
    ];
  }

  /**
   * Register a custom migration rule
   */
  registerMigration(migration: MigrationRule): void {
    const existing = this.migrations.find(
      (m) => m.fromVersion === migration.fromVersion && m.toVersion === migration.toVersion
    );

    if (existing) {
      this.logger.warn('Overriding existing migration', {
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
      });
    }

    this.migrations.push(migration);
    this.sortMigrations();
  }

  /**
   * Sort migrations by version order
   */
  private sortMigrations(): void {
    this.migrations.sort((a, b) => {
      // Simple version comparison (would use semver in real implementation)
      return this.compareVersions(a.fromVersion, b.fromVersion);
    });
  }

  /**
   * Compare two version strings
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map((n) => parseInt(n, 10));
    const bParts = b.split('.').map((n) => parseInt(n, 10));

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }

    return 0;
  }

  /**
   * Get the current configuration version
   */
  private getConfigVersion(config: any): string {
    return config.version || config.configVersion || '1.0.0';
  }

  /**
   * Get the latest supported version
   */
  getLatestVersion(): string {
    if (this.migrations.length === 0) {
      return '1.0.0';
    }

    const latestMigration = this.migrations[this.migrations.length - 1];
    return latestMigration.toVersion;
  }

  /**
   * Check if a configuration needs migration
   */
  needsMigration(config: any): boolean {
    const currentVersion = this.getConfigVersion(config);
    const latestVersion = this.getLatestVersion();
    return this.compareVersions(currentVersion, latestVersion) < 0;
  }

  /**
   * Get applicable migrations for a config
   */
  getApplicableMigrations(config: any): MigrationRule[] {
    const currentVersion = this.getConfigVersion(config);
    const applicable: MigrationRule[] = [];

    for (const migration of this.migrations) {
      if (this.compareVersions(migration.fromVersion, currentVersion) >= 0) {
        applicable.push(migration);
      }
    }

    return applicable;
  }

  /**
   * Validate configuration against current schema
   */
  private validateConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation - would be more comprehensive in real implementation
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
    }

    if (this.options.strictMode) {
      // Strict mode validation
      if (!config.version && !config.configVersion) {
        errors.push('Configuration version is required in strict mode');
      }

      if (!config.input && !config.inputDir) {
        errors.push('Input directory configuration is required');
      }

      if (!config.output && !config.outputDir) {
        errors.push('Output directory configuration is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create backup of configuration
   */
  private createBackup(_config: any): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupKey = `config-backup-${timestamp}`;

    // In a real implementation, this would save to file or database
    // const backupData = { timestamp, version: this.getConfigVersion(_config), _config };
    this.logger.debug('Configuration backup created', { backupKey });

    return backupKey;
  }

  /**
   * Apply migrations to a configuration
   */
  async migrateConfig(config: any): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      oldVersion: this.getConfigVersion(config),
      newVersion: this.getConfigVersion(config),
      appliedMigrations: [],
      warnings: [],
      errors: [],
    };

    try {
      // Validate input config
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
        this.logger.error('Configuration validation failed', { errors: validation.errors });
        return result;
      }

      // Check if migration is needed
      if (!this.needsMigration(config)) {
        result.success = true;
        result.newVersion = this.getLatestVersion();
        this.logger.debug('No migration needed', { version: result.oldVersion });
        return result;
      }

      // Create backup if enabled
      if (this.options.createBackups) {
        result.backupCreated = this.createBackup(config);
      }

      // Get applicable migrations
      const migrations = this.getApplicableMigrations(config);

      if (migrations.length === 0) {
        result.errors.push('No applicable migrations found');
        return result;
      }

      // Check for breaking changes
      const breakingMigrations = migrations.filter((m) => m.breaking);
      if (breakingMigrations.length > 0 && !this.options.allowBreakingChanges) {
        result.errors.push(
          `Breaking migrations found but not allowed: ${breakingMigrations.map((m) => m.description).join(', ')}`
        );
        return result;
      }

      // Apply migrations sequentially
      let migratedConfig = { ...config };

      for (const migration of migrations) {
        try {
          this.logger.debug('Applying migration', {
            from: migration.fromVersion,
            to: migration.toVersion,
            description: migration.description,
          });

          migratedConfig = migration.transform(migratedConfig);
          migratedConfig.version = migration.toVersion;

          result.appliedMigrations.push(
            `${migration.fromVersion} -> ${migration.toVersion}: ${migration.description}`
          );

          if (migration.breaking) {
            result.warnings.push(`Applied breaking migration: ${migration.description}`);
          }

          this.logger.debug('Migration applied successfully', {
            migration: migration.description,
            newVersion: migration.toVersion,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Migration failed (${migration.fromVersion} -> ${migration.toVersion}): ${errorMessage}`
          );
          this.logger.error('Migration failed', {
            migration: migration.description,
            error: errorMessage,
          });
          return result;
        }
      }

      // Final validation
      const finalValidation = this.validateConfig(migratedConfig);
      if (!finalValidation.valid) {
        result.errors.push('Migrated configuration is invalid');
        result.errors.push(...finalValidation.errors);
        return result;
      }

      result.success = true;
      result.newVersion = this.getConfigVersion(migratedConfig);

      this.logger.info('Configuration migration completed', {
        oldVersion: result.oldVersion,
        newVersion: result.newVersion,
        migrationsApplied: result.appliedMigrations.length,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Migration process failed: ${errorMessage}`);
      this.logger.error('Migration process failed', { error: errorMessage });
      return result;
    }
  }

  /**
   * Get migration history and status
   */
  getMigrationInfo(): {
    availableMigrations: number;
    latestVersion: string;
    supportedVersions: string[];
    breakingMigrations: MigrationRule[];
  } {
    const supportedVersions = new Set<string>();
    const breakingMigrations: MigrationRule[] = [];

    for (const migration of this.migrations) {
      supportedVersions.add(migration.fromVersion);
      supportedVersions.add(migration.toVersion);

      if (migration.breaking) {
        breakingMigrations.push(migration);
      }
    }

    return {
      availableMigrations: this.migrations.length,
      latestVersion: this.getLatestVersion(),
      supportedVersions: Array.from(supportedVersions).sort((a, b) => this.compareVersions(a, b)),
      breakingMigrations,
    };
  }

  /**
   * Dry run migration to preview changes
   */
  async previewMigration(config: any): Promise<{
    applicable: MigrationRule[];
    wouldBreak: boolean;
    estimatedChanges: string[];
  }> {
    const applicable = this.getApplicableMigrations(config);
    const wouldBreak = applicable.some((m) => m.breaking);
    const estimatedChanges = applicable.map((m) => m.description);

    return {
      applicable,
      wouldBreak,
      estimatedChanges,
    };
  }
}
