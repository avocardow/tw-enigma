/**
 * Incremental Analysis Framework for TW-Enigma Pattern Re-Analysis System
 *
 * Provides efficient state tracking and change detection for analysis results:
 * - Persistent state database with entity mapping
 * - Checksum-based change detection
 * - Analysis result caching and invalidation
 * - Robust error handling and rollback mechanisms
 * - Performance optimization for large codebases
 */

import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import {
  EnhancedDiscovery,
  EnhancedDiscoveryResult,
  FileEntity,
  createEnhancedDiscovery,
} from './enhancedDiscovery';

// Incremental Analysis Configuration Schema
export const IncrementalAnalysisConfigSchema = z.object({
  /** Base directory for analysis operations */
  rootPath: z.string().default(process.cwd()),
  /** Directory for storing analysis state */
  stateDirectory: z.string().default('.tw-enigma/analysis'),
  /** Enable persistent state caching */
  enableStatePersistence: z.boolean().default(true),
  /** Enable analysis result caching */
  enableResultCaching: z.boolean().default(true),
  /** Maximum age for cached results (ms) */
  maxCacheAge: z.number().default(24 * 60 * 60 * 1000), // 24 hours
  /** Enable state corruption detection */
  enableStateValidation: z.boolean().default(true),
  /** Maximum number of backup states to keep */
  maxBackupStates: z.number().default(5),
  /** Enable verbose logging */
  verbose: z.boolean().default(false),
  /** Force refresh analysis for all entities */
  forceRefresh: z.boolean().default(false),
  /** Maximum entities to process in parallel */
  maxParallelProcessing: z.number().default(10),
  /** Timeout for individual entity analysis (ms) */
  analysisTimeout: z.number().default(10000),
  /** Enable automatic state cleanup */
  enableAutoCleanup: z.boolean().default(true),
  /** Cleanup threshold for orphaned entries */
  cleanupThreshold: z.number().default(7 * 24 * 60 * 60 * 1000), // 7 days
});

export type IncrementalAnalysisConfig = z.infer<typeof IncrementalAnalysisConfigSchema>;

// Analysis Entity Schema for tracking analyzed entities
export const AnalysisEntitySchema = z.object({
  /** Unique entity identifier */
  entityId: z.string(),
  /** File path of the analyzed entity */
  filePath: z.string(),
  /** Relative path from root */
  relativePath: z.string(),
  /** Entity type (file, function, class, etc.) */
  entityType: z.enum(['file', 'function', 'class', 'module', 'component', 'pattern', 'other']),
  /** Entity checksum for change detection */
  checksum: z.string(),
  /** Last analysis timestamp */
  lastAnalyzed: z.number(),
  /** Analysis result data */
  analysisResult: z.record(z.any()),
  /** Analysis version/schema */
  analysisVersion: z.string().default('1.0.0'),
  /** Analysis confidence score */
  confidence: z.number().min(0).max(1).default(1.0),
  /** Analysis metadata */
  metadata: z.object({
    /** Analysis duration in milliseconds */
    analysisDuration: z.number(),
    /** Analysis tool used */
    analysisTool: z.string().optional(),
    /** Dependencies analyzed */
    dependencies: z.array(z.string()).default([]),
    /** Analysis complexity score */
    complexityScore: z.number().optional(),
    /** Error messages (if any) */
    errors: z.array(z.string()).default([]),
  }),
  /** Next scheduled re-analysis time */
  nextReanalysis: z.number().optional(),
});

export type AnalysisEntity = z.infer<typeof AnalysisEntitySchema>;

// Analysis State Schema for persistence
export const AnalysisStateSchema = z.object({
  /** State version */
  version: z.string().default('1.0.0'),
  /** Last full analysis timestamp */
  lastFullAnalysis: z.number(),
  /** Last incremental analysis timestamp */
  lastIncrementalAnalysis: z.number(),
  /** Root path for the analysis */
  rootPath: z.string(),
  /** Analysis entities keyed by entity ID */
  entities: z.record(AnalysisEntitySchema),
  /** Analysis configuration used */
  config: z.any(),
  /** Global analysis metadata */
  metadata: z.object({
    /** Total entities analyzed */
    totalEntities: z.number(),
    /** Entities with errors */
    errorEntities: z.number(),
    /** Average analysis time per entity */
    avgAnalysisTime: z.number(),
    /** Analysis state checksum */
    stateChecksum: z.string(),
  }),
});

export type AnalysisState = z.infer<typeof AnalysisStateSchema>;

// Change Detection Result Schema
export const ChangeDetectionResultSchema = z.object({
  /** Entities that need analysis (new or changed) */
  entitiesToAnalyze: z.array(z.string()),
  /** Entities that are unchanged */
  unchangedEntities: z.array(z.string()),
  /** Entities that were deleted */
  deletedEntities: z.array(z.string()),
  /** Change detection statistics */
  stats: z.object({
    totalEntities: z.number(),
    newEntities: z.number(),
    changedEntities: z.number(),
    unchangedEntities: z.number(),
    deletedEntities: z.number(),
    detectionTime: z.number(),
  }),
});

export type ChangeDetectionResult = z.infer<typeof ChangeDetectionResultSchema>;

// Analysis Result Schema
export const IncrementalAnalysisResultSchema = z.object({
  /** Analysis entities processed */
  processedEntities: z.array(AnalysisEntitySchema),
  /** Change detection results */
  changeDetection: ChangeDetectionResultSchema,
  /** Analysis statistics */
  stats: z.object({
    totalProcessed: z.number(),
    newAnalysis: z.number(),
    updatedAnalysis: z.number(),
    cachedResults: z.number(),
    errorCount: z.number(),
    totalAnalysisTime: z.number(),
    averageAnalysisTime: z.number(),
  }),
  /** Analysis metadata */
  metadata: z.object({
    analysisStartTime: z.number(),
    analysisEndTime: z.number(),
    isIncrementalRun: z.boolean(),
    configUsed: z.any(),
  }),
});

export type IncrementalAnalysisResult = z.infer<typeof IncrementalAnalysisResultSchema>;

/**
 * Entity Analysis Interface
 */
export interface EntityAnalyzer {
  /** Analyzer name */
  readonly name: string;
  /** Analyzer version */
  readonly version: string;
  /** Supported entity types */
  readonly supportedTypes: AnalysisEntity['entityType'][];

  /** Analyze an entity */
  analyze(entity: FileEntity, context: AnalysisContext): Promise<any>;
  /** Check if analyzer can handle entity */
  canAnalyze(entity: FileEntity): boolean;
  /** Get cache key for entity */
  getCacheKey(entity: FileEntity): string;
}

/**
 * Analysis Context Interface
 */
export interface AnalysisContext {
  /** Root path */
  rootPath: string;
  /** Discovery result */
  discoveryResult: EnhancedDiscoveryResult;
  /** Previous analysis state */
  previousState?: AnalysisState;
  /** Configuration */
  config: IncrementalAnalysisConfig;
  /** Analysis metadata */
  metadata: Record<string, any>;
}

/**
 * Incremental Analysis Framework Class
 */
export class IncrementalAnalysisFramework {
  private config: IncrementalAnalysisConfig;
  private discovery: EnhancedDiscovery;
  private analyzers: Map<string, EntityAnalyzer> = new Map();
  private currentState: AnalysisState | null = null;

  constructor(config: Partial<IncrementalAnalysisConfig> = {}) {
    this.config = IncrementalAnalysisConfigSchema.parse(config);
    this.discovery = createEnhancedDiscovery({
      rootPath: this.config.rootPath,
      enableIncremental: true,
      enableChecksums: true,
      verbose: this.config.verbose,
    });
  }

  /**
   * Register an entity analyzer
   */
  registerAnalyzer(analyzer: EntityAnalyzer): void {
    this.analyzers.set(analyzer.name, analyzer);
    if (this.config.verbose) {
      console.log(`Registered analyzer: ${analyzer.name} v${analyzer.version}`);
    }
  }

  /**
   * Perform incremental analysis
   */
  async performIncrementalAnalysis(): Promise<IncrementalAnalysisResult> {
    const startTime = Date.now();

    try {
      // Ensure state directory exists
      await this.ensureStateDirectory();

      // Load previous state
      await this.loadPreviousState();

      // Perform discovery
      const discoveryResult = await this.discovery.discoverIncremental();

      // Detect changes
      const changeDetection = await this.detectChanges(discoveryResult);

      // Process entities that need analysis
      const processedEntities = await this.processChangedEntities(changeDetection, discoveryResult);

      // Update state
      await this.updateAnalysisState(processedEntities, discoveryResult);

      // Calculate statistics
      const stats = this.calculateAnalysisStatistics(processedEntities, changeDetection, startTime);

      const result: IncrementalAnalysisResult = {
        processedEntities,
        changeDetection,
        stats,
        metadata: {
          analysisStartTime: startTime,
          analysisEndTime: Date.now(),
          isIncrementalRun: true,
          configUsed: this.config,
        },
      };

      // Save updated state
      if (this.config.enableStatePersistence) {
        await this.saveState();
      }

      // Perform cleanup if enabled
      if (this.config.enableAutoCleanup) {
        await this.performStateCleanup();
      }

      return result;
    } catch (error) {
      throw new Error(
        `Incremental analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Perform full analysis (non-incremental)
   */
  async performFullAnalysis(): Promise<IncrementalAnalysisResult> {
    const startTime = Date.now();

    try {
      // Clear previous state for full analysis
      this.currentState = null;

      // Perform full discovery
      const discoveryResult = await this.discovery.discover();

      // Process all entities
      const allEntities = discoveryResult.entities.map((entity) => entity.relativePath);
      const changeDetection: ChangeDetectionResult = {
        entitiesToAnalyze: allEntities,
        unchangedEntities: [],
        deletedEntities: [],
        stats: {
          totalEntities: allEntities.length,
          newEntities: allEntities.length,
          changedEntities: 0,
          unchangedEntities: 0,
          deletedEntities: 0,
          detectionTime: 0,
        },
      };

      const processedEntities = await this.processChangedEntities(changeDetection, discoveryResult);

      // Update state
      await this.updateAnalysisState(processedEntities, discoveryResult);

      // Calculate statistics
      const stats = this.calculateAnalysisStatistics(processedEntities, changeDetection, startTime);

      const result: IncrementalAnalysisResult = {
        processedEntities,
        changeDetection,
        stats,
        metadata: {
          analysisStartTime: startTime,
          analysisEndTime: Date.now(),
          isIncrementalRun: false,
          configUsed: this.config,
        },
      };

      // Save state
      if (this.config.enableStatePersistence) {
        await this.saveState();
      }

      return result;
    } catch (error) {
      throw new Error(
        `Full analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get analysis result for specific entity
   */
  async getEntityAnalysis(entityId: string): Promise<AnalysisEntity | null> {
    if (!this.currentState) {
      await this.loadPreviousState();
    }

    return this.currentState?.entities[entityId] || null;
  }

  /**
   * Invalidate analysis cache for entity
   */
  async invalidateEntity(entityId: string): Promise<void> {
    if (!this.currentState) {
      await this.loadPreviousState();
    }

    if (this.currentState?.entities[entityId]) {
      delete this.currentState.entities[entityId];

      if (this.config.enableStatePersistence) {
        await this.saveState();
      }
    }
  }

  /**
   * Get analysis statistics
   */
  getAnalysisStatistics(): any {
    if (!this.currentState) {
      return null;
    }

    const entities = Object.values(this.currentState.entities);
    const totalEntities = entities.length;
    const errorEntities = entities.filter((e) => e.metadata.errors.length > 0).length;
    const avgAnalysisTime =
      entities.reduce((sum, e) => sum + e.metadata.analysisDuration, 0) / totalEntities;

    return {
      totalEntities,
      errorEntities,
      avgAnalysisTime,
      lastFullAnalysis: this.currentState.lastFullAnalysis,
      lastIncrementalAnalysis: this.currentState.lastIncrementalAnalysis,
      stateChecksum: this.currentState.metadata.stateChecksum,
    };
  }

  /**
   * Detect changes between current discovery and previous state
   */
  private async detectChanges(
    discoveryResult: EnhancedDiscoveryResult
  ): Promise<ChangeDetectionResult> {
    const startTime = Date.now();
    const entitiesToAnalyze: string[] = [];
    const unchangedEntities: string[] = [];
    const deletedEntities: string[] = [];

    // Get current entities map
    const currentEntities = new Map(
      discoveryResult.entities.map((entity) => [entity.relativePath, entity])
    );

    // Check existing entities for changes
    if (this.currentState) {
      for (const [entityId, analysisEntity] of Object.entries(this.currentState.entities)) {
        const currentEntity = currentEntities.get(analysisEntity.relativePath);

        if (!currentEntity) {
          // Entity was deleted
          deletedEntities.push(entityId);
        } else if (
          this.config.forceRefresh ||
          currentEntity.checksum !== analysisEntity.checksum ||
          this.isCacheExpired(analysisEntity)
        ) {
          // Entity changed or cache expired
          entitiesToAnalyze.push(analysisEntity.relativePath);
        } else {
          // Entity unchanged
          unchangedEntities.push(analysisEntity.relativePath);
        }
      }
    }

    // Check for new entities
    for (const entity of discoveryResult.entities) {
      const existingEntity = this.currentState?.entities[this.getEntityId(entity)];
      if (!existingEntity) {
        entitiesToAnalyze.push(entity.relativePath);
      }
    }

    const stats = {
      totalEntities: discoveryResult.entities.length,
      newEntities: entitiesToAnalyze.filter(
        (path) => !this.currentState?.entities[this.getEntityIdFromPath(path)]
      ).length,
      changedEntities: entitiesToAnalyze.filter(
        (path) => this.currentState?.entities[this.getEntityIdFromPath(path)]
      ).length,
      unchangedEntities: unchangedEntities.length,
      deletedEntities: deletedEntities.length,
      detectionTime: Date.now() - startTime,
    };

    return {
      entitiesToAnalyze: [...new Set(entitiesToAnalyze)], // Remove duplicates
      unchangedEntities,
      deletedEntities,
      stats,
    };
  }

  /**
   * Process entities that need analysis
   */
  private async processChangedEntities(
    changeDetection: ChangeDetectionResult,
    discoveryResult: EnhancedDiscoveryResult
  ): Promise<AnalysisEntity[]> {
    const processedEntities: AnalysisEntity[] = [];
    const entityMap = new Map(
      discoveryResult.entities.map((entity) => [entity.relativePath, entity])
    );

    // Process entities in parallel with throttling
    const batches = this.createBatches(
      changeDetection.entitiesToAnalyze,
      this.config.maxParallelProcessing
    );

    for (const batch of batches) {
      const batchPromises = batch.map(async (relativePath) => {
        const entity = entityMap.get(relativePath);
        if (!entity) return null;

        try {
          const analysisEntity = await this.analyzeEntity(entity, discoveryResult);
          return analysisEntity;
        } catch (error) {
          if (this.config.verbose) {
            console.warn(`Failed to analyze entity ${relativePath}:`, error);
          }
          return this.createErrorAnalysisEntity(entity, error);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      processedEntities.push(...(batchResults.filter(Boolean) as AnalysisEntity[]));
    }

    return processedEntities;
  }

  /**
   * Analyze a single entity
   */
  private async analyzeEntity(
    entity: FileEntity,
    discoveryResult: EnhancedDiscoveryResult
  ): Promise<AnalysisEntity> {
    const startTime = Date.now();
    const context: AnalysisContext = {
      rootPath: this.config.rootPath,
      discoveryResult,
      previousState: this.currentState || undefined,
      config: this.config,
      metadata: {},
    };

    // Find suitable analyzer
    const analyzer = this.findAnalyzerForEntity(entity);

    let analysisResult: any = {};
    const errors: string[] = [];

    if (analyzer) {
      try {
        // Set analysis timeout
        const analysisPromise = analyzer.analyze(entity, context);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Analysis timeout')), this.config.analysisTimeout)
        );

        analysisResult = await Promise.race([analysisPromise, timeoutPromise]);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    } else {
      errors.push('No suitable analyzer found');
    }

    const analysisDuration = Date.now() - startTime;

    return {
      entityId: this.getEntityId(entity),
      filePath: entity.filePath,
      relativePath: entity.relativePath,
      entityType: this.determineEntityType(entity),
      checksum: entity.checksum,
      lastAnalyzed: Date.now(),
      analysisResult,
      analysisVersion: '1.0.0',
      confidence: errors.length === 0 ? 1.0 : 0.5,
      metadata: {
        analysisDuration,
        analysisTool: analyzer?.name,
        dependencies: [],
        errors,
      },
    };
  }

  /**
   * Create error analysis entity
   */
  private createErrorAnalysisEntity(entity: FileEntity, error: unknown): AnalysisEntity {
    return {
      entityId: this.getEntityId(entity),
      filePath: entity.filePath,
      relativePath: entity.relativePath,
      entityType: this.determineEntityType(entity),
      checksum: entity.checksum,
      lastAnalyzed: Date.now(),
      analysisResult: {},
      analysisVersion: '1.0.0',
      confidence: 0.0,
      metadata: {
        analysisDuration: 0,
        dependencies: [],
        errors: [error instanceof Error ? error.message : String(error)],
      },
    };
  }

  /**
   * Find analyzer for entity
   */
  private findAnalyzerForEntity(entity: FileEntity): EntityAnalyzer | null {
    for (const analyzer of this.analyzers.values()) {
      if (analyzer.canAnalyze(entity)) {
        return analyzer;
      }
    }
    return null;
  }

  /**
   * Determine entity type from file entity
   */
  private determineEntityType(entity: FileEntity): AnalysisEntity['entityType'] {
    // This is a simplified mapping - can be enhanced based on content analysis
    if (entity.fileType === 'html') return 'component';
    if (entity.fileType === 'javascript' || entity.fileType === 'typescript') return 'module';
    return 'file';
  }

  /**
   * Generate entity ID from file entity
   */
  private getEntityId(entity: FileEntity): string {
    return createHash('md5').update(entity.relativePath).digest('hex');
  }

  /**
   * Generate entity ID from path
   */
  private getEntityIdFromPath(relativePath: string): string {
    return createHash('md5').update(relativePath).digest('hex');
  }

  /**
   * Check if analysis cache is expired
   */
  private isCacheExpired(analysisEntity: AnalysisEntity): boolean {
    if (!this.config.enableResultCaching) {
      return true;
    }

    const age = Date.now() - analysisEntity.lastAnalyzed;
    return age > this.config.maxCacheAge;
  }

  /**
   * Create batches for parallel processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update analysis state with new results
   */
  private async updateAnalysisState(
    processedEntities: AnalysisEntity[],
    discoveryResult: EnhancedDiscoveryResult
  ): Promise<void> {
    if (!this.currentState) {
      this.currentState = {
        version: '1.0.0',
        lastFullAnalysis: Date.now(),
        lastIncrementalAnalysis: Date.now(),
        rootPath: this.config.rootPath,
        entities: {},
        config: this.config,
        metadata: {
          totalEntities: 0,
          errorEntities: 0,
          avgAnalysisTime: 0,
          stateChecksum: '',
        },
      };
    }

    // Update entities
    for (const entity of processedEntities) {
      this.currentState.entities[entity.entityId] = entity;
    }

    // Update metadata
    const allEntities = Object.values(this.currentState.entities);
    this.currentState.metadata = {
      totalEntities: allEntities.length,
      errorEntities: allEntities.filter((e) => e.metadata.errors.length > 0).length,
      avgAnalysisTime:
        allEntities.reduce((sum, e) => sum + e.metadata.analysisDuration, 0) / allEntities.length,
      stateChecksum: this.calculateStateChecksum(),
    };

    this.currentState.lastIncrementalAnalysis = Date.now();
  }

  /**
   * Calculate statistics for analysis result
   */
  private calculateAnalysisStatistics(
    processedEntities: AnalysisEntity[],
    changeDetection: ChangeDetectionResult,
    startTime: number
  ) {
    const totalTime = Date.now() - startTime;
    const totalProcessed = processedEntities.length;
    const errorCount = processedEntities.filter((e) => e.metadata.errors.length > 0).length;

    return {
      totalProcessed,
      newAnalysis: changeDetection.stats.newEntities,
      updatedAnalysis: changeDetection.stats.changedEntities,
      cachedResults: changeDetection.stats.unchangedEntities,
      errorCount,
      totalAnalysisTime: totalTime,
      averageAnalysisTime: totalProcessed > 0 ? totalTime / totalProcessed : 0,
    };
  }

  /**
   * Calculate state checksum for validation
   */
  private calculateStateChecksum(): string {
    if (!this.currentState) return '';

    const stateData = JSON.stringify({
      version: this.currentState.version,
      rootPath: this.currentState.rootPath,
      entityIds: Object.keys(this.currentState.entities).sort(),
    });

    return createHash('md5').update(stateData).digest('hex');
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
   * Load previous analysis state
   */
  private async loadPreviousState(): Promise<void> {
    const statePath = path.resolve(
      this.config.rootPath,
      this.config.stateDirectory,
      'analysis-state.json'
    );

    try {
      const stateContent = await fs.readFile(statePath, 'utf-8');
      const rawState = JSON.parse(stateContent);

      // Validate state if enabled
      if (this.config.enableStateValidation) {
        this.currentState = AnalysisStateSchema.parse(rawState);

        // Check state integrity
        const expectedChecksum = this.calculateStateChecksum();
        if (expectedChecksum !== this.currentState.metadata.stateChecksum) {
          if (this.config.verbose) {
            console.warn('State checksum mismatch, state may be corrupted');
          }
          // Optionally attempt recovery from backup
          await this.attemptStateRecovery();
        }
      } else {
        this.currentState = rawState;
      }
    } catch (error) {
      if (this.config.verbose) {
        console.log('No previous analysis state found or invalid state, starting fresh');
      }
      this.currentState = null;
    }
  }

  /**
   * Save analysis state
   */
  private async saveState(): Promise<void> {
    if (!this.currentState) return;

    const statePath = path.resolve(
      this.config.rootPath,
      this.config.stateDirectory,
      'analysis-state.json'
    );

    try {
      // Create backup before saving
      await this.createStateBackup();

      // Update state checksum
      this.currentState.metadata.stateChecksum = this.calculateStateChecksum();

      // Save state
      await fs.writeFile(statePath, JSON.stringify(this.currentState, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to save analysis state: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create state backup
   */
  private async createStateBackup(): Promise<void> {
    if (!this.currentState) return;

    const backupDir = path.resolve(this.config.rootPath, this.config.stateDirectory, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `analysis-state-${timestamp}.json`);

    try {
      await fs.mkdir(backupDir, { recursive: true });
      await fs.writeFile(backupPath, JSON.stringify(this.currentState, null, 2), 'utf-8');

      // Clean up old backups
      await this.cleanupOldBackups(backupDir);
    } catch (error) {
      if (this.config.verbose) {
        console.warn('Failed to create state backup:', error);
      }
    }
  }

  /**
   * Clean up old backup files
   */
  private async cleanupOldBackups(backupDir: string): Promise<void> {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter((file) => file.startsWith('analysis-state-') && file.endsWith('.json'))
        .map((file) => ({
          name: file,
          path: path.join(backupDir, file),
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (timestamp) descending

      // Remove excess backups
      if (backupFiles.length > this.config.maxBackupStates) {
        const filesToDelete = backupFiles.slice(this.config.maxBackupStates);

        for (const file of filesToDelete) {
          try {
            await fs.unlink(file.path);
          } catch (error) {
            if (this.config.verbose) {
              console.warn(`Failed to delete backup file ${file.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      if (this.config.verbose) {
        console.warn('Failed to cleanup old backups:', error);
      }
    }
  }

  /**
   * Attempt state recovery from backup
   */
  private async attemptStateRecovery(): Promise<void> {
    const backupDir = path.resolve(this.config.rootPath, this.config.stateDirectory, 'backups');

    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter((file) => file.startsWith('analysis-state-') && file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)); // Latest first

      for (const backupFile of backupFiles) {
        try {
          const backupPath = path.join(backupDir, backupFile);
          const backupContent = await fs.readFile(backupPath, 'utf-8');
          const backupState = AnalysisStateSchema.parse(JSON.parse(backupContent));

          if (this.config.verbose) {
            console.log(`Recovered state from backup: ${backupFile}`);
          }

          this.currentState = backupState;
          return;
        } catch (error) {
          if (this.config.verbose) {
            console.warn(`Failed to recover from backup ${backupFile}:`, error);
          }
        }
      }

      // No valid backup found
      if (this.config.verbose) {
        console.warn('No valid backup found for state recovery');
      }
      this.currentState = null;
    } catch (error) {
      if (this.config.verbose) {
        console.warn('Failed to attempt state recovery:', error);
      }
      this.currentState = null;
    }
  }

  /**
   * Perform automatic state cleanup
   */
  private async performStateCleanup(): Promise<void> {
    if (!this.currentState) return;

    const currentTime = Date.now();
    const cleanupThreshold = this.config.cleanupThreshold;
    let cleanedCount = 0;

    // Remove stale entities
    for (const [entityId, entity] of Object.entries(this.currentState.entities)) {
      const age = currentTime - entity.lastAnalyzed;

      if (age > cleanupThreshold) {
        delete this.currentState.entities[entityId];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0 && this.config.verbose) {
      console.log(`Cleaned up ${cleanedCount} stale analysis entities`);
    }
  }
}

/**
 * Factory function to create incremental analysis framework
 */
export function createIncrementalAnalysisFramework(
  config: Partial<IncrementalAnalysisConfig> = {}
): IncrementalAnalysisFramework {
  return new IncrementalAnalysisFramework(config);
}

/**
 * Utility function for quick incremental analysis
 */
export async function performQuickIncrementalAnalysis(
  rootPath: string,
  analyzers: EntityAnalyzer[],
  config: Partial<IncrementalAnalysisConfig> = {}
): Promise<IncrementalAnalysisResult> {
  const framework = createIncrementalAnalysisFramework({ ...config, rootPath });

  // Register analyzers
  for (const analyzer of analyzers) {
    framework.registerAnalyzer(analyzer);
  }

  return framework.performIncrementalAnalysis();
}
