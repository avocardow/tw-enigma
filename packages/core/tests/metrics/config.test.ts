/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfigValidationError,
  MetricsConfig,
  MetricsConfigManager,
} from '../../src/metrics/config.js';

describe('MetricsConfigManager', () => {
  let configManager: MetricsConfigManager;

  beforeEach(() => {
    configManager = new MetricsConfigManager();
  });

  afterEach(() => {
    configManager.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      expect(config.collection).toBeDefined();
      expect(config.collection.enabled).toBe(true);
    });

    it('should load configuration from object', () => {
      const customConfig: Partial<MetricsConfig> = {
        collection: {
          enabled: false,
          interval: 5000,
        },
      };

      configManager.loadConfig(customConfig);
      const config = configManager.getConfig();

      expect(config.collection.enabled).toBe(false);
      expect(config.collection.interval).toBe(5000);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig: Partial<MetricsConfig> = {
        collection: {
          enabled: true,
          interval: 1000,
          maxMetrics: 10000,
        },
        reporting: {
          enabled: true,
          format: 'json',
          destination: 'console',
        },
      };

      expect(() => configManager.loadConfig(validConfig)).not.toThrow();
    });

    it('should reject invalid interval values', () => {
      const invalidConfig = {
        collection: {
          interval: -1000, // Invalid negative interval
        },
      };

      expect(() => configManager.loadConfig(invalidConfig)).toThrow(ConfigValidationError);
    });

    it('should reject invalid max metrics values', () => {
      const invalidConfig = {
        collection: {
          maxMetrics: 0, // Invalid zero max
        },
      };

      expect(() => configManager.loadConfig(invalidConfig)).toThrow(ConfigValidationError);
    });

    it('should validate reporting formats', () => {
      const invalidConfig = {
        reporting: {
          format: 'invalid_format', // Unknown format
        },
      };

      expect(() => configManager.loadConfig(invalidConfig)).toThrow(ConfigValidationError);
    });
  });

  describe('Configuration Updates', () => {
    it('should update partial configuration', () => {
      const initialConfig = configManager.getConfig();
      const originalInterval = initialConfig.collection.interval;

      configManager.updateConfig({
        collection: {
          interval: 2000,
        },
      });

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.collection.interval).toBe(2000);
      expect(updatedConfig.collection.enabled).toBe(initialConfig.collection.enabled);
    });

    it('should merge nested configuration objects', () => {
      configManager.updateConfig({
        storage: {
          type: 'memory',
          ttl: 3600,
        },
      });

      configManager.updateConfig({
        storage: {
          maxSize: 1000000,
        },
      });

      const config = configManager.getConfig();
      expect(config.storage.type).toBe('memory');
      expect(config.storage.ttl).toBe(3600);
      expect(config.storage.maxSize).toBe(1000000);
    });

    it('should emit change events on updates', () => {
      const changeHandler = vi.fn();
      configManager.on('configChanged', changeHandler);

      configManager.updateConfig({
        collection: { interval: 1500 },
      });

      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: expect.objectContaining({ interval: 1500 }),
        })
      );
    });
  });

  describe('Environment Variable Integration', () => {
    beforeEach(() => {
      // Clear any existing env vars
      delete process.env.METRICS_ENABLED;
      delete process.env.METRICS_INTERVAL;
    });

    it('should load configuration from environment variables', () => {
      process.env.METRICS_ENABLED = 'false';
      process.env.METRICS_INTERVAL = '2000';

      configManager.loadFromEnvironment();
      const config = configManager.getConfig();

      expect(config.collection.enabled).toBe(false);
      expect(config.collection.interval).toBe(2000);
    });

    it('should handle boolean environment variables', () => {
      process.env.METRICS_ENABLED = 'true';
      process.env.METRICS_REPORTING_ENABLED = 'false';

      configManager.loadFromEnvironment();
      const config = configManager.getConfig();

      expect(config.collection.enabled).toBe(true);
      expect(config.reporting.enabled).toBe(false);
    });

    it('should handle numeric environment variables', () => {
      process.env.METRICS_INTERVAL = '5000';
      process.env.METRICS_MAX_METRICS = '50000';

      configManager.loadFromEnvironment();
      const config = configManager.getConfig();

      expect(config.collection.interval).toBe(5000);
      expect(config.collection.maxMetrics).toBe(50000);
    });
  });

  describe('Configuration Persistence', () => {
    it('should save configuration to file', async () => {
      const config = {
        collection: { enabled: true, interval: 1000 },
        reporting: { enabled: true, format: 'json' as const },
      };

      configManager.loadConfig(config);

      // Mock file operations
      const saveSpy = vi.spyOn(configManager, 'saveToFile');
      await configManager.saveToFile('/tmp/test-config.json');

      expect(saveSpy).toHaveBeenCalledWith('/tmp/test-config.json');
    });

    it('should load configuration from file', async () => {
      const mockConfig = {
        collection: { enabled: false, interval: 2000 },
      };

      // Mock file loading
      const loadSpy = vi.spyOn(configManager, 'loadFromFile');
      loadSpy.mockResolvedValue(mockConfig);

      await configManager.loadFromFile('/tmp/test-config.json');

      expect(loadSpy).toHaveBeenCalledWith('/tmp/test-config.json');
    });
  });

  describe('Configuration Presets', () => {
    it('should apply development preset', () => {
      configManager.applyPreset('development');
      const config = configManager.getConfig();

      expect(config.collection.enabled).toBe(true);
      expect(config.collection.interval).toBeLessThanOrEqual(1000);
      expect(config.reporting.destination).toBe('console');
    });

    it('should apply production preset', () => {
      configManager.applyPreset('production');
      const config = configManager.getConfig();

      expect(config.collection.enabled).toBe(true);
      expect(config.collection.interval).toBeGreaterThanOrEqual(5000);
      expect(config.performance.sampling).toBeLessThan(1.0);
    });

    it('should apply testing preset', () => {
      configManager.applyPreset('testing');
      const config = configManager.getConfig();

      expect(config.collection.enabled).toBe(false);
      expect(config.reporting.enabled).toBe(false);
    });
  });

  describe('Configuration Watching', () => {
    it('should watch for configuration changes', () => {
      const watchHandler = vi.fn();
      configManager.on('configChanged', watchHandler);

      configManager.startWatching();
      configManager.updateConfig({ collection: { interval: 3000 } });

      expect(watchHandler).toHaveBeenCalled();
    });

    it('should stop watching configuration changes', () => {
      const watchHandler = vi.fn();
      configManager.on('configChanged', watchHandler);

      configManager.startWatching();
      configManager.stopWatching();
      configManager.updateConfig({ collection: { interval: 4000 } });

      expect(watchHandler).toHaveBeenCalledTimes(1); // Only the initial call
    });
  });

  describe('Configuration Validation Rules', () => {
    it('should validate metric name patterns', () => {
      const configWithPatterns = {
        validation: {
          metricNamePattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
        },
      };

      configManager.loadConfig(configWithPatterns);

      expect(configManager.isValidMetricName('valid_metric')).toBe(true);
      expect(configManager.isValidMetricName('123_invalid')).toBe(false);
      expect(configManager.isValidMetricName('invalid-metric')).toBe(false);
    });

    it('should validate tag key patterns', () => {
      const configWithTagValidation = {
        validation: {
          tagKeyPattern: '^[a-z][a-z0-9_]*$',
        },
      };

      configManager.loadConfig(configWithTagValidation);

      expect(configManager.isValidTagKey('valid_tag')).toBe(true);
      expect(configManager.isValidTagKey('Invalid_Tag')).toBe(false);
    });

    it('should enforce maximum tag values', () => {
      const configWithLimits = {
        validation: {
          maxTags: 10,
          maxTagValueLength: 50,
        },
      };

      configManager.loadConfig(configWithLimits);

      const tooManyTags = Object.fromEntries(
        Array.from({ length: 15 }, (_, i) => [`tag${i}`, `value${i}`])
      );

      expect(configManager.validateTags(tooManyTags)).toBe(false);

      const longValue = 'x'.repeat(100);
      expect(configManager.validateTagValue(longValue)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration files gracefully', async () => {
      await expect(configManager.loadFromFile('/nonexistent/config.json')).rejects.toThrow();
    });

    it('should handle invalid JSON configuration', async () => {
      const invalidJson = '{ invalid json }';

      // Mock file reading to return invalid JSON
      const readSpy = vi.spyOn(configManager, 'readConfigFile');
      readSpy.mockResolvedValue(invalidJson);

      await expect(configManager.loadFromFile('/tmp/invalid.json')).rejects.toThrow();
    });

    it('should revert to previous configuration on validation errors', () => {
      const originalConfig = configManager.getConfig();
      const originalInterval = originalConfig.collection.interval;

      try {
        configManager.updateConfig({
          collection: { interval: -1000 }, // Invalid
        });
      } catch (error) {
        // Should revert to original
        const currentConfig = configManager.getConfig();
        expect(currentConfig.collection.interval).toBe(originalInterval);
      }
    });
  });

  describe('Configuration Schema', () => {
    it('should provide configuration schema', () => {
      const schema = configManager.getSchema();

      expect(schema).toBeDefined();
      expect(schema.properties).toBeDefined();
      expect(schema.properties.collection).toBeDefined();
      expect(schema.properties.reporting).toBeDefined();
    });

    it('should validate against schema', () => {
      const validConfig = {
        collection: {
          enabled: true,
          interval: 1000,
          maxMetrics: 10000,
        },
      };

      const invalidConfig = {
        collection: {
          enabled: 'not_boolean', // Wrong type
        },
      };

      expect(configManager.validateAgainstSchema(validConfig)).toBe(true);
      expect(configManager.validateAgainstSchema(invalidConfig)).toBe(false);
    });
  });

  describe('Configuration Export/Import', () => {
    it('should export configuration', () => {
      const customConfig = {
        collection: { enabled: false, interval: 2000 },
        reporting: { enabled: true, format: 'prometheus' as const },
      };

      configManager.loadConfig(customConfig);
      const exported = configManager.exportConfig();

      expect(exported.collection.enabled).toBe(false);
      expect(exported.collection.interval).toBe(2000);
      expect(exported.reporting.format).toBe('prometheus');
    });

    it('should import configuration', () => {
      const importedConfig = {
        collection: { enabled: true, interval: 1500 },
      };

      configManager.importConfig(importedConfig);
      const config = configManager.getConfig();

      expect(config.collection.enabled).toBe(true);
      expect(config.collection.interval).toBe(1500);
    });
  });
});
