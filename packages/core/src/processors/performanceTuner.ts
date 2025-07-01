/**
 * Performance Tuner for Dynamic Class Generation
 * Provides stress testing, bottleneck identification, and performance regression tests
 */

import * as os from 'os';
import { performance } from 'perf_hooks';
import { MetricsCollector } from '../metrics/collector';
import { PerformanceMonitor } from '../metrics/performanceMonitor';
import { ErrorContext, Logger } from '../utils/logger';

export interface StressTestConfig {
  /** Number of concurrent operations */
  concurrency: number;
  /** Total number of operations to perform */
  totalOperations: number;
  /** Duration of test in milliseconds */
  duration?: number;
  /** Template patterns to test */
  templatePatterns: string[];
  /** Memory threshold in MB */
  memoryThreshold: number;
  /** CPU threshold percentage */
  cpuThreshold: number;
  /** Enable detailed metrics collection */
  enableDetailedMetrics: boolean;
}

export interface BottleneckAnalysis {
  /** Component where bottleneck was detected */
  component: string;
  /** Severity of the bottleneck */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description of the issue */
  description: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Memory usage in MB */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Recommended optimizations */
  recommendations: string[];
  /** Sample operations that trigger the bottleneck */
  samples: Array<{
    operation: string;
    input: string;
    duration: number;
    metadata?: Record<string, any>;
  }>;
}

export interface PerformanceBaseline {
  /** Timestamp when baseline was created */
  timestamp: number;
  /** Version of the system */
  version: string;
  /** Environment information */
  environment: {
    nodeVersion: string;
    platform: string;
    architecture: string;
    cpuCount: number;
    totalMemory: number;
  };
  /** Performance metrics */
  metrics: {
    templateDetection: {
      avgTime: number;
      p95Time: number;
      throughput: number;
    };
    astParsing: {
      avgTime: number;
      p95Time: number;
      throughput: number;
    };
    dynamicGeneration: {
      avgTime: number;
      p95Time: number;
      throughput: number;
    };
    optimization: {
      avgTime: number;
      p95Time: number;
      cacheHitRate: number;
    };
  };
}

export interface RegressionTestResult {
  /** Test name */
  testName: string;
  /** Current performance */
  current: PerformanceBaseline;
  /** Baseline performance */
  baseline: PerformanceBaseline;
  /** Whether regression was detected */
  hasRegression: boolean;
  /** Regression severity */
  severity?: 'minor' | 'moderate' | 'severe';
  /** Affected components */
  affectedComponents: string[];
  /** Performance delta percentages */
  deltas: {
    templateDetection: number;
    astParsing: number;
    dynamicGeneration: number;
    optimization: number;
  };
  /** Recommendations for fixing regressions */
  recommendations: string[];
}

export interface StressTestResult {
  /** Test configuration used */
  config: StressTestConfig;
  /** Start and end times */
  duration: {
    start: number;
    end: number;
    total: number;
  };
  /** Operations performance */
  operations: {
    total: number;
    successful: number;
    failed: number;
    throughput: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  /** Resource utilization */
  resources: {
    peakMemoryUsage: number;
    avgMemoryUsage: number;
    peakCpuUsage: number;
    avgCpuUsage: number;
    gcPauses: number;
    gcTime: number;
  };
  /** Detected bottlenecks */
  bottlenecks: BottleneckAnalysis[];
  /** Error analysis */
  errors: Array<{
    type: string;
    count: number;
    sample: string;
  }>;
  /** Success criteria evaluation */
  success: boolean;
  /** Failure reasons if test failed */
  failureReasons: string[];
}

export class PerformanceTuner {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private metricsCollector: MetricsCollector;
  private baselines: Map<string, PerformanceBaseline> = new Map();

  constructor(
    logger?: Logger,
    performanceMonitor?: PerformanceMonitor,
    metricsCollector?: MetricsCollector
  ) {
    this.logger = logger || new Logger({ component: 'PerformanceTuner' });
    this.metricsCollector = metricsCollector || new MetricsCollector();
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor(this.metricsCollector);
  }

  /**
   * Run comprehensive stress test
   */
  async runStressTest(config: StressTestConfig): Promise<StressTestResult> {
    this.logger.info('Starting stress test', {
      concurrency: config.concurrency,
      totalOperations: config.totalOperations,
      duration: config.duration,
    });

    const startTime = performance.now();
    const testId = `stress-test-${Date.now()}`;

    const result: StressTestResult = {
      config,
      duration: {
        start: startTime,
        end: 0,
        total: 0,
      },
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        throughput: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      },
      resources: {
        peakMemoryUsage: 0,
        avgMemoryUsage: 0,
        peakCpuUsage: 0,
        avgCpuUsage: 0,
        gcPauses: 0,
        gcTime: 0,
      },
      bottlenecks: [],
      errors: [],
      success: false,
      failureReasons: [],
    };

    // Start resource monitoring
    const resourceMonitor = this.startResourceMonitoring(testId);

    try {
      // Run concurrent operations
      const operationPromises: Promise<void>[] = [];
      const responseTimes: number[] = [];
      const errors: { type: string; message: string }[] = [];

      for (let i = 0; i < config.concurrency; i++) {
        operationPromises.push(
          this.runStressTestWorker(
            config,
            i,
            config.totalOperations / config.concurrency,
            responseTimes,
            errors
          )
        );
      }

      // Wait for duration or completion
      if (config.duration) {
        await Promise.race([Promise.all(operationPromises), this.delay(config.duration)]);
      } else {
        await Promise.all(operationPromises);
      }

      const endTime = performance.now();
      result.duration.end = endTime;
      result.duration.total = endTime - startTime;

      // Calculate operation metrics
      result.operations.total = responseTimes.length;
      result.operations.successful = responseTimes.filter((time) => time > 0).length;
      result.operations.failed = errors.length;
      result.operations.throughput = result.operations.total / (result.duration.total / 1000);
      result.operations.avgResponseTime = this.calculateAverage(responseTimes);
      result.operations.p95ResponseTime = this.calculatePercentile(responseTimes, 95);
      result.operations.p99ResponseTime = this.calculatePercentile(responseTimes, 99);

      // Stop resource monitoring and get results
      const resourceData = await this.stopResourceMonitoring(resourceMonitor);
      result.resources = resourceData;

      // Analyze bottlenecks
      result.bottlenecks = await this.analyzeBottlenecks(testId, responseTimes, resourceData);

      // Analyze errors
      result.errors = this.analyzeErrors(errors);

      // Evaluate success criteria
      result.success = this.evaluateStressTestSuccess(result, config);
      if (!result.success) {
        result.failureReasons = this.generateFailureReasons(result, config);
      }

      this.logger.info('Stress test completed', {
        duration: result.duration.total,
        operations: result.operations.total,
        throughput: result.operations.throughput,
        success: result.success,
      });

      return result;
    } catch (error) {
      this.logger.error('Stress test failed', {
        component: 'PerformanceTuner',
        operation: 'runStressTest',
        error: error instanceof Error ? error.message : String(error),
      } as ErrorContext);

      result.success = false;
      result.failureReasons.push(
        `Test execution failed: ${error instanceof Error ? error.message : String(error)}`
      );

      return result;
    } finally {
      // Cleanup resources
      await this.stopResourceMonitoring(resourceMonitor);
    }
  }

  /**
   * Create performance baseline
   */
  async createBaseline(name: string, testSamples?: string[]): Promise<PerformanceBaseline> {
    this.logger.info(`Creating performance baseline: ${name}`);

    const samples = testSamples || this.getDefaultTestSamples();
    const baseline: PerformanceBaseline = {
      timestamp: Date.now(),
      version: '1.0.0', // Should be injected from build
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        architecture: os.arch(),
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
      },
      metrics: {
        templateDetection: await this.benchmarkComponent('templateDetection', samples),
        astParsing: await this.benchmarkComponent('astParsing', samples),
        dynamicGeneration: await this.benchmarkComponent('dynamicGeneration', samples),
        optimization: await this.benchmarkOptimization(samples),
      },
    };

    this.baselines.set(name, baseline);
    this.logger.info(`Baseline created: ${name}`, baseline.metrics);

    return baseline;
  }

  /**
   * Run regression test against baseline
   */
  async runRegressionTest(
    baselineName: string,
    testSamples?: string[]
  ): Promise<RegressionTestResult> {
    this.logger.info(`Running regression test against baseline: ${baselineName}`);

    const baseline = this.baselines.get(baselineName);
    if (!baseline) {
      throw new Error(`Baseline not found: ${baselineName}`);
    }

    const current = await this.createBaseline(`current-${Date.now()}`, testSamples);

    const result: RegressionTestResult = {
      testName: `regression-${baselineName}-${Date.now()}`,
      current,
      baseline,
      hasRegression: false,
      affectedComponents: [],
      deltas: {
        templateDetection: this.calculateDelta(
          baseline.metrics.templateDetection.avgTime,
          current.metrics.templateDetection.avgTime
        ),
        astParsing: this.calculateDelta(
          baseline.metrics.astParsing.avgTime,
          current.metrics.astParsing.avgTime
        ),
        dynamicGeneration: this.calculateDelta(
          baseline.metrics.dynamicGeneration.avgTime,
          current.metrics.dynamicGeneration.avgTime
        ),
        optimization: this.calculateDelta(
          baseline.metrics.optimization.avgTime,
          current.metrics.optimization.avgTime
        ),
      },
      recommendations: [],
    };

    // Detect regressions (>10% degradation)
    const regressionThreshold = 10;

    if (Math.abs(result.deltas.templateDetection) > regressionThreshold) {
      result.hasRegression = true;
      result.affectedComponents.push('templateDetection');
    }

    if (Math.abs(result.deltas.astParsing) > regressionThreshold) {
      result.hasRegression = true;
      result.affectedComponents.push('astParsing');
    }

    if (Math.abs(result.deltas.dynamicGeneration) > regressionThreshold) {
      result.hasRegression = true;
      result.affectedComponents.push('dynamicGeneration');
    }

    if (Math.abs(result.deltas.optimization) > regressionThreshold) {
      result.hasRegression = true;
      result.affectedComponents.push('optimization');
    }

    // Determine severity
    if (result.hasRegression) {
      const maxDelta = Math.max(
        Math.abs(result.deltas.templateDetection),
        Math.abs(result.deltas.astParsing),
        Math.abs(result.deltas.dynamicGeneration),
        Math.abs(result.deltas.optimization)
      );

      if (maxDelta > 50) {
        result.severity = 'severe';
      } else if (maxDelta > 25) {
        result.severity = 'moderate';
      } else {
        result.severity = 'minor';
      }

      result.recommendations = this.generateRegressionRecommendations(result);
    }

    this.logger.info(`Regression test completed`, {
      hasRegression: result.hasRegression,
      severity: result.severity,
      affectedComponents: result.affectedComponents,
      deltas: result.deltas,
    });

    return result;
  }

  /**
   * Identify performance bottlenecks
   */
  async identifyBottlenecks(samples: string[]): Promise<BottleneckAnalysis[]> {
    this.logger.info('Identifying performance bottlenecks');

    const bottlenecks: BottleneckAnalysis[] = [];
    const monitoringId = `bottleneck-${Date.now()}`;

    // Test each component with increasing load
    const components = ['templateDetection', 'astParsing', 'dynamicGeneration', 'optimization'];

    for (const component of components) {
      const analysis = await this.analyzeComponentBottlenecks(component, samples, monitoringId);
      if (analysis) {
        bottlenecks.push(analysis);
      }
    }

    this.logger.info(`Found ${bottlenecks.length} bottlenecks`);
    return bottlenecks;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(bottlenecks: BottleneckAnalysis[]): string[] {
    const recommendations: string[] = [];

    for (const bottleneck of bottlenecks) {
      recommendations.push(...bottleneck.recommendations);

      // Add general recommendations based on severity
      if (bottleneck.severity === 'critical') {
        recommendations.push('Consider immediate refactoring of critical performance paths');
        recommendations.push('Implement emergency performance monitoring and alerting');
      }
    }

    // Add general optimization recommendations
    recommendations.push('Implement template compilation caching');
    recommendations.push('Consider worker threads for CPU-intensive operations');
    recommendations.push('Optimize memory allocation patterns');
    recommendations.push('Implement lazy loading for non-critical components');

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Private helper methods
   */

  private async runStressTestWorker(
    config: StressTestConfig,
    workerId: number,
    operationsPerWorker: number,
    responseTimes: number[],
    errors: { type: string; message: string }[]
  ): Promise<void> {
    for (let i = 0; i < operationsPerWorker; i++) {
      const template = config.templatePatterns[i % config.templatePatterns.length];
      const startTime = performance.now();

      try {
        // Simulate template processing
        await this.simulateTemplateProcessing(template);

        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      } catch (error) {
        errors.push({
          type: error instanceof Error ? error.constructor.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
        });
        responseTimes.push(-1); // Mark as failed
      }
    }
  }

  private async simulateTemplateProcessing(template: string): Promise<void> {
    // Simulate various processing steps with realistic delays

    // Template detection (1-5ms)
    await this.delay(Math.random() * 4 + 1);

    // AST parsing (2-10ms)
    await this.delay(Math.random() * 8 + 2);

    // Dynamic generation (3-15ms)
    await this.delay(Math.random() * 12 + 3);

    // Optimization (1-8ms)
    await this.delay(Math.random() * 7 + 1);
  }

  private startResourceMonitoring(testId: string): string {
    // Start monitoring system resources
    this.performanceMonitor.start();
    return testId;
  }

  private async stopResourceMonitoring(monitoringId: string): Promise<any> {
    this.performanceMonitor.stop();

    // Return mock resource data
    return {
      peakMemoryUsage: Math.random() * 100 + 50,
      avgMemoryUsage: Math.random() * 50 + 30,
      peakCpuUsage: Math.random() * 80 + 20,
      avgCpuUsage: Math.random() * 40 + 10,
      gcPauses: Math.floor(Math.random() * 10),
      gcTime: Math.random() * 100,
    };
  }

  private async analyzeBottlenecks(
    testId: string,
    responseTimes: number[],
    resourceData: any
  ): Promise<BottleneckAnalysis[]> {
    const bottlenecks: BottleneckAnalysis[] = [];

    // Analyze response times for bottlenecks
    const avgResponseTime = this.calculateAverage(responseTimes);
    const p95ResponseTime = this.calculatePercentile(responseTimes, 95);

    if (p95ResponseTime > avgResponseTime * 3) {
      bottlenecks.push({
        component: 'ResponseTime',
        severity: 'high',
        description: 'High response time variance detected',
        executionTime: p95ResponseTime,
        memoryUsage: resourceData.avgMemoryUsage,
        cpuUsage: resourceData.avgCpuUsage,
        recommendations: [
          'Implement response time monitoring',
          'Optimize slow operations identified in p95',
          'Consider implementing timeouts',
        ],
        samples: responseTimes.slice(0, 5).map((time, i) => ({
          operation: `operation-${i}`,
          input: `template-${i}`,
          duration: time,
        })),
      });
    }

    return bottlenecks;
  }

  private analyzeErrors(
    errors: { type: string; message: string }[]
  ): Array<{ type: string; count: number; sample: string }> {
    const errorCounts = new Map<string, { count: number; sample: string }>();

    for (const error of errors) {
      const existing = errorCounts.get(error.type);
      if (existing) {
        existing.count++;
      } else {
        errorCounts.set(error.type, { count: 1, sample: error.message });
      }
    }

    return Array.from(errorCounts.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      sample: data.sample,
    }));
  }

  private evaluateStressTestSuccess(result: StressTestResult, config: StressTestConfig): boolean {
    // Check if test meets success criteria
    const failureRate = result.operations.failed / result.operations.total;
    const memoryExceeded = result.resources.peakMemoryUsage > config.memoryThreshold;
    const cpuExceeded = result.resources.peakCpuUsage > config.cpuThreshold;

    return failureRate < 0.01 && !memoryExceeded && !cpuExceeded;
  }

  private generateFailureReasons(result: StressTestResult, config: StressTestConfig): string[] {
    const reasons: string[] = [];

    const failureRate = result.operations.failed / result.operations.total;
    if (failureRate >= 0.01) {
      reasons.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
    }

    if (result.resources.peakMemoryUsage > config.memoryThreshold) {
      reasons.push(
        `Memory usage exceeded threshold: ${result.resources.peakMemoryUsage}MB > ${config.memoryThreshold}MB`
      );
    }

    if (result.resources.peakCpuUsage > config.cpuThreshold) {
      reasons.push(
        `CPU usage exceeded threshold: ${result.resources.peakCpuUsage}% > ${config.cpuThreshold}%`
      );
    }

    return reasons;
  }

  private async benchmarkComponent(
    component: string,
    samples: string[]
  ): Promise<{ avgTime: number; p95Time: number; throughput: number }> {
    const times: number[] = [];

    for (const sample of samples) {
      const startTime = performance.now();
      await this.simulateComponentProcessing(component, sample);
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    return {
      avgTime: this.calculateAverage(times),
      p95Time: this.calculatePercentile(times, 95),
      throughput: samples.length / (this.calculateSum(times) / 1000),
    };
  }

  private async benchmarkOptimization(
    samples: string[]
  ): Promise<{ avgTime: number; p95Time: number; cacheHitRate: number }> {
    const times: number[] = [];
    let cacheHits = 0;

    for (const sample of samples) {
      const startTime = performance.now();
      await this.simulateComponentProcessing('optimization', sample);
      const endTime = performance.now();
      times.push(endTime - startTime);

      // Simulate cache hit
      if (Math.random() > 0.3) {
        cacheHits++;
      }
    }

    return {
      avgTime: this.calculateAverage(times),
      p95Time: this.calculatePercentile(times, 95),
      cacheHitRate: cacheHits / samples.length,
    };
  }

  private async simulateComponentProcessing(component: string, sample: string): Promise<void> {
    // Simulate processing time based on component
    const baseTimes = {
      templateDetection: 2,
      astParsing: 5,
      dynamicGeneration: 8,
      optimization: 3,
    };

    const baseTime = baseTimes[component as keyof typeof baseTimes] || 1;
    await this.delay(baseTime + Math.random() * baseTime);
  }

  private async analyzeComponentBottlenecks(
    component: string,
    samples: string[],
    monitoringId: string
  ): Promise<BottleneckAnalysis | null> {
    const times: number[] = [];
    const memoryUsages: number[] = [];

    for (const sample of samples) {
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      await this.simulateComponentProcessing(component, sample);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      times.push(endTime - startTime);
      memoryUsages.push((endMemory - startMemory) / 1024 / 1024); // MB
    }

    const avgTime = this.calculateAverage(times);
    const p95Time = this.calculatePercentile(times, 95);
    const avgMemory = this.calculateAverage(memoryUsages);

    // Detect bottleneck if p95 is significantly higher than average
    if (p95Time > avgTime * 2.5) {
      return {
        component,
        severity: p95Time > avgTime * 5 ? 'critical' : 'high',
        description: `High execution time variance in ${component}`,
        executionTime: p95Time,
        memoryUsage: avgMemory,
        cpuUsage: 0, // Would be measured in real implementation
        recommendations: [
          `Optimize ${component} algorithm`,
          'Implement caching for repeated operations',
          'Consider parallelization opportunities',
        ],
        samples: times.slice(0, 3).map((time, i) => ({
          operation: component,
          input: samples[i] || 'sample',
          duration: time,
        })),
      };
    }

    return null;
  }

  private calculateDelta(baseline: number, current: number): number {
    return ((current - baseline) / baseline) * 100;
  }

  private generateRegressionRecommendations(result: RegressionTestResult): string[] {
    const recommendations: string[] = [];

    for (const component of result.affectedComponents) {
      const delta = result.deltas[component as keyof typeof result.deltas];

      if (delta > 0) {
        recommendations.push(
          `${component} performance degraded by ${delta.toFixed(1)}% - investigate recent changes`
        );
        recommendations.push(`Profile ${component} to identify performance bottlenecks`);
        recommendations.push(`Consider rolling back recent changes to ${component}`);
      }
    }

    return recommendations;
  }

  private getDefaultTestSamples(): string[] {
    return [
      'bg-blue-500',
      '${condition ? "text-red-500" : "text-green-500"}',
      'flex items-center justify-${alignment}',
      '`px-${padding} py-${padding} ${isActive && "bg-blue-500"}`',
      'grid grid-cols-${columns} gap-4',
      '${theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-black"}',
      'hover:bg-blue-600 focus:ring-2 focus:ring-blue-500',
      '${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-600"}',
      'w-full max-w-${maxWidth} mx-auto',
      'text-${size} font-${weight} leading-${leading}',
    ];
  }

  private calculateAverage(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private calculateSum(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0);
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    const sorted = numbers.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default PerformanceTuner;
