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

/**
 * Enhanced error class for package resolution failures
 */
class PackageResolutionError extends Error {
  public diagnostics: PackageResolutionDiagnostics;

  constructor(message: string, diagnostics: PackageResolutionDiagnostics) {
    super(message);
    this.name = 'PackageResolutionError';
    this.diagnostics = diagnostics;
  }

  toString(): string {
    const lines = [
      this.message,
      '',
      '🔍 Diagnostic Information:',
      `   Current directory: ${this.diagnostics.currentDirectory}`,
      `   Node.js version: ${this.diagnostics.nodeVersion}`,
      `   Package manager: ${this.diagnostics.packageManager}`,
      '',
    ];

    if (this.diagnostics.searchedPaths.length > 0) {
      lines.push('📁 Searched locations:');
      this.diagnostics.searchedPaths.forEach((path) => {
        const status = path.exists ? '✅' : '❌';
        lines.push(`   ${status} ${path.path}`);
      });
      lines.push('');
    }

    if (this.diagnostics.packageJsonStatus.exists) {
      lines.push('📦 Package.json analysis:');
      lines.push(`   ✅ Found: ${this.diagnostics.packageJsonStatus.path}`);
      if (this.diagnostics.packageJsonStatus.hasScrambleDependency) {
        lines.push('   ✅ @tw-enigma/scramble found in dependencies');
      } else {
        lines.push('   ❌ @tw-enigma/scramble not found in dependencies');
      }
      lines.push('');
    }

    lines.push('💡 Suggested solutions:');
    this.diagnostics.suggestedSolutions.forEach((solution) => {
      lines.push(`   ${solution}`);
    });

    return lines.join('\n');
  }
}

/**
 * Diagnostic information for package resolution failures
 */
interface PackageResolutionDiagnostics {
  currentDirectory: string;
  nodeVersion: string;
  packageManager: string;
  searchedPaths: Array<{ path: string; exists: boolean; isFile?: boolean }>;
  packageJsonStatus: {
    exists: boolean;
    path?: string;
    hasScrambleDependency: boolean;
    dependencies?: string[];
  };
  suggestedSolutions: string[];
}

/**
 * Enhanced error class for template file failures
 */
class TemplateFileError extends Error {
  public diagnostics: TemplateFileDiagnostics;

  constructor(message: string, diagnostics: TemplateFileDiagnostics) {
    super(message);
    this.name = 'TemplateFileError';
    this.diagnostics = diagnostics;
  }

  toString(): string {
    const lines = [
      this.message,
      '',
      '🔍 Template File Diagnostic Information:',
      `   Requested path: ${this.diagnostics.requestedPath}`,
      `   Resolved path: ${this.diagnostics.resolvedPath}`,
      `   File exists: ${this.diagnostics.fileExists ? '✅' : '❌'}`,
      '',
    ];

    if (this.diagnostics.parentDirectoryExists) {
      lines.push('📁 Directory analysis:');
      lines.push(`   ✅ Parent directory exists: ${this.diagnostics.parentDirectory}`);
      if (this.diagnostics.similarFiles.length > 0) {
        lines.push('   📄 Similar files found:');
        this.diagnostics.similarFiles.forEach((file) => {
          lines.push(`      • ${file}`);
        });
      }
    } else {
      lines.push(`❌ Parent directory does not exist: ${this.diagnostics.parentDirectory}`);
    }

    lines.push('');
    lines.push('💡 Suggested solutions:');
    this.diagnostics.suggestedSolutions.forEach((solution) => {
      lines.push(`   ${solution}`);
    });

    return lines.join('\n');
  }
}

/**
 * Diagnostic information for template file failures
 */
interface TemplateFileDiagnostics {
  requestedPath: string;
  resolvedPath: string;
  fileExists: boolean;
  parentDirectory: string;
  parentDirectoryExists: boolean;
  similarFiles: string[];
  suggestedSolutions: string[];
}

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
 * Enhanced package resolution cache to improve performance
 */
const packageResolutionCache = new Map<string, string | null>();

/**
 * Diagnose why package resolution failed and provide helpful troubleshooting information
 */
async function diagnosePackageResolutionFailure(): Promise<PackageResolutionDiagnostics> {
  const currentDirectory = process.cwd();
  const nodeVersion = process.version;

  // Detect package manager
  let packageManager = 'npm';
  if (existsSync(join(currentDirectory, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (existsSync(join(currentDirectory, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (existsSync(join(currentDirectory, 'package-lock.json'))) {
    packageManager = 'npm';
  }

  // Check all the paths we would search
  const searchPaths = [
    'packages-private/scramble/dist/scramble.min.js',
    'packages-private/scramble/dist/index.js',
    'packages-private/scramble/src/index.ts',
    'packages/scramble/dist/scramble.min.js',
    'packages/scramble/dist/index.js',
  ];

  const searchedPaths = searchPaths.map((relativePath) => {
    const fullPath = resolve(currentDirectory, relativePath);
    return {
      path: fullPath,
      exists: existsSync(fullPath),
      isFile: existsSync(fullPath) ? true : undefined,
    };
  });

  // Check package.json for dependencies
  const packageJsonPath = join(currentDirectory, 'package.json');
  let packageJsonStatus = {
    exists: false,
    path: undefined as string | undefined,
    hasScrambleDependency: false,
    dependencies: [] as string[],
  };

  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.optionalDependencies,
      };

      packageJsonStatus = {
        exists: true,
        path: packageJsonPath,
        hasScrambleDependency: '@tw-enigma/scramble' in allDeps,
        dependencies: Object.keys(allDeps),
      };
    } catch (e) {
      packageJsonStatus.exists = true;
      packageJsonStatus.path = packageJsonPath;
    }
  }

  // Generate contextual suggestions
  const suggestedSolutions: string[] = [];

  if (!packageJsonStatus.exists) {
    suggestedSolutions.push('1. Initialize a package.json file: npm init -y');
  } else if (!packageJsonStatus.hasScrambleDependency) {
    suggestedSolutions.push(
      `1. Install the scramble package: ${packageManager} install @tw-enigma/scramble`
    );
  }

  // Check if we're in a monorepo context
  const hasMonorepoStructure =
    existsSync(join(currentDirectory, 'packages')) ||
    existsSync(join(currentDirectory, 'packages-private'));

  if (hasMonorepoStructure) {
    suggestedSolutions.push(
      '2. Build the scramble package: pnpm --filter @tw-enigma/scramble build'
    );
    suggestedSolutions.push('3. Ensure the scramble package is linked in the monorepo workspace');
  } else {
    suggestedSolutions.push('2. Verify the package is properly installed in node_modules');
  }

  suggestedSolutions.push('4. Use --template flag to specify a custom scramble script path');
  suggestedSolutions.push('5. Check that the build output exists (run build commands if needed)');

  // Add Node.js/npm specific suggestions
  if (nodeVersion.startsWith('v14') || nodeVersion.startsWith('v12')) {
    suggestedSolutions.push('⚠️  Consider updating Node.js to v16+ for better module resolution');
  }

  return {
    currentDirectory,
    nodeVersion,
    packageManager,
    searchedPaths,
    packageJsonStatus,
    suggestedSolutions,
  };
}

/**
 * Diagnose why template file resolution failed
 */
async function diagnoseTemplateFileFailure(templatePath: string): Promise<TemplateFileDiagnostics> {
  const resolvedPath = resolve(templatePath);
  const parentDirectory = dirname(resolvedPath);
  const fileExists = existsSync(resolvedPath);
  const parentDirectoryExists = existsSync(parentDirectory);

  // Look for similar files in the parent directory
  const similarFiles: string[] = [];
  if (parentDirectoryExists) {
    try {
      const files = await glob('**/*.{js,ts,json}', {
        cwd: parentDirectory,
        maxDepth: 2,
        absolute: false,
      });

      // Filter for scramble-related files
      const scrambleFiles = files.filter(
        (file) =>
          file.toLowerCase().includes('scramble') ||
          file.includes('index') ||
          file.includes('template')
      );

      similarFiles.push(...scrambleFiles.slice(0, 5)); // Limit to 5 files
    } catch (e) {
      // Ignore glob errors
    }
  }

  // Generate contextual suggestions
  const suggestedSolutions: string[] = [];

  if (!parentDirectoryExists) {
    suggestedSolutions.push('1. Check the directory path for typos');
    suggestedSolutions.push('2. Ensure the directory exists or create it');
  } else if (!fileExists) {
    suggestedSolutions.push('1. Check the filename and extension');
    suggestedSolutions.push('2. Build the project to generate missing files');

    if (similarFiles.length > 0) {
      suggestedSolutions.push('3. Consider using one of the similar files found above');
    }
  }

  suggestedSolutions.push('4. Use relative paths from the current working directory');
  suggestedSolutions.push('5. Try using the automatic package detection (remove --template flag)');

  return {
    requestedPath: templatePath,
    resolvedPath,
    fileExists,
    parentDirectory,
    parentDirectoryExists,
    similarFiles,
    suggestedSolutions,
  };
}

/**
 * Log detailed package resolution information for debugging
 */
async function logPackageResolutionDetails(packagePath: string, logger: any): Promise<void> {
  try {
    logger.info('📦 Package Resolution Details:');
    logger.info(`   Resolved path: ${packagePath}`);
    logger.info(`   File exists: ${existsSync(packagePath) ? '✅' : '❌'}`);

    if (existsSync(packagePath)) {
      const { statSync } = await import('fs');
      const stats = statSync(packagePath);
      logger.info(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
      logger.info(`   Last modified: ${stats.mtime.toISOString()}`);
    }

    // Try to resolve package.json for additional info
    try {
      const packageJsonPath = require.resolve('@tw-enigma/scramble/package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        logger.info(`   Package version: ${packageJson.version || 'unknown'}`);
        logger.info(`   Package main: ${packageJson.main || 'none'}`);
        if (packageJson.exports) {
          logger.info(`   Package exports: configured`);
        }
      }
    } catch (e) {
      logger.info('   Package.json: not found via require.resolve');
    }

    // Check if this is from cache
    const cacheKey = process.cwd();
    if (packageResolutionCache.has(cacheKey)) {
      logger.info(`   Resolution method: cached`);
    } else {
      logger.info(`   Resolution method: fresh lookup`);
    }
  } catch (e) {
    logger.warn(`   Error getting package details: ${e}`);
  }
}

/**
 * Detect scramble package in the workspace with enhanced Node.js resolution semantics
 * Follows Node.js module resolution algorithm with support for package.json fields
 */
async function detectScramblePackage(): Promise<string | null> {
  const cacheKey = process.cwd();

  // Check cache first for performance
  if (packageResolutionCache.has(cacheKey)) {
    return packageResolutionCache.get(cacheKey) || null;
  }

  try {
    let resolvedPath: string | null = null;

    // 1. Try monorepo-style resolution with multiple possible paths
    const monorepoPatterns = [
      'packages-private/scramble/dist/scramble.min.js',
      'packages-private/scramble/dist/index.js',
      'packages-private/scramble/src/index.ts',
      'packages/scramble/dist/scramble.min.js',
      'packages/scramble/dist/index.js',
    ];

    for (const pattern of monorepoPatterns) {
      const packagePath = resolve(process.cwd(), pattern);
      if (existsSync(packagePath)) {
        resolvedPath = packagePath;
        break;
      }
    }

    // 2. Try package.json-based resolution for npm packages
    if (!resolvedPath) {
      resolvedPath = await resolvePackageWithPackageJson('@tw-enigma/scramble');
    }

    // 3. Fallback to standard require.resolve
    if (!resolvedPath) {
      try {
        resolvedPath = require.resolve('@tw-enigma/scramble/dist/scramble.min.js');
      } catch (e) {
        // Try alternative entry points
        const altEntryPoints = [
          '@tw-enigma/scramble',
          '@tw-enigma/scramble/dist/index.js',
          '@tw-enigma/scramble/src/index.ts',
        ];

        for (const entry of altEntryPoints) {
          try {
            resolvedPath = require.resolve(entry);
            break;
          } catch (resolveError) {
            // Continue to next entry point
          }
        }
      }
    }

    // 4. Validate resolved path exists and is accessible
    if (resolvedPath && existsSync(resolvedPath)) {
      // Cache successful resolution
      packageResolutionCache.set(cacheKey, resolvedPath);
      return resolvedPath;
    }

    // Cache negative result to avoid repeated failed lookups
    packageResolutionCache.set(cacheKey, null);
    return null;
  } catch (e) {
    console.warn('⚠️ Error detecting scramble package:', e);
    packageResolutionCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Resolve package using package.json fields (exports, main, module)
 * Follows Node.js package.json resolution semantics
 */
async function resolvePackageWithPackageJson(packageName: string): Promise<string | null> {
  try {
    // Try to find the package.json first
    let packageJsonPath: string;
    try {
      packageJsonPath = require.resolve(`${packageName}/package.json`);
    } catch (e) {
      return null;
    }

    if (!existsSync(packageJsonPath)) {
      return null;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const packageDir = dirname(packageJsonPath);

    // 1. Check exports field (modern Node.js)
    if (packageJson.exports) {
      const exportPath = resolveExportsField(packageJson.exports, packageDir);
      if (exportPath && existsSync(exportPath)) {
        return exportPath;
      }
    }

    // 2. Check module field (ES modules)
    if (packageJson.module) {
      const modulePath = resolve(packageDir, packageJson.module);
      if (existsSync(modulePath)) {
        return modulePath;
      }
    }

    // 3. Check main field (CommonJS)
    if (packageJson.main) {
      const mainPath = resolve(packageDir, packageJson.main);
      if (existsSync(mainPath)) {
        return mainPath;
      }
    }

    // 4. Fallback to index.js
    const indexPath = resolve(packageDir, 'index.js');
    if (existsSync(indexPath)) {
      return indexPath;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Resolve exports field from package.json
 * Supports basic exports field resolution patterns
 */
function resolveExportsField(exports: any, packageDir: string): string | null {
  try {
    // Handle string exports
    if (typeof exports === 'string') {
      return resolve(packageDir, exports);
    }

    // Handle object exports
    if (typeof exports === 'object' && exports !== null) {
      // Check for "." entry (main export)
      if (exports['.']) {
        const mainExport = exports['.'];
        if (typeof mainExport === 'string') {
          return resolve(packageDir, mainExport);
        }
        if (typeof mainExport === 'object') {
          // Check for import/require/default conditions
          const conditions = ['import', 'require', 'default'];
          for (const condition of conditions) {
            if (mainExport[condition] && typeof mainExport[condition] === 'string') {
              return resolve(packageDir, mainExport[condition]);
            }
          }
        }
      }

      // Check for direct string values
      if (exports.import && typeof exports.import === 'string') {
        return resolve(packageDir, exports.import);
      }
      if (exports.require && typeof exports.require === 'string') {
        return resolve(packageDir, exports.require);
      }
      if (exports.default && typeof exports.default === 'string') {
        return resolve(packageDir, exports.default);
      }
    }

    return null;
  } catch (e) {
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
      CHARSET: options.scrambleCharset || 'abcdefghijklmnopqrstuvwxyz',
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
      'abcdefghijklmnopqrstuvwxyz'
    )
    .option('--build-scramble', 'Build scramble package before integration')
    .option('--template <path>', 'Path to scramble template file (overrides package detection)')
    .option('--skip-html-injection', 'Skip automatic HTML injection')
    .option('--force', 'Force overwrite existing scramble scripts')
    .option('--test-resolution', 'Test package resolution without performing integration')
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
            const templateDiagnostics = await diagnoseTemplateFileFailure(allOptions.template);
            throw new TemplateFileError(
              `Template file not found: ${scramblePackagePath}`,
              templateDiagnostics
            );
          }
          logger.info(`Using template: ${scramblePackagePath}`);
        } else {
          // Detect scramble package with enhanced logging
          if (allOptions.debug) {
            logger.info('🔍 Starting enhanced package discovery...');
          }

          scramblePackagePath = await detectScramblePackage();

          if (!scramblePackagePath) {
            if (allOptions.debug) {
              logger.info('❌ Package resolution failed, generating diagnostics...');
            }
            const diagnostics = await diagnosePackageResolutionFailure();
            throw new PackageResolutionError(
              '⚠️ Scramble effect requires @tw-enigma/scramble package, which was not found.',
              diagnostics
            );
          }

          logger.info(`✅ Found scramble package: ${scramblePackagePath}`);

          // Additional debug information in debug mode
          if (allOptions.debug) {
            await logPackageResolutionDetails(scramblePackagePath, logger);
          }
        }

        // If testing resolution only, exit after successful resolution
        if (allOptions.testResolution) {
          logger.info('🧪 Package resolution test completed successfully!');
          logger.info('📋 Resolution details:');
          await logPackageResolutionDetails(scramblePackagePath, logger);

          // Test template processing if template provided
          if (allOptions.template && scramblePackagePath) {
            try {
              const templateContent = readFileSync(scramblePackagePath, 'utf8');
              logger.info('✅ Template file is readable');
              logger.info(`📄 Template size: ${(templateContent.length / 1024).toFixed(2)} KB`);

              // Test template processing without side effects
              const testConfig = {
                SCRAMBLE_INTERVAL: 150,
                SCRAMBLE_MODE: 'all',
                DEBUG_MODE: false,
              };

              const result = processScrambleTemplate(templateContent, testConfig, { debug: false });
              if (result.errors.length === 0) {
                logger.info('✅ Template processing test passed');
              } else {
                logger.warn(`⚠️ Template processing has ${result.errors.length} errors`);
                result.errors.forEach((error) => logger.warn(`   - ${error}`));
              }
            } catch (e) {
              logger.error(`❌ Template processing test failed: ${e}`);
            }
          }

          logger.info('🎉 Package resolution testing completed!');
          return;
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
