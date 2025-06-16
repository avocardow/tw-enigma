/**
 * Utils Module - Core Utilities and Helpers
 *
 * This module contains utility functions for file operations,
 * logging, debugging, and error handling.
 */

// File System Utilities - selective exports to avoid conflicts
export {
  deduplicateAndSort,
  discoverFilesFromConfig,
  discoverFilesFromConfigAsync,
  discoverFilesSync,
  getFileType,
  shouldIncludeFile,
  validateGlobPattern,
  validateOptions,
} from './fileDiscovery';

export {
  FileIntegrityOptionsSchema,
  FileIntegrityValidator,
  calculateFileChecksum,
  createFileIntegrityValidator,
  validateFileIntegrity,
} from './fileIntegrity';

export * from './pathUtils';

// System Utilities
export * from './debugUtils';
export * from './errors';
export * from './logger';

// Legacy utilities from original structure
export * from './legacy';

// Version export for utils module
export const utilsVersion = '0.1.0';
