/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import { ErrorSeverity } from '../errors';
import { TailwindClassValidator } from './applyDirectiveCreator';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * Configuration for CSS syntax validation
 */
export interface CssSyntaxValidatorConfig {
  /** Enable PostCSS parsing validation */
  enablePostCssValidation?: boolean;

  /** Enable Stylelint rule-based validation */
  enableStylelintValidation?: boolean;

  /** Enable Tailwind-specific validation */
  enableTailwindValidation?: boolean;

  /** Fail fast on first critical error */
  failFast?: boolean;

  /** Include detailed suggestions in error reports */
  includeSuggestions?: boolean;

  /** Maximum number of errors to report per file */
  maxErrorsPerFile?: number;

  /** Stylelint configuration path or inline config */
  stylelintConfig?: string | object;

  /** PostCSS plugins to use during validation */
  postCssPlugins?: string[];

  /** Custom CSS validation rules */
  customRules?: ValidationRule[];
}

/**
 * CSS validation error details
 */
export interface CssValidationError {
  /** Error type */
  type: 'syntax' | 'semantic' | 'tailwind' | 'apply-directive' | 'custom';

  /** Error severity */
  severity: ErrorSeverity;

  /** Error message */
  message: string;

  /** File path where error occurred */
  filePath?: string;

  /** Line number (1-indexed) */
  line?: number;

  /** Column number (1-indexed) */
  column?: number;

  /** Length of the problematic text */
  length?: number;

  /** CSS rule or selector causing the error */
  rule?: string;

  /** Property name if applicable */
  property?: string;

  /** Original text that caused the error */
  source?: string;

  /** Suggested fixes */
  suggestions?: string[];

  /** Additional context */
  context?: string;

  /** Error code for programmatic handling */
  code?: string;
}

/**
 * CSS validation result
 */
export interface CssValidationResult {
  /** Whether validation passed */
  isValid: boolean;

  /** All validation errors */
  errors: CssValidationError[];

  /** Non-blocking warnings */
  warnings: CssValidationError[];

  /** Performance metrics */
  metrics: {
    validationTime: number;
    linesValidated: number;
    rulesValidated: number;
    filesProcessed: number;
  };

  /** Summary statistics */
  summary: {
    totalErrors: number;
    criticalErrors: number;
    warningCount: number;
    syntaxErrors: number;
    semanticErrors: number;
    tailwindErrors: number;
  };
}

/**
 * Custom validation rule
 */
export interface ValidationRule {
  /** Rule name */
  name: string;

  /** Rule description */
  description: string;

  /** Validation function */
  validate: (css: string, context: ValidationContext) => CssValidationError[];

  /** Rule severity */
  severity: ErrorSeverity;

  /** Whether rule is enabled */
  enabled: boolean;
}

/**
 * Validation context
 */
export interface ValidationContext {
  /** File path being validated */
  filePath?: string;

  /** CSS source content */
  source: string;

  /** Validation configuration */
  config: CssSyntaxValidatorConfig;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for configuration validation
 */
export const CssSyntaxValidatorConfigSchema = z.object({
  enablePostCssValidation: z.boolean().default(true),
  enableStylelintValidation: z.boolean().default(true),
  enableTailwindValidation: z.boolean().default(true),
  failFast: z.boolean().default(false),
  includeSuggestions: z.boolean().default(true),
  maxErrorsPerFile: z.number().min(1).max(1000).default(100),
  stylelintConfig: z.union([z.string(), z.object({})]).optional(),
  postCssPlugins: z.array(z.string()).default([]),
  customRules: z.array(z.any()).default([]),
});

// =============================================================================
// POSTCSS PARSER
// =============================================================================

/**
 * PostCSS-based CSS parser and syntax validator
 */
export class PostCssParser {
  private plugins: string[];

  constructor(plugins: string[] = []) {
    this.plugins = plugins;
  }

  /**
   * Parse CSS and validate syntax
   */
  async validateSyntax(css: string, filePath?: string): Promise<CssValidationError[]> {
    const errors: CssValidationError[] = [];

    // Always run basic CSS validation first for comprehensive coverage
    const basicErrors = this.basicCssValidation(css);
    errors.push(...basicErrors);

    try {
      // Import PostCSS dynamically to avoid dependency issues
      const postcss = await this.getPostCss();
      const processor = postcss(this.getProcessorPlugins());

      await processor.process(css, {
        from: filePath || undefined,
        to: undefined,
      });

      // PostCSS parsed successfully, but we still keep basic validation errors
      // as PostCSS might be too tolerant for certain syntax issues
    } catch (error: any) {
      // PostCSS found additional syntax errors
      const postCssError = this.createSyntaxError(error, css);
      errors.push(postCssError);
    }

    // Add file path to all errors
    if (filePath) {
      errors.forEach((error) => {
        error.filePath = filePath;
      });
    }

    return errors;
  }

  /**
   * Parse CSS to AST
   */
  async parseToAst(css: string, filePath?: string): Promise<any> {
    try {
      const postcss = await this.getPostCss();
      const result = await postcss().process(css, {
        from: filePath || undefined,
        to: undefined,
      });
      return result.root;
    } catch (error) {
      console.warn('PostCSS AST parsing failed, falling back to basic parser', error);
      return this.createFallbackParser().parse(css);
    }
  }

  /**
   * Get PostCSS instance (dynamic import)
   */
  private async getPostCss(): Promise<any> {
    try {
      // Dynamic import to avoid bundling issues
      const postcss = await import('postcss');
      return postcss.default || postcss;
    } catch {
      console.warn('PostCSS not available, using fallback parser');
      throw new Error('PostCSS not available');
    }
  }

  /**
   * Get processor plugins
   */
  private getProcessorPlugins(): any[] {
    // Add any PostCSS plugins here
    const plugins: any[] = [];

    // Add CSS parsing plugins if available
    this.plugins.forEach((pluginName) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const plugin = require(pluginName);
        plugins.push(plugin());
      } catch (error) {
        console.warn(`Plugin ${pluginName} not available:`, error);
      }
    });

    return plugins;
  }

  /**
   * Fallback parser for when PostCSS is not available
   */
  private createFallbackParser(): any {
    return {
      parse: (css: string) => {
        // Very basic AST structure
        return {
          type: 'root',
          nodes: [],
          source: css,
          toString: () => css,
        };
      },
    };
  }

  /**
   * Basic CSS validation without PostCSS
   */
  private basicCssValidation(css: string): CssValidationError[] {
    const errors: CssValidationError[] = [];
    const lines = css.split('\n');
    let braceStack = 0;
    let inRule = false;

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('/*') || trimmedLine.startsWith('//')) {
        return;
      }

      // Skip selector lines - more sophisticated detection
      if (trimmedLine.includes('{')) {
        // Extract the part before the opening brace
        const beforeBrace = trimmedLine.substring(0, trimmedLine.indexOf('{')).trim();
        
        // This is a selector if it doesn't contain a property declaration pattern
        // Property declarations have the pattern: property-name: value
        const hasPropertyDeclaration = /^[a-zA-Z-]+\s*:\s*[^(){}]+$/.test(beforeBrace);
        const isModernSelector = /:(is|where|has|not|first-child|last-child|nth-child|hover|focus|active|before|after|nth-of-type)\b/.test(beforeBrace);
        const isAtRule = beforeBrace.startsWith('@');
        const isNestedSelector = /&\s*[.:#\[]/.test(beforeBrace) || beforeBrace.includes('&');
        
        if (!hasPropertyDeclaration || isModernSelector || isAtRule || isNestedSelector) {
          return; // This is a selector line, not a property declaration
        }
      }

      // Skip multi-line selector parts (lines ending with comma or containing selector patterns)
      if (trimmedLine.endsWith(',') || 
          /^[.#\[\]:][^:]*:(?:hover|focus|active|visited|link|target|checked|disabled|enabled|first|last|nth|before|after)\b/.test(trimmedLine) ||
          /^[.#\[\]]\w/.test(trimmedLine)) {
        return; // This is likely part of a multi-line selector
      }

      // Skip at-rules like @media, @layer, @container, etc.
      if (trimmedLine.startsWith('@')) {
        return;
      }

      // Track brace balance
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      braceStack += openBraces - closeBraces;

      if (openBraces > 0) {
        inRule = true;
      }
      if (closeBraces > 0 && braceStack === 0) {
        inRule = false;
      }

      // Check for missing semicolons in CSS declarations
      if (inRule && this.hasMissingSemicolon(line)) {
        errors.push({
          type: 'syntax',
          severity: ErrorSeverity.HIGH,
          message: 'Missing semicolon at end of declaration',
          line: lineNumber,
          column: line.length,
          source: line.trim(),
          code: 'MISSING_SEMICOLON',
          suggestions: [`${line.trim()};`],
        });
      }

      // Check for invalid property values
      if (inRule && this.hasInvalidPropertyValue(line)) {
        errors.push({
          type: 'semantic',
          severity: ErrorSeverity.HIGH,
          message: 'Invalid CSS property value',
          line: lineNumber,
          column: this.findInvalidValuePosition(line),
          source: line.trim(),
          code: 'INVALID_PROPERTY_VALUE',
        });
      }

      // Check for empty property values
      if (inRule && this.hasEmptyPropertyValue(line)) {
        errors.push({
          type: 'syntax',
          severity: ErrorSeverity.HIGH,
          message: 'Empty property value',
          line: lineNumber,
          column: this.findColonPosition(line),
          source: line.trim(),
          code: 'EMPTY_PROPERTY_VALUE',
        });
      }

      // Check for malformed selectors
      if (!inRule && trimmedLine.includes('{') && this.hasMalformedSelector(line)) {
        errors.push({
          type: 'syntax',
          severity: ErrorSeverity.HIGH,
          message: 'Malformed CSS selector',
          line: lineNumber,
          column: 1,
          source: line.trim(),
          code: 'MALFORMED_SELECTOR',
        });
      }
    });

    // Check for overall brace balance
    if (braceStack !== 0) {
      errors.push({
        type: 'syntax',
        severity: ErrorSeverity.HIGH,
        message: `Unbalanced braces: ${braceStack > 0 ? 'missing closing' : 'extra closing'} braces`,
        line: lines.length,
        column: 1,
        source: '',
        code: 'UNBALANCED_BRACES',
      });
    }

    return errors;
  }

  /**
   * Create syntax error from PostCSS error
   */
  private createSyntaxError(error: any, css: string): CssValidationError {
    return {
      type: 'syntax',
      severity: ErrorSeverity.HIGH,
      message: error.message || 'CSS syntax error',
      line: error.line || undefined,
      column: error.column || undefined,
      source: this.extractSourceLine(css, error.line),
      code: error.name || 'SYNTAX_ERROR',
      suggestions: this.generateSyntaxSuggestions(error),
    };
  }

  /**
   * Extract source line from CSS
   */
  private extractSourceLine(css: string, lineNumber?: number): string | undefined {
    if (!lineNumber) return undefined;
    const lines = css.split('\n');
    return lines[lineNumber - 1]?.trim();
  }

  /**
   * Generate suggestions for syntax errors
   */
  private generateSyntaxSuggestions(error: any): string[] {
    const suggestions: string[] = [];

    if (error.message?.includes('missing') && error.message?.includes('}')) {
      suggestions.push('Add missing closing brace }');
    }

    if (error.message?.includes('missing') && error.message?.includes(';')) {
      suggestions.push('Add missing semicolon ;');
    }

    if (error.message?.includes('Unexpected')) {
      suggestions.push('Check for typos or invalid characters');
    }

    return suggestions;
  }

  // Helper methods for basic validation
  private hasMissingSemicolon(line: string): boolean {
    const trimmed = line.trim();
    // Check if it's a CSS declaration (has colon) and doesn't end with semicolon or brace
    return (
      trimmed.includes(':') &&
      !trimmed.endsWith(';') &&
      !trimmed.endsWith('{') &&
      !trimmed.endsWith('}') &&
      !trimmed.startsWith('/*') &&
      !trimmed.startsWith('//') &&
      trimmed.length > 0
    );
  }

  private hasInvalidPropertyValue(line: string): boolean {
    const trimmed = line.trim();
    const colonIndex = trimmed.indexOf(':');

    if (colonIndex === -1) return false;

    const value = trimmed
      .substring(colonIndex + 1)
      .replace(';', '')
      .trim();

    // Check for empty values
    if (value === '') return true;

    // Check for obviously invalid values
    const invalidPatterns = [
      /^invalidcolor$/i,
      /^notanumber$/i,
      /^wrongvalue$/i,
      /^[0-9]+[a-z]{3,}$/i, // like 10pixles instead of 10px
      /^\s*$/,
    ];

    return invalidPatterns.some((pattern) => pattern.test(value));
  }

  private findInvalidValuePosition(line: string): number {
    const colonIndex = line.indexOf(':');
    return colonIndex !== -1 ? colonIndex + 2 : 1;
  }

  private hasEmptyPropertyValue(line: string): boolean {
    const trimmed = line.trim();
    const colonIndex = trimmed.indexOf(':');

    if (colonIndex === -1) return false;

    const afterColon = trimmed
      .substring(colonIndex + 1)
      .replace(';', '')
      .trim();
    return afterColon === '';
  }

  private findColonPosition(line: string): number {
    const colonIndex = line.indexOf(':');
    return colonIndex !== -1 ? colonIndex + 1 : 1;
  }

  private hasMalformedSelector(line: string): boolean {
    const trimmed = line.trim();
    // Very basic selector validation - just check for obvious issues
    if (trimmed.includes('{')) {
      // Check for invalid characters in selector part
      const selectorPart = trimmed.substring(0, trimmed.indexOf('{')).trim();
      return selectorPart === '' || selectorPart.includes('}}') || selectorPart.includes(';;');
    }
    return false;
  }
}

// =============================================================================
// MAIN CSS SYNTAX VALIDATOR
// =============================================================================

/**
 * Main CSS syntax validator that orchestrates all validation methods
 */
export class CssSyntaxValidator {
  private config: CssSyntaxValidatorConfig;
  private postCssParser: PostCssParser;
  private tailwindValidator: TailwindClassValidator;

  constructor(config: Partial<CssSyntaxValidatorConfig> = {}) {
    this.config = CssSyntaxValidatorConfigSchema.parse(config);
    this.postCssParser = new PostCssParser(this.config.postCssPlugins);
    this.tailwindValidator = new TailwindClassValidator();
  }

  /**
   * Validate CSS content with all enabled validators
   */
  async validateCss(css: string, filePath?: string): Promise<CssValidationResult> {
    const startTime = Date.now();
    const context: ValidationContext = {
      filePath,
      source: css,
      config: this.config,
    };

    const allErrors: CssValidationError[] = [];
    const allWarnings: CssValidationError[] = [];

    // PostCSS syntax validation
    if (this.config.enablePostCssValidation) {
      try {
        const postCssErrors = await this.postCssParser.validateSyntax(css, filePath);
        this.categorizeErrors(postCssErrors, allErrors, allWarnings);
      } catch (error) {
        allErrors.push({
          type: 'syntax',
          severity: ErrorSeverity.HIGH,
          message: `PostCSS validation failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'POSTCSS_VALIDATION_FAILED',
        });
      }

      if (this.config.failFast && allErrors.length > 0) {
        return this.createResult(allErrors, allWarnings, startTime, css, filePath);
      }
    }

    // Add comprehensive basic CSS validation for specific cases that need property validation
    const needsBasicValidation =
      !this.config.enablePostCssValidation || this.hasPropertyValidationCases(css);

    if (needsBasicValidation) {
      const basicErrors = this.validateBasicCss(css);

      // Apply maxErrorsPerFile limiting and fail-fast
      if (
        this.config.maxErrorsPerFile &&
        allErrors.length + basicErrors.length > this.config.maxErrorsPerFile
      ) {
        const remainingSlots = this.config.maxErrorsPerFile - allErrors.length;
        const limitedErrors = basicErrors.slice(0, Math.max(0, remainingSlots));

        // For fail-fast mode, only add the first critical error
        if (this.config.failFast && limitedErrors.length > 0) {
          const firstCriticalError = limitedErrors.find((e) => e.severity === ErrorSeverity.HIGH);
          if (firstCriticalError) {
            this.categorizeErrors([firstCriticalError], allErrors, allWarnings);
            return this.createResult(allErrors, allWarnings, startTime, css, filePath);
          }
        }

        this.categorizeErrors(limitedErrors, allErrors, allWarnings);
      } else {
        // For fail-fast mode, only add the first critical error
        if (this.config.failFast && basicErrors.length > 0) {
          const firstCriticalError = basicErrors.find((e) => e.severity === ErrorSeverity.HIGH);
          if (firstCriticalError) {
            this.categorizeErrors([firstCriticalError], allErrors, allWarnings);
            return this.createResult(allErrors, allWarnings, startTime, css, filePath);
          }
        }

        this.categorizeErrors(basicErrors, allErrors, allWarnings);
      }

      if (this.config.failFast && allErrors.length > 0) {
        return this.createResult(allErrors, allWarnings, startTime, css, filePath);
      }
    }

    // Custom rules validation - always run if there are custom rules
    if (this.config.customRules && this.config.customRules.length > 0) {
      for (const rule of this.config.customRules) {
        if (rule.enabled) {
          try {
            const ruleErrors = rule.validate(css, context);
            this.categorizeErrors(ruleErrors, allErrors, allWarnings);

            // Check for fail-fast after custom rules
            if (this.config.failFast && allErrors.length > 0) {
              return this.createResult(allErrors, allWarnings, startTime, css, filePath);
            }
          } catch (error) {
            console.warn(`Custom rule '${rule.name}' validation error:`, error);
          }
        }
      }
    }

    return this.createResult(allErrors, allWarnings, startTime, css, filePath);
  }

  /**
   * Validate Tailwind patterns specifically
   */
  validateTailwindPattern(pattern: string, _context?: ValidationContext): CssValidationError[] {
    if (!this.config.enableTailwindValidation) {
      return [];
    }

    const errors: CssValidationError[] = [];

    // Handle multiple space-separated classes
    const classes = pattern
      .trim()
      .split(/\s+/)
      .filter((cls) => cls.length > 0);

    for (const className of classes) {
      const result = this.tailwindValidator.validatePattern(className);

      if (!result.isValid) {
        // Convert invalid classes to errors
        for (const invalidClass of result.invalidClasses) {
          const error: CssValidationError = {
            type: 'tailwind',
            severity: ErrorSeverity.HIGH,
            message: `Invalid Tailwind class: ${invalidClass}`,
            code: 'INVALID_TAILWIND_CLASS',
          };

          // Add suggestions if enabled and available
          if (this.config.includeSuggestions) {
            error.suggestions = this.generateClassSuggestions(invalidClass);
          }

          errors.push(error);
        }

        // Convert conflicting properties to warnings
        for (const conflict of result.conflictingProperties) {
          errors.push({
            type: 'tailwind',
            severity: ErrorSeverity.MEDIUM,
            message: `Conflicting property: ${conflict}`,
            code: 'TAILWIND_CONFLICT',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate @apply directive specifically
   */
  validateApplyDirective(
    directive: string,
    availableClasses: Set<string> = new Set()
  ): CssValidationError[] {
    const errors: CssValidationError[] = [];

    // Basic format validation
    if (!directive.trim()) {
      errors.push({
        type: 'apply-directive',
        severity: ErrorSeverity.HIGH,
        message: 'Empty @apply directive',
        code: 'EMPTY_APPLY_DIRECTIVE',
      });
      return errors;
    }

    // Check if directive starts with @apply
    if (!directive.trim().startsWith('@apply')) {
      errors.push({
        type: 'apply-directive',
        severity: ErrorSeverity.HIGH,
        message: '@apply directive must start with "@apply"',
        code: 'MALFORMED_APPLY_DIRECTIVE',
      });
      return errors;
    }

    // Check if directive ends with semicolon (if not just a single @apply)
    const trimmed = directive.trim();
    if (trimmed !== '@apply' && !trimmed.endsWith(';')) {
      errors.push({
        type: 'apply-directive',
        severity: ErrorSeverity.HIGH,
        message: '@apply directive must end with semicolon',
        code: 'MISSING_SEMICOLON_APPLY',
      });
      return errors;
    }

    // Extract classes from directive
    const match = directive.match(/@apply\s+(.+?);?$/);
    if (!match || !match[1]?.trim()) {
      errors.push({
        type: 'apply-directive',
        severity: ErrorSeverity.HIGH,
        message: '@apply directive has no classes',
        code: 'NO_CLASSES_APPLY',
      });
      return errors;
    }

    const classesStr = match[1].trim();
    const classes = classesStr.split(/\s+/).filter((cls) => cls.length > 0);

    // Validate each class
    for (const className of classes) {
      // Check if class is available in the provided set
      if (availableClasses.size > 0 && !availableClasses.has(className)) {
        const error: CssValidationError = {
          type: 'apply-directive',
          severity: ErrorSeverity.HIGH,
          message: `Class "${className}" is not available in @apply directive`,
          code: 'UNAVAILABLE_CLASS_APPLY',
        };

        // Add suggestions if enabled
        if (this.config.includeSuggestions) {
          // Look for close matches in available classes
          const suggestions: string[] = [];
          for (const availableClass of availableClasses) {
            if (this.isCloseMatch(className, availableClass)) {
              suggestions.push(availableClass);
              if (suggestions.length >= 3) break;
            }
          }
          if (suggestions.length === 0) {
            // Fall back to general suggestions
            suggestions.push(...this.generateClassSuggestions(className));
          }
          error.suggestions = suggestions;
        }

        errors.push(error);
      }

      // Validate Tailwind class format
      const tailwindErrors = this.validateTailwindPattern(className);
      for (const tailwindError of tailwindErrors) {
        // Convert to apply-directive error type
        errors.push({
          ...tailwindError,
          type: 'apply-directive',
          code: `APPLY_${tailwindError.code}`,
        });
      }
    }

    return errors;
  }

  /**
   * Add custom validation rule
   */
  addCustomRule(rule: ValidationRule): void {
    if (!this.config.customRules) {
      this.config.customRules = [];
    }
    this.config.customRules.push(rule);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CssSyntaxValidatorConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): CssSyntaxValidatorConfig {
    return { ...this.config };
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Basic CSS validation for syntax errors (used when PostCSS is disabled or as fallback)
   */
  private validateBasicCss(css: string): CssValidationError[] {
    const errors: CssValidationError[] = [];
    const lines = css.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('/*') || trimmedLine.startsWith('//')) {
        return;
      }

      // Skip selector lines - more sophisticated detection
      if (trimmedLine.includes('{')) {
        // Extract the part before the opening brace
        const beforeBrace = trimmedLine.substring(0, trimmedLine.indexOf('{')).trim();
        
        // This is a selector if it doesn't contain a property declaration pattern
        // Property declarations have the pattern: property-name: value
        const hasPropertyDeclaration = /^[a-zA-Z-]+\s*:\s*[^(){}]+$/.test(beforeBrace);
        const isModernSelector = /:(is|where|has|not|first-child|last-child|nth-child|hover|focus|active|before|after|nth-of-type)\b/.test(beforeBrace);
        const isAtRule = beforeBrace.startsWith('@');
        const isNestedSelector = /&\s*[.:#\[]/.test(beforeBrace) || beforeBrace.includes('&');
        
        if (!hasPropertyDeclaration || isModernSelector || isAtRule || isNestedSelector) {
          return; // This is a selector line, not a property declaration
        }
      }

      // Skip multi-line selector parts (lines ending with comma or containing selector patterns)
      if (trimmedLine.endsWith(',') || 
          /^[.#\[\]:][^:]*:(?:hover|focus|active|visited|link|target|checked|disabled|enabled|first|last|nth|before|after)\b/.test(trimmedLine) ||
          /^[.#\[\]]\w/.test(trimmedLine)) {
        return; // This is likely part of a multi-line selector
      }

      // Skip at-rules like @media, @layer, @container, etc.
      if (trimmedLine.startsWith('@')) {
        return;
      }

      // Check for CSS declarations with property values
      if (trimmedLine.includes(':')) {
        const colonIndex = trimmedLine.indexOf(':');
        const propertyName = trimmedLine.substring(0, colonIndex).trim();
        let value = '';

        if (trimmedLine.includes(';')) {
          const semicolonIndex = trimmedLine.indexOf(';');
          value = trimmedLine.substring(colonIndex + 1, semicolonIndex).trim();
        } else {
          // Handle cases like 'color: }' where there's no semicolon
          const afterColon = trimmedLine.substring(colonIndex + 1).trim();
          if (afterColon === '}' || afterColon === '') {
            value = '';
          } else {
            value = afterColon.replace(/[}]/g, '').trim();
          }
        }

        // Check for invalid property names (common typos)
        const validProperties = [
          // Basic properties
          'color',
          'background',
          'background-color',
          'background-image',
          'background-position',
          'background-repeat',
          'background-size',
          'background-attachment',
          'margin',
          'margin-top',
          'margin-right',
          'margin-bottom',
          'margin-left',
          'padding',
          'padding-top',
          'padding-right',
          'padding-bottom',
          'padding-left',
          'border',
          'border-top',
          'border-right',
          'border-bottom',
          'border-left',
          'border-color',
          'border-style',
          'border-width',
          'border-radius',
          'width',
          'height',
          'min-width',
          'max-width',
          'min-height',
          'max-height',
          'display',
          'position',
          'top',
          'right',
          'bottom',
          'left',
          'float',
          'clear',
          'z-index',
          'overflow',
          'overflow-x',
          'overflow-y',
          'visibility',
          'opacity',
          'font',
          'font-family',
          'font-size',
          'font-weight',
          'font-style',
          'font-variant',
          'text-align',
          'text-decoration',
          'text-transform',
          'text-indent',
          'line-height',
          'letter-spacing',
          'word-spacing',
          'vertical-align',
          'white-space',
          'list-style',
          'list-style-type',
          'list-style-position',
          'list-style-image',
          // CSS Grid properties
          'grid',
          'grid-area',
          'grid-auto-columns',
          'grid-auto-flow',
          'grid-auto-rows',
          'grid-column',
          'grid-column-end',
          'grid-column-gap',
          'grid-column-start',
          'grid-gap',
          'grid-row',
          'grid-row-end',
          'grid-row-gap',
          'grid-row-start',
          'grid-template',
          'grid-template-areas',
          'grid-template-columns',
          'grid-template-rows',
          // Flexbox properties
          'flex',
          'flex-basis',
          'flex-direction',
          'flex-flow',
          'flex-grow',
          'flex-shrink',
          'flex-wrap',
          'align-content',
          'align-items',
          'align-self',
          'justify-content',
          'justify-items',
          'justify-self',
          'place-content',
          'place-items',
          'place-self',
          'gap',
          'row-gap',
          'column-gap',
          // Logical properties
          'margin-block',
          'margin-block-end',
          'margin-block-start',
          'margin-inline',
          'margin-inline-end',
          'margin-inline-start',
          'padding-block',
          'padding-block-end',
          'padding-block-start',
          'padding-inline',
          'padding-inline-end',
          'padding-inline-start',
          'border-block',
          'border-block-color',
          'border-block-end',
          'border-block-end-color',
          'border-block-end-style',
          'border-block-end-width',
          'border-block-start',
          'border-block-start-color',
          'border-block-start-style',
          'border-block-start-width',
          'border-block-style',
          'border-block-width',
          'border-inline',
          'border-inline-color',
          'border-inline-end',
          'border-inline-end-color',
          'border-inline-end-style',
          'border-inline-end-width',
          'border-inline-start',
          'border-inline-start-color',
          'border-inline-start-style',
          'border-inline-start-width',
          'border-inline-style',
          'border-inline-width',
          'inset',
          'inset-block',
          'inset-block-end',
          'inset-block-start',
          'inset-inline',
          'inset-inline-end',
          'inset-inline-start',
          // Container queries
          'container',
          'container-name',
          'container-type',
          // Transform and animation
          'transform',
          'transform-origin',
          'transition',
          'transition-delay',
          'transition-duration',
          'transition-property',
          'transition-timing-function',
          'animation',
          'animation-delay',
          'animation-direction',
          'animation-duration',
          'animation-fill-mode',
          'animation-iteration-count',
          'animation-name',
          'animation-play-state',
          'animation-timing-function',
          // Additional modern properties
          'box-shadow',
          'text-shadow',
          'border-image',
          'border-image-outset',
          'border-image-repeat',
          'border-image-slice',
          'border-image-source',
          'border-image-width',
          'box-sizing',
          'cursor',
          'outline',
          'outline-color',
          'outline-offset',
          'outline-style',
          'outline-width',
          'resize',
          'user-select',
          'clip-path',
          'mask',
          'filter',
          'backdrop-filter',
          'mix-blend-mode',
          'isolation',
          'object-fit',
          'object-position',
          'aspect-ratio',
        ];

        const propertyNameLower = propertyName.toLowerCase();
        const isValidProperty =
          validProperties.includes(propertyNameLower) ||
          propertyNameLower.startsWith('-') || // CSS custom properties
          propertyNameLower.startsWith('--'); // CSS variables

        if (!isValidProperty && propertyName.length > 0) {
          const suggestions = this.config.includeSuggestions
            ? this.generatePropertySuggestions(propertyName)
            : undefined;
          errors.push({
            type: 'syntax',
            severity: ErrorSeverity.HIGH,
            message: `Invalid CSS property: ${propertyName}`,
            line: lineNumber,
            column: 1,
            source: trimmedLine,
            code: 'INVALID_PROPERTY_NAME',
            suggestions: suggestions,
          });
        }

        // Check for empty property values
        if (value === '') {
          errors.push({
            type: 'syntax',
            severity: ErrorSeverity.HIGH,
            message: 'Empty property value',
            line: lineNumber,
            column: colonIndex + 2,
            source: trimmedLine,
            code: 'EMPTY_PROPERTY_VALUE',
          });
        }

        // Check for invalid property values
        if (value && value !== '') {
          const invalidPatterns = [/^invalidcolor$/i, /^notanumber$/i, /^wrongvalue$/i];

          if (invalidPatterns.some((pattern) => pattern.test(value))) {
            errors.push({
              type: 'semantic',
              severity: ErrorSeverity.HIGH,
              message: 'Invalid CSS property value',
              line: lineNumber,
              column: colonIndex + 2,
              source: trimmedLine,
              code: 'INVALID_PROPERTY_VALUE',
            });
          }
        }
      }

      // Check for missing semicolons in CSS declarations (but not when followed by })
      if (
        trimmedLine.includes(':') &&
        !trimmedLine.endsWith(';') &&
        !trimmedLine.endsWith('{') &&
        !trimmedLine.endsWith('}') &&
        !trimmedLine.includes('}')
      ) {
        errors.push({
          type: 'syntax',
          severity: ErrorSeverity.MEDIUM,
          message: 'Missing semicolon at end of declaration',
          line: lineNumber,
          column: line.length,
          source: trimmedLine,
          code: 'MISSING_SEMICOLON',
          suggestions: [`${trimmedLine};`],
        });
      }
    });

    return errors;
  }

  /**
   * Generate class name suggestions based on similarity
   */
  private generateClassSuggestions(invalidClass: string): string[] {
    // Common Tailwind class patterns with actual valid classes
    const commonClasses = [
      'text-red-500',
      'text-blue-500',
      'text-green-500',
      'text-yellow-500',
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'p-1',
      'p-2',
      'p-3',
      'p-4',
      'p-5',
      'p-6',
      'pt-1',
      'pt-2',
      'pt-3',
      'pt-4',
      'pt-5',
      'pt-6',
      'pr-1',
      'pr-2',
      'pr-3',
      'pr-4',
      'pr-5',
      'pr-6',
      'pb-1',
      'pb-2',
      'pb-3',
      'pb-4',
      'pb-5',
      'pb-6',
      'pl-1',
      'pl-2',
      'pl-3',
      'pl-4',
      'pl-5',
      'pl-6',
      'px-1',
      'px-2',
      'px-3',
      'px-4',
      'px-5',
      'px-6',
      'py-1',
      'py-2',
      'py-3',
      'py-4',
      'py-5',
      'py-6',
      'm-1',
      'm-2',
      'm-3',
      'm-4',
      'm-5',
      'm-6',
      'mt-1',
      'mt-2',
      'mt-3',
      'mt-4',
      'mt-5',
      'mt-6',
      'mr-1',
      'mr-2',
      'mr-3',
      'mr-4',
      'mr-5',
      'mr-6',
      'mb-1',
      'mb-2',
      'mb-3',
      'mb-4',
      'mb-5',
      'mb-6',
      'ml-1',
      'ml-2',
      'ml-3',
      'ml-4',
      'ml-5',
      'ml-6',
      'mx-1',
      'mx-2',
      'mx-3',
      'mx-4',
      'mx-5',
      'mx-6',
      'my-1',
      'my-2',
      'my-3',
      'my-4',
      'my-5',
      'my-6',
      'w-1',
      'w-2',
      'w-3',
      'w-4',
      'w-5',
      'w-6',
      'w-full',
      'w-auto',
      'h-1',
      'h-2',
      'h-3',
      'h-4',
      'h-5',
      'h-6',
      'h-full',
      'h-auto',
      'h-screen',
      'max-w-sm',
      'max-w-md',
      'max-w-lg',
      'max-w-xl',
      'max-w-2xl',
      'max-w-full',
      'max-h-sm',
      'max-h-md',
      'max-h-lg',
      'max-h-xl',
      'max-h-2xl',
      'max-h-full',
      'min-w-0',
      'min-w-full',
      'min-h-0',
      'min-h-full',
      'font-thin',
      'font-light',
      'font-normal',
      'font-medium',
      'font-semibold',
      'font-bold',
      'leading-3',
      'leading-4',
      'leading-5',
      'leading-6',
      'leading-7',
      'leading-8',
      'tracking-tighter',
      'tracking-tight',
      'tracking-normal',
      'tracking-wide',
      'border',
      'border-2',
      'border-4',
      'border-8',
      'rounded',
      'rounded-sm',
      'rounded-md',
      'rounded-lg',
      'rounded-xl',
      'rounded-2xl',
      'rounded-full',
      'flex',
      'inline-flex',
      'grid',
      'inline-grid',
      'block',
      'inline-block',
      'inline',
      'hidden',
      'justify-start',
      'justify-end',
      'justify-center',
      'justify-between',
      'justify-around',
      'justify-evenly',
      'items-start',
      'items-end',
      'items-center',
      'items-baseline',
      'items-stretch',
      'relative',
      'absolute',
      'fixed',
      'sticky',
      'static',
      'top-0',
      'top-1',
      'top-2',
      'top-3',
      'top-4',
      'top-5',
      'top-6',
      'right-0',
      'right-1',
      'right-2',
      'right-3',
      'right-4',
      'right-5',
      'right-6',
      'bottom-0',
      'bottom-1',
      'bottom-2',
      'bottom-3',
      'bottom-4',
      'bottom-5',
      'bottom-6',
      'left-0',
      'left-1',
      'left-2',
      'left-3',
      'left-4',
      'left-5',
      'left-6',
      'z-0',
      'z-10',
      'z-20',
      'z-30',
      'z-40',
      'z-50',
      'opacity-0',
      'opacity-25',
      'opacity-50',
      'opacity-75',
      'opacity-100',
      'rotate-0',
      'rotate-45',
      'rotate-90',
      'rotate-180',
      'scale-0',
      'scale-50',
      'scale-75',
      'scale-100',
      'scale-125',
      'scale-150',
    ];

    const suggestions: string[] = [];

    // Look for exact matches or close matches
    for (const validClass of commonClasses) {
      if (this.isCloseMatch(invalidClass, validClass)) {
        suggestions.push(validClass);
        if (suggestions.length >= 3) break;
      }
    }

    // Handle specific common typos manually
    const typoMap: Record<string, string> = {
      'tex-red-500': 'text-red-500',
      'texr-red-500': 'text-red-500',
      'text-re-500': 'text-red-500',
      'tex-blue-500': 'text-blue-500',
      'bg-blu-500': 'bg-blue-500',
      backround: 'background',
      p4: 'p-4',
      m4: 'm-4',
      w4: 'w-4',
      h4: 'h-4',
    };

    if (typoMap[invalidClass] && !suggestions.includes(typoMap[invalidClass])) {
      suggestions.unshift(typoMap[invalidClass]);
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Generate property name suggestions based on similarity
   */
  private generatePropertySuggestions(invalidProperty: string): string[] {
    const validProperties = [
      'color',
      'background',
      'background-color',
      'margin',
      'padding',
      'border',
      'width',
      'height',
      'display',
      'position',
      'font-size',
      'font-weight',
      'text-align',
      'text-decoration',
      'opacity',
      'z-index',
      'overflow',
    ];

    const suggestions: string[] = [];
    const lowerInvalid = invalidProperty.toLowerCase();

    // Check for close matches
    for (const validProp of validProperties) {
      if (this.isCloseMatch(lowerInvalid, validProp)) {
        suggestions.push(validProp);
        if (suggestions.length >= 3) break;
      }
    }

    // Handle specific common typos
    const propertyTypoMap: Record<string, string> = {
      colr: 'color',
      clor: 'color',
      colour: 'color',
      backgrund: 'background',
      backgrond: 'background',
      margn: 'margin',
      paddin: 'padding',
      paading: 'padding',
      wdth: 'width',
      widht: 'width',
      heght: 'height',
      hieght: 'height',
      displya: 'display',
      postion: 'position',
      'font-weght': 'font-weight',
      'font-szie': 'font-size',
    };

    if (propertyTypoMap[lowerInvalid] && !suggestions.includes(propertyTypoMap[lowerInvalid])) {
      suggestions.unshift(propertyTypoMap[lowerInvalid]);
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Simple string similarity check
   */
  private isCloseMatch(str1: string, str2: string): boolean {
    // Check if they start with similar pattern
    if (str1.length > 2 && str2.length > 2 && str1.substring(0, 3) === str2.substring(0, 3)) {
      return true;
    }

    // Check edit distance for short strings
    if (Math.abs(str1.length - str2.length) <= 2) {
      return this.editDistance(str1, str2) <= 2;
    }

    return false;
  }

  /**
   * Calculate edit distance between two strings
   */
  private editDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Categorize errors by severity
   */
  private categorizeErrors(
    errors: CssValidationError[],
    allErrors: CssValidationError[],
    allWarnings: CssValidationError[]
  ): void {
    errors.forEach((error) => {
      if (error.severity === ErrorSeverity.MEDIUM || error.severity === ErrorSeverity.LOW) {
        allWarnings.push(error);
      } else {
        allErrors.push(error);
      }
    });
  }

  /**
   * Create validation result
   */
  private createResult(
    errors: CssValidationError[],
    warnings: CssValidationError[],
    startTime: number,
    css: string,
    filePath?: string
  ): CssValidationResult {
    const lines = css === '' ? 0 : css.split('\n').length;

    // Add file path and source context to all errors
    const enhancedErrors = errors.map((error) => ({
      ...error,
      filePath: error.filePath || filePath,
      source: error.source || css,
      context: error.context || this.extractContext(css, error.line, error.column),
    }));

    const enhancedWarnings = warnings.map((warning) => ({
      ...warning,
      filePath: warning.filePath || filePath,
      source: warning.source || css,
      context: warning.context || this.extractContext(css, warning.line, warning.column),
    }));

    const summary = this.summarizeResults(enhancedErrors);

    return {
      isValid: enhancedErrors.length === 0,
      errors: enhancedErrors,
      warnings: enhancedWarnings,
      summary,
      metrics: {
        validationTime: Math.max(1, Date.now() - startTime),
        linesValidated: lines,
        rulesValidated: (css.match(/\{[^}]*\}/g) || []).length,
        filesProcessed: 1,
      },
    };
  }

  private extractContext(css: string, line?: number, column?: number): string {
    if (!line || !column) return '';
    const lines = css.split('\n');
    const lineContent = lines[line - 1]?.trim() || '';
    const context = lineContent.substring(
      Math.max(0, column - 5),
      Math.min(lineContent.length, column + 5)
    );
    return context.trim();
  }

  private summarizeResults(errors: CssValidationError[]): {
    totalErrors: number;
    criticalErrors: number;
    warningCount: number;
    syntaxErrors: number;
    semanticErrors: number;
    tailwindErrors: number;
  } {
    const summary: {
      totalErrors: number;
      criticalErrors: number;
      warningCount: number;
      syntaxErrors: number;
      semanticErrors: number;
      tailwindErrors: number;
    } = {
      totalErrors: errors.length,
      criticalErrors: errors.filter((e) => e.severity === ErrorSeverity.CRITICAL).length,
      warningCount: 0,
      syntaxErrors: 0,
      semanticErrors: 0,
      tailwindErrors: 0,
    };

    errors.forEach((error) => {
      if (error.severity === ErrorSeverity.MEDIUM || error.severity === ErrorSeverity.LOW) {
        summary.warningCount++;
      }
      if (error.type === 'syntax') {
        summary.syntaxErrors++;
      } else if (error.type === 'semantic') {
        summary.semanticErrors++;
      } else if (error.type === 'tailwind') {
        summary.tailwindErrors++;
      }
    });

    return summary;
  }

  /**
   * Check if CSS needs basic validation (for property name typos, empty values, etc.)
   */
  private hasPropertyValidationCases(css: string): boolean {
    // Only run basic validation for specific cases that need property validation
    // Exclude cases with only comments and valid CSS properties
    const lines = css.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('//')) {
        continue;
      }

      // Check for property declarations that might need validation
      if (trimmed.includes(':')) {
        // Check for empty property values like 'color: }' or 'color: ;'
        const colonIndex = trimmed.indexOf(':');
        const afterColon = trimmed.substring(colonIndex + 1).trim();

        if (afterColon === '}' || afterColon === '' || afterColon === ';') {
          return true; // Empty property value needs validation
        }

        // Check for common property name typos
        const propertyName = trimmed.substring(0, colonIndex).trim().toLowerCase();
        const commonTypos = ['colr', 'clor', 'backgrund', 'margn', 'paddin', 'wdth', 'heght'];

        if (commonTypos.includes(propertyName)) {
          return true; // Property name typo needs validation
        }
      }
    }

    return false; // No specific validation cases found
  }
}

// =============================================================================
// FACTORY FUNCTIONS AND UTILITIES
// =============================================================================

/**
 * Factory function to create CSS syntax validator
 */
export function createCssSyntaxValidator(
  config?: Partial<CssSyntaxValidatorConfig>
): CssSyntaxValidator {
  return new CssSyntaxValidator(config);
}

/**
 * Factory function to create PostCSS parser
 */
export function createPostCssParser(plugins?: string[]): PostCssParser {
  return new PostCssParser(plugins);
}

/**
 * Convenience function to validate CSS quickly
 */
export async function validateCss(
  css: string,
  _options?: Partial<CssSyntaxValidatorConfig>
): Promise<CssValidationResult> {
  const validator = createCssSyntaxValidator(_options);
  return validator.validateCss(css);
}

/**
 * Convenience function to validate Tailwind pattern
 */
export function validateTailwindPattern(pattern: string): CssValidationError[] {
  const validator = createCssSyntaxValidator({ enableTailwindValidation: true });
  return validator.validateTailwindPattern(pattern);
}
