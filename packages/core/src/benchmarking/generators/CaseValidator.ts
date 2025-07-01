import { createLogger } from '../../utils/logger';
import {
  BenchmarkCase,
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkMetrics,
} from '../types';
import { SyntheticCaseConfig, ValidationResult } from './SyntheticCaseGenerator';

const logger = createLogger('CaseValidator');

/**
 * Validation rule for benchmark cases
 */
export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (caseConfig: SyntheticCaseConfig, result?: BenchmarkResult) => Promise<boolean>;
  message: (caseConfig: SyntheticCaseConfig, result?: BenchmarkResult) => string;
}

/**
 * Validation context for rules
 */
export interface ValidationContext {
  environment: {
    platform: string;
    nodeVersion: string;
    cpuCores: number;
    totalMemory: number;
  };
  constraints: {
    maxDuration: number;
    maxMemory: number;
    maxFileSize: number;
    maxFileCount: number;
  };
  coverage: {
    requiredScenarios: string[];
    requiredEdgeCases: string[];
    minComplexity: number;
  };
}

/**
 * Validation report for a benchmark case
 */
export interface CaseValidationReport {
  caseId: string;
  caseName: string;
  valid: boolean;
  score: number; // 0-100, overall quality score
  
  results: {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    info: ValidationIssue[];
  };
  
  coverage: {
    scenarios: string[];
    edgeCases: string[];
    completeness: number;
    gaps: string[];
  };
  
  performance: {
    estimatedDuration: number;
    estimatedMemory: number;
    complexity: number;
    scalability: 'poor' | 'fair' | 'good' | 'excellent';
  };
  
  recommendations: string[];
  timestamp: Date;
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

/**
 * Default validation context
 */
const DEFAULT_VALIDATION_CONTEXT: ValidationContext = {
  environment: {
    platform: process.platform,
    nodeVersion: process.version,
    cpuCores: require('os').cpus().length,
    totalMemory: require('os').totalmem(),
  },
  constraints: {
    maxDuration: 300000, // 5 minutes
    maxMemory: 1024 * 1024 * 1024, // 1GB
    maxFileSize: 10 * 1024 * 1024, // 10MB per file
    maxFileCount: 10000,
  },
  coverage: {
    requiredScenarios: ['basic-optimization', 'cache-usage', 'error-handling'],
    requiredEdgeCases: ['empty-input', 'large-files', 'concurrent-access'],
    minComplexity: 0.3,
  },
};

/**
 * Built-in validation rules
 */
export const BUILT_IN_VALIDATION_RULES: ValidationRule[] = [
  // Basic configuration validation
  {
    name: 'valid-case-name',
    description: 'Case name must be valid and descriptive',
    severity: 'error',
    check: async (config) => {
      return config.name && config.name.trim().length >= 3;
    },
    message: (config) => `Case name "${config.name}" is too short or empty`,
  },

  {
    name: 'reasonable-file-count',
    description: 'File count should be within reasonable limits',
    severity: 'warning',
    check: async (config) => {
      return config.data.fileCount > 0 && config.data.fileCount <= 10000;
    },
    message: (config) => `File count ${config.data.fileCount} may be too high for reliable testing`,
  },

  {
    name: 'valid-file-size',
    description: 'Average file size should be realistic',
    severity: 'error',
    check: async (config) => {
      return config.data.avgFileSize > 0 && config.data.avgFileSize <= 10 * 1024 * 1024;
    },
    message: (config) => `Average file size ${config.data.avgFileSize} bytes is unrealistic`,
  },

  {
    name: 'valid-concurrency-config',
    description: 'Concurrency configuration should be valid',
    severity: 'error',
    check: async (config) => {
      if (!config.concurrency.enabled) return true;
      return config.concurrency.workers > 0 && config.concurrency.workers <= 32;
    },
    message: (config) => `Concurrency workers ${config.concurrency.workers} is outside valid range (1-32)`,
  },

  {
    name: 'reasonable-duration',
    description: 'Expected duration should be reasonable for testing',
    severity: 'warning',
    check: async (config) => {
      return config.performance.expectedDuration > 10 && config.performance.expectedDuration <= 300000;
    },
    message: (config) => `Expected duration ${config.performance.expectedDuration}ms may be too high for regular testing`,
  },

  // Performance validation
  {
    name: 'memory-requirements',
    description: 'Memory requirements should be reasonable',
    severity: 'warning',
    check: async (config) => {
      const estimatedMemory = config.data.fileCount * config.data.avgFileSize * 2; // Rough estimate
      return estimatedMemory <= 1024 * 1024 * 1024; // 1GB
    },
    message: (config) => `Estimated memory usage may exceed 1GB`,
  },

  {
    name: 'workload-consistency',
    description: 'Workload configuration should be internally consistent',
    severity: 'error',
    check: async (config) => {
      const { size, complexity, type } = config.workload;
      
      // Check if complexity matches workload size
      if (typeof size === 'string') {
        const sizeNumeric = { small: 100, medium: 500, large: 1000, xlarge: 5000 }[size] || 100;
        if (typeof complexity === 'string') {
          const complexityNumeric = { simple: 0.3, moderate: 0.6, complex: 0.9 }[complexity] || 0.5;
          return config.data.fileCount <= sizeNumeric * 2 && 
                 config.data.avgFileSize >= 512 * complexityNumeric;
        }
      }
      
      return true;
    },
    message: (config) => `Workload configuration is inconsistent between size, complexity, and data parameters`,
  },

  // Coverage validation
  {
    name: 'scenario-coverage',
    description: 'Case should cover essential scenarios',
    severity: 'info',
    check: async (config) => {
      const scenarios = [
        config.workload.type,
        config.concurrency.enabled ? 'concurrent' : 'sequential',
        config.performance.memoryProfile,
        config.performance.ioIntensity,
      ];
      
      return scenarios.length >= 3; // Arbitrary coverage threshold
    },
    message: (config) => `Case covers basic scenarios but could include more edge cases`,
  },

  {
    name: 'edge-case-coverage',
    description: 'Case should include edge case scenarios',
    severity: 'info',
    check: async (config) => {
      const hasEdgeCases = 
        config.data.duplicateRatio > 0.1 || // Has duplicates
        config.data.sizeVariation > 0.3 || // High size variation
        config.data.fileCount > 1000 || // Large file count
        config.concurrency.workers > 4; // High concurrency
      
      return hasEdgeCases;
    },
    message: (config) => `Case could benefit from including more edge case scenarios`,
  },

  // Result validation (applied after execution)
  {
    name: 'result-consistency',
    description: 'Benchmark results should be consistent with expectations',
    severity: 'error',
    check: async (config, result) => {
      if (!result) return true;
      
      const expectedFiles = config.data.fileCount;
      const actualFiles = result.metrics.filesProcessed;
      
      return Math.abs(expectedFiles - actualFiles) <= expectedFiles * 0.1; // 10% tolerance
    },
    message: (config, result) => 
      `Files processed (${result?.metrics.filesProcessed}) differs significantly from expected (${config.data.fileCount})`,
  },

  {
    name: 'performance-expectations',
    description: 'Performance should be within expected ranges',
    severity: 'warning',
    check: async (config, result) => {
      if (!result) return true;
      
      const expectedDuration = config.performance.expectedDuration;
      const actualDuration = result.duration;
      
      return actualDuration <= expectedDuration * 2; // Allow 2x variance
    },
    message: (config, result) => 
      `Execution time (${result?.duration}ms) significantly exceeds expected (${config.performance.expectedDuration}ms)`,
  },
];

/**
 * Validates synthetic benchmark cases for correctness and coverage
 */
export class CaseValidator {
  private rules: ValidationRule[] = [];
  private context: ValidationContext;

  constructor(
    context: Partial<ValidationContext> = {},
    customRules: ValidationRule[] = []
  ) {
    this.context = { ...DEFAULT_VALIDATION_CONTEXT, ...context };
    this.rules = [...BUILT_IN_VALIDATION_RULES, ...customRules];

    logger.debug('CaseValidator initialized', {
      rulesCount: this.rules.length,
      customRulesCount: customRules.length,
    });
  }

  /**
   * Validate a synthetic case configuration
   */
  async validateCase(
    caseConfig: SyntheticCaseConfig,
    result?: BenchmarkResult
  ): Promise<CaseValidationReport> {
    logger.info('Validating benchmark case', { 
      name: caseConfig.name,
      hasResult: !!result,
    });

    const report: CaseValidationReport = {
      caseId: this.generateCaseId(caseConfig),
      caseName: caseConfig.name,
      valid: true,
      score: 0,
      results: {
        errors: [],
        warnings: [],
        info: [],
      },
      coverage: {
        scenarios: [],
        edgeCases: [],
        completeness: 0,
        gaps: [],
      },
      performance: {
        estimatedDuration: caseConfig.performance.expectedDuration,
        estimatedMemory: this.estimateMemoryUsage(caseConfig),
        complexity: this.calculateComplexity(caseConfig),
        scalability: 'fair',
      },
      recommendations: [],
      timestamp: new Date(),
    };

    // Run validation rules
    for (const rule of this.rules) {
      try {
        const passed = await rule.check(caseConfig, result);
        
        if (!passed) {
          const issue: ValidationIssue = {
            rule: rule.name,
            severity: rule.severity,
            message: rule.message(caseConfig, result),
          };

          report.results[rule.severity].push(issue);
          
          if (rule.severity === 'error') {
            report.valid = false;
          }
        }
      } catch (error) {
        logger.warn('Validation rule failed', { rule: rule.name, error });
        
        report.results.warnings.push({
          rule: rule.name,
          severity: 'warning',
          message: `Validation rule "${rule.name}" failed to execute: ${error.message}`,
        });
      }
    }

    // Analyze coverage
    this.analyzeCoverage(caseConfig, report);

    // Calculate quality score
    report.score = this.calculateQualityScore(report);

    // Assess scalability
    report.performance.scalability = this.assessScalability(caseConfig);

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report, caseConfig);

    logger.info('Case validation completed', {
      name: caseConfig.name,
      valid: report.valid,
      score: report.score,
      errorsCount: report.results.errors.length,
      warningsCount: report.results.warnings.length,
    });

    return report;
  }

  /**
   * Validate multiple cases
   */
  async validateCases(
    cases: Array<{ config: SyntheticCaseConfig; result?: BenchmarkResult }>
  ): Promise<CaseValidationReport[]> {
    const reports: CaseValidationReport[] = [];

    for (const { config, result } of cases) {
      const report = await this.validateCase(config, result);
      reports.push(report);
    }

    logger.info('Batch validation completed', {
      casesCount: cases.length,
      validCases: reports.filter(r => r.valid).length,
      avgScore: reports.reduce((sum, r) => sum + r.score, 0) / reports.length,
    });

    return reports;
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
    logger.debug('Added custom validation rule', { name: rule.name });
  }

  /**
   * Remove validation rule
   */
  removeRule(ruleName: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
    const removed = this.rules.length < initialLength;
    
    if (removed) {
      logger.debug('Removed validation rule', { name: ruleName });
    }
    
    return removed;
  }

  /**
   * Update validation context
   */
  updateContext(context: Partial<ValidationContext>): void {
    this.context = { ...this.context, ...context };
    logger.debug('Updated validation context', { context });
  }

  /**
   * Get validation statistics
   */
  getValidationStats(reports: CaseValidationReport[]): {
    totalCases: number;
    validCases: number;
    avgScore: number;
    commonIssues: Record<string, number>;
    coverageGaps: Record<string, number>;
  } {
    const commonIssues: Record<string, number> = {};
    const coverageGaps: Record<string, number> = {};

    for (const report of reports) {
      // Count common issues
      for (const issue of [...report.results.errors, ...report.results.warnings]) {
        commonIssues[issue.rule] = (commonIssues[issue.rule] || 0) + 1;
      }

      // Count coverage gaps
      for (const gap of report.coverage.gaps) {
        coverageGaps[gap] = (coverageGaps[gap] || 0) + 1;
      }
    }

    return {
      totalCases: reports.length,
      validCases: reports.filter(r => r.valid).length,
      avgScore: reports.reduce((sum, r) => sum + r.score, 0) / reports.length,
      commonIssues,
      coverageGaps,
    };
  }

  /**
   * Generate case ID from configuration
   */
  private generateCaseId(config: SyntheticCaseConfig): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(config))
      .digest('hex')
      .substring(0, 8);
    
    return `${config.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${hash}`;
  }

  /**
   * Estimate memory usage for a case
   */
  private estimateMemoryUsage(config: SyntheticCaseConfig): number {
    const baseMemory = config.data.fileCount * config.data.avgFileSize;
    const concurrencyMultiplier = config.concurrency.enabled ? config.concurrency.workers : 1;
    const complexityMultiplier = typeof config.workload.complexity === 'string' 
      ? { simple: 1.2, moderate: 1.5, complex: 2.0 }[config.workload.complexity] || 1.5
      : 1 + config.workload.complexity;
    
    return Math.floor(baseMemory * concurrencyMultiplier * complexityMultiplier);
  }

  /**
   * Calculate complexity score for a case
   */
  private calculateComplexity(config: SyntheticCaseConfig): number {
    let complexity = 0;

    // Base complexity from workload
    if (typeof config.workload.complexity === 'string') {
      complexity += { simple: 0.3, moderate: 0.6, complex: 0.9 }[config.workload.complexity] || 0.5;
    } else {
      complexity += config.workload.complexity;
    }

    // Add complexity factors
    if (config.concurrency.enabled) {
      complexity += Math.min(0.3, config.concurrency.workers / 20);
    }

    if (config.data.duplicateRatio > 0.2) {
      complexity += 0.1;
    }

    if (config.data.sizeVariation > 0.3) {
      complexity += 0.1;
    }

    if (config.data.fileCount > 1000) {
      complexity += 0.2;
    }

    return Math.min(1.0, complexity);
  }

  /**
   * Analyze coverage for a case
   */
  private analyzeCoverage(config: SyntheticCaseConfig, report: CaseValidationReport): void {
    // Identify covered scenarios
    const scenarios = [
      `${config.workload.type}-processing`,
      `${config.workload.size}-scale`,
      `${config.performance.memoryProfile}-memory`,
      `${config.performance.ioIntensity}-io`,
      `${config.performance.cpuIntensity}-cpu`,
    ];

    if (config.concurrency.enabled) {
      scenarios.push('concurrent-processing');
    }

    if (config.data.duplicateRatio > 0.1) {
      scenarios.push('duplicate-handling');
    }

    report.coverage.scenarios = scenarios;

    // Identify edge cases
    const edgeCases = [];
    
    if (config.data.fileCount > 1000) {
      edgeCases.push('large-file-count');
    }
    
    if (config.data.avgFileSize > 1024 * 1024) {
      edgeCases.push('large-files');
    }
    
    if (config.concurrency.workers > 4) {
      edgeCases.push('high-concurrency');
    }
    
    if (config.data.sizeVariation > 0.4) {
      edgeCases.push('variable-file-sizes');
    }

    report.coverage.edgeCases = edgeCases;

    // Calculate completeness
    const requiredScenarios = this.context.coverage.requiredScenarios;
    const coveredRequired = requiredScenarios.filter(scenario => 
      scenarios.some(s => s.includes(scenario))
    );
    
    report.coverage.completeness = coveredRequired.length / requiredScenarios.length;

    // Identify gaps
    report.coverage.gaps = requiredScenarios.filter(scenario =>
      !scenarios.some(s => s.includes(scenario))
    );
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(report: CaseValidationReport): number {
    let score = 100;

    // Deduct for errors and warnings
    score -= report.results.errors.length * 20;
    score -= report.results.warnings.length * 5;

    // Bonus for coverage
    score += report.coverage.completeness * 20;
    score += report.coverage.edgeCases.length * 5;

    // Bonus for reasonable complexity
    const complexity = report.performance.complexity;
    if (complexity >= 0.3 && complexity <= 0.8) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess scalability
   */
  private assessScalability(config: SyntheticCaseConfig): 'poor' | 'fair' | 'good' | 'excellent' {
    const fileCount = config.data.fileCount;
    const concurrency = config.concurrency.enabled ? config.concurrency.workers : 1;
    const duration = config.performance.expectedDuration;

    // Simple heuristic for scalability assessment
    const scalabilityScore = 
      (fileCount > 100 ? 1 : 0) +
      (concurrency > 1 ? 1 : 0) +
      (duration < 30000 ? 1 : 0) +
      (config.data.avgFileSize < 100000 ? 1 : 0);

    switch (scalabilityScore) {
      case 4: return 'excellent';
      case 3: return 'good';
      case 2: return 'fair';
      default: return 'poor';
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    report: CaseValidationReport,
    config: SyntheticCaseConfig
  ): string[] {
    const recommendations: string[] = [];

    // Based on errors
    if (report.results.errors.length > 0) {
      recommendations.push('Fix configuration errors before using this case in production');
    }

    // Based on coverage gaps
    if (report.coverage.completeness < 0.7) {
      recommendations.push('Consider adding more scenarios to improve coverage');
    }

    if (report.coverage.edgeCases.length === 0) {
      recommendations.push('Add edge case scenarios to improve test robustness');
    }

    // Based on performance
    if (report.performance.estimatedDuration > 60000) {
      recommendations.push('Consider reducing workload size for faster feedback');
    }

    if (report.performance.scalability === 'poor') {
      recommendations.push('Improve scalability by enabling concurrency or optimizing parameters');
    }

    // Based on score
    if (report.score < 60) {
      recommendations.push('Case quality is below recommended threshold - consider redesigning');
    }

    return recommendations;
  }
}