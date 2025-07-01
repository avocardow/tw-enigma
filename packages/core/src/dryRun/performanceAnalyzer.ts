/**
 * Performance Analyzer
 * Analyzes performance data and identifies bottlenecks in the dry run system
 */

import { Logger } from '../utils/logger';
import type { BenchmarkResult, PerformanceMetrics } from './performanceSimulator';

export interface PerformanceBottleneck {
  /** Component where bottleneck occurs */
  component: string;
  /** Bottleneck type */
  type: 'cpu' | 'memory' | 'io' | 'throughput' | 'latency';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Impact score (0-100) */
  impact: number;
  /** Description of the bottleneck */
  description: string;
  /** Current value causing the bottleneck */
  currentValue: number;
  /** Recommended threshold */
  recommendedThreshold: number;
  /** Suggested optimizations */
  optimizations: string[];
  /** Related metrics */
  relatedMetrics: {
    metric: string;
    value: number;
    unit: string;
  }[];
}

export interface PerformanceInsights {
  /** Overall performance grade (A-F) */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Performance score (0-100) */
  score: number;
  /** Identified bottlenecks */
  bottlenecks: PerformanceBottleneck[];
  /** Performance trends */
  trends: {
    component: string;
    metric: string;
    trend: 'improving' | 'stable' | 'degrading';
    changeRate: number; // Percentage change over time
    recommendation: string;
  }[];
  /** Resource utilization analysis */
  resourceUtilization: {
    cpu: { average: number; peak: number; efficiency: number };
    memory: { average: number; peak: number; efficiency: number };
    io: { throughput: number; latency: number; efficiency: number };
  };
  /** Scaling analysis */
  scalability: {
    estimatedCapacity: number;
    currentUtilization: number;
    scalingFactor: number;
    recommendations: string[];
  };
  /** Optimization recommendations */
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: 'algorithmic' | 'memory' | 'io' | 'caching' | 'parallelization';
    description: string;
    expectedImprovement: number; // Percentage improvement
    implementationComplexity: 'low' | 'medium' | 'high';
  }[];
}

export interface PerformanceThresholds {
  /** Execution time thresholds (ms) */
  executionTime: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
  };
  /** Memory usage thresholds (bytes) */
  memoryUsage: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
  };
  /** Throughput thresholds (ops/sec) */
  throughput: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
  };
  /** CPU utilization thresholds (%) */
  cpuUtilization: {
    excellent: number;
    good: number;
    acceptable: number;
    poor: number;
  };
}

export class PerformanceAnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly context?: string
  ) {
    super(message);
    this.name = 'PerformanceAnalysisError';
  }
}

export class PerformanceAnalyzer {
  private logger: Logger;
  private thresholds: PerformanceThresholds;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.logger = new Logger({ component: 'PerformanceAnalyzer' });
    this.thresholds = {
      executionTime: {
        excellent: 1000,    // 1 second
        good: 5000,         // 5 seconds
        acceptable: 15000,  // 15 seconds
        poor: 30000,        // 30 seconds
      },
      memoryUsage: {
        excellent: 50 * 1024 * 1024,   // 50MB
        good: 200 * 1024 * 1024,       // 200MB
        acceptable: 500 * 1024 * 1024, // 500MB
        poor: 1024 * 1024 * 1024,      // 1GB
      },
      throughput: {
        excellent: 1000,    // 1000 ops/sec
        good: 500,          // 500 ops/sec
        acceptable: 100,    // 100 ops/sec
        poor: 50,           // 50 ops/sec
      },
      cpuUtilization: {
        excellent: 50,      // 50%
        good: 70,           // 70%
        acceptable: 85,     // 85%
        poor: 95,           // 95%
      },
      ...thresholds,
    };
  }

  /**
   * Analyze benchmark results and generate insights
   */
  async analyzeBenchmarkResults(result: BenchmarkResult): Promise<PerformanceInsights> {
    try {
      this.logger.debug('Analyzing benchmark results', {
        scenarios: result.scenarios.length,
        timestamp: result.timestamp,
      });

      const bottlenecks = this.identifyBottlenecks(result.scenarios);
      const trends = this.analyzeTrends(result);
      const resourceUtilization = this.analyzeResourceUtilization(result.scenarios);
      const scalability = this.analyzeScalability(result.scenarios);
      const recommendations = this.generateRecommendations(bottlenecks, resourceUtilization);
      const score = this.calculatePerformanceScore(result.scenarios, bottlenecks);
      const grade = this.getPerformanceGrade(score);

      const insights: PerformanceInsights = {
        grade,
        score,
        bottlenecks,
        trends,
        resourceUtilization,
        scalability,
        recommendations,
      };

      this.logger.info('Performance analysis completed', {
        grade,
        score,
        bottlenecks: bottlenecks.length,
        recommendations: recommendations.length,
      });

      return insights;
    } catch (error) {
      this.logger.error('Performance analysis failed', { error });
      throw new PerformanceAnalysisError(
        'Failed to analyze benchmark results',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(scenarios: PerformanceMetrics[]): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    for (const scenario of scenarios) {
      // Execution time bottlenecks
      if (scenario.totalExecutionTime > this.thresholds.executionTime.acceptable) {
        const severity = this.getExecutionTimeSeverity(scenario.totalExecutionTime);
        bottlenecks.push({
          component: scenario.scenario.name,
          type: 'latency',
          severity,
          impact: this.calculateImpact(scenario.totalExecutionTime, this.thresholds.executionTime.excellent, 80),
          description: `Execution time ${Math.round(scenario.totalExecutionTime)}ms exceeds acceptable threshold`,
          currentValue: scenario.totalExecutionTime,
          recommendedThreshold: this.thresholds.executionTime.good,
          optimizations: [
            'Implement operation batching',
            'Add caching for repeated operations',
            'Consider parallel processing',
            'Optimize algorithm complexity',
          ],
          relatedMetrics: [
            { metric: 'Operations per second', value: scenario.throughput.operationsPerSecond, unit: 'ops/sec' },
            { metric: 'Memory usage', value: scenario.memoryUsage.peak, unit: 'bytes' },
          ],
        });
      }

      // Memory usage bottlenecks
      if (scenario.memoryUsage.peak > this.thresholds.memoryUsage.acceptable) {
        const severity = this.getMemoryUsageSeverity(scenario.memoryUsage.peak);
        bottlenecks.push({
          component: scenario.scenario.name,
          type: 'memory',
          severity,
          impact: this.calculateImpact(scenario.memoryUsage.peak, this.thresholds.memoryUsage.excellent, 70),
          description: `Memory usage ${Math.round(scenario.memoryUsage.peak / 1024 / 1024)}MB exceeds acceptable threshold`,
          currentValue: scenario.memoryUsage.peak,
          recommendedThreshold: this.thresholds.memoryUsage.good,
          optimizations: [
            'Implement memory pooling',
            'Add garbage collection hints',
            'Stream large data instead of loading in memory',
            'Optimize data structures',
          ],
          relatedMetrics: [
            { metric: 'Memory delta', value: scenario.memoryUsage.delta, unit: 'bytes' },
            { metric: 'File count', value: scenario.scenario.fileCount, unit: 'files' },
          ],
        });
      }

      // Throughput bottlenecks
      if (scenario.throughput.operationsPerSecond < this.thresholds.throughput.acceptable) {
        const severity = this.getThroughputSeverity(scenario.throughput.operationsPerSecond);
        bottlenecks.push({
          component: scenario.scenario.name,
          type: 'throughput',
          severity,
          impact: this.calculateImpact(this.thresholds.throughput.excellent, scenario.throughput.operationsPerSecond, 60),
          description: `Throughput ${Math.round(scenario.throughput.operationsPerSecond)} ops/sec below acceptable threshold`,
          currentValue: scenario.throughput.operationsPerSecond,
          recommendedThreshold: this.thresholds.throughput.good,
          optimizations: [
            'Implement parallel processing',
            'Optimize critical code paths',
            'Add operation caching',
            'Reduce I/O operations',
          ],
          relatedMetrics: [
            { metric: 'Execution time', value: scenario.totalExecutionTime, unit: 'ms' },
            { metric: 'CPU utilization', value: scenario.cpuUsage.utilization, unit: '%' },
          ],
        });
      }

      // CPU utilization bottlenecks
      if (scenario.cpuUsage.utilization > this.thresholds.cpuUtilization.acceptable) {
        const severity = this.getCpuUtilizationSeverity(scenario.cpuUsage.utilization);
        bottlenecks.push({
          component: scenario.scenario.name,
          type: 'cpu',
          severity,
          impact: this.calculateImpact(scenario.cpuUsage.utilization, this.thresholds.cpuUtilization.excellent, 50),
          description: `CPU utilization ${Math.round(scenario.cpuUsage.utilization)}% exceeds acceptable threshold`,
          currentValue: scenario.cpuUsage.utilization,
          recommendedThreshold: this.thresholds.cpuUtilization.good,
          optimizations: [
            'Optimize algorithms for better time complexity',
            'Implement worker thread pools',
            'Add CPU-intensive operation caching',
            'Consider async/await optimizations',
          ],
          relatedMetrics: [
            { metric: 'User time', value: scenario.cpuUsage.userTime, unit: 'ms' },
            { metric: 'System time', value: scenario.cpuUsage.systemTime, unit: 'ms' },
          ],
        });
      }

      // Component-specific bottlenecks
      this.analyzeComponentBottlenecks(scenario, bottlenecks);
    }

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Analyze component-specific bottlenecks
   */
  private analyzeComponentBottlenecks(scenario: PerformanceMetrics, bottlenecks: PerformanceBottleneck[]): void {
    const timing = scenario.componentTiming;

    // Report generation bottleneck
    if (timing.reportGeneration && timing.reportGeneration > 5000) { // 5 seconds
      bottlenecks.push({
        component: `${scenario.scenario.name} - Report Generation`,
        type: 'latency',
        severity: timing.reportGeneration > 15000 ? 'high' : 'medium',
        impact: Math.min(100, (timing.reportGeneration / scenario.totalExecutionTime) * 100),
        description: `Report generation takes ${Math.round(timing.reportGeneration)}ms`,
        currentValue: timing.reportGeneration,
        recommendedThreshold: 3000,
        optimizations: [
          'Implement incremental report generation',
          'Cache report templates',
          'Optimize data serialization',
          'Use streaming for large reports',
        ],
        relatedMetrics: [
          { metric: 'Total execution time', value: scenario.totalExecutionTime, unit: 'ms' },
        ],
      });
    }

    // Visual diff generation bottleneck
    if (timing.visualDiffGeneration && timing.visualDiffGeneration > 8000) { // 8 seconds
      bottlenecks.push({
        component: `${scenario.scenario.name} - Visual Diff`,
        type: 'latency',
        severity: timing.visualDiffGeneration > 20000 ? 'high' : 'medium',
        impact: Math.min(100, (timing.visualDiffGeneration / scenario.totalExecutionTime) * 100),
        description: `Visual diff generation takes ${Math.round(timing.visualDiffGeneration)}ms`,
        currentValue: timing.visualDiffGeneration,
        recommendedThreshold: 5000,
        optimizations: [
          'Implement diff result caching',
          'Use more efficient diff algorithms',
          'Process diffs in parallel',
          'Limit diff context size',
        ],
        relatedMetrics: [
          { metric: 'File count', value: scenario.scenario.fileCount, unit: 'files' },
        ],
      });
    }

    // Impact estimation bottleneck
    if (timing.impactEstimation && timing.impactEstimation > 3000) { // 3 seconds
      bottlenecks.push({
        component: `${scenario.scenario.name} - Impact Estimation`,
        type: 'latency',
        severity: timing.impactEstimation > 10000 ? 'high' : 'medium',
        impact: Math.min(100, (timing.impactEstimation / scenario.totalExecutionTime) * 100),
        description: `Impact estimation takes ${Math.round(timing.impactEstimation)}ms`,
        currentValue: timing.impactEstimation,
        recommendedThreshold: 2000,
        optimizations: [
          'Cache dependency analysis results',
          'Optimize risk calculation algorithms',
          'Implement progressive analysis',
          'Use heuristics for large datasets',
        ],
        relatedMetrics: [
          { metric: 'Operations per file', value: scenario.scenario.operationsPerFile, unit: 'ops' },
        ],
      });
    }
  }

  /**
   * Analyze performance trends
   */
  private analyzeTrends(result: BenchmarkResult): PerformanceInsights['trends'] {
    const trends: PerformanceInsights['trends'] = [];

    // If we have regression data, analyze trends
    if (result.regression?.regressions) {
      for (const regression of result.regression.regressions) {
        trends.push({
          component: regression.component,
          metric: regression.metric,
          trend: 'degrading',
          changeRate: regression.changePercentage,
          recommendation: this.getTrendRecommendation(regression.metric, regression.changePercentage),
        });
      }
    }

    // Add stable trends for components without regressions
    const componentsWithRegressions = new Set(
      result.regression?.regressions.map(r => r.component) || []
    );

    for (const scenario of result.scenarios) {
      if (!componentsWithRegressions.has(scenario.scenario.name)) {
        trends.push({
          component: scenario.scenario.name,
          metric: 'Overall Performance',
          trend: 'stable',
          changeRate: 0,
          recommendation: 'Continue monitoring performance metrics',
        });
      }
    }

    return trends;
  }

  /**
   * Analyze resource utilization
   */
  private analyzeResourceUtilization(scenarios: PerformanceMetrics[]): PerformanceInsights['resourceUtilization'] {
    const cpuValues = scenarios.map(s => s.cpuUsage.utilization);
    const memoryValues = scenarios.map(s => s.memoryUsage.peak);
    const throughputValues = scenarios.map(s => s.throughput.operationsPerSecond);

    return {
      cpu: {
        average: this.average(cpuValues),
        peak: Math.max(...cpuValues),
        efficiency: this.calculateEfficiency(this.average(cpuValues), this.thresholds.cpuUtilization.excellent),
      },
      memory: {
        average: this.average(memoryValues),
        peak: Math.max(...memoryValues),
        efficiency: this.calculateEfficiency(this.thresholds.memoryUsage.excellent, this.average(memoryValues)),
      },
      io: {
        throughput: this.average(throughputValues),
        latency: this.average(scenarios.map(s => s.totalExecutionTime)),
        efficiency: this.calculateEfficiency(this.average(throughputValues), this.thresholds.throughput.excellent),
      },
    };
  }

  /**
   * Analyze scalability
   */
  private analyzeScalability(scenarios: PerformanceMetrics[]): PerformanceInsights['scalability'] {
    // Find scaling relationship between file count and execution time
    const fileCountToTimeRatio = scenarios.map(s => s.totalExecutionTime / s.scenario.fileCount);
    const averageRatio = this.average(fileCountToTimeRatio);
    
    // Estimate capacity based on acceptable execution time
    const estimatedCapacity = Math.floor(this.thresholds.executionTime.acceptable / averageRatio);
    const maxFileCount = Math.max(...scenarios.map(s => s.scenario.fileCount));
    const currentUtilization = (maxFileCount / estimatedCapacity) * 100;

    const scalingFactor = this.calculateScalingFactor(scenarios);

    return {
      estimatedCapacity,
      currentUtilization,
      scalingFactor,
      recommendations: this.getScalabilityRecommendations(currentUtilization, scalingFactor),
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    bottlenecks: PerformanceBottleneck[],
    resourceUtilization: PerformanceInsights['resourceUtilization']
  ): PerformanceInsights['recommendations'] {
    const recommendations: PerformanceInsights['recommendations'] = [];

    // High-priority recommendations from critical bottlenecks
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    for (const bottleneck of criticalBottlenecks) {
      recommendations.push({
        priority: 'high',
        category: this.getRecommendationCategory(bottleneck.type),
        description: `Address ${bottleneck.component} ${bottleneck.type} bottleneck: ${bottleneck.optimizations[0]}`,
        expectedImprovement: Math.min(50, bottleneck.impact),
        implementationComplexity: 'medium',
      });
    }

    // Memory optimization recommendations
    if (resourceUtilization.memory.efficiency < 50) {
      recommendations.push({
        priority: 'high',
        category: 'memory',
        description: 'Implement memory optimization strategies to reduce peak usage',
        expectedImprovement: 30,
        implementationComplexity: 'medium',
      });
    }

    // CPU optimization recommendations
    if (resourceUtilization.cpu.efficiency < 60) {
      recommendations.push({
        priority: 'medium',
        category: 'algorithmic',
        description: 'Optimize algorithms to reduce CPU utilization',
        expectedImprovement: 25,
        implementationComplexity: 'high',
      });
    }

    // I/O optimization recommendations
    if (resourceUtilization.io.efficiency < 70) {
      recommendations.push({
        priority: 'medium',
        category: 'io',
        description: 'Implement I/O optimizations and caching strategies',
        expectedImprovement: 35,
        implementationComplexity: 'low',
      });
    }

    // Parallelization recommendations
    const hasHighLatency = bottlenecks.some(b => b.type === 'latency' && b.severity === 'high');
    if (hasHighLatency) {
      recommendations.push({
        priority: 'high',
        category: 'parallelization',
        description: 'Implement parallel processing for time-intensive operations',
        expectedImprovement: 40,
        implementationComplexity: 'high',
      });
    }

    // Caching recommendations
    const hasRepeatedOperations = bottlenecks.some(b => b.component.includes('Report') || b.component.includes('Diff'));
    if (hasRepeatedOperations) {
      recommendations.push({
        priority: 'medium',
        category: 'caching',
        description: 'Implement intelligent caching for expensive operations',
        expectedImprovement: 20,
        implementationComplexity: 'low',
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(scenarios: PerformanceMetrics[], bottlenecks: PerformanceBottleneck[]): number {
    let score = 100;

    // Deduct points for bottlenecks
    for (const bottleneck of bottlenecks) {
      const deduction = this.getBottleneckScoreDeduction(bottleneck.severity, bottleneck.impact);
      score -= deduction;
    }

    // Deduct points for poor individual scenario performance
    for (const scenario of scenarios) {
      if (scenario.totalExecutionTime > this.thresholds.executionTime.poor) score -= 10;
      if (scenario.memoryUsage.peak > this.thresholds.memoryUsage.poor) score -= 10;
      if (scenario.throughput.operationsPerSecond < this.thresholds.throughput.poor) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get performance grade
   */
  private getPerformanceGrade(score: number): PerformanceInsights['grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Helper methods
   */
  private getExecutionTimeSeverity(time: number): PerformanceBottleneck['severity'] {
    if (time > this.thresholds.executionTime.poor) return 'critical';
    if (time > this.thresholds.executionTime.acceptable) return 'high';
    if (time > this.thresholds.executionTime.good) return 'medium';
    return 'low';
  }

  private getMemoryUsageSeverity(memory: number): PerformanceBottleneck['severity'] {
    if (memory > this.thresholds.memoryUsage.poor) return 'critical';
    if (memory > this.thresholds.memoryUsage.acceptable) return 'high';
    if (memory > this.thresholds.memoryUsage.good) return 'medium';
    return 'low';
  }

  private getThroughputSeverity(throughput: number): PerformanceBottleneck['severity'] {
    if (throughput < this.thresholds.throughput.poor) return 'critical';
    if (throughput < this.thresholds.throughput.acceptable) return 'high';
    if (throughput < this.thresholds.throughput.good) return 'medium';
    return 'low';
  }

  private getCpuUtilizationSeverity(cpu: number): PerformanceBottleneck['severity'] {
    if (cpu > this.thresholds.cpuUtilization.poor) return 'critical';
    if (cpu > this.thresholds.cpuUtilization.acceptable) return 'high';
    if (cpu > this.thresholds.cpuUtilization.good) return 'medium';
    return 'low';
  }

  private calculateImpact(current: number, ideal: number, maxImpact: number): number {
    const ratio = Math.abs(current - ideal) / ideal;
    return Math.min(maxImpact, ratio * 100);
  }

  private average(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateEfficiency(actual: number, ideal: number): number {
    return Math.min(100, (ideal / actual) * 100);
  }

  private calculateScalingFactor(scenarios: PerformanceMetrics[]): number {
    // Calculate how performance scales with file count
    const ratios = scenarios.map(s => s.totalExecutionTime / s.scenario.fileCount);
    const minRatio = Math.min(...ratios);
    const maxRatio = Math.max(...ratios);
    return maxRatio / minRatio; // Higher values indicate poor scaling
  }

  private getTrendRecommendation(metric: string, changeRate: number): string {
    if (changeRate > 50) return `Critical regression in ${metric} - immediate investigation required`;
    if (changeRate > 25) return `Significant regression in ${metric} - optimization needed`;
    if (changeRate > 10) return `Moderate regression in ${metric} - monitor closely`;
    return `Minor regression in ${metric} - consider optimization`;
  }

  private getScalabilityRecommendations(utilization: number, scalingFactor: number): string[] {
    const recommendations: string[] = [];

    if (utilization > 80) {
      recommendations.push('System approaching capacity limits');
      recommendations.push('Consider implementing load balancing');
    }

    if (scalingFactor > 2) {
      recommendations.push('Poor scaling characteristics detected');
      recommendations.push('Implement more efficient algorithms');
      recommendations.push('Consider parallel processing');
    }

    if (recommendations.length === 0) {
      recommendations.push('Good scalability characteristics');
      recommendations.push('Continue monitoring as workload increases');
    }

    return recommendations;
  }

  private getRecommendationCategory(type: PerformanceBottleneck['type']): PerformanceInsights['recommendations'][0]['category'] {
    switch (type) {
      case 'cpu': return 'algorithmic';
      case 'memory': return 'memory';
      case 'io': return 'io';
      case 'throughput': return 'parallelization';
      case 'latency': return 'caching';
      default: return 'algorithmic';
    }
  }

  private getBottleneckScoreDeduction(severity: PerformanceBottleneck['severity'], impact: number): number {
    const severityMultiplier = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 1.0,
    }[severity];

    return Math.min(20, impact * severityMultiplier * 0.2);
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.debug('Updated performance thresholds', thresholds);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }
}

/**
 * Global performance analyzer instance
 */
let globalPerformanceAnalyzer: PerformanceAnalyzer | null = null;

/**
 * Get the global performance analyzer
 */
export function getPerformanceAnalyzer(): PerformanceAnalyzer {
  if (!globalPerformanceAnalyzer) {
    globalPerformanceAnalyzer = new PerformanceAnalyzer();
  }
  return globalPerformanceAnalyzer;
}

/**
 * Create a new performance analyzer
 */
export function createPerformanceAnalyzer(thresholds?: Partial<PerformanceThresholds>): PerformanceAnalyzer {
  return new PerformanceAnalyzer(thresholds);
}

/**
 * Analyze performance in one step
 */
export async function analyzePerformance(result: BenchmarkResult): Promise<PerformanceInsights> {
  const analyzer = getPerformanceAnalyzer();
  return analyzer.analyzeBenchmarkResults(result);
}

export default PerformanceAnalyzer;