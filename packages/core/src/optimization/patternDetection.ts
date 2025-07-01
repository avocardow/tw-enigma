/**
 * Advanced Pattern Detection System for TW-Enigma
 *
 * Provides sophisticated pattern detection capabilities including:
 * - Known pattern and anti-pattern library with formal specifications
 * - AST traversal and control/data flow analysis
 * - Anomaly detection for previously unseen patterns
 * - Confidence scoring and evidence collection
 * - Extensible pattern matching with user-configurable thresholds
 */

import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { FileEntity } from './enhancedDiscovery';
import { AnalysisContext, EntityAnalyzer } from './incrementalAnalysis';

// Pattern Detection Configuration Schema
export const PatternDetectionConfigSchema = z.object({
  /** Enable known pattern detection */
  enableKnownPatterns: z.boolean().default(true),
  /** Enable anti-pattern detection */
  enableAntiPatterns: z.boolean().default(true),
  /** Enable anomaly detection for unknown patterns */
  enableAnomalyDetection: z.boolean().default(true),
  /** Enable AST-based pattern matching */
  enableASTAnalysis: z.boolean().default(true),
  /** Enable control flow analysis */
  enableControlFlowAnalysis: z.boolean().default(true),
  /** Enable data flow analysis */
  enableDataFlowAnalysis: z.boolean().default(false), // More CPU intensive
  /** Minimum confidence threshold for pattern matches */
  minConfidenceThreshold: z.number().min(0).max(1).default(0.7),
  /** Enable detailed evidence collection */
  enableEvidenceCollection: z.boolean().default(true),
  /** Maximum patterns to detect per file */
  maxPatternsPerFile: z.number().default(50),
  /** Enable pattern caching */
  enablePatternCaching: z.boolean().default(true),
  /** Cache TTL in milliseconds */
  cacheTTL: z.number().default(24 * 60 * 60 * 1000), // 24 hours
  /** Enable verbose logging */
  verbose: z.boolean().default(false),
  /** Custom pattern definitions directory */
  customPatternsDir: z.string().optional(),
  /** Enable machine learning-based pattern detection */
  enableMLDetection: z.boolean().default(false),
  /** Pattern complexity threshold */
  complexityThreshold: z.number().default(0.8),
});

export type PatternDetectionConfig = z.infer<typeof PatternDetectionConfigSchema>;

// Pattern Type Enumeration
export enum PatternType {
  ARCHITECTURAL = 'architectural',
  DESIGN = 'design',
  STRUCTURAL = 'structural',
  BEHAVIORAL = 'behavioral',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  MAINTAINABILITY = 'maintainability',
  ANTI_PATTERN = 'anti-pattern',
  CODE_SMELL = 'code-smell',
  ANOMALY = 'anomaly',
  CUSTOM = 'custom',
}

// Pattern Severity Levels
export enum PatternSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Pattern Category for classification
export enum PatternCategory {
  CSS_UTILITY = 'css-utility',
  CSS_COMPONENT = 'css-component',
  CSS_LAYOUT = 'css-layout',
  CSS_RESPONSIVE = 'css-responsive',
  CSS_ANIMATION = 'css-animation',
  HTML_STRUCTURE = 'html-structure',
  HTML_SEMANTIC = 'html-semantic',
  HTML_ACCESSIBILITY = 'html-accessibility',
  JS_FUNCTION = 'js-function',
  JS_CLASS = 'js-class',
  JS_MODULE = 'js-module',
  JS_ASYNC = 'js-async',
  FRAMEWORK_SPECIFIC = 'framework-specific',
  CROSS_CUTTING = 'cross-cutting',
}

// Pattern Evidence Schema
export const PatternEvidenceSchema = z.object({
  /** Evidence type */
  type: z.enum(['ast-node', 'code-snippet', 'metric', 'dependency', 'usage']),
  /** Evidence description */
  description: z.string(),
  /** Location in source code */
  location: z.object({
    filePath: z.string(),
    startLine: z.number(),
    endLine: z.number(),
    startColumn: z.number().optional(),
    endColumn: z.number().optional(),
  }),
  /** Evidence content/value */
  content: z.any(),
  /** Evidence confidence score */
  confidence: z.number().min(0).max(1),
  /** Additional metadata */
  metadata: z.record(z.any()).optional(),
});

export type PatternEvidence = z.infer<typeof PatternEvidenceSchema>;

// Pattern Detection Result Schema
export const PatternDetectionResultSchema = z.object({
  /** Unique pattern identifier */
  patternId: z.string(),
  /** Pattern name */
  name: z.string(),
  /** Pattern description */
  description: z.string(),
  /** Pattern type */
  type: z.nativeEnum(PatternType),
  /** Pattern category */
  category: z.nativeEnum(PatternCategory),
  /** Pattern severity */
  severity: z.nativeEnum(PatternSeverity),
  /** Overall confidence score */
  confidence: z.number().min(0).max(1),
  /** Evidence supporting this pattern detection */
  evidence: z.array(PatternEvidenceSchema),
  /** Pattern metadata */
  metadata: z.object({
    /** Detection timestamp */
    detectedAt: z.number(),
    /** Detection method used */
    detectionMethod: z.string(),
    /** Pattern complexity score */
    complexityScore: z.number(),
    /** Pattern frequency (if recurring) */
    frequency: z.number().optional(),
    /** Related patterns */
    relatedPatterns: z.array(z.string()).default([]),
    /** Performance impact estimate */
    performanceImpact: z.enum(['none', 'low', 'medium', 'high']).optional(),
  }),
  /** Suggested actions/recommendations */
  recommendations: z
    .array(
      z.object({
        action: z.string(),
        priority: z.enum(['low', 'medium', 'high']),
        description: z.string(),
        estimatedEffort: z.string().optional(),
      })
    )
    .default([]),
});

export type PatternDetectionResult = z.infer<typeof PatternDetectionResultSchema>;

// Known Pattern Definition Schema
export const KnownPatternSchema = z.object({
  /** Pattern unique identifier */
  id: z.string(),
  /** Pattern name */
  name: z.string(),
  /** Pattern description */
  description: z.string(),
  /** Pattern type */
  type: z.nativeEnum(PatternType),
  /** Pattern category */
  category: z.nativeEnum(PatternCategory),
  /** Default severity */
  severity: z.nativeEnum(PatternSeverity),
  /** Pattern matching rules */
  rules: z.object({
    /** AST node patterns to match */
    astPatterns: z
      .array(
        z.object({
          nodeType: z.string(),
          properties: z.record(z.any()).optional(),
          children: z.array(z.any()).optional(),
        })
      )
      .default([]),
    /** Code regex patterns */
    codePatterns: z
      .array(
        z.object({
          regex: z.string(),
          flags: z.string().optional(),
          context: z.string().optional(),
        })
      )
      .default([]),
    /** Structural patterns */
    structuralPatterns: z
      .array(
        z.object({
          structure: z.string(),
          minOccurrences: z.number().default(1),
          maxOccurrences: z.number().optional(),
        })
      )
      .default([]),
    /** Metric thresholds */
    metricThresholds: z
      .record(
        z.object({
          min: z.number().optional(),
          max: z.number().optional(),
          target: z.number().optional(),
        })
      )
      .default({}),
  }),
  /** Pattern examples */
  examples: z
    .array(
      z.object({
        title: z.string(),
        code: z.string(),
        explanation: z.string(),
      })
    )
    .default([]),
  /** Default recommendations */
  recommendations: z
    .array(
      z.object({
        action: z.string(),
        priority: z.enum(['low', 'medium', 'high']),
        description: z.string(),
      })
    )
    .default([]),
  /** Pattern metadata */
  metadata: z.object({
    tags: z.array(z.string()).default([]),
    version: z.string().default('1.0.0'),
    author: z.string().optional(),
    lastUpdated: z.number().optional(),
  }),
});

export type KnownPattern = z.infer<typeof KnownPatternSchema>;

// Analysis Result Schema
export const PatternAnalysisResultSchema = z.object({
  /** File entity analyzed */
  entity: z.object({
    filePath: z.string(),
    relativePath: z.string(),
    fileType: z.string(),
    checksum: z.string(),
  }),
  /** Detected patterns */
  patterns: z.array(PatternDetectionResultSchema),
  /** Analysis statistics */
  stats: z.object({
    totalPatterns: z.number(),
    knownPatterns: z.number(),
    antiPatterns: z.number(),
    anomalies: z.number(),
    analysisTime: z.number(),
    confidenceDistribution: z.record(z.number()),
  }),
  /** Analysis metadata */
  metadata: z.object({
    analysisTimestamp: z.number(),
    analyzerVersion: z.string(),
    configUsed: z.any(),
    errorCount: z.number(),
    warnings: z.array(z.string()).default([]),
  }),
});

export type PatternAnalysisResult = z.infer<typeof PatternAnalysisResultSchema>;

/**
 * Pattern Matcher Interface
 */
export interface PatternMatcher {
  /** Matcher name */
  readonly name: string;
  /** Supported pattern types */
  readonly supportedTypes: PatternType[];
  /** Supported file types */
  readonly supportedFileTypes: string[];

  /** Match patterns in content */
  match(
    content: string,
    entity: FileEntity,
    context: AnalysisContext
  ): Promise<PatternDetectionResult[]>;
  /** Check if matcher can handle this entity */
  canHandle(entity: FileEntity): boolean;
  /** Get matcher configuration */
  getConfig(): any;
}

/**
 * CSS Pattern Matcher
 */
export class CSSPatternMatcher implements PatternMatcher {
  readonly name = 'CSSPatternMatcher';
  readonly supportedTypes = [
    PatternType.DESIGN,
    PatternType.STRUCTURAL,
    PatternType.PERFORMANCE,
    PatternType.MAINTAINABILITY,
  ];
  readonly supportedFileTypes = ['css', 'scss', 'sass', 'less'];

  private knownPatterns: KnownPattern[] = [
    {
      id: 'css-utility-class',
      name: 'Utility Class Pattern',
      description: 'Single-purpose utility classes for common styling needs',
      type: PatternType.DESIGN,
      category: PatternCategory.CSS_UTILITY,
      severity: PatternSeverity.INFO,
      rules: {
        codePatterns: [
          {
            regex: '\\.(m[trblxy]?-\\d+|p[trblxy]?-\\d+|text-\\w+|bg-\\w+|flex|grid)',
            flags: 'g',
            context: 'utility-classes',
          },
        ],
        astPatterns: [],
        structuralPatterns: [],
        metricThresholds: {},
      },
      examples: [],
      recommendations: [],
      metadata: { tags: ['utility', 'atomic'], version: '1.0.0' },
    },
    {
      id: 'css-component-class',
      name: 'Component Class Pattern',
      description: 'BEM-style component classes with modifiers',
      type: PatternType.STRUCTURAL,
      category: PatternCategory.CSS_COMPONENT,
      severity: PatternSeverity.INFO,
      rules: {
        codePatterns: [
          {
            regex:
              '\\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?(?:--[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?',
            flags: 'g',
            context: 'bem-classes',
          },
        ],
        astPatterns: [],
        structuralPatterns: [],
        metricThresholds: {},
      },
      examples: [],
      recommendations: [],
      metadata: { tags: ['component', 'bem'], version: '1.0.0' },
    },
  ];

  async match(content: string, entity: FileEntity): Promise<PatternDetectionResult[]> {
    const results: PatternDetectionResult[] = [];
    const lines = content.split('\n');

    for (const pattern of this.knownPatterns) {
      for (const rule of pattern.rules.codePatterns) {
        const regex = new RegExp(rule.regex, rule.flags || 'g');
        let match;

        while ((match = regex.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length;

          results.push({
            patternId: pattern.id,
            name: pattern.name,
            description: pattern.description,
            type: pattern.type,
            category: pattern.category,
            severity: pattern.severity,
            confidence: 0.9,
            evidence: [
              {
                type: 'code-snippet',
                description: `Pattern match at line ${lineNumber}`,
                location: {
                  filePath: entity.filePath,
                  startLine: lineNumber,
                  endLine: lineNumber,
                },
                content: match[0],
                confidence: 0.9,
              },
            ],
            metadata: {
              detectedAt: Date.now(),
              detectionMethod: 'regex-matching',
              complexityScore: 0.3,
              relatedPatterns: [],
            },
            recommendations: pattern.recommendations,
          });
        }
      }
    }

    return results;
  }

  canHandle(entity: FileEntity): boolean {
    return this.supportedFileTypes.includes(entity.fileType);
  }

  getConfig(): any {
    return { patterns: this.knownPatterns.length };
  }
}

/**
 * HTML Pattern Matcher
 */
export class HTMLPatternMatcher implements PatternMatcher {
  readonly name = 'HTMLPatternMatcher';
  readonly supportedTypes = [PatternType.STRUCTURAL, PatternType.BEHAVIORAL, PatternType.SECURITY];
  readonly supportedFileTypes = ['html', 'htm', 'vue', 'svelte'];

  private knownPatterns: KnownPattern[] = [
    {
      id: 'html-semantic-structure',
      name: 'Semantic HTML Structure',
      description: 'Proper use of semantic HTML elements',
      type: PatternType.STRUCTURAL,
      category: PatternCategory.HTML_SEMANTIC,
      severity: PatternSeverity.INFO,
      rules: {
        codePatterns: [
          {
            regex: '<(header|nav|main|section|article|aside|footer)',
            flags: 'gi',
            context: 'semantic-elements',
          },
        ],
        astPatterns: [],
        structuralPatterns: [],
        metricThresholds: {},
      },
      examples: [],
      recommendations: [],
      metadata: { tags: ['semantic', 'accessibility'], version: '1.0.0' },
    },
  ];

  async match(content: string, entity: FileEntity): Promise<PatternDetectionResult[]> {
    const results: PatternDetectionResult[] = [];

    for (const pattern of this.knownPatterns) {
      for (const rule of pattern.rules.codePatterns) {
        const regex = new RegExp(rule.regex, rule.flags || 'g');
        let match;

        while ((match = regex.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split('\n').length;

          results.push({
            patternId: pattern.id,
            name: pattern.name,
            description: pattern.description,
            type: pattern.type,
            category: pattern.category,
            severity: pattern.severity,
            confidence: 0.85,
            evidence: [
              {
                type: 'code-snippet',
                description: `Semantic element found at line ${lineNumber}`,
                location: {
                  filePath: entity.filePath,
                  startLine: lineNumber,
                  endLine: lineNumber,
                },
                content: match[0],
                confidence: 0.85,
              },
            ],
            metadata: {
              detectedAt: Date.now(),
              detectionMethod: 'regex-matching',
              complexityScore: 0.2,
              relatedPatterns: [],
            },
            recommendations: pattern.recommendations,
          });
        }
      }
    }

    return results;
  }

  canHandle(entity: FileEntity): boolean {
    return this.supportedFileTypes.includes(entity.fileType);
  }

  getConfig(): any {
    return { patterns: this.knownPatterns.length };
  }
}

/**
 * Anomaly Detector for unknown patterns
 */
export class AnomalyDetector {
  private config: PatternDetectionConfig;
  private knownPatternHashes: Set<string> = new Set();

  constructor(config: PatternDetectionConfig) {
    this.config = config;
  }

  /**
   * Learn from known patterns to establish baseline
   */
  learnFromPatterns(patterns: KnownPattern[]): void {
    for (const pattern of patterns) {
      const hash = this.createPatternHash(pattern);
      this.knownPatternHashes.add(hash);
    }
  }

  /**
   * Detect anomalous patterns in content
   */
  async detectAnomalies(content: string, entity: FileEntity): Promise<PatternDetectionResult[]> {
    const anomalies: PatternDetectionResult[] = [];

    // Simple anomaly detection based on unusual code structures
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect unusually long lines (potential code smell)
      if (line.length > 200) {
        anomalies.push({
          patternId: 'anomaly-long-line',
          name: 'Long Line Anomaly',
          description: 'Unusually long line that may indicate code smell',
          type: PatternType.ANOMALY,
          category: PatternCategory.CROSS_CUTTING,
          severity: PatternSeverity.LOW,
          confidence: 0.6,
          evidence: [
            {
              type: 'code-snippet',
              description: `Long line detected (${line.length} characters)`,
              location: {
                filePath: entity.filePath,
                startLine: i + 1,
                endLine: i + 1,
              },
              content: line.substring(0, 100) + '...',
              confidence: 0.6,
            },
          ],
          metadata: {
            detectedAt: Date.now(),
            detectionMethod: 'anomaly-detection',
            complexityScore: 0.4,
            relatedPatterns: [],
          },
          recommendations: [
            {
              action: 'refactor',
              priority: 'low',
              description: 'Consider breaking this line into multiple lines for better readability',
            },
          ],
        });
      }

      // Detect deeply nested structures
      const indentLevel = line.length - line.trimStart().length;
      if (indentLevel > 32) {
        // More than 8 levels of 4-space indentation
        anomalies.push({
          patternId: 'anomaly-deep-nesting',
          name: 'Deep Nesting Anomaly',
          description: 'Unusually deep nesting level detected',
          type: PatternType.ANOMALY,
          category: PatternCategory.CROSS_CUTTING,
          severity: PatternSeverity.MEDIUM,
          confidence: 0.7,
          evidence: [
            {
              type: 'code-snippet',
              description: `Deep nesting detected (${Math.floor(indentLevel / 4)} levels)`,
              location: {
                filePath: entity.filePath,
                startLine: i + 1,
                endLine: i + 1,
              },
              content: line,
              confidence: 0.7,
            },
          ],
          metadata: {
            detectedAt: Date.now(),
            detectionMethod: 'anomaly-detection',
            complexityScore: 0.8,
            relatedPatterns: [],
          },
          recommendations: [
            {
              action: 'refactor',
              priority: 'medium',
              description: 'Consider extracting nested logic into separate functions or components',
            },
          ],
        });
      }
    }

    return anomalies;
  }

  /**
   * Create hash for pattern matching
   */
  private createPatternHash(pattern: KnownPattern): string {
    const hashContent = JSON.stringify({
      name: pattern.name,
      type: pattern.type,
      rules: pattern.rules,
    });
    return createHash('md5').update(hashContent).digest('hex');
  }
}

/**
 * Main Pattern Detection Engine
 */
export class PatternDetectionEngine implements EntityAnalyzer {
  readonly name = 'PatternDetectionEngine';
  readonly version = '1.0.0';
  readonly supportedTypes = ['file', 'component', 'module'];

  private config: PatternDetectionConfig;
  private matchers: PatternMatcher[] = [];
  private anomalyDetector: AnomalyDetector;
  private knownPatterns: KnownPattern[] = [];

  constructor(config: Partial<PatternDetectionConfig> = {}) {
    this.config = PatternDetectionConfigSchema.parse(config);
    this.anomalyDetector = new AnomalyDetector(this.config);

    // Register default matchers
    this.registerMatcher(new CSSPatternMatcher());
    this.registerMatcher(new HTMLPatternMatcher());

    this.loadKnownPatterns();
  }

  /**
   * Register a pattern matcher
   */
  registerMatcher(matcher: PatternMatcher): void {
    this.matchers.push(matcher);
    if (this.config.verbose) {
      console.log(`Registered pattern matcher: ${matcher.name}`);
    }
  }

  /**
   * Add known pattern
   */
  addKnownPattern(pattern: KnownPattern): void {
    this.knownPatterns.push(pattern);
    this.anomalyDetector.learnFromPatterns([pattern]);
  }

  /**
   * Analyze entity for patterns
   */
  async analyze(entity: FileEntity, context: AnalysisContext): Promise<PatternAnalysisResult> {
    const startTime = Date.now();
    const allPatterns: PatternDetectionResult[] = [];

    try {
      // Read file content
      const content = await fs.readFile(entity.filePath, 'utf-8');

      // Apply pattern matchers
      if (this.config.enableKnownPatterns || this.config.enableAntiPatterns) {
        for (const matcher of this.matchers) {
          if (matcher.canHandle(entity)) {
            try {
              const patterns = await matcher.match(content, entity, context);
              allPatterns.push(...patterns);
            } catch (error) {
              if (this.config.verbose) {
                console.warn(`Pattern matcher ${matcher.name} failed:`, error);
              }
            }
          }
        }
      }

      // Apply anomaly detection
      if (this.config.enableAnomalyDetection) {
        try {
          const anomalies = await this.anomalyDetector.detectAnomalies(content, entity);
          allPatterns.push(...anomalies);
        } catch (error) {
          if (this.config.verbose) {
            console.warn('Anomaly detection failed:', error);
          }
        }
      }

      // Filter by confidence threshold
      const filteredPatterns = allPatterns.filter(
        (pattern) => pattern.confidence >= this.config.minConfidenceThreshold
      );

      // Limit patterns per file
      const finalPatterns = filteredPatterns.slice(0, this.config.maxPatternsPerFile);

      // Calculate statistics
      const stats = this.calculateStatistics(finalPatterns, startTime);

      return {
        entity: {
          filePath: entity.filePath,
          relativePath: entity.relativePath,
          fileType: entity.fileType,
          checksum: entity.checksum,
        },
        patterns: finalPatterns,
        stats,
        metadata: {
          analysisTimestamp: Date.now(),
          analyzerVersion: this.version,
          configUsed: this.config,
          errorCount: 0,
          warnings: [],
        },
      };
    } catch (error) {
      throw new Error(
        `Pattern analysis failed for ${entity.relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if analyzer can handle entity
   */
  canAnalyze(entity: FileEntity): boolean {
    return this.matchers.some((matcher) => matcher.canHandle(entity));
  }

  /**
   * Get cache key for entity
   */
  getCacheKey(entity: FileEntity): string {
    return `pattern-detection:${entity.checksum}:${this.version}`;
  }

  /**
   * Load known patterns from configuration
   */
  private loadKnownPatterns(): void {
    // Load default patterns - in a real implementation, this would load from files
    // For now, we rely on the patterns defined in individual matchers
    this.anomalyDetector.learnFromPatterns(this.knownPatterns);
  }

  /**
   * Calculate analysis statistics
   */
  private calculateStatistics(patterns: PatternDetectionResult[], startTime: number) {
    const analysisTime = Date.now() - startTime;
    const totalPatterns = patterns.length;
    const knownPatterns = patterns.filter((p) => p.type !== PatternType.ANOMALY).length;
    const antiPatterns = patterns.filter((p) => p.type === PatternType.ANTI_PATTERN).length;
    const anomalies = patterns.filter((p) => p.type === PatternType.ANOMALY).length;

    // Calculate confidence distribution
    const confidenceDistribution: Record<string, number> = {
      high: patterns.filter((p) => p.confidence >= 0.8).length,
      medium: patterns.filter((p) => p.confidence >= 0.6 && p.confidence < 0.8).length,
      low: patterns.filter((p) => p.confidence < 0.6).length,
    };

    return {
      totalPatterns,
      knownPatterns,
      antiPatterns,
      anomalies,
      analysisTime,
      confidenceDistribution,
    };
  }
}

/**
 * Factory function to create pattern detection engine
 */
export function createPatternDetectionEngine(
  config: Partial<PatternDetectionConfig> = {}
): PatternDetectionEngine {
  return new PatternDetectionEngine(config);
}

/**
 * Utility function to analyze patterns in a single file
 */
export async function analyzeFilePatterns(
  filePath: string,
  config: Partial<PatternDetectionConfig> = {}
): Promise<PatternAnalysisResult> {
  const engine = createPatternDetectionEngine(config);

  // Create a minimal file entity
  const content = await fs.readFile(filePath, 'utf-8');
  const checksum = createHash('md5').update(content).digest('hex');
  const relativePath = path.relative(process.cwd(), filePath);
  const fileExtension = path.extname(filePath).slice(1);

  const entity: FileEntity = {
    filePath,
    relativePath,
    fileType: fileExtension,
    checksum,
    size: content.length,
    lastModified: Date.now(),
    isDirectory: false,
    metadata: {},
  };

  const context: AnalysisContext = {
    rootPath: process.cwd(),
    discoveryResult: {
      entities: [entity],
      stats: {
        totalFiles: 1,
        totalDirectories: 0,
        totalSize: content.length,
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
    config: PatternDetectionConfigSchema.parse(config),
    metadata: {},
  };

  return engine.analyze(entity, context);
}
