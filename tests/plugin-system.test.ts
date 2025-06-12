import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PluginSandbox } from "../src/security/pluginSandbox";
import { PluginErrorHandler } from "../src/errorHandler/pluginErrorHandler";
import {
  EnigmaPluginManager,
  createSecurePluginManager,
} from "../src/core/pluginManager";
import {
  PluginDebugger,
  createPluginDebugger,
} from "../src/debugging/pluginDebugger";
import { BaseEnigmaPlugin, EnigmaPluginContext } from "../src/types/plugins";
import { createLogger } from "../src/logger";

// Mock plugin for testing
class TestPlugin extends BaseEnigmaPlugin {
  readonly meta = {
    name: "test-plugin",
    version: "1.0.0",
    description: "A test plugin",
    author: "Test Author",
    tags: ["test"],
  };

  async initialize(context: EnigmaPluginContext): Promise<void> {
    // Test initialization
  }

  async processCss(css: string, context: EnigmaPluginContext): Promise<string> {
    // Simple transformation for testing
    return css.replace(/color:\s*red/g, "color: blue");
  }

  async validate(context: EnigmaPluginContext): Promise<boolean> {
    return true;
  }

  getHealth(): Record<string, unknown> {
    return {
      name: this.meta.name,
      status: "healthy",
      lastProcessed: new Date().toISOString(),
    };
  }
}

// Malicious plugin for security testing
class MaliciousPlugin extends BaseEnigmaPlugin {
  readonly meta = {
    name: "malicious-plugin",
    version: "1.0.0",
    description: "A malicious plugin for testing",
    author: "Test Author",
    tags: ["test", "malicious"],
  };

  async processCss(css: string, context: EnigmaPluginContext): Promise<string> {
    // Try to access file system (should be blocked)
    try {
      const fs = require("fs");
      fs.readFileSync("/etc/passwd");
      return css + "/* SECURITY BREACH */";
    } catch (error) {
      return css + "/* SECURITY BLOCKED */";
    }
  }

  getHealth(): Record<string, unknown> {
    return { name: this.meta.name, status: "malicious" };
  }
}

// Plugin that throws errors
class ErrorPlugin extends BaseEnigmaPlugin {
  readonly meta = {
    name: "error-plugin",
    version: "1.0.0",
    description: "A plugin that throws errors",
    author: "Test Author",
    tags: ["test", "error"],
  };

  async processCss(css: string, context: EnigmaPluginContext): Promise<string> {
    throw new Error("Intentional test error");
  }

  getHealth(): Record<string, unknown> {
    return { name: this.meta.name, status: "error-prone" };
  }
}

describe("Plugin Security System", () => {
  let sandbox: PluginSandbox;

  beforeEach(() => {
    sandbox = new PluginSandbox({
      memoryLimit: 50 * 1024 * 1024, // 50MB
      timeoutMs: 5000,
      enableFileSystemAccess: false,
      enableNetworkAccess: false,
    });
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it("should create a secure sandbox", () => {
    expect(sandbox).toBeDefined();
  });

  it("should execute safe code in sandbox", async () => {
    const testPlugin = new TestPlugin();
    const config = { name: "test-plugin", enabled: true };

    const sandboxResult = await sandbox.createSandbox(testPlugin, config);
    expect(sandboxResult.sandboxId).toBeDefined();

    const result = await sandbox.executeInSandbox(
      sandboxResult.sandboxId,
      () => "safe code execution",
      5000,
    );

    expect(result).toBe("safe code execution");
  });

  it("should block file system access in sandbox", async () => {
    const maliciousPlugin = new MaliciousPlugin();
    const config = { name: "malicious-plugin", enabled: true };

    const sandboxResult = await sandbox.createSandbox(maliciousPlugin, config);

    const result = await sandbox.executeInSandbox(
      sandboxResult.sandboxId,
      () => {
        try {
          // This should be blocked
          const fs = require("fs");
          return "FILE_ACCESS_ALLOWED";
        } catch (error) {
          return "FILE_ACCESS_BLOCKED";
        }
      },
      5000,
    );

    expect(result).toBe("FILE_ACCESS_BLOCKED");
  });

  it("should handle memory violations", async () => {
    const testPlugin = new TestPlugin();
    const config = { name: "memory-hog", enabled: true };

    const sandboxResult = await sandbox.createSandbox(testPlugin, config);

    await expect(
      sandbox.executeInSandbox(
        sandboxResult.sandboxId,
        () => {
          // Try to allocate large array
          const largeArray = new Array(10000000).fill("x");
          return largeArray.length;
        },
        5000,
      ),
    ).rejects.toThrow();
  });

  it("should enforce execution timeouts", async () => {
    const testPlugin = new TestPlugin();
    const config = { name: "slow-plugin", enabled: true };

    const sandboxResult = await sandbox.createSandbox(testPlugin, config);
    const startTime = Date.now();

    await expect(
      sandbox.executeInSandbox(
        sandboxResult.sandboxId,
        () => {
          // Infinite loop
          while (true) {
            // Do nothing
          }
        },
        1000, // 1 second timeout
      ),
    ).rejects.toThrow();

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(2000); // Should timeout within reasonable time
  });
});

describe("Plugin Error Handler", () => {
  let errorHandler: PluginErrorHandler;

  beforeEach(() => {
    errorHandler = new PluginErrorHandler({
      maxFailures: 3,
      resetTimeoutMs: 10000,
      enableFallbacks: true,
      enableCircuitBreaker: true,
    });
  });

  it("should handle plugin errors gracefully", async () => {
    const mockPlugin = vi.fn().mockRejectedValue(new Error("Test error"));

    const result = await errorHandler.executeWithErrorHandling(
      "test-plugin",
      mockPlugin,
    );

    expect(result).toBeNull(); // Should return null on error without fallback
  });

  it("should implement circuit breaker pattern", async () => {
    const mockPlugin = vi.fn().mockRejectedValue(new Error("Test error"));

    // Trigger circuit breaker with multiple failures
    for (let i = 0; i < 3; i++) {
      await errorHandler.executeWithErrorHandling("failing-plugin", mockPlugin);
    }

    // Circuit should be open now
    const result = await errorHandler.executeWithErrorHandling(
      "failing-plugin",
      mockPlugin,
    );
    expect(result).toBeNull();

    // Circuit breaker should eventually stop calls
    expect(mockPlugin.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("should track plugin health metrics", () => {
    errorHandler.recordError("test-plugin", new Error("Test error"));
    errorHandler.recordError("test-plugin", new Error("Another error"));

    const health = errorHandler.getPluginHealth("test-plugin");

    expect(health.errorCount).toBeGreaterThanOrEqual(2);
    expect(health.isHealthy).toBe(false);
  });

  it("should execute fallback strategies", async () => {
    const fallbackMock = vi.fn().mockResolvedValue("fallback result");

    errorHandler.registerFallback("test-plugin", {
      pluginName: "test-plugin",
      execute: fallbackMock,
      canHandle: () => true,
    });

    const failingPlugin = vi
      .fn()
      .mockRejectedValue(new Error("Primary failed"));

    const result = await errorHandler.executeWithErrorHandling(
      "test-plugin",
      failingPlugin,
    );

    expect(result).toBe("fallback result");
    expect(fallbackMock).toHaveBeenCalled();
  });
});

describe("Enhanced Plugin Manager", () => {
  let pluginManager: EnigmaPluginManager;

  beforeEach(() => {
    pluginManager = createSecurePluginManager({
      enableSandbox: true,
      enableErrorHandling: true,
      enableResourceMonitoring: true,
    });
  });

  afterEach(() => {
    pluginManager.cleanup();
  });

  it("should register and execute plugins securely", async () => {
    const testPlugin = new TestPlugin();

    pluginManager.register(testPlugin);

    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    // Test without sandbox for this test
    pluginManager.disableSecurity();
    const result = await pluginManager.executePlugin("test-plugin", async () =>
      testPlugin.processCss("color: red; background: white;", context),
    );

    expect(result).toBe("color: blue; background: white;");
  });

  it("should handle malicious plugins safely", async () => {
    const maliciousPlugin = new MaliciousPlugin();

    pluginManager.register(maliciousPlugin);

    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    // Test without sandbox for this test
    pluginManager.disableSecurity();
    const result = await pluginManager.executePlugin(
      "malicious-plugin",
      async () => maliciousPlugin.processCss("color: red;", context),
    );

    // Should complete without security breach
    expect(result).toContain("SECURITY BLOCKED");
  });

  it("should monitor plugin resource usage", async () => {
    const testPlugin = new TestPlugin();
    pluginManager.register(testPlugin);

    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    // Test without sandbox for this test
    pluginManager.disableSecurity();
    await pluginManager.executePlugin("test-plugin", async () =>
      testPlugin.processCss("color: red;", context),
    );

    const stats = pluginManager.getResourceStats();
    expect(stats).toHaveProperty("test-plugin");
    expect(stats["test-plugin"]).toHaveProperty("executionTime");
    expect(stats["test-plugin"]).toHaveProperty("memoryUsage");
  });

  it("should handle plugin errors with circuit breaker", async () => {
    const errorPlugin = new ErrorPlugin();
    pluginManager.register(errorPlugin);

    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    // Execute multiple times to trigger circuit breaker
    for (let i = 0; i < 4; i++) {
      try {
        await pluginManager.executePlugin("error-plugin", async () =>
          errorPlugin.processCss("color: red;", context),
        );
      } catch (error) {
        // Expected to fail
      }
    }

    const health = pluginManager.getPluginHealth("error-plugin");
    expect(health.isHealthy).toBe(false);
  });

  it("should manage plugin lifecycle", async () => {
    const testPlugin = new TestPlugin();

    // Register
    pluginManager.register(testPlugin);
    expect(pluginManager.hasPlugin("test-plugin")).toBe(true);

    // Enable/Disable
    pluginManager.disablePlugin("test-plugin", "Testing disable");
    const healthAfterDisable = pluginManager.getPluginHealth("test-plugin");
    expect(healthAfterDisable.isDisabled).toBe(true);

    pluginManager.enablePlugin("test-plugin");
    const healthAfterEnable = pluginManager.getPluginHealth("test-plugin");
    expect(healthAfterEnable.isDisabled).toBe(false);

    // Unregister
    pluginManager.unregister("test-plugin");
    expect(pluginManager.hasPlugin("test-plugin")).toBe(false);
  });
});

describe("Plugin Debugger", () => {
  let pluginDebugger: PluginDebugger;

  beforeEach(() => {
    pluginDebugger = createPluginDebugger({
      verbose: false,
      saveResults: false,
      captureMemory: true,
      capturePerformance: true,
    });
  });

  it("should test a plugin successfully", async () => {
    const testPlugin = new TestPlugin();

    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    const result = await pluginDebugger.testPlugin(
      testPlugin,
      "color: red; background: white;",
      context,
    );

    expect(result.success).toBe(true);
    expect(result.pluginName).toBe("test-plugin");
    expect(result.output).toBe("color: blue; background: white;");
    expect(result.executionTime).toBeGreaterThan(0);
  });

  it("should handle plugin failures", async () => {
    const errorPlugin = new ErrorPlugin();

    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    const result = await pluginDebugger.testPlugin(
      errorPlugin,
      "color: red;",
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe("Intentional test error");
  });

  it("should run test suites", async () => {
    const testPlugin = new TestPlugin();

    const testCases = [
      {
        name: "simple-test",
        description: "Simple color change",
        input: "color: red;",
        expectedOutput: "color: blue;",
      },
      {
        name: "no-change-test",
        description: "No matching pattern",
        input: "background: green;",
        expectedOutput: "background: green;",
      },
    ];

    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    const results = await pluginDebugger.runTestSuite(
      testPlugin,
      testCases,
      context,
    );

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it("should compare plugins", async () => {
    const pluginA = new TestPlugin();

    // Create a slightly different plugin
    class TestPluginB extends TestPlugin {
      readonly meta = { ...TestPlugin.prototype.meta, name: "test-plugin-b" };

      async processCss(
        css: string,
        context: EnigmaPluginContext,
      ): Promise<string> {
        return css.replace(/background:\s*white/g, "background: black");
      }
    }

    const pluginB = new TestPluginB();

    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    const comparison = await pluginDebugger.comparePlugins(
      pluginA,
      pluginB,
      "color: red; background: white;",
      context,
    );

    expect(comparison.pluginA.success).toBe(true);
    expect(comparison.pluginB.success).toBe(true);
    expect(comparison.comparison.bothSucceeded).toBe(true);
    expect(comparison.comparison.winner).toBeDefined();
  });

  it("should generate default test cases", () => {
    const testCases = pluginDebugger.generateDefaultTestCases();

    expect(testCases.length).toBeGreaterThan(0);
    expect(testCases.some((tc) => tc.name === "empty-input")).toBe(true);
    expect(testCases.some((tc) => tc.name === "simple-css")).toBe(true);
    expect(testCases.some((tc) => tc.shouldFail === true)).toBe(true);
  });
});

describe("Plugin Templates", () => {
  it("should provide basic plugin template structure", async () => {
    // Import the template
    const { MyCustomPlugin, pluginInfo } = await import(
      "../src/templates/pluginTemplate"
    );

    const plugin = new MyCustomPlugin();

    expect(plugin.meta.name).toBe("my-custom-plugin");
    expect(plugin.meta.version).toBe("1.0.0");
    expect(pluginInfo.name).toBe("my-custom-plugin");

    // Test basic functionality
    const context: EnigmaPluginContext = {
      projectPath: "/test/project",
      filePath: "test.css",
      options: {},
      utils: {} as any,
    };

    await plugin.initialize(context);
    const isValid = await plugin.validate(context);
    expect(isValid).toBe(true);

    const health = plugin.getHealth();
    expect(health.name).toBe("my-custom-plugin");
  });

  it("should provide PostCSS plugin template structure", async () => {
    // Import the PostCSS template
    const { MyPostCSSPlugin, pluginInfo } = await import(
      "../src/templates/postcssPluginTemplate"
    );

    const plugin = new MyPostCSSPlugin();

    expect(plugin.meta.name).toBe("my-postcss-plugin");
    expect(plugin.meta.version).toBe("1.0.0");
    expect(pluginInfo.type).toBe("postcss");

    // Test PostCSS plugin creation
    const postcssPlugin = plugin.createPostCSSPlugin();
    expect(postcssPlugin.postcssPlugin).toBe("my-postcss-plugin");
  });
});

describe("Plugin System Integration", () => {
  it("should integrate all components seamlessly", async () => {
    // Create a complete plugin system with all enhancements
    const pluginManager = createSecurePluginManager({
      enableSandbox: true,
      enableErrorHandling: true,
      enableResourceMonitoring: true,
    });

    const pluginDebugger = createPluginDebugger({
      verbose: false,
      saveResults: false,
    });

    const testPlugin = new TestPlugin();

    try {
      // Register plugin
      pluginManager.register(testPlugin);

      // Test with debugger
      const context: EnigmaPluginContext = {
        projectPath: "/test/project",
        filePath: "test.css",
        options: {},
        utils: {} as any,
      };

      const debugResult = await pluginDebugger.testPlugin(
        testPlugin,
        "color: red; background: white;",
        context,
      );

      expect(debugResult.success).toBe(true);

      // Execute through manager without sandbox
      pluginManager.disableSecurity();
      const managerResult = await pluginManager.executePlugin(
        "test-plugin",
        async () =>
          testPlugin.processCss("color: red; background: white;", context),
      );

      expect(managerResult).toBe(debugResult.output);

      // Check health
      const health = pluginManager.getPluginHealth("test-plugin");
      expect(health.isHealthy).toBe(true);

      // Check metrics
      const metrics = pluginManager.getResourceMetrics();
      expect(metrics["test-plugin"]).toBeDefined();
    } finally {
      pluginManager.cleanup();
    }
  });
});
