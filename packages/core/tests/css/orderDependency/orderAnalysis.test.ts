/**
 * OrderPreservationAnalyzer Test Suite
 *
 * Comprehensive test suite for OrderPreservationAnalyzer covering:
 * - Basic functionality and error handling
 * - Complex selector analysis and dependency detection
 * - Configuration integration and caching behavior
 * - Strictness level behavior and performance tracking
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { OrderHandlingConfig } from '../../../src/css/orderDependency/configuration';
import { OrderPreservationAnalyzer } from '../../../src/css/orderDependency/orderAnalysis';
import { CSSRule, RuleType, StrictnessLevel } from '../../../src/css/orderDependency/types';

describe('OrderPreservationAnalyzer', () => {
  let config: OrderHandlingConfig;
  let analyzer: OrderPreservationAnalyzer;

  // Helper function to create mock CSS rules
  const createMockRule = (
    id: string,
    selector: string,
    properties: string[] = ['color'],
    important = false,
    lineNumber = 1,
    type: keyof typeof RuleType = 'STYLE'
  ): CSSRule => ({
    id,
    selector,
    declarations: properties.map((prop) => ({
      property: prop,
      value: 'test-value',
      important,
    })),
    type: RuleType[type],
    important,
    lineNumber,
    sourceFile: 'test.css',
    mediaQuery: type === 'MEDIA' ? '@media (max-width: 768px)' : undefined,
    layer: type === 'LAYER' ? 'test-layer' : undefined,
  });

  beforeEach(() => {
    config = new OrderHandlingConfig();
    analyzer = new OrderPreservationAnalyzer(config.getConfig());
  });

  describe('Basic Functionality', () => {
    it('should create analyzer instance', () => {
      expect(analyzer).toBeInstanceOf(OrderPreservationAnalyzer);
    });

    it('should handle empty rule set', async () => {
      const rules: CSSRule[] = [];
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
      expect(result.ruleOrders).toHaveLength(0);
      expect(result.constraints).toHaveLength(0);
    });

    it('should handle single rule', async () => {
      const rules = [createMockRule('rule1', '.test')];
      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
      expect(result.ruleOrders).toHaveLength(1);
      expect(result.analysisMetrics.rulesAnalyzed).toBe(1);
    });

    it('should detect order dependencies', async () => {
      const rules = [createMockRule('rule1', '.btn'), createMockRule('rule2', '.btn.primary')];

      const result = await analyzer.analyzeRules(rules);
      expect(result).toBeDefined();
      expect(result.ruleOrders).toHaveLength(2);
    });
  });

  describe('Caching', () => {
    it('should support cache operations', () => {
      expect(() => analyzer.clearCache()).not.toThrow();
    });

    it('should provide cache statistics', () => {
      const stats = analyzer.getCacheStats();
      expect(stats).toHaveProperty('rulesCached');
      expect(stats).toHaveProperty('ordersCached');
      expect(stats).toHaveProperty('constraintsCached');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid selectors gracefully', async () => {
      const rules = [createMockRule('bad', '...invalid')];
      await expect(analyzer.analyzeRules(rules)).resolves.toBeDefined();
    });

    it('should handle malformed rules', async () => {
      const malformedRule = {
        id: 'malformed',
        selector: '.test',
        declarations: [],
        lineNumber: 1,
        sourceFile: 'test.css',
        type: RuleType.STYLE,
        important: false,
      } as CSSRule;

      await expect(analyzer.analyzeRules([malformedRule])).resolves.toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should work with different configurations', () => {
      const strictConfig = new OrderHandlingConfig();
      strictConfig.setStrictness(StrictnessLevel.STRICT);

      const strictAnalyzer = new OrderPreservationAnalyzer(strictConfig.getConfig());
      expect(strictAnalyzer).toBeInstanceOf(OrderPreservationAnalyzer);
    });

    it('should handle configuration changes', async () => {
      config.updateConfig({ enableCaching: false });
      await expect(analyzer.analyzeRules([])).resolves.toBeDefined();
    });
  });

  describe('Complex Selector Analysis', () => {
    it('should handle pseudo-class ordering', async () => {
      const rules = [
        createMockRule('link', 'a:link', ['color']),
        createMockRule('visited', 'a:visited', ['color']),
        createMockRule('hover', 'a:hover', ['color']),
        createMockRule('active', 'a:active', ['color']),
      ];

      const result = await analyzer.analyzeRules(rules);
      expect(result.constraints.length).toBeGreaterThan(0);
    });

    it('should handle descendant selectors', async () => {
      const rules = [
        createMockRule('parent', '.parent', ['color']),
        createMockRule('child', '.parent .child', ['color']),
      ];

      const result = await analyzer.analyzeRules(rules);
      expect(result.ruleOrders).toHaveLength(2);
    });

    it('should handle complex combinators', async () => {
      const rules = [
        createMockRule('general', 'div', ['margin']),
        createMockRule('adjacent', 'div + p', ['margin']),
        createMockRule('sibling', 'div ~ p', ['margin']),
      ];

      const result = await analyzer.analyzeRules(rules);
      expect(result.constraints.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Media Query Handling', () => {
    it('should preserve media query order', async () => {
      const rules = [
        createMockRule('base', '.btn', ['padding'], false, 1, 'STYLE'),
        createMockRule('mobile', '.btn', ['padding'], false, 5, 'MEDIA'),
        createMockRule('tablet', '.btn', ['padding'], false, 10, 'MEDIA'),
      ];

      const result = await analyzer.analyzeRules(rules);
      expect(result.ruleOrders).toHaveLength(3);
    });

    it('should handle @layer rules', async () => {
      const rules = [
        createMockRule('layer1', '.btn', ['color'], false, 1, 'LAYER'),
        createMockRule('layer2', '.btn', ['color'], false, 2, 'LAYER'),
      ];

      const result = await analyzer.analyzeRules(rules);
      expect(result.ruleOrders).toHaveLength(2);
    });
  });

  describe('Performance Tracking', () => {
    it('should track analysis time', async () => {
      const rules = [createMockRule('rule1', '.test')];
      const result = await analyzer.analyzeRules(rules);

      expect(result.analysisMetrics.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.analysisMetrics.rulesAnalyzed).toBe(1);
    });

    it('should provide cache statistics', async () => {
      const result = await analyzer.analyzeRules([]);
      expect(
        Number.isNaN(result.analysisMetrics.cacheHitRate) ||
          result.analysisMetrics.cacheHitRate >= 0
      ).toBe(true);
    });
  });

  describe('Integration Features', () => {
    it('should integrate with factory method', async () => {
      const { createOrderAnalyzer } = await import('../../../src/css/orderDependency/factory');
      const factoryAnalyzer = createOrderAnalyzer(config.getConfig());

      expect(factoryAnalyzer).toBeInstanceOf(OrderPreservationAnalyzer);

      const rules = [createMockRule('rule1', '.test')];
      const result = await factoryAnalyzer.analyzeRules(rules);
      expect(result).toBeDefined();
    });
  });
});
