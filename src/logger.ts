/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import chalk from 'chalk';

/**
 * Log levels following Log4j standard
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

/**
 * Log level names for easy reference
 */
export const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.TRACE]: 'TRACE',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

/**
 * Chalk color functions for each log level
 */
const LogLevelColors = {
  [LogLevel.TRACE]: chalk.gray,
  [LogLevel.DEBUG]: chalk.cyan,
  [LogLevel.INFO]: chalk.blue,
  [LogLevel.WARN]: chalk.yellow,
  [LogLevel.ERROR]: chalk.red,
  [LogLevel.FATAL]: chalk.magenta,
};

/**
 * Configuration options for the logger
 */
export interface LoggerOptions {
  level?: LogLevel;
  verbose?: boolean;
  silent?: boolean;
  outputFormat?: 'human' | 'json';
  colorize?: boolean;
  timestamp?: boolean;
  component?: string;
}

/**
 * Structured log entry for JSON output
 */
export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  component?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Enhanced error context for detailed logging
 */
export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  filePath?: string;
  processingTime?: number;
  [key: string]: unknown;
}

/**
 * Centralized logger class for the Tailwind Enigma Core application
 */
export class Logger {
  private level: LogLevel;
  private verbose: boolean;
  private silent: boolean;
  private outputFormat: 'human' | 'json';
  private colorize: boolean;
  private timestamp: boolean;
  private component?: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.verbose = options.verbose ?? false;
    this.silent = options.silent ?? false;
    this.outputFormat = options.outputFormat ?? 'human';
    this.colorize = options.colorize ?? true;
    this.timestamp = options.timestamp ?? true;
    this.component = options.component;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Enable or disable verbose logging
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
    if (verbose && this.level > LogLevel.DEBUG) {
      this.level = LogLevel.DEBUG;
    }
  }

  /**
   * Enable or disable silent mode
   */
  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  /**
   * Set output format
   */
  setOutputFormat(format: 'human' | 'json'): void {
    this.outputFormat = format;
  }

  /**
   * Create a child logger with additional context
   */
  child(component: string, options: Partial<LoggerOptions> = {}): Logger {
    return new Logger({
      level: this.level,
      verbose: this.verbose,
      silent: this.silent,
      outputFormat: this.outputFormat,
      colorize: this.colorize,
      timestamp: this.timestamp,
      component,
      ...options,
    });
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.silent) return false;
    return level >= this.level;
  }

  /**
   * Format timestamp
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Create a structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: ErrorContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level: LogLevelNames[level],
      message,
      timestamp: this.getTimestamp(),
    };

    if (this.component) {
      entry.component = this.component;
    }

    if (context && Object.keys(context).length > 0) {
      entry.context = { ...context };
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  /**
   * Format log entry for human-readable output
   */
  private formatHuman(entry: LogEntry): string {
    const levelName = entry.level.padEnd(5);
    const colorFn = LogLevelColors[LogLevel[entry.level as keyof typeof LogLevel]];
    
    let output = '';
    
    if (this.timestamp) {
      output += chalk.gray(`[${entry.timestamp}] `);
    }
    
    if (this.colorize) {
      output += colorFn(`${levelName} `);
    } else {
      output += `${levelName} `;
    }
    
    if (entry.component) {
      output += chalk.gray(`[${entry.component}] `);
    }
    
    output += entry.message;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      output += chalk.gray(` ${JSON.stringify(entry.context)}`);
    }
    
    if (entry.error) {
      output += '\n' + (entry.error.stack || `${entry.error.name}: ${entry.error.message}`);
    }
    
    return output;
  }

  /**
   * Output a log entry
   */
  private output(entry: LogEntry): void {
    if (this.outputFormat === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      console.log(this.formatHuman(entry));
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: ErrorContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error);
    this.output(entry);
  }

  /**
   * Log a trace message (most verbose)
   */
  trace(message: string, context?: ErrorContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: ErrorContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: ErrorContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: ErrorContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   */
  error(messageOrError: string | Error, context?: ErrorContext): void {
    if (messageOrError instanceof Error) {
      this.log(LogLevel.ERROR, messageOrError.message, context, messageOrError);
    } else {
      this.log(LogLevel.ERROR, messageOrError, context);
    }
  }

  /**
   * Log a fatal error message
   */
  fatal(messageOrError: string | Error, context?: ErrorContext): void {
    if (messageOrError instanceof Error) {
      this.log(LogLevel.FATAL, messageOrError.message, context, messageOrError);
    } else {
      this.log(LogLevel.FATAL, messageOrError, context);
    }
  }

  /**
   * Log performance timing
   */
  timing(operation: string, duration: number, context?: ErrorContext): void {
    const extendedContext = {
      ...context,
      operation,
      processingTime: duration,
    };
    this.debug(`Operation "${operation}" completed in ${duration}ms`, extendedContext);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  verbose: process.env.ENIGMA_VERBOSE === 'true',
  colorize: process.stdout.isTTY,
  timestamp: true,
});

/**
 * Create a logger with specific component context
 */
export function createLogger(component: string, options?: Partial<LoggerOptions>): Logger {
  return logger.child(component, options);
} 