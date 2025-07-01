/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import type { ExtractionResult } from '../optimization/completeConsolidator';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Configuration for @apply directive creation
 */
export interface ApplyDirectiveConfig {
  /** Enable validation of Tailwind classes */
  enableValidation?: boolean;
  /** Output format for CSS */
  outputFormat?: 'compact' | 'pretty' | 'readable';
  /** Include comments in output */
  includeComments?: boolean;
  /** Enable @layer organization */
  enableLayers?: boolean;
  /** Target CSS layer for directives */
  targetLayer?: 'base' | 'components' | 'utilities';
  /** Enable circular reference detection */
  detectCircularRefs?: boolean;
  /** Maximum nesting depth for @apply */
  maxNestingDepth?: number;
}

/**
 * Result of @apply directive creation
 */
export interface ApplyDirectiveResult {
  /** Generated CSS content */
  css: string;
  /** Pattern mappings */
  mappings: Map<string, string>;
  /** Validation warnings */
  warnings: string[];
  /** Validation errors */
  errors: string[];
  /** Generated @apply rules count */
  rulesGenerated: number;
  /** Processing statistics */
  statistics: {
    processingTime: number;
    totalPatterns: number;
    validPatterns: number;
    invalidPatterns: number;
    circularReferences: number;
  };
}

/**
 * Pattern validation result
 */
export interface PatternValidationResult {
  isValid: boolean;
  invalidClasses: string[];
  conflictingProperties: string[];
  circularReferences: string[];
  suggestions: string[];
}

/**
 * CSS formatting options
 */
export interface CssFormattingOptions {
  compact: boolean;
  pretty: boolean;
  readable: boolean;
  indentSize: number;
  includeComments: boolean;
  includeUsageStats: boolean;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const ApplyDirectiveConfigSchema = z.object({
  enableValidation: z.boolean().default(true),
  outputFormat: z.enum(['compact', 'pretty', 'readable']).default('compact'),
  includeComments: z.boolean().default(false),
  enableLayers: z.boolean().default(false),
  targetLayer: z.enum(['base', 'components', 'utilities']).default('components'),
  detectCircularRefs: z.boolean().default(true),
  maxNestingDepth: z.number().min(1).max(10).default(3),
});

// =============================================================================
// TAILWIND CLASS VALIDATION
// =============================================================================

/**
 * Validates Tailwind CSS classes for @apply directive compatibility
 */
export class TailwindClassValidator {
  private validPrefixes: Set<string>;
  private validVariants: Set<string>;
  private invalidForApply: Set<string>;

  constructor() {
    this.validPrefixes = new Set([
      // Layout
      'block',
      'inline',
      'flex',
      'grid',
      'table',
      'hidden',
      'float',
      'clear',
      'object',
      'overflow',
      'position',
      'top',
      'right',
      'bottom',
      'left',
      'inset',
      'visible',
      'invisible',
      'z',

      // Flexbox & Grid
      'basis',
      'direction',
      'wrap',
      'justify',
      'content',
      'items',
      'self',
      'order',
      'grow',
      'shrink',
      'gap',
      'space',
      'place',
      'auto',
      'start',
      'end',
      'center',
      'stretch',
      'between',
      'around',
      'evenly',

      // Spacing
      'm',
      'mx',
      'my',
      'mt',
      'mr',
      'mb',
      'ml',
      'p',
      'px',
      'py',
      'pt',
      'pr',
      'pb',
      'pl',

      // Sizing
      'w',
      'min-w',
      'max-w',
      'h',
      'min-h',
      'max-h',
      'size',

      // Typography
      'font',
      'text',
      'leading',
      'tracking',
      'decoration',
      'transform',
      'indent',
      'align',
      'whitespace',
      'break',
      'hyphens',

      // Backgrounds
      'bg',
      'from',
      'via',
      'to',
      'background',

      // Borders
      'border',
      'divide',
      'outline',
      'ring',

      // Effects
      'shadow',
      'opacity',
      'mix',
      'filter',
      'backdrop',

      // Transforms
      'transform',
      'translate',
      'rotate',
      'skew',
      'scale',
      'origin',

      // Transitions
      'transition',
      'duration',
      'ease',
      'delay',
      'animate',

      // Interactivity
      'cursor',
      'select',
      'resize',
      'scroll',
      'touch',
      'pointer',

      // SVG
      'fill',
      'stroke',

      // Accessibility
      'sr',
      'not-sr',
    ]);

    this.validVariants = new Set([
      // Responsive
      'sm',
      'md',
      'lg',
      'xl',
      '2xl',

      // Dark mode
      'dark',

      // State variants
      'hover',
      'focus',
      'active',
      'visited',
      'target',
      'focus-within',
      'focus-visible',
      'disabled',
      'enabled',
      'checked',
      'indeterminate',
      'default',
      'required',
      'valid',
      'invalid',
      'in-range',
      'out-of-range',
      'placeholder-shown',
      'autofill',
      'read-only',

      // Group states
      'group-hover',
      'group-focus',
      'group-active',
      'group-visited',
      'group-target',
      'group-focus-within',
      'group-focus-visible',
      'group-disabled',
      'group-enabled',
      'group-checked',

      // Peer states
      'peer-hover',
      'peer-focus',
      'peer-active',
      'peer-visited',
      'peer-target',
      'peer-focus-within',
      'peer-focus-visible',
      'peer-disabled',
      'peer-enabled',
      'peer-checked',

      // Position-based
      'first',
      'last',
      'odd',
      'even',
      'first-of-type',
      'last-of-type',
      'only-child',
      'only-of-type',
      'empty',

      // Print
      'print',

      // Motion
      'motion-safe',
      'motion-reduce',

      // Contrast
      'contrast-more',
      'contrast-less',
    ]);

    // Classes that cannot be used in @apply
    this.invalidForApply = new Set([
      'group',
      'peer', // Grouping classes
      'container', // Container class has special behavior
    ]);
  }

  /**
   * Validates a pattern of Tailwind classes
   */
  validatePattern(pattern: string): PatternValidationResult {
    const classes = this.parseClasses(pattern);
    const result: PatternValidationResult = {
      isValid: true,
      invalidClasses: [],
      conflictingProperties: [],
      circularReferences: [],
      suggestions: [],
    };

    for (const className of classes) {
      const validation = this.validateSingleClass(className);
      if (!validation.isValid) {
        result.isValid = false;
        if (validation.reason === 'invalid-class') {
          result.invalidClasses.push(className);
          if (validation.suggestion) {
            result.suggestions.push(`'${className}' -> '${validation.suggestion}'`);
          }
        } else if (validation.reason === 'apply-incompatible') {
          result.invalidClasses.push(className);
        }
      }
    }

    // Check for conflicting properties
    const conflicts = this.detectConflictingProperties(classes);
    result.conflictingProperties = conflicts;
    if (conflicts.length > 0) {
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validates a single Tailwind class
   */
  private validateSingleClass(className: string): {
    isValid: boolean;
    reason?: 'invalid-class' | 'apply-incompatible' | 'variant-issue';
    suggestion?: string;
  } {
    // Handle arbitrary values like text-[14px]
    if (className.includes('[') && className.includes(']')) {
      const baseClass = className.split('[')[0];
      if (this.isValidBaseClass(baseClass)) {
        return { isValid: true };
      }
      return {
        isValid: false,
        reason: 'invalid-class',
        suggestion: this.suggestClass(baseClass),
      };
    }

    // Handle variant classes like hover:bg-blue-500
    if (className.includes(':')) {
      const parts = className.split(':');
      const variant = parts[0];
      const baseClass = parts.slice(1).join(':');

      if (!this.validVariants.has(variant)) {
        return {
          isValid: false,
          reason: 'variant-issue',
          suggestion: this.suggestVariant(variant),
        };
      }

      return this.validateSingleClass(baseClass);
    }

    // Check if class is invalid for @apply
    if (this.invalidForApply.has(className)) {
      return { isValid: false, reason: 'apply-incompatible' };
    }

    // Validate base class
    if (this.isValidBaseClass(className)) {
      return { isValid: true };
    }

    return {
      isValid: false,
      reason: 'invalid-class',
      suggestion: this.suggestClass(className),
    };
  }

  /**
   * Checks if a base class is valid Tailwind
   */
  private isValidBaseClass(className: string): boolean {
    // Handle exact matches for utility classes
    const exactMatches = [
      'block',
      'inline',
      'inline-block',
      'flex',
      'inline-flex',
      'table',
      'inline-table',
      'table-caption',
      'table-cell',
      'table-column',
      'table-column-group',
      'table-footer-group',
      'table-header-group',
      'table-row-group',
      'table-row',
      'flow-root',
      'grid',
      'inline-grid',
      'contents',
      'list-item',
      'hidden',
      'float-right',
      'float-left',
      'float-none',
      'clear-left',
      'clear-right',
      'clear-both',
      'clear-none',
      'isolate',
      'isolation-auto',
      'object-contain',
      'object-cover',
      'object-fill',
      'object-none',
      'object-scale-down',
      'overflow-auto',
      'overflow-hidden',
      'overflow-clip',
      'overflow-visible',
      'overflow-scroll',
      'overflow-x-auto',
      'overflow-x-hidden',
      'overflow-x-clip',
      'overflow-x-visible',
      'overflow-x-scroll',
      'overflow-y-auto',
      'overflow-y-hidden',
      'overflow-y-clip',
      'overflow-y-visible',
      'overflow-y-scroll',
      'overscroll-auto',
      'overscroll-contain',
      'overscroll-none',
      'overscroll-y-auto',
      'overscroll-y-contain',
      'overscroll-y-none',
      'overscroll-x-auto',
      'overscroll-x-contain',
      'overscroll-x-none',
      'static',
      'fixed',
      'absolute',
      'relative',
      'sticky',
      'visible',
      'invisible',
      'collapse',
      'static',
      'fixed',
      'absolute',
      'relative',
      'sticky',
      'justify-normal',
      'justify-start',
      'justify-end',
      'justify-center',
      'justify-between',
      'justify-around',
      'justify-evenly',
      'justify-stretch',
      'justify-items-start',
      'justify-items-end',
      'justify-items-center',
      'justify-items-stretch',
      'justify-self-auto',
      'justify-self-start',
      'justify-self-end',
      'justify-self-center',
      'justify-self-stretch',
      'content-normal',
      'content-center',
      'content-start',
      'content-end',
      'content-between',
      'content-around',
      'content-evenly',
      'content-baseline',
      'content-stretch',
      'items-start',
      'items-end',
      'items-center',
      'items-baseline',
      'items-stretch',
      'self-auto',
      'self-start',
      'self-end',
      'self-center',
      'self-stretch',
      'self-baseline',
      'place-content-center',
      'place-content-start',
      'place-content-end',
      'place-content-between',
      'place-content-around',
      'place-content-evenly',
      'place-content-baseline',
      'place-content-stretch',
      'place-items-start',
      'place-items-end',
      'place-items-center',
      'place-items-baseline',
      'place-items-stretch',
      'place-self-auto',
      'place-self-start',
      'place-self-end',
      'place-self-center',
      'place-self-stretch',
      'italic',
      'not-italic',
      'font-thin',
      'font-extralight',
      'font-light',
      'font-normal',
      'font-medium',
      'font-semibold',
      'font-bold',
      'font-extrabold',
      'font-black',
      'antialiased',
      'subpixel-antialiased',
      'ordinal',
      'slashed-zero',
      'lining-nums',
      'oldstyle-nums',
      'proportional-nums',
      'tabular-nums',
      'diagonal-fractions',
      'stacked-fractions',
      'underline',
      'overline',
      'line-through',
      'no-underline',
      'uppercase',
      'lowercase',
      'capitalize',
      'normal-case',
      'truncate',
      'text-ellipsis',
      'text-clip',
      'text-wrap',
      'text-nowrap',
      'text-balance',
      'text-pretty',
      'break-normal',
      'break-words',
      'break-all',
      'break-keep',
      'cursor-auto',
      'cursor-default',
      'cursor-pointer',
      'cursor-wait',
      'cursor-text',
      'cursor-move',
      'cursor-help',
      'cursor-not-allowed',
      'cursor-none',
      'cursor-context-menu',
      'cursor-progress',
      'cursor-cell',
      'cursor-crosshair',
      'cursor-vertical-text',
      'cursor-alias',
      'cursor-copy',
      'cursor-no-drop',
      'cursor-grab',
      'cursor-grabbing',
      'select-none',
      'select-text',
      'select-all',
      'select-auto',
      'resize-none',
      'resize-y',
      'resize-x',
      'resize',
      'scroll-auto',
      'scroll-smooth',
      'list-inside',
      'list-outside',
      'appearance-none',
      'appearance-auto',
      'columns-auto',
      'break-before-auto',
      'break-before-avoid',
      'break-before-all',
      'break-before-avoid-page',
      'break-before-page',
      'break-before-left',
      'break-before-right',
      'break-before-column',
      'break-inside-auto',
      'break-inside-avoid',
      'break-inside-avoid-page',
      'break-inside-avoid-column',
      'break-after-auto',
      'break-after-avoid',
      'break-after-all',
      'break-after-avoid-page',
      'break-after-page',
      'break-after-left',
      'break-after-right',
      'break-after-column',
      'box-border',
      'box-content',
      'touch-auto',
      'touch-none',
      'touch-pan-x',
      'touch-pan-left',
      'touch-pan-right',
      'touch-pan-y',
      'touch-pan-up',
      'touch-pan-down',
      'touch-pinch-zoom',
      'touch-manipulation',
    ];

    if (exactMatches.includes(className)) {
      return true;
    }

    // Handle classes with specific numeric/color patterns
    const validPatterns = [
      // Spacing classes with specific numbers
      /^[mp][xytblr]?-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|px)$/,

      // Width/Height with specific values
      /^[wh]-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|auto|px|full|screen|fit|min|max)$/,

      // Colors with specific Tailwind color names and shades
      /^(?:text|bg|border|ring|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)$/,

      // Special color keywords
      /^(?:text|bg|border|ring|shadow)-(?:transparent|current|black|white|inherit)$/,

      // Font sizes
      /^text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,

      // Z-index
      /^z-(?:0|10|20|30|40|50|auto)$/,

      // Opacity
      /^opacity-(?:0|5|10|15|20|25|30|35|40|45|50|55|60|65|70|75|80|85|90|95|100)$/,

      // Rounded corners
      /^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/,
      /^rounded-[tblr](?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/,
      /^rounded-(?:t|b|l|r|tl|tr|bl|br)(?:-(?:none|sm|md|lg|xl|2xl|3xl|full))?$/,

      // Shadow
      /^shadow(?:-(?:sm|md|lg|xl|2xl|inner|none))?$/,

      // Flex
      /^flex-(?:1|auto|initial|none)$/,
      /^flex-(?:row|row-reverse|col|col-reverse)$/,
      /^flex-(?:wrap|wrap-reverse|nowrap)$/,
      /^(?:grow|shrink)(?:-0)?$/,

      // Grid
      /^(?:grid-)?cols-(?:1|2|3|4|5|6|7|8|9|10|11|12|none|subgrid)$/,
      /^(?:grid-)?rows-(?:1|2|3|4|5|6|none|subgrid)$/,
      /^col-(?:auto|span-(?:1|2|3|4|5|6|7|8|9|10|11|12|full)|start-(?:1|2|3|4|5|6|7|8|9|10|11|12|13)|end-(?:1|2|3|4|5|6|7|8|9|10|11|12|13))$/,
      /^row-(?:auto|span-(?:1|2|3|4|5|6|full)|start-(?:1|2|3|4|5|6|7)|end-(?:1|2|3|4|5|6|7))$/,

      // Gap
      /^gap-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|px)$/,
      /^gap-[xy]-(?:0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|px)$/,

      // Leading
      /^leading-(?:3|4|5|6|7|8|9|10|none|tight|snug|normal|relaxed|loose)$/,

      // Tracking
      /^tracking-(?:tighter|tight|normal|wide|wider|widest)$/,
    ];

    // Check if className matches any valid pattern
    if (validPatterns.some((pattern) => pattern.test(className))) {
      return true;
    }

    // Check for arbitrary values like text-[14px], bg-[#123456]
    if (className.includes('[') && className.includes(']')) {
      const baseClass = className.split('[')[0];
      return this.validPrefixes.has(baseClass);
    }

    // If none of the above match, it's not a valid Tailwind class
    return false;
  }

  /**
   * Suggests similar valid classes
   */
  private suggestClass(className: string): string | undefined {
    const suggestions = new Map([
      ['center', 'text-center'],
      ['middle', 'items-center'],
      ['bold', 'font-bold'],
      ['italic', 'italic'],
      ['underline', 'underline'],
      ['block', 'block'],
      ['inline', 'inline'],
      ['flex', 'flex'],
      ['grid', 'grid'],
      ['hidden', 'hidden'],
      ['red', 'text-red-500'],
      ['blue', 'text-blue-500'],
      ['green', 'text-green-500'],
    ]);

    return suggestions.get(className);
  }

  /**
   * Suggests similar valid variants
   */
  private suggestVariant(variant: string): string | undefined {
    const suggestions = new Map([
      ['over', 'hover'],
      ['click', 'active'],
      ['mobile', 'sm'],
      ['tablet', 'md'],
      ['desktop', 'lg'],
    ]);

    return suggestions.get(variant);
  }

  /**
   * Parses class string into individual classes
   */
  private parseClasses(pattern: string): string[] {
    return pattern
      .split(/\s+/)
      .map((cls) => cls.trim())
      .filter((cls) => cls.length > 0);
  }

  /**
   * Detects conflicting CSS properties in class list
   */
  private detectConflictingProperties(classes: string[]): string[] {
    const conflicts: string[] = [];
    const propertyGroups = this.groupByProperty(classes);

    for (const [property, classesInGroup] of propertyGroups.entries()) {
      if (classesInGroup.length > 1) {
        // Check if these classes actually conflict
        if (this.areConflicting(property, classesInGroup)) {
          conflicts.push(`${property}: ${classesInGroup.join(', ')}`);
        }
      }
    }

    return conflicts;
  }

  /**
   * Groups classes by CSS property they affect
   */
  private groupByProperty(classes: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const className of classes) {
      const property = this.getPropertyForClass(className);
      if (property) {
        if (!groups.has(property)) {
          groups.set(property, []);
        }
        groups.get(property)!.push(className);
      }
    }

    return groups;
  }

  /**
   * Gets the primary CSS property affected by a class
   */
  private getPropertyForClass(className: string): string | null {
    // Remove variants
    const baseClass = className.includes(':') ? className.split(':').pop()! : className;

    const propertyMap = new Map([
      // Typography
      ['font-', 'font-family'],
      ['text-', 'font-size'],
      ['leading-', 'line-height'],
      ['tracking-', 'letter-spacing'],

      // Colors (can be background, text, or border)
      ['bg-', 'background-color'],
      ['text-', 'color'],
      ['border-', 'border-color'],

      // Spacing
      ['m-', 'margin'],
      ['mx-', 'margin'],
      ['my-', 'margin'],
      ['mt-', 'margin-top'],
      ['mr-', 'margin-right'],
      ['mb-', 'margin-bottom'],
      ['ml-', 'margin-left'],
      ['p-', 'padding'],
      ['px-', 'padding'],
      ['py-', 'padding'],
      ['pt-', 'padding-top'],
      ['pr-', 'padding-right'],
      ['pb-', 'padding-bottom'],
      ['pl-', 'padding-left'],

      // Sizing
      ['w-', 'width'],
      ['h-', 'height'],
      ['min-w-', 'min-width'],
      ['min-h-', 'min-height'],
      ['max-w-', 'max-width'],
      ['max-h-', 'max-height'],

      // Display
      ['block', 'display'],
      ['inline', 'display'],
      ['flex', 'display'],
      ['grid', 'display'],
      ['hidden', 'display'],

      // Position
      ['static', 'position'],
      ['fixed', 'position'],
      ['absolute', 'position'],
      ['relative', 'position'],
      ['sticky', 'position'],

      // Flexbox
      ['justify-', 'justify-content'],
      ['items-', 'align-items'],
      ['flex-', 'flex'],
      ['grow', 'flex-grow'],
      ['shrink', 'flex-shrink'],
    ]);

    for (const [prefix, property] of propertyMap.entries()) {
      if (baseClass.startsWith(prefix) || baseClass === prefix) {
        return property;
      }
    }

    return null;
  }

  /**
   * Checks if classes affecting the same property are conflicting
   */
  private areConflicting(property: string, classes: string[]): boolean {
    // Some properties can have multiple values (e.g., multiple backgrounds)
    const allowMultiple = new Set(['background-image', 'box-shadow', 'transform']);

    if (allowMultiple.has(property)) {
      return false;
    }

    // Most properties conflict when multiple values are specified
    return classes.length > 1;
  }
}

// =============================================================================
// @APPLY DIRECTIVE CREATOR
// =============================================================================

/**
 * Creates @apply directives from pattern extraction results
 */
export class ApplyDirectiveCreator {
  private validator: TailwindClassValidator;
  private config: ApplyDirectiveConfig;

  constructor(config: Partial<ApplyDirectiveConfig> = {}) {
    this.config = ApplyDirectiveConfigSchema.parse(config);
    this.validator = new TailwindClassValidator();
  }

  /**
   * Creates @apply directives from extraction results
   */
  async createDirectives(patterns: Map<string, ExtractionResult>): Promise<ApplyDirectiveResult> {
    const startTime = Date.now();
    const result: ApplyDirectiveResult = {
      css: '',
      mappings: new Map(),
      warnings: [],
      errors: [],
      rulesGenerated: 0,
      statistics: {
        processingTime: 0,
        totalPatterns: patterns.size,
        validPatterns: 0,
        invalidPatterns: 0,
        circularReferences: 0,
      },
    };

    const cssRules: string[] = [];
    const circularRefs = this.config.detectCircularRefs
      ? this.detectCircularReferences(patterns)
      : [];

    if (circularRefs.length > 0) {
      result.statistics.circularReferences = circularRefs.length;
      result.warnings.push(
        `Detected ${circularRefs.length} circular references: ${circularRefs.join(', ')}`
      );
    }

    for (const [, extractionResult] of patterns.entries()) {
      try {
        const directiveResult = await this.createSingleDirective(extractionResult, circularRefs);

        if (directiveResult.isValid) {
          cssRules.push(directiveResult.css);
          result.mappings.set(extractionResult.original, extractionResult.identifier);
          result.rulesGenerated++;
          result.statistics.validPatterns++;
        } else {
          result.statistics.invalidPatterns++;
          result.errors.push(...directiveResult.errors);
          result.warnings.push(...directiveResult.warnings);
        }
      } catch (error) {
        result.errors.push(
          `Failed to process pattern '${extractionResult.original}': ${error instanceof Error ? error.message : String(error)}`
        );
        result.statistics.invalidPatterns++;
      }
    }

    // Apply CSS formatting and organization
    result.css = this.formatCss(cssRules);
    result.statistics.processingTime = Date.now() - startTime;

    return result;
  }

  /**
   * Creates a single @apply directive from an extraction result
   */
  private async createSingleDirective(
    extractionResult: ExtractionResult,
    circularRefs: string[]
  ): Promise<{
    isValid: boolean;
    css: string;
    errors: string[];
    warnings: string[];
  }> {
    const result = {
      isValid: false,
      css: '',
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Check for circular references
    if (circularRefs.includes(extractionResult.identifier)) {
      result.errors.push(
        `Circular reference detected for identifier '${extractionResult.identifier}'`
      );
      return result;
    }

    // Validate pattern if enabled
    if (this.config.enableValidation) {
      const validation = this.validator.validatePattern(extractionResult.original);

      if (!validation.isValid) {
        result.errors.push(
          `Invalid pattern '${extractionResult.original}': ${validation.invalidClasses.join(', ')}`
        );
        if (validation.suggestions.length > 0) {
          result.warnings.push(`Suggestions: ${validation.suggestions.join(', ')}`);
        }
        return result;
      }

      if (validation.conflictingProperties.length > 0) {
        result.warnings.push(
          `Conflicting properties in '${extractionResult.original}': ${validation.conflictingProperties.join(', ')}`
        );
      }
    }

    // Generate CSS based on output format
    result.css = this.generateCssRule(extractionResult);
    result.isValid = true;

    return result;
  }

  /**
   * Generates CSS rule for a pattern
   */
  private generateCssRule(extractionResult: ExtractionResult): string {
    const { identifier, original, frequency } = extractionResult;

    switch (this.config.outputFormat) {
      case 'pretty':
        return this.generatePrettyCss(identifier, original, frequency);
      case 'readable':
        return this.generateReadableCss(identifier, original, frequency);
      case 'compact':
      default:
        return this.generateCompactCss(identifier, original);
    }
  }

  /**
   * Generates compact CSS format
   */
  private generateCompactCss(identifier: string, original: string): string {
    if (this.config.enableLayers) {
      return `@layer ${this.config.targetLayer} { .${identifier} { @apply ${original}; } }`;
    }
    return `.${identifier} { @apply ${original}; }`;
  }

  /**
   * Generates pretty CSS format with comments
   */
  private generatePrettyCss(identifier: string, original: string, frequency: number): string {
    const lines: string[] = [];

    if (this.config.includeComments) {
      lines.push(`/* Pattern: ${original} (used ${frequency}x) */`);
    }

    if (this.config.enableLayers) {
      lines.push(`@layer ${this.config.targetLayer} {`);
      lines.push(`  .${identifier} {`);
      lines.push(`    @apply ${original};`);
      lines.push(`  }`);
      lines.push(`}`);
    } else {
      lines.push(`.${identifier} {`);
      lines.push(`  @apply ${original};`);
      lines.push(`}`);
    }

    return lines.join('\n');
  }

  /**
   * Generates readable CSS format with semantic comments
   */
  private generateReadableCss(identifier: string, original: string, frequency: number): string {
    const lines: string[] = [];
    const semanticComment = this.generateSemanticComment(original, frequency);

    if (this.config.includeComments && semanticComment) {
      lines.push(`/* ${semanticComment} */`);
    }

    if (this.config.enableLayers) {
      lines.push(`@layer ${this.config.targetLayer} {`);
      lines.push(`  .${identifier} {`);
      lines.push(`    @apply ${original};`);
      lines.push(`  }`);
      lines.push(`}`);
    } else {
      lines.push(`.${identifier} {`);
      lines.push(`  @apply ${original};`);
      lines.push(`}`);
    }

    return lines.join('\n');
  }

  /**
   * Generates semantic comment for a pattern
   */
  private generateSemanticComment(pattern: string, frequency: number): string {
    const classes = pattern.split(/\s+/);
    const purposes: string[] = [];

    // Analyze pattern purpose
    if (classes.some((cls) => cls.includes('flex'))) {
      purposes.push('flexbox layout');
    }
    if (classes.some((cls) => cls.includes('grid'))) {
      purposes.push('grid layout');
    }
    if (classes.some((cls) => cls.startsWith('text-'))) {
      purposes.push('typography');
    }
    if (classes.some((cls) => cls.startsWith('bg-'))) {
      purposes.push('background styling');
    }
    if (classes.some((cls) => cls.startsWith('border'))) {
      purposes.push('border styling');
    }
    if (classes.some((cls) => cls.startsWith('p-') || cls.startsWith('m-'))) {
      purposes.push('spacing');
    }

    const purposeStr = purposes.length > 0 ? purposes.join(' + ') : 'utility classes';
    return `${purposeStr} pattern (used ${frequency} times)`;
  }

  /**
   * Formats CSS rules based on configuration
   */
  private formatCss(rules: string[]): string {
    if (rules.length === 0) {
      return '';
    }

    const header = this.config.includeComments
      ? '/* Generated by TW-Enigma @apply Directive Creator */\n\n'
      : '';

    switch (this.config.outputFormat) {
      case 'pretty':
      case 'readable':
        return header + rules.join('\n\n') + '\n';
      case 'compact':
      default:
        return header + rules.join('\n') + '\n';
    }
  }

  /**
   * Detects circular references in pattern mappings
   */
  private detectCircularReferences(patterns: Map<string, ExtractionResult>): string[] {
    const identifierToPattern = new Map<string, string>();
    const circularRefs: string[] = [];

    // Build identifier -> pattern mapping
    for (const [, extractionResult] of patterns.entries()) {
      identifierToPattern.set(extractionResult.identifier, extractionResult.original);
    }

    // Check for circular references
    for (const [, extractionResult] of patterns.entries()) {
      const visited = new Set<string>();
      if (this.hasCircularReference(extractionResult.identifier, identifierToPattern, visited)) {
        circularRefs.push(extractionResult.identifier);
      }
    }

    return circularRefs;
  }

  /**
   * Recursively checks for circular references
   */
  private hasCircularReference(
    identifier: string,
    identifierToPattern: Map<string, string>,
    visited: Set<string>
  ): boolean {
    if (visited.has(identifier)) {
      return true;
    }

    const pattern = identifierToPattern.get(identifier);
    if (!pattern) {
      return false;
    }

    visited.add(identifier);

    // Check if pattern contains other identifiers
    const classes = pattern.split(/\s+/);
    for (const className of classes) {
      if (identifierToPattern.has(className)) {
        if (this.hasCircularReference(className, identifierToPattern, visited)) {
          return true;
        }
      }
    }

    visited.delete(identifier);
    return false;
  }

  /**
   * Updates configuration
   */
  updateConfig(config: Partial<ApplyDirectiveConfig>): void {
    this.config = ApplyDirectiveConfigSchema.parse({ ...this.config, ...config });
  }

  /**
   * Gets current configuration
   */
  getConfig(): ApplyDirectiveConfig {
    return { ...this.config };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Creates an @apply directive creator with default configuration
 */
export function createApplyDirectiveCreator(
  config?: Partial<ApplyDirectiveConfig>
): ApplyDirectiveCreator {
  return new ApplyDirectiveCreator(config);
}

/**
 * Creates a Tailwind class validator
 */
export function createTailwindClassValidator(): TailwindClassValidator {
  return new TailwindClassValidator();
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validates a pattern quickly without creating a full validator
 */
export function validateTailwindPattern(pattern: string): boolean {
  const validator = new TailwindClassValidator();
  const result = validator.validatePattern(pattern);
  return result.isValid;
}

/**
 * Generates @apply directive CSS quickly
 */
export async function generateApplyDirectives(
  patterns: Map<string, ExtractionResult>,
  config?: Partial<ApplyDirectiveConfig>
): Promise<string> {
  const creator = createApplyDirectiveCreator(config);
  const result = await creator.createDirectives(patterns);
  return result.css;
}
