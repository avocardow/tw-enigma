/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CssBundle, CssChunk } from "./cssTypes.js";
import type { CssOutputConfig, PerformanceBudget } from "./cssOutputConfig.js";
import type { HashedAsset } from "./assetHasher.js";
import type { ChunkingStats } from "./cssChunker.js";
import type { CriticalCssResult } from "./criticalCssExtractor.js";

/**
 * Performance metrics for CSS bundles
 */
export interface BundlePerformanceMetrics {
  /** Bundle identifier */
  bundleId: string;

  /** Original size in bytes */
  originalSize: number;

  /** Optimized size in bytes */
  optimizedSize: number;

  /** Compressed size in bytes (gzip) */
  compressedSize: number;

  /** Brotli compressed size in bytes */
  brotliSize?: number;

  /** Number of chunks created */
  chunkCount: number;

  /** Average chunk size */
  averageChunkSize: number;

  /** Largest chunk size */
  maxChunkSize: number;

  /** Smallest chunk size */
  minChunkSize: number;

  /** Critical CSS size */
  criticalCssSize: number;

  /** Estimated load time (milliseconds) */
  estimatedLoadTime: number;

  /** Compression ratio (optimized/original) */
  compressionRatio: number;

  /** Time spent on optimization */
  optimizationTime: number;

  /** Number of CSS rules */
  ruleCount: number;

  /** Number of selectors */
  selectorCount: number;

  /** Number of unused rules removed */
  unusedRulesRemoved: number;

  /** Cache efficiency score (0-100) */
  cacheEfficiency: number;
}

/**
 * Global performance summary across all bundles
 */
export interface GlobalPerformanceMetrics {
  /** Total original size */
  totalOriginalSize: number;

  /** Total optimized size */
  totalOptimizedSize: number;

  /** Total compressed size */
  totalCompressedSize: number;

  /** Total number of bundles */
  bundleCount: number;

  /** Total number of chunks */
  totalChunkCount: number;

  /** Overall compression ratio */
  overallCompressionRatio: number;

  /** Total critical CSS size */
  totalCriticalCssSize: number;

  /** Average estimated load time */
  averageLoadTime: number;

  /** Total optimization time */
  totalOptimizationTime: number;

  /** Performance score (0-100) */
  performanceScore: number;

  /** Bundle metrics */
  bundles: BundlePerformanceMetrics[];
}

/**
 * Performance budget violation
 */
export interface BudgetViolation {
  /** Type of budget violated */
  type:
    | "bundle_size"
    | "critical_css"
    | "chunk_count"
    | "load_time"
    | "total_size";

  /** Actual value */
  actual: number;

  /** Budget limit */
  limit: number;

  /** Severity level */
  severity: "warning" | "error";

  /** Description of violation */
  message: string;

  /** Recommendations to fix */
  recommendations: string[];
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  /** Recommendation category */
  category:
    | "chunking"
    | "compression"
    | "critical_css"
    | "caching"
    | "delivery";

  /** Priority level */
  priority: "low" | "medium" | "high";

  /** Title of recommendation */
  title: string;

  /** Detailed description */
  description: string;

  /** Estimated impact */
  impact: string;

  /** Implementation complexity */
  complexity: "simple" | "moderate" | "complex";

  /** Implementation steps */
  steps: string[];
}

/**
 * Complete performance report
 */
export interface CssPerformanceReport {
  /** Report metadata */
  metadata: {
    timestamp: string;
    version: string;
    environment: string;
    configHash: string;
  };

  /** Global performance metrics */
  metrics: GlobalPerformanceMetrics;

  /** Performance budget analysis */
  budgetAnalysis: {
    passed: boolean;
    violations: BudgetViolation[];
    score: number;
  };

  /** Optimization recommendations */
  recommendations: OptimizationRecommendation[];

  /** Configuration summary */
  configuration: {
    strategy: string;
    chunking: any;
    optimization: any;
    compression: any;
  };

  /** Asset manifest */
  assets: HashedAsset[];

  /** Detailed chunk analysis */
  chunkAnalysis: ChunkAnalysisResult[];
}

/**
 * Chunk analysis result
 */
export interface ChunkAnalysisResult {
  /** Chunk identifier */
  chunkId: string;

  /** Chunk size in bytes */
  size: number;

  /** Compressed size */
  compressedSize: number;

  /** Load priority */
  priority: "critical" | "high" | "medium" | "low";

  /** Dependencies */
  dependencies: string[];

  /** Usage frequency score */
  usageScore: number;

  /** Cache hit ratio estimate */
  cacheHitRatio: number;

  /** Optimization opportunities */
  optimizationOpportunities: string[];
}

/**
 * CSS Report Generator for performance analysis and optimization recommendations
 */
export class CssReportGenerator {
  private config: CssOutputConfig;
  private performanceBudget?: PerformanceBudget;

  constructor(config: CssOutputConfig, performanceBudget?: PerformanceBudget) {
    this.config = config;
    this.performanceBudget = performanceBudget;
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(results: {
    bundles: CssBundle[];
    chunks: CssChunk[];
    assets: HashedAsset[];
    chunkingStats: ChunkingStats;
    criticalCss?: CriticalCssResult[];
    optimizationTime: number;
  }): Promise<CssPerformanceReport> {
    const bundleMetrics = this.calculateBundleMetrics(results);
    const globalMetrics = this.calculateGlobalMetrics(bundleMetrics);
    const budgetAnalysis = this.analyzeBudgetCompliance(globalMetrics);
    const recommendations = this.generateRecommendations(
      globalMetrics,
      results,
    );
    const chunkAnalysis = this.analyzeChunks(results.chunks);

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        environment: this.config.environment || "production",
        configHash: this.generateConfigHash(),
      },
      metrics: globalMetrics,
      budgetAnalysis,
      recommendations,
      configuration: {
        strategy: this.config.strategy,
        chunking: this.config.chunking,
        optimization: this.config.optimization,
        compression: this.config.compression,
      },
      assets: results.assets,
      chunkAnalysis,
    };
  }

  /**
   * Calculate performance metrics for individual bundles
   */
  private calculateBundleMetrics(results: {
    bundles: CssBundle[];
    chunks: CssChunk[];
    chunkingStats: ChunkingStats;
    optimizationTime: number;
  }): BundlePerformanceMetrics[] {
    return results.bundles.map((bundle) => {
      const bundleChunks = results.chunks.filter(
        (chunk) => chunk.bundleId === bundle.id,
      );

      const originalSize = bundle.content.length;
      const optimizedSize = bundleChunks.reduce(
        (sum, chunk) => sum + chunk.content.length,
        0,
      );
      const compressedSize = Math.round(optimizedSize * 0.3); // Estimate gzip compression
      const brotliSize = Math.round(optimizedSize * 0.25); // Estimate brotli compression

      const chunkSizes = bundleChunks.map((chunk) => chunk.content.length);
      const criticalCssSize = bundleChunks
        .filter((chunk) => chunk.type === "critical")
        .reduce((sum, chunk) => sum + chunk.content.length, 0);

      return {
        bundleId: bundle.id,
        originalSize,
        optimizedSize,
        compressedSize,
        brotliSize,
        chunkCount: bundleChunks.length,
        averageChunkSize:
          chunkSizes.length > 0
            ? Math.round(
                chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length,
              )
            : 0,
        maxChunkSize: chunkSizes.length > 0 ? Math.max(...chunkSizes) : 0,
        minChunkSize: chunkSizes.length > 0 ? Math.min(...chunkSizes) : 0,
        criticalCssSize,
        estimatedLoadTime: this.estimateLoadTime(
          compressedSize,
          bundleChunks.length,
        ),
        compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 1,
        optimizationTime: results.optimizationTime,
        ruleCount: bundle.rules?.length || 0,
        selectorCount:
          bundle.rules?.reduce(
            (sum, rule) => sum + (rule.selectors?.length || 0),
            0,
          ) || 0,
        unusedRulesRemoved: Math.max(
          0,
          (bundle.rules?.length || 0) -
            bundleChunks.reduce(
              (sum, chunk) => sum + (chunk.rules?.length || 0),
              0,
            ),
        ),
        cacheEfficiency: this.calculateCacheEfficiency(bundleChunks),
      };
    });
  }

  /**
   * Calculate global performance metrics
   */
  private calculateGlobalMetrics(
    bundleMetrics: BundlePerformanceMetrics[],
  ): GlobalPerformanceMetrics {
    const totalOriginalSize = bundleMetrics.reduce(
      (sum, bundle) => sum + bundle.originalSize,
      0,
    );
    const totalOptimizedSize = bundleMetrics.reduce(
      (sum, bundle) => sum + bundle.optimizedSize,
      0,
    );
    const totalCompressedSize = bundleMetrics.reduce(
      (sum, bundle) => sum + bundle.compressedSize,
      0,
    );
    const totalChunkCount = bundleMetrics.reduce(
      (sum, bundle) => sum + bundle.chunkCount,
      0,
    );
    const totalCriticalCssSize = bundleMetrics.reduce(
      (sum, bundle) => sum + bundle.criticalCssSize,
      0,
    );
    const totalOptimizationTime = bundleMetrics.reduce(
      (sum, bundle) => sum + bundle.optimizationTime,
      0,
    );

    const averageLoadTime =
      bundleMetrics.length > 0
        ? bundleMetrics.reduce(
            (sum, bundle) => sum + bundle.estimatedLoadTime,
            0,
          ) / bundleMetrics.length
        : 0;

    const performanceScore = this.calculatePerformanceScore({
      totalCompressedSize,
      totalCriticalCssSize,
      averageLoadTime,
      compressionRatio:
        totalOriginalSize > 0 ? totalOptimizedSize / totalOriginalSize : 1,
    });

    return {
      totalOriginalSize,
      totalOptimizedSize,
      totalCompressedSize,
      bundleCount: bundleMetrics.length,
      totalChunkCount,
      overallCompressionRatio:
        totalOriginalSize > 0 ? totalOptimizedSize / totalOriginalSize : 1,
      totalCriticalCssSize,
      averageLoadTime,
      totalOptimizationTime,
      performanceScore,
      bundles: bundleMetrics,
    };
  }

  /**
   * Analyze compliance with performance budgets
   */
  private analyzeBudgetCompliance(metrics: GlobalPerformanceMetrics): {
    passed: boolean;
    violations: BudgetViolation[];
    score: number;
  } {
    const violations: BudgetViolation[] = [];

    if (!this.performanceBudget) {
      return { passed: true, violations: [], score: 100 };
    }

    const budget = this.performanceBudget;

    // Check bundle size violations
    metrics.bundles.forEach((bundle) => {
      if (bundle.compressedSize > budget.maxBundleSize) {
        violations.push({
          type: "bundle_size",
          actual: bundle.compressedSize,
          limit: budget.maxBundleSize,
          severity:
            bundle.compressedSize > budget.maxBundleSize * 1.5
              ? "error"
              : "warning",
          message: `Bundle ${bundle.bundleId} exceeds size limit`,
          recommendations: [
            "Enable more aggressive chunking",
            "Remove unused CSS rules",
            "Consider lazy loading non-critical styles",
          ],
        });
      }
    });

    // Check critical CSS violations
    if (metrics.totalCriticalCssSize > budget.maxCriticalCssSize) {
      violations.push({
        type: "critical_css",
        actual: metrics.totalCriticalCssSize,
        limit: budget.maxCriticalCssSize,
        severity:
          metrics.totalCriticalCssSize > budget.maxCriticalCssSize * 1.3
            ? "error"
            : "warning",
        message: "Critical CSS size exceeds limit",
        recommendations: [
          "Reduce critical CSS scope",
          "Use more aggressive critical CSS extraction",
          "Inline only above-the-fold styles",
        ],
      });
    }

    // Check chunk count violations
    if (metrics.totalChunkCount > budget.maxChunks) {
      violations.push({
        type: "chunk_count",
        actual: metrics.totalChunkCount,
        limit: budget.maxChunks,
        severity: "warning",
        message: "Too many chunks may impact performance",
        recommendations: [
          "Increase minimum chunk size",
          "Merge similar chunks",
          "Consider reducing chunking granularity",
        ],
      });
    }

    // Check load time violations
    if (metrics.averageLoadTime > budget.estimatedLoadTime) {
      violations.push({
        type: "load_time",
        actual: metrics.averageLoadTime,
        limit: budget.estimatedLoadTime,
        severity: "error",
        message: "Estimated load time exceeds target",
        recommendations: [
          "Enable HTTP/2 push for critical resources",
          "Optimize compression settings",
          "Implement resource preloading",
        ],
      });
    }

    // Check total size violations
    if (
      metrics.totalCompressedSize >
      (budget.maxTotalSize || budget.maxBundleSize * 5)
    ) {
      violations.push({
        type: "total_size",
        actual: metrics.totalCompressedSize,
        limit: budget.maxTotalSize || budget.maxBundleSize * 5,
        severity: "error",
        message: "Total CSS size exceeds limit",
        recommendations: [
          "Remove unused CSS across all bundles",
          "Enable more aggressive minification",
          "Consider CSS-in-JS for dynamic styles",
        ],
      });
    }

    const errorCount = violations.filter((v) => v.severity === "error").length;
    const warningCount = violations.filter(
      (v) => v.severity === "warning",
    ).length;
    const score = Math.max(0, 100 - errorCount * 25 - warningCount * 10);

    return {
      passed: errorCount === 0,
      violations,
      score,
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    metrics: GlobalPerformanceMetrics,
    results: any,
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Chunking recommendations
    if (metrics.overallCompressionRatio > 0.8) {
      recommendations.push({
        category: "chunking",
        priority: "high",
        title: "Improve CSS Chunking Strategy",
        description:
          "Large bundles detected. Better chunking can improve caching and loading performance.",
        impact: `Potential 20-40% improvement in cache efficiency`,
        complexity: "moderate",
        steps: [
          "Enable route-based chunking for SPA applications",
          "Implement component-based chunking for better cache granularity",
          "Configure vendor CSS separation",
        ],
      });
    }

    // Compression recommendations
    if (metrics.overallCompressionRatio > 0.7) {
      recommendations.push({
        category: "compression",
        priority: "medium",
        title: "Enable Advanced Compression",
        description:
          "CSS could benefit from more aggressive compression settings.",
        impact: `Potential 15-30% size reduction`,
        complexity: "simple",
        steps: [
          "Enable Brotli compression for modern browsers",
          "Increase compression level for production builds",
          "Remove unnecessary whitespace and comments",
        ],
      });
    }

    // Critical CSS recommendations
    if (metrics.totalCriticalCssSize === 0) {
      recommendations.push({
        category: "critical_css",
        priority: "high",
        title: "Implement Critical CSS Extraction",
        description:
          "No critical CSS detected. Implementing critical CSS can significantly improve perceived performance.",
        impact: `30-50% faster first contentful paint`,
        complexity: "moderate",
        steps: [
          "Configure critical CSS extraction for main routes",
          "Inline critical CSS in HTML documents",
          "Lazy load non-critical stylesheets",
        ],
      });
    }

    // Caching recommendations
    const avgCacheEfficiency =
      metrics.bundles.reduce((sum, b) => sum + b.cacheEfficiency, 0) /
      metrics.bundles.length;
    if (avgCacheEfficiency < 70) {
      recommendations.push({
        category: "caching",
        priority: "medium",
        title: "Optimize Caching Strategy",
        description:
          "Current chunking strategy may not be optimal for browser caching.",
        impact: `Improved cache hit rates for returning users`,
        complexity: "moderate",
        steps: [
          "Separate vendor CSS from application CSS",
          "Use content-based hashing for cache busting",
          "Implement long-term caching headers",
        ],
      });
    }

    // Delivery recommendations
    if (metrics.averageLoadTime > 2000) {
      recommendations.push({
        category: "delivery",
        priority: "high",
        title: "Optimize CSS Delivery",
        description:
          "High load times detected. Optimize delivery mechanism for better performance.",
        impact: `20-40% faster CSS loading`,
        complexity: "simple",
        steps: [
          "Enable resource hints (preload, prefetch)",
          "Implement HTTP/2 server push for critical CSS",
          "Use CDN for static CSS assets",
        ],
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Analyze individual chunks for optimization opportunities
   */
  private analyzeChunks(chunks: CssChunk[]): ChunkAnalysisResult[] {
    return chunks.map((chunk) => {
      const size = chunk.content.length;
      const compressedSize = Math.round(size * 0.3); // Estimate compression
      const usageScore = chunk.usagePattern?.score || 50;
      const priority = this.determineChunkPriority(chunk);
      const cacheHitRatio = this.estimateCacheHitRatio(chunk);
      const optimizationOpportunities =
        this.identifyOptimizationOpportunities(chunk);

      return {
        chunkId: chunk.id,
        size,
        compressedSize,
        priority,
        dependencies: chunk.dependencies || [],
        usageScore,
        cacheHitRatio,
        optimizationOpportunities,
      };
    });
  }

  /**
   * Estimate load time based on size and chunk count
   */
  private estimateLoadTime(compressedSize: number, chunkCount: number): number {
    const baseLatency = 100; // Base network latency
    const transferTime = (compressedSize / 1024) * 8; // ~8ms per KB over average connection
    const parallelismPenalty = Math.max(0, chunkCount - 6) * 20; // Penalty for too many parallel requests

    return baseLatency + transferTime + parallelismPenalty;
  }

  /**
   * Calculate cache efficiency score
   */
  private calculateCacheEfficiency(chunks: CssChunk[]): number {
    if (chunks.length === 0) return 0;

    // Factors: chunk size consistency, usage patterns, content stability
    const sizeVariation = this.calculateSizeVariation(chunks);
    const usageConsistency = this.calculateUsageConsistency(chunks);
    const contentStability = this.estimateContentStability(chunks);

    return Math.round(
      (sizeVariation + usageConsistency + contentStability) / 3,
    );
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(metrics: {
    totalCompressedSize: number;
    totalCriticalCssSize: number;
    averageLoadTime: number;
    compressionRatio: number;
  }): number {
    let score = 100;

    // Size penalty
    if (metrics.totalCompressedSize > 100 * 1024) score -= 20; // 100KB threshold
    if (metrics.totalCompressedSize > 200 * 1024) score -= 20; // 200KB threshold

    // Critical CSS bonus
    if (
      metrics.totalCriticalCssSize > 0 &&
      metrics.totalCriticalCssSize < 14 * 1024
    )
      score += 10;

    // Load time penalty
    if (metrics.averageLoadTime > 2000) score -= 15;
    if (metrics.averageLoadTime > 3000) score -= 15;

    // Compression bonus
    if (metrics.compressionRatio < 0.7) score += 10;
    if (metrics.compressionRatio < 0.5) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate configuration hash for cache invalidation
   */
  private generateConfigHash(): string {
    const configString = JSON.stringify({
      strategy: this.config.strategy,
      chunking: this.config.chunking,
      optimization: this.config.optimization,
      compression: this.config.compression,
    });

    // Simple hash function (in production, use crypto)
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Helper methods for chunk analysis
   */
  private determineChunkPriority(
    chunk: CssChunk,
  ): "critical" | "high" | "medium" | "low" {
    if (chunk.type === "critical") return "critical";
    if (chunk.usagePattern?.score && chunk.usagePattern.score > 80)
      return "high";
    if (chunk.usagePattern?.score && chunk.usagePattern.score > 50)
      return "medium";
    return "low";
  }

  private estimateCacheHitRatio(chunk: CssChunk): number {
    // Estimate based on chunk stability and usage patterns
    const baseRatio = 60; // Base cache hit ratio
    const usageBonus = (chunk.usagePattern?.score || 50) / 5; // Higher usage = better caching
    const sizeBonus = Math.max(0, 20 - chunk.content.length / 1024); // Smaller chunks cache better

    return Math.min(95, baseRatio + usageBonus + sizeBonus);
  }

  private identifyOptimizationOpportunities(chunk: CssChunk): string[] {
    const opportunities: string[] = [];

    if (chunk.content.length > 50 * 1024) {
      opportunities.push("Consider splitting large chunk");
    }

    if (chunk.content.includes("/* ")) {
      opportunities.push("Remove comments in production");
    }

    if (chunk.content.includes("  ")) {
      opportunities.push("Minify whitespace");
    }

    if ((chunk.usagePattern?.score || 0) < 30) {
      opportunities.push("Low usage - consider lazy loading");
    }

    return opportunities;
  }

  private calculateSizeVariation(chunks: CssChunk[]): number {
    if (chunks.length === 0) return 0;

    const sizes = chunks.map((c) => c.content.length);
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance =
      sizes.reduce((sum, size) => sum + Math.pow(size - avg, 2), 0) /
      sizes.length;
    const standardDeviation = Math.sqrt(variance);

    // Lower variation = better caching (inverse relationship)
    return Math.max(0, 100 - (standardDeviation / avg) * 100);
  }

  private calculateUsageConsistency(chunks: CssChunk[]): number {
    const usageScores = chunks.map((c) => c.usagePattern?.score || 50);
    const avg = usageScores.reduce((a, b) => a + b, 0) / usageScores.length;
    return Math.round(avg);
  }

  private estimateContentStability(chunks: CssChunk[]): number {
    // Estimate how stable chunk content is likely to be
    // This is a heuristic based on chunk type and size
    return (
      chunks.reduce((avg, chunk) => {
        let stability = 70; // Base stability

        if (chunk.type === "vendor") stability += 20; // Vendor CSS is more stable
        if (chunk.type === "critical") stability += 10; // Critical CSS is fairly stable
        if (chunk.content.length < 5 * 1024) stability -= 10; // Small chunks may change more

        return avg + stability;
      }, 0) / chunks.length
    );
  }

  /**
   * Export report to various formats
   */
  async exportReport(
    report: CssPerformanceReport,
    format: "json" | "html" | "markdown",
  ): Promise<string> {
    switch (format) {
      case "json":
        return JSON.stringify(report, null, 2);

      case "html":
        return this.generateHtmlReport(report);

      case "markdown":
        return this.generateMarkdownReport(report);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: CssPerformanceReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>CSS Performance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .metric { background: #f5f5f5; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .violation { background: #ffebee; border-left: 4px solid #f44336; padding: 16px; margin: 8px 0; }
        .recommendation { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 16px; margin: 8px 0; }
        .score { font-size: 24px; font-weight: bold; color: ${report.metrics.performanceScore > 80 ? "#4caf50" : report.metrics.performanceScore > 60 ? "#ff9800" : "#f44336"}; }
    </style>
</head>
<body>
    <h1>CSS Performance Report</h1>
    <p>Generated: ${report.metadata.timestamp}</p>
    
    <div class="metric">
        <h2>Performance Score</h2>
        <div class="score">${report.metrics.performanceScore}/100</div>
    </div>
    
    <div class="metric">
        <h2>Size Metrics</h2>
        <p><strong>Total Original:</strong> ${Math.round(report.metrics.totalOriginalSize / 1024)}KB</p>
        <p><strong>Total Optimized:</strong> ${Math.round(report.metrics.totalOptimizedSize / 1024)}KB</p>
        <p><strong>Total Compressed:</strong> ${Math.round(report.metrics.totalCompressedSize / 1024)}KB</p>
        <p><strong>Compression Ratio:</strong> ${Math.round(report.metrics.overallCompressionRatio * 100)}%</p>
    </div>
    
    <h2>Budget Analysis</h2>
    <p><strong>Status:</strong> ${report.budgetAnalysis.passed ? "✅ PASSED" : "❌ FAILED"}</p>
    <p><strong>Score:</strong> ${report.budgetAnalysis.score}/100</p>
    
    ${report.budgetAnalysis.violations
      .map(
        (v) => `
        <div class="violation">
            <strong>${v.type.replace("_", " ").toUpperCase()}</strong>: ${v.message}<br>
            Actual: ${v.actual} | Limit: ${v.limit}
        </div>
    `,
      )
      .join("")}
    
    <h2>Recommendations</h2>
    ${report.recommendations
      .map(
        (r) => `
        <div class="recommendation">
            <h3>${r.title} (${r.priority} priority)</h3>
            <p>${r.description}</p>
            <p><strong>Impact:</strong> ${r.impact}</p>
        </div>
    `,
      )
      .join("")}
</body>
</html>`;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(report: CssPerformanceReport): string {
    return `# CSS Performance Report

**Generated:** ${report.metadata.timestamp}  
**Environment:** ${report.metadata.environment}  
**Configuration Hash:** ${report.metadata.configHash}

## Performance Score: ${report.metrics.performanceScore}/100

## Size Metrics

| Metric | Value |
|--------|-------|
| Total Original | ${Math.round(report.metrics.totalOriginalSize / 1024)}KB |
| Total Optimized | ${Math.round(report.metrics.totalOptimizedSize / 1024)}KB |
| Total Compressed | ${Math.round(report.metrics.totalCompressedSize / 1024)}KB |
| Compression Ratio | ${Math.round(report.metrics.overallCompressionRatio * 100)}% |
| Bundle Count | ${report.metrics.bundleCount} |
| Total Chunks | ${report.metrics.totalChunkCount} |

## Budget Analysis

**Status:** ${report.budgetAnalysis.passed ? "✅ PASSED" : "❌ FAILED"}  
**Score:** ${report.budgetAnalysis.score}/100

${
  report.budgetAnalysis.violations.length > 0
    ? "### Violations\n" +
      report.budgetAnalysis.violations
        .map(
          (v) =>
            `- **${v.type.replace("_", " ").toUpperCase()}**: ${v.message} (Actual: ${v.actual}, Limit: ${v.limit})`,
        )
        .join("\n")
    : "No budget violations detected."
}

## Optimization Recommendations

${report.recommendations
  .map(
    (r) => `
### ${r.title} (${r.priority} priority)

${r.description}

**Impact:** ${r.impact}  
**Complexity:** ${r.complexity}

**Steps:**
${r.steps.map((step) => `- ${step}`).join("\n")}
`,
  )
  .join("\n")}

## Bundle Details

${report.metrics.bundles
  .map(
    (b) => `
### Bundle: ${b.bundleId}

- **Size:** ${Math.round(b.originalSize / 1024)}KB → ${Math.round(b.optimizedSize / 1024)}KB (${Math.round(b.compressionRatio * 100)}%)
- **Chunks:** ${b.chunkCount}
- **Load Time:** ${Math.round(b.estimatedLoadTime)}ms
- **Cache Efficiency:** ${b.cacheEfficiency}%
`,
  )
  .join("\n")}
`;
  }
}

/**
 * Factory function to create CSS report generator
 */
export function createCssReportGenerator(
  config: CssOutputConfig,
  performanceBudget?: PerformanceBudget,
): CssReportGenerator {
  return new CssReportGenerator(config, performanceBudget);
}
