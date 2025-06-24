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
} catch {
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
export type { GlobalOptions, ValidatedOptions } from './types.js';

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
 * Main CLI function that creates and runs the CLI application
 */
export async function cli(): Promise<void> {
  // Initialize base CLI program
  const program = new Command();

  // Set package metadata
  program
    .name('enigma')
    .description('🎨 @tw-enigma/cli - Intelligent CSS optimization engine')
    .version(packageJson.version, '-v, --version', 'Display version number');

  // Add main enigma options (pattern identification and consolidation)
  program
    .option('--input <path>', 'Input directory to scan for CSS files')
    .option('--output <path>', 'Output path for generated CSS file', 'enigma.css')
    .option('--length <number>', 'Length of generated class names', parseInt, 1)
    .option('--min-frequency <number>', 'Minimum frequency for pattern detection', parseInt, 2)
    .option('--verbose', 'Enable verbose logging (shows debug messages)')
    .option('--debug', 'Enable debug mode')
    .option('--pretty', 'Enable pretty mode for formatted output')
    .option('-p', 'Enable pretty mode for formatted output') // Short flag for pretty
    .option('--config <path>', 'Path to configuration file')
    .option('-c, --config <path>', 'Path to configuration file') // Alternative syntax
    .option('--quiet', 'Quiet mode (only warnings and errors)')
    .option('--format <format>', 'Output format (json, console, markdown, html, all)')
    .option('--max-concurrency <number>', 'Maximum number of concurrent operations', parseInt)
    .option('--exclude-patterns <patterns...>', 'Patterns to exclude from processing');

  // Import the main enigma action
  const { enigmaAction } = await import('./commands/index.js');
  
  // Set the default action to be the main enigma functionality
  program.action(enigmaAction);

  // Register all commands (init-config, css-config, info, scramble)
  if (process.env.DEBUG_CLI || process.env.CI) {
    console.error('[CLI-DEBUG] Registering commands...');
  }

  registerCommands(program);

  if (process.env.DEBUG_CLI || process.env.CI) {
    console.error('[CLI-DEBUG] Commands registered successfully');
    const commands = program.commands.map((cmd) => cmd.name());
    console.error(`[CLI-DEBUG] Available commands: ${commands.join(', ')}`);
  }

  // Parse and execute
  program.parse(process.argv);
}

// Auto-run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(console.error);
}

/**
 * Default export with essential CLI information
 */
export default {
  version,
  cliVersion,
  name,
};
