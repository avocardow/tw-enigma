/**
 * Configuration Validation System
 * Advanced validation logic with custom rules and comprehensive error reporting
 */

import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TWEnigmaConfig, TWEnigmaConfigSchema } from './configSchema';
import { Logger } from '../utils/logger';

export interface ValidationContext {
  /** Configuration being validated */
  config: TWEnigmaConfig;
  /** Root directory for path resolution */
  rootDir: string;
  /** Whether to perform deep validation (including file system checks) */
  deep?: boolean;
  /** Custom validation environment */
  environment?: 'development' | 'production' | 'test';
  /** Available framework information */
  frameworks?: string[];
}

export interface ValidationRule {
  /** Rule identifier */
  name: string;
  /** Rule description */
  description: string;
  /** Validation function */
  validate: (context: ValidationContext) => Promise<ValidationIssue[]>;
  /** Rule severity */
  severity: 'error' | 'warning' | 'info';
  /** Whether rule is enabled by default */
  enabled: boolean;
  /** Rule category */
  category: 'schema' | 'filesystem' | 'performance' | 'security' | 'compatibility';
}

export interface ValidationIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue message */
  message: string;
  /** Configuration path where issue occurred */
  path?: string;
  /** Issue code for programmatic handling */
  code: string;
  /** Rule that generated this issue */
  rule: string;
  /** Suggested fix */
  suggestion?: string;
  /** Additional context */
  details?: any;
}

export interface ValidationResult {
  /** Whether configuration is valid */
  valid: boolean;
  /** All validation issues */
  issues: ValidationIssue[];
  /** Issues grouped by severity */
  issuesBySeverity: {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    info: ValidationIssue[];
  };
  /** Validation statistics */
  stats: {
    rulesRun: number;
    rulesSkipped: number;
    validationTime: number;
  };
  /** Validation context used */
  context: ValidationContext;
}

export interface ConfigValidatorOptions {
  /** Custom validation rules */
  customRules?: ValidationRule[];
  /** Rules to disable */
  disabledRules?: string[];
  /** Whether to stop on first error */
  failFast?: boolean;
  /** Maximum number of issues to collect */
  maxIssues?: number;
  /** Default validation environment */
  environment?: 'development' | 'production' | 'test';
}

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public issues: ValidationIssue[],
    public validationResult: ValidationResult
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export class ConfigValidator {
  private logger: Logger;
  private options: Required<ConfigValidatorOptions>;
  private rules: Map<string, ValidationRule>;

  constructor(options: ConfigValidatorOptions = {}) {
    this.options = {
      customRules: [],
      disabledRules: [],
      failFast: false,
      maxIssues: 100,
      environment: 'development',
      ...options,
    };

    this.logger = new Logger({ component: 'ConfigValidator' });
    this.rules = new Map();
    this.initializeBuiltinRules();
    this.registerCustomRules();
  }

  /**
   * Validate configuration with comprehensive checking
   */
  async validate(
    config: TWEnigmaConfig,
    context: Partial<ValidationContext> = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const validationContext: ValidationContext = {
      config,
      rootDir: process.cwd(),
      deep: true,
      environment: this.options.environment,
      frameworks: [],
      ...context,
    };

    const issues: ValidationIssue[] = [];
    let rulesRun = 0;
    let rulesSkipped = 0;

    this.logger.debug('Starting configuration validation', {
      environment: validationContext.environment,
      deep: validationContext.deep,
      totalRules: this.rules.size,
    });

    // First, run basic schema validation
    try {
      TWEnigmaConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          issues.push({
            severity: 'error',
            message: `Schema validation failed: ${issue.message}`,
            path: issue.path.join('.'),
            code: 'SCHEMA_VALIDATION_FAILED',
            rule: 'schema',
            suggestion: `Check the value at ${issue.path.join('.')} and ensure it matches the expected type`,
            details: issue,
          });
        }
      }
    }

    // Run custom validation rules
    for (const [ruleName, rule] of this.rules) {
      if (this.options.disabledRules.includes(ruleName)) {
        rulesSkipped++;
        continue;
      }

      if (!rule.enabled) {
        rulesSkipped++;
        continue;
      }

      try {
        const ruleIssues = await rule.validate(validationContext);
        issues.push(...ruleIssues);
        rulesRun++;

        // Check limits
        if (this.options.failFast && ruleIssues.some(i => i.severity === 'error')) {
          this.logger.debug(`Stopping validation early due to error in rule: ${ruleName}`);
          break;
        }

        if (issues.length >= this.options.maxIssues) {
          this.logger.debug(`Stopping validation due to issue limit: ${this.options.maxIssues}`);
          break;
        }
      } catch (error) {
        this.logger.warn(`Validation rule failed: ${ruleName}`, { error });
        rulesSkipped++;
      }
    }

    // Group issues by severity
    const issuesBySeverity = {
      errors: issues.filter(i => i.severity === 'error'),
      warnings: issues.filter(i => i.severity === 'warning'),
      info: issues.filter(i => i.severity === 'info'),
    };

    const result: ValidationResult = {
      valid: issuesBySeverity.errors.length === 0,
      issues,
      issuesBySeverity,
      stats: {
        rulesRun,
        rulesSkipped,
        validationTime: Date.now() - startTime,
      },
      context: validationContext,
    };

    this.logger.info('Configuration validation completed', {
      valid: result.valid,
      errors: issuesBySeverity.errors.length,
      warnings: issuesBySeverity.warnings.length,
      info: issuesBySeverity.info.length,
      rulesRun,
      validationTime: result.stats.validationTime,
    });

    return result;
  }

  /**
   * Validate and throw on errors
   */
  async validateStrict(
    config: TWEnigmaConfig,
    context: Partial<ValidationContext> = {}
  ): Promise<ValidationResult> {
    const result = await this.validate(config, context);
    
    if (!result.valid) {
      const errorMessages = result.issuesBySeverity.errors.map(e => e.message);
      throw new ConfigValidationError(
        `Configuration validation failed with ${result.issuesBySeverity.errors.length} errors: ${errorMessages.join(', ')}`,
        result.issuesBySeverity.errors,
        result
      );
    }

    return result;
  }

  /**
   * Initialize built-in validation rules
   */
  private initializeBuiltinRules(): void {
    // File system validation rules
    this.addRule({
      name: 'validate-root-directory',
      description: 'Validate that root directory exists and is accessible',
      category: 'filesystem',
      severity: 'error',
      enabled: true,
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        
        try {
          const stats = await fs.stat(context.config.root);
          if (!stats.isDirectory()) {
            issues.push({
              severity: 'error',
              message: `Root path is not a directory: ${context.config.root}`,
              path: 'root',
              code: 'ROOT_NOT_DIRECTORY',
              rule: 'validate-root-directory',
              suggestion: 'Ensure the root path points to a valid directory',
            });
          }
        } catch (error) {
          issues.push({
            severity: 'error',
            message: `Root directory does not exist: ${context.config.root}`,
            path: 'root',
            code: 'ROOT_NOT_FOUND',
            rule: 'validate-root-directory',
            suggestion: 'Create the directory or update the path to an existing directory',
          });
        }

        return issues;
      },
    });

    this.addRule({
      name: 'validate-output-directory',
      description: 'Validate output directory settings',
      category: 'filesystem',
      severity: 'warning',
      enabled: true,
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const outDir = path.resolve(context.config.root, context.config.output.outDir);
        
        try {
          await fs.access(outDir);
        } catch (error) {
          // Directory doesn't exist - that's okay, we can create it
          issues.push({
            severity: 'info',
            message: `Output directory will be created: ${outDir}`,
            path: 'output.outDir',
            code: 'OUTPUT_DIR_WILL_CREATE',
            rule: 'validate-output-directory',
          });
        }

        return issues;
      },
    });

    // Performance validation rules
    this.addRule({
      name: 'validate-performance-settings',
      description: 'Validate performance configuration for potential issues',
      category: 'performance',
      severity: 'warning',
      enabled: true,
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const perf = context.config.performance;

        if (perf.workers > 16) {
          issues.push({
            severity: 'warning',
            message: `High worker count (${perf.workers}) may cause resource contention`,
            path: 'performance.workers',
            code: 'HIGH_WORKER_COUNT',
            rule: 'validate-performance-settings',
            suggestion: 'Consider reducing worker count or ensure adequate system resources',
          });
        }

        if (perf.batchSize > 1000) {
          issues.push({
            severity: 'warning',
            message: `Large batch size (${perf.batchSize}) may increase memory usage`,
            path: 'performance.batchSize',
            code: 'LARGE_BATCH_SIZE',
            rule: 'validate-performance-settings',
            suggestion: 'Consider reducing batch size for better memory efficiency',
          });
        }

        if (perf.thresholds.memoryUsage > 2000) {
          issues.push({
            severity: 'warning',
            message: `Very high memory threshold (${perf.thresholds.memoryUsage}MB) may cause system instability`,
            path: 'performance.thresholds.memoryUsage',
            code: 'HIGH_MEMORY_THRESHOLD',
            rule: 'validate-performance-settings',
            suggestion: 'Consider setting a lower memory threshold',
          });
        }

        return issues;
      },
    });

    // Optimization validation rules
    this.addRule({
      name: 'validate-optimization-settings',
      description: 'Validate optimization configuration for conflicts',
      category: 'compatibility',
      severity: 'warning',
      enabled: true,
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const opt = context.config.optimization;

        if (opt.level === 'none' && (opt.scrambleClassNames || opt.minifyCSS || opt.removeUnused)) {
          issues.push({
            severity: 'warning',
            message: 'Optimization level is "none" but individual optimizations are enabled',
            path: 'optimization',
            code: 'OPTIMIZATION_CONFLICT',
            rule: 'validate-optimization-settings',
            suggestion: 'Either set optimization level to "basic" or higher, or disable individual optimizations',
          });
        }

        if (context.environment === 'development' && opt.scrambleClassNames) {
          issues.push({
            severity: 'info',
            message: 'Class name scrambling enabled in development environment',
            path: 'optimization.scrambleClassNames',
            code: 'DEV_SCRAMBLING',
            rule: 'validate-optimization-settings',
            suggestion: 'Consider disabling scrambling in development for easier debugging',
          });
        }

        return issues;
      },
    });

    // File discovery validation rules
    this.addRule({
      name: 'validate-file-patterns',
      description: 'Validate file discovery patterns',
      category: 'compatibility',
      severity: 'warning',
      enabled: true,
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const files = context.config.files;

        if (files.include.length === 0) {
          issues.push({
            severity: 'warning',
            message: 'No file include patterns specified',
            path: 'files.include',
            code: 'NO_INCLUDE_PATTERNS',
            rule: 'validate-file-patterns',
            suggestion: 'Add file patterns to process, e.g., ["**/*.{html,js,jsx,ts,tsx}"]',
          });
        }

        // Check for overly broad patterns
        const broadPatterns = files.include.filter(pattern => 
          pattern === '**/*' || pattern === '*'
        );
        
        if (broadPatterns.length > 0) {
          issues.push({
            severity: 'warning',
            message: `Overly broad file patterns detected: ${broadPatterns.join(', ')}`,
            path: 'files.include',
            code: 'BROAD_FILE_PATTERNS',
            rule: 'validate-file-patterns',
            suggestion: 'Use more specific patterns to avoid processing unnecessary files',
          });
        }

        return issues;
      },
    });

    // Cache validation rules
    this.addRule({
      name: 'validate-cache-settings',
      description: 'Validate cache configuration',
      category: 'performance',
      severity: 'info',
      enabled: true,
      validate: async (context) => {
        const issues: ValidationIssue[] = [];
        const cache = context.config.cache;

        if (cache.maxSize > 1000) {
          issues.push({
            severity: 'info',
            message: `Large cache size configured: ${cache.maxSize}MB`,
            path: 'cache.maxSize',
            code: 'LARGE_CACHE_SIZE',
            rule: 'validate-cache-settings',
            suggestion: 'Monitor disk usage and clean cache periodically',
          });
        }

        const cacheDir = path.resolve(context.config.root, cache.directory);
        try {
          await fs.access(cacheDir);
        } catch (error) {
          issues.push({
            severity: 'info',
            message: `Cache directory will be created: ${cacheDir}`,
            path: 'cache.directory',
            code: 'CACHE_DIR_WILL_CREATE',
            rule: 'validate-cache-settings',
          });
        }

        return issues;
      },
    });

    // Security validation rules
    this.addRule({
      name: 'validate-security-settings',
      description: 'Check for potential security issues',
      category: 'security',
      severity: 'warning',
      enabled: true,
      validate: async (context) => {
        const issues: ValidationIssue[] = [];

        // Check if sensitive files might be included
        const sensitivePatterns = ['**/*.env*', '**/*.key', '**/*.pem', '**/secrets/**'];
        const includedSensitive = context.config.files.include.filter(pattern =>
          sensitivePatterns.some(sensitive => pattern.includes(sensitive.replace('**/', '')))
        );

        if (includedSensitive.length > 0) {
          issues.push({
            severity: 'warning',
            message: `File patterns may include sensitive files: ${includedSensitive.join(', ')}`,
            path: 'files.include',
            code: 'SENSITIVE_FILE_PATTERNS',
            rule: 'validate-security-settings',
            suggestion: 'Ensure sensitive files are excluded or verify they don\'t contain secrets',
          });
        }

        return issues;
      },
    });
  }

  /**
   * Register custom validation rules
   */
  private registerCustomRules(): void {
    for (const rule of this.options.customRules) {
      this.addRule(rule);
    }
  }

  /**
   * Add a validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.set(rule.name, rule);
    this.logger.debug(`Registered validation rule: ${rule.name}`);
  }

  /**
   * Remove a validation rule
   */
  removeRule(ruleName: string): boolean {
    return this.rules.delete(ruleName);
  }

  /**
   * Get all validation rules
   */
  getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: ValidationRule['category']): ValidationRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.category === category);
  }

  /**
   * Update validator options
   */
  updateOptions(options: Partial<ConfigValidatorOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (options.customRules) {
      this.registerCustomRules();
    }
  }

  /**
   * Format validation result for display
   */
  formatResult(result: ValidationResult): string {
    const lines: string[] = [];
    
    lines.push(`Configuration Validation Result: ${result.valid ? 'VALID' : 'INVALID'}`);
    lines.push(`Rules run: ${result.stats.rulesRun}, Skipped: ${result.stats.rulesSkipped}`);
    lines.push(`Validation time: ${result.stats.validationTime}ms`);
    lines.push('');

    if (result.issuesBySeverity.errors.length > 0) {
      lines.push('ERRORS:');
      for (const issue of result.issuesBySeverity.errors) {
        lines.push(`  [${issue.code}] ${issue.message}`);
        if (issue.path) lines.push(`    Path: ${issue.path}`);
        if (issue.suggestion) lines.push(`    Suggestion: ${issue.suggestion}`);
      }
      lines.push('');
    }

    if (result.issuesBySeverity.warnings.length > 0) {
      lines.push('WARNINGS:');
      for (const issue of result.issuesBySeverity.warnings) {
        lines.push(`  [${issue.code}] ${issue.message}`);
        if (issue.path) lines.push(`    Path: ${issue.path}`);
        if (issue.suggestion) lines.push(`    Suggestion: ${issue.suggestion}`);
      }
      lines.push('');
    }

    if (result.issuesBySeverity.info.length > 0) {
      lines.push('INFO:');
      for (const issue of result.issuesBySeverity.info) {
        lines.push(`  [${issue.code}] ${issue.message}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Create a configuration validator
 */
export function createConfigValidator(options?: ConfigValidatorOptions): ConfigValidator {
  return new ConfigValidator(options);
}

/**
 * Quick validation utility
 */
export async function validateTWEnigmaConfig(
  config: TWEnigmaConfig,
  context?: Partial<ValidationContext>,
  options?: ConfigValidatorOptions
): Promise<ValidationResult> {
  const validator = createConfigValidator(options);
  return validator.validate(config, context);
}

export default ConfigValidator;