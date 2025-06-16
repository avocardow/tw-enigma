/**
 * Command Registration System
 *
 * Centralized registration of all CLI commands for the enigma CLI.
 */

import { Command } from 'commander';
import { createCssConfigCommand } from './css-config.js';
import { createInitConfigCommand } from './init-config.js';

/**
 * Register all commands with the main program
 */
export function registerCommands(program: Command): void {
  // Configuration commands
  program.addCommand(createInitConfigCommand());
  program.addCommand(createCssConfigCommand());

  // TODO: Add remaining commands as they are migrated
  // program.addCommand(createCssOptimizeCommand());
  // program.addCommand(createCssAnalyzeCommand());
  // program.addCommand(createPluginCommand());
}

/**
 * Export command creators for individual use
 */
export { createCssConfigCommand, createInitConfigCommand };
