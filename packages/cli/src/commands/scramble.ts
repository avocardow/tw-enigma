/**
 * Scramble Command
 *
 * Implements comprehensive scramble effect integration for tw-enigma projects.
 * Handles package discovery, configuration injection, and HTML script injection.
 */

import { execSync } from 'child_process';
import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { dirname, join, relative, resolve } from 'path';
import { addCommonOptions, createLoggerFromArgv, handleCLIError } from '../utils';
import { processScrambleTemplate, type TemplateConfig } from '../utils/template-processor';

interface ScrambleOptions {
  scrambleSpeed?: number;
  scrambleDebug?: boolean;
  scrambleMode?: string;
  scrambleCharset?: string;
  buildScramble?: boolean;
  outDir?: string;
  templatePath?: string;
}

/**
 * Detect scramble package in the workspace
 */
async function detectScramblePackage(): Promise<string | null> {
  try {
    // Try to resolve the package path (monorepo context)
    const packagePath = resolve(process.cwd(), 'packages-private/scramble/dist/scramble.min.js');

    // Check if the file exists
    if (existsSync(packagePath)) {
      return packagePath;
    }

    // Alternative resolution methods
    try {
      // Try using require.resolve (works in Node.js environments)
      return require.resolve('@tw-enigma/scramble/dist/scramble.min.js');
    } catch (e) {
      // Package not found via require.resolve
    }

    return null;
  } catch (e) {
    console.warn('⚠️ Error detecting scramble package:', e);
    return null;
  }
}

/**
 * Inject configuration into scramble template
 */
async function injectScrambleConfiguration(
  templatePath: string,
  outputPath: string,
  options: ScrambleOptions
): Promise<void> {
  try {
    // Read the template file
    const template = readFileSync(templatePath, 'utf8');

    // Build configuration for template processing
    const config: TemplateConfig = {
      SCRAMBLE_INTERVAL: options.scrambleSpeed || 150,
      SCRAMBLE_MODE: options.scrambleMode || 'all',
      CHARSET: options.scrambleCharset || 'abcdefghijklmnopqrstuvwxyz0123456789',
      DEBUG_MODE: options.scrambleDebug || false,
      RETRY_ATTEMPTS: 3,
      CLEANUP_INTERVAL: 30,
      MAX_REGISTRY_SIZE: 1000,
      PERFORMANCE_MONITORING: options.scrambleDebug || false,
    };

    // Validate configuration
    if (config.SCRAMBLE_INTERVAL && typeof config.SCRAMBLE_INTERVAL === 'number') {
      if (config.SCRAMBLE_INTERVAL < 50) {
        console.warn('⚠️ Scramble interval too low, setting to minimum of 50ms');
        config.SCRAMBLE_INTERVAL = 50;
      }

      if (config.SCRAMBLE_INTERVAL > 1000) {
        console.warn('⚠️ Scramble interval too high, setting to maximum of 1000ms');
        config.SCRAMBLE_INTERVAL = 1000;
      }
    }

    // Process template with scramble defaults
    const result = processScrambleTemplate(template, config, { debug: options.scrambleDebug });

    // Handle warnings and errors
    if (result.warnings.length > 0) {
      console.warn('Template processing warnings:');
      result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    if (result.errors.length > 0) {
      console.error('Template processing errors:');
      result.errors.forEach((error) => console.error(`  - ${error}`));
      throw new Error('Template processing failed');
    }

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true });

    // Write the configured file
    writeFileSync(outputPath, result.output, 'utf8');

    console.log('✅ Scramble configuration injected successfully');
  } catch (e) {
    console.error('❌ Error injecting scramble configuration:', e);
    throw e;
  }
}

/**
 * Find HTML files in build directory
 */
async function findHtmlFiles(buildDir: string): Promise<string[]> {
  try {
    const files = await glob('**/*.html', { cwd: buildDir, absolute: true });
    return files;
  } catch (error) {
    throw new Error(`Failed to find HTML files: ${error}`);
  }
}

/**
 * Inject script into an HTML file
 */
async function injectScriptIntoHtml(htmlFile: string, scriptPath: string): Promise<boolean> {
  try {
    // Read the HTML file
    let html = readFileSync(htmlFile, 'utf8');

    // Calculate relative path from HTML file to script
    const htmlDir = dirname(htmlFile);
    const relativeScriptPath = relative(htmlDir, scriptPath);

    // Check if script is already injected
    if (html.includes(relativeScriptPath)) {
      console.log(`⚠️ Script already injected in ${htmlFile}`);
      return false;
    }

    // Inject script before closing body tag
    const scriptTag = `<script src="${relativeScriptPath}"></script>`;
    html = html.replace('</body>', `  ${scriptTag}\n</body>`);

    // Write the modified HTML
    writeFileSync(htmlFile, html, 'utf8');

    console.log(`✅ Injected script into ${htmlFile}`);
    return true;
  } catch (e) {
    console.error(`❌ Error injecting script into ${htmlFile}:`, e);
    return false;
  }
}

/**
 * Inject scramble script into all HTML files
 */
async function injectScrambleIntoHtmlFiles(buildDir: string, scriptPath: string): Promise<void> {
  try {
    // Find all HTML files
    const htmlFiles = await findHtmlFiles(buildDir);
    console.log(`Found ${htmlFiles.length} HTML files in ${buildDir}`);

    // Inject script into each HTML file
    let successCount = 0;
    for (const htmlFile of htmlFiles) {
      const success = await injectScriptIntoHtml(htmlFile, scriptPath);
      if (success) successCount++;
    }

    console.log(`✅ Injected scramble script into ${successCount}/${htmlFiles.length} HTML files`);
  } catch (e) {
    console.error('❌ Error injecting scramble script into HTML files:', e);
  }
}

/**
 * Main scramble integration function
 */
async function integrateScrambleEffect(
  scramblePackagePath: string,
  options: ScrambleOptions
): Promise<void> {
  try {
    const buildDir = options.outDir || 'dist';
    const assetsDir = join(buildDir, 'assets');
    const configuredScriptPath = join(assetsDir, 'enigma-scramble.js');

    // Ensure assets directory exists
    mkdirSync(assetsDir, { recursive: true });

    // Build scramble package if needed
    if (options.buildScramble) {
      console.log('Building scramble package...');
      try {
        execSync('pnpm --filter @tw-enigma/scramble build', { stdio: 'inherit' });
      } catch (buildError) {
        console.warn('⚠️ Could not build scramble package automatically. Using existing build.');
      }
    }

    // Use template path if provided, otherwise use the built package
    const templatePath = options.templatePath || scramblePackagePath;

    // Inject configuration and copy to build output
    await injectScrambleConfiguration(templatePath, configuredScriptPath, options);

    // Inject script into HTML files
    await injectScrambleIntoHtmlFiles(buildDir, configuredScriptPath);

    console.log('✅ Scramble effect integration complete');
  } catch (e) {
    console.error('❌ Error integrating scramble effect:', e);
    throw e;
  }
}

/**
 * Create and configure the scramble command
 */
export function createScrambleCommand(): Command {
  const command = new Command('scramble')
    .description('Integrate scramble effect into build output')
    .option('-o, --out-dir <dir>', 'Build output directory to inject scramble into', 'dist')
    .option('--scramble-speed <ms>', 'Scramble speed in milliseconds (50-1000)', (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 50 || num > 1000) {
        throw new Error(`Invalid scramble speed: ${value}. Must be between 50-1000ms.`);
      }
      return num;
    })
    .option('--scramble-debug', 'Enable debug logging for scramble effect')
    .option('--scramble-mode <mode>', 'Scramble mode (currently only "all" supported)', 'all')
    .option(
      '--scramble-charset <charset>',
      'Character set for scramble effect',
      'abcdefghijklmnopqrstuvwxyz0123456789'
    )
    .option('--build-scramble', 'Build scramble package before integration')
    .option('--template <path>', 'Path to scramble template file (overrides package detection)')
    .option('--skip-html-injection', 'Skip automatic HTML injection')
    .option('--force', 'Force overwrite existing scramble scripts')
    .action(async (options, cmd) => {
      const logger = createLoggerFromArgv(cmd.optsWithGlobals());
      const allOptions = cmd.optsWithGlobals();

      try {
        logger.info('🎨 Starting scramble effect integration...');

        // Package discovery
        let scramblePackagePath: string | null = null;

        if (allOptions.template) {
          // Use provided template path
          scramblePackagePath = resolve(allOptions.template);
          if (!existsSync(scramblePackagePath)) {
            throw new Error(`Template file not found: ${scramblePackagePath}`);
          }
          logger.info(`Using template: ${scramblePackagePath}`);
        } else {
          // Detect scramble package
          scramblePackagePath = await detectScramblePackage();

          if (!scramblePackagePath) {
            throw new Error(
              '⚠️ Scramble effect requires @tw-enigma/scramble package, which was not found.\n' +
                'To resolve this:\n' +
                '1. Create packages-private/scramble package in your monorepo\n' +
                '2. Install @tw-enigma/scramble package\n' +
                '3. Use --template flag to specify a custom template path'
            );
          }

          logger.info(`Found scramble package: ${scramblePackagePath}`);
        }

        // Prepare options
        const scrambleOptions: ScrambleOptions = {
          scrambleSpeed: allOptions.scrambleSpeed,
          scrambleDebug: allOptions.scrambleDebug,
          scrambleMode: allOptions.scrambleMode,
          scrambleCharset: allOptions.scrambleCharset,
          buildScramble: allOptions.buildScramble,
          outDir: allOptions.outDir,
          templatePath: allOptions.template,
        };

        if (allOptions.debug) {
          logger.info('🐛 Debug mode enabled');
          logger.info(`📋 Scramble options: ${JSON.stringify(scrambleOptions, null, 2)}`);
        }

        // Perform integration
        await integrateScrambleEffect(scramblePackagePath, scrambleOptions);

        // Summary
        logger.info('🎉 Scramble effect integration completed successfully!');
        if (scrambleOptions.scrambleSpeed) {
          logger.info(`⚡ Scramble speed: ${scrambleOptions.scrambleSpeed}ms`);
        }
        if (scrambleOptions.scrambleDebug) {
          logger.info('🐛 Debug mode: enabled');
        }
        logger.info(`📁 Output directory: ${scrambleOptions.outDir}`);
      } catch (error) {
        handleCLIError(error, logger);
        process.exit(1);
      }
    });

  // Add common CLI options
  return addCommonOptions(command);
}
