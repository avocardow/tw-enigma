/**
 * Tests for CustomPropertyOptimizer
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CustomPropertyOptimizer, createCustomPropertyOptimizer, analyzeCustomPropertyOptimizations } from '../customPropertyOptimizer.js';
import type { VariableMap, CustomPropertyDeclaration, CustomPropertyUsage } from '../customPropertyDetector.js';
import type { OptimizationOptions, OptimizationReport } from '../customPropertyOptimizer.js';

describe('CustomPropertyOptimizer', () => {
  let optimizer: CustomPropertyOptimizer;
  let mockVariableMap: VariableMap;

  beforeEach(() => {
    optimizer = new CustomPropertyOptimizer({
      aggressive: false,
      preserveNames: true,
      minSavingsThreshold: 10,
      shorthandTargets: ['margin', 'padding', 'border', 'font', 'background'],
      similarityThreshold: 0.9,
      maxScopeDepth: 3
    });

    // Create a mock variable map for testing
    mockVariableMap = {
      declarations: new Map(),
      usages: new Map(),
      undefinedVariables: [],
      unusedVariables: [],
      scopeConflicts: []
    };
  });

  describe('constructor', () => {
    it('should create optimizer with default options', () => {
      const defaultOptimizer = createCustomPropertyOptimizer();
      expect(defaultOptimizer).toBeInstanceOf(CustomPropertyOptimizer);
    });

    it('should create optimizer with custom options', () => {
      const customOptimizer = createCustomPropertyOptimizer({
        aggressive: true,
        minSavingsThreshold: 20
      });
      expect(customOptimizer).toBeInstanceOf(CustomPropertyOptimizer);
    });
  });

  describe('redundant variable detection', () => {
    it('should identify variables with identical values', () => {
      // Setup identical variable declarations
      const redDeclaration: CustomPropertyDeclaration = {
        name: 'primary-red',
        fullName: '--primary-red',
        value: '#ff0000',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const redDuplicate: CustomPropertyDeclaration = {
        name: 'danger-color',
        fullName: '--danger-color',
        value: '#ff0000',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 2,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('primary-red', [redDeclaration]);
      mockVariableMap.declarations.set('danger-color', [redDuplicate]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      expect(report.strategies.low.length).toBeGreaterThan(0);
      const mergeStrategy = report.strategies.low.find(s => s.name === 'Redundant Variable Merge');
      expect(mergeStrategy).toBeDefined();
      expect(mergeStrategy!.affectedVariables).toContain('danger-color');
    });

    it('should respect scope boundaries when merging', () => {
      const globalRed: CustomPropertyDeclaration = {
        name: 'red-color',
        fullName: '--red-color',
        value: '#ff0000',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/global.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const componentRed: CustomPropertyDeclaration = {
        name: 'red-color',
        fullName: '--red-color',
        value: '#ff0000',
        scope: { type: 'component', identifier: '.button', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/button.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('red-color', [globalRed, componentRed]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      // Should not merge variables from different scopes
      const mergeStrategy = report.strategies.low.find(s => s.name === 'Redundant Variable Merge');
      expect(mergeStrategy?.affectedVariables.includes('red-color')).toBeFalsy();
    });
  });

  describe('similar variable detection', () => {
    it('should identify similar color values', () => {
      const color1: CustomPropertyDeclaration = {
        name: 'primary-blue',
        fullName: '--primary-blue',
        value: '#007bff',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const color2: CustomPropertyDeclaration = {
        name: 'link-blue',
        fullName: '--link-blue',
        value: '#007BFF', // Same color, different case
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 2,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('primary-blue', [color1]);
      mockVariableMap.declarations.set('link-blue', [color2]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      expect(report.strategies.medium.length).toBeGreaterThan(0);
      const colorStrategy = report.strategies.medium.find(s => s.name === 'Similar Color Consolidation');
      expect(colorStrategy).toBeDefined();
    });

    it('should identify similar size values', () => {
      const size1: CustomPropertyDeclaration = {
        name: 'base-size',
        fullName: '--base-size',
        value: '16px',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const size2: CustomPropertyDeclaration = {
        name: 'font-size',
        fullName: '--font-size',
        value: '16.0px', // Similar size value
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 2,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('base-size', [size1]);
      mockVariableMap.declarations.set('font-size', [size2]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      const sizeStrategy = report.strategies.medium.find(s => s.name === 'Similar Size Consolidation');
      expect(sizeStrategy).toBeDefined();
    });
  });

  describe('unused variable removal', () => {
    it('should identify unused variables for removal', () => {
      const unusedVar: CustomPropertyDeclaration = {
        name: 'unused-color',
        fullName: '--unused-color',
        value: '#123456',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('unused-color', [unusedVar]);
      mockVariableMap.unusedVariables = ['unused-color'];

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      expect(report.strategies.low.length).toBeGreaterThan(0);
      const removalStrategy = report.strategies.low.find(s => s.name === 'Unused Variable Removal');
      expect(removalStrategy).toBeDefined();
      expect(removalStrategy!.affectedVariables).toContain('unused-color');
    });

    it('should warn about dynamic variables before removal', () => {
      const dynamicVar: CustomPropertyDeclaration = {
        name: 'dynamic-color',
        fullName: '--dynamic-color',
        value: '${theme.primary}',
        scope: { type: 'dynamic', identifier: 'js:theme.primary', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/component.js',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('dynamic-color', [dynamicVar]);
      mockVariableMap.unusedVariables = ['dynamic-color'];

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      expect(report.warnings.length).toBeGreaterThan(0);
      const dynamicWarning = report.warnings.find(w => 
        w.type === 'dynamic' && w.variables.includes('dynamic-color')
      );
      expect(dynamicWarning).toBeDefined();
    });
  });

  describe('shorthand property optimization', () => {
    it('should identify shorthand opportunities', () => {
      const spacingVar: CustomPropertyDeclaration = {
        name: 'spacing',
        fullName: '--spacing',
        value: '16px',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const marginUsage: CustomPropertyUsage = {
        name: 'spacing',
        expression: 'var(--spacing)',
        filePath: '/test/component.css',
        line: 5,
        column: 10,
        cssProperty: 'margin-top',
        selector: '.component'
      };

      const paddingUsage: CustomPropertyUsage = {
        name: 'spacing',
        expression: 'var(--spacing)',
        filePath: '/test/component.css',
        line: 6,
        column: 10,
        cssProperty: 'padding-left',
        selector: '.component'
      };

      mockVariableMap.declarations.set('spacing', [spacingVar]);
      mockVariableMap.usages.set('spacing', [marginUsage, paddingUsage]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      const shorthandStrategy = report.strategies.medium.find(s => s.name === 'Shorthand Property Optimization');
      expect(shorthandStrategy).toBeDefined();
    });
  });

  describe('scope consolidation', () => {
    it('should identify global consolidation opportunities', () => {
      const componentVar1: CustomPropertyDeclaration = {
        name: 'primary-color',
        fullName: '--primary-color',
        value: '#007bff',
        scope: { type: 'component', identifier: '.button', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/button.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const componentVar2: CustomPropertyDeclaration = {
        name: 'primary-color',
        fullName: '--primary-color',
        value: '#007bff',
        scope: { type: 'component', identifier: '.card', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/card.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const componentVar3: CustomPropertyDeclaration = {
        name: 'primary-color',
        fullName: '--primary-color',
        value: '#007bff',
        scope: { type: 'component', identifier: '.nav', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/nav.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('primary-color', [componentVar1, componentVar2, componentVar3]);
      mockVariableMap.usages.set('primary-color', [
        {
          name: 'primary-color',
          expression: 'var(--primary-color)',
          filePath: '/test/button.css',
          line: 2,
          column: 10,
          cssProperty: 'color',
          selector: '.button'
        },
        {
          name: 'primary-color',
          expression: 'var(--primary-color)',
          filePath: '/test/card.css',
          line: 2,
          column: 10,
          cssProperty: 'border-color',
          selector: '.card'
        }
      ]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      const consolidationStrategy = report.strategies.high.find(s => s.name === 'Global Scope Consolidation');
      expect(consolidationStrategy).toBeDefined();
    });
  });

  describe('unoptimizable variable identification', () => {
    it('should identify variables with circular dependencies', () => {
      const circularVar1: CustomPropertyDeclaration = {
        name: 'var-a',
        fullName: '--var-a',
        value: 'var(--var-b)',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: true,
        referencedVariables: ['var-b']
      };

      const circularVar2: CustomPropertyDeclaration = {
        name: 'var-b',
        fullName: '--var-b',
        value: 'var(--var-a)',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 2,
        column: 0,
        containsVariables: true,
        referencedVariables: ['var-a']
      };

      mockVariableMap.declarations.set('var-a', [circularVar1]);
      mockVariableMap.declarations.set('var-b', [circularVar2]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      expect(report.unoptimizable.length).toBeGreaterThan(0);
      const circularVars = report.unoptimizable.filter(u => u.reason.includes('Circular dependency'));
      expect(circularVars.length).toBeGreaterThan(0);
    });

    it('should identify variables used in complex expressions', () => {
      const complexUsage: CustomPropertyUsage = {
        name: 'base-size',
        expression: 'calc(var(--base-size) * 1.5 + 2px)',
        filePath: '/test/styles.css',
        line: 5,
        column: 10,
        cssProperty: 'font-size',
        selector: '.large-text'
      };

      const baseVar: CustomPropertyDeclaration = {
        name: 'base-size',
        fullName: '--base-size',
        value: '16px',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('base-size', [baseVar]);
      mockVariableMap.usages.set('base-size', [complexUsage]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      expect(report.unoptimizable.length).toBeGreaterThan(0);
      const complexVars = report.unoptimizable.filter(u => 
        u.reason.includes('complex calc()') && u.variable === 'base-size'
      );
      expect(complexVars.length).toBeGreaterThan(0);
    });
  });

  describe('optimization report generation', () => {
    it('should generate comprehensive optimization report', () => {
      // Setup a complex scenario
      const redVar1: CustomPropertyDeclaration = {
        name: 'primary-red',
        fullName: '--primary-red',
        value: '#ff0000',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const redVar2: CustomPropertyDeclaration = {
        name: 'danger-red',
        fullName: '--danger-red',
        value: '#ff0000',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 2,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      const unusedVar: CustomPropertyDeclaration = {
        name: 'unused-color',
        fullName: '--unused-color',
        value: '#123456',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 3,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('primary-red', [redVar1]);
      mockVariableMap.declarations.set('danger-red', [redVar2]);
      mockVariableMap.declarations.set('unused-color', [unusedVar]);
      mockVariableMap.unusedVariables = ['unused-color'];

      // Add some usages
      mockVariableMap.usages.set('primary-red', [{
        name: 'primary-red',
        expression: 'var(--primary-red)',
        filePath: '/test/component.css',
        line: 1,
        column: 10,
        cssProperty: 'color',
        selector: '.primary'
      }]);

      const report = optimizer.analyzeOptimizations(mockVariableMap);

      expect(report).toBeDefined();
      expect(report.totalSavings).toBeGreaterThan(0);
      expect(report.opportunityCount).toBeGreaterThan(0);
      expect(typeof report.strategies.low).toBe('object');
      expect(typeof report.strategies.medium).toBe('object');
      expect(typeof report.strategies.high).toBe('object');
    });

    it('should respect minimum savings threshold', () => {
      const lowSavingsOptimizer = createCustomPropertyOptimizer({
        minSavingsThreshold: 1000 // Very high threshold
      });

      const smallVar: CustomPropertyDeclaration = {
        name: 'small',
        fullName: '--small',
        value: '#f00',
        scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/styles.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('small', [smallVar]);
      mockVariableMap.unusedVariables = ['small'];

      const report = lowSavingsOptimizer.analyzeOptimizations(mockVariableMap);

      // Should have no strategies due to high threshold
      expect(report.opportunityCount).toBe(0);
    });
  });

  describe('utility functions', () => {
    it('should work with analyzeCustomPropertyOptimizations utility', () => {
      const report = analyzeCustomPropertyOptimizations(mockVariableMap, {
        aggressive: true
      });

      expect(report).toBeDefined();
      expect(typeof report.totalSavings).toBe('number');
      expect(typeof report.opportunityCount).toBe('number');
    });
  });

  describe('optimization options', () => {
    it('should respect aggressive mode', () => {
      const aggressiveOptimizer = createCustomPropertyOptimizer({
        aggressive: true,
        minSavingsThreshold: 1
      });

      expect(aggressiveOptimizer).toBeDefined();
      // Aggressive mode would enable more risky optimizations
    });

    it('should respect preserve names option', () => {
      const preserveNamesOptimizer = createCustomPropertyOptimizer({
        preserveNames: true
      });

      expect(preserveNamesOptimizer).toBeDefined();
      // When preserveNames is true, variable renaming should be avoided
    });

    it('should respect similarity threshold', () => {
      const strictSimilarityOptimizer = createCustomPropertyOptimizer({
        similarityThreshold: 0.99 // Very strict similarity
      });

      expect(strictSimilarityOptimizer).toBeDefined();
      // With high similarity threshold, fewer variables would be considered similar
    });
  });
});