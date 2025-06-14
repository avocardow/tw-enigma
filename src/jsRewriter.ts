/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * JavaScript/TypeScript/JSX Class Pattern Replacement System
 *
 * An intelligent AST-based system for replacing Tailwind CSS class patterns
 * in JavaScript, TypeScript, and JSX files while preserving code structure
 * and formatting.
 *
 * Based on the proven architecture from htmlRewriter.ts, adapted for
 * JavaScript AST manipulation using Babel.
 *
 * @author AI Assistant
 * @version 1.0.0
 */

import { parse, ParserOptions } from "@babel/parser";
import traverse, { NodePath, Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import generate from "@babel/generator";
import fs from "fs/promises";
import path from "path";

// Re-export types for external use
export * from "@babel/types";

/**
 * Supported JavaScript file types for pattern replacement
 */
export type JavaScriptFileType = "js" | "jsx" | "ts" | "tsx" | "mjs" | "cjs";

/**
 * Context information for pattern replacement decisions
 */
export interface JSReplacementContext {
  /** Current file path being processed */
  filePath: string;
  /** Detected file type */
  fileType: JavaScriptFileType;
  /** Whether the file contains JSX syntax */
  hasJSX: boolean;
  /** Whether the file uses TypeScript */
  hasTypeScript: boolean;
  /** Framework context (React, Vue, Angular, etc.) */
  framework?: string;
  /** Line number of the current pattern */
  line: number;
  /** Column number of the current pattern */
  column: number;
  /** Surrounding AST node context */
  nodeType: string;
  /** Parent node context for better decision making */
  parentNodeType?: string;
  /** JSX-specific context information */
  jsxContext?: {
    /** Whether this is within a JSX attribute */
    isJSXAttribute?: boolean;
    /** Name of the JSX attribute */
    attributeName?: string;
    /** Whether this is a className attribute specifically */
    isClassNameAttribute?: boolean;
    /** Whether this is JSX text content */
    isJSXText?: boolean;
  };
}

/**
 * Pattern replacement rule for JavaScript/JSX code
 */
export interface JSPatternRule {
  /** Unique identifier for this rule */
  id: string;
  /** Human-readable description */
  description: string;
  /** Regular expression pattern to match */
  pattern: RegExp;
  /** Replacement string or function */
  replacement:
    | string
    | ((match: string, context: JSReplacementContext) => string);
  /** Priority for conflict resolution (higher = more important) */
  priority: number;
  /** Whether this rule is enabled */
  enabled: boolean;
  /** File types this rule applies to */
  fileTypes?: JavaScriptFileType[];
  /** Whether this rule should only apply to JSX attributes */
  jsxOnly?: boolean;
  /** Whether this rule should only apply to template literals */
  templateLiteralsOnly?: boolean;
  /** Custom validation function */
  validator?: (context: JSReplacementContext) => boolean;
}

/**
 * Configuration for conflict resolution between overlapping patterns
 */
export interface JSConflictResolutionConfig {
  /** Strategy to use when patterns conflict */
  strategy: "priority" | "merge" | "split" | "auto";
  /** Whether to preserve original spacing in conflicts */
  preserveSpacing: boolean;
  /** Custom conflict resolver function */
  customResolver?: (
    conflicts: PatternMatch[],
    context: JSReplacementContext,
  ) => PatternMatch[];
}

/**
 * Options for format preservation during replacement
 */
export interface JSFormatPreservationOptions {
  /** Preserve original indentation style */
  preserveIndentation: boolean;
  /** Preserve original quote style (single/double/template) */
  preserveQuoteStyle: boolean;
  /** Preserve original semicolon usage */
  preserveSemicolons: boolean;
  /** Preserve original comment formatting */
  preserveComments: boolean;
  /** Custom formatting rules */
  customFormatting?: {
    /** Maximum line length before wrapping */
    maxLineLength?: number;
    /** Indentation type (spaces/tabs) */
    indentType?: "spaces" | "tabs";
    /** Number of spaces/tabs for indentation */
    indentSize?: number;
  };
}

/**
 * Performance optimization settings
 */
export interface JSPerformanceOptions {
  /** Enable caching of parsed ASTs */
  enableCaching: boolean;
  /** Maximum number of files to cache */
  maxCacheSize: number;
  /** Enable parallel processing for multiple files */
  enableParallelProcessing: boolean;
  /** Maximum number of concurrent operations */
  maxConcurrency: number;
  /** Memory usage limits */
  memoryLimits?: {
    /** Maximum memory per file (MB) */
    maxMemoryPerFile: number;
    /** Maximum total memory usage (MB) */
    maxTotalMemory: number;
  };
}

/**
 * Comprehensive configuration for JavaScript pattern replacement
 */
export interface JSRewriterConfig {
  /** Pattern replacement rules */
  rules: JSPatternRule[];
  /** Conflict resolution configuration */
  conflictResolution: JSConflictResolutionConfig;
  /** Format preservation options */
  formatPreservation: JSFormatPreservationOptions;
  /** Performance optimization settings */
  performance: JSPerformanceOptions;
  /** Babel parser options */
  parserOptions?: Partial<ParserOptions>;
  /** Whether to generate source maps */
  generateSourceMaps: boolean;
  /** Error handling strategy */
  errorHandling: {
    /** Continue processing on parse errors */
    continueOnError: boolean;
    /** Maximum number of errors before stopping */
    maxErrors: number;
    /** Custom error handler */
    onError?: (
      error: Error,
      context: { filePath: string; phase: string },
    ) => void;
  };
}

/**
 * Information about a matched pattern
 */
export interface PatternMatch {
  /** The rule that created this match */
  rule: JSPatternRule;
  /** Original matched text */
  originalText: string;
  /** Replacement text */
  replacementText: string;
  /** Start position in the source */
  start: number;
  /** End position in the source */
  end: number;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Replacement context */
  context: JSReplacementContext;
  /** AST node that contains this match */
  astNode: t.Node;
  /** Path to the AST node */
  nodePath: NodePath;
}

/**
 * Result of pattern replacement operation
 */
export interface JSReplacementResult {
  /** Whether any replacements were made */
  modified: boolean;
  /** Final transformed code */
  code: string;
  /** Source map if requested */
  sourceMap?: any;
  /** Number of replacements made */
  replacementCount: number;
  /** Details of all replacements */
  replacements: PatternMatch[];
  /** Any errors encountered */
  errors: Array<{
    message: string;
    line?: number;
    column?: number;
    phase: string;
  }>;
  /** Performance metrics */
  performance: {
    /** Parse time in milliseconds */
    parseTime: number;
    /** Transform time in milliseconds */
    transformTime: number;
    /** Generate time in milliseconds */
    generateTime: number;
    /** Total time in milliseconds */
    totalTime: number;
    /** Peak memory usage in MB */
    peakMemory: number;
  };
}

/**
 * Options for batch file processing
 */
export interface JSBatchProcessingOptions {
  /** Input directory or file patterns */
  input: string | string[];
  /** Output directory (if different from input) */
  outputDir?: string;
  /** File extension mapping for output files */
  extensionMapping?: Record<string, string>;
  /** Whether to create backups before modification */
  createBackups: boolean;
  /** Backup directory */
  backupDir?: string;
  /** Maximum number of files to process concurrently */
  maxConcurrency: number;
  /** Progress callback */
  onProgress?: (processed: number, total: number, currentFile: string) => void;
  /** File filter function */
  fileFilter?: (filePath: string) => boolean;
}

/**
 * Default configuration for JavaScript pattern replacement
 */
export const DEFAULT_JS_REWRITER_CONFIG: JSRewriterConfig = {
  rules: [],
  conflictResolution: {
    strategy: "auto",
    preserveSpacing: true,
  },
  formatPreservation: {
    preserveIndentation: true,
    preserveQuoteStyle: true,
    preserveSemicolons: true,
    preserveComments: true,
  },
  performance: {
    enableCaching: true,
    maxCacheSize: 100,
    enableParallelProcessing: true,
    maxConcurrency: 4,
  },
  parserOptions: {
    sourceType: "module",
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: [
      "jsx",
      "typescript",
      "decorators-legacy",
      "classProperties",
      "objectRestSpread",
      "functionBind",
      "dynamicImport",
      "nullishCoalescingOperator",
      "optionalChaining",
    ],
  },
  generateSourceMaps: false,
  errorHandling: {
    continueOnError: true,
    maxErrors: 10,
  },
};

/**
 * Main JavaScript pattern replacement class
 */
export class JSRewriter {
  private config: JSRewriterConfig;
  private astCache = new Map<string, { ast: t.File; timestamp: number }>();
  private statistics = {
    filesProcessed: 0,
    totalReplacements: 0,
    totalErrors: 0,
    avgProcessingTime: 0,
  };

  /**
   * Create a new JavaScript rewriter instance
   */
  constructor(config: Partial<JSRewriterConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_JS_REWRITER_CONFIG, config);
    this.setupErrorHandling();
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<JSRewriterConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<JSRewriterConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /**
   * Add a new pattern rule
   */
  addRule(rule: JSPatternRule): void {
    this.config.rules.push(rule);
    this.config.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a pattern rule by ID
   */
  removeRule(ruleId: string): boolean {
    const initialLength = this.config.rules.length;
    this.config.rules = this.config.rules.filter((rule) => rule.id !== ruleId);
    return this.config.rules.length < initialLength;
  }

  /**
   * Get all pattern rules
   */
  getRules(): readonly JSPatternRule[] {
    return [...this.config.rules];
  }

  /**
   * Get processing statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Clear processing statistics
   */
  clearStatistics(): void {
    this.statistics = {
      filesProcessed: 0,
      totalReplacements: 0,
      totalErrors: 0,
      avgProcessingTime: 0,
    };
  }

  /**
   * Clear AST cache
   */
  clearCache(): void {
    this.astCache.clear();
  }

  /**
   * Detect JavaScript file type from file path or content
   */
  detectFileType(filePath: string, content?: string): JavaScriptFileType {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case ".jsx":
        return "jsx";
      case ".ts":
        return "ts";
      case ".tsx":
        return "tsx";
      case ".mjs":
        return "mjs";
      case ".cjs":
        return "cjs";
      case ".js":
      default:
        // Check content for JSX or TypeScript syntax if available
        if (content) {
          // Enhanced TypeScript detection
          const hasTypeScript =
            content.includes("interface ") ||
            content.includes("type ") ||
            content.includes(": string") ||
            content.includes(": number") ||
            content.includes(": boolean") ||
            content.includes("extends ") ||
            content.includes(" as ") ||
            content.includes("as const") ||
            content.includes("<T ") ||
            content.includes("<T>") ||
            content.includes("T extends") ||
            content.includes("?: ") ||
            content.includes("@Input") ||
            content.includes("@HostBinding") ||
            (content.includes("= '") && content.includes("' as const")) ||
            /:\s*\w+(\[\])?(\s*\|\s*\w+)*\s*[;=]/.test(content) ||
            (/<[A-Z]\w*\s*[<(]/.test(content) && content.includes("extends"));

          const hasJSX =
            (content.includes("<") &&
              content.includes(">") &&
              (content.includes("className") ||
                content.includes("jsx") ||
                /\<[A-Z]\w*/.test(content) ||
                content.includes("<div"))) ||
            content.includes("</") ||
            content.includes("/>");

          if (hasTypeScript && hasJSX) return "tsx";
          if (hasTypeScript) return "ts";
          if (hasJSX) return "jsx";
        }
        return "js";
    }
  }

  /**
   * Process a single JavaScript file
   */
  async processFile(
    filePath: string,
    outputPath?: string,
  ): Promise<JSReplacementResult> {
    const startTime = Date.now();
    const content = await fs.readFile(filePath, "utf-8");

    try {
      const result = await this.processCode(content, filePath);

      if (result.modified && outputPath) {
        await fs.writeFile(outputPath, result.code, "utf-8");
      }

      this.updateStatistics(result, Date.now() - startTime);
      return result;
    } catch (error) {
      const errorResult: JSReplacementResult = {
        modified: false,
        code: content,
        replacementCount: 0,
        replacements: [],
        errors: [
          {
            message: error instanceof Error ? error.message : "Unknown error",
            phase: "file-processing",
          },
        ],
        performance: {
          parseTime: 0,
          transformTime: 0,
          generateTime: 0,
          totalTime: Date.now() - startTime,
          peakMemory: 0,
        },
      };

      this.statistics.totalErrors++;
      this.config.errorHandling.onError?.(
        error instanceof Error ? error : new Error(String(error)),
        { filePath, phase: "file-processing" },
      );

      return errorResult;
    }
  }

  /**
   * Process JavaScript code string
   */
  async processCode(
    code: string,
    filePath = "<unknown>",
  ): Promise<JSReplacementResult> {
    const startTime = Date.now();
    const performanceMetrics = {
      parseTime: 0,
      transformTime: 0,
      generateTime: 0,
      totalTime: 0,
      peakMemory: 0,
    };

    const errors: Array<{
      message: string;
      line?: number;
      column?: number;
      phase: string;
    }> = [];

    try {
      // Parse the code into AST
      const parseStart = Date.now();
      let ast: t.File;
      try {
        ast = this.parseCode(code, filePath);
      } catch (parseError) {
        if (!this.config.errorHandling.continueOnError) {
          throw parseError;
        }

        const errorMessage =
          parseError instanceof Error ? parseError.message : "Parse error";
        errors.push({
          message: `Error in code-processing for ${filePath}: ${errorMessage}`,
          phase: "parsing",
        });

        this.config.errorHandling.onError?.(
          parseError instanceof Error
            ? parseError
            : new Error(String(parseError)),
          { filePath, phase: "parsing" },
        );

        // Return original code with error info
        return {
          modified: false,
          code,
          replacementCount: 0,
          replacements: [],
          errors,
          performance: {
            parseTime: Date.now() - parseStart,
            transformTime: 0,
            generateTime: 0,
            totalTime: Date.now() - startTime,
            peakMemory: 0,
          },
        };
      }
      performanceMetrics.parseTime = Date.now() - parseStart;

      // Transform the AST
      const transformStart = Date.now();
      let matches: PatternMatch[] = [];
      try {
        const result = await this.transformAST(ast, code, filePath);
        ast = result.transformedAst;
        matches = result.matches;

        // Add transformation errors to the errors array
        errors.push(...result.errors);
      } catch (transformError) {
        if (
          !this.config.errorHandling.continueOnError ||
          errors.length >= this.config.errorHandling.maxErrors
        ) {
          throw transformError;
        }

        const errorMessage =
          transformError instanceof Error
            ? transformError.message
            : "Transform error";
        errors.push({ message: errorMessage, phase: "transformation" });

        this.config.errorHandling.onError?.(
          transformError instanceof Error
            ? transformError
            : new Error(String(transformError)),
          { filePath, phase: "transformation" },
        );
      }
      performanceMetrics.transformTime = Date.now() - transformStart;

      // Generate code from transformed AST
      const generateStart = Date.now();
      let generatedCode = code; // fallback to original

      try {
        // Enhanced code generation with quote style preservation
        const generateOptions: any = {
          sourceFileName: filePath,
          sourceMaps: this.config.generateSourceMaps,
          retainLines: this.config.formatPreservation.preserveIndentation,
          compact: false,
          minified: false,
          comments: this.config.formatPreservation.preserveComments,
        };

        const generateResult = generate(ast, generateOptions);
        generatedCode = generateResult.code;

        // Post-process to preserve quote styles if requested
        if (
          this.config.formatPreservation.preserveQuoteStyle &&
          matches.length > 0
        ) {
          generatedCode = this.preserveOriginalQuoteStyles(
            code,
            generatedCode,
            matches,
          );
        }
      } catch (generateError) {
        if (
          !this.config.errorHandling.continueOnError ||
          errors.length >= this.config.errorHandling.maxErrors
        ) {
          throw generateError;
        }

        const errorMessage =
          generateError instanceof Error
            ? generateError.message
            : "Generate error";
        errors.push({ message: errorMessage, phase: "generation" });

        this.config.errorHandling.onError?.(
          generateError instanceof Error
            ? generateError
            : new Error(String(generateError)),
          { filePath, phase: "generation" },
        );
      }

      performanceMetrics.generateTime = Date.now() - generateStart;
      performanceMetrics.totalTime = Date.now() - startTime;

      return {
        modified: matches.length > 0,
        code: generatedCode,
        sourceMap: undefined, // Will be properly implemented in Step 5
        replacementCount: matches.length,
        replacements: matches,
        errors,
        performance: performanceMetrics,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.config.errorHandling.onError?.(
        error instanceof Error ? error : new Error(String(error)),
        { filePath, phase: "code-processing" },
      );

      return {
        modified: false,
        code,
        replacementCount: 0,
        replacements: [],
        errors: [{ message: errorMessage, phase: "code-processing" }],
        performance: {
          ...performanceMetrics,
          totalTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Process multiple files in batch
   */
  async processBatch(options: JSBatchProcessingOptions): Promise<{
    results: Array<{ filePath: string; result: JSReplacementResult }>;
    summary: {
      totalFiles: number;
      successfulFiles: number;
      failedFiles: number;
      totalReplacements: number;
      totalErrors: number;
      avgProcessingTime: number;
    };
  }> {
    // Implementation will be added in Step 6
    throw new Error("Batch processing will be implemented in Step 6");
  }

  /**
   * Parse JavaScript code into AST
   */
  private parseCode(code: string, filePath: string): t.File {
    // Check cache first
    if (this.config.performance.enableCaching) {
      const cached = this.astCache.get(filePath);
      if (cached && Date.now() - cached.timestamp < 60000) {
        // 1 minute cache
        return cached.ast;
      }
    }

    try {
      const fileType = this.detectFileType(filePath, code);
      const parserOptions: ParserOptions = {
        ...this.config.parserOptions,
        sourceFilename: filePath,
        plugins: this.getParserPlugins(fileType),
      };

      const ast = parse(code, parserOptions);

      // Cache the result
      if (this.config.performance.enableCaching) {
        this.astCache.set(filePath, { ast, timestamp: Date.now() });

        // Clean cache if it's too large
        if (this.astCache.size > this.config.performance.maxCacheSize) {
          const oldestKey = this.astCache.keys().next().value;
          if (oldestKey) {
            this.astCache.delete(oldestKey);
          }
        }
      }

      return ast;
    } catch (error) {
      throw new Error(
        `Failed to parse ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get appropriate parser plugins for file type
   */
  private getParserPlugins(
    fileType: JavaScriptFileType,
  ): ParserOptions["plugins"] {
    const basePlugins = [
      "decorators-legacy",
      "classProperties",
      "objectRestSpread",
      "functionBind",
      "dynamicImport",
      "nullishCoalescingOperator",
      "optionalChaining",
    ] as const;

    switch (fileType) {
      case "jsx":
        return [...basePlugins, "jsx"] as ParserOptions["plugins"];
      case "ts":
        return [...basePlugins, "typescript"] as ParserOptions["plugins"];
      case "tsx":
        return [...basePlugins, "jsx", "typescript"] as ParserOptions["plugins"];
              default:
          return [...basePlugins] as ParserOptions["plugins"];
    }
  }

  /**
   * Transform AST by applying pattern rules
   */
  private async transformAST(
    ast: t.File,
    originalCode: string,
    filePath: string,
  ): Promise<{
    transformedAst: t.File;
    matches: PatternMatch[];
    errors: Array<{ message: string; phase: string }>;
  }> {
    const potentialMatches: PatternMatch[] = [];
    const transformationErrors: Array<{ message: string; phase: string }> = [];
    const fileType = this.detectFileType(filePath, originalCode);

    // Phase 1: Collect all potential matches without applying transformations
    const collectVisitor: Visitor = {
      // Handle string literals
      StringLiteral: (path) => {
        try {
          this.collectStringMatches(
            path,
            potentialMatches,
            originalCode,
            filePath,
            fileType,
            transformationErrors,
          );
        } catch (error) {
          if (this.config.errorHandling.continueOnError) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "String processing error";
            transformationErrors.push({
              message: errorMessage,
              phase: "string-collection",
            });
          } else {
            throw error;
          }
        }
      },

      // Handle template literals
      TemplateLiteral: (path) => {
        try {
          this.collectTemplateMatches(
            path,
            potentialMatches,
            originalCode,
            filePath,
            fileType,
          );
        } catch (error) {
          if (this.config.errorHandling.continueOnError) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Template processing error";
            transformationErrors.push({
              message: errorMessage,
              phase: "template-collection",
            });
          } else {
            throw error;
          }
        }
      },

      // Handle JSX attributes
      JSXAttribute: (path) => {
        try {
          this.collectJSXAttributeMatches(
            path,
            potentialMatches,
            originalCode,
            filePath,
            fileType,
          );
        } catch (error) {
          if (this.config.errorHandling.continueOnError) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "JSX attribute processing error";
            transformationErrors.push({
              message: errorMessage,
              phase: "jsx-attribute-collection",
            });
          } else {
            throw error;
          }
        }
      },

      // Handle JSX text content
      JSXText: (path) => {
        try {
          this.collectJSXTextMatches(
            path,
            potentialMatches,
            originalCode,
            filePath,
            fileType,
            transformationErrors,
          );
        } catch (error) {
          if (this.config.errorHandling.continueOnError) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "JSX text processing error";
            transformationErrors.push({
              message: errorMessage,
              phase: "jsx-text-collection",
            });
          } else {
            throw error;
          }
        }
      },
    };

    // Traverse to collect potential matches
    traverse(ast, collectVisitor);

    // Phase 2: Detect conflicts among all matches
    const conflicts = this.detectConflicts(potentialMatches);

    // Create context for conflict resolution
    const context: JSReplacementContext = {
      filePath,
      fileType,
      hasJSX: fileType.includes("x"),
      hasTypeScript: fileType.includes("ts"),
      framework: this.detectFramework(originalCode),
      line: 1,
      column: 1,
      nodeType: "Program",
    };

    // Phase 3: Resolve conflicts and get final matches to apply
    const resolvedMatches = this.resolveConflicts(
      potentialMatches,
      conflicts,
      context,
    );

    // Phase 4: Apply resolved matches to AST
    try {
      this.applyMatchesToAST(resolvedMatches);
    } catch (error) {
      if (this.config.errorHandling.continueOnError) {
        const errorMessage =
          error instanceof Error ? error.message : "AST application error";
        transformationErrors.push({
          message: errorMessage,
          phase: "ast-application",
        });
      } else {
        throw error;
      }
    }

    return {
      transformedAst: ast,
      matches: resolvedMatches,
      errors: transformationErrors,
    };
  }

  /**
   * Apply resolved matches to the AST
   */
  private applyMatchesToAST(resolvedMatches: PatternMatch[]): void {
    // Group matches by their AST node to handle multiple matches per node
    const matchesByNode = new Map<t.Node, PatternMatch[]>();

    for (const match of resolvedMatches) {
      if (!matchesByNode.has(match.astNode)) {
        matchesByNode.set(match.astNode, []);
      }
      matchesByNode.get(match.astNode)!.push(match);
    }

    // Apply matches to each node
    for (const [node, matches] of matchesByNode) {
      this.applyMatchesToNode(node, matches);
    }
  }

  /**
   * Apply matches to a specific AST node
   */
  private applyMatchesToNode(node: t.Node, matches: PatternMatch[]): void {
    if (matches.length === 0) return;

    // Sort matches by position (process from end to start to avoid offset issues)
    const sortedMatches = [...matches].sort((a, b) => b.start - a.start);

    if (node.type === "StringLiteral") {
      this.applyStringLiteralMatches(node as t.StringLiteral, sortedMatches);
    } else if (node.type === "TemplateLiteral") {
      this.applyTemplateLiteralMatches(
        node as t.TemplateLiteral,
        sortedMatches,
      );
    } else if (node.type === "JSXText") {
      this.applyJSXTextMatches(node as t.JSXText, sortedMatches);
    }
  }

  /**
   * Apply matches to a string literal node
   */
  private applyStringLiteralMatches(
    node: t.StringLiteral,
    matches: PatternMatch[],
  ): void {
    let currentValue = node.value || "";

    for (const match of matches) {
      // Calculate relative position within the string
      const nodeStart = node.start || 0;
      const relativeStart = match.start - nodeStart;
      const relativeEnd = match.end - nodeStart;

      if (relativeStart >= 0 && relativeEnd <= currentValue.length) {
        currentValue =
          currentValue.substring(0, relativeStart) +
          match.replacementText +
          currentValue.substring(relativeEnd);
      }
    }

    if (currentValue !== node.value) {
      node.value = currentValue;

      // Preserve original quote style
      if (node.extra?.raw) {
        const quote = (node.extra.raw as string).charAt(0);
        const escapedValue = currentValue.replace(
          new RegExp(quote, "g"),
          `\\${quote}`,
        );
        node.extra.raw = `${quote}${escapedValue}${quote}`;
      }
    }
  }

  /**
   * Apply matches to a template literal node
   */
  private applyTemplateLiteralMatches(
    node: t.TemplateLiteral,
    matches: PatternMatch[],
  ): void {
    if (!node.quasis) return;

    // Group matches by quasi index
    const matchesByQuasi = new Map<number, PatternMatch[]>();

    for (const match of matches) {
      // Find which quasi this match belongs to
      let quasiIndex = -1;
      for (let i = 0; i < node.quasis.length; i++) {
        const quasi = node.quasis[i];
        if (
          match.start >= (quasi.start || 0) &&
          match.end <= (quasi.end || 0)
        ) {
          quasiIndex = i;
          break;
        }
      }

      if (quasiIndex >= 0) {
        if (!matchesByQuasi.has(quasiIndex)) {
          matchesByQuasi.set(quasiIndex, []);
        }
        matchesByQuasi.get(quasiIndex)!.push(match);
      }
    }

    // Apply matches to each quasi
    for (const [quasiIndex, quasiMatches] of matchesByQuasi) {
      const quasi = node.quasis[quasiIndex];
      let currentValue = quasi.value.raw || quasi.value.cooked || "";

      // Sort matches for this quasi by position (reverse order)
      const sortedQuasiMatches = [...quasiMatches].sort(
        (a, b) => b.start - a.start,
      );

      for (const match of sortedQuasiMatches) {
        const quasiStart = quasi.start || 0;
        const relativeStart = match.start - quasiStart;
        const relativeEnd = match.end - quasiStart;

        if (relativeStart >= 0 && relativeEnd <= currentValue.length) {
          currentValue =
            currentValue.substring(0, relativeStart) +
            match.replacementText +
            currentValue.substring(relativeEnd);
        }
      }

      if (currentValue !== (quasi.value.raw || quasi.value.cooked)) {
        quasi.value = {
          raw: currentValue,
          cooked: currentValue,
        };
      }
    }
  }

  /**
   * Apply matches to a JSX text node
   */
  private applyJSXTextMatches(node: t.JSXText, matches: PatternMatch[]): void {
    let currentValue = node.value || "";

    for (const match of matches) {
      const nodeStart = node.start || 0;
      const relativeStart = match.start - nodeStart;
      const relativeEnd = match.end - nodeStart;

      if (relativeStart >= 0 && relativeEnd <= currentValue.length) {
        currentValue =
          currentValue.substring(0, relativeStart) +
          match.replacementText +
          currentValue.substring(relativeEnd);
      }
    }

    if (currentValue !== node.value) {
      node.value = currentValue;
    }
  }

  /**
   * Detect conflicts between pattern matches
   */
  private detectConflicts(matches: PatternMatch[]): Array<{
    conflictType: "overlap" | "adjacent" | "nested" | "identical";
    matches: PatternMatch[];
    severity: "low" | "medium" | "high";
  }> {
    const conflicts: Array<{
      conflictType: "overlap" | "adjacent" | "nested" | "identical";
      matches: PatternMatch[];
      severity: "low" | "medium" | "high";
    }> = [];

    // Sort matches by position for easier conflict detection
    const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sortedMatches.length; i++) {
      for (let j = i + 1; j < sortedMatches.length; j++) {
        const match1 = sortedMatches[i];
        const match2 = sortedMatches[j];

        // Skip if matches are in different AST nodes
        if (match1.astNode !== match2.astNode) {
          continue;
        }

        const conflict = this.analyzeMatchConflict(match1, match2);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Analyze conflict between two specific matches
   */
  private analyzeMatchConflict(
    match1: PatternMatch,
    match2: PatternMatch,
  ): {
    conflictType: "overlap" | "adjacent" | "nested" | "identical";
    matches: PatternMatch[];
    severity: "low" | "medium" | "high";
  } | null {
    // Check for identical matches (same position and text)
    if (
      match1.start === match2.start &&
      match1.end === match2.end &&
      match1.originalText === match2.originalText
    ) {
      return {
        conflictType: "identical",
        matches: [match1, match2],
        severity: "medium",
      };
    }

    // Check for overlap
    if (match1.start < match2.end && match2.start < match1.end) {
      // Check for nesting (one match completely contains another)
      if (
        (match1.start <= match2.start && match1.end >= match2.end) ||
        (match2.start <= match1.start && match2.end >= match1.end)
      ) {
        return {
          conflictType: "nested",
          matches: [match1, match2],
          severity: "high",
        };
      } else {
        return {
          conflictType: "overlap",
          matches: [match1, match2],
          severity: "high",
        };
      }
    }

    // Check for adjacent matches (touching but not overlapping)
    if (match1.end === match2.start || match2.end === match1.start) {
      return {
        conflictType: "adjacent",
        matches: [match1, match2],
        severity: "low",
      };
    }

    return null;
  }

  /**
   * Resolve conflicts using the configured strategy
   */
  private resolveConflicts(
    matches: PatternMatch[],
    conflicts: Array<{
      conflictType: "overlap" | "adjacent" | "nested" | "identical";
      matches: PatternMatch[];
      severity: "low" | "medium" | "high";
    }>,
    context: JSReplacementContext,
  ): PatternMatch[] {
    if (conflicts.length === 0) {
      return matches;
    }

    const strategy = this.config.conflictResolution.strategy;

    switch (strategy) {
      case "priority":
        return this.resolvePriorityStrategy(matches, conflicts);
      case "merge":
        return this.resolveMergeStrategy(matches, conflicts, context);
      case "split":
        return this.resolveSplitStrategy(matches, conflicts);
      case "auto":
        return this.resolveAutoStrategy(matches, conflicts, context);
      default:
        return this.resolvePriorityStrategy(matches, conflicts);
    }
  }

  /**
   * Resolve conflicts using priority strategy (highest priority rule wins)
   */
  private resolvePriorityStrategy(
    matches: PatternMatch[],
    conflicts: Array<{
      conflictType: "overlap" | "adjacent" | "nested" | "identical";
      matches: PatternMatch[];
      severity: "low" | "medium" | "high";
    }>,
  ): PatternMatch[] {
    const conflictingMatches = new Set<PatternMatch>();
    const resolvedMatches: PatternMatch[] = [];

    // Collect all conflicting matches
    for (const conflict of conflicts) {
      if (
        conflict.severity === "high" ||
        conflict.conflictType === "identical"
      ) {
        conflict.matches.forEach((match) => conflictingMatches.add(match));
      }
    }

    // Group conflicting matches by position ranges
    const conflictGroups = this.groupConflictingMatches([
      ...conflictingMatches,
    ]);

    // Resolve each conflict group by priority
    for (const group of conflictGroups) {
      const highestPriorityMatch = group.reduce((prev, current) =>
        current.rule.priority > prev.rule.priority ? current : prev,
      );
      resolvedMatches.push(highestPriorityMatch);
    }

    // Add non-conflicting matches
    for (const match of matches) {
      if (!conflictingMatches.has(match)) {
        resolvedMatches.push(match);
      }
    }

    return resolvedMatches;
  }

  /**
   * Resolve conflicts using merge strategy (combine compatible rules)
   */
  private resolveMergeStrategy(
    matches: PatternMatch[],
    conflicts: Array<{
      conflictType: "overlap" | "adjacent" | "nested" | "identical";
      matches: PatternMatch[];
      severity: "low" | "medium" | "high";
    }>,
    context: JSReplacementContext,
  ): PatternMatch[] {
    // For now, fall back to priority strategy for complex merging
    // This can be enhanced in the future with more sophisticated merging logic
    return this.resolvePriorityStrategy(matches, conflicts);
  }

  /**
   * Resolve conflicts using split strategy (split overlapping patterns)
   */
  private resolveSplitStrategy(
    matches: PatternMatch[],
    conflicts: Array<{
      conflictType: "overlap" | "adjacent" | "nested" | "identical";
      matches: PatternMatch[];
      severity: "low" | "medium" | "high";
    }>,
  ): PatternMatch[] {
    // For now, fall back to priority strategy
    // Split strategy would require more complex text segmentation
    return this.resolvePriorityStrategy(matches, conflicts);
  }

  /**
   * Resolve conflicts using auto strategy (choose best approach per conflict)
   */
  private resolveAutoStrategy(
    matches: PatternMatch[],
    conflicts: Array<{
      conflictType: "overlap" | "adjacent" | "nested" | "identical";
      matches: PatternMatch[];
      severity: "low" | "medium" | "high";
    }>,
    context: JSReplacementContext,
  ): PatternMatch[] {
    // Auto strategy logic:
    // - Identical conflicts: Use priority
    // - Nested conflicts: Use priority (outer pattern usually wins)
    // - Overlap conflicts: Use priority
    // - Adjacent conflicts: Allow both (no real conflict)

    const filteredConflicts = conflicts.filter(
      (conflict) => conflict.conflictType !== "adjacent", // Adjacent matches are not real conflicts
    );

    return this.resolvePriorityStrategy(matches, filteredConflicts);
  }

  /**
   * Group conflicting matches that affect the same text regions
   */
  private groupConflictingMatches(
    conflictingMatches: PatternMatch[],
  ): PatternMatch[][] {
    const groups: PatternMatch[][] = [];
    const processed = new Set<PatternMatch>();

    for (const match of conflictingMatches) {
      if (processed.has(match)) {
        continue;
      }

      const group = [match];
      processed.add(match);

      // Find all matches that conflict with this one
      for (const otherMatch of conflictingMatches) {
        if (processed.has(otherMatch)) {
          continue;
        }

        // Check if they overlap or are identical
        if (this.matchesOverlap(match, otherMatch)) {
          group.push(otherMatch);
          processed.add(otherMatch);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Check if two matches overlap in their text positions
   */
  private matchesOverlap(match1: PatternMatch, match2: PatternMatch): boolean {
    return match1.start < match2.end && match2.start < match1.end;
  }

  /**
   * Detect framework from code content
   */
  private detectFramework(code: string): string | undefined {
    if (
      code.includes("import React") ||
      code.includes('from "react"') ||
      code.includes("from 'react'")
    ) {
      return "react";
    }

    if (code.includes("@Component") || code.includes("angular")) {
      return "angular";
    }

    if (code.includes("Vue") || code.includes("@vue")) {
      return "vue";
    }

    return undefined;
  }

  /**
   * Merge two configuration objects
   */
  private mergeConfig(
    base: JSRewriterConfig,
    updates: Partial<JSRewriterConfig>,
  ): JSRewriterConfig {
    return {
      ...base,
      ...updates,
      rules: updates.rules ? [...updates.rules] : [...base.rules],
      conflictResolution: {
        ...base.conflictResolution,
        ...updates.conflictResolution,
      },
      formatPreservation: {
        ...base.formatPreservation,
        ...updates.formatPreservation,
      },
      performance: { ...base.performance, ...updates.performance },
      parserOptions: { ...base.parserOptions, ...updates.parserOptions },
      errorHandling: { ...base.errorHandling, ...updates.errorHandling },
    };
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    if (!this.config.errorHandling.onError) {
      this.config.errorHandling.onError = (error, context) => {
        console.error(
          `Error in ${context.phase} for ${context.filePath}:`,
          error.message,
        );
      };
    }
  }

  /**
   * Update processing statistics
   */
  private updateStatistics(
    result: JSReplacementResult,
    processingTime: number,
  ): void {
    this.statistics.filesProcessed++;
    this.statistics.totalReplacements += result.replacementCount;
    this.statistics.totalErrors += result.errors.length;

    // Update average processing time
    const totalTime =
      this.statistics.avgProcessingTime * (this.statistics.filesProcessed - 1) +
      processingTime;
    this.statistics.avgProcessingTime =
      totalTime / this.statistics.filesProcessed;
  }

  /**
   * Preserve original quote styles in generated code
   */
  private preserveOriginalQuoteStyles(
    originalCode: string,
    generatedCode: string,
    matches: PatternMatch[],
  ): string {
    let preservedCode = generatedCode;

    // If quote style preservation is disabled, return as is
    if (!this.config.formatPreservation.preserveQuoteStyle) {
      return preservedCode;
    }

    // Extract all string literals from the original code
    const stringLiteralRegex = /(['"`])([^\\]|\\.)*?\1/g;
    const originalStrings = [...originalCode.matchAll(stringLiteralRegex)];
    const generatedStrings = [...generatedCode.matchAll(stringLiteralRegex)];

    // Map to track quote styles for specific content
    const quoteStyleMap = new Map<string, string>();

    // Build map from original strings
    for (const match of originalStrings) {
      const fullMatch = match[0];
      const quote = match[1];
      const content = fullMatch.slice(1, -1); // Remove quotes
      quoteStyleMap.set(content, quote);
    }

    // Process each replacement to preserve quote style
    for (const match of matches) {
      if (match.astNode.type === "StringLiteral") {
        const originalQuote = quoteStyleMap.get(match.originalText);
        if (originalQuote) {
          // Find the replacement in generated code and update its quote style
          const replacementPattern = new RegExp(
            `(['"\`])${this.escapeRegex(match.replacementText)}\\1`,
          );
          preservedCode = preservedCode.replace(
            replacementPattern,
            `${originalQuote}${match.replacementText}${originalQuote}`,
          );
        }
      }
    }

    return preservedCode;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Create processing context for pattern matching
   */
  private createProcessingContext(
    path: NodePath,
    originalCode: string,
    filePath: string,
    fileType: JavaScriptFileType,
    jsxContext?: {
      isJSXAttribute?: boolean;
      attributeName?: string;
      isClassNameAttribute?: boolean;
      isJSXText?: boolean;
    },
  ): JSReplacementContext {
    const node = path.node;
    const hasJSX =
      ["jsx", "tsx"].includes(fileType) || originalCode.includes("<");
    const hasTypeScript =
      ["ts", "tsx"].includes(fileType) ||
      originalCode.includes("interface ") ||
      originalCode.includes(": ");

    // Get parent node type for better context
    const parentNodeType = path.parent?.type;

    return {
      filePath,
      fileType,
      hasJSX,
      hasTypeScript,
      framework: this.detectFramework(originalCode),
      line: node.loc?.start.line || 1,
      column: node.loc?.start.column || 0,
      nodeType: node.type,
      parentNodeType,
      jsxContext,
    };
  }

  /**
   * Get applicable rules for the given context
   */
  private getApplicableRules(context: JSReplacementContext): JSPatternRule[] {
    return this.config.rules
      .filter((rule) => {
        // Check if rule is enabled
        if (!rule.enabled) return false;

        // Check file type restrictions
        if (rule.fileTypes && !rule.fileTypes.includes(context.fileType)) {
          return false;
        }

        // Check JSX-only restrictions more precisely
        if (rule.jsxOnly) {
          // Only apply JSX-only rules to JSX attribute contexts
          const isJSXContext =
            context.jsxContext?.isJSXAttribute ||
            context.jsxContext?.isClassNameAttribute;
          if (!isJSXContext) {
            return false;
          }
        }

        // Check template literal restrictions more precisely
        if (rule.templateLiteralsOnly) {
          // Only apply to actual template literal nodes
          if (context.nodeType !== "TemplateLiteral") {
            return false;
          }
        }

        // Apply custom validator
        if (rule.validator && !rule.validator(context)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
  }

  /**
   * Collect potential matches from string literal nodes without applying transformations
   */
  private collectStringMatches(
    path: NodePath<t.StringLiteral>,
    potentialMatches: PatternMatch[],
    originalCode: string,
    filePath: string,
    fileType: JavaScriptFileType,
    errors?: Array<{ message: string; phase: string }>,
  ): void {
    const node = path.node;
    if (!node.value || typeof node.value !== "string") {
      return;
    }

    const originalValue = node.value;
    const context = this.createProcessingContext(
      path,
      originalCode,
      filePath,
      fileType,
    );

    // Collect matches from all applicable rules without applying them
    for (const rule of this.getApplicableRules(context)) {
      const ruleMatches = this.findPatternMatches(
        originalValue,
        rule,
        context,
        errors,
      );

      for (const match of ruleMatches) {
        if (this.validateReplacementContext(match, context, path)) {
          const patternMatch: PatternMatch = {
            rule,
            originalText: match.text,
            replacementText: match.replacement,
            start: match.start + (node.start || 0),
            end: match.end + (node.start || 0),
            line: context.line,
            column: context.column + match.start,
            context,
            astNode: node,
            nodePath: path,
          };

          potentialMatches.push(patternMatch);
        }
      }
    }
  }

  /**
   * Collect potential matches from template literal nodes without applying transformations
   */
  private collectTemplateMatches(
    path: NodePath<t.TemplateLiteral>,
    potentialMatches: PatternMatch[],
    originalCode: string,
    filePath: string,
    fileType: JavaScriptFileType,
    errors?: Array<{ message: string; phase: string }>,
  ): void {
    const node = path.node;
    if (!node.quasis || node.quasis.length === 0) {
      return;
    }

    const context = this.createProcessingContext(
      path,
      originalCode,
      filePath,
      fileType,
    );

    // Process each quasi (string part) of the template literal
    for (let i = 0; i < node.quasis.length; i++) {
      const quasi = node.quasis[i];
      const originalValue = quasi.value.raw || quasi.value.cooked || "";

      if (!originalValue) {
        continue;
      }

      // Collect matches from applicable rules
      for (const rule of this.getApplicableRules(context)) {
        const ruleMatches = this.findPatternMatches(
          originalValue,
          rule,
          context,
          errors,
        );

        for (const match of ruleMatches) {
          if (this.validateReplacementContext(match, context, path)) {
            const patternMatch: PatternMatch = {
              rule,
              originalText: match.text,
              replacementText: match.replacement,
              start: match.start + (quasi.start || 0),
              end: match.end + (quasi.start || 0),
              line: context.line,
              column: context.column + match.start,
              context,
              astNode: node,
              nodePath: path,
            };

            potentialMatches.push(patternMatch);
          }
        }
      }
    }
  }

  /**
   * Collect potential matches from JSX attribute nodes without applying transformations
   */
  private collectJSXAttributeMatches(
    path: NodePath<t.JSXAttribute>,
    potentialMatches: PatternMatch[],
    originalCode: string,
    filePath: string,
    fileType: JavaScriptFileType,
  ): void {
    const node = path.node;
    if (!node.value) {
      return;
    }

    const attributeName =
      node.name?.type === "JSXIdentifier" ? node.name.name : "";
    const isClassNameAttribute =
      attributeName === "className" || attributeName === "class";

    const jsxContext = {
      isJSXAttribute: true,
      attributeName,
      isClassNameAttribute,
      isJSXText: false,
    };

    const context = this.createProcessingContext(
      path,
      originalCode,
      filePath,
      fileType,
      jsxContext,
    );

    // Handle different types of JSX attribute values
    if (node.value.type === "StringLiteral") {
      this.collectJSXStringValue(node.value, potentialMatches, context, path);
    } else if (node.value.type === "JSXExpressionContainer") {
      const expression = node.value.expression;

      if (expression.type === "StringLiteral") {
        this.collectJSXStringValue(expression, potentialMatches, context, path);
      } else if (expression.type === "TemplateLiteral") {
        this.collectJSXTemplateValue(
          expression,
          potentialMatches,
          context,
          path,
        );
      } else if (expression.type === "ConditionalExpression") {
        this.collectJSXConditionalValue(
          expression,
          potentialMatches,
          context,
          path,
        );
      }
    }
  }

  /**
   * Collect potential matches from JSX text nodes without applying transformations
   */
  private collectJSXTextMatches(
    path: NodePath<t.JSXText>,
    potentialMatches: PatternMatch[],
    originalCode: string,
    filePath: string,
    fileType: JavaScriptFileType,
    errors?: Array<{ message: string; phase: string }>,
  ): void {
    const node = path.node;
    if (!node.value || typeof node.value !== "string") {
      return;
    }

    const jsxContext = {
      isJSXAttribute: false,
      attributeName: "",
      isClassNameAttribute: false,
      isJSXText: true,
    };

    const context = this.createProcessingContext(
      path,
      originalCode,
      filePath,
      fileType,
      jsxContext,
    );
    const originalValue = node.value;

    // Only process JSX text if rules don't have jsxOnly restriction (which typically applies to className)
    for (const rule of this.getApplicableRules(context)) {
      if (!rule.jsxOnly) {
        // JSX text content should not use jsxOnly rules
        const ruleMatches = this.findPatternMatches(
          originalValue,
          rule,
          context,
          errors,
        );

        for (const match of ruleMatches) {
          if (this.validateReplacementContext(match, context, path)) {
            const patternMatch: PatternMatch = {
              rule,
              originalText: match.text,
              replacementText: match.replacement,
              start: match.start + (node.start || 0),
              end: match.end + (node.start || 0),
              line: context.line,
              column: context.column + match.start,
              context,
              astNode: node,
              nodePath: path,
            };

            potentialMatches.push(patternMatch);
          }
        }
      }
    }
  }

  /**
   * Collect JSX string value matches without applying transformations
   */
  private collectJSXStringValue(
    stringNode: t.StringLiteral,
    matches: PatternMatch[],
    context: JSReplacementContext,
    attributePath: NodePath<t.JSXAttribute>,
  ): void {
    const originalValue = stringNode.value || "";

    for (const rule of this.getApplicableRules(context)) {
      const ruleMatches = this.findPatternMatches(originalValue, rule, context);

      for (const match of ruleMatches) {
        if (this.validateReplacementContext(match, context, attributePath)) {
          const patternMatch: PatternMatch = {
            rule,
            originalText: match.text,
            replacementText: match.replacement,
            start: match.start + stringNode.start!,
            end: match.end + stringNode.start!,
            line: context.line,
            column: context.column + match.start,
            context,
            astNode: stringNode,
            nodePath: attributePath,
          };

          matches.push(patternMatch);
        }
      }
    }
  }

  /**
   * Process JSX template literal values within attributes
   */
  private collectJSXTemplateValue(
    templateNode: t.TemplateLiteral,
    matches: PatternMatch[],
    context: JSReplacementContext,
    attributePath: NodePath<t.JSXAttribute>,
  ): void {
    if (!templateNode.quasis) return;

    for (let i = 0; i < templateNode.quasis.length; i++) {
      const quasi = templateNode.quasis[i];
      const originalValue = quasi.value.raw || quasi.value.cooked || "";

      if (!originalValue) continue;

      for (const rule of this.getApplicableRules(context)) {
        const ruleMatches = this.findPatternMatches(
          originalValue,
          rule,
          context,
        );

        for (const match of ruleMatches) {
          if (this.validateReplacementContext(match, context, attributePath)) {
            const patternMatch: PatternMatch = {
              rule,
              originalText: match.text,
              replacementText: match.replacement,
              start: match.start + quasi.start!,
              end: match.end + quasi.start!,
              line: context.line,
              column: context.column + match.start,
              context,
              astNode: templateNode,
              nodePath: attributePath,
            };

            matches.push(patternMatch);
          }
        }
      }
    }
  }

  /**
   * Process JSX conditional expressions in attributes
   */
  private collectJSXConditionalValue(
    conditionalNode: t.ConditionalExpression,
    matches: PatternMatch[],
    context: JSReplacementContext,
    attributePath: NodePath<t.JSXAttribute>,
  ): void {
    // Process consequent (true branch)
    if (conditionalNode.consequent.type === "StringLiteral") {
      this.collectJSXStringValue(
        conditionalNode.consequent as t.StringLiteral,
        matches,
        context,
        attributePath,
      );
    }

    // Process alternate (false branch)
    if (conditionalNode.alternate.type === "StringLiteral") {
      this.collectJSXStringValue(
        conditionalNode.alternate as t.StringLiteral,
        matches,
        context,
        attributePath,
      );
    }
  }

  /**
   * Find pattern matches in text using the given rule
   */
  private findPatternMatches(
    text: string,
    rule: JSPatternRule,
    context: JSReplacementContext,
    errors?: Array<{ message: string; phase: string }>,
  ): Array<{ text: string; replacement: string; start: number; end: number }> {
    const matches: Array<{
      text: string;
      replacement: string;
      start: number;
      end: number;
    }> = [];

    try {
      // Use global version of regex to find all matches
      const globalPattern = new RegExp(
        rule.pattern.source,
        rule.pattern.flags.includes("g")
          ? rule.pattern.flags
          : rule.pattern.flags + "g",
      );

      let match;
      while ((match = globalPattern.exec(text)) !== null) {
        const matchedText = match[0];
        const start = match.index;
        const end = start + matchedText.length;

        let replacement: string;
        if (typeof rule.replacement === "function") {
          try {
            replacement = rule.replacement(matchedText, context);
          } catch (error) {
            // Collect error for reporting
            if (errors) {
              const errorMessage =
                error instanceof Error
                  ? error.message
                  : "Replacement function error";
              errors.push({ message: errorMessage, phase: "transformation" });
            }

            // If replacement function fails, skip this match
            if (this.config.errorHandling.continueOnError) {
              continue;
            } else {
              throw error;
            }
          }
        } else {
          // Handle capture group replacements for string patterns
          replacement = rule.replacement.replace(/\$(\d+)/g, (_, groupNum) => {
            const groupIndex = parseInt(groupNum, 10);
            return match[groupIndex] || '';
          });
        }

        matches.push({
          text: matchedText,
          replacement,
          start,
          end,
        });

        // Prevent infinite loop for zero-width matches
        if (match.index === globalPattern.lastIndex) {
          globalPattern.lastIndex++;
        }
      }
    } catch (error) {
      // Collect error for reporting
      if (errors) {
        const errorMessage =
          error instanceof Error ? error.message : "Pattern matching error";
        errors.push({ message: errorMessage, phase: "transformation" });
      }

      // If the rule pattern is invalid, skip it unless error handling is strict
      if (!this.config.errorHandling.continueOnError) {
        throw error;
      }
    }

    return matches;
  }

  /**
   * Validate replacement context to prevent unwanted transformations
   */
  private validateReplacementContext(
    match: { text: string; replacement: string; start: number; end: number },
    context: JSReplacementContext,
    nodePath?: NodePath,
  ): boolean {
    // Don't replace if the replacement is the same as original
    if (match.text === match.replacement) {
      return false;
    }

    // Add context-specific validation logic
    // For example, don't replace in comments or specific node types
    if (context.nodeType === "Comment") {
      return false;
    }

    // Skip replacements in TypeScript type contexts using advanced detection
    if (context.hasTypeScript && nodePath) {
      if (this.isInTypeScriptTypeContext(nodePath)) {
        return false;
      }
    }

    // Fallback to basic parent node type checks for TypeScript contexts
    if (context.hasTypeScript && context.parentNodeType) {
      // Don't replace string literals that are USED AS types (not default values)
      // This catches cases like: className as 'text-orange-500'
      if (
        context.nodeType === "StringLiteral" &&
        context.parentNodeType === "TSLiteralType"
      ) {
        return false;
      }

      // Don't replace in TSTypeReference or other pure type contexts
      if (
        context.parentNodeType === "TSTypeReference" ||
        context.parentNodeType === "TSTypeQuery"
      ) {
        return false;
      }

      // Allow replacements in default values and regular string literals even in TS files
      // The key insight: we want to replace string LITERALS used as VALUES, not as TYPES
    }

    return true;
  }

  /**
   * Check if a string literal is in a TypeScript type context using NodePath
   */
  private isInTypeScriptTypeContext(nodePath: NodePath): boolean {
    // Check immediate parent first
    const immediateParent = nodePath.parent;
    const immediateParentType = immediateParent?.type;

    // Check for direct type contexts
    if (
      immediateParentType === "TSLiteralType" ||
      immediateParentType === "TSTypeParameter" ||
      immediateParentType === "TSTypeReference" ||
      immediateParentType === "TSTypeQuery" ||
      immediateParentType === "TSUnionType" ||
      immediateParentType === "TSIntersectionType" ||
      immediateParentType === "TSTypeAliasDeclaration"
    ) {
      return true;
    }

    // Walk up the AST to check for TypeScript type contexts
    let current = nodePath.parent;
    let depth = 0;
    const maxDepth = 5; // Prevent infinite loops

    while (current && depth < maxDepth) {
      const parentType = current.type;

      // Check for type parameter defaults
      // interface Props<T extends string = 'text-purple-500'> - should NOT be replaced
      if (parentType === "TSTypeParameter") {
        return true;
      }

      // Check for type assertion contexts (right side of 'as')
      // className as 'text-orange-500' - should NOT be replaced
      if (parentType === "TSAsExpression" || parentType === "TSTypeAssertion") {
        // For TSAsExpression: { expression, typeAnnotation }
        // For TSTypeAssertion: { expression, typeAnnotation }
        const asExpression = current as any;
        
        // Walk back down to see if our original node is in the type annotation
        if (this.isNodeInTypeAnnotation(nodePath.node, asExpression.typeAnnotation)) {
          return true;
        }
      }

      // Move up the tree
      current = current.parent;
      depth++;
    }

    return false;
  }

  /**
   * Check if a node is contained within a type annotation
   */
  private isNodeInTypeAnnotation(targetNode: any, typeAnnotation: any): boolean {
    if (!typeAnnotation) return false;
    
    // Direct match
    if (typeAnnotation === targetNode) return true;
    
    // Check if wrapped in TSLiteralType
    if (typeAnnotation.type === "TSLiteralType" && typeAnnotation.literal === targetNode) {
      return true;
    }
    
    return false;
  }
}

/**
 * Utility functions for common JavaScript pattern replacement tasks
 */
export class JSRewriterUtils {
  /**
   * Create a rule for replacing Tailwind class names in className attributes
   */
  static createClassNameRule(
    id: string,
    pattern: RegExp,
    replacement:
      | string
      | ((match: string, context: JSReplacementContext) => string),
    priority = 100,
  ): JSPatternRule {
    return {
      id,
      description: `Replace className patterns: ${pattern.source}`,
      pattern,
      replacement,
      priority,
      enabled: true,
      jsxOnly: true,
      validator: (context) => context.nodeType === "JSXAttribute",
    };
  }

  /**
   * Create a rule for replacing class names in template literals
   */
  static createTemplateLiteralRule(
    id: string,
    pattern: RegExp,
    replacement:
      | string
      | ((match: string, context: JSReplacementContext) => string),
    priority = 100,
  ): JSPatternRule {
    return {
      id,
      description: `Replace template literal patterns: ${pattern.source}`,
      pattern,
      replacement,
      priority,
      enabled: true,
      templateLiteralsOnly: true,
      validator: (context) => context.nodeType === "TemplateLiteral",
    };
  }

  /**
   * Create a rule for any string literal replacement
   */
  static createStringLiteralRule(
    id: string,
    pattern: RegExp,
    replacement:
      | string
      | ((match: string, context: JSReplacementContext) => string),
    priority = 100,
  ): JSPatternRule {
    return {
      id,
      description: `Replace string literal patterns: ${pattern.source}`,
      pattern,
      replacement,
      priority,
      enabled: true,
      validator: (context) => context.nodeType === "StringLiteral",
    };
  }

  /**
   * Validate a pattern rule
   */
  static validateRule(rule: JSPatternRule): string[] {
    const errors: string[] = [];

    if (!rule.id || rule.id.trim() === "") {
      errors.push("Rule ID is required");
    }

    if (!rule.pattern) {
      errors.push("Pattern is required");
    }

    if (rule.priority < 0) {
      errors.push("Priority must be non-negative");
    }

    if (rule.fileTypes && rule.fileTypes.length === 0) {
      errors.push("File types array cannot be empty if provided");
    }

    return errors;
  }

  /**
   * Merge multiple pattern rules with conflict resolution
   */
  static mergeRules(
    rules: JSPatternRule[],
    strategy: "priority" | "merge" = "priority",
  ): JSPatternRule[] {
    if (strategy === "priority") {
      return rules.sort((a, b) => b.priority - a.priority);
    }

    // Merge strategy implementation
    const merged = new Map<string, JSPatternRule>();

    for (const rule of rules) {
      const existing = merged.get(rule.id);
      if (!existing) {
        merged.set(rule.id, rule);
      } else {
        // Merge logic: higher priority wins, but combine patterns if possible
        merged.set(
          rule.id,
          existing.priority >= rule.priority ? existing : rule,
        );
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.priority - a.priority);
  }
}

/**
 * Factory for creating pre-configured JSRewriter instances
 */
export class JSRewriterFactory {
  /**
   * Create a JSRewriter instance optimized for React/JSX files
   */
  static createReactRewriter(
    customConfig: Partial<JSRewriterConfig> = {},
  ): JSRewriter {
    const config: Partial<JSRewriterConfig> = {
      ...customConfig,
      parserOptions: {
        sourceType: "module",
        plugins: ["jsx", "typescript", "decorators-legacy", "classProperties"],
        ...customConfig.parserOptions,
      },
    };

    return new JSRewriter(config);
  }

  /**
   * Create a JSRewriter instance optimized for TypeScript files
   */
  static createTypeScriptRewriter(
    customConfig: Partial<JSRewriterConfig> = {},
  ): JSRewriter {
    const config: Partial<JSRewriterConfig> = {
      ...customConfig,
      parserOptions: {
        sourceType: "module",
        plugins: ["typescript", "decorators-legacy", "classProperties"],
        ...customConfig.parserOptions,
      },
    };

    return new JSRewriter(config);
  }

  /**
   * Create a JSRewriter instance with performance optimizations for large codebases
   */
  static createHighPerformanceRewriter(
    customConfig: Partial<JSRewriterConfig> = {},
  ): JSRewriter {
    const config: Partial<JSRewriterConfig> = {
      ...customConfig,
      performance: {
        enableCaching: true,
        maxCacheSize: 500,
        enableParallelProcessing: true,
        maxConcurrency: 8,
        memoryLimits: {
          maxMemoryPerFile: 50,
          maxTotalMemory: 500,
        },
        ...customConfig.performance,
      },
    };

    return new JSRewriter(config);
  }
}

// Export default instance for convenience
export default JSRewriter;
