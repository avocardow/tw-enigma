/**
 * Utils Module - Core Utilities and Helpers
 * 
 * This module contains utility functions for file operations,
 * logging, debugging, and error handling.
 */

// File System Utilities
export * from './fileDiscovery';
export * from './fileIntegrity';
export * from './pathUtils';

// System Utilities
export * from './logger';
export * from './debugUtils';
export * from './errors';

// Legacy utilities from original structure
export * from './legacy';

// Version export for utils module
export const utilsVersion = '0.1.0'; 