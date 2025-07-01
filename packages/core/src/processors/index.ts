/**
 * Processors Module - File Processing Systems
 *
 * This module contains file processors for extracting and rewriting
 * CSS classes in HTML, JavaScript, and other file formats.
 */

/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
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

// File processing
export {
  FileProcessingError,
  FileProcessor,
  createFileProcessor,
  processFiles,
} from './fileProcessor';

export type {
  BackupStrategy,
  FileContentOperation,
  FileEncoding,
  FileOperationStatus,
  FileProcessingResult,
  FileProcessingResults,
  FileProcessorConfig,
  InMemoryFile,
  OutputConfig,
} from './fileProcessor';

export {
  BackupStrategySchema,
  FileEncodingSchema,
  FileOperationStatusSchema,
  FileProcessorConfigSchema,
  OutputConfigSchema,
} from './fileProcessor';

// Core processing types (common to all processors)
export interface ProcessorConfig {
  verbose?: boolean;
  dryRun?: boolean;
  continueOnError?: boolean;
}

export interface ProcessingMetrics {
  totalTime: number;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  averageFileSize: number;
}

// Version export for processors module
export const processorsVersion = '0.1.0';
