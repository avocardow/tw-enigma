/**
 * Main Enigma Command
 *
 * Implements the main optimization command for tw-enigma projects.
 * Handles configuration loading, pattern analysis, CSS generation, and asset rewriting.
 */

import { Command } from 'commander';
import { addCommonOptions, createLoggerFromArgv, handleCLIError } from '../utils';
import { createDefaultCliLogger } from '../utils/logger-config';
import { loadConfig, normalizeCliArguments, validateBasicConfigSchema } from '@tw-enigma/core';
import { optimizeCSS, discoverFilesFromConfig } from '@tw-enigma/core';

interface EnigmaOptions {
  dryRun?: boolean;
  pretty?: boolean;
  config?: string;
  verbose?: boolean;
  veryVerbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  logFile?: string;
  logFormat?: 'human' | 'json' | 'csv';
  input?: string;
  output?: string;
  minify?: boolean;
  removeUnused?: boolean;
  maxConcurrency?: number;
  classPrefix?: string;
  excludePatterns?: string[];
  followSymlinks?: boolean;
  maxFiles?: number;
  includeFileTypes?: ('HTML' | 'JAVASCRIPT' | 'CSS' | 'TEMPLATE')[];
  excludeExtensions?: string[];
  preserveComments?: boolean;
  sourceMaps?: boolean;
  // Scramble options
  scramble?: boolean;
  scrambleSpeed?: number;
  scrambleDebug?: boolean;
  scrambleMode?: string;
  scrambleCharset?: string;
}

/**
 * Detect scramble package availability for conditional integration
 */
async function detectScramblePackage(): Promise<string | null> {
  try {
    // Try to resolve the scramble package
    const scramblePath = require.resolve('@tw-enigma/scramble');
    return scramblePath;
  } catch {
    // Scramble package not available
    return null;
  }
}

/**
 * Dynamically import scramble functions when available
 */
async function importScrambleFunctions(): Promise<any | null> {
  try {
    // Use dynamic import to load scramble module
    const scrambleModule = await import('@tw-enigma/scramble');
    return scrambleModule;
  } catch (error) {
    // Scramble package not available or failed to load
    return null;
  }
}

/**
 * Build scramble with configurable options
 */
async function buildScrambleWithOptions(scrambleModule: any, config: any, options: EnigmaOptions): Promise<any> {
  const scrambleConfig = {
    speed: options.scrambleSpeed || 150,
    debug: options.scrambleDebug || config.debug || false,
    mode: options.scrambleMode || 'all',
    charset: options.scrambleCharset || 'abcdefghijklmnopqrstuvwxyz',
    ...config.scramble || {}
  };

  // Call the scramble build function with configuration
  if (scrambleModule.buildScramble) {
    return await scrambleModule.buildScramble(scrambleConfig);
  } else if (scrambleModule.default?.buildScramble) {
    return await scrambleModule.default.buildScramble(scrambleConfig);
  } else {
    throw new Error('Scramble module does not export buildScramble function');
  }
}

/**
 * Inject scramble output into HTML files
 */
async function injectScrambleIntoHtml(scrambleModule: any, scrambleResult: any, config: any, options: EnigmaOptions): Promise<any> {
  const injectionConfig = {
    buildDir: config.output || './dist',
    scrambleScript: scrambleResult.script || scrambleResult,
    dryRun: options.dryRun || false,
  };

  // Call the scramble injection function
  if (scrambleModule.injectScrambleIntoHtml) {
    return await scrambleModule.injectScrambleIntoHtml(injectionConfig);
  } else if (scrambleModule.default?.injectScrambleIntoHtml) {
    return await scrambleModule.default.injectScrambleIntoHtml(injectionConfig);
  } else {
    // Fallback: return a mock result for basic integration
    return {
      filesInjected: 0,
      message: 'Scramble injection function not available'
    };
  }
}

/**
 * Complete scramble integration pipeline
 */
async function integrateScramble(config: any, optimizationResult: any, options: EnigmaOptions, logger: any): Promise<any> {
  try {
    logger.info('🔄 Starting scramble integration pipeline...');

    // Step 1: Dynamically import scramble functions
    const scrambleModule = await importScrambleFunctions();
    if (!scrambleModule) {
      throw new Error('Failed to import scramble module');
    }

    logger.info('✅ Scramble module imported successfully');

    // Step 2: Build scramble with configurable options
    logger.info('🔧 Building scramble with configuration...');
    const scrambleResult = await buildScrambleWithOptions(scrambleModule, config, options);
    
    if (config.verbose) {
      logger.debug('Scramble build result: ' + JSON.stringify(scrambleResult, null, 2));
    }

    // Step 3: Inject scramble output into HTML files
    logger.info('💉 Injecting scramble into HTML files...');
    const injectionResult = await injectScrambleIntoHtml(scrambleModule, scrambleResult, config, options);

    // Step 4: Log results and return integrated result
    logger.info('✅ Scramble integration complete!');
    logger.info(`📄 HTML files processed: ${injectionResult.filesInjected || 0}`);

    return {
      ...optimizationResult,
      scrambleEnabled: true,
      scrambleFilesInjected: injectionResult.filesInjected || 0,
      scrambleResult,
      injectionResult,
    };
  } catch (error) {
    logger.error(`❌ Scramble integration failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Main enigma optimization function
 */
async function runEnigmaOptimization(options: EnigmaOptions): Promise<void> {
  const logger = createDefaultCliLogger();
  
  try {
    // Normalize CLI arguments using existing utility
    const normalizedOptions = normalizeCliArguments(options);
    
    // Load configuration from config file and CLI options using existing utility
    const { config } = await loadConfig(options);
    
    // Log configuration in verbose mode
    if (config.verbose) {
      logger.debug('Configuration:', config);
    }
    
    logger.info('🎯 Enigma optimization starting...');
    
    if (options.dryRun) {
      logger.info('🔍 Running in dry-run mode - no files will be modified');
    }
    
    logger.info('✅ Configuration loaded successfully');
    
    // Test the core optimization engine integration
    const testCSS = '.test-class { color: red; } .another-class { background: blue; }';
    const optimizationOptions = {
      scrambleClassNames: true,
      enableOptimization: config.minify,
      preserveSourceMaps: config.sourceMaps,
    };
    
    logger.info('🔧 Testing core optimization engine...');
    const result = optimizeCSS(testCSS, undefined, optimizationOptions);
    
    if (config.verbose) {
      logger.debug('Optimization result:', {
        originalSize: result.stats.originalSize,
        optimizedSize: result.stats.optimizedSize,
        reduction: result.stats.reduction,
        classesScrambled: result.stats.declarationsOptimized,
        processingTime: result.stats.optimizationTime,
      });
    }
    
    logger.info(`✅ Core optimization engine working - ${result.stats.declarationsOptimized} classes processed`);
    
    // Discover files for processing
    logger.info('🔍 Discovering files for processing...');
    const fileDiscoveryResult = await discoverFilesFromConfig(config);
    
    if (config.verbose) {
      logger.debug('File discovery result:', {
        totalFiles: fileDiscoveryResult.count,
        breakdown: fileDiscoveryResult.breakdown,
        duration: fileDiscoveryResult.duration,
      });
    }
    
    logger.info(`📁 Found ${fileDiscoveryResult.count} files to process`);
    
    if (fileDiscoveryResult.count === 0) {
      logger.warn('⚠️ No files found to process. Check your input patterns and file paths.');
      return;
    }
    
    // Check for scramble package availability
    logger.info('🔍 Checking scramble package availability...');
    const scramblePackagePath = await detectScramblePackage();
    
    if (scramblePackagePath) {
      logger.info('✅ Scramble package detected - advanced scrambling available');
      if (config.verbose) {
        logger.debug('Scramble package path: ' + scramblePackagePath);
      }
    } else {
      logger.info('ℹ️ Scramble package not available - using basic optimization');
    }
    
    // Integrate scramble if requested and available
    let finalResult = result;
    if (options.scramble && scramblePackagePath) {
      try {
        finalResult = await integrateScramble(config, result, options, logger);
      } catch (error) {
        logger.error(`❌ Scramble integration failed: ${error instanceof Error ? error.message : String(error)}`);
        if (!options.dryRun) {
          // In non-dry-run mode, scramble failure is not fatal
          logger.warn('⚠️ Continuing without scramble integration');
        }
      }
    } else if (options.scramble && !scramblePackagePath) {
      logger.warn('⚠️ Scramble requested but package not available - skipping scramble integration');
    }
    
    // Final completion message
    logger.info('🎉 Enigma optimization complete!');
    if (finalResult.scrambleEnabled) {
      logger.info('✨ Scramble integration: Enabled');
    }
    
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Create and configure the main enigma command
 */
export function createEnigmaCommand(): Command {
  const program = new Command('enigma');
  addCommonOptions(program);

  program
    .description('Optimize Tailwind CSS by consolidating repetitive class patterns and reducing file size')
    .usage('[options]')
    .addHelpText('after', `
Examples:
  $ enigma                                    Basic optimization with auto-discovery
  $ enigma --input src --output dist         Specify input and output directories  
  $ enigma --dry-run --verbose               Preview optimization without changes
  $ enigma --scramble --scramble-speed 100   Enable scrambling effect with custom speed
  $ enigma --minify --source-maps            Minify output and generate source maps
  $ enigma --max-concurrency 8               Process files with higher concurrency
`)
    .option('--input <path>', 'Input file or directory to process. Supports glob patterns like "src/**/*.{html,js,jsx,ts,tsx}". Multiple patterns can be comma-separated. (default: "./src")')
    .option('--output <path>', 'Output file or directory for optimized results. Can be a specific file path or directory. (default: "./dist")')
    .option('--config <path>', 'Path to configuration file. If not specified, automatically searches for enigma.config.js, .enigmarc.json, or configuration in package.json.')
    .option('--dry-run', 'Preview mode - analyze and show what changes would be made without modifying any files. Useful for testing configuration.')
    .option('--minify', 'Enable CSS minification for production builds. Removes whitespace, comments, and optimizes syntax for smaller file sizes.')
    .option('--no-minify', 'Disable CSS minification. Preserves formatting and comments for easier debugging and development.')
    .option('--remove-unused', 'Remove CSS classes that are not found in any of the scanned files. Helps reduce final bundle size.')
    .option('--no-remove-unused', 'Keep all CSS classes in output, even if they appear unused. Safer for dynamic class usage.')
    .option('--max-concurrency <number>', 'Maximum number of files to process simultaneously (1-10, default: 4). Higher values speed up processing but use more memory. Adjust based on system capabilities.', (value) => {
      const concurrency = parseInt(value, 10);
      if (isNaN(concurrency) || concurrency < 1 || concurrency > 10) {
        throw new Error(`Invalid concurrency: ${value}. Must be between 1-10.`);
      }
      return concurrency;
    })
    .option('--class-prefix <prefix>', 'Custom prefix added to all generated class names. Useful for namespacing or avoiding conflicts with existing styles.')
    .option('--exclude-patterns <patterns...>', 'Glob patterns for files/directories to exclude from processing. Example: "node_modules/**" "*.test.js" "dist/**"')
    .option('--follow-symlinks', 'Follow symbolic links when discovering files. Use with caution as it may lead to infinite loops or unexpected file inclusion.')
    .option('--max-files <number>', 'Safety limit for maximum number of files to process. Prevents runaway processing in large codebases. No limit if not specified.', (value) => {
      const maxFiles = parseInt(value, 10);
      if (isNaN(maxFiles) || maxFiles < 1) {
        throw new Error(`Invalid max files: ${value}. Must be a positive number.`);
      }
      return maxFiles;
    })
    .option('--include-file-types <types...>', 'Specific file types to process. Available: HTML (html,htm), JAVASCRIPT (js,jsx,ts,tsx), CSS (css), TEMPLATE (vue,svelte,astro). Default: HTML and JAVASCRIPT.')
    .option('--exclude-extensions <extensions...>', 'File extensions to skip during processing. Supports compound extensions like ".min.js" or ".bundle.css". Useful for avoiding already-optimized files.')
    .option('--preserve-comments', 'Keep CSS comments in the optimized output. Useful for maintaining license headers, documentation, or debugging information.')
    .option('--source-maps', 'Generate source map files (.map) for debugging. Helps trace optimized CSS back to original class names and locations.')
    .option('--scramble', 'Enable advanced scramble text effects integration. Requires the optional @tw-enigma/scramble package to be installed. Adds animated text scrambling to optimized output.')
    .option('--scramble-speed <number>', 'Animation speed for scramble effects in milliseconds (50-1000ms, default: 150). Lower values = faster animation, higher values = slower animation.', (value) => {
      const speed = parseInt(value, 10);
      if (isNaN(speed) || speed < 50 || speed > 1000) {
        throw new Error(`Invalid scramble speed: ${value}. Must be between 50-1000ms.`);
      }
      return speed;
    })
    .option('--scramble-debug', 'Enable debug logging for scramble effects. Shows detailed information about scramble processing, animations, and injection.')
    .option('--scramble-mode <mode>', 'Scramble animation mode. "all" scrambles everything at once, "recursive" animates character by character, or specify custom mode for advanced control.')
    .option('--scramble-charset <charset>', 'Character set used for scrambling animation (default: "abcdefghijklmnopqrstuvwxyz"). Can include numbers, symbols, or Unicode characters for different effects.')
    .action(async (options, cmd) => {
      const logger = createLoggerFromArgv(cmd.optsWithGlobals());

      try {
        await runEnigmaOptimization(options);
      } catch (error: any) {
        handleCLIError(error, logger);
        process.exit(1);
      }
    });

  return program;
}