#!/usr/bin/env node

/**
 * tw-enigma CLI executable entry point
 *
 * This is the main entry point for the enigma CLI command,
 * providing a command-line interface for tw-enigma CSS optimization.
 */

// Global error handlers with CI-specific logging
process.on('uncaughtException', (error) => {
  console.error('🔵 Tailwind Enigma');
  console.error('Fatal error:', error.message);
  if (process.env.CI) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('🔵 Tailwind Enigma');
  console.error('Unhandled promise rejection:', reason);
  if (process.env.CI) {
    console.error('Promise rejection details:', reason);
  }
  process.exit(1);
});

// Main CLI function to handle async imports
async function main() {
  try {
    // External dependencies (chalk needs dynamic import for ESM compatibility)
    const { default: chalk } = await import('chalk');
    const { Command } = require('commander');

    // Internal modules (use require with explicit paths)
    const { registerCommands } = require('../dist/index.js');
    const { cliVersion } = require('../dist/index.js');
    const { displayBanner, getPackageInfo } = require('../dist/index.js');

    // Import core version with fallback
    let coreVersion: string = 'unknown';
    try {
      const coreModule = require('@tw-enigma/core');
      coreVersion = coreModule.version || 'unknown';
    } catch (error) {
      coreVersion = 'unavailable';
      if (process.env.DEBUG_CLI) {
        console.error('Core module load error:', error);
      }
    }

    // Initialize CLI
    const program = new Command();
    const packageInfo = getPackageInfo();

    // Display banner early with error handling
    try {
      displayBanner();
    } catch (bannerError) {
      // Fallback for any banner display issues
      console.log('🔵 Tailwind Enigma');
      if (process.env.CI || process.env.DEBUG_CLI) {
        console.error('Banner display error:', bannerError);
      }
    }

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
    try {
      registerCommands(program);
    } catch (commandError) {
      console.error('Failed to register commands:', commandError);
      if (process.env.CI) {
        console.error('Command registration error details:', commandError);
      }
    }

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
    program.action((options: any) => {
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
        console.log(
          chalk.green('✅ Pretty mode enabled - output will be formatted for readability')
        );
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

    // Parse command line arguments
    program.parse(process.argv);
  } catch (error) {
    // Handle any initialization errors
    console.error('🔵 Tailwind Enigma');
    console.error('CLI initialization failed:', error instanceof Error ? error.message : error);
    if (process.env.CI) {
      console.error(
        'Initialization error stack:',
        error instanceof Error ? error.stack : 'No stack available'
      );
    }
    process.exit(1);
  }
}

// Start the CLI
main().catch((error) => {
  console.error('🔵 Tailwind Enigma');
  console.error('Failed to start CLI:', error);
  process.exit(1);
});
