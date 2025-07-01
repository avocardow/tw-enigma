/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import type {
  ConvergenceResult,
  MultiPassDiscoveryConfig,
  PassMetrics,
} from './multiPassDiscovery';

/**
 * Advanced convergence detection configuration
 */
export const ConvergenceDetectionConfigSchema = z.object({
  // Basic thresholds
  convergenceThreshold: z.number().min(0).max(1).default(0.05),
  minimumImprovement: z.number().min(0).max(1).default(0.01),

  // Advanced detection algorithms
  enableTrendAnalysis: z.boolean().default(true),
  enableStatisticalTests: z.boolean().default(true),
  enableEarlyStoppingDetection: z.boolean().default(true),
  enableOscillationDetection: z.boolean().default(true),

  // Window sizes for analysis
  trendAnalysisWindow: z.number().min(2).max(20).default(5),
  statisticalTestWindow: z.number().min(3).max(30).default(10),
  oscillationDetectionWindow: z.number().min(3).max(15).default(7),

  // Statistical significance levels
  pValueThreshold: z.number().min(0).max(1).default(0.05),
  confidenceLevel: z.number().min(0.5).max(0.99).default(0.95),

  // Early stopping parameters
  patienceThreshold: z.number().min(1).max(20).default(5),
  earlyStoppingDelta: z.number().min(0).max(1).default(0.001),

  // Oscillation detection
  oscillationThreshold: z.number().min(0).max(1).default(0.02),
  maxOscillationCycles: z.number().min(2).max(10).default(3),

  // Adaptive parameters
  enableAdaptiveThresholds: z.boolean().default(true),
  adaptiveThresholdFactor: z.number().min(0.1).max(10).default(1.5),

  // Quality assurance
  minimumRequiredPasses: z.number().min(2).max(10).default(3),
  maxAllowedStagnation: z.number().min(2).max(20).default(8),
});

export type ConvergenceDetectionConfig = z.infer<typeof ConvergenceDetectionConfigSchema>;

/**
 * Statistical test result for convergence detection
 */
export interface StatisticalTestResult {
  testName: string;
  pValue: number;
  isSignificant: boolean;
  statistic: number;
  criticalValue?: number;
  interpretation: string;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysisResult {
  trend: 'increasing' | 'decreasing' | 'stable' | 'oscillating';
  slope: number;
  correlation: number;
  confidence: number;
  prediction: number;
  rSquared: number;
}

/**
 * Early stopping analysis result
 */
export interface EarlyStoppingResult {
  shouldStop: boolean;
  reason: string;
  patienceCount: number;
  bestScore: number;
  currentScore: number;
  stagnationPeriod: number;
}

/**
 * Oscillation detection result
 */
export interface OscillationResult {
  isOscillating: boolean;
  cycleLength: number;
  amplitude: number;
  frequency: number;
  dampingFactor: number;
}

/**
 * Comprehensive convergence analysis result
 */
export interface ConvergenceAnalysisResult extends ConvergenceResult {
  statisticalTests: StatisticalTestResult[];
  trendAnalysis: TrendAnalysisResult;
  earlyStoppingAnalysis: EarlyStoppingResult;
  oscillationAnalysis: OscillationResult;
  adaptiveThresholds: {
    adjustedConvergenceThreshold: number;
    adjustedMinimumImprovement: number;
    adaptationReason: string;
  };
  qualityAssurance: {
    passesQualityCheck: boolean;
    issues: string[];
    recommendations: string[];
  };
}

/**
 * Advanced convergence detection engine
 */
export class AdvancedConvergenceDetector {
  private config: ConvergenceDetectionConfig;
  private stagnationCounter: number = 0;
  private bestScore: number = -Infinity;
  private patienceCounter: number = 0;
  private oscillationHistory: number[] = [];

  constructor(config: Partial<ConvergenceDetectionConfig> = {}) {
    this.config = ConvergenceDetectionConfigSchema.parse(config);
  }

  /**
   * Perform comprehensive convergence analysis
   */
  public analyzeConvergence(
    metrics: PassMetrics[],
    currentPass: number,
    baseConfig: MultiPassDiscoveryConfig
  ): ConvergenceAnalysisResult {
    // Validate input
    if (metrics.length === 0) {
      throw new Error('No metrics provided for convergence analysis');
    }

    // Basic convergence check
    const basicResult = this.performBasicConvergenceCheck(metrics, currentPass);

    // Advanced analyses
    const statisticalTests = this.config.enableStatisticalTests
      ? this.performStatisticalTests(metrics)
      : [];

    const trendAnalysis = this.config.enableTrendAnalysis
      ? this.analyzeTrend(metrics)
      : this.getDefaultTrendAnalysis();

    const earlyStoppingAnalysis = this.config.enableEarlyStoppingDetection
      ? this.analyzeEarlyStopping(metrics)
      : this.getDefaultEarlyStoppingAnalysis();

    const oscillationAnalysis = this.config.enableOscillationDetection
      ? this.detectOscillation(metrics)
      : this.getDefaultOscillationAnalysis();

    // Adaptive threshold adjustment
    const adaptiveThresholds = this.config.enableAdaptiveThresholds
      ? this.adjustThresholds(metrics, trendAnalysis)
      : this.getDefaultAdaptiveThresholds();

    // Quality assurance checks
    const qualityAssurance = this.performQualityAssurance(
      metrics,
      currentPass,
      trendAnalysis,
      oscillationAnalysis
    );

    // Combine all analyses to determine final convergence
    const finalConvergence = this.synthesizeConvergenceDecision(
      basicResult,
      statisticalTests,
      trendAnalysis,
      earlyStoppingAnalysis,
      oscillationAnalysis,
      qualityAssurance,
      currentPass
    );

    return {
      ...finalConvergence,
      statisticalTests,
      trendAnalysis,
      earlyStoppingAnalysis,
      oscillationAnalysis,
      adaptiveThresholds,
      qualityAssurance,
    };
  }

  /**
   * Perform basic convergence check (similar to original implementation but enhanced)
   */
  private performBasicConvergenceCheck(
    metrics: PassMetrics[],
    currentPass: number
  ): ConvergenceResult {
    if (metrics.length < 2) {
      return {
        hasConverged: false,
        convergenceReason: 'threshold_met',
        finalPass: currentPass,
        improvementTrend: [],
        confidenceScore: 0,
        stabilityMetrics: {
          patternStability: 0,
          sizeStability: 0,
          qualityStability: 0,
        },
      };
    }

    const lastMetrics = metrics[metrics.length - 1];
    const previousMetrics = metrics[metrics.length - 2];

    // Calculate improvements using multiple metrics
    const patternImprovement = this.calculatePatternImprovement(lastMetrics, previousMetrics);
    const efficiencyImprovement = this.calculateEfficiencyImprovement(lastMetrics, previousMetrics);
    const stabilityImprovement = this.calculateStabilityImprovement(lastMetrics, previousMetrics);

    // Multi-criteria convergence check
    const hasConverged = this.evaluateMultiCriteriaConvergence(
      patternImprovement,
      efficiencyImprovement,
      stabilityImprovement
    );

    const improvementTrend = this.calculateImprovementTrend(metrics);
    const stabilityMetrics = this.calculateStabilityMetrics(metrics);
    const confidenceScore = this.calculateConfidenceScore(metrics, hasConverged);

    return {
      hasConverged,
      convergenceReason: hasConverged ? 'threshold_met' : 'minimal_improvement',
      finalPass: currentPass,
      improvementTrend,
      confidenceScore,
      stabilityMetrics,
    };
  }

  /**
   * Calculate pattern improvement between consecutive passes
   */
  private calculatePatternImprovement(current: PassMetrics, previous: PassMetrics): number {
    const patternChange = Math.abs(current.patternsConsolidated - previous.patternsConsolidated);
    const baseValue = Math.max(previous.patternsConsolidated, 1);
    return patternChange / baseValue;
  }

  /**
   * Calculate efficiency improvement between consecutive passes
   */
  private calculateEfficiencyImprovement(current: PassMetrics, previous: PassMetrics): number {
    return Math.abs(current.consolidationEfficiency - previous.consolidationEfficiency);
  }

  /**
   * Calculate stability improvement between consecutive passes
   */
  private calculateStabilityImprovement(current: PassMetrics, previous: PassMetrics): number {
    return Math.abs(current.stabilityScore - previous.stabilityScore);
  }

  /**
   * Evaluate multi-criteria convergence using weighted scoring
   */
  private evaluateMultiCriteriaConvergence(
    patternImprovement: number,
    efficiencyImprovement: number,
    stabilityImprovement: number
  ): boolean {
    // Weighted scoring system for different improvement types
    const patternWeight = 0.4;
    const efficiencyWeight = 0.4;
    const stabilityWeight = 0.2;

    const weightedScore =
      patternWeight * (patternImprovement < this.config.minimumImprovement ? 1 : 0) +
      efficiencyWeight * (efficiencyImprovement < this.config.minimumImprovement ? 1 : 0) +
      stabilityWeight * (stabilityImprovement < this.config.convergenceThreshold ? 1 : 0);

    // Require at least 70% of criteria to be met
    return weightedScore >= 0.7;
  }

  /**
   * Perform statistical tests for convergence detection
   */
  private performStatisticalTests(metrics: PassMetrics[]): StatisticalTestResult[] {
    const results: StatisticalTestResult[] = [];

    if (metrics.length < this.config.statisticalTestWindow) {
      return results;
    }

    // Get recent window of metrics
    const recentMetrics = metrics.slice(-this.config.statisticalTestWindow);

    // Mann-Kendall trend test
    results.push(this.performMannKendallTest(recentMetrics));

    // Kolmogorov-Smirnov stationarity test
    results.push(this.performStationarityTest(recentMetrics));

    // CUSUM change point detection
    results.push(this.performChangePointDetection(recentMetrics));

    return results;
  }

  /**
   * Mann-Kendall trend test for detecting monotonic trends
   */
  private performMannKendallTest(metrics: PassMetrics[]): StatisticalTestResult {
    const values = metrics.map((m) => m.consolidationEfficiency);
    const n = values.length;

    let S = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        if (values[j] > values[i]) S++;
        else if (values[j] < values[i]) S--;
      }
    }

    const variance = (n * (n - 1) * (2 * n + 5)) / 18;
    const standardError = Math.sqrt(variance);
    const zStatistic = S / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zStatistic)));

    return {
      testName: 'Mann-Kendall Trend Test',
      pValue,
      isSignificant: pValue < this.config.pValueThreshold,
      statistic: zStatistic,
      interpretation:
        pValue < this.config.pValueThreshold
          ? 'Significant trend detected'
          : 'No significant trend detected',
    };
  }

  /**
   * Stationarity test using simplified Kolmogorov-Smirnov approach
   */
  private performStationarityTest(metrics: PassMetrics[]): StatisticalTestResult {
    const values = metrics.map((m) => m.consolidationEfficiency);
    const n = values.length;
    const midpoint = Math.floor(n / 2);

    const firstHalf = values.slice(0, midpoint);
    const secondHalf = values.slice(midpoint);

    const firstMean = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const pooledStd = Math.sqrt(
      (this.calculateVariance(firstHalf) + this.calculateVariance(secondHalf)) / 2
    );

    const tStatistic = Math.abs(firstMean - secondMean) / (pooledStd * Math.sqrt(2 / midpoint));
    const degreesOfFreedom = n - 2;
    const pValue = 2 * (1 - this.tCDF(tStatistic, degreesOfFreedom));

    return {
      testName: 'Stationarity Test',
      pValue,
      isSignificant: pValue < this.config.pValueThreshold,
      statistic: tStatistic,
      interpretation:
        pValue < this.config.pValueThreshold
          ? 'Series is non-stationary'
          : 'Series appears stationary',
    };
  }

  /**
   * CUSUM change point detection
   */
  private performChangePointDetection(metrics: PassMetrics[]): StatisticalTestResult {
    const values = metrics.map((m) => m.consolidationEfficiency);
    const n = values.length;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;

    let maxCusum = 0;
    let cusum = 0;

    for (const value of values) {
      cusum += value - mean;
      maxCusum = Math.max(maxCusum, Math.abs(cusum));
    }

    const standardError = Math.sqrt(this.calculateVariance(values) * n);
    const normalizedCusum = maxCusum / standardError;

    // Simplified critical value for change point detection
    const criticalValue = 1.36; // Approximate 95% confidence level
    const pValue = Math.exp(-2 * normalizedCusum * normalizedCusum);

    return {
      testName: 'CUSUM Change Point Detection',
      pValue,
      isSignificant: normalizedCusum > criticalValue,
      statistic: normalizedCusum,
      criticalValue,
      interpretation:
        normalizedCusum > criticalValue
          ? 'Change point detected in series'
          : 'No significant change point detected',
    };
  }

  /**
   * Analyze trend using linear regression and correlation analysis
   */
  private analyzeTrend(metrics: PassMetrics[]): TrendAnalysisResult {
    if (metrics.length < this.config.trendAnalysisWindow) {
      return this.getDefaultTrendAnalysis();
    }

    const recentMetrics = metrics.slice(-this.config.trendAnalysisWindow);
    const values = recentMetrics.map((m) => m.consolidationEfficiency);
    const indices = recentMetrics.map((_, i) => i);

    // Linear regression
    const regression = this.calculateLinearRegression(indices, values);

    // Determine trend type
    let trend: TrendAnalysisResult['trend'];
    if (Math.abs(regression.slope) < 0.001) {
      trend = 'stable';
    } else if (this.detectOscillationPattern(values)) {
      trend = 'oscillating';
    } else if (regression.slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Predict next value
    const prediction = regression.intercept + regression.slope * this.config.trendAnalysisWindow;

    return {
      trend,
      slope: regression.slope,
      correlation: regression.correlation,
      confidence: Math.abs(regression.correlation),
      prediction,
      rSquared: regression.rSquared,
    };
  }

  /**
   * Analyze early stopping conditions
   */
  private analyzeEarlyStopping(metrics: PassMetrics[]): EarlyStoppingResult {
    if (metrics.length === 0) {
      return this.getDefaultEarlyStoppingAnalysis();
    }

    const currentScore = metrics[metrics.length - 1].consolidationEfficiency;

    // Update best score and patience counter
    if (currentScore > this.bestScore + this.config.earlyStoppingDelta) {
      this.bestScore = currentScore;
      this.patienceCounter = 0;
    } else {
      this.patienceCounter++;
    }

    // Check for stagnation
    const recentScores = metrics
      .slice(-this.config.maxAllowedStagnation)
      .map((m) => m.consolidationEfficiency);
    const scoreVariance = this.calculateVariance(recentScores);
    const isStagnating = scoreVariance < this.config.earlyStoppingDelta;

    if (isStagnating) {
      this.stagnationCounter++;
    } else {
      this.stagnationCounter = 0;
    }

    const shouldStop =
      this.patienceCounter >= this.config.patienceThreshold ||
      this.stagnationCounter >= this.config.maxAllowedStagnation;

    let reason = '';
    if (this.patienceCounter >= this.config.patienceThreshold) {
      reason = 'Patience threshold exceeded - no improvement detected';
    } else if (this.stagnationCounter >= this.config.maxAllowedStagnation) {
      reason = 'Maximum stagnation period exceeded';
    }

    return {
      shouldStop,
      reason,
      patienceCount: this.patienceCounter,
      bestScore: this.bestScore,
      currentScore,
      stagnationPeriod: this.stagnationCounter,
    };
  }

  /**
   * Detect oscillation patterns in the metrics
   */
  private detectOscillation(metrics: PassMetrics[]): OscillationResult {
    if (metrics.length < this.config.oscillationDetectionWindow) {
      return this.getDefaultOscillationAnalysis();
    }

    const recentMetrics = metrics.slice(-this.config.oscillationDetectionWindow);
    const values = recentMetrics.map((m) => m.consolidationEfficiency);

    // Add to oscillation history
    this.oscillationHistory.push(values[values.length - 1]);
    if (this.oscillationHistory.length > this.config.oscillationDetectionWindow * 2) {
      this.oscillationHistory.shift();
    }

    // Detect oscillation using autocorrelation and peak detection
    const isOscillating = this.detectOscillationPattern(values);
    const cycleLength = this.estimateCycleLength(values);
    const amplitude = this.calculateOscillationAmplitude(values);
    const frequency = cycleLength > 0 ? 1 / cycleLength : 0;
    const dampingFactor = this.calculateDampingFactor(this.oscillationHistory);

    return {
      isOscillating,
      cycleLength,
      amplitude,
      frequency,
      dampingFactor,
    };
  }

  /**
   * Adjust thresholds based on analysis results
   */
  private adjustThresholds(
    metrics: PassMetrics[],
    trendAnalysis: TrendAnalysisResult
  ): ConvergenceAnalysisResult['adaptiveThresholds'] {
    let adjustedConvergenceThreshold = this.config.convergenceThreshold;
    let adjustedMinimumImprovement = this.config.minimumImprovement;
    let adaptationReason = 'No adaptation needed';

    // Adjust based on trend characteristics
    if (trendAnalysis.trend === 'oscillating') {
      adjustedConvergenceThreshold *= this.config.adaptiveThresholdFactor;
      adjustedMinimumImprovement *= this.config.adaptiveThresholdFactor;
      adaptationReason = 'Increased thresholds due to oscillating behavior';
    } else if (trendAnalysis.trend === 'stable' && trendAnalysis.confidence > 0.8) {
      adjustedConvergenceThreshold /= this.config.adaptiveThresholdFactor;
      adjustedMinimumImprovement /= this.config.adaptiveThresholdFactor;
      adaptationReason = 'Decreased thresholds due to stable convergence';
    } else if (Math.abs(trendAnalysis.slope) > 0.1) {
      adjustedMinimumImprovement *= 1.2;
      adaptationReason = 'Increased minimum improvement due to high volatility';
    }

    return {
      adjustedConvergenceThreshold,
      adjustedMinimumImprovement,
      adaptationReason,
    };
  }

  /**
   * Perform quality assurance checks on the convergence analysis
   */
  private performQualityAssurance(
    metrics: PassMetrics[],
    currentPass: number,
    trendAnalysis: TrendAnalysisResult,
    oscillationAnalysis: OscillationResult
  ): ConvergenceAnalysisResult['qualityAssurance'] {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check minimum required passes
    if (currentPass < this.config.minimumRequiredPasses) {
      issues.push(`Insufficient passes (${currentPass} < ${this.config.minimumRequiredPasses})`);
      recommendations.push('Continue optimization for more reliable convergence detection');
    }

    // Check for concerning patterns
    if (oscillationAnalysis.isOscillating && oscillationAnalysis.amplitude > 0.1) {
      issues.push('High-amplitude oscillations detected');
      recommendations.push('Consider increasing convergence thresholds or damping parameters');
    }

    if (trendAnalysis.confidence < 0.5) {
      issues.push('Low confidence in trend analysis');
      recommendations.push('Collect more data points for reliable trend detection');
    }

    // Check metric quality
    const recentMetrics = metrics.slice(-5);
    const hasZeroPatterns = recentMetrics.some((m) => m.patternsConsolidated === 0);
    if (hasZeroPatterns) {
      issues.push('Zero patterns detected in recent passes');
      recommendations.push('Verify pattern detection is working correctly');
    }

    const passesQualityCheck = issues.length === 0;

    return {
      passesQualityCheck,
      issues,
      recommendations,
    };
  }

  /**
   * Synthesize final convergence decision from all analyses
   */
  private synthesizeConvergenceDecision(
    basicResult: ConvergenceResult,
    statisticalTests: StatisticalTestResult[],
    trendAnalysis: TrendAnalysisResult,
    earlyStoppingAnalysis: EarlyStoppingResult,
    oscillationAnalysis: OscillationResult,
    qualityAssurance: ConvergenceAnalysisResult['qualityAssurance'],
    currentPass: number
  ): ConvergenceResult {
    // Start with basic result
    let hasConverged = basicResult.hasConverged;
    let convergenceReason = basicResult.convergenceReason;
    let confidenceScore = basicResult.confidenceScore;

    // Apply statistical test results
    const significantTests = statisticalTests.filter((test) => test.isSignificant);
    if (
      significantTests.length > 0 &&
      significantTests.some(
        (test) =>
          test.testName.includes('Trend') && test.interpretation.includes('No significant trend')
      )
    ) {
      hasConverged = true;
      convergenceReason = 'threshold_met';
      confidenceScore = Math.max(confidenceScore, 0.8);
    }

    // Apply trend analysis
    if (trendAnalysis.trend === 'stable' && trendAnalysis.confidence > 0.8) {
      hasConverged = true;
      convergenceReason = 'threshold_met';
      confidenceScore = Math.max(confidenceScore, trendAnalysis.confidence);
    }

    // Apply early stopping analysis
    if (earlyStoppingAnalysis.shouldStop) {
      hasConverged = true;
      convergenceReason = 'minimal_improvement';
      confidenceScore = Math.min(confidenceScore, 0.7);
    }

    // Apply oscillation detection
    if (oscillationAnalysis.isOscillating && oscillationAnalysis.dampingFactor < 0.1) {
      hasConverged = true;
      convergenceReason = 'threshold_met';
      confidenceScore = Math.max(confidenceScore, 0.75);
    }

    // Apply quality assurance
    if (!qualityAssurance.passesQualityCheck) {
      confidenceScore *= 0.8; // Reduce confidence if quality issues exist
    }

    return {
      hasConverged,
      convergenceReason,
      finalPass: currentPass,
      improvementTrend: basicResult.improvementTrend,
      confidenceScore: Math.max(0, Math.min(1, confidenceScore)),
      stabilityMetrics: basicResult.stabilityMetrics,
    };
  }

  // Helper methods for statistical calculations

  private calculateLinearRegression(
    x: number[],
    y: number[]
  ): {
    slope: number;
    intercept: number;
    correlation: number;
    rSquared: number;
  } {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    const ssTotal = sumYY - n * meanY * meanY;
    const ssRes = y.reduce((sum, val, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + (val - predicted) ** 2;
    }, 0);

    const rSquared = 1 - ssRes / ssTotal;
    const correlation = Math.sqrt(Math.abs(rSquared)) * Math.sign(slope);

    return { slope, intercept, correlation, rSquared };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
  }

  private normalCDF(z: number): number {
    // Approximation of the cumulative distribution function for standard normal
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of the error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private tCDF(t: number, df: number): number {
    // Simplified t-distribution CDF approximation
    if (df > 30) {
      return this.normalCDF(t);
    }

    // Use normal approximation for simplicity
    return this.normalCDF(t * Math.sqrt(df / (df + t * t)));
  }

  private detectOscillationPattern(values: number[]): boolean {
    if (values.length < 4) return false;

    // Count direction changes
    let directionChanges = 0;
    for (let i = 2; i < values.length; i++) {
      const prev = values[i - 1] - values[i - 2];
      const curr = values[i] - values[i - 1];
      if (prev * curr < 0) {
        directionChanges++;
      }
    }

    const changeRatio = directionChanges / (values.length - 2);
    return changeRatio > 0.5;
  }

  private estimateCycleLength(values: number[]): number {
    if (values.length < 4) return 0;

    // Simple cycle detection using autocorrelation
    let bestCycleLength = 0;
    let maxCorrelation = 0;

    for (let lag = 2; lag <= Math.floor(values.length / 2); lag++) {
      let correlation = 0;
      let count = 0;

      for (let i = 0; i < values.length - lag; i++) {
        correlation += values[i] * values[i + lag];
        count++;
      }

      if (count > 0) {
        correlation /= count;
        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
          bestCycleLength = lag;
        }
      }
    }

    return bestCycleLength;
  }

  private calculateOscillationAmplitude(values: number[]): number {
    if (values.length === 0) return 0;
    const max = Math.max(...values);
    const min = Math.min(...values);
    return max - min;
  }

  private calculateDampingFactor(history: number[]): number {
    if (history.length < 4) return 1;

    // Calculate ratio of recent amplitude to historical amplitude
    const recentAmplitude = this.calculateOscillationAmplitude(history.slice(-4));
    const historicalAmplitude = this.calculateOscillationAmplitude(history);

    return historicalAmplitude > 0 ? recentAmplitude / historicalAmplitude : 1;
  }

  private calculateImprovementTrend(metrics: PassMetrics[]): number[] {
    if (metrics.length < 2) return [];

    const trend: number[] = [];
    for (let i = 1; i < metrics.length; i++) {
      const current = metrics[i].consolidationEfficiency;
      const previous = metrics[i - 1].consolidationEfficiency;
      trend.push(current - previous);
    }

    return trend;
  }

  private calculateStabilityMetrics(metrics: PassMetrics[]): ConvergenceResult['stabilityMetrics'] {
    if (metrics.length < 2) {
      return {
        patternStability: 1.0,
        sizeStability: 1.0,
        qualityStability: 1.0,
      };
    }

    const patternStabilities = metrics.map((m) => m.stabilityScore);
    const sizeVariations = metrics.map((m) => m.compressionRatio);
    const qualityVariations = metrics.map((m) => m.consolidationEfficiency);

    return {
      patternStability: 1 - this.calculateStandardDeviation(patternStabilities),
      sizeStability: 1 - this.calculateStandardDeviation(sizeVariations),
      qualityStability: 1 - this.calculateStandardDeviation(qualityVariations),
    };
  }

  private calculateConfidenceScore(metrics: PassMetrics[], hasConverged: boolean): number {
    if (metrics.length === 0) return 0;

    // Base confidence on data quality and consistency
    let confidence = 0.5;

    // Increase confidence with more data
    confidence += Math.min(0.3, metrics.length * 0.05);

    // Adjust based on metric stability
    const recentMetrics = metrics.slice(-5);
    if (recentMetrics.length > 1) {
      const efficiencies = recentMetrics.map((m) => m.consolidationEfficiency);
      const stability = 1 - this.calculateStandardDeviation(efficiencies);
      confidence += stability * 0.3;
    }

    // Convergence bonus
    if (hasConverged) {
      confidence += 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // Default result generators for when advanced features are disabled

  private getDefaultTrendAnalysis(): TrendAnalysisResult {
    return {
      trend: 'stable',
      slope: 0,
      correlation: 0,
      confidence: 0.5,
      prediction: 0,
      rSquared: 0,
    };
  }

  private getDefaultEarlyStoppingAnalysis(): EarlyStoppingResult {
    return {
      shouldStop: false,
      reason: 'Early stopping disabled',
      patienceCount: 0,
      bestScore: 0,
      currentScore: 0,
      stagnationPeriod: 0,
    };
  }

  private getDefaultOscillationAnalysis(): OscillationResult {
    return {
      isOscillating: false,
      cycleLength: 0,
      amplitude: 0,
      frequency: 0,
      dampingFactor: 1,
    };
  }

  private getDefaultAdaptiveThresholds(): ConvergenceAnalysisResult['adaptiveThresholds'] {
    return {
      adjustedConvergenceThreshold: this.config.convergenceThreshold,
      adjustedMinimumImprovement: this.config.minimumImprovement,
      adaptationReason: 'Adaptive thresholds disabled',
    };
  }

  /**
   * Reset internal state for new optimization session
   */
  public reset(): void {
    this.stagnationCounter = 0;
    this.bestScore = -Infinity;
    this.patienceCounter = 0;
    this.oscillationHistory = [];
  }

  /**
   * Get current configuration
   */
  public getConfig(): ConvergenceDetectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ConvergenceDetectionConfig>): void {
    this.config = ConvergenceDetectionConfigSchema.parse({
      ...this.config,
      ...newConfig,
    });
  }
}

/**
 * Factory function to create an AdvancedConvergenceDetector
 */
export function createAdvancedConvergenceDetector(
  config: Partial<ConvergenceDetectionConfig> = {}
): AdvancedConvergenceDetector {
  return new AdvancedConvergenceDetector(config);
}

/**
 * Utility function to validate convergence detection configuration
 */
export function validateConvergenceDetectionConfig(config: unknown): ConvergenceDetectionConfig {
  return ConvergenceDetectionConfigSchema.parse(config);
}
