/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "fs/promises";
import { join, dirname, basename } from "path";
import type { CssOutputConfig, CriticalCssConfig } from "./cssOutputConfig.ts";

// Critical CSS Types
export interface CriticalCssResult {
  /** CSS to be inlined in the document head */
  inline: string;

  /** CSS files to be preloaded */
  preload: string[];

  /** CSS files to be loaded asynchronously */
  async: string[];
}

export interface CriticalCssOptions {
  url: string;
  html?: string;
  css: string;
  dimensions?: Array<{ width: number; height: number }>;
  timeout?: number;
  inline?: boolean;
  minify?: boolean;
  extract?: boolean;
  ignore?: string[];
  include?: string[];
}

export interface DeliveryOptimization {
  inlineCSS: string;
  externalCSS: string;
  preloadTags: string[];
  resourceHints: string[];
  loadingStrategy: "preload" | "async" | "defer";
}

// Critical CSS Extraction Engine
export class CriticalCssExtractor {
  private config: CriticalCssConfig;

  constructor(config: CriticalCssConfig) {
    this.config = config;
  }

  /**
   * Extract critical CSS from given CSS content
   */
  async extractCritical(
    css: string,
    options: {
      routes?: string[];
      viewport?: { width: number; height: number };
    } = {},
  ): Promise<CriticalCssResult> {
    // Temporary stub implementation
    // In a real implementation, this would analyze the CSS and determine what's critical
    if (!this.config.enabled) {
      return {
        inline: "",
        preload: [],
        async: [css],
      };
    }

    // Simple stub logic - take first portion as critical
    const maxSize = this.config.maxSize || 14336; // 14KB default
    const lines = css.split("\n");
    let inlineSize = 0;
    const inlineLines: string[] = [];

    for (const line of lines) {
      if (inlineSize + line.length > maxSize) {
        break;
      }
      inlineLines.push(line);
      inlineSize += line.length;
    }

    return {
      inline: inlineLines.join("\n"),
      preload: [],
      async:
        inlineLines.length < lines.length
          ? [lines.slice(inlineLines.length).join("\n")]
          : [],
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CriticalCssConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): CriticalCssConfig {
    return this.config;
  }
}

// Delivery Optimization Engine
export class CssDeliveryOptimizer {
  private config: CssOutputConfig;

  constructor(config: CssOutputConfig) {
    this.config = config;
  }

  /**
   * Optimize CSS delivery for performance
   */
  async optimizeDelivery(
    criticalResult: CriticalCssResult,
    options: {
      publicPath?: string;
      filename?: string;
      inlineThreshold?: number;
    } = {},
  ): Promise<DeliveryOptimization> {
    const inlineThreshold =
      options.inlineThreshold || this.config.critical.inlineThreshold;
    const shouldInline = criticalResult.inline.length <= inlineThreshold;

    if (shouldInline) {
      // Inline critical CSS
      return {
        inlineCSS: criticalResult.inline,
        externalCSS: criticalResult.async.join('\n'),
        preloadTags: this.generatePreloadTags(
          options.publicPath,
          options.filename,
        ),
        resourceHints: this.generateResourceHints(),
        loadingStrategy: "preload",
      };
    } else {
      // Keep critical CSS external but prioritize loading
      return {
        inlineCSS: "",
        externalCSS: criticalResult.inline + criticalResult.async.join('\n'),
        preloadTags: this.generatePreloadTags(
          options.publicPath,
          options.filename,
          true,
        ),
        resourceHints: this.generateResourceHints(),
        loadingStrategy: "preload",
      };
    }
  }

  /**
   * Generate HTML preload tags
   */
  private generatePreloadTags(
    publicPath?: string,
    filename?: string,
    critical = false,
  ): string[] {
    const tags: string[] = [];

    if (!(this.config as any).delivery?.preload) return tags;

    const path = publicPath || (this.config as any).output?.publicPath;
    const file = filename || "styles.css";
    const fullPath = `${path}${file}`;

    if (critical) {
      tags.push(
        `<link rel="preload" href="${fullPath}" as="style" onload="this.onload=null;this.rel='stylesheet'">`,
      );
      tags.push(
        `<noscript><link rel="stylesheet" href="${fullPath}"></noscript>`,
      );
    } else {
      tags.push(`<link rel="preload" href="${fullPath}" as="style">`);
    }

    if ((this.config as any).delivery?.modulePreload) {
      tags.push(`<link rel="modulepreload" href="${fullPath}">`);
    }

    return tags;
  }

  /**
   * Generate resource hints
   */
  private generateResourceHints(): string[] {
    const hints: string[] = [];

    if ((this.config as any).delivery?.prefetch) {
      hints.push('<link rel="dns-prefetch" href="//fonts.googleapis.com">');
      hints.push(
        '<link rel="preconnect" href="//fonts.gstatic.com" crossorigin>',
      );
    }

    return hints;
  }

  /**
   * Generate async loading script
   */
  generateAsyncLoader(cssPath: string): string {
    return `
    <script>
    (function() {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '${cssPath}';
      link.media = 'print';
      link.onload = function() { 
        this.media = 'all'; 
      };
      document.head.appendChild(link);
    })();
    </script>
    `;
  }

  /**
   * Generate critical CSS inline script with fallback
   */
  generateInlineScript(criticalCSS: string, fallbackPath: string): string {
    return `
    <style>
    ${criticalCSS}
    </style>
    <script>
    (function() {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '${fallbackPath}';
      link.media = 'print';
      link.onload = function() { 
        this.media = 'all'; 
      };
      document.head.appendChild(link);
    })();
    </script>
    `;
  }
}

// Integrated Critical CSS Pipeline
export class CriticalCssPipeline {
  private extractor: CriticalCssExtractor;
  private optimizer: CssDeliveryOptimizer;
  private config: CssOutputConfig;

  constructor(config: CssOutputConfig) {
    this.config = config;
    this.extractor = new CriticalCssExtractor(config.critical);
    this.optimizer = new CssDeliveryOptimizer(config);
  }

  /**
   * Process CSS for critical path optimization
   */
  async processCriticalCss(
    css: string,
    options: {
      url: string;
      html?: string;
      outputDir?: string;
      filename?: string;
    },
  ): Promise<{
    result: CriticalCssResult;
    delivery: DeliveryOptimization;
    files: {
      critical?: string;
      uncritical?: string;
      inline?: string;
    };
  }> {
    if (!this.config.critical.enabled) {
      throw new Error("Critical CSS extraction is not enabled");
    }

    // Extract critical CSS
    const result = await this.extractor.extractCritical(css, {
      routes: [],
      viewport: { width: 1024, height: 768 },
    });

    // Optimize delivery
    const delivery = await this.optimizer.optimizeDelivery(result, {
                publicPath: (this.config as any).output?.publicPath,
      filename: options.filename,
      inlineThreshold: this.config.critical.inlineThreshold,
    });

    // Save files if output directory provided
    const files: any = {};
    if (options.outputDir) {
      const baseName = options.filename
        ? basename(options.filename, ".css")
        : "styles";

      if (delivery.inlineCSS) {
        const inlinePath = join(options.outputDir, `${baseName}.critical.css`);
        await writeFile(inlinePath, delivery.inlineCSS, "utf8");
        files.inline = inlinePath;
      } else {
        const criticalPath = join(
          options.outputDir,
          `${baseName}.critical.css`,
        );
        await writeFile(criticalPath, (result as any).critical, "utf8");
        files.critical = criticalPath;
      }

      if ((result as any).uncritical?.trim()) {
        const uncriticalPath = join(
          options.outputDir,
          `${baseName}.uncritical.css`,
        );
        await writeFile(uncriticalPath, (result as any).uncritical, "utf8");
        files.uncritical = uncriticalPath;
      }
    }

    return {
      result,
      delivery,
      files,
    };
  }

  /**
   * Process multiple routes for critical CSS
   */
  async processMultipleRoutes(
    css: string,
    routes: Array<{ url: string; html?: string; route: string }>,
    options: {
      outputDir?: string;
      baseFilename?: string;
    } = {},
  ): Promise<Map<string, any>> {
    const results = new Map();

    for (const route of routes) {
      try {
        const filename = options.baseFilename
          ? `${options.baseFilename}.${route.route.replace(/[^a-zA-Z0-9]/g, "-")}.css`
          : `${route.route.replace(/[^a-zA-Z0-9]/g, "-")}.css`;

        const routeResult = await this.processCriticalCss(css, {
          url: route.url,
          html: route.html,
          outputDir: options.outputDir,
          filename,
        });

        results.set(route.route, routeResult);
      } catch (_error) {
        console.warn(
          `Failed to process critical CSS for route ${route.route}:`,
          error,
        );
        results.set(route.route, { error: (error as Error).message });
      }
    }

    return results;
  }

  /**
   * Generate HTML injection templates
   */
  generateHtmlTemplates(delivery: DeliveryOptimization): {
    head: string;
    bodyEnd: string;
  } {
    let head = "";
    let bodyEnd = "";

    // Add resource hints to head
    head += delivery.resourceHints.join("\n") + "\n";

    // Add preload tags to head
    head += delivery.preloadTags.join("\n") + "\n";

    // Add inline CSS or async loader
    if (delivery.inlineCSS) {
      head += `<style>${delivery.inlineCSS}</style>\n`;
      if (delivery.externalCSS) {
        bodyEnd += this.optimizer.generateAsyncLoader("/css/styles.css");
      }
    } else {
      head += delivery.preloadTags.join("\n") + "\n";
    }

    return { head, bodyEnd };
  }
}

/**
 * Factory function to create a critical CSS extractor instance
 */
export function createCriticalCssExtractor(
  config: CriticalCssConfig,
): CriticalCssExtractor {
  return new CriticalCssExtractor(config);
}
