#!/usr/bin/env node

/**
 * tw-enigma CLI executable entry point
 * 
 * This is the main entry point for the enigma CLI command,
 * providing a command-line interface for tw-enigma CSS optimization.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { version as coreVersion } from '@tw-enigma/core';
import { version, cliVersion } from '../src/index';
import { registerCommands } from '../src/commands';
import { displayBanner, getPackageInfo, createDefaultCliLogger } from '../src/utils';

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
  .option('--log-level <level>', 'set the minimum log level', 'info')
  .option('--log-file <path>', 'write logs to file')
  .option('--log-format <format>', 'format for file logging', 'human')
  .option('-c, --config <path>', 'path to configuration file')
  .option('-o, --output <path>', 'specify output file or directory')
  .option('--format <format>', 'output format (css, json)', 'css');

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

// Error handling
program.exitOverride();

try {
  program.parse(process.argv);
} catch (err: any) {
  if (err.code === 'commander.version') {
    process.exit(0);
  } else if (err.code === 'commander.help') {
    process.exit(0);
  } else {
    logger.error(err.message || 'Unknown error occurred');
    process.exit(1);
  }
}

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 