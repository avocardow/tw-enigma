/**
 * CSS Config Command
 *
 * Generate and validate CSS output configuration.
 * Migrated from the main CLI file to support modular command structure.
 */

import {
  createPerformanceBudget,
  createProductionConfigManager,
  generateConfigDocs,
  validateProductionConfig,
} from '@tw-enigma/core';
import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  addCommonOptions,
  CLIErrors,
  createLoggerFromArgv,
  getPackageInfo,
  handleCLIError,
} from '../utils';

/**
 * Create and configure the css-config command
 */
export function createCssConfigCommand(): Command {
  const command = new Command('css-config')
    .description('Generate and validate CSS output configuration')
    .option(
      '--preset <preset>',
      'Configuration preset to generate (choices: production, development, cdn, serverless, spa, ssr)'
    )
    .option('--validate <path>', 'Path to configuration file to validate')
    .option('--docs', 'Generate configuration documentation')
    .option('--budget', 'Include performance budget configuration')
    .option('--save <path>', 'Save configuration to file path')
    .action(async (options, cmd) => {
      const logger = createLoggerFromArgv(cmd.optsWithGlobals());

      try {
        if (options.validate) {
          // Validate existing configuration
          const configPath = resolve(options.validate);
          let configData;

          try {
            configData = JSON.parse(readFileSync(configPath, 'utf8'));
          } catch {
            throw CLIErrors.fileNotAccessible(
              configPath,
              'Cannot read or parse configuration file'
            );
          }

          const validation = validateProductionConfig(configData);

          if (validation.isValid) {
            logger.info('✅ Configuration is valid');
          } else {
            logger.error('❌ Configuration validation failed');
            validation.errors.forEach((error: string) => logger.error(`  • ${error}`));
          }

          validation.warnings.forEach((warning: string) => logger.warn(`⚠️  ${warning}`));
          validation.suggestions.forEach((rec: string) => logger.info(`💡 ${rec}`));

          return;
        }

        // Generate configuration
        const manager = createProductionConfigManager();
        let config;

        if (options.preset) {
          if (options.preset === 'production' || options.preset === 'development') {
            config = manager.applyPreset(options.preset);
          } else {
            config = manager.createOptimizedPreset(
              options.preset as 'cdn' | 'serverless' | 'spa' | 'ssr'
            );
          }
          logger.info(`📋 Generated ${options.preset} configuration preset`);
        } else {
          config = manager.getConfig();
        }

        // Add performance budget if requested
        if (options.budget) {
          const budget = createPerformanceBudget({});
          manager.setPerformanceBudget(budget);
          logger.info('📊 Added performance budget configuration');
        }

        // Generate documentation if requested
        if (options.docs) {
          const docs = generateConfigDocs();
          console.log(docs);
        }

        // Save configuration if requested
        if (options.save) {
          const savePath = resolve(options.save);
          const packageInfo = getPackageInfo();
          const output = {
            cssOutput: config,
            ...(options.budget ? { performanceBudget: manager.getPerformanceBudget() } : {}),
            generated: {
              timestamp: new Date().toISOString(),
              preset: options.preset,
              version: packageInfo.version,
            },
          };

          writeFileSync(savePath, JSON.stringify(output, null, 2));
          logger.info('💾 Configuration saved', { path: savePath });
        } else {
          // Display configuration
          console.log(JSON.stringify(config, null, 2));
        }
      } catch (error) {
        handleCLIError(error, logger);
      }
    });

  // Add common CLI options
  return addCommonOptions(command);
}
