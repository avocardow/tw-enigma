/**
 * @tw-enigma/cli - Command Line Interface Package
 *
 * Main entry point for the CLI package, providing command-line tools
 * for tw-enigma CSS optimization.
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { registerCommands } from './commands/index';

// Get current directory for ES modules with fallback
let __filename: string = '';
let __dirname: string = process.cwd();

try {
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    __filename = fileURLToPath(import.meta.url);
    __dirname = dirname(__filename);
  }
} catch (error) {
  // Use defaults already set above
}

// Get package version information - ESM compatible approach
interface PackageJson {
  version: string;
  name: string;
}

let packageJson: PackageJson;
try {
  // Fallback for cases where require doesn't work
  packageJson = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
  ) as PackageJson;
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
export * from './utils/index.js';

// Export command creators for external use
export * from './commands/index.js';

// Export file helpers
export { CLIUtils } from './utils/cli-helpers.js';

// Export CI integration
export { CiIntegration, createCiIntegration } from './ci-integration.js';
export type { CiEnvironment } from './ci-integration.js';

// Export Reporter for output formatting
export type {
  CompressionMetrics,
  OptimizationSavings,
  PatternStats,
  ReporterConfig,
  ReporterStats,
  SizeReduction,
} from './reporter';
export { default as Reporter } from './reporter.js';

// Export type definitions
export type { CssOutputConfig, CssPerformanceReport } from '@tw-enigma/core';

export function registerAllCommands(program: Command): void {
  // Register all available commands
  registerCommands(program);
}

export function displayBanner(): void {
  console.log(`\n🎨 ${packageJson.name} v${packageJson.version}`);
  console.log('Intelligent CSS optimization engine\n');
}

export function getPackageInfo(): PackageJson {
  return packageJson;
}

/**
 * Default export with essential CLI information
 */
export default {
  version,
  cliVersion,
  name,
};
