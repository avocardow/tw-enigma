/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createOrderAnalyzer } from '../factory';
import { OrderPreservationAnalyzer } from '../orderAnalysis';
import type { CSSRule } from '../types';
import { RuleType, StrictnessLevel } from '../types';

describe('OrderPreservationAnalyzer', () => {
  let analyzer: OrderPreservationAnalyzer;

  beforeEach(() => {
    analyzer = createOrderAnalyzer({
      strictness: StrictnessLevel.BALANCED,
      enableCaching: true,
    });
  });

  describe('Basic Analysis', () => {
    it('should analyze simple CSS rules', async () => {
      const rules: CSSRule[] = [
        {
          id: 'rule1',
          selector: '.button',
          declarations: [{ property: 'background-color', value: 'blue', important: false }],
          lineNumber: 1,
          sourceFile: 'test.css',
          type: RuleType.STYLE,
          important: false,
        },
        {
          id: 'rule2',
          selector: '.button:hover',
          declarations: [{ property: 'background-color', value: 'red', important: false }],
          lineNumber: 5,
          sourceFile: 'test.css',
          type: RuleType.STYLE,
          important: false,
        },
      ];

      const result = await analyzer.analyzeRules(rules);

      expect(result.ruleOrders).toHaveLength(2);
      expect(result.constraints).not.toHaveLength(0);
      expect(result.criticalRules).toContain('rule2'); // Hover rule should be critical
      expect(result.analysisMetrics.rulesAnalyzed).toBe(2);
    });

    it('should identify media query dependencies', async () => {
      const rules: CSSRule[] = [
        {
          id: 'base',
          selector: '.responsive',
          declarations: [{ property: 'width', value: '100%', important: false }],
          lineNumber: 1,
          sourceFile: 'test.css',
          type: RuleType.STYLE,
          important: false,
        },
        {
          id: 'media',
          selector: '.responsive',
          declarations: [{ property: 'width', value: '50%', important: false }],
          lineNumber: 5,
          sourceFile: 'test.css',
          type: RuleType.MEDIA,
          mediaQuery: '(min-width: 768px)',
          important: false,
        },
      ];

      const result = await analyzer.analyzeRules(rules);

      expect(result.criticalRules).toContain('media');

      // Media rule should have dependency on base rule
      const mediaOrder = result.ruleOrders.find((o) => o.ruleId === 'media');
      expect(mediaOrder?.mustComeAfter).toContain('base');
    });

    it('should handle at-rule ordering', async () => {
      const rules: CSSRule[] = [
        {
          id: 'import',
          selector: '@import "external.css"',
          declarations: [],
          lineNumber: 1,
          sourceFile: 'test.css',
          type: RuleType.IMPORT,
          important: false,
        },
        {
          id: 'style',
          selector: '.main',
          declarations: [{ property: 'color', value: 'black', important: false }],
          lineNumber: 3,
          sourceFile: 'test.css',
          type: RuleType.STYLE,
          important: false,
        },
      ];

      const result = await analyzer.analyzeRules(rules);

      expect(result.criticalRules).toContain('import');

      // Import should come before style
      const importOrder = result.ruleOrders.find((o) => o.ruleId === 'import');
      expect(importOrder?.mustComeBefore).toContain('style');
    });
  });

  describe('Configuration', () => {
    it('should respect preserve order patterns', async () => {
      const customAnalyzer = createOrderAnalyzer({
        preserveOrderSelectors: ['*:focus*', '.preserve-*'],
      });

      const rules: CSSRule[] = [
        {
          id: 'focus-rule',
          selector: '.button:focus',
          declarations: [{ property: 'outline', value: '2px solid blue', important: false }],
          lineNumber: 1,
          sourceFile: 'test.css',
          type: RuleType.STYLE,
          important: false,
        },
      ];

      const result = await customAnalyzer.analyzeRules(rules);

      // Focus rule should be marked as critical due to preserve pattern
      expect(result.criticalRules).toContain('focus-rule');
    });

    it('should handle strictness levels', async () => {
      const strictAnalyzer = createOrderAnalyzer({
        strictness: StrictnessLevel.STRICT,
      });

      const permissiveAnalyzer = createOrderAnalyzer({
        strictness: StrictnessLevel.PERMISSIVE,
      });

      const rules: CSSRule[] = [
        {
          id: 'test',
          selector: '.test',
          declarations: [{ property: 'margin', value: '10px', important: false }],
          lineNumber: 1,
          sourceFile: 'test.css',
          type: RuleType.STYLE,
          important: false,
        },
      ];

      const strictResult = await strictAnalyzer.analyzeRules(rules);
      const permissiveResult = await permissiveAnalyzer.analyzeRules(rules);

      // Results should differ based on strictness
      expect(strictResult.criticalRules.length).toBeGreaterThanOrEqual(
        permissiveResult.criticalRules.length
      );
    });
  });

  describe('Performance', () => {
    it('should cache analysis results', async () => {
      const rule: CSSRule = {
        id: 'cache-test',
        selector: '.cache',
        declarations: [{ property: 'display', value: 'block', important: false }],
        lineNumber: 1,
        sourceFile: 'test.css',
        type: RuleType.STYLE,
        important: false,
      };

      // First analysis
      await analyzer.analyzeRules([rule]);

      // Second analysis should hit cache
      const result = await analyzer.analyzeRules([rule]);
      expect(result.analysisMetrics.cacheHitRate).toBeGreaterThan(0);
    });

    it('should provide cache statistics', () => {
      const stats = analyzer.getCacheStats();
      expect(stats).toHaveProperty('rulesCached');
      expect(stats).toHaveProperty('ordersCached');
      expect(stats).toHaveProperty('constraintsCached');
    });

    it('should clear caches', async () => {
      const rule: CSSRule = {
        id: 'clear-test',
        selector: '.clear',
        declarations: [],
        lineNumber: 1,
        sourceFile: 'test.css',
        type: RuleType.STYLE,
        important: false,
      };

      await analyzer.analyzeRules([rule]);
      analyzer.clearCache();

      const stats = analyzer.getCacheStats();
      expect(stats.rulesCached).toBe(0);
      expect(stats.ordersCached).toBe(0);
      expect(stats.constraintsCached).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should validate input rules', async () => {
      const invalidRules = [
        {
          id: '',
          selector: '',
          declarations: [],
          lineNumber: 1,
          sourceFile: 'test.css',
          type: RuleType.STYLE,
          important: false,
        },
      ] as CSSRule[];

      await expect(analyzer.analyzeRules(invalidRules)).rejects.toThrow();
    });

    it('should handle large rule sets', async () => {
      const largeRuleSet: CSSRule[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `rule${i}`,
        selector: `.class${i}`,
        declarations: [{ property: 'color', value: 'red', important: false }],
        lineNumber: i + 1,
        sourceFile: 'test.css',
        type: RuleType.STYLE,
        important: false,
      }));

      const result = await analyzer.analyzeRules(largeRuleSet);
      expect(result.analysisMetrics.rulesAnalyzed).toBe(1000);
      expect(result.analysisMetrics.processingTime).toBeGreaterThan(0);
    });
  });
});
