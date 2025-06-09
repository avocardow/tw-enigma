import { glob, globSync } from "glob";
import { extname } from "path";
import type { EnigmaConfig } from "./config.js";

/**
 * Supported file types for CSS optimization
 */
export const SUPPORTED_FILE_TYPES = {
  HTML: [".html", ".htm"] as string[],
  JAVASCRIPT: [".js", ".jsx", ".ts", ".tsx"] as string[],
  CSS: [".css"] as string[],
  TEMPLATE: [".vue", ".svelte", ".astro"] as string[],
} as const;

/**
 * All supported file extensions
 */
export const ALL_SUPPORTED_EXTENSIONS = Object.values(SUPPORTED_FILE_TYPES).flat();

/**
 * File discovery options
 */
export interface FileDiscoveryOptions {
  /** Glob patterns to search for files */
  patterns: string | string[];
  /** Working directory for pattern resolution */
  cwd?: string;
  /** File types to include (default: HTML and JS) */
  includeTypes?: (keyof typeof SUPPORTED_FILE_TYPES)[];
  /** File extensions to explicitly include */
  includeExtensions?: string[];
  /** File extensions to explicitly exclude */
  excludeExtensions?: string[];
  /** Patterns to exclude from results */
  excludePatterns?: string[];
  /** Follow symbolic links (default: false) */
  followSymlinks?: boolean;
  /** Maximum number of files to return (default: no limit) */
  maxFiles?: number;
  /** Whether to return absolute paths (default: false) */
  absolutePaths?: boolean;
}

/**
 * File discovery result
 */
export interface FileDiscoveryResult {
  /** Found file paths */
  files: string[];
  /** Total number of files found */
  count: number;
  /** Number of files by type */
  breakdown: Record<string, number>;
  /** Patterns that matched files */
  matchedPatterns: string[];
  /** Patterns that didn't match any files */
  emptyPatterns: string[];
  /** Time taken for discovery in milliseconds */
  duration: number;
}

/**
 * Custom error class for file discovery operations
 */
export class FileDiscoveryError extends Error {
  constructor(
    message: string,
    public code: string,
    public patterns?: string | string[],
    public cause?: Error,
  ) {
    super(message);
    this.name = "FileDiscoveryError";
  }
}

/**
 * Validates a glob pattern for common issues
 */
export function validateGlobPattern(pattern: string): void {
  if (!pattern || typeof pattern !== "string") {
    throw new FileDiscoveryError(
      "Pattern must be a non-empty string",
      "INVALID_PATTERN",
      pattern,
    );
  }

  if (pattern.trim() !== pattern) {
    throw new FileDiscoveryError(
      "Pattern cannot have leading or trailing whitespace",
      "INVALID_PATTERN",
      pattern,
    );
  }

  // Check for potentially dangerous patterns
  if (pattern.includes("..") && !pattern.includes("**/")) {
    console.warn(
      `Warning: Pattern "${pattern}" contains ".." which may access parent directories`,
    );
  }
}

/**
 * Validates file discovery options
 */
export function validateOptions(options: FileDiscoveryOptions): void {
  if (!options.patterns) {
    throw new FileDiscoveryError(
      "At least one pattern must be provided",
      "NO_PATTERNS",
    );
  }

  const patterns = Array.isArray(options.patterns)
    ? options.patterns
    : [options.patterns];

  if (patterns.length === 0) {
    throw new FileDiscoveryError(
      "At least one pattern must be provided",
      "NO_PATTERNS",
    );
  }

  // Validate each pattern
  patterns.forEach(validateGlobPattern);

  // Validate numeric options
  if (options.maxFiles !== undefined && options.maxFiles < 1) {
    throw new FileDiscoveryError(
      "maxFiles must be a positive number",
      "INVALID_OPTIONS",
    );
  }

  // Validate working directory
  if (options.cwd !== undefined && (!options.cwd || !options.cwd.trim())) {
    throw new FileDiscoveryError(
      "cwd must be a non-empty string",
      "INVALID_OPTIONS",
    );
  }
}

/**
 * Determines if a file should be included based on extension filtering
 */
export function shouldIncludeFile(
  filePath: string,
  options: FileDiscoveryOptions,
): boolean {
  const ext = extname(filePath).toLowerCase();
  const fileName = filePath.toLowerCase();

  // Check exclude extensions first - support both simple extensions and compound extensions
  if (options.excludeExtensions?.length) {
    for (const excludeExt of options.excludeExtensions) {
      if (excludeExt.startsWith('.') && fileName.endsWith(excludeExt.toLowerCase())) {
        return false;
      }
    }
  }

  // If includeExtensions is specified, only include those
  if (options.includeExtensions?.length) {
    return options.includeExtensions.some(includeExt => {
      if (includeExt.startsWith('.')) {
        return fileName.endsWith(includeExt.toLowerCase());
      }
      return ext === includeExt.toLowerCase();
    });
  }

  // If includeTypes is specified, check against those types
  if (options.includeTypes?.length) {
    return options.includeTypes.some((type) =>
      SUPPORTED_FILE_TYPES[type].includes(ext),
    );
  }

  // Default: include HTML and JavaScript files
  return (
    SUPPORTED_FILE_TYPES.HTML.includes(ext) ||
    SUPPORTED_FILE_TYPES.JAVASCRIPT.includes(ext)
  );
}

/**
 * Gets the file type category for a file path
 */
export function getFileType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();

  for (const [type, extensions] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if (extensions.includes(ext)) {
      return type;
    }
  }

  return "OTHER";
}

/**
 * Removes duplicate file paths and sorts them
 */
export function deduplicateAndSort(files: string[]): string[] {
  return Array.from(new Set(files)).sort();
}

/**
 * Discovers files using glob patterns (synchronous)
 */
export function discoverFilesSync(options: FileDiscoveryOptions): FileDiscoveryResult {
  const startTime = Date.now();

  try {
    validateOptions(options);

    const patterns = Array.isArray(options.patterns)
      ? options.patterns
      : [options.patterns];

    const globOptions = {
      cwd: options.cwd || process.cwd(),
      follow: options.followSymlinks || false,
      absolute: options.absolutePaths || false,
      ignore: options.excludePatterns || [],
    };

    let allFiles: string[] = [];
    const matchedPatterns: string[] = [];
    const emptyPatterns: string[] = [];

    // Process each pattern
    for (const pattern of patterns) {
      try {
        const files = globSync(pattern, globOptions);
        
        if (files.length > 0) {
          matchedPatterns.push(pattern);
          allFiles.push(...files);
        } else {
          emptyPatterns.push(pattern);
        }
      } catch (error) {
        throw new FileDiscoveryError(
          `Failed to process pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
          "PATTERN_ERROR",
          pattern,
          error instanceof Error ? error : undefined,
        );
      }
    }

    // Remove duplicates and sort
    allFiles = deduplicateAndSort(allFiles);

    // Apply file type filtering
    const filteredFiles = allFiles.filter((file) => shouldIncludeFile(file, options));

    // Apply max files limit
    const finalFiles = options.maxFiles
      ? filteredFiles.slice(0, options.maxFiles)
      : filteredFiles;

    // Calculate breakdown by file type
    const breakdown: Record<string, number> = {};
    finalFiles.forEach((file) => {
      const type = getFileType(file);
      breakdown[type] = (breakdown[type] || 0) + 1;
    });

    const duration = Date.now() - startTime;

    return {
      files: finalFiles,
      count: finalFiles.length,
      breakdown,
      matchedPatterns,
      emptyPatterns,
      duration,
    };
  } catch (error) {
    if (error instanceof FileDiscoveryError) {
      throw error;
    }

    throw new FileDiscoveryError(
      `File discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      "DISCOVERY_ERROR",
      options.patterns,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Discovers files using glob patterns (asynchronous)
 */
export async function discoverFiles(options: FileDiscoveryOptions): Promise<FileDiscoveryResult> {
  const startTime = Date.now();

  try {
    validateOptions(options);

    const patterns = Array.isArray(options.patterns)
      ? options.patterns
      : [options.patterns];

    const globOptions = {
      cwd: options.cwd || process.cwd(),
      follow: options.followSymlinks || false,
      absolute: options.absolutePaths || false,
      ignore: options.excludePatterns || [],
    };

    let allFiles: string[] = [];
    const matchedPatterns: string[] = [];
    const emptyPatterns: string[] = [];

    // Process each pattern
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, globOptions);
        
        if (files.length > 0) {
          matchedPatterns.push(pattern);
          allFiles.push(...files);
        } else {
          emptyPatterns.push(pattern);
        }
      } catch (error) {
        throw new FileDiscoveryError(
          `Failed to process pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
          "PATTERN_ERROR",
          pattern,
          error instanceof Error ? error : undefined,
        );
      }
    }

    // Remove duplicates and sort
    allFiles = deduplicateAndSort(allFiles);

    // Apply file type filtering
    const filteredFiles = allFiles.filter((file) => shouldIncludeFile(file, options));

    // Apply max files limit
    const finalFiles = options.maxFiles
      ? filteredFiles.slice(0, options.maxFiles)
      : filteredFiles;

    // Calculate breakdown by file type
    const breakdown: Record<string, number> = {};
    finalFiles.forEach((file) => {
      const type = getFileType(file);
      breakdown[type] = (breakdown[type] || 0) + 1;
    });

    const duration = Date.now() - startTime;

    return {
      files: finalFiles,
      count: finalFiles.length,
      breakdown,
      matchedPatterns,
      emptyPatterns,
      duration,
    };
  } catch (error) {
    if (error instanceof FileDiscoveryError) {
      throw error;
    }

    throw new FileDiscoveryError(
      `File discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      "DISCOVERY_ERROR",
      options.patterns,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Convenience function to discover files from configuration
 */
export function discoverFilesFromConfig(config: EnigmaConfig): FileDiscoveryResult {
  // Handle input patterns - can be string or array, and string might be comma-separated
  let patterns: string[];
  if (!config.input) {
    patterns = ["src/**/*.{html,htm,js,jsx,ts,tsx}"];
  } else if (Array.isArray(config.input)) {
    patterns = config.input;
  } else {
    // Split comma-separated patterns
    patterns = config.input.split(',').map(p => p.trim()).filter(p => p.length > 0);
  }

  const options: FileDiscoveryOptions = {
    patterns,
    cwd: process.cwd(),
    excludePatterns: config.excludePatterns,
    followSymlinks: config.followSymlinks || false,
    maxFiles: config.maxFiles,
    includeTypes: config.includeFileTypes,
    excludeExtensions: config.excludeExtensions,
    absolutePaths: false,
  };

  return discoverFilesSync(options);
}

/**
 * Convenience function to discover files from configuration (async)
 */
export async function discoverFilesFromConfigAsync(config: EnigmaConfig): Promise<FileDiscoveryResult> {
  // Handle input patterns - can be string or array, and string might be comma-separated
  let patterns: string[];
  if (!config.input) {
    patterns = ["src/**/*.{html,htm,js,jsx,ts,tsx}"];
  } else if (Array.isArray(config.input)) {
    patterns = config.input;
  } else {
    // Split comma-separated patterns
    patterns = config.input.split(',').map(p => p.trim()).filter(p => p.length > 0);
  }

  const options: FileDiscoveryOptions = {
    patterns,
    cwd: process.cwd(),
    excludePatterns: config.excludePatterns,
    followSymlinks: config.followSymlinks || false,
    maxFiles: config.maxFiles,
    includeTypes: config.includeFileTypes,
    excludeExtensions: config.excludeExtensions,
    absolutePaths: false,
  };

  return discoverFiles(options);
} 