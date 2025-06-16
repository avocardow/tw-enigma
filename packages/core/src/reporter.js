/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Table from "cli-table3";
import chalk from "chalk";

// =============================================================================
// CONFIGURATION & DOCUMENTATION
// =============================================================================

/**
 * Configuration options for the reporter
 * @typedef {Object} ReporterConfig
 * @property {"console" | "json" | "markdown" | "html" | "all"} format - Output format for reports
 * @property {"minimal" | "summary" | "detailed" | "verbose"} verbosity - Verbosity level for output
 * @property {boolean} colors - Enable colored output
 * @property {boolean} showPerformance - Show performance metrics
 * @property {boolean} showPatterns - Show pattern statistics
 * @property {boolean} showSizeAnalysis - Show size analysis
 * @property {number} maxTableItems - Maximum number of items to show in tables
 * @property {boolean} includeRecommendations - Include recommendations in output
 * @property {Object} tableStyle - Table styling options
 * @property {string[]} tableStyle.head - Head styling
 * @property {string[]} tableStyle.border - Border styling
 * @property {boolean} tableStyle.compact - Compact mode
 */

/**
 * Size metrics for optimization analysis
 * @typedef {Object} SizeMetrics
 * @property {number} originalSize - Original size in bytes
 * @property {number} optimizedSize - Optimized size in bytes
 * @property {number} compressedSize - Compressed size in bytes
 * @property {number} sizeReduction - Size reduction in bytes
 * @property {number} compressionRatio - Compression ratio (0-1)
 * @property {number} percentageReduction - Percentage reduction
 */

/**
 * Pattern optimization statistics
 * @typedef {Object} PatternStats
 * @property {string} patternId - Pattern identifier
 * @property {string} patternName - Pattern name or description
 * @property {number} frequency - Number of occurrences
 * @property {number} sizeSavings - Size savings from this pattern
 * @property {number} efficiency - Optimization efficiency (0-1)
 * @property {"atomic" | "utility" | "component" | "layout"} type - Pattern type
 * @property {number} coOccurrenceStrength - Co-occurrence strength with other patterns
 */

/**
 * Performance metrics for optimization process
 * @typedef {Object} PerformanceMetrics
 * @property {number} executionTime - Total execution time in milliseconds
 * @property {number} memoryUsage - Memory usage in bytes
 * @property {number} throughput - Processing speed (bytes per second)
 * @property {number} filesProcessed - Number of files processed
 * @property {number} avgProcessingTime - Average processing time per file
 * @property {number} peakMemoryUsage - Peak memory usage
 */

/**
 * Comprehensive optimization report data
 * @typedef {Object} OptimizationReport
 * @property {Object} metadata - Report metadata
 * @property {string} metadata.timestamp - Report timestamp
 * @property {string} metadata.version - Report version
 * @property {string} metadata.environment - Environment
 * @property {SizeMetrics} sizeMetrics - Size analysis
 * @property {PatternStats[]} patternStats - Pattern statistics
 * @property {PerformanceMetrics} performanceMetrics - Performance metrics
 * @property {string[]} recommendations - Optimization recommendations
 * @property {string[]} warnings - Warnings and issues
 */

// =============================================================================
// REPORTER CLASS
// =============================================================================

/**
 * Main reporter class for generating optimization statistics and reports
 */
export class Reporter {
  constructor(config = {}) {
    this.config = this.mergeConfig(config);
    this.reports = [];
    this.startTime = Date.now();
  }

  /**
   * Merge user config with defaults
   */
  mergeConfig(userConfig) {
    const defaultConfig = {
      format: "console",
      verbosity: "summary",
      colors: true,
      showPerformance: true,
      showPatterns: true,
      showSizeAnalysis: true,
      maxTableItems: 10,
      includeRecommendations: true,
      tableStyle: {
        head: ["cyan", "bold"],
        border: ["grey"],
        compact: false,
      },
    };

    return { ...defaultConfig, ...userConfig };
  }

  /**
   * Generate a comprehensive optimization report
   */
  generateReport(data) {
    try {
      const report = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          environment: process.env.NODE_ENV || "development",
        },
        sizeMetrics: this.calculateSizeMetrics(data),
        patternStats: this.generatePatternStats(data),
        performanceMetrics: this.calculatePerformanceMetrics(data),
        recommendations: this.generateRecommendations(data),
        warnings: this.generateWarnings(data),
      };

      this.reports.push(report);
      return report;
    } catch (error) {
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }

  /**
   * Display report in the configured format
   */
  displayReport(report) {
    switch (this.config.format) {
      case "console":
        return this.displayConsoleReport(report);
      case "json":
        return this.displayJsonReport(report);
      case "markdown":
        return this.displayMarkdownReport(report);
      case "html":
        return this.displayHtmlReport(report);
      case "all":
        return {
          console: this.displayConsoleReport(report),
          json: this.displayJsonReport(report),
          markdown: this.displayMarkdownReport(report),
          html: this.displayHtmlReport(report),
        };
      default:
        throw new Error(`Unsupported format: ${this.config.format}`);
    }
  }

  /**
   * Display console report with tables and colors
   */
  displayConsoleReport(report) {
    const output = [];
    const { colors } = this.config;

    // Header
    output.push("");
    output.push(
      colors
        ? chalk.cyan.bold("📊 OPTIMIZATION REPORT")
        : "📊 OPTIMIZATION REPORT",
    );
    output.push(
      colors
        ? chalk.gray(`Generated: ${new Date(report.metadata.timestamp).toLocaleString()}`)
        : `Generated: ${new Date(report.metadata.timestamp).toLocaleString()}`,
    );
    output.push("");

    // Size Analysis
    if (this.config.showSizeAnalysis) {
      output.push(this.generateSummaryTable(report.sizeMetrics));
      output.push("");
    }

    // Pattern Statistics
    if (this.config.showPatterns && report.patternStats.length > 0) {
      output.push(this.generatePatternTable(report.patternStats));
      output.push("");
    }

    // Performance Metrics
    if (this.config.showPerformance) {
      output.push(this.generatePerformanceTable(report.performanceMetrics));
      output.push("");
    }

    // Recommendations
    if (this.config.includeRecommendations && report.recommendations.length > 0) {
      output.push(colors ? chalk.green.bold("💡 RECOMMENDATIONS") : "💡 RECOMMENDATIONS");
      report.recommendations.forEach((rec, i) => {
        output.push(colors ? chalk.green(`${i + 1}. ${rec}`) : `${i + 1}. ${rec}`);
      });
      output.push("");
    }

    // Warnings
    if (report.warnings.length > 0) {
      output.push(colors ? chalk.yellow.bold("⚠️  WARNINGS") : "⚠️  WARNINGS");
      report.warnings.forEach((warning, i) => {
        output.push(colors ? chalk.yellow(`${i + 1}. ${warning}`) : `${i + 1}. ${warning}`);
      });
      output.push("");
    }

    return output.join("\n");
  }

  /**
   * Display JSON report
   */
  displayJsonReport(report) {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Display Markdown report
   */
  displayMarkdownReport(report) {
    const lines = [];

    lines.push("# Optimization Report");
    lines.push("");
    lines.push(`**Generated:** ${new Date(report.metadata.timestamp).toLocaleString()}`);
    lines.push(`**Environment:** ${report.metadata.environment}`);
    lines.push("");

    // Size Metrics
    lines.push("## Size Analysis");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Original Size | ${this.formatBytes(report.sizeMetrics.originalSize)} |`);
    lines.push(`| Optimized Size | ${this.formatBytes(report.sizeMetrics.optimizedSize)} |`);
    lines.push(`| Size Reduction | ${this.formatBytes(report.sizeMetrics.sizeReduction)} |`);
    lines.push(`| Percentage Reduction | ${report.sizeMetrics.percentageReduction.toFixed(1)}% |`);
    lines.push(`| Compression Ratio | ${(report.sizeMetrics.compressionRatio * 100).toFixed(1)}% |`);
    lines.push("");

    // Pattern Stats
    if (report.patternStats.length > 0) {
      lines.push("## Pattern Statistics");
      lines.push("");
      lines.push("| Pattern | Type | Frequency | Savings | Efficiency |");
      lines.push("|---------|------|-----------|---------|------------|");
      report.patternStats.slice(0, this.config.maxTableItems).forEach((pattern) => {
        lines.push(
          `| ${pattern.patternName} | ${pattern.type} | ${pattern.frequency} | ${this.formatBytes(pattern.sizeSavings)} | ${(pattern.efficiency * 100).toFixed(1)}% |`,
        );
      });
      lines.push("");
    }

    // Performance
    lines.push("## Performance Metrics");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Execution Time | ${report.performanceMetrics.executionTime}ms |`);
    lines.push(`| Memory Usage | ${this.formatBytes(report.performanceMetrics.memoryUsage)} |`);
    lines.push(`| Throughput | ${this.formatBytes(report.performanceMetrics.throughput)}/s |`);
    lines.push(`| Files Processed | ${report.performanceMetrics.filesProcessed} |`);
    lines.push("");

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push("## Recommendations");
      lines.push("");
      report.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Display HTML report
   */
  displayHtmlReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Optimization Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background-color: #f8f9fa; font-weight: 600; }
        .recommendations { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 16px; margin: 20px 0; }
        .warnings { background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Optimization Report</h1>
        <p>Generated: ${new Date(report.metadata.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="metric">
        <h2>Size Analysis</h2>
        <table class="table">
            <tr><td><strong>Original Size</strong></td><td>${this.formatBytes(report.sizeMetrics.originalSize)}</td></tr>
            <tr><td><strong>Optimized Size</strong></td><td>${this.formatBytes(report.sizeMetrics.optimizedSize)}</td></tr>
            <tr><td><strong>Size Reduction</strong></td><td>${this.formatBytes(report.sizeMetrics.sizeReduction)}</td></tr>
            <tr><td><strong>Percentage Reduction</strong></td><td>${report.sizeMetrics.percentageReduction.toFixed(1)}%</td></tr>
        </table>
    </div>

    ${report.recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>💡 Recommendations</h3>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${report.warnings.length > 0 ? `
    <div class="warnings">
        <h3>⚠️ Warnings</h3>
        <ul>
            ${report.warnings.map(warning => `<li>${warning}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>
    `.trim();
  }

  /**
   * Get all generated reports
   */
  getReports() {
    return [...this.reports];
  }

  /**
   * Clear all stored reports
   */
  clearReports() {
    this.reports = [];
  }

  /**
   * Get reporter statistics
   */
  getStats() {
    return {
      reportsGenerated: this.reports.length,
      uptime: Date.now() - this.startTime,
      config: { ...this.config },
    };
  }
}

// =============================================================================
// CALCULATION FUNCTIONS (Phase 1.2)
// =============================================================================

/**
 * Calculate size reduction metrics
 */
Reporter.prototype.calculateSizeReductions = function(beforeSize, afterSize, compressedSize = null) {
  const sizeReduction = beforeSize - afterSize;
  const percentageReduction = beforeSize > 0 ? (sizeReduction / beforeSize) * 100 : 0;
  const compressionRatio = beforeSize > 0 ? afterSize / beforeSize : 1;

  return {
    originalSize: beforeSize,
    optimizedSize: afterSize,
    compressedSize: compressedSize || Math.round(afterSize * 0.3), // Estimate if not provided
    sizeReduction,
    percentageReduction,
    compressionRatio,
  };
};

/**
 * Calculate compression metrics
 */
Reporter.prototype.calculateCompressionMetrics = function(originalSize, compressedSize) {
  const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
  const compressionSavings = originalSize - compressedSize;
  const compressionPercentage = originalSize > 0 ? (compressionSavings / originalSize) * 100 : 0;

  return {
    compressionRatio,
    compressionSavings,
    compressionPercentage,
    estimatedGzipSize: Math.round(originalSize * 0.3),
    estimatedBrotliSize: Math.round(originalSize * 0.25),
  };
};

/**
 * Calculate optimization savings
 */
Reporter.prototype.calculateOptimizationSavings = function(data) {
  if (!data || !Array.isArray(data.files)) {
    return { totalSavings: 0, averageSavings: 0, maxSavings: 0, minSavings: 0 };
  }

  const savings = data.files.map(file => {
    const before = file.originalSize || 0;
    const after = file.optimizedSize || 0;
    return before - after;
  }).filter(saving => saving >= 0);

  const totalSavings = savings.reduce((sum, saving) => sum + saving, 0);
  const averageSavings = savings.length > 0 ? totalSavings / savings.length : 0;
  const maxSavings = savings.length > 0 ? Math.max(...savings) : 0;
  const minSavings = savings.length > 0 ? Math.min(...savings) : 0;

  return {
    totalSavings,
    averageSavings,
    maxSavings,
    minSavings,
    filesOptimized: savings.length,
  };
};

/**
 * Calculate size metrics from data
 */
Reporter.prototype.calculateSizeMetrics = function(data) {
  if (!data || typeof data !== 'object') {
    return this.calculateSizeReductions(0, 0, 0);
  }
  
  const originalSize = data.originalSize || data.totalOriginalSize || 0;
  const optimizedSize = data.optimizedSize || data.totalOptimizedSize || 0;
  const compressedSize = data.compressedSize || data.totalCompressedSize || Math.round(optimizedSize * 0.3);

  return this.calculateSizeReductions(originalSize, optimizedSize, compressedSize);
};

// =============================================================================
// PATTERN STATISTICS (Phase 1.3)
// =============================================================================

/**
 * Generate pattern statistics
 */
Reporter.prototype.generatePatternStats = function(data) {
  if (!data.patterns || !Array.isArray(data.patterns)) {
    return [];
  }

  return data.patterns.map(pattern => ({
    patternId: pattern.id || pattern.name || 'unknown',
    patternName: pattern.name || pattern.id || 'Unknown Pattern',
    frequency: pattern.frequency || pattern.count || 0,
    sizeSavings: pattern.sizeSavings || pattern.savings || 0,
    efficiency: this.calculatePatternEfficiency(pattern),
    type: pattern.type || 'utility',
    coOccurrenceStrength: pattern.coOccurrenceStrength || 0,
  })).sort((a, b) => b.sizeSavings - a.sizeSavings);
};

/**
 * Calculate pattern efficiency
 */
Reporter.prototype.calculatePatternEfficiency = function(pattern) {
  const frequency = pattern.frequency || pattern.count || 0;
  const sizeSavings = pattern.sizeSavings || pattern.savings || 0;
  
  if (frequency === 0) return 0;
  
  // Efficiency = (size savings per occurrence) / (average pattern size)
  const savingsPerOccurrence = sizeSavings / frequency;
  const averagePatternSize = pattern.size || 50; // Estimate if not provided
  
  return Math.min(1, savingsPerOccurrence / averagePatternSize);
};

/**
 * Generate pattern breakdown by type
 */
Reporter.prototype.generatePatternBreakdown = function(patterns) {
  const breakdown = {
    atomic: { count: 0, totalSavings: 0 },
    utility: { count: 0, totalSavings: 0 },
    component: { count: 0, totalSavings: 0 },
    layout: { count: 0, totalSavings: 0 },
  };

  patterns.forEach(pattern => {
    const type = pattern.type || 'utility';
    if (breakdown[type]) {
      breakdown[type].count++;
      breakdown[type].totalSavings += pattern.sizeSavings || 0;
    }
  });

  return breakdown;
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format bytes to human readable string
 */
Reporter.prototype.formatBytes = function(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Format percentage with proper precision
 */
Reporter.prototype.formatPercentage = function(value) {
  return `${(value * 100).toFixed(1)}%`;
};

/**
 * Format duration in milliseconds
 */
Reporter.prototype.formatDuration = function(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

// =============================================================================
// TABLE GENERATION (Phase 2.1)
// =============================================================================

/**
 * Generate summary table for size metrics
 */
Reporter.prototype.generateSummaryTable = function(sizeMetrics) {
  const table = new Table({
    head: this.config.colors 
      ? [chalk.cyan.bold('Metric'), chalk.cyan.bold('Value')]
      : ['Metric', 'Value'],
    style: {
      head: this.config.colors ? ['cyan', 'bold'] : [],
      border: this.config.colors ? ['grey'] : [],
      compact: this.config.tableStyle.compact,
    },
  });

  table.push(
    ['Original Size', this.formatBytes(sizeMetrics.originalSize)],
    ['Optimized Size', this.formatBytes(sizeMetrics.optimizedSize)],
    ['Compressed Size', this.formatBytes(sizeMetrics.compressedSize)],
    ['Size Reduction', this.formatBytes(sizeMetrics.sizeReduction)],
    ['Percentage Reduction', `${sizeMetrics.percentageReduction.toFixed(1)}%`],
    ['Compression Ratio', `${(sizeMetrics.compressionRatio * 100).toFixed(1)}%`],
  );

  return `${this.config.colors ? chalk.blue.bold('📊 SIZE ANALYSIS') : '📊 SIZE ANALYSIS'}\n${table.toString()}`;
};

/**
 * Generate detailed table for comprehensive statistics
 */
Reporter.prototype.generateDetailedTable = function(report) {
  const table = new Table({
    head: this.config.colors 
      ? [chalk.cyan.bold('Category'), chalk.cyan.bold('Metric'), chalk.cyan.bold('Value')]
      : ['Category', 'Metric', 'Value'],
    style: {
      head: this.config.colors ? ['cyan', 'bold'] : [],
      border: this.config.colors ? ['grey'] : [],
      compact: this.config.tableStyle.compact,
    },
  });

  // Size metrics
  table.push(
    ['Size', 'Original', this.formatBytes(report.sizeMetrics.originalSize)],
    ['Size', 'Optimized', this.formatBytes(report.sizeMetrics.optimizedSize)],
    ['Size', 'Reduction', this.formatBytes(report.sizeMetrics.sizeReduction)],
  );

  // Performance metrics
  table.push(
    ['Performance', 'Execution Time', this.formatDuration(report.performanceMetrics.executionTime)],
    ['Performance', 'Memory Usage', this.formatBytes(report.performanceMetrics.memoryUsage)],
    ['Performance', 'Throughput', `${this.formatBytes(report.performanceMetrics.throughput)}/s`],
  );

  // Pattern metrics
  if (report.patternStats.length > 0) {
    const totalPatterns = report.patternStats.length;
    const totalSavings = report.patternStats.reduce((sum, p) => sum + p.sizeSavings, 0);
    table.push(
      ['Patterns', 'Total Count', totalPatterns.toString()],
      ['Patterns', 'Total Savings', this.formatBytes(totalSavings)],
    );
  }

  return `${this.config.colors ? chalk.blue.bold('📋 DETAILED ANALYSIS') : '📋 DETAILED ANALYSIS'}\n${table.toString()}`;
};

/**
 * Generate pattern table for pattern-specific data
 */
Reporter.prototype.generatePatternTable = function(patternStats) {
  if (!patternStats || patternStats.length === 0) {
    return this.config.colors ? chalk.gray('No pattern data available') : 'No pattern data available';
  }

  const table = new Table({
    head: this.config.colors 
      ? [
          chalk.cyan.bold('Pattern'),
          chalk.cyan.bold('Type'),
          chalk.cyan.bold('Frequency'),
          chalk.cyan.bold('Savings'),
          chalk.cyan.bold('Efficiency'),
        ]
      : ['Pattern', 'Type', 'Frequency', 'Savings', 'Efficiency'],
    style: {
      head: this.config.colors ? ['cyan', 'bold'] : [],
      border: this.config.colors ? ['grey'] : [],
      compact: this.config.tableStyle.compact,
    },
  });

  const displayPatterns = patternStats.slice(0, this.config.maxTableItems);
  
  displayPatterns.forEach(pattern => {
    const efficiency = `${(pattern.efficiency * 100).toFixed(1)}%`;
    const efficiencyColored = this.config.colors 
      ? (pattern.efficiency > 0.7 ? chalk.green(efficiency) : 
         pattern.efficiency > 0.4 ? chalk.yellow(efficiency) : 
         chalk.red(efficiency))
      : efficiency;

    table.push([
      pattern.patternName.length > 30 ? pattern.patternName.substring(0, 27) + '...' : pattern.patternName,
      pattern.type,
      pattern.frequency.toString(),
      this.formatBytes(pattern.sizeSavings),
      efficiencyColored,
    ]);
  });

  const title = this.config.colors ? chalk.blue.bold('🎯 PATTERN STATISTICS') : '🎯 PATTERN STATISTICS';
  const subtitle = patternStats.length > this.config.maxTableItems 
    ? `\n${this.config.colors ? chalk.gray(`Showing top ${this.config.maxTableItems} of ${patternStats.length} patterns`) : `Showing top ${this.config.maxTableItems} of ${patternStats.length} patterns`}`
    : '';

  return `${title}\n${table.toString()}${subtitle}`;
};

/**
 * Generate performance table for execution time and memory usage
 */
Reporter.prototype.generatePerformanceTable = function(performanceMetrics) {
  const table = new Table({
    head: this.config.colors 
      ? [chalk.cyan.bold('Metric'), chalk.cyan.bold('Value'), chalk.cyan.bold('Status')]
      : ['Metric', 'Value', 'Status'],
    style: {
      head: this.config.colors ? ['cyan', 'bold'] : [],
      border: this.config.colors ? ['grey'] : [],
      compact: this.config.tableStyle.compact,
    },
  });

  // Execution time with status indicator
  const executionStatus = performanceMetrics.executionTime < 1000 ? 'Excellent' :
                         performanceMetrics.executionTime < 5000 ? 'Good' :
                         performanceMetrics.executionTime < 10000 ? 'Fair' : 'Slow';
  
  const executionStatusColored = this.config.colors 
    ? (executionStatus === 'Excellent' ? chalk.green(executionStatus) :
       executionStatus === 'Good' ? chalk.yellow(executionStatus) :
       executionStatus === 'Fair' ? chalk.hex('#FFA500')(executionStatus) :
       chalk.red(executionStatus))
    : executionStatus;

  // Memory usage with status indicator
  const memoryMB = performanceMetrics.memoryUsage / (1024 * 1024);
  const memoryStatus = memoryMB < 50 ? 'Low' :
                      memoryMB < 200 ? 'Moderate' :
                      memoryMB < 500 ? 'High' : 'Very High';
  
  const memoryStatusColored = this.config.colors 
    ? (memoryStatus === 'Low' ? chalk.green(memoryStatus) :
       memoryStatus === 'Moderate' ? chalk.yellow(memoryStatus) :
       memoryStatus === 'High' ? chalk.hex('#FFA500')(memoryStatus) :
       chalk.red(memoryStatus))
    : memoryStatus;

  table.push(
    ['Execution Time', this.formatDuration(performanceMetrics.executionTime), executionStatusColored],
    ['Memory Usage', this.formatBytes(performanceMetrics.memoryUsage), memoryStatusColored],
    ['Peak Memory', this.formatBytes(performanceMetrics.peakMemoryUsage), ''],
    ['Throughput', `${this.formatBytes(performanceMetrics.throughput)}/s`, ''],
    ['Files Processed', performanceMetrics.filesProcessed.toString(), ''],
    ['Avg Time/File', this.formatDuration(performanceMetrics.avgProcessingTime), ''],
  );

  return `${this.config.colors ? chalk.blue.bold('⚡ PERFORMANCE METRICS') : '⚡ PERFORMANCE METRICS'}\n${table.toString()}`;
};

/**
 * Generate benchmark table for performance comparisons
 */
Reporter.prototype.generateBenchmarkTable = function(benchmarks) {
  if (!benchmarks || benchmarks.length === 0) {
    return this.config.colors ? chalk.gray('No benchmark data available') : 'No benchmark data available';
  }

  const table = new Table({
    head: this.config.colors 
      ? [
          chalk.cyan.bold('Test'),
          chalk.cyan.bold('Duration'),
          chalk.cyan.bold('Memory'),
          chalk.cyan.bold('Throughput'),
          chalk.cyan.bold('Score'),
        ]
      : ['Test', 'Duration', 'Memory', 'Throughput', 'Score'],
    style: {
      head: this.config.colors ? ['cyan', 'bold'] : [],
      border: this.config.colors ? ['grey'] : [],
      compact: this.config.tableStyle.compact,
    },
  });

  benchmarks.forEach(benchmark => {
    const score = benchmark.score || 'N/A';
    const scoreColored = this.config.colors && typeof score === 'number'
      ? (score > 80 ? chalk.green(score) : 
         score > 60 ? chalk.yellow(score) : 
         chalk.red(score))
      : score;

    table.push([
      benchmark.name,
      this.formatDuration(benchmark.duration),
      this.formatBytes(benchmark.memoryUsage),
      `${this.formatBytes(benchmark.throughput)}/s`,
      scoreColored,
    ]);
  });

  return `${this.config.colors ? chalk.blue.bold('🏆 BENCHMARKS') : '🏆 BENCHMARKS'}\n${table.toString()}`;
};

/**
 * Generate throughput table for processing speed metrics
 */
Reporter.prototype.generateThroughputTable = function(throughputData) {
  if (!throughputData || throughputData.length === 0) {
    return this.config.colors ? chalk.gray('No throughput data available') : 'No throughput data available';
  }

  const table = new Table({
    head: this.config.colors 
      ? [
          chalk.cyan.bold('Operation'),
          chalk.cyan.bold('Items/sec'),
          chalk.cyan.bold('Bytes/sec'),
          chalk.cyan.bold('Efficiency'),
        ]
      : ['Operation', 'Items/sec', 'Bytes/sec', 'Efficiency'],
    style: {
      head: this.config.colors ? ['cyan', 'bold'] : [],
      border: this.config.colors ? ['grey'] : [],
      compact: this.config.tableStyle.compact,
    },
  });

  throughputData.forEach(data => {
    const efficiency = data.efficiency || 0;
    const efficiencyFormatted = `${(efficiency * 100).toFixed(1)}%`;
    const efficiencyColored = this.config.colors 
      ? (efficiency > 0.8 ? chalk.green(efficiencyFormatted) :
         efficiency > 0.6 ? chalk.yellow(efficiencyFormatted) :
         chalk.red(efficiencyFormatted))
      : efficiencyFormatted;

    table.push([
      data.operation,
      data.itemsPerSecond.toFixed(1),
      this.formatBytes(data.bytesPerSecond),
      efficiencyColored,
    ]);
  });

  return `${this.config.colors ? chalk.blue.bold('🚀 THROUGHPUT ANALYSIS') : '🚀 THROUGHPUT ANALYSIS'}\n${table.toString()}`;
};

// =============================================================================
// PERFORMANCE CALCULATIONS (Phase 2.2)
// =============================================================================

/**
 * Calculate performance metrics from data
 */
Reporter.prototype.calculatePerformanceMetrics = function(data) {
  if (!data || typeof data !== 'object') {
    return {
      executionTime: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      throughput: 0,
      filesProcessed: 0,
      avgProcessingTime: 0,
      peakMemoryUsage: process.memoryUsage().heapUsed,
    };
  }
  
  const executionTime = data.executionTime || data.duration || 0;
  const memoryUsage = data.memoryUsage || process.memoryUsage().heapUsed;
  const filesProcessed = data.filesProcessed || data.fileCount || 0;
  const totalBytes = data.totalBytes || data.totalSize || 0;

  const throughput = executionTime > 0 ? (totalBytes / executionTime) * 1000 : 0; // bytes per second
  const avgProcessingTime = filesProcessed > 0 ? executionTime / filesProcessed : 0;
  const peakMemoryUsage = data.peakMemoryUsage || memoryUsage;

  return {
    executionTime,
    memoryUsage,
    throughput,
    filesProcessed,
    avgProcessingTime,
    peakMemoryUsage,
  };
};

// =============================================================================
// RECOMMENDATIONS & WARNINGS (Phase 3.1)
// =============================================================================

/**
 * Generate optimization recommendations
 */
Reporter.prototype.generateRecommendations = function(data) {
  const recommendations = [];
  
  // Size-based recommendations
  const sizeMetrics = this.calculateSizeMetrics(data);
  if (sizeMetrics.percentageReduction < 10) {
    recommendations.push('Consider enabling more aggressive optimization settings for better size reduction');
  }
  if (sizeMetrics.originalSize > 500 * 1024) { // > 500KB
    recommendations.push('Large CSS files detected - consider code splitting or lazy loading');
  }
  
  // Performance-based recommendations
  const performanceMetrics = this.calculatePerformanceMetrics(data);
  if (performanceMetrics.executionTime > 10000) { // > 10 seconds
    recommendations.push('Optimization is taking longer than expected - consider processing files in batches');
  }
  if (performanceMetrics.memoryUsage > 500 * 1024 * 1024) { // > 500MB
    recommendations.push('High memory usage detected - consider streaming processing for large files');
  }
  
  // Pattern-based recommendations
  const patternStats = this.generatePatternStats(data);
  if (patternStats.length > 0) {
    const lowEfficiencyPatterns = patternStats.filter(p => p.efficiency < 0.3);
    if (lowEfficiencyPatterns.length > 0) {
      recommendations.push(`${lowEfficiencyPatterns.length} patterns have low efficiency - review pattern definitions`);
    }
    
    const highFrequencyPatterns = patternStats.filter(p => p.frequency > 100);
    if (highFrequencyPatterns.length > 0) {
      recommendations.push(`${highFrequencyPatterns.length} patterns are used very frequently - consider caching optimizations`);
    }
  }
  
  return recommendations;
};

/**
 * Generate warnings for potential issues
 */
Reporter.prototype.generateWarnings = function(data) {
  const warnings = [];
  
  // Size warnings
  const sizeMetrics = this.calculateSizeMetrics(data);
  if (sizeMetrics.sizeReduction < 0) {
    warnings.push('Optimization resulted in larger file size - check configuration');
  }
  if (sizeMetrics.compressionRatio > 1.1) {
    warnings.push('Compression ratio is unusually high - verify input data');
  }
  
  // Performance warnings
  const performanceMetrics = this.calculatePerformanceMetrics(data);
  if (performanceMetrics.executionTime > 20000) { // > 20 seconds (lowered threshold)
    warnings.push('Optimization is taking very long - consider timeout settings');
  }
  if (performanceMetrics.memoryUsage > 800 * 1024 * 1024) { // > 800MB (lowered threshold)
    warnings.push('Very high memory usage - risk of out-of-memory errors');
  }
  
  // Data validation warnings
  if (!data || typeof data !== 'object') {
    warnings.push('Invalid or missing optimization data');
  } else {
    // Check for invalid data types
    if (typeof data.originalSize === 'string' || typeof data.optimizedSize === 'string') {
      warnings.push('Invalid or missing optimization data');
    }
    if (data.patterns && !Array.isArray(data.patterns)) {
      warnings.push('Invalid or missing optimization data');
    }
    if (data.executionTime && data.executionTime < 0) {
      warnings.push('Invalid or missing optimization data');
    }
  }
  if (data && data.errors && data.errors.length > 0) {
    warnings.push(`${data.errors.length} errors occurred during optimization`);
  }
  
  return warnings;
};

// Export the Reporter class and utility functions
export default Reporter; 