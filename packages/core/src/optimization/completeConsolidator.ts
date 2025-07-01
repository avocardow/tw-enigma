/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  PatternAnalysisInput,
  PatternFrequencyMap,
  AggregatedClassData,
  FrequencyAnalysisResult,
} from '../processors/patternAnalysis';
import { generateFrequencyMap, analyzePatterns } from '../processors/patternAnalysis';
import type { AtomicFileWriter } from '../atomicOps/AtomicFileWriter';
import type { ValidationResult } from '../patternValidator';
import { createHtmlExtractor } from '../processors/htmlExtractor';
import { createJsExtractor } from '../processors/jsExtractor';
import {
  DataStructureManager,
  createDataStructureManager,
  type DataStructureConfig,
} from './dataStructures';

/**
 * Configuration options for the CompleteConsolidator
 */
export interface CompleteConsolidatorOptions {
  /** Minimum frequency threshold for class consolidation */
  minimumFrequency: number;
  
  /** Whether to perform case-sensitive matching */
  caseSensitive: boolean;
  
  /** Enable pattern grouping analysis */
  enablePatternGrouping: boolean;
  
  /** Enable co-occurrence pattern analysis */
  enableCoOccurrenceAnalysis: boolean;
  
  /** Maximum distance for co-occurrence analysis */
  maxCoOccurrenceDistance: number;
  
  /** Include framework-specific analysis */
  includeFrameworkAnalysis: boolean;
  
  /** Enable validation of extracted patterns */
  enableValidation: boolean;
  
  /** Custom validation options */
  validationOptions?: Record<string, any>;
  
  /** Output format for results */
  outputFormat: 'map' | 'array' | 'json';
  
  /** Sorting criteria for results */
  sortBy: 'frequency' | 'alphabetical' | 'source';
  
  /** Sorting direction */
  sortDirection: 'asc' | 'desc';
  
  /** Enable atomic file operations */
  enableAtomicWrites: boolean;
  
  /** Backup files before modification */
  createBackups: boolean;
  
  /** Custom identifier generation options */
  identifierOptions: {
    /** Base for identifier generation (e.g., 26 for base-26) */
    base: number;
    /** Starting length for identifiers */
    startLength: number;
    /** Maximum length for identifiers */
    maxLength: number;
    /** Prefix for generated identifiers */
    prefix: string;
  };

  /** Data structure configuration for optimization */
  dataStructureConfig?: Partial<DataStructureConfig>;
}

/**
 * Default configuration for CompleteConsolidator
 */
export const DEFAULT_CONSOLIDATOR_OPTIONS: CompleteConsolidatorOptions = {
  minimumFrequency: 2,
  caseSensitive: false,
  enablePatternGrouping: true,
  enableCoOccurrenceAnalysis: true,
  maxCoOccurrenceDistance: 5,
  includeFrameworkAnalysis: true,
  enableValidation: false,
  outputFormat: 'map',
  sortBy: 'frequency',
  sortDirection: 'desc',
  enableAtomicWrites: true,
  createBackups: true,
  identifierOptions: {
    base: 26,
    startLength: 1,
    maxLength: 3,
    prefix: '',
  },
};

/**
 * Error class for consolidation operations
 */
export class ConsolidationError extends Error {
  public cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ConsolidationError';
    this.cause = cause;
  }
}

/**
 * Pattern extraction result with normalization metadata
 */
export interface ExtractionResult {
  /** Original extracted pattern */
  original: string;
  
  /** Normalized pattern */
  normalized: string;
  
  /** Generated unique identifier */
  identifier: string;
  
  /** Frequency count */
  frequency: number;
  
  /** Source attribution */
  sources: string[];
  
  /** Validation result if enabled */
  validation?: ValidationResult;
}

/**
 * File modification operation descriptor
 */
export interface FileModification {
  /** File path to modify */
  filePath: string;
  
  /** Original content */
  originalContent: string;
  
  /** Modified content */
  modifiedContent: string;
  
  /** List of replacements made */
  replacements: Array<{
    original: string;
    replacement: string;
    count: number;
  }>;
  
  /** Operation metadata */
  metadata: {
    timestamp: Date;
    checksum: string;
    backup?: string;
  };
}

/**
 * Complete consolidation result
 */
export interface ConsolidationResult {
  /** Pattern frequency analysis */
  analysisResult: FrequencyAnalysisResult;
  
  /** Extracted and normalized patterns */
  patterns: Map<string, ExtractionResult>;
  
  /** File modifications performed */
  fileModifications: FileModification[];
  
  /** Generated identifier mappings */
  identifierMappings: Map<string, string>;
  
  /** Operation statistics */
  statistics: {
    totalPatternsFound: number;
    totalPatternsConsolidated: number;
    totalFilesModified: number;
    totalReplacements: number;
    processingTime: number;
    memoryUsage?: number;
    dataStructureStats?: ReturnType<DataStructureManager['getOverallStats']>;
  };
  
  /** Errors encountered during processing */
  errors: string[];
  
  /** Warnings generated during processing */
  warnings: string[];
}

/**
 * CompleteConsolidator class for comprehensive pattern extraction and consolidation
 * 
 * This class extends the existing pattern analysis functionality to provide:
 * - Full element pattern detection and extraction
 * - Advanced frequency counting and normalization with optimized data structures
 * - Unique identifier generation with collision resistance
 * - Atomic file modification operations with rollback capabilities
 * - Comprehensive error handling and validation
 * - High-performance data structures for scalability
 */
export class CompleteConsolidator {
  private options: CompleteConsolidatorOptions;
  private atomicFileWriter?: AtomicFileWriter;
  private extractionCache: Map<string, ExtractionResult[]> = new Map();
  private identifierCounter: number = 0;
  private identifierMap: Map<string, string> = new Map();
  private dataStructureManager: DataStructureManager;

  constructor(
    options: Partial<CompleteConsolidatorOptions> = {},
    atomicFileWriter?: AtomicFileWriter
  ) {
    this.options = { ...DEFAULT_CONSOLIDATOR_OPTIONS, ...options };
    this.atomicFileWriter = atomicFileWriter;
    this.dataStructureManager = createDataStructureManager(this.options.dataStructureConfig);
  }

  /**
   * Perform complete pattern extraction and consolidation
   */
  async consolidate(input: PatternAnalysisInput): Promise<ConsolidationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate input
      this.validateInput(input);

      // Check memory pressure before processing
      const memoryCheck = this.dataStructureManager.checkMemoryPressure();
      if (memoryCheck.isUnderPressure) {
        warnings.push(`Memory pressure detected: ${memoryCheck.recommendations.join(', ')}`);
      }

      // Perform pattern analysis with frequency counting using optimized data structures
      const analysisResult = await this.performFrequencyAnalysis(input);

      // Extract and normalize patterns
      const patterns = await this.extractAndNormalizePatterns(analysisResult.frequencyMap);

      // Generate unique identifiers with collision resistance
      await this.generateUniqueIdentifiers(patterns);

      // Prepare file modifications
      const fileModifications = await this.prepareFileModifications(input, patterns);

      // Apply modifications if atomic writes are enabled
      if (this.options.enableAtomicWrites && this.atomicFileWriter) {
        await this.applyFileModifications(fileModifications);
      }

      // Generate statistics including data structure performance metrics
      const dataStructureStats = this.dataStructureManager.getOverallStats();
      const statistics = this.generateStatistics(
        analysisResult,
        patterns,
        fileModifications,
        Date.now() - startTime,
        dataStructureStats
      );

      return {
        analysisResult,
        patterns,
        fileModifications,
        identifierMappings: this.identifierMap,
        statistics,
        errors,
        warnings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Consolidation failed: ${errorMessage}`);
      
      throw new ConsolidationError(
        `Complete consolidation failed: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Perform frequency analysis with enhanced counting mechanisms using optimized data structures
   */
  private async performFrequencyAnalysis(input: PatternAnalysisInput): Promise<FrequencyAnalysisResult> {
    try {
      // Build frequency map using existing analysis but with enhanced counting
      const frequencyMap = new Map<string, AggregatedClassData>();

      // Process HTML results with frequency counting and data structure optimization
      for (const htmlResult of input.htmlResults) {
        await this.processHtmlFrequency(htmlResult, frequencyMap);
      }

      // Process JSX results with frequency counting and data structure optimization
      for (const jsxResult of input.jsxResults) {
        await this.processJsxFrequency(jsxResult, frequencyMap);
      }

      // Add patterns to our optimized data structures for fast lookup and analysis
      for (const [className, classData] of frequencyMap) {
        // Add to frequency counter for O(1) lookups
        for (let i = 0; i < classData.totalFrequency; i++) {
          this.dataStructureManager.frequencyCounter.increment(className);
        }

        // Add to pattern trie for prefix matching
        this.dataStructureManager.patternTrie.insert(className, className, {
          totalFrequency: classData.totalFrequency,
          sources: classData.sources,
        });

        // Track co-occurrence patterns for grouping analysis
        if (this.options.enableCoOccurrenceAnalysis) {
          const relatedPatterns = this.extractRelatedPatterns(className, frequencyMap);
          this.dataStructureManager.addPattern(className, relatedPatterns);
        }
      }

      // Use existing pattern analysis for comprehensive results
      const analysisResult = await analyzePatterns(input, this.options);

      // Merge our enhanced frequency data with the analysis result
      for (const [className, enhancedData] of frequencyMap) {
        const existingData = analysisResult.frequencyMap.get(className);
        if (existingData) {
          // Update frequency counts with our enhanced counting
          existingData.totalFrequency = enhancedData.totalFrequency;
          existingData.htmlFrequency = enhancedData.htmlFrequency;
          existingData.jsxFrequency = enhancedData.jsxFrequency;
        } else {
          // Add new entry if not found in original analysis
          analysisResult.frequencyMap.set(className, enhancedData);
        }
      }

      return analysisResult;
    } catch (error) {
      throw new ConsolidationError(
        `Failed to perform frequency analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract related patterns for co-occurrence analysis
   */
  private extractRelatedPatterns(className: string, frequencyMap: Map<string, AggregatedClassData>): string[] {
    const related: string[] = [];
    
    // Extract patterns that might co-occur based on common prefixes or semantic similarity
    for (const [otherClassName] of frequencyMap) {
      if (otherClassName !== className) {
        // Check for common prefixes (e.g., 'btn-' patterns)
        const commonPrefix = this.findCommonPrefix(className, otherClassName);
        if (commonPrefix.length >= 3) {
          related.push(otherClassName);
        }
        
        // Check for semantic relationships (e.g., color variants)
        if (this.areSemanticallySimilar(className, otherClassName)) {
          related.push(otherClassName);
        }
      }
    }
    
    return related.slice(0, this.options.maxCoOccurrenceDistance);
  }

  /**
   * Find common prefix between two strings
   */
  private findCommonPrefix(str1: string, str2: string): string {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++;
    }
    return str1.substring(0, i);
  }

  /**
   * Check if two class names are semantically similar
   */
  private areSemanticallySimilar(class1: string, class2: string): boolean {
    const semanticPatterns = [
      /^(text|bg|border)-(red|blue|green|yellow|purple|pink|gray|black|white)-/,
      /^(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)-/,
      /^(w|h|min-w|min-h|max-w|max-h)-/,
      /^(flex|grid|block|inline|hidden|visible)-/,
    ];

    for (const pattern of semanticPatterns) {
      if (pattern.test(class1) && pattern.test(class2)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process HTML results with enhanced frequency counting
   */
  private async processHtmlFrequency(
    htmlResult: any,
    frequencyMap: Map<string, AggregatedClassData>
  ): Promise<void> {
    try {
      for (const [className, classData] of htmlResult.classes) {
        const processedClassName = this.options.caseSensitive ? className : className.toLowerCase();
        
        if (frequencyMap.has(processedClassName)) {
          const existing = frequencyMap.get(processedClassName)!;
          existing.totalFrequency += classData.frequency;
          existing.htmlFrequency += classData.frequency;
          existing.sources.filePaths.push(htmlResult.metadata.source);
          existing.sources.sourceType = existing.sources.sourceType === 'jsx' ? 'mixed' : 'html';
          
          // Add HTML contexts
          existing.contexts.html.push(
            ...classData.contexts.map((el: any) => ({
              tagName: el.tagName,
              attributes: el.attributes,
              depth: el.depth,
              filePath: htmlResult.metadata.source,
            }))
          );
        } else {
          const newData: AggregatedClassData = {
            name: processedClassName,
            totalFrequency: classData.frequency,
            htmlFrequency: classData.frequency,
            jsxFrequency: 0,
            sources: {
              sourceType: 'html',
              filePaths: [htmlResult.metadata.source],
              frameworks: new Set(),
              extractionTypes: new Set(),
            },
            contexts: {
              html: classData.contexts.map((el: any) => ({
                tagName: el.tagName,
                attributes: el.attributes,
                depth: el.depth,
                filePath: htmlResult.metadata.source,
              })),
              jsx: [],
            },
            patterns: {
              prefixes: [],
              modifiers: [],
              variants: [],
            },
            coOccurrences: new Map(),
            validation: undefined,
          };
          
          frequencyMap.set(processedClassName, newData);
        }
      }
    } catch (error) {
      throw new ConsolidationError(
        `Failed to process HTML frequency data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Process JSX results with enhanced frequency counting
   */
  private async processJsxFrequency(
    jsxResult: any,
    frequencyMap: Map<string, AggregatedClassData>
  ): Promise<void> {
    try {
      for (const [className, classData] of jsxResult.classes) {
        const processedClassName = this.options.caseSensitive ? className : className.toLowerCase();
        
        if (frequencyMap.has(processedClassName)) {
          const existing = frequencyMap.get(processedClassName)!;
          existing.totalFrequency += classData.frequency;
          existing.jsxFrequency += classData.frequency;
          existing.sources.filePaths.push(jsxResult.metadata.source);
          existing.sources.sourceType = existing.sources.sourceType === 'html' ? 'mixed' : 'jsx';
          existing.sources.frameworks.add(jsxResult.framework || 'unknown');
          
          // Add JSX contexts
          existing.contexts.jsx.push(
            ...classData.contexts.map((el: any) => ({
              pattern: el.pattern,
              lineNumber: el.lineNumber,
              framework: el.framework,
              extractionType: el.extractionType,
              filePath: jsxResult.metadata.source,
            }))
          );
        } else {
          const newData: AggregatedClassData = {
            name: processedClassName,
            totalFrequency: classData.frequency,
            htmlFrequency: 0,
            jsxFrequency: classData.frequency,
            sources: {
              sourceType: 'jsx',
              filePaths: [jsxResult.metadata.source],
              frameworks: new Set([jsxResult.framework || 'unknown']),
              extractionTypes: new Set(),
            },
            contexts: {
              html: [],
              jsx: classData.contexts.map((el: any) => ({
                pattern: el.pattern,
                lineNumber: el.lineNumber,
                framework: el.framework,
                extractionType: el.extractionType,
                filePath: jsxResult.metadata.source,
              })),
            },
            patterns: {
              prefixes: [],
              modifiers: [],
              variants: [],
            },
            coOccurrences: new Map(),
            validation: undefined,
          };
          
          frequencyMap.set(processedClassName, newData);
        }
      }
    } catch (error) {
      throw new ConsolidationError(
        `Failed to process JSX frequency data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate input data
   */
  private validateInput(input: PatternAnalysisInput): void {
    if (!input || typeof input !== 'object') {
      throw new ConsolidationError('Input must be a valid PatternAnalysisInput object');
    }

    if (!Array.isArray(input.htmlResults)) {
      throw new ConsolidationError('HTML results must be an array');
    }

    if (!Array.isArray(input.jsxResults)) {
      throw new ConsolidationError('JSX results must be an array');
    }

    if (input.htmlResults.length === 0 && input.jsxResults.length === 0) {
      throw new ConsolidationError('At least one extraction result is required');
    }
  }

  /**
   * Extract and normalize patterns from frequency map with optimized data structure integration
   */
  private async extractAndNormalizePatterns(
    frequencyMap: PatternFrequencyMap
  ): Promise<Map<string, ExtractionResult>> {
    const patterns = new Map<string, ExtractionResult>();

    for (const [className, classData] of frequencyMap) {
      if (classData.totalFrequency >= this.options.minimumFrequency) {
        const normalized = this.normalizePattern(className);
        const sources = this.extractSources(classData);

        const extractionResult: ExtractionResult = {
          original: className,
          normalized,
          identifier: '', // Will be set in generateUniqueIdentifiers
          frequency: classData.totalFrequency,
          sources,
          validation: classData.validation,
        };

        patterns.set(normalized, extractionResult);
      }
    }

    return patterns;
  }

  /**
   * Normalize a pattern for consistent processing using cached normalization
   */
  private normalizePattern(pattern: string): string {
    if (!pattern || typeof pattern !== 'string') {
      return '';
    }

    // Use cached normalization for performance
    return this.dataStructureManager.normalizedCache.getNormalized(pattern, (p) => {
      let normalized = p.trim();

      // Handle empty or whitespace-only strings
      if (normalized.length === 0) {
        return '';
      }

      // Case normalization if not case-sensitive
      if (!this.options.caseSensitive) {
        normalized = normalized.toLowerCase();
      }

      // Unicode normalization (NFKC: Canonical decomposition, followed by canonical composition with compatibility mapping)
      normalized = normalized.normalize('NFKC');

      // Remove duplicate whitespace and normalize spacing
      normalized = normalized.replace(/\s+/g, ' ').trim();

      // Handle special characters that might cause issues in CSS
      // Remove or escape problematic characters but preserve valid CSS class characters
      normalized = normalized.replace(/[^\w\-_]/g, '');

      // Ensure the normalized pattern doesn't start with a number (invalid CSS class)
      if (/^\d/.test(normalized)) {
        normalized = 'cls-' + normalized;
      }

      // Handle empty result after normalization
      if (normalized.length === 0) {
        return '';
      }

      return normalized;
    });
  }

  /**
   * Extract source information from class data
   */
  private extractSources(classData: AggregatedClassData): string[] {
    return Array.from(new Set(classData.sources.filePaths));
  }

  /**
   * Generate unique identifiers with collision resistance and deterministic output
   */
  private async generateUniqueIdentifiers(patterns: Map<string, ExtractionResult>): Promise<void> {
    const usedIdentifiers = new Set<string>();
    
    // Sort patterns by frequency for consistent identifier assignment
    const sortedPatterns = Array.from(patterns.entries()).sort((a, b) => {
      if (this.options.sortBy === 'frequency') {
        return this.options.sortDirection === 'desc' 
          ? b[1].frequency - a[1].frequency
          : a[1].frequency - b[1].frequency;
      } else if (this.options.sortBy === 'alphabetical') {
        return this.options.sortDirection === 'desc'
          ? b[0].localeCompare(a[0])
          : a[0].localeCompare(b[0]);
      }
      return 0;
    });

    for (const [normalizedPattern, extractionResult] of sortedPatterns) {
      let identifier: string;
      let attempts = 0;
      const maxAttempts = 1000; // Prevent infinite loops

      do {
        identifier = this.generateNextIdentifier();
        attempts++;
        
        if (attempts > maxAttempts) {
          throw new ConsolidationError(
            `Failed to generate unique identifier after ${maxAttempts} attempts for pattern: ${normalizedPattern}`
          );
        }
      } while (usedIdentifiers.has(identifier));

      usedIdentifiers.add(identifier);
      extractionResult.identifier = identifier;
      this.identifierMap.set(extractionResult.original, identifier);
    }
  }

  /**
   * Generate next identifier using base-26 encoding with collision resistance
   */
  private generateNextIdentifier(): string {
    const { base, startLength, maxLength, prefix } = this.options.identifierOptions;
    const length = Math.min(startLength + Math.floor(this.identifierCounter / Math.pow(base, startLength)), maxLength);
    
    let identifier = prefix;
    let num = this.identifierCounter;
    
    // Generate base-26 identifier (a-z)
    for (let i = 0; i < length; i++) {
      identifier += String.fromCharCode(97 + (num % base)); // 'a' = 97
      num = Math.floor(num / base);
    }
    
    this.identifierCounter++;
    return identifier;
  }

  /**
   * Prepare file modifications with enhanced pattern matching
   */
  private async prepareFileModifications(
    input: PatternAnalysisInput,
    patterns: Map<string, ExtractionResult>
  ): Promise<FileModification[]> {
    const modifications: FileModification[] = [];
    const processedFiles = new Set<string>();

    // Process HTML files
    for (const htmlResult of input.htmlResults) {
      if (htmlResult.metadata?.source && !processedFiles.has(htmlResult.metadata.source)) {
        processedFiles.add(htmlResult.metadata.source);
        const modification = await this.prepareHtmlFileModification(
          htmlResult.metadata.source,
          patterns
        );
        if (modification) {
          modifications.push(modification);
        }
      }
    }

    // Process JSX files
    for (const jsxResult of input.jsxResults) {
      if (jsxResult.metadata?.source && !processedFiles.has(jsxResult.metadata.source)) {
        processedFiles.add(jsxResult.metadata.source);
        const modification = await this.prepareJsxFileModification(
          jsxResult.metadata.source,
          patterns
        );
        if (modification) {
          modifications.push(modification);
        }
      }
    }

    return modifications;
  }

  /**
   * Prepare HTML file modification
   */
  private async prepareHtmlFileModification(
    filePath: string,
    patterns: Map<string, ExtractionResult>
  ): Promise<FileModification | null> {
    try {
      const fs = await import('fs/promises');
      const originalContent = await fs.readFile(filePath, 'utf-8');
      let modifiedContent = originalContent;
      const replacements: FileModification['replacements'] = [];

      // Apply regex-based replacements for HTML class attributes
      for (const [normalizedPattern, extractionResult] of patterns) {
        if (extractionResult.identifier) {
          const classRegex = new RegExp(
            `class\\s*=\\s*["']([^"']*\\b${this.escapeRegex(extractionResult.original)}\\b[^"']*)["']`,
            'gi'
          );
          
          const matches = Array.from(modifiedContent.matchAll(classRegex));
          if (matches.length > 0) {
            for (const match of matches) {
              const newMatch = match[0].replace(
                new RegExp(`\\b${this.escapeRegex(extractionResult.original)}\\b`, 'g'),
                extractionResult.identifier
              );
              modifiedContent = modifiedContent.replace(match[0], newMatch);
            }
            
            replacements.push({
              original: extractionResult.original,
              replacement: extractionResult.identifier,
              count: matches.length,
            });
          }
        }
      }

      // Only return modification if changes were made
      if (modifiedContent !== originalContent) {
        return {
          filePath,
          originalContent,
          modifiedContent,
          replacements,
          metadata: {
            timestamp: new Date(),
            checksum: this.calculateChecksum(originalContent),
            backup: this.options.createBackups ? `${filePath}.backup.${Date.now()}` : undefined,
          },
        };
      }

      return null;
    } catch (error) {
      throw new ConsolidationError(
        `Failed to prepare HTML file modification for ${filePath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Prepare JSX file modification with enhanced pattern matching
   */
  private async prepareJsxFileModification(
    filePath: string,
    patterns: Map<string, ExtractionResult>
  ): Promise<FileModification | null> {
    try {
      const fs = await import('fs/promises');
      const originalContent = await fs.readFile(filePath, 'utf-8');
      let modifiedContent = originalContent;
      const replacements: FileModification['replacements'] = [];

      // Apply regex-based replacements for JSX className and class attributes
      for (const [normalizedPattern, extractionResult] of patterns) {
        if (extractionResult.identifier) {
          // Replace className="..." patterns
          const classNameRegex = new RegExp(
            `className\\s*=\\s*["']([^"']*\\b${this.escapeRegex(extractionResult.original)}\\b[^"']*)["']`,
            'gi'
          );
          
          const classNameMatches = Array.from(modifiedContent.matchAll(classNameRegex));
          if (classNameMatches.length > 0) {
            for (const match of classNameMatches) {
              const newMatch = match[0].replace(
                new RegExp(`\\b${this.escapeRegex(extractionResult.original)}\\b`, 'g'),
                extractionResult.identifier
              );
              modifiedContent = modifiedContent.replace(match[0], newMatch);
            }
            
            replacements.push({
              original: extractionResult.original,
              replacement: extractionResult.identifier,
              count: classNameMatches.length,
            });
          }

          // Replace template literal patterns
          const templateRegex = new RegExp(
            `\`([^\`]*\\b${this.escapeRegex(extractionResult.original)}\\b[^\`]*)\``,
            'gi'
          );
          
          const templateMatches = Array.from(modifiedContent.matchAll(templateRegex));
          if (templateMatches.length > 0) {
            for (const match of templateMatches) {
              const newMatch = match[0].replace(
                new RegExp(`\\b${this.escapeRegex(extractionResult.original)}\\b`, 'g'),
                extractionResult.identifier
              );
              modifiedContent = modifiedContent.replace(match[0], newMatch);
            }
            
            const existingReplacement = replacements.find(r => r.original === extractionResult.original);
            if (existingReplacement) {
              existingReplacement.count += templateMatches.length;
            } else {
              replacements.push({
                original: extractionResult.original,
                replacement: extractionResult.identifier,
                count: templateMatches.length,
              });
            }
          }

          // Replace utility function calls (e.g., clsx, cn, classNames)
          const utilityRegex = new RegExp(
            `(clsx|cn|classNames|twMerge)\\s*\\([^)]*["'\`]([^"'\`]*\\b${this.escapeRegex(extractionResult.original)}\\b[^"'\`]*)["'\`][^)]*\\)`,
            'gi'
          );
          
          const utilityMatches = Array.from(modifiedContent.matchAll(utilityRegex));
          if (utilityMatches.length > 0) {
            for (const match of utilityMatches) {
              const newMatch = match[0].replace(
                new RegExp(`\\b${this.escapeRegex(extractionResult.original)}\\b`, 'g'),
                extractionResult.identifier
              );
              modifiedContent = modifiedContent.replace(match[0], newMatch);
            }
            
            const existingReplacement = replacements.find(r => r.original === extractionResult.original);
            if (existingReplacement) {
              existingReplacement.count += utilityMatches.length;
            } else {
              replacements.push({
                original: extractionResult.original,
                replacement: extractionResult.identifier,
                count: utilityMatches.length,
              });
            }
          }
        }
      }

      // Only return modification if changes were made
      if (modifiedContent !== originalContent) {
        return {
          filePath,
          originalContent,
          modifiedContent,
          replacements,
          metadata: {
            timestamp: new Date(),
            checksum: this.calculateChecksum(originalContent),
            backup: this.options.createBackups ? `${filePath}.backup.${Date.now()}` : undefined,
          },
        };
      }

      return null;
    } catch (error) {
      throw new ConsolidationError(
        `Failed to prepare JSX file modification for ${filePath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Apply file modifications using atomic operations with rollback capability
   */
  private async applyFileModifications(modifications: FileModification[]): Promise<void> {
    if (!this.atomicFileWriter) {
      throw new ConsolidationError('Atomic file writer not available');
    }

    const appliedModifications: FileModification[] = [];
    const rollbackQueue: string[] = [];

    try {
      for (const modification of modifications) {
        // Create backup if enabled
        if (this.options.createBackups && modification.metadata.backup) {
          await this.createBackupFile(modification.filePath, modification.metadata.backup);
          rollbackQueue.push(modification.metadata.backup);
        }

        // Apply the modification atomically
        await this.atomicFileWriter.writeFile(modification.filePath, modification.modifiedContent);
        
        // Verify the modification was applied correctly
        const verification = await this.verifyFileModification(modification);
        if (!verification.success) {
          throw new ConsolidationError(
            `File modification verification failed for ${modification.filePath}: ${verification.error}`
          );
        }

        appliedModifications.push(modification);
      }
    } catch (error) {
      // Rollback applied modifications
      await this.rollbackModifications(appliedModifications);
      
      throw new ConsolidationError(
        `Atomic file modification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create backup file
   */
  private async createBackupFile(originalPath: string, backupPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.copyFile(originalPath, backupPath);
    } catch (error) {
      throw new ConsolidationError(
        `Failed to create backup for ${originalPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Verify file modification was applied correctly
   */
  private async verifyFileModification(modification: FileModification): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const fs = await import('fs/promises');
      const currentContent = await fs.readFile(modification.filePath, 'utf-8');
      const currentChecksum = this.calculateChecksum(currentContent);
      const expectedChecksum = this.calculateChecksum(modification.modifiedContent);

      if (currentChecksum !== expectedChecksum) {
        return {
          success: false,
          error: `Checksum mismatch: expected ${expectedChecksum}, got ${currentChecksum}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Rollback modifications in case of failure
   */
  private async rollbackModifications(modifications: FileModification[]): Promise<void> {
    for (const modification of modifications.reverse()) {
      try {
        if (modification.metadata.backup) {
          const fs = await import('fs/promises');
          await fs.copyFile(modification.metadata.backup, modification.filePath);
          // Clean up backup file
          await fs.unlink(modification.metadata.backup);
        } else {
          // Restore original content
          const fs = await import('fs/promises');
          await fs.writeFile(modification.filePath, modification.originalContent);
        }
      } catch (rollbackError) {
        // Log rollback error but don't throw to avoid masking original error
        console.error(`Failed to rollback modification for ${modification.filePath}:`, rollbackError);
      }
    }
  }

  /**
   * Calculate checksum for content integrity verification
   */
  private calculateChecksum(content: string): string {
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    } catch (error) {
      // Fallback to simple hash if crypto is not available
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash).toString(16);
    }
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate comprehensive statistics with data structure performance metrics
   */
  private generateStatistics(
    analysisResult: FrequencyAnalysisResult,
    patterns: Map<string, ExtractionResult>,
    fileModifications: FileModification[],
    processingTime: number,
    dataStructureStats?: ReturnType<DataStructureManager['getOverallStats']>
  ): ConsolidationResult['statistics'] {
    const totalReplacements = fileModifications.reduce(
      (sum, mod) => sum + mod.replacements.reduce((sum2, rep) => sum2 + rep.count, 0),
      0
    );

    return {
      totalPatternsFound: analysisResult.frequencyMap.size,
      totalPatternsConsolidated: patterns.size,
      totalFilesModified: fileModifications.length,
      totalReplacements,
      processingTime,
      memoryUsage: dataStructureStats?.totalMemoryEstimateBytes,
      dataStructureStats,
    };
  }
}

/**
 * Factory function to create CompleteConsolidator instance
 */
export function createCompleteConsolidator(
  options: Partial<CompleteConsolidatorOptions> = {},
  atomicFileWriter?: AtomicFileWriter
): CompleteConsolidator {
  return new CompleteConsolidator(options, atomicFileWriter);
}

/**
 * Quick consolidation function for simple use cases
 */
export async function quickConsolidate(
  input: PatternAnalysisInput,
  options: Partial<CompleteConsolidatorOptions> = {}
): Promise<ConsolidationResult> {
  const consolidator = createCompleteConsolidator(options);
  return consolidator.consolidate(input);
}