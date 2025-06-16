/**
 * CLI Helper Utilities
 *
 * Common utilities and patterns used across CLI commands.
 */

import chalk from 'chalk';
import { statSync } from 'fs';

/**
 * Get package.json information for version display
 */
export function getPackageInfo(): { version: string; name: string } {
  // Return hardcoded values that match the current monorepo structure
  // This avoids path resolution issues in different environments
  return {
    version: '1.0.3', // Root package version
    name: '@tw-enigma/cli',
  };
}

/**
 * Display CLI banner with branding
 * Safe for CI environments - fallback to plain text if chalk fails
 */
export function displayBanner(): void {
  try {
    console.log(chalk.blue('🔵 Tailwind Enigma'));
  } catch {
    // Fallback for CI environments where chalk might not work
    console.log('🔵 Tailwind Enigma');
  }
}

/**
 * Common CLI option definitions for commander.js
 */
export const commonOptions = {
  verbose: {
    flags: '--verbose',
    description: 'Enable verbose logging (shows debug messages)',
  },
  veryVerbose: {
    flags: '--very-verbose',
    description: 'Enable very verbose logging (shows trace messages and detailed file operations)',
  },
  quiet: {
    flags: '--quiet',
    description: 'Quiet mode (only warnings and errors)',
  },
  debug: {
    flags: '--debug',
    description: 'Enable debug mode',
  },
  logLevel: {
    flags: '--log-level <level>',
    description: 'Set the minimum log level',
    choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
  },
  logFile: {
    flags: '--log-file <path>',
    description: 'Write logs to file (supports JSON, CSV, or human-readable format)',
  },
  logFormat: {
    flags: '--log-format <format>',
    description: 'Format for file logging (default: human)',
    choices: ['human', 'json', 'csv'],
  },
  config: {
    flags: '-c, --config <path>',
    description: 'Path to configuration file',
  },
  output: {
    flags: '-o, --output <path>',
    description: 'Output file or directory',
  },
  dryRun: {
    flags: '-d, --dry-run',
    description: 'Preview changes without modifying files',
  },
};

/**
 * Add common options to a commander.js command
 */
export function addCommonOptions(command: Command): Command {
  return command
    .option(commonOptions.verbose.flags, commonOptions.verbose.description)
    .option(commonOptions.veryVerbose.flags, commonOptions.veryVerbose.description)
    .option(commonOptions.quiet.flags, commonOptions.quiet.description)
    .option(commonOptions.debug.flags, commonOptions.debug.description)
    .option(commonOptions.logLevel.flags, commonOptions.logLevel.description)
    .option(commonOptions.logFile.flags, commonOptions.logFile.description)
    .option(commonOptions.logFormat.flags, commonOptions.logFormat.description);
}

/**
 * Validate file existence and accessibility
 */
export function validateInputFile(filePath: string): { isValid: boolean; error?: string } {
  try {
    const stats = statSync(filePath);

    if (!stats.isFile()) {
      return { isValid: false, error: `Input path is not a file: ${filePath}` };
    }

    return { isValid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      return { isValid: false, error: `Input file not found: ${filePath}` };
    } else {
      return { isValid: false, error: `Failed to access input file: ${errorMessage}` };
    }
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * CLI Utilities object expected by tests
 */
export const CLIUtils = {
  /**
   * Format output for different display modes
   */
  formatOutput<T>(data: T, format: 'json' | 'css' = 'css'): string {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  },

  /**
   * Log message to console
   */
  log(message: string): void {
    console.log(message);
  },

  /**
   * Log error message to console
   */
  error(message: string): void {
    console.error(chalk.red(message));
  },
};
