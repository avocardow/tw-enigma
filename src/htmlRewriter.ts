/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as cheerio from "cheerio";
import { AnyNode } from "domhandler";
import * as fs from "fs/promises";
import { z } from "zod";
import type { NameGenerationResult } from "./nameGeneration.ts";

/**
 * Configuration options for HTML rewriting operations
 */
export const HtmlRewriteOptionsSchema = z.object({
  // File handling options
  createBackup: z.boolean().default(true),
  backupSuffix: z.string().default(".backup"),
  preserveComments: z.boolean().default(true),
  preserveWhitespace: z.boolean().default(true),

  // Safety options
  validateOutput: z.boolean().default(true),
  maxFileSize: z
    .number()
    .min(1)
    .default(10 * 1024 * 1024), // 10MB
  timeout: z.number().min(1).default(10000), // 10 seconds
  dryRun: z.boolean().default(false), // Test mode without actual changes

  // HTML parsing options
  xmlMode: z.boolean().default(false),
  decodeEntities: z.boolean().default(true),
  lowerCaseAttributeNames: z.boolean().default(false),
  recognizeSelfClosing: z.boolean().default(true),

  // Pattern matching options
  caseSensitive: z.boolean().default(true),
  wholeWordsOnly: z.boolean().default(false),
  preserveOriginalPatterns: z.boolean().default(false), // Keep original alongside new

  // Output formatting
  formatOutput: z.boolean().default(true),
  indentSize: z.number().min(0).max(8).default(2),
  useSpaces: z.boolean().default(true),

  // Performance options
  enableCaching: z.boolean().default(true),
  batchSize: z.number().min(1).default(100),

  // Logging and debugging
  verbose: z.boolean().default(false),
  logChanges: z.boolean().default(true),
  includeSourceMaps: z.boolean().default(false),
});

export type HtmlRewriteOptions = z.infer<typeof HtmlRewriteOptionsSchema>;

/**
 * Pattern match results and statistics
 */
export interface PatternMatchResult {
  pattern: HtmlPattern;
  matches: Array<{
    element: cheerio.Cheerio<AnyNode>;
    originalValue: string;
    matchedPart: string;
    replacement: string;
    context: {
      tagName: string;
      position: number;
      parentSelector?: string;
    };
  }>;
  performance: {
    matchTime: number;
    elementCount: number;
  };
}

/**
 * Advanced pattern matching condition
 */
export interface PatternCondition {
  type: "attribute" | "text" | "tag" | "parent" | "sibling" | "custom";
  selector?: string;
  attribute?: string;
  value?: string | RegExp;
  operator?:
    | "equals"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "matches"
    | "exists";
  negate?: boolean;
  customCheck?: (
    element: cheerio.Cheerio<AnyNode>,
    $: cheerio.CheerioAPI,
  ) => boolean;
}

/**
 * Pattern set for batch operations
 */
export interface PatternSet {
  id: string;
  name: string;
  description?: string;
  patterns: HtmlPattern[];
  enabled: boolean;
  priority: number;
  executeInOrder: boolean;
  stopOnFirstMatch: boolean;
  conditions?: PatternCondition[];
}

/**
 * Enhanced HTML pattern with advanced matching capabilities
 */
export interface HtmlPattern {
  id: string;
  name: string;
  description?: string;

  // Basic matching
  selector: string;
  attribute: string;
  pattern: string | RegExp;
  replacement:
    | string
    | ((
        match: string,
        element: cheerio.Cheerio<AnyNode>,
        context: any,
      ) => string);

  // Advanced matching
  conditions?: PatternCondition[];
  caseSensitive?: boolean;
  wholeWordOnly?: boolean;
  multipleMatches?: boolean;

  // Replacement options
  preserveCase?: boolean;
  escapeReplacement?: boolean;

  // Control
  priority: number;
  enabled: boolean;
  runOnce?: boolean;
  maxMatches?: number;

  // Context and validation
  tags?: string[];
  excludeTags?: string[];
  parentSelector?: string;
  excludeParentSelector?: string;

  // Performance
  timeout?: number;
  cacheKey?: string;
}

/**
 * Result of a single pattern replacement operation
 */
export interface PatternReplacement {
  patternId: string;
  elementSelector: string;
  originalValue: string;
  newValue: string;
  position: {
    line?: number;
    column?: number;
    index: number;
  };
  metadata: {
    tagName: string;
    attributes: Record<string, string>;
    depth: number;
    hasConflicts: boolean;
    appliedAt: Date;
  };
}

/**
 * Complete result of HTML rewriting operation
 */
export interface HtmlRewriteResult {
  success: boolean;
  originalHtml: string;
  modifiedHtml: string;
  appliedReplacements: PatternReplacement[];
  skippedReplacements: Array<{
    patternId: string;
    reason: string;
    elementSelector: string;
  }>;
  conflicts: Array<{
    patternIds: string[];
    elementSelector: string;
    resolution: "highest-priority" | "first-match" | "manual-review";
    chosenPatternId?: string;
  }>;
  metadata: {
    source: string;
    processedAt: Date;
    processingTime: number;
    fileSize?: number;
    backupPath?: string;
    totalElements: number;
    modifiedElements: number;
    errors: string[];
    warnings: string[];
  };
  statistics: {
    patternStats: Map<
      string,
      {
        attempts: number;
        successes: number;
        failures: number;
        conflicts: number;
      }
    >;
    elementStats: {
      totalProcessed: number;
      totalModified: number;
      averageDepth: number;
      tagDistribution: Map<string, number>;
    };
    performanceStats: {
      parseTime: number;
      processingTime: number;
      serializationTime: number;
      totalTime: number;
    };
  };
}

/**
 * Configuration for file backup operations
 */
export interface BackupConfig {
  enabled: boolean;
  directory: string;
  suffix: string;
  maxBackups: number;
  compressOld: boolean;
  retentionDays: number;
}

/**
 * Cache for pattern matching and element tracking
 */
export interface RewriteCache {
  parsedPatterns: Map<string, { compiled: RegExp; metadata: any }>;
  elementCache: Map<string, cheerio.Cheerio<any>>;
  conflictCache: Map<string, string[]>; // element -> conflicting pattern IDs
  performanceCache: Map<string, number>; // operation -> duration
  lastCleared: Date;
}

/**
 * Custom error classes for HTML rewriting operations
 */
export class HtmlRewriteError extends Error {
  source?: string;
  operation?: string;
  cause?: Error;

  constructor(
    message: string,
    source?: string,
    operation?: string,
    cause?: Error,
  ) {
    super(message);
    this.name = "HtmlRewriteError";
    this.source = source;
    this.operation = operation;
    this.cause = cause;
  }
}

export class PatternValidationError extends HtmlRewriteError {
  patternId: string;
  validationErrors: string[];

  constructor(
    message: string,
    patternId: string,
    validationErrors: string[],
    cause?: Error,
  ) {
    super(message, undefined, "pattern-validation", cause);
    this.name = "PatternValidationError";
    this.patternId = patternId;
    this.validationErrors = validationErrors;
  }
}

export class BackupError extends HtmlRewriteError {
  filePath: string;
  backupPath?: string;

  constructor(
    message: string,
    filePath: string,
    backupPath?: string,
    cause?: Error,
  ) {
    super(message, filePath, "backup", cause);
    this.name = "BackupError";
    this.filePath = filePath;
    this.backupPath = backupPath;
  }
}

export class ConflictResolutionError extends HtmlRewriteError {
  conflictingPatterns: string[];
  elementSelector: string;

  constructor(
    message: string,
    conflictingPatterns: string[],
    elementSelector: string,
    cause?: Error,
  ) {
    super(message, undefined, "conflict-resolution", cause);
    this.name = "ConflictResolutionError";
    this.conflictingPatterns = conflictingPatterns;
    this.elementSelector = elementSelector;
  }
}

export class HtmlValidationError extends HtmlRewriteError {
  validationErrors: string[];
  htmlFragment?: string;

  constructor(
    message: string,
    validationErrors: string[],
    htmlFragment?: string,
    cause?: Error,
  ) {
    super(message, undefined, "html-validation", cause);
    this.name = "HtmlValidationError";
    this.validationErrors = validationErrors;
    this.htmlFragment = htmlFragment;
  }
}

export interface FormatPreservationOptions {
  preserveWhitespace: boolean;
  preserveIndentation: boolean;
  preserveComments: boolean;
  preserveEmptyLines: boolean;
  indentationStyle: "spaces" | "tabs";
  indentationSize: number;
  lineEndings: "lf" | "crlf" | "auto";
  trimTrailingWhitespace: boolean;
}

export interface FormatAnalysis {
  indentationStyle: "spaces" | "tabs" | "mixed" | "none";
  indentationSize: number;
  lineEndings: "lf" | "crlf" | "mixed";
  hasTrailingWhitespace: boolean;
  preservedWhitespace: Map<string, string>; // element selector -> whitespace
  preservedComments: Array<{
    content: string;
    position: number;
    type: "before" | "after" | "inline";
  }>;
  originalFormatting: {
    totalLines: number;
    emptyLines: number[];
    indentationMap: Map<number, string>; // line number -> indentation
  };
}

export interface HtmlRewriterIntegration {
  fileDiscovery?: any; // From fileDiscovery.ts
  nameGeneration?: any; // From nameGeneration.ts
  cssGeneration?: any; // From cssGeneration.ts
  config?: any; // From config.ts
}

export interface BatchOperationOptions {
  concurrency: number;
  continueOnError: boolean;
  progressCallback?: (
    processed: number,
    total: number,
    current: string,
  ) => void;
  errorCallback?: (file: string, error: Error) => void;
  dryRun: boolean;
  createBackups: boolean;
  validateResults: boolean;
}

export interface BatchOperationResult {
  processedFiles: string[];
  successfulFiles: string[];
  failedFiles: Array<{ file: string; error: string }>;
  totalTime: number;
  statistics: {
    totalPatterns: number;
    totalReplacements: number;
    totalConflicts: number;
    averageProcessingTime: number;
  };
}

export interface FileOperationOptions extends Partial<HtmlRewriteOptions> {
  encoding?: BufferEncoding;
  overwrite?: boolean;
  preservePermissions?: boolean;
  createBackup?: boolean;
  backupSuffix?: string;
  validateBeforeWrite?: boolean;
  atomic?: boolean; // Use atomic writes (write to temp file then rename)
}

/**
 * Main HTML rewriter class that handles pattern-based replacements
 */
export class HtmlRewriter {
  private options: HtmlRewriteOptions;
  private patterns: Map<string, HtmlPattern> = new Map();
  private patternSets: Map<string, PatternSet> = new Map();
  private cache: RewriteCache;
  private nameMapping?: Map<string, string>; // For integration with name generation
  private formatPreservation: FormatPreservationOptions;
  private formatAnalysis?: FormatAnalysis;
  private integration?: HtmlRewriterIntegration;

  constructor(options: Partial<HtmlRewriteOptions> = {}) {
    this.options = HtmlRewriteOptionsSchema.parse({
      validateOutput: true,
      preserveFormatting: true,
      enableCache: true,
      maxCacheSize: 1000,
      timeout: 30000,
      backup: {
        enabled: true,
        directory: ".backups",
        suffix: ".backup",
        maxBackups: 10,
        compressOld: false,
        retentionDays: 30,
      },
      ...options,
    });
    this.cache = this.createCache();
    this.formatPreservation = {
      preserveWhitespace: this.options.preserveWhitespace,
      preserveIndentation: this.options.preserveWhitespace,
      preserveComments: this.options.preserveComments,
      preserveEmptyLines: this.options.preserveWhitespace,
      indentationStyle: "spaces",
      indentationSize: 2,
      lineEndings: "auto",
      trimTrailingWhitespace: false,
    };
  }

  /**
   * Set the name mapping from the name generation system
   */
  setNameMapping(
    nameMapping: Map<string, string> | NameGenerationResult,
  ): void {
    if (nameMapping instanceof Map) {
      this.nameMapping = nameMapping;
    } else {
      this.nameMapping = nameMapping.nameMap;
    }
  }

  /**
   * Add a pattern for HTML rewriting
   */
  addPattern(pattern: HtmlPattern): void {
    const validationResult = this.validatePattern(pattern);
    if (!validationResult.valid) {
      throw new PatternValidationError(
        `Invalid pattern '${pattern.id}': ${validationResult.errors.join(", ")}`,
        pattern.id,
        validationResult.errors,
      );
    }

    this.patterns.set(pattern.id, pattern);
    this.clearCache();
  }

  /**
   * Add multiple patterns at once
   */
  addPatterns(patterns: HtmlPattern[]): void {
    for (const pattern of patterns) {
      this.addPattern(pattern);
    }
  }

  /**
   * Remove a pattern by ID
   */
  removePattern(patternId: string): boolean {
    const removed = this.patterns.delete(patternId);
    if (removed) {
      this.clearCache();
    }
    return removed;
  }

  /**
   * Get all registered patterns
   */
  getPatterns(): HtmlPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Rewrite HTML string using registered patterns
   */
  async rewriteHtml(
    html: string,
    source: string = "string",
  ): Promise<HtmlRewriteResult> {
    const startTime = Date.now();
    const metadata = {
      source,
      processedAt: new Date(),
      processingTime: 0,
      totalElements: 0,
      modifiedElements: 0,
      errors: [] as string[],
      warnings: [] as string[],
    };

    const statistics = {
      patternStats: new Map<string, any>(),
      elementStats: {
        totalProcessed: 0,
        totalModified: 0,
        averageDepth: 0,
        tagDistribution: new Map<string, number>(),
      },
      performanceStats: {
        parseTime: 0,
        processingTime: 0,
        serializationTime: 0,
        totalTime: 0,
      },
    };

    try {
      // Initialize pattern statistics
      for (const patternId of this.patterns.keys()) {
        statistics.patternStats.set(patternId, {
          attempts: 0,
          successes: 0,
          failures: 0,
          conflicts: 0,
        });
      }

      // Analyze format for preservation
      this.formatAnalysis = this.analyzeHtmlFormat(html);

      // Parse HTML
      const parseStart = Date.now();
      const $ = this.loadHtml(html);
      statistics.performanceStats.parseTime = Date.now() - parseStart;

      // Preserve element whitespace if format preservation is enabled
      if (this.formatPreservation.preserveWhitespace) {
        this.preserveElementWhitespace($);
      }

      // Process replacements
      const processingStart = Date.now();
      const result = await this.processReplacements($, source);
      statistics.performanceStats.processingTime = Date.now() - processingStart;

      // Serialize HTML
      const serializeStart = Date.now();
      let modifiedHtml = this.serializeHtml($);
      statistics.performanceStats.serializationTime =
        Date.now() - serializeStart;

      // Restore formatting if preservation is enabled
      if (
        this.formatPreservation.preserveWhitespace ||
        this.formatPreservation.preserveIndentation
      ) {
        modifiedHtml = this.restoreFormatting(modifiedHtml);
      }

      // Validate output if enabled
      if (this.options.validateOutput && !this.options.dryRun) {
        this.validateHtmlOutput(modifiedHtml);
      }

      statistics.performanceStats.totalTime = Date.now() - startTime;
      metadata.processingTime = statistics.performanceStats.totalTime;

      return {
        success: true,
        originalHtml: html,
        modifiedHtml: this.options.dryRun ? html : modifiedHtml,
        appliedReplacements: result.appliedReplacements || [],
        skippedReplacements: result.skippedReplacements || [],
        conflicts: result.conflicts || [],
        metadata: {
          ...metadata,
          ...result.metadata,
        },
        statistics: result.statistics || statistics,
      };
    } catch (error) {
      metadata.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      metadata.processingTime = Date.now() - startTime;

      throw new HtmlRewriteError(
        `Failed to rewrite HTML: ${error instanceof Error ? error.message : String(error)}`,
        source,
        "rewrite",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Rewrite HTML file using registered patterns
   */
  async rewriteFile(filePath: string): Promise<HtmlRewriteResult> {
    try {
      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.options.maxFileSize) {
        throw new HtmlRewriteError(
          `File size (${stats.size} bytes) exceeds maximum allowed size (${this.options.maxFileSize} bytes)`,
          filePath,
          "file-size-check",
        );
      }

      // Create backup if enabled
      let backupPath: string | undefined;
      if (this.options.createBackup && !this.options.dryRun) {
        backupPath = await this.createBackup(filePath);
      }

      // Read file
      const html = await fs.readFile(filePath, "utf-8");

      // Process HTML
      const result = await this.rewriteHtml(html, filePath);

      // Write modified HTML back to file (unless dry run)
      if (!this.options.dryRun) {
        await fs.writeFile(filePath, result.modifiedHtml, "utf-8");
      }

      // Add backup path to metadata
      if (backupPath) {
        result.metadata.backupPath = backupPath;
      }

      result.metadata.fileSize = stats.size;

      return result;
    } catch (error) {
      if (error instanceof HtmlRewriteError) {
        throw error;
      }

      throw new HtmlRewriteError(
        `Failed to rewrite file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        "file-rewrite",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Process multiple files in batch
   */
  async rewriteFiles(filePaths: string[]): Promise<HtmlRewriteResult[]> {
    const results: HtmlRewriteResult[] = [];
    const batchSize = this.options.batchSize;

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchPromises = batch.map((filePath) => this.rewriteFile(filePath));

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            // Create error result for failed files
            results.push({
              success: false,
              originalHtml: "",
              modifiedHtml: "",
              appliedReplacements: [],
              skippedReplacements: [],
              conflicts: [],
              metadata: {
                source: "unknown",
                processedAt: new Date(),
                processingTime: 0,
                totalElements: 0,
                modifiedElements: 0,
                errors: [
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
                ],
                warnings: [],
              },
              statistics: {
                patternStats: new Map(),
                elementStats: {
                  totalProcessed: 0,
                  totalModified: 0,
                  averageDepth: 0,
                  tagDistribution: new Map(),
                },
                performanceStats: {
                  parseTime: 0,
                  processingTime: 0,
                  serializationTime: 0,
                  totalTime: 0,
                },
              },
            });
          }
        }
      } catch (error) {
        throw new HtmlRewriteError(
          `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
          `batch-${i / batchSize}`,
          "batch-processing",
          error instanceof Error ? error : undefined,
        );
      }
    }

    return results;
  }

  /**
   * Load HTML with cheerio using configured options
   */
  private loadHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html, {
      xml: {
        xmlMode: this.options.xmlMode,
        decodeEntities: this.options.decodeEntities,
        lowerCaseAttributeNames: this.options.lowerCaseAttributeNames,
        recognizeSelfClosing: this.options.recognizeSelfClosing,
        withStartIndices: this.options.includeSourceMaps,
        withEndIndices: this.options.includeSourceMaps,
      },
    });
  }

  /**
   * Process all pattern replacements on the loaded HTML
   */
  private async processReplacements(
    $: cheerio.CheerioAPI,
    source: string,
  ): Promise<Partial<HtmlRewriteResult>> {
    const startTime = Date.now();
    const appliedReplacements: PatternReplacement[] = [];
    const skippedReplacements: Array<{
      patternId: string;
      reason: string;
      elementSelector: string;
    }> = [];
    const conflicts: Array<{
      patternIds: string[];
      elementSelector: string;
      resolution: "highest-priority" | "first-match" | "manual-review";
      chosenPatternId?: string;
    }> = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get enabled patterns sorted by priority
    const enabledPatterns = Array.from(this.patterns.values())
      .filter((pattern) => pattern.enabled)
      .sort((a, b) => b.priority - a.priority);

    if (enabledPatterns.length === 0) {
      return {
        appliedReplacements,
        skippedReplacements,
        conflicts,
        metadata: {
          source,
          processedAt: new Date(),
          processingTime: Date.now() - startTime,
          totalElements: $("*").length,
          modifiedElements: 0,
          errors,
          warnings,
        },
      };
    }

    // Track elements that have been modified to detect conflicts
    const elementModifications = new Map<
      string,
      Array<{ patternId: string; originalValue: string; newValue: string }>
    >();
    const patternStats = new Map<
      string,
      {
        attempts: number;
        successes: number;
        failures: number;
        conflicts: number;
      }
    >();

    // Initialize pattern stats
    for (const pattern of enabledPatterns) {
      patternStats.set(pattern.id, {
        attempts: 0,
        successes: 0,
        failures: 0,
        conflicts: 0,
      });
    }

    // Process each pattern
    for (const pattern of enabledPatterns) {
      try {
        // Skip if pattern has run once and is configured to run only once
        if (
          pattern.runOnce &&
          appliedReplacements.some((r) => r.patternId === pattern.id)
        ) {
          continue;
        }

        // Find elements matching the pattern selector
        const elements = $(pattern.selector);

        if (elements.length === 0) {
          continue;
        }

        // Process each matching element
        elements.each((index, el) => {
          const element = $(el);
          const elementId = this.generateElementId(element, index);
          const stats = patternStats.get(pattern.id)!;
          stats.attempts++;

          try {
            // Check if element matches all pattern conditions
            if (!this.elementMatchesPattern($, element, pattern)) {
              return; // Continue to next element
            }

            // Get current attribute value
            const currentValue = element.attr(pattern.attribute) || "";
            if (!currentValue) {
              return; // Continue to next element
            }

            // Find pattern matches in the attribute value
            const matches = this.matchPattern(currentValue, pattern);
            if (matches.length === 0) {
              return; // Continue to next element
            }

            // Apply replacements for each match
            let modifiedValue = currentValue;
            let hasModifications = false;
            const elementReplacements: PatternReplacement[] = [];

            for (const match of matches) {
              try {
                // Generate replacement value
                const replacement = this.generateReplacement(
                  match.matched,
                  pattern,
                  element,
                  {
                    tagName:
                      (element.prop("tagName") as string)?.toLowerCase() ||
                      "unknown",
                    position: index,
                    parentSelector:
                      (element.parent().prop("tagName") as string) || undefined,
                  },
                );

                // Check for conflicts with previous modifications
                const elementKey = elementId;
                const existingMods = elementModifications.get(elementKey) || [];

                // Detect conflicts
                const conflictingMods = existingMods.filter(
                  (mod) =>
                    mod.originalValue.includes(match.matched) ||
                    modifiedValue.includes(match.matched),
                );

                if (conflictingMods.length > 0) {
                  // Handle conflict based on priority
                  const conflictingPatternIds = conflictingMods.map(
                    (mod) => mod.patternId,
                  );
                  const allConflictingIds = [
                    ...conflictingPatternIds,
                    pattern.id,
                  ];

                  // Check if this is a higher priority pattern
                  const currentPatternPriority = pattern.priority;
                  const hasHigherPriority = conflictingMods.every((mod) => {
                    const conflictingPattern = this.patterns.get(mod.patternId);
                    return conflictingPattern
                      ? currentPatternPriority > conflictingPattern.priority
                      : true;
                  });

                  if (hasHigherPriority) {
                    // Apply this pattern and record conflict resolution
                    conflicts.push({
                      patternIds: allConflictingIds,
                      elementSelector: this.generateElementSelector(element),
                      resolution: "highest-priority",
                      chosenPatternId: pattern.id,
                    });

                    // Update stats for conflicting patterns
                    for (const conflictingId of conflictingPatternIds) {
                      const conflictStats = patternStats.get(conflictingId);
                      if (conflictStats) conflictStats.conflicts++;
                    }
                  } else {
                    // Skip this pattern due to lower priority
                    skippedReplacements.push({
                      patternId: pattern.id,
                      reason: `Conflict with higher priority pattern(s): ${conflictingPatternIds.join(", ")}`,
                      elementSelector: this.generateElementSelector(element),
                    });
                    stats.conflicts++;
                    return; // Continue to next element
                  }
                }

                // Apply the replacement
                const newValue = modifiedValue.replace(
                  match.matched,
                  replacement,
                );

                if (newValue !== modifiedValue) {
                  // Create replacement record
                  const replacementRecord: PatternReplacement = {
                    patternId: pattern.id,
                    elementSelector: this.generateElementSelector(element),
                    originalValue: modifiedValue,
                    newValue: newValue,
                    position: {
                      index: match.index,
                    },
                    metadata: {
                      tagName:
                        (element.prop("tagName") as string)?.toLowerCase() ||
                        "unknown",
                      attributes: this.getElementAttributes(element),
                      depth: this.getElementDepth(element),
                      hasConflicts: conflictingMods.length > 0,
                      appliedAt: new Date(),
                    },
                  };

                  elementReplacements.push(replacementRecord);
                  modifiedValue = newValue;
                  hasModifications = true;

                  // Track modification
                  if (!elementModifications.has(elementKey)) {
                    elementModifications.set(elementKey, []);
                  }
                  elementModifications.get(elementKey)!.push({
                    patternId: pattern.id,
                    originalValue: currentValue,
                    newValue: newValue,
                  });
                }

                // Stop after first match if not configured for multiple matches
                if (!pattern.multipleMatches) {
                  break;
                }

                // Check max matches limit
                if (
                  pattern.maxMatches &&
                  elementReplacements.length >= pattern.maxMatches
                ) {
                  break;
                }
              } catch (matchError) {
                errors.push(
                  `Error processing match for pattern '${pattern.id}': ${matchError instanceof Error ? matchError.message : String(matchError)}`,
                );
                stats.failures++;
              }
            }

            // Apply modifications to the DOM if any were made
            if (hasModifications) {
              element.attr(pattern.attribute, modifiedValue);
              appliedReplacements.push(...elementReplacements);
              stats.successes++;
            }
          } catch (elementError) {
            errors.push(
              `Error processing element for pattern '${pattern.id}': ${elementError instanceof Error ? elementError.message : String(elementError)}`,
            );
            stats.failures++;
          }
        });
      } catch (patternError) {
        errors.push(
          `Error processing pattern '${pattern.id}': ${patternError instanceof Error ? patternError.message : String(patternError)}`,
        );
        const stats = patternStats.get(pattern.id);
        if (stats) stats.failures++;
      }
    }

    // Calculate statistics
    const totalElements = $("*").length;
    const modifiedElements = appliedReplacements.length; // Each replacement represents one modified element
    const processingTime = Date.now() - startTime;

    return {
      appliedReplacements,
      skippedReplacements,
      conflicts,
      metadata: {
        source,
        processedAt: new Date(),
        processingTime,
        totalElements,
        modifiedElements,
        errors,
        warnings,
      },
      statistics: {
        patternStats,
        elementStats: {
          totalProcessed: totalElements,
          totalModified: modifiedElements,
          averageDepth: this.calculateAverageDepth($),
          tagDistribution: this.calculateTagDistribution($),
        },
        performanceStats: {
          parseTime: 0, // Will be set by caller
          processingTime,
          serializationTime: 0, // Will be set by caller
          totalTime: processingTime,
        },
      },
    };
  }

  /**
   * Rewrite HTML string using registered patterns
   */
  private serializeHtml($: cheerio.CheerioAPI): string {
    if (this.options.formatOutput) {
      // Basic formatting - will be enhanced in Step 5
      return $.html();
    }
    return $.html();
  }

  /**
   * Validate pattern configuration
   */
  private validatePattern(pattern: HtmlPattern): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!pattern.id || pattern.id.trim() === "") {
      errors.push("Pattern ID is required");
    }

    if (!pattern.selector || pattern.selector.trim() === "") {
      errors.push("Selector is required");
    }

    if (!pattern.attribute || pattern.attribute.trim() === "") {
      errors.push("Attribute is required");
    }

    if (!pattern.pattern) {
      errors.push("Pattern is required");
    }

    if (!pattern.replacement) {
      errors.push("Replacement is required");
    }

    if (typeof pattern.priority !== "number" || pattern.priority < 0) {
      errors.push("Priority must be a non-negative number");
    }

    // Test CSS selector syntax
    try {
      cheerio.load("<div></div>")(pattern.selector);
    } catch (error) {
      errors.push(
        `Invalid CSS selector: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Test regex pattern if it's a regex
    if (pattern.pattern instanceof RegExp) {
      try {
        "test".match(pattern.pattern);
      } catch (error) {
        errors.push(
          `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create backup of original file
   */
  private async createBackup(filePath: string): Promise<string> {
    try {
      const backupPath = `${filePath}${this.options.backupSuffix}`;
      await fs.copyFile(filePath, backupPath);
      return backupPath;
    } catch (error) {
      throw new BackupError(
        `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate HTML output integrity
   */
  private validateHtmlOutput(html: string): void {
    try {
      const $ = cheerio.load(html);
      // Basic validation - ensure HTML can be parsed
      $.html();
    } catch (error) {
      throw new HtmlValidationError(
        `Invalid HTML output: ${error instanceof Error ? error.message : String(error)}`,
        [error instanceof Error ? error.message : String(error)],
        html.slice(0, 500),
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Create cache instance
   */
  private createCache(): RewriteCache {
    return {
      parsedPatterns: new Map(),
      elementCache: new Map(),
      conflictCache: new Map(),
      performanceCache: new Map(),
      lastCleared: new Date(),
    };
  }

  /**
   * Clear internal caches
   */
  private clearCache(): void {
    this.cache.parsedPatterns.clear();
    this.cache.elementCache.clear();
    this.cache.conflictCache.clear();
    this.cache.performanceCache.clear();
    this.cache.lastCleared = new Date();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    parsedPatterns: number;
    elementCache: number;
    conflictCache: number;
    performanceCache: number;
    lastCleared: Date;
  } {
    return {
      parsedPatterns: this.cache.parsedPatterns.size,
      elementCache: this.cache.elementCache.size,
      conflictCache: this.cache.conflictCache.size,
      performanceCache: this.cache.performanceCache.size,
      lastCleared: this.cache.lastCleared,
    };
  }

  /**
   * Get rewriter statistics
   */
  getStats(): {
    patternsCount: number;
    enabledPatternsCount: number;
    options: HtmlRewriteOptions;
  } {
    const patterns = Array.from(this.patterns.values());
    return {
      patternsCount: patterns.length,
      enabledPatternsCount: patterns.filter((p) => p.enabled).length,
      options: this.options,
    };
  }

  // ================== STEP 2: ADVANCED PATTERN MATCHING SYSTEM ==================

  /**
   * Add a pattern set for batch operations
   */
  addPatternSet(patternSet: PatternSet): void {
    if (!patternSet.id) {
      throw new PatternValidationError("Pattern set ID is required", "", [
        "Missing pattern set ID",
      ]);
    }

    if (this.patternSets.has(patternSet.id)) {
      throw new PatternValidationError(
        `Pattern set '${patternSet.id}' already exists`,
        patternSet.id,
        ["Duplicate pattern set ID"],
      );
    }

    // Validate all patterns in the set
    const errors: string[] = [];
    for (const pattern of patternSet.patterns) {
      const validation = this.validatePattern(pattern);
      if (!validation.valid) {
        errors.push(
          ...validation.errors.map((err) => `Pattern '${pattern.id}': ${err}`),
        );
      }
    }

    if (errors.length > 0) {
      throw new PatternValidationError(
        `Pattern set validation failed`,
        patternSet.id,
        errors,
      );
    }

    this.patternSets.set(patternSet.id, patternSet);
  }

  /**
   * Remove a pattern set
   */
  removePatternSet(patternSetId: string): boolean {
    return this.patternSets.delete(patternSetId);
  }

  /**
   * Get all pattern sets
   */
  getPatternSets(): PatternSet[] {
    return Array.from(this.patternSets.values());
  }

  /**
   * Find patterns that match a specific element
   */
  findMatchingPatterns(
    html: string,
    elementSelector: string,
  ): PatternMatchResult[] {
    const $ = this.loadHtml(html);
    const element = $(elementSelector);

    if (element.length === 0) {
      return [];
    }

    const results: PatternMatchResult[] = [];
    const startTime = Date.now();

    for (const pattern of this.patterns.values()) {
      if (!pattern.enabled) continue;

      try {
        const matches = this.findPatternMatches($, element, pattern);
        if (matches.length > 0) {
          results.push({
            pattern,
            matches,
            performance: {
              matchTime: Date.now() - startTime,
              elementCount: element.length,
            },
          });
        }
      } catch (error) {
        // Log error but continue with other patterns
        console.warn(`Pattern matching error for '${pattern.id}':`, error);
      }
    }

    return results.sort((a, b) => b.pattern.priority - a.pattern.priority);
  }

  /**
   * Check if a pattern would match an element (without applying)
   */
  wouldPatternMatch(
    html: string,
    elementSelector: string,
    patternId: string,
  ): boolean {
    const pattern = this.patterns.get(patternId);
    if (!pattern || !pattern.enabled) return false;

    const $ = this.loadHtml(html);
    const element = $(elementSelector);

    if (element.length === 0) return false;

    const matches = this.findPatternMatches($, element, pattern);
    return matches.length > 0;
  }

  /**
   * Advanced pattern matching with conditions
   */
  private findPatternMatches(
    $: cheerio.CheerioAPI,
    elements: cheerio.Cheerio<any>,
    pattern: HtmlPattern,
  ): Array<{
    element: cheerio.Cheerio<AnyNode>;
    originalValue: string;
    matchedPart: string;
    replacement: string;
    context: {
      tagName: string;
      position: number;
      parentSelector?: string;
    };
  }> {
    const matches: Array<{
      element: cheerio.Cheerio<AnyNode>;
      originalValue: string;
      matchedPart: string;
      replacement: string;
      context: {
        tagName: string;
        position: number;
        parentSelector?: string;
      };
    }> = [];

    elements.each((index, el) => {
      const element = $(el);

      // Check tag restrictions
      if (
        pattern.tags &&
        !pattern.tags.includes(
          (element.prop("tagName") as string)?.toLowerCase() || "",
        )
      ) {
        return;
      }

      if (
        pattern.excludeTags &&
        pattern.excludeTags.includes(
          (element.prop("tagName") as string)?.toLowerCase() || "",
        )
      ) {
        return;
      }

      // Check parent selector restrictions
      if (
        pattern.parentSelector &&
        !element.closest(pattern.parentSelector).length
      ) {
        return;
      }

      if (
        pattern.excludeParentSelector &&
        element.closest(pattern.excludeParentSelector).length
      ) {
        return;
      }

      // Check custom conditions
      if (
        pattern.conditions &&
        !this.evaluateConditions($, element, pattern.conditions)
      ) {
        return;
      }

      // Get attribute value
      const originalValue = element.attr(pattern.attribute) || "";
      if (!originalValue) return;

      // Apply pattern matching
      const patternMatches = this.matchPattern(originalValue, pattern);

      for (const match of patternMatches) {
        // Check max matches limit before adding
        if (pattern.maxMatches && matches.length >= pattern.maxMatches) {
          break;
        }

        const replacement = this.generateReplacement(
          match.matched,
          pattern,
          element,
          {
            tagName:
              (element.prop("tagName") as string)?.toLowerCase() || "unknown",
            position: index,
            parentSelector:
              (element.parent().prop("tagName") as string) || undefined,
          },
        );

        matches.push({
          element,
          originalValue,
          matchedPart: match.matched,
          replacement,
          context: {
            tagName:
              (element.prop("tagName") as string)?.toLowerCase() || "unknown",
            position: index,
            parentSelector:
              (element.parent().prop("tagName") as string) || undefined,
          },
        });

        // Stop on first match if configured
        if (!pattern.multipleMatches) break;
      }

      // Check max matches limit for overall pattern
      if (pattern.maxMatches && matches.length >= pattern.maxMatches) {
        return false; // Break the .each() loop
      }
    });

    return matches;
  }

  /**
   * Evaluate pattern conditions
   */
  private evaluateConditions(
    $: cheerio.CheerioAPI,
    element: cheerio.Cheerio<any>,
    conditions: PatternCondition[],
  ): boolean {
    return conditions.every((condition) => {
      let result = false;

      switch (condition.type) {
        case "attribute":
          if (condition.attribute) {
            const value = element.attr(condition.attribute);
            result = this.evaluateConditionValue(value, condition);
          }
          break;

        case "text": {
          const text = element.text();
          result = this.evaluateConditionValue(text, condition);
          break;
        }

        case "tag": {
          const tagName = (element.prop("tagName") as string)?.toLowerCase();
          result = this.evaluateConditionValue(tagName, condition);
          break;
        }

        case "parent":
          if (condition.selector) {
            result = element.closest(condition.selector).length > 0;
          }
          break;

        case "sibling":
          if (condition.selector) {
            result = element.siblings(condition.selector).length > 0;
          }
          break;

        case "custom":
          if (condition.customCheck) {
            result = condition.customCheck(element, $);
          }
          break;
      }

      return condition.negate ? !result : result;
    });
  }

  /**
   * Evaluate condition value based on operator
   */
  private evaluateConditionValue(
    value: string | undefined,
    condition: PatternCondition,
  ): boolean {
    if (value === undefined)
      return condition.operator === "exists" ? false : true;
    if (!condition.value) return condition.operator === "exists";

    switch (condition.operator) {
      case "equals":
        return condition.value instanceof RegExp
          ? condition.value.test(value)
          : value === condition.value;

      case "contains":
        return condition.value instanceof RegExp
          ? condition.value.test(value)
          : value.includes(condition.value as string);

      case "startsWith":
        return value.startsWith(condition.value as string);

      case "endsWith":
        return value.endsWith(condition.value as string);

      case "matches":
        if (condition.value instanceof RegExp) {
          return condition.value.test(value);
        }
        return new RegExp(condition.value as string).test(value);

      case "exists":
        return true;

      default:
        return false;
    }
  }

  /**
   * Match a pattern against a value
   */
  private matchPattern(
    value: string,
    pattern: HtmlPattern,
  ): Array<{ matched: string; index: number }> {
    const matches: Array<{ matched: string; index: number }> = [];

    if (pattern.pattern instanceof RegExp) {
      const flags = pattern.pattern.flags;
      const caseInsensitive = pattern.caseSensitive === false;
      const finalFlags =
        caseInsensitive && !flags.includes("i") ? flags + "i" : flags;

      const regex = new RegExp(pattern.pattern.source, finalFlags);

      if (pattern.multipleMatches !== false) {
        const globalRegex = new RegExp(
          pattern.pattern.source,
          finalFlags.includes("g") ? finalFlags : finalFlags + "g",
        );
        let match;
        while ((match = globalRegex.exec(value)) !== null) {
          matches.push({ matched: match[0], index: match.index });
          if (pattern.maxMatches && matches.length >= pattern.maxMatches) break;
        }
      } else {
        const match = regex.exec(value);
        if (match) {
          matches.push({ matched: match[0], index: match.index });
        }
      }
    } else {
      const searchValue =
        pattern.caseSensitive === false
          ? pattern.pattern.toLowerCase()
          : pattern.pattern;
      const targetValue =
        pattern.caseSensitive === false ? value.toLowerCase() : value;

      if (pattern.wholeWordOnly) {
        const escapedPattern = searchValue.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        const flags = pattern.caseSensitive === false ? "gi" : "g";
        const regex = new RegExp(`\\b${escapedPattern}\\b`, flags);
        const searchText =
          pattern.caseSensitive === false ? value.toLowerCase() : value;
        let match;
        while ((match = regex.exec(searchText)) !== null) {
          // Get the actual matched text from the original value
          const actualMatch = value.substring(
            match.index,
            match.index + match[0].length,
          );
          matches.push({ matched: actualMatch, index: match.index });
          if (!pattern.multipleMatches) break;
          if (pattern.maxMatches && matches.length >= pattern.maxMatches) break;
        }
      } else {
        let index = targetValue.indexOf(searchValue);
        while (index !== -1) {
          const actualMatch = value.substring(
            index,
            index + searchValue.length,
          );
          matches.push({ matched: actualMatch, index });
          if (!pattern.multipleMatches) break;
          if (pattern.maxMatches && matches.length >= pattern.maxMatches) break;
          index = targetValue.indexOf(searchValue, index + 1);
        }
      }
    }

    return matches;
  }

  /**
   * Generate replacement value
   */
  private generateReplacement(
    matched: string,
    pattern: HtmlPattern,
    element: cheerio.Cheerio<any>,
    context: any,
  ): string {
    let replacement: string;

    if (typeof pattern.replacement === "function") {
      replacement = pattern.replacement(matched, element, _context);
    } else {
      replacement = pattern.replacement;
    }

    // Apply case preservation if requested
    if (pattern.preserveCase && typeof pattern.replacement === "string") {
      replacement = this.preserveCase(matched, replacement);
    }

    // Apply escaping if requested
    if (pattern.escapeReplacement) {
      replacement = this.escapeHtml(replacement);
    }

    return replacement;
  }

  /**
   * Preserve case from original to replacement
   */
  private preserveCase(original: string, replacement: string): string {
    if (original === original.toLowerCase()) {
      return replacement.toLowerCase();
    }
    if (original === original.toUpperCase()) {
      return replacement.toUpperCase();
    }
    if (original[0] === original[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
    }
    return replacement;
  }

  /**
   * Escape HTML in replacement text
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ================== STEP 3: CLASS REPLACEMENT ENGINE HELPERS ==================

  /**
   * Check if an element matches all pattern conditions
   */
  private elementMatchesPattern(
    $: cheerio.CheerioAPI,
    element: cheerio.Cheerio<any>,
    pattern: HtmlPattern,
  ): boolean {
    // Check tag restrictions
    if (
      pattern.tags &&
      !pattern.tags.includes(
        (element.prop("tagName") as string)?.toLowerCase() || "",
      )
    ) {
      return false;
    }

    if (
      pattern.excludeTags &&
      pattern.excludeTags.includes(
        (element.prop("tagName") as string)?.toLowerCase() || "",
      )
    ) {
      return false;
    }

    // Check parent selector restrictions
    if (
      pattern.parentSelector &&
      !element.closest(pattern.parentSelector).length
    ) {
      return false;
    }

    if (
      pattern.excludeParentSelector &&
      element.closest(pattern.excludeParentSelector).length
    ) {
      return false;
    }

    // Check custom conditions
    if (
      pattern.conditions &&
      !this.evaluateConditions($, element, pattern.conditions)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Generate a unique identifier for an element
   */
  private generateElementId(
    element: cheerio.Cheerio<any>,
    index: number,
  ): string {
    const tagName =
      (element.prop("tagName") as string)?.toLowerCase() || "unknown";
    const id = element.attr("id");
    const className = element.attr("class");

    if (id) {
      return `${tagName}#${id}`;
    }

    if (className) {
      const firstClass = className.split(" ")[0];
      return `${tagName}.${firstClass}[${index}]`;
    }

    return `${tagName}[${index}]`;
  }

  /**
   * Generate a CSS selector for an element
   */
  private generateElementSelector(element: cheerio.Cheerio<any>): string {
    const tagName =
      (element.prop("tagName") as string)?.toLowerCase() || "unknown";
    const id = element.attr("id");
    const className = element.attr("class");

    if (id) {
      return `${tagName}#${id}`;
    }

    if (className) {
      const classes = className
        .split(" ")
        .filter((c) => c.trim())
        .slice(0, 2); // Use first 2 classes
      return `${tagName}.${classes.join(".")}`;
    }

    return tagName;
  }

  /**
   * Get all attributes of an element as a record
   */
  private getElementAttributes(
    element: cheerio.Cheerio<any>,
  ): Record<string, string> {
    const attributes: Record<string, string> = {};
    const attribs = element.get(0)?.attribs || {};

    for (const [key, value] of Object.entries(attribs)) {
      attributes[key] = value as string;
    }

    return attributes;
  }

  /**
   * Calculate the depth of an element in the DOM tree
   */
  private getElementDepth(element: cheerio.Cheerio<any>): number {
    let depth = 0;
    let current = element.parent();

    while (current.length > 0 && (current.prop("tagName") as string)) {
      depth++;
      current = current.parent();
    }

    return depth;
  }

  /**
   * Calculate average depth of all elements
   */
  private calculateAverageDepth($: cheerio.CheerioAPI): number {
    const elements = $("*");
    if (elements.length === 0) return 0;

    let totalDepth = 0;
    elements.each((_, el) => {
      totalDepth += this.getElementDepth($(el));
    });

    return totalDepth / elements.length;
  }

  /**
   * Calculate distribution of tag names
   */
  private calculateTagDistribution($: cheerio.CheerioAPI): Map<string, number> {
    const distribution = new Map<string, number>();

    $("*").each((_, el) => {
      const element = $(el);
      const tagName =
        (element.prop("tagName") as string)?.toLowerCase() || "unknown";
      distribution.set(tagName, (distribution.get(tagName) || 0) + 1);
    });

    return distribution;
  }

  // ================== STEP 4: OVERLAP DETECTION AND RESOLUTION ==================

  /**
   * Detect overlapping patterns that would conflict on the same element
   */
  detectPatternOverlaps(
    html: string,
    elementSelector?: string,
  ): Array<{
    elementSelector: string;
    conflictingPatterns: Array<{
      patternId: string;
      matchedText: string;
      startIndex: number;
      endIndex: number;
      priority: number;
    }>;
    overlapType: "exact" | "partial" | "nested" | "adjacent";
    recommendedResolution:
      | "highest-priority"
      | "merge"
      | "split"
      | "manual-review";
    severity: "low" | "medium" | "high" | "critical";
  }> {
    const $ = this.loadHtml(html);
    const overlaps: Array<{
      elementSelector: string;
      conflictingPatterns: Array<{
        patternId: string;
        matchedText: string;
        startIndex: number;
        endIndex: number;
        priority: number;
      }>;
      overlapType: "exact" | "partial" | "nested" | "adjacent";
      recommendedResolution:
        | "highest-priority"
        | "merge"
        | "split"
        | "manual-review";
      severity: "low" | "medium" | "high" | "critical";
    }> = [];

    const enabledPatterns = Array.from(this.patterns.values()).filter(
      (p) => p.enabled,
    );
    const elementsToCheck = elementSelector ? $(elementSelector) : $("*");

    elementsToCheck.each((index, el) => {
      const element = $(el);
      const elementSel = this.generateElementSelector(element);

      // Find all patterns that match this element
      const matchingPatterns: Array<{
        patternId: string;
        matchedText: string;
        startIndex: number;
        endIndex: number;
        priority: number;
      }> = [];

      for (const pattern of enabledPatterns) {
        if (this.elementMatchesPattern($, element, pattern)) {
          const attributeValue = element.attr(pattern.attribute) || "";
          const matches = this.matchPattern(attributeValue, pattern);

          for (const match of matches) {
            matchingPatterns.push({
              patternId: pattern.id,
              matchedText: match.matched,
              startIndex: match.index,
              endIndex: match.index + match.matched.length,
              priority: pattern.priority,
            });
          }
        }
      }

      // Analyze overlaps if multiple patterns match
      if (matchingPatterns.length > 1) {
        const overlapAnalysis = this.analyzePatternOverlaps(matchingPatterns);
        if (overlapAnalysis.hasOverlap) {
          overlaps.push({
            elementSelector: elementSel,
            conflictingPatterns: matchingPatterns,
            overlapType: overlapAnalysis.type,
            recommendedResolution: overlapAnalysis.recommendedResolution,
            severity: overlapAnalysis.severity,
          });
        }
      }
    });

    return overlaps;
  }

  /**
   * Analyze the type and severity of pattern overlaps
   */
  private analyzePatternOverlaps(
    patterns: Array<{
      patternId: string;
      matchedText: string;
      startIndex: number;
      endIndex: number;
      priority: number;
    }>,
  ): {
    hasOverlap: boolean;
    type: "exact" | "partial" | "nested" | "adjacent";
    recommendedResolution:
      | "highest-priority"
      | "merge"
      | "split"
      | "manual-review";
    severity: "low" | "medium" | "high" | "critical";
  } {
    // Sort patterns by start index
    const sortedPatterns = [...patterns].sort(
      (a, b) => a.startIndex - b.startIndex,
    );

    let hasOverlap = false;
    let overlapType: "exact" | "partial" | "nested" | "adjacent" = "exact";
    let severity: "low" | "medium" | "high" | "critical" = "low";

    // Check for overlaps between consecutive patterns
    for (let i = 0; i < sortedPatterns.length - 1; i++) {
      const current = sortedPatterns[i];
      const next = sortedPatterns[i + 1];

      // Check if patterns overlap
      if (current.endIndex > next.startIndex) {
        hasOverlap = true;

        // Determine overlap type
        if (
          current.startIndex === next.startIndex &&
          current.endIndex === next.endIndex
        ) {
          overlapType = "exact";
          severity = "high"; // Exact overlaps are serious
        } else if (
          current.startIndex <= next.startIndex &&
          current.endIndex >= next.endIndex
        ) {
          overlapType = "nested";
          severity = "medium";
        } else if (
          next.startIndex <= current.startIndex &&
          next.endIndex >= current.endIndex
        ) {
          overlapType = "nested";
          severity = "medium";
        } else {
          overlapType = "partial";
          severity = "medium";
        }
      } else if (current.endIndex === next.startIndex) {
        // Adjacent patterns (touching but not overlapping)
        overlapType = "adjacent";
        severity = "low";
      }
    }

    // Determine recommended resolution
    let recommendedResolution:
      | "highest-priority"
      | "merge"
      | "split"
      | "manual-review";

    if (overlapType === "exact") {
      recommendedResolution = "highest-priority";
    } else if (overlapType === "adjacent") {
      recommendedResolution = "merge";
    } else if (overlapType === "nested") {
      recommendedResolution = "split";
    } else {
      recommendedResolution = "manual-review";
    }

    // Upgrade severity if there are many conflicting patterns
    if (patterns.length > 3) {
      severity =
        severity === "low"
          ? "medium"
          : severity === "medium"
            ? "high"
            : "critical";
    }

    return {
      hasOverlap,
      type: overlapType,
      recommendedResolution,
      severity,
    };
  }

  /**
   * Resolve conflicts using specified strategy
   */
  resolvePatternConflicts(
    conflicts: Array<{
      elementSelector: string;
      conflictingPatterns: Array<{
        patternId: string;
        matchedText: string;
        startIndex: number;
        endIndex: number;
        priority: number;
      }>;
      overlapType: "exact" | "partial" | "nested" | "adjacent";
      recommendedResolution:
        | "highest-priority"
        | "merge"
        | "split"
        | "manual-review";
      severity: "low" | "medium" | "high" | "critical";
    }>,
    strategy:
      | "auto"
      | "highest-priority"
      | "merge"
      | "split"
      | "manual-review" = "auto",
  ): Array<{
    elementSelector: string;
    resolution:
      | "highest-priority"
      | "merge"
      | "split"
      | "manual-review"
      | "skipped";
    chosenPatterns: string[];
    reason: string;
    success: boolean;
  }> {
    const resolutions: Array<{
      elementSelector: string;
      resolution:
        | "highest-priority"
        | "merge"
        | "split"
        | "manual-review"
        | "skipped";
      chosenPatterns: string[];
      reason: string;
      success: boolean;
    }> = [];

    for (const conflict of conflicts) {
      const resolutionStrategy =
        strategy === "auto" ? conflict.recommendedResolution : strategy;

      let resolution: {
        resolution:
          | "highest-priority"
          | "merge"
          | "split"
          | "manual-review"
          | "skipped";
        chosenPatterns: string[];
        reason: string;
        success: boolean;
      };

      switch (resolutionStrategy) {
        case "highest-priority":
          resolution = this.resolveByHighestPriority(conflict);
          break;
        case "merge":
          resolution = this.resolveByMerging(conflict);
          break;
        case "split":
          resolution = this.resolveBySplitting(conflict);
          break;
        case "manual-review":
        default:
          resolution = {
            resolution: "manual-review",
            chosenPatterns: [],
            reason: "Conflict requires manual review due to complexity",
            success: false,
          };
          break;
      }

      resolutions.push({
        elementSelector: conflict.elementSelector,
        ...resolution,
      });
    }

    return resolutions;
  }

  /**
   * Resolve conflict by choosing highest priority pattern
   */
  private resolveByHighestPriority(conflict: {
    conflictingPatterns: Array<{
      patternId: string;
      matchedText: string;
      startIndex: number;
      endIndex: number;
      priority: number;
    }>;
  }): {
    resolution: "highest-priority";
    chosenPatterns: string[];
    reason: string;
    success: boolean;
  } {
    const highestPriority = Math.max(
      ...conflict.conflictingPatterns.map((p) => p.priority),
    );
    const chosenPatterns = conflict.conflictingPatterns
      .filter((p) => p.priority === highestPriority)
      .map((p) => p.patternId);

    return {
      resolution: "highest-priority",
      chosenPatterns,
      reason: `Selected pattern(s) with highest priority (${highestPriority})`,
      success: true,
    };
  }

  /**
   * Resolve conflict by merging compatible patterns
   */
  private resolveByMerging(conflict: {
    conflictingPatterns: Array<{
      patternId: string;
      matchedText: string;
      startIndex: number;
      endIndex: number;
      priority: number;
    }>;
  }): {
    resolution: "merge";
    chosenPatterns: string[];
    reason: string;
    success: boolean;
  } {
    // For now, merge by including all non-overlapping patterns
    const sortedPatterns = [...conflict.conflictingPatterns].sort(
      (a, b) => a.startIndex - b.startIndex,
    );
    const chosenPatterns: string[] = [];
    let lastEndIndex = -1;

    for (const pattern of sortedPatterns) {
      if (pattern.startIndex >= lastEndIndex) {
        chosenPatterns.push(pattern.patternId);
        lastEndIndex = pattern.endIndex;
      }
    }

    return {
      resolution: "merge",
      chosenPatterns,
      reason: `Merged ${chosenPatterns.length} non-overlapping patterns`,
      success: chosenPatterns.length > 0,
    };
  }

  /**
   * Resolve conflict by splitting overlapping regions
   */
  private resolveBySplitting(conflict: {
    conflictingPatterns: Array<{
      patternId: string;
      matchedText: string;
      startIndex: number;
      endIndex: number;
      priority: number;
    }>;
  }): {
    resolution: "split";
    chosenPatterns: string[];
    reason: string;
    success: boolean;
  } {
    // For nested patterns, choose the outer pattern
    const sortedByLength = [...conflict.conflictingPatterns].sort(
      (a, b) => b.endIndex - b.startIndex - (a.endIndex - a.startIndex),
    );

    return {
      resolution: "split",
      chosenPatterns: [sortedByLength[0].patternId],
      reason: "Selected outermost pattern for nested conflict",
      success: true,
    };
  }

  /**
   * Get conflict resolution statistics
   */
  getConflictStats(): {
    totalConflicts: number;
    resolvedConflicts: number;
    unresolvedConflicts: number;
    resolutionStrategies: Map<string, number>;
    severityDistribution: Map<string, number>;
  } {
    // This would be populated during actual conflict resolution
    // For now, return empty stats
    return {
      totalConflicts: 0,
      resolvedConflicts: 0,
      unresolvedConflicts: 0,
      resolutionStrategies: new Map(),
      severityDistribution: new Map(),
    };
  }

  /**
   * Analyze HTML format for preservation
   */
  private analyzeHtmlFormat(html: string): FormatAnalysis {
    const lines = html.split(/\r?\n/);
    const analysis: FormatAnalysis = {
      indentationStyle: "none",
      indentationSize: 0,
      lineEndings: "lf",
      hasTrailingWhitespace: false,
      preservedWhitespace: new Map(),
      preservedComments: [],
      originalFormatting: {
        totalLines: lines.length,
        emptyLines: [],
        indentationMap: new Map(),
      },
    };

    // Detect line endings
    if (html.includes("\r\n")) {
      analysis.lineEndings =
        html.includes("\n") && !html.includes("\r\n") ? "mixed" : "crlf";
    } else if (html.includes("\n")) {
      analysis.lineEndings = "lf";
    }

    // Analyze indentation
    const indentationSamples: Array<{ type: "spaces" | "tabs"; size: number }> =
      [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track empty lines
      if (line.trim() === "") {
        analysis.originalFormatting.emptyLines.push(i);
        continue;
      }

      // Check for trailing whitespace
      if (line !== line.trimEnd()) {
        analysis.hasTrailingWhitespace = true;
      }

      // Analyze indentation
      const match = line.match(/^(\s+)/);
      if (match) {
        const indent = match[1];
        analysis.originalFormatting.indentationMap.set(i, indent);

        if (indent.includes("\t")) {
          indentationSamples.push({ type: "tabs", size: indent.length });
        } else {
          indentationSamples.push({ type: "spaces", size: indent.length });
        }
      }
    }

    // Determine dominant indentation style
    const spacesSamples = indentationSamples.filter((s) => s.type === "spaces");
    const tabsSamples = indentationSamples.filter((s) => s.type === "tabs");

    if (spacesSamples.length > tabsSamples.length) {
      analysis.indentationStyle = "spaces";
      // Find most common indentation size
      const sizes = spacesSamples.map((s) => s.size);
      const sizeFreq = new Map<number, number>();
      for (const size of sizes) {
        sizeFreq.set(size, (sizeFreq.get(size) || 0) + 1);
      }
      const mostCommonSize = Array.from(sizeFreq.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0];
      analysis.indentationSize = mostCommonSize ? mostCommonSize[0] : 2;
    } else if (tabsSamples.length > spacesSamples.length) {
      analysis.indentationStyle = "tabs";
      analysis.indentationSize = 1;
    } else if (spacesSamples.length > 0 && tabsSamples.length > 0) {
      analysis.indentationStyle = "mixed";
    }

    // Extract comments for preservation
    const commentRegex = /<!--([\s\S]*?)-->/g;
    let match;
    while ((match = commentRegex.exec(html)) !== null) {
      analysis.preservedComments.push({
        content: match[1],
        position: match.index,
        type: "inline", // Could be enhanced to detect before/after
      });
    }

    return analysis;
  }

  /**
   * Preserve whitespace around elements during processing
   */
  private preserveElementWhitespace($: cheerio.CheerioAPI): void {
    if (!this.formatPreservation.preserveWhitespace || !this.formatAnalysis) {
      return;
    }

    $("*").each((index, element) => {
      const $element = $(element);
      const selector = this.generateElementSelector($element);

      // Capture surrounding whitespace
      const prev = $element.prev();
      // const next = $element.next(); // Future use for whitespace analysis

      let whitespace = "";

      // Check for whitespace before element
      if (prev.length === 0) {
        const parent = $element.parent();
        if (parent.length > 0) {
          const parentHtml = parent.html() || "";
          const elementHtml = $element.prop("outerHTML") || "";
          const elementIndex = parentHtml.indexOf(elementHtml);
          if (elementIndex > 0) {
            const beforeContent = parentHtml.substring(0, elementIndex);
            const whitespaceMatch = beforeContent.match(/\s+$/);
            if (whitespaceMatch) {
              whitespace = whitespaceMatch[0];
            }
          }
        }
      }

      if (whitespace && this.formatAnalysis) {
        this.formatAnalysis.preservedWhitespace.set(selector, whitespace);
      }
    });
  }

  /**
   * Restore preserved formatting after processing
   */
  private restoreFormatting(html: string): string {
    if (!this.formatPreservation.preserveWhitespace || !this.formatAnalysis) {
      return html;
    }

    let formattedHtml = html;

    // Restore line endings
    if (this.formatAnalysis.lineEndings === "crlf") {
      formattedHtml = formattedHtml.replace(/\n/g, "\r\n");
    }

    // Restore indentation if needed
    if (
      this.formatPreservation.preserveIndentation &&
      this.formatAnalysis.originalFormatting.indentationMap.size > 0
    ) {
      const lines = formattedHtml.split(/\r?\n/);
      const restoredLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const originalIndent =
          this.formatAnalysis.originalFormatting.indentationMap.get(i);

        if (originalIndent && line.trim()) {
          // Apply original indentation
          restoredLines.push(originalIndent + line.trim());
        } else {
          restoredLines.push(line);
        }
      }

      formattedHtml = restoredLines.join(
        this.formatAnalysis.lineEndings === "crlf" ? "\r\n" : "\n",
      );
    }

    // Restore comments
    if (this.formatPreservation.preserveComments) {
      for (const comment of this.formatAnalysis.preservedComments) {
        const commentHtml = `<!--${comment.content}-->`;
        // Simple restoration - could be enhanced for precise positioning
        if (!formattedHtml.includes(commentHtml)) {
          formattedHtml = commentHtml + "\n" + formattedHtml;
        }
      }
    }

    // Handle trailing whitespace
    if (
      !this.formatPreservation.trimTrailingWhitespace &&
      this.formatAnalysis.hasTrailingWhitespace
    ) {
      // Preserve trailing whitespace patterns - simplified implementation
      // const lines = formattedHtml.split(/\r?\n/);
      // This could be enhanced to restore exact trailing whitespace patterns
    }

    return formattedHtml;
  }

  /**
   * Configure format preservation options
   */
  setFormatPreservation(options: Partial<FormatPreservationOptions>): void {
    this.formatPreservation = {
      ...this.formatPreservation,
      ...options,
    };
  }

  /**
   * Get current format preservation settings
   */
  getFormatPreservation(): FormatPreservationOptions {
    return { ...this.formatPreservation };
  }

  /**
   * Get format analysis for the last processed HTML
   */
  getFormatAnalysis(): FormatAnalysis | undefined {
    return this.formatAnalysis ? { ...this.formatAnalysis } : undefined;
  }

  /**
   * Set integration components
   */
  setIntegration(integration: Partial<HtmlRewriterIntegration>): void {
    if (
      integration.fileDiscovery &&
      typeof integration.fileDiscovery.findFiles === "function"
    ) {
      this.integration = {
        ...this.integration,
        fileDiscovery: integration.fileDiscovery,
      };
    }
    if (
      integration.nameGeneration &&
      typeof integration.nameGeneration.generateNames === "function"
    ) {
      this.integration = {
        ...this.integration,
        nameGeneration: integration.nameGeneration,
      };
    }
    if (integration.cssGeneration) {
      this.integration = {
        ...this.integration,
        cssGeneration: integration.cssGeneration,
      };
    }
    if (integration.config) {
      this.integration = { ...this.integration, config: integration.config };
    }
  }

  /**
   * Process files discovered by the file discovery system
   */
  async processDiscoveredFiles(
    patterns?: string[],
    options: Partial<BatchOperationOptions> = {},
  ): Promise<BatchOperationResult> {
    if (!this.integration?.fileDiscovery) {
      throw new HtmlRewriteError(
        "File discovery integration not configured",
        "integration",
        "processDiscoveredFiles",
      );
    }

    const discoveryOptions = {
      extensions: [".html", ".htm", ".xhtml"],
      patterns: patterns || ["**/*.html", "**/*.htm"],
      excludePatterns: ["node_modules/**", ".git/**", "dist/**", "build/**"],
      maxDepth: 10,
    };

    const files =
      await this.integration.fileDiscovery.findFiles(discoveryOptions);
    return this.processBatch(files, _options);
  }

  /**
   * Process a batch of files with configurable options
   */
  async processBatch(
    filePaths: string[],
    options: Partial<BatchOperationOptions> = {},
  ): Promise<BatchOperationResult> {
    const batchOptions: BatchOperationOptions = {
      concurrency: 4,
      continueOnError: true,
      dryRun: false,
      createBackups: true,
      validateResults: true,
      ...options,
    };

    const startTime = Date.now();
    const result: BatchOperationResult = {
      processedFiles: [],
      successfulFiles: [],
      failedFiles: [],
      totalTime: 0,
      statistics: {
        totalPatterns: this.patterns.size,
        totalReplacements: 0,
        totalConflicts: 0,
        averageProcessingTime: 0,
      },
    };

    const processingTimes: number[] = [];

    // Process files with controlled concurrency
    const chunks = this.chunkArray(filePaths, batchOptions.concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async (filePath) => {
        const fileStartTime = Date.now();
        result.processedFiles.push(filePath);

        if (batchOptions.progressCallback) {
          batchOptions.progressCallback(
            result.processedFiles.length,
            filePaths.length,
            filePath,
          );
        }

        try {
          const fileResult = await this.rewriteFile(filePath);

          if (fileResult.success) {
            result.successfulFiles.push(filePath);

            // Accumulate statistics
            result.statistics.totalReplacements +=
              fileResult.appliedReplacements.length;
            result.statistics.totalConflicts += fileResult.conflicts.length;

            const processingTime = Date.now() - fileStartTime;
            processingTimes.push(processingTime);
          } else {
            result.failedFiles.push({
              file: filePath,
              error: `Processing failed: ${fileResult.metadata.errors.join(", ")}`,
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          result.failedFiles.push({ file: filePath, error: errorMessage });

          if (batchOptions.errorCallback) {
            batchOptions.errorCallback(
              filePath,
              error instanceof Error ? error : new Error(errorMessage),
            );
          }

          if (!batchOptions.continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    result.totalTime = Date.now() - startTime;
    result.statistics.averageProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

    return result;
  }

  /**
   * Enhanced file rewriting with advanced options
   */
  async rewriteFileAdvanced(
    filePath: string,
    options: FileOperationOptions = {},
  ): Promise<HtmlRewriteResult> {
    const fileOptions: FileOperationOptions = {
      encoding: "utf-8",
      overwrite: true,
      preservePermissions: true,
      createBackup: this.options.createBackup,
      backupSuffix: ".backup",
      validateBeforeWrite: true,
      atomic: true,
      ...options,
    };

    try {
      // Check file exists and get stats
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new HtmlRewriteError(
          `Path is not a file: ${filePath}`,
          filePath,
          "file-check",
        );
      }

      // Create backup if enabled
      let backupPath: string | undefined;
      if (fileOptions.createBackup && !this.options.dryRun) {
        backupPath = await this.createAdvancedBackup(
          filePath,
          fileOptions.backupSuffix!,
        );
      }

      // Read file with specified encoding
      const originalContent = await fs.readFile(
        filePath,
        fileOptions.encoding!,
      );

      // Process HTML
      const result = await this.rewriteHtml(originalContent, filePath);

      // Validate before writing if enabled
      if (fileOptions.validateBeforeWrite && !this.options.dryRun) {
        await this.validateRewriteResult(result, filePath);
      }

      // Write modified content (unless dry run)
      if (!this.options.dryRun && fileOptions.overwrite) {
        if (fileOptions.atomic) {
          await this.atomicWrite(
            filePath,
            result.modifiedHtml,
            fileOptions.encoding!,
          );
        } else {
          await fs.writeFile(
            filePath,
            result.modifiedHtml,
            fileOptions.encoding!,
          );
        }

        // Preserve file permissions if enabled
        if (fileOptions.preservePermissions) {
          await fs.chmod(filePath, stats.mode);
        }
      }

      // Add backup and file operation metadata
      result.metadata.backupPath = backupPath;
      result.metadata.fileSize = Buffer.byteLength(
        result.modifiedHtml,
        fileOptions.encoding!,
      );

      return result;
    } catch (error) {
      if (error instanceof HtmlRewriteError) {
        throw error;
      }

      throw new HtmlRewriteError(
        `Failed to rewrite file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        "file-rewrite-advanced",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Integration with name generation system
   */
  async generateAndApplyNames(
    htmlContent: string,
    extractedClasses: string[],
  ): Promise<{ html: string; nameMapping: Map<string, string> }> {
    if (!this.integration?.nameGeneration) {
      throw new HtmlRewriteError(
        "Name generation integration not configured",
        "integration",
        "generateAndApplyNames",
      );
    }

    // Generate new names for extracted classes
    const nameResult =
      await this.integration.nameGeneration.generateNames(extractedClasses);

    // Set the name mapping for replacements
    this.setNameMapping(nameResult);

    // Apply replacements using generated names
    const result = await this.rewriteHtml(htmlContent);

    return {
      html: result.modifiedHtml,
      nameMapping: nameResult.nameMap || new Map(),
    };
  }

  /**
   * Create advanced backup with metadata
   */
  private async createAdvancedBackup(
    filePath: string,
    suffix: string,
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${filePath}${suffix}.${timestamp}`;

    try {
      await fs.copyFile(filePath, backupPath);

      // Create backup metadata
      const metadata = {
        originalFile: filePath,
        backupTime: new Date().toISOString(),
        originalSize: (await fs.stat(filePath)).size,
        backupPath,
      };

      const metadataPath = `${backupPath}.metadata.json`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return backupPath;
    } catch (error) {
      throw new BackupError(
        `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        backupPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Atomic write operation (write to temp file then rename)
   */
  private async atomicWrite(
    filePath: string,
    content: string,
    encoding: BufferEncoding,
  ): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}`;

    try {
      await fs.writeFile(tempPath, content, encoding);
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Validate rewrite result before writing
   */
  private async validateRewriteResult(
    result: HtmlRewriteResult,
    filePath: string,
  ): Promise<void> {
    if (!result.success) {
      throw new HtmlValidationError(
        `Rewrite result validation failed for ${filePath}`,
        ["Processing was not successful"],
        undefined,
      );
    }

    if (result.metadata.errors.length > 0) {
      throw new HtmlValidationError(
        `Rewrite result contains errors for ${filePath}`,
        result.metadata.errors,
        result.modifiedHtml.substring(0, 500),
      );
    }

    // Additional validation can be added here
    // - Check for malformed HTML
    // - Verify expected replacements
    // - Check file size changes
  }

  /**
   * Utility function to chunk array for batch processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get integration status
   */
  getIntegrationStatus(): {
    fileDiscovery: boolean;
    nameGeneration: boolean;
    cssGeneration: boolean;
    config: boolean;
  } {
    return {
      fileDiscovery: !!this.integration?.fileDiscovery,
      nameGeneration: !!this.integration?.nameGeneration,
      cssGeneration: !!this.integration?.cssGeneration,
      config: !!this.integration?.config,
    };
  }
}

/**
 * Utility function to create HTML rewriter with default options
 */
export function createHtmlRewriter(
  options: Partial<HtmlRewriteOptions> = {},
): HtmlRewriter {
  return new HtmlRewriter(options);
}

/**
 * Utility function to rewrite HTML string with simple patterns
 */
export async function rewriteHtmlString(
  html: string,
  patterns: HtmlPattern[],
  options: Partial<HtmlRewriteOptions> = {},
): Promise<HtmlRewriteResult> {
  const rewriter = createHtmlRewriter(options);
  rewriter.addPatterns(patterns);
  return rewriter.rewriteHtml(html);
}

/**
 * Utility function to rewrite HTML file with simple patterns
 */
export async function rewriteHtmlFile(
  filePath: string,
  patterns: HtmlPattern[],
  options: Partial<HtmlRewriteOptions> = {},
): Promise<HtmlRewriteResult> {
  const rewriter = createHtmlRewriter(options);
  rewriter.addPatterns(patterns);
  return rewriter.rewriteFile(filePath);
}
