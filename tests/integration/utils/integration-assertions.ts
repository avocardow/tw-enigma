/**
 * Integration Test Assertions
 *
 * Provides specialized assertion utilities for integration testing.
 * Includes cross-package validation, data flow verification, and integration-specific checks.
 */

import { expect } from 'vitest';
import type { CliExecutionResult } from './cli-test-harness';

export interface DataFlowValidation {
  inputPoint: string;
  outputPoint: string;
  expectedTransformation: string;
  actualResult: any;
}

export interface IntegrationTestMetrics {
  executionTime: number;
  memoryUsage?: number;
  outputSize?: number;
  cacheHits?: number;
  errorCount: number;
}

export class IntegrationAssertions {
  /**
   * Assert CLI-Core data flow is working correctly
   */
  static assertDataFlow(
    cliResult: CliExecutionResult,
    expectedCoreData: any,
    description: string
  ): void {
    expect(cliResult.exitCode).toBe(0);
    expect(cliResult.stdout).toBeDefined();

    try {
      // Parse CLI output if it contains JSON
      const cliData = JSON.parse(cliResult.stdout);
      expect(cliData).toMatchObject(expectedCoreData);
    } catch (error) {
      // If not JSON, do string matching
      for (const [key, value] of Object.entries(expectedCoreData)) {
        expect(cliResult.stdout).toContain(String(value));
      }
    }
  }

  /**
   * Assert that configuration priority system works correctly
   */
  static assertConfigPriority(
    result: CliExecutionResult,
    expectedPriority: 'cli' | 'env' | 'file' | 'default',
    priorityValue: any
  ): void {
    expect(result.exitCode).toBe(0);

    // Check that the higher priority value is used
    expect(result.stdout).toContain(String(priorityValue));

    // Check priority indication in output if available
    if (result.stderr) {
      switch (expectedPriority) {
        case 'cli':
          expect(result.stderr).toMatch(/using.*cli.*option/i);
          break;
        case 'env':
          expect(result.stderr).toMatch(/using.*environment.*variable/i);
          break;
        case 'file':
          expect(result.stderr).toMatch(/using.*config.*file/i);
          break;
        case 'default':
          expect(result.stderr).toMatch(/using.*default.*value/i);
          break;
      }
    }
  }

  /**
   * Assert cross-package type safety
   */
  static assertTypeSafety(
    cliResult: CliExecutionResult,
    expectedTypes: Record<string, string>
  ): void {
    expect(cliResult.exitCode).toBe(0);

    // Verify no type-related errors in stderr
    expect(cliResult.stderr).not.toMatch(/type.*error/i);
    expect(cliResult.stderr).not.toMatch(/typescript.*error/i);

    // If CLI output includes type information, validate it
    for (const [field, expectedType] of Object.entries(expectedTypes)) {
      if (cliResult.stdout.includes(field)) {
        // Basic type validation based on output format
        switch (expectedType) {
          case 'number':
            expect(cliResult.stdout).toMatch(new RegExp(`${field}.*:\\s*\\d+`));
            break;
          case 'boolean':
            expect(cliResult.stdout).toMatch(new RegExp(`${field}.*:\\s*(true|false)`));
            break;
          case 'string':
            expect(cliResult.stdout).toMatch(new RegExp(`${field}.*:\\s*"[^"]*"`));
            break;
        }
      }
    }
  }

  /**
   * Assert error propagation works correctly
   */
  static assertErrorPropagation(
    cliResult: CliExecutionResult,
    expectedErrorType: 'validation' | 'runtime' | 'configuration' | 'system',
    shouldContainStack: boolean = false
  ): void {
    expect(cliResult.exitCode).toBeGreaterThan(0);
    expect(cliResult.stderr).toBeDefined();
    expect(cliResult.stderr.length).toBeGreaterThan(0);

    // Check error type indicators
    switch (expectedErrorType) {
      case 'validation':
        expect(cliResult.stderr).toMatch(/validation.*error|invalid.*value|must be/i);
        break;
      case 'runtime':
        expect(cliResult.stderr).toMatch(/runtime.*error|execution.*failed/i);
        break;
      case 'configuration':
        expect(cliResult.stderr).toMatch(/config.*error|configuration.*invalid/i);
        break;
      case 'system':
        expect(cliResult.stderr).toMatch(/system.*error|file.*not.*found|permission.*denied/i);
        break;
    }

    // Check stack trace presence
    if (shouldContainStack) {
      expect(cliResult.stderr).toMatch(/at .+:\d+:\d+/);
    } else {
      // User-friendly errors should not contain stack traces
      expect(cliResult.stderr).not.toMatch(/at .+:\d+:\d+/);
    }
  }

  /**
   * Assert command integration works end-to-end
   */
  static assertCommandIntegration(
    result: CliExecutionResult,
    expectedSteps: string[],
    expectedOutput: Record<string, any>
  ): void {
    expect(result.exitCode).toBe(0);

    // Verify all expected processing steps occurred
    for (const step of expectedSteps) {
      expect(result.stderr || result.stdout).toMatch(new RegExp(step, 'i'));
    }

    // Verify expected output structure
    for (const [key, value] of Object.entries(expectedOutput)) {
      if (typeof value === 'string') {
        expect(result.stdout).toContain(value);
      } else if (typeof value === 'number') {
        expect(result.stdout).toMatch(new RegExp(`${key}.*${value}`));
      } else if (typeof value === 'boolean') {
        expect(result.stdout).toMatch(new RegExp(`${key}.*${value}`));
      }
    }
  }

  /**
   * Assert performance characteristics
   */
  static assertPerformance(
    result: CliExecutionResult,
    maxExecutionTime: number,
    metrics?: IntegrationTestMetrics
  ): void {
    expect(result.executionTime).toBeLessThanOrEqual(maxExecutionTime);

    if (metrics) {
      expect(metrics.errorCount).toBe(0);

      if (metrics.memoryUsage) {
        // Memory usage should be reasonable (under 512MB for integration tests)
        expect(metrics.memoryUsage).toBeLessThan(512 * 1024 * 1024);
      }

      if (metrics.outputSize) {
        // Output should not be excessively large
        expect(metrics.outputSize).toBeLessThan(10 * 1024 * 1024); // 10MB
      }
    }
  }

  /**
   * Assert backward compatibility
   */
  static assertBackwardCompatibility(
    modernResult: CliExecutionResult,
    legacyResult: CliExecutionResult,
    compatibilityAspects: string[]
  ): void {
    // Both should succeed
    expect(modernResult.exitCode).toBe(0);
    expect(legacyResult.exitCode).toBe(0);

    for (const aspect of compatibilityAspects) {
      switch (aspect) {
        case 'output-format':
          // Output format should be compatible
          expect(modernResult.stdout.split('\n')[0]).toBe(legacyResult.stdout.split('\n')[0]);
          break;
        case 'exit-codes':
          // Exit codes should match
          expect(modernResult.exitCode).toBe(legacyResult.exitCode);
          break;
        case 'core-functionality':
          // Core functionality markers should be present in both
          expect(modernResult.stdout).toMatch(/module\.exports/);
          expect(legacyResult.stdout).toMatch(/module\.exports/);
          break;
        case 'configuration-structure':
          // Basic configuration structure should match
          expect(modernResult.stdout).toContain('pretty:');
          expect(legacyResult.stdout).toContain('pretty:');
          break;
      }
    }
  }

  /**
   * Assert length option integration across commands
   */
  static assertLengthIntegration(
    result: CliExecutionResult,
    expectedLength: number,
    command: string
  ): void {
    expect(result.exitCode).toBe(0);

    // Should contain feedback about length option
    expect(result.stderr).toMatch(new RegExp(`minimum.*length.*${expectedLength}`, 'i'));

    // Should contain nameGeneration configuration
    expect(result.stdout).toContain('nameGeneration');
    expect(result.stdout).toMatch(new RegExp(`minimumLength.*${expectedLength}`));

    // Command-specific validations
    switch (command) {
      case 'init-config':
        expect(result.stdout).toContain('module.exports');
        expect(result.stdout).toContain('strategy:');
        break;
      case 'css-config':
        expect(result.stdout).toMatch(/\.css|@apply/);
        break;
    }
  }

  /**
   * Assert configuration validation chain
   */
  static assertConfigValidation(
    result: CliExecutionResult,
    validationSteps: string[],
    shouldPass: boolean
  ): void {
    if (shouldPass) {
      expect(result.exitCode).toBe(0);
    } else {
      expect(result.exitCode).toBeGreaterThan(0);
    }

    // Check that validation steps are mentioned in output
    for (const step of validationSteps) {
      expect(result.stderr || result.stdout).toMatch(new RegExp(step, 'i'));
    }

    if (!shouldPass) {
      // Should contain clear validation error message
      expect(result.stderr).toMatch(/validation.*failed|invalid.*configuration/i);
    }
  }

  /**
   * Assert file system integration
   */
  static assertFileSystemIntegration(
    result: CliExecutionResult,
    expectedFiles: string[],
    expectedDirectories: string[]
  ): void {
    expect(result.exitCode).toBe(0);

    // Check for file operation messages
    for (const file of expectedFiles) {
      expect(result.stderr || result.stdout).toMatch(
        new RegExp(`(created|written|generated).*${file}`, 'i')
      );
    }

    for (const dir of expectedDirectories) {
      expect(result.stderr || result.stdout).toMatch(new RegExp(`(created|found).*${dir}`, 'i'));
    }
  }

  /**
   * Assert configuration is valid
   */
  static assertConfigurationValid(
    result: CliExecutionResult,
    expectedConfig: Record<string, any>
  ): void {
    expect(result.exitCode).toBe(0);

    // Basic validation that config was processed
    expect(result.stdout || result.stderr).toBeDefined();

    // Check for expected configuration values in output
    for (const [key, value] of Object.entries(expectedConfig)) {
      if (typeof value === 'string') {
        expect(result.stdout).toContain(value);
      } else if (typeof value === 'number') {
        expect(result.stdout).toMatch(new RegExp(String(value)));
      } else if (typeof value === 'boolean') {
        expect(result.stdout).toMatch(new RegExp(String(value)));
      }
    }
  }

  /**
   * Assert name generation options are valid
   */
  static assertNameGenerationOptionsValid(
    result: CliExecutionResult,
    expectedOptions: { minimumLength?: number; strategy?: string }
  ): void {
    expect(result.exitCode).toBe(0);

    if (expectedOptions.minimumLength) {
      expect(result.stdout).toMatch(new RegExp(`minimumLength.*${expectedOptions.minimumLength}`));
    }

    if (expectedOptions.strategy) {
      expect(result.stdout).toMatch(new RegExp(`strategy.*${expectedOptions.strategy}`));
    }
  }

  /**
   * Assert validation chain is working
   */
  static assertValidationChain(
    result: CliExecutionResult,
    validationSteps: string[],
    shouldPass: boolean
  ): void {
    if (shouldPass) {
      expect(result.exitCode).toBe(0);
      // Check that validation steps were executed
      for (const step of validationSteps) {
        expect(result.stderr || result.stdout).toMatch(new RegExp(step, 'i'));
      }
    } else {
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr).toBeDefined();
      expect(result.stderr.length).toBeGreaterThan(0);
    }
  }

  /**
   * Assert circuit breaker behavior
   */
  static assertCircuitBreaker(
    result: CliExecutionResult,
    expectedState: 'closed' | 'open' | 'half-open'
  ): void {
    expect(result.stderr || result.stdout).toMatch(
      new RegExp(`circuit.*breaker.*${expectedState}`, 'i')
    );
  }

  /**
   * Assert error recovery mechanisms
   */
  static assertErrorRecovery(
    result: CliExecutionResult,
    recoveryAttempted: boolean,
    recoverySuccessful?: boolean
  ): void {
    if (recoveryAttempted) {
      expect(result.stderr || result.stdout).toMatch(/recovery.*attempt|retry/i);

      if (recoverySuccessful !== undefined) {
        if (recoverySuccessful) {
          expect(result.exitCode).toBe(0);
          expect(result.stderr || result.stdout).toMatch(/recovery.*successful|retry.*successful/i);
        } else {
          expect(result.exitCode).toBeGreaterThan(0);
          expect(result.stderr).toMatch(/recovery.*failed|retry.*failed/i);
        }
      }
    }
  }
}

/**
 * Utility functions for integration testing
 */
export class IntegrationUtils {
  /**
   * Extract JSON from CLI output
   */
  static extractJson(output: string): any {
    try {
      // Try to parse the entire output as JSON
      return JSON.parse(output);
    } catch (error) {
      // Try to find JSON blocks in the output
      const jsonMatch = output.match(/{[\s\S]*}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error(`No valid JSON found in output: ${output}`);
    }
  }

  /**
   * Parse configuration output
   */
  static parseConfigOutput(output: string): Record<string, any> {
    // Remove comments and module.exports wrapper
    const cleanOutput = output
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/module\.exports\s*=\s*/, '') // Remove module.exports
      .replace(/;\s*$/, ''); // Remove trailing semicolon

    try {
      return JSON.parse(cleanOutput);
    } catch (error) {
      throw new Error(`Could not parse config output: ${cleanOutput}`);
    }
  }

  /**
   * Measure integration test metrics
   */
  static measureMetrics(fn: () => Promise<any>): Promise<IntegrationTestMetrics> {
    return new Promise(async (resolve) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      let errorCount = 0;

      try {
        await fn();
      } catch (error) {
        errorCount = 1;
      }

      const endTime = Date.now();
      const endMemory = process.memoryUsage();

      resolve({
        executionTime: endTime - startTime,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        errorCount,
      });
    });
  }

  /**
   * Create test timeout wrapper
   */
  static withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }
}

/**
 * Test data patterns for integration testing
 */
export const IntegrationTestData = {
  /**
   * Sample CSS class patterns for testing
   */
  cssClasses: [
    'text-red-500',
    'bg-blue-300',
    'hover:text-green-600',
    'md:flex',
    'lg:grid-cols-3',
    'xl:max-w-7xl',
  ],

  /**
   * Sample HTML structures for testing
   */
  htmlStructures: [
    '<div class="text-red-500 bg-blue-300">Test</div>',
    '<span class="hover:text-green-600 md:flex">Content</span>',
    '<article class="lg:grid-cols-3 xl:max-w-7xl">Article</article>',
  ],

  /**
   * Sample configuration variations
   */
  configVariations: [
    { minimumLength: 3, strategy: 'sequential' },
    { minimumLength: 8, strategy: 'random' },
    { minimumLength: 5, strategy: 'alphabet', alphabet: 'abcdef0123456789' },
  ],

  /**
   * Performance test thresholds
   */
  performanceThresholds: {
    cliCommandExecution: 5000, // 5 seconds
    configGeneration: 1000, // 1 second
    cssProcessing: 3000, // 3 seconds
    fileSystemOperations: 2000, // 2 seconds
  },

  /**
   * Generate sequential names for testing
   */
  generateSequentialNames(length: number, count: number): string[] {
    const names: string[] = [];
    const chars = 'abcdefghijklmnopqrstuvwxyz';

    for (let i = 0; i < count; i++) {
      let name = '';
      let num = i;

      for (let j = 0; j < length; j++) {
        name = chars[num % chars.length] + name;
        num = Math.floor(num / chars.length);
      }

      // Pad to minimum length
      while (name.length < length) {
        name = 'a' + name;
      }

      names.push(name);
    }

    return names;
  },

  /**
   * Generate random names for testing
   */
  generateRandomNames(length: number, count: number): string[] {
    const names: string[] = [];
    const chars = 'abcdefghijklmnopqrstuvwxyz';

    for (let i = 0; i < count; i++) {
      let name = '';
      for (let j = 0; j < length; j++) {
        name += chars[Math.floor(Math.random() * chars.length)];
      }
      names.push(name);
    }

    return names;
  },

  /**
   * Generate alphabet-based names for testing
   */
  generateAlphabetNames(length: number, count: number, alphabet: string): string[] {
    const names: string[] = [];

    for (let i = 0; i < count; i++) {
      let name = '';
      let num = i;

      for (let j = 0; j < length; j++) {
        name = alphabet[num % alphabet.length] + name;
        num = Math.floor(num / alphabet.length);
      }

      names.push(name);
    }

    return names;
  },

  /**
   * Generate edge case names for testing
   */
  generateEdgeCaseNames(): string[] {
    return [
      'a', // Single character
      'ab', // Two characters
      'abc', // Three characters
      'a'.repeat(50), // Very long name
      'a1b2c3', // Mixed alphanumeric
      'A-b_c', // Special characters (should be sanitized)
    ];
  },

  /**
   * Generate CSS validity test names
   */
  generateCssValidityNames(): { valid: string[]; invalid: string[] } {
    return {
      valid: ['abc123', 'test-class', 'component_name', 'a1b2c3', 'valid-css-name'],
      invalid: [
        '123abc', // Cannot start with number
        '-abc', // Cannot start with hyphen
        'test space', // No spaces allowed
        'test@symbol', // No @ symbols
        'test.dot', // No dots (in class names)
      ],
    };
  },
};
