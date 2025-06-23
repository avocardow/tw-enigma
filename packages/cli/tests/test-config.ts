/**
 * Test Configuration and Utilities
 * 
 * Shared configuration and utilities for integration tests
 */

import * as path from 'path';
import * as fs from 'fs-extra';

// Test environment configuration
export const TEST_CONFIG = {
  // Timeouts
  DEFAULT_TIMEOUT: 30000,
  LONG_TIMEOUT: 60000,
  SHORT_TIMEOUT: 10000,
  
  // Paths
  CLI_PATH: path.resolve(__dirname, '../bin/enigma.ts'),
  FIXTURES_DIR: path.resolve(__dirname, 'fixtures/enigma-integration'),
  TEMP_DIR: path.resolve(__dirname, '../test-temp'),
  
  // Environment
  IS_CI: process.env.CI === 'true' || process.env.CI === '1',
  IS_GITHUB_ACTIONS: process.env.GITHUB_ACTIONS === 'true',
  DEBUG_MODE: process.env.DEBUG_CLI === 'true',
  
  // Test modes
  CLI_TEST_MODE: process.env.CLI_TEST_MODE === 'true',
  FORCE_COLOR: '0', // Disable colors for consistent output
} as const;

// Enhanced test utilities
export class TestEnvironment {
  static async setupGlobalTestEnvironment(): Promise<void> {
    // Ensure temp directory exists and is clean
    await fs.ensureDir(TEST_CONFIG.TEMP_DIR);
    
    // Clean up any previous test runs
    if (TEST_CONFIG.IS_CI) {
      await this.cleanupTestTemp();
    }
    
    // Set environment variables for consistent testing
    process.env.NODE_ENV = 'test';
    process.env.CLI_TEST_MODE = 'true';
    process.env.FORCE_COLOR = TEST_CONFIG.FORCE_COLOR;
    
    if (TEST_CONFIG.DEBUG_MODE) {
      process.env.DEBUG = 'tw-enigma:*';
    }
  }
  
  static async cleanupGlobalTestEnvironment(): Promise<void> {
    // Clean up temp directory after all tests
    if (TEST_CONFIG.IS_CI) {
      await this.cleanupTestTemp();
    }
  }
  
  private static async cleanupTestTemp(): Promise<void> {
    try {
      const tempExists = await fs.pathExists(TEST_CONFIG.TEMP_DIR);
      if (tempExists) {
        // Remove old test directories (keep recent ones for debugging)
        const entries = await fs.readdir(TEST_CONFIG.TEMP_DIR);
        const cutoffTime = Date.now() - (60 * 60 * 1000); // 1 hour ago
        
        for (const entry of entries) {
          const entryPath = path.join(TEST_CONFIG.TEMP_DIR, entry);
          const stat = await fs.stat(entryPath);
          
          if (stat.isDirectory() && stat.ctimeMs < cutoffTime) {
            await fs.remove(entryPath);
          }
        }
      }
    } catch (error) {
      // Ignore cleanup errors in CI
      if (!TEST_CONFIG.IS_CI) {
        console.warn('Failed to cleanup test temp directory:', error);
      }
    }
  }
  
  static getTimeoutForTest(testType: 'unit' | 'integration' | 'e2e' = 'integration'): number {
    const baseTimeout = {
      unit: TEST_CONFIG.SHORT_TIMEOUT,
      integration: TEST_CONFIG.DEFAULT_TIMEOUT,
      e2e: TEST_CONFIG.LONG_TIMEOUT,
    }[testType];
    
    // Increase timeout in CI environments
    return TEST_CONFIG.IS_CI ? baseTimeout * 2 : baseTimeout;
  }
  
  static getEnvironmentForCLI(): Record<string, string> {
    return {
      NODE_ENV: 'test',
      CLI_TEST_MODE: 'true',
      FORCE_COLOR: TEST_CONFIG.FORCE_COLOR,
      CI: TEST_CONFIG.IS_CI ? 'true' : 'false',
      GITHUB_ACTIONS: TEST_CONFIG.IS_GITHUB_ACTIONS ? 'true' : 'false',
      DEBUG_CLI: TEST_CONFIG.DEBUG_MODE ? 'true' : 'false',
      // Disable any scramble package detection for consistent testing
      ENIGMA_DISABLE_SCRAMBLE_AUTO_DETECT: 'true',
    };
  }
}

// Project fixture utilities
export interface ProjectFixture {
  name: string;
  description: string;
  expectedFiles: string[];
  expectedPatterns: string[];
}

export const PROJECT_FIXTURES: Record<string, ProjectFixture> = {
  'basic-project': {
    name: 'basic-project',
    description: 'Simple HTML/JSX project with common Tailwind patterns',
    expectedFiles: ['src/index.html', 'src/components/Button.jsx', 'src/pages/home.html'],
    expectedPatterns: [
      'bg-white rounded-lg shadow-md p-6',
      'bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded',
      'flex items-center justify-between',
      'text-gray-600 hover:text-gray-900'
    ]
  },
  'scramble-project': {
    name: 'scramble-project',
    description: 'Project designed for scramble effects testing',
    expectedFiles: ['src/index.html'],
    expectedPatterns: [
      'fixed top-0 left-0 right-0 z-50',
      'bg-gradient-to-br from-purple-400 to-blue-400',
      'bg-white rounded-xl shadow-lg hover:shadow-xl'
    ]
  }
} as const;

// Test result validation utilities
export class TestResultValidator {
  static validateBasicOptimization(output: string): void {
    const requiredPhrases = [
      'Enigma optimization starting',
      'Configuration loaded successfully',
      'Core optimization engine working',
      'Enigma optimization complete'
    ];
    
    for (const phrase of requiredPhrases) {
      if (!output.includes(phrase)) {
        throw new Error(`Expected output to contain: "${phrase}"`);
      }
    }
  }
  
  static validateDryRunMode(output: string): void {
    const requiredPhrases = [
      'Running in dry-run mode',
      'no files will be modified'
    ];
    
    for (const phrase of requiredPhrases) {
      if (!output.includes(phrase)) {
        throw new Error(`Expected dry-run output to contain: "${phrase}"`);
      }
    }
  }
  
  static validateVerboseMode(output: string): void {
    const requiredPhrases = [
      'Discovering files for processing',
      'Found',
      'files to process'
    ];
    
    for (const phrase of requiredPhrases) {
      if (!output.includes(phrase)) {
        throw new Error(`Expected verbose output to contain: "${phrase}"`);
      }
    }
  }
  
  static validateScrambleHandling(output: string): void {
    // Should contain scramble package detection
    if (!output.includes('Checking scramble package availability')) {
      throw new Error('Expected scramble package availability check');
    }
    
    // Should handle package unavailability gracefully
    if (output.includes('Scramble package not available')) {
      if (!output.includes('using basic optimization')) {
        throw new Error('Expected graceful fallback when scramble unavailable');
      }
    }
  }
  
  static validateFileDiscovery(output: string, expectedMinFiles: number = 0): void {
    const foundMatch = output.match(/Found (\d+) files to process/);
    if (foundMatch) {
      const fileCount = parseInt(foundMatch[1], 10);
      if (fileCount < expectedMinFiles) {
        throw new Error(`Expected at least ${expectedMinFiles} files, found ${fileCount}`);
      }
    } else if (expectedMinFiles > 0) {
      throw new Error('Expected file discovery output but none found');
    }
  }
}

// Error assertion utilities
export class ErrorAssertions {
  static expectGracefulFailure(exitCode: number, output: string): void {
    // Exit code should be 0 (graceful handling) or 1 (expected failure)
    if (exitCode !== 0 && exitCode !== 1) {
      throw new Error(`Unexpected exit code: ${exitCode}. Output: ${output}`);
    }
  }
  
  static expectValidationError(exitCode: number, output: string): void {
    // Should fail with validation error
    if (exitCode === 0) {
      throw new Error(`Expected validation error but command succeeded. Output: ${output}`);
    }
  }
  
  static expectConfigurationError(output: string): void {
    const errorIndicators = [
      'configuration',
      'config',
      'invalid',
      'error',
      'failed'
    ];
    
    const hasErrorIndicator = errorIndicators.some(indicator => 
      output.toLowerCase().includes(indicator)
    );
    
    if (!hasErrorIndicator) {
      throw new Error(`Expected configuration error indicators in output: ${output}`);
    }
  }
}

// Initialize test environment
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  // Auto-setup for test environment
  TestEnvironment.setupGlobalTestEnvironment().catch(console.error);
  
  // Cleanup on process exit
  process.on('exit', () => {
    TestEnvironment.cleanupGlobalTestEnvironment().catch(console.error);
  });
}