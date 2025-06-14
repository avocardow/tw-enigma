import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Logger,
  LogLevel,
  LogLevelNames,
  createLogger,
  ErrorContext,
} from "../src/logger.ts";

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleOutput: string[] = [];
let errorOutput: string[] = [];

describe("Logger", () => {
  beforeEach(() => {
    consoleOutput = [];
    errorOutput = [];

    // Mock console.log and console.error
    console.log = vi.fn().mockImplementation((message: string) => {
      consoleOutput.push(message);
    });
    console.error = vi.fn().mockImplementation((message: string) => {
      errorOutput.push(message);
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.clearAllMocks();
  });

  describe("LogLevel", () => {
    it("should have correct numeric values for log levels", () => {
      expect(LogLevel.TRACE).toBe(0);
      expect(LogLevel.DEBUG).toBe(1);
      expect(LogLevel.INFO).toBe(2);
      expect(LogLevel.WARN).toBe(3);
      expect(LogLevel.ERROR).toBe(4);
      expect(LogLevel.FATAL).toBe(5);
    });

    it("should have correct level names", () => {
      expect(LogLevelNames[LogLevel.TRACE]).toBe("TRACE");
      expect(LogLevelNames[LogLevel.DEBUG]).toBe("DEBUG");
      expect(LogLevelNames[LogLevel.INFO]).toBe("INFO");
      expect(LogLevelNames[LogLevel.WARN]).toBe("WARN");
      expect(LogLevelNames[LogLevel.ERROR]).toBe("ERROR");
      expect(LogLevelNames[LogLevel.FATAL]).toBe("FATAL");
    });
  });

  describe("Logger Constructor", () => {
    it("should create logger with default options", () => {
      const testLogger = new Logger();

      testLogger.info("test message");

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain("INFO");
      expect(consoleOutput[0]).toContain("test message");
    });

    it("should create logger with custom options", () => {
      const testLogger = new Logger({
        level: LogLevel.DEBUG,
        verbose: true,
        outputFormat: "json",
        colorize: false,
        component: "TestComponent",
      });

      testLogger.debug("debug message");

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("DEBUG");
      expect(logEntry.message).toBe("debug message");
      expect(logEntry.component).toBe("TestComponent");
    });

    it("should respect silent mode", () => {
      const testLogger = new Logger({ silent: true });

      testLogger.error("silent error");

      expect(consoleOutput).toHaveLength(0);
    });
  });

  describe("Log Level Filtering", () => {
    it("should respect log level threshold", () => {
      const testLogger = new Logger({ level: LogLevel.WARN });

      testLogger.trace("trace message");
      testLogger.debug("debug message");
      testLogger.info("info message");
      testLogger.warn("warn message");
      testLogger.error("error message");
      testLogger.fatal("fatal message");

      // WARN goes to stdout, ERROR and FATAL go to stderr
      expect(consoleOutput).toHaveLength(1); // Only WARN
      expect(errorOutput).toHaveLength(2); // ERROR and FATAL
      expect(consoleOutput[0]).toContain("WARN");
      expect(errorOutput[0]).toContain("ERROR");
      expect(errorOutput[1]).toContain("FATAL");
    });

    it("should set log level dynamically", () => {
      const testLogger = new Logger({ level: LogLevel.ERROR });

      testLogger.info("info message 1");
      expect(consoleOutput).toHaveLength(0);

      testLogger.setLevel(LogLevel.INFO);
      testLogger.info("info message 2");
      expect(consoleOutput).toHaveLength(1);
    });

    it("should enable verbose mode correctly", () => {
      const testLogger = new Logger({ level: LogLevel.INFO });

      testLogger.setVerbose(true);
      testLogger.debug("debug message");

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain("DEBUG");
    });
  });

  describe("Output Formats", () => {
    it("should format human-readable output correctly", () => {
      const testLogger = new Logger({
        outputFormat: "human",
        colorize: false,
        timestamp: false,
      });

      testLogger.info("test message");

      expect(consoleOutput[0]).toMatch(/^INFO\s+test message$/);
    });

    it("should format JSON output correctly", () => {
      const testLogger = new Logger({
        outputFormat: "json",
        component: "TestComponent",
      });

      testLogger.info("json test message");

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("INFO");
      expect(logEntry.message).toBe("json test message");
      expect(logEntry.component).toBe("TestComponent");
      expect(logEntry.timestamp).toBeDefined();
    });

    it("should include context in output", () => {
      const testLogger = new Logger({ outputFormat: "json" });
      const context: ErrorContext = {
        operation: "testOperation",
        filePath: "/test/file.js",
        userId: "test-user",
      };

      testLogger.info("context test", context);

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context).toEqual(context);
    });

    it("should format timestamps correctly", () => {
      const testLogger = new Logger({
        outputFormat: "human",
        colorize: false,
        timestamp: true,
      });

      testLogger.info("timestamp test");

      // Account for potential ANSI color codes and match the timestamp pattern
      expect(consoleOutput[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/,
      );
    });
  });

  describe("Error Logging", () => {
    it("should log Error objects with stack traces", () => {
      const testLogger = new Logger({
        outputFormat: "json",
      });
      const testError = new Error("Test error message");

      testLogger.error(testError);

      const logEntry = JSON.parse(errorOutput[0]);
      expect(logEntry.level).toBe("ERROR");
      expect(logEntry.message).toBe("Test error message");
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.name).toBe("Error");
      expect(logEntry.error.message).toBe("Test error message");
      expect(logEntry.error.stack).toBeDefined();
    });

    it("should log string error messages", () => {
      const testLogger = new Logger({ outputFormat: "json" });

      testLogger.error("String error message");

      const logEntry = JSON.parse(errorOutput[0]);
      expect(logEntry.level).toBe("ERROR");
      expect(logEntry.message).toBe("String error message");
      expect(logEntry.error).toBeUndefined();
    });

    it("should handle fatal errors correctly", () => {
      const testLogger = new Logger({ outputFormat: "json" });
      const fatalError = new Error("Fatal error");

      testLogger.fatal(fatalError);

      const logEntry = JSON.parse(errorOutput[0]);
      expect(logEntry.level).toBe("FATAL");
      expect(logEntry.error.name).toBe("Error");
    });
  });

  describe("Child Loggers", () => {
    it("should create child loggers with inherited settings", () => {
      const parentLogger = new Logger({
        level: LogLevel.DEBUG,
        outputFormat: "json",
        verbose: true,
      });

      const childLogger = parentLogger.child("ChildComponent");
      childLogger.info("child message");

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("INFO");
      expect(logEntry.message).toBe("child message");
      expect(logEntry.component).toBe("ChildComponent");
    });

    it("should allow child loggers to override parent settings", () => {
      const parentLogger = new Logger({
        level: LogLevel.INFO,
        outputFormat: "human",
      });

      const childLogger = parentLogger.child("ChildComponent", {
        level: LogLevel.DEBUG,
        outputFormat: "json",
      });

      childLogger.debug("child debug message");

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("DEBUG");
      expect(logEntry.component).toBe("ChildComponent");
    });
  });

  describe("Performance Timing", () => {
    it("should log performance timing correctly", () => {
      const testLogger = new Logger({
        outputFormat: "json",
        level: LogLevel.DEBUG, // Ensure DEBUG level is enabled
      });
      const operation = "file-processing";
      const duration = 1234;

      testLogger.timing(operation, duration);

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("DEBUG");
      expect(logEntry.message).toContain(operation);
      expect(logEntry.message).toContain("1234ms");
      expect(logEntry.context.operation).toBe(operation);
      expect(logEntry.context.processingTime).toBe(duration);
    });

    it("should include additional context in timing logs", () => {
      const testLogger = new Logger({
        outputFormat: "json",
        level: LogLevel.DEBUG, // Ensure DEBUG level is enabled
      });
      const context: ErrorContext = {
        filePath: "/test/file.js",
        userId: "test-user",
      };

      testLogger.timing("test-operation", 500, context);

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context.filePath).toBe("/test/file.js");
      expect(logEntry.context.userId).toBe("test-user");
      expect(logEntry.context.operation).toBe("test-operation");
      expect(logEntry.context.processingTime).toBe(500);
    });
  });

  describe("Default Logger Instance", () => {
    it("should have sensible defaults for development", async () => {
      // Mock process.env for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      // Import again to get fresh instance with new env
      vi.resetModules();
      const { logger: devLogger } = await import("../src/logger.ts");

      devLogger.debug("dev debug message");

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain("DEBUG");

      process.env.NODE_ENV = originalEnv;
    });

    it("should respect environment variables", async () => {
      const originalVerbose = process.env.ENIGMA_VERBOSE;
      const originalNodeEnv = process.env.NODE_ENV;

      process.env.ENIGMA_VERBOSE = "true";
      process.env.NODE_ENV = "development"; // Ensure DEBUG level is enabled

      vi.resetModules();
      const { logger: verboseLogger } = await import("../src/logger.ts");

      verboseLogger.debug("verbose debug message");

      expect(consoleOutput).toHaveLength(1);

      process.env.ENIGMA_VERBOSE = originalVerbose;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe("createLogger Helper", () => {
    it("should create component-specific loggers", () => {
      const componentLogger = createLogger("TestComponent");
      componentLogger.info("component message");

      // Should contain component name in human-readable format
      expect(consoleOutput[0]).toContain("[TestComponent]");
    });

    it("should pass through custom options", () => {
      const customLogger = createLogger("CustomComponent", {
        outputFormat: "json",
        level: LogLevel.DEBUG,
      });

      customLogger.debug("custom debug message");

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("DEBUG");
      expect(logEntry.component).toBe("CustomComponent");
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined context gracefully", () => {
      const testLogger = new Logger({ outputFormat: "json" });

      testLogger.info("message with undefined context", undefined);

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context).toBeUndefined();
    });

    it("should handle empty context objects", () => {
      const testLogger = new Logger({ outputFormat: "json" });

      testLogger.info("message with empty context", {});

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context).toBeUndefined();
    });

    it("should handle complex context objects", () => {
      const testLogger = new Logger({ outputFormat: "json" });
      const complexContext: ErrorContext = {
        operation: "complex-test",
        nested: {
          value: 42,
          array: [1, 2, 3],
          boolean: true,
        } as any,
      };

      testLogger.info("complex context message", complexContext);

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.context.operation).toBe("complex-test");
      expect(logEntry.context.nested).toEqual({
        value: 42,
        array: [1, 2, 3],
        boolean: true,
      });
    });

    it("should handle very long messages", () => {
      const testLogger = new Logger({ outputFormat: "json" });
      const longMessage = "A".repeat(10000);

      testLogger.info(longMessage);

      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.message).toBe(longMessage);
      expect(logEntry.message).toHaveLength(10000);
    });
  });

  describe("Integration Tests", () => {
    it("should work correctly with multiple loggers", () => {
      const logger1 = new Logger({
        component: "Component1",
        outputFormat: "json",
      });
      const logger2 = new Logger({
        component: "Component2",
        outputFormat: "json",
      });

      logger1.info("message from component 1");
      logger2.warn("warning from component 2");

      expect(consoleOutput).toHaveLength(2);

      const entry1 = JSON.parse(consoleOutput[0]);
      const entry2 = JSON.parse(consoleOutput[1]);

      expect(entry1.component).toBe("Component1");
      expect(entry1.level).toBe("INFO");
      expect(entry2.component).toBe("Component2");
      expect(entry2.level).toBe("WARN");
    });

    it("should maintain context across multiple log calls", () => {
      const testLogger = createLogger("ContextTest");
      const context: ErrorContext = {
        operation: "multi-step-process",
        requestId: "req-123",
      };

      testLogger.info("Step 1 starting", context);
      testLogger.debug("Step 1 processing", context);
      testLogger.info("Step 1 completed", context);

      expect(consoleOutput).toHaveLength(2); // DEBUG filtered out by default
      consoleOutput.forEach((output) => {
        expect(output).toContain("[ContextTest]");
        if (testLogger["outputFormat"] === "json") {
          const entry = JSON.parse(output);
          expect(entry.context?.operation).toBe("multi-step-process");
          expect(entry.context?.requestId).toBe("req-123");
        }
      });
    });
  });
});

export {};

// Tests for new enhanced logging features
describe("Enhanced Logger Features", () => {
  let tempLogDir: string;
  let tempLogFile: string;

  beforeEach(async () => {
    // Create temporary directory and file for testing
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");

    tempLogDir = fs.mkdtempSync(path.join(os.tmpdir(), "logger-test-"));
    tempLogFile = path.join(tempLogDir, "test.log");

    consoleOutput = [];
    errorOutput = [];

    console.log = vi.fn().mockImplementation((message: string) => {
      consoleOutput.push(message);
    });
    console.error = vi.fn().mockImplementation((message: string) => {
      errorOutput.push(message);
    });
  });

  afterEach(async () => {
    // Clean up temporary files
    const fs = await import("fs");
    try {
      if (fs.existsSync(tempLogFile)) {
        fs.unlinkSync(tempLogFile);
      }
      fs.rmdirSync(tempLogDir);
    } catch {
      // Ignore cleanup errors
    }

    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.clearAllMocks();
  });

  describe("Very Verbose Mode", () => {
    it("should enable very verbose mode and set trace level", () => {
      const testLogger = new Logger({
        veryVerbose: true,
        outputFormat: "json",
      });

      testLogger.trace("trace message");

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("TRACE");
      expect(logEntry.message).toBe("trace message");
    });

    it("should automatically enable verbose when very verbose is enabled", () => {
      const testLogger = new Logger({
        veryVerbose: true,
        verbose: false,
      });

      const state = testLogger.getState();
      expect(state.veryVerbose).toBe(true);
      expect(state.verbose).toBe(true);
    });
  });

  describe("Quiet Mode", () => {
    it("should enable quiet mode and only show warnings and errors", () => {
      const testLogger = new Logger({
        quiet: true,
        outputFormat: "json",
      });

      testLogger.trace("trace message");
      testLogger.debug("debug message");
      testLogger.info("info message");
      testLogger.warn("warn message");
      testLogger.error("error message");

      expect(consoleOutput).toHaveLength(1); // Only WARN goes to stdout
      expect(errorOutput).toHaveLength(1); // Only ERROR goes to stderr
      expect(JSON.parse(consoleOutput[0]).level).toBe("WARN");
      expect(JSON.parse(errorOutput[0]).level).toBe("ERROR");
    });

    it("should override verbose settings when quiet is enabled", () => {
      const testLogger = new Logger({
        verbose: true,
        veryVerbose: true,
        quiet: true,
      });

      const state = testLogger.getState();
      expect(state.quiet).toBe(true);
      expect(state.verbose).toBe(false);
      expect(state.veryVerbose).toBe(false);
    });
  });

  describe("File Output", () => {
    it("should write logs to file in human format", async () => {
      const fs = await import("fs");

      const testLogger = new Logger({
        fileOutput: {
          filePath: tempLogFile,
          format: "human",
        },
        outputFormat: "human",
        colorize: false,
        timestamp: false,
      });

      testLogger.info("test file message");

      // Allow time for file write
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fs.existsSync(tempLogFile)).toBe(true);
      const fileContent = fs.readFileSync(tempLogFile, "utf8");
      expect(fileContent).toContain("INFO");
      expect(fileContent).toContain("test file message");
    });

    it("should write logs to file in JSON format", async () => {
      const fs = await import("fs");

      const testLogger = new Logger({
        fileOutput: {
          filePath: tempLogFile,
          format: "json",
        },
        component: "TestComponent",
      });

      testLogger.info("json file message");

      // Allow time for file write
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fs.existsSync(tempLogFile)).toBe(true);
      const fileContent = fs.readFileSync(tempLogFile, "utf8");
      const logEntry = JSON.parse(fileContent.trim());
      expect(logEntry.level).toBe("INFO");
      expect(logEntry.message).toBe("json file message");
      expect(logEntry.component).toBe("TestComponent");
    });

    it("should write logs to file in CSV format", async () => {
      const fs = await import("fs");

      const testLogger = new Logger({
        fileOutput: {
          filePath: tempLogFile,
          format: "csv",
        },
        component: "CSVTest",
      });

      testLogger.warn("csv warning message");

      // Allow time for file write
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fs.existsSync(tempLogFile)).toBe(true);
      const fileContent = fs.readFileSync(tempLogFile, "utf8");
      expect(fileContent).toContain('"WARN"');
      expect(fileContent).toContain('"CSVTest"');
      expect(fileContent).toContain('"csv warning message"');
    });

    it("should handle file output errors gracefully", () => {
      const testLogger = new Logger({
        fileOutput: {
          filePath: "/invalid/path/test.log",
          format: "human",
        },
      });

      // Should not throw, just log error to console
      testLogger.info("test message with invalid file path");

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain("test message with invalid file path");
    });
  });

  describe("Progress Tracking", () => {
    it("should track progress operations when enabled", () => {
      const testLogger = new Logger({
        enableProgressTracking: true,
        verbose: true,
        outputFormat: "json",
      });

      testLogger.startProgress("test-operation", {
        total: 100,
        label: "Test Operation",
      });

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.message).toContain("Starting Test Operation (0/100)");
    });

    it("should update progress with percentage and ETA", () => {
      const testLogger = new Logger({
        enableProgressTracking: true,
        verbose: true,
        outputFormat: "human",
        colorize: false,
        timestamp: false,
      });

      testLogger.startProgress("test-op", { total: 50, label: "Test" });
      consoleOutput = []; // Clear start message

      testLogger.updateProgress("test-op", 25);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain("Test: 25/50 (50%)");
      expect(consoleOutput[0]).toContain("ETA:");
    });

    it("should complete progress tracking", () => {
      const testLogger = new Logger({
        enableProgressTracking: true,
        verbose: true,
        outputFormat: "human",
        colorize: false,
        timestamp: false,
      });

      testLogger.startProgress("complete-test", {
        total: 10,
        label: "Complete Test",
      });
      testLogger.completeProgress(
        "complete-test",
        "Successfully processed all items",
      );

      expect(consoleOutput).toHaveLength(2);
      expect(consoleOutput[1]).toContain(
        "✅ Completed Complete Test (10 items",
      );
      expect(consoleOutput[1]).toContain("Successfully processed all items");
    });

    it("should not track progress when disabled", () => {
      const testLogger = new Logger({
        enableProgressTracking: false,
        verbose: true,
      });

      testLogger.startProgress("disabled-test", {
        total: 10,
        label: "Disabled",
      });

      expect(consoleOutput).toHaveLength(0);
    });
  });

  describe("Performance Metrics", () => {
    it("should log performance metrics in very verbose mode", () => {
      const testLogger = new Logger({
        veryVerbose: true,
        outputFormat: "json",
      });

      const metrics = {
        memoryUsage: process.memoryUsage(),
        processingTime: 1500,
        fileCount: 25,
        totalFileSize: 1024 * 1024,
        optimizationRatio: 0.75,
      };

      testLogger.performanceMetrics("CSS Optimization", metrics);

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("TRACE");
      expect(logEntry.message).toContain(
        "CSS Optimization completed in 1500ms",
      );
      expect(logEntry.message).toContain("processed 25 files");
      expect(logEntry.message).toContain("optimization: 75%");
      expect(logEntry.context.processingTime).toBe(1500);
      expect(logEntry.context.fileCount).toBe(25);
    });

    it("should log performance metrics in verbose mode as debug", () => {
      const testLogger = new Logger({
        verbose: true,
        veryVerbose: false,
        outputFormat: "json",
      });

      const metrics = {
        memoryUsage: process.memoryUsage(),
        processingTime: 500,
      };

      testLogger.performanceMetrics("Fast Operation", metrics);

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("DEBUG");
    });
  });

  describe("File Operations Logging", () => {
    it("should log detailed file operations in very verbose mode", () => {
      const testLogger = new Logger({
        veryVerbose: true,
        outputFormat: "json",
      });

      testLogger.fileOperation("READ", "/path/to/file.css", {
        size: 2048,
        processingTime: 25,
        result: "Classes extracted: 15",
      });

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("TRACE");
      expect(logEntry.message).toContain("📁 READ: /path/to/file.css");
      expect(logEntry.message).toContain("(2KB)");
      expect(logEntry.message).toContain("25ms");
      expect(logEntry.message).toContain("Classes extracted: 15");
      expect(logEntry.context.filePath).toBe("/path/to/file.css");
      expect(logEntry.context.fileSize).toBe(2048);
    });

    it("should not log file operations when not in very verbose mode", () => {
      const testLogger = new Logger({
        verbose: true,
        veryVerbose: false,
      });

      testLogger.fileOperation("WRITE", "/path/to/output.css");

      expect(consoleOutput).toHaveLength(0);
    });
  });

  describe("Process Step Logging", () => {
    it("should log process steps in verbose mode", () => {
      const testLogger = new Logger({
        verbose: true,
        outputFormat: "json",
      });

      testLogger.processStep("Analyzing CSS files", "Found 10 stylesheets");

      expect(consoleOutput).toHaveLength(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      expect(logEntry.level).toBe("DEBUG");
      expect(logEntry.message).toBe(
        "🔄 Analyzing CSS files: Found 10 stylesheets",
      );
    });

    it("should not log process steps when not verbose", () => {
      const testLogger = new Logger({
        verbose: false,
      });

      testLogger.processStep("Hidden step", "Should not appear");

      expect(consoleOutput).toHaveLength(0);
    });
  });

  describe("Logger State Management", () => {
    it("should return accurate logger state", () => {
      const testLogger = new Logger({
        level: LogLevel.DEBUG,
        verbose: true,
        veryVerbose: false,
        quiet: false,
        silent: false,
        enableProgressTracking: true,
        fileOutput: {
          filePath: "/test/path.log",
          format: "json",
        },
      });

      const state = testLogger.getState();

      expect(state.level).toBe(LogLevel.DEBUG);
      expect(state.verbose).toBe(true);
      expect(state.veryVerbose).toBe(false);
      expect(state.quiet).toBe(false);
      expect(state.silent).toBe(false);
      expect(state.fileOutputEnabled).toBe(true);
      expect(state.progressTrackingEnabled).toBe(true);
      expect(state.activeProgressCount).toBe(0);
    });

    it("should track active progress operations", () => {
      const testLogger = new Logger({
        enableProgressTracking: true,
        verbose: true,
      });

      testLogger.startProgress("op1", { total: 10 });
      testLogger.startProgress("op2", { total: 20 });

      expect(testLogger.getState().activeProgressCount).toBe(2);

      testLogger.completeProgress("op1");

      expect(testLogger.getState().activeProgressCount).toBe(1);
    });
  });

  describe("Logger Cleanup", () => {
    it("should clean up file streams and progress states", async () => {
      const testLogger = new Logger({
        fileOutput: {
          filePath: tempLogFile,
          format: "human",
        },
        enableProgressTracking: true,
        verbose: true,
      });

      testLogger.info("test message");
      testLogger.startProgress("cleanup-test", { total: 5 });

      expect(testLogger.getState().fileOutputEnabled).toBe(true);
      expect(testLogger.getState().activeProgressCount).toBe(1);

      testLogger.cleanup();

      expect(testLogger.getState().activeProgressCount).toBe(0);
    });
  });

  describe("Dynamic Configuration", () => {
    it("should dynamically enable/disable very verbose mode", () => {
      const testLogger = new Logger({
        level: LogLevel.INFO,
        veryVerbose: false,
      });

      testLogger.trace("should not appear");
      expect(consoleOutput).toHaveLength(0);

      testLogger.setVeryVerbose(true);
      testLogger.trace("should appear");

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain("TRACE");
    });

    it("should dynamically enable/disable quiet mode", () => {
      const testLogger = new Logger({
        verbose: true,
      });

      testLogger.info("verbose message");
      expect(consoleOutput).toHaveLength(1);

      consoleOutput = [];
      testLogger.setQuiet(true);
      testLogger.info("quiet message");

      expect(consoleOutput).toHaveLength(0);
    });

    it("should configure file output dynamically", async () => {
      const fs = await import("fs");

      const testLogger = new Logger();

      expect(testLogger.getState().fileOutputEnabled).toBe(false);

      testLogger.setFileOutput({
        filePath: tempLogFile,
        format: "json",
      });

      expect(testLogger.getState().fileOutputEnabled).toBe(true);

      testLogger.info("dynamic file message");

      // Allow time for file write
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fs.existsSync(tempLogFile)).toBe(true);

      testLogger.disableFileOutput();
      expect(testLogger.getState().fileOutputEnabled).toBe(false);
    });
  });
});
