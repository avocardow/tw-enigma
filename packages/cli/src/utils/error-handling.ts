/**
 * CLI Error Handling Utility
 *
 * Centralized error handling for CLI commands with proper logging and exit codes.
 */

import { Logger, LogLevel } from '@tw-enigma/core';
import chalk from 'chalk';

/**
 * CLI Error types for categorization
 */
export enum CLIErrorType {
  CONFIG_ERROR = 'CONFIG_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * CLI Error class with enhanced information
 */
export class CLIError extends Error {
  public readonly type: CLIErrorType;
  public readonly exitCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    type: CLIErrorType = CLIErrorType.UNKNOWN_ERROR,
    exitCode: number = 1,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CLIError';
    this.type = type;
    this.exitCode = exitCode;
    this.details = details;
  }
}

/**
 * Handle CLI errors with proper logging and exit
 */
export function handleCLIError(error: unknown, logger: Logger): never {
  if (error instanceof CLIError) {
    logger.error(error.message, error.details);
    if (error.details && logger.getState().level <= LogLevel.DEBUG) {
      // DEBUG level or lower
      console.error(chalk.gray('Error details:'), error.details);
    }
    process.exit(error.exitCode);
  } else if (error instanceof Error && error.name === 'PackageResolutionError') {
    // Handle PackageResolutionError with detailed diagnostic output
    console.error(error.toString());
    process.exit(1);
  } else if (error instanceof Error && error.name === 'TemplateFileError') {
    // Handle TemplateFileError with detailed diagnostic output
    console.error(error.toString());
    process.exit(1);
  } else if (error instanceof Error) {
    logger.error('Unexpected error occurred', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  } else {
    logger.error('Unknown error occurred', {
      error: String(error),
    });
    process.exit(1);
  }
}

/**
 * Create specific error types for common CLI scenarios
 */
export const CLIErrors = {
  configNotFound: (path: string) =>
    new CLIError(`Configuration file not found: ${path}`, CLIErrorType.CONFIG_ERROR, 1, {
      configPath: path,
    }),

  configInvalid: (errors: string[]) =>
    new CLIError('Configuration validation failed', CLIErrorType.CONFIG_ERROR, 1, {
      validationErrors: errors,
    }),

  fileNotFound: (path: string) =>
    new CLIError(`File not found: ${path}`, CLIErrorType.FILE_ERROR, 1, { filePath: path }),

  fileNotAccessible: (path: string, reason: string) =>
    new CLIError(`Cannot access file: ${path}`, CLIErrorType.FILE_ERROR, 1, {
      filePath: path,
      reason,
    }),

  invalidInput: (message: string, input?: unknown) =>
    new CLIError(`Invalid input: ${message}`, CLIErrorType.VALIDATION_ERROR, 1, { input }),

  processingFailed: (operation: string, reason: string) =>
    new CLIError(`${operation} failed: ${reason}`, CLIErrorType.PROCESSING_ERROR, 1, {
      operation,
      reason,
    }),

  networkError: (operation: string, error: string) =>
    new CLIError(`Network error during ${operation}: ${error}`, CLIErrorType.NETWORK_ERROR, 1, {
      operation,
      networkError: error,
    }),
};

/**
 * Wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  logger: Logger,
  operationName: string = 'operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CLIError) {
      throw error;
    } else if (error instanceof Error) {
      throw new CLIError(
        `${operationName} failed: ${error.message}`,
        CLIErrorType.PROCESSING_ERROR,
        1,
        { originalError: error.message, stack: error.stack }
      );
    } else {
      throw new CLIError(
        `${operationName} failed with unknown error`,
        CLIErrorType.UNKNOWN_ERROR,
        1,
        { error: String(error) }
      );
    }
  }
}

/**
 * Validate required options and throw appropriate errors
 */
export function validateRequiredOptions(
  options: Record<string, unknown>,
  required: string[]
): void {
  const missing = required.filter((key) => !options[key]);
  if (missing.length > 0) {
    throw CLIErrors.invalidInput(`Missing required options: ${missing.join(', ')}`, {
      missing,
      provided: Object.keys(options),
    });
  }
}
