/**
 * Basic Benchmarking Example
 * 
 * This example demonstrates the fundamental usage of the TW-Enigma
 * benchmarking system with simple CSS processing operations.
 */

import { BenchmarkRunner, createBenchmarkSuite } from '@tw-enigma/core/benchmarking';
import { promises as fs } from 'fs';

// Sample CSS content for testing
const smallCSS = `
.button { background: blue; padding: 10px; }
.card { margin: 20px; border: 1px solid gray; }
`;

const mediumCSS = Array(100).fill(smallCSS).join('\n');
const largeCSS = Array(1000).fill(smallCSS).join('\n');

// Mock CSS processing functions
async function parseCSS(css: string): Promise<any> {
  // Simulate CSS parsing
  await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
  return {
    rules: css.split('{').length - 1,
    size: css.length,
  };
}

async function optimizeCSS(css: string): Promise<string> {
  // Simulate CSS optimization
  await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
  return css.replace(/\s+/g, ' ').trim();
}

async function compressCSS(css: string): Promise<string> {
  // Simulate CSS compression
  await new Promise(resolve => setTimeout(resolve, Math.random() * 15));
  return css.replace(/\s+/g, '').replace(/;}/g, '}');
}

async function main() {
  console.log('🚀 TW-Enigma Basic Benchmarking Example\n');

  // Create a benchmark suite
  const suite = createBenchmarkSuite({
    name: 'CSS Processing Benchmarks',
    description: 'Basic CSS processing performance tests',
    tags: ['css', 'performance', 'basic'],
  });

  // Add simple benchmark cases
  suite.addBenchmark({
    name: 'CSS Parsing - Small',
    description: 'Parse small CSS file',
    fn: () => parseCSS(smallCSS),
    tags: ['parsing', 'small'],
  });

  suite.addBenchmark({
    name: 'CSS Parsing - Medium', 
    description: 'Parse medium CSS file',
    fn: () => parseCSS(mediumCSS),
    tags: ['parsing', 'medium'],
  });

  suite.addBenchmark({
    name: 'CSS Parsing - Large',
    description: 'Parse large CSS file', 
    fn: () => parseCSS(largeCSS),
    tags: ['parsing', 'large'],
  });

  suite.addBenchmark({
    name: 'CSS Optimization',
    description: 'Optimize CSS content',
    fn: () => optimizeCSS(mediumCSS),
    tags: ['optimization'],
  });

  suite.addBenchmark({
    name: 'CSS Compression',
    description: 'Compress CSS content',
    fn: () => compressCSS(mediumCSS),
    tags: ['compression'],
  });

  // Benchmark with setup and teardown
  suite.addBenchmark({
    name: 'File Processing',
    description: 'Process CSS file from disk',
    setup: async () => {
      await fs.writeFile('temp-test.css', largeCSS);
    },
    fn: async () => {
      const content = await fs.readFile('temp-test.css', 'utf-8');
      return optimizeCSS(content);
    },
    teardown: async () => {
      try {
        await fs.unlink('temp-test.css');
      } catch {
        // Ignore cleanup errors
      }
    },
    tags: ['file-io'],
  });

  // Parameterized benchmark
  suite.addBenchmark({
    name: 'Variable Size Processing',
    description: 'Process CSS of different sizes',
    fn: (size: number) => {
      const css = Array(size).fill(smallCSS).join('\n');
      return parseCSS(css);
    },
    parameters: [10, 50, 100, 500],
    tags: ['parameterized'],
  });

  // Create runner with basic configuration
  const runner = new BenchmarkRunner({
    iterations: 50,
    warmupIterations: 10,
    timeout: 30000,
    outputDirectory: './benchmark-results',
    reporting: {
      formats: ['json', 'html'],
      includeSystemInfo: true,
      includeDetailedMetrics: true,
    },
  });

  console.log('📊 Running benchmarks...');
  console.log(`Suite: ${suite.name}`);
  console.log(`Benchmarks: ${suite.getBenchmarks().length}`);
  console.log('');

  try {
    // Run the benchmark suite
    const results = await runner.runSuite(suite);

    console.log('✅ Benchmarks completed!\n');

    // Display basic results
    console.log('📈 Results Summary:');
    console.log('==================');

    results.forEach(result => {
      const { name, metrics, success } = result;
      
      if (success) {
        console.log(`
${name}:
  Mean: ${metrics.mean.toFixed(2)}ms
  Min:  ${metrics.min.toFixed(2)}ms  
  Max:  ${metrics.max.toFixed(2)}ms
  Std:  ${metrics.standardDeviation.toFixed(2)}ms
  Memory: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      } else {
        console.log(`${name}: FAILED - ${result.error?.message}`);
      }
    });

    // Find fastest and slowest benchmarks
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
      const fastest = successfulResults.reduce((min, r) => 
        r.metrics.mean < min.metrics.mean ? r : min
      );
      const slowest = successfulResults.reduce((max, r) => 
        r.metrics.mean > max.metrics.mean ? r : max
      );

      console.log('\n🏆 Performance Highlights:');
      console.log(`Fastest: ${fastest.name} (${fastest.metrics.mean.toFixed(2)}ms)`);
      console.log(`Slowest: ${slowest.name} (${slowest.metrics.mean.toFixed(2)}ms)`);
      
      if (slowest.metrics.mean > 0) {
        const speedup = slowest.metrics.mean / fastest.metrics.mean;
        console.log(`Speed difference: ${speedup.toFixed(2)}x`);
      }
    }

    // Display memory usage summary
    const memoryUsages = successfulResults.map(r => r.metrics.memoryUsage.heapUsed);
    if (memoryUsages.length > 0) {
      const maxMemory = Math.max(...memoryUsages) / 1024 / 1024;
      const avgMemory = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length / 1024 / 1024;
      
      console.log('\n💾 Memory Usage:');
      console.log(`Peak: ${maxMemory.toFixed(2)}MB`);
      console.log(`Average: ${avgMemory.toFixed(2)}MB`);
    }

    console.log('\n📄 Detailed reports saved to: ./benchmark-results/');

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main as runBasicBenchmark };