# Examples and Usage Patterns

## Overview

This document provides practical examples and common usage patterns for TW-Enigma's dry run and performance testing features. Each example includes complete, working code that you can adapt for your specific use cases.

## Basic Examples

### Simple Dry Run

```typescript
// examples/basic-dry-run.ts
import { withDryRun, createDryRunConfig } from '@tw-enigma/core';

async function basicDryRunExample() {
  console.log('Running basic dry run example...');

  const config = createDryRunConfig({
    enabled: true,
    maxOperations: 1000,
    logOperations: false,
    validateOperations: true
  });

  const result = await withDryRun(
    {
      projectRoot: './src',
      optimizationLevel: 'basic'
    },
    async () => {
      // Simulate some file operations
      console.log('Simulating file operations...');
      return 'Operations completed successfully';
    },
    config
  );

  console.log('Dry run completed!');
  console.log(`Total operations: ${result.dryRunResult.totalOperations}`);
  console.log(`Duration: ${result.dryRunResult.duration}ms`);
  console.log(`Success rate: ${result.dryRunResult.summary.successful}/${result.dryRunResult.summary.successful + result.dryRunResult.summary.failed}`);
}

// Run the example
basicDryRunExample().catch(console.error);
```

### Performance Testing

```typescript
// examples/performance-testing.ts
import { 
  runQuickPerformanceTest,
  getPerformanceAnalyzer,
  getPerformanceSimulator 
} from '@tw-enigma/core';

async function performanceTestingExample() {
  console.log('Running performance testing example...');

  // Quick performance test
  console.log('1. Running quick performance test...');
  const quickResult = await runQuickPerformanceTest();
  
  console.log(`   Grade: ${quickResult.insights.grade}`);
  console.log(`   Score: ${quickResult.insights.score}/100`);
  console.log(`   Execution time: ${Math.round(quickResult.aggregate.averageExecutionTime)}ms`);

  // Custom scenarios
  console.log('2. Running custom scenarios...');
  const simulator = getPerformanceSimulator();
  
  const customScenarios = [
    {
      name: 'Small React App',
      description: 'Small React application with TypeScript',
      fileCount: 50,
      operationsPerFile: 2,
      averageFileSize: 15 * 1024,
      complexityMultiplier: 2,
      includeDependencies: true,
      includeVisualDiff: true,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: true
    }
  ];

  const customResult = await simulator.runBenchmark(customScenarios, {
    iterations: 2,
    warmupRuns: 1,
    saveResults: false
  });

  // Analyze results
  console.log('3. Analyzing performance results...');
  const analyzer = getPerformanceAnalyzer();
  const insights = await analyzer.analyzeBenchmarkResults(customResult);

  console.log(`   Overall grade: ${insights.grade}`);
  console.log(`   Bottlenecks found: ${insights.bottlenecks.length}`);
  console.log(`   High-priority recommendations: ${insights.recommendations.filter(r => r.priority === 'high').length}`);

  // Show bottlenecks
  if (insights.bottlenecks.length > 0) {
    console.log('   Top bottlenecks:');
    for (const bottleneck of insights.bottlenecks.slice(0, 3)) {
      console.log(`     • ${bottleneck.component}: ${bottleneck.description} (${bottleneck.severity})`);
    }
  }
}

// Run the example
performanceTestingExample().catch(console.error);
```

## Framework-Specific Examples

### React Integration

```typescript
// examples/react-integration.ts
import { withDryRun, createDryRunConfig } from '@tw-enigma/core';

async function reactDryRunExample() {
  console.log('React dry run example...');

  const config = createDryRunConfig({
    enabled: true,
    maxOperations: 2000,
    logOperations: true,
    validateOperations: true,
    includeFileSystemChecks: true
  });

  const result = await withDryRun(
    {
      projectRoot: './src',
      optimizationLevel: 'aggressive',
      targetFramework: 'react'
    },
    async () => {
      // Simulate React component optimization
      console.log('Analyzing React components...');
      console.log('Optimizing JSX class names...');
      console.log('Processing TypeScript files...');
      return 'React optimization completed';
    },
    config
  );

  console.log('React dry run results:');
  console.log(`  Components analyzed: ${result.dryRunResult.totalOperations}`);
  console.log(`  Processing time: ${result.dryRunResult.duration}ms`);
  console.log(`  Risk level: ${result.dryRunResult.summary.riskLevel}`);
}

// React Hook for dry run
import { useState, useCallback } from 'react';

function useDryRun() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runDryRun = useCallback(async (config) => {
    setIsRunning(true);
    setError(null);
    
    try {
      const result = await withDryRun(
        {
          projectRoot: './src',
          optimizationLevel: 'basic',
          targetFramework: 'react'
        },
        async () => {
          // Your optimization logic here
          return 'Operations completed';
        },
        config
      );
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { runDryRun, isRunning, results, error };
}

// React component
function DryRunControl() {
  const { runDryRun, isRunning, results, error } = useDryRun();

  const handleRunDryRun = () => {
    runDryRun(createDryRunConfig({ enabled: true }));
  };

  return (
    <div>
      <button onClick={handleRunDryRun} disabled={isRunning}>
        {isRunning ? 'Running...' : 'Run Dry Run'}
      </button>
      
      {error && (
        <div style={{ color: 'red' }}>
          Error: {error}
        </div>
      )}
      
      {results && (
        <div>
          <h3>Dry Run Results</h3>
          <p>Operations: {results.dryRunResult.totalOperations}</p>
          <p>Duration: {results.dryRunResult.duration}ms</p>
          <p>Risk Level: {results.dryRunResult.summary.riskLevel}</p>
        </div>
      )}
    </div>
  );
}

// Run the example
reactDryRunExample().catch(console.error);
```

### Vue.js Integration

```typescript
// examples/vue-integration.ts
import { withDryRun } from '@tw-enigma/core';
import { ref, computed } from 'vue';

// Vue composition function
function useDryRun() {
  const isRunning = ref(false);
  const results = ref(null);
  const error = ref(null);

  const runDryRun = async (config) => {
    isRunning.value = true;
    error.value = null;
    
    try {
      const result = await withDryRun(
        {
          projectRoot: './src',
          optimizationLevel: 'aggressive',
          targetFramework: 'vue'
        },
        async () => {
          console.log('Processing Vue components...');
          console.log('Optimizing single-file components...');
          return 'Vue optimization completed';
        },
        config
      );
      results.value = result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      isRunning.value = false;
    }
  };

  const hasResults = computed(() => results.value !== null);
  const operationCount = computed(() => 
    results.value?.dryRunResult.totalOperations || 0
  );

  return {
    runDryRun,
    isRunning,
    results,
    error,
    hasResults,
    operationCount
  };
}

// Vue component
const DryRunComponent = {
  setup() {
    const { runDryRun, isRunning, results, error, hasResults, operationCount } = useDryRun();

    const handleRunDryRun = () => {
      runDryRun({ enabled: true, maxOperations: 1000 });
    };

    return {
      runDryRun: handleRunDryRun,
      isRunning,
      results,
      error,
      hasResults,
      operationCount
    };
  },
  
  template: `
    <div>
      <button @click="runDryRun" :disabled="isRunning">
        {{ isRunning ? 'Running...' : 'Run Dry Run' }}
      </button>
      
      <div v-if="error" style="color: red;">
        Error: {{ error }}
      </div>
      
      <div v-if="hasResults">
        <h3>Dry Run Results</h3>
        <p>Operations: {{ operationCount }}</p>
        <p>Duration: {{ results.dryRunResult.duration }}ms</p>
        <p>Risk Level: {{ results.dryRunResult.summary.riskLevel }}</p>
      </div>
    </div>
  `
};
```

## CI/CD Examples

### GitHub Actions Workflow

```yaml
# examples/.github/workflows/dry-run-ci.yml
name: TW-Enigma Dry Run CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  dry-run-analysis:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run dry-run analysis
        run: |
          npx @tw-enigma/cli dry-run \
            --format json \
            --report dry-run-results.json \
            --diff \
            --impact \
            --max-operations 5000
      
      - name: Generate HTML report
        run: |
          npx @tw-enigma/cli dry-run \
            --format html \
            --report dry-run-report.html \
            --diff \
            --impact
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dry-run-analysis
          path: |
            dry-run-results.json
            dry-run-report.html
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            
            try {
              const results = JSON.parse(fs.readFileSync('dry-run-results.json', 'utf8'));
              
              const comment = `## 🔍 Dry Run Analysis
              
              **Operations Simulated:** ${results.totalOperations}
              **Duration:** ${Math.round(results.duration)}ms
              **Risk Level:** ${results.summary?.riskLevel || 'Unknown'}
              **Success Rate:** ${results.summary?.successful}/${results.summary?.successful + results.summary?.failed}
              
              [📊 View detailed report](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})
              
              ${results.summary?.riskLevel === 'high' ? '⚠️ **High risk changes detected!** Please review carefully.' : '✅ Changes look safe to proceed.'}`;
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            } catch (error) {
              console.log('Could not post PR comment:', error.message);
            }

  performance-tests:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
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
        run: |
          npx @tw-enigma/cli performance test \
            --suite regression \
            --baseline baseline-performance.json \
            --ci \
            --format json \
            --output performance-results.json
      
      - name: Generate performance report
        run: |
          npx @tw-enigma/cli performance analyze performance-results.json \
            --format html \
            --output performance-report.html
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: |
            performance-results.json
            performance-report.html
      
      - name: Update baseline
        uses: actions/upload-artifact@v3
        with:
          name: performance-baseline
          path: baseline-performance.json
        if: success()
```

### Jenkins Pipeline

```groovy
// examples/Jenkinsfile
pipeline {
    agent any
    
    environment {
        NODE_VERSION = '18'
        TW_ENIGMA_LOG_LEVEL = 'info'
    }
    
    stages {
        stage('Setup') {
            steps {
                script {
                    nvm(version: env.NODE_VERSION) {
                        sh 'node --version'
                        sh 'npm --version'
                        sh 'npm ci'
                    }
                }
            }
        }
        
        stage('Dry Run Analysis') {
            parallel {
                stage('Basic Analysis') {
                    steps {
                        script {
                            nvm(version: env.NODE_VERSION) {
                                sh '''
                                    npx @tw-enigma/cli dry-run \
                                      --level basic \
                                      --format json \
                                      --report dry-run-basic.json \
                                      --max-operations 1000
                                '''
                            }
                        }
                    }
                }
                
                stage('Aggressive Analysis') {
                    steps {
                        script {
                            nvm(version: env.NODE_VERSION) {
                                sh '''
                                    npx @tw-enigma/cli dry-run \
                                      --level aggressive \
                                      --format json \
                                      --report dry-run-aggressive.json \
                                      --diff \
                                      --impact \
                                      --max-operations 2000
                                '''
                            }
                        }
                    }
                }
            }
        }
        
        stage('Performance Testing') {
            steps {
                script {
                    nvm(version: env.NODE_VERSION) {
                        sh '''
                            npx @tw-enigma/cli performance test \
                              --suite smoke \
                              --ci \
                              --format junit \
                              --output performance-results.xml
                        '''
                    }
                }
            }
            
            post {
                always {
                    junit 'performance-results.xml'
                }
            }
        }
        
        stage('Generate Reports') {
            steps {
                script {
                    nvm(version: env.NODE_VERSION) {
                        sh '''
                            # Generate HTML reports
                            npx @tw-enigma/cli dry-run \
                              --format html \
                              --report dry-run-report.html \
                              --diff \
                              --impact
                            
                            # Generate performance analysis
                            npx @tw-enigma/cli performance analyze performance-results.json \
                              --format html \
                              --output performance-analysis.html
                        '''
                    }
                }
            }
            
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: '.',
                        reportFiles: '*.html',
                        reportName: 'TW-Enigma Reports'
                    ])
                    
                    archiveArtifacts artifacts: '*.json', fingerprint: true
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        
        success {
            echo 'TW-Enigma analysis completed successfully!'
        }
        
        failure {
            echo 'TW-Enigma analysis failed!'
            emailext (
                subject: "Build Failed: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: "Build failed. Check console output at ${env.BUILD_URL}",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}
```

## Build Tool Integration Examples

### Webpack Plugin Example

```javascript
// examples/webpack.config.js
const { EnigmaWebpackPlugin } = require('@tw-enigma/core');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  
  entry: './src/index.js',
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js'
  },
  
  plugins: [
    new EnigmaWebpackPlugin({
      // Dry run configuration
      dryRun: {
        enabled: process.env.NODE_ENV !== 'production',
        outputPath: './reports/dry-run-webpack.html',
        maxOperations: 5000,
        
        // Webpack-specific options
        webpack: {
          analyzeAssets: true,
          analyzeModules: true,
          includeChunks: true,
          trackDependencies: true
        },
        
        // Report configuration
        reports: {
          html: './reports/webpack-dry-run.html',
          json: './reports/webpack-dry-run.json'
        }
      },
      
      // Performance testing
      performance: {
        enabled: process.env.PERFORMANCE_TEST === 'true',
        scenarios: [
          {
            name: 'Webpack Build Performance',
            description: 'Performance test for webpack build process',
            fileCount: 100,
            operationsPerFile: 3,
            averageFileSize: 20 * 1024,
            complexityMultiplier: 2,
            includeDependencies: true,
            includeVisualDiff: false, // Too expensive for build process
            includeImpactEstimation: true,
            includeReportGeneration: true,
            includeOutputManagement: false
          }
        ],
        
        // CI integration
        ci: {
          enabled: process.env.CI === 'true',
          outputFormat: 'json',
          resultsPath: './reports/webpack-performance.json'
        }
      },
      
      // Optimization settings
      optimization: {
        level: process.env.NODE_ENV === 'production' ? 'aggressive' : 'basic',
        framework: 'react',
        preservePatterns: [
          'data-testid-*',
          'debug-*'
        ]
      },
      
      // Hooks for custom behavior
      hooks: {
        beforeDryRun: async (config) => {
          console.log('🔍 Starting dry run analysis...');
        },
        
        afterDryRun: async (result) => {
          console.log(`✅ Dry run completed: ${result.totalOperations} operations`);
          
          if (result.summary.riskLevel === 'high') {
            console.warn('⚠️ High risk changes detected!');
          }
        },
        
        beforePerformanceTest: async (scenarios) => {
          console.log(`🚀 Starting performance tests: ${scenarios.length} scenarios`);
        },
        
        afterPerformanceTest: async (results) => {
          console.log(`📊 Performance grade: ${results.insights.grade}`);
          
          if (results.insights.grade === 'F') {
            console.error('❌ Performance tests failed!');
            process.exit(1);
          }
        }
      }
    })
  ]
};
```

### Vite Plugin Example

```javascript
// examples/vite.config.js
import { defineConfig } from 'vite';
import { enigmaVitePlugin } from '@tw-enigma/vite-plugin';

export default defineConfig({
  plugins: [
    enigmaVitePlugin({
      // Development configuration
      dryRun: {
        enabled: process.env.NODE_ENV === 'development',
        watch: true,
        outputPath: './dev/dry-run-report.html',
        
        // Vite-specific options
        vite: {
          analyzeAssets: true,
          trackHMR: true,
          includeDevDependencies: false
        }
      },
      
      // Build-time performance testing
      performance: {
        enabled: process.env.NODE_ENV === 'production',
        scenarios: [
          {
            name: 'Vite Build Performance',
            description: 'Performance test for Vite build process',
            fileCount: 75,
            operationsPerFile: 2,
            averageFileSize: 15 * 1024,
            complexityMultiplier: 1.5,
            includeDependencies: true,
            includeVisualDiff: false,
            includeImpactEstimation: true,
            includeReportGeneration: true,
            includeOutputManagement: true
          }
        ]
      },
      
      // Framework integration
      framework: 'vue', // or 'react'
      
      // Custom configuration
      optimization: {
        level: 'aggressive',
        preservePatterns: ['test-*']
      }
    })
  ]
});
```

## Advanced Examples

### Custom Performance Scenarios

```typescript
// examples/custom-performance-scenarios.ts
import { 
  getPerformanceSimulator,
  getPerformanceAnalyzer,
  createPerformanceTestRunner 
} from '@tw-enigma/core';

async function customPerformanceScenariosExample() {
  console.log('Running custom performance scenarios...');

  // Define project-specific scenarios
  const scenarios = [
    {
      name: 'E-commerce Frontend',
      description: 'Large e-commerce frontend with product catalog',
      fileCount: 300,
      operationsPerFile: 4,
      averageFileSize: 35 * 1024,
      complexityMultiplier: 3,
      includeDependencies: true,
      includeVisualDiff: true,
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: true
    },
    {
      name: 'Admin Dashboard',
      description: 'Complex admin dashboard with data visualization',
      fileCount: 150,
      operationsPerFile: 3,
      averageFileSize: 25 * 1024,
      complexityMultiplier: 2.5,
      includeDependencies: true,
      includeVisualDiff: false, // Too many dynamic charts
      includeImpactEstimation: true,
      includeReportGeneration: true,
      includeOutputManagement: true
    },
    {
      name: 'Mobile App',
      description: 'React Native mobile application',
      fileCount: 100,
      operationsPerFile: 2,
      averageFileSize: 20 * 1024,
      complexityMultiplier: 2,
      includeDependencies: true,
      includeVisualDiff: true,
      includeImpactEstimation: true,
      includeReportGeneration: false, // Minimize mobile overhead
      includeOutputManagement: false
    }
  ];

  // Run benchmarks
  const simulator = getPerformanceSimulator();
  const result = await simulator.runBenchmark(scenarios, {
    iterations: 3,
    warmupRuns: 1,
    compareWithPrevious: true,
    saveResults: true,
    outputPath: './custom-performance-results.json'
  });

  // Analyze results
  const analyzer = getPerformanceAnalyzer();
  const insights = await analyzer.analyzeBenchmarkResults(result);

  console.log('Performance Analysis Results:');
  console.log(`Overall Grade: ${insights.grade}`);
  console.log(`Overall Score: ${insights.score}/100`);

  // Show scenario-specific results
  for (const scenario of result.scenarios) {
    console.log(`\n${scenario.scenario.name}:`);
    console.log(`  Execution Time: ${Math.round(scenario.totalExecutionTime)}ms`);
    console.log(`  Memory Usage: ${Math.round(scenario.memoryUsage.peak / 1024 / 1024)}MB`);
    console.log(`  Throughput: ${Math.round(scenario.throughput.operationsPerSecond)} ops/sec`);
  }

  // Show bottlenecks
  if (insights.bottlenecks.length > 0) {
    console.log('\nPerformance Bottlenecks:');
    for (const bottleneck of insights.bottlenecks) {
      console.log(`  ${bottleneck.component} (${bottleneck.severity}): ${bottleneck.description}`);
    }
  }

  // Show recommendations
  if (insights.recommendations.length > 0) {
    console.log('\nOptimization Recommendations:');
    for (const rec of insights.recommendations.filter(r => r.priority === 'high')) {
      console.log(`  [HIGH] ${rec.description} (Expected improvement: ${rec.expectedImprovement}%)`);
    }
  }

  return { result, insights };
}

// Run the example
customPerformanceScenariosExample().catch(console.error);
```

### Interactive CLI Example

```typescript
// examples/interactive-cli-example.ts
import { 
  getInteractiveCLI,
  startInteractiveDryRun 
} from '@tw-enigma/core';

async function interactiveCLIExample() {
  console.log('Starting interactive CLI example...');

  // Method 1: Direct interactive dry run
  await startInteractiveDryRun(
    {
      projectRoot: './src',
      optimizationLevel: 'aggressive',
      targetFramework: 'react'
    },
    {
      outputFormat: 'html',
      verbose: true,
      useColors: true,
      confirmActions: true,
      autoSave: true
    }
  );

  // Method 2: Manual CLI session control
  const cli = getInteractiveCLI();
  
  const session = await cli.startSession({
    outputFormat: 'markdown',
    verbose: true,
    useColors: true
  });

  await cli.runDryRunWorkflow({
    projectRoot: './src',
    optimizationLevel: 'basic'
  });

  console.log('Interactive CLI session completed!');
}

// Custom CLI workflow
async function customCLIWorkflow() {
  const cli = getInteractiveCLI();
  
  const session = await cli.startSession({
    outputFormat: 'json',
    verbose: false,
    useColors: true
  });

  // Custom step-by-step workflow
  console.log('Step 1: Configuration');
  await cli.configureDryRun(session);

  console.log('Step 2: Execution');
  await cli.executeDryRun(session);

  console.log('Step 3: Analysis');
  await cli.analyzeImpact(session);

  console.log('Step 4: Export');
  await cli.exportResults(session);

  console.log('Custom workflow completed!');
}

// Run the examples
Promise.all([
  interactiveCLIExample(),
  customCLIWorkflow()
]).catch(console.error);
```

### Monitoring and Alerting Example

```typescript
// examples/monitoring-alerting.ts
import { 
  runQuickPerformanceTest,
  analyzePerformance 
} from '@tw-enigma/core';

class PerformanceMonitor {
  private alertHandlers: Array<(alert: Alert) => void> = [];
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(private config: {
    interval: number;
    thresholds: {
      gradeThreshold: string;
      scoreThreshold: number;
      executionTimeThreshold: number;
      memoryThreshold: number;
    };
  }) {}

  addAlertHandler(handler: (alert: Alert) => void) {
    this.alertHandlers.push(handler);
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Starting performance monitoring...');

    this.interval = setInterval(async () => {
      try {
        await this.checkPerformance();
      } catch (error) {
        console.error('Performance monitoring error:', error);
      }
    }, this.config.interval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('Performance monitoring stopped');
  }

  private async checkPerformance() {
    console.log('Running performance check...');
    
    const result = await runQuickPerformanceTest();
    const insights = await analyzePerformance(result);

    // Check grade threshold
    const gradeValues = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 };
    const currentGradeValue = gradeValues[insights.grade];
    const thresholdGradeValue = gradeValues[this.config.thresholds.gradeThreshold];

    if (currentGradeValue < thresholdGradeValue) {
      this.sendAlert({
        type: 'performance_degradation',
        severity: 'high',
        message: `Performance grade dropped to ${insights.grade}`,
        data: { grade: insights.grade, score: insights.score }
      });
    }

    // Check score threshold
    if (insights.score < this.config.thresholds.scoreThreshold) {
      this.sendAlert({
        type: 'low_performance_score',
        severity: 'medium',
        message: `Performance score below threshold: ${insights.score}`,
        data: { score: insights.score, threshold: this.config.thresholds.scoreThreshold }
      });
    }

    // Check execution time
    if (result.aggregate.averageExecutionTime > this.config.thresholds.executionTimeThreshold) {
      this.sendAlert({
        type: 'slow_execution',
        severity: 'medium',
        message: `Execution time exceeded threshold: ${Math.round(result.aggregate.averageExecutionTime)}ms`,
        data: { 
          executionTime: result.aggregate.averageExecutionTime,
          threshold: this.config.thresholds.executionTimeThreshold 
        }
      });
    }

    // Check memory usage
    if (result.aggregate.averageMemoryUsage > this.config.thresholds.memoryThreshold) {
      this.sendAlert({
        type: 'high_memory_usage',
        severity: 'high',
        message: `Memory usage exceeded threshold: ${Math.round(result.aggregate.averageMemoryUsage / 1024 / 1024)}MB`,
        data: { 
          memoryUsage: result.aggregate.averageMemoryUsage,
          threshold: this.config.thresholds.memoryThreshold 
        }
      });
    }

    // Check for critical bottlenecks
    const criticalBottlenecks = insights.bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      this.sendAlert({
        type: 'critical_bottlenecks',
        severity: 'critical',
        message: `${criticalBottlenecks.length} critical performance bottlenecks detected`,
        data: { bottlenecks: criticalBottlenecks.map(b => b.description) }
      });
    }

    console.log(`Performance check completed - Grade: ${insights.grade}, Score: ${insights.score}`);
  }

  private sendAlert(alert: Alert) {
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        console.error('Alert handler error:', error);
      }
    }
  }
}

interface Alert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
}

// Example usage
async function monitoringExample() {
  const monitor = new PerformanceMonitor({
    interval: 60000, // Check every minute
    thresholds: {
      gradeThreshold: 'C', // Alert if grade falls below C
      scoreThreshold: 70,  // Alert if score below 70
      executionTimeThreshold: 30000, // Alert if execution > 30s
      memoryThreshold: 500 * 1024 * 1024 // Alert if memory > 500MB
    }
  });

  // Add alert handlers
  monitor.addAlertHandler((alert) => {
    // Send to Slack
    console.log(`📱 Would send Slack alert: ${alert.message}`);
  });

  monitor.addAlertHandler((alert) => {
    // Send email
    console.log(`📧 Would send email alert: ${alert.message}`);
  });

  monitor.addAlertHandler((alert) => {
    // Log to monitoring service
    console.log(`📊 Would log to monitoring service: ${JSON.stringify(alert)}`);
  });

  // Start monitoring
  await monitor.start();

  // Stop after 5 minutes (for example purposes)
  setTimeout(() => {
    monitor.stop();
  }, 5 * 60 * 1000);
}

// Run the monitoring example
monitoringExample().catch(console.error);
```

These examples provide comprehensive patterns for integrating TW-Enigma's dry run and performance testing features into various workflows, frameworks, and monitoring systems. Each example includes complete, working code that can be adapted for specific use cases.