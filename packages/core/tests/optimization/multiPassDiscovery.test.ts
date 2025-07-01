import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConvergenceDetector,
  createAdvancedConvergenceDetector,
} from '../../src/optimization/convergenceDetection';
import { createMetricsTracker, MetricsTracker } from '../../src/optimization/metricsTracking';
import {
  createMultiPassDiscovery,
  type MultiPassConfig,
  MultiPassDiscovery,
  OptimizationMode,
} from '../../src/optimization/multiPassDiscovery';
import { createStateManager, StateManager } from '../../src/optimization/stateManagement';

describe('MultiPassDiscovery', () => {
  let discovery: MultiPassDiscovery;
  let mockConvergenceDetector: ConvergenceDetector;
  let mockMetricsTracker: MetricsTracker;
  let mockStateManager: StateManager;

  const defaultConfig: MultiPassConfig = {
    maxPasses: 10,
    convergenceThreshold: 0.05,
    minIterations: 2,
    adaptiveThreshold: true,
    earlyStoppingEnabled: true,
    oscillationDetection: true,
    qualityAssurance: true,
  };

  const mockFileData = [
    { path: 'test1.html', content: '<div class="container mx-auto"></div>' },
    { path: 'test2.html', content: '<p class="text-red-500 font-bold"></p>' },
    { path: 'test3.js', content: 'className="bg-blue-200 p-4"' },
  ];

  beforeEach(() => {
    // Create mock dependencies
    mockConvergenceDetector = createAdvancedConvergenceDetector({
      enableTrendAnalysis: true,
      enableStationarityTest: true,
      enableChangePointDetection: true,
      enableOscillationDetection: true,
    });

    mockMetricsTracker = createMetricsTracker({
      enableCollection: true,
      enableReporting: true,
      reportingInterval: 1,
    });

    mockStateManager = createStateManager({
      enableCheckpointing: true,
      checkpointInterval: 5,
    });

    discovery = new MultiPassDiscovery(defaultConfig, {
      convergenceDetector: mockConvergenceDetector,
      metricsTracker: mockMetricsTracker,
      stateManager: mockStateManager,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultDiscovery = new MultiPassDiscovery();
      expect(defaultDiscovery.getConfig()).toBeDefined();
      expect(defaultDiscovery.getConfig().maxPasses).toBe(10);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<MultiPassConfig> = {
        maxPasses: 20,
        convergenceThreshold: 0.1,
      };

      const customDiscovery = new MultiPassDiscovery(customConfig);
      const config = customDiscovery.getConfig();

      expect(config.maxPasses).toBe(20);
      expect(config.convergenceThreshold).toBe(0.1);
      expect(config.minIterations).toBe(2); // Should use default
    });

    it('should validate configuration parameters', () => {
      expect(() => {
        new MultiPassDiscovery({ maxPasses: 0 });
      }).toThrow();

      expect(() => {
        new MultiPassDiscovery({ convergenceThreshold: -1 });
      }).toThrow();
    });
  });

  describe('Core Optimization Loop', () => {
    it('should execute basic optimization pass', async () => {
      const result = await discovery.optimize(mockFileData);

      expect(result).toBeDefined();
      expect(result.converged).toBeDefined();
      expect(result.totalPasses).toBeGreaterThan(0);
      expect(result.patterns).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);
    });

    it('should respect maximum passes configuration', async () => {
      const shortDiscovery = new MultiPassDiscovery({
        maxPasses: 3,
        convergenceThreshold: 0.001, // Very strict to force max passes
      });

      const result = await shortDiscovery.optimize(mockFileData);

      expect(result.totalPasses).toBeLessThanOrEqual(3);
    });

    it('should handle empty input data', async () => {
      const result = await discovery.optimize([]);

      expect(result.converged).toBe(true);
      expect(result.totalPasses).toBe(1);
      expect(result.patterns).toEqual([]);
    });

    it('should handle optimization mode configuration', async () => {
      const aggressiveDiscovery = new MultiPassDiscovery({
        ...defaultConfig,
      });

      const result = await aggressiveDiscovery.optimize(mockFileData, OptimizationMode.AGGRESSIVE);
      expect(result).toBeDefined();
    });
  });

  describe('Convergence Detection', () => {
    it('should detect convergence with sufficient improvement', async () => {
      const fastConvergence = new MultiPassDiscovery({
        maxPasses: 10,
        convergenceThreshold: 0.5, // Very lenient threshold
        minIterations: 1,
      });

      const result = await fastConvergence.optimize(mockFileData);

      expect(result.converged).toBe(true);
      expect(result.totalPasses).toBeGreaterThanOrEqual(1);
    });

    it('should handle non-convergent scenarios', async () => {
      const strictDiscovery = new MultiPassDiscovery({
        maxPasses: 2,
        convergenceThreshold: 0.001, // Very strict
        minIterations: 1,
      });

      const result = await strictDiscovery.optimize(mockFileData);

      // Should reach max passes without convergence
      expect(result.totalPasses).toBe(2);
    });

    it('should respect minimum iterations before convergence check', async () => {
      const minIterDiscovery = new MultiPassDiscovery({
        maxPasses: 10,
        convergenceThreshold: 1.0, // Very lenient
        minIterations: 3,
      });

      const result = await minIterDiscovery.optimize(mockFileData);

      expect(result.totalPasses).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Metrics and State Management', () => {
    it('should collect metrics during optimization', async () => {
      const result = await discovery.optimize(mockFileData);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.summary).toBeDefined();
      expect(result.metrics.passResults).toBeDefined();
      expect(Array.isArray(result.metrics.passResults)).toBe(true);
    });

    it('should maintain state consistency', async () => {
      const statefulDiscovery = new MultiPassDiscovery({
        ...defaultConfig,
        maxPasses: 5,
      });

      const result = await statefulDiscovery.optimize(mockFileData);

      expect(result.state).toBeDefined();
      expect(result.state.currentPass).toBe(result.totalPasses);
    });

    it('should handle checkpointing if enabled', async () => {
      const checkpointDiscovery = new MultiPassDiscovery(defaultConfig);

      const result = await checkpointDiscovery.optimize(mockFileData);

      // Should complete without errors even with checkpointing
      expect(result).toBeDefined();
      expect(result.converged).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid file data gracefully', async () => {
      const invalidData = [
        { path: 'test.html', content: null as any },
        { path: 'test2.html', content: undefined as any },
      ];

      // Should not throw, but handle gracefully
      const result = await discovery.optimize(invalidData);
      expect(result).toBeDefined();
    });

    it('should handle optimization errors gracefully', async () => {
      // Mock an error in the optimization process
      const errorDiscovery = new MultiPassDiscovery(defaultConfig);

      // Test with malformed data that might cause issues
      const problematicData = [
        { path: '', content: '' },
        { path: 'test.html', content: '<div class="' }, // Incomplete HTML
      ];

      const result = await errorDiscovery.optimize(problematicData);
      expect(result).toBeDefined();
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        path: `file${i}.html`,
        content: `<div class="container-${i} bg-red-${i % 10}00 p-${i % 4}"></div>`,
      }));

      const startTime = Date.now();
      const result = await discovery.optimize(largeDataset);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Configuration Updates', () => {
    it('should allow runtime configuration updates', () => {
      const newConfig: Partial<MultiPassConfig> = {
        maxPasses: 15,
        convergenceThreshold: 0.1,
      };

      discovery.updateConfig(newConfig);
      const updatedConfig = discovery.getConfig();

      expect(updatedConfig.maxPasses).toBe(15);
      expect(updatedConfig.convergenceThreshold).toBe(0.1);
    });

    it('should validate configuration updates', () => {
      expect(() => {
        discovery.updateConfig({ maxPasses: -1 });
      }).toThrow();

      expect(() => {
        discovery.updateConfig({ convergenceThreshold: 2 });
      }).toThrow();
    });
  });

  describe('Pattern Analysis Integration', () => {
    it('should generate meaningful patterns from file data', async () => {
      const result = await discovery.optimize(mockFileData);

      expect(result.patterns).toBeDefined();
      expect(Array.isArray(result.patterns)).toBe(true);

      // Should find some patterns in the mock data
      if (result.patterns.length > 0) {
        const pattern = result.patterns[0];
        expect(pattern).toHaveProperty('originalClass');
        expect(pattern).toHaveProperty('newClass');
        expect(pattern).toHaveProperty('frequency');
      }
    });

    it('should handle duplicate and similar patterns', async () => {
      const duplicateData = [
        { path: 'test1.html', content: '<div class="container mx-auto"></div>' },
        { path: 'test2.html', content: '<div class="container mx-auto"></div>' },
        { path: 'test3.html', content: '<div class="container mx-auto p-4"></div>' },
      ];

      const result = await discovery.optimize(duplicateData);

      expect(result.patterns).toBeDefined();
      // Should consolidate similar patterns
      const containerPatterns = result.patterns.filter((p) =>
        p.originalClass.includes('container')
      );
      expect(containerPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Factory Functions', () => {
    it('should create instance with factory function', () => {
      const factoryDiscovery = createMultiPassDiscovery(defaultConfig);

      expect(factoryDiscovery).toBeInstanceOf(MultiPassDiscovery);
      expect(factoryDiscovery.getConfig()).toEqual(expect.objectContaining(defaultConfig));
    });

    it('should create instance with default config via factory', () => {
      const defaultFactoryDiscovery = createMultiPassDiscovery();

      expect(defaultFactoryDiscovery).toBeInstanceOf(MultiPassDiscovery);
      expect(defaultFactoryDiscovery.getConfig()).toBeDefined();
    });
  });

  describe('Performance and Memory', () => {
    it('should maintain stable memory usage during optimization', async () => {
      const memoryBefore = process.memoryUsage().heapUsed;

      await discovery.optimize(mockFileData);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryDiff = memoryAfter - memoryBefore;

      // Memory usage should not increase drastically (less than 50MB)
      expect(memoryDiff).toBeLessThan(50 * 1024 * 1024);
    });

    it('should provide performance metrics', async () => {
      const result = await discovery.optimize(mockFileData);

      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.totalTime).toBeGreaterThan(0);
      expect(result.performanceMetrics.averagePassTime).toBeGreaterThan(0);
    });
  });

  describe('Integration with Dependencies', () => {
    it('should work with custom convergence detector', async () => {
      const customDetector = createAdvancedConvergenceDetector({
        enableTrendAnalysis: false,
        enableStationarityTest: true,
      });

      const customDiscovery = new MultiPassDiscovery(defaultConfig, {
        convergenceDetector: customDetector,
      });

      const result = await customDiscovery.optimize(mockFileData);
      expect(result).toBeDefined();
    });

    it('should work with custom metrics tracker', async () => {
      const customMetrics = createMetricsTracker({
        enableCollection: true,
        enableDetailedMetrics: true,
      });

      const customDiscovery = new MultiPassDiscovery(defaultConfig, {
        metricsTracker: customMetrics,
      });

      const result = await customDiscovery.optimize(mockFileData);
      expect(result.metrics).toBeDefined();
    });

    it('should work with custom state manager', async () => {
      const customState = createStateManager({
        enableCheckpointing: false,
        enableCompression: true,
      });

      const customDiscovery = new MultiPassDiscovery(defaultConfig, {
        stateManager: customState,
      });

      const result = await customDiscovery.optimize(mockFileData);
      expect(result.state).toBeDefined();
    });
  });
});
