/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SourceMapGenerator as SMGenerator, SourceMapConsumer, RawSourceMap } from "source-map";
import { createLogger, Logger } from "./logger.ts";
import { EnigmaConfig } from "./config.ts";
import { writeFile, readFile } from "fs/promises";
import { join, dirname, basename } from "path";

/**
 * Source mapping information for a CSS transformation
 */
export interface SourceMapping {
  originalFile: string;
  originalLine: number;
  originalColumn: number;
  generatedLine: number;
  generatedColumn: number;
  name?: string;
  content?: string;
}

/**
 * CSS optimization mapping for source maps
 */
export interface CssOptimizationMapping {
  originalClass: string;
  optimizedClass: string;
  originalFile: string;
  originalLine: number;
  originalColumn: number;
  generatedLine: number;
  generatedColumn: number;
  transformationType: 'class-rename' | 'class-merge' | 'class-remove' | 'property-optimize';
  context?: {
    selector?: string;
    property?: string;
    value?: string;
    framework?: string;
  };
}

/**
 * Source map generation options
 */
export interface SourceMapOptions {
  enabled: boolean;
  outputPath?: string;
  includeContent: boolean;
  includeNames: boolean;
  separateFiles: boolean;
  inlineSourceMap: boolean;
  sourceRoot?: string;
  transformationMappings: boolean;
  debugInfo: boolean;
}

/**
 * Source map generation result
 */
export interface SourceMapResult {
  sourceMap: RawSourceMap;
  sourceMapContent: string;
  mappingCount: number;
  outputPath?: string;
  inlineMap?: string;
  transformationMappings?: CssOptimizationMapping[];
}

/**
 * Source map generator for CSS optimizations
 * Helps developers understand and debug the optimization process
 */
export class SourceMapGenerator {
  private logger: Logger;
  private options: SourceMapOptions;
  private generator: SMGenerator;
  private transformationMappings: CssOptimizationMapping[] = [];
  private sourceContents: Map<string, string> = new Map();

  constructor(options: Partial<SourceMapOptions> = {}) {
    this.options = {
      enabled: true,
      includeContent: true,
      includeNames: true,
      separateFiles: true,
      inlineSourceMap: false,
      transformationMappings: true,
      debugInfo: false,
      ...options,
    };

    this.logger = createLogger("SourceMapGenerator");
    this.generator = new SMGenerator({
      file: "optimized.css",
      sourceRoot: this.options.sourceRoot,
    });

    this.logger.debug("Source map generator initialized", {
      options: this.options,
    });
  }

  /**
   * Add a source mapping for a CSS transformation
   */
  addMapping(mapping: SourceMapping): void {
    if (!this.options.enabled) {
      return;
    }

    this.generator.addMapping({
      source: mapping.originalFile,
      original: {
        line: mapping.originalLine,
        column: mapping.originalColumn,
      },
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn,
      },
      name: this.options.includeNames ? mapping.name : undefined,
    });

    // Store source content if provided and option is enabled
    if (this.options.includeContent && mapping.content) {
      this.sourceContents.set(mapping.originalFile, mapping.content);
      this.generator.setSourceContent(mapping.originalFile, mapping.content);
    }

    this.logger.trace("Source mapping added", mapping as any);
  }

  /**
   * Add a CSS optimization mapping for debugging
   */
  addOptimizationMapping(mapping: CssOptimizationMapping): void {
    if (!this.options.enabled || !this.options.transformationMappings) {
      return;
    }

    this.transformationMappings.push(mapping);

    // Also add as a regular source mapping
    this.addMapping({
      originalFile: mapping.originalFile,
      originalLine: mapping.originalLine,
      originalColumn: mapping.originalColumn,
      generatedLine: mapping.generatedLine,
      generatedColumn: mapping.generatedColumn,
      name: mapping.originalClass,
    });

    this.logger.debug("Optimization mapping added", {
      originalClass: mapping.originalClass,
      optimizedClass: mapping.optimizedClass,
      transformationType: mapping.transformationType,
    });
  }

  /**
   * Add multiple mappings from a CSS transformation
   */
  addMappings(mappings: SourceMapping[]): void {
    mappings.forEach(mapping => this.addMapping(mapping));
    this.logger.debug("Multiple source mappings added", {
      count: mappings.length,
    });
  }

  /**
   * Add multiple optimization mappings
   */
  addOptimizationMappings(mappings: CssOptimizationMapping[]): void {
    mappings.forEach(mapping => this.addOptimizationMapping(mapping));
    this.logger.debug("Multiple optimization mappings added", {
      count: mappings.length,
    });
  }

  /**
   * Get all transformation mappings
   */
  getMappings(): CssOptimizationMapping[] {
    return [...this.transformationMappings];
  }

  /**
   * Generate source map (alias for generate method)
   */
  async generateSourceMap(outputFile?: string): Promise<string> {
    const result = await this.generate(outputFile);
    return result.sourceMapContent;
  }

  /**
   * Add transformation (alias for addOptimizationMapping)
   */
  addTransformation(mapping: CssOptimizationMapping): void {
    this.addOptimizationMapping(mapping);
  }

  /**
   * Save source map to file
   */
  async saveSourceMap(outputFile: string, content: string): Promise<void> {
    const sourceMapPath = this.getSourceMapPath(outputFile);
    await this.writeSourceMapFile(sourceMapPath, content);
  }

  /**
   * Generate the source map
   */
  async generate(outputFile?: string): Promise<SourceMapResult> {
    if (!this.options.enabled) {
      throw new Error("Source map generation is disabled");
    }

    this.logger.info("Generating source map", {
      outputFile,
      mappingCount: this.transformationMappings.length,
    });

    const sourceMapContent = this.generator.toString();
    const sourceMap = JSON.parse(sourceMapContent);

    const result: SourceMapResult = {
      sourceMap,
      sourceMapContent,
      mappingCount: this.transformationMappings.length,
      transformationMappings: this.options.transformationMappings 
        ? this.transformationMappings 
        : undefined,
    };

    // Generate inline source map if requested
    if (this.options.inlineSourceMap) {
      const base64Map = Buffer.from(sourceMapContent).toString('base64');
      result.inlineMap = `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64Map} */`;
    }

    // Write to separate file if requested
    if (this.options.separateFiles && outputFile) {
      const sourceMapPath = this.getSourceMapPath(outputFile);
      await this.writeSourceMapFile(sourceMapPath, sourceMapContent);
      result.outputPath = sourceMapPath;
    }

    this.logger.info("Source map generated successfully", {
      mappingCount: result.mappingCount,
      outputPath: result.outputPath,
      hasInlineMap: !!result.inlineMap,
    });

    return result;
  }

  /**
   * Generate a debug report with transformation details
   */
  generateDebugReport(): {
    summary: {
      totalMappings: number;
      transformationTypes: Record<string, number>;
      filesProcessed: string[];
      optimizationStats: {
        classesRenamed: number;
        classesMerged: number;
        classesRemoved: number;
        propertiesOptimized: number;
      };
    };
    mappings: CssOptimizationMapping[];
    sourceFiles: Array<{
      file: string;
      mappings: number;
      hasContent: boolean;
    }>;
  } {
    const transformationTypes: Record<string, number> = {};
    const filesProcessed = new Set<string>();
    const optimizationStats = {
      classesRenamed: 0,
      classesMerged: 0,
      classesRemoved: 0,
      propertiesOptimized: 0,
    };

    // Analyze transformation mappings
    this.transformationMappings.forEach(mapping => {
      transformationTypes[mapping.transformationType] = 
        (transformationTypes[mapping.transformationType] || 0) + 1;
      
      filesProcessed.add(mapping.originalFile);

      switch (mapping.transformationType) {
        case 'class-rename':
          optimizationStats.classesRenamed++;
          break;
        case 'class-merge':
          optimizationStats.classesMerged++;
          break;
        case 'class-remove':
          optimizationStats.classesRemoved++;
          break;
        case 'property-optimize':
          optimizationStats.propertiesOptimized++;
          break;
      }
    });

    // Analyze source files
    const sourceFiles = Array.from(filesProcessed).map(file => ({
      file,
      mappings: this.transformationMappings.filter(m => m.originalFile === file).length,
      hasContent: this.sourceContents.has(file),
    }));

    return {
      summary: {
        totalMappings: this.transformationMappings.length,
        transformationTypes,
        filesProcessed: Array.from(filesProcessed),
        optimizationStats,
      },
      mappings: this.transformationMappings,
      sourceFiles,
    };
  }

  /**
   * Load source content from file
   */
  async loadSourceContent(filePath: string): Promise<void> {
    if (!this.options.includeContent) {
      return;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      this.sourceContents.set(filePath, content);
      this.generator.setSourceContent(filePath, content);
      
      this.logger.debug("Source content loaded", {
        filePath,
        contentLength: content.length,
      });
    } catch (_) {
      this.logger.warn("Failed to load source content", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load multiple source files
   */
  async loadSourceContents(filePaths: string[]): Promise<void> {
    await Promise.all(filePaths.map(path => this.loadSourceContent(path)));
    this.logger.debug("Multiple source contents loaded", {
      count: filePaths.length,
    });
  }

  /**
   * Reset the generator for a new transformation
   */
  reset(): void {
    this.generator = new SMGenerator({
      file: "optimized.css",
      sourceRoot: this.options.sourceRoot,
    });
    this.transformationMappings = [];
    this.sourceContents.clear();
    
    this.logger.debug("Source map generator reset");
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<SourceMapOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.logger.debug("Source map options updated", {
      newOptions,
      fullOptions: this.options,
    });
  }

  /**
   * Get the source map file path
   */
  private getSourceMapPath(outputFile: string): string {
    if (this.options.outputPath) {
      return this.options.outputPath;
    }
    
    const dir = dirname(outputFile);
    const name = basename(outputFile, '.css');
    return join(dir, `${name}.css.map`);
  }

  /**
   * Write source map to file
   */
  private async writeSourceMapFile(filePath: string, content: string): Promise<void> {
    try {
      await writeFile(filePath, content, 'utf-8');
      this.logger.debug("Source map file written", {
        filePath,
        contentLength: content.length,
      });
    } catch (_) {
      this.logger.error("Failed to write source map file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Parse existing source map for chaining
   */
  static async parseSourceMap(sourceMapPath: string): Promise<SourceMapConsumer> {
    const logger = createLogger("SourceMapParser");
    
    try {
      const content = await readFile(sourceMapPath, 'utf-8');
      const sourceMap = JSON.parse(content);
      const consumer = await new SourceMapConsumer(sourceMap);
      
      logger.debug("Source map parsed successfully", {
        sourceMapPath,
        sources: sourceMap.sources?.length || 0,
        mappings: sourceMap.mappings?.length || 0,
      });
      
      return consumer;
    } catch (_) {
      logger.error("Failed to parse source map", {
        sourceMapPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Chain source maps for multi-step transformations
   */
  static async chainSourceMaps(
    originalMap: SourceMapConsumer,
    newMappings: SourceMapping[],
    outputFile: string,
  ): Promise<SourceMapResult> {
    const logger = createLogger("SourceMapChainer");
    const generator = new SMGenerator({ file: outputFile });

    logger.debug("Chaining source maps", {
      originalSources: (originalMap as any).sources?.length || 0,
      newMappings: newMappings.length,
    });

    // Add mappings from the new transformation, mapping back to original sources
    newMappings.forEach(mapping => {
      const originalPosition = originalMap.originalPositionFor({
        line: mapping.originalLine,
        column: mapping.originalColumn,
      });

      if (originalPosition.source) {
        generator.addMapping({
          source: originalPosition.source,
          original: {
            line: originalPosition.line || 1,
            column: originalPosition.column || 0,
          },
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn,
          },
          name: originalPosition.name || mapping.name,
        });
      }
    });

    const sourceMap = generator.toJSON();
    const sourceMapContent = JSON.stringify(sourceMap, null, 2);

    logger.debug("Source maps chained successfully", {
      finalMappings: newMappings.length,
    });

    return {
      sourceMap,
      sourceMapContent,
      mappingCount: newMappings.length,
    };
  }
}

/**
 * Create and configure source map generator
 */
export function createSourceMapGenerator(
  config: EnigmaConfig,
  outputFile?: string,
): SourceMapGenerator | null {
  // Check if source maps are enabled via dev mode or explicit sourceMaps config
  const sourceMapsEnabled = config.sourceMaps || config.dev?.enabled;
  
  if (!sourceMapsEnabled) {
    return null;
  }

  const options: SourceMapOptions = {
    enabled: sourceMapsEnabled,
    includeContent: true,
    includeNames: true,
    separateFiles: true,
    inlineSourceMap: false,
    transformationMappings: config.dev?.enabled ?? false,
    debugInfo: config.debug ?? false,
    outputPath: outputFile ? `${outputFile}.map` : undefined,
  };

  return new SourceMapGenerator(options);
}

/**
 * Utility function to create CSS optimization mapping
 */
export function createOptimizationMapping(
  originalClass: string,
  optimizedClass: string,
  originalFile: string,
  originalPosition: { line: number; column: number },
  generatedPosition: { line: number; column: number },
  transformationType: CssOptimizationMapping['transformationType'],
  context?: CssOptimizationMapping['context'],
): CssOptimizationMapping {
  return {
    originalClass,
    optimizedClass,
    originalFile,
    originalLine: originalPosition.line,
    originalColumn: originalPosition.column,
    generatedLine: generatedPosition.line,
    generatedColumn: generatedPosition.column,
    transformationType,
    context,
  };
} 