/**
 * Processors Module - File Processing Systems
 *
 * This module contains file processors for extracting and rewriting
 * CSS classes in HTML, JavaScript, and other file formats.
 */

// HTML Processing
export * from './htmlExtractor';
export * from './htmlRewriter';

// JavaScript Processing
export * from './jsExtractor';
export * from './jsRewriter';

// Pattern Analysis and Name Generation
export * from './nameGeneration';
export * from './patternAnalysis';

// Length Enforcement
export * from './lengthEnforcement';

// CSS Injection
export * from './cssInjector';

// Version export for processors module
export const processorsVersion = '0.1.0';
