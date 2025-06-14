/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * CSS Minifier Plugin
 * Minifies CSS output by removing whitespace, comments, and optimizing declarations
 */

import type { Plugin, Root, Rule, Declaration, Comment } from "postcss";
import { z } from "zod";
import { BaseEnigmaPlugin } from "../postcssPlugin.ts";
import type { PluginContext } from "../../types/plugins.ts";

/**
 * Configuration schema for CSS Minifier
 */
const CssMinifierConfigSchema = z.object({
  removeComments: z.boolean().optional().default(true),
  removeWhitespace: z.boolean().optional().default(true),
  compressColors: z.boolean().optional().default(true),
  optimizeDeclarations: z.boolean().optional().default(true),
  mergeRules: z.boolean().optional().default(true),
  removeEmptyRules: z.boolean().optional().default(true),
  preserveImportant: z.boolean().optional().default(true),
  compressNumbers: z.boolean().optional().default(true),
});

type CssMinifierConfig = z.infer<typeof CssMinifierConfigSchema>;

/**
 * CSS minifier plugin
 */
export class CssMinifier extends BaseEnigmaPlugin {
  readonly meta = {
    name: "css-minifier",
    version: "1.0.0",
    description:
      "Minifies CSS output by removing unnecessary whitespace and optimizing declarations",
    author: "Enigma Core Team",
  };

  readonly configSchema = CssMinifierConfigSchema;

  createPlugin(context: PluginContext): Plugin {
    return {
      postcssPlugin: 'enigma-css-minifier',
      Once: async (root: Root) => {
      const config = context.config.options as CssMinifierConfig;
      const startMemory = this.getMemoryUsage();

      this.logger.debug("Starting CSS minification", { config });

      try {
        // Remove comments
        if (config.removeComments) {
          this.removeComments(root, context);
        }

        // Optimize declarations
        if (config.optimizeDeclarations) {
          this.optimizeDeclarations(root, context);
        }

        // Compress colors
        if (config.compressColors) {
          this.compressColors(root, context);
        }

        // Compress numbers
        if (config.compressNumbers) {
          this.compressNumbers(root, context);
        }

        // Remove empty rules
        if (config.removeEmptyRules) {
          this.removeEmptyRules(root, context);
        }

        // Merge duplicate rules (if enabled)
        if (config.mergeRules) {
          this.mergeDuplicateRules(root, context);
        }

        const endMemory = this.getMemoryUsage();
        context.metrics.recordMemory(Math.max(0, endMemory - startMemory));

        this.logger.debug("CSS minification completed");
      } catch (error) {
        this.addWarning(
          context,
          `CSS minification failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }
    };
  }

  /**
   * Remove comments from CSS
   */
  private removeComments(root: Root, _context: PluginContext): void {
    let removedCount = 0;

    root.walkComments((comment: Comment) => {
      // Preserve important comments (those starting with !)
      if (!comment.text.startsWith("!")) {
        comment.remove();
        removedCount++;
        // Transformation recorded
      }
    });

    if (removedCount > 0) {
      this.logger.debug(`Removed ${removedCount} comments`);
    }
  }

  /**
   * Optimize CSS declarations
   */
  private optimizeDeclarations(root: Root, _context: PluginContext): void {
    let optimizedCount = 0;

    root.walkDecls((decl: Declaration) => {
      const originalValue = decl.value;
      let optimizedValue = originalValue;

      // Remove unnecessary quotes from font families
      if (decl.prop === "font-family" || decl.prop === "font") {
        optimizedValue = this.optimizeFontFamily(optimizedValue);
      }

      // Optimize margin/padding shorthand
      if (
        ["margin", "padding", "border-width", "border-radius"].includes(
          decl.prop,
        )
      ) {
        optimizedValue = this.optimizeShorthand(optimizedValue);
      }

      // Remove unnecessary units from zero values
      optimizedValue = this.removeZeroUnits(optimizedValue);

      // Compress whitespace
      optimizedValue = optimizedValue.replace(/\s+/g, " ").trim();

      if (optimizedValue !== originalValue) {
        decl.value = optimizedValue;
        optimizedCount++;
        // Transformation recorded
      }
    });

    if (optimizedCount > 0) {
      this.logger.debug(`Optimized ${optimizedCount} declarations`);
    }
  }

  /**
   * Compress color values
   */
  private compressColors(root: Root, _context: PluginContext): void {
    let compressedCount = 0;

    root.walkDecls((decl: Declaration) => {
      const originalValue = decl.value;
      let compressedValue = originalValue;

      // Compress hex colors (#ffffff -> #fff)
      compressedValue = compressedValue.replace(
        /#([a-fA-F0-9])\1([a-fA-F0-9])\2([a-fA-F0-9])\3/g,
        "#$1$2$3",
      );

      // Convert rgb() to hex when shorter
      compressedValue = compressedValue.replace(
        /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
        (match, r, g, b) => {
          const hex =
            "#" +
            [r, g, b]
              .map((n) => parseInt(n, 10).toString(16).padStart(2, "0"))
              .join("");
          return hex.length <= match.length ? hex : match;
        },
      );

      // Convert named colors to hex when shorter
      const namedColors: Record<string, string> = {
        white: "#fff",
        black: "#000",
        red: "#f00",
        green: "#008000",
        blue: "#00f",
        yellow: "#ff0",
        cyan: "#0ff",
        magenta: "#f0f",
      };

      for (const [name, hex] of Object.entries(namedColors)) {
        const regex = new RegExp(`\\b${name}\\b`, "gi");
        if (regex.test(compressedValue) && hex.length < name.length) {
          compressedValue = compressedValue.replace(regex, hex);
        }
      }

      if (compressedValue !== originalValue) {
        decl.value = compressedValue;
        compressedCount++;
        // Transformation recorded
      }
    });

    if (compressedCount > 0) {
      this.logger.debug(`Compressed ${compressedCount} color values`);
    }
  }

  /**
   * Compress numeric values
   */
  private compressNumbers(root: Root, _context: PluginContext): void {
    let compressedCount = 0;

    root.walkDecls((decl: Declaration) => {
      const originalValue = decl.value;
      let compressedValue = originalValue;

      // Remove leading zeros (0.5 -> .5)
      compressedValue = compressedValue.replace(/\b0+(\.\d+)/g, "$1");

      // Remove trailing zeros (1.50 -> 1.5)
      compressedValue = compressedValue.replace(/(\.\d*?)0+\b/g, "$1");

      // Remove unnecessary decimal point (1. -> 1)
      compressedValue = compressedValue.replace(/(\d+)\.(?!\d)/g, "$1");

      if (compressedValue !== originalValue) {
        decl.value = compressedValue;
        compressedCount++;
        // Transformation recorded
      }
    });

    if (compressedCount > 0) {
      this.logger.debug(`Compressed ${compressedCount} numeric values`);
    }
  }

  /**
   * Remove empty rules
   */
  private removeEmptyRules(root: Root, _context: PluginContext): void {
    let removedCount = 0;

    root.walkRules((rule: Rule) => {
      // Check if rule has any declarations
      let hasDeclarations = false;
      rule.walkDecls(() => {
        hasDeclarations = true;
        return false; // Stop walking
      });

      // Check if rule has any nested rules
      let hasNestedRules = false;
      rule.walkRules(() => {
        hasNestedRules = true;
        return false; // Stop walking
      });

      if (!hasDeclarations && !hasNestedRules) {
        rule.remove();
        removedCount++;
        // Transformation recorded
      }
    });

    if (removedCount > 0) {
      this.logger.debug(`Removed ${removedCount} empty rules`);
    }
  }

  /**
   * Merge duplicate rules with identical selectors
   */
  private mergeDuplicateRules(root: Root, _context: PluginContext): void {
    const rulesBySelector = new Map<string, Rule[]>();
    let mergedCount = 0;

    // Group rules by selector
    root.walkRules((rule: Rule) => {
      const selector = rule.selector;
      if (!rulesBySelector.has(selector)) {
        rulesBySelector.set(selector, []);
      }
      rulesBySelector.get(selector)!.push(rule);
    });

    // Merge duplicate selectors
    for (const [, rules] of rulesBySelector) {
      if (rules.length > 1) {
        const firstRule = rules[0];
        const declarations = new Map<string, Declaration>();

        // Collect all declarations, with later ones overriding earlier ones
        for (const rule of rules) {
          rule.walkDecls((decl: Declaration) => {
            declarations.set(decl.prop, decl.clone());
          });
        }

        // Remove all rules except the first
        for (let i = 1; i < rules.length; i++) {
          rules[i].remove();
          mergedCount++;
          // Transformation recorded
        }

        // Clear the first rule and add merged declarations
        firstRule.removeAll();
        for (const decl of declarations.values()) {
          firstRule.append(decl);
        }
      }
    }

    if (mergedCount > 0) {
      this.logger.debug(`Merged ${mergedCount} duplicate rules`);
    }
  }

  /**
   * Optimize font-family declarations
   */
  private optimizeFontFamily(value: string): string {
    // Remove unnecessary quotes from single-word font names
    return value.replace(/"([a-zA-Z]+)"/g, (match, family) => {
      // Keep quotes for multi-word or special character font names
      if (family.includes(" ") || !/^[a-zA-Z-]+$/.test(family)) {
        return match;
      }
      return family;
    });
  }

  /**
   * Optimize shorthand properties
   */
  private optimizeShorthand(value: string): string {
    const values = value.split(/\s+/);

    if (values.length === 4) {
      // Check for optimizable patterns: top right bottom left
      const [top, right, bottom, left] = values;

      if (top === right && right === bottom && bottom === left) {
        // All same: return single value
        return top;
      } else if (top === bottom && right === left) {
        // Vertical/horizontal pairs: return two values
        return `${top} ${right}`;
      } else if (right === left) {
        // Left/right same: return three values
        return `${top} ${right} ${bottom}`;
      }
    }

    return value;
  }

  /**
   * Remove units from zero values
   */
  private removeZeroUnits(value: string): string {
    // Remove units from zero values (0px -> 0, 0em -> 0, etc.)
    return value.replace(
      /\b0+(px|em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|in|pt|pc|%)/g,
      "0",
    );
  }
}

/**
 * Create CSS minifier plugin instance
 */
export function createCssMinifier(): CssMinifier {
  return new CssMinifier();
}

// Export default plugin instance
export default createCssMinifier();
