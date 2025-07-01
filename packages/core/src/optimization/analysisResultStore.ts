/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from 'crypto';
import { IndexedDataStore, createIndexedDataStore, type DataStoreConfig } from './dataStore';
import type { PatternFrequencyMap } from '../processors/patternAnalysis';
import type { ConsolidationResult } from './completeConsolidator';
import type { PassMetrics } from './multiPassDiscovery';

/**
 * Entity metadata for fast lookups
 */
export interface EntityMetadata {
  filePath: string;
  fileType: string;
  lastModified: number;
  size: number;
  checksum: string;
  analysisVersion: string;
  patterns: string[]; // Pattern IDs found in this entity
  dependencies: string[]; // File dependencies
  tags: string[];
}

/**
 * Pattern analysis result
 */
export interface PatternAnalysisResult {
  entityId: string;
  patterns: PatternDefinition[];
  confidence: number;
  analysisTimestamp: number;
  processingTime: number;
  metadata: {
    version: string;
    algorithmUsed: string;
    configSnapshot: Record<string, any>;
  };
}

/**
 * Pattern definition with optimized storage
 */
export interface PatternDefinition {
  id: string;
  name: string;
  type: string;
  category: string;
  confidence: number;
  frequency: number;
  locations: PatternLocation[];
  signature: string; // Unique signature for deduplication
  relationships: string[]; // Related pattern IDs
  metadata: Record<string, any>;
}

/**
 * Pattern location with minimal storage footprint
 */
export interface PatternLocation {
  file: string; // Relative to entity
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  context?: string; // Minimal context for reconstruction
}

/**
 * Discovery session result
 */
export interface DiscoverySessionResult {
  sessionId: string;
  startTime: number;
  endTime: number;
  entitiesProcessed: string[];
  totalPatterns: number;
  uniquePatterns: number;
  duplicatePatterns: number;
  processingMetrics: PassMetrics[];
  consolidationResult?: ConsolidationResult;
  errors: string[];
  warnings: string[];
}

/**
 * Incremental update context
 */
export interface IncrementalUpdateContext {
  baselineSessionId: string;
  changedEntities: string[];
  addedEntities: string[];
  removedEntities: string[];
  timestamp: number;
  reason: 'file_change' | 'config_change' | 'manual_trigger';
}

/**
 * Analysis result query options
 */
export interface AnalysisQueryOptions {
  entityId?: string;
  patternType?: string;
  category?: string;
  confidenceThreshold?: number;
  timeRange?: { start: number; end: number };
  includeMetadata?: boolean;
  includePatterns?: boolean;
  sortBy?: 'timestamp' | 'confidence' | 'frequency';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Optimized storage for analysis results with efficient retrieval and updates
 */
export class AnalysisResultStore {
  private entityStore: IndexedDataStore<EntityMetadata>;
  private patternStore: IndexedDataStore<PatternDefinition>;
  private resultStore: IndexedDataStore<PatternAnalysisResult>;
  private sessionStore: IndexedDataStore<DiscoverySessionResult>;
  private frequencyStore: IndexedDataStore<PatternFrequencyMap>;
  
  // In-memory indexes for fast lookups
  private patternIndex: Map<string, Set<string>> = new Map(); // category -> pattern IDs
  private entityIndex: Map<string, Set<string>> = new Map(); // file path -> entity IDs
  private typeIndex: Map<string, Set<string>> = new Map(); // type -> pattern IDs
  
  private isInitialized = false;

  constructor(config: Partial<DataStoreConfig> = {}) {
    const storeConfig = {
      ...config,
      dataDirectory: config.dataDirectory || './.tw-enigma/analysis',
    };

    this.entityStore = createIndexedDataStore<EntityMetadata>({
      ...storeConfig,
      dataDirectory: `${storeConfig.dataDirectory}/entities`,
    });

    this.patternStore = createIndexedDataStore<PatternDefinition>({
      ...storeConfig,
      dataDirectory: `${storeConfig.dataDirectory}/patterns`,
    });

    this.resultStore = createIndexedDataStore<PatternAnalysisResult>({
      ...storeConfig,
      dataDirectory: `${storeConfig.dataDirectory}/results`,
    });

    this.sessionStore = createIndexedDataStore<DiscoverySessionResult>({
      ...storeConfig,
      dataDirectory: `${storeConfig.dataDirectory}/sessions`,
    });

    this.frequencyStore = createIndexedDataStore<PatternFrequencyMap>({
      ...storeConfig,
      dataDirectory: `${storeConfig.dataDirectory}/frequencies`,
    });
  }

  /**
   * Initialize the analysis result store
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Promise.all([
        this.entityStore.initialize(),
        this.patternStore.initialize(),
        this.resultStore.initialize(),
        this.sessionStore.initialize(),
        this.frequencyStore.initialize(),
      ]);

      await this.rebuildIndexes();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`AnalysisResultStore initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Store entity metadata
   */
  public async storeEntityMetadata(metadata: EntityMetadata): Promise<void> {
    this.ensureInitialized();

    const entityId = this.generateEntityId(metadata.filePath);
    await this.entityStore.put(entityId, metadata);

    // Update entity index
    if (!this.entityIndex.has(metadata.filePath)) {
      this.entityIndex.set(metadata.filePath, new Set());
    }
    this.entityIndex.get(metadata.filePath)!.add(entityId);
  }

  /**
   * Store pattern analysis result
   */
  public async storePatternAnalysisResult(result: PatternAnalysisResult): Promise<void> {
    this.ensureInitialized();

    const resultId = this.generateResultId(result.entityId, result.analysisTimestamp);
    
    // Store patterns individually for deduplication
    const patternIds: string[] = [];
    for (const pattern of result.patterns) {
      const patternId = await this.storePattern(pattern);
      patternIds.push(patternId);
    }

    // Store result with pattern references
    const optimizedResult: PatternAnalysisResult = {
      ...result,
      patterns: patternIds.map(id => ({ id } as any)), // Store only IDs
    };

    await this.resultStore.put(resultId, optimizedResult);
  }

  /**
   * Store discovery session result
   */
  public async storeDiscoverySession(session: DiscoverySessionResult): Promise<void> {
    this.ensureInitialized();
    await this.sessionStore.put(session.sessionId, session);
  }

  /**
   * Store pattern frequency data
   */
  public async storePatternFrequency(sessionId: string, frequencyMap: PatternFrequencyMap): Promise<void> {
    this.ensureInitialized();
    await this.frequencyStore.put(sessionId, frequencyMap);
  }

  /**
   * Get entity metadata by file path
   */
  public async getEntityMetadata(filePath: string): Promise<EntityMetadata | null> {
    this.ensureInitialized();

    const entityIds = this.entityIndex.get(filePath);
    if (!entityIds || entityIds.size === 0) {
      return null;
    }

    // Get the most recent entity
    const entityId = Array.from(entityIds)[entityIds.size - 1];
    return await this.entityStore.get(entityId);
  }

  /**
   * Get pattern analysis results for an entity
   */
  public async getEntityAnalysisResults(entityId: string): Promise<PatternAnalysisResult[]> {
    this.ensureInitialized();

    const results = await this.resultStore.query({
      prefix: `${entityId}_`,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });

    // Reconstruct full patterns
    const fullResults: PatternAnalysisResult[] = [];
    for (const result of results) {
      const fullPatterns: PatternDefinition[] = [];
      for (const patternRef of result.value.patterns) {
        if (typeof patternRef === 'object' && 'id' in patternRef) {
          const pattern = await this.patternStore.get(patternRef.id);
          if (pattern) {
            fullPatterns.push(pattern);
          }
        }
      }
      
      fullResults.push({
        ...result.value,
        patterns: fullPatterns,
      });
    }

    return fullResults;
  }

  /**
   * Query patterns with advanced filtering
   */
  public async queryPatterns(options: AnalysisQueryOptions = {}): Promise<PatternDefinition[]> {
    this.ensureInitialized();

    let patternIds: Set<string> | undefined;

    // Use indexes for efficient filtering
    if (options.category) {
      patternIds = this.patternIndex.get(options.category);
    } else if (options.patternType) {
      patternIds = this.typeIndex.get(options.patternType);
    }

    // Get patterns
    const patterns: PatternDefinition[] = [];
    
    if (patternIds) {
      // Use index
      for (const patternId of patternIds) {
        const pattern = await this.patternStore.get(patternId);
        if (pattern && this.matchesFilters(pattern, options)) {
          patterns.push(pattern);
        }
      }
    } else {
      // Full scan
      const allPatterns = await this.patternStore.query({
        limit: options.limit,
        offset: options.offset,
      });
      
      for (const item of allPatterns) {
        if (this.matchesFilters(item.value, options)) {
          patterns.push(item.value);
        }
      }
    }

    // Apply sorting
    if (options.sortBy) {
      patterns.sort((a, b) => {
        let comparison = 0;
        switch (options.sortBy) {
          case 'confidence':
            comparison = a.confidence - b.confidence;
            break;
          case 'frequency':
            comparison = a.frequency - b.frequency;
            break;
          default:
            comparison = 0;
        }
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return patterns;
  }

  /**
   * Get pattern frequency data
   */
  public async getPatternFrequency(sessionId: string): Promise<PatternFrequencyMap | null> {
    this.ensureInitialized();
    return await this.frequencyStore.get(sessionId);
  }

  /**
   * Get discovery session
   */
  public async getDiscoverySession(sessionId: string): Promise<DiscoverySessionResult | null> {
    this.ensureInitialized();
    return await this.sessionStore.get(sessionId);
  }

  /**
   * List recent discovery sessions
   */
  public async getRecentSessions(limit: number = 10): Promise<DiscoverySessionResult[]> {
    this.ensureInitialized();

    const sessions = await this.sessionStore.query({
      sortBy: 'timestamp',
      sortOrder: 'desc',
      limit,
    });

    return sessions.map(item => item.value);
  }

  /**
   * Perform incremental update
   */
  public async performIncrementalUpdate(context: IncrementalUpdateContext): Promise<void> {
    this.ensureInitialized();

    // Get baseline session
    const baselineSession = await this.getDiscoverySession(context.baselineSessionId);
    if (!baselineSession) {
      throw new Error(`Baseline session ${context.baselineSessionId} not found`);
    }

    // Remove analysis results for changed/removed entities
    const entitiesToUpdate = [...context.changedEntities, ...context.removedEntities];
    
    for (const entityPath of entitiesToUpdate) {
      await this.removeEntityAnalysisResults(entityPath);
    }

    // Remove entity metadata for removed entities
    for (const entityPath of context.removedEntities) {
      await this.removeEntityMetadata(entityPath);
    }
  }

  /**
   * Create an efficient diff between two sessions
   */
  public async diffSessions(oldSessionId: string, newSessionId: string): Promise<{
    addedPatterns: PatternDefinition[];
    removedPatterns: PatternDefinition[];
    modifiedPatterns: Array<{ old: PatternDefinition; new: PatternDefinition }>;
    unchangedPatterns: PatternDefinition[];
  }> {
    const [oldSession, newSession] = await Promise.all([
      this.getDiscoverySession(oldSessionId),
      this.getDiscoverySession(newSessionId),
    ]);

    if (!oldSession || !newSession) {
      throw new Error('One or both sessions not found');
    }

    // Get all patterns from both sessions
    const oldPatterns = await this.getSessionPatterns(oldSessionId);
    const newPatterns = await this.getSessionPatterns(newSessionId);

    // Create maps for efficient lookup
    const oldPatternMap = new Map(oldPatterns.map(p => [p.signature, p]));
    const newPatternMap = new Map(newPatterns.map(p => [p.signature, p]));

    const addedPatterns: PatternDefinition[] = [];
    const removedPatterns: PatternDefinition[] = [];
    const modifiedPatterns: Array<{ old: PatternDefinition; new: PatternDefinition }> = [];
    const unchangedPatterns: PatternDefinition[] = [];

    // Find added and modified patterns
    for (const [signature, newPattern] of newPatternMap) {
      const oldPattern = oldPatternMap.get(signature);
      if (!oldPattern) {
        addedPatterns.push(newPattern);
      } else if (this.patternsEqual(oldPattern, newPattern)) {
        unchangedPatterns.push(newPattern);
      } else {
        modifiedPatterns.push({ old: oldPattern, new: newPattern });
      }
    }

    // Find removed patterns
    for (const [signature, oldPattern] of oldPatternMap) {
      if (!newPatternMap.has(signature)) {
        removedPatterns.push(oldPattern);
      }
    }

    return {
      addedPatterns,
      removedPatterns,
      modifiedPatterns,
      unchangedPatterns,
    };
  }

  /**
   * Get storage metrics
   */
  public async getStorageMetrics(): Promise<{
    entities: number;
    patterns: number;
    results: number;
    sessions: number;
    totalSize: number;
  }> {
    this.ensureInitialized();

    const [entityMetrics, patternMetrics, resultMetrics, sessionMetrics] = await Promise.all([
      this.entityStore.getMetrics(),
      this.patternStore.getMetrics(),
      this.resultStore.getMetrics(),
      this.sessionStore.getMetrics(),
    ]);

    return {
      entities: entityMetrics.totalKeys,
      patterns: patternMetrics.totalKeys,
      results: resultMetrics.totalKeys,
      sessions: sessionMetrics.totalKeys,
      totalSize: entityMetrics.totalSize + patternMetrics.totalSize + resultMetrics.totalSize + sessionMetrics.totalSize,
    };
  }

  /**
   * Compact all stores
   */
  public async compact(): Promise<void> {
    this.ensureInitialized();

    await Promise.all([
      this.entityStore.compact(),
      this.patternStore.compact(),
      this.resultStore.compact(),
      this.sessionStore.compact(),
      this.frequencyStore.compact(),
    ]);
  }

  /**
   * Close all stores
   */
  public async close(): Promise<void> {
    if (!this.isInitialized) return;

    await Promise.all([
      this.entityStore.close(),
      this.patternStore.close(),
      this.resultStore.close(),
      this.sessionStore.close(),
      this.frequencyStore.close(),
    ]);

    this.patternIndex.clear();
    this.entityIndex.clear();
    this.typeIndex.clear();
    this.isInitialized = false;
  }

  // Private methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('AnalysisResultStore not initialized. Call initialize() first.');
    }
  }

  private generateEntityId(filePath: string): string {
    const hash = createHash('md5').update(filePath).digest('hex');
    return `entity_${hash}_${Date.now()}`;
  }

  private generateResultId(entityId: string, timestamp: number): string {
    return `${entityId}_${timestamp}`;
  }

  private generatePatternId(pattern: PatternDefinition): string {
    const signature = this.createPatternSignature(pattern);
    const hash = createHash('md5').update(signature).digest('hex');
    return `pattern_${hash}`;
  }

  private createPatternSignature(pattern: PatternDefinition): string {
    // Create a unique signature based on pattern characteristics
    const components = [
      pattern.name,
      pattern.type,
      pattern.category,
      JSON.stringify(pattern.locations.map(l => ({ file: l.file, startLine: l.startLine, endLine: l.endLine }))),
    ];
    return components.join('|');
  }

  private async storePattern(pattern: PatternDefinition): Promise<string> {
    const patternId = this.generatePatternId(pattern);
    const signature = this.createPatternSignature(pattern);
    
    // Check if pattern already exists
    const existing = await this.patternStore.get(patternId);
    if (existing) {
      // Update frequency if higher
      if (pattern.frequency > existing.frequency) {
        existing.frequency = pattern.frequency;
        await this.patternStore.put(patternId, existing);
      }
      return patternId;
    }

    // Store new pattern
    const patternWithSignature = { ...pattern, signature };
    await this.patternStore.put(patternId, patternWithSignature);

    // Update indexes
    this.updatePatternIndexes(patternId, pattern);

    return patternId;
  }

  private updatePatternIndexes(patternId: string, pattern: PatternDefinition): void {
    // Update category index
    if (!this.patternIndex.has(pattern.category)) {
      this.patternIndex.set(pattern.category, new Set());
    }
    this.patternIndex.get(pattern.category)!.add(patternId);

    // Update type index
    if (!this.typeIndex.has(pattern.type)) {
      this.typeIndex.set(pattern.type, new Set());
    }
    this.typeIndex.get(pattern.type)!.add(patternId);
  }

  private async rebuildIndexes(): Promise<void> {
    // Rebuild pattern indexes
    const allPatterns = await this.patternStore.query();
    for (const item of allPatterns) {
      this.updatePatternIndexes(item.key, item.value);
    }

    // Rebuild entity indexes
    const allEntities = await this.entityStore.query();
    for (const item of allEntities) {
      const filePath = item.value.filePath;
      if (!this.entityIndex.has(filePath)) {
        this.entityIndex.set(filePath, new Set());
      }
      this.entityIndex.get(filePath)!.add(item.key);
    }
  }

  private matchesFilters(pattern: PatternDefinition, options: AnalysisQueryOptions): boolean {
    if (options.confidenceThreshold && pattern.confidence < options.confidenceThreshold) {
      return false;
    }

    if (options.category && pattern.category !== options.category) {
      return false;
    }

    if (options.patternType && pattern.type !== options.patternType) {
      return false;
    }

    return true;
  }

  private async getSessionPatterns(sessionId: string): Promise<PatternDefinition[]> {
    const session = await this.getDiscoverySession(sessionId);
    if (!session) return [];

    const patterns: PatternDefinition[] = [];
    
    // Get patterns from all entities in the session
    for (const entityId of session.entitiesProcessed) {
      const results = await this.getEntityAnalysisResults(entityId);
      for (const result of results) {
        patterns.push(...result.patterns);
      }
    }

    return patterns;
  }

  private patternsEqual(pattern1: PatternDefinition, pattern2: PatternDefinition): boolean {
    return (
      pattern1.signature === pattern2.signature &&
      pattern1.confidence === pattern2.confidence &&
      pattern1.frequency === pattern2.frequency
    );
  }

  private async removeEntityAnalysisResults(entityPath: string): Promise<void> {
    const entityIds = this.entityIndex.get(entityPath);
    if (!entityIds) return;

    for (const entityId of entityIds) {
      const results = await this.resultStore.query({ prefix: `${entityId}_` });
      for (const result of results) {
        await this.resultStore.delete(result.key);
      }
    }
  }

  private async removeEntityMetadata(entityPath: string): Promise<void> {
    const entityIds = this.entityIndex.get(entityPath);
    if (!entityIds) return;

    for (const entityId of entityIds) {
      await this.entityStore.delete(entityId);
    }

    this.entityIndex.delete(entityPath);
  }
}

/**
 * Factory function to create an AnalysisResultStore instance
 */
export function createAnalysisResultStore(config: Partial<DataStoreConfig> = {}): AnalysisResultStore {
  return new AnalysisResultStore(config);
}