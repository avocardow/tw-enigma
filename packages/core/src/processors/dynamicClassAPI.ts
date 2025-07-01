/**
 * Runtime API for Dynamic Class Generation
 * 
 * Provides a comprehensive runtime interface for dynamic class generation,
 * template processing, caching, and optimization strategies.
 */

import type { DynamicClassPattern, RuntimeClassMapping, OptimizationHint } from './types';
import type { ASTTemplateLiteral } from './astTemplateParser';

export interface RuntimeContext {
  /** Current component props or state */
  props?: Record<string, any>;
  /** Theme configuration */
  theme?: Record<string, any>;
  /** Breakpoint information */
  breakpoint?: string;
  /** User preferences */
  preferences?: Record<string, any>;
  /** Environment flags */
  env?: Record<string, any>;
  /** Custom context data */
  custom?: Record<string, any>;
}

export interface ClassGenerationOptions {
  /** Enable caching */
  cache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Enable development mode features */
  development?: boolean;
  /** Custom class processors */
  processors?: ClassProcessor[];
  /** Optimization level */
  optimization?: 'none' | 'basic' | 'aggressive';
  /** Custom separator for class concatenation */
  separator?: string;
}

export interface ClassProcessor {
  /** Processor name */
  name: string;
  /** Processing function */
  process: (classes: string[], context: RuntimeContext) => string[];
  /** Priority for execution order */
  priority?: number;
}

export interface GenerationResult {
  /** Generated class string */
  classes: string;
  /** Individual class array */
  classArray: string[];
  /** Cache hit status */
  cached: boolean;
  /** Generation time in ms */
  generationTime: number;
  /** Applied optimizations */
  optimizations: string[];
  /** Warnings or errors */
  warnings: string[];
}

export interface TemplateProcessor {
  /** Process template with context */
  process(template: string, context: RuntimeContext): string;
  /** Check if processor can handle template */
  canProcess(template: string): boolean;
  /** Priority for execution order */
  priority: number;
}

/**
 * Dynamic Class Generator API
 */
export class DynamicClassAPI {
  private cache = new Map<string, { result: GenerationResult; expiresAt: number }>();
  private patterns = new Map<string, DynamicClassPattern>();
  private mappings = new Map<string, RuntimeClassMapping>();
  private processors: ClassProcessor[] = [];
  private templateProcessors: TemplateProcessor[] = [];
  private options: Required<ClassGenerationOptions>;

  constructor(options: ClassGenerationOptions = {}) {
    this.options = {
      cache: true,
      cacheTTL: 300000, // 5 minutes
      development: false,
      processors: [],
      optimization: 'basic',
      separator: ' ',
      ...options,
    };

    this.setupDefaultProcessors();
  }

  /**
   * Register a dynamic pattern
   */
  registerPattern(pattern: DynamicClassPattern): void {
    this.patterns.set(pattern.id, pattern);
    
    // Clear related cache entries
    this.clearCacheForPattern(pattern.id);
  }

  /**
   * Register a runtime class mapping
   */
  registerMapping(mapping: RuntimeClassMapping): void {
    const key = this.generateMappingKey(mapping.pattern);
    this.mappings.set(key, mapping);
  }

  /**
   * Generate classes from template literal
   */
  async generateClasses(
    template: string,
    context: RuntimeContext = {},
    options: Partial<ClassGenerationOptions> = {}
  ): Promise<GenerationResult> {
    const startTime = performance.now();
    const mergedOptions = { ...this.options, ...options };
    const warnings: string[] = [];

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(template, context);
      
      // Check cache first
      if (mergedOptions.cache) {
        const cached = this.getCached(cacheKey);
        if (cached) {
          return {
            ...cached,
            cached: true,
            generationTime: performance.now() - startTime,
          };
        }
      }

      // Process template
      const processedTemplate = await this.processTemplate(template, context);
      
      // Extract static and dynamic parts
      const { staticClasses, dynamicParts } = this.parseTemplate(processedTemplate);
      
      // Resolve dynamic parts
      const resolvedClasses = await this.resolveDynamicParts(dynamicParts, context);
      
      // Combine all classes
      const allClasses = [...staticClasses, ...resolvedClasses];
      
      // Apply processors
      const processedClasses = await this.applyProcessors(allClasses, context, mergedOptions);
      
      // Apply optimizations
      const { optimizedClasses, optimizations } = this.applyOptimizations(
        processedClasses, 
        mergedOptions.optimization
      );
      
      // Generate final result
      const classArray = this.deduplicateClasses(optimizedClasses);
      const classes = classArray.join(mergedOptions.separator);
      
      const result: GenerationResult = {
        classes,
        classArray,
        cached: false,
        generationTime: performance.now() - startTime,
        optimizations,
        warnings,
      };

      // Cache result
      if (mergedOptions.cache) {
        this.setCached(cacheKey, result, mergedOptions.cacheTTL);
      }

      return result;
      
    } catch (error) {
      warnings.push(`Generation failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return fallback result
      return {
        classes: template,
        classArray: [template],
        cached: false,
        generationTime: performance.now() - startTime,
        optimizations: [],
        warnings,
      };
    }
  }

  /**
   * Generate classes from pattern
   */
  async generateFromPattern(
    patternId: string,
    context: RuntimeContext = {},
    options: Partial<ClassGenerationOptions> = {}
  ): Promise<GenerationResult> {
    const pattern = this.patterns.get(patternId);
    
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    // Reconstruct template from pattern
    const template = this.reconstructTemplate(pattern);
    
    return this.generateClasses(template, context, options);
  }

  /**
   * Add custom class processor
   */
  addProcessor(processor: ClassProcessor): void {
    this.processors.push(processor);
    this.processors.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Add template processor
   */
  addTemplateProcessor(processor: TemplateProcessor): void {
    this.templateProcessors.push(processor);
    this.templateProcessors.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    avgGenerationTime: number;
  } {
    let totalRequests = 0;
    let cacheHits = 0;
    let totalTime = 0;

    // Simple implementation - in production, you'd want more sophisticated metrics
    this.cache.forEach((entry) => {
      totalRequests++;
      totalTime += entry.result.generationTime;
      if (entry.result.cached) {
        cacheHits++;
      }
    });

    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? cacheHits / totalRequests : 0,
      avgGenerationTime: totalRequests > 0 ? totalTime / totalRequests : 0,
    };
  }

  /**
   * Analyze pattern and provide optimization hints
   */
  analyzePattern(pattern: DynamicClassPattern): OptimizationHint[] {
    const hints: OptimizationHint[] = [];

    // Check for precomputable expressions
    for (const expr of pattern.expressions) {
      if (expr.type === 'variable' && expr.dependencies && expr.dependencies.length === 0) {
        hints.push({
          type: 'precompute',
          target: expr.content,
          suggestion: 'This expression can be precomputed at build time',
          impact: 'medium',
          complexity: 'simple',
        });
      }
    }

    // Check for cacheable patterns
    if (pattern.expressions.every(expr => expr.dependencies && expr.dependencies.length <= 2)) {
      hints.push({
        type: 'cache',
        target: pattern.id,
        suggestion: 'This pattern has limited dependencies and should benefit from caching',
        impact: 'high',
        complexity: 'simple',
      });
    }

    // Check for inlinable static parts
    if (pattern.staticClasses.length > 3) {
      hints.push({
        type: 'inline',
        target: pattern.staticClasses.join(' '),
        suggestion: 'Static classes can be inlined for better performance',
        impact: 'low',
        complexity: 'simple',
      });
    }

    return hints;
  }

  /**
   * Process template with registered processors
   */
  private async processTemplate(template: string, context: RuntimeContext): Promise<string> {
    let processed = template;

    for (const processor of this.templateProcessors) {
      if (processor.canProcess(processed)) {
        processed = processor.process(processed, context);
      }
    }

    return processed;
  }

  /**
   * Parse template into static and dynamic parts
   */
  private parseTemplate(template: string): {
    staticClasses: string[];
    dynamicParts: Array<{ expression: string; type: string }>;
  } {
    const staticClasses: string[] = [];
    const dynamicParts: Array<{ expression: string; type: string }> = [];

    // Simple parsing - in production you'd use the AST parser
    const parts = template.split(/\$\{([^}]+)\}/);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      if (i % 2 === 0) {
        // Static part
        const classes = part.split(/\s+/).filter(Boolean);
        staticClasses.push(...classes);
      } else {
        // Dynamic part
        dynamicParts.push({
          expression: part,
          type: 'expression',
        });
      }
    }

    return { staticClasses, dynamicParts };
  }

  /**
   * Resolve dynamic parts with context
   */
  private async resolveDynamicParts(
    parts: Array<{ expression: string; type: string }>,
    context: RuntimeContext
  ): Promise<string[]> {
    const resolved: string[] = [];

    for (const part of parts) {
      try {
        const result = await this.evaluateExpression(part.expression, context);
        if (typeof result === 'string') {
          const classes = result.split(/\s+/).filter(Boolean);
          resolved.push(...classes);
        } else if (Array.isArray(result)) {
          resolved.push(...result.filter(Boolean));
        }
      } catch (error) {
        // Skip invalid expressions
        continue;
      }
    }

    return resolved;
  }

  /**
   * Evaluate expression safely
   */
  private async evaluateExpression(expression: string, context: RuntimeContext): Promise<any> {
    // Simple evaluation - in production you'd want a more sophisticated evaluator
    try {
      // Create safe evaluation context
      const safeContext = {
        props: context.props || {},
        theme: context.theme || {},
        breakpoint: context.breakpoint || 'default',
        preferences: context.preferences || {},
        env: context.env || {},
        custom: context.custom || {},
      };

      // Very basic evaluation - replace with proper expression evaluator
      if (expression.includes('props.')) {
        const prop = expression.replace('props.', '');
        return safeContext.props[prop];
      }
      
      if (expression.includes('theme.')) {
        const themeKey = expression.replace('theme.', '');
        return safeContext.theme[themeKey];
      }

      // For safety, return the expression as-is for now
      return expression;
      
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${expression}`);
    }
  }

  /**
   * Apply registered processors
   */
  private async applyProcessors(
    classes: string[],
    context: RuntimeContext,
    options: Required<ClassGenerationOptions>
  ): Promise<string[]> {
    let processed = [...classes];

    for (const processor of [...this.processors, ...options.processors]) {
      try {
        processed = processor.process(processed, context);
      } catch (error) {
        // Skip failed processors
        continue;
      }
    }

    return processed;
  }

  /**
   * Apply optimizations based on level
   */
  private applyOptimizations(
    classes: string[],
    level: 'none' | 'basic' | 'aggressive'
  ): { optimizedClasses: string[]; optimizations: string[] } {
    const optimizations: string[] = [];
    let optimized = [...classes];

    if (level === 'none') {
      return { optimizedClasses: optimized, optimizations };
    }

    // Basic optimizations
    if (level === 'basic' || level === 'aggressive') {
      // Remove empty classes
      const beforeLength = optimized.length;
      optimized = optimized.filter(cls => cls && cls.trim());
      if (optimized.length < beforeLength) {
        optimizations.push('removed-empty-classes');
      }

      // Sort for better gzipping
      optimized.sort();
      optimizations.push('sorted-classes');
    }

    // Aggressive optimizations
    if (level === 'aggressive') {
      // Remove duplicate utilities (simplified)
      const beforeLength = optimized.length;
      optimized = this.removeDuplicateUtilities(optimized);
      if (optimized.length < beforeLength) {
        optimizations.push('removed-duplicate-utilities');
      }
    }

    return { optimizedClasses: optimized, optimizations };
  }

  /**
   * Remove duplicate utility classes
   */
  private removeDuplicateUtilities(classes: string[]): string[] {
    const utilityMap = new Map<string, string>();
    
    for (const cls of classes) {
      // Simple utility detection - in production you'd want more sophisticated logic
      const match = cls.match(/^(\w+)-/);
      if (match) {
        const utility = match[1];
        utilityMap.set(utility, cls); // Keep the last occurrence
      } else {
        utilityMap.set(cls, cls);
      }
    }

    return Array.from(utilityMap.values());
  }

  /**
   * Deduplicate classes while preserving order
   */
  private deduplicateClasses(classes: string[]): string[] {
    return [...new Set(classes)];
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(template: string, context: RuntimeContext): string {
    const contextStr = JSON.stringify(context);
    return `${template}:${this.hash(contextStr)}`;
  }

  /**
   * Simple hash function
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get cached result
   */
  private getCached(key: string): GenerationResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }

  /**
   * Set cached result
   */
  private setCached(key: string, result: GenerationResult, ttl: number): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Clear cache for pattern
   */
  private clearCacheForPattern(patternId: string): void {
    for (const [key] of this.cache) {
      if (key.includes(patternId)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Generate mapping key
   */
  private generateMappingKey(pattern: string): string {
    return this.hash(pattern);
  }

  /**
   * Reconstruct template from pattern
   */
  private reconstructTemplate(pattern: DynamicClassPattern): string {
    let template = '';
    let exprIndex = 0;

    for (let i = 0; i < pattern.staticClasses.length; i++) {
      if (i > 0) template += ' ';
      template += pattern.staticClasses[i];
      
      if (exprIndex < pattern.expressions.length) {
        template += ` \${${pattern.expressions[exprIndex].content}}`;
        exprIndex++;
      }
    }

    return template;
  }

  /**
   * Setup default processors
   */
  private setupDefaultProcessors(): void {
    // Whitespace normalization processor
    this.addProcessor({
      name: 'normalize-whitespace',
      process: (classes) => classes.map(cls => cls.trim()).filter(Boolean),
      priority: 100,
    });

    // Development mode processor
    if (this.options.development) {
      this.addProcessor({
        name: 'development-logging',
        process: (classes, context) => {
          console.log('[TW-Enigma] Generated classes:', classes);
          return classes;
        },
        priority: -100,
      });
    }
  }
}