#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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
    description: "Generate class names without repeating characters",
    default: false,
  })
  .option("config", {
    alias: "c",
    type: "string",
    description: "Path to configuration file",
  })
  .help()
  .alias("help", "h")
  .example("$0", "Run Tailwind Enigma with default settings")
  .example("$0 --pretty", "Run with pretty mode enabled")
  .example(
    "$0 --config ./enigma.config.js",
    "Run with custom configuration file",
  )
  .epilogue(
    "For more information, visit: https://github.com/avocardow/tw-enigma",
  )
  .strict().argv;

// Main execution logic
console.log(chalk.green("\nStarting analysis..."));

if (argv.pretty) {
  console.log(chalk.yellow("Pretty mode enabled."));
}

if (argv.config) {
  console.log(chalk.cyan(`Using configuration file: ${argv.config}`));
}

console.log(chalk.gray("Tailwind Enigma analysis complete."));
