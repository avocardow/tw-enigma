/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Tailwind Enigma Plugin
 * External Tailwind CSS plugin for integrating optimized classes into development workflows
 */

import plugin from "tailwindcss/plugin";
import fs from "fs";
import path from "path";

/**
 * Default configuration for the Tailwind Enigma plugin
 */
const defaultConfig = {
  // Pattern analysis configuration
  patterns: {
    enabled: true,
    minFrequency: 2,
    includeVariants: true,
    analyzeCoOccurrence: true,
  },

  // Utility class generation
  utilities: {
    enabled: true,
    prefix: "tw-opt-",
    generateResponsive: true,
    generateHover: true,
    generateFocus: true,
  },

  // Development features
  development: {
    hotReload: true,
    watchPatterns: true,
    generateAutocomplete: true,
    logOptimizations: false,
  },

  // Integration settings
  integration: {
    useExistingOptimizer: true,
    enablePostCSSIntegration: true,
    preserveComments: false,
  },

  // File paths
  paths: {
    patternsFile: "./.enigma/patterns.json",
    frequencyFile: "./.enigma/frequency.json",
    autocompleteFile: "./.enigma/autocomplete.json",
  },
};

/**
 * Load pattern data from Enigma analysis
 */
function loadPatternData(patternsPath, frequencyPath) {
  try {
    let patterns = [];
    let frequencies = new Map();

    // Load patterns if file exists
    if (fs.existsSync(patternsPath)) {
      const patternsData = JSON.parse(fs.readFileSync(patternsPath, "utf8"));
      patterns = patternsData.patterns || [];
    }

    // Load frequencies if file exists
    if (fs.existsSync(frequencyPath)) {
      const frequencyData = JSON.parse(fs.readFileSync(frequencyPath, "utf8"));
      if (frequencyData.frequencyMap) {
        frequencies = new Map(Object.entries(frequencyData.frequencyMap));
      }
    }

    return { patterns, frequencies };
  } catch (error) {
    console.warn(
      "Tailwind Enigma: Could not load pattern data:",
      error.message,
    );
    return { patterns: [], frequencies: new Map() };
  }
}

/**
 * Generate utility classes from patterns
 */
function generateUtilitiesFromPatterns(patterns, frequencies, config) {
  const utilities = {};
  let patternUtilityCount = 0;
  let frequencyUtilityCount = 0;

  // Generate utilities from frequent patterns
  for (const pattern of patterns) {
    if (
      pattern.frequency >= config.patterns.minFrequency
    ) {
      const utilityName = `${config.utilities.prefix}${patternUtilityCount++}`;

      // Convert pattern properties to CSS declarations
      const declarations = {};
      if (pattern.properties && pattern.properties.length > 0) {
        for (const prop of pattern.properties) {
          declarations[prop.property] = prop.value || "initial";
        }
      } else if (pattern.classes && pattern.classes.length > 0) {
        // Fallback: generate declarations from class names
        const cssDeclarations = generateCssFromClasses(pattern.classes);
        Object.assign(declarations, cssDeclarations);
      }

      if (Object.keys(declarations).length > 0) {
        utilities[`.${utilityName}`] = declarations;

        // Add comment for debugging
        if (config.integration.preserveComments) {
          utilities[`.${utilityName}`]["/* Generated from pattern */"] =
            `${pattern.classes.join(" ")} (frequency: ${pattern.frequency})`;
        }
      }
    }
  }

  // Generate utilities from high-frequency individual classes
  for (const [className, frequency] of frequencies) {
    if (frequency >= config.patterns.minFrequency && !className.includes(" ")) {
      const utilityName = `${config.utilities.prefix}freq-${frequencyUtilityCount++}`;
      const cssDeclarations = generateCssFromClasses([className]);

      if (Object.keys(cssDeclarations).length > 0) {
        utilities[`.${utilityName}`] = cssDeclarations;

        if (config.integration.preserveComments) {
          utilities[`.${utilityName}`]["/* Optimized frequent class */"] =
            `${className} (frequency: ${frequency})`;
        }
      }
    }
  }

  return utilities;
}

/**
 * Generate CSS declarations from Tailwind class names
 * This is a simplified implementation - in production, you'd use Tailwind's engine
 */
function generateCssFromClasses(classes) {
  const declarations = {};

  for (const className of classes) {
    // Remove variants for core class processing
    const coreClass = className.replace(
      /^(hover|focus|active|sm|md|lg|xl|2xl|dark):/,
      "",
    );

    // Basic mapping of common Tailwind classes to CSS
    const mappings = {
      flex: { display: "flex" },
      grid: { display: "grid" },
      block: { display: "block" },
      inline: { display: "inline" },
      hidden: { display: "none" },
      relative: { position: "relative" },
      absolute: { position: "absolute" },
      fixed: { position: "fixed" },
      sticky: { position: "sticky" },
      "justify-center": { "justify-content": "center" },
      "justify-start": { "justify-content": "flex-start" },
      "justify-end": { "justify-content": "flex-end" },
      "justify-between": { "justify-content": "space-between" },
      "items-center": { "align-items": "center" },
      "items-start": { "align-items": "flex-start" },
      "items-end": { "align-items": "flex-end" },
      "text-center": { "text-align": "center" },
      "text-left": { "text-align": "left" },
      "text-right": { "text-align": "right" },
      "font-bold": { "font-weight": "700" },
      "font-medium": { "font-weight": "500" },
      "font-normal": { "font-weight": "400" },
      rounded: { "border-radius": "0.25rem" },
      "rounded-lg": { "border-radius": "0.5rem" },
      "rounded-full": { "border-radius": "9999px" },
      shadow: {
        "box-shadow":
          "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      },
      "shadow-lg": {
        "box-shadow":
          "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      },
    };

    // Check for exact match
    if (mappings[coreClass]) {
      Object.assign(declarations, mappings[coreClass]);
      continue;
    }

    // Pattern matching for dynamic classes
    if (coreClass.startsWith("w-")) {
      const value = coreClass.substring(2);
      declarations["width"] = convertTailwindValue(value);
    } else if (coreClass.startsWith("h-")) {
      const value = coreClass.substring(2);
      declarations["height"] = convertTailwindValue(value);
    } else if (coreClass.startsWith("m-")) {
      const value = coreClass.substring(2);
      declarations["margin"] = convertTailwindValue(value);
    } else if (coreClass.startsWith("p-")) {
      const value = coreClass.substring(2);
      declarations["padding"] = convertTailwindValue(value);
    } else if (coreClass.startsWith("bg-")) {
      const color = coreClass.substring(3);
      declarations["background-color"] = convertTailwindColor(color);
    } else if (
      coreClass.startsWith("text-") &&
      !coreClass.startsWith("text-center")
    ) {
      const color = coreClass.substring(5);
      declarations["color"] = convertTailwindColor(color);
    }
  }

  return declarations;
}

/**
 * Convert Tailwind spacing/sizing value to CSS
 */
function convertTailwindValue(value) {
  const spacingMap = {
    0: "0px",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
    32: "8rem",
    auto: "auto",
    full: "100%",
    screen: "100vh",
  };

  return spacingMap[value] || value;
}

/**
 * Convert Tailwind color to CSS color value
 */
function convertTailwindColor(color) {
  const colorMap = {
    white: "#ffffff",
    black: "#000000",
    "gray-100": "#f3f4f6",
    "gray-200": "#e5e7eb",
    "gray-300": "#d1d5db",
    "gray-400": "#9ca3af",
    "gray-500": "#6b7280",
    "gray-600": "#4b5563",
    "gray-700": "#374151",
    "gray-800": "#1f2937",
    "gray-900": "#111827",
    "blue-500": "#3b82f6",
    "blue-600": "#2563eb",
    "red-500": "#ef4444",
    "green-500": "#10b981",
    "yellow-500": "#f59e0b",
    "purple-500": "#8b5cf6",
    "pink-500": "#ec4899",
    "indigo-500": "#6366f1",
  };

  return colorMap[color] || color;
}

/**
 * Generate autocomplete configuration for IDEs
 */
function generateAutocompleteConfig(utilities, config, patterns, frequencies) {
  const autocompleteData = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    utilities: Object.keys(utilities).map((selector) => selector.substring(1)), // Remove leading dot
    patterns: [],
    suggestions: [],
  };

  // Generate pattern suggestions from loaded patterns
  for (const pattern of patterns) {
    if (pattern.classes && pattern.classes.length > 0) {
      autocompleteData.patterns.push({
        pattern: pattern.classes.join(" "),
        frequency: pattern.frequency,
        type: pattern.type || "atomic",
        complexity: pattern.complexity || 1,
      });
    }
  }

  // Generate context-aware suggestions from frequent classes
  const frequentClasses = Array.from(frequencies.entries())
    .filter(([, freq]) => freq >= config.patterns.minFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20); // Top 20 frequent classes

  for (const [className, frequency] of frequentClasses) {
    autocompleteData.suggestions.push({
      trigger: className,
      frequency: frequency,
      type: "class",
    });
  }

  // Save autocomplete data if path is configured
  if (config.paths.autocompleteFile) {
    try {
      const autocompleteDir = path.dirname(config.paths.autocompleteFile);
      if (!fs.existsSync(autocompleteDir)) {
        fs.mkdirSync(autocompleteDir, { recursive: true });
      }
      fs.writeFileSync(
        config.paths.autocompleteFile,
        JSON.stringify(autocompleteData, null, 2),
      );
    } catch (error) {
      console.warn(
        "Tailwind Enigma: Could not save autocomplete config:",
        error.message,
      );
    }
  }

  return autocompleteData;
}

/**
 * Set up file watching for hot reloading
 */
function setupHotReloading(config, _addUtilities) {
  if (!config.development.hotReload) return;

  const watchPaths = [
    config.paths.patternsFile,
    config.paths.frequencyFile,
  ].filter(fs.existsSync);

  if (watchPaths.length === 0) return;

  // Simple file watching implementation
  watchPaths.forEach((filePath) => {
    try {
      fs.watchFile(filePath, { interval: 1000 }, () => {
        if (config.development.logOptimizations) {
          console.log(
            `Tailwind Enigma: Detected changes in ${filePath}, regenerating utilities...`,
          );
        }

        // Reload pattern data and regenerate utilities
        const { patterns, frequencies } = loadPatternData(
          config.paths.patternsFile,
          config.paths.frequencyFile,
        );

        const newUtilities = generateUtilitiesFromPatterns(
          patterns,
          frequencies,
          config,
        );

        // Note: In a real implementation, you'd need to trigger Tailwind rebuild
        // This is a simplified approach for demonstration
        if (config.development.logOptimizations) {
          console.log(
            `Tailwind Enigma: Generated ${Object.keys(newUtilities).length} optimized utilities`,
          );
        }
      });
    } catch (error) {
      console.warn(
        `Tailwind Enigma: Could not watch ${filePath}:`,
        error.message,
      );
    }
  });
}

/**
 * Main Tailwind Enigma Plugin
 */
const tailwindEnigmaPlugin = plugin.withOptions((options = {}) => {
  return ({
    addUtilities,
    addComponents: _addComponents,
    addBase: _addBase,
    theme: _theme,
    variants: _variants,
    e: _e,
    config: _tailwindConfig,
  }) => {
    // Merge user options with defaults
    const config = {
      ...defaultConfig,
      ...options,
      patterns: { ...defaultConfig.patterns, ...options.patterns },
      utilities: { ...defaultConfig.utilities, ...options.utilities },
      development: { ...defaultConfig.development, ...options.development },
      integration: { ...defaultConfig.integration, ...options.integration },
      paths: { ...defaultConfig.paths, ...options.paths },
    };

    // Load pattern data from Enigma analysis
    const { patterns, frequencies } = loadPatternData(
      config.paths.patternsFile,
      config.paths.frequencyFile,
    );

    if (config.development.logOptimizations) {
      console.log(
        `Tailwind Enigma: Loaded ${patterns.length} patterns and ${frequencies.size} frequency entries`,
      );
    }

    // Generate utility classes if enabled
    if (config.utilities.enabled) {
      const utilities = generateUtilitiesFromPatterns(
        patterns,
        frequencies,
        config,
      );

      if (Object.keys(utilities).length > 0) {
        // Add base utilities to Tailwind
        addUtilities(utilities, {
          respectPrefix: false,
          respectImportant: true,
        });

        // Generate responsive variants if enabled
        if (config.utilities.generateResponsive) {
          const responsiveUtilities = {};
          Object.entries(utilities).forEach(([selector, declarations]) => {
            const className = selector.substring(1); // Remove leading dot
            responsiveUtilities[`.md\\:${className}`] = {
              [`@media (min-width: 768px)`]: declarations
            };
            responsiveUtilities[`.lg\\:${className}`] = {
              [`@media (min-width: 1024px)`]: declarations
            };
          });
          addUtilities(responsiveUtilities, {
            respectPrefix: false,
            respectImportant: true,
          });
        }

        // Generate hover variants if enabled
        if (config.utilities.generateHover) {
          const hoverUtilities = {};
          Object.entries(utilities).forEach(([selector, declarations]) => {
            hoverUtilities[`.hover\\:${selector.substring(1)}:hover`] = declarations;
          });
          addUtilities(hoverUtilities, {
            respectPrefix: false,
            respectImportant: true,
          });
        }

        // Generate focus variants if enabled
        if (config.utilities.generateFocus) {
          const focusUtilities = {};
          Object.entries(utilities).forEach(([selector, declarations]) => {
            focusUtilities[`.focus\\:${selector.substring(1)}:focus`] = declarations;
          });
          addUtilities(focusUtilities, {
            respectPrefix: false,
            respectImportant: true,
          });
        }

        if (config.development.logOptimizations) {
          console.log(
            `Tailwind Enigma: Generated ${Object.keys(utilities).length} optimized utility classes`,
          );
        }

        // Generate autocomplete configuration
        if (config.development.generateAutocomplete) {
          generateAutocompleteConfig(utilities, config, patterns, frequencies);
        }
      }
    }

    // Set up hot reloading in development
    if (process.env.NODE_ENV !== "production") {
      setupHotReloading(config, addUtilities);
    }
  };
});

// Export the plugin
export default tailwindEnigmaPlugin;

// Also export configuration helpers
export { defaultConfig, loadPatternData, generateUtilitiesFromPatterns };
