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

      try {
        // Resolve template file path
        const templatePath = resolve(templateFile);
        if (!existsSync(templatePath)) {
          throw new Error(`Template file not found: ${templatePath}`);
        }

        // Read template content
        const templateContent = readFileSync(templatePath, 'utf-8');
        logger.info(`Processing template: ${templatePath}`);

        // Initialize processor
        const processor = new TemplateProcessor({
          strict: options.strict || false,
        });

        // Validate-only mode
        if (options.validateOnly) {
          const validation = processor.validateTemplate(templateContent);

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

        // Load from config file if specified
        if (options.configFile) {
          const configPath = resolve(options.configFile);
          if (!existsSync(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
          }
          const configContent = readFileSync(configPath, 'utf-8');
          config = JSON.parse(configContent);
          logger.info(`Loaded configuration from: ${configPath}`);
        }

        // Parse inline config JSON
        if (options.config) {
          try {
            const inlineConfig = JSON.parse(options.config);
            config = { ...config, ...inlineConfig };
          } catch (error) {
            throw new Error(`Invalid JSON in --config option: ${error.message}`);
          }
        }

        // Parse individual --set options
        if (options.set) {
          const setOptions = Array.isArray(options.set) ? options.set : [options.set];
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
          }
        }

        // Process template
        let result;
        if (options.scramble) {
          result = processScrambleTemplate(templateContent, config);
          logger.info('Using scramble template defaults');
        } else {
          result = processor.process(templateContent, config);
        }

        // Handle warnings and errors
        if (result.warnings.length > 0) {
          logger.warn('Warnings:');
          result.warnings.forEach((warning) => logger.warn(`  - ${warning}`));
        }

        if (result.errors.length > 0) {
          logger.error('Errors:');
          result.errors.forEach((error) => logger.error(`  - ${error}`));
          if (options.strict) {
            process.exit(1);
          }
        }

        // Determine output path
        let outputPath = options.output;
        if (!outputPath) {
          const ext = extname(templatePath);
          const baseName = templatePath.slice(0, -ext.length);
          outputPath = `${baseName}.processed${ext}`;
        }
        outputPath = resolve(outputPath);

        // Write output
        writeFileSync(outputPath, result.output, 'utf-8');
        logger.info(`✅ Template processed successfully`);
        logger.info(`📁 Output written to: ${outputPath}`);

        // Summary
        if (Object.keys(result.replacements).length > 0) {
          logger.info(`🔄 Replacements made: ${Object.keys(result.replacements).length}`);
          Object.entries(result.replacements).forEach(([key, value]) => {
            logger.info(`  - ${key}: ${value}`);
          });
        }
      } catch (error) {
        handleCLIError(error, logger);
        process.exit(1);
      }
    });

  // Add common CLI options
  return addCommonOptions(command);
}
