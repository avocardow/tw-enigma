# Performance Testing Guide

## Overview

TW-Enigma includes a comprehensive performance testing framework designed to benchmark, analyze, and optimize the dry run system performance. This guide covers all aspects of performance testing, from basic benchmarks to advanced CI/CD integration.

## Quick Start

### Running Performance Tests

```bash
# Quick performance check
npm run test:performance:quick

# Full performance suite
npm run test:performance

# Stress testing
npm run test:performance:stress

# Regression testing
npm run test:performance:regression
```

### Programmatic Usage

```typescript
import { runQuickPerformanceTest, analyzePerformance } from '@tw-enigma/core';

// Quick test
const result = await runQuickPerformanceTest();
console.log(`Grade: ${result.grade}, Score: ${result.score}`);

// Full analysis
const insights = await analyzePerformance(result);
for (const bottleneck of insights.bottlenecks) {
  console.log(`${bottleneck.component}: ${bottleneck.description}`);
}
```

## Test Scenarios

### Default Scenarios

The framework includes five predefined test scenarios:

#### 1. Small Project
- **Files**: 50
- **Operations per file**: 2
- **Average file size**: 10KB
- **Complexity**: Low (1x)
- **Features**: All enabled
- **Use case**: Typical small web project

#### 2. Medium Project
- **Files**: 200
- **Operations per file**: 3
- **Average file size**: 25KB
- **Complexity**: Medium (2x)
- **Features**: All enabled
- **Use case**: Standard application

#### 3. Large Project
- **Files**: 500
- **Operations per file**: 4
- **Average file size**: 50KB
- **Complexity**: High (3x)
- **Features**: All enabled
- **Use case**: Enterprise application

#### 4. Enterprise Scale
- **Files**: 1000
- **Operations per file**: 5
- **Average file size**: 100KB
- **Complexity**: Very High (5x)
- **Features**: Core only (no visual diff)
- **Use case**: Large-scale enterprise system

#### 5. Minimal Features
- **Files**: 100
- **Operations per file**: 2
- **Average file size**: 20KB
- **Complexity**: Low (1x)
- **Features**: Core only
- **Use case**: Performance baseline

### Custom Scenarios

```typescript
import { getPerformanceSimulator } from '@tw-enigma/core';

const customScenarios = [
  {
    name: 'React Monorepo',
    description: 'Large React monorepo with TypeScript',
    fileCount: 800,
    operationsPerFile: 4,
    averageFileSize: 35 * 1024,
    complexityMultiplier: 3,
    includeDependencies: true,
    includeVisualDiff: false, // Too expensive for large scale
    includeImpactEstimation: true,
    includeReportGeneration: true,
    includeOutputManagement: true
  },
  {
    name: 'Vue.js SPA',
    description: 'Single page Vue.js application',
    fileCount: 150,
    operationsPerFile: 3,
    averageFileSize: 20 * 1024,
    complexityMultiplier: 2,
    includeDependencies: true,
    includeVisualDiff: true,
    includeImpactEstimation: true,
    includeReportGeneration: true,
    includeOutputManagement: true
  }
];

const simulator = getPerformanceSimulator();
const result = await simulator.runBenchmark(customScenarios);
```

## Performance Metrics

### Execution Metrics

- **Total Execution Time**: Overall time for dry run completion
- **Component Timing**: Breakdown by feature (dry run, reports, diff, impact, output)
- **Operations per Second**: Throughput measurement
- **Files per Second**: File processing rate
- **Bytes per Second**: Data processing throughput

### Resource Metrics

- **Memory Usage**: Initial, peak, final, and delta measurements
- **CPU Utilization**: User time, system time, and overall utilization
- **Disk I/O**: Simulated file operations and space usage
- **Network**: API calls and data transfer (when applicable)

### Quality Metrics

- **Success Rate**: Percentage of operations that would succeed
- **Error Count**: Failed operations and timeout occurrences
- **Confidence**: Reliability of the measurements
- **Scalability Factor**: How performance scales with input size

## Performance Analysis

### Bottleneck Detection

The analyzer identifies performance bottlenecks across multiple dimensions:

#### CPU Bottlenecks
```typescript
// High CPU utilization detected
{
  component: "Large Project",
  type: "cpu",
  severity: "high",
  impact: 75,
  description: "CPU utilization 87% exceeds acceptable threshold",
  currentValue: 87,
  recommendedThreshold: 70,
  optimizations: [
    "Optimize algorithms for better time complexity",
    "Implement worker thread pools",
    "Add CPU-intensive operation caching",
    "Consider async/await optimizations"
  ]
}
```

#### Memory Bottlenecks
```typescript
// High memory usage detected
{
  component: "Enterprise Scale",
  type: "memory",
  severity: "critical",
  impact: 90,
  description: "Memory usage 750MB exceeds acceptable threshold",
  currentValue: 786432000,
  recommendedThreshold: 524288000,
  optimizations: [
    "Implement memory pooling",
    "Add garbage collection hints",
    "Stream large data instead of loading in memory",
    "Optimize data structures"
  ]
}
```

#### Latency Bottlenecks
```typescript
// Slow execution detected
{
  component: "Medium Project - Visual Diff",
  type: "latency",
  severity: "medium",
  impact: 45,
  description: "Visual diff generation takes 12000ms",
  currentValue: 12000,
  recommendedThreshold: 5000,
  optimizations: [
    "Implement diff result caching",
    "Use more efficient diff algorithms",
    "Process diffs in parallel",
    "Limit diff context size"
  ]
}
```

#### Throughput Bottlenecks
```typescript
// Low throughput detected
{
  component: "Large Project",
  type: "throughput",
  severity: "high",
  impact: 65,
  description: "Throughput 85 ops/sec below acceptable threshold",
  currentValue: 85,
  recommendedThreshold: 100,
  optimizations: [
    "Implement parallel processing",
    "Optimize critical code paths",
    "Add operation caching",
    "Reduce I/O operations"
  ]
}
```

### Performance Grading

The system assigns letter grades (A-F) based on overall performance:

- **A (90-100)**: Excellent performance, minimal optimizations needed
- **B (80-89)**: Good performance, minor optimizations recommended
- **C (70-79)**: Acceptable performance, some optimizations needed
- **D (60-69)**: Poor performance, significant optimizations required
- **F (0-59)**: Critical performance issues, immediate attention needed

### Optimization Recommendations

```typescript
interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'algorithmic' | 'memory' | 'io' | 'caching' | 'parallelization';
  description: string;
  expectedImprovement: number; // Percentage
  implementationComplexity: 'low' | 'medium' | 'high';
}

// Example recommendations
const recommendations = [
  {
    priority: 'high',
    category: 'memory',
    description: 'Implement memory optimization strategies to reduce peak usage',
    expectedImprovement: 30,
    implementationComplexity: 'medium'
  },
  {
    priority: 'high',
    category: 'parallelization',
    description: 'Implement parallel processing for time-intensive operations',
    expectedImprovement: 40,
    implementationComplexity: 'high'
  }
];
```

## Test Suites

### Predefined Test Suites

#### 1. Smoke Test
```typescript
{
  name: 'Smoke Test',
  description: 'Quick smoke test with minimal scenarios',
  scenarios: [
    'Small Project (10 files)',
    'Medium Project (50 files)'
  ],
  config: {
    iterations: 1,
    warmupRuns: 0,
    timeout: 30000,
    parallel: false
  },
  criteria: {
    maxExecutionTime: 10000,
    maxMemoryUsage: 100 * 1024 * 1024,
    minThroughput: 50,
    allowedFailures: 0
  }
}
```

#### 2. Regression Test
```typescript
{
  name: 'Regression Test',
  description: 'Standard regression test suite',
  scenarios: [
    'Small Project (50 files)',
    'Medium Project (200 files)',
    'Large Project (500 files)'
  ],
  config: {
    iterations: 3,
    warmupRuns: 1,
    timeout: 120000,
    parallel: false
  },
  criteria: {
    maxExecutionTime: 60000,
    maxMemoryUsage: 500 * 1024 * 1024,
    minThroughput: 100,
    maxRegressionPercentage: 15,
    allowedFailures: 0
  }
}
```

#### 3. Stress Test
```typescript
{
  name: 'Stress Test',
  description: 'High-load stress testing',
  scenarios: [
    'Enterprise Scale (1000 files)',
    'Extreme Load (2000 files)'
  ],
  config: {
    iterations: 2,
    warmupRuns: 1,
    timeout: 300000,
    parallel: false
  },
  criteria: {
    maxExecutionTime: 180000,
    maxMemoryUsage: 1024 * 1024 * 1024,
    minThroughput: 50,
    allowedFailures: 1
  }
}
```

### Custom Test Suites

```typescript
import { getPerformanceTestRunner } from '@tw-enigma/core';

const customSuite = {
  name: 'Frontend Framework Comparison',
  description: 'Compare performance across different frontend frameworks',
  scenarios: [
    createReactScenario(),
    createVueScenario(),
    createAngularScenario()
  ],
  config: {
    iterations: 5,
    warmupRuns: 2,
    timeout: 180000,
    parallel: false
  },
  criteria: {
    maxExecutionTime: 45000,
    maxMemoryUsage: 300 * 1024 * 1024,
    minThroughput: 150,
    maxRegressionPercentage: 10,
    allowedFailures: 0
  }
};

const runner = getPerformanceTestRunner();
const result = await runner.runTestSuite(customSuite);
```

## Regression Testing

### Baseline Management

```typescript
// Create baseline
const result = await runBenchmark(scenarios);
await saveBaseline(result, './baseline-performance.json');

// Run regression test
const regressionConfig = {
  baselinePath: './baseline-performance.json',
  maxRegression: 15, // 15% maximum regression
  metricsToCheck: ['executionTime', 'memoryUsage', 'throughput'],
  updateBaselineOnImprovement: true,
  failOnRegression: true
};

const regressionResult = await runner.runRegressionTest(scenarios, regressionConfig);

if (!regressionResult.passed) {
  console.error('Performance regressions detected:');
  for (const regression of regressionResult.regressions) {
    console.error(`  ${regression.scenario} - ${regression.metric}: +${regression.regression.toFixed(1)}%`);
  }
}
```

### Automated Baseline Updates

```typescript
// Configure automatic baseline updates
const config = {
  baselinePath: './baseline-performance.json',
  maxRegression: 10,
  metricsToCheck: ['executionTime', 'memoryUsage'],
  updateBaselineOnImprovement: true, // Auto-update on improvements
  improvementThreshold: 5, // Minimum 5% improvement required
  failOnRegression: true
};
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Performance Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Download baseline
        uses: actions/download-artifact@v3
        with:
          name: performance-baseline
          path: ./
        continue-on-error: true
      
      - name: Run performance tests
        run: npm run test:performance:ci
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: |
            ./performance-results.json
            ./performance-report.html
      
      - name: Upload baseline
        uses: actions/upload-artifact@v3
        with:
          name: performance-baseline
          path: ./baseline-performance.json
      
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            try {
              const results = JSON.parse(fs.readFileSync('./performance-results.json'));
              const grade = results.insights?.grade || 'Unknown';
              const score = results.insights?.score || 0;
              
              const comment = `## Performance Test Results
              
              **Grade:** ${grade} (${score}/100)
              
              [View detailed report](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`;
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            } catch (error) {
              console.log('Could not post comment:', error);
            }
```

### GitLab CI

```yaml
performance_tests:
  stage: test
  image: node:18
  cache:
    paths:
      - node_modules/
  artifacts:
    reports:
      junit: performance-results.xml
    paths:
      - performance-results.json
      - performance-report.html
    expire_in: 1 week
  script:
    - npm ci
    - npm run test:performance:ci
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any
    stages {
        stage('Performance Tests') {
            steps {
                sh 'npm ci'
                sh 'npm run test:performance:ci'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: '.',
                        reportFiles: 'performance-report.html',
                        reportName: 'Performance Report'
                    ])
                    archiveArtifacts artifacts: 'performance-results.json', fingerprint: true
                }
            }
        }
    }
}
```

## Advanced Configuration

### Custom Performance Thresholds

```typescript
import { createPerformanceAnalyzer } from '@tw-enigma/core';

const customThresholds = {
  executionTime: {
    excellent: 500,    // 500ms
    good: 2000,        // 2 seconds
    acceptable: 8000,  // 8 seconds
    poor: 15000        // 15 seconds
  },
  memoryUsage: {
    excellent: 25 * 1024 * 1024,   // 25MB
    good: 100 * 1024 * 1024,       // 100MB
    acceptable: 250 * 1024 * 1024, // 250MB
    poor: 500 * 1024 * 1024        // 500MB
  },
  throughput: {
    excellent: 2000,   // 2000 ops/sec
    good: 1000,        // 1000 ops/sec
    acceptable: 500,   // 500 ops/sec
    poor: 200          // 200 ops/sec
  }
};

const analyzer = createPerformanceAnalyzer(customThresholds);
```

### Environment-Specific Configurations

```typescript
const getPerformanceConfig = () => {
  const isCI = process.env.CI === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    iterations: isCI ? 1 : 3,
    warmupRuns: isCI ? 0 : 1,
    timeout: isCI ? 60000 : 120000,
    scenarios: isDevelopment ? ['Small Project'] : ['Small Project', 'Medium Project', 'Large Project'],
    enableRegression: isCI,
    enableStressTests: !isCI && !isDevelopment
  };
};
```

### Parallel Test Execution

```typescript
import { getPerformanceTestRunner } from '@tw-enigma/core';

const runner = getPerformanceTestRunner();
const suites = runner.createStandardTestSuites();

// Run test suites in parallel
const results = await Promise.all(
  suites.map(suite => 
    runner.runTestSuite(suite, {
      outputPath: `./results-${suite.name.toLowerCase().replace(/\s+/g, '-')}.json`
    })
  )
);

// Combine results
const combinedReport = {
  timestamp: Date.now(),
  suites: results,
  summary: {
    totalSuites: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    warnings: results.filter(r => r.status === 'warning').length
  }
};
```

## Reporting

### HTML Reports

```typescript
import { getPerformanceTestRunner } from '@tw-enigma/core';

const runner = getPerformanceTestRunner();
await runner.generateTestReport(results, {
  format: 'html',
  outputPath: './performance-report.html',
  includeCharts: true,
  includeDetails: true
});
```

### Markdown Reports

```typescript
await runner.generateTestReport(results, {
  format: 'markdown',
  outputPath: './PERFORMANCE_REPORT.md',
  includeCharts: false,
  includeDetails: true
});
```

### JSON Reports

```typescript
await runner.generateTestReport(results, {
  format: 'json',
  outputPath: './performance-data.json',
  includeCharts: false,
  includeDetails: true
});
```

## Monitoring and Alerting

### Performance Monitoring

```typescript
// Set up continuous monitoring
const monitor = {
  async checkPerformance() {
    const result = await runQuickPerformanceTest();
    
    if (result.insights.grade === 'F' || result.insights.score < 60) {
      await this.sendAlert('Critical performance degradation detected');
    }
    
    if (result.insights.bottlenecks.some(b => b.severity === 'critical')) {
      await this.sendAlert('Critical performance bottlenecks detected');
    }
  },
  
  async sendAlert(message) {
    // Send to monitoring service, Slack, email, etc.
    console.error('PERFORMANCE ALERT:', message);
  }
};

// Run monitoring every hour
setInterval(() => monitor.checkPerformance(), 60 * 60 * 1000);
```

### Metrics Collection

```typescript
// Collect metrics for external monitoring
const collectMetrics = async () => {
  const result = await runQuickPerformanceTest();
  
  const metrics = {
    'performance.grade': result.insights.grade,
    'performance.score': result.insights.score,
    'performance.execution_time': result.aggregate.averageExecutionTime,
    'performance.memory_usage': result.aggregate.averageMemoryUsage,
    'performance.throughput': result.aggregate.averageThroughput,
    'performance.bottlenecks.critical': result.insights.bottlenecks.filter(b => b.severity === 'critical').length,
    'performance.bottlenecks.high': result.insights.bottlenecks.filter(b => b.severity === 'high').length
  };
  
  // Send to monitoring system (Prometheus, DataDog, etc.)
  await sendMetrics(metrics);
};
```

## Troubleshooting

### Common Issues

#### High Memory Usage During Tests

```typescript
// Solution: Reduce test scale and enable streaming
const config = {
  scenarios: scenarios.map(s => ({
    ...s,
    fileCount: Math.min(s.fileCount, 100),
    includeVisualDiff: false
  })),
  iterations: 1,
  warmupRuns: 0
};
```

#### Inconsistent Results

```typescript
// Solution: Increase warmup runs and iterations
const config = {
  iterations: 5,
  warmupRuns: 3,
  timeout: 300000
};
```

#### CI/CD Timeouts

```typescript
// Solution: Use CI-optimized configuration
const ciConfig = {
  scenarios: ['Small Project'], // Reduced scenarios
  iterations: 1,
  warmupRuns: 0,
  timeout: 60000,
  parallel: false
};
```

#### False Regression Alerts

```typescript
// Solution: Adjust regression thresholds
const regressionConfig = {
  maxRegression: 25, // Increased threshold
  metricsToCheck: ['executionTime'], // Focus on key metrics
  improvementThreshold: 10 // Higher improvement threshold
};
```

### Debug Mode

```typescript
// Enable detailed debugging
const simulator = getPerformanceSimulator();
simulator.enableDebugMode({
  logOperations: true,
  includeStackTraces: true,
  profileMemory: true,
  profileCPU: true
});
```

## Best Practices

### 1. Test Regularly
- Run performance tests on every major change
- Include performance tests in CI/CD pipeline
- Monitor performance trends over time

### 2. Use Appropriate Scenarios
- Test with realistic data sizes
- Include worst-case scenarios
- Test different complexity levels

### 3. Set Realistic Thresholds
- Base thresholds on production requirements
- Account for CI/CD environment differences
- Adjust thresholds as application grows

### 4. Monitor Trends
- Track performance over time
- Look for gradual degradation
- Celebrate improvements

### 5. Act on Results
- Address critical bottlenecks immediately
- Plan optimization work based on recommendations
- Validate optimizations with follow-up tests

## API Reference

See the [API Documentation](./API_REFERENCE.md) for complete interface definitions and method signatures.