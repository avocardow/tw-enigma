/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorCategory, ErrorContext, ErrorSeverity } from './ErrorContext';

/**
 * Base enhanced error class with rich context support
 */
export abstract class EnhancedError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get formatted error message with context
   */
  getFormattedMessage(): string {
    const sections = [
      `${this.name}: ${this.message}`,
      `Error ID: ${this.context.errorId}`,
      `Severity: ${this.context.severity.toUpperCase()}`,
      `Operation: ${this.context.operation}`,
    ];

    if (this.context.recoverySuggestions?.length) {
      sections.push(
        `Recovery Suggestions:\n${this.context.recoverySuggestions.map((s) => `  - ${s}`).join('\n')}`
      );
    }

    return sections.join('\n');
  }

  /**
   * Check if this error is retryable based on category and severity
   */
  isRetryable(): boolean {
    if (this.context.severity === ErrorSeverity.CRITICAL) {
      return false;
    }

    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.FILE_OPERATION,
      ErrorCategory.PERFORMANCE,
    ];

    return retryableCategories.includes(this.context.category);
  }

  /**
   * Get recommended retry delay in milliseconds
   */
  getRetryDelay(): number {
    const baseDelay = 1000; // 1 second
    const severityMultipliers = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 2,
      [ErrorSeverity.HIGH]: 4,
      [ErrorSeverity.CRITICAL]: 0, // No retry
    };

    return baseDelay * severityMultipliers[this.context.severity];
  }
}

/**
 * Validation errors for schema and input validation failures
 */
export class ValidationError extends EnhancedError {
  public readonly validationPath?: string;
  public readonly expectedType?: string;
  public readonly receivedValue?: unknown;
  public readonly constraintViolations?: string[];

  constructor(
    message: string,
    context: ErrorContext,
    options: {
      validationPath?: string;
      expectedType?: string;
      receivedValue?: unknown;
      constraintViolations?: string[];
      originalError?: Error;
    } = {}
  ) {
    super(message, context, options.originalError);
    this.validationPath = options.validationPath;
    this.expectedType = options.expectedType;
    this.receivedValue = options.receivedValue;
    this.constraintViolations = options.constraintViolations;
  }

  getValidationSummary(): string {
    const parts = [`Validation failed: ${this.message}`];

    if (this.validationPath) {
      parts.push(`Path: ${this.validationPath}`);
    }

    if (this.expectedType) {
      parts.push(`Expected: ${this.expectedType}`);
    }

    if (this.receivedValue !== undefined) {
      parts.push(`Received: ${JSON.stringify(this.receivedValue)}`);
    }

    if (this.constraintViolations?.length) {
      parts.push(`Violations: ${this.constraintViolations.join(', ')}`);
    }

    return parts.join('\n');
  }
}

/**
 * File operation errors for I/O, atomic operations, and permissions
 */
export class FileOperationError extends EnhancedError {
  public readonly operation:
    | 'read'
    | 'write'
    | 'delete'
    | 'create'
    | 'move'
    | 'copy'
    | 'permission'
    | 'atomic';
  public readonly filePath: string;
  public readonly permissions?: string;
  public readonly fileSize?: number;

  constructor(
    message: string,
    context: ErrorContext,
    options: {
      operation: 'read' | 'write' | 'delete' | 'create' | 'move' | 'copy' | 'permission' | 'atomic';
      filePath: string;
      permissions?: string;
      fileSize?: number;
      originalError?: Error;
    }
  ) {
    super(message, context, options.originalError);
    this.operation = options.operation;
    this.filePath = options.filePath;
    this.permissions = options.permissions;
    this.fileSize = options.fileSize;
  }

  getOperationSummary(): string {
    const parts = [`File operation failed: ${this.operation}`, `Path: ${this.filePath}`];

    if (this.permissions) {
      parts.push(`Permissions: ${this.permissions}`);
    }

    if (this.fileSize !== undefined) {
      parts.push(`Size: ${this.fileSize} bytes`);
    }

    return parts.join('\n');
  }
}

/**
 * Performance errors for timeout, memory limits, and optimization failures
 */
export class PerformanceError extends EnhancedError {
  public readonly performanceType:
    | 'timeout'
    | 'memory'
    | 'cpu'
    | 'optimization'
    | 'cache'
    | 'throttle';
  public readonly threshold?: number;
  public readonly actualValue?: number;
  public readonly duration?: number;

  constructor(
    message: string,
    context: ErrorContext,
    options: {
      performanceType: 'timeout' | 'memory' | 'cpu' | 'optimization' | 'cache' | 'throttle';
      threshold?: number;
      actualValue?: number;
      duration?: number;
      originalError?: Error;
    }
  ) {
    super(message, context, options.originalError);
    this.performanceType = options.performanceType;
    this.threshold = options.threshold;
    this.actualValue = options.actualValue;
    this.duration = options.duration;
  }

  getPerformanceSummary(): string {
    const parts = [`Performance issue: ${this.performanceType}`];

    if (this.threshold !== undefined && this.actualValue !== undefined) {
      parts.push(`Threshold: ${this.threshold}, Actual: ${this.actualValue}`);
    }

    if (this.duration !== undefined) {
      parts.push(`Duration: ${this.duration}ms`);
    }

    return parts.join('\n');
  }

  isRetryable(): boolean {
    // Performance errors are generally retryable except for memory exhaustion
    return this.performanceType !== 'memory' || this.context.severity !== ErrorSeverity.CRITICAL;
  }
}

/**
 * Configuration errors for invalid configurations and missing settings
 */
export class ConfigurationError extends EnhancedError {
  public readonly configPath?: string;
  public readonly configKey?: string;
  public readonly expectedFormat?: string;
  public readonly validOptions?: string[];

  constructor(
    message: string,
    context: ErrorContext,
    options: {
      configPath?: string;
      configKey?: string;
      expectedFormat?: string;
      validOptions?: string[];
      originalError?: Error;
    } = {}
  ) {
    super(message, context, options.originalError);
    this.configPath = options.configPath;
    this.configKey = options.configKey;
    this.expectedFormat = options.expectedFormat;
    this.validOptions = options.validOptions;
  }

  getConfigurationSummary(): string {
    const parts = [`Configuration error: ${this.message}`];

    if (this.configPath) {
      parts.push(`Config file: ${this.configPath}`);
    }

    if (this.configKey) {
      parts.push(`Key: ${this.configKey}`);
    }

    if (this.expectedFormat) {
      parts.push(`Expected format: ${this.expectedFormat}`);
    }

    if (this.validOptions?.length) {
      parts.push(`Valid options: ${this.validOptions.join(', ')}`);
    }

    return parts.join('\n');
  }

  isRetryable(): boolean {
    // Configuration errors are generally not retryable without user intervention
    return false;
  }
}

/**
 * Integration errors for framework detection, plugin loading, and external tool failures
 */
export class IntegrationError extends EnhancedError {
  public readonly integrationType: 'framework' | 'plugin' | 'external_tool' | 'api' | 'dependency';
  public readonly integrationName: string;
  public readonly version?: string;
  public readonly expectedVersion?: string;

  constructor(
    message: string,
    context: ErrorContext,
    options: {
      integrationType: 'framework' | 'plugin' | 'external_tool' | 'api' | 'dependency';
      integrationName: string;
      version?: string;
      expectedVersion?: string;
      originalError?: Error;
    }
  ) {
    super(message, context, options.originalError);
    this.integrationType = options.integrationType;
    this.integrationName = options.integrationName;
    this.version = options.version;
    this.expectedVersion = options.expectedVersion;
  }

  getIntegrationSummary(): string {
    const parts = [`Integration error: ${this.integrationType}`, `Name: ${this.integrationName}`];

    if (this.version) {
      parts.push(`Version: ${this.version}`);
    }

    if (this.expectedVersion) {
      parts.push(`Expected version: ${this.expectedVersion}`);
    }

    return parts.join('\n');
  }

  isRetryable(): boolean {
    // Plugin and API errors might be retryable, dependency and framework errors usually not
    return this.integrationType === 'plugin' || this.integrationType === 'api';
  }
}

/**
 * Type guard functions for error classification
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isFileOperationError(error: unknown): error is FileOperationError {
  return error instanceof FileOperationError;
}

export function isPerformanceError(error: unknown): error is PerformanceError {
  return error instanceof PerformanceError;
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isIntegrationError(error: unknown): error is IntegrationError {
  return error instanceof IntegrationError;
}

export function isEnhancedError(error: unknown): error is EnhancedError {
  return error instanceof EnhancedError;
}

/**
 * Helper function to create appropriate error type based on category
 */
export function createErrorByCategory(
  message: string,
  context: ErrorContext,
  specificOptions?: Record<string, unknown>
): EnhancedError {
  switch (context.category) {
    case ErrorCategory.VALIDATION:
      return new ValidationError(message, context, specificOptions as any);

    case ErrorCategory.FILE_OPERATION:
      return new FileOperationError(message, context, specificOptions as any);

    case ErrorCategory.PERFORMANCE:
      return new PerformanceError(message, context, specificOptions as any);

    case ErrorCategory.CONFIGURATION:
      return new ConfigurationError(message, context, specificOptions as any);

    case ErrorCategory.INTEGRATION:
      return new IntegrationError(message, context, specificOptions as any);

    default:
      // Create a generic enhanced error for other categories
      return new (class GenericEnhancedError extends EnhancedError {})(message, context);
  }
}
