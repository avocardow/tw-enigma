/**
 * Enhanced Discovery Engine for TW-Enigma Pattern Re-Analysis System
 *
 * Extends existing file discovery capabilities with advanced features:
 * - Incremental discovery with change detection
 * - Checksum-based file tracking
 * - Language-specific parsing integration
 * - Metadata collection and persistence
 * - Recursive directory scanning with error handling
 * - Dynamic and static analysis support
 */

import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { FrameworkDetector } from '../frameworkDetector';
import { createHtmlExtractor } from '../processors/htmlExtractor';
import { createJsExtractor } from '../processors/jsExtractor';
import {
  discoverFiles,
  FileDiscoveryError,
  FileDiscoveryOptions,
  FileDiscoveryResult,
} from '../utils/fileDiscovery';

// Enhanced Discovery Configuration Schema
export const EnhancedDiscoveryConfigSchema = z.object({
  /** Base directory for discovery operations */
  rootPath: z.string().default(process.cwd()),
  /** File patterns to include in discovery */
  includePatterns: z.array(z.string()).default(['src/**/*.{html,htm,js,jsx,ts,tsx,vue,svelte}']),
  /** Patterns to exclude from discovery */
  excludePatterns: z
    .array(z.string())
    .default(['node_modules/**', '.git/**', 'dist/**', 'build/**']),
  /** Maximum recursion depth for directory scanning */
  maxDepth: z.number().default(10),
  /** Maximum number of files to process */
  maxFiles: z.number().optional(),
  /** Enable checksum-based change detection */
  enableChecksums: z.boolean().default(true),
  /** Enable metadata collection and persistence */
  enableMetadata: z.boolean().default(true),
  /** Enable language-specific parsing */
  enableLanguageParsing: z.boolean().default(true),
  /** Enable framework detection */
  enableFrameworkDetection: z.boolean().default(true),
  /** Enable incremental discovery (only process changed files) */
  enableIncremental: z.boolean().default(true),
  /** Directory for storing discovery state */
  stateDirectory: z.string().default('.tw-enigma/discovery'),
  /** Enable verbose logging */
  verbose: z.boolean().default(false),
  /** Timeout for individual file processing (ms) */
  fileTimeout: z.number().default(5000),
  /** Maximum file size to process (bytes) */
  maxFileSize: z.number().default(1024 * 1024), // 1MB
  /** Enable binary file detection and skipping */
  skipBinaryFiles: z.boolean().default(true),
  /** Custom file type extensions */
  customExtensions: z.record(z.array(z.string())).default({}),
});

export type EnhancedDiscoveryConfig = z.infer<typeof EnhancedDiscoveryConfigSchema>;

// File Entity Schema for tracking discovered files
export const FileEntitySchema = z.object({
  /** Absolute file path */
  filePath: z.string(),
  /** Relative path from root */
  relativePath: z.string(),
  /** File extension */
  extension: z.string(),
  /** Detected file type */
  fileType: z.enum(['html', 'javascript', 'typescript', 'vue', 'svelte', 'css', 'json', 'other']),
  /** File size in bytes */
  size: z.number(),
  /** Last modified timestamp */
  lastModified: z.number(),
  /** SHA-256 checksum of file content */
  checksum: z.string(),
  /** Detected programming language */
  language: z.string().optional(),
  /** Detected framework (if any) */
  framework: z.string().optional(),
  /** Custom metadata */
  metadata: z.record(z.any()).default({}),
  /** Processing timestamp */
  discoveredAt: z.number(),
  /** Processing errors (if any) */
  errors: z.array(z.string()).default([]),
});

export type FileEntity = z.infer<typeof FileEntitySchema>;

// Discovery Result Schema
export const EnhancedDiscoveryResultSchema = z.object({
  /** All discovered file entities */
  entities: z.array(FileEntitySchema),
  /** Summary statistics */
  stats: z.object({
    totalFiles: z.number(),
    newFiles: z.number(),
    changedFiles: z.number(),
    unchangedFiles: z.number(),
    errorFiles: z.number(),
    byType: z.record(z.number()),
    byFramework: z.record(z.number()),
    processingTime: z.number(),
  }),
  /** Framework detection results */
  frameworks: z.array(z.any()).default([]),
  /** Discovery metadata */
  metadata: z.object({
    rootPath: z.string(),
    scanTime: z.number(),
    configUsed: z.any(),
    totalDirectories: z.number(),
    skippedFiles: z.number(),
  }),
  /** Incremental discovery state */
  incrementalState: z
    .object({
      previousScanTime: z.number().optional(),
      changedDirectories: z.array(z.string()).default([]),
      deletedFiles: z.array(z.string()).default([]),
    })
    .optional(),
});

export type EnhancedDiscoveryResult = z.infer<typeof EnhancedDiscoveryResultSchema>;

// Discovery State Schema for persistence
export const DiscoveryStateSchema = z.object({
  version: z.string().default('1.0.0'),
  lastScan: z.number(),
  rootPath: z.string(),
  entities: z.record(FileEntitySchema), // Keyed by relative path
  frameworks: z.array(z.any()).default([]),
  config: z.any(),
});

export type DiscoveryState = z.infer<typeof DiscoveryStateSchema>;

/**
 * Enhanced Discovery Engine Class
 */
export class EnhancedDiscovery {
  private config: EnhancedDiscoveryConfig;
  private state: DiscoveryState | null = null;
  private frameworkDetector: FrameworkDetector | null = null;
  private htmlExtractor: any = null;
  private jsExtractor: any = null;

  constructor(config: Partial<EnhancedDiscoveryConfig> = {}) {
    this.config = EnhancedDiscoveryConfigSchema.parse(config);

    if (this.config.enableFrameworkDetection) {
      this.frameworkDetector = new FrameworkDetector({
        rootPath: this.config.rootPath,
        enableCaching: true,
      });
    }

    if (this.config.enableLanguageParsing) {
      this.htmlExtractor = createHtmlExtractor({
        caseSensitive: false,
        maxFileSize: this.config.maxFileSize,
        timeout: this.config.fileTimeout,
      });

      this.jsExtractor = createJsExtractor({
        caseSensitive: false,
        maxFileSize: this.config.maxFileSize,
        timeout: this.config.fileTimeout,
        enableFrameworkDetection: true,
        includeDynamicClasses: true,
      });
    }
  }

  /**
   * Perform comprehensive discovery operation
   */
  async discover(): Promise<EnhancedDiscoveryResult> {
    const startTime = Date.now();

    try {
      // Load previous state if incremental discovery is enabled
      if (this.config.enableIncremental) {
        await this.loadPreviousState();
      }

      // Ensure state directory exists
      await this.ensureStateDirectory();

      // Perform file discovery
      const discoveryResult = await this.performFileDiscovery();

      // Process discovered files
      const entities = await this.processDiscoveredFiles(discoveryResult.files);

      // Detect frameworks if enabled
      let frameworks: DetectionResult | null = null;
      if (this.config.enableFrameworkDetection && this.frameworkDetector) {
        try {
          frameworks = await this.frameworkDetector.detect();
        } catch (error) {
          if (this.config.verbose) {
            console.warn('Framework detection failed:', error);
          }
        }
      }

      // Calculate statistics
      const stats = this.calculateStatistics(entities, startTime);

      // Build result
      const result: EnhancedDiscoveryResult = {
        entities,
        stats,
        frameworks,
        metadata: {
          rootPath: this.config.rootPath,
          scanTime: Date.now(),
          configUsed: this.config,
          totalDirectories: await this.countDirectories(),
          skippedFiles: 0, // Will be updated during processing
        },
        incrementalState: this.config.enableIncremental
          ? {
              previousScanTime: this.state?.lastScan,
              changedDirectories: [],
              deletedFiles: [],
            }
          : undefined,
      };

      // Save state for future incremental discoveries
      if (this.config.enableIncremental) {
        await this.saveState(result);
      }

      return result;
    } catch (error) {
      throw new FileDiscoveryError(
        `Enhanced discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        'ENHANCED_DISCOVERY_ERROR',
        this.config.includePatterns,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Perform incremental discovery (only changed files)
   */
  async discoverIncremental(): Promise<EnhancedDiscoveryResult> {
    if (!this.config.enableIncremental) {
      return this.discover();
    }

    const startTime = Date.now();

    try {
      // Load previous state
      await this.loadPreviousState();

      if (!this.state) {
        // No previous state, perform full discovery
        return this.discover();
      }

      // Find changed and new files
      const discoveryResult = await this.performFileDiscovery();
      const changedFiles = await this.identifyChangedFiles(discoveryResult.files);

      // Process only changed files
      const entities = await this.processDiscoveredFiles(changedFiles);

      // Merge with existing entities
      const mergedEntities = this.mergeWithExistingEntities(entities);

      // Calculate statistics
      const stats = this.calculateStatistics(mergedEntities, startTime);

      const result: EnhancedDiscoveryResult = {
        entities: mergedEntities,
        stats,
        frameworks: this.state.frameworks,
        metadata: {
          rootPath: this.config.rootPath,
          scanTime: Date.now(),
          configUsed: this.config,
          totalDirectories: await this.countDirectories(),
          skippedFiles: 0,
        },
        incrementalState: {
          previousScanTime: this.state.lastScan,
          changedDirectories: [],
          deletedFiles: [],
        },
      };

      // Save updated state
      await this.saveState(result);

      return result;
    } catch (error) {
      // Fallback to full discovery on incremental failure
      if (this.config.verbose) {
        console.warn('Incremental discovery failed, falling back to full discovery:', error);
      }
      return this.discover();
    }
  }

  /**
   * Discover files with specific patterns
   */
  async discoverWithPatterns(patterns: string[]): Promise<FileEntity[]> {
    const tempConfig = { ...this.config, includePatterns: patterns };
    const discoveryOptions: FileDiscoveryOptions = {
      patterns: tempConfig.includePatterns,
      cwd: tempConfig.rootPath,
      excludePatterns: tempConfig.excludePatterns,
      maxFiles: tempConfig.maxFiles,
      absolutePaths: true,
    };

    const discoveryResult = await discoverFiles(discoveryOptions);
    return this.processDiscoveredFiles(discoveryResult.files);
  }

  /**
   * Get entity by file path
   */
  async getEntity(filePath: string): Promise<FileEntity | null> {
    const absolutePath = path.resolve(this.config.rootPath, filePath);

    try {
      const entity = await this.createFileEntity(absolutePath);
      return entity;
    } catch {
      return null;
    }
  }

  /**
   * Check if file has changed since last scan
   */
  async hasFileChanged(filePath: string): Promise<boolean> {
    if (!this.state) {
      return true; // No previous state, consider changed
    }

    const relativePath = path.relative(this.config.rootPath, filePath);
    const previousEntity = this.state.entities[relativePath];

    if (!previousEntity) {
      return true; // New file
    }

    try {
      const stats = await fs.stat(filePath);
      const currentChecksum = await this.calculateChecksum(filePath);

      return (
        stats.mtime.getTime() !== previousEntity.lastModified ||
        currentChecksum !== previousEntity.checksum
      );
    } catch {
      return true; // Error accessing file, consider changed
    }
  }

  /**
   * Perform basic file discovery using existing utilities
   */
  private async performFileDiscovery(): Promise<FileDiscoveryResult> {
    const discoveryOptions: FileDiscoveryOptions = {
      patterns: this.config.includePatterns,
      cwd: this.config.rootPath,
      excludePatterns: this.config.excludePatterns,
      maxFiles: this.config.maxFiles,
      absolutePaths: true,
    };

    return discoverFiles(discoveryOptions);
  }

  /**
   * Process discovered files and create entities
   */
  private async processDiscoveredFiles(filePaths: string[]): Promise<FileEntity[]> {
    const entities: FileEntity[] = [];
    let processedCount = 0;

    for (const filePath of filePaths) {
      try {
        // Skip binary files if configured
        if (this.config.skipBinaryFiles && (await this.isBinaryFile(filePath))) {
          continue;
        }

        const entity = await this.createFileEntity(filePath);
        entities.push(entity);
        processedCount++;

        if (this.config.verbose && processedCount % 100 === 0) {
          console.log(`Processed ${processedCount}/${filePaths.length} files...`);
        }
      } catch (error) {
        if (this.config.verbose) {
          console.warn(`Failed to process file ${filePath}:`, error);
        }

        // Create error entity
        const errorEntity = await this.createErrorEntity(filePath, error);
        entities.push(errorEntity);
      }
    }

    return entities;
  }

  /**
   * Create file entity with full metadata
   */
  private async createFileEntity(filePath: string): Promise<FileEntity> {
    const stats = await fs.stat(filePath);
    const relativePath = path.relative(this.config.rootPath, filePath);
    const extension = path.extname(filePath).toLowerCase();

    const entity: FileEntity = {
      filePath,
      relativePath,
      extension,
      fileType: this.determineFileType(extension),
      size: stats.size,
      lastModified: stats.mtime.getTime(),
      checksum: this.config.enableChecksums ? await this.calculateChecksum(filePath) : '',
      discoveredAt: Date.now(),
      metadata: {},
      errors: [],
    };

    // Add language-specific analysis if enabled
    if (this.config.enableLanguageParsing) {
      try {
        await this.analyzeFileContent(entity);
      } catch (error) {
        entity.errors.push(
          `Content analysis failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return entity;
  }

  /**
   * Create error entity for failed file processing
   */
  private async createErrorEntity(filePath: string, error: unknown): Promise<FileEntity> {
    const relativePath = path.relative(this.config.rootPath, filePath);
    const extension = path.extname(filePath).toLowerCase();

    try {
      const stats = await fs.stat(filePath);
      return {
        filePath,
        relativePath,
        extension,
        fileType: this.determineFileType(extension),
        size: stats.size,
        lastModified: stats.mtime.getTime(),
        checksum: '',
        discoveredAt: Date.now(),
        metadata: {},
        errors: [error instanceof Error ? error.message : String(error)],
      };
    } catch {
      // Even stat failed
      return {
        filePath,
        relativePath,
        extension,
        fileType: 'other',
        size: 0,
        lastModified: 0,
        checksum: '',
        discoveredAt: Date.now(),
        metadata: {},
        errors: ['Failed to access file', error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Analyze file content based on file type
   */
  private async analyzeFileContent(entity: FileEntity): Promise<void> {
    if (!this.htmlExtractor || !this.jsExtractor) {
      return;
    }

    try {
      switch (entity.fileType) {
        case 'html':
          if (this.htmlExtractor) {
            const result = await this.htmlExtractor.extractFromFile(entity.filePath);
            entity.metadata.htmlAnalysis = {
              classCount: result.classes.size,
              totalElements: result.totalClasses,
              processingTime: result.metadata.processingTime,
            };
          }
          break;

        case 'javascript':
        case 'typescript':
          if (this.jsExtractor) {
            const result = await this.jsExtractor.extractFromFile(entity.filePath);
            entity.metadata.jsAnalysis = {
              classCount: result.classes.size,
              framework: result.framework,
              staticMatches: result.metadata.extractionStats?.staticMatches || 0,
              dynamicMatches: result.metadata.extractionStats?.dynamicMatches || 0,
              processingTime: result.metadata.processingTime,
            };
            entity.framework = result.framework;
          }
          break;
      }
    } catch (error) {
      entity.errors.push(
        `Content analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Calculate SHA-256 checksum of file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      throw new Error(
        `Failed to calculate checksum for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Determine file type from extension
   */
  private determineFileType(extension: string): FileEntity['fileType'] {
    const ext = extension.toLowerCase();

    if (['.html', '.htm', '.xhtml'].includes(ext)) return 'html';
    if (['.js', '.jsx', '.mjs'].includes(ext)) return 'javascript';
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (['.vue'].includes(ext)) return 'vue';
    if (['.svelte'].includes(ext)) return 'svelte';
    if (['.css', '.scss', '.sass', '.less'].includes(ext)) return 'css';
    if (['.json'].includes(ext)) return 'json';

    // Check custom extensions
    for (const [type, extensions] of Object.entries(this.config.customExtensions)) {
      if (extensions.includes(ext)) {
        return type as FileEntity['fileType'];
      }
    }

    return 'other';
  }

  /**
   * Check if file is binary
   */
  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath, { encoding: null });

      // Check for null bytes in first 8000 bytes
      const sampleSize = Math.min(8000, buffer.length);
      for (let i = 0; i < sampleSize; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }

      return false;
    } catch {
      return true; // Assume binary if can't read
    }
  }

  /**
   * Identify changed files for incremental discovery
   */
  private async identifyChangedFiles(allFiles: string[]): Promise<string[]> {
    if (!this.state) {
      return allFiles;
    }

    const changedFiles: string[] = [];

    for (const filePath of allFiles) {
      if (await this.hasFileChanged(filePath)) {
        changedFiles.push(filePath);
      }
    }

    return changedFiles;
  }

  /**
   * Merge new entities with existing ones
   */
  private mergeWithExistingEntities(newEntities: FileEntity[]): FileEntity[] {
    if (!this.state) {
      return newEntities;
    }

    const merged = new Map<string, FileEntity>();

    // Add existing entities
    for (const entity of Object.values(this.state.entities)) {
      merged.set(entity.relativePath, entity);
    }

    // Override with new entities
    for (const entity of newEntities) {
      merged.set(entity.relativePath, entity);
    }

    return Array.from(merged.values());
  }

  /**
   * Calculate discovery statistics
   */
  private calculateStatistics(entities: FileEntity[], startTime: number) {
    const stats = {
      totalFiles: entities.length,
      newFiles: 0,
      changedFiles: 0,
      unchangedFiles: 0,
      errorFiles: 0,
      byType: {} as Record<string, number>,
      byFramework: {} as Record<string, number>,
      processingTime: Date.now() - startTime,
    };

    for (const entity of entities) {
      // Count by type
      stats.byType[entity.fileType] = (stats.byType[entity.fileType] || 0) + 1;

      // Count by framework
      if (entity.framework) {
        stats.byFramework[entity.framework] = (stats.byFramework[entity.framework] || 0) + 1;
      }

      // Count errors
      if (entity.errors.length > 0) {
        stats.errorFiles++;
      }

      // Determine if new/changed (simplified for now)
      if (this.state) {
        const existingEntity = this.state.entities[entity.relativePath];
        if (!existingEntity) {
          stats.newFiles++;
        } else if (existingEntity.checksum !== entity.checksum) {
          stats.changedFiles++;
        } else {
          stats.unchangedFiles++;
        }
      } else {
        stats.newFiles++; // All files are new if no previous state
      }
    }

    return stats;
  }

  /**
   * Count directories in root path
   */
  private async countDirectories(): Promise<number> {
    let count = 0;

    const countDirs = async (dirPath: string, depth: number = 0): Promise<void> => {
      if (depth > this.config.maxDepth) return;

      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
          if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
            count++;
            await countDirs(path.join(dirPath, item.name), depth + 1);
          }
        }
      } catch {
        // Continue on error
      }
    };

    await countDirs(this.config.rootPath);
    return count;
  }

  /**
   * Ensure state directory exists
   */
  private async ensureStateDirectory(): Promise<void> {
    const stateDir = path.resolve(this.config.rootPath, this.config.stateDirectory);
    try {
      await fs.mkdir(stateDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create state directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load previous discovery state
   */
  private async loadPreviousState(): Promise<void> {
    const statePath = path.resolve(
      this.config.rootPath,
      this.config.stateDirectory,
      'discovery-state.json'
    );

    try {
      const stateContent = await fs.readFile(statePath, 'utf-8');
      const rawState = JSON.parse(stateContent);
      this.state = DiscoveryStateSchema.parse(rawState);
    } catch {
      // No previous state or invalid state
      this.state = null;
    }
  }

  /**
   * Save discovery state
   */
  private async saveState(result: EnhancedDiscoveryResult): Promise<void> {
    const statePath = path.resolve(
      this.config.rootPath,
      this.config.stateDirectory,
      'discovery-state.json'
    );

    const state: DiscoveryState = {
      version: '1.0.0',
      lastScan: Date.now(),
      rootPath: this.config.rootPath,
      entities: Object.fromEntries(result.entities.map((entity) => [entity.relativePath, entity])),
      frameworks: result.frameworks,
      config: this.config,
    };

    try {
      await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      if (this.config.verbose) {
        console.warn('Failed to save discovery state:', error);
      }
    }
  }
}

/**
 * Factory function to create enhanced discovery instance
 */
export function createEnhancedDiscovery(
  config: Partial<EnhancedDiscoveryConfig> = {}
): EnhancedDiscovery {
  return new EnhancedDiscovery(config);
}

/**
 * Utility function for quick enhanced discovery
 */
export async function performEnhancedDiscovery(
  rootPath: string,
  config: Partial<EnhancedDiscoveryConfig> = {}
): Promise<EnhancedDiscoveryResult> {
  const discovery = createEnhancedDiscovery({ ...config, rootPath });
  return discovery.discover();
}

/**
 * Utility function for incremental discovery
 */
export async function performIncrementalDiscovery(
  rootPath: string,
  config: Partial<EnhancedDiscoveryConfig> = {}
): Promise<EnhancedDiscoveryResult> {
  const discovery = createEnhancedDiscovery({ ...config, rootPath, enableIncremental: true });
  return discovery.discoverIncremental();
}

/**
 * Compare two discovery results and identify changes
 */
export function compareDiscoveryResults(
  previous: EnhancedDiscoveryResult,
  current: EnhancedDiscoveryResult
): {
  newFiles: FileEntity[];
  changedFiles: FileEntity[];
  deletedFiles: FileEntity[];
  unchangedFiles: FileEntity[];
} {
  const previousMap = new Map(previous.entities.map((e) => [e.relativePath, e]));
  const currentMap = new Map(current.entities.map((e) => [e.relativePath, e]));

  const newFiles: FileEntity[] = [];
  const changedFiles: FileEntity[] = [];
  const deletedFiles: FileEntity[] = [];
  const unchangedFiles: FileEntity[] = [];

  // Find new and changed files
  for (const [path, currentEntity] of currentMap) {
    const previousEntity = previousMap.get(path);

    if (!previousEntity) {
      newFiles.push(currentEntity);
    } else if (previousEntity.checksum !== currentEntity.checksum) {
      changedFiles.push(currentEntity);
    } else {
      unchangedFiles.push(currentEntity);
    }
  }

  // Find deleted files
  for (const [path, previousEntity] of previousMap) {
    if (!currentMap.has(path)) {
      deletedFiles.push(previousEntity);
    }
  }

  return { newFiles, changedFiles, deletedFiles, unchangedFiles };
}
