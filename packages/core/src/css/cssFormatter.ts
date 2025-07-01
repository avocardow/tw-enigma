/**
 * CSS Formatter - Configurable CSS formatting with AST-based processing
 *
 * Provides flexible CSS formatting options while maintaining CSS validity
 * and integrating with existing TW-Enigma CSS generation systems.
 */

import postcss from 'postcss';
import { CssValidationError } from './syntaxValidator';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Spacing configuration for CSS formatting
 */
export interface CssSpacingRules {
  /** Add space before colon in property declarations */
  beforeColon: boolean;
  /** Add space after colon in property declarations */
  afterColon: boolean;
  /** Add space before opening brace */
  beforeBrace: boolean;
  /** Add space after opening brace */
  afterBrace: boolean;
  /** Add space before semicolon */
  beforeSemicolon: boolean;
}

/**
 * Property ordering strategies for CSS rules
 */
export type PropertyOrderStrategy =
  | 'alphabetical' // A-Z ordering
  | 'grouped' // Logical grouping (layout, typography, etc.)
  | 'smacss' // SMACSS methodology ordering
  | 'custom'; // User-defined order

/**
 * Output format options for generated CSS
 */
export type CssOutputFormat =
  | 'compact' // Minified, single-line format
  | 'pretty' // Human-readable with proper indentation
  | 'readable'; // Pretty format with semantic comments

/**
 * CSS naming convention enforcement
 */
export type NamingConvention =
  | 'bem' // Block-Element-Modifier
  | 'smacss' // Scalable and Modular Architecture
  | 'none'; // No convention enforcement

/**
 * Comprehensive CSS formatter configuration
 */
export interface CssFormatterConfig {
  // Indentation Options
  /** Indentation style: spaces or tabs */
  indentStyle: 'spaces' | 'tabs';
  /** Number of spaces/tabs for indentation */
  indentSize: number;

  // Spacing Configuration
  /** Detailed spacing rules for various CSS constructs */
  spacingRules: CssSpacingRules;

  // Property Ordering
  /** Strategy for ordering CSS properties within rules */
  propertyOrder: PropertyOrderStrategy;
  /** Custom property order (required when propertyOrder is 'custom') */
  customOrder?: string[];

  // Output Format
  /** Overall output format style */
  outputFormat: CssOutputFormat;
  /** Include explanatory comments in output */
  includeComments: boolean;

  // Convention Support
  /** Enable naming convention enforcement */
  enforceConventions: boolean;
  /** Naming convention to enforce */
  namingConvention: NamingConvention;

  // Line Break Options
  /** Placement of opening braces */
  braceStyle: 'same-line' | 'new-line';
  /** Property formatting within rules */
  propertiesPerLine: 'single' | 'multiple';

  // Advanced Options
  /** Preserve existing comments */
  preserveComments: boolean;
  /** Maximum line length before wrapping */
  maxLineLength: number;
  /** Sort selectors alphabetically */
  sortSelectors: boolean;
  /** Group related rules together */
  groupRelatedRules: boolean;
}

/**
 * Formatting result with statistics and errors
 */
export interface CssFormattingResult {
  /** Formatted CSS output */
  css: string;
  /** Original CSS input */
  originalCss: string;
  /** Formatting statistics */
  stats: {
    /** Number of rules processed */
    rulesProcessed: number;
    /** Number of properties formatted */
    propertiesFormatted: number;
    /** Number of selectors processed */
    selectorsProcessed: number;
    /** Original CSS size in bytes */
    originalSize: number;
    /** Formatted CSS size in bytes */
    formattedSize: number;
    /** Size change percentage */
    sizeChange: number;
    /** Processing time in milliseconds */
    processingTime: number;
  };
  /** Any formatting warnings or errors */
  errors: CssValidationError[];
  /** Whether formatting was successful */
  success: boolean;
}

// ============================================================================
// Property Ordering Configurations
// ============================================================================

/**
 * SMACSS-based property ordering groups
 */
const SMACSS_PROPERTY_ORDER = [
  // Base/Box Model
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'float',
  'clear',
  'flex',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-content',
  'grid',
  'grid-template',
  'grid-area',

  // Layout/Dimensions
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
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

  // Border/Background
  'border',
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  'background',
  'background-color',
  'background-image',
  'background-position',
  'background-size',
  'background-repeat',
  'box-shadow',

  // Typography
  'font',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'color',

  // Visual Effects
  'opacity',
  'visibility',
  'transform',
  'transition',
  'animation',
  'filter',
  'backdrop-filter',

  // Interaction/Misc
  'cursor',
  'pointer-events',
  'user-select',
  'overflow',
  'overflow-x',
  'overflow-y',
];

/**
 * Logical grouping of CSS properties
 */
const GROUPED_PROPERTY_ORDER = {
  layout: ['display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear'],
  flexbox: [
    'flex',
    'flex-direction',
    'flex-wrap',
    'justify-content',
    'align-items',
    'align-content',
  ],
  grid: [
    'grid',
    'grid-template',
    'grid-template-rows',
    'grid-template-columns',
    'grid-area',
    'grid-gap',
  ],
  dimensions: ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'],
  spacing: [
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
  ],
  borders: ['border', 'border-width', 'border-style', 'border-color', 'border-radius'],
  background: [
    'background',
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
  ],
  typography: [
    'font',
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'line-height',
    'letter-spacing',
    'text-align',
    'text-decoration',
    'text-transform',
    'color',
  ],
  visual: ['opacity', 'visibility', 'box-shadow', 'filter', 'backdrop-filter'],
  transforms: ['transform', 'transition', 'animation'],
  interaction: ['cursor', 'pointer-events', 'user-select'],
  overflow: ['overflow', 'overflow-x', 'overflow-y'],
};

// ============================================================================
// CSS Formatter Implementation
// ============================================================================

/**
 * Main CSS formatter class with PostCSS AST-based processing
 */
export class CssFormatter {
  private config: CssFormatterConfig;
  private processor: postcss.Processor;

  constructor(config: Partial<CssFormatterConfig> = {}) {
    this.config = this.createDefaultConfig(config);
    this.processor = postcss();
  }

  /**
   * Format CSS according to configured rules
   */
  async formatCss(css: string, filePath?: string): Promise<CssFormattingResult> {
    const startTime = Date.now();
    const originalSize = Buffer.byteLength(css, 'utf8');
    const errors: CssValidationError[] = [];

    try {
      // Parse CSS into AST
      const root = postcss.parse(css);

      // Apply formatting transformations
      await this.applyFormatting(root);

      // Convert back to CSS string
      let formattedCss: string;

      if (this.config.outputFormat === 'compact') {
        // For compact output, remove all unnecessary whitespace
        formattedCss = root.toString().replace(/\s+/g, ' ').replace(/;\s*}/g, ';}').trim();
      } else {
        // For pretty/readable output, use standard PostCSS formatting
        formattedCss = root.toString();

        // Apply custom spacing rules
        if (this.config.spacingRules.afterColon && !formattedCss.includes(': ')) {
          formattedCss = formattedCss.replace(/:/g, ': ');
        }

        // Apply indentation
        if (this.config.outputFormat === 'pretty' || this.config.outputFormat === 'readable') {
          const indent = this.getIndent();
          const lines = formattedCss.split('\n');
          const indentedLines = lines.map((line, index) => {
            if (index === 0 || line.trim() === '' || line.startsWith('}')) return line;
            if (line.trim().endsWith('{') || line.includes('@')) return line;
            return indent + line;
          });
          formattedCss = indentedLines.join('\n');
        }
      }

      const endTime = Date.now();
      const formattedSize = Buffer.byteLength(formattedCss, 'utf8');

      // Calculate statistics
      const stats = this.calculateStats(root, originalSize, formattedSize, endTime - startTime);

      return {
        css: formattedCss,
        originalCss: css,
        stats,
        errors,
        success: true,
      };
    } catch (error) {
      errors.push({
        type: 'syntax',
        message: `CSS formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        line: 0,
        column: 0,
        filePath,
        severity: 'high',
      });

      return {
        css,
        originalCss: css,
        stats: {
          rulesProcessed: 0,
          propertiesFormatted: 0,
          selectorsProcessed: 0,
          originalSize,
          formattedSize: originalSize,
          sizeChange: 0,
          processingTime: Date.now() - startTime,
        },
        errors,
        success: false,
      };
    }
  }

  /**
   * Apply all formatting transformations to the PostCSS AST
   */
  private async applyFormatting(root: postcss.Root): Promise<void> {
    // 1. Sort and organize rules
    if (this.config.sortSelectors || this.config.groupRelatedRules) {
      this.organizeRules(root);
    }

    // 2. Process each rule
    root.walkRules((rule) => {
      this.formatRule(rule);
    });

    // 3. Process at-rules (@media, @apply, etc.)
    root.walkAtRules((atRule) => {
      this.formatAtRule(atRule);
    });

    // 4. Add semantic comments if requested
    if (this.config.includeComments && this.config.outputFormat === 'readable') {
      this.addSemanticComments(root);
    }

    // 5. Handle comments
    if (!this.config.preserveComments) {
      root.walkComments((comment) => {
        if (!this.isSemanticComment(comment)) {
          comment.remove();
        }
      });
    }
  }

  /**
   * Format individual CSS rule
   */
  private formatRule(rule: postcss.Rule): void {
    // Format selectors
    if (this.config.sortSelectors) {
      rule.selector = this.formatSelectors(rule.selector);
    }

    // Validate naming conventions
    if (this.config.enforceConventions) {
      this.validateNamingConvention(rule);
    }

    // Format properties
    this.formatProperties(rule);
  }

  /**
   * Format CSS properties within a rule
   */
  private formatProperties(rule: postcss.Rule): void {
    const declarations: postcss.Declaration[] = [];

    // Collect all declarations
    rule.walkDecls((decl) => {
      declarations.push(decl);
    });

    // Sort properties according to configured strategy
    const sortedDeclarations = this.sortProperties(declarations);

    // Remove existing declarations
    declarations.forEach((decl) => decl.remove());

    // Add sorted declarations back
    sortedDeclarations.forEach((decl) => {
      rule.append(decl);
    });
  }

  /**
   * Sort properties according to configured strategy
   */
  private sortProperties(declarations: postcss.Declaration[]): postcss.Declaration[] {
    switch (this.config.propertyOrder) {
      case 'alphabetical':
        return declarations.sort((a, b) => a.prop.localeCompare(b.prop));

      case 'smacss':
        return this.sortBySMACCS(declarations);

      case 'grouped':
        return this.sortByGroups(declarations);

      case 'custom':
        return this.sortByCustomOrder(declarations);

      default:
        return declarations;
    }
  }

  /**
   * Sort properties using SMACSS methodology
   */
  private sortBySMACCS(declarations: postcss.Declaration[]): postcss.Declaration[] {
    return declarations.sort((a, b) => {
      const indexA = SMACSS_PROPERTY_ORDER.indexOf(a.prop);
      const indexB = SMACSS_PROPERTY_ORDER.indexOf(b.prop);

      // Properties not in the list go to the end
      if (indexA === -1 && indexB === -1) {
        return a.prop.localeCompare(b.prop);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });
  }

  /**
   * Sort properties by logical groups
   */
  private sortByGroups(declarations: postcss.Declaration[]): postcss.Declaration[] {
    const groups = Object.keys(GROUPED_PROPERTY_ORDER);

    return declarations.sort((a, b) => {
      const groupA = this.findPropertyGroup(a.prop);
      const groupB = this.findPropertyGroup(b.prop);

      const groupIndexA = groups.indexOf(groupA);
      const groupIndexB = groups.indexOf(groupB);

      if (groupIndexA !== groupIndexB) {
        return groupIndexA - groupIndexB;
      }

      // Within the same group, sort alphabetically
      return a.prop.localeCompare(b.prop);
    });
  }

  /**
   * Sort properties using custom order
   */
  private sortByCustomOrder(declarations: postcss.Declaration[]): postcss.Declaration[] {
    const customOrder = this.config.customOrder || [];

    return declarations.sort((a, b) => {
      const indexA = customOrder.indexOf(a.prop);
      const indexB = customOrder.indexOf(b.prop);

      if (indexA === -1 && indexB === -1) {
        return a.prop.localeCompare(b.prop);
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;

      return indexA - indexB;
    });
  }

  /**
   * Find which group a property belongs to
   */
  private findPropertyGroup(property: string): string {
    for (const [group, properties] of Object.entries(GROUPED_PROPERTY_ORDER)) {
      if (properties.includes(property)) {
        return group;
      }
    }
    return 'misc';
  }

  /**
   * Format selectors within a rule
   */
  private formatSelectors(selector: string): string {
    const selectors = selector.split(',').map((s) => s.trim());

    if (this.config.sortSelectors) {
      selectors.sort();
    }

    return selectors.join(', ');
  }

  /**
   * Validate naming conventions for selectors
   */
  private validateNamingConvention(rule: postcss.Rule): void {
    const selectors = rule.selector.split(',').map((s) => s.trim());

    selectors.forEach((selector) => {
      switch (this.config.namingConvention) {
        case 'bem':
          this.validateBEMNaming(selector);
          break;
        case 'smacss':
          this.validateSMACSSNaming(selector);
          break;
      }
    });
  }

  /**
   * Validate BEM naming convention
   */
  private validateBEMNaming(selector: string): boolean {
    // BEM pattern: .block__element--modifier
    const bemPattern = /^\.?[a-z][a-z0-9]*(__[a-z][a-z0-9]*)?(--[a-z][a-z0-9]*)?$/;

    // Extract class names from selector
    const classNames = selector.match(/\.[a-zA-Z0-9_-]+/g) || [];

    return classNames.every((className) => {
      const cleanClassName = className.substring(1); // Remove the dot
      return bemPattern.test(cleanClassName);
    });
  }

  /**
   * Validate SMACSS naming convention
   */
  private validateSMACSSNaming(selector: string): boolean {
    // SMACSS patterns: .l- (layout), .m- (module), .s- (state), .t- (theme)
    const smacssPatterns = [
      /^\.l-[a-z][a-z0-9-]*$/, // Layout
      /^\.m-[a-z][a-z0-9-]*$/, // Module
      /^\.s-[a-z][a-z0-9-]*$/, // State
      /^\.t-[a-z][a-z0-9-]*$/, // Theme
      /^\.is-[a-z][a-z0-9-]*$/, // State
      /^\.has-[a-z][a-z0-9-]*$/, // State
    ];

    const classNames = selector.match(/\.[a-zA-Z0-9_-]+/g) || [];

    return classNames.every((className) => {
      return smacssPatterns.some((pattern) => pattern.test(className));
    });
  }

  /**
   * Format at-rules (@media, @apply, etc.)
   */
  private formatAtRule(atRule: postcss.AtRule): void {
    // Handle @apply directives specially
    if (atRule.name === 'apply') {
      this.formatApplyDirective(atRule);
    }

    // Handle media queries
    if (atRule.name === 'media') {
      this.formatMediaQuery(atRule);
    }
  }

  /**
   * Format @apply directives
   */
  private formatApplyDirective(atRule: postcss.AtRule): void {
    if (atRule.params) {
      // Clean up and format the class list
      const classes = atRule.params.split(/\s+/).filter(Boolean);
      atRule.params = classes.join(' ');
    }
  }

  /**
   * Format media queries
   */
  private formatMediaQuery(atRule: postcss.AtRule): void {
    if (atRule.params) {
      // Normalize media query formatting
      atRule.params = atRule.params.replace(/\s+/g, ' ').trim();
    }
  }

  /**
   * Organize and sort rules within the CSS
   */
  private organizeRules(root: postcss.Root): void {
    if (this.config.groupRelatedRules) {
      // Group related rules together (same base selector)
      this.groupRelatedRules(root);
    }
  }

  /**
   * Group related CSS rules together
   */
  private groupRelatedRules(root: postcss.Root): void {
    const ruleGroups: Map<string, postcss.Rule[]> = new Map();
    const rules: postcss.Rule[] = [];

    // Collect all rules
    root.walkRules((rule) => {
      rules.push(rule);
      const baseSelector = this.getBaseSelector(rule.selector);

      if (!ruleGroups.has(baseSelector)) {
        ruleGroups.set(baseSelector, []);
      }
      ruleGroups.get(baseSelector)!.push(rule);
    });

    // Remove original rules
    rules.forEach((rule) => rule.remove());

    // Add grouped rules back
    ruleGroups.forEach((groupRules, baseSelector) => {
      groupRules.forEach((rule) => {
        root.append(rule);
      });
    });
  }

  /**
   * Extract base selector for grouping
   */
  private getBaseSelector(_selector: string): string {
    return (
      _selector
        .split(/[>+~,]/)
        .pop()
        ?.trim()
        .split(/[.#:]/)
        .shift() || _selector
    );
  }

  /**
   * Add semantic comments to CSS
   */
  private addSemanticComments(root: postcss.Root): void {
    // Add header comment
    const headerComment = postcss.comment({
      text: ' Generated by TW-Enigma CSS Formatter ',
    });
    root.prepend(headerComment);

    // Add section comments for different types of rules
    let hasUtilities = false;
    let hasComponents = false;

    root.walkRules((rule) => {
      if (this.isUtilityClass(rule.selector)) {
        if (!hasUtilities) {
          const utilityComment = postcss.comment({
            text: ' Utility Classes ',
          });
          rule.before(utilityComment);
          hasUtilities = true;
        }
      } else if (!hasComponents) {
        const componentComment = postcss.comment({
          text: ' Component Classes ',
        });
        rule.before(componentComment);
        hasComponents = true;
      }
    });
  }

  /**
   * Check if selector represents a utility class
   */
  private isUtilityClass(selector: string): boolean {
    // Simple heuristic: single class selectors are likely utilities
    return /^\.[a-z-]+$/.test(selector.trim());
  }

  /**
   * Check if comment is a semantic comment added by formatter
   */
  private isSemanticComment(comment: postcss.Comment): boolean {
    const text = comment.text.trim();
    return (
      text.includes('Generated by TW-Enigma') ||
      text.includes('Utility Classes') ||
      text.includes('Component Classes')
    );
  }

  /**
   * Calculate formatting statistics
   */
  private calculateStats(
    root: postcss.Root,
    originalSize: number,
    formattedSize: number,
    processingTime: number
  ): CssFormattingResult['stats'] {
    let rulesProcessed = 0;
    let propertiesFormatted = 0;
    let selectorsProcessed = 0;

    root.walkRules((rule) => {
      rulesProcessed++;
      selectorsProcessed += rule.selector.split(',').length;

      rule.walkDecls(() => {
        propertiesFormatted++;
      });
    });

    const sizeChange = originalSize > 0 ? ((formattedSize - originalSize) / originalSize) * 100 : 0;

    return {
      rulesProcessed,
      propertiesFormatted,
      selectorsProcessed,
      originalSize,
      formattedSize,
      sizeChange: Number(sizeChange.toFixed(2)),
      processingTime,
    };
  }

  /**
   * Get stringification options for PostCSS
   */
  private getStringifyOptions(): object {
    const { config } = this;

    // Use PostCSS's built-in options instead of custom stringifier
    const options: any = {};

    if (config.outputFormat === 'compact') {
      // Minified output
      options.to = undefined;
      options.map = false;
    } else {
      // Pretty or readable output with proper indentation
      options.to = undefined;
      options.map = false;
    }

    return options;
  }

  /**
   * Get indentation string based on configuration
   */
  private getIndent(): string {
    const { indentStyle, indentSize } = this.config;
    const unit = indentStyle === 'tabs' ? '\t' : ' ';
    return unit.repeat(indentSize);
  }

  /**
   * Create default configuration with overrides
   */
  private createDefaultConfig(overrides: Partial<CssFormatterConfig>): CssFormatterConfig {
    const defaults: CssFormatterConfig = {
      indentStyle: 'spaces',
      indentSize: 2,
      spacingRules: {
        beforeColon: false,
        afterColon: true,
        beforeBrace: true,
        afterBrace: false,
        beforeSemicolon: false,
      },
      propertyOrder: 'grouped',
      outputFormat: 'pretty',
      includeComments: false,
      enforceConventions: false,
      namingConvention: 'none',
      braceStyle: 'same-line',
      propertiesPerLine: 'single',
      preserveComments: true,
      maxLineLength: 80,
      sortSelectors: false,
      groupRelatedRules: false,
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Get current formatter configuration
   */
  getConfig(): CssFormatterConfig {
    return { ...this.config };
  }

  /**
   * Update formatter configuration
   */
  updateConfig(updates: Partial<CssFormatterConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CSS formatter with production-optimized settings
 */
export function createProductionFormatter(
  overrides: Partial<CssFormatterConfig> = {}
): CssFormatter {
  const productionConfig: Partial<CssFormatterConfig> = {
    outputFormat: 'compact',
    includeComments: false,
    preserveComments: false,
    propertyOrder: 'grouped',
    enforceConventions: false,
    ...overrides,
  };

  return new CssFormatter(productionConfig);
}

/**
 * Create a CSS formatter with development-optimized settings
 */
export function createDevelopmentFormatter(
  overrides: Partial<CssFormatterConfig> = {}
): CssFormatter {
  const developmentConfig: Partial<CssFormatterConfig> = {
    outputFormat: 'readable',
    includeComments: true,
    preserveComments: true,
    propertyOrder: 'grouped',
    enforceConventions: true,
    namingConvention: 'bem',
    sortSelectors: true,
    groupRelatedRules: true,
    ...overrides,
  };

  return new CssFormatter(developmentConfig);
}

/**
 * Create a CSS formatter with BEM convention settings
 */
export function createBEMFormatter(overrides: Partial<CssFormatterConfig> = {}): CssFormatter {
  const bemConfig: Partial<CssFormatterConfig> = {
    enforceConventions: true,
    namingConvention: 'bem',
    outputFormat: 'pretty',
    propertyOrder: 'grouped',
    sortSelectors: true,
    includeComments: true,
    ...overrides,
  };

  return new CssFormatter(bemConfig);
}

/**
 * Create a CSS formatter with SMACSS convention settings
 */
export function createSMACSSFormatter(overrides: Partial<CssFormatterConfig> = {}): CssFormatter {
  const smacssConfig: Partial<CssFormatterConfig> = {
    enforceConventions: true,
    namingConvention: 'smacss',
    outputFormat: 'pretty',
    propertyOrder: 'smacss',
    groupRelatedRules: true,
    includeComments: true,
    ...overrides,
  };

  return new CssFormatter(smacssConfig);
}

/**
 * Create a minimal CSS formatter for quick formatting
 */
export function createMinimalFormatter(): CssFormatter {
  return new CssFormatter({
    outputFormat: 'pretty',
    includeComments: false,
    enforceConventions: false,
    propertyOrder: 'alphabetical',
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick format CSS with default settings
 */
export async function formatCss(
  css: string,
  config?: Partial<CssFormatterConfig>
): Promise<string> {
  const formatter = new CssFormatter(config);
  const result = await formatter.formatCss(css);
  return result.css;
}

/**
 * Format CSS with detailed results
 */
export async function formatCssDetailed(
  css: string,
  config?: Partial<CssFormatterConfig>
): Promise<CssFormattingResult> {
  const formatter = new CssFormatter(config);
  return formatter.formatCss(css);
}

/**
 * Validate CSS formatting configuration
 */
export function validateFormatterConfig(config: Partial<CssFormatterConfig>): string[] {
  const errors: string[] = [];

  if (config.indentSize !== undefined && (config.indentSize < 1 || config.indentSize > 8)) {
    errors.push('indentSize must be between 1 and 8');
  }

  if (config.maxLineLength !== undefined && config.maxLineLength < 40) {
    errors.push('maxLineLength must be at least 40 characters');
  }

  if (config.propertyOrder === 'custom' && !config.customOrder) {
    errors.push('customOrder is required when propertyOrder is "custom"');
  }

  return errors;
}
