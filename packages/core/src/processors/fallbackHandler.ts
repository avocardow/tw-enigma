/**
 * Fallback Handler for Dynamic Class Generation
 * Provides robust fallback mechanisms when primary processing fails
 */

import { MetricsCollector } from '../metrics/collector';
import { PerformanceMonitor } from '../metrics/performanceMonitor';
import { ErrorContext, Logger } from '../utils/logger';
import { FallbackConfig, FallbackResult, FallbackStrategy, ProcessingContext } from './types';

export interface FallbackMetrics {
  strategy: string;
  executionTime: number;
  success: boolean;
  confidence: number;
  errorType?: string;
  template: string;
  timestamp: number;
}

export interface FallbackHandlerConfig extends FallbackConfig {
  enableMetrics: boolean;
  enableDetailedLogging: boolean;
  maxFallbackAttempts: number;
  fallbackTimeout: number;
  preserveOriginalClasses: boolean;
  emergencyFallbackEnabled: boolean;
}

export class FallbackHandler {
  private strategies: Map<string, FallbackStrategy> = new Map();
  private metrics: FallbackMetrics[] = [];
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private retryConfig = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 2000,
    backoffFactor: 2,
  };

  constructor(logger?: Logger, performanceMonitor?: PerformanceMonitor) {
    this.logger = logger || new Logger({ component: 'FallbackHandler' });
    const metricsCollector = new MetricsCollector();
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor(metricsCollector);
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default fallback strategies
   */
  private initializeDefaultStrategies(): void {
    // Strategy 1: Preserve Original (Highest Priority)
    this.registerStrategy({
      name: 'preserve',
      priority: 1,
      canHandle: () => true,
      process: async (template: string, _context: ProcessingContext) => {
        return {
          success: true,
          classes: [template],
          strategy: 'preserve',
          confidence: 0.3,
          warnings: ['Template preserved as-is due to processing failure'],
        };
      },
    });

    // Strategy 2: Static Extraction
    this.registerStrategy({
      name: 'static-extraction',
      priority: 2,
      canHandle: (template: string) => /\b[a-z-]+:\w+/.test(template),
      process: async (template: string, _context: ProcessingContext) => {
        const staticClasses = this.extractStaticClasses(template);
        return {
          success: staticClasses.length > 0,
          classes: staticClasses,
          strategy: 'static-extraction',
          confidence: 0.7,
          warnings: staticClasses.length === 0 ? ['No static classes found'] : [],
        };
      },
    });

    // Strategy 3: Pattern Matching
    this.registerStrategy({
      name: 'pattern-matching',
      priority: 3,
      canHandle: (template: string) => /\$\{[^}]+\}/.test(template),
      process: async (template: string, context: ProcessingContext) => {
        const result = this.processWithPatternMatching(template, context);
        return {
          success: result.classes.length > 0,
          classes: result.classes,
          strategy: 'pattern-matching',
          confidence: result.confidence,
          warnings: result.warnings,
        };
      },
    });

    // Strategy 4: Simplified Processing
    this.registerStrategy({
      name: 'simplified-processing',
      priority: 4,
      canHandle: () => true,
      process: async (template: string, context: ProcessingContext) => {
        const result = this.simplifiedProcess(template, context);
        return {
          success: result.classes.length > 0,
          classes: result.classes,
          strategy: 'simplified-processing',
          confidence: 0.5,
          warnings: ['Using simplified processing with reduced functionality'],
        };
      },
    });

    // Strategy 5: Conditional Flattening
    this.registerStrategy({
      name: 'conditional-flattening',
      priority: 5,
      canHandle: (template: string) => /\?|:/.test(template),
      process: async (template: string, context: ProcessingContext) => {
        const result = this.flattenConditionals(template, context);
        return {
          success: result.classes.length > 0,
          classes: result.classes,
          strategy: 'conditional-flattening',
          confidence: 0.6,
          warnings: ['Conditional expressions flattened to all possible values'],
        };
      },
    });
  }

  /**
   * Register a custom fallback strategy
   */
  registerStrategy(strategy: FallbackStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.debug(`Registered fallback strategy: ${strategy.name}`);
  }

  /**
   * Process template with fallback strategies
   */
  async processWithFallback(
    template: string,
    context: ProcessingContext,
    primaryError: Error
  ): Promise<FallbackResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Processing fallback for template: ${template.substring(0, 50)}...`);

      // Analyze template complexity
      const complexity = this.analyzeTemplateComplexity(template);
      this.logger.debug(`Template complexity: ${complexity.score}`);

      // Get applicable strategies
      const applicableStrategies = this.getApplicableStrategies(template, primaryError);

      if (applicableStrategies.length === 0) {
        return this.emergencyFallback(template, context, primaryError);
      }

      // Try strategies in priority order with retry logic
      for (const strategy of applicableStrategies) {
        const result = await this.executeStrategyWithRetry(strategy, template, context);

        if (result.success) {
          this.recordMetrics({
            strategy: result.strategy,
            executionTime: Date.now() - startTime,
            success: true,
            confidence: result.confidence,
            template,
            timestamp: Date.now(),
          });

          this.logger.info(`Fallback successful with strategy: ${result.strategy}`);
          return result;
        }

        this.logger.warn(`Strategy ${strategy.name} failed for template`);
      }

      // All strategies failed, use emergency fallback
      const emergencyResult = this.emergencyFallback(template, context, primaryError);

      this.recordMetrics({
        strategy: 'emergency',
        executionTime: Date.now() - startTime,
        success: emergencyResult.success,
        confidence: emergencyResult.confidence,
        errorType: primaryError.name,
        template,
        timestamp: Date.now(),
      });

      return emergencyResult;
    } catch (error) {
      const errorContext: ErrorContext = {
        component: 'FallbackHandler',
        operation: 'processWithFallback',
        processingTime: Date.now() - startTime,
      };
      this.logger.error('Fallback processing failed completely', errorContext);

      this.recordMetrics({
        strategy: 'failed',
        executionTime: Date.now() - startTime,
        success: false,
        confidence: 0,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        template,
        timestamp: Date.now(),
      });

      return this.emergencyFallback(
        template,
        context,
        error instanceof Error ? error : primaryError
      );
    }
  }

  /**
   * Get applicable strategies for template and error
   */
  private getApplicableStrategies(template: string, error: Error): FallbackStrategy[] {
    const strategies = Array.from(this.strategies.values())
      .filter((strategy) => strategy.canHandle(template, error))
      .sort((a, b) => a.priority - b.priority);

    this.logger.debug(`Found ${strategies.length} applicable strategies`);
    return strategies;
  }

  /**
   * Execute strategy with retry logic
   */
  private async executeStrategyWithRetry(
    strategy: FallbackStrategy,
    template: string,
    context: ProcessingContext
  ): Promise<FallbackResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        this.logger.debug(`Executing strategy ${strategy.name}, attempt ${attempt + 1}`);
        return await strategy.process(template, context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt),
            this.retryConfig.maxDelay
          );

          const errorContext: ErrorContext = {
            component: 'FallbackHandler',
            operation: 'executeStrategyWithRetry',
          };
          this.logger.warn(
            `Strategy ${strategy.name} failed, retrying in ${delay}ms`,
            errorContext
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Strategy ${strategy.name} failed after all retries`);
  }

  /**
   * Extract static classes from template
   */
  private extractStaticClasses(template: string): string[] {
    const staticClassRegex = /\b([a-z-]+:[a-z0-9-]+|\b[a-z][a-z0-9-]*)\b/g;
    const matches = template.match(staticClassRegex) || [];
    return [...new Set(matches)].filter((cls) => cls.length > 1);
  }

  /**
   * Process template with pattern matching
   */
  private processWithPatternMatching(
    template: string,
    context: ProcessingContext
  ): {
    classes: string[];
    confidence: number;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const classes: string[] = [];

    try {
      // Extract variable expressions
      const expressions = template.match(/\$\{([^}]+)\}/g) || [];
      let processedTemplate = template;

      for (const expr of expressions) {
        const varName = expr.slice(2, -1).trim();

        if (context.variables && varName in context.variables) {
          const value = context.variables[varName];
          processedTemplate = processedTemplate.replace(expr, String(value));
        } else {
          warnings.push(`Variable ${varName} not found in context`);
          processedTemplate = processedTemplate.replace(expr, '');
        }
      }

      const extractedClasses = this.extractStaticClasses(processedTemplate);
      classes.push(...extractedClasses);

      return {
        classes,
        confidence: warnings.length === 0 ? 0.8 : 0.5,
        warnings,
      };
    } catch (error) {
      warnings.push(
        `Pattern matching failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return { classes, confidence: 0.2, warnings };
    }
  }

  /**
   * Simplified processing fallback
   */
  private simplifiedProcess(
    template: string,
    _context: ProcessingContext
  ): {
    classes: string[];
    confidence: number;
    warnings: string[];
  } {
    const warnings: string[] = ['Using simplified processing'];

    // Remove all dynamic parts and extract what we can
    const simplified = template
      .replace(/\$\{[^}]+\}/g, '') // Remove template literals
      .replace(/\?[^:]*:[^}]*/g, '') // Remove ternary operators
      .replace(/['"]/g, '') // Remove quotes
      .trim();

    const classes = simplified.split(/\s+/).filter((cls) => cls.length > 0 && /^[a-z]/.test(cls));

    return {
      classes,
      confidence: 0.4,
      warnings,
    };
  }

  /**
   * Flatten conditional expressions
   */
  private flattenConditionals(
    template: string,
    _context: ProcessingContext
  ): {
    classes: string[];
    confidence: number;
    warnings: string[];
  } {
    const warnings: string[] = ['Conditional expressions flattened'];
    const classes: string[] = [];

    try {
      // Extract all possible values from ternary operators
      const ternaryRegex = /([^?]+)\?([^:]+):([^}]+)/g;
      let match;

      while ((match = ternaryRegex.exec(template)) !== null) {
        const [, , trueBranch, falseBranch] = match;

        const trueClasses = this.extractStaticClasses(trueBranch.trim());
        const falseClasses = this.extractStaticClasses(falseBranch.trim());

        classes.push(...trueClasses, ...falseClasses);
      }

      // Also extract any other static classes
      const otherClasses = this.extractStaticClasses(template);
      classes.push(...otherClasses);

      return {
        classes: [...new Set(classes)],
        confidence: 0.6,
        warnings,
      };
    } catch (error) {
      warnings.push(
        `Conditional flattening failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return { classes, confidence: 0.3, warnings };
    }
  }

  /**
   * Emergency fallback when all strategies fail
   */
  private emergencyFallback(
    template: string,
    context: ProcessingContext,
    error: Error
  ): FallbackResult {
    const errorContext: ErrorContext = {
      component: 'FallbackHandler',
      operation: 'emergencyFallback',
    };
    this.logger.error('Using emergency fallback', errorContext);

    return {
      success: true,
      classes: ['tw-enigma-fallback'],
      strategy: 'emergency',
      confidence: 0.1,
      warnings: [
        'Emergency fallback activated',
        'Original template could not be processed',
        'Generic fallback class applied',
      ],
      metadata: {
        originalTemplate: template,
        error: error.message,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Analyze template complexity
   */
  private analyzeTemplateComplexity(template: string): { score: number; factors: string[] } {
    const factors: string[] = [];
    let score = 0;

    // Template literal expressions
    const templateLiterals = (template.match(/\$\{[^}]+\}/g) || []).length;
    if (templateLiterals > 0) {
      score += templateLiterals * 2;
      factors.push(`${templateLiterals} template literals`);
    }

    // Conditional expressions
    const conditionals = (template.match(/\?[^:]*:/g) || []).length;
    if (conditionals > 0) {
      score += conditionals * 3;
      factors.push(`${conditionals} conditional expressions`);
    }

    // Nested expressions
    const nested = (template.match(/\$\{[^}]*\$\{[^}]*\}[^}]*\}/g) || []).length;
    if (nested > 0) {
      score += nested * 5;
      factors.push(`${nested} nested expressions`);
    }

    // Function calls
    const functions = (template.match(/\w+\([^)]*\)/g) || []).length;
    if (functions > 0) {
      score += functions * 4;
      factors.push(`${functions} function calls`);
    }

    return { score, factors };
  }

  /**
   * Record metrics for analysis
   */
  private recordMetrics(metrics: FallbackMetrics): void {
    this.metrics.push(metrics);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    this.performanceMonitor.recordCustomMetric('fallback_execution', metrics.executionTime, 'ms');
    this.performanceMonitor.recordCustomMetric('fallback_confidence', metrics.confidence, 'score');
  }

  /**
   * Get fallback metrics for analysis
   */
  getMetrics(): {
    total: number;
    successRate: number;
    averageConfidence: number;
    averageExecutionTime: number;
    strategyCounts: Record<string, number>;
  } {
    const total = this.metrics.length;
    const successful = this.metrics.filter((m) => m.success).length;
    const totalConfidence = this.metrics.reduce((sum, m) => sum + m.confidence, 0);
    const totalTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0);

    const strategyCounts: Record<string, number> = {};
    this.metrics.forEach((m) => {
      strategyCounts[m.strategy] = (strategyCounts[m.strategy] || 0) + 1;
    });

    return {
      total,
      successRate: total > 0 ? successful / total : 0,
      averageConfidence: total > 0 ? totalConfidence / total : 0,
      averageExecutionTime: total > 0 ? totalTime / total : 0,
      strategyCounts,
    };
  }

  /**
   * Clear metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get current configuration
   */
  getConfiguration(): {
    strategies: string[];
    retryConfig: typeof this.retryConfig;
    metricsCount: number;
  } {
    return {
      strategies: Array.from(this.strategies.keys()),
      retryConfig: { ...this.retryConfig },
      metricsCount: this.metrics.length,
    };
  }
}

export default FallbackHandler;
