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

/**
 * Configuration options for HTML class extraction
 */
export const HtmlExtractionOptionsSchema = z.object({
  preserveWhitespace: z.boolean().default(false),
  caseSensitive: z.boolean().default(true),
  ignoreEmpty: z.boolean().default(true),
  maxFileSize: z
    .number()
    .min(1)
    .default(10 * 1024 * 1024), // 10MB
  timeout: z.number().min(1).default(5000), // 5 seconds
});

export type HtmlExtractionOptions = z.infer<typeof HtmlExtractionOptionsSchema>;

/**
 * Data structure for individual class information
 */
export interface ClassData {
  name: string;
  frequency: number;
  contexts: Array<{
    tagName: string;
    attributes: Record<string, string>;
    depth: number;
  }>;
}

/**
 * Result of HTML class extraction operation
 */
export interface HtmlClassExtractionResult {
  classes: Map<string, ClassData>;
  totalElements: number;
  totalClasses: number;
  uniqueClasses: number;
  metadata: {
    source: string;
    processedAt: Date;
    processingTime: number;
    fileSize?: number;
    errors: string[];
  };
}

/**
 * Custom error classes for HTML parsing operations
 */
export class HtmlParsingError extends Error {
  constructor(
    message: string,
    public source?: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "HtmlParsingError";
  }
}

export class FileReadError extends Error {
  constructor(
    message: string,
    public filePath?: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = "FileReadError";
  }
}

/**
 * Main HTML class extractor class
 */
export class HtmlExtractor {
  private options: HtmlExtractionOptions;

  constructor(options: Partial<HtmlExtractionOptions> = {}) {
    this.options = HtmlExtractionOptionsSchema.parse(options);
  }

  /**
   * Extract classes from HTML string
   */
  async extractFromString(
    html: string,
    source = "string",
  ): Promise<HtmlClassExtractionResult> {
    const startTime = Date.now();
    const metadata = {
      source,
      processedAt: new Date(),
      processingTime: 0,
      errors: [] as string[],
    };

    try {
      // Load HTML with cheerio
      const $ = cheerio.load(html, {
        xml: {
          xmlMode: false,
          decodeEntities: true,
          withStartIndices: false,
          withEndIndices: false,
        },
      });

      const classes = new Map<string, ClassData>();
      let totalElements = 0;
      let totalClasses = 0;

      // Find all elements with class attributes
      $("[class]").each((index, element) => {
        totalElements++;
        const $element = $(element);
        const classAttr = $element.attr("class");

        if (!classAttr) return;

        // Parse class attribute
        const elementClasses = this.parseClassAttribute(classAttr);
        totalClasses += elementClasses.length;

        // Get element context
        const tagName = element.tagName?.toLowerCase() || "unknown";
        const attributes = element.attribs || {};
        const depth = this.calculateDepth($element);

        // Process each class
        elementClasses.forEach((className) => {
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
              tagName,
              attributes: this.sanitizeAttributes(attributes),
              depth,
            });
          }
        });
      });

      metadata.processingTime = Date.now() - startTime;

      return {
        classes,
        totalElements,
        totalClasses,
        uniqueClasses: classes.size,
        metadata,
      };
    } catch (error) {
      metadata.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      metadata.processingTime = Date.now() - startTime;

      throw new HtmlParsingError(
        `Failed to parse HTML: ${error instanceof Error ? error.message : String(error)}`,
        source,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Extract classes from HTML file
   */
  async extractFromFile(filePath: string): Promise<HtmlClassExtractionResult> {
    try {
      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.options.maxFileSize) {
        throw new FileReadError(
          `File size (${stats.size} bytes) exceeds maximum allowed size (${this.options.maxFileSize} bytes)`,
          filePath,
        );
      }

      // Read file with timeout
      const html = await this.readFileWithTimeout(
        filePath,
        this.options.timeout,
      );
      const result = await this.extractFromString(html, filePath);

      // Add file metadata
      result.metadata.fileSize = stats.size;

      return result;
    } catch (error) {
      if (error instanceof HtmlParsingError || error instanceof FileReadError) {
        throw error;
      }

      throw new FileReadError(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Extract classes from multiple HTML files
   */
  async extractFromFiles(
    filePaths: string[],
  ): Promise<HtmlClassExtractionResult[]> {
    const results: HtmlClassExtractionResult[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.extractFromFile(filePath);
        results.push(result);
      } catch (error) {
        // Create error result for failed files
        results.push({
          classes: new Map(),
          totalElements: 0,
          totalClasses: 0,
          uniqueClasses: 0,
          metadata: {
            source: filePath,
            processedAt: new Date(),
            processingTime: 0,
            errors: [error instanceof Error ? error.message : String(error)],
          },
        });
      }
    }

    return results;
  }

  /**
   * Parse class attribute string into individual class names
   */
  private parseClassAttribute(classAttr: string): string[] {
    if (!classAttr || (!this.options.preserveWhitespace && !classAttr.trim())) {
      return [];
    }

    // Split by whitespace and filter empty strings
    const classes = classAttr
      .split(/\s+/)
      .map((cls) => (this.options.preserveWhitespace ? cls : cls.trim()))
      .filter((cls) => (this.options.ignoreEmpty ? cls.length > 0 : true));

    return classes;
  }

  /**
   * Calculate the depth of an element in the DOM tree
   */
  private calculateDepth($element: cheerio.Cheerio<AnyNode>): number {
    let depth = 0;
    let current = $element.parent();

    while (current.length > 0 && current.prop("tagName") !== "HTML") {
      depth++;
      current = current.parent();
    }

    return depth;
  }

  /**
   * Sanitize element attributes to avoid sensitive data exposure
   */
  private sanitizeAttributes(
    attributes: Record<string, string>,
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedAttributes = ["id", "class", "data-", "aria-"];

    Object.entries(attributes).forEach(([key, value]) => {
      if (allowedAttributes.some((allowed) => key.startsWith(allowed))) {
        sanitized[key] =
          value.length > 100 ? value.substring(0, 100) + "..." : value;
      }
    });

    return sanitized;
  }

  /**
   * Read file with timeout protection
   */
  private async readFileWithTimeout(
    filePath: string,
    timeout: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`File read timeout after ${timeout}ms`));
      }, timeout);

      fs.readFile(filePath, "utf8")
        .then((content) => {
          clearTimeout(timer);
          resolve(content);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

/**
 * Convenience function to create extractor with default options
 */
export function createHtmlExtractor(
  options: Partial<HtmlExtractionOptions> = {},
): HtmlExtractor {
  return new HtmlExtractor(options);
}

/**
 * Convenience function to extract from string with default options
 */
export async function extractClassesFromHtml(
  html: string,
  options: Partial<HtmlExtractionOptions> = {},
): Promise<HtmlClassExtractionResult> {
  const extractor = new HtmlExtractor(options);
  return extractor.extractFromString(html);
}

/**
 * Convenience function to extract from file with default options
 */
export async function extractClassesFromFile(
  filePath: string,
  options: Partial<HtmlExtractionOptions> = {},
): Promise<HtmlClassExtractionResult> {
  const extractor = new HtmlExtractor(options);
  return extractor.extractFromFile(filePath);
}
