/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

// Import all validation components
import { createConfigValidator, validateConfigSchema } from '../src/configValidator.js';
import { createRuntimeValidator, validateConfigRuntime } from '../src/runtimeValidator.js';
import { createConfigWatcher, watchConfigFile } from '../src/configWatcher.js';
import { createConfigDefaults, getEnvironmentDefaults } from '../src/configDefaults.js';
import { createConfigMigration, migrateConfig, needsConfigMigration } from '../src/configMigration.js';
import { createPerformanceValidator, analyzeConfigPerformance } from '../src/performanceValidator.js';
import { createConfigBackup, backupConfig, restoreConfig } from '../src/configBackup.js';
import { type EnigmaConfig } from '../src/config.js';

// Test utilities
function createTempDir(): string {
  const tempDir = join(tmpdir(), `tw-enigma-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function createTestConfig(overrides: Partial<EnigmaConfig> = {}): EnigmaConfig {
  return {
    pretty: false,
    input: './src',
    output: './dist',
    minify: true,
    removeUnused: true,
    verbose: false,
    veryVerbose: false,
    quiet: false,
    debug: false,
    maxConcurrency: 4,
    classPrefix: '',
    excludePatterns: [],
    followSymlinks: false,
    excludeExtensions: [],
    preserveComments: false,
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
    ...overrides
  };
}

describe('Configuration Validation System', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = createTempDir();
    configPath = join(tempDir, 'config.json');
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('JSON Schema Validation', () => {
    test('should validate valid configuration', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const validator = createConfigValidator();
      const result = await validator.validateFile(configPath);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toEqual(config);
    });

    test('should detect invalid configuration structure', async () => {
      const invalidConfig = {
        input: 123, // Should be string
        output: [], // Should be string
        maxConcurrency: 'invalid' // Should be number
      };
      writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2));

      const validator = createConfigValidator();
      const result = await validator.validateFile(configPath);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => (typeof e === 'string' ? e : e.message || e.toString()).includes('input'))).toBe(true);
      expect(result.errors.some(e => (typeof e === 'string' ? e : e.message || e.toString()).includes('output'))).toBe(true);
      expect(result.errors.some(e => (typeof e === 'string' ? e : e.message || e.toString()).includes('maxConcurrency'))).toBe(true);
    });

    test('should validate configuration with custom schema', async () => {
      const config = createTestConfig();
      const result = await validateConfigSchema(config);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(config);
    });

    test('should handle malformed JSON', async () => {
      writeFileSync(configPath, '{ invalid json }');

      const validator = createConfigValidator();
      const result = await validator.validateFile(configPath);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => (typeof e === 'string' ? e : e.message || e.toString()).includes('JSON'))).toBe(true);
    });

    test('should validate nested configuration objects', async () => {
      const config = createTestConfig({
        dev: {
          enabled: true,
          watch: true,
          server: {
            enabled: true,
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
      });

      const result = await validateConfigSchema(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Runtime Validation', () => {
    test('should validate file system paths', async () => {
      const config = createTestConfig({
        input: tempDir, // Valid existing directory
        output: join(tempDir, 'output')
      });

      const validator = createRuntimeValidator(config);
      const result = await validator.validatePaths();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid input paths', async () => {
      const config = createTestConfig({
        input: '/nonexistent/path'
      });

      const validator = createRuntimeValidator(config);
      const result = await validator.validatePaths();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => (typeof e === 'string' ? e : e.message || e.toString()).includes('nonexistent'))).toBe(true);
    });

    test('should validate resource constraints', async () => {
      const config = createTestConfig({
        runtime: {
          enabled: true,
          checkInterval: 5000,
          resourceThresholds: {
            memory: 1, // Very low threshold
            cpu: 1,
            fileHandles: 1,
            diskSpace: 1,
          },
          autoCorrection: {
            enabled: false,
            maxAttempts: 3,
            fallbackToDefaults: true,
          },
        }
      });

      const validator = createRuntimeValidator(config);
      const result = await validator.validateConstraints();

      expect(result.warnings.some(w => (typeof w === 'string' ? w : w.message || w.toString()).includes('memory') || (typeof w === 'string' ? w : w.message || w.toString()).includes('threshold'))).toBe(true);
    });

    test('should validate concurrency settings', async () => {
      const config = createTestConfig({
        maxConcurrency: 1000 // Too high
      });

      const validator = createRuntimeValidator(config);
      const result = await validator.validateConstraints();

      expect(result.warnings.some(w => (typeof w === 'string' ? w : w.message || w.toString()).includes('concurrency'))).toBe(true);
    });

    test('should validate complete configuration', async () => {
      const config = createTestConfig();
      const result = await validateConfigRuntime(config);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Configuration File Watching', () => {
    test('should detect configuration changes', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const watcher = await watchConfigFile(configPath);
      const changePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timeout: No change event received within 5 seconds'));
        }, 5000);
        
        watcher.on('config-changed', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      });

      // Modify configuration after a brief delay
      setTimeout(() => {
        const updatedConfig = { ...config, minify: false };
        writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      }, 100);

      await changePromise;
      await watcher.stop();

      expect(true).toBe(true); // Test passed if no timeout
    }, 10000);

    test('should validate changes automatically', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const watcher = await watchConfigFile(configPath, {
        validateOnChange: true
      });

      const validationPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timeout: No validation event received within 5 seconds'));
        }, 5000);
        
        watcher.on('config-validated', (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      });

      // Make valid change after a brief delay
      setTimeout(() => {
        const updatedConfig = { ...config, maxConcurrency: 8 };
        writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      }, 100);

      const validationResult = await validationPromise;
      await watcher.stop();

      expect(validationResult).toBeDefined();
    }, 10000);
  });

  describe('Configuration Defaults', () => {
    test('should provide development defaults', () => {
      const defaults = getEnvironmentDefaults('development');

      expect(defaults.dev.watch).toBe(true);
      expect(defaults.minify).toBe(false);
      expect(defaults.sourceMaps).toBe(true);
      expect(defaults.removeUnused).toBe(false);
    });

    test('should provide production defaults', () => {
      const defaults = getEnvironmentDefaults('production');

      expect(defaults.dev.watch).toBe(false);
      expect(defaults.minify).toBe(true);
      expect(defaults.sourceMaps).toBe(false);
      expect(defaults.removeUnused).toBe(true);
    });

    test('should create configuration with fallbacks', () => {
      const partialConfig = {
        input: './custom/src'
      };

      const defaultsManager = createConfigDefaults('development');
      const config = defaultsManager.createConfigWithDefaults(partialConfig);

      expect(config.input).toBe('./custom/src');
      expect(config.output).toBeDefined();
      expect(config.maxConcurrency).toBeDefined();
      expect(config.dev).toBeDefined();
    });

    test('should apply progressive fallbacks', () => {
      const defaultsManager = createConfigDefaults('production');
      const config = defaultsManager.createConfigWithDefaults({});

      expect(config.input).toBe('./src');
      expect(config.output).toBe('./dist');
      expect(config.minify).toBe(true);
    });
  });

  describe('Configuration Migration', () => {
    test('should detect migration needs', () => {
      const oldConfig = {
        input: './src',
        output: './dist',
        removeUnused: true, // Old format
        mergeDuplicates: false // Old format
      };

      const needsMigration = needsConfigMigration(configPath);
      writeFileSync(configPath, JSON.stringify(oldConfig, null, 2));
      
      const migration = createConfigMigration(configPath);
      expect(migration.needsMigration(oldConfig)).toBe(true);
    });

    test('should migrate from v0.1.0 to v0.2.0', async () => {
      const oldConfig = {
        input: './src',
        output: './dist',
        removeUnused: true,
        mergeDuplicates: false,
        minifyClassNames: true
      };
      writeFileSync(configPath, JSON.stringify(oldConfig, null, 2));

      const result = await migrateConfig(configPath, {
        autoMigrate: true,
        createBackup: false
      });

      if (!result.success) {
        // Log migration errors for debugging
         
        console.error('Migration errors:', result.errors);
      }
      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toContain('0.1.0->0.2.0');

      const migratedContent = readFileSync(configPath, 'utf-8');
      const migratedConfig = JSON.parse(migratedContent);
      
      expect(migratedConfig.validation).toBeDefined();
      expect(migratedConfig.runtime).toBeDefined();
    });

    test('should create backup during migration', async () => {
      const oldConfig = {
        input: './src',
        output: './dist',
        removeUnused: true
      };
      writeFileSync(configPath, JSON.stringify(oldConfig, null, 2));

      const result = await migrateConfig(configPath, {
        autoMigrate: true,
        createBackup: true
      });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(existsSync(result.backupPath!)).toBe(true);
    });

    test('should handle migration errors gracefully', async () => {
      writeFileSync(configPath, '{ invalid json }');

      const result = await migrateConfig(configPath, {
        autoMigrate: true
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Validation', () => {
    test('should analyze configuration performance', async () => {
      const config = createTestConfig({
        maxConcurrency: 1,
        runtime: {
          enabled: true,
          checkInterval: 5000,
          resourceThresholds: {
            memory: 128 * 1024 * 1024, // 128MB
            cpu: 80,
            fileHandles: 1000,
            diskSpace: 100 * 1024 * 1024,
          },
          autoCorrection: {
            enabled: false,
            maxAttempts: 3,
            fallbackToDefaults: true,
          },
        }
      });

      const metrics = await analyzeConfigPerformance(config);

      expect(metrics.score).toBeGreaterThan(0);
      expect(metrics.score).toBeLessThanOrEqual(100);
      expect(metrics.memoryImpact).toBeDefined();
      expect(metrics.cpuImpact).toBeDefined();
      expect(metrics.recommendations).toBeDefined();
    });

    test('should detect performance bottlenecks', async () => {
      const config = createTestConfig({
        maxConcurrency: 100, // Too high
        dev: {
          enabled: true,
          watch: true,
          server: {
            enabled: true,
            port: 3000,
            host: 'localhost',
            open: true,
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
            enabled: true,
            autoRefresh: true,
            showDiff: true,
            highlightChanges: true,
          },
          dashboard: {
            enabled: true,
            port: 3001,
            host: 'localhost',
            updateInterval: 100, // Very frequent updates
            showMetrics: true,
            showLogs: true,
            maxLogEntries: 1000,
          },
        }
      });

      const validator = createPerformanceValidator(config);
      const metrics = await validator.analyzePerformance();

      expect(metrics.warnings.length).toBeGreaterThan(0);
      expect(metrics.bottlenecks.length).toBeGreaterThan(0);
      expect(metrics.score).toBeLessThan(100);
    });

    test('should provide optimization recommendations', async () => {
      const config = createTestConfig({
        maxConcurrency: 1, // Low concurrency
        // No caching enabled
      });

      const metrics = await analyzeConfigPerformance(config);

      expect(metrics.recommendations.length).toBeGreaterThan(0);
      expect(metrics.recommendations.some(r => r.title.includes('Concurrency') || r.title.includes('concurrency'))).toBe(true);
    });

    test('should calculate performance scores correctly', async () => {
      const goodConfig = createTestConfig({
        maxConcurrency: 4,
        runtime: {
          enabled: true,
          checkInterval: 5000,
          resourceThresholds: {
            memory: 512 * 1024 * 1024, // 512MB
            cpu: 80,
            fileHandles: 1000,
            diskSpace: 100 * 1024 * 1024,
          },
          autoCorrection: {
            enabled: false,
            maxAttempts: 3,
            fallbackToDefaults: true,
          },
        }
      });

      const badConfig = createTestConfig({
        maxConcurrency: 100,
        runtime: {
          enabled: true,
          checkInterval: 100, // Very frequent checks
          resourceThresholds: {
            memory: 32 * 1024 * 1024, // Very low memory
            cpu: 10, // Very low CPU
            fileHandles: 10,
            diskSpace: 1024 * 1024, // Very low disk space
          },
          autoCorrection: {
            enabled: false,
            maxAttempts: 3,
            fallbackToDefaults: true,
          },
        }
      });

      const goodMetrics = await analyzeConfigPerformance(goodConfig);
      const badMetrics = await analyzeConfigPerformance(badConfig);

      expect(goodMetrics.score).toBeGreaterThan(badMetrics.score);
    });
  });

  describe('Configuration Backup', () => {
    test('should create configuration backup', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const backup = await backupConfig(configPath, {
        description: 'Test backup',
        tags: ['test']
      });

      expect(backup.id).toBeDefined();
      expect(backup.backupPath).toBeDefined();
      expect(existsSync(backup.backupPath)).toBe(true);
      expect(backup.description).toBe('Test backup');
      expect(backup.tags).toContain('test');
    });

    test('should restore configuration from backup', async () => {
      const originalConfig = createTestConfig();
      writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));

      // Create backup
      const backupManager = createConfigBackup(configPath);
      const backup = await backupManager.createBackup({
        description: 'Original config'
      });

      // Modify configuration
      const modifiedConfig = { ...originalConfig, minify: false };
      writeFileSync(configPath, JSON.stringify(modifiedConfig, null, 2));

      // Restore from backup
      const restoreResult = await restoreConfig(configPath, backup.id);

      expect(restoreResult.success).toBe(true);

      // Verify restoration
      const restoredContent = readFileSync(configPath, 'utf-8');
      const restoredConfig = JSON.parse(restoredContent);
      expect(restoredConfig.minify).toBe(true); // Should be restored to original
    });

    test('should verify backup integrity', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const backupManager = createConfigBackup(configPath);
      const backup = await backupManager.createBackup();

      const verification = await backupManager.verifyBackup(backup.id);

      expect(verification.isValid).toBe(true);
      expect(verification.checksumMatch).toBe(true);
      expect(verification.fileExists).toBe(true);
      expect(verification.isReadable).toBe(true);
      expect(verification.isValidJson).toBe(true);
    });

    test('should detect corrupted backups', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const backupManager = createConfigBackup(configPath);
      const backup = await backupManager.createBackup();

      // Corrupt the backup file
      writeFileSync(backup.backupPath, 'corrupted content');

      // Re-instantiate backup manager to reload metadata
      const backupManagerReloaded = createConfigBackup(configPath);
      const verification = await backupManagerReloaded.verifyBackup(backup.id);

      expect(verification.isValid).toBe(false);
      expect(verification.checksumMatch).toBe(false);
      expect(verification.errors.some(e => (typeof e === 'string' ? e : e.message || e.toString()).toLowerCase().includes('checksum'))).toBe(true);
    });

    test('should apply retention policy', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const backupManager = createConfigBackup(configPath, undefined, {
        maxBackups: 2,
        autoCleanup: true
      });

      // Create multiple automatic backups (no description)
      await backupManager.createBackup();
      await backupManager.createBackup();
      await backupManager.createBackup();

      const backups = backupManager.listBackups();
      expect(backups.length).toBeLessThanOrEqual(2);
    });

    test('should list and filter backups', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      const backupManager = createConfigBackup(configPath);

      await backupManager.createBackup({
        description: 'Manual backup',
        tags: ['manual', 'important']
      });
      await backupManager.createBackup(); // Automatic backup

      const allBackups = backupManager.listBackups();
      const manualBackups = backupManager.listBackups({ isAutomatic: false });
      const taggedBackups = backupManager.listBackups({ tags: ['important'] });

      expect(allBackups.length).toBe(2);
      expect(manualBackups.length).toBe(1);
      expect(taggedBackups.length).toBe(1);
      expect(manualBackups[0].description).toBe('Manual backup');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete validation workflow', async () => {
      const config = createTestConfig();
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      // 1. Schema validation
      const schemaResult = await validateConfigSchema(config);
      expect(schemaResult.success).toBe(true);

      // 2. Runtime validation
      const runtimeResult = await validateConfigRuntime(config);
      expect(runtimeResult.isValid).toBe(true);

      // 3. Performance analysis
      const performanceMetrics = await analyzeConfigPerformance(config);
      expect(performanceMetrics.score).toBeGreaterThan(0);

      // 4. Create backup
      const backup = await backupConfig(configPath);
      expect(backup.id).toBeDefined();

      // 5. Migration check
      const migration = createConfigMigration(configPath);
      const result = await migration.migrate({ autoMigrate: true });
      const needsMigration = migration.needsMigration(config);
      expect(typeof needsMigration).toBe('boolean');
    });

    test('should handle configuration with all validation systems', async () => {
      const config = createTestConfig({
        validation: {
          enabled: true,
          validateOnLoad: true,
          validateOnChange: true,
          strictMode: true,
          warnOnDeprecated: true,
          failOnInvalid: true,
          crossFieldValidation: true,
          securityValidation: true,
          performanceValidation: true,
          customRules: [],
        },
        runtime: {
          enabled: true,
          checkInterval: 5000,
          resourceThresholds: {
            memory: 512 * 1024 * 1024,
            cpu: 80,
            fileHandles: 1000,
            diskSpace: 100 * 1024 * 1024,
          },
          autoCorrection: {
            enabled: true,
            maxAttempts: 3,
            fallbackToDefaults: true,
          },
        }
      });

      // Test all validation systems
      const validator = createConfigValidator();
      const runtimeValidator = createRuntimeValidator(config);
      const performanceValidator = createPerformanceValidator(config);
      const backupManager = createConfigBackup(configPath);

      // Run validations
      const schemaValidation = await validator.validateConfiguration(config);
      const runtimeValidation = await validateConfigRuntime(config);
      const performanceAnalysis = await performanceValidator.analyzePerformance();

      expect(schemaValidation.isValid).toBe(true);
      expect(runtimeValidation.isValid).toBe(true);
      expect(performanceAnalysis.score).toBeGreaterThan(0);
    });

    test('should handle error recovery and fallbacks', async () => {
      // Test with invalid configuration
      const invalidConfig = {
        input: 123, // Invalid type
        maxConcurrency: -1, // Invalid value
        runtime: {
          resourceThresholds: {
            memory: 'invalid' // Invalid type
          }
        }
      };

      const defaultsManager = createConfigDefaults('development');
      const validConfig = defaultsManager.createConfigWithDefaults(invalidConfig);

      // Should have valid defaults applied
      expect(typeof validConfig.input).toBe('string');
      expect(validConfig.maxConcurrency).toBeGreaterThan(0);
      expect(typeof validConfig.runtime.resourceThresholds.memory).toBe('number');
    });
  });
});

describe('Configuration Validation Edge Cases', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = createTempDir();
    configPath = join(tempDir, 'config.json');
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle empty configuration file', async () => {
    writeFileSync(configPath, '{}');

    const validator = createConfigValidator();
    const result = await validator.validateFile(configPath);

    // Should apply defaults for missing required fields
    expect(result.config?.input).toBeDefined();
    expect(result.config?.output).toBeDefined();
  });

  test('should handle very large configuration files', async () => {
    const largeConfig = createTestConfig({
      excludePatterns: new Array(1000).fill('node_modules/**'),
      excludeExtensions: new Array(100).fill('.test.js')
    });

    writeFileSync(configPath, JSON.stringify(largeConfig, null, 2));

    const validator = createConfigValidator();
    const result = await validator.validateFile(configPath);

    expect(result.isValid).toBe(true);
  });

  test('should handle concurrent validation requests', async () => {
    const config = createTestConfig();
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const validator = createConfigValidator();
    
    // Run multiple validations concurrently
    const promises = Array.from({ length: 10 }, () => 
      validator.validateFile(configPath)
    );

    const results = await Promise.all(promises);
    
    results.forEach(result => {
      expect(result.isValid).toBe(true);
    });
  });

  test('should handle file system permission errors', async () => {
    const config = createTestConfig({
      input: '/root/restricted' // Likely to cause permission error
    });

    const runtimeValidator = createRuntimeValidator(config);
    const result = await runtimeValidator.validatePaths();

    // Should handle permission errors gracefully
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.isValid).toBe(false);
  });

  test('should handle network timeouts in performance analysis', async () => {
    const config = createTestConfig({
      runtime: {
        enabled: true,
        checkInterval: 1, // Very short interval
        resourceThresholds: {
          memory: 1024 * 1024 * 1024,
          cpu: 80,
          fileHandles: 1000,
          diskSpace: 100 * 1024 * 1024,
        },
        autoCorrection: {
          enabled: false,
          maxAttempts: 0, // No retries
          fallbackToDefaults: true,
        },
      }
    });

    const performanceValidator = createPerformanceValidator(config);
    const metrics = await performanceValidator.analyzePerformance();

    expect(metrics.warnings.some(w => (typeof w === 'string' ? w : w.message || w.toString()).includes('interval') || (typeof w === 'string' ? w : w.message || w.toString()).includes('frequent'))).toBe(true);
  });
}); 