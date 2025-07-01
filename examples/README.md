# TW-Enigma Examples

This directory contains comprehensive examples demonstrating TW-Enigma's dry run and preview functionality. Each example is a complete, runnable TypeScript file that showcases different aspects of the system.

## 📁 Available Examples

### 🔍 [basic-dry-run.ts](./basic-dry-run.ts)
**Basic Dry Run Operations**

Demonstrates the fundamental usage of TW-Enigma's dry run functionality:
- Simple dry run configuration
- Basic optimization simulation
- Results display and interpretation
- Error handling

**Key Features:**
- `withDryRun()` wrapper function
- `createDryRunConfig()` configuration
- File operation simulation
- Class optimization simulation
- CSS generation simulation

```bash
# Run the example
npx ts-node examples/basic-dry-run.ts
```

### 🎮 [interactive-cli.ts](./interactive-cli.ts)
**Interactive CLI Interface**

Shows how to use the interactive command-line interface for guided dry run operations:
- Session management
- Step-by-step workflow
- Real-time user interaction
- Multiple workflow patterns

**Key Features:**
- `getInteractiveCLI()` and `startInteractiveDryRun()`
- Session preferences configuration
- Custom workflow examples
- Error handling and recovery

```bash
# Run the example
npx ts-node examples/interactive-cli.ts
```

### ⚡ [performance-testing.ts](./performance-testing.ts)
**Performance Testing & Benchmarking**

Comprehensive performance testing examples covering:
- Quick performance assessments
- Benchmark suite execution
- Regression testing against baselines
- Custom performance scenarios
- CI/CD performance validation

**Key Features:**
- `runQuickPerformanceTest()` for immediate feedback
- `getPerformanceSimulator()` for custom scenarios
- `getPerformanceTestRunner()` for comprehensive testing
- `getPerformanceAnalyzer()` for insights and recommendations

```bash
# Run the example
npx ts-node examples/performance-testing.ts
```

### 🚀 [ci-integration.ts](./ci-integration.ts)
**CI/CD Pipeline Integration**

Demonstrates integration with various CI/CD platforms:
- GitHub Actions workflows
- GitLab CI pipelines
- Jenkins builds
- Generic CI environments
- Pull request validation

**Key Features:**
- Environment detection and adaptation
- Parallel execution strategies
- Artifact generation and management
- Automated PR commenting
- Failure handling and recovery

```bash
# Run the example
npx ts-node examples/ci-integration.ts
```

### 📦 [webpack-integration.ts](./webpack-integration.ts)
**Webpack Build Integration**

Shows how to integrate TW-Enigma with Webpack builds:
- Basic and advanced plugin configuration
- Development vs production settings
- Custom lifecycle hooks
- Performance monitoring during builds

**Key Features:**
- `EnigmaWebpackPlugin` configuration
- Development and production optimizations
- Custom hook implementations
- Build performance analysis

```bash
# Run the example
npx ts-node examples/webpack-integration.ts
```

## 🚀 Running Examples

### Prerequisites

1. **Install Dependencies**
   ```bash
   npm install @tw-enigma/core @tw-enigma/cli
   npm install --save-dev typescript ts-node @types/node
   ```

2. **TypeScript Configuration**
   Ensure you have a `tsconfig.json` in your project root:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "lib": ["ES2020"],
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     }
   }
   ```

### Running Individual Examples

```bash
# Basic dry run
npx ts-node examples/basic-dry-run.ts

# Interactive CLI
npx ts-node examples/interactive-cli.ts

# Performance testing
npx ts-node examples/performance-testing.ts

# CI integration
npx ts-node examples/ci-integration.ts

# Webpack integration
npx ts-node examples/webpack-integration.ts
```

### Running All Examples

```bash
# Create a simple runner script
echo "import('./basic-dry-run').then(m => m.basicDryRunExample());" > run-all.mjs
echo "import('./interactive-cli').then(m => m.runAllExamples());" >> run-all.mjs
echo "import('./performance-testing').then(m => m.performanceTestingExample());" >> run-all.mjs
echo "import('./ci-integration').then(m => m.ciIntegrationExample());" >> run-all.mjs
echo "import('./webpack-integration').then(m => m.webpackIntegrationExample());" >> run-all.mjs

node run-all.mjs
```

## 🛠️ Customization

### Adapting Examples

Each example is designed to be easily customizable:

1. **Configuration Objects**: Modify the configuration objects at the top of each file
2. **Mock Data**: Replace mock data with real project data
3. **Integration Points**: Adapt the integration patterns to your specific build system
4. **Error Handling**: Customize error handling to match your requirements

### Common Customizations

```typescript
// Custom dry run configuration
const customConfig = createDryRunConfig({
  enabled: true,
  maxOperations: 5000,        // Adjust based on project size
  logOperations: false,       // Reduce noise in production
  validateOperations: true,   // Always recommended
  operationTimeout: 10000,    // Longer timeout for large projects
});

// Custom performance thresholds
const customThresholds = {
  maxExecutionTime: 30000,    // 30 seconds
  maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
  maxRegression: 10,          // 10% regression tolerance
};

// Custom output configuration
const customOutput = {
  destinations: [
    { type: 'file', path: './custom-report.html' },
    { type: 'console' },
  ],
  format: { type: 'html' },
  validate: true,
};
```

## 📊 Example Output

### Dry Run Report Structure

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "summary": {
    "totalOperations": 150,
    "duration": 2500,
    "filesAnalyzed": 25,
    "classesFound": 300,
    "classesOptimized": 120
  },
  "operations": [...],
  "performance": {
    "executionTime": 2500,
    "memoryUsage": 45000000,
    "throughput": 60
  },
  "impact": {
    "riskLevel": "low",
    "confidence": 0.95,
    "scope": {
      "filesAffected": 15,
      "criticalFilesAffected": 0
    }
  }
}
```

### Performance Benchmark Results

```json
{
  "scenarios": [
    {
      "name": "Small Project",
      "averageExecutionTime": 1200,
      "averageMemoryUsage": 32000000,
      "averageThroughput": 75,
      "successRate": 1.0
    }
  ],
  "summary": {
    "totalDuration": 5000,
    "overallGrade": "A",
    "recommendations": [...]
  }
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Module Not Found**
   ```bash
   npm install @tw-enigma/core @tw-enigma/cli
   ```

2. **TypeScript Compilation Errors**
   ```bash
   npm install --save-dev typescript @types/node
   ```

3. **Permission Errors**
   ```bash
   chmod +x examples/*.ts
   ```

4. **Memory Issues with Large Projects**
   ```typescript
   // Reduce batch sizes and enable streaming
   const config = createDryRunConfig({
     maxOperations: 1000,     // Reduce from default 10000
     streamResults: true,
     enableGarbageCollection: true,
   });
   ```

### Debug Mode

Enable debug output for troubleshooting:

```typescript
const debugConfig = createDryRunConfig({
  enabled: true,
  logOperations: true,
  debugMode: true,
  verboseLogging: true,
  includeStackTraces: true,
});
```

## 📚 Related Documentation

- [Dry Run Guide](../docs/DRY_RUN_GUIDE.md) - Comprehensive user guide
- [CLI Reference](../docs/CLI_REFERENCE.md) - Command-line interface documentation
- [API Reference](../docs/API_REFERENCE.md) - Complete API documentation
- [Performance Testing](../docs/PERFORMANCE_TESTING.md) - Performance testing guide
- [Troubleshooting](../docs/TROUBLESHOOTING.md) - Common issues and solutions

## 🤝 Contributing

To contribute new examples:

1. Follow the existing naming pattern: `feature-name.ts`
2. Include comprehensive comments and documentation
3. Add error handling and edge case examples
4. Update this README with your new example
5. Test with different project sizes and configurations

## 📄 License

These examples are part of the TW-Enigma project and are subject to the same license terms.