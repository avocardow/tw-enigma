# TW-Enigma Benchmarking API Reference

Complete API documentation for the TW-Enigma Performance Benchmarking System.

## Table of Contents

- [Core Classes](#core-classes)
- [Interfaces](#interfaces)
- [Types](#types)
- [Factory Functions](#factory-functions)
- [Utilities](#utilities)
- [Error Handling](#error-handling)

## Core Classes

### BenchmarkRunner

Orchestrates benchmark execution and manages the benchmarking lifecycle.

```typescript
class BenchmarkRunner {
  constructor(config?: BenchmarkConfig, profiler?: BenchmarkProfiler);
  
  // Core execution methods
  async runBenchmark(benchmark: BenchmarkCase): Promise<BenchmarkResult>;
  async runSuite(suite: BenchmarkSuite): Promise<BenchmarkResult[]>;
  async runSuites(suites: BenchmarkSuite[], options?: RunOptions): Promise<BenchmarkResult[]>;
  
  // Lifecycle management
  async initialize(): Promise<void>;
  async cleanup(): Promise<void>;
  
  // Result management
  getLastResults(): BenchmarkResult[];
  getProfilingData(): BenchmarkProfilingData[];
  
  // Configuration
  updateConfig(config: Partial<BenchmarkConfig>): void;
  getConfig(): BenchmarkConfig;
  
  // Event handling
  on(event: BenchmarkEvent, handler: EventHandler): void;
  off(event: BenchmarkEvent, handler: EventHandler): void;
  emit(event: BenchmarkEvent, data: any): void;
}
```

#### Constructor Parameters

- `config?: BenchmarkConfig` - Optional configuration object
- `profiler?: BenchmarkProfiler` - Optional profiler instance for performance analysis

#### Methods

##### `runBenchmark(benchmark: BenchmarkCase): Promise<BenchmarkResult>`

Executes a single benchmark case.

**Parameters:**
- `benchmark: BenchmarkCase` - The benchmark case to execute

**Returns:** `Promise<BenchmarkResult>` - Results of the benchmark execution

**Example:**
```typescript
const runner = new BenchmarkRunner();
const result = await runner.runBenchmark({
  name: 'CSS Parsing Test',
  fn: () => parseCSS(testInput)
});
```

##### `runSuite(suite: BenchmarkSuite): Promise<BenchmarkResult[]>`

Executes all benchmarks in a suite.

**Parameters:**
- `suite: BenchmarkSuite` - The benchmark suite to execute

**Returns:** `Promise<BenchmarkResult[]>` - Array of results from all benchmarks

##### `runSuites(suites: BenchmarkSuite[], options?: RunOptions): Promise<BenchmarkResult[]>`

Executes multiple benchmark suites with optional filtering and parallel execution.

**Parameters:**
- `suites: BenchmarkSuite[]` - Array of benchmark suites
- `options?: RunOptions` - Optional execution options

**Returns:** `Promise<BenchmarkResult[]>` - Combined results from all suites

### BenchmarkSuite

Container for related benchmark cases with shared setup and teardown.

```typescript
class BenchmarkSuite {
  constructor(config: BenchmarkSuiteConfig);
  
  // Benchmark management
  addBenchmark(benchmark: BenchmarkCase): void;
  removeBenchmark(name: string): boolean;
  getBenchmark(name: string): BenchmarkCase | undefined;
  getBenchmarks(): BenchmarkCase[];
  
  // Filtering and organization
  filter(predicate: (benchmark: BenchmarkCase) => boolean): BenchmarkCase[];
  findByTag(tag: string): BenchmarkCase[];
  findByName(pattern: string | RegExp): BenchmarkCase[];
  
  // Lifecycle
  async setup(): Promise<void>;
  async teardown(): Promise<void>;
  
  // Properties
  readonly name: string;
  readonly description?: string;
  readonly tags: string[];
  readonly config: BenchmarkSuiteConfig;
}
```

### ResultAnalyzer

Analyzes benchmark results and provides statistical insights.

```typescript
class ResultAnalyzer {
  constructor(config?: AnalysisConfig);
  
  // Core analysis
  analyze(results: BenchmarkResult[]): AnalysisReport;
  analyzeComparative(groups: BenchmarkResultGroup[]): ComparativeAnalysis;
  
  // Statistical analysis
  calculateStatistics(results: BenchmarkResult[]): StatisticalSummary;
  detectOutliers(results: BenchmarkResult[]): OutlierAnalysis;
  analyzeDistribution(results: BenchmarkResult[]): DistributionAnalysis;
  
  // Comparison
  compareWithBaseline(current: BenchmarkResult[], baseline: BenchmarkResult[]): ComparisonReport;
  detectRegressions(current: BenchmarkResult[], baseline: BenchmarkResult[]): RegressionReport;
  
  // Reporting
  generateReport(analysis: AnalysisReport, format?: ReportFormat): string;
  generateSummary(analysis: AnalysisReport): string;
  
  // Trend analysis
  analyzeTrends(historicalResults: BenchmarkResult[][]): TrendAnalysis;
  projectPerformance(trends: TrendAnalysis, periods: number): PerformanceProjection;
}
```

### BenchmarkProfiler

Captures detailed performance metrics during benchmark execution.

```typescript
class BenchmarkProfiler extends EventEmitter implements IPerformanceProfiler {
  constructor(config?: BenchmarkProfilingConfig);
  
  // IPerformanceProfiler implementation
  readonly name: string;
  enabled: boolean;
  
  async start(context: BenchmarkContext): Promise<void>;
  async stop(context: BenchmarkContext): Promise<ProfilerData>;
  analyze(data: ProfilerData[]): PerformanceAnalysis;
  
  // Profiling control
  pause(): void;
  resume(): void;
  reset(): void;
  
  // Data access
  getCurrentData(): BenchmarkProfilingData | undefined;
  getHistoricalData(): BenchmarkProfilingData[];
  
  // Configuration
  updateConfig(config: Partial<BenchmarkProfilingConfig>): void;
  getConfig(): BenchmarkProfilingConfig;
  
  // Export
  async exportData(format: ExportFormat): Promise<Buffer>;
  async exportReport(): Promise<string>;
}
```

### BottleneckAnalyzer

Advanced analysis engine for identifying and analyzing performance bottlenecks.

```typescript
class BottleneckAnalyzer {
  constructor(config?: BottleneckAnalysisConfig);
  
  // Analysis methods
  async analyzeBottlenecks(
    profilingData: BenchmarkProfilingData[],
    baselineData?: BenchmarkProfilingData[]
  ): Promise<BottleneckAnalysisReport>;
  
  async analyzeRealTime(
    snapshot: ResourceSnapshot,
    context: { benchmarkName: string; timestamp: number }
  ): Promise<DetailedBottleneck[]>;
  
  // Configuration
  updateConfig(config: Partial<BottleneckAnalysisConfig>): void;
  getConfig(): BottleneckAnalysisConfig;
  
  // Data management
  clearHistory(): void;
  getBottleneckHistory(operation: string): DetailedBottleneck[];
}
```

### ProfilingExporter

Multi-format exporter for profiling data and analysis results.

```typescript
class ProfilingExporter {
  constructor(config?: ProfilingExportConfig);
  
  // Export methods
  async exportProfilingData(
    data: BenchmarkProfilingData[],
    analysis?: BottleneckAnalysisReport,
    customConfig?: Partial<ProfilingExportConfig>
  ): Promise<ExportResult[]>;
  
  async exportBatch(batch: Omit<ExportBatch, 'id' | 'results'>): Promise<ExportBatch>;
  
  // Format registration
  registerCustomFormatter(formatter: CustomFormatter): void;
  
  // Configuration
  updateConfig(config: Partial<ProfilingExportConfig>): void;
  getConfig(): ProfilingExportConfig;
}
```

## Interfaces

### BenchmarkCase

Defines a single benchmark test case.

```typescript
interface BenchmarkCase {
  // Required fields
  name: string;
  fn: BenchmarkFunction;
  
  // Optional metadata
  description?: string;
  tags?: string[];
  
  // Execution configuration
  iterations?: number;
  timeout?: number;
  warmupIterations?: number;
  
  // Lifecycle hooks
  setup?(): Promise<void> | void;
  teardown?(): Promise<void> | void;
  beforeEach?(): Promise<void> | void;
  afterEach?(): Promise<void> | void;
  
  // Advanced options
  parameters?: any[];
  metrics?: MetricConfiguration;
  validation?: ValidationConfig;
  
  // Environment requirements
  requirements?: {
    minMemory?: number;
    platform?: string[];
    nodeVersion?: string;
  };
}
```

### BenchmarkFunction

Type definition for benchmark functions.

```typescript
type BenchmarkFunction = 
  | (() => any)
  | (() => Promise<any>)
  | ((parameter: any) => any)
  | ((parameter: any) => Promise<any>);
```

### BenchmarkResult

Contains the results of a benchmark execution.

```typescript
interface BenchmarkResult {
  // Identification
  name: string;
  suite?: string;
  timestamp: number;
  
  // Execution data
  success: boolean;
  error?: Error;
  duration: number;
  iterations: number;
  
  // Performance metrics
  metrics: {
    mean: number;
    median: number;
    min: number;
    max: number;
    standardDeviation: number;
    variance: number;
    
    // System metrics
    memoryUsage: MemoryUsage;
    cpuUsage: CPUUsage;
    
    // Custom metrics
    custom?: Record<string, number>;
  };
  
  // Statistical data
  statistics: {
    samples: number[];
    outliers: number[];
    confidenceInterval: [number, number];
    marginOfError: number;
  };
  
  // Execution context
  context: {
    nodeVersion: string;
    platform: string;
    architecture: string;
    memoryLimit: number;
    environment: Record<string, string>;
  };
  
  // Profiling data (if enabled)
  profiling?: BenchmarkProfilingData;
}
```

### BenchmarkConfig

Configuration options for benchmark execution.

```typescript
interface BenchmarkConfig {
  // Execution parameters
  iterations?: number;
  warmupIterations?: number;
  timeout?: number;
  memoryLimit?: number;
  
  // Output configuration
  outputDirectory?: string;
  
  // Parallel execution
  parallel?: {
    enabled: boolean;
    maxConcurrency: number;
    isolateMemory: boolean;
    isolateProcess: boolean;
  };
  
  // Statistical analysis
  statistics?: {
    enableOutlierDetection: boolean;
    confidenceLevel: number;
    minimumSampleSize: number;
    outlierThreshold: number;
  };
  
  // Profiling configuration
  profiling?: BenchmarkProfilingConfig;
  
  // Environment validation
  validation?: {
    checkSystemRequirements: boolean;
    validateEnvironment: boolean;
    enforceConsistency: boolean;
    requireCleanEnvironment: boolean;
  };
  
  // Reporting
  reporting?: {
    formats: ReportFormat[];
    includeSystemInfo: boolean;
    includeDetailedMetrics: boolean;
    includeProfilingData: boolean;
    generateSummary: boolean;
  };
  
  // Cleanup
  cleanup?: {
    forceGC: boolean;
    clearModuleCache: boolean;
    resetGlobalState: boolean;
  };
  
  // Debug options
  debug?: {
    captureStackTraces: boolean;
    trackResourceUsage: boolean;
    logDetailedTiming: boolean;
    enableVerboseLogging: boolean;
  };
}
```

### BenchmarkProfilingConfig

Configuration for profiling during benchmark execution.

```typescript
interface BenchmarkProfilingConfig {
  enabled: boolean;
  
  // Metric capture options
  captureSystemMetrics: boolean;
  captureMemorySnapshots: boolean;
  captureCPUProfile: boolean;
  captureIOMetrics: boolean;
  captureGCEvents: boolean;
  captureEventLoopLag: boolean;
  captureStackTraces: boolean;
  
  // Sampling configuration
  sampleInterval: number;
  maxSamples: number;
  
  // Export options
  exportFormats: ExportFormat[];
  outputDirectory: string;
  
  // Analysis options
  enableBottleneckDetection: boolean;
  bottleneckThreshold: number;
  enableRealTimeAnalysis: boolean;
  retainRawData: boolean;
}
```

## Types

### ExportFormat

Supported export formats for profiling data.

```typescript
type ExportFormat = 
  | 'json'
  | 'csv'
  | 'flamegraph'
  | 'chrome-trace'
  | 'speedscope'
  | 'pprof'
  | 'jaeger'
  | 'opentelemetry'
  | 'perfetto'
  | 'html-report'
  | 'markdown-report'
  | 'pdf-report';
```

### ReportFormat

Available report formats for benchmark results.

```typescript
type ReportFormat = 'json' | 'html' | 'markdown' | 'csv' | 'text';
```

### BenchmarkEvent

Events emitted during benchmark execution.

```typescript
type BenchmarkEvent = 
  | 'benchmark-start'
  | 'benchmark-end'
  | 'benchmark-error'
  | 'suite-start'
  | 'suite-end'
  | 'profiler-started'
  | 'profiler-stopped'
  | 'bottleneck-detected'
  | 'regression-detected';
```

### MemoryUsage

Memory usage metrics.

```typescript
interface MemoryUsage {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}
```

### CPUUsage

CPU usage metrics.

```typescript
interface CPUUsage {
  user: number;
  system: number;
  percent: number;
}
```

## Factory Functions

### createBenchmarkSuite

Creates a new benchmark suite with the given configuration.

```typescript
function createBenchmarkSuite(config: BenchmarkSuiteConfig): BenchmarkSuite;
```

**Parameters:**
- `config: BenchmarkSuiteConfig` - Suite configuration

**Returns:** `BenchmarkSuite` - New benchmark suite instance

**Example:**
```typescript
const suite = createBenchmarkSuite({
  name: 'CSS Processing Tests',
  description: 'Performance tests for CSS processing operations',
  tags: ['css', 'performance'],
});
```

### createBenchmarkProfiler

Creates a benchmark profiler with the specified configuration.

```typescript
function createBenchmarkProfiler(config?: Partial<BenchmarkProfilingConfig>): BenchmarkProfiler;
```

**Variants:**
```typescript
function createCIBenchmarkProfiler(): BenchmarkProfiler;
function createDevelopmentBenchmarkProfiler(): BenchmarkProfiler;
```

### createBottleneckAnalyzer

Creates a bottleneck analyzer with the specified configuration.

```typescript
function createBottleneckAnalyzer(config?: Partial<BottleneckAnalysisConfig>): BottleneckAnalyzer;
```

**Variants:**
```typescript
function createCIBottleneckAnalyzer(): BottleneckAnalyzer;
function createDevelopmentBottleneckAnalyzer(): BottleneckAnalyzer;
```

### createProfilingExporter

Creates a profiling data exporter with the specified configuration.

```typescript
function createProfilingExporter(config?: Partial<ProfilingExportConfig>): ProfilingExporter;
```

**Variants:**
```typescript
function createCIProfilingExporter(): ProfilingExporter;
function createDevelopmentProfilingExporter(): ProfilingExporter;
```

## Utilities

### Benchmark Utilities

```typescript
// Time measurement utilities
function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }>;
function measureSync<T>(fn: () => T): { result: T; duration: number };

// Memory utilities
function getMemoryUsage(): MemoryUsage;
function forceGarbageCollection(): void;
function createMemorySnapshot(): MemorySnapshot;

// Statistical utilities
function calculateStatistics(samples: number[]): StatisticalSummary;
function detectOutliers(samples: number[], threshold?: number): number[];
function calculateConfidenceInterval(samples: number[], confidence: number): [number, number];

// Validation utilities
function validateBenchmarkCase(benchmark: BenchmarkCase): ValidationResult;
function validateEnvironment(): EnvironmentValidation;
function checkSystemRequirements(requirements: SystemRequirements): boolean;
```

### Result Utilities

```typescript
// Result comparison
function compareBenchmarkResults(a: BenchmarkResult, b: BenchmarkResult): ComparisonResult;
function findRegressions(current: BenchmarkResult[], baseline: BenchmarkResult[]): RegressionResult[];

// Result filtering
function filterByTag(results: BenchmarkResult[], tag: string): BenchmarkResult[];
function filterByPerformance(results: BenchmarkResult[], threshold: number): BenchmarkResult[];
function filterBySuccess(results: BenchmarkResult[]): BenchmarkResult[];

// Result aggregation
function aggregateResults(results: BenchmarkResult[]): AggregatedResult;
function groupByTag(results: BenchmarkResult[]): Map<string, BenchmarkResult[]>;
function summarizeResults(results: BenchmarkResult[]): ResultSummary;
```

### Export Utilities

```typescript
// Format converters
function convertToJSON(data: any): string;
function convertToCSV(results: BenchmarkResult[]): string;
function convertToHTML(analysis: AnalysisReport): string;

// File utilities
function saveResults(results: BenchmarkResult[], path: string): Promise<void>;
function loadResults(path: string): Promise<BenchmarkResult[]>;
function archiveResults(results: BenchmarkResult[], archivePath: string): Promise<void>;
```

## Error Handling

### Error Types

```typescript
class BenchmarkError extends Error {
  constructor(message: string, public readonly code: string, public readonly context?: any);
}

class BenchmarkTimeoutError extends BenchmarkError {
  constructor(timeout: number, elapsed: number);
}

class BenchmarkMemoryError extends BenchmarkError {
  constructor(limit: number, used: number);
}

class BenchmarkValidationError extends BenchmarkError {
  constructor(validation: ValidationResult);
}

class ProfilingError extends BenchmarkError {
  constructor(message: string, public readonly profilerName: string);
}
```

### Error Codes

```typescript
enum BenchmarkErrorCode {
  TIMEOUT = 'BENCHMARK_TIMEOUT',
  MEMORY_LIMIT = 'MEMORY_LIMIT_EXCEEDED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SETUP_FAILED = 'SETUP_FAILED',
  TEARDOWN_FAILED = 'TEARDOWN_FAILED',
  PROFILING_FAILED = 'PROFILING_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  ENVIRONMENT_ERROR = 'ENVIRONMENT_ERROR',
}
```

### Error Handling Patterns

```typescript
// Basic error handling
try {
  const results = await runner.runSuite(suite);
} catch (error) {
  if (error instanceof BenchmarkTimeoutError) {
    console.log(`Benchmark timed out after ${error.elapsed}ms`);
  } else if (error instanceof BenchmarkMemoryError) {
    console.log(`Memory limit exceeded: ${error.used} > ${error.limit}`);
  } else {
    console.error('Benchmark failed:', error.message);
  }
}

// With error recovery
const runner = new BenchmarkRunner({
  errorHandling: {
    retryOnFailure: true,
    maxRetries: 3,
    continueOnError: true,
    logErrors: true,
  },
});

// Error event handling
runner.on('benchmark-error', (error, benchmark) => {
  console.error(`Benchmark ${benchmark.name} failed:`, error.message);
});
```

## Type Guards

```typescript
// Type guard utilities
function isBenchmarkResult(obj: any): obj is BenchmarkResult;
function isBenchmarkError(error: any): error is BenchmarkError;
function isProfilingData(obj: any): obj is BenchmarkProfilingData;
function isBottleneckAnalysis(obj: any): obj is BottleneckAnalysisReport;

// Validation helpers
function validateBenchmarkResult(result: any): asserts result is BenchmarkResult;
function validateBenchmarkConfig(config: any): asserts config is BenchmarkConfig;
```

## Version Compatibility

The API follows semantic versioning. Breaking changes are indicated by major version bumps.

### Current Version: 1.0.0

- Initial stable API release
- Full TypeScript support
- Comprehensive profiling and analysis features
- Multi-format export capabilities

### Migration Guides

See [MIGRATION.md](./MIGRATION.md) for guides on upgrading between major versions.

## Examples

For complete usage examples, see:
- [Basic API Usage](../examples/api-basic-usage.ts)
- [Advanced Configuration](../examples/api-advanced-config.ts)
- [Custom Profiling](../examples/api-custom-profiling.ts)
- [Error Handling](../examples/api-error-handling.ts)
- [Type Safety](../examples/api-type-safety.ts)