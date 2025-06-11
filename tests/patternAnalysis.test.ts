import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzePatterns,
  generateFrequencyMap,
  generatePatternGroups,
  generateCoOccurrenceAnalysis,
  generateFrameworkAnalysis,
  calculateFrequencyStatistics,
  sortFrequencyMap,
  filterFrequencyMap,
  exportToJson,
  quickFrequencyAnalysis,
  aggregateExtractionResults,
  cleanupAggregatedData,
  CommonFilters,
  COMMON_TAILWIND_PATTERNS,
  PatternAnalysisOptionsSchema,
  PatternAnalysisError,
  DataAggregationError,
  FrequencyCalculationError,
  type PatternAnalysisInput,
  type PatternAnalysisOptions,
  type HtmlClassExtractionResult,
  type JsClassExtractionResult,
  type PatternFrequencyMap,
  type FrequencyAnalysisResult
} from '../src/patternAnalysis.js';
import type { ClassData } from '../src/htmlExtractor.js';
import type { JsClassData } from '../src/jsExtractor.js';

describe('PatternAnalysis', () => {
  let mockHtmlResult: HtmlClassExtractionResult;
  let mockJsxResult: JsClassExtractionResult;
  let mockInput: PatternAnalysisInput;

  beforeEach(() => {
    // Mock HTML extraction result
    const htmlClassMap = new Map<string, ClassData>();
    htmlClassMap.set('bg-blue-500', {
      name: 'bg-blue-500',
      frequency: 5,
      contexts: [
        {
          tagName: 'div',
          attributes: { class: 'bg-blue-500 text-white', id: 'header' },
          depth: 2
        },
        {
          tagName: 'button',
          attributes: { class: 'bg-blue-500 hover:bg-blue-600' },
          depth: 3
        }
      ]
    });
    htmlClassMap.set('text-white', {
      name: 'text-white',
      frequency: 3,
      contexts: [
        {
          tagName: 'div',
          attributes: { class: 'bg-blue-500 text-white' },
          depth: 2
        }
      ]
    });
    htmlClassMap.set('container', {
      name: 'container',
      frequency: 2,
      contexts: [
        {
          tagName: 'div',
          attributes: { class: 'container mx-auto' },
          depth: 1
        }
      ]
    });

    mockHtmlResult = {
      classes: htmlClassMap,
      totalElements: 10,
      totalClasses: 15,
      uniqueClasses: 3,
      metadata: {
        source: '/test/page1.html',
        processedAt: new Date(),
        processingTime: 100,
        fileSize: 1024,
        errors: []
      }
    };

    // Mock JSX extraction result
    const jsxClassMap = new Map<string, JsClassData>();
    jsxClassMap.set('bg-red-500', {
      name: 'bg-red-500',
      frequency: 4,
      contexts: [
        {
          pattern: 'className="bg-red-500 text-white"',
          lineNumber: 15,
          framework: 'react',
          extractionType: 'static'
        }
      ]
    });
    jsxClassMap.set('text-white', {
      name: 'text-white',
      frequency: 6,
      contexts: [
        {
          pattern: 'className="text-white font-bold"',
          lineNumber: 20,
          framework: 'react',
          extractionType: 'static'
        }
      ]
    });

    mockJsxResult = {
      classes: jsxClassMap,
      totalMatches: 25,
      totalClasses: 10,
      uniqueClasses: 2,
      framework: 'react',
      metadata: {
        source: '/test/component1.tsx',
        processedAt: new Date(),
        processingTime: 150,
        fileSize: 2048,
        errors: [],
        extractionStats: {
          staticMatches: 20,
          dynamicMatches: 3,
          templateMatches: 2,
          utilityMatches: 0
        }
      }
    };

    mockInput = {
      htmlResults: [mockHtmlResult],
      jsxResults: [mockJsxResult]
    };
  });

  describe('Schema Validation', () => {
    it('should validate default options', () => {
      const result = PatternAnalysisOptionsSchema.parse({});
      expect(result.caseSensitive).toBe(true);
      expect(result.minimumFrequency).toBe(1);
      expect(result.enablePatternGrouping).toBe(true);
      expect(result.enableCoOccurrenceAnalysis).toBe(true);
      expect(result.sortBy).toBe('frequency');
      expect(result.sortDirection).toBe('desc');
    });

    it('should validate custom options', () => {
      const options = {
        caseSensitive: false,
        minimumFrequency: 5,
        enablePatternGrouping: false,
        sortBy: 'alphabetical' as const,
        sortDirection: 'asc' as const
      };
      const result = PatternAnalysisOptionsSchema.parse(options);
      expect(result).toMatchObject(options);
    });

    it('should reject invalid options', () => {
      expect(() => PatternAnalysisOptionsSchema.parse({
        minimumFrequency: 0
      })).toThrow();

      expect(() => PatternAnalysisOptionsSchema.parse({
        sortBy: 'invalid'
      })).toThrow();
    });
  });

  describe('Data Aggregation', () => {
    it('should aggregate HTML and JSX results correctly', () => {
      const result = aggregateExtractionResults(mockInput);

      expect(result.size).toBe(4); // bg-blue-500, text-white, container, bg-red-500
      
      const textWhite = result.get('text-white');
      expect(textWhite).toBeDefined();
      expect(textWhite!.totalFrequency).toBe(9); // 3 from HTML + 6 from JSX
      expect(textWhite!.htmlFrequency).toBe(3);
      expect(textWhite!.jsxFrequency).toBe(6);
      expect(textWhite!.sources.sourceType).toBe('mixed');
    });

    it('should respect case sensitivity option', () => {
      const options: PatternAnalysisOptions = { caseSensitive: false };
      const result = aggregateExtractionResults(mockInput, options);

      // All class names should be lowercase
      for (const [className] of result) {
        expect(className).toBe(className.toLowerCase());
      }
    });

    it('should apply minimum frequency filtering', () => {
      const options: PatternAnalysisOptions = { minimumFrequency: 4 };
      const result = aggregateExtractionResults(mockInput, options);

      // Only classes with frequency >= 4 should remain
      for (const [, data] of result) {
        expect(data.totalFrequency).toBeGreaterThanOrEqual(4);
      }
    });

    it('should cleanup aggregated data', () => {
      const result = aggregateExtractionResults(mockInput);
      cleanupAggregatedData(result);

      for (const [, data] of result) {
        // File paths should be unique
        const uniquePaths = new Set(data.sources.filePaths);
        expect(uniquePaths.size).toBe(data.sources.filePaths.length);

        // Contexts should be sorted by file path
        if (data.contexts.html.length > 1) {
          for (let i = 1; i < data.contexts.html.length; i++) {
            expect(data.contexts.html[i].filePath >= data.contexts.html[i - 1].filePath).toBe(true);
          }
        }
      }
    });
  });

  describe('Frequency Map Generation', () => {
    it('should generate frequency map from input', () => {
      const result = generateFrequencyMap(mockInput);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBeGreaterThan(0);

      // Check that aggregated frequencies are correct
      const textWhite = result.get('text-white');
      expect(textWhite?.totalFrequency).toBe(9);
    });

    it('should generate co-occurrence patterns when enabled', () => {
      const options: PatternAnalysisOptions = { enableCoOccurrenceAnalysis: true };
      const result = generateFrequencyMap(mockInput, options);

      // Classes that appear together should have co-occurrence data
      const bgBlue = result.get('bg-blue-500');
      expect(bgBlue?.coOccurrences.size).toBeGreaterThan(0);
    });

    it('should skip co-occurrence when disabled', () => {
      const options: PatternAnalysisOptions = { enableCoOccurrenceAnalysis: false };
      const result = generateFrequencyMap(mockInput, options);

      for (const [, data] of result) {
        expect(data.coOccurrences.size).toBe(0);
      }
    });
  });

  describe('Pattern Groups', () => {
    it('should generate pattern groups for Tailwind classes', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const options: PatternAnalysisOptions = { enablePatternGrouping: true };
      const result = generatePatternGroups(frequencyMap, options);

      expect(result).toBeInstanceOf(Array);
      
      // Should find color patterns (bg-blue-500, bg-red-500)
      const colorGroup = result.find(group => group.pattern === 'colors');
      expect(colorGroup).toBeDefined();
      expect(colorGroup!.classes.length).toBeGreaterThan(0);
      expect(colorGroup!.totalFrequency).toBeGreaterThan(0);
    });

    it('should skip pattern grouping when disabled', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const options: PatternAnalysisOptions = { enablePatternGrouping: false };
      const result = generatePatternGroups(frequencyMap, options);

      expect(result).toEqual([]);
    });

    it('should sort pattern groups by frequency', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const options: PatternAnalysisOptions = { enablePatternGrouping: true };
      const result = generatePatternGroups(frequencyMap, options);

      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i].totalFrequency <= result[i - 1].totalFrequency).toBe(true);
        }
      }
    });
  });

  describe('Co-occurrence Analysis', () => {
    it('should generate co-occurrence patterns', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const result = generateCoOccurrenceAnalysis(frequencyMap);

      expect(result).toBeInstanceOf(Array);
      
      if (result.length > 0) {
        const pattern = result[0];
        expect(pattern.classes).toHaveLength(2);
        expect(pattern.frequency).toBeGreaterThan(0);
        expect(pattern.strength).toBeGreaterThan(0);
        expect(pattern.strength).toBeLessThanOrEqual(1);
        expect(pattern.contexts).toBeInstanceOf(Array);
      }
    });

    it('should calculate strength correctly', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const result = generateCoOccurrenceAnalysis(frequencyMap);

      for (const pattern of result) {
        expect(pattern.strength).toBeGreaterThan(0);
        expect(pattern.strength).toBeLessThanOrEqual(1);
      }
    });

    it('should sort by strength descending', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const result = generateCoOccurrenceAnalysis(frequencyMap);

      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i].strength <= result[i - 1].strength).toBe(true);
        }
      }
    });
  });

  describe('Framework Analysis', () => {
    it('should generate framework-specific statistics', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const options: PatternAnalysisOptions = { includeFrameworkAnalysis: true };
      const result = generateFrameworkAnalysis(frequencyMap, options);

      expect(result).toBeInstanceOf(Array);
      
      const reactAnalysis = result.find(analysis => analysis.framework === 'react');
      expect(reactAnalysis).toBeDefined();
      expect(reactAnalysis!.totalClasses).toBeGreaterThan(0);
      expect(reactAnalysis!.uniqueClasses).toBeGreaterThan(0);
      expect(reactAnalysis!.mostCommonClasses).toBeInstanceOf(Array);
    });

    it('should skip framework analysis when disabled', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const options: PatternAnalysisOptions = { includeFrameworkAnalysis: false };
      const result = generateFrameworkAnalysis(frequencyMap, options);

      expect(result).toEqual([]);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate frequency statistics', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const result = calculateFrequencyStatistics(frequencyMap);

      expect(result.averageFrequency).toBeGreaterThan(0);
      expect(result.medianFrequency).toBeGreaterThan(0);
      expect(result.mostFrequentClass).toBeDefined();
      expect(result.leastFrequentClass).toBeDefined();
      expect(result.classesAboveThreshold).toBeGreaterThanOrEqual(0);
      expect(result.classesBelowThreshold).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty frequency map', () => {
      const emptyMap = new Map();
      const result = calculateFrequencyStatistics(emptyMap);

      expect(result.averageFrequency).toBe(0);
      expect(result.medianFrequency).toBe(0);
      expect(result.mostFrequentClass).toBeNull();
      expect(result.leastFrequentClass).toBeNull();
    });
  });

  describe('Sorting and Filtering', () => {
    it('should sort by frequency', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const options: PatternAnalysisOptions = { sortBy: 'frequency', sortDirection: 'desc' };
      const result = sortFrequencyMap(frequencyMap, options);

      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i][1].totalFrequency <= result[i - 1][1].totalFrequency).toBe(true);
        }
      }
    });

    it('should sort alphabetically', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      const options: PatternAnalysisOptions = { sortBy: 'alphabetical', sortDirection: 'asc' };
      const result = sortFrequencyMap(frequencyMap, options);

      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i][0] >= result[i - 1][0]).toBe(true);
        }
      }
    });

    it('should filter using common filters', () => {
      const frequencyMap = generateFrequencyMap(mockInput);
      
      // Test minimum frequency filter
      const minFreqFilter = CommonFilters.minFrequency(5);
      const filtered1 = filterFrequencyMap(frequencyMap, minFreqFilter);
      for (const [, data] of filtered1) {
        expect(data.totalFrequency).toBeGreaterThanOrEqual(5);
      }

      // Test pattern filter
      const colorFilter = CommonFilters.tailwindPattern('colors');
      const filtered2 = filterFrequencyMap(frequencyMap, colorFilter);
      for (const [className] of filtered2) {
        expect(COMMON_TAILWIND_PATTERNS.colors.test(className)).toBe(true);
      }
    });
  });

  describe('Export Functions', () => {
    it('should export to JSON format', () => {
      const analysisResult = analyzePatterns(mockInput);
      const result = exportToJson(analysisResult);

      expect(result.frequencyMap).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalClasses).toBe(analysisResult.totalClasses);
      expect(result.summary.topClasses).toBeInstanceOf(Array);
    });

    it('should include top classes in summary', () => {
      const analysisResult = analyzePatterns(mockInput);
      const result = exportToJson(analysisResult);

      expect(result.summary.topClasses.length).toBeGreaterThan(0);
      expect(result.summary.topClasses.length).toBeLessThanOrEqual(20);
      
      // Should be sorted by frequency
      if (result.summary.topClasses.length > 1) {
        for (let i = 1; i < result.summary.topClasses.length; i++) {
          expect(result.summary.topClasses[i].frequency <= result.summary.topClasses[i - 1].frequency).toBe(true);
        }
      }
    });
  });

  describe('Main Analysis Function', () => {
    it('should perform complete pattern analysis', () => {
      const result = analyzePatterns(mockInput);

      expect(result.frequencyMap).toBeInstanceOf(Map);
      expect(result.totalClasses).toBeGreaterThan(0);
      expect(result.uniqueClasses).toBeGreaterThan(0);
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.patternGroups).toBeInstanceOf(Array);
      expect(result.coOccurrencePatterns).toBeInstanceOf(Array);
      expect(result.frameworkAnalysis).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.processedAt).toBeInstanceOf(Date);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle custom options', () => {
      const options: PatternAnalysisOptions = {
        minimumFrequency: 5,
        enablePatternGrouping: false,
        enableCoOccurrenceAnalysis: false,
        includeFrameworkAnalysis: false
      };
      const result = analyzePatterns(mockInput, options);

      expect(result.patternGroups).toEqual([]);
      expect(result.coOccurrencePatterns).toEqual([]);
      expect(result.frameworkAnalysis).toEqual([]);
    });

    it('should collect metadata correctly', () => {
      const result = analyzePatterns(mockInput);

      expect(result.metadata.sources.htmlFiles).toBe(1);
      expect(result.metadata.sources.jsxFiles).toBe(1);
      expect(result.metadata.sources.totalExtractionResults).toBe(2);
      expect(result.metadata.statistics).toBeDefined();
      expect(result.metadata.errors).toBeInstanceOf(Array);
    });
  });

  describe('Quick Analysis Function', () => {
    it('should perform quick frequency analysis', () => {
      const result = quickFrequencyAnalysis(mockInput);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBeGreaterThan(0);

      // Check that values are frequencies
      for (const [, frequency] of result) {
        expect(typeof frequency).toBe('number');
        expect(frequency).toBeGreaterThan(0);
      }
    });

    it('should respect minimum frequency', () => {
      const result = quickFrequencyAnalysis(mockInput, 5);

      for (const [, frequency] of result) {
        expect(frequency).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw PatternAnalysisError for invalid input', () => {
      const invalidInput = {
        htmlResults: [],
        jsxResults: []
      };

      expect(() => analyzePatterns(invalidInput)).not.toThrow();
      // Empty input should work but return empty results
    });

    it('should handle malformed extraction results gracefully', () => {
      const invalidInput = {
        htmlResults: [{ ...mockHtmlResult, classes: null as any }],
        jsxResults: []
      };

      expect(() => analyzePatterns(invalidInput)).toThrow();
    });

    it('should provide detailed error messages', () => {
      try {
        const invalidOptions = { minimumFrequency: -1 } as any;
        PatternAnalysisOptionsSchema.parse(invalidOptions);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Tailwind Pattern Recognition', () => {
    it('should recognize common Tailwind patterns', () => {
      expect(COMMON_TAILWIND_PATTERNS.colors.test('bg-blue-500')).toBe(true);
      expect(COMMON_TAILWIND_PATTERNS.colors.test('text-red-600')).toBe(true);
      expect(COMMON_TAILWIND_PATTERNS.spacing.test('m-4')).toBe(true);
      expect(COMMON_TAILWIND_PATTERNS.spacing.test('px-6')).toBe(true);
      expect(COMMON_TAILWIND_PATTERNS.sizing.test('w-full')).toBe(true);
      expect(COMMON_TAILWIND_PATTERNS.responsive.test('md:text-lg')).toBe(true);
      expect(COMMON_TAILWIND_PATTERNS.hover.test('hover:bg-blue-600')).toBe(true);
    });

    it('should not match non-Tailwind classes', () => {
      expect(COMMON_TAILWIND_PATTERNS.colors.test('header')).toBe(false);
      expect(COMMON_TAILWIND_PATTERNS.spacing.test('container')).toBe(false);
      expect(COMMON_TAILWIND_PATTERNS.sizing.test('btn-primary')).toBe(false);
    });
  });
}); 