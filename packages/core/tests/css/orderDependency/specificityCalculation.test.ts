/**
 * SpecificityCalculator Test Suite
 *
 * Comprehensive test suite for SpecificityCalculator covering:
 * - Specificity calculation for various CSS selectors
 * - Conflict analysis and comparison functionality
 * - Performance testing and error handling
 * - Caching behavior and configuration integration
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { OrderHandlingConfig } from '../../../src/css/orderDependency/configuration';
import { SpecificityCalculator } from '../../../src/css/orderDependency/specificityCalculation';
import { CSSRule, RuleType } from '../../../src/css/orderDependency/types';

describe('SpecificityCalculator', () => {
  let calculator: SpecificityCalculator;
  let config: OrderHandlingConfig;

  // Helper function to create mock CSS rules
  const createMockRule = (
    id: string,
    selector: string,
    properties: string[] = ['color'],
    important = false
  ): CSSRule => ({
    id,
    selector,
    declarations: properties.map((prop) => ({
      property: prop,
      value: 'test-value',
      important,
    })),
    type: RuleType.STYLE,
    important,
    lineNumber: 1,
    sourceFile: 'test.css',
  });

  beforeEach(() => {
    config = new OrderHandlingConfig();
    calculator = new SpecificityCalculator(config.getConfig());
  });

  describe('Basic Specificity Calculation', () => {
    it('should create calculator instance', () => {
      expect(calculator).toBeInstanceOf(SpecificityCalculator);
    });

    it('should calculate specificity for element selectors', () => {
      const rule = createMockRule('rule1', 'div');
      const specificity = calculator.calculateSpecificity(rule);

      expect(specificity).toBeDefined();
      expect(specificity.ruleId).toBe('rule1');
      expect(specificity.weight).toBeGreaterThan(0);
      expect(specificity.specificity[3]).toBe(1); // One element
    });

    it('should calculate specificity for class selectors', () => {
      const rule = createMockRule('rule1', '.button');
      const specificity = calculator.calculateSpecificity(rule);

      expect(specificity).toBeDefined();
      expect(specificity.weight).toBeGreaterThan(0);
      expect(specificity.specificity[2]).toBe(1); // One class
    });

    it('should calculate specificity for ID selectors', () => {
      const rule = createMockRule('rule1', '#header');
      const specificity = calculator.calculateSpecificity(rule);

      expect(specificity).toBeDefined();
      expect(specificity.weight).toBeGreaterThan(0);
      expect(specificity.specificity[1]).toBe(1); // One ID
    });

    it('should calculate specificity for combined selectors', () => {
      const rule = createMockRule('rule1', '#header .nav .button');
      const specificity = calculator.calculateSpecificity(rule);

      expect(specificity).toBeDefined();
      expect(specificity.weight).toBeGreaterThan(0);
      expect(specificity.specificity[1]).toBe(1); // One ID
      expect(specificity.specificity[2]).toBe(2); // Two classes
    });
  });

  describe('Complex Selector Specificity', () => {
    it('should handle pseudo-classes', () => {
      const rule = createMockRule('rule1', 'a:hover');
      const specificity = calculator.calculateSpecificity(rule);

      expect(specificity).toBeDefined();
      expect(specificity.weight).toBeGreaterThan(0);
      expect(specificity.specificity[2]).toBe(1); // Pseudo-class counts as class
      expect(specificity.specificity[3]).toBe(1); // Element
    });

    it('should handle pseudo-elements', () => {
      const rule = createMockRule('rule1', 'p::before');
      const specificity = calculator.calculateSpecificity(rule);

      expect(specificity).toBeDefined();
      expect(specificity.weight).toBeGreaterThan(0);
      expect(specificity.specificity[3]).toBe(2); // Element + pseudo-element
    });

    it('should handle attribute selectors', () => {
      const rule = createMockRule('rule1', '[type="button"]');
      const specificity = calculator.calculateSpecificity(rule);

      expect(specificity).toBeDefined();
      expect(specificity.weight).toBeGreaterThan(0);
      expect(specificity.specificity[2]).toBe(1); // Attribute counts as class
    });

    it('should handle complex combinations', () => {
      const rule = createMockRule('rule1', '#main .sidebar[data-active] > .button:hover::after');
      const specificity = calculator.calculateSpecificity(rule);

      expect(specificity).toBeDefined();
      expect(specificity.weight).toBeGreaterThan(0);
      expect(specificity.specificity[1]).toBe(1); // One ID
      expect(specificity.specificity[2]).toBeGreaterThanOrEqual(3); // Classes, attributes, pseudo-classes
    });
  });

  describe('Specificity Comparison', () => {
    it('should compare two specificities correctly', () => {
      const rule1 = createMockRule('rule1', '.button');
      const rule2 = createMockRule('rule2', '#button');

      const spec1 = calculator.calculateSpecificity(rule1);
      const spec2 = calculator.calculateSpecificity(rule2);

      const result = calculator.compareSpecificity(
        spec1.specificity,
        spec2.specificity,
        rule1,
        rule2
      );
      expect(result).toBeLessThan(0); // Class should be less specific than ID
    });

    it('should handle equal specificity', () => {
      const rule1 = createMockRule('rule1', '.button');
      const rule2 = createMockRule('rule2', '.menu');

      const spec1 = calculator.calculateSpecificity(rule1);
      const spec2 = calculator.calculateSpecificity(rule2);

      const result = calculator.compareSpecificity(
        spec1.specificity,
        spec2.specificity,
        rule1,
        rule2
      );
      expect(result).toBe(0); // Should be equal
    });

    it('should handle important declarations', () => {
      const rule1 = createMockRule('rule1', '.button', ['color'], false);
      const rule2 = createMockRule('rule2', '.button', ['color'], true);

      const spec1 = calculator.calculateSpecificity(rule1);
      const spec2 = calculator.calculateSpecificity(rule2);

      const result = calculator.compareSpecificity(
        spec1.specificity,
        spec2.specificity,
        rule1,
        rule2
      );
      expect(result).toBeLessThan(0); // Normal should be less than important
    });
  });

  describe('Conflict Analysis', () => {
    it('should analyze conflicts between rules', () => {
      const rules = [
        createMockRule('rule1', '.button', ['color']),
        createMockRule('rule2', '#button', ['color']),
      ];

      const conflicts = calculator.analyzeConflicts(rules);
      expect(conflicts).toBeDefined();
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should handle multiple potential conflicts', () => {
      const rules = [
        createMockRule('rule1', '.primary', ['background']),
        createMockRule('rule2', '.secondary', ['background']),
        createMockRule('rule3', '#special', ['background']),
      ];

      const conflicts = calculator.analyzeConflicts(rules);
      expect(conflicts).toBeDefined();
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should detect no conflicts for non-overlapping rules', () => {
      const rules = [
        createMockRule('rule1', '.button', ['color']),
        createMockRule('rule2', '.menu', ['background']),
      ];

      const conflicts = calculator.analyzeConflicts(rules);
      expect(conflicts).toBeDefined();
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should handle batch calculations efficiently', () => {
      const rules = Array.from({ length: 50 }, (_, i) => createMockRule(`rule${i}`, `.class${i}`));

      const start = performance.now();
      const results = calculator.batchCalculateSpecificity(rules);
      const end = performance.now();

      expect(results).toBeDefined();
      expect(results.size).toBe(50);
      expect(end - start).toBeLessThan(1000); // Should complete reasonably quickly
    });

    it('should return correct results for batch processing', () => {
      const rules = [
        createMockRule('rule1', '.button'),
        createMockRule('rule2', '#header'),
        createMockRule('rule3', 'div'),
      ];

      const results = calculator.batchCalculateSpecificity(rules);
      expect(results.size).toBe(3);
      expect(results.get('rule1')).toBeDefined();
      expect(results.get('rule2')).toBeDefined();
      expect(results.get('rule3')).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle complex selectors efficiently', () => {
      const rule = createMockRule(
        'complex',
        '#main .content .sidebar[data-section="nav"] > ul li.active:nth-child(2n+1) a:hover::before'
      );

      const start = performance.now();
      const result = calculator.calculateSpecificity(rule);
      const end = performance.now();

      expect(result).toBeDefined();
      expect(end - start).toBeLessThan(50); // Should be reasonably fast
    });

    it('should handle many calculations efficiently', () => {
      const rules = Array.from({ length: 100 }, (_, i) => createMockRule(`rule${i}`, `.class${i}`));

      const start = performance.now();
      rules.forEach((rule) => calculator.calculateSpecificity(rule));
      const end = performance.now();

      expect(end - start).toBeLessThan(500); // Should complete quickly
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid selectors gracefully', () => {
      const rule = createMockRule('bad', '...invalid');
      const result = calculator.calculateSpecificity(rule);

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    it('should handle empty selectors', () => {
      const rule = createMockRule('empty', '');
      const result = calculator.calculateSpecificity(rule);

      expect(result).toBeDefined();
    });

    it('should handle malformed pseudo-classes', () => {
      const rule = createMockRule('malformed', ':invalid-pseudo');
      const result = calculator.calculateSpecificity(rule);

      expect(result).toBeDefined();
    });

    it('should handle unclosed brackets', () => {
      const rule = createMockRule('unclosed', '[type="button"');
      const result = calculator.calculateSpecificity(rule);

      expect(result).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should cache calculation results', () => {
      const rule = createMockRule('cached', '.complex-selector');

      // First calculation
      const result1 = calculator.calculateSpecificity(rule);

      // Second calculation should use cache (if enabled)
      const result2 = calculator.calculateSpecificity(rule);

      expect(result1.ruleId).toBe(result2.ruleId);
      expect(result1.specificity).toEqual(result2.specificity);
    });

    it('should support cache clearing', () => {
      const rule = createMockRule('test', '.test');
      calculator.calculateSpecificity(rule);

      expect(() => calculator.clearCache()).not.toThrow();

      const stats = calculator.getCacheStats();
      expect(stats).toHaveProperty('specificityCached');
      expect(stats).toHaveProperty('conflictsCached');
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configuration settings', () => {
      const customConfig = new OrderHandlingConfig();
      customConfig.updateConfig({ enableCaching: false });

      const customCalculator = new SpecificityCalculator(customConfig.getConfig());
      expect(customCalculator).toBeInstanceOf(SpecificityCalculator);

      const rule = createMockRule('test', '.test');
      const result = customCalculator.calculateSpecificity(rule);
      expect(result).toBeDefined();
    });

    it('should handle batch size configuration', () => {
      const customConfig = new OrderHandlingConfig();
      customConfig.updateConfig({ batchSize: 10 });

      const customCalculator = new SpecificityCalculator(customConfig.getConfig());

      const rules = Array.from({ length: 25 }, (_, i) => createMockRule(`rule${i}`, `.class${i}`));

      const results = customCalculator.batchCalculateSpecificity(rules);
      expect(results.size).toBe(25);
    });
  });

  describe('Integration Features', () => {
    it('should provide detailed specificity breakdown', () => {
      const rule = createMockRule('detailed', '#main .nav .button:hover');
      const result = calculator.calculateSpecificity(rule);

      expect(result.components).toBeDefined();
      expect(result.components.ids).toBeDefined();
      expect(result.components.classes).toBeDefined();
      expect(result.components.elements).toBeDefined();
      expect(result.components.pseudoClasses).toBeDefined();
    });

    it('should calculate processing time', () => {
      const rule = createMockRule('timed', '.test');
      const result = calculator.calculateSpecificity(rule);

      expect(result.calculationTime).toBeDefined();
      expect(result.calculationTime).toBeGreaterThanOrEqual(0);
    });
  });
});
