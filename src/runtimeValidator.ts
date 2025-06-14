/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "events";
import { logger } from "./logger.ts";
import { ValidationError } from "./errors.ts";
import type { EnigmaConfig } from "./config.ts";
import type { ValidationResult } from "./configValidator.ts";

/**
 * Runtime validation events
 */
export interface RuntimeValidationEvents {
  "validation-warning": (warning: RuntimeValidationWarning) => void;
  "validation-error": (error: RuntimeValidationError) => void;
  "resource-threshold": (alert: ResourceAlert) => void;
  "performance-degradation": (alert: PerformanceAlert) => void;
  "security-violation": (alert: SecurityAlert) => void;
}

/**
 * Runtime validation warning
 */
export interface RuntimeValidationWarning {
  timestamp: Date;
  type: "resource" | "performance" | "security" | "configuration";
  message: string;
  field?: string;
  currentValue?: unknown;
  recommendedValue?: unknown;
  suggestions: string[];
  severity: "low" | "medium" | "high";
}

/**
 * Runtime validation error
 */
export interface RuntimeValidationError {
  timestamp: Date;
  type: "constraint" | "security" | "resource" | "configuration";
  message: string;
  field?: string;
  currentValue?: unknown;
  expectedValue?: unknown;
  action: "block" | "fallback" | "warn";
  fallbackValue?: unknown;
}

/**
 * Resource usage alert
 */
export interface ResourceAlert {
  timestamp: Date;
  resource: "memory" | "cpu" | "disk" | "network" | "handles";
  currentUsage: number;
  threshold: number;
  unit: string;
  trend: "increasing" | "decreasing" | "stable";
  suggestions: string[];
}

/**
 * Performance degradation alert
 */
export interface PerformanceAlert {
  timestamp: Date;
  metric: "processing-time" | "memory-usage" | "file-operations" | "concurrency";
  baseline: number;
  current: number;
  degradation: number; // percentage
  impact: "low" | "medium" | "high";
  suggestions: string[];
}

/**
 * Security violation alert
 */
export interface SecurityAlert {
  timestamp: Date;
  violation: "path-traversal" | "permission-escalation" | "unsafe-operation" | "resource-exhaustion";
  message: string;
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
  blocked: boolean;
}

/**
 * Runtime validation configuration
 */
export interface RuntimeValidatorConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  resourceThresholds: {
    memory: number; // bytes
    cpu: number; // percentage
    fileHandles: number;
    diskSpace: number; // bytes
  };
  performanceBaselines: {
    processingTime: number; // milliseconds
    memoryUsage: number; // bytes
    fileOperations: number; // operations per second
  };
  securityChecks: {
    pathTraversal: boolean;
    filePermissions: boolean;
    resourceLimits: boolean;
  };
  autoCorrection: {
    enabled: boolean;
    maxAttempts: number;
    fallbackToDefaults: boolean;
  };
}

/**
 * Runtime configuration validator
 */
export class RuntimeValidator extends EventEmitter {
  private config: EnigmaConfig;
  private validatorConfig: RuntimeValidatorConfig;
  private isRunning: boolean = false;
  private checkInterval?: NodeJS.Timeout;
  private resourceBaselines: Map<string, number> = new Map();
  private performanceHistory: Array<{ timestamp: Date; metrics: Record<string, number> }> = [];
  private violationCounts: Map<string, number> = new Map();

  constructor(config: EnigmaConfig, validatorConfig?: Partial<RuntimeValidatorConfig>) {
    super();
    this.config = config;
    this.validatorConfig = {
      enabled: true,
      checkInterval: 5000, // 5 seconds
      resourceThresholds: {
        memory: 1024 * 1024 * 1024, // 1GB
        cpu: 80, // 80%
        fileHandles: 1000,
        diskSpace: 100 * 1024 * 1024, // 100MB
      },
      performanceBaselines: {
        processingTime: 1000, // 1 second
        memoryUsage: 100 * 1024 * 1024, // 100MB
        fileOperations: 100, // 100 ops/sec
      },
      securityChecks: {
        pathTraversal: true,
        filePermissions: true,
        resourceLimits: true,
      },
      autoCorrection: {
        enabled: true,
        maxAttempts: 3,
        fallbackToDefaults: true,
      },
      ...validatorConfig,
    };

    this.initializeBaselines();
  }

  /**
   * Start runtime validation monitoring
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn("Runtime validator is already running");
      return;
    }

    if (!this.validatorConfig.enabled) {
      logger.info("Runtime validator is disabled");
      return;
    }

    logger.info("Starting runtime configuration validator", {
      checkInterval: this.validatorConfig.checkInterval,
      resourceThresholds: this.validatorConfig.resourceThresholds,
    });

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.performRuntimeChecks();
    }, this.validatorConfig.checkInterval);

    // Perform initial check
    this.performRuntimeChecks();
  }

  /**
   * Stop runtime validation monitoring
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping runtime configuration validator");

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Update configuration and re-validate
   */
  public updateConfig(newConfig: EnigmaConfig): ValidationResult {
    logger.debug("Updating runtime validator configuration");

    const oldConfig = this.config;
    this.config = newConfig;

    // Perform immediate validation of the new configuration
    const validationResult = this.validateConfigurationChange(oldConfig, newConfig);

    if (!validationResult.isValid) {
      // Revert to old configuration if validation fails
      this.config = oldConfig;
      logger.warn("Configuration update failed validation, reverting to previous configuration");
    }

    return validationResult;
  }

  /**
   * Validate a specific configuration value at runtime
   */
  public validateValue(field: string, value: unknown, constraints?: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Perform field-specific validation
      switch (field) {
        case "maxConcurrency":
          this.validateConcurrency(value as number, errors, warnings, suggestions);
          break;
        case "input":
        case "output":
          this.validatePath(field, value as string, errors, warnings, suggestions);
          break;
        case "htmlExtractor.maxFileSize":
        case "jsExtractor.maxFileSize":
          this.validateFileSize(value as number, errors, warnings, suggestions);
          break;
        default:
          // Generic validation
          this.validateGenericField(field, value, constraints, errors, warnings, suggestions);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        performance: { validationTime: 0, rulesApplied: 1 },
      };
    } catch (_error) {
      logger.error("Runtime validation failed", { field, error });
      
      const validationError = new ValidationError(
        `Runtime validation failed for field '${field}': ${error instanceof Error ? error.message : String(error)}`,
        field,
        value,
        error as Error,
        { operation: "runtimeValidation", field }
      );

      return {
        isValid: false,
        errors: [validationError],
        warnings,
        suggestions,
        performance: { validationTime: 0, rulesApplied: 1 },
      };
    }
  }

  /**
   * Validate file system paths (expected by tests)
   */
  public async validatePaths(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate input path
      if (this.config.input) {
        if (!require('fs').existsSync(this.config.input)) {
          errors.push(`Input path does not exist: ${this.config.input}`);
        }
      }

      // Validate output path
      if (this.config.output) {
        const outputDir = require('path').dirname(this.config.output);
        if (!require('fs').existsSync(outputDir)) {
          warnings.push(`Output directory does not exist and will be created: ${outputDir}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (_error) {
      errors.push(`Path validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Validate resource constraints (expected by tests)
   */
  public async validateConstraints(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check memory thresholds
      const usage = this.getResourceUsage();
      const thresholds = this.validatorConfig.resourceThresholds;

      // Memory
      if (usage.memoryHeapUsed > thresholds.memory) {
        errors.push(`Resource constraint: Memory usage exceeds threshold: ${Math.round(usage.memoryHeapUsed / 1024 / 1024)}MB > ${Math.round(thresholds.memory / 1024 / 1024)}MB`);
        warnings.push(`Memory usage exceeded resource threshold: ${Math.round(usage.memoryHeapUsed / 1024 / 1024)}MB > ${Math.round(thresholds.memory / 1024 / 1024)}MB`);
      } else if (usage.memoryHeapUsed > thresholds.memory * 0.8) {
        warnings.push(`Memory usage is approaching threshold: ${Math.round(usage.memoryHeapUsed / 1024 / 1024)}MB`);
      }

      // CPU (simulate as always under for now, as process.cpuUsage() is not percentage-based)
      // You may want to implement actual CPU checks in a real environment

      // File handles
      if (usage.activeHandles > thresholds.fileHandles) {
        errors.push(`Resource constraint: Active file handles exceed threshold: ${usage.activeHandles} > ${thresholds.fileHandles}`);
        warnings.push(`File handles exceeded resource threshold: ${usage.activeHandles} > ${thresholds.fileHandles}`);
      } else if (usage.activeHandles > thresholds.fileHandles * 0.8) {
        warnings.push(`Active file handles approaching threshold: ${usage.activeHandles}`);
      }

      // Disk space (simulate as always under for now, as process does not provide disk usage)
      // You may want to implement actual disk checks in a real environment

      // Concurrency limits
      if (this.config.maxConcurrency > 8) {
        warnings.push(`High concurrency setting may impact performance: ${this.config.maxConcurrency}`);
      }

      // If any errors, isValid must be false
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (_error) {
      errors.push(`Constraint validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Get current resource usage statistics
   */
  public getResourceUsage(): Record<string, number> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memoryHeapUsed: memoryUsage.heapUsed,
      memoryHeapTotal: memoryUsage.heapTotal,
      memoryRss: memoryUsage.rss,
      memoryExternal: memoryUsage.external,
      cpuUser: cpuUsage.user,
      cpuSystem: cpuUsage.system,
      uptime: process.uptime(),
      activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
      activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
    };
  }

  /**
   * Initialize performance baselines
   */
  private initializeBaselines(): void {
    const initialUsage = this.getResourceUsage();
    
    this.resourceBaselines.set("memory", initialUsage.memoryHeapUsed);
    this.resourceBaselines.set("cpu", 0);
    this.resourceBaselines.set("handles", initialUsage.activeHandles);
    this.resourceBaselines.set("requests", initialUsage.activeRequests);

    logger.debug("Initialized runtime validation baselines", {
      baselines: Object.fromEntries(this.resourceBaselines),
    });
  }

  /**
   * Perform comprehensive runtime checks
   */
  private performRuntimeChecks(): void {
    try {
      // Check resource usage
      this.checkResourceUsage();

      // Check performance metrics
      this.checkPerformanceMetrics();

      // Check security constraints
      this.checkSecurityConstraints();

      // Check configuration consistency
      this.checkConfigurationConsistency();

      // Update performance history
      this.updatePerformanceHistory();
    } catch (_error) {
      logger.error("Runtime validation check failed", { error });
    }
  }

  /**
   * Check resource usage against thresholds
   */
  private checkResourceUsage(): void {
    const usage = this.getResourceUsage();
    const thresholds = this.validatorConfig.resourceThresholds;

    // Memory check
    if (usage.memoryHeapUsed > thresholds.memory) {
      this.emitResourceAlert("memory", usage.memoryHeapUsed, thresholds.memory, "bytes", [
        "Consider reducing maxConcurrency",
        "Reduce file size limits",
        "Enable garbage collection optimization",
      ]);
    }

    // File handles check
    if (usage.activeHandles > thresholds.fileHandles) {
      this.emitResourceAlert("handles", usage.activeHandles, thresholds.fileHandles, "handles", [
        "Reduce concurrent file operations",
        "Check for file handle leaks",
        "Implement file handle pooling",
      ]);
    }
  }

  /**
   * Check performance metrics for degradation
   */
  private checkPerformanceMetrics(): void {
    const currentUsage = this.getResourceUsage();
    const baseline = this.resourceBaselines.get("memory") || 0;
    
    if (baseline > 0) {
      const memoryIncrease = ((currentUsage.memoryHeapUsed - baseline) / baseline) * 100;
      
      if (memoryIncrease > 50) { // 50% increase
        this.emitPerformanceAlert("memory-usage", baseline, currentUsage.memoryHeapUsed, memoryIncrease, [
          "Memory usage has increased significantly",
          "Consider restarting the process",
          "Review recent configuration changes",
        ]);
      }
    }
  }

  /**
   * Check security constraints
   */
  private checkSecurityConstraints(): void {
    if (!this.validatorConfig.securityChecks.pathTraversal) {
      return;
    }

    // Check for path traversal in current configuration
    const pathFields = [this.config.input, this.config.output];
    for (const path of pathFields) {
      if (path && (path.includes("../") || path.includes("..\\"))) {
        this.emitSecurityAlert("path-traversal", "Path traversal detected in runtime configuration", {
          path,
          field: path === this.config.input ? "input" : "output",
        }, "high", true);
      }
    }
  }

  /**
   * Check configuration consistency
   */
  private checkConfigurationConsistency(): void {
    // Check for conflicting settings
    if (this.config.dev?.enabled && this.config.minify) {
      this.emitValidationWarning("configuration", "Development mode enabled with minification", {
        suggestions: ["Disable minification in development mode", "Use separate configurations for dev/prod"],
        severity: "medium" as const,
      });
    }

    // Check for performance-impacting settings
    if (this.config.maxConcurrency > 8) {
      this.emitValidationWarning("performance", "High concurrency setting detected", {
        field: "maxConcurrency",
        currentValue: this.config.maxConcurrency,
        recommendedValue: 4,
        suggestions: ["Consider reducing maxConcurrency for better stability"],
        severity: "low" as const,
      });
    }
  }

  /**
   * Update performance history for trend analysis
   */
  private updatePerformanceHistory(): void {
    const metrics = this.getResourceUsage();
    
    this.performanceHistory.push({
      timestamp: new Date(),
      metrics,
    });

    // Keep only last 100 entries
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
  }

  /**
   * Validate configuration change
   */
  private validateConfigurationChange(oldConfig: EnigmaConfig, newConfig: EnigmaConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for breaking changes
    if (oldConfig.input !== newConfig.input) {
      warnings.push("Input path changed - ensure all dependent processes are updated");
    }

    if (oldConfig.output !== newConfig.output) {
      warnings.push("Output path changed - previous output files may become orphaned");
    }

    // Check for performance impact
    if (newConfig.maxConcurrency > oldConfig.maxConcurrency * 2) {
      warnings.push("Significant concurrency increase may impact system performance");
      suggestions.push("Monitor resource usage after this change");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      performance: { validationTime: 0, rulesApplied: 3 },
    };
  }

  // Field-specific validation methods
  private validateConcurrency(value: number, errors: ValidationError[], warnings: string[], suggestions: string[]): void {
    if (value > 16) {
      warnings.push("Very high concurrency setting may cause system instability");
      suggestions.push("Consider using a lower value (2-8) for optimal performance");
    }
  }

  private validatePath(field: string, value: string, errors: ValidationError[], warnings: string[], suggestions: string[]): void {
    if (value.includes("../") || value.includes("..\\")) {
      errors.push(new ValidationError(
        "Path traversal detected",
        field,
        value,
        undefined,
        { operation: "runtimeValidation", field }
      ));
    }
  }

  private validateFileSize(value: number, errors: ValidationError[], warnings: string[], suggestions: string[]): void {
    if (value > 50 * 1024 * 1024) { // 50MB
      warnings.push("Large file size limit may impact memory usage");
      suggestions.push("Consider implementing streaming for large files");
    }
  }

  private validateGenericField(field: string, value: unknown, constraints: Record<string, unknown> | undefined, errors: ValidationError[], warnings: string[], suggestions: string[]): void {
    // Generic validation logic
    if (constraints) {
      // Apply constraints if provided
      if (constraints.min !== undefined && typeof value === "number" && value < (constraints.min as number)) {
        errors.push(new ValidationError(
          `Value below minimum constraint`,
          field,
          value,
          undefined,
          { operation: "runtimeValidation", field }
        ));
      }
    }
  }

  // Event emission helpers
  private emitResourceAlert(resource: ResourceAlert["resource"], current: number, threshold: number, unit: string, suggestions: string[]): void {
    const alert: ResourceAlert = {
      timestamp: new Date(),
      resource,
      currentUsage: current,
      threshold,
      unit,
      trend: "increasing", // Simplified for now
      suggestions,
    };

    this.emit("resource-threshold", alert);
    logger.warn("Resource threshold exceeded", alert);
  }

  private emitPerformanceAlert(metric: PerformanceAlert["metric"], baseline: number, current: number, degradation: number, suggestions: string[]): void {
    const alert: PerformanceAlert = {
      timestamp: new Date(),
      metric,
      baseline,
      current,
      degradation,
      impact: degradation > 100 ? "high" : degradation > 50 ? "medium" : "low",
      suggestions,
    };

    this.emit("performance-degradation", alert);
    logger.warn("Performance degradation detected", alert);
  }

  private emitSecurityAlert(violation: SecurityAlert["violation"], message: string, details: Record<string, unknown>, severity: SecurityAlert["severity"], blocked: boolean): void {
    const alert: SecurityAlert = {
      timestamp: new Date(),
      violation,
      message,
      details,
      severity,
      blocked,
    };

    this.emit("security-violation", alert);
    logger.error("Security violation detected", alert);
  }

  private emitValidationWarning(type: RuntimeValidationWarning["type"], message: string, options: Partial<RuntimeValidationWarning>): void {
    const warning: RuntimeValidationWarning = {
      timestamp: new Date(),
      type,
      message,
      suggestions: [],
      severity: "medium",
      ...options,
    };

    this.emit("validation-warning", warning);
    logger.warn("Runtime validation warning", warning);
  }
}

/**
 * Factory function for creating runtime validator
 */
export function createRuntimeValidator(config: EnigmaConfig, validatorConfig?: Partial<RuntimeValidatorConfig>): RuntimeValidator {
  // If config.runtime exists, merge its properties into validatorConfig
  let mergedConfig: Partial<RuntimeValidatorConfig> = { ...validatorConfig };
  if (config.runtime) {
    mergedConfig = {
      ...mergedConfig,
      ...config.runtime,
      resourceThresholds: {
        ...((validatorConfig && validatorConfig.resourceThresholds) || {}),
        ...(config.runtime.resourceThresholds || {})
      },
      autoCorrection: {
        ...((validatorConfig && validatorConfig.autoCorrection) || {}),
        ...(config.runtime.autoCorrection || {})
      }
    };
  }
  return new RuntimeValidator(config, mergedConfig);
}

/**
 * Validate configuration at runtime (expected by tests)
 */
export async function validateConfigRuntime(config: EnigmaConfig): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
  const validator = createRuntimeValidator(config);
  
  // Perform basic runtime validation
  const pathResult = await validator.validatePaths();
  const constraintResult = await validator.validateConstraints();
  
  return {
    isValid: pathResult.isValid && constraintResult.isValid,
    errors: [...pathResult.errors, ...constraintResult.errors],
    warnings: [...pathResult.warnings, ...constraintResult.warnings]
  };
} 