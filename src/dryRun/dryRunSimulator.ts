/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  IMockFileSystem,
  createMockFileSystem,
  FileOperation,
} from "./mockFileSystem";
import { DryRunStatistics, createDryRunStatistics } from "./dryRunStatistics";
import { DryRunReport, createDryRunReport } from "./dryRunReport";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

/**
 * Dry run simulation options
 */
export interface DryRunOptions {
  /** Include file content in change previews */
  includeContent?: boolean;
  /** Maximum content preview length */
  maxContentPreview?: number;
  /** Verbose output for detailed logging */
  verbose?: boolean;
  /** Pre-load existing files from disk */
  preloadFiles?: string[];
  /** Skip certain operations during simulation */
  skipOperations?: string[];
  /** Enable performance metrics collection */
  enableMetrics?: boolean;
  /** Output format for reports */
  outputFormat?: "json" | "markdown" | "text";
}

/**
 * Simulation result containing all dry run information
 */
export interface DryRunResult {
  /** Whether the simulation completed successfully */
  success: boolean;
  /** Any errors encountered during simulation */
  errors: string[];
  /** File operations that would be performed */
  operations: FileOperation[];
  /** Statistical summary of changes */
  statistics: DryRunStatistics;
  /** Generated report */
  report: DryRunReport;
  /** Execution time for the simulation */
  executionTime: number;
  /** Final state of the mock file system */
  finalFileState: Map<string, any>;
}

/**
 * File system operation interceptor interface
 */
export interface IFileSystemInterceptor {
  /** Intercept and simulate a file system operation */
  intercept<T>(
    operation: string,
    args: any[],
    originalFn: (...args: any[]) => T,
  ): T;
  /** Check if an operation should be intercepted */
  shouldIntercept(operation: string): boolean;
  /** Get the mock file system instance */
  getMockFileSystem(): IMockFileSystem;
}

// =============================================================================
// DRY RUN SIMULATOR IMPLEMENTATION
// =============================================================================

/**
 * Main dry run simulation engine
 */
export class DryRunSimulator {
  private mockFs: IMockFileSystem;
  private options: DryRunOptions;
  private startTime: number = 0;
  private isActive: boolean = false;
  private interceptor?: IFileSystemInterceptor;

  constructor(options: DryRunOptions = {}) {
    this.options = {
      includeContent: true,
      maxContentPreview: 500,
      verbose: false,
      preloadFiles: [],
      skipOperations: [],
      enableMetrics: true,
      outputFormat: "markdown",
      ...options,
    };
    this.mockFs = createMockFileSystem();
  }

  // ---------------------------------------------------------------------------
  // MAIN SIMULATION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Start dry run simulation
   */
  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error("Dry run simulation is already active");
    }

    this.isActive = true;
    this.startTime = Date.now();

    // Pre-load files if specified
    if (this.options.preloadFiles && this.options.preloadFiles.length > 0) {
      await this.preloadFiles(this.options.preloadFiles);
    }

    // Install file system interceptor
    this.interceptor = this.createFileSystemInterceptor();
    this.installFileSystemHooks();

    if (this.options.verbose) {
      console.log("🏃 Dry run simulation started");
    }
  }

  /**
   * Stop dry run simulation and generate results
   */
  async stop(): Promise<DryRunResult> {
    if (!this.isActive) {
      throw new Error("Dry run simulation is not active");
    }

    // Uninstall file system hooks
    this.uninstallFileSystemHooks();

    const executionTime = Date.now() - this.startTime;
    const operations = this.mockFs.getOperations();
    const statistics = createDryRunStatistics(operations);
    const report = createDryRunReport(
      operations,
      statistics,
      this.options,
      executionTime,
    );

    this.isActive = false;

    const result: DryRunResult = {
      success: true,
      errors: [],
      operations,
      statistics,
      report,
      executionTime,
      finalFileState: this.mockFs.getAllFiles(),
    };

    if (this.options.verbose) {
      console.log("🏁 Dry run simulation completed");
      console.log(
        `📊 ${operations.length} operations simulated in ${executionTime}ms`,
      );
    }

    return result;
  }

  /**
   * Execute a function within dry run context
   */
  async executeInDryRun<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; dryRunResult: DryRunResult }> {
    await this.start();

    try {
      const result = await fn();
      const dryRunResult = await this.stop();

      return { result, dryRunResult };
    } catch (_) {
      // Ensure simulation is stopped even if error occurs
      if (this.isActive) {
        const dryRunResult = await this.stop();
        dryRunResult.success = false;
        dryRunResult.errors.push(
          error instanceof Error ? error.message : String(error),
        );

        return {
          result: undefined as T,
          dryRunResult,
        };
      }
      throw error;
    }
  }

  /**
   * Get current mock file system instance
   */
  getMockFileSystem(): IMockFileSystem {
    return this.mockFs;
  }

  /**
   * Check if simulation is currently active
   */
  isSimulationActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current simulation options
   */
  getOptions(): DryRunOptions {
    return { ...this.options };
  }

  // ---------------------------------------------------------------------------
  // FILE SYSTEM INTERCEPTION
  // ---------------------------------------------------------------------------

  private createFileSystemInterceptor(): IFileSystemInterceptor {
    const mockFs = this.mockFs;
    const skipOps = this.options.skipOperations || [];

    // Helper function for creating mock results
    const createMockResultForOperation = (operation: string, _args: any[]): any => {
      // Return appropriate mock results for skipped operations
      switch (operation) {
        case "readFile":
        case "readFileSync":
          return "";
        case "writeFile":
        case "writeFileSync":
          return undefined;
        case "mkdir":
        case "mkdirSync":
          return undefined;
        case "exists":
        case "existsSync":
          return false;
        case "stat":
        case "statSync":
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: 0,
            mtime: new Date(),
            birthtime: new Date(),
          };
        default:
          return undefined;
      }
    };

    return {
      intercept<T>(
        operation: string,
        args: any[],
        originalFn: (...args: any[]) => T,
      ): T {
        if (skipOps.includes(operation)) {
          // Skip this operation, return a mock result
          return createMockResultForOperation(operation, args) as T;
        }

        // Route to mock file system
        switch (operation) {
          case "readFile":
            return (mockFs as any).readFile(args[0], args[1]) as T;
          case "readFileSync":
            return (mockFs as any).readFileSync(args[0], args[1]) as T;

          case "writeFile":
            return (mockFs as any).writeFile(args[0], args[1], args[2]) as T;
          case "writeFileSync":
            return (mockFs as any).writeFileSync(args[0], args[1], args[2]) as T;

          case "mkdir":
            return (mockFs as any).mkdir(args[0], args[1]) as T;
          case "mkdirSync":
            return (mockFs as any).mkdirSync(args[0], args[1]) as T;

          case "exists":
            return (mockFs as any).exists(args[0]) as T;
          case "existsSync":
            return (mockFs as any).existsSync(args[0]) as T;

          case "stat":
            return (mockFs as any).stat(args[0]) as T;
          case "statSync":
            return (mockFs as any).statSync(args[0]) as T;

          default:
            // For unknown operations, call original function
            // This allows non-file operations to work normally
            return originalFn(...args);
        }
      },

      shouldIntercept(operation: string): boolean {
        const fileOps = [
          "readFile",
          "readFileSync",
          "writeFile",
          "writeFileSync",
          "mkdir",
          "mkdirSync",
          "exists",
          "existsSync",
          "stat",
          "statSync",
        ];
        return fileOps.includes(operation);
      },

      getMockFileSystem(): IMockFileSystem {
        return mockFs;
      },
    };
  }

  private installFileSystemHooks(): void {
    const fs = require("fs"); // eslint-disable-line @typescript-eslint/no-require-imports
    const originalMethods = new Map();

    // List of methods to intercept
    const methodsToIntercept = [
      "readFile",
      "readFileSync",
      "writeFile",
      "writeFileSync",
      "mkdir",
      "mkdirSync",
      "exists",
      "existsSync",
      "stat",
      "statSync",
    ];

    for (const method of methodsToIntercept) {
      if (fs[method]) {
        // Store original method
        originalMethods.set(method, fs[method]);

        // Replace with intercepted version
        fs[method] = (...args: any[]) => {
          if (this.interceptor?.shouldIntercept(method)) {
            return this.interceptor.intercept(
              method,
              args,
              originalMethods.get(method),
            );
          }
          return originalMethods.get(method)(...args);
        };
      }
    }

    // Store reference for cleanup
    (this as any)._originalMethods = originalMethods;
  }

  private uninstallFileSystemHooks(): void {
    const fs = require("fs"); // eslint-disable-line @typescript-eslint/no-require-imports
    const originalMethods = (this as any)._originalMethods;

    if (originalMethods) {
      // Restore original methods
      for (const [method, originalFn] of originalMethods) {
        fs[method] = originalFn;
      }

      delete (this as any)._originalMethods;
    }
  }

  private createMockResult(operation: string, _args: any[]): any {
    // Return appropriate mock results for skipped operations
    switch (operation) {
      case "readFile":
      case "readFileSync":
        return "";
      case "writeFile":
      case "writeFileSync":
        return undefined;
      case "mkdir":
      case "mkdirSync":
        return undefined;
      case "exists":
      case "existsSync":
        return false;
      case "stat":
      case "statSync":
        return {
          isFile: () => true,
          isDirectory: () => false,
          size: 0,
          mtime: new Date(),
          birthtime: new Date(),
        };
      default:
        return undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------

  private async preloadFiles(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        await this.mockFs.loadFromDisk(path);

        if (this.options.verbose) {
          console.log(`📂 Pre-loaded: ${path}`);
        }
      } catch (_) {
        if (this.options.verbose) {
          console.warn(`⚠️  Could not pre-load: ${path}`);
        }
      }
    }
  }

  /**
   * Get preview of what would change
   */
  getChangePreview(): string {
    const operations = this.mockFs.getOperations();
    const statistics = createDryRunStatistics(operations);

    let preview = "📋 Dry Run Change Preview\n\n";

    preview += `📊 Summary:\n`;
    preview += `- Files to create: ${statistics.filesCreated}\n`;
    preview += `- Files to modify: ${statistics.filesModified}\n`;
    preview += `- Files to delete: ${statistics.filesDeleted}\n`;
    preview += `- Directories to create: ${statistics.directoriesCreated}\n`;
    preview += `- Total operations: ${statistics.totalOperations}\n\n`;

    if (operations.length > 0) {
      preview += `🔄 Operations:\n`;

      for (const op of operations.slice(0, 10)) {
        // Show first 10 operations
        preview += `- ${op.type.toUpperCase()}: ${op.path}\n`;

        if (
          this.options.includeContent &&
          op.newContent &&
          typeof op.newContent === "string"
        ) {
          const content = op.newContent.substring(
            0,
            this.options.maxContentPreview || 100,
          );
          preview += `  Content: ${content}${op.newContent.length > (this.options.maxContentPreview || 100) ? "..." : ""}\n`;
        }
      }

      if (operations.length > 10) {
        preview += `... and ${operations.length - 10} more operations\n`;
      }
    }

    return preview;
  }

  /**
   * Reset the simulation state
   */
  reset(): void {
    if (this.isActive) {
      throw new Error("Cannot reset while simulation is active");
    }

    this.mockFs.reset();
    this.startTime = 0;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a new dry run simulator instance
 */
export function createDryRunSimulator(
  options?: DryRunOptions,
): DryRunSimulator {
  return new DryRunSimulator(options);
}

/**
 * Execute a function in dry run mode and return results
 */
export async function simulateDryRun<T>(
  fn: () => Promise<T>,
  options?: DryRunOptions,
): Promise<{ result: T; dryRunResult: DryRunResult }> {
  const simulator = createDryRunSimulator(options);
  return simulator.executeInDryRun(fn);
}

// =============================================================================
// GLOBAL DRY RUN UTILITIES
// =============================================================================

let globalSimulator: DryRunSimulator | null = null;

/**
 * Enable global dry run mode
 */
export async function enableGlobalDryRun(
  options?: DryRunOptions,
): Promise<void> {
  if (globalSimulator) {
    throw new Error("Global dry run is already enabled");
  }

  globalSimulator = createDryRunSimulator(options);
  await globalSimulator.start();
}

/**
 * Disable global dry run mode and get results
 */
export async function disableGlobalDryRun(): Promise<DryRunResult | null> {
  if (!globalSimulator) {
    return null;
  }

  const result = await globalSimulator.stop();
  globalSimulator = null;
  return result;
}

/**
 * Check if global dry run is active
 */
export function isGlobalDryRunActive(): boolean {
  return globalSimulator?.isSimulationActive() || false;
}

/**
 * Get the global dry run simulator instance
 */
export function getGlobalDryRunSimulator(): DryRunSimulator | null {
  return globalSimulator;
}
