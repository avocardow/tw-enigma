#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard MIT license header template
const LICENSE_HEADER = `/**
 * Copyright (c) 2025 Rowan Cardow
 * 
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

`;

// Files and patterns to exclude from license headers
const EXCLUDE_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.d\.ts$/,
  /node_modules/,
  /dist/,
  /build/,
  /coverage/,
  /\.git/,
];

// Check if a file should be excluded
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
}

// Check if file already has a license header
function hasLicenseHeader(content) {
  const firstLines = content.split("\n").slice(0, 10).join("\n");
  return (
    (firstLines.includes("Copyright") && firstLines.includes("MIT license")) ||
    firstLines.includes("Licensed under the MIT")
  );
}

// Add license header to file content
function addLicenseHeader(content) {
  // Remove any existing shebang and preserve it
  const shebangMatch = content.match(/^#!.*/);
  const shebang = shebangMatch ? shebangMatch[0] + "\n\n" : "";
  const contentWithoutShebang = shebang
    ? content.replace(/^#!.*\n/, "")
    : content;

  return shebang + LICENSE_HEADER + contentWithoutShebang;
}

// Process a single file
function processFile(filePath) {
  try {
    // Skip if file should be excluded
    if (shouldExclude(filePath)) {
      return { status: "skipped", reason: "excluded pattern" };
    }

    // Read file content
    const content = fs.readFileSync(filePath, "utf8");

    // Skip if already has license header
    if (hasLicenseHeader(content)) {
      return { status: "skipped", reason: "already has header" };
    }

    // Add license header
    const newContent = addLicenseHeader(content);

    // Write back to file
    fs.writeFileSync(filePath, newContent, "utf8");

    return { status: "added", reason: "license header added" };
  } catch (error) {
    return { status: "error", reason: error.message };
  }
}

// Find all TypeScript files recursively
function findTypeScriptFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (!shouldExclude(fullPath)) {
          traverse(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");
  const sourceDir = args.find((arg) => !arg.startsWith("--")) || "src";

  console.log("🔍 Tailwind Enigma Core - License Header Manager");
  console.log("================================================");
  console.log(`📁 Scanning directory: ${sourceDir}`);
  console.log(`🔧 Mode: ${dryRun ? "DRY RUN" : "APPLY CHANGES"}`);
  console.log("");

  // Find all TypeScript files
  const projectRoot = path.resolve(__dirname, "..");
  const srcPath = path.resolve(projectRoot, sourceDir);

  if (!fs.existsSync(srcPath)) {
    console.error(`❌ Error: Directory '${sourceDir}' not found`);
    process.exit(1);
  }

  const files = findTypeScriptFiles(srcPath);

  if (files.length === 0) {
    console.log("ℹ️  No TypeScript files found");
    return;
  }

  console.log(`📋 Found ${files.length} TypeScript files`);
  console.log("");

  // Process files
  const results = {
    added: 0,
    skipped: 0,
    errors: 0,
  };

  for (const file of files) {
    const relativePath = path.relative(projectRoot, file);

    if (dryRun) {
      // In dry run mode, just check what would happen
      const content = fs.readFileSync(file, "utf8");
      if (shouldExclude(file)) {
        if (verbose) console.log(`⏭️  SKIP: ${relativePath} (excluded)`);
        results.skipped++;
      } else if (hasLicenseHeader(content)) {
        if (verbose) console.log(`⏭️  SKIP: ${relativePath} (has header)`);
        results.skipped++;
      } else {
        console.log(`➕ WOULD ADD: ${relativePath}`);
        results.added++;
      }
    } else {
      // Actually process the file
      const result = processFile(file);

      switch (result.status) {
        case "added":
          console.log(`✅ ADDED: ${relativePath}`);
          results.added++;
          break;
        case "skipped":
          if (verbose)
            console.log(`⏭️  SKIP: ${relativePath} (${result.reason})`);
          results.skipped++;
          break;
        case "error":
          console.log(`❌ ERROR: ${relativePath} - ${result.reason}`);
          results.errors++;
          break;
      }
    }
  }

  // Summary
  console.log("");
  console.log("📊 Summary:");
  console.log(
    `   ${dryRun ? "Would add headers" : "Headers added"}: ${results.added}`,
  );
  console.log(`   Skipped: ${results.skipped}`);
  console.log(`   Errors: ${results.errors}`);

  if (dryRun) {
    console.log("");
    console.log("🔄 To apply changes, run without --dry-run flag");
  } else if (results.added > 0) {
    console.log("");
    console.log("✨ License headers have been added successfully!");
  }
}

// Execute if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
