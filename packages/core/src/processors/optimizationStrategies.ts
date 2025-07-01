/**
 * Optimization Strategies for Template Literal Processing
 * 
 * Implements various optimization techniques for template literal detection,
 * parsing, caching, and runtime class generation to minimize overhead.
 */

import LRU from 'lru-cache';
import type { DynamicClassPattern, RuntimeClassMapping, OptimizationHint } from './types';
import type { ASTTemplateLiteral } from './astTemplateParser';
import type { TemplateLiteralMatch } from './templateLiteralDetector';

export interface OptimizationConfig {
  /** Enable parsing cache */
  enableParsingCache?: boolean;
  /** Enable pattern cache */
  enablePatternCache?: boolean;
  /** Enable result cache */
  enableResultCache?: boolean;
  /** Cache sizes */
  cacheOptions?: {
    parsing?: { max: number; ttl?: number };
    patterns?: { max: number; ttl?: number };
    results?: { max: number; ttl?: number };
  };
  /** Performance thresholds */
  thresholds?: {
    maxParseTime?: number;
    maxPatternComplexity?: number;
    maxCacheMemory?: number;
  };
  /** Optimization levels */
  levels?: {
    detection?: 'fast' | 'balanced' | 'thorough';
    caching?: 'minimal' | 'standard' | 'aggressive';
    processing?: 'basic' | 'optimized' | 'maximum';
  };
}

export interface PerformanceMetrics {
  /** Parse time statistics */
  parseTime: {
    min: number;
    max: number;
    avg: number;
    total: number;
  };
  /** Cache hit rates */
  cacheHits: {
    parsing: number;
    patterns: number;
    results: number;
  };
  /** Memory usage */
  memoryUsage: {
    parsing: number;
    patterns: number;
    results: number;
    total: number;
  };
  /** Processing counts */
  processedItems: {
    templates: number;
    patterns: number;
    generations: number;
  };
}

export interface OptimizationReport {
  /** Applied optimizations */
  optimizations: string[];
  /** Performance improvements */
  improvements: {
    parseTimeReduction: number;
    cacheHitRate: number;
    memoryEfficiency: number;
  };
  /** Recommendations */
  recommendations: OptimizationHint[];
  /** Metrics */
  metrics: PerformanceMetrics;
}

/**
 * Template Processing Optimizer
 */
export class TemplateOptimizer {
  private config: Required<OptimizationConfig>;
  private parseCache: LRU<string, ASTTemplateLiteral[]>;
  private patternCache: LRU<string, DynamicClassPattern>;
  private resultCache: LRU<string, string[]>;
  private metrics: PerformanceMetrics;
  private startTime: number;

  constructor(config: OptimizationConfig = {}) {
    this.config = this.buildConfig(config);
    this.parseCache = new LRU(this.config.cacheOptions.parsing);
    this.patternCache = new LRU(this.config.cacheOptions.patterns);
    this.resultCache = new LRU(this.config.cacheOptions.results);
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
  }

  /**
   * Optimize template literal detection
   */
  optimizeDetection(source: string, cacheKey?: string): {
    templates: TemplateLiteralMatch[];
    optimizations: string[];
    fromCache: boolean;
  } {
    const optimizations: string[] = [];
    const key = cacheKey || this.generateCacheKey('detection', source);

    // Check cache first
    if (this.config.enableParsingCache) {
      const cached = this.parseCache.get(key);
      if (cached) {
        this.metrics.cacheHits.parsing++;
        return {
          templates: cached as TemplateLiteralMatch[],
          optimizations: ['cache-hit'],
          fromCache: true,
        };
      }
    }

    // Apply detection level optimizations
    const templates = this.optimizedDetection(source, optimizations);

    // Cache result
    if (this.config.enableParsingCache && templates.length > 0) {
      this.parseCache.set(key, templates as ASTTemplateLiteral[]);
      optimizations.push('cached-result');
    }

    this.metrics.processedItems.templates += templates.length;

    return {
      templates,
      optimizations,
      fromCache: false,
    };
  }

  /**
   * Optimize pattern extraction
   */
  optimizePatternExtraction(templates: TemplateLiteralMatch[]): {
    patterns: DynamicClassPattern[];
    optimizations: string[];
  } {
    const optimizations: string[] = [];
    const patterns: DynamicClassPattern[] = [];

    for (const template of templates) {
      const key = this.generateCacheKey('pattern', template.raw);

      // Check pattern cache
      if (this.config.enablePatternCache) {
        const cached = this.patternCache.get(key);
        if (cached) {
          patterns.push(cached);
          this.metrics.cacheHits.patterns++;
          continue;
        }
      }

      // Extract pattern with optimizations
      const pattern = this.optimizedPatternExtraction(template, optimizations);
      if (pattern) {
        patterns.push(pattern);

        // Cache pattern
        if (this.config.enablePatternCache) {
          this.patternCache.set(key, pattern);
        }
      }
    }

    this.metrics.processedItems.patterns += patterns.length;

    if (patterns.length > 0) {
      optimizations.push('pattern-extraction-optimized');
    }

    return { patterns, optimizations };
  }

  /**
   * Optimize class generation
   */
  optimizeGeneration(
    pattern: DynamicClassPattern,
    context: Record<string, any>
  ): {
    classes: string[];
    optimizations: string[];
  } {
    const optimizations: string[] = [];
    const key = this.generateCacheKey('generation', pattern.id, JSON.stringify(context));

    // Check result cache
    if (this.config.enableResultCache) {
      const cached = this.resultCache.get(key);
      if (cached) {
        this.metrics.cacheHits.results++;
        return {
          classes: cached,
          optimizations: ['cache-hit', 'generation-cached'],
        };
      }
    }

    // Generate classes with optimizations
    const classes = this.optimizedGeneration(pattern, context, optimizations);

    // Cache result
    if (this.config.enableResultCache && classes.length > 0) {
      this.resultCache.set(key, classes);
      optimizations.push('generation-cached');
    }

    this.metrics.processedItems.generations++;

    return { classes, optimizations };
  }

  /**
   * Precompile static patterns
   */
  precompilePatterns(patterns: DynamicClassPattern[]): Map<string, RuntimeClassMapping> {
    const mappings = new Map<string, RuntimeClassMapping>();

    for (const pattern of patterns) {
      // Only precompile patterns with static expressions
      if (this.canPrecompile(pattern)) {
        const mapping = this.createPrecompiledMapping(pattern);
        mappings.set(pattern.id, mapping);
      }
    }

    return mappings;
  }

  /**
   * Batch optimize multiple templates
   */
  batchOptimize(sources: string[]): OptimizationReport {
    const startTime = performance.now();
    const optimizations: string[] = [];
    let totalTemplates = 0;
    let totalPatterns = 0;

    // Process in batches for memory efficiency
    const batchSize = 10;
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);
      
      for (const source of batch) {
        const { templates } = this.optimizeDetection(source);
        const { patterns } = this.optimizePatternExtraction(templates);
        
        totalTemplates += templates.length;
        totalPatterns += patterns.length;
      }

      // Trigger garbage collection hint
      if (global.gc && i % (batchSize * 4) === 0) {
        global.gc();
      }
    }

    optimizations.push('batch-processing', 'memory-optimized');

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return {
      optimizations,
      improvements: {
        parseTimeReduction: this.calculateParseTimeReduction(),
        cacheHitRate: this.calculateCacheHitRate(),
        memoryEfficiency: this.calculateMemoryEfficiency(),
      },
      recommendations: this.generateRecommendations(),
      metrics: this.getMetrics(),
    };
  }

  /**
   * Memory optimization
   */
  optimizeMemory(): {
    freedMemory: number;
    optimizations: string[];
  } {
    const optimizations: string[] = [];
    let freedMemory = 0;

    // Clear expired cache entries
    if (this.config.enableParsingCache) {
      const sizeBefore = this.parseCache.size;
      this.parseCache.purgeStale();
      const sizeAfter = this.parseCache.size;
      freedMemory += (sizeBefore - sizeAfter) * 1024; // Estimate
      optimizations.push('parse-cache-purged');
    }

    // Optimize cache sizes if memory usage is high
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage > this.config.thresholds.maxCacheMemory) {
      this.parseCache.resize(Math.floor(this.parseCache.max * 0.8));
      this.patternCache.resize(Math.floor(this.patternCache.max * 0.8));
      this.resultCache.resize(Math.floor(this.resultCache.max * 0.8));
      optimizations.push('cache-resized');
      freedMemory += memoryUsage * 0.2;
    }

    return { freedMemory, optimizations };
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      memoryUsage: {
        parsing: this.parseCache.size * 1024, // Estimate
        patterns: this.patternCache.size * 512, // Estimate
        results: this.resultCache.size * 256, // Estimate
        total: this.getMemoryUsage(),
      },
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
  }

  /**
   * Optimized detection based on level
   */
  private optimizedDetection(source: string, optimizations: string[]): TemplateLiteralMatch[] {
    const level = this.config.levels.detection;

    switch (level) {
      case 'fast':
        optimizations.push('fast-detection');
        return this.fastDetection(source);
      case 'balanced':
        optimizations.push('balanced-detection');
        return this.balancedDetection(source);
      case 'thorough':
        optimizations.push('thorough-detection');
        return this.thoroughDetection(source);
      default:
        return this.balancedDetection(source);
    }
  }

  /**
   * Fast detection using simple regex
   */
  private fastDetection(source: string): TemplateLiteralMatch[] {
    const templates: TemplateLiteralMatch[] = [];
    const regex = /`[^`]*`/g;
    let match;

    while ((match = regex.exec(source)) !== null) {
      templates.push({
        raw: match[0],
        content: match[0].slice(1, -1),
        start: match.index,
        end: match.index + match[0].length,
        location: { line: 1, column: 1, position: match.index },
        isTagged: false,
        staticParts: [match[0].slice(1, -1)],
        expressions: [],
        confidence: 0.8,
      });
    }

    return templates;
  }

  /**
   * Balanced detection with expression parsing
   */
  private balancedDetection(source: string): TemplateLiteralMatch[] {
    // Implementation would use the TemplateLiteralDetector
    // This is a simplified version
    return [];
  }

  /**
   * Thorough detection with full AST
   */
  private thoroughDetection(source: string): TemplateLiteralMatch[] {
    // Implementation would use the ASTTemplateParser
    // This is a simplified version
    return [];
  }

  /**
   * Optimized pattern extraction
   */
  private optimizedPatternExtraction(
    template: TemplateLiteralMatch,
    optimizations: string[]
  ): DynamicClassPattern | null {
    // Skip if no expressions
    if (template.expressions.length === 0) {
      optimizations.push('static-template-skipped');
      return null;
    }

    // Skip if too complex
    if (template.expressions.length > this.config.thresholds.maxPatternComplexity) {
      optimizations.push('complex-template-skipped');
      return null;
    }

    // Extract pattern
    return {
      id: this.generatePatternId(template),
      type: 'template-literal',
      source: template.raw,
      staticClasses: this.extractStaticClasses(template),
      expressions: template.expressions.map(expr => ({
        content: expr.content,
        type: 'variable' as const,
        dependencies: [],
      })),
      confidence: template.confidence,
      location: template.location,
    };
  }

  /**
   * Optimized class generation
   */
  private optimizedGeneration(
    pattern: DynamicClassPattern,
    context: Record<string, any>,
    optimizations: string[]
  ): string[] {
    const classes: string[] = [];

    // Add static classes
    classes.push(...pattern.staticClasses);

    // Process expressions based on optimization level
    const level = this.config.levels.processing;
    
    switch (level) {
      case 'basic':
        optimizations.push('basic-processing');
        break;
      case 'optimized':
        optimizations.push('optimized-processing');
        this.applyOptimizedProcessing(pattern, context, classes);
        break;
      case 'maximum':
        optimizations.push('maximum-processing');
        this.applyMaximumProcessing(pattern, context, classes);
        break;
    }

    return [...new Set(classes)]; // Deduplicate
  }

  /**
   * Apply optimized processing
   */
  private applyOptimizedProcessing(
    pattern: DynamicClassPattern,
    context: Record<string, any>,
    classes: string[]
  ): void {
    // Process expressions with memoization
    for (const expr of pattern.expressions) {
      const key = `${expr.content}:${JSON.stringify(context)}`;
      const cached = this.resultCache.get(key);
      
      if (cached) {
        classes.push(...cached);
      } else {
        const result = this.evaluateExpression(expr.content, context);
        if (result) {
          classes.push(result);
          this.resultCache.set(key, [result]);
        }
      }
    }
  }

  /**
   * Apply maximum processing
   */
  private applyMaximumProcessing(
    pattern: DynamicClassPattern,
    context: Record<string, any>,
    classes: string[]
  ): void {
    // Advanced optimization with dependency analysis
    this.applyOptimizedProcessing(pattern, context, classes);
    
    // Additional optimizations
    this.optimizeClassOrder(classes);
    this.mergeCompatibleClasses(classes);
  }

  /**
   * Check if pattern can be precompiled
   */
  private canPrecompile(pattern: DynamicClassPattern): boolean {
    return pattern.expressions.every(expr => 
      expr.type === 'variable' && 
      (!expr.dependencies || expr.dependencies.length === 0)
    );
  }

  /**
   * Create precompiled mapping
   */
  private createPrecompiledMapping(pattern: DynamicClassPattern): RuntimeClassMapping {
    return {
      pattern: pattern.source,
      staticClasses: pattern.staticClasses,
      resolver: undefined, // Precompiled, no resolver needed
      cacheKey: pattern.id,
    };
  }

  /**
   * Helper methods
   */
  private buildConfig(config: OptimizationConfig): Required<OptimizationConfig> {
    return {
      enableParsingCache: true,
      enablePatternCache: true,
      enableResultCache: true,
      cacheOptions: {
        parsing: { max: 1000, ttl: 1000 * 60 * 10 }, // 10 minutes
        patterns: { max: 500, ttl: 1000 * 60 * 30 }, // 30 minutes
        results: { max: 2000, ttl: 1000 * 60 * 5 }, // 5 minutes
      },
      thresholds: {
        maxParseTime: 100, // ms
        maxPatternComplexity: 10,
        maxCacheMemory: 50 * 1024 * 1024, // 50MB
      },
      levels: {
        detection: 'balanced',
        caching: 'standard',
        processing: 'optimized',
      },
      ...config,
      cacheOptions: { ...config.cacheOptions },
      thresholds: { ...config.thresholds },
      levels: { ...config.levels },
    };
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      parseTime: { min: Infinity, max: 0, avg: 0, total: 0 },
      cacheHits: { parsing: 0, patterns: 0, results: 0 },
      memoryUsage: { parsing: 0, patterns: 0, results: 0, total: 0 },
      processedItems: { templates: 0, patterns: 0, generations: 0 },
    };
  }

  private generateCacheKey(...parts: string[]): string {
    return parts.join(':');
  }

  private generatePatternId(template: TemplateLiteralMatch): string {
    return `pattern_${this.hash(template.raw)}`;
  }

  private extractStaticClasses(template: TemplateLiteralMatch): string[] {
    return template.staticParts
      .flatMap(part => part.split(/\s+/))
      .filter(cls => cls && /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(cls));
  }

  private evaluateExpression(expr: string, context: Record<string, any>): string | null {
    // Simplified evaluation
    if (context[expr]) {
      return String(context[expr]);
    }
    return null;
  }

  private optimizeClassOrder(classes: string[]): void {
    // Sort classes for better compression
    classes.sort();
  }

  private mergeCompatibleClasses(classes: string[]): void {
    // Placeholder for advanced class merging
  }

  private calculateParseTimeReduction(): number {
    return this.metrics.cacheHits.parsing > 0 ? 0.3 : 0;
  }

  private calculateCacheHitRate(): number {
    const total = this.metrics.cacheHits.parsing + 
                  this.metrics.cacheHits.patterns + 
                  this.metrics.cacheHits.results;
    const processed = this.metrics.processedItems.templates + 
                     this.metrics.processedItems.patterns + 
                     this.metrics.processedItems.generations;
    return processed > 0 ? total / processed : 0;
  }

  private calculateMemoryEfficiency(): number {
    const memoryUsage = this.getMemoryUsage();
    return memoryUsage < this.config.thresholds.maxCacheMemory * 0.8 ? 0.8 : 0.4;
  }

  private generateRecommendations(): OptimizationHint[] {
    const recommendations: OptimizationHint[] = [];

    // Cache hit rate recommendations
    const hitRate = this.calculateCacheHitRate();
    if (hitRate < 0.5) {
      recommendations.push({
        type: 'cache',
        target: 'cache-configuration',
        suggestion: 'Consider increasing cache TTL or size for better hit rates',
        impact: 'medium',
        complexity: 'simple',
      });
    }

    // Memory usage recommendations
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage > this.config.thresholds.maxCacheMemory * 0.9) {
      recommendations.push({
        type: 'cache',
        target: 'memory-usage',
        suggestion: 'Consider reducing cache sizes or implementing more aggressive purging',
        impact: 'high',
        complexity: 'moderate',
      });
    }

    return recommendations;
  }

  private getMemoryUsage(): number {
    return (this.parseCache.size + this.patternCache.size + this.resultCache.size) * 1024;
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}