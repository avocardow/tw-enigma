import { 
  BenchmarkConfig,
  BenchmarkSuiteConfig,
  BenchmarkThreshold,
  BenchmarkingSystemConfig,
  ReportFormat,
} from '../types';

/**
 * Default configuration for individual benchmarks
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  name: '',
  description: '',
  enabled: true,
  timeout: 30000, // 30 seconds
  iterations: 10,
  warmupIterations: 3,
  skipWarmup: false,
  parallel: false,
  maxParallelism: 1,
  randomSeed: undefined,
  tags: [],
  metadata: {},
};

/**
 * Default configuration for benchmark suites
 */
export const DEFAULT_BENCHMARK_SUITE_CONFIG: BenchmarkSuiteConfig = {
  parallel: false,
  maxParallelism: 4,
  timeout: 300000, // 5 minutes
  retries: 0,
  reportFormat: ['json', 'console'],
  outputDir: './benchmark-results',
  compareBaseline: false,
  baselineFile: undefined,
  threshold: {
    performanceRegression: 10, // 10% regression threshold
    memoryIncrease: 20, // 20% memory increase threshold
    errorRate: 5, // 5% error rate threshold
    minIterations: 5,
    maxVariance: 0.2, // 20% coefficient of variation
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
};

/**
 * Default thresholds for benchmark comparison
 */
export const DEFAULT_BENCHMARK_THRESHOLD: BenchmarkThreshold = {
  performanceRegression: 10,
  memoryIncrease: 20,
  errorRate: 5,
  minIterations: 5,
  maxVariance: 0.2,
};

/**
 * Default configuration for the entire benchmarking system
 */
export const DEFAULT_BENCHMARKING_SYSTEM_CONFIG: BenchmarkingSystemConfig = {
  enabled: true,
  defaultSuiteConfig: DEFAULT_BENCHMARK_SUITE_CONFIG,
  profilers: [],
  reporters: [],
  storage: {
    type: 'filesystem',
    config: {
      directory: './benchmark-results',
      compression: true,
      retention: {
        maxFiles: 100,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    },
    store: async () => '',
    retrieve: async () => ({} as any),
    list: async () => [],
  },
  ci: {
    enabled: false,
    providers: [],
    thresholds: DEFAULT_BENCHMARK_THRESHOLD,
    failOnRegression: true,
    compareWithBaseline: true,
    uploadResults: false,
  },
  notifications: {
    enabled: false,
    channels: [],
    triggers: [],
  },
};

/**
 * Performance-focused benchmark configuration
 */
export const PERFORMANCE_BENCHMARK_CONFIG: Partial<BenchmarkConfig> = {
  iterations: 50,
  warmupIterations: 10,
  timeout: 60000,
  parallel: false,
  tags: ['performance'],
};

/**
 * Quick benchmark configuration for development
 */
export const QUICK_BENCHMARK_CONFIG: Partial<BenchmarkConfig> = {
  iterations: 3,
  warmupIterations: 1,
  timeout: 10000,
  skipWarmup: false,
  tags: ['quick', 'development'],
};

/**
 * Stress test benchmark configuration
 */
export const STRESS_BENCHMARK_CONFIG: Partial<BenchmarkConfig> = {
  iterations: 100,
  warmupIterations: 20,
  timeout: 120000,
  parallel: true,
  maxParallelism: 8,
  tags: ['stress', 'load'],
};

/**
 * Memory-focused benchmark configuration
 */
export const MEMORY_BENCHMARK_CONFIG: Partial<BenchmarkConfig> = {
  iterations: 20,
  warmupIterations: 5,
  timeout: 45000,
  tags: ['memory'],
};

/**
 * CI-friendly benchmark configuration
 */
export const CI_BENCHMARK_CONFIG: Partial<BenchmarkConfig> = {
  iterations: 5,
  warmupIterations: 2,
  timeout: 30000,
  tags: ['ci', 'regression'],
};

/**
 * Comprehensive suite configuration for detailed analysis
 */
export const COMPREHENSIVE_SUITE_CONFIG: Partial<BenchmarkSuiteConfig> = {
  parallel: true,
  maxParallelism: 8,
  timeout: 600000, // 10 minutes
  reportFormat: ['json', 'html', 'console', 'csv'],
  compareBaseline: true,
  threshold: {
    performanceRegression: 5, // Stricter 5% threshold
    memoryIncrease: 15,
    errorRate: 2,
    minIterations: 10,
    maxVariance: 0.15,
  },
};

/**
 * Fast suite configuration for development
 */
export const FAST_SUITE_CONFIG: Partial<BenchmarkSuiteConfig> = {
  parallel: true,
  maxParallelism: 4,
  timeout: 60000, // 1 minute
  reportFormat: ['console'],
  compareBaseline: false,
  threshold: {
    performanceRegression: 25, // Relaxed thresholds for development
    memoryIncrease: 50,
    errorRate: 10,
    minIterations: 3,
    maxVariance: 0.3,
  },
};

/**
 * Production monitoring configuration
 */
export const PRODUCTION_SUITE_CONFIG: Partial<BenchmarkSuiteConfig> = {
  parallel: false, // Sequential for stability
  maxParallelism: 1,
  timeout: 300000, // 5 minutes
  reportFormat: ['json'],
  compareBaseline: true,
  threshold: {
    performanceRegression: 3, // Very strict for production
    memoryIncrease: 10,
    errorRate: 1,
    minIterations: 20,
    maxVariance: 0.1,
  },
};

/**
 * Get environment-specific default configuration
 */
export function getEnvironmentDefaults(environment: 'development' | 'ci' | 'production'): {
  benchmark: Partial<BenchmarkConfig>;
  suite: Partial<BenchmarkSuiteConfig>;
} {
  switch (environment) {
    case 'development':
      return {
        benchmark: QUICK_BENCHMARK_CONFIG,
        suite: FAST_SUITE_CONFIG,
      };
    
    case 'ci':
      return {
        benchmark: CI_BENCHMARK_CONFIG,
        suite: {
          ...FAST_SUITE_CONFIG,
          reportFormat: ['json', 'junit'],
          compareBaseline: true,
        },
      };
    
    case 'production':
      return {
        benchmark: PERFORMANCE_BENCHMARK_CONFIG,
        suite: PRODUCTION_SUITE_CONFIG,
      };
    
    default:
      return {
        benchmark: DEFAULT_BENCHMARK_CONFIG,
        suite: DEFAULT_BENCHMARK_SUITE_CONFIG,
      };
  }
}

/**
 * Get configuration for specific benchmark category
 */
export function getCategoryDefaults(category: string): Partial<BenchmarkConfig> {
  switch (category) {
    case 'performance':
      return PERFORMANCE_BENCHMARK_CONFIG;
    
    case 'memory':
      return MEMORY_BENCHMARK_CONFIG;
    
    case 'stress':
      return STRESS_BENCHMARK_CONFIG;
    
    case 'quick':
      return QUICK_BENCHMARK_CONFIG;
    
    default:
      return DEFAULT_BENCHMARK_CONFIG;
  }
}

/**
 * Report formats for different environments
 */
export const REPORT_FORMATS: Record<string, ReportFormat[]> = {
  development: ['console'],
  ci: ['json', 'junit', 'console'],
  production: ['json', 'html'],
  comprehensive: ['json', 'html', 'csv', 'markdown', 'console'],
};