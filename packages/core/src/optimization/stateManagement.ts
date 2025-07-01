/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from 'crypto';
import { access, mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import type { PatternFrequencyMap } from '../processors/patternAnalysis';
import type { ConsolidationResult } from './completeConsolidator';
import type { PassMetrics } from './multiPassDiscovery';

/**
 * Configuration schema for state management
 */
export const StateManagementConfigSchema = z.object({
  // Checkpointing settings
  enableCheckpointing: z.boolean().default(false),
  checkpointInterval: z.number().min(1).default(5),
  maxCheckpoints: z.number().min(1).max(100).default(10),

  // Storage settings
  checkpointDirectory: z.string().default('./.optimization-checkpoints'),
  compressionEnabled: z.boolean().default(true),
  encryptionEnabled: z.boolean().default(false),
  encryptionKey: z.string().optional(),

  // Serialization settings
  serializationFormat: z.enum(['json', 'binary']).default('json'),
  enableVersioning: z.boolean().default(true),
  stateVersion: z.string().default('1.0.0'),

  // Validation settings
  enableStateValidation: z.boolean().default(true),
  strictValidation: z.boolean().default(false),
  validateChecksums: z.boolean().default(true),

  // Recovery settings
  enableAutoRecovery: z.boolean().default(true),
  maxRecoveryAttempts: z.number().min(1).max(10).default(3),
  recoveryStrategy: z.enum(['latest', 'stable', 'manual']).default('latest'),

  // Performance settings
  atomicWrites: z.boolean().default(true),
  enableAsyncCheckpoints: z.boolean().default(true),
  checkpointTimeoutMs: z.number().min(1000).max(300000).default(30000),

  // Cleanup settings
  enableAutoCleanup: z.boolean().default(true),
  cleanupOlderThanDays: z.number().min(1).max(365).default(7),
  retainLastNCheckpoints: z.number().min(1).max(50).default(5),
});

export type StateManagementConfig = z.infer<typeof StateManagementConfigSchema>;

/**
 * Serializable optimization state
 */
export interface SerializableOptimizationState {
  // Basic state info
  stateId: string;
  timestamp: Date;
  version: string;
  passNumber: number;

  // Core optimization data
  frequencyMap: PatternFrequencyMap;
  consolidationResult?: ConsolidationResult;
  metrics: PassMetrics[];

  // Error tracking
  errors: string[];
  warnings: string[];

  // Metadata
  metadata: {
    totalPasses: number;
    optimizationStrategy: string;
    configSnapshot: Record<string, any>;
    resourceUsage: {
      memoryUsage: NodeJS.MemoryUsage;
      timestamp: Date;
    };
  };

  // Validation
  checksum?: string;
  dependencies?: string[];
}

/**
 * Checkpoint metadata
 */
export interface CheckpointMetadata {
  checkpointId: string;
  stateId: string;
  passNumber: number;
  timestamp: Date;
  filePath: string;
  fileSize: number;
  checksum: string;
  version: string;
  isStable: boolean;
  tags: string[];
  description?: string;
}

/**
 * State validation result
 */
export interface StateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checksum: string;
  validationDuration: number;
  validatedFields: string[];
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  recoveredState?: SerializableOptimizationState;
  sourceCheckpoint?: CheckpointMetadata;
  recoveryDuration: number;
  error?: string;
  fallbacksAttempted: number;
}

/**
 * Checkpoint operation result
 */
export interface CheckpointResult {
  success: boolean;
  checkpointId?: string;
  filePath?: string;
  metadata?: CheckpointMetadata;
  duration: number;
  error?: string;
}

/**
 * State serialization utilities
 */
export class StateSerializer {
  private config: StateManagementConfig;

  constructor(config: StateManagementConfig) {
    this.config = config;
  }

  /**
   * Serialize state to string format
   */
  public async serialize(state: SerializableOptimizationState): Promise<string> {
    try {
      // Add checksum if validation is enabled
      if (this.config.enableStateValidation) {
        const stateData = { ...state };
        delete stateData.checksum; // Remove existing checksum before calculating
        stateData.checksum = this.calculateChecksum(stateData);
        state = stateData;
      }

      switch (this.config.serializationFormat) {
        case 'json':
          return JSON.stringify(state, null, this.config.compressionEnabled ? 0 : 2);
        case 'binary':
          // For binary format, we'll use JSON as base and then encode
          const jsonString = JSON.stringify(state);
          return Buffer.from(jsonString).toString('base64');
        default:
          throw new Error(`Unsupported serialization format: ${this.config.serializationFormat}`);
      }
    } catch (error) {
      throw new Error(
        `State serialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Deserialize state from string format
   */
  public async deserialize(data: string): Promise<SerializableOptimizationState> {
    try {
      let state: SerializableOptimizationState;

      switch (this.config.serializationFormat) {
        case 'json':
          state = JSON.parse(data);
          break;
        case 'binary':
          const jsonString = Buffer.from(data, 'base64').toString();
          state = JSON.parse(jsonString);
          break;
        default:
          throw new Error(`Unsupported serialization format: ${this.config.serializationFormat}`);
      }

      // Convert date strings back to Date objects
      state.timestamp = new Date(state.timestamp);
      state.metrics = state.metrics.map((metric) => ({
        ...metric,
        timestamp: new Date(metric.timestamp),
      }));
      state.metadata.resourceUsage.timestamp = new Date(state.metadata.resourceUsage.timestamp);

      return state;
    } catch (error) {
      throw new Error(
        `State deserialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Calculate checksum for state validation
   */
  public calculateChecksum(state: Partial<SerializableOptimizationState>): string {
    const stateString = JSON.stringify(state, Object.keys(state).sort());
    return createHash('sha256').update(stateString).digest('hex');
  }
}

/**
 * Comprehensive state management system
 */
export class StateManager {
  private config: StateManagementConfig;
  private serializer: StateSerializer;
  private checkpoints: Map<string, CheckpointMetadata> = new Map();
  private activeCheckpoints: Set<string> = new Set();

  constructor(config: Partial<StateManagementConfig> = {}) {
    this.config = StateManagementConfigSchema.parse(config);
    this.serializer = new StateSerializer(this.config);
  }

  /**
   * Initialize state management system
   */
  public async initialize(): Promise<void> {
    try {
      // Create checkpoint directory
      await mkdir(this.config.checkpointDirectory, { recursive: true });

      // Load existing checkpoints
      await this.loadExistingCheckpoints();

      // Perform cleanup if enabled
      if (this.config.enableAutoCleanup) {
        await this.performCleanup();
      }

      this.logDebug('State management system initialized');
    } catch (error) {
      throw new Error(
        `State manager initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a checkpoint of the current optimization state
   */
  public async createCheckpoint(
    state: SerializableOptimizationState,
    tags: string[] = [],
    description?: string
  ): Promise<CheckpointResult> {
    const startTime = Date.now();

    try {
      // Generate checkpoint ID
      const checkpointId = this.generateCheckpointId(state);

      // Validate state if enabled
      if (this.config.enableStateValidation) {
        const validation = await this.validateState(state);
        if (!validation.isValid) {
          throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Serialize state
      const serializedState = await this.serializer.serialize(state);

      // Determine file path
      const fileName = `checkpoint-${checkpointId}.${this.config.serializationFormat}`;
      const filePath = join(this.config.checkpointDirectory, fileName);

      // Atomic write
      if (this.config.atomicWrites) {
        await this.atomicWrite(filePath, serializedState);
      } else {
        await writeFile(filePath, serializedState, 'utf8');
      }

      // Get file stats
      const stats = await stat(filePath);

      // Create metadata
      const metadata: CheckpointMetadata = {
        checkpointId,
        stateId: state.stateId,
        passNumber: state.passNumber,
        timestamp: new Date(),
        filePath,
        fileSize: stats.size,
        checksum: this.serializer.calculateChecksum(state),
        version: state.version,
        isStable: this.determineStability(state),
        tags,
        description,
      };

      // Store metadata
      this.checkpoints.set(checkpointId, metadata);
      this.activeCheckpoints.add(checkpointId);

      // Save metadata index
      await this.saveCheckpointIndex();

      // Cleanup old checkpoints if needed
      if (this.checkpoints.size > this.config.maxCheckpoints) {
        await this.cleanupOldCheckpoints();
      }

      this.logDebug(`Checkpoint created: ${checkpointId} (pass ${state.passNumber})`);

      return {
        success: true,
        checkpointId,
        filePath,
        metadata,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Restore state from a checkpoint
   */
  public async restoreFromCheckpoint(checkpointId: string): Promise<RecoveryResult> {
    const startTime = Date.now();
    const fallbacksAttempted = 0;

    try {
      const metadata = this.checkpoints.get(checkpointId);
      if (!metadata) {
        throw new Error(`Checkpoint not found: ${checkpointId}`);
      }

      // Check if file exists
      await access(metadata.filePath);

      // Read checkpoint data
      const data = await readFile(metadata.filePath, 'utf8');

      // Deserialize state
      const state = await this.serializer.deserialize(data);

      // Validate restored state
      if (this.config.enableStateValidation) {
        const validation = await this.validateState(state);
        if (!validation.isValid) {
          if (this.config.strictValidation) {
            throw new Error(`Restored state validation failed: ${validation.errors.join(', ')}`);
          } else {
            this.logDebug(`State validation warnings: ${validation.warnings.join(', ')}`);
          }
        }
      }

      this.logDebug(`State restored from checkpoint: ${checkpointId}`);

      return {
        success: true,
        recoveredState: state,
        sourceCheckpoint: metadata,
        recoveryDuration: Date.now() - startTime,
        fallbacksAttempted,
      };
    } catch (error) {
      // Try fallback recovery if enabled
      if (this.config.enableAutoRecovery && fallbacksAttempted < this.config.maxRecoveryAttempts) {
        const fallbackResult = await this.attemptFallbackRecovery(checkpointId);
        if (fallbackResult.success) {
          return {
            ...fallbackResult,
            fallbacksAttempted: fallbacksAttempted + 1,
          };
        }
      }

      return {
        success: false,
        recoveryDuration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        fallbacksAttempted,
      };
    }
  }

  /**
   * Get latest stable checkpoint
   */
  public getLatestStableCheckpoint(): CheckpointMetadata | null {
    const stableCheckpoints = Array.from(this.checkpoints.values())
      .filter((checkpoint) => checkpoint.isStable)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return stableCheckpoints[0] || null;
  }

  /**
   * List all available checkpoints
   */
  public listCheckpoints(): CheckpointMetadata[] {
    return Array.from(this.checkpoints.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Delete a specific checkpoint
   */
  public async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const metadata = this.checkpoints.get(checkpointId);
      if (!metadata) {
        return false;
      }

      // Delete file
      await unlink(metadata.filePath);

      // Remove from tracking
      this.checkpoints.delete(checkpointId);
      this.activeCheckpoints.delete(checkpointId);

      // Update index
      await this.saveCheckpointIndex();

      this.logDebug(`Checkpoint deleted: ${checkpointId}`);
      return true;
    } catch (error) {
      this.logDebug(`Failed to delete checkpoint ${checkpointId}: ${error}`);
      return false;
    }
  }

  /**
   * Validate optimization state
   */
  public async validateState(state: SerializableOptimizationState): Promise<StateValidationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedFields: string[] = [];

    try {
      // Validate required fields
      if (!state.stateId) errors.push('Missing stateId');
      if (!state.timestamp) errors.push('Missing timestamp');
      if (!state.version) errors.push('Missing version');
      if (typeof state.passNumber !== 'number') errors.push('Invalid passNumber');

      validatedFields.push('stateId', 'timestamp', 'version', 'passNumber');

      // Validate frequency map
      if (state.frequencyMap) {
        if (typeof state.frequencyMap !== 'object') {
          errors.push('Invalid frequencyMap format');
        } else {
          validatedFields.push('frequencyMap');
        }
      }

      // Validate metrics array
      if (!Array.isArray(state.metrics)) {
        errors.push('Metrics must be an array');
      } else {
        for (let i = 0; i < state.metrics.length; i++) {
          const metric = state.metrics[i];
          if (typeof metric.passNumber !== 'number') {
            errors.push(`Invalid passNumber in metric ${i}`);
          }
          if (!metric.timestamp) {
            errors.push(`Missing timestamp in metric ${i}`);
          }
        }
        validatedFields.push('metrics');
      }

      // Validate checksum if present
      if (state.checksum && this.config.validateChecksums) {
        const stateForChecksum = { ...state };
        delete stateForChecksum.checksum;
        const calculatedChecksum = this.serializer.calculateChecksum(stateForChecksum);

        if (calculatedChecksum !== state.checksum) {
          errors.push('Checksum validation failed');
        } else {
          validatedFields.push('checksum');
        }
      }

      // Validate metadata
      if (state.metadata) {
        if (!state.metadata.totalPasses || typeof state.metadata.totalPasses !== 'number') {
          warnings.push('Missing or invalid totalPasses in metadata');
        }
        if (!state.metadata.optimizationStrategy) {
          warnings.push('Missing optimizationStrategy in metadata');
        }
        validatedFields.push('metadata');
      }

      const checksum = this.serializer.calculateChecksum(state);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        checksum,
        validationDuration: Date.now() - startTime,
        validatedFields,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings,
        checksum: '',
        validationDuration: Date.now() - startTime,
        validatedFields,
      };
    }
  }

  /**
   * Get state management configuration
   */
  public getConfig(): StateManagementConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<StateManagementConfig>): void {
    this.config = StateManagementConfigSchema.parse({
      ...this.config,
      ...newConfig,
    });
  }

  // Private methods

  private generateCheckpointId(state: SerializableOptimizationState): string {
    const components = [
      state.stateId,
      state.passNumber.toString(),
      state.timestamp.toISOString(),
      state.version,
    ];
    const hash = createHash('md5').update(components.join('-')).digest('hex');
    return `${state.passNumber}-${hash.substring(0, 8)}`;
  }

  private determineStability(state: SerializableOptimizationState): boolean {
    // Consider a checkpoint stable if:
    // 1. No recent errors
    // 2. Pass number is a multiple of checkpoint interval
    // 3. Has valid consolidation result
    const hasRecentErrors = state.errors.length > 0;
    const isIntervalPass = state.passNumber % this.config.checkpointInterval === 0;
    const hasValidResult = state.consolidationResult !== undefined;

    return !hasRecentErrors && isIntervalPass && hasValidResult;
  }

  private async atomicWrite(filePath: string, data: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    try {
      await writeFile(tempPath, data, 'utf8');
      // Note: In a production environment, you would use fs.rename for atomic operation
      // For now, we'll use a simple approach
      await writeFile(filePath, data, 'utf8');
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    } catch (error) {
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async loadExistingCheckpoints(): Promise<void> {
    try {
      const indexPath = join(this.config.checkpointDirectory, 'index.json');
      const indexData = await readFile(indexPath, 'utf8');
      const checkpointList = JSON.parse(indexData) as CheckpointMetadata[];

      for (const metadata of checkpointList) {
        // Convert timestamp strings back to Date objects
        metadata.timestamp = new Date(metadata.timestamp);
        this.checkpoints.set(metadata.checkpointId, metadata);
        this.activeCheckpoints.add(metadata.checkpointId);
      }

      this.logDebug(`Loaded ${checkpointList.length} existing checkpoints`);
    } catch (error) {
      // Index file doesn't exist or is corrupted - start fresh
      this.logDebug('No existing checkpoint index found, starting fresh');
    }
  }

  private async saveCheckpointIndex(): Promise<void> {
    try {
      const indexPath = join(this.config.checkpointDirectory, 'index.json');
      const checkpointList = Array.from(this.checkpoints.values());
      await writeFile(indexPath, JSON.stringify(checkpointList, null, 2), 'utf8');
    } catch (error) {
      this.logDebug(`Failed to save checkpoint index: ${error}`);
    }
  }

  private async cleanupOldCheckpoints(): Promise<void> {
    const sortedCheckpoints = Array.from(this.checkpoints.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Keep only the latest N checkpoints
    const toDelete = sortedCheckpoints.slice(this.config.retainLastNCheckpoints);

    for (const metadata of toDelete) {
      await this.deleteCheckpoint(metadata.checkpointId);
    }
  }

  private async performCleanup(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupOlderThanDays);

    const checkpointsToDelete = Array.from(this.checkpoints.values()).filter(
      (metadata) => metadata.timestamp < cutoffDate
    );

    for (const metadata of checkpointsToDelete) {
      await this.deleteCheckpoint(metadata.checkpointId);
    }

    if (checkpointsToDelete.length > 0) {
      this.logDebug(`Cleaned up ${checkpointsToDelete.length} old checkpoints`);
    }
  }

  private async attemptFallbackRecovery(originalCheckpointId: string): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      // Strategy: try the latest stable checkpoint
      const stableCheckpoint = this.getLatestStableCheckpoint();
      if (stableCheckpoint && stableCheckpoint.checkpointId !== originalCheckpointId) {
        this.logDebug(`Attempting fallback recovery using ${stableCheckpoint.checkpointId}`);
        return await this.restoreFromCheckpoint(stableCheckpoint.checkpointId);
      }

      // Strategy: try the most recent checkpoint
      const recentCheckpoints = this.listCheckpoints();
      for (const checkpoint of recentCheckpoints) {
        if (checkpoint.checkpointId !== originalCheckpointId) {
          try {
            this.logDebug(`Attempting fallback recovery using ${checkpoint.checkpointId}`);
            return await this.restoreFromCheckpoint(checkpoint.checkpointId);
          } catch {
            // Continue to next checkpoint
            continue;
          }
        }
      }

      throw new Error('No valid fallback checkpoints available');
    } catch (error) {
      return {
        success: false,
        recoveryDuration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        fallbacksAttempted: 0,
      };
    }
  }

  private logDebug(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[StateManager] ${message}`);
    }
  }
}

/**
 * Factory function to create a StateManager instance
 */
export function createStateManager(config: Partial<StateManagementConfig> = {}): StateManager {
  return new StateManager(config);
}

/**
 * Utility function to validate state management configuration
 */
export function validateStateManagementConfig(config: unknown): StateManagementConfig {
  return StateManagementConfigSchema.parse(config);
}

/**
 * Create a serializable state from optimization state
 */
export function createSerializableState(
  stateId: string,
  passNumber: number,
  frequencyMap: PatternFrequencyMap,
  metrics: PassMetrics[],
  consolidationResult?: ConsolidationResult,
  errors: string[] = [],
  warnings: string[] = [],
  metadata: Partial<SerializableOptimizationState['metadata']> = {}
): SerializableOptimizationState {
  return {
    stateId,
    timestamp: new Date(),
    version: '1.0.0',
    passNumber,
    frequencyMap,
    consolidationResult,
    metrics,
    errors,
    warnings,
    metadata: {
      totalPasses: passNumber,
      optimizationStrategy: 'balanced',
      configSnapshot: {},
      resourceUsage: {
        memoryUsage: process.memoryUsage(),
        timestamp: new Date(),
      },
      ...metadata,
    },
  };
}
