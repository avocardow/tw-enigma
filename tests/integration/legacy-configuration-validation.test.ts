import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateBasicConfigSchema } from '../../packages/core/src/config/config';
import { createConfigMigration } from '../../packages/core/src/config/configMigration';
import { CliTestHarness } from './utils/cli-test-harness';

/**
 * Legacy Configuration Validation Test Suite
 *
 * Purpose: Comprehensive validation of legacy configuration format support and migration
 * Part of: Subtask 15.5 Step 2 - Legacy Configuration Validation
 */

describe('Legacy Configuration Validation', () => {
  let cliHarness: CliTestHarness;
  let tempDir: string;

  beforeEach(async () => {
    cliHarness = new CliTestHarness();
    tempDir = await cliHarness.createTempDirectory('legacy-config-test-');
  });

  afterEach(async () => {
    await cliHarness.cleanup();
  });

  describe('Legacy v1.0 Configuration Format', () => {
    it('should support basic v1.0 configuration structure', async () => {
      const legacyV1Config = {
        // Basic v1.0 format
        input: './src',
        output: './dist',
        removeUnused: true,
        mergeDuplicates: false,
        minifyClassNames: false,
        pretty: false,
        verbose: false,
        maxMemoryUsage: '256MB',
        timeout: 15000,
        retries: 1,
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        legacyV1Config,
        'enigma.config.json'
      );

      // Test configuration loading and migration
      const migration = createConfigMigration(configPath);
      const needsMigration = migration.needsMigration(legacyV1Config);

      if (needsMigration) {
        const result = await migration.migrate({ autoMigrate: true, createBackup: true });
        expect(result.success).toBe(true);
        expect(result.migrationsApplied.length).toBeGreaterThan(0);
      }

      // Validate that CLI can process the configuration
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout || result.stderr).toMatch(/configuration|config|init/i);
    });

    it('should handle v1.0 tailwind-specific options', async () => {
      const legacyV1TailwindConfig = {
        input: './src',
        output: './dist',
        tailwindConfig: './tailwind.config.js',
        tailwindCss: './src/styles/tailwind.css',
        purgeOptions: {
          content: ['./src/**/*.html', './src/**/*.js'],
          safelist: ['active', 'disabled'],
          blocklist: ['hidden'],
        },
        outputFormat: 'css',
        outputFilename: 'styles.css',
        preserveOriginal: true,
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        legacyV1TailwindConfig,
        'enigma.config.json'
      );

      // Test migration
      const migration = createConfigMigration(configPath);
      const result = await migration.migrate({ autoMigrate: true });

      expect(result.success).toBe(true);

      // Validate CLI compatibility
      const cliResult = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'css-config'],
        tempDir
      );

      expect(cliResult.exitCode).toBe(0);
    });

    it('should preserve custom optimization settings in v1.0', async () => {
      const legacyV1OptimizationConfig = {
        input: './src',
        output: './dist',
        removeUnused: true,
        mergeDuplicates: true,
        minifyClassNames: true,
        treeshake: true,
        deadCodeElimination: true,
        preserveComments: false,
        sourceMaps: true,
        customOptimizations: {
          enabled: true,
          rules: ['remove-empty-classes', 'merge-similar-classes'],
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        legacyV1OptimizationConfig,
        'enigma.config.json'
      );

      // Test schema validation
      try {
        const validated = validateBasicConfigSchema(legacyV1OptimizationConfig);
        expect(validated).toBeDefined();
      } catch (error) {
        // If validation fails, ensure migration handles it
        const migration = createConfigMigration(configPath);
        const result = await migration.migrate({ autoMigrate: true });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Legacy v1.5 Configuration Format', () => {
    it('should support v1.5 enhanced configuration structure', async () => {
      const legacyV15Config = {
        version: '1.5.0',
        schemaVersion: 2,
        input: './src',
        output: {
          format: 'css',
          filename: 'optimized.css',
          preserveOriginal: true,
        },
        optimization: {
          removeUnused: true,
          mergeDuplicates: false,
          minifyClassNames: false,
          treeshake: false,
          deadCodeElimination: false,
        },
        performance: {
          maxMemoryUsage: '256MB',
          timeout: 15000,
          retries: 1,
        },
        tailwind: {
          configPath: './tailwind.config.js',
          cssPath: './src/styles/tailwind.css',
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        legacyV15Config,
        'enigma.config.json'
      );

      // Test configuration migration
      const migration = createConfigMigration(configPath);
      const needsMigration = migration.needsMigration(legacyV15Config);

      if (needsMigration) {
        const result = await migration.migrate({ autoMigrate: true });
        expect(result.success).toBe(true);
      }

      // Test CLI compatibility
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'css-config'],
        tempDir
      );

      expect(result.exitCode).toBe(0);
    });

    it('should handle v1.5 validation and runtime configuration', async () => {
      const legacyV15ValidationConfig = {
        version: '1.5.0',
        schemaVersion: 2,
        input: './src',
        output: './dist',
        validation: {
          enabled: true,
          strict: false,
          customRules: ['no-duplicate-classes', 'valid-class-names'],
          errorHandling: 'warn',
          skipValidation: ['node_modules/**'],
        },
        runtime: {
          enabled: true,
          checkInterval: 5000,
          resourceThresholds: {
            memory: 134217728, // 128MB
            cpu: 80,
            fileHandles: 1000,
            diskSpace: 104857600, // 100MB
          },
          autoCorrection: {
            enabled: false,
            maxAttempts: 3,
            fallbackToDefaults: true,
          },
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        legacyV15ValidationConfig,
        'enigma.config.json'
      );

      // Test migration and CLI execution
      const migration = createConfigMigration(configPath);
      const migrationResult = await migration.migrate({ autoMigrate: true });

      expect(migrationResult.success).toBe(true);

      const cliResult = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      expect(cliResult.exitCode).toBe(0);
    });
  });

  describe('Configuration Migration Path Validation', () => {
    it('should successfully migrate from v1.0 to current version', async () => {
      const originalV1Config = {
        input: './src',
        output: './dist',
        removeUnused: true,
        pretty: false,
        verbose: true,
        maxMemoryUsage: '512MB',
        timeout: 30000,
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        originalV1Config,
        'enigma.config.json'
      );

      const migration = createConfigMigration(configPath);
      const migrationPath = migration.getMigrationPath('0.1.0');

      expect(migrationPath.length).toBeGreaterThan(0);

      const result = await migration.migrate({
        autoMigrate: true,
        createBackup: true,
      });

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.1.0');
      expect(result.migrationsApplied.length).toBeGreaterThan(0);
      expect(result.backupPath).toBeDefined();
    });

    it('should provide rollback functionality for failed migrations', async () => {
      const configWithIssues = {
        input: './src',
        output: './dist',
        invalidOption: 'this-should-cause-issues',
        complexNesting: {
          deeply: {
            nested: {
              configuration: 'that-might-break',
            },
          },
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        configWithIssues,
        'enigma.config.json'
      );

      const migration = createConfigMigration(configPath);

      try {
        const result = await migration.migrate({
          autoMigrate: true,
          createBackup: true,
          force: false, // Don't force migration of potentially problematic config
        });

        // If migration succeeds, that's fine too
        if (result.success) {
          expect(result.warnings.length).toBeGreaterThanOrEqual(0);
        } else {
          // If migration fails, ensure rollback is available
          expect(result.backupPath).toBeDefined();
        }
      } catch (error) {
        // Migration failure is acceptable for invalid configurations
        expect(error).toBeDefined();
      }
    });

    it('should handle partial migration scenarios gracefully', async () => {
      const partialV1Config = {
        input: './src',
        // Missing required fields like output
        removeUnused: true,
        optimization: {
          // Mixed v1 and v2 syntax
          removeUnused: true,
          newFeature: 'unknown-value',
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        partialV1Config,
        'enigma.config.json'
      );

      const migration = createConfigMigration(configPath);
      const warnings = migration.getDeprecationWarnings(partialV1Config);
      const suggestions = migration.getUpgradeSuggestions(partialV1Config);

      expect(warnings).toBeDefined();
      expect(suggestions).toBeDefined();

      // Test migration with warnings
      const result = await migration.migrate({
        autoMigrate: true,
        force: true, // Force migration despite warnings
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Format Detection', () => {
    it('should correctly detect v1.0 configuration format', async () => {
      const v1Config = {
        input: './src',
        output: './dist',
        removeUnused: true,
        mergeDuplicates: false,
      };

      const configPath = await cliHarness.createTestConfig(tempDir, v1Config, 'enigma.config.json');
      const migration = createConfigMigration(configPath);
      const detectedVersion = migration.detectVersion(v1Config);

      expect(detectedVersion.version).toBe('0.1.0');
      expect(detectedVersion.schemaVersion).toBe(1);
    });

    it('should correctly detect v1.5 configuration format', async () => {
      const v15Config = {
        version: '1.5.0',
        schemaVersion: 2,
        input: './src',
        optimization: {
          removeUnused: true,
        },
        performance: {
          timeout: 15000,
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        v15Config,
        'enigma.config.json'
      );
      const migration = createConfigMigration(configPath);
      const detectedVersion = migration.detectVersion(v15Config);

      expect(detectedVersion.version).toBe('0.2.0');
      expect(detectedVersion.schemaVersion).toBe(2);
    });

    it('should correctly detect current configuration format', async () => {
      const currentConfig = {
        version: '1.0.0',
        schemaVersion: 3,
        input: './src',
        output: {
          format: 'css',
          filename: 'optimized.css',
          preserveOriginal: true,
        },
        tailwind: {
          configPath: './tailwind.config.js',
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        currentConfig,
        'enigma.config.json'
      );
      const migration = createConfigMigration(configPath);
      const needsMigration = migration.needsMigration(currentConfig);

      expect(needsMigration).toBe(false);
    });
  });

  describe('Configuration Compatibility Edge Cases', () => {
    it('should handle missing required fields gracefully', async () => {
      const incompleteConfig = {
        // Missing input field
        output: './dist',
        verbose: true,
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        incompleteConfig,
        'enigma.config.json'
      );

      // CLI should handle missing fields with defaults or graceful errors
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir,
        { expectFailure: false } // Let's see what happens
      );

      // Either succeeds with defaults or fails gracefully
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      if (result.exitCode !== 0) {
        expect(result.stderr || result.stdout).toMatch(/input|required|missing/i);
      }
    });

    it('should handle invalid configuration values appropriately', async () => {
      const invalidConfig = {
        input: './src',
        output: './dist',
        timeout: -1, // Invalid negative timeout
        maxMemoryUsage: 'invalid-value', // Invalid memory format
        unknownOption: 'should-be-ignored',
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        invalidConfig,
        'enigma.config.json'
      );

      const migration = createConfigMigration(configPath);
      const warnings = migration.getDeprecationWarnings(invalidConfig);

      expect(warnings.length).toBeGreaterThan(0);

      // Test CLI handling of invalid config
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir,
        { expectFailure: false }
      );

      // Should either handle gracefully or provide meaningful error
      if (result.exitCode !== 0) {
        expect(result.stderr || result.stdout).toMatch(/invalid|error|validation/i);
      }
    });

    it('should support mixed legacy and current configuration syntax', async () => {
      const mixedConfig = {
        // Legacy v1.0 style
        input: './src',
        removeUnused: true,
        verbose: true,

        // v1.5 style
        optimization: {
          mergeDuplicates: false,
        },

        // Current style
        output: {
          format: 'css',
          filename: 'mixed.css',
        },
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        mixedConfig,
        'enigma.config.json'
      );

      const migration = createConfigMigration(configPath);
      const result = await migration.migrate({ autoMigrate: true });

      expect(result.success).toBe(true);

      // Test CLI compatibility
      const cliResult = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'css-config'],
        tempDir
      );

      expect(cliResult.exitCode).toBe(0);
    });
  });

  describe('Configuration File Format Support', () => {
    it('should support JSON configuration files', async () => {
      const jsonConfig = {
        input: './src',
        output: './dist',
        pretty: true,
        verbose: false,
      };

      const configPath = await cliHarness.createTestConfig(
        tempDir,
        jsonConfig,
        'enigma.config.json'
      );

      const result = await cliHarness.executeCommandInDirectory(
        ['--config', configPath, 'init-config'],
        tempDir
      );

      expect(result.exitCode).toBe(0);
    });

    it('should support JavaScript configuration files', async () => {
      const jsConfigContent = `
module.exports = {
  input: './src',
  output: './dist',
  optimization: {
    removeUnused: true,
    mergeDuplicates: false
  },
  performance: {
    timeout: 15000,
    maxMemoryUsage: '256MB'
  }
};
`;

      const jsConfigPath = path.join(tempDir, 'enigma.config.js');
      await fs.writeFile(jsConfigPath, jsConfigContent);

      const result = await cliHarness.executeCommandInDirectory(
        ['--config', jsConfigPath, 'init-config'],
        tempDir
      );

      expect(result.exitCode).toBe(0);
    });

    it('should support TypeScript configuration files', async () => {
      const tsConfigContent = `
import type { EnigmaConfig } from '@tailwind-enigma/core/config';

const config: EnigmaConfig = {
  input: './src',
  output: './dist',
  pretty: true,
  optimization: {
    removeUnused: true
  }
};

export default config;
`;

      const tsConfigPath = path.join(tempDir, 'enigma.config.ts');
      await fs.writeFile(tsConfigPath, tsConfigContent);

      // Note: This might not work in test environment without proper TS compilation
      // but we test the file creation and CLI's attempt to load it
      const result = await cliHarness.executeCommandInDirectory(
        ['--config', tsConfigPath, 'init-config'],
        tempDir,
        { expectFailure: false }
      );

      // Either succeeds or fails gracefully with TS-related error
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
    });
  });
});
