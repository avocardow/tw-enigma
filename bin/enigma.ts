#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve, basename, extname } from "path";
import {
  getConfigSync,
  createSampleConfig,
  EnigmaConfigSchema,
  type CliArguments,
  ConfigError,
} from "../src/config";
import {
  discoverFilesFromConfig,
  FileDiscoveryError,
} from "../src/fileDiscovery";
import {
  Logger,
  LogLevel,
  type FileOutputOptions,
} from "../src/logger";
import {
  createProductionOrchestrator,
  createDevelopmentOrchestrator,
  type CssBundle,
  type CssProcessingOptions,
} from "../src/output/cssOutputOrchestrator";
import {
  createProductionConfigManager,
  createPerformanceBudget,
  validateProductionConfig,
  generateConfigDocs,
  type PerformanceBudget,
} from "../src/output/cssOutputConfig";

// Get package.json for version information
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In built version, we need to go up from dist to project root
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

// Initialize CLI logger (will be reconfigured after argument parsing)
let cliLogger = new Logger({
  level: LogLevel.INFO,
  verbose: false,
  veryVerbose: false,
  quiet: false,
  colorize: process.stdout.isTTY,
  timestamp: true,
  component: "CLI",
  fileOutput: undefined,
  enableProgressTracking: true,
});

/**
 * Update logger configuration based on CLI arguments
 */
function updateLoggerFromArgv(argv: Record<string, unknown>): void {
  // Parse log level
  let level: LogLevel = LogLevel.INFO;
  if (argv.logLevel) {
    switch (argv.logLevel) {
      case "trace":
        level = LogLevel.TRACE;
        break;
      case "debug":
        level = LogLevel.DEBUG;
        break;
      case "info":
        level = LogLevel.INFO;
        break;
      case "warn":
        level = LogLevel.WARN;
        break;
      case "error":
        level = LogLevel.ERROR;
        break;
      case "fatal":
        level = LogLevel.FATAL;
        break;
    }
  } else if (argv.veryVerbose) {
    level = LogLevel.TRACE;
  } else if (argv.verbose) {
    level = LogLevel.DEBUG;
  } else if (argv.quiet) {
    level = LogLevel.WARN;
  }

  // Create file output options if specified
  let fileOutput: FileOutputOptions | undefined;
  if (argv.logFile) {
    fileOutput = {
      filePath: argv.logFile as string,
      format: (argv.logFormat as "human" | "json" | "csv") || "human",
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      compress: true,
    };
  }

  // Create new logger with updated options
  cliLogger = new Logger({
    level,
    verbose: (argv.verbose as boolean) || false,
    veryVerbose: (argv.veryVerbose as boolean) || false,
    quiet: (argv.quiet as boolean) || false,
    colorize: process.stdout.isTTY,
    timestamp: true,
    component: "CLI",
    fileOutput,
    enableProgressTracking: true,
  });
}

// Main CLI function
async function main() {
  console.log(chalk.blue("🔵 Tailwind Enigma"));

  const argv = await yargs(hideBin(process.argv))
    .scriptName("enigma")
    .usage("Usage: $0 [options]")
    .version(packageJson.version)
    .alias("version", "v")
    .option("pretty", {
      alias: "p",
      type: "boolean",
      description: "Enable pretty output formatting",
    })
    .option("config", {
      alias: "c",
      type: "string",
      description: "Path to configuration file",
    })
    .option("verbose", {
      type: "boolean",
      description: "Enable verbose logging (shows debug messages)",
    })
    .option("very-verbose", {
      type: "boolean",
      description:
        "Enable very verbose logging (shows trace messages and detailed file operations)",
    })
    .option("quiet", {
      type: "boolean",
      description: "Quiet mode (only warnings and errors)",
    })
    .option("debug", {
      type: "boolean",
      description: "Enable debug mode",
    })
    .option("log-level", {
      type: "string",
      choices: ["trace", "debug", "info", "warn", "error", "fatal"],
      description: "Set the minimum log level",
    })
    .option("log-file", {
      type: "string",
      description:
        "Write logs to file (supports JSON, CSV, or human-readable format)",
    })
    .option("log-format", {
      type: "string",
      choices: ["human", "json", "csv"],
      description: "Format for file logging (default: human)",
    })
    .option("input", {
      alias: "i",
      type: "string",
      description: "Input file or directory to process",
    })
    .option("output", {
      alias: "o",
      type: "string",
      description: "Output file or directory",
    })
    .option("minify", {
      type: "boolean",
      description: "Minify the output CSS",
    })
    .option("remove-unused", {
      type: "boolean",
      description: "Remove unused CSS classes",
    })
    .option("max-concurrency", {
      type: "number",
      description: "Maximum concurrent file processing (1-10)",
    })
    .option("class-prefix", {
      type: "string",
      description: "Prefix for generated class names",
    })
    .option("exclude-patterns", {
      type: "array",
      description: "Patterns to exclude from processing",
    })
    .option("preserve-comments", {
      type: "boolean",
      description: "Preserve CSS comments in output",
    })
    .option("source-maps", {
      type: "boolean",
      description: "Generate source maps",
    })
    .option("follow-symlinks", {
      type: "boolean",
      description: "Follow symbolic links during file discovery",
    })
    .option("max-files", {
      type: "number",
      description: "Maximum number of files to process",
    })
    .option("include-file-types", {
      type: "array",
      choices: ["HTML", "JAVASCRIPT", "CSS", "TEMPLATE"],
      description: "Specific file types to include",
    })
    .option("exclude-extensions", {
      type: "array",
      description: "File extensions to exclude",
    })
    .option("dry-run", {
      alias: "d",
      type: "boolean",
      description: "Preview changes without modifying files",
    })
    .command("init-config", "Create a sample configuration file", {}, () => {
      const sampleConfig = createSampleConfig();
      cliLogger.info("Sample configuration file content:");
      console.log(sampleConfig); // Keep raw output for config content
      cliLogger.info("Save this as enigma.config.js in your project root.");
    })
    .command(
      "css-optimize <input>",
      "Optimize CSS files with comprehensive output management",
      (yargs) => {
        return yargs
          .positional("input", {
            describe: "Input CSS file or directory",
            type: "string",
            demandOption: true,
          })
          .option("env", {
            alias: "e",
            choices: ["development", "production", "test"] as const,
            default: "production",
            description: "Target environment for optimization",
          })
          .option("strategy", {
            alias: "s",
            choices: ["single", "chunked", "modular"] as const,
            description: "Output strategy override",
          })
          .option("preset", {
            choices: ["cdn", "serverless", "spa", "ssr"] as const,
            description: "Use optimized preset for deployment target",
          })
          .option("chunk-size", {
            type: "number",
            description: "Maximum chunk size in KB",
          })
          .option("critical", {
            type: "boolean",
            description: "Enable critical CSS extraction",
          })
          .option("compress", {
            type: "boolean",
            description: "Enable compression (gzip/brotli)",
          })
          .option("budgets", {
            type: "boolean",
            description: "Enable performance budget validation",
          })
          .option("budget-max-size", {
            type: "number",
            default: 500,
            description: "Maximum total CSS size in KB",
          })
          .option("budget-max-chunks", {
            type: "number",
            default: 20,
            description: "Maximum number of chunks",
          })
          .option("routes", {
            type: "array",
            description: "Routes for critical CSS analysis",
          })
          .option("report", {
            type: "boolean",
            default: true,
            description: "Generate optimization report",
          })
          .option("force", {
            type: "boolean",
            description: "Force regeneration of output files",
          })
          .option("dry-run", {
            alias: "d",
            type: "boolean",
            description: "Preview changes without modifying files",
          });
      },
      async (argv) => {
        try {
          cliLogger.info("🎯 Starting CSS Output Optimization");

          // First, validate that the input file exists
          const inputPath = resolve(argv.input);
          try {
            const stats = statSync(inputPath);
            if (!stats.isFile()) {
              cliLogger.error(`Input path is not a file: ${inputPath}`);
              process.exit(1);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
              cliLogger.error(`Input CSS file not found: ${inputPath}`);
            } else {
              cliLogger.error("Failed to access input CSS file", {
                path: inputPath,
                error: errorMessage,
              });
            }
            process.exit(1);
          }

          // Parse CLI arguments
          const cliArgs = {
            strategy: argv.strategy,
            environment: argv.env,
            compress: argv.compress,
            "critical-css": argv.critical,
            outDir: argv.output,
            verbose: argv.verbose,
            chunkSize: argv["chunk-size"] ? argv["chunk-size"] * 1024 : undefined,
            force: argv.force,
            budgets: argv.budgets,
            dryRun: argv["dry-run"],
          };

          // Create performance budget if enabled
          let budget: PerformanceBudget | undefined;
          if (argv.budgets) {
            budget = createPerformanceBudget({
              maxTotalSize: argv["budget-max-size"] * 1024,
              maxChunks: argv["budget-max-chunks"],
            });
            cliLogger.info("📊 Performance budgets enabled", {
              maxSize: `${argv["budget-max-size"]}KB`,
              maxChunks: argv["budget-max-chunks"],
            });
          }

          // Create configuration manager and apply CLI overrides
          const configManager = createProductionConfigManager(undefined, budget);
          const config = configManager.applyCliOverrides(cliArgs);

          // Debug: Log the config object
          if (argv.verbose) {
            console.log("Generated configuration:", JSON.stringify(config, null, 2));
          }

          // Apply preset if specified
          if (argv.preset) {
            const presetConfig = configManager.createOptimizedPreset(argv.preset);
            configManager.updateConfig(presetConfig);
            cliLogger.info(`🎛️  Applied ${argv.preset} preset configuration`);
          }

          // Validate production configuration
          const validation = validateProductionConfig(config);
          if (argv.verbose) {
            console.log("Validation result:", {
              valid: validation.isValid,
              errors: validation.errors,
              warnings: validation.warnings,
              suggestions: validation.suggestions
            });
          }
          if (!validation.isValid) {
            cliLogger.error("❌ Configuration validation failed");
            validation.errors.forEach((error) => cliLogger.error(`  • ${error}`));
            if (validation.suggestions.length > 0) {
              validation.suggestions.forEach((suggestion) => cliLogger.error(`  💡 ${suggestion}`));
            }
            process.exit(1);
          }

          if (validation.warnings.length > 0) {
            validation.warnings.forEach((warning) =>
              cliLogger.warn(`⚠️  ${warning}`),
            );
          }

          if (validation.suggestions.length > 0) {
            validation.suggestions.forEach((rec) =>
              cliLogger.info(`💡 ${rec}`),
            );
          }

          // Create orchestrator
          const orchestrator =
            argv.env === "development"
              ? createDevelopmentOrchestrator(config)
              : createProductionOrchestrator(config);

          // Load CSS files (we already validated the file exists)
          const bundles: CssBundle[] = [];

          try {
            const cssContent = readFileSync(inputPath, "utf8");
            bundles.push({
              id: basename(inputPath, extname(inputPath)),
              content: cssContent,
              sourcePath: inputPath,
              routes: argv.routes as string[],
              components: [],
              priority: 1,
              metadata: {
                originalSize: Buffer.byteLength(cssContent, "utf8"),
                source: "cli",
              },
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            cliLogger.error("Failed to read input CSS file", {
              path: inputPath,
              error: errorMessage,
            });
            process.exit(1);
          }

          // Set up processing options
          const options: CssProcessingOptions = {
            environment: argv.env as "development" | "production" | "test",
            sourceMaps: argv["source-maps"] || argv.env === "development",
            outputDir: argv.output || `dist/css-${argv.env}`,
            baseUrl: "/assets/css/",
            routes: argv.routes as string[],
            verbose: argv.verbose,
          };

          // Ensure output directory exists
          try {
            mkdirSync(options.outputDir, { recursive: true });
          } catch {
            // Ignore if directory already exists
          }

          cliLogger.info("🚀 Processing CSS bundles", {
            bundles: bundles.length,
            strategy: config.strategy,
            environment: argv.env,
            outputDir: options.outputDir,
          });

          // Check if dry run mode is enabled
          if (argv["dry-run"]) {
            // Import dry run modules
            const { simulateDryRun } = await import(
              "../src/dryRun/dryRunSimulator"
            );
            const { exportReport } = await import("../src/dryRun/dryRunReport");

            cliLogger.info(
              "🏃 Running in dry run mode - no files will be modified",
            );

            // Execute the CSS optimization in dry run simulation
            const { dryRunResult } = await simulateDryRun(
              async () => {
                return await orchestrator.orchestrate(bundles, options);
              },
              {
                verbose: argv.verbose,
                includeContent: true,
                maxContentPreview: 500,
                enableMetrics: true,
                outputFormat: "markdown",
              },
            );

            // Generate and display dry run report
            const reportFormat = argv.verbose ? "markdown" : "text";
            const reportOutput = exportReport(
              dryRunResult.report,
              reportFormat as "markdown" | "text",
            );

            if (argv.verbose) {
              console.log("\n" + reportOutput);
            } else {
              // Show summary for non-verbose mode
              console.log("\n📋 Dry Run Summary:");
              console.log(
                `- Operations simulated: ${dryRunResult.statistics.totalOperations}`,
              );
              console.log(
                `- Files to create: ${dryRunResult.statistics.filesCreated}`,
              );
              console.log(
                `- Files to modify: ${dryRunResult.statistics.filesModified}`,
              );
              console.log(
                `- Total size change: ${dryRunResult.statistics.sizeImpact.netSizeChange > 0 ? "+" : ""}${Math.round(dryRunResult.statistics.sizeImpact.netSizeChange / 1024)}KB`,
              );
              console.log(`- Simulation time: ${dryRunResult.executionTime}ms`);
            }

            // Save detailed report to file if requested
            if (argv.report) {
              const reportPath = resolve(options.outputDir, "dry-run-report.md");

              // Use actual filesystem for report since this is informational
              const fullReport = exportReport(dryRunResult.report, "markdown");
              writeFileSync(reportPath, fullReport);
              cliLogger.info("📋 Dry run report saved", { path: reportPath });
            }

            // Exit with appropriate code
            if (dryRunResult.errors.length > 0) {
              cliLogger.error("❌ Dry run completed with errors");
              dryRunResult.errors.forEach((error) =>
                cliLogger.error(`  • ${error}`),
              );
              process.exit(1);
            } else {
              cliLogger.info(
                "✅ Dry run completed successfully - no actual changes made",
              );
              process.exit(0);
            }
          }

          // Run optimization
          const startTime = Date.now();
          const result = await orchestrator.orchestrate(bundles, options);
          const duration = Date.now() - startTime;

          // Validate against budgets if enabled
          if (budget) {
            const budgetResults = {
              totalSize: result.globalStats.totalOptimizedSize,
              chunkSizes: Array.from(result.results.values()).flatMap((r) =>
                r.chunks.map((c) => Buffer.byteLength(c.content, "utf8")),
              ),
              criticalSize: Array.from(result.results.values()).reduce(
                (sum, r) =>
                  sum +
                  (r.criticalCss
                    ? Buffer.byteLength(r.criticalCss.inline, "utf8")
                    : 0),
                0,
              ),
              compressionRatio: result.globalStats.overallCompressionRatio,
              loadTime: result.performanceMetrics.estimatedLoadTime,
            };

            const budgetValidation =
              configManager.validateAgainstBudgets(budgetResults);

            if (!budgetValidation.passed) {
              cliLogger.error("💰 Performance budget exceeded!");
              budgetValidation.errors.forEach((error) =>
                cliLogger.error(`  • ${error}`),
              );
            } else {
              cliLogger.info("✅ Performance budgets passed");
            }

            budgetValidation.warnings.forEach((warning) =>
              cliLogger.warn(`📊 ${warning}`),
            );
          }

          // Generate report if enabled
          if (argv.report) {
            const reportPath = resolve(
              options.outputDir,
              "optimization-report.json",
            );
            const report = {
              timestamp: new Date().toISOString(),
              configuration: config,
              results: result,
              budget: budget ? configManager.validateAgainstBudgets() : null,
              performance: result.performanceMetrics,
              duration,
              cli: cliArgs,
            };

            writeFileSync(reportPath, JSON.stringify(report, null, 2));
            cliLogger.info("📋 Optimization report generated", {
              path: reportPath,
            });
          }

          // Display results
          cliLogger.info("✨ CSS Optimization Complete", {
            duration: duration,
            totalBundles: result.globalStats.totalBundles,
            totalChunks: result.globalStats.totalChunks,
            originalSizeKB: Math.round(result.globalStats.totalSize / 1024),
            optimizedSizeKB: Math.round(result.globalStats.totalOptimizedSize / 1024),
            compressedSizeKB: Math.round(result.globalStats.totalCompressedSize / 1024),
            compressionRatio: result.globalStats.overallCompressionRatio,
            estimatedLoadTime: result.performanceMetrics.estimatedLoadTime,
            // Display formatted versions
            durationDisplay: `${duration}ms`,
            originalSizeDisplay: `${Math.round(result.globalStats.totalSize / 1024)}KB`,
            optimizedSizeDisplay: `${Math.round(result.globalStats.totalOptimizedSize / 1024)}KB`,
            compressedSizeDisplay: `${Math.round(result.globalStats.totalCompressedSize / 1024)}KB`,
            compressionRatioDisplay: `${Math.round(result.globalStats.overallCompressionRatio * 100)}%`,
            estimatedLoadTimeDisplay: `${result.performanceMetrics.estimatedLoadTime}ms`,
          });

          if (result.warnings.length > 0) {
            cliLogger.warn("⚠️  Optimization warnings:");
            result.warnings.forEach((warning) =>
              cliLogger.warn(`  • ${warning}`),
            );
          }

          cliLogger.info("📁 Output files written to:", {
            directory: options.outputDir,
          });
        } catch (error) {
          cliLogger.error("CSS optimization failed", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          process.exit(1);
        }
      },
    )
    .command(
      "css-config",
      "Generate and validate CSS output configuration",
      (yargs) => {
        return yargs
          .option("preset", {
            choices: [
              "production",
              "development",
              "cdn",
              "serverless",
              "spa",
              "ssr",
            ] as const,
            description: "Configuration preset to generate",
          })
          .option("validate", {
            type: "string",
            description: "Path to configuration file to validate",
          })
          .option("docs", {
            type: "boolean",
            description: "Generate configuration documentation",
          })
          .option("budget", {
            type: "boolean",
            description: "Include performance budget configuration",
          })
          .option("save", {
            type: "string",
            description: "Save configuration to file path",
          });
      },
      async (argv) => {
        try {
          if (argv.validate) {
            // Validate existing configuration
            const configPath = resolve(argv.validate);
            const configData = JSON.parse(readFileSync(configPath, "utf8"));
            const validation = validateProductionConfig(configData);

            if (validation.isValid) {
              cliLogger.info("✅ Configuration is valid");
            } else {
              cliLogger.error("❌ Configuration validation failed");
              validation.errors.forEach((error) =>
                cliLogger.error(`  • ${error}`),
              );
            }

            validation.warnings.forEach((warning) =>
              cliLogger.warn(`⚠️  ${warning}`),
            );
            validation.suggestions.forEach((rec) =>
              cliLogger.info(`💡 ${rec}`),
            );

            return;
          }

          // Generate configuration
          const manager = createProductionConfigManager();
          let config;

          if (argv.preset) {
            if (argv.preset === "production" || argv.preset === "development") {
              config = manager.applyPreset(argv.preset);
            } else {
              config = manager.createOptimizedPreset(
                argv.preset as "cdn" | "serverless" | "spa" | "ssr",
              );
            }
            cliLogger.info(`📋 Generated ${argv.preset} configuration preset`);
          } else {
            config = manager.getConfig();
          }

          // Add performance budget if requested
          if (argv.budget) {
            const budget = createPerformanceBudget({});
            manager.setPerformanceBudget(budget);
            cliLogger.info("📊 Added performance budget configuration");
          }

          // Generate documentation if requested
          if (argv.docs) {
            const docs = generateConfigDocs();
            console.log(docs);
          }

          // Save configuration if requested
          if (argv.save) {
            const savePath = resolve(argv.save);
            const output = {
              cssOutput: config,
              ...(argv.budget
                ? { performanceBudget: manager.getPerformanceBudget() }
                : {}),
              generated: {
                timestamp: new Date().toISOString(),
                preset: argv.preset,
                version: packageJson.version,
              },
            };

            writeFileSync(savePath, JSON.stringify(output, null, 2));
            cliLogger.info("💾 Configuration saved", { path: savePath });
          } else {
            // Display configuration
            console.log(JSON.stringify(config, null, 2));
          }
        } catch (error) {
          cliLogger.error("Configuration command failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          process.exit(1);
        }
      },
    )
    .command(
      "css-analyze <input>",
      "Analyze CSS performance and provide optimization recommendations",
      (yargs) => {
        return yargs
          .positional("input", {
            describe: "CSS file to analyze",
            type: "string",
            demandOption: true,
          })
          .option("budget", {
            type: "string",
            description: "Path to performance budget configuration",
          })
          .option("report", {
            type: "string",
            description: "Output path for analysis report",
          })
          .option("recommendations", {
            type: "boolean",
            default: true,
            description: "Include optimization recommendations",
          });
      },
      async (argv) => {
        try {
          cliLogger.info("🔍 Analyzing CSS file for optimization opportunities");

          const inputPath = resolve(argv.input);
          const cssContent = readFileSync(inputPath, "utf8");
          const originalSize = Buffer.byteLength(cssContent, "utf8");

          // Load budget if provided
          let budget: PerformanceBudget | undefined;
          if (argv.budget) {
            const budgetData = JSON.parse(readFileSync(resolve(argv.budget), "utf8"));
            budget = createPerformanceBudget(budgetData);
          }

          // Quick analysis using development orchestrator (no optimization)
          const orchestrator = createDevelopmentOrchestrator();
          const bundle: CssBundle = {
            id: basename(inputPath, extname(inputPath)),
            content: cssContent,
            sourcePath: inputPath,
            priority: 1,
          };

          const options: CssProcessingOptions = {
            environment: "test",
            sourceMaps: false,
            outputDir: "/tmp/css-analysis",
            verbose: argv.verbose,
          };

          const result = await orchestrator.orchestrate([bundle], options);

          // Generate analysis report
          const analysis = {
            file: {
              path: inputPath,
              size: originalSize,
              sizeKB: Math.round(originalSize / 1024),
            },
            optimization: {
              potentialSavings:
                originalSize - result.globalStats.totalOptimizedSize,
              compressionRatio: result.globalStats.overallCompressionRatio,
              estimatedLoadTime: result.performanceMetrics.estimatedLoadTime,
            },
            recommendations: argv.recommendations
              ? [
                  originalSize > 100 * 1024
                    ? "Consider chunking large CSS files"
                    : null,
                  result.globalStats.overallCompressionRatio < 0.3
                    ? "Enable compression for better performance"
                    : null,
                  result.performanceMetrics.estimatedLoadTime > 3000
                    ? "CSS size may impact page load time"
                    : null,
                  !result.performanceMetrics.criticalCssSize
                    ? "Consider extracting critical CSS"
                    : null,
                ].filter(Boolean)
              : [],
            budget: budget
              ? {
                  withinBudget: originalSize <= budget.maxTotalSize,
                  usage: Math.round((originalSize / budget.maxTotalSize) * 100),
                  remaining: budget.maxTotalSize - originalSize,
                }
              : null,
          };

          // Display results
          cliLogger.info("📊 CSS Analysis Results", {
            fileSize: analysis.file.sizeKB,
            potentialSavingsKB: Math.round(analysis.optimization.potentialSavings / 1024),
            estimatedLoadTime: analysis.optimization.estimatedLoadTime,
            // Display formatted versions
            fileSizeDisplay: `${analysis.file.sizeKB}KB`,
            potentialSavingsDisplay: `${Math.round(analysis.optimization.potentialSavings / 1024)}KB`,
            estimatedLoadTimeDisplay: `${analysis.optimization.estimatedLoadTime}ms`,
          });

          if (analysis.budget) {
            const status = analysis.budget.withinBudget ? "✅" : "❌";
            cliLogger.info(`${status} Budget: ${analysis.budget.usage}% used`);
          }

          if (analysis.recommendations.length > 0) {
            cliLogger.info("💡 Recommendations:");
            analysis.recommendations.forEach((rec) =>
              cliLogger.info(`  • ${rec}`),
            );
          }

          // Save report if requested
          if (argv.report) {
            const reportPath = resolve(argv.report);
            writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
            cliLogger.info("📋 Analysis report saved", { path: reportPath });
          }
        } catch (error) {
          cliLogger.error("CSS analysis failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          process.exit(1);
        }
      },
    )
    .command(
      "plugin",
      "Plugin management commands",
      (yargs) => {
        return yargs
          .command(
            "list",
            "List all available plugins",
            {
              verbose: {
                alias: "v",
                type: "boolean",
                description: "Show detailed plugin information",
              },
              health: {
                type: "boolean",
                description: "Include health status information",
              },
              disabled: {
                type: "boolean",
                description: "Show only disabled plugins",
              },
              enabled: {
                type: "boolean",
                description: "Show only enabled plugins",
              },
            },
            async (argv) => {
              try {
                cliLogger.info("📦 Listing plugins");

                // Import plugin manager
                const { createPluginManager } = await import(
                  "../src/core/pluginManager"
                );
                const pluginManager = createPluginManager();

                const plugins = pluginManager.getAllPlugins();

                if (plugins.length === 0) {
                  cliLogger.warn("No plugins found");
                  return;
                }

                cliLogger.info(`Found ${plugins.length} plugin(s)`);

                for (const plugin of plugins) {
                  let status = "✅ Enabled";
                  let healthInfo = "";

                  if (argv.health) {
                    const health = pluginManager.getPluginHealth(
                      plugin.meta.name,
                    );
                    status = health.isDisabled
                      ? "❌ Disabled"
                      : health.isHealthy
                        ? "✅ Healthy"
                        : "⚠️  Unhealthy";

                    if (!health.isHealthy) {
                      healthInfo = ` (${health.consecutiveFailures} failures, ${health.circuitState})`;
                    }

                    if (health.isDisabled && health.disabledReason) {
                      healthInfo += ` - ${health.disabledReason}`;
                    }
                  }

                  // Filter based on enabled/disabled flags
                  const isDisabled =
                    argv.health &&
                    pluginManager.getPluginHealth(plugin.meta.name).isDisabled;
                  if (argv.disabled && !isDisabled) continue;
                  if (argv.enabled && isDisabled) continue;

                  console.log(
                    `\n📦 ${plugin.meta.name} v${plugin.meta.version} ${status}${healthInfo}`,
                  );
                  console.log(`   ${plugin.meta.description}`);

                  if (argv.verbose) {
                    if (plugin.meta.author) {
                      console.log(`   Author: ${plugin.meta.author}`);
                    }
                    if (plugin.meta.repository) {
                      console.log(`   Repository: ${plugin.meta.repository}`);
                    }
                    if (plugin.dependencies && plugin.dependencies.length > 0) {
                      console.log(
                        `   Dependencies: ${plugin.dependencies.join(", ")}`,
                      );
                    }
                    if (plugin.conflicts && plugin.conflicts.length > 0) {
                      console.log(`   Conflicts: ${plugin.conflicts.join(", ")}`);
                    }
                  }
                }
              } catch (error) {
                cliLogger.error("Failed to list plugins", {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "health [plugin]",
            "Show plugin health status",
            {
              plugin: {
                type: "string",
                description: "Specific plugin name to check (optional)",
              },
              verbose: {
                alias: "v",
                type: "boolean",
                description: "Show detailed health information",
              },
            },
            async (argv) => {
              try {
                cliLogger.info("🩺 Checking plugin health");

                const { createPluginManager } = await import(
                  "../src/core/pluginManager"
                );
                const pluginManager = createPluginManager();

                if (argv.plugin) {
                  // Show health for specific plugin
                  const health = pluginManager.getPluginHealth(argv.plugin);

                  console.log(`\n🩺 Health Status: ${argv.plugin}`);
                  console.log(
                    `   Status: ${health.isHealthy ? "✅ Healthy" : "❌ Unhealthy"}`,
                  );
                  console.log(`   Circuit: ${health.circuitState}`);
                  console.log(`   Errors: ${health.errorCount}`);
                  console.log(
                    `   Success Rate: ${(health.successRate * 100).toFixed(1)}%`,
                  );
                  console.log(
                    `   Consecutive Failures: ${health.consecutiveFailures}`,
                  );

                  if (health.isDisabled) {
                    console.log(
                      `   Disabled: ${health.disabledReason || "Unknown reason"}`,
                    );
                  }

                  if (argv.verbose && health.recentErrors.length > 0) {
                    console.log(`   Recent Errors:`);
                    health.recentErrors.slice(0, 3).forEach((error: { message: string; category: string }, i: number) => {
                      console.log(
                        `     ${i + 1}. ${error.message} (${error.category})`,
                      );
                    });
                  }
                } else {
                  // Show health for all plugins
                  const allHealth = pluginManager.getAllPluginHealth();

                  if (allHealth.length === 0) {
                    cliLogger.warn("No plugins to check");
                    return;
                  }

                  const healthy = allHealth.filter(
                    (h) => h.isHealthy && !h.isDisabled,
                  );
                  const unhealthy = allHealth.filter(
                    (h) => !h.isHealthy && !h.isDisabled,
                  );
                  const disabled = allHealth.filter((h) => h.isDisabled);

                  console.log(`\n🩺 Plugin Health Summary:`);
                  console.log(`   Healthy: ${healthy.length} ✅`);
                  console.log(`   Unhealthy: ${unhealthy.length} ⚠️`);
                  console.log(`   Disabled: ${disabled.length} ❌`);

                  if (argv.verbose) {
                    if (unhealthy.length > 0) {
                      console.log(`\n⚠️  Unhealthy Plugins:`);
                      unhealthy.forEach((health) => {
                        console.log(
                          `   • ${health.pluginName}: ${health.consecutiveFailures} failures, ${health.circuitState}`,
                        );
                      });
                    }

                    if (disabled.length > 0) {
                      console.log(`\n❌ Disabled Plugins:`);
                      disabled.forEach((health) => {
                        console.log(
                          `   • ${health.pluginName}: ${health.disabledReason || "Unknown reason"}`,
                        );
                      });
                    }
                  }
                }
              } catch (error) {
                cliLogger.error("Failed to check plugin health", {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "enable <plugin>",
            "Enable a disabled plugin",
            {
              plugin: {
                type: "string",
                description: "Plugin name to enable",
                demandOption: true,
              },
            },
            async (argv) => {
              try {
                cliLogger.info(`🔓 Enabling plugin: ${argv.plugin}`);

                const { createPluginManager } = await import(
                  "../src/core/pluginManager"
                );
                const pluginManager = createPluginManager();

                if (!pluginManager.hasPlugin(argv.plugin)) {
                  cliLogger.error(`Plugin "${argv.plugin}" not found`);
                  process.exit(1);
                }

                pluginManager.enablePlugin(argv.plugin);
                cliLogger.info(`✅ Plugin "${argv.plugin}" enabled successfully`);
              } catch (error) {
                cliLogger.error(`Failed to enable plugin "${argv.plugin}"`, {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "disable <plugin>",
            "Disable a plugin",
            {
              plugin: {
                type: "string",
                description: "Plugin name to disable",
                demandOption: true,
              },
              reason: {
                alias: "r",
                type: "string",
                description: "Reason for disabling the plugin",
              },
            },
            async (argv) => {
              try {
                cliLogger.info(`🔒 Disabling plugin: ${argv.plugin}`);

                const { createPluginManager } = await import(
                  "../src/core/pluginManager"
                );
                const pluginManager = createPluginManager();

                if (!pluginManager.hasPlugin(argv.plugin)) {
                  cliLogger.error(`Plugin "${argv.plugin}" not found`);
                  process.exit(1);
                }

                const reason = argv.reason || "Manually disabled via CLI";
                pluginManager.disablePlugin(argv.plugin, reason);
                cliLogger.info(
                  `🔒 Plugin "${argv.plugin}" disabled successfully`,
                );
              } catch (error) {
                cliLogger.error(`Failed to disable plugin "${argv.plugin}"`, {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "discover [paths..]",
            "Discover plugins from specified paths",
            {
              paths: {
                type: "array",
                description: "Paths to search for plugins",
              },
              "include-npm": {
                type: "boolean",
                description: "Include npm package discovery",
              },
              "include-builtin": {
                type: "boolean",
                default: true,
                description: "Include built-in plugins",
              },
              register: {
                type: "boolean",
                description: "Automatically register discovered plugins",
              },
            },
            async (argv) => {
              try {
                cliLogger.info("🔍 Discovering plugins");

                const { createPluginManager, createDefaultDiscoveryOptions } =
                  await import("../src/core/pluginManager");
                const pluginManager = createPluginManager();

                const options = createDefaultDiscoveryOptions();

                if (argv.paths && argv.paths.length > 0) {
                  options.searchPaths = argv.paths as string[];
                }

                options.includeBuiltins = argv["include-builtin"];

                if (argv["include-npm"]) {
                  options.npmPrefixes = ["enigma-plugin-", "postcss-enigma-"];
                } else {
                  options.npmPrefixes = [];
                }

                const discovered = await pluginManager.discoverPlugins(options);

                cliLogger.info(
                  `🔍 Discovery completed: ${discovered.length} plugins found`,
                );

                if (discovered.length === 0) {
                  cliLogger.warn("No plugins discovered");
                  return;
                }

                discovered.forEach((plugin) => {
                  console.log(`�� ${plugin.meta.name} v${plugin.meta.version}`);
                  console.log(`   ${plugin.meta.description}`);
                });

                if (argv.register) {
                  cliLogger.info("📋 Registering discovered plugins");
                  discovered.forEach((plugin) => {
                    try {
                      pluginManager.register(plugin);
                      cliLogger.debug(`Registered: ${plugin.meta.name}`);
                    } catch (error) {
                      cliLogger.warn(`Failed to register ${plugin.meta.name}`, {
                        error:
                          error instanceof Error ? error.message : String(error),
                      });
                    }
                  });
                  cliLogger.info("✅ Plugin registration completed");
                }
              } catch (error) {
                cliLogger.error("Plugin discovery failed", {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "test [plugin]",
            "Test plugin functionality",
            {
              plugin: {
                type: "string",
                description: "Specific plugin to test (optional)",
              },
              timeout: {
                type: "number",
                default: 30000,
                description: "Test timeout in milliseconds",
              },
              verbose: {
                alias: "v",
                type: "boolean",
                description: "Show detailed test output",
              },
            },
            async (argv) => {
              try {
                cliLogger.info("🧪 Testing plugin functionality");

                const { createPluginManager } = await import(
                  "../src/core/pluginManager"
                );
                const pluginManager = createPluginManager();

                const plugins = argv.plugin
                  ? [argv.plugin]
                  : pluginManager.getAllPlugins().map((p) => p.meta.name);

                if (plugins.length === 0) {
                  cliLogger.warn("No plugins to test");
                  return;
                }

                for (const pluginName of plugins) {
                  if (!pluginManager.hasPlugin(pluginName)) {
                    cliLogger.warn(`Plugin "${pluginName}" not found, skipping`);
                    continue;
                  }

                  console.log(`\n🧪 Testing: ${pluginName}`);

                  try {
                    // Basic health check
                    const health = pluginManager.getPluginHealth(pluginName);
                    console.log(
                      `   Health: ${health.isHealthy ? "✅ Healthy" : "❌ Unhealthy"}`,
                    );

                    if (health.isDisabled) {
                      console.log(
                        `   Status: ❌ Disabled (${health.disabledReason})`,
                      );
                      continue;
                    }

                    // Test plugin execution
                    const startTime = Date.now();
                    await pluginManager.executePlugin(
                      pluginName,
                      async () => {
                        // Simple test operation
                        return { success: true, test: true };
                      },
                      {
                        timeout: argv.timeout,
                        sandbox: true,
                        retryOnFailure: false,
                      },
                    );

                    const duration = Date.now() - startTime;
                    console.log(`   Execution: ✅ Success (${duration}ms)`);

                    if (argv.verbose) {
                      const resourceStats =
                        pluginManager.getResourceStats()[pluginName];
                      if (resourceStats) {
                        console.log(
                          `   Memory: ${Math.round(resourceStats.memoryUsage / 1024)}KB`,
                        );
                        console.log(
                          `   Last Execution: ${resourceStats.executionTime}ms`,
                        );
                      }
                    }
                  } catch (error) {
                    console.log(`   Execution: ❌ Failed`);
                    if (argv.verbose) {
                      console.log(
                        `   Error: ${error instanceof Error ? error.message : String(error)}`,
                      );
                    }
                  }
                }

                cliLogger.info("🧪 Plugin testing completed");
              } catch (error) {
                cliLogger.error("Plugin testing failed", {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .demandCommand(1, "Please specify a plugin command")
          .help();
      },
      () => {
        // This handler runs when no subcommand is provided
        cliLogger.error(
          "Please specify a plugin command (list, health, enable, disable, discover, test)",
        );
        process.exit(1);
      },
    )
    .command(
      "marketplace <command>",
      "Plugin marketplace operations",
      (yargs) => {
        return yargs
          .command(
            "search [query]",
            "Search for plugins in the marketplace",
            (yargs) => {
              return yargs
                .positional("query", {
                  describe: "Search query for plugins",
                  type: "string",
                })
                .option("tags", {
                  type: "array",
                  description: "Filter by tags",
                })
                .option("author", {
                  type: "string",
                  description: "Filter by author",
                })
                .option("verified", {
                  type: "boolean",
                  description: "Show only verified plugins",
                })
                .option("min-rating", {
                  type: "number",
                  description: "Minimum rating filter",
                })
                .option("sort", {
                  choices: ["downloads", "rating", "updated", "name"] as const,
                  default: "downloads",
                  description: "Sort results by",
                })
                .option("order", {
                  choices: ["asc", "desc"] as const,
                  default: "desc",
                  description: "Sort order",
                })
                .option("limit", {
                  type: "number",
                  default: 20,
                  description: "Maximum number of results",
                });
            },
            async (argv) => {
              try {
                cliLogger.info("🔍 Searching marketplace for plugins");

                // Import marketplace modules
                const { createPluginRegistry } = await import(
                  "../src/registry/pluginRegistry"
                );
                const { createPluginMarketplace } = await import(
                  "../src/marketplace/pluginMarketplace"
                );

                // Create registry and marketplace
                const registry = createPluginRegistry();
                const marketplace = createPluginMarketplace(registry);

                // Search for plugins
                const results = await marketplace.searchPlugins({
                  query: argv.query,
                  tags: argv.tags as string[],
                  author: argv.author,
                  verified: argv.verified,
                  minRating: argv["min-rating"],
                  sortBy: argv.sort as "name" | "downloads" | "rating" | "updated",
                  sortOrder: argv.order as "asc" | "desc",
                  limit: argv.limit,
                });

                if (results.length === 0) {
                  cliLogger.info("No plugins found matching your criteria");
                  return;
                }

                console.log(`\n📦 Found ${results.length} plugin(s):\n`);

                for (const plugin of results) {
                  console.log(`🔌 ${plugin.name} v${plugin.version}`);
                  console.log(`   ${plugin.description}`);
                  console.log(`   👤 Author: ${plugin.author}`);
                  console.log(
                    `   ⭐ Rating: ${plugin.rating}/5 (${plugin.downloads} downloads)`,
                  );
                  console.log(`   🏷️  Tags: ${plugin.tags.join(", ")}`);
                  console.log(
                    `   ${plugin.verified ? "✅ Verified" : "⚠️  Unverified"}`,
                  );
                  console.log(`   📅 Updated: ${plugin.lastUpdated}`);
                  console.log("");
                }
              } catch (error) {
                cliLogger.error("Marketplace search failed", {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "install <name>",
            "Install a plugin from the marketplace",
            (yargs) => {
              return yargs
                .positional("name", {
                  describe: "Plugin name to install",
                  type: "string",
                  demandOption: true,
                })
                .option("version", {
                  type: "string",
                  description: "Specific version to install",
                })
                .option("force", {
                  type: "boolean",
                  description: "Force reinstall if already installed",
                })
                .option("skip-deps", {
                  type: "boolean",
                  description: "Skip dependency installation",
                })
                .option("install-path", {
                  type: "string",
                  description: "Custom installation path",
                });
            },
            async (argv) => {
              try {
                cliLogger.info(`📦 Installing plugin: ${argv.name}`);

                // Import marketplace modules
                const { createPluginRegistry } = await import(
                  "../src/registry/pluginRegistry"
                );
                const { createPluginMarketplace } = await import(
                  "../src/marketplace/pluginMarketplace"
                );

                // Create registry and marketplace
                const registry = createPluginRegistry();
                const marketplace = createPluginMarketplace(registry);

                // Install plugin
                const plugin = await marketplace.installPlugin(argv.name, {
                  version: argv.version,
                  force: argv.force,
                  skipDependencies: argv["skip-deps"],
                  installPath: argv["install-path"],
                });

                console.log(
                  `\n✅ Successfully installed ${plugin.meta.name} v${plugin.meta.version}`,
                );
                console.log(`   📝 ${plugin.meta.description}`);
                console.log(`   👤 Author: ${plugin.meta.author}`);

                if (plugin.meta.tags && plugin.meta.tags.length > 0) {
                  console.log(`   🏷️  Tags: ${plugin.meta.tags.join(", ")}`);
                }
              } catch (error) {
                cliLogger.error("Plugin installation failed", {
                  plugin: argv.name,
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "uninstall <name>",
            "Uninstall a plugin",
            (yargs) => {
              return yargs
                .positional("name", {
                  describe: "Plugin name to uninstall",
                  type: "string",
                  demandOption: true,
                })
                .option("version", {
                  type: "string",
                  description: "Specific version to uninstall",
                });
            },
            async (argv) => {
              try {
                cliLogger.info(`🗑️  Uninstalling plugin: ${argv.name}`);

                // Import marketplace modules
                const { createPluginRegistry } = await import(
                  "../src/registry/pluginRegistry"
                );
                const { createPluginMarketplace } = await import(
                  "../src/marketplace/pluginMarketplace"
                );

                // Create registry and marketplace
                const registry = createPluginRegistry();
                const marketplace = createPluginMarketplace(registry);

                // Uninstall plugin
                await marketplace.uninstallPlugin(argv.name, argv.version);

                console.log(
                  `\n✅ Successfully uninstalled ${argv.name}${argv.version ? ` v${argv.version}` : ""}`,
                );
              } catch (error) {
                cliLogger.error("Plugin uninstallation failed", {
                  plugin: argv.name,
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "update [name]",
            "Update plugins to latest versions",
            (yargs) => {
              return yargs.positional("name", {
                describe: "Plugin name to update (updates all if not specified)",
                type: "string",
              });
            },
            async (argv) => {
              try {
                // Import marketplace modules
                const { createPluginRegistry } = await import(
                  "../src/registry/pluginRegistry"
                );
                const { createPluginMarketplace } = await import(
                  "../src/marketplace/pluginMarketplace"
                );

                // Create registry and marketplace
                const registry = createPluginRegistry();
                const marketplace = createPluginMarketplace(registry);

                if (argv.name) {
                  // Update specific plugin
                  cliLogger.info(`🔄 Updating plugin: ${argv.name}`);

                  const updatedPlugin = await marketplace.updatePlugin(argv.name);

                  if (updatedPlugin) {
                    console.log(
                      `\n✅ Updated ${updatedPlugin.meta.name} to v${updatedPlugin.meta.version}`,
                    );
                  } else {
                    console.log(`\n✅ ${argv.name} is already up to date`);
                  }
                } else {
                  // Update all plugins
                  cliLogger.info("🔄 Checking for plugin updates");

                  const installedPlugins =
                    await marketplace.listInstalledPlugins();
                  const updatesAvailable = installedPlugins.filter(
                    (p) => p.updateAvailable,
                  );

                  if (updatesAvailable.length === 0) {
                    console.log("\n✅ All plugins are up to date");
                    return;
                  }

                  console.log(
                    `\n📦 Found ${updatesAvailable.length} plugin(s) with updates available:\n`,
                  );

                  for (const pluginInfo of updatesAvailable) {
                    const plugin = pluginInfo.plugin;
                    const marketplace_info = pluginInfo.marketplaceInfo;

                    console.log(`🔌 ${plugin.meta.name}`);
                    console.log(`   Current: v${plugin.meta.version}`);
                    console.log(
                      `   Latest: v${marketplace_info?.version || "unknown"}`,
                    );

                    try {
                      await marketplace.updatePlugin(
                        plugin.meta.name,
                      );
                      console.log(`   ✅ Updated successfully`);
                    } catch (error) {
                      console.log(
                        `   ❌ Update failed: ${error instanceof Error ? error.message : String(error)}`,
                      );
                    }
                    console.log("");
                  }
                }
              } catch (error) {
                cliLogger.error("Plugin update failed", {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "list",
            "List installed plugins with marketplace info",
            {},
            async (_argv) => {
              try {
                cliLogger.info("📋 Listing installed plugins");

                // Import marketplace modules
                const { createPluginRegistry } = await import(
                  "../src/registry/pluginRegistry"
                );
                const { createPluginMarketplace } = await import(
                  "../src/marketplace/pluginMarketplace"
                );

                // Create registry and marketplace
                const registry = createPluginRegistry();
                const marketplace = createPluginMarketplace(registry);

                // Get installed plugins with marketplace info
                const installedPlugins = await marketplace.listInstalledPlugins();

                if (installedPlugins.length === 0) {
                  console.log("\n📦 No plugins installed");
                  console.log(
                    "   Use 'enigma marketplace search' to find plugins",
                  );
                  console.log(
                    "   Use 'enigma marketplace install <name>' to install plugins",
                  );
                  return;
                }

                console.log(
                  `\n📦 Installed plugins (${installedPlugins.length}):\n`,
                );

                for (const pluginInfo of installedPlugins) {
                  const plugin = pluginInfo.plugin;
                  const marketplace_info = pluginInfo.marketplaceInfo;

                  console.log(`🔌 ${plugin.meta.name} v${plugin.meta.version}`);
                  console.log(`   📝 ${plugin.meta.description}`);
                  console.log(`   👤 Author: ${plugin.meta.author}`);

                  if (marketplace_info) {
                    console.log(
                      `   ⭐ Rating: ${marketplace_info.rating}/5 (${marketplace_info.downloads} downloads)`,
                    );
                    console.log(
                      `   ${marketplace_info.verified ? "✅ Verified" : "⚠️  Unverified"}`,
                    );

                    if (pluginInfo.updateAvailable) {
                      console.log(
                        `   🔄 Update available: v${marketplace_info.version}`,
                      );
                    } else {
                      console.log(`   ✅ Up to date`);
                    }
                  } else {
                    console.log(`   📦 Local plugin (not in marketplace)`);
                  }

                  console.log("");
                }
              } catch (error) {
                cliLogger.error("Failed to list installed plugins", {
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .command(
            "info <name>",
            "Get detailed information about a plugin",
            (yargs) => {
              return yargs
                .positional("name", {
                  describe: "Plugin name to get info for",
                  type: "string",
                  demandOption: true,
                })
                .option("version", {
                  type: "string",
                  description: "Specific version to get info for",
                });
            },
            async (argv) => {
              try {
                cliLogger.info(`ℹ️  Getting plugin info: ${argv.name}`);

                // Import marketplace modules
                const { createPluginRegistry } = await import(
                  "../src/registry/pluginRegistry"
                );
                const { createPluginMarketplace } = await import(
                  "../src/marketplace/pluginMarketplace"
                );

                // Create registry and marketplace
                const registry = createPluginRegistry();
                const marketplace = createPluginMarketplace(registry);

                // Get plugin info
                const pluginInfo = await marketplace.getPluginInfo(
                  argv.name,
                  argv.version,
                );

                if (!pluginInfo) {
                  console.log(
                    `\n❌ Plugin "${argv.name}" not found in marketplace`,
                  );
                  return;
                }

                console.log(`\n🔌 ${pluginInfo.name} v${pluginInfo.version}`);
                console.log(`📝 ${pluginInfo.description}`);
                console.log(`👤 Author: ${pluginInfo.author}`);
                console.log(
                  `⭐ Rating: ${pluginInfo.rating}/5 (${pluginInfo.downloads} downloads)`,
                );
                console.log(`📦 Size: ${Math.round(pluginInfo.size / 1024)}KB`);
                console.log(`📄 License: ${pluginInfo.license}`);
                console.log(
                  `${pluginInfo.verified ? "✅ Verified" : "⚠️  Unverified"}`,
                );
                console.log(`📅 Last Updated: ${pluginInfo.lastUpdated}`);

                if (pluginInfo.tags.length > 0) {
                  console.log(`🏷️  Tags: ${pluginInfo.tags.join(", ")}`);
                }

                if (pluginInfo.dependencies.length > 0) {
                  console.log(
                    `🔗 Dependencies: ${pluginInfo.dependencies.join(", ")}`,
                  );
                }

                if (pluginInfo.homepage) {
                  console.log(`🏠 Homepage: ${pluginInfo.homepage}`);
                }

                if (pluginInfo.repository) {
                  console.log(`📂 Repository: ${pluginInfo.repository}`);
                }

                // Check if installed
                const installedPlugin = registry.getPlugin(
                  pluginInfo.name,
                  pluginInfo.version,
                );
                if (installedPlugin) {
                  console.log(`\n✅ This plugin is installed`);
                } else {
                  console.log(
                    `\n📦 Use 'enigma marketplace install ${pluginInfo.name}' to install`,
                  );
                }
              } catch (error) {
                cliLogger.error("Failed to get plugin info", {
                  plugin: argv.name,
                  error: error instanceof Error ? error.message : String(error),
                });
                process.exit(1);
              }
            },
          )
          .demandCommand(1, "Please specify a marketplace command")
          .help();
      },
      () => {
        // This handler runs when no subcommand is provided
        cliLogger.error(
          "Please specify a marketplace command (search, install, uninstall, update, list, info)",
        );
        process.exit(1);
      },
    )
    .help()
    .alias("help", "h")
    .parseAsync();

  // Convert kebab-case arguments to camelCase for configuration
  const cliArgs: CliArguments = {
    pretty: argv.pretty,
    config: argv.config,
    verbose: argv.verbose,
    veryVerbose: argv["very-verbose"],
    quiet: argv.quiet,
    debug: argv.debug,
    logLevel: argv["log-level"] as "error" | "debug" | "trace" | "info" | "warn" | "fatal" | undefined,
    logFile: argv["log-file"],
    logFormat: argv["log-format"] as "human" | "json" | "csv" | undefined,
    input: argv.input,
    output: argv.output,
    minify: argv.minify,
    removeUnused: argv["remove-unused"],
    maxConcurrency: argv["max-concurrency"],
    classPrefix: argv["class-prefix"],
    excludePatterns: argv["exclude-patterns"] as string[],
    followSymlinks: argv["follow-symlinks"],
    maxFiles: argv["max-files"],
    includeFileTypes: argv["include-file-types"] as (
      | "HTML"
      | "JAVASCRIPT"
      | "CSS"
      | "TEMPLATE"
    )[],
    excludeExtensions: argv["exclude-extensions"] as string[],
    preserveComments: argv["preserve-comments"],
    sourceMaps: argv["source-maps"],
    dryRun: argv["dry-run"],
  };

  // Update logger configuration based on parsed arguments
  updateLoggerFromArgv(argv);

  try {
    // Load and merge configuration from all sources
    const configResult = getConfigSync(cliArgs);

    // Configure logger based on CLI arguments and config
    if (argv.debug || configResult.debug) {
      cliLogger.setLevel(LogLevel.DEBUG);
      cliLogger.debug("Debug mode enabled");
      cliLogger.debug("Final configuration:", configResult);
    } else if (argv.verbose || configResult.verbose) {
      cliLogger.setLevel(LogLevel.INFO);
    }

    cliLogger.info("Configuration loaded successfully");
    if (configResult.input) {
      cliLogger.info("Input configured", { input: configResult.input });
    }
    if (configResult.output) {
      cliLogger.info("Output configured", { output: configResult.output });
    }

    // Main processing logic would go here
    if (configResult.pretty) {
      cliLogger.info(
        "Pretty mode enabled - output will be formatted for readability",
      );
    }

    // File discovery
    if (configResult.input) {
      try {
        const discoveryResult = discoverFilesFromConfig(configResult);

        cliLogger.info("File Discovery Results", {
          count: discoveryResult.count,
          duration: discoveryResult.duration,
        });

        if (Object.keys(discoveryResult.breakdown).length > 0) {
          cliLogger.debug("File type breakdown", discoveryResult.breakdown);
        }

        if (discoveryResult.emptyPatterns.length > 0) {
          cliLogger.warn("No files found for patterns", {
            patterns: discoveryResult.emptyPatterns,
          });
        }

        if (configResult.debug) {
          cliLogger.debug("Files found", { files: discoveryResult.files });
        }

        if (discoveryResult.count === 0) {
          cliLogger.warn("No files found matching the specified patterns");
          cliLogger.info("Patterns searched", {
            patterns: Array.isArray(configResult.input)
              ? configResult.input
              : [configResult.input],
          });
        } else {
          cliLogger.info("Files ready for processing", {
            count: discoveryResult.count,
          });
        }
      } catch (error) {
        if (error instanceof FileDiscoveryError) {
          cliLogger.error("File Discovery Error", {
            message: error.message,
            patterns: error.patterns,
          });
          process.exit(1);
        } else {
          throw error; // Re-throw unexpected errors
             }
   }
 }

    // For now, just display the configuration for demonstration
    cliLogger.info("Tailwind Enigma is ready to optimize your CSS!");

    if (!argv.input && !argv._.length) {
      cliLogger.info("Tip: Use --input to specify files to process");
      cliLogger.info(
        "Tip: Run 'enigma init-config' to create a sample configuration file",
      );
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      // Log the config error but continue with defaults for missing files
      cliLogger.info("Failed to load configuration file", {
        message: error.message,
        filepath: error.filepath,
      });
      
      // Try to get a default config and continue
      try {
        EnigmaConfigSchema.parse({});
        cliLogger.info("Configuration loaded successfully");
        cliLogger.info("Tailwind Enigma is ready to optimize your CSS!");
        
        if (!argv.input && !argv._.length) {
          cliLogger.info("Tip: Use --input to specify files to process");
          cliLogger.info(
            "Tip: Run 'enigma init-config' to create a sample configuration file",
          );
        }
      } catch (defaultError) {
        cliLogger.fatal("Failed to create default configuration", {
          message: defaultError instanceof Error ? defaultError.message : String(defaultError),
        });
        process.exit(1);
      }
    } else {
      cliLogger.fatal("Unexpected Error", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  }
}

// Call the main function and handle any errors
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
