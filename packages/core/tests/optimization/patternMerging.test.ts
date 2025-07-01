import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MergingStrategy, PatternMergingConfig } from '../../src/optimization/patternMerging';
import { PatternMergingEngine } from '../../src/optimization/patternMerging';

describe('PatternMergingEngine', () => {
  let engine: PatternMergingEngine;
  let defaultConfig: PatternMergingConfig;

  beforeEach(() => {
    defaultConfig = {
      strategy: 'mobile-first' as MergingStrategy,
      enableCaching: true,
      maxCacheSize: 1000,
      enableParallelProcessing: false,
      parallelThreshold: 100,
      preserveSpecificity: true,
      respectCascadeOrder: true,
      enableOptimizations: true,
      conflictResolution: 'last-wins',
      enablePerformanceMonitoring: true,
      debugMode: false,
    };

    engine = new PatternMergingEngine(defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Pattern Merging', () => {
    it('should merge simple patterns correctly', async () => {
      const patterns = [
        { selector: '.text-blue-500', properties: { color: '#3b82f6' } },
        { selector: '.text-red-500', properties: { color: '#ef4444' } },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.mergedPatterns).toBeDefined();
      expect(result.originalCount).toBe(2);
      expect(result.conflicts).toBeDefined();
    });

    it('should handle empty input gracefully', async () => {
      const result = await engine.mergePatterns([]);

      expect(result.mergedPatterns).toEqual([]);
      expect(result.originalCount).toBe(0);
      expect(result.conflicts).toEqual([]);
    });

    it('should detect and resolve conflicts', async () => {
      const patterns = [
        { selector: '.text-blue-500', properties: { color: '#3b82f6' } },
        { selector: '.text-blue-500', properties: { color: '#1d4ed8' } }, // Conflict
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflictsResolved).toBeGreaterThan(0);
    });
  });

  describe('Responsive Pattern Merging', () => {
    it('should merge responsive patterns with mobile-first strategy', async () => {
      const patterns = [
        { selector: '.sm:text-blue-500', properties: { color: '#3b82f6' }, breakpoint: 'sm' },
        { selector: '.md:text-blue-500', properties: { color: '#3b82f6' }, breakpoint: 'md' },
        { selector: '.lg:text-blue-500', properties: { color: '#3b82f6' }, breakpoint: 'lg' },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.mergedPatterns).toBeDefined();
      expect(result.optimizationApplied).toBe(true);
    });

    it('should handle breakpoint order validation', async () => {
      const patterns = [
        { selector: '.lg:text-blue-500', properties: { color: '#3b82f6' }, breakpoint: 'lg' },
        { selector: '.sm:text-red-500', properties: { color: '#ef4444' }, breakpoint: 'sm' },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.warnings).toBeDefined();
      // Should either reorder or warn about incorrect order
    });
  });

  describe('Pseudo-Class Pattern Merging', () => {
    it('should merge pseudo-class patterns correctly', async () => {
      const patterns = [
        {
          selector: '.hover:text-blue-500',
          properties: { color: '#3b82f6' },
          pseudoClass: 'hover',
        },
        {
          selector: '.focus:text-blue-500',
          properties: { color: '#3b82f6' },
          pseudoClass: 'focus',
        },
        {
          selector: '.active:text-blue-500',
          properties: { color: '#3b82f6' },
          pseudoClass: 'active',
        },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.mergedPatterns).toBeDefined();
      expect(result.lvhaOrderRespected).toBe(true);
    });

    it('should enforce LVHA order', async () => {
      const patterns = [
        {
          selector: '.active:text-blue-500',
          properties: { color: '#3b82f6' },
          pseudoClass: 'active',
        },
        {
          selector: '.hover:text-blue-500',
          properties: { color: '#3b82f6' },
          pseudoClass: 'hover',
        },
        {
          selector: '.visited:text-blue-500',
          properties: { color: '#3b82f6' },
          pseudoClass: 'visited',
        },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.lvhaOrderRespected).toBe(true);
      // Should reorder to proper LVHA sequence
    });
  });

  describe('Complex Pattern Combinations', () => {
    it('should handle responsive + pseudo-class combinations', async () => {
      const patterns = [
        {
          selector: '.sm:hover:text-blue-500',
          properties: { color: '#3b82f6' },
          breakpoint: 'sm',
          pseudoClass: 'hover',
        },
        {
          selector: '.md:focus:text-red-500',
          properties: { color: '#ef4444' },
          breakpoint: 'md',
          pseudoClass: 'focus',
        },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.mergedPatterns).toBeDefined();
      expect(result.complexPatterns).toBeGreaterThan(0);
    });

    it('should optimize repeated property combinations', async () => {
      const patterns = [
        { selector: '.text-blue-500', properties: { color: '#3b82f6' } },
        { selector: '.bg-blue-500', properties: { backgroundColor: '#3b82f6' } },
        { selector: '.border-blue-500', properties: { borderColor: '#3b82f6' } },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.colorOptimizations).toBeDefined();
      expect(result.reductionPercentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Caching', () => {
    it('should utilize caching for repeated patterns', async () => {
      const patterns = [
        { selector: '.text-blue-500', properties: { color: '#3b82f6' } },
        { selector: '.text-red-500', properties: { color: '#ef4444' } },
      ];

      // First merge
      const result1 = await engine.mergePatterns(patterns);
      const cacheHits1 = result1.cacheHits || 0;

      // Second merge (should use cache)
      const result2 = await engine.mergePatterns(patterns);
      const cacheHits2 = result2.cacheHits || 0;

      expect(cacheHits2).toBeGreaterThan(cacheHits1);
    });

    it('should handle large pattern sets efficiently', async () => {
      const largePatternSet = Array.from({ length: 1000 }, (_, i) => ({
        selector: `.pattern-${i}`,
        properties: { color: `#${i.toString(16).padStart(6, '0')}` },
      }));

      const startTime = performance.now();
      const result = await engine.mergePatterns(largePatternSet);
      const endTime = performance.now();

      expect(result.mergedPatterns).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid patterns gracefully', async () => {
      const patterns = [
        null,
        undefined,
        { selector: '', properties: {} },
        { selector: '.valid-pattern', properties: { color: '#3b82f6' } },
      ] as any[];

      const result = await engine.mergePatterns(patterns);

      expect(result.mergedPatterns).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should recover from processing errors', async () => {
      const patterns = [
        { selector: '.valid-pattern', properties: { color: '#3b82f6' } },
        { selector: '.problematic-pattern', properties: { invalidProperty: 'invalid' } },
        { selector: '.another-valid', properties: { backgroundColor: '#ef4444' } },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.mergedPatterns).toBeDefined();
      expect(result.mergedPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Strategies', () => {
    it('should respect mobile-first merge strategy', async () => {
      const mobileFirstEngine = new PatternMergingEngine({
        ...defaultConfig,
        strategy: 'mobile-first',
      });

      const patterns = [
        { selector: '.lg:text-blue-500', properties: { color: '#3b82f6' }, breakpoint: 'lg' },
        { selector: '.sm:text-blue-500', properties: { color: '#3b82f6' }, breakpoint: 'sm' },
      ];

      const result = await mobileFirstEngine.mergePatterns(patterns);

      expect(result.strategyApplied).toBe('mobile-first');
    });

    it('should handle custom merge strategies', async () => {
      const customEngine = new PatternMergingEngine({
        ...defaultConfig,
        strategy: 'specificity',
      });

      const patterns = [
        { selector: '.text-blue-500', properties: { color: '#3b82f6' }, specificity: 10 },
        { selector: '.hover:text-red-500', properties: { color: '#ef4444' }, specificity: 20 },
      ];

      const result = await customEngine.mergePatterns(patterns);

      expect(result.strategyApplied).toBe('specificity');
    });

    it('should validate configuration', () => {
      expect(() => {
        new PatternMergingEngine({
          ...defaultConfig,
          maxCacheSize: -1, // Invalid
        });
      }).toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with real-world component patterns', async () => {
      const patterns = [
        // Button base styles
        { selector: '.btn', properties: { display: 'inline-flex', alignItems: 'center' } },
        { selector: '.btn-primary', properties: { backgroundColor: '#3b82f6', color: 'white' } },
        { selector: '.btn:hover', properties: { backgroundColor: '#2563eb' } },
        { selector: '.btn:focus', properties: { outline: '2px solid #3b82f6' } },
        { selector: '.btn:active', properties: { backgroundColor: '#1d4ed8' } },
        { selector: '.btn:disabled', properties: { opacity: '0.5', cursor: 'not-allowed' } },
        // Responsive variations
        {
          selector: '.sm:btn-lg',
          properties: { padding: '12px 24px', fontSize: '18px' },
          breakpoint: 'sm',
        },
        {
          selector: '.md:btn-lg',
          properties: { padding: '16px 32px', fontSize: '20px' },
          breakpoint: 'md',
        },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.mergedPatterns).toBeDefined();
      expect(result.componentOptimized).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should optimize form component patterns', async () => {
      const patterns = [
        // Input styles
        { selector: '.input', properties: { border: '1px solid #d1d5db', borderRadius: '6px' } },
        {
          selector: '.input:focus',
          properties: { borderColor: '#3b82f6', outline: '2px solid #3b82f620' },
        },
        { selector: '.input:invalid', properties: { borderColor: '#ef4444' } },
        {
          selector: '.input:disabled',
          properties: { backgroundColor: '#f3f4f6', cursor: 'not-allowed' },
        },
        // Responsive sizing
        {
          selector: '.sm:input-lg',
          properties: { padding: '12px 16px', fontSize: '16px' },
          breakpoint: 'sm',
        },
        {
          selector: '.md:input-lg',
          properties: { padding: '14px 18px', fontSize: '18px' },
          breakpoint: 'md',
        },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.mergedPatterns).toBeDefined();
      expect(result.formOptimizations).toBeDefined();
    });
  });

  describe('Metrics and Reporting', () => {
    it('should provide comprehensive merge metrics', async () => {
      const patterns = [
        { selector: '.text-blue-500', properties: { color: '#3b82f6' } },
        { selector: '.text-red-500', properties: { color: '#ef4444' } },
        {
          selector: '.hover:text-green-500',
          properties: { color: '#10b981' },
          pseudoClass: 'hover',
        },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.metrics).toMatchObject({
        totalTime: expect.any(Number),
        patternsProcessed: expect.any(Number),
        conflictsDetected: expect.any(Number),
        optimizationsApplied: expect.any(Number),
      });
    });

    it('should track merge statistics', async () => {
      const patterns = [
        { selector: '.duplicate-1', properties: { color: '#3b82f6' } },
        { selector: '.duplicate-2', properties: { color: '#3b82f6' } }, // Same color
        { selector: '.unique', properties: { backgroundColor: '#ef4444' } },
      ];

      const result = await engine.mergePatterns(patterns);

      expect(result.statistics).toBeDefined();
      expect(result.duplicatesFound).toBeGreaterThanOrEqual(0);
      expect(result.colorDeduplication).toBeDefined();
    });
  });
});
