/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * TypeScript type definitions for Tailwind Enigma Plugin
 */

declare module "tailwind-enigma" {
  import { PluginCreator } from "tailwindcss/types/config";

  /**
   * Pattern analysis configuration
   */
  export interface PatternConfig {
    /** Enable pattern analysis */
    enabled?: boolean;
    /** Minimum frequency threshold for pattern inclusion */
    minFrequency?: number;
    /** Include variant patterns (hover, focus, etc.) */
    includeVariants?: boolean;
    /** Analyze class co-occurrence patterns */
    analyzeCoOccurrence?: boolean;
  }

  /**
   * Utility class generation configuration
   */
  export interface UtilityConfig {
    /** Enable utility class generation */
    enabled?: boolean;
    /** Prefix for generated utility classes */
    prefix?: string;
    /** Generate responsive variants */
    generateResponsive?: boolean;
    /** Generate hover state variants */
    generateHover?: boolean;
    /** Generate focus state variants */
    generateFocus?: boolean;
  }

  /**
   * Development features configuration
   */
  export interface DevelopmentConfig {
    /** Enable hot reloading of pattern changes */
    hotReload?: boolean;
    /** Watch pattern files for changes */
    watchPatterns?: boolean;
    /** Generate autocomplete configuration */
    generateAutocomplete?: boolean;
    /** Log optimization activities to console */
    logOptimizations?: boolean;
  }

  /**
   * Integration settings configuration
   */
  export interface IntegrationConfig {
    /** Use existing TailwindOptimizer plugin */
    useExistingOptimizer?: boolean;
    /** Enable PostCSS integration */
    enablePostCSSIntegration?: boolean;
    /** Preserve debug comments in output */
    preserveComments?: boolean;
  }

  /**
   * File paths configuration
   */
  export interface PathsConfig {
    /** Path to patterns analysis file */
    patternsFile?: string;
    /** Path to frequency analysis file */
    frequencyFile?: string;
    /** Path to autocomplete configuration file */
    autocompleteFile?: string;
  }

  /**
   * Main plugin configuration interface
   */
  export interface TailwindEnigmaConfig {
    /** Pattern analysis configuration */
    patterns?: PatternConfig;
    /** Utility class generation configuration */
    utilities?: UtilityConfig;
    /** Development features configuration */
    development?: DevelopmentConfig;
    /** Integration settings configuration */
    integration?: IntegrationConfig;
    /** File paths configuration */
    paths?: PathsConfig;
  }

  /**
   * Pattern data structure from Enigma analysis
   */
  export interface PatternData {
    /** Pattern type classification */
    type: "atomic" | "utility" | "component";
    /** Pattern frequency count */
    frequency: number;
    /** CSS properties associated with pattern */
    properties?: Array<{
      property: string;
      value: string;
    }>;
    /** Class names that make up the pattern */
    classes: string[];
    /** Pattern complexity score */
    complexity?: number;
    /** Co-occurrence strength with other patterns */
    coOccurrenceStrength?: number;
  }

  /**
   * Frequency data structure
   */
  export interface FrequencyData {
    /** Map of class names to frequency counts */
    frequencyMap: Record<string, number>;
    /** Total number of classes analyzed */
    totalClasses?: number;
    /** Analysis timestamp */
    analyzedAt?: string;
  }

  /**
   * Generated utility class structure
   */
  export interface GeneratedUtility {
    /** CSS selector for the utility */
    selector: string;
    /** CSS declarations */
    declarations: Record<string, string>;
    /** Source pattern or classes */
    source: string[];
    /** Frequency of the source pattern */
    frequency: number;
    /** Generated utility name */
    utilityName: string;
  }

  /**
   * Autocomplete configuration structure
   */
  export interface AutocompleteConfig {
    /** Configuration version */
    version: string;
    /** Generated timestamp */
    generatedAt: string;
    /** List of utility class names */
    utilities: string[];
    /** Pattern suggestions */
    patterns: Array<{
      pattern: string;
      frequency: number;
      suggestion: string;
      category: string;
    }>;
    /** Context-aware suggestions */
    suggestions: Array<{
      trigger: string;
      completions: string[];
      context: string;
    }>;
    /** Category definitions */
    categories?: Record<
      string,
      {
        description: string;
        color: string;
        icon: string;
      }
    >;
    /** IDE integration settings */
    integration?: Record<string, any>;
  }

  /**
   * Plugin result interface
   */
  export interface PluginResult {
    /** Number of utilities generated */
    utilitiesGenerated: number;
    /** Number of patterns processed */
    patternsProcessed: number;
    /** Generated utilities */
    utilities: GeneratedUtility[];
    /** Autocomplete configuration */
    autocomplete?: AutocompleteConfig;
    /** Processing warnings */
    warnings: string[];
    /** Processing errors */
    errors: string[];
  }

  /**
   * Plugin context interface
   */
  export interface PluginContext {
    /** Loaded pattern data */
    patterns: PatternData[];
    /** Loaded frequency data */
    frequencies: Map<string, number>;
    /** Plugin configuration */
    config: TailwindEnigmaConfig;
    /** Tailwind configuration */
    tailwindConfig: any;
  }

  /**
   * Plugin helper functions interface
   */
  export interface PluginHelpers {
    /** Load pattern data from files */
    loadPatternData: (
      patternsPath: string,
      frequencyPath: string,
    ) => {
      patterns: PatternData[];
      frequencies: Map<string, number>;
    };
    /** Generate utilities from patterns */
    generateUtilitiesFromPatterns: (
      patterns: PatternData[],
      frequencies: Map<string, number>,
      config: TailwindEnigmaConfig,
    ) => Record<string, Record<string, string>>;
    /** Generate autocomplete configuration */
    generateAutocompleteConfig: (
      utilities: Record<string, Record<string, string>>,
      config: TailwindEnigmaConfig,
    ) => AutocompleteConfig;
  }

  /**
   * Main plugin function type
   */
  export interface TailwindEnigmaPlugin extends PluginCreator {
    /** Default configuration */
    defaultConfig: TailwindEnigmaConfig;
    /** Helper functions */
    loadPatternData: PluginHelpers["loadPatternData"];
    /** Utility generation function */
    generateUtilitiesFromPatterns: PluginHelpers["generateUtilitiesFromPatterns"];
  }

  /**
   * Plugin factory function
   */
  const tailwindEnigmaPlugin: {
    (config?: TailwindEnigmaConfig): PluginCreator;
    /** Default configuration object */
    defaultConfig: TailwindEnigmaConfig;
    /** Pattern data loading helper */
    loadPatternData: PluginHelpers["loadPatternData"];
    /** Utility generation helper */
    generateUtilitiesFromPatterns: PluginHelpers["generateUtilitiesFromPatterns"];
  };

  export default tailwindEnigmaPlugin;
}

/**
 * Global type augmentations for Tailwind CSS
 */
declare module "tailwindcss/types/config" {
  interface PluginAPI {
    /** Tailwind Enigma plugin utilities */
    enigma?: {
      /** Generated utility classes */
      utilities: Record<string, Record<string, string>>;
      /** Pattern data */
      patterns: import("tailwind-enigma").PatternData[];
      /** Frequency data */
      frequencies: Map<string, number>;
    };
  }
}

/**
 * Ambient module declarations for Node.js environment
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Node environment */
    NODE_ENV?: "development" | "production" | "test";
    /** Enable Tailwind Enigma debug logging */
    TAILWIND_ENIGMA_DEBUG?: string;
    /** Custom patterns file path */
    TAILWIND_ENIGMA_PATTERNS?: string;
    /** Custom frequency file path */
    TAILWIND_ENIGMA_FREQUENCY?: string;
  }
}

/**
 * CSS custom properties for Tailwind Enigma
 */
declare namespace CSS {
  interface Properties {
    /** Enigma optimization level */
    "--enigma-optimization"?: "none" | "basic" | "standard" | "aggressive";
    /** Enigma pattern frequency */
    "--enigma-frequency"?: number;
    /** Enigma pattern category */
    "--enigma-category"?:
      | "layout"
      | "typography"
      | "components"
      | "sizing"
      | "spacing";
  }
}

/**
 * Utility type helpers
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 * Configuration validation types
 */
export type ValidatedConfig<T> = T & {
  /** Indicates configuration has been validated */
  __validated: true;
  /** Validation timestamp */
  __validatedAt: string;
};

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycleHooks {
  /** Called before plugin initialization */
  beforeInit?: (config: TailwindEnigmaConfig) => void | Promise<void>;
  /** Called after plugin initialization */
  afterInit?: (context: PluginContext) => void | Promise<void>;
  /** Called before utility generation */
  beforeGenerate?: (
    patterns: PatternData[],
    frequencies: Map<string, number>,
  ) => void | Promise<void>;
  /** Called after utility generation */
  afterGenerate?: (result: PluginResult) => void | Promise<void>;
  /** Called on errors */
  onError?: (error: Error, context: string) => void | Promise<void>;
}
