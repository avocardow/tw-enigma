/**
 * Dry Run Report Generator
 * Creates comprehensive preview reports from dry run results
 */

import { Logger } from '../utils/logger';
import type { DryRunResult, DryRunOperation, DryRunContext } from './dryRunManager';

export interface ReportSection {
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Section metadata */
  metadata?: Record<string, any>;
  /** Subsections */
  subsections?: ReportSection[];
}

export interface ReportMetadata {
  /** Report generation timestamp */
  timestamp: number;
  /** Report generator version */
  version: string;
  /** Session information */
  session: {
    id: string;
    duration: number;
    startTime: number;
    endTime: number;
  };
  /** Project context */
  project: {
    root: string;
    framework?: string;
    optimizationLevel: string;
  };
  /** Report configuration */
  config: ReportConfig;
}

export interface PreviewReport {
  /** Report metadata */
  metadata: ReportMetadata;
  /** Executive summary */
  summary: ReportSection;
  /** Detailed operation sections */
  sections: ReportSection[];
  /** Warnings and errors */
  issues: {
    warnings: string[];
    errors: string[];
  };
  /** Raw data for programmatic access */
  data: {
    operations: DryRunOperation[];
    operationsByType: Record<string, DryRunOperation[]>;
    context: DryRunContext;
    result: DryRunResult;
  };
}

export interface ReportConfig {
  /** Output format */
  format: 'json' | 'html' | 'markdown' | 'text';
  /** Include detailed operation listings */
  includeOperationDetails: boolean;
  /** Include raw data section */
  includeRawData: boolean;
  /** Maximum operations to list per section */
  maxOperationsPerSection: number;
  /** Include file size impact analysis */
  includeSizeAnalysis: boolean;
  /** Include performance estimates */
  includePerformanceEstimates: boolean;
  /** Include safety validation */
  includeSafetyValidation: boolean;
  /** Custom report sections */
  customSections: string[];
  /** Styling options for HTML output */
  styling: {
    theme: 'light' | 'dark' | 'auto';
    compact: boolean;
    showIcons: boolean;
  };
}

export class ReportGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly section?: string
  ) {
    super(message);
    this.name = 'ReportGenerationError';
  }
}

export class DryRunReportGenerator {
  private logger: Logger;
  private defaultConfig: ReportConfig;

  constructor(config: Partial<ReportConfig> = {}) {
    this.defaultConfig = {
      format: 'html',
      includeOperationDetails: true,
      includeRawData: false,
      maxOperationsPerSection: 50,
      includeSizeAnalysis: true,
      includePerformanceEstimates: true,
      includeSafetyValidation: true,
      customSections: [],
      styling: {
        theme: 'auto',
        compact: false,
        showIcons: true,
      },
      ...config,
    };

    this.logger = new Logger({ component: 'DryRunReportGenerator' });
  }

  /**
   * Generate a comprehensive preview report from dry run results
   */
  generateReport(
    result: DryRunResult,
    config: Partial<ReportConfig> = {}
  ): PreviewReport {
    const reportConfig = { ...this.defaultConfig, ...config };
    
    try {
      this.logger.debug('Generating dry run report', {
        format: reportConfig.format,
        operationCount: result.totalOperations,
      });

      const metadata = this.generateMetadata(result, reportConfig);
      const summary = this.generateSummarySection(result);
      const sections = this.generateReportSections(result, reportConfig);
      const issues = this.extractIssues(result);

      const report: PreviewReport = {
        metadata,
        summary,
        sections,
        issues,
        data: reportConfig.includeRawData ? {
          operations: result.context.operations,
          operationsByType: result.operationsByType,
          context: result.context,
          result,
        } : {
          operations: [],
          operationsByType: {},
          context: {} as DryRunContext,
          result: {} as DryRunResult,
        },
      };

      this.logger.info('Successfully generated dry run report', {
        sections: sections.length,
        warnings: issues.warnings.length,
        errors: issues.errors.length,
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate dry run report', { error });
      throw new ReportGenerationError(
        'Report generation failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Export report to specified format
   */
  exportReport(report: PreviewReport, format?: ReportConfig['format']): string {
    const exportFormat = format || report.metadata.config.format;

    try {
      switch (exportFormat) {
        case 'json':
          return this.exportToJSON(report);
        case 'html':
          return this.exportToHTML(report);
        case 'markdown':
          return this.exportToMarkdown(report);
        case 'text':
          return this.exportToText(report);
        default:
          throw new Error(`Unsupported export format: ${exportFormat}`);
      }
    } catch (error) {
      throw new ReportGenerationError(
        `Failed to export report to ${exportFormat}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Generate report metadata
   */
  private generateMetadata(result: DryRunResult, config: ReportConfig): ReportMetadata {
    const endTime = result.context.startTime + result.duration;

    return {
      timestamp: Date.now(),
      version: '1.0.0',
      session: {
        id: result.context.sessionId,
        duration: result.duration,
        startTime: result.context.startTime,
        endTime,
      },
      project: {
        root: result.context.metadata.projectRoot,
        framework: result.context.metadata.targetFramework,
        optimizationLevel: result.context.metadata.optimizationLevel,
      },
      config,
    };
  }

  /**
   * Generate executive summary section
   */
  private generateSummarySection(result: DryRunResult): ReportSection {
    const { summary, totalOperations } = result;

    const content = [
      `Total Operations: ${totalOperations}`,
      '',
      'File Operations:',
      `  • ${summary.filesWouldBeCreated} files would be created`,
      `  • ${summary.filesWouldBeModified} files would be modified`,
      `  • ${summary.filesWouldBeDeleted} files would be deleted`,
      '',
      'Directory Operations:',
      `  • ${summary.directoriesWouldBeCreated} directories would be created`,
      `  • ${summary.directoriesWouldBeDeleted} directories would be deleted`,
      '',
      'Impact Analysis:',
      `  • Size Impact: ${this.formatBytes(summary.totalSizeImpact)}`,
      `  • Estimated Duration: ${Math.round(summary.estimatedDuration)}ms`,
      `  • Potential Issues: ${summary.potentialErrors} operations may fail`,
    ].join('\n');

    return {
      title: 'Executive Summary',
      content,
      metadata: {
        operationCount: totalOperations,
        sizeImpact: summary.totalSizeImpact,
        duration: summary.estimatedDuration,
        issues: summary.potentialErrors,
      },
    };
  }

  /**
   * Generate all report sections
   */
  private generateReportSections(result: DryRunResult, config: ReportConfig): ReportSection[] {
    const sections: ReportSection[] = [];

    // File operations section
    sections.push(this.generateFileOperationsSection(result, config));

    // Directory operations section
    sections.push(this.generateDirectoryOperationsSection(result, config));

    // Configuration operations section
    if (result.operationsByType['config-update']?.length > 0) {
      sections.push(this.generateConfigOperationsSection(result, config));
    }

    // Cache operations section
    if (result.operationsByType['cache-clear']?.length > 0) {
      sections.push(this.generateCacheOperationsSection(result, config));
    }

    // Performance analysis section
    if (config.includePerformanceEstimates) {
      sections.push(this.generatePerformanceSection(result));
    }

    // Safety validation section
    if (config.includeSafetyValidation) {
      sections.push(this.generateSafetySection(result));
    }

    // Size analysis section
    if (config.includeSizeAnalysis) {
      sections.push(this.generateSizeAnalysisSection(result));
    }

    return sections;
  }

  /**
   * Generate file operations section
   */
  private generateFileOperationsSection(result: DryRunResult, config: ReportConfig): ReportSection {
    const fileOps = [
      ...(result.operationsByType['file-write'] || []),
      ...(result.operationsByType['file-modify'] || []),
      ...(result.operationsByType['file-delete'] || []),
    ];

    const subsections: ReportSection[] = [];

    // File creation subsection
    const createOps = result.operationsByType['file-write'] || [];
    if (createOps.length > 0) {
      subsections.push({
        title: `Files to Create (${createOps.length})`,
        content: this.formatOperationList(createOps, config.maxOperationsPerSection),
      });
    }

    // File modification subsection
    const modifyOps = result.operationsByType['file-modify'] || [];
    if (modifyOps.length > 0) {
      subsections.push({
        title: `Files to Modify (${modifyOps.length})`,
        content: this.formatOperationList(modifyOps, config.maxOperationsPerSection),
      });
    }

    // File deletion subsection
    const deleteOps = result.operationsByType['file-delete'] || [];
    if (deleteOps.length > 0) {
      subsections.push({
        title: `Files to Delete (${deleteOps.length})`,
        content: this.formatOperationList(deleteOps, config.maxOperationsPerSection),
      });
    }

    return {
      title: 'File Operations',
      content: `Total file operations: ${fileOps.length}`,
      subsections,
      metadata: {
        totalOperations: fileOps.length,
        creates: createOps.length,
        modifies: modifyOps.length,
        deletes: deleteOps.length,
      },
    };
  }

  /**
   * Generate directory operations section
   */
  private generateDirectoryOperationsSection(result: DryRunResult, config: ReportConfig): ReportSection {
    const dirOps = [
      ...(result.operationsByType['directory-create'] || []),
      ...(result.operationsByType['directory-delete'] || []),
    ];

    const subsections: ReportSection[] = [];

    // Directory creation subsection
    const createOps = result.operationsByType['directory-create'] || [];
    if (createOps.length > 0) {
      subsections.push({
        title: `Directories to Create (${createOps.length})`,
        content: this.formatOperationList(createOps, config.maxOperationsPerSection),
      });
    }

    // Directory deletion subsection
    const deleteOps = result.operationsByType['directory-delete'] || [];
    if (deleteOps.length > 0) {
      subsections.push({
        title: `Directories to Delete (${deleteOps.length})`,
        content: this.formatOperationList(deleteOps, config.maxOperationsPerSection),
      });
    }

    return {
      title: 'Directory Operations',
      content: dirOps.length > 0 ? `Total directory operations: ${dirOps.length}` : 'No directory operations',
      subsections,
      metadata: {
        totalOperations: dirOps.length,
        creates: createOps.length,
        deletes: deleteOps.length,
      },
    };
  }

  /**
   * Generate configuration operations section
   */
  private generateConfigOperationsSection(result: DryRunResult, config: ReportConfig): ReportSection {
    const configOps = result.operationsByType['config-update'] || [];

    return {
      title: 'Configuration Changes',
      content: this.formatOperationList(configOps, config.maxOperationsPerSection),
      metadata: {
        totalOperations: configOps.length,
      },
    };
  }

  /**
   * Generate cache operations section
   */
  private generateCacheOperationsSection(result: DryRunResult, config: ReportConfig): ReportSection {
    const cacheOps = result.operationsByType['cache-clear'] || [];

    return {
      title: 'Cache Operations',
      content: this.formatOperationList(cacheOps, config.maxOperationsPerSection),
      metadata: {
        totalOperations: cacheOps.length,
      },
    };
  }

  /**
   * Generate performance analysis section
   */
  private generatePerformanceSection(result: DryRunResult): ReportSection {
    const { summary } = result;

    const content = [
      `Estimated Duration: ${Math.round(summary.estimatedDuration)}ms`,
      `Session Duration: ${Math.round(result.duration)}ms`,
      '',
      'Performance Breakdown:',
      `  • File Operations: ${Math.round(summary.estimatedDuration * 0.7)}ms`,
      `  • Directory Operations: ${Math.round(summary.estimatedDuration * 0.2)}ms`,
      `  • Other Operations: ${Math.round(summary.estimatedDuration * 0.1)}ms`,
      '',
      'Efficiency Metrics:',
      `  • Operations per Second: ${Math.round(result.totalOperations / (summary.estimatedDuration / 1000))}`,
      `  • Average Operation Time: ${Math.round(summary.estimatedDuration / result.totalOperations)}ms`,
    ].join('\n');

    return {
      title: 'Performance Analysis',
      content,
      metadata: {
        estimatedDuration: summary.estimatedDuration,
        actualDuration: result.duration,
        efficiency: result.totalOperations / (summary.estimatedDuration / 1000),
      },
    };
  }

  /**
   * Generate safety validation section
   */
  private generateSafetySection(result: DryRunResult): ReportSection {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for potential issues
    const failedOps = result.context.operations.filter(op => !op.wouldSucceed);
    if (failedOps.length > 0) {
      errors.push(`${failedOps.length} operations may fail`);
    }

    // Check for large deletions
    const deleteOps = result.operationsByType['file-delete'] || [];
    if (deleteOps.length > 50) {
      warnings.push(`Large number of file deletions: ${deleteOps.length}`);
    }

    // Check for size impact
    const sizeMB = Math.abs(result.summary.totalSizeImpact) / (1024 * 1024);
    if (sizeMB > 50) {
      warnings.push(`Significant size impact: ${this.formatBytes(result.summary.totalSizeImpact)}`);
    }

    const content = [
      'Safety Assessment:',
      `  • Potential Errors: ${errors.length}`,
      `  • Warnings: ${warnings.length}`,
      '',
      ...(errors.length > 0 ? ['Errors:', ...errors.map(e => `  ⚠️ ${e}`), ''] : []),
      ...(warnings.length > 0 ? ['Warnings:', ...warnings.map(w => `  ⚠️ ${w}`), ''] : []),
      ...(errors.length === 0 && warnings.length === 0 ? ['✅ No safety issues detected'] : []),
    ].join('\n');

    return {
      title: 'Safety Validation',
      content,
      metadata: {
        errors: errors.length,
        warnings: warnings.length,
        safe: errors.length === 0,
      },
    };
  }

  /**
   * Generate size analysis section
   */
  private generateSizeAnalysisSection(result: DryRunResult): ReportSection {
    const { summary } = result;
    const operations = result.context.operations;

    // Calculate size breakdown
    const sizeByType = operations.reduce((acc, op) => {
      if (op.sizeImpact) {
        acc[op.type] = (acc[op.type] || 0) + op.sizeImpact;
      }
      return acc;
    }, {} as Record<string, number>);

    const content = [
      `Total Size Impact: ${this.formatBytes(summary.totalSizeImpact)}`,
      '',
      'Size Impact by Operation Type:',
      ...Object.entries(sizeByType).map(([type, size]) => 
        `  • ${type}: ${this.formatBytes(size)}`
      ),
      '',
      'Analysis:',
      summary.totalSizeImpact > 0 
        ? '  • Disk usage will increase'
        : summary.totalSizeImpact < 0
        ? '  • Disk usage will decrease'
        : '  • No significant size change',
    ].join('\n');

    return {
      title: 'Size Impact Analysis',
      content,
      metadata: {
        totalSizeImpact: summary.totalSizeImpact,
        sizeByType,
      },
    };
  }

  /**
   * Extract warnings and errors from result
   */
  private extractIssues(result: DryRunResult): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check operations for issues
    result.context.operations.forEach(op => {
      if (op.potentialError) {
        errors.push(`${op.description}: ${op.potentialError}`);
      }
    });

    // Add summary-based warnings
    if (result.summary.potentialErrors > 0) {
      warnings.push(`${result.summary.potentialErrors} operations may encounter issues`);
    }

    return { warnings, errors };
  }

  /**
   * Format operation list for display
   */
  private formatOperationList(operations: DryRunOperation[], maxItems: number): string {
    const displayOps = operations.slice(0, maxItems);
    const remaining = operations.length - displayOps.length;

    const lines = displayOps.map(op => {
      const status = op.wouldSucceed ? '✅' : '❌';
      const size = op.sizeImpact ? ` (${this.formatBytes(op.sizeImpact)})` : '';
      return `${status} ${op.target}${size}`;
    });

    if (remaining > 0) {
      lines.push(`... and ${remaining} more operations`);
    }

    return lines.join('\n');
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    
    const value = bytes / Math.pow(k, i);
    const sign = bytes < 0 ? '-' : '+';
    
    return `${sign}${parseFloat(value.toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Export to JSON format
   */
  private exportToJSON(report: PreviewReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export to HTML format
   */
  private exportToHTML(report: PreviewReport): string {
    const { styling } = report.metadata.config;
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dry Run Preview Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            ${styling.theme === 'dark' ? 'background: #1a1a1a; color: #e0e0e0;' : 'background: #fff; color: #333;'}
        }
        .header {
            border-bottom: 2px solid #007acc;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        .summary {
            background: ${styling.theme === 'dark' ? '#2a2a2a' : '#f8f9fa'};
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #007acc;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        .subsection {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .operation-list {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            white-space: pre-line;
            background: ${styling.theme === 'dark' ? '#2a2a2a' : '#f8f9fa'};
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .metadata {
            color: #666;
            font-size: 14px;
            margin-top: 10px;
        }
        .warning {
            color: #ff6b35;
        }
        .error {
            color: #dc3545;
        }
        .success {
            color: #28a745;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${styling.showIcons ? '📊 ' : ''}Dry Run Preview Report</h1>
        <div class="metadata">
            Generated: ${new Date(report.metadata.timestamp).toLocaleString()}<br>
            Session: ${report.metadata.session.id}<br>
            Project: ${report.metadata.project.root}
        </div>
    </div>

    <div class="summary">
        <h2>${styling.showIcons ? '📋 ' : ''}${report.summary.title}</h2>
        <div class="operation-list">${report.summary.content}</div>
    </div>

    ${report.sections.map(section => `
        <div class="section">
            <h2>${this.getSectionIcon(section.title, styling.showIcons)}${section.title}</h2>
            <div class="operation-list">${section.content}</div>
            ${section.subsections ? section.subsections.map(sub => `
                <div class="subsection">
                    <h3>${sub.title}</h3>
                    <div class="operation-list">${sub.content}</div>
                </div>
            `).join('') : ''}
        </div>
    `).join('')}

    ${report.issues.warnings.length > 0 || report.issues.errors.length > 0 ? `
        <div class="section">
            <h2>${styling.showIcons ? '⚠️ ' : ''}Issues</h2>
            ${report.issues.errors.length > 0 ? `
                <h3 class="error">Errors (${report.issues.errors.length})</h3>
                <div class="operation-list error">${report.issues.errors.join('\n')}</div>
            ` : ''}
            ${report.issues.warnings.length > 0 ? `
                <h3 class="warning">Warnings (${report.issues.warnings.length})</h3>
                <div class="operation-list warning">${report.issues.warnings.join('\n')}</div>
            ` : ''}
        </div>
    ` : ''}
</body>
</html>`;

    return html;
  }

  /**
   * Export to Markdown format
   */
  private exportToMarkdown(report: PreviewReport): string {
    const lines = [
      '# Dry Run Preview Report',
      '',
      `**Generated:** ${new Date(report.metadata.timestamp).toLocaleString()}`,
      `**Session:** ${report.metadata.session.id}`,
      `**Project:** ${report.metadata.project.root}`,
      '',
      `## ${report.summary.title}`,
      '',
      '```',
      report.summary.content,
      '```',
      '',
    ];

    // Add sections
    report.sections.forEach(section => {
      lines.push(`## ${section.title}`, '');
      lines.push('```');
      lines.push(section.content);
      lines.push('```', '');

      // Add subsections
      if (section.subsections) {
        section.subsections.forEach(sub => {
          lines.push(`### ${sub.title}`, '');
          lines.push('```');
          lines.push(sub.content);
          lines.push('```', '');
        });
      }
    });

    // Add issues
    if (report.issues.warnings.length > 0 || report.issues.errors.length > 0) {
      lines.push('## Issues', '');
      
      if (report.issues.errors.length > 0) {
        lines.push(`### Errors (${report.issues.errors.length})`, '');
        report.issues.errors.forEach(error => lines.push(`- ❌ ${error}`));
        lines.push('');
      }
      
      if (report.issues.warnings.length > 0) {
        lines.push(`### Warnings (${report.issues.warnings.length})`, '');
        report.issues.warnings.forEach(warning => lines.push(`- ⚠️ ${warning}`));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Export to plain text format
   */
  private exportToText(report: PreviewReport): string {
    const lines = [
      '='.repeat(60),
      'DRY RUN PREVIEW REPORT',
      '='.repeat(60),
      '',
      `Generated: ${new Date(report.metadata.timestamp).toLocaleString()}`,
      `Session: ${report.metadata.session.id}`,
      `Project: ${report.metadata.project.root}`,
      '',
      report.summary.title.toUpperCase(),
      '-'.repeat(report.summary.title.length),
      report.summary.content,
      '',
    ];

    // Add sections
    report.sections.forEach(section => {
      lines.push(section.title.toUpperCase());
      lines.push('-'.repeat(section.title.length));
      lines.push(section.content);
      lines.push('');

      // Add subsections
      if (section.subsections) {
        section.subsections.forEach(sub => {
          lines.push(`  ${sub.title}`);
          lines.push(`  ${'-'.repeat(sub.title.length)}`);
          lines.push(sub.content.split('\n').map(line => `  ${line}`).join('\n'));
          lines.push('');
        });
      }
    });

    // Add issues
    if (report.issues.warnings.length > 0 || report.issues.errors.length > 0) {
      lines.push('ISSUES');
      lines.push('-'.repeat(6));
      
      if (report.issues.errors.length > 0) {
        lines.push(`ERRORS (${report.issues.errors.length}):`);
        report.issues.errors.forEach(error => lines.push(`  * ${error}`));
        lines.push('');
      }
      
      if (report.issues.warnings.length > 0) {
        lines.push(`WARNINGS (${report.issues.warnings.length}):`);
        report.issues.warnings.forEach(warning => lines.push(`  * ${warning}`));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Get icon for section based on title
   */
  private getSectionIcon(title: string, showIcons: boolean): string {
    if (!showIcons) return '';

    const iconMap: Record<string, string> = {
      'File Operations': '📁 ',
      'Directory Operations': '📂 ',
      'Configuration Changes': '⚙️ ',
      'Cache Operations': '🗄️ ',
      'Performance Analysis': '⚡ ',
      'Safety Validation': '🛡️ ',
      'Size Impact Analysis': '📏 ',
    };

    return iconMap[title] || '📄 ';
  }

  /**
   * Update report configuration
   */
  updateConfig(config: Partial<ReportConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    this.logger.debug('Updated report generator configuration', config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ReportConfig {
    return { ...this.defaultConfig };
  }
}

/**
 * Global report generator instance
 */
let globalReportGenerator: DryRunReportGenerator | null = null;

/**
 * Get the global report generator
 */
export function getDryRunReportGenerator(): DryRunReportGenerator {
  if (!globalReportGenerator) {
    globalReportGenerator = new DryRunReportGenerator();
  }
  return globalReportGenerator;
}

/**
 * Create a new report generator
 */
export function createDryRunReportGenerator(config?: Partial<ReportConfig>): DryRunReportGenerator {
  return new DryRunReportGenerator(config);
}

/**
 * Generate and export a report in one step
 */
export function generatePreviewReport(
  result: DryRunResult,
  config: Partial<ReportConfig> = {}
): string {
  const generator = getDryRunReportGenerator();
  const report = generator.generateReport(result, config);
  return generator.exportReport(report);
}

export default DryRunReportGenerator;