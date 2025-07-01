import { createLogger } from '../../utils/logger';
import { BenchmarkCase } from '../types';
import {
  ReplayConfig,
  WORKLOAD_DOMAINS,
  WorkloadDataset,
  WorkloadFilters,
  WorkloadManager,
  WorkloadMetadata,
} from './WorkloadManager';

const logger = createLogger('RealWorldLoader');

/**
 * Preset configurations for common workload scenarios
 */
export interface WorkloadPreset {
  name: string;
  description: string;
  filters: WorkloadFilters;
  replayConfig: ReplayConfig;
  expectedMetrics?: {
    minThroughput?: number;
    maxLatency?: number;
    maxMemoryUsage?: number;
  };
}

/**
 * Workload collection for batch operations
 */
export interface WorkloadCollection {
  name: string;
  description: string;
  workloads: Array<{
    metadata: WorkloadMetadata;
    weight: number; // Relative importance in collection
    config: ReplayConfig;
  }>;
  globalConfig: {
    concurrent: boolean;
    maxParallel: number;
    timeoutMs: number;
  };
}

/**
 * Real-world workload loading and management
 */
export class RealWorldLoader {
  private workloadManager: WorkloadManager;
  private presets: Map<string, WorkloadPreset> = new Map();
  private collections: Map<string, WorkloadCollection> = new Map();

  constructor(workloadsPath?: string) {
    this.workloadManager = new WorkloadManager(workloadsPath);
    this.initializePresets();

    logger.debug('RealWorldLoader initialized');
  }

  /**
   * Initialize the loader and workload manager
   */
  async initialize(): Promise<void> {
    await this.workloadManager.initialize();
    await this.loadCollections();

    logger.info('RealWorldLoader ready', {
      availableWorkloads: (await this.getAvailableWorkloads()).length,
      presets: this.presets.size,
      collections: this.collections.size,
    });
  }

  /**
   * Get all available workloads with optional filtering
   */
  async getAvailableWorkloads(filters?: WorkloadFilters): Promise<WorkloadMetadata[]> {
    return this.workloadManager.searchWorkloads('', filters);
  }

  /**
   * Load a specific workload by ID
   */
  async loadWorkload(id: string): Promise<WorkloadDataset | null> {
    try {
      const dataset = await this.workloadManager.loadWorkloadDataset(id);
      logger.debug('Workload loaded', { id, fileCount: dataset.files.length });
      return dataset;
    } catch (error) {
      logger.error('Failed to load workload', { id, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Create a benchmark case from a workload
   */
  async createBenchmarkCase(
    workloadId: string,
    config?: ReplayConfig
  ): Promise<BenchmarkCase | null> {
    try {
      const benchmarkCase = await this.workloadManager.createBenchmarkCase(workloadId, config);
      logger.debug('Benchmark case created', { workloadId, config });
      return benchmarkCase;
    } catch (error) {
      logger.error('Failed to create benchmark case', {
        workloadId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Load workloads using a preset configuration
   */
  async loadWithPreset(presetName: string): Promise<BenchmarkCase[]> {
    const preset = this.presets.get(presetName);
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    logger.info('Loading workloads with preset', { presetName });

    const workloads = await this.workloadManager.searchWorkloads('', preset.filters);
    const benchmarkCases: BenchmarkCase[] = [];

    for (const workload of workloads) {
      try {
        const benchmarkCase = await this.workloadManager.createBenchmarkCase(
          workload.id,
          preset.replayConfig
        );
        benchmarkCases.push(benchmarkCase);
      } catch (error) {
        logger.warn('Failed to create benchmark case for workload', {
          workloadId: workload.id,
          error: (error as Error).message,
        });
      }
    }

    logger.info('Preset workloads loaded', {
      presetName,
      requestedCount: workloads.length,
      loadedCount: benchmarkCases.length,
    });

    return benchmarkCases;
  }

  /**
   * Load a workload collection
   */
  async loadCollection(collectionName: string): Promise<BenchmarkCase[]> {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Unknown collection: ${collectionName}`);
    }

    logger.info('Loading workload collection', { collectionName });

    const benchmarkCases: BenchmarkCase[] = [];
    const errors: Array<{ workloadId: string; error: string }> = [];

    for (const workloadEntry of collection.workloads) {
      try {
        const benchmarkCase = await this.workloadManager.createBenchmarkCase(
          workloadEntry.metadata.id,
          workloadEntry.config
        );

        // Add collection metadata to the benchmark case config
        benchmarkCase.config.metadata = {
          ...benchmarkCase.config.metadata,
          collection: collectionName,
          weight: workloadEntry.weight,
        };

        benchmarkCases.push(benchmarkCase);
      } catch (error) {
        errors.push({
          workloadId: workloadEntry.metadata.id,
          error: (error as Error).message,
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('Some workloads failed to load in collection', {
        collectionName,
        errors: errors.length,
        details: errors,
      });
    }

    logger.info('Collection loaded', {
      collectionName,
      totalWorkloads: collection.workloads.length,
      loadedWorkloads: benchmarkCases.length,
      failedWorkloads: errors.length,
    });

    return benchmarkCases;
  }

  /**
   * Find workloads by domain
   */
  async findByDomain(domain: string): Promise<WorkloadMetadata[]> {
    if (!(domain in WORKLOAD_DOMAINS)) {
      throw new Error(
        `Unknown domain: ${domain}. Available: ${Object.keys(WORKLOAD_DOMAINS).join(', ')}`
      );
    }

    return this.workloadManager.searchWorkloads('', { domain });
  }

  /**
   * Find workloads by complexity range
   */
  async findByComplexity(min: number = 0, max: number = 1): Promise<WorkloadMetadata[]> {
    return this.workloadManager.searchWorkloads('', {
      complexity: { min, max },
    });
  }

  /**
   * Find workloads by scale
   */
  async findByScale(scales: string[]): Promise<WorkloadMetadata[]> {
    return this.workloadManager.searchWorkloads('', { scale: scales });
  }

  /**
   * Get recommended workloads for a specific use case
   */
  async getRecommendedWorkloads(
    useCase: 'development' | 'ci' | 'regression' | 'performance' | 'stress',
    count: number = 5
  ): Promise<WorkloadMetadata[]> {
    let filters: WorkloadFilters;

    switch (useCase) {
      case 'development':
        filters = {
          scale: ['small', 'medium'],
          complexity: { min: 0.2, max: 0.7 },
          validated: true,
        };
        break;

      case 'ci':
        filters = {
          scale: ['small'],
          complexity: { min: 0.1, max: 0.5 },
          validated: true,
          fileCount: { min: 1, max: 50 },
        };
        break;

      case 'regression':
        filters = {
          scale: ['medium'],
          complexity: { min: 0.3, max: 0.8 },
          validated: true,
        };
        break;

      case 'performance':
        filters = {
          scale: ['medium', 'large'],
          complexity: { min: 0.5, max: 1.0 },
          validated: true,
        };
        break;

      case 'stress':
        filters = {
          scale: ['large', 'enterprise'],
          complexity: { min: 0.7, max: 1.0 },
          validated: true,
          fileCount: { min: 100, max: 10000 },
        };
        break;
    }

    const workloads = await this.workloadManager.searchWorkloads('', filters, count * 2);

    // Sort by usage stats and success rate to get most reliable workloads
    const sorted = workloads
      .filter((w) => w.usage.successRate > 0.8) // Only well-tested workloads
      .sort((a, b) => {
        // Prioritize by success rate, then by usage count
        const scoreA = a.usage.successRate * 0.7 + (Math.min(a.usage.runs, 100) / 100) * 0.3;
        const scoreB = b.usage.successRate * 0.7 + (Math.min(b.usage.runs, 100) / 100) * 0.3;
        return scoreB - scoreA;
      });

    logger.info('Recommended workloads selected', {
      useCase,
      requestedCount: count,
      availableCount: workloads.length,
      selectedCount: Math.min(count, sorted.length),
    });

    return sorted.slice(0, count);
  }

  /**
   * Create a custom workload collection
   */
  async createCollection(
    name: string,
    description: string,
    workloadIds: string[],
    globalConfig?: WorkloadCollection['globalConfig']
  ): Promise<void> {
    const workloads: WorkloadCollection['workloads'] = [];

    for (const id of workloadIds) {
      const metadata = await this.workloadManager.getWorkload(id);
      if (!metadata) {
        throw new Error(`Workload not found: ${id}`);
      }

      workloads.push({
        metadata,
        weight: 1, // Default equal weight
        config: { scale: 1, shuffle: false }, // Default config
      });
    }

    const collection: WorkloadCollection = {
      name,
      description,
      workloads,
      globalConfig: globalConfig || {
        concurrent: false,
        maxParallel: 1,
        timeoutMs: 300000, // 5 minutes default
      },
    };

    this.collections.set(name, collection);
    await this.saveCollections();

    logger.info('Collection created', { name, workloadCount: workloads.length });
  }

  /**
   * Get available presets
   */
  getAvailablePresets(): string[] {
    return Array.from(this.presets.keys());
  }

  /**
   * Get available collections
   */
  getAvailableCollections(): string[] {
    return Array.from(this.collections.keys());
  }

  /**
   * Get preset details
   */
  getPreset(name: string): WorkloadPreset | undefined {
    return this.presets.get(name);
  }

  /**
   * Get collection details
   */
  getCollection(name: string): WorkloadCollection | undefined {
    return this.collections.get(name);
  }

  /**
   * Validate all workloads and return validation results
   */
  async validateAllWorkloads(): Promise<Map<string, string[]>> {
    logger.info('Starting workload validation');

    const results = await this.workloadManager.validateAllWorkloads();

    const totalWorkloads = results.size;
    const validWorkloads = Array.from(results.values()).filter(
      (errors) => errors.length === 0
    ).length;
    const invalidWorkloads = totalWorkloads - validWorkloads;

    logger.info('Workload validation complete', {
      totalWorkloads,
      validWorkloads,
      invalidWorkloads,
      validationRate: ((validWorkloads / totalWorkloads) * 100).toFixed(1) + '%',
    });

    return results;
  }

  /**
   * Get workload statistics
   */
  getStatistics() {
    return this.workloadManager.getWorkloadStatistics();
  }

  /**
   * Initialize built-in presets
   */
  private initializePresets(): void {
    // Development preset - fast, reliable workloads
    this.presets.set('development', {
      name: 'Development',
      description: 'Small to medium workloads for development testing',
      filters: {
        scale: ['small', 'medium'],
        complexity: { min: 0.2, max: 0.6 },
        validated: true,
      },
      replayConfig: {
        scale: 0.5,
        shuffle: true,
        subset: { count: 10, random: true },
        concurrency: { enabled: false, workers: 1, batchSize: 1 },
      },
    });

    // CI preset - very fast, minimal workloads
    this.presets.set('ci', {
      name: 'Continuous Integration',
      description: 'Minimal workloads for CI/CD pipelines',
      filters: {
        scale: ['small'],
        complexity: { min: 0.1, max: 0.4 },
        validated: true,
        fileCount: { min: 1, max: 25 },
      },
      replayConfig: {
        scale: 0.2,
        shuffle: false,
        subset: { count: 5, random: false },
        concurrency: { enabled: false, workers: 1, batchSize: 1 },
      },
      expectedMetrics: {
        maxLatency: 1000, // 1 second
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      },
    });

    // Performance preset - comprehensive workloads
    this.presets.set('performance', {
      name: 'Performance Testing',
      description: 'Comprehensive workloads for performance analysis',
      filters: {
        scale: ['medium', 'large'],
        complexity: { min: 0.4, max: 0.9 },
        validated: true,
      },
      replayConfig: {
        scale: 1.0,
        shuffle: true,
        concurrency: { enabled: true, workers: 4, batchSize: 10 },
      },
      expectedMetrics: {
        minThroughput: 100, // files per second
        maxLatency: 5000, // 5 seconds
      },
    });

    // Stress preset - maximum load
    this.presets.set('stress', {
      name: 'Stress Testing',
      description: 'Large workloads for stress testing',
      filters: {
        scale: ['large', 'enterprise'],
        complexity: { min: 0.6, max: 1.0 },
        validated: true,
      },
      replayConfig: {
        scale: 2.0,
        shuffle: true,
        concurrency: { enabled: true, workers: 8, batchSize: 50 },
        simulation: {
          networkDelay: 100,
          diskLatency: 50,
          cpuThrottling: 0.8,
        },
      },
    });

    // Regression preset - stable, reproducible workloads
    this.presets.set('regression', {
      name: 'Regression Testing',
      description: 'Stable workloads for regression detection',
      filters: {
        scale: ['medium'],
        complexity: { min: 0.3, max: 0.7 },
        validated: true,
      },
      replayConfig: {
        scale: 1.0,
        shuffle: false, // Consistent ordering for regression testing
        concurrency: { enabled: false, workers: 1, batchSize: 1 },
      },
    });

    logger.debug('Presets initialized', { count: this.presets.size });
  }

  /**
   * Load collections from storage
   */
  private async loadCollections(): Promise<void> {
    // In a real implementation, this would load from a file or database
    // For now, we'll create some default collections

    // E-commerce collection
    const ecommerceWorkloads = await this.findByDomain('e-commerce');
    if (ecommerceWorkloads.length > 0) {
      await this.createCollection(
        'e-commerce-suite',
        'Comprehensive e-commerce workload collection',
        ecommerceWorkloads.slice(0, 5).map((w) => w.id),
        { concurrent: true, maxParallel: 3, timeoutMs: 600000 }
      );
    }

    logger.debug('Collections loaded');
  }

  /**
   * Save collections to storage
   */
  private async saveCollections(): Promise<void> {
    // In a real implementation, this would save to a file or database
    logger.debug('Collections saved');
  }
}

/**
 * Factory function for creating a RealWorldLoader
 */
export function createRealWorldLoader(workloadsPath?: string): RealWorldLoader {
  return new RealWorldLoader(workloadsPath);
}

/**
 * Utility function to get workload recommendations
 */
export async function getWorkloadRecommendations(
  useCase: 'development' | 'ci' | 'regression' | 'performance' | 'stress',
  count: number = 5,
  workloadsPath?: string
): Promise<WorkloadMetadata[]> {
  const loader = createRealWorldLoader(workloadsPath);
  await loader.initialize();
  return loader.getRecommendedWorkloads(useCase, count);
}

/**
 * Utility function to load preset workloads
 */
export async function loadPresetWorkloads(
  presetName: string,
  workloadsPath?: string
): Promise<BenchmarkCase[]> {
  const loader = createRealWorldLoader(workloadsPath);
  await loader.initialize();
  return loader.loadWithPreset(presetName);
}

/**
 * Utility function to validate workloads
 */
export async function validateWorkloads(workloadsPath?: string): Promise<{
  totalWorkloads: number;
  validWorkloads: number;
  invalidWorkloads: number;
  validationResults: Map<string, string[]>;
}> {
  const loader = createRealWorldLoader(workloadsPath);
  await loader.initialize();

  const validationResults = await loader.validateAllWorkloads();
  const totalWorkloads = validationResults.size;
  const validWorkloads = Array.from(validationResults.values()).filter(
    (errors) => errors.length === 0
  ).length;
  const invalidWorkloads = totalWorkloads - validWorkloads;

  return {
    totalWorkloads,
    validWorkloads,
    invalidWorkloads,
    validationResults,
  };
}
