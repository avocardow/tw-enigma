/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * CLI Output Formatter
 * 
 * Advanced formatting utilities for CLI output including tables,
 * progress bars, color coding, and structured reporting.
 */

import { createLogger } from '../../utils/logger';
import type {
  OutputFormat,
  OutputFormatConfig,
  DiscoveryResponse,
  HealthCheckResponse,
} from '../core/apiInterfaces';

const logger = createLogger('output-formatter');

/**
 * Color codes for terminal output
 */
export const Colors = {
  Reset: '\x1b[0m',
  Bright: '\x1b[1m',
  Dim: '\x1b[2m',
  Red: '\x1b[31m',
  Green: '\x1b[32m',
  Yellow: '\x1b[33m',
  Blue: '\x1b[34m',
  Magenta: '\x1b[35m',
  Cyan: '\x1b[36m',
  White: '\x1b[37m',
  BgRed: '\x1b[41m',
  BgGreen: '\x1b[42m',
  BgYellow: '\x1b[43m',
  BgBlue: '\x1b[44m',
} as const;

/**
 * Formatting options
 */
export interface FormattingOptions {
  /** Use colors in output */
  useColors: boolean;
  /** Show timestamps */
  showTimestamps: boolean;
  /** Maximum line width */
  maxWidth: number;
  /** Indent size */
  indentSize: number;
  /** Use Unicode characters */
  useUnicode: boolean;
}

/**
 * Table configuration
 */
export interface TableConfig {
  headers: string[];
  rows: string[][];
  alignments?: ('left' | 'center' | 'right')[];
  maxColumnWidths?: number[];
  borders?: boolean;
}

/**
 * Progress bar configuration
 */
export interface ProgressBarConfig {
  total: number;
  current: number;
  width: number;
  showPercentage: boolean;
  showEta: boolean;
  label?: string;
}

/**
 * CLI Output Formatter class
 */
export class OutputFormatter {
  private options: FormattingOptions;

  constructor(options: Partial<FormattingOptions> = {}) {
    this.options = {
      useColors: process.stdout.isTTY && !process.env.NO_COLOR,
      showTimestamps: false,
      maxWidth: process.stdout.columns || 80,
      indentSize: 2,
      useUnicode: process.stdout.isTTY,
      ...options,
    };

    logger.debug('Output formatter initialized', { options: this.options });
  }

  /**
   * Format discovery results for console output
   */
  formatDiscoveryResults(results: DiscoveryResponse): string {
    const lines: string[] = [];

    // Header
    lines.push(this.colorize('🔍 TW-Enigma Discovery Results', Colors.Cyan, Colors.Bright));
    lines.push('');

    // Status
    const statusColor = results.status === 'completed' ? Colors.Green : 
                       results.status === 'failed' ? Colors.Red : Colors.Yellow;
    lines.push(`${this.colorize('Status:', Colors.White, Colors.Bright)} ${this.colorize(results.status.toUpperCase(), statusColor)}`);
    lines.push(`${this.colorize('Request ID:', Colors.White, Colors.Bright)} ${results.requestId}`);
    
    if (results.startedAt) {
      lines.push(`${this.colorize('Started:', Colors.White, Colors.Bright)} ${new Date(results.startedAt).toLocaleString()}`);
    }
    
    if (results.completedAt) {
      const duration = results.completedAt - results.startedAt;
      lines.push(`${this.colorize('Duration:', Colors.White, Colors.Bright)} ${this.formatDuration(duration)}`);
    }
    
    lines.push('');

    // Statistics
    if (results.stats) {
      lines.push(this.colorize('📊 Statistics', Colors.Blue, Colors.Bright));
      lines.push(this.createTable({
        headers: ['Metric', 'Value'],
        rows: [
          ['Files Processed', results.stats.filesProcessed.toString()],
          ['Patterns Found', this.colorize(results.stats.patternsFound.toString(), Colors.Green)],
          ['Opportunities Identified', this.colorize(results.stats.opportunitiesIdentified.toString(), Colors.Magenta)],
          ['Processing Time', this.formatDuration(results.stats.processingTimeMs)],
          ['Errors', results.stats.errorCount > 0 ? this.colorize(results.stats.errorCount.toString(), Colors.Red) : '0'],
        ],
        borders: true,
      }));
      lines.push('');
    }

    // Entities
    if (results.results?.entities && results.results.entities.length > 0) {
      lines.push(this.colorize('📁 Processed Files', Colors.Blue, Colors.Bright));
      
      const entityRows = results.results.entities.map(entity => [
        this.truncateString(entity.filePath, 40),
        entity.fileType,
        entity.patterns.toString(),
        this.formatFileSize(entity.size),
        new Date(entity.lastModified).toLocaleDateString(),
      ]);

      lines.push(this.createTable({
        headers: ['File Path', 'Type', 'Patterns', 'Size', 'Modified'],
        rows: entityRows,
        alignments: ['left', 'center', 'center', 'right', 'center'],
        maxColumnWidths: [40, 10, 10, 12, 12],
        borders: true,
      }));
      lines.push('');
    }

    // Error handling
    if (results.error) {
      lines.push(this.colorize('❌ Error Details', Colors.Red, Colors.Bright));
      lines.push(this.indent(`Code: ${results.error.code}`));
      lines.push(this.indent(`Message: ${results.error.message}`));
      if (results.error.details) {
        lines.push(this.indent(`Details: ${JSON.stringify(results.error.details, null, 2)}`));
      }
      lines.push('');
    }

    // Download URLs
    if (results.downloadUrls && Object.keys(results.downloadUrls).length > 0) {
      lines.push(this.colorize('📥 Download URLs', Colors.Blue, Colors.Bright));
      Object.entries(results.downloadUrls).forEach(([format, url]) => {
        lines.push(this.indent(`${format.toUpperCase()}: ${this.colorize(url, Colors.Cyan)}`));
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format health check results
   */
  formatHealthCheck(health: HealthCheckResponse): string {
    const lines: string[] = [];

    // Header
    const statusColor = health.status === 'healthy' ? Colors.Green : 
                       health.status === 'unhealthy' ? Colors.Red : Colors.Yellow;
    lines.push(this.colorize(`🏥 System Health: ${health.status.toUpperCase()}`, statusColor, Colors.Bright));
    lines.push('');

    // Basic info
    lines.push(`${this.colorize('Version:', Colors.White, Colors.Bright)} ${health.version}`);
    lines.push(`${this.colorize('Timestamp:', Colors.White, Colors.Bright)} ${new Date(health.timestamp).toLocaleString()}`);
    lines.push('');

    // Services
    lines.push(this.colorize('🔧 Services', Colors.Blue, Colors.Bright));
    const serviceRows = Object.entries(health.services).map(([service, status]) => {
      const statusIcon = status === 'up' ? '✅' : status === 'down' ? '❌' : '⚠️';
      const statusText = this.colorize(status, 
        status === 'up' ? Colors.Green : status === 'down' ? Colors.Red : Colors.Yellow
      );
      return [service, `${statusIcon} ${statusText}`];
    });

    lines.push(this.createTable({
      headers: ['Service', 'Status'],
      rows: serviceRows,
      borders: true,
    }));
    lines.push('');

    // Metrics
    lines.push(this.colorize('📈 Metrics', Colors.Blue, Colors.Bright));
    lines.push(this.createTable({
      headers: ['Metric', 'Value'],
      rows: [
        ['Uptime', this.formatDuration(health.metrics.uptime * 1000)],
        ['Memory Usage', `${health.metrics.memoryUsage.toFixed(1)} MB`],
        ['CPU Usage', `${health.metrics.cpuUsage.toFixed(1)}%`],
        ['Disk Usage', `${health.metrics.diskUsage.toFixed(1)}%`],
        ['Response Time', `${health.metrics.responseTime.toFixed(1)}ms`],
      ],
      borders: true,
    }));
    lines.push('');

    // Dependencies
    if (health.dependencies.length > 0) {
      lines.push(this.colorize('🔗 Dependencies', Colors.Blue, Colors.Bright));
      const depRows = health.dependencies.map(dep => {
        const statusIcon = dep.status === 'up' ? '✅' : dep.status === 'down' ? '❌' : '⚠️';
        const statusText = this.colorize(dep.status, 
          dep.status === 'up' ? Colors.Green : dep.status === 'down' ? Colors.Red : Colors.Yellow
        );
        return [
          dep.name,
          `${statusIcon} ${statusText}`,
          dep.responseTime ? `${dep.responseTime}ms` : 'N/A',
          dep.error || '-',
        ];
      });

      lines.push(this.createTable({
        headers: ['Dependency', 'Status', 'Response Time', 'Error'],
        rows: depRows,
        maxColumnWidths: [20, 15, 15, 30],
        borders: true,
      }));
    }

    return lines.join('\n');
  }

  /**
   * Create a progress bar
   */
  createProgressBar(config: ProgressBarConfig): string {
    const { total, current, width, showPercentage, showEta, label } = config;
    
    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const filledWidth = Math.floor((percentage / 100) * width);
    const emptyWidth = width - filledWidth;
    
    const filled = this.options.useUnicode ? '█'.repeat(filledWidth) : '#'.repeat(filledWidth);
    const empty = this.options.useUnicode ? '░'.repeat(emptyWidth) : '-'.repeat(emptyWidth);
    
    let bar = `[${this.colorize(filled, Colors.Green)}${this.colorize(empty, Colors.Dim)}]`;
    
    if (showPercentage) {
      bar += ` ${percentage.toFixed(1)}%`;
    }
    
    if (current < total && showEta) {
      // Simple ETA calculation (would be more sophisticated in real implementation)
      const eta = Math.ceil((total - current) * 1000 / Math.max(1, current));
      bar += ` ETA: ${this.formatDuration(eta)}`;
    }
    
    if (label) {
      bar = `${label} ${bar}`;
    }
    
    return bar;
  }

  /**
   * Create a table with borders and formatting
   */
  createTable(config: TableConfig): string {
    const { headers, rows, alignments = [], maxColumnWidths = [], borders = false } = config;
    
    // Calculate column widths
    const columnWidths = headers.map((header, index) => {
      const maxRowWidth = Math.max(...rows.map(row => this.stripColors(row[index] || '').length));
      const headerWidth = this.stripColors(header).length;
      const maxWidth = maxColumnWidths[index] || Infinity;
      return Math.min(maxWidth, Math.max(headerWidth, maxRowWidth));
    });
    
    const lines: string[] = [];
    
    if (borders) {
      // Top border
      const topBorder = columnWidths.map(width => '─'.repeat(width + 2)).join('┬');
      lines.push(`┌${topBorder}┐`);
    }
    
    // Header row
    const headerRow = headers.map((header, index) => {
      const align = alignments[index] || 'left';
      return this.padString(this.colorize(header, Colors.White, Colors.Bright), columnWidths[index], align);
    }).join(borders ? ' │ ' : '  ');
    
    lines.push(borders ? `│ ${headerRow} │` : headerRow);
    
    if (borders) {
      // Header separator
      const separator = columnWidths.map(width => '─'.repeat(width + 2)).join('┼');
      lines.push(`├${separator}┤`);
    } else {
      // Simple separator
      const separator = columnWidths.map(width => '─'.repeat(width)).join('  ');
      lines.push(separator);
    }
    
    // Data rows
    rows.forEach(row => {
      const formattedRow = row.map((cell, index) => {
        const align = alignments[index] || 'left';
        const truncated = this.truncateString(cell || '', columnWidths[index]);
        return this.padString(truncated, columnWidths[index], align);
      }).join(borders ? ' │ ' : '  ');
      
      lines.push(borders ? `│ ${formattedRow} │` : formattedRow);
    });
    
    if (borders) {
      // Bottom border
      const bottomBorder = columnWidths.map(width => '─'.repeat(width + 2)).join('┴');
      lines.push(`└${bottomBorder}┘`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format validation results
   */
  formatValidationResults(results: string[]): string {
    const lines: string[] = [];
    
    lines.push(this.colorize('🔍 Validation Results', Colors.Cyan, Colors.Bright));
    lines.push('');
    
    results.forEach(result => {
      lines.push(this.indent(result));
    });
    
    return lines.join('\n');
  }

  /**
   * Format error message with context
   */
  formatError(error: Error | string, context?: Record<string, unknown>): string {
    const lines: string[] = [];
    
    lines.push(this.colorize('❌ Error', Colors.Red, Colors.Bright));
    lines.push('');
    
    const message = error instanceof Error ? error.message : error;
    lines.push(this.indent(message));
    
    if (error instanceof Error && error.stack) {
      lines.push('');
      lines.push(this.colorize('Stack Trace:', Colors.Red));
      lines.push(this.indent(error.stack, 2));
    }
    
    if (context && Object.keys(context).length > 0) {
      lines.push('');
      lines.push(this.colorize('Context:', Colors.Yellow));
      lines.push(this.indent(JSON.stringify(context, null, 2), 2));
    }
    
    return lines.join('\n');
  }

  /**
   * Format success message
   */
  formatSuccess(message: string, details?: Record<string, unknown>): string {
    const lines: string[] = [];
    
    lines.push(this.colorize('✅ Success', Colors.Green, Colors.Bright));
    lines.push('');
    lines.push(this.indent(message));
    
    if (details && Object.keys(details).length > 0) {
      lines.push('');
      Object.entries(details).forEach(([key, value]) => {
        lines.push(this.indent(`${key}: ${value}`));
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Add color codes to text
   */
  private colorize(text: string, ...colors: string[]): string {
    if (!this.options.useColors) {
      return text;
    }
    
    return colors.join('') + text + Colors.Reset;
  }

  /**
   * Remove color codes from text
   */
  private stripColors(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Pad string to specified width with alignment
   */
  private padString(text: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
    const cleanText = this.stripColors(text);
    const colorCodes = text.replace(cleanText, '');
    const padding = width - cleanText.length;
    
    if (padding <= 0) {
      return text;
    }
    
    switch (align) {
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
      
      case 'right':
        return ' '.repeat(padding) + text;
      
      case 'left':
      default:
        return text + ' '.repeat(padding);
    }
  }

  /**
   * Truncate string to maximum length
   */
  private truncateString(text: string, maxLength: number): string {
    const cleanText = this.stripColors(text);
    
    if (cleanText.length <= maxLength) {
      return text;
    }
    
    const ellipsis = this.options.useUnicode ? '…' : '...';
    const truncated = cleanText.substring(0, maxLength - ellipsis.length) + ellipsis;
    
    // Preserve color codes if they exist
    const colorMatch = text.match(/^(\x1b\[[0-9;]*m)*/);
    const resetMatch = text.match(/(\x1b\[[0-9;]*m)*$/);
    
    return (colorMatch?.[0] || '') + truncated + (resetMatch?.[0] || '');
  }

  /**
   * Add indentation to text
   */
  private indent(text: string, levels: number = 1): string {
    const indentStr = ' '.repeat(this.options.indentSize * levels);
    return text.split('\n').map(line => indentStr + line).join('\n');
  }

  /**
   * Format duration in milliseconds
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Format file size in bytes
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
  }

  /**
   * Update formatting options
   */
  updateOptions(newOptions: Partial<FormattingOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  getOptions(): FormattingOptions {
    return { ...this.options };
  }
}

/**
 * Factory function to create output formatter
 */
export function createOutputFormatter(options?: Partial<FormattingOptions>): OutputFormatter {
  return new OutputFormatter(options);
}

/**
 * Utility function to detect terminal capabilities
 */
export function detectTerminalCapabilities(): Partial<FormattingOptions> {
  return {
    useColors: process.stdout.isTTY && !process.env.NO_COLOR,
    useUnicode: process.stdout.isTTY && (
      process.env.TERM?.includes('xterm') ||
      process.env.TERM?.includes('screen') ||
      process.platform === 'darwin'
    ),
    maxWidth: process.stdout.columns || 80,
  };
}