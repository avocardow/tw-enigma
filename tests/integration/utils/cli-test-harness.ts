/**
 * CLI Test Harness
 *
 * Provides utilities for testing CLI commands in integration tests.
 * Handles command execution, output capture, and common test scenarios.
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CliExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  command: string;
  args: string[];
}

export interface CliExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
  expectFailure?: boolean;
  captureStderr?: boolean;
}

export class CliTestHarness {
  private readonly cliPath: string;
  private readonly defaultTimeout: number = 30000;
  private readonly defaultCwd: string;

  constructor() {
    this.defaultCwd = globalThis.testEnv?.PROJECT_ROOT || process.cwd();
    this.cliPath = path.join(this.defaultCwd, 'packages', 'cli', 'dist', 'index.js');
  }

  /**
   * Execute a CLI command and return the result
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    const startTime = Date.now();
    const timeout = options.timeout || this.defaultTimeout;
    const cwd = options.cwd || this.defaultCwd;
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      INTEGRATION_TEST: 'true',
      ...options.env,
    };

    // Build the full command
    const fullCommand = `node "${this.cliPath}" ${command} ${args.join(' ')}`.trim();

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout,
        cwd,
        env,
        encoding: 'utf8',
      });

      const executionTime = Date.now() - startTime;

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        executionTime,
        command,
        args,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Handle expected failures
      if (options.expectFailure && error.code !== 0) {
        return {
          stdout: (error.stdout || '').trim(),
          stderr: (error.stderr || '').trim(),
          exitCode: error.code || 1,
          executionTime,
          command,
          args,
        };
      }

      // Handle timeouts
      if (error.killed && error.signal === 'SIGTERM') {
        throw new Error(`CLI command timed out after ${timeout}ms: ${fullCommand}`);
      }

      // Handle other execution errors
      throw new Error(
        `CLI command failed: ${fullCommand}\nError: ${error.message}\nStderr: ${error.stderr || 'none'}`
      );
    }
  }

  /**
   * Execute a command with length option
   */
  async executeWithLength(
    command: string,
    length: number,
    additionalArgs: string[] = [],
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    return this.executeCommand(`--length=${length}`, [command, ...additionalArgs], options);
  }

  /**
   * Execute css-config command
   */
  async executeCssConfig(
    args: string[] = [],
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    return this.executeCommand('css-config', args, options);
  }

  /**
   * Execute css-config command with length option
   */
  async executeCssConfigWithLength(
    length: number,
    additionalArgs: string[] = [],
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    return this.executeWithLength('css-config', length, additionalArgs, options);
  }

  /**
   * Execute init-config command
   */
  async executeInitConfig(
    args: string[] = [],
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    return this.executeCommand('init-config', args, options);
  }

  /**
   * Execute init-config command with length option
   */
  async executeInitConfigWithLength(
    length: number,
    additionalArgs: string[] = [],
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    return this.executeWithLength('init-config', length, additionalArgs, options);
  }

  /**
   * Execute help command
   */
  async executeHelp(
    command?: string,
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    const args = command ? [command] : [];
    return this.executeCommand('--help', args, options);
  }

  /**
   * Execute version command
   */
  async executeVersion(options: CliExecutionOptions = {}): Promise<CliExecutionResult> {
    return this.executeCommand('--version', [], options);
  }

  /**
   * Test if CLI is available and working
   */
  async testCliAvailability(): Promise<boolean> {
    try {
      const result = await this.executeVersion({ timeout: 5000 });
      return result.exitCode === 0 && result.stdout.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for CLI to be available (useful in CI environments)
   */
  async waitForCliAvailability(maxWaitTime: number = 30000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 1000;

    while (Date.now() - startTime < maxWaitTime) {
      if (await this.testCliAvailability()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error(`CLI not available after ${maxWaitTime}ms`);
  }

  /**
   * Verify CLI package is built
   */
  async verifyCliBuild(): Promise<void> {
    try {
      await fs.access(this.cliPath);
    } catch (error) {
      throw new Error(`CLI not built. Expected: ${this.cliPath}`);
    }
  }

  /**
   * Create a temporary working directory for command execution
   */
  async createTempWorkDir(): Promise<string> {
    const tempDir = path.join(
      globalThis.testEnv?.TEMP_PATH || '/tmp',
      `cli-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );

    await fs.mkdir(tempDir, { recursive: true });

    // Register cleanup
    if (globalThis.addCleanup) {
      globalThis.addCleanup(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
      });
    }

    return tempDir;
  }
}

/**
 * Global CLI test harness instance
 */
export const cliHarness = new CliTestHarness();

/**
 * Common CLI assertions
 */
export class CliAssertions {
  /**
   * Assert that command was successful
   */
  static assertSuccess(result: CliExecutionResult, message?: string): void {
    if (result.exitCode !== 0) {
      throw new Error(
        `${message || 'Command should have succeeded'}\n` +
          `Command: ${result.command} ${result.args.join(' ')}\n` +
          `Exit code: ${result.exitCode}\n` +
          `Stdout: ${result.stdout}\n` +
          `Stderr: ${result.stderr}`
      );
    }
  }

  /**
   * Assert that command failed with specific exit code
   */
  static assertFailure(
    result: CliExecutionResult,
    expectedExitCode?: number,
    message?: string
  ): void {
    if (result.exitCode === 0) {
      throw new Error(
        `${message || 'Command should have failed'}\n` +
          `Command: ${result.command} ${result.args.join(' ')}\n` +
          `Stdout: ${result.stdout}`
      );
    }

    if (expectedExitCode !== undefined && result.exitCode !== expectedExitCode) {
      throw new Error(
        `${message || 'Command failed with unexpected exit code'}\n` +
          `Expected: ${expectedExitCode}, Got: ${result.exitCode}\n` +
          `Command: ${result.command} ${result.args.join(' ')}\n` +
          `Stderr: ${result.stderr}`
      );
    }
  }

  /**
   * Assert that output contains specific text
   */
  static assertOutputContains(
    result: CliExecutionResult,
    text: string,
    stream: 'stdout' | 'stderr' = 'stdout'
  ): void {
    const output = result[stream];
    if (!output.includes(text)) {
      throw new Error(`Output should contain "${text}"\n` + `${stream}: ${output}`);
    }
  }

  /**
   * Assert that execution time is within acceptable range
   */
  static assertExecutionTime(result: CliExecutionResult, maxTime: number, message?: string): void {
    if (result.executionTime > maxTime) {
      throw new Error(
        `${message || 'Command execution too slow'}\n` +
          `Expected: <${maxTime}ms, Got: ${result.executionTime}ms\n` +
          `Command: ${result.command} ${result.args.join(' ')}`
      );
    }
  }
}
