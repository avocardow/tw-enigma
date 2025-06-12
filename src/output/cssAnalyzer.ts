/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "crypto";
import { writeFile, readFile } from "fs/promises";
import { join, dirname, basename, extname } from "path";
import { createSourceMapGenerator, SourceMapGenerator } from "source-map";
import type { CssOutputConfig } from "./cssOutputConfig.js";
import type { CssChunk, ChunkingStats } from "./cssChunker.js";
import type { HashedAsset } from "./assetHasher.js";
import type { CssBundle, Rule, Selector, RuleType } from "./cssTypes.js";

// Analysis Types
export interface CssAnalysisReport {
  summary: AnalysisSummary;
  chunks: ChunkAnalysis[];
  assets: AssetAnalysis[];
  performance: PerformanceMetrics;
  optimization: OptimizationSuggestions;
  warnings: Warning[];
  sourceMap?: SourceMapData;
  timestamp: number;
  version: string;
}

export interface AnalysisSummary {
  totalSize: number;
  compressedSize: number;
  chunkCount: number;
  assetCount: number;
  compressionRatio: number;
  minificationSavings: number;
  duplicateBytes: number;
  unusedBytes: number;
  criticalCssRatio?: number;
}

export interface ChunkAnalysis {
  id: string;
  name: string;
  size: number;
  compressedSize?: number;
  isEntry: boolean;
  isVendor: boolean;
  isAsync: boolean;
  loadingPriority: "critical" | "high" | "medium" | "low";
  dependencies: string[];
  selectors: SelectorAnalysis[];
  mediaQueries: MediaQueryAnalysis[];
  customProperties: CustomPropertyAnalysis[];
  duplicateRules: DuplicateRuleAnalysis[];
}

export interface AssetAnalysis {
  originalPath: string;
  hashedPath: string;
  size: number;
  compressedSize?: number;
  compressionType?: string;
  compressionRatio?: number;
  isMinified: boolean;
  sourceMapSize?: number;
  optimization: {
    canMinify: boolean;
    canCompress: boolean;
    estimatedSavings: number;
    suggestions: string[];
  };
}

export interface SelectorAnalysis {
  selector: string;
  specificity: number;
  count: number;
  isDuplicate: boolean;
  complexity: "simple" | "moderate" | "complex";
  size: number;
}

export interface MediaQueryAnalysis {
  query: string;
  size: number;
  ruleCount: number;
  breakpoint?: string;
  canOptimize: boolean;
}

export interface CustomPropertyAnalysis {
  property: string;
  value: string;
  usage: number;
  isUnused: boolean;
  scope: "global" | "component" | "local";
}

export interface DuplicateRuleAnalysis {
  selector: string;
  rules: string[];
  count: number;
  wastedBytes: number;
  canMerge: boolean;
}

export interface PerformanceMetrics {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  renderBlockingTime: number;
  criticalResourceCount: number;
  totalResourceSize: number;
  estimatedLoadTime: {
    fast3g: number;
    slow3g: number;
    cable: number;
  };
}

export interface OptimizationSuggestions {
  critical: Suggestion[];
  high: Suggestion[];
  medium: Suggestion[];
  low: Suggestion[];
}

export interface Suggestion {
  type:
    | "minification"
    | "compression"
    | "chunking"
    | "critical-css"
    | "duplicates"
    | "unused-css";
  message: string;
  impact: "critical" | "high" | "medium" | "low";
  estimatedSavings: number;
  effort: "low" | "medium" | "high";
  implementation: string;
}

export interface Warning {
  type: "size" | "performance" | "compatibility" | "optimization";
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;
  line?: number;
  column?: number;
  rule?: string;
  suggestion?: string;
}

export interface SourceMapData {
  file: string;
  sourceRoot: string;
  sources: string[];
  mappings: string;
  size: number;
}

// CSS Analysis Engine
export class CssAnalyzer {
  private config: CssOutputConfig;

  constructor(config: CssOutputConfig) {
    this.config = config;
  }

  /**
   * Analyze CSS chunks and assets comprehensively
   */
  async analyzeCss(
    chunks: CssChunk[],
    assets: HashedAsset[],
    options: {
      analyzeSelectors?: boolean;
      analyzeMediaQueries?: boolean;
      analyzeDuplicates?: boolean;
      generateSourceMap?: boolean;
    } = {},
  ): Promise<CssAnalysisReport> {
    const startTime = Date.now();

    // Analyze chunks
    const chunkAnalyses = await Promise.all(
      chunks.map((chunk) => this.analyzeChunk(chunk, options)),
    );

    // Analyze assets
    const assetAnalyses = await Promise.all(
      assets.map((asset) => this.analyzeAsset(asset)),
    );

    // Calculate summary metrics
    const summary = this.calculateSummary(chunks, assets, chunkAnalyses);

    // Generate performance metrics
    const performance = this.calculatePerformanceMetrics(
      summary,
      chunkAnalyses,
    );

    // Generate optimization suggestions
    const optimization = this.generateOptimizationSuggestions(
      chunkAnalyses,
      assetAnalyses,
      summary,
    );

    // Generate warnings
    const warnings = this.generateWarnings(
      chunkAnalyses,
      assetAnalyses,
      summary,
    );

    // Generate source map if requested
    let sourceMap: SourceMapData | undefined;
    if (options.generateSourceMap && this.config.optimization.sourceMap) {
      sourceMap = await this.generateSourceMap(chunks);
    }

    const report: CssAnalysisReport = {
      summary,
      chunks: chunkAnalyses,
      assets: assetAnalyses,
      performance,
      optimization,
      warnings,
      sourceMap,
      timestamp: Date.now(),
      version: "1.0.0",
    };

    return report;
  }

  /**
   * Analyze individual CSS chunk
   */
  private async analyzeChunk(
    chunk: CssChunk,
    options: any,
  ): Promise<ChunkAnalysis> {
    const selectors = options.analyzeSelectors
      ? this.analyzeSelectors(chunk.content)
      : [];
    const mediaQueries = options.analyzeMediaQueries
      ? this.analyzeMediaQueries(chunk.content)
      : [];
    const customProperties = this.analyzeCustomProperties(chunk.content);
    const duplicateRules = options.analyzeDuplicates
      ? this.analyzeDuplicateRules(chunk.content)
      : [];

    return {
      id: chunk.id,
      name: chunk.name,
      size: chunk.size,
      compressedSize: chunk.compressedSize,
      isEntry: chunk.isEntry,
      isVendor: chunk.isVendor,
      isAsync: chunk.isAsync,
      loadingPriority: this.calculateLoadingPriority(chunk),
      dependencies: chunk.dependencies,
      selectors,
      mediaQueries,
      customProperties,
      duplicateRules,
    };
  }

  /**
   * Analyze individual asset
   */
  private async analyzeAsset(asset: HashedAsset): Promise<AssetAnalysis> {
    const optimization = await this.analyzeAssetOptimization(asset);

    return {
      originalPath: asset.originalPath,
      hashedPath: asset.hashedPath,
      size: asset.size,
      compressedSize: asset.compressedSize,
      compressionType: asset.compressionType,
      compressionRatio: asset.compressionRatio,
      isMinified: asset.isMinified,
      sourceMapSize: asset.sourceMapPath
        ? await this.getSourceMapSize(asset.sourceMapPath)
        : undefined,
      optimization,
    };
  }

  /**
   * Analyze CSS selectors
   */
  private analyzeSelectors(css: string): SelectorAnalysis[] {
    const selectorRegex = /([^{}]+)\s*\{([^}]*)\}/g;
    const selectors: SelectorAnalysis[] = [];
    const selectorCounts = new Map<string, number>();
    let match;

    while ((match = selectorRegex.exec(css)) !== null) {
      const selector = match[1].trim();
      const rules = match[2].trim();

      if (selector && !selector.startsWith("@")) {
        const count = selectorCounts.get(selector) || 0;
        selectorCounts.set(selector, count + 1);

        selectors.push({
          selector,
          specificity: this.calculateSpecificity(selector),
          count: count + 1,
          isDuplicate: count > 0,
          complexity: this.classifyComplexity(selector),
          size: Buffer.byteLength(match[0], "utf8"),
        });
      }
    }

    return selectors;
  }

  /**
   * Analyze media queries
   */
  private analyzeMediaQueries(css: string): MediaQueryAnalysis[] {
    const mediaQueryRegex =
      /@media\s+([^{]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    const mediaQueries: MediaQueryAnalysis[] = [];
    let match;

    while ((match = mediaQueryRegex.exec(css)) !== null) {
      const query = match[1].trim();
      const content = match[2];
      const ruleCount = (content.match(/\{/g) || []).length;

      mediaQueries.push({
        query,
        size: Buffer.byteLength(match[0], "utf8"),
        ruleCount,
        breakpoint: this.extractBreakpoint(query),
        canOptimize: this.canOptimizeMediaQuery(query, content),
      });
    }

    return mediaQueries;
  }

  /**
   * Analyze CSS custom properties
   */
  private analyzeCustomProperties(css: string): CustomPropertyAnalysis[] {
    const propertyRegex = /--([\w-]+):\s*([^;]+);/g;
    const usageRegex = /var\(--([\w-]+)/g;
    const properties: CustomPropertyAnalysis[] = [];
    const propertyDefs = new Map<string, string>();
    const propertyUsage = new Map<string, number>();

    // Find property definitions
    let match;
    while ((match = propertyRegex.exec(css)) !== null) {
      const property = `--${match[1]}`;
      const value = match[2].trim();
      propertyDefs.set(property, value);
    }

    // Count property usage
    while ((match = usageRegex.exec(css)) !== null) {
      const property = `--${match[1]}`;
      const count = propertyUsage.get(property) || 0;
      propertyUsage.set(property, count + 1);
    }

    // Create analysis for each property
    for (const [property, value] of propertyDefs) {
      const usage = propertyUsage.get(property) || 0;
      properties.push({
        property,
        value,
        usage,
        isUnused: usage === 0,
        scope: this.determinePropertyScope(property, css),
      });
    }

    return properties;
  }

  /**
   * Analyze duplicate CSS rules
   */
  private analyzeDuplicateRules(css: string): DuplicateRuleAnalysis[] {
    const ruleRegex = /([^{}]+)\s*\{([^}]*)\}/g;
    const ruleMap = new Map<
      string,
      { selector: string; rules: string; count: number; size: number }
    >();
    const duplicates: DuplicateRuleAnalysis[] = [];
    let match;

    while ((match = ruleRegex.exec(css)) !== null) {
      const selector = match[1].trim();
      const rules = match[2].trim();
      const key = `${selector}:${rules}`;
      const size = Buffer.byteLength(match[0], "utf8");

      if (ruleMap.has(key)) {
        const existing = ruleMap.get(key)!;
        existing.count++;
        existing.size += size;
      } else {
        ruleMap.set(key, { selector, rules, count: 1, size });
      }
    }

    for (const [key, data] of ruleMap) {
      if (data.count > 1) {
        duplicates.push({
          selector: data.selector,
          rules: [data.rules],
          count: data.count,
          wastedBytes: data.size - data.size / data.count,
          canMerge: this.canMergeRules(data.selector, data.rules),
        });
      }
    }

    return duplicates;
  }

  /**
   * Calculate CSS selector specificity
   */
  private calculateSpecificity(selector: string): number {
    let specificity = 0;

    // Count IDs (100 points each)
    specificity += (selector.match(/#/g) || []).length * 100;

    // Count classes, attributes, pseudo-classes (10 points each)
    specificity += (selector.match(/[\.\[:](?!:)/g) || []).length * 10;

    // Count elements and pseudo-elements (1 point each)
    specificity += (
      selector.match(/(?:^|[\s>+~])(?:[a-z]+|::?[a-z-]+)/gi) || []
    ).length;

    return specificity;
  }

  /**
   * Classify selector complexity
   */
  private classifyComplexity(
    selector: string,
  ): "simple" | "moderate" | "complex" {
    const parts = selector.split(/[\s>+~]/).length;
    const specificity = this.calculateSpecificity(selector);

    if (parts <= 2 && specificity <= 20) return "simple";
    if (parts <= 4 && specificity <= 50) return "moderate";
    return "complex";
  }

  /**
   * Extract breakpoint from media query
   */
  private extractBreakpoint(query: string): string | undefined {
    const breakpointMatch = query.match(
      /(?:min-width|max-width):\s*(\d+(?:\.\d+)?)(px|em|rem)/,
    );
    return breakpointMatch
      ? `${breakpointMatch[1]}${breakpointMatch[2]}`
      : undefined;
  }

  /**
   * Check if media query can be optimized
   */
  private canOptimizeMediaQuery(query: string, content: string): boolean {
    // Simple heuristics for optimization potential
    const ruleCount = (content.match(/\{/g) || []).length;
    const hasRedundantRules =
      content.includes("display: none") && ruleCount > 1;
    const hasEmptyRules = /\{\s*\}/.test(content);

    return hasRedundantRules || hasEmptyRules || ruleCount < 2;
  }

  /**
   * Determine CSS custom property scope
   */
  private determinePropertyScope(
    property: string,
    css: string,
  ): "global" | "component" | "local" {
    if (css.includes(`:root { ${property}:`)) return "global";
    if (css.includes(`html { ${property}:`)) return "global";

    const usageCount = (
      css.match(
        new RegExp(
          `var\\(${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "g",
        ),
      ) || []
    ).length;
    return usageCount > 5 ? "component" : "local";
  }

  /**
   * Check if CSS rules can be merged
   */
  private canMergeRules(selector: string, rules: string): boolean {
    // Avoid merging media queries or complex selectors
    if (
      selector.includes("@") ||
      selector.includes(":hover") ||
      selector.includes(":focus")
    ) {
      return false;
    }

    // Check for conflicting properties
    const properties = rules
      .split(";")
      .map((rule) => rule.split(":")[0].trim())
      .filter(Boolean);
    return new Set(properties).size === properties.length;
  }

  /**
   * Calculate loading priority for chunk
   */
  private calculateLoadingPriority(
    chunk: CssChunk,
  ): "critical" | "high" | "medium" | "low" {
    if (chunk.isEntry) return "critical";
    if (chunk.isVendor) return "high";
    if (!chunk.isAsync) return "medium";
    return "low";
  }

  /**
   * Calculate summary metrics
   */
  private calculateSummary(
    chunks: CssChunk[],
    assets: HashedAsset[],
    chunkAnalyses: ChunkAnalysis[],
  ): AnalysisSummary {
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const compressedSize = chunks.reduce(
      (sum, chunk) => sum + (chunk.compressedSize || chunk.size),
      0,
    );
    const minifiedAssets = assets.filter((asset) => asset.isMinified);
    const minificationSavings = minifiedAssets.length > 0 ? totalSize * 0.3 : 0; // Estimate

    const duplicateBytes = chunkAnalyses.reduce(
      (sum, analysis) =>
        sum +
        analysis.duplicateRules.reduce(
          (ruleSum, rule) => ruleSum + rule.wastedBytes,
          0,
        ),
      0,
    );

    return {
      totalSize,
      compressedSize,
      chunkCount: chunks.length,
      assetCount: assets.length,
      compressionRatio: totalSize > 0 ? compressedSize / totalSize : 1,
      minificationSavings,
      duplicateBytes,
      unusedBytes: 0, // Would need dead code analysis
      criticalCssRatio: undefined, // Would need critical CSS analysis
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    summary: AnalysisSummary,
    chunkAnalyses: ChunkAnalysis[],
  ): PerformanceMetrics {
    const criticalResourceCount = chunkAnalyses.filter(
      (chunk) =>
        chunk.loadingPriority === "critical" ||
        chunk.loadingPriority === "high",
    ).length;

    // Estimates based on typical network conditions
    const fast3gTime = (summary.compressedSize / 1024) * 0.1; // ~100ms per KB
    const slow3gTime = (summary.compressedSize / 1024) * 0.5; // ~500ms per KB
    const cableTime = (summary.compressedSize / 1024) * 0.02; // ~20ms per KB

    return {
      firstContentfulPaint: fast3gTime * 1.2,
      largestContentfulPaint: fast3gTime * 1.5,
      cumulativeLayoutShift: 0.1, // Estimate
      renderBlockingTime: criticalResourceCount * 100,
      criticalResourceCount,
      totalResourceSize: summary.totalSize,
      estimatedLoadTime: {
        fast3g: fast3gTime,
        slow3g: slow3gTime,
        cable: cableTime,
      },
    };
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    chunkAnalyses: ChunkAnalysis[],
    assetAnalyses: AssetAnalysis[],
    summary: AnalysisSummary,
  ): OptimizationSuggestions {
    const suggestions: OptimizationSuggestions = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    // Large file warnings
    for (const chunk of chunkAnalyses) {
      if (chunk.size > this.config.reporting.maxAssetSize) {
        suggestions.critical.push({
          type: "chunking",
          message: `Chunk ${chunk.name} is ${Math.round(chunk.size / 1024)}KB, consider splitting`,
          impact: "critical",
          estimatedSavings: chunk.size * 0.3,
          effort: "medium",
          implementation: "Enable chunking or reduce chunk size",
        });
      }
    }

    // Compression suggestions
    for (const asset of assetAnalyses) {
      if (asset.optimization.canCompress && !asset.compressedSize) {
        suggestions.high.push({
          type: "compression",
          message: `Asset ${asset.originalPath} can be compressed`,
          impact: "high",
          estimatedSavings: asset.optimization.estimatedSavings,
          effort: "low",
          implementation: "Enable compression in build configuration",
        });
      }
    }

    // Duplicate rule suggestions
    for (const chunk of chunkAnalyses) {
      const duplicateWaste = chunk.duplicateRules.reduce(
        (sum, rule) => sum + rule.wastedBytes,
        0,
      );
      if (duplicateWaste > 1024) {
        // More than 1KB of duplicates
        suggestions.medium.push({
          type: "duplicates",
          message: `Chunk ${chunk.name} has ${Math.round(duplicateWaste / 1024)}KB of duplicate rules`,
          impact: "medium",
          estimatedSavings: duplicateWaste,
          effort: "medium",
          implementation: "Enable rule merging and deduplication",
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(
    chunkAnalyses: ChunkAnalysis[],
    assetAnalyses: AssetAnalysis[],
    summary: AnalysisSummary,
  ): Warning[] {
    const warnings: Warning[] = [];

    // Size warnings
    if (summary.totalSize > this.config.reporting.maxEntrypointSize) {
      warnings.push({
        type: "size",
        severity: "warning",
        message: `Total CSS size (${Math.round(summary.totalSize / 1024)}KB) exceeds recommended limit`,
        suggestion: "Consider code splitting or removing unused CSS",
      });
    }

    // Performance warnings
    for (const chunk of chunkAnalyses) {
      if (chunk.loadingPriority === "critical" && chunk.size > 14 * 1024) {
        warnings.push({
          type: "performance",
          severity: "warning",
          message: `Critical chunk ${chunk.name} is larger than 14KB`,
          file: chunk.name,
          suggestion: "Extract non-critical CSS or reduce critical path",
        });
      }
    }

    // Optimization warnings
    const unminifiedAssets = assetAnalyses.filter((asset) => !asset.isMinified);
    if (unminifiedAssets.length > 0) {
      warnings.push({
        type: "optimization",
        severity: "warning",
        message: `${unminifiedAssets.length} assets are not minified`,
        suggestion: "Enable minification for production builds",
      });
    }

    return warnings;
  }

  /**
   * Generate source map data
   */
  private async generateSourceMap(chunks: CssChunk[]): Promise<SourceMapData> {
    const generator = new SourceMapGenerator({
      file: "output.css",
      sourceRoot: "",
    });

    let line = 1;
    const column = 0;

    for (const chunk of chunks) {
      const lines = chunk.content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        generator.addMapping({
          generated: { line, column: 0 },
          original: { line: i + 1, column: 0 },
          source: chunk.name,
          name: chunk.id,
        });
        line++;
      }
    }

    const sourceMap = generator.toString();
    return {
      file: "output.css",
      sourceRoot: "",
      sources: chunks.map((chunk) => chunk.name),
      mappings: JSON.parse(sourceMap).mappings,
      size: Buffer.byteLength(sourceMap, "utf8"),
    };
  }

  /**
   * Analyze asset optimization potential
   */
  private async analyzeAssetOptimization(asset: HashedAsset): Promise<any> {
    const canMinify = !asset.isMinified;
    const canCompress = !asset.compressedSize && asset.size > 1024;
    const estimatedSavings =
      (canMinify ? asset.size * 0.3 : 0) + (canCompress ? asset.size * 0.7 : 0);

    const suggestions: string[] = [];
    if (canMinify) suggestions.push("Enable minification");
    if (canCompress) suggestions.push("Enable compression");
    if (asset.size > 100 * 1024)
      suggestions.push("Consider chunking large assets");

    return {
      canMinify,
      canCompress,
      estimatedSavings,
      suggestions,
    };
  }

  /**
   * Get source map file size
   */
  private async getSourceMapSize(sourceMapPath: string): Promise<number> {
    try {
      const content = await readFile(sourceMapPath, "utf8");
      return Buffer.byteLength(content, "utf8");
    } catch {
      return 0;
    }
  }
}

// Report Generation and Export
export class CssReportGenerator {
  private config: CssOutputConfig;

  constructor(config: CssOutputConfig) {
    this.config = config;
  }

  /**
   * Generate comprehensive HTML report
   */
  generateHtmlReport(report: CssAnalysisReport): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CSS Analysis Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; color: #0066cc; }
        .section { margin-bottom: 30px; }
        .warning { padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; margin: 10px 0; }
        .error { background: #f8d7da; border-left-color: #dc3545; }
        .chunk { background: white; border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .suggestions { list-style: none; padding: 0; }
        .suggestion { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .critical { background: #f8d7da; }
        .high { background: #fff3cd; }
        .medium { background: #d1ecf1; }
        .low { background: #d4edda; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>CSS Analysis Report</h1>
        <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
        
        <div class="summary">
          <div class="metric">
            <h3>Total Size</h3>
            <div class="value">${Math.round(report.summary.totalSize / 1024)}KB</div>
          </div>
          <div class="metric">
            <h3>Compressed Size</h3>
            <div class="value">${Math.round(report.summary.compressedSize / 1024)}KB</div>
          </div>
          <div class="metric">
            <h3>Compression Ratio</h3>
            <div class="value">${Math.round(report.summary.compressionRatio * 100)}%</div>
          </div>
          <div class="metric">
            <h3>Chunks</h3>
            <div class="value">${report.summary.chunkCount}</div>
          </div>
        </div>

        ${this.generateWarningsSection(report.warnings)}
        ${this.generateSuggestionsSection(report.optimization)}
        ${this.generateChunksSection(report.chunks)}
        ${this.generatePerformanceSection(report.performance)}
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate JSON report
   */
  generateJsonReport(report: CssAnalysisReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report: CssAnalysisReport): string {
    return `
# CSS Analysis Report

Generated on ${new Date(report.timestamp).toLocaleString()}

## Summary

| Metric | Value |
|--------|-------|
| Total Size | ${Math.round(report.summary.totalSize / 1024)}KB |
| Compressed Size | ${Math.round(report.summary.compressedSize / 1024)}KB |
| Compression Ratio | ${Math.round(report.summary.compressionRatio * 100)}% |
| Chunks | ${report.summary.chunkCount} |

## Warnings

${report.warnings.map((w) => `- **${w.severity.toUpperCase()}**: ${w.message}`).join("\n")}

## Critical Suggestions

${report.optimization.critical.map((s) => `- ${s.message} (${Math.round(s.estimatedSavings / 1024)}KB savings)`).join("\n")}

## Performance Metrics

- **Estimated Load Time (3G)**: ${Math.round(report.performance.estimatedLoadTime.fast3g)}ms
- **Critical Resources**: ${report.performance.criticalResourceCount}
- **Total Resource Size**: ${Math.round(report.performance.totalResourceSize / 1024)}KB
    `;
  }

  /**
   * Save report to file
   */
  async saveReport(
    report: CssAnalysisReport,
    format: "html" | "json" | "markdown" = "json",
    outputPath?: string,
  ): Promise<string> {
    const path = outputPath || this.config.reporting.outputPath;
    let content: string;
    let finalPath: string;

    switch (format) {
      case "html":
        content = this.generateHtmlReport(report);
        finalPath = path.replace(/\.json$/, ".html");
        break;
      case "markdown":
        content = this.generateMarkdownReport(report);
        finalPath = path.replace(/\.json$/, ".md");
        break;
      default:
        content = this.generateJsonReport(report);
        finalPath = path;
    }

    await writeFile(finalPath, content, "utf8");
    return finalPath;
  }

  private generateWarningsSection(warnings: Warning[]): string {
    if (warnings.length === 0) return "";

    return `
      <div class="section">
        <h2>Warnings</h2>
        ${warnings
          .map(
            (w) => `
          <div class="warning ${w.severity === "error" ? "error" : ""}">
            <strong>${w.severity.toUpperCase()}:</strong> ${w.message}
            ${w.suggestion ? `<br><em>Suggestion: ${w.suggestion}</em>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  private generateSuggestionsSection(
    optimization: OptimizationSuggestions,
  ): string {
    const allSuggestions = [
      ...optimization.critical.map((s) => ({ ...s, priority: "critical" })),
      ...optimization.high.map((s) => ({ ...s, priority: "high" })),
      ...optimization.medium.map((s) => ({ ...s, priority: "medium" })),
      ...optimization.low.map((s) => ({ ...s, priority: "low" })),
    ];

    if (allSuggestions.length === 0) return "";

    return `
      <div class="section">
        <h2>Optimization Suggestions</h2>
        <ul class="suggestions">
          ${allSuggestions
            .map(
              (s) => `
            <li class="suggestion ${s.priority}">
              <strong>${s.message}</strong><br>
              Impact: ${s.impact}, Effort: ${s.effort}, Savings: ${Math.round(s.estimatedSavings / 1024)}KB<br>
              <em>${s.implementation}</em>
            </li>
          `,
            )
            .join("")}
        </ul>
      </div>
    `;
  }

  private generateChunksSection(chunks: ChunkAnalysis[]): string {
    return `
      <div class="section">
        <h2>Chunk Analysis</h2>
        ${chunks
          .map(
            (chunk) => `
          <div class="chunk">
            <h3>${chunk.name} (${Math.round(chunk.size / 1024)}KB)</h3>
            <p>Priority: ${chunk.loadingPriority}, Entry: ${chunk.isEntry}, Vendor: ${chunk.isVendor}</p>
            <p>Selectors: ${chunk.selectors.length}, Media Queries: ${chunk.mediaQueries.length}</p>
            ${chunk.duplicateRules.length > 0 ? `<p><strong>Duplicate Rules:</strong> ${chunk.duplicateRules.length}</p>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  private generatePerformanceSection(performance: PerformanceMetrics): string {
    return `
      <div class="section">
        <h2>Performance Metrics</h2>
        <div class="summary">
          <div class="metric">
            <h3>Load Time (3G)</h3>
            <div class="value">${Math.round(performance.estimatedLoadTime.fast3g)}ms</div>
          </div>
          <div class="metric">
            <h3>Critical Resources</h3>
            <div class="value">${performance.criticalResourceCount}</div>
          </div>
          <div class="metric">
            <h3>Render Blocking</h3>
            <div class="value">${performance.renderBlockingTime}ms</div>
          </div>
        </div>
      </div>
    `;
  }
}

// CI Integration Utilities
export class CiIntegration {
  private config: CssOutputConfig;

  constructor(config: CssOutputConfig) {
    this.config = config;
  }

  /**
   * Check if analysis should fail CI
   */
  shouldFailCi(report: CssAnalysisReport): boolean {
    // Fail on critical warnings
    if (report.warnings.some((w) => w.severity === "error")) return true;

    // Fail on size thresholds
    if (report.summary.totalSize > this.config.reporting.maxEntrypointSize)
      return true;

    // Fail on performance thresholds
    if (report.performance.estimatedLoadTime.fast3g > 3000) return true; // 3 seconds

    return false;
  }

  /**
   * Generate CI comment/output
   */
  generateCiComment(report: CssAnalysisReport): string {
    const shouldFail = this.shouldFailCi(report);
    const emoji = shouldFail ? "❌" : "✅";

    return `
${emoji} **CSS Analysis Report**

**Summary:**
- Total Size: ${Math.round(report.summary.totalSize / 1024)}KB
- Compressed: ${Math.round(report.summary.compressedSize / 1024)}KB
- Chunks: ${report.summary.chunkCount}
- Compression: ${Math.round(report.summary.compressionRatio * 100)}%

**Performance:**
- Load Time (3G): ${Math.round(report.performance.estimatedLoadTime.fast3g)}ms
- Critical Resources: ${report.performance.criticalResourceCount}

${report.warnings.length > 0 ? `**Warnings:** ${report.warnings.length}` : ""}
${report.optimization.critical.length > 0 ? `**Critical Issues:** ${report.optimization.critical.length}` : ""}

${shouldFail ? "**Build should be reviewed before merging.**" : "**Build looks good!**"}
    `;
  }
}

/**
 * Factory function to create a CSS analyzer instance
 */
export function createCssAnalyzer(): CssAnalyzer {
  return new CssAnalyzer();
}
