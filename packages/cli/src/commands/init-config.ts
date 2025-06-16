/**
 * Init Config Command
 * 
 * Creates a sample configuration file for tw-enigma.
 * Migrated from the main CLI file to support modular command structure.
 */

import { Command } from 'commander';
import { createSampleConfig } from '@tw-enigma/core';
import { createLoggerFromArgv, addCommonOptions, handleCLIError } from '../utils';

/**
 * Create and configure the init-config command
 */
export function createInitConfigCommand(): Command {
  const command = new Command('init-config')
    .description('Create a sample configuration file')
    .action(async (options, cmd) => {
      const logger = createLoggerFromArgv(cmd.optsWithGlobals());
      
      try {
        const sampleConfig = createSampleConfig();
        logger.info("Sample configuration file content:");
        console.log(sampleConfig); // Keep raw output for config content
        logger.info("Save this as enigma.config.js in your project root.");
      } catch (error) {
        handleCLIError(error, logger);
      }
    });

  // Add common CLI options
  return addCommonOptions(command);
} 