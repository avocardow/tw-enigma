/**
 * Visual Diff Output
 * Provides visual comparison functionality for dry run results
 */

import { Logger } from '../utils/logger';
import type { DryRunOperation, DryRunResult } from './dryRunManager';

export interface DiffOptions {
  /** Comparison sensitivity (0-1, higher = more sensitive) */
  sensitivity: number;
  /** Ignore whitespace in text comparisons */
  ignoreWhitespace: boolean;
  /** Ignore case in text comparisons */
  ignoreCase: boolean;
  /** Maximum file size to diff (bytes) */
  maxFileSize: number;
  /** Output format for diffs */
  outputFormat: 'unified' | 'context' | 'side-by-side' | 'html';
  /** Show line numbers in text diffs */
  showLineNumbers: boolean;
  /** Context lines around changes */
  contextLines: number;
  /** Color coding for diff output */
  colorCode: boolean;
}

export interface DiffLine {
  /** Line type */
  type: 'add' | 'remove' | 'modify' | 'context' | 'header';
  /** Line number in original file */
  originalLineNumber?: number;
  /** Line number in new file */
  newLineNumber?: number;
  /** Line content */
  content: string;
  /** Visual indicator */
  indicator: string;
  /** CSS class for styling */
  cssClass: string;
}

export interface TextDiffResult {
  /** Original content */
  original: string;
  /** Modified content */
  modified: string;
  /** Diff lines */
  lines: DiffLine[];
  /** Summary statistics */
  stats: {
    additions: number;
    deletions: number;
    modifications: number;
    totalLines: number;
  };
  /** Unified diff format */
  unifiedDiff: string;
  /** HTML diff format */
  htmlDiff: string;
}

export interface FileDiffResult {
  /** File path */
  filePath: string;
  /** Diff type */
  type: 'create' | 'modify' | 'delete' | 'rename';
  /** Text diff (for text files) */
  textDiff?: TextDiffResult;
  /** Binary diff info (for binary files) */
  binaryDiff?: {
    originalSize: number;
    newSize: number;
    sizeDelta: number;
    isBinary: true;
  };
  /** Error information */
  error?: string;
}

export interface VisualDiffResult {
  /** File diffs */
  fileDiffs: FileDiffResult[];
  /** Summary statistics */
  summary: {
    filesCreated: number;
    filesModified: number;
    filesDeleted: number;
    filesRenamed: number;
    totalChanges: number;
    totalAdditions: number;
    totalDeletions: number;
  };
  /** Generation metadata */
  metadata: {
    timestamp: number;
    options: DiffOptions;
    processingTime: number;
  };
}

export class VisualDiffError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly filePath?: string
  ) {
    super(message);
    this.name = 'VisualDiffError';
  }
}

export class VisualDiffGenerator {
  private logger: Logger;
  private defaultOptions: DiffOptions;

  constructor(options: Partial<DiffOptions> = {}) {
    this.defaultOptions = {
      sensitivity: 0.8,
      ignoreWhitespace: false,
      ignoreCase: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      outputFormat: 'unified',
      showLineNumbers: true,
      contextLines: 3,
      colorCode: true,
      ...options,
    };

    this.logger = new Logger({ component: 'VisualDiffGenerator' });
  }

  /**
   * Generate visual diff from dry run results
   */
  async generateDiff(
    result: DryRunResult,
    options: Partial<DiffOptions> = {}
  ): Promise<VisualDiffResult> {
    const startTime = performance.now();
    const diffOptions = { ...this.defaultOptions, ...options };

    try {
      this.logger.debug('Generating visual diff', {
        operationCount: result.totalOperations,
        options: diffOptions,
      });

      const fileDiffs: FileDiffResult[] = [];
      
      // Process file operations
      for (const operation of result.context.operations) {
        if (this.isFileOperation(operation)) {
          try {
            const fileDiff = await this.generateFileDiff(operation, diffOptions);
            fileDiffs.push(fileDiff);
          } catch (error) {
            this.logger.warn(`Failed to generate diff for ${operation.target}`, { error });
            fileDiffs.push({
              filePath: operation.target,
              type: this.getOperationType(operation),
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      const summary = this.calculateSummary(fileDiffs);
      const processingTime = performance.now() - startTime;

      const visualDiffResult: VisualDiffResult = {
        fileDiffs,
        summary,
        metadata: {
          timestamp: Date.now(),
          options: diffOptions,
          processingTime,
        },
      };

      this.logger.info('Successfully generated visual diff', {
        fileCount: fileDiffs.length,
        processingTime: Math.round(processingTime),
      });

      return visualDiffResult;
    } catch (error) {
      this.logger.error('Failed to generate visual diff', { error });
      throw new VisualDiffError(
        'Visual diff generation failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Generate diff for a single file operation
   */
  private async generateFileDiff(
    operation: DryRunOperation,
    options: DiffOptions
  ): Promise<FileDiffResult> {
    const filePath = operation.target;
    const type = this.getOperationType(operation);

    // Handle different operation types
    switch (operation.type) {
      case 'file-write':
        return this.generateCreateDiff(operation, options);
      case 'file-modify':
        return this.generateModifyDiff(operation, options);
      case 'file-delete':
        return this.generateDeleteDiff(operation, options);
      default:
        return {
          filePath,
          type,
          error: `Unsupported operation type: ${operation.type}`,
        };
    }
  }

  /**
   * Generate diff for file creation
   */
  private async generateCreateDiff(
    operation: DryRunOperation,
    options: DiffOptions
  ): Promise<FileDiffResult> {
    const newContent = operation.data?.contentLength 
      ? this.generateSampleContent(operation.data.contentLength)
      : '';

    const textDiff = this.generateTextDiff('', newContent, options);

    return {
      filePath: operation.target,
      type: 'create',
      textDiff,
    };
  }

  /**
   * Generate diff for file modification
   */
  private async generateModifyDiff(
    operation: DryRunOperation,
    options: DiffOptions
  ): Promise<FileDiffResult> {
    // In a real implementation, we would read the original file
    // For dry run simulation, we'll generate representative content
    const originalContent = this.generateSampleContent(1000);
    const modifiedContent = this.applySimulatedChanges(originalContent, operation);

    const textDiff = this.generateTextDiff(originalContent, modifiedContent, options);

    return {
      filePath: operation.target,
      type: 'modify',
      textDiff,
    };
  }

  /**
   * Generate diff for file deletion
   */
  private async generateDeleteDiff(
    operation: DryRunOperation,
    options: DiffOptions
  ): Promise<FileDiffResult> {
    // Simulate original content
    const originalContent = this.generateSampleContent(800);

    const textDiff = this.generateTextDiff(originalContent, '', options);

    return {
      filePath: operation.target,
      type: 'delete',
      textDiff,
    };
  }

  /**
   * Generate text diff between two strings
   */
  private generateTextDiff(
    original: string,
    modified: string,
    options: DiffOptions
  ): TextDiffResult {
    // Normalize content if options require it
    let normalizedOriginal = original;
    let normalizedModified = modified;

    if (options.ignoreWhitespace) {
      normalizedOriginal = original.replace(/\s+/g, ' ').trim();
      normalizedModified = modified.replace(/\s+/g, ' ').trim();
    }

    if (options.ignoreCase) {
      normalizedOriginal = normalizedOriginal.toLowerCase();
      normalizedModified = normalizedModified.toLowerCase();
    }

    // Split into lines
    const originalLines = normalizedOriginal.split('\n');
    const modifiedLines = normalizedModified.split('\n');

    // Generate diff using LCS algorithm
    const diffLines = this.computeLineDiff(originalLines, modifiedLines, options);

    // Calculate statistics
    const stats = this.calculateDiffStats(diffLines);

    // Generate unified diff format
    const unifiedDiff = this.generateUnifiedDiff(original, modified, diffLines, options);

    // Generate HTML diff format
    const htmlDiff = this.generateHtmlDiff(diffLines, options);

    return {
      original,
      modified,
      lines: diffLines,
      stats,
      unifiedDiff,
      htmlDiff,
    };
  }

  /**
   * Compute line-by-line diff using simplified LCS algorithm
   */
  private computeLineDiff(
    originalLines: string[],
    modifiedLines: string[],
    options: DiffOptions
  ): DiffLine[] {
    const diffLines: DiffLine[] = [];
    
    // Simple diff implementation
    let originalIndex = 0;
    let modifiedIndex = 0;

    while (originalIndex < originalLines.length || modifiedIndex < modifiedLines.length) {
      const originalLine = originalLines[originalIndex];
      const modifiedLine = modifiedLines[modifiedIndex];

      if (originalIndex >= originalLines.length) {
        // Addition at end
        diffLines.push({
          type: 'add',
          newLineNumber: modifiedIndex + 1,
          content: modifiedLine,
          indicator: '+',
          cssClass: 'diff-add',
        });
        modifiedIndex++;
      } else if (modifiedIndex >= modifiedLines.length) {
        // Deletion at end
        diffLines.push({
          type: 'remove',
          originalLineNumber: originalIndex + 1,
          content: originalLine,
          indicator: '-',
          cssClass: 'diff-remove',
        });
        originalIndex++;
      } else if (originalLine === modifiedLine) {
        // Unchanged line
        diffLines.push({
          type: 'context',
          originalLineNumber: originalIndex + 1,
          newLineNumber: modifiedIndex + 1,
          content: originalLine,
          indicator: ' ',
          cssClass: 'diff-context',
        });
        originalIndex++;
        modifiedIndex++;
      } else {
        // Lines differ - check if it's a modification or add/delete
        const similarity = this.calculateLineSimilarity(originalLine, modifiedLine);
        
        if (similarity > options.sensitivity) {
          // Treat as modification
          diffLines.push({
            type: 'remove',
            originalLineNumber: originalIndex + 1,
            content: originalLine,
            indicator: '-',
            cssClass: 'diff-remove',
          });
          diffLines.push({
            type: 'add',
            newLineNumber: modifiedIndex + 1,
            content: modifiedLine,
            indicator: '+',
            cssClass: 'diff-add',
          });
          originalIndex++;
          modifiedIndex++;
        } else {
          // Look ahead to find better match
          const nextOriginalMatch = this.findNextMatch(originalLine, modifiedLines, modifiedIndex + 1);
          const nextModifiedMatch = this.findNextMatch(modifiedLine, originalLines, originalIndex + 1);

          if (nextOriginalMatch !== -1 && (nextModifiedMatch === -1 || nextOriginalMatch < nextModifiedMatch)) {
            // Addition
            diffLines.push({
              type: 'add',
              newLineNumber: modifiedIndex + 1,
              content: modifiedLine,
              indicator: '+',
              cssClass: 'diff-add',
            });
            modifiedIndex++;
          } else {
            // Deletion
            diffLines.push({
              type: 'remove',
              originalLineNumber: originalIndex + 1,
              content: originalLine,
              indicator: '-',
              cssClass: 'diff-remove',
            });
            originalIndex++;
          }
        }
      }
    }

    return this.addContextLines(diffLines, options.contextLines);
  }

  /**
   * Calculate line similarity (0-1)
   */
  private calculateLineSimilarity(line1: string, line2: string): number {
    if (line1 === line2) return 1;
    if (line1.length === 0 || line2.length === 0) return 0;

    // Simple character-based similarity
    const maxLength = Math.max(line1.length, line2.length);
    let matches = 0;

    for (let i = 0; i < Math.min(line1.length, line2.length); i++) {
      if (line1[i] === line2[i]) {
        matches++;
      }
    }

    return matches / maxLength;
  }

  /**
   * Find next matching line
   */
  private findNextMatch(target: string, lines: string[], startIndex: number): number {
    for (let i = startIndex; i < Math.min(lines.length, startIndex + 10); i++) {
      if (lines[i] === target) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Add context lines around changes
   */
  private addContextLines(diffLines: DiffLine[], contextLines: number): DiffLine[] {
    if (contextLines === 0) return diffLines;

    // Mark context lines around changes
    const result: DiffLine[] = [];
    
    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];
      
      if (line.type === 'context') {
        // Check if this context line should be included
        const hasChangeNearby = this.hasChangeInRange(diffLines, i, contextLines);
        
        if (hasChangeNearby) {
          result.push(line);
        } else if (result.length > 0 && this.hasChangeInRange(diffLines, i - contextLines, contextLines)) {
          // Add separator if there's a gap
          if (result[result.length - 1].type !== 'header') {
            result.push({
              type: 'header',
              content: '...',
              indicator: '@',
              cssClass: 'diff-header',
            });
          }
        }
      } else {
        result.push(line);
      }
    }

    return result;
  }

  /**
   * Check if there are changes in the specified range
   */
  private hasChangeInRange(diffLines: DiffLine[], index: number, range: number): boolean {
    const start = Math.max(0, index - range);
    const end = Math.min(diffLines.length, index + range + 1);

    for (let i = start; i < end; i++) {
      if (diffLines[i].type === 'add' || diffLines[i].type === 'remove') {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate diff statistics
   */
  private calculateDiffStats(diffLines: DiffLine[]): TextDiffResult['stats'] {
    let additions = 0;
    let deletions = 0;
    let modifications = 0;

    const changes = new Map<number, { add: boolean; remove: boolean }>();

    for (const line of diffLines) {
      if (line.type === 'add') {
        additions++;
        const lineNum = line.newLineNumber || 0;
        const change = changes.get(lineNum) || { add: false, remove: false };
        change.add = true;
        changes.set(lineNum, change);
      } else if (line.type === 'remove') {
        deletions++;
        const lineNum = line.originalLineNumber || 0;
        const change = changes.get(lineNum) || { add: false, remove: false };
        change.remove = true;
        changes.set(lineNum, change);
      }
    }

    // Count modifications (lines that have both add and remove)
    for (const change of changes.values()) {
      if (change.add && change.remove) {
        modifications++;
        additions--;
        deletions--;
      }
    }

    return {
      additions,
      deletions,
      modifications,
      totalLines: diffLines.filter(l => l.type !== 'header').length,
    };
  }

  /**
   * Generate unified diff format
   */
  private generateUnifiedDiff(
    original: string,
    modified: string,
    diffLines: DiffLine[],
    options: DiffOptions
  ): string {
    const header = [
      '--- original',
      '+++ modified',
      `@@ -1,${original.split('\n').length} +1,${modified.split('\n').length} @@`,
    ];

    const lines = diffLines
      .filter(line => line.type !== 'header')
      .map(line => `${line.indicator}${line.content}`);

    return [...header, ...lines].join('\n');
  }

  /**
   * Generate HTML diff format
   */
  private generateHtmlDiff(diffLines: DiffLine[], options: DiffOptions): string {
    const header = `
<div class="diff-container">
  <style>
    .diff-container { font-family: monospace; font-size: 14px; }
    .diff-line { padding: 2px 5px; white-space: pre-wrap; }
    .diff-add { background-color: #d4edda; color: #155724; }
    .diff-remove { background-color: #f8d7da; color: #721c24; }
    .diff-context { background-color: #f8f9fa; }
    .diff-header { background-color: #e9ecef; font-weight: bold; }
    .line-number { display: inline-block; width: 40px; text-align: right; margin-right: 10px; color: #6c757d; }
  </style>`;

    const lines = diffLines.map(line => {
      const lineNumber = options.showLineNumbers 
        ? `<span class="line-number">${line.originalLineNumber || line.newLineNumber || ''}</span>`
        : '';
      
      return `  <div class="diff-line ${line.cssClass}">${lineNumber}${this.escapeHtml(line.content)}</div>`;
    }).join('\n');

    return `${header}\n${lines}\n</div>`;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const div = document?.createElement('div');
    if (div) {
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Fallback for Node.js environment
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(fileDiffs: FileDiffResult[]): VisualDiffResult['summary'] {
    let filesCreated = 0;
    let filesModified = 0;
    let filesDeleted = 0;
    let filesRenamed = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const fileDiff of fileDiffs) {
      switch (fileDiff.type) {
        case 'create':
          filesCreated++;
          break;
        case 'modify':
          filesModified++;
          break;
        case 'delete':
          filesDeleted++;
          break;
        case 'rename':
          filesRenamed++;
          break;
      }

      if (fileDiff.textDiff) {
        totalAdditions += fileDiff.textDiff.stats.additions;
        totalDeletions += fileDiff.textDiff.stats.deletions;
      }
    }

    return {
      filesCreated,
      filesModified,
      filesDeleted,
      filesRenamed,
      totalChanges: filesCreated + filesModified + filesDeleted + filesRenamed,
      totalAdditions,
      totalDeletions,
    };
  }

  /**
   * Check if operation is a file operation
   */
  private isFileOperation(operation: DryRunOperation): boolean {
    return ['file-write', 'file-modify', 'file-delete'].includes(operation.type);
  }

  /**
   * Get operation type for diff
   */
  private getOperationType(operation: DryRunOperation): FileDiffResult['type'] {
    switch (operation.type) {
      case 'file-write':
        return 'create';
      case 'file-modify':
        return 'modify';
      case 'file-delete':
        return 'delete';
      default:
        return 'modify';
    }
  }

  /**
   * Generate sample content for simulation
   */
  private generateSampleContent(length: number): string {
    const sampleLines = [
      '/* Optimized CSS Output */',
      '.btn { padding: 8px 16px; }',
      '.card { border: 1px solid #ddd; }',
      '.text-primary { color: #007bff; }',
      '.bg-light { background-color: #f8f9fa; }',
      '.m-2 { margin: 0.5rem; }',
      '.p-3 { padding: 1rem; }',
      '.d-flex { display: flex; }',
      '.justify-center { justify-content: center; }',
      '.items-center { align-items: center; }',
    ];

    const lines: string[] = [];
    let currentLength = 0;

    while (currentLength < length && lines.length < 100) {
      const line = sampleLines[Math.floor(Math.random() * sampleLines.length)];
      lines.push(line);
      currentLength += line.length + 1; // +1 for newline
    }

    return lines.join('\n');
  }

  /**
   * Apply simulated changes to content
   */
  private applySimulatedChanges(original: string, operation: DryRunOperation): string {
    const lines = original.split('\n');
    
    // Simulate different types of changes based on operation data
    if (operation.data?.operation === 'scramble') {
      // Simulate class name scrambling
      return lines.map(line => {
        if (line.includes('class') || line.includes('.')) {
          return line.replace(/\.([\w-]+)/g, (match, className) => {
            const scrambled = this.scrambleClassName(className);
            return `.${scrambled}`;
          });
        }
        return line;
      }).join('\n');
    }

    // Default: add/modify some lines
    const modifiedLines = [...lines];
    
    // Add a new line
    modifiedLines.splice(2, 0, '/* Generated by TW-Enigma */');
    
    // Modify an existing line
    if (modifiedLines.length > 3) {
      modifiedLines[3] = modifiedLines[3] + ' /* optimized */';
    }

    return modifiedLines.join('\n');
  }

  /**
   * Scramble class name for simulation
   */
  private scrambleClassName(className: string): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    
    for (let i = 0; i < Math.min(className.length, 6); i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return result;
  }

  /**
   * Update diff options
   */
  updateOptions(options: Partial<DiffOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    this.logger.debug('Updated visual diff options', options);
  }

  /**
   * Get current options
   */
  getOptions(): DiffOptions {
    return { ...this.defaultOptions };
  }
}

/**
 * Global visual diff generator instance
 */
let globalVisualDiffGenerator: VisualDiffGenerator | null = null;

/**
 * Get the global visual diff generator
 */
export function getVisualDiffGenerator(): VisualDiffGenerator {
  if (!globalVisualDiffGenerator) {
    globalVisualDiffGenerator = new VisualDiffGenerator();
  }
  return globalVisualDiffGenerator;
}

/**
 * Create a new visual diff generator
 */
export function createVisualDiffGenerator(options?: Partial<DiffOptions>): VisualDiffGenerator {
  return new VisualDiffGenerator(options);
}

/**
 * Generate visual diff in one step
 */
export async function generateVisualDiff(
  result: DryRunResult,
  options: Partial<DiffOptions> = {}
): Promise<VisualDiffResult> {
  const generator = getVisualDiffGenerator();
  return generator.generateDiff(result, options);
}

export default VisualDiffGenerator;