/**
 * HTML Report Generator for TW-Enigma
 * Converts JSON reports into self-contained HTML reports with embedded styling and interactivity
 */

import { promises as fs } from 'fs';
import path from 'path';
import { OptimizationReport, FileOptimizationResult } from './schema.js';

interface TemplateOptions {
  /** Custom CSS to inject into the report */
  customCss?: string;
  /** Custom JavaScript to inject into the report */
  customJs?: string;
  /** Report title override */
  title?: string;
  /** Theme selection */
  theme?: 'light' | 'dark' | 'auto';
  /** Whether to include interactive features */
  interactive?: boolean;
  /** Whether to include detailed file listing */
  includeFiles?: boolean;
  /** Locale for number formatting */
  locale?: string;
}

interface TemplateData extends OptimizationReport {
  /** Formatted values for display */
  formatted: {
    totalSizeSaved: string;
    totalSizeSavedPercent: string;
    totalProcessingTime: string;
    averageProcessingTime: string;
    memoryUsage: string;
    timestamp: string;
    files: Array<FileOptimizationResult & {
      formattedSizeSaved: string;
      formattedSizeSavedPercent: string;
      formattedProcessingTime: string;
    }>;
  };
  /** Chart data for visualizations */
  charts: {
    sizeSavingsData: Array<{ label: string; value: number }>;
    processingTimeData: Array<{ label: string; value: number }>;
    memoryUsageData: Array<{ label: string; value: number }>;
  };
}

export class HtmlReportGenerator {
  private locale: string;
  private options: TemplateOptions;

  constructor(options: TemplateOptions = {}) {
    this.options = {
      theme: 'auto',
      interactive: true,
      includeFiles: true,
      locale: 'en-US',
      ...options
    };
    this.locale = this.options.locale!;
  }

  /**
   * Generate HTML report from JSON data
   */
  async generateHtml(report: OptimizationReport): Promise<string> {
    try {
      // Validate input report
      this.validateReport(report);

      // Prepare template data
      const templateData = this.prepareTemplateData(report);

      // Generate HTML
      const html = this.renderTemplate(templateData);

      return html;
    } catch (error) {
      return this.generateErrorReport(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Generate and save HTML report to file
   */
  async generateHtmlFile(report: OptimizationReport, outputPath: string): Promise<void> {
    try {
      const html = await this.generateHtml(report);
      
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Write HTML file
      await fs.writeFile(outputPath, html, 'utf8');
    } catch (error) {
      throw new Error(`Failed to generate HTML file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private validateReport(report: OptimizationReport): void {
    if (!report || typeof report !== 'object') {
      throw new Error('Invalid report data: must be an object');
    }

    if (!report.metadata || !report.summary) {
      throw new Error('Invalid report data: missing required sections');
    }

    // Validate timestamp
    const timestamp = new Date(report.metadata.timestamp);
    if (isNaN(timestamp.getTime())) {
      throw new Error('Invalid report data: invalid timestamp format');
    }
  }

  private prepareTemplateData(report: OptimizationReport): TemplateData {
    const formatted = {
      totalSizeSaved: this.formatBytes(report.summary.totalSizeSavedBytes),
      totalSizeSavedPercent: this.formatPercent(report.summary.totalSizeSavedPercent),
      totalProcessingTime: this.formatTime(report.summary.totalProcessingTimeMs),
      averageProcessingTime: this.formatTime(report.summary.averageProcessingTimeMs),
      memoryUsage: this.formatBytes(report.performance.memory.peakUsageBytes),
      timestamp: this.formatDate(new Date(report.metadata.timestamp)),
      files: report.files.map(file => ({
        ...file,
        formattedSizeSaved: this.formatBytes(file.sizeSavedBytes),
        formattedSizeSavedPercent: this.formatPercent(file.sizeSavedPercent),
        formattedProcessingTime: this.formatTime(file.processingTimeMs)
      }))
    };

    const charts = this.generateChartData(report);

    return {
      ...report,
      formatted,
      charts
    };
  }

  private generateChartData(report: OptimizationReport) {
    // Size savings by file (top 10)
    const sizeSavingsData = report.files
      .filter(f => !f.error)
      .sort((a, b) => b.sizeSavedBytes - a.sizeSavedBytes)
      .slice(0, 10)
      .map(f => ({
        label: path.basename(f.originalPath),
        value: f.sizeSavedBytes
      }));

    // Processing time by file (top 10)
    const processingTimeData = report.files
      .filter(f => !f.error)
      .sort((a, b) => b.processingTimeMs - a.processingTimeMs)
      .slice(0, 10)
      .map(f => ({
        label: path.basename(f.originalPath),
        value: f.processingTimeMs
      }));

    // Memory usage progression
    const memoryUsageData = [
      { label: 'Start', value: report.performance.memory.startUsageBytes },
      { label: 'Peak', value: report.performance.memory.peakUsageBytes },
      { label: 'End', value: report.performance.memory.endUsageBytes }
    ];

    return {
      sizeSavingsData,
      processingTimeData,
      memoryUsageData
    };
  }

  private renderTemplate(data: TemplateData): string {
    const statusIcon = data.reportErrors?.some(e => e.type === 'error') ? '❌' : 
                     data.reportErrors?.some(e => e.type === 'warning') ? '⚠️' : '✅';
    const statusText = data.reportErrors?.some(e => e.type === 'error') ? 'FAILED' :
                      data.reportErrors?.some(e => e.type === 'warning') ? 'WARNINGS' : 'SUCCESS';
    const statusClass = data.reportErrors?.some(e => e.type === 'error') ? 'status-error' :
                       data.reportErrors?.some(e => e.type === 'warning') ? 'status-warning' : 'status-success';

    return `<!DOCTYPE html>
<html lang="en" data-theme="${this.options.theme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.options.title || 'TW-Enigma Optimization Report'}</title>
    <style>
        ${this.getBaseStyles()}
        ${this.options.customCss || ''}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <h1>🔥 TW-Enigma Optimization Report</h1>
                <div class="status-badge ${statusClass}">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-text">${statusText}</span>
                </div>
            </div>
            <div class="metadata">
                <span class="timestamp">Generated: ${data.formatted.timestamp}</span>
                <span class="version">v${data.metadata.version}</span>
                ${data.metadata.context.projectName ? `<span class="project">${data.metadata.context.projectName}</span>` : ''}
            </div>
        </header>

        <!-- Summary Cards -->
        <section class="summary-section">
            <div class="summary-grid">
                <div class="summary-card highlight">
                    <h3>Total Savings</h3>
                    <div class="metric-value">${data.formatted.totalSizeSaved}</div>
                    <div class="metric-subtitle">${data.formatted.totalSizeSavedPercent} reduction</div>
                </div>
                <div class="summary-card">
                    <h3>Files Optimized</h3>
                    <div class="metric-value">${data.summary.filesOptimized}</div>
                    <div class="metric-subtitle">of ${data.summary.totalFiles} processed</div>
                </div>
                <div class="summary-card">
                    <h3>Classes Optimized</h3>
                    <div class="metric-value">${data.summary.totalClassesOptimized.toLocaleString(this.locale)}</div>
                    <div class="metric-subtitle">${this.formatPercent(data.summary.classOptimizationPercent)} of total</div>
                </div>
                <div class="summary-card">
                    <h3>Processing Time</h3>
                    <div class="metric-value">${data.formatted.totalProcessingTime}</div>
                    <div class="metric-subtitle">${data.formatted.averageProcessingTime} avg/file</div>
                </div>
            </div>
        </section>

        ${this.options.interactive ? this.renderChartsSection(data) : ''}

        <!-- Performance Section -->
        <section class="performance-section">
            <h2>Performance Metrics</h2>
            <div class="performance-grid">
                <div class="perf-card">
                    <h4>Memory Usage</h4>
                    <div class="perf-metric">
                        <span class="perf-label">Peak:</span>
                        <span class="perf-value">${this.formatBytes(data.performance.memory.peakUsageBytes)}</span>
                    </div>
                    <div class="perf-metric">
                        <span class="perf-label">Start:</span>
                        <span class="perf-value">${this.formatBytes(data.performance.memory.startUsageBytes)}</span>
                    </div>
                    <div class="perf-metric">
                        <span class="perf-label">End:</span>
                        <span class="perf-value">${this.formatBytes(data.performance.memory.endUsageBytes)}</span>
                    </div>
                </div>
                ${data.performance.cpu ? `
                <div class="perf-card">
                    <h4>CPU Usage</h4>
                    <div class="perf-metric">
                        <span class="perf-label">Time:</span>
                        <span class="perf-value">${this.formatTime(data.performance.cpu.cpuTimeMs)}</span>
                    </div>
                    <div class="perf-metric">
                        <span class="perf-label">Utilization:</span>
                        <span class="perf-value">${this.formatPercent(data.performance.cpu.averageUtilizationPercent)}</span>
                    </div>
                </div>
                ` : ''}
                ${data.performance.disk ? `
                <div class="perf-card">
                    <h4>Disk I/O</h4>
                    <div class="perf-metric">
                        <span class="perf-label">Files Read:</span>
                        <span class="perf-value">${data.performance.disk.filesRead.toLocaleString(this.locale)}</span>
                    </div>
                    <div class="perf-metric">
                        <span class="perf-label">Files Written:</span>
                        <span class="perf-value">${data.performance.disk.filesWritten.toLocaleString(this.locale)}</span>
                    </div>
                    <div class="perf-metric">
                        <span class="perf-label">Data Read:</span>
                        <span class="perf-value">${this.formatBytes(data.performance.disk.bytesRead)}</span>
                    </div>
                    <div class="perf-metric">
                        <span class="perf-label">Data Written:</span>
                        <span class="perf-value">${this.formatBytes(data.performance.disk.bytesWritten)}</span>
                    </div>
                </div>
                ` : ''}
            </div>
        </section>

        ${this.renderQualitySection(data)}

        ${data.comparison ? this.renderComparisonSection(data) : ''}

        ${this.options.includeFiles ? this.renderFilesSection(data) : ''}

        ${data.reportErrors && data.reportErrors.length > 0 ? this.renderErrorsSection(data) : ''}

        <!-- Footer -->
        <footer class="footer">
            <p>Generated by <strong>TW-Enigma</strong> v${data.metadata.version} in ${this.formatTime(data.metadata.generationTimeMs)}</p>
            <p>Project: ${data.metadata.context.projectName || path.basename(data.metadata.context.projectRoot)}</p>
        </footer>
    </div>

    ${this.options.interactive ? this.getScripts() : ''}
    ${this.options.customJs ? `<script>${this.options.customJs}</script>` : ''}
</body>
</html>`;
  }

  private renderChartsSection(data: TemplateData): string {
    return `
        <!-- Charts Section -->
        <section class="charts-section">
            <h2>Visual Analytics</h2>
            <div class="charts-grid">
                <div class="chart-container">
                    <h3>Top File Savings</h3>
                    <canvas id="sizeSavingsChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <h3>Processing Time Distribution</h3>
                    <canvas id="processingTimeChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <h3>Memory Usage Pattern</h3>
                    <canvas id="memoryUsageChart" width="400" height="200"></canvas>
                </div>
            </div>
        </section>
    `;
  }

  private renderQualitySection(data: TemplateData): string {
    if (!data.quality || Object.keys(data.quality).length === 0) {
      return '';
    }

    return `
        <!-- Quality Section -->
        <section class="quality-section">
            <h2>Quality Metrics</h2>
            <div class="quality-grid">
                ${data.quality.cssValidation ? `
                <div class="quality-card">
                    <h4>CSS Validation</h4>
                    <div class="quality-metric ${data.quality.cssValidation.errors > 0 ? 'error' : 'success'}">
                        <span class="quality-label">Errors:</span>
                        <span class="quality-value">${data.quality.cssValidation.errors}</span>
                    </div>
                    <div class="quality-metric ${data.quality.cssValidation.warnings > 0 ? 'warning' : 'success'}">
                        <span class="quality-label">Warnings:</span>
                        <span class="quality-value">${data.quality.cssValidation.warnings}</span>
                    </div>
                </div>
                ` : ''}
                ${data.quality.accessibility ? `
                <div class="quality-card">
                    <h4>Accessibility</h4>
                    <div class="quality-metric ${data.quality.accessibility.preserved ? 'success' : 'error'}">
                        <span class="quality-label">Preserved:</span>
                        <span class="quality-value">${data.quality.accessibility.preserved ? 'Yes' : 'No'}</span>
                    </div>
                    ${data.quality.accessibility.score !== undefined ? `
                    <div class="quality-metric">
                        <span class="quality-label">Score:</span>
                        <span class="quality-value">${data.quality.accessibility.score}/100</span>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
                ${data.quality.compatibility ? `
                <div class="quality-card">
                    <h4>Browser Compatibility</h4>
                    <div class="quality-metric">
                        <span class="quality-label">Supported:</span>
                        <span class="quality-value">${data.quality.compatibility.supportedBrowsers.length} browsers</span>
                    </div>
                    ${data.quality.compatibility.issues ? `
                    <div class="quality-metric ${data.quality.compatibility.issues.length > 0 ? 'warning' : 'success'}">
                        <span class="quality-label">Issues:</span>
                        <span class="quality-value">${data.quality.compatibility.issues.length}</span>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        </section>
    `;
  }

  private renderComparisonSection(data: TemplateData): string {
    if (!data.comparison) return '';

    const changes = data.comparison.changes;
    return `
        <!-- Comparison Section -->
        <section class="comparison-section">
            <h2>Changes Since Previous Report</h2>
            <div class="comparison-grid">
                <div class="comparison-card">
                    <h4>Size Savings</h4>
                    <div class="comparison-metric ${changes!.sizeSavedBytesDelta >= 0 ? 'positive' : 'negative'}">
                        <span class="comparison-value">${changes!.sizeSavedBytesDelta >= 0 ? '+' : ''}${this.formatBytes(changes!.sizeSavedBytesDelta)}</span>
                        <span class="comparison-label">vs previous</span>
                    </div>
                </div>
                <div class="comparison-card">
                    <h4>Processing Time</h4>
                    <div class="comparison-metric ${changes!.processingTimeMsDelta <= 0 ? 'positive' : 'negative'}">
                        <span class="comparison-value">${changes!.processingTimeMsDelta >= 0 ? '+' : ''}${this.formatTime(changes!.processingTimeMsDelta)}</span>
                        <span class="comparison-label">vs previous</span>
                    </div>
                </div>
                <div class="comparison-card">
                    <h4>Optimization Rate</h4>
                    <div class="comparison-metric ${changes!.optimizationRateDelta >= 0 ? 'positive' : 'negative'}">
                        <span class="comparison-value">${changes!.optimizationRateDelta >= 0 ? '+' : ''}${this.formatPercent(changes!.optimizationRateDelta, true)}</span>
                        <span class="comparison-label">percentage points</span>
                    </div>
                </div>
            </div>
            <div class="comparison-note">
                <small>Compared to report from ${this.formatDate(new Date(data.comparison.previousReportTimestamp!))}</small>
            </div>
        </section>
    `;
  }

  private renderFilesSection(data: TemplateData): string {
    return `
        <!-- Files Section -->
        <section class="files-section">
            <h2>File Details</h2>
            <div class="files-container">
                <div class="files-controls">
                    <input type="text" id="fileSearch" placeholder="Search files..." class="search-input">
                    <select id="fileSort" class="sort-select">
                        <option value="sizeSaved">Sort by Size Saved</option>
                        <option value="sizeSavedPercent">Sort by % Saved</option>
                        <option value="processingTime">Sort by Processing Time</option>
                        <option value="classCount">Sort by Class Count</option>
                        <option value="fileName">Sort by File Name</option>
                    </select>
                </div>
                <div class="files-table-container">
                    <table class="files-table" id="filesTable">
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Original Size</th>
                                <th>Optimized Size</th>
                                <th>Saved</th>
                                <th>% Saved</th>
                                <th>Classes</th>
                                <th>Optimized</th>
                                <th>Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.formatted.files.map(file => `
                                <tr class="file-row ${file.error ? 'error' : 'success'}" data-file="${file.originalPath}">
                                    <td class="file-path" title="${file.originalPath}">${path.basename(file.originalPath)}</td>
                                    <td class="size-original">${this.formatBytes(file.originalSizeBytes)}</td>
                                    <td class="size-optimized">${this.formatBytes(file.optimizedSizeBytes)}</td>
                                    <td class="size-saved">${file.formattedSizeSaved}</td>
                                    <td class="percent-saved">${file.formattedSizeSavedPercent}</td>
                                    <td class="class-count">${file.classCount.toLocaleString(this.locale)}</td>
                                    <td class="classes-optimized">${file.classesOptimized.toLocaleString(this.locale)}</td>
                                    <td class="processing-time">${file.formattedProcessingTime}</td>
                                    <td class="status">${file.error ? '❌ Error' : '✅ Success'}</td>
                                </tr>
                                ${file.error ? `
                                <tr class="error-details">
                                    <td colspan="9">
                                        <div class="error-message">
                                            <strong>Error:</strong> ${file.error.message}
                                            ${file.error.code ? `<br><strong>Code:</strong> ${file.error.code}` : ''}
                                        </div>
                                    </td>
                                </tr>
                                ` : ''}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    `;
  }

  private renderErrorsSection(data: TemplateData): string {
    if (!data.reportErrors || data.reportErrors.length === 0) return '';

    return `
        <!-- Errors Section -->
        <section class="errors-section">
            <h2>Report Issues</h2>
            <div class="errors-container">
                ${data.reportErrors.map(error => `
                    <div class="error-item ${error.type}">
                        <div class="error-header">
                            <span class="error-icon">${error.type === 'error' ? '❌' : '⚠️'}</span>
                            <span class="error-type">${error.type.toUpperCase()}</span>
                        </div>
                        <div class="error-content">
                            <div class="error-message">${error.message}</div>
                            ${error.context ? `<div class="error-context">Context: ${error.context}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
  }

  private getBaseStyles(): string {
    return `
        :root {
            --primary-color: #3b82f6;
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --error-color: #ef4444;
            --bg-color: #ffffff;
            --surface-color: #f9fafb;
            --border-color: #e5e7eb;
            --text-color: #111827;
            --text-muted: #6b7280;
            --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        [data-theme="dark"] {
            --bg-color: #111827;
            --surface-color: #1f2937;
            --border-color: #374151;
            --text-color: #f9fafb;
            --text-muted: #9ca3af;
        }

        @media (prefers-color-scheme: dark) {
            [data-theme="auto"] {
                --bg-color: #111827;
                --surface-color: #1f2937;
                --border-color: #374151;
                --text-color: #f9fafb;
                --text-muted: #9ca3af;
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--bg-color);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: var(--shadow);
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--primary-color);
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 600;
        }

        .status-success {
            background: #d1fae5;
            color: #065f46;
            border: 1px solid #a7f3d0;
        }

        .status-warning {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
        }

        .status-error {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }

        .metadata {
            display: flex;
            gap: 16px;
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        .summary-section {
            margin-bottom: 32px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        .summary-card {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            box-shadow: var(--shadow);
            transition: transform 0.2s;
        }

        .summary-card:hover {
            transform: translateY(-2px);
        }

        .summary-card.highlight {
            border-color: var(--primary-color);
            background: linear-gradient(135deg, var(--surface-color) 0%, rgba(59, 130, 246, 0.05) 100%);
        }

        .summary-card h3 {
            font-size: 1rem;
            color: var(--text-muted);
            margin-bottom: 12px;
        }

        .metric-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--primary-color);
            margin-bottom: 8px;
        }

        .metric-subtitle {
            font-size: 0.9rem;
            color: var(--text-muted);
        }

        .charts-section, .performance-section, .quality-section, .comparison-section, .files-section, .errors-section {
            margin-bottom: 32px;
        }

        h2 {
            font-size: 1.8rem;
            margin-bottom: 20px;
            color: var(--text-color);
        }

        .charts-grid, .performance-grid, .quality-grid, .comparison-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .chart-container, .perf-card, .quality-card, .comparison-card {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            box-shadow: var(--shadow);
        }

        .chart-container h3, .perf-card h4, .quality-card h4, .comparison-card h4 {
            margin-bottom: 16px;
            color: var(--text-color);
        }

        .perf-metric, .quality-metric {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .perf-label, .quality-label {
            color: var(--text-muted);
        }

        .quality-metric.error .quality-value {
            color: var(--error-color);
        }

        .quality-metric.warning .quality-value {
            color: var(--warning-color);
        }

        .quality-metric.success .quality-value {
            color: var(--success-color);
        }

        .comparison-metric {
            text-align: center;
        }

        .comparison-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .comparison-metric.positive .comparison-value {
            color: var(--success-color);
        }

        .comparison-metric.negative .comparison-value {
            color: var(--error-color);
        }

        .comparison-label {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .comparison-note {
            margin-top: 16px;
            text-align: center;
            color: var(--text-muted);
        }

        .files-container {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow);
        }

        .files-controls {
            display: flex;
            gap: 16px;
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
            background: var(--bg-color);
        }

        .search-input, .sort-select {
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: var(--surface-color);
            color: var(--text-color);
        }

        .search-input {
            flex: 1;
        }

        .files-table-container {
            overflow-x: auto;
        }

        .files-table {
            width: 100%;
            border-collapse: collapse;
        }

        .files-table th,
        .files-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        .files-table th {
            background: var(--bg-color);
            font-weight: 600;
            color: var(--text-muted);
            position: sticky;
            top: 0;
        }

        .file-row.error {
            background: rgba(239, 68, 68, 0.05);
        }

        .file-row.success:hover {
            background: rgba(59, 130, 246, 0.05);
        }

        .file-path {
            font-family: monospace;
            font-size: 0.9rem;
        }

        .error-details {
            background: rgba(239, 68, 68, 0.1);
        }

        .error-message {
            padding: 8px;
            font-size: 0.9rem;
            color: var(--error-color);
        }

        .errors-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .error-item {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
        }

        .error-item.error {
            border-left: 4px solid var(--error-color);
        }

        .error-item.warning {
            border-left: 4px solid var(--warning-color);
        }

        .error-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .error-type {
            font-weight: 600;
            font-size: 0.8rem;
        }

        .error-context {
            margin-top: 8px;
            font-size: 0.9rem;
            color: var(--text-muted);
        }

        .footer {
            text-align: center;
            padding: 24px;
            margin-top: 32px;
            color: var(--text-muted);
            border-top: 1px solid var(--border-color);
        }

        @media (max-width: 768px) {
            .container {
                padding: 12px;
            }

            .header h1 {
                font-size: 2rem;
            }

            .header-content {
                flex-direction: column;
                gap: 16px;
                text-align: center;
            }

            .summary-grid {
                grid-template-columns: 1fr;
            }

            .files-controls {
                flex-direction: column;
            }

            .files-table {
                font-size: 0.8rem;
            }

            .files-table th,
            .files-table td {
                padding: 8px 4px;
            }
        }
    `;
  }

  private getScripts(): string {
    return `
    <script>
        // Chart.js minimal implementation for basic charts
        class SimpleChart {
            constructor(canvas, data, options = {}) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.data = data;
                this.options = options;
                this.draw();
            }

            draw() {
                const { width, height } = this.canvas;
                const padding = 40;
                const chartWidth = width - (padding * 2);
                const chartHeight = height - (padding * 2);

                // Clear canvas
                this.ctx.clearRect(0, 0, width, height);

                if (this.data.length === 0) {
                    this.ctx.fillStyle = '#6b7280';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('No data available', width / 2, height / 2);
                    return;
                }

                // Draw bars
                const maxValue = Math.max(...this.data.map(d => d.value));
                const barWidth = chartWidth / this.data.length * 0.8;
                const barSpacing = chartWidth / this.data.length * 0.2;

                this.data.forEach((item, index) => {
                    const barHeight = (item.value / maxValue) * chartHeight;
                    const x = padding + (index * (barWidth + barSpacing));
                    const y = height - padding - barHeight;

                    // Draw bar
                    this.ctx.fillStyle = '#3b82f6';
                    this.ctx.fillRect(x, y, barWidth, barHeight);

                    // Draw label
                    this.ctx.fillStyle = '#374151';
                    this.ctx.textAlign = 'center';
                    this.ctx.font = '12px Arial';
                    this.ctx.fillText(
                        item.label.length > 12 ? item.label.substr(0, 12) + '...' : item.label,
                        x + barWidth / 2,
                        height - 10
                    );

                    // Draw value
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.fillText(
                        this.formatValue(item.value),
                        x + barWidth / 2,
                        y - 5
                    );
                });
            }

            formatValue(value) {
                if (this.options.formatBytes) {
                    return this.formatBytes(value);
                }
                if (this.options.formatTime) {
                    return this.formatTime(value);
                }
                return value.toLocaleString();
            }

            formatBytes(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
            }

            formatTime(ms) {
                if (ms < 1000) return ms.toFixed(1) + 'ms';
                return (ms / 1000).toFixed(2) + 's';
            }
        }

        // Initialize charts
        document.addEventListener('DOMContentLoaded', function() {
            // Size savings chart
            const sizeSavingsCanvas = document.getElementById('sizeSavingsChart');
            if (sizeSavingsCanvas) {
                new SimpleChart(sizeSavingsCanvas, ${JSON.stringify(this.options.interactive ? 'sizeSavingsData' : [])}, { formatBytes: true });
            }

            // Processing time chart
            const processingTimeCanvas = document.getElementById('processingTimeChart');
            if (processingTimeCanvas) {
                new SimpleChart(processingTimeCanvas, ${JSON.stringify(this.options.interactive ? 'processingTimeData' : [])}, { formatTime: true });
            }

            // Memory usage chart
            const memoryUsageCanvas = document.getElementById('memoryUsageChart');
            if (memoryUsageCanvas) {
                new SimpleChart(memoryUsageCanvas, ${JSON.stringify(this.options.interactive ? 'memoryUsageData' : [])}, { formatBytes: true });
            }

            // File table search and sort
            const fileSearch = document.getElementById('fileSearch');
            const fileSort = document.getElementById('fileSort');
            const filesTable = document.getElementById('filesTable');

            if (fileSearch && filesTable) {
                fileSearch.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    const rows = filesTable.querySelectorAll('.file-row');
                    
                    rows.forEach(row => {
                        const fileName = row.querySelector('.file-path').textContent.toLowerCase();
                        const filePath = row.dataset.file.toLowerCase();
                        
                        if (fileName.includes(searchTerm) || filePath.includes(searchTerm)) {
                            row.style.display = '';
                        } else {
                            row.style.display = 'none';
                        }
                    });
                });
            }

            if (fileSort && filesTable) {
                fileSort.addEventListener('change', function() {
                    const sortBy = this.value;
                    const tbody = filesTable.querySelector('tbody');
                    const rows = Array.from(tbody.querySelectorAll('.file-row'));

                    rows.sort((a, b) => {
                        let aVal, bVal;

                        switch (sortBy) {
                            case 'sizeSaved':
                                aVal = parseInt(a.cells[3].textContent.replace(/[^0-9]/g, ''));
                                bVal = parseInt(b.cells[3].textContent.replace(/[^0-9]/g, ''));
                                return bVal - aVal;
                            case 'sizeSavedPercent':
                                aVal = parseFloat(a.cells[4].textContent);
                                bVal = parseFloat(b.cells[4].textContent);
                                return bVal - aVal;
                            case 'processingTime':
                                aVal = parseFloat(a.cells[7].textContent);
                                bVal = parseFloat(b.cells[7].textContent);
                                return bVal - aVal;
                            case 'classCount':
                                aVal = parseInt(a.cells[5].textContent.replace(/,/g, ''));
                                bVal = parseInt(b.cells[5].textContent.replace(/,/g, ''));
                                return bVal - aVal;
                            case 'fileName':
                                aVal = a.cells[0].textContent.toLowerCase();
                                bVal = b.cells[0].textContent.toLowerCase();
                                return aVal.localeCompare(bVal);
                            default:
                                return 0;
                        }
                    });

                    // Re-append sorted rows
                    rows.forEach(row => tbody.appendChild(row));
                });
            }

            // Theme toggle functionality
            const themeToggle = document.createElement('button');
            themeToggle.textContent = '🌓';
            themeToggle.style.cssText = 'position:fixed;top:20px;right:20px;border:none;background:var(--surface-color);color:var(--text-color);padding:8px;border-radius:50%;cursor:pointer;z-index:1000;';
            themeToggle.addEventListener('click', function() {
                const html = document.documentElement;
                const currentTheme = html.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                html.setAttribute('data-theme', newTheme);
            });
            document.body.appendChild(themeToggle);
        });
    </script>
    `;
  }

  private generateErrorReport(errorMessage: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TW-Enigma Report Generation Error</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .error-container { max-width: 600px; margin: 0 auto; text-align: center; }
        .error-icon { font-size: 4rem; margin-bottom: 20px; }
        .error-title { font-size: 2rem; margin-bottom: 16px; color: #dc2626; }
        .error-message { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; color: #991b1b; }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">❌</div>
        <h1 class="error-title">Report Generation Failed</h1>
        <div class="error-message">
            <p><strong>Error:</strong> ${errorMessage}</p>
            <p>Unable to generate the optimization report. Please check your input data and try again.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)).toLocaleString(this.locale) + ' ' + sizes[i];
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return ms.toFixed(1) + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(2) + 's';
    return (ms / 60000).toFixed(2) + 'm';
  }

  private formatPercent(percent: number, showSign: boolean = false): string {
    const sign = showSign && percent > 0 ? '+' : '';
    return sign + percent.toFixed(1) + '%';
  }

  private formatDate(date: Date): string {
    return date.toLocaleString(this.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * Utility function to generate HTML report with default options
 */
export async function generateHtmlReport(
  report: OptimizationReport,
  outputPath: string,
  options?: TemplateOptions
): Promise<void> {
  const generator = new HtmlReportGenerator(options);
  await generator.generateHtmlFile(report, outputPath);
}

/**
 * Utility function to generate HTML string from report
 */
export async function generateHtmlString(
  report: OptimizationReport,
  options?: TemplateOptions
): Promise<string> {
  const generator = new HtmlReportGenerator(options);
  return await generator.generateHtml(report);
}