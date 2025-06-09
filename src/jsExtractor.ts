import * as fs from 'fs/promises';
import { z } from 'zod';

/**
 * Configuration options for JavaScript/JSX class extraction
 */
export const JsExtractionOptionsSchema = z.object({
  enableFrameworkDetection: z.boolean().default(true),
  includeDynamicClasses: z.boolean().default(true),
  caseSensitive: z.boolean().default(true),
  ignoreEmpty: z.boolean().default(true),
  maxFileSize: z.number().min(1).default(10 * 1024 * 1024), // 10MB
  timeout: z.number().min(1).default(10000), // 10 seconds
  supportedFrameworks: z.array(z.string()).default(['react', 'preact', 'solid', 'vue', 'angular']),
});

export type JsExtractionOptions = z.infer<typeof JsExtractionOptionsSchema>;

/**
 * Supported JavaScript/JSX frameworks
 */
export type SupportedFramework = 'react' | 'preact' | 'solid' | 'vue' | 'angular' | 'unknown';

/**
 * Data structure for individual class information (JavaScript-specific)
 */
export interface JsClassData {
  name: string;
  frequency: number;
  contexts: Array<{
    pattern: string;
    lineNumber: number;
    framework?: SupportedFramework;
    extractionType: 'static' | 'dynamic' | 'template' | 'utility';
  }>;
}

/**
 * Result of JavaScript class extraction operation
 */
export interface JsClassExtractionResult {
  classes: Map<string, JsClassData>;
  totalMatches: number;
  totalClasses: number;
  uniqueClasses: number;
  framework: SupportedFramework;
  metadata: {
    source: string;
    processedAt: Date;
    processingTime: number;
    fileSize?: number;
    errors: string[];
    extractionStats: {
      staticMatches: number;
      dynamicMatches: number;
      templateMatches: number;
      utilityMatches: number;
    };
  };
}

/**
 * Custom error classes for JavaScript parsing operations
 */
export class JsParsingError extends Error {
  constructor(message: string, public source?: string, public cause?: Error) {
    super(message);
    this.name = 'JsParsingError';
  }
}

export class JsFileReadError extends Error {
  constructor(message: string, public filePath?: string, public cause?: Error) {
    super(message);
    this.name = 'JsFileReadError';
  }
}

/**
 * Pre-compiled regex patterns for performance
 */
class RegexPatterns {
  // Static className/class patterns
  static readonly STATIC_CLASSNAME = /(?:className|class)\s*=\s*["'`]([^"'`]*?)["'`]/g;
  
  // Template literal patterns with simple content
  static readonly TEMPLATE_SIMPLE = /(?:className|class)\s*=\s*\{`([^`]*?)`\}/g;
  
  // Dynamic expression patterns (basic)
  static readonly DYNAMIC_EXPRESSION = /(?:className|class)\s*=\s*\{([^}]*?)\}/g;
  
  // Utility function patterns (clsx, classnames, cn)
  static readonly UTILITY_FUNCTIONS = /(?:clsx|classnames|cn)\s*\(([^)]*)\)/g;
  
  // JavaScript variable assignments with quoted strings (for extracting class strings from variables)
  static readonly JS_STRING_LITERALS = /(?:const|let|var)\s+\w+\s*=\s*["'`]([^"'`]*?)["'`]/g;
  
  // Object property values with quoted strings (for extracting classes from object literals)
  static readonly OBJECT_PROPERTY_STRINGS = /\w+\s*:\s*["'`]([^"'`]*?)["'`]/g;
  
  // Framework detection patterns
  static readonly REACT_IMPORT = /(?:import.*?from\s+['"]react['"]|import\s+React|from\s+['"]react['"])/;
  static readonly PREACT_IMPORT = /(?:import.*?from\s+['"]preact['"]|from\s+['"]preact['"])/;
  static readonly SOLID_IMPORT = /(?:import.*?from\s+['"]solid-js['"]|from\s+['"]solid-js['"])/;
  static readonly VUE_IMPORT = /(?:import.*?from\s+['"]vue['"]|from\s+['"]vue['"])/;
  static readonly ANGULAR_IMPORT = /(?:import.*?from\s+['"]@angular|from\s+['"]@angular)/;
  
  // JSX syntax detection
  static readonly JSX_SYNTAX = /<[A-Z][A-Za-z0-9]*|<[a-z][a-zA-Z0-9-]*(?:\s+[a-zA-Z][a-zA-Z0-9-]*(?:=(?:"[^"]*"|'[^']*'|{[^}]*}))?)*\s*\/?>/;
}

/**
 * Main JavaScript/JSX class extractor class
 */
export class JsExtractor {
  private options: JsExtractionOptions;

  constructor(options: Partial<JsExtractionOptions> = {}) {
    this.options = JsExtractionOptionsSchema.parse(options);
  }

  /**
   * Extract classes from JavaScript/JSX string
   */
  async extractFromString(
    code: string,
    source = 'string'
  ): Promise<JsClassExtractionResult> {
    const startTime = Date.now();
    const metadata = {
      source,
      processedAt: new Date(),
      processingTime: 0,
      errors: [] as string[],
      extractionStats: {
        staticMatches: 0,
        dynamicMatches: 0,
        templateMatches: 0,
        utilityMatches: 0,
      },
    };

    try {
      // Detect framework if enabled
      const framework = this.options.enableFrameworkDetection 
        ? this.detectFramework(code) 
        : 'unknown';

      const classes = new Map<string, JsClassData>();
      let totalMatches = 0;
      let totalClasses = 0;

      // Extract static className/class attributes
      const staticMatches = this.extractStaticClasses(code);
      this.processMatches(staticMatches, 'static', classes, framework);
      
      // Extract JavaScript string literals (variable assignments)
      const jsStringMatches = this.extractJsStringLiterals(code);
      this.processMatches(jsStringMatches, 'static', classes, framework);
      
      // Extract object property strings
      const objectPropertyMatches = this.extractObjectPropertyStrings(code);
      this.processMatches(objectPropertyMatches, 'static', classes, framework);
      
      const totalStaticMatches = staticMatches.length + jsStringMatches.length + objectPropertyMatches.length;
      totalMatches += totalStaticMatches;
      metadata.extractionStats.staticMatches = totalStaticMatches;

      // Extract template literal classes
      const templateMatches = this.extractTemplateClasses(code);
      this.processMatches(templateMatches, 'template', classes, framework);
      totalMatches += templateMatches.length;
      metadata.extractionStats.templateMatches = templateMatches.length;

      // Extract utility function classes
      const utilityMatches = this.extractUtilityClasses(code);
      this.processMatches(utilityMatches, 'utility', classes, framework);
      totalMatches += utilityMatches.length;
      metadata.extractionStats.utilityMatches = utilityMatches.length;

      // Extract dynamic classes if enabled
      if (this.options.includeDynamicClasses) {
        const dynamicMatches = this.extractDynamicClasses(code);
        this.processMatches(dynamicMatches, 'dynamic', classes, framework);
        totalMatches += dynamicMatches.length;
        metadata.extractionStats.dynamicMatches = dynamicMatches.length;
      }

      // Count total classes
      classes.forEach(classData => {
        totalClasses += classData.frequency;
      });

      metadata.processingTime = Date.now() - startTime;

      return {
        classes,
        totalMatches,
        totalClasses,
        uniqueClasses: classes.size,
        framework,
        metadata,
      };
    } catch (error) {
      metadata.errors.push(error instanceof Error ? error.message : String(error));
      metadata.processingTime = Date.now() - startTime;
      
      throw new JsParsingError(
        `Failed to parse JavaScript/JSX: ${error instanceof Error ? error.message : String(error)}`,
        source,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract classes from JavaScript/JSX file
   */
  async extractFromFile(filePath: string): Promise<JsClassExtractionResult> {
    try {
      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.options.maxFileSize) {
        throw new JsFileReadError(
          `File size (${stats.size} bytes) exceeds maximum allowed size (${this.options.maxFileSize} bytes)`,
          filePath
        );
      }

      // Read file with timeout
      const code = await this.readFileWithTimeout(filePath, this.options.timeout);
      const result = await this.extractFromString(code, filePath);
      
      // Add file metadata
      result.metadata.fileSize = stats.size;
      
      return result;
    } catch (error) {
      if (error instanceof JsParsingError || error instanceof JsFileReadError) {
        throw error;
      }
      
      throw new JsFileReadError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract classes from multiple JavaScript/JSX files
   */
  async extractFromFiles(filePaths: string[]): Promise<JsClassExtractionResult[]> {
    const results: JsClassExtractionResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.extractFromFile(filePath);
        results.push(result);
      } catch (error) {
        // Create error result for failed files
        results.push({
          classes: new Map(),
          totalMatches: 0,
          totalClasses: 0,
          uniqueClasses: 0,
          framework: 'unknown',
          metadata: {
            source: filePath,
            processedAt: new Date(),
            processingTime: 0,
            errors: [error instanceof Error ? error.message : String(error)],
            extractionStats: {
              staticMatches: 0,
              dynamicMatches: 0,
              templateMatches: 0,
              utilityMatches: 0,
            },
          },
        });
      }
    }
    
    return results;
  }

  /**
   * Detect the JavaScript framework used in the code
   */
  private detectFramework(code: string): SupportedFramework {
    // Check for framework-specific imports and patterns
    if (RegexPatterns.REACT_IMPORT.test(code)) return 'react';
    if (RegexPatterns.PREACT_IMPORT.test(code)) return 'preact';
    if (RegexPatterns.SOLID_IMPORT.test(code)) return 'solid';
    if (RegexPatterns.VUE_IMPORT.test(code)) return 'vue';
    if (RegexPatterns.ANGULAR_IMPORT.test(code)) return 'angular';
    
    // Check for JSX syntax as fallback
    if (RegexPatterns.JSX_SYNTAX.test(code)) return 'react'; // Default JSX to React
    
    return 'unknown';
  }

  /**
   * Extract static className/class attributes
   */
  private extractStaticClasses(code: string): Array<{ classes: string[]; lineNumber: number; pattern: string }> {
    const matches: Array<{ classes: string[]; lineNumber: number; pattern: string }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const regex = new RegExp(RegexPatterns.STATIC_CLASSNAME.source, 'g');
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        const classString = match[1];
        if (classString && (!this.options.ignoreEmpty || classString.trim())) {
          const classes = this.parseClassAttribute(classString);
          if (classes.length > 0) {
            matches.push({
              classes,
              lineNumber: index + 1,
              pattern: match[0],
            });
          }
        }
      }
    });
    
    return matches;
  }

  /**
   * Extract template literal classes
   */
  private extractTemplateClasses(code: string): Array<{ classes: string[]; lineNumber: number; pattern: string }> {
    const matches: Array<{ classes: string[]; lineNumber: number; pattern: string }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const regex = new RegExp(RegexPatterns.TEMPLATE_SIMPLE.source, 'g');
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        const templateContent = match[1];
        if (templateContent && (!this.options.ignoreEmpty || templateContent.trim())) {
          const classes = this.parseTemplateString(templateContent);
          if (classes.length > 0) {
            matches.push({
              classes,
              lineNumber: index + 1,
              pattern: match[0],
            });
          }
        }
      }
    });
    
    return matches;
  }

  /**
   * Extract JavaScript string literals from variable assignments
   */
  private extractJsStringLiterals(code: string): Array<{ classes: string[]; lineNumber: number; pattern: string }> {
    const matches: Array<{ classes: string[]; lineNumber: number; pattern: string }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const regex = new RegExp(RegexPatterns.JS_STRING_LITERALS.source, 'g');
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        const stringContent = match[1];
        if (stringContent && (!this.options.ignoreEmpty || stringContent.trim())) {
          const classes = this.parseClassAttribute(stringContent);
          if (classes.length > 0) {
            matches.push({
              classes,
              lineNumber: index + 1,
              pattern: match[0],
            });
          }
        }
      }
    });
    
    return matches;
  }

  /**
   * Extract object property strings (for class definitions in object literals)
   */
  private extractObjectPropertyStrings(code: string): Array<{ classes: string[]; lineNumber: number; pattern: string }> {
    const matches: Array<{ classes: string[]; lineNumber: number; pattern: string }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const regex = new RegExp(RegexPatterns.OBJECT_PROPERTY_STRINGS.source, 'g');
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        const stringContent = match[1];
        if (stringContent && (!this.options.ignoreEmpty || stringContent.trim())) {
          const classes = this.parseClassAttribute(stringContent);
          if (classes.length > 0) {
            matches.push({
              classes,
              lineNumber: index + 1,
              pattern: match[0],
            });
          }
        }
      }
    });
    
    return matches;
  }

  /**
   * Extract utility function classes (clsx, classnames, etc.)
   */
  private extractUtilityClasses(code: string): Array<{ classes: string[]; lineNumber: number; pattern: string }> {
    const matches: Array<{ classes: string[]; lineNumber: number; pattern: string }> = [];
    
    // Process the entire code to handle multi-line function calls
    const utilityRegex = new RegExp(RegexPatterns.UTILITY_FUNCTIONS.source, 'gs'); // Added 's' flag for multiline
    let match: RegExpExecArray | null;
    
    while ((match = utilityRegex.exec(code)) !== null) {
      const argsString = match[1];
      if (argsString && (!this.options.ignoreEmpty || argsString.trim())) {
        // Extract each quoted string as a separate match to count them individually
        const stringMatches = argsString.match(/["'`]([^"'`]*?)["'`]/g);
        if (stringMatches) {
          stringMatches.forEach(stringMatch => {
            const cleanMatch = stringMatch.slice(1, -1); // Remove quotes
            const classes = this.parseClassAttribute(cleanMatch);
            if (classes.length > 0) {
              // Find the line number for this match
              const beforeMatch = code.substring(0, match!.index);
              const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
              
              matches.push({
                classes,
                lineNumber,
                pattern: stringMatch, // Use the individual string match as pattern
              });
            }
          });
        }
      }
    }
    
    return matches;
  }

  /**
   * Extract dynamic expression classes (basic implementation)
   */
  private extractDynamicClasses(code: string): Array<{ classes: string[]; lineNumber: number; pattern: string }> {
    const matches: Array<{ classes: string[]; lineNumber: number; pattern: string }> = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      // Extract from className={...} patterns
      const classNameRegex = new RegExp(RegexPatterns.DYNAMIC_EXPRESSION.source, 'g');
      let match;
      
      while ((match = classNameRegex.exec(line)) !== null) {
        const expression = match[1];
        if (expression && (!this.options.ignoreEmpty || expression.trim())) {
          const classes = this.parseJsxExpression(expression);
          if (classes.length > 0) {
            matches.push({
              classes,
              lineNumber: index + 1,
              pattern: match[0],
            });
          }
        }
      }
      
      // Extract conditional expressions with && operators and quoted strings (anywhere in the line)
      const conditionalMatches = line.match(/\w+\s*&&\s*["'`]([^"'`]*?)["'`]/g);
      if (conditionalMatches) {
        conditionalMatches.forEach(conditionalMatch => {
          const quotedString = conditionalMatch.match(/["'`]([^"'`]*?)["'`]/);
          if (quotedString) {
            const classes = this.parseClassAttribute(quotedString[1]);
            if (classes.length > 0) {
              matches.push({
                classes,
                lineNumber: index + 1,
                pattern: conditionalMatch.trim(),
              });
            }
          }
        });
      }
    });
    
    return matches;
  }

  /**
   * Process matches and add to classes map
   */
  private processMatches(
    matches: Array<{ classes: string[]; lineNumber: number; pattern: string }>,
    extractionType: 'static' | 'dynamic' | 'template' | 'utility',
    classes: Map<string, JsClassData>,
    framework: SupportedFramework
  ): void {
    matches.forEach(match => {
      match.classes.forEach(className => {
        if (!this.options.caseSensitive) {
          className = className.toLowerCase();
        }

        if (!classes.has(className)) {
          classes.set(className, {
            name: className,
            frequency: 0,
            contexts: [],
          });
        }

        const classData = classes.get(className)!;
        classData.frequency++;
        
        // Add context (limit to avoid memory issues)
        if (classData.contexts.length < 10) {
          classData.contexts.push({
            pattern: match.pattern,
            lineNumber: match.lineNumber,
            framework,
            extractionType,
          });
        }
      });
    });
  }

  /**
   * Parse class attribute string (reuse HTML pattern)
   */
  private parseClassAttribute(classAttr: string): string[] {
    if (!classAttr) {
      // Return empty string if ignoreEmpty is false, otherwise empty array
      return this.options.ignoreEmpty ? [] : [''];
    }
    
    const parts = classAttr.split(/\s+/);
    
    // If ignoreEmpty is false, keep all parts including empty ones
    if (!this.options.ignoreEmpty) {
      return parts;
    }
    
    // If ignoreEmpty is true, filter out empty parts
    return parts.filter(cls => cls.trim().length > 0);
  }

  /**
   * Parse utility function arguments for class names
   */
  private parseUtilityFunctionArgs(argsString: string): string[] {
    const classes: string[] = [];
    
    // Extract all quoted strings from the arguments
    const stringMatches = argsString.match(/["'`]([^"'`]*?)["'`]/g);
    if (stringMatches) {
      stringMatches.forEach(match => {
        const cleanMatch = match.slice(1, -1); // Remove quotes
        const parsedClasses = this.parseClassAttribute(cleanMatch);
        classes.push(...parsedClasses);
      });
    }
    
    return classes;
  }

  /**
   * Parse template string for class names
   */
  private parseTemplateString(templateContent: string): string[] {
    // Simple implementation: extract static parts of template literals
    // For now, just treat as regular class string (can be enhanced for ${} expressions)
    const staticParts = templateContent.split('${')[0]; // Take only the static part
    return this.parseClassAttribute(staticParts);
  }

  /**
   * Parse JSX expression for potential class names
   */
  private parseJsxExpression(expression: string): string[] {
    const classes: string[] = [];
    
    // Extract quoted strings from expressions
    const stringMatches = expression.match(/["'`]([^"'`]*?)["'`]/g);
    if (stringMatches) {
      stringMatches.forEach(match => {
        const cleanMatch = match.slice(1, -1); // Remove quotes
        const parsedClasses = this.parseClassAttribute(cleanMatch);
        classes.push(...parsedClasses);
      });
    }
    
    return classes;
  }

  /**
   * Read file with timeout protection
   */
  private async readFileWithTimeout(filePath: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`File read timeout after ${timeout}ms`));
      }, timeout);

      fs.readFile(filePath, 'utf8')
        .then(content => {
          clearTimeout(timer);
          resolve(content);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

/**
 * Factory function to create JS extractor instance
 */
export function createJsExtractor(options: Partial<JsExtractionOptions> = {}): JsExtractor {
  return new JsExtractor(options);
}

/**
 * Convenience function to extract classes from JavaScript/JSX string
 */
export async function extractClassesFromJs(
  code: string,
  options: Partial<JsExtractionOptions> = {}
): Promise<JsClassExtractionResult> {
  const extractor = createJsExtractor(options);
  return extractor.extractFromString(code);
}

/**
 * Convenience function to extract classes from JavaScript/JSX file
 */
export async function extractClassesFromJsFile(
  filePath: string,
  options: Partial<JsExtractionOptions> = {}
): Promise<JsClassExtractionResult> {
  const extractor = createJsExtractor(options);
  return extractor.extractFromFile(filePath);
} 