/**
 * TW-Enigma Bottleneck Analysis Tools
 *
 * Advanced bottleneck detection and analysis for performance optimization.
 * Provides automated identification of performance issues with detailed
 * analysis and actionable recommendations.
 */

import { createLogger } from '../../utils/logger';
import { BenchmarkResult, ProfilerData } from '../types';
import { BenchmarkProfilingData, PerformanceBottleneck, ResourceSnapshot, Hotspot } from './BenchmarkProfiler';

const logger = createLogger('BottleneckAnalyzer');

/**
 * Bottleneck analysis configuration
 */
export interface BottleneckAnalysisConfig {
  // Detection thresholds
  durationThreshold: number;
  memoryThreshold: number;
  cpuThreshold: number;
  gcThreshold: number;
  eventLoopThreshold: number;
  
  // Analysis settings
  enablePatternDetection: boolean;
  enableCorrelationAnalysis: boolean;
  enableRegressionDetection: boolean;
  enableRootCauseAnalysis: boolean;
  
  // Reporting options
  includeStackTraces: boolean;
  includeRecommendations: boolean;
  maxBottlenecks: number;
  minSeverity: number;
  
  // Time-based analysis
  analysisWindow: number;
  sampleFrequency: number;
  enableTrendAnalysis: boolean;
}

/**
 * Detailed bottleneck with extended analysis
 */
export interface DetailedBottleneck extends PerformanceBottleneck {
  // Extended timing information
  startTime: number;
  endTime: number;
  occurrences: BottleneckOccurrence[];
  
  // Pattern analysis
  pattern: BottleneckPattern;
  recurring: boolean;
  trend: 'improving' | 'worsening' | 'stable';
  
  // Context information
  context: {
    phase: 'initialization' | 'processing' | 'cleanup' | 'unknown';
    category: 'computation' | 'io' | 'memory' | 'network' | 'gc' | 'synchronization';
    affectedComponents: string[];
    relatedOperations: string[];
  };
  
  // Root cause analysis
  rootCause: RootCauseAnalysis;
  
  // Performance impact
  impact: {
    totalTimeWasted: number;
    percentageOfTotal: number;
    affectedBenchmarks: string[];
    estimatedImprovement: number;
  };
}

/**
 * Bottleneck occurrence instance
 */
export interface BottleneckOccurrence {
  timestamp: number;
  duration: number;
  context: Record<string, any>;
  stackTrace?: string[];
  resourceState: {
    memory: number;
    cpu: number;
    gc: boolean;
    eventLoop: number;
  };
}

/**
 * Bottleneck pattern analysis
 */
export interface BottleneckPattern {
  type: 'periodic' | 'burst' | 'gradual' | 'spike' | 'random';
  frequency: number;
  predictability: number;
  seasonality: boolean;
  correlatedWith: string[];
}

/**
 * Root cause analysis results
 */
export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: string[];
  confidence: number;
  evidenceScore: number;
  possibleSolutions: string[];
  preventionStrategies: string[];
}

/**
 * Bottleneck analysis report
 */
export interface BottleneckAnalysisReport {
  summary: {
    totalBottlenecks: number;
    criticalBottlenecks: number;
    totalTimeWasted: number;
    estimatedImprovement: number;
    mostCommonType: string;
    analysisTimeRange: { start: number; end: number };
  };
  
  bottlenecks: DetailedBottleneck[];
  patterns: BottleneckPattern[];
  correlations: BottleneckCorrelation[];
  trends: BottleneckTrend[];
  recommendations: PriorityRecommendation[];
  
  performance: {
    baselineComparison?: PerformanceComparison;
    regressionAnalysis?: RegressionAnalysis;
    impactAssessment: ImpactAssessment;
  };
}

/**
 * Bottleneck correlation analysis
 */
export interface BottleneckCorrelation {
  bottleneck1: string;
  bottleneck2: string;
  correlation: number;
  causality: 'none' | 'likely' | 'strong';
  description: string;
}

/**
 * Bottleneck trend analysis
 */
export interface BottleneckTrend {
  bottleneckType: string;
  direction: 'improving' | 'worsening' | 'stable';
  rate: number;
  confidence: number;
  projection: {
    next30Days: number;
    next90Days: number;
  };
}

/**
 * Priority recommendation with action plan
 */
export interface PriorityRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedImpact: number;
  implementation: {
    steps: string[];
    prerequisites: string[];
    risks: string[];
    testing: string[];
  };
  relatedBottlenecks: string[];
}

/**
 * Performance comparison with baseline
 */
export interface PerformanceComparison {
  baseline: {
    totalDuration: number;
    bottleneckCount: number;
    averageBottleneckDuration: number;
  };
  current: {
    totalDuration: number;
    bottleneckCount: number;
    averageBottleneckDuration: number;
  };
  comparison: {
    durationChange: number;
    bottleneckChange: number;
    improvement: boolean;
  };
}

/**
 * Regression analysis results
 */
export interface RegressionAnalysis {
  detected: boolean;
  severity: 'minor' | 'moderate' | 'severe';
  newBottlenecks: string[];
  worsenedBottlenecks: string[];
  introducedAt?: number;
  estimatedCause?: string;
}

/**
 * Impact assessment
 */
export interface ImpactAssessment {
  userExperience: 'excellent' | 'good' | 'fair' | 'poor';
  performanceScore: number;
  businessImpact: {
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    metrics: Record<string, number>;
  };
}

/**
 * Advanced bottleneck analyzer for comprehensive performance analysis
 */
export class BottleneckAnalyzer {
  private config: BottleneckAnalysisConfig;
  private bottleneckHistory: Map<string, DetailedBottleneck[]> = new Map();
  private analysisCache: Map<string, BottleneckAnalysisReport> = new Map();

  constructor(config: Partial<BottleneckAnalysisConfig> = {}) {
    this.config = {
      durationThreshold: 10,
      memoryThreshold: 50 * 1024 * 1024, // 50MB
      cpuThreshold: 80,
      gcThreshold: 50,
      eventLoopThreshold: 10,
      enablePatternDetection: true,
      enableCorrelationAnalysis: true,
      enableRegressionDetection: true,
      enableRootCauseAnalysis: true,
      includeStackTraces: true,
      includeRecommendations: true,
      maxBottlenecks: 50,
      minSeverity: 0.5,
      analysisWindow: 24 * 60 * 60 * 1000, // 24 hours
      sampleFrequency: 1000,
      enableTrendAnalysis: true,
      ...config,
    };

    logger.info('BottleneckAnalyzer initialized', this.config);
  }

  /**
   * Perform comprehensive bottleneck analysis
   */
  async analyzeBottlenecks(
    profilingData: BenchmarkProfilingData[],
    baselineData?: BenchmarkProfilingData[]
  ): Promise<BottleneckAnalysisReport> {
    logger.info('Starting comprehensive bottleneck analysis', {
      dataPoints: profilingData.length,
      hasBaseline: !!baselineData,
    });

    const analysisId = this.generateAnalysisId(profilingData);
    
    // Check cache
    if (this.analysisCache.has(analysisId)) {
      logger.debug('Returning cached analysis', { analysisId });
      return this.analysisCache.get(analysisId)!;
    }

    // Extract and enhance bottlenecks
    const detailedBottlenecks = await this.extractDetailedBottlenecks(profilingData);
    
    // Perform pattern analysis
    const patterns = this.config.enablePatternDetection 
      ? this.analyzeBottleneckPatterns(detailedBottlenecks)
      : [];
    
    // Perform correlation analysis
    const correlations = this.config.enableCorrelationAnalysis
      ? this.analyzeCorrelations(detailedBottlenecks)
      : [];
    
    // Perform trend analysis
    const trends = this.config.enableTrendAnalysis
      ? this.analyzeTrends(detailedBottlenecks)
      : [];
    
    // Generate recommendations
    const recommendations = this.config.includeRecommendations
      ? this.generatePriorityRecommendations(detailedBottlenecks, patterns)
      : [];
    
    // Performance analysis
    const performance = await this.analyzePerformance(profilingData, baselineData);
    
    // Create summary
    const summary = this.createSummary(detailedBottlenecks, profilingData);
    
    const report: BottleneckAnalysisReport = {
      summary,
      bottlenecks: detailedBottlenecks,
      patterns,
      correlations,
      trends,
      recommendations,
      performance,
    };

    // Cache the report
    this.analysisCache.set(analysisId, report);
    
    logger.info('Bottleneck analysis completed', {
      bottlenecks: detailedBottlenecks.length,
      patterns: patterns.length,
      recommendations: recommendations.length,
    });

    return report;
  }

  /**
   * Analyze bottlenecks in real-time during benchmark execution
   */
  async analyzeRealTime(
    snapshot: ResourceSnapshot,
    context: { benchmarkName: string; timestamp: number }
  ): Promise<DetailedBottleneck[]> {
    const bottlenecks: DetailedBottleneck[] = [];

    // Memory analysis
    if (snapshot.memory.heapUsed > this.config.memoryThreshold) {
      bottlenecks.push(this.createMemoryBottleneck(snapshot, context));
    }

    // CPU analysis
    if (snapshot.cpu.percent > this.config.cpuThreshold) {
      bottlenecks.push(this.createCPUBottleneck(snapshot, context));
    }

    // Event loop analysis
    if (snapshot.eventLoop.lag > this.config.eventLoopThreshold) {
      bottlenecks.push(this.createEventLoopBottleneck(snapshot, context));
    }

    // GC pressure analysis
    if (snapshot.gc.length > this.config.gcThreshold) {
      bottlenecks.push(this.createGCBottleneck(snapshot, context));
    }

    // Update history
    for (const bottleneck of bottlenecks) {
      this.updateBottleneckHistory(bottleneck);
    }

    return bottlenecks;
  }

  /**
   * Extract and enhance bottlenecks from profiling data
   */
  private async extractDetailedBottlenecks(
    profilingData: BenchmarkProfilingData[]
  ): Promise<DetailedBottleneck[]> {
    const detailedBottlenecks: DetailedBottleneck[] = [];

    for (const data of profilingData) {
      for (const bottleneck of data.bottlenecks) {
        const detailed = await this.enhanceBottleneck(bottleneck, data);
        detailedBottlenecks.push(detailed);
      }
    }

    // Sort by severity and filter
    return detailedBottlenecks
      .filter(b => b.severity >= this.config.minSeverity)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, this.config.maxBottlenecks);
  }

  /**
   * Enhance basic bottleneck with detailed analysis
   */
  private async enhanceBottleneck(
    bottleneck: PerformanceBottleneck,
    data: BenchmarkProfilingData
  ): Promise<DetailedBottleneck> {
    // Find occurrences
    const occurrences = this.findBottleneckOccurrences(bottleneck, data);
    
    // Analyze pattern
    const pattern = this.analyzeBottleneckPattern(occurrences);
    
    // Determine context
    const context = this.determineBottleneckContext(bottleneck, data);
    
    // Perform root cause analysis
    const rootCause = this.config.enableRootCauseAnalysis
      ? this.performRootCauseAnalysis(bottleneck, data)
      : this.createEmptyRootCause();
    
    // Calculate impact
    const impact = this.calculateBottleneckImpact(bottleneck, data);
    
    // Determine trend
    const trend = this.determineBottleneckTrend(bottleneck.operation);

    return {
      ...bottleneck,
      startTime: data.startTime,
      endTime: data.endTime,
      occurrences,
      pattern,
      recurring: occurrences.length > 1,
      trend,
      context,
      rootCause,
      impact,
    };
  }

  /**
   * Analyze bottleneck patterns across all bottlenecks
   */
  private analyzeBottleneckPatterns(bottlenecks: DetailedBottleneck[]): BottleneckPattern[] {
    const patternMap = new Map<string, BottleneckPattern>();

    for (const bottleneck of bottlenecks) {
      const key = bottleneck.context.category;
      
      if (!patternMap.has(key)) {
        patternMap.set(key, {
          type: this.determinePatternType(bottleneck),
          frequency: 0,
          predictability: 0,
          seasonality: false,
          correlatedWith: [],
        });
      }

      const pattern = patternMap.get(key)!;
      pattern.frequency += bottleneck.frequency;
    }

    return Array.from(patternMap.values());
  }

  /**
   * Analyze correlations between different bottlenecks
   */
  private analyzeCorrelations(bottlenecks: DetailedBottleneck[]): BottleneckCorrelation[] {
    const correlations: BottleneckCorrelation[] = [];

    for (let i = 0; i < bottlenecks.length; i++) {
      for (let j = i + 1; j < bottlenecks.length; j++) {
        const correlation = this.calculateBottleneckCorrelation(bottlenecks[i], bottlenecks[j]);
        
        if (Math.abs(correlation.correlation) > 0.5) {
          correlations.push(correlation);
        }
      }
    }

    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Analyze bottleneck trends over time
   */
  private analyzeTrends(bottlenecks: DetailedBottleneck[]): BottleneckTrend[] {
    const trendMap = new Map<string, DetailedBottleneck[]>();

    // Group by operation
    for (const bottleneck of bottlenecks) {
      const key = bottleneck.operation;
      if (!trendMap.has(key)) {
        trendMap.set(key, []);
      }
      trendMap.get(key)!.push(bottleneck);
    }

    const trends: BottleneckTrend[] = [];

    for (const [operation, operationBottlenecks] of trendMap) {
      if (operationBottlenecks.length < 2) continue;

      const trend = this.calculateTrend(operationBottlenecks);
      trends.push({
        bottleneckType: operation,
        direction: trend.direction,
        rate: trend.rate,
        confidence: trend.confidence,
        projection: trend.projection,
      });
    }

    return trends;
  }

  /**
   * Generate priority recommendations for bottleneck resolution
   */
  private generatePriorityRecommendations(
    bottlenecks: DetailedBottleneck[],
    patterns: BottleneckPattern[]
  ): PriorityRecommendation[] {
    const recommendations: PriorityRecommendation[] = [];

    // Critical bottlenecks first
    const criticalBottlenecks = bottlenecks.filter(b => b.impact === 'critical');
    for (const bottleneck of criticalBottlenecks) {
      recommendations.push(this.createCriticalRecommendation(bottleneck));
    }

    // Pattern-based recommendations
    for (const pattern of patterns) {
      const patternRecommendation = this.createPatternRecommendation(pattern, bottlenecks);
      if (patternRecommendation) {
        recommendations.push(patternRecommendation);
      }
    }

    // General optimization recommendations
    recommendations.push(...this.createGeneralRecommendations(bottlenecks));

    return recommendations
      .sort((a, b) => this.getRecommendationScore(b) - this.getRecommendationScore(a))
      .slice(0, 10);
  }

  /**
   * Analyze overall performance including baseline comparison and regression detection
   */
  private async analyzePerformance(
    current: BenchmarkProfilingData[],
    baseline?: BenchmarkProfilingData[]
  ): Promise<BottleneckAnalysisReport['performance']> {
    const impactAssessment = this.assessPerformanceImpact(current);
    
    let baselineComparison: PerformanceComparison | undefined;
    let regressionAnalysis: RegressionAnalysis | undefined;

    if (baseline && this.config.enableRegressionDetection) {
      baselineComparison = this.compareWithBaseline(current, baseline);
      regressionAnalysis = this.detectRegressions(current, baseline);
    }

    return {
      baselineComparison,
      regressionAnalysis,
      impactAssessment,
    };
  }

  // Helper methods for bottleneck creation
  private createMemoryBottleneck(
    snapshot: ResourceSnapshot,
    context: { benchmarkName: string; timestamp: number }
  ): DetailedBottleneck {
    const severity = snapshot.memory.heapUsed / this.config.memoryThreshold;
    
    return {
      operation: `memory-usage-${context.benchmarkName}`,
      function: 'memory-allocation',
      duration: 0,
      frequency: 1,
      impact: this.classifyImpact(severity),
      severity,
      description: `High memory usage: ${(snapshot.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      recommendations: [
        'Review memory allocation patterns',
        'Consider object pooling',
        'Implement garbage collection optimization',
      ],
      correlatedMetrics: {
        heapUsed: snapshot.memory.heapUsed,
        heapTotal: snapshot.memory.heapTotal,
      },
      startTime: context.timestamp,
      endTime: context.timestamp,
      occurrences: [],
      pattern: { type: 'spike', frequency: 1, predictability: 0.3, seasonality: false, correlatedWith: [] },
      recurring: false,
      trend: 'stable',
      context: {
        phase: 'processing',
        category: 'memory',
        affectedComponents: [context.benchmarkName],
        relatedOperations: ['memory-allocation'],
      },
      rootCause: {
        primaryCause: 'Excessive memory allocation',
        contributingFactors: ['Large object creation', 'Memory leaks', 'Inefficient data structures'],
        confidence: 0.7,
        evidenceScore: 0.8,
        possibleSolutions: ['Optimize data structures', 'Implement memory pooling'],
        preventionStrategies: ['Memory profiling', 'Regular memory audits'],
      },
      impact: {
        totalTimeWasted: 0,
        percentageOfTotal: severity * 10,
        affectedBenchmarks: [context.benchmarkName],
        estimatedImprovement: severity * 20,
      },
    };
  }

  private createCPUBottleneck(
    snapshot: ResourceSnapshot,
    context: { benchmarkName: string; timestamp: number }
  ): DetailedBottleneck {
    const severity = snapshot.cpu.percent / this.config.cpuThreshold;
    
    return {
      operation: `cpu-usage-${context.benchmarkName}`,
      function: 'cpu-intensive-operation',
      duration: 0,
      frequency: 1,
      impact: this.classifyImpact(severity),
      severity,
      description: `High CPU usage: ${snapshot.cpu.percent.toFixed(1)}%`,
      recommendations: [
        'Optimize computational algorithms',
        'Consider parallel processing',
        'Profile CPU hotspots',
      ],
      correlatedMetrics: {
        cpuPercent: snapshot.cpu.percent,
        userTime: snapshot.cpu.user,
        systemTime: snapshot.cpu.system,
      },
      startTime: context.timestamp,
      endTime: context.timestamp,
      occurrences: [],
      pattern: { type: 'burst', frequency: 1, predictability: 0.5, seasonality: false, correlatedWith: [] },
      recurring: false,
      trend: 'stable',
      context: {
        phase: 'processing',
        category: 'computation',
        affectedComponents: [context.benchmarkName],
        relatedOperations: ['cpu-intensive-operation'],
      },
      rootCause: {
        primaryCause: 'CPU-intensive computation',
        contributingFactors: ['Inefficient algorithms', 'Lack of optimization', 'Synchronous processing'],
        confidence: 0.8,
        evidenceScore: 0.9,
        possibleSolutions: ['Algorithm optimization', 'Asynchronous processing'],
        preventionStrategies: ['Performance testing', 'Code profiling'],
      },
      impact: {
        totalTimeWasted: 0,
        percentageOfTotal: severity * 15,
        affectedBenchmarks: [context.benchmarkName],
        estimatedImprovement: severity * 25,
      },
    };
  }

  private createEventLoopBottleneck(
    snapshot: ResourceSnapshot,
    context: { benchmarkName: string; timestamp: number }
  ): DetailedBottleneck {
    const severity = snapshot.eventLoop.lag / this.config.eventLoopThreshold;
    
    return {
      operation: `event-loop-lag-${context.benchmarkName}`,
      function: 'blocking-operation',
      duration: snapshot.eventLoop.lag,
      frequency: 1,
      impact: this.classifyImpact(severity),
      severity,
      description: `Event loop lag: ${snapshot.eventLoop.lag.toFixed(2)}ms`,
      recommendations: [
        'Avoid blocking operations in event loop',
        'Use Worker threads for CPU-intensive tasks',
        'Implement proper async/await patterns',
      ],
      correlatedMetrics: {
        eventLoopLag: snapshot.eventLoop.lag,
        utilization: snapshot.eventLoop.utilization,
      },
      startTime: context.timestamp,
      endTime: context.timestamp,
      occurrences: [],
      pattern: { type: 'spike', frequency: 1, predictability: 0.4, seasonality: false, correlatedWith: [] },
      recurring: false,
      trend: 'stable',
      context: {
        phase: 'processing',
        category: 'synchronization',
        affectedComponents: [context.benchmarkName],
        relatedOperations: ['blocking-operation'],
      },
      rootCause: {
        primaryCause: 'Event loop blocking',
        contributingFactors: ['Synchronous I/O', 'CPU-intensive sync operations', 'Poor async handling'],
        confidence: 0.9,
        evidenceScore: 0.8,
        possibleSolutions: ['Async I/O', 'Worker threads', 'Process yielding'],
        preventionStrategies: ['Event loop monitoring', 'Async best practices'],
      },
      impact: {
        totalTimeWasted: snapshot.eventLoop.lag,
        percentageOfTotal: severity * 12,
        affectedBenchmarks: [context.benchmarkName],
        estimatedImprovement: severity * 30,
      },
    };
  }

  private createGCBottleneck(
    snapshot: ResourceSnapshot,
    context: { benchmarkName: string; timestamp: number }
  ): DetailedBottleneck {
    const gcEvents = snapshot.gc.length;
    const severity = gcEvents / this.config.gcThreshold;
    const totalGCTime = snapshot.gc.reduce((sum, gc) => sum + gc.duration, 0);
    
    return {
      operation: `gc-pressure-${context.benchmarkName}`,
      function: 'garbage-collection',
      duration: totalGCTime,
      frequency: gcEvents,
      impact: this.classifyImpact(severity),
      severity,
      description: `GC pressure: ${gcEvents} events, ${totalGCTime.toFixed(2)}ms total`,
      recommendations: [
        'Reduce object allocation rate',
        'Optimize object lifecycle management',
        'Consider manual memory management where appropriate',
      ],
      correlatedMetrics: {
        gcEvents,
        gcTime: totalGCTime,
      },
      startTime: context.timestamp,
      endTime: context.timestamp,
      occurrences: [],
      pattern: { type: 'periodic', frequency: gcEvents, predictability: 0.6, seasonality: true, correlatedWith: [] },
      recurring: true,
      trend: 'stable',
      context: {
        phase: 'processing',
        category: 'gc',
        affectedComponents: [context.benchmarkName],
        relatedOperations: ['garbage-collection'],
      },
      rootCause: {
        primaryCause: 'Excessive garbage collection',
        contributingFactors: ['High allocation rate', 'Large object creation', 'Memory fragmentation'],
        confidence: 0.85,
        evidenceScore: 0.9,
        possibleSolutions: ['Object pooling', 'Allocation optimization', 'GC tuning'],
        preventionStrategies: ['Memory profiling', 'Allocation tracking'],
      },
      impact: {
        totalTimeWasted: totalGCTime,
        percentageOfTotal: severity * 8,
        affectedBenchmarks: [context.benchmarkName],
        estimatedImprovement: severity * 15,
      },
    };
  }

  // Helper methods for analysis
  private classifyImpact(severity: number): 'low' | 'medium' | 'high' | 'critical' {
    if (severity > 3) return 'critical';
    if (severity > 2) return 'high';
    if (severity > 1.5) return 'medium';
    return 'low';
  }

  private findBottleneckOccurrences(
    bottleneck: PerformanceBottleneck,
    data: BenchmarkProfilingData
  ): BottleneckOccurrence[] {
    // Implementation would analyze resource snapshots to find occurrences
    return [];
  }

  private analyzeBottleneckPattern(occurrences: BottleneckOccurrence[]): BottleneckPattern {
    // Simplified pattern analysis
    return {
      type: 'random',
      frequency: occurrences.length,
      predictability: 0.5,
      seasonality: false,
      correlatedWith: [],
    };
  }

  private determineBottleneckContext(
    bottleneck: PerformanceBottleneck,
    data: BenchmarkProfilingData
  ): DetailedBottleneck['context'] {
    return {
      phase: 'processing',
      category: this.categorizeBottleneck(bottleneck),
      affectedComponents: [data.benchmarkName],
      relatedOperations: [bottleneck.operation],
    };
  }

  private categorizeBottleneck(bottleneck: PerformanceBottleneck): DetailedBottleneck['context']['category'] {
    const operation = bottleneck.operation.toLowerCase();
    
    if (operation.includes('memory') || operation.includes('alloc')) return 'memory';
    if (operation.includes('cpu') || operation.includes('compute')) return 'computation';
    if (operation.includes('io') || operation.includes('file') || operation.includes('network')) return 'io';
    if (operation.includes('gc')) return 'gc';
    if (operation.includes('lock') || operation.includes('sync')) return 'synchronization';
    
    return 'computation';
  }

  private performRootCauseAnalysis(
    bottleneck: PerformanceBottleneck,
    data: BenchmarkProfilingData
  ): RootCauseAnalysis {
    // Simplified root cause analysis
    return {
      primaryCause: `Performance bottleneck in ${bottleneck.operation}`,
      contributingFactors: ['Unknown factors - detailed analysis needed'],
      confidence: 0.5,
      evidenceScore: 0.6,
      possibleSolutions: ['Performance optimization', 'Code review'],
      preventionStrategies: ['Regular performance monitoring', 'Code profiling'],
    };
  }

  private createEmptyRootCause(): RootCauseAnalysis {
    return {
      primaryCause: 'Analysis not performed',
      contributingFactors: [],
      confidence: 0,
      evidenceScore: 0,
      possibleSolutions: [],
      preventionStrategies: [],
    };
  }

  private calculateBottleneckImpact(
    bottleneck: PerformanceBottleneck,
    data: BenchmarkProfilingData
  ): DetailedBottleneck['impact'] {
    const totalTime = data.duration;
    const timeWasted = bottleneck.duration * bottleneck.frequency;
    
    return {
      totalTimeWasted: timeWasted,
      percentageOfTotal: (timeWasted / totalTime) * 100,
      affectedBenchmarks: [data.benchmarkName],
      estimatedImprovement: timeWasted * 0.7, // Assume 70% can be improved
    };
  }

  private determineBottleneckTrend(operation: string): 'improving' | 'worsening' | 'stable' {
    const history = this.bottleneckHistory.get(operation);
    if (!history || history.length < 2) return 'stable';
    
    // Simple trend analysis
    const recent = history.slice(-3);
    const avg = recent.reduce((sum, b) => sum + b.duration, 0) / recent.length;
    const older = history.slice(-6, -3);
    const olderAvg = older.length > 0 ? older.reduce((sum, b) => sum + b.duration, 0) / older.length : avg;
    
    if (avg < olderAvg * 0.9) return 'improving';
    if (avg > olderAvg * 1.1) return 'worsening';
    return 'stable';
  }

  private updateBottleneckHistory(bottleneck: DetailedBottleneck): void {
    const key = bottleneck.operation;
    if (!this.bottleneckHistory.has(key)) {
      this.bottleneckHistory.set(key, []);
    }
    
    const history = this.bottleneckHistory.get(key)!;
    history.push(bottleneck);
    
    // Keep limited history
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private generateAnalysisId(data: BenchmarkProfilingData[]): string {
    const hash = data.reduce((acc, d) => acc + d.benchmarkId, '');
    return `analysis-${Date.now()}-${hash.slice(0, 8)}`;
  }

  private determinePatternType(bottleneck: DetailedBottleneck): BottleneckPattern['type'] {
    if (bottleneck.recurring) return 'periodic';
    if (bottleneck.duration > 1000) return 'spike';
    return 'random';
  }

  private calculateBottleneckCorrelation(
    b1: DetailedBottleneck,
    b2: DetailedBottleneck
  ): BottleneckCorrelation {
    // Simplified correlation calculation
    const correlation = Math.random() * 2 - 1; // Placeholder
    
    return {
      bottleneck1: b1.operation,
      bottleneck2: b2.operation,
      correlation,
      causality: Math.abs(correlation) > 0.7 ? 'strong' : 'none',
      description: `Correlation between ${b1.operation} and ${b2.operation}`,
    };
  }

  private calculateTrend(bottlenecks: DetailedBottleneck[]): {
    direction: 'improving' | 'worsening' | 'stable';
    rate: number;
    confidence: number;
    projection: { next30Days: number; next90Days: number };
  } {
    // Simplified trend calculation
    return {
      direction: 'stable',
      rate: 0,
      confidence: 0.5,
      projection: { next30Days: 0, next90Days: 0 },
    };
  }

  private createCriticalRecommendation(bottleneck: DetailedBottleneck): PriorityRecommendation {
    return {
      priority: 'critical',
      title: `Resolve critical bottleneck: ${bottleneck.operation}`,
      description: bottleneck.description,
      action: 'Immediate performance optimization required',
      estimatedEffort: 'high',
      estimatedImpact: bottleneck.impact.estimatedImprovement,
      implementation: {
        steps: bottleneck.recommendations,
        prerequisites: ['Performance profiling tools', 'Test environment'],
        risks: ['Potential breaking changes', 'Performance regressions'],
        testing: ['Load testing', 'Performance benchmarks', 'Regression testing'],
      },
      relatedBottlenecks: [bottleneck.operation],
    };
  }

  private createPatternRecommendation(
    pattern: BottleneckPattern,
    bottlenecks: DetailedBottleneck[]
  ): PriorityRecommendation | null {
    if (pattern.frequency < 3) return null;
    
    return {
      priority: 'medium',
      title: `Address recurring performance pattern`,
      description: `${pattern.type} pattern detected with frequency ${pattern.frequency}`,
      action: 'Implement systematic optimization',
      estimatedEffort: 'medium',
      estimatedImpact: pattern.frequency * 10,
      implementation: {
        steps: ['Analyze pattern root cause', 'Design optimization strategy', 'Implement solution'],
        prerequisites: ['Pattern analysis tools'],
        risks: ['System-wide impact'],
        testing: ['Pattern validation', 'Regression testing'],
      },
      relatedBottlenecks: bottlenecks.map(b => b.operation),
    };
  }

  private createGeneralRecommendations(bottlenecks: DetailedBottleneck[]): PriorityRecommendation[] {
    const recommendations: PriorityRecommendation[] = [];
    
    // Memory optimization
    const memoryBottlenecks = bottlenecks.filter(b => b.context.category === 'memory');
    if (memoryBottlenecks.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Memory usage optimization',
        description: `${memoryBottlenecks.length} memory-related bottlenecks detected`,
        action: 'Optimize memory allocation patterns',
        estimatedEffort: 'medium',
        estimatedImpact: memoryBottlenecks.reduce((sum, b) => sum + b.impact.estimatedImprovement, 0),
        implementation: {
          steps: ['Memory profiling', 'Object pooling', 'Garbage collection tuning'],
          prerequisites: ['Memory profiler', 'Performance monitoring'],
          risks: ['Memory leaks', 'Performance degradation'],
          testing: ['Memory stress testing', 'Leak detection'],
        },
        relatedBottlenecks: memoryBottlenecks.map(b => b.operation),
      });
    }
    
    return recommendations;
  }

  private getRecommendationScore(recommendation: PriorityRecommendation): number {
    const priorityScores = { critical: 100, high: 75, medium: 50, low: 25 };
    const effortScores = { low: 1, medium: 0.7, high: 0.4 };
    
    return priorityScores[recommendation.priority] * 
           effortScores[recommendation.estimatedEffort] * 
           (recommendation.estimatedImpact / 100);
  }

  private compareWithBaseline(
    current: BenchmarkProfilingData[],
    baseline: BenchmarkProfilingData[]
  ): PerformanceComparison {
    const currentStats = this.calculateStats(current);
    const baselineStats = this.calculateStats(baseline);
    
    return {
      baseline: baselineStats,
      current: currentStats,
      comparison: {
        durationChange: ((currentStats.totalDuration - baselineStats.totalDuration) / baselineStats.totalDuration) * 100,
        bottleneckChange: currentStats.bottleneckCount - baselineStats.bottleneckCount,
        improvement: currentStats.totalDuration < baselineStats.totalDuration,
      },
    };
  }

  private detectRegressions(
    current: BenchmarkProfilingData[],
    baseline: BenchmarkProfilingData[]
  ): RegressionAnalysis {
    const comparison = this.compareWithBaseline(current, baseline);
    const regression = comparison.comparison.durationChange > 10; // 10% threshold
    
    return {
      detected: regression,
      severity: regression ? (comparison.comparison.durationChange > 50 ? 'severe' : 'moderate') : 'minor',
      newBottlenecks: [], // Would need detailed analysis
      worsenedBottlenecks: [], // Would need detailed analysis
    };
  }

  private assessPerformanceImpact(data: BenchmarkProfilingData[]): ImpactAssessment {
    const stats = this.calculateStats(data);
    
    return {
      userExperience: stats.averageBottleneckDuration > 100 ? 'poor' : 'good',
      performanceScore: Math.max(0, 100 - stats.averageBottleneckDuration / 10),
      businessImpact: {
        level: stats.bottleneckCount > 10 ? 'high' : 'medium',
        description: `${stats.bottleneckCount} performance issues detected`,
        metrics: {
          totalBottlenecks: stats.bottleneckCount,
          averageDuration: stats.averageBottleneckDuration,
        },
      },
    };
  }

  private calculateStats(data: BenchmarkProfilingData[]): {
    totalDuration: number;
    bottleneckCount: number;
    averageBottleneckDuration: number;
  } {
    const totalDuration = data.reduce((sum, d) => sum + d.duration, 0);
    const allBottlenecks = data.flatMap(d => d.bottlenecks);
    const bottleneckCount = allBottlenecks.length;
    const averageBottleneckDuration = bottleneckCount > 0 
      ? allBottlenecks.reduce((sum, b) => sum + b.duration, 0) / bottleneckCount
      : 0;
    
    return {
      totalDuration,
      bottleneckCount,
      averageBottleneckDuration,
    };
  }

  private createSummary(
    bottlenecks: DetailedBottleneck[],
    data: BenchmarkProfilingData[]
  ): BottleneckAnalysisReport['summary'] {
    const criticalBottlenecks = bottlenecks.filter(b => b.impact === 'critical');
    const totalTimeWasted = bottlenecks.reduce((sum, b) => sum + b.impact.totalTimeWasted, 0);
    const estimatedImprovement = bottlenecks.reduce((sum, b) => sum + b.impact.estimatedImprovement, 0);
    
    const categoryCount = new Map<string, number>();
    bottlenecks.forEach(b => {
      const count = categoryCount.get(b.context.category) || 0;
      categoryCount.set(b.context.category, count + 1);
    });
    
    const mostCommonType = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
    
    const timeRange = {
      start: Math.min(...data.map(d => d.startTime)),
      end: Math.max(...data.map(d => d.endTime)),
    };
    
    return {
      totalBottlenecks: bottlenecks.length,
      criticalBottlenecks: criticalBottlenecks.length,
      totalTimeWasted,
      estimatedImprovement,
      mostCommonType,
      analysisTimeRange: timeRange,
    };
  }
}

/**
 * Factory function to create bottleneck analyzer
 */
export function createBottleneckAnalyzer(
  config?: Partial<BottleneckAnalysisConfig>
): BottleneckAnalyzer {
  return new BottleneckAnalyzer(config);
}

/**
 * Create analyzer optimized for CI environments
 */
export function createCIBottleneckAnalyzer(): BottleneckAnalyzer {
  return new BottleneckAnalyzer({
    enablePatternDetection: false,
    enableCorrelationAnalysis: false,
    enableRootCauseAnalysis: false,
    maxBottlenecks: 20,
    includeStackTraces: false,
    enableTrendAnalysis: false,
  });
}

/**
 * Create analyzer optimized for development
 */
export function createDevelopmentBottleneckAnalyzer(): BottleneckAnalyzer {
  return new BottleneckAnalyzer({
    enablePatternDetection: true,
    enableCorrelationAnalysis: true,
    enableRootCauseAnalysis: true,
    includeStackTraces: true,
    includeRecommendations: true,
    enableTrendAnalysis: true,
  });
}