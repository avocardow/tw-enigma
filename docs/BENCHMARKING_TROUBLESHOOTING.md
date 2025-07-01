# TW-Enigma Benchmarking Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the TW-Enigma Performance Benchmarking System.

## Table of Contents

- [Common Issues](#common-issues)
- [Performance Problems](#performance-problems)
- [Memory Issues](#memory-issues)
- [Profiling Problems](#profiling-problems)
- [CI/CD Issues](#cicd-issues)
- [Configuration Errors](#configuration-errors)
- [Environment Issues](#environment-issues)
- [Debug Tools](#debug-tools)
- [FAQ](#faq)

## Common Issues

### Benchmark Timeouts

**Symptoms:**
- Benchmarks fail with timeout errors
- Long-running benchmarks never complete
- `BenchmarkTimeoutError` exceptions

**Causes and Solutions:**

1. **Default timeout too low**
   ```typescript
   // Solution: Increase timeout
   const config: BenchmarkConfig = {
     timeout: 60000, // 60 seconds instead of default 30
   };
   ```

2. **Infinite loops or deadlocks**
   ```typescript
   // Debug: Add logging to identify hanging code
   suite.addBenchmark({
     name: 'Debug Benchmark',
     fn: async () => {
       console.log('Starting operation...');
       const result = await yourOperation();
       console.log('Operation completed');
       return result;
     },
   });
   ```

3. **Synchronous blocking operations**
   ```typescript
   // Problem: Blocking I/O
   fn: () => fs.readFileSync('large-file.txt'), // Bad
   
   // Solution: Use async operations
   fn: async () => fs.readFile('large-file.txt'), // Good
   ```

### Inconsistent Results

**Symptoms:**
- Results vary significantly between runs
- High standard deviation in measurements
- Unreliable performance comparisons

**Solutions:**

1. **Increase warmup iterations**
   ```typescript
   const config: BenchmarkConfig = {
     warmupIterations: 50, // Default is 10
     iterations: 200, // More iterations for stability
   };
   ```

2. **Enable outlier detection**
   ```typescript
   const config: BenchmarkConfig = {
     statistics: {
       enableOutlierDetection: true,
       outlierThreshold: 2.0, // Standard deviations
       minimumSampleSize: 30,
     },
   };
   ```

3. **Stabilize environment**
   ```typescript
   const config: BenchmarkConfig = {
     cleanup: {
       forceGC: true,
       clearModuleCache: true,
       resetGlobalState: true,
     },
     validation: {
       requireCleanEnvironment: true,
       enforceConsistency: true,
     },
   };
   ```

### Setup/Teardown Failures

**Symptoms:**
- Benchmarks fail before or after execution
- Resource cleanup errors
- State corruption between tests

**Solutions:**

1. **Robust error handling**
   ```typescript
   suite.addBenchmark({
     name: 'Robust Benchmark',
     setup: async () => {
       try {
         await setupResources();
       } catch (error) {
         console.error('Setup failed:', error);
         throw new BenchmarkError('Setup failed', 'SETUP_FAILED', error);
       }
     },
     teardown: async () => {
       try {
         await cleanupResources();
       } catch (error) {
         console.warn('Cleanup failed:', error);
         // Don't throw to prevent masking benchmark results
       }
     },
   });
   ```

2. **Idempotent operations**
   ```typescript
   setup: async () => {
     // Ensure cleanup from previous runs
     await forceCleanup();
     await setupFreshEnvironment();
   },
   ```

## Performance Problems

### Slow Benchmark Execution

**Symptoms:**
- Benchmarks take much longer than expected
- CI builds timeout due to benchmark duration
- Poor development experience

**Solutions:**

1. **Enable parallel execution**
   ```typescript
   const config: BenchmarkConfig = {
     parallel: {
       enabled: true,
       maxConcurrency: require('os').cpus().length,
       isolateMemory: false, // Faster but less isolated
     },
   };
   ```

2. **Reduce profiling overhead**
   ```typescript
   const config: BenchmarkConfig = {
     profiling: {
       enabled: false, // Disable in speed-critical scenarios
       sampleInterval: 1000, // Reduce sampling frequency
       captureStackTraces: false, // Expensive operation
     },
   };
   ```

3. **Optimize iterations for CI**
   ```typescript
   const isCI = process.env.CI === 'true';
   const config: BenchmarkConfig = {
     iterations: isCI ? 20 : 100,
     warmupIterations: isCI ? 5 : 20,
     profiling: {
       enabled: !isCI,
     },
   };
   ```

### High CPU Usage

**Symptoms:**
- System becomes unresponsive during benchmarks
- CPU usage at 100% for extended periods
- Thermal throttling affects results

**Solutions:**

1. **Limit concurrency**
   ```typescript
   const config: BenchmarkConfig = {
     parallel: {
       enabled: true,
       maxConcurrency: Math.max(1, require('os').cpus().length - 1), // Leave one core free
     },
   };
   ```

2. **Add execution delays**
   ```typescript
   suite.addBenchmark({
     name: 'CPU-Intensive Operation',
     fn: async () => {
       const result = await cpuIntensiveOperation();
       // Small delay to prevent overwhelming CPU
       await new Promise(resolve => setTimeout(resolve, 10));
       return result;
     },
   });
   ```

3. **Use process isolation**
   ```typescript
   const config: BenchmarkConfig = {
     parallel: {
       enabled: true,
       isolateProcess: true, // Run each benchmark in separate process
     },
   };
   ```

## Memory Issues

### Out of Memory Errors

**Symptoms:**
- `FATAL ERROR: Allocation failed - JavaScript heap out of memory`
- Benchmarks crash due to memory exhaustion
- System becomes unresponsive

**Solutions:**

1. **Increase Node.js memory limit**
   ```bash
   # Command line
   node --max-old-space-size=4096 benchmark-script.js
   
   # Or in package.json
   {
     "scripts": {
       "benchmark": "node --max-old-space-size=4096 benchmark-script.js"
     }
   }
   ```

2. **Configure benchmark memory limits**
   ```typescript
   const config: BenchmarkConfig = {
     memoryLimit: 2 * 1024 * 1024 * 1024, // 2GB limit per benchmark
     cleanup: {
       forceGC: true, // Force garbage collection between benchmarks
     },
   };
   ```

3. **Optimize data management**
   ```typescript
   // Problem: Large data structures in closure
   suite.addBenchmark({
     name: 'Memory Inefficient',
     fn: () => {
       const largeArray = new Array(1000000).fill(complexObject); // Bad
       return processArray(largeArray);
     },
   });
   
   // Solution: Reuse data or use smaller samples
   const sharedData = createTestData(); // Create once, reuse
   suite.addBenchmark({
     name: 'Memory Efficient',
     fn: () => processArray(sharedData.slice(0, 1000)), // Use subset
   });
   ```

### Memory Leaks

**Symptoms:**
- Memory usage increases over time
- Performance degrades during long benchmark runs
- Eventually leads to out of memory errors

**Detection:**

1. **Enable memory profiling**
   ```typescript
   import { MemoryBenchmarkRunner } from '@tw-enigma/core/benchmarking';
   
   const runner = new MemoryBenchmarkRunner({
     captureHeapSnapshots: true,
     trackAllocations: true,
     detectLeaks: true,
   });
   
   const results = await runner.runSuite(suite);
   if (results.leaksDetected) {
     console.warn('Memory leaks detected:', results.leakSummary);
   }
   ```

2. **Manual leak detection**
   ```typescript
   suite.addBenchmark({
     name: 'Leak Detection Test',
     setup: () => {
       this.initialMemory = process.memoryUsage().heapUsed;
     },
     fn: () => {
       // Your benchmark code
       return someOperation();
     },
     teardown: () => {
       global.gc && global.gc(); // Force GC if available
       const finalMemory = process.memoryUsage().heapUsed;
       const memoryDiff = finalMemory - this.initialMemory;
       if (memoryDiff > LEAK_THRESHOLD) {
         console.warn(`Potential memory leak: ${memoryDiff} bytes`);
       }
     },
   });
   ```

**Prevention:**

1. **Proper cleanup**
   ```typescript
   suite.addBenchmark({
     name: 'Proper Cleanup',
     fn: () => {
       const resources = allocateResources();
       try {
         return processResources(resources);
       } finally {
         // Always cleanup
         releaseResources(resources);
       }
     },
   });
   ```

2. **Avoid global state**
   ```typescript
   // Problem: Global state accumulation
   let globalCache = new Map(); // Bad - grows indefinitely
   
   // Solution: Bounded cache or benchmark-scoped state
   const createBoundedCache = () => {
     const cache = new Map();
     return {
       get: (key) => cache.get(key),
       set: (key, value) => {
         if (cache.size > 1000) cache.clear(); // Bound size
         cache.set(key, value);
       },
     };
   };
   ```

## Profiling Problems

### Profiling Data Collection Failures

**Symptoms:**
- Missing profiling data in results
- Profiler errors or warnings
- Incomplete performance analysis

**Solutions:**

1. **Check profiler compatibility**
   ```typescript
   import { createBenchmarkProfiler } from '@tw-enigma/core/benchmarking/profiling';
   
   const profiler = createBenchmarkProfiler({
     enabled: true,
     // Disable features unsupported on current platform
     captureStackTraces: process.platform !== 'win32',
     captureCPUProfile: !process.env.CI, // May not work in CI
   });
   ```

2. **Validate profiling setup**
   ```typescript
   // Check if profiling APIs are available
   const validateProfiling = () => {
     const checks = {
       performanceObserver: typeof PerformanceObserver !== 'undefined',
       gcObserver: process.version >= 'v14.0.0',
       heapSnapshot: typeof process.getHeapSnapshot === 'function',
     };
     
     console.log('Profiling capability check:', checks);
     return Object.values(checks).every(Boolean);
   };
   
   if (!validateProfiling()) {
     console.warn('Some profiling features may not be available');
   }
   ```

3. **Graceful degradation**
   ```typescript
   const runner = new BenchmarkRunner(config, profiler);
   
   runner.on('profiling-error', (error) => {
     console.warn('Profiling failed, continuing without profiling:', error.message);
     // Disable profiling and continue
     runner.updateConfig({ profiling: { enabled: false } });
   });
   ```

### Bottleneck Analysis Issues

**Symptoms:**
- No bottlenecks detected in obviously slow code
- False positive bottleneck detections
- Incomplete analysis reports

**Solutions:**

1. **Adjust detection thresholds**
   ```typescript
   import { createBottleneckAnalyzer } from '@tw-enigma/core/benchmarking/profiling';
   
   const analyzer = createBottleneckAnalyzer({
     durationThreshold: 5, // Lower threshold for more sensitive detection
     memoryThreshold: 20 * 1024 * 1024, // 20MB threshold
     cpuThreshold: 70, // 70% CPU usage threshold
     enablePatternDetection: true,
     enableRootCauseAnalysis: true,
   });
   ```

2. **Validate analysis input**
   ```typescript
   const validateProfilingData = (data: BenchmarkProfilingData[]) => {
     if (data.length === 0) {
       throw new Error('No profiling data available for analysis');
     }
     
     const hasMetrics = data.some(d => 
       d.resourceSnapshots.length > 0 || d.bottlenecks.length > 0
     );
     
     if (!hasMetrics) {
       console.warn('Profiling data contains no performance metrics');
     }
     
     return hasMetrics;
   };
   ```

## CI/CD Issues

### CI Environment Failures

**Symptoms:**
- Benchmarks pass locally but fail in CI
- Inconsistent results across CI runs
- CI timeouts or resource limits exceeded

**Solutions:**

1. **CI-specific configuration**
   ```typescript
   const createCIConfig = (): BenchmarkConfig => ({
     iterations: 20, // Fewer iterations for faster execution
     timeout: 30000, // Shorter timeout
     memoryLimit: 1024 * 1024 * 1024, // 1GB limit
     
     parallel: {
       enabled: false, // Disable parallel execution in CI
     },
     
     profiling: {
       enabled: false, // Disable profiling in CI
     },
     
     validation: {
       checkSystemRequirements: false, // Skip system checks
       requireCleanEnvironment: false,
     },
   });
   ```

2. **Environment detection**
   ```typescript
   const getEnvironmentConfig = (): BenchmarkConfig => {
     const isCI = process.env.CI === 'true';
     const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
     const isContainer = process.env.CONTAINER === 'true';
     
     if (isCI) {
       return createCIConfig();
     } else if (isContainer) {
       return createContainerConfig();
     } else {
       return createDevelopmentConfig();
     }
   };
   ```

3. **Baseline management**
   ```typescript
   // Store baseline results in CI
   const storeBaseline = async (results: BenchmarkResult[]) => {
     if (process.env.GITHUB_REF === 'refs/heads/main') {
       await fs.writeFile('baseline-results.json', JSON.stringify(results));
       // Upload to artifact storage or commit to repo
     }
   };
   
   // Load baseline for comparison
   const loadBaseline = async (): Promise<BenchmarkResult[]> => {
     try {
       const data = await fs.readFile('baseline-results.json', 'utf-8');
       return JSON.parse(data);
     } catch {
       console.warn('No baseline results found');
       return [];
     }
   };
   ```

### GitHub Actions Specific Issues

**Common Problems:**

1. **Resource constraints**
   ```yaml
   # .github/workflows/benchmark.yml
   jobs:
     benchmark:
       runs-on: ubuntu-latest
       steps:
         - name: Increase memory for Node.js
           run: echo "NODE_OPTIONS=--max-old-space-size=4096" >> $GITHUB_ENV
         
         - name: Run benchmarks with timeout
           run: timeout 10m npm run benchmark
           continue-on-error: true
   ```

2. **Artifact management**
   ```yaml
   - name: Upload benchmark results
     uses: actions/upload-artifact@v4
     if: always()
     with:
       name: benchmark-results
       path: benchmark-results/
       retention-days: 30
   ```

## Configuration Errors

### Invalid Configuration

**Symptoms:**
- Benchmarks fail to start
- `BenchmarkValidationError` exceptions
- Unexpected behavior during execution

**Solutions:**

1. **Configuration validation**
   ```typescript
   import { validateBenchmarkConfig } from '@tw-enigma/core/benchmarking';
   
   const config: BenchmarkConfig = {
     iterations: 100,
     timeout: 30000,
     // ... other options
   };
   
   try {
     validateBenchmarkConfig(config);
   } catch (error) {
     console.error('Invalid configuration:', error.message);
     // Fix configuration or use defaults
   }
   ```

2. **Safe configuration merging**
   ```typescript
   const createSafeConfig = (userConfig: Partial<BenchmarkConfig>): BenchmarkConfig => {
     const defaults: BenchmarkConfig = {
       iterations: 100,
       warmupIterations: 10,
       timeout: 30000,
       memoryLimit: 512 * 1024 * 1024,
     };
     
     return {
       ...defaults,
       ...userConfig,
       // Ensure required fields are valid
       iterations: Math.max(1, userConfig.iterations || defaults.iterations),
       timeout: Math.max(1000, userConfig.timeout || defaults.timeout),
     };
   };
   ```

### Type Configuration Issues

**Symptoms:**
- TypeScript compilation errors
- Runtime type mismatches
- Unexpected behavior due to wrong types

**Solutions:**

1. **Strict type checking**
   ```typescript
   // Use type guards for runtime validation
   const isBenchmarkCase = (obj: any): obj is BenchmarkCase => {
     return obj && 
            typeof obj.name === 'string' && 
            typeof obj.fn === 'function';
   };
   
   const addSafeBenchmark = (suite: BenchmarkSuite, benchmark: unknown) => {
     if (isBenchmarkCase(benchmark)) {
       suite.addBenchmark(benchmark);
     } else {
       throw new Error('Invalid benchmark case');
     }
   };
   ```

2. **Configuration schemas**
   ```typescript
   // Use runtime schema validation
   import Joi from 'joi';
   
   const configSchema = Joi.object({
     iterations: Joi.number().integer().min(1),
     timeout: Joi.number().integer().min(1000),
     parallel: Joi.object({
       enabled: Joi.boolean(),
       maxConcurrency: Joi.number().integer().min(1),
     }),
   });
   
   const validateConfig = (config: unknown) => {
     const { error, value } = configSchema.validate(config);
     if (error) {
       throw new BenchmarkValidationError(error.message);
     }
     return value as BenchmarkConfig;
   };
   ```

## Environment Issues

### Platform Compatibility

**Symptoms:**
- Benchmarks fail on specific operating systems
- Different results across platforms
- Platform-specific API errors

**Solutions:**

1. **Platform detection and adaptation**
   ```typescript
   const getPlatformConfig = (): Partial<BenchmarkConfig> => {
     const platform = process.platform;
     
     switch (platform) {
       case 'win32':
         return {
           profiling: {
             captureStackTraces: false, // May not work reliably on Windows
             sampleInterval: 200, // Higher interval on Windows
           },
         };
       
       case 'darwin':
         return {
           profiling: {
             enableBottleneckDetection: true,
             captureStackTraces: true,
           },
         };
       
       default:
         return {
           profiling: {
             enabled: true,
           },
         };
     }
   };
   ```

2. **Graceful feature degradation**
   ```typescript
   const createPlatformAwareProfiler = () => {
     const baseConfig = {
       enabled: true,
       captureSystemMetrics: true,
     };
     
     // Test feature availability
     const features = {
       stackTraces: testStackTraceCapture(),
       gcEvents: testGCEventCapture(),
       cpuProfiling: testCPUProfiling(),
     };
     
     return createBenchmarkProfiler({
       ...baseConfig,
       captureStackTraces: features.stackTraces,
       captureGCEvents: features.gcEvents,
       captureCPUProfile: features.cpuProfiling,
     });
   };
   ```

### Node.js Version Compatibility

**Symptoms:**
- APIs not available in older Node.js versions
- Performance differences across versions
- Version-specific bugs

**Solutions:**

1. **Version checking**
   ```typescript
   const checkNodeVersion = () => {
     const nodeVersion = process.version;
     const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
     
     if (majorVersion < 14) {
       console.warn('Node.js 14+ recommended for optimal performance');
     }
     
     return {
       supportsWorkerThreads: majorVersion >= 12,
       supportsPerformanceObserver: majorVersion >= 8,
       supportsHeapSnapshot: majorVersion >= 14,
     };
   };
   ```

2. **Version-specific configurations**
   ```typescript
   const getVersionSpecificConfig = (): Partial<BenchmarkConfig> => {
     const capabilities = checkNodeVersion();
     
     return {
       parallel: {
         enabled: capabilities.supportsWorkerThreads,
       },
       profiling: {
         captureMemorySnapshots: capabilities.supportsHeapSnapshot,
         captureGCEvents: capabilities.supportsPerformanceObserver,
       },
     };
   };
   ```

## Debug Tools

### Enabling Debug Mode

```typescript
// Enable comprehensive debugging
process.env.DEBUG = 'tw-enigma:benchmark*';
process.env.LOG_LEVEL = 'debug';

// Or programmatically
import { enableBenchmarkDebug } from '@tw-enigma/core/benchmarking';
enableBenchmarkDebug(true);
```

### Debug Configuration

```typescript
const debugConfig: BenchmarkConfig = {
  debug: {
    captureStackTraces: true,
    trackResourceUsage: true,
    logDetailedTiming: true,
    enableVerboseLogging: true,
  },
};
```

### Custom Debug Runner

```typescript
import { DebugBenchmarkRunner } from '@tw-enigma/core/benchmarking';

const debugRunner = new DebugBenchmarkRunner(debugConfig);

// Enable detailed event logging
debugRunner.on('*', (event, data) => {
  console.log(`[DEBUG] ${event}:`, data);
});
```

### Memory Debug Tools

```typescript
// Track memory usage over time
const trackMemory = () => {
  const usage = process.memoryUsage();
  console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
};

setInterval(trackMemory, 1000);

// Force garbage collection (if --expose-gc flag is used)
const forceGC = () => {
  if (global.gc) {
    console.log('Forcing garbage collection...');
    global.gc();
  }
};
```

### Performance Debug Tools

```typescript
// Detailed timing analysis
const createTimingProfiler = () => {
  const timings = new Map<string, number>();
  
  return {
    start: (label: string) => {
      timings.set(label, performance.now());
    },
    end: (label: string) => {
      const start = timings.get(label);
      if (start) {
        const duration = performance.now() - start;
        console.log(`[TIMING] ${label}: ${duration.toFixed(2)}ms`);
        timings.delete(label);
      }
    },
  };
};
```

## FAQ

### Q: Why are my benchmark results inconsistent?

**A:** Inconsistent results can be caused by:
- Insufficient warmup iterations
- Environmental factors (CPU throttling, background processes)
- Non-deterministic code (random numbers, async timing)
- Small sample sizes

Try increasing warmup iterations, running in a clean environment, and using more iterations.

### Q: How do I benchmark async operations correctly?

**A:** Use async benchmark functions and ensure proper awaiting:

```typescript
// Correct
suite.addBenchmark({
  name: 'Async Operation',
  fn: async () => {
    return await myAsyncOperation();
  },
});

// Incorrect - doesn't wait for completion
suite.addBenchmark({
  name: 'Async Operation',
  fn: () => {
    return myAsyncOperation(); // Returns Promise, not result
  },
});
```

### Q: Should I include setup/teardown time in measurements?

**A:** No, setup and teardown should not be included in timing measurements. Use the `setup` and `teardown` hooks:

```typescript
suite.addBenchmark({
  setup: async () => {
    // Preparation code (not timed)
    await prepareTestData();
  },
  fn: () => {
    // Only this is timed
    return processTestData();
  },
  teardown: async () => {
    // Cleanup code (not timed)
    await cleanupTestData();
  },
});
```

### Q: How do I handle benchmarks that modify global state?

**A:** Use proper isolation and cleanup:

```typescript
const originalState = getGlobalState();

suite.addBenchmark({
  setup: () => {
    resetGlobalState();
  },
  fn: () => {
    // Code that modifies global state
    return operationThatModifiesGlobals();
  },
  teardown: () => {
    restoreGlobalState(originalState);
  },
});
```

### Q: What's the difference between iterations and warmup iterations?

**A:** 
- **Warmup iterations** prepare the JavaScript engine (JIT compilation, optimization) but results are discarded
- **Iterations** are the actual measurements used for statistical analysis

Use enough warmup iterations (10-20) for JIT optimization, and enough iterations (50-100) for statistical significance.

### Q: How do I benchmark memory usage?

**A:** Use the memory benchmark runner or track memory manually:

```typescript
import { MemoryBenchmarkRunner } from '@tw-enigma/core/benchmarking';

const runner = new MemoryBenchmarkRunner({
  captureHeapSnapshots: true,
  trackAllocations: true,
});

// Or manually
suite.addBenchmark({
  fn: () => {
    const before = process.memoryUsage().heapUsed;
    const result = memoryIntensiveOperation();
    const after = process.memoryUsage().heapUsed;
    
    return {
      result,
      memoryDelta: after - before,
    };
  },
});
```

### Q: Can I run benchmarks in parallel?

**A:** Yes, but with caveats:

```typescript
const config: BenchmarkConfig = {
  parallel: {
    enabled: true,
    maxConcurrency: 4,
    isolateMemory: true, // Important for accurate memory measurements
  },
};
```

Parallel execution can improve speed but may affect accuracy if benchmarks compete for resources.

### Q: How do I compare performance across different implementations?

**A:** Use comparative benchmarking:

```typescript
import { ComparativeBenchmarkRunner } from '@tw-enigma/core/benchmarking';

const runner = new ComparativeBenchmarkRunner();
const comparison = await runner.compare([
  { name: 'Implementation A', suite: suiteA },
  { name: 'Implementation B', suite: suiteB },
]);

console.log('Winner:', comparison.winner);
console.log('Improvement:', comparison.improvement);
```

For more detailed troubleshooting, enable debug mode and check the logs for specific error messages and performance data.