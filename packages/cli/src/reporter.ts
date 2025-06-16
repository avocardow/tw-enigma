/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ReporterConfig {
  format?: 'console' | 'json' | 'csv';
  verbosity?: 'minimal' | 'summary' | 'detailed';
  colors?: boolean;
  showPerformance?: boolean;
  showPatterns?: boolean;
  showSizeAnalysis?: boolean;
  maxTableItems?: number;
  includeRecommendations?: boolean;
}

export interface PatternStats {
  patternName: string;
  frequency: number;
  sizeSavings: number;
  efficiency: number;
  type: string;
  size: number;
}

export interface SizeReduction {
  originalSize: number;
  optimizedSize: number;
  compressedSize: number;
  sizeReduction: number;
  percentageReduction: number;
  compressionRatio: number;
}

export interface CompressionMetrics {
  compressionRatio: number;
  compressionSavings: number;
  compressionPercentage: number;
  estimatedGzipSize: number;
  estimatedBrotliSize: number;
}

export interface OptimizationSavings {
  totalSavings: number;
  averageSavings: number;
  maxSavings: number;
  minSavings: number;
  filesOptimized: number;
}

export interface ReporterStats {
  uptime: number;
  reportsGenerated: number;
  lastReportTime?: number;
}

export default class Reporter {
  public config: Required<ReporterConfig>;
  private reports: any[] = [];
  private startTime: number;

  constructor(config: ReporterConfig = {}) {
    this.config = {
      format: 'console',
      verbosity: 'summary',
      colors: true,
      showPerformance: true,
      showPatterns: true,
      showSizeAnalysis: true,
      maxTableItems: 10,
      includeRecommendations: true,
      ...config,
    };
    this.startTime = Date.now();
  }

  getReports(): any[] {
    return [...this.reports]; // Return a copy to prevent mutation
  }

  getStats(): ReporterStats & { config: Required<ReporterConfig> } {
    return {
      uptime: Date.now() - this.startTime,
      reportsGenerated: this.reports.length,
      lastReportTime:
        this.reports.length > 0 ? this.reports[this.reports.length - 1]?.timestamp : undefined,
      config: this.config,
    };
  }

  calculateSizeReductions(
    originalSize: number,
    optimizedSize: number,
    compressedSize?: number
  ): SizeReduction {
    const actualCompressedSize = compressedSize ?? optimizedSize * 0.3; // Estimate compression
    const sizeReduction = originalSize - optimizedSize;
    const percentageReduction = originalSize > 0 ? (sizeReduction / originalSize) * 100 : 0;
    const compressionRatio = originalSize > 0 ? optimizedSize / originalSize : 1;

    return {
      originalSize,
      optimizedSize,
      compressedSize: actualCompressedSize,
      sizeReduction,
      percentageReduction,
      compressionRatio,
    };
  }

  calculateCompressionMetrics(originalSize: number, compressedSize: number): CompressionMetrics {
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
    const compressionSavings = originalSize - compressedSize;
    const compressionPercentage = originalSize > 0 ? (compressionSavings / originalSize) * 100 : 0;
    const estimatedGzipSize = originalSize * 0.3; // Typical gzip compression
    const estimatedBrotliSize = originalSize * 0.25; // Typical brotli compression

    return {
      compressionRatio,
      compressionSavings,
      compressionPercentage,
      estimatedGzipSize,
      estimatedBrotliSize,
    };
  }

  calculateOptimizationSavings(fileData: any): OptimizationSavings {
    const files = fileData.files || [];

    if (files.length === 0) {
      return {
        totalSavings: 0,
        averageSavings: 0,
        maxSavings: 0,
        minSavings: 0,
        filesOptimized: 0,
      };
    }

    const savings = files.map((file: any) => file.originalSize - file.optimizedSize);
    const totalSavings = savings.reduce((sum: number, saving: number) => sum + saving, 0);
    const averageSavings = totalSavings / files.length;
    const maxSavings = Math.max(...savings);
    const minSavings = Math.min(...savings);

    return {
      totalSavings,
      averageSavings,
      maxSavings,
      minSavings,
      filesOptimized: files.length,
    };
  }

  generatePatternStats(data: any): PatternStats[] {
    const patterns = data.patterns || [];

    return patterns
      .map((pattern: any) => ({
        patternName: pattern.name,
        frequency: pattern.frequency,
        sizeSavings: pattern.sizeSavings,
        efficiency: this.calculatePatternEfficiency(pattern),
        type: pattern.type,
        size: pattern.size,
      }))
      .sort((a: PatternStats, b: PatternStats) => b.sizeSavings - a.sizeSavings); // Sort by savings descending
  }

  calculatePatternEfficiency(pattern: any): number {
    if (pattern.frequency === 0 || pattern.size === 0) {
      return 0;
    }

    const efficiency = pattern.sizeSavings / pattern.frequency / pattern.size;
    return Math.min(efficiency, 1.0); // Cap at 1.0
  }

  addReport(report: any): void {
    const reportWithTimestamp = {
      ...report,
      timestamp: Date.now(),
    };
    this.reports.push(reportWithTimestamp);
  }

  generateSummary(data: any): string {
    const sizeReduction = this.calculateSizeReductions(
      data.originalSize || 0,
      data.optimizedSize || 0,
      data.compressedSize
    );

    let summary = '📊 OPTIMIZATION REPORT\n\n';
    summary += `Generated: ${new Date().toISOString()}\n\n`;

    if (this.config.showSizeAnalysis) {
      summary += `SIZE ANALYSIS\n`;
      summary += `  Original:   ${this.formatFileSize(sizeReduction.originalSize)}\n`;
      summary += `  Optimized:  ${this.formatFileSize(sizeReduction.optimizedSize)}\n`;
      summary += `  Compressed: ${this.formatFileSize(sizeReduction.compressedSize)}\n`;
      summary += `  Reduction:  ${sizeReduction.percentageReduction.toFixed(1)}%\n\n`;
    }

    if (this.config.showPerformance && data.executionTime) {
      summary += `PERFORMANCE METRICS\n`;
      summary += `  Execution Time: ${data.executionTime}ms\n`;
      if (data.memoryUsage) {
        summary += `  Memory Usage: ${this.formatFileSize(data.memoryUsage)}\n`;
      }
      summary += `  Files Processed: ${data.filesProcessed || 0}\n\n`;
    }

    if (this.config.showPatterns && data.patterns) {
      const patterns = this.generatePatternStats(data);
      if (patterns.length > 0) {
        const totalPatterns = patterns.length;
        const shownPatterns = Math.min(patterns.length, this.config.maxTableItems);

        summary += `PATTERN STATISTICS\n`;
        if (shownPatterns < totalPatterns) {
          summary += `Showing top ${shownPatterns} of ${totalPatterns} patterns\n`;
        }
        patterns.slice(0, this.config.maxTableItems).forEach((pattern) => {
          summary += `  ${pattern.patternName}: ${this.formatFileSize(pattern.sizeSavings)} (${pattern.frequency}x)\n`;
        });
        summary += '\n';
      }
    }

    return summary;
  }

  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // Special case for 0 bytes
    if (bytes === 0) {
      return '0 B';
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  report(data: any): string {
    this.addReport(data);

    switch (this.config.format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.generateCSV(data);
      default:
        return this.generateSummary(data);
    }
  }

  generatePatternBreakdown(patterns: PatternStats[]): any {
    const breakdown: any = {
      utility: { count: 0, totalSavings: 0 },
      component: { count: 0, totalSavings: 0 },
      responsive: { count: 0, totalSavings: 0 },
      state: { count: 0, totalSavings: 0 },
    };

    patterns.forEach((pattern) => {
      const type = pattern.type || 'utility';
      if (breakdown[type]) {
        breakdown[type].count++;
        breakdown[type].totalSavings += pattern.sizeSavings;
      }
    });

    return breakdown;
  }

  calculatePerformanceMetrics(data: any): any {
    const executionTime = data.executionTime || 0;
    const filesProcessed = data.filesProcessed || 0;
    const memoryUsage = data.memoryUsage || process.memoryUsage().heapUsed;

    return {
      executionTime,
      memoryUsage,
      throughput: executionTime > 0 ? filesProcessed / (executionTime / 1000) : 0,
      avgProcessingTime: filesProcessed > 0 ? executionTime / filesProcessed : 0,
      memoryEfficiency: memoryUsage > 0 ? filesProcessed / memoryUsage : 0,
    };
  }

  generateReport(data: any): any {
    if (!data) {
      throw new Error('Failed to generate report: No data provided');
    }

    const sizeMetrics = this.calculateSizeReductions(
      data.originalSize || 0,
      data.optimizedSize || 0,
      data.compressedSize
    );

    const compressionMetrics = this.calculateCompressionMetrics(
      data.originalSize || 0,
      data.compressedSize || sizeMetrics.compressedSize
    );

    const optimizationSavings = this.calculateOptimizationSavings(data);
    const performanceMetrics = this.calculatePerformanceMetrics(data);
    const patternStats = this.generatePatternStats(data);

    const report = {
      metadata: {
        timestamp: Date.now(),
        reportId: Math.random().toString(36).substr(2, 9),
        version: '1.0.0',
        generatorConfig: this.config,
      },
      sizeMetrics,
      compressionMetrics,
      optimizationSavings,
      performanceMetrics,
      patternStats,
      recommendations: this.generateRecommendations(data),
      warnings: this.generateWarnings(data),
      rawData: data,
    };

    this.addReport(report);
    return report;
  }

  generateRecommendations(data: any): string[] {
    const recommendations: string[] = [];

    if (!data) {
      return recommendations;
    }

    const sizeReduction = this.calculateSizeReductions(
      data.originalSize || 0,
      data.optimizedSize || 0
    );

    // Size-based recommendations
    if (sizeReduction.percentageReduction < 20) {
      recommendations.push(
        'Consider enabling more aggressive optimization techniques for better size reduction'
      );
    }

    // Performance-based recommendations
    if (data.executionTime && data.executionTime > 5000) {
      recommendations.push(
        'Optimization took longer than expected. Consider processing files in smaller batches'
      );
    }

    // Pattern-based recommendations
    const patterns = this.generatePatternStats(data);
    const lowEfficiencyPatterns = patterns.filter((p) => p.efficiency < 0.3);
    if (lowEfficiencyPatterns.length > 0) {
      recommendations.push(
        `Found ${lowEfficiencyPatterns.length} patterns with low efficiency. Consider reviewing pattern usage`
      );
    }

    return recommendations;
  }

  generateWarnings(data: any): string[] {
    const warnings: string[] = [];

    if (!data) {
      warnings.push('Invalid or missing optimization data');
      return warnings;
    }

    const sizeReduction = this.calculateSizeReductions(
      data.originalSize || 0,
      data.optimizedSize || 0
    );

    // Size warnings
    if (sizeReduction.sizeReduction < 0) {
      warnings.push('Size increased after optimization - this may indicate a configuration issue');
    }

    // Performance warnings
    if (data.executionTime && data.executionTime > 30000) {
      warnings.push('Optimization took extremely long - consider performance tuning');
    }

    // Error warnings
    if (data.errors && data.errors.length > 0) {
      warnings.push(`${data.errors.length} errors occurred during optimization`);
    }

    return warnings;
  }

  formatBytes(bytes: number): string {
    return this.formatFileSize(bytes);
  }

  formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}m`;
    }
  }

  displayReport(report: any, format?: string): string {
    const outputFormat = format || this.config.format;

    switch (outputFormat) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.generateCSV(report.rawData || report);
      case 'markdown':
        return this.generateMarkdown(report);
      case 'html':
        return this.generateHTML(report);
      case 'all':
        return {
          console: this.generateSummary(report.rawData || report),
          json: JSON.stringify(report, null, 2),
          markdown: this.generateMarkdown(report),
          html: this.generateHTML(report),
        } as any;
      default:
        if (outputFormat !== 'console') {
          throw new Error(`Unsupported format: ${outputFormat}`);
        }
        return this.generateSummary(report.rawData || report);
    }
  }

  clearReports(): void {
    this.reports.length = 0;
  }

  private generateMarkdown(report: any): string {
    let markdown = '# Optimization Report\n\n';

    if (report.sizeMetrics) {
      markdown += '## Size Analysis\n\n';
      markdown += `- **Original Size**: ${this.formatFileSize(report.sizeMetrics.originalSize)}\n`;
      markdown += `- **Optimized Size**: ${this.formatFileSize(report.sizeMetrics.optimizedSize)}\n`;
      markdown += `- **Reduction**: ${report.sizeMetrics.percentageReduction.toFixed(1)}%\n\n`;
    }

    if (report.performanceMetrics) {
      markdown += '## Performance\n\n';
      markdown += `- **Execution Time**: ${this.formatDuration(report.performanceMetrics.executionTime)}\n`;
      markdown += `- **Throughput**: ${report.performanceMetrics.throughput.toFixed(2)} files/sec\n\n`;
    }

    if (report.patternStats && report.patternStats.length > 0) {
      markdown += '## Pattern Statistics\n\n';
    }

    return markdown;
  }

  private generateHTML(report: any): string {
    let html = '<!DOCTYPE html><html><head><title>Optimization Report</title></head><body>';
    html += '<h1>📊 Optimization Report</h1>';

    if (report.sizeMetrics) {
      html += '<h2>📊 Size Analysis</h2>';
      html += '<ul>';
      html += `<li><strong>Original Size:</strong> ${this.formatFileSize(report.sizeMetrics.originalSize)}</li>`;
      html += `<li><strong>Optimized Size:</strong> ${this.formatFileSize(report.sizeMetrics.optimizedSize)}</li>`;
      html += `<li><strong>Reduction:</strong> ${report.sizeMetrics.percentageReduction.toFixed(1)}%</li>`;
      html += '</ul>';
    }

    html += '</body></html>';
    return html;
  }

  private generateCSV(data: any): string {
    // Simple CSV generation for basic data
    const headers = ['metric', 'value'];
    const rows = [
      ['originalSize', data.originalSize || 0],
      ['optimizedSize', data.optimizedSize || 0],
      ['compressedSize', data.compressedSize || 0],
      ['executionTime', data.executionTime || 0],
      ['filesProcessed', data.filesProcessed || 0],
    ];

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
