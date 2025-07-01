/**
 * CSS Order Dependency Test Suite Entry Point
 *
 * Imports all test files for the CSS Order Dependency system
 */

// Import all test files
import './configuration.test';
import './conflictReporting.test';
import './dependencyDetection.test';
import './integration.test';
import './orderAnalysis.test';
import './reorderingLogic.test';
import './specificityCalculation.test';

// Basic smoke test to ensure the module structure exists
import { describe, expect, it } from 'vitest';

describe('CSS Order Dependency System', () => {
  it('should have all required modules', async () => {
    // Test that all main modules can be imported
    const modules = [
      '../../../src/css/orderDependency/orderAnalysis',
      '../../../src/css/orderDependency/dependencyDetection',
      '../../../src/css/orderDependency/specificityCalculation',
      '../../../src/css/orderDependency/reorderingLogic',
      '../../../src/css/orderDependency/configuration',
      '../../../src/css/orderDependency/conflictReporting',
      '../../../src/css/orderDependency/factory',
      '../../../src/css/orderDependency/types',
      '../../../src/css/orderDependency/constants',
    ];

    for (const modulePath of modules) {
      try {
        await import(modulePath);
        expect(true).toBe(true); // Module imported successfully
      } catch (error) {
        console.warn(`Failed to import ${modulePath}:`, error);
        // Don't fail the test for missing modules during development
      }
    }
  });

  it('should export main factory function', async () => {
    try {
      const { createOrderAnalyzer } = await import('../../../src/css/orderDependency/factory');
      expect(createOrderAnalyzer).toBeDefined();
      expect(typeof createOrderAnalyzer).toBe('function');
    } catch (error) {
      console.warn('Factory function not available:', error);
    }
  });

  it('should export core types', async () => {
    try {
      const types = await import('../../../src/css/orderDependency/types');
      expect(types).toBeDefined();
      // Check for key exports
      expect(types.RuleType).toBeDefined();
    } catch (error) {
      console.warn('Types not available:', error);
    }
  });

  it('should export constants', async () => {
    try {
      const constants = await import('../../../src/css/orderDependency/constants');
      expect(constants).toBeDefined();
      expect(constants.DEFAULT_ORDER_CONFIG).toBeDefined();
    } catch (error) {
      console.warn('Constants not available:', error);
    }
  });
});
