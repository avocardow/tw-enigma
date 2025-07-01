/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  CompleteConsolidator,
  createCompleteConsolidator,
  quickConsolidate,
  ConsolidationError,
  DEFAULT_CONSOLIDATOR_OPTIONS,
  type CompleteConsolidatorOptions,
  type ExtractionResult,
  type FileModification,
  type ConsolidationResult,
} from '../completeConsolidator';
import type { PatternAnalysisInput, AggregatedClassData } from '../../processors/patternAnalysis';
import type { AtomicFileWriter } from '../../atomicOps/AtomicFileWriter';

// Mock dependencies
jest.mock('../../processors/patternAnalysis', () => ({
  analyzePatterns: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  copyFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-checksum'),
  })),
}));

const mockAnalyzePatterns = require('../../processors/patternAnalysis').analyzePatterns;
const mockFs = require('fs/promises');

describe('CompleteConsolidator', () => {
  let consolidator: CompleteConsolidator;
  let mockAtomicWriter: jest.Mocked<AtomicFileWriter>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAtomicWriter = {
      writeFile: jest.fn(),
      readFile: jest.fn(),
      ensureFile: jest.fn(),
      deleteFile: jest.fn(),
      backupFile: jest.fn(),
      restoreBackup: jest.fn(),
    } as jest.Mocked<AtomicFileWriter>;

    consolidator = new CompleteConsolidator(
      {
        minimumFrequency: 2,
        enableAtomicWrites: true,
        createBackups: true,
        dataStructureConfig: {
          maxEntries: 1000,
        },
      },
      mockAtomicWriter
    );
  });

  describe('constructor', () => {
    test('should create with default options', () => {
      const defaultConsolidator = new CompleteConsolidator();
      expect(defaultConsolidator).toBeInstanceOf(CompleteConsolidator);
    });

    test('should merge custom options with defaults', () => {
      const customOptions: Partial<CompleteConsolidatorOptions> = {
        minimumFrequency: 5,
        caseSensitive: true,
      };
      
      const customConsolidator = new CompleteConsolidator(customOptions);
      expect(customConsolidator).toBeInstanceOf(CompleteConsolidator);
    });
  });

  describe('input validation', () => {
    test('should throw error for invalid input', async () => {
      const invalidInput = null as any;
      
      await expect(consolidator.consolidate(invalidInput)).rejects.toThrow(ConsolidationError);
    });

    test('should throw error for missing results arrays', async () => {
      const invalidInput = {
        htmlResults: null,
        jsxResults: [],
      } as any;
      
      await expect(consolidator.consolidate(invalidInput)).rejects.toThrow(ConsolidationError);
    });

    test('should throw error for empty results', async () => {
      const emptyInput: PatternAnalysisInput = {
        htmlResults: [],
        jsxResults: [],
      };
      
      await expect(consolidator.consolidate(emptyInput)).rejects.toThrow(ConsolidationError);
    });
  });

  describe('pattern extraction and normalization', () => {
    beforeEach(() => {
      const mockFrequencyMap = new Map<string, AggregatedClassData>();
      mockFrequencyMap.set('btn-primary', {
        name: 'btn-primary',
        totalFrequency: 5,
        htmlFrequency: 3,
        jsxFrequency: 2,
        sources: {
          sourceType: 'mixed',
          filePaths: ['test.html', 'test.jsx'],
          frameworks: new Set(['react']),
          extractionTypes: new Set(['static']),
        },
        contexts: {
          html: [{
            tagName: 'button',
            attributes: { class: 'btn-primary' },
            depth: 1,
            filePath: 'test.html',
          }],
          jsx: [{
            pattern: 'className="btn-primary"',
            lineNumber: 10,
            framework: 'react',
            extractionType: 'static',
            filePath: 'test.jsx',
          }],
        },
        patterns: {
          prefixes: ['btn'],
          modifiers: ['primary'],
          variants: [],
        },
        coOccurrences: new Map(),
      });

      mockAnalyzePatterns.mockResolvedValue({
        frequencyMap: mockFrequencyMap,
        totalClasses: 1,
        uniqueClasses: 1,
        totalFiles: 2,
        patternGroups: [],
        coOccurrencePatterns: [],
        frameworkAnalysis: [],
        metadata: {
          processedAt: new Date(),
          processingTime: 100,
          options: {},
          sources: {
            htmlFiles: 1,
            jsxFiles: 1,
            totalExtractionResults: 2,
          },
          statistics: {
            averageFrequency: 5,
            medianFrequency: 5,
            mostFrequentClass: { name: 'btn-primary', frequency: 5 },
            leastFrequentClass: { name: 'btn-primary', frequency: 5 },
            classesAboveThreshold: 1,
            classesBelowThreshold: 0,
          },
          errors: [],
        },
      });
    });

    test('should process HTML and JSX results', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 3,
            contexts: [{
              tagName: 'button',
              attributes: { class: 'btn-primary' },
              depth: 1,
            }],
          }]]),
          metadata: { source: 'test.html' },
        }],
        jsxResults: [{
          classes: new Map([['btn-primary', {
            frequency: 2,
            contexts: [{
              pattern: 'className="btn-primary"',
              lineNumber: 10,
              extractionType: 'static',
            }],
          }]]),
          metadata: { source: 'test.jsx' },
          framework: 'react',
        }],
      };

      const result = await consolidator.consolidate(input);

      expect(result.patterns.size).toBeGreaterThan(0);
      expect(result.statistics.totalPatternsFound).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should normalize patterns correctly', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['Btn-Primary', { // Mixed case
            frequency: 5,
            contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
          }]]),
          metadata: { source: 'test.html' },
        }],
        jsxResults: [],
      };

      const result = await consolidator.consolidate(input);

      // Check that case normalization occurred
      const normalizedKeys = Array.from(result.patterns.keys());
      expect(normalizedKeys.some(key => key.includes('btn-primary'))).toBe(true);
    });

    test('should generate unique identifiers', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([
            ['btn-primary', { frequency: 5, contexts: [{ tagName: 'button', attributes: {}, depth: 1 }] }],
            ['btn-secondary', { frequency: 3, contexts: [{ tagName: 'button', attributes: {}, depth: 1 }] }],
          ]),
          metadata: { source: 'test.html' },
        }],
        jsxResults: [],
      };

      // Mock frequency map with multiple items
      const mockFrequencyMap = new Map<string, AggregatedClassData>();
      ['btn-primary', 'btn-secondary'].forEach(className => {
        mockFrequencyMap.set(className, {
          name: className,
          totalFrequency: 4,
          htmlFrequency: 4,
          jsxFrequency: 0,
          sources: {
            sourceType: 'html',
            filePaths: ['test.html'],
            frameworks: new Set(),
            extractionTypes: new Set(['static']),
          },
          contexts: { html: [], jsx: [] },
          patterns: { prefixes: [], modifiers: [], variants: [] },
          coOccurrences: new Map(),
        });
      });

      mockAnalyzePatterns.mockResolvedValue({
        frequencyMap: mockFrequencyMap,
        totalClasses: 2,
        uniqueClasses: 2,
        totalFiles: 1,
        patternGroups: [],
        coOccurrencePatterns: [],
        frameworkAnalysis: [],
        metadata: {
          processedAt: new Date(),
          processingTime: 100,
          options: {},
          sources: { htmlFiles: 1, jsxFiles: 0, totalExtractionResults: 1 },
          statistics: {
            averageFrequency: 4,
            medianFrequency: 4,
            mostFrequentClass: null,
            leastFrequentClass: null,
            classesAboveThreshold: 2,
            classesBelowThreshold: 0,
          },
          errors: [],
        },
      });

      const result = await consolidator.consolidate(input);

      // Check that identifiers are unique
      const identifiers = Array.from(result.identifierMappings.values());
      const uniqueIdentifiers = new Set(identifiers);
      expect(identifiers.length).toBe(uniqueIdentifiers.size);
    });
  });

  describe('file modification', () => {
    beforeEach(() => {
      mockFs.readFile.mockResolvedValue('<button class="btn-primary">Click me</button>');
    });

    test('should prepare HTML file modifications', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 3,
            contexts: [{ tagName: 'button', attributes: { class: 'btn-primary' }, depth: 1 }],
          }]]),
          metadata: { source: '/test.html' },
        }],
        jsxResults: [],
      };

      const result = await consolidator.consolidate(input);

      expect(result.fileModifications.length).toBeGreaterThan(0);
      const htmlMod = result.fileModifications.find(mod => mod.filePath === '/test.html');
      expect(htmlMod).toBeDefined();
      expect(htmlMod?.replacements.length).toBeGreaterThan(0);
    });

    test('should prepare JSX file modifications', async () => {
      mockFs.readFile.mockResolvedValue('function Button() { return <button className="btn-primary">Click</button>; }');

      const input: PatternAnalysisInput = {
        htmlResults: [],
        jsxResults: [{
          classes: new Map([['btn-primary', {
            frequency: 2,
            contexts: [{
              pattern: 'className="btn-primary"',
              lineNumber: 1,
              extractionType: 'static',
            }],
          }]]),
          metadata: { source: '/test.jsx' },
          framework: 'react',
        }],
      };

      const result = await consolidator.consolidate(input);

      expect(result.fileModifications.length).toBeGreaterThan(0);
      const jsxMod = result.fileModifications.find(mod => mod.filePath === '/test.jsx');
      expect(jsxMod).toBeDefined();
      expect(jsxMod?.replacements.length).toBeGreaterThan(0);
    });

    test('should handle template literals in JSX', async () => {
      mockFs.readFile.mockResolvedValue('const classes = `btn-primary ${active ? "active" : ""}`;');

      const input: PatternAnalysisInput = {
        htmlResults: [],
        jsxResults: [{
          classes: new Map([['btn-primary', {
            frequency: 1,
            contexts: [{
              pattern: '`btn-primary ${active ? "active" : ""}`',
              lineNumber: 1,
              extractionType: 'template',
            }],
          }]]),
          metadata: { source: '/test.jsx' },
          framework: 'react',
        }],
      };

      const result = await consolidator.consolidate(input);

      const jsxMod = result.fileModifications.find(mod => mod.filePath === '/test.jsx');
      expect(jsxMod?.modifiedContent).toContain('`a ${active ? "active" : ""}`'); // 'a' is first identifier
    });

    test('should handle utility functions in JSX', async () => {
      mockFs.readFile.mockResolvedValue('const classes = clsx("btn-primary", { active });');

      const input: PatternAnalysisInput = {
        htmlResults: [],
        jsxResults: [{
          classes: new Map([['btn-primary', {
            frequency: 1,
            contexts: [{
              pattern: 'clsx("btn-primary", { active })',
              lineNumber: 1,
              extractionType: 'utility',
            }],
          }]]),
          metadata: { source: '/test.jsx' },
          framework: 'react',
        }],
      };

      const result = await consolidator.consolidate(input);

      const jsxMod = result.fileModifications.find(mod => mod.filePath === '/test.jsx');
      expect(jsxMod?.modifiedContent).toContain('clsx("a"'); // Should replace with identifier
    });
  });

  describe('atomic file operations', () => {
    test('should apply modifications atomically when enabled', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 3,
            contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
          }]]),
          metadata: { source: '/test.html' },
        }],
        jsxResults: [],
      };

      mockFs.readFile.mockResolvedValue('<button class="btn-primary">Click</button>');
      mockAtomicWriter.writeFile.mockResolvedValue(undefined);

      await consolidator.consolidate(input);

      expect(mockAtomicWriter.writeFile).toHaveBeenCalled();
    });

    test('should create backups when enabled', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 3,
            contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
          }]]),
          metadata: { source: '/test.html' },
        }],
        jsxResults: [],
      };

      mockFs.readFile.mockResolvedValue('<button class="btn-primary">Click</button>');
      mockFs.copyFile.mockResolvedValue(undefined);
      mockAtomicWriter.writeFile.mockResolvedValue(undefined);

      await consolidator.consolidate(input);

      expect(mockFs.copyFile).toHaveBeenCalled();
    });

    test('should rollback on atomic write failure', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 3,
            contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
          }]]),
          metadata: { source: '/test.html' },
        }],
        jsxResults: [],
      };

      mockFs.readFile.mockResolvedValue('<button class="btn-primary">Click</button>');
      mockAtomicWriter.writeFile.mockRejectedValue(new Error('Write failed'));
      mockFs.copyFile.mockResolvedValue(undefined);

      await expect(consolidator.consolidate(input)).rejects.toThrow(ConsolidationError);
      expect(mockFs.copyFile).toHaveBeenCalled(); // Backup creation
    });
  });

  describe('statistics and reporting', () => {
    test('should generate comprehensive statistics', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 3,
            contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
          }]]),
          metadata: { source: '/test.html' },
        }],
        jsxResults: [],
      };

      mockFs.readFile.mockResolvedValue('<button class="btn-primary">Click</button>');

      const result = await consolidator.consolidate(input);

      expect(result.statistics.totalPatternsFound).toBeDefined();
      expect(result.statistics.totalPatternsConsolidated).toBeDefined();
      expect(result.statistics.totalFilesModified).toBeDefined();
      expect(result.statistics.totalReplacements).toBeDefined();
      expect(result.statistics.processingTime).toBeGreaterThan(0);
      expect(result.statistics.dataStructureStats).toBeDefined();
    });

    test('should track memory usage', async () => {
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 3,
            contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
          }]]),
          metadata: { source: '/test.html' },
        }],
        jsxResults: [],
      };

      const result = await consolidator.consolidate(input);

      expect(result.statistics.memoryUsage).toBeDefined();
      expect(result.statistics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    test('should handle pattern analysis errors gracefully', async () => {
      mockAnalyzePatterns.mockRejectedValue(new Error('Analysis failed'));

      const input: PatternAnalysisInput = {
        htmlResults: [{ classes: new Map(), metadata: { source: 'test.html' } }],
        jsxResults: [],
      };

      await expect(consolidator.consolidate(input)).rejects.toThrow(ConsolidationError);
    });

    test('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 3,
            contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
          }]]),
          metadata: { source: '/nonexistent.html' },
        }],
        jsxResults: [],
      };

      await expect(consolidator.consolidate(input)).rejects.toThrow(ConsolidationError);
    });

    test('should collect and report errors', async () => {
      // Create a scenario that would produce warnings but not fail
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['btn-primary', {
            frequency: 1, // Below minimum frequency threshold
            contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
          }]]),
          metadata: { source: 'test.html' },
        }],
        jsxResults: [],
      };

      // Mock to simulate memory pressure
      const consolidatorWithSmallMemory = new CompleteConsolidator({
        dataStructureConfig: { maxEntries: 1 },
      });

      const result = await consolidatorWithSmallMemory.consolidate(input);

      // Should complete but may have warnings
      expect(result.warnings).toBeDefined();
    });
  });

  describe('memory pressure handling', () => {
    test('should detect and warn about memory pressure', async () => {
      const smallMemoryConsolidator = new CompleteConsolidator({
        dataStructureConfig: {
          maxEntries: 10, // Very small limit
        },
      });

      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map(Array.from({ length: 50 }, (_, i) => [
            `class-${i}`,
            { frequency: 5, contexts: [{ tagName: 'div', attributes: {}, depth: 1 }] }
          ])),
          metadata: { source: 'test.html' },
        }],
        jsxResults: [],
      };

      // Mock large frequency map
      const largeFrequencyMap = new Map<string, AggregatedClassData>();
      for (let i = 0; i < 50; i++) {
        largeFrequencyMap.set(`class-${i}`, {
          name: `class-${i}`,
          totalFrequency: 5,
          htmlFrequency: 5,
          jsxFrequency: 0,
          sources: {
            sourceType: 'html',
            filePaths: ['test.html'],
            frameworks: new Set(),
            extractionTypes: new Set(['static']),
          },
          contexts: { html: [], jsx: [] },
          patterns: { prefixes: [], modifiers: [], variants: [] },
          coOccurrences: new Map(),
        });
      }

      mockAnalyzePatterns.mockResolvedValue({
        frequencyMap: largeFrequencyMap,
        totalClasses: 50,
        uniqueClasses: 50,
        totalFiles: 1,
        patternGroups: [],
        coOccurrencePatterns: [],
        frameworkAnalysis: [],
        metadata: {
          processedAt: new Date(),
          processingTime: 100,
          options: {},
          sources: { htmlFiles: 1, jsxFiles: 0, totalExtractionResults: 1 },
          statistics: {
            averageFrequency: 5,
            medianFrequency: 5,
            mostFrequentClass: null,
            leastFrequentClass: null,
            classesAboveThreshold: 50,
            classesBelowThreshold: 0,
          },
          errors: [],
        },
      });

      const result = await smallMemoryConsolidator.consolidate(input);

      // Should have warnings about memory pressure
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Memory pressure'))).toBe(true);
    });
  });
});

describe('Factory Functions', () => {
  test('createCompleteConsolidator should create instance with options', () => {
    const options: Partial<CompleteConsolidatorOptions> = {
      minimumFrequency: 5,
      caseSensitive: true,
    };

    const consolidator = createCompleteConsolidator(options);

    expect(consolidator).toBeInstanceOf(CompleteConsolidator);
  });

  test('quickConsolidate should process input quickly', async () => {
    const input: PatternAnalysisInput = {
      htmlResults: [{
        classes: new Map([['btn-primary', {
          frequency: 3,
          contexts: [{ tagName: 'button', attributes: {}, depth: 1 }],
        }]]),
        metadata: { source: 'test.html' },
      }],
      jsxResults: [],
    };

    // Mock analyze patterns for quick consolidate
    mockAnalyzePatterns.mockResolvedValue({
      frequencyMap: new Map([['btn-primary', {
        name: 'btn-primary',
        totalFrequency: 3,
        htmlFrequency: 3,
        jsxFrequency: 0,
        sources: {
          sourceType: 'html',
          filePaths: ['test.html'],
          frameworks: new Set(),
          extractionTypes: new Set(['static']),
        },
        contexts: { html: [], jsx: [] },
        patterns: { prefixes: [], modifiers: [], variants: [] },
        coOccurrences: new Map(),
      }]]),
      totalClasses: 1,
      uniqueClasses: 1,
      totalFiles: 1,
      patternGroups: [],
      coOccurrencePatterns: [],
      frameworkAnalysis: [],
      metadata: {
        processedAt: new Date(),
        processingTime: 50,
        options: {},
        sources: { htmlFiles: 1, jsxFiles: 0, totalExtractionResults: 1 },
        statistics: {
          averageFrequency: 3,
          medianFrequency: 3,
          mostFrequentClass: { name: 'btn-primary', frequency: 3 },
          leastFrequentClass: { name: 'btn-primary', frequency: 3 },
          classesAboveThreshold: 1,
          classesBelowThreshold: 0,
        },
        errors: [],
      },
    });

    const result = await quickConsolidate(input);

    expect(result).toBeDefined();
    expect(result.patterns.size).toBeGreaterThan(0);
  });
});

describe('Configuration', () => {
  test('should use default options when none provided', () => {
    const consolidator = new CompleteConsolidator();
    expect(consolidator).toBeInstanceOf(CompleteConsolidator);
  });

  test('should merge custom options with defaults', () => {
    const customOptions: Partial<CompleteConsolidatorOptions> = {
      minimumFrequency: 10,
      enableValidation: true,
      sortBy: 'alphabetical',
    };

    const consolidator = new CompleteConsolidator(customOptions);
    expect(consolidator).toBeInstanceOf(CompleteConsolidator);
  });

  test('should handle data structure configuration', () => {
    const options: Partial<CompleteConsolidatorOptions> = {
      dataStructureConfig: {
        maxEntries: 500,
        enableLRUEviction: false,
        patternCacheSize: 100,
      },
    };

    const consolidator = new CompleteConsolidator(options);
    expect(consolidator).toBeInstanceOf(CompleteConsolidator);
  });
});

describe('Edge Cases', () => {
  test('should handle empty class names', async () => {
    const input: PatternAnalysisInput = {
      htmlResults: [{
        classes: new Map([['', { frequency: 1, contexts: [] }]]),
        metadata: { source: 'test.html' },
      }],
      jsxResults: [],
    };

    mockAnalyzePatterns.mockResolvedValue({
      frequencyMap: new Map(),
      totalClasses: 0,
      uniqueClasses: 0,
      totalFiles: 1,
      patternGroups: [],
      coOccurrencePatterns: [],
      frameworkAnalysis: [],
      metadata: {
        processedAt: new Date(),
        processingTime: 10,
        options: {},
        sources: { htmlFiles: 1, jsxFiles: 0, totalExtractionResults: 1 },
        statistics: {
          averageFrequency: 0,
          medianFrequency: 0,
          mostFrequentClass: null,
          leastFrequentClass: null,
          classesAboveThreshold: 0,
          classesBelowThreshold: 0,
        },
        errors: [],
      },
    });

    const result = await consolidator.consolidate(input);
    expect(result.patterns.size).toBe(0);
  });

  test('should handle special characters in class names', async () => {
    const input: PatternAnalysisInput = {
      htmlResults: [{
        classes: new Map([['class-with-special@chars#123', {
          frequency: 3,
          contexts: [{ tagName: 'div', attributes: {}, depth: 1 }],
        }]]),
        metadata: { source: 'test.html' },
      }],
      jsxResults: [],
    };

    // Should not throw errors
    const result = await consolidator.consolidate(input);
    expect(result).toBeDefined();
  });

  test('should handle very long class names', async () => {
    const longClassName = 'very-long-class-name-'.repeat(20);
    const input: PatternAnalysisInput = {
      htmlResults: [{
        classes: new Map([[longClassName, {
          frequency: 2,
          contexts: [{ tagName: 'div', attributes: {}, depth: 1 }],
        }]]),
        metadata: { source: 'test.html' },
      }],
      jsxResults: [],
    };

    // Should handle long names gracefully
    const result = await consolidator.consolidate(input);
    expect(result).toBeDefined();
  });

  test('should handle identifier generation overflow', async () => {
    const consolidatorWithShortIds = new CompleteConsolidator({
      identifierOptions: {
        base: 2, // Binary
        startLength: 1,
        maxLength: 2, // Very short
        prefix: '',
      },
    });

    // Create many patterns to potentially overflow identifier space
    const manyClasses = new Map();
    for (let i = 0; i < 10; i++) {
      manyClasses.set(`class-${i}`, {
        frequency: 3,
        contexts: [{ tagName: 'div', attributes: {}, depth: 1 }],
      });
    }

    const input: PatternAnalysisInput = {
      htmlResults: [{ classes: manyClasses, metadata: { source: 'test.html' } }],
      jsxResults: [],
    };

    // Mock large frequency map
    const largeFrequencyMap = new Map<string, AggregatedClassData>();
    for (let i = 0; i < 10; i++) {
      largeFrequencyMap.set(`class-${i}`, {
        name: `class-${i}`,
        totalFrequency: 3,
        htmlFrequency: 3,
        jsxFrequency: 0,
        sources: {
          sourceType: 'html',
          filePaths: ['test.html'],
          frameworks: new Set(),
          extractionTypes: new Set(['static']),
        },
        contexts: { html: [], jsx: [] },
        patterns: { prefixes: [], modifiers: [], variants: [] },
        coOccurrences: new Map(),
      });
    }

    mockAnalyzePatterns.mockResolvedValue({
      frequencyMap: largeFrequencyMap,
      totalClasses: 10,
      uniqueClasses: 10,
      totalFiles: 1,
      patternGroups: [],
      coOccurrencePatterns: [],
      frameworkAnalysis: [],
      metadata: {
        processedAt: new Date(),
        processingTime: 100,
        options: {},
        sources: { htmlFiles: 1, jsxFiles: 0, totalExtractionResults: 1 },
        statistics: {
          averageFrequency: 3,
          medianFrequency: 3,
          mostFrequentClass: null,
          leastFrequentClass: null,
          classesAboveThreshold: 10,
          classesBelowThreshold: 0,
        },
        errors: [],
      },
    });

    // Should handle gracefully, potentially with longer identifiers
    const result = await consolidatorWithShortIds.consolidate(input);
    expect(result.patterns.size).toBeGreaterThan(0);
  });
});

describe('ConsolidationError', () => {
  test('should create error with message and cause', () => {
    const cause = new Error('Original error');
    const error = new ConsolidationError('Consolidation failed', cause);

    expect(error.message).toBe('Consolidation failed');
    expect(error.cause).toBe(cause);
    expect(error.name).toBe('ConsolidationError');
  });

  test('should create error without cause', () => {
    const error = new ConsolidationError('Consolidation failed');

    expect(error.message).toBe('Consolidation failed');
    expect(error.cause).toBeUndefined();
    expect(error.name).toBe('ConsolidationError');
  });
});