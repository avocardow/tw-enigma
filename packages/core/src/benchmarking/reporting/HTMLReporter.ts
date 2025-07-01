import { promises as fs } from 'fs';
import { cpus } from 'os';
import { dirname } from 'path';
import { createLogger } from '../../utils/logger';
import { BenchmarkResult } from '../types';
import { ChartGenerator, ChartOutput } from '../visualization/ChartGenerator';

const logger = createLogger('HTMLReporter');

/**
 * HTML report configuration
 */
export interface HTMLReportConfig {
  title: string;
  outputPath: string;
  template: 'default' | 'dark' | 'minimal' | 'accessible';
  includeCharts: boolean;
  includeRawData: boolean;
  includeMetadata: boolean;
  theme: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
  };
  accessibility: {
    enabled: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
    screenReaderSupport: boolean;
  };
  interactive: {
    enabled: boolean;
    filters: boolean;
    sorting: boolean;
    search: boolean;
    compareMode: boolean;
  };
  export: {
    enabled: boolean;
    formats: Array<'pdf' | 'csv' | 'json' | 'png'>;
  };
}

/**
 * Report section data
 */
export interface ReportSection {
  id: string;
  title: string;
  content: string;
  charts?: ChartOutput[];
  data?: any;
  order: number;
}

/**
 * HTML template data
 */
export interface TemplateData {
  title: string;
  timestamp: string;
  summary: BenchmarkSummary;
  sections: ReportSection[];
  charts: ChartOutput[];
  rawData?: string;
  metadata?: ReportMetadata;
  config: HTMLReportConfig;
}

/**
 * Benchmark summary for overview
 */
export interface BenchmarkSummary {
  totalTests: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  memoryUsage: {
    peak: number;
    average: number;
  };
  cpuUsage: {
    peak: number;
    average: number;
  };
  status: 'success' | 'warning' | 'error';
  insights: string[];
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  generatedAt: string;
  environment: {
    platform: string;
    node: string;
    memory: number;
    cpu: string;
  };
  configuration: any;
  version: string;
}

/**
 * Comprehensive HTML reporter for benchmark results
 */
export class HTMLReporter {
  private chartGenerator: ChartGenerator;
  private config: HTMLReportConfig;

  constructor(config: Partial<HTMLReportConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.chartGenerator = new ChartGenerator();
  }

  /**
   * Generate HTML report from benchmark results
   */
  async generateReport(results: BenchmarkResult[]): Promise<string> {
    try {
      logger.info('Generating HTML report', {
        resultCount: results.length,
        outputPath: this.config.outputPath,
      });

      // Prepare data
      const summary = this.generateSummary(results);
      const sections = await this.generateSections(results);
      const charts = this.config.includeCharts ? await this.generateCharts(results) : [];
      const rawData = this.config.includeRawData ? JSON.stringify(results, null, 2) : undefined;
      const metadata = this.config.includeMetadata ? this.generateMetadata() : undefined;

      const templateData: TemplateData = {
        title: this.config.title,
        timestamp: new Date().toISOString(),
        summary,
        sections,
        charts,
        rawData,
        metadata,
        config: this.config,
      };

      // Generate HTML
      const html = await this.renderTemplate(templateData);

      // Write to file
      await this.writeReport(html);

      logger.info('HTML report generated successfully', {
        outputPath: this.config.outputPath,
        size: html.length,
      });

      return this.config.outputPath;
    } catch (error) {
      logger.error('Failed to generate HTML report', { error });
      throw error;
    }
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary(results: BenchmarkResult[]): BenchmarkSummary {
    const metrics = results.map((r) => r.metrics);
    const times = results.map((r) => r.duration);
    const memoryValues = metrics.map((m) => m.memoryUsage.heapUsed);
    const cpuValues = metrics.map((m) => m.cpuUsage.user + m.cpuUsage.system);

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const avgTime = totalTime / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const avgMemory = memoryValues.reduce((sum, mem) => sum + mem, 0) / memoryValues.length;
    const peakMemory = Math.max(...memoryValues);

    const avgCpu = cpuValues.reduce((sum, cpu) => sum + cpu, 0) / cpuValues.length;
    const peakCpu = Math.max(...cpuValues);

    // Determine status
    let status: 'success' | 'warning' | 'error' = 'success';
    const insights: string[] = [];

    if (maxTime > avgTime * 3) {
      status = 'warning';
      insights.push('Some tests are significantly slower than average');
    }

    if (peakMemory > 100 * 1024 * 1024) {
      // 100MB
      status = 'warning';
      insights.push('High memory usage detected');
    }

    if (peakCpu > 80000000) {
      // 80ms of CPU time
      status = 'warning';
      insights.push('High CPU usage detected');
    }

    if (results.some((r) => !r.success)) {
      status = 'error';
      insights.push('Some benchmarks failed');
    }

    return {
      totalTests: results.length,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      memoryUsage: {
        peak: peakMemory,
        average: avgMemory,
      },
      cpuUsage: {
        peak: peakCpu,
        average: avgCpu,
      },
      status,
      insights,
    };
  }

  /**
   * Generate report sections
   */
  private async generateSections(results: BenchmarkResult[]): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];

    // Overview section
    sections.push({
      id: 'overview',
      title: 'Overview',
      content: this.generateOverviewContent(results),
      order: 1,
    });

    // Performance section
    sections.push({
      id: 'performance',
      title: 'Performance Analysis',
      content: this.generatePerformanceContent(results),
      order: 2,
    });

    // Details section
    sections.push({
      id: 'details',
      title: 'Detailed Results',
      content: this.generateDetailsContent(results),
      data: results,
      order: 3,
    });

    // Comparison section if multiple results
    if (results.length > 1) {
      sections.push({
        id: 'comparison',
        title: 'Comparison',
        content: this.generateComparisonContent(results),
        order: 4,
      });
    }

    return sections.sort((a, b) => a.order - b.order);
  }

  /**
   * Generate charts for results
   */
  private async generateCharts(results: BenchmarkResult[]): Promise<ChartOutput[]> {
    const charts: ChartOutput[] = [];

    try {
      // Performance trend chart
      const performanceChart = await this.chartGenerator.generatePerformanceTimeline(results, {
        title: 'Performance Timeline',
        width: 800,
        height: 400,
        colors: ['#2563eb', '#dc2626', '#16a34a'],
        accessibility: {
          enabled: this.config.accessibility.enabled,
          keyboardNavigation: true,
        },
      });
      charts.push(performanceChart);

      // Memory usage chart
      const memoryChart = await this.chartGenerator.generateMemoryUsageChart(results, {
        title: 'Memory Usage',
        width: 800,
        height: 400,
        colors: ['#7c3aed'],
        accessibility: {
          enabled: this.config.accessibility.enabled,
          keyboardNavigation: true,
        },
      });
      charts.push(memoryChart);

      // CPU usage distribution if enough data
      if (results.length > 5) {
        const comparisonChart = await this.chartGenerator.generateComparisonChart(results, {
          title: 'Performance Comparison',
          width: 800,
          height: 400,
          colors: ['#ea580c'],
          accessibility: {
            enabled: this.config.accessibility.enabled,
            keyboardNavigation: true,
          },
        });
        charts.push(comparisonChart);
      }
    } catch (error) {
      logger.warn('Failed to generate some charts', { error });
    }

    return charts;
  }

  /**
   * Generate HTML content
   */
  private generateOverviewContent(results: BenchmarkResult[]): string {
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return `
      <div class="overview-grid">
        <div class="metric-card">
          <h3>Total Tests</h3>
          <div class="metric-value">${results.length}</div>
        </div>
        <div class="metric-card">
          <h3>Successful</h3>
          <div class="metric-value success">${successful}</div>
        </div>
        <div class="metric-card">
          <h3>Failed</h3>
          <div class="metric-value ${failed > 0 ? 'error' : 'success'}">${failed}</div>
        </div>
        <div class="metric-card">
          <h3>Success Rate</h3>
          <div class="metric-value">${((successful / results.length) * 100).toFixed(1)}%</div>
        </div>
      </div>
    `;
  }

  private generatePerformanceContent(results: BenchmarkResult[]): string {
    const sortedByTime = [...results].sort((a, b) => b.duration - a.duration);
    const fastest = sortedByTime[sortedByTime.length - 1];
    const slowest = sortedByTime[0];

    return `
      <div class="performance-analysis">
        <div class="performance-highlights">
          <div class="highlight">
            <h4>Fastest Test</h4>
            <p>${fastest.name}: ${fastest.duration.toFixed(2)}ms</p>
          </div>
          <div class="highlight">
            <h4>Slowest Test</h4>
            <p>${slowest.name}: ${slowest.duration.toFixed(2)}ms</p>
          </div>
        </div>
        <div class="performance-table">
          <table>
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Execution Time</th>
                <th>Memory Usage</th>
                <th>CPU Usage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${results
                .map(
                  (result) => `
                <tr class="result-row ${result.success ? 'completed' : 'failed'}">
                  <td>${result.name}</td>
                  <td>${result.duration.toFixed(2)}ms</td>
                  <td>${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB</td>
                  <td>${((result.metrics.cpuUsage.user + result.metrics.cpuUsage.system) / 1000).toFixed(1)}ms</td>
                  <td><span class="status ${result.success ? 'completed' : 'failed'}">${result.success ? 'completed' : 'failed'}</span></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private generateDetailsContent(results: BenchmarkResult[]): string {
    return `
      <div class="details-container">
        ${results
          .map(
            (result) => `
          <div class="result-detail">
            <h4>${result.name}</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Duration:</label>
                <span>${result.duration.toFixed(2)}ms</span>
              </div>
              <div class="detail-item">
                <label>Memory:</label>
                <span>${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB</span>
              </div>
              <div class="detail-item">
                <label>CPU:</label>
                <span>${((result.metrics.cpuUsage.user + result.metrics.cpuUsage.system) / 1000).toFixed(1)}ms</span>
              </div>
              <div class="detail-item">
                <label>Status:</label>
                <span class="status ${result.success ? 'completed' : 'failed'}">${result.success ? 'completed' : 'failed'}</span>
              </div>
            </div>
            ${result.error ? `<div class="error-details"><strong>Error:</strong> ${result.error.message}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  private generateComparisonContent(results: BenchmarkResult[]): string {
    // Simple comparison table
    return `
      <div class="comparison-container">
        <p>Comparison analysis available for ${results.length} tests.</p>
        <div class="comparison-note">
          <em>Detailed comparison features can be expanded in future versions.</em>
        </div>
      </div>
    `;
  }

  /**
   * Generate metadata
   */
  private generateMetadata(): ReportMetadata {
    return {
      generatedAt: new Date().toISOString(),
      environment: {
        platform: process.platform,
        node: process.version,
        memory: process.memoryUsage().heapTotal,
        cpu: cpus()[0]?.model || 'Unknown',
      },
      configuration: this.config,
      version: '1.0.0',
    };
  }

  /**
   * Render HTML template
   */
  private async renderTemplate(data: TemplateData): Promise<string> {
    const template = this.getTemplate(this.config.template);

    return template
      .replace('{{title}}', data.title)
      .replace('{{timestamp}}', new Date(data.timestamp).toLocaleString())
      .replace('{{summary}}', this.renderSummary(data.summary))
      .replace('{{sections}}', this.renderSections(data.sections))
      .replace('{{charts}}', this.renderCharts(data.charts))
      .replace('{{rawData}}', data.rawData ? `<pre>${data.rawData}</pre>` : '')
      .replace('{{metadata}}', data.metadata ? this.renderMetadata(data.metadata) : '')
      .replace('{{styles}}', this.getStyles())
      .replace('{{scripts}}', this.getScripts())
      .replace('{{theme}}', JSON.stringify(data.config.theme));
  }

  /**
   * Get HTML template
   */
  private getTemplate(template: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{styles}}</style>
    ${this.config.accessibility.enabled ? this.getAccessibilityStyles() : ''}
</head>
<body class="theme-${template}">
    <header class="report-header">
        <h1>{{title}}</h1>
        <p class="timestamp">Generated: {{timestamp}}</p>
    </header>

    <main class="report-content">
        <section class="summary-section">
            {{summary}}
        </section>

        <section class="sections-container">
            {{sections}}
        </section>

        <section class="charts-section">
            {{charts}}
        </section>

        ${this.config.includeRawData ? '<section class="raw-data-section"><h2>Raw Data</h2>{{rawData}}</section>' : ''}

        ${this.config.includeMetadata ? '<section class="metadata-section"><h2>Metadata</h2>{{metadata}}</section>' : ''}
    </main>

    <footer class="report-footer">
        <p>Generated by TW-Enigma Benchmarking System</p>
    </footer>

    <script>{{scripts}}</script>
</body>
</html>
    `;
  }

  /**
   * Render summary section
   */
  private renderSummary(summary: BenchmarkSummary): string {
    return `
      <div class="summary-overview">
        <div class="summary-header">
          <h2>Benchmark Summary</h2>
          <div class="status-indicator ${summary.status}">${summary.status.toUpperCase()}</div>
        </div>
        <div class="summary-grid">
          <div class="summary-card">
            <h3>Tests</h3>
            <div class="metric">${summary.totalTests}</div>
          </div>
          <div class="summary-card">
            <h3>Total Time</h3>
            <div class="metric">${summary.totalTime.toFixed(2)}ms</div>
          </div>
          <div class="summary-card">
            <h3>Average Time</h3>
            <div class="metric">${summary.avgTime.toFixed(2)}ms</div>
          </div>
          <div class="summary-card">
            <h3>Peak Memory</h3>
            <div class="metric">${(summary.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB</div>
          </div>
        </div>
        ${
          summary.insights.length > 0
            ? `
          <div class="insights">
            <h3>Insights</h3>
            <ul>
              ${summary.insights.map((insight) => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Render sections
   */
  private renderSections(sections: ReportSection[]): string {
    return sections
      .map(
        (section) => `
      <section id="${section.id}" class="report-section">
        <h2>${section.title}</h2>
        <div class="section-content">
          ${section.content}
        </div>
      </section>
    `
      )
      .join('');
  }

  /**
   * Render charts
   */
  private renderCharts(charts: ChartOutput[]): string {
    if (!this.config.includeCharts || charts.length === 0) {
      return '';
    }

    return `
      <div class="charts-container">
        <h2>Performance Charts</h2>
        <div class="charts-grid">
          ${charts
            .map(
              (chart) => `
            <div class="chart-container">
              <h3>${chart.config.title || 'Chart'}</h3>
              <div class="chart-wrapper">${chart.svg}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render metadata
   */
  private renderMetadata(metadata: ReportMetadata): string {
    return `
      <div class="metadata-container">
        <div class="metadata-grid">
          <div class="metadata-item">
            <label>Generated:</label>
            <span>${new Date(metadata.generatedAt).toLocaleString()}</span>
          </div>
          <div class="metadata-item">
            <label>Platform:</label>
            <span>${metadata.environment.platform}</span>
          </div>
          <div class="metadata-item">
            <label>Node.js:</label>
            <span>${metadata.environment.node}</span>
          </div>
          <div class="metadata-item">
            <label>CPU:</label>
            <span>${metadata.environment.cpu}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get CSS styles
   */
  private getStyles(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: ${this.config.theme.textColor};
        background-color: ${this.config.theme.backgroundColor};
      }

      .report-header {
        background: ${this.config.theme.primaryColor};
        color: white;
        padding: 2rem;
        text-align: center;
      }

      .report-header h1 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
      }

      .timestamp {
        opacity: 0.8;
        font-size: 0.9rem;
      }

      .report-content {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }

      .summary-section {
        margin-bottom: 3rem;
      }

      .summary-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      }

      .status-indicator {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-weight: bold;
        font-size: 0.8rem;
      }

      .status-indicator.success { background: #10b981; color: white; }
      .status-indicator.warning { background: #f59e0b; color: white; }
      .status-indicator.error { background: #ef4444; color: white; }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .summary-card {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        text-align: center;
      }

      .summary-card h3 {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 0.5rem;
      }

      .summary-card .metric {
        font-size: 2rem;
        font-weight: bold;
        color: ${this.config.theme.primaryColor};
      }

      .insights {
        background: #f8fafc;
        padding: 1.5rem;
        border-radius: 8px;
        border-left: 4px solid ${this.config.theme.accentColor};
      }

      .insights h3 {
        margin-bottom: 1rem;
        color: ${this.config.theme.primaryColor};
      }

      .insights ul {
        list-style: none;
      }

      .insights li {
        padding: 0.25rem 0;
        position: relative;
        padding-left: 1.5rem;
      }

      .insights li::before {
        content: '•';
        color: ${this.config.theme.accentColor};
        position: absolute;
        left: 0;
      }

      .report-section {
        margin-bottom: 3rem;
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .report-section h2 {
        color: ${this.config.theme.primaryColor};
        margin-bottom: 1.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #e5e7eb;
      }

      .overview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
      }

      .metric-card {
        text-align: center;
        padding: 1rem;
        background: #f8fafc;
        border-radius: 6px;
      }

      .metric-card h3 {
        font-size: 0.8rem;
        color: #666;
        margin-bottom: 0.5rem;
      }

      .metric-value {
        font-size: 1.5rem;
        font-weight: bold;
      }

      .metric-value.success { color: #10b981; }
      .metric-value.error { color: #ef4444; }

      .performance-table table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
      }

      .performance-table th,
      .performance-table td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
      }

      .performance-table th {
        background: #f8fafc;
        font-weight: 600;
        color: ${this.config.theme.primaryColor};
      }

      .result-row.failed {
        background: #fef2f2;
      }

      .status {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: bold;
        text-transform: uppercase;
      }

      .status.completed { background: #d1fae5; color: #065f46; }
      .status.failed { background: #fee2e2; color: #991b1b; }

      .charts-container {
        margin-top: 2rem;
      }

      .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 2rem;
        margin-top: 1rem;
      }

      .chart-container {
        text-align: center;
        background: white;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .chart-container h3 {
        margin-bottom: 1rem;
        color: ${this.config.theme.primaryColor};
      }

      .chart-container img {
        max-width: 100%;
        height: auto;
      }

      .raw-data-section pre {
        background: #f8fafc;
        padding: 1rem;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 0.8rem;
      }

      .report-footer {
        text-align: center;
        padding: 2rem;
        color: #666;
        font-size: 0.9rem;
        border-top: 1px solid #e5e7eb;
      }

      @media (max-width: 768px) {
        .report-content {
          padding: 1rem;
        }

        .summary-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .charts-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
  }

  /**
   * Get accessibility styles
   */
  private getAccessibilityStyles(): string {
    return `
      <style>
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .high-contrast {
          filter: contrast(1.2);
        }

        button, a {
          min-height: 44px;
          min-width: 44px;
        }

        :focus {
          outline: 2px solid ${this.config.theme.accentColor};
          outline-offset: 2px;
        }
      </style>
    `;
  }

  /**
   * Get JavaScript code
   */
  private getScripts(): string {
    if (!this.config.interactive.enabled) {
      return '';
    }

    return `
      document.addEventListener('DOMContentLoaded', function() {
        // Add interactive features
        console.log('TW-Enigma Benchmark Report loaded');

        // Add filter functionality if enabled
        if (${this.config.interactive.filters}) {
          // Filter implementation would go here
        }

        // Add sorting if enabled
        if (${this.config.interactive.sorting}) {
          // Sorting implementation would go here
        }

        // Add search if enabled
        if (${this.config.interactive.search}) {
          // Search implementation would go here
        }
      });
    `;
  }

  /**
   * Write report to file
   */
  private async writeReport(html: string): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.config.outputPath), { recursive: true });

      // Write HTML file
      await fs.writeFile(this.config.outputPath, html, 'utf-8');

      logger.info('HTML report written successfully', {
        path: this.config.outputPath,
        size: html.length,
      });
    } catch (error) {
      logger.error('Failed to write HTML report', { error, path: this.config.outputPath });
      throw error;
    }
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<HTMLReportConfig>): HTMLReportConfig {
    const defaults: HTMLReportConfig = {
      title: 'Benchmark Report',
      outputPath: './benchmark-report.html',
      template: 'default',
      includeCharts: true,
      includeRawData: false,
      includeMetadata: true,
      theme: {
        primaryColor: '#2563eb',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        accentColor: '#7c3aed',
      },
      accessibility: {
        enabled: true,
        highContrast: false,
        reducedMotion: false,
        screenReaderSupport: true,
      },
      interactive: {
        enabled: true,
        filters: false,
        sorting: false,
        search: false,
        compareMode: false,
      },
      export: {
        enabled: false,
        formats: ['pdf', 'csv'],
      },
    };

    return {
      ...defaults,
      ...config,
      theme: { ...defaults.theme, ...config.theme },
      accessibility: { ...defaults.accessibility, ...config.accessibility },
      interactive: { ...defaults.interactive, ...config.interactive },
      export: { ...defaults.export, ...config.export },
    };
  }
}

/**
 * Factory function for creating HTML reporter
 */
export function createHTMLReporter(config?: Partial<HTMLReportConfig>): HTMLReporter {
  return new HTMLReporter(config);
}

/**
 * Convenience function for generating HTML report
 */
export async function generateHTMLReport(
  results: BenchmarkResult[],
  config?: Partial<HTMLReportConfig>
): Promise<string> {
  const reporter = createHTMLReporter(config);
  return reporter.generateReport(results);
}
