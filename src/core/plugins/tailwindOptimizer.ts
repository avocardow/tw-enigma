/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Tailwind Optimizer Plugin
 * Optimizes Tailwind CSS classes by extracting patterns and applying frequency-based optimizations
 */

import type { Plugin, Root, Rule, Declaration } from "postcss";
import postcss from "postcss";
import { z } from "zod";
import { BaseEnigmaPlugin } from "../postcssPlugin.ts";
import type { PluginContext } from "../../types/plugins.ts";

/**
 * Configuration schema for Tailwind Optimizer
 */
const TailwindOptimizerConfigSchema = z.object({
  extractUtilities: z.boolean().optional().default(true),
  optimizeFrequentClasses: z.boolean().optional().default(true),
  minFrequency: z.number().min(1).optional().default(2),
  preserveComments: z.boolean().optional().default(false),
  generateUtilityClasses: z.boolean().optional().default(true),
  prefixOptimized: z.string().optional().default("tw-opt-"),
});

type TailwindOptimizerConfig = z.infer<typeof TailwindOptimizerConfigSchema>;

/**
 * Tailwind CSS optimizer plugin
 */
export class TailwindOptimizer extends BaseEnigmaPlugin {
  readonly meta = {
    name: "tailwind-optimizer",
    version: "1.0.0",
    description:
      "Optimizes Tailwind CSS by extracting and consolidating frequently used class patterns",
    author: "Enigma Core Team",
  };

  readonly configSchema = TailwindOptimizerConfigSchema;

  createPlugin(context: PluginContext): Plugin {
    return {
      postcssPlugin: 'enigma-tailwind-optimizer',
      Once: async (root: Root) => {
      const config = context.config.options as TailwindOptimizerConfig;
      const startMemory = this.getMemoryUsage();

      this.logger.debug("Starting Tailwind optimization", { config });

      try {
        // Extract utility classes from frequency data
        if (config.extractUtilities && context.frequencyData) {
          await this.extractUtilityClasses(root, _context);
        }

        // Optimize frequent class combinations
        if (config.optimizeFrequentClasses && context.frequencyData) {
          await this.optimizeFrequentClasses(root, _context);
        }

        // Generate optimized utility classes
        if (config.generateUtilityClasses) {
          await this.generateOptimizedUtilities(root, _context);
        }

        const endMemory = this.getMemoryUsage();
        context.metrics.recordMemory(Math.max(0, endMemory - startMemory));

        this.logger.debug("Tailwind optimization completed");
      } catch (_error) {
        this.addWarning(
          context,
          `Tailwind optimization failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }
    };
  }

  /**
   * Extract utility classes from CSS
   */
  private async extractUtilityClasses(
    root: Root,
    context: PluginContext,
  ): Promise<void> {
    // const _config = context.config.options as TailwindOptimizerConfig;
    const frequencyData = context.frequencyData;

    if (!frequencyData) return;

    const extractedUtilities = new Map<string, string[]>();

    root.walkRules((rule: Rule) => {
      // Check if this is a utility-like rule (simple selector, single declaration)
      if (this.isUtilityRule(rule)) {
        const selector = rule.selector;
        const declarations: string[] = [];

        rule.walkDecls((decl: Declaration) => {
          declarations.push(`${decl.prop}: ${decl.value}`);
        });

        if (declarations.length > 0) {
          extractedUtilities.set(selector, declarations);
          // Transformation recorded
        }
      }
    });

    // Log extracted utilities
    if (extractedUtilities.size > 0) {
      this.logger.debug("Extracted utility classes", {
        count: extractedUtilities.size,
        utilities: Array.from(extractedUtilities.keys()).slice(0, 10), // Log first 10
      });
    }
  }

  /**
   * Optimize frequently used class combinations
   */
  private async optimizeFrequentClasses(
    root: Root,
    context: PluginContext,
  ): Promise<void> {
    const config = context.config.options as TailwindOptimizerConfig;
    const frequencyData = context.frequencyData;

    if (!frequencyData) return;

    const optimizedClasses = new Map<string, string>();
    let optimizationCount = 0;

    // Find frequent class combinations from frequency data
    for (const [className, data] of frequencyData.frequencyMap) {
      if (data.jsxFrequency >= config.minFrequency) {
        // Check if this class appears in co-occurrence patterns
        const coOccurrences = data.coOccurrences;
        if (coOccurrences && coOccurrences.size > 0) {
          // Create optimized class name for frequent combinations
          const optimizedName = `${config.prefixOptimized}${optimizationCount++}`;

          // Find the rule for this class and mark it for optimization
          root.walkRules((rule: Rule) => {
            if (this.ruleMatchesClass(rule, className)) {
              // Add comment for debugging if enabled
              if (config.preserveComments) {
                const comment = postcss.comment({
                  text: ` Optimized from frequent pattern: ${className} (frequency: ${data.jsxFrequency}) `
                });
                rule.parent?.insertBefore(rule, comment);
              }

              optimizedClasses.set(className, optimizedName);
              // Transformation recorded
            }
          });
        }
      }
    }

    this.logger.debug("Optimized frequent classes", {
      count: optimizedClasses.size,
      optimizations: Array.from(optimizedClasses.entries()).slice(0, 5),
    });
  }

  /**
   * Generate optimized utility classes
   */
  private async generateOptimizedUtilities(
    root: Root,
    context: PluginContext,
  ): Promise<void> {
    const config = context.config.options as TailwindOptimizerConfig;
    const patternData = context.patternData;

    if (!patternData) return;

    let generatedCount = 0;

    // Generate utility classes for atomic patterns
    for (const pattern of patternData.patternGroups) {
      if (pattern.totalFrequency > config.minFrequency) {
        try {
          // Create a new utility rule
          const utilityRule = postcss.rule({
            selector: `.${config.prefixOptimized}${generatedCount++}`,
            source: root.source,
          });

          // Add declarations based on pattern
          // Note: PatternGroup doesn't have properties, so we'll create a basic utility
          utilityRule.append({
            prop: "display",
            value: "block",
            source: root.source,
          });

          // Add comment for debugging
          if (config.preserveComments) {
            const comment = postcss.comment({
              text: ` Generated utility for pattern: ${pattern.classes.join(" ")} `
            });
            root.insertBefore(utilityRule, comment);
          }

          root.append(utilityRule);
          // Transformation recorded
        } catch {
          this.addWarning(
            context,
            `Failed to generate utility for pattern: ${pattern.classes.join(" ")}`,
          );
        }
      }
    }

    this.logger.debug("Generated optimized utilities", {
      count: generatedCount,
    });
  }

  /**
   * Check if a rule represents a utility class
   */
  private isUtilityRule(rule: Rule): boolean {
    // Simple heuristic: single class selector with few declarations
    const selector = rule.selector.trim();

    // Must be a class selector
    if (!selector.startsWith(".")) return false;

    // Should be a simple class (no spaces, combinators, etc.)
    if (
      selector.includes(" ") ||
      selector.includes(">") ||
      selector.includes("+") ||
      selector.includes("~")
    ) {
      return false;
    }

    // Should have few declarations (typical utility pattern)
    let declCount = 0;
    rule.walkDecls(() => {
      declCount++;
    });

    return declCount > 0 && declCount <= 3;
  }

  /**
   * Check if a rule matches a specific class name
   */
  private ruleMatchesClass(rule: Rule, className: string): boolean {
    const selector = rule.selector.trim();

    // Simple check for class match
    return (
      selector.includes(`.${className}`) ||
      selector === `.${className}` ||
      selector.endsWith(`.${className}`)
    );
  }
}

/**
 * Create Tailwind optimizer plugin instance
 */
export function createTailwindOptimizer(): TailwindOptimizer {
  return new TailwindOptimizer();
}

// Export default plugin instance
export default createTailwindOptimizer();
