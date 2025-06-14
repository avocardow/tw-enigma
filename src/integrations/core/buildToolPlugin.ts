/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Build Tool Plugin Interface
 * Base interface for integrating Tailwind Enigma with build tools
 */

import type { z } from "zod";
import type { EnigmaPlugin, PluginConfig } from "../../types/plugins.ts";
import type { FrameworkInfo } from "../../frameworkDetector.ts";

/**
 * Build tool lifecycle phases
 */
export type BuildPhase =
  | "beforeBuild"
  | "buildStart"
  | "compilation"
  | "transform"
  | "generateBundle"
  | "emit"
  | "afterBuild"
  | "development"
  | "production";

/**
 * Build tool types supported by the integration system
 */
export type BuildToolType =
  | "webpack"
  | "vite"
  | "esbuild"
  | "rollup"
  | "nextjs"
  | "parcel"
  | "custom";

/**
 * Build context information passed to plugin hooks
 */
export interface BuildToolContext {
  /** Build tool type */
  buildTool: BuildToolType;
  /** Current build phase */
  phase: BuildPhase;
  /** Whether this is a development build */
  isDevelopment: boolean;
  /** Whether this is a production build */
  isProduction: boolean;
  /** Project root directory */
  projectRoot: string;
  /** Detected framework information */
  framework?: FrameworkInfo;
  /** Build tool configuration */
  buildConfig?: Record<string, any>;
  /** Source files being processed */
  sourceFiles: string[];
  /** Output directory */
  outputDir?: string;
  /** Assets map (filename -> content) */
  assets: Map<string, string>;
  /** CSS optimization results */
  optimizationResults?: OptimizationResult;
  /** Performance metrics */
  metrics: BuildMetrics;
}

/**
 * CSS optimization results from Enigma processing
 */
export interface OptimizationResult {
  /** Original CSS size */
  originalSize: number;
  /** Optimized CSS size */
  optimizedSize: number;
  /** Size reduction percentage */
  reductionPercentage: number;
  /** Number of classes processed */
  classesProcessed: number;
  /** Number of classes removed */
  classesRemoved: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Generated CSS content */
  css: string;
  /** Source map if generated */
  sourceMap?: string;
}

/**
 * Build performance metrics
 */
export interface BuildMetrics {
  /** Build start time */
  startTime: number;
  /** Build end time */
  endTime?: number;
  /** Processing times by phase */
  phaseTimings: Partial<Record<BuildPhase, number>>;
  /** Memory usage peaks */
  memoryPeaks: Partial<Record<BuildPhase, number>>;
  /** Asset sizes */
  assetSizes: Record<string, number>;
  /** File counts */
  fileCounts: {
    total: number;
    processed: number;
    skipped: number;
  };
}

/**
 * HMR (Hot Module Replacement) update information
 */
export interface HMRUpdate {
  /** Updated file path */
  filePath: string;
  /** Update type */
  type: "css" | "js" | "asset";
  /** New content */
  content: string;
  /** Source map if available */
  sourceMap?: string;
  /** Timestamp of update */
  timestamp: number;
}

/**
 * Build tool plugin configuration schema
 */
export interface BuildToolPluginConfig extends PluginConfig {
  /** Build tool specific options */
  buildTool: {
    /** Build tool type */
    type: BuildToolType;
    /** Auto-detect build tool configuration */
    autoDetect?: boolean;
    /** Custom configuration file path */
    configPath?: string;
    /** Development mode settings */
    development?: {
      /** Enable HMR support */
      hmr?: boolean;
      /** HMR update delay in milliseconds */
      hmrDelay?: number;
      /** Enable live reload */
      liveReload?: boolean;
    };
    /** Production mode settings */
    production?: {
      /** Enable source maps */
      sourceMaps?: boolean;
      /** Minify output */
      minify?: boolean;
      /** Extract CSS to separate files */
      extractCSS?: boolean;
    };
    /** Integration hooks configuration */
    hooks?: {
      /** Enable specific lifecycle hooks */
      enabledPhases?: BuildPhase[];
      /** Hook execution order priority */
      priority?: number;
    };
  };
}

/**
 * Build tool plugin lifecycle hooks
 */
export interface BuildToolHooks {
  /** Called before build starts */
  beforeBuild?(context: BuildToolContext): Promise<void> | void;

  /** Called when build starts */
  buildStart?(context: BuildToolContext): Promise<void> | void;

  /** Called during compilation phase */
  compilation?(context: BuildToolContext): Promise<void> | void;

  /** Called during file transformation */
  transform?(
    context: BuildToolContext,
    code: string,
    filePath: string,
  ): Promise<string> | string;

  /** Called when generating bundle */
  generateBundle?(context: BuildToolContext): Promise<void> | void;

  /** Called during asset emission */
  emit?(context: BuildToolContext): Promise<void> | void;

  /** Called after build completes */
  afterBuild?(context: BuildToolContext): Promise<void> | void;

  /** Called during development mode */
  development?(context: BuildToolContext): Promise<void> | void;

  /** Called during production mode */
  production?(context: BuildToolContext): Promise<void> | void;

  /** Called on HMR update */
  onHMRUpdate?(
    update: HMRUpdate,
    context: BuildToolContext,
  ): Promise<void> | void;

  /** Called on file change */
  onFileChange?(
    filePath: string,
    context: BuildToolContext,
  ): Promise<void> | void;
}

/**
 * Build tool integration result
 */
export interface BuildToolResult {
  /** Whether integration was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Generated assets */
  assets: Record<string, string>;
  /** Optimization results */
  optimization?: OptimizationResult;
  /** Build metrics */
  metrics: BuildMetrics;
  /** Warnings generated */
  warnings: string[];
}

/**
 * Extended Enigma plugin interface for build tool integration
 */
export interface BuildToolPlugin extends EnigmaPlugin {
  /** Plugin type identifier */
  readonly pluginType: "build-tool";

  /** Plugin name */
  readonly name: string;

  /** Supported build tools */
  readonly supportedBuildTools: readonly BuildToolType[];

  /** Build tool configuration schema */
  readonly buildToolConfigSchema: z.ZodSchema<any>;

  /** Build tool lifecycle hooks */
  readonly hooks: BuildToolHooks;

  /** Initialize with build tool context */
  initializeBuildTool(
    context: BuildToolContext,
    config: BuildToolPluginConfig,
  ): Promise<void> | void;

  /** Process files during build */
  processBuild(context: BuildToolContext): Promise<BuildToolResult>;

  /** Handle HMR updates */
  handleHMR?(
    update: HMRUpdate,
    context: BuildToolContext,
  ): Promise<void> | void;

  /** Get build tool configuration */
  getBuildToolConfig?(
    buildTool: BuildToolType,
  ): Record<string, any> | undefined;
}

/**
 * Build tool integration error
 */
export class BuildToolIntegrationError extends Error {
  constructor(
    message: string,
    public readonly buildTool: BuildToolType,
    public readonly phase: BuildPhase,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "BuildToolIntegrationError";
  }
}

/**
 * Utility function to check if a plugin is a build tool plugin
 */
export function isBuildToolPlugin(plugin: any): plugin is BuildToolPlugin {
  return (
    plugin &&
    typeof plugin === "object" &&
    plugin.pluginType === "build-tool" &&
    Array.isArray(plugin.supportedBuildTools) &&
    typeof plugin.hooks === "object" &&
    typeof plugin.initializeBuildTool === "function" &&
    typeof plugin.processBuild === "function"
  );
}

/**
 * Create build tool context
 */
export function createBuildToolContext(
  buildTool: BuildToolType,
  phase: BuildPhase,
  options: Partial<BuildToolContext> = {},
): BuildToolContext {
  return {
    buildTool,
    phase,
    isDevelopment: process.env.NODE_ENV === "development",
    isProduction: process.env.NODE_ENV === "production",
    projectRoot: process.cwd(),
    sourceFiles: [],
    assets: new Map(),
    metrics: {
      startTime: Date.now(),
      phaseTimings: {},
      memoryPeaks: {},
      assetSizes: {},
      fileCounts: {
        total: 0,
        processed: 0,
        skipped: 0,
      },
    },
    ...options,
  };
}
