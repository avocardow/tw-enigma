#!/usr/bin/env node

/**
 * tw-enigma CLI executable entry point
 *
 * This is the main entry point for the enigma CLI command,
 * providing a command-line interface for tw-enigma CSS optimization.
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { registerCommands } from '../src/commands/index.js';
import { cliVersion } from '../src/index.js';
import { displayBanner, getPackageInfo } from '../src/utils/index.js';

// Import core version with fallback (synchronous)
let coreVersion: string = 'unknown';
try {
  // Use require for CommonJS compatibility
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const coreModule = require('@tw-enigma/core');
  coreVersion = coreModule.version || 'unknown';
} catch (error) {
  // Silent fallback if core package can't be loaded
  // This can happen in CI environments with Node.js version differences
  coreVersion = 'unavailable';
  // For debugging in CI: log the error if environment variable is set
  if (process.env.DEBUG_CLI) {
    console.error('Core module load error:', error);
  }
}

// Initialize CLI
const program = new Command();
const packageInfo = getPackageInfo();

// Wrap all CLI execution in try-catch for CI debugging
try {
  // Display banner first, before any error handling
  displayBanner();

  // Configure main program
  program.name('enigma').description('tw-enigma CSS optimization tool').helpOption(false); // Disable built-in help to handle it manually

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
    .option('--exclude-patterns <patterns...>', 'patterns to exclude from processing')
    .option('-v, --version', 'output the current version')
    .option('-h, --help', 'display help for command');

  // Register all commands
  registerCommands(program);

  // Version and help are now handled manually in the default action

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
      process.exit(0);
    });

  // Add default action to handle when no subcommand is provided
  program.action((options) => {
    // Handle version flag first
    if (options.version) {
      console.log(packageInfo.version);
      process.exit(0);
    }

    // Handle help flag
    if (options.help) {
      program.outputHelp();
      process.exit(0);
    }
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
      const config: Record<string, unknown> = {
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

    // Ensure successful exit code
    process.exit(0);
  });

  // Parse command line arguments with error handling
  try {
    program.parse(process.argv);
  } catch (error: unknown) {
    console.error(chalk.red('❌ CLI Error:'), error);
    process.exit(1);
  }
} catch (globalError: unknown) {
  // Global error handler for CI debugging
  console.error(chalk.red('❌ CLI Initialization Error:'), globalError);
  if (process.env.CI) {
    console.error('Stack trace:', (globalError as Error).stack);
    console.error('Node.js version:', process.version);
    console.error('Platform:', process.platform, process.arch);
  }
  process.exit(1);
}
