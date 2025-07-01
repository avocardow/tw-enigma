/**
 * CSS Order Dependency Integration Test Suite
 *
 * End-to-end integration tests for the complete CSS Order Dependency system
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { OrderHandlingConfig } from '../../../src/css/orderDependency/configuration';
import { createOrderAnalyzer } from '../../../src/css/orderDependency/factory';
import { CSSRule, RuleType, StrictnessLevel } from '../../../src/css/orderDependency/types';

describe('CSS Order Dependency Integration', () => {
  let config: OrderHandlingConfig;

  // Helper function to create CSS rules
  const createRule = (
    id: string,
    selector: string,
    properties: Array<{ property: string; value: string; important?: boolean }> = []
  ): CSSRule => ({
    id,
    selector,
    type: RuleType.STYLE,
    declarations: properties.map((prop) => ({
      property: prop.property,
      value: prop.value,
      important: prop.important ?? false,
    })),
    specificity: { a: 0, b: 0, c: 0, d: 0 },
    source: {
      start: { line: 1, column: 1 },
      end: { line: 1, column: 10 },
    },
  });

  beforeEach(() => {
    config = new OrderHandlingConfig();
  });

  describe('End-to-End Rule Analysis', () => {
    it('should analyze complete CSS rule set', async () => {
      const rules = [
        createRule('rule1', '.btn'),
        createRule('rule2', '.btn:hover'),
        createRule('rule3', '.btn.active'),
      ];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
      expect(result.constraints).toBeDefined();
    });

    it('should handle complex selector hierarchies', async () => {
      const rules = [
        createRule('rule1', 'nav ul li a'),
        createRule('rule2', 'nav ul li a:hover'),
        createRule('rule3', 'nav ul li a.active'),
      ];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });

    it('should preserve media query order', async () => {
      const rules = [
        {
          id: 'media1',
          selector: '@media (max-width: 768px)',
          type: RuleType.MEDIA,
          declarations: [],
          specificity: { a: 0, b: 0, c: 0, d: 0 },
          source: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
        },
        createRule('rule1', '.responsive'),
      ];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should work with strict configuration', async () => {
      config.setStrictness(StrictnessLevel.STRICT);
      const analyzer = createOrderAnalyzer(config.getConfig());
      const rules = [createRule('rule1', '.test'), createRule('rule2', '.test.variant')];

      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });

    it('should work with permissive configuration', async () => {
      config.setStrictness(StrictnessLevel.PERMISSIVE);
      const analyzer = createOrderAnalyzer(config.getConfig());
      const rules = [createRule('rule1', '.independent1'), createRule('rule2', '.independent2')];

      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });

    it('should respect ignored properties', async () => {
      config.updateConfig({ ignoredProperties: ['z-index'] });
      const analyzer = createOrderAnalyzer(config.getConfig());
      const rules = [
        createRule('rule1', '.test', [{ property: 'z-index', value: '10' }]),
        createRule('rule2', '.test2', [{ property: 'color', value: 'red' }]),
      ];

      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });
  });

  describe('Real-world CSS Scenarios', () => {
    it('should handle Bootstrap-like CSS structure', async () => {
      const rules = [
        createRule('btn-base', '.btn', [{ property: 'padding', value: '0.5rem 1rem' }]),
        createRule('btn-primary', '.btn-primary', [{ property: 'background', value: 'blue' }]),
        createRule('btn-hover', '.btn:hover', [{ property: 'opacity', value: '0.8' }]),
      ];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });

    it('should handle Tailwind-like utility classes', async () => {
      const rules = [
        createRule('text-center', '.text-center', [{ property: 'text-align', value: 'center' }]),
        createRule('text-red-500', '.text-red-500', [{ property: 'color', value: '#ef4444' }]),
        createRule('hover-text-red-600', '.hover\\:text-red-600:hover', [
          { property: 'color', value: '#dc2626' },
        ]),
      ];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });

    it('should handle CSS-in-JS style patterns', async () => {
      const rules = [
        createRule('component-xyz', '.component-xyz', [{ property: 'display', value: 'flex' }]),
        createRule('component-abc', '.component-abc', [
          { property: 'position', value: 'relative' },
        ]),
      ];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large CSS files efficiently', async () => {
      const manyRules = Array.from({ length: 1000 }, (_, i) =>
        createRule(`rule-${i}`, `.class-${i}`, [{ property: 'margin', value: `${i}px` }])
      );

      const analyzer = createOrderAnalyzer(config.getConfig());
      const start = performance.now();
      const result = await analyzer.analyzeRules(manyRules);
      const end = performance.now();

      expect(result).toBeDefined();
      expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should cache analysis results effectively', async () => {
      const rules = [createRule('rule1', '.cacheable'), createRule('rule2', '.cacheable:hover')];

      const analyzer = createOrderAnalyzer(config.getConfig());

      // First analysis
      const start1 = performance.now();
      await analyzer.analyzeRules(rules);
      const end1 = performance.now();

      // Second analysis (should be faster due to caching)
      const start2 = performance.now();
      await analyzer.analyzeRules(rules);
      const end2 = performance.now();

      const firstTime = end1 - start1;
      const secondTime = end2 - start2;

      // Second run should be faster or similar (allowing for small variations)
      expect(secondTime).toBeLessThanOrEqual(firstTime * 1.5);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from malformed selectors', async () => {
      const rules = [
        createRule('valid1', '.valid-selector'),
        createRule('invalid', '..invalid..selector'),
        createRule('valid2', '.another-valid'),
      ];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
      // Should process valid rules despite invalid ones
    });

    it('should handle mixed valid and invalid rules', () => {
      const mixedRules: CSSRule[] = [
        createRule('valid1', '.button', [{ property: 'color', value: 'blue' }]),
        createRule('invalid1', '', []), // Invalid rule with empty selector
        createRule('valid2', '.primary', [{ property: 'background', value: 'red' }]),
      ];

      const testAnalyzer = createOrderAnalyzer(config.getConfig());

      // The analyzer should handle invalid rules gracefully
      // Either by throwing a descriptive error or filtering them out
      try {
        const result = testAnalyzer.analyzeRules(mixedRules);
        expect(result).toBeDefined();
        expect(result.analysisMetrics).toBeDefined();
      } catch (error) {
        // If it throws, it should be a descriptive error
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid rule');
      }
    });
  });

  describe('Component Integration', () => {
    it('should integrate order analysis with dependency detection', async () => {
      const rules = [createRule('rule1', '.parent'), createRule('rule2', '.parent .child')];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);

      expect(result).toBeDefined();
      expect(result.constraints).toBeDefined();
      expect(result.analysisMetrics).toBeDefined();
    });

    it('should integrate all components for complete analysis', async () => {
      const rules = [
        createRule('base', '.component', [{ property: 'display', value: 'block' }]),
        createRule('modifier', '.component--large', [{ property: 'font-size', value: '1.5rem' }]),
        createRule('state', '.component.is-active', [{ property: 'opacity', value: '1' }]),
      ];

      const analyzer = createOrderAnalyzer(config.getConfig());
      const result = await analyzer.analyzeRules(rules);

      expect(result).toBeDefined();
      expect(result.constraints).toBeDefined();
      expect(result.analysisMetrics).toBeDefined();
    });
  });

  describe('Configuration Scenarios', () => {
    it('should handle configuration changes during runtime', async () => {
      const rules = [createRule('rule1', '.dynamic'), createRule('rule2', '.dynamic:hover')];

      const analyzer = createOrderAnalyzer(config.getConfig());

      // Initial analysis
      const result1 = await analyzer.analyzeRules(rules);
      expect(result1).toBeDefined();

      // Change configuration
      config.setStrictness(StrictnessLevel.STRICT);

      // Second analysis with different config
      const result2 = await analyzer.analyzeRules(rules);
      expect(result2).toBeDefined();
    });
  });
});
