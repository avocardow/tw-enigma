import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createLogger } from '../../utils/logger';
import { BenchmarkReport, BenchmarkStorage } from '../types';

const logger = createLogger('BaselineManager');

/**
 * Configuration for baseline management
 */
export interface BaselineConfig {
  storageDir: string;
  autoUpdate: boolean;
  retentionPolicy: {
    maxBaselines: number;
    maxAge: number; // in milliseconds
  };
  naming: {
    pattern: string; // e.g., 'baseline-{suite}-{version}-{timestamp}'
    includeGitCommit: boolean;
    includeEnvironment: boolean;
  };
}

/**
 * Baseline metadata for tracking and selection
 */
export interface BaselineMetadata {
  id: string;
  suite: string;
  version: string;
  timestamp: Date;
  gitCommit?: string;
  environment: {
    platform: string;
    nodeVersion: string;
    cpuCores: number;
  };
  tags: string[];
  description?: string;
  isDefault: boolean;
}

/**
 * Default baseline configuration
 */
const DEFAULT_BASELINE_CONFIG: BaselineConfig = {
  storageDir: './benchmarks/baselines',
  autoUpdate: false,
  retentionPolicy: {
    maxBaselines: 50,
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  naming: {
    pattern: 'baseline-{suite}-{version}-{timestamp}',
    includeGitCommit: true,
    includeEnvironment: true,
  },
};

/**
 * Manages baseline benchmarks for comparison
 */
export class BaselineManager {
  private config: BaselineConfig;
  private storage: BenchmarkStorage;

  constructor(config: Partial<BaselineConfig> = {}, storage?: BenchmarkStorage) {
    this.config = { ...DEFAULT_BASELINE_CONFIG, ...config };
    
    // Use provided storage or default filesystem storage
    this.storage = storage || {
      type: 'filesystem',
      config: { directory: this.config.storageDir },
      store: this.storeToFilesystem.bind(this),
      retrieve: this.retrieveFromFilesystem.bind(this),
      list: this.listFromFilesystem.bind(this),
    };

    logger.debug('BaselineManager initialized', {
      storageDir: this.config.storageDir,
      autoUpdate: this.config.autoUpdate,
    });
  }

  /**
   * Store a new baseline
   */
  async storeBaseline(
    report: BenchmarkReport, 
    options: {
      version?: string;
      tags?: string[];
      description?: string;
      setAsDefault?: boolean;
    } = {}
  ): Promise<string> {
    try {
      const metadata = await this.createBaselineMetadata(report, options);
      const baselineId = this.generateBaselineId(metadata);

      // Ensure storage directory exists
      await this.ensureStorageDir();

      // Store the report
      await this.storage.store(report);

      // Store metadata
      await this.storeMetadata(baselineId, metadata);

      // Set as default if requested
      if (options.setAsDefault) {
        await this.setDefaultBaseline(baselineId);
      }

      // Clean up old baselines if needed
      if (this.config.retentionPolicy.maxBaselines > 0) {
        await this.cleanupOldBaselines();
      }

      logger.info('Baseline stored successfully', {
        baselineId,
        suite: report.suite,
        version: metadata.version,
        isDefault: options.setAsDefault,
      });

      return baselineId;
    } catch (error) {
      logger.error('Failed to store baseline', { error, suite: report.suite });
      throw error;
    }
  }

  /**
   * Retrieve a baseline by ID
   */
  async getBaseline(baselineId: string): Promise<BenchmarkReport | null> {
    try {
      const report = await this.storage.retrieve(baselineId);
      
      logger.debug('Baseline retrieved', { baselineId });
      return report;
    } catch (error) {
      logger.warn('Failed to retrieve baseline', { error, baselineId });
      return null;
    }
  }

  /**
   * Get the default baseline for a suite
   */
  async getDefaultBaseline(suiteName: string): Promise<BenchmarkReport | null> {
    try {
      const defaultId = await this.getDefaultBaselineId(suiteName);
      if (!defaultId) {
        logger.debug('No default baseline found', { suite: suiteName });
        return null;
      }

      return this.getBaseline(defaultId);
    } catch (error) {
      logger.warn('Failed to get default baseline', { error, suite: suiteName });
      return null;
    }
  }

  /**
   * Get the latest baseline for a suite
   */
  async getLatestBaseline(suiteName: string): Promise<BenchmarkReport | null> {
    try {
      const baselines = await this.listBaselines({ suite: suiteName });
      
      if (baselines.length === 0) {
        return null;
      }

      // Sort by timestamp and get the latest
      const latest = baselines.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      return this.getBaseline(latest.id);
    } catch (error) {
      logger.warn('Failed to get latest baseline', { error, suite: suiteName });
      return null;
    }
  }

  /**
   * List available baselines with optional filters
   */
  async listBaselines(filters: {
    suite?: string;
    version?: string;
    tags?: string[];
    since?: Date;
    until?: Date;
  } = {}): Promise<BaselineMetadata[]> {
    try {
      const metadataFiles = await this.getMetadataFiles();
      const baselines: BaselineMetadata[] = [];

      for (const file of metadataFiles) {
        try {
          const metadata = await this.loadMetadata(file);
          
          // Apply filters
          if (this.matchesFilters(metadata, filters)) {
            baselines.push(metadata);
          }
        } catch (error) {
          logger.warn('Failed to load baseline metadata', { error, file });
        }
      }

      return baselines.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      logger.error('Failed to list baselines', { error });
      throw error;
    }
  }

  /**
   * Delete a baseline
   */
  async deleteBaseline(baselineId: string): Promise<boolean> {
    try {
      // Check if it's the default baseline
      const metadata = await this.loadMetadata(`${baselineId}.metadata.json`);
      if (metadata?.isDefault) {
        throw new Error('Cannot delete default baseline. Set another baseline as default first.');
      }

      // Delete report and metadata
      await Promise.all([
        this.deleteFile(join(this.config.storageDir, `${baselineId}.json`)),
        this.deleteFile(join(this.config.storageDir, `${baselineId}.metadata.json`)),
      ]);

      logger.info('Baseline deleted', { baselineId });
      return true;
    } catch (error) {
      logger.error('Failed to delete baseline', { error, baselineId });
      return false;
    }
  }

  /**
   * Set a baseline as the default for its suite
   */
  async setDefaultBaseline(baselineId: string): Promise<void> {
    try {
      const metadata = await this.loadMetadata(`${baselineId}.metadata.json`);
      if (!metadata) {
        throw new Error(`Baseline metadata not found: ${baselineId}`);
      }

      // Clear existing default for this suite
      await this.clearDefaultBaseline(metadata.suite);

      // Set new default
      metadata.isDefault = true;
      await this.storeMetadata(baselineId, metadata);

      logger.info('Default baseline set', { baselineId, suite: metadata.suite });
    } catch (error) {
      logger.error('Failed to set default baseline', { error, baselineId });
      throw error;
    }
  }

  /**
   * Update baseline configuration
   */
  updateConfig(config: Partial<BaselineConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Baseline configuration updated', { config });
  }

  /**
   * Get current configuration
   */
  getConfig(): BaselineConfig {
    return { ...this.config };
  }

  /**
   * Clean up old baselines based on retention policy
   */
  async cleanupOldBaselines(): Promise<void> {
    try {
      const baselines = await this.listBaselines();
      const now = Date.now();
      const { maxBaselines, maxAge } = this.config.retentionPolicy;

      // Sort by timestamp (newest first)
      const sortedBaselines = baselines.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const toDelete: string[] = [];

      // Remove baselines exceeding max count (keep defaults)
      if (maxBaselines > 0) {
        const excess = sortedBaselines.slice(maxBaselines).filter(b => !b.isDefault);
        toDelete.push(...excess.map(b => b.id));
      }

      // Remove baselines exceeding max age (keep defaults)
      if (maxAge > 0) {
        const expired = sortedBaselines.filter(b => 
          !b.isDefault && (now - b.timestamp.getTime()) > maxAge
        );
        toDelete.push(...expired.map(b => b.id));
      }

      // Delete the identified baselines
      for (const baselineId of [...new Set(toDelete)]) {
        await this.deleteBaseline(baselineId);
      }

      if (toDelete.length > 0) {
        logger.info('Cleaned up old baselines', { deleted: toDelete.length });
      }
    } catch (error) {
      logger.error('Failed to clean up old baselines', { error });
    }
  }

  /**
   * Create baseline metadata from report
   */
  private async createBaselineMetadata(
    report: BenchmarkReport,
    options: {
      version?: string;
      tags?: string[];
      description?: string;
    }
  ): Promise<BaselineMetadata> {
    const gitCommit = this.config.naming.includeGitCommit ? await this.getGitCommit() : undefined;
    
    return {
      id: '', // Will be set by generateBaselineId
      suite: report.suite,
      version: options.version || report.metadata.version || '1.0.0',
      timestamp: report.timestamp,
      gitCommit,
      environment: {
        platform: report.environment.platform,
        nodeVersion: report.environment.nodeVersion,
        cpuCores: report.environment.cpuCores,
      },
      tags: options.tags || [],
      description: options.description,
      isDefault: false,
    };
  }

  /**
   * Generate unique baseline ID
   */
  private generateBaselineId(metadata: BaselineMetadata): string {
    const timestamp = metadata.timestamp.toISOString().replace(/[:.]/g, '-');
    let id = this.config.naming.pattern
      .replace('{suite}', metadata.suite)
      .replace('{version}', metadata.version)
      .replace('{timestamp}', timestamp);

    if (this.config.naming.includeGitCommit && metadata.gitCommit) {
      id += `-${metadata.gitCommit.substring(0, 8)}`;
    }

    if (this.config.naming.includeEnvironment) {
      id += `-${metadata.environment.platform}-${metadata.environment.nodeVersion.replace(/\./g, '_')}`;
    }

    return id;
  }

  /**
   * Store metadata to filesystem
   */
  private async storeMetadata(baselineId: string, metadata: BaselineMetadata): Promise<void> {
    metadata.id = baselineId;
    const metadataPath = join(this.config.storageDir, `${baselineId}.metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load metadata from filesystem
   */
  private async loadMetadata(filename: string): Promise<BaselineMetadata | null> {
    try {
      const metadataPath = join(this.config.storageDir, filename);
      const content = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);
      
      // Convert timestamp string back to Date
      metadata.timestamp = new Date(metadata.timestamp);
      
      return metadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all metadata files
   */
  private async getMetadataFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.storageDir);
      return files.filter(file => file.endsWith('.metadata.json'));
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if metadata matches filters
   */
  private matchesFilters(
    metadata: BaselineMetadata,
    filters: {
      suite?: string;
      version?: string;
      tags?: string[];
      since?: Date;
      until?: Date;
    }
  ): boolean {
    if (filters.suite && metadata.suite !== filters.suite) {
      return false;
    }

    if (filters.version && metadata.version !== filters.version) {
      return false;
    }

    if (filters.tags && !filters.tags.every(tag => metadata.tags.includes(tag))) {
      return false;
    }

    if (filters.since && metadata.timestamp < filters.since) {
      return false;
    }

    if (filters.until && metadata.timestamp > filters.until) {
      return false;
    }

    return true;
  }

  /**
   * Get default baseline ID for a suite
   */
  private async getDefaultBaselineId(suiteName: string): Promise<string | null> {
    const baselines = await this.listBaselines({ suite: suiteName });
    const defaultBaseline = baselines.find(b => b.isDefault);
    return defaultBaseline?.id || null;
  }

  /**
   * Clear default status for all baselines of a suite
   */
  private async clearDefaultBaseline(suiteName: string): Promise<void> {
    const baselines = await this.listBaselines({ suite: suiteName });
    
    for (const baseline of baselines.filter(b => b.isDefault)) {
      baseline.isDefault = false;
      await this.storeMetadata(baseline.id, baseline);
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.storageDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Delete a file if it exists
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  /**
   * Get current git commit hash
   */
  private async getGitCommit(): Promise<string | undefined> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('git rev-parse HEAD');
      return stdout.trim();
    } catch (error) {
      logger.debug('Could not get git commit', { error });
      return undefined;
    }
  }

  /**
   * Filesystem storage implementation
   */
  private async storeToFilesystem(report: BenchmarkReport): Promise<string> {
    const filename = `${report.suite}-${report.timestamp.toISOString()}.json`;
    const filePath = join(this.config.storageDir, filename);
    
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    return filename;
  }

  /**
   * Filesystem retrieval implementation
   */
  private async retrieveFromFilesystem(id: string): Promise<BenchmarkReport> {
    const filePath = join(this.config.storageDir, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const report = JSON.parse(content);
    
    // Convert timestamp string back to Date
    report.timestamp = new Date(report.timestamp);
    
    return report;
  }

  /**
   * Filesystem listing implementation
   */
  private async listFromFilesystem(): Promise<BenchmarkReport[]> {
    const files = await fs.readdir(this.config.storageDir);
    const reportFiles = files.filter(file => file.endsWith('.json') && !file.includes('.metadata.'));
    
    const reports: BenchmarkReport[] = [];
    for (const file of reportFiles) {
      try {
        const report = await this.retrieveFromFilesystem(file.replace('.json', ''));
        reports.push(report);
      } catch (error) {
        logger.warn('Failed to load report file', { error, file });
      }
    }
    
    return reports;
  }
}