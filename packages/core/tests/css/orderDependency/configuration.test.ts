/**
 * OrderHandlingConfig Test Suite
 *
 * Comprehensive test suite for OrderHandlingConfig covering:
 * - Basic configuration management and validation
 * - Strictness level configuration and presets
 * - Change listeners and configuration statistics
 * - Import/export functionality and error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIGURATION_PRESETS,
  ConfigurationError,
  OrderHandlingConfig,
} from '../../../src/css/orderDependency/configuration';
import { ReportFormat, StrictnessLevel } from '../../../src/css/orderDependency/types';

describe('OrderHandlingConfig', () => {
  let config: OrderHandlingConfig;

  beforeEach(() => {
    config = new OrderHandlingConfig();
  });

  describe('Basic Configuration', () => {
    it('should create config instance with defaults', () => {
      expect(config).toBeInstanceOf(OrderHandlingConfig);
      expect(config.getConfig()).toBeDefined();
    });

    it('should provide default configuration values', () => {
      const currentConfig = config.getConfig();
      expect(currentConfig.strictness).toBeDefined();
      expect(currentConfig.enableCaching).toBeDefined();
      expect(currentConfig.enableDependencyDetection).toBeDefined();
    });

    it('should allow configuration updates', () => {
      const originalConfig = config.getConfig();
      config.updateConfig({ enableCaching: false });
      const updatedConfig = config.getConfig();

      expect(updatedConfig.enableCaching).toBe(false);
      expect(originalConfig.enableCaching).not.toBe(updatedConfig.enableCaching);
    });

    it('should retrieve current configuration', () => {
      const retrievedConfig = config.getConfig();
      expect(retrievedConfig).toBeDefined();
      expect(typeof retrievedConfig).toBe('object');
    });
  });

  describe('Strictness Levels', () => {
    it('should set strictness to strict', () => {
      config.setStrictness(StrictnessLevel.STRICT);
      expect(config.getConfig().strictness).toBe(StrictnessLevel.STRICT);
    });

    it('should set strictness to balanced', () => {
      config.setStrictness(StrictnessLevel.BALANCED);
      expect(config.getConfig().strictness).toBe(StrictnessLevel.BALANCED);
    });

    it('should set strictness to permissive', () => {
      config.setStrictness(StrictnessLevel.PERMISSIVE);
      expect(config.getConfig().strictness).toBe(StrictnessLevel.PERMISSIVE);
    });

    it('should set strictness to preserve-all', () => {
      config.setStrictness(StrictnessLevel.PRESERVE_ALL);
      expect(config.getConfig().strictness).toBe(StrictnessLevel.PRESERVE_ALL);
    });

    it('should handle invalid strictness gracefully', () => {
      expect(() => config.setStrictness('invalid' as any)).toThrow(ConfigurationError);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig = {
        enableCaching: true,
        cacheSize: 500,
        maxProcessingTime: 10000,
      };

      expect(() => config.updateConfig(validConfig)).not.toThrow();
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        cacheSize: -100,
      };

      expect(() => config.updateConfig(invalidConfig)).toThrow(ConfigurationError);
    });

    it('should validate configuration on creation', () => {
      expect(() => new OrderHandlingConfig({ enableCaching: true })).not.toThrow();
    });
  });

  describe('Change Listeners', () => {
    it('should support adding change listeners', () => {
      const mockListener = vi.fn();
      const removeListener = config.addChangeListener(mockListener);
      expect(typeof removeListener).toBe('function');
    });

    it('should notify listeners on configuration changes', () => {
      const mockListener = vi.fn();
      config.addChangeListener(mockListener);
      config.updateConfig({ enableCaching: false });

      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('should support removing change listeners', () => {
      const mockListener = vi.fn();
      const removeListener = config.addChangeListener(mockListener);
      removeListener();
      config.updateConfig({ enableCaching: false });
      expect(mockListener).toHaveBeenCalledTimes(0);
    });
  });

  describe('Configuration Statistics', () => {
    it('should provide configuration statistics', () => {
      const stats = config.getStats();
      expect(stats).toBeDefined();
      expect(stats.strictnessLevel).toBeDefined();
      expect(stats.enabledFeatures).toBeInstanceOf(Array);
    });

    it('should track enabled features', () => {
      const stats = config.getStats();
      expect(Array.isArray(stats.enabledFeatures)).toBe(true);
    });

    it('should provide feature information', () => {
      const stats = config.getStats();
      expect(stats.enabledFeatures.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('JSON Import/Export', () => {
    it('should export configuration to JSON', () => {
      const json = config.exportConfig();
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
    });

    it('should import configuration from JSON', () => {
      const originalConfig = config.getConfig();
      const json = JSON.stringify(originalConfig);

      expect(() => config.importConfig(json)).not.toThrow();
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = '{ invalid json }';
      expect(() => config.importConfig(invalidJson)).toThrow(ConfigurationError);
    });

    it('should roundtrip configuration correctly', () => {
      const originalConfig = config.getConfig();
      const json = config.exportConfig();

      const newConfig = new OrderHandlingConfig();
      newConfig.importConfig(json);
      const roundtripConfig = newConfig.getConfig();

      expect(roundtripConfig).toEqual(originalConfig);
    });
  });

  describe('Configuration Presets', () => {
    it('should have strict preset available', () => {
      expect(CONFIGURATION_PRESETS.STRICT).toBeDefined();
      expect(CONFIGURATION_PRESETS.STRICT.strictness).toBe('strict');
    });

    it('should have balanced preset available', () => {
      expect(CONFIGURATION_PRESETS.BALANCED).toBeDefined();
      expect(CONFIGURATION_PRESETS.BALANCED.strictness).toBe('balanced');
    });

    it('should have permissive preset available', () => {
      expect(CONFIGURATION_PRESETS.PERMISSIVE).toBeDefined();
      expect(CONFIGURATION_PRESETS.PERMISSIVE.strictness).toBe('permissive');
    });

    it('should have preserve-all preset available', () => {
      expect(CONFIGURATION_PRESETS.PRESERVE_ALL).toBeDefined();
      expect(CONFIGURATION_PRESETS.PRESERVE_ALL.strictness).toBe('preserve-all');
    });
  });

  describe('Performance Configuration', () => {
    it('should configure caching settings', () => {
      config.updateConfig({ enableCaching: true, cacheSize: 1000 });
      const currentConfig = config.getConfig();

      expect(currentConfig.enableCaching).toBe(true);
      expect(currentConfig.cacheSize).toBe(1000);
    });

    it('should configure processing limits', () => {
      config.updateConfig({ maxProcessingTime: 20000 });
      const currentConfig = config.getConfig();

      expect(currentConfig.maxProcessingTime).toBe(20000);
    });

    it('should configure parallel processing', () => {
      config.updateConfig({ enableParallelProcessing: true });
      const currentConfig = config.getConfig();

      expect(currentConfig.enableParallelProcessing).toBe(true);
    });
  });

  describe('Warning Configuration', () => {
    it('should configure ignored properties', () => {
      const ignoredProps = ['z-index'];
      config.updateConfig({ ignoredProperties: ignoredProps });
      const currentConfig = config.getConfig();

      expect(currentConfig.ignoredProperties).toEqual(ignoredProps);
    });

    it('should configure preserve order selectors', () => {
      const preserveSelectors = ['*:hover'];
      config.updateConfig({ preserveOrderSelectors: preserveSelectors });
      const currentConfig = config.getConfig();

      expect(currentConfig.preserveOrderSelectors).toEqual(preserveSelectors);
    });
  });

  describe('Integration Features', () => {
    it('should support resetting to defaults', () => {
      config.updateConfig({ enableCaching: false });
      config.reset();
      const resetConfig = config.getConfig();

      // Should have default enableCaching value
      expect(resetConfig.enableCaching).toBe(true);
    });

    it('should maintain configuration integrity', () => {
      const initialConfig = config.getConfig();
      config.updateConfig({ enableCaching: false });
      config.updateConfig({ enableCaching: true });
      const finalConfig = config.getConfig();

      expect(finalConfig.enableCaching).toBe(initialConfig.enableCaching);
    });

    it('should handle configuration chaining', () => {
      config.updateConfig({ enableCaching: false });
      config.updateConfig({ maxProcessingTime: 5000 });
      const currentConfig = config.getConfig();

      expect(currentConfig.enableCaching).toBe(false);
      expect(currentConfig.maxProcessingTime).toBe(5000);
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', () => {
      expect(() => {
        config.updateConfig({
          cacheSize: -500,
          maxProcessingTime: -1000,
        });
      }).toThrow(ConfigurationError);
    });

    it('should provide meaningful error messages', () => {
      try {
        config.updateConfig({ cacheSize: -100 });
      } catch (error) {
        if (error instanceof ConfigurationError) {
          expect(error.message).toBeDefined();
          expect(error.message).toContain('cacheSize');
        }
      }
    });
  });

  describe('Advanced Configuration', () => {
    it('should support ignored properties configuration', () => {
      const ignoredProps = ['z-index', 'position'];
      config.updateConfig({ ignoredProperties: ignoredProps });
      const currentConfig = config.getConfig();

      expect(currentConfig.ignoredProperties).toEqual(ignoredProps);
    });

    it('should support preserve order selectors', () => {
      const preserveSelectors = ['*:hover', '*:focus'];
      config.updateConfig({ preserveOrderSelectors: preserveSelectors });
      const currentConfig = config.getConfig();

      expect(currentConfig.preserveOrderSelectors).toEqual(preserveSelectors);
    });

    it('should support report format configuration', () => {
      const formats = [ReportFormat.CONSOLE, ReportFormat.JSON];
      config.updateConfig({ reportFormat: formats });
      const currentConfig = config.getConfig();

      expect(currentConfig.reportFormat).toEqual(formats);
    });
  });
});
