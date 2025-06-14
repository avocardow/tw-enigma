import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PathUtils,
  createPathUtils,
  calculateRelativePath,
  validatePath,
  normalizePath,
  isPathSafe,
  calculateRelativePathsBatch,
  PathUtilsError,
  PathSecurityError,
  PathValidationError,
  PathCalculationOptionsSchema,
  type PathCalculationOptions,
} from "../src/pathUtils";

describe("PathUtils", () => {
  let pathUtils: PathUtils;

  beforeEach(() => {
    pathUtils = new PathUtils();
  });

  afterEach(() => {
    pathUtils.clearCache();
  });

  describe("Configuration and Initialization", () => {
    it("initializes with default options", () => {
      const utils = new PathUtils();
      expect(utils).toBeInstanceOf(PathUtils);
    });

    it("validates configuration options with Zod schema", () => {
      const validOptions: PathCalculationOptions = {
        useRelativePaths: true,
        normalizeForWeb: true,
        maxDepth: 10,
        resolveSymlinks: false,
        enableSecurity: true,
      };

      const result = PathCalculationOptionsSchema.parse(validOptions);
      expect(result).toEqual(validOptions);
    });

    it("applies default values for missing options", () => {
      const partialOptions = { maxDepth: 25 };
      const utils = new PathUtils(partialOptions);
      expect(utils).toBeInstanceOf(PathUtils);
    });

    it("rejects invalid configuration options", () => {
      expect(() => {
        new PathUtils({ maxDepth: -1 });
      }).toThrow();

      expect(() => {
        new PathUtils({ maxDepth: 101 });
      }).toThrow();
    });
  });

  describe("Relative Path Calculation", () => {
    describe("Basic Functionality", () => {
      it("calculates simple relative paths", () => {
        const result = pathUtils.calculateRelativePath(
          "/project/src/index.html",
          "/project/dist/styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("../dist/styles.css");
        expect(result.metadata.depth).toBeGreaterThan(0);
      });

      it("handles same directory files", () => {
        const result = pathUtils.calculateRelativePath(
          "/project/src/index.html",
          "/project/src/styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("styles.css");
      });

      it("handles subdirectory navigation", () => {
        const result = pathUtils.calculateRelativePath(
          "/project/index.html",
          "/project/assets/css/styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("assets/css/styles.css");
      });

      it("handles parent directory navigation", () => {
        const result = pathUtils.calculateRelativePath(
          "/project/src/pages/about.html",
          "/project/assets/styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("../../assets/styles.css");
      });
    });

    describe("Cross-Platform Compatibility", () => {
      it("handles Windows-style paths", () => {
        const result = pathUtils.calculateRelativePath(
          "C:\\project\\src\\index.html",
          "C:\\project\\dist\\styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("../dist/styles.css");
        expect(result.metadata.webPath).toBe("../dist/styles.css");
      });

      it("handles mixed path separators", () => {
        const result = pathUtils.calculateRelativePath(
          "/project/src\\index.html",
          "\\project\\dist/styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("../dist/styles.css");
      });

      it("normalizes path separators for web use", () => {
        const utils = new PathUtils({ normalizeForWeb: true });
        const result = utils.calculateRelativePath(
          "C:\\project\\src\\index.html",
          "C:\\project\\assets\\styles.css",
        );

        expect(result.relativePath).not.toContain("\\");
        expect(result.relativePath).toBe("../assets/styles.css");
      });
    });

    describe("Base Path Handling", () => {
      it("applies base path to relative paths", () => {
        const utils = new PathUtils({ basePath: "/project" });
        const result = utils.calculateRelativePath(
          "src/index.html",
          "dist/styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("../dist/styles.css");
      });

      it("handles absolute paths with base path", () => {
        const utils = new PathUtils({ basePath: "/base" });
        const result = utils.calculateRelativePath(
          "/project/src/index.html",
          "/project/dist/styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("../dist/styles.css");
      });
    });

    describe("Absolute Path Mode", () => {
      it("returns absolute paths when configured", () => {
        const utils = new PathUtils({ useRelativePaths: false });
        const result = utils.calculateRelativePath(
          "/project/src/index.html",
          "/project/dist/styles.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("/project/dist/styles.css");
      });

      it("normalizes absolute paths for web use", () => {
        const utils = new PathUtils({
          useRelativePaths: false,
          normalizeForWeb: true,
        });
        const result = utils.calculateRelativePath(
          "C:\\project\\src\\index.html",
          "C:\\project\\dist\\styles.css",
        );

        // Should normalize path separators and handle case based on platform
        if (process.platform === "win32") {
          expect(result.relativePath).toBe("c:/project/dist/styles.css");
        } else {
          // On non-Windows, case should be preserved but separators normalized
          expect(result.relativePath).toBe("C:/project/dist/styles.css");
        }
      });
    });

    describe("Error Handling", () => {
      it("throws error for invalid from path", () => {
        expect(() => {
          pathUtils.calculateRelativePath("", "/valid/path.css");
        }).toThrow(PathUtilsError);
      });

      it("throws error for invalid to path", () => {
        expect(() => {
          pathUtils.calculateRelativePath("/valid/path.html", "");
        }).toThrow(PathUtilsError);
      });

      it("provides detailed error information", () => {
        try {
          pathUtils.calculateRelativePath("", "/valid/path.css");
        } catch (error) {
          expect(error).toBeInstanceOf(PathUtilsError);
          expect((error as PathUtilsError).code).toBe("CALCULATION_ERROR");
        }
      });
    });
  });

  describe("Path Validation", () => {
    describe("Basic Validation", () => {
      it("validates correct paths", () => {
        const result = pathUtils.validatePath("/valid/path/file.css");

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.normalizedPath).toBe("valid/path/file.css");
      });

      it("detects empty paths", () => {
        const result = pathUtils.validatePath("");

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("path must be a non-empty string");
      });

      it("detects non-string inputs", () => {
        const result = pathUtils.validatePath(null as any);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("path must be a non-empty string");
      });

      it("warns about whitespace in paths", () => {
        const result = pathUtils.validatePath("  /path/with/spaces  ");

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain(
          "path has leading/trailing whitespace",
        );
      });
    });

    describe("Security Validation", () => {
      it("detects path traversal attempts", () => {
        const result = pathUtils.validatePath("../../../etc/passwd");

        expect(result.security.hasTraversal).toBe(true);
        expect(result.warnings).toContain(
          "path contains path traversal sequences",
        );
      });

      it("detects null byte injection", () => {
        const result = pathUtils.validatePath("/path/file\0.css");

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "path contains null bytes (security risk)",
        );
      });

      it("detects suspicious characters", () => {
        const result = pathUtils.validatePath("/path/file<>.css");

        expect(
          result.warnings.some((w) => w.includes("problematic characters")),
        ).toBe(true);
      });

      it("can disable security checks", () => {
        const utils = new PathUtils({ enableSecurity: false });
        const result = utils.validatePath("../../../etc/passwd");

        expect(result.warnings).not.toContain(
          "path contains path traversal sequences",
        );
      });
    });

    describe("Depth Validation", () => {
      it("validates path depth within limits", () => {
        const result = pathUtils.validatePath("/a/b/c/d/e");

        expect(result.isValid).toBe(true);
        expect(result.security.depth).toBe(5);
      });

      it("rejects paths exceeding depth limit", () => {
        const utils = new PathUtils({ maxDepth: 3 });
        const result = utils.validatePath("/a/b/c/d/e");

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("path exceeds maximum depth of 3");
      });

      it("calculates depth correctly for different path formats", () => {
        const tests = [
          { path: "/", expectedDepth: 0 },
          { path: ".", expectedDepth: 0 },
          { path: "./file.css", expectedDepth: 1 },
          { path: "/a/b/c", expectedDepth: 3 },
          { path: "relative/path", expectedDepth: 2 },
        ];

        for (const test of tests) {
          const result = pathUtils.validatePath(test.path);
          expect(result.security.depth).toBe(test.expectedDepth);
        }
      });
    });

    describe("Path Analysis", () => {
      it("detects absolute paths correctly", () => {
        const absoluteResult = pathUtils.validatePath("/absolute/path");
        const relativeResult = pathUtils.validatePath("relative/path");

        expect(absoluteResult.security.isAbsolute).toBe(true);
        expect(relativeResult.security.isAbsolute).toBe(false);
      });

      it("handles Windows absolute paths", () => {
        // This test may behave differently on non-Windows platforms
        // Node.js path.isAbsolute() is platform-specific
        const result = pathUtils.validatePath("C:\\Windows\\System32");

        // On Windows, this should be true. On other platforms, it may be false.
        // We'll check that the path is handled correctly regardless.
        expect(result.isValid).toBe(true);
        if (process.platform === "win32") {
          expect(result.security.isAbsolute).toBe(true);
        }
        // The path should be normalized properly regardless of platform
        expect(result.normalizedPath.includes("windows")).toBe(true);
      });
    });
  });

  describe("Path Normalization", () => {
    describe("Basic Normalization", () => {
      it("normalizes path separators", () => {
        const normalized = pathUtils.normalizePath(
          "path\\with\\backslashes",
          true,
        );
        expect(normalized).toBe("path/with/backslashes");
      });

      it("removes redundant separators", () => {
        const normalized = pathUtils.normalizePath(
          "path//with///multiple////slashes",
        );
        expect(normalized).toBe("path/with/multiple/slashes");
      });

      it("removes leading ./ patterns", () => {
        const normalized = pathUtils.normalizePath("./relative/path");
        expect(normalized).toBe("relative/path");
      });

      it("removes trailing slashes", () => {
        const normalized = pathUtils.normalizePath("path/with/trailing/slash/");
        expect(normalized).toBe("path/with/trailing/slash");
      });

      it("preserves root slash", () => {
        const normalized = pathUtils.normalizePath("/");
        expect(normalized).toBe("/");
      });
    });

    describe("Platform-Specific Normalization", () => {
      it("handles case sensitivity based on platform", () => {
        const input = "Path/With/Mixed/Case";
        const normalized = pathUtils.normalizePath(input);

        if (process.platform === "win32") {
          expect(normalized.toLowerCase()).toBe(normalized);
        } else {
          // On Unix-like systems, case is preserved when not normalizing for web
          expect(normalized).toBe("Path/With/Mixed/Case");
        }
      });

      it("can force web normalization", () => {
        const normalized = pathUtils.normalizePath(
          "Path\\With\\Backslashes",
          true,
        );
        expect(normalized).toBe("path/with/backslashes");
      });
    });

    describe("Edge Cases", () => {
      it("handles empty strings", () => {
        const normalized = pathUtils.normalizePath("");
        expect(normalized).toBe("");
      });

      it("handles single characters", () => {
        const normalized = pathUtils.normalizePath(".");
        expect(normalized).toBe(".");
      });

      it("handles complex path combinations", () => {
        const normalized = pathUtils.normalizePath("./path/../to/./file");
        expect(normalized).toBe("to/file");
      });
    });
  });

  describe("Utility Functions", () => {
    describe("Factory Functions", () => {
      it("creates PathUtils instances with createPathUtils", () => {
        const utils = createPathUtils({ maxDepth: 10 });
        expect(utils).toBeInstanceOf(PathUtils);
      });

      it("provides quick calculateRelativePath function", () => {
        const result = calculateRelativePath("/from/path.html", "/to/path.css");
        expect(typeof result).toBe("string");
        expect(result).toBe("../to/path.css");
      });

      it("provides quick validatePath function", () => {
        const result = validatePath("/test/path.css");
        expect(result).toHaveProperty("isValid");
        expect(result).toHaveProperty("normalizedPath");
        expect(result).toHaveProperty("security");
      });

      it("provides quick normalizePath function", () => {
        const result = normalizePath("path\\with\\backslashes", true);
        expect(result).toBe("path/with/backslashes");
      });
    });

    describe("isPathSafe Utility", () => {
      it("identifies safe paths", () => {
        expect(isPathSafe("/safe/path/file.css")).toBe(true);
        expect(isPathSafe("relative/safe/path.css")).toBe(true);
      });

      it("identifies unsafe paths", () => {
        expect(isPathSafe("../../../etc/passwd")).toBe(false);
        expect(isPathSafe("/path/with\0null")).toBe(false);
        expect(isPathSafe("")).toBe(false);
      });
    });

    describe("Batch Operations", () => {
      it("processes multiple path calculations efficiently", () => {
        const pairs = [
          { from: "/project/src/index.html", to: "/project/dist/main.css" },
          { from: "/project/src/about.html", to: "/project/dist/about.css" },
          {
            from: "/project/src/contact.html",
            to: "/project/assets/contact.css",
          },
        ];

        const results = calculateRelativePathsBatch(pairs);

        expect(results).toHaveLength(3);
        expect(results[0].relativePath).toBe("../dist/main.css");
        expect(results[1].relativePath).toBe("../dist/about.css");
        expect(results[2].relativePath).toBe("../assets/contact.css");

        results.forEach((result) => {
          expect(result.isValid).toBe(true);
        });
      });

      it("handles batch operations with custom options", () => {
        const pairs = [
          { from: "src/index.html", to: "dist/main.css" },
          { from: "src/about.html", to: "dist/about.css" },
        ];

        const results = calculateRelativePathsBatch(pairs, {
          basePath: "/project",
          normalizeForWeb: true,
        });

        expect(results).toHaveLength(2);
        results.forEach((result) => {
          expect(result.isValid).toBe(true);
          expect(result.metadata.basePath).toBe("/project");
        });
      });
    });
  });

  describe("Caching System", () => {
    describe("Path Calculation Caching", () => {
      it("caches relative path calculations", () => {
        const result1 = pathUtils.calculateRelativePath(
          "/from/path.html",
          "/to/path.css",
        );
        const result2 = pathUtils.calculateRelativePath(
          "/from/path.html",
          "/to/path.css",
        );

        expect(result1.relativePath).toBe(result2.relativePath);
        // Verify caching is working by checking cache stats
        const stats = pathUtils.getCacheStats();
        expect(stats.paths).toBeGreaterThan(0);
      });

      it("caches validation results", () => {
        const result1 = pathUtils.validatePath("/test/path.css");
        const result2 = pathUtils.validatePath("/test/path.css");

        expect(result1.isValid).toBe(result2.isValid);
        expect(result1.normalizedPath).toBe(result2.normalizedPath);
      });

      it("respects different options in cache keys", () => {
        const result1 = pathUtils.calculateRelativePath(
          "/from/path.html",
          "/to/path.css",
        );
        const result2 = pathUtils.calculateRelativePath(
          "/from/path.html",
          "/to/path.css",
          {
            useRelativePaths: false, // This should produce different results
          },
        );

        // These should be different results due to different options
        expect(result1.relativePath).not.toBe(result2.relativePath);
      });
    });

    describe("Cache Management", () => {
      it("provides cache statistics", () => {
        pathUtils.calculateRelativePath("/from/path.html", "/to/path.css");
        pathUtils.validatePath("/test/path.css");

        const stats = pathUtils.getCacheStats();
        expect(stats.paths).toBeGreaterThan(0);
        expect(stats.validations).toBeGreaterThan(0);
        expect(stats.maxSize).toBe(1000);
      });

      it("clears cache when requested", () => {
        pathUtils.calculateRelativePath("/from/path.html", "/to/path.css");
        pathUtils.validatePath("/test/path.css");

        pathUtils.clearCache();

        const stats = pathUtils.getCacheStats();
        expect(stats.paths).toBe(0);
        expect(stats.validations).toBe(0);
      });
    });
  });

  describe("Error Classes", () => {
    describe("PathUtilsError", () => {
      it("creates errors with proper inheritance", () => {
        const error = new PathUtilsError("Test message", "TEST_CODE");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PathUtilsError);
        expect(error.message).toBe("Test message");
        expect(error.code).toBe("TEST_CODE");
        expect(error.name).toBe("PathUtilsError");
      });

      it("includes cause when provided", () => {
        const cause = new Error("Original error");
        const error = new PathUtilsError("Wrapper message", "TEST_CODE", cause);

        expect(error.cause).toBe(cause);
      });
    });

    describe("PathSecurityError", () => {
      it("creates security-specific errors", () => {
        const error = new PathSecurityError(
          "Security violation",
          "/dangerous/path",
        );

        expect(error).toBeInstanceOf(PathUtilsError);
        expect(error).toBeInstanceOf(PathSecurityError);
        expect(error.path).toBe("/dangerous/path");
        expect(error.code).toBe("PATH_SECURITY_ERROR");
        expect(error.name).toBe("PathSecurityError");
      });
    });

    describe("PathValidationError", () => {
      it("creates validation-specific errors", () => {
        const error = new PathValidationError(
          "Validation failed",
          "/invalid/path",
        );

        expect(error).toBeInstanceOf(PathUtilsError);
        expect(error).toBeInstanceOf(PathValidationError);
        expect(error.path).toBe("/invalid/path");
        expect(error.code).toBe("PATH_VALIDATION_ERROR");
        expect(error.name).toBe("PathValidationError");
      });
    });
  });

  describe("Integration Scenarios", () => {
    describe("Real-World Path Scenarios", () => {
      it("handles typical web project structure", () => {
        const scenarios = [
          // HTML in root, CSS in assets
          {
            from: "/project/index.html",
            to: "/project/assets/css/main.css",
            expected: "assets/css/main.css",
          },
          // HTML in pages, CSS in root assets
          {
            from: "/project/pages/about.html",
            to: "/project/assets/styles.css",
            expected: "../assets/styles.css",
          },
          // Nested HTML, nested CSS
          {
            from: "/project/src/pages/deep/nested.html",
            to: "/project/src/assets/css/style.css",
            expected: "../../assets/css/style.css",
          },
          // Same directory
          {
            from: "/project/dist/index.html",
            to: "/project/dist/bundle.css",
            expected: "bundle.css",
          },
        ];

        scenarios.forEach(({ from, to, expected }) => {
          const result = pathUtils.calculateRelativePath(from, to);
          expect(result.relativePath).toBe(expected);
          expect(result.isValid).toBe(true);
        });
      });

      it("handles monorepo structures", () => {
        const result = pathUtils.calculateRelativePath(
          "/monorepo/packages/web/src/index.html",
          "/monorepo/packages/shared/assets/common.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("../../shared/assets/common.css");
      });

      it("handles build tool scenarios", () => {
        // Source to dist
        const result = pathUtils.calculateRelativePath(
          "/project/src/index.html",
          "/project/dist/assets/main-abc123.css",
        );

        expect(result.isValid).toBe(true);
        expect(result.relativePath).toBe("../dist/assets/main-abc123.css");
      });
    });

    describe("Performance Characteristics", () => {
      it("performs well with repeated calculations", () => {
        const iterations = 1000;
        const start = Date.now();

        for (let i = 0; i < iterations; i++) {
          pathUtils.calculateRelativePath(
            `/project/src/file${i}.html`,
            "/project/dist/common.css",
          );
        }

        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second
      });

      it("benefits from caching on repeated identical calculations", () => {
        const iterations = 100;

        // Clear cache to start fresh
        pathUtils.clearCache();
        expect(pathUtils.getCacheStats().paths).toBe(0);

        // Run calculations
        for (let i = 0; i < iterations; i++) {
          pathUtils.calculateRelativePath(
            "/project/src/index.html",
            "/project/dist/styles.css",
          );
        }

        // Verify cache has been populated (should only have 1 entry due to identical calls)
        const stats = pathUtils.getCacheStats();
        expect(stats.paths).toBe(1);
      });
    });
  });
});
