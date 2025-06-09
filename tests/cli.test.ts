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

describe("CLI Tests", () => {
  beforeEach(() => {
    // Ensure CLI is built before tests
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe("Help and Version", () => {
    it("should display help text with --help flag", async () => {
      const result = await runCLI(["--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage: enigma [options]");
      expect(result.stdout).toContain("--help");
      expect(result.stdout).toContain("--version");
      expect(result.stdout).toContain("--pretty");
      expect(result.stdout).toContain("--config");
      expect(result.stdout).toContain("🔵 Tailwind Enigma");
    });

    it("should display help text with -h flag", async () => {
      const result = await runCLI(["-h"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage: enigma [options]");
    });

    it("should display version with --version flag", async () => {
      const result = await runCLI(["--version"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🔵 Tailwind Enigma");
      expect(result.stdout).toContain("0.1.0");
    });

    it("should display version with -v flag", async () => {
      const result = await runCLI(["-v"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("0.1.0");
    });
  });

  describe("Flag Functionality", () => {
    it("should run with default settings", async () => {
      const result = await runCLI([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("🔵 Tailwind Enigma");
      expect(result.stdout).toContain("Starting analysis...");
      expect(result.stdout).toContain("Tailwind Enigma analysis complete.");
    });

    it("should enable pretty mode with --pretty flag", async () => {
      const result = await runCLI(["--pretty"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Pretty mode enabled.");
    });

    it("should enable pretty mode with -p flag", async () => {
      const result = await runCLI(["-p"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Pretty mode enabled.");
    });

    it("should accept config file with --config flag", async () => {
      const result = await runCLI(["--config", "test.config.js"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "Using configuration file: test.config.js",
      );
    });

    it("should accept config file with -c flag", async () => {
      const result = await runCLI(["-c", "custom.config.js"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "Using configuration file: custom.config.js",
      );
    });

    it("should work with multiple flags combined", async () => {
      const result = await runCLI(["--pretty", "--config", "multi.config.js"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Pretty mode enabled.");
      expect(result.stdout).toContain(
        "Using configuration file: multi.config.js",
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid flags gracefully", async () => {
      const result = await runCLI(["--invalid-flag"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown argument");
    });

    it("should show help information on unknown commands", async () => {
      const result = await runCLI(["unknown-command"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown argument");
    });
  });

  describe("Examples and Documentation", () => {
    it("should include usage examples in help text", async () => {
      const result = await runCLI(["--help"]);

      expect(result.stdout).toContain("Examples:");
      expect(result.stdout).toContain("enigma");
      expect(result.stdout).toContain("enigma --pretty");
      expect(result.stdout).toContain("enigma --config");
    });

    it("should include project information in help text", async () => {
      const result = await runCLI(["--help"]);

      expect(result.stdout).toContain(
        "For more information, visit: https://github.com/avocardow/tw-enigma",
      );
    });
  });
});
