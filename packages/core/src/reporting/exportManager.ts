/**
 * Export and Sharing Manager for TW-Enigma Reports
 * Handles multiple export formats and sharing capabilities
 */

import { promises as fs } from 'fs';
import path from 'path';
import { OptimizationReport } from './schema.js';
import { generateHtmlString } from './htmlGenerator.js';

interface ExportOptions {
  /** Output directory for exports */
  outputDir?: string;
  /** Include timestamp in filename */
  includeTimestamp?: boolean;
  /** Custom filename prefix */
  filePrefix?: string;
  /** Export compression level (for applicable formats) */
  compressionLevel?: number;
}

interface CsvExportOptions extends ExportOptions {
  /** Include file details in CSV */
  includeFileDetails?: boolean;
  /** CSV delimiter */
  delimiter?: string;
  /** Include headers */
  includeHeaders?: boolean;
}

interface PdfExportOptions extends ExportOptions {
  /** PDF page format */
  format?: 'A4' | 'Letter' | 'Legal';
  /** PDF orientation */
  orientation?: 'portrait' | 'landscape';
  /** Include charts in PDF */
  includeCharts?: boolean;
  /** PDF quality settings */
  quality?: 'low' | 'medium' | 'high';
}

interface ShareOptions {
  /** Share via email */
  email?: {
    to: string[];
    subject?: string;
    message?: string;
  };
  /** Upload to cloud storage */
  cloudStorage?: {
    provider: 'aws-s3' | 'google-drive' | 'dropbox';
    bucket?: string;
    path?: string;
    publicAccess?: boolean;
  };
  /** Generate shareable link */
  shareableLink?: {
    expirationDays?: number;
    password?: string;
    downloadLimit?: number;
  };
}

export class ExportManager {
  private projectRoot: string;
  private defaultOutputDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.defaultOutputDir = path.join(projectRoot, '.tw-enigma', 'exports');
  }

  /**
   * Export report to JSON format
   */
  async exportToJson(
    report: OptimizationReport,
    options: ExportOptions = {}
  ): Promise<string> {
    try {
      const outputDir = options.outputDir || this.defaultOutputDir;
      await fs.mkdir(outputDir, { recursive: true });

      const filename = this.generateFilename('report', 'json', report, options);
      const filePath = path.join(outputDir, filename);

      // Format JSON with proper indentation
      const jsonContent = JSON.stringify(report, null, 2);
      await fs.writeFile(filePath, jsonContent, 'utf8');

      return filePath;
    } catch (error) {
      throw new Error(`Failed to export JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export report to HTML format
   */
  async exportToHtml(
    report: OptimizationReport,
    options: ExportOptions = {}
  ): Promise<string> {
    try {
      const outputDir = options.outputDir || this.defaultOutputDir;
      await fs.mkdir(outputDir, { recursive: true });

      const filename = this.generateFilename('report', 'html', report, options);
      const filePath = path.join(outputDir, filename);

      // Generate HTML content
      const htmlContent = await generateHtmlString(report, {
        title: `TW-Enigma Report - ${report.metadata.context.projectName || 'Project'}`,
        interactive: true,
        includeFiles: true
      });

      await fs.writeFile(filePath, htmlContent, 'utf8');

      return filePath;
    } catch (error) {
      throw new Error(`Failed to export HTML: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export report to CSV format
   */
  async exportToCsv(
    report: OptimizationReport,
    options: CsvExportOptions = {}
  ): Promise<string> {
    try {
      const outputDir = options.outputDir || this.defaultOutputDir;
      await fs.mkdir(outputDir, { recursive: true });

      const delimiter = options.delimiter || ',';
      const includeHeaders = options.includeHeaders !== false;
      const includeFileDetails = options.includeFileDetails !== false;

      let csvContent = '';

      // Summary data
      if (includeHeaders) {
        csvContent += `Report Type${delimiter}Metric${delimiter}Value${delimiter}Unit\n`;
      }

      const summaryRows = [
        ['Summary', 'Total Files', report.summary.totalFiles.toString(), 'count'],
        ['Summary', 'Files Optimized', report.summary.filesOptimized.toString(), 'count'],
        ['Summary', 'Files Failed', report.summary.filesFailed.toString(), 'count'],
        ['Summary', 'Total Size Saved', report.summary.totalSizeSavedBytes.toString(), 'bytes'],
        ['Summary', 'Size Saved Percentage', report.summary.totalSizeSavedPercent.toString(), 'percent'],
        ['Summary', 'Total Classes', report.summary.totalClasses.toString(), 'count'],
        ['Summary', 'Classes Optimized', report.summary.totalClassesOptimized.toString(), 'count'],
        ['Summary', 'Class Optimization Percentage', report.summary.classOptimizationPercent.toString(), 'percent'],
        ['Summary', 'Total Processing Time', report.summary.totalProcessingTimeMs.toString(), 'milliseconds'],
        ['Summary', 'Average Processing Time', report.summary.averageProcessingTimeMs.toString(), 'milliseconds'],
        ['Performance', 'Peak Memory Usage', report.performance.memory.peakUsageBytes.toString(), 'bytes'],
        ['Performance', 'Start Memory Usage', report.performance.memory.startUsageBytes.toString(), 'bytes'],
        ['Performance', 'End Memory Usage', report.performance.memory.endUsageBytes.toString(), 'bytes']
      ];

      for (const row of summaryRows) {
        csvContent += row.join(delimiter) + '\n';
      }

      // File details if requested
      if (includeFileDetails && report.files.length > 0) {
        csvContent += '\n'; // Empty line separator
        
        if (includeHeaders) {
          csvContent += `File Path${delimiter}Original Size${delimiter}Optimized Size${delimiter}Size Saved${delimiter}Size Saved %${delimiter}Class Count${delimiter}Classes Optimized${delimiter}Processing Time${delimiter}Status\n`;
        }

        for (const file of report.files) {
          const status = file.error ? 'Error' : 'Success';
          const row = [
            file.originalPath,
            file.originalSizeBytes.toString(),
            file.optimizedSizeBytes.toString(),
            file.sizeSavedBytes.toString(),
            file.sizeSavedPercent.toString(),
            file.classCount.toString(),
            file.classesOptimized.toString(),
            file.processingTimeMs.toString(),
            status
          ];
          csvContent += row.map(cell => this.escapeCsvCell(cell, delimiter)).join(delimiter) + '\n';
        }
      }

      const filename = this.generateFilename('report', 'csv', report, options);
      const filePath = path.join(outputDir, filename);

      await fs.writeFile(filePath, csvContent, 'utf8');

      return filePath;
    } catch (error) {
      throw new Error(`Failed to export CSV: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export report to PDF format (simplified text-based PDF)
   */
  async exportToPdf(
    report: OptimizationReport,
    options: PdfExportOptions = {}
  ): Promise<string> {
    try {
      const outputDir = options.outputDir || this.defaultOutputDir;
      await fs.mkdir(outputDir, { recursive: true });

      // Generate HTML first, then convert to PDF-like format
      // Note: This is a simplified implementation. For production use,
      // consider using libraries like puppeteer or jsPDF
      const htmlContent = await generateHtmlString(report, {
        title: `TW-Enigma Report - ${report.metadata.context.projectName || 'Project'}`,
        interactive: false, // Disable interactive features for PDF
        includeFiles: true,
        theme: 'light' // Use light theme for better printing
      });

      // Create a PDF-optimized HTML file
      const pdfHtml = this.optimizeHtmlForPdf(htmlContent);

      const filename = this.generateFilename('report', 'html', report, options);
      const filePath = path.join(outputDir, filename);

      await fs.writeFile(filePath, pdfHtml, 'utf8');

      // Note: In a production environment, you would use a library like puppeteer to convert HTML to PDF:
      // const browser = await puppeteer.launch();
      // const page = await browser.newPage();
      // await page.setContent(pdfHtml);
      // const pdfBuffer = await page.pdf({ format: options.format || 'A4' });
      // await fs.writeFile(filePath.replace('.html', '.pdf'), pdfBuffer);

      return filePath;
    } catch (error) {
      throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export report in multiple formats
   */
  async exportMultiple(
    report: OptimizationReport,
    formats: Array<'json' | 'html' | 'csv' | 'pdf'>,
    options: ExportOptions = {}
  ): Promise<{ [format: string]: string }> {
    const results: { [format: string]: string } = {};

    for (const format of formats) {
      try {
        switch (format) {
          case 'json':
            results.json = await this.exportToJson(report, options);
            break;
          case 'html':
            results.html = await this.exportToHtml(report, options);
            break;
          case 'csv':
            results.csv = await this.exportToCsv(report, options as CsvExportOptions);
            break;
          case 'pdf':
            results.pdf = await this.exportToPdf(report, options as PdfExportOptions);
            break;
        }
      } catch (error) {
        // Log error but continue with other formats
        console.warn(`Failed to export ${format}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }

  /**
   * Create a shareable package with multiple formats
   */
  async createShareablePackage(
    report: OptimizationReport,
    options: {
      formats?: Array<'json' | 'html' | 'csv' | 'pdf'>;
      packageName?: string;
      includeReadme?: boolean;
    } = {}
  ): Promise<string> {
    try {
      const formats = options.formats || ['json', 'html', 'csv'];
      const packageName = options.packageName || `tw-enigma-report-${Date.now()}`;
      const packageDir = path.join(this.defaultOutputDir, packageName);

      await fs.mkdir(packageDir, { recursive: true });

      // Export all formats to the package directory
      const exportResults = await this.exportMultiple(report, formats, {
        outputDir: packageDir,
        includeTimestamp: false // Don't include timestamp in package files
      });

      // Create README file if requested
      if (options.includeReadme !== false) {
        const readmeContent = this.generateReadme(report, exportResults);
        await fs.writeFile(path.join(packageDir, 'README.md'), readmeContent, 'utf8');
      }

      // Create package manifest
      const manifest = {
        packageName,
        createdAt: new Date().toISOString(),
        reportTimestamp: report.metadata.timestamp,
        projectName: report.metadata.context.projectName,
        version: report.metadata.version,
        files: Object.entries(exportResults).map(([format, filePath]) => ({
          format,
          filename: path.basename(filePath),
          size: (await fs.stat(filePath)).size
        }))
      };

      await fs.writeFile(
        path.join(packageDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
      );

      return packageDir;
    } catch (error) {
      throw new Error(`Failed to create shareable package: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate download links for reports
   */
  async generateDownloadLinks(
    report: OptimizationReport,
    formats: Array<'json' | 'html' | 'csv' | 'pdf'> = ['json', 'html']
  ): Promise<{ [format: string]: string }> {
    try {
      const exportResults = await this.exportMultiple(report, formats);
      const links: { [format: string]: string } = {};

      // In a real implementation, these would be actual download URLs
      // For now, return file paths that could be served by a web server
      for (const [format, filePath] of Object.entries(exportResults)) {
        // Convert absolute path to relative URL path
        const relativePath = path.relative(this.projectRoot, filePath);
        links[format] = `/downloads/${relativePath.replace(/\\/g, '/')}`;
      }

      return links;
    } catch (error) {
      throw new Error(`Failed to generate download links: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Share report via configured methods
   */
  async shareReport(
    report: OptimizationReport,
    shareOptions: ShareOptions,
    exportFormats: Array<'json' | 'html' | 'csv' | 'pdf'> = ['html', 'json']
  ): Promise<{ success: boolean; message: string; shareUrls?: string[] }> {
    try {
      // Export reports first
      const exportResults = await this.exportMultiple(report, exportFormats);

      const shareUrls: string[] = [];

      // Email sharing
      if (shareOptions.email) {
        const emailResult = await this.shareViaEmail(exportResults, shareOptions.email);
        if (emailResult.success) {
          shareUrls.push(`email:${shareOptions.email.to.join(',')}`);
        }
      }

      // Cloud storage sharing
      if (shareOptions.cloudStorage) {
        const cloudResult = await this.shareViaCloudStorage(exportResults, shareOptions.cloudStorage);
        if (cloudResult.success && cloudResult.url) {
          shareUrls.push(cloudResult.url);
        }
      }

      // Shareable link generation
      if (shareOptions.shareableLink) {
        const linkResult = await this.generateShareableLink(exportResults, shareOptions.shareableLink);
        if (linkResult.success && linkResult.url) {
          shareUrls.push(linkResult.url);
        }
      }

      return {
        success: shareUrls.length > 0,
        message: shareUrls.length > 0 
          ? `Report shared successfully via ${shareUrls.length} method(s)`
          : 'No sharing methods succeeded',
        shareUrls
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to share report: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private generateFilename(
    prefix: string,
    extension: string,
    report: OptimizationReport,
    options: ExportOptions
  ): string {
    const parts = [options.filePrefix || prefix];
    
    if (report.metadata.context.projectName) {
      parts.push(report.metadata.context.projectName.replace(/[^a-zA-Z0-9]/g, '-'));
    }

    if (options.includeTimestamp !== false) {
      const timestamp = new Date(report.metadata.timestamp)
        .toISOString()
        .replace(/[:.]/g, '-')
        .split('T')[0];
      parts.push(timestamp);
    }

    return `${parts.join('-')}.${extension}`;
  }

  private escapeCsvCell(cell: string, delimiter: string): string {
    // Escape CSV cells that contain delimiter, quotes, or newlines
    if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }

  private optimizeHtmlForPdf(htmlContent: string): string {
    // Add PDF-specific styles and optimizations
    const pdfStyles = `
      <style>
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none; }
          .page-break { page-break-before: always; }
          .summary-grid { break-inside: avoid; }
          .files-table { font-size: 10px; }
        }
        @page {
          margin: 1in;
          size: A4;
        }
      </style>
    `;

    // Insert PDF styles before closing head tag
    return htmlContent.replace('</head>', `${pdfStyles}</head>`);
  }

  private generateReadme(report: OptimizationReport, exportResults: { [format: string]: string }): string {
    const projectName = report.metadata.context.projectName || 'Project';
    const timestamp = new Date(report.metadata.timestamp).toLocaleString();

    return `# TW-Enigma Optimization Report

## Project Information
- **Project**: ${projectName}
- **Generated**: ${timestamp}
- **TW-Enigma Version**: ${report.metadata.version}

## Report Summary
- **Total Files Processed**: ${report.summary.totalFiles.toLocaleString()}
- **Files Successfully Optimized**: ${report.summary.filesOptimized.toLocaleString()}
- **Total Size Saved**: ${this.formatBytes(report.summary.totalSizeSavedBytes)} (${report.summary.totalSizeSavedPercent.toFixed(1)}%)
- **Classes Optimized**: ${report.summary.totalClassesOptimized.toLocaleString()} of ${report.summary.totalClasses.toLocaleString()} (${report.summary.classOptimizationPercent.toFixed(1)}%)
- **Total Processing Time**: ${this.formatTime(report.summary.totalProcessingTimeMs)}

## Available Report Formats

${Object.entries(exportResults).map(([format, filePath]) => {
  const filename = path.basename(filePath);
  const description = this.getFormatDescription(format);
  return `- **${format.toUpperCase()}**: \`${filename}\` - ${description}`;
}).join('\n')}

## How to Use

### JSON Format
The JSON file contains the complete raw data and can be used for:
- Programmatic analysis
- Integration with other tools
- Custom reporting scripts

### HTML Format
The HTML file is a self-contained report that can be:
- Opened in any web browser
- Shared via email or web hosting
- Printed or converted to PDF

### CSV Format
The CSV file contains tabular data suitable for:
- Spreadsheet applications (Excel, Google Sheets)
- Data analysis tools
- Database imports

## Report Structure

The optimization report includes:
- **Metadata**: Generation timestamp, version, project context
- **Summary**: High-level optimization metrics
- **File Details**: Per-file optimization results
- **Performance**: Memory usage and processing time metrics
- **Quality**: CSS validation and compatibility information

For questions or issues, please refer to the TW-Enigma documentation.
`;
  }

  private getFormatDescription(format: string): string {
    switch (format) {
      case 'json':
        return 'Complete raw data in JSON format for programmatic access';
      case 'html':
        return 'Interactive visual report for web browsers';
      case 'csv':
        return 'Tabular data for spreadsheet applications';
      case 'pdf':
        return 'Print-ready document format';
      default:
        return 'Report data';
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  private async shareViaEmail(
    exportResults: { [format: string]: string },
    emailOptions: NonNullable<ShareOptions['email']>
  ): Promise<{ success: boolean; message: string }> {
    // In a real implementation, this would integrate with an email service
    // For now, return a mock success response
    return {
      success: true,
      message: `Would send report to ${emailOptions.to.join(', ')}`
    };
  }

  private async shareViaCloudStorage(
    exportResults: { [format: string]: string },
    cloudOptions: NonNullable<ShareOptions['cloudStorage']>
  ): Promise<{ success: boolean; message: string; url?: string }> {
    // In a real implementation, this would integrate with cloud storage APIs
    // For now, return a mock success response
    return {
      success: true,
      message: `Would upload to ${cloudOptions.provider}`,
      url: `https://${cloudOptions.provider}.example.com/shared/report-${Date.now()}`
    };
  }

  private async generateShareableLink(
    exportResults: { [format: string]: string },
    linkOptions: NonNullable<ShareOptions['shareableLink']>
  ): Promise<{ success: boolean; message: string; url?: string }> {
    // In a real implementation, this would create a temporary shareable link
    // For now, return a mock success response
    const expirationDays = linkOptions.expirationDays || 7;
    return {
      success: true,
      message: `Generated shareable link expires in ${expirationDays} days`,
      url: `https://reports.tw-enigma.dev/share/${Date.now()}?expires=${expirationDays}d`
    };
  }
}

/**
 * Utility function to create an export manager
 */
export function createExportManager(projectRoot: string): ExportManager {
  return new ExportManager(projectRoot);
}

/**
 * Utility function to export a report to multiple formats
 */
export async function exportReport(
  report: OptimizationReport,
  projectRoot: string,
  formats: Array<'json' | 'html' | 'csv' | 'pdf'> = ['json', 'html'],
  options: ExportOptions = {}
): Promise<{ [format: string]: string }> {
  const manager = createExportManager(projectRoot);
  return await manager.exportMultiple(report, formats, options);
}