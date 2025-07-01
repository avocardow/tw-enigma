import { randomBytes } from 'crypto';
import { join } from 'path';
import { promises as fs } from 'fs';
import { createLogger } from '../../utils/logger';
import {
  BenchmarkCase,
  BenchmarkConfig,
  BenchmarkEnvironment,
  BenchmarkMetrics,
  BenchmarkResult,
} from '../types';

const logger = createLogger('SyntheticCaseGenerator');

/**
 * Configuration for synthetic case generation
 */
export interface SyntheticCaseConfig {
  name: string;
  description?: string;
  
  // Workload configuration
  workload: {
    type: 'css' | 'js' | 'mixed' | 'custom';
    size: 'small' | 'medium' | 'large' | 'xlarge' | number; // Number of files/operations
    complexity: 'simple' | 'moderate' | 'complex' | number; // Complexity factor
    dataPattern: 'random' | 'sequential' | 'burst' | 'custom';
  };

  // Concurrency settings
  concurrency: {
    enabled: boolean;
    workers: number;
    batchSize: number;
    maxQueueSize: number;
  };

  // Data generation parameters
  data: {
    fileCount: number;
    avgFileSize: number; // in bytes
    sizeVariation: number; // 0-1, amount of size variation
    contentTypes: string[]; // CSS classes, JS patterns, etc.
    duplicateRatio: number; // 0-1, ratio of duplicate content
  };

  // Performance characteristics
  performance: {
    expectedDuration: number; // expected ms
    memoryProfile: 'low' | 'medium' | 'high';
    ioIntensity: 'light' | 'moderate' | 'heavy';
    cpuIntensity: 'light' | 'moderate' | 'heavy';
  };

  // Reproducibility
  seed?: string;
  deterministic: boolean;
}

/**
 * Synthetic benchmark case data
 */
export interface SyntheticCaseData {
  files: SyntheticFile[];
  expectedResults: Partial<BenchmarkMetrics>;
  metadata: Record<string, any>;
}

/**
 * Generated synthetic file
 */
export interface SyntheticFile {
  path: string;
  content: string;
  size: number;
  type: string;
  checksum: string;
}

/**
 * Validation result for synthetic cases
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverage: {
    edgeCases: string[];
    scenarios: string[];
    completeness: number; // 0-1
  };
}

/**
 * Preset configurations for common scenarios
 */
export const SYNTHETIC_PRESETS: Record<string, Partial<SyntheticCaseConfig>> = {
  'quick-dev': {
    workload: { type: 'css', size: 'small', complexity: 'simple', dataPattern: 'random' },
    concurrency: { enabled: false, workers: 1, batchSize: 10, maxQueueSize: 100 },
    data: { fileCount: 10, avgFileSize: 1024, sizeVariation: 0.2, contentTypes: ['css'], duplicateRatio: 0.1 },
    performance: { expectedDuration: 100, memoryProfile: 'low', ioIntensity: 'light', cpuIntensity: 'light' },
    deterministic: true,
  },

  'stress-test': {
    workload: { type: 'mixed', size: 'xlarge', complexity: 'complex', dataPattern: 'burst' },
    concurrency: { enabled: true, workers: 8, batchSize: 50, maxQueueSize: 500 },
    data: { fileCount: 1000, avgFileSize: 10240, sizeVariation: 0.5, contentTypes: ['css', 'js'], duplicateRatio: 0.3 },
    performance: { expectedDuration: 5000, memoryProfile: 'high', ioIntensity: 'heavy', cpuIntensity: 'heavy' },
    deterministic: false,
  },

  'memory-intensive': {
    workload: { type: 'css', size: 'large', complexity: 'complex', dataPattern: 'sequential' },
    concurrency: { enabled: true, workers: 4, batchSize: 20, maxQueueSize: 200 },
    data: { fileCount: 500, avgFileSize: 50000, sizeVariation: 0.3, contentTypes: ['css'], duplicateRatio: 0.2 },
    performance: { expectedDuration: 3000, memoryProfile: 'high', ioIntensity: 'moderate', cpuIntensity: 'moderate' },
    deterministic: true,
  },

  'io-bound': {
    workload: { type: 'mixed', size: 'medium', complexity: 'moderate', dataPattern: 'random' },
    concurrency: { enabled: true, workers: 6, batchSize: 30, maxQueueSize: 300 },
    data: { fileCount: 200, avgFileSize: 2048, sizeVariation: 0.4, contentTypes: ['css', 'js'], duplicateRatio: 0.15 },
    performance: { expectedDuration: 1500, memoryProfile: 'medium', ioIntensity: 'heavy', cpuIntensity: 'light' },
    deterministic: false,
  },

  'baseline': {
    workload: { type: 'css', size: 'medium', complexity: 'moderate', dataPattern: 'sequential' },
    concurrency: { enabled: false, workers: 1, batchSize: 25, maxQueueSize: 250 },
    data: { fileCount: 100, avgFileSize: 5120, sizeVariation: 0.2, contentTypes: ['css'], duplicateRatio: 0.1 },
    performance: { expectedDuration: 1000, memoryProfile: 'medium', ioIntensity: 'moderate', cpuIntensity: 'moderate' },
    deterministic: true,
  },
};

/**
 * Generates synthetic benchmark cases with configurable parameters
 */
export class SyntheticCaseGenerator {
  private seedGenerator: () => string;
  private config: SyntheticCaseConfig;

  constructor(config: SyntheticCaseConfig) {
    this.config = this.normalizeConfig(config);
    this.seedGenerator = this.createSeedGenerator(this.config.seed);

    logger.debug('SyntheticCaseGenerator initialized', {
      name: this.config.name,
      workloadType: this.config.workload.type,
      fileCount: this.config.data.fileCount,
      deterministic: this.config.deterministic,
    });
  }

  /**
   * Generate a synthetic benchmark case
   */
  async generateCase(): Promise<BenchmarkCase> {
    logger.info('Generating synthetic benchmark case', { name: this.config.name });

    try {
      // Generate synthetic data
      const caseData = await this.generateCaseData();

      // Create benchmark configuration
      const benchmarkConfig = this.createBenchmarkConfig();

      // Create the benchmark case
      const benchmarkCase: BenchmarkCase = {
        name: this.config.name,
        description: this.config.description || `Synthetic case: ${this.config.name}`,
        config: benchmarkConfig,
        fn: async () => this.executeSyntheticBenchmark(caseData),
        setup: async () => this.setupSyntheticEnvironment(caseData),
        teardown: async () => this.teardownSyntheticEnvironment(caseData),
        validate: async (result) => this.validateBenchmarkResult(result, caseData),
      };

      logger.info('Synthetic benchmark case generated successfully', {
        name: this.config.name,
        fileCount: caseData.files.length,
        totalSize: caseData.files.reduce((sum, f) => sum + f.size, 0),
      });

      return benchmarkCase;
    } catch (error) {
      logger.error('Failed to generate synthetic benchmark case', { error, name: this.config.name });
      throw error;
    }
  }

  /**
   * Generate multiple cases from preset configurations
   */
  static async generatePresetCases(
    presets: string[] = Object.keys(SYNTHETIC_PRESETS),
    baseConfig: Partial<SyntheticCaseConfig> = {}
  ): Promise<BenchmarkCase[]> {
    const cases: BenchmarkCase[] = [];

    for (const presetName of presets) {
      if (!SYNTHETIC_PRESETS[presetName]) {
        logger.warn('Unknown preset', { preset: presetName });
        continue;
      }

      const config: SyntheticCaseConfig = {
        name: `synthetic-${presetName}`,
        ...SYNTHETIC_PRESETS[presetName],
        ...baseConfig,
      } as SyntheticCaseConfig;

      const generator = new SyntheticCaseGenerator(config);
      const benchmarkCase = await generator.generateCase();
      cases.push(benchmarkCase);
    }

    logger.info('Generated preset benchmark cases', {
      presets,
      count: cases.length,
    });

    return cases;
  }

  /**
   * Validate synthetic case configuration
   */
  static validateConfig(config: SyntheticCaseConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const edgeCases: string[] = [];
    const scenarios: string[] = [];

    // Basic validation
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Case name is required');
    }

    if (config.data.fileCount <= 0) {
      errors.push('File count must be greater than 0');
    }

    if (config.data.avgFileSize <= 0) {
      errors.push('Average file size must be greater than 0');
    }

    if (config.data.sizeVariation < 0 || config.data.sizeVariation > 1) {
      errors.push('Size variation must be between 0 and 1');
    }

    if (config.data.duplicateRatio < 0 || config.data.duplicateRatio > 1) {
      errors.push('Duplicate ratio must be between 0 and 1');
    }

    // Concurrency validation
    if (config.concurrency.enabled) {
      if (config.concurrency.workers <= 0) {
        errors.push('Worker count must be greater than 0 when concurrency is enabled');
      }

      if (config.concurrency.batchSize <= 0) {
        errors.push('Batch size must be greater than 0');
      }

      if (config.concurrency.maxQueueSize < config.concurrency.batchSize) {
        warnings.push('Max queue size should be larger than batch size');
      }
    }

    // Performance validation
    if (config.performance.expectedDuration <= 0) {
      warnings.push('Expected duration should be greater than 0');
    }

    // Edge case detection
    if (config.data.fileCount > 10000) {
      edgeCases.push('very-large-file-count');
      warnings.push('Very large file count may impact performance');
    }

    if (config.data.avgFileSize > 1024 * 1024) {
      edgeCases.push('large-file-size');
      warnings.push('Large average file size may require significant memory');
    }

    if (config.concurrency.enabled && config.concurrency.workers > 16) {
      edgeCases.push('high-concurrency');
      warnings.push('High worker count may overwhelm system resources');
    }

    if (config.data.duplicateRatio > 0.5) {
      edgeCases.push('high-duplicate-ratio');
      scenarios.push('duplicate-heavy-workload');
    }

    // Scenario detection
    scenarios.push(`${config.workload.type}-workload`);
    scenarios.push(`${config.workload.size}-scale`);
    scenarios.push(`${config.workload.complexity}-complexity`);
    scenarios.push(`${config.performance.memoryProfile}-memory`);
    scenarios.push(`${config.performance.ioIntensity}-io`);
    scenarios.push(`${config.performance.cpuIntensity}-cpu`);

    if (config.concurrency.enabled) {
      scenarios.push('concurrent-execution');
    } else {
      scenarios.push('sequential-execution');
    }

    const completeness = Math.min(1, scenarios.length / 10); // Arbitrary completeness metric

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      coverage: {
        edgeCases,
        scenarios,
        completeness,
      },
    };
  }

  /**
   * Create custom configuration from parameters
   */
  static createCustomConfig(
    name: string,
    workloadSize: number,
    concurrency: number,
    complexity: number,
    options: Partial<SyntheticCaseConfig> = {}
  ): SyntheticCaseConfig {
    // Determine workload characteristics based on parameters
    const workloadType = workloadSize > 500 ? 'mixed' : 'css';
    const sizeCategory = workloadSize > 1000 ? 'xlarge' : workloadSize > 500 ? 'large' : workloadSize > 100 ? 'medium' : 'small';
    const complexityCategory = complexity > 0.7 ? 'complex' : complexity > 0.4 ? 'moderate' : 'simple';
    
    const memoryProfile = workloadSize > 500 ? 'high' : workloadSize > 100 ? 'medium' : 'low';
    const ioIntensity = workloadSize > 500 ? 'heavy' : 'moderate';
    const cpuIntensity = complexity > 0.5 ? 'heavy' : 'moderate';

    return {
      name,
      workload: {
        type: workloadType,
        size: sizeCategory,
        complexity: complexityCategory,
        dataPattern: 'random',
      },
      concurrency: {
        enabled: concurrency > 1,
        workers: Math.max(1, Math.floor(concurrency)),
        batchSize: Math.max(10, Math.floor(workloadSize / 10)),
        maxQueueSize: Math.max(100, Math.floor(workloadSize)),
      },
      data: {
        fileCount: workloadSize,
        avgFileSize: 1024 + (complexity * 10240),
        sizeVariation: 0.2 + (complexity * 0.3),
        contentTypes: workloadType === 'mixed' ? ['css', 'js'] : ['css'],
        duplicateRatio: 0.1 + (complexity * 0.2),
      },
      performance: {
        expectedDuration: Math.max(100, workloadSize * (1 + complexity)),
        memoryProfile,
        ioIntensity,
        cpuIntensity,
      },
      deterministic: true,
      ...options,
    };
  }

  /**
   * Generate case data
   */
  private async generateCaseData(): Promise<SyntheticCaseData> {
    const files = await this.generateSyntheticFiles();
    const expectedResults = this.calculateExpectedResults(files);
    const metadata = this.createCaseMetadata(files);

    return {
      files,
      expectedResults,
      metadata,
    };
  }

  /**
   * Generate synthetic files based on configuration
   */
  private async generateSyntheticFiles(): Promise<SyntheticFile[]> {
    const files: SyntheticFile[] = [];
    const { fileCount, avgFileSize, sizeVariation, contentTypes, duplicateRatio } = this.config.data;

    // Calculate how many duplicates to create
    const duplicateCount = Math.floor(fileCount * duplicateRatio);
    const uniqueCount = fileCount - duplicateCount;

    // Generate unique files
    for (let i = 0; i < uniqueCount; i++) {
      const contentType = this.selectRandomItem(contentTypes);
      const size = this.calculateFileSize(avgFileSize, sizeVariation);
      const content = await this.generateFileContent(contentType, size);
      
      files.push({
        path: `synthetic/file-${i}.${contentType}`,
        content,
        size: content.length,
        type: contentType,
        checksum: this.calculateChecksum(content),
      });
    }

    // Generate duplicate files
    for (let i = 0; i < duplicateCount && files.length > 0; i++) {
      const sourceFile = this.selectRandomItem(files);
      const duplicateFile: SyntheticFile = {
        ...sourceFile,
        path: `synthetic/duplicate-${i}.${sourceFile.type}`,
      };
      files.push(duplicateFile);
    }

    // Shuffle files if not deterministic
    if (!this.config.deterministic) {
      this.shuffleArray(files);
    }

    return files;
  }

  /**
   * Generate file content based on type and size
   */
  private async generateFileContent(type: string, targetSize: number): Promise<string> {
    switch (type) {
      case 'css':
        return this.generateCSSContent(targetSize);
      
      case 'js':
        return this.generateJSContent(targetSize);
      
      default:
        return this.generateGenericContent(targetSize);
    }
  }

  /**
   * Generate CSS content
   */
  private generateCSSContent(targetSize: number): string {
    const classNames = this.generateClassNames();
    const properties = ['color', 'background', 'margin', 'padding', 'font-size', 'border', 'width', 'height'];
    const values = ['#333', 'red', 'blue', '10px', '1em', '100%', 'auto', 'none', 'block', 'inline'];
    
    let content = '';
    
    while (content.length < targetSize) {
      const className = this.selectRandomItem(classNames);
      const propertyCount = Math.floor(Math.random() * 5) + 1;
      
      content += `.${className} {\n`;
      
      for (let i = 0; i < propertyCount; i++) {
        const property = this.selectRandomItem(properties);
        const value = this.selectRandomItem(values);
        content += `  ${property}: ${value};\n`;
      }
      
      content += '}\n\n';
    }
    
    return content.substring(0, targetSize);
  }

  /**
   * Generate JavaScript content
   */
  private generateJSContent(targetSize: number): string {
    const functionNames = ['process', 'handle', 'validate', 'transform', 'calculate', 'render'];
    const variableNames = ['data', 'result', 'config', 'element', 'value', 'options'];
    
    let content = '';
    
    while (content.length < targetSize) {
      const funcName = this.selectRandomItem(functionNames);
      const varName = this.selectRandomItem(variableNames);
      
      content += `function ${funcName}${Math.floor(Math.random() * 1000)}(${varName}) {\n`;
      content += `  const result = ${varName} || {};\n`;
      content += `  return result;\n`;
      content += '}\n\n';
    }
    
    return content.substring(0, targetSize);
  }

  /**
   * Generate generic content
   */
  private generateGenericContent(targetSize: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let content = '';
    
    for (let i = 0; i < targetSize; i++) {
      content += chars.charAt(Math.floor(Math.random() * chars.length));
      
      // Add some structure with newlines
      if (i > 0 && i % 80 === 0) {
        content += '\n';
      }
    }
    
    return content;
  }

  /**
   * Generate realistic CSS class names
   */
  private generateClassNames(): string[] {
    const prefixes = ['btn', 'card', 'nav', 'header', 'footer', 'content', 'sidebar', 'modal', 'form', 'input'];
    const modifiers = ['primary', 'secondary', 'large', 'small', 'active', 'disabled', 'hidden', 'visible'];
    const classNames: string[] = [];
    
    for (const prefix of prefixes) {
      classNames.push(prefix);
      
      for (const modifier of modifiers) {
        classNames.push(`${prefix}-${modifier}`);
      }
    }
    
    return classNames;
  }

  /**
   * Calculate file size with variation
   */
  private calculateFileSize(avgSize: number, variation: number): number {
    const variationAmount = avgSize * variation;
    const minSize = Math.max(1, avgSize - variationAmount);
    const maxSize = avgSize + variationAmount;
    
    return Math.floor(Math.random() * (maxSize - minSize) + minSize);
  }

  /**
   * Calculate expected benchmark results
   */
  private calculateExpectedResults(files: SyntheticFile[]): Partial<BenchmarkMetrics> {
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const duplicateCount = files.length - new Set(files.map(f => f.checksum)).size;
    
    return {
      filesProcessed: files.length,
      bytesProcessed: totalBytes,
      cacheHits: duplicateCount,
      cacheMisses: files.length - duplicateCount,
      optimizationRatio: 0.3, // Expected 30% optimization
      customMetrics: {
        duplicateRatio: duplicateCount / files.length,
        avgFileSize: totalBytes / files.length,
        uniqueFiles: files.length - duplicateCount,
      },
    };
  }

  /**
   * Create case metadata
   */
  private createCaseMetadata(files: SyntheticFile[]): Record<string, any> {
    return {
      generation: {
        timestamp: new Date().toISOString(),
        seed: this.config.seed,
        deterministic: this.config.deterministic,
        generator: 'SyntheticCaseGenerator',
        version: '1.0.0',
      },
      workload: this.config.workload,
      concurrency: this.config.concurrency,
      performance: this.config.performance,
      files: {
        count: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        types: [...new Set(files.map(f => f.type))],
        duplicates: files.length - new Set(files.map(f => f.checksum)).size,
      },
    };
  }

  /**
   * Create benchmark configuration
   */
  private createBenchmarkConfig(): BenchmarkConfig {
    const baseConfig = {
      name: this.config.name,
      description: this.config.description || '',
      enabled: true,
      timeout: Math.max(this.config.performance.expectedDuration * 2, 30000),
      iterations: 5,
      warmupIterations: 2,
      skipWarmup: false,
      parallel: this.config.concurrency.enabled,
      maxParallelism: this.config.concurrency.workers,
      randomSeed: this.config.seed,
      tags: ['synthetic', this.config.workload.type, this.config.workload.size],
      metadata: {
        synthetic: true,
        workloadType: this.config.workload.type,
        expectedDuration: this.config.performance.expectedDuration,
        memoryProfile: this.config.performance.memoryProfile,
      },
    };

    return baseConfig;
  }

  /**
   * Execute synthetic benchmark
   */
  private async executeSyntheticBenchmark(caseData: SyntheticCaseData): Promise<void> {
    // Simulate the actual optimization work
    await this.simulateWorkload(caseData);
  }

  /**
   * Setup synthetic environment
   */
  private async setupSyntheticEnvironment(caseData: SyntheticCaseData): Promise<void> {
    // Create temporary directory structure if needed
    logger.debug('Setting up synthetic environment', {
      fileCount: caseData.files.length,
      totalSize: caseData.files.reduce((sum, f) => sum + f.size, 0),
    });
  }

  /**
   * Teardown synthetic environment
   */
  private async teardownSyntheticEnvironment(caseData: SyntheticCaseData): Promise<void> {
    // Clean up temporary resources
    logger.debug('Tearing down synthetic environment');
  }

  /**
   * Validate benchmark result
   */
  private async validateBenchmarkResult(result: BenchmarkResult, caseData: SyntheticCaseData): Promise<boolean> {
    const expected = caseData.expectedResults;
    
    // Check if files processed matches expected
    if (expected.filesProcessed && result.metrics.filesProcessed !== expected.filesProcessed) {
      logger.warn('Files processed mismatch', {
        expected: expected.filesProcessed,
        actual: result.metrics.filesProcessed,
      });
      return false;
    }

    // Check if bytes processed is reasonable
    if (expected.bytesProcessed) {
      const bytesRatio = result.metrics.bytesProcessed / expected.bytesProcessed;
      if (bytesRatio < 0.9 || bytesRatio > 1.1) {
        logger.warn('Bytes processed outside expected range', {
          expected: expected.bytesProcessed,
          actual: result.metrics.bytesProcessed,
          ratio: bytesRatio,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Simulate workload execution
   */
  private async simulateWorkload(caseData: SyntheticCaseData): Promise<void> {
    const { files } = caseData;
    const { concurrency } = this.config;

    if (concurrency.enabled) {
      await this.simulateConcurrentWorkload(files, concurrency);
    } else {
      await this.simulateSequentialWorkload(files);
    }
  }

  /**
   * Simulate concurrent workload
   */
  private async simulateConcurrentWorkload(files: SyntheticFile[], concurrency: any): Promise<void> {
    const batches = this.createBatches(files, concurrency.batchSize);
    
    for (const batch of batches) {
      const promises = batch.map(file => this.processFile(file));
      await Promise.all(promises);
    }
  }

  /**
   * Simulate sequential workload
   */
  private async simulateSequentialWorkload(files: SyntheticFile[]): Promise<void> {
    for (const file of files) {
      await this.processFile(file);
    }
  }

  /**
   * Simulate processing a single file
   */
  private async processFile(file: SyntheticFile): Promise<void> {
    // Simulate processing time based on file size and complexity
    const processingTime = Math.max(1, file.size / 10000); // 1ms per 10KB
    await new Promise(resolve => setTimeout(resolve, processingTime));
  }

  /**
   * Create batches from files
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: SyntheticCaseConfig): SyntheticCaseConfig {
    return {
      ...config,
      seed: config.seed || this.generateRandomSeed(),
      deterministic: config.deterministic ?? true,
    };
  }

  /**
   * Create seed generator
   */
  private createSeedGenerator(seed?: string): () => string {
    let counter = 0;
    const baseSeed = seed || this.generateRandomSeed();
    
    return () => `${baseSeed}-${counter++}`;
  }

  /**
   * Generate random seed
   */
  private generateRandomSeed(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Calculate checksum for content
   */
  private calculateChecksum(content: string): string {
    return require('crypto').createHash('md5').update(content).digest('hex');
  }

  /**
   * Select random item from array
   */
  private selectRandomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Shuffle array in place
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}