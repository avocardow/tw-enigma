/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z, ZodError, ZodSchema } from 'zod';
import {
  createErrorContext,
  ErrorCategory,
  ErrorContext,
  ErrorSeverity,
  ValidationError,
} from '../errors';

/**
 * Configuration for validation behavior
 */
export interface ValidationConfig {
  /** Whether to stop on first validation error */
  stopOnFirstError: boolean;

  /** Whether to include detailed error paths */
  includeErrorPaths: boolean;

  /** Whether to include the actual received values in errors */
  includeReceivedValues: boolean;

  /** Maximum depth for nested object validation */
  maxValidationDepth: number;

  /** Custom error message templates */
  errorMessageTemplates: Record<string, string>;
}

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  stopOnFirstError: false,
  includeErrorPaths: true,
  includeReceivedValues: true,
  maxValidationDepth: 10,
  errorMessageTemplates: {
    required: 'Field {path} is required',
    invalid_type: 'Field {path} expected {expected} but received {received}',
    too_small: 'Field {path} must be at least {minimum}',
    too_big: 'Field {path} must be at most {maximum}',
    invalid_string: 'Field {path} contains invalid characters',
    custom: 'Field {path} failed custom validation: {message}',
  },
};

/**
 * Result of a validation operation
 */
export interface ValidationResult<T = unknown> {
  /** Whether validation passed */
  isValid: boolean;

  /** The validated and parsed data if successful */
  data?: T;

  /** Validation errors if unsuccessful */
  errors: ValidationError[];

  /** Summary of all constraint violations */
  constraintViolations: string[];

  /** Paths that failed validation */
  failedPaths: string[];
}

/**
 * Validation rule definition
 */
export interface ValidationRule<T = unknown> {
  /** Name of the validation rule */
  name: string;

  /** Zod schema for validation */
  schema: ZodSchema<T>;

  /** Custom error message */
  errorMessage?: string;

  /** Whether this rule is required */
  required?: boolean;

  /** Custom validation function */
  customValidator?: (value: T) => boolean | string;
}

/**
 * Enhanced validation chain with comprehensive error reporting
 */
export class ValidationChain {
  private config: ValidationConfig;
  private rules: ValidationRule[] = [];

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  }

  /**
   * Add a validation rule to the chain
   */
  addRule<T = unknown>(rule: ValidationRule<T>): ValidationChain {
    this.rules.push(rule as ValidationRule<unknown>);
    return this;
  }

  /**
   * Add multiple validation rules
   */
  addRules(rules: ValidationRule[]): ValidationChain {
    this.rules.push(...rules);
    return this;
  }

  /**
   * Validate data against all rules in the chain
   */
  validate<T = unknown>(data: unknown, context?: Partial<ErrorContext>): ValidationResult<T> {
    const errors: ValidationError[] = [];
    const constraintViolations: string[] = [];
    const failedPaths: string[] = [];
    let validatedData: T | undefined;

    for (const rule of this.rules) {
      try {
        const result = rule.schema.parse(data);

        // Apply custom validation if present
        if (rule.customValidator) {
          const customResult = rule.customValidator(result);
          if (customResult !== true) {
            const errorMessage =
              typeof customResult === 'string'
                ? customResult
                : rule.errorMessage || `Custom validation failed for rule: ${rule.name}`;

            const validationError = this.createValidationError(errorMessage, context, {
              validationPath: rule.name,
              constraintViolations: [errorMessage],
            });

            errors.push(validationError);
            constraintViolations.push(errorMessage);
            failedPaths.push(rule.name);

            if (this.config.stopOnFirstError) {
              break;
            }
          }
        }

        // Store the validated data from the first successful rule
        if (!validatedData) {
          validatedData = result as T;
        }
      } catch (error) {
        const validationError = this.handleZodError(error, rule, context);
        errors.push(validationError);
        constraintViolations.push(...(validationError.constraintViolations || []));
        failedPaths.push(validationError.validationPath || rule.name);

        if (this.config.stopOnFirstError) {
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      data: validatedData,
      errors,
      constraintViolations,
      failedPaths,
    };
  }

  /**
   * Validate with a single schema (convenience method)
   */
  static validateWithSchema<T>(
    schema: ZodSchema<T>,
    data: unknown,
    context?: Partial<ErrorContext>
  ): ValidationResult<T> {
    const chain = new ValidationChain();
    chain.addRule({
      name: 'schema_validation',
      schema,
    });
    return chain.validate<T>(data, context);
  }

  /**
   * Create a validation error from Zod error
   */
  private handleZodError(
    error: unknown,
    rule: ValidationRule,
    context?: Partial<ErrorContext>
  ): ValidationError {
    if (error instanceof ZodError) {
      const violations = error.errors.map((issue) => {
        const path = issue.path.join('.');
        const template = this.config.errorMessageTemplates[issue.code] || issue.message;

        return this.formatErrorMessage(template, {
          path: path || rule.name,
          expected: this.getExpectedType(issue),
          received: this.getReceivedValue(issue),
          minimum: (issue as any).minimum,
          maximum: (issue as any).maximum,
          message: issue.message,
        });
      });

      return this.createValidationError(
        rule.errorMessage || `Validation failed for rule: ${rule.name}`,
        context,
        {
          validationPath: rule.name,
          constraintViolations: violations,
          receivedValue: this.config.includeReceivedValues
            ? (error.errors[0] as any)?.received
            : undefined,
        }
      );
    }

    // Handle non-Zod errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return this.createValidationError(rule.errorMessage || errorMessage, context, {
      validationPath: rule.name,
      constraintViolations: [errorMessage],
    });
  }

  /**
   * Create a validation error with proper context
   */
  private createValidationError(
    message: string,
    context?: Partial<ErrorContext>,
    options: {
      validationPath?: string;
      constraintViolations?: string[];
      receivedValue?: unknown;
    } = {}
  ): ValidationError {
    const errorContext = createErrorContext(
      context?.operation || 'validation',
      ErrorCategory.VALIDATION,
      context?.severity || ErrorSeverity.MEDIUM,
      context?.metadata
    );

    return new ValidationError(message, errorContext, {
      validationPath: options.validationPath,
      constraintViolations: options.constraintViolations,
      receivedValue: options.receivedValue,
    });
  }

  /**
   * Format error message with template variables
   */
  private formatErrorMessage(template: string, variables: Record<string, unknown>): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get expected type from Zod issue
   */
  private getExpectedType(issue: z.ZodIssue): string {
    switch (issue.code) {
      case 'invalid_type':
        return (issue as z.ZodInvalidTypeIssue).expected;
      case 'invalid_string':
        return 'string';
      case 'too_small':
      case 'too_big':
        return 'number';
      default:
        return 'valid value';
    }
  }

  /**
   * Get received value from Zod issue
   */
  private getReceivedValue(issue: z.ZodIssue): string {
    if (!this.config.includeReceivedValues) {
      return '[hidden]';
    }

    switch (issue.code) {
      case 'invalid_type':
        return (issue as z.ZodInvalidTypeIssue).received;
      default:
        return JSON.stringify((issue as any).received);
    }
  }

  /**
   * Update validation configuration
   */
  updateConfig(updates: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Clear all validation rules
   */
  clear(): void {
    this.rules = [];
  }

  /**
   * Get current validation rules
   */
  getRules(): readonly ValidationRule[] {
    return [...this.rules];
  }
}

/**
 * Helper function to create enhanced Zod schemas with better error messages
 */
export function createEnhancedSchema<T>(
  baseSchema: ZodSchema<T>,
  customMessages?: Record<string, string>
): ZodSchema<T> {
  return baseSchema.refine((value) => true, {
    message: customMessages?.default || 'Validation failed',
  });
}

/**
 * Common validation schemas with enhanced error messages
 */
export const CommonValidationSchemas = {
  /** Non-empty string validation */
  nonEmptyString: z.string().min(1, 'String cannot be empty'),

  /** Positive integer validation */
  positiveInteger: z.number().int().positive('Must be a positive integer'),

  /** File path validation */
  filePath: z.string().regex(/^[^<>:"|?*]+$/, 'Invalid file path characters'),

  /** CSS identifier validation */
  cssIdentifier: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_-]*$/, 'Invalid CSS identifier'),

  /** Email validation */
  email: z.string().email('Invalid email format'),

  /** URL validation */
  url: z.string().url('Invalid URL format'),

  /** Hex color validation */
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
};

/**
 * Convenience function for quick validation
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  context?: Partial<ErrorContext>
): ValidationResult<T> {
  return ValidationChain.validateWithSchema(schema, data, context);
}
