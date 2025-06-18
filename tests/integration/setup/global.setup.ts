/**
 * Global Integration Test Setup
 *
 * This file handles one-time setup and teardown for the entire integration test suite.
 * It ensures packages are built, dependencies are available, and the environment is ready.
 */

import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Global setup function - runs once before all test suites
 */
export async function setup() {
  console.log('🚀 Starting global integration test setup...');

  const startTime = Date.now();
  const projectRoot = process.cwd();

  try {
    // 1. Verify project structure
    console.log('📁 Verifying project structure...');
    const requiredPaths = ['packages/cli', 'packages/core', 'tests/integration'];

    for (const requiredPath of requiredPaths) {
      const fullPath = path.join(projectRoot, requiredPath);
      try {
        await fs.access(fullPath);
      } catch (error) {
        throw new Error(`Required path missing: ${requiredPath}`);
      }
    }

    // 2. Check package.json files exist
    console.log('📦 Verifying package configurations...');
    const packagePaths = [
      'packages/cli/package.json',
      'packages/core/package.json',
      'package.json',
    ];

    for (const packagePath of packagePaths) {
      const fullPath = path.join(projectRoot, packagePath);
      try {
        await fs.access(fullPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        JSON.parse(content); // Validate JSON
      } catch (error) {
        throw new Error(`Invalid or missing package.json: ${packagePath}`);
      }
    }

    // 3. Ensure dependencies are installed
    console.log('🔧 Checking dependencies...');
    const nodeModulesExists = await fs
      .access(path.join(projectRoot, 'node_modules'))
      .then(() => true)
      .catch(() => false);

    if (!nodeModulesExists) {
      console.log('📥 Installing dependencies...');
      await execAsync('pnpm install', { cwd: projectRoot });
    }

    // 4. Build packages if needed
    console.log('🏗️ Ensuring packages are built...');
    const cliDistPath = path.join(projectRoot, 'packages', 'cli', 'dist');
    const coreDistPath = path.join(projectRoot, 'packages', 'core', 'dist');

    const cliBuilt = await fs
      .access(cliDistPath)
      .then(() => true)
      .catch(() => false);

    const coreBuilt = await fs
      .access(coreDistPath)
      .then(() => true)
      .catch(() => false);

    if (!cliBuilt || !coreBuilt) {
      console.log('🔨 Building packages...');
      await execAsync('pnpm build', {
        cwd: projectRoot,
        timeout: 120000, // 2 minutes timeout
      });
    }

    // 5. Create integration test temp directories
    console.log('📂 Setting up test directories...');
    const testDirs = ['tests/integration/temp', 'test-results'];

    for (const testDir of testDirs) {
      const fullPath = path.join(projectRoot, testDir);
      await fs.mkdir(fullPath, { recursive: true });
    }

    // 6. Verify CLI is executable
    console.log('🧪 Verifying CLI functionality...');
    try {
      const { stdout } = await execAsync('node packages/cli/dist/index.js --version', {
        cwd: projectRoot,
        timeout: 10000,
      });
      console.log(`CLI version check successful: ${stdout.trim()}`);
    } catch (error) {
      console.warn('Warning: CLI version check failed, but continuing with tests');
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Global integration test setup completed in ${elapsed}ms`);

    // Store setup metadata for teardown
    global.__INTEGRATION_SETUP__ = {
      startTime,
      projectRoot,
      tempDirsCreated: testDirs,
    };
  } catch (error) {
    console.error('❌ Global integration test setup failed:', error);
    throw error;
  }
}

/**
 * Global teardown function - runs once after all test suites
 */
export async function teardown() {
  console.log('🧹 Starting global integration test teardown...');

  try {
    const setupData = global.__INTEGRATION_SETUP__;
    if (!setupData) {
      console.log('No setup data found, skipping teardown');
      return;
    }

    const { projectRoot, tempDirsCreated, startTime } = setupData;

    // Clean up temporary test directories
    for (const tempDir of tempDirsCreated) {
      const fullPath = path.join(projectRoot, tempDir);
      try {
        await fs.rm(fullPath, { recursive: true, force: true });
        console.log(`🗑️ Cleaned up: ${tempDir}`);
      } catch (error) {
        console.warn(`Warning: Failed to clean up ${tempDir}:`, error);
      }
    }

    // Calculate total test suite runtime
    const totalElapsed = Date.now() - startTime;
    console.log(`⏱️ Total integration test suite runtime: ${totalElapsed}ms`);

    console.log('✅ Global integration test teardown completed');
  } catch (error) {
    console.error('❌ Global integration test teardown failed:', error);
    // Don't throw, as this shouldn't fail the test suite
  }
}

// Type declaration for global setup data
declare global {
  var __INTEGRATION_SETUP__:
    | {
        startTime: number;
        projectRoot: string;
        tempDirsCreated: string[];
      }
    | undefined;
}
