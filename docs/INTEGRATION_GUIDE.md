# Integration Guide

## Overview

This guide covers integrating TW-Enigma with various build tools, frameworks, CI/CD pipelines, and development environments. Learn how to seamlessly incorporate dry run functionality and performance testing into your existing workflows.

## Build Tool Integrations

### Webpack Integration

#### Basic Setup

```javascript
// webpack.config.js
const { EnigmaWebpackPlugin } = require('@tw-enigma/core');

module.exports = {
  plugins: [
    new EnigmaWebpackPlugin({
      // Dry run configuration
      dryRun: {
        enabled: process.env.NODE_ENV !== 'production',
        outputPath: './dry-run-report.html',
        generateDiff: true,
        analyzeImpact: true
      },
      
      // Performance testing
      performance: {
        enabled: process.env.PERFORMANCE_TESTS === 'true',
        baseline: './performance-baseline.json',
        scenarios: ['webpack-build'],
        outputPath: './performance-results.json'
      },
      
      // Optimization settings
      optimization: {
        level: process.env.NODE_ENV === 'production' ? 'aggressive' : 'basic',
        scrambleClassNames: process.env.NODE_ENV === 'production',
        preservePatterns: ['dev-*', 'debug-*']
      }
    })
  ]
};
```

#### Advanced Configuration

```javascript
// webpack.config.js
const { EnigmaWebpackPlugin } = require('@tw-enigma/core');

module.exports = {
  plugins: [
    new EnigmaWebpackPlugin({
      // Conditional dry run
      dryRun: {
        enabled: process.env.ENIGMA_DRY_RUN === 'true',
        interactive: process.env.CI !== 'true',
        maxOperations: 5000,
        
        // Custom reporting
        reports: {
          html: './reports/dry-run.html',
          json: './reports/dry-run.json',
          markdown: './reports/DRY_RUN.md'
        },
        
        // Integration with webpack stats
        webpackStats: true,
        includeAssets: true,
        includeModules: true
      },
      
      // Performance monitoring
      performance: {
        enabled: true,
        continuous: process.env.CI === 'true',
        
        // Custom scenarios based on webpack config
        scenarios: [
          {
            name: 'Webpack Build Performance',
            description: 'Performance test for webpack build process',
            fileCount: 200,
            operationsPerFile: 3,
            averageFileSize: 25 * 1024,
            complexityMultiplier: 2,
            includeDependencies: true,
            includeVisualDiff: false, // Too expensive for CI
            includeImpactEstimation: true,
            includeReportGeneration: true,
            includeOutputManagement: true
          }
        ],
        
        // CI/CD integration
        ci: {
          enabled: process.env.CI === 'true',
          outputFormat: 'junit',
          resultsPath: './test-results/performance.xml',
          failOnRegression: true,
          regressionThreshold: 15
        }
      },
      
      // Hooks for custom logic
      hooks: {
        beforeDryRun: async (config) => {
          console.log('Starting dry run analysis...');
        },
        afterDryRun: async (result) => {
          if (result.summary.riskLevel === 'high') {
            console.warn('High risk changes detected!');
          }
        },
        beforePerformanceTest: async (scenarios) => {
          console.log(`Running ${scenarios.length} performance scenarios...`);
        },
        afterPerformanceTest: async (results) => {
          console.log(`Performance grade: ${results.insights.grade}`);
        }
      }
    })
  ]
};
```

### Vite Integration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { enigmaVitePlugin } from '@tw-enigma/vite-plugin';

export default defineConfig({
  plugins: [
    enigmaVitePlugin({
      dryRun: {
        enabled: process.env.NODE_ENV === 'development',
        watch: true,
        outputPath: './dev/dry-run-report.html'
      },
      performance: {
        enabled: false, // Disable in development
        scenarios: ['vite-dev-server']
      }
    })
  ]
});
```

### Rollup Integration

```javascript
// rollup.config.js
import { enigmaRollupPlugin } from '@tw-enigma/rollup-plugin';

export default {
  plugins: [
    enigmaRollupPlugin({
      dryRun: {
        enabled: process.env.DRY_RUN === 'true',
        outputPath: './build/dry-run-analysis.json'
      },
      performance: {
        enabled: process.env.PERFORMANCE_TEST === 'true',
        baseline: './performance-baseline.json'
      }
    })
  ]
};
```

### Parcel Integration

```javascript
// .parcelrc
{
  "extends": "@parcel/config-default",
  "plugins": {
    "@tw-enigma/parcel-plugin": {
      "dryRun": {
        "enabled": true,
        "outputPath": "./parcel-dry-run.html"
      }
    }
  }
}
```

## Framework Integrations

### React Integration

#### Create React App

```javascript
// craco.config.js
const { EnigmaWebpackPlugin } = require('@tw-enigma/core');

module.exports = {
  webpack: {
    plugins: [
      new EnigmaWebpackPlugin({
        framework: 'react',
        dryRun: {
          enabled: process.env.NODE_ENV === 'development',
          react: {
            analyzeComponents: true,
            analyzeHooks: true,
            preserveDisplayNames: true
          }
        }
      })
    ]
  }
};
```

#### Next.js Integration

```javascript
// next.config.js
const { EnigmaWebpackPlugin } = require('@tw-enigma/core');

module.exports = {
  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new EnigmaWebpackPlugin({
          framework: 'react',
          nextjs: true,
          dryRun: {
            enabled: dev,
            outputPath: './.next/dry-run-report.html',
            nextjs: {
              analyzePages: true,
              analyzeAPI: false,
              preserveGetStaticProps: true
            }
          },
          performance: {
            enabled: !dev,
            scenarios: ['nextjs-build', 'nextjs-export']
          }
        })
      );
    }
    return config;
  }
};
```

#### React Hook Integration

```typescript
// useEnigmaDryRun.ts
import { useState, useEffect } from 'react';
import { startInteractiveDryRun } from '@tw-enigma/core';

export function useEnigmaDryRun(config: DryRunConfig) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runDryRun = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      const result = await startInteractiveDryRun(config);
      setResults(result);
    } catch (err) {
      setError(err);
    } finally {
      setIsRunning(false);
    }
  };

  return { runDryRun, isRunning, results, error };
}

// Component usage
function DevelopmentTools() {
  const { runDryRun, isRunning, results } = useEnigmaDryRun({
    projectRoot: './src',
    optimizationLevel: 'basic'
  });

  return (
    <div>
      <button onClick={runDryRun} disabled={isRunning}>
        {isRunning ? 'Running...' : 'Preview Changes'}
      </button>
      {results && <DryRunResults results={results} />}
    </div>
  );
}
```

### Vue.js Integration

#### Vue CLI Integration

```javascript
// vue.config.js
const { EnigmaWebpackPlugin } = require('@tw-enigma/core');

module.exports = {
  configureWebpack: {
    plugins: [
      new EnigmaWebpackPlugin({
        framework: 'vue',
        dryRun: {
          enabled: process.env.NODE_ENV === 'development',
          vue: {
            analyzeComponents: true,
            analyzeSFC: true,
            preserveSlotNames: true
          }
        }
      })
    ]
  }
};
```

#### Nuxt.js Integration

```javascript
// nuxt.config.js
export default {
  build: {
    extend(config, { isDev }) {
      if (isDev) {
        config.plugins.push(
          new (require('@tw-enigma/core').EnigmaWebpackPlugin)({
            framework: 'vue',
            nuxt: true,
            dryRun: {
              enabled: true,
              outputPath: './.nuxt/dry-run-report.html',
              nuxt: {
                analyzePages: true,
                analyzeLayouts: true,
                analyzeMiddleware: true
              }
            }
          })
        );
      }
    }
  }
};
```

### Angular Integration

#### Angular CLI Integration

```javascript
// angular.json
{
  "projects": {
    "your-app": {
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "plugins": [
              {
                "name": "@tw-enigma/angular-plugin",
                "options": {
                  "dryRun": {
                    "enabled": true,
                    "outputPath": "./dist/dry-run-report.html",
                    "angular": {
                      "analyzeComponents": true,
                      "analyzeServices": true,
                      "analyzeModules": true
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  }
}
```

#### Angular Service

```typescript
// enigma-dry-run.service.ts
import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { startInteractiveDryRun } from '@tw-enigma/core';

@Injectable({
  providedIn: 'root'
})
export class EnigmaDryRunService {
  runDryRun(config: any): Observable<any> {
    return from(startInteractiveDryRun(config));
  }

  async performanceTest(scenarios: any[]): Promise<any> {
    const { runQuickPerformanceTest } = await import('@tw-enigma/core');
    return runQuickPerformanceTest(scenarios);
  }
}
```

## CI/CD Pipeline Integrations

### GitHub Actions

#### Basic Workflow

```yaml
# .github/workflows/enigma-ci.yml
name: TW-Enigma CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  dry-run-analysis:
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
      
      - name: Run dry-run analysis
        run: |
          npx @tw-enigma/cli dry-run \
            --format json \
            --report dry-run-results.json \
            --diff \
            --impact \
            --performance
      
      - name: Upload dry-run results
        uses: actions/upload-artifact@v3
        with:
          name: dry-run-analysis
          path: |
            dry-run-results.json
            dry-run-report.html
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('dry-run-results.json'));
            
            const comment = `## 🔍 Dry Run Analysis
            
            **Risk Level:** ${results.summary.riskLevel}
            **Operations:** ${results.totalOperations}
            **Files Affected:** ${results.summary.filesAffected || 'N/A'}
            
            [📊 View detailed report](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  performance-tests:
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
        run: |
          npx @tw-enigma/cli performance test \
            --suite regression \
            --baseline baseline-performance.json \
            --ci \
            --format junit \
            --output performance-results.xml
      
      - name: Publish test results
        uses: dorny/test-reporter@v1
        if: success() || failure()
        with:
          name: Performance Tests
          path: performance-results.xml
          reporter: java-junit
      
      - name: Upload baseline
        uses: actions/upload-artifact@v3
        with:
          name: performance-baseline
          path: baseline-performance.json
```

#### Advanced Workflow with Matrix

```yaml
# .github/workflows/enigma-matrix.yml
name: TW-Enigma Matrix Tests

on: [push, pull_request]

jobs:
  test-matrix:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [16, 18, 20]
        test-suite: [smoke, regression]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: |
          npx @tw-enigma/cli performance test \
            --suite ${{ matrix.test-suite }} \
            --ci \
            --output results-${{ matrix.os }}-${{ matrix.node-version }}-${{ matrix.test-suite }}.json
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.os }}-${{ matrix.node-version }}
          path: results-*.json
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - analysis
  - test
  - deploy

variables:
  NODE_VERSION: "18"

.node_template: &node_template
  image: node:${NODE_VERSION}
  cache:
    paths:
      - node_modules/
  before_script:
    - npm ci

dry_run_analysis:
  <<: *node_template
  stage: analysis
  script:
    - npx @tw-enigma/cli dry-run --format json --report dry-run-results.json
  artifacts:
    reports:
      coverage: dry-run-results.json
    paths:
      - dry-run-results.json
      - dry-run-report.html
    expire_in: 1 week
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"

performance_tests:
  <<: *node_template
  stage: test
  script:
    - npx @tw-enigma/cli performance test --ci --format junit --output performance-results.xml
  artifacts:
    reports:
      junit: performance-results.xml
    paths:
      - performance-results.json
      - baseline-performance.json
    expire_in: 1 week
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

performance_regression:
  <<: *node_template
  stage: test
  dependencies:
    - performance_tests
  script:
    - npx @tw-enigma/cli performance test --baseline baseline-performance.json --ci
  allow_failure: true
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        NODE_VERSION = '18'
    }
    
    stages {
        stage('Setup') {
            steps {
                nvm(version: env.NODE_VERSION) {
                    sh 'npm ci'
                }
            }
        }
        
        stage('Dry Run Analysis') {
            parallel {
                stage('Development Analysis') {
                    steps {
                        nvm(version: env.NODE_VERSION) {
                            sh '''
                                npx @tw-enigma/cli dry-run \
                                  --format json \
                                  --report dry-run-dev.json \
                                  --level basic
                            '''
                        }
                    }
                }
                
                stage('Production Analysis') {
                    steps {
                        nvm(version: env.NODE_VERSION) {
                            sh '''
                                npx @tw-enigma/cli dry-run \
                                  --format json \
                                  --report dry-run-prod.json \
                                  --level aggressive
                            '''
                        }
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
                        reportFiles: 'dry-run-*.html',
                        reportName: 'Dry Run Reports'
                    ])
                }
            }
        }
        
        stage('Performance Tests') {
            steps {
                nvm(version: env.NODE_VERSION) {
                    sh '''
                        npx @tw-enigma/cli performance test \
                          --suite regression \
                          --ci \
                          --format junit \
                          --output performance-results.xml
                    '''
                }
            }
            
            post {
                always {
                    junit 'performance-results.xml'
                    archiveArtifacts artifacts: 'performance-results.json', fingerprint: true
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
    }
}
```

### Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop

pr:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '18'

stages:
- stage: Analysis
  displayName: 'Dry Run Analysis'
  jobs:
  - job: DryRun
    displayName: 'Run Dry Run Analysis'
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: $(nodeVersion)
      displayName: 'Install Node.js'
    
    - script: npm ci
      displayName: 'Install dependencies'
    
    - script: |
        npx @tw-enigma/cli dry-run \
          --format json \
          --report dry-run-results.json \
          --diff \
          --impact
      displayName: 'Run dry-run analysis'
    
    - task: PublishTestResults@2
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: 'dry-run-results.xml'
        testRunTitle: 'Dry Run Analysis'
      condition: always()
    
    - task: PublishPipelineArtifact@1
      inputs:
        targetPath: '$(System.DefaultWorkingDirectory)'
        artifactName: 'dry-run-results'
      condition: always()

- stage: Performance
  displayName: 'Performance Testing'
  dependsOn: Analysis
  jobs:
  - job: PerformanceTests
    displayName: 'Run Performance Tests'
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: $(nodeVersion)
      displayName: 'Install Node.js'
    
    - script: npm ci
      displayName: 'Install dependencies'
    
    - script: |
        npx @tw-enigma/cli performance test \
          --suite regression \
          --ci \
          --format junit \
          --output performance-results.xml
      displayName: 'Run performance tests'
    
    - task: PublishTestResults@2
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: 'performance-results.xml'
        testRunTitle: 'Performance Tests'
      condition: always()
```

## Development Environment Integrations

### VS Code Extension

#### Extension Configuration

```json
// .vscode/settings.json
{
  "tw-enigma.enabled": true,
  "tw-enigma.dryRun.autoRun": true,
  "tw-enigma.dryRun.showInline": true,
  "tw-enigma.performance.enabled": false,
  "tw-enigma.optimization.level": "basic"
}
```

#### Extension Commands

- `TW-Enigma: Run Dry Run` - Execute dry run analysis
- `TW-Enigma: Preview Changes` - Show interactive preview
- `TW-Enigma: Performance Test` - Run performance benchmark
- `TW-Enigma: Open Report` - View latest analysis report

### IntelliJ/WebStorm Plugin

#### Plugin Configuration

```xml
<!-- .idea/tw-enigma.xml -->
<component name="TWEnigmaSettings">
  <option name="enabled" value="true" />
  <option name="dryRunOnSave" value="false" />
  <option name="showInlineHints" value="true" />
  <option name="performanceMonitoring" value="false" />
</component>
```

### Sublime Text Package

```json
// Preferences > Package Settings > TW-Enigma > Settings
{
  "enabled": true,
  "dry_run_on_save": false,
  "show_inline_hints": true,
  "performance_monitoring": false,
  "optimization_level": "basic"
}
```

## Monitoring and Observability

### Application Performance Monitoring (APM)

#### New Relic Integration

```javascript
// newrelic-integration.js
const newrelic = require('newrelic');
const { runQuickPerformanceTest } = require('@tw-enigma/core');

async function monitorPerformance() {
  const startTime = Date.now();
  
  try {
    const result = await runQuickPerformanceTest();
    
    // Record custom metrics
    newrelic.recordMetric('Custom/TWEnigma/Performance/Grade', result.insights.grade === 'A' ? 5 : result.insights.grade === 'B' ? 4 : 3);
    newrelic.recordMetric('Custom/TWEnigma/Performance/Score', result.insights.score);
    newrelic.recordMetric('Custom/TWEnigma/Performance/ExecutionTime', result.aggregate.averageExecutionTime);
    newrelic.recordMetric('Custom/TWEnigma/Performance/MemoryUsage', result.aggregate.averageMemoryUsage);
    
    // Record bottlenecks
    for (const bottleneck of result.insights.bottlenecks) {
      if (bottleneck.severity === 'critical') {
        newrelic.recordMetric(`Custom/TWEnigma/Bottlenecks/${bottleneck.component}`, bottleneck.impact);
      }
    }
    
  } catch (error) {
    newrelic.noticeError(error);
  } finally {
    newrelic.recordMetric('Custom/TWEnigma/Monitor/Duration', Date.now() - startTime);
  }
}

// Run monitoring every hour
setInterval(monitorPerformance, 60 * 60 * 1000);
```

#### DataDog Integration

```javascript
// datadog-integration.js
const StatsD = require('node-statsd');
const { runQuickPerformanceTest } = require('@tw-enigma/core');

const statsD = new StatsD({
  host: process.env.DATADOG_HOST || 'localhost',
  port: process.env.DATADOG_PORT || 8125
});

async function reportMetrics() {
  try {
    const result = await runQuickPerformanceTest();
    
    // Performance metrics
    statsD.gauge('tw_enigma.performance.score', result.insights.score);
    statsD.timing('tw_enigma.performance.execution_time', result.aggregate.averageExecutionTime);
    statsD.gauge('tw_enigma.performance.memory_usage', result.aggregate.averageMemoryUsage);
    statsD.gauge('tw_enigma.performance.throughput', result.aggregate.averageThroughput);
    
    // Bottleneck metrics
    const criticalBottlenecks = result.insights.bottlenecks.filter(b => b.severity === 'critical').length;
    const highBottlenecks = result.insights.bottlenecks.filter(b => b.severity === 'high').length;
    
    statsD.gauge('tw_enigma.bottlenecks.critical', criticalBottlenecks);
    statsD.gauge('tw_enigma.bottlenecks.high', highBottlenecks);
    
    // Tags for filtering
    const tags = [
      `grade:${result.insights.grade}`,
      `environment:${process.env.NODE_ENV || 'unknown'}`
    ];
    
    statsD.increment('tw_enigma.performance.runs', 1, tags);
    
  } catch (error) {
    statsD.increment('tw_enigma.performance.errors', 1);
    console.error('Failed to report TW-Enigma metrics:', error);
  }
}
```

#### Prometheus Integration

```javascript
// prometheus-integration.js
const client = require('prom-client');
const { runQuickPerformanceTest } = require('@tw-enigma/core');

// Create metrics
const performanceScore = new client.Gauge({
  name: 'tw_enigma_performance_score',
  help: 'TW-Enigma performance score (0-100)',
  labelNames: ['grade', 'environment']
});

const executionTime = new client.Histogram({
  name: 'tw_enigma_execution_time_ms',
  help: 'TW-Enigma execution time in milliseconds',
  buckets: [100, 500, 1000, 5000, 10000, 30000, 60000]
});

const memoryUsage = new client.Gauge({
  name: 'tw_enigma_memory_usage_bytes',
  help: 'TW-Enigma memory usage in bytes'
});

const bottlenecks = new client.Gauge({
  name: 'tw_enigma_bottlenecks_total',
  help: 'Number of performance bottlenecks',
  labelNames: ['severity']
});

async function collectMetrics() {
  try {
    const result = await runQuickPerformanceTest();
    
    // Update metrics
    performanceScore.set(
      { grade: result.insights.grade, environment: process.env.NODE_ENV || 'unknown' },
      result.insights.score
    );
    
    executionTime.observe(result.aggregate.averageExecutionTime);
    memoryUsage.set(result.aggregate.averageMemoryUsage);
    
    // Count bottlenecks by severity
    const severityCounts = result.insights.bottlenecks.reduce((acc, b) => {
      acc[b.severity] = (acc[b.severity] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(severityCounts).forEach(([severity, count]) => {
      bottlenecks.set({ severity }, count);
    });
    
  } catch (error) {
    console.error('Failed to collect TW-Enigma metrics:', error);
  }
}

// Collect metrics every 5 minutes
setInterval(collectMetrics, 5 * 60 * 1000);

// Expose metrics endpoint
const express = require('express');
const app = express();

app.get('/metrics', (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
});

app.listen(3001, () => {
  console.log('Prometheus metrics available at http://localhost:3001/metrics');
});
```

## Database and Storage Integrations

### MongoDB Integration

```javascript
// mongodb-integration.js
const { MongoClient } = require('mongodb');
const { runQuickPerformanceTest } = require('@tw-enigma/core');

class PerformanceDataStore {
  constructor(connectionString) {
    this.client = new MongoClient(connectionString);
    this.db = null;
    this.collection = null;
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db('tw_enigma');
    this.collection = this.db.collection('performance_results');
  }

  async storeResults(results) {
    const document = {
      timestamp: new Date(),
      grade: results.insights.grade,
      score: results.insights.score,
      executionTime: results.aggregate.averageExecutionTime,
      memoryUsage: results.aggregate.averageMemoryUsage,
      throughput: results.aggregate.averageThroughput,
      bottlenecks: results.insights.bottlenecks.map(b => ({
        component: b.component,
        type: b.type,
        severity: b.severity,
        impact: b.impact
      })),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || 'unknown'
    };

    await this.collection.insertOne(document);
  }

  async getPerformanceTrends(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return await this.collection.aggregate([
      { $match: { timestamp: { $gte: cutoff } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          avgScore: { $avg: '$score' },
          avgExecutionTime: { $avg: '$executionTime' },
          avgMemoryUsage: { $avg: '$memoryUsage' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]).toArray();
  }
}
```

### Redis Integration

```javascript
// redis-integration.js
const redis = require('redis');
const { runQuickPerformanceTest } = require('@tw-enigma/core');

class PerformanceCache {
  constructor(redisUrl) {
    this.client = redis.createClient({ url: redisUrl });
  }

  async connect() {
    await this.client.connect();
  }

  async cacheResults(results, ttl = 3600) {
    const key = `tw_enigma:performance:${Date.now()}`;
    const data = JSON.stringify({
      timestamp: Date.now(),
      results
    });
    
    await this.client.setEx(key, ttl, data);
    
    // Store latest results with a fixed key
    await this.client.set('tw_enigma:performance:latest', data);
    
    // Update performance metrics
    await this.client.hSet('tw_enigma:metrics', {
      grade: results.insights.grade,
      score: results.insights.score.toString(),
      executionTime: results.aggregate.averageExecutionTime.toString(),
      memoryUsage: results.aggregate.averageMemoryUsage.toString(),
      lastUpdate: Date.now().toString()
    });
  }

  async getLatestResults() {
    const data = await this.client.get('tw_enigma:performance:latest');
    return data ? JSON.parse(data) : null;
  }

  async getMetrics() {
    return await this.client.hGetAll('tw_enigma:metrics');
  }
}
```

## Testing Framework Integrations

### Jest Integration

```javascript
// jest-performance.test.js
const { runQuickPerformanceTest, analyzePerformance } = require('@tw-enigma/core');

describe('TW-Enigma Performance Tests', () => {
  let performanceResults;

  beforeAll(async () => {
    performanceResults = await runQuickPerformanceTest();
  });

  test('should achieve acceptable performance grade', () => {
    expect(['A', 'B', 'C']).toContain(performanceResults.insights.grade);
  });

  test('should have performance score above 60', () => {
    expect(performanceResults.insights.score).toBeGreaterThan(60);
  });

  test('should complete execution within time limit', () => {
    expect(performanceResults.aggregate.averageExecutionTime).toBeLessThan(30000);
  });

  test('should not have critical bottlenecks', () => {
    const criticalBottlenecks = performanceResults.insights.bottlenecks.filter(
      b => b.severity === 'critical'
    );
    expect(criticalBottlenecks).toHaveLength(0);
  });

  test('should maintain reasonable memory usage', () => {
    const memoryUsageMB = performanceResults.aggregate.averageMemoryUsage / 1024 / 1024;
    expect(memoryUsageMB).toBeLessThan(500); // Less than 500MB
  });
});
```

### Cypress Integration

```javascript
// cypress/integration/performance.spec.js
describe('Performance Monitoring', () => {
  it('should run performance test through UI', () => {
    cy.visit('/admin/performance');
    
    cy.get('[data-testid="run-performance-test"]').click();
    
    cy.get('[data-testid="performance-results"]', { timeout: 60000 })
      .should('be.visible');
    
    cy.get('[data-testid="performance-grade"]')
      .should('contain.text', /^[A-C]$/);
    
    cy.get('[data-testid="performance-score"]')
      .invoke('text')
      .then(text => {
        const score = parseInt(text);
        expect(score).to.be.greaterThan(60);
      });
  });
});
```

### Playwright Integration

```javascript
// tests/performance.spec.js
const { test, expect } = require('@playwright/test');
const { runQuickPerformanceTest } = require('@tw-enigma/core');

test.describe('Performance Integration', () => {
  test('should integrate performance data with UI', async ({ page }) => {
    // Run performance test
    const results = await runQuickPerformanceTest();
    
    // Navigate to performance dashboard
    await page.goto('/dashboard/performance');
    
    // Verify performance data is displayed
    await expect(page.locator('[data-testid="performance-grade"]'))
      .toHaveText(results.insights.grade);
    
    await expect(page.locator('[data-testid="performance-score"]'))
      .toHaveText(results.insights.score.toString());
  });
});
```

## API Integration Examples

### REST API Integration

```javascript
// api-integration.js
const express = require('express');
const { 
  runQuickPerformanceTest, 
  startInteractiveDryRun,
  analyzePerformance 
} = require('@tw-enigma/core');

const app = express();
app.use(express.json());

// Performance testing endpoint
app.post('/api/performance/test', async (req, res) => {
  try {
    const { scenarios, options } = req.body;
    const results = await runQuickPerformanceTest(scenarios);
    const insights = await analyzePerformance(results);
    
    res.json({
      success: true,
      data: {
        results,
        insights,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Dry run endpoint
app.post('/api/dry-run', async (req, res) => {
  try {
    const { config } = req.body;
    const result = await startInteractiveDryRun(config);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Performance metrics endpoint
app.get('/api/performance/metrics', async (req, res) => {
  try {
    const results = await runQuickPerformanceTest();
    
    res.json({
      grade: results.insights.grade,
      score: results.insights.score,
      executionTime: results.aggregate.averageExecutionTime,
      memoryUsage: results.aggregate.averageMemoryUsage,
      bottlenecks: results.insights.bottlenecks.length,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('TW-Enigma API server running on port 3000');
});
```

### GraphQL Integration

```javascript
// graphql-integration.js
const { gql, ApolloServer } = require('apollo-server-express');
const { 
  runQuickPerformanceTest, 
  analyzePerformance 
} = require('@tw-enigma/core');

const typeDefs = gql`
  type PerformanceResult {
    grade: String!
    score: Int!
    executionTime: Float!
    memoryUsage: Float!
    throughput: Float!
    bottlenecks: [Bottleneck!]!
    timestamp: Float!
  }
  
  type Bottleneck {
    component: String!
    type: String!
    severity: String!
    impact: Float!
    description: String!
  }
  
  type DryRunResult {
    totalOperations: Int!
    duration: Float!
    riskLevel: String!
    summary: String!
  }
  
  input PerformanceTestInput {
    scenarios: [String!]
    iterations: Int
  }
  
  input DryRunInput {
    projectRoot: String!
    optimizationLevel: String!
    targetFramework: String
  }
  
  type Query {
    performanceMetrics: PerformanceResult!
  }
  
  type Mutation {
    runPerformanceTest(input: PerformanceTestInput): PerformanceResult!
    runDryRun(input: DryRunInput!): DryRunResult!
  }
`;

const resolvers = {
  Query: {
    performanceMetrics: async () => {
      const results = await runQuickPerformanceTest();
      return {
        grade: results.insights.grade,
        score: results.insights.score,
        executionTime: results.aggregate.averageExecutionTime,
        memoryUsage: results.aggregate.averageMemoryUsage,
        throughput: results.aggregate.averageThroughput,
        bottlenecks: results.insights.bottlenecks.map(b => ({
          component: b.component,
          type: b.type,
          severity: b.severity,
          impact: b.impact,
          description: b.description
        })),
        timestamp: Date.now()
      };
    }
  },
  
  Mutation: {
    runPerformanceTest: async (_, { input }) => {
      const results = await runQuickPerformanceTest(input.scenarios);
      return {
        grade: results.insights.grade,
        score: results.insights.score,
        executionTime: results.aggregate.averageExecutionTime,
        memoryUsage: results.aggregate.averageMemoryUsage,
        throughput: results.aggregate.averageThroughput,
        bottlenecks: results.insights.bottlenecks,
        timestamp: Date.now()
      };
    },
    
    runDryRun: async (_, { input }) => {
      const result = await startInteractiveDryRun(input);
      return {
        totalOperations: result.dryRunResult.totalOperations,
        duration: result.dryRunResult.duration,
        riskLevel: result.dryRunResult.summary.riskLevel,
        summary: `Simulated ${result.dryRunResult.totalOperations} operations`
      };
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });
```

This comprehensive integration guide covers all major platforms, frameworks, and tools that teams commonly use. Each integration includes practical examples and best practices for incorporating TW-Enigma's dry run and performance testing capabilities into existing workflows.