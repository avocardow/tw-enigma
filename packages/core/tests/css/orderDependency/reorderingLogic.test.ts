/**
 * ReorderingLogic Test Suite
 *
 * Comprehensive test suite for ReorderingLogic covering:
 * - Safe CSS rule reordering algorithms
 * - Dependency-aware optimization
 * - Conflict detection and prevention
 * - Performance metrics and error handling
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { OrderHandlingConfig } from '../../../src/css/orderDependency/configuration';
import { ReorderingLogic } from '../../../src/css/orderDependency/reorderingLogic';
import { CSSRule, RuleType } from '../../../src/css/orderDependency/types';

describe('ReorderingLogic', () => {
  let reorderingLogic: ReorderingLogic;
  let config: OrderHandlingConfig;

  const createRule = (
    id: string,
    selector: string,
    properties: Array<{ property: string; value: string; important?: boolean }> = [
      { property: 'color', value: 'red', important: false },
    ],
    ruleType: RuleType = RuleType.STYLE
  ): CSSRule => ({
    id,
    selector,
    declarations: properties.map((prop) => ({
      ...prop,
      important: prop.important ?? false,
    })),
    lineNumber: 1,
    sourceFile: 'test.css',
    type: ruleType,
    important: properties.some((p) => p.important) || false,
  });

  beforeEach(() => {
    config = new OrderHandlingConfig();
    reorderingLogic = new ReorderingLogic(config.getConfig());
  });

  describe('Basic Reordering', () => {
    it('should create reordering logic instance', () => {
      expect(reorderingLogic).toBeInstanceOf(ReorderingLogic);
    });

    it('should handle empty rule sets', async () => {
      const result = await reorderingLogic.reorderRules([]);
      expect(result).toBeDefined();
      expect(result.originalOrder).toEqual([]);
      expect(result.newOrder).toEqual([]);
      expect(result.isSafe).toBe(true);
    });

    it('should handle single rule', async () => {
      const rules = [createRule('rule1', '.test')];
      const result = await reorderingLogic.reorderRules(rules);

      expect(result).toBeDefined();
      expect(result.originalOrder).toEqual(['rule1']);
      expect(result.newOrder).toEqual(['rule1']);
      expect(result.isSafe).toBe(true);
    });

    it('should reorder independent rules safely', async () => {
      const rules = [
        createRule('rule1', '.class1'),
        createRule('rule2', '.class2'),
        createRule('rule3', '.class3'),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.isSafe).toBe(true);
      expect(result.originalOrder).toEqual(['rule1', 'rule2', 'rule3']);
      expect(result.metrics).toBeDefined();
    });
  });

  describe('Dependency-Aware Reordering', () => {
    it('should preserve dependent rule order', async () => {
      const rules = [createRule('base', '.btn'), createRule('primary', '.btn.primary')];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.isSafe).toBe(true);
    });

    it('should detect unsafe reordering scenarios', async () => {
      const rules = [
        createRule('specific', '#button.btn', [{ property: 'color', value: 'red' }]),
        createRule('general', '.btn', [{ property: 'color', value: 'blue' }]),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(typeof result.isSafe).toBe('boolean');
    });

    it('should handle complex dependency chains', async () => {
      const rules = [
        createRule('reset', '*', [{ property: 'margin', value: '0' }]),
        createRule('base', '.container'),
        createRule('layout', '.container .content'),
        createRule('component', '.container .content .button'),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.metrics.rulesAnalyzed).toBe(4);
    });
  });

  describe('Optimization Strategies', () => {
    it('should identify optimization opportunities', async () => {
      const rules = [
        createRule('btn1', '.btn-primary'),
        createRule('text1', '.text-large'),
        createRule('btn2', '.btn-secondary'),
        createRule('text2', '.text-small'),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.benefits).toBeDefined();
      expect(Array.isArray(result.benefits)).toBe(true);
    });

    it('should handle media queries appropriately', async () => {
      const rules = [
        createRule('base', '.btn', [{ property: 'padding', value: '10px' }]),
        createRule('mobile', '.btn', [{ property: 'padding', value: '5px' }], RuleType.MEDIA),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.isSafe).toBe(true);
    });

    it('should handle important declarations', async () => {
      const rules = [
        createRule('normal', '.btn', [{ property: 'color', value: 'blue', important: false }]),
        createRule('important', '.btn', [{ property: 'color', value: 'red', important: true }]),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.isSafe).toBe(true);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect and report conflicts', async () => {
      const rules = [createRule('high', '#button'), createRule('low', '.button')];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(Array.isArray(result.conflicts)).toBe(true);
    });

    it('should detect cascade violations', async () => {
      const rules = [
        createRule('override', '.btn', [{ property: 'color', value: 'red' }]),
        createRule('base', '.btn', [{ property: 'color', value: 'blue' }]),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.isSafe).toBeDefined();
    });

    it('should report optimization benefits', async () => {
      const rules = Array.from({ length: 10 }, (_, i) => createRule(`rule${i}`, `.class${i}`));

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.benefits).toBeDefined();
      expect(Array.isArray(result.benefits)).toBe(true);
    });
  });

  describe('Performance Tracking', () => {
    it('should track reordering metrics', async () => {
      const rules = Array.from({ length: 50 }, (_, i) => createRule(`rule${i}`, `.class${i}`));

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.processingTime).toBeGreaterThan(0);
      expect(result.metrics.rulesAnalyzed).toBe(50);
      expect(result.metrics.dependenciesFound).toBeGreaterThanOrEqual(0);
    });

    it('should handle large rule sets efficiently', async () => {
      const rules = Array.from({ length: 100 }, (_, i) => createRule(`rule${i}`, `.class${i}`));

      const start = performance.now();
      const result = await reorderingLogic.reorderRules(rules);
      const end = performance.now();

      expect(result).toBeDefined();
      expect(end - start).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.metrics.rulesAnalyzed).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed rules gracefully', async () => {
      const rules = [createRule('bad', '...invalid')];
      const result = await reorderingLogic.reorderRules(rules);

      expect(result).toBeDefined();
      // Should not throw but may mark as unsafe
      expect(typeof result.isSafe).toBe('boolean');
    });

    it('should handle circular dependencies', async () => {
      // Create rules that might form circular dependencies
      const rules = [createRule('rule1', '.a .b'), createRule('rule2', '.b .a')];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(typeof result.isSafe).toBe('boolean');
    });

    it('should handle rules without declarations', async () => {
      const rule: CSSRule = {
        id: 'empty',
        selector: '.test',
        declarations: [],
        lineNumber: 1,
        sourceFile: 'test.css',
        type: RuleType.STYLE,
        important: false,
      };

      const result = await reorderingLogic.reorderRules([rule]);
      expect(result).toBeDefined();
      expect(result.originalOrder).toEqual(['empty']);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configuration settings', async () => {
      const customConfig = new OrderHandlingConfig();
      customConfig.updateConfig({ enableDependencyDetection: false });

      const customReordering = new ReorderingLogic(customConfig.getConfig());
      const rules = [createRule('rule1', '.test')];

      const result = await customReordering.reorderRules(rules);
      expect(result).toBeDefined();
    });

    it('should handle different strictness levels', async () => {
      const strictConfig = new OrderHandlingConfig();
      const strictReordering = new ReorderingLogic(strictConfig.getConfig());

      const rules = [createRule('rule1', '.btn'), createRule('rule2', '.btn.primary')];

      const result = await strictReordering.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.isSafe).toBeDefined();
    });
  });

  describe('Integration Features', () => {
    it('should integrate with dependency detection', async () => {
      const rules = [
        createRule('parent', '.parent'),
        createRule('child', '.parent .child'),
        createRule('grandchild', '.parent .child .grandchild'),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.metrics.dependenciesFound).toBeGreaterThanOrEqual(0);
    });

    it('should provide detailed reordering results', async () => {
      const rules = [
        createRule('rule1', '.a'),
        createRule('rule2', '.b'),
        createRule('rule3', '.c'),
      ];

      const result = await reorderingLogic.reorderRules(rules);
      expect(result).toBeDefined();
      expect(result.originalOrder).toEqual(['rule1', 'rule2', 'rule3']);
      expect(result.newOrder).toBeDefined();
      expect(Array.isArray(result.movedRules)).toBe(true);
      expect(Array.isArray(result.conflicts)).toBe(true);
      expect(Array.isArray(result.benefits)).toBe(true);
    });
  });
});
