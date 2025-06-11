#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  getConfigSync,
  ConfigError,
  createSampleConfig,
} from "../src/config.js";
import {
  discoverFilesFromConfig,
  FileDiscoveryError,
} from "../src/fileDiscovery.js";
import { createLogger, LogLevel } from "../src/logger.js";
import {
  createCssOutputOrchestrator,
  createProductionOrchestrator,
  createDevelopmentOrchestrator,
  type CssBundle,
  type CssProcessingOptions,
} from "../src/output/cssOutputOrchestrator.js";
import {
  createProductionConfigManager,
  parseCliArgs,
  createPerformanceBudget,
  validateProductionConfig,
  generateConfigDocs,
  type CliArgs,
  type PerformanceBudget,
} from "../src/output/cssOutputConfig.js";
import { readFileSync as readFile, writeFileSync, mkdirSync } from "fs";
import { resolve, extname, basename } from "path";
import type { CliArguments } from "../src/config.js";

// Get package.json for version information
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In built version, we need to go up from dist/bin to project root
const packageJsonPath = join(__dirname, "..", "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

// Initialize CLI logger
const cliLogger = createLogger('CLI');

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
    description: "Enable verbose logging",
  })
  .option("debug", {
    type: "boolean",
    description: "Enable debug mode",
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
        
        // Parse CLI arguments
        const cliArgs: CliArgs = parseCliArgs({
          strategy: argv.strategy,
          env: argv.env,
          compress: argv.compress,
          critical: argv.critical,
          outDir: argv.output,
          verbose: argv.verbose,
          chunkSize: argv["chunk-size"] ? argv["chunk-size"] * 1024 : undefined,
          force: argv.force,
          budgets: argv.budgets,
          dryRun: argv["dry-run"],
        });
        
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
        
        // Apply preset if specified
        if (argv.preset) {
          const presetConfig = configManager.createOptimizedPreset(argv.preset);
          configManager.updateConfig(presetConfig);
          cliLogger.info(`🎛️  Applied ${argv.preset} preset configuration`);
        }
        
        // Validate production configuration
        const validation = validateProductionConfig(config);
        if (!validation.valid) {
          cliLogger.error("❌ Configuration validation failed");
          validation.errors.forEach(error => cliLogger.error(`  • ${error}`));
          process.exit(1);
        }
        
        if (validation.warnings.length > 0) {
          validation.warnings.forEach(warning => cliLogger.warn(`⚠️  ${warning}`));
        }
        
        if (validation.recommendations.length > 0) {
          validation.recommendations.forEach(rec => cliLogger.info(`💡 ${rec}`));
        }
        
        // Create orchestrator
        const orchestrator = argv.env === "development"
          ? createDevelopmentOrchestrator(config)
          : createProductionOrchestrator(config);
        
        // Load CSS files
        const inputPath = resolve(argv.input);
        const bundles: CssBundle[] = [];
        
        try {
          const cssContent = readFile(inputPath, "utf8");
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
          cliLogger.error("Failed to read input CSS file", {
            path: inputPath,
            error: error instanceof Error ? error.message : String(error),
          });
          process.exit(1);
        }
        
        // Set up processing options
        const options: CssProcessingOptions = {
          environment: argv.env as 'development' | 'production' | 'test',
          sourceMaps: argv["source-maps"] || argv.env === "development",
          outputDir: argv.output || `dist/css-${argv.env}`,
          baseUrl: "/assets/css/",
          routes: argv.routes as string[],
          verbose: argv.verbose,
        };
        
        // Ensure output directory exists
        try {
          mkdirSync(options.outputDir, { recursive: true });
        } catch (error) {
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
          const { simulateDryRun } = await import('../src/dryRun/dryRunSimulator');
          const { exportReport } = await import('../src/dryRun/dryRunReport');
          
          cliLogger.info("🏃 Running in dry run mode - no files will be modified");
          
          // Execute the CSS optimization in dry run simulation
          const { result, dryRunResult } = await simulateDryRun(async () => {
            return await orchestrator.orchestrate(bundles, options);
          }, {
            verbose: argv.verbose,
            includeContent: true,
            maxContentPreview: 500,
            enableMetrics: true,
            outputFormat: 'markdown'
          });
          
          // Generate and display dry run report
          const reportFormat = argv.verbose ? 'markdown' : 'text';
          const reportOutput = exportReport(dryRunResult.report, reportFormat as any);
          
          if (argv.verbose) {
            console.log('\n' + reportOutput);
          } else {
            // Show summary for non-verbose mode
            console.log('\n📋 Dry Run Summary:');
            console.log(`- Operations simulated: ${dryRunResult.statistics.totalOperations}`);
            console.log(`- Files to create: ${dryRunResult.statistics.filesCreated}`);
            console.log(`- Files to modify: ${dryRunResult.statistics.filesModified}`);
            console.log(`- Total size change: ${dryRunResult.statistics.sizeImpact.netSizeChange > 0 ? '+' : ''}${Math.round(dryRunResult.statistics.sizeImpact.netSizeChange / 1024)}KB`);
            console.log(`- Simulation time: ${dryRunResult.executionTime}ms`);
          }
          
          // Save detailed report to file if requested
          if (argv.report) {
            const reportPath = resolve(options.outputDir, "dry-run-report.md");
            const fs = require('fs');
            
            // Use actual filesystem for report since this is informational
            const fullReport = exportReport(dryRunResult.report, 'markdown');
            fs.writeFileSync(reportPath, fullReport);
            cliLogger.info("📋 Dry run report saved", { path: reportPath });
          }
          
          // Exit with appropriate code
          if (dryRunResult.errors.length > 0) {
            cliLogger.error("❌ Dry run completed with errors");
            dryRunResult.errors.forEach(error => cliLogger.error(`  • ${error}`));
            process.exit(1);
          } else {
            cliLogger.info("✅ Dry run completed successfully - no actual changes made");
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
            chunkSizes: Array.from(result.results.values()).flatMap(r => 
              r.chunks.map(c => Buffer.byteLength(c.content, "utf8"))
            ),
            criticalSize: Array.from(result.results.values()).reduce((sum, r) => 
              sum + (r.criticalCss ? Buffer.byteLength(r.criticalCss.inline, "utf8") : 0), 0
            ),
            compressionRatio: result.globalStats.overallCompressionRatio,
            loadTime: result.performanceMetrics.estimatedLoadTime,
          };
          
          const budgetValidation = configManager.validateAgainstBudgets(budgetResults);
          
          if (!budgetValidation.passed) {
            cliLogger.error("💰 Performance budget exceeded!");
            budgetValidation.errors.forEach(error => cliLogger.error(`  • ${error}`));
          } else {
            cliLogger.info("✅ Performance budgets passed");
          }
          
          budgetValidation.warnings.forEach(warning => cliLogger.warn(`📊 ${warning}`));
        }
        
        // Generate report if enabled
        if (argv.report) {
          const reportPath = resolve(options.outputDir, "optimization-report.json");
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
          cliLogger.info("📋 Optimization report generated", { path: reportPath });
        }
        
        // Display results
        cliLogger.info("✨ CSS Optimization Complete", {
          duration: `${duration}ms`,
          totalBundles: result.globalStats.totalBundles,
          totalChunks: result.globalStats.totalChunks,
          originalSize: `${Math.round(result.globalStats.totalSize / 1024)}KB`,
          optimizedSize: `${Math.round(result.globalStats.totalOptimizedSize / 1024)}KB`,
          compressedSize: `${Math.round(result.globalStats.totalCompressedSize / 1024)}KB`,
          compressionRatio: `${Math.round(result.globalStats.overallCompressionRatio * 100)}%`,
          estimatedLoadTime: `${result.performanceMetrics.estimatedLoadTime}ms`,
        });
        
        if (result.warnings.length > 0) {
          cliLogger.warn("⚠️  Optimization warnings:");
          result.warnings.forEach(warning => cliLogger.warn(`  • ${warning}`));
        }
        
        cliLogger.info("📁 Output files written to:", { directory: options.outputDir });
        
      } catch (error) {
        cliLogger.error("CSS optimization failed", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
      }
    }
  )
  .command(
    "css-config",
    "Generate and validate CSS output configuration",
    (yargs) => {
      return yargs
        .option("preset", {
          choices: ["production", "development", "cdn", "serverless", "spa", "ssr"] as const,
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
          const configData = JSON.parse(readFile(configPath, "utf8"));
          const validation = validateProductionConfig(configData);
          
          if (validation.valid) {
            cliLogger.info("✅ Configuration is valid");
          } else {
            cliLogger.error("❌ Configuration validation failed");
            validation.errors.forEach(error => cliLogger.error(`  • ${error}`));
          }
          
          validation.warnings.forEach(warning => cliLogger.warn(`⚠️  ${warning}`));
          validation.recommendations.forEach(rec => cliLogger.info(`💡 ${rec}`));
          
          return;
        }
        
        // Generate configuration
        const manager = createProductionConfigManager();
        let config;
        
        if (argv.preset) {
          if (argv.preset === "production" || argv.preset === "development") {
            config = manager.applyPreset(argv.preset);
          } else {
            config = manager.createOptimizedPreset(argv.preset as "cdn" | "serverless" | "spa" | "ssr");
          }
          cliLogger.info(`📋 Generated ${argv.preset} configuration preset`);
        } else {
          config = manager.getConfig();
        }
        
        // Add performance budget if requested
        if (argv.budget) {
          const budget = createPerformanceBudget();
          manager.setPerformanceBudget(budget);
          cliLogger.info("📊 Added performance budget configuration");
        }
        
        // Generate documentation if requested
        if (argv.docs) {
          const docs = generateConfigDocs(config);
          console.log(docs);
        }
        
        // Save configuration if requested
        if (argv.save) {
          const savePath = resolve(argv.save);
          const output = {
            cssOutput: config,
            ...(argv.budget ? { performanceBudget: manager.getPerformanceBudget() } : {}),
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
    }
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
        const cssContent = readFile(inputPath, "utf8");
        const originalSize = Buffer.byteLength(cssContent, "utf8");
        
        // Load budget if provided
        let budget: PerformanceBudget | undefined;
        if (argv.budget) {
          const budgetData = JSON.parse(readFile(resolve(argv.budget), "utf8"));
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
            potentialSavings: originalSize - result.globalStats.totalOptimizedSize,
            compressionRatio: result.globalStats.overallCompressionRatio,
            estimatedLoadTime: result.performanceMetrics.estimatedLoadTime,
          },
          recommendations: argv.recommendations ? [
            originalSize > 100 * 1024 ? "Consider chunking large CSS files" : null,
            result.globalStats.overallCompressionRatio < 0.3 ? "Enable compression for better performance" : null,
            result.performanceMetrics.estimatedLoadTime > 3000 ? "CSS size may impact page load time" : null,
            !result.performanceMetrics.criticalCssSize ? "Consider extracting critical CSS" : null,
          ].filter(Boolean) : [],
          budget: budget ? {
            withinBudget: originalSize <= budget.maxTotalSize,
            usage: Math.round((originalSize / budget.maxTotalSize) * 100),
            remaining: budget.maxTotalSize - originalSize,
          } : null,
        };
        
        // Display results
        cliLogger.info("📊 CSS Analysis Results", {
          fileSize: `${analysis.file.sizeKB}KB`,
          potentialSavings: `${Math.round(analysis.optimization.potentialSavings / 1024)}KB`,
          estimatedLoadTime: `${analysis.optimization.estimatedLoadTime}ms`,
        });
        
        if (analysis.budget) {
          const status = analysis.budget.withinBudget ? "✅" : "❌";
          cliLogger.info(`${status} Budget: ${analysis.budget.usage}% used`);
        }
        
        if (analysis.recommendations.length > 0) {
          cliLogger.info("💡 Recommendations:");
          analysis.recommendations.forEach(rec => cliLogger.info(`  • ${rec}`));
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
    }
  )
  .help()
  .alias("help", "h")
  .parseAsync();

// Convert kebab-case arguments to camelCase for configuration
const cliArgs: CliArguments = {
  pretty: argv.pretty,
  config: argv.config,
  verbose: argv.verbose,
  debug: argv.debug,
  input: argv.input,
  output: argv.output,
  minify: argv.minify,
  removeUnused: argv["remove-unused"],
  maxConcurrency: argv["max-concurrency"],
  classPrefix: argv["class-prefix"],
  excludePatterns: argv["exclude-patterns"] as string[],
  followSymlinks: argv["follow-symlinks"],
  maxFiles: argv["max-files"],
  includeFileTypes: argv["include-file-types"] as ("HTML" | "JAVASCRIPT" | "CSS" | "TEMPLATE")[],
  excludeExtensions: argv["exclude-extensions"] as string[],
  preserveComments: argv["preserve-comments"],
  sourceMaps: argv["source-maps"],
  dryRun: argv["dry-run"],
};

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
    cliLogger.info("Pretty mode enabled - output will be formatted for readability");
  }

  // File discovery
  if (configResult.input) {
    try {
      const discoveryResult = discoverFilesFromConfig(configResult);
      
      cliLogger.info("File Discovery Results", { 
        count: discoveryResult.count, 
        duration: discoveryResult.duration 
      });
      
      if (Object.keys(discoveryResult.breakdown).length > 0) {
        cliLogger.debug("File type breakdown", discoveryResult.breakdown);
      }
      
      if (discoveryResult.emptyPatterns.length > 0) {
        cliLogger.warn("No files found for patterns", { patterns: discoveryResult.emptyPatterns });
      }
      
      if (configResult.debug) {
        cliLogger.debug("Files found", { files: discoveryResult.files });
      }
      
      if (discoveryResult.count === 0) {
        cliLogger.warn("No files found matching the specified patterns");
        cliLogger.info("Patterns searched", { 
          patterns: Array.isArray(configResult.input) ? configResult.input : [configResult.input] 
        });
      } else {
        cliLogger.info("Files ready for processing", { count: discoveryResult.count });
      }
      
    } catch (error) {
      if (error instanceof FileDiscoveryError) {
        cliLogger.error("File Discovery Error", { 
          message: error.message,
          patterns: error.patterns 
        });
        process.exit(1);
      } else {
        throw error; // Re-throw unexpected errors
      }
    }
  }

  // For now, just display the configuration for demonstration
  cliLogger.info("Tailwind Enigma is ready to optimize your CSS!");

  if (!configResult.input && !argv._.length) {
    cliLogger.info("Tip: Use --input to specify files to process");
    cliLogger.info("Tip: Run 'enigma init-config' to create a sample configuration file");
  }
} catch (error) {
  if (error instanceof ConfigError) {
    cliLogger.error("Configuration Error", { 
      message: error.message,
      filepath: error.filepath 
    });
    process.exit(1);
  } else {
    cliLogger.fatal("Unexpected Error", { 
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}
