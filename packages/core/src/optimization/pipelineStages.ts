/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PipelineStage, PipelineStageData, IncrementalPipelineConfig } from './incrementalPipeline.js';
import { FileProcessor } from '../processors/fileProcessor.js';
import { HTMLExtractor } from '../processors/htmlExtractor.js';
import { JSExtractor } from '../processors/jsExtractor.js';
import { PatternAnalysis } from '../processors/patternAnalysis.js';
import { MultiPassDiscovery } from './multiPassDiscovery.js';
import { CompleteConsolidator } from './completeConsolidator.js';
import { CSSGeneration } from '../engine/cssGeneration.js';
import { MetricsCollector } from '../metrics/collector.js';

/**
 * File discovery and reading stage
 */
export class FileDiscoveryStage implements PipelineStage<string, any> {
  public readonly id = 'file_discovery';
  public readonly name = 'File Discovery and Reading';
  public readonly dependencies: string[] = [];
  public readonly isParallel = true;
  public readonly supportsBatching = true;
  public readonly supportsStreaming = true;

  private fileProcessor?: FileProcessor;
  private config?: IncrementalPipelineConfig;

  public async initialize(config: IncrementalPipelineConfig): Promise<void> {
    this.config = config;
    this.fileProcessor = new FileProcessor({
      maxConcurrency: config.maxConcurrency,
      enableParallel: config.enableWorkerThreads,
    });
  }

  public async process(data: PipelineStageData<string, any>): Promise<PipelineStageData<string, any>> {
    if (!this.fileProcessor) {
      throw new Error('FileDiscoveryStage not initialized');
    }

    const filePath = data.input;
    
    try {
      const fileContent = await this.fileProcessor.readFile(filePath);
      const fileInfo = await this.fileProcessor.getFileInfo(filePath);
      
      return {
        ...data,
        output: {
          filePath,
          content: fileContent,
          encoding: fileInfo.encoding,
          size: fileInfo.size,
          mtime: fileInfo.mtime,
          checksum: fileInfo.checksum,
        },
      };
    } catch (error) {
      throw new Error(`Failed to process file ${filePath}: ${error.message}`);
    }
  }

  public async processBatch(batch: PipelineStageData<string, any>[]): Promise<PipelineStageData<string, any>[]> {
    if (!this.fileProcessor) {
      throw new Error('FileDiscoveryStage not initialized');
    }

    const filePaths = batch.map(item => item.input);
    const results = await this.fileProcessor.readFiles(filePaths);
    
    return batch.map((item, index) => ({
      ...item,
      output: results[index],
    }));
  }

  public async cleanup(): Promise<void> {
    // Cleanup resources if needed
  }
}

/**
 * Content extraction stage (HTML/JS)
 */
export class ContentExtractionStage implements PipelineStage<any, any> {
  public readonly id = 'content_extraction';
  public readonly name = 'Content Extraction';
  public readonly dependencies = ['file_discovery'];
  public readonly isParallel = true;
  public readonly supportsBatching = true;
  public readonly supportsStreaming = true;

  private htmlExtractor?: HTMLExtractor;
  private jsExtractor?: JSExtractor;
  private config?: IncrementalPipelineConfig;

  public async initialize(config: IncrementalPipelineConfig): Promise<void> {
    this.config = config;
    this.htmlExtractor = new HTMLExtractor({
      enableParallel: config.enableWorkerThreads,
      maxConcurrency: config.maxConcurrency,
    });
    this.jsExtractor = new JSExtractor({
      enableParallel: config.enableWorkerThreads,
      maxConcurrency: config.maxConcurrency,
    });
  }

  public async process(data: PipelineStageData<any, any>): Promise<PipelineStageData<any, any>> {
    if (!this.htmlExtractor || !this.jsExtractor) {
      throw new Error('ContentExtractionStage not initialized');
    }

    const fileData = data.input;
    const { filePath, content } = fileData;
    
    let extractedClasses: string[] = [];
    let extractionType: string;
    
    if (filePath.match(/\.(html|htm|jsx|tsx)$/i)) {
      extractedClasses = await this.htmlExtractor.extractClasses(content, { filePath });
      extractionType = 'html';
    } else if (filePath.match(/\.(js|ts|jsx|tsx)$/i)) {
      extractedClasses = await this.jsExtractor.extractClasses(content, { filePath });
      extractionType = 'javascript';
    } else {
      extractionType = 'unknown';
    }

    return {
      ...data,
      output: {
        ...fileData,
        extractedClasses,
        extractionType,
        classCount: extractedClasses.length,
      },
    };
  }

  public async processBatch(batch: PipelineStageData<any, any>[]): Promise<PipelineStageData<any, any>[]> {
    // Process each item in parallel
    const promises = batch.map(item => this.process(item));
    return Promise.all(promises);
  }

  public async cleanup(): Promise<void> {
    // Cleanup resources if needed
  }
}

/**
 * Pattern analysis stage
 */
export class PatternAnalysisStage implements PipelineStage<any, any> {
  public readonly id = 'pattern_analysis';
  public readonly name = 'Pattern Analysis';
  public readonly dependencies = ['content_extraction'];
  public readonly isParallel = false; // Pattern analysis needs aggregation
  public readonly supportsBatching = true;
  public readonly supportsStreaming = false;

  private patternAnalysis?: PatternAnalysis;
  private config?: IncrementalPipelineConfig;
  private accumulatedClasses: Map<string, number> = new Map();

  public async initialize(config: IncrementalPipelineConfig): Promise<void> {
    this.config = config;
    this.patternAnalysis = new PatternAnalysis({
      enableCaching: config.enableCaching,
      cacheMaxSize: config.cacheMaxSize,
    });
    this.accumulatedClasses.clear();
  }

  public async process(data: PipelineStageData<any, any>): Promise<PipelineStageData<any, any>> {
    if (!this.patternAnalysis) {
      throw new Error('PatternAnalysisStage not initialized');
    }

    const fileData = data.input;
    const { extractedClasses } = fileData;

    // Accumulate class frequencies
    for (const className of extractedClasses) {
      const current = this.accumulatedClasses.get(className) || 0;
      this.accumulatedClasses.set(className, current + 1);
    }

    // Analyze patterns for this file
    const filePatterns = await this.patternAnalysis.analyzeFile({
      filePath: fileData.filePath,
      classes: extractedClasses,
    });

    return {
      ...data,
      output: {
        ...fileData,
        patterns: filePatterns,
        totalAccumulatedClasses: this.accumulatedClasses.size,
      },
    };
  }

  public async processBatch(batch: PipelineStageData<any, any>[]): Promise<PipelineStageData<any, any>[]> {
    const results = [];
    
    for (const item of batch) {
      const result = await this.process(item);
      results.push(result);
    }

    // Generate global pattern analysis for the batch
    if (this.accumulatedClasses.size > 0) {
      const globalPatterns = await this.patternAnalysis!.analyzeGlobal(
        Array.from(this.accumulatedClasses.entries()).map(([className, frequency]) => ({
          className,
          frequency,
        }))
      );

      // Attach global patterns to the last item in the batch
      if (results.length > 0) {
        results[results.length - 1].output.globalPatterns = globalPatterns;
      }
    }

    return results;
  }

  public async cleanup(): Promise<void> {
    this.accumulatedClasses.clear();
  }
}

/**
 * Multi-pass discovery stage
 */
export class MultiPassDiscoveryStage implements PipelineStage<any, any> {
  public readonly id = 'multipass_discovery';
  public readonly name = 'Multi-Pass Discovery';
  public readonly dependencies = ['pattern_analysis'];
  public readonly isParallel = false;
  public readonly supportsBatching = true;
  public readonly supportsStreaming = false;

  private multiPassDiscovery?: MultiPassDiscovery;
  private config?: IncrementalPipelineConfig;

  public async initialize(config: IncrementalPipelineConfig): Promise<void> {
    this.config = config;
    this.multiPassDiscovery = new MultiPassDiscovery({
      maxPasses: 5,
      convergenceThreshold: 0.01,
      enableMetrics: true,
    });
  }

  public async process(data: PipelineStageData<any, any>): Promise<PipelineStageData<any, any>> {
    if (!this.multiPassDiscovery) {
      throw new Error('MultiPassDiscoveryStage not initialized');
    }

    const fileData = data.input;
    
    // Run multi-pass discovery on accumulated patterns
    const discoveryResults = await this.multiPassDiscovery.discoverPatterns({
      patterns: fileData.patterns || [],
      globalPatterns: fileData.globalPatterns || [],
    });

    return {
      ...data,
      output: {
        ...fileData,
        discoveryResults,
        passCount: discoveryResults.passCount,
        converged: discoveryResults.converged,
      },
    };
  }

  public async processBatch(batch: PipelineStageData<any, any>[]): Promise<PipelineStageData<any, any>[]> {
    // For multi-pass discovery, we process the entire batch as one unit
    const allPatterns: any[] = [];
    const allGlobalPatterns: any[] = [];

    for (const item of batch) {
      if (item.input.patterns) {
        allPatterns.push(...item.input.patterns);
      }
      if (item.input.globalPatterns) {
        allGlobalPatterns.push(...item.input.globalPatterns);
      }
    }

    const discoveryResults = await this.multiPassDiscovery!.discoverPatterns({
      patterns: allPatterns,
      globalPatterns: allGlobalPatterns,
    });

    // Apply discovery results to all items in the batch
    return batch.map(item => ({
      ...item,
      output: {
        ...item.input,
        discoveryResults,
        passCount: discoveryResults.passCount,
        converged: discoveryResults.converged,
      },
    }));
  }

  public async cleanup(): Promise<void> {
    // Cleanup resources if needed
  }
}

/**
 * Optimization and consolidation stage
 */
export class OptimizationStage implements PipelineStage<any, any> {
  public readonly id = 'optimization';
  public readonly name = 'Optimization and Consolidation';
  public readonly dependencies = ['multipass_discovery'];
  public readonly isParallel = false;
  public readonly supportsBatching = true;
  public readonly supportsStreaming = false;

  private consolidator?: CompleteConsolidator;
  private config?: IncrementalPipelineConfig;

  public async initialize(config: IncrementalPipelineConfig): Promise<void> {
    this.config = config;
    this.consolidator = new CompleteConsolidator({
      enableParallel: config.enableWorkerThreads,
      maxConcurrency: config.maxConcurrency,
    });
  }

  public async process(data: PipelineStageData<any, any>): Promise<PipelineStageData<any, any>> {
    if (!this.consolidator) {
      throw new Error('OptimizationStage not initialized');
    }

    const fileData = data.input;
    
    // Run optimization on discovery results
    const optimizationResults = await this.consolidator.consolidate({
      discoveryResults: fileData.discoveryResults,
      patterns: fileData.patterns || [],
    });

    return {
      ...data,
      output: {
        ...fileData,
        optimizationResults,
        consolidatedPatterns: optimizationResults.consolidatedPatterns,
        optimizationMetrics: optimizationResults.metrics,
      },
    };
  }

  public async processBatch(batch: PipelineStageData<any, any>[]): Promise<PipelineStageData<any, any>[]> {
    // Collect all discovery results for batch optimization
    const allDiscoveryResults: any[] = [];
    const allPatterns: any[] = [];

    for (const item of batch) {
      if (item.input.discoveryResults) {
        allDiscoveryResults.push(item.input.discoveryResults);
      }
      if (item.input.patterns) {
        allPatterns.push(...item.input.patterns);
      }
    }

    const optimizationResults = await this.consolidator!.consolidate({
      discoveryResults: allDiscoveryResults,
      patterns: allPatterns,
    });

    // Apply optimization results to all items
    return batch.map(item => ({
      ...item,
      output: {
        ...item.input,
        optimizationResults,
        consolidatedPatterns: optimizationResults.consolidatedPatterns,
        optimizationMetrics: optimizationResults.metrics,
      },
    }));
  }

  public async cleanup(): Promise<void> {
    // Cleanup resources if needed
  }
}

/**
 * CSS generation stage
 */
export class CSSGenerationStage implements PipelineStage<any, any> {
  public readonly id = 'css_generation';
  public readonly name = 'CSS Generation';
  public readonly dependencies = ['optimization'];
  public readonly isParallel = false;
  public readonly supportsBatching = true;
  public readonly supportsStreaming = false;

  private cssGeneration?: CSSGeneration;
  private config?: IncrementalPipelineConfig;

  public async initialize(config: IncrementalPipelineConfig): Promise<void> {
    this.config = config;
    this.cssGeneration = new CSSGeneration({
      enableSourceMaps: true,
      enableMinification: true,
      enableValidation: true,
    });
  }

  public async process(data: PipelineStageData<any, any>): Promise<PipelineStageData<any, any>> {
    if (!this.cssGeneration) {
      throw new Error('CSSGenerationStage not initialized');
    }

    const fileData = data.input;
    
    // Generate CSS from optimization results
    const generationResults = await this.cssGeneration.generateCSS({
      consolidatedPatterns: fileData.consolidatedPatterns,
      optimizationResults: fileData.optimizationResults,
    });

    return {
      ...data,
      output: {
        ...fileData,
        generatedCSS: generationResults.css,
        sourceMap: generationResults.sourceMap,
        generationMetrics: generationResults.metrics,
      },
    };
  }

  public async processBatch(batch: PipelineStageData<any, any>[]): Promise<PipelineStageData<any, any>[]> {
    // For CSS generation, we need to consolidate all patterns into a single CSS output
    const allConsolidatedPatterns: any[] = [];
    const allOptimizationResults: any[] = [];

    for (const item of batch) {
      if (item.input.consolidatedPatterns) {
        allConsolidatedPatterns.push(...item.input.consolidatedPatterns);
      }
      if (item.input.optimizationResults) {
        allOptimizationResults.push(item.input.optimizationResults);
      }
    }

    const generationResults = await this.cssGeneration!.generateCSS({
      consolidatedPatterns: allConsolidatedPatterns,
      optimizationResults: allOptimizationResults,
    });

    // Apply generation results to all items
    return batch.map(item => ({
      ...item,
      output: {
        ...item.input,
        generatedCSS: generationResults.css,
        sourceMap: generationResults.sourceMap,
        generationMetrics: generationResults.metrics,
      },
    }));
  }

  public async cleanup(): Promise<void> {
    // Cleanup resources if needed
  }
}

/**
 * Metrics collection stage
 */
export class MetricsCollectionStage implements PipelineStage<any, any> {
  public readonly id = 'metrics_collection';
  public readonly name = 'Metrics Collection';
  public readonly dependencies = ['css_generation'];
  public readonly isParallel = true;
  public readonly supportsBatching = true;
  public readonly supportsStreaming = true;

  private metricsCollector?: MetricsCollector;
  private config?: IncrementalPipelineConfig;

  public async initialize(config: IncrementalPipelineConfig): Promise<void> {
    this.config = config;
    this.metricsCollector = new MetricsCollector();
  }

  public async process(data: PipelineStageData<any, any>): Promise<PipelineStageData<any, any>> {
    if (!this.metricsCollector) {
      throw new Error('MetricsCollectionStage not initialized');
    }

    const fileData = data.input;
    
    // Collect comprehensive metrics
    this.metricsCollector.incrementCounter('files_processed');
    this.metricsCollector.incrementCounter('classes_extracted', fileData.classCount || 0);
    
    if (fileData.optimizationMetrics) {
      this.metricsCollector.recordPerformance('optimization_time', {
        duration: fileData.optimizationMetrics.processingTime || 0,
        memory: fileData.optimizationMetrics.memoryUsage || 0,
        cpu: 0,
        stage: 'optimization',
        operationName: 'pattern_consolidation',
      });
    }

    if (fileData.generationMetrics) {
      this.metricsCollector.recordPerformance('css_generation_time', {
        duration: fileData.generationMetrics.processingTime || 0,
        memory: fileData.generationMetrics.memoryUsage || 0,
        cpu: 0,
        stage: 'css_generation',
        operationName: 'css_output',
      });
    }

    return {
      ...data,
      output: {
        ...fileData,
        pipelineMetrics: {
          timestamp: new Date(),
          stageId: this.id,
          processed: true,
        },
      },
    };
  }

  public async processBatch(batch: PipelineStageData<any, any>[]): Promise<PipelineStageData<any, any>[]> {
    const results = [];
    
    for (const item of batch) {
      const result = await this.process(item);
      results.push(result);
    }

    // Record batch-level metrics
    this.metricsCollector!.incrementCounter('batches_processed');
    this.metricsCollector!.setGauge('batch_size', batch.length, 'files');

    return results;
  }

  public async cleanup(): Promise<void> {
    // Export final metrics
    if (this.metricsCollector) {
      try {
        await this.metricsCollector.flush();
      } catch (error) {
        console.warn('Failed to flush metrics:', error);
      }
    }
  }
}

/**
 * Factory functions for creating standard pipeline stages
 */
export function createFileDiscoveryStage(): FileDiscoveryStage {
  return new FileDiscoveryStage();
}

export function createContentExtractionStage(): ContentExtractionStage {
  return new ContentExtractionStage();
}

export function createPatternAnalysisStage(): PatternAnalysisStage {
  return new PatternAnalysisStage();
}

export function createMultiPassDiscoveryStage(): MultiPassDiscoveryStage {
  return new MultiPassDiscoveryStage();
}

export function createOptimizationStage(): OptimizationStage {
  return new OptimizationStage();
}

export function createCSSGenerationStage(): CSSGenerationStage {
  return new CSSGenerationStage();
}

export function createMetricsCollectionStage(): MetricsCollectionStage {
  return new MetricsCollectionStage();
}

/**
 * Create a complete standard pipeline with all stages
 */
export function createStandardPipeline(): PipelineStage[] {
  return [
    createFileDiscoveryStage(),
    createContentExtractionStage(),
    createPatternAnalysisStage(),
    createMultiPassDiscoveryStage(),
    createOptimizationStage(),
    createCSSGenerationStage(),
    createMetricsCollectionStage(),
  ];
}