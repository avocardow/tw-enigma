import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createHash } from 'crypto';
import { createLogger } from './logger.ts';
import { type EnigmaConfig } from './config.ts';

const logger = createLogger('config-backup');

/**
 * Backup metadata interface
 */
export interface BackupMetadata {
  id: string;
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  version: string;
  checksum: string;
  size: number;
  description?: string;
  tags: string[];
  isAutomatic: boolean;
}

/**
 * Backup verification result
 */
export interface BackupVerification {
  isValid: boolean;
  checksumMatch: boolean;
  fileExists: boolean;
  isReadable: boolean;
  isValidJson: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Backup restoration result
 */
export interface RestoreResult {
  success: boolean;
  backupId: string;
  originalPath: string;
  restoredAt: Date;
  errors: string[];
  warnings: string[];
  backupCreated?: string; // Path to backup of current config before restore
}

/**
 * Backup retention policy
 */
export interface RetentionPolicy {
  maxBackups: number;
  maxAge: number; // in days
  keepDaily: number; // keep daily backups for N days
  keepWeekly: number; // keep weekly backups for N weeks
  keepMonthly: number; // keep monthly backups for N months
  autoCleanup: boolean;
}

/**
 * Backup options
 */
export interface BackupOptions {
  description?: string;
  tags?: string[];
  compress?: boolean;
  encrypt?: boolean;
  includeMetadata?: boolean;
}

/**
 * Default retention policy
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  maxBackups: 50,
  maxAge: 90, // 90 days
  keepDaily: 7,
  keepWeekly: 4,
  keepMonthly: 12,
  autoCleanup: true
};

/**
 * Configuration backup manager
 */
export class ConfigBackup extends EventEmitter {
  private configPath: string;
  private backupDir: string;
  private metadataFile: string;
  private retentionPolicy: RetentionPolicy;
  private backups: Map<string, BackupMetadata> = new Map();
  
  constructor(
    configPath: string,
    backupDir?: string,
    retentionPolicy?: Partial<RetentionPolicy>
  ) {
    super();
    this.configPath = configPath;
    this.backupDir = backupDir || join(dirname(configPath), '.backups');
    this.metadataFile = join(this.backupDir, 'metadata.json');
    this.retentionPolicy = { ...DEFAULT_RETENTION_POLICY, ...retentionPolicy };
    
    this.initializeBackupSystem();
    this.loadBackupMetadata();
    
    logger.debug('ConfigBackup initialized', {
      configPath: this.configPath,
      backupDir: this.backupDir,
      backupCount: this.backups.size
    });
  }
  
  /**
   * Initialize backup system
   */
  private initializeBackupSystem(): void {
    // Ensure backup directory exists
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
      logger.info(`Created backup directory: ${this.backupDir}`);
    }
    
    // Create subdirectories for organization
    const subdirs = ['automatic', 'manual', 'migration', 'emergency'];
    for (const subdir of subdirs) {
      const subdirPath = join(this.backupDir, subdir);
      if (!existsSync(subdirPath)) {
        mkdirSync(subdirPath, { recursive: true });
      }
    }
  }
  
  /**
   * Load backup metadata
   */
  private loadBackupMetadata(): void {
    if (existsSync(this.metadataFile)) {
      try {
        const metadataContent = readFileSync(this.metadataFile, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        
        for (const backup of metadata.backups || []) {
          this.backups.set(backup.id, {
            ...backup,
            timestamp: new Date(backup.timestamp)
          });
        }
        
        logger.debug(`Loaded ${this.backups.size} backup entries from metadata`);
      } catch (error) {
        logger.warn('Failed to load backup metadata', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  
  /**
   * Save backup metadata
   */
  private saveBackupMetadata(): void {
    try {
      const metadata = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        retentionPolicy: this.retentionPolicy,
        backups: Array.from(this.backups.values()).map(backup => ({
          ...backup,
          timestamp: backup.timestamp.toISOString()
        }))
      };
      
      writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
      logger.debug('Backup metadata saved');
    } catch (error) {
      logger.error('Failed to save backup metadata', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  /**
   * Create a backup of the configuration
   */
  public async createBackup(options: BackupOptions = {}): Promise<BackupMetadata> {
    const {
      description,
      tags = [],
      compress = false,
      encrypt = false,
      includeMetadata = true
    } = options;
    
    if (!existsSync(this.configPath)) {
      throw new Error(`Configuration file not found: ${this.configPath}`);
    }
    
    this.emit('backup:start', { configPath: this.configPath });
    
    try {
      // Generate backup ID and paths
      const timestamp = new Date();
      const backupId = this.generateBackupId(timestamp);
      const backupSubdir = description ? 'manual' : 'automatic';
      const backupFilename = `${backupId}.json`;
      const backupPath = join(this.backupDir, backupSubdir, backupFilename);
      
      // Read and process configuration
      const configContent = readFileSync(this.configPath, 'utf-8');
      let backupContent = configContent;
      
      // Add metadata if requested
      if (includeMetadata) {
        const config = JSON.parse(configContent);
        const configWithMetadata = {
          ...config,
          _backup: {
            id: backupId,
            originalPath: this.configPath,
            createdAt: timestamp.toISOString(),
            description,
            tags,
            version: config._version?.version || 'unknown'
          }
        };
        backupContent = JSON.stringify(configWithMetadata, null, 2);
      }
      
      // Calculate checksum
      const checksum = this.calculateChecksum(backupContent);
      
      // Write backup file
      writeFileSync(backupPath, backupContent, 'utf-8');
      
      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        originalPath: this.configPath,
        backupPath,
        timestamp,
        version: this.extractConfigVersion(configContent),
        checksum,
        size: Buffer.byteLength(backupContent, 'utf-8'),
        description,
        tags,
        isAutomatic: !description
      };
      
      // Store metadata
      this.backups.set(backupId, metadata);
      this.saveBackupMetadata();
      
      // Apply retention policy
      if (this.retentionPolicy.autoCleanup) {
        await this.applyRetentionPolicy();
      }
      
      this.emit('backup:complete', metadata);
      logger.info(`Configuration backup created: ${backupId}`);
      
      return metadata;
      
    } catch (error) {
      this.emit('backup:error', error);
      logger.error('Failed to create backup', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  
  /**
   * Restore configuration from backup
   */
  public async restoreFromBackup(backupId: string, createBackupBeforeRestore = true): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      backupId,
      originalPath: this.configPath,
      restoredAt: new Date(),
      errors: [],
      warnings: []
    };
    
    this.emit('restore:start', { backupId });
    
    try {
      // Find backup metadata
      const backup = this.backups.get(backupId);
      if (!backup) {
        result.errors.push(`Backup not found: ${backupId}`);
        return result;
      }
      
      // Verify backup integrity
      const verification = await this.verifyBackup(backupId);
      if (!verification.isValid) {
        result.errors.push(`Backup verification failed: ${verification.errors.join(', ')}`);
        return result;
      }
      
      // Create backup of current configuration before restore
      if (createBackupBeforeRestore && existsSync(this.configPath)) {
        try {
          const preRestoreBackup = await this.createBackup({
            description: `Pre-restore backup before restoring ${backupId}`,
            tags: ['pre-restore', 'emergency']
          });
          result.backupCreated = preRestoreBackup.backupPath;
        } catch (error) {
          result.warnings.push(`Failed to create pre-restore backup: ${error}`);
        }
      }
      
      // Read backup content
      const backupContent = readFileSync(backup.backupPath, 'utf-8');
      let restoredContent = backupContent;
      
      // Remove backup metadata if present
      try {
        const backupData = JSON.parse(backupContent);
        if (backupData._backup) {
          const { _backup, ...originalConfig } = backupData;
          restoredContent = JSON.stringify(originalConfig, null, 2);
        }
      } catch (error) {
        // If not valid JSON, use content as-is
        result.warnings.push('Backup content is not valid JSON, restoring as-is');
      }
      
      // Ensure target directory exists
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      
      // Write restored configuration
      writeFileSync(this.configPath, restoredContent, 'utf-8');
      
      result.success = true;
      this.emit('restore:complete', result);
      logger.info(`Configuration restored from backup: ${backupId}`);
      
    } catch (error) {
      result.errors.push(`Restore failed: ${error}`);
      this.emit('restore:error', error);
      logger.error('Failed to restore from backup', { error: error instanceof Error ? error.message : String(error) });
    }
    
    return result;
  }
  
  /**
   * Verify backup integrity
   */
  public async verifyBackup(backupId: string): Promise<BackupVerification> {
    // Reload backup metadata from disk to ensure checksum and file info are current
    this.loadBackupMetadata();
    const verification: BackupVerification = {
      isValid: false,
      checksumMatch: false,
      fileExists: false,
      isReadable: false,
      isValidJson: false,
      errors: [],
      warnings: []
    };
    
    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        verification.errors.push(`Backup metadata not found: ${backupId}`);
        return verification;
      }
      
      // Check if backup file exists
      verification.fileExists = existsSync(backup.backupPath);
      if (!verification.fileExists) {
        verification.errors.push(`Backup file not found: ${backup.backupPath}`);
        return verification;
      }
      
      // Check if file is readable
      try {
        const content = readFileSync(backup.backupPath, 'utf-8');
        verification.isReadable = true;
        
        // Verify checksum
        const currentChecksum = this.calculateChecksum(content);
        verification.checksumMatch = currentChecksum === backup.checksum;
        if (!verification.checksumMatch) {
          verification.errors.push('Corrupted backup: Checksum mismatch - backup may be corrupted');
        }
        
        // Check if content is valid JSON
        try {
          JSON.parse(content);
          verification.isValidJson = true;
        } catch (error) {
          verification.warnings.push('Backup content is not valid JSON');
        }
        
      } catch (error) {
        verification.errors.push(`Failed to read backup file: ${error}`);
      }
      
      // Final validity assignment: after all checks
      verification.isValid = verification.fileExists && verification.isReadable && verification.checksumMatch;
      
    } catch (error) {
      verification.errors.push(`Verification failed: ${error}`);
    }
    
    return verification;
  }
  
  /**
   * List all backups
   */
  public listBackups(filter?: {
    tags?: string[];
    isAutomatic?: boolean;
    fromDate?: Date;
    toDate?: Date;
  }): BackupMetadata[] {
    let backups = Array.from(this.backups.values());
    
    if (filter) {
      if (filter.tags && filter.tags.length > 0) {
        backups = backups.filter(backup => 
          filter.tags!.some(tag => backup.tags.includes(tag))
        );
      }
      
      if (filter.isAutomatic !== undefined) {
        backups = backups.filter(backup => backup.isAutomatic === filter.isAutomatic);
      }
      
      if (filter.fromDate) {
        backups = backups.filter(backup => backup.timestamp >= filter.fromDate!);
      }
      
      if (filter.toDate) {
        backups = backups.filter(backup => backup.timestamp <= filter.toDate!);
      }
    }
    
    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Delete a backup
   */
  public async deleteBackup(backupId: string, force = false): Promise<boolean> {
    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        logger.warn(`Backup not found for deletion: ${backupId}`);
        return false;
      }
      
      // Safety check for recent backups
      const age = Date.now() - backup.timestamp.getTime();
      const oneHour = 60 * 60 * 1000;
      
      if (!force && age < oneHour) {
        logger.warn(`Refusing to delete recent backup without force flag: ${backupId}`);
        return false;
      }
      
      // Delete backup file
      if (existsSync(backup.backupPath)) {
        unlinkSync(backup.backupPath);
      }
      
      // Remove from metadata
      this.backups.delete(backupId);
      this.saveBackupMetadata();
      
      this.emit('backup:deleted', { backupId });
      logger.info(`Backup deleted: ${backupId}`);
      
      return true;
      
    } catch (error) {
              logger.error(`Failed to delete backup ${backupId}`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
  
  /**
   * Apply retention policy
   */
  public async applyRetentionPolicy(): Promise<{
    deleted: string[];
    kept: string[];
    errors: string[];
  }> {
    const result = {
      deleted: [] as string[],
      kept: [] as string[],
      errors: [] as string[]
    };
    
    try {
      const allBackups = this.listBackups();
      const now = new Date();
      
      // Group backups by type and age
      const automaticBackups = allBackups.filter(b => b.isAutomatic);
      const manualBackups = allBackups.filter(b => !b.isAutomatic);
      
      // Apply max age policy
      for (const backup of allBackups) {
        const age = (now.getTime() - backup.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        if (age > this.retentionPolicy.maxAge) {
          if (await this.deleteBackup(backup.id, true)) {
            result.deleted.push(backup.id);
          } else {
            result.errors.push(`Failed to delete old backup: ${backup.id}`);
          }
        }
      }
      
      // Apply max backups policy for automatic backups
      if (automaticBackups.length > this.retentionPolicy.maxBackups) {
        const toDelete = automaticBackups
          .slice(this.retentionPolicy.maxBackups)
          .map(b => b.id);
        
        for (const backupId of toDelete) {
          if (await this.deleteBackup(backupId, true)) {
            result.deleted.push(backupId);
          } else {
            result.errors.push(`Failed to delete excess backup: ${backupId}`);
          }
        }
      }
      
      // Keep track of retained backups
      const remainingBackups = this.listBackups();
      result.kept = remainingBackups.map(b => b.id);
      
      if (result.deleted.length > 0) {
        logger.info(`Retention policy applied: deleted ${result.deleted.length} backups`);
      }
      
    } catch (error) {
      result.errors.push(`Retention policy failed: ${error}`);
      logger.error('Failed to apply retention policy', { error: error instanceof Error ? error.message : String(error) });
    }
    
    return result;
  }
  
  /**
   * Get backup statistics
   */
  public getBackupStatistics(): {
    totalBackups: number;
    automaticBackups: number;
    manualBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    corruptedBackups: number;
  } {
    const backups = Array.from(this.backups.values());
    
    return {
      totalBackups: backups.length,
      automaticBackups: backups.filter(b => b.isAutomatic).length,
      manualBackups: backups.filter(b => !b.isAutomatic).length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      oldestBackup: backups.length > 0 ? new Date(Math.min(...backups.map(b => b.timestamp.getTime()))) : undefined,
      newestBackup: backups.length > 0 ? new Date(Math.max(...backups.map(b => b.timestamp.getTime()))) : undefined,
      corruptedBackups: 0 // Would need to run verification on all backups
    };
  }
  
  /**
   * Generate backup ID
   */
  private generateBackupId(timestamp: Date): string {
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const random = Math.random().toString(36).substring(2, 8);
    return `${dateStr}-${random}`;
  }
  
  /**
   * Calculate checksum for content
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }
  
  /**
   * Extract configuration version from content
   */
  private extractConfigVersion(content: string): string {
    try {
      const config = JSON.parse(content);
      return config._version?.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * Create emergency backup
   */
  public async createEmergencyBackup(reason: string): Promise<BackupMetadata> {
    return this.createBackup({
      description: `Emergency backup: ${reason}`,
      tags: ['emergency', 'critical'],
      includeMetadata: true
    });
  }
  
  /**
   * Get latest backup
   */
  public getLatestBackup(): BackupMetadata | null {
    const backups = this.listBackups();
    return backups.length > 0 ? backups[0] : null;
  }
  
  /**
   * Cleanup corrupted backups
   */
  public async cleanupCorruptedBackups(): Promise<string[]> {
    const deleted: string[] = [];
    
    for (const [backupId] of this.backups) {
      const verification = await this.verifyBackup(backupId);
      if (!verification.isValid) {
        if (await this.deleteBackup(backupId, true)) {
          deleted.push(backupId);
        }
      }
    }
    
    return deleted;
  }
}

/**
 * Create configuration backup manager
 */
export function createConfigBackup(
  configPath: string,
  backupDir?: string,
  retentionPolicy?: Partial<RetentionPolicy>
): ConfigBackup {
  return new ConfigBackup(configPath, backupDir, retentionPolicy);
}

/**
 * Quick backup utility
 */
export async function backupConfig(
  configPath: string,
  options?: BackupOptions
): Promise<BackupMetadata> {
  const backup = new ConfigBackup(configPath);
  return backup.createBackup(options);
}

/**
 * Quick restore utility
 */
export async function restoreConfig(
  configPath: string,
  backupId: string
): Promise<RestoreResult> {
  const backup = new ConfigBackup(configPath);
  return backup.restoreFromBackup(backupId);
}

/**
 * Export for testing and advanced usage
 */
export {
  DEFAULT_RETENTION_POLICY as defaultRetentionPolicy,
  ConfigBackup as ConfigBackupClass
}; 