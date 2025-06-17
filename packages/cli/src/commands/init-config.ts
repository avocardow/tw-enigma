/**
 * Init Config Command
 *
 * Creates a sample configuration file for tw-enigma.
 * Migrated from the main CLI file to support modular command structure.
 */

import { createSampleConfig } from '@tw-enigma/core';
import { Command } from 'commander';
import { addCommonOptions, createLoggerFromArgv, handleCLIError } from '../utils';

// Interface for init-config command options
interface InitConfigOptions {
  config?: string;
  optsWithGlobals(): any;
}

/**
 * Create and configure the init-config command
 */
export function createInitConfigCommand(): Command {
  // Test core import immediately for CI debugging
  if (process.env.CI) {
    try {
      const testConfig = createSampleConfig();
      if (!testConfig || typeof testConfig !== 'string') {
        console.error('ERROR: createSampleConfig import failed or returned invalid data');
      }
    } catch (importError) {
      console.error('CRITICAL: @tw-enigma/core import failed in init-config:', importError);
    }
  }

  const command = new Command('init-config')
    .description('Create a sample configuration file')
    .action(async (options, cmd) => {
      console.error('[CLI-DEBUG] init-config action executing!');

      const logger = createLoggerFromArgv(cmd.optsWithGlobals());

      try {
        const sampleConfig = createSampleConfig();
        logger.info('Sample configuration file content:');
        console.log(sampleConfig); // Keep raw output for config content
        logger.info('Save this as enigma.config.js in your project root.');
        process.exit(0);
      } catch (error) {
        handleCLIError(error, logger);
        process.exit(1);
      }
    });

  // Add common CLI options
  return addCommonOptions(command);
}
