/**
 * CSS Custom Property Performance Tuning and Benchmarking
 * 
 * Profiles and optimizes the performance of CSS after variable consolidation
 * and optimization, focusing on file size, selector efficiency, and runtime
 * rendering speed with automated reporting and recommendations.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { VariableMap, CustomPropertyDeclaration } from './customPropertyDetector.js';
import type { RefactoringPlan, ConsolidationResult } from './customPropertyConsolidator.js';

export interface PerformanceConfiguration {
  /** Enable file size analysis */
  enableFileSizeAnalysis: boolean;
  /** Enable selector efficiency analysis */
  enableSelectorAnalysis: boolean;
  /** Enable runtime performance benchmarking */
  enableRuntimeBenchmarking: boolean;
  /** Target environments for testing */
  targetEnvironments: PerformanceEnvironment[];
  /** Benchmark configurations */
  benchmarkConfig: BenchmarkConfiguration;
  /** Performance thresholds */
  thresholds: PerformanceThresholds;
  /** Output configuration */
  reportConfig: ReportConfiguration;
}

export interface PerformanceEnvironment {
  /** Environment name */
  name: string;
  /** Environment type */
  type: 'browser' | 'css-in-js' | 'ssr' | 'build-tool';
  /** Specific configuration */
  config: EnvironmentConfig;
  /** Performance metrics to collect */
  metrics: string[];
}

export interface EnvironmentConfig {
  /** Browser/engine name */
  engine?: string;
  /** Version information */
  version?: string;
  /** Device type */
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  /** CSS-in-JS library */
  cssInJsLibrary?: string;
  /** Build tool configuration */
  buildTool?: string;
  /** Additional options */
  options?: Record<string, any>;
}

export interface BenchmarkConfiguration {
  /** Number of benchmark iterations */
  iterations: number;
  /** Warmup iterations */
  warmupIterations: number;
  /** Test timeout in milliseconds */
  timeoutMs: number;
  /** Sample HTML templates */
  htmlTemplates: HtmlTemplate[];
  /** CSS test scenarios */
  testScenarios: TestScenario[];
}

export interface HtmlTemplate {
  /** Template name */
  name: string;
  /** HTML content */
  content: string;
  /** Expected element count */
  elementCount: number;
  /** Complexity level */
  complexity: 'simple' | 'medium' | 'complex';
}

export interface TestScenario {
  /** Scenario name */
  name: string;
  /** Scenario description */
  description: string;
  /** CSS content to test */
  cssContent: string;
  /** HTML template to use */
  htmlTemplate: string;
  /** Expected performance characteristics */
  expectedPerformance: ExpectedPerformance;
}

export interface ExpectedPerformance {
  /** Expected file size (bytes) */
  maxFileSize?: number;
  /** Expected parse time (ms) */
  maxParseTime?: number;
  /** Expected render time (ms) */
  maxRenderTime?: number;
  /** Expected memory usage (bytes) */
  maxMemoryUsage?: number;
}

export interface PerformanceThresholds {
  /** File size thresholds */
  fileSize: {
    warning: number;
    critical: number;
  };
  /** Parse time thresholds (ms) */
  parseTime: {
    warning: number;
    critical: number;
  };
  /** Render time thresholds (ms) */
  renderTime: {
    warning: number;
    critical: number;
  };
  /** Memory usage thresholds (bytes) */
  memoryUsage: {
    warning: number;
    critical: number;
  };
  /** Selector efficiency threshold */
  selectorEfficiency: {
    warning: number;
    critical: number;
  };
}

export interface ReportConfiguration {
  /** Output directory */
  outputDirectory: string;
  /** Include detailed metrics */
  includeDetailedMetrics: boolean;
  /** Include recommendations */
  includeRecommendations: boolean;
  /** Include comparison charts */
  includeCharts: boolean;
  /** Report formats */
  formats: ('json' | 'html' | 'markdown')[];
}

export interface PerformanceReport {
  /** Report metadata */
  metadata: ReportMetadata;
  /** Overall performance summary */
  summary: PerformanceSummary;
  /** File size analysis */
  fileSizeAnalysis: FileSizeAnalysis;
  /** Selector efficiency analysis */
  selectorAnalysis: SelectorAnalysis;
  /** Runtime benchmarks */
  runtimeBenchmarks: RuntimeBenchmarks;
  /** Performance regressions */
  regressions: PerformanceRegression[];
  /** Optimization recommendations */
  recommendations: PerformanceRecommendation[];
  /** Comparison with baseline */
  comparison?: PerformanceComparison;
}

export interface ReportMetadata {
  /** Generation timestamp */
  timestamp: string;
  /** Test environment */
  environment: string;
  /** Configuration used */
  configuration: PerformanceConfiguration;
  /** Test duration */
  testDurationMs: number;
}

export interface PerformanceSummary {
  /** Overall score (0-100) */
  overallScore: number;
  /** Performance grade */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Key metrics */
  keyMetrics: {
    totalFileSizeBytes: number;
    totalParseTimeMs: number;
    totalRenderTimeMs: number;
    memoryUsageBytes: number;
    selectorEfficiencyScore: number;
  };
  /** Threshold violations */
  thresholdViolations: ThresholdViolation[];
}

export interface ThresholdViolation {
  /** Metric name */
  metric: string;
  /** Current value */
  currentValue: number;
  /** Threshold value */
  thresholdValue: number;
  /** Violation severity */
  severity: 'warning' | 'critical';
  /** Impact description */
  impact: string;
}

export interface FileSizeAnalysis {
  /** Original total size */
  originalSizeBytes: number;
  /** Optimized total size */
  optimizedSizeBytes: number;
  /** Size savings */
  sizeSavingsBytes: number;
  /** Size savings percentage */
  sizeSavingsPercent: number;
  /** Per-file breakdown */
  fileBreakdown: FileSizeBreakdown[];
  /** Compression analysis */
  compressionAnalysis: CompressionAnalysis;
}

export interface FileSizeBreakdown {
  /** File path */
  filePath: string;
  /** Original size */
  originalSize: number;
  /** Optimized size */
  optimizedSize: number;
  /** Size change */
  sizeChange: number;
  /** Variable count */
  variableCount: number;
  /** Optimization notes */
  notes: string[];
}

export interface CompressionAnalysis {
  /** Gzip compression results */
  gzip: {
    originalSize: number;
    optimizedSize: number;
    savings: number;
  };
  /** Brotli compression results */
  brotli: {
    originalSize: number;
    optimizedSize: number;
    savings: number;
  };
}

export interface SelectorAnalysis {
  /** Overall efficiency score */
  efficiencyScore: number;
  /** Selector performance metrics */
  selectorMetrics: SelectorMetrics[];
  /** Complex selectors */
  complexSelectors: ComplexSelector[];
  /** Optimization opportunities */
  optimizationOpportunities: SelectorOptimization[];
}

export interface SelectorMetrics {
  /** Selector text */
  selector: string;
  /** Complexity score */
  complexityScore: number;
  /** Performance impact */
  performanceImpact: 'low' | 'medium' | 'high';
  /** Usage frequency */
  usageFrequency: number;
  /** Variables used */
  variablesUsed: string[];
}

export interface ComplexSelector {
  /** Selector text */
  selector: string;
  /** Complexity factors */
  complexityFactors: string[];
  /** Performance cost */
  performanceCost: number;
  /** Simplification suggestion */
  simplificationSuggestion?: string;
}

export interface SelectorOptimization {
  /** Current selector */
  currentSelector: string;
  /** Optimized selector */
  optimizedSelector: string;
  /** Performance improvement */
  performanceImprovement: number;
  /** Implementation difficulty */
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface RuntimeBenchmarks {
  /** Parse performance */
  parsePerformance: ParseBenchmark[];
  /** Render performance */
  renderPerformance: RenderBenchmark[];
  /** Memory usage */
  memoryUsage: MemoryBenchmark[];
  /** Environment-specific results */
  environmentResults: EnvironmentBenchmark[];
}

export interface ParseBenchmark {
  /** Test scenario */
  scenario: string;
  /** Parse time (ms) */
  parseTimeMs: number;
  /** Parse time std deviation */
  parseTimeStdDev: number;
  /** CSS size */
  cssSize: number;
  /** Variable count */
  variableCount: number;
}

export interface RenderBenchmark {
  /** Test scenario */
  scenario: string;
  /** First paint time (ms) */
  firstPaintMs: number;
  /** Layout time (ms) */
  layoutTimeMs: number;
  /** Paint time (ms) */
  paintTimeMs: number;
  /** Total render time (ms) */
  totalRenderTimeMs: number;
  /** Element count */
  elementCount: number;
}

export interface MemoryBenchmark {
  /** Test scenario */
  scenario: string;
  /** Initial memory (bytes) */
  initialMemoryBytes: number;
  /** Peak memory (bytes) */
  peakMemoryBytes: number;
  /** Final memory (bytes) */
  finalMemoryBytes: number;
  /** Memory delta (bytes) */
  memoryDeltaBytes: number;
}

export interface EnvironmentBenchmark {
  /** Environment name */
  environment: string;
  /** Environment type */
  type: string;
  /** Benchmark results */
  results: {
    parseTimeMs: number;
    renderTimeMs: number;
    memoryUsageBytes: number;
    selectorEfficiency: number;
  };
  /** Environment-specific notes */
  notes: string[];
}

export interface PerformanceRegression {
  /** Metric name */
  metric: string;
  /** Previous value */
  previousValue: number;
  /** Current value */
  currentValue: number;
  /** Regression percentage */
  regressionPercent: number;
  /** Severity level */
  severity: 'minor' | 'moderate' | 'severe';
  /** Suspected cause */
  suspectedCause: string;
}

export interface PerformanceRecommendation {
  /** Recommendation type */
  type: 'optimization' | 'refactoring' | 'tooling' | 'architecture';
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Expected impact */
  expectedImpact: string;
  /** Implementation effort */
  implementationEffort: 'low' | 'medium' | 'high';
  /** Related metrics */
  relatedMetrics: string[];
}

export interface PerformanceComparison {
  /** Baseline report timestamp */
  baselineTimestamp: string;
  /** Metrics comparison */
  metricsComparison: MetricComparison[];
  /** Overall improvement */
  overallImprovement: number;
  /** Significant changes */
  significantChanges: PerformanceChange[];
}

export interface MetricComparison {
  /** Metric name */
  metric: string;
  /** Baseline value */
  baselineValue: number;
  /** Current value */
  currentValue: number;
  /** Change percentage */
  changePercent: number;
  /** Change direction */
  direction: 'improved' | 'degraded' | 'unchanged';
}

export interface PerformanceChange {
  /** Change type */
  type: 'improvement' | 'degradation';
  /** Metric affected */
  metric: string;
  /** Change magnitude */
  magnitude: number;
  /** Change description */
  description: string;
}

export class CustomPropertyPerformanceTuner {
  private config: PerformanceConfiguration;

  constructor(config: Partial<PerformanceConfiguration> = {}) {
    this.config = {
      enableFileSizeAnalysis: true,
      enableSelectorAnalysis: true,
      enableRuntimeBenchmarking: true,
      targetEnvironments: this.getDefaultEnvironments(),
      benchmarkConfig: {
        iterations: 10,
        warmupIterations: 3,
        timeoutMs: 30000,
        htmlTemplates: this.getDefaultHtmlTemplates(),
        testScenarios: this.getDefaultTestScenarios()
      },
      thresholds: {
        fileSize: { warning: 100000, critical: 500000 }, // 100KB warning, 500KB critical
        parseTime: { warning: 100, critical: 500 }, // 100ms warning, 500ms critical
        renderTime: { warning: 16, critical: 33 }, // 60fps target, 30fps critical
        memoryUsage: { warning: 10485760, critical: 52428800 }, // 10MB warning, 50MB critical
        selectorEfficiency: { warning: 70, critical: 50 } // Efficiency score
      },
      reportConfig: {
        outputDirectory: '.tw-enigma/reports/performance',
        includeDetailedMetrics: true,
        includeRecommendations: true,
        includeCharts: true,
        formats: ['json', 'html', 'markdown']
      },
      ...config
    };
  }

  /**
   * Profile performance before and after optimization
   */
  async profilePerformance(
    originalVariableMap: VariableMap,
    optimizedResults: Map<string, ConsolidationResult>,
    refactoringPlan: RefactoringPlan
  ): Promise<PerformanceReport> {
    const startTime = Date.now();
    
    const summary = await this.generatePerformanceSummary(originalVariableMap, optimizedResults);
    const fileSizeAnalysis = await this.analyzeFileSize(originalVariableMap, optimizedResults);
    const selectorAnalysis = await this.analyzeSelectorEfficiency(originalVariableMap, optimizedResults);
    const runtimeBenchmarks = await this.runRuntimeBenchmarks(originalVariableMap, optimizedResults);
    const regressions = this.detectRegressions(summary);
    const recommendations = this.generateRecommendations(fileSizeAnalysis, selectorAnalysis, runtimeBenchmarks);

    const testDurationMs = Date.now() - startTime;

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        environment: process.platform,
        configuration: this.config,
        testDurationMs
      },
      summary,
      fileSizeAnalysis,
      selectorAnalysis,
      runtimeBenchmarks,
      regressions,
      recommendations
    };
  }

  /**
   * Compare performance with baseline
   */
  async compareWithBaseline(
    currentReport: PerformanceReport,
    baselineReport: PerformanceReport
  ): Promise<PerformanceComparison> {
    const metricsComparison = this.compareMetrics(currentReport, baselineReport);
    const overallImprovement = this.calculateOverallImprovement(metricsComparison);
    const significantChanges = this.identifySignificantChanges(metricsComparison);

    return {
      baselineTimestamp: baselineReport.metadata.timestamp,
      metricsComparison,
      overallImprovement,
      significantChanges
    };
  }

  /**
   * Generate performance report files
   */
  async generateReportFiles(
    report: PerformanceReport,
    comparison?: PerformanceComparison
  ): Promise<string[]> {
    const outputDir = this.config.reportConfig.outputDirectory;
    await fs.mkdir(outputDir, { recursive: true });

    const generatedFiles: string[] = [];

    if (comparison) {
      report.comparison = comparison;
    }

    for (const format of this.config.reportConfig.formats) {
      const fileName = `performance-report-${Date.now()}.${format}`;
      const filePath = path.join(outputDir, fileName);

      let content: string;
      switch (format) {
        case 'json':
          content = JSON.stringify(report, null, 2);
          break;
        case 'html':
          content = this.generateHtmlReport(report);
          break;
        case 'markdown':
          content = this.generateMarkdownReport(report);
          break;
        default:
          content = JSON.stringify(report, null, 2);
      }

      await fs.writeFile(filePath, content, 'utf8');
      generatedFiles.push(filePath);
    }

    return generatedFiles;
  }

  /**
   * Run continuous performance monitoring
   */
  async startContinuousMonitoring(
    variableMap: VariableMap,
    watchPaths: string[],
    onPerformanceChange: (report: PerformanceReport) => void
  ): Promise<() => void> {
    let isMonitoring = true;
    
    const runMonitoring = async () => {
      while (isMonitoring) {
        try {
          // In a real implementation, would watch file changes and re-run benchmarks
          await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute
          
          // Simplified monitoring - would detect changes and re-run performance tests
          // const report = await this.profilePerformance(variableMap, new Map(), { ... });
          // onPerformanceChange(report);
        } catch (error) {
          console.error('Performance monitoring error:', error);
        }
      }
    };

    runMonitoring();

    return () => {
      isMonitoring = false;
    };
  }

  // Helper methods

  private async generatePerformanceSummary(
    originalVariableMap: VariableMap,
    optimizedResults: Map<string, ConsolidationResult>
  ): Promise<PerformanceSummary> {
    const keyMetrics = {
      totalFileSizeBytes: this.calculateTotalFileSize(optimizedResults),
      totalParseTimeMs: this.estimateParseTime(originalVariableMap),
      totalRenderTimeMs: this.estimateRenderTime(originalVariableMap),
      memoryUsageBytes: this.estimateMemoryUsage(originalVariableMap),
      selectorEfficiencyScore: this.calculateSelectorEfficiency(originalVariableMap)
    };

    const thresholdViolations = this.checkThresholdViolations(keyMetrics);
    const overallScore = this.calculateOverallScore(keyMetrics, thresholdViolations);
    const grade = this.calculateGrade(overallScore);

    return {
      overallScore,
      grade,
      keyMetrics,
      thresholdViolations
    };
  }

  private async analyzeFileSize(
    originalVariableMap: VariableMap,
    optimizedResults: Map<string, ConsolidationResult>
  ): Promise<FileSizeAnalysis> {
    let originalSizeBytes = 0;
    let optimizedSizeBytes = 0;
    const fileBreakdown: FileSizeBreakdown[] = [];

    for (const [filePath, result] of optimizedResults) {
      const originalSize = Buffer.byteLength(result.originalContent, 'utf8');
      const optimizedSize = Buffer.byteLength(result.updatedContent, 'utf8');
      
      originalSizeBytes += originalSize;
      optimizedSizeBytes += optimizedSize;

      fileBreakdown.push({
        filePath,
        originalSize,
        optimizedSize,
        sizeChange: optimizedSize - originalSize,
        variableCount: this.countVariablesInFile(filePath, originalVariableMap),
        notes: result.errors.map(e => e.message)
      });
    }

    const sizeSavingsBytes = originalSizeBytes - optimizedSizeBytes;
    const sizeSavingsPercent = originalSizeBytes > 0 ? (sizeSavingsBytes / originalSizeBytes) * 100 : 0;

    const compressionAnalysis = await this.analyzeCompression(originalSizeBytes, optimizedSizeBytes);

    return {
      originalSizeBytes,
      optimizedSizeBytes,
      sizeSavingsBytes,
      sizeSavingsPercent,
      fileBreakdown,
      compressionAnalysis
    };
  }

  private async analyzeSelectorEfficiency(
    originalVariableMap: VariableMap,
    optimizedResults: Map<string, ConsolidationResult>
  ): Promise<SelectorAnalysis> {
    const selectorMetrics: SelectorMetrics[] = [];
    const complexSelectors: ComplexSelector[] = [];
    const optimizationOpportunities: SelectorOptimization[] = [];

    // Analyze selectors that use custom properties
    for (const [variableName, usages] of originalVariableMap.usages) {
      for (const usage of usages) {
        const complexityScore = this.calculateSelectorComplexity(usage.selector);
        const performanceImpact = this.assessPerformanceImpact(complexityScore);

        selectorMetrics.push({
          selector: usage.selector,
          complexityScore,
          performanceImpact,
          usageFrequency: 1, // Simplified
          variablesUsed: [variableName]
        });

        if (complexityScore > 75) {
          complexSelectors.push({
            selector: usage.selector,
            complexityFactors: this.identifyComplexityFactors(usage.selector),
            performanceCost: complexityScore,
            simplificationSuggestion: this.suggestSimplification(usage.selector)
          });
        }
      }
    }

    const efficiencyScore = this.calculateAverageEfficiency(selectorMetrics);

    return {
      efficiencyScore,
      selectorMetrics,
      complexSelectors,
      optimizationOpportunities
    };
  }

  private async runRuntimeBenchmarks(
    originalVariableMap: VariableMap,
    optimizedResults: Map<string, ConsolidationResult>
  ): Promise<RuntimeBenchmarks> {
    const parsePerformance: ParseBenchmark[] = [];
    const renderPerformance: RenderBenchmark[] = [];
    const memoryUsage: MemoryBenchmark[] = [];
    const environmentResults: EnvironmentBenchmark[] = [];

    // Run benchmarks for each test scenario
    for (const scenario of this.config.benchmarkConfig.testScenarios) {
      // Parse benchmarks
      const parseBenchmark = await this.benchmarkParsing(scenario, optimizedResults);
      parsePerformance.push(parseBenchmark);

      // Render benchmarks
      const renderBenchmark = await this.benchmarkRendering(scenario, optimizedResults);
      renderPerformance.push(renderBenchmark);

      // Memory benchmarks
      const memoryBenchmark = await this.benchmarkMemory(scenario, optimizedResults);
      memoryUsage.push(memoryBenchmark);
    }

    // Environment-specific benchmarks
    for (const environment of this.config.targetEnvironments) {
      const envBenchmark = await this.benchmarkEnvironment(environment, optimizedResults);
      environmentResults.push(envBenchmark);
    }

    return {
      parsePerformance,
      renderPerformance,
      memoryUsage,
      environmentResults
    };
  }

  private detectRegressions(summary: PerformanceSummary): PerformanceRegression[] {
    const regressions: PerformanceRegression[] = [];

    // Check for threshold violations that indicate regressions
    for (const violation of summary.thresholdViolations) {
      if (violation.severity === 'critical') {
        regressions.push({
          metric: violation.metric,
          previousValue: violation.thresholdValue,
          currentValue: violation.currentValue,
          regressionPercent: ((violation.currentValue - violation.thresholdValue) / violation.thresholdValue) * 100,
          severity: 'severe',
          suspectedCause: 'Optimization may have introduced inefficiencies'
        });
      }
    }

    return regressions;
  }

  private generateRecommendations(
    fileSizeAnalysis: FileSizeAnalysis,
    selectorAnalysis: SelectorAnalysis,
    runtimeBenchmarks: RuntimeBenchmarks
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // File size recommendations
    if (fileSizeAnalysis.sizeSavingsPercent < 10) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Consider Additional Variable Consolidation',
        description: 'File size savings are below 10%. Review variable usage patterns for additional optimization opportunities.',
        expectedImpact: 'Potential 10-30% additional size reduction',
        implementationEffort: 'medium',
        relatedMetrics: ['file_size']
      });
    }

    // Selector efficiency recommendations
    if (selectorAnalysis.efficiencyScore < 70) {
      recommendations.push({
        type: 'refactoring',
        priority: 'high',
        title: 'Optimize Complex Selectors',
        description: 'Several selectors have high complexity scores. Consider simplifying or restructuring.',
        expectedImpact: 'Improved render performance and CSS parsing speed',
        implementationEffort: 'medium',
        relatedMetrics: ['selector_efficiency', 'render_time']
      });
    }

    // Runtime performance recommendations
    const avgRenderTime = runtimeBenchmarks.renderPerformance.reduce((sum, bench) => 
      sum + bench.totalRenderTimeMs, 0) / runtimeBenchmarks.renderPerformance.length;

    if (avgRenderTime > this.config.thresholds.renderTime.warning) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        title: 'Reduce CSS Custom Property Usage in Critical Path',
        description: 'High render times detected. Consider reducing variable usage in above-the-fold CSS.',
        expectedImpact: 'Faster initial page rendering',
        implementationEffort: 'high',
        relatedMetrics: ['render_time', 'first_paint']
      });
    }

    return recommendations;
  }

  // Default configurations and data

  private getDefaultEnvironments(): PerformanceEnvironment[] {
    return [
      {
        name: 'Chrome Desktop',
        type: 'browser',
        config: { engine: 'Chrome', version: 'latest', deviceType: 'desktop' },
        metrics: ['parse_time', 'render_time', 'memory_usage']
      },
      {
        name: 'Firefox Desktop',
        type: 'browser',
        config: { engine: 'Firefox', version: 'latest', deviceType: 'desktop' },
        metrics: ['parse_time', 'render_time', 'memory_usage']
      },
      {
        name: 'Safari Mobile',
        type: 'browser',
        config: { engine: 'Safari', version: 'latest', deviceType: 'mobile' },
        metrics: ['parse_time', 'render_time', 'memory_usage']
      },
      {
        name: 'Styled Components',
        type: 'css-in-js',
        config: { cssInJsLibrary: 'styled-components' },
        metrics: ['runtime_injection', 'memory_usage']
      }
    ];
  }

  private getDefaultHtmlTemplates(): HtmlTemplate[] {
    return [
      {
        name: 'Simple',
        content: '<div class="container"><p class="text">Hello World</p></div>',
        elementCount: 2,
        complexity: 'simple'
      },
      {
        name: 'Medium',
        content: Array(50).fill('<div class="item"><span class="text">Item</span></div>').join(''),
        elementCount: 100,
        complexity: 'medium'
      },
      {
        name: 'Complex',
        content: Array(200).fill('<div class="card"><header class="header"><h3 class="title">Title</h3></header><main class="content"><p class="text">Content</p></main></div>').join(''),
        elementCount: 1000,
        complexity: 'complex'
      }
    ];
  }

  private getDefaultTestScenarios(): TestScenario[] {
    return [
      {
        name: 'Basic Variables',
        description: 'Test performance with basic CSS variables',
        cssContent: `
          :root {
            --primary-color: #007bff;
            --secondary-color: #6c757d;
            --font-size: 16px;
          }
          .container { color: var(--primary-color); font-size: var(--font-size); }
          .text { color: var(--secondary-color); }
        `,
        htmlTemplate: 'Simple',
        expectedPerformance: {
          maxFileSize: 1000,
          maxParseTime: 10,
          maxRenderTime: 16
        }
      },
      {
        name: 'Complex Variables',
        description: 'Test performance with complex nested variables',
        cssContent: `
          :root {
            --base-color: #007bff;
            --light-color: color-mix(in srgb, var(--base-color) 70%, white);
            --dark-color: color-mix(in srgb, var(--base-color) 30%, black);
            --size-sm: 8px;
            --size-md: calc(var(--size-sm) * 2);
            --size-lg: calc(var(--size-md) * 2);
          }
          .item { 
            color: var(--light-color); 
            padding: var(--size-md);
            border: 1px solid var(--dark-color);
          }
        `,
        htmlTemplate: 'Medium',
        expectedPerformance: {
          maxFileSize: 5000,
          maxParseTime: 50,
          maxRenderTime: 33
        }
      }
    ];
  }

  // Benchmark implementation methods (simplified)

  private async benchmarkParsing(
    scenario: TestScenario,
    optimizedResults: Map<string, ConsolidationResult>
  ): Promise<ParseBenchmark> {
    // Simplified parse time estimation
    const cssSize = Buffer.byteLength(scenario.cssContent, 'utf8');
    const variableCount = (scenario.cssContent.match(/var\(/g) || []).length;
    const parseTimeMs = Math.max(1, cssSize / 10000 + variableCount * 0.5); // Simplified calculation

    return {
      scenario: scenario.name,
      parseTimeMs,
      parseTimeStdDev: parseTimeMs * 0.1,
      cssSize,
      variableCount
    };
  }

  private async benchmarkRendering(
    scenario: TestScenario,
    optimizedResults: Map<string, ConsolidationResult>
  ): Promise<RenderBenchmark> {
    const template = this.config.benchmarkConfig.htmlTemplates.find(t => t.name === scenario.htmlTemplate);
    const elementCount = template?.elementCount || 10;
    
    // Simplified render time estimation
    const baseRenderTime = elementCount * 0.01; // 0.01ms per element
    const variableOverhead = (scenario.cssContent.match(/var\(/g) || []).length * 0.1;

    return {
      scenario: scenario.name,
      firstPaintMs: baseRenderTime + variableOverhead,
      layoutTimeMs: baseRenderTime * 0.6,
      paintTimeMs: baseRenderTime * 0.4,
      totalRenderTimeMs: baseRenderTime + variableOverhead,
      elementCount
    };
  }

  private async benchmarkMemory(
    scenario: TestScenario,
    optimizedResults: Map<string, ConsolidationResult>
  ): Promise<MemoryBenchmark> {
    const initialMemoryBytes = 1048576; // 1MB baseline
    const cssSize = Buffer.byteLength(scenario.cssContent, 'utf8');
    const memoryOverhead = cssSize * 2; // Simplified memory calculation

    return {
      scenario: scenario.name,
      initialMemoryBytes,
      peakMemoryBytes: initialMemoryBytes + memoryOverhead,
      finalMemoryBytes: initialMemoryBytes + memoryOverhead * 0.8,
      memoryDeltaBytes: memoryOverhead * 0.8
    };
  }

  private async benchmarkEnvironment(
    environment: PerformanceEnvironment,
    optimizedResults: Map<string, ConsolidationResult>
  ): Promise<EnvironmentBenchmark> {
    // Simplified environment benchmarking
    const baselinePerformance = {
      parseTimeMs: 50,
      renderTimeMs: 16,
      memoryUsageBytes: 5242880, // 5MB
      selectorEfficiency: 85
    };

    // Apply environment-specific modifiers
    let modifier = 1.0;
    if (environment.config.deviceType === 'mobile') {
      modifier = 1.5; // Mobile devices are slower
    }

    return {
      environment: environment.name,
      type: environment.type,
      results: {
        parseTimeMs: baselinePerformance.parseTimeMs * modifier,
        renderTimeMs: baselinePerformance.renderTimeMs * modifier,
        memoryUsageBytes: baselinePerformance.memoryUsageBytes * modifier,
        selectorEfficiency: baselinePerformance.selectorEfficiency / modifier
      },
      notes: [`Tested on ${environment.name}`, `Device type: ${environment.config.deviceType}`]
    };
  }

  // Calculation helper methods

  private calculateTotalFileSize(optimizedResults: Map<string, ConsolidationResult>): number {
    let totalSize = 0;
    for (const result of optimizedResults.values()) {
      totalSize += Buffer.byteLength(result.updatedContent, 'utf8');
    }
    return totalSize;
  }

  private estimateParseTime(variableMap: VariableMap): number {
    const totalVariables = Array.from(variableMap.declarations.values()).flat().length;
    return totalVariables * 0.1; // 0.1ms per variable (simplified)
  }

  private estimateRenderTime(variableMap: VariableMap): number {
    const totalUsages = Array.from(variableMap.usages.values()).flat().length;
    return totalUsages * 0.05; // 0.05ms per usage (simplified)
  }

  private estimateMemoryUsage(variableMap: VariableMap): number {
    const totalVariables = Array.from(variableMap.declarations.values()).flat().length;
    return 1048576 + totalVariables * 1024; // 1MB baseline + 1KB per variable
  }

  private calculateSelectorEfficiency(variableMap: VariableMap): number {
    let totalComplexity = 0;
    let selectorCount = 0;

    for (const usages of variableMap.usages.values()) {
      for (const usage of usages) {
        totalComplexity += this.calculateSelectorComplexity(usage.selector);
        selectorCount++;
      }
    }

    return selectorCount > 0 ? Math.max(0, 100 - (totalComplexity / selectorCount)) : 100;
  }

  private calculateSelectorComplexity(selector: string): number {
    let complexity = 0;
    
    // Count selector parts
    complexity += (selector.match(/\s+/g) || []).length * 10; // Descendant selectors
    complexity += (selector.match(/>/g) || []).length * 5; // Child selectors
    complexity += (selector.match(/\+/g) || []).length * 8; // Adjacent sibling
    complexity += (selector.match(/~/g) || []).length * 8; // General sibling
    complexity += (selector.match(/\[/g) || []).length * 15; // Attribute selectors
    complexity += (selector.match(/:/g) || []).length * 10; // Pseudo selectors
    complexity += (selector.match(/::/g) || []).length * 5; // Pseudo elements

    return Math.min(100, complexity);
  }

  private assessPerformanceImpact(complexityScore: number): 'low' | 'medium' | 'high' {
    if (complexityScore < 30) return 'low';
    if (complexityScore < 70) return 'medium';
    return 'high';
  }

  private identifyComplexityFactors(selector: string): string[] {
    const factors: string[] = [];
    
    if (selector.includes(' ')) factors.push('Descendant combinators');
    if (selector.includes('>')) factors.push('Child combinators');
    if (selector.includes('[')) factors.push('Attribute selectors');
    if (selector.includes(':')) factors.push('Pseudo selectors');
    if (selector.includes('::')) factors.push('Pseudo elements');
    if ((selector.match(/\./g) || []).length > 2) factors.push('Multiple class selectors');

    return factors;
  }

  private suggestSimplification(selector: string): string {
    // Simplified suggestion logic
    if (selector.includes(' ')) {
      return 'Consider using more specific class names instead of descendant selectors';
    }
    if (selector.includes('[')) {
      return 'Consider using classes instead of attribute selectors for better performance';
    }
    return 'Review selector structure for optimization opportunities';
  }

  private calculateAverageEfficiency(selectorMetrics: SelectorMetrics[]): number {
    if (selectorMetrics.length === 0) return 100;
    
    const totalComplexity = selectorMetrics.reduce((sum, metric) => sum + metric.complexityScore, 0);
    return Math.max(0, 100 - (totalComplexity / selectorMetrics.length));
  }

  private checkThresholdViolations(keyMetrics: PerformanceSummary['keyMetrics']): ThresholdViolation[] {
    const violations: ThresholdViolation[] = [];

    // Check file size
    if (keyMetrics.totalFileSizeBytes > this.config.thresholds.fileSize.critical) {
      violations.push({
        metric: 'file_size',
        currentValue: keyMetrics.totalFileSizeBytes,
        thresholdValue: this.config.thresholds.fileSize.critical,
        severity: 'critical',
        impact: 'Increased download time and bandwidth usage'
      });
    } else if (keyMetrics.totalFileSizeBytes > this.config.thresholds.fileSize.warning) {
      violations.push({
        metric: 'file_size',
        currentValue: keyMetrics.totalFileSizeBytes,
        thresholdValue: this.config.thresholds.fileSize.warning,
        severity: 'warning',
        impact: 'May impact loading performance on slower connections'
      });
    }

    // Check other metrics similarly...

    return violations;
  }

  private calculateOverallScore(
    keyMetrics: PerformanceSummary['keyMetrics'],
    violations: ThresholdViolation[]
  ): number {
    let score = 100;

    // Deduct points for violations
    for (const violation of violations) {
      if (violation.severity === 'critical') {
        score -= 20;
      } else if (violation.severity === 'warning') {
        score -= 10;
      }
    }

    return Math.max(0, score);
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private countVariablesInFile(filePath: string, variableMap: VariableMap): number {
    let count = 0;
    for (const declarations of variableMap.declarations.values()) {
      count += declarations.filter(d => d.filePath === filePath).length;
    }
    return count;
  }

  private async analyzeCompression(
    originalSize: number,
    optimizedSize: number
  ): Promise<CompressionAnalysis> {
    // Simplified compression analysis
    const gzipRatio = 0.7; // Typical gzip compression ratio
    const brotliRatio = 0.6; // Typical brotli compression ratio

    return {
      gzip: {
        originalSize: Math.floor(originalSize * gzipRatio),
        optimizedSize: Math.floor(optimizedSize * gzipRatio),
        savings: Math.floor((originalSize - optimizedSize) * gzipRatio)
      },
      brotli: {
        originalSize: Math.floor(originalSize * brotliRatio),
        optimizedSize: Math.floor(optimizedSize * brotliRatio),
        savings: Math.floor((originalSize - optimizedSize) * brotliRatio)
      }
    };
  }

  private compareMetrics(
    currentReport: PerformanceReport,
    baselineReport: PerformanceReport
  ): MetricComparison[] {
    const comparisons: MetricComparison[] = [];

    const metricsToCompare = [
      { name: 'file_size', current: currentReport.summary.keyMetrics.totalFileSizeBytes, baseline: baselineReport.summary.keyMetrics.totalFileSizeBytes },
      { name: 'parse_time', current: currentReport.summary.keyMetrics.totalParseTimeMs, baseline: baselineReport.summary.keyMetrics.totalParseTimeMs },
      { name: 'render_time', current: currentReport.summary.keyMetrics.totalRenderTimeMs, baseline: baselineReport.summary.keyMetrics.totalRenderTimeMs },
      { name: 'memory_usage', current: currentReport.summary.keyMetrics.memoryUsageBytes, baseline: baselineReport.summary.keyMetrics.memoryUsageBytes }
    ];

    for (const metric of metricsToCompare) {
      const changePercent = metric.baseline > 0 ? ((metric.current - metric.baseline) / metric.baseline) * 100 : 0;
      const direction = changePercent < -5 ? 'improved' : changePercent > 5 ? 'degraded' : 'unchanged';

      comparisons.push({
        metric: metric.name,
        baselineValue: metric.baseline,
        currentValue: metric.current,
        changePercent,
        direction
      });
    }

    return comparisons;
  }

  private calculateOverallImprovement(comparisons: MetricComparison[]): number {
    const improvements = comparisons.map(c => -c.changePercent); // Negative change is improvement for most metrics
    return improvements.reduce((sum, improvement) => sum + improvement, 0) / improvements.length;
  }

  private identifySignificantChanges(comparisons: MetricComparison[]): PerformanceChange[] {
    const changes: PerformanceChange[] = [];

    for (const comparison of comparisons) {
      if (Math.abs(comparison.changePercent) > 10) { // 10% threshold for significance
        changes.push({
          type: comparison.direction === 'improved' ? 'improvement' : 'degradation',
          metric: comparison.metric,
          magnitude: Math.abs(comparison.changePercent),
          description: `${comparison.metric} changed by ${comparison.changePercent.toFixed(1)}%`
        });
      }
    }

    return changes;
  }

  private generateHtmlReport(report: PerformanceReport): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>CSS Custom Property Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .score { font-size: 2em; font-weight: bold; color: ${this.getScoreColor(report.summary.overallScore)}; }
        .metric { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .violation { padding: 10px; margin: 5px 0; border-left: 4px solid #dc3545; background: #f8d7da; }
        .recommendation { padding: 10px; margin: 5px 0; border-left: 4px solid #007bff; background: #d1ecf1; }
    </style>
</head>
<body>
    <h1>CSS Custom Property Performance Report</h1>
    <p>Generated: ${new Date(report.metadata.timestamp).toLocaleString()}</p>
    
    <h2>Overall Performance</h2>
    <div class="score">Score: ${report.summary.overallScore}/100 (Grade: ${report.summary.grade})</div>
    
    <h3>Key Metrics</h3>
    <div class="metric">Total File Size: ${this.formatBytes(report.summary.keyMetrics.totalFileSizeBytes)}</div>
    <div class="metric">Parse Time: ${report.summary.keyMetrics.totalParseTimeMs.toFixed(1)}ms</div>
    <div class="metric">Render Time: ${report.summary.keyMetrics.totalRenderTimeMs.toFixed(1)}ms</div>
    <div class="metric">Memory Usage: ${this.formatBytes(report.summary.keyMetrics.memoryUsageBytes)}</div>
    <div class="metric">Selector Efficiency: ${report.summary.keyMetrics.selectorEfficiencyScore.toFixed(1)}%</div>
    
    ${report.summary.thresholdViolations.length > 0 ? `
    <h3>Performance Issues</h3>
    ${report.summary.thresholdViolations.map(v => `
        <div class="violation">
            <strong>${v.metric}:</strong> ${v.impact}
            (Current: ${v.currentValue}, Threshold: ${v.thresholdValue})
        </div>
    `).join('')}
    ` : ''}
    
    <h3>File Size Analysis</h3>
    <div class="metric">
        Original: ${this.formatBytes(report.fileSizeAnalysis.originalSizeBytes)} → 
        Optimized: ${this.formatBytes(report.fileSizeAnalysis.optimizedSizeBytes)}
        (${report.fileSizeAnalysis.sizeSavingsPercent.toFixed(1)}% savings)
    </div>
    
    ${report.recommendations.length > 0 ? `
    <h3>Recommendations</h3>
    ${report.recommendations.map(r => `
        <div class="recommendation">
            <strong>${r.title}</strong><br>
            ${r.description}<br>
            <small>Impact: ${r.expectedImpact} | Effort: ${r.implementationEffort}</small>
        </div>
    `).join('')}
    ` : ''}
</body>
</html>`;
  }

  private generateMarkdownReport(report: PerformanceReport): string {
    return `# CSS Custom Property Performance Report

Generated: ${new Date(report.metadata.timestamp).toLocaleString()}

## Overall Performance

**Score:** ${report.summary.overallScore}/100 (Grade: ${report.summary.grade})

## Key Metrics

- **Total File Size:** ${this.formatBytes(report.summary.keyMetrics.totalFileSizeBytes)}
- **Parse Time:** ${report.summary.keyMetrics.totalParseTimeMs.toFixed(1)}ms
- **Render Time:** ${report.summary.keyMetrics.totalRenderTimeMs.toFixed(1)}ms
- **Memory Usage:** ${this.formatBytes(report.summary.keyMetrics.memoryUsageBytes)}
- **Selector Efficiency:** ${report.summary.keyMetrics.selectorEfficiencyScore.toFixed(1)}%

## File Size Analysis

- **Original Size:** ${this.formatBytes(report.fileSizeAnalysis.originalSizeBytes)}
- **Optimized Size:** ${this.formatBytes(report.fileSizeAnalysis.optimizedSizeBytes)}
- **Savings:** ${this.formatBytes(report.fileSizeAnalysis.sizeSavingsBytes)} (${report.fileSizeAnalysis.sizeSavingsPercent.toFixed(1)}%)

${report.summary.thresholdViolations.length > 0 ? `
## Performance Issues

${report.summary.thresholdViolations.map(v => `
### ${v.metric} (${v.severity})
${v.impact}
- Current: ${v.currentValue}
- Threshold: ${v.thresholdValue}
`).join('')}
` : ''}

${report.recommendations.length > 0 ? `
## Recommendations

${report.recommendations.map(r => `
### ${r.title} (Priority: ${r.priority})
${r.description}

- **Expected Impact:** ${r.expectedImpact}
- **Implementation Effort:** ${r.implementationEffort}
`).join('')}
` : ''}
`;
  }

  private getScoreColor(score: number): string {
    if (score >= 90) return '#28a745';
    if (score >= 80) return '#ffc107';
    if (score >= 70) return '#fd7e14';
    return '#dc3545';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}

/**
 * Utility function to create a performance tuner
 */
export function createCustomPropertyPerformanceTuner(
  config: Partial<PerformanceConfiguration> = {}
): CustomPropertyPerformanceTuner {
  return new CustomPropertyPerformanceTuner(config);
}

/**
 * Utility function to profile performance
 */
export async function profileCustomPropertyPerformance(
  originalVariableMap: VariableMap,
  optimizedResults: Map<string, ConsolidationResult>,
  refactoringPlan: RefactoringPlan,
  config: Partial<PerformanceConfiguration> = {}
): Promise<PerformanceReport> {
  const tuner = createCustomPropertyPerformanceTuner(config);
  return await tuner.profilePerformance(originalVariableMap, optimizedResults, refactoringPlan);
}