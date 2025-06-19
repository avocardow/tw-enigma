/**
 * CLI Test Harness
 *
 * Provides utilities for testing CLI commands in integration tests.
 * Handles command execution, output capture, and common test scenarios.
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
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
  private tempDirectories: string[] = [];

  constructor() {
    // Resolve to the actual project root (up two levels from tests/integration)
    this.defaultCwd = path.resolve(__dirname, '..', '..', '..');
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

  /**
   * Create a temporary directory for testing
   */
  async createTempDirectory(prefix: string = 'cli-test-'): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    this.tempDirectories.push(tempDir);
    return tempDir;
  }

  /**
   * Clean up all created temporary directories
   */
  async cleanup(): Promise<void> {
    await Promise.all(
      this.tempDirectories.map(async (dir) => {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors in tests
          console.warn(`Failed to cleanup temp directory ${dir}:`, error);
        }
      })
    );
    this.tempDirectories = [];
  }

  /**
   * Create a temporary test project structure
   */
  async createTestProject(
    tempDir: string,
    projectType: 'react' | 'nextjs' | 'vite' = 'react'
  ): Promise<string> {
    const projectDir = path.join(tempDir, 'test-project');
    await fs.mkdir(projectDir, { recursive: true });

    // Create basic project structure based on type
    switch (projectType) {
      case 'react':
        await this.createReactProject(projectDir);
        break;
      case 'nextjs':
        await this.createNextJsProject(projectDir);
        break;
      case 'vite':
        await this.createViteProject(projectDir);
        break;
    }

    return projectDir;
  }

  private async createReactProject(projectDir: string): Promise<void> {
    // Create package.json
    const packageJson = {
      name: 'test-react-project',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    };
    await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create src directory and basic components
    const srcDir = path.join(projectDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const appComponent = `
import React from 'react';

function App() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">Test React App</h1>
      <p className="text-gray-600">This is a test application.</p>
    </div>
  );
}

export default App;
`;
    await fs.writeFile(path.join(srcDir, 'App.tsx'), appComponent);
  }

  private async createNextJsProject(projectDir: string): Promise<void> {
    // Create package.json
    const packageJson = {
      name: 'test-nextjs-project',
      version: '1.0.0',
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    };
    await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create pages directory
    const pagesDir = path.join(projectDir, 'pages');
    await fs.mkdir(pagesDir, { recursive: true });

    const indexPage = `
import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center">Test Next.js App</h1>
        <p className="text-center text-gray-600 mt-4">This is a test application.</p>
      </div>
    </div>
  );
}
`;
    await fs.writeFile(path.join(pagesDir, 'index.tsx'), indexPage);
  }

  private async createViteProject(projectDir: string): Promise<void> {
    // Create package.json
    const packageJson = {
      name: 'test-vite-project',
      version: '1.0.0',
      dependencies: {
        vue: '^3.0.0',
      },
    };
    await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create src directory
    const srcDir = path.join(projectDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const appComponent = `
<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold">Test Vite App</h1>
    <p class="text-gray-600">This is a test application.</p>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>
`;
    await fs.writeFile(path.join(srcDir, 'App.vue'), appComponent);
  }

  /**
   * Execute a command in a specific directory context
   */
  async executeCommandInDirectory(
    args: string[],
    workingDirectory: string,
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    // Set the working directory for this execution
    const executionOptions: CliExecutionOptions = {
      ...options,
      cwd: workingDirectory,
    };

    // Extract command from args (assume first arg might be the command)
    const command = args.length > 0 ? args[0] : '';
    const commandArgs = args.slice(1);

    return this.executeCommand(command, commandArgs, executionOptions);
  }

  /**
   * Create a temporary test configuration file
   */
  async createTestConfig(
    tempDir: string,
    config: any,
    filename: string = 'enigma.config.json'
  ): Promise<string> {
    const configPath = path.join(tempDir, filename);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  /**
   * Create test files with CSS content
   */
  async createTestFiles(tempDir: string, files: Record<string, string>): Promise<void> {
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tempDir, filePath);
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content);
    }
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
