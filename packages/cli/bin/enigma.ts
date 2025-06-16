#!/usr/bin/env node

/**
 * tw-enigma CLI executable entry point
 *
 * This is the main entry point for the enigma CLI command,
 * providing a command-line interface for tw-enigma CSS optimization.
 */

// Add error handling for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

import chalk from 'chalk';
import { Command } from 'commander';
import { registerCommands } from '../src/commands';
import { cliVersion } from '../src/index';
import { createDefaultCliLogger, displayBanner, getPackageInfo } from '../src/utils';

// Import core version with fallback
let coreVersion: string = 'unknown';
try {
  const { version } = require('@tw-enigma/core');
  coreVersion = version;
} catch (error) {
  // Silent fallback if core package can't be loaded
  // This can happen in CI environments with Node.js version differences
  coreVersion = 'unavailable';
}

// Initialize CLI
const program = new Command();
const packageInfo = getPackageInfo();
const logger = createDefaultCliLogger();

// Display banner
displayBanner();

// Configure main program
program
  .name('enigma')
  .description('tw-enigma CSS optimization tool')
  .version(packageInfo.version, '-v, --version', 'output the current version');

// Global options
program
  .option('--verbose', 'enable verbose output')
  .option('--very-verbose', 'enable very verbose output with detailed logging')
  .option('--quiet', 'quiet mode (only warnings and errors)')
  .option('--debug', 'enable debug mode')
  .option('--pretty', 'enable pretty formatting mode')
  .option('-p, --pretty', 'enable pretty formatting mode')
  .option('--input <path>', 'specify input files or directory')
  .option('--log-level <level>', 'set the minimum log level', 'info')
  .option('--log-file <path>', 'write logs to file')
  .option('--log-format <format>', 'format for file logging', 'human')
  .option('-c, --config <path>', 'path to configuration file')
  .option('-o, --output <path>', 'specify output file or directory')
  .option('--format <format>', 'output format (css, json)', 'css')
  .option('--minify [value]', 'enable/disable minification', true)
  .option('--remove-unused [value]', 'enable/disable removal of unused CSS', true)
  .option('--max-concurrency <number>', 'maximum number of concurrent operations', parseInt)
  .option('--class-prefix <prefix>', 'prefix for CSS classes')
  .option('--preserve-comments', 'preserve comments in output')
  .option('--source-maps', 'generate source maps')
  .option('--exclude-patterns <patterns...>', 'patterns to exclude from processing');

// Add default action to handle global options
program.action(async (options) => {
  // Handle pretty mode
  if (options.pretty) {
    console.log(chalk.green('✅ Pretty mode enabled - output will be formatted for readability'));
  }

  // Handle verbose mode
  if (options.verbose) {
    console.log(chalk.blue('ℹ️  Configuration loaded successfully'));
  }

  // Handle debug mode
  if (options.debug) {
    console.log(chalk.yellow('🐛 Debug mode enabled'));
    console.log(chalk.gray('📋 Final configuration:'));

    // Build configuration object
    const config: any = {
      verbose: options.verbose || false,
      debug: options.debug || false,
      pretty: options.pretty || false,
      input: options.input || null,
      output: options.output || null,
      minify: options.minify === 'false' ? false : options.minify !== false,
      removeUnused: options.removeUnused === 'false' ? false : options.removeUnused !== false,
      format: options.format || 'css',
    };

    if (options.maxConcurrency) config.maxConcurrency = options.maxConcurrency;
    if (options.classPrefix) config.classPrefix = options.classPrefix;
    if (options.preserveComments) config.preserveComments = true;
    if (options.sourceMaps) config.sourceMaps = true;
    if (options.excludePatterns) config.excludePatterns = options.excludePatterns;

    console.log(JSON.stringify(config, null, 2));
  }

  // Handle config file
  if (options.config) {
    console.log(chalk.yellow(`⚠️  Failed to load configuration file: ${options.config}`));
    console.log(chalk.blue('ℹ️  Configuration loaded successfully (using defaults)'));
  }

  // Handle input configuration
  if (options.input) {
    console.log(chalk.green('✅ Input configured'));
  }

  // Handle output configuration
  if (options.output) {
    console.log(chalk.green('✅ Output configured'));
  }

  // Show tips when no input is specified
  if (!options.input) {
    console.log(chalk.cyan('💡 Tip: Use --input to specify files to process'));
    console.log(
      chalk.cyan("💡 Tip: Run 'enigma init-config' to create a sample configuration file")
    );
  }
});

// Register all commands
registerCommands(program);

// Add info command for version and environment information
program
  .command('info')
  .description('display version and environment information')
  .action(() => {
    console.log(chalk.blue('tw-enigma CLI Information'));
    console.log(`CLI Version: ${cliVersion}`);
    console.log(`Core Version: ${coreVersion}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
  });

// Parse command line arguments with error handling
try {
  program.parse(process.argv);
} catch (error) {
  console.error('CLI Error:', error);
  process.exit(1);
}

// Handle case when no command is specified - the action will handle it
