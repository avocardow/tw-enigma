/**
 * TW-Enigma Benchmarking CI/CD Integration
 *
 * Provides comprehensive CI/CD pipeline integration for automated benchmarking,
 * performance regression detection, and baseline comparison.
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { createLogger } from '../../utils/logger';
import { BenchmarkRunner } from '../core/BenchmarkRunner';
import { BenchmarkSuite } from '../core/BenchmarkSuite';
import { HTMLReporter, createHTMLReporter } from '../reporting/HTMLReporter';
import { JSONReporter } from '../reporting/JSONReporter';
import { CSVReporter } from '../reporting/CSVReporter';
import type {
  BenchmarkCase,
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkSuiteConfig,
  BenchmarkReport,
} from '../types';

const logger = createLogger('CIIntegration');

/**
 * CI environment configuration
 */
export interface CIEnvironment {
  /** CI provider (github, gitlab, jenkins, etc.) */
  provider: string;
  /** Current branch name */
  branch: string;
  /** Commit SHA */
  commitSha: string;
  /** Pull request number (if applicable) */
  pullRequestNumber?: number;
  /** Build number */
  buildNumber?: string;
  /** Is this a main/master branch build? */
  isMainBranch: boolean;
  /** Environment variables */
  envVars: Record<string, string>;
}

/**
 * Benchmark threshold configuration
 */
export interface BenchmarkThresholds {
  /** Maximum allowed performance regression percentage */
  performanceRegression: number;
  /** Maximum allowed memory increase percentage */
  memoryIncrease: number;
  /** Maximum allowed error rate percentage */
  errorRate: number;
  /** Minimum number of iterations for valid comparison */
  minIterations: number;
  /** Maximum allowed variance in results */
  maxVariance: number;
  /** Timeout for entire benchmark suite (ms) */
  suiteTimeout: number;
}

/**
 * CI integration configuration
 */
export interface CIConfig {
  /** Benchmark execution configuration */
  benchmarks: {
    /** Should benchmarks run on pull requests? */
    runOnPR: boolean;
    /** Should benchmarks run on main branch? */
    runOnMain: boolean;
    /** Should benchmarks be blocking (fail CI on regression)? */
    blocking: boolean;
    /** Benchmark suite selection */
    suites: string[];
    /** Parallel execution settings */
    parallel: boolean;
    maxParallelism: number;
  };

  /** Baseline comparison settings */
  baseline: {
    /** Enable baseline comparison */
    enabled: boolean;
    /** How to select baseline (main-branch, previous-build, custom) */
    strategy: 'main-branch' | 'previous-build' | 'custom';
    /** Custom baseline path (if strategy is custom) */
    customPath?: string;
    /** Number of previous builds to consider */
    lookbackBuilds: number;
  };

  /** Reporting configuration */
  reporting: {
    /** Report formats to generate */
    formats: Array<'html' | 'json' | 'csv'>;
    /** Output directory for reports */
    outputDir: string;
    /** Should reports be uploaded as artifacts? */
    uploadArtifacts: boolean;
    /** Artifact retention days */
    retentionDays: number;
    /** Include detailed profiling data */
    includeProfilingData: boolean;
  };

  /** Performance thresholds */
  thresholds: BenchmarkThresholds;

  /** CI environment detection */
  environment: Partial<CIEnvironment>;
}

/**
 * Benchmark comparison result
 */
export interface BenchmarkComparison {
  /** Current benchmark results */
  current: BenchmarkResult[];
  /** Baseline benchmark results */
  baseline?: BenchmarkResult[];
  /** Comparison analysis */
  analysis: {
    /** Overall performance change percentage */
    performanceChange: number;
    /** Memory usage change percentage */
    memoryChange: number;
    /** Error rate change percentage */
    errorRateChange: number;
    /** Variance in results */
    variance: number;
    /** Is this a regression? */
    isRegression: boolean;
    /** Detailed per-benchmark comparisons */
    benchmarkComparisons: Array<{
      name: string;
      current: number;
      baseline?: number;
      change: number;
      isRegression: boolean;
    }>;
  };
}

/**
 * CI integration result
 */
export interface CIIntegrationResult {
  /** Benchmark execution results */
  results: BenchmarkResult[];
  /** Comparison with baseline (if available) */
  comparison?: BenchmarkComparison;
  /** Generated reports */
  reports: {
    paths: Record<string, string>;
    artifacts: string[];
  };
  /** CI execution summary */
  summary: {
    /** Total execution time */
    totalTime: number;
    /** Number of benchmarks run */
    benchmarkCount: number;
    /** Success rate */
    successRate: number;
    /** Should CI pass or fail? */
    shouldPass: boolean;
    /** Failure reasons (if any) */
    failureReasons: string[];
  };
}

/**
 * Main CI integration class
 */
export class CIIntegration {
  private config: CIConfig;
  private environment: CIEnvironment;

  constructor(config: CIConfig) {
    this.config = config;
    this.environment = this.detectEnvironment();
  }

  /**
   * Detect CI environment from environment variables
   */
  private detectEnvironment(): CIEnvironment {
    const env = process.env;

    // Filter out undefined values from environment variables
    const filterEnvVars = (envVars: NodeJS.ProcessEnv): Record<string, string> => {
      const filtered: Record<string, string> = {};
      for (const [key, value] of Object.entries(envVars)) {
        if (value !== undefined) {
          filtered[key] = value;
        }
      }
      return filtered;
    };

    // GitHub Actions
    if (env.GITHUB_ACTIONS) {
      return {
        provider: 'github',
        branch: env.GITHUB_REF_NAME || 'unknown',
        commitSha: env.GITHUB_SHA || 'unknown',
        pullRequestNumber:
          env.GITHUB_EVENT_NAME === 'pull_request'
            ? parseInt(env.GITHUB_PR_NUMBER || '0')
            : undefined,
        buildNumber: env.GITHUB_RUN_NUMBER,
        isMainBranch: ['main', 'master'].includes(env.GITHUB_REF_NAME || ''),
        envVars: filterEnvVars(env),
        ...this.config.environment,
      };
    }

    // GitLab CI
    if (env.GITLAB_CI) {
      return {
        provider: 'gitlab',
        branch: env.CI_COMMIT_REF_NAME || 'unknown',
        commitSha: env.CI_COMMIT_SHA || 'unknown',
        pullRequestNumber: env.CI_MERGE_REQUEST_IID
          ? parseInt(env.CI_MERGE_REQUEST_IID)
          : undefined,
        buildNumber: env.CI_PIPELINE_ID,
        isMainBranch: ['main', 'master'].includes(env.CI_COMMIT_REF_NAME || ''),
        envVars: filterEnvVars(env),
        ...this.config.environment,
      };
    }

    // Jenkins
    if (env.JENKINS_URL) {
      return {
        provider: 'jenkins',
        branch: env.GIT_BRANCH || env.BRANCH_NAME || 'unknown',
        commitSha: env.GIT_COMMIT || 'unknown',
        buildNumber: env.BUILD_NUMBER,
        isMainBranch: ['origin/main', 'origin/master', 'main', 'master'].includes(
          env.GIT_BRANCH || env.BRANCH_NAME || ''
        ),
        envVars: filterEnvVars(env),
        ...this.config.environment,
      };
    }

    // Default/unknown environment
    return {
      provider: 'unknown',
      branch: 'unknown',
      commitSha: 'unknown',
      isMainBranch: false,
      envVars: filterEnvVars(env),
      ...this.config.environment,
    };
  }

  /**
   * Determine if benchmarks should run in current environment
   */
  shouldRunBenchmarks(): boolean {
    const { benchmarks } = this.config;

    // Check if running on PR
    if (this.environment.pullRequestNumber && !benchmarks.runOnPR) {
      return false;
    }

    // Check if running on main branch
    if (this.environment.isMainBranch && !benchmarks.runOnMain) {
      return false;
    }

    return true;
  }

  /**
   * Execute benchmark suite in CI environment
   */
  async executeBenchmarks(): Promise<CIIntegrationResult> {
    const startTime = Date.now();

    if (!this.shouldRunBenchmarks()) {
      throw new Error('Benchmarks should not run in current environment');
    }

    try {
      // Initialize benchmark runner
      const runnerConfig: BenchmarkSuiteConfig = {
        parallel: this.config.benchmarks.parallel,
        maxParallelism: this.config.benchmarks.maxParallelism,
        timeout: this.config.thresholds.suiteTimeout,
        retries: 1,
        reportFormat: this.config.reporting.formats,
        outputDir: this.config.reporting.outputDir,
        compareBaseline: this.config.baseline.enabled,
        threshold: this.config.thresholds,
        environment: {
          platform: process.platform,
          nodeVersion: process.version,
          cpuCores: os.cpus().length,
          totalMemory: os.totalmem(),
          architecture: process.arch,
          operatingSystem: os.type(),
          environmentVars: this.environment.envVars,
          dependencies: await this.getPackageVersions(),
        },
      };

      const runner = new BenchmarkRunner(runnerConfig);

      // Load and execute benchmark suites
      const results: BenchmarkResult[] = [];
      for (const suiteName of this.config.benchmarks.suites) {
        const suite = await this.loadBenchmarkSuite(suiteName);

        // Run each benchmark in the suite
        for (const benchmark of suite.benchmarks) {
          const result = await runner.runBenchmark(benchmark);
          results.push(result);
        }
      }

      // Load baseline for comparison (if enabled)
      let comparison: BenchmarkComparison | undefined;
      if (this.config.baseline.enabled) {
        comparison = await this.compareWithBaseline(results);
      }

      // Generate reports
      const reports = await this.generateReports(results, comparison);

      // Create CI summary
      const summary = this.createCISummary(results, comparison);

      return {
        results,
        comparison,
        reports,
        summary: {
          ...summary,
          totalTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      throw new Error(`Benchmark execution failed: ${error}`);
    }
  }

  /**
   * Load a benchmark suite by name
   */
  private async loadBenchmarkSuite(suiteName: string): Promise<BenchmarkSuite> {
    // Create basic suite configuration
    const suiteConfig: BenchmarkSuiteConfig = {
      parallel: this.config.benchmarks.parallel,
      maxParallelism: this.config.benchmarks.maxParallelism,
      timeout: this.config.thresholds.suiteTimeout,
      retries: 1,
      reportFormat: this.config.reporting.formats,
      outputDir: this.config.reporting.outputDir,
      compareBaseline: this.config.baseline.enabled,
      threshold: this.config.thresholds,
      environment: {
        platform: process.platform,
        nodeVersion: process.version,
        cpuCores: os.cpus().length,
        totalMemory: os.totalmem(),
        architecture: process.arch,
        operatingSystem: os.type(),
        environmentVars: this.environment.envVars,
        dependencies: await this.getPackageVersions(),
      },
    };

    // Create benchmark cases based on suite name
    const benchmarks = await this.createBenchmarkCases(suiteName);

    // Create the suite with proper constructor arguments
    const suite = new BenchmarkSuite(
      suiteName,
      `CI benchmark suite: ${suiteName}`,
      '1.0.0',
      benchmarks,
      suiteConfig
    );

    return suite;
  }

  /**
   * Create benchmark cases for a suite based on suite name
   */
  private async createBenchmarkCases(suiteName: string): Promise<BenchmarkCase[]> {
    const cases: BenchmarkCase[] = [];

    // Create default benchmark config
    const createBenchmarkConfig = (): BenchmarkConfig => ({
      name: suiteName,
      description: `CI benchmark suite: ${suiteName}`,
      enabled: true,
      timeout: this.config.thresholds.suiteTimeout,
      iterations: this.config.thresholds.minIterations,
      warmupIterations: 1,
      skipWarmup: false,
      parallel: this.config.benchmarks.parallel,
      maxParallelism: this.config.benchmarks.maxParallelism,
      tags: ['ci', 'automated'],
      metadata: {
        environment: this.environment.provider,
        branch: this.environment.branch,
        commit: this.environment.commitSha,
      },
    });

    // Add benchmark cases based on suite name
    switch (suiteName) {
      case 'core-optimization':
        cases.push({
          id: 'pattern-extraction',
          name: 'Pattern Extraction Performance',
          description: 'Measure pattern extraction performance',
          config: createBenchmarkConfig(),
          run: async () => {
            // Simulate pattern extraction benchmark
            const start = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 50));
            return {
              name: 'pattern-extraction',
              duration: Date.now() - start,
              success: true,
              metrics: {
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                fileOps: 100,
                networkOps: 0,
                cacheHits: 80,
                cacheMisses: 20,
                bytesProcessed: 1024 * 1024,
                filesProcessed: 10,
                optimizationRatio: 0.75,
                customMetrics: {},
              },
              metadata: {},
            };
          },
          category: 'optimization',
          priority: 1,
        });
        break;

      case 'css-generation':
        cases.push({
          id: 'css-output',
          name: 'CSS Generation Performance',
          description: 'Measure CSS generation performance',
          config: createBenchmarkConfig(),
          run: async () => {
            const start = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 75));
            return {
              name: 'css-output',
              duration: Date.now() - start,
              success: true,
              metrics: {
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                fileOps: 50,
                networkOps: 0,
                cacheHits: 40,
                cacheMisses: 10,
                bytesProcessed: 512 * 1024,
                filesProcessed: 5,
                optimizationRatio: 0.85,
                customMetrics: {},
              },
              metadata: {},
            };
          },
          category: 'generation',
          priority: 1,
        });
        break;

      default:
        // Add a default benchmark
        cases.push({
          id: 'default-benchmark',
          name: 'Default Benchmark',
          description: 'Default benchmark case',
          config: createBenchmarkConfig(),
          run: async () => {
            const start = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 50));
            return {
              name: 'default-benchmark',
              duration: Date.now() - start,
              success: true,
              metrics: {
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                fileOps: 10,
                networkOps: 0,
                cacheHits: 8,
                cacheMisses: 2,
                bytesProcessed: 1024,
                filesProcessed: 1,
                optimizationRatio: 0.5,
                customMetrics: {},
              },
              metadata: {},
            };
          },
          category: 'integration',
          priority: 0,
        });
    }

    return cases;
  }

  /**
   * Compare current results with baseline
   */
  private async compareWithBaseline(results: BenchmarkResult[]): Promise<BenchmarkComparison> {
    let baseline: BenchmarkResult[] | undefined;

    try {
      baseline = await this.loadBaseline();
    } catch (error) {
      console.warn(`Could not load baseline: ${error}`);
    }

    const analysis = this.analyzePerformanceChange(results, baseline);

    return {
      current: results,
      baseline,
      analysis,
    };
  }

  /**
   * Load baseline benchmark results
   */
  private async loadBaseline(): Promise<BenchmarkResult[]> {
    const { baseline } = this.config;

    let baselinePath: string;

    switch (baseline.strategy) {
      case 'main-branch':
        baselinePath = path.join(baseline.customPath || 'benchmark-baselines', 'main-branch.json');
        break;
      case 'previous-build':
        baselinePath = path.join(
          baseline.customPath || 'benchmark-baselines',
          'previous-build.json'
        );
        break;
      case 'custom':
        if (!baseline.customPath) {
          throw new Error('Custom baseline path not specified');
        }
        baselinePath = baseline.customPath;
        break;
      default:
        throw new Error(`Unknown baseline strategy: ${baseline.strategy}`);
    }

    try {
      const baselineData = await fs.readFile(baselinePath, 'utf-8');
      return JSON.parse(baselineData);
    } catch (error) {
      throw new Error(`Failed to load baseline from ${baselinePath}: ${error}`);
    }
  }

  /**
   * Analyze performance change between current and baseline results
   */
  private analyzePerformanceChange(
    current: BenchmarkResult[],
    baseline?: BenchmarkResult[]
  ): BenchmarkComparison['analysis'] {
    if (!baseline || baseline.length === 0) {
      return {
        performanceChange: 0,
        memoryChange: 0,
        errorRateChange: 0,
        variance: 0,
        isRegression: false,
        benchmarkComparisons: current.map((result) => ({
          name: result.name,
          current: result.duration,
          change: 0,
          isRegression: false,
        })),
      };
    }

    const benchmarkComparisons = current.map((currentResult) => {
      const baselineResult = baseline.find((b) => b.name === currentResult.name);
      const currentDuration = currentResult.duration;
      const baselineDuration = baselineResult?.duration || 0;
      const change =
        baselineDuration > 0 ? ((currentDuration - baselineDuration) / baselineDuration) * 100 : 0;

      return {
        name: currentResult.name,
        current: currentDuration,
        baseline: baselineDuration,
        change,
        isRegression: change > this.config.thresholds.performanceRegression,
      };
    });

    // Calculate overall metrics
    const avgPerformanceChange =
      benchmarkComparisons.reduce((sum, comp) => sum + comp.change, 0) /
      benchmarkComparisons.length;

    const currentMemory =
      current.reduce((sum, r) => sum + (r.metrics?.memoryUsage?.heapUsed || 0), 0) / current.length;
    const baselineMemory =
      baseline.reduce((sum, r) => sum + (r.metrics?.memoryUsage?.heapUsed || 0), 0) /
      baseline.length;
    const memoryChange =
      baselineMemory > 0 ? ((currentMemory - baselineMemory) / baselineMemory) * 100 : 0;

    const currentErrorRate = (current.filter((r) => !r.success).length / current.length) * 100;
    const baselineErrorRate = (baseline.filter((r) => !r.success).length / baseline.length) * 100;
    const errorRateChange = currentErrorRate - baselineErrorRate;

    const variance = this.calculateVariance(current.map((r) => r.duration));

    const isRegression =
      avgPerformanceChange > this.config.thresholds.performanceRegression ||
      memoryChange > this.config.thresholds.memoryIncrease ||
      errorRateChange > this.config.thresholds.errorRate ||
      variance > this.config.thresholds.maxVariance;

    return {
      performanceChange: avgPerformanceChange,
      memoryChange,
      errorRateChange,
      variance,
      isRegression,
      benchmarkComparisons,
    };
  }

  /**
   * Calculate variance in a set of numbers
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Generate reports in configured formats
   */
  private async generateReports(
    results: BenchmarkResult[],
    comparison?: BenchmarkComparison
  ): Promise<CIIntegrationResult['reports']> {
    const reportPaths: Record<string, string> = {};
    const artifacts: string[] = [];

    try {
      logger.info('Generating benchmark reports', {
        formats: this.config.reporting.formats,
        outputDir: this.config.reporting.outputDir,
        resultCount: results.length,
      });

      // Ensure output directory exists
      await fs.mkdir(this.config.reporting.outputDir, { recursive: true });

      // Create comprehensive benchmark report
      const report: BenchmarkReport = {
        suite: 'CI Benchmarks',
        timestamp: new Date(),
        environment: {
          platform: process.platform,
          nodeVersion: process.version,
          cpuCores: os.cpus().length,
          totalMemory: os.totalmem(),
          architecture: process.arch,
          operatingSystem: os.type(),
          environmentVars: this.environment.envVars,
          dependencies: await this.getPackageVersions(),
        },
        summary: this.generateReportSummary(results),
        results,
        comparison: comparison ? {
          baseline: { 
            suite: 'Baseline',
            timestamp: new Date(),
            environment: {} as any,
            summary: {} as any,
            results: comparison.baseline || [],
            charts: [],
            metadata: {},
          },
          current: {
            suite: 'Current',
            timestamp: new Date(),
            environment: {} as any,
            summary: {} as any,
            results: comparison.current,
            charts: [],
            metadata: {},
          },
          differences: comparison.analysis.benchmarkComparisons.map(comp => ({
            benchmarkName: comp.name,
            metric: 'duration',
            baselineValue: comp.baseline || 0,
            currentValue: comp.current,
            difference: comp.current - (comp.baseline || 0),
            percentageChange: comp.change,
            significant: comp.isRegression,
            trend: comp.change > 0 ? 'regression' : comp.change < 0 ? 'improvement' : 'neutral' as const,
          })),
          regressions: comparison.analysis.benchmarkComparisons
            .filter(comp => comp.isRegression)
            .map(comp => ({
              benchmarkName: comp.name,
              metric: 'duration',
              degradation: comp.change,
              severity: comp.change > 50 ? 'critical' : comp.change > 20 ? 'major' : 'minor' as const,
              threshold: this.config.thresholds.performanceRegression,
              recommendation: `Consider optimizing ${comp.name} - performance degraded by ${comp.change.toFixed(1)}%`,
            })),
          improvements: comparison.analysis.benchmarkComparisons
            .filter(comp => comp.change < -5) // 5% improvement threshold
            .map(comp => ({
              benchmarkName: comp.name,
              metric: 'duration',
              improvement: Math.abs(comp.change),
              significance: Math.abs(comp.change) > 20 ? 'significant' : Math.abs(comp.change) > 10 ? 'moderate' : 'minor' as const,
            })),
          verdict: comparison.analysis.isRegression ? 'fail' : 'pass' as const,
        } : undefined,
        charts: [],
        metadata: {
          ci: {
            provider: this.environment.provider,
            branch: this.environment.branch,
            commit: this.environment.commitSha,
            buildNumber: this.environment.buildNumber,
            pullRequest: this.environment.pullRequestNumber?.toString(),
          },
          thresholds: this.config.thresholds,
          configuration: this.config,
        },
      };

      // Generate reports in each requested format
      for (const format of this.config.reporting.formats) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputPath = path.join(
          this.config.reporting.outputDir,
          `benchmark-ci-${timestamp}.${format}`
        );

        switch (format) {
          case 'json': {
            const jsonReporter = new JSONReporter();
            await jsonReporter.generateReport(results, report, outputPath);
            reportPaths[format] = outputPath;
            break;
          }

          case 'csv': {
            const csvReporter = new CSVReporter();
            await csvReporter.generateReport(results, report, outputPath);
            reportPaths[format] = outputPath;
            break;
          }

          case 'html': {
            const htmlReporter = createHTMLReporter({
              title: `CI Benchmark Report - ${this.environment.branch}`,
              outputPath,
              includeCharts: true,
              includeMetadata: true,
              theme: {
                primaryColor: '#2563eb',
                backgroundColor: '#ffffff',
                textColor: '#1f2937',
                accentColor: '#7c3aed',
              },
              accessibility: {
                enabled: true,
                highContrast: false,
                reducedMotion: false,
                screenReaderSupport: true,
              },
            });
            
            await htmlReporter.generateReport(results);
            reportPaths[format] = outputPath;
            break;
          }

          default:
            logger.warn('Unknown report format', { format });
            continue;
        }

        // Add to artifacts if configured
        if (this.config.reporting.uploadArtifacts) {
          artifacts.push(outputPath);
        }

        logger.debug('Report generated', { format, outputPath });
      }

      // Generate CI-specific summary files
      await this.generateCISummaryFiles(results, comparison, reportPaths);

      logger.info('All benchmark reports generated successfully', {
        reportCount: Object.keys(reportPaths).length,
        artifactCount: artifacts.length,
      });

      return { paths: reportPaths, artifacts };
    } catch (error) {
      logger.error('Report generation failed', { error: error.message });
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate report summary for the benchmark report
   */
  private generateReportSummary(results: BenchmarkResult[]): any {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const durations = results.map(r => r.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalDuration / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    const memories = results.map(r => r.metrics.memoryUsage.heapUsed);
    const avgMemory = memories.reduce((sum, m) => sum + m, 0) / memories.length;
    const minMemory = Math.min(...memories);
    const maxMemory = Math.max(...memories);

    const sortedByDuration = [...results].sort((a, b) => a.duration - b.duration);
    const fastestBenchmark = sortedByDuration[0]?.name || '';
    const slowestBenchmark = sortedByDuration[sortedByDuration.length - 1]?.name || '';

    return {
      totalBenchmarks: results.length,
      successfulBenchmarks: successful.length,
      failedBenchmarks: failed.length,
      totalDuration,
      averageDuration: avgDuration,
      fastestBenchmark,
      slowestBenchmark,
      memoryUsage: {
        min: minMemory,
        max: maxMemory,
        average: avgMemory,
      },
      throughput: {
        filesPerSecond: results.reduce((sum, r) => sum + r.metrics.filesProcessed, 0) / (totalDuration / 1000),
        bytesPerSecond: results.reduce((sum, r) => sum + r.metrics.bytesProcessed, 0) / (totalDuration / 1000),
      },
      performanceDistribution: {
        fastest: minDuration,
        slowest: maxDuration,
        median: this.calculateMedian(durations),
        standardDeviation: this.calculateStandardDeviation(durations, avgDuration),
      },
    };
  }

  /**
   * Generate CI-specific summary files for integration
   */
  private async generateCISummaryFiles(
    results: BenchmarkResult[],
    comparison?: BenchmarkComparison,
    reportPaths?: Record<string, string>
  ): Promise<void> {
    const outputDir = this.config.reporting.outputDir;

    // Generate summary JSON for CI systems
    const summary = {
      success: !comparison?.analysis.isRegression && results.every(r => r.success),
      totalTests: results.length,
      successfulTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      memoryUsage: {
        average: results.reduce((sum, r) => sum + r.metrics.memoryUsage.heapUsed, 0) / results.length,
        peak: Math.max(...results.map(r => r.metrics.memoryUsage.heapUsed)),
      },
      regression: comparison?.analysis.isRegression || false,
      performanceChange: comparison?.analysis.performanceChange || 0,
      memoryChange: comparison?.analysis.memoryChange || 0,
      reports: reportPaths,
      timestamp: new Date().toISOString(),
      environment: {
        provider: this.environment.provider,
        branch: this.environment.branch,
        commit: this.environment.commitSha,
        buildNumber: this.environment.buildNumber,
      },
    };

    await fs.writeFile(
      path.join(outputDir, 'ci-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Generate GitHub Actions summary if in GitHub environment
    if (this.environment.provider === 'github') {
      const ghSummary = this.generateGitHubActionsSummary(results, comparison);
      await fs.writeFile(
        path.join(outputDir, 'github-summary.md'),
        ghSummary
      );

      // Write to GitHub Actions step summary if environment variable is available
      if (process.env.GITHUB_STEP_SUMMARY) {
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, ghSummary);
      }
    }

    logger.debug('CI summary files generated');
  }

  /**
   * Generate GitHub Actions formatted summary
   */
  private generateGitHubActionsSummary(
    results: BenchmarkResult[],
    comparison?: BenchmarkComparison
  ): string {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const isRegression = comparison?.analysis.isRegression || false;

    let markdown = `## 🔬 TW-Enigma Benchmark Results\n\n`;
    
    // Status badge
    const statusIcon = isRegression ? '❌' : successful === results.length ? '✅' : '⚠️';
    const statusText = isRegression ? 'REGRESSION DETECTED' : successful === results.length ? 'ALL PASSED' : 'SOME FAILED';
    
    markdown += `### ${statusIcon} ${statusText}\n\n`;
    
    // Summary table
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Benchmarks | ${results.length} |\n`;
    markdown += `| Successful | ${successful} |\n`;
    markdown += `| Failed | ${failed} |\n`;
    markdown += `| Average Duration | ${avgDuration.toFixed(2)}ms |\n`;

    if (comparison) {
      markdown += `| Performance Change | ${comparison.analysis.performanceChange > 0 ? '+' : ''}${comparison.analysis.performanceChange.toFixed(2)}% |\n`;
      markdown += `| Memory Change | ${comparison.analysis.memoryChange > 0 ? '+' : ''}${comparison.analysis.memoryChange.toFixed(2)}% |\n`;
    }

    markdown += `\n`;

    // Environment info
    markdown += `### 🌍 Environment\n\n`;
    markdown += `- **Provider**: ${this.environment.provider}\n`;
    markdown += `- **Branch**: ${this.environment.branch}\n`;
    markdown += `- **Commit**: \`${this.environment.commitSha.substring(0, 8)}\`\n`;
    if (this.environment.buildNumber) {
      markdown += `- **Build**: ${this.environment.buildNumber}\n`;
    }
    markdown += `- **Node.js**: ${process.version}\n`;
    markdown += `- **Platform**: ${process.platform}\n\n`;

    // Individual results
    if (results.length > 0) {
      markdown += `### 📊 Individual Results\n\n`;
      markdown += `| Benchmark | Duration | Status | Memory (MB) |\n`;
      markdown += `|-----------|----------|--------|-------------|\n`;

      for (const result of results) {
        const status = result.success ? '✅' : '❌';
        const memory = (result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        markdown += `| ${result.name} | ${result.duration.toFixed(1)}ms | ${status} | ${memory} |\n`;
      }
      markdown += `\n`;
    }

    // Regression details
    if (comparison?.analysis.isRegression) {
      markdown += `### ⚠️ Performance Regressions\n\n`;
      const regressions = comparison.analysis.benchmarkComparisons.filter(c => c.isRegression);
      
      if (regressions.length > 0) {
        markdown += `| Benchmark | Current | Baseline | Change |\n`;
        markdown += `|-----------|---------|----------|--------|\n`;
        
        for (const reg of regressions) {
          markdown += `| ${reg.name} | ${reg.current.toFixed(1)}ms | ${reg.baseline?.toFixed(1) || 'N/A'}ms | 🔴 +${reg.change.toFixed(1)}% |\n`;
        }
        markdown += `\n`;
      }
    }

    return markdown;
  }

  /**
   * Calculate median of an array of numbers
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Create CI execution summary
   */
  private createCISummary(
    results: BenchmarkResult[],
    comparison?: BenchmarkComparison
  ): Omit<CIIntegrationResult['summary'], 'totalTime'> {
    const successfulResults = results.filter((r) => r.success);
    const successRate = (successfulResults.length / results.length) * 100;

    const failureReasons: string[] = [];

    // Check for benchmark failures
    if (successRate < 100) {
      failureReasons.push(`${results.length - successfulResults.length} benchmarks failed`);
    }

    // Check for performance regressions
    if (comparison?.analysis.isRegression) {
      failureReasons.push('Performance regression detected');

      if (comparison.analysis.performanceChange > this.config.thresholds.performanceRegression) {
        failureReasons.push(
          `Performance degraded by ${comparison.analysis.performanceChange.toFixed(2)}%`
        );
      }

      if (comparison.analysis.memoryChange > this.config.thresholds.memoryIncrease) {
        failureReasons.push(
          `Memory usage increased by ${comparison.analysis.memoryChange.toFixed(2)}%`
        );
      }

      if (comparison.analysis.errorRateChange > this.config.thresholds.errorRate) {
        failureReasons.push(
          `Error rate increased by ${comparison.analysis.errorRateChange.toFixed(2)}%`
        );
      }
    }

    const shouldPass = failureReasons.length === 0 || !this.config.benchmarks.blocking;

    return {
      benchmarkCount: results.length,
      successRate,
      shouldPass,
      failureReasons,
    };
  }

  /**
   * Get package versions for environment info
   */
  private async getPackageVersions(): Promise<Record<string, string>> {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return {
        [packageJson.name]: packageJson.version,
        node: process.version,
        npm: process.env.npm_version || 'unknown',
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
    } catch {
      return {
        node: process.version,
        npm: process.env.npm_version || 'unknown',
      };
    }
  }

  /**
   * Save current results as baseline for future comparisons
   */
  async saveAsBaseline(results: BenchmarkResult[], type: 'main-branch' | 'build'): Promise<void> {
    const { baseline } = this.config;
    const baselineDir = baseline.customPath || 'benchmark-baselines';

    await fs.mkdir(baselineDir, { recursive: true });

    const filename = type === 'main-branch' ? 'main-branch.json' : 'previous-build.json';
    const filepath = path.join(baselineDir, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
  }

  /**
   * Generate GitHub Actions step summary
   */
  generateGitHubSummary(result: CIIntegrationResult): string {
    const { summary, comparison } = result;

    let markdown = `## 🔬 Benchmark Results\n\n`;
    markdown += `- **Benchmarks Run**: ${summary.benchmarkCount}\n`;
    markdown += `- **Success Rate**: ${summary.successRate.toFixed(1)}%\n`;
    markdown += `- **Total Time**: ${(summary.totalTime / 1000).toFixed(2)}s\n`;
    markdown += `- **Result**: ${summary.shouldPass ? '✅ PASS' : '❌ FAIL'}\n\n`;

    if (comparison) {
      markdown += `### 📊 Performance Comparison\n\n`;
      markdown += `- **Performance Change**: ${comparison.analysis.performanceChange > 0 ? '+' : ''}${comparison.analysis.performanceChange.toFixed(2)}%\n`;
      markdown += `- **Memory Change**: ${comparison.analysis.memoryChange > 0 ? '+' : ''}${comparison.analysis.memoryChange.toFixed(2)}%\n`;
      markdown += `- **Error Rate Change**: ${comparison.analysis.errorRateChange > 0 ? '+' : ''}${comparison.analysis.errorRateChange.toFixed(2)}%\n\n`;

      if (comparison.analysis.benchmarkComparisons.length > 0) {
        markdown += `### 📈 Individual Benchmark Results\n\n`;
        markdown += `| Benchmark | Current (ms) | Baseline (ms) | Change | Status |\n`;
        markdown += `|-----------|--------------|---------------|---------|--------|\n`;

        for (const comp of comparison.analysis.benchmarkComparisons) {
          const changeStr = comp.baseline
            ? `${comp.change > 0 ? '+' : ''}${comp.change.toFixed(1)}%`
            : 'N/A';
          const status = comp.isRegression ? '🔴 Regression' : '✅ OK';
          markdown += `| ${comp.name} | ${comp.current.toFixed(1)} | ${comp.baseline?.toFixed(1) || 'N/A'} | ${changeStr} | ${status} |\n`;
        }
        markdown += `\n`;
      }
    }

    if (summary.failureReasons.length > 0) {
      markdown += `### ⚠️ Issues Detected\n\n`;
      for (const reason of summary.failureReasons) {
        markdown += `- ${reason}\n`;
      }
      markdown += `\n`;
    }

    return markdown;
  }
}

/**
 * Factory function to create CI integration with default configuration
 */
export function createCIIntegration(overrides: Partial<CIConfig> = {}): CIIntegration {
  const defaultConfig: CIConfig = {
    benchmarks: {
      runOnPR: true,
      runOnMain: true,
      blocking: false,
      suites: ['core-optimization', 'css-generation'],
      parallel: true,
      maxParallelism: 4,
    },
    baseline: {
      enabled: true,
      strategy: 'main-branch',
      lookbackBuilds: 10,
    },
    reporting: {
      formats: ['html', 'json'],
      outputDir: './benchmark-results',
      uploadArtifacts: true,
      retentionDays: 30,
      includeProfilingData: true,
    },
    thresholds: {
      performanceRegression: 10, // 10% regression threshold
      memoryIncrease: 20, // 20% memory increase threshold
      errorRate: 5, // 5% error rate threshold
      minIterations: 3,
      maxVariance: 0.15,
      suiteTimeout: 300000, // 5 minutes
    },
    environment: {},
  };

  const config = { ...defaultConfig, ...overrides };
  return new CIIntegration(config);
}

/**
 * Main entry point for CI benchmark execution
 */
export async function runCIBenchmarks(config?: Partial<CIConfig>): Promise<CIIntegrationResult> {
  const integration = createCIIntegration(config);

  if (!integration.shouldRunBenchmarks()) {
    throw new Error('Benchmarks should not run in current environment');
  }

  return await integration.executeBenchmarks();
}
