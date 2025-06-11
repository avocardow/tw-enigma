/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { logger, ErrorContext } from './logger.js';

/**
 * Base error class for all Tailwind Enigma Core errors
 * Provides standardized error handling with logging integration
 */
export abstract class EnigmaError extends Error {
  public readonly timestamp: Date;
  public readonly errorId: string;
  
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: ErrorContext,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.errorId = this.generateErrorId();
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
    
    // Capture stack trace excluding constructor
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Auto-log the error
    this.logError();
  }
  
  /**
   * Generate a unique error ID for tracking
   */
  private generateErrorId(): string {
    return `${this.code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Log the error using the centralized logger
   */
  private logError(): void {
    const errorContext: ErrorContext = {
      ...this.context,
      errorId: this.errorId,
      errorCode: this.code,
    };
    
    logger.error(this, errorContext);
  }
  
  /**
   * Convert error to JSON for structured logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      errorId: this.errorId,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
      } : undefined,
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends EnigmaError {
  constructor(
    message: string,
    public readonly filepath?: string,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'CONFIG_ERROR',
      {
        ...context,
        component: 'Config',
        filePath: filepath,
      },
      cause
    );
  }
}

/**
 * File system operation errors
 */
export class FileReadError extends EnigmaError {
  constructor(
    message: string,
    public readonly filePath?: string,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'FILE_READ_ERROR',
      {
        ...context,
        component: 'FileSystem',
        filePath,
      },
      cause
    );
  }
}

/**
 * File discovery operation errors
 */
export class FileDiscoveryError extends EnigmaError {
  constructor(
    message: string,
    public readonly patterns?: string | string[],
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'FILE_DISCOVERY_ERROR',
      {
        ...context,
        component: 'FileDiscovery',
        patterns: Array.isArray(patterns) ? patterns.join(', ') : patterns,
      },
      cause
    );
  }
}

/**
 * HTML parsing and extraction errors
 */
export class HtmlParsingError extends EnigmaError {
  constructor(
    message: string,
    public readonly source?: string,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'HTML_PARSING_ERROR',
      {
        ...context,
        component: 'HtmlExtractor',
        filePath: source,
      },
      cause
    );
  }
}

/**
 * JavaScript/JSX parsing and extraction errors
 */
export class JsParsingError extends EnigmaError {
  constructor(
    message: string,
    public readonly source?: string,
    public readonly framework?: string,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'JS_PARSING_ERROR',
      {
        ...context,
        component: 'JsExtractor',
        filePath: source,
        framework,
      },
      cause
    );
  }
}

/**
 * CSS processing and optimization errors
 */
export class CssProcessingError extends EnigmaError {
  constructor(
    message: string,
    public readonly source?: string,
    public readonly operation?: string,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'CSS_PROCESSING_ERROR',
      {
        ...context,
        component: 'CssProcessor',
        filePath: source,
        operation,
      },
      cause
    );
  }
}

/**
 * CLI command execution errors
 */
export class CliError extends EnigmaError {
  constructor(
    message: string,
    public readonly command?: string,
    public readonly suggestions?: string[],
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'CLI_ERROR',
      {
        ...context,
        component: 'CLI',
        operation: command,
        suggestions: suggestions?.join('; '),
      },
      cause
    );
  }
  
  /**
   * Display CLI-specific error formatting
   */
  displayError(): void {
    console.error(`❌ ${this.message}`);
    
    if (this.suggestions && this.suggestions.length > 0) {
      console.error('\n💡 Suggestions:');
      this.suggestions.forEach(suggestion => {
        console.error(`   • ${suggestion}`);
      });
    }
    
    if (this.context?.errorId) {
      console.error(`\n🔍 Error ID: ${this.context.errorId}`);
    }
  }
}

/**
 * Validation errors for user input
 */
export class ValidationError extends EnigmaError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      {
        ...context,
        component: 'Validation',
        field,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      },
      cause
    );
  }
}

/**
 * Performance and timeout errors
 */
export class TimeoutError extends EnigmaError {
  constructor(
    message: string,
    public readonly operation?: string,
    public readonly timeoutMs?: number,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'TIMEOUT_ERROR',
      {
        ...context,
        component: 'Performance',
        operation,
        timeoutMs,
      },
      cause
    );
  }
}

/**
 * External dependency errors (libraries, APIs, etc.)
 */
export class DependencyError extends EnigmaError {
  constructor(
    message: string,
    public readonly dependency?: string,
    public readonly version?: string,
    cause?: Error,
    context?: ErrorContext
  ) {
    super(
      message,
      'DEPENDENCY_ERROR',
      {
        ...context,
        component: 'Dependencies',
        dependency,
        version,
      },
      cause
    );
  }
}

/**
 * Utility functions for error handling
 */
export const ErrorUtils = {
  /**
   * Check if an error is a specific type
   */
  isErrorType<T extends EnigmaError>(error: unknown, errorClass: new (...args: any[]) => T): error is T {
    return error instanceof errorClass;
  },
  
  /**
   * Extract error message safely
   */
  getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  },
  
  /**
   * Get error code if available
   */
  getErrorCode(error: unknown): string | undefined {
    if (error instanceof EnigmaError) {
      return error.code;
    }
    return undefined;
  },
  
  /**
   * Create error context from operation details
   */
  createContext(operation: string, additionalContext?: Partial<ErrorContext>): ErrorContext {
    return {
      operation,
      ...additionalContext,
    };
  },
  
  /**
   * Wrap unknown errors in EnigmaError
   */
  wrapUnknownError(error: unknown, operation: string, context?: ErrorContext): EnigmaError {
    if (error instanceof EnigmaError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new class UnknownError extends EnigmaError {}(
        `Unknown error in ${operation}: ${error.message}`,
        'UNKNOWN_ERROR',
        { ...context, operation },
        error
      );
    }
    
    return new class UnknownError extends EnigmaError {}(
      `Unknown error in ${operation}: ${String(error)}`,
      'UNKNOWN_ERROR',
      { ...context, operation }
    );
  },
};

/**
 * Error exit codes for CLI
 */
export const ErrorExitCodes = {
  SUCCESS: 0,
  GENERIC_ERROR: 1,
  CONFIG_ERROR: 2,
  FILE_ERROR: 3,
  VALIDATION_ERROR: 4,
  TIMEOUT_ERROR: 5,
  DEPENDENCY_ERROR: 6,
  CLI_ERROR: 7,
} as const;

/**
 * Map error codes to exit codes
 */
export function getExitCode(errorCode: string): number {
  switch (errorCode) {
    case 'CONFIG_ERROR':
      return ErrorExitCodes.CONFIG_ERROR;
    case 'FILE_READ_ERROR':
    case 'FILE_DISCOVERY_ERROR':
      return ErrorExitCodes.FILE_ERROR;
    case 'VALIDATION_ERROR':
      return ErrorExitCodes.VALIDATION_ERROR;
    case 'TIMEOUT_ERROR':
      return ErrorExitCodes.TIMEOUT_ERROR;
    case 'DEPENDENCY_ERROR':
      return ErrorExitCodes.DEPENDENCY_ERROR;
    case 'CLI_ERROR':
      return ErrorExitCodes.CLI_ERROR;
    default:
      return ErrorExitCodes.GENERIC_ERROR;
  }
} 