/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import type { PatternAnalysisInput, PatternFrequencyMap } from '../processors/patternAnalysis';
import type { CompleteConsolidator, ConsolidationResult } from './completeConsolidator';
import { createCompleteConsolidator } from './completeConsolidator';
import type {
  AdvancedConvergenceDetector,
  ConvergenceAnalysisResult,
  ConvergenceDetectionConfig,
} from './convergenceDetection';
import { createAdvancedConvergenceDetector } from './convergenceDetection';
import type { DataStructureManager } from './dataStructures';
import { createDataStructureManager } from './dataStructures';
import type { MetricsTracker, MetricsTrackingConfig } from './metricsTracking';
import { createMetricsTracker } from './metricsTracking';
import type { StateManager } from './stateManagement';
import { createStateManager } from './stateManagement';

/**
 * Configuration schema for multi-pass discovery optimization
 */
export const MultiPassDiscoveryConfigSchema = z.object({
  // Core optimization parameters
  maxPasses: z.number().min(1).max(50).default(10),
  convergenceThreshold: z.number().min(0).max(1).default(0.05),
  minimumImprovement: z.number().min(0).max(1).default(0.01),

  // Pattern analysis configuration
  patternAnalysisOptions: z
    .object({
      minimumFrequency: z.number().min(1).default(2),
      caseSensitive: z.boolean().default(false),
      enablePatternGrouping: z.boolean().default(true),
      enableCoOccurrenceAnalysis: z.boolean().default(true),
      maxCoOccurrenceDistance: z.number().min(1).default(5),
      includeFrameworkAnalysis: z.boolean().default(true),
    })
    .default({}),

  // Optimization strategy
  optimizationStrategy: z.enum(['aggressive', 'balanced', 'conservative']).default('balanced'),
  enableAdaptiveThresholds: z.boolean().default(true),
  enableDynamicPassCount: z.boolean().default(true),

  // Performance controls
  memoryEfficientMode: z.boolean().default(false),
  enableProgressReporting: z.boolean().default(true),
  enableMetricsCollection: z.boolean().default(true),

  // State management
  enableCheckpointing: z.boolean().default(false),
  checkpointInterval: z.number().min(1).default(5),
  enableStateValidation: z.boolean().default(true),

  // Error handling
  continueOnError: z.boolean().default(false),
  maxErrors: z.number().min(1).default(10),
  errorRecoveryStrategy: z.enum(['abort', 'rollback', 'continue']).default('rollback'),

  // Advanced convergence detection configuration
  advancedConvergenceDetection: z
    .object({
      enabled: z.boolean().default(true),
      enableTrendAnalysis: z.boolean().default(true),
      enableStatisticalTests: z.boolean().default(true),
      enableEarlyStoppingDetection: z.boolean().default(true),
      enableOscillationDetection: z.boolean().default(true),
      trendAnalysisWindow: z.number().min(2).max(20).default(5),
      statisticalTestWindow: z.number().min(3).max(30).default(10),
      pValueThreshold: z.number().min(0).max(1).default(0.05),
      patienceThreshold: z.number().min(1).max(20).default(5),
      oscillationThreshold: z.number().min(0).max(1).default(0.02),
    })
    .default({}),

  // Comprehensive metrics tracking configuration
  metricsTracking: z
    .object({
      enableMetricsCollection: z.boolean().default(true),
      collectMemoryMetrics: z.boolean().default(true),
      collectTimingMetrics: z.boolean().default(true),
      collectPatternMetrics: z.boolean().default(true),
      collectQualityMetrics: z.boolean().default(true),
      metricsBufferSize: z.number().min(1).max(10000).default(1000),
      enableAutoExport: z.boolean().default(false),
      exportFormat: z.enum(['json', 'csv', 'yaml']).default('json'),
      exportPath: z.string().default('./optimization-metrics'),
      enableRealTimeAggregation: z.boolean().default(true),
      maxStoredMetrics: z.number().min(10).max(100000).default(10000),
      enableMetricsMonitoring: z.boolean().default(false),
      performanceThresholds: z
        .object({
          maxMemoryUsageMB: z.number().default(1000),
          maxPassDurationMs: z.number().default(30000),
          minEfficiencyScore: z.number().default(0.1),
          maxErrorRate: z.number().default(0.05),
        })
        .default({}),
    })
    .default({}),

  // Robust state management and checkpointing configuration
  stateManagement: z
    .object({
      enableCheckpointing: z.boolean().default(false),
      checkpointInterval: z.number().min(1).default(5),
      maxCheckpoints: z.number().min(1).max(100).default(10),
      checkpointDirectory: z.string().default('./.optimization-checkpoints'),
      compressionEnabled: z.boolean().default(true),
      serializationFormat: z.enum(['json', 'binary']).default('json'),
      enableVersioning: z.boolean().default(true),
      stateVersion: z.string().default('1.0.0'),
      enableStateValidation: z.boolean().default(true),
      strictValidation: z.boolean().default(false),
      validateChecksums: z.boolean().default(true),
      enableAutoRecovery: z.boolean().default(true),
      maxRecoveryAttempts: z.number().min(1).max(10).default(3),
      recoveryStrategy: z.enum(['latest', 'stable', 'manual']).default('latest'),
      atomicWrites: z.boolean().default(true),
      enableAsyncCheckpoints: z.boolean().default(true),
      checkpointTimeoutMs: z.number().min(1000).max(300000).default(30000),
      enableAutoCleanup: z.boolean().default(true),
      cleanupOlderThanDays: z.number().min(1).max(365).default(7),
      retainLastNCheckpoints: z.number().min(1).max(50).default(5),
    })
    .default({}),
});

export type MultiPassDiscoveryConfig = z.infer<typeof MultiPassDiscoveryConfigSchema>;

/**
 * Metrics collected during each optimization pass
 */
export interface PassMetrics {
  passNumber: number;
  timestamp: Date;
  duration: number;

  // Pattern analysis metrics
  totalPatternsFound: number;
  newPatternsDiscovered: number;
  patternsConsolidated: number;
  averagePatternFrequency: number;

  // Optimization metrics
  totalFilesProcessed: number;
  totalReplacements: number;
  sizeBefore: number;
  sizeAfter: number;
  compressionRatio: number;

  // Quality metrics
  patternDiversity: number;
  consolidationEfficiency: number;
  stabilityScore: number;

  // Resource metrics
  memoryUsage: number;
  peakMemoryUsage: number;
  dataStructureStats?: any;

  // Error tracking
  errors: string[];
  warnings: string[];
}

/**
 * Convergence detection result
 */
export interface ConvergenceResult {
  hasConverged: boolean;
  convergenceReason: 'threshold_met' | 'minimal_improvement' | 'max_passes' | 'error';
  finalPass: number;
  improvementTrend: number[];
  confidenceScore: number;
  stabilityMetrics: {
    patternStability: number;
    sizeStability: number;
    qualityStability: number;
  };
}

/**
 * Complete multi-pass optimization result
 */
export interface MultiPassOptimizationResult {
  convergence: ConvergenceResult;
  passMetrics: PassMetrics[];
  finalResult: ConsolidationResult;

  // Aggregate statistics
  totalPassesExecuted: number;
  totalOptimizationTime: number;
  totalPatternsDiscovered: number;
  finalCompressionRatio: number;
  overallEfficiency: number;

  // State information
  checkpoints: string[];
  errors: string[];
  warnings: string[];

  // Performance profile
  performanceProfile: {
    averagePassDuration: number;
    peakMemoryUsage: number;
    totalMemoryAllocated: number;
    resourceUtilization: number;
  };

  // Enhanced metrics
  enhancedMetricsSummary: ReturnType<MetricsTracker['getMetricsSummary']>;
  aggregatedStatistics: ReturnType<MetricsTracker['getAggregatedStatistics']>;
}

/**
 * Interface for optimization state management
 */
export interface OptimizationState {
  currentPass: number;
  frequencyMap: PatternFrequencyMap;
  consolidationResult?: ConsolidationResult;
  metrics: PassMetrics[];
  errors: string[];
  warnings: string[];
  checkpointId?: string;
  timestamp: Date;
}

/**
 * Base class for optimization engine components
 */
export abstract class OptimizationEngineComponent {
  protected config: MultiPassDiscoveryConfig;
  protected errors: string[] = [];
  protected warnings: string[] = [];

  constructor(config: MultiPassDiscoveryConfig) {
    this.config = config;
  }

  protected logError(error: string, cause?: Error): void {
    const errorMessage = cause ? `${error}: ${cause.message}` : error;
    this.errors.push(errorMessage);

    if (!this.config.continueOnError) {
      throw new MultiPassDiscoveryError(errorMessage, cause);
    }
  }

  protected logWarning(warning: string): void {
    this.warnings.push(warning);
  }

  public getErrors(): string[] {
    return [...this.errors];
  }

  public getWarnings(): string[] {
    return [...this.warnings];
  }

  public clearDiagnostics(): void {
    this.errors = [];
    this.warnings = [];
  }
}

/**
 * Error class for multi-pass discovery operations
 */
export class MultiPassDiscoveryError extends Error {
  public cause?: Error;
  public passNumber?: number;

  constructor(message: string, cause?: Error, passNumber?: number) {
    super(message);
    this.name = 'MultiPassDiscoveryError';
    this.cause = cause;
    this.passNumber = passNumber;
  }
}

/**
 * Core multi-pass discovery engine class
 */
export class MultiPassDiscovery extends OptimizationEngineComponent {
  private consolidator: CompleteConsolidator;
  private dataStructureManager: DataStructureManager;
  private convergenceDetector: AdvancedConvergenceDetector;
  private metricsTracker: MetricsTracker;
  private stateManager: StateManager;
  private currentState: OptimizationState | null = null;
  private checkpoints: Map<string, OptimizationState> = new Map();

  constructor(config: Partial<MultiPassDiscoveryConfig> = {}, consolidator?: CompleteConsolidator) {
    const validatedConfig = MultiPassDiscoveryConfigSchema.parse(config);
    super(validatedConfig);

    // Initialize consolidator with compatible options
    this.consolidator =
      consolidator ||
      createCompleteConsolidator({
        minimumFrequency: this.config.patternAnalysisOptions.minimumFrequency,
        caseSensitive: this.config.patternAnalysisOptions.caseSensitive,
        enablePatternGrouping: this.config.patternAnalysisOptions.enablePatternGrouping,
        enableCoOccurrenceAnalysis: this.config.patternAnalysisOptions.enableCoOccurrenceAnalysis,
        maxCoOccurrenceDistance: this.config.patternAnalysisOptions.maxCoOccurrenceDistance,
        includeFrameworkAnalysis: this.config.patternAnalysisOptions.includeFrameworkAnalysis,
      });

    // Initialize data structure manager
    this.dataStructureManager = createDataStructureManager({
      memoryEfficientMode: this.config.memoryEfficientMode,
      enableLRUEviction: true,
      maxEntries: this.config.memoryEfficientMode ? 10000 : 50000,
    });

    // Initialize advanced convergence detector
    this.convergenceDetector = createAdvancedConvergenceDetector({
      convergenceThreshold: this.config.convergenceThreshold,
      minimumImprovement: this.config.minimumImprovement,
      enableTrendAnalysis: this.config.advancedConvergenceDetection.enableTrendAnalysis,
      enableStatisticalTests: this.config.advancedConvergenceDetection.enableStatisticalTests,
      enableEarlyStoppingDetection:
        this.config.advancedConvergenceDetection.enableEarlyStoppingDetection,
      enableOscillationDetection:
        this.config.advancedConvergenceDetection.enableOscillationDetection,
      trendAnalysisWindow: this.config.advancedConvergenceDetection.trendAnalysisWindow,
      statisticalTestWindow: this.config.advancedConvergenceDetection.statisticalTestWindow,
      pValueThreshold: this.config.advancedConvergenceDetection.pValueThreshold,
      patienceThreshold: this.config.advancedConvergenceDetection.patienceThreshold,
      oscillationThreshold: this.config.advancedConvergenceDetection.oscillationThreshold,
      enableAdaptiveThresholds: this.config.enableAdaptiveThresholds,
    });

    // Initialize comprehensive metrics tracker
    this.metricsTracker = createMetricsTracker({
      enableMetricsCollection: this.config.metricsTracking.enableMetricsCollection,
      collectMemoryMetrics: this.config.metricsTracking.collectMemoryMetrics,
      collectTimingMetrics: this.config.metricsTracking.collectTimingMetrics,
      collectPatternMetrics: this.config.metricsTracking.collectPatternMetrics,
      collectQualityMetrics: this.config.metricsTracking.collectQualityMetrics,
      metricsBufferSize: this.config.metricsTracking.metricsBufferSize,
      enableAutoExport: this.config.metricsTracking.enableAutoExport,
      exportFormat: this.config.metricsTracking.exportFormat,
      exportPath: this.config.metricsTracking.exportPath,
      enableRealTimeAggregation: this.config.metricsTracking.enableRealTimeAggregation,
      maxStoredMetrics: this.config.metricsTracking.maxStoredMetrics,
      enableMetricsMonitoring: this.config.metricsTracking.enableMetricsMonitoring,
      performanceThresholds: this.config.metricsTracking.performanceThresholds,
    });

    // Initialize robust state manager
    this.stateManager = createStateManager({
      enableCheckpointing: this.config.stateManagement.enableCheckpointing,
      checkpointInterval: this.config.stateManagement.checkpointInterval,
      maxCheckpoints: this.config.stateManagement.maxCheckpoints,
      checkpointDirectory: this.config.stateManagement.checkpointDirectory,
      compressionEnabled: this.config.stateManagement.compressionEnabled,
      serializationFormat: this.config.stateManagement.serializationFormat,
      enableVersioning: this.config.stateManagement.enableVersioning,
      stateVersion: this.config.stateManagement.stateVersion,
      enableStateValidation: this.config.stateManagement.enableStateValidation,
      strictValidation: this.config.stateManagement.strictValidation,
      validateChecksums: this.config.stateManagement.validateChecksums,
      enableAutoRecovery: this.config.stateManagement.enableAutoRecovery,
      maxRecoveryAttempts: this.config.stateManagement.maxRecoveryAttempts,
      recoveryStrategy: this.config.stateManagement.recoveryStrategy,
      atomicWrites: this.config.stateManagement.atomicWrites,
      enableAsyncCheckpoints: this.config.stateManagement.enableAsyncCheckpoints,
      checkpointTimeoutMs: this.config.stateManagement.checkpointTimeoutMs,
      enableAutoCleanup: this.config.stateManagement.enableAutoCleanup,
      cleanupOlderThanDays: this.config.stateManagement.cleanupOlderThanDays,
      retainLastNCheckpoints: this.config.stateManagement.retainLastNCheckpoints,
    });
  }

  /**
   * Execute the complete multi-pass optimization process
   */
  public async optimize(input: PatternAnalysisInput): Promise<MultiPassOptimizationResult> {
    const startTime = Date.now();

    try {
      // Start metrics collection
      this.metricsTracker.startCollection();

      // Validate input
      this.validateInput(input);

      // Initialize optimization state
      this.currentState = this.initializeState(input);

      let currentInput = input;
      let lastResult: ConsolidationResult | null = null;
      let passNumber = 1;

      this.logProgress(`Starting multi-pass optimization with max ${this.config.maxPasses} passes`);

      // Main optimization loop
      while (passNumber <= this.config.maxPasses) {
        this.logProgress(`=== Pass ${passNumber} ===`);

        try {
          // Execute single pass
          const passResult = await this.executeSinglePass(currentInput, passNumber);

          // Collect basic pass metrics
          const passDuration = Date.now() - startTime;
          const basicMetrics = await this.collectPassMetrics(
            passNumber,
            passResult,
            passDuration,
            lastResult
          );

          // Collect enhanced metrics using MetricsTracker
          const enhancedMetrics = await this.metricsTracker.collectPassMetrics(basicMetrics);

          // Update state with enhanced metrics
          this.updateOptimizationState(passNumber, passResult, basicMetrics);

          // Check for convergence using enhanced metrics
          const convergence = this.checkConvergence(this.currentState!.metrics, passNumber);

          if (convergence.hasConverged) {
            this.logProgress(
              `Convergence detected at pass ${passNumber}: ${convergence.convergenceReason}`
            );
            const totalTime = Date.now() - startTime;
            const result = this.buildFinalResult(
              convergence,
              this.currentState!.metrics,
              passResult,
              totalTime
            );

            // Add enhanced metrics summary to result
            result.enhancedMetricsSummary = this.metricsTracker.getMetricsSummary();
            result.aggregatedStatistics = this.metricsTracker.getAggregatedStatistics();

            return result;
          }

          // Prepare input for next pass
          currentInput = this.prepareNextPassInput(passResult);
          lastResult = passResult;
          passNumber++;
        } catch (error) {
          this.handlePassError(error, passNumber);
          if (!this.config.continueOnError) {
            throw error;
          }
          passNumber++;
        }
      }

      // Max passes reached
      this.logProgress(`Maximum passes (${this.config.maxPasses}) reached without convergence`);

      const convergence: ConvergenceResult = {
        hasConverged: false,
        convergenceReason: 'max_passes',
        finalPass: passNumber - 1,
        improvementTrend: this.calculateImprovementTrend(this.currentState!.metrics),
        confidenceScore: 0.3,
        stabilityMetrics: this.calculateStabilityMetrics(this.currentState!.metrics),
      };

      const totalTime = Date.now() - startTime;
      const result = this.buildFinalResult(
        convergence,
        this.currentState!.metrics,
        lastResult || ({} as ConsolidationResult),
        totalTime
      );

      // Add enhanced metrics summary to result
      result.enhancedMetricsSummary = this.metricsTracker.getMetricsSummary();
      result.aggregatedStatistics = this.metricsTracker.getAggregatedStatistics();

      return result;
    } finally {
      // Stop metrics collection
      this.metricsTracker.stopCollection();
    }
  }

  /**
   * Validate input data before processing
   */
  private validateInput(input: PatternAnalysisInput): void {
    if (!input || (!input.htmlResults?.length && !input.jsxResults?.length)) {
      throw new MultiPassDiscoveryError('Invalid input: no HTML or JSX results provided');
    }

    const totalFiles = (input.htmlResults?.length || 0) + (input.jsxResults?.length || 0);
    if (totalFiles === 0) {
      throw new MultiPassDiscoveryError('Invalid input: no files to process');
    }

    this.logProgress(`Input validation passed: ${totalFiles} files to process`);
  }

  /**
   * Initialize optimization state
   */
  private initializeState(_input: PatternAnalysisInput): OptimizationState {
    return {
      currentPass: 0,
      frequencyMap: new Map() as PatternFrequencyMap,
      metrics: [],
      errors: [],
      warnings: [],
      timestamp: new Date(),
    };
  }

  /**
   * Execute a single optimization pass
   */
  private async executeSinglePass(
    input: PatternAnalysisInput,
    passNumber: number
  ): Promise<ConsolidationResult> {
    this.logProgress(`Executing pass ${passNumber}`);

    try {
      // Perform consolidation for this pass
      const result = await this.consolidator.consolidate(input);

      // Validate result
      if (!result || !result.patterns) {
        throw new MultiPassDiscoveryError(`Pass ${passNumber} produced invalid result`);
      }

      this.logProgress(
        `Pass ${passNumber} completed: ${result.patterns.size} patterns consolidated`
      );
      return result;
    } catch (error) {
      throw new MultiPassDiscoveryError(
        `Pass ${passNumber} execution failed`,
        error as Error,
        passNumber
      );
    }
  }

  /**
   * Collect metrics for the current pass
   */
  private async collectPassMetrics(
    passNumber: number,
    result: ConsolidationResult,
    duration: number,
    lastResult: ConsolidationResult | null
  ): Promise<PassMetrics> {
    const memoryUsage = process.memoryUsage();

    // Calculate improvement metrics
    const newPatternsDiscovered = lastResult
      ? result.patterns.size - lastResult.patterns.size
      : result.patterns.size;

    const compressionRatio =
      result.statistics.totalReplacements > 0
        ? 1 - result.statistics.totalReplacements / result.statistics.totalPatternsFound
        : 0;

    return {
      passNumber,
      timestamp: new Date(),
      duration,

      // Pattern metrics
      totalPatternsFound: result.statistics.totalPatternsFound,
      newPatternsDiscovered: Math.max(0, newPatternsDiscovered),
      patternsConsolidated: result.statistics.totalPatternsConsolidated,
      averagePatternFrequency: this.calculateAverageFrequency(result.patterns),

      // Optimization metrics
      totalFilesProcessed: result.statistics.totalFilesModified,
      totalReplacements: result.statistics.totalReplacements,
      sizeBefore: 0, // TODO: Calculate from file analysis
      sizeAfter: 0, // TODO: Calculate from file analysis
      compressionRatio,

      // Quality metrics
      patternDiversity: this.calculatePatternDiversity(result.patterns),
      consolidationEfficiency: compressionRatio,
      stabilityScore: this.calculateStabilityScore(result, lastResult),

      // Resource metrics
      memoryUsage: memoryUsage.heapUsed,
      peakMemoryUsage: memoryUsage.heapTotal,
      dataStructureStats: this.dataStructureManager.getOverallStats(),

      // Diagnostics
      errors: [...result.errors],
      warnings: [...result.warnings],
    };
  }

  /**
   * Helper method to calculate average pattern frequency
   */
  private calculateAverageFrequency(patterns: Map<string, any>): number {
    if (patterns.size === 0) return 0;

    let totalFrequency = 0;
    for (const pattern of patterns.values()) {
      totalFrequency += pattern.frequency || 0;
    }

    return totalFrequency / patterns.size;
  }

  /**
   * Helper method to calculate pattern diversity
   */
  private calculatePatternDiversity(patterns: Map<string, any>): number {
    if (patterns.size === 0) return 0;

    // Calculate Shannon diversity index
    const frequencies = Array.from(patterns.values()).map((p) => p.frequency || 1);
    const total = frequencies.reduce((sum, freq) => sum + freq, 0);

    if (total === 0) return 0;

    let diversity = 0;
    for (const freq of frequencies) {
      const probability = freq / total;
      if (probability > 0) {
        diversity -= probability * Math.log2(probability);
      }
    }

    return diversity;
  }

  /**
   * Helper method to calculate stability score between results
   */
  private calculateStabilityScore(
    current: ConsolidationResult,
    previous: ConsolidationResult | null
  ): number {
    if (!previous) return 1.0;

    // Compare pattern stability
    const currentPatterns = new Set(current.patterns.keys());
    const previousPatterns = new Set(previous.patterns.keys());

    const intersection = new Set([...currentPatterns].filter((p) => previousPatterns.has(p)));
    const union = new Set([...currentPatterns, ...previousPatterns]);

    return union.size > 0 ? intersection.size / union.size : 1.0;
  }

  /**
   * Update optimization state with new results
   */
  private updateOptimizationState(
    passNumber: number,
    result: ConsolidationResult,
    metrics: PassMetrics
  ): void {
    if (!this.currentState) {
      throw new MultiPassDiscoveryError('Optimization state not initialized');
    }

    this.currentState.currentPass = passNumber;
    this.currentState.consolidationResult = result;
    this.currentState.frequencyMap = result.analysisResult.frequencyMap;
    this.currentState.metrics.push(metrics);
    this.currentState.errors.push(...metrics.errors);
    this.currentState.warnings.push(...metrics.warnings);
    this.currentState.timestamp = new Date();
  }

  /**
   * Check if optimization has converged using advanced detection algorithms
   */
  private checkConvergence(metrics: PassMetrics[], currentPass: number): ConvergenceResult {
    if (!this.config.advancedConvergenceDetection.enabled || metrics.length < 2) {
      // Fall back to basic convergence detection
      return this.basicConvergenceCheck(metrics, currentPass);
    }

    try {
      // Use advanced convergence analysis
      const analysisResult = this.convergenceDetector.analyzeConvergence(
        metrics,
        currentPass,
        this.config
      );

      // Log advanced convergence insights if enabled
      if (this.config.enableProgressReporting) {
        this.logAdvancedConvergenceInsights(analysisResult);
      }

      // Return the convergence result portion
      return {
        hasConverged: analysisResult.hasConverged,
        convergenceReason: analysisResult.convergenceReason,
        finalPass: analysisResult.finalPass,
        improvementTrend: analysisResult.improvementTrend,
        confidenceScore: analysisResult.confidenceScore,
        stabilityMetrics: analysisResult.stabilityMetrics,
      };
    } catch (error) {
      this.logWarning(
        `Advanced convergence detection failed: ${error}. Falling back to basic detection.`
      );
      return this.basicConvergenceCheck(metrics, currentPass);
    }
  }

  /**
   * Basic convergence check (fallback method)
   */
  private basicConvergenceCheck(metrics: PassMetrics[], currentPass: number): ConvergenceResult {
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

    // Calculate improvement
    const patternImprovement =
      Math.abs(lastMetrics.patternsConsolidated - previousMetrics.patternsConsolidated) /
      Math.max(previousMetrics.patternsConsolidated, 1);

    const stabilityImprovement = Math.abs(
      lastMetrics.stabilityScore - previousMetrics.stabilityScore
    );

    // Check convergence criteria
    const hasConverged =
      patternImprovement < this.config.minimumImprovement &&
      stabilityImprovement < this.config.convergenceThreshold;

    const improvementTrend = this.calculateImprovementTrend(metrics);
    const stabilityMetrics = this.calculateStabilityMetrics(metrics);

    return {
      hasConverged,
      convergenceReason: hasConverged ? 'threshold_met' : 'minimal_improvement',
      finalPass: currentPass,
      improvementTrend,
      confidenceScore: hasConverged ? 0.9 : 0.5,
      stabilityMetrics,
    };
  }

  /**
   * Log advanced convergence insights for debugging and monitoring
   */
  private logAdvancedConvergenceInsights(result: ConvergenceAnalysisResult): void {
    this.logProgress(`=== Advanced Convergence Analysis ===`);
    this.logProgress(`Convergence Status: ${result.hasConverged ? 'CONVERGED' : 'CONTINUING'}`);
    this.logProgress(`Reason: ${result.convergenceReason}`);
    this.logProgress(`Confidence: ${(result.confidenceScore * 100).toFixed(1)}%`);

    // Trend analysis insights
    this.logProgress(
      `Trend: ${result.trendAnalysis.trend} (slope: ${result.trendAnalysis.slope.toFixed(4)})`
    );
    this.logProgress(`Trend Confidence: ${(result.trendAnalysis.confidence * 100).toFixed(1)}%`);

    // Statistical test results
    if (result.statisticalTests.length > 0) {
      this.logProgress(`Statistical Tests:`);
      for (const test of result.statisticalTests) {
        this.logProgress(
          `  ${test.testName}: ${test.interpretation} (p=${test.pValue.toFixed(4)})`
        );
      }
    }

    // Early stopping analysis
    if (result.earlyStoppingAnalysis.shouldStop) {
      this.logProgress(`Early Stopping: ${result.earlyStoppingAnalysis.reason}`);
    }

    // Oscillation detection
    if (result.oscillationAnalysis.isOscillating) {
      this.logProgress(
        `Oscillation Detected: cycle=${result.oscillationAnalysis.cycleLength}, amplitude=${result.oscillationAnalysis.amplitude.toFixed(4)}`
      );
    }

    // Adaptive thresholds
    if (result.adaptiveThresholds.adaptationReason !== 'No adaptation needed') {
      this.logProgress(`Threshold Adaptation: ${result.adaptiveThresholds.adaptationReason}`);
    }

    // Quality assurance issues
    if (!result.qualityAssurance.passesQualityCheck) {
      this.logProgress(`Quality Issues: ${result.qualityAssurance.issues.join(', ')}`);
    }

    this.logProgress(`=====================================`);
  }

  /**
   * Calculate improvement trend across passes
   */
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

  /**
   * Calculate stability metrics across passes
   */
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
      patternStability: this.calculateStandardDeviation(patternStabilities),
      sizeStability: this.calculateStandardDeviation(sizeVariations),
      qualityStability: this.calculateStandardDeviation(qualityVariations),
    };
  }

  /**
   * Calculate standard deviation for stability measurement
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Create a checkpoint of current state
   */
  private async createCheckpoint(passNumber: number): Promise<void> {
    if (!this.config.enableCheckpointing || !this.currentState) return;

    const checkpointId = `pass_${passNumber}_${Date.now()}`;
    const checkpoint: OptimizationState = {
      ...this.currentState,
      checkpointId,
      metrics: [...this.currentState.metrics],
      errors: [...this.currentState.errors],
      warnings: [...this.currentState.warnings],
    };

    this.checkpoints.set(checkpointId, checkpoint);
    this.currentState.checkpointId = checkpointId;

    this.logProgress(`Checkpoint created: ${checkpointId}`);
  }

  /**
   * Rollback to the last checkpoint
   */
  private async rollbackToLastCheckpoint(): Promise<void> {
    if (!this.currentState?.checkpointId) {
      throw new MultiPassDiscoveryError('No checkpoint available for rollback');
    }

    const checkpoint = this.checkpoints.get(this.currentState.checkpointId);
    if (!checkpoint) {
      throw new MultiPassDiscoveryError('Checkpoint not found for rollback');
    }

    this.currentState = { ...checkpoint };
    this.logProgress(`Rolled back to checkpoint: ${checkpoint.checkpointId}`);
  }

  /**
   * Prepare input for the next optimization pass
   */
  private prepareNextPassInput(_result: ConsolidationResult): PatternAnalysisInput {
    // TODO: This should create input based on the modified files from the previous pass
    // For now, return a placeholder that would need to be extracted from the result
    return {
      htmlResults: [],
      jsxResults: [],
    };
  }

  /**
   * Handle errors that occur during pass execution
   */
  private handlePassError(error: unknown, passNumber: number): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logError(`Pass ${passNumber} failed: ${errorMessage}`, error as Error);

    if (this.errors.length > this.config.maxErrors) {
      throw new MultiPassDiscoveryError(
        `Maximum error limit (${this.config.maxErrors}) exceeded`,
        error as Error,
        passNumber
      );
    }
  }

  /**
   * Build the final optimization result
   */
  private buildFinalResult(
    convergence: ConvergenceResult,
    passMetrics: PassMetrics[],
    finalResult: ConsolidationResult,
    totalTime: number
  ): MultiPassOptimizationResult {
    const checkpointIds = Array.from(this.checkpoints.keys());
    const allErrors = [...this.errors, ...finalResult.errors];
    const allWarnings = [...this.warnings, ...finalResult.warnings];

    // Calculate performance profile
    const durations = passMetrics.map((m) => m.duration);
    const memoryUsages = passMetrics.map((m) => m.memoryUsage);

    const performanceProfile = {
      averagePassDuration:
        durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
      peakMemoryUsage: Math.max(...memoryUsages, 0),
      totalMemoryAllocated: memoryUsages.reduce((sum, m) => sum + m, 0),
      resourceUtilization: totalTime > 0 ? durations.reduce((sum, d) => sum + d, 0) / totalTime : 0,
    };

    return {
      convergence,
      passMetrics,
      finalResult,

      // Aggregate statistics
      totalPassesExecuted: passMetrics.length,
      totalOptimizationTime: totalTime,
      totalPatternsDiscovered: finalResult.statistics.totalPatternsFound,
      finalCompressionRatio:
        passMetrics.length > 0 ? passMetrics[passMetrics.length - 1].compressionRatio : 0,
      overallEfficiency: this.calculateOverallEfficiency(passMetrics),

      // State information
      checkpoints: checkpointIds,
      errors: allErrors,
      warnings: allWarnings,

      // Performance profile
      performanceProfile,

      // Enhanced metrics
      enhancedMetricsSummary: this.metricsTracker.getMetricsSummary(),
      aggregatedStatistics: this.metricsTracker.getAggregatedStatistics(),
    };
  }

  /**
   * Calculate overall efficiency across all passes
   */
  private calculateOverallEfficiency(metrics: PassMetrics[]): number {
    if (metrics.length === 0) return 0;

    const efficiencies = metrics.map((m) => m.consolidationEfficiency);
    return efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
  }

  /**
   * Log progress messages if enabled
   */
  private logProgress(message: string): void {
    if (this.config.enableProgressReporting) {
      console.log(`[MultiPassDiscovery] ${message}`);
    }
  }

  /**
   * Get current optimization state (for debugging/monitoring)
   */
  public getCurrentState(): OptimizationState | null {
    return this.currentState;
  }

  /**
   * Get available checkpoints
   */
  public getCheckpoints(): string[] {
    return Array.from(this.checkpoints.keys());
  }

  /**
   * Reset the multi-pass discovery engine including metrics
   */
  public reset(): void {
    this.currentState = null;
    this.checkpoints.clear();
    this.convergenceDetector.reset();
    this.metricsTracker.clearMetrics();
    this.clearDiagnostics();
  }

  /**
   * Get convergence detector configuration
   */
  public getConvergenceConfig(): ConvergenceDetectionConfig {
    return this.convergenceDetector.getConfig();
  }

  /**
   * Update convergence detector configuration
   */
  public updateConvergenceConfig(config: Partial<ConvergenceDetectionConfig>): void {
    this.convergenceDetector.updateConfig(config);
  }

  /**
   * Get enhanced metrics tracker
   */
  public getMetricsTracker(): MetricsTracker {
    return this.metricsTracker;
  }

  /**
   * Export collected metrics
   */
  public async exportMetrics(
    format?: 'json' | 'csv' | 'yaml'
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    return await this.metricsTracker.exportMetrics(format);
  }

  /**
   * Get metrics summary
   */
  public getMetricsSummary(): ReturnType<MetricsTracker['getMetricsSummary']> {
    return this.metricsTracker.getMetricsSummary();
  }

  /**
   * Get aggregated statistics
   */
  public getAggregatedStatistics(): ReturnType<MetricsTracker['getAggregatedStatistics']> {
    return this.metricsTracker.getAggregatedStatistics();
  }

  /**
   * Get metrics tracking configuration
   */
  public getMetricsConfig(): MetricsTrackingConfig {
    return this.metricsTracker.getConfig();
  }

  /**
   * Update metrics tracking configuration
   */
  public updateMetricsConfig(config: Partial<MetricsTrackingConfig>): void {
    this.metricsTracker.updateConfig(config);
  }
}

/**
 * Factory function to create a MultiPassDiscovery instance with default configuration
 */
export function createMultiPassDiscovery(
  config: Partial<MultiPassDiscoveryConfig> = {}
): MultiPassDiscovery {
  return new MultiPassDiscovery(config);
}

/**
 * Quick multi-pass optimization function for simple use cases
 */
export async function quickMultiPassOptimization(
  input: PatternAnalysisInput,
  config: Partial<MultiPassDiscoveryConfig> = {}
): Promise<MultiPassOptimizationResult> {
  const discovery = createMultiPassDiscovery(config);
  return discovery.optimize(input);
}

/**
 * Utility function to validate multi-pass discovery configuration
 */
export function validateMultiPassConfig(config: unknown): MultiPassDiscoveryConfig {
  return MultiPassDiscoveryConfigSchema.parse(config);
}
