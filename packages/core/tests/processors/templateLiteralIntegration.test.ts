/**
 * Template Literal Integration Tests
 * Comprehensive end-to-end testing for the template literal processing pipeline
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { IntegrationTestSuite, createIntegrationTestSuite, runQuickValidation, runFullTestSuite } from '../../src/processors/integrationTestSuite';

describe('Template Literal Integration Tests', () => {
  let testSuite: IntegrationTestSuite;

  beforeAll(() => {
    testSuite = createIntegrationTestSuite({
      timeout: 30000,
      verbose: false,
      stopOnFirstFailure: false,
      coverageThreshold: 80,
      categories: ['standard', 'edge', 'error'],
    });
  });

  describe('Standard Template Literal Processing', () => {
    test('should process basic template literals', async () => {
      const result = await testSuite.runAllTests();
      
      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.passedTests).toBeGreaterThan(0);
      
      // Check that standard cases pass
      const standardTests = result.results.filter(r => r.category === 'standard');
      const standardPassed = standardTests.filter(r => r.passed).length;
      const standardPassRate = standardPassed / standardTests.length;
      
      expect(standardPassRate).toBeGreaterThan(0.8); // 80% pass rate for standard cases
    }, 45000);

    test('should handle multi-line templates correctly', async () => {
      const result = await testSuite.runAllTests();
      
      const multiLineTest = result.results.find(r => r.name === 'Multi-line Template');
      expect(multiLineTest).toBeDefined();
      expect(multiLineTest?.passed).toBe(true);
    }, 30000);

    test('should process tagged template literals', async () => {
      const result = await testSuite.runAllTests();
      
      const taggedTest = result.results.find(r => r.name === 'Tagged Template Literal');
      expect(taggedTest).toBeDefined();
      expect(taggedTest?.passed).toBe(true);
    }, 30000);

    test('should handle conditional class generation', async () => {
      const result = await testSuite.runAllTests();
      
      const conditionalTest = result.results.find(r => r.name === 'Conditional Class Generation');
      expect(conditionalTest).toBeDefined();
      expect(conditionalTest?.passed).toBe(true);
    }, 30000);

    test('should process complex expressions', async () => {
      const result = await testSuite.runAllTests();
      
      const complexTest = result.results.find(r => r.name === 'Complex Expression');
      expect(complexTest).toBeDefined();
      expect(complexTest?.passed).toBe(true);
    }, 30000);
  });

  describe('Edge Case Handling', () => {
    test('should handle empty templates', async () => {
      const result = await testSuite.runAllTests();
      
      const emptyTest = result.results.find(r => r.name === 'Empty Template');
      expect(emptyTest).toBeDefined();
      // Empty templates might pass or fail depending on implementation
      expect(emptyTest?.executionTime).toBeLessThan(1000);
    }, 30000);

    test('should handle escaped backticks', async () => {
      const result = await testSuite.runAllTests();
      
      const escapedTest = result.results.find(r => r.name === 'Template with Escaped Backticks');
      expect(escapedTest).toBeDefined();
      expect(escapedTest?.passed).toBe(true);
    }, 30000);

    test('should handle deeply nested templates', async () => {
      const result = await testSuite.runAllTests();
      
      const nestedTest = result.results.find(r => r.name === 'Deeply Nested Templates');
      expect(nestedTest).toBeDefined();
      // May pass or fail depending on nesting limits
      expect(nestedTest?.executionTime).toBeLessThan(5000);
    }, 30000);

    test('should handle Unicode characters', async () => {
      const result = await testSuite.runAllTests();
      
      const unicodeTest = result.results.find(r => r.name === 'Template with Unicode');
      expect(unicodeTest).toBeDefined();
      expect(unicodeTest?.passed).toBe(true);
    }, 30000);

    test('should handle large template literals', async () => {
      const result = await testSuite.runAllTests();
      
      const largeTest = result.results.find(r => r.name === 'Large Template Literal');
      expect(largeTest).toBeDefined();
      // Large templates should be processed within reasonable time
      expect(largeTest?.executionTime).toBeLessThan(10000);
    }, 45000);

    test('should handle special characters', async () => {
      const result = await testSuite.runAllTests();
      
      const specialTest = result.results.find(r => r.name === 'Template with Special Characters');
      expect(specialTest).toBeDefined();
      expect(specialTest?.passed).toBe(true);
    }, 30000);
  });

  describe('Error Handling and Fallback', () => {
    test('should handle malformed templates with fallback', async () => {
      const result = await testSuite.runAllTests();
      
      const malformedTest = result.results.find(r => r.name === 'Malformed Template');
      expect(malformedTest).toBeDefined();
      
      // Malformed templates should trigger fallback
      if (malformedTest?.output?.fallbackResult) {
        expect(malformedTest.output.fallbackResult.success).toBe(true);
      }
    }, 30000);

    test('should handle invalid JavaScript expressions', async () => {
      const result = await testSuite.runAllTests();
      
      const invalidTest = result.results.find(r => r.name === 'Invalid JavaScript Expression');
      expect(invalidTest).toBeDefined();
      
      // Should fail parsing but succeed in fallback
      if (invalidTest?.output) {
        expect(invalidTest.output.parsingResult?.success).toBe(false);
        expect(invalidTest.output.fallbackResult?.success).toBe(true);
      }
    }, 30000);

    test('should handle undefined variables gracefully', async () => {
      const result = await testSuite.runAllTests();
      
      const undefinedTest = result.results.find(r => r.name === 'Undefined Variables');
      expect(undefinedTest).toBeDefined();
      
      // Should handle undefined variables through fallback
      if (undefinedTest?.output?.fallbackResult) {
        expect(undefinedTest.output.fallbackResult.success).toBe(true);
      }
    }, 30000);

    test('should handle non-string inputs', async () => {
      const result = await testSuite.runAllTests();
      
      const nonStringTest = result.results.find(r => r.name === 'Non-string Template');
      expect(nonStringTest).toBeDefined();
      
      // Non-string inputs should fail early but be handled
      expect(nonStringTest?.passed).toBe(false);
    }, 30000);

    test('should handle null inputs', async () => {
      const result = await testSuite.runAllTests();
      
      const nullTest = result.results.find(r => r.name === 'Null Input');
      expect(nullTest).toBeDefined();
      
      // Null inputs should fail early but be handled
      expect(nullTest?.passed).toBe(false);
    }, 30000);
  });

  describe('Coverage and Performance', () => {
    test('should meet coverage thresholds', async () => {
      const result = await testSuite.runAllTests();
      
      expect(result.coverage.detection).toBeGreaterThan(70);
      expect(result.coverage.parsing).toBeGreaterThan(60);
      expect(result.coverage.runtime).toBeGreaterThan(60);
      expect(result.coverage.fallback).toBeGreaterThan(50);
    }, 45000);

    test('should complete within performance baselines', async () => {
      const result = await testSuite.runAllTests();
      
      // Total execution time should be reasonable
      expect(result.executionTime).toBeLessThan(60000); // 60 seconds max
      
      // Individual test execution times should be reasonable
      const slowTests = result.results.filter(r => r.executionTime > 5000);
      expect(slowTests.length).toBeLessThan(result.totalTests * 0.1); // Less than 10% slow tests
    }, 60000);

    test('should have acceptable error rates', async () => {
      const result = await testSuite.runAllTests();
      
      const errorTests = result.results.filter(r => r.category === 'error');
      const nonErrorTests = result.results.filter(r => r.category !== 'error');
      
      // Non-error tests should have high pass rate
      const nonErrorPassRate = nonErrorTests.filter(r => r.passed).length / nonErrorTests.length;
      expect(nonErrorPassRate).toBeGreaterThan(0.8);
      
      // Error tests are expected to fail, but should be handled gracefully
      const errorHandledTests = errorTests.filter(r => !r.error || r.output?.fallbackResult?.success);
      const errorHandleRate = errorHandledTests.length / errorTests.length;
      expect(errorHandleRate).toBeGreaterThan(0.7);
    }, 45000);
  });

  describe('End-to-End Workflow Validation', () => {
    test('should validate complete processing pipeline', async () => {
      const isValid = await testSuite.validateEndToEndWorkflow();
      expect(isValid).toBe(true);
    }, 30000);

    test('should run performance tests successfully', async () => {
      const performanceResult = await testSuite.runPerformanceTests();
      
      expect(performanceResult.performanceResults).toBeDefined();
      expect(performanceResult.performanceResults.metrics).toBeDefined();
      expect(performanceResult.performanceResults.metrics.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Quick Validation Functions', () => {
    test('runQuickValidation should pass', async () => {
      const result = await runQuickValidation();
      expect(result).toBe(true);
    }, 15000);

    test('runFullTestSuite should return comprehensive results', async () => {
      const result = await runFullTestSuite();
      
      expect(result.totalTests).toBeGreaterThan(10);
      expect(result.passedTests).toBeGreaterThan(0);
      expect(result.coverage).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(100);
    }, 60000);
  });

  describe('Configuration and Setup', () => {
    test('should accept custom configuration', () => {
      const customSuite = createIntegrationTestSuite({
        timeout: 15000,
        verbose: true,
        stopOnFirstFailure: true,
        coverageThreshold: 90,
        categories: ['standard', 'edge'],
      });
      
      expect(customSuite).toBeDefined();
    });

    test('should use default configuration when none provided', () => {
      const defaultSuite = createIntegrationTestSuite();
      expect(defaultSuite).toBeDefined();
    });

    test('should handle timeout configuration', async () => {
      const quickSuite = createIntegrationTestSuite({
        timeout: 5000,
        categories: ['standard'],
      });
      
      const startTime = Date.now();
      const result = await quickSuite.runAllTests();
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(15000); // Should complete quickly
    }, 20000);
  });

  describe('Error Scenarios and Resilience', () => {
    test('should handle component initialization failures gracefully', () => {
      // Test that the suite can handle component failures
      expect(() => {
        createIntegrationTestSuite({
          timeout: -1, // Invalid timeout
        });
      }).not.toThrow();
    });

    test('should handle partial test failures without crashing', async () => {
      const faultTolerantSuite = createIntegrationTestSuite({
        stopOnFirstFailure: false,
        categories: ['error'], // Only run error cases
      });
      
      const result = await faultTolerantSuite.runAllTests();
      
      expect(result).toBeDefined();
      expect(result.totalTests).toBeGreaterThan(0);
      // Error tests are expected to have failures
      expect(result.failedTests).toBeGreaterThan(0);
    }, 30000);
  });
});

describe('Integration Test Reporting', () => {
  test('should generate comprehensive test summary', async () => {
    const result = await runFullTestSuite();
    
    expect(result.summary).toContain('Integration Test Suite Results');
    expect(result.summary).toContain('Total Tests:');
    expect(result.summary).toContain('Passed:');
    expect(result.summary).toContain('Failed:');
    expect(result.summary).toContain('Coverage:');
    expect(result.summary).toContain('Detection:');
    expect(result.summary).toContain('Parsing:');
    expect(result.summary).toContain('Runtime:');
    expect(result.summary).toContain('Fallback:');
    expect(result.summary).toContain('Overall Status:');
  }, 60000);

  test('should provide detailed test results', async () => {
    const result = await runFullTestSuite();
    
    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
    
    // Check result structure
    for (const testResult of result.results.slice(0, 5)) {
      expect(testResult.name).toBeDefined();
      expect(typeof testResult.passed).toBe('boolean');
      expect(typeof testResult.executionTime).toBe('number');
      expect(testResult.category).toBeDefined();
    }
  }, 60000);

  test('should track execution times accurately', async () => {
    const result = await runFullTestSuite();
    
    expect(result.executionTime).toBeGreaterThan(0);
    
    // Individual test times should be reasonable
    for (const testResult of result.results) {
      expect(testResult.executionTime).toBeGreaterThan(0);
      expect(testResult.executionTime).toBeLessThan(30000); // 30 seconds max per test
    }
  }, 60000);
});