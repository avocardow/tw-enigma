/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { Metric, MetricType, MetricsCollector, MetricsSummary } from './collector.js';
import { PerformanceMonitor, PerformanceStats } from './performanceMonitor.js';
import { QualityMetricsCollector, QualityStats } from './qualityMetrics.js';

/**
 * Reporter configuration schema
 */
export const ReporterConfigSchema = z.object({
  // Output settings
  includeTimestamps: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
  includeTags: z.boolean().default(true),
  includeRawData: z.boolean().default(false),

  // Verbosity levels
  verbosity: z.enum(['minimal', 'standard', 'detailed', 'verbose']).default('standard'),

  // Format settings
  dateFormat: z.enum(['iso', 'readable', 'timestamp']).default('iso'),
  numberPrecision: z.number().min(0).max(10).default(3),
  colorOutput: z.boolean().default(true),

  // Filtering
  includeMetricTypes: z.array(z.nativeEnum(MetricType)).optional(),
  excludeMetricTypes: z.array(z.nativeEnum(MetricType)).optional(),
  timeRange: z
    .object({
      start: z.date(),
      end: z.date(),
    })
    .optional(),

  // Output formatting
  humanReadable: z
    .object({
      maxTableWidth: z.number().min(40).max(200).default(120),
      showHeaders: z.boolean().default(true),
      showSeparators: z.boolean().default(true),
      indentSize: z.number().min(2).max(8).default(2),
      wrapText: z.boolean().default(true),
    })
    .default({}),

  // JSON formatting
  json: z
    .object({
      prettyPrint: z.boolean().default(true),
      indentSize: z.number().min(0).max(8).default(2),
      sortKeys: z.boolean().default(true),
      includeNulls: z.boolean().default(false),
    })
    .default({}),

  // Error handling
  errorHandling: z
    .object({
      skipInvalidMetrics: z.boolean().default(true),
      logErrors: z.boolean().default(true),
      maxErrorCount: z.number().min(1).max(1000).default(100),
    })
    .default({}),
});

export type ReporterConfig = z.infer<typeof ReporterConfigSchema>;

/**
 * Report format types
 */
export type ReportFormat = 'json' | 'human' | 'csv' | 'markdown' | 'html';

/**
 * Report data structure
 */
export interface ReportData {
  metadata: {
    generatedAt: Date;
    version: string;
    reportId: string;
    config: ReporterConfig;
    timeRange?: { start: Date; end: Date };
  };
  summary: {
    totalMetrics: number;
    metricsBreakdown: Record<MetricType, number>;
    timeSpan: number; // milliseconds
    collectionRate: number; // metrics per second
  };
  metrics: {
    raw: Metric[];
    aggregated: MetricsSummary;
  };
  quality?: QualityStats;
  performance?: PerformanceStats;
  errors: Array<{
    timestamp: Date;
    error: string;
    context?: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

/**
 * Report output structure
 */
export interface ReportOutput {
  format: ReportFormat;
  content: string;
  size: number;
  generationTime: number;
  warnings: string[];
}

/**
 * Advanced metrics reporter
 */
export class MetricsReporter extends EventEmitter {
  private config: ReporterConfig;
  private metricsCollector: MetricsCollector;
  private qualityCollector?: QualityMetricsCollector;
  private performanceMonitor?: PerformanceMonitor;
  private errors: Array<{ timestamp: Date; error: string; context?: any; severity: string }> = [];

  constructor(metricsCollector: MetricsCollector, config: Partial<ReporterConfig> = {}) {
    super();
    this.config = ReporterConfigSchema.parse(config);
    this.metricsCollector = metricsCollector;
  }

  /**
   * Set quality metrics collector
   */
  public setQualityCollector(collector: QualityMetricsCollector): void {
    this.qualityCollector = collector;
  }

  /**
   * Set performance monitor
   */
  public setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Generate a comprehensive report
   */
  public async generateReport(
    format: ReportFormat = 'json',
    customConfig?: Partial<ReporterConfig>
  ): Promise<ReportOutput> {
    const startTime = Date.now();
    const reportConfig = customConfig
      ? ReporterConfigSchema.parse({ ...this.config, ...customConfig })
      : this.config;

    try {
      // Collect report data
      const reportData = await this.collectReportData(reportConfig);

      // Generate formatted output
      const content = await this.formatReport(reportData, format, reportConfig);

      const generationTime = Date.now() - startTime;
      const warnings = this.validateReport(reportData, reportConfig);

      const output: ReportOutput = {
        format,
        content,
        size: Buffer.byteLength(content, 'utf8'),
        generationTime,
        warnings,
      };

      this.emit('reportGenerated', output);
      return output;
    } catch (error) {
      this.logError('Report generation failed', error, 'critical');
      throw error;
    }
  }

  /**
   * Generate JSON report
   */
  public async generateJsonReport(customConfig?: Partial<ReporterConfig>): Promise<ReportOutput> {
    return this.generateReport('json', customConfig);
  }

  /**
   * Generate human-readable report
   */
  public async generateHumanReport(customConfig?: Partial<ReporterConfig>): Promise<ReportOutput> {
    return this.generateReport('human', customConfig);
  }

  /**
   * Generate CSV report
   */
  public async generateCsvReport(customConfig?: Partial<ReporterConfig>): Promise<ReportOutput> {
    return this.generateReport('csv', customConfig);
  }

  /**
   * Generate Markdown report
   */
  public async generateMarkdownReport(
    customConfig?: Partial<ReporterConfig>
  ): Promise<ReportOutput> {
    return this.generateReport('markdown', customConfig);
  }

  /**
   * Generate HTML report
   */
  public async generateHtmlReport(customConfig?: Partial<ReporterConfig>): Promise<ReportOutput> {
    return this.generateReport('html', customConfig);
  }

  /**
   * Get report data only (without formatting)
   */
  public async getReportData(config?: Partial<ReporterConfig>): Promise<ReportData> {
    const reportConfig = config
      ? ReporterConfigSchema.parse({ ...this.config, ...config })
      : this.config;

    return this.collectReportData(reportConfig);
  }

  /**
   * Update reporter configuration
   */
  public updateConfig(updates: Partial<ReporterConfig>): void {
    this.config = ReporterConfigSchema.parse({ ...this.config, ...updates });
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): ReporterConfig {
    return { ...this.config };
  }

  /**
   * Clear error log
   */
  public clearErrors(): void {
    this.errors = [];
    this.emit('errorsCleared');
  }

  /**
   * Get accumulated errors
   */
  public getErrors(): Array<{ timestamp: Date; error: string; context?: any; severity: string }> {
    return [...this.errors];
  }

  /**
   * Collect all report data
   */
  private async collectReportData(config: ReporterConfig): Promise<ReportData> {
    const reportId = this.generateReportId();
    const generatedAt = new Date();

    // Apply filtering
    const filter = this.buildMetricsFilter(config);

    // Collect metrics
    const rawMetrics = await this.metricsCollector.query(filter);
    const aggregatedSummary = await this.metricsCollector.getSummary(filter);

    // Collect quality metrics if available
    const qualityStats = this.qualityCollector?.getQualityStats(
      config.timeRange
        ? {
            start: config.timeRange.start,
            end: config.timeRange.end,
          }
        : undefined
    );

    // Collect performance metrics if available
    const performanceStats = this.performanceMonitor?.getStats();

    // Calculate summary statistics
    const summary = this.calculateSummary(rawMetrics, config);

    return {
      metadata: {
        generatedAt,
        version: '1.0.0',
        reportId,
        config,
        timeRange: config.timeRange
          ? {
              start: config.timeRange.start,
              end: config.timeRange.end,
            }
          : undefined,
      },
      summary,
      metrics: {
        raw: rawMetrics,
        aggregated: aggregatedSummary,
      },
      quality: qualityStats,
      performance: performanceStats,
      errors: this.errors.slice(-config.errorHandling.maxErrorCount) as Array<{
        timestamp: Date;
        error: string;
        context?: any;
        severity: 'low' | 'medium' | 'high' | 'critical';
      }>,
    };
  }

  /**
   * Format report based on specified format
   */
  private async formatReport(
    data: ReportData,
    format: ReportFormat,
    config: ReporterConfig
  ): Promise<string> {
    switch (format) {
      case 'json':
        return this.formatJsonReport(data, config);
      case 'human':
        return this.formatHumanReport(data, config);
      case 'csv':
        return this.formatCsvReport(data, config);
      case 'markdown':
        return this.formatMarkdownReport(data, config);
      case 'html':
        return this.formatHtmlReport(data, config);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Format JSON report
   */
  private formatJsonReport(data: ReportData, config: ReporterConfig): string {
    try {
      const serializable = this.makeSerializable(data, config);

      if (config.json.prettyPrint) {
        return JSON.stringify(
          serializable,
          config.json.sortKeys ? this.sortObjectKeys : null,
          config.json.indentSize
        );
      } else {
        return JSON.stringify(serializable);
      }
    } catch (error) {
      this.logError('JSON formatting failed', error, 'high');
      throw new Error('Failed to format JSON report');
    }
  }

  /**
   * Format human-readable report
   */
  private formatHumanReport(data: ReportData, config: ReporterConfig): string {
    const lines: string[] = [];
    const { humanReadable } = config;
    const indent = ' '.repeat(humanReadable.indentSize);

    // Header
    lines.push(this.formatHeader('TW-Enigma Metrics Report', config));
    lines.push('');

    // Metadata
    lines.push(this.colorize('📊 Report Metadata', 'header', config));
    lines.push(`${indent}Generated: ${this.formatDate(data.metadata.generatedAt, config)}`);
    lines.push(`${indent}Report ID: ${data.metadata.reportId}`);
    lines.push(`${indent}Version: ${data.metadata.version}`);
    if (data.metadata.timeRange) {
      lines.push(
        `${indent}Time Range: ${this.formatDate(data.metadata.timeRange.start, config)} - ${this.formatDate(data.metadata.timeRange.end, config)}`
      );
    }
    lines.push('');

    // Summary
    lines.push(this.colorize('📈 Summary Statistics', 'header', config));
    lines.push(`${indent}Total Metrics: ${this.formatNumber(data.summary.totalMetrics, config)}`);
    lines.push(
      `${indent}Collection Rate: ${this.formatNumber(data.summary.collectionRate, config)} metrics/sec`
    );
    lines.push(`${indent}Time Span: ${this.formatDuration(data.summary.timeSpan)}`);
    lines.push('');

    // Metrics breakdown
    lines.push(this.colorize('📋 Metrics Breakdown', 'header', config));
    const breakdownTable = this.formatMetricsBreakdownTable(data.summary.metricsBreakdown, config);
    lines.push(breakdownTable);
    lines.push('');

    // Quality metrics
    if (data.quality && config.verbosity !== 'minimal') {
      lines.push(this.colorize('🎯 Quality Metrics', 'header', config));
      lines.push(this.formatQualitySection(data.quality, config, indent));
      lines.push('');
    }

    // Performance metrics
    if (data.performance && config.verbosity !== 'minimal') {
      lines.push(this.colorize('⚡ Performance Metrics', 'header', config));
      lines.push(this.formatPerformanceSection(data.performance, config, indent));
      lines.push('');
    }

    // Recent metrics (detailed/verbose only)
    if (config.verbosity === 'detailed' || config.verbosity === 'verbose') {
      lines.push(this.colorize('📊 Recent Metrics', 'header', config));
      const recentMetrics = data.metrics.raw.slice(-10);
      lines.push(this.formatMetricsTable(recentMetrics, config));
      lines.push('');
    }

    // Errors (if any)
    if (data.errors.length > 0) {
      lines.push(this.colorize('❌ Errors and Warnings', 'header', config));
      lines.push(this.formatErrorsSection(data.errors, config, indent));
      lines.push('');
    }

    // Footer
    lines.push(this.formatFooter(config));

    return lines.join('\n');
  }

  /**
   * Format CSV report
   */
  private formatCsvReport(data: ReportData, config: ReporterConfig): string {
    const lines: string[] = [];

    // CSV Header
    const headers = ['Timestamp', 'Type', 'Source', 'Value', 'Unit', 'Tags', 'Metadata'];
    lines.push(headers.join(','));

    // CSV Data
    for (const metric of data.metrics.raw) {
      const row = [
        this.formatDate(metric.timestamp, config),
        metric.type,
        metric.source,
        this.extractMetricValue(metric),
        this.extractMetricUnit(metric),
        this.formatTagsForCsv(metric.tags || {}),
        this.formatMetadataForCsv(metric),
      ];
      lines.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    }

    return lines.join('\n');
  }

  /**
   * Format Markdown report
   */
  private formatMarkdownReport(data: ReportData, config: ReporterConfig): string {
    const lines: string[] = [];

    // Title
    lines.push('# TW-Enigma Metrics Report');
    lines.push('');

    // Metadata
    lines.push('## 📊 Report Metadata');
    lines.push('');
    lines.push(`- **Generated:** ${this.formatDate(data.metadata.generatedAt, config)}`);
    lines.push(`- **Report ID:** \`${data.metadata.reportId}\``);
    lines.push(`- **Version:** ${data.metadata.version}`);
    if (data.metadata.timeRange) {
      lines.push(
        `- **Time Range:** ${this.formatDate(data.metadata.timeRange.start, config)} - ${this.formatDate(data.metadata.timeRange.end, config)}`
      );
    }
    lines.push('');

    // Summary
    lines.push('## 📈 Summary Statistics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Metrics | ${this.formatNumber(data.summary.totalMetrics, config)} |`);
    lines.push(
      `| Collection Rate | ${this.formatNumber(data.summary.collectionRate, config)} metrics/sec |`
    );
    lines.push(`| Time Span | ${this.formatDuration(data.summary.timeSpan)} |`);
    lines.push('');

    // Metrics breakdown
    lines.push('## 📋 Metrics Breakdown');
    lines.push('');
    lines.push('| Type | Count | Percentage |');
    lines.push('|------|-------|------------|');
    for (const [type, count] of Object.entries(data.summary.metricsBreakdown)) {
      const percentage = ((count / data.summary.totalMetrics) * 100).toFixed(1);
      lines.push(`| ${type} | ${count} | ${percentage}% |`);
    }
    lines.push('');

    // Quality metrics
    if (data.quality) {
      lines.push('## 🎯 Quality Metrics');
      lines.push('');
      lines.push(this.formatQualityMarkdownSection(data.quality));
      lines.push('');
    }

    // Performance metrics
    if (data.performance) {
      lines.push('## ⚡ Performance Metrics');
      lines.push('');
      lines.push(this.formatPerformanceMarkdownSection(data.performance));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format HTML report
   */
  private formatHtmlReport(data: ReportData, config: ReporterConfig): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TW-Enigma Metrics Report</title>
    <style>
        ${this.getHtmlStyles()}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🚀 TW-Enigma Metrics Report</h1>
            <p class="subtitle">Generated on ${this.formatDate(data.metadata.generatedAt, config)}</p>
        </header>

        <section class="metadata">
            <h2>📊 Report Metadata</h2>
            <div class="info-grid">
                <div class="info-item">
                    <label>Report ID:</label>
                    <span>${data.metadata.reportId}</span>
                </div>
                <div class="info-item">
                    <label>Version:</label>
                    <span>${data.metadata.version}</span>
                </div>
                ${
                  data.metadata.timeRange
                    ? `
                <div class="info-item">
                    <label>Time Range:</label>
                    <span>${this.formatDate(data.metadata.timeRange.start, config)} - ${this.formatDate(data.metadata.timeRange.end, config)}</span>
                </div>
                `
                    : ''
                }
            </div>
        </section>

        <section class="summary">
            <h2>📈 Summary Statistics</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>${this.formatNumber(data.summary.totalMetrics, config)}</h3>
                    <p>Total Metrics</p>
                </div>
                <div class="stat-card">
                    <h3>${this.formatNumber(data.summary.collectionRate, config)}</h3>
                    <p>Metrics/Second</p>
                </div>
                <div class="stat-card">
                    <h3>${this.formatDuration(data.summary.timeSpan)}</h3>
                    <p>Time Span</p>
                </div>
            </div>
        </section>

        ${this.formatMetricsBreakdownHtml(data.summary.metricsBreakdown)}

        ${data.quality ? this.formatQualityHtmlSection(data.quality) : ''}

        ${data.performance ? this.formatPerformanceHtmlSection(data.performance) : ''}

        ${data.errors.length > 0 ? this.formatErrorsHtmlSection(data.errors) : ''}

        <footer>
            <p>Generated by TW-Enigma Metrics Reporter v${data.metadata.version}</p>
        </footer>
    </div>
</body>
</html>`;
  }

  // Helper methods for formatting and data processing continue...
  // [Implementation continues with all the helper methods for formatting tables, sections, colors, etc.]

  /**
   * Build metrics filter from configuration
   */
  private buildMetricsFilter(config: ReporterConfig): any {
    const filter: any = {};

    if (config.includeMetricTypes) {
      filter.types = config.includeMetricTypes;
    }

    if (config.timeRange) {
      filter.startTime = config.timeRange.start;
      filter.endTime = config.timeRange.end;
    }

    return filter;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(metrics: Metric[], config: ReporterConfig): any {
    const metricsBreakdown: Record<MetricType, number> = {} as Record<MetricType, number>;

    // Initialize breakdown
    Object.values(MetricType).forEach((type) => {
      metricsBreakdown[type] = 0;
    });

    // Count metrics by type
    metrics.forEach((metric) => {
      metricsBreakdown[metric.type]++;
    });

    // Calculate time span
    const timestamps = metrics.map((m) => m.timestamp.getTime());
    const timeSpan = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;

    // Calculate collection rate
    const collectionRate = timeSpan > 0 ? metrics.length / (timeSpan / 1000) : 0;

    return {
      totalMetrics: metrics.length,
      metricsBreakdown,
      timeSpan,
      collectionRate,
    };
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log error with context
   */
  private logError(
    message: string,
    error: any,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    const errorEntry = {
      timestamp: new Date(),
      error: `${message}: ${error?.message || String(error)}`,
      context: error?.stack || error,
      severity,
    };

    this.errors.push(errorEntry);

    // Keep errors within limit
    if (this.errors.length > this.config.errorHandling.maxErrorCount) {
      this.errors.shift();
    }

    if (this.config.errorHandling.logErrors) {
      this.emit('error', errorEntry);
    }
  }

  /**
   * Make data serializable for JSON
   */
  private makeSerializable(data: any, config: ReporterConfig): any {
    return JSON.parse(
      JSON.stringify(data, (key, value) => {
        if (value instanceof Date) {
          return this.formatDate(value, config);
        }
        if (value instanceof Map) {
          return Object.fromEntries(Array.from(value));
        }
        if (value instanceof Set) {
          return Array.from(value);
        }
        if (typeof value === 'function') {
          return '[Function]';
        }
        if (value === undefined && !config.json.includeNulls) {
          return undefined;
        }
        return value;
      })
    );
  }

  /**
   * Sort object keys recursively
   */
  private sortObjectKeys(key: string, value: any): any {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: any = {};
      Object.keys(value)
        .sort()
        .forEach((k) => {
          sorted[k] = value[k];
        });
      return sorted;
    }
    return value;
  }

  /**
   * Format date according to config
   */
  private formatDate(date: Date, config: ReporterConfig): string {
    switch (config.dateFormat) {
      case 'iso':
        return date.toISOString();
      case 'readable':
        return date.toLocaleString();
      case 'timestamp':
        return date.getTime().toString();
      default:
        return date.toISOString();
    }
  }

  /**
   * Format number with precision
   */
  private formatNumber(num: number, config: ReporterConfig): string {
    return num.toFixed(config.numberPrecision);
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Apply color formatting if enabled
   */
  private colorize(
    text: string,
    type: 'header' | 'success' | 'warning' | 'error',
    config: ReporterConfig
  ): string {
    if (!config.colorOutput) return text;

    const colors = {
      header: '\x1b[36m', // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      reset: '\x1b[0m',
    };

    return `${colors[type]}${text}${colors.reset}`;
  }

  /**
   * Format header section
   */
  private formatHeader(title: string, config: ReporterConfig): string {
    const line = '='.repeat(Math.min(title.length + 4, config.humanReadable.maxTableWidth));
    return `${line}\n  ${title}  \n${line}`;
  }

  /**
   * Format footer section
   */
  private formatFooter(config: ReporterConfig): string {
    const timestamp = this.formatDate(new Date(), config);
    return `\n${'─'.repeat(50)}\nGenerated by TW-Enigma Metrics Reporter at ${timestamp}`;
  }

  /**
   * Validate report data and return warnings
   */
  private validateReport(data: ReportData, config: ReporterConfig): string[] {
    const warnings: string[] = [];

    if (data.metrics.raw.length === 0) {
      warnings.push('No metrics data available for the specified time range');
    }

    if (data.errors.length > config.errorHandling.maxErrorCount * 0.8) {
      warnings.push('High number of errors detected during collection');
    }

    if (data.summary.collectionRate < 0.1) {
      warnings.push('Low metrics collection rate detected');
    }

    return warnings;
  }

  /**
   * Extract metric value for CSV/table display
   */
  private extractMetricValue(metric: Metric): string {
    // Implementation depends on metric type structure
    return 'N/A';
  }

  /**
   * Extract metric unit for display
   */
  private extractMetricUnit(metric: Metric): string {
    // Implementation depends on metric type structure
    return '';
  }

  /**
   * Format tags for CSV output
   */
  private formatTagsForCsv(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  }

  /**
   * Format metadata for CSV output
   */
  private formatMetadataForCsv(metric: Metric): string {
    return JSON.stringify(metric).substring(0, 100);
  }

  // Additional helper methods for formatting different report sections would continue here...
  // Including formatMetricsBreakdownTable, formatQualitySection, formatPerformanceSection, etc.

  /**
   * Get HTML styles for HTML report format
   */
  private getHtmlStyles(): string {
    return `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
      .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      header { text-align: center; margin-bottom: 30px; }
      h1 { color: #2c3e50; margin: 0; }
      .subtitle { color: #7f8c8d; margin: 10px 0 0 0; }
      section { margin-bottom: 30px; }
      h2 { color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
      .info-grid, .stats-grid { display: grid; gap: 15px; margin-top: 15px; }
      .info-grid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
      .stats-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
      .info-item { display: flex; justify-content: space-between; padding: 10px; background: #ecf0f1; border-radius: 4px; }
      .stat-card { text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; }
      .stat-card h3 { margin: 0; font-size: 2em; }
      .stat-card p { margin: 5px 0 0 0; opacity: 0.9; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
      th { background: #3498db; color: white; }
      footer { text-align: center; margin-top: 40px; color: #7f8c8d; border-top: 1px solid #ddd; padding-top: 20px; }
    `;
  }

  // Placeholder methods for section formatting
  private formatMetricsBreakdownTable(
    breakdown: Record<MetricType, number>,
    config: ReporterConfig
  ): string {
    return 'Metrics breakdown table implementation...';
  }

  private formatQualitySection(
    quality: QualityStats,
    config: ReporterConfig,
    indent: string
  ): string {
    return 'Quality section implementation...';
  }

  private formatPerformanceSection(
    performance: PerformanceStats,
    config: ReporterConfig,
    indent: string
  ): string {
    return 'Performance section implementation...';
  }

  private formatMetricsTable(metrics: Metric[], config: ReporterConfig): string {
    return 'Metrics table implementation...';
  }

  private formatErrorsSection(errors: any[], config: ReporterConfig, indent: string): string {
    return 'Errors section implementation...';
  }

  private formatQualityMarkdownSection(quality: QualityStats): string {
    return 'Quality markdown section implementation...';
  }

  private formatPerformanceMarkdownSection(performance: PerformanceStats): string {
    return 'Performance markdown section implementation...';
  }

  private formatMetricsBreakdownHtml(breakdown: Record<MetricType, number>): string {
    return 'Metrics breakdown HTML implementation...';
  }

  private formatQualityHtmlSection(quality: QualityStats): string {
    return 'Quality HTML section implementation...';
  }

  private formatPerformanceHtmlSection(performance: PerformanceStats): string {
    return 'Performance HTML section implementation...';
  }

  private formatErrorsHtmlSection(errors: any[]): string {
    return 'Errors HTML section implementation...';
  }
}

/**
 * Create a metrics reporter instance
 */
export function createMetricsReporter(
  metricsCollector: MetricsCollector,
  config: Partial<ReporterConfig> = {}
): MetricsReporter {
  return new MetricsReporter(metricsCollector, config);
}

/**
 * Validate reporter configuration
 */
export function validateReporterConfig(config: unknown): ReporterConfig {
  return ReporterConfigSchema.parse(config);
}
