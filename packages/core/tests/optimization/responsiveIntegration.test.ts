import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BreakpointCompatibilityEngine } from '../../src/optimization/breakpointCompatibility';
import { ComplexPatternHandler } from '../../src/optimization/complexPatternHandler';
import { PatternGroupingEngine } from '../../src/optimization/patternGrouping';
import { PatternMergingEngine } from '../../src/optimization/patternMerging';

describe('Responsive and Pseudo-Class Optimization Integration', () => {
  let patternMergingEngine: PatternMergingEngine;
  let breakpointEngine: BreakpointCompatibilityEngine;
  let complexPatternHandler: ComplexPatternHandler;
  let groupingEngine: PatternGroupingEngine;

  beforeEach(() => {
    // Initialize all engines with compatible configurations
    patternMergingEngine = new PatternMergingEngine({
      strategy: 'mobile-first',
      enableCaching: true,
      enableOptimizations: true,
      preserveSpecificity: true,
      respectCascadeOrder: true,
    });

    breakpointEngine = new BreakpointCompatibilityEngine({
      strategy: 'mobile-first',
      enableCaching: true,
      strictOrdering: true,
      allowCustomBreakpoints: true,
    });

    complexPatternHandler = new ComplexPatternHandler({
      parsing: { enableAdvancedParsing: true },
      validation: { enforceSpecificityRules: true },
      optimization: { enableAutomaticOptimization: true },
      performance: { enableCaching: true },
      errorHandling: { strictMode: false },
    });

    groupingEngine = new PatternGroupingEngine({
      enableGrouping: true,
      enableCaching: true,
      strictMode: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Optimization Pipeline', () => {
    it('should optimize a complete responsive component', async () => {
      const componentClasses = [
        // Base button styles
        'inline-flex',
        'items-center',
        'justify-center',
        'px-4',
        'py-2',
        'text-sm',
        'font-medium',
        'border',
        'border-transparent',
        'rounded-md',
        'text-white',
        'bg-blue-600',

        // Hover states
        'hover:bg-blue-700',
        'hover:border-blue-700',

        // Focus states
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-offset-2',
        'focus:ring-blue-500',

        // Active states
        'active:bg-blue-800',

        // Disabled states
        'disabled:opacity-50',
        'disabled:cursor-not-allowed',

        // Responsive variations
        'sm:px-6',
        'sm:py-3',
        'sm:text-base',
        'md:px-8',
        'md:py-4',
        'md:text-lg',
        'lg:px-10',
        'lg:py-5',
        'lg:text-xl',

        // Responsive hover states
        'sm:hover:bg-blue-800',
        'md:hover:shadow-lg',
        'lg:hover:scale-105',

        // Complex responsive pseudo combinations
        'sm:focus:ring-4',
        'md:focus:ring-blue-600',
        'lg:active:scale-95',
      ];

      // Step 1: Parse and analyze complex patterns
      const analysisResult = complexPatternHandler.analyzeComplexCombinations(componentClasses);
      expect(analysisResult.totalPatterns).toBe(componentClasses.length);
      expect(analysisResult.complexityDistribution.high).toBeGreaterThan(0);

      // Step 2: Validate breakpoint compatibility
      const breakpointValidation = breakpointEngine.validateBreakpointOrder(componentClasses);
      expect(breakpointValidation.isValid).toBe(true);

      // Step 3: Group related patterns
      const groupingResult = await groupingEngine.groupPatterns(componentClasses);
      expect(groupingResult.groups.length).toBeGreaterThan(1);
      expect(groupingResult.totalGroups).toBeGreaterThan(1);

      // Step 4: Merge patterns for optimization
      const patterns = componentClasses.map((cls) => ({
        selector: `.${cls}`,
        properties: {
          /* mock properties */
        },
        className: cls,
      }));

      const mergingResult = await patternMergingEngine.mergePatterns(patterns);
      expect(mergingResult.mergedPatterns).toBeDefined();
      expect(mergingResult.optimizationApplied).toBe(true);

      // Verify the complete pipeline worked
      expect(analysisResult.optimizationOpportunities.length).toBeGreaterThan(0);
      expect(groupingResult.optimizationApplied).toBe(true);
      expect(mergingResult.reductionPercentage).toBeGreaterThanOrEqual(0);
    });

    it('should handle form component optimization', async () => {
      const formClasses = [
        // Base input styles
        'block',
        'w-full',
        'px-3',
        'py-2',
        'border',
        'border-gray-300',
        'rounded-md',
        'shadow-sm',
        'text-gray-900',
        'placeholder-gray-500',

        // Focus states
        'focus:ring-blue-500',
        'focus:border-blue-500',
        'focus:outline-none',
        'focus:ring-1',

        // Invalid states
        'invalid:border-red-500',
        'invalid:ring-red-500',

        // Disabled states
        'disabled:bg-gray-50',
        'disabled:text-gray-500',
        'disabled:border-gray-200',
        'disabled:cursor-not-allowed',

        // Responsive sizing
        'sm:text-sm',
        'sm:px-4',
        'sm:py-3',
        'md:text-base',
        'md:px-5',
        'md:py-4',

        // Responsive focus improvements
        'sm:focus:ring-2',
        'md:focus:ring-2',
        'md:focus:ring-offset-1',

        // Label styles
        'text-sm',
        'font-medium',
        'text-gray-700',
        'sm:text-base',
        'md:text-lg',
      ];

      // Run full optimization pipeline
      const complexAnalysis = complexPatternHandler.analyzeComplexCombinations(formClasses);
      const optimizationResult = complexPatternHandler.optimizeComplexPatterns(formClasses);

      expect(complexAnalysis.conflicts.length).toBeGreaterThanOrEqual(0);
      expect(optimizationResult.optimizedCount).toBeLessThanOrEqual(formClasses.length);
      expect(optimizationResult.reductionPercentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-System Integration', () => {
    it('should coordinate between pattern grouping and merging', async () => {
      const classes = [
        'text-blue-500',
        'text-red-500',
        'text-green-500',
        'bg-blue-500',
        'bg-red-500',
        'bg-green-500',
        'border-blue-500',
        'border-red-500',
        'border-green-500',
        'md:text-blue-600',
        'md:text-red-600',
        'md:text-green-600',
      ];

      // Group patterns first
      const groupingResult = await groupingEngine.groupPatterns(classes);

      // Then merge within groups
      const mergedResults = [];
      for (const group of groupingResult.groups) {
        const patterns = group.patterns.map((cls) => ({
          selector: `.${cls}`,
          properties: {},
          className: cls,
        }));

        const mergeResult = await patternMergingEngine.mergePatterns(patterns);
        mergedResults.push(mergeResult);
      }

      expect(groupingResult.groups.length).toBeGreaterThan(0);
      expect(mergedResults.length).toBe(groupingResult.groups.length);
      expect(mergedResults.every((result) => result.mergedPatterns.length > 0)).toBe(true);
    });

    it('should integrate breakpoint validation with complex pattern analysis', () => {
      const classes = [
        'lg:text-blue-500',
        'sm:text-red-500', // Out of order
        'md:text-green-500',
        'xl:hover:text-purple-500',
        'sm:focus:active:text-yellow-500',
      ];

      // Analyze complexity
      const complexAnalysis = complexPatternHandler.analyzeComplexCombinations(classes);

      // Validate breakpoint order
      const breakpointValidation = breakpointEngine.validateBreakpointOrder(classes);

      // Both systems should detect issues
      expect(complexAnalysis.conflicts.length).toBeGreaterThan(0);
      expect(breakpointValidation.isValid).toBe(false);
      expect(breakpointValidation.violations.length).toBeGreaterThan(0);

      // Suggested order should be provided
      expect(breakpointValidation.suggestedOrder).toBeDefined();
      expect(breakpointValidation.suggestedOrder.length).toBe(
        classes.filter(
          (cls) => cls.includes(':') && !cls.startsWith('hover:') && !cls.startsWith('focus:')
        ).length
      );
    });

    it('should handle cache coordination across systems', async () => {
      const classes = [
        'md:hover:text-blue-500',
        'lg:focus:bg-red-500',
        'sm:active:border-green-500',
      ];

      // First pass - populate caches
      complexPatternHandler.analyzeComplexCombinations(classes);
      breakpointEngine.generateMediaQueries(classes);
      await groupingEngine.groupPatterns(classes);

      // Get initial cache stats
      const initialComplexCacheStats = complexPatternHandler.getCacheStats();
      const initialBreakpointCacheStats = breakpointEngine.getCacheStats();
      const initialGroupingCacheStats = groupingEngine.getCacheStats();

      // Second pass - should use caches
      complexPatternHandler.analyzeComplexCombinations(classes);
      breakpointEngine.generateMediaQueries(classes);
      await groupingEngine.groupPatterns(classes);

      // Verify cache usage increased
      const finalComplexCacheStats = complexPatternHandler.getCacheStats();
      const finalBreakpointCacheStats = breakpointEngine.getCacheStats();
      const finalGroupingCacheStats = groupingEngine.getCacheStats();

      expect(finalComplexCacheStats.hits).toBeGreaterThan(initialComplexCacheStats.hits);
      expect(finalBreakpointCacheStats.hits).toBeGreaterThan(initialBreakpointCacheStats.hits);
      expect(finalGroupingCacheStats.hits).toBeGreaterThan(initialGroupingCacheStats.hits);
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance across integrated systems', async () => {
      const largeClassSet = [];

      // Generate a large set of realistic responsive classes
      const breakpoints = ['sm', 'md', 'lg', 'xl', '2xl'];
      const pseudoClasses = ['hover', 'focus', 'active', 'disabled'];
      const properties = ['text', 'bg', 'border', 'p', 'm', 'w', 'h'];
      const values = ['blue-500', 'red-500', 'green-500', 'gray-500', 'purple-500'];

      for (let i = 0; i < 500; i++) {
        const bp = breakpoints[i % breakpoints.length];
        const pseudo = pseudoClasses[i % pseudoClasses.length];
        const prop = properties[i % properties.length];
        const value = values[i % values.length];

        largeClassSet.push(`${bp}:${pseudo}:${prop}-${value}`);
      }

      const startTime = performance.now();

      // Run all systems
      const complexAnalysis = complexPatternHandler.analyzeComplexCombinations(largeClassSet);
      const breakpointValidation = breakpointEngine.validateBreakpointOrder(largeClassSet);
      const groupingResult = await groupingEngine.groupPatterns(largeClassSet);

      const patterns = largeClassSet.map((cls) => ({
        selector: `.${cls}`,
        properties: {},
        className: cls,
      }));
      const mergingResult = await patternMergingEngine.mergePatterns(patterns);

      const endTime = performance.now();

      // Should complete within reasonable time (5 seconds for 500 complex patterns)
      expect(endTime - startTime).toBeLessThan(5000);

      // All systems should produce results
      expect(complexAnalysis.totalPatterns).toBe(500);
      expect(breakpointValidation.violations).toBeDefined();
      expect(groupingResult.groups.length).toBeGreaterThan(0);
      expect(mergingResult.mergedPatterns.length).toBeGreaterThan(0);
    });

    it('should handle memory efficiently across systems', async () => {
      const memoryTestClasses = Array.from(
        { length: 1000 },
        (_, i) => `sm:md:lg:hover:focus:active:text-color-${i}`
      );

      // Monitor memory usage (simplified)
      const initialMemory = process.memoryUsage();

      // Process through all systems
      const complexResult = complexPatternHandler.analyzeComplexCombinations(memoryTestClasses);
      breakpointEngine.generateMediaQueries(memoryTestClasses);
      await groupingEngine.groupPatterns(memoryTestClasses);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      expect(complexResult.totalPatterns).toBe(1000);
    });
  });

  describe('Error Handling Integration', () => {
    it('should gracefully handle errors across all systems', async () => {
      const problematicClasses = [
        'valid-class',
        null,
        undefined,
        '',
        'invalid::syntax',
        'unknown-bp:text-blue-500',
        'sm:lg:text-red-500', // Invalid order
        'hover::focus:text-green-500', // Malformed
      ] as any[];

      // All systems should handle errors gracefully
      const complexAnalysis = complexPatternHandler.validateComplexPatterns(problematicClasses);
      const breakpointValidation = breakpointEngine.validateBreakpointOrder(problematicClasses);
      const groupingResult = await groupingEngine.groupPatterns(problematicClasses.filter(Boolean));

      // Should recover and process valid patterns
      expect(complexAnalysis.validPatterns.length).toBeGreaterThan(0);
      expect(complexAnalysis.errors.length).toBeGreaterThan(0);
      expect(breakpointValidation.warnings.length).toBeGreaterThan(0);
      expect(groupingResult.errors.length).toBeGreaterThan(0);

      // Valid patterns should still be processed
      expect(groupingResult.groups.length).toBeGreaterThan(0);
    });

    it('should coordinate error recovery across systems', async () => {
      const classesWithErrors = [
        'text-blue-500', // Valid
        'md:text-red-500', // Valid
        'invalid-bp:text-green-500', // Invalid breakpoint
        'lg:invalid::syntax', // Malformed syntax
        'xl:text-purple-500', // Valid
      ];

      // First system identifies and recovers errors
      const complexValidation = complexPatternHandler.validateComplexPatterns(classesWithErrors);
      const validClasses = complexValidation.validPatterns.concat(
        complexValidation.recoveredPatterns
      );

      // Subsequent systems work with cleaned data
      const breakpointResult = breakpointEngine.generateMediaQueries(validClasses);
      const groupingResult = await groupingEngine.groupPatterns(validClasses);

      expect(validClasses.length).toBeGreaterThan(2);
      expect(breakpointResult.mediaQueries).toBeDefined();
      expect(groupingResult.groups.length).toBeGreaterThan(0);
      expect(groupingResult.errors.length).toBe(0); // No errors in cleaned data
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should optimize a complete design system component library', async () => {
      const designSystemClasses = [
        // Button variants
        'btn-primary',
        'btn-secondary',
        'btn-danger',
        'btn-success',
        'btn-sm',
        'btn-md',
        'btn-lg',
        'btn-xl',
        'btn-outline',
        'btn-ghost',
        'btn-link',

        // Responsive button variations
        'sm:btn-md',
        'md:btn-lg',
        'lg:btn-xl',
        'sm:btn-outline',
        'md:btn-ghost',

        // Interactive states
        'hover:btn-primary-dark',
        'focus:btn-primary-focus',
        'active:btn-primary-active',
        'disabled:btn-disabled',

        // Card components
        'card',
        'card-header',
        'card-body',
        'card-footer',
        'card-elevated',
        'card-outlined',
        'card-flat',

        // Responsive cards
        'sm:card-elevated',
        'md:card-horizontal',
        'lg:card-large',

        // Form components
        'input',
        'input-sm',
        'input-lg',
        'input-error',
        'input-success',
        'label',
        'label-required',
        'help-text',
        'error-text',

        // Responsive forms
        'sm:input-lg',
        'md:form-horizontal',
        'lg:form-inline',

        // Layout utilities
        'container',
        'grid',
        'flex',
        'space-y-4',
        'gap-6',
        'sm:container-sm',
        'md:container-md',
        'lg:container-lg',
        'sm:grid-cols-2',
        'md:grid-cols-3',
        'lg:grid-cols-4',
      ];

      // Full optimization pipeline
      const startTime = performance.now();

      const analysisResult = complexPatternHandler.analyzeComplexCombinations(designSystemClasses);
      const optimizationResult = complexPatternHandler.optimizeComplexPatterns(designSystemClasses);
      const groupingResult = await groupingEngine.groupPatterns(designSystemClasses);
      const breakpointResult = breakpointEngine.generateMediaQueries(designSystemClasses);

      const endTime = performance.now();

      // Verify comprehensive optimization
      expect(analysisResult.totalPatterns).toBe(designSystemClasses.length);
      expect(optimizationResult.reductionPercentage).toBeGreaterThanOrEqual(0);
      expect(groupingResult.groups.length).toBeGreaterThan(5); // Multiple component groups
      expect(breakpointResult.mediaQueries).toBeDefined();

      // Should complete efficiently
      expect(endTime - startTime).toBeLessThan(3000);

      // Should identify significant optimization opportunities
      expect(analysisResult.optimizationOpportunities.length).toBeGreaterThan(3);
      expect(optimizationResult.optimizationsApplied.length).toBeGreaterThan(0);
    });

    it('should handle enterprise-scale CSS optimization', async () => {
      // Simulate enterprise-scale CSS with thousands of utility classes
      const enterpriseClasses = [];

      const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
      const pseudoStates = ['hover', 'focus', 'active', 'visited', 'disabled', 'first', 'last'];
      const utilityTypes = ['text', 'bg', 'border', 'p', 'm', 'w', 'h', 'flex', 'grid', 'space'];

      // Generate realistic enterprise utility combinations
      for (let i = 0; i < 2000; i++) {
        const bp = breakpoints[i % breakpoints.length];
        const pseudo = pseudoStates[i % pseudoStates.length];
        const utility = utilityTypes[i % utilityTypes.length];
        const variant = Math.floor(i / 100) % 10;

        if (i % 3 === 0) {
          enterpriseClasses.push(`${bp}:${utility}-${variant}`);
        } else if (i % 3 === 1) {
          enterpriseClasses.push(`${pseudo}:${utility}-${variant}`);
        } else {
          enterpriseClasses.push(`${bp}:${pseudo}:${utility}-${variant}`);
        }
      }

      const startTime = performance.now();

      // Run optimization with parallel processing where possible
      const results = await Promise.all([
        complexPatternHandler.analyzeComplexCombinations(enterpriseClasses),
        breakpointEngine.generateMediaQueries(enterpriseClasses),
        groupingEngine.groupPatterns(enterpriseClasses),
      ]);

      const [complexResult, breakpointResult, groupingResult] = results;
      const endTime = performance.now();

      // Verify enterprise-scale performance
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
      expect(complexResult.totalPatterns).toBe(2000);
      expect(breakpointResult.mediaQueries).toBeDefined();
      expect(groupingResult.groups.length).toBeGreaterThan(10);

      // Should achieve meaningful optimization at scale
      expect(complexResult.optimizationOpportunities.length).toBeGreaterThan(10);
      expect(groupingResult.reductionPercentage).toBeGreaterThan(5);
    });
  });
});
