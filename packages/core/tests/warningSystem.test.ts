/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Mock, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createWarningConfig,
  shouldShowPerformanceWarning,
  validateCliLength,
  validateLengthWithWarnings,
  validateMultipleLengths,
  type LengthValidationOptions,
} from '../src/utils/lengthValidation';
import { Logger } from '../src/utils/logger';
import {
  WarningLevel,
  WarningSystem,
  generateCapacityTable,
  getDefaultWarningSystem,
  shouldWarn,
  warnForHighLength,
  type WarningConfig,
} from '../src/utils/warningSystem';

// Mock the logger to capture warning output
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as Partial<Logger> as Logger;

describe('Warning System (Task 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset logger mocks
    (mockLogger.info as Mock).mockClear();
    (mockLogger.warn as Mock).mockClear();
    (mockLogger.error as Mock).mockClear();
    (mockLogger.debug as Mock).mockClear();
  });

  describe('WarningSystem Core', () => {
    test('should determine correct warning levels', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });

      // Test different length thresholds
      expect(warningSystem.shouldWarn(14)).toBe(false);
      expect(warningSystem.shouldWarn(15)).toBe(true);
      expect(warningSystem.shouldWarn(20)).toBe(true);
      expect(warningSystem.shouldWarn(25)).toBe(true);
      expect(warningSystem.shouldWarn(26)).toBe(true);
    });

    test('should generate appropriate warning levels based on length', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });

      // Test INFO level (15-19)
      const infoWarning = warningSystem.generateWarningData(16);
      expect(infoWarning.level).toBe(WarningLevel.INFO);
      expect(infoWarning.message).toContain('INFO');

      // Test WARNING level (20-24)
      const warningLevel = warningSystem.generateWarningData(22);
      expect(warningLevel.level).toBe(WarningLevel.WARNING);
      expect(warningLevel.message).toContain('WARNING');

      // Test CRITICAL level (25+)
      const criticalWarning = warningSystem.generateWarningData(26);
      expect(criticalWarning.level).toBe(WarningLevel.CRITICAL);
      expect(criticalWarning.message).toContain('CRITICAL');
    });

    test('should generate accurate capacity tables', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });
      const warningData = warningSystem.generateWarningData(20);

      expect(warningData.capacityTable).toBeDefined();
      expect(warningData.capacityTable.length).toBeGreaterThan(0);

      // Check that capacity calculations are reasonable
      const firstEntry = warningData.capacityTable[0];
      expect(firstEntry.length).toBe(1);
      expect(firstEntry.capacity).toBe(26); // 26^1 = 26 for standard alphabet

      const secondEntry = warningData.capacityTable[1];
      expect(secondEntry.length).toBe(2);
      expect(secondEntry.capacity).toBe(676); // 26^2 = 676

      // Check cumulative capacity
      expect(secondEntry.cumulativeCapacity).toBe(firstEntry.capacity + secondEntry.capacity);
    });

    test('should generate performance information for different lengths', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });

      // Test low risk (15-16)
      const lowRisk = warningSystem.generateWarningData(15);
      expect(lowRisk.performanceInfo.riskLevel).toBe('low');

      // Test moderate risk (17-19)
      const moderateRisk = warningSystem.generateWarningData(18);
      expect(moderateRisk.performanceInfo.riskLevel).toBe('moderate');

      // Test high risk (20-24)
      const highRisk = warningSystem.generateWarningData(22);
      expect(highRisk.performanceInfo.riskLevel).toBe('high');

      // Test extreme risk (25+)
      const extremeRisk = warningSystem.generateWarningData(26);
      expect(extremeRisk.performanceInfo.riskLevel).toBe('extreme');
    });

    test('should provide appropriate recommendations based on warning level', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });

      // Test INFO recommendations
      const infoWarning = warningSystem.generateWarningData(15);
      expect(infoWarning.recommendations.length).toBeGreaterThan(0);
      expect(infoWarning.recommendations.some((rec) => rec.includes('good security'))).toBe(true);

      // Test WARNING recommendations
      const warningLevel = warningSystem.generateWarningData(22);
      expect(warningLevel.recommendations.length).toBeGreaterThan(0);
      expect(warningLevel.recommendations.some((rec) => rec.includes('10-15'))).toBe(true);

      // Test CRITICAL recommendations
      const criticalWarning = warningSystem.generateWarningData(26);
      expect(criticalWarning.recommendations.length).toBeGreaterThan(0);
      expect(criticalWarning.recommendations.some((rec) => rec.includes('lower length'))).toBe(
        true
      );
    });

    test('should respect configuration settings', () => {
      const config: Partial<WarningConfig> = {
        lengthThreshold: 20,
        showCapacityTable: false,
        showPerformanceInfo: false,
        enabled: true,
        logger: mockLogger,
      };

      const warningSystem = new WarningSystem(config);

      expect(warningSystem.shouldWarn(19)).toBe(false);
      expect(warningSystem.shouldWarn(20)).toBe(true);

      const updatedConfig = warningSystem.getConfig();
      expect(updatedConfig.lengthThreshold).toBe(20);
      expect(updatedConfig.showCapacityTable).toBe(false);
      expect(updatedConfig.showPerformanceInfo).toBe(false);
    });

    test('should allow configuration updates', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });

      warningSystem.updateConfig({
        lengthThreshold: 18,
        showCapacityTable: false,
      });

      expect(warningSystem.shouldWarn(17)).toBe(false);
      expect(warningSystem.shouldWarn(18)).toBe(true);

      const config = warningSystem.getConfig();
      expect(config.lengthThreshold).toBe(18);
      expect(config.showCapacityTable).toBe(false);
    });

    test('should warn for high length values and call logger', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });

      // Should not warn for low values
      warningSystem.warnForHighLength(10);
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Should warn for high values
      warningSystem.warnForHighLength(20);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled(); // For capacity table and recommendations
    });

    test('should display warnings with proper formatting', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });

      warningSystem.warnForHighLength(25);

      // Check that error was called for CRITICAL level
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL: Length 25'));

      // Check that info was called for capacity table and recommendations
      expect(mockLogger.info).toHaveBeenCalledWith('📊 Capacity Analysis:');
      expect(mockLogger.info).toHaveBeenCalledWith('⚡ Performance Impact:');
      expect(mockLogger.info).toHaveBeenCalledWith('💡 Recommendations:');
    });
  });

  describe('Warning System Utility Functions', () => {
    test('shouldWarn function works correctly', () => {
      expect(shouldWarn(14)).toBe(false);
      expect(shouldWarn(15)).toBe(true);
      expect(shouldWarn(20)).toBe(true);
      expect(shouldWarn(10, 8)).toBe(true); // Custom threshold
      expect(shouldWarn(5, 8)).toBe(false);
    });

    test('warnForHighLength function works with default instance', () => {
      // This will use the default warning system
      warnForHighLength(20);
      // No direct assertions since we can't easily mock the default instance
      // But this tests that the function doesn't throw
    });

    test('generateCapacityTable function works correctly', () => {
      const table = generateCapacityTable(5);

      expect(table).toHaveLength(5);
      expect(table[0].length).toBe(1);
      expect(table[0].capacity).toBe(26);
      expect(table[4].length).toBe(5);

      // Test with custom alphabet
      const customTable = generateCapacityTable(3, 'abc');
      expect(customTable[0].capacity).toBe(3); // 3^1
      expect(customTable[1].capacity).toBe(9); // 3^2
    });

    test('getDefaultWarningSystem returns singleton instance', () => {
      const instance1 = getDefaultWarningSystem();
      const instance2 = getDefaultWarningSystem();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Length Validation Integration', () => {
    test('validateLengthWithWarnings handles valid lengths', () => {
      const result = validateLengthWithWarnings(10);

      expect(result.isValid).toBe(true);
      expect(result.length).toBe(10);
      expect(result.warningGenerated).toBe(false);
      expect(result.error).toBeUndefined();
    });

    test('validateLengthWithWarnings handles invalid lengths', () => {
      // Test invalid string
      const invalidString = validateLengthWithWarnings('invalid');
      expect(invalidString.isValid).toBe(false);
      expect(invalidString.error).toContain('Invalid length value');

      // Test out of range
      const outOfRange = validateLengthWithWarnings(50);
      expect(outOfRange.isValid).toBe(false);
      expect(outOfRange.error).toContain('between 1 and 26');
    });

    test('validateLengthWithWarnings generates warnings for high values', () => {
      const result = validateLengthWithWarnings(20, { enableWarnings: true });

      expect(result.isValid).toBe(true);
      expect(result.length).toBe(20);
      expect(result.warningGenerated).toBe(true);
    });

    test('validateLengthWithWarnings respects warning suppression', () => {
      const result = validateLengthWithWarnings(20, {
        enableWarnings: true,
        suppressWarnings: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.length).toBe(20);
      expect(result.warningGenerated).toBe(false);
    });

    test('validateCliLength throws for invalid values', () => {
      expect(() => validateCliLength('invalid')).toThrow('Invalid length value');
      expect(() => validateCliLength(30)).toThrow('between 1 and 26');
    });

    test('validateCliLength returns valid length', () => {
      expect(validateCliLength(15)).toBe(15);
      expect(validateCliLength('20')).toBe(20);
    });

    test('shouldShowPerformanceWarning works correctly', () => {
      expect(shouldShowPerformanceWarning(14)).toBe(false);
      expect(shouldShowPerformanceWarning(15)).toBe(true);
      expect(shouldShowPerformanceWarning(20)).toBe(true);
      expect(shouldShowPerformanceWarning(10, 8)).toBe(true);
    });

    test('createWarningConfig creates proper configuration', () => {
      const config = createWarningConfig(18, false, true);

      expect(config.lengthThreshold).toBe(18);
      expect(config.showCapacityTable).toBe(false);
      expect(config.showPerformanceInfo).toBe(true);
      expect(config.enabled).toBe(true);
    });

    test('validateMultipleLengths handles batch validation', () => {
      const values = [10, 15, 20, 'invalid', 30];
      const results = validateMultipleLengths(values);

      expect(results).toHaveLength(5);
      expect(results[0].isValid).toBe(true);
      expect(results[0].warningGenerated).toBe(false);

      expect(results[1].isValid).toBe(true);
      expect(results[1].warningGenerated).toBe(true);

      expect(results[2].isValid).toBe(true);
      expect(results[2].warningGenerated).toBe(true); // Different from 15, so warning shows

      expect(results[3].isValid).toBe(false);
      expect(results[4].isValid).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('warning system integrates with length validation', () => {
      const warningSystem = new WarningSystem({
        logger: mockLogger,
        lengthThreshold: 18,
      });

      const validationOptions: LengthValidationOptions = {
        enableWarnings: true,
        suppressWarnings: false,
        warningConfig: warningSystem.getConfig(),
      };

      const result = validateLengthWithWarnings(20, validationOptions);

      expect(result.isValid).toBe(true);
      expect(result.warningGenerated).toBe(true);
    });

    test('capacity table generation matches expected values', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });
      const warningData = warningSystem.generateWarningData(5);

      // Verify capacity calculations match combinatorial math
      expect(warningData.capacityTable[0].capacity).toBe(26); // 26^1
      expect(warningData.capacityTable[1].capacity).toBe(676); // 26^2
      expect(warningData.capacityTable[2].capacity).toBe(17576); // 26^3
      expect(warningData.capacityTable[3].capacity).toBe(456976); // 26^4
    });

    test('performance warnings include all required information', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });
      const warningData = warningSystem.generateWarningData(22);

      expect(warningData.performanceInfo.computationalOverhead).toBeDefined();
      expect(warningData.performanceInfo.memoryUsage).toBeDefined();
      expect(warningData.performanceInfo.processingTime).toBeDefined();
      expect(warningData.performanceInfo.riskLevel).toBeDefined();

      expect(['low', 'moderate', 'high', 'extreme']).toContain(
        warningData.performanceInfo.riskLevel
      );
    });

    test('warning system respects disabled state', () => {
      const warningSystem = new WarningSystem({
        logger: mockLogger,
        enabled: false,
      });

      expect(warningSystem.shouldWarn(25)).toBe(false);

      warningSystem.warnForHighLength(25);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    test('capacity descriptions are human-readable', () => {
      const warningSystem = new WarningSystem({ logger: mockLogger });
      const warningData = warningSystem.generateWarningData(10);

      warningData.capacityTable.forEach((entry) => {
        expect(entry.description).toMatch(
          /\d+(\.\d+)?\s+(combinations|thousand|million|billion|trillion)/
        );
      });
    });
  });
});
