#!/usr/bin/env node
/**
 * Performance Benchmark Script
 * CLI wrapper for running template literal performance benchmarks
 */

const { PerformanceBenchmarkRunner } = require('../lib/processors/performanceBenchmarkRunner');

async function main() {
  const args = process.argv.slice(2);
  
  // Default configuration
  const config = {
    outputDir: './benchmark-results',
    baselineFile: 'performance-baseline.json',
    reportFile: 'performance-report.md',
    enableRegression: true,
    ciMode: process.env.CI === 'true',
    failOnRegression: true,
    failOnThresholds: true,
  };

  // Parse command line arguments
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
        
      case '--output-dir':
        config.outputDir = args[++i];
        break;
        
      case '--baseline-file':
        config.baselineFile = args[++i];
        break;
        
      case '--report-file':
        config.reportFile = args[++i];
        break;
        
      case '--no-regression':
        config.enableRegression = false;
        break;
        
      case '--no-fail-regression':
        config.failOnRegression = false;
        break;
        
      case '--no-fail-thresholds':
        config.failOnThresholds = false;
        break;
        
      case '--ci':
        config.ciMode = true;
        break;
        
      case '--local':
        config.ciMode = false;
        break;
        
      case '--cleanup':
        await runCleanup(config);
        process.exit(0);
        break;
        
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
    
    i++;
  }

  // Run benchmark
  await runBenchmark(config);
}

async function runBenchmark(config) {
  console.log('🚀 Starting TW-Enigma Template Literal Performance Benchmark');
  console.log('Configuration:', JSON.stringify(config, null, 2));
  
  try {
    const runner = new PerformanceBenchmarkRunner(config);
    const result = await runner.runBenchmark();
    
    console.log('\n📊 Benchmark Results Summary:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📈 Regression: ${result.regressionDetected ? 'DETECTED' : 'None'}`);
    console.log(`🎯 Thresholds: ${result.thresholdsPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`🕒 Timestamp: ${result.timestamp}`);
    
    // Print key metrics
    if (result.testResult?.metrics) {
      console.log('\n⚡ Key Performance Metrics:');
      const keyMetrics = result.testResult.metrics.filter(m => 
        ['detection-moderate', 'parsing-moderate', 'generation-moderate', 'e2e-moderate'].includes(m.testName)
      );
      
      for (const metric of keyMetrics) {
        console.log(`  ${metric.testName}: ${metric.averageTime.toFixed(2)}ms avg, ${metric.throughput.toFixed(0)} ops/sec`);
      }
    }
    
    // Print bottlenecks if any
    if (result.testResult?.bottlenecks?.length > 0) {
      console.log('\n⚠️ Performance Bottlenecks:');
      for (const bottleneck of result.testResult.bottlenecks.slice(0, 3)) {
        console.log(`  ${bottleneck.component} (${bottleneck.impact}): ${bottleneck.recommendation}`);
      }
    }
    
    // Print optimization recommendations
    if (result.testResult?.optimizationRecommendations?.length > 0) {
      console.log('\n💡 Optimization Recommendations:');
      for (const rec of result.testResult.optimizationRecommendations.slice(0, 3)) {
        console.log(`  • ${rec}`);
      }
    }
    
    // Exit with appropriate code
    if (result.success) {
      console.log('\n🎉 Benchmark PASSED');
      process.exit(0);
    } else {
      console.log('\n💥 Benchmark FAILED');
      
      if (result.regressionDetected && config.failOnRegression) {
        console.log('  Reason: Performance regression detected');
      }
      
      if (!result.thresholdsPassed && config.failOnThresholds) {
        console.log('  Reason: Performance thresholds not met');
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Benchmark failed with error:');
    console.error(error.message);
    
    if (process.env.DEBUG) {
      console.error('\nFull error details:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

async function runCleanup(config) {
  console.log('🗑️ Cleaning up old benchmark results...');
  
  try {
    const runner = new PerformanceBenchmarkRunner(config);
    await runner.cleanup();
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
TW-Enigma Template Literal Performance Benchmark

USAGE:
  node run-performance-benchmark.js [OPTIONS]

OPTIONS:
  --help, -h              Show this help message
  --output-dir DIR        Output directory for results (default: ./benchmark-results)
  --baseline-file FILE    Baseline file name (default: performance-baseline.json)
  --report-file FILE      Report file name (default: performance-report.md)
  --no-regression         Disable regression testing
  --no-fail-regression    Don't fail on performance regression
  --no-fail-thresholds    Don't fail on threshold violations
  --ci                    Force CI mode (reduced test complexity)
  --local                 Force local mode (full test suite)
  --cleanup               Clean up old benchmark results and exit

EXAMPLES:
  # Run full benchmark suite
  node run-performance-benchmark.js
  
  # Run in CI mode with custom output
  node run-performance-benchmark.js --ci --output-dir ./ci-benchmarks
  
  # Run without failing on regressions
  node run-performance-benchmark.js --no-fail-regression
  
  # Clean up old results
  node run-performance-benchmark.js --cleanup

ENVIRONMENT VARIABLES:
  CI=true                 Automatically enables CI mode
  DEBUG=true              Enable debug output on errors

EXIT CODES:
  0                       Benchmark passed
  1                       Benchmark failed or error occurred
`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { main, runBenchmark, runCleanup };