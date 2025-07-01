/**
 * Performance Simulator
 * Simulates large-scale operations and benchmarks dry run system performance
 */

import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { DryRunManager, createDryRunConfig } from './dryRunManager';
import { getDryRunReportGenerator } from './reportGenerator';
import { getVisualDiffGenerator } from './visualDiff';
import { getImpactEstimator } from './impactEstimator';
import { getOutputManager } from './outputManager';
import type { DryRunResult, DryRunOperation } from './dryRunManager';

export interface PerformanceTestScenario {
  /** Scenario name */
  name: string;
  /** Scenario description */
  description: string;
  /** Number of files to simulate */
  fileCount: number;
  /** Number of operations per file */
  operationsPerFile: number;
  /** Average file size in bytes */
  averageFileSize: number;
  /** Complexity multiplier (1-10) */
  complexityMultiplier: number;
  /** Include dependency analysis */
  includeDependencies: boolean;
  /** Include visual diff generation */
  includeVisualDiff: boolean;
  /** Include impact estimation */
  includeImpactEstimation: boolean;
  /** Include report generation */
  includeReportGeneration: boolean;
  /** Include output management */
  includeOutputManagement: boolean;
}

export interface PerformanceMetrics {
  /** Test scenario */
  scenario: PerformanceTestScenario;
  /** Overall execution time (ms) */
  totalExecutionTime: number;
  /** Memory usage statistics */
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
    delta: number;
  };
  /** CPU usage statistics */
  cpuUsage: {
    userTime: number;
    systemTime: number;
    utilization: number;
  };
  /** Component timing breakdown */
  componentTiming: {
    dryRunExecution: number;
    reportGeneration?: number;
    visualDiffGeneration?: number;
    impactEstimation?: number;
    outputManagement?: number;
  };
  /** Throughput metrics */
  throughput: {
    operationsPerSecond: number;
    filesPerSecond: number;
    bytesPerSecond: number;
  };
  /** Error and warning counts */
  issues: {
    errors: number;
    warnings: number;
    timeouts: number;
  };
  /** Resource utilization */
  resources: {
    diskSpace: number;
    networkRequests: number;
    fileHandles: number;
  };
}

export interface BenchmarkResult {
  /** Test timestamp */
  timestamp: number;
  /** Test environment */
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    totalMemory: number;
    cpuCount: number;
    cpuModel: string;
  };
  /** All test scenarios */
  scenarios: PerformanceMetrics[];
  /** Aggregate statistics */
  aggregate: {
    totalTests: number;
    totalDuration: number;
    averageExecutionTime: number;
    averageMemoryUsage: number;
    averageThroughput: number;
    successRate: number;
  };
  /** Performance regression analysis */
  regression?: {
    previousResults?: BenchmarkResult;
    regressions: {
      component: string;
      metric: string;
      previousValue: number;
      currentValue: number;
      changePercentage: number;
      severity: 'minor' | 'moderate' | 'major';
    }[];
  };
}

export class PerformanceSimulationError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly scenario?: string
  ) {
    super(message);
    this.name = 'PerformanceSimulationError';
  }
}

export class PerformanceSimulator {
  private logger: Logger;
  private dryRunManager: DryRunManager;
  private tempDir: string;

  constructor() {
    this.logger = new Logger({ component: 'PerformanceSimulator' });
    this.dryRunManager = new DryRunManager();
    this.tempDir = path.join(os.tmpdir(), 'tw-enigma-perf-test');
  }

  /**
   * Run comprehensive performance benchmark
   */
  async runBenchmark(
    scenarios: PerformanceTestScenario[] = this.getDefaultScenarios(),
    options: {
      iterations?: number;
      warmupRuns?: number;
      compareWithPrevious?: boolean;
      saveResults?: boolean;
      outputPath?: string;
    } = {}
  ): Promise<BenchmarkResult> {
    const {
      iterations = 1,
      warmupRuns = 1,
      compareWithPrevious = false,
      saveResults = true,
      outputPath = './performance-results.json',
    } = options;

    try {
      this.logger.info('Starting performance benchmark', {
        scenarios: scenarios.length,
        iterations,
        warmupRuns,
      });

      await this.setupTestEnvironment();

      // Warmup runs
      if (warmupRuns > 0) {
        this.logger.debug('Running warmup iterations', { warmupRuns });
        for (let i = 0; i < warmupRuns; i++) {
          for (const scenario of scenarios.slice(0, 1)) { // Only warmup with first scenario
            await this.runScenario(scenario);
          }
        }
      }

      // Actual benchmark runs
      const allMetrics: PerformanceMetrics[] = [];
      
      for (const scenario of scenarios) {
        this.logger.info('Running scenario', { 
          name: scenario.name,
          fileCount: scenario.fileCount,
          operations: scenario.fileCount * scenario.operationsPerFile,
        });

        const scenarioMetrics: PerformanceMetrics[] = [];
        
        for (let iteration = 0; iteration < iterations; iteration++) {
          const metrics = await this.runScenario(scenario);
          scenarioMetrics.push(metrics);
        }

        // Average results across iterations
        const avgMetrics = this.averageMetrics(scenarioMetrics);
        allMetrics.push(avgMetrics);
      }

      const result = await this.generateBenchmarkResult(allMetrics, compareWithPrevious, outputPath);

      if (saveResults) {
        await this.saveBenchmarkResult(result, outputPath);
      }

      await this.cleanupTestEnvironment();

      this.logger.info('Performance benchmark completed', {
        totalTests: allMetrics.length,
        totalDuration: result.aggregate.totalDuration,
        successRate: result.aggregate.successRate,
      });

      return result;
    } catch (error) {
      this.logger.error('Performance benchmark failed', { error });
      await this.cleanupTestEnvironment();
      throw new PerformanceSimulationError(
        'Benchmark execution failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Run a single performance test scenario
   */
  async runScenario(scenario: PerformanceTestScenario): Promise<PerformanceMetrics> {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory;
    
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage();
      if (current.heapUsed > peakMemory.heapUsed) {
        peakMemory = current;
      }
    }, 100);

    try {
      // Generate test data
      const { operations, projectContext } = await this.generateTestData(scenario);

      // Component timing tracking
      const timing: PerformanceMetrics['componentTiming'] = {
        dryRunExecution: 0,
      };

      // Execute dry run
      const dryRunStart = performance.now();
      const config = createDryRunConfig({
        enabled: true,
        maxOperations: operations.length,
        logOperations: false,
        validateOperations: true,
      });

      const dryRunResult = await this.simulateDryRun(operations, config);
      timing.dryRunExecution = performance.now() - dryRunStart;

      // Optional components
      if (scenario.includeReportGeneration) {
        const reportStart = performance.now();
        const reportGenerator = getDryRunReportGenerator();
        await reportGenerator.generateReport(dryRunResult);
        timing.reportGeneration = performance.now() - reportStart;
      }

      if (scenario.includeVisualDiff) {
        const diffStart = performance.now();
        const diffGenerator = getVisualDiffGenerator();
        await diffGenerator.generateDiff(dryRunResult);
        timing.visualDiffGeneration = performance.now() - diffStart;
      }

      if (scenario.includeImpactEstimation) {
        const impactStart = performance.now();
        const impactEstimator = getImpactEstimator();
        await impactEstimator.estimateImpact(dryRunResult, projectContext);
        timing.impactEstimation = performance.now() - impactStart;
      }

      if (scenario.includeOutputManagement) {
        const outputStart = performance.now();
        const outputManager = getOutputManager();
        await outputManager.outputCombinedResults(
          { dryRunResult },
          {
            destinations: [{ type: 'memory', key: 'perf-test' }],
            format: { type: 'json' },
            validate: false,
            backup: false,
            overwrite: true,
            createDirectories: false,
            timeout: 5000,
            retry: { attempts: 1, delay: 0 },
          }
        );
        timing.outputManagement = performance.now() - outputStart;
      }

      clearInterval(memoryMonitor);
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();

      const totalExecutionTime = endTime - startTime;
      const totalOperations = scenario.fileCount * scenario.operationsPerFile;
      const totalBytes = scenario.fileCount * scenario.averageFileSize;

      return {
        scenario,
        totalExecutionTime,
        memoryUsage: {
          initial: initialMemory.heapUsed,
          peak: peakMemory.heapUsed,
          final: finalMemory.heapUsed,
          delta: finalMemory.heapUsed - initialMemory.heapUsed,
        },
        cpuUsage: this.calculateCpuUsage(startTime, endTime),
        componentTiming: timing,
        throughput: {
          operationsPerSecond: totalOperations / (totalExecutionTime / 1000),
          filesPerSecond: scenario.fileCount / (totalExecutionTime / 1000),
          bytesPerSecond: totalBytes / (totalExecutionTime / 1000),
        },
        issues: {
          errors: dryRunResult.context.operations.filter(op => !op.wouldSucceed).length,
          warnings: 0, // Would count warnings from actual operations
          timeouts: 0,
        },
        resources: {
          diskSpace: totalBytes,
          networkRequests: 0, // Would count actual network requests
          fileHandles: scenario.fileCount,
        },
      };
    } catch (error) {
      clearInterval(memoryMonitor);
      throw new PerformanceSimulationError(
        `Scenario execution failed: ${scenario.name}`,
        error instanceof Error ? error : new Error(String(error)),
        scenario.name
      );
    }
  }

  /**
   * Generate test data for a scenario
   */
  private async generateTestData(scenario: PerformanceTestScenario): Promise<{
    operations: DryRunOperation[];
    projectContext: any;
  }> {
    const operations: DryRunOperation[] = [];
    const dependencies: any[] = [];

    // Generate files and operations
    for (let fileIndex = 0; fileIndex < scenario.fileCount; fileIndex++) {
      const filePath = this.generateFilePath(fileIndex, scenario);
      
      // Generate operations for this file
      for (let opIndex = 0; opIndex < scenario.operationsPerFile; opIndex++) {
        const operation: DryRunOperation = {
          id: `${fileIndex}-${opIndex}`,
          type: this.getRandomOperationType(),
          target: filePath,
          description: `Simulated operation ${opIndex + 1} on ${filePath}`,
          timestamp: Date.now() + opIndex,
          wouldSucceed: Math.random() > 0.05, // 5% failure rate
          sizeImpact: this.generateSizeImpact(scenario),
          metadata: {
            complexity: scenario.complexityMultiplier,
            synthetic: true,
          },
        };
        operations.push(operation);
      }

      // Generate dependency information
      if (scenario.includeDependencies && Math.random() > 0.7) {
        dependencies.push({
          path: filePath,
          dependencies: this.generateRandomDependencies(scenario.fileCount),
          dependents: this.generateRandomDependents(scenario.fileCount),
          depth: Math.floor(Math.random() * 5) + 1,
          criticality: Math.random(),
        });
      }
    }

    return {
      operations,
      projectContext: {
        totalFiles: scenario.fileCount * 2, // Assume twice as many files in project
        dependencies: scenario.includeDependencies ? dependencies : undefined,
        projectSize: scenario.fileCount * scenario.averageFileSize,
      },
    };
  }

  /**
   * Simulate dry run execution
   */
  private async simulateDryRun(
    operations: DryRunOperation[],
    config: any
  ): Promise<DryRunResult> {
    // Simulate processing time based on operation complexity
    const processingTime = operations.reduce((total, op) => {
      const baseTime = 1; // Base 1ms per operation
      const complexityMultiplier = (op.metadata?.complexity || 1);
      return total + baseTime * complexityMultiplier;
    }, 0);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.min(processingTime, 1000)));

    const totalSizeImpact = operations.reduce((sum, op) => sum + (op.sizeImpact || 0), 0);

    return {
      enabled: true,
      totalOperations: operations.length,
      duration: processingTime,
      context: {
        operations,
        config,
        startTime: Date.now() - processingTime,
        endTime: Date.now(),
      },
      summary: {
        successful: operations.filter(op => op.wouldSucceed).length,
        failed: operations.filter(op => !op.wouldSucceed).length,
        totalSizeImpact,
        estimatedDuration: processingTime,
        riskLevel: this.calculateRiskLevel(operations),
      },
    };
  }

  /**
   * Generate default test scenarios
   */
  private getDefaultScenarios(): PerformanceTestScenario[] {
    return [
      {
        name: 'Small Project',
        description: 'Typical small project with basic optimization',
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
        description: 'Medium-sized project with moderate complexity',
        fileCount: 200,
        operationsPerFile: 3,
        averageFileSize: 25 * 1024, // 25KB
        complexityMultiplier: 2,
        includeDependencies: true,
        includeVisualDiff: true,
        includeImpactEstimation: true,
        includeReportGeneration: true,
        includeOutputManagement: true,
      },
      {
        name: 'Large Project',
        description: 'Large project with high complexity',
        fileCount: 500,
        operationsPerFile: 4,
        averageFileSize: 50 * 1024, // 50KB
        complexityMultiplier: 3,
        includeDependencies: true,
        includeVisualDiff: true,
        includeImpactEstimation: true,
        includeReportGeneration: true,
        includeOutputManagement: true,
      },
      {
        name: 'Enterprise Scale',
        description: 'Enterprise-scale project stress test',
        fileCount: 1000,
        operationsPerFile: 5,
        averageFileSize: 100 * 1024, // 100KB
        complexityMultiplier: 5,
        includeDependencies: true,
        includeVisualDiff: false, // Too expensive for large scale
        includeImpactEstimation: true,
        includeReportGeneration: true,
        includeOutputManagement: false,
      },
      {
        name: 'Minimal Features',
        description: 'Only essential features enabled',
        fileCount: 100,
        operationsPerFile: 2,
        averageFileSize: 20 * 1024, // 20KB
        complexityMultiplier: 1,
        includeDependencies: false,
        includeVisualDiff: false,
        includeImpactEstimation: false,
        includeReportGeneration: false,
        includeOutputManagement: false,
      },
    ];
  }

  /**
   * Helper methods
   */
  private generateFilePath(index: number, scenario: PerformanceTestScenario): string {
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.html', '.json'];
    const directories = ['src', 'components', 'utils', 'styles', 'pages', 'hooks'];
    
    const dir = directories[index % directories.length];
    const ext = extensions[index % extensions.length];
    const fileNum = Math.floor(index / directories.length);
    
    return `${this.tempDir}/${dir}/file${fileNum}${ext}`;
  }

  private getRandomOperationType(): DryRunOperation['type'] {
    const types: DryRunOperation['type'][] = [
      'file-write', 'file-modify', 'file-delete',
      'directory-create', 'config-update', 'cache-clear'
    ];
    return types[Math.floor(Math.random() * types.length)];
  }

  private generateSizeImpact(scenario: PerformanceTestScenario): number {
    const baseSize = scenario.averageFileSize;
    const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
    return Math.floor(baseSize * (1 + variation));
  }

  private generateRandomDependencies(maxFiles: number): string[] {
    const count = Math.floor(Math.random() * 5);
    const deps: string[] = [];
    for (let i = 0; i < count; i++) {
      deps.push(`file${Math.floor(Math.random() * maxFiles)}.js`);
    }
    return deps;
  }

  private generateRandomDependents(maxFiles: number): string[] {
    const count = Math.floor(Math.random() * 8);
    const deps: string[] = [];
    for (let i = 0; i < count; i++) {
      deps.push(`file${Math.floor(Math.random() * maxFiles)}.js`);
    }
    return deps;
  }

  private calculateRiskLevel(operations: DryRunOperation[]): string {
    const failureRate = operations.filter(op => !op.wouldSucceed).length / operations.length;
    if (failureRate > 0.1) return 'high';
    if (failureRate > 0.05) return 'medium';
    return 'low';
  }

  private calculateCpuUsage(startTime: number, endTime: number): PerformanceMetrics['cpuUsage'] {
    const duration = endTime - startTime;
    // Simplified CPU usage calculation
    return {
      userTime: duration * 0.7,
      systemTime: duration * 0.3,
      utilization: Math.min(100, (duration / 1000) * 50), // Rough estimate
    };
  }

  private averageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    if (metrics.length === 0) throw new Error('No metrics to average');
    if (metrics.length === 1) return metrics[0];

    const avg = metrics[0]; // Start with first as template
    
    // Average numerical values
    avg.totalExecutionTime = metrics.reduce((sum, m) => sum + m.totalExecutionTime, 0) / metrics.length;
    avg.memoryUsage.peak = metrics.reduce((sum, m) => sum + m.memoryUsage.peak, 0) / metrics.length;
    avg.memoryUsage.delta = metrics.reduce((sum, m) => sum + m.memoryUsage.delta, 0) / metrics.length;
    avg.throughput.operationsPerSecond = metrics.reduce((sum, m) => sum + m.throughput.operationsPerSecond, 0) / metrics.length;

    return avg;
  }

  private async generateBenchmarkResult(
    scenarios: PerformanceMetrics[],
    compareWithPrevious: boolean,
    outputPath: string
  ): Promise<BenchmarkResult> {
    const aggregate = {
      totalTests: scenarios.length,
      totalDuration: scenarios.reduce((sum, s) => sum + s.totalExecutionTime, 0),
      averageExecutionTime: scenarios.reduce((sum, s) => sum + s.totalExecutionTime, 0) / scenarios.length,
      averageMemoryUsage: scenarios.reduce((sum, s) => sum + s.memoryUsage.peak, 0) / scenarios.length,
      averageThroughput: scenarios.reduce((sum, s) => sum + s.throughput.operationsPerSecond, 0) / scenarios.length,
      successRate: scenarios.reduce((sum, s) => sum + (1 - s.issues.errors / (s.scenario.fileCount * s.scenario.operationsPerFile)), 0) / scenarios.length,
    };

    let regression: BenchmarkResult['regression'] | undefined;
    if (compareWithPrevious) {
      regression = await this.analyzeRegression(scenarios, outputPath);
    }

    return {
      timestamp: Date.now(),
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: os.totalmem(),
        cpuCount: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
      },
      scenarios,
      aggregate,
      regression,
    };
  }

  private async analyzeRegression(
    currentScenarios: PerformanceMetrics[],
    outputPath: string
  ): Promise<BenchmarkResult['regression'] | undefined> {
    try {
      const previousResults = await this.loadPreviousResults(outputPath);
      if (!previousResults) return undefined;

      const regressions: BenchmarkResult['regression']['regressions'] = [];

      // Compare scenarios by name
      for (const current of currentScenarios) {
        const previous = previousResults.scenarios.find(s => s.scenario.name === current.scenario.name);
        if (!previous) continue;

        // Check execution time regression
        const timeChange = ((current.totalExecutionTime - previous.totalExecutionTime) / previous.totalExecutionTime) * 100;
        if (timeChange > 10) { // 10% slower
          regressions.push({
            component: current.scenario.name,
            metric: 'Execution Time',
            previousValue: previous.totalExecutionTime,
            currentValue: current.totalExecutionTime,
            changePercentage: timeChange,
            severity: timeChange > 50 ? 'major' : timeChange > 25 ? 'moderate' : 'minor',
          });
        }

        // Check memory regression
        const memoryChange = ((current.memoryUsage.peak - previous.memoryUsage.peak) / previous.memoryUsage.peak) * 100;
        if (memoryChange > 15) { // 15% more memory
          regressions.push({
            component: current.scenario.name,
            metric: 'Memory Usage',
            previousValue: previous.memoryUsage.peak,
            currentValue: current.memoryUsage.peak,
            changePercentage: memoryChange,
            severity: memoryChange > 50 ? 'major' : memoryChange > 30 ? 'moderate' : 'minor',
          });
        }
      }

      return {
        previousResults,
        regressions,
      };
    } catch (error) {
      this.logger.warn('Failed to analyze regression', { error });
      return undefined;
    }
  }

  private async loadPreviousResults(outputPath: string): Promise<BenchmarkResult | null> {
    try {
      const content = await fs.readFile(outputPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async saveBenchmarkResult(result: BenchmarkResult, outputPath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
      this.logger.info('Saved benchmark results', { outputPath });
    } catch (error) {
      this.logger.error('Failed to save benchmark results', { error, outputPath });
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      this.logger.debug('Set up test environment', { tempDir: this.tempDir });
    } catch (error) {
      throw new PerformanceSimulationError('Failed to setup test environment', error);
    }
  }

  private async cleanupTestEnvironment(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      this.logger.debug('Cleaned up test environment', { tempDir: this.tempDir });
    } catch (error) {
      this.logger.warn('Failed to cleanup test environment', { error, tempDir: this.tempDir });
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(result: BenchmarkResult): Promise<string> {
    let report = `# Performance Benchmark Report\n\n`;
    report += `**Generated:** ${new Date(result.timestamp).toISOString()}\n\n`;

    // Environment info
    report += `## Test Environment\n\n`;
    report += `- **Node.js:** ${result.environment.nodeVersion}\n`;
    report += `- **Platform:** ${result.environment.platform} (${result.environment.arch})\n`;
    report += `- **Memory:** ${Math.round(result.environment.totalMemory / 1024 / 1024 / 1024)} GB\n`;
    report += `- **CPU:** ${result.environment.cpuCount} cores - ${result.environment.cpuModel}\n\n`;

    // Aggregate results
    report += `## Overall Results\n\n`;
    report += `- **Total Tests:** ${result.aggregate.totalTests}\n`;
    report += `- **Total Duration:** ${Math.round(result.aggregate.totalDuration)}ms\n`;
    report += `- **Average Execution Time:** ${Math.round(result.aggregate.averageExecutionTime)}ms\n`;
    report += `- **Average Memory Usage:** ${Math.round(result.aggregate.averageMemoryUsage / 1024 / 1024)} MB\n`;
    report += `- **Average Throughput:** ${Math.round(result.aggregate.averageThroughput)} ops/sec\n`;
    report += `- **Success Rate:** ${Math.round(result.aggregate.successRate * 100)}%\n\n`;

    // Scenario details
    report += `## Scenario Results\n\n`;
    for (const scenario of result.scenarios) {
      report += `### ${scenario.scenario.name}\n\n`;
      report += `${scenario.scenario.description}\n\n`;
      report += `- **Files:** ${scenario.scenario.fileCount}\n`;
      report += `- **Operations:** ${scenario.scenario.fileCount * scenario.scenario.operationsPerFile}\n`;
      report += `- **Execution Time:** ${Math.round(scenario.totalExecutionTime)}ms\n`;
      report += `- **Memory Peak:** ${Math.round(scenario.memoryUsage.peak / 1024 / 1024)} MB\n`;
      report += `- **Throughput:** ${Math.round(scenario.throughput.operationsPerSecond)} ops/sec\n`;
      
      if (scenario.componentTiming.reportGeneration) {
        report += `- **Report Generation:** ${Math.round(scenario.componentTiming.reportGeneration)}ms\n`;
      }
      if (scenario.componentTiming.visualDiffGeneration) {
        report += `- **Visual Diff:** ${Math.round(scenario.componentTiming.visualDiffGeneration)}ms\n`;
      }
      if (scenario.componentTiming.impactEstimation) {
        report += `- **Impact Estimation:** ${Math.round(scenario.componentTiming.impactEstimation)}ms\n`;
      }
      
      report += `\n`;
    }

    // Regression analysis
    if (result.regression && result.regression.regressions.length > 0) {
      report += `## Performance Regressions\n\n`;
      report += `**Warning:** ${result.regression.regressions.length} performance regressions detected!\n\n`;
      
      for (const regression of result.regression.regressions) {
        report += `### ${regression.component} - ${regression.metric}\n\n`;
        report += `- **Previous:** ${Math.round(regression.previousValue)}\n`;
        report += `- **Current:** ${Math.round(regression.currentValue)}\n`;
        report += `- **Change:** +${Math.round(regression.changePercentage)}% (${regression.severity})\n\n`;
      }
    }

    return report;
  }
}

/**
 * Global performance simulator instance
 */
let globalPerformanceSimulator: PerformanceSimulator | null = null;

/**
 * Get the global performance simulator
 */
export function getPerformanceSimulator(): PerformanceSimulator {
  if (!globalPerformanceSimulator) {
    globalPerformanceSimulator = new PerformanceSimulator();
  }
  return globalPerformanceSimulator;
}

/**
 * Create a new performance simulator
 */
export function createPerformanceSimulator(): PerformanceSimulator {
  return new PerformanceSimulator();
}

/**
 * Run quick performance test
 */
export async function runQuickPerformanceTest(
  scenarios?: PerformanceTestScenario[]
): Promise<BenchmarkResult> {
  const simulator = getPerformanceSimulator();
  return simulator.runBenchmark(scenarios, {
    iterations: 1,
    warmupRuns: 0,
    compareWithPrevious: false,
    saveResults: false,
  });
}

export default PerformanceSimulator;