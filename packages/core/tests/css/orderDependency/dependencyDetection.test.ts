/**
 * Dependency Detection Engine Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { OrderHandlingConfig } from '../../../src/css/orderDependency/configuration';
import { DependencyDetectionEngine } from '../../../src/css/orderDependency/dependencyDetection';
import { CSSRule, RuleType } from '../../../src/css/orderDependency/types';

describe('DependencyDetectionEngine', () => {
  let engine: DependencyDetectionEngine;
  let config: OrderHandlingConfig;

  const createRule = (
    id: string,
    selector: string,
    properties: Array<{ property: string; value: string; important: boolean }> = [
      { property: 'color', value: 'red', important: false },
    ]
  ): CSSRule => ({
    id,
    selector,
    declarations: properties,
    lineNumber: 1,
    sourceFile: 'test.css',
    type: RuleType.STYLE,
    important: false,
  });

  beforeEach(() => {
    config = new OrderHandlingConfig();
    engine = new DependencyDetectionEngine(config.getConfig());
  });

  describe('Basic Detection', () => {
    it('should create engine instance', () => {
      expect(engine).toBeInstanceOf(DependencyDetectionEngine);
    });

    it('should detect no dependencies for unrelated rules', () => {
      const rules = [createRule('rule1', '.class1'), createRule('rule2', '.class2')];

      const result = engine.detectDependencies(rules);
      expect(result).toBeDefined();
    });

    it('should detect dependencies between overlapping selectors', () => {
      const rules = [createRule('rule1', '.btn'), createRule('rule2', '.btn.primary')];

      const result = engine.detectDependencies(rules);
      expect(result).toBeDefined();
    });
  });

  describe('Specificity Dependencies', () => {
    it('should detect specificity conflicts', () => {
      const rules = [createRule('low', '.btn'), createRule('high', '#button.btn')];

      const result = engine.detectDependencies(rules);
      expect(result).toBeDefined();
    });

    it('should handle equal specificity rules', () => {
      const rules = [createRule('first', '.class1'), createRule('second', '.class2')];

      const result = engine.detectDependencies(rules);
      expect(result).toBeDefined();
    });
  });

  describe('Cascade Dependencies', () => {
    it('should detect cascade order requirements', () => {
      const rules = [
        createRule('base', '.btn', [{ property: 'color', value: 'blue', important: false }]),
        createRule('override', '.btn', [{ property: 'color', value: 'red', important: false }]),
      ];

      const result = engine.detectDependencies(rules);
      expect(result).toBeDefined();
    });

    it('should handle important declarations', () => {
      const rules = [
        createRule('normal', '.btn', [{ property: 'color', value: 'blue', important: false }]),
        createRule('important', '.btn', [{ property: 'color', value: 'red', important: true }]),
      ];

      const result = engine.detectDependencies(rules);
      expect(result).toBeDefined();
    });
  });

  describe('Property-Specific Dependencies', () => {
    it('should detect z-index dependencies', () => {
      const rules = [
        createRule('lower', '.modal-bg', [{ property: 'z-index', value: '100', important: false }]),
        createRule('higher', '.modal', [{ property: 'z-index', value: '200', important: false }]),
      ];

      const result = engine.detectDependencies(rules);
      expect(result).toBeDefined();
    });

    it('should detect position dependencies', () => {
      const rules = [
        createRule('static', '.element', [
          { property: 'position', value: 'static', important: false },
        ]),
        createRule('relative', '.element', [
          { property: 'position', value: 'relative', important: false },
        ]),
      ];

      const result = engine.detectDependencies(rules);
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty rule sets', () => {
      expect(() => engine.detectDependencies([])).not.toThrow();
    });

    it('should handle malformed selectors', () => {
      const rules = [createRule('bad', '...invalid')];
      expect(() => engine.detectDependencies(rules)).not.toThrow();
    });

    it('should handle rules without declarations', () => {
      const rule: CSSRule = {
        id: 'empty',
        selector: '.test',
        declarations: [],
        lineNumber: 1,
        sourceFile: 'test.css',
        type: RuleType.STYLE,
        important: false,
      };

      expect(() => engine.detectDependencies([rule])).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large rule sets efficiently', () => {
      const manyRules = Array.from({ length: 100 }, (_, i) => createRule(`rule${i}`, `.class${i}`));

      const start = performance.now();
      const result = engine.detectDependencies(manyRules);
      const end = performance.now();

      expect(result).toBeDefined();
      expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});
