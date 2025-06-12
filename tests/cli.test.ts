import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn } from "child_process";
import { join } from "path";

const CLI_PATH = join(process.cwd(), "dist", "enigma.js");

// Helper function to run CLI and capture output
function runCLI(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });
  });
}

describe("Enhanced CLI Tests", () => {
  beforeEach(() => {
    // Ensure CLI is built before tests
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe("Help and Version", () => {
    it("should display help information", async () => {
      const result = await runCLI(["--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🔵 Tailwind Enigma");
      expect(result.stdout).toContain("Usage: enigma [options]");
      expect(result.stdout).toContain("--pretty");
      expect(result.stdout).toContain("--config");
      expect(result.stdout).toContain("--verbose");
      expect(result.stdout).toContain("--debug");
      expect(result.stdout).toContain("--input");
      expect(result.stdout).toContain("--output");
    });

    it("should display version information", async () => {
      const result = await runCLI(["--version"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("0.1.0");
    });

    it("should display version with -v flag", async () => {
      const result = await runCLI(["-v"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("0.1.0");
    });

    it("should display help with -h flag", async () => {
      const result = await runCLI(["-h"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage: enigma [options]");
    });
  });

  describe("Configuration System Integration", () => {
    it("should run with default configuration", async () => {
      const result = await runCLI([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🔵 Tailwind Enigma");
      expect(result.stdout).toContain(
        "Tailwind Enigma is ready to optimize your CSS!",
      );
      expect(result.stdout).toContain(
        "Tip: Use --input to specify files to process",
      );
    });

    it("should enable pretty mode with --pretty flag", async () => {
      const result = await runCLI(["--pretty"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "Pretty mode enabled - output will be formatted for readability",
      );
    });

    it("should enable pretty mode with -p flag", async () => {
      const result = await runCLI(["-p"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "Pretty mode enabled - output will be formatted for readability",
      );
    });

    it("should enable verbose mode", async () => {
      const result = await runCLI(["--verbose"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Configuration loaded successfully");
    });

    it("should enable debug mode", async () => {
      const result = await runCLI(["--debug"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Debug mode enabled");
      expect(result.stdout).toContain("Final configuration:");
    });

    it("should handle input and output options", async () => {
      const result = await runCLI([
        "--input",
        "./test-src",
        "--output",
        "./test-dist",
        "--verbose",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Input configured");
      expect(result.stdout).toContain("Output configured");
    });

    it("should work with multiple flags combined", async () => {
      const result = await runCLI([
        "--pretty",
        "--verbose",
        "--input",
        "./src",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Pretty mode enabled");
      expect(result.stdout).toContain("Configuration loaded successfully");
      expect(result.stdout).toContain("Input configured");
    });
  });

  describe("Configuration File Handling", () => {
    it("should handle missing config file gracefully", async () => {
      const result = await runCLI(["--config", "nonexistent.config.js"]);

      // Should gracefully fall back to defaults instead of failing
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Failed to load configuration file");
      expect(result.stdout).toContain("Configuration loaded successfully");
    });

    it("should accept config file with --config flag", async () => {
      // This test expects the config file to not exist, so it should fail gracefully
      const result = await runCLI(["--config", "test.config.js"]);

      // Should gracefully fall back to defaults instead of failing
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Failed to load configuration file");
      expect(result.stdout).toContain("Configuration loaded successfully");
    });

    it("should accept config file with -c flag", async () => {
      // This test expects the config file to not exist, so it should fail gracefully
      const result = await runCLI(["-c", "custom.config.js"]);

      // Should gracefully fall back to defaults instead of failing
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Failed to load configuration file");
      expect(result.stdout).toContain("Configuration loaded successfully");
    });
  });

  describe("Commands", () => {
    it("should provide init-config command", async () => {
      const result = await runCLI(["init-config"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Sample configuration file content:");
      expect(result.stdout).toContain("module.exports = {");
      expect(result.stdout).toContain(
        "Save this as enigma.config.js in your project root.",
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown flags gracefully", async () => {
      const result = await runCLI(["--unknown-flag"]);

      // yargs handles unknown flags by showing help, not erroring
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🔵 Tailwind Enigma");
    });

    it("should handle unknown commands gracefully", async () => {
      const result = await runCLI(["unknown-command"]);

      // yargs handles unknown commands by treating them as positional args
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🔵 Tailwind Enigma");
    });
  });

  describe("Advanced Configuration Options", () => {
    it("should handle all configuration options", async () => {
      const result = await runCLI([
        "--debug",
        "--minify=false",
        "--remove-unused=false",
        "--max-concurrency",
        "2",
        "--class-prefix",
        "test-",
        "--preserve-comments",
        "--source-maps",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Debug mode enabled");
      expect(result.stdout).toContain("Final configuration:");
      expect(result.stdout).toContain('"minify":false');
      expect(result.stdout).toContain('"removeUnused":false');
      expect(result.stdout).toContain('"maxConcurrency":2');
      expect(result.stdout).toContain('"classPrefix":"test-"');
      expect(result.stdout).toContain('"preserveComments":true');
      expect(result.stdout).toContain('"sourceMaps":true');
    });

    it("should handle exclude patterns", async () => {
      const result = await runCLI([
        "--debug",
        "--exclude-patterns",
        "*.test.*",
        "--exclude-patterns",
        "*.spec.*",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Final configuration:");
      expect(result.stdout).toContain(
        '"excludePatterns":["*.test.*","*.spec.*"]',
      );
    });
  });

  describe("Output Formatting", () => {
    it("should show helpful tips when no input specified", async () => {
      const result = await runCLI([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "Tip: Use --input to specify files to process",
      );
      expect(result.stdout).toContain(
        "Tip: Run 'enigma init-config' to create a sample configuration file",
      );
    });

    it("should not show tips when input is specified", async () => {
      const result = await runCLI(["--input", "./src"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain(
        "Tip: Use --input to specify files to process",
      );
    });
  });
});
