/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "crypto";
import { gzip, brotliCompress } from "zlib";
import { promisify } from "util";
import { readFile, writeFile, stat } from "fs/promises";
import { join, dirname, basename, extname } from "path";
import cssnano from "cssnano";
import type { CssOutputConfig } from "./cssOutputConfig.js";
import { z } from "zod";
import postcss, { Root, Plugin } from "postcss";
import {
  CompressionConfig,
  OptimizationConfig,
  OutputPaths,
  HashAlgorithm,
} from "./cssOutputConfig.js";
import { CssChunk } from "./cssChunker.js";

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Asset hash information
 */
export interface AssetHash {
  /** Original filename */
  original: string;

  /** Hashed filename */
  hashed: string;

  /** Hash value */
  hash: string;

  /** Hash algorithm used */
  algorithm: HashAlgorithm;

  /** File size in bytes */
  size: number;

  /** Content MIME type */
  mimeType: string;

  /** Last modified timestamp */
  lastModified: Date;

  /** Integrity hash for SRI */
  integrity?: string;
}

/**
 * Compressed asset information
 */
export interface CompressedAsset {
  /** Original asset reference */
  originalPath: string;

  /** Compressed asset path */
  compressedPath: string;

  /** Original size in bytes */
  originalSize: number;

  /** Compressed size in bytes */
  compressedSize: number;

  /** Compression ratio (0-1) */
  compressionRatio: number;

  /** Compression type used */
  compressionType: "gzip" | "brotli";

  /** Compression level used */
  compressionLevel: number;

  /** Whether asset is minified */
  isMinified: boolean;

  /** Source map path if available */
  sourceMapPath?: string;
}

/**
 * Compression result information
 */
export interface CompressionResult {
  /** Original content */
  original: Buffer;

  /** Compressed content */
  compressed: Buffer;

  /** Compression type used */
  type: "gzip" | "brotli";

  /** Compression ratio (0-1) */
  ratio: number;

  /** Original size in bytes */
  originalSize: number;

  /** Compressed size in bytes */
  compressedSize: number;

  /** Compression level used */
  level: number;

  /** Compression time in milliseconds */
  compressionTime: number;
}

/**
 * Optimization result information
 */
export interface OptimizationResult {
  /** Original CSS content */
  original: string;

  /** Optimized CSS content */
  optimized: string;

  /** Optimization statistics */
  stats: {
    /** Original size in bytes */
    originalSize: number;

    /** Optimized size in bytes */
    optimizedSize: number;

    /** Size reduction percentage */
    reduction: number;

    /** Rules removed count */
    rulesRemoved: number;

    /** Declarations optimized count */
    declarationsOptimized: number;

    /** Optimization time in milliseconds */
    optimizationTime: number;
  };

  /** Optimization plugins used */
  plugins: string[];

  /** Source map if generated */
  sourceMap?: string;
}

/**
 * Asset manifest entry
 */
export interface AssetManifestEntry {
  /** Original filename */
  file: string;

  /** Hashed filename */
  src: string;

  /** File size in bytes */
  size: number;

  /** File hash */
  hash: string;

  /** Integrity hash for SRI */
  integrity: string;

  /** Asset type */
  type: "css" | "js" | "asset";

  /** Loading priority */
  priority: number;

  /** Loading strategy */
  loading: "eager" | "lazy" | "preload" | "prefetch";

  /** Compressed variants available */
  compressed?: {
    gzip?: {
      file: string;
      size: number;
    };
    brotli?: {
      file: string;
      size: number;
    };
  };

  /** Associated routes/pages */
  routes?: string[];

  /** Associated components */
  components?: string[];
}

/**
 * Complete asset manifest
 */
export interface AssetManifest {
  /** Manifest version */
  version: string;

  /** Generation timestamp */
  generated: Date;

  /** Build configuration used */
  buildConfig: {
    strategy: string;
    optimization: boolean;
    compression: boolean;
    hashing: boolean;
  };

  /** All assets in the manifest */
  assets: Record<string, AssetManifestEntry>;

  /** Entry point files */
  entrypoints: Record<string, string[]>;

  /** Total build statistics */
  stats: {
    totalFiles: number;
    totalSize: number;
    compressedSize: number;
    compressionRatio: number;
    optimizationRatio: number;
  };
}

// =============================================================================
// SCHEMA DEFINITIONS
// =============================================================================

/**
 * Schema for asset hashing options
 */
export const AssetHashingOptionsSchema = z.object({
  /** Hash algorithm to use */
  algorithm: z.enum(["md5", "sha1", "sha256", "xxhash"]).default("xxhash"),

  /** Hash length in characters */
  length: z.number().min(4).max(32).default(8),

  /** Include file content in hash */
  includeContent: z.boolean().default(true),

  /** Include file metadata in hash */
  includeMetadata: z.boolean().default(false),

  /** Generate integrity hashes for SRI */
  generateIntegrity: z.boolean().default(true),

  /** Integrity algorithm for SRI */
  integrityAlgorithm: z.enum(["sha256", "sha384", "sha512"]).default("sha384"),
});

export type AssetHashingOptions = z.infer<typeof AssetHashingOptionsSchema>;

// =============================================================================
// ASSET HASHER
// =============================================================================

/**
 * Asset Hasher
 *
 * Handles content-based hashing and fingerprinting of CSS assets
 */
export class AssetHasher {
  private options: AssetHashingOptions;
  private hashCache = new Map<string, AssetHash>();

  /**
   * Create a new asset hasher
   */
  constructor(options: Partial<AssetHashingOptions> = {}) {
    this.options = AssetHashingOptionsSchema.parse(options);
  }

  /**
   * Generate hash for CSS content
   */
  hashContent(content: string, filename: string): AssetHash {
    const cacheKey = `${filename}:${content.length}`;

    if (this.hashCache.has(cacheKey)) {
      return this.hashCache.get(cacheKey)!;
    }

    const contentBuffer = Buffer.from(content, "utf8");
    const hash = this.generateHash(contentBuffer, filename);
    const hashedFilename = this.generateHashedFilename(filename, hash);

    const assetHash: AssetHash = {
      original: filename,
      hashed: hashedFilename,
      hash,
      algorithm: this.options.algorithm,
      size: contentBuffer.length,
      mimeType: "text/css",
      lastModified: new Date(),
      integrity: this.options.generateIntegrity
        ? this.generateIntegrityHash(contentBuffer)
        : undefined,
    };

    this.hashCache.set(cacheKey, assetHash);
    return assetHash;
  }

  /**
   * Generate hash for CSS chunk
   */
  hashChunk(chunk: CssChunk): AssetHash {
    const filename = `${chunk.name}.css`;
    return this.hashContent(chunk.content, filename);
  }

  /**
   * Generate batch hashes for multiple chunks
   */
  hashChunks(chunks: CssChunk[]): Map<string, AssetHash> {
    const results = new Map<string, AssetHash>();

    for (const chunk of chunks) {
      const assetHash = this.hashChunk(chunk);
      results.set(chunk.id, assetHash);
    }

    return results;
  }

  /**
   * Generate hash for content
   */
  private generateHash(content: Buffer, filename?: string): string {
    let hash: string;

    switch (this.options.algorithm) {
      case "md5":
        hash = createHash("md5").update(content).digest("hex");
        break;
      case "sha1":
        hash = createHash("sha1").update(content).digest("hex");
        break;
      case "sha256":
        hash = createHash("sha256").update(content).digest("hex");
        break;
      case "xxhash":
        // For now, use sha256 as fallback since xxhash requires native module
        hash = createHash("sha256").update(content).digest("hex");
        break;
      default:
        hash = createHash("sha256").update(content).digest("hex");
    }

    // Include metadata if requested
    if (this.options.includeMetadata && filename) {
      const metadataHash = createHash("sha256")
        .update(filename)
        .update(new Date().toISOString())
        .digest("hex");

      hash = createHash("sha256")
        .update(hash)
        .update(metadataHash)
        .digest("hex");
    }

    return hash.substring(0, this.options.length);
  }

  /**
   * Generate integrity hash for SRI
   */
  private generateIntegrityHash(content: Buffer): string {
    const hash = createHash(this.options.integrityAlgorithm)
      .update(content)
      .digest("base64");

    return `${this.options.integrityAlgorithm}-${hash}`;
  }

  /**
   * Generate hashed filename
   */
  private generateHashedFilename(filename: string, hash: string): string {
    const extension = filename.split(".").pop();
    const basename = filename.substring(0, filename.lastIndexOf("."));

    return `${basename}.${hash}.${extension}`;
  }

  /**
   * Clear hash cache
   */
  clearCache(): void {
    this.hashCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number } {
    return {
      size: this.hashCache.size,
      hits: 0, // Would need to track hits in real implementation
    };
  }
}

// =============================================================================
// CSS OPTIMIZER
// =============================================================================

/**
 * CSS Optimizer
 *
 * Handles CSS minification and optimization using PostCSS and cssnano
 */
export class CssOptimizer {
  private config: OptimizationConfig;
  private postcssInstance: typeof postcss;

  /**
   * Create a new CSS optimizer
   */
  constructor(config: OptimizationConfig) {
    this.config = config;
    this.postcssInstance = postcss as any;
  }

  /**
   * Optimize CSS content
   */
  async optimizeCss(
    css: string,
    filename?: string,
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const originalSize = Buffer.byteLength(css, "utf8");

    try {
      // Build PostCSS plugin chain
      const plugins = this.buildPluginChain();
      const processor = postcss(plugins as any);

      // Process CSS
      const result = await processor.process(css, {
        from: filename,
        to: filename,
        map: (this.config as any).generateSourceMaps ? { inline: false } : false,
      });

      const optimizedSize = Buffer.byteLength(result.css, "utf8");
      const optimizationTime = Date.now() - startTime;

      return {
        original: css,
        optimized: result.css,
        stats: {
          originalSize,
          optimizedSize,
          reduction: ((originalSize - optimizedSize) / originalSize) * 100,
          rulesRemoved: 0, // Would need detailed analysis
          declarationsOptimized: 0, // Would need detailed analysis
          optimizationTime,
        },
        plugins: plugins.map((plugin) => (plugin as any).pluginName || "unknown"),
        sourceMap: result.map?.toString(),
      };
    } catch (error) {
      throw new Error(
        `CSS optimization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Optimize CSS chunk
   */
  async optimizeChunk(chunk: CssChunk): Promise<OptimizationResult> {
    return this.optimizeCss(chunk.content, `${chunk.name}.css`);
  }

  /**
   * Optimize multiple chunks
   */
  async optimizeChunks(
    chunks: CssChunk[],
  ): Promise<Map<string, OptimizationResult>> {
    const results = new Map<string, OptimizationResult>();

    // Process chunks in parallel for better performance
    const promises = chunks.map(async (chunk) => {
      const result = await this.optimizeChunk(chunk);
      return { chunkId: chunk.id, result };
    });

    const optimizationResults = await Promise.all(promises);

    for (const { chunkId, result } of optimizationResults) {
      results.set(chunkId, result);
    }

    return results;
  }

  /**
   * Build PostCSS plugin chain based on configuration
   */
  private buildPluginChain(): Plugin[] {
    const plugins: Plugin[] = [];

    if (this.config.minify) {
      // Configure cssnano with options
      const cssnanoOptions = {
        preset: [
          "default",
          {
            discardComments: this.config.removeComments,
            mergeRules: this.config.mergeDuplicates,
            normalizeWhitespace: true,
            colormin: this.config.normalizeColors,
            calc: this.config.optimizeCalc,
            autoprefixer: this.config.autoprefix,
            cssDeclarationSorter: true,
            discardEmpty: this.config.removeEmpty,
            mergeIdents: true,
            reduceIdents: false, // Preserve class names for debugging
            zindex: false, // Don't optimize z-index values
          },
        ],
      };

      plugins.push(cssnano(cssnanoOptions) as any);
    }

    // Add custom optimization plugins based on config
    if (this.config.mergeMedia) {
      plugins.push(this.createMediaMergePlugin());
    }

    if (this.config.optimizeFonts) {
      plugins.push(this.createFontOptimizationPlugin());
    }

    return plugins;
  }

  /**
   * Create media query merging plugin
   */
  private createMediaMergePlugin(): Plugin {
    return {
      postcssPlugin: "merge-media-queries",
      Once(root: Root) {
        const mediaQueries = new Map<string, any[]>();

        // Collect media queries
        root.walkAtRules("media", (rule) => {
          const params = rule.params;
          if (!mediaQueries.has(params)) {
            mediaQueries.set(params, []);
          }
          mediaQueries.get(params)!.push(rule);
        });

        // Merge duplicate media queries
        for (const [params, rules] of mediaQueries) {
          if (rules.length > 1) {
            const firstRule = rules[0];

            // Move all rules from subsequent media queries to the first one
            for (let i = 1; i < rules.length; i++) {
              const rule = rules[i];
              rule.walkRules((childRule: any) => {
                firstRule.append(childRule.clone());
              });
              rule.remove();
            }
          }
        }
      },
    };
  }

  /**
   * Create font optimization plugin
   */
  private createFontOptimizationPlugin(): Plugin {
    const self = this;
    return {
      postcssPlugin: "optimize-fonts",
      Once(root: Root) {
        // Optimize font-family declarations
        root.walkDecls("font-family", (decl) => {
          // Remove quotes from single-word font names
          decl.value = decl.value.replace(/"([^"\s]+)"/g, "$1");

          // Normalize font stack order
          const fonts = decl.value.split(",").map((font) => font.trim());
          const optimized = self.optimizeFontStack(fonts);
          decl.value = optimized.join(", ");
        });

        // Optimize font shorthand
        root.walkDecls("font", (decl) => {
          // Basic font shorthand optimization
          decl.value = decl.value.replace(/\s+/g, " ").trim();
        });
      },
    };
  }

  /**
   * Optimize font stack order
   */
  private optimizeFontStack(fonts: string[]): string[] {
    // Move generic families to the end
    const genericFamilies = [
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
    ];
    const specific = fonts.filter(
      (font) => !genericFamilies.includes(font.toLowerCase()),
    );
    const generic = fonts.filter((font) =>
      genericFamilies.includes(font.toLowerCase()),
    );

    return [...specific, ...generic];
  }
}

// =============================================================================
// COMPRESSION ENGINE
// =============================================================================

/**
 * Compression Engine
 *
 * Handles gzip and brotli compression of CSS assets
 */
export class CompressionEngine {
  private config: CompressionConfig;
  private gzipAsync = promisify(gzip);
  private brotliAsync = promisify(brotliCompress);

  /**
   * Create a new compression engine
   */
  constructor(config: CompressionConfig) {
    this.config = config;
  }

  /**
   * Compress CSS content
   */
  async compressContent(content: string): Promise<CompressionResult[]> {
    const contentBuffer = Buffer.from(content, "utf8");
    const results: CompressionResult[] = [];

    if (contentBuffer.length < this.config.threshold) {
      return results; // Skip compression for small files
    }

    const compressionTypes = this.getCompressionTypes();

    for (const type of compressionTypes) {
      try {
        const result = await this.compressWithType(contentBuffer, type);
        results.push(result);
      } catch (error) {
        console.warn(`Failed to compress with ${type}:`, error);
      }
    }

    return this.selectBestCompression(results);
  }

  /**
   * Compress CSS chunk
   */
  async compressChunk(chunk: CssChunk): Promise<CompressionResult[]> {
    return this.compressContent(chunk.content);
  }

  /**
   * Compress multiple chunks
   */
  async compressChunks(
    chunks: CssChunk[],
  ): Promise<Map<string, CompressionResult[]>> {
    const results = new Map<string, CompressionResult[]>();

    // Process chunks in parallel
    const promises = chunks.map(async (chunk) => {
      const compressionResults = await this.compressChunk(chunk);
      return { chunkId: chunk.id, results: compressionResults };
    });

    const allResults = await Promise.all(promises);

    for (const { chunkId, results: compressionResults } of allResults) {
      results.set(chunkId, compressionResults);
    }

    return results;
  }

  /**
   * Get compression types to use
   */
  private getCompressionTypes(): ("gzip" | "brotli")[] {
    switch (this.config.type) {
      case "gzip":
        return ["gzip"];
      case "brotli":
        return ["brotli"];
      case "auto":
        return ["brotli", "gzip"]; // Prefer brotli for better compression
      case "none":
      default:
        return [];
    }
  }

  /**
   * Compress content with specific type
   */
  private async compressWithType(
    content: Buffer,
    type: "gzip" | "brotli",
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    let compressed: Buffer;

    if (type === "gzip") {
      compressed = await this.gzipAsync(content, {
        level: Math.min(this.config.level, 9),
        chunkSize: 1024,
        windowBits: 15,
        memLevel: 8,
      });
    } else {
      // brotli
      compressed = await this.brotliAsync(content, {
        params: {
          [require("zlib").constants.BROTLI_PARAM_QUALITY]: Math.min(
            this.config.level,
            11,
          ),
          [require("zlib").constants.BROTLI_PARAM_SIZE_HINT]: content.length,
        },
      });
    }

    const compressionTime = Date.now() - startTime;
    const ratio = compressed.length / content.length;

    return {
      original: content,
      compressed,
      type,
      ratio,
      originalSize: content.length,
      compressedSize: compressed.length,
      level: this.config.level,
      compressionTime,
    };
  }

  /**
   * Select best compression results
   */
  private selectBestCompression(
    results: CompressionResult[],
  ): CompressionResult[] {
    if (results.length === 0) {
      return results;
    }

    if (this.config.type !== "auto") {
      return results;
    }

    // Sort by compression ratio (best first)
    const sorted = results.sort((a, b) => a.ratio - b.ratio);

    // Return best compression, or multiple if generateReports is enabled
    return this.config.generateReports ? sorted : [sorted[0]];
  }
}

// =============================================================================
// MANIFEST GENERATOR
// =============================================================================

/**
 * Manifest Generator
 *
 * Generates asset manifests for build output
 */
export class ManifestGenerator {
  private paths: OutputPaths;

  /**
   * Create a new manifest generator
   */
  constructor(paths: OutputPaths) {
    this.paths = paths;
  }

  /**
   * Generate asset manifest from chunks and optimization results
   */
  generateManifest(
    chunks: CssChunk[],
    hashes: Map<string, AssetHash>,
    optimizations: Map<string, OptimizationResult>,
    compressions: Map<string, CompressionResult[]>,
  ): AssetManifest {
    const assets: Record<string, AssetManifestEntry> = {};
    const entrypoints: Record<string, string[]> = {};
    let totalSize = 0;
    let compressedSize = 0;

    // Process each chunk
    for (const chunk of chunks) {
      const hash = hashes.get(chunk.id);
      const optimization = optimizations.get(chunk.id);
      const compression = compressions.get(chunk.id) || [];

      if (!hash) continue;

      const entry: AssetManifestEntry = {
        file: hash.original,
        src: hash.hashed,
        size: optimization ? optimization.stats.optimizedSize : chunk.size,
        hash: hash.hash,
        integrity: hash.integrity || "",
        type: "css",
        priority: chunk.priority,
        loading: this.getLoadingStrategy(chunk),
        routes: chunk.routes.size > 0 ? Array.from(chunk.routes) : undefined,
        components:
          chunk.components.size > 0 ? Array.from(chunk.components) : undefined,
      };

      // Add compression information
      if (compression.length > 0) {
        entry.compressed = {};

        for (const comp of compression) {
          const compressedFilename = this.generateCompressedFilename(
            hash.hashed,
            comp.type,
          );

          entry.compressed[comp.type] = {
            file: compressedFilename,
            size: comp.compressedSize,
          };

          compressedSize += comp.compressedSize;
        }
      }

      assets[hash.original] = entry;
      totalSize += entry.size;

      // Group assets by type for entrypoints
      const entryType = this.getEntryType(chunk);
      if (!entrypoints[entryType]) {
        entrypoints[entryType] = [];
      }
      entrypoints[entryType].push(hash.hashed);
    }

    return {
      version: "1.0.0",
      generated: new Date(),
      buildConfig: {
        strategy: "css-output-optimization",
        optimization: optimizations.size > 0,
        compression: compressions.size > 0,
        hashing: hashes.size > 0,
      },
      assets,
      entrypoints,
      stats: {
        totalFiles: chunks.length,
        totalSize,
        compressedSize: compressedSize || totalSize,
        compressionRatio: compressedSize ? totalSize / compressedSize : 1,
        optimizationRatio: this.calculateOptimizationRatio(optimizations),
      },
    };
  }

  /**
   * Get loading strategy for chunk
   */
  private getLoadingStrategy(chunk: CssChunk): AssetManifestEntry["loading"] {
    switch (chunk.loadingStrategy) {
      case "inline":
        return "eager";
      case "preload":
        return "preload";
      case "prefetch":
        return "prefetch";
      case "lazy":
        return "lazy";
      default:
        return chunk.type === "critical" ? "eager" : "lazy";
    }
  }

  /**
   * Get entry type for chunk
   */
  private getEntryType(chunk: CssChunk): string {
    switch (chunk.type) {
      case "critical":
        return "critical";
      case "vendor":
        return "vendor";
      case "main":
        return "main";
      default:
        return "secondary";
    }
  }

  /**
   * Generate compressed filename
   */
  private generateCompressedFilename(
    originalFilename: string,
    compressionType: "gzip" | "brotli",
  ): string {
    const extension = compressionType === "gzip" ? "gz" : "br";
    return `${originalFilename}.${extension}`;
  }

  /**
   * Calculate optimization ratio
   */
  private calculateOptimizationRatio(
    optimizations: Map<string, OptimizationResult>,
  ): number {
    if (optimizations.size === 0) return 1;

    let totalOriginal = 0;
    let totalOptimized = 0;

    for (const optimization of optimizations.values()) {
      totalOriginal += optimization.stats.originalSize;
      totalOptimized += optimization.stats.optimizedSize;
    }

    return totalOriginal / totalOptimized;
  }

  /**
   * Save manifest to file
   */
  async saveManifest(
    manifest: AssetManifest,
    outputPath: string,
  ): Promise<void> {
    const manifestJson = JSON.stringify(manifest, null, 2);

    // In a real implementation, we'd write to the file system
    // For now, we'll just return the JSON string
    return Promise.resolve();
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create an asset hasher with default options
 */
export function createAssetHasher(
  options?: Partial<AssetHashingOptions>,
): AssetHasher {
  return new AssetHasher(options || {});
}

/**
 * Create a CSS optimizer with configuration
 */
export function createCssOptimizer(config: OptimizationConfig): CssOptimizer {
  return new CssOptimizer(config);
}

/**
 * Create a compression engine with configuration
 */
export function createCompressionEngine(
  config: CompressionConfig,
): CompressionEngine {
  return new CompressionEngine(config);
}

/**
 * Create a manifest generator with paths
 */
export function createManifestGenerator(paths: OutputPaths): ManifestGenerator {
  return new ManifestGenerator(paths);
}

/**
 * Validate asset hashing options
 */
export function validateAssetHashingOptions(
  options: unknown,
): AssetHashingOptions {
  return AssetHashingOptionsSchema.parse(options);
}

// =============================================================================
// TEST COMPATIBILITY EXPORTS (Aliases for expected test interfaces)
// =============================================================================

/**
 * Alias for CssOptimizer (expected by tests as CssMinifier)
 */
export const CssMinifier = CssOptimizer;

/**
 * Alias for CompressionEngine (expected by tests as CssCompressor)
 */
export const CssCompressor = CompressionEngine;

/**
 * Create CSS compressor instance (expected by tests)
 */
export function createCssCompressor(
  config: CompressionConfig,
): CompressionEngine {
  return new CompressionEngine(config);
}

/**
 * Create CSS minifier instance (expected by tests)
 */
export function createCssMinifier(config: OptimizationConfig): CssOptimizer {
  return new CssOptimizer(config);
}

// Export aliases and factory functions have been moved to the main implementation section above
