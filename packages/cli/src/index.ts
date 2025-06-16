/**
 * @tw-enigma/cli - Command Line Interface Package
 * 
 * Main entry point for the CLI package, providing command-line tools
 * for tw-enigma CSS optimization.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Get package version information - CommonJS compatible approach
let packageJson: any;
try {
  // Try to load package.json from the expected location
  packageJson = require('../package.json');
} catch {
  // Fallback for cases where require doesn't work
  packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
}

/**
 * CLI package version
 */
export const version = packageJson.version;

/**
 * CLI version alias for compatibility
 */
export const cliVersion = packageJson.version;

/**
 * CLI package name
 */
export const name = packageJson.name;

// Export utilities for use in commands and external packages
export * from './utils';

// Export command creators for external use
export * from './commands';

/**
 * Default export with essential CLI information
 */
export default {
  version,
  cliVersion,
  name,
}; 