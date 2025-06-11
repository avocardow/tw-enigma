import { z } from 'zod';
import type { HtmlClassExtractionResult, ClassData } from './htmlExtractor.js';
import type { JsClassExtractionResult, JsClassData, SupportedFramework } from './jsExtractor.js';
import type { ValidationResult, SimplePatternValidator, SimpleValidatorConfig } from './patternValidator.js';

/**
 * Configuration options for pattern analysis
 */
export const PatternAnalysisOptionsSchema = z.object({
  caseSensitive: z.boolean().default(true),
  minimumFrequency: z.number().min(1).default(1),
  enablePatternGrouping: z.boolean().default(true),
  enableCoOccurrenceAnalysis: z.boolean().default(true),
  maxCoOccurrenceDistance: z.number().min(1).default(5),
  includeFrameworkAnalysis: z.boolean().default(true),
  sortBy: z.enum(['frequency', 'alphabetical', 'source']).default('frequency'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  outputFormat: z.enum(['map', 'array', 'json']).default('map'),
  enableValidation: z.boolean().default(false),
  validationOptions: z.object({}).passthrough().optional(),
});

export type PatternAnalysisOptions = z.infer<typeof PatternAnalysisOptionsSchema>;

/**
 * Source attribution for class patterns
 */
export interface SourceAttribution {
  sourceType: 'html' | 'jsx' | 'mixed';
  filePaths: string[];
  frameworks: Set<SupportedFramework>;
  extractionTypes: Set<'static' | 'dynamic' | 'template' | 'utility'>;
}

/**
 * Aggregated class data combining HTML and JSX contexts
 */
export interface AggregatedClassData {
  name: string;
  totalFrequency: number;
  htmlFrequency: number;
  jsxFrequency: number;
  sources: SourceAttribution;
  contexts: {
    html: Array<{
      tagName: string;
      attributes: Record<string, string>;
      depth: number;
      filePath: string;
    }>;
    jsx: Array<{
      pattern: string;
      lineNumber: number;
      framework?: SupportedFramework;
      extractionType: 'static' | 'dynamic' | 'template' | 'utility';
      filePath: string;
    }>;
  };
  coOccurrences: Map<string, number>; // Classes that appear with this one
  validation?: ValidationResult; // Optional validation metadata
}

/**
 * Pattern frequency map interface
 */
export interface PatternFrequencyMap extends Map<string, AggregatedClassData> {}

/**
 * Pattern grouping result for related classes
 */
export interface PatternGroup {
  pattern: string;
  regex: RegExp;
  classes: string[];
  totalFrequency: number;
  examples: string[];
}

/**
 * Co-occurrence analysis result
 */
export interface CoOccurrencePattern {
  classes: string[];
  frequency: number;
  strength: number; // 0-1 indicating how often these classes appear together
  contexts: Array<{
    sourceType: 'html' | 'jsx';
    filePath: string;
    framework?: SupportedFramework;
  }>;
}

/**
 * Framework-specific analysis result
 */
export interface FrameworkAnalysis {
  framework: SupportedFramework;
  totalClasses: number;
  uniqueClasses: number;
  mostCommonClasses: Array<{ name: string; frequency: number }>;
  extractionTypeDistribution: {
    static: number;
    dynamic: number;
    template: number;
    utility: number;
  };
}

/**
 * Complete frequency analysis result
 */
export interface FrequencyAnalysisResult {
  frequencyMap: PatternFrequencyMap;
  totalClasses: number;
  uniqueClasses: number;
  totalFiles: number;
  patternGroups: PatternGroup[];
  coOccurrencePatterns: CoOccurrencePattern[];
  frameworkAnalysis: FrameworkAnalysis[];
  metadata: {
    processedAt: Date;
    processingTime: number;
    options: PatternAnalysisOptions;
    sources: {
      htmlFiles: number;
      jsxFiles: number;
      totalExtractionResults: number;
    };
    statistics: {
      averageFrequency: number;
      medianFrequency: number;
      mostFrequentClass: { name: string; frequency: number } | null;
      leastFrequentClass: { name: string; frequency: number } | null;
      classesAboveThreshold: number;
      classesBelowThreshold: number;
    };
    errors: string[];
  };
}

/**
 * Input data for pattern analysis
 */
export interface PatternAnalysisInput {
  htmlResults: HtmlClassExtractionResult[];
  jsxResults: JsClassExtractionResult[];
}

/**
 * Sort function type for custom sorting
 */
export type SortFunction = (a: [string, AggregatedClassData], b: [string, AggregatedClassData]) => number;

/**
 * Filter function type for custom filtering
 */
export type FilterFunction = (className: string, data: AggregatedClassData) => boolean;

/**
 * Export format types
 */
export interface JsonExportFormat {
  frequencyMap: Record<string, {
    name: string;
    totalFrequency: number;
    htmlFrequency: number;
    jsxFrequency: number;
    sources: {
      sourceType: string;
      filePaths: string[];
      frameworks: string[];
      extractionTypes: string[];
    };
  }>;
  metadata: FrequencyAnalysisResult['metadata'];
  summary: {
    totalClasses: number;
    uniqueClasses: number;
    totalFiles: number;
    topClasses: Array<{ name: string; frequency: number }>;
  };
}

/**
 * Error classes for pattern analysis operations
 */
export class PatternAnalysisError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'PatternAnalysisError';
  }
}

export class DataAggregationError extends PatternAnalysisError {
  constructor(message: string, public sourceType?: 'html' | 'jsx', cause?: Error) {
    super(message, cause);
    this.name = 'DataAggregationError';
  }
}

export class FrequencyCalculationError extends PatternAnalysisError {
  constructor(message: string, public className?: string, cause?: Error) {
    super(message, cause);
    this.name = 'FrequencyCalculationError';
  }
}

/**
 * Utility type guards
 */
export function isHtmlResult(result: HtmlClassExtractionResult | JsClassExtractionResult): result is HtmlClassExtractionResult {
  return 'totalElements' in result;
}

export function isJsxResult(result: HtmlClassExtractionResult | JsClassExtractionResult): result is JsClassExtractionResult {
  return 'totalMatches' in result;
}

/**
 * Common Tailwind CSS pattern regexes for grouping
 */
export const COMMON_TAILWIND_PATTERNS = {
  spacing: /^(m|p|space)([xy]?|[tlbr]|[tlbr][xy]?)-/,
  colors: /^(bg|text|border|ring|divide|placeholder|from|via|to)-/,
  layout: /^(flex|grid|block|inline|hidden|visible|container)/,
  sizing: /^(w|h|min-w|min-h|max-w|max-h)-/,
  typography: /^(font|text|leading|tracking|antialiased)/,
  borders: /^(border|rounded|divide)-/,
  effects: /^(shadow|opacity|backdrop|filter)-/,
  positioning: /^(static|fixed|absolute|relative|sticky|top|right|bottom|left|inset)-/,
  flexbox: /^(flex|justify|items|content|self|order|grow|shrink)-/,
  grid: /^(grid|col|row|gap|place)-/,
  transforms: /^(transform|rotate|scale|translate|skew|origin)-/,
  transitions: /^(transition|duration|ease|delay|animate)-/,
  interactivity: /^(cursor|select|resize|scroll|touch|pointer)-/,
  responsive: /^(sm|md|lg|xl|2xl):/,
  darkMode: /^dark:/,
  hover: /^hover:/,
  focus: /^focus:/,
  active: /^active:/,
  disabled: /^disabled:/,
} as const;

export type TailwindPatternType = keyof typeof COMMON_TAILWIND_PATTERNS;

/**
 * Data aggregation functions for combining HTML and JSX extraction results
 */

/**
 * Combine multiple HTML and JSX extraction results into aggregated class data
 */
export function aggregateExtractionResults(
  input: PatternAnalysisInput,
  options: Partial<PatternAnalysisOptions> = {}
): Map<string, AggregatedClassData> {
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc'
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  const aggregatedData = new Map<string, AggregatedClassData>();
  
  try {
    // Process HTML results
    for (const htmlResult of input.htmlResults) {
      processHtmlResult(htmlResult, aggregatedData, validatedOptions);
    }
    
    // Process JSX results
    for (const jsxResult of input.jsxResults) {
      processJsxResult(jsxResult, aggregatedData, validatedOptions);
    }
    
    // Apply minimum frequency filtering
    if (validatedOptions.minimumFrequency > 1) {
      for (const [className, data] of aggregatedData) {
        if (data.totalFrequency < validatedOptions.minimumFrequency) {
          aggregatedData.delete(className);
        }
      }
    }
    
    return aggregatedData;
    
  } catch (error) {
    throw new DataAggregationError(
      `Failed to aggregate extraction results: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Process HTML extraction result and update aggregated data
 */
function processHtmlResult(
  htmlResult: HtmlClassExtractionResult,
  aggregatedData: Map<string, AggregatedClassData>,
  options: PatternAnalysisOptions
): void {
  try {
    for (const [className, classData] of htmlResult.classes) {
      const processedClassName = options.caseSensitive ? className : className.toLowerCase();
      
      if (aggregatedData.has(processedClassName)) {
        // Update existing entry
        const existing = aggregatedData.get(processedClassName)!;
        existing.totalFrequency += classData.frequency;
        existing.htmlFrequency += classData.frequency;
        existing.sources.filePaths.push(htmlResult.metadata.source);
        existing.sources.sourceType = existing.sources.sourceType === 'jsx' ? 'mixed' : 'html';
        
        // Add HTML contexts
        existing.contexts.html.push(...classData.contexts.map((el: any) => ({
          tagName: el.tagName,
          attributes: el.attributes,
          depth: el.depth,
          filePath: htmlResult.metadata.source
        })));
        
      } else {
        // Create new entry
        const newData: AggregatedClassData = {
          name: processedClassName,
          totalFrequency: classData.frequency,
          htmlFrequency: classData.frequency,
          jsxFrequency: 0,
          sources: {
            sourceType: 'html',
            filePaths: [htmlResult.metadata.source],
            frameworks: new Set(),
            extractionTypes: new Set()
          },
          contexts: {
            html: classData.contexts.map((el: any) => ({
              tagName: el.tagName,
              attributes: el.attributes,
              depth: el.depth,
              filePath: htmlResult.metadata.source
            })),
            jsx: []
          },
          coOccurrences: new Map()
        };
        
        aggregatedData.set(processedClassName, newData);
      }
    }
  } catch (error) {
    throw new DataAggregationError(
      `Failed to process HTML result from ${htmlResult.metadata?.source || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'html',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Process JSX extraction result and update aggregated data
 */
function processJsxResult(
  jsxResult: JsClassExtractionResult,
  aggregatedData: Map<string, AggregatedClassData>,
  options: PatternAnalysisOptions
): void {
  try {
    for (const [className, classData] of jsxResult.classes) {
      const processedClassName = options.caseSensitive ? className : className.toLowerCase();
      
      if (aggregatedData.has(processedClassName)) {
        // Update existing entry
        const existing = aggregatedData.get(processedClassName)!;
        existing.totalFrequency += classData.frequency;
        existing.jsxFrequency += classData.frequency;
        existing.sources.filePaths.push(jsxResult.metadata.source);
        existing.sources.sourceType = existing.sources.sourceType === 'html' ? 'mixed' : 'jsx';
        
        // Add frameworks and extraction types
        classData.contexts.forEach((pattern: any) => {
          if (pattern.framework) {
            existing.sources.frameworks.add(pattern.framework);
          }
          existing.sources.extractionTypes.add(pattern.extractionType);
        });
        
        // Add JSX contexts
        existing.contexts.jsx.push(...classData.contexts.map((pattern: any) => ({
          pattern: pattern.pattern,
          lineNumber: pattern.lineNumber,
          framework: pattern.framework,
          extractionType: pattern.extractionType,
          filePath: jsxResult.metadata.source
        })));
        
      } else {
        // Create new entry
        const frameworks = new Set<SupportedFramework>();
        const extractionTypes = new Set<'static' | 'dynamic' | 'template' | 'utility'>();
        
        classData.contexts.forEach((pattern: any) => {
          if (pattern.framework) {
            frameworks.add(pattern.framework);
          }
          extractionTypes.add(pattern.extractionType);
        });
        
        const newData: AggregatedClassData = {
          name: processedClassName,
          totalFrequency: classData.frequency,
          htmlFrequency: 0,
          jsxFrequency: classData.frequency,
          sources: {
            sourceType: 'jsx',
            filePaths: [jsxResult.metadata.source],
            frameworks,
            extractionTypes
          },
          contexts: {
            html: [],
            jsx: classData.contexts.map((pattern: any) => ({
              pattern: pattern.pattern,
              lineNumber: pattern.lineNumber,
              framework: pattern.framework,
              extractionType: pattern.extractionType,
              filePath: jsxResult.metadata.source
            }))
          },
          coOccurrences: new Map()
        };
        
        aggregatedData.set(processedClassName, newData);
      }
    }
  } catch (error) {
    throw new DataAggregationError(
      `Failed to process JSX result from ${jsxResult.metadata?.source || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'jsx',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deduplicate file paths and clean up aggregated data
 */
export function cleanupAggregatedData(data: Map<string, AggregatedClassData>): void {
  for (const [, classData] of data) {
    // Deduplicate file paths
    classData.sources.filePaths = [...new Set(classData.sources.filePaths)];
    
    // Sort contexts by file path for consistency
    classData.contexts.html.sort((a, b) => a.filePath.localeCompare(b.filePath));
    classData.contexts.jsx.sort((a, b) => a.filePath.localeCompare(b.filePath));
  }
}

/**
 * Frequency map generation and pattern analysis functions
 */

/**
 * Generate a comprehensive frequency map from extraction results
 */
export function generateFrequencyMap(
  input: PatternAnalysisInput,
  options: Partial<PatternAnalysisOptions> = {}
): PatternFrequencyMap {
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc'
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  
  try {
    // Aggregate data from all sources
    const aggregatedData = aggregateExtractionResults(input, validatedOptions);
    
    // Clean up and deduplicate
    cleanupAggregatedData(aggregatedData);
    
    // Generate co-occurrence patterns if enabled
    if (validatedOptions.enableCoOccurrenceAnalysis) {
      generateCoOccurrencePatterns(aggregatedData, validatedOptions);
    }
    
    return aggregatedData;
    
  } catch (error) {
    throw new FrequencyCalculationError(
      `Failed to generate frequency map: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Generate pattern groups based on common Tailwind CSS patterns
 */
export function generatePatternGroups(
  frequencyMap: PatternFrequencyMap,
  options: Partial<PatternAnalysisOptions> = {}
): PatternGroup[] {
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc'
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  
  if (!validatedOptions.enablePatternGrouping) {
    return [];
  }
  
  const patternGroups: PatternGroup[] = [];
  
  try {
    // Group classes by Tailwind patterns
    for (const [patternName, regex] of Object.entries(COMMON_TAILWIND_PATTERNS)) {
      const matchingClasses: string[] = [];
      let totalFrequency = 0;
      
      for (const [className, classData] of frequencyMap) {
        if (regex.test(className)) {
          matchingClasses.push(className);
          totalFrequency += classData.totalFrequency;
        }
      }
      
      if (matchingClasses.length > 0) {
        patternGroups.push({
          pattern: patternName,
          regex,
          classes: matchingClasses.sort((a, b) => {
            const aFreq = frequencyMap.get(a)?.totalFrequency || 0;
            const bFreq = frequencyMap.get(b)?.totalFrequency || 0;
            return bFreq - aFreq; // Sort by frequency descending
          }),
          totalFrequency,
          examples: matchingClasses.slice(0, 5) // Top 5 examples
        });
      }
    }
    
    // Sort pattern groups by total frequency
    return patternGroups.sort((a, b) => b.totalFrequency - a.totalFrequency);
    
  } catch (error) {
    throw new PatternAnalysisError(
      `Failed to generate pattern groups: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Generate co-occurrence patterns for classes that appear together
 */
function generateCoOccurrencePatterns(
  frequencyMap: PatternFrequencyMap,
  options: PatternAnalysisOptions
): void {
  try {
    // Analyze HTML contexts for co-occurrences
    for (const [className, classData] of frequencyMap) {
      const coOccurrences = new Map<string, number>();
      
      // Check HTML contexts
      for (const htmlContext of classData.contexts.html) {
        // Find other classes in the same element
        const elementClasses = extractClassesFromAttributes(htmlContext.attributes);
        
        for (const otherClass of elementClasses) {
          if (otherClass !== className && frequencyMap.has(otherClass)) {
            coOccurrences.set(otherClass, (coOccurrences.get(otherClass) || 0) + 1);
          }
        }
      }
      
      // Check JSX contexts
      for (const jsxContext of classData.contexts.jsx) {
        // Extract classes from JSX pattern
        const patternClasses = extractClassesFromJsxPattern(jsxContext.pattern);
        
        for (const otherClass of patternClasses) {
          if (otherClass !== className && frequencyMap.has(otherClass)) {
            coOccurrences.set(otherClass, (coOccurrences.get(otherClass) || 0) + 1);
          }
        }
      }
      
      // Update the class data with co-occurrence information
      classData.coOccurrences = coOccurrences;
    }
    
  } catch (error) {
    throw new PatternAnalysisError(
      `Failed to generate co-occurrence patterns: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Extract class names from HTML attributes
 */
function extractClassesFromAttributes(attributes: Record<string, string>): string[] {
  const classAttr = attributes.class || attributes.className || '';
  return classAttr.split(/\s+/).filter(Boolean);
}

/**
 * Extract class names from JSX pattern
 */
function extractClassesFromJsxPattern(pattern: string): string[] {
  // Simple extraction - look for quoted strings that might contain classes
  const matches = pattern.match(/["'`]([^"'`]*?)["'`]/g);
  if (!matches) return [];
  
  const classes: string[] = [];
  for (const match of matches) {
    const content = match.slice(1, -1); // Remove quotes
    // Split by spaces and filter for potential class names
    const potentialClasses = content.split(/\s+/).filter(cls => 
      cls.length > 0 && 
      /^[a-zA-Z0-9_-]+$/.test(cls) && 
      !cls.includes('(') && 
      !cls.includes(')')
    );
    classes.push(...potentialClasses);
  }
  
  return classes;
}

/**
 * Calculate comprehensive frequency statistics
 */
export function calculateFrequencyStatistics(
  frequencyMap: PatternFrequencyMap,
  options: Partial<PatternAnalysisOptions> = {}
): FrequencyAnalysisResult['metadata']['statistics'] {
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc'
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  
  try {
    const frequencies = Array.from(frequencyMap.values()).map(data => data.totalFrequency);
    
    if (frequencies.length === 0) {
      return {
        averageFrequency: 0,
        medianFrequency: 0,
        mostFrequentClass: null,
        leastFrequentClass: null,
        classesAboveThreshold: 0,
        classesBelowThreshold: 0
      };
    }
    
    frequencies.sort((a, b) => a - b);
    
    const total = frequencies.reduce((sum, freq) => sum + freq, 0);
    const average = total / frequencies.length;
    const median = frequencies.length % 2 === 0
      ? (frequencies[frequencies.length / 2 - 1] + frequencies[frequencies.length / 2]) / 2
      : frequencies[Math.floor(frequencies.length / 2)];
    
    // Find most and least frequent classes
    let mostFrequentClass: { name: string; frequency: number } | null = null;
    let leastFrequentClass: { name: string; frequency: number } | null = null;
    
    for (const [className, data] of frequencyMap) {
      if (!mostFrequentClass || data.totalFrequency > mostFrequentClass.frequency) {
        mostFrequentClass = { name: className, frequency: data.totalFrequency };
      }
      if (!leastFrequentClass || data.totalFrequency < leastFrequentClass.frequency) {
        leastFrequentClass = { name: className, frequency: data.totalFrequency };
      }
    }
    
    // Count classes above/below threshold
    const threshold = validatedOptions.minimumFrequency;
    let classesAboveThreshold = 0;
    let classesBelowThreshold = 0;
    
    for (const [, data] of frequencyMap) {
      if (data.totalFrequency >= threshold) {
        classesAboveThreshold++;
      } else {
        classesBelowThreshold++;
      }
    }
    
    return {
      averageFrequency: Math.round(average * 100) / 100,
      medianFrequency: Math.round(median * 100) / 100,
      mostFrequentClass,
      leastFrequentClass,
      classesAboveThreshold,
      classesBelowThreshold
    };
    
  } catch (error) {
    throw new FrequencyCalculationError(
      `Failed to calculate frequency statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Advanced pattern analysis functions
 */

/**
 * Generate detailed co-occurrence patterns from aggregated data
 */
export function generateCoOccurrenceAnalysis(
  frequencyMap: PatternFrequencyMap,
  options: Partial<PatternAnalysisOptions> = {}
): CoOccurrencePattern[] {
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc'
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  
  if (!validatedOptions.enableCoOccurrenceAnalysis) {
    return [];
  }
  
  const coOccurrencePatterns: CoOccurrencePattern[] = [];
  const processedPairs = new Set<string>();
  
  try {
    for (const [className, classData] of frequencyMap) {
      for (const [coClass, frequency] of classData.coOccurrences) {
        const pairKey = [className, coClass].sort().join('|');
        
        if (!processedPairs.has(pairKey) && frequency >= validatedOptions.minimumFrequency) {
          processedPairs.add(pairKey);
          
          const coClassData = frequencyMap.get(coClass);
          if (!coClassData) continue;
          
          // Calculate strength based on how often they appear together vs separately
          const totalAppearances = classData.totalFrequency + coClassData.totalFrequency;
          const strength = (frequency * 2) / totalAppearances;
          
          // Collect contexts where these classes appear together
          const contexts: CoOccurrencePattern['contexts'] = [];
          
          // Add HTML contexts
          for (const htmlContext of classData.contexts.html) {
            const elementClasses = extractClassesFromAttributes(htmlContext.attributes);
            if (elementClasses.includes(coClass)) {
              contexts.push({
                sourceType: 'html',
                filePath: htmlContext.filePath
              });
            }
          }
          
          // Add JSX contexts
          for (const jsxContext of classData.contexts.jsx) {
            const patternClasses = extractClassesFromJsxPattern(jsxContext.pattern);
            if (patternClasses.includes(coClass)) {
              contexts.push({
                sourceType: 'jsx',
                filePath: jsxContext.filePath,
                framework: jsxContext.framework
              });
            }
          }
          
          coOccurrencePatterns.push({
            classes: [className, coClass],
            frequency,
            strength: Math.round(strength * 1000) / 1000,
            contexts: contexts.slice(0, 10) // Limit to 10 examples
          });
        }
      }
    }
    
    // Sort by strength descending
    return coOccurrencePatterns.sort((a, b) => b.strength - a.strength);
    
  } catch (error) {
    throw new PatternAnalysisError(
      `Failed to generate co-occurrence analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Generate framework-specific analysis
 */
export function generateFrameworkAnalysis(
  frequencyMap: PatternFrequencyMap,
  options: Partial<PatternAnalysisOptions> = {}
): FrameworkAnalysis[] {
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc'
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  
  if (!validatedOptions.includeFrameworkAnalysis) {
    return [];
  }
  
  const frameworkStats = new Map<SupportedFramework, {
    totalClasses: number;
    uniqueClasses: Set<string>;
    classFrequencies: Map<string, number>;
    extractionTypes: { static: number; dynamic: number; template: number; utility: number };
  }>();
  
  try {
    // Collect framework statistics
    for (const [className, classData] of frequencyMap) {
      for (const framework of classData.sources.frameworks) {
        if (!frameworkStats.has(framework)) {
          frameworkStats.set(framework, {
            totalClasses: 0,
            uniqueClasses: new Set(),
            classFrequencies: new Map(),
            extractionTypes: { static: 0, dynamic: 0, template: 0, utility: 0 }
          });
        }
        
        const stats = frameworkStats.get(framework)!;
        stats.totalClasses += classData.jsxFrequency;
        stats.uniqueClasses.add(className);
        stats.classFrequencies.set(className, (stats.classFrequencies.get(className) || 0) + classData.jsxFrequency);
        
        // Count extraction types
        for (const extractionType of classData.sources.extractionTypes) {
          stats.extractionTypes[extractionType]++;
        }
      }
    }
    
    // Convert to analysis results
    const analyses: FrameworkAnalysis[] = [];
    
    for (const [framework, stats] of frameworkStats) {
      const sortedClasses = Array.from(stats.classFrequencies.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10
      
      analyses.push({
        framework,
        totalClasses: stats.totalClasses,
        uniqueClasses: stats.uniqueClasses.size,
        mostCommonClasses: sortedClasses.map(([name, frequency]) => ({ name, frequency })),
        extractionTypeDistribution: stats.extractionTypes
      });
    }
    
    // Sort by total classes descending
    return analyses.sort((a, b) => b.totalClasses - a.totalClasses);
    
  } catch (error) {
    throw new PatternAnalysisError(
      `Failed to generate framework analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Sorting and filtering functions
 */

/**
 * Sort frequency map entries by various criteria
 */
export function sortFrequencyMap(
  frequencyMap: PatternFrequencyMap,
  options: Partial<PatternAnalysisOptions> = {}
): Array<[string, AggregatedClassData]> {
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc'
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  const entries = Array.from(frequencyMap.entries());
  
  const sortFunctions: Record<PatternAnalysisOptions['sortBy'], SortFunction> = {
    frequency: (a, b) => validatedOptions.sortDirection === 'asc' 
      ? a[1].totalFrequency - b[1].totalFrequency
      : b[1].totalFrequency - a[1].totalFrequency,
    
    alphabetical: (a, b) => validatedOptions.sortDirection === 'asc'
      ? a[0].localeCompare(b[0])
      : b[0].localeCompare(a[0]),
    
    source: (a, b) => {
      const aScore = (a[1].htmlFrequency > 0 ? 1 : 0) + (a[1].jsxFrequency > 0 ? 2 : 0);
      const bScore = (b[1].htmlFrequency > 0 ? 1 : 0) + (b[1].jsxFrequency > 0 ? 2 : 0);
      return validatedOptions.sortDirection === 'asc' ? aScore - bScore : bScore - aScore;
    }
  };
  
  return entries.sort(sortFunctions[validatedOptions.sortBy]);
}

/**
 * Apply custom filtering to frequency map
 */
export function filterFrequencyMap(
  frequencyMap: PatternFrequencyMap,
  filterFn: FilterFunction
): PatternFrequencyMap {
  const filtered = new Map<string, AggregatedClassData>();
  
  for (const [className, data] of frequencyMap) {
    if (filterFn(className, data)) {
      filtered.set(className, data);
    }
  }
  
  return filtered;
}

/**
 * Create common filter functions
 */
export const CommonFilters = {
  minFrequency: (threshold: number): FilterFunction => 
    (_, data) => data.totalFrequency >= threshold,
  
  maxFrequency: (threshold: number): FilterFunction => 
    (_, data) => data.totalFrequency <= threshold,
  
  sourceType: (sourceType: 'html' | 'jsx' | 'mixed'): FilterFunction => 
    (_, data) => data.sources.sourceType === sourceType,
  
  framework: (framework: SupportedFramework): FilterFunction => 
    (_, data) => data.sources.frameworks.has(framework),
  
  pattern: (regex: RegExp): FilterFunction => 
    (className) => regex.test(className),
  
  tailwindPattern: (patternType: TailwindPatternType): FilterFunction => 
    (className) => COMMON_TAILWIND_PATTERNS[patternType].test(className)
};

/**
 * Export and utility functions
 */

/**
 * Convert frequency map to JSON export format
 */
export function exportToJson(
  analysisResult: FrequencyAnalysisResult,
  options: Partial<PatternAnalysisOptions> = {}
): JsonExportFormat {
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc'
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  
  const frequencyMapJson: JsonExportFormat['frequencyMap'] = {};
  
  for (const [className, data] of analysisResult.frequencyMap) {
    frequencyMapJson[className] = {
      name: data.name,
      totalFrequency: data.totalFrequency,
      htmlFrequency: data.htmlFrequency,
      jsxFrequency: data.jsxFrequency,
      sources: {
        sourceType: data.sources.sourceType,
        filePaths: data.sources.filePaths,
        frameworks: Array.from(data.sources.frameworks),
        extractionTypes: Array.from(data.sources.extractionTypes)
      }
    };
  }
  
  const sortedEntries = sortFrequencyMap(analysisResult.frequencyMap, validatedOptions);
  const topClasses = sortedEntries.slice(0, 20).map(([name, data]) => ({
    name,
    frequency: data.totalFrequency
  }));
  
  return {
    frequencyMap: frequencyMapJson,
    metadata: analysisResult.metadata,
    summary: {
      totalClasses: analysisResult.totalClasses,
      uniqueClasses: analysisResult.uniqueClasses,
      totalFiles: analysisResult.totalFiles,
      topClasses
    }
  };
}

/**
 * Main pattern analysis function that combines all functionality
 */
export async function analyzePatterns(
  input: PatternAnalysisInput,
  options: Partial<PatternAnalysisOptions> = {}
): Promise<FrequencyAnalysisResult> {
  const startTime = Date.now();
  const defaultOptions: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency: 1,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc',
    enableValidation: false,
    validationOptions: undefined
  };
  const validatedOptions = PatternAnalysisOptionsSchema.parse({ ...defaultOptions, ...options });
  const errors: string[] = [];
  
  try {
    // Generate frequency map
    const frequencyMap = generateFrequencyMap(input, validatedOptions);
    
    // Add validation if enabled
    if (validatedOptions.enableValidation) {
      await addValidationToFrequencyMap(frequencyMap, validatedOptions.validationOptions);
    }
    
    // Generate pattern groups
    const patternGroups = generatePatternGroups(frequencyMap, validatedOptions);
    
    // Generate co-occurrence patterns
    const coOccurrencePatterns = generateCoOccurrenceAnalysis(frequencyMap, validatedOptions);
    
    // Generate framework analysis
    const frameworkAnalysis = generateFrameworkAnalysis(frequencyMap, validatedOptions);
    
    // Calculate statistics
    const statistics = calculateFrequencyStatistics(frequencyMap, validatedOptions);
    
    // Gather metadata
    const htmlFiles = new Set(input.htmlResults.map(r => r.metadata?.source || 'unknown')).size;
    const jsxFiles = new Set(input.jsxResults.map(r => r.metadata?.source || 'unknown')).size;
    
    const result: FrequencyAnalysisResult = {
      frequencyMap,
      totalClasses: frequencyMap.size,
      uniqueClasses: frequencyMap.size,
      totalFiles: htmlFiles + jsxFiles,
      patternGroups,
      coOccurrencePatterns,
      frameworkAnalysis,
      metadata: {
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
        options: validatedOptions,
        sources: {
          htmlFiles,
          jsxFiles,
          totalExtractionResults: input.htmlResults.length + input.jsxResults.length
        },
        statistics,
        errors
      }
    };
    
    return result;
    
  } catch (error) {
    throw new PatternAnalysisError(
      `Pattern analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Add validation metadata to frequency map
 */
async function addValidationToFrequencyMap(
  frequencyMap: PatternFrequencyMap,
  validationOptions?: Record<string, any>
): Promise<void> {
  try {
    // Import SimplePatternValidator dynamically to avoid circular dependencies
    const { SimplePatternValidator } = await import('./patternValidator.js');
    
    // Create validator instance
    const validator = new SimplePatternValidator(validationOptions);
    
    // Validate each class in the frequency map
    for (const [className, data] of frequencyMap) {
      try {
        const validationResult = validator.validateClass(className);
        data.validation = validationResult;
      } catch (error) {
        // If validation fails for a specific class, log but continue
        console.warn(`Failed to validate class "${className}":`, error);
      }
    }
  } catch (error) {
    console.warn('Failed to initialize simple pattern validator:', error);
  }
}

/**
 * Convenience function for quick frequency analysis
 */
export function quickFrequencyAnalysis(
  input: PatternAnalysisInput,
  minimumFrequency: number = 1
): Map<string, number> {
  const options: PatternAnalysisOptions = {
    caseSensitive: false,
    outputFormat: 'map',
    minimumFrequency,
    enablePatternGrouping: false,
    enableCoOccurrenceAnalysis: false,
    maxCoOccurrenceDistance: 5,
    includeFrameworkAnalysis: false,
    sortBy: 'frequency',
    sortDirection: 'desc',
    enableValidation: false,
    validationOptions: undefined
  };
  
  const frequencyMap = generateFrequencyMap(input, options);
  const result = new Map<string, number>();
  
  for (const [className, data] of frequencyMap) {
    result.set(className, data.totalFrequency);
  }
  
  return result;
} 