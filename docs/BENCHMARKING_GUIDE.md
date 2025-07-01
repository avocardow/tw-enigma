# TW-Enigma Performance Benchmarking Guide

## Overview

The TW-Enigma Performance Benchmarking System provides comprehensive tools for measuring, analyzing, and optimizing the performance of CSS processing operations. This guide covers setup, configuration, usage, and advanced features.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Configuration](#configuration)
- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [Profiling and Analysis](#profiling-and-analysis)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Quick Start

### Installation

```bash
npm install @tw-enigma/core
# or
pnpm add @tw-enigma/core
```

### Basic Benchmark

```typescript
import { BenchmarkRunner, createBenchmarkSuite } from '@tw-enigma/core/benchmarking';

// Create a simple benchmark
const suite = createBenchmarkSuite({
  name: 'CSS Processing Performance',
  description: 'Measure CSS optimization performance',
});

// Add a benchmark case
suite.addBenchmark({
  name: 'Basic CSS Optimization',
  description: 'Test basic CSS processing speed',
  fn: async () => {
    // Your code to benchmark
    const result = await processCSSFile('input.css');
    return result;
  },
  setup: async () => {
    // Setup code (not measured)
    await loadTestData();
  },
  teardown: async () => {
    // Cleanup code (not measured)
    await cleanupTestData();
  },
});

// Run the benchmark
const runner = new BenchmarkRunner();
const results = await runner.runSuite(suite);
console.log(results);
```

## Architecture Overview

The benchmarking system consists of several key components:

### Core Components

1. **BenchmarkRunner** - Orchestrates benchmark execution
2. **BenchmarkSuite** - Groups related benchmarks
3. **BenchmarkCase** - Individual test cases
4. **ResultAnalyzer** - Processes and analyzes results
5. **BenchmarkProfiler** - Captures performance metrics
6. **BottleneckAnalyzer** - Identifies performance issues

### Data Flow

```
BenchmarkSuite → BenchmarkRunner → BenchmarkCase → Results → Analysis → Reports
                      ↓
                 Profiling Data → Bottleneck Analysis → Recommendations
```

## Configuration

### Basic Configuration

```typescript
import { BenchmarkConfig } from '@tw-enigma/core/benchmarking';

const config: BenchmarkConfig = {
  iterations: 100,
  warmupIterations: 10,
  timeout: 30000,
  memoryLimit: 512 * 1024 * 1024, // 512MB
  outputDirectory: './benchmark-results',
  reporting: {
    formats: ['json', 'html', 'csv'],
    includeSystemInfo: true,
    includeDetailedMetrics: true,
  },
};
```

### Advanced Configuration

```typescript
const advancedConfig: BenchmarkConfig = {
  iterations: 1000,
  warmupIterations: 50,
  timeout: 60000,
  
  // Parallel execution
  parallel: {
    enabled: true,
    maxConcurrency: 4,
    isolateMemory: true,
  },
  
  // Statistical analysis
  statistics: {
    enableOutlierDetection: true,
    confidenceLevel: 0.95,
    minimumSampleSize: 30,
  },
  
  // Profiling configuration
  profiling: {
    enabled: true,
    captureSystemMetrics: true,
    captureMemorySnapshots: true,
    captureCPUProfile: true,
    sampleInterval: 100,
  },
  
  // Environment validation
  validation: {
    checkSystemRequirements: true,
    validateEnvironment: true,
    enforceConsistency: true,
  },
};
```

## Basic Usage

### Creating Benchmark Suites

```typescript
import { 
  createBenchmarkSuite, 
  BenchmarkRunner 
} from '@tw-enigma/core/benchmarking';

// Create suite with configuration
const suite = createBenchmarkSuite({
  name: 'CSS Processing Benchmarks',
  description: 'Comprehensive CSS optimization performance tests',
  tags: ['css', 'optimization', 'performance'],
  setup: async () => {
    // Global setup for all benchmarks in suite
    await initializeTestEnvironment();
  },
  teardown: async () => {
    // Global cleanup
    await cleanupTestEnvironment();
  },
});
```

### Adding Benchmark Cases

```typescript
// Simple function benchmark
suite.addBenchmark({
  name: 'CSS Parsing',
  fn: () => parseCSS(testCSSContent),
});

// Async benchmark with setup/teardown
suite.addBenchmark({
  name: 'File Processing',
  fn: async () => {
    return await processFile('test.css');
  },
  setup: async () => {
    await createTestFile('test.css', largeCSSContent);
  },
  teardown: async () => {
    await deleteTestFile('test.css');
  },
});

// Parameterized benchmark
suite.addBenchmark({
  name: 'Variable CSS Sizes',
  fn: (size: number) => processCSS(generateCSS(size)),
  parameters: [1000, 5000, 10000, 50000],
  iterations: 50, // Override default iterations
});
```

### Running Benchmarks

```typescript
const runner = new BenchmarkRunner(config);

// Run single suite
const results = await runner.runSuite(suite);

// Run multiple suites
const allResults = await runner.runSuites([suite1, suite2, suite3]);

// Run with filtering
const filteredResults = await runner.runSuites(suites, {
  filter: (benchmark) => benchmark.tags.includes('optimization'),
  parallel: true,
});
```

### Result Analysis

```typescript
import { ResultAnalyzer } from '@tw-enigma/core/benchmarking';

const analyzer = new ResultAnalyzer();
const analysis = analyzer.analyze(results);

console.log('Performance Summary:', analysis.summary);
console.log('Statistical Analysis:', analysis.statistics);
console.log('Recommendations:', analysis.recommendations);

// Compare with baseline
const comparison = analyzer.compareWithBaseline(results, baselineResults);
console.log('Performance Change:', comparison.overallChange);
console.log('Regressions:', comparison.regressions);
```

## Advanced Features

### Comparative Benchmarking

```typescript
import { ComparativeBenchmarkRunner } from '@tw-enigma/core/benchmarking';

const comparativeRunner = new ComparativeBenchmarkRunner();

// Compare different implementations
const comparison = await comparativeRunner.compare([
  {
    name: 'Current Implementation',
    suite: currentImplementationSuite,
  },
  {
    name: 'Optimized Implementation', 
    suite: optimizedImplementationSuite,
  },
]);

console.log('Winner:', comparison.winner);
console.log('Performance Improvement:', comparison.improvement);
```

### Memory Benchmarking

```typescript
import { MemoryBenchmarkRunner } from '@tw-enigma/core/benchmarking';

const memoryRunner = new MemoryBenchmarkRunner({
  captureHeapSnapshots: true,
  trackAllocations: true,
  detectLeaks: true,
});

const memoryResults = await memoryRunner.runSuite(suite);
console.log('Peak Memory Usage:', memoryResults.peakMemoryUsage);
console.log('Memory Leaks Detected:', memoryResults.leaksDetected);
```

### Custom Metrics

```typescript
suite.addBenchmark({
  name: 'Custom Metrics Example',
  fn: async () => {
    const startCacheHits = getCacheHits();
    await processWithCache();
    const endCacheHits = getCacheHits();
    
    // Return custom metrics
    return {
      cacheHitRate: (endCacheHits - startCacheHits) / getTotalRequests(),
      customMetric: calculateCustomValue(),
    };
  },
  metrics: {
    primary: 'duration', // Primary metric for comparison
    custom: ['cacheHitRate', 'customMetric'],
  },
});
```

## Profiling and Analysis

### Enabling Profiling

```typescript
import { 
  createBenchmarkProfiler,
  createBottleneckAnalyzer 
} from '@tw-enigma/core/benchmarking/profiling';

// Create profiler
const profiler = createBenchmarkProfiler({
  enabled: true,
  captureSystemMetrics: true,
  captureMemorySnapshots: true,
  captureCPUProfile: true,
  enableBottleneckDetection: true,
  exportFormats: ['json', 'flamegraph', 'html-report'],
});

// Create runner with profiling
const runner = new BenchmarkRunner(config, profiler);
```

### Bottleneck Analysis

```typescript
const analyzer = createBottleneckAnalyzer({
  enablePatternDetection: true,
  enableCorrelationAnalysis: true,
  enableRootCauseAnalysis: true,
  includeRecommendations: true,
});

// Analyze profiling data
const analysis = await analyzer.analyzeBottlenecks(profilingData);

console.log('Bottlenecks Found:', analysis.summary.totalBottlenecks);
console.log('Critical Issues:', analysis.summary.criticalBottlenecks);

// Priority recommendations
analysis.recommendations.forEach(recommendation => {
  console.log(`${recommendation.priority}: ${recommendation.title}`);
  console.log(`Action: ${recommendation.action}`);
  console.log(`Estimated Impact: ${recommendation.estimatedImpact}%`);
});
```

### Exporting Profiling Data

```typescript
import { createProfilingExporter } from '@tw-enigma/core/benchmarking/profiling';

const exporter = createProfilingExporter({
  formats: ['json', 'flamegraph', 'chrome-trace', 'html-report'],
  outputDirectory: './profiling-reports',
  compression: true,
});

// Export comprehensive profiling data
const exportResults = await exporter.exportProfilingData(
  profilingData, 
  bottleneckAnalysis
);

console.log('Exported formats:', exportResults.map(r => r.format));
console.log('Total file size:', exportResults.reduce((sum, r) => sum + r.fileSize, 0));
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Performance Benchmarks

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run benchmarks
        run: pnpm benchmark:ci
      
      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results/
```

### Package.json Scripts

```json
{
  "scripts": {
    "benchmark": "node scripts/run-benchmarks.js",
    "benchmark:ci": "node scripts/run-benchmarks.js --ci",
    "benchmark:profile": "node scripts/run-benchmarks.js --profile",
    "benchmark:compare": "node scripts/compare-benchmarks.js",
    "benchmark:report": "node scripts/generate-report.js"
  }
}
```

### CI Benchmark Script

```typescript
// scripts/run-benchmarks.js
import { BenchmarkRunner } from '@tw-enigma/core/benchmarking';
import { createCIBenchmarkProfiler } from '@tw-enigma/core/benchmarking/profiling';

const isCI = process.argv.includes('--ci');
const enableProfiling = process.argv.includes('--profile');

const config = {
  iterations: isCI ? 50 : 100,
  timeout: isCI ? 30000 : 60000,
  outputDirectory: './benchmark-results',
  reporting: {
    formats: isCI ? ['json', 'csv'] : ['json', 'html', 'csv'],
  },
};

// Use CI-optimized profiler in CI environment
const profiler = enableProfiling ? createCIBenchmarkProfiler() : undefined;
const runner = new BenchmarkRunner(config, profiler);

// Load and run benchmark suites
const suites = await loadBenchmarkSuites();
const results = await runner.runSuites(suites);

// Check for performance regressions in CI
if (isCI) {
  const hasRegressions = checkForRegressions(results);
  process.exit(hasRegressions ? 1 : 0);
}
```

## Troubleshooting

### Common Issues

#### Out of Memory Errors

```typescript
// Increase memory limit
const config: BenchmarkConfig = {
  memoryLimit: 2 * 1024 * 1024 * 1024, // 2GB
  // Or reduce iterations
  iterations: 50,
  // Enable memory cleanup
  cleanup: {
    forceGC: true,
    clearModuleCache: true,
  },
};
```

#### Inconsistent Results

```typescript
// Improve result consistency
const config: BenchmarkConfig = {
  warmupIterations: 20, // Increase warmup
  iterations: 200, // More iterations
  statistics: {
    enableOutlierDetection: true,
    minimumSampleSize: 50,
  },
  // Isolate benchmark execution
  isolation: {
    processIsolation: true,
    clearState: true,
  },
};
```

#### Slow Benchmark Execution

```typescript
// Optimize for speed
const config: BenchmarkConfig = {
  parallel: {
    enabled: true,
    maxConcurrency: require('os').cpus().length,
  },
  // Reduce profiling overhead
  profiling: {
    enabled: false, // Disable in speed-critical scenarios
    sampleInterval: 1000, // Reduce sampling frequency
  },
};
```

### Debug Mode

```typescript
import { enableBenchmarkDebug } from '@tw-enigma/core/benchmarking';

// Enable detailed logging
enableBenchmarkDebug(true);

// Set log level
process.env.LOG_LEVEL = 'debug';

// Use debug runner
import { DebugBenchmarkRunner } from '@tw-enigma/core/benchmarking';
const debugRunner = new DebugBenchmarkRunner(config);
```

### Performance Debugging

```typescript
// Enable detailed performance tracking
const runner = new BenchmarkRunner({
  ...config,
  debug: {
    captureStackTraces: true,
    trackResourceUsage: true,
    logDetailedTiming: true,
  },
  profiling: {
    enabled: true,
    captureStackTraces: true,
    enableRealTimeAnalysis: true,
  },
});
```

## API Reference

### BenchmarkRunner

```typescript
class BenchmarkRunner {
  constructor(config?: BenchmarkConfig, profiler?: BenchmarkProfiler);
  
  // Run single suite
  async runSuite(suite: BenchmarkSuite): Promise<BenchmarkResult[]>;
  
  // Run multiple suites
  async runSuites(suites: BenchmarkSuite[]): Promise<BenchmarkResult[]>;
  
  // Run with filtering
  async runSuites(
    suites: BenchmarkSuite[], 
    options: RunOptions
  ): Promise<BenchmarkResult[]>;
  
  // Get profiling data
  getProfilingData(): BenchmarkProfilingData[];
}
```

### BenchmarkSuite

```typescript
interface BenchmarkSuite {
  name: string;
  description?: string;
  tags?: string[];
  setup?(): Promise<void>;
  teardown?(): Promise<void>;
  
  addBenchmark(benchmark: BenchmarkCase): void;
  getBenchmarks(): BenchmarkCase[];
  filter(predicate: (b: BenchmarkCase) => boolean): BenchmarkCase[];
}
```

### BenchmarkCase

```typescript
interface BenchmarkCase {
  name: string;
  description?: string;
  tags?: string[];
  iterations?: number;
  timeout?: number;
  
  fn: BenchmarkFunction;
  setup?(): Promise<void>;
  teardown?(): Promise<void>;
  
  parameters?: any[];
  metrics?: MetricConfiguration;
}
```

### ResultAnalyzer

```typescript
class ResultAnalyzer {
  analyze(results: BenchmarkResult[]): AnalysisReport;
  compareWithBaseline(
    current: BenchmarkResult[], 
    baseline: BenchmarkResult[]
  ): ComparisonReport;
  generateReport(analysis: AnalysisReport): string;
}
```

### Configuration Types

```typescript
interface BenchmarkConfig {
  iterations?: number;
  warmupIterations?: number;
  timeout?: number;
  memoryLimit?: number;
  outputDirectory?: string;
  
  parallel?: ParallelConfig;
  statistics?: StatisticsConfig;
  profiling?: BenchmarkProfilingConfig;
  validation?: ValidationConfig;
  reporting?: ReportingConfig;
}
```

## Best Practices

### Benchmark Design

1. **Keep benchmarks focused** - Test one thing at a time
2. **Use realistic data** - Test with production-like datasets
3. **Include setup/teardown** - Isolate measurement from preparation
4. **Use appropriate iterations** - Balance accuracy with execution time
5. **Tag benchmarks** - Enable filtering and organization

### Performance Optimization

1. **Profile before optimizing** - Identify actual bottlenecks
2. **Use baseline comparisons** - Track performance over time
3. **Monitor memory usage** - Prevent memory-related performance issues
4. **Test different scenarios** - Vary input sizes and types
5. **Automate regression detection** - Catch performance issues early

### CI/CD Integration

1. **Use shorter iterations in CI** - Balance accuracy with build time
2. **Store baseline results** - Enable comparison across builds
3. **Set performance budgets** - Fail builds on significant regressions
4. **Archive benchmark data** - Track performance trends over time
5. **Generate actionable reports** - Make performance data accessible

## Examples

See the [examples directory](../examples/) for complete working examples:

- [Basic benchmarking](../examples/basic-benchmarking.ts)
- [Advanced profiling](../examples/advanced-profiling.ts)
- [CI integration](../examples/ci-integration.ts)
- [Memory benchmarking](../examples/memory-benchmarking.ts)
- [Comparative analysis](../examples/comparative-analysis.ts)

## Support

For additional help:
- Check the [troubleshooting section](#troubleshooting)
- Review [API documentation](./API_REFERENCE.md)
- See [integration examples](../examples/)
- Open an issue for bugs or feature requests