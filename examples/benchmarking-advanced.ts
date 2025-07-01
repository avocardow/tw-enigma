/**
 * Advanced Benchmarking Example
 * 
 * This example demonstrates advanced features of the TW-Enigma benchmarking system
 * including profiling, bottleneck analysis, comparative benchmarking, and custom metrics.
 */

import {
  BenchmarkRunner,
  createBenchmarkSuite,
  ResultAnalyzer,
  ComparativeBenchmarkRunner,
} from '@tw-enigma/core/benchmarking';

import {
  createBenchmarkProfiler,
  createBottleneckAnalyzer,
  createProfilingExporter,
} from '@tw-enigma/core/benchmarking/profiling';

// Advanced CSS processing implementations for comparison
class CSSProcessorV1 {
  async parseCSS(css: string): Promise<any> {
    // Simulate slower, simpler parsing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    const rules = css.split('{').filter(rule => rule.trim()).length;
    return { rules, version: 'v1' };
  }

  async optimizeCSS(css: string): Promise<string> {
    // Basic optimization
    await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
    return css.replace(/\s+/g, ' ').trim();
  }
}

class CSSProcessorV2 {
  private cache = new Map<string, any>();

  async parseCSS(css: string): Promise<any> {
    // Simulate faster parsing with caching
    const cacheKey = this.hash(css);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
    const rules = css.split('{').filter(rule => rule.trim()).length;
    const result = { rules, version: 'v2', cached: false };
    
    this.cache.set(cacheKey, { ...result, cached: true });
    return result;
  }

  async optimizeCSS(css: string): Promise<string> {
    // Advanced optimization with multiple passes
    await new Promise(resolve => setTimeout(resolve, Math.random() * 40));
    return css
      .replace(/\s+/g, ' ')
      .replace(/; /g, ';')
      .replace(/ {/g, '{')
      .trim();
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}

// Generate test CSS of various complexities
function generateCSS(complexity: 'simple' | 'medium' | 'complex'): string {
  const baseRule = '.class-{id} { property: value; }';
  const complexRule = `
.complex-class-{id} {
  background: linear-gradient(45deg, #ff0000, #00ff00);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2);
  transform: translateX(10px) rotateY(45deg);
  animation: bounce 1s infinite ease-in-out;
}`;

  const ruleCount = {
    simple: 50,
    medium: 200,
    complex: 1000,
  }[complexity];

  const rule = complexity === 'complex' ? complexRule : baseRule;
  
  return Array(ruleCount)
    .fill(0)
    .map((_, i) => rule.replace('{id}', i.toString()))
    .join('\n');
}

async function main() {
  console.log('🚀 TW-Enigma Advanced Benchmarking Example\n');

  // Create profiler with comprehensive settings
  const profiler = createBenchmarkProfiler({
    enabled: true,
    captureSystemMetrics: true,
    captureMemorySnapshots: true,
    captureCPUProfile: true,
    captureGCEvents: true,
    enableBottleneckDetection: true,
    bottleneckThreshold: 5, // 5ms threshold
    exportFormats: ['json', 'flamegraph', 'html-report'],
    outputDirectory: './profiling-reports',
  });

  // Create advanced configuration
  const advancedConfig = {
    iterations: 100,
    warmupIterations: 20,
    timeout: 60000,
    
    parallel: {
      enabled: true,
      maxConcurrency: 2,
      isolateMemory: true,
    },
    
    statistics: {
      enableOutlierDetection: true,
      confidenceLevel: 0.95,
      minimumSampleSize: 30,
    },
    
    outputDirectory: './advanced-benchmark-results',
    
    reporting: {
      formats: ['json', 'html', 'csv'],
      includeSystemInfo: true,
      includeDetailedMetrics: true,
      includeProfilingData: true,
    },
  };

  // 1. COMPARATIVE BENCHMARKING
  console.log('🔍 1. Running Comparative Benchmarks...\n');

  const v1Processor = new CSSProcessorV1();
  const v2Processor = new CSSProcessorV2();
  const testCSS = generateCSS('medium');

  // Create suites for each implementation
  const v1Suite = createBenchmarkSuite({
    name: 'CSS Processor V1',
    description: 'Basic CSS processor implementation',
  });

  const v2Suite = createBenchmarkSuite({
    name: 'CSS Processor V2', 
    description: 'Optimized CSS processor with caching',
  });

  // Add comparative benchmarks
  ['simple', 'medium', 'complex'].forEach(complexity => {
    const css = generateCSS(complexity as any);
    
    v1Suite.addBenchmark({
      name: `Parse CSS - ${complexity}`,
      fn: () => v1Processor.parseCSS(css),
    });

    v2Suite.addBenchmark({
      name: `Parse CSS - ${complexity}`,
      fn: () => v2Processor.parseCSS(css),
    });

    v1Suite.addBenchmark({
      name: `Optimize CSS - ${complexity}`,
      fn: () => v1Processor.optimizeCSS(css),
    });

    v2Suite.addBenchmark({
      name: `Optimize CSS - ${complexity}`,
      fn: () => v2Processor.optimizeCSS(css),
    });
  });

  // Run comparative analysis
  const comparativeRunner = new ComparativeBenchmarkRunner();
  const comparison = await comparativeRunner.compare([
    { name: 'V1 Implementation', suite: v1Suite },
    { name: 'V2 Implementation', suite: v2Suite },
  ]);

  console.log('📊 Comparative Results:');
  console.log(`Winner: ${comparison.winner}`);
  console.log(`Performance Improvement: ${comparison.improvement.toFixed(2)}%`);
  console.log(`Confidence: ${(comparison.confidence * 100).toFixed(1)}%\n`);

  // 2. PROFILED BENCHMARKING
  console.log('🔬 2. Running Profiled Benchmarks...\n');

  const profiledSuite = createBenchmarkSuite({
    name: 'Profiled Performance Tests',
    description: 'Benchmarks with detailed profiling',
  });

  // Memory-intensive benchmark
  profiledSuite.addBenchmark({
    name: 'Memory Intensive Processing',
    fn: () => {
      // Simulate memory allocation
      const largeArray = new Array(100000).fill(0).map((_, i) => ({
        id: i,
        data: `item-${i}`,
        metadata: { processed: false, timestamp: Date.now() },
      }));
      
      // Process the array
      return largeArray.filter(item => item.id % 2 === 0).length;
    },
  });

  // CPU-intensive benchmark
  profiledSuite.addBenchmark({
    name: 'CPU Intensive Processing',
    fn: () => {
      // Simulate CPU-heavy work
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
      }
      return result;
    },
  });

  // I/O simulation benchmark
  profiledSuite.addBenchmark({
    name: 'Async I/O Simulation',
    fn: async () => {
      // Simulate multiple async operations
      const operations = Array(10).fill(0).map((_, i) => 
        new Promise(resolve => 
          setTimeout(() => resolve(`result-${i}`), Math.random() * 20)
        )
      );
      return Promise.all(operations);
    },
  });

  // Run with profiling
  const profiledRunner = new BenchmarkRunner(advancedConfig, profiler);
  const profiledResults = await profiledRunner.runSuite(profiledSuite);

  console.log('✅ Profiled benchmarks completed!');

  // 3. BOTTLENECK ANALYSIS
  console.log('\n🔍 3. Analyzing Performance Bottlenecks...\n');

  const profilingData = profiledRunner.getProfilingData();
  
  if (profilingData.length > 0) {
    const analyzer = createBottleneckAnalyzer({
      enablePatternDetection: true,
      enableCorrelationAnalysis: true,
      enableRootCauseAnalysis: true,
      includeRecommendations: true,
    });

    const analysis = await analyzer.analyzeBottlenecks(profilingData);

    console.log('🚨 Bottleneck Analysis Results:');
    console.log(`Total Bottlenecks: ${analysis.summary.totalBottlenecks}`);
    console.log(`Critical Issues: ${analysis.summary.criticalBottlenecks}`);
    console.log(`Time Wasted: ${analysis.summary.totalTimeWasted.toFixed(2)}ms`);
    console.log(`Estimated Improvement: ${analysis.summary.estimatedImprovement.toFixed(1)}%\n`);

    // Display critical bottlenecks
    if (analysis.bottlenecks.length > 0) {
      console.log('🔴 Critical Bottlenecks:');
      analysis.bottlenecks
        .filter(b => b.impact === 'critical')
        .slice(0, 3)
        .forEach(bottleneck => {
          console.log(`  - ${bottleneck.operation}: ${bottleneck.duration.toFixed(2)}ms`);
          console.log(`    Impact: ${bottleneck.impact} | Severity: ${bottleneck.severity.toFixed(2)}`);
          console.log(`    Recommendations: ${bottleneck.recommendations.slice(0, 2).join(', ')}\n`);
        });
    }

    // Display priority recommendations
    if (analysis.recommendations.length > 0) {
      console.log('💡 Priority Recommendations:');
      analysis.recommendations.slice(0, 3).forEach(rec => {
        console.log(`  ${rec.priority.toUpperCase()}: ${rec.title}`);
        console.log(`    ${rec.description}`);
        console.log(`    Estimated Impact: ${rec.estimatedImpact.toFixed(1)}%\n`);
      });
    }

    // 4. EXPORT PROFILING DATA
    console.log('💾 4. Exporting Profiling Data...\n');

    const exporter = createProfilingExporter({
      formats: ['json', 'html-report', 'chrome-trace', 'flamegraph'],
      outputDirectory: './profiling-exports',
      compression: true,
    });

    const exportResults = await exporter.exportProfilingData(profilingData, analysis);
    
    console.log('📁 Exported Files:');
    exportResults.forEach(result => {
      console.log(`  ${result.format}: ${result.filePath} (${(result.fileSize / 1024).toFixed(1)}KB)`);
    });
  }

  // 5. STATISTICAL ANALYSIS
  console.log('\n📈 5. Statistical Analysis...\n');

  const analyzer = new ResultAnalyzer({
    enableTrendAnalysis: true,
    confidenceLevel: 0.95,
  });

  const allResults = [...comparison.results.flat(), ...profiledResults];
  const statisticalAnalysis = analyzer.analyze(allResults);

  console.log('📊 Statistical Summary:');
  console.log(`Total Benchmarks: ${statisticalAnalysis.summary.totalBenchmarks}`);
  console.log(`Success Rate: ${(statisticalAnalysis.summary.successRate * 100).toFixed(1)}%`);
  console.log(`Average Duration: ${statisticalAnalysis.summary.averageDuration.toFixed(2)}ms`);
  console.log(`Performance Variance: ${statisticalAnalysis.summary.variance.toFixed(2)}`);

  if (statisticalAnalysis.outliers.length > 0) {
    console.log('\n⚠️  Outliers Detected:');
    statisticalAnalysis.outliers.slice(0, 3).forEach(outlier => {
      console.log(`  - ${outlier.name}: ${outlier.value.toFixed(2)}ms (${outlier.deviations.toFixed(1)}σ)`);
    });
  }

  // 6. CUSTOM METRICS EXAMPLE
  console.log('\n🎯 6. Custom Metrics Example...\n');

  const customSuite = createBenchmarkSuite({
    name: 'Custom Metrics Demo',
    description: 'Demonstrates custom performance metrics',
  });

  let cacheHits = 0;
  let cacheMisses = 0;

  customSuite.addBenchmark({
    name: 'Custom Metrics Benchmark',
    fn: () => {
      // Simulate cache behavior
      const isHit = Math.random() > 0.3;
      if (isHit) {
        cacheHits++;
        return { result: 'cached-value', fromCache: true };
      } else {
        cacheMisses++;
        // Simulate expensive computation
        const result = Array(1000).fill(0).reduce((sum, _, i) => sum + i, 0);
        return { result, fromCache: false };
      }
    },
    metrics: {
      primary: 'duration',
      custom: ['cacheHitRate', 'throughput'],
    },
    afterEach: () => {
      // Calculate custom metrics after each iteration
      return {
        cacheHitRate: cacheHits / (cacheHits + cacheMisses),
        throughput: (cacheHits + cacheMisses) / 1, // operations per iteration
      };
    },
  });

  const customRunner = new BenchmarkRunner({
    ...advancedConfig,
    iterations: 50, // Fewer iterations for demo
  });

  const customResults = await customRunner.runSuite(customSuite);
  
  console.log('🎯 Custom Metrics Results:');
  customResults.forEach(result => {
    if (result.success && result.metrics.custom) {
      console.log(`${result.name}:`);
      console.log(`  Duration: ${result.metrics.mean.toFixed(2)}ms`);
      Object.entries(result.metrics.custom).forEach(([metric, value]) => {
        console.log(`  ${metric}: ${typeof value === 'number' ? value.toFixed(3) : value}`);
      });
    }
  });

  console.log('\n✨ Advanced benchmarking demonstration completed!');
  console.log('\n📁 Generated Reports:');
  console.log('  - Benchmark results: ./advanced-benchmark-results/');
  console.log('  - Profiling data: ./profiling-reports/');
  console.log('  - Export data: ./profiling-exports/');
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main as runAdvancedBenchmark };