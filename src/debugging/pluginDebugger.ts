import { createLogger } from "../logger";
import {
  EnigmaPlugin,
  EnigmaPluginContext,
  PluginConfig,
} from "../types/plugins";
import { performance } from "perf_hooks";
import * as fs from "fs/promises";
import * as path from "path";

interface DebugOptions {
  verbose?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error";
  outputDir?: string;
  captureMemory?: boolean;
  capturePerformance?: boolean;
  saveResults?: boolean;
}

interface DebugResult {
  pluginName: string;
  success: boolean;
  executionTime: number;
  memoryUsage?: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: NodeJS.MemoryUsage;
  };
  output?: string;
  error?: Error;
  warnings: string[];
  metadata: Record<string, unknown>;
}

interface TestCase {
  name: string;
  description: string;
  input: string;
  expectedOutput?: string;
  shouldFail?: boolean;
  context?: Partial<EnigmaPluginContext>;
}

/**
 * Plugin Debugger - A comprehensive tool for testing and debugging Enigma plugins
 */
export class PluginDebugger {
  private logger = createLogger("plugin-debugger");
  private options: DebugOptions;

  constructor(options: DebugOptions = {}) {
    this.options = {
      verbose: false,
      logLevel: "debug",
      outputDir: "./debug-output",
      captureMemory: true,
      capturePerformance: true,
      saveResults: true,
      ...options,
    };

    // Set logger level based on options
    if (this.options.logLevel) {
      // Note: Logger level is private, cannot set directly
      // this.logger.level = this.options.logLevel;
    }
  }

  /**
   * Test a plugin with a single input
   */
  async testPlugin(
    plugin: EnigmaPlugin,
    input: string,
    context: EnigmaPluginContext,
  ): Promise<DebugResult> {
    const startTime = performance.now();
    const memoryBefore = this.options.captureMemory
      ? process.memoryUsage()
      : undefined;

    const result: DebugResult = {
      pluginName: plugin.meta?.name || "unknown",
      success: false,
      executionTime: 0,
      warnings: [],
      metadata: {},
    };

    try {
      this.logger.info(`Testing plugin: ${result.pluginName}`, {
        inputLength: input.length,
        context: {
          projectPath: context.projectPath,
          filePath: context.filePath,
        },
      });

      // Initialize plugin if needed
      if (plugin.initialize) {
        await plugin.initialize(context);
      }

      // Validate plugin
      if (plugin.validate) {
        const isValid = await plugin.validate(context);
        if (!isValid) {
          throw new Error("Plugin validation failed");
        }
      }

      // Process the input
      let output: string;
      if (plugin.processCss) {
        output = await plugin.processCss(input, context);
      } else {
        throw new Error("Plugin does not implement processCss method");
      }

      // Calculate execution time
      const endTime = performance.now();
      result.executionTime = endTime - startTime;

      // Capture memory usage
      if (this.options.captureMemory && memoryBefore) {
        const memoryAfter = process.memoryUsage();
        result.memoryUsage = {
          before: memoryBefore,
          after: memoryAfter,
          delta: {
            rss: memoryAfter.rss - memoryBefore.rss,
            heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            external: memoryAfter.external - memoryBefore.external,
            arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
          },
        };
      }

      // Get plugin health info
      if (plugin.getHealth) {
        result.metadata.health = plugin.getHealth();
      }

      result.success = true;
      result.output = output;

      this.logger.info(`Plugin test completed successfully`, {
        pluginName: result.pluginName,
        executionTime: result.executionTime,
        inputLength: input.length,
        outputLength: output.length,
        reduction: input.length - output.length,
      });
    } catch (error) {
      result.error = error instanceof Error ? error : new Error(String(error));
      result.success = false;

      this.logger.error(`Plugin test failed`, {
        pluginName: result.pluginName,
        error: result.error.message,
        stack: result.error.stack,
      });
    }

    // Save results if enabled
    if (this.options.saveResults) {
      await this.saveDebugResult(result, input);
    }

    return result;
  }

  /**
   * Run multiple test cases against a plugin
   */
  async runTestSuite(
    plugin: EnigmaPlugin,
    testCases: TestCase[],
    baseContext: EnigmaPluginContext,
  ): Promise<DebugResult[]> {
    this.logger.info(`Running test suite for plugin: ${plugin.meta?.name}`, {
      testCaseCount: testCases.length,
    });

    const results: DebugResult[] = [];

    for (const testCase of testCases) {
      this.logger.debug(`Running test case: ${testCase.name}`);

      const context = {
        ...baseContext,
        ...testCase.context,
      };

      try {
        const result = await this.testPlugin(plugin, testCase.input, context);

        // Validate expected output if provided
        if (testCase.expectedOutput && result.output) {
          const matches =
            result.output.trim() === testCase.expectedOutput.trim();
          if (!matches) {
            result.warnings.push(
              `Output mismatch: expected "${testCase.expectedOutput}" but got "${result.output}"`,
            );
          }
        }

        // Check if test should fail
        if (testCase.shouldFail && result.success) {
          result.warnings.push(`Test was expected to fail but succeeded`);
        } else if (!testCase.shouldFail && !result.success) {
          result.warnings.push(`Test was expected to succeed but failed`);
        }

        result.metadata.testCase = {
          name: testCase.name,
          description: testCase.description,
        };

        results.push(result);
      } catch (error) {
        const failedResult: DebugResult = {
          pluginName: plugin.meta?.name || "unknown",
          success: false,
          executionTime: 0,
          error: error instanceof Error ? error : new Error(String(error)),
          warnings: [],
          metadata: {
            testCase: {
              name: testCase.name,
              description: testCase.description,
            },
          },
        };

        results.push(failedResult);
      }
    }

    // Generate summary
    const summary = this.generateTestSummary(results);
    this.logger.info("Test suite completed", summary);

    // Save test suite results
    if (this.options.saveResults) {
      await this.saveTestSuiteResults(plugin, testCases, results, summary);
    }

    return results;
  }

  /**
   * Compare two plugins on the same input
   */
  async comparePlugins(
    pluginA: EnigmaPlugin,
    pluginB: EnigmaPlugin,
    input: string,
    context: EnigmaPluginContext,
  ): Promise<{
    pluginA: DebugResult;
    pluginB: DebugResult;
    comparison: Record<string, unknown>;
  }> {
    this.logger.info("Comparing plugins", {
      pluginA: pluginA.meta?.name,
      pluginB: pluginB.meta?.name,
      inputLength: input.length,
    });

    const [resultA, resultB] = await Promise.all([
      this.testPlugin(pluginA, input, context),
      this.testPlugin(pluginB, input, context),
    ]);

    const comparison = {
      bothSucceeded: resultA.success && resultB.success,
      performanceDiff: resultB.executionTime - resultA.executionTime,
      outputLengthDiff:
        (resultB.output?.length || 0) - (resultA.output?.length || 0),
      memoryDiff:
        resultA.memoryUsage && resultB.memoryUsage
          ? {
              heapUsed:
                resultB.memoryUsage.delta.heapUsed -
                resultA.memoryUsage.delta.heapUsed,
              rss:
                resultB.memoryUsage.delta.rss - resultA.memoryUsage.delta.rss,
            }
          : undefined,
      winner: this.determineWinner(resultA, resultB),
    };

    this.logger.info("Plugin comparison completed", {
      pluginA: resultA.pluginName,
      pluginB: resultB.pluginName,
      winner: comparison.winner,
      performanceDiff: comparison.performanceDiff,
    });

    return { pluginA: resultA, pluginB: resultB, comparison };
  }

  /**
   * Load test cases from a file
   */
  async loadTestCases(filePath: string): Promise<TestCase[]> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const testCases = JSON.parse(content) as TestCase[];

      this.logger.info(`Loaded test cases from ${filePath}`, {
        count: testCases.length,
      });

      return testCases;
    } catch (error) {
      this.logger.error(`Failed to load test cases from ${filePath}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Generate default test cases for common scenarios
   */
  generateDefaultTestCases(): TestCase[] {
    return [
      {
        name: "empty-input",
        description: "Test with empty CSS input",
        input: "",
      },
      {
        name: "simple-css",
        description: "Test with simple CSS rules",
        input: ".test { color: red; background: blue; }",
      },
      {
        name: "complex-css",
        description: "Test with complex CSS including media queries",
        input: `
          .header { display: flex; }
          @media (max-width: 768px) {
            .header { display: block; }
          }
          .footer { margin: 10px 5px 10px 5px; }
        `,
      },
      {
        name: "css-with-comments",
        description: "Test CSS with comments",
        input:
          "/* Header styles */ .header { color: blue; } /* Footer styles */ .footer { color: red; }",
      },
      {
        name: "malformed-css",
        description: "Test with malformed CSS",
        input: ".test { color: red background: blue",
        shouldFail: true,
      },
    ];
  }

  /**
   * Save debug result to file
   */
  private async saveDebugResult(
    result: DebugResult,
    input: string,
  ): Promise<void> {
    if (!this.options.outputDir) return;

    try {
      await fs.mkdir(this.options.outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${result.pluginName}-${timestamp}.json`;
      const filepath = path.join(this.options.outputDir, filename);

      const debugData = {
        result,
        input,
        timestamp: new Date().toISOString(),
      };

      await fs.writeFile(filepath, JSON.stringify(debugData, null, 2));
      this.logger.debug(`Debug result saved to ${filepath}`);
    } catch (error) {
      this.logger.error("Failed to save debug result", { error });
    }
  }

  /**
   * Save test suite results
   */
  private async saveTestSuiteResults(
    plugin: EnigmaPlugin,
    testCases: TestCase[],
    results: DebugResult[],
    summary: Record<string, unknown>,
  ): Promise<void> {
    if (!this.options.outputDir) return;

    try {
      await fs.mkdir(this.options.outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `test-suite-${plugin.meta?.name}-${timestamp}.json`;
      const filepath = path.join(this.options.outputDir, filename);

      const suiteData = {
        plugin: {
          name: plugin.meta?.name,
          version: plugin.meta?.version,
          description: plugin.meta?.description,
        },
        testCases,
        results,
        summary,
        timestamp: new Date().toISOString(),
      };

      await fs.writeFile(filepath, JSON.stringify(suiteData, null, 2));
      this.logger.debug(`Test suite results saved to ${filepath}`);
    } catch (error) {
      this.logger.error("Failed to save test suite results", { error });
    }
  }

  /**
   * Generate test summary
   */
  private generateTestSummary(results: DebugResult[]): Record<string, unknown> {
    const total = results.length;
    const successful = results.filter((r) => r.success).length;
    const failed = total - successful;
    const totalExecutionTime = results.reduce(
      (sum, r) => sum + r.executionTime,
      0,
    );
    const avgExecutionTime = total > 0 ? totalExecutionTime / total : 0;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      totalExecutionTime,
      avgExecutionTime,
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
    };
  }

  /**
   * Determine winner between two plugin results
   */
  private determineWinner(resultA: DebugResult, resultB: DebugResult): string {
    // Both failed
    if (!resultA.success && !resultB.success) {
      return "both-failed";
    }

    // Only one succeeded
    if (resultA.success && !resultB.success) {
      return resultA.pluginName;
    }
    if (!resultA.success && resultB.success) {
      return resultB.pluginName;
    }

    // Both succeeded - compare performance and output quality
    const scoreA = this.calculatePluginScore(resultA);
    const scoreB = this.calculatePluginScore(resultB);

    if (scoreA > scoreB) return resultA.pluginName;
    if (scoreB > scoreA) return resultB.pluginName;
    return "tie";
  }

  /**
   * Calculate a quality score for a plugin result
   */
  private calculatePluginScore(result: DebugResult): number {
    if (!result.success) return 0;

    let score = 100;

    // Penalize longer execution times
    score -= Math.min(result.executionTime / 10, 50);

    // Penalize warnings
    score -= result.warnings.length * 5;

    // Reward memory efficiency
    if (result.memoryUsage && result.memoryUsage.delta.heapUsed < 0) {
      score += 10;
    }

    return Math.max(score, 0);
  }
}

/**
 * Create a new plugin debugger instance
 */
export function createPluginDebugger(
  options: DebugOptions = {},
): PluginDebugger {
  return new PluginDebugger(options);
}

/**
 * Quick test function for simple plugin testing
 */
export async function quickTestPlugin(
  plugin: EnigmaPlugin,
  css: string,
  projectPath: string = process.cwd(),
): Promise<DebugResult> {
  const pluginDebugger = createPluginDebugger({ verbose: true });

  const context: EnigmaPluginContext = {
    projectPath,
    filePath: "test.css",
    options: {},
    utils: {} as any, // Simplified for testing
  };

  return pluginDebugger.testPlugin(plugin, css, context);
}
