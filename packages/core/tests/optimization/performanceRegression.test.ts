/**
 * Performance regression tests for Task 7.6
 * 
 * These tests ensure that performance optimizations don't regress over time
 * and that the system maintains acceptable performance characteristics.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { createPerformanceMonitor } from '../../src/optimization/performanceMonitor';
import { aggregateExtractionResults } from '../../src/processors/patternAnalysis';
import type { PatternAnalysisInput } from '../../src/processors/patternAnalysis';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Performance baselines for regression testing
const PERFORMANCE_BASELINES = {
  smallDataset: {
    maxDuration: 100, // 100ms
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    maxEventLoopLag: 10, // 10ms
  },
  mediumDataset: {
    maxDuration: 500, // 500ms
    maxMemoryUsage: 200 * 1024 * 1024, // 200MB
    maxEventLoopLag: 20, // 20ms
  },
  largeDataset: {
    maxDuration: 2000, // 2s
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    maxEventLoopLag: 50, // 50ms
  },
};

// Test data generators
function generateSmallTestData(): PatternAnalysisInput {
  return {
    htmlResults: [
      {
        filePath: '/test/small.html',
        classes: new Map([
          ['btn-primary', { frequency: 5, contexts: [] }],
          ['text-center', { frequency: 3, contexts: [] }],
          ['flex', { frequency: 8, contexts: [] }],
        ]),
        totalElements: 20,
        processingTime: 10,
        extractionMethod: 'regex',
        metadata: {},
      },
    ],
    jsxResults: [
      {
        filePath: '/test/small.tsx',
        classes: new Map([
          ['btn-primary', { frequency: 3, matches: [] }],
          ['container', { frequency: 2, matches: [] }],
        ]),
        totalMatches: 15,
        processingTime: 8,
        framework: 'react',
        metadata: {},
      },
    ],
  };
}

function generateMediumTestData(): PatternAnalysisInput {
  const htmlClasses = new Map();
  const jsxClasses = new Map();
  
  // Generate 100 unique classes for medium dataset
  for (let i = 0; i < 100; i++) {
    const className = `class-${i}`;
    htmlClasses.set(className, { frequency: Math.floor(Math.random() * 10) + 1, contexts: [] });
    jsxClasses.set(className, { frequency: Math.floor(Math.random() * 8) + 1, matches: [] });
  }

  return {
    htmlResults: Array.from({ length: 5 }, (_, i) => ({
      filePath: `/test/medium-${i}.html`,
      classes: htmlClasses,
      totalElements: 200,
      processingTime: 25,
      extractionMethod: 'regex' as const,
      metadata: {},
    })),
    jsxResults: Array.from({ length: 3 }, (_, i) => ({
      filePath: `/test/medium-${i}.tsx`,
      classes: jsxClasses,
      totalMatches: 150,
      processingTime: 20,
      framework: 'react' as const,
      metadata: {},
    })),
  };
}

function generateLargeTestData(): PatternAnalysisInput {
  const htmlClasses = new Map();
  const jsxClasses = new Map();
  
  // Generate 1000 unique classes for large dataset
  for (let i = 0; i < 1000; i++) {
    const className = `class-${i}`;
    htmlClasses.set(className, { frequency: Math.floor(Math.random() * 50) + 1, contexts: [] });
    jsxClasses.set(className, { frequency: Math.floor(Math.random() * 30) + 1, matches: [] });
  }

  return {
    htmlResults: Array.from({ length: 20 }, (_, i) => ({
      filePath: `/test/large-${i}.html`,
      classes: htmlClasses,
      totalElements: 1000,
      processingTime: 100,
      extractionMethod: 'regex' as const,
      metadata: {},
    })),
    jsxResults: Array.from({ length: 15 }, (_, i) => ({
      filePath: `/test/large-${i}.tsx`,
      classes: jsxClasses,
      totalMatches: 800,
      processingTime: 80,
      framework: 'react' as const,
      metadata: {},
    })),
  };
}

describe('Performance Regression Tests', () => {
  let performanceMonitor: ReturnType<typeof createPerformanceMonitor>;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tw-enigma-perf-test-'));
    performanceMonitor = createPerformanceMonitor({
      enabled: true,
      enableGC: true,
      enableEventLoop: true,
      enableMemoryDetails: true,
      warningThresholds: {
        memoryUsageMB: 100,
        cpuUsagePercent: 80,
        eventLoopLagMs: 10,
        operationDurationMs: 100,
      },
    });
  });

  afterEach(async () => {
    // Clean up any ongoing sessions
    try {
      performanceMonitor.stopSession();
    } catch {
      // Session might already be stopped
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Pattern Analysis Performance', () => {
    it('should meet performance baselines for small datasets', async () => {
      const testData = generateSmallTestData();
      const baseline = PERFORMANCE_BASELINES.smallDataset;
      
      const sessionId = performanceMonitor.startSession('small-dataset-test');
      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      const result = await performanceMonitor.measureFunction(
        'aggregateSmallDataset',
        () => aggregateExtractionResults(testData),
        { datasetSize: 'small' }
      );

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const analysis = performanceMonitor.stopSession();

      const duration = endTime - startTime;
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      // Verify performance baselines
      expect(duration).toBeLessThan(baseline.maxDuration);
      expect(memoryUsed).toBeLessThan(baseline.maxMemoryUsage);
      expect(result.result.size).toBeGreaterThan(0);
      
      if (analysis) {
        expect(analysis.summary.eventLoopLag).toBeLessThan(baseline.maxEventLoopLag);
      }
    });

    it('should handle large CSS files efficiently', async () => {
      // Generate large CSS file with repeated patterns
      const patterns = [
        '.btn { padding: 8px 16px; }',
        '.button { padding: 8px 16px; }',
        '.m-4 { margin: 1rem; }',
        '.p-4 { padding: 1rem; }',
      ];

      const largeCSSContent = Array(1000)
        .fill(0)
        .map((_, i) => patterns.map(p => p.replace(/\./g, `.item-${i}-`)).join('\n'))
        .join('\n');

      await writeFile(join(tempDir, 'large.css'), largeCSSContent);

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const opportunityEngine = createOpportunityIdentificationEngine();
      const entities = [{ filePath: join(tempDir, 'large.css'), fileType: 'css' }];
      
      const result = await opportunityEngine.analyzeOpportunities(entities, {
        enablePatternDetection: true,
        sensitivity: 'low', // Use low sensitivity for large files
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const duration = endTime - startTime;
      const memoryUsed = endMemory - startMemory;

      // Performance assertions for large files
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // Should use less than 50MB
      expect(result.opportunities.length).toBeGreaterThan(0);
    });

    it('should scale linearly with file count', async () => {
      const fileCounts = [1, 5, 10];
      const performanceResults: Array<{ files: number; duration: number; memory: number }> = [];

      for (const fileCount of fileCounts) {
        const files = [];
        
        // Create test files
        for (let i = 0; i < fileCount; i++) {
          const content = `
            .test-${i} { color: red; }
            .btn-${i} { padding: 8px 16px; }
            .margin-${i} { margin: 1rem; }
          `;
          const filePath = join(tempDir, `test-${i}.css`);
          await writeFile(filePath, content);
          files.push({ filePath, fileType: 'css' });
        }

        const startTime = performance.now();
        const startMemory = process.memoryUsage().heapUsed;

        const opportunityEngine = createOpportunityIdentificationEngine();
        await opportunityEngine.analyzeOpportunities(files, {
          enablePatternDetection: true,
          sensitivity: 'medium',
        });

        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        
        performanceResults.push({
          files: fileCount,
          duration: endTime - startTime,
          memory: endMemory - startMemory,
        });
      }

      // Check that performance scales reasonably
      const firstResult = performanceResults[0];
      const lastResult = performanceResults[performanceResults.length - 1];
      
      // Duration should not increase exponentially
      const durationRatio = lastResult.duration / firstResult.duration;
      const fileRatio = lastResult.files / firstResult.files;
      
      expect(durationRatio).toBeLessThan(fileRatio * 2); // At most 2x linear growth
    });
  });

  describe('Multi-Pass Discovery Performance', () => {
    it('should complete multi-pass discovery within time limits', async () => {
      // Create CSS files with incremental patterns
      const baseCSS = `
        .container { max-width: 1200px; margin: 0 auto; }
        .btn { padding: 8px 16px; border-radius: 4px; }
      `;

      const updatedCSS = `
        .container { max-width: 1200px; margin: 0 auto; padding: 16px; }
        .btn { padding: 8px 16px; border-radius: 4px; }
        .btn-large { padding: 12px 24px; border-radius: 6px; }
      `;

      await writeFile(join(tempDir, 'base.css'), baseCSS);

      const discoveryEngine = createMultiPassDiscoveryEngine({
        maxPasses: 3,
        convergenceThreshold: 0.95,
        enableIncremental: true,
      });

      const startTime = performance.now();

      // First pass
      let entities = [{ filePath: join(tempDir, 'base.css'), fileType: 'css' }];
      await discoveryEngine.discoverPatterns(entities);

      // Update file and run second pass
      await writeFile(join(tempDir, 'base.css'), updatedCSS);
      await discoveryEngine.discoverPatterns(entities, { incremental: true });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should optimize memory usage in incremental updates', async () => {
      const initialCSS = Array(100).fill('.initial { color: red; }').join('\n');
      await writeFile(join(tempDir, 'incremental.css'), initialCSS);

      const discoveryEngine = createMultiPassDiscoveryEngine({
        maxPasses: 5,
        convergenceThreshold: 0.9,
        enableIncremental: true,
      });

      const entities = [{ filePath: join(tempDir, 'incremental.css'), fileType: 'css' }];

      // Initial discovery
      const initialMemory = process.memoryUsage().heapUsed;
      await discoveryEngine.discoverPatterns(entities);
      const afterInitialMemory = process.memoryUsage().heapUsed;

      // Multiple incremental updates
      for (let i = 0; i < 10; i++) {
        const updatedCSS = initialCSS + `\n.update-${i} { margin: ${i}px; }`;
        await writeFile(join(tempDir, 'incremental.css'), updatedCSS);
        await discoveryEngine.discoverPatterns(entities, { incremental: true });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const initialGrowth = afterInitialMemory - initialMemory;
      const totalGrowth = finalMemory - initialMemory;

      // Memory growth should be controlled in incremental updates
      expect(totalGrowth).toBeLessThan(initialGrowth * 3); // At most 3x the initial growth
    });
  });

  describe('Optimization Performance', () => {
    it('should optimize CSS within performance budgets', async () => {
      const unoptimizedCSS = `
        .duplicate-1 { padding: 8px 16px; margin: 4px; background: white; }
        .duplicate-2 { padding: 8px 16px; margin: 4px; background: white; }
        .duplicate-3 { padding: 8px 16px; margin: 4px; background: white; }
        .duplicate-4 { padding: 8px 16px; margin: 4px; background: white; }
        .duplicate-5 { padding: 8px 16px; margin: 4px; background: white; }
        
        .utility-1 { margin-top: 1rem; }
        .utility-2 { margin-top: 2rem; }
        .utility-3 { margin-top: 3rem; }
        .utility-4 { margin-top: 4rem; }
        .utility-5 { margin-top: 5rem; }
        
        .component-btn { border: 1px solid #ccc; padding: 10px; }
        .component-input { border: 1px solid #ccc; padding: 8px; }
        .component-select { border: 1px solid #ccc; padding: 6px; }
      `;

      await writeFile(join(tempDir, 'unoptimized.css'), unoptimizedCSS);

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const opportunityEngine = createOpportunityIdentificationEngine();
      const entities = [{ filePath: join(tempDir, 'unoptimized.css'), fileType: 'css' }];
      
      const result = await opportunityEngine.analyzeOpportunities(entities, {
        enablePatternDetection: true,
        enableOptimization: true,
        optimizationLevel: 'aggressive',
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const duration = endTime - startTime;
      const memoryUsed = endMemory - startMemory;

      // Performance and quality assertions
      expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
      expect(memoryUsed).toBeLessThan(20 * 1024 * 1024); // Should use less than 20MB
      expect(result.opportunities.length).toBeGreaterThan(0);
      
      // Should find consolidation opportunities
      const consolidationOpportunities = result.opportunities.filter(
        opp => opp.type === 'pattern-consolidation' || opp.type === 'code-deduplication'
      );
      expect(consolidationOpportunities.length).toBeGreaterThan(0);
    });

    it('should maintain performance with complex CSS structures', async () => {
      // Generate complex CSS with nested structures, media queries, etc.
      const complexCSS = `
        /* Base styles */
        .container { max-width: 1200px; margin: 0 auto; padding: 0 15px; }
        .row { display: flex; flex-wrap: wrap; margin: 0 -15px; }
        .col { flex: 1; padding: 0 15px; }
        
        /* Component variations */
        ${Array(50).fill(0).map((_, i) => `
          .btn-${i} { 
            padding: ${4 + i}px ${8 + i * 2}px; 
            background: hsl(${i * 7}, 70%, 50%);
            border-radius: ${2 + i}px;
          }
        `).join('')}
        
        /* Media queries */
        @media (max-width: 768px) {
          .container { padding: 0 10px; }
          .row { margin: 0 -10px; }
          .col { padding: 0 10px; }
          ${Array(20).fill(0).map((_, i) => `
            .btn-${i} { padding: ${2 + i}px ${4 + i}px; }
          `).join('')}
        }
        
        @media (max-width: 480px) {
          .container { padding: 0 5px; }
          ${Array(10).fill(0).map((_, i) => `
            .btn-${i} { padding: ${1 + i}px ${2 + i}px; }
          `).join('')}
        }
        
        /* Keyframe animations */
        ${Array(10).fill(0).map((_, i) => `
          @keyframes fadeIn${i} {
            from { opacity: 0; transform: translateY(${10 + i * 5}px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-${i} { animation: fadeIn${i} 0.${3 + i}s ease-out; }
        `).join('')}
      `;

      await writeFile(join(tempDir, 'complex.css'), complexCSS);

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const opportunityEngine = createOpportunityIdentificationEngine();
      const entities = [{ filePath: join(tempDir, 'complex.css'), fileType: 'css' }];
      
      const result = await opportunityEngine.analyzeOpportunities(entities, {
        enablePatternDetection: true,
        enableMediaQueryAnalysis: true,
        enableAnimationAnalysis: true,
        sensitivity: 'high',
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const duration = endTime - startTime;
      const memoryUsed = endMemory - startMemory;

      // Performance assertions for complex CSS
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Should use less than 100MB
      expect(result.opportunities.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated operations', async () => {
      const testCSS = '.test { color: red; padding: 8px; }';
      await writeFile(join(tempDir, 'memory-test.css'), testCSS);

      const opportunityEngine = createOpportunityIdentificationEngine();
      const entities = [{ filePath: join(tempDir, 'memory-test.css'), fileType: 'css' }];

      const initialMemory = process.memoryUsage().heapUsed;
      const memoryReadings: number[] = [];

      // Perform multiple analysis cycles
      for (let i = 0; i < 50; i++) {
        await opportunityEngine.analyzeOpportunities(entities, {
          enablePatternDetection: true,
        });

        if (i % 10 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          memoryReadings.push(process.memoryUsage().heapUsed);
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (less than 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);

      // Memory readings should not show continuous growth
      const averageGrowthPerReading = memoryReadings.length > 1 
        ? (memoryReadings[memoryReadings.length - 1] - memoryReadings[0]) / (memoryReadings.length - 1)
        : 0;
      
      expect(averageGrowthPerReading).toBeLessThan(1024 * 1024); // Less than 1MB per 10 iterations
    });

    it('should clean up resources after operations', async () => {
      const largeCSS = Array(1000).fill('.large-class { margin: 1px; }').join('\n');
      await writeFile(join(tempDir, 'large-cleanup.css'), largeCSS);

      const opportunityEngine = createOpportunityIdentificationEngine();
      const entities = [{ filePath: join(tempDir, 'large-cleanup.css'), fileType: 'css' }];

      const beforeMemory = process.memoryUsage().heapUsed;

      // Perform operation
      await opportunityEngine.analyzeOpportunities(entities, {
        enablePatternDetection: true,
      });

      const afterMemory = process.memoryUsage().heapUsed;

      // Trigger cleanup (if available)
      if (global.gc) {
        global.gc();
      }

      const cleanupMemory = process.memoryUsage().heapUsed;

      // Memory should be released after cleanup
      const retainedMemory = cleanupMemory - beforeMemory;
      expect(retainedMemory).toBeLessThan((afterMemory - beforeMemory) * 0.5); // At most 50% retained
    });
  });

  describe('Concurrent Processing Performance', () => {
    it('should handle concurrent analysis requests efficiently', async () => {
      // Create multiple test files
      const files = await Promise.all(
        Array(10).fill(0).map(async (_, i) => {
          const content = `
            .concurrent-${i} { color: hsl(${i * 36}, 70%, 50%); }
            .test-${i} { padding: ${i + 1}px; }
            .margin-${i} { margin: ${i * 2}px; }
          `;
          const filePath = join(tempDir, `concurrent-${i}.css`);
          await writeFile(filePath, content);
          return { filePath, fileType: 'css' };
        })
      );

      const opportunityEngine = createOpportunityIdentificationEngine();

      const startTime = performance.now();

      // Run concurrent analyses
      const promises = files.map(entity => 
        opportunityEngine.analyzeOpportunities([entity], {
          enablePatternDetection: true,
        })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Concurrent processing should be efficient
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.opportunities).toBeDefined();
      });
    });

    it('should limit resource usage during concurrent operations', async () => {
      const testCSS = '.concurrent { padding: 8px; margin: 4px; }';
      
      // Create multiple files
      const files = await Promise.all(
        Array(20).fill(0).map(async (_, i) => {
          const filePath = join(tempDir, `resource-${i}.css`);
          await writeFile(filePath, testCSS);
          return { filePath, fileType: 'css' };
        })
      );

      const opportunityEngine = createOpportunityIdentificationEngine();
      const startMemory = process.memoryUsage().heapUsed;

      // Run many concurrent operations
      const promises = files.map(entity => 
        opportunityEngine.analyzeOpportunities([entity], {
          enablePatternDetection: true,
        })
      );

      await Promise.all(promises);
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsed = endMemory - startMemory;

      // Memory usage should be reasonable even with many concurrent operations
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track performance metrics during analysis', async () => {
      const testCSS = `
        .monitored { padding: 8px; }
        .tracked { margin: 4px; }
        .measured { border: 1px solid; }
      `;

      await writeFile(join(tempDir, 'monitored.css'), testCSS);

      monitor.startProfiling('test-analysis');

      const opportunityEngine = createOpportunityIdentificationEngine();
      const entities = [{ filePath: join(tempDir, 'monitored.css'), fileType: 'css' }];
      
      await opportunityEngine.analyzeOpportunities(entities, {
        enablePatternDetection: true,
      });

      const metrics = monitor.stopProfiling('test-analysis');

      expect(metrics).toHaveProperty('duration');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });

    it('should detect performance regressions', async () => {
      const baselineCSS = '.baseline { color: red; }';
      const regressionCSS = Array(10000).fill('.regression { color: blue; }').join('\n');

      await writeFile(join(tempDir, 'baseline.css'), baselineCSS);
      await writeFile(join(tempDir, 'regression.css'), regressionCSS);

      const opportunityEngine = createOpportunityIdentificationEngine();

      // Baseline measurement
      monitor.startProfiling('baseline');
      await opportunityEngine.analyzeOpportunities(
        [{ filePath: join(tempDir, 'baseline.css'), fileType: 'css' }],
        { enablePatternDetection: true }
      );
      const baselineMetrics = monitor.stopProfiling('baseline');

      // Regression measurement
      monitor.startProfiling('regression');
      await opportunityEngine.analyzeOpportunities(
        [{ filePath: join(tempDir, 'regression.css'), fileType: 'css' }],
        { enablePatternDetection: true }
      );
      const regressionMetrics = monitor.stopProfiling('regression');

      // The regression should be detectable (significantly slower)
      const performanceRatio = regressionMetrics.duration / baselineMetrics.duration;
      expect(performanceRatio).toBeGreaterThan(1); // Should be slower

      // But not excessively slow (should scale reasonably)
      expect(performanceRatio).toBeLessThan(100); // Should not be 100x slower
    });
  });
});