import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComplexPatternConfig } from '../../src/optimization/complexPatternHandler';
import { ComplexPatternHandler } from '../../src/optimization/complexPatternHandler';

describe('ComplexPatternHandler', () => {
  let handler: ComplexPatternHandler;
  let defaultConfig: ComplexPatternConfig;

  beforeEach(() => {
    defaultConfig = {
      parsing: {
        enableAdvancedParsing: true,
        maxComplexityScore: 100,
        enableArbitraryValueParsing: true,
        enableNestedPseudoParsing: true,
        parseCustomBreakpoints: true,
        validateSyntax: true,
      },
      validation: {
        enforceSpecificityRules: true,
        validateCascadeOrder: true,
        checkConflicts: true,
        validateBreakpointOrder: true,
        enforcePseudoClassOrder: true,
        validateArbitraryValues: true,
      },
      optimization: {
        enableAutomaticOptimization: true,
        optimizationLevel: 'aggressive',
        enableConflictResolution: true,
        enableDuplicateRemoval: true,
        enableSpecificityOptimization: true,
        enableGroupingOptimization: true,
      },
      performance: {
        enableCaching: true,
        maxCacheSize: 1000,
        enableParallelProcessing: false,
        parallelThreshold: 100,
        enablePerformanceMonitoring: true,
        timeoutMs: 5000,
      },
      errorHandling: {
        strictMode: false,
        collectAllErrors: true,
        enableRecovery: true,
        fallbackStrategy: 'preserve-original',
        maxErrors: 50,
        enableDetailedErrors: true,
      },
    };

    handler = new ComplexPatternHandler(defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Pattern Classification', () => {
    it('should classify simple utility patterns correctly', () => {
      const pattern = 'text-blue-500';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('simple-utility');
      expect(parsed.complexityScore).toBeLessThan(20);
      expect(parsed.components.breakpoints).toHaveLength(0);
      expect(parsed.components.pseudoClasses).toHaveLength(0);
    });

    it('should classify responsive utility patterns', () => {
      const pattern = 'md:text-blue-500';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('responsive-utility');
      expect(parsed.complexityScore).toBeGreaterThan(10);
      expect(parsed.components.breakpoints).toContain('md');
      expect(parsed.components.pseudoClasses).toHaveLength(0);
    });

    it('should classify pseudo-class patterns', () => {
      const pattern = 'hover:text-blue-500';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('pseudo-utility');
      expect(parsed.components.breakpoints).toHaveLength(0);
      expect(parsed.components.pseudoClasses).toContain('hover');
    });

    it('should classify responsive + pseudo-class combinations', () => {
      const pattern = 'md:hover:text-blue-500';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('responsive-pseudo');
      expect(parsed.complexityScore).toBeGreaterThan(20);
      expect(parsed.components.breakpoints).toContain('md');
      expect(parsed.components.pseudoClasses).toContain('hover');
    });

    it('should classify multi-breakpoint patterns', () => {
      const pattern = 'sm:md:lg:text-blue-500';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('multi-breakpoint');
      expect(parsed.complexityScore).toBeGreaterThan(30);
      expect(parsed.components.breakpoints).toEqual(['sm', 'md', 'lg']);
    });

    it('should classify multi-pseudo-class patterns', () => {
      const pattern = 'hover:focus:active:text-blue-500';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('multi-pseudo');
      expect(parsed.components.pseudoClasses).toEqual(['hover', 'focus', 'active']);
    });

    it('should classify nested pseudo-class patterns', () => {
      const pattern = 'group-hover:peer-focus:text-blue-500';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('nested-pseudo');
      expect(parsed.metadata.hasGroupModifiers).toBe(true);
      expect(parsed.metadata.hasPeerModifiers).toBe(true);
    });

    it('should classify arbitrary value patterns', () => {
      const pattern = 'text-[#1a2b3c]';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('arbitrary-complex');
      expect(parsed.metadata.hasArbitraryValues).toBe(true);
      expect(parsed.components.arbitraryValues).toContain('#1a2b3c');
    });

    it('should classify grouped patterns', () => {
      const pattern = '(hover:text-blue-500 focus:text-red-500)';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('grouped-pattern');
      expect(parsed.metadata.isGrouped).toBe(true);
    });

    it('should classify highly complex combined patterns', () => {
      const pattern = 'sm:md:group-hover:peer-focus:first:last:text-[#custom]:important';
      const parsed = handler.parseComplexPattern(pattern);

      expect(parsed.type).toBe('combined-complex');
      expect(parsed.complexityScore).toBeGreaterThan(70);
      expect(parsed.components.breakpoints.length).toBeGreaterThan(1);
      expect(parsed.components.pseudoClasses.length).toBeGreaterThan(3);
      expect(parsed.metadata.hasArbitraryValues).toBe(true);
      expect(parsed.metadata.hasImportant).toBe(true);
    });
  });

  describe('Complexity Scoring', () => {
    it('should calculate complexity scores correctly', () => {
      const testCases = [
        { pattern: 'text-blue-500', expectedRange: [0, 10] },
        { pattern: 'md:text-blue-500', expectedRange: [10, 25] },
        { pattern: 'hover:focus:text-blue-500', expectedRange: [20, 35] },
        { pattern: 'md:hover:focus:text-blue-500', expectedRange: [30, 50] },
        { pattern: 'sm:md:lg:hover:focus:active:text-[#custom]', expectedRange: [60, 90] },
      ];

      testCases.forEach(({ pattern, expectedRange }) => {
        const parsed = handler.parseComplexPattern(pattern);
        expect(parsed.complexityScore).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(parsed.complexityScore).toBeLessThanOrEqual(expectedRange[1]);
      });
    });

    it('should factor in breakpoint count for complexity', () => {
      const singleBreakpoint = handler.parseComplexPattern('md:text-blue-500');
      const multipleBreakpoints = handler.parseComplexPattern('sm:md:lg:text-blue-500');

      expect(multipleBreakpoints.complexityScore).toBeGreaterThan(singleBreakpoint.complexityScore);
    });

    it('should factor in pseudo-class nesting for complexity', () => {
      const simplePseudo = handler.parseComplexPattern('hover:text-blue-500');
      const nestedPseudo = handler.parseComplexPattern('group-hover:peer-focus:text-blue-500');

      expect(nestedPseudo.complexityScore).toBeGreaterThan(simplePseudo.complexityScore);
    });

    it('should factor in arbitrary values for complexity', () => {
      const standardValue = handler.parseComplexPattern('text-blue-500');
      const arbitraryValue = handler.parseComplexPattern('text-[#custom]');

      expect(arbitraryValue.complexityScore).toBeGreaterThan(standardValue.complexityScore);
    });
  });

  describe('Complex Pattern Analysis', () => {
    it('should analyze collections of complex patterns', () => {
      const patterns = [
        'text-blue-500',
        'md:text-red-500',
        'hover:text-green-500',
        'lg:hover:focus:text-purple-500',
        'sm:group-hover:text-[#custom]',
      ];

      const result = handler.analyzeComplexCombinations(patterns);

      expect(result.totalPatterns).toBe(5);
      expect(result.averageComplexity).toBeGreaterThan(0);
      expect(result.complexityDistribution).toBeDefined();
      expect(result.typeDistribution).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(result.optimizationOpportunities).toBeDefined();
    });

    it('should identify optimization opportunities', () => {
      const patterns = [
        'md:text-blue-500',
        'md:bg-blue-500',
        'md:border-blue-500',
        'lg:text-blue-500',
        'lg:bg-blue-500',
      ];

      const result = handler.analyzeComplexCombinations(patterns);

      expect(result.optimizationOpportunities.length).toBeGreaterThan(0);
      expect(result.optimizationOpportunities).toContain(
        expect.objectContaining({
          type: 'breakpoint-grouping',
          impact: expect.any(Number),
        })
      );
    });

    it('should detect pattern conflicts', () => {
      const patterns = [
        'text-blue-500',
        'text-red-500', // Color conflict
        'md:text-green-500',
        'md:text-purple-500', // Responsive color conflict
      ];

      const result = handler.analyzeComplexCombinations(patterns);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts).toContain(
        expect.objectContaining({
          type: expect.any(String),
          severity: expect.any(String),
          patterns: expect.any(Array),
        })
      );
    });

    it('should calculate complexity distribution', () => {
      const patterns = [
        'text-blue-500', // Low complexity
        'md:text-red-500', // Medium complexity
        'lg:hover:focus:group-hover:text-[#custom]', // High complexity
      ];

      const result = handler.analyzeComplexCombinations(patterns);

      expect(result.complexityDistribution).toMatchObject({
        low: expect.any(Number),
        medium: expect.any(Number),
        high: expect.any(Number),
      });
    });
  });

  describe('Pattern Optimization', () => {
    it('should optimize complex patterns', () => {
      const patterns = [
        'md:text-blue-500',
        'md:bg-blue-500',
        'md:border-blue-500',
        'lg:text-blue-500',
        'lg:bg-blue-500',
        'lg:border-blue-500',
      ];

      const result = handler.optimizeComplexPatterns(patterns);

      expect(result.originalCount).toBe(6);
      expect(result.optimizedCount).toBeLessThanOrEqual(6);
      expect(result.optimizationsApplied.length).toBeGreaterThan(0);
      expect(result.reductionPercentage).toBeGreaterThanOrEqual(0);
    });

    it('should apply breakpoint grouping optimization', () => {
      const patterns = [
        'md:text-blue-500',
        'md:bg-white',
        'md:p-4',
        'lg:text-red-500',
        'lg:bg-gray-100',
        'lg:p-6',
      ];

      const result = handler.optimizeComplexPatterns(patterns);

      expect(result.optimizationsApplied).toContain(
        expect.objectContaining({
          type: 'breakpoint-grouping',
          description: expect.any(String),
        })
      );
    });

    it('should apply pseudo-class ordering optimization', () => {
      const patterns = [
        'active:text-blue-500',
        'hover:text-blue-500',
        'focus:text-blue-500',
        'visited:text-blue-500',
      ];

      const result = handler.optimizeComplexPatterns(patterns);

      expect(result.optimizationsApplied).toContain(
        expect.objectContaining({
          type: 'pseudo-class-ordering',
          description: expect.any(String),
        })
      );
    });

    it('should remove duplicate patterns', () => {
      const patterns = [
        'text-blue-500',
        'md:text-red-500',
        'text-blue-500', // Duplicate
        'lg:text-green-500',
        'md:text-red-500', // Duplicate
      ];

      const result = handler.optimizeComplexPatterns(patterns);

      expect(result.optimizedCount).toBe(3);
      expect(result.duplicatesRemoved).toBe(2);
    });

    it('should optimize specificity conflicts', () => {
      const patterns = [
        'text-blue-500',
        'hover:text-red-500',
        'focus:hover:text-green-500', // Higher specificity
      ];

      const result = handler.optimizeComplexPatterns(patterns);

      expect(result.optimizationsApplied).toContain(
        expect.objectContaining({
          type: 'specificity-optimization',
        })
      );
    });
  });

  describe('Pattern Validation', () => {
    it('should validate complex patterns', () => {
      const patterns = [
        'text-blue-500', // Valid
        'md:text-red-500', // Valid
        'invalid:text-green-500', // Invalid breakpoint
        'hover::text-purple-500', // Invalid syntax
        'sm:lg:text-yellow-500', // Invalid breakpoint order
      ];

      const result = handler.validateComplexPatterns(patterns);

      expect(result.validPatterns.length).toBe(2);
      expect(result.invalidPatterns.length).toBe(3);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate breakpoint order', () => {
      const patterns = [
        'lg:text-blue-500',
        'sm:text-red-500', // Out of order
        'md:text-green-500',
      ];

      const result = handler.validateComplexPatterns(patterns);

      expect(result.warnings).toContain(expect.stringContaining('breakpoint order'));
    });

    it('should validate pseudo-class order (LVHA)', () => {
      const patterns = [
        'active:text-blue-500',
        'hover:text-red-500', // Out of LVHA order
        'focus:text-green-500',
        'visited:text-purple-500',
      ];

      const result = handler.validateComplexPatterns(patterns);

      expect(result.warnings).toContain(expect.stringContaining('LVHA order'));
    });

    it('should validate arbitrary value syntax', () => {
      const patterns = [
        'text-[#ffffff]', // Valid hex
        'text-[rgb(255,0,0)]', // Valid RGB
        'text-[invalid-color]', // Invalid
        'w-[100px]', // Valid length
        'w-[invalid]', // Invalid
      ];

      const result = handler.validateComplexPatterns(patterns);

      expect(result.invalidPatterns.length).toBe(2);
      expect(result.errors).toContain(expect.stringContaining('arbitrary value'));
    });
  });

  describe('Performance and Caching', () => {
    it('should cache parsed patterns for performance', () => {
      const pattern = 'md:hover:focus:text-blue-500';

      // First parse
      const result1 = handler.parseComplexPattern(pattern);
      const cacheHits1 = handler.getCacheStats().hits;

      // Second parse (should use cache)
      const result2 = handler.parseComplexPattern(pattern);
      const cacheHits2 = handler.getCacheStats().hits;

      expect(result1).toEqual(result2);
      expect(cacheHits2).toBeGreaterThan(cacheHits1);
    });

    it('should handle large pattern collections efficiently', () => {
      const largePatternSet = Array.from({ length: 1000 }, (_, i) => {
        const breakpoint = ['sm', 'md', 'lg', 'xl'][i % 4];
        const pseudo = ['hover', 'focus', 'active'][i % 3];
        return `${breakpoint}:${pseudo}:text-color-${i}`;
      });

      const startTime = performance.now();
      const result = handler.analyzeComplexCombinations(largePatternSet);
      const endTime = performance.now();

      expect(result.totalPatterns).toBe(1000);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should respect performance timeouts', () => {
      const timeoutHandler = new ComplexPatternHandler({
        ...defaultConfig,
        performance: {
          ...defaultConfig.performance,
          timeoutMs: 100, // Very short timeout
        },
      });

      const complexPatterns = Array.from(
        { length: 10000 },
        (_, i) => `sm:md:lg:xl:hover:focus:active:group-hover:peer-focus:text-color-${i}`
      );

      const result = timeoutHandler.analyzeComplexCombinations(complexPatterns);

      expect(result.timedOut).toBe(true);
      expect(result.processedCount).toBeLessThan(10000);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed patterns gracefully', () => {
      const malformedPatterns = [
        null,
        undefined,
        '',
        ':text-blue-500',
        'md::text-red-500',
        'text-blue-500:',
        'md:text-',
      ] as any[];

      const result = handler.validateComplexPatterns(malformedPatterns);

      expect(result.validPatterns).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.recoveredPatterns).toBeDefined();
    });

    it('should recover from parsing errors when enabled', () => {
      const patterns = [
        'text-blue-500', // Valid
        'md::text-red-500', // Malformed but recoverable
        'invalid-bp:text-green-500', // Invalid breakpoint
      ];

      const result = handler.validateComplexPatterns(patterns);

      expect(result.recoveredPatterns.length).toBeGreaterThan(0);
      expect(result.validPatterns.length).toBeGreaterThan(1);
    });

    it('should respect error collection limits', () => {
      const limitedHandler = new ComplexPatternHandler({
        ...defaultConfig,
        errorHandling: {
          ...defaultConfig.errorHandling,
          maxErrors: 3,
        },
      });

      const invalidPatterns = Array.from({ length: 10 }, (_, i) => `invalid-${i}:text-blue-500`);

      const result = limitedHandler.validateComplexPatterns(invalidPatterns);

      expect(result.errors.length).toBeLessThanOrEqual(3);
      expect(result.errorLimitReached).toBe(true);
    });
  });

  describe('Integration and Extension Points', () => {
    it('should integrate with external validation systems', () => {
      const customValidator = vi.fn().mockReturnValue({ isValid: true, errors: [] });

      handler.addCustomValidator('custom-rule', customValidator);

      const result = handler.validateComplexPatterns(['text-blue-500']);

      expect(customValidator).toHaveBeenCalled();
      expect(result.customValidationResults).toBeDefined();
    });

    it('should support custom optimization strategies', () => {
      const customOptimizer = vi.fn().mockReturnValue({
        optimizedPatterns: ['optimized-pattern'],
        applied: true,
      });

      handler.addCustomOptimizer('custom-opt', customOptimizer);

      const result = handler.optimizeComplexPatterns(['text-blue-500']);

      expect(customOptimizer).toHaveBeenCalled();
      expect(result.customOptimizations).toBeDefined();
    });

    it('should emit events for pattern processing lifecycle', () => {
      const onPatternParsed = vi.fn();
      const onOptimizationApplied = vi.fn();

      handler.on('pattern-parsed', onPatternParsed);
      handler.on('optimization-applied', onOptimizationApplied);

      handler.parseComplexPattern('md:hover:text-blue-500');

      expect(onPatternParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          pattern: 'md:hover:text-blue-500',
          parsed: expect.any(Object),
        })
      );
    });
  });
});
