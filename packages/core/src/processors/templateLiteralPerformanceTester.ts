/**
 * Template Literal Performance Testing Suite
 * Comprehensive performance tuning and stress testing for template literal processing pipeline
 */

import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import { TemplateLiteralDetector } from './templateLiteralDetector';
import { ASTTemplateParser } from './astTemplateParser';
import { DynamicClassAPI } from './dynamicClassAPI';
import { FallbackHandler } from './fallbackHandler';
import type { ProcessingContext } from './types';

export interface PerformanceTestConfig {
  /** Number of iterations for each test */
  iterations: number;
  /** Test complexity levels */
  complexityLevels: ('simple' | 'moderate' | 'complex' | 'extreme')[];
  /** Enable memory profiling */
  enableMemoryProfiling: boolean;
  /** Enable concurrency testing */
  enableConcurrencyTesting: boolean;
  /** Maximum test duration in milliseconds */
  maxTestDuration: number;
  /** Worker thread count for stress testing */
  workerThreads: number;
  /** Performance thresholds */
  thresholds: {
    detectionLatency: number; // ms
    parsingLatency: number; // ms
    generationLatency: number; // ms
    fallbackLatency: number; // ms
    memoryUsage: number; // MB
    throughput: number; // operations/second
  };
}

export interface PerformanceMetrics {
  testName: string;
  complexity: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
    leaked: number;
  };
  errors: number;
  fallbacks: number;
  cacheHitRate: number;
}

export interface StressTestResult {
  testSuite: string;
  metrics: PerformanceMetrics[];
  bottlenecks: {
    component: string;
    operation: string;
    impact: 'high' | 'medium' | 'low';
    recommendation: string;
  }[];
  regressionDetected: boolean;
  passedThresholds: boolean;
  optimizationRecommendations: string[];
}

export class TemplateLiteralPerformanceTester {
  private config: PerformanceTestConfig;
  private detector: TemplateLiteralDetector;
  private parser: ASTTemplateParser;
  private api: DynamicClassAPI;
  private fallbackHandler: FallbackHandler;
  private baseline: Map<string, PerformanceMetrics> = new Map();

  constructor(config: Partial<PerformanceTestConfig> = {}) {
    this.config = {
      iterations: 1000,
      complexityLevels: ['simple', 'moderate', 'complex', 'extreme'],
      enableMemoryProfiling: true,
      enableConcurrencyTesting: true,
      maxTestDuration: 60000, // 1 minute
      workerThreads: 4,
      thresholds: {
        detectionLatency: 10, // 10ms
        parsingLatency: 50, // 50ms
        generationLatency: 20, // 20ms
        fallbackLatency: 100, // 100ms
        memoryUsage: 100, // 100MB
        throughput: 100, // 100 ops/sec
      },
      ...config,
    };

    this.initializeComponents();
  }

  private initializeComponents(): void {
    this.detector = new TemplateLiteralDetector({
      includeTagged: true,
      includeMultiline: true,
      maxLength: 10000,
    });

    this.parser = new ASTTemplateParser({
      typescript: true,
      jsx: true,
      plugins: ['decorators', 'classProperties'],
    });

    this.api = new DynamicClassAPI({
      cache: true,
      cacheTTL: 300000,
      optimization: 'aggressive',
    });

    this.fallbackHandler = new FallbackHandler();
  }

  /**
   * Run comprehensive performance test suite
   */
  async runFullTestSuite(): Promise<StressTestResult> {
    console.log('🚀 Starting Template Literal Performance Test Suite...');
    
    const metrics: PerformanceMetrics[] = [];
    const bottlenecks: StressTestResult['bottlenecks'] = [];

    try {
      // Test each complexity level
      for (const complexity of this.config.complexityLevels) {
        console.log(`📊 Testing ${complexity} complexity templates...`);
        
        // Detection performance test
        const detectionMetrics = await this.testDetectionPerformance(complexity);
        metrics.push(detectionMetrics);

        // Parsing performance test
        const parsingMetrics = await this.testParsingPerformance(complexity);
        metrics.push(parsingMetrics);

        // Generation performance test
        const generationMetrics = await this.testGenerationPerformance(complexity);
        metrics.push(generationMetrics);

        // Fallback performance test
        const fallbackMetrics = await this.testFallbackPerformance(complexity);
        metrics.push(fallbackMetrics);

        // End-to-end pipeline test
        const e2eMetrics = await this.testEndToEndPipeline(complexity);
        metrics.push(e2eMetrics);
      }

      // Stress testing
      if (this.config.enableConcurrencyTesting) {
        console.log('🔥 Running concurrency stress tests...');
        const concurrencyMetrics = await this.testConcurrencyStress();
        metrics.push(...concurrencyMetrics);
      }

      // Memory leak testing
      if (this.config.enableMemoryProfiling) {
        console.log('🧠 Running memory leak tests...');
        const memoryMetrics = await this.testMemoryLeaks();
        metrics.push(memoryMetrics);
      }

      // Analyze bottlenecks
      bottlenecks.push(...this.analyzeBottlenecks(metrics));

      // Check regression and thresholds
      const regressionDetected = this.detectPerformanceRegression(metrics);
      const passedThresholds = this.validatePerformanceThresholds(metrics);

      console.log('✅ Performance test suite completed');

      return {
        testSuite: 'Template Literal Performance',
        metrics,
        bottlenecks,
        regressionDetected,
        passedThresholds,
        optimizationRecommendations: this.generateOptimizationRecommendations(metrics),
      };
    } catch (error) {
      console.error('❌ Performance test suite failed:', error);
      throw error;
    }
  }

  /**
   * Test template literal detection performance
   */
  private async testDetectionPerformance(complexity: string): Promise<PerformanceMetrics> {
    const testData = this.generateTestTemplates(complexity);
    const times: number[] = [];
    let errors = 0;
    
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory;

    console.log(`  🔍 Detection test: ${testData.length} templates`);

    for (let i = 0; i < this.config.iterations; i++) {
      const template = testData[i % testData.length];
      
      try {
        const startTime = performance.now();
        this.detector.detect(template);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        
        // Memory monitoring
        if (this.config.enableMemoryProfiling && i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      } catch (error) {
        errors++;
      }
    }

    const finalMemory = process.memoryUsage();
    
    return this.calculateMetrics({
      testName: `detection-${complexity}`,
      complexity,
      times,
      errors,
      fallbacks: 0,
      cacheHitRate: 0,
      initialMemory,
      peakMemory,
      finalMemory,
    });
  }

  /**
   * Test AST parsing performance
   */
  private async testParsingPerformance(complexity: string): Promise<PerformanceMetrics> {
    const testData = this.generateTestCode(complexity);
    const times: number[] = [];
    let errors = 0;
    
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory;

    console.log(`  🔧 Parsing test: ${testData.length} code samples`);

    for (let i = 0; i < this.config.iterations; i++) {
      const code = testData[i % testData.length];
      
      try {
        const startTime = performance.now();
        this.parser.parse(code, { filePath: `test-${i}.js` });
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        
        if (this.config.enableMemoryProfiling && i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      } catch (error) {
        errors++;
      }
    }

    const finalMemory = process.memoryUsage();
    
    return this.calculateMetrics({
      testName: `parsing-${complexity}`,
      complexity,
      times,
      errors,
      fallbacks: 0,
      cacheHitRate: 0,
      initialMemory,
      peakMemory,
      finalMemory,
    });
  }

  /**
   * Test dynamic class generation performance
   */
  private async testGenerationPerformance(complexity: string): Promise<PerformanceMetrics> {
    const templates = this.generateTestTemplates(complexity);
    const contexts = this.generateTestContexts(complexity);
    const times: number[] = [];
    let errors = 0;
    let cacheHits = 0;
    
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory;

    console.log(`  ⚡ Generation test: ${templates.length} templates`);

    for (let i = 0; i < this.config.iterations; i++) {
      const template = templates[i % templates.length];
      const context = contexts[i % contexts.length];
      
      try {
        const startTime = performance.now();
        const result = await this.api.generateClasses(template, context);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        if (result.cached) cacheHits++;
        
        if (this.config.enableMemoryProfiling && i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      } catch (error) {
        errors++;
      }
    }

    const finalMemory = process.memoryUsage();
    
    return this.calculateMetrics({
      testName: `generation-${complexity}`,
      complexity,
      times,
      errors,
      fallbacks: 0,
      cacheHitRate: cacheHits / this.config.iterations,
      initialMemory,
      peakMemory,
      finalMemory,
    });
  }

  /**
   * Test fallback handler performance
   */
  private async testFallbackPerformance(complexity: string): Promise<PerformanceMetrics> {
    const badTemplates = this.generateBadTemplates(complexity);
    const contexts = this.generateTestContexts(complexity);
    const times: number[] = [];
    let errors = 0;
    let fallbacks = 0;
    
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory;

    console.log(`  🛡️ Fallback test: ${badTemplates.length} bad templates`);

    for (let i = 0; i < this.config.iterations; i++) {
      const template = badTemplates[i % badTemplates.length];
      const context = contexts[i % contexts.length];
      
      try {
        const startTime = performance.now();
        const result = await this.fallbackHandler.processWithFallback(
          template,
          context,
          new Error('Simulated parsing failure')
        );
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        if (result.success) fallbacks++;
        
        if (this.config.enableMemoryProfiling && i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      } catch (error) {
        errors++;
      }
    }

    const finalMemory = process.memoryUsage();
    
    return this.calculateMetrics({
      testName: `fallback-${complexity}`,
      complexity,
      times,
      errors,
      fallbacks,
      cacheHitRate: 0,
      initialMemory,
      peakMemory,
      finalMemory,
    });
  }

  /**
   * Test end-to-end pipeline performance
   */
  private async testEndToEndPipeline(complexity: string): Promise<PerformanceMetrics> {
    const testCode = this.generateTestCode(complexity);
    const times: number[] = [];
    let errors = 0;
    let fallbacks = 0;
    
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory;

    console.log(`  🔄 End-to-end test: ${testCode.length} code samples`);

    for (let i = 0; i < this.config.iterations; i++) {
      const code = testCode[i % testCode.length];
      
      try {
        const startTime = performance.now();
        
        // Full pipeline: detect -> parse -> generate -> fallback if needed
        const detectionResult = this.detector.detect(code);
        
        for (const template of detectionResult.templates) {
          try {
            const parseResult = this.parser.parse(code, { filePath: `e2e-${i}.js` });
            await this.api.generateClasses(template.content, { variables: {} });
          } catch (templateError) {
            const fallbackResult = await this.fallbackHandler.processWithFallback(
              template.content,
              { variables: {} },
              templateError instanceof Error ? templateError : new Error(String(templateError))
            );
            if (fallbackResult.success) fallbacks++;
          }
        }
        
        const endTime = performance.now();
        times.push(endTime - startTime);
        
        if (this.config.enableMemoryProfiling && i % 50 === 0) {
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      } catch (error) {
        errors++;
      }
    }

    const finalMemory = process.memoryUsage();
    
    return this.calculateMetrics({
      testName: `e2e-${complexity}`,
      complexity,
      times,
      errors,
      fallbacks,
      cacheHitRate: 0,
      initialMemory,
      peakMemory,
      finalMemory,
    });
  }

  /**
   * Test concurrency stress scenarios
   */
  private async testConcurrencyStress(): Promise<PerformanceMetrics[]> {
    const results: PerformanceMetrics[] = [];
    
    // Test concurrent detection
    const concurrentDetection = await this.runConcurrentTest(
      'concurrent-detection',
      () => this.detector.detect(this.generateTestTemplates('moderate')[0])
    );
    results.push(concurrentDetection);

    // Test concurrent generation
    const concurrentGeneration = await this.runConcurrentTest(
      'concurrent-generation',
      () => this.api.generateClasses(
        'px-4 py-2 ${variant}',
        { variables: { variant: 'bg-blue-500' } }
      )
    );
    results.push(concurrentGeneration);

    return results;
  }

  /**
   * Test memory leak scenarios
   */
  private async testMemoryLeaks(): Promise<PerformanceMetrics> {
    const initialMemory = process.memoryUsage();
    const times: number[] = [];
    let errors = 0;

    console.log('  🧠 Memory leak test: 10000 operations');

    // Run many operations without cleanup
    for (let i = 0; i < 10000; i++) {
      try {
        const startTime = performance.now();
        
        const code = this.generateTestCode('moderate')[0];
        this.detector.detect(code);
        this.parser.parse(code, { filePath: `leak-${i}.js` });
        await this.api.generateClasses(`test-${i}`, { variables: {} });
        
        const endTime = performance.now();
        times.push(endTime - startTime);
      } catch (error) {
        errors++;
      }

      // Force garbage collection periodically
      if (i % 1000 === 0 && global.gc) {
        global.gc();
      }
    }

    const finalMemory = process.memoryUsage();
    
    return this.calculateMetrics({
      testName: 'memory-leak',
      complexity: 'moderate',
      times,
      errors,
      fallbacks: 0,
      cacheHitRate: 0,
      initialMemory,
      peakMemory: finalMemory,
      finalMemory,
    });
  }

  /**
   * Run concurrent test with multiple workers
   */
  private async runConcurrentTest(
    testName: string,
    operation: () => any
  ): Promise<PerformanceMetrics> {
    const times: number[] = [];
    let errors = 0;
    const initialMemory = process.memoryUsage();

    const promises = Array.from({ length: this.config.workerThreads }, async () => {
      for (let i = 0; i < this.config.iterations / this.config.workerThreads; i++) {
        try {
          const startTime = performance.now();
          await operation();
          const endTime = performance.now();
          times.push(endTime - startTime);
        } catch (error) {
          errors++;
        }
      }
    });

    await Promise.all(promises);
    const finalMemory = process.memoryUsage();

    return this.calculateMetrics({
      testName,
      complexity: 'concurrent',
      times,
      errors,
      fallbacks: 0,
      cacheHitRate: 0,
      initialMemory,
      peakMemory: finalMemory,
      finalMemory,
    });
  }

  /**
   * Calculate performance metrics from test data
   */
  private calculateMetrics(data: {
    testName: string;
    complexity: string;
    times: number[];
    errors: number;
    fallbacks: number;
    cacheHitRate: number;
    initialMemory: NodeJS.MemoryUsage;
    peakMemory: NodeJS.MemoryUsage;
    finalMemory: NodeJS.MemoryUsage;
  }): PerformanceMetrics {
    const sortedTimes = data.times.slice().sort((a, b) => a - b);
    const totalTime = data.times.reduce((sum, time) => sum + time, 0);
    
    return {
      testName: data.testName,
      complexity: data.complexity,
      iterations: data.times.length,
      totalTime,
      averageTime: totalTime / data.times.length,
      minTime: Math.min(...data.times),
      maxTime: Math.max(...data.times),
      p95Time: sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0,
      p99Time: sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0,
      throughput: data.times.length / (totalTime / 1000),
      memoryUsage: {
        initial: data.initialMemory.heapUsed / 1024 / 1024,
        peak: data.peakMemory.heapUsed / 1024 / 1024,
        final: data.finalMemory.heapUsed / 1024 / 1024,
        leaked: (data.finalMemory.heapUsed - data.initialMemory.heapUsed) / 1024 / 1024,
      },
      errors: data.errors,
      fallbacks: data.fallbacks,
      cacheHitRate: data.cacheHitRate,
    };
  }

  /**
   * Generate test templates of varying complexity
   */
  private generateTestTemplates(complexity: string): string[] {
    const templates: string[] = [];
    
    switch (complexity) {
      case 'simple':
        templates.push(
          'px-4 py-2',
          'bg-blue-500 text-white',
          'flex items-center justify-center'
        );
        break;
        
      case 'moderate':
        templates.push(
          'px-4 py-2 ${variant === "primary" ? "bg-blue-500" : "bg-gray-500"}',
          'flex items-center ${isLoading ? "opacity-50" : ""} transition-opacity',
          'text-${size} font-${weight} ${color === "primary" ? "text-blue-600" : "text-gray-600"}'
        );
        break;
        
      case 'complex':
        templates.push(
          'px-${spacing.x} py-${spacing.y} ${variant === "primary" ? "bg-blue-500 hover:bg-blue-600" : variant === "secondary" ? "bg-gray-500 hover:bg-gray-600" : "bg-red-500 hover:bg-red-600"}',
          '${breakpoint === "mobile" ? "flex-col space-y-2" : "flex-row space-x-4"} ${theme.dark ? "bg-gray-800 text-white" : "bg-white text-gray-800"}',
          'transition-all duration-${duration} ${isHovered ? "scale-105 shadow-lg" : "scale-100"} ${isFocused ? "ring-2 ring-blue-500" : ""}'
        );
        break;
        
      case 'extreme':
        templates.push(
          '${Object.entries(modifiers).map(([key, value]) => value ? key : "").filter(Boolean).join(" ")} ${computed.classes} ${dynamic[state]} ${theme.colors[color]?.[shade] || fallback}',
          '${Array.from({length: count}, (_, i) => `item-${i} ${i % 2 === 0 ? "even" : "odd"}`).join(" ")} ${conditions.every(c => c) ? "all-true" : "some-false"}',
          'bg-gradient-to-${direction} from-${from} via-${via} to-${to} ${responsive.map(bp => `${bp}:${mobile[bp]}`).join(" ")} ${animations[type]} ${variants[state]?.classes?.join(" ")}'
        );
        break;
    }
    
    return templates;
  }

  /**
   * Generate test code with template literals
   */
  private generateTestCode(complexity: string): string[] {
    const templates = this.generateTestTemplates(complexity);
    return templates.map(template => `
      import React from 'react';
      
      const Component = ({ variant, isLoading, size }) => {
        const classes = \`${template}\`;
        return <div className={classes}>Content</div>;
      };
    `);
  }

  /**
   * Generate bad templates for fallback testing
   */
  private generateBadTemplates(complexity: string): string[] {
    return [
      '${undefined.property}',
      '${nonexistent()}',
      '${circular.ref.circular.ref}',
      '${throw new Error()}',
      '${complex && deeply.nested?.optional?.chaining?.that?.fails}',
    ];
  }

  /**
   * Generate test contexts for class generation
   */
  private generateTestContexts(complexity: string): ProcessingContext[] {
    const contexts: ProcessingContext[] = [];
    
    for (let i = 0; i < 10; i++) {
      contexts.push({
        variables: {
          variant: ['primary', 'secondary', 'danger'][i % 3],
          size: ['sm', 'md', 'lg'][i % 3],
          isLoading: i % 2 === 0,
          spacing: { x: 4, y: 2 },
          theme: { dark: i % 2 === 0 },
          breakpoint: ['mobile', 'tablet', 'desktop'][i % 3],
        },
      });
    }
    
    return contexts;
  }

  /**
   * Analyze performance bottlenecks
   */
  private analyzeBottlenecks(metrics: PerformanceMetrics[]): StressTestResult['bottlenecks'] {
    const bottlenecks: StressTestResult['bottlenecks'] = [];
    
    // Find slowest operations
    const sortedByTime = metrics.slice().sort((a, b) => b.averageTime - a.averageTime);
    
    if (sortedByTime[0]?.averageTime > this.config.thresholds.detectionLatency * 2) {
      bottlenecks.push({
        component: sortedByTime[0].testName.split('-')[0],
        operation: sortedByTime[0].testName,
        impact: 'high',
        recommendation: `Optimize ${sortedByTime[0].testName} - average time ${sortedByTime[0].averageTime.toFixed(2)}ms exceeds threshold`,
      });
    }
    
    // Find memory issues
    const memoryIssues = metrics.filter(m => m.memoryUsage.leaked > 10);
    for (const issue of memoryIssues) {
      bottlenecks.push({
        component: issue.testName.split('-')[0],
        operation: issue.testName,
        impact: 'medium',
        recommendation: `Memory leak detected: ${issue.memoryUsage.leaked.toFixed(2)}MB leaked`,
      });
    }
    
    return bottlenecks;
  }

  /**
   * Detect performance regression against baseline
   */
  private detectPerformanceRegression(metrics: PerformanceMetrics[]): boolean {
    for (const metric of metrics) {
      const baseline = this.baseline.get(metric.testName);
      if (baseline && metric.averageTime > baseline.averageTime * 1.2) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate performance against thresholds
   */
  private validatePerformanceThresholds(metrics: PerformanceMetrics[]): boolean {
    for (const metric of metrics) {
      if (metric.testName.includes('detection') && metric.averageTime > this.config.thresholds.detectionLatency) return false;
      if (metric.testName.includes('parsing') && metric.averageTime > this.config.thresholds.parsingLatency) return false;
      if (metric.testName.includes('generation') && metric.averageTime > this.config.thresholds.generationLatency) return false;
      if (metric.testName.includes('fallback') && metric.averageTime > this.config.thresholds.fallbackLatency) return false;
      if (metric.memoryUsage.peak > this.config.thresholds.memoryUsage) return false;
      if (metric.throughput < this.config.thresholds.throughput) return false;
    }
    return true;
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];
    
    // Analyze cache effectiveness
    const cacheMetrics = metrics.filter(m => m.cacheHitRate > 0);
    const avgCacheHitRate = cacheMetrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / cacheMetrics.length;
    
    if (avgCacheHitRate < 0.8) {
      recommendations.push('Improve caching strategy - current hit rate below 80%');
    }
    
    // Analyze error rates
    const errorMetrics = metrics.filter(m => m.errors > 0);
    if (errorMetrics.length > 0) {
      recommendations.push('Reduce error rates in template processing pipeline');
    }
    
    // Analyze fallback usage
    const fallbackMetrics = metrics.filter(m => m.fallbacks > 0);
    if (fallbackMetrics.length > 0) {
      recommendations.push('Optimize primary processing to reduce fallback reliance');
    }
    
    return recommendations;
  }

  /**
   * Set performance baseline for regression testing
   */
  setBaseline(metrics: PerformanceMetrics[]): void {
    this.baseline.clear();
    for (const metric of metrics) {
      this.baseline.set(metric.testName, metric);
    }
    console.log(`📊 Performance baseline set with ${metrics.length} metrics`);
  }

  /**
   * Generate performance report
   */
  generateReport(result: StressTestResult): string {
    const report = [
      '# Template Literal Performance Test Report',
      '',
      `## Test Summary`,
      `- Test Suite: ${result.testSuite}`,
      `- Total Tests: ${result.metrics.length}`,
      `- Regression Detected: ${result.regressionDetected ? '❌' : '✅'}`,
      `- Thresholds Passed: ${result.passedThresholds ? '✅' : '❌'}`,
      '',
      '## Performance Metrics',
      '',
    ];

    for (const metric of result.metrics) {
      report.push(`### ${metric.testName} (${metric.complexity})`);
      report.push(`- Average Time: ${metric.averageTime.toFixed(2)}ms`);
      report.push(`- P95 Time: ${metric.p95Time.toFixed(2)}ms`);
      report.push(`- Throughput: ${metric.throughput.toFixed(0)} ops/sec`);
      report.push(`- Memory Peak: ${metric.memoryUsage.peak.toFixed(2)}MB`);
      report.push(`- Errors: ${metric.errors}`);
      report.push(`- Cache Hit Rate: ${(metric.cacheHitRate * 100).toFixed(1)}%`);
      report.push('');
    }

    if (result.bottlenecks.length > 0) {
      report.push('## Bottlenecks');
      for (const bottleneck of result.bottlenecks) {
        report.push(`- **${bottleneck.component}** (${bottleneck.impact}): ${bottleneck.recommendation}`);
      }
      report.push('');
    }

    if (result.optimizationRecommendations.length > 0) {
      report.push('## Optimization Recommendations');
      for (const rec of result.optimizationRecommendations) {
        report.push(`- ${rec}`);
      }
    }

    return report.join('\n');
  }
}

export default TemplateLiteralPerformanceTester;