/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { glob } from 'glob';
import { promises as fs } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { AtomicFileManager } from '../atomicOps/AtomicFileManager';
import { AtomicFileReader } from '../atomicOps/AtomicFileReader';
import { AtomicFileWriter } from '../atomicOps/AtomicFileWriter';
import type { CssFormatter } from '../css/cssFormatter';
import type { CompleteConsolidator } from '../optimization/completeConsolidator';

/**
 * Supported file encoding options
 */
export const FileEncodingSchema = z.enum(['utf8', 'utf16le', 'latin1', 'ascii', 'base64', 'hex']);

export type FileEncoding = z.infer<typeof FileEncodingSchema>;

/**
 * File operation result status
 */
export const FileOperationStatusSchema = z.enum(['success', 'skipped', 'failed', 'rollback']);

export type FileOperationStatus = z.infer<typeof FileOperationStatusSchema>;

/**
 * Backup strategy configuration
 */
export const BackupStrategySchema = z.object({
  enabled: z.boolean().default(true),
  location: z.string().optional(),
  strategy: z.enum(['timestamp', 'versioned', 'simple']).default('timestamp'),
  maxBackups: z.number().min(1).max(100).default(10),
  compression: z.boolean().default(false),
});

export type BackupStrategy = z.infer<typeof BackupStrategySchema>;

/**
 * Output configuration options
 */
export const OutputConfigSchema = z.object({
  directory: z.string().optional(),
  preserveStructure: z.boolean().default(true),
  overwritePolicy: z.enum(['always', 'never', 'prompt', 'newer']).default('always'),
  createDirectories: z.boolean().default(true),
  filePermissions: z.number().optional(),
});

export type OutputConfig = z.infer<typeof OutputConfigSchema>;

/**
 * File processing configuration
 */
export const FileProcessorConfigSchema = z.object({
  // Input configuration
  patterns: z.array(z.string()).min(1),
  exclude: z.array(z.string()).default([]),
  followSymlinks: z.boolean().default(false),

  // Encoding configuration
  defaultEncoding: FileEncodingSchema.default('utf8'),
  detectEncoding: z.boolean().default(true),

  // Output configuration
  output: OutputConfigSchema.default({}),

  // Backup configuration
  backup: BackupStrategySchema.default({ enabled: true }),

  // Processing options
  dryRun: z.boolean().default(false),
  verbose: z.boolean().default(false),
  concurrent: z.boolean().default(true),
  maxConcurrency: z.number().min(1).max(50).default(10),

  // Integration options
  enableOptimization: z.boolean().default(true),
  enableFormatting: z.boolean().default(true),

  // Error handling
  continueOnError: z.boolean().default(false),
  maxErrors: z.number().min(1).default(10),
});

export type FileProcessorConfig = z.infer<typeof FileProcessorConfigSchema>;

/**
 * File processing result for individual files
 */
export interface FileProcessingResult {
  filePath: string;
  status: FileOperationStatus;
  originalSize: number;
  processedSize: number;
  encoding: FileEncoding;
  backup?: string;
  errors: string[];
  warnings: string[];
  processingTime: number;
  modifications: {
    classReplacements: number;
    cssOptimizations: number;
    formattingChanges: number;
  };
}

/**
 * Overall file processing results
 */
export interface FileProcessingResults {
  success: boolean;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  results: FileProcessingResult[];
  totalProcessingTime: number;
  totalOriginalSize: number;
  totalProcessedSize: number;
  globalErrors: string[];
  globalWarnings: string[];
  statistics: {
    averageFileSize: number;
    compressionRatio: number;
    averageProcessingTime: number;
    totalClassReplacements: number;
    totalCssOptimizations: number;
    totalFormattingChanges: number;
  };
}

/**
 * File content manipulation operations
 */
export interface FileContentOperation {
  type: 'replace' | 'insert' | 'delete' | 'append' | 'prepend';
  target: string | RegExp;
  replacement?: string;
  position?: number;
  validate?: (content: string) => boolean;
}

/**
 * In-memory file representation
 */
export interface InMemoryFile {
  path: string;
  originalContent: string;
  currentContent: string;
  encoding: FileEncoding;
  modified: boolean;
  operations: FileContentOperation[];
  metadata: {
    size: number;
    lastModified: Date;
    checksum: string;
  };
}

/**
 * File processing error with context
 */
export class FileProcessingError extends Error {
  public readonly filePath?: string;
  public readonly operation?: string;
  public readonly cause?: Error;

  constructor(message: string, filePath?: string, operation?: string, cause?: Error) {
    super(message);
    this.name = 'FileProcessingError';
    this.filePath = filePath;
    this.operation = operation;
    this.cause = cause;
  }
}

/**
 * Main file processing class
 */
export class FileProcessor {
  private readonly config: FileProcessorConfig;
  private readonly atomicWriter: AtomicFileWriter;
  private readonly atomicReader: AtomicFileReader;
  private readonly atomicManager: AtomicFileManager;
  private readonly inMemoryFiles = new Map<string, InMemoryFile>();
  private consolidator?: CompleteConsolidator;
  private cssFormatter?: CssFormatter;
  private readonly errors: string[] = [];
  private readonly warnings: string[] = [];

  /**
   * Creates a new FileProcessor instance
   */
  constructor(
    config: Partial<FileProcessorConfig>,
    consolidator?: CompleteConsolidator,
    cssFormatter?: CssFormatter
  ) {
    this.config = FileProcessorConfigSchema.parse(config);
    this.atomicWriter = new AtomicFileWriter();
    this.atomicReader = new AtomicFileReader();
    this.atomicManager = new AtomicFileManager();
    this.consolidator = consolidator;
    this.cssFormatter = cssFormatter;

    this.validateConfiguration();
  }

  /**
   * Validates the configuration and throws if invalid
   */
  private validateConfiguration(): void {
    if (this.config.patterns.length === 0) {
      throw new FileProcessingError('At least one file pattern must be specified');
    }

    // Validate output directory if specified
    if (this.config.output.directory) {
      const outputDir = resolve(this.config.output.directory);
      if (!outputDir || outputDir === '/') {
        throw new FileProcessingError('Invalid output directory specified');
      }
    }

    // Validate backup location if specified
    if (this.config.backup.enabled && this.config.backup.location) {
      const backupDir = resolve(this.config.backup.location);
      if (!backupDir || backupDir === '/') {
        throw new FileProcessingError('Invalid backup directory specified');
      }
    }
  }

  /**
   * Gets the current configuration
   */
  public getConfig(): Readonly<FileProcessorConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Updates the configuration with new options
   */
  public updateConfig(updates: Partial<FileProcessorConfig>): void {
    const newConfig = { ...this.config, ...updates };
    const validated = FileProcessorConfigSchema.parse(newConfig);
    Object.assign(this.config, validated);
    this.validateConfiguration();
  }

  /**
   * Sets the consolidator for optimization operations
   */
  public setConsolidator(consolidator: CompleteConsolidator): void {
    this.consolidator = consolidator;
  }

  /**
   * Sets the CSS formatter for formatting operations
   */
  public setCssFormatter(formatter: CssFormatter): void {
    this.cssFormatter = formatter;
  }

  /**
   * Discovers files matching the configured patterns
   */
  public async discoverFiles(): Promise<string[]> {
    const startTime = Date.now();
    const allFiles = new Set<string>();

    try {
      // Process each pattern
      for (const pattern of this.config.patterns) {
        const files = await glob(pattern, {
          ignore: this.config.exclude,
          followSymbolicLinks: this.config.followSymlinks,
          absolute: true,
          nodir: true,
        });

        files.forEach((file) => allFiles.add(file));
      }

      const discoveredFiles = Array.from(allFiles).sort();

      if (this.config.verbose) {
        const duration = Date.now() - startTime;
        console.log(`Discovered ${discoveredFiles.length} files in ${duration}ms`);
      }

      return discoveredFiles;
    } catch (error) {
      const message = `Failed to discover files: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(message);
      throw new FileProcessingError(
        message,
        undefined,
        'discovery',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Loads files into memory for processing
   */
  public async loadFiles(filePaths: string[]): Promise<void> {
    const startTime = Date.now();
    const loadPromises = filePaths.map((filePath) => this.loadSingleFile(filePath));

    if (this.config.concurrent) {
      // Process files concurrently with limit
      const chunks = this.chunkArray(loadPromises, this.config.maxConcurrency);
      for (const chunk of chunks) {
        await Promise.allSettled(chunk);
      }
    } else {
      // Process files sequentially
      for (const promise of loadPromises) {
        await promise.catch(() => {}); // Errors are handled in loadSingleFile
      }
    }

    if (this.config.verbose) {
      const duration = Date.now() - startTime;
      const loaded = this.inMemoryFiles.size;
      console.log(`Loaded ${loaded} files into memory in ${duration}ms`);
    }
  }

  /**
   * Loads a single file into memory
   */
  private async loadSingleFile(filePath: string): Promise<void> {
    try {
      const absolutePath = resolve(filePath);
      const stats = await fs.stat(absolutePath);

      if (!stats.isFile()) {
        this.warnings.push(`Skipping non-file: ${filePath}`);
        return;
      }

      // Detect or use default encoding
      const encoding = this.config.detectEncoding
        ? await this.detectFileEncoding(absolutePath)
        : this.config.defaultEncoding;

      // Read file content
      const result = await this.atomicReader.readFile(absolutePath, { encoding });

      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to read file content');
      }

      // Create in-memory representation
      const inMemoryFile: InMemoryFile = {
        path: absolutePath,
        originalContent: result.content,
        currentContent: result.content,
        encoding,
        modified: false,
        operations: [],
        metadata: {
          size: stats.size,
          lastModified: stats.mtime,
          checksum: this.calculateChecksum(result.content),
        },
      };

      this.inMemoryFiles.set(absolutePath, inMemoryFile);
    } catch (error) {
      const message = `Failed to load file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(message);
      if (!this.config.continueOnError) {
        throw new FileProcessingError(
          message,
          filePath,
          'load',
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  /**
   * Applies content operations to a file in memory
   */
  public applyOperation(filePath: string, operation: FileContentOperation): boolean {
    const file = this.inMemoryFiles.get(resolve(filePath));
    if (!file) {
      this.errors.push(`File not loaded in memory: ${filePath}`);
      return false;
    }

    try {
      let newContent = file.currentContent;

      switch (operation.type) {
        case 'replace':
          if (typeof operation.target === 'string') {
            newContent = newContent.replace(
              new RegExp(this.escapeRegex(operation.target), 'g'),
              operation.replacement || ''
            );
          } else {
            newContent = newContent.replace(operation.target, operation.replacement || '');
          }
          break;

        case 'insert':
          if (operation.position !== undefined) {
            const pos = Math.max(0, Math.min(operation.position, newContent.length));
            newContent =
              newContent.slice(0, pos) + (operation.replacement || '') + newContent.slice(pos);
          }
          break;

        case 'delete':
          if (typeof operation.target === 'string') {
            newContent = newContent.replace(
              new RegExp(this.escapeRegex(operation.target), 'g'),
              ''
            );
          } else {
            newContent = newContent.replace(operation.target, '');
          }
          break;

        case 'append':
          newContent = newContent + (operation.replacement || '');
          break;

        case 'prepend':
          newContent = (operation.replacement || '') + newContent;
          break;

        default:
          this.errors.push(`Unknown operation type: ${operation.type}`);
          return false;
      }

      // Validate the result if validation function provided
      if (operation.validate && !operation.validate(newContent)) {
        this.errors.push(`Operation validation failed for ${filePath}`);
        return false;
      }

      // Update file content
      file.currentContent = newContent;
      file.modified = file.currentContent !== file.originalContent;
      file.operations.push(operation);

      return true;
    } catch (error) {
      const message = `Failed to apply operation to ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(message);
      return false;
    }
  }

  /**
   * Processes all loaded files with consolidation and formatting
   */
  public async processFiles(): Promise<FileProcessingResults> {
    const startTime = Date.now();
    const results: FileProcessingResult[] = [];

    try {
      // Process consolidation if enabled and consolidator available
      if (this.config.enableOptimization && this.consolidator) {
        await this.applyConsolidation();
      }

      // Process formatting if enabled and formatter available
      if (this.config.enableFormatting && this.cssFormatter) {
        await this.applyFormatting();
      }

      // Process each file
      const filePaths = Array.from(this.inMemoryFiles.keys());
      for (const filePath of filePaths) {
        const result = await this.processSingleFile(filePath);
        results.push(result);

        // Check error limit
        if (this.errors.length >= this.config.maxErrors) {
          this.errors.push(
            `Maximum error limit (${this.config.maxErrors}) reached, stopping processing`
          );
          break;
        }
      }

      // Calculate statistics
      const statistics = this.calculateStatistics(results);
      const totalProcessingTime = Date.now() - startTime;

      return {
        success: this.errors.length === 0,
        totalFiles: this.inMemoryFiles.size,
        processedFiles: results.filter((r) => r.status === 'success').length,
        skippedFiles: results.filter((r) => r.status === 'skipped').length,
        failedFiles: results.filter((r) => r.status === 'failed').length,
        results,
        totalProcessingTime,
        totalOriginalSize: results.reduce((sum, r) => sum + r.originalSize, 0),
        totalProcessedSize: results.reduce((sum, r) => sum + r.processedSize, 0),
        globalErrors: [...this.errors],
        globalWarnings: [...this.warnings],
        statistics,
      };
    } catch (error) {
      const message = `Processing failed: ${error instanceof Error ? error.message : String(error)}`;
      this.errors.push(message);
      throw new FileProcessingError(
        message,
        undefined,
        'process',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Processes a single file
   */
  private async processSingleFile(filePath: string): Promise<FileProcessingResult> {
    const startTime = Date.now();
    const file = this.inMemoryFiles.get(filePath);

    if (!file) {
      return {
        filePath,
        status: 'failed',
        originalSize: 0,
        processedSize: 0,
        encoding: 'utf8',
        errors: ['File not found in memory'],
        warnings: [],
        processingTime: 0,
        modifications: {
          classReplacements: 0,
          cssOptimizations: 0,
          formattingChanges: 0,
        },
      };
    }

    const result: FileProcessingResult = {
      filePath,
      status: 'success',
      originalSize: file.metadata.size,
      processedSize: Buffer.byteLength(file.currentContent, file.encoding),
      encoding: file.encoding,
      errors: [],
      warnings: [],
      processingTime: 0,
      modifications: {
        classReplacements: file.operations.filter((op) => op.type === 'replace').length,
        cssOptimizations: 0,
        formattingChanges: 0,
      },
    };

    try {
      // Skip if not modified and not in dry run
      if (!file.modified && !this.config.dryRun) {
        result.status = 'skipped';
        result.warnings.push('File not modified, skipping write');
        return result;
      }

      // Create backup if enabled
      if (this.config.backup.enabled && file.modified) {
        result.backup = await this.createBackup(filePath);
      }

      // Write file if not in dry run mode
      if (!this.config.dryRun && file.modified) {
        await this.writeFile(filePath, file);
      } else if (this.config.dryRun) {
        result.warnings.push('Dry run mode - no files written');
      }
    } catch (error) {
      result.status = 'failed';
      result.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      result.processingTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Applies consolidation to loaded files
   */
  private async applyConsolidation(): Promise<void> {
    if (!this.consolidator) return;

    try {
      // Prepare input for consolidator
      const input = {
        htmlFiles: Array.from(this.inMemoryFiles.keys()).filter((f) => this.isHtmlFile(f)),
        jsxFiles: Array.from(this.inMemoryFiles.keys()).filter((f) => this.isJsxFile(f)),
      };

      // Run consolidation
      const consolidationResult = await this.consolidator.consolidate(input);

      // Apply modifications
      for (const modification of consolidationResult.fileModifications) {
        const file = this.inMemoryFiles.get(modification.filePath);
        if (file) {
          file.currentContent = modification.modifiedContent;
          file.modified = true;

          // Add replacement operations
          for (const replacement of modification.replacements) {
            file.operations.push({
              type: 'replace',
              target: replacement.original,
              replacement: replacement.replacement,
            });
          }
        }
      }
    } catch (error) {
      this.errors.push(
        `Consolidation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Applies CSS formatting to loaded files
   */
  private async applyFormatting(): Promise<void> {
    if (!this.cssFormatter) return;

    try {
      for (const [filePath, file] of this.inMemoryFiles) {
        if (this.isCssFile(filePath)) {
          const formatted = await this.cssFormatter.format(file.currentContent);
          if (formatted !== file.currentContent) {
            file.currentContent = formatted;
            file.modified = true;
            file.operations.push({
              type: 'replace',
              target: file.originalContent,
              replacement: formatted,
            });
          }
        }
      }
    } catch (error) {
      this.errors.push(
        `Formatting failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Creates a backup of the original file
   */
  private async createBackup(filePath: string): Promise<string> {
    const file = this.inMemoryFiles.get(filePath);
    if (!file) {
      throw new Error(`File not found for backup: ${filePath}`);
    }

    try {
      const backupDir = this.config.backup.location || join(dirname(filePath), '.backup');
      const fileName = basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      let backupName: string;
      switch (this.config.backup.strategy) {
        case 'timestamp':
          backupName = `${fileName}.${timestamp}.backup`;
          break;
        case 'versioned':
          backupName = await this.getVersionedBackupName(backupDir, fileName);
          break;
        case 'simple':
        default:
          backupName = `${fileName}.backup`;
          break;
      }

      const backupPath = join(backupDir, backupName);

      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Write backup
      const writeResult = await this.atomicWriter.writeFile(backupPath, file.originalContent, {
        encoding: file.encoding,
      });

      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to create backup');
      }

      // Clean up old backups if needed
      await this.cleanupOldBackups(backupDir, fileName);

      return backupPath;
    } catch (error) {
      throw new FileProcessingError(
        `Failed to create backup for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'backup',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Writes a file using atomic operations
   */
  private async writeFile(filePath: string, file: InMemoryFile): Promise<void> {
    try {
      // Determine output path
      const outputPath = this.getOutputPath(filePath);

      // Ensure output directory exists
      if (this.config.output.createDirectories) {
        await fs.mkdir(dirname(outputPath), { recursive: true });
      }

      // Check overwrite policy
      if (await this.shouldSkipWrite(outputPath)) {
        this.warnings.push(`Skipping write due to overwrite policy: ${outputPath}`);
        return;
      }

      // Write file atomically
      const writeResult = await this.atomicWriter.writeFile(outputPath, file.currentContent, {
        encoding: file.encoding,
        mode: this.config.output.filePermissions,
      });

      if (!writeResult.success) {
        throw new Error(writeResult.error || 'Failed to write file');
      }
    } catch (error) {
      throw new FileProcessingError(
        `Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        'write',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Utility methods for file type detection
   */
  private isHtmlFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return ['.html', '.htm'].includes(ext);
  }

  private isJsxFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return ['.jsx', '.tsx', '.js', '.ts'].includes(ext);
  }

  private isCssFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return ['.css', '.scss', '.sass', '.less'].includes(ext);
  }

  /**
   * Detects file encoding (simplified implementation)
   */
  private async detectFileEncoding(filePath: string): Promise<FileEncoding> {
    try {
      // Read first few bytes to detect BOM or encoding patterns
      const buffer = await fs.readFile(filePath, { flag: 'r' });

      // Check for UTF-16 LE BOM
      if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        return 'utf16le';
      }

      // Default to UTF-8 for text files
      return 'utf8';
    } catch {
      return this.config.defaultEncoding;
    }
  }

  /**
   * Calculates content checksum
   */
  private calculateChecksum(content: string): string {
    // Simple hash implementation for content verification
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Escapes regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Chunks array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Gets the output path for a file
   */
  private getOutputPath(inputPath: string): string {
    if (!this.config.output.directory) {
      return inputPath;
    }

    if (this.config.output.preserveStructure) {
      const relativePath = relative(process.cwd(), inputPath);
      return join(this.config.output.directory, relativePath);
    } else {
      return join(this.config.output.directory, basename(inputPath));
    }
  }

  /**
   * Checks if a write should be skipped based on overwrite policy
   */
  private async shouldSkipWrite(outputPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(outputPath);

      switch (this.config.output.overwritePolicy) {
        case 'never':
          return true;
        case 'newer':
          const file = this.inMemoryFiles.get(outputPath);
          return file ? stats.mtime > file.metadata.lastModified : false;
        case 'prompt':
          // In automated context, default to not overwrite
          return true;
        case 'always':
        default:
          return false;
      }
    } catch {
      // File doesn't exist, so we can write
      return false;
    }
  }

  /**
   * Gets a versioned backup name
   */
  private async getVersionedBackupName(backupDir: string, fileName: string): Promise<string> {
    try {
      const files = await fs.readdir(backupDir);
      const backupPattern = new RegExp(`^${this.escapeRegex(fileName)}\\.v(\\d+)\\.backup$`);

      let maxVersion = 0;
      for (const file of files) {
        const match = file.match(backupPattern);
        if (match) {
          maxVersion = Math.max(maxVersion, parseInt(match[1], 10));
        }
      }

      return `${fileName}.v${maxVersion + 1}.backup`;
    } catch {
      return `${fileName}.v1.backup`;
    }
  }

  /**
   * Cleans up old backups based on retention policy
   */
  private async cleanupOldBackups(backupDir: string, fileName: string): Promise<void> {
    if (this.config.backup.maxBackups <= 0) return;

    try {
      const files = await fs.readdir(backupDir);
      const backupPattern = new RegExp(`^${this.escapeRegex(fileName)}\\.(.*)\\.backup$`);

      const backupFiles = files
        .filter((file) => backupPattern.test(file))
        .map((file) => join(backupDir, file))
        .sort(async (a, b) => {
          const statsA = await fs.stat(a);
          const statsB = await fs.stat(b);
          return statsB.mtime.getTime() - statsA.mtime.getTime();
        });

      // Remove excess backups
      const toDelete = backupFiles.slice(this.config.backup.maxBackups);
      for (const backupFile of toDelete) {
        await fs.unlink(backupFile);
      }
    } catch (error) {
      this.warnings.push(
        `Failed to cleanup old backups: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Calculates processing statistics
   */
  private calculateStatistics(
    results: FileProcessingResult[]
  ): FileProcessingResults['statistics'] {
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalProcessedSize = results.reduce((sum, r) => sum + r.processedSize, 0);
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const totalClassReplacements = results.reduce(
      (sum, r) => sum + r.modifications.classReplacements,
      0
    );
    const totalCssOptimizations = results.reduce(
      (sum, r) => sum + r.modifications.cssOptimizations,
      0
    );
    const totalFormattingChanges = results.reduce(
      (sum, r) => sum + r.modifications.formattingChanges,
      0
    );

    return {
      averageFileSize: results.length > 0 ? totalOriginalSize / results.length : 0,
      compressionRatio: totalOriginalSize > 0 ? totalProcessedSize / totalOriginalSize : 1,
      averageProcessingTime: results.length > 0 ? totalProcessingTime / results.length : 0,
      totalClassReplacements,
      totalCssOptimizations,
      totalFormattingChanges,
    };
  }

  /**
   * Clears all in-memory files and resets state
   */
  public clear(): void {
    this.inMemoryFiles.clear();
    this.errors.length = 0;
    this.warnings.length = 0;
  }

  /**
   * Gets current processing statistics
   */
  public getStatistics(): {
    loadedFiles: number;
    modifiedFiles: number;
    totalErrors: number;
    totalWarnings: number;
    memoryUsage: number;
  } {
    const modifiedFiles = Array.from(this.inMemoryFiles.values()).filter((f) => f.modified).length;
    const memoryUsage = Array.from(this.inMemoryFiles.values()).reduce(
      (sum, f) => sum + Buffer.byteLength(f.currentContent, f.encoding),
      0
    );

    return {
      loadedFiles: this.inMemoryFiles.size,
      modifiedFiles,
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      memoryUsage,
    };
  }
}

/**
 * Factory function for creating FileProcessor instances
 */
export function createFileProcessor(
  config: Partial<FileProcessorConfig>,
  consolidator?: CompleteConsolidator,
  cssFormatter?: CssFormatter
): FileProcessor {
  return new FileProcessor(config, consolidator, cssFormatter);
}

/**
 * Convenience function for quick file processing
 */
export async function processFiles(
  patterns: string[],
  config: Partial<FileProcessorConfig> = {},
  consolidator?: CompleteConsolidator,
  cssFormatter?: CssFormatter
): Promise<FileProcessingResults> {
  const processor = createFileProcessor({ ...config, patterns }, consolidator, cssFormatter);

  const files = await processor.discoverFiles();
  await processor.loadFiles(files);
  return processor.processFiles();
}
