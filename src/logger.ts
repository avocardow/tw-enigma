/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import chalk from "chalk";
import {
  createWriteStream,
  WriteStream,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
  readdirSync,
} from "fs";
import { dirname, join } from "path";
import { gzipSync } from "zlib";

/**
 * Log levels following Log4j standard
 */
export const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

/**
 * Log level names for easy reference
 */
export const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.TRACE]: "TRACE",
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.FATAL]: "FATAL",
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
 * File output options for logging
 */
export interface FileOutputOptions {
  filePath: string;
  format?: "human" | "json" | "csv";
  maxSize?: number; // in bytes, default 10MB
  maxFiles?: number; // default 5
  compress?: boolean; // compress rotated files
}

/**
 * Progress tracking options
 */
export interface ProgressOptions {
  total: number;
  current?: number;
  label?: string;
  showPercentage?: boolean;
  showETA?: boolean;
}

/**
 * Configuration options for the logger
 */
export interface LoggerOptions {
  level?: LogLevel;
  verbose?: boolean;
  veryVerbose?: boolean;
  quiet?: boolean;
  silent?: boolean;
  outputFormat?: "human" | "json";
  colorize?: boolean;
  timestamp?: boolean;
  component?: string;
  fileOutput?: FileOutputOptions;
  enableProgressTracking?: boolean;
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
  memoryUsage?: number;
  fileSize?: number;
  compressionRatio?: number;
  [key: string]: unknown;
}

/**
 * Performance metrics for detailed logging
 */
export interface PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  processingTime: number;
  fileCount?: number;
  totalFileSize?: number;
  optimizationRatio?: number;
}

/**
 * Centralized logger class for the Tailwind Enigma Core application
 */
export class Logger {
  private level: LogLevel;
  private verbose: boolean;
  private veryVerbose: boolean;
  private quiet: boolean;
  private silent: boolean;
  private outputFormat: "human" | "json";
  private colorize: boolean;
  private timestamp: boolean;
  private component?: string;
  private fileOutput?: FileOutputOptions;
  private fileStream?: WriteStream;
  private enableProgressTracking: boolean;
  private progressStates: Map<string, ProgressOptions & { startTime: number }> =
    new Map();

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.verbose = options.verbose ?? false;
    this.veryVerbose = options.veryVerbose ?? false;
    this.quiet = options.quiet ?? false;
    this.silent = options.silent ?? false;
    this.outputFormat = options.outputFormat ?? "human";
    this.colorize = options.colorize ?? true;
    this.timestamp = options.timestamp ?? true;
    this.component = options.component;
    this.fileOutput = options.fileOutput;
    this.enableProgressTracking = options.enableProgressTracking ?? false;

    // Adjust verbosity levels
    if (this.veryVerbose) {
      this.verbose = true;
      if (this.level > LogLevel.TRACE) {
        this.level = LogLevel.TRACE;
      }
    } else if (this.verbose && this.level > LogLevel.DEBUG) {
      this.level = LogLevel.DEBUG;
    }

    // Quiet mode overrides verbose
    if (this.quiet) {
      this.verbose = false;
      this.veryVerbose = false;
      if (this.level < LogLevel.WARN) {
        this.level = LogLevel.WARN;
      }
    }

    // Initialize file output if configured
    if (this.fileOutput) {
      this.initializeFileOutput();
    }
  }

  /**
   * Initialize file output with rotation support
   */
  private initializeFileOutput(): void {
    if (!this.fileOutput) return;

    try {
      // Ensure directory exists
      const dir = dirname(this.fileOutput.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Check if rotation is needed
      this.rotateLogsIfNeeded();

      // Create file stream
      this.fileStream = createWriteStream(this.fileOutput.filePath, {
        flags: "a",
      });

      // Handle stream errors
      this.fileStream.on("error", (error) => {
        console.error(`Logger file stream error: ${error.message}`);
        this.fileStream = undefined;
      });
    } catch (error) {
      console.error(
        `Failed to initialize file output: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.fileStream = undefined;
    }
  }

  /**
   * Rotate log files if size limit exceeded
   */
  private rotateLogsIfNeeded(): void {
    if (!this.fileOutput || !existsSync(this.fileOutput.filePath)) return;

    const maxSize = this.fileOutput.maxSize ?? 10 * 1024 * 1024; // 10MB default
    const maxFiles = this.fileOutput.maxFiles ?? 5;
    const stats = statSync(this.fileOutput.filePath);

    if (stats.size >= maxSize) {
      this.rotateLogFiles(maxFiles);
    }
  }

  /**
   * Perform log file rotation with optional compression
   */
  private rotateLogFiles(maxFiles: number): void {
    if (!this.fileOutput) return;

    const basePath = this.fileOutput.filePath;
    const compress = this.fileOutput.compress ?? false;

    // Close existing stream
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }

    // Rotate existing files
    for (let i = maxFiles - 1; i >= 1; i--) {
      const oldPath = `${basePath}.${i}${compress ? ".gz" : ""}`;
      const newPath = `${basePath}.${i + 1}${compress ? ".gz" : ""}`;

      if (existsSync(oldPath)) {
        if (i === maxFiles - 1) {
          // Delete oldest file
          unlinkSync(oldPath);
        } else {
          // Rename to next number
          unlinkSync(newPath); // Remove if exists
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("fs").renameSync(oldPath, newPath);
        }
      }
    }

    // Move current log to .1
    if (existsSync(basePath)) {
      const rotatedPath = `${basePath}.1`;
      if (compress) {
        // Compress and save
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const content = require("fs").readFileSync(basePath);
        const compressed = gzipSync(content);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("fs").writeFileSync(`${rotatedPath}.gz`, compressed);
        unlinkSync(basePath);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("fs").renameSync(basePath, rotatedPath);
      }
    }
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
   * Enable or disable very verbose logging
   */
  setVeryVerbose(veryVerbose: boolean): void {
    this.veryVerbose = veryVerbose;
    if (veryVerbose) {
      this.verbose = true;
      if (this.level > LogLevel.TRACE) {
        this.level = LogLevel.TRACE;
      }
    }
  }

  /**
   * Enable or disable quiet mode
   */
  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
    if (quiet) {
      this.verbose = false;
      this.veryVerbose = false;
      if (this.level < LogLevel.WARN) {
        this.level = LogLevel.WARN;
      }
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
  setOutputFormat(format: "human" | "json"): void {
    this.outputFormat = format;
  }

  /**
   * Configure file output
   */
  setFileOutput(options: FileOutputOptions): void {
    // Close existing stream
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }

    this.fileOutput = options;
    this.initializeFileOutput();
  }

  /**
   * Disable file output
   */
  disableFileOutput(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }
    this.fileOutput = undefined;
  }

  /**
   * Start progress tracking for an operation
   */
  startProgress(id: string, options: ProgressOptions): void {
    if (!this.enableProgressTracking) return;

    this.progressStates.set(id, {
      ...options,
      startTime: Date.now(),
    });

    if (this.verbose) {
      const label = options.label || id;
      this.info(`📊 Starting ${label} (0/${options.total})`);
    }
  }

  /**
   * Update progress for an operation
   */
  updateProgress(id: string, current: number, additionalInfo?: string): void {
    if (!this.enableProgressTracking) return;

    const progress = this.progressStates.get(id);
    if (!progress) return;

    progress.current = current;
    const percentage = Math.round((current / progress.total) * 100);
    const elapsed = Date.now() - progress.startTime;

    let message = `📈 ${progress.label || id}: ${current}/${progress.total}`;

    if (progress.showPercentage !== false) {
      message += ` (${percentage}%)`;
    }

    if (progress.showETA !== false && current > 0) {
      const estimatedTotal = (elapsed / current) * progress.total;
      const eta = Math.round((estimatedTotal - elapsed) / 1000);
      message += ` ETA: ${eta}s`;
    }

    if (additionalInfo) {
      message += ` - ${additionalInfo}`;
    }

    if (this.verbose) {
      this.debug(message);
    }
  }

  /**
   * Complete progress tracking for an operation
   */
  completeProgress(id: string, summary?: string): void {
    if (!this.enableProgressTracking) return;

    const progress = this.progressStates.get(id);
    if (!progress) return;

    const elapsed = Date.now() - progress.startTime;
    const duration = Math.round(elapsed / 1000);

    let message = `✅ Completed ${progress.label || id} (${progress.total} items in ${duration}s)`;
    if (summary) {
      message += ` - ${summary}`;
    }

    if (this.verbose) {
      this.info(message);
    }

    this.progressStates.delete(id);
  }

  /**
   * Log performance metrics
   */
  performanceMetrics(
    operation: string,
    metrics: PerformanceMetrics,
    context?: ErrorContext,
  ): void {
    const extendedContext = {
      ...context,
      operation,
      processingTime: metrics.processingTime,
      memoryUsage: metrics.memoryUsage.heapUsed,
      fileCount: metrics.fileCount,
      totalFileSize: metrics.totalFileSize,
      optimizationRatio: metrics.optimizationRatio,
    };

    const heapMB = Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024);
    let message = `⚡ ${operation} completed in ${metrics.processingTime}ms (heap: ${heapMB}MB)`;

    if (metrics.fileCount) {
      message += `, processed ${metrics.fileCount} files`;
    }

    if (metrics.totalFileSize) {
      const sizeMB =
        Math.round((metrics.totalFileSize / 1024 / 1024) * 100) / 100;
      message += `, total size: ${sizeMB}MB`;
    }

    if (metrics.optimizationRatio) {
      const ratio = Math.round(metrics.optimizationRatio * 100);
      message += `, optimization: ${ratio}%`;
    }

    if (this.veryVerbose) {
      this.trace(message, extendedContext);
    } else if (this.verbose) {
      this.debug(message, extendedContext);
    }
  }

  /**
   * Log detailed file operation
   */
  fileOperation(
    operation: string,
    filePath: string,
    details?: { size?: number; processingTime?: number; result?: string },
  ): void {
    if (!this.veryVerbose) return;

    let message = `📁 ${operation}: ${filePath}`;
    const context: ErrorContext = { operation, filePath };

    if (details?.size) {
      const sizeKB = Math.round(details.size / 1024);
      message += ` (${sizeKB}KB)`;
      context.fileSize = details.size;
    }

    if (details?.processingTime) {
      message += ` - ${details.processingTime}ms`;
      context.processingTime = details.processingTime;
    }

    if (details?.result) {
      message += ` → ${details.result}`;
    }

    this.trace(message, _context);
  }

  /**
   * Log step-by-step process details
   */
  processStep(step: string, details?: string, context?: ErrorContext): void {
    if (!this.verbose) return;

    let message = `🔄 ${step}`;
    if (details) {
      message += `: ${details}`;
    }

    this.debug(message, _context);
  }

  /**
   * Create a child logger with additional context
   */
  child(component: string, options: Partial<LoggerOptions> = {}): Logger {
    return new Logger({
      level: this.level,
      verbose: this.verbose,
      veryVerbose: this.veryVerbose,
      quiet: this.quiet,
      silent: this.silent,
      outputFormat: this.outputFormat,
      colorize: this.colorize,
      timestamp: this.timestamp,
      component,
      fileOutput: this.fileOutput,
      enableProgressTracking: this.enableProgressTracking,
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
    error?: Error,
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
    const colorFn =
      LogLevelColors[LogLevel[entry.level as keyof typeof LogLevel]];

    let output = "";

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
      output +=
        "\n" +
        (entry.error.stack || `${entry.error.name}: ${entry.error.message}`);
    }

    return output;
  }

  /**
   * Format log entry for CSV output
   */
  private formatCSV(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level;
    const component = entry.component || "";
    const message = entry.message.replace(/"/g, '""'); // Escape quotes
    const context = entry.context
      ? JSON.stringify(entry.context).replace(/"/g, '""')
      : "";
    const _ = entry.error
      ? `${entry.error.name}: ${entry.error.message}`.replace(/"/g, '""')
      : "";

    return `"${timestamp}","${level}","${component}","${message}","${context}","${error}"`;
  }

  /**
   * Output a log entry to console and/or file
   */
  private output(entry: LogEntry): void {
    // Console output - send errors to stderr, others to stdout
    if (this.outputFormat === "json") {
      if (entry.level === "ERROR" || entry.level === "FATAL") {
        console.error(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
    } else {
      const formattedMessage = this.formatHuman(entry);
      if (entry.level === "ERROR" || entry.level === "FATAL") {
        console.error(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
    }

    // File output
    if (this.fileStream && !this.fileStream.destroyed) {
      try {
        let fileContent: string;
        const fileFormat = this.fileOutput?.format || "human";

        switch (fileFormat) {
          case "json":
            fileContent = JSON.stringify(entry) + "\n";
            break;
          case "csv":
            fileContent = this.formatCSV(entry) + "\n";
            break;
          default:
            fileContent = this.formatHuman(entry) + "\n";
        }

        this.fileStream.write(fileContent);

        // Check if rotation is needed after write
        this.rotateLogsIfNeeded();
      } catch (error) {
        console.error(
          `Failed to write to log file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: ErrorContext,
    error?: Error,
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, _error);
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
    this.debug(
      `Operation "${operation}" completed in ${duration}ms`,
      extendedContext,
    );
  }

  /**
   * Clean up resources (close file streams)
   */
  cleanup(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }
    this.progressStates.clear();
  }

  /**
   * Get current logger state for debugging
   */
  getState(): {
    level: LogLevel;
    verbose: boolean;
    veryVerbose: boolean;
    quiet: boolean;
    silent: boolean;
    fileOutputEnabled: boolean;
    progressTrackingEnabled: boolean;
    activeProgressCount: number;
  } {
    return {
      level: this.level,
      verbose: this.verbose,
      veryVerbose: this.veryVerbose,
      quiet: this.quiet,
      silent: this.silent,
      fileOutputEnabled: !!this.fileOutput,
      progressTrackingEnabled: this.enableProgressTracking,
      activeProgressCount: this.progressStates.size,
    };
  }
}

/**
 * Parse log level from string
 */
function parseLogLevel(level?: string): LogLevel {
  if (!level) return LogLevel.INFO;

  const upperLevel = level.toUpperCase();
  switch (upperLevel) {
    case "TRACE":
      return LogLevel.TRACE;
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    case "FATAL":
      return LogLevel.FATAL;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Create file output options from environment variables
 */
function createFileOutputFromEnv(): FileOutputOptions | undefined {
  const filePath = process.env.ENIGMA_LOG_FILE;
  if (!filePath) return undefined;

  return {
    filePath,
    format:
      (process.env.ENIGMA_LOG_FORMAT as "human" | "json" | "csv") || "human",
    maxSize: process.env.ENIGMA_LOG_MAX_SIZE
      ? parseInt(process.env.ENIGMA_LOG_MAX_SIZE)
      : undefined,
    maxFiles: process.env.ENIGMA_LOG_MAX_FILES
      ? parseInt(process.env.ENIGMA_LOG_MAX_FILES)
      : undefined,
    compress: process.env.ENIGMA_LOG_COMPRESS === "true",
  };
}

/**
 * Default logger instance
 */
export const logger = new Logger({
  level: process.env.ENIGMA_LOG_LEVEL
    ? parseLogLevel(process.env.ENIGMA_LOG_LEVEL)
    : process.env.NODE_ENV === "development"
      ? LogLevel.DEBUG
      : LogLevel.INFO,
  verbose: process.env.ENIGMA_VERBOSE === "true",
  veryVerbose: process.env.ENIGMA_VERY_VERBOSE === "true",
  quiet: process.env.ENIGMA_QUIET === "true",
  colorize: process.stdout.isTTY,
  timestamp: true,
  fileOutput: createFileOutputFromEnv(),
  enableProgressTracking: process.env.ENIGMA_PROGRESS_TRACKING !== "false",
});

/**
 * Create a logger with specific component context
 */
export function createLogger(
  component: string,
  options?: Partial<LoggerOptions>,
): Logger {
  return logger.child(component, _options);
}
