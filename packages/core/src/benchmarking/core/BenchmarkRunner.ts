import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import {
  BenchmarkCase,
  BenchmarkContext,
  BenchmarkEvents,
  BenchmarkMetrics,
  BenchmarkResult,
  BenchmarkSuiteConfig,
} from '../types';
import { MetricsCollector } from '../utils/MetricsCollector';
import { BenchmarkTimer } from '../utils/Timer';

const logger = createLogger('BenchmarkRunner');

/**
 * Responsible for executing individual benchmarks and collecting metrics
 */
export class BenchmarkRunner extends EventEmitter {
  private config: BenchmarkSuiteConfig;
  private metricsCollector: MetricsCollector;
  private activeContexts: Map<string, BenchmarkContext> = new Map();
  private profiler?: PerformanceProfiler;

  constructor(config: BenchmarkSuiteConfig, profiler?: PerformanceProfiler) {
    super();
    this.config = config;
    this.metricsCollector = new MetricsCollector();
    this.profiler = profiler;

    logger.debug('BenchmarkRunner initialized', {
      config,
      profilingEnabled: !!profiler,
    });
  }

  /**
   * Run a single benchmark case
   */
  async runBenchmark(benchmark: BenchmarkCase): Promise<BenchmarkResult> {
    const startTime = Date.now();

    logger.info('Starting benchmark', {
      name: benchmark.name,
      category: benchmark.category,
      iterations: benchmark.config.iterations,
      profilingEnabled: !!this.profiler,
    });

    // Emit benchmark started event
    this.emit('benchmark-started', {
      benchmark,
      context: this.createContext(benchmark, 0, false, startTime),
    } as BenchmarkEvents['benchmark-started']);

    try {
      // Run setup if provided
      if (benchmark.setup) {
        logger.debug('Running benchmark setup', { name: benchmark.name });
        await this.executeWithTimeout(() => benchmark.setup!(), benchmark.config.timeout, 'setup');
      }

      // Run warmup iterations
      if (!benchmark.config.skipWarmup && benchmark.config.warmupIterations > 0) {
        logger.debug('Running warmup iterations', {
          name: benchmark.name,
          warmupIterations: benchmark.config.warmupIterations,
        });

        for (let i = 0; i < benchmark.config.warmupIterations; i++) {
          const context = this.createContext(benchmark, i, true, startTime);
          await this.runIteration(benchmark, context, true);
        }
      }

      // Run actual benchmark iterations
      const results: BenchmarkResult[] = [];
      const iterationCount = benchmark.config.iterations;

      logger.debug('Running benchmark iterations', {
        name: benchmark.name,
        iterations: iterationCount,
      });

      for (let i = 0; i < iterationCount; i++) {
        const context = this.createContext(benchmark, i, false, startTime);

        this.emit('iteration-started', {
          benchmark,
          iteration: i,
        } as BenchmarkEvents['iteration-started']);

        const iterationResult = await this.runIteration(benchmark, context, false);
        results.push(iterationResult);

        this.emit('iteration-completed', {
          benchmark,
          iteration: i,
          result: iterationResult,
        } as BenchmarkEvents['iteration-completed']);

        // Emit progress
        const progress = ((i + 1) / iterationCount) * 100;
        this.emit('benchmark-progress', {
          benchmark,
          progress,
        } as BenchmarkEvents['benchmark-progress']);
      }

      // Calculate aggregated result
      const aggregatedResult = this.aggregateResults(benchmark, results, startTime);

      // Validate result if validator provided
      if (benchmark.validate && !benchmark.validate(aggregatedResult)) {
        throw new Error('Benchmark result validation failed');
      }

      // Run teardown if provided
      if (benchmark.teardown) {
        logger.debug('Running benchmark teardown', { name: benchmark.name });
        await this.executeWithTimeout(
          () => benchmark.teardown!(),
          benchmark.config.timeout,
          'teardown'
        );
      }

      logger.info('Benchmark completed successfully', {
        name: benchmark.name,
        duration: aggregatedResult.duration,
        iterations: iterationCount,
      });

      // Emit benchmark completed event
      this.emit('benchmark-completed', {
        benchmark,
        result: aggregatedResult,
      } as BenchmarkEvents['benchmark-completed']);

      return aggregatedResult;
    } catch (error) {
      const failedResult: BenchmarkResult = {
        name: benchmark.name,
        duration: Date.now() - startTime,
        success: false,
        error: error as Error,
        metrics: this.createEmptyMetrics(),
        metadata: {
          category: benchmark.category,
          iterations: benchmark.config.iterations,
          failedAt: 'execution',
        },
      };

      logger.error('Benchmark failed', {
        name: benchmark.name,
        error: (error as Error).message,
      });

      // Emit benchmark failed event
      this.emit('benchmark-failed', {
        benchmark,
        error: error as Error,
      } as BenchmarkEvents['benchmark-failed']);

      return failedResult;
    } finally {
      // Clean up active context
      this.activeContexts.delete(benchmark.id);
    }
  }

  /**
   * Run a single iteration of a benchmark
   */
  private async runIteration(
    benchmark: BenchmarkCase,
    context: BenchmarkContext,
    isWarmup: boolean
  ): Promise<BenchmarkResult> {
    const iterationTimer = new BenchmarkTimer();
    this.activeContexts.set(benchmark.id, context);

    try {
      // Start profiling if enabled and not a warmup run
      if (this.profiler && !isWarmup) {
        await this.profiler.start(context);
      }

      // Start metrics collection
      const metricsStart = this.metricsCollector.start();

      // Execute benchmark function
      iterationTimer.start();
      const result = await this.executeWithTimeout(
        () => benchmark.run(context),
        benchmark.config.timeout,
        'benchmark execution'
      );
      iterationTimer.stop();

      // Stop metrics collection
      const metrics = await this.metricsCollector.stop(metricsStart);

      // Stop profiling and collect profiler data
      let profilerData;
      if (this.profiler && !isWarmup) {
        profilerData = await this.profiler.stop(context);
      }

      // Create result
      const benchmarkResult: BenchmarkResult = {
        name: benchmark.name,
        duration: iterationTimer.getDuration(),
        success: true,
        metrics: {
          ...metrics,
          ...context.metrics,
        },
        output: result.output,
        metadata: {
          iteration: context.iteration,
          isWarmup,
          category: benchmark.category,
          ...result.metadata,
        },
      };

      if (!isWarmup) {
        logger.debug('Iteration completed', {
          name: benchmark.name,
          iteration: context.iteration,
          duration: benchmarkResult.duration,
        });
      }

      return benchmarkResult;
    } catch (error) {
      return {
        name: benchmark.name,
        duration: iterationTimer.getDuration() || 0,
        success: false,
        error: error as Error,
        metrics: this.createEmptyMetrics(),
        metadata: {
          iteration: context.iteration,
          isWarmup,
          category: benchmark.category,
          failedAt: 'iteration',
        },
      };
    }
  }

  /**
   * Create benchmark context for an iteration
   */
  private createContext(
    benchmark: BenchmarkCase,
    iteration: number,
    isWarmup: boolean,
    startTime: number
  ): BenchmarkContext {
    return {
      iteration,
      totalIterations: benchmark.config.iterations,
      isWarmup,
      startTime,
      config: benchmark.config,
      input: undefined, // Will be set by workload generators
      cache: new Map(),
      metrics: this.createEmptyMetrics(),
    };
  }

  /**
   * Aggregate results from multiple iterations
   */
  private aggregateResults(
    benchmark: BenchmarkCase,
    results: BenchmarkResult[],
    startTime: number
  ): BenchmarkResult {
    const successfulResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    if (successfulResults.length === 0) {
      throw new Error('All benchmark iterations failed');
    }

    // Calculate statistics
    const durations = successfulResults.map((r) => r.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const stdDev = this.calculateStandardDeviation(durations, avgDuration);

    // Aggregate metrics
    const aggregatedMetrics = this.aggregateMetrics(successfulResults);

    // Check for high variance
    const coefficientOfVariation = stdDev / avgDuration;
    const isHighVariance = coefficientOfVariation > this.config.threshold.maxVariance;

    return {
      name: benchmark.name,
      duration: avgDuration,
      success: true,
      metrics: aggregatedMetrics,
      metadata: {
        category: benchmark.category,
        iterations: {
          total: results.length,
          successful: successfulResults.length,
          failed: failedResults.length,
        },
        statistics: {
          mean: avgDuration,
          min: minDuration,
          max: maxDuration,
          standardDeviation: stdDev,
          coefficientOfVariation,
          isHighVariance,
        },
        totalExecutionTime: Date.now() - startTime,
        config: benchmark.config,
      },
    };
  }

  /**
   * Aggregate metrics from multiple iterations
   */
  private aggregateMetrics(results: BenchmarkResult[]): BenchmarkMetrics {
    const metricsArrays = results.map((r) => r.metrics);

    const aggregated: BenchmarkMetrics = {
      memoryUsage: {
        rss: this.calculateMean(metricsArrays.map((m) => m.memoryUsage.rss)),
        heapTotal: this.calculateMean(metricsArrays.map((m) => m.memoryUsage.heapTotal)),
        heapUsed: this.calculateMean(metricsArrays.map((m) => m.memoryUsage.heapUsed)),
        external: this.calculateMean(metricsArrays.map((m) => m.memoryUsage.external)),
        arrayBuffers: this.calculateMean(metricsArrays.map((m) => m.memoryUsage.arrayBuffers)),
      },
      cpuUsage: {
        user: this.calculateMean(metricsArrays.map((m) => m.cpuUsage.user)),
        system: this.calculateMean(metricsArrays.map((m) => m.cpuUsage.system)),
      },
      fileOps: this.calculateSum(metricsArrays.map((m) => m.fileOps)),
      networkOps: this.calculateSum(metricsArrays.map((m) => m.networkOps)),
      cacheHits: this.calculateSum(metricsArrays.map((m) => m.cacheHits)),
      cacheMisses: this.calculateSum(metricsArrays.map((m) => m.cacheMisses)),
      bytesProcessed: this.calculateSum(metricsArrays.map((m) => m.bytesProcessed)),
      filesProcessed: this.calculateSum(metricsArrays.map((m) => m.filesProcessed)),
      optimizationRatio: this.calculateMean(metricsArrays.map((m) => m.optimizationRatio)),
      customMetrics: this.aggregateCustomMetrics(metricsArrays),
    };

    return aggregated;
  }

  /**
   * Aggregate custom metrics
   */
  private aggregateCustomMetrics(metricsArrays: BenchmarkMetrics[]): Record<string, number> {
    const customMetrics: Record<string, number> = {};
    const allKeys = new Set<string>();

    // Collect all custom metric keys
    metricsArrays.forEach((metrics) => {
      Object.keys(metrics.customMetrics).forEach((key) => allKeys.add(key));
    });

    // Aggregate each metric
    allKeys.forEach((key) => {
      const values = metricsArrays
        .map((metrics) => metrics.customMetrics[key])
        .filter((value) => value !== undefined);

      if (values.length > 0) {
        customMetrics[key] = this.calculateMean(values);
      }
    });

    return customMetrics;
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T> | T,
    timeoutMs: number,
    operation: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): BenchmarkMetrics {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      fileOps: 0,
      networkOps: 0,
      cacheHits: 0,
      cacheMisses: 0,
      bytesProcessed: 0,
      filesProcessed: 0,
      optimizationRatio: 0,
      customMetrics: {},
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDifferences = values.map((value) => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, sq) => sum + sq, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate mean of array
   */
  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  /**
   * Calculate sum of array
   */
  private calculateSum(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0);
  }
}
