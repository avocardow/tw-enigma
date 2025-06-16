/**
 * CLI Logger Configuration Utility
 *
 * Handles logger configuration based on CLI arguments,
 * migrated from the main CLI file to support modular command structure.
 */

import { Logger, LogLevel, type FileOutputOptions } from '@tw-enigma/core';

/**
 * Update logger configuration based on CLI arguments
 */
export function createLoggerFromArgv(argv: Record<string, unknown>): Logger {
  // Parse log level
  let level: LogLevel = LogLevel.INFO;
  if (argv.logLevel) {
    switch (argv.logLevel) {
      case 'trace':
        level = LogLevel.TRACE;
        break;
      case 'debug':
        level = LogLevel.DEBUG;
        break;
      case 'info':
        level = LogLevel.INFO;
        break;
      case 'warn':
        level = LogLevel.WARN;
        break;
      case 'error':
        level = LogLevel.ERROR;
        break;
      case 'fatal':
        level = LogLevel.FATAL;
        break;
    }
  } else if (argv.veryVerbose) {
    level = LogLevel.TRACE;
  } else if (argv.verbose) {
    level = LogLevel.DEBUG;
  } else if (argv.quiet) {
    level = LogLevel.WARN;
  }

  // Create file output options if specified
  let fileOutput: FileOutputOptions | undefined;
  if (argv.logFile) {
    fileOutput = {
      filePath: argv.logFile as string,
      format: (argv.logFormat as 'human' | 'json' | 'csv') || 'human',
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      compress: true,
    };
  }

  // Create logger with configured options
  return new Logger({
    level,
    verbose: (argv.verbose as boolean) || false,
    veryVerbose: (argv.veryVerbose as boolean) || false,
    quiet: (argv.quiet as boolean) || false,
    colorize: process.stdout.isTTY,
    timestamp: true,
    component: 'CLI',
    fileOutput,
    enableProgressTracking: true,
  });
}

/**
 * Create a default CLI logger with standard configuration
 */
export function createDefaultCliLogger(): Logger {
  return new Logger({
    level: LogLevel.INFO,
    verbose: false,
    veryVerbose: false,
    quiet: false,
    colorize: process.stdout.isTTY,
    timestamp: true,
    component: 'CLI',
    fileOutput: undefined,
    enableProgressTracking: true,
  });
}
