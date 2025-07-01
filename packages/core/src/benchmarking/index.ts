/**
 * TW-Enigma Benchmarking System
 *
 * A comprehensive benchmarking framework for measuring and comparing
 * optimization performance across different scenarios and configurations.
 */

// Core benchmarking exports
export * from './core/BenchmarkRunner';
export { BenchmarkSuite } from './core/BenchmarkSuite';
export * from './types';

// Workload exports - only export specific items to avoid conflicts
export { RealWorldLoader } from './workloads/RealWorldLoader';
export { WorkloadManager } from './workloads/WorkloadManager';

// Visualization exports
export * from './visualization/ChartGenerator';

// Reporting exports - specific exports to avoid conflicts
export {
  // CSV Reporter
  CSVReporter,
  // HTML Reporter
  HTMLReporter,
  // JSON Reporter
  JSONReporter,
  createCSVReporter,
  createHTMLReporter,
  createJSONReporter,
  generateAllFormats,
  generateCSVReport,
  generateHTMLReport,
  generateJSONReport,
  // Multi-format
  generateMultiFormatReport,
  // Types that don't conflict
  type ReportFormat as BenchmarkReportFormat,
  type MultiFormatReportResult,
  type UniversalReportConfig,
} from './reporting';

// Utility exports
export { WorkloadValidator, runWorkloadValidation } from './scripts/validateWorkloads';

/**
 * Simple benchmark case for the facade
 */
interface SimpleBenchmarkCase {
  name: string;
  fn: () => Promise<void> | void;
  priority?: number;
}

/**
 * Main benchmarking facade for easy usage
 */
export class TailwindEnigmaBenchmarks {
  private benchmarks: SimpleBenchmarkCase[] = [];

  /**
   * Add a benchmark to the suite
   */
  add(name: string, fn: () => Promise<void> | void, priority: number = 0): this {
    this.benchmarks.push({ name, fn, priority });
    return this;
  }

  /**
   * Run all benchmarks and return results
   */
  async run(): Promise<import('./types').BenchmarkResult[]> {
    const { BenchmarkRunner } = await import('./core/BenchmarkRunner');

    const runnerConfig: import('./types').BenchmarkConfig = {
      name: 'TailwindEnigmaBenchmarks',
      description: 'Simple benchmark runner',
      enabled: true,
      timeout: 30000,
      iterations: 1,
      warmupIterations: 0,
      skipWarmup: true,
      parallel: false,
      maxParallelism: 1,
      tags: [],
      metadata: {},
    };

    const runner = new BenchmarkRunner({
      parallel: false,
      maxParallelism: 1,
      timeout: 30000,
      retries: 0,
      reportFormat: ['json'],
      outputDir: './reports',
      compareBaseline: false,
      threshold: {
        performanceRegression: 10,
        memoryIncrease: 20,
        errorRate: 5,
        minIterations: 1,
        maxVariance: 0.1,
      },
      environment: {
        platform: process.platform,
        nodeVersion: process.version,
        cpuCores: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
        architecture: process.arch,
        operatingSystem: require('os').type(),
        environmentVars: {},
        dependencies: {},
      },
    });

    const results: import('./types').BenchmarkResult[] = [];

    for (const benchmark of this.benchmarks) {
      const benchmarkCase: import('./types').BenchmarkCase = {
        id: benchmark.name,
        name: benchmark.name,
        description: `Benchmark: ${benchmark.name}`,
        config: runnerConfig,
        run: async () => {
          const start = Date.now();
          await benchmark.fn();
          const duration = Date.now() - start;
          return {
            name: benchmark.name,
            duration,
            success: true,
            metrics: {
              memoryUsage: { ...process.memoryUsage(), arrayBuffers: 0 },
              cpuUsage: process.cpuUsage(),
              fileOps: 0,
              networkOps: 0,
              cacheHits: 0,
              cacheMisses: 0,
              bytesProcessed: 0,
              filesProcessed: 0,
              optimizationRatio: 0,
              customMetrics: {},
            },
            metadata: {},
          };
        },
        category: 'optimization' as import('./types').BenchmarkCategory,
        priority: benchmark.priority || 0,
      };

      try {
        const result = await runner.runBenchmark(benchmarkCase);
        results.push(result);
      } catch (error) {
        results.push({
          name: benchmark.name,
          duration: 0,
          success: false,
          error: error as Error,
          metrics: {
            memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 },
            cpuUsage: { user: 0, system: 0 },
            fileOps: 0,
            networkOps: 0,
            cacheHits: 0,
            cacheMisses: 0,
            bytesProcessed: 0,
            filesProcessed: 0,
            optimizationRatio: 0,
            customMetrics: {},
          },
          metadata: {},
        });
      }
    }

    return results;
  }

  /**
   * Run benchmarks and generate comprehensive reports
   */
  async runWithReports(
    outputDir: string = './benchmark-reports',
    formats: Array<import('./reporting').ReportFormat> = ['html', 'json', 'csv']
  ): Promise<{
    results: import('./types').BenchmarkResult[];
    reports: import('./reporting').MultiFormatReportResult;
  }> {
    const results = await this.run();
    const { generateMultiFormatReport } = await import('./reporting');

    const reports = await generateMultiFormatReport(results, {
      formats,
      outputDirectory: outputDir,
      baseFilename: `tw-enigma-benchmark-${Date.now()}`,
    });

    return { results, reports };
  }
}

/**
 * Create a new benchmark suite instance
 */
export function createBenchmarkSuite(): TailwindEnigmaBenchmarks {
  return new TailwindEnigmaBenchmarks();
}

/**
 * Quick benchmark function for simple use cases
 */
export async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  options: {
    iterations?: number;
    warmup?: number;
    generateReports?: boolean;
    outputDir?: string;
  } = {}
): Promise<import('./types').BenchmarkResult[]> {
  const suite = createBenchmarkSuite();
  suite.add(name, fn);

  const results = await suite.run();

  if (options.generateReports) {
    const { generateAllFormats } = await import('./reporting');
    await generateAllFormats(results, options.outputDir);
  }

  return results;
}
