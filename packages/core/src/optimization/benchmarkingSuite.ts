/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Comprehensive Benchmarking and Performance Testing Suite
 *
 * Provides automated performance benchmarks, regression detection,
 * statistical analysis, and detailed performance reporting for optimization validation.
 */

import { EventEmitter } from 'events';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { cpus } from 'os';
import path from 'path';
import { performance } from 'perf_hooks';

/**
 * Benchmark configuration interface
 */
export interface BenchmarkConfig {
  name: string;
  description?: string;
  iterations: number;
  warmupIterations: number;
  timeout: number;
  enableProfiling: boolean;
  memoryTracking: boolean;
  cpuTracking: boolean;
  tags: string[];
  baseline?: BenchmarkResult;
  thresholds: {
    performance: number;
    memory: number;
    cpu: number;
  };
}

/**
 * Benchmark execution result
 */
export interface BenchmarkResult {
  name: string;
  timestamp: number;
  iterations: number;
  duration: {
    total: number;
    average: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    stdDev: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    peak: number;
    leaked: number;
  };
  cpu: {
    user: number;
    system: number;
    total: number;
    utilization: number;
  };
  operations: {
    opsPerSecond: number;
    throughput: number;
    latency: number;
  };
  metadata: {
    nodeVersion: string;
    platform: string;
    cpuCores: number;
    memoryTotal: number;
    tags: string[];
  };
  regression?: RegressionAnalysis;
}

/**
 * Regression analysis result
 */
export interface RegressionAnalysis {
  isRegression: boolean;
  severity: 'none' | 'minor' | 'major' | 'critical';
  performanceChange: number;
  memoryChange: number;
  cpuChange: number;
  confidence: number;
  recommendation: string;
}

/**
 * Benchmark suite configuration
 */
export interface BenchmarkSuiteConfig {
  outputDir: string;
  enableReporting: boolean;
  enableRegression: boolean;
  autoBaseline: boolean;
  parallelExecution: boolean;
  retryFailures: number;
  reportFormat: 'json' | 'html' | 'csv' | 'all';
  comparison: {
    enabled: boolean;
    baselineFile?: string;
    tolerance: number;
  };
}

/**
 * Benchmark execution context
 */
interface BenchmarkContext {
  config: BenchmarkConfig;
  startTime: number;
  endTime: number;
  iterations: number[];
  memorySnapshots: any[];
  cpuSnapshots: any[];
  errors: Error[];
  warnings: string[];
}

/**
 * Performance test case
 */
export interface PerformanceTestCase {
  name: string;
  setup?: () => Promise<any>;
  test: (context: any) => Promise<any>;
  teardown?: (context: any) => Promise<void>;
  validate?: (result: any) => boolean;
  config: Partial<BenchmarkConfig>;
}

/**
 * Comprehensive benchmarking and performance testing suite
 */
export class BenchmarkingSuite extends EventEmitter {
  private config: BenchmarkSuiteConfig;
  private results: Map<string, BenchmarkResult[]> = new Map();
  private baselines: Map<string, BenchmarkResult> = new Map();
  private testCases: Map<string, PerformanceTestCase> = new Map();
  private isRunning = false;
  private abortController = new AbortController();

  constructor(config: Partial<BenchmarkSuiteConfig> = {}) {
    super();
    this.config = {
      outputDir: './benchmark-results',
      enableReporting: true,
      enableRegression: true,
      autoBaseline: false,
      parallelExecution: true,
      retryFailures: 3,
      reportFormat: 'all',
      comparison: {
        enabled: true,
        tolerance: 0.05, // 5% tolerance
      },
      ...config,
    };

    this.setupOutputDirectory();
    this.loadBaselines();
  }

  /**
   * Register a performance test case
   */
  public registerTest(testCase: PerformanceTestCase): void {
    this.testCases.set(testCase.name, testCase);
    this.emit('testRegistered', testCase.name);
  }

  /**
   * Run a single benchmark
   */
  public async runBenchmark(
    name: string,
    testFunction: () => Promise<any>,
    config: Partial<BenchmarkConfig> = {}
  ): Promise<BenchmarkResult> {
    const benchmarkConfig: BenchmarkConfig = {
      name,
      iterations: 100,
      warmupIterations: 10,
      timeout: 30000,
      enableProfiling: false,
      memoryTracking: true,
      cpuTracking: true,
      tags: [],
      thresholds: {
        performance: 1.2, // 20% slower than baseline
        memory: 1.5, // 50% more memory than baseline
        cpu: 1.3, // 30% more CPU than baseline
      },
      ...config,
    };

    this.emit('benchmarkStarted', name);

    const context: BenchmarkContext = {
      config: benchmarkConfig,
      startTime: 0,
      endTime: 0,
      iterations: [],
      memorySnapshots: [],
      cpuSnapshots: [],
      errors: [],
      warnings: [],
    };

    try {
      // Warmup phase
      await this.runWarmup(testFunction, benchmarkConfig.warmupIterations);

      // Garbage collection before measurement
      if (global.gc) {
        global.gc();
      }

      // Main benchmark execution
      context.startTime = performance.now();
      await this.executeBenchmark(context, testFunction);
      context.endTime = performance.now();

      // Analyze results
      const result = this.analyzeResults(context);

      // Regression analysis
      if (this.config.enableRegression) {
        result.regression = this.performRegressionAnalysis(result);
      }

      // Store result
      this.storeResult(result);

      this.emit('benchmarkCompleted', result);
      return result;
    } catch (error) {
      this.emit('benchmarkFailed', name, error);
      throw error;
    }
  }

  /**
   * Run all registered test cases
   */
  public async runAllTests(): Promise<Map<string, BenchmarkResult>> {
    if (this.isRunning) {
      throw new Error('Benchmark suite is already running');
    }

    this.isRunning = true;
    const results = new Map<string, BenchmarkResult>();

    try {
      this.emit('suiteStarted', this.testCases.size);

      if (this.config.parallelExecution) {
        await this.runTestsInParallel(results);
      } else {
        await this.runTestsSequentially(results);
      }

      // Generate reports
      if (this.config.enableReporting) {
        await this.generateReports(results);
      }

      this.emit('suiteCompleted', results);
      return results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run tests in parallel
   */
  private async runTestsInParallel(results: Map<string, BenchmarkResult>): Promise<void> {
    const promises = Array.from(this.testCases.entries()).map(async ([name, testCase]) => {
      try {
        const result = await this.runTestCase(testCase);
        results.set(name, result);
      } catch (error) {
        this.emit('testFailed', name, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Run tests sequentially
   */
  private async runTestsSequentially(results: Map<string, BenchmarkResult>): Promise<void> {
    for (const [name, testCase] of this.testCases.entries()) {
      try {
        const result = await this.runTestCase(testCase);
        results.set(name, result);
      } catch (error) {
        this.emit('testFailed', name, error);
      }
    }
  }

  /**
   * Run a single test case
   */
  private async runTestCase(testCase: PerformanceTestCase): Promise<BenchmarkResult> {
    let context: any;

    try {
      // Setup
      if (testCase.setup) {
        context = await testCase.setup();
      }

      // Run benchmark
      const result = await this.runBenchmark(
        testCase.name,
        () => testCase.test(context),
        testCase.config
      );

      // Validate result
      if (testCase.validate && !testCase.validate(result)) {
        throw new Error(`Validation failed for test case: ${testCase.name}`);
      }

      return result;
    } finally {
      // Cleanup
      if (testCase.teardown) {
        await testCase.teardown(context);
      }
    }
  }

  /**
   * Execute warmup iterations
   */
  private async runWarmup(testFunction: () => Promise<any>, iterations: number): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      await testFunction();
    }
  }

  /**
   * Execute benchmark iterations
   */
  private async executeBenchmark(
    context: BenchmarkContext,
    testFunction: () => Promise<any>
  ): Promise<void> {
    for (let i = 0; i < context.config.iterations; i++) {
      // Memory snapshot before
      if (context.config.memoryTracking) {
        context.memorySnapshots.push({
          iteration: i,
          before: process.memoryUsage(),
          timestamp: performance.now(),
        });
      }

      // CPU snapshot before
      if (context.config.cpuTracking) {
        context.cpuSnapshots.push({
          iteration: i,
          before: process.cpuUsage(),
          timestamp: performance.now(),
        });
      }

      // Execute test
      const start = performance.now();
      try {
        await testFunction();
      } catch (error) {
        context.errors.push(error as Error);
      }
      const end = performance.now();

      context.iterations.push(end - start);

      // Memory snapshot after
      if (context.config.memoryTracking) {
        const snapshot = context.memorySnapshots[context.memorySnapshots.length - 1];
        snapshot.after = process.memoryUsage();
      }

      // CPU snapshot after
      if (context.config.cpuTracking) {
        const snapshot = context.cpuSnapshots[context.cpuSnapshots.length - 1];
        snapshot.after = process.cpuUsage();
      }

      // Check for abort signal
      if (this.abortController.signal.aborted) {
        throw new Error('Benchmark aborted');
      }
    }
  }

  /**
   * Analyze benchmark results
   */
  private analyzeResults(context: BenchmarkContext): BenchmarkResult {
    const iterations = context.iterations.filter((time) => time > 0);
    const sortedTimes = [...iterations].sort((a, b) => a - b);

    // Duration statistics
    const total = iterations.reduce((sum, time) => sum + time, 0);
    const average = total / iterations.length;
    const median = this.calculatePercentile(sortedTimes, 0.5);
    const p95 = this.calculatePercentile(sortedTimes, 0.95);
    const p99 = this.calculatePercentile(sortedTimes, 0.99);
    const min = Math.min(...iterations);
    const max = Math.max(...iterations);
    const stdDev = this.calculateStandardDeviation(iterations, average);

    // Memory analysis
    const memoryStats = this.analyzeMemoryUsage(context.memorySnapshots);

    // CPU analysis
    const cpuStats = this.analyzeCpuUsage(context.cpuSnapshots);

    // Operations per second
    const opsPerSecond = 1000 / average; // Convert ms to ops/sec

    return {
      name: context.config.name,
      timestamp: Date.now(),
      iterations: iterations.length,
      duration: {
        total,
        average,
        median,
        p95,
        p99,
        min,
        max,
        stdDev,
      },
      memory: memoryStats,
      cpu: cpuStats,
      operations: {
        opsPerSecond,
        throughput: opsPerSecond * 1000, // ops per second * 1000
        latency: average,
      },
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuCores: cpus().length,
        memoryTotal: require('os').totalmem(),
        tags: context.config.tags,
      },
    };
  }

  /**
   * Analyze memory usage from snapshots
   */
  private analyzeMemoryUsage(snapshots: any[]): BenchmarkResult['memory'] {
    if (snapshots.length === 0) {
      return {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0,
        peak: 0,
        leaked: 0,
      };
    }

    const heapUsedValues = snapshots.map((s) => s.after?.heapUsed || s.before?.heapUsed || 0);
    const heapTotalValues = snapshots.map((s) => s.after?.heapTotal || s.before?.heapTotal || 0);
    const externalValues = snapshots.map((s) => s.after?.external || s.before?.external || 0);
    const arrayBufferValues = snapshots.map(
      (s) => s.after?.arrayBuffers || s.before?.arrayBuffers || 0
    );

    const firstSnapshot = snapshots[0].before;
    const lastSnapshot =
      snapshots[snapshots.length - 1].after || snapshots[snapshots.length - 1].before;

    return {
      heapUsed: this.calculateAverage(heapUsedValues),
      heapTotal: this.calculateAverage(heapTotalValues),
      external: this.calculateAverage(externalValues),
      arrayBuffers: this.calculateAverage(arrayBufferValues),
      peak: Math.max(...heapUsedValues),
      leaked: lastSnapshot?.heapUsed - firstSnapshot?.heapUsed || 0,
    };
  }

  /**
   * Analyze CPU usage from snapshots
   */
  private analyzeCpuUsage(snapshots: any[]): BenchmarkResult['cpu'] {
    if (snapshots.length === 0) {
      return {
        user: 0,
        system: 0,
        total: 0,
        utilization: 0,
      };
    }

    const userTimes = snapshots.map((s) => {
      const before = s.before || { user: 0 };
      const after = s.after || s.before || { user: 0 };
      return (after.user - before.user) / 1000; // Convert to ms
    });

    const systemTimes = snapshots.map((s) => {
      const before = s.before || { system: 0 };
      const after = s.after || s.before || { system: 0 };
      return (after.system - before.system) / 1000; // Convert to ms
    });

    const avgUser = this.calculateAverage(userTimes);
    const avgSystem = this.calculateAverage(systemTimes);
    const total = avgUser + avgSystem;

    return {
      user: avgUser,
      system: avgSystem,
      total,
      utilization: (total / cpus().length) * 100, // Percentage utilization
    };
  }

  /**
   * Perform regression analysis
   */
  private performRegressionAnalysis(result: BenchmarkResult): RegressionAnalysis {
    const baseline = this.baselines.get(result.name);

    if (!baseline) {
      return {
        isRegression: false,
        severity: 'none',
        performanceChange: 0,
        memoryChange: 0,
        cpuChange: 0,
        confidence: 0,
        recommendation: 'No baseline available for comparison',
      };
    }

    const performanceChange =
      (result.duration.average - baseline.duration.average) / baseline.duration.average;
    const memoryChange =
      (result.memory.heapUsed - baseline.memory.heapUsed) / baseline.memory.heapUsed;
    const cpuChange = (result.cpu.total - baseline.cpu.total) / baseline.cpu.total;

    const isPerformanceRegression =
      performanceChange > result.metadata.tags.includes('performance') ? 0.05 : 0.1;
    const isMemoryRegression = memoryChange > 0.2;
    const isCpuRegression = cpuChange > 0.15;

    const isRegression = isPerformanceRegression || isMemoryRegression || isCpuRegression;

    let severity: RegressionAnalysis['severity'] = 'none';
    if (isRegression) {
      const maxChange = Math.max(
        Math.abs(performanceChange),
        Math.abs(memoryChange),
        Math.abs(cpuChange)
      );
      if (maxChange > 0.5) severity = 'critical';
      else if (maxChange > 0.3) severity = 'major';
      else severity = 'minor';
    }

    const confidence = this.calculateConfidence(result, baseline);

    return {
      isRegression,
      severity,
      performanceChange,
      memoryChange,
      cpuChange,
      confidence,
      recommendation: this.generateRecommendation(
        isRegression,
        severity,
        performanceChange,
        memoryChange,
        cpuChange
      ),
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendation(
    isRegression: boolean,
    severity: RegressionAnalysis['severity'],
    perfChange: number,
    memChange: number,
    cpuChange: number
  ): string {
    if (!isRegression) {
      return 'Performance is within acceptable bounds or has improved';
    }

    const recommendations: string[] = [];

    if (perfChange > 0.1) {
      recommendations.push('Consider optimizing algorithm complexity or data structures');
    }

    if (memChange > 0.2) {
      recommendations.push('Investigate memory leaks or optimize memory usage patterns');
    }

    if (cpuChange > 0.15) {
      recommendations.push('Review CPU-intensive operations and consider parallelization');
    }

    if (severity === 'critical') {
      recommendations.unshift('URGENT: Critical performance regression detected');
    }

    return recommendations.join('. ');
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(current: BenchmarkResult, baseline: BenchmarkResult): number {
    const currentVariability = current.duration.stdDev / current.duration.average;
    const baselineVariability = baseline.duration.stdDev / baseline.duration.average;

    // Lower variability = higher confidence
    const avgVariability = (currentVariability + baselineVariability) / 2;
    const confidence = Math.max(0, Math.min(1, 1 - avgVariability));

    return Math.round(confidence * 100);
  }

  /**
   * Store benchmark result
   */
  private storeResult(result: BenchmarkResult): void {
    if (!this.results.has(result.name)) {
      this.results.set(result.name, []);
    }

    this.results.get(result.name)!.push(result);

    // Auto-baseline if enabled
    if (this.config.autoBaseline && !this.baselines.has(result.name)) {
      this.baselines.set(result.name, result);
    }
  }

  /**
   * Generate comprehensive reports
   */
  private async generateReports(results: Map<string, BenchmarkResult>): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.join(this.config.outputDir, `report-${timestamp}`);

    await mkdir(reportDir, { recursive: true });

    if (this.config.reportFormat === 'json' || this.config.reportFormat === 'all') {
      await this.generateJsonReport(results, reportDir);
    }

    if (this.config.reportFormat === 'html' || this.config.reportFormat === 'all') {
      await this.generateHtmlReport(results, reportDir);
    }

    if (this.config.reportFormat === 'csv' || this.config.reportFormat === 'all') {
      await this.generateCsvReport(results, reportDir);
    }
  }

  /**
   * Generate JSON report
   */
  private async generateJsonReport(
    results: Map<string, BenchmarkResult>,
    reportDir: string
  ): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(results),
      results: Object.fromEntries(results),
      baselines: Object.fromEntries(this.baselines),
      config: this.config,
    };

    await writeFile(path.join(reportDir, 'benchmark-report.json'), JSON.stringify(report, null, 2));
  }

  /**
   * Generate HTML report
   */
  private async generateHtmlReport(
    results: Map<string, BenchmarkResult>,
    reportDir: string
  ): Promise<void> {
    const htmlContent = this.generateHtmlContent(results);
    await writeFile(path.join(reportDir, 'benchmark-report.html'), htmlContent);
  }

  /**
   * Generate CSV report
   */
  private async generateCsvReport(
    results: Map<string, BenchmarkResult>,
    reportDir: string
  ): Promise<void> {
    const csvContent = this.generateCsvContent(results);
    await writeFile(path.join(reportDir, 'benchmark-report.csv'), csvContent);
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: Map<string, BenchmarkResult>): any {
    const allResults = Array.from(results.values());
    const regressions = allResults.filter((r) => r.regression?.isRegression);

    return {
      totalTests: allResults.length,
      regressions: regressions.length,
      averagePerformance: this.calculateAverage(allResults.map((r) => r.operations.opsPerSecond)),
      totalDuration: allResults.reduce((sum, r) => sum + r.duration.total, 0),
      averageMemoryUsage: this.calculateAverage(allResults.map((r) => r.memory.heapUsed)),
    };
  }

  /**
   * Generate HTML content for report
   */
  private generateHtmlContent(results: Map<string, BenchmarkResult>): string {
    // Simplified HTML generation - in a real implementation, you'd use a proper template engine
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Benchmark Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .regression { color: red; font-weight: bold; }
        .improvement { color: green; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Benchmark Report</h1>
    <h2>Summary</h2>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Total Tests: ${results.size}</p>

    <h2>Results</h2>
    <table>
        <tr>
            <th>Test Name</th>
            <th>Avg Duration (ms)</th>
            <th>Ops/Second</th>
            <th>Memory (MB)</th>
            <th>Status</th>
        </tr>
        ${Array.from(results.values())
          .map(
            (result) => `
        <tr>
            <td>${result.name}</td>
            <td>${result.duration.average.toFixed(2)}</td>
            <td>${result.operations.opsPerSecond.toFixed(2)}</td>
            <td>${(result.memory.heapUsed / 1024 / 1024).toFixed(2)}</td>
            <td class="${result.regression?.isRegression ? 'regression' : ''}">${result.regression?.isRegression ? 'Regression' : 'OK'}</td>
        </tr>
        `
          )
          .join('')}
    </table>
</body>
</html>`;
  }

  /**
   * Generate CSV content for report
   */
  private generateCsvContent(results: Map<string, BenchmarkResult>): string {
    const headers = [
      'Test Name',
      'Avg Duration (ms)',
      'Ops/Second',
      'Memory Heap Used (bytes)',
      'CPU Total (ms)',
      'Is Regression',
      'Regression Severity',
    ];

    const rows = Array.from(results.values()).map((result) => [
      result.name,
      result.duration.average.toFixed(2),
      result.operations.opsPerSecond.toFixed(2),
      result.memory.heapUsed.toString(),
      result.cpu.total.toFixed(2),
      result.regression?.isRegression || false,
      result.regression?.severity || 'none',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  /**
   * Load baseline results from file
   */
  private async loadBaselines(): Promise<void> {
    try {
      if (this.config.comparison.baselineFile) {
        const baselineData = await readFile(this.config.comparison.baselineFile, 'utf-8');
        const baselines = JSON.parse(baselineData);

        for (const [name, baseline] of Object.entries(baselines)) {
          this.baselines.set(name, baseline as BenchmarkResult);
        }
      }
    } catch (error) {
      // Baseline file doesn't exist or is invalid - that's okay
    }
  }

  /**
   * Save baselines to file
   */
  public async saveBaselines(filename?: string): Promise<void> {
    const filepath = filename || path.join(this.config.outputDir, 'baselines.json');
    const baselinesObj = Object.fromEntries(this.baselines);
    await writeFile(filepath, JSON.stringify(baselinesObj, null, 2));
  }

  /**
   * Set baseline for a specific test
   */
  public setBaseline(testName: string, result: BenchmarkResult): void {
    this.baselines.set(testName, result);
  }

  /**
   * Clear all baselines
   */
  public clearBaselines(): void {
    this.baselines.clear();
  }

  /**
   * Abort running benchmarks
   */
  public abort(): void {
    this.abortController.abort();
    this.emit('aborted');
  }

  /**
   * Setup output directory
   */
  private async setupOutputDirectory(): Promise<void> {
    try {
      await mkdir(this.config.outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Utility functions
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const index = Math.ceil(values.length * percentile) - 1;
    return values[Math.max(0, index)];
  }

  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
    const avgSquaredDiff = this.calculateAverage(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}

/**
 * Performance test utilities
 */
export class PerformanceTestUtils {
  /**
   * Create a memory stress test
   */
  static createMemoryStressTest(sizeInMB: number): PerformanceTestCase {
    return {
      name: `memory-stress-${sizeInMB}mb`,
      test: async () => {
        const array = new Array((sizeInMB * 1024 * 1024) / 8); // 8 bytes per number
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.random();
        }
        return array;
      },
      config: {
        iterations: 10,
        warmupIterations: 2,
        memoryTracking: true,
        tags: ['memory', 'stress'],
      },
    };
  }

  /**
   * Create a CPU intensive test
   */
  static createCpuStressTest(iterations: number): PerformanceTestCase {
    return {
      name: `cpu-stress-${iterations}`,
      test: async () => {
        let result = 0;
        for (let i = 0; i < iterations; i++) {
          result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
        }
        return result;
      },
      config: {
        iterations: 20,
        warmupIterations: 5,
        cpuTracking: true,
        tags: ['cpu', 'stress'],
      },
    };
  }

  /**
   * Create an I/O intensive test
   */
  static createIoStressTest(fileSize: number): PerformanceTestCase {
    return {
      name: `io-stress-${fileSize}`,
      setup: async () => {
        const data = Buffer.alloc(fileSize, 'test data');
        return { data, filename: `/tmp/benchmark-${Date.now()}.tmp` };
      },
      test: async (context) => {
        await writeFile(context.filename, context.data);
        const readData = await readFile(context.filename);
        return readData.length;
      },
      teardown: async (context) => {
        try {
          await require('fs/promises').unlink(context.filename);
        } catch (error) {
          // File might not exist
        }
      },
      config: {
        iterations: 50,
        warmupIterations: 5,
        tags: ['io', 'stress'],
      },
    };
  }
}

export default BenchmarkingSuite;
