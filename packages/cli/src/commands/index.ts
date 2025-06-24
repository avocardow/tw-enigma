/**
 * Command Registration System
 *
 * Centralized registration of all CLI commands for the enigma CLI.
 */

import { Command } from 'commander';
import { createCssConfigCommand } from './css-config';
import { enigmaCommand } from './enigma';
import { createInitConfigCommand } from './init-config';
import { createScrambleCommand } from './scramble';
import { createTemplateCommand } from './template';

/**
 * Register all commands with the main program
 */
export function registerCommands(program: Command): void {
  // Main enigma command
  console.error('[CLI-DEBUG] Creating enigma command...');
  console.error('[CLI-DEBUG] Adding enigma command to program...');
  program.addCommand(enigmaCommand);

  // Configuration commands
  console.error('[CLI-DEBUG] Creating init-config command...');
  const initConfigCommand = createInitConfigCommand();
  console.error('[CLI-DEBUG] Adding init-config command to program...');
  program.addCommand(initConfigCommand);

  console.error('[CLI-DEBUG] Creating css-config command...');
  const cssConfigCommand = createCssConfigCommand();
  console.error('[CLI-DEBUG] Adding css-config command to program...');
  program.addCommand(cssConfigCommand);

  console.error('[CLI-DEBUG] Creating template command...');
  const templateCommand = createTemplateCommand();
  console.error('[CLI-DEBUG] Adding template command to program...');
  program.addCommand(templateCommand);

  console.error('[CLI-DEBUG] Creating scramble command...');
  const scrambleCommand = createScrambleCommand();
  console.error('[CLI-DEBUG] Adding scramble command to program...');
  program.addCommand(scrambleCommand);

  // TODO: Add remaining commands as they are migrated
  // program.addCommand(createCssOptimizeCommand());
  // program.addCommand(createCssAnalyzeCommand());
  // program.addCommand(createPluginCommand());
}

/**
 * Export command creators for individual use
 */
export {
  createCssConfigCommand,
  createInitConfigCommand,
  createScrambleCommand,
  createTemplateCommand,
  enigmaCommand,
};

// Export the enigma action for main CLI use
export { enigmaAction } from './enigma';
