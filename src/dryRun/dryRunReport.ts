/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FileOperation } from './mockFileSystem';
import { DryRunStatistics, DryRunPerformanceMetrics, formatStatisticsSummary, calculatePerformanceMetrics } from './dryRunStatistics';
import { DryRunOptions } from './dryRunSimulator';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Comprehensive dry run report
 */
export interface DryRunReport {
  /** Report metadata */
  metadata: {
    /** When the report was generated */
    timestamp: string;
    /** Version of the dry run system */
    version: string;
    /** Options used for the dry run */
    options: DryRunOptions;
    /** Duration of the dry run simulation */
    executionTime: number;
  };
  
  /** Summary of operations */
  summary: {
    /** High-level statistics */
    statistics: DryRunStatistics;
    /** Performance metrics */
    performance: DryRunPerformanceMetrics;
    /** Human-readable summary text */
    text: string;
  };
  
  /** Detailed operation breakdown */
  operations: {
    /** All operations performed */
    all: FileOperation[];
    /** Operations grouped by type */
    byType: Record<string, FileOperation[]>;
    /** Operations grouped by file path */
    byPath: Record<string, FileOperation[]>;
    /** Failed operations */
    failed: FileOperation[];
  };
  
  /** Change analysis */
  changes: {
    /** Files that would be created */
    created: string[];
    /** Files that would be modified */
    modified: Array<{ path: string; sizeBefore: number; sizeAfter: number }>;
    /** Files that would be deleted */
    deleted: string[];
    /** Directories that would be created */
    directories: string[];
  };
  
  /** Recommendations and insights */
  insights: {
    /** Potential issues or warnings */
    warnings: string[];
    /** Optimization recommendations */
    recommendations: string[];
    /** Performance insights */
    performance: string[];
  };
  
  /** File content previews (if enabled) */
  previews?: {
    [filePath: string]: {
      before?: string;
      after?: string;
      diff?: string;
    };
  };
}

/**
 * Report export formats
 */
export type ReportFormat = 'json' | 'markdown' | 'text' | 'html';

// =============================================================================
// REPORT GENERATION
// =============================================================================

/**
 * Create a comprehensive dry run report
 */
export function createDryRunReport(
  operations: FileOperation[],
  statistics: DryRunStatistics,
  options: DryRunOptions,
  executionTime: number = 0
): DryRunReport {
  const performance = calculatePerformanceMetrics(operations, executionTime);
  
  const report: DryRunReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0', // TODO: Get from package.json
      options,
      executionTime
    },
    
    summary: {
      statistics,
      performance,
      text: formatStatisticsSummary(statistics)
    },
    
    operations: {
      all: operations,
      byType: groupOperationsByType(operations),
      byPath: groupOperationsByPath(operations),
      failed: operations.filter(op => !op.success)
    },
    
    changes: analyzeChanges(operations),
    
    insights: generateInsights(operations, statistics, performance),
    
    ...(options.includeContent && { previews: generatePreviews(operations, options.maxContentPreview || 500) })
  };
  
  return report;
}

/**
 * Export report to specified format
 */
export function exportReport(report: DryRunReport, format: ReportFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(report, null, 2);
    
    case 'markdown':
      return generateMarkdownReport(report);
    
    case 'text':
      return generateTextReport(report);
    
    case 'html':
      return generateHtmlReport(report);
    
    default:
      throw new Error(`Unsupported report format: ${format}`);
  }
}

// =============================================================================
// FORMAT GENERATORS
// =============================================================================

/**
 * Generate markdown format report
 */
function generateMarkdownReport(report: DryRunReport): string {
  let md = '# Dry Run Report\n\n';
  
  // Metadata
  md += '## Metadata\n\n';
  md += `- **Generated**: ${report.metadata.timestamp}\n`;
  md += `- **Version**: ${report.metadata.version}\n`;
  md += `- **Execution Time**: ${report.metadata.executionTime}ms\n\n`;
  
  // Summary
  md += '## Summary\n\n';
  md += report.summary.text + '\n';
  
  // Performance
  if (report.summary.performance.operationsPerSecond > 0) {
    md += '### Performance Metrics\n\n';
    md += `- **Operations/sec**: ${report.summary.performance.operationsPerSecond.toFixed(2)}\n`;
    md += `- **Bytes/sec**: ${formatBytes(report.summary.performance.bytesPerSecond)}\n\n`;
  }
  
  // Changes
  md += '## Changes\n\n';
  
  if (report.changes.created.length > 0) {
    md += '### Files to Create\n\n';
    report.changes.created.forEach(file => {
      md += `- \`${file}\`\n`;
    });
    md += '\n';
  }
  
  if (report.changes.modified.length > 0) {
    md += '### Files to Modify\n\n';
    report.changes.modified.forEach(change => {
      const sizeDiff = change.sizeAfter - change.sizeBefore;
      const sizeChange = sizeDiff > 0 ? `+${formatBytes(sizeDiff)}` : formatBytes(sizeDiff);
      md += `- \`${change.path}\` (${formatBytes(change.sizeBefore)} → ${formatBytes(change.sizeAfter)}, ${sizeChange})\n`;
    });
    md += '\n';
  }
  
  if (report.changes.deleted.length > 0) {
    md += '### Files to Delete\n\n';
    report.changes.deleted.forEach(file => {
      md += `- \`${file}\`\n`;
    });
    md += '\n';
  }
  
  if (report.changes.directories.length > 0) {
    md += '### Directories to Create\n\n';
    report.changes.directories.forEach(dir => {
      md += `- \`${dir}\`\n`;
    });
    md += '\n';
  }
  
  // Insights
  if (report.insights.warnings.length > 0 || report.insights.recommendations.length > 0) {
    md += '## Insights\n\n';
    
    if (report.insights.warnings.length > 0) {
      md += '### ⚠️ Warnings\n\n';
      report.insights.warnings.forEach(warning => {
        md += `- ${warning}\n`;
      });
      md += '\n';
    }
    
    if (report.insights.recommendations.length > 0) {
      md += '### 💡 Recommendations\n\n';
      report.insights.recommendations.forEach(rec => {
        md += `- ${rec}\n`;
      });
      md += '\n';
    }
  }
  
  // Failed operations
  if (report.operations.failed.length > 0) {
    md += '## Failed Operations\n\n';
    report.operations.failed.forEach(op => {
      md += `- **${op.type.toUpperCase()}** \`${op.path}\`: ${op.error}\n`;
    });
    md += '\n';
  }
  
  // Content previews
  if (report.previews && Object.keys(report.previews).length > 0) {
    md += '## Content Previews\n\n';
    
    for (const [filePath, preview] of Object.entries(report.previews)) {
      md += `### \`${filePath}\`\n\n`;
      
      if (preview.before && preview.after) {
        md += '**Before:**\n```\n' + preview.before + '\n```\n\n';
        md += '**After:**\n```\n' + preview.after + '\n```\n\n';
      } else if (preview.after) {
        md += '**Content:**\n```\n' + preview.after + '\n```\n\n';
      }
      
      if (preview.diff) {
        md += '**Diff:**\n```diff\n' + preview.diff + '\n```\n\n';
      }
    }
  }
  
  return md;
}

/**
 * Generate plain text format report
 */
function generateTextReport(report: DryRunReport): string {
  let text = '='.repeat(60) + '\n';
  text += 'DRY RUN REPORT\n';
  text += '='.repeat(60) + '\n\n';
  
  // Metadata
  text += 'METADATA:\n';
  text += `---------\n`;
  text += `Generated: ${report.metadata.timestamp}\n`;
  text += `Version: ${report.metadata.version}\n`;
  text += `Execution Time: ${report.metadata.executionTime}ms\n\n`;
  
  // Summary
  text += report.summary.text + '\n';
  
  // Changes
  text += 'CHANGES:\n';
  text += '--------\n';
  text += `Files to create: ${report.changes.created.length}\n`;
  text += `Files to modify: ${report.changes.modified.length}\n`;
  text += `Files to delete: ${report.changes.deleted.length}\n`;
  text += `Directories to create: ${report.changes.directories.length}\n\n`;
  
  // Insights
  if (report.insights.warnings.length > 0) {
    text += 'WARNINGS:\n';
    text += '---------\n';
    report.insights.warnings.forEach((warning, i) => {
      text += `${i + 1}. ${warning}\n`;
    });
    text += '\n';
  }
  
  if (report.insights.recommendations.length > 0) {
    text += 'RECOMMENDATIONS:\n';
    text += '---------------\n';
    report.insights.recommendations.forEach((rec, i) => {
      text += `${i + 1}. ${rec}\n`;
    });
    text += '\n';
  }
  
  return text;
}

/**
 * Generate HTML format report
 */
function generateHtmlReport(report: DryRunReport): string {
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dry Run Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui; margin: 2rem; line-height: 1.6; }
        .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 1rem; margin-bottom: 2rem; }
        .section { margin-bottom: 2rem; }
        .section h2 { color: #0969da; border-bottom: 1px solid #d1d9e0; padding-bottom: 0.5rem; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
        .stat-card { background: #f6f8fa; padding: 1rem; border-radius: 6px; border-left: 4px solid #0969da; }
        .stat-value { font-size: 1.5rem; font-weight: bold; color: #0969da; }
        .file-list { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
        .file-list code { background: #e7ecf0; padding: 0.2rem 0.4rem; border-radius: 3px; }
        .warning { background: #fff8dc; border-left: 4px solid #ff6b35; padding: 1rem; margin: 0.5rem 0; }
        .recommendation { background: #e6f3ff; border-left: 4px solid #0969da; padding: 1rem; margin: 0.5rem 0; }
        .preview { background: #f6f8fa; border: 1px solid #d1d9e0; border-radius: 6px; margin: 1rem 0; }
        .preview-header { background: #e1e5e9; padding: 0.5rem 1rem; font-weight: bold; }
        .preview-content { padding: 1rem; overflow-x: auto; }
        pre { margin: 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏃 Dry Run Report</h1>
        <p><strong>Generated:</strong> ${report.metadata.timestamp}</p>
        <p><strong>Execution Time:</strong> ${report.metadata.executionTime}ms</p>
    </div>
  `;

  // Statistics
  html += `
    <div class="section">
        <h2>📊 Statistics</h2>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-value">${report.summary.statistics.totalOperations}</div>
                <div>Total Operations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.statistics.filesCreated}</div>
                <div>Files to Create</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${report.summary.statistics.filesModified}</div>
                <div>Files to Modify</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatBytes(report.summary.statistics.totalBytesWritten)}</div>
                <div>Bytes to Write</div>
            </div>
        </div>
    </div>
  `;

  // Changes
  if (report.changes.created.length > 0 || report.changes.modified.length > 0) {
    html += `<div class="section"><h2>📁 Changes</h2>`;
    
    if (report.changes.created.length > 0) {
      html += `<h3>Files to Create</h3><div class="file-list">`;
      report.changes.created.forEach(file => {
        html += `<code>${file}</code><br>`;
      });
      html += `</div>`;
    }
    
    if (report.changes.modified.length > 0) {
      html += `<h3>Files to Modify</h3><div class="file-list">`;
      report.changes.modified.forEach(change => {
        html += `<code>${change.path}</code> (${formatBytes(change.sizeBefore)} → ${formatBytes(change.sizeAfter)})<br>`;
      });
      html += `</div>`;
    }
    
    html += `</div>`;
  }

  // Insights
  if (report.insights.warnings.length > 0 || report.insights.recommendations.length > 0) {
    html += `<div class="section"><h2>💡 Insights</h2>`;
    
    if (report.insights.warnings.length > 0) {
      html += `<h3>⚠️ Warnings</h3>`;
      report.insights.warnings.forEach(warning => {
        html += `<div class="warning">${warning}</div>`;
      });
    }
    
    if (report.insights.recommendations.length > 0) {
      html += `<h3>💡 Recommendations</h3>`;
      report.insights.recommendations.forEach(rec => {
        html += `<div class="recommendation">${rec}</div>`;
      });
    }
    
    html += `</div>`;
  }

  html += `</body></html>`;
  return html;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Group operations by type
 */
function groupOperationsByType(operations: FileOperation[]): Record<string, FileOperation[]> {
  const grouped: Record<string, FileOperation[]> = {};
  
  for (const operation of operations) {
    if (!grouped[operation.type]) {
      grouped[operation.type] = [];
    }
    grouped[operation.type].push(operation);
  }
  
  return grouped;
}

/**
 * Group operations by file path
 */
function groupOperationsByPath(operations: FileOperation[]): Record<string, FileOperation[]> {
  const grouped: Record<string, FileOperation[]> = {};
  
  for (const operation of operations) {
    if (!grouped[operation.path]) {
      grouped[operation.path] = [];
    }
    grouped[operation.path].push(operation);
  }
  
  return grouped;
}

/**
 * Analyze changes from operations
 */
function analyzeChanges(operations: FileOperation[]): DryRunReport['changes'] {
  const changes: DryRunReport['changes'] = {
    created: [],
    modified: [],
    deleted: [],
    directories: []
  };
  
  for (const operation of operations) {
    switch (operation.type) {
      case 'create':
        changes.created.push(operation.path);
        break;
      
      case 'write':
        const sizeBefore = operation.previousContent ? calculateContentSize(operation.previousContent) : 0;
        const sizeAfter = operation.newContent ? calculateContentSize(operation.newContent) : 0;
        changes.modified.push({
          path: operation.path,
          sizeBefore,
          sizeAfter
        });
        break;
      
      case 'delete':
        changes.deleted.push(operation.path);
        break;
      
      case 'mkdir':
        changes.directories.push(operation.path);
        break;
    }
  }
  
  return changes;
}

/**
 * Generate insights and recommendations
 */
function generateInsights(
  operations: FileOperation[],
  statistics: DryRunStatistics,
  performance: DryRunPerformanceMetrics
): DryRunReport['insights'] {
  const insights: DryRunReport['insights'] = {
    warnings: [],
    recommendations: [],
    performance: []
  };
  
  // Warnings
  if (statistics.failedOperations > 0) {
    insights.warnings.push(`${statistics.failedOperations} operations failed and may cause issues`);
  }
  
  if (statistics.sizeImpact.netSizeChange > 100 * 1024 * 1024) { // > 100MB
    insights.warnings.push(`Large net size increase (${formatBytes(statistics.sizeImpact.netSizeChange)}) - consider optimization`);
  }
  
  const largeFiles = operations.filter(op => {
    const size = op.newContent ? calculateContentSize(op.newContent) : 0;
    return size > 10 * 1024 * 1024; // > 10MB
  });
  
  if (largeFiles.length > 0) {
    insights.warnings.push(`${largeFiles.length} files are very large (>10MB) and may impact performance`);
  }
  
  // Recommendations
  insights.recommendations.push(...performance.optimizationSuggestions);
  
  if (statistics.frequentPaths.length > 0) {
    const hotFiles = statistics.frequentPaths.filter(p => p.count > 5);
    if (hotFiles.length > 0) {
      insights.recommendations.push(`Consider caching or optimizing ${hotFiles.length} frequently accessed files`);
    }
  }
  
  // Performance insights
  if (performance.operationsPerSecond > 0) {
    insights.performance.push(`Processing speed: ${performance.operationsPerSecond.toFixed(2)} operations/second`);
    insights.performance.push(`Data throughput: ${formatBytes(performance.bytesPerSecond)}/second`);
  }
  
  if (performance.bottlenecks.length > 0) {
    insights.performance.push(...performance.bottlenecks.map(b => `Bottleneck: ${b}`));
  }
  
  return insights;
}

/**
 * Generate content previews for files
 */
function generatePreviews(
  operations: FileOperation[],
  maxLength: number
): Record<string, { before?: string; after?: string; diff?: string }> {
  const previews: Record<string, { before?: string; after?: string; diff?: string }> = {};
  
  for (const operation of operations) {
    if (operation.type === 'write' || operation.type === 'create') {
      const preview: { before?: string; after?: string; diff?: string } = {};
      
      if (operation.previousContent && typeof operation.previousContent === 'string') {
        preview.before = operation.previousContent.substring(0, maxLength);
        if (operation.previousContent.length > maxLength) {
          preview.before += '... (truncated)';
        }
      }
      
      if (operation.newContent && typeof operation.newContent === 'string') {
        preview.after = operation.newContent.substring(0, maxLength);
        if (operation.newContent.length > maxLength) {
          preview.after += '... (truncated)';
        }
      }
      
      // Generate simple diff if both before and after exist
      if (preview.before && preview.after) {
        preview.diff = generateSimpleDiff(preview.before, preview.after);
      }
      
      if (preview.before || preview.after) {
        previews[operation.path] = preview;
      }
    }
  }
  
  return previews;
}

/**
 * Calculate content size in bytes
 */
function calculateContentSize(content: string | Buffer): number {
  if (Buffer.isBuffer(content)) {
    return content.length;
  }
  return Buffer.byteLength(content, 'utf8');
}

/**
 * Format bytes as human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Generate a simple diff between two strings
 */
function generateSimpleDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  
  let diff = '';
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];
    
    if (beforeLine !== afterLine) {
      if (beforeLine !== undefined) {
        diff += `- ${beforeLine}\n`;
      }
      if (afterLine !== undefined) {
        diff += `+ ${afterLine}\n`;
      }
    }
  }
  
  return diff || '(no changes)';
} 