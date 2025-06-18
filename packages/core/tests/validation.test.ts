/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ErrorCategory, ErrorSeverity, isValidationError } from '../src/errors';
import {
  CommonValidationSchemas,
  DEFAULT_VALIDATION_CONFIG,
  ValidationChain,
  ValidationConfig,
  ValidationRule,
  createEnhancedSchema,
  validate,
} from '../src/validation/ValidationChain';

describe('Enhanced Validation System (Task 13)', () => {
  describe('ValidationChain', () => {
    let chain: ValidationChain;

    beforeEach(() => {
      chain = new ValidationChain();
    });

    describe('Configuration', () => {
      it('should use default configuration', () => {
        expect(DEFAULT_VALIDATION_CONFIG).toMatchObject({
          stopOnFirstError: false,
          includeErrorPaths: true,
          includeReceivedValues: true,
          maxValidationDepth: 10,
          errorMessageTemplates: expect.objectContaining({
            required: expect.stringContaining('{path}'),
            invalid_type: expect.stringContaining('{expected}'),
          }),
        });
      });

      it('should accept custom configuration', () => {
        const customConfig: Partial<ValidationConfig> = {
          stopOnFirstError: true,
          includeReceivedValues: false,
          maxValidationDepth: 5,
        };

        const customChain = new ValidationChain(customConfig);
        customChain.updateConfig({ includeErrorPaths: false });

        // Test through behavior - custom chain should stop on first error
        customChain
          .addRule({
            name: 'rule1',
            schema: z.string(),
          })
          .addRule({
            name: 'rule2',
            schema: z.number(),
          });

        const result = customChain.validate(123); // Invalid for first rule
        expect(result.errors.length).toBe(1); // Should stop on first error
      });
    });

    describe('Rule Management', () => {
      it('should add single validation rule', () => {
        const rule: ValidationRule = {
          name: 'string_validation',
          schema: z.string().min(1),
          errorMessage: 'Must be a non-empty string',
        };

        chain.addRule(rule);
        const rules = chain.getRules();

        expect(rules).toHaveLength(1);
        expect(rules[0]).toMatchObject(rule);
      });

      it('should add multiple validation rules', () => {
        const rules: ValidationRule[] = [
          { name: 'rule1', schema: z.string() },
          { name: 'rule2', schema: z.number() },
        ];

        chain.addRules(rules);
        expect(chain.getRules()).toHaveLength(2);
      });

      it('should clear all rules', () => {
        chain.addRule({ name: 'test', schema: z.string() });
        expect(chain.getRules()).toHaveLength(1);

        chain.clear();
        expect(chain.getRules()).toHaveLength(0);
      });
    });

    describe('Basic Validation', () => {
      it('should validate successfully with matching schema', () => {
        chain.addRule({
          name: 'string_rule',
          schema: z.string(),
        });

        const result = chain.validate('test string');

        expect(result.isValid).toBe(true);
        expect(result.data).toBe('test string');
        expect(result.errors).toHaveLength(0);
        expect(result.constraintViolations).toHaveLength(0);
        expect(result.failedPaths).toHaveLength(0);
      });

      it('should fail validation with mismatched schema', () => {
        chain.addRule({
          name: 'string_rule',
          schema: z.string(),
          errorMessage: 'Expected string value',
        });

        const result = chain.validate(123);

        expect(result.isValid).toBe(false);
        expect(result.data).toBeUndefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBeInstanceOf(Error);
        expect(isValidationError(result.errors[0])).toBe(true);
        expect(result.constraintViolations.length).toBeGreaterThan(0);
        expect(result.failedPaths).toContain('string_rule');
      });

      it('should validate with multiple successful rules', () => {
        chain
          .addRule({ name: 'string_rule', schema: z.string() })
          .addRule({ name: 'length_rule', schema: z.string().min(4) });

        const result = chain.validate('test string');

        expect(result.isValid).toBe(true);
        expect(result.data).toBe('test string');
        expect(result.errors).toHaveLength(0);
      });

      it('should collect all validation errors by default', () => {
        chain
          .addRule({ name: 'number_rule', schema: z.number() })
          .addRule({ name: 'array_rule', schema: z.array(z.string()) });

        const result = chain.validate('invalid');

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.failedPaths).toContain('number_rule');
        expect(result.failedPaths).toContain('array_rule');
      });

      it('should stop on first error when configured', () => {
        const stopOnFirstChain = new ValidationChain({ stopOnFirstError: true });

        stopOnFirstChain
          .addRule({ name: 'number_rule', schema: z.number() })
          .addRule({ name: 'array_rule', schema: z.array(z.string()) });

        const result = stopOnFirstChain.validate('invalid');

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.failedPaths).toHaveLength(1);
      });
    });

    describe('Custom Validation', () => {
      it('should apply custom validator function', () => {
        chain.addRule({
          name: 'even_number',
          schema: z.number(),
          customValidator: (value: number) => value % 2 === 0 || 'Must be even number',
        });

        const validResult = chain.validate(4);
        expect(validResult.isValid).toBe(true);

        const invalidResult = chain.validate(3);
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.constraintViolations).toContain('Must be even number');
      });

      it('should handle custom validator returning boolean', () => {
        chain.addRule({
          name: 'positive_number',
          schema: z.number(),
          customValidator: (value: number) => value > 0,
          errorMessage: 'Number must be positive',
        });

        const invalidResult = chain.validate(-5);
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.constraintViolations).toContain('Number must be positive');
      });
    });

    describe('Error Message Formatting', () => {
      it('should format error messages with template variables', () => {
        const customChain = new ValidationChain({
          errorMessageTemplates: {
            too_small: 'Field {path} must be at least {minimum} characters, got {actual}',
          },
        });

        customChain.addRule({
          name: 'min_length',
          schema: z.string().min(5),
        });

        const result = customChain.validate('abc');
        expect(result.isValid).toBe(false);
        expect(result.constraintViolations[0]).toContain('at least 5');
      });

      it('should include validation path in errors', () => {
        chain.addRule({
          name: 'email_validation',
          schema: z.string().email(),
        });

        const result = chain.validate('invalid-email');
        expect(result.isValid).toBe(false);
        expect(result.errors[0].validationPath).toBe('email_validation');
      });

      it('should include received values when configured', () => {
        const showValuesChain = new ValidationChain({ includeReceivedValues: true });

        showValuesChain.addRule({
          name: 'number_rule',
          schema: z.number(),
        });

        const result = showValuesChain.validate('not-a-number');
        expect(result.isValid).toBe(false);
        expect(result.errors[0].receivedValue).toBe('not-a-number');
      });

      it('should hide received values when configured', () => {
        const hideValuesChain = new ValidationChain({ includeReceivedValues: false });

        hideValuesChain.addRule({
          name: 'number_rule',
          schema: z.number(),
        });

        const result = hideValuesChain.validate('not-a-number');
        expect(result.isValid).toBe(false);
        expect(result.errors[0].receivedValue).toBeUndefined();
      });
    });

    describe('Context Integration', () => {
      it('should create validation errors with proper context', () => {
        chain.addRule({
          name: 'name_validation',
          schema: z.string().min(2),
        });

        const context = {
          operation: 'user_registration',
          category: ErrorCategory.USER_INPUT,
          severity: ErrorSeverity.MEDIUM,
        };

        const result = chain.validate('a', context);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].context.operation).toBe('user_registration');
        expect(result.errors[0].context.category).toBe(ErrorCategory.USER_INPUT);
        expect(result.errors[0].context.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });
  });

  describe('Static Validation Methods', () => {
    it('should validate with single schema using static method', () => {
      const schema = z.object({
        name: z.string().min(2),
        age: z.number().positive(),
      });

      const validData = { name: 'John', age: 25 };
      const result = ValidationChain.validateWithSchema(schema, validData);

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should handle validation errors with static method', () => {
      const schema = z.string().email();
      const result = ValidationChain.validateWithSchema(schema, 'invalid-email');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(isValidationError(result.errors[0])).toBe(true);
    });
  });

  describe('Common Validation Schemas', () => {
    it('should validate non-empty strings', () => {
      const result = validate(CommonValidationSchemas.nonEmptyString, '');
      expect(result.isValid).toBe(false);
      expect(result.constraintViolations[0]).toContain('cannot be empty');

      const validResult = validate(CommonValidationSchemas.nonEmptyString, 'hello');
      expect(validResult.isValid).toBe(true);
    });

    it('should validate positive integers', () => {
      const result = validate(CommonValidationSchemas.positiveInteger, -5);
      expect(result.isValid).toBe(false);

      const validResult = validate(CommonValidationSchemas.positiveInteger, 10);
      expect(validResult.isValid).toBe(true);
    });

    it('should validate file paths', () => {
      const invalidResult = validate(CommonValidationSchemas.filePath, 'invalid|path');
      expect(invalidResult.isValid).toBe(false);

      const validResult = validate(CommonValidationSchemas.filePath, 'path/to/file.txt');
      expect(validResult.isValid).toBe(true);
    });

    it('should validate CSS identifiers', () => {
      const invalidResult = validate(CommonValidationSchemas.cssIdentifier, '123-invalid');
      expect(invalidResult.isValid).toBe(false);

      const validResult = validate(CommonValidationSchemas.cssIdentifier, 'valid-css-class');
      expect(validResult.isValid).toBe(true);
    });

    it('should validate email addresses', () => {
      const invalidResult = validate(CommonValidationSchemas.email, 'invalid-email');
      expect(invalidResult.isValid).toBe(false);

      const validResult = validate(CommonValidationSchemas.email, 'test@example.com');
      expect(validResult.isValid).toBe(true);
    });

    it('should validate URLs', () => {
      const invalidResult = validate(CommonValidationSchemas.url, 'not-a-url');
      expect(invalidResult.isValid).toBe(false);

      const validResult = validate(CommonValidationSchemas.url, 'https://example.com');
      expect(validResult.isValid).toBe(true);
    });

    it('should validate hex colors', () => {
      const invalidResult = validate(CommonValidationSchemas.hexColor, '#gg0000');
      expect(invalidResult.isValid).toBe(false);

      const validResult = validate(CommonValidationSchemas.hexColor, '#ff0000');
      expect(validResult.isValid).toBe(true);
    });
  });

  describe('Enhanced Schema Creation', () => {
    it('should create enhanced schema with custom messages', () => {
      const baseSchema = z.string().min(5);
      const enhanced = createEnhancedSchema(baseSchema, {
        default: 'Custom validation failed',
      });

      const result = validate(enhanced, 'abc');
      expect(result.isValid).toBe(false);
      // Enhanced schema validation behavior
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle nested object validation', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().min(2),
          email: z.string().email(),
          preferences: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean(),
          }),
        }),
        timestamp: z.date(),
      });

      const invalidData = {
        user: {
          name: 'a', // Too short
          email: 'invalid-email',
          preferences: {
            theme: 'purple', // Invalid enum
            notifications: 'yes', // Wrong type
          },
        },
        timestamp: 'not-a-date', // Wrong type
      };

      const result = ValidationChain.validateWithSchema(schema, invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.constraintViolations.length).toBeGreaterThan(3); // Multiple nested errors
    });

    it('should handle array validation with complex elements', () => {
      const schema = z
        .array(
          z.object({
            id: z.number().positive(),
            name: z.string().min(1),
            tags: z.array(z.string()),
          })
        )
        .min(1);

      const invalidData = [
        {
          id: -1, // Invalid
          name: '', // Invalid
          tags: ['valid-tag'],
        },
        {
          id: 2,
          name: 'valid',
          tags: [123], // Invalid type in array
        },
      ];

      const result = ValidationChain.validateWithSchema(schema, invalidData);
      expect(result.isValid).toBe(false);
      expect(result.constraintViolations.length).toBeGreaterThan(2);
    });

    it('should handle conditional validation with refinements', () => {
      const schema = z
        .object({
          type: z.enum(['user', 'admin']),
          permissions: z.array(z.string()),
        })
        .refine((data) => data.type !== 'admin' || data.permissions.includes('admin'), {
          message: 'Admin users must have admin permission',
          path: ['permissions'],
        });

      const invalidData = {
        type: 'admin' as const,
        permissions: ['read', 'write'], // Missing 'admin'
      };

      const result = ValidationChain.validateWithSchema(schema, invalidData);
      expect(result.isValid).toBe(false);
      expect(result.constraintViolations.some((v) => v.includes('admin permission'))).toBe(true);
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle malformed input gracefully', () => {
      chain.addRule({
        name: 'object_rule',
        schema: z.object({ key: z.string() }),
      });

      const result = chain.validate(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(isValidationError(result.errors[0])).toBe(true);
    });

    it('should handle circular references in data', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      chain.addRule({
        name: 'simple_string',
        schema: z.string(),
      });

      const result = chain.validate(circular);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should perform efficiently with large datasets', () => {
      const largeArray = Array(1000)
        .fill(0)
        .map((_, i) => `item-${i}`);

      const schema = z.array(z.string().min(1)).max(1000);
      const start = Date.now();
      const result = ValidationChain.validateWithSchema(schema, largeArray);
      const duration = Date.now() - start;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('Integration with Name Generation System', () => {
    it('should validate name generation options', () => {
      const nameGenerationSchema = z.object({
        strategy: z.enum(['pretty', 'sequential', 'hybrid']),
        minimumLength: z.number().int().min(1).max(20),
        alphabet: z.string().min(1),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
      });

      const validOptions = {
        strategy: 'pretty' as const,
        minimumLength: 4,
        alphabet: 'abcdefghijklmnopqrstuvwxyz',
        prefix: 'tw-',
      };

      const result = ValidationChain.validateWithSchema(nameGenerationSchema, validOptions);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual(validOptions);
    });

    it('should validate CSS class name format', () => {
      chain.addRule({
        name: 'css_class',
        schema: CommonValidationSchemas.cssIdentifier,
        errorMessage: 'Invalid CSS class name format',
      });

      const validResult = chain.validate('btn-primary');
      expect(validResult.isValid).toBe(true);

      const invalidResult = chain.validate('123-invalid');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.constraintViolations[0]).toContain('Invalid CSS identifier');
    });
  });

  describe('Convenience Functions', () => {
    it('should provide quick validation function', () => {
      const schema = z.number().positive();

      const validResult = validate(schema, 5);
      expect(validResult.isValid).toBe(true);

      const invalidResult = validate(schema, -5);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should accept context in convenience function', () => {
      const schema = z.string().email();
      const context = {
        operation: 'email_validation',
        category: ErrorCategory.USER_INPUT,
      };

      const result = validate(schema, 'invalid-email', context);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].context.operation).toBe('email_validation');
    });
  });
});
