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
import type { CliArguments } from "../src/config.js";

// Get package.json for version information
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In built version, we need to go up from dist/bin to project root
const packageJsonPath = join(__dirname, "..", "..", "package.json");
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

  // File discovery
  if (configResult.input) {
    try {
      const discoveryResult = discoverFilesFromConfig(configResult);
      
      if (configResult.verbose || configResult.debug) {
        console.log(chalk.cyan(`🔍 File Discovery Results:`));
        console.log(chalk.gray(`   Found ${discoveryResult.count} files in ${discoveryResult.duration}ms`));
        
        if (Object.keys(discoveryResult.breakdown).length > 0) {
          console.log(chalk.gray(`   Breakdown:`));
          Object.entries(discoveryResult.breakdown).forEach(([type, count]) => {
            console.log(chalk.gray(`     ${type}: ${count} files`));
          });
        }
        
        if (discoveryResult.emptyPatterns.length > 0) {
          console.log(chalk.yellow(`   ⚠️  No files found for patterns: ${discoveryResult.emptyPatterns.join(', ')}`));
        }
        
        if (configResult.debug) {
          console.log(chalk.gray(`   Files found:`));
          discoveryResult.files.forEach(file => {
            console.log(chalk.gray(`     ${file}`));
          });
        }
      }
      
      if (discoveryResult.count === 0) {
        console.log(chalk.yellow("⚠️  No files found matching the specified patterns"));
        console.log(chalk.gray(`   Patterns searched: ${Array.isArray(configResult.input) ? configResult.input.join(', ') : configResult.input}`));
      } else {
        console.log(chalk.green(`✅ Found ${discoveryResult.count} files to process`));
      }
      
    } catch (error) {
      if (error instanceof FileDiscoveryError) {
        console.error(chalk.red("❌ File Discovery Error:"));
        console.error(chalk.red(error.message));
        if (error.patterns) {
          console.error(chalk.gray(`   Patterns: ${Array.isArray(error.patterns) ? error.patterns.join(', ') : error.patterns}`));
        }
        process.exit(1);
      } else {
        throw error; // Re-throw unexpected errors
      }
    }
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
