import { createLogger } from '../../utils/logger';
import {
  BenchmarkReport,
  BenchmarkResult,
  BenchmarkComparison,
  BenchmarkDifference,
  BenchmarkRegression,
  BenchmarkImprovement,
  BenchmarkThreshold,
  ComparisonVerdict,
} from '../types';
import { StatisticsCalculator } from '../utils/StatisticsCalculator';

const logger = createLogger('ResultComparator');

/**
 * Comparison options for customizing analysis
 */
export interface ComparisonOptions {
  threshold: BenchmarkThreshold;
  includeStatisticalSignificance: boolean;
  significanceLevel: number; // p-value threshold
  minimumSampleSize: number;
  ignoreFailedBenchmarks: boolean;
  metricWeights: Record<string, number>;
  customComparisons: CustomComparison[];
}

/**
 * Custom comparison function
 */
export interface CustomComparison {
  name: string;
  description: string;
  compare: (baseline: BenchmarkResult, current: BenchmarkResult) => BenchmarkDifference | null;
  isRegression: (difference: BenchmarkDifference) => boolean;
}

/**
 * Default comparison options
 */
const DEFAULT_COMPARISON_OPTIONS: ComparisonOptions = {
  threshold: {
    performanceRegression: 10,
    memoryIncrease: 20,
    errorRate: 5,
    minIterations: 5,
    maxVariance: 0.2,
  },
  includeStatisticalSignificance: true,
  significanceLevel: 0.05,
  minimumSampleSize: 3,
  ignoreFailedBenchmarks: false,
  metricWeights: {
    duration: 1.0,
    memoryUsage: 0.8,
    optimizationRatio: 0.6,
    cacheHitRatio: 0.4,
  },
  customComparisons: [],
};

/**
 * Compares benchmark results and identifies regressions/improvements
 */
export class ResultComparator {
  private options: ComparisonOptions;
  private statisticsCalculator: StatisticsCalculator;

  constructor(options: Partial<ComparisonOptions> = {}) {
    this.options = { ...DEFAULT_COMPARISON_OPTIONS, ...options };
    this.statisticsCalculator = new StatisticsCalculator();

    logger.debug('ResultComparator initialized', {
      threshold: this.options.threshold,
      includeStatisticalSignificance: this.options.includeStatisticalSignificance,
    });
  }

  /**
   * Compare two benchmark reports
   */
  async compare(baseline: BenchmarkReport, current: BenchmarkReport): Promise<BenchmarkComparison> {
    logger.info('Starting benchmark comparison', {
      baseline: baseline.suite,
      current: current.suite,
      baselineResults: baseline.results.length,
      currentResults: current.results.length,
    });

    try {
      // Validate reports
      this.validateReports(baseline, current);

      // Find matching benchmarks
      const matchingPairs = this.findMatchingBenchmarks(baseline.results, current.results);
      
      if (matchingPairs.length === 0) {
        throw new Error('No matching benchmarks found between baseline and current reports');
      }

      // Calculate differences for each matching pair
      const differences = await this.calculateDifferences(matchingPairs);

      // Identify regressions and improvements
      const regressions = this.identifyRegressions(differences);
      const improvements = this.identifyImprovements(differences);

      // Determine overall verdict
      const verdict = this.determineVerdict(differences, regressions, improvements);

      const comparison: BenchmarkComparison = {
        baseline,
        current,
        differences,
        regressions,
        improvements,
        verdict,
      };

      logger.info('Benchmark comparison completed', {
        matchingBenchmarks: matchingPairs.length,
        differences: differences.length,
        regressions: regressions.length,
        improvements: improvements.length,
        verdict,
      });

      return comparison;
    } catch (error) {
      logger.error('Benchmark comparison failed', { error });
      throw error;
    }
  }

  /**
   * Compare specific metrics between two results
   */
  compareMetric(
    metric: string,
    baselineValue: number,
    currentValue: number,
    benchmarkName: string
  ): BenchmarkDifference {
    const difference = currentValue - baselineValue;
    const percentageChange = baselineValue !== 0 ? (difference / baselineValue) * 100 : 0;
    
    // Determine significance
    const significant = this.isSignificantChange(metric, percentageChange);
    
    // Determine trend
    let trend: 'improvement' | 'regression' | 'neutral';
    if (this.isImprovement(metric, percentageChange)) {
      trend = 'improvement';
    } else if (this.isRegression(metric, percentageChange)) {
      trend = 'regression';
    } else {
      trend = 'neutral';
    }

    return {
      benchmarkName,
      metric,
      baselineValue,
      currentValue,
      difference,
      percentageChange,
      significant,
      trend,
    };
  }

  /**
   * Update comparison options
   */
  updateOptions(options: Partial<ComparisonOptions>): void {
    this.options = { ...this.options, ...options };
    logger.debug('Comparison options updated', { options });
  }

  /**
   * Get current comparison options
   */
  getOptions(): ComparisonOptions {
    return { ...this.options };
  }

  /**
   * Validate that reports can be compared
   */
  private validateReports(baseline: BenchmarkReport, current: BenchmarkReport): void {
    if (!baseline.results || baseline.results.length === 0) {
      throw new Error('Baseline report has no results');
    }

    if (!current.results || current.results.length === 0) {
      throw new Error('Current report has no results');
    }

    // Check if environments are significantly different
    const envDifferences = this.compareEnvironments(baseline.environment, current.environment);
    if (envDifferences.length > 0) {
      logger.warn('Environment differences detected', { differences: envDifferences });
    }
  }

  /**
   * Find matching benchmarks between two result sets
   */
  private findMatchingBenchmarks(
    baselineResults: BenchmarkResult[],
    currentResults: BenchmarkResult[]
  ): Array<{ baseline: BenchmarkResult; current: BenchmarkResult }> {
    const matchingPairs: Array<{ baseline: BenchmarkResult; current: BenchmarkResult }> = [];

    for (const baselineResult of baselineResults) {
      const currentResult = currentResults.find(r => r.name === baselineResult.name);
      
      if (currentResult) {
        // Filter out failed benchmarks if configured
        if (this.options.ignoreFailedBenchmarks && 
            (!baselineResult.success || !currentResult.success)) {
          continue;
        }

        matchingPairs.push({
          baseline: baselineResult,
          current: currentResult,
        });
      }
    }

    return matchingPairs;
  }

  /**
   * Calculate differences for all matching benchmark pairs
   */
  private async calculateDifferences(
    matchingPairs: Array<{ baseline: BenchmarkResult; current: BenchmarkResult }>
  ): Promise<BenchmarkDifference[]> {
    const differences: BenchmarkDifference[] = [];

    for (const { baseline, current } of matchingPairs) {
      // Core performance metrics
      differences.push(
        this.compareMetric('duration', baseline.duration, current.duration, baseline.name)
      );

      // Memory metrics
      if (baseline.metrics.memoryUsage && current.metrics.memoryUsage) {
        differences.push(
          this.compareMetric(
            'memoryUsage.heapUsed',
            baseline.metrics.memoryUsage.heapUsed,
            current.metrics.memoryUsage.heapUsed,
            baseline.name
          )
        );
      }

      // Throughput metrics
      differences.push(
        this.compareMetric(
          'filesProcessed',
          baseline.metrics.filesProcessed,
          current.metrics.filesProcessed,
          baseline.name
        )
      );

      differences.push(
        this.compareMetric(
          'bytesProcessed',
          baseline.metrics.bytesProcessed,
          current.metrics.bytesProcessed,
          baseline.name
        )
      );

      // Cache metrics
      const baselineCacheRatio = this.calculateCacheHitRatio(baseline);
      const currentCacheRatio = this.calculateCacheHitRatio(current);
      
      differences.push(
        this.compareMetric(
          'cacheHitRatio',
          baselineCacheRatio,
          currentCacheRatio,
          baseline.name
        )
      );

      // Optimization ratio
      differences.push(
        this.compareMetric(
          'optimizationRatio',
          baseline.metrics.optimizationRatio,
          current.metrics.optimizationRatio,
          baseline.name
        )
      );

      // Custom metrics
      const customDifferences = this.compareCustomMetrics(baseline, current);
      differences.push(...customDifferences);

      // Apply custom comparisons
      for (const customComparison of this.options.customComparisons) {
        const customDiff = customComparison.compare(baseline, current);
        if (customDiff) {
          differences.push(customDiff);
        }
      }
    }

    return differences;
  }

  /**
   * Compare custom metrics between two results
   */
  private compareCustomMetrics(baseline: BenchmarkResult, current: BenchmarkResult): BenchmarkDifference[] {
    const differences: BenchmarkDifference[] = [];
    const allCustomMetrics = new Set([
      ...Object.keys(baseline.metrics.customMetrics),
      ...Object.keys(current.metrics.customMetrics),
    ]);

    for (const metricName of allCustomMetrics) {
      const baselineValue = baseline.metrics.customMetrics[metricName] || 0;
      const currentValue = current.metrics.customMetrics[metricName] || 0;

      differences.push(
        this.compareMetric(
          `custom.${metricName}`,
          baselineValue,
          currentValue,
          baseline.name
        )
      );
    }

    return differences;
  }

  /**
   * Calculate cache hit ratio from benchmark result
   */
  private calculateCacheHitRatio(result: BenchmarkResult): number {
    const hits = result.metrics.cacheHits;
    const misses = result.metrics.cacheMisses;
    const total = hits + misses;
    return total > 0 ? hits / total : 0;
  }

  /**
   * Identify regressions from differences
   */
  private identifyRegressions(differences: BenchmarkDifference[]): BenchmarkRegression[] {
    const regressions: BenchmarkRegression[] = [];

    for (const diff of differences) {
      if (diff.trend === 'regression' && diff.significant) {
        const severity = this.assessRegressionSeverity(diff);
        const recommendation = this.generateRegressionRecommendation(diff);

        regressions.push({
          benchmarkName: diff.benchmarkName,
          metric: diff.metric,
          degradation: Math.abs(diff.percentageChange),
          severity,
          threshold: this.getThresholdForMetric(diff.metric),
          recommendation,
        });
      }
    }

    return regressions.sort((a, b) => {
      const severityOrder = { critical: 3, major: 2, minor: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Identify improvements from differences
   */
  private identifyImprovements(differences: BenchmarkDifference[]): BenchmarkImprovement[] {
    const improvements: BenchmarkImprovement[] = [];

    for (const diff of differences) {
      if (diff.trend === 'improvement' && diff.significant) {
        const significance = this.assessImprovementSignificance(diff);

        improvements.push({
          benchmarkName: diff.benchmarkName,
          metric: diff.metric,
          improvement: Math.abs(diff.percentageChange),
          significance,
        });
      }
    }

    return improvements.sort((a, b) => {
      const significanceOrder = { significant: 3, moderate: 2, minor: 1 };
      return significanceOrder[b.significance] - significanceOrder[a.significance];
    });
  }

  /**
   * Determine overall comparison verdict
   */
  private determineVerdict(
    differences: BenchmarkDifference[],
    regressions: BenchmarkRegression[],
    improvements: BenchmarkImprovement[]
  ): ComparisonVerdict {
    // Check for critical regressions
    const criticalRegressions = regressions.filter(r => r.severity === 'critical');
    if (criticalRegressions.length > 0) {
      return 'fail';
    }

    // Check for major regressions
    const majorRegressions = regressions.filter(r => r.severity === 'major');
    if (majorRegressions.length > 0) {
      return 'warning';
    }

    // Check overall error rate
    const failedComparisons = differences.filter(d => d.trend === 'regression').length;
    const errorRate = (failedComparisons / differences.length) * 100;
    
    if (errorRate > this.options.threshold.errorRate) {
      return 'warning';
    }

    // Check if we have sufficient data
    const sufficientData = differences.length >= this.options.threshold.minIterations;
    if (!sufficientData) {
      return 'warning';
    }

    return 'pass';
  }

  /**
   * Check if a change is statistically significant
   */
  private isSignificantChange(metric: string, percentageChange: number): boolean {
    const threshold = this.getThresholdForMetric(metric);
    return Math.abs(percentageChange) >= threshold;
  }

  /**
   * Check if a change represents an improvement
   */
  private isImprovement(metric: string, percentageChange: number): boolean {
    // Define metrics where lower values are better
    const lowerIsBetter = ['duration', 'memoryUsage.heapUsed', 'errorRate'];
    const higherIsBetter = ['optimizationRatio', 'cacheHitRatio', 'filesProcessed', 'bytesProcessed'];

    if (lowerIsBetter.some(m => metric.includes(m))) {
      return percentageChange < 0;
    } else if (higherIsBetter.some(m => metric.includes(m))) {
      return percentageChange > 0;
    }

    return false;
  }

  /**
   * Check if a change represents a regression
   */
  private isRegression(metric: string, percentageChange: number): boolean {
    return !this.isImprovement(metric, percentageChange) && 
           this.isSignificantChange(metric, percentageChange);
  }

  /**
   * Get threshold for specific metric
   */
  private getThresholdForMetric(metric: string): number {
    if (metric.includes('duration')) {
      return this.options.threshold.performanceRegression;
    } else if (metric.includes('memory')) {
      return this.options.threshold.memoryIncrease;
    } else if (metric.includes('error')) {
      return this.options.threshold.errorRate;
    }

    return this.options.threshold.performanceRegression; // Default
  }

  /**
   * Assess regression severity
   */
  private assessRegressionSeverity(diff: BenchmarkDifference): 'minor' | 'major' | 'critical' {
    const change = Math.abs(diff.percentageChange);
    
    if (change >= 50) {
      return 'critical';
    } else if (change >= 25) {
      return 'major';
    }
    
    return 'minor';
  }

  /**
   * Assess improvement significance
   */
  private assessImprovementSignificance(diff: BenchmarkDifference): 'minor' | 'moderate' | 'significant' {
    const change = Math.abs(diff.percentageChange);
    
    if (change >= 30) {
      return 'significant';
    } else if (change >= 15) {
      return 'moderate';
    }
    
    return 'minor';
  }

  /**
   * Generate recommendation for regression
   */
  private generateRegressionRecommendation(diff: BenchmarkDifference): string {
    const metricType = diff.metric.split('.')[0];
    
    switch (metricType) {
      case 'duration':
        return 'Investigate recent algorithm changes, consider profiling CPU-intensive operations';
      case 'memoryUsage':
        return 'Check for memory leaks, review object lifecycle management';
      case 'cacheHitRatio':
        return 'Review cache configuration and invalidation strategies';
      case 'optimizationRatio':
        return 'Analyze optimization pipeline efficiency and pattern detection';
      default:
        return 'Investigate recent changes that might affect this metric';
    }
  }

  /**
   * Compare environments for significant differences
   */
  private compareEnvironments(baseline: any, current: any): string[] {
    const differences: string[] = [];

    if (baseline.nodeVersion !== current.nodeVersion) {
      differences.push(`Node.js version: ${baseline.nodeVersion} → ${current.nodeVersion}`);
    }

    if (baseline.platform !== current.platform) {
      differences.push(`Platform: ${baseline.platform} → ${current.platform}`);
    }

    if (Math.abs(baseline.cpuCores - current.cpuCores) > 0) {
      differences.push(`CPU cores: ${baseline.cpuCores} → ${current.cpuCores}`);
    }

    return differences;
  }
}