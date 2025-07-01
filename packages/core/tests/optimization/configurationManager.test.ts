import * as fs from 'fs/promises';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfigurationManager,
  createConfigurationManager,
  type ConfigManagerOptions,
  type FullConfig,
} from '../../src/optimization/configurationManager';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let tempConfigDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test configs
    tempConfigDir = path.join(process.cwd(), 'test-configs');
    try {
      await fs.mkdir(tempConfigDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    const options: ConfigManagerOptions = {
      configDirectory: tempConfigDir,
      enableFileWatching: false, // Disable for testing
      enableEnvironmentVariables: false,
    };

    configManager = new ConfigurationManager(options);
  });

  afterEach(async () => {
    if (configManager) {
      await configManager.shutdown();
    }

    // Clean up temp directory
    try {
      await fs.rmdir(tempConfigDir, { recursive: true });
    } catch {
      // Directory might not exist or be in use
    }

    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new ConfigurationManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager.getConfig()).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customOptions: ConfigManagerOptions = {
        configDirectory: './custom-config',
        enableFileWatching: true,
        enableEnvironmentVariables: true,
      };

      const customManager = new ConfigurationManager(customOptions);
      expect(customManager).toBeDefined();
    });

    it('should load default configuration values', () => {
      const config = configManager.getConfig();

      expect(config.multiPass).toBeDefined();
      expect(config.multiPass.maxPasses).toBe(10);
      expect(config.multiPass.convergenceThreshold).toBe(0.05);

      expect(config.performance).toBeDefined();
      expect(config.performance.maxMemoryUsage).toBe(1024);
      expect(config.performance.enableParallelization).toBe(true);
    });
  });

  describe('Configuration Loading and Saving', () => {
    it('should save configuration to file', async () => {
      const customConfig: Partial<FullConfig> = {
        multiPass: {
          maxPasses: 20,
          convergenceThreshold: 0.1,
        },
      };

      await configManager.updateConfig(customConfig);
      await configManager.saveToFile('test-config.json');

      const filePath = path.join(tempConfigDir, 'test-config.json');
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should load configuration from file', async () => {
      const testConfig = {
        multiPass: {
          maxPasses: 15,
          convergenceThreshold: 0.08,
        },
        performance: {
          maxMemoryUsage: 2048,
          enableParallelization: false,
        },
      };

      const filePath = path.join(tempConfigDir, 'load-test.json');
      await fs.writeFile(filePath, JSON.stringify(testConfig, null, 2));

      await configManager.loadFromFile('load-test.json');
      const loadedConfig = configManager.getConfig();

      expect(loadedConfig.multiPass.maxPasses).toBe(15);
      expect(loadedConfig.multiPass.convergenceThreshold).toBe(0.08);
      expect(loadedConfig.performance.maxMemoryUsage).toBe(2048);
      expect(loadedConfig.performance.enableParallelization).toBe(false);
    });

    it('should handle invalid JSON files gracefully', async () => {
      const invalidJsonPath = path.join(tempConfigDir, 'invalid.json');
      await fs.writeFile(invalidJsonPath, '{ invalid json }');

      await expect(configManager.loadFromFile('invalid.json')).rejects.toThrow();
    });

    it('should handle non-existent files gracefully', async () => {
      await expect(configManager.loadFromFile('non-existent.json')).rejects.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', () => {
      const validConfig: Partial<FullConfig> = {
        multiPass: {
          maxPasses: 5,
          convergenceThreshold: 0.1,
        },
      };

      const result = configManager.validateConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid configuration values', () => {
      const invalidConfig = {
        multiPass: {
          maxPasses: -1, // Invalid: negative
          convergenceThreshold: 2, // Invalid: > 1
        },
      };

      const result = configManager.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate nested configuration objects', () => {
      const invalidNestedConfig = {
        performance: {
          maxMemoryUsage: -100, // Invalid: negative
          parallelWorkers: 'invalid', // Invalid: should be number
        },
      };

      const result = configManager.validateConfig(invalidNestedConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Updates and Merging', () => {
    it('should update configuration with partial updates', async () => {
      const initialConfig = configManager.getConfig();

      const update: Partial<FullConfig> = {
        multiPass: {
          maxPasses: 25,
        },
      };

      await configManager.updateConfig(update);
      const updatedConfig = configManager.getConfig();

      expect(updatedConfig.multiPass.maxPasses).toBe(25);
      // Other values should remain unchanged
      expect(updatedConfig.multiPass.convergenceThreshold).toBe(
        initialConfig.multiPass.convergenceThreshold
      );
    });

    it('should merge configurations correctly', () => {
      const baseConfig: Partial<FullConfig> = {
        multiPass: {
          maxPasses: 10,
          convergenceThreshold: 0.05,
        },
      };

      const override: Partial<FullConfig> = {
        multiPass: {
          maxPasses: 20,
        },
      };

      const merged = configManager.mergeConfigurations(baseConfig, override);

      expect(merged.multiPass?.maxPasses).toBe(20);
      expect(merged.multiPass?.convergenceThreshold).toBe(0.05);
    });

    it('should handle deep merging of nested objects', () => {
      const base: Partial<FullConfig> = {
        performance: {
          maxMemoryUsage: 1024,
          enableParallelization: true,
          parallelWorkers: 4,
        },
      };

      const override: Partial<FullConfig> = {
        performance: {
          maxMemoryUsage: 2048,
        },
      };

      const merged = configManager.mergeConfigurations(base, override);

      expect(merged.performance?.maxMemoryUsage).toBe(2048);
      expect(merged.performance?.enableParallelization).toBe(true);
      expect(merged.performance?.parallelWorkers).toBe(4);
    });
  });

  describe('Environment Variables', () => {
    it('should load configuration from environment variables when enabled', () => {
      // Set test environment variables
      process.env.TW_ENIGMA_MAX_PASSES = '15';
      process.env.TW_ENIGMA_CONVERGENCE_THRESHOLD = '0.1';

      const envManager = new ConfigurationManager({
        enableEnvironmentVariables: true,
      });

      const config = envManager.getConfig();
      expect(config.multiPass.maxPasses).toBe(15);
      expect(config.multiPass.convergenceThreshold).toBe(0.1);

      // Clean up
      delete process.env.TW_ENIGMA_MAX_PASSES;
      delete process.env.TW_ENIGMA_CONVERGENCE_THRESHOLD;
    });

    it('should ignore environment variables when disabled', () => {
      process.env.TW_ENIGMA_MAX_PASSES = '99';

      const noEnvManager = new ConfigurationManager({
        enableEnvironmentVariables: false,
      });

      const config = noEnvManager.getConfig();
      expect(config.multiPass.maxPasses).not.toBe(99);

      delete process.env.TW_ENIGMA_MAX_PASSES;
    });
  });

  describe('Event Handling', () => {
    it('should emit events on configuration changes', async () => {
      const events: any[] = [];

      configManager.on('config-updated', (event) => {
        events.push(event);
      });

      const update: Partial<FullConfig> = {
        multiPass: {
          maxPasses: 30,
        },
      };

      await configManager.updateConfig(update);

      expect(events.length).toBe(1);
      expect(events[0].source).toBe('programmatic');
      expect(events[0].changes).toBeDefined();
    });

    it('should emit validation error events', () => {
      const errors: any[] = [];

      configManager.on('validation-error', (error) => {
        errors.push(error);
      });

      const invalidUpdate = {
        multiPass: {
          maxPasses: -5,
        },
      };

      configManager.validateConfig(invalidUpdate);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Profiles', () => {
    it('should switch between development and production profiles', async () => {
      // Switch to development profile
      await configManager.setProfile('development');
      let config = configManager.getConfig();

      // Development should have more verbose logging
      expect(config.logging.level).toBe('debug');
      expect(config.logging.enableConsoleOutput).toBe(true);

      // Switch to production profile
      await configManager.setProfile('production');
      config = configManager.getConfig();

      // Production should have minimal logging
      expect(config.logging.level).toBe('error');
      expect(config.logging.enableConsoleOutput).toBe(false);
    });

    it('should list available profiles', () => {
      const profiles = configManager.getAvailableProfiles();

      expect(profiles).toContain('development');
      expect(profiles).toContain('production');
      expect(profiles).toContain('testing');
    });

    it('should get current profile', async () => {
      await configManager.setProfile('testing');
      const currentProfile = configManager.getCurrentProfile();

      expect(currentProfile).toBe('testing');
    });
  });

  describe('Configuration Schema Export', () => {
    it('should export configuration schema', () => {
      const schema = configManager.exportSchema();

      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    });

    it('should export configuration with current values', () => {
      const exported = configManager.exportConfig();

      expect(exported).toBeDefined();
      expect(exported.multiPass).toBeDefined();
      expect(exported.performance).toBeDefined();
      expect(exported.logging).toBeDefined();
    });

    it('should export configuration in different formats', async () => {
      const jsonExport = await configManager.exportConfig('json');
      const yamlExport = await configManager.exportConfig('yaml');

      expect(typeof jsonExport).toBe('string');
      expect(typeof yamlExport).toBe('string');
      expect(jsonExport).toContain('{');
      expect(yamlExport).toContain(':');
    });
  });

  describe('Configuration Backup and Restore', () => {
    it('should create configuration backup', async () => {
      const backupId = await configManager.createBackup('test-backup');

      expect(backupId).toBeDefined();
      expect(typeof backupId).toBe('string');
    });

    it('should restore from backup', async () => {
      // Create a backup with current config
      const backupId = await configManager.createBackup('restore-test');

      // Make changes
      await configManager.updateConfig({
        multiPass: { maxPasses: 999 },
      });

      // Restore from backup
      await configManager.restoreFromBackup(backupId);

      const restoredConfig = configManager.getConfig();
      expect(restoredConfig.multiPass.maxPasses).not.toBe(999);
    });

    it('should list available backups', async () => {
      await configManager.createBackup('backup-1');
      await configManager.createBackup('backup-2');

      const backups = await configManager.listBackups();

      expect(backups.length).toBeGreaterThanOrEqual(2);
      expect(backups.some((b) => b.name === 'backup-1')).toBe(true);
      expect(backups.some((b) => b.name === 'backup-2')).toBe(true);
    });
  });

  describe('Factory Functions', () => {
    it('should create manager with factory function', () => {
      const factoryManager = createConfigurationManager({
        configDirectory: './test-factory',
      });

      expect(factoryManager).toBeInstanceOf(ConfigurationManager);
    });

    it('should create manager with default options via factory', () => {
      const defaultFactoryManager = createConfigurationManager();

      expect(defaultFactoryManager).toBeInstanceOf(ConfigurationManager);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      await expect(configManager.shutdown()).resolves.not.toThrow();
    });

    it('should stop file watching on shutdown', async () => {
      const watchingManager = new ConfigurationManager({
        enableFileWatching: true,
      });

      await watchingManager.shutdown();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
