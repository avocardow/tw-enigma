# TW-Enigma Benchmarking Examples

This document provides comprehensive examples demonstrating various features and use cases of the TW-Enigma Performance Benchmarking System.

## Table of Contents

- [Quick Start Examples](#quick-start-examples)
- [Basic Benchmarking](#basic-benchmarking)
- [Advanced Features](#advanced-features)
- [CI/CD Integration](#cicd-integration)
- [Profiling and Analysis](#profiling-and-analysis)
- [Custom Scenarios](#custom-scenarios)

## Quick Start Examples

### Simple Function Benchmark

```typescript
import { BenchmarkRunner, createBenchmarkSuite } from '@tw-enigma/core/benchmarking';

const suite = createBenchmarkSuite({
  name: 'Quick Test',
  description: 'Simple performance test',
});

suite.addBenchmark({
  name: 'Array Processing',
  fn: () => {
    const arr = Array(1000).fill(0);
    return arr.map(x => x * 2).reduce((sum, x) => sum + x, 0);
  },
});

const runner = new BenchmarkRunner();
const results = await runner.runSuite(suite);

console.log('Average time:', results[0].metrics.mean.toFixed(2), 'ms');
```

### Async Operation Benchmark

```typescript
suite.addBenchmark({
  name: 'Async File Processing',
  fn: async () => {
    // Simulate async file processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    return { processed: true, timestamp: Date.now() };
  },
});
```

### Parameterized Benchmark

```typescript
suite.addBenchmark({
  name: 'Variable Size Processing',
  fn: (size: number) => {
    const data = new Array(size).fill(Math.random());
    return data.sort((a, b) => a - b);
  },
  parameters: [100, 500, 1000, 5000],
});
```

## Basic Benchmarking

### Complete Basic Example

```typescript
import { BenchmarkRunner, createBenchmarkSuite } from '@tw-enigma/core/benchmarking';
import { promises as fs } from 'fs';

async function runBasicBenchmarks() {
  // Create benchmark suite
  const suite = createBenchmarkSuite({
    name: 'CSS Processing Benchmarks',
    description: 'Basic CSS processing performance tests',
    tags: ['css', 'performance'],
    
    // Global setup for all benchmarks
    setup: async () => {
      console.log('Setting up test environment...');
      await fs.mkdir('./temp', { recursive: true });
    },
    
    // Global cleanup
    teardown: async () => {
      console.log('Cleaning up test environment...');
      await fs.rmdir('./temp', { recursive: true });
    },
  });

  // CSS processing functions to benchmark
  const parseCSS = (css: string) => {
    const rules = css.split('{').length - 1;
    const selectors = css.split(',').length;
    return { rules, selectors };
  };

  const optimizeCSS = (css: string) => {
    return css
      .replace(/\s+/g, ' ')
      .replace(/;\s*}/g, '}')
      .trim();
  };

  const compressCSS = (css: string) => {
    return css
      .replace(/\s+/g, '')
      .replace(/;}/g, '}');
  };

  // Test data
  const smallCSS = '.btn { color: blue; } .card { margin: 10px; }';
  const mediumCSS = Array(100).fill(smallCSS).join('\n');
  const largeCSS = Array(1000).fill(smallCSS).join('\n');

  // Add benchmarks for different CSS sizes
  ['small', 'medium', 'large'].forEach(size => {
    const css = size === 'small' ? smallCSS : 
                size === 'medium' ? mediumCSS : largeCSS;

    suite.addBenchmark({
      name: `Parse CSS - ${size}`,
      fn: () => parseCSS(css),
      tags: ['parsing', size],
    });

    suite.addBenchmark({
      name: `Optimize CSS - ${size}`,
      fn: () => optimizeCSS(css),
      tags: ['optimization', size],
    });

    suite.addBenchmark({
      name: `Compress CSS - ${size}`,
      fn: () => compressCSS(css),
      tags: ['compression', size],
    });
  });

  // File I/O benchmark with setup/teardown
  suite.addBenchmark({
    name: 'File Processing',
    setup: async () => {
      await fs.writeFile('./temp/test.css', largeCSS);
    },
    fn: async () => {
      const content = await fs.readFile('./temp/test.css', 'utf-8');
      return optimizeCSS(content);
    },
    teardown: async () => {
      await fs.unlink('./temp/test.css');
    },
    tags: ['file-io'],
  });

  // Configure benchmark runner
  const runner = new BenchmarkRunner({
    iterations: 100,
    warmupIterations: 10,
    timeout: 30000,
    outputDirectory: './benchmark-results',
    
    reporting: {
      formats: ['json', 'html'],
      includeSystemInfo: true,
      includeDetailedMetrics: true,
    },
    
    statistics: {
      enableOutlierDetection: true,
      confidenceLevel: 0.95,
    },
  });

  // Run benchmarks
  console.log('Running benchmarks...');
  const results = await runner.runSuite(suite);

  // Display results
  console.log('\nResults Summary:');
  console.log('================');
  
  results.forEach(result => {
    if (result.success) {
      console.log(`${result.name}:`);
      console.log(`  Mean: ${result.metrics.mean.toFixed(2)}ms`);
      console.log(`  Min:  ${result.metrics.min.toFixed(2)}ms`);
      console.log(`  Max:  ${result.metrics.max.toFixed(2)}ms`);
      console.log(`  Std:  ${result.metrics.standardDeviation.toFixed(2)}ms`);
      console.log('');
    } else {
      console.log(`${result.name}: FAILED`);
    }
  });

  return results;
}
```

### Memory Usage Tracking

```typescript
import { MemoryBenchmarkRunner } from '@tw-enigma/core/benchmarking';

const memoryRunner = new MemoryBenchmarkRunner({
  captureHeapSnapshots: true,
  trackAllocations: true,
  detectLeaks: true,
});

suite.addBenchmark({
  name: 'Memory Intensive Operation',
  fn: () => {
    // Create large objects
    const largeArray = new Array(100000).fill(0).map((_, i) => ({
      id: i,
      data: `item-${i}`,
      metadata: { timestamp: Date.now() },
    }));
    
    // Process and filter
    return largeArray
      .filter(item => item.id % 2 === 0)
      .map(item => ({ ...item, processed: true }));
  },
});

const results = await memoryRunner.runSuite(suite);
console.log('Peak Memory:', results.peakMemoryUsage / 1024 / 1024, 'MB');
console.log('Memory Leaks:', results.leaksDetected ? 'DETECTED' : 'NONE');
```

## Advanced Features

### Comparative Benchmarking

```typescript
import { ComparativeBenchmarkRunner } from '@tw-enigma/core/benchmarking';

// Create different implementation suites
const v1Suite = createBenchmarkSuite({
  name: 'Implementation V1',
  description: 'Original implementation',
});

const v2Suite = createBenchmarkSuite({
  name: 'Implementation V2', 
  description: 'Optimized implementation',
});

// Add same benchmarks to both suites with different implementations
['parse', 'optimize', 'compress'].forEach(operation => {
  v1Suite.addBenchmark({
    name: `CSS ${operation}`,
    fn: () => v1Implementation[operation](testCSS),
  });

  v2Suite.addBenchmark({
    name: `CSS ${operation}`,
    fn: () => v2Implementation[operation](testCSS),
  });
});

// Run comparative analysis
const comparativeRunner = new ComparativeBenchmarkRunner();
const comparison = await comparativeRunner.compare([
  { name: 'V1', suite: v1Suite },
  { name: 'V2', suite: v2Suite },
]);

console.log('Winner:', comparison.winner);
console.log('Improvement:', comparison.improvement.toFixed(2), '%');
console.log('Confidence:', (comparison.confidence * 100).toFixed(1), '%');
```

### Custom Metrics

```typescript
let cacheHits = 0;
let cacheMisses = 0;

suite.addBenchmark({
  name: 'Cached Operation',
  fn: () => {
    const key = 'test-key';
    
    // Simulate cache lookup
    if (Math.random() > 0.3) {
      cacheHits++;
      return { result: 'cached-value', cached: true };
    } else {
      cacheMisses++;
      // Simulate expensive computation
      const result = expensiveComputation();
      return { result, cached: false };
    }
  },
  
  // Custom metrics calculated after each iteration
  afterEach: () => ({
    cacheHitRate: cacheHits / (cacheHits + cacheMisses),
    totalOperations: cacheHits + cacheMisses,
  }),
  
  metrics: {
    primary: 'duration',
    custom: ['cacheHitRate', 'totalOperations'],
  },
});
```

### Statistical Analysis

```typescript
import { ResultAnalyzer } from '@tw-enigma/core/benchmarking';

const analyzer = new ResultAnalyzer({
  enableTrendAnalysis: true,
  confidenceLevel: 0.95,
  enableOutlierDetection: true,
});

const analysis = analyzer.analyze(results);

console.log('Statistical Summary:');
console.log('- Total benchmarks:', analysis.summary.totalBenchmarks);
console.log('- Success rate:', (analysis.summary.successRate * 100).toFixed(1), '%');
console.log('- Average duration:', analysis.summary.averageDuration.toFixed(2), 'ms');
console.log('- Performance variance:', analysis.summary.variance.toFixed(2));

// Check for outliers
if (analysis.outliers.length > 0) {
  console.log('\nOutliers detected:');
  analysis.outliers.forEach(outlier => {
    console.log(`- ${outlier.name}: ${outlier.value.toFixed(2)}ms (${outlier.deviations.toFixed(1)}σ)`);
  });
}

// Performance recommendations
if (analysis.recommendations.length > 0) {
  console.log('\nRecommendations:');
  analysis.recommendations.forEach(rec => {
    console.log(`- ${rec.title}: ${rec.description}`);
  });
}
```

## CI/CD Integration

### GitHub Actions Workflow

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
        with:
          fetch-depth: 0 # Need history for baseline comparison
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build packages
        run: pnpm build
      
      - name: Download baseline results
        if: github.event_name == 'pull_request'
        run: |
          gh run download \
            --repo ${{ github.repository }} \
            --branch main \
            --name "benchmark-baseline" \
            --dir baseline-results || echo "No baseline found"
        env:
          GH_TOKEN: ${{ github.token }}
      
      - name: Run benchmarks
        run: pnpm benchmark:ci
        env:
          CI: true
          GITHUB_TOKEN: ${{ github.token }}
      
      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results/
      
      - name: Upload baseline (main branch only)
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-baseline
          path: benchmark-results/
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            try {
              const summary = fs.readFileSync('benchmark-results/summary.md', 'utf8');
              await github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: summary
              });
            } catch (error) {
              console.log('Could not post benchmark results:', error.message);
            }
```

### CI Benchmark Script

```typescript
// scripts/benchmark-ci.ts
import { BenchmarkRunner, createBenchmarkSuite } from '@tw-enigma/core/benchmarking';
import { promises as fs } from 'fs';

interface CIConfig {
  isCI: boolean;
  isPR: boolean;
  branch: string;
  commit: string;
}

function detectCI(): CIConfig {
  return {
    isCI: process.env.CI === 'true',
    isPR: !!process.env.GITHUB_PR_NUMBER,
    branch: process.env.GITHUB_REF_NAME || 'unknown',
    commit: process.env.GITHUB_SHA || 'unknown',
  };
}

async function loadBaseline(): Promise<any[] | null> {
  try {
    const data = await fs.readFile('baseline-results/results.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveBaseline(results: any[]): Promise<void> {
  await fs.mkdir('benchmark-results', { recursive: true });
  await fs.writeFile(
    'benchmark-results/results.json',
    JSON.stringify(results, null, 2)
  );
}

async function checkPerformanceBudget(results: any[]): Promise<boolean> {
  const budgets = {
    'CSS Parsing': 100, // 100ms max
    'CSS Optimization': 200, // 200ms max
    'CSS Compression': 50, // 50ms max
  };

  let passed = true;
  const violations: string[] = [];

  for (const result of results) {
    if (!result.success) continue;
    
    const budget = budgets[result.name];
    if (budget && result.metrics.mean > budget) {
      passed = false;
      violations.push(
        `${result.name}: ${result.metrics.mean.toFixed(2)}ms > ${budget}ms`
      );
    }
  }

  if (!passed) {
    console.log('❌ Performance budget violations:');
    violations.forEach(v => console.log(`  - ${v}`));
  }

  return passed;
}

async function compareWithBaseline(
  current: any[], 
  baseline: any[]
): Promise<{ passed: boolean; regressions: string[] }> {
  const regressions: string[] = [];
  const threshold = 0.15; // 15% regression threshold

  for (const currentResult of current) {
    if (!currentResult.success) continue;

    const baselineResult = baseline.find(b => b.name === currentResult.name);
    if (!baselineResult || !baselineResult.success) continue;

    const change = (currentResult.metrics.mean - baselineResult.metrics.mean) / 
                   baselineResult.metrics.mean;

    if (change > threshold) {
      regressions.push(
        `${currentResult.name}: ${(change * 100).toFixed(1)}% slower ` +
        `(${currentResult.metrics.mean.toFixed(2)}ms vs ${baselineResult.metrics.mean.toFixed(2)}ms)`
      );
    }
  }

  if (regressions.length > 0) {
    console.log('❌ Performance regressions detected:');
    regressions.forEach(r => console.log(`  - ${r}`));
  }

  return {
    passed: regressions.length === 0,
    regressions,
  };
}

async function generateSummary(
  results: any[],
  budgetPassed: boolean,
  comparison: { passed: boolean; regressions: string[] } | null,
  ciConfig: CIConfig
): Promise<void> {
  const successCount = results.filter(r => r.success).length;
  
  let summary = `## 📊 Performance Benchmark Results\n\n`;
  summary += `**Branch:** ${ciConfig.branch} | **Commit:** ${ciConfig.commit.slice(0, 8)}\n\n`;
  
  summary += `### Overall Status\n`;
  summary += `- ✅ Benchmarks: ${successCount}/${results.length} passed\n`;
  summary += `- 💰 Budget: ${budgetPassed ? '✅ PASS' : '❌ FAIL'}\n`;
  
  if (comparison) {
    summary += `- 📈 Regression: ${comparison.passed ? '✅ PASS' : '❌ FAIL'}\n`;
  }
  
  summary += `\n### Results\n\n`;
  summary += `| Benchmark | Duration | Memory | Status |\n`;
  summary += `|-----------|----------|--------|---------|\n`;
  
  results.forEach(result => {
    if (result.success) {
      const duration = `${result.metrics.mean.toFixed(2)}ms`;
      const memory = `${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`;
      summary += `| ${result.name} | ${duration} | ${memory} | ✅ |\n`;
    } else {
      summary += `| ${result.name} | - | - | ❌ |\n`;
    }
  });

  if (comparison && comparison.regressions.length > 0) {
    summary += `\n### 📈 Regressions\n\n`;
    comparison.regressions.forEach(r => {
      summary += `- ❌ ${r}\n`;
    });
  }

  await fs.writeFile('benchmark-results/summary.md', summary);
}

async function main() {
  const ciConfig = detectCI();
  
  console.log('🚀 Running CI benchmarks...');
  console.log(`Branch: ${ciConfig.branch}, PR: ${ciConfig.isPR}`);

  // Create CI-optimized suite
  const suite = createBenchmarkSuite({
    name: 'CI Performance Tests',
    description: 'Fast benchmarks for CI environment',
  });

  // Add lightweight benchmarks
  suite.addBenchmark({
    name: 'CSS Parsing',
    fn: () => mockCSSParsing(),
  });

  suite.addBenchmark({
    name: 'CSS Optimization',
    fn: () => mockCSSOptimization(),
  });

  suite.addBenchmark({
    name: 'CSS Compression',
    fn: () => mockCSSCompression(),
  });

  // Run with CI configuration
  const runner = new BenchmarkRunner({
    iterations: ciConfig.isCI ? 20 : 50,
    timeout: 30000,
    outputDirectory: './benchmark-results',
    reporting: {
      formats: ['json'],
      includeSystemInfo: true,
    },
  });

  const results = await runner.runSuite(suite);
  
  // Check performance budget
  const budgetPassed = await checkPerformanceBudget(results);
  
  // Compare with baseline if available
  let comparison = null;
  if (ciConfig.isPR) {
    const baseline = await loadBaseline();
    if (baseline) {
      comparison = await compareWithBaseline(results, baseline);
    }
  }

  // Generate summary
  await generateSummary(results, budgetPassed, comparison, ciConfig);
  
  // Save as baseline if on main branch
  if (ciConfig.branch === 'main') {
    await saveBaseline(results);
  }

  // Exit with appropriate code
  const passed = budgetPassed && (!comparison || comparison.passed);
  console.log(`\n🏁 Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  process.exit(passed ? 0 : 1);
}

// Mock functions for demonstration
function mockCSSParsing() {
  const delay = Math.random() * 20;
  for (let i = 0; i < delay * 10000; i++) { /* busy work */ }
  return { rules: 10 };
}

function mockCSSOptimization() {
  const delay = Math.random() * 30;
  for (let i = 0; i < delay * 10000; i++) { /* busy work */ }
  return 'optimized css';
}

function mockCSSCompression() {
  const delay = Math.random() * 10;
  for (let i = 0; i < delay * 10000; i++) { /* busy work */ }
  return 'compressed css';
}

main().catch(error => {
  console.error('❌ CI benchmark failed:', error);
  process.exit(1);
});
```

## Profiling and Analysis

### Comprehensive Profiling

```typescript
import {
  createBenchmarkProfiler,
  createBottleneckAnalyzer,
  createProfilingExporter,
} from '@tw-enigma/core/benchmarking/profiling';

// Create profiler with all features enabled
const profiler = createBenchmarkProfiler({
  enabled: true,
  captureSystemMetrics: true,
  captureMemorySnapshots: true,
  captureCPUProfile: true,
  captureGCEvents: true,
  captureEventLoopLag: true,
  enableBottleneckDetection: true,
  bottleneckThreshold: 5, // 5ms threshold
  exportFormats: ['json', 'flamegraph', 'chrome-trace', 'html-report'],
});

// Run benchmarks with profiling
const runner = new BenchmarkRunner(config, profiler);
const results = await runner.runSuite(suite);
const profilingData = runner.getProfilingData();

// Analyze bottlenecks
const analyzer = createBottleneckAnalyzer({
  enablePatternDetection: true,
  enableCorrelationAnalysis: true,
  enableRootCauseAnalysis: true,
  includeRecommendations: true,
});

const analysis = await analyzer.analyzeBottlenecks(profilingData);

console.log('Bottleneck Analysis:');
console.log('- Total bottlenecks:', analysis.summary.totalBottlenecks);
console.log('- Critical issues:', analysis.summary.criticalBottlenecks);
console.log('- Time wasted:', analysis.summary.totalTimeWasted.toFixed(2), 'ms');

// Display critical bottlenecks
analysis.bottlenecks
  .filter(b => b.impact === 'critical')
  .forEach(bottleneck => {
    console.log(`\nCritical: ${bottleneck.operation}`);
    console.log(`Duration: ${bottleneck.duration.toFixed(2)}ms`);
    console.log(`Recommendations: ${bottleneck.recommendations.join(', ')}`);
  });

// Export profiling data
const exporter = createProfilingExporter({
  formats: ['json', 'flamegraph', 'chrome-trace', 'html-report'],
  outputDirectory: './profiling-exports',
});

await exporter.exportProfilingData(profilingData, analysis);
console.log('Profiling data exported to ./profiling-exports/');
```

### Real-time Profiling

```typescript
// Enable real-time bottleneck detection
const profiler = createBenchmarkProfiler({
  enableRealTimeAnalysis: true,
  sampleInterval: 100, // Sample every 100ms
});

const analyzer = createBottleneckAnalyzer();

// Monitor real-time bottlenecks
profiler.on('bottleneckDetected', async (data) => {
  console.log('⚠️ Real-time bottleneck detected:', data.operation);
  
  // Analyze in real-time
  const snapshot = data.resourceSnapshot;
  const bottlenecks = await analyzer.analyzeRealTime(snapshot, {
    benchmarkName: data.benchmarkName,
    timestamp: Date.now(),
  });
  
  bottlenecks.forEach(bottleneck => {
    if (bottleneck.impact === 'critical') {
      console.log(`🚨 Critical bottleneck: ${bottleneck.operation}`);
      console.log(`Recommendations: ${bottleneck.recommendations.join(', ')}`);
    }
  });
});
```

## Custom Scenarios

### Framework Comparison

```typescript
// Compare different CSS frameworks
const frameworks = ['tailwind', 'bootstrap', 'bulma'];

const frameworkSuites = frameworks.map(framework => {
  const suite = createBenchmarkSuite({
    name: `${framework} Performance`,
    description: `Performance tests for ${framework}`,
  });

  suite.addBenchmark({
    name: 'Component Rendering',
    fn: () => renderComponent(framework),
  });

  suite.addBenchmark({
    name: 'Style Compilation',
    fn: () => compileStyles(framework),
  });

  return { name: framework, suite };
});

const comparativeRunner = new ComparativeBenchmarkRunner();
const comparison = await comparativeRunner.compare(frameworkSuites);

console.log('Framework Performance Comparison:');
console.log('Winner:', comparison.winner);
frameworks.forEach(framework => {
  const performance = comparison.results[framework];
  console.log(`${framework}: ${performance.averageTime.toFixed(2)}ms`);
});
```

### Load Testing Simulation

```typescript
// Simulate load testing with concurrent operations
suite.addBenchmark({
  name: 'Concurrent CSS Processing',
  fn: async () => {
    const concurrency = 10;
    const operations = Array(concurrency).fill(0).map((_, i) => 
      processCSS(`test-${i}.css`)
    );
    
    const startTime = Date.now();
    const results = await Promise.all(operations);
    const endTime = Date.now();
    
    return {
      totalTime: endTime - startTime,
      operationsPerSecond: concurrency / ((endTime - startTime) / 1000),
      results: results.length,
    };
  },
  
  metrics: {
    primary: 'totalTime',
    custom: ['operationsPerSecond'],
  },
});
```

### Memory Pressure Testing

```typescript
suite.addBenchmark({
  name: 'Memory Pressure Test',
  setup: () => {
    // Clear any existing memory pressure
    if (global.gc) global.gc();
  },
  
  fn: () => {
    const iterations = 1000;
    const objects = [];
    
    // Create memory pressure
    for (let i = 0; i < iterations; i++) {
      objects.push({
        id: i,
        data: new Array(1000).fill(`data-${i}`),
        metadata: {
          created: Date.now(),
          processed: false,
        },
      });
    }
    
    // Process objects
    const processed = objects.map(obj => ({
      ...obj,
      metadata: { ...obj.metadata, processed: true },
    }));
    
    return processed.length;
  },
  
  teardown: () => {
    // Force garbage collection after test
    if (global.gc) global.gc();
  },
});
```

### Custom Reporter

```typescript
class CustomReporter {
  generateReport(results: BenchmarkResult[]): string {
    let report = '# Custom Performance Report\n\n';
    
    // Summary table
    report += '## Summary\n\n';
    report += '| Benchmark | Status | Duration | Memory | Score |\n';
    report += '|-----------|---------|----------|--------|---------|\n';
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = result.success ? `${result.metrics.mean.toFixed(2)}ms` : 'N/A';
      const memory = result.success ? 
        `${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB` : 'N/A';
      const score = result.success ? 
        this.calculatePerformanceScore(result) : 'N/A';
      
      report += `| ${result.name} | ${status} | ${duration} | ${memory} | ${score} |\n`;
    });
    
    // Performance insights
    report += '\n## Performance Insights\n\n';
    const insights = this.generateInsights(results);
    insights.forEach(insight => {
      report += `- ${insight}\n`;
    });
    
    return report;
  }
  
  private calculatePerformanceScore(result: BenchmarkResult): string {
    // Custom scoring algorithm
    const durationScore = Math.max(0, 100 - result.metrics.mean);
    const memoryScore = Math.max(0, 100 - (result.metrics.memoryUsage.heapUsed / 1024 / 1024));
    const variance = result.metrics.standardDeviation / result.metrics.mean;
    const consistencyScore = Math.max(0, 100 - (variance * 100));
    
    const overallScore = (durationScore + memoryScore + consistencyScore) / 3;
    return overallScore.toFixed(0);
  }
  
  private generateInsights(results: BenchmarkResult[]): string[] {
    const insights: string[] = [];
    const successful = results.filter(r => r.success);
    
    if (successful.length === 0) return ['All benchmarks failed'];
    
    // Find fastest and slowest
    const fastest = successful.reduce((min, r) => 
      r.metrics.mean < min.metrics.mean ? r : min);
    const slowest = successful.reduce((max, r) => 
      r.metrics.mean > max.metrics.mean ? r : max);
    
    insights.push(`Fastest operation: ${fastest.name} (${fastest.metrics.mean.toFixed(2)}ms)`);
    insights.push(`Slowest operation: ${slowest.name} (${slowest.metrics.mean.toFixed(2)}ms)`);
    
    // Memory usage insights
    const highMemory = successful.filter(r => 
      r.metrics.memoryUsage.heapUsed > 50 * 1024 * 1024); // > 50MB
    
    if (highMemory.length > 0) {
      insights.push(`${highMemory.length} operations used > 50MB memory`);
    }
    
    // Consistency insights
    const inconsistent = successful.filter(r => 
      r.metrics.standardDeviation / r.metrics.mean > 0.2); // > 20% variance
    
    if (inconsistent.length > 0) {
      insights.push(`${inconsistent.length} operations showed high variance`);
    }
    
    return insights;
  }
}

// Use custom reporter
const reporter = new CustomReporter();
const results = await runner.runSuite(suite);
const customReport = reporter.generateReport(results);

await fs.writeFile('./custom-report.md', customReport);
console.log('Custom report generated: ./custom-report.md');
```

## Running the Examples

All examples are available in the `/examples` directory:

```bash
# Basic benchmarking
npx ts-node examples/benchmarking-basic.ts

# Advanced features
npx ts-node examples/benchmarking-advanced.ts

# CI integration
npx ts-node examples/benchmarking-ci.ts
```

### Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "benchmark": "ts-node examples/benchmarking-basic.ts",
    "benchmark:advanced": "ts-node examples/benchmarking-advanced.ts", 
    "benchmark:ci": "ts-node examples/benchmarking-ci.ts",
    "benchmark:profile": "ts-node examples/benchmarking-advanced.ts --profile",
    "benchmark:compare": "ts-node scripts/compare-implementations.ts"
  }
}
```

For more detailed examples and use cases, see the complete example files in the `/examples` directory.