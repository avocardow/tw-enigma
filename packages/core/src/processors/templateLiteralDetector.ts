/**
 * Template Literal Detection System
 * 
 * Provides comprehensive detection of template literals in JavaScript/TypeScript source code,
 * including standard template literals, tagged templates, and nested patterns.
 */

import type { SourceLocation } from './types';

export interface TemplateLiteralMatch {
  /** Raw template literal content including backticks */
  raw: string;
  /** Processed content without backticks */
  content: string;
  /** Start position in source */
  start: number;
  /** End position in source */
  end: number;
  /** Source location information */
  location: SourceLocation;
  /** Whether this is a tagged template */
  isTagged: boolean;
  /** Tag name if tagged template */
  tagName?: string;
  /** Static parts of the template */
  staticParts: string[];
  /** Expression placeholders */
  expressions: Array<{
    content: string;
    start: number;
    end: number;
  }>;
  /** Confidence score for match accuracy */
  confidence: number;
}

export interface TemplateDetectionOptions {
  /** Include tagged template literals */
  includeTagged?: boolean;
  /** Include multiline templates */
  includeMultiline?: boolean;
  /** Maximum template length to analyze */
  maxLength?: number;
  /** Include nested templates */
  includeNested?: boolean;
  /** Custom tag names to specifically look for */
  targetTags?: string[];
}

export interface TemplateDetectionResult {
  /** Found template literals */
  templates: TemplateLiteralMatch[];
  /** Total count */
  count: number;
  /** Detection errors */
  errors: Array<{
    message: string;
    location?: SourceLocation;
    severity: 'warning' | 'error';
  }>;
  /** Performance metrics */
  performance: {
    detectionTime: number;
    bytesProcessed: number;
    patternsChecked: number;
  };
}

/**
 * Template Literal Detector
 */
export class TemplateLiteralDetector {
  private options: Required<TemplateDetectionOptions>;

  constructor(options: TemplateDetectionOptions = {}) {
    this.options = {
      includeTagged: true,
      includeMultiline: true,
      maxLength: 10000,
      includeNested: true,
      targetTags: [],
      ...options,
    };
  }

  /**
   * Detect template literals in source code
   */
  detect(source: string, filename?: string): TemplateDetectionResult {
    const startTime = performance.now();
    const templates: TemplateLiteralMatch[] = [];
    const errors: TemplateDetectionResult['errors'] = [];
    let patternsChecked = 0;

    try {
      // Primary regex-based detection for performance
      const regexResults = this.detectWithRegex(source);
      templates.push(...regexResults.templates);
      errors.push(...regexResults.errors);
      patternsChecked += regexResults.patternsChecked;

      // Validate and enhance matches
      const validatedTemplates = this.validateMatches(templates, source);
      
      // Filter by options
      const filteredTemplates = this.filterTemplates(validatedTemplates);

      return {
        templates: filteredTemplates,
        count: filteredTemplates.length,
        errors,
        performance: {
          detectionTime: performance.now() - startTime,
          bytesProcessed: source.length,
          patternsChecked,
        },
      };
    } catch (error) {
      errors.push({
        message: `Template detection failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });

      return {
        templates: [],
        count: 0,
        errors,
        performance: {
          detectionTime: performance.now() - startTime,
          bytesProcessed: source.length,
          patternsChecked,
        },
      };
    }
  }

  /**
   * Detect templates using optimized regex patterns
   */
  private detectWithRegex(source: string): {
    templates: TemplateLiteralMatch[];
    errors: TemplateDetectionResult['errors'];
    patternsChecked: number;
  } {
    const templates: TemplateLiteralMatch[] = [];
    const errors: TemplateDetectionResult['errors'] = [];
    let patternsChecked = 0;

    // Pattern for template literals with optional tag
    const templatePattern = /(?:([\w$]+)\s*)?`([^`\\]|\\.|\$\{[^}]*\})*`/gs;
    
    let match: RegExpExecArray | null;
    
    while ((match = templatePattern.exec(source)) !== null) {
      patternsChecked++;
      
      try {
        const fullMatch = match[0];
        const tagName = match[1];
        const isTagged = Boolean(tagName);
        
        // Skip if tagged templates not included
        if (isTagged && !this.options.includeTagged) {
          continue;
        }
        
        // Skip if specific tags requested and this doesn't match
        if (this.options.targetTags.length > 0 && isTagged) {
          if (!this.options.targetTags.includes(tagName)) {
            continue;
          }
        }
        
        // Extract template content
        const templateStart = fullMatch.indexOf('`');
        const templateContent = fullMatch.slice(templateStart + 1, -1);
        
        // Skip if too long
        if (templateContent.length > this.options.maxLength) {
          errors.push({
            message: `Template literal exceeds maximum length (${templateContent.length} > ${this.options.maxLength})`,
            location: this.getSourceLocation(source, match.index),
            severity: 'warning',
          });
          continue;
        }
        
        // Skip multiline if not included
        if (!this.options.includeMultiline && templateContent.includes('\n')) {
          continue;
        }
        
        // Parse template parts
        const { staticParts, expressions } = this.parseTemplate(templateContent, match.index + templateStart + 1);
        
        // Calculate confidence based on completeness
        const confidence = this.calculateConfidence(fullMatch, templateContent, expressions);
        
        templates.push({
          raw: fullMatch,
          content: templateContent,
          start: match.index,
          end: match.index + fullMatch.length,
          location: this.getSourceLocation(source, match.index),
          isTagged,
          tagName,
          staticParts,
          expressions,
          confidence,
        });
        
      } catch (error) {
        errors.push({
          message: `Failed to parse template at position ${match.index}: ${error instanceof Error ? error.message : String(error)}`,
          location: this.getSourceLocation(source, match.index),
          severity: 'error',
        });
      }
    }

    return { templates, errors, patternsChecked };
  }

  /**
   * Parse template literal into static parts and expressions
   */
  private parseTemplate(content: string, baseOffset: number): {
    staticParts: string[];
    expressions: Array<{
      content: string;
      start: number;
      end: number;
    }>;
  } {
    const staticParts: string[] = [];
    const expressions: Array<{ content: string; start: number; end: number }> = [];
    
    let currentPos = 0;
    let currentStatic = '';
    
    while (currentPos < content.length) {
      const exprStart = content.indexOf('${', currentPos);
      
      if (exprStart === -1) {
        // No more expressions, rest is static
        currentStatic += content.slice(currentPos);
        break;
      }
      
      // Add static part before expression
      currentStatic += content.slice(currentPos, exprStart);
      
      // Find end of expression
      const exprEnd = this.findExpressionEnd(content, exprStart + 2);
      
      if (exprEnd === -1) {
        // Malformed expression, treat as static
        currentStatic += content.slice(exprStart);
        break;
      }
      
      // Add static part and expression
      staticParts.push(currentStatic);
      currentStatic = '';
      
      const exprContent = content.slice(exprStart + 2, exprEnd);
      expressions.push({
        content: exprContent,
        start: baseOffset + exprStart,
        end: baseOffset + exprEnd + 1,
      });
      
      currentPos = exprEnd + 1;
    }
    
    // Add final static part
    staticParts.push(currentStatic);
    
    return { staticParts, expressions };
  }

  /**
   * Find the end of a template expression, handling nested braces
   */
  private findExpressionEnd(content: string, startPos: number): number {
    let braceCount = 1;
    let pos = startPos;
    let inString = false;
    let stringChar = '';
    let escaped = false;
    
    while (pos < content.length && braceCount > 0) {
      const char = content[pos];
      
      if (escaped) {
        escaped = false;
        pos++;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        pos++;
        continue;
      }
      
      if (inString) {
        if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      } else {
        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      pos++;
    }
    
    return braceCount === 0 ? pos - 1 : -1;
  }

  /**
   * Calculate confidence score for a template match
   */
  private calculateConfidence(fullMatch: string, content: string, expressions: any[]): number {
    let confidence = 1.0;
    
    // Reduce confidence for very short templates
    if (content.length < 3) {
      confidence *= 0.7;
    }
    
    // Reduce confidence for malformed expressions
    const malformedExpressions = expressions.filter(expr => 
      !expr.content.trim() || expr.content.includes('${')
    );
    if (malformedExpressions.length > 0) {
      confidence *= Math.max(0.3, 1 - (malformedExpressions.length / expressions.length) * 0.5);
    }
    
    // Increase confidence for well-formed expressions
    if (expressions.length > 0 && malformedExpressions.length === 0) {
      confidence = Math.min(1.0, confidence + 0.1);
    }
    
    // Reduce confidence for unmatched backticks or braces
    const backtickCount = (fullMatch.match(/`/g) || []).length;
    if (backtickCount % 2 !== 0) {
      confidence *= 0.5;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Validate template matches for accuracy
   */
  private validateMatches(templates: TemplateLiteralMatch[], source: string): TemplateLiteralMatch[] {
    return templates.filter(template => {
      // Verify the match is at the expected position
      const actualContent = source.slice(template.start, template.end);
      if (actualContent !== template.raw) {
        return false;
      }
      
      // Check for minimum confidence
      if (template.confidence < 0.3) {
        return false;
      }
      
      // Validate expressions
      for (const expr of template.expressions) {
        if (expr.start < template.start || expr.end > template.end) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Filter templates based on options
   */
  private filterTemplates(templates: TemplateLiteralMatch[]): TemplateLiteralMatch[] {
    return templates.filter(template => {
      // Handle nested templates
      if (!this.options.includeNested) {
        // Check if this template is inside another template
        const isNested = templates.some(other => 
          other !== template &&
          other.start < template.start &&
          other.end > template.end
        );
        if (isNested) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Get source location information
   */
  private getSourceLocation(source: string, position: number): SourceLocation {
    const lines = source.slice(0, position).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    return {
      line,
      column,
      position,
    };
  }

  /**
   * Detect class-related template literals specifically
   */
  detectClassTemplates(source: string): TemplateLiteralMatch[] {
    const allTemplates = this.detect(source).templates;
    
    return allTemplates.filter(template => {
      // Look for class-related patterns
      const content = template.content.toLowerCase();
      const staticText = template.staticParts.join('').toLowerCase();
      
      // Common class-related keywords
      const classKeywords = [
        'class', 'className', 'css', 'style', 'theme',
        'bg-', 'text-', 'p-', 'm-', 'w-', 'h-', 'flex',
        'grid', 'border', 'rounded', 'shadow'
      ];
      
      return classKeywords.some(keyword => 
        staticText.includes(keyword) || 
        template.expressions.some(expr => 
          expr.content.toLowerCase().includes(keyword)
        )
      );
    });
  }

  /**
   * Extract potential CSS class names from templates
   */
  extractClassNames(templates: TemplateLiteralMatch[]): string[] {
    const classNames = new Set<string>();
    
    for (const template of templates) {
      // Extract from static parts
      for (const part of template.staticParts) {
        const classes = this.extractClassNamesFromString(part);
        classes.forEach(cls => classNames.add(cls));
      }
    }
    
    return Array.from(classNames);
  }

  /**
   * Extract class names from a string using common patterns
   */
  private extractClassNamesFromString(text: string): string[] {
    const classes: string[] = [];
    
    // Split on whitespace and filter valid CSS class patterns
    const tokens = text.split(/\s+/).filter(Boolean);
    
    for (const token of tokens) {
      // Basic CSS class validation
      if (this.isValidCSSClass(token)) {
        classes.push(token);
      }
    }
    
    return classes;
  }

  /**
   * Basic CSS class name validation
   */
  private isValidCSSClass(className: string): boolean {
    // Must start with letter, underscore, or hyphen
    // Can contain letters, numbers, hyphens, underscores
    return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(className) && className.length > 0;
  }
}