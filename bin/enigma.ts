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
import type { CliArguments } from "../src/config.js";

// Get package.json for version information
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

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
  .command("init-config", "Create a sample configuration file", {}, () => {
    const sampleConfig = createSampleConfig();
    console.log(chalk.green("Sample configuration file content:"));
    console.log(sampleConfig);
    console.log(
      chalk.yellow("\nSave this as enigma.config.js in your project root."),
    );
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
  preserveComments: argv["preserve-comments"],
  sourceMaps: argv["source-maps"],
};

try {
  // Load and merge configuration from all sources
  const configResult = getConfigSync(cliArgs);

  if (argv.debug) {
    console.log(chalk.cyan("🐛 Debug mode enabled"));
    console.log(chalk.gray("Final configuration:"));
    console.log(JSON.stringify(configResult, null, 2));
  }

  if (argv.verbose || configResult.verbose) {
    console.log(chalk.green("✅ Configuration loaded successfully"));
    if (configResult.input) {
      console.log(chalk.gray(`📁 Input: ${configResult.input}`));
    }
    if (configResult.output) {
      console.log(chalk.gray(`📁 Output: ${configResult.output}`));
    }
  }

  // Main processing logic would go here
  if (configResult.pretty) {
    console.log(
      chalk.green(
        "🎨 Pretty mode enabled - output will be formatted for readability",
      ),
    );
  }

  // For now, just display the configuration for demonstration
  console.log(chalk.blue("🚀 Tailwind Enigma is ready to optimize your CSS!"));

  if (!configResult.input && !argv._.length) {
    console.log(
      chalk.yellow("💡 Tip: Use --input to specify files to process"),
    );
    console.log(
      chalk.yellow(
        "💡 Tip: Run 'enigma init-config' to create a sample configuration file",
      ),
    );
  }
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(chalk.red("❌ Configuration Error:"));
    console.error(chalk.red(error.message));
    if (error.filepath) {
      console.error(chalk.gray(`   File: ${error.filepath}`));
    }
    process.exit(1);
  } else {
    console.error(chalk.red("❌ Unexpected Error:"));
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
