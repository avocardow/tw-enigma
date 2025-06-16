/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface CLIUtilsConfig {
  colors?: boolean;
  json?: boolean;
}

export const CLIUtils = {
  /**
   * Format output for display based on format preference
   */
  formatOutput<T>(data: T, format: 'json' | 'text' = 'text'): string {
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // For text format, just return String(data) to match test expectations
    return String(data);
  },

  /**
   * Log a message to stdout
   */
  log(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  },

  /**
   * Log an error to stderr
   */
  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  },

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  },

  /**
   * Format percentage with color coding (if supported)
   */
  formatPercentage(value: number, config: CLIUtilsConfig = {}): string {
    const percentage = `${value.toFixed(1)}%`;

    if (!config.colors) {
      return percentage;
    }

    // Simple color coding without external dependencies
    if (value >= 50) return `\x1b[32m${percentage}\x1b[0m`; // Green
    if (value >= 25) return `\x1b[33m${percentage}\x1b[0m`; // Yellow
    return `\x1b[31m${percentage}\x1b[0m`; // Red
  },
};
