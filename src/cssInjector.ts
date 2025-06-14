/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as cheerio from "cheerio";
import * as path from "path";
import { z } from "zod";
import { createLogger } from "./logger.ts";
import {
  PathUtils,
  type PathCalculationOptions,
  type RelativePathResult,
  PathUtilsError,
} from "./pathUtils.ts";
import type { AnyNode } from "domhandler";

/**
 * Configuration options for CSS injection operations
 */
export const CssInjectionOptionsSchema = z.object({
  /** CSS file path to inject */
  cssPath: z.string().min(1, "CSS path is required"),
  /** Target HTML file path */
  htmlPath: z.string().min(1, "HTML file path is required"),
  /** Base path for relative path calculation */
  basePath: z.string().optional(),
  /** Whether to use relative paths (default: true) */
  useRelativePaths: z.boolean().default(true),
  /** Link tag attributes */
  linkAttributes: z
    .object({
      rel: z.string().default("stylesheet"),
      type: z.string().default("text/css"),
      media: z.string().optional(),
    })
    .default({}),
  /** Insertion position in head */
  insertPosition: z
    .enum(["first", "last", "before-existing", "after-meta"])
    .default("after-meta"),
  /** Whether to preserve original formatting */
  preserveFormatting: z.boolean().default(true),
  /** Whether to prevent duplicate injections */
  preventDuplicates: z.boolean().default(true),
  /** Duplicate resolution strategy */
  duplicateStrategy: z.enum(["skip", "replace", "error"]).default("skip"),
  /** Whether to create head section if missing */
  createHeadIfMissing: z.boolean().default(true),
  /** Whether to backup original file */
  createBackup: z.boolean().default(true),
  /** Maximum file size to process (in bytes) */
  maxFileSize: z
    .number()
    .min(1)
    .default(10 * 1024 * 1024), // 10MB
  /** Timeout for processing (in ms) */
  timeout: z.number().min(100).default(30000), // 30 seconds
});

export type CssInjectionOptions = z.infer<typeof CssInjectionOptionsSchema>;

/**
 * Document structure analysis result
 */
export interface DocumentStructure {
  /** Whether the document has a head section */
  hasHead: boolean;
  /** Whether the document has a body section */
  hasBody: boolean;
  /** Detected document type */
  doctype: string | null;
  /** HTML element attributes */
  htmlAttributes: Record<string, string>;
  /** Existing link tags in head */
  existingLinks: Array<{
    href: string;
    rel: string;
    type?: string;
    media?: string;
    element: cheerio.Cheerio<AnyNode>;
  }>;
  /** Existing style tags in head */
  existingStyles: Array<{
    content: string;
    type?: string;
    media?: string;
    element: cheerio.Cheerio<AnyNode>;
  }>;
  /** Meta tags in head */
  metaTags: Array<{
    name?: string;
    property?: string;
    content?: string;
    element: cheerio.Cheerio<AnyNode>;
  }>;
  /** Original indentation pattern detected */
  indentationPattern: {
    type: "spaces" | "tabs" | "mixed";
    size: number;
    consistent: boolean;
  };
  /** Head section insertion point */
  headInsertionPoint: cheerio.Cheerio<AnyNode> | null;
}

/**
 * CSS injection operation result
 */
export interface CssInjectionResult {
  /** Whether the injection was successful */
  success: boolean;
  /** The modified HTML string */
  html: string;
  /** Path to the injected CSS file */
  injectedCssPath: string;
  /** Calculated relative path used in the link tag */
  relativePath: string;
  /** Whether a duplicate was detected */
  duplicateDetected: boolean;
  /** Action taken for duplicate (if any) */
  duplicateAction: "skipped" | "replaced" | "error" | null;
  /** Document structure analysis */
  documentStructure: DocumentStructure;
  /** Processing metadata */
  metadata: {
    source: string;
    processedAt: Date;
    processingTime: number;
    fileSize?: number;
    backupCreated: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Custom error classes for CSS injection operations
 */
export class CssInjectionError extends Error {
  public source?: string;
  public cause?: Error;
  public code?: string;

  constructor(
    message: string,
    source?: string,
    cause?: Error,
    code?: string,
  ) {
    super(message);
    this.name = "CssInjectionError";
    this.source = source;
    this.cause = cause;
    this.code = code;
  }
}

export class DuplicateInjectionError extends CssInjectionError {
  public existingHref: string;
  public newHref: string;

  constructor(
    message: string,
    existingHref: string,
    newHref: string,
    source?: string,
  ) {
    super(message, source, undefined, "DUPLICATE_INJECTION");
    this.name = "DuplicateInjectionError";
    this.existingHref = existingHref;
    this.newHref = newHref;
  }
}

export class PathCalculationError extends CssInjectionError {
  public fromPath: string;
  public toPath: string;

  constructor(
    message: string,
    fromPath: string,
    toPath: string,
    cause?: Error,
  ) {
    super(message, undefined, cause, "PATH_CALCULATION_ERROR");
    this.name = "PathCalculationError";
    this.fromPath = fromPath;
    this.toPath = toPath;
  }
}

export class HtmlStructureError extends CssInjectionError {
  public htmlContent?: string;

  constructor(
    message: string,
    htmlContent?: string,
    cause?: Error,
  ) {
    super(message, undefined, cause, "HTML_STRUCTURE_ERROR");
    this.name = "HtmlStructureError";
    this.htmlContent = htmlContent;
  }
}

/**
 * Main CSS injection class
 */
export class CssInjector {
  private readonly logger = createLogger("CssInjector");
  private readonly options: CssInjectionOptions;
  private readonly pathUtils: PathUtils;

  constructor(options: Partial<CssInjectionOptions>) {
    try {
      this.options = CssInjectionOptionsSchema.parse(options);

      // Initialize PathUtils with configuration matching CSS injection options
      this.pathUtils = new PathUtils({
        basePath: this.options.basePath,
        enableSecurity: true, // Enable security checks for path validation
        normalizeForWeb: true, // Always use forward slashes for web compatibility
        useRelativePaths: this.options.useRelativePaths,
      });

      this.logger.debug("CssInjector initialized", {
        cssPath: this.options.cssPath,
        htmlPath: this.options.htmlPath,
        useRelativePaths: this.options.useRelativePaths,
        preventDuplicates: this.options.preventDuplicates,
      });
    } catch (error) {
      this.logger.error("Invalid CSS injection options", {
        error: error instanceof Error ? error.message : String(error),
        providedOptions: options,
      });
      throw new CssInjectionError(
        `Invalid CSS injection options: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined,
        "INVALID_OPTIONS",
      );
    }
  }

  /**
   * Inject CSS link tag into HTML string
   */
  async injectIntoString(
    html: string,
    source = "string",
  ): Promise<CssInjectionResult> {
    const startTime = Date.now();
    const metadata = {
      source,
      processedAt: new Date(),
      processingTime: 0,
      backupCreated: false,
      errors: [] as string[],
      warnings: [] as string[],
    };

    try {
      this.logger.debug("Starting CSS injection", {
        source,
        htmlLength: html.length,
      });

      // Validate HTML size
      if (html.length > this.options.maxFileSize) {
        throw new CssInjectionError(
          `HTML content too large: ${html.length} bytes (max: ${this.options.maxFileSize})`,
          source,
          undefined,
          "FILE_TOO_LARGE",
        );
      }

      // Load HTML with cheerio
      const $ = cheerio.load(html, {
        xml: {
          xmlMode: false,
          decodeEntities: true,
          withStartIndices: false,
          withEndIndices: false,
        },
      });

      // Analyze document structure
      const documentStructure = this.analyzeDocumentStructure($);
      this.logger.debug("Document structure analyzed", {
        hasHead: documentStructure.hasHead,
        hasBody: documentStructure.hasBody,
        existingLinksCount: documentStructure.existingLinks.length,
        doctype: documentStructure.doctype,
      });

      // Calculate relative path
      const relativePath = this.calculateRelativePath();
      this.logger.debug("Relative path calculated", { relativePath });

      // Check for duplicates
      let duplicateDetected = false;
      let duplicateAction: "skipped" | "replaced" | "error" | null = null;

      if (this.options.preventDuplicates) {
        const duplicate = this.detectDuplicate(documentStructure, relativePath);
        if (duplicate) {
          duplicateDetected = true;
          duplicateAction = this.handleDuplicate(
            duplicate,
            $,
            documentStructure,
          );

          if (duplicateAction === "skipped") {
            metadata.warnings.push(
              `Duplicate CSS link detected and skipped: ${relativePath}`,
            );
            metadata.processingTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms

            return {
              success: true,
              html: $.html(),
              injectedCssPath: this.options.cssPath,
              relativePath,
              duplicateDetected,
              duplicateAction,
              documentStructure,
              metadata,
            };
          }
        }
      }

      // Inject CSS link tag
      this.injectLinkTag($, documentStructure, relativePath);
      this.logger.debug("CSS link tag injected successfully");

      // Get final HTML
      const finalHtml = $.html();
      metadata.processingTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms

      this.logger.info("CSS injection completed successfully", {
        source,
        relativePath,
        duplicateDetected,
        duplicateAction,
        processingTime: metadata.processingTime,
      });

      return {
        success: true,
        html: finalHtml,
        injectedCssPath: this.options.cssPath,
        relativePath,
        duplicateDetected,
        duplicateAction,
        documentStructure,
        metadata,
      };
    } catch (error) {
      metadata.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      metadata.processingTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms

      this.logger.error("CSS injection failed", {
        source,
        error: error instanceof Error ? error.message : String(error),
        processingTime: metadata.processingTime,
      });

      throw error instanceof CssInjectionError
        ? error
        : new CssInjectionError(
            `Failed to inject CSS: ${error instanceof Error ? error.message : String(error)}`,
            source,
            error instanceof Error ? error : undefined,
          );
    }
  }

  /**
   * Analyze HTML document structure
   */
  private analyzeDocumentStructure($: cheerio.CheerioAPI): DocumentStructure {
    this.logger.debug("Analyzing document structure");

    // Check for head and body elements
    const head = $("head");
    const body = $("body");
    const html = $("html");

    // Extract doctype if present
    let doctype: string | null = null;
    const doctypeMatch = $.html().match(/<!DOCTYPE[^>]*>/i);
    if (doctypeMatch) {
      doctype = doctypeMatch[0];
    }

    // Get HTML element attributes
    const htmlAttributes: Record<string, string> = {};
    if (html.length > 0) {
      const attrs = html.get(0)?.attribs || {};
      Object.assign(htmlAttributes, attrs);
    }

    // Analyze existing link tags in head
    const existingLinks: DocumentStructure["existingLinks"] = [];
    head.find("link").each((_, element) => {
      const $link = $(element);
      const href = $link.attr("href");
      const rel = $link.attr("rel");
      const type = $link.attr("type");
      const media = $link.attr("media");

      if (href && rel) {
        existingLinks.push({
          href,
          rel,
          type,
          media,
          element: $link,
        });
      }
    });

    // Analyze existing style tags in head
    const existingStyles: DocumentStructure["existingStyles"] = [];
    head.find("style").each((_, element) => {
      const $style = $(element);
      const content = $style.text();
      const type = $style.attr("type");
      const media = $style.attr("media");

      existingStyles.push({
        content,
        type,
        media,
        element: $style,
      });
    });

    // Analyze meta tags in head
    const metaTags: DocumentStructure["metaTags"] = [];
    head.find("meta").each((_, element) => {
      const $meta = $(element);
      const name = $meta.attr("name");
      const property = $meta.attr("property");
      const content = $meta.attr("content") || $meta.attr("charset"); // Handle charset attribute

      metaTags.push({
        name,
        property,
        content,
        element: $meta,
      });
    });

    // Detect indentation pattern from the original HTML
    const indentationPattern = this.detectIndentationPattern($.html());

    // Determine head insertion point based on position setting
    let headInsertionPoint: cheerio.Cheerio<AnyNode> | null = null;

    if (head.length > 0) {
      switch (this.options.insertPosition) {
        case "first":
          headInsertionPoint = head.children().first();
          break;
        case "last":
          headInsertionPoint = null; // Will append to end
          break;
        case "after-meta": {
          // Find the last meta tag
          const lastMeta = head.find("meta").last();
          if (lastMeta.length > 0) {
            headInsertionPoint = lastMeta;
          } else {
            // No meta tags, use first child or append to end
            headInsertionPoint = head.children().first();
          }
          break;
        }
        case "before-existing": {
          // Find the first existing stylesheet link
          const firstStylesheet = head.find('link[rel="stylesheet"]').first();
          if (firstStylesheet.length > 0) {
            headInsertionPoint = firstStylesheet;
          } else {
            headInsertionPoint = null; // Will append to end
          }
          break;
        }
        default:
          headInsertionPoint = null;
      }
    }

    const structure: DocumentStructure = {
      hasHead: head.length > 0,
      hasBody: body.length > 0,
      doctype,
      htmlAttributes,
      existingLinks,
      existingStyles,
      metaTags,
      indentationPattern,
      headInsertionPoint,
    };

    this.logger.debug("Document structure analysis complete", {
      hasHead: structure.hasHead,
      hasBody: structure.hasBody,
      existingLinksCount: existingLinks.length,
      existingStylesCount: existingStyles.length,
      metaTagsCount: metaTags.length,
      insertPosition: this.options.insertPosition,
      indentationType: structure.indentationPattern.type,
      indentationSize: structure.indentationPattern.size,
    });

    return structure;
  }

  /**
   * Detect indentation pattern from HTML content
   */
  private detectIndentationPattern(
    html: string,
  ): DocumentStructure["indentationPattern"] {
    const lines = html.split("\n");
    const indentations: Array<{ type: "spaces" | "tabs"; size: number }> = [];

    for (const line of lines) {
      if (line.trim().length === 0) continue; // Skip empty lines

      const leadingWhitespace = line.match(/^(\s*)/)?.[1] || "";
      if (leadingWhitespace.length === 0) continue; // Skip lines with no indentation

      const tabCount = (leadingWhitespace.match(/\t/g) || []).length;
      const spaceCount = (leadingWhitespace.match(/ /g) || []).length;

      if (tabCount > 0 && spaceCount === 0) {
        indentations.push({ type: "tabs", size: tabCount });
      } else if (spaceCount > 0 && tabCount === 0) {
        indentations.push({ type: "spaces", size: spaceCount });
      }
      // Mixed indentation is ignored for pattern detection
    }

    if (indentations.length === 0) {
      return { type: "spaces", size: 2, consistent: true }; // Default
    }

    // Determine most common type
    const tabCount = indentations.filter((i) => i.type === "tabs").length;
    const spaceCount = indentations.filter((i) => i.type === "spaces").length;
    const primaryType = tabCount > spaceCount ? "tabs" : "spaces";

    // Calculate most common size for the primary type
    const sizesOfPrimaryType = indentations
      .filter((i) => i.type === primaryType)
      .map((i) => i.size);

    const sizeFreq: Record<number, number> = {};
    for (const size of sizesOfPrimaryType) {
      sizeFreq[size] = (sizeFreq[size] || 0) + 1;
    }

    let mostCommonSize = 2; // Default
    let maxFreq = 0;
    for (const [size, freq] of Object.entries(sizeFreq)) {
      if (freq > maxFreq) {
        maxFreq = freq;
        mostCommonSize = parseInt(size, 10);
      }
    }

    // Check consistency - be more lenient
    const totalMixed = indentations.length - tabCount - spaceCount;
    const mostCommonSizeCount = sizeFreq[mostCommonSize] || 0;
    const consistent =
      totalMixed === 0 &&
      (indentations.length <= 3 ||
        mostCommonSizeCount / indentations.length > 0.6);

    return {
      type: primaryType,
      size: mostCommonSize,
      consistent,
    };
  }

  /**
   * Calculate relative path from HTML file to CSS file
   */
  private calculateRelativePath(): string {
    this.logger.debug("Calculating relative path", {
      cssPath: this.options.cssPath,
      htmlPath: this.options.htmlPath,
      basePath: this.options.basePath,
      useRelativePaths: this.options.useRelativePaths,
    });

    // If not using relative paths, normalize and return CSS path as absolute
    if (!this.options.useRelativePaths) {
      this.logger.debug("Using absolute path as configured");
      try {
        // For absolute paths, we want to preserve leading slashes and just normalize separators
        const normalizedPath = this.options.cssPath.replace(/\\/g, "/");

        // Use PathUtils validation to ensure it's safe, but don't use its normalization
        // which might remove leading slashes that are important for absolute web paths
        const validationResult = this.pathUtils.validatePath(normalizedPath);
        if (!validationResult.isValid) {
          this.logger.warn("CSS path validation failed, using as-is", {
            cssPath: this.options.cssPath,
            validationDetails: validationResult.errors.join(", "),
          });
        }

        return normalizedPath;
      } catch (error) {
        this.logger.warn("Failed to process absolute CSS path, using as-is", {
          cssPath: this.options.cssPath,
          error: error instanceof Error ? error.message : String(error),
        });
        return this.options.cssPath.replace(/\\/g, "/");
      }
    }

    try {
      // Use PathUtils for enhanced relative path calculation
      const result: RelativePathResult = this.pathUtils.calculateRelativePath(
        this.options.htmlPath,
        this.options.cssPath,
      );

      this.logger.debug("Relative path calculated using PathUtils", {
        fromPath: result.metadata.fromPath,
        toPath: result.metadata.toPath,
        relativePath: result.relativePath,
        isValid: result.isValid,
        depth: result.metadata.depth,
      });

      if (!result.isValid) {
        throw new PathCalculationError(
          `Invalid path calculation result: Unknown validation error`,
          this.options.htmlPath,
          this.options.cssPath,
        );
      }

      return result.relativePath;
    } catch (error) {
      this.logger.error("Failed to calculate relative path using PathUtils", {
        cssPath: this.options.cssPath,
        htmlPath: this.options.htmlPath,
        basePath: this.options.basePath,
        error: error instanceof Error ? error.message : String(error),
      });

      // If it's already a PathUtilsError, wrap it in PathCalculationError
      if (error instanceof PathUtilsError) {
        throw new PathCalculationError(
          `PathUtils calculation failed: ${error.message}`,
          this.options.htmlPath,
          this.options.cssPath,
          error,
        );
      }

      throw new PathCalculationError(
        `Failed to calculate relative path from HTML to CSS: ${error instanceof Error ? error.message : String(error)}`,
        this.options.htmlPath,
        this.options.cssPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Detect duplicate CSS links
   */
  private detectDuplicate(
    structure: DocumentStructure,
    targetPath: string,
  ): {
    element: cheerio.Cheerio<AnyNode>;
    href: string;
    index: number;
  } | null {
    this.logger.debug("Checking for duplicate CSS links", {
      targetPath,
      existingLinksCount: structure.existingLinks.length,
    });

    // Check if the target path matches any existing link
    for (let i = 0; i < structure.existingLinks.length; i++) {
      const existingLink = structure.existingLinks[i];

      // Only check stylesheet links
      if (existingLink.rel !== "stylesheet") {
        continue;
      }

      // Normalize paths for comparison
      const normalizedExisting = this.normalizePath(existingLink.href);
      const normalizedTarget = this.normalizePath(targetPath);

      // Check for exact match or path equivalence
      if (normalizedExisting === normalizedTarget) {
        this.logger.debug("Duplicate CSS link detected", {
          existingHref: existingLink.href,
          targetPath,
          normalizedExisting,
          normalizedTarget,
          index: i,
        });

        return {
          element: existingLink.element,
          href: existingLink.href,
          index: i,
        };
      }
    }

    this.logger.debug("No duplicate CSS links found");
    return null;
  }

  /**
   * Handle duplicate CSS links according to strategy
   */
  private handleDuplicate(
    duplicate: {
      element: cheerio.Cheerio<AnyNode>;
      href: string;
      index: number;
    },
    $: cheerio.CheerioAPI,
    structure: DocumentStructure,
  ): "skipped" | "replaced" | "error" {
    this.logger.debug("Handling duplicate CSS link", {
      strategy: this.options.duplicateStrategy,
      existingHref: duplicate.href,
      targetPath: this.calculateRelativePath(),
    });

    switch (this.options.duplicateStrategy) {
      case "skip": {
        this.logger.info("Skipping CSS injection due to duplicate", {
          existingHref: duplicate.href,
        });
        return "skipped";
      }

      case "replace": {
        this.logger.info("Replacing existing CSS link with new one", {
          existingHref: duplicate.href,
          newHref: this.calculateRelativePath(),
        });

        // Remove the existing link element
        duplicate.element.remove();

        // Update the structure to reflect the removal
        structure.existingLinks.splice(duplicate.index, 1);

        return "replaced";
      }

      case "error": {
        const relativePath = this.calculateRelativePath();
        throw new DuplicateInjectionError(
          `Duplicate CSS link detected and configured to error`,
          duplicate.href,
          relativePath,
          "duplicate-detection",
        );
      }

      default: {
        // Should never reach here due to Zod validation, but handle gracefully
        this.logger.warn("Unknown duplicate strategy, defaulting to skip", {
          strategy: this.options.duplicateStrategy,
        });
        return "skipped";
      }
    }
  }

  /**
   * Normalize path for comparison using PathUtils
   */
  private normalizePath(inputPath: string): string {
    try {
      // Use PathUtils for consistent normalization
      return this.pathUtils.normalizePath(inputPath);
    } catch (error) {
      this.logger.warn("PathUtils normalization failed, using fallback", {
        inputPath,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to basic normalization if PathUtils fails
      let normalized = inputPath.toLowerCase();
      normalized = normalized.replace(/\\/g, "/");
      normalized = normalized.replace(/^\.\//, "");
      normalized = normalized.replace(/\/+/g, "/");
      normalized = normalized.replace(/\/$/, "");
      return normalized;
    }
  }

  /**
   * Inject CSS link tag into document
   */
  private injectLinkTag(
    $: cheerio.CheerioAPI,
    structure: DocumentStructure,
    relativePath: string,
  ): void {
    this.logger.debug("Injecting CSS link tag", {
      relativePath,
      insertPosition: this.options.insertPosition,
      hasHead: structure.hasHead,
    });

    // Ensure head element exists
    let head = $("head");
    if (!structure.hasHead && this.options.createHeadIfMissing) {
      this.logger.debug("Creating missing head element");

      // Find html element or create if missing
      let html = $("html");
      if (html.length === 0) {
        // Wrap existing content in html if no html tag exists
        const bodyContent = $.root().html();
        $.root().empty().append("<html></html>");
        html = $("html");
        if (bodyContent && bodyContent.trim()) {
          html.append(`<body>${bodyContent}</body>`);
        }
      }

      // Insert head as first child of html
      html.prepend("<head></head>");
      head = $("head");
    } else if (!structure.hasHead) {
      throw new HtmlStructureError(
        "HTML document has no head section and createHeadIfMissing is false",
        $.html(),
      );
    }

    // Create the link element with proper attributes
    const linkAttributes = {
      rel: this.options.linkAttributes.rel,
      type: this.options.linkAttributes.type,
      href: relativePath,
      ...(this.options.linkAttributes.media && {
        media: this.options.linkAttributes.media,
      }),
    };

    // Build link tag string
    const linkTagAttributes = Object.entries(linkAttributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");
    const linkTag = `<link ${linkTagAttributes}>`;

    // Apply indentation for proper formatting
    const indentation = this.generateIndentation(structure.indentationPattern);
    const indentedLinkTag = `${indentation}${linkTag}`;

    // Insert the link tag based on position strategy
    switch (this.options.insertPosition) {
      case "first": {
        // Insert as first child of head
        if (head.children().length > 0) {
          head.children().first().before(indentedLinkTag);
        } else {
          head.append(indentedLinkTag);
        }
        break;
      }
      case "last": {
        // Append to end of head
        head.append(indentedLinkTag);
        break;
      }
      case "after-meta": {
        // Insert after the last meta tag or as first child
        const lastMeta = head.find("meta").last();
        if (lastMeta.length > 0) {
          lastMeta.after(indentedLinkTag);
        } else {
          if (head.children().length > 0) {
            head.children().first().before(indentedLinkTag);
          } else {
            head.append(indentedLinkTag);
          }
        }
        break;
      }
      case "before-existing": {
        // Insert before the first existing stylesheet
        const firstStylesheet = head.find('link[rel="stylesheet"]').first();
        if (firstStylesheet.length > 0) {
          firstStylesheet.before(indentedLinkTag);
        } else {
          // No existing stylesheets, append to end
          head.append(indentedLinkTag);
        }
        break;
      }
      default: {
        // Default to last position
        head.append(indentedLinkTag);
        break;
      }
    }

    this.logger.debug("CSS link tag injected successfully", {
      relativePath,
      position: this.options.insertPosition,
      linkAttributes,
    });
  }

  /**
   * Generate proper indentation string based on detected pattern
   */
  private generateIndentation(
    pattern: DocumentStructure["indentationPattern"],
  ): string {
    const { type, size } = pattern;

    if (type === "tabs") {
      return "\t".repeat(Math.max(1, size));
    } else {
      // Use spaces, default to 2 if size is 0 or inconsistent
      const spaceCount = size > 0 ? size : 2;
      return " ".repeat(spaceCount);
    }
  }
}

/**
 * CSS injection request interface for validation
 */
export interface CssInjectionRequest {
  cssFilePath: string;
  htmlFilePath: string;
  position?: string;
  options?: Partial<CssInjectionOptions>;
}

/**
 * Factory function to create CSS injector
 */
export function createCssInjector(
  options: Partial<CssInjectionOptions> = {},
): CssInjector {
  return new CssInjector(options);
}

/**
 * Utility function to validate CSS injection request
 */
export function validateInjectionRequest(request: CssInjectionRequest): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!request.cssFilePath) {
    errors.push("CSS file path is required");
  }

  if (!request.htmlFilePath) {
    errors.push("HTML file path is required");
  }

  if (
    request.position &&
    !["before-existing", "after-existing", "first", "last"].includes(
      request.position,
    )
  ) {
    errors.push("Invalid injection position");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
