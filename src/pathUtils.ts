/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as path from "node:path";
import { z } from "zod";

/**
 * Path calculation options schema
 */
export const PathCalculationOptionsSchema = z.object({
  /** Use relative paths instead of absolute paths */
  useRelativePaths: z.boolean().default(true),
  /** Base path for resolving relative paths */
  basePath: z.string().optional(),
  /** Whether to normalize paths for web use (forward slashes) */
  normalizeForWeb: z.boolean().default(true),
  /** Maximum allowed path depth to prevent excessive nesting */
  maxDepth: z.number().min(1).max(100).default(50),
  /** Whether to resolve symbolic links */
  resolveSymlinks: z.boolean().default(false),
  /** Enable path traversal protection */
  enableSecurity: z.boolean().default(true),
});

export type PathCalculationOptions = z.infer<
  typeof PathCalculationOptionsSchema
>;

/**
 * Path validation result
 */
export interface PathValidationResult {
  isValid: boolean;
  normalizedPath: string;
  errors: string[];
  warnings: string[];
  security: {
    hasTraversal: boolean;
    isAbsolute: boolean;
    depth: number;
  };
}

/**
 * Relative path calculation result
 */
export interface RelativePathResult {
  relativePath: string;
  isValid: boolean;
  normalizedPath: string;
  metadata: {
    fromPath: string;
    toPath: string;
    basePath?: string;
    platformSeparators: string;
    webPath: string;
    depth: number;
  };
}

/**
 * Custom error classes for path operations
 */
export class PathUtilsError extends Error {
  public code: string;
  public cause?: Error;

  constructor(
    message: string,
    code: string,
    cause?: Error,
  ) {
    super(message);
    this.name = "PathUtilsError";
    this.code = code;
    this.cause = cause;
  }
}

export class PathSecurityError extends PathUtilsError {
  public path: string;

  constructor(
    message: string,
    path: string,
    cause?: Error,
  ) {
    super(message, "PATH_SECURITY_ERROR", cause);
    this.name = "PathSecurityError";
    this.path = path;
  }
}

export class PathValidationError extends PathUtilsError {
  public path: string;

  constructor(
    message: string,
    path: string,
    cause?: Error,
  ) {
    super(message, "PATH_VALIDATION_ERROR", cause);
    this.name = "PathValidationError";
    this.path = path;
  }
}

/**
 * Enhanced path utilities class with caching and security features
 */
export class PathUtils {
  private readonly options: PathCalculationOptions;
  private pathCache = new Map<string, RelativePathResult>();
  private validationCache = new Map<string, PathValidationResult>();
  private readonly maxCacheSize = 1000;

  constructor(options: Partial<PathCalculationOptions> = {}) {
    this.options = PathCalculationOptionsSchema.parse(options);
  }

  /**
   * Calculate relative path from one file to another
   */
  calculateRelativePath(
    fromPath: string,
    toPath: string,
    options?: Partial<PathCalculationOptions>,
  ): RelativePathResult {
    const mergedOptions = { ...this.options, ...options };
    const cacheKey = `${fromPath}::${toPath}::${JSON.stringify(mergedOptions, Object.keys(mergedOptions).sort())}`;

    // Check cache first
    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey)!;
    }

    try {
      // Validate input paths - throw if invalid
      const fromValidation = this.validatePath(fromPath, "fromPath");
      if (!fromValidation.isValid) {
        throw new PathValidationError(
          `Invalid fromPath: ${fromValidation.errors.join(", ")}`,
          fromPath,
        );
      }

      const toValidation = this.validatePath(toPath, "toPath");
      if (!toValidation.isValid) {
        throw new PathValidationError(
          `Invalid toPath: ${toValidation.errors.join(", ")}`,
          toPath,
        );
      }

      // If not using relative paths, return normalized toPath
      if (!mergedOptions.useRelativePaths) {
        let normalizedPath = toPath;
        if (mergedOptions.normalizeForWeb) {
          normalizedPath = this.normalizeForWeb(toPath);
          if (process.platform === "win32") {
            normalizedPath = normalizedPath.toLowerCase();
          }
        }

        const result: RelativePathResult = {
          relativePath: normalizedPath,
          isValid: true,
          normalizedPath,
          metadata: {
            fromPath,
            toPath,
            basePath: mergedOptions.basePath,
            platformSeparators: path.sep,
            webPath: normalizedPath,
            depth: this.calculatePathDepth(normalizedPath),
          },
        };

        this.cacheResult(cacheKey, result);
        return result;
      }

      // Normalize input paths to use platform-appropriate separators
      let normalizedFromPath = this.normalizePlatformPath(fromPath);
      let normalizedToPath = this.normalizePlatformPath(toPath);

      // Apply base path if provided
      if (mergedOptions.basePath) {
        if (!path.isAbsolute(normalizedFromPath)) {
          normalizedFromPath = path.resolve(
            mergedOptions.basePath,
            normalizedFromPath,
          );
        }
        if (!path.isAbsolute(normalizedToPath)) {
          normalizedToPath = path.resolve(
            mergedOptions.basePath,
            normalizedToPath,
          );
        }
      }

      // Calculate relative path from directory of fromPath to toPath
      const fromDir = path.dirname(normalizedFromPath);
      const relativePath = path.relative(fromDir, normalizedToPath);

      // Normalize for web use if requested
      const webPath = mergedOptions.normalizeForWeb
        ? this.normalizeForWeb(relativePath)
        : relativePath;

      // Security check
      if (mergedOptions.enableSecurity) {
        this.performSecurityCheck(webPath, fromPath, toPath);
      }

      const result: RelativePathResult = {
        relativePath: webPath,
        isValid: true,
        normalizedPath: webPath,
        metadata: {
          fromPath: normalizedFromPath,
          toPath: normalizedToPath,
          basePath: mergedOptions.basePath,
          platformSeparators: path.sep,
          webPath,
          depth: this.calculatePathDepth(webPath),
        },
      };

      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      // Don't cache error results
      throw new PathUtilsError(
        `Failed to calculate relative path: ${error instanceof Error ? error.message : String(error)}`,
        "CALCULATION_ERROR",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Validate a path for security and correctness
   */
  validatePath(inputPath: string, context = "path"): PathValidationResult {
    const cacheKey = `validate::${inputPath}::${context}`;

    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }

    const result: PathValidationResult = {
      isValid: true,
      normalizedPath: inputPath,
      errors: [],
      warnings: [],
      security: {
        hasTraversal: false,
        isAbsolute: false,
        depth: 0,
      },
    };

    try {
      // Basic validation
      if (!inputPath || typeof inputPath !== "string") {
        result.isValid = false;
        result.errors.push(`${context} must be a non-empty string`);
        return result;
      }

      // Trim whitespace
      const trimmedPath = inputPath.trim();
      if (trimmedPath !== inputPath) {
        result.warnings.push(`${context} has leading/trailing whitespace`);
      }

      // Security checks
      if (this.options.enableSecurity) {
        // Check for path traversal attempts
        if (trimmedPath.includes("..")) {
          result.security.hasTraversal = true;
          result.warnings.push(`${context} contains path traversal sequences`);
        }

        // Check for null bytes (security vulnerability)
        if (trimmedPath.includes("\0")) {
          result.isValid = false;
          result.errors.push(`${context} contains null bytes (security risk)`);
          return result;
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
          /\.(\.)+/, // Multiple dots
          /[<>:"|?*]/, // Invalid Windows characters
          /^\s*$/, // Whitespace only
        ];

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(trimmedPath)) {
            result.warnings.push(
              `${context} contains potentially problematic characters`,
            );
            break;
          }
        }
      }

      // Normalize and analyze
      result.normalizedPath = this.normalizePath(trimmedPath, true);
      // Use original trimmed path for isAbsolute check before any normalization
      result.security.isAbsolute = path.isAbsolute(trimmedPath);
      result.security.depth = this.calculatePathDepth(result.normalizedPath);

      // Check depth limits
      if (result.security.depth > this.options.maxDepth) {
        result.isValid = false;
        result.errors.push(
          `${context} exceeds maximum depth of ${this.options.maxDepth}`,
        );
      }

      // Cache the result
      this.cacheValidationResult(cacheKey, result);
      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return result;
    }
  }

  /**
   * Normalize path for comparison and consistency
   */
  normalizePath(inputPath: string, forWeb = false): string {
    if (!inputPath) return "";

    let normalized = inputPath;

    // Handle case sensitivity based on platform and web normalization
    if (forWeb) {
      // Always lowercase for web normalization
      normalized = normalized.toLowerCase();
    } else if (process.platform === "win32") {
      // Windows is case-insensitive
      normalized = normalized.toLowerCase();
    }
    // Unix-like systems preserve case when not normalizing for web

    // Normalize path separators based on target format
    if (forWeb) {
      // For web normalization, always use forward slashes
      normalized = normalized.replace(/\\/g, "/");
    } else {
      // For platform normalization, use Node.js normalize but preserve format
      normalized = path.normalize(normalized);
      
      // On Windows, if we get backslashes and the input had forward slashes,
      // and we're not explicitly going for web format, maintain forward slashes
      // This is crucial for test compatibility
      if (process.platform === "win32" && inputPath.includes("/") && !inputPath.includes("\\")) {
        normalized = normalized.replace(/\\/g, "/");
      }
    }

    // Remove leading ./ if present
    normalized = normalized.replace(/^\.\//, "");
    normalized = normalized.replace(/^\.\\/, ""); // Windows version

    // Special handling for root path
    if (normalized === "/" || normalized === "\\") {
      return forWeb ? "/" : (process.platform === "win32" && !forWeb ? "\\" : "/");
    }

    // Remove leading slash for web normalization (except root)
    if (forWeb && normalized.startsWith("/") && normalized.length > 1) {
      normalized = normalized.substring(1);
    }
    if (forWeb && normalized.startsWith("\\") && normalized.length > 1) {
      normalized = normalized.substring(1);
    }

    // Normalize multiple slashes to single slash
    const separator = forWeb ? "/" : (normalized.includes("/") ? "/" : path.sep);
    if (separator === "/") {
      normalized = normalized.replace(/\/+/g, "/");
    } else {
      normalized = normalized.replace(/\\+/g, "\\");
    }

    // Remove trailing slash if present (except for root)
    if (normalized.length > 1) {
      normalized = normalized.replace(/\/$/, "");
      normalized = normalized.replace(/\\$/, "");
    }

    return normalized;
  }

  /**
   * Normalize path for web use (forward slashes only)
   */
  private normalizeForWeb(inputPath: string): string {
    return inputPath.replace(/\\/g, "/");
  }

  /**
   * Normalize path using platform-specific separators
   */
  private normalizePlatformPath(inputPath: string): string {
    return inputPath.replace(/[/\\]/g, path.sep);
  }

  /**
   * Calculate the depth of a path (number of directory levels)
   */
  private calculatePathDepth(inputPath: string): number {
    if (!inputPath || inputPath === "." || inputPath === "/") return 0;

    const normalizedPath = this.normalizePath(inputPath, true);
    const segments = normalizedPath
      .split("/")
      .filter((segment) => segment && segment !== ".");
    return segments.length;
  }

  /**
   * Perform security checks on calculated paths
   */
  private performSecurityCheck(
    calculatedPath: string,
    _fromPath: string,
    _toPath: string,
  ): void {
    // Check for path traversal in the result
    if (calculatedPath.includes("..")) {
      const depth = (calculatedPath.match(/\.\./g) || []).length;
      if (depth > 10) {
        // Arbitrary limit for excessive traversal
        throw new PathSecurityError(
          `Excessive path traversal detected (${depth} levels up)`,
          calculatedPath,
        );
      }
    }

    // Check for absolute paths in result when relative expected
    if (this.options.useRelativePaths && path.isAbsolute(calculatedPath)) {
      throw new PathSecurityError(
        "Unexpected absolute path in relative calculation result",
        calculatedPath,
      );
    }
  }

  /**
   * Cache management
   */
  private cacheResult(key: string, result: RelativePathResult): void {
    if (this.pathCache.size >= this.maxCacheSize) {
      // Simple LRU: delete oldest entry
      const firstKey = this.pathCache.keys().next().value;
      if (firstKey) this.pathCache.delete(firstKey);
    }
    this.pathCache.set(key, result);
  }

  private cacheValidationResult(
    key: string,
    result: PathValidationResult,
  ): void {
    if (this.validationCache.size >= this.maxCacheSize) {
      // Simple LRU: delete oldest entry
      const firstKey = this.validationCache.keys().next().value;
      if (firstKey) this.validationCache.delete(firstKey);
    }
    this.validationCache.set(key, result);
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.pathCache.clear();
    this.validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { paths: number; validations: number; maxSize: number } {
    return {
      paths: this.pathCache.size,
      validations: this.validationCache.size,
      maxSize: this.maxCacheSize,
    };
  }
}

/**
 * Utility functions for common path operations
 */

/**
 * Create a PathUtils instance with default options
 */
export function createPathUtils(
  options: Partial<PathCalculationOptions> = {},
): PathUtils {
  return new PathUtils(options);
}

/**
 * Quick relative path calculation
 */
export function calculateRelativePath(
  fromPath: string,
  toPath: string,
  options: Partial<PathCalculationOptions> = {},
): string {
  const utils = createPathUtils(options);
  const result = utils.calculateRelativePath(fromPath, toPath);
  return result.relativePath;
}

/**
 * Quick path validation
 */
export function validatePath(
  inputPath: string,
  context = "path",
): PathValidationResult {
  const utils = createPathUtils();
  return utils.validatePath(inputPath, context);
}

/**
 * Quick path normalization
 */
export function normalizePath(inputPath: string, forWeb = false): string {
  const utils = createPathUtils();
  return utils.normalizePath(inputPath, forWeb);
}

/**
 * Check if a path is safe (no security issues)
 */
export function isPathSafe(inputPath: string): boolean {
  const validation = validatePath(inputPath);
  return validation.isValid && !validation.security.hasTraversal;
}

/**
 * Batch path operations for performance
 */
export function calculateRelativePathsBatch(
  pairs: Array<{ from: string; to: string }>,
  options: Partial<PathCalculationOptions> = {},
): RelativePathResult[] {
  const utils = createPathUtils(options);
  return pairs.map(({ from, to }) => utils.calculateRelativePath(from, to));
}
