/**
 * CSS Custom Property Detection and Analysis
 * 
 * Provides comprehensive scanning of CSS files (including CSS-in-JS blocks) 
 * for custom property declarations and usages. Handles global (:root), 
 * local, and component-scoped variables with dynamic JavaScript interpolations.
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface CustomPropertyDeclaration {
  /** Property name without -- prefix */
  name: string;
  /** Full property name with -- prefix */
  fullName: string;
  /** Property value */
  value: string;
  /** Scope where the property is declared */
  scope: PropertyScope;
  /** File path where declared */
  filePath: string;
  /** Line number where declared */
  line: number;
  /** Column position */
  column: number;
  /** Whether the value contains CSS variables */
  containsVariables: boolean;
  /** Variables referenced in the value */
  referencedVariables: string[];
}

export interface CustomPropertyUsage {
  /** Property name being used */
  name: string;
  /** Full var() expression */
  expression: string;
  /** Fallback value if provided */
  fallback?: string;
  /** File path where used */
  filePath: string;
  /** Line number where used */
  line: number;
  /** Column position */
  column: number;
  /** CSS property where the variable is used */
  cssProperty: string;
  /** CSS selector context */
  selector: string;
}

export interface PropertyScope {
  /** Scope type */
  type: 'global' | 'local' | 'component' | 'dynamic';
  /** CSS selector or component identifier */
  identifier: string;
  /** Nesting level */
  nestingLevel: number;
  /** Parent scopes if nested */
  parentScopes: string[];
}

export interface VariableMap {
  /** All declared custom properties */
  declarations: Map<string, CustomPropertyDeclaration[]>;
  /** All variable usages */
  usages: Map<string, CustomPropertyUsage[]>;
  /** Undefined variables (used but not declared) */
  undefinedVariables: string[];
  /** Unused variables (declared but not used) */
  unusedVariables: string[];
  /** Variables with scope conflicts */
  scopeConflicts: Array<{
    name: string;
    declarations: CustomPropertyDeclaration[];
  }>;
}

export interface DetectionOptions {
  /** Include CSS-in-JS detection */
  includeCssInJs: boolean;
  /** File patterns to include */
  includePatterns: string[];
  /** File patterns to exclude */
  excludePatterns: string[];
  /** Whether to analyze JavaScript interpolations */
  analyzeJsInterpolations: boolean;
  /** Maximum file size to process (bytes) */
  maxFileSize: number;
  /** Whether to validate variable values */
  validateValues: boolean;
}

export interface ProcessingError {
  /** Error type */
  type: 'parse' | 'file' | 'validation' | 'scope';
  /** Error message */
  message: string;
  /** File path where error occurred */
  filePath: string;
  /** Line number if applicable */
  line?: number;
  /** Column position if applicable */
  column?: number;
  /** Original error if available */
  originalError?: Error;
}

export class CustomPropertyDetector {
  private options: DetectionOptions;
  private errors: ProcessingError[] = [];
  
  // CSS Custom Property Patterns
  private readonly CUSTOM_PROPERTY_DECLARATION = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  private readonly VAR_USAGE = /var\(\s*--([a-zA-Z0-9-_]+)(?:\s*,\s*([^)]+))?\s*\)/g;
  private readonly CSS_SELECTOR = /([^{]+)\s*\{([^}]+)\}/g;
  private readonly ROOT_SELECTOR = /:root\s*\{([^}]+)\}/g;
  
  // CSS-in-JS Patterns
  private readonly CSS_IN_JS_TEMPLATE = /(?:css|styled(?:\.[a-zA-Z]+)?)`([^`]+)`/g;
  private readonly CSS_IN_JS_OBJECT = /(?:style|css):\s*\{([^}]+)\}/g;
  private readonly JS_INTERPOLATION = /\$\{([^}]+)\}/g;
  
  constructor(options: Partial<DetectionOptions> = {}) {
    this.options = {
      includeCssInJs: true,
      includePatterns: ['**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      analyzeJsInterpolations: true,
      maxFileSize: 1024 * 1024, // 1MB
      validateValues: true,
      ...options
    };
    
    if (this.options.includeCssInJs) {
      this.options.includePatterns.push('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx', '**/*.vue');
    }
  }

  /**
   * Scan a directory for CSS custom properties
   */
  async scanDirectory(directoryPath: string): Promise<VariableMap> {
    this.errors = [];
    const variableMap: VariableMap = {
      declarations: new Map(),
      usages: new Map(),
      undefinedVariables: [],
      unusedVariables: [],
      scopeConflicts: []
    };

    try {
      const files = await this.findFiles(directoryPath);
      
      for (const filePath of files) {
        try {
          await this.processFile(filePath, variableMap);
        } catch (error) {
          this.addError('file', `Failed to process file: ${error instanceof Error ? error.message : String(error)}`, filePath, undefined, undefined, error instanceof Error ? error : undefined);
        }
      }

      this.analyzeVariableMap(variableMap);
      return variableMap;
    } catch (error) {
      this.addError('file', `Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`, directoryPath, undefined, undefined, error instanceof Error ? error : undefined);
      return variableMap;
    }
  }

  /**
   * Process a single file for custom properties
   */
  async processFile(filePath: string, variableMap: VariableMap): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.size > this.options.maxFileSize) {
        this.addError('file', `File too large: ${stats.size} bytes`, filePath);
        return;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const extension = path.extname(filePath).toLowerCase();

      if (this.isCssFile(extension)) {
        this.processCssContent(content, filePath, variableMap);
      } else if (this.options.includeCssInJs && this.isJsFile(extension)) {
        this.processCssInJsContent(content, filePath, variableMap);
      }
    } catch (error) {
      this.addError('file', `Failed to read file: ${error instanceof Error ? error.message : String(error)}`, filePath, undefined, undefined, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Process CSS content for custom properties
   */
  private processCssContent(content: string, filePath: string, variableMap: VariableMap): void {
    const lines = content.split('\n');
    
    // Process :root declarations first
    this.processRootDeclarations(content, filePath, variableMap);
    
    // Process other selectors
    this.processSelectorDeclarations(content, filePath, variableMap);
    
    // Process variable usages
    this.processVariableUsages(content, filePath, variableMap);
  }

  /**
   * Process CSS-in-JS content for custom properties
   */
  private processCssInJsContent(content: string, filePath: string, variableMap: VariableMap): void {
    // Process template literals
    let match;
    this.CSS_IN_JS_TEMPLATE.lastIndex = 0;
    while ((match = this.CSS_IN_JS_TEMPLATE.exec(content)) !== null) {
      const cssContent = match[1];
      const line = this.getLineNumber(content, match.index);
      
      try {
        this.processCssContent(cssContent, filePath, variableMap);
        
        // Handle JavaScript interpolations
        if (this.options.analyzeJsInterpolations) {
          this.processJsInterpolations(cssContent, filePath, line, variableMap);
        }
      } catch (error) {
        this.addError('parse', `Failed to parse CSS-in-JS template: ${error instanceof Error ? error.message : String(error)}`, filePath, line, undefined, error instanceof Error ? error : undefined);
      }
    }

    // Process CSS object literals
    this.CSS_IN_JS_OBJECT.lastIndex = 0;
    while ((match = this.CSS_IN_JS_OBJECT.exec(content)) !== null) {
      const cssContent = match[1];
      const line = this.getLineNumber(content, match.index);
      
      try {
        this.processCssObjectLiteral(cssContent, filePath, line, variableMap);
      } catch (error) {
        this.addError('parse', `Failed to parse CSS object literal: ${error instanceof Error ? error.message : String(error)}`, filePath, line, undefined, error instanceof Error ? error : undefined);
      }
    }
  }

  /**
   * Process :root declarations
   */
  private processRootDeclarations(content: string, filePath: string, variableMap: VariableMap): void {
    let match;
    this.ROOT_SELECTOR.lastIndex = 0;
    while ((match = this.ROOT_SELECTOR.exec(content)) !== null) {
      const declarations = match[1];
      const line = this.getLineNumber(content, match.index);
      
      this.extractDeclarations(declarations, filePath, line, {
        type: 'global',
        identifier: ':root',
        nestingLevel: 0,
        parentScopes: []
      }, variableMap);
    }
  }

  /**
   * Process selector-scoped declarations
   */
  private processSelectorDeclarations(content: string, filePath: string, variableMap: VariableMap): void {
    let match;
    this.CSS_SELECTOR.lastIndex = 0;
    while ((match = this.CSS_SELECTOR.exec(content)) !== null) {
      const selector = match[1].trim();
      const declarations = match[2];
      const line = this.getLineNumber(content, match.index);
      
      // Skip :root as it's handled separately
      if (selector.includes(':root')) {
        continue;
      }

      const scope: PropertyScope = {
        type: this.getScopeType(selector),
        identifier: selector,
        nestingLevel: this.calculateNestingLevel(selector),
        parentScopes: this.extractParentScopes(selector)
      };

      this.extractDeclarations(declarations, filePath, line, scope, variableMap);
    }
  }

  /**
   * Extract custom property declarations from CSS block
   */
  private extractDeclarations(
    declarations: string, 
    filePath: string, 
    startLine: number, 
    scope: PropertyScope, 
    variableMap: VariableMap
  ): void {
    let match;
    this.CUSTOM_PROPERTY_DECLARATION.lastIndex = 0;
    while ((match = this.CUSTOM_PROPERTY_DECLARATION.exec(declarations)) !== null) {
      const name = match[1];
      const value = match[2].trim();
      const line = startLine + this.getLineNumber(declarations.substring(0, match.index), 0);
      
      const referencedVariables = this.extractReferencedVariables(value);
      
      const declaration: CustomPropertyDeclaration = {
        name,
        fullName: `--${name}`,
        value,
        scope,
        filePath,
        line,
        column: match.index,
        containsVariables: referencedVariables.length > 0,
        referencedVariables
      };

      if (this.options.validateValues) {
        this.validateDeclaration(declaration);
      }

      if (!variableMap.declarations.has(name)) {
        variableMap.declarations.set(name, []);
      }
      variableMap.declarations.get(name)!.push(declaration);
    }
  }

  /**
   * Process variable usages in content
   */
  private processVariableUsages(content: string, filePath: string, variableMap: VariableMap): void {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      this.VAR_USAGE.lastIndex = 0;
      while ((match = this.VAR_USAGE.exec(line)) !== null) {
        const name = match[1];
        const fallback = match[2];
        const expression = match[0];
        
        // Find the CSS property and selector context
        const context = this.findUsageContext(content, i, match.index);
        
        const usage: CustomPropertyUsage = {
          name,
          expression,
          fallback,
          filePath,
          line: i + 1,
          column: match.index,
          cssProperty: context.property,
          selector: context.selector
        };

        if (!variableMap.usages.has(name)) {
          variableMap.usages.set(name, []);
        }
        variableMap.usages.get(name)!.push(usage);
      }
    }
  }

  /**
   * Process JavaScript interpolations in CSS-in-JS
   */
  private processJsInterpolations(
    cssContent: string, 
    filePath: string, 
    startLine: number, 
    variableMap: VariableMap
  ): void {
    let match;
    this.JS_INTERPOLATION.lastIndex = 0;
    while ((match = this.JS_INTERPOLATION.exec(cssContent)) !== null) {
      const jsExpression = match[1];
      const line = startLine + this.getLineNumber(cssContent.substring(0, match.index), 0);
      
      // Check if the JS expression might contain CSS custom properties
      if (jsExpression.includes('--') || jsExpression.includes('var(')) {
        const scope: PropertyScope = {
          type: 'dynamic',
          identifier: `js:${jsExpression}`,
          nestingLevel: 0,
          parentScopes: []
        };

        // Try to extract any CSS custom properties from the JS expression
        this.extractDeclarations(jsExpression, filePath, line, scope, variableMap);
        this.processVariableUsages(jsExpression, filePath, variableMap);
      }
    }
  }

  /**
   * Process CSS object literal (style objects in JS)
   */
  private processCssObjectLiteral(
    cssContent: string, 
    filePath: string, 
    startLine: number, 
    variableMap: VariableMap
  ): void {
    // Convert object literal to CSS-like format for processing
    const cssLike = cssContent
      .replace(/['"`]/g, '') // Remove quotes
      .replace(/,\s*$/gm, ';') // Replace trailing commas with semicolons
      .replace(/:/g, ': '); // Ensure proper spacing

    const scope: PropertyScope = {
      type: 'component',
      identifier: 'css-object',
      nestingLevel: 0,
      parentScopes: []
    };

    this.extractDeclarations(cssLike, filePath, startLine, scope, variableMap);
    this.processVariableUsages(cssLike, filePath, variableMap);
  }

  /**
   * Analyze the variable map for conflicts and unused variables
   */
  private analyzeVariableMap(variableMap: VariableMap): void {
    // Find undefined variables
    for (const [name, usages] of variableMap.usages) {
      if (!variableMap.declarations.has(name)) {
        variableMap.undefinedVariables.push(name);
      }
    }

    // Find unused variables
    for (const [name, declarations] of variableMap.declarations) {
      if (!variableMap.usages.has(name)) {
        variableMap.unusedVariables.push(name);
      }
    }

    // Find scope conflicts
    for (const [name, declarations] of variableMap.declarations) {
      if (declarations.length > 1) {
        const conflictingScopes = declarations.filter((decl, index) => {
          return declarations.findIndex(other => 
            other.scope.type === decl.scope.type && 
            other.scope.identifier === decl.scope.identifier
          ) !== index;
        });

        if (conflictingScopes.length > 0) {
          variableMap.scopeConflicts.push({
            name,
            declarations: conflictingScopes
          });
        }
      }
    }
  }

  /**
   * Get all processing errors
   */
  getErrors(): ProcessingError[] {
    return this.errors;
  }

  // Helper methods

  private async findFiles(directoryPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!this.isExcluded(fullPath)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.isIncluded(fullPath) && !this.isExcluded(fullPath)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        this.addError('file', `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`, dir, undefined, undefined, error instanceof Error ? error : undefined);
      }
    };

    await scanDirectory(directoryPath);
    return files;
  }

  private isIncluded(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return this.isCssFile(extension) || 
           (this.options.includeCssInJs && this.isJsFile(extension));
  }

  private isExcluded(filePath: string): boolean {
    return this.options.excludePatterns.some(pattern => {
      // Simple glob pattern matching
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  }

  private isCssFile(extension: string): boolean {
    return ['.css', '.scss', '.sass', '.less'].includes(extension);
  }

  private isJsFile(extension: string): boolean {
    return ['.js', '.jsx', '.ts', '.tsx', '.vue'].includes(extension);
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private getScopeType(selector: string): PropertyScope['type'] {
    if (selector.includes(':root')) return 'global';
    if (selector.startsWith('.') || selector.startsWith('#')) return 'component';
    return 'local';
  }

  private calculateNestingLevel(selector: string): number {
    return (selector.match(/\s+/g) || []).length;
  }

  private extractParentScopes(selector: string): string[] {
    const parts = selector.split(/\s+/);
    return parts.slice(0, -1);
  }

  private extractReferencedVariables(value: string): string[] {
    const variables: string[] = [];
    let match;
    this.VAR_USAGE.lastIndex = 0;
    while ((match = this.VAR_USAGE.exec(value)) !== null) {
      variables.push(match[1]);
    }
    return variables;
  }

  private validateDeclaration(declaration: CustomPropertyDeclaration): void {
    // Basic validation
    if (!declaration.value.trim()) {
      this.addError('validation', `Empty value for custom property --${declaration.name}`, declaration.filePath, declaration.line);
    }
    
    // Check for circular references
    if (declaration.referencedVariables.includes(declaration.name)) {
      this.addError('validation', `Circular reference detected in --${declaration.name}`, declaration.filePath, declaration.line);
    }
  }

  private findUsageContext(content: string, lineIndex: number, columnIndex: number): { property: string; selector: string } {
    const lines = content.split('\n');
    const currentLine = lines[lineIndex];
    
    // Find the CSS property
    const propertyMatch = currentLine.match(/([a-zA-Z-]+)\s*:\s*[^;]*var\(/);
    const property = propertyMatch ? propertyMatch[1] : 'unknown';
    
    // Find the selector by looking backwards
    let selector = 'unknown';
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('{')) {
        const selectorMatch = line.match(/([^{]+)\s*\{/);
        if (selectorMatch) {
          selector = selectorMatch[1].trim();
          break;
        }
      }
    }
    
    return { property, selector };
  }

  private addError(
    type: ProcessingError['type'], 
    message: string, 
    filePath: string, 
    line?: number, 
    column?: number, 
    originalError?: Error
  ): void {
    this.errors.push({
      type,
      message,
      filePath,
      line,
      column,
      originalError
    });
  }
}

/**
 * Utility function to create a custom property detector
 */
export function createCustomPropertyDetector(options: Partial<DetectionOptions> = {}): CustomPropertyDetector {
  return new CustomPropertyDetector(options);
}

/**
 * Utility function to scan a directory for custom properties
 */
export async function scanCustomProperties(
  directoryPath: string, 
  options: Partial<DetectionOptions> = {}
): Promise<VariableMap> {
  const detector = createCustomPropertyDetector(options);
  return await detector.scanDirectory(directoryPath);
}