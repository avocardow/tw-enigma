/**
 * Framework Detection System for Tailwind Enigma Core
 *
 * Provides comprehensive framework detection capabilities including:
 * - React, Next.js, Vue, Angular, Vite detection
 * - Package.json and dependency analysis
 * - Configuration file parsing
 * - Multi-framework project support
 * - Confidence scoring and priority ranking
 */

import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// Configuration Schema
export const FrameworkDetectorOptionsSchema = z.object({
  /** Root directory to analyze */
  rootPath: z.string().default(process.cwd()),
  /** Enable package.json analysis */
  enablePackageAnalysis: z.boolean().default(true),
  /** Enable configuration file analysis */
  enableConfigAnalysis: z.boolean().default(true),
  /** Enable source code pattern analysis */
  enableCodeAnalysis: z.boolean().default(true),
  /** Cache detection results */
  enableCaching: z.boolean().default(true),
  /** Maximum files to analyze for code patterns */
  maxCodeFiles: z.number().default(100),
  /** Confidence threshold for framework detection */
  confidenceThreshold: z.number().min(0).max(1).default(0.6),
});

export type FrameworkDetectorOptions = z.infer<
  typeof FrameworkDetectorOptionsSchema
>;

// Core Types
export type FrameworkType =
  | "react"
  | "nextjs"
  | "vue"
  | "angular"
  | "vite"
  | "svelte"
  | "solid"
  | "preact"
  | "unknown";

export interface FrameworkInfo {
  /** Framework identifier */
  type: FrameworkType;
  /** Framework display name */
  name: string;
  /** Detected version (if available) */
  version?: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detection sources that identified this framework */
  sources: DetectionSource[];
  /** Framework-specific metadata */
  metadata: {
    /** Main entry points */
    entryPoints?: string[];
    /** Configuration files found */
    configFiles?: string[];
    /** Key dependencies */
    dependencies?: string[];
    /** Build system information */
    buildSystem?: string;
    /** TypeScript support detected */
    hasTypeScript?: boolean;
    /** Additional framework-specific data */
    [key: string]: any;
  };
}

export interface DetectionSource {
  /** Source type */
  type: "package" | "config" | "code" | "filesystem";
  /** Source description */
  description: string;
  /** Confidence contribution (0-1) */
  confidence: number;
  /** Source file or location */
  location?: string;
  /** Evidence found */
  evidence?: string[];
}

export interface DetectionContext {
  /** Project root path */
  rootPath: string;
  /** Package.json content (if available) */
  packageJson?: any;
  /** Found configuration files */
  configFiles?: Map<string, any>;
  /** Source file patterns */
  sourcePatterns?: string[];
  /** File system structure */
  fileStructure?: {
    directories: string[];
    files: string[];
  };
}

export interface DetectionResult {
  /** Detected frameworks (sorted by confidence) */
  frameworks: FrameworkInfo[];
  /** Primary framework (highest confidence) */
  primary?: FrameworkInfo;
  /** Detection context used */
  context: DetectionContext;
  /** Overall detection confidence */
  overallConfidence: number;
  /** Detection errors or warnings */
  issues: string[];
  /** Performance metrics */
  performance: {
    detectionTime: number;
    filesAnalyzed: number;
    cacheMisses: number;
  };
}

// Abstract detector interface
export interface IFrameworkDetector {
  /** Framework type this detector handles */
  readonly frameworkType: FrameworkType;
  /** Detector name */
  readonly name: string;
  /** Detect framework from context */
  detect(context: DetectionContext): Promise<FrameworkInfo | null>;
  /** Check if detector can handle this context */
  canDetect(context: DetectionContext): boolean;
}

/**
 * Main Framework Detection Engine
 */
export class FrameworkDetector {
  private options: FrameworkDetectorOptions;
  private detectors: Map<FrameworkType, IFrameworkDetector> = new Map();
  private cache: Map<string, DetectionResult> = new Map();

  constructor(options: Partial<FrameworkDetectorOptions> = {}) {
    this.options = FrameworkDetectorOptionsSchema.parse(options);
    this.registerDefaultDetectors();
  }

  /**
   * Detect frameworks in the given directory
   */
  async detect(rootPath?: string): Promise<DetectionResult> {
    const targetPath = rootPath || this.options.rootPath;
    const startTime = performance.now();

    // Check cache first
    const cacheKey = targetPath;
    const cachedResult = this.options.enableCaching
      ? this.cache.get(cacheKey)
      : undefined;

    if (cachedResult) {
      // Return cached result with updated performance metrics
      return {
        ...cachedResult,
        performance: {
          ...cachedResult.performance,
          detectionTime: performance.now() - startTime,
          cacheMisses: 0,
        },
      };
    }

    try {
      // Ensure detectors are loaded
      await this.ensureDetectorsLoaded();

      // Build detection context
      const context = await this.buildDetectionContext(targetPath);

      // Run all detectors
      const detectionPromises = Array.from(this.detectors.values())
        .filter((detector) => detector.canDetect(context))
        .map((detector) => this.runDetector(detector, context));

      const detectorResults = await Promise.allSettled(detectionPromises);

      // Collect successful results
      const frameworks: FrameworkInfo[] = [];
      const issues: string[] = [];

      for (const result of detectorResults) {
        if (result.status === "fulfilled" && result.value) {
          frameworks.push(result.value);
        } else if (result.status === "rejected") {
          issues.push(`Detection error: ${result.reason.message}`);
        }
      }

      // Sort by confidence and apply threshold
      const validFrameworks = frameworks
        .filter((fw) => fw.confidence >= this.options.confidenceThreshold)
        .sort((a, b) => b.confidence - a.confidence);

      // Calculate overall confidence
      const overallConfidence =
        validFrameworks.length > 0
          ? Math.max(...validFrameworks.map((fw) => fw.confidence))
          : 0;

      const detectionTime = performance.now() - startTime;

      const result: DetectionResult = {
        frameworks: validFrameworks,
        primary: validFrameworks[0] || undefined,
        context,
        overallConfidence,
        issues,
        performance: {
          detectionTime,
          filesAnalyzed: context.sourcePatterns?.length || 0,
          cacheMisses: 1,
        },
      };

      // Cache result
      if (this.options.enableCaching) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new FrameworkDetectionError(
        `Framework detection failed for ${targetPath}: ${errorMessage}`,
        targetPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Register a framework detector
   */
  registerDetector(detector: IFrameworkDetector): void {
    this.detectors.set(detector.frameworkType, detector);
  }

  /**
   * Get all registered detectors
   */
  getDetectors(): IFrameworkDetector[] {
    return Array.from(this.detectors.values());
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Build detection context from project directory
   */
  private async buildDetectionContext(
    rootPath: string,
  ): Promise<DetectionContext> {
    // Check if directory exists
    try {
      await fs.access(rootPath);
    } catch {
      throw new FrameworkDetectionError(
        `Directory does not exist: ${rootPath}`,
        rootPath,
      );
    }

    const context: DetectionContext = {
      rootPath,
      configFiles: new Map(),
    };

    try {
      // Load package.json if enabled
      if (this.options.enablePackageAnalysis) {
        try {
          const packagePath = path.join(rootPath, "package.json");
          const packageContent = await fs.readFile(packagePath, "utf-8");
          context.packageJson = JSON.parse(packageContent);
        } catch {
          // package.json not found or invalid - not an error
        }
      }

      // Analyze configuration files if enabled
      if (this.options.enableConfigAnalysis) {
        context.configFiles = await this.analyzeConfigFiles(rootPath);
      }

      // Analyze source patterns if enabled
      if (this.options.enableCodeAnalysis) {
        context.sourcePatterns = await this.analyzeSourcePatterns(rootPath);
      }

      // Analyze file structure
      context.fileStructure = await this.analyzeFileStructure(rootPath);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new FrameworkDetectionError(
        `Failed to build detection context: ${errorMessage}`,
        rootPath,
        error instanceof Error ? error : undefined,
      );
    }

    return context;
  }

  /**
   * Run a single detector with error handling
   */
  private async runDetector(
    detector: IFrameworkDetector,
    context: DetectionContext,
  ): Promise<FrameworkInfo | null> {
    try {
      return await detector.detect(context);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`${detector.name} detector failed: ${errorMessage}`);
    }
  }

  /**
   * Analyze configuration files in the project
   */
  private async analyzeConfigFiles(
    rootPath: string,
  ): Promise<Map<string, any>> {
    const configFiles = new Map<string, any>();

    const configFilePatterns = [
      "next.config.js",
      "next.config.mjs",
      "next.config.ts",
      "vite.config.js",
      "vite.config.ts",
      "vite.config.mjs",
      "angular.json",
      "vue.config.js",
      "webpack.config.js",
      "babel.config.js",
      ".babelrc",
      "tsconfig.json",
      "tailwind.config.js",
      "tailwind.config.ts",
    ];

    for (const pattern of configFilePatterns) {
      try {
        const filePath = path.join(rootPath, pattern);
        const content = await fs.readFile(filePath, "utf-8");

        // Try to parse as JSON first, then as JS module
        try {
          configFiles.set(pattern, JSON.parse(content));
        } catch {
          // For non-JSON files, store the raw content for pattern analysis
          configFiles.set(pattern, { _rawContent: content });
        }
      } catch {
        // File doesn't exist - continue
      }
    }

    return configFiles;
  }

  /**
   * Analyze source code patterns
   */
  private async analyzeSourcePatterns(rootPath: string): Promise<string[]> {
    const patterns: string[] = [];

    try {
      // Look for common source directories
      const sourceDirs = ["src", "pages", "app", "components", "lib"];

      for (const dir of sourceDirs) {
        const dirPath = path.join(rootPath, dir);
        try {
          await fs.access(dirPath);
          patterns.push(dir);
        } catch {
          // Directory doesn't exist
        }
      }

      // Look for specific file patterns (limited for performance)
      const filePatterns = [".tsx", ".jsx", ".vue", ".svelte"];
      let filesFound = 0;

      for (const pattern of filePatterns) {
        if (filesFound >= this.options.maxCodeFiles) break;

        try {
          const files = await this.findFilesByExtension(rootPath, pattern, 10);
          if (files.length > 0) {
            patterns.push(`*${pattern}`);
            filesFound += files.length;
          }
        } catch {
          // Continue on error
        }
      }
    } catch {
      // Non-critical error - continue with empty patterns
    }

    return patterns;
  }

  /**
   * Analyze file structure
   */
  private async analyzeFileStructure(rootPath: string): Promise<{
    directories: string[];
    files: string[];
  }> {
    const structure = {
      directories: [] as string[],
      files: [] as string[],
    };

    try {
      const items = await fs.readdir(rootPath, { withFileTypes: true });

      for (const item of items) {
        if (
          item.isDirectory() &&
          !item.name.startsWith(".") &&
          item.name !== "node_modules"
        ) {
          structure.directories.push(item.name);
        } else if (item.isFile()) {
          structure.files.push(item.name);
        }
      }
    } catch {
      // Continue with empty structure
    }

    return structure;
  }

  /**
   * Find files by extension (limited search for performance)
   */
  private async findFilesByExtension(
    rootPath: string,
    extension: string,
    limit: number,
  ): Promise<string[]> {
    const files: string[] = [];

    const searchDir = async (
      dirPath: string,
      depth: number = 0,
    ): Promise<void> => {
      if (depth > 3 || files.length >= limit) return; // Limit recursion depth

      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
          if (files.length >= limit) break;

          if (item.isFile() && item.name.endsWith(extension)) {
            files.push(path.relative(rootPath, path.join(dirPath, item.name)));
          } else if (
            item.isDirectory() &&
            !item.name.startsWith(".") &&
            item.name !== "node_modules"
          ) {
            await searchDir(path.join(dirPath, item.name), depth + 1);
          }
        }
      } catch {
        // Continue on error
      }
    };

    await searchDir(rootPath);
    return files;
  }

  /**
   * Register default framework detectors
   */
  private registerDefaultDetectors(): void {
    // Note: Detectors are registered lazily when first needed
    // This avoids circular import issues and improves startup performance
  }

  /**
   * Ensure default detectors are loaded
   */
  private async ensureDetectorsLoaded(): Promise<void> {
    if (this.detectors.size > 0) {
      return; // Already loaded
    }

    try {
      // Import and register framework-specific detectors
      const [reactModule, nextjsModule, viteModule] = await Promise.allSettled([
        import("./detectors/reactDetector.js"),
        import("./detectors/nextjsDetector.js"),
        import("./detectors/viteDetector.js"),
      ]);

      if (reactModule.status === "fulfilled") {
        this.registerDetector(new reactModule.value.ReactDetector());
      }

      if (nextjsModule.status === "fulfilled") {
        this.registerDetector(new nextjsModule.value.NextjsDetector());
      }

      if (viteModule.status === "fulfilled") {
        this.registerDetector(new viteModule.value.ViteDetector());
      }

      // Additional detectors can be added here in the future
      // Vue, Angular, Svelte, etc.
    } catch {
      // Continue without detectors if imports fail
    }
  }
}

/**
 * Framework Detection Error
 */
export class FrameworkDetectionError extends Error {
  public rootPath?: string;
  public cause?: Error;

  constructor(
    message: string,
    rootPath?: string,
    cause?: Error,
  ) {
    super(message);
    this.name = "FrameworkDetectionError";
    this.rootPath = rootPath;
    this.cause = cause;
  }
}

/**
 * Create a framework detector with default options
 */
export function createFrameworkDetector(
  options: Partial<FrameworkDetectorOptions> = {},
): FrameworkDetector {
  return new FrameworkDetector(options);
}

/**
 * Quick framework detection for a directory
 */
export async function detectFramework(
  rootPath: string,
  options: Partial<FrameworkDetectorOptions> = {},
): Promise<DetectionResult> {
  const detector = createFrameworkDetector({ ...options, rootPath });
  return detector.detect();
}
