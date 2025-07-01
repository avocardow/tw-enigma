import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import {
  BenchmarkSuite as IBenchmarkSuite,
  BenchmarkCase,
  BenchmarkSuiteConfig,
  BenchmarkReport,
  BenchmarkResult,
  BenchmarkEnvironment,
  BenchmarkSummary,
  BenchmarkEvents,
} from '../types';
import { BenchmarkRunner } from './BenchmarkRunner';
import { MetricsCollector } from '../utils/MetricsCollector';
import { ReportGenerator } from '../reporting/ReportGenerator';

const logger = createLogger('BenchmarkSuite');

/**
 * Main benchmarking suite that orchestrates benchmark execution,
 * result collection, and report generation
 */
export class BenchmarkSuite extends EventEmitter implements IBenchmarkSuite {
  public readonly name: string;
  public readonly description: string;
  public readonly version: string;
  public readonly benchmarks: BenchmarkCase[];
  public readonly config: BenchmarkSuiteConfig;

  private runner: BenchmarkRunner;
  private metricsCollector: MetricsCollector;
  private reportGenerator: ReportGenerator;
  private isRunning = false;
  private startTime?: Date;
  private environment?: BenchmarkEnvironment;

  constructor(
    name: string,
    description: string,
    version: string,
    benchmarks: BenchmarkCase[],
    config: BenchmarkSuiteConfig,
    setup?: () => Promise<void> | void,
    teardown?: () => Promise<void> | void
  ) {
    super();

    this.name = name;
    this.description = description;
    this.version = version;
    this.benchmarks = benchmarks.sort((a, b) => a.priority - b.priority);
    this.config = config;

    if (setup) this.setup = setup;
    if (teardown) this.teardown = teardown;

    this.runner = new BenchmarkRunner(this.config);
    this.metricsCollector = new MetricsCollector();
    this.reportGenerator = new ReportGenerator(this.config);

    this.setupEventHandlers();

    logger.debug('BenchmarkSuite created', {
      name: this.name,
      benchmarks: this.benchmarks.length,
      version: this.version,
    });
  }

  /**
   * Optional setup method to be overridden
   */
  public setup?: () => Promise<void> | void;

  /**
   * Optional teardown method to be overridden
   */
  public teardown?: () => Promise<void> | void;

  /**
   * Run all benchmarks in the suite
   */
  async run(): Promise<BenchmarkReport> {
    if (this.isRunning) {
      throw new Error('Benchmark suite is already running');
    }

    this.isRunning = true;
    this.startTime = new Date();

    try {
      logger.info('Starting benchmark suite', {
        name: this.name,
        benchmarks: this.benchmarks.length,
      });

      // Collect environment information
      this.environment = await this.collectEnvironment();

      // Emit suite started event
      this.emit('suite-started', {
        suite: this,
        timestamp: this.startTime,
      } as BenchmarkEvents['suite-started']);

      // Run setup if provided
      if (this.setup) {
        logger.debug('Running suite setup');
        await this.setup();
      }

      // Run benchmarks
      const results = await this.runBenchmarks();

      // Generate summary
      const summary = this.generateSummary(results);

      // Create report
      const report: BenchmarkReport = {
        suite: this.name,
        timestamp: this.startTime,
        environment: this.environment,
        summary,
        results,
        comparison: undefined, // Will be populated by comparison tools
        charts: [], // Will be populated by visualization tools
        metadata: {
          version: this.version,
          description: this.description,
          config: this.config,
          duration: Date.now() - this.startTime.getTime(),
        },
      };

      // Generate report files
      await this.reportGenerator.generate(report);

      // Emit suite completed event
      this.emit('suite-completed', {
        suite: this,
        report,
      } as BenchmarkEvents['suite-completed']);

      logger.info('Benchmark suite completed', {
        name: this.name,
        duration: report.metadata.duration,
        successful: summary.successfulBenchmarks,
        failed: summary.failedBenchmarks,
      });

      return report;
    } catch (error) {
      logger.error('Benchmark suite failed', { error });
      this.emit('suite-failed', {
        suite: this,
        error: error as Error,
      } as BenchmarkEvents['suite-failed']);
      throw error;
    } finally {
      // Run teardown if provided
      if (this.teardown) {
        try {
          logger.debug('Running suite teardown');
          await this.teardown();
        } catch (teardownError) {
          logger.warn('Suite teardown failed', { error: teardownError });
        }
      }

      this.isRunning = false;
    }
  }

  /**
   * Run a specific benchmark by name
   */
  async runBenchmark(name: string): Promise<BenchmarkResult> {
    const benchmark = this.benchmarks.find(b => b.name === name);
    if (!benchmark) {
      throw new Error(`Benchmark '${name}' not found`);
    }

    return this.runner.runBenchmark(benchmark);
  }

  /**
   * Get benchmark by name
   */
  getBenchmark(name: string): BenchmarkCase | undefined {
    return this.benchmarks.find(b => b.name === name);
  }

  /**
   * Add benchmark to suite
   */
  addBenchmark(benchmark: BenchmarkCase): void {
    this.benchmarks.push(benchmark);
    this.benchmarks.sort((a, b) => a.priority - b.priority);
    
    logger.debug('Benchmark added to suite', {
      suite: this.name,
      benchmark: benchmark.name,
      total: this.benchmarks.length,
    });
  }

  /**
   * Remove benchmark from suite
   */
  removeBenchmark(name: string): boolean {
    const index = this.benchmarks.findIndex(b => b.name === name);
    if (index !== -1) {
      this.benchmarks.splice(index, 1);
      logger.debug('Benchmark removed from suite', {
        suite: this.name,
        benchmark: name,
        remaining: this.benchmarks.length,
      });
      return true;
    }
    return false;
  }

  /**
   * Check if suite is currently running
   */
  getRunningStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Get suite metadata
   */
  getMetadata(): Record<string, any> {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      benchmarks: this.benchmarks.length,
      config: this.config,
      isRunning: this.isRunning,
      startTime: this.startTime,
    };
  }

  /**
   * Run all benchmarks in the suite
   */
  private async runBenchmarks(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    const enabledBenchmarks = this.benchmarks.filter(b => b.config.enabled);

    logger.info('Running benchmarks', {
      total: enabledBenchmarks.length,
      parallel: this.config.parallel,
      maxParallelism: this.config.maxParallelism,
    });

    if (this.config.parallel) {
      // Run benchmarks in parallel with controlled concurrency
      const batches = this.createBatches(enabledBenchmarks, this.config.maxParallelism);
      
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(benchmark => this.runner.runBenchmark(benchmark))
        );
        results.push(...batchResults);
      }
    } else {
      // Run benchmarks sequentially
      for (const benchmark of enabledBenchmarks) {
        const result = await this.runner.runBenchmark(benchmark);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Create batches for parallel execution
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Generate summary from benchmark results
   */
  private generateSummary(results: BenchmarkResult[]): BenchmarkSummary {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    const durations = successfulResults.map(r => r.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = durations.length > 0 ? totalDuration / durations.length : 0;
    
    const fastest = successfulResults.reduce((min, r) => 
      r.duration < min.duration ? r : min, successfulResults[0]);
    const slowest = successfulResults.reduce((max, r) => 
      r.duration > max.duration ? r : max, successfulResults[0]);

    // Memory usage statistics
    const memoryUsages = successfulResults.map(r => r.metrics.memoryUsage.heapUsed);
    const memoryStats = {
      min: Math.min(...memoryUsages),
      max: Math.max(...memoryUsages),
      average: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
    };

    // Throughput calculations
    const totalFiles = successfulResults.reduce((sum, r) => sum + r.metrics.filesProcessed, 0);
    const totalBytes = successfulResults.reduce((sum, r) => sum + r.metrics.bytesProcessed, 0);
    const totalTimeSeconds = totalDuration / 1000;
    
    const throughput = {
      filesPerSecond: totalTimeSeconds > 0 ? totalFiles / totalTimeSeconds : 0,
      bytesPerSecond: totalTimeSeconds > 0 ? totalBytes / totalTimeSeconds : 0,
    };

    return {
      totalBenchmarks: results.length,
      successfulBenchmarks: successfulResults.length,
      failedBenchmarks: failedResults.length,
      totalDuration,
      averageDuration,
      fastestBenchmark: fastest?.name || '',
      slowestBenchmark: slowest?.name || '',
      memoryUsage: memoryStats,
      throughput,
    };
  }

  /**
   * Collect environment information
   */
  private async collectEnvironment(): Promise<BenchmarkEnvironment> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      platform: process.platform,
      nodeVersion: process.version,
      cpuCores: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      architecture: process.arch,
      operatingSystem: require('os').type(),
      environmentVars: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        TW_ENIGMA_ENV: process.env.TW_ENIGMA_ENV || 'benchmark',
      },
      dependencies: {
        // Will be populated from package.json
      },
    };
  }

  /**
   * Setup event handlers for runner events
   */
  private setupEventHandlers(): void {
    this.runner.on('benchmark-started', (data) => {
      this.emit('benchmark-started', data);
    });

    this.runner.on('benchmark-completed', (data) => {
      this.emit('benchmark-completed', data);
    });

    this.runner.on('benchmark-failed', (data) => {
      this.emit('benchmark-failed', data);
    });

    this.runner.on('benchmark-progress', (data) => {
      this.emit('benchmark-progress', data);
    });

    this.runner.on('iteration-started', (data) => {
      this.emit('iteration-started', data);
    });

    this.runner.on('iteration-completed', (data) => {
      this.emit('iteration-completed', data);
    });
  }
}