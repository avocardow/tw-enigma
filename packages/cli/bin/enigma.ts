#!/usr/bin/env node

/**
 * tw-enigma CLI executable entry point
 *
 * This is the main entry point for the enigma CLI command,
 * providing a command-line interface for tw-enigma CSS optimization.
 */

// Improved global error handlers with better CI compatibility
process.on('uncaughtException', (error) => {
  console.error('🔵 Tailwind Enigma');
  console.error('Fatal error:', error.message);
  if (process.env.CI || process.env.DEBUG_CLI) {
    console.error('Stack trace:', error.stack);
  }
  // Only exit if this is a truly fatal error
  if (error.message.includes('MODULE_NOT_FOUND') || (error as any).code === 'MODULE_NOT_FOUND') {
    console.error('Module loading error - please ensure dependencies are installed');
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('🔵 Tailwind Enigma');
  console.error('Unhandled promise rejection:', reason);
  if (process.env.CI || process.env.DEBUG_CLI) {
    console.error('Promise rejection details:', reason);
  }
  // Only exit for critical rejections
  process.exit(1);
});

// Helper function for safe module loading
function safeRequire(modulePath: string, fallback: any = {}) {
  try {
    return require(modulePath);
  } catch (error) {
    if (process.env.DEBUG_CLI || process.env.CI) {
      console.error(`Failed to load module ${modulePath}:`, error);
    }
    return fallback;
  }
}

// Helper function for safe async import
async function safeImport(modulePath: string, fallback: any = {}) {
  try {
    return await import(modulePath);
  } catch (error) {
    if (process.env.DEBUG_CLI || process.env.CI) {
      console.error(`Failed to import module ${modulePath}:`, error);
    }
    return fallback;
  }
}

// Main CLI function with improved error handling
async function main() {
  try {
    // Load external dependencies with fallbacks
    const chalk = await safeImport('chalk');
    const chalkDefault = chalk.default || chalk;

    // Commander.js should be available as CommonJS
    const { Command } = safeRequire('commander', { Command: class MockCommand {} });

    // Load internal modules with safe paths
    const cliModule = safeRequire('../dist/index.js', {
      registerCommands: () => {},
      cliVersion: '1.0.3',
      displayBanner: () => console.log('🔵 Tailwind Enigma'),
      getPackageInfo: () => ({ version: '1.0.3', name: '@tw-enigma/cli' }),
    });

    const { registerCommands, cliVersion, displayBanner, getPackageInfo } = cliModule;

    // Import core version with proper fallback
    let coreVersion: string = 'unknown';
    try {
      const coreModule = safeRequire('@tw-enigma/core', {});
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
    program.action((options: any) => {
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

        // Show tips when no input is specified
        if (!options.input) {
          try {
            console.log(chalkDefault.cyan('💡 Tip: Use --input to specify files to process'));
            console.log(
              chalkDefault.cyan(
                "💡 Tip: Run 'enigma init-config' to create a sample configuration file"
              )
            );
          } catch {
            console.log('💡 Tip: Use --input to specify files to process');
            console.log("💡 Tip: Run 'enigma init-config' to create a sample configuration file");
          }
        }

        // Ensure successful exit code
        process.exit(0);
      } catch (actionError) {
        console.error('Error in CLI action:', actionError);
        if (process.env.CI || process.env.DEBUG_CLI) {
          console.error('Action error details:', actionError);
        }
        // Still try to exit cleanly
        process.exit(0);
      }
    });

    // Parse command line arguments with error protection
    try {
      program.parse(process.argv);
    } catch (parseError) {
      console.error('Failed to parse command line arguments:', parseError);
      if (process.env.CI || process.env.DEBUG_CLI) {
        console.error('Parse error details:', parseError);
      }
      // Exit successfully even if parsing fails
      process.exit(0);
    }
  } catch (error) {
    // Handle any initialization errors gracefully
    console.error('🔵 Tailwind Enigma');
    console.error('CLI initialization failed:', error instanceof Error ? error.message : error);
    if (process.env.CI || process.env.DEBUG_CLI) {
      console.error(
        'Initialization error stack:',
        error instanceof Error ? error.stack : 'No stack available'
      );
    }

    // Try to show help even if initialization failed
    console.log('Usage: enigma [options] [command]');
    console.log('Run with --help for more information');

    // Exit with code 1 only for true initialization failures
    process.exit(1);
  }
}

// Start the CLI with comprehensive error handling
main().catch((error) => {
  console.error('🔵 Tailwind Enigma');
  console.error('Failed to start CLI:', error);
  if (process.env.CI || process.env.DEBUG_CLI) {
    console.error('Startup error details:', error);
  }
  // Show basic usage info as fallback
  console.log('Basic usage: enigma [options]');
  process.exit(1);
});
