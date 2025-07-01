/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  CompleteConsolidator,
  createCompleteConsolidator,
  quickConsolidate,
} from '../completeConsolidator';
import {
  DataStructureManager,
  createDataStructureManager,
} from '../dataStructures';
import type { PatternAnalysisInput } from '../../processors/patternAnalysis';

// Create temporary test directory
const createTempDir = async (): Promise<string> => {
  const tempDir = join(tmpdir(), `tw-enigma-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
};

// Clean up test directory
const cleanupTempDir = async (dir: string): Promise<void> => {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
};

describe('Integration Tests - Complete Optimization Pipeline', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('End-to-End Pattern Extraction and Consolidation', () => {
    test('should process complete HTML and JSX workflow', async () => {
      // Create test files
      const htmlFile = join(tempDir, 'test.html');
      const jsxFile = join(tempDir, 'test.jsx');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <body>
            <div class="container mx-auto px-4">
              <button class="btn btn-primary px-4 py-2">Primary Button</button>
              <button class="btn btn-secondary px-4 py-2">Secondary Button</button>
              <div class="card shadow-lg rounded-lg p-6">
                <h2 class="text-2xl font-bold mb-4">Card Title</h2>
                <p class="text-gray-600 mb-4">Card content goes here.</p>
                <button class="btn btn-primary">Action</button>
              </div>
            </div>
          </body>
        </html>
      `;

      const jsxContent = `
        import React from 'react';
        import clsx from 'clsx';

        function Component({ active, disabled }) {
          const buttonClass = clsx(
            'btn btn-primary px-4 py-2',
            {
              'opacity-50': disabled,
              'ring-2 ring-blue-500': active
            }
          );

          return (
            <div className="container mx-auto px-4">
              <button className={buttonClass}>
                Dynamic Button
              </button>
              <div className={\`card shadow-lg rounded-lg p-6 \${active ? 'active' : ''}\`}>
                <h2 className="text-2xl font-bold mb-4">JSX Card</h2>
                <button className="btn btn-secondary px-4 py-2">
                  Secondary Action
                </button>
              </div>
            </div>
          );
        }

        export default Component;
      `;

      await fs.writeFile(htmlFile, htmlContent);
      await fs.writeFile(jsxFile, jsxContent);

      // Create mock extraction results
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([
            ['container', { frequency: 2, contexts: [{ tagName: 'div', attributes: {}, depth: 1 }] }],
            ['mx-auto', { frequency: 2, contexts: [{ tagName: 'div', attributes: {}, depth: 1 }] }],
            ['px-4', { frequency: 5, contexts: [{ tagName: 'div', attributes: {}, depth: 1 }] }],
            ['btn', { frequency: 3, contexts: [{ tagName: 'button', attributes: {}, depth: 1 }] }],
            ['btn-primary', { frequency: 2, contexts: [{ tagName: 'button', attributes: {}, depth: 1 }] }],
            ['btn-secondary', { frequency: 1, contexts: [{ tagName: 'button', attributes: {}, depth: 1 }] }],
            ['py-2', { frequency: 2, contexts: [{ tagName: 'button', attributes: {}, depth: 1 }] }],
            ['card', { frequency: 1, contexts: [{ tagName: 'div', attributes: {}, depth: 1 }] }],
            ['shadow-lg', { frequency: 1, contexts: [{ tagName: 'div', attributes: {}, depth: 1 }] }],
            ['rounded-lg', { frequency: 1, contexts: [{ tagName: 'div', attributes: {}, depth: 1 }] }],
            ['p-6', { frequency: 1, contexts: [{ tagName: 'div', attributes: {}, depth: 1 }] }],
            ['text-2xl', { frequency: 1, contexts: [{ tagName: 'h2', attributes: {}, depth: 1 }] }],
            ['font-bold', { frequency: 1, contexts: [{ tagName: 'h2', attributes: {}, depth: 1 }] }],
            ['mb-4', { frequency: 2, contexts: [{ tagName: 'h2', attributes: {}, depth: 1 }] }],
            ['text-gray-600', { frequency: 1, contexts: [{ tagName: 'p', attributes: {}, depth: 1 }] }],
          ]),
          metadata: { source: htmlFile },
        }],
        jsxResults: [{
          classes: new Map([
            ['container', { frequency: 1, contexts: [{ pattern: 'className="container mx-auto px-4"', lineNumber: 12, extractionType: 'static' }] }],
            ['mx-auto', { frequency: 1, contexts: [{ pattern: 'className="container mx-auto px-4"', lineNumber: 12, extractionType: 'static' }] }],
            ['px-4', { frequency: 3, contexts: [{ pattern: 'className="container mx-auto px-4"', lineNumber: 12, extractionType: 'static' }] }],
            ['btn', { frequency: 2, contexts: [{ pattern: 'clsx("btn btn-primary px-4 py-2")', lineNumber: 6, extractionType: 'utility' }] }],
            ['btn-primary', { frequency: 1, contexts: [{ pattern: 'clsx("btn btn-primary px-4 py-2")', lineNumber: 6, extractionType: 'utility' }] }],
            ['btn-secondary', { frequency: 1, contexts: [{ pattern: 'className="btn btn-secondary px-4 py-2"', lineNumber: 20, extractionType: 'static' }] }],
            ['py-2', { frequency: 2, contexts: [{ pattern: 'clsx("btn btn-primary px-4 py-2")', lineNumber: 6, extractionType: 'utility' }] }],
            ['opacity-50', { frequency: 1, contexts: [{ pattern: 'clsx({"opacity-50": disabled})', lineNumber: 8, extractionType: 'utility' }] }],
            ['ring-2', { frequency: 1, contexts: [{ pattern: 'clsx({"ring-2 ring-blue-500": active})', lineNumber: 9, extractionType: 'utility' }] }],
            ['ring-blue-500', { frequency: 1, contexts: [{ pattern: 'clsx({"ring-2 ring-blue-500": active})', lineNumber: 9, extractionType: 'utility' }] }],
            ['card', { frequency: 1, contexts: [{ pattern: '`card shadow-lg rounded-lg p-6 ${active ? "active" : ""}`', lineNumber: 16, extractionType: 'template' }] }],
            ['shadow-lg', { frequency: 1, contexts: [{ pattern: '`card shadow-lg rounded-lg p-6 ${active ? "active" : ""}`', lineNumber: 16, extractionType: 'template' }] }],
            ['rounded-lg', { frequency: 1, contexts: [{ pattern: '`card shadow-lg rounded-lg p-6 ${active ? "active" : ""}`', lineNumber: 16, extractionType: 'template' }] }],
            ['p-6', { frequency: 1, contexts: [{ pattern: '`card shadow-lg rounded-lg p-6 ${active ? "active" : ""}`', lineNumber: 16, extractionType: 'template' }] }],
            ['text-2xl', { frequency: 1, contexts: [{ pattern: 'className="text-2xl font-bold mb-4"', lineNumber: 17, extractionType: 'static' }] }],
            ['font-bold', { frequency: 1, contexts: [{ pattern: 'className="text-2xl font-bold mb-4"', lineNumber: 17, extractionType: 'static' }] }],
            ['mb-4', { frequency: 1, contexts: [{ pattern: 'className="text-2xl font-bold mb-4"', lineNumber: 17, extractionType: 'static' }] }],
          ]),
          metadata: { source: jsxFile },
          framework: 'react',
        }],
      };

      // Test with different consolidation options
      const consolidator = createCompleteConsolidator({
        minimumFrequency: 2,
        enableCoOccurrenceAnalysis: true,
        enableAtomicWrites: false, // Disable for test
        caseSensitive: false,
        sortBy: 'frequency',
        sortDirection: 'desc',
        dataStructureConfig: {
          maxEntries: 1000,
          enableCoOccurrenceTracking: true,
          patternCacheSize: 100,
        },
      });

      const result = await consolidator.consolidate(input);

      // Verify results
      expect(result.patterns.size).toBeGreaterThan(0);
      expect(result.statistics.totalPatternsFound).toBeGreaterThan(0);
      expect(result.statistics.totalPatternsConsolidated).toBeGreaterThan(0);
      expect(result.statistics.processingTime).toBeGreaterThan(0);
      expect(result.statistics.dataStructureStats).toBeDefined();

      // Verify identifier generation
      expect(result.identifierMappings.size).toBeGreaterThan(0);
      const identifiers = Array.from(result.identifierMappings.values());
      const uniqueIdentifiers = new Set(identifiers);
      expect(identifiers.length).toBe(uniqueIdentifiers.size);

      // Verify file modifications were prepared
      expect(result.fileModifications.length).toBe(2); // HTML and JSX files
      
      const htmlMod = result.fileModifications.find(mod => mod.filePath === htmlFile);
      const jsxMod = result.fileModifications.find(mod => mod.filePath === jsxFile);
      
      expect(htmlMod).toBeDefined();
      expect(jsxMod).toBeDefined();
      expect(htmlMod!.replacements.length).toBeGreaterThan(0);
      expect(jsxMod!.replacements.length).toBeGreaterThan(0);

      // Verify co-occurrence analysis was performed
      expect(result.statistics.dataStructureStats?.coOccurrenceMatrix.uniquePatterns).toBeGreaterThan(0);
    });

    test('should handle large-scale pattern analysis efficiently', async () => {
      // Generate large dataset
      const generateLargeClasses = (count: number) => {
        const classes = new Map();
        for (let i = 0; i < count; i++) {
          classes.set(`class-${i}`, {
            frequency: Math.floor(Math.random() * 10) + 1,
            contexts: [{ tagName: 'div', attributes: {}, depth: 1 }],
          });
        }
        return classes;
      };

      const largeInput: PatternAnalysisInput = {
        htmlResults: [
          { classes: generateLargeClasses(500), metadata: { source: join(tempDir, 'large1.html') } },
          { classes: generateLargeClasses(500), metadata: { source: join(tempDir, 'large2.html') } },
        ],
        jsxResults: [
          { 
            classes: generateLargeClasses(300), 
            metadata: { source: join(tempDir, 'large1.jsx') },
            framework: 'react',
          },
          { 
            classes: generateLargeClasses(300), 
            metadata: { source: join(tempDir, 'large2.jsx') },
            framework: 'react',
          },
        ],
      };

      // Create temporary files with dummy content
      for (const htmlResult of largeInput.htmlResults) {
        await fs.writeFile(htmlResult.metadata.source, '<div class="placeholder">Content</div>');
      }
      for (const jsxResult of largeInput.jsxResults) {
        await fs.writeFile(jsxResult.metadata.source, 'function Component() { return <div className="placeholder">Content</div>; }');
      }

      const startTime = Date.now();
      
      const consolidator = createCompleteConsolidator({
        minimumFrequency: 3,
        enableAtomicWrites: false,
        dataStructureConfig: {
          maxEntries: 10000,
          enableLRUEviction: true,
          memoryEfficientMode: true,
        },
      });

      const result = await consolidator.consolidate(largeInput);
      
      const duration = Date.now() - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.patterns.size).toBeGreaterThan(0);
      expect(result.statistics.dataStructureStats?.totalMemoryEstimateBytes).toBeDefined();
      
      // Memory usage should be reasonable
      const memoryMB = result.statistics.dataStructureStats!.totalMemoryEstimateBytes / (1024 * 1024);
      expect(memoryMB).toBeLessThan(100); // Less than 100MB
    });
  });

  describe('Data Structure Integration', () => {
    test('should demonstrate data structure performance characteristics', async () => {
      const manager = createDataStructureManager({
        maxEntries: 1000,
        enableCoOccurrenceTracking: true,
        patternCacheSize: 200,
      });

      // Add patterns with relationships
      const patterns = [
        'btn-primary', 'btn-secondary', 'btn-large', 'btn-small',
        'text-red-500', 'text-blue-500', 'text-green-500',
        'bg-white', 'bg-gray-100', 'bg-gray-200',
        'p-4', 'p-6', 'p-8', 'px-4', 'py-2',
        'rounded', 'rounded-lg', 'rounded-xl',
        'shadow', 'shadow-lg', 'shadow-xl',
      ];

      // Simulate realistic usage patterns
      for (let i = 0; i < 100; i++) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        const relatedPatterns = patterns
          .filter(p => p !== pattern && p.split('-')[0] === pattern.split('-')[0])
          .slice(0, 3);
        
        manager.addPattern(pattern, relatedPatterns);
      }

      // Test frequency counter performance
      const topPatterns = manager.frequencyCounter.getTopK(5);
      expect(topPatterns.length).toBeLessThanOrEqual(5);
      expect(topPatterns[0][1]).toBeGreaterThan(0);

      // Test trie performance
      const btnPatterns = manager.patternTrie.getByPrefix('btn');
      expect(btnPatterns.length).toBeGreaterThan(0);
      expect(btnPatterns.every(p => p.pattern.startsWith('btn'))).toBe(true);

      // Test co-occurrence analysis
      if (topPatterns.length > 0) {
        const analysis = manager.analyzePattern(topPatterns[0][0]);
        expect(analysis.frequency).toBeGreaterThan(0);
        expect(analysis.coOccurringPatterns).toBeDefined();
      }

      // Test memory management
      const stats = manager.getOverallStats();
      expect(stats.totalMemoryEstimateBytes).toBeGreaterThan(0);
      
      const memoryCheck = manager.checkMemoryPressure();
      expect(memoryCheck.isUnderPressure).toBeDefined();
      expect(memoryCheck.currentMemoryMB).toBeGreaterThan(0);
    });

    test('should handle concurrent operations safely', async () => {
      const manager = createDataStructureManager({
        maxEntries: 500,
        enableLRUEviction: true,
      });

      // Simulate concurrent pattern additions
      const operations = Array.from({ length: 100 }, (_, i) => 
        Promise.resolve().then(() => {
          manager.addPattern(`concurrent-pattern-${i % 20}`);
          return manager.analyzePattern(`concurrent-pattern-${(i + 5) % 20}`);
        })
      );

      const results = await Promise.all(operations);

      // Verify all operations completed
      expect(results).toHaveLength(100);
      expect(results.every(r => r.frequency >= 0)).toBe(true);

      // Verify data structure integrity
      const stats = manager.getOverallStats();
      expect(stats.frequencyCounter.mapEntries).toBeGreaterThan(0);
      expect(stats.patternTrie.patternCount).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from file system errors gracefully', async () => {
      const nonExistentDir = join(tempDir, 'nonexistent');
      
      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: new Map([['test-class', { frequency: 3, contexts: [] }]]),
          metadata: { source: join(nonExistentDir, 'missing.html') },
        }],
        jsxResults: [],
      };

      const consolidator = createCompleteConsolidator({
        enableAtomicWrites: false,
      });

      // Should handle missing files gracefully
      await expect(consolidator.consolidate(input)).rejects.toThrow();
    });

    test('should handle memory pressure scenarios', async () => {
      const consolidator = createCompleteConsolidator({
        dataStructureConfig: {
          maxEntries: 10, // Very small to trigger pressure
        },
      });

      // Generate more patterns than the limit
      const manyClasses = new Map();
      for (let i = 0; i < 50; i++) {
        manyClasses.set(`pattern-${i}`, {
          frequency: 2,
          contexts: [{ tagName: 'div', attributes: {}, depth: 1 }],
        });
      }

      const input: PatternAnalysisInput = {
        htmlResults: [{
          classes: manyClasses,
          metadata: { source: join(tempDir, 'test.html') },
        }],
        jsxResults: [],
      };

      // Create dummy file
      await fs.writeFile(join(tempDir, 'test.html'), '<div>test</div>');

      const result = await consolidator.consolidate(input);

      // Should complete with warnings about memory pressure
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Memory pressure'))).toBe(true);
    });

    test('should validate data structure consistency after errors', async () => {
      const manager = createDataStructureManager({
        maxEntries: 100,
      });

      // Add some initial data
      for (let i = 0; i < 10; i++) {
        manager.addPattern(`initial-${i}`);
      }

      const initialStats = manager.getOverallStats();

      // Simulate error conditions by adding invalid data
      try {
        // Add patterns that might cause issues
        manager.addPattern(''); // Empty pattern
        manager.addPattern('   '); // Whitespace only
        manager.addPattern('a'.repeat(1000)); // Very long pattern
      } catch (error) {
        // Some operations might throw, but structures should remain consistent
      }

      const finalStats = manager.getOverallStats();

      // Data structures should still be functional
      expect(finalStats.frequencyCounter.mapEntries).toBeGreaterThan(0);
      expect(finalStats.patternTrie.patternCount).toBeGreaterThan(0);
      
      // Should still be able to add new patterns
      manager.addPattern('recovery-test');
      expect(manager.frequencyCounter.get('recovery-test')).toBe(1);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet performance targets for typical workloads', async () => {
      const patterns = [
        'container', 'mx-auto', 'px-4', 'py-2', 'text-lg', 'font-bold',
        'bg-blue-500', 'text-white', 'rounded', 'shadow', 'hover:bg-blue-600',
        'focus:ring-2', 'focus:ring-blue-500', 'transition', 'duration-200',
        'flex', 'items-center', 'justify-center', 'space-x-2',
        'grid', 'grid-cols-3', 'gap-4', 'w-full', 'h-full',
      ];

      const generateRealisticClasses = (count: number) => {
        const classes = new Map();
        for (let i = 0; i < count; i++) {
          const pattern = patterns[Math.floor(Math.random() * patterns.length)];
          const existing = classes.get(pattern) || { frequency: 0, contexts: [] };
          classes.set(pattern, {
            frequency: existing.frequency + 1,
            contexts: [
              ...existing.contexts,
              { tagName: 'div', attributes: {}, depth: Math.floor(Math.random() * 5) + 1 }
            ],
          });
        }
        return classes;
      };

      const input: PatternAnalysisInput = {
        htmlResults: [
          { classes: generateRealisticClasses(200), metadata: { source: join(tempDir, 'perf1.html') } },
          { classes: generateRealisticClasses(200), metadata: { source: join(tempDir, 'perf2.html') } },
        ],
        jsxResults: [
          { 
            classes: generateRealisticClasses(150), 
            metadata: { source: join(tempDir, 'perf1.jsx') },
            framework: 'react',
          },
        ],
      };

      // Create test files
      await fs.writeFile(join(tempDir, 'perf1.html'), '<div class="container">Content</div>');
      await fs.writeFile(join(tempDir, 'perf2.html'), '<div class="container">Content</div>');
      await fs.writeFile(join(tempDir, 'perf1.jsx'), 'function App() { return <div className="container">Content</div>; }');

      const consolidator = createCompleteConsolidator({
        minimumFrequency: 2,
        enableCoOccurrenceAnalysis: true,
        enableAtomicWrites: false,
      });

      const startTime = process.hrtime.bigint();
      const result = await consolidator.consolidate(input);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1_000_000;

      // Performance targets
      expect(durationMs).toBeLessThan(5000); // Less than 5 seconds
      expect(result.statistics.processingTime).toBeLessThan(5000);
      
      // Memory usage should be reasonable
      const memoryMB = result.statistics.memoryUsage! / (1024 * 1024);
      expect(memoryMB).toBeLessThan(50); // Less than 50MB
      
      // Should process all unique patterns
      expect(result.patterns.size).toBeGreaterThan(0);
      expect(result.statistics.totalPatternsConsolidated).toBeLessThanOrEqual(patterns.length);
    });

    test('should scale linearly with input size', async () => {
      const testSizes = [50, 100, 200];
      const results: Array<{ size: number; time: number; memory: number }> = [];

      for (const size of testSizes) {
        const classes = new Map();
        for (let i = 0; i < size; i++) {
          classes.set(`class-${i}`, {
            frequency: Math.floor(Math.random() * 5) + 1,
            contexts: [{ tagName: 'div', attributes: {}, depth: 1 }],
          });
        }

        const input: PatternAnalysisInput = {
          htmlResults: [{ classes, metadata: { source: join(tempDir, `scale-${size}.html`) } }],
          jsxResults: [],
        };

        await fs.writeFile(join(tempDir, `scale-${size}.html`), '<div>Content</div>');

        const consolidator = createCompleteConsolidator({
          enableAtomicWrites: false,
          dataStructureConfig: { maxEntries: size * 2 },
        });

        const startTime = process.hrtime.bigint();
        const result = await consolidator.consolidate(input);
        const endTime = process.hrtime.bigint();

        const time = Number(endTime - startTime) / 1_000_000;
        const memory = result.statistics.memoryUsage! / (1024 * 1024);

        results.push({ size, time, memory });
      }

      // Verify roughly linear scaling
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        const sizeRatio = curr.size / prev.size;
        const timeRatio = curr.time / prev.time;
        
        // Time should scale roughly linearly (allow some variance)
        expect(timeRatio).toBeLessThan(sizeRatio * 2);
        expect(timeRatio).toBeGreaterThan(sizeRatio * 0.5);
      }
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle typical React application patterns', async () => {
      const reactPatterns = [
        // Layout
        'container', 'mx-auto', 'px-4', 'py-8',
        // Grid system
        'grid', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'gap-4', 'gap-6',
        // Flexbox
        'flex', 'flex-col', 'items-center', 'justify-between', 'space-y-4',
        // Typography
        'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl',
        'font-normal', 'font-medium', 'font-semibold', 'font-bold',
        // Colors
        'text-gray-600', 'text-gray-900', 'text-blue-600', 'text-red-500',
        'bg-white', 'bg-gray-50', 'bg-blue-500', 'bg-red-500',
        // Interactive states
        'hover:bg-blue-600', 'focus:ring-2', 'focus:ring-blue-500', 'focus:outline-none',
        // Borders and shadows
        'border', 'border-gray-300', 'rounded', 'rounded-lg', 'shadow', 'shadow-lg',
        // Spacing
        'p-4', 'p-6', 'px-4', 'py-2', 'm-4', 'mb-4', 'mt-8',
      ];

      const input: PatternAnalysisInput = {
        htmlResults: [],
        jsxResults: [{
          classes: new Map(reactPatterns.map(pattern => [
            pattern,
            {
              frequency: Math.floor(Math.random() * 10) + 2, // 2-11 frequency
              contexts: [{
                pattern: `className="${pattern}"`,
                lineNumber: Math.floor(Math.random() * 100) + 1,
                extractionType: 'static' as const,
              }],
            }
          ])),
          metadata: { source: join(tempDir, 'react-app.jsx') },
          framework: 'react',
        }],
      };

      await fs.writeFile(join(tempDir, 'react-app.jsx'), `
        function App() {
          return (
            <div className="container mx-auto px-4 py-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-xl font-bold mb-4">Card Title</h2>
                  <p className="text-gray-600">Card content</p>
                </div>
              </div>
            </div>
          );
        }
      `);

      const consolidator = createCompleteConsolidator({
        minimumFrequency: 2,
        enableCoOccurrenceAnalysis: true,
        enableAtomicWrites: false,
        dataStructureConfig: {
          enableCoOccurrenceTracking: true,
          maxCoOccurrenceDistance: 3,
        },
      });

      const result = await consolidator.consolidate(input);

      // Should identify common patterns
      expect(result.patterns.size).toBeGreaterThan(10);
      
      // Should find co-occurring patterns (e.g., layout patterns often used together)
      const stats = result.statistics.dataStructureStats!;
      expect(stats.coOccurrenceMatrix.uniquePatterns).toBeGreaterThan(0);
      expect(stats.coOccurrenceMatrix.totalCoOccurrences).toBeGreaterThan(0);

      // Should generate reasonable identifiers
      const identifiers = Array.from(result.identifierMappings.values());
      expect(identifiers.every(id => id.length <= 3)).toBe(true); // Short identifiers
      expect(identifiers.every(id => /^[a-z]+$/.test(id))).toBe(true); // Only lowercase letters
    });

    test('should optimize Tailwind CSS utility classes effectively', async () => {
      // Simulate a typical Tailwind project with utility-first approach
      const tailwindUtilities = [
        // Most commonly used utilities
        'w-full', 'h-full', 'flex', 'block', 'inline-block', 'hidden',
        'text-center', 'text-left', 'text-right',
        'font-bold', 'font-medium', 'font-normal',
        'text-lg', 'text-xl', 'text-2xl', 'text-sm',
        'p-4', 'p-6', 'px-4', 'py-2', 'mx-auto',
        'bg-white', 'bg-gray-100', 'bg-blue-500',
        'text-gray-600', 'text-gray-900', 'text-white',
        'border', 'rounded', 'shadow',
        // Less common but still frequent
        'container', 'grid', 'items-center', 'justify-center',
        'hover:bg-blue-600', 'focus:outline-none',
        'transition', 'duration-200', 'ease-in-out',
      ];

      const generateTailwindUsage = () => {
        const classes = new Map();
        
        // Simulate realistic frequency distribution
        tailwindUtilities.forEach((utility, index) => {
          // More common utilities have higher frequency
          const baseFrequency = Math.max(1, 20 - Math.floor(index / 3));
          const frequency = baseFrequency + Math.floor(Math.random() * 5);
          
          classes.set(utility, {
            frequency,
            contexts: Array.from({ length: Math.min(frequency, 5) }, (_, i) => ({
              tagName: ['div', 'span', 'button', 'a'][Math.floor(Math.random() * 4)],
              attributes: {},
              depth: Math.floor(Math.random() * 3) + 1,
            })),
          });
        });
        
        return classes;
      };

      const input: PatternAnalysisInput = {
        htmlResults: [
          { classes: generateTailwindUsage(), metadata: { source: join(tempDir, 'page1.html') } },
          { classes: generateTailwindUsage(), metadata: { source: join(tempDir, 'page2.html') } },
        ],
        jsxResults: [
          { 
            classes: generateTailwindUsage(), 
            metadata: { source: join(tempDir, 'components.jsx') },
            framework: 'react',
          },
        ],
      };

      // Create test files
      await fs.writeFile(join(tempDir, 'page1.html'), '<div class="w-full p-4 bg-white">Page 1</div>');
      await fs.writeFile(join(tempDir, 'page2.html'), '<div class="w-full p-4 bg-white">Page 2</div>');
      await fs.writeFile(join(tempDir, 'components.jsx'), '<div className="w-full p-4 bg-white">Component</div>');

      const consolidator = createCompleteConsolidator({
        minimumFrequency: 5, // Only optimize frequently used utilities
        caseSensitive: false,
        sortBy: 'frequency',
        sortDirection: 'desc',
        enableAtomicWrites: false,
      });

      const result = await consolidator.consolidate(input);

      // Should consolidate the most frequent utilities
      expect(result.patterns.size).toBeGreaterThan(5);
      
      // Most frequent patterns should get shortest identifiers
      const sortedPatterns = Array.from(result.patterns.entries())
        .sort((a, b) => b[1].frequency - a[1].frequency);
      
      if (sortedPatterns.length > 0) {
        expect(sortedPatterns[0][1].identifier).toMatch(/^[a-z]$/); // Single letter for most frequent
      }

      // Should significantly reduce the size of class strings
      const totalOriginalChars = Array.from(result.patterns.values())
        .reduce((sum, pattern) => sum + (pattern.original.length * pattern.frequency), 0);
      
      const totalOptimizedChars = Array.from(result.patterns.values())
        .reduce((sum, pattern) => sum + (pattern.identifier.length * pattern.frequency), 0);
      
      const savings = ((totalOriginalChars - totalOptimizedChars) / totalOriginalChars) * 100;
      expect(savings).toBeGreaterThan(50); // At least 50% savings
    });
  });
});