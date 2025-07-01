/**
 * Synthetic benchmark case generation tools
 * 
 * This module provides comprehensive tools for generating synthetic benchmark cases
 * with configurable parameters, validation, and a reusable case library.
 */

// Core generator exports
export {
  SyntheticCaseGenerator,
  SyntheticCaseConfig,
  SyntheticCaseData,
  SyntheticFile,
  ValidationResult,
  SYNTHETIC_PRESETS,
} from './SyntheticCaseGenerator';

// Case library exports
export {
  CaseLibrary,
  CaseLibraryEntry,
  CaseLibraryFilters,
  CaseLibrarySearchResult,
  CASE_CATEGORIES,
} from './CaseLibrary';

// Validator exports
export {
  CaseValidator,
  ValidationRule,
  ValidationContext,
  CaseValidationReport,
  ValidationIssue,
  BUILT_IN_VALIDATION_RULES,
} from './CaseValidator';

// Convenience factory functions
import { SyntheticCaseGenerator, SyntheticCaseConfig } from './SyntheticCaseGenerator';
import { CaseLibrary } from './CaseLibrary';
import { CaseValidator } from './CaseValidator';
import { BenchmarkCase } from '../types';

/**
 * Create a synthetic case generator with preset configuration
 */
export function createSyntheticGenerator(
  presetName: string,
  overrides: Partial<SyntheticCaseConfig> = {}
): SyntheticCaseGenerator {
  const config = SyntheticCaseGenerator.createCustomConfig(
    `synthetic-${presetName}`,
    100, // default workload size
    1,   // default concurrency
    0.5, // default complexity
    overrides
  );
  
  return new SyntheticCaseGenerator(config);
}

/**
 * Create a case library with default configuration
 */
export function createCaseLibrary(libraryPath?: string): CaseLibrary {
  return new CaseLibrary(libraryPath);
}

/**
 * Create a case validator with default rules
 */
export function createCaseValidator(): CaseValidator {
  return new CaseValidator();
}

/**
 * Generate a quick development benchmark case
 */
export async function generateQuickCase(name: string = 'quick-dev'): Promise<BenchmarkCase> {
  const config: SyntheticCaseConfig = {
    name,
    description: 'Quick development benchmark case',
    workload: { type: 'css', size: 'small', complexity: 'simple', dataPattern: 'random' },
    concurrency: { enabled: false, workers: 1, batchSize: 10, maxQueueSize: 100 },
    data: { fileCount: 10, avgFileSize: 1024, sizeVariation: 0.2, contentTypes: ['css'], duplicateRatio: 0.1 },
    performance: { expectedDuration: 100, memoryProfile: 'low', ioIntensity: 'light', cpuIntensity: 'light' },
    deterministic: true,
  };
  
  const generator = new SyntheticCaseGenerator(config);
  return generator.generateCase();
}

/**
 * Generate a stress test benchmark case
 */
export async function generateStressCase(name: string = 'stress-test'): Promise<BenchmarkCase> {
  const config: SyntheticCaseConfig = {
    name,
    description: 'Stress test benchmark case',
    workload: { type: 'mixed', size: 'xlarge', complexity: 'complex', dataPattern: 'burst' },
    concurrency: { enabled: true, workers: 8, batchSize: 50, maxQueueSize: 500 },
    data: { fileCount: 1000, avgFileSize: 10240, sizeVariation: 0.5, contentTypes: ['css', 'js'], duplicateRatio: 0.3 },
    performance: { expectedDuration: 5000, memoryProfile: 'high', ioIntensity: 'heavy', cpuIntensity: 'heavy' },
    deterministic: false,
  };
  
  const generator = new SyntheticCaseGenerator(config);
  return generator.generateCase();
}

/**
 * Generate a memory-intensive benchmark case
 */
export async function generateMemoryCase(name: string = 'memory-intensive'): Promise<BenchmarkCase> {
  const config: SyntheticCaseConfig = {
    name,
    description: 'Memory-intensive benchmark case',
    workload: { type: 'css', size: 'large', complexity: 'complex', dataPattern: 'sequential' },
    concurrency: { enabled: true, workers: 4, batchSize: 20, maxQueueSize: 200 },
    data: { fileCount: 500, avgFileSize: 50000, sizeVariation: 0.3, contentTypes: ['css'], duplicateRatio: 0.2 },
    performance: { expectedDuration: 3000, memoryProfile: 'high', ioIntensity: 'moderate', cpuIntensity: 'moderate' },
    deterministic: true,
  };
  
  const generator = new SyntheticCaseGenerator(config);
  return generator.generateCase();
}

/**
 * Generate multiple cases from a configuration matrix
 */
export async function generateCaseMatrix(
  baseConfig: Partial<SyntheticCaseConfig>,
  variations: {
    workloadSizes?: number[];
    concurrencyLevels?: number[];
    complexityLevels?: number[];
  }
): Promise<BenchmarkCase[]> {
  const cases: BenchmarkCase[] = [];
  const {
    workloadSizes = [50, 200, 1000],
    concurrencyLevels = [1, 4, 8],
    complexityLevels = [0.3, 0.6, 0.9],
  } = variations;

  for (const workloadSize of workloadSizes) {
    for (const concurrency of concurrencyLevels) {
      for (const complexity of complexityLevels) {
        const name = `matrix-${workloadSize}-${concurrency}-${Math.round(complexity * 10)}`;
        
        const config = SyntheticCaseGenerator.createCustomConfig(
          name,
          workloadSize,
          concurrency,
          complexity,
          baseConfig
        );

        const generator = new SyntheticCaseGenerator(config);
        const benchmarkCase = await generator.generateCase();
        cases.push(benchmarkCase);
      }
    }
  }

  return cases;
}

/**
 * Validate and generate cases from library
 */
export async function validateAndGenerate(
  library: CaseLibrary,
  caseIds: string[]
): Promise<Array<{ case: BenchmarkCase; validation: any }>> {
  const validator = new CaseValidator();
  const results: Array<{ case: BenchmarkCase; validation: any }> = [];

  for (const caseId of caseIds) {
    const entry = await library.getCase(caseId);
    if (!entry) {
      throw new Error(`Case not found in library: ${caseId}`);
    }

    // Validate the case configuration
    const validation = await validator.validateCase(entry.config);
    
    if (!validation.valid) {
      throw new Error(`Case validation failed: ${caseId} - ${validation.results.errors.map(e => e.message).join(', ')}`);
    }

    // Generate the benchmark case
    const benchmarkCase = await library.generateBenchmarkCase(caseId);
    
    results.push({ case: benchmarkCase, validation });
  }

  return results;
}

/**
 * Utility types for external usage
 */
export type {
  BenchmarkCase,
} from '../types';