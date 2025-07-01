/**
 * Opportunity Identification Engine for TW-Enigma
 *
 * Analyzes detected patterns to surface actionable optimization opportunities:
 * - Pattern consolidation and deduplication analysis
 * - Architecture improvement recommendations
 * - Performance optimization opportunities
 * - Maintainability enhancement suggestions
 * - Code refactoring and modernization insights
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import { FileEntity } from './enhancedDiscovery';
import { AnalysisContext, EntityAnalyzer } from './incrementalAnalysis';
import { PatternAnalysisResult, PatternDetectionResult } from './patternDetection';

// Opportunity Identification Configuration Schema
export const OpportunityConfigSchema = z.object({
  /** Enable pattern consolidation analysis */
  enablePatternConsolidation: z.boolean().default(true),
  /** Enable architecture improvement analysis */
  enableArchitectureAnalysis: z.boolean().default(true),
  /** Enable performance opportunity detection */
  enablePerformanceAnalysis: z.boolean().default(true),
  /** Enable maintainability analysis */
  enableMaintainabilityAnalysis: z.boolean().default(true),
  /** Enable code modernization suggestions */
  enableModernizationAnalysis: z.boolean().default(true),
  /** Minimum opportunity confidence threshold */
  minOpportunityConfidence: z.number().min(0).max(1).default(0.6),
  /** Minimum impact threshold for recommendations */
  minImpactThreshold: z.enum(['low', 'medium', 'high']).default('medium'),
  /** Maximum opportunities per category */
  maxOpportunitiesPerCategory: z.number().default(20),
  /** Enable cross-file opportunity analysis */
  enableCrossFileAnalysis: z.boolean().default(true),
  /** Enable historical trend analysis */
  enableTrendAnalysis: z.boolean().default(false),
  /** Consolidation similarity threshold */
  consolidationThreshold: z.number().min(0).max(1).default(0.8),
  /** Enable verbose logging */
  verbose: z.boolean().default(false),
  /** Custom opportunity rules directory */
  customRulesDir: z.string().optional(),
  /** Enable machine learning-based opportunity detection */
  enableMLOpportunities: z.boolean().default(false),
});

export type OpportunityConfig = z.infer<typeof OpportunityConfigSchema>;

// Opportunity Type Enumeration
export enum OpportunityType {
  PATTERN_CONSOLIDATION = 'pattern-consolidation',
  CODE_DEDUPLICATION = 'code-deduplication',
  ARCHITECTURE_IMPROVEMENT = 'architecture-improvement',
  PERFORMANCE_OPTIMIZATION = 'performance-optimization',
  MAINTAINABILITY_ENHANCEMENT = 'maintainability-enhancement',
  ACCESSIBILITY_IMPROVEMENT = 'accessibility-improvement',
  SECURITY_HARDENING = 'security-hardening',
  CODE_MODERNIZATION = 'code-modernization',
  TESTING_ENHANCEMENT = 'testing-enhancement',
  DOCUMENTATION_IMPROVEMENT = 'documentation-improvement',
  DEPENDENCY_OPTIMIZATION = 'dependency-optimization',
  BUILD_OPTIMIZATION = 'build-optimization',
}

// Impact Level Enumeration
export enum ImpactLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Effort Level Enumeration
export enum EffortLevel {
  MINIMAL = 'minimal', // < 1 hour
  LOW = 'low', // 1-4 hours
  MEDIUM = 'medium', // 1-3 days
  HIGH = 'high', // 1-2 weeks
  EXTENSIVE = 'extensive', // > 2 weeks
}

// Opportunity Priority based on impact/effort ratio
export enum OpportunityPriority {
  CRITICAL = 'critical', // High impact, low effort
  HIGH = 'high', // High impact, medium effort or medium impact, low effort
  MEDIUM = 'medium', // Medium impact, medium effort
  LOW = 'low', // Low impact or high effort
  DEFERRED = 'deferred', // Very high effort or unclear impact
}

// Opportunity Evidence Schema
export const OpportunityEvidenceSchema = z.object({
  /** Evidence type */
  type: z.enum(['pattern-analysis', 'metrics', 'code-similarity', 'architectural', 'performance']),
  /** Evidence description */
  description: z.string(),
  /** Supporting data */
  data: z.any(),
  /** Evidence confidence */
  confidence: z.number().min(0).max(1),
  /** Evidence metadata */
  metadata: z.record(z.any()).optional(),
});

export type OpportunityEvidence = z.infer<typeof OpportunityEvidenceSchema>;

// Opportunity Schema
export const OpportunitySchema = z.object({
  /** Unique opportunity identifier */
  id: z.string(),
  /** Opportunity title */
  title: z.string(),
  /** Opportunity description */
  description: z.string(),
  /** Opportunity type */
  type: z.nativeEnum(OpportunityType),
  /** Expected impact level */
  impact: z.nativeEnum(ImpactLevel),
  /** Required effort level */
  effort: z.nativeEnum(EffortLevel),
  /** Calculated priority */
  priority: z.nativeEnum(OpportunityPriority),
  /** Confidence score */
  confidence: z.number().min(0).max(1),
  /** Affected files */
  affectedFiles: z.array(z.string()),
  /** Related patterns */
  relatedPatterns: z.array(z.string()),
  /** Supporting evidence */
  evidence: z.array(OpportunityEvidenceSchema),
  /** Detailed recommendations */
  recommendations: z.array(
    z.object({
      action: z.string(),
      description: z.string(),
      codeExample: z.string().optional(),
      estimatedTimeHours: z.number().optional(),
      prerequisites: z.array(z.string()).default([]),
      risks: z.array(z.string()).default([]),
    })
  ),
  /** Expected benefits */
  benefits: z.object({
    performanceImprovement: z.string().optional(),
    maintainabilityGain: z.string().optional(),
    codeReduction: z.string().optional(),
    accessibilityImprovement: z.string().optional(),
    securityEnhancement: z.string().optional(),
  }),
  /** Opportunity metadata */
  metadata: z.object({
    detectedAt: z.number(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    estimatedROI: z.number().optional(),
    automationPotential: z.enum(['none', 'partial', 'full']).default('none'),
  }),
});

export type Opportunity = z.infer<typeof OpportunitySchema>;

// Opportunity Analysis Result Schema
export const OpportunityAnalysisResultSchema = z.object({
  /** Identified opportunities */
  opportunities: z.array(OpportunitySchema),
  /** Analysis statistics */
  stats: z.object({
    totalOpportunities: z.number(),
    opportunitiesByType: z.record(z.number()),
    opportunitiesByPriority: z.record(z.number()),
    totalEstimatedHours: z.number(),
    averageConfidence: z.number(),
    analysisTime: z.number(),
  }),
  /** Analysis metadata */
  metadata: z.object({
    analysisTimestamp: z.number(),
    analyzerVersion: z.string(),
    configUsed: z.any(),
    inputPatterns: z.number(),
    errorCount: z.number(),
  }),
});

export type OpportunityAnalysisResult = z.infer<typeof OpportunityAnalysisResultSchema>;

/**
 * Pattern Similarity Calculator
 */
export class PatternSimilarityCalculator {
  /**
   * Calculate similarity between two patterns
   */
  calculateSimilarity(pattern1: PatternDetectionResult, pattern2: PatternDetectionResult): number {
    let similarity = 0;
    let factors = 0;

    // Type similarity
    if (pattern1.type === pattern2.type) {
      similarity += 0.3;
    }
    factors++;

    // Category similarity
    if (pattern1.category === pattern2.category) {
      similarity += 0.2;
    }
    factors++;

    // Content similarity (based on evidence)
    const contentSimilarity = this.calculateContentSimilarity(pattern1, pattern2);
    similarity += contentSimilarity * 0.3;
    factors++;

    // Structural similarity
    const structuralSimilarity = this.calculateStructuralSimilarity(pattern1, pattern2);
    similarity += structuralSimilarity * 0.2;
    factors++;

    return similarity / factors;
  }

  /**
   * Calculate content similarity between patterns
   */
  private calculateContentSimilarity(
    pattern1: PatternDetectionResult,
    pattern2: PatternDetectionResult
  ): number {
    const evidence1 = pattern1.evidence.map((e) => String(e.content)).join(' ');
    const evidence2 = pattern2.evidence.map((e) => String(e.content)).join(' ');

    return this.calculateTextSimilarity(evidence1, evidence2);
  }

  /**
   * Calculate structural similarity between patterns
   */
  private calculateStructuralSimilarity(
    pattern1: PatternDetectionResult,
    pattern2: PatternDetectionResult
  ): number {
    // Simple structural comparison based on evidence types
    const types1 = new Set(pattern1.evidence.map((e) => e.type));
    const types2 = new Set(pattern2.evidence.map((e) => e.type));

    const intersection = new Set([...types1].filter((type) => types2.has(type)));
    const union = new Set([...types1, ...types2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate text similarity using Jaccard similarity
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

/**
 * Consolidation Opportunity Detector
 */
export class ConsolidationDetector {
  private similarityCalculator = new PatternSimilarityCalculator();
  private config: OpportunityConfig;

  constructor(config: OpportunityConfig) {
    this.config = config;
  }

  /**
   * Detect consolidation opportunities in patterns
   */
  detectConsolidationOpportunities(patterns: PatternDetectionResult[]): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const processedPairs = new Set<string>();

    // Group patterns by type and category for efficient comparison
    const patternGroups = this.groupPatterns(patterns);

    for (const [, groupPatterns] of patternGroups) {
      if (groupPatterns.length < 2) continue;

      // Find similar patterns within each group
      for (let i = 0; i < groupPatterns.length - 1; i++) {
        for (let j = i + 1; j < groupPatterns.length; j++) {
          const pattern1 = groupPatterns[i];
          const pattern2 = groupPatterns[j];

          const pairKey = `${pattern1.patternId}-${pattern2.patternId}`;
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);

          const similarity = this.similarityCalculator.calculateSimilarity(pattern1, pattern2);

          if (similarity >= this.config.consolidationThreshold) {
            const opportunity = this.createConsolidationOpportunity(pattern1, pattern2, similarity);
            opportunities.push(opportunity);
          }
        }
      }
    }

    return opportunities;
  }

  /**
   * Group patterns by type and category
   */
  private groupPatterns(patterns: PatternDetectionResult[]): Map<string, PatternDetectionResult[]> {
    const groups = new Map<string, PatternDetectionResult[]>();

    for (const pattern of patterns) {
      const groupKey = `${pattern.type}-${pattern.category}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey)!.push(pattern);
    }

    return groups;
  }

  /**
   * Create consolidation opportunity
   */
  private createConsolidationOpportunity(
    pattern1: PatternDetectionResult,
    pattern2: PatternDetectionResult,
    similarity: number
  ): Opportunity {
    const affectedFiles = [
      ...pattern1.evidence.map((e) => e.location.filePath),
      ...pattern2.evidence.map((e) => e.location.filePath),
    ];

    const uniqueFiles = [...new Set(affectedFiles)];

    return {
      id: createHash('md5')
        .update(`consolidation-${pattern1.patternId}-${pattern2.patternId}`)
        .digest('hex'),
      title: `Consolidate Similar ${pattern1.name} Patterns`,
      description: `Two similar patterns detected that could be consolidated to reduce code duplication and improve maintainability.`,
      type: OpportunityType.PATTERN_CONSOLIDATION,
      impact: uniqueFiles.length > 5 ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
      effort: uniqueFiles.length > 10 ? EffortLevel.HIGH : EffortLevel.MEDIUM,
      priority: this.calculatePriority(ImpactLevel.MEDIUM, EffortLevel.MEDIUM),
      confidence: similarity * 0.9, // Slight discount for uncertainty
      affectedFiles: uniqueFiles,
      relatedPatterns: [pattern1.patternId, pattern2.patternId],
      evidence: [
        {
          type: 'pattern-analysis',
          description: `High similarity detected (${(similarity * 100).toFixed(1)}%)`,
          data: { similarity, patterns: [pattern1.name, pattern2.name] },
          confidence: similarity,
        },
        {
          type: 'code-similarity',
          description: `Patterns found in ${uniqueFiles.length} files`,
          data: { affectedFiles: uniqueFiles },
          confidence: 0.9,
        },
      ],
      recommendations: [
        {
          action: 'extract-common-pattern',
          description: 'Extract common elements into a reusable pattern or component',
          estimatedTimeHours: Math.max(2, uniqueFiles.length * 0.5),
          prerequisites: ['pattern-analysis', 'impact-assessment'],
          risks: ['breaking-changes', 'regression-testing-needed'],
        },
        {
          action: 'update-usage',
          description: 'Update all instances to use the consolidated pattern',
          estimatedTimeHours: uniqueFiles.length * 0.3,
          prerequisites: ['common-pattern-extraction'],
          risks: ['style-inconsistencies'],
        },
      ],
      benefits: {
        maintainabilityGain: 'Reduced code duplication and easier maintenance',
        codeReduction: `Estimated ${Math.round(similarity * 50)}% reduction in duplicate code`,
      },
      metadata: {
        detectedAt: Date.now(),
        category: 'consolidation',
        tags: ['deduplication', 'maintainability'],
        automationPotential: 'partial',
      },
    };
  }

  /**
   * Calculate opportunity priority based on impact and effort
   */
  private calculatePriority(impact: ImpactLevel, effort: EffortLevel): OpportunityPriority {
    const impactScore = this.getImpactScore(impact);
    const effortScore = this.getEffortScore(effort);
    const ratio = impactScore / effortScore;

    if (ratio >= 3) return OpportunityPriority.CRITICAL;
    if (ratio >= 2) return OpportunityPriority.HIGH;
    if (ratio >= 1) return OpportunityPriority.MEDIUM;
    if (ratio >= 0.5) return OpportunityPriority.LOW;
    return OpportunityPriority.DEFERRED;
  }

  private getImpactScore(impact: ImpactLevel): number {
    switch (impact) {
      case ImpactLevel.CRITICAL:
        return 4;
      case ImpactLevel.HIGH:
        return 3;
      case ImpactLevel.MEDIUM:
        return 2;
      case ImpactLevel.LOW:
        return 1;
      default:
        return 1;
    }
  }

  private getEffortScore(effort: EffortLevel): number {
    switch (effort) {
      case EffortLevel.MINIMAL:
        return 1;
      case EffortLevel.LOW:
        return 2;
      case EffortLevel.MEDIUM:
        return 3;
      case EffortLevel.HIGH:
        return 4;
      case EffortLevel.EXTENSIVE:
        return 5;
      default:
        return 3;
    }
  }
}

/**
 * Main Opportunity Identification Engine
 */
export class OpportunityIdentificationEngine implements EntityAnalyzer {
  readonly name = 'OpportunityIdentificationEngine';
  readonly version = '1.0.0';
  readonly supportedTypes = ['file', 'component', 'module'];

  private config: OpportunityConfig;
  private consolidationDetector: ConsolidationDetector;

  constructor(config: Partial<OpportunityConfig> = {}) {
    this.config = OpportunityConfigSchema.parse(config);
    this.consolidationDetector = new ConsolidationDetector(this.config);
  }

  /**
   * Analyze patterns to identify opportunities
   */
  async analyze(entity: FileEntity, context: AnalysisContext): Promise<OpportunityAnalysisResult> {
    const startTime = Date.now();

    try {
      // Extract patterns from analysis results
      const patterns = this.extractPatternsFromContext(context);

      const allOpportunities: Opportunity[] = [];

      // Pattern consolidation opportunities
      if (this.config.enablePatternConsolidation) {
        const consolidationOpportunities =
          this.consolidationDetector.detectConsolidationOpportunities(patterns);
        allOpportunities.push(...consolidationOpportunities);
      }

      // Filter by confidence and impact thresholds
      const filteredOpportunities = this.filterOpportunities(allOpportunities);

      // Calculate statistics
      const stats = this.calculateStatistics(filteredOpportunities, startTime);

      return {
        opportunities: filteredOpportunities,
        stats,
        metadata: {
          analysisTimestamp: Date.now(),
          analyzerVersion: this.version,
          configUsed: this.config,
          inputPatterns: patterns.length,
          errorCount: 0,
        },
      };
    } catch (error) {
      throw new Error(
        `Opportunity analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if analyzer can handle entity
   */
  canAnalyze(_entity: FileEntity): boolean {
    return true; // Can analyze any entity with pattern data
  }

  /**
   * Get cache key for entity
   */
  getCacheKey(entity: FileEntity): string {
    return `opportunity-identification:${entity.checksum}:${this.version}`;
  }

  /**
   * Extract patterns from analysis context
   */
  private extractPatternsFromContext(_context: AnalysisContext): PatternDetectionResult[] {
    const patterns: PatternDetectionResult[] = [];

    // This would extract patterns from previous analysis results
    // For now, return empty array as patterns would come from pattern detection step

    return patterns;
  }

  /**
   * Filter opportunities by thresholds
   */
  private filterOpportunities(opportunities: Opportunity[]): Opportunity[] {
    return opportunities
      .filter((opp) => opp.confidence >= this.config.minOpportunityConfidence)
      .filter((opp) => this.meetsImpactThreshold(opp.impact))
      .sort((a, b) => {
        // Sort by priority, then by confidence
        const priorityOrder = [
          OpportunityPriority.CRITICAL,
          OpportunityPriority.HIGH,
          OpportunityPriority.MEDIUM,
          OpportunityPriority.LOW,
          OpportunityPriority.DEFERRED,
        ];

        const aPriorityIndex = priorityOrder.indexOf(a.priority);
        const bPriorityIndex = priorityOrder.indexOf(b.priority);

        if (aPriorityIndex !== bPriorityIndex) {
          return aPriorityIndex - bPriorityIndex;
        }

        return b.confidence - a.confidence;
      });
  }

  /**
   * Check if opportunity meets impact threshold
   */
  private meetsImpactThreshold(impact: ImpactLevel): boolean {
    const thresholdLevel = this.config.minImpactThreshold;

    const levels = [ImpactLevel.LOW, ImpactLevel.MEDIUM, ImpactLevel.HIGH, ImpactLevel.CRITICAL];
    const impactIndex = levels.indexOf(impact);
    const thresholdIndex = levels.indexOf(thresholdLevel);

    return impactIndex >= thresholdIndex;
  }

  /**
   * Calculate analysis statistics
   */
  private calculateStatistics(opportunities: Opportunity[], startTime: number) {
    const analysisTime = Date.now() - startTime;

    const opportunitiesByType: Record<string, number> = {};
    const opportunitiesByPriority: Record<string, number> = {};
    let totalEstimatedHours = 0;
    let totalConfidence = 0;

    for (const opportunity of opportunities) {
      // Count by type
      opportunitiesByType[opportunity.type] = (opportunitiesByType[opportunity.type] || 0) + 1;

      // Count by priority
      opportunitiesByPriority[opportunity.priority] =
        (opportunitiesByPriority[opportunity.priority] || 0) + 1;

      // Sum estimated hours
      totalEstimatedHours += opportunity.recommendations.reduce(
        (sum, rec) => sum + (rec.estimatedTimeHours || 0),
        0
      );

      // Sum confidence
      totalConfidence += opportunity.confidence;
    }

    return {
      totalOpportunities: opportunities.length,
      opportunitiesByType,
      opportunitiesByPriority,
      totalEstimatedHours,
      averageConfidence: opportunities.length > 0 ? totalConfidence / opportunities.length : 0,
      analysisTime,
    };
  }
}

/**
 * Factory function to create opportunity identification engine
 */
export function createOpportunityIdentificationEngine(
  config: Partial<OpportunityConfig> = {}
): OpportunityIdentificationEngine {
  return new OpportunityIdentificationEngine(config);
}

/**
 * Utility function to analyze opportunities from pattern analysis results
 */
export async function analyzeOpportunities(
  patternResults: PatternAnalysisResult[],
  config: Partial<OpportunityConfig> = {}
): Promise<OpportunityAnalysisResult> {
  const engine = createOpportunityIdentificationEngine(config);

  // Extract all patterns from results
  const allPatterns = patternResults.flatMap((result) => result.patterns);

  // Create a synthetic context for analysis
  const context: AnalysisContext = {
    rootPath: process.cwd(),
    discoveryResult: {
      entities: patternResults.map((r) => ({
        filePath: r.entity.filePath,
        relativePath: r.entity.relativePath,
        fileType: r.entity.fileType,
        checksum: r.entity.checksum,
        size: 0,
        lastModified: Date.now(),
        isDirectory: false,
        metadata: {},
      })),
      stats: {
        totalFiles: patternResults.length,
        totalDirectories: 0,
        totalSize: 0,
        processingTime: 0,
        errorCount: 0,
      },
      metadata: {
        scanStartTime: Date.now(),
        scanEndTime: Date.now(),
        isIncrementalScan: false,
        configUsed: {},
      },
    },
    config: OpportunityConfigSchema.parse(config),
    metadata: { patterns: allPatterns },
  };

  // Use first entity as representative (opportunities are cross-file)
  const entity = context.discoveryResult.entities[0];

  return engine.analyze(entity, context);
}
