#!/usr/bin/env node

/**
 * Test Isolation Manager for TW-Enigma
 * 
 * Ensures tests run in completely isolated environments to prevent
 * cross-test contamination, especially important for integration tests
 * that create temporary files or modify global state.
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class TestIsolationManager {
  constructor() {
    this.baseDir = path.join(process.cwd(), '.test-isolation');
    this.activeSandboxes = new Set();
    this.cleanupHandlers = [];
    
    // Ensure base directory exists
    fs.ensureDirSync(this.baseDir);
    
    // Register cleanup handlers
    process.on('exit', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('uncaughtException', () => this.cleanup());
  }
  
  /**
   * Create an isolated test environment
   */
  async createSandbox(testName) {
    const sandboxId = this.generateSandboxId(testName);
    const sandboxPath = path.join(this.baseDir, sandboxId);
    
    // Clean up any existing sandbox with same name
    if (fs.existsSync(sandboxPath)) {
      await fs.remove(sandboxPath);
    }
    
    // Create fresh sandbox directory
    await fs.ensureDir(sandboxPath);
    
    // Copy essential files for testing
    await this.setupSandboxFiles(sandboxPath);
    
    // Track active sandbox
    this.activeSandboxes.add(sandboxPath);
    
    return {
      id: sandboxId,
      path: sandboxPath,
      workDir: sandboxPath,
      env: this.createIsolatedEnvironment(sandboxPath),
      cleanup: () => this.cleanupSandbox(sandboxPath),
    };
  }
  
  /**
   * Generate unique sandbox identifier
   */
  generateSandboxId(testName) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5')
      .update(`${testName}-${timestamp}-${Math.random()}`)
      .digest('hex')
      .substring(0, 8);
    
    return `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${hash}`;
  }
  
  /**
   * Set up essential files in sandbox
   */
  async setupSandboxFiles(sandboxPath) {
    const essentialFiles = [
      'package.json',
      'tsconfig.json',
      'jest.config.js',
      'jest.config.integration.js',
    ];
    
    // Copy essential configuration files
    for (const file of essentialFiles) {
      const sourcePath = path.join(process.cwd(), file);
      const targetPath = path.join(sandboxPath, file);
      
      if (fs.existsSync(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
      }
    }
    
    // Copy packages directory (for integration tests)
    const packagesSource = path.join(process.cwd(), 'packages');
    const packagesTarget = path.join(sandboxPath, 'packages');
    
    if (fs.existsSync(packagesSource)) {
      await fs.copy(packagesSource, packagesTarget, {
        filter: (src) => {
          // Skip node_modules and build artifacts
          return !src.includes('node_modules') && 
                 !src.includes('dist') && 
                 !src.includes('coverage');
        }
      });
    }
    
    // Create isolated temp directories
    const tempDirs = ['tmp', 'test-temp', 'coverage', 'test-results'];
    for (const dir of tempDirs) {
      await fs.ensureDir(path.join(sandboxPath, dir));
    }
  }
  
  /**
   * Create isolated environment variables
   */
  createIsolatedEnvironment(sandboxPath) {
    return {
      ...process.env,
      // Override paths to sandbox
      PWD: sandboxPath,
      INIT_CWD: sandboxPath,
      // Test-specific variables
      NODE_ENV: 'test',
      TEST_ISOLATION: 'true',
      TEST_SANDBOX_PATH: sandboxPath,
      // Disable external connections/services
      DISABLE_OPENCOLLECTIVE: 'true',
      DISABLE_UPDATE_NOTIFIER: 'true',
      CI: 'true',
      // Prevent cache pollution
      npm_config_cache: path.join(sandboxPath, '.npm-cache'),
      JEST_CACHE_DIRECTORY: path.join(sandboxPath, '.jest-cache'),
      // Force consistent behavior
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    };
  }
  
  /**
   * Run command in isolated sandbox
   */
  async runInSandbox(sandbox, command, options = {}) {
    const {
      timeout = 60000,
      stdio = 'pipe',
      shell = true,
    } = options;
    
    try {
      const result = execSync(command, {
        cwd: sandbox.path,
        env: sandbox.env,
        timeout,
        stdio,
        shell,
        encoding: 'utf8',
      });
      
      return { success: true, output: result };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        output: error.stdout || error.stderr || '',
        code: error.status || error.signal,
      };
    }
  }
  
  /**
   * Clean up specific sandbox
   */
  async cleanupSandbox(sandboxPath) {
    try {
      if (fs.existsSync(sandboxPath)) {
        await fs.remove(sandboxPath);
      }
      this.activeSandboxes.delete(sandboxPath);
    } catch (error) {
      console.warn(`Failed to cleanup sandbox ${sandboxPath}:`, error.message);
    }
  }
  
  /**
   * Clean up all active sandboxes
   */
  async cleanup() {
    const cleanupPromises = Array.from(this.activeSandboxes).map(
      sandboxPath => this.cleanupSandbox(sandboxPath)
    );
    
    await Promise.allSettled(cleanupPromises);
    
    // Clean up base directory if empty
    try {
      const entries = await fs.readdir(this.baseDir);
      if (entries.length === 0) {
        await fs.remove(this.baseDir);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  /**
   * Create a test runner with isolation
   */
  createIsolatedTestRunner(testSuite) {
    return async (testName, testFn) => {
      const sandbox = await this.createSandbox(`${testSuite}_${testName}`);
      
      try {
        // Execute test in isolated environment
        await testFn(sandbox);
      } finally {
        // Always cleanup sandbox
        await sandbox.cleanup();
      }
    };
  }
  
  /**
   * Validate sandbox integrity
   */
  async validateSandbox(sandbox) {
    const requiredPaths = [
      'package.json',
      'packages/core',
      'packages/cli',
    ];
    
    for (const requiredPath of requiredPaths) {
      const fullPath = path.join(sandbox.path, requiredPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Sandbox validation failed: Missing ${requiredPath}`);
      }
    }
    
    return true;
  }
  
  /**
   * Get sandbox statistics
   */
  getSandboxStats() {
    return {
      activeSandboxes: this.activeSandboxes.size,
      baseDirectory: this.baseDir,
      totalSandboxes: this.activeSandboxes.size,
    };
  }
}

// Export singleton instance
const isolationManager = new TestIsolationManager();

module.exports = {
  TestIsolationManager,
  isolationManager,
  createSandbox: (testName) => isolationManager.createSandbox(testName),
  runInSandbox: (sandbox, command, options) => isolationManager.runInSandbox(sandbox, command, options),
  createIsolatedTestRunner: (testSuite) => isolationManager.createIsolatedTestRunner(testSuite),
  cleanup: () => isolationManager.cleanup(),
};