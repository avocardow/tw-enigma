/**
 * Performance Test Runner
 * Automated test runner for performance regression testing and CI integration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { PerformanceSimulator, createPerformanceSimulator } from './performanceSimulator';
import { PerformanceAnalyzer, createPerformanceAnalyzer } from './performanceAnalyzer';
import type { 
  PerformanceTestScenario, 
  BenchmarkResult, 
  PerformanceMetrics 
} from './performanceSimulator';
import type { PerformanceInsights } from './performanceAnalyzer';

export interface TestSuite {
  /** Test suite name */
  name: string;
  /** Test suite description */
  description: string;
  /** Test scenarios */
  scenarios: PerformanceTestScenario[];
  /** Test configuration */
  config: {
    iterations: number;
    warmupRuns: number;
    timeout: number;
    parallel: boolean;
  };
  /** Pass/fail criteria */
  criteria: {
    maxExecutionTime?: number;
    maxMemoryUsage?: number;
    minThroughput?: number;
    maxRegressionPercentage?: number;
    allowedFailures?: number;
  };
}

export interface TestResult {
  /** Test suite */
  suite: TestSuite;
  /** Benchmark results */
  benchmark: BenchmarkResult;
  /** Performance insights */
  insights: PerformanceInsights;
  /** Test status */
  status: 'passed' | 'failed' | 'warning';
  /** Failure reasons */
  failures: string[];
  /** Warnings */
  warnings: string[];
  /** Test duration */
  duration: number;
  /** Test timestamp */
  timestamp: number;
}

export interface RegressionTestConfig {
  /** Baseline results file path */
  baselinePath: string;
  /** Maximum allowed regression percentage */
  maxRegression: number;
  /** Metrics to check for regression */
  metricsToCheck: ('executionTime' | 'memoryUsage' | 'throughput')[];
  /** Whether to update baseline on improvement */
  updateBaselineOnImprovement: boolean;
  /** Whether to fail on any regression */
  failOnRegression: boolean;
}

export interface ContinuousIntegrationConfig {
  /** Whether to run in CI mode */
  enabled: boolean;
  /** Output format for CI */
  outputFormat: 'junit' | 'json' | 'github' | 'gitlab';
  /** Results output path */
  resultsPath: string;
  /** Whether to upload results to external service */
  uploadResults: boolean;
  /** External service configuration */
  service?: {
    url: string;
    token: string;
    project: string;
  };
}

export class PerformanceTestError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly testSuite?: string
  ) {
    super(message);
    this.name = 'PerformanceTestError';
  }
}

export class PerformanceTestRunner {
  private logger: Logger;
  private simulator: PerformanceSimulator;
  private analyzer: PerformanceAnalyzer;

  constructor() {
    this.logger = new Logger({ component: 'PerformanceTestRunner' });
    this.simulator = createPerformanceSimulator();
    this.analyzer = createPerformanceAnalyzer();
  }

  /**
   * Run a complete test suite
   */
  async runTestSuite(
    suite: TestSuite,
    options: {
      regressionTest?: RegressionTestConfig;
      ciConfig?: ContinuousIntegrationConfig;
      outputPath?: string;
    } = {}
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting performance test suite', {
        suiteName: suite.name,
        scenarios: suite.scenarios.length,
      });

      // Run benchmark
      const benchmark = await this.simulator.runBenchmark(suite.scenarios, {
        iterations: suite.config.iterations,
        warmupRuns: suite.config.warmupRuns,
        compareWithPrevious: !!options.regressionTest,
        saveResults: true,
        outputPath: options.outputPath,
      });

      // Analyze results
      const insights = await this.analyzer.analyzeBenchmarkResults(benchmark);

      // Evaluate test results
      const { status, failures, warnings } = this.evaluateTestResults(suite, benchmark, insights);

      // Handle regression testing
      if (options.regressionTest) {
        const regressionResults = await this.checkRegression(
          benchmark,
          options.regressionTest
        );
        failures.push(...regressionResults.failures);
        warnings.push(...regressionResults.warnings);
      }

      const result: TestResult = {
        suite,
        benchmark,
        insights,
        status: failures.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
        failures,
        warnings,
        duration: Date.now() - startTime,
        timestamp: startTime,
      };

      // Handle CI integration
      if (options.ciConfig?.enabled) {
        await this.handleCiIntegration(result, options.ciConfig);
      }

      // Save detailed results
      if (options.outputPath) {
        await this.saveTestResults(result, options.outputPath);
      }

      this.logger.info('Performance test suite completed', {
        suiteName: suite.name,
        status: result.status,
        duration: result.duration,
        failures: failures.length,
        warnings: warnings.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Performance test suite failed', { error, suiteName: suite.name });
      throw new PerformanceTestError(
        `Test suite execution failed: ${suite.name}`,
        error instanceof Error ? error : new Error(String(error)),
        suite.name
      );
    }
  }

  /**
   * Run regression test against baseline
   */
  async runRegressionTest(
    scenarios: PerformanceTestScenario[],
    config: RegressionTestConfig
  ): Promise<{
    passed: boolean;
    regressions: Array<{
      scenario: string;
      metric: string;
      baseline: number;
      current: number;
      regression: number;
    }>;
    improvements: Array<{
      scenario: string;
      metric: string;
      baseline: number;
      current: number;
      improvement: number;
    }>;
  }> {
    try {
      this.logger.info('Running regression test', {
        scenarios: scenarios.length,
        baselinePath: config.baselinePath,
      });

      // Load baseline results
      const baseline = await this.loadBaseline(config.baselinePath);
      if (!baseline) {
        throw new Error(`Could not load baseline from ${config.baselinePath}`);
      }

      // Run current tests
      const current = await this.simulator.runBenchmark(scenarios, {
        iterations: 1,
        warmupRuns: 0,
        compareWithPrevious: false,
        saveResults: false,
      });

      // Compare results
      const comparison = this.compareWithBaseline(baseline, current, config);

      // Update baseline if improvements detected and configured
      if (config.updateBaselineOnImprovement && comparison.improvements.length > 0) {
        await this.updateBaseline(current, config.baselinePath);
        this.logger.info('Updated baseline with improved results');
      }

      return comparison;
    } catch (error) {
      this.logger.error('Regression test failed', { error });
      throw new PerformanceTestError(
        'Regression test execution failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Generate performance test report
   */
  async generateTestReport(
    results: TestResult[],
    options: {
      format: 'html' | 'markdown' | 'json';
      outputPath: string;
      includeCharts?: boolean;
      includeDetails?: boolean;
    }
  ): Promise<void> {
    try {
      this.logger.info('Generating performance test report', {
        results: results.length,
        format: options.format,
      });

      let content: string;

      switch (options.format) {
        case 'html':
          content = this.generateHtmlReport(results, options);
          break;
        case 'markdown':
          content = this.generateMarkdownReport(results, options);
          break;
        case 'json':
          content = JSON.stringify(results, null, 2);
          break;
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
      await fs.writeFile(options.outputPath, content);

      this.logger.info('Performance test report generated', {
        outputPath: options.outputPath,
        size: content.length,
      });
    } catch (error) {
      this.logger.error('Failed to generate test report', { error });
      throw new PerformanceTestError(
        'Report generation failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create predefined test suites
   */
  createStandardTestSuites(): TestSuite[] {
    return [
      {
        name: 'Smoke Test',
        description: 'Quick smoke test with minimal scenarios',
        scenarios: [
          this.createQuickScenario('Small Project', 10, 1),
          this.createQuickScenario('Medium Project', 50, 2),
        ],
        config: {
          iterations: 1,
          warmupRuns: 0,
          timeout: 30000,
          parallel: false,
        },
        criteria: {
          maxExecutionTime: 10000,
          maxMemoryUsage: 100 * 1024 * 1024,
          minThroughput: 50,
          allowedFailures: 0,
        },
      },
      {
        name: 'Regression Test',
        description: 'Standard regression test suite',
        scenarios: [
          this.createStandardScenario('Small Project', 50, 2),
          this.createStandardScenario('Medium Project', 200, 3),
          this.createStandardScenario('Large Project', 500, 4),
        ],
        config: {
          iterations: 3,
          warmupRuns: 1,
          timeout: 120000,
          parallel: false,
        },
        criteria: {
          maxExecutionTime: 60000,
          maxMemoryUsage: 500 * 1024 * 1024,
          minThroughput: 100,
          maxRegressionPercentage: 15,
          allowedFailures: 0,
        },
      },
      {
        name: 'Stress Test',
        description: 'High-load stress testing',
        scenarios: [
          this.createStressScenario('Enterprise Scale', 1000, 5),
          this.createStressScenario('Extreme Load', 2000, 6),
        ],
        config: {
          iterations: 2,
          warmupRuns: 1,
          timeout: 300000,
          parallel: false,
        },
        criteria: {
          maxExecutionTime: 180000,
          maxMemoryUsage: 1024 * 1024 * 1024,
          minThroughput: 50,
          allowedFailures: 1,
        },
      },
    ];
  }

  /**
   * Private helper methods
   */
  private evaluateTestResults(
    suite: TestSuite,
    benchmark: BenchmarkResult,
    insights: PerformanceInsights
  ): { status: 'passed' | 'failed' | 'warning'; failures: string[]; warnings: string[] } {
    const failures: string[] = [];
    const warnings: string[] = [];

    // Check execution time criteria
    if (suite.criteria.maxExecutionTime) {
      const maxTime = Math.max(...benchmark.scenarios.map(s => s.totalExecutionTime));
      if (maxTime > suite.criteria.maxExecutionTime) {
        failures.push(
          `Execution time ${Math.round(maxTime)}ms exceeds limit ${suite.criteria.maxExecutionTime}ms`
        );
      }
    }

    // Check memory usage criteria
    if (suite.criteria.maxMemoryUsage) {
      const maxMemory = Math.max(...benchmark.scenarios.map(s => s.memoryUsage.peak));
      if (maxMemory > suite.criteria.maxMemoryUsage) {
        failures.push(
          `Memory usage ${Math.round(maxMemory / 1024 / 1024)}MB exceeds limit ${Math.round(suite.criteria.maxMemoryUsage / 1024 / 1024)}MB`
        );
      }
    }

    // Check throughput criteria
    if (suite.criteria.minThroughput) {
      const minThroughput = Math.min(...benchmark.scenarios.map(s => s.throughput.operationsPerSecond));
      if (minThroughput < suite.criteria.minThroughput) {
        failures.push(
          `Throughput ${Math.round(minThroughput)} ops/sec below minimum ${suite.criteria.minThroughput} ops/sec`
        );
      }
    }

    // Check for critical bottlenecks
    const criticalBottlenecks = insights.bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      failures.push(`${criticalBottlenecks.length} critical performance bottlenecks detected`);
    }

    // Check for performance grade
    if (insights.grade === 'F') {
      failures.push('Overall performance grade is F');
    } else if (insights.grade === 'D') {
      warnings.push('Overall performance grade is D');
    }

    // Check for high-priority recommendations
    const highPriorityRecs = insights.recommendations.filter(r => r.priority === 'high');
    if (highPriorityRecs.length > 3) {
      warnings.push(`${highPriorityRecs.length} high-priority optimization recommendations`);
    }

    return {
      status: failures.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
      failures,
      warnings,
    };
  }

  private async checkRegression(
    current: BenchmarkResult,
    config: RegressionTestConfig
  ): Promise<{ failures: string[]; warnings: string[] }> {
    const failures: string[] = [];
    const warnings: string[] = [];

    if (current.regression?.regressions) {
      for (const regression of current.regression.regressions) {
        if (regression.changePercentage > config.maxRegression) {
          const message = `Regression in ${regression.component} ${regression.metric}: +${Math.round(regression.changePercentage)}%`;
          
          if (config.failOnRegression) {
            failures.push(message);
          } else {
            warnings.push(message);
          }
        }
      }
    }

    return { failures, warnings };
  }

  private async handleCiIntegration(
    result: TestResult,
    config: ContinuousIntegrationConfig
  ): Promise<void> {
    try {
      let output: string;

      switch (config.outputFormat) {
        case 'junit':
          output = this.generateJunitOutput(result);
          break;
        case 'json':
          output = JSON.stringify(result, null, 2);
          break;
        case 'github':
          output = this.generateGithubOutput(result);
          break;
        case 'gitlab':
          output = this.generateGitlabOutput(result);
          break;
        default:
          output = JSON.stringify(result, null, 2);
      }

      await fs.mkdir(path.dirname(config.resultsPath), { recursive: true });
      await fs.writeFile(config.resultsPath, output);

      // Upload to external service if configured
      if (config.uploadResults && config.service) {
        await this.uploadResults(result, config.service);
      }
    } catch (error) {
      this.logger.error('CI integration failed', { error });
    }
  }

  private async saveTestResults(result: TestResult, basePath: string): Promise<void> {
    const resultsPath = basePath.replace('.json', '-detailed.json');
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2));
  }

  private async loadBaseline(baselinePath: string): Promise<BenchmarkResult | null> {
    try {
      const content = await fs.readFile(baselinePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private compareWithBaseline(
    baseline: BenchmarkResult,
    current: BenchmarkResult,
    config: RegressionTestConfig
  ): {
    passed: boolean;
    regressions: Array<{
      scenario: string;
      metric: string;
      baseline: number;
      current: number;
      regression: number;
    }>;
    improvements: Array<{
      scenario: string;
      metric: string;
      baseline: number;
      current: number;
      improvement: number;
    }>;
  } {
    const regressions: Array<{
      scenario: string;
      metric: string;
      baseline: number;
      current: number;
      regression: number;
    }> = [];
    
    const improvements: Array<{
      scenario: string;
      metric: string;
      baseline: number;
      current: number;
      improvement: number;
    }> = [];

    // Compare scenarios by name
    for (const currentScenario of current.scenarios) {
      const baselineScenario = baseline.scenarios.find(s => 
        s.scenario.name === currentScenario.scenario.name
      );
      
      if (!baselineScenario) continue;

      // Check execution time
      if (config.metricsToCheck.includes('executionTime')) {
        const change = ((currentScenario.totalExecutionTime - baselineScenario.totalExecutionTime) / baselineScenario.totalExecutionTime) * 100;
        if (change > config.maxRegression) {
          regressions.push({
            scenario: currentScenario.scenario.name,
            metric: 'Execution Time',
            baseline: baselineScenario.totalExecutionTime,
            current: currentScenario.totalExecutionTime,
            regression: change,
          });
        } else if (change < -5) { // 5% improvement
          improvements.push({
            scenario: currentScenario.scenario.name,
            metric: 'Execution Time',
            baseline: baselineScenario.totalExecutionTime,
            current: currentScenario.totalExecutionTime,
            improvement: Math.abs(change),
          });
        }
      }

      // Check memory usage
      if (config.metricsToCheck.includes('memoryUsage')) {
        const change = ((currentScenario.memoryUsage.peak - baselineScenario.memoryUsage.peak) / baselineScenario.memoryUsage.peak) * 100;
        if (change > config.maxRegression) {
          regressions.push({
            scenario: currentScenario.scenario.name,
            metric: 'Memory Usage',
            baseline: baselineScenario.memoryUsage.peak,
            current: currentScenario.memoryUsage.peak,
            regression: change,
          });
        } else if (change < -10) { // 10% improvement
          improvements.push({
            scenario: currentScenario.scenario.name,
            metric: 'Memory Usage',
            baseline: baselineScenario.memoryUsage.peak,
            current: currentScenario.memoryUsage.peak,
            improvement: Math.abs(change),
          });
        }
      }

      // Check throughput
      if (config.metricsToCheck.includes('throughput')) {
        const change = ((baselineScenario.throughput.operationsPerSecond - currentScenario.throughput.operationsPerSecond) / baselineScenario.throughput.operationsPerSecond) * 100;
        if (change > config.maxRegression) {
          regressions.push({
            scenario: currentScenario.scenario.name,
            metric: 'Throughput',
            baseline: baselineScenario.throughput.operationsPerSecond,
            current: currentScenario.throughput.operationsPerSecond,
            regression: change,
          });
        } else if (change < -5) { // 5% improvement
          improvements.push({
            scenario: currentScenario.scenario.name,
            metric: 'Throughput',
            baseline: baselineScenario.throughput.operationsPerSecond,
            current: currentScenario.throughput.operationsPerSecond,
            improvement: Math.abs(change),
          });
        }
      }
    }

    return {
      passed: regressions.length === 0,
      regressions,
      improvements,
    };
  }

  private async updateBaseline(result: BenchmarkResult, baselinePath: string): Promise<void> {
    await fs.writeFile(baselinePath, JSON.stringify(result, null, 2));
  }

  private createQuickScenario(name: string, fileCount: number, opsPerFile: number): PerformanceTestScenario {
    return {
      name,
      description: `Quick test scenario with ${fileCount} files`,
      fileCount,
      operationsPerFile: opsPerFile,
      averageFileSize: 10 * 1024,
      complexityMultiplier: 1,
      includeDependencies: false,
      includeVisualDiff: false,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: false,
    };
  }

  private createStandardScenario(name: string, fileCount: number, opsPerFile: number): PerformanceTestScenario {
    return {
      name,
      description: `Standard test scenario with ${fileCount} files`,
      fileCount,
      operationsPerFile: opsPerFile,
      averageFileSize: 25 * 1024,
      complexityMultiplier: 2,
      includeDependencies: true,
      includeVisualDiff: true,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: true,
    };
  }

  private createStressScenario(name: string, fileCount: number, opsPerFile: number): PerformanceTestScenario {
    return {
      name,
      description: `Stress test scenario with ${fileCount} files`,
      fileCount,
      operationsPerFile: opsPerFile,
      averageFileSize: 50 * 1024,
      complexityMultiplier: 5,
      includeDependencies: true,
      includeVisualDiff: false, // Too expensive for stress tests
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: false,
    };
  }

  private generateHtmlReport(results: TestResult[], options: any): string {
    // Simplified HTML report generation
    let html = `<!DOCTYPE html>\n<html>\n<head>\n<title>Performance Test Report</title>\n</head>\n<body>\n`;
    html += `<h1>Performance Test Report</h1>\n`;
    
    for (const result of results) {
      html += `<h2>${result.suite.name}</h2>\n`;
      html += `<p>Status: ${result.status}</p>\n`;
      html += `<p>Grade: ${result.insights.grade}</p>\n`;
      html += `<p>Score: ${result.insights.score}</p>\n`;
      
      if (result.failures.length > 0) {
        html += `<h3>Failures</h3>\n<ul>\n`;
        for (const failure of result.failures) {
          html += `<li>${failure}</li>\n`;
        }
        html += `</ul>\n`;
      }
    }
    
    html += `</body>\n</html>`;
    return html;
  }

  private generateMarkdownReport(results: TestResult[], options: any): string {
    let md = `# Performance Test Report\n\n`;
    md += `Generated: ${new Date().toISOString()}\n\n`;
    
    for (const result of results) {
      md += `## ${result.suite.name}\n\n`;
      md += `- **Status:** ${result.status}\n`;
      md += `- **Grade:** ${result.insights.grade}\n`;
      md += `- **Score:** ${result.insights.score}\n`;
      md += `- **Duration:** ${Math.round(result.duration)}ms\n\n`;
      
      if (result.failures.length > 0) {
        md += `### Failures\n\n`;
        for (const failure of result.failures) {
          md += `- ${failure}\n`;
        }
        md += `\n`;
      }
      
      if (result.warnings.length > 0) {
        md += `### Warnings\n\n`;
        for (const warning of result.warnings) {
          md += `- ${warning}\n`;
        }
        md += `\n`;
      }
    }
    
    return md;
  }

  private generateJunitOutput(result: TestResult): string {
    // Simplified JUnit XML format
    const testCount = result.suite.scenarios.length;
    const failureCount = result.failures.length;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites>\n`;
    xml += `  <testsuite name="${result.suite.name}" tests="${testCount}" failures="${failureCount}" time="${result.duration / 1000}">\n`;
    
    for (const scenario of result.suite.scenarios) {
      const scenarioResult = result.benchmark.scenarios.find(s => s.scenario.name === scenario.name);
      xml += `    <testcase name="${scenario.name}" time="${scenarioResult ? scenarioResult.totalExecutionTime / 1000 : 0}">\n`;
      xml += `    </testcase>\n`;
    }
    
    xml += `  </testsuite>\n`;
    xml += `</testsuites>\n`;
    
    return xml;
  }

  private generateGithubOutput(result: TestResult): string {
    // GitHub Actions output format
    return JSON.stringify({
      suite: result.suite.name,
      status: result.status,
      grade: result.insights.grade,
      score: result.insights.score,
      failures: result.failures,
      warnings: result.warnings,
    }, null, 2);
  }

  private generateGitlabOutput(result: TestResult): string {
    // GitLab CI output format (similar to GitHub)
    return this.generateGithubOutput(result);
  }

  private async uploadResults(result: TestResult, service: NonNullable<ContinuousIntegrationConfig['service']>): Promise<void> {
    // Placeholder for external service upload
    this.logger.debug('Uploading results to external service', { 
      url: service.url,
      project: service.project,
    });
  }
}

/**
 * Global performance test runner instance
 */
let globalPerformanceTestRunner: PerformanceTestRunner | null = null;

/**
 * Get the global performance test runner
 */
export function getPerformanceTestRunner(): PerformanceTestRunner {
  if (!globalPerformanceTestRunner) {
    globalPerformanceTestRunner = new PerformanceTestRunner();
  }
  return globalPerformanceTestRunner;
}

/**
 * Create a new performance test runner
 */
export function createPerformanceTestRunner(): PerformanceTestRunner {
  return new PerformanceTestRunner();
}

/**
 * Run quick performance check
 */
export async function runQuickPerformanceCheck(): Promise<TestResult> {
  const runner = getPerformanceTestRunner();
  const suites = runner.createStandardTestSuites();
  return runner.runTestSuite(suites[0]); // Run smoke test
}

export default PerformanceTestRunner;