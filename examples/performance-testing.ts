/**
 * Performance Testing Example
 * 
 * This example demonstrates how to use TW-Enigma's performance testing and benchmarking
 * capabilities to measure and optimize dry run performance across different scenarios.
 */

import {
  getPerformanceTestRunner,
  getPerformanceSimulator,
  getPerformanceAnalyzer,
  createPerformanceTestRunner,
  runQuickPerformanceTest,
  PerformanceTestScenario,
  BenchmarkResult,
  TestSuite,
  RegressionTestConfig,
  ContinuousIntegrationConfig
} from '@tw-enigma/core';

async function performanceTestingExample() {
  console.log('⚡ Starting Performance Testing Example');
  console.log('======================================\n');

  try {
    // Run different types of performance tests
    await quickPerformanceTest();
    await benchmarkingSuite();
    await regressionTesting();
    await customScenarios();
    await performanceAnalysis();
    await ciIntegration();

    console.log('\n🏆 All performance tests completed successfully!');

  } catch (error) {
    console.error('❌ Performance testing failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Quick performance test for immediate feedback
 */
async function quickPerformanceTest(): Promise<void> {
  console.log('🚀 Quick Performance Test');
  console.log('=========================\n');

  console.log('Running quick performance assessment...');
  
  const result = await runQuickPerformanceTest();
  
  console.log('📊 Results:');
  console.log(`- Performance Grade: ${result.grade}`);
  console.log(`- Score: ${result.score}/100`);
  console.log(`- Execution Time: ${result.executionTime}ms`);
  console.log(`- Memory Usage: ${formatBytes(result.memoryUsage)}`);
  console.log(`- Throughput: ${result.throughput} ops/sec\n`);

  if (result.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    result.recommendations.forEach(rec => {
      console.log(`  • ${rec.description} (${rec.priority} priority)`);
    });
    console.log('');
  }
}

/**
 * Comprehensive benchmarking suite
 */
async function benchmarkingSuite(): Promise<void> {
  console.log('📈 Benchmarking Suite');
  console.log('====================\n');

  const simulator = getPerformanceSimulator();

  // Define test scenarios
  const scenarios: PerformanceTestScenario[] = [
    {
      name: 'Small Project',
      fileCount: 50,
      operationsPerFile: 2,
      averageFileSize: 10 * 1024, // 10KB
      complexityMultiplier: 1,
      includeDependencies: true,
      includeVisualDiff: true,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: true,
    },
    {
      name: 'Medium Project',
      fileCount: 200,
      operationsPerFile: 3,
      averageFileSize: 25 * 1024, // 25KB
      complexityMultiplier: 1.5,
      includeDependencies: true,
      includeVisualDiff: true,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: true,
    },
    {
      name: 'Large Project',
      fileCount: 1000,
      operationsPerFile: 4,
      averageFileSize: 50 * 1024, // 50KB
      complexityMultiplier: 2,
      includeDependencies: true,
      includeVisualDiff: false, // Skip for performance
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: false,
    },
    {
      name: 'Enterprise Project',
      fileCount: 5000,
      operationsPerFile: 5,
      averageFileSize: 75 * 1024, // 75KB
      complexityMultiplier: 3,
      includeDependencies: false, // Skip for performance
      includeVisualDiff: false,
      includeImpactEstimation: false,
      includeReportGeneration: true,
      includeOutputManagement: false,
    },
  ];

  console.log(`🧪 Running benchmarks for ${scenarios.length} scenarios...\n`);

  const benchmark = await simulator.runBenchmark(scenarios, {
    iterations: 3,
    warmupRuns: 1,
    compareWithPrevious: false,
    saveResults: true,
    outputPath: './performance-benchmark-results.json',
  });

  displayBenchmarkResults(benchmark);
}

/**
 * Regression testing against baseline
 */
async function regressionTesting(): Promise<void> {
  console.log('🔍 Regression Testing');
  console.log('=====================\n');

  const runner = getPerformanceTestRunner();
  
  // Create standard test suites
  const suites = runner.createStandardTestSuites();
  const regressionSuite = suites.find(suite => suite.name === 'regression');

  if (!regressionSuite) {
    console.log('⚠️  No regression test suite available');
    return;
  }

  console.log(`🧪 Running regression test suite: ${regressionSuite.name}`);
  console.log(`Tests: ${regressionSuite.tests.length}\n`);

  const regressionConfig: RegressionTestConfig = {
    baselinePath: './performance-baseline.json',
    maxRegression: 15, // 15% maximum regression
    metricsToCheck: ['executionTime', 'memoryUsage', 'throughput'],
    updateBaselineOnImprovement: true,
    failOnRegression: true,
  };

  try {
    const result = await runner.runTestSuite(regressionSuite, {
      regressionTest: regressionConfig,
      ciConfig: {
        enabled: false,
        outputFormat: 'console',
        resultsPath: './regression-results.json',
        uploadResults: false,
      },
    });

    console.log('📊 Regression Test Results:');
    console.log(`Status: ${result.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests run: ${result.testsRun}`);
    console.log(`Tests passed: ${result.testsPassed}`);
    console.log(`Tests failed: ${result.testsFailed}`);
    
    if (result.regressionResults) {
      console.log(`\n📈 Regression Analysis:`);
      console.log(`Max regression: ${result.regressionResults.maxRegression}%`);
      console.log(`Baseline updated: ${result.regressionResults.baselineUpdated ? 'Yes' : 'No'}`);
    }

    if (result.failures.length > 0) {
      console.log('\n❌ Failures:');
      result.failures.forEach(failure => {
        console.log(`  • ${failure.test}: ${failure.reason}`);
      });
    }
    
    console.log('');

  } catch (error) {
    console.error('❌ Regression testing failed:', error);
  }
}

/**
 * Custom performance scenarios
 */
async function customScenarios(): Promise<void> {
  console.log('🎯 Custom Performance Scenarios');
  console.log('===============================\n');

  const simulator = getPerformanceSimulator();

  // Define custom scenarios for specific use cases
  const customScenarios: PerformanceTestScenario[] = [
    {
      name: 'CSS-in-JS Heavy',
      fileCount: 300,
      operationsPerFile: 6,
      averageFileSize: 40 * 1024,
      complexityMultiplier: 2.5,
      includeDependencies: true,
      includeVisualDiff: true,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: true,
    },
    {
      name: 'Monorepo Simulation',
      fileCount: 2000,
      operationsPerFile: 3,
      averageFileSize: 30 * 1024,
      complexityMultiplier: 1.8,
      includeDependencies: true,
      includeVisualDiff: false,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: false,
    },
    {
      name: 'Mobile-First Project',
      fileCount: 150,
      operationsPerFile: 4,
      averageFileSize: 15 * 1024,
      complexityMultiplier: 1.2,
      includeDependencies: true,
      includeVisualDiff: true,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: true,
    },
  ];

  console.log('🔬 Running custom scenarios...\n');

  for (const scenario of customScenarios) {
    console.log(`Testing: ${scenario.name}`);
    
    const result = await simulator.runBenchmark([scenario], {
      iterations: 2,
      warmupRuns: 1,
      compareWithPrevious: false,
      saveResults: false,
    });

    const scenarioResult = result.scenarios[0];
    console.log(`  ⏱️  Execution Time: ${Math.round(scenarioResult.averageExecutionTime)}ms`);
    console.log(`  💾 Memory Usage: ${formatBytes(scenarioResult.averageMemoryUsage)}`);
    console.log(`  📊 Throughput: ${Math.round(scenarioResult.averageThroughput)} ops/sec`);
    
    if (scenarioResult.bottlenecks.length > 0) {
      console.log(`  ⚠️  Bottlenecks: ${scenarioResult.bottlenecks.length} identified`);
    }
    console.log('');
  }
}

/**
 * Performance analysis and optimization recommendations
 */
async function performanceAnalysis(): Promise<void> {
  console.log('🔍 Performance Analysis');
  console.log('=======================\n');

  // First, run a benchmark to get data
  const simulator = getPerformanceSimulator();
  const analysisScenario: PerformanceTestScenario = {
    name: 'Analysis Target',
    fileCount: 500,
    operationsPerFile: 3,
    averageFileSize: 35 * 1024,
    complexityMultiplier: 2,
    includeDependencies: true,
    includeVisualDiff: true,
    includeImpactEstimation: true,
    includeReportGeneration: true,
    includeOutputManagement: true,
  };

  console.log('🧪 Generating performance data for analysis...');
  const benchmark = await simulator.runBenchmark([analysisScenario], {
    iterations: 3,
    warmupRuns: 1,
    profileMode: true,
    includeDetailedTiming: true,
  });

  // Analyze the results
  const analyzer = getPerformanceAnalyzer();
  const insights = await analyzer.analyzeBenchmarkResults(benchmark);

  console.log('\n📊 Performance Analysis Results:');
  console.log(`Overall Grade: ${insights.grade}`);
  console.log(`Performance Score: ${insights.score}/100`);
  console.log(`Efficiency Rating: ${insights.efficiencyRating}`);

  if (insights.bottlenecks.length > 0) {
    console.log('\n🚨 Performance Bottlenecks:');
    insights.bottlenecks.forEach(bottleneck => {
      const severity = bottleneck.severity === 'critical' ? '🔴' : 
                      bottleneck.severity === 'high' ? '🟠' : 
                      bottleneck.severity === 'medium' ? '🟡' : '🟢';
      console.log(`  ${severity} ${bottleneck.component}: ${bottleneck.description}`);
      console.log(`     Impact: ${bottleneck.impact}% | Confidence: ${Math.round(bottleneck.confidence * 100)}%`);
    });
  }

  if (insights.recommendations.length > 0) {
    console.log('\n💡 Optimization Recommendations:');
    insights.recommendations.forEach(rec => {
      const priority = rec.priority === 'high' ? '🔥' : 
                      rec.priority === 'medium' ? '⚡' : '💡';
      console.log(`  ${priority} ${rec.description}`);
      console.log(`     Expected improvement: ${rec.expectedImprovement}%`);
      console.log(`     Effort required: ${rec.effortRequired}`);
    });
  }

  console.log('');
}

/**
 * CI/CD integration example
 */
async function ciIntegration(): Promise<void> {
  console.log('🚀 CI/CD Integration');
  console.log('===================\n');

  const runner = getPerformanceTestRunner();
  const suites = runner.createStandardTestSuites();
  
  // Simulate CI environment
  const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test';
  
  console.log(`Environment: ${isCI ? 'CI/CD Pipeline' : 'Local Development'}`);

  const ciConfig: ContinuousIntegrationConfig = {
    enabled: true,
    outputFormat: 'junit',
    resultsPath: './ci-performance-results.xml',
    uploadResults: false,
    failFast: true,
    parallelExecution: true,
    resourceLimits: {
      maxMemory: 1024 * 1024 * 1024, // 1GB
      maxExecutionTime: 300000, // 5 minutes
    },
  };

  const regressionConfig: RegressionTestConfig = {
    baselinePath: './ci-baseline.json',
    maxRegression: 10, // Stricter for CI
    metricsToCheck: ['executionTime', 'memoryUsage'],
    updateBaselineOnImprovement: false, // Don't auto-update in CI
    failOnRegression: true,
  };

  console.log('🧪 Running CI performance suite...');

  try {
    const smokeTestSuite = suites.find(suite => suite.name === 'smoke') || suites[0];
    
    const result = await runner.runTestSuite(smokeTestSuite, {
      regressionTest: regressionConfig,
      ciConfig: ciConfig,
    });

    console.log('\n📊 CI Test Results:');
    console.log(`Status: ${result.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Duration: ${Math.round(result.duration)}ms`);
    console.log(`Tests: ${result.testsPassed}/${result.testsRun} passed`);

    if (result.status === 'failed') {
      console.log('\n❌ CI would fail with exit code 1');
      console.log('Failures:');
      result.failures.forEach(failure => {
        console.log(`  • ${failure.test}: ${failure.reason}`);
      });
    } else {
      console.log('\n✅ CI would pass with exit code 0');
    }

    console.log(`\n📁 Results saved to: ${ciConfig.resultsPath}`);

  } catch (error) {
    console.error('❌ CI integration test failed:', error);
  }

  console.log('');
}

/**
 * Display benchmark results in a formatted way
 */
function displayBenchmarkResults(benchmark: BenchmarkResult): void {
  console.log('📊 Benchmark Results:');
  console.log(`Completed: ${new Date(benchmark.completedAt).toLocaleString()}`);
  console.log(`Total Duration: ${Math.round(benchmark.totalDuration)}ms\n`);

  benchmark.scenarios.forEach(scenario => {
    console.log(`📈 ${scenario.name}:`);
    console.log(`  Files: ${scenario.scenario.fileCount}`);
    console.log(`  Avg Execution Time: ${Math.round(scenario.averageExecutionTime)}ms`);
    console.log(`  Avg Memory Usage: ${formatBytes(scenario.averageMemoryUsage)}`);
    console.log(`  Avg Throughput: ${Math.round(scenario.averageThroughput)} ops/sec`);
    console.log(`  Success Rate: ${Math.round(scenario.successRate * 100)}%`);
    
    if (scenario.bottlenecks.length > 0) {
      console.log(`  ⚠️  Bottlenecks: ${scenario.bottlenecks.length}`);
    }
    
    console.log('');
  });

  if (benchmark.comparison) {
    console.log('📊 Performance Comparison:');
    console.log(`  Overall improvement: ${benchmark.comparison.overallImprovement > 0 ? '📈' : '📉'} ${Math.abs(benchmark.comparison.overallImprovement)}%`);
    console.log('');
  }
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Run the example
if (require.main === module) {
  performanceTestingExample().catch(console.error);
}

export { 
  performanceTestingExample,
  quickPerformanceTest,
  benchmarkingSuite,
  regressionTesting,
  customScenarios,
  performanceAnalysis,
  ciIntegration
};