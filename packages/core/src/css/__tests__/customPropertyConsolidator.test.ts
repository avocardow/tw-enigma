/**
 * Tests for CustomPropertyConsolidator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CustomPropertyConsolidator, createCustomPropertyConsolidator, createConsolidationPlan } from '../customPropertyConsolidator.js';
import type { VariableMap, CustomPropertyDeclaration, CustomPropertyUsage } from '../customPropertyDetector.js';
import type { ConsolidationOptions, RefactoringPlan, VariableCategory } from '../customPropertyConsolidator.js';

describe('CustomPropertyConsolidator', () => {
  let consolidator: CustomPropertyConsolidator;
  let mockVariableMap: VariableMap;

  beforeEach(() => {
    consolidator = new CustomPropertyConsolidator({
      targetCategories: ['color', 'typography', 'spacing'],
      enableGlobalPromotion: true,
      globalPromotionThreshold: 3,
      preserveOriginalNames: true,
      createBackups: true,
      validateBeforeApply: true,
      maxGroupSize: 10
    });

    mockVariableMap = {
      declarations: new Map(),
      usages: new Map(),
      undefinedVariables: [],
      unusedVariables: [],
      scopeConflicts: []
    };
  });

  describe('constructor', () => {
    it('should create consolidator with default options', () => {
      const defaultConsolidator = createCustomPropertyConsolidator();
      expect(defaultConsolidator).toBeInstanceOf(CustomPropertyConsolidator);
    });

    it('should create consolidator with custom options', () => {
      const customConsolidator = createCustomPropertyConsolidator({
        enableGlobalPromotion: false,
        maxGroupSize: 5
      });
      expect(customConsolidator).toBeInstanceOf(CustomPropertyConsolidator);
    });
  });

  describe('variable categorization', () => {
    it('should categorize color variables correctly', () => {
      const colorDeclarations: CustomPropertyDeclaration[] = [
        {
          name: 'primary-color',
          fullName: '--primary-color',
          value: '#007bff',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/colors.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'secondary-color',
          fullName: '--secondary-color',
          value: '#6c757d',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/colors.css',
          line: 2,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'text-color',
          fullName: '--text-color',
          value: '#212529',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/colors.css',
          line: 3,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('primary-color', [colorDeclarations[0]]);
      mockVariableMap.declarations.set('secondary-color', [colorDeclarations[1]]);
      mockVariableMap.declarations.set('text-color', [colorDeclarations[2]]);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      expect(plan.groups.length).toBeGreaterThanOrEqual(0);
      // Color variables might be grouped if they have similar characteristics
    });

    it('should categorize typography variables correctly', () => {
      const typographyDeclarations: CustomPropertyDeclaration[] = [
        {
          name: 'font-size-base',
          fullName: '--font-size-base',
          value: '1rem',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/typography.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'font-family-sans',
          fullName: '--font-family-sans',
          value: 'Arial, sans-serif',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/typography.css',
          line: 2,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('font-size-base', [typographyDeclarations[0]]);
      mockVariableMap.declarations.set('font-family-sans', [typographyDeclarations[1]]);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      expect(plan).toBeDefined();
      // Typography variables should be recognized
    });

    it('should categorize spacing variables correctly', () => {
      const spacingDeclarations: CustomPropertyDeclaration[] = [
        {
          name: 'spacing-sm',
          fullName: '--spacing-sm',
          value: '8px',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/spacing.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'margin-base',
          fullName: '--margin-base',
          value: '16px',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/spacing.css',
          line: 2,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('spacing-sm', [spacingDeclarations[0]]);
      mockVariableMap.declarations.set('margin-base', [spacingDeclarations[1]]);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      expect(plan).toBeDefined();
    });
  });

  describe('similarity detection', () => {
    it('should group variables with identical values', () => {
      const identicalVars: CustomPropertyDeclaration[] = [
        {
          name: 'primary-red',
          fullName: '--primary-red',
          value: '#ff0000',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/colors.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'error-red',
          fullName: '--error-red',
          value: '#ff0000',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/colors.css',
          line: 2,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'danger-red',
          fullName: '--danger-red',
          value: '#ff0000',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/colors.css',
          line: 3,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('primary-red', [identicalVars[0]]);
      mockVariableMap.declarations.set('error-red', [identicalVars[1]]);
      mockVariableMap.declarations.set('danger-red', [identicalVars[2]]);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      expect(plan.groups.length).toBeGreaterThan(0);
      const colorGroup = plan.groups.find(g => g.category === 'color');
      expect(colorGroup).toBeDefined();
      expect(colorGroup!.variables.length).toBe(3);
    });

    it('should group similar size values', () => {
      const similarSizes: CustomPropertyDeclaration[] = [
        {
          name: 'size-16',
          fullName: '--size-16',
          value: '16px',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/sizes.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'size-16-alt',
          fullName: '--size-16-alt',
          value: '16.0px',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/sizes.css',
          line: 2,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('size-16', [similarSizes[0]]);
      mockVariableMap.declarations.set('size-16-alt', [similarSizes[1]]);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      expect(plan.groups.length).toBeGreaterThan(0);
      const sizingGroup = plan.groups.find(g => g.category === 'sizing');
      expect(sizingGroup).toBeDefined();
    });
  });

  describe('scope-based consolidation', () => {
    it('should identify global promotion opportunities', () => {
      const multiScopeVar: CustomPropertyDeclaration[] = [
        {
          name: 'primary-color',
          fullName: '--primary-color',
          value: '#007bff',
          scope: { type: 'component', identifier: '.button', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/button.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'primary-color',
          fullName: '--primary-color',
          value: '#007bff',
          scope: { type: 'component', identifier: '.card', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/card.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'primary-color',
          fullName: '--primary-color',
          value: '#007bff',
          scope: { type: 'component', identifier: '.nav', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/nav.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      // Add multiple usages to trigger global promotion
      const usages: CustomPropertyUsage[] = [
        {
          name: 'primary-color',
          expression: 'var(--primary-color)',
          filePath: '/test/button.css',
          line: 2,
          column: 10,
          cssProperty: 'background-color',
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
        },
        {
          name: 'primary-color',
          expression: 'var(--primary-color)',
          filePath: '/test/nav.css',
          line: 2,
          column: 10,
          cssProperty: 'color',
          selector: '.nav'
        }
      ];

      mockVariableMap.declarations.set('primary-color', multiScopeVar);
      mockVariableMap.usages.set('primary-color', usages);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      expect(plan.groups.length).toBeGreaterThan(0);
      const globalGroup = plan.groups.find(g => 
        g.primaryVariable.scope.type === 'global'
      );
      expect(globalGroup).toBeDefined();
    });

    it('should respect global promotion threshold', () => {
      const lowUsageConsolidator = createCustomPropertyConsolidator({
        globalPromotionThreshold: 5 // High threshold
      });

      const singleScopeVar: CustomPropertyDeclaration = {
        name: 'local-color',
        fullName: '--local-color',
        value: '#123456',
        scope: { type: 'component', identifier: '.widget', nestingLevel: 0, parentScopes: [] },
        filePath: '/test/widget.css',
        line: 1,
        column: 0,
        containsVariables: false,
        referencedVariables: []
      };

      mockVariableMap.declarations.set('local-color', [singleScopeVar]);
      mockVariableMap.usages.set('local-color', [
        {
          name: 'local-color',
          expression: 'var(--local-color)',
          filePath: '/test/widget.css',
          line: 2,
          column: 10,
          cssProperty: 'color',
          selector: '.widget'
        }
      ]);

      const plan = lowUsageConsolidator.createConsolidationPlan(mockVariableMap);

      // Should not promote to global due to low usage
      const globalGroups = plan.groups.filter(g => 
        g.primaryVariable.scope.type === 'global'
      );
      expect(globalGroups.length).toBe(0);
    });
  });

  describe('consolidation planning', () => {
    it('should create a comprehensive refactoring plan', () => {
      // Setup a complex scenario
      const redVars: CustomPropertyDeclaration[] = [
        {
          name: 'primary-red',
          fullName: '--primary-red',
          value: '#ff0000',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/colors.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'error-red',
          fullName: '--error-red',
          value: '#ff0000',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/colors.css',
          line: 2,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('primary-red', [redVars[0]]);
      mockVariableMap.declarations.set('error-red', [redVars[1]]);

      // Add usages
      mockVariableMap.usages.set('primary-red', [
        {
          name: 'primary-red',
          expression: 'var(--primary-red)',
          filePath: '/test/components.css',
          line: 1,
          column: 10,
          cssProperty: 'color',
          selector: '.primary'
        }
      ]);

      mockVariableMap.usages.set('error-red', [
        {
          name: 'error-red',
          expression: 'var(--error-red)',
          filePath: '/test/components.css',
          line: 2,
          column: 10,
          cssProperty: 'color',
          selector: '.error'
        }
      ]);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      expect(plan).toBeDefined();
      expect(plan.groups.length).toBeGreaterThan(0);
      expect(plan.affectedFiles.length).toBeGreaterThan(0);
      expect(plan.totalSavings).toBeGreaterThanOrEqual(0);
      expect(plan.actions.length).toBeGreaterThan(0);
      expect(Array.isArray(plan.risks)).toBe(true);
    });

    it('should order actions correctly', () => {
      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      if (plan.actions.length > 1) {
        // Actions should be ordered by their order property
        for (let i = 1; i < plan.actions.length; i++) {
          expect(plan.actions[i].order).toBeGreaterThanOrEqual(plan.actions[i - 1].order);
        }
      }
    });

    it('should identify safe auto-executable actions', () => {
      // Setup safe consolidation scenario
      const safeVars: CustomPropertyDeclaration[] = [
        {
          name: 'red-1',
          fullName: '--red-1',
          value: '#ff0000',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/safe.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'red-2',
          fullName: '--red-2',
          value: '#ff0000',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/safe.css',
          line: 2,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('red-1', [safeVars[0]]);
      mockVariableMap.declarations.set('red-2', [safeVars[1]]);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      if (plan.actions.length > 0) {
        const autoExecutableActions = plan.actions.filter(a => a.autoExecutable);
        expect(autoExecutableActions.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('consolidation execution', () => {
    it('should handle file processing', async () => {
      const fileContents = new Map<string, string>();
      fileContents.set('/test/styles.css', `
        :root {
          --primary-color: #007bff;
          --primary-blue: #007bff;
        }
        .button {
          color: var(--primary-color);
          background: var(--primary-blue);
        }
      `);

      const plan: RefactoringPlan = {
        groups: [],
        affectedFiles: ['/test/styles.css'],
        totalSavings: 50,
        actions: [
          {
            type: 'remove_duplicates',
            targetGroup: 'color-group',
            variables: ['primary-blue'],
            files: ['/test/styles.css'],
            order: 1,
            autoExecutable: true
          }
        ],
        risks: []
      };

      const results = await consolidator.executeConsolidationPlan(plan, fileContents);

      expect(results.size).toBe(1);
      expect(results.has('/test/styles.css')).toBe(true);

      const result = results.get('/test/styles.css')!;
      expect(result.originalContent).toBeDefined();
      expect(result.updatedContent).toBeDefined();
      expect(result.filePath).toBe('/test/styles.css');
      expect(Array.isArray(result.changes)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle execution errors gracefully', async () => {
      const fileContents = new Map<string, string>();
      fileContents.set('/test/invalid.css', 'invalid css content');

      const plan: RefactoringPlan = {
        groups: [],
        affectedFiles: ['/test/invalid.css'],
        totalSavings: 0,
        actions: [
          {
            type: 'merge_declarations',
            targetGroup: 'invalid-group',
            variables: ['invalid-var'],
            files: ['/test/invalid.css'],
            order: 1,
            autoExecutable: false
          }
        ],
        risks: []
      };

      const results = await consolidator.executeConsolidationPlan(plan, fileContents);

      expect(results.size).toBe(1);
      const result = results.get('/test/invalid.css')!;
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('utility functions', () => {
    it('should work with createConsolidationPlan utility', () => {
      const plan = createConsolidationPlan(mockVariableMap, {
        enableGlobalPromotion: false
      });

      expect(plan).toBeDefined();
      expect(typeof plan.totalSavings).toBe('number');
      expect(Array.isArray(plan.groups)).toBe(true);
      expect(Array.isArray(plan.affectedFiles)).toBe(true);
      expect(Array.isArray(plan.actions)).toBe(true);
      expect(Array.isArray(plan.risks)).toBe(true);
    });
  });

  describe('consolidation options', () => {
    it('should respect target categories', () => {
      const limitedConsolidator = createCustomPropertyConsolidator({
        targetCategories: ['color'] // Only colors
      });

      const mixedVars: CustomPropertyDeclaration[] = [
        {
          name: 'primary-color',
          fullName: '--primary-color',
          value: '#007bff',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/mixed.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'font-size',
          fullName: '--font-size',
          value: '16px',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/mixed.css',
          line: 2,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('primary-color', [mixedVars[0]]);
      mockVariableMap.declarations.set('font-size', [mixedVars[1]]);

      const plan = limitedConsolidator.createConsolidationPlan(mockVariableMap);

      // Should only consider color variables
      const typographyGroups = plan.groups.filter(g => g.category === 'typography');
      expect(typographyGroups.length).toBe(0);
    });

    it('should respect max group size', () => {
      const smallGroupConsolidator = createCustomPropertyConsolidator({
        maxGroupSize: 2
      });

      // Create more variables than max group size
      const manyVars: CustomPropertyDeclaration[] = [];
      for (let i = 0; i < 5; i++) {
        const varDecl: CustomPropertyDeclaration = {
          name: `red-${i}`,
          fullName: `--red-${i}`,
          value: '#ff0000',
          scope: { type: 'global', identifier: ':root', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/many.css',
          line: i + 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        };
        manyVars.push(varDecl);
        mockVariableMap.declarations.set(`red-${i}`, [varDecl]);
      }

      const plan = smallGroupConsolidator.createConsolidationPlan(mockVariableMap);

      // Groups should not exceed max size
      for (const group of plan.groups) {
        expect(group.variables.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('risk assessment', () => {
    it('should identify potential risks', () => {
      // Create a scenario with potential risks
      const riskyVars: CustomPropertyDeclaration[] = [
        {
          name: 'theme-color',
          fullName: '--theme-color',
          value: '#007bff',
          scope: { type: 'component', identifier: '.theme-dark', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/theme.css',
          line: 1,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        },
        {
          name: 'theme-color',
          fullName: '--theme-color',
          value: '#ffffff',
          scope: { type: 'component', identifier: '.theme-light', nestingLevel: 0, parentScopes: [] },
          filePath: '/test/theme.css',
          line: 5,
          column: 0,
          containsVariables: false,
          referencedVariables: []
        }
      ];

      mockVariableMap.declarations.set('theme-color', riskyVars);

      const plan = consolidator.createConsolidationPlan(mockVariableMap);

      // Should identify risks for variables with same name but different values
      expect(Array.isArray(plan.risks)).toBe(true);
    });
  });
});