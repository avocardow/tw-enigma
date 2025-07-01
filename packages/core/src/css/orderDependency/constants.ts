/**
 * Constants and default configurations for CSS Order Dependency Handling
 */

import { ConflictSeverity, OrderHandlingOptions, ReportFormat, StrictnessLevel } from './types';

/**
 * Default configuration for order handling
 */
export const DEFAULT_ORDER_CONFIG: OrderHandlingOptions = {
  strictness: StrictnessLevel.BALANCED,
  enableDependencyDetection: true,
  enableAutoResolution: false,
  maxProcessingTime: 30000, // 30 seconds
  enableCaching: true,
  cacheSize: 1000,
  reportFormat: [ReportFormat.CONSOLE],
  ignoredProperties: ['transition', 'animation', 'transform', 'opacity'],
  preserveOrderSelectors: [
    '*:hover',
    '*:focus',
    '*:active',
    '*::before',
    '*::after',
    '@keyframes*',
    '@media*',
  ],
  enableParallelProcessing: false,
};

/**
 * CSS specificity weights for calculation
 */
export const SPECIFICITY_WEIGHTS = {
  /** Inline styles weight */
  INLINE: 1000,
  /** ID selector weight */
  ID: 100,
  /** Class, attribute, pseudo-class weight */
  CLASS: 10,
  /** Element and pseudo-element weight */
  ELEMENT: 1,
  /** !important multiplier */
  IMPORTANT: 10000,
  /** !important multiplier for weight calculation */
  IMPORTANT_MULTIPLIER: 10,
  /** Layer priority weight */
  LAYER: 1000,
  /** User agent origin weight */
  USER_AGENT: 0,
  /** User origin weight */
  USER: 5000,
  /** Author origin weight */
  AUTHOR: 10000,
} as const;

/**
 * Conflict severity level priorities (higher = more severe)
 */
export const CONFLICT_SEVERITY_LEVELS = {
  [ConflictSeverity.INFO]: 1,
  [ConflictSeverity.LOW]: 2,
  [ConflictSeverity.MEDIUM]: 3,
  [ConflictSeverity.HIGH]: 4,
  [ConflictSeverity.CRITICAL]: 5,
} as const;

/**
 * CSS properties that commonly cause order dependencies
 */
export const ORDER_SENSITIVE_PROPERTIES = [
  'z-index',
  'position',
  'top',
  'right',
  'bottom',
  'left',
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
  'border-width',
  'border-style',
  'border-color',
  'outline',
  'box-shadow',
  'background',
  'background-color',
  'background-image',
  'color',
  'font',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'text-shadow',
] as const;

/**
 * CSS properties that reset other properties
 */
export const RESET_PROPERTIES = {
  all: ['*'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  border: ['border-width', 'border-style', 'border-color'],
  'border-width': [
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
  ],
  'border-style': [
    'border-top-style',
    'border-right-style',
    'border-bottom-style',
    'border-left-style',
  ],
  'border-color': [
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
  ],
  background: [
    'background-color',
    'background-image',
    'background-repeat',
    'background-position',
    'background-size',
  ],
  font: ['font-style', 'font-variant', 'font-weight', 'font-size', 'line-height', 'font-family'],
  outline: ['outline-width', 'outline-style', 'outline-color'],
  'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
} as const;

/**
 * Media query types that affect rule order
 */
export const MEDIA_QUERY_BREAKPOINTS = {
  print: 1000,
  screen: 2000,
  speech: 3000,
  all: 4000,
} as const;

/**
 * Pseudo-class selector priorities (higher = later in cascade)
 */
export const PSEUDO_CLASS_PRIORITIES = {
  ':link': 1,
  ':visited': 2,
  ':hover': 3,
  ':focus': 4,
  ':active': 5,
  ':focus-visible': 6,
  ':focus-within': 7,
  ':target': 8,
  ':disabled': 9,
  ':enabled': 10,
  ':checked': 11,
  ':indeterminate': 12,
  ':valid': 13,
  ':invalid': 14,
  ':required': 15,
  ':optional': 16,
} as const;

/**
 * At-rule priorities for ordering
 */
export const AT_RULE_PRIORITIES = {
  '@charset': 1,
  '@import': 2,
  '@namespace': 3,
  '@layer': 4,
  '@media': 5,
  '@supports': 6,
  '@page': 7,
  '@keyframes': 8,
  '@font-face': 9,
} as const;

/**
 * Performance thresholds for analysis
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Maximum rules to analyze without warning */
  MAX_RULES_WARNING: 10000,
  /** Maximum rules to analyze */
  MAX_RULES_LIMIT: 50000,
  /** Maximum processing time per rule (ms) */
  MAX_TIME_PER_RULE: 1,
  /** Memory usage warning threshold (bytes) */
  MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
  /** Cache hit rate warning threshold */
  CACHE_HIT_RATE_WARNING: 0.7,
  /** Specificity calculation time threshold (ms) */
  SPECIFICITY_CALCULATION_MS: 1000,
  /** Batch calculation time threshold (ms) */
  BATCH_CALCULATION_MS: 5000,
} as const;

/**
 * Regular expressions for selector parsing
 */
export const SELECTOR_PATTERNS = {
  /** Match ID selectors */
  ID_SELECTOR: /#[a-zA-Z][\w-]*/g,
  /** Match class selectors */
  CLASS_SELECTOR: /\.[a-zA-Z][\w-]*/g,
  /** Match element selectors */
  ELEMENT_SELECTOR: /^[a-zA-Z][\w-]*|(?<=\s)[a-zA-Z][\w-]*/g,
  /** Match pseudo-class selectors */
  PSEUDO_CLASS: /:[\w-]+(?:\([^)]*\))?/g,
  /** Match pseudo-element selectors */
  PSEUDO_ELEMENT: /::[\w-]+/g,
  /** Match attribute selectors */
  ATTRIBUTE_SELECTOR: /\[[^\]]*\]/g,
  /** Match combinators */
  COMBINATOR: /[>+~]/g,
  /** Match universal selector */
  UNIVERSAL: /\*/g,
} as const;

/**
 * Error messages for common issues
 */
export const ERROR_MESSAGES = {
  INVALID_CSS: 'Invalid CSS syntax detected',
  CIRCULAR_DEPENDENCY: 'Circular dependency detected in CSS rules',
  PROCESSING_TIMEOUT: 'CSS analysis exceeded maximum processing time',
  MEMORY_LIMIT: 'CSS analysis exceeded memory limit',
  INVALID_SELECTOR: 'Invalid CSS selector syntax',
  MISSING_RULE: 'Referenced CSS rule not found',
  UNSUPPORTED_FEATURE: 'CSS feature not supported for analysis',
} as const;

/**
 * Default cache configuration
 */
export const CACHE_CONFIG = {
  /** Default cache size */
  DEFAULT_SIZE: 1000,
  /** Cache TTL in milliseconds */
  TTL: 5 * 60 * 1000, // 5 minutes
  /** Maximum cache entry size */
  MAX_ENTRY_SIZE: 1024 * 1024, // 1MB
  /** Cache cleanup interval */
  CLEANUP_INTERVAL: 60 * 1000, // 1 minute
} as const;
