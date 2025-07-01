/**
 * Output Manager
 * Handles flexible output options for dry run reports and results
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger';
import type { PreviewReport } from './reportGenerator';
import type { VisualDiffResult } from './visualDiff';
import type { ImpactMetrics } from './impactEstimator';
import type { DryRunResult } from './dryRunManager';

export interface OutputDestination {
  /** Destination type */
  type: 'file' | 'console' | 'api' | 'stream' | 'memory';
  /** File path (for file type) */
  path?: string;
  /** API endpoint (for api type) */
  endpoint?: string;
  /** HTTP headers (for api type) */
  headers?: Record<string, string>;
  /** Stream reference (for stream type) */
  stream?: NodeJS.WritableStream;
  /** Memory storage key (for memory type) */
  key?: string;
}

export interface OutputFormat {
  /** Format type */
  type: 'json' | 'html' | 'markdown' | 'text' | 'pdf' | 'xml' | 'csv' | 'yaml';
  /** Format-specific options */
  options?: {
    /** Pretty print JSON */
    prettyPrint?: boolean;
    /** HTML template */
    template?: string;
    /** Include metadata */
    includeMetadata?: boolean;
    /** Compress output */
    compress?: boolean;
    /** Custom styling */
    styling?: Record<string, any>;
  };
}

export interface OutputConfig {
  /** Output destinations */
  destinations: OutputDestination[];
  /** Output format */
  format: OutputFormat;
  /** Output validation */
  validate: boolean;
  /** Backup original files */
  backup: boolean;
  /** Overwrite existing files */
  overwrite: boolean;
  /** Create directories if needed */
  createDirectories: boolean;
  /** File permissions (for file output) */
  permissions?: number;
  /** Output timeout (ms) */
  timeout: number;
  /** Retry options */
  retry: {
    attempts: number;
    delay: number;
  };
}

export interface OutputResult {
  /** Success status */
  success: boolean;
  /** Output destinations that succeeded */
  destinations: {
    destination: OutputDestination;
    success: boolean;
    path?: string;
    size?: number;
    error?: string;
  }[];
  /** Total output size */
  totalSize: number;
  /** Processing time */
  processingTime: number;
  /** Validation results */
  validation?: {
    valid: boolean;
    issues: string[];
  };
}

export class OutputError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly destination?: OutputDestination
  ) {
    super(message);
    this.name = 'OutputError';
  }
}

export class OutputManager {
  private logger: Logger;
  private memoryStore = new Map<string, string>();

  constructor() {
    this.logger = new Logger({ component: 'OutputManager' });
  }

  /**
   * Output a preview report
   */
  async outputReport(
    report: PreviewReport,
    config: Partial<OutputConfig> = {}
  ): Promise<OutputResult> {
    const fullConfig = this.getDefaultConfig(config);
    
    try {
      this.logger.debug('Outputting preview report', {
        destinations: fullConfig.destinations.length,
        format: fullConfig.format.type,
      });

      const content = await this.formatContent(report, fullConfig.format);
      return this.writeToDestinations(content, fullConfig);
    } catch (error) {
      this.logger.error('Failed to output report', { error });
      throw new OutputError(
        'Report output failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Output visual diff results
   */
  async outputVisualDiff(
    diffResult: VisualDiffResult,
    config: Partial<OutputConfig> = {}
  ): Promise<OutputResult> {
    const fullConfig = this.getDefaultConfig(config);
    
    try {
      this.logger.debug('Outputting visual diff', {
        fileDiffs: diffResult.fileDiffs.length,
        format: fullConfig.format.type,
      });

      const content = await this.formatDiffContent(diffResult, fullConfig.format);
      return this.writeToDestinations(content, fullConfig);
    } catch (error) {
      this.logger.error('Failed to output visual diff', { error });
      throw new OutputError(
        'Visual diff output failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Output impact metrics
   */
  async outputImpactMetrics(
    metrics: ImpactMetrics,
    config: Partial<OutputConfig> = {}
  ): Promise<OutputResult> {
    const fullConfig = this.getDefaultConfig(config);
    
    try {
      this.logger.debug('Outputting impact metrics', {
        riskLevel: metrics.riskLevel,
        format: fullConfig.format.type,
      });

      const content = await this.formatMetricsContent(metrics, fullConfig.format);
      return this.writeToDestinations(content, fullConfig);
    } catch (error) {
      this.logger.error('Failed to output impact metrics', { error });
      throw new OutputError(
        'Impact metrics output failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Output combined dry run results
   */
  async outputCombinedResults(
    data: {
      dryRunResult: DryRunResult;
      report?: PreviewReport;
      visualDiff?: VisualDiffResult;
      impactMetrics?: ImpactMetrics;
    },
    config: Partial<OutputConfig> = {}
  ): Promise<OutputResult> {
    const fullConfig = this.getDefaultConfig(config);
    
    try {
      this.logger.debug('Outputting combined results', {
        hasReport: !!data.report,
        hasVisualDiff: !!data.visualDiff,
        hasImpactMetrics: !!data.impactMetrics,
      });

      const content = await this.formatCombinedContent(data, fullConfig.format);
      return this.writeToDestinations(content, fullConfig);
    } catch (error) {
      this.logger.error('Failed to output combined results', { error });
      throw new OutputError(
        'Combined results output failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Format content based on format type
   */
  private async formatContent(data: any, format: OutputFormat): Promise<string> {
    switch (format.type) {
      case 'json':
        return this.formatAsJSON(data, format.options);
      case 'html':
        return this.formatAsHTML(data, format.options);
      case 'markdown':
        return this.formatAsMarkdown(data, format.options);
      case 'text':
        return this.formatAsText(data, format.options);
      case 'yaml':
        return this.formatAsYAML(data, format.options);
      case 'xml':
        return this.formatAsXML(data, format.options);
      case 'csv':
        return this.formatAsCSV(data, format.options);
      case 'pdf':
        return this.formatAsPDF(data, format.options);
      default:
        throw new Error(`Unsupported format type: ${format.type}`);
    }
  }

  /**
   * Format preview report content
   */
  private async formatContent(report: PreviewReport, format: OutputFormat): Promise<string> {
    return this.formatContent(report, format);
  }

  /**
   * Format visual diff content
   */
  private async formatDiffContent(diffResult: VisualDiffResult, format: OutputFormat): Promise<string> {
    return this.formatContent(diffResult, format);
  }

  /**
   * Format impact metrics content
   */
  private async formatMetricsContent(metrics: ImpactMetrics, format: OutputFormat): Promise<string> {
    return this.formatContent(metrics, format);
  }

  /**
   * Format combined content
   */
  private async formatCombinedContent(
    data: {
      dryRunResult: DryRunResult;
      report?: PreviewReport;
      visualDiff?: VisualDiffResult;
      impactMetrics?: ImpactMetrics;
    },
    format: OutputFormat
  ): Promise<string> {
    const combined = {
      timestamp: Date.now(),
      dryRunResult: data.dryRunResult,
      ...(data.report && { report: data.report }),
      ...(data.visualDiff && { visualDiff: data.visualDiff }),
      ...(data.impactMetrics && { impactMetrics: data.impactMetrics }),
    };

    return this.formatContent(combined, format);
  }

  /**
   * Write content to all destinations
   */
  private async writeToDestinations(content: string, config: OutputConfig): Promise<OutputResult> {
    const startTime = performance.now();
    const destinations: OutputResult['destinations'] = [];
    let totalSize = 0;

    for (const destination of config.destinations) {
      try {
        const result = await this.writeToDestination(content, destination, config);
        destinations.push(result);
        totalSize += result.size || 0;
      } catch (error) {
        destinations.push({
          destination,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const processingTime = performance.now() - startTime;
    const success = destinations.every(d => d.success);

    let validation: OutputResult['validation'] | undefined;
    if (config.validate) {
      validation = this.validateOutput(content, config.format);
    }

    return {
      success,
      destinations,
      totalSize,
      processingTime,
      validation,
    };
  }

  /**
   * Write content to a single destination
   */
  private async writeToDestination(
    content: string,
    destination: OutputDestination,
    config: OutputConfig
  ): Promise<OutputResult['destinations'][0]> {
    switch (destination.type) {
      case 'file':
        return this.writeToFile(content, destination, config);
      case 'console':
        return this.writeToConsole(content, destination);
      case 'api':
        return this.writeToAPI(content, destination, config);
      case 'stream':
        return this.writeToStream(content, destination);
      case 'memory':
        return this.writeToMemory(content, destination);
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`);
    }
  }

  /**
   * Write to file
   */
  private async writeToFile(
    content: string,
    destination: OutputDestination,
    config: OutputConfig
  ): Promise<OutputResult['destinations'][0]> {
    if (!destination.path) {
      throw new Error('File path is required for file destination');
    }

    const filePath = path.resolve(destination.path);

    // Create directories if needed
    if (config.createDirectories) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }

    // Check if file exists and handle overwrite
    try {
      await fs.access(filePath);
      if (!config.overwrite) {
        throw new Error(`File already exists: ${filePath}`);
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Backup existing file if needed
    if (config.backup) {
      try {
        await fs.access(filePath);
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.copyFile(filePath, backupPath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.warn('Failed to create backup', { error, filePath });
        }
      }
    }

    // Write content
    await fs.writeFile(filePath, content, {
      mode: config.permissions,
    });

    const stats = await fs.stat(filePath);

    return {
      destination,
      success: true,
      path: filePath,
      size: stats.size,
    };
  }

  /**
   * Write to console
   */
  private async writeToConsole(
    content: string,
    destination: OutputDestination
  ): Promise<OutputResult['destinations'][0]> {
    console.log(content);

    return {
      destination,
      success: true,
      size: Buffer.byteLength(content, 'utf8'),
    };
  }

  /**
   * Write to API endpoint
   */
  private async writeToAPI(
    content: string,
    destination: OutputDestination,
    config: OutputConfig
  ): Promise<OutputResult['destinations'][0]> {
    if (!destination.endpoint) {
      throw new Error('Endpoint is required for API destination');
    }

    // Simple fetch implementation (would need proper HTTP client in real usage)
    const response = await fetch(destination.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...destination.headers,
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return {
      destination,
      success: true,
      size: Buffer.byteLength(content, 'utf8'),
    };
  }

  /**
   * Write to stream
   */
  private async writeToStream(
    content: string,
    destination: OutputDestination
  ): Promise<OutputResult['destinations'][0]> {
    if (!destination.stream) {
      throw new Error('Stream is required for stream destination');
    }

    return new Promise((resolve, reject) => {
      destination.stream!.write(content, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            destination,
            success: true,
            size: Buffer.byteLength(content, 'utf8'),
          });
        }
      });
    });
  }

  /**
   * Write to memory
   */
  private async writeToMemory(
    content: string,
    destination: OutputDestination
  ): Promise<OutputResult['destinations'][0]> {
    const key = destination.key || 'default';
    this.memoryStore.set(key, content);

    return {
      destination,
      success: true,
      size: Buffer.byteLength(content, 'utf8'),
    };
  }

  /**
   * Format as JSON
   */
  private formatAsJSON(data: any, options?: OutputFormat['options']): string {
    if (options?.prettyPrint !== false) {
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
  }

  /**
   * Format as HTML
   */
  private formatAsHTML(data: any, options?: OutputFormat['options']): string {
    const template = options?.template || this.getDefaultHTMLTemplate();
    const content = JSON.stringify(data, null, 2);
    
    return template
      .replace('{{CONTENT}}', this.escapeHtml(content))
      .replace('{{TIMESTAMP}}', new Date().toISOString());
  }

  /**
   * Format as Markdown
   */
  private formatAsMarkdown(data: any, options?: OutputFormat['options']): string {
    if (data.summary && data.sections) {
      // Preview report format
      return this.formatReportAsMarkdown(data);
    } else if (data.fileDiffs) {
      // Visual diff format
      return this.formatDiffAsMarkdown(data);
    } else if (data.riskLevel) {
      // Impact metrics format
      return this.formatMetricsAsMarkdown(data);
    }

    // Generic format
    return `# Dry Run Results\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
  }

  /**
   * Format as plain text
   */
  private formatAsText(data: any, options?: OutputFormat['options']): string {
    if (data.summary && data.sections) {
      return this.formatReportAsText(data);
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Format as YAML
   */
  private formatAsYAML(data: any, options?: OutputFormat['options']): string {
    // Simple YAML implementation (would use proper YAML library in real usage)
    return this.objectToYAML(data, 0);
  }

  /**
   * Format as XML
   */
  private formatAsXML(data: any, options?: OutputFormat['options']): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<dryRunResult>\n${this.objectToXML(data, 1)}</dryRunResult>`;
  }

  /**
   * Format as CSV
   */
  private formatAsCSV(data: any, options?: OutputFormat['options']): string {
    if (data.fileDiffs) {
      return this.formatDiffAsCSV(data);
    } else if (data.operations) {
      return this.formatOperationsAsCSV(data.operations);
    }
    return 'type,value\n' + Object.entries(data).map(([k, v]) => `${k},"${v}"`).join('\n');
  }

  /**
   * Format as PDF (placeholder)
   */
  private formatAsPDF(data: any, options?: OutputFormat['options']): string {
    // Would use PDF generation library in real implementation
    throw new Error('PDF format not yet implemented');
  }

  /**
   * Validate output content
   */
  private validateOutput(content: string, format: OutputFormat): OutputResult['validation'] {
    const issues: string[] = [];

    try {
      switch (format.type) {
        case 'json':
          JSON.parse(content);
          break;
        case 'xml':
          // Would use XML parser in real implementation
          if (!content.includes('<?xml')) {
            issues.push('Missing XML declaration');
          }
          break;
        case 'html':
          if (!content.includes('<html')) {
            issues.push('Missing HTML declaration');
          }
          break;
      }

      // Size validation
      if (content.length === 0) {
        issues.push('Empty content');
      }

      // Encoding validation
      if (!/^[\x00-\x7F]*$/.test(content) && format.type !== 'pdf') {
        // Contains non-ASCII characters
        if (format.type === 'csv') {
          issues.push('CSV contains non-ASCII characters');
        }
      }

    } catch (error) {
      issues.push(`Format validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(config: Partial<OutputConfig>): OutputConfig {
    return {
      destinations: [{ type: 'console' }],
      format: { type: 'json' },
      validate: true,
      backup: false,
      overwrite: true,
      createDirectories: true,
      timeout: 30000,
      retry: { attempts: 3, delay: 1000 },
      ...config,
    };
  }

  /**
   * Helper methods for formatting
   */
  private getDefaultHTMLTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Dry Run Results</title>
    <style>
        body { font-family: monospace; margin: 20px; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Dry Run Results</h1>
    <p>Generated: {{TIMESTAMP}}</p>
    <pre>{{CONTENT}}</pre>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private objectToYAML(obj: any, indent: number): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        yaml += `${spaces}${key}:\n${this.objectToYAML(value, indent + 1)}`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }

    return yaml;
  }

  private objectToXML(obj: any, indent: number): string {
    const spaces = '  '.repeat(indent);
    let xml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        xml += `${spaces}<${key}>\n${this.objectToXML(value, indent + 1)}${spaces}</${key}>\n`;
      } else {
        xml += `${spaces}<${key}>${this.escapeHtml(String(value))}</${key}>\n`;
      }
    }

    return xml;
  }

  private formatReportAsMarkdown(report: any): string {
    let md = `# ${report.summary.title}\n\n`;
    md += `${report.summary.content}\n\n`;
    
    for (const section of report.sections) {
      md += `## ${section.title}\n\n`;
      md += `\`\`\`\n${section.content}\n\`\`\`\n\n`;
    }

    return md;
  }

  private formatReportAsText(report: any): string {
    let text = `${report.summary.title}\n${'='.repeat(report.summary.title.length)}\n\n`;
    text += `${report.summary.content}\n\n`;
    
    for (const section of report.sections) {
      text += `${section.title}\n${'-'.repeat(section.title.length)}\n`;
      text += `${section.content}\n\n`;
    }

    return text;
  }

  private formatDiffAsMarkdown(diff: any): string {
    let md = `# Visual Diff Results\n\n`;
    md += `**Files Changed:** ${diff.summary.totalChanges}\n\n`;
    
    for (const fileDiff of diff.fileDiffs) {
      md += `## ${fileDiff.filePath} (${fileDiff.type})\n\n`;
      if (fileDiff.textDiff) {
        md += `\`\`\`diff\n${fileDiff.textDiff.unifiedDiff}\n\`\`\`\n\n`;
      }
    }

    return md;
  }

  private formatMetricsAsMarkdown(metrics: any): string {
    let md = `# Impact Analysis\n\n`;
    md += `**Risk Level:** ${metrics.riskLevel}\n`;
    md += `**Confidence:** ${Math.round(metrics.confidence * 100)}%\n\n`;
    
    md += `## Scope\n`;
    md += `- Files Affected: ${metrics.scope.filesAffected}\n`;
    md += `- Critical Files: ${metrics.scope.criticalFilesAffected}\n\n`;

    return md;
  }

  private formatDiffAsCSV(diff: any): string {
    let csv = 'file,type,additions,deletions\n';
    for (const fileDiff of diff.fileDiffs) {
      const stats = fileDiff.textDiff?.stats || { additions: 0, deletions: 0 };
      csv += `"${fileDiff.filePath}",${fileDiff.type},${stats.additions},${stats.deletions}\n`;
    }
    return csv;
  }

  private formatOperationsAsCSV(operations: any[]): string {
    let csv = 'id,type,target,description,size_impact\n';
    for (const op of operations) {
      csv += `${op.id},${op.type},"${op.target}","${op.description}",${op.sizeImpact || 0}\n`;
    }
    return csv;
  }

  /**
   * Get memory store content
   */
  getMemoryContent(key: string = 'default'): string | undefined {
    return this.memoryStore.get(key);
  }

  /**
   * Clear memory store
   */
  clearMemory(key?: string): void {
    if (key) {
      this.memoryStore.delete(key);
    } else {
      this.memoryStore.clear();
    }
  }
}

/**
 * Global output manager instance
 */
let globalOutputManager: OutputManager | null = null;

/**
 * Get the global output manager
 */
export function getOutputManager(): OutputManager {
  if (!globalOutputManager) {
    globalOutputManager = new OutputManager();
  }
  return globalOutputManager;
}

/**
 * Create a new output manager
 */
export function createOutputManager(): OutputManager {
  return new OutputManager();
}

export default OutputManager;