/**
 * Template Literal System - Main Entry Point
 * Exports all template literal detection, parsing, and dynamic class generation components
 */

export { TemplateLiteralDetector } from './templateLiteralDetector';
export { ASTTemplateParser } from './astTemplateParser';
export { DynamicClassAPI } from './dynamicClassAPI';
export { FallbackHandler } from './fallbackHandler';

// Re-export types for convenience
export type {
  TemplateLiteralMatch,
  TemplateDetectionOptions,
  ASTTemplateLiteral,
  DynamicClassPattern,
  RuntimeClassMapping,
  FallbackStrategy,
  FallbackResult,
  FallbackConfig,
  ProcessingContext,
  SourceLocation,
  OptimizationHint,
} from './types';