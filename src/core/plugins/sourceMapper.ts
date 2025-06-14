/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Source Mapper Plugin
 * Preserves and updates source maps during CSS transformations
 */

import type { Plugin, Root, Source } from "postcss";
import { z } from "zod";
import { BaseEnigmaPlugin } from "../postcssPlugin.ts";
import type { PluginContext } from "../../types/plugins.ts";

/**
 * Configuration schema for Source Mapper
 */
const SourceMapperConfigSchema = z.object({
  generateSourceMap: z.boolean().optional().default(true),
  includeContents: z.boolean().optional().default(false),
  sourceMapURL: z.string().optional(),
  sourceRoot: z.string().optional(),
  preserveOriginalSources: z.boolean().optional().default(true),
  inlineSourceMap: z.boolean().optional().default(false),
});

type SourceMapperConfig = z.infer<typeof SourceMapperConfigSchema>;

/**
 * Source mapping plugin
 */
export class SourceMapper extends BaseEnigmaPlugin {
  readonly meta = {
    name: "source-mapper",
    version: "1.0.0",
    description: "Preserves and updates source maps during CSS transformations",
    author: "Enigma Core Team",
  };

  readonly configSchema = SourceMapperConfigSchema;

  createPlugin(context: PluginContext): Plugin {
    return {
      postcssPlugin: 'enigma-source-mapper',
      Once: async (root: Root) => {
      const config = context.config.options as SourceMapperConfig;
      const startMemory = this.getMemoryUsage();

      this.logger.debug("Starting source map processing", { config });

      try {
        // Preserve original source information
        if (config.preserveOriginalSources) {
          this.preserveOriginalSources(root, context);
        }

        // Update source mapping information
        this.updateSourceMappings(root, context);

        // Configure source map generation options
        this.configureSourceMapGeneration(context, config);

        const endMemory = this.getMemoryUsage();
        context.metrics.recordMemory(Math.max(0, endMemory - startMemory));

        this.logger.debug("Source map processing completed");
      } catch (error) {
        this.addWarning(
          context,
          `Source map processing failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }
    };
  }

  /**
   * Preserve original source information for all nodes
   */
  private preserveOriginalSources(root: Root, _context: PluginContext): void {
    let preservedCount = 0;

    // Walk all nodes and ensure they have source information
    root.walk((node) => {
      if (!node.source && root.source) {
        // Inherit source from root if not present
        node.source = {
          input: root.source.input,
          start: root.source.start,
          end: root.source.end,
        };
        preservedCount++;
        // Transformation recorded
      }
    });

    if (preservedCount > 0) {
      this.logger.debug(
        `Preserved source information for ${preservedCount} nodes`,
      );
    }
  }

  /**
   * Update source mapping information during transformations
   */
  private updateSourceMappings(root: Root, _context: PluginContext): void {
    let updatedCount = 0;

    // Ensure all transformations maintain source references
    root.walkRules((rule) => {
      if (rule.source) {
        // Mark this rule as having been processed
        if (!rule.raws.enigmaProcessed) {
          rule.raws.enigmaProcessed = true;
          updatedCount++;
          // Transformation recorded
        }
      }
    });

    root.walkDecls((decl) => {
      if (decl.source) {
        // Mark this declaration as having been processed
        if (!decl.raws.enigmaProcessed) {
          decl.raws.enigmaProcessed = true;
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      this.logger.debug(`Updated source mappings for ${updatedCount} nodes`);
    }
  }

  /**
   * Configure source map generation options
   */
  private configureSourceMapGeneration(
    context: PluginContext,
    config: SourceMapperConfig,
  ): void {
    if (config.generateSourceMap) {
      // Configure source map options through the result object
      // This will be used by PostCSS when generating the final output

      const sourceMapOptions: any = {
        map: {
          inline: config.inlineSourceMap,
          sourcesContent: config.includeContents,
        },
      };

      if (config.sourceRoot) {
        sourceMapOptions.map.sourceRoot = config.sourceRoot;
      }

      if (config.sourceMapURL) {
        sourceMapOptions.map.annotation = config.sourceMapURL;
      }

      // Store source map configuration in context for use by PostCSS
      // Note: sourceMapOptions would be handled by PostCSS processor

      this.logger.debug("Configured source map generation", {
        options: sourceMapOptions,
      });
    }
  }

  /**
   * Create a source reference for new nodes
   */
  createSourceReference(
    originalSource: Source | undefined,
    line?: number,
    column?: number,
  ): Source | undefined {
    if (!originalSource) return undefined;

    return {
      input: originalSource.input,
      start: {
        line: line ?? originalSource.start?.line ?? 1,
        column: column ?? originalSource.start?.column ?? 1,
        offset: originalSource.start?.offset ?? 0,
      },
      end: originalSource.end,
    };
  }

  /**
   * Clone source information for transformed nodes
   */
  cloneSource(source: Source | undefined): Source | undefined {
    if (!source) return undefined;

    return {
      input: source.input,
      start: source.start ? { ...source.start } : undefined,
      end: source.end ? { ...source.end } : undefined,
    };
  }

  /**
   * Merge source information from multiple sources
   */
  mergeSourceInfo(sources: (Source | undefined)[]): Source | undefined {
    const validSources = sources.filter((s): s is Source => s !== undefined);

    if (validSources.length === 0) return undefined;
    if (validSources.length === 1) return this.cloneSource(validSources[0]);

    // Use the first source as base and merge ranges
    const firstSource = validSources[0];
    let minLine = firstSource.start?.line ?? 1;
    let minColumn = firstSource.start?.column ?? 1;
    let maxLine = firstSource.end?.line ?? minLine;
    let maxColumn = firstSource.end?.column ?? minColumn;

    for (let i = 1; i < validSources.length; i++) {
      const source = validSources[i];
      if (source.start) {
        if (
          source.start.line < minLine ||
          (source.start.line === minLine && source.start.column < minColumn)
        ) {
          minLine = source.start.line;
          minColumn = source.start.column;
        }
      }
      if (source.end) {
        if (
          source.end.line > maxLine ||
          (source.end.line === maxLine && source.end.column > maxColumn)
        ) {
          maxLine = source.end.line;
          maxColumn = source.end.column;
        }
      }
    }

    return {
      input: firstSource.input,
      start: { line: minLine, column: minColumn, offset: 0 },
      end: { line: maxLine, column: maxColumn, offset: 0 },
    };
  }

  /**
   * Validate source map integrity
   */
  validateSourceMap(root: Root): boolean {
    let isValid = true;
    const issues: string[] = [];

    // Check that all nodes have source information
    root.walk((node) => {
      if (!node.source) {
        issues.push(`Node ${node.type} missing source information`);
        isValid = false;
      }
    });

    // Check for inconsistent source files
    const sourceFiles = new Set<string>();
    root.walk((node) => {
      if (node.source?.input.from) {
        sourceFiles.add(node.source.input.from);
      }
    });

    if (sourceFiles.size > 1) {
      this.logger.warn("Multiple source files detected", {
        files: Array.from(sourceFiles),
      });
    }

    if (!isValid) {
      this.logger.warn("Source map validation failed", {
        issues: issues.slice(0, 10), // Limit to first 10 issues
      });
    }

    return isValid;
  }
}

/**
 * Create source mapper plugin instance
 */
export function createSourceMapper(): SourceMapper {
  return new SourceMapper();
}

// Export default plugin instance
export default createSourceMapper();
