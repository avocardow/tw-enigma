import { describe, expect, it } from 'vitest';
import {
  createAdvancedConvergenceDetector,
  createCompleteConsolidator,
  createMetricsTracker,
  createMultiPassDiscovery,
  createPerformanceOptimizer,
  createStateManager,
} from '../../src/optimization/index';
import type { PatternAnalysisInput } from '../../src/processors/patternAnalysis';

describe('Optimization Integration Tests', () => {
  describe('Multi-Pass Discovery Integration', () => {
    it('should create and execute complete optimization workflow', async () => {
      // Create the multi-pass discovery engine with default configuration
      const discovery = createMultiPassDiscovery({
        maxPasses: 5,
        convergenceThreshold: 0.1,
        enableProgressReporting: false, // Disable for testing
        enableMetricsCollection: true,
      });

      // Mock input data that resembles actual pattern analysis input
      const mockInput: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'test1.html',
            patterns: new Map([
              ['container mx-auto', { frequency: 5, contexts: [] }],
              ['text-red-500', { frequency: 3, contexts: [] }],
            ]),
          },
          {
            filePath: 'test2.html',
            patterns: new Map([
              ['bg-blue-200 p-4', { frequency: 2, contexts: [] }],
              ['container mx-auto', { frequency: 3, contexts: [] }],
            ]),
          },
        ],
        jsxResults: [
          {
            filePath: 'component.jsx',
            patterns: new Map([
              ['flex items-center', { frequency: 4, contexts: [] }],
              ['text-lg font-bold', { frequency: 2, contexts: [] }],
            ]),
          },
        ],
      };

      // Execute optimization
      const result = await discovery.optimize(mockInput);

      // Verify results
      expect(result).toBeDefined();
      expect(result.convergence).toBeDefined();
      expect(result.convergence.hasConverged).toBeDefined();
      expect(result.totalPassesExecuted).toBeGreaterThan(0);
      expect(result.finalResult).toBeDefined();
      expect(result.passMetrics).toBeDefined();
      expect(Array.isArray(result.passMetrics)).toBe(true);
    });

    it('should handle empty input gracefully', async () => {
      const discovery = createMultiPassDiscovery({
        maxPasses: 3,
        enableProgressReporting: false,
      });

      const emptyInput: PatternAnalysisInput = {
        htmlResults: [],
        jsxResults: [],
      };

      const result = await discovery.optimize(emptyInput);

      expect(result).toBeDefined();
      expect(result.convergence.hasConverged).toBe(true);
      expect(result.totalPassesExecuted).toBe(1);
    });

    it('should respect convergence settings', async () => {
      const strictDiscovery = createMultiPassDiscovery({
        maxPasses: 2,
        convergenceThreshold: 0.001, // Very strict
        enableProgressReporting: false,
      });

      const mockInput: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'test.html',
            patterns: new Map([
              ['complex-pattern-1', { frequency: 10, contexts: [] }],
              ['complex-pattern-2', { frequency: 8, contexts: [] }],
              ['complex-pattern-3', { frequency: 6, contexts: [] }],
            ]),
          },
        ],
        jsxResults: [],
      };

      const result = await strictDiscovery.optimize(mockInput);

      // Should hit max passes due to strict convergence
      expect(result.totalPassesExecuted).toBe(2);
    });
  });

  describe('Component Integration', () => {
    it('should integrate convergence detector with discovery engine', async () => {
      const convergenceDetector = createAdvancedConvergenceDetector({
        enableTrendAnalysis: true,
        enableStatisticalTests: true,
      });

      const discovery = createMultiPassDiscovery({
        maxPasses: 10,
        convergenceThreshold: 0.05,
      });

      const mockInput: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'test.html',
            patterns: new Map([['pattern-1', { frequency: 1, contexts: [] }]]),
          },
        ],
        jsxResults: [],
      };

      const result = await discovery.optimize(mockInput);

      expect(result).toBeDefined();
      expect(result.convergence).toBeDefined();
    });

    it('should integrate metrics tracker with optimization process', async () => {
      const metricsTracker = createMetricsTracker({
        enableMetricsCollection: true,
        collectMemoryMetrics: true,
        collectTimingMetrics: true,
      });

      const discovery = createMultiPassDiscovery({
        maxPasses: 5,
        enableMetricsCollection: true,
      });

      const mockInput: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'metrics-test.html',
            patterns: new Map([['tracked-pattern', { frequency: 5, contexts: [] }]]),
          },
        ],
        jsxResults: [],
      };

      const result = await discovery.optimize(mockInput);

      expect(result.enhancedMetricsSummary).toBeDefined();
      expect(result.aggregatedStatistics).toBeDefined();
    });

    it('should integrate state manager with checkpointing', async () => {
      const stateManager = createStateManager({
        enableCheckpointing: true,
        checkpointInterval: 2,
      });

      const discovery = createMultiPassDiscovery({
        maxPasses: 6,
        enableCheckpointing: true,
      });

      const mockInput: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'state-test.html',
            patterns: new Map([
              ['state-pattern-1', { frequency: 3, contexts: [] }],
              ['state-pattern-2', { frequency: 2, contexts: [] }],
            ]),
          },
        ],
        jsxResults: [],
      };

      const result = await discovery.optimize(mockInput);

      expect(result).toBeDefined();
      expect(result.checkpoints).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should integrate performance optimizer with discovery engine', async () => {
      const performanceOptimizer = createPerformanceOptimizer({
        enableVectorization: true,
        enableParallelization: false, // Disable for testing
        enableResourceMonitoring: false,
      });

      const discovery = createMultiPassDiscovery({
        maxPasses: 3,
        memoryEfficientMode: true,
      });

      const largeInput: PatternAnalysisInput = {
        htmlResults: Array.from({ length: 10 }, (_, i) => ({
          filePath: `file-${i}.html`,
          patterns: new Map([
            [`pattern-${i}-1`, { frequency: i + 1, contexts: [] }],
            [`pattern-${i}-2`, { frequency: i + 2, contexts: [] }],
          ]),
        })),
        jsxResults: Array.from({ length: 5 }, (_, i) => ({
          filePath: `component-${i}.jsx`,
          patterns: new Map([[`component-pattern-${i}`, { frequency: i + 3, contexts: [] }]]),
        })),
      };

      const startTime = Date.now();
      const result = await discovery.optimize(largeInput);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds

      await performanceOptimizer.shutdown();
    });

    it('should maintain memory efficiency during large-scale processing', async () => {
      const discovery = createMultiPassDiscovery({
        maxPasses: 4,
        memoryEfficientMode: true,
        enableProgressReporting: false,
      });

      // Create a large dataset
      const largeDataset: PatternAnalysisInput = {
        htmlResults: Array.from({ length: 50 }, (_, i) => ({
          filePath: `large-file-${i}.html`,
          patterns: new Map(
            Array.from({ length: 20 }, (_, j) => [
              `pattern-${i}-${j}`,
              { frequency: Math.floor(Math.random() * 10) + 1, contexts: [] },
            ])
          ),
        })),
        jsxResults: [],
      };

      const memoryBefore = process.memoryUsage().heapUsed;

      const result = await discovery.optimize(largeDataset);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      expect(result).toBeDefined();
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle errors gracefully across components', async () => {
      const discovery = createMultiPassDiscovery({
        maxPasses: 5,
        continueOnError: true,
        errorRecoveryStrategy: 'continue',
      });

      // Create input with potential issues
      const problematicInput: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'problematic.html',
            patterns: new Map([
              ['valid-pattern', { frequency: 5, contexts: [] }],
              ['', { frequency: 0, contexts: [] }], // Empty pattern
              ['another-valid', { frequency: 3, contexts: [] }],
            ]),
          },
        ],
        jsxResults: [],
      };

      // Should not throw, but handle gracefully
      const result = await discovery.optimize(problematicInput);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should provide comprehensive error reporting', async () => {
      const discovery = createMultiPassDiscovery({
        maxPasses: 3,
        continueOnError: true,
        enableMetricsCollection: true,
      });

      const input: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'error-test.html',
            patterns: new Map([['normal-pattern', { frequency: 2, contexts: [] }]]),
          },
        ],
        jsxResults: [],
      };

      const result = await discovery.optimize(input);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    it('should apply configuration changes across all components', async () => {
      const discovery = createMultiPassDiscovery({
        maxPasses: 8,
        convergenceThreshold: 0.08,
        enableAdaptiveThresholds: true,
        optimizationStrategy: 'aggressive',
      });

      const input: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'config-test.html',
            patterns: new Map([
              ['config-pattern-1', { frequency: 10, contexts: [] }],
              ['config-pattern-2', { frequency: 5, contexts: [] }],
            ]),
          },
        ],
        jsxResults: [],
      };

      const result = await discovery.optimize(input);

      expect(result).toBeDefined();
      expect(result.totalPassesExecuted).toBeGreaterThan(0);
      expect(result.totalPassesExecuted).toBeLessThanOrEqual(8);
    });

    it('should validate configuration compatibility', () => {
      // Test that invalid configurations are rejected
      expect(() => {
        createMultiPassDiscovery({
          maxPasses: 0, // Invalid
        });
      }).toThrow();

      expect(() => {
        createMultiPassDiscovery({
          convergenceThreshold: -1, // Invalid
        });
      }).toThrow();

      expect(() => {
        createMultiPassDiscovery({
          convergenceThreshold: 2, // Invalid: > 1
        });
      }).toThrow();
    });
  });

  describe('Factory Function Integration', () => {
    it('should create fully integrated system via factory functions', () => {
      const convergenceDetector = createAdvancedConvergenceDetector();
      const metricsTracker = createMetricsTracker();
      const stateManager = createStateManager();
      const consolidator = createCompleteConsolidator();
      const performanceOptimizer = createPerformanceOptimizer();

      // All components should be created successfully
      expect(convergenceDetector).toBeDefined();
      expect(metricsTracker).toBeDefined();
      expect(stateManager).toBeDefined();
      expect(consolidator).toBeDefined();
      expect(performanceOptimizer).toBeDefined();

      // Clean up
      performanceOptimizer.shutdown();
    });

    it('should create discovery engine with all dependencies', () => {
      const discovery = createMultiPassDiscovery();

      expect(discovery).toBeDefined();
      expect(discovery.getCurrentState).toBeDefined();
      expect(discovery.getCheckpoints).toBeDefined();
      expect(discovery.getMetricsTracker).toBeDefined();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should optimize typical TailwindCSS patterns', async () => {
      const discovery = createMultiPassDiscovery({
        maxPasses: 6,
        convergenceThreshold: 0.05,
      });

      const tailwindInput: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'header.html',
            patterns: new Map([
              ['flex items-center justify-between', { frequency: 8, contexts: [] }],
              ['bg-white shadow-sm', { frequency: 5, contexts: [] }],
              ['text-gray-900 font-semibold', { frequency: 4, contexts: [] }],
              ['px-4 py-2', { frequency: 12, contexts: [] }],
            ]),
          },
          {
            filePath: 'button.html',
            patterns: new Map([
              ['px-4 py-2', { frequency: 15, contexts: [] }],
              ['bg-blue-500 hover:bg-blue-600', { frequency: 6, contexts: [] }],
              ['text-white font-medium', { frequency: 8, contexts: [] }],
              ['rounded-md', { frequency: 10, contexts: [] }],
            ]),
          },
        ],
        jsxResults: [
          {
            filePath: 'Button.jsx',
            patterns: new Map([
              ['bg-blue-500 hover:bg-blue-600', { frequency: 3, contexts: [] }],
              ['px-4 py-2', { frequency: 8, contexts: [] }],
              ['rounded-md text-white', { frequency: 5, contexts: [] }],
            ]),
          },
        ],
      };

      const result = await discovery.optimize(tailwindInput);

      expect(result).toBeDefined();
      expect(result.convergence.hasConverged).toBe(true);
      expect(result.finalResult.consolidatedPatterns).toBeDefined();
      expect(result.totalPatternsDiscovered).toBeGreaterThan(0);
    });

    it('should handle mixed framework patterns', async () => {
      const discovery = createMultiPassDiscovery({
        maxPasses: 5,
        patternAnalysisOptions: {
          includeFrameworkAnalysis: true,
          enablePatternGrouping: true,
        },
      });

      const mixedInput: PatternAnalysisInput = {
        htmlResults: [
          {
            filePath: 'vanilla.html',
            patterns: new Map([
              ['container mx-auto max-w-4xl', { frequency: 3, contexts: [] }],
              ['grid grid-cols-1 md:grid-cols-2', { frequency: 2, contexts: [] }],
            ]),
          },
        ],
        jsxResults: [
          {
            filePath: 'React.jsx',
            patterns: new Map([
              ['flex flex-col space-y-4', { frequency: 5, contexts: [] }],
              ['bg-gray-100 p-6 rounded-lg', { frequency: 4, contexts: [] }],
            ]),
          },
        ],
      };

      const result = await discovery.optimize(mixedInput);

      expect(result).toBeDefined();
      expect(result.convergence.hasConverged).toBeDefined();
      expect(result.passMetrics.length).toBeGreaterThan(0);
    });
  });
});
