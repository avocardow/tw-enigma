/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import {
  CssSyntaxValidator,
  PostCssParser,
  createCssSyntaxValidator,
  createPostCssParser,
  validateCss,
  validateTailwindPattern,
  type CssSyntaxValidatorConfig,
  type CssValidationError,
  type ValidationRule,
} from '../../src/css/syntaxValidator';
import { ErrorSeverity } from '../../src/errors';

describe('CssSyntaxValidator', () => {
  let validator: CssSyntaxValidator;
  let defaultConfig: CssSyntaxValidatorConfig;

  beforeEach(() => {
    defaultConfig = {
      enablePostCssValidation: true,
      enableStylelintValidation: false, // Disable for tests to avoid external dependencies
      enableTailwindValidation: true,
      failFast: false,
      includeSuggestions: true,
      maxErrorsPerFile: 100,
      postCssPlugins: [],
      customRules: [],
    };
    validator = new CssSyntaxValidator(defaultConfig);
  });

  describe('Constructor and Configuration', () => {
    test('should create validator with default config', () => {
      const defaultValidator = new CssSyntaxValidator();
      const config = defaultValidator.getConfig();

      expect(config.enablePostCssValidation).toBe(true);
      expect(config.enableTailwindValidation).toBe(true);
      expect(config.failFast).toBe(false);
      expect(config.includeSuggestions).toBe(true);
      expect(config.maxErrorsPerFile).toBe(100);
    });

    test('should create validator with custom config', () => {
      const customConfig = {
        enablePostCssValidation: false,
        failFast: true,
        maxErrorsPerFile: 50,
      };
      const customValidator = new CssSyntaxValidator(customConfig);
      const config = customValidator.getConfig();

      expect(config.enablePostCssValidation).toBe(false);
      expect(config.failFast).toBe(true);
      expect(config.maxErrorsPerFile).toBe(50);
    });

    test('should update config after creation', () => {
      validator.updateConfig({ failFast: true, maxErrorsPerFile: 25 });
      const config = validator.getConfig();

      expect(config.failFast).toBe(true);
      expect(config.maxErrorsPerFile).toBe(25);
    });
  });

  describe('CSS Syntax Validation', () => {
    test('should validate correct CSS', async () => {
      const validCss = `
        .test {
          color: red;
          background: blue;
        }

        .another {
          margin: 10px;
          padding: 5px;
        }
      `;

      const result = await validator.validateCss(validCss);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.totalErrors).toBe(0);
      expect(result.metrics.linesValidated).toBeGreaterThan(0);
    });

    test('should detect syntax errors', async () => {
      const invalidCss = `
        .test {
          color: red
          background: blue;
        }

        .missing-brace {
          margin: 10px;
      `;

      const result = await validator.validateCss(invalidCss);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.summary.syntaxErrors).toBeGreaterThan(0);
    });

    test('should detect invalid property values', async () => {
      const invalidValueCss = `
        .test {
          color: invalidcolor;
          margin: notanumber;
          display: wrongvalue;
        }
      `;

      const result = await validator.validateCss(invalidValueCss);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should detect at least one semantic error
      expect(result.summary.semanticErrors).toBeGreaterThan(0);
    });

    test('should handle empty CSS', async () => {
      const result = await validator.validateCss('');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metrics.linesValidated).toBe(0);
    });

    test('should handle CSS with comments', async () => {
      const cssWithComments = `
        /* This is a comment */
        .test {
          /* Another comment */
          color: red; /* Inline comment */
        }
      `;

      const result = await validator.validateCss(cssWithComments);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should include file path in errors when provided', async () => {
      const invalidCss = `.test { color: }`;
      const filePath = 'test.css';

      const result = await validator.validateCss(invalidCss, filePath);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]?.filePath).toBe(filePath);
    });

    test('should respect maxErrorsPerFile config', async () => {
      validator.updateConfig({ maxErrorsPerFile: 2 });

      const manyErrorsCss = `
        .test1 { color: }
        .test2 { margin: }
        .test3 { padding: }
        .test4 { background: }
      `;

      const result = await validator.validateCss(manyErrorsCss);

      expect(result.errors.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Tailwind Pattern Validation', () => {
    test('should validate correct Tailwind classes', () => {
      const validClasses = [
        'text-red-500',
        'bg-blue-600',
        'p-4',
        'm-2',
        'flex',
        'justify-center',
        'items-center',
        'w-full',
        'h-screen',
      ];

      validClasses.forEach((className) => {
        const errors = validator.validateTailwindPattern(className);
        expect(errors).toHaveLength(0);
      });
    });

    test('should detect invalid Tailwind classes', () => {
      const invalidClasses = [
        'invalid-class-name',
        'text-nonexistent-color',
        'bg-999',
        'unknown-utility',
        'p-invalid-size',
      ];

      invalidClasses.forEach((className) => {
        const errors = validator.validateTailwindPattern(className);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].type).toBe('tailwind');
      });
    });

    test('should provide suggestions for similar classes', () => {
      const errors = validator.validateTailwindPattern('tex-red-500'); // typo in 'text'

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].suggestions).toBeDefined();
      expect(errors[0].suggestions?.some((s) => s.includes('text-red-500'))).toBe(true);
    });

    test('should handle multiple space-separated classes', () => {
      const multipleClasses = 'flex justify-center invalid-class items-center';
      const errors = validator.validateTailwindPattern(multipleClasses);

      // Should find exactly one error (invalid-class)
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('invalid-class');
    });
  });

  describe('@apply Directive Validation', () => {
    test('should validate correct @apply directives', () => {
      const availableClasses = new Set(['text-red-500', 'bg-blue-600', 'p-4']);
      const validDirective = '@apply text-red-500 bg-blue-600;';

      const errors = validator.validateApplyDirective(validDirective, availableClasses);

      expect(errors).toHaveLength(0);
    });

    test('should detect unavailable classes in @apply', () => {
      const availableClasses = new Set(['text-red-500']);
      const invalidDirective = '@apply text-red-500 unavailable-class;';

      const errors = validator.validateApplyDirective(invalidDirective, availableClasses);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('apply-directive');
    });

    test('should handle malformed @apply directives', () => {
      const malformedDirectives = [
        '@apply', // no classes
        '@apply ;', // empty
        'apply text-red-500;', // missing @
        '@apply text-red-500', // missing semicolon
      ];

      malformedDirectives.forEach((directive) => {
        const errors = validator.validateApplyDirective(directive);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    test('should provide suggestions for mistyped classes in @apply', () => {
      const availableClasses = new Set(['text-red-500', 'bg-blue-600']);
      const typoDirective = '@apply tex-red-500;'; // typo in 'text'

      const errors = validator.validateApplyDirective(typoDirective, availableClasses);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].suggestions).toBeDefined();
      expect(errors[0].suggestions?.some((s) => s.includes('text-red-500'))).toBe(true);
    });
  });

  describe('Custom Validation Rules', () => {
    test('should add and execute custom rules', async () => {
      const customRule: ValidationRule = {
        name: 'no-red-colors',
        description: 'Disallow red colors',
        severity: ErrorSeverity.MEDIUM,
        enabled: true,
        validate: (css: string) => {
          const errors: CssValidationError[] = [];
          if (css.includes('red')) {
            errors.push({
              type: 'custom',
              severity: ErrorSeverity.MEDIUM,
              message: 'Red colors are not allowed',
              code: 'NO_RED_COLORS',
            });
          }
          return errors;
        },
      };

      validator.addCustomRule(customRule);

      const cssWithRed = '.test { color: red; }';
      const result = await validator.validateCss(cssWithRed);

      expect(result.errors.some((e) => e.code === 'NO_RED_COLORS')).toBe(true);
    });

    test('should skip disabled custom rules', async () => {
      const disabledRule: ValidationRule = {
        name: 'disabled-rule',
        description: 'This rule is disabled',
        severity: ErrorSeverity.LOW,
        enabled: false,
        validate: () => [
          {
            type: 'custom',
            severity: ErrorSeverity.LOW,
            message: 'This should not appear',
            code: 'DISABLED_RULE',
          },
        ],
      };

      validator.addCustomRule(disabledRule);

      const result = await validator.validateCss('.test { color: red; }');

      expect(result.errors.some((e) => e.code === 'DISABLED_RULE')).toBe(false);
    });
  });

  describe('Error Reporting and Context', () => {
    test('should include line and column information', async () => {
      const cssWithError = `
.test {
  color: red;
  background: ;
}`;

      const result = await validator.validateCss(cssWithError);

      expect(result.isValid).toBe(false);
      const error = result.errors[0];
      expect(error?.line).toBeGreaterThan(0);
      expect(error?.column).toBeGreaterThan(0);
    });

    test('should categorize errors correctly', async () => {
      const mixedErrorsCss = `
        .syntax-error {
          color: red
        }

        .semantic-error {
          color: invalidcolor;
        }
      `;

      const result = await validator.validateCss(mixedErrorsCss);

      expect(result.summary.syntaxErrors).toBeGreaterThan(0);
      expect(result.summary.semanticErrors).toBeGreaterThan(0);
    });

    test('should include performance metrics', async () => {
      const css = '.test { color: red; }';
      const result = await validator.validateCss(css);

      expect(result.metrics.validationTime).toBeGreaterThan(0);
      expect(result.metrics.linesValidated).toBeGreaterThan(0);
      expect(result.metrics.filesProcessed).toBe(1);
    });

    test('should provide source context for errors', async () => {
      const cssWithError = '.test { color: }';
      const result = await validator.validateCss(cssWithError);

      expect(result.isValid).toBe(false);
      const error = result.errors[0];
      expect(error?.source).toBeDefined();
      expect(error?.context).toBeDefined();
    });
  });

  describe('Fail Fast Mode', () => {
    test('should stop on first critical error when failFast is enabled', async () => {
      validator.updateConfig({ failFast: true });

      const multipleErrorsCss = `
        .error1 { color: }
        .error2 { margin: }
        .error3 { padding: }
      `;

      const result = await validator.validateCss(multipleErrorsCss);

      // Should stop after first critical error
      expect(result.errors.length).toBe(1);
    });
  });

  describe('Suggestions System', () => {
    test('should include suggestions when enabled', async () => {
      validator.updateConfig({ includeSuggestions: true });

      const cssWithError = '.test { colr: red; }'; // typo in 'color'
      const result = await validator.validateCss(cssWithError);

      expect(result.isValid).toBe(false);
      const error = result.errors[0];
      expect(error?.suggestions).toBeDefined();
      expect(error?.suggestions?.length).toBeGreaterThan(0);
    });

    test('should exclude suggestions when disabled', async () => {
      validator.updateConfig({ includeSuggestions: false });

      const cssWithError = '.test { colr: red; }';
      const result = await validator.validateCss(cssWithError);

      expect(result.isValid).toBe(false);
      const error = result.errors[0];
      expect(error?.suggestions).toBeUndefined();
    });
  });
});

describe('PostCssParser', () => {
  let parser: PostCssParser;

  beforeEach(() => {
    parser = new PostCssParser();
  });

  describe('Syntax Validation', () => {
    test('should validate correct CSS syntax', async () => {
      const validCss = '.test { color: red; }';
      const errors = await parser.validateSyntax(validCss);

      expect(errors).toHaveLength(0);
    });

    test('should detect syntax errors', async () => {
      const invalidCss = '.test { color: red }'; // missing semicolon
      const errors = await parser.validateSyntax(invalidCss);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe('syntax');
    });

    test('should parse CSS to AST', async () => {
      const css = '.test { color: red; }';
      const ast = await parser.parseToAst(css);

      expect(ast).toBeDefined();
      expect(ast.type).toBe('root');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed CSS gracefully', async () => {
      const malformedCss = '{ { { invalid css } } }';
      const errors = await parser.validateSyntax(malformedCss);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe(ErrorSeverity.HIGH);
    });

    test('should provide line and column information for errors', async () => {
      const cssWithError = `
.test {
  color: red
}`;

      const errors = await parser.validateSyntax(cssWithError);

      expect(errors.length).toBeGreaterThan(0);
      const error = errors[0];
      expect(error.line).toBeGreaterThan(0);
      expect(error.column).toBeGreaterThan(0);
    });
  });
});

describe('Factory Functions', () => {
  test('createCssSyntaxValidator should create validator with config', () => {
    const config = { failFast: true, maxErrorsPerFile: 25 };
    const validator = createCssSyntaxValidator(config);

    expect(validator).toBeInstanceOf(CssSyntaxValidator);
    expect(validator.getConfig().failFast).toBe(true);
    expect(validator.getConfig().maxErrorsPerFile).toBe(25);
  });

  test('createPostCssParser should create parser with plugins', () => {
    const plugins = ['autoprefixer', 'cssnano'];
    const parser = createPostCssParser(plugins);

    expect(parser).toBeInstanceOf(PostCssParser);
  });

  test('validateCss convenience function should work', async () => {
    const css = '.test { color: red; }';
    const result = await validateCss(css);

    expect(result).toBeDefined();
    expect(result.isValid).toBe(true);
  });

  test('validateTailwindPattern convenience function should work', () => {
    const validPattern = 'text-red-500';
    const errors = validateTailwindPattern(validPattern);

    expect(errors).toHaveLength(0);

    const invalidPattern = 'invalid-pattern';
    const invalidErrors = validateTailwindPattern(invalidPattern);

    expect(invalidErrors.length).toBeGreaterThan(0);
  });
});

describe('Integration Tests', () => {
  test('should work with real-world CSS', async () => {
    const realWorldCss = `
      /* Component styles */
      .button {
        @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600;
        transition: background-color 0.2s ease;
      }

      .card {
        @apply bg-white shadow-lg rounded-lg overflow-hidden;
      }

      .card-header {
        @apply p-6 border-b border-gray-200;
      }

      .card-content {
        @apply p-6;
      }

      @media (max-width: 768px) {
        .button {
          @apply text-sm px-3 py-1;
        }
      }
    `;

    const validator = createCssSyntaxValidator();
    const result = await validator.validateCss(realWorldCss);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metrics.linesValidated).toBeGreaterThan(0);
  });

  test('should handle CSS with modern features', async () => {
    const modernCss = `
      .grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
      }

      .flex-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
      }

      .custom-properties {
        --primary-color: #3b82f6;
        --secondary-color: #64748b;
        color: var(--primary-color);
        background: var(--secondary-color);
      }
    `;

    const validator = createCssSyntaxValidator();
    const result = await validator.validateCss(modernCss);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
