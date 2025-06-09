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
  .command("init-config", "Create a sample configuration file", {}, () => {
    const sampleConfig = createSampleConfig();
    cliLogger.info("Sample configuration file content:");
    console.log(sampleConfig); // Keep raw output for config content
    cliLogger.info("Save this as enigma.config.js in your project root.");
  })
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
