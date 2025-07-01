/**
 * Automated Performance Regression Tests for Template Literal Processing
 * Establishes baselines and validates performance thresholds
 */

import { TemplateLiteralPerformanceTester } from '../../src/processors/templateLiteralPerformanceTester';

describe('Template Literal Performance Tests', () => {
  let performanceTester: TemplateLiteralPerformanceTester;

  beforeAll(() => {
    performanceTester = new TemplateLiteralPerformanceTester({
      iterations: 100, // Reduced for CI
      complexityLevels: ['simple', 'moderate', 'complex'],
      enableMemoryProfiling: true,
      enableConcurrencyTesting: true,
      maxTestDuration: 30000, // 30 seconds
      workerThreads: 2,
      thresholds: {
        detectionLatency: 5, // 5ms
        parsingLatency: 25, // 25ms
        generationLatency: 10, // 10ms
        fallbackLatency: 50, // 50ms
        memoryUsage: 50, // 50MB
        throughput: 50, // 50 ops/sec
      },
    });
  });

  describe('Performance Baseline Tests', () => {
    test('should establish performance baseline', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      expect(result.metrics).toBeDefined();
      expect(result.metrics.length).toBeGreaterThan(0);
      
      // Set baseline for future regression tests
      performanceTester.setBaseline(result.metrics);
      
      console.log('Performance baseline established:');
      console.log(performanceTester.generateReport(result));
    }, 60000);

    test('should meet detection latency thresholds', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      const detectionMetrics = result.metrics.filter(m => m.testName.includes('detection'));
      
      for (const metric of detectionMetrics) {
        expect(metric.averageTime).toBeLessThan(5); // 5ms threshold
        expect(metric.p95Time).toBeLessThan(10); // 10ms P95
      }
    }, 30000);

    test('should meet parsing latency thresholds', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      const parsingMetrics = result.metrics.filter(m => m.testName.includes('parsing'));
      
      for (const metric of parsingMetrics) {
        expect(metric.averageTime).toBeLessThan(25); // 25ms threshold
        expect(metric.p95Time).toBeLessThan(50); // 50ms P95
      }
    }, 30000);

    test('should meet generation latency thresholds', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      const generationMetrics = result.metrics.filter(m => m.testName.includes('generation'));
      
      for (const metric of generationMetrics) {
        expect(metric.averageTime).toBeLessThan(10); // 10ms threshold
        expect(metric.p95Time).toBeLessThan(20); // 20ms P95
      }
    }, 30000);

    test('should meet fallback latency thresholds', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      const fallbackMetrics = result.metrics.filter(m => m.testName.includes('fallback'));
      
      for (const metric of fallbackMetrics) {
        expect(metric.averageTime).toBeLessThan(50); // 50ms threshold
        expect(metric.p95Time).toBeLessThan(100); // 100ms P95
      }
    }, 30000);
  });

  describe('Memory Performance Tests', () => {
    test('should not have significant memory leaks', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      for (const metric of result.metrics) {
        expect(metric.memoryUsage.leaked).toBeLessThan(10); // 10MB leak threshold
        expect(metric.memoryUsage.peak).toBeLessThan(100); // 100MB peak threshold
      }
    }, 45000);

    test('should maintain reasonable memory usage during stress', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      const memoryMetric = result.metrics.find(m => m.testName === 'memory-leak');
      if (memoryMetric) {
        expect(memoryMetric.memoryUsage.leaked).toBeLessThan(20); // 20MB for stress test
        expect(memoryMetric.errors).toBeLessThan(memoryMetric.iterations * 0.01); // Less than 1% error rate
      }
    }, 60000);
  });

  describe('Throughput Performance Tests', () => {
    test('should meet minimum throughput requirements', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      for (const metric of result.metrics) {
        if (!metric.testName.includes('memory-leak')) {
          expect(metric.throughput).toBeGreaterThan(50); // 50 ops/sec minimum
        }
      }
    }, 30000);

    test('should handle concurrent operations efficiently', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      const concurrentMetrics = result.metrics.filter(m => m.testName.includes('concurrent'));
      
      for (const metric of concurrentMetrics) {
        expect(metric.errors).toBeLessThan(metric.iterations * 0.05); // Less than 5% error rate
        expect(metric.throughput).toBeGreaterThan(25); // Reduced for concurrent
      }
    }, 45000);
  });

  describe('Error Rate Performance Tests', () => {
    test('should maintain low error rates across all operations', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      for (const metric of result.metrics) {
        const errorRate = metric.errors / metric.iterations;
        expect(errorRate).toBeLessThan(0.02); // Less than 2% error rate
      }
    }, 30000);

    test('should have effective fallback coverage', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      const fallbackMetrics = result.metrics.filter(m => m.testName.includes('fallback'));
      
      for (const metric of fallbackMetrics) {
        const fallbackRate = metric.fallbacks / metric.iterations;
        expect(fallbackRate).toBeGreaterThan(0.8); // At least 80% fallback success
      }
    }, 30000);
  });

  describe('Cache Performance Tests', () => {
    test('should achieve good cache hit rates', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      const cacheMetrics = result.metrics.filter(m => m.cacheHitRate > 0);
      
      for (const metric of cacheMetrics) {
        expect(metric.cacheHitRate).toBeGreaterThan(0.7); // At least 70% cache hit rate
      }
    }, 30000);
  });

  describe('Regression Detection Tests', () => {
    test('should detect performance regressions', async () => {
      // First run to establish baseline
      const baseline = await performanceTester.runFullTestSuite();
      performanceTester.setBaseline(baseline.metrics);
      
      // Simulate performance degradation by increasing thresholds
      const degradedTester = new TemplateLiteralPerformanceTester({
        iterations: 100,
        complexityLevels: ['simple'],
        thresholds: {
          detectionLatency: 1, // Very strict threshold
          parsingLatency: 5,
          generationLatency: 2,
          fallbackLatency: 10,
          memoryUsage: 10,
          throughput: 200, // Very high requirement
        },
      });
      
      const result = await degradedTester.runFullTestSuite();
      
      // Should fail thresholds with strict requirements
      expect(result.passedThresholds).toBe(false);
    }, 45000);
  });

  describe('Optimization Recommendations', () => {
    test('should generate meaningful optimization recommendations', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      expect(result.optimizationRecommendations).toBeDefined();
      expect(Array.isArray(result.optimizationRecommendations)).toBe(true);
      
      // Should have some recommendations if performance isn't perfect
      if (!result.passedThresholds) {
        expect(result.optimizationRecommendations.length).toBeGreaterThan(0);
      }
    }, 30000);

    test('should identify bottlenecks correctly', async () => {
      const result = await performanceTester.runFullTestSuite();
      
      expect(result.bottlenecks).toBeDefined();
      expect(Array.isArray(result.bottlenecks)).toBe(true);
      
      // Validate bottleneck structure
      for (const bottleneck of result.bottlenecks) {
        expect(bottleneck.component).toBeDefined();
        expect(bottleneck.operation).toBeDefined();
        expect(bottleneck.impact).toMatch(/^(high|medium|low)$/);
        expect(bottleneck.recommendation).toBeDefined();
      }
    }, 30000);
  });

  describe('Report Generation', () => {
    test('should generate comprehensive performance report', async () => {
      const result = await performanceTester.runFullTestSuite();
      const report = performanceTester.generateReport(result);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(100);
      
      // Should contain key sections
      expect(report).toContain('# Template Literal Performance Test Report');
      expect(report).toContain('## Test Summary');
      expect(report).toContain('## Performance Metrics');
      
      if (result.bottlenecks.length > 0) {
        expect(report).toContain('## Bottlenecks');
      }
      
      if (result.optimizationRecommendations.length > 0) {
        expect(report).toContain('## Optimization Recommendations');
      }
    }, 30000);
  });
});

describe('Performance Test Configuration', () => {
  test('should accept custom configuration', () => {
    const customConfig = {
      iterations: 50,
      complexityLevels: ['simple', 'moderate'] as const,
      enableMemoryProfiling: false,
      enableConcurrencyTesting: false,
      maxTestDuration: 15000,
      workerThreads: 1,
      thresholds: {
        detectionLatency: 2,
        parsingLatency: 10,
        generationLatency: 5,
        fallbackLatency: 25,
        memoryUsage: 25,
        throughput: 100,
      },
    };
    
    const tester = new TemplateLiteralPerformanceTester(customConfig);
    expect(tester).toBeDefined();
  });

  test('should use default configuration when none provided', () => {
    const tester = new TemplateLiteralPerformanceTester();
    expect(tester).toBeDefined();
  });
});