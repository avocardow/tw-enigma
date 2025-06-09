#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

console.log(chalk.blue("🔵 Tailwind Enigma"));

yargs(hideBin(process.argv))
  .command(
    "$0",
    "Run Tailwind Enigma to optimize your build assets.",
    (yargs) => {
      // Define flags here in the future
      return yargs.option("pretty", {
        alias: "p",
        type: "boolean",
        description: "Generate class names without repeating characters.",
        default: false,
      });
    },
    (argv) => {
      console.log(chalk.green("\nStarting analysis..."));
      if (argv.pretty) {
        console.log(chalk.yellow("Pretty mode enabled."));
      }
    },
  )
  .help()
  .alias("help", "h")
  .parse();