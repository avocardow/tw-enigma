/**
 * AST-based Template Literal Parser
 * 
 * Uses JavaScript/TypeScript AST parsing for precise template literal analysis,
 * expression extraction, and code generation support.
 */

import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import type { SourceLocation, DynamicClassPattern, ProcessingContext } from './types';

export interface ASTTemplateLiteral {
  /** Babel AST node */
  node: t.TemplateLiteral | t.TaggedTemplateExpression;
  /** Node path for transformations */
  path: NodePath<t.TemplateLiteral | t.TaggedTemplateExpression>;
  /** Static string parts */
  quasis: string[];
  /** Expression nodes */
  expressions: t.Expression[];
  /** Generated code for expressions */
  expressionCode: string[];
  /** Whether this is a tagged template */
  isTagged: boolean;
  /** Tag name if tagged */
  tagName?: string;
  /** Source location */
  location: SourceLocation;
  /** Confidence score */
  confidence: number;
}

export interface ASTParsingOptions {
  /** Parse TypeScript */
  typescript?: boolean;
  /** Parse JSX */
  jsx?: boolean;
  /** Parser plugins to enable */
  plugins?: string[];
  /** Source type */
  sourceType?: 'module' | 'script' | 'unambiguous';
  /** Strict mode */
  strictMode?: boolean;
  /** Include location information */
  locations?: boolean;
  /** Include range information */
  ranges?: boolean;
}

export interface ASTParsingResult {
  /** Found template literals */
  templates: ASTTemplateLiteral[];
  /** AST root node */
  ast: t.File;
  /** Parsing errors */
  errors: Array<{
    message: string;
    location?: SourceLocation;
    severity: 'warning' | 'error';
  }>;
  /** Performance metrics */
  performance: {
    parseTime: number;
    traverseTime: number;
    templatesFound: number;
  };
}

/**
 * AST Template Parser
 */
export class ASTTemplateParser {
  private options: Required<ASTParsingOptions>;

  constructor(options: ASTParsingOptions = {}) {
    this.options = {
      typescript: true,
      jsx: true,
      plugins: [],
      sourceType: 'unambiguous',
      strictMode: false,
      locations: true,
      ranges: true,
      ...options,
    };
  }

  /**
   * Parse source code and extract template literals using AST
   */
  parse(source: string, context: ProcessingContext = {}): ASTParsingResult {
    const startTime = performance.now();
    const templates: ASTTemplateLiteral[] = [];
    const errors: ASTParsingResult['errors'] = [];

    try {
      // Configure parser based on file type and options
      const parserOptions = this.buildParserOptions(context.filePath);
      
      // Parse source to AST
      const parseStartTime = performance.now();
      const ast = parser.parse(source, parserOptions);
      const parseTime = performance.now() - parseStartTime;

      // Traverse AST to find template literals
      const traverseStartTime = performance.now();
      this.traverseForTemplates(ast, templates, errors, source);
      const traverseTime = performance.now() - traverseStartTime;

      return {
        templates,
        ast,
        errors,
        performance: {
          parseTime,
          traverseTime,
          templatesFound: templates.length,
        },
      };
    } catch (error) {
      errors.push({
        message: `AST parsing failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });

      // Return empty result with error
      return {
        templates: [],
        ast: t.file(t.program([])),
        errors,
        performance: {
          parseTime: 0,
          traverseTime: 0,
          templatesFound: 0,
        },
      };
    }
  }

  /**
   * Build parser options based on context
   */
  private buildParserOptions(filePath?: string): parser.ParserOptions {
    const plugins: parser.ParserPlugin[] = [...this.options.plugins as parser.ParserPlugin[]];
    
    // Determine file type
    const isTypeScript = filePath?.endsWith('.ts') || filePath?.endsWith('.tsx') || this.options.typescript;
    const isJSX = filePath?.endsWith('.jsx') || filePath?.endsWith('.tsx') || this.options.jsx;

    // Add TypeScript plugin
    if (isTypeScript) {
      plugins.push('typescript');
    }

    // Add JSX plugin
    if (isJSX && !isTypeScript) {
      plugins.push('jsx');
    }

    // Add common plugins
    if (!plugins.includes('decorators')) {
      plugins.push(['decorators', { decoratorsBeforeExport: true }]);
    }
    if (!plugins.includes('classProperties')) {
      plugins.push('classProperties');
    }
    if (!plugins.includes('objectRestSpread')) {
      plugins.push('objectRestSpread');
    }
    if (!plugins.includes('optionalChaining')) {
      plugins.push('optionalChaining');
    }
    if (!plugins.includes('nullishCoalescingOperator')) {
      plugins.push('nullishCoalescingOperator');
    }

    return {
      sourceType: this.options.sourceType,
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      plugins,
      strictMode: this.options.strictMode,
      createParenthesizedExpressions: true,
      ...(this.options.locations && { loc: true }),
      ...(this.options.ranges && { ranges: true }),
    };
  }

  /**
   * Traverse AST to find template literals
   */
  private traverseForTemplates(
    ast: t.File,
    templates: ASTTemplateLiteral[],
    errors: ASTParsingResult['errors'],
    source: string
  ): void {
    traverse(ast, {
      TemplateLiteral: (path) => {
        try {
          const template = this.processTemplateLiteral(path, source, false);
          if (template) {
            templates.push(template);
          }
        } catch (error) {
          errors.push({
            message: `Failed to process template literal: ${error instanceof Error ? error.message : String(error)}`,
            location: this.getLocationFromNode(path.node),
            severity: 'error',
          });
        }
      },
      TaggedTemplateExpression: (path) => {
        try {
          const template = this.processTaggedTemplate(path, source);
          if (template) {
            templates.push(template);
          }
        } catch (error) {
          errors.push({
            message: `Failed to process tagged template: ${error instanceof Error ? error.message : String(error)}`,
            location: this.getLocationFromNode(path.node),
            severity: 'error',
          });
        }
      },
    });
  }

  /**
   * Process template literal node
   */
  private processTemplateLiteral(
    path: NodePath<t.TemplateLiteral>,
    source: string,
    isTagged: boolean,
    tagName?: string
  ): ASTTemplateLiteral | null {
    const node = path.node;
    
    // Extract quasi strings
    const quasis = node.quasis.map(quasi => quasi.value.raw);
    
    // Extract expressions
    const expressions = node.expressions;
    const expressionCode = expressions.map(expr => {
      try {
        return generate(expr, { compact: true }).code;
      } catch {
        return '/* unparseable */';
      }
    });

    // Calculate confidence
    const confidence = this.calculateASTConfidence(node, expressions);

    return {
      node,
      path: path as NodePath<t.TemplateLiteral | t.TaggedTemplateExpression>,
      quasis,
      expressions,
      expressionCode,
      isTagged,
      tagName,
      location: this.getLocationFromNode(node),
      confidence,
    };
  }

  /**
   * Process tagged template expression
   */
  private processTaggedTemplate(
    path: NodePath<t.TaggedTemplateExpression>,
    source: string
  ): ASTTemplateLiteral | null {
    const node = path.node;
    const templateLiteral = node.quasi;
    
    // Extract tag name
    let tagName: string | undefined;
    if (t.isIdentifier(node.tag)) {
      tagName = node.tag.name;
    } else if (t.isMemberExpression(node.tag)) {
      try {
        tagName = generate(node.tag, { compact: true }).code;
      } catch {
        tagName = 'unknown';
      }
    }

    // Create template literal path mock for processing
    const templatePath = {
      node: templateLiteral,
      ...path,
    } as NodePath<t.TemplateLiteral>;

    const template = this.processTemplateLiteral(templatePath, source, true, tagName);
    
    if (template) {
      // Override node and path to reference the tagged template
      template.node = node;
      template.path = path;
    }

    return template;
  }

  /**
   * Calculate confidence for AST-based detection
   */
  private calculateASTConfidence(node: t.TemplateLiteral, expressions: t.Expression[]): number {
    let confidence = 1.0;

    // Perfect confidence for well-formed AST nodes
    if (node.quasis.length === expressions.length + 1) {
      confidence = 1.0;
    } else {
      confidence = 0.8;
    }

    // Reduce slightly for complex expressions
    const complexExpressions = expressions.filter(expr => 
      t.isCallExpression(expr) || 
      t.isConditionalExpression(expr) ||
      t.isLogicalExpression(expr)
    );
    
    if (complexExpressions.length > 0) {
      confidence *= Math.max(0.9, 1 - (complexExpressions.length / expressions.length) * 0.1);
    }

    return confidence;
  }

  /**
   * Get source location from AST node
   */
  private getLocationFromNode(node: t.Node): SourceLocation {
    if (node.loc) {
      return {
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
        position: node.start || 0,
      };
    }

    return {
      line: 1,
      column: 1,
      position: node.start || 0,
    };
  }

  /**
   * Extract dynamic class patterns from template literals
   */
  extractDynamicPatterns(templates: ASTTemplateLiteral[]): DynamicClassPattern[] {
    const patterns: DynamicClassPattern[] = [];

    for (const template of templates) {
      try {
        const pattern = this.analyzeDynamicPattern(template);
        if (pattern) {
          patterns.push(pattern);
        }
      } catch (error) {
        // Skip invalid patterns
        continue;
      }
    }

    return patterns;
  }

  /**
   * Analyze template for dynamic class patterns
   */
  private analyzeDynamicPattern(template: ASTTemplateLiteral): DynamicClassPattern | null {
    const staticClasses: string[] = [];
    const expressions: DynamicClassPattern['expressions'] = [];

    // Extract static classes from quasis
    for (const quasi of template.quasis) {
      const classes = this.extractClassesFromString(quasi);
      staticClasses.push(...classes);
    }

    // Analyze expressions
    for (let i = 0; i < template.expressions.length; i++) {
      const expr = template.expressions[i];
      const code = template.expressionCode[i];
      
      expressions.push({
        content: code,
        type: this.classifyExpression(expr),
        dependencies: this.extractDependencies(expr),
      });
    }

    // Skip if no dynamic content
    if (expressions.length === 0) {
      return null;
    }

    // Generate pattern ID
    const patternId = this.generatePatternId(template, staticClasses, expressions);

    return {
      id: patternId,
      type: this.determinePatternType(expressions),
      source: template.quasis.join('${...}'),
      staticClasses,
      expressions,
      confidence: template.confidence,
      location: template.location,
    };
  }

  /**
   * Extract CSS classes from a string
   */
  private extractClassesFromString(text: string): string[] {
    return text
      .split(/\s+/)
      .filter(cls => cls && /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(cls));
  }

  /**
   * Classify expression type
   */
  private classifyExpression(expr: t.Expression): 'variable' | 'function' | 'conditional' | 'object-key' {
    if (t.isIdentifier(expr)) {
      return 'variable';
    }
    if (t.isCallExpression(expr)) {
      return 'function';
    }
    if (t.isConditionalExpression(expr) || t.isLogicalExpression(expr)) {
      return 'conditional';
    }
    if (t.isMemberExpression(expr)) {
      return 'object-key';
    }
    return 'variable';
  }

  /**
   * Extract dependencies from expression
   */
  private extractDependencies(expr: t.Expression): string[] {
    const dependencies: string[] = [];
    
    traverse(t.file(t.program([t.expressionStatement(expr)])), {
      Identifier: (path) => {
        if (!path.isReferencedIdentifier()) return;
        dependencies.push(path.node.name);
      },
    });

    return [...new Set(dependencies)];
  }

  /**
   * Generate unique pattern ID
   */
  private generatePatternId(
    template: ASTTemplateLiteral,
    staticClasses: string[],
    expressions: DynamicClassPattern['expressions']
  ): string {
    const hash = this.simpleHash(
      template.quasis.join('|') + 
      staticClasses.join('|') + 
      expressions.map(e => e.content).join('|')
    );
    return `pattern_${hash}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Determine overall pattern type
   */
  private determinePatternType(expressions: DynamicClassPattern['expressions']): DynamicClassPattern['type'] {
    if (expressions.some(e => e.type === 'conditional')) {
      return 'conditional';
    }
    if (expressions.some(e => e.type === 'function')) {
      return 'computed';
    }
    if (expressions.some(e => e.dependencies && e.dependencies.length > 0)) {
      return 'state-based';
    }
    return 'template-literal';
  }

  /**
   * Transform template for optimization
   */
  transformTemplate(
    template: ASTTemplateLiteral,
    transformation: (node: t.TemplateLiteral | t.TaggedTemplateExpression) => t.Node
  ): string {
    try {
      const transformed = transformation(template.node);
      return generate(transformed, { compact: false }).code;
    } catch (error) {
      throw new Error(`Template transformation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}