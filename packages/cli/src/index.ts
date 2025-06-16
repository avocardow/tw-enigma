/**
 * @tw-enigma/cli - Command Line Interface Package
 *
 * Main entry point for the CLI package, providing command-line tools
 * for tw-enigma CSS optimization.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Get package version information - ESM compatible approach
let packageJson: any;
try {
  // Fallback for cases where require doesn't work
  packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
} catch {
  // Minimal fallback
  packageJson = { version: '0.1.0', name: '@tw-enigma/cli' };
}

/**
 * CLI package version
 */
export const version = packageJson.version;

/**
 * CLI version alias for compatibility
 */
export const cliVersion = packageJson.version;

/**
 * CLI package name
 */
export const name = packageJson.name;

// Export utilities for use in commands and external packages
export * from './utils';

// Export command creators for external use
export * from './commands';

// Export file helpers
export { CLIUtils } from './cli-helpers';

// Export CI integration
export { CiIntegration, createCiIntegration } from './ci-integration';
export type { CiEnvironment } from './ci-integration';

// Export Reporter for output formatting
export { default as Reporter } from './reporter';
export type {
  CompressionMetrics,
  OptimizationSavings,
  PatternStats,
  ReporterConfig,
  ReporterStats,
  SizeReduction,
} from './reporter';

// Export type definitions
export type { CssOutputConfig, CssPerformanceReport } from '@tw-enigma/core';

/**
 * Default export with essential CLI information
 */
export default {
  version,
  cliVersion,
  name,
};
