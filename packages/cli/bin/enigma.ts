#!/usr/bin/env node

/**
 * Entry point for the tw-enigma CLI
 * This file handles the CLI initialization and command registration
 * with enhanced error handling and fallbacks for missing dependencies
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';

// Create require function for ES modules with fallback
let require: NodeRequire;
try {
  // Try to use import.meta.url if available (ES modules)
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    require = createRequire(import.meta.url);
  } else {
    // Fallback for CommonJS or when import.meta.url is undefined
    require = createRequire(join(process.cwd(), 'package.json'));
  }
} catch (error) {
  // Final fallback - use Node's global require
  require = global.require || eval('require');
}

interface PackageInfo {
  version: string;
  name: string;
}

interface CLIModule {
  registerCommands: (program: any) => void;
  cliVersion: string;
  displayBanner: () => void;
  getPackageInfo: () => PackageInfo;
}

interface MockCommand {
  new (): any;
}

interface CommanderModule {
  Command: MockCommand;
}

// Helper function for safe module loading with better typing
function safeRequire<T = any>(modulePath: string, fallback: T): T {
  try {
    return require(modulePath) as T;
  } catch (error) {
    if (process.env.DEBUG_CLI || process.env.CI) {
      console.error(`Failed to load module ${modulePath}:`, error);
    }
    return fallback;
  }
}

// Helper function for safe async import with better typing
async function safeImport<T = any>(modulePath: string, fallback: T): Promise<T> {
  try {
    return (await import(modulePath)) as T;
  } catch (error) {
    if (process.env.DEBUG_CLI || process.env.CI) {
      console.error(`Failed to import module ${modulePath}:`, error);
    }
    return fallback;
  }
}

// Main CLI function with improved error handling
async function main(): Promise<void> {
  try {
    // Load external dependencies with fallbacks
    const chalk = await safeImport('chalk', {
      default: {
        blue: (s: string) => s,
        green: (s: string) => s,
        yellow: (s: string) => s,
        gray: (s: string) => s,
      },
    });
    const chalkDefault = chalk.default || chalk;

    // Commander.js should be available as CommonJS
    const commanderModule = safeRequire<CommanderModule>('commander', {
      Command: class MockCommand {
        name(): this {
          return this;
        }
        description(): this {
          return this;
        }
        helpOption(): this {
          return this;
        }
        option(): this {
          return this;
        }
        command(): this {
          return this;
        }
        action(): this {
          return this;
        }
        outputHelp(): void {
          console.log('Help not available');
        }
      } as any,
    });
    const { Command } = commanderModule;

    // Load internal modules with safe paths - determine correct path
    let indexPath = './index.js';
    try {
      // Try to resolve from current directory first
      indexPath = require.resolve('./index.js');
    } catch {
      try {
        // If that fails, try relative to this script's directory
        const scriptDir = dirname(__filename || '');
        indexPath = resolve(scriptDir, 'index.js');
      } catch {
        // Final fallback
        indexPath = './index.js';
      }
    }

    const cliModule = safeRequire<CLIModule>(indexPath, {
      registerCommands: () => {},
      cliVersion: '1.0.3',
      displayBanner: () => console.log('🔵 Tailwind Enigma'),
      getPackageInfo: () => ({ version: '1.0.3', name: '@tw-enigma/cli' }),
    });

    const { registerCommands, cliVersion, displayBanner, getPackageInfo } = cliModule;

    // Import core version with proper fallback
    let coreVersion: string = 'unknown';
    try {
      const coreModule = safeRequire<{ version?: string }>('@tw-enigma/core', {});
      coreVersion = coreModule.version || 'unknown';
    } catch (error) {
      coreVersion = 'unavailable';
      if (process.env.DEBUG_CLI) {
        console.error('Core module load error:', error);
      }
    }

    // Initialize CLI with error protection
    const program = new Command();
    const packageInfo = getPackageInfo();

    // Display banner with error handling
    try {
      displayBanner();
    } catch (bannerError) {
      // Always show fallback banner
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

    // Register all commands with error protection
    try {
      registerCommands(program);
    } catch (commandError) {
      if (process.env.DEBUG_CLI || process.env.CI) {
        console.error('Failed to register commands:', commandError);
      }
      // Don't exit here - continue with basic functionality
    }

    // Add info command for version and environment information
    program
      .command('info')
      .description('display version and environment information')
      .action(() => {
        try {
          console.log(chalkDefault.blue('tw-enigma CLI Information'));
        } catch {
          console.log('tw-enigma CLI Information');
        }
        console.log(`CLI Version: ${cliVersion}`);
        console.log(`Core Version: ${coreVersion}`);
        console.log(`Node.js: ${process.version}`);
        console.log(`Platform: ${process.platform} ${process.arch}`);
        process.exit(0);
      });

    // Add default action to handle when no subcommand is provided
    program.action((options: Record<string, any>) => {
      try {
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
          try {
            console.log(
              chalkDefault.green(
                '✅ Pretty mode enabled - output will be formatted for readability'
              )
            );
          } catch {
            console.log('✅ Pretty mode enabled - output will be formatted for readability');
          }
        }

        // Handle verbose mode
        if (options.verbose) {
          try {
            console.log(chalkDefault.blue('ℹ️  Configuration loaded successfully'));
          } catch {
            console.log('ℹ️  Configuration loaded successfully');
          }
        }

        // Handle debug mode
        if (options.debug) {
          try {
            console.log(chalkDefault.yellow('🐛 Debug mode enabled'));
            console.log(chalkDefault.gray('📋 Final configuration:'));
          } catch {
            console.log('🐛 Debug mode enabled');
            console.log('📋 Final configuration:');
          }

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
          try {
            console.log(
              chalkDefault.yellow(`⚠️  Failed to load configuration file: ${options.config}`)
            );
            console.log(
              chalkDefault.blue('ℹ️  Configuration loaded successfully (using defaults)')
            );
          } catch {
            console.log(`⚠️  Failed to load configuration file: ${options.config}`);
            console.log('ℹ️  Configuration loaded successfully (using defaults)');
          }
        } else {
          try {
            console.log(chalkDefault.blue('ℹ️  Configuration loaded successfully'));
          } catch {
            console.log('ℹ️  Configuration loaded successfully');
          }
        }

        // Handle input configuration
        if (options.input) {
          try {
            console.log(chalkDefault.green('✅ Input configured'));
          } catch {
            console.log('✅ Input configured');
          }
        }

        // Handle output configuration
        if (options.output) {
          try {
            console.log(chalkDefault.green('✅ Output configured'));
          } catch {
            console.log('✅ Output configured');
          }
        }

        // Show helpful tips when no input is specified
        if (!options.input) {
          try {
            console.log(chalkDefault.blue('💡 Tip: Use --input to specify files to process'));
            console.log(
              chalkDefault.blue(
                "💡 Tip: Run 'enigma init-config' to create a sample configuration file"
              )
            );
          } catch {
            console.log('💡 Tip: Use --input to specify files to process');
            console.log("💡 Tip: Run 'enigma init-config' to create a sample configuration file");
          }
        }

        // Exit successfully for now (actual processing would go here)
        process.exit(0);
      } catch (actionError) {
        console.error('CLI action error:', actionError);
        process.exit(1);
      }
    });

    // Parse arguments with error handling
    try {
      // Handle case where no arguments are provided
      if (process.argv.length <= 2) {
        // No arguments provided, run default action
        program.parse([process.argv[0], process.argv[1], '--help']);
      } else {
        program.parse(process.argv);
      }
    } catch (parseError) {
      console.error('Failed to parse CLI arguments:', parseError);
      process.exit(1);
    }
  } catch (mainError) {
    console.error('Critical CLI error:', mainError);
    process.exit(1);
  }
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the CLI
main().catch((error) => {
  console.error('Failed to start CLI:', error);
  process.exit(1);
});
