/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  RuntimeConfigValidator,
  createRuntimeValidator,
  validateConfigSync,
  PERFORMANCE_CONSTRAINTS,
  SECURITY_CONSTRAINTS,
  type ValidationResult,
  type ConfigConstraints
} from '../src/configValidator.js';
import {
  ConfigSafetyManager,
  createSafetyManager,
  generateSystemDefaults,
  applySafeMode,
  SAFE_MODE_PROFILES,
  type SafeModeProfile,
  type FallbackConfig
} from '../src/configDefaults.js';
import {
  ConfigWatcher,
  createConfigWatcher,
  validateConfigFiles,
  type ConfigChangeEvent,
  type WatcherOptions
} from '../src/configWatcher.js';
import type { EnigmaConfig } from '../src/config.js';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('../src/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
}));

jest.mock('../src/config.js');
jest.mock('fs');
jest.mock('chokidar');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Configuration Validation and Safety System', () => {
  let testConfig: EnigmaConfig;
  let validator: RuntimeConfigValidator;
  let safetyManager: ConfigSafetyManager;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Default test configuration
    testConfig = {
      input: './src',
      output: './dist',
      maxConcurrency: 4,
      htmlExtractor: {
        maxFileSize: 10 * 1024 * 1024,
        timeout: 10000,
        caseSensitive: false,
        ignoreEmpty: true,
        preserveWhitespace: false,
      },
      jsExtractor: {
        maxFileSize: 10 * 1024 * 1024,
        timeout: 10000,
        enableFrameworkDetection: true,
        includeDynamicClasses: false,
        caseSensitive: false,
        ignoreEmpty: true,
        supportedFrameworks: ['react', 'vue'],
      },
      cssInjector: {
        maxFileSize: 10 * 1024 * 1024,
        timeout: 10000,
        useRelativePaths: true,
        preventDuplicates: true,
        insertPosition: 'after-meta',
        createBackup: true,
      },
      fileIntegrity: {
        algorithm: 'sha256',
        createBackups: true,
        backupRetentionDays: 7,
        maxFileSize: 10 * 1024 * 1024,
        timeout: 10000,
        verifyAfterRollback: true,
        batchSize: 10,
        enableCaching: true,
        cacheSize: 100,
      },
      verbose: false,
      debug: false,
      pretty: false,
      minify: true,
      removeUnused: true,
      preserveComments: false,
      sourceMaps: false,
      followSymlinks: false,
      maxFiles: 10000,
      excludeExtensions: ['.tmp'],
      excludePatterns: ['node_modules/**'],
    };
    
    validator = createRuntimeValidator();
    safetyManager = createSafetyManager();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('RuntimeConfigValidator', () => {
    test('should validate valid configuration successfully', async () => {
      const result = await validator.validateConfiguration(testConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.errors.filter(e => e.fatal)).toHaveLength(0);
      expect(result.performanceImpact).toBeDefined();
      expect(result.performanceImpact.estimatedMemoryUsage).toBeGreaterThan(0);
    });
    
    test('should detect input/output path conflicts', async () => {
      const invalidConfig = {
        ...testConfig,
        input: './src',
        output: './src' // Same as input
      };
      
      const result = await validator.validateConfiguration(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'configuration',
          message: 'Input and output paths must be different',
          fatal: true
        })
      );
    });
    
    test('should warn about high concurrency', async () => {
      const highConcurrencyConfig = {
        ...testConfig,
        maxConcurrency: os.cpus().length * 3 // Very high concurrency
      };
      
      const result = await validator.validateConfiguration(highConcurrencyConfig);
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'performance',
          severity: 'medium',
          field: 'maxConcurrency'
        })
      );
    });
    
    test('should detect security issues in paths', async () => {
      const unsafeConfig = {
        ...testConfig,
        input: '../../../etc/passwd', // Path traversal
        output: '/etc/test' // System directory
      };
      
      const result = await validator.validateConfiguration(unsafeConfig);
      
      expect(result.securityIssues.length).toBeGreaterThan(0);
      expect(result.securityIssues).toContainEqual(
        expect.objectContaining({
          type: 'path_traversal',
          severity: 'high'
        })
      );
    });
    
    test('should validate performance constraints', async () => {
      const performanceConfig = {
        ...testConfig,
        maxConcurrency: PERFORMANCE_CONSTRAINTS.MAX_CONCURRENCY + 1,
        htmlExtractor: {
          ...testConfig.htmlExtractor!,
          timeout: PERFORMANCE_CONSTRAINTS.MAX_TIMEOUT_MS + 1000
        }
      };
      
      const result = await validator.validateConfiguration(performanceConfig);
      
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'constraint',
          field: 'maxConcurrency'
        })
      );
      
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'performance',
          message: expect.stringContaining('timeout')
        })
      );
    });
    
    test('should assess performance impact accurately', async () => {
      const result = await validator.validateConfiguration(testConfig);
      
      expect(result.performanceImpact.estimatedMemoryUsage).toBeGreaterThan(50);
      expect(result.performanceImpact.estimatedCpuUsage).toMatch(/^(low|medium|high)$/);
      expect(result.performanceImpact.recommendedConcurrency).toBeGreaterThan(0);
      expect(result.performanceImpact.recommendedConcurrency).toBeLessThanOrEqual(PERFORMANCE_CONSTRAINTS.MAX_CONCURRENCY);
    });
    
    test('should update constraints correctly', () => {
      const newConstraints: Partial<ConfigConstraints> = {
        maxConcurrency: 2,
        maxMemoryUsageMB: 256
      };
      
      validator.updateConstraints(newConstraints);
      const constraints = validator.getConstraints();
      
      expect(constraints.maxConcurrency).toBe(2);
      expect(constraints.maxMemoryUsageMB).toBe(256);
    });
    
    test('should handle validation errors gracefully', async () => {
      // Mock a validation that throws an error
      const invalidConfig = null as any;
      
      const result = await validator.validateConfiguration(invalidConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'constraint',
          fatal: true,
          message: expect.stringContaining('Validation process failed')
        })
      );
    });
  });

  describe('ConfigSafetyManager', () => {
    test('should generate intelligent defaults based on system', () => {
      const defaults = safetyManager.generateIntelligentDefaults();
      
      expect(defaults.maxConcurrency).toBeGreaterThan(0);
      expect(defaults.maxConcurrency).toBeLessThanOrEqual(PERFORMANCE_CONSTRAINTS.MAX_CONCURRENCY);
      expect(defaults.htmlExtractor?.timeout).toBeLessThanOrEqual(PERFORMANCE_CONSTRAINTS.MAX_TIMEOUT_MS);
      expect(defaults.excludePatterns).toContain('node_modules/**');
    });
    
    test('should apply safe mode profiles correctly', () => {
      const profiles: SafeModeProfile[] = ['minimal', 'balanced', 'strict', 'performance'];
      
      for (const profile of profiles) {
        const config = safetyManager.applySafeModeProfile(profile);
        const profileData = SAFE_MODE_PROFILES[profile];
        
        expect(config.maxConcurrency).toBe(profileData.maxConcurrency);
        expect(config.htmlExtractor?.maxFileSize).toBe(profileData.maxFileSize);
        expect(config.cssInjector?.createBackup).toBe(profileData.enableBackups);
      }
    });
    
    test('should apply fallbacks for dangerous configurations', () => {
      const dangerousConfig = {
        ...testConfig,
        maxConcurrency: PERFORMANCE_CONSTRAINTS.MAX_CONCURRENCY + 5,
        input: './test',
        output: './test' // Same as input
      };
      
      const safeConfig = safetyManager.validateAndApplyFallbacks(dangerousConfig);
      const fallbacks = safetyManager.getFallbacks();
      
      expect(safeConfig.maxConcurrency).toBeLessThanOrEqual(PERFORMANCE_CONSTRAINTS.MAX_CONCURRENCY);
      expect(safeConfig.output).not.toBe(safeConfig.input);
      expect(fallbacks.length).toBeGreaterThan(0);
      
      expect(fallbacks).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          autoApplied: true,
          reason: expect.stringContaining('Concurrency too high')
        })
      );
    });
    
    test('should handle file size constraints', () => {
      const largeFileSizeConfig = {
        ...testConfig,
        htmlExtractor: {
          ...testConfig.htmlExtractor!,
          maxFileSize: PERFORMANCE_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024 + 1000
        }
      };
      
      const safeConfig = safetyManager.validateAndApplyFallbacks(largeFileSizeConfig);
      const fallbacks = safetyManager.getFallbacks();
      
      expect(safeConfig.htmlExtractor?.maxFileSize).toBeLessThanOrEqual(
        PERFORMANCE_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024
      );
      
      expect(fallbacks).toContainEqual(
        expect.objectContaining({
          reason: expect.stringContaining('File size limit too high'),
          severity: 'error'
        })
      );
    });
    
    test('should check memory constraints', () => {
      // Mock low memory system
      const lowMemoryManager = new ConfigSafetyManager({
        systemMemoryMB: 1000 // 1GB
      });
      
      const memoryIntensiveConfig = {
        ...testConfig,
        maxConcurrency: 16 // High concurrency on low memory
      };
      
      const safeConfig = lowMemoryManager.validateAndApplyFallbacks(memoryIntensiveConfig);
      const fallbacks = lowMemoryManager.getFallbacks();
      
      expect(safeConfig.maxConcurrency).toBeLessThan(memoryIntensiveConfig.maxConcurrency);
      expect(fallbacks).toContainEqual(
        expect.objectContaining({
          reason: expect.stringContaining('memory usage too high'),
          severity: 'critical'
        })
      );
    });
  });

  describe('ConfigWatcher', () => {
    let watcher: ConfigWatcher;
    let mockChokidar: any;
    
    beforeEach(() => {
      // Mock chokidar
      mockChokidar = {
        watch: jest.fn(() => ({
          on: jest.fn(),
          close: jest.fn(),
          getWatched: jest.fn(() => ({})),
        })),
      };
      
      // Mock fs for backup directory
      mockFs.existsSync = jest.fn().mockReturnValue(false);
      mockFs.mkdirSync = jest.fn();
      mockFs.promises = {
        readdir: jest.fn().mockResolvedValue([]),
        stat: jest.fn(),
        writeFile: jest.fn(),
        readFile: jest.fn(),
        unlink: jest.fn(),
      } as any;
      
      // Replace chokidar import
      const chokidarModule = require('chokidar');
      chokidarModule.default = mockChokidar;
      Object.assign(chokidarModule, mockChokidar);
      
      watcher = createConfigWatcher(validator, safetyManager);
    });
    
    afterEach(async () => {
      if (watcher) {
        await watcher.stopWatching();
      }
    });
    
    test('should create watcher with default options', () => {
      expect(watcher).toBeInstanceOf(ConfigWatcher);
      
      const status = watcher.getStatus();
      expect(status.isWatching).toBe(false);
      expect(status.options.enabled).toBe(true);
      expect(status.options.debounceMs).toBe(500);
    });
    
    test('should start and stop watching', async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);
      
      await watcher.startWatching(['test-config.json']);
      
      let status = watcher.getStatus();
      expect(status.isWatching).toBe(true);
      expect(mockChokidar.watch).toHaveBeenCalledWith(
        ['test-config.json'],
        expect.objectContaining({
          ignored: expect.arrayContaining(['node_modules/**']),
          persistent: true
        })
      );
      
      await watcher.stopWatching();
      
      status = watcher.getStatus();
      expect(status.isWatching).toBe(false);
    });
    
    test('should update options correctly', () => {
      const newOptions: Partial<WatcherOptions> = {
        debounceMs: 1000,
        validateOnChange: false
      };
      
      watcher.updateOptions(newOptions);
      
      const status = watcher.getStatus();
      expect(status.options.debounceMs).toBe(1000);
      expect(status.options.validateOnChange).toBe(false);
    });
    
    test('should handle disabled watcher', async () => {
      watcher.updateOptions({ enabled: false });
      
      await watcher.startWatching();
      
      const status = watcher.getStatus();
      expect(status.isWatching).toBe(false);
    });
    
    test('should manage backups correctly', async () => {
      mockFs.promises.readdir = jest.fn().mockResolvedValue([
        'config-backup-2025-01-20T10-00-00-000Z.json',
        'config-backup-2025-01-20T11-00-00-000Z.json',
        'other-file.txt'
      ]);
      
      mockFs.promises.stat = jest.fn().mockResolvedValue({
        mtime: new Date(),
        size: 1024
      });
      
      const backups = await watcher.getBackups();
      
      expect(backups).toHaveLength(2);
      expect(backups[0].file).toMatch(/config-backup-.*\\.json$/);
    });
    
    test('should emit change events', (done) => {
      const mockConfig = { ...testConfig };
      
      // Mock loadConfig
      const configModule = require('../src/config.js');
      configModule.loadConfig = jest.fn().mockResolvedValue(mockConfig);
      
      watcher.on('change', (event: ConfigChangeEvent) => {
        expect(event.type).toBe('modified');
        expect(event.filePath).toBe('test-config.json');
        expect(event.newConfig).toEqual(mockConfig);
        done();
      });
      
      // Simulate file change processing
      (watcher as any).processFileChange('modified', 'test-config.json');
    });
  });

  describe('Utility Functions', () => {
    test('validateConfigSync should perform basic validation', () => {
      const validResult = validateConfigSync(testConfig);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      const invalidConfig = {
        ...testConfig,
        input: './test',
        output: './test'
      };
      
      const invalidResult = validateConfigSync(invalidConfig);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContainEqual(
        'Input and output paths must be different'
      );
    });
    
    test('generateSystemDefaults should create appropriate defaults', () => {
      const defaults = generateSystemDefaults();
      
      expect(defaults.maxConcurrency).toBeGreaterThan(0);
      expect(defaults.htmlExtractor?.timeout).toBeGreaterThan(0);
      expect(defaults.excludePatterns).toBeInstanceOf(Array);
    });
    
    test('applySafeMode should apply correct profile', () => {
      const minimalConfig = applySafeMode('minimal');
      const performanceConfig = applySafeMode('performance');
      
      expect(minimalConfig.maxConcurrency).toBe(SAFE_MODE_PROFILES.minimal.maxConcurrency);
      expect(performanceConfig.maxConcurrency).toBe(SAFE_MODE_PROFILES.performance.maxConcurrency);
      expect(minimalConfig.cssInjector?.createBackup).toBe(false);
      expect(performanceConfig.cssInjector?.createBackup).toBe(false);
    });
    
    test('validateConfigFiles should handle multiple files', async () => {
      const configModule = require('../src/config.js');
      configModule.loadConfig = jest.fn()
        .mockResolvedValueOnce(testConfig)
        .mockRejectedValueOnce(new Error('Invalid config'));
      
      const results = await validateConfigFiles(['valid-config.json', 'invalid-config.json']);
      
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[1].errors[0].message).toContain('Failed to load config');
    });
  });

  describe('Integration Tests', () => {
    test('should integrate validation, safety, and watching', async () => {
      // Create a dangerous configuration
      const dangerousConfig = {
        ...testConfig,
        maxConcurrency: 20,
        input: './src',
        output: './src',
        htmlExtractor: {
          ...testConfig.htmlExtractor!,
          maxFileSize: 200 * 1024 * 1024 // 200MB
        }
      };
      
      // Validate with runtime validator
      const validationResult = await validator.validateConfiguration(dangerousConfig);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(validationResult.securityIssues.length).toBeGreaterThan(0);
      
      // Apply safety fallbacks
      const safeConfig = safetyManager.validateAndApplyFallbacks(dangerousConfig);
      const fallbacks = safetyManager.getFallbacks();
      
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(safeConfig.maxConcurrency).toBeLessThan(dangerousConfig.maxConcurrency);
      expect(safeConfig.output).not.toBe(safeConfig.input);
      
      // Validate the safe configuration
      const safeValidationResult = await validator.validateConfiguration(safeConfig);
      expect(safeValidationResult.isValid).toBe(true);
    });
    
    test('should handle end-to-end configuration lifecycle', async () => {
      // 1. Generate intelligent defaults
      const defaults = safetyManager.generateIntelligentDefaults();
      expect(defaults.maxConcurrency).toBeGreaterThan(0);
      
      // 2. Apply safe mode
      const safeConfig = safetyManager.applySafeModeProfile('balanced');
      expect(safeConfig.cssInjector?.createBackup).toBe(true);
      
      // 3. Merge with user config
      const userConfig = {
        ...defaults,
        ...safeConfig,
        input: './custom-src',
        output: './custom-dist'
      };
      
      // 4. Validate final configuration
      const finalResult = await validator.validateConfiguration(userConfig as EnigmaConfig);
      expect(finalResult.isValid).toBe(true);
      
      // 5. Get performance impact
      expect(finalResult.performanceImpact.estimatedMemoryUsage).toBeGreaterThan(0);
      expect(finalResult.performanceImpact.recommendedConcurrency).toBeGreaterThan(0);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle constraint validation errors', async () => {
      const invalidConstraints = {
        maxMemoryUsageMB: -1, // Invalid
        maxConcurrency: 0, // Invalid
      };
      
      expect(() => {
        createRuntimeValidator(invalidConstraints);
      }).toThrow();
    });
    
    test('should handle file system errors gracefully', async () => {
      mockFs.promises.readdir = jest.fn().mockRejectedValue(new Error('Permission denied'));
      
      const backups = await watcher.getBackups();
      expect(backups).toHaveLength(0); // Should return empty array on error
    });
    
    test('should handle invalid backup restoration', async () => {
      mockFs.promises.readFile = jest.fn().mockResolvedValue('invalid json content');
      
      await expect(watcher.restoreFromBackup('invalid-backup.json'))
        .rejects
        .toThrow();
    });
  });
}); 