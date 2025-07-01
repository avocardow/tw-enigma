# TW-Enigma Dry Run Guide

## Overview

The TW-Enigma dry run system provides safe operation simulation and preview functionality, allowing you to test optimization changes without modifying actual files. This comprehensive guide covers all dry run features, configuration options, and integration patterns.

## Quick Start

### Basic Dry Run

```typescript
import { withDryRun, createDryRunConfig } from '@tw-enigma/core';

// Simple dry run execution
const result = await withDryRun(
  { projectRoot: './src', optimizationLevel: 'aggressive' },
  async () => {
    // Your optimization operations here
    return 'Operation completed';
  }
);

console.log(`Simulated ${result.dryRunResult.totalOperations} operations`);
```

### Interactive CLI Mode

```typescript
import { startInteractiveDryRun } from '@tw-enigma/core';

await startInteractiveDryRun(
  {
    projectRoot: './src',
    optimizationLevel: 'aggressive',
    targetFramework: 'react'
  },
  {
    outputFormat: 'html',
    verbose: true,
    useColors: true
  }
);
```

## Core Components

### 1. Dry Run Manager

The central orchestrator for all dry run operations.

```typescript
import { DryRunManager, createDryRunConfig } from '@tw-enigma/core';

const manager = new DryRunManager();
const config = createDryRunConfig({
  enabled: true,
  maxOperations: 10000,
  logOperations: true,
  validateOperations: true,
  includeFileSystemChecks: true,
  simulateLatency: false,
  operationTimeout: 5000
});

// Start dry run context
const context = await manager.startDryRun(config);

// Your operations here...

// End dry run and get results
const result = await manager.endDryRun(context.id);
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable dry run mode |
| `maxOperations` | number | `10000` | Maximum operations to track |
| `logOperations` | boolean | `false` | Log individual operations |
| `validateOperations` | boolean | `true` | Validate operation safety |
| `includeFileSystemChecks` | boolean | `true` | Check file system constraints |
| `simulateLatency` | boolean | `false` | Add realistic operation delays |
| `operationTimeout` | number | `5000` | Timeout per operation (ms) |

### 2. File System Interceptor

Safely intercepts and simulates file system operations.

```typescript
import { 
  FileSystemInterceptor, 
  installGlobalInterception,
  uninstallGlobalInterception 
} from '@tw-enigma/core';

// Install global interception
installGlobalInterception({
  interceptReadOperations: true,
  interceptWriteOperations: true,
  interceptDeleteOperations: true,
  allowedPaths: ['./src', './dist'],
  blockedPaths: ['./node_modules', './.git']
});

// Manual interception
const interceptor = new FileSystemInterceptor({
  enableLogging: true,
  validatePaths: true,
  simulateErrors: false
});

await interceptor.start();
// Operations are now intercepted
await interceptor.stop();

// Cleanup
uninstallGlobalInterception();
```

### 3. Report Generator

Generates comprehensive preview reports.

```typescript
import { getDryRunReportGenerator } from '@tw-enigma/core';

const generator = getDryRunReportGenerator();
const report = generator.generateReport(dryRunResult, {
  format: 'html',
  includeOperationDetails: true,
  includeRawData: false,
  includeMetrics: true,
  includeRecommendations: true
});

console.log(`Generated report with ${report.sections.length} sections`);
```

#### Report Formats

- **HTML**: Rich interactive reports with styling
- **Markdown**: Documentation-friendly format
- **JSON**: Machine-readable structured data
- **Text**: Simple console-friendly output

### 4. Visual Diff Generator

Creates visual representations of changes.

```typescript
import { getVisualDiffGenerator } from '@tw-enigma/core';

const diffGenerator = getVisualDiffGenerator();
const diffResult = await diffGenerator.generateDiff(dryRunResult, {
  outputFormat: 'unified',
  showLineNumbers: true,
  contextLines: 3,
  highlightChanges: true,
  includeMetadata: true
});

console.log(`Found ${diffResult.summary.totalChanges} file changes`);
```

#### Diff Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `outputFormat` | string | `'unified'` | Diff format: unified, side-by-side, inline |
| `showLineNumbers` | boolean | `true` | Include line numbers in output |
| `contextLines` | number | `3` | Lines of context around changes |
| `highlightChanges` | boolean | `true` | Highlight additions/deletions |
| `includeMetadata` | boolean | `true` | Include file metadata |

### 5. Impact Estimator

Analyzes and quantifies change impact.

```typescript
import { getImpactEstimator } from '@tw-enigma/core';

const estimator = getImpactEstimator();
const metrics = await estimator.estimateImpact(dryRunResult, {
  totalFiles: 1000,
  dependencies: componentDependencies,
  projectSize: 50 * 1024 * 1024 // 50MB
});

console.log(`Risk level: ${metrics.riskLevel}`);
console.log(`Confidence: ${Math.round(metrics.confidence * 100)}%`);
console.log(`Files affected: ${metrics.scope.filesAffected}`);
```

#### Impact Metrics

- **Risk Level**: low, medium, high, critical
- **Confidence Score**: 0-1 confidence in assessment
- **Scope Analysis**: Files affected, critical files, dependencies
- **Size Impact**: Total bytes changed, percentage change
- **Performance Impact**: Estimated duration, complexity
- **Risk Factors**: Detailed risk breakdown with mitigation

### 6. Output Manager

Flexible output handling for all formats and destinations.

```typescript
import { getOutputManager } from '@tw-enigma/core';

const outputManager = getOutputManager();

// Output to multiple destinations
const result = await outputManager.outputCombinedResults(
  {
    dryRunResult,
    report,
    visualDiff,
    impactMetrics
  },
  {
    destinations: [
      { type: 'file', path: './dry-run-report.html' },
      { type: 'console' },
      { type: 'api', endpoint: 'https://api.example.com/reports' }
    ],
    format: { type: 'html', options: { prettyPrint: true } },
    validate: true,
    backup: true,
    createDirectories: true
  }
);
```

#### Output Destinations

- **File**: Write to local file system
- **Console**: Output to stdout/stderr
- **API**: POST to HTTP endpoint
- **Stream**: Write to Node.js stream
- **Memory**: Store in memory cache

#### Output Formats

- **JSON**: Structured data
- **HTML**: Rich web format
- **Markdown**: Documentation format
- **Text**: Plain text
- **YAML**: Configuration-friendly
- **XML**: Structured markup
- **CSV**: Spreadsheet format
- **PDF**: Print-ready format (placeholder)

## Advanced Features

### Performance Simulation

```typescript
import { 
  getPerformanceSimulator,
  runQuickPerformanceTest 
} from '@tw-enigma/core';

// Quick performance test
const quickResult = await runQuickPerformanceTest();
console.log(`Performance grade: ${quickResult.grade}`);

// Custom scenarios
const simulator = getPerformanceSimulator();
const customScenarios = [
  {
    name: 'Large React Project',
    fileCount: 500,
    operationsPerFile: 3,
    averageFileSize: 25 * 1024,
    complexityMultiplier: 2,
    includeDependencies: true,
    includeVisualDiff: true,
    includeImpactEstimation: true,
    includeReportGeneration: true,
    includeOutputManagement: true
  }
];

const benchmark = await simulator.runBenchmark(customScenarios, {
  iterations: 3,
  warmupRuns: 1,
  compareWithPrevious: true,
  saveResults: true,
  outputPath: './performance-results.json'
});
```

### Performance Analysis

```typescript
import { getPerformanceAnalyzer } from '@tw-enigma/core';

const analyzer = getPerformanceAnalyzer();
const insights = await analyzer.analyzeBenchmarkResults(benchmark);

console.log(`Performance grade: ${insights.grade}`);
console.log(`Score: ${insights.score}/100`);

// Check for bottlenecks
for (const bottleneck of insights.bottlenecks) {
  if (bottleneck.severity === 'critical') {
    console.log(`Critical bottleneck in ${bottleneck.component}: ${bottleneck.description}`);
  }
}

// Get recommendations
for (const rec of insights.recommendations) {
  if (rec.priority === 'high') {
    console.log(`High priority: ${rec.description} (${rec.expectedImprovement}% improvement)`);
  }
}
```

### Interactive CLI

```typescript
import { getInteractiveCLI } from '@tw-enigma/core';

const cli = getInteractiveCLI();
const session = await cli.startSession({
  outputFormat: 'html',
  useColors: true,
  verbose: true,
  confirmActions: true
});

await cli.runDryRunWorkflow({
  projectRoot: './src',
  optimizationLevel: 'aggressive',
  targetFramework: 'react'
});
```

## Integration Patterns

### CI/CD Integration

```typescript
import { getPerformanceTestRunner } from '@tw-enigma/core';

const runner = getPerformanceTestRunner();
const suites = runner.createStandardTestSuites();

const result = await runner.runTestSuite(suites[0], {
  regressionTest: {
    baselinePath: './baseline-performance.json',
    maxRegression: 15,
    metricsToCheck: ['executionTime', 'memoryUsage', 'throughput'],
    updateBaselineOnImprovement: true,
    failOnRegression: true
  },
  ciConfig: {
    enabled: true,
    outputFormat: 'junit',
    resultsPath: './test-results.xml',
    uploadResults: false
  }
});

if (result.status === 'failed') {
  console.error('Performance tests failed');
  process.exit(1);
}
```

### GitHub Actions

```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: npm run test:performance
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: ./performance-results.json
```

### Webpack Integration

```javascript
const { EnigmaWebpackPlugin } = require('@tw-enigma/core');

module.exports = {
  plugins: [
    new EnigmaWebpackPlugin({
      dryRun: process.env.NODE_ENV !== 'production',
      outputPath: './enigma-dry-run-report.html',
      performanceTests: true,
      regressionBaseline: './performance-baseline.json'
    })
  ]
};
```

## Error Handling

### Common Error Types

```typescript
import { 
  DryRunError,
  FileSystemInterceptorError,
  PerformanceSimulationError,
  ImpactEstimationError,
  OutputError 
} from '@tw-enigma/core';

try {
  await withDryRun(projectContext, async () => {
    // Operations
  });
} catch (error) {
  if (error instanceof DryRunError) {
    console.error('Dry run failed:', error.message);
    console.error('Context:', error.context);
  } else if (error instanceof FileSystemInterceptorError) {
    console.error('File system interception failed:', error.message);
    console.error('Operation:', error.operation);
  } else if (error instanceof PerformanceSimulationError) {
    console.error('Performance simulation failed:', error.message);
    console.error('Scenario:', error.scenario);
  }
}
```

### Error Recovery

```typescript
// Automatic retry with exponential backoff
const config = createDryRunConfig({
  enabled: true,
  retryFailedOperations: true,
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoff: 2.0
});

// Manual recovery
try {
  const result = await withDryRun(projectContext, operations, config);
} catch (error) {
  if (error.recoverable) {
    console.log('Attempting recovery...');
    const recoveredResult = await withDryRun(
      projectContext, 
      operations, 
      { ...config, safeMode: true }
    );
  }
}
```

## Best Practices

### 1. Configuration Management

```typescript
// Use environment-specific configs
const config = createDryRunConfig({
  enabled: process.env.NODE_ENV !== 'production',
  maxOperations: process.env.NODE_ENV === 'test' ? 100 : 10000,
  logOperations: process.env.DEBUG === 'true',
  validateOperations: true,
  operationTimeout: process.env.CI ? 10000 : 5000
});
```

### 2. Resource Management

```typescript
// Always cleanup resources
let dryRunContext;
try {
  dryRunContext = await manager.startDryRun(config);
  // Operations...
} finally {
  if (dryRunContext) {
    await manager.endDryRun(dryRunContext.id);
  }
}
```

### 3. Progress Monitoring

```typescript
const config = createDryRunConfig({
  enabled: true,
  progressCallback: (progress) => {
    console.log(`Progress: ${progress.completed}/${progress.total} (${Math.round(progress.percentage)}%)`);
  }
});
```

### 4. Memory Management

```typescript
// For large projects, use streaming
const config = createDryRunConfig({
  enabled: true,
  streamResults: true,
  maxMemoryUsage: 512 * 1024 * 1024, // 512MB
  enableGarbageCollection: true
});
```

### 5. Performance Optimization

```typescript
// Optimize for large-scale operations
const config = createDryRunConfig({
  enabled: true,
  enableParallelProcessing: true,
  workerThreads: 4,
  batchSize: 100,
  enableCaching: true,
  cacheSize: 1000
});
```

## Troubleshooting

### Common Issues

#### 1. High Memory Usage

```typescript
// Solution: Enable streaming and limit cache size
const config = createDryRunConfig({
  streamResults: true,
  maxMemoryUsage: 256 * 1024 * 1024,
  enableGarbageCollection: true,
  cacheSize: 500
});
```

#### 2. Slow Performance

```typescript
// Solution: Enable parallel processing
const config = createDryRunConfig({
  enableParallelProcessing: true,
  workerThreads: os.cpus().length,
  batchSize: 50,
  enableCaching: true
});
```

#### 3. File System Errors

```typescript
// Solution: Configure path validation
const interceptorConfig = {
  validatePaths: true,
  allowedPaths: ['./src', './dist'],
  blockedPaths: ['./node_modules', './.git'],
  enableSandbox: true
};
```

#### 4. Output Generation Failures

```typescript
// Solution: Use fallback configurations
const outputConfig = {
  destinations: [
    { type: 'file', path: './report.html' },
    { type: 'console' } // Fallback
  ],
  format: { type: 'html' },
  validate: false, // Skip validation if causing issues
  createDirectories: true,
  overwrite: true
};
```

### Debug Mode

```typescript
// Enable comprehensive debugging
const config = createDryRunConfig({
  enabled: true,
  logOperations: true,
  debugMode: true,
  verboseLogging: true,
  includeStackTraces: true
});

// Access debug information
console.log('Debug info:', result.debugInfo);
```

### Performance Profiling

```typescript
// Profile dry run performance
import { getPerformanceSimulator } from '@tw-enigma/core';

const simulator = getPerformanceSimulator();
const profileResult = await simulator.runBenchmark([scenario], {
  iterations: 1,
  profileMode: true,
  includeDetailedTiming: true
});

console.log('Component timing:', profileResult.scenarios[0].componentTiming);
```

## API Reference

### Types

```typescript
interface DryRunConfig {
  enabled: boolean;
  maxOperations: number;
  logOperations: boolean;
  validateOperations: boolean;
  includeFileSystemChecks: boolean;
  simulateLatency: boolean;
  operationTimeout: number;
}

interface DryRunResult {
  enabled: boolean;
  totalOperations: number;
  duration: number;
  context: DryRunContext;
  summary: DryRunSummary;
}

interface DryRunOperation {
  id: string;
  type: 'file-write' | 'file-modify' | 'file-delete' | 'directory-create' | 'directory-delete' | 'config-update' | 'cache-clear';
  target: string;
  description: string;
  timestamp: number;
  wouldSucceed: boolean;
  sizeImpact?: number;
  metadata?: Record<string, any>;
}
```

## Examples

See the [examples directory](../examples/) for complete implementation examples:

- [Basic Dry Run](../examples/basic-dry-run.ts)
- [Interactive CLI](../examples/interactive-cli.ts)
- [Performance Testing](../examples/performance-testing.ts)
- [CI/CD Integration](../examples/ci-integration.ts)
- [Webpack Plugin](../examples/webpack-integration.ts)

## Support

For additional help:

- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Review [API Documentation](./API_REFERENCE.md)
- See [Example Implementations](../examples/)
- Report issues on [GitHub](https://github.com/your-repo/issues)