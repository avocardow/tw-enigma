/**
 * Optimize Command - Complete Consolidation with Enhanced Data Structures
 *
 * This command provides a dedicated interface for the CompleteConsolidator,
 * offering advanced optimization features including:
 * 1. Enhanced pattern analysis with optimized data structures
 * 2. Co-occurrence analysis and pattern grouping
 * 3. Atomic file operations with rollback capabilities
 * 4. Comprehensive validation and error handling
 * 5. Performance monitoring and memory optimization
 */

import { Command } from 'commander';
import fs from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

import {
  createHtmlExtractor,
  createJsExtractor,
  createCompleteConsolidator,
  type PatternAnalysisInput,
  type CompleteConsolidatorOptions,
  type ConsolidationResult,
  DryRunManager,
  VisualDiffGenerator,
  ImpactEstimator,
  DryRunReportGenerator,
  OutputManager,
} from '@tw-enigma/core';

interface OptimizeOptions {
  input?: string;
  output?: string;
  minFrequency?: string | number;
  dryRun?: boolean;
  verbose?: boolean;
  caseSensitive?: boolean;
  enablePatternGrouping?: boolean;
  enableCoOccurrenceAnalysis?: boolean;
  maxCoOccurrenceDistance?: string | number;
  includeFrameworkAnalysis?: boolean;
  enableValidation?: boolean;
  outputFormat?: 'map' | 'array' | 'json';
  sortBy?: 'frequency' | 'alphabetical' | 'source';
  sortDirection?: 'asc' | 'desc';
  enableAtomicWrites?: boolean;
  createBackups?: boolean;
  identifierBase?: string | number;
  identifierStartLength?: string | number;
  identifierMaxLength?: string | number;
  identifierPrefix?: string;
  reportPath?: string;
  enablePerformanceMonitoring?: boolean;
  memoryThreshold?: string | number;
  timeoutMs?: string | number;
  dataStructureMaxEntries?: string | number;
  enableLruEviction?: boolean;
  patternCacheSize?: string | number;
  memoryEfficientMode?: boolean;
}

export const optimizeCommand = new Command('optimize')
  .description('Advanced CSS pattern optimization using CompleteConsolidator')
  .option('-i, --input <path>', 'Input directory to scan for files', './src')
  .option('-o, --output <path>', 'Output CSS file path', './enigma-optimized.css')
  .option('-m, --min-frequency <number>', 'Minimum pattern frequency threshold', '2')
  .option('--dry-run', 'Preview changes without writing files', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('--case-sensitive', 'Enable case-sensitive pattern matching', false)
  .option('--enable-pattern-grouping', 'Enable pattern grouping analysis', true)
  .option('--enable-co-occurrence-analysis', 'Enable co-occurrence pattern analysis', true)
  .option('--max-co-occurrence-distance <number>', 'Maximum distance for co-occurrence analysis', '5')
  .option('--include-framework-analysis', 'Include framework-specific analysis', true)
  .option('--enable-validation', 'Enable validation of extracted patterns', false)
  .option('--output-format <format>', 'Output format for results (map, array, json)', 'map')
  .option('--sort-by <criteria>', 'Sorting criteria for results (frequency, alphabetical, source)', 'frequency')
  .option('--sort-direction <direction>', 'Sorting direction (asc, desc)', 'desc')
  .option('--enable-atomic-writes', 'Enable atomic file operations', true)
  .option('--create-backups', 'Backup files before modification', true)
  .option('--identifier-base <number>', 'Base for identifier generation (e.g., 26 for base-26)', '26')
  .option('--identifier-start-length <number>', 'Starting length for identifiers', '1')
  .option('--identifier-max-length <number>', 'Maximum length for identifiers', '3')
  .option('--identifier-prefix <string>', 'Prefix for generated identifiers', '')
  .option('--report-path <path>', 'Path to save detailed optimization report', './optimization-report.json')
  .option('--enable-performance-monitoring', 'Enable performance monitoring and memory tracking', true)
  .option('--memory-threshold <number>', 'Memory usage threshold in MB for warnings', '100')
  .option('--timeout-ms <number>', 'Timeout for optimization process in milliseconds', '60000')
  .option('--data-structure-max-entries <number>', 'Maximum entries for data structures (memory optimization)')
  .option('--enable-lru-eviction', 'Enable LRU eviction for memory management')
  .option('--pattern-cache-size <number>', 'Size of pattern normalization cache')
  .option('--memory-efficient-mode', 'Enable memory-efficient processing mode')
  .action(async (options: OptimizeOptions) => {
    try {
      await runOptimization(options);
    } catch (error) {
      console.error(
        '❌ Optimization failed:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

async function runOptimization(options: OptimizeOptions): Promise<void> {
  const startTime = Date.now();
  
  console.log('🚀 Starting Advanced CSS Pattern Optimization...\n');

  // Parse and validate options
  const inputPath = path.resolve(options.input || './src');
  const outputPath = path.resolve(options.output || './enigma-optimized.css');
  const minFrequency = Math.max(1, parseInt(String(options.minFrequency || '2'), 10));
  const reportPath = path.resolve(options.reportPath || './optimization-report.json');

  // Initialize dry run infrastructure if needed
  let dryRunManager: DryRunManager | null = null;
  if (options.dryRun) {
    dryRunManager = new DryRunManager({
      enabled: true,
      logOperations: true,
      validateOperations: true,
      includeFileSystemChecks: true,
      maxOperations: 10000,
      simulateLatency: false,
      operationTimeout: 30000,
    });
    
    await dryRunManager.startSession({
      projectRoot: inputPath,
      optimizationLevel: 'advanced',
      targetFramework: 'tailwind',
    });
    
    console.log('🧪 Dry run mode enabled - simulating advanced optimization...\n');
  }

  console.log('🔍 Configuration:');
  console.log(`  Input directory: ${inputPath}`);
  console.log(`  Output CSS file: ${outputPath}`);
  console.log(`  Min frequency: ${minFrequency}`);
  console.log(`  Report path: ${reportPath}`);
  console.log(`  Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log(`  Atomic writes: ${options.enableAtomicWrites !== false ? 'Yes' : 'No'}`);
  console.log(`  Backups: ${options.createBackups !== false ? 'Yes' : 'No'}`);
  console.log();

  // 1. Discover files to process
  console.log('📂 Discovering files...');
  const files = await discoverFiles(inputPath);
  console.log(`  Found ${files.length} files to process\n`);

  if (files.length === 0) {
    console.log('⚠️  No files found to process. Check your input path.');
    return;
  }

  // 2. Extract patterns with enhanced analyzers
  console.log('📊 Extracting patterns with enhanced analyzers...');
  const { htmlResults, jsxResults } = await extractPatterns(files, options);
  console.log(`  Processed ${htmlResults.length} HTML files and ${jsxResults.length} JS/JSX files\n`);

  // 3. Configure CompleteConsolidator
  const consolidatorOptions = createConsolidatorOptions(options, minFrequency);

  // 4. Create PatternAnalysisInput
  const patternInput: PatternAnalysisInput = {
    htmlResults,
    jsxResults,
  };

  console.log('🔄 Running complete pattern analysis and consolidation...');
  
  // 5. Create and run consolidator with timeout protection
  const timeoutMs = parseInt(String(options.timeoutMs || '60000'), 10);
  const result = await runWithTimeout(
    () => {
      const consolidator = createCompleteConsolidator(consolidatorOptions);
      return consolidator.consolidate(patternInput);
    },
    timeoutMs,
    'Pattern consolidation'
  );

  const processingTime = Date.now() - startTime;

  // 6. Display comprehensive results
  await displayResults(result, options, processingTime);

  // 7. Generate CSS file or record dry run operation
  if (result.patterns.size > 0) {
    if (dryRunManager) {
      // Record CSS file generation operation
      const cssContent = await generateCssContent(result, options);
      await dryRunManager.recordOperation({
        type: 'file-write',
        id: `optimize-css-${Date.now()}`,
        target: outputPath,
        description: `Create optimized CSS file with ${result.patterns.size} consolidated patterns`,
        data: { content: cssContent, size: Buffer.byteLength(cssContent, 'utf-8') },
        timestamp: Date.now(),
        wouldSucceed: true,
        sizeImpact: Buffer.byteLength(cssContent, 'utf-8'),
      });
    } else {
      await generateCssFile(result, outputPath, options);
    }
  }

  // 8. Generate detailed report or record operation
  if (options.verbose || options.enablePerformanceMonitoring) {
    if (dryRunManager) {
      const reportContent = await generateReportContent(result, options, processingTime);
      await dryRunManager.recordOperation({
        type: 'file-write',
        id: `optimize-report-${Date.now()}`,
        target: reportPath,
        description: `Create detailed optimization report`,
        data: { content: reportContent, size: Buffer.byteLength(reportContent, 'utf-8') },
        timestamp: Date.now(),
        wouldSucceed: true,
        sizeImpact: Buffer.byteLength(reportContent, 'utf-8'),
      });
    } else {
      await generateDetailedReport(result, reportPath, options, processingTime);
    }
  }

  // 9. Enhanced dry run summary or final summary
  if (options.dryRun && dryRunManager) {
    await displayDryRunSummary(dryRunManager, result, options, outputPath, processingTime);
  } else {
    displayFinalSummary(result, options, outputPath, processingTime);
  }
}

async function discoverFiles(inputPath: string): Promise<string[]> {
  const patterns = [
    path.join(inputPath, '**/*.html'),
    path.join(inputPath, '**/*.htm'),
    path.join(inputPath, '**/*.js'),
    path.join(inputPath, '**/*.jsx'),
    path.join(inputPath, '**/*.ts'),
    path.join(inputPath, '**/*.tsx'),
    path.join(inputPath, '**/*.vue'),
    path.join(inputPath, '**/*.svelte'),
  ];

  const allFiles: string[] = [];
  for (const pattern of patterns) {
    try {
      const files = await glob(pattern, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**'],
      });
      allFiles.push(...files);
    } catch (error) {
      console.warn(`Warning: Could not process pattern ${pattern}:`, error);
    }
  }

  // Remove duplicates and return
  return [...new Set(allFiles)];
}

async function extractPatterns(files: string[], options: OptimizeOptions): Promise<{
  htmlResults: any[];
  jsxResults: any[];
}> {
  const htmlResults: any[] = [];
  const jsxResults: any[] = [];
  
  const htmlExtractor = createHtmlExtractor();
  const jsExtractor = createJsExtractor();

  let processedFiles = 0;
  
  for (const file of files) {
    try {
      const fileContent = await fs.readFile(file, 'utf-8');
      processedFiles++;

      if (options.verbose && processedFiles % 10 === 0) {
        console.log(`    Processed ${processedFiles}/${files.length} files...`);
      }

      if (file.endsWith('.html') || file.endsWith('.htm')) {
        const result = await htmlExtractor.extractFromString(fileContent, file);
        htmlResults.push(result);
      } else if (
        file.endsWith('.js') ||
        file.endsWith('.jsx') ||
        file.endsWith('.ts') ||
        file.endsWith('.tsx') ||
        file.endsWith('.vue') ||
        file.endsWith('.svelte')
      ) {
        const result = await jsExtractor.extractFromString(fileContent, file);
        jsxResults.push(result);
      }
    } catch (error) {
      console.warn(`  Warning: Failed to process ${file}:`, error instanceof Error ? error.message : String(error));
    }
  }

  return { htmlResults, jsxResults };
}

function createConsolidatorOptions(options: OptimizeOptions, minFrequency: number): Partial<CompleteConsolidatorOptions> {
  return {
    minimumFrequency: minFrequency,
    caseSensitive: options.caseSensitive || false,
    enablePatternGrouping: options.enablePatternGrouping !== false,
    enableCoOccurrenceAnalysis: options.enableCoOccurrenceAnalysis !== false,
    maxCoOccurrenceDistance: parseInt(String(options.maxCoOccurrenceDistance || '5'), 10),
    includeFrameworkAnalysis: options.includeFrameworkAnalysis !== false,
    enableValidation: options.enableValidation || false,
    outputFormat: (options.outputFormat as 'map' | 'array' | 'json') || 'map',
    sortBy: (options.sortBy as 'frequency' | 'alphabetical' | 'source') || 'frequency',
    sortDirection: (options.sortDirection as 'asc' | 'desc') || 'desc',
    enableAtomicWrites: !options.dryRun && (options.enableAtomicWrites !== false),
    createBackups: options.createBackups !== false,
    identifierOptions: {
      base: parseInt(String(options.identifierBase || '26'), 10),
      startLength: parseInt(String(options.identifierStartLength || '1'), 10),
      maxLength: parseInt(String(options.identifierMaxLength || '3'), 10),
      prefix: String(options.identifierPrefix || ''),
    },
    dataStructureConfig: {
      maxEntries: options.dataStructureMaxEntries ? parseInt(String(options.dataStructureMaxEntries), 10) : 1000,
      enableLRUEviction: options.enableLruEviction || false,
      patternCacheSize: options.patternCacheSize ? parseInt(String(options.patternCacheSize), 10) : 100,
      memoryEfficientMode: options.memoryEfficientMode || false,
      enableCoOccurrenceTracking: options.enableCoOccurrenceAnalysis !== false,
      maxCoOccurrenceDistance: parseInt(String(options.maxCoOccurrenceDistance || '5'), 10),
    },
  };
}

async function runWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation()
      .then(result => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function displayResults(result: ConsolidationResult, options: OptimizeOptions, processingTime: number): Promise<void> {
  console.log('\n📊 Optimization Results:');
  console.log(`  Patterns found: ${result.statistics.totalPatternsFound}`);
  console.log(`  Patterns consolidated: ${result.statistics.totalPatternsConsolidated}`);
  console.log(`  Files modified: ${result.statistics.totalFilesModified}`);
  console.log(`  Total replacements: ${result.statistics.totalReplacements}`);
  console.log(`  Processing time: ${result.statistics.processingTime}ms (Total: ${processingTime}ms)`);
  
  if (result.statistics.dataStructureStats) {
    console.log(`  Memory usage: ${result.statistics.memoryUsage ? Math.round(result.statistics.memoryUsage / 1024) + 'KB' : 'N/A'}`);
    
    const stats = result.statistics.dataStructureStats;
    console.log(`  Data structures performance:`);
    console.log(`    Frequency counter entries: ${stats.frequencyCounter.mapEntries || 0}`);
    console.log(`    Pattern trie nodes: ${stats.patternTrie.nodeCount || 0}`);
    console.log(`    Cache entries: ${stats.normalizedCache.size || 0}`);
  }

  // Memory threshold warning
  const memoryThreshold = parseInt(String(options.memoryThreshold || '100'), 10) * 1024 * 1024; // Convert MB to bytes
  if (result.statistics.memoryUsage && result.statistics.memoryUsage > memoryThreshold) {
    console.log(`\n⚠️  Memory usage (${Math.round(result.statistics.memoryUsage / 1024 / 1024)}MB) exceeds threshold (${Math.round(memoryThreshold / 1024 / 1024)}MB)`);
  }

  // Display warnings
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  // Display errors
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(error => console.log(`  - ${error}`));
  }
}

async function generateCssContent(result: ConsolidationResult, options: OptimizeOptions): Promise<string> {
  const cssRules: string[] = [];
  
  // Add header comment
  cssRules.push(`/* Generated by @tw-enigma/cli - Advanced CSS Optimization */`);
  cssRules.push(`/* Generated on: ${new Date().toISOString()} */`);
  cssRules.push(`/* Patterns: ${result.patterns.size} consolidated from ${result.statistics.totalPatternsFound} found */`);
  cssRules.push('');
  
  for (const [normalizedPattern, extractionResult] of result.patterns) {
    cssRules.push(`.${extractionResult.identifier} { @apply ${extractionResult.original}; }`);
  }
  
  return cssRules.join('\n');
}

async function generateCssFile(result: ConsolidationResult, outputPath: string, options: OptimizeOptions): Promise<void> {
  console.log('\n📝 Writing optimized CSS file...');
  
  const cssContent = await generateCssContent(result, options);
  await fs.writeFile(outputPath, cssContent, 'utf-8');
  console.log(`  CSS written to: ${outputPath}`);
  
  if (options.verbose) {
    for (const [normalizedPattern, extractionResult] of result.patterns) {
      console.log(`  ${extractionResult.original} → ${extractionResult.identifier} (used ${extractionResult.frequency} times)`);
    }
  }
}

async function generateReportContent(
  result: ConsolidationResult, 
  options: OptimizeOptions,
  totalProcessingTime: number
): Promise<string> {
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '@tw-enigma/cli',
      totalProcessingTime,
      options: {
        minimumFrequency: result.analysisResult ? 
          (result.analysisResult as any).options?.minimumFrequency : 
          parseInt(String(options.minFrequency || '2'), 10),
        enabledFeatures: {
          patternGrouping: options.enablePatternGrouping !== false,
          coOccurrenceAnalysis: options.enableCoOccurrenceAnalysis !== false,
          frameworkAnalysis: options.includeFrameworkAnalysis !== false,
          validation: options.enableValidation || false,
          atomicWrites: options.enableAtomicWrites !== false,
          backups: options.createBackups !== false,
        },
      },
    },
    summary: {
      totalPatternsFound: result.statistics.totalPatternsFound,
      totalPatternsConsolidated: result.statistics.totalPatternsConsolidated,
      totalFilesModified: result.statistics.totalFilesModified,
      totalReplacements: result.statistics.totalReplacements,
      processingTime: result.statistics.processingTime,
      memoryUsage: result.statistics.memoryUsage,
      compressionRatio: result.statistics.totalPatternsFound > 0 ? 
        result.statistics.totalPatternsConsolidated / result.statistics.totalPatternsFound : 0,
    },
    dataStructurePerformance: result.statistics.dataStructureStats,
    patterns: Array.from(result.patterns.entries()).map(([normalized, extraction]) => ({
      original: extraction.original,
      normalized,
      identifier: extraction.identifier,
      frequency: extraction.frequency,
      sources: extraction.sources,
      validation: extraction.validation,
    })),
    fileModifications: result.fileModifications.map(mod => ({
      filePath: mod.filePath,
      replacements: mod.replacements,
      timestamp: mod.metadata.timestamp,
      hasBackup: !!mod.metadata.backup,
    })),
    warnings: result.warnings,
    errors: result.errors,
  };

  return JSON.stringify(report, null, 2);
}

async function generateDetailedReport(
  result: ConsolidationResult,
  reportPath: string,
  options: OptimizeOptions,
  totalProcessingTime: number
): Promise<void> {
  console.log('\n📄 Generating detailed optimization report...');
  
  const reportContent = await generateReportContent(result, options, totalProcessingTime);
  await fs.writeFile(reportPath, reportContent, 'utf-8');
  console.log(`  Report saved to: ${reportPath}`);
}

function displayFinalSummary(
  result: ConsolidationResult,
  options: OptimizeOptions,
  outputPath: string,
  totalTime: number
): void {
  console.log('\n🎉 Advanced CSS pattern optimization complete!');
  
  if (options.dryRun) {
    console.log('\n⚠️  This was a dry run - no files were actually modified.');
    console.log('   Remove --dry-run to apply changes.');
  } else if (result.statistics.totalFilesModified > 0) {
    console.log(`\n💾 Optimization Summary:`);
    console.log(`  - Modified ${result.statistics.totalFilesModified} files`);
    console.log(`  - Made ${result.statistics.totalReplacements} replacements`);
    console.log(`  - Consolidated ${result.statistics.totalPatternsConsolidated} patterns`);
    console.log(`  - Reduction ratio: ${Math.round((1 - (result.statistics.totalPatternsConsolidated / result.statistics.totalPatternsFound)) * 100)}%`);
    console.log(`  - Total time: ${totalTime}ms`);
    console.log(`  - CSS file: ${outputPath}`);
    
    if (result.statistics.memoryUsage) {
      console.log(`  - Peak memory: ${Math.round(result.statistics.memoryUsage / 1024)}KB`);
    }
    
    console.log('\n   Include the generated CSS file in your build to apply the optimized styles.');
  } else {
    console.log('\n   No patterns met the consolidation criteria.');
  }
}

async function displayDryRunSummary(
  dryRunManager: DryRunManager,
  result: ConsolidationResult,
  options: OptimizeOptions,
  outputPath: string,
  processingTime: number
): Promise<void> {
  console.log('\n🧪 Generating advanced dry run preview report...\n');
  
  const dryRunResult = await dryRunManager.endSession();
  
  // Generate visual diff and impact analysis
  const visualDiffGenerator = new VisualDiffGenerator();
  const impactEstimator = new ImpactEstimator();
  const reportGenerator = new DryRunReportGenerator();
  const outputManager = new OutputManager();
  
  // Analyze impact of proposed changes
  const impact = await impactEstimator.estimateImpact(dryRunResult);
  
  // Generate comprehensive report
  const report = await reportGenerator.generateReport(dryRunResult, {
    includeOperationDetails: true,
    includeImpactAnalysis: true,
    includeFilePreview: options.verbose,
    format: 'console'
  });
  
  // Display enhanced preview
  console.log('📊 Advanced Optimization Dry Run Summary:');
  console.log(`  Files that would be modified: ${dryRunResult.summary.filesWouldBeModified}`);
  console.log(`  Files that would be created: ${dryRunResult.summary.filesWouldBeCreated}`);
  console.log(`  Total size impact: ${formatBytes(dryRunResult.summary.totalSizeImpact)}`);
  console.log(`  Patterns consolidated: ${result.statistics.totalPatternsConsolidated}/${result.statistics.totalPatternsFound}`);
  console.log(`  Processing time: ${processingTime}ms`);
  
  if (impact.riskScore) {
    const riskLevel = impact.riskScore > 0.7 ? '🔴 High' : 
                     impact.riskScore > 0.4 ? '🟡 Medium' : '🟢 Low';
    console.log(`  Risk assessment: ${riskLevel} (${(impact.riskScore * 100).toFixed(1)}%)`);
  }
  
  if (impact.performanceGain) {
    console.log(`  Expected performance gain: ${(impact.performanceGain * 100).toFixed(1)}%`);
  }
  
  if (result.statistics.memoryUsage) {
    console.log(`  Memory usage: ${Math.round(result.statistics.memoryUsage / 1024)}KB`);
  }
  
  console.log('\n📝 Proposed Changes:');
  dryRunResult.operationsByType['file-write']?.forEach((op, index) => {
    if (index < 10) { // Show first 10 operations
      console.log(`  ✏️  ${op.description}`);
      console.log(`      Target: ${path.relative(process.cwd(), op.target)}`);
      if (op.sizeImpact) {
        console.log(`      Size: ${formatBytes(op.sizeImpact)}`);
      }
    }
  });
  
  if (dryRunResult.totalOperations > 10) {
    console.log(`  ... and ${dryRunResult.totalOperations - 10} more operations`);
  }
  
  console.log('\n🎨 Pattern Preview:');
  const sortedPatterns = Array.from(result.patterns.entries())
    .sort((a, b) => b[1].frequency - a[1].frequency)
    .slice(0, 5); // Show top 5 patterns
    
  sortedPatterns.forEach(([normalizedPattern, extractionResult]) => {
    console.log(`  ${extractionResult.original} → ${extractionResult.identifier} (${extractionResult.frequency}x)`);
  });
  
  if (result.patterns.size > 5) {
    console.log(`  ... and ${result.patterns.size - 5} more patterns`);
  }
  
  console.log('\n💡 To apply these optimizations:');
  console.log('   Remove the --dry-run flag and run the command again');
  
  if (options.verbose) {
    console.log('\n📄 Detailed Dry Run Report:');
    console.log(report);
  }
  
  console.log('\n⚠️  This was a dry run - no files were actually modified.');
}

// Helper function to format bytes in human-readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function createOptimizeCommand(): Command {
  return optimizeCommand;
}