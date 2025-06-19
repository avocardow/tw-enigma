/**
 * Template Command
 *
 * Processes templates with placeholder replacement for the scramble package.
 * Supports configuration injection and template validation.
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { extname, resolve } from 'path';
import { addCommonOptions, createLoggerFromArgv, handleCLIError } from '../utils';
import {
  processScrambleTemplate,
  TemplateProcessor,
  type TemplateConfig,
} from '../utils/template-processor';

/**
 * Create and configure the template command
 */
export function createTemplateCommand(): Command {
  const command = new Command('template')
    .description('Process templates with placeholder replacement')
    .argument('<template-file>', 'Path to the template file to process')
    .option(
      '-o, --output <file>',
      'Output file path (default: same as input with .processed extension)'
    )
    .option('-c, --config <config>', 'JSON configuration string for placeholders')
    .option('--config-file <file>', 'Path to JSON configuration file')
    .option('--validate-only', 'Only validate template syntax without processing')
    .option('--strict', 'Use strict mode (fail on missing placeholders)')
    .option('--scramble', 'Use scramble template defaults')
    .option(
      '--set <key=value...>',
      'Set individual placeholder values (e.g., --set DEBUG_MODE=true INTERVAL=200)'
    )
    .action(async (templateFile: string, options, cmd) => {
      const logger = createLoggerFromArgv(cmd.optsWithGlobals());
      const allOptions = cmd.optsWithGlobals();

      try {
        // Resolve template file path
        const templatePath = resolve(templateFile);
        if (!existsSync(templatePath)) {
          throw new Error(`Template file not found: ${templatePath}`);
        }

        // Read template content
        const templateContent = readFileSync(templatePath, 'utf-8');
        logger.info(`Processing template: ${templatePath}`);

        if (allOptions.debug) {
          logger.info(`\n🐛 DEBUG MODE ENABLED\n`);
          logger.info(`📁 Template file: ${templatePath}`);
          logger.info(`📏 Template size: ${templateContent.length} characters`);
          logger.info(`⚙️  Options: ${JSON.stringify(allOptions, null, 2)}`);
        }

        // Initialize processor
        const processor = new TemplateProcessor({
          strict: allOptions.strict || false,
          debug: allOptions.debug || false,
        });

        // Validate-only mode
        if (allOptions.validateOnly) {
          const validation = processor.validateTemplate(templateContent);

          if (allOptions.debug && validation.debug) {
            logger.info(`\n🔍 VALIDATION DEBUG STEPS:`);
            validation.debug.forEach((step, index) => {
              logger.info(`  ${index + 1}. ${step}`);
            });
          }

          if (validation.isValid) {
            logger.info('✅ Template validation passed');
            return;
          } else {
            logger.error('❌ Template validation failed:');
            validation.errors.forEach((error) => logger.error(`  - ${error}`));
            process.exit(1);
          }
        }

        // Build configuration
        let config: TemplateConfig = {};

        if (allOptions.debug) {
          logger.info(`\n🔧 CONFIGURATION BUILDING:`);
        }

        // Load from config file if specified
        if (allOptions.configFile) {
          const configPath = resolve(allOptions.configFile);
          if (!existsSync(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
          }
          const configContent = readFileSync(configPath, 'utf-8');
          config = JSON.parse(configContent);
          logger.info(`Loaded configuration from: ${configPath}`);

          if (allOptions.debug) {
            logger.info(`  📄 File config: ${JSON.stringify(config, null, 2)}`);
          }
        }

        // Parse inline config JSON
        if (allOptions.config) {
          try {
            const inlineConfig = JSON.parse(allOptions.config);
            config = { ...config, ...inlineConfig };

            if (allOptions.debug) {
              logger.info(`  📝 Inline config: ${JSON.stringify(inlineConfig, null, 2)}`);
            }
          } catch (error) {
            throw new Error(`Invalid JSON in --config option: ${error.message}`);
          }
        }

        // Parse individual --set options
        if (allOptions.set) {
          const setOptions = Array.isArray(allOptions.set) ? allOptions.set : [allOptions.set];
          const setConfig: TemplateConfig = {};

          for (const setOption of setOptions) {
            const [key, ...valueParts] = setOption.split('=');
            if (!key || valueParts.length === 0) {
              throw new Error(`Invalid --set format: ${setOption}. Use --set KEY=VALUE`);
            }

            const value = valueParts.join('=');

            // Try to parse as number or boolean
            let parsedValue: string | number | boolean = value;
            if (value === 'true') parsedValue = true;
            else if (value === 'false') parsedValue = false;
            else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);

            config[key] = parsedValue;
            setConfig[key] = parsedValue;
          }

          if (allOptions.debug) {
            logger.info(`  🎯 --set config: ${JSON.stringify(setConfig, null, 2)}`);
          }
        }

        if (allOptions.debug) {
          logger.info(`  🎉 Final merged config: ${JSON.stringify(config, null, 2)}`);
        }

        // Process template
        let result;
        if (allOptions.scramble) {
          result = processScrambleTemplate(templateContent, config, { debug: allOptions.debug });
          logger.info('Using scramble template defaults');
        } else {
          result = processor.process(templateContent, config);
        }

        // Debug output
        if (allOptions.debug && result.debug) {
          logger.info(`\n🔄 PROCESSING DEBUG STEPS:`);
          result.debug.processingSteps.forEach((step, index) => {
            logger.info(`  ${index + 1}. ${step}`);
          });

          if (result.debug.replacementDetails.length > 0) {
            logger.info(`\n📊 REPLACEMENT DETAILS:`);
            result.debug.replacementDetails.forEach((detail, index) => {
              logger.info(`  ${index + 1}. {{${detail.placeholder}}}`);
              logger.info(
                `      Original: ${JSON.stringify(detail.originalValue)} (${detail.type})`
              );
              logger.info(`      Formatted: ${detail.formattedValue}`);
            });
          }
        }

        // Handle warnings and errors
        if (result.warnings.length > 0) {
          logger.warn('Warnings:');
          result.warnings.forEach((warning) => logger.warn(`  - ${warning}`));
        }

        if (result.errors.length > 0) {
          logger.error('Errors:');
          result.errors.forEach((error) => logger.error(`  - ${error}`));
          if (allOptions.strict) {
            process.exit(1);
          }
        }

        // Determine output path
        let outputPath = allOptions.output;
        if (!outputPath) {
          const ext = extname(templatePath);
          const baseName = templatePath.slice(0, -ext.length);
          outputPath = `${baseName}.processed${ext}`;
        }
        outputPath = resolve(outputPath);

        if (allOptions.debug) {
          logger.info(`\n📁 OUTPUT DETAILS:`);
          logger.info(`  📤 Output path: ${outputPath}`);
          logger.info(`  📏 Output size: ${result.output.length} characters`);
        }

        // Write output
        writeFileSync(outputPath, result.output, 'utf-8');
        logger.info(`✅ Template processed successfully`);
        logger.info(`📁 Output written to: ${outputPath}`);

        // Summary
        if (Object.keys(result.replacements).length > 0) {
          logger.info(`🔄 Replacements made: ${Object.keys(result.replacements).length}`);
          if (!allOptions.debug) {
            // Show replacements in summary if not already shown in debug mode
            Object.entries(result.replacements).forEach(([key, value]) => {
              logger.info(`  - ${key}: ${value}`);
            });
          }
        }

        if (allOptions.debug) {
          logger.info(`\n🎊 DEBUG SUMMARY:`);
          logger.info(`  📊 Template: ${result.debug?.templateLength} chars`);
          logger.info(`  🔍 Placeholders found: ${result.debug?.placeholdersFound.length}`);
          logger.info(`  🔧 Config keys provided: ${result.debug?.configKeys.length}`);
          logger.info(`  🔄 Replacements made: ${Object.keys(result.replacements).length}`);
          logger.info(`  ⚠️  Warnings: ${result.warnings.length}`);
          logger.info(`  ❌ Errors: ${result.errors.length}`);
          logger.info(`  📝 Processing steps: ${result.debug?.processingSteps.length}`);
        }
      } catch (error) {
        handleCLIError(error, logger);
        process.exit(1);
      }
    });

  // Add common CLI options
  return addCommonOptions(command);
}
