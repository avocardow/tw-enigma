/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * PostCSS Plugin for Tailwind Enigma
 * Integrates CSS optimization into the PostCSS processing pipeline
 */

import type { Plugin, Result, Root } from 'postcss';
import { z } from 'zod';

import { CssFormatter } from '../../css/cssFormatter';
import { CssOutputIntegration } from '../../css/cssOutputIntegration';
import { CssSyntaxValidator } from '../../css/syntaxValidator';
import { createLogger } from '../../utils/logger';

const logger = createLogger('postcss-plugin');

/**
 * PostCSS plugin configuration interface
 */
export interface PostCSSPluginConfig {
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
 * PostCSS plugin configuration schema
 */
export const postCSSPluginConfigSchema = z.object({
  name: z.string().default('postcss-tw-enigma'),
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
  /** Number of @apply directives processed */
  applyDirectivesProcessed: number;
  /** Validation errors found */
  validationErrors: number;
  /** Validation warnings found */
  validationWarnings: number;
}

/**
 * PostCSS Plugin for Tailwind Enigma CSS Optimization
 */
function createPostCSSPlugin(userConfig: PostCSSPluginConfig = {}): Plugin {
  // Validate and merge configuration
  const config = postCSSPluginConfigSchema.parse(userConfig);

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

        logger.debug('PostCSS processors initialized', {
          formatter: !!cssFormatter,
          validator: !!cssValidator,
          outputIntegration: !!cssOutputIntegration,
        });
      } catch (error) {
        logger.error('Failed to initialize PostCSS processors', { error });
        throw error;
      }
    }
  };

  return {
    postcssPlugin: config.name,

    /**
     * Process the CSS AST
     */
    Once: async (root: Root, { result }: { result: Result }): Promise<void> => {
      if (!config.enabled) {
        logger.debug('PostCSS plugin disabled, skipping processing');
        return;
      }

      const startTime = Date.now();
      const filePath = result.root.source?.input.from;

      // Check if file should be processed
      if (!shouldProcessFile(filePath, config)) {
        logger.debug('File excluded from processing', { filePath });
        return;
      }

      logger.debug('Processing CSS with TW-Enigma', { filePath });

      try {
        // Initialize processors
        initializeProcessors();

        // Get original CSS
        const originalCSS = root.toString();
        const originalSize = Buffer.byteLength(originalCSS, 'utf8');

        let processedCSS = originalCSS;
        let applyDirectivesProcessed = 0;
        let validationErrors = 0;
        let validationWarnings = 0;

        // Step 1: Process @apply directives if enabled
        if (config.processing.processApplyDirectives && cssOutputIntegration) {
          logger.debug('Processing @apply directives', { filePath });

          try {
            // Create patterns map from selectors
            const patternsMap = new Map<string, any>();
            const selectors = extractSelectorsFromRoot(root);

            selectors.forEach((selector, index) => {
              patternsMap.set(`pattern-${index}`, {
                pattern: selector,
                usage: 1,
                filePath: filePath || 'unknown',
              });
            });

            const outputResult = await cssOutputIntegration.generateCssWithOutput(
              patternsMap,
              'temp'
            );

            if (outputResult.files.length > 0) {
              processedCSS = outputResult.files[0].content;
              applyDirectivesProcessed = outputResult.statistics.totalRules;
              logger.debug('Apply directives processed', {
                count: applyDirectivesProcessed,
                filePath,
              });
            }
          } catch (error) {
            logger.warn('Failed to process @apply directives', { error, filePath });
          }
        }

        // Step 2: Validate CSS if enabled
        if (config.output.validate && cssValidator) {
          logger.debug('Validating CSS', { filePath });

          try {
            const validationResult = await cssValidator.validateCss(processedCSS, filePath);
            validationErrors = validationResult.summary.totalErrors;
            validationWarnings = validationResult.summary.warningCount;

            // Report validation results
            if (validationErrors > 0 || validationWarnings > 0) {
              logger.warn('CSS validation issues found', {
                errors: validationErrors,
                warnings: validationWarnings,
                filePath,
              });

              // Add validation messages to PostCSS result
              validationResult.errors.forEach((error) => {
                result.warn(error.message, {
                  node: root,
                });
              });
            }
          } catch (error) {
            logger.warn('CSS validation failed', { error, filePath });
          }
        }

        // Step 3: Format CSS if enabled
        if (config.output.format && cssFormatter) {
          logger.debug('Formatting CSS', { filePath });

          try {
            const formatResult = await cssFormatter.formatCss(processedCSS, filePath);
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

        // Step 4: Update the AST with processed CSS
        if (processedCSS !== originalCSS) {
          try {
            // Parse the processed CSS back into the AST
            const postcss = await import('postcss');
            const newRoot = postcss.parse(processedCSS, { from: filePath });

            // Replace root contents
            root.removeAll();
            root.append(newRoot.nodes);

            logger.debug('CSS AST updated with processed content', { filePath });
          } catch (error) {
            logger.error('Failed to update CSS AST', { error, filePath });
            throw error;
          }
        }

        // Calculate and log statistics
        const endTime = Date.now();
        const processedSize = Buffer.byteLength(processedCSS, 'utf8');
        const processingTime = endTime - startTime;

        const stats: ProcessingResult = {
          success: true,
          originalSize,
          processedSize,
          processingTime,
          applyDirectivesProcessed,
          validationErrors,
          validationWarnings,
        };

        if (config.debug.logStats) {
          logger.info('PostCSS processing completed', {
            filePath,
            ...stats,
            sizeChange: processedSize - originalSize,
            sizeChangePercent:
              (((processedSize - originalSize) / originalSize) * 100).toFixed(2) + '%',
          });
        }

        // Add processing metadata to result
        result.messages.push({
          type: 'dependency',
          plugin: config.name,
          file: filePath || 'unknown',
          message: JSON.stringify(stats),
        });
      } catch (error) {
        logger.error('PostCSS processing failed', { error, filePath });

        // Add error message to result
        result.warn(
          `TW-Enigma processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          {
            plugin: config.name,
          }
        );

        // Don't throw - let PostCSS continue with original CSS
      }
    },
  };
}

/**
 * Check if a file should be processed based on include/exclude patterns
 */
function shouldProcessFile(filePath: string | undefined, config: PostCSSPluginConfig): boolean {
  if (!filePath) return true;

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

/**
 * Extract selectors from PostCSS Root for @apply directive processing
 */
function extractSelectorsFromRoot(root: Root): string[] {
  const selectors: string[] = [];

  root.walkRules((rule) => {
    if (rule.selector) {
      selectors.push(rule.selector);
    }
  });

  return selectors;
}

// PostCSS plugin factory function
export default createPostCSSPlugin;

// Named export for explicit imports
export { createPostCSSPlugin };

// ES modules compatibility
createPostCSSPlugin.postcss = true;

/**
 * Plugin factory with default configuration
 */
export function postcssEnigma(config?: PostCSSPluginConfig): Plugin {
  return createPostCSSPlugin(config);
}

/**
 * Create plugin with development-optimized configuration
 */
export function postcssEnigmaDev(config: PostCSSPluginConfig = {}): Plugin {
  return createPostCSSPlugin({
    ...config,
    output: {
      minify: false,
      format: true,
      validate: true,
      formatStyle: 'pretty',
      ...config.output,
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
export function postcssEnigmaProd(config: PostCSSPluginConfig = {}): Plugin {
  return createPostCSSPlugin({
    ...config,
    output: {
      minify: false, // Let cssnano handle minification
      format: true,
      validate: false, // Skip validation in production for performance
      formatStyle: 'compact',
      ...config.output,
    },
    debug: {
      verbose: false,
      logStats: false,
      saveIntermediate: false,
      ...config.debug,
    },
  });
}
