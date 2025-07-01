/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Rollup Plugin for Tailwind Enigma
 * Integrates CSS optimization into the Rollup build process
 */

import type { OutputBundle, Plugin } from 'rollup';
import { z } from 'zod';

import { CssFormatter } from '../../css/cssFormatter';
import { CssOutputIntegration } from '../../css/cssOutputIntegration';
import { CssSyntaxValidator } from '../../css/syntaxValidator';
import { createLogger } from '../../utils/logger';

const logger = createLogger('rollup-plugin');

/**
 * Rollup plugin configuration interface
 */
export interface RollupPluginConfig {
  /** Plugin name for debugging */
  name?: string;

  /** Enable/disable the plugin */
  enabled?: boolean;

  /** TW-Enigma configuration file path */
  configPath?: string;

  /** CSS output optimization options */
  output?: {
    /** Enable CSS minification */
    minify?: boolean;
    /** Enable CSS formatting */
    format?: boolean;
    /** Enable syntax validation */
    validate?: boolean;
    /** Output format for formatted CSS */
    formatStyle?: 'compact' | 'pretty' | 'readable';
  };

  /** Processing options */
  processing?: {
    /** Only process files matching these patterns */
    include?: string[];
    /** Skip files matching these patterns */
    exclude?: string[];
    /** Enable @apply directive processing */
    processApplyDirectives?: boolean;
    /** Enable Tailwind class optimization */
    optimizeTailwind?: boolean;
  };

  /** Build options */
  build?: {
    /** Apply during which build phase */
    phase?: 'transform' | 'generateBundle' | 'writeBundle';
    /** Preserve source maps */
    sourceMaps?: boolean;
    /** Watch mode behavior */
    watch?: {
      /** Enable HMR-like updates in watch mode */
      enableHotUpdates?: boolean;
      /** Debounce delay for file changes (ms) */
      debounceDelay?: number;
    };
  };

  /** Debug and logging options */
  debug?: {
    /** Enable verbose logging */
    verbose?: boolean;
    /** Log processing statistics */
    logStats?: boolean;
    /** Save intermediate results to files */
    saveIntermediate?: boolean;
  };
}

/**
 * Rollup plugin configuration schema
 */
export const rollupPluginConfigSchema = z.object({
  name: z.string().default('rollup-plugin-tw-enigma'),
  enabled: z.boolean().default(true),
  configPath: z.string().optional(),
  output: z
    .object({
      minify: z.boolean().default(false), // Let other plugins handle minification
      format: z.boolean().default(true),
      validate: z.boolean().default(true),
      formatStyle: z.enum(['compact', 'pretty', 'readable']).default('pretty'),
    })
    .default({}),
  processing: z
    .object({
      include: z.array(z.string()).default(['**/*.css']),
      exclude: z.array(z.string()).default(['node_modules/**']),
      processApplyDirectives: z.boolean().default(true),
      optimizeTailwind: z.boolean().default(true),
    })
    .default({}),
  build: z
    .object({
      phase: z.enum(['transform', 'generateBundle', 'writeBundle']).default('generateBundle'),
      sourceMaps: z.boolean().default(true),
      watch: z
        .object({
          enableHotUpdates: z.boolean().default(true),
          debounceDelay: z.number().default(100),
        })
        .default({}),
    })
    .default({}),
  debug: z
    .object({
      verbose: z.boolean().default(false),
      logStats: z.boolean().default(false),
      saveIntermediate: z.boolean().default(false),
    })
    .default({}),
});

/**
 * Processing result interface
 */
interface ProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  /** Original CSS size in bytes */
  originalSize: number;
  /** Processed CSS size in bytes */
  processedSize: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Number of CSS files processed */
  filesProcessed: number;
  /** Validation errors found */
  validationErrors: number;
  /** Validation warnings found */
  validationWarnings: number;
}

/**
 * Rollup Plugin for Tailwind Enigma CSS Optimization
 */
function createRollupPlugin(userConfig: RollupPluginConfig = {}): Plugin {
  // Validate and merge configuration
  const config = rollupPluginConfigSchema.parse(userConfig);

  let cssOutputIntegration: CssOutputIntegration | null = null;
  let cssFormatter: CssFormatter | null = null;
  let cssValidator: CssSyntaxValidator | null = null;

  // Initialize processors lazily
  const initializeProcessors = () => {
    if (!cssOutputIntegration) {
      try {
        cssOutputIntegration = new CssOutputIntegration({
          // Configuration will be loaded from config file or defaults
        });

        if (config.output.format) {
          cssFormatter = new CssFormatter({
            outputFormat: config.output.formatStyle,
            indentStyle: 'spaces',
            indentSize: 2,
          });
        }

        if (config.output.validate) {
          cssValidator = new CssSyntaxValidator({
            enablePostCssValidation: true,
            enableTailwindValidation: config.processing.optimizeTailwind,
            includeSuggestions: config.debug.verbose,
          });
        }

        logger.debug('Rollup processors initialized', {
          formatter: !!cssFormatter,
          validator: !!cssValidator,
          outputIntegration: !!cssOutputIntegration,
        });
      } catch (error) {
        logger.error('Failed to initialize Rollup processors', { error });
        throw error;
      }
    }
  };

  // Track processed files for watch mode
  const processedFiles = new Set<string>();
  let lastProcessTime = 0;

  return {
    name: config.name,

    /**
     * Build start hook
     */
    buildStart() {
      if (!config.enabled) {
        logger.debug('Rollup plugin disabled, skipping initialization');
        return;
      }

      logger.debug('TW-Enigma Rollup plugin initialized', {
        phase: config.build.phase,
        sourceMaps: config.build.sourceMaps,
      });

      // Initialize processors
      initializeProcessors();
    },

    /**
     * Transform hook - process individual files during transformation
     */
    async transform(code: string, id: string) {
      if (config.build.phase !== 'transform') return null;

      // Check if file should be processed
      if (!shouldProcessFile(id, config) || !isCSSFile(id)) {
        return null;
      }

      logger.debug('Transforming CSS file', { id });

      try {
        const result = await processCSS(code, id, config, {
          cssOutputIntegration,
          cssFormatter,
          cssValidator,
        });

        if (result.success && result.processedCSS !== code) {
          return {
            code: result.processedCSS,
            map: config.build.sourceMaps ? { mappings: '' } : null, // Preserve source maps
          };
        }

        return null;
      } catch (error) {
        logger.error('Transform failed', { error, id });
        return null;
      }
    },

    /**
     * Generate bundle hook - process CSS assets after bundling
     */
    async generateBundle(options, bundle: OutputBundle) {
      if (config.build.phase !== 'generateBundle') return;

      if (!config.enabled) {
        logger.debug('Rollup plugin disabled, skipping bundle generation');
        return;
      }

      const startTime = Date.now();
      const results: ProcessingResult[] = [];

      logger.debug('Processing CSS assets in bundle', {
        assetCount: Object.keys(bundle).length,
      });

      // Process CSS assets in the bundle
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && isCSSFile(fileName) && shouldProcessFile(fileName, config)) {
          try {
            const originalSource =
              typeof asset.source === 'string' ? asset.source : asset.source.toString();

            const result = await processCSS(originalSource, fileName, config, {
              cssOutputIntegration,
              cssFormatter,
              cssValidator,
            });

            if (result.success && result.processedCSS !== originalSource) {
              // Update the asset source
              asset.source = result.processedCSS;

              logger.debug('CSS asset processed successfully', {
                fileName,
                originalSize: result.originalSize,
                processedSize: result.processedSize,
                sizeChange: result.processedSize - result.originalSize,
              });
            }

            results.push(result);
          } catch (error) {
            logger.error('Failed to process CSS asset', { error, fileName });
          }
        }
      }

      // Log overall statistics
      if (config.debug.logStats && results.length > 0) {
        const totalStats = results.reduce(
          (acc, result) => ({
            filesProcessed: acc.filesProcessed + (result.success ? 1 : 0),
            originalSize: acc.originalSize + result.originalSize,
            processedSize: acc.processedSize + result.processedSize,
            processingTime: acc.processingTime + result.processingTime,
            validationErrors: acc.validationErrors + result.validationErrors,
            validationWarnings: acc.validationWarnings + result.validationWarnings,
          }),
          {
            filesProcessed: 0,
            originalSize: 0,
            processedSize: 0,
            processingTime: 0,
            validationErrors: 0,
            validationWarnings: 0,
          }
        );

        logger.info('Rollup CSS processing completed', {
          ...totalStats,
          totalTime: Date.now() - startTime,
          sizeChange: totalStats.processedSize - totalStats.originalSize,
          sizeChangePercent:
            totalStats.originalSize > 0
              ? (
                  ((totalStats.processedSize - totalStats.originalSize) / totalStats.originalSize) *
                  100
                ).toFixed(2) + '%'
              : '0%',
        });
      }
    },

    /**
     * Watch change hook - handle file changes in watch mode
     */
    watchChange(id: string) {
      if (!config.build.watch?.enableHotUpdates) return;

      // Debounce file changes
      const now = Date.now();
      if (now - lastProcessTime < config.build.watch.debounceDelay) {
        return;
      }
      lastProcessTime = now;

      if (shouldProcessFile(id, config) && isCSSFile(id)) {
        processedFiles.add(id);
        logger.debug('CSS file changed, marked for reprocessing', { id });
      }
    },
  };
}

/**
 * Process CSS content with TW-Enigma optimization
 */
async function processCSS(
  css: string,
  filePath: string,
  config: RollupPluginConfig,
  processors: {
    cssOutputIntegration: CssOutputIntegration | null;
    cssFormatter: CssFormatter | null;
    cssValidator: CssSyntaxValidator | null;
  }
): Promise<ProcessingResult & { processedCSS: string }> {
  const startTime = Date.now();
  const originalSize = Buffer.byteLength(css, 'utf8');

  let processedCSS = css;
  let validationErrors = 0;
  let validationWarnings = 0;

  try {
    // Step 1: Process @apply directives if enabled
    if (config.processing?.processApplyDirectives && processors.cssOutputIntegration) {
      logger.debug('Processing @apply directives', { filePath });

      try {
        // Create basic patterns map for processing
        const patternsMap = new Map<string, any>();
        patternsMap.set('default', {
          pattern: css,
          usage: 1,
          filePath,
        });

        const outputResult = await processors.cssOutputIntegration.generateCssWithOutput(
          patternsMap,
          'temp'
        );

        if (outputResult.files.length > 0) {
          processedCSS = outputResult.files[0].content;
          logger.debug('Apply directives processed', { filePath });
        }
      } catch (error) {
        logger.warn('Failed to process @apply directives', { error, filePath });
      }
    }

    // Step 2: Validate CSS if enabled
    if (config.output?.validate && processors.cssValidator) {
      logger.debug('Validating CSS', { filePath });

      try {
        const validationResult = await processors.cssValidator.validateCss(processedCSS, filePath);
        validationErrors = validationResult.summary.totalErrors;
        validationWarnings = validationResult.summary.warningCount;

        if (validationErrors > 0 || validationWarnings > 0) {
          logger.warn('CSS validation issues found', {
            errors: validationErrors,
            warnings: validationWarnings,
            filePath,
          });
        }
      } catch (error) {
        logger.warn('CSS validation failed', { error, filePath });
      }
    }

    // Step 3: Format CSS if enabled
    if (config.output?.format && processors.cssFormatter) {
      logger.debug('Formatting CSS', { filePath });

      try {
        const formatResult = await processors.cssFormatter.formatCss(processedCSS, filePath);
        if (formatResult.success) {
          processedCSS = formatResult.css;
          logger.debug('CSS formatted successfully', {
            originalSize: formatResult.stats.originalSize,
            formattedSize: formatResult.stats.formattedSize,
            filePath,
          });
        }
      } catch (error) {
        logger.warn('CSS formatting failed', { error, filePath });
      }
    }

    const endTime = Date.now();
    const processedSize = Buffer.byteLength(processedCSS, 'utf8');

    return {
      success: true,
      originalSize,
      processedSize,
      processingTime: endTime - startTime,
      filesProcessed: 1,
      validationErrors,
      validationWarnings,
      processedCSS,
    };
  } catch (error) {
    logger.error('CSS processing failed', { error, filePath });

    return {
      success: false,
      originalSize,
      processedSize: originalSize,
      processingTime: Date.now() - startTime,
      filesProcessed: 0,
      validationErrors: 1,
      validationWarnings: 0,
      processedCSS: css, // Return original CSS on error
    };
  }
}

/**
 * Check if a file should be processed based on include/exclude patterns
 */
function shouldProcessFile(filePath: string, config: RollupPluginConfig): boolean {
  if (!filePath) return false;

  const { include = ['**/*.css'], exclude = ['node_modules/**'] } = config.processing || {};

  // Check exclude patterns first
  for (const pattern of exclude) {
    if (matchesGlob(filePath, pattern)) {
      return false;
    }
  }

  // Check include patterns
  for (const pattern of include) {
    if (matchesGlob(filePath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if file is a CSS file
 */
function isCSSFile(filePath: string): boolean {
  return /\.css$/i.test(filePath);
}

/**
 * Simple glob pattern matching
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '.*') // ** matches any path
    .replace(/\*/g, '[^/]*') // * matches anything except path separator
    .replace(/\?/g, '.') // ? matches single character
    .replace(/\./g, '\\.'); // Escape dots

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

// Plugin factory function
export default createRollupPlugin;

// Named export for explicit imports
export { createRollupPlugin };

/**
 * Plugin factory with default configuration
 */
export function rollupEnigma(config?: RollupPluginConfig): Plugin {
  return createRollupPlugin(config);
}

/**
 * Create plugin with development-optimized configuration
 */
export function rollupEnigmaDev(config: RollupPluginConfig = {}): Plugin {
  return createRollupPlugin({
    ...config,
    output: {
      minify: false,
      format: true,
      validate: true,
      formatStyle: 'pretty',
      ...config.output,
    },
    build: {
      phase: 'transform', // Process during transform for faster feedback
      sourceMaps: true,
      watch: {
        enableHotUpdates: true,
        debounceDelay: 100,
      },
      ...config.build,
    },
    debug: {
      verbose: true,
      logStats: true,
      saveIntermediate: false,
      ...config.debug,
    },
  });
}

/**
 * Create plugin with production-optimized configuration
 */
export function rollupEnigmaProd(config: RollupPluginConfig = {}): Plugin {
  return createRollupPlugin({
    ...config,
    output: {
      minify: false, // Let other plugins handle minification
      format: true,
      validate: false, // Skip validation in production for performance
      formatStyle: 'compact',
      ...config.output,
    },
    build: {
      phase: 'generateBundle', // Process after bundling for final optimization
      sourceMaps: false, // Disable source maps for production
      watch: {
        enableHotUpdates: false,
        debounceDelay: 200,
      },
      ...config.build,
    },
    debug: {
      verbose: false,
      logStats: false,
      saveIntermediate: false,
      ...config.debug,
    },
  });
}
