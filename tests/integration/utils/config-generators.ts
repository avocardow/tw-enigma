/**
 * Configuration Generators for Integration Testing
 *
 * This module provides utilities for generating test configurations,
 * fixtures, and test data for integration testing scenarios.
 */

import type { EnigmaConfiguration, NameGenerationOptions } from '@tw-enigma/core';

/**
 * Configuration Generation Utilities
 */
export class ConfigGenerators {
  /**
   * Generate minimal configuration for basic testing
   */
  static generateMinimalConfig(): Partial<EnigmaConfiguration> {
    return {
      input: './test-input',
      output: './test-output',
      pretty: false,
      verbose: false,
      debug: false,
    };
  }

  /**
   * Generate configuration with name generation options
   */
  static generateConfigWithNameGeneration(
    options: Partial<NameGenerationOptions> = {}
  ): Partial<EnigmaConfiguration> {
    return {
      ...this.generateMinimalConfig(),
      nameGeneration: {
        minimumLength: 1,
        strategy: 'sequential',
        alphabet: 'abcdefghijklmnopqrstuvwxyz',
        prefix: '',
        suffix: '',
        numericSuffix: false,
        ensureCssValid: true,
        ...options,
      },
    };
  }

  /**
   * Generate complex name generation configuration
   */
  static generateComplexNameGeneration(): Partial<EnigmaConfiguration> {
    return this.generateConfigWithNameGeneration({
      minimumLength: 3,
      strategy: 'frequency-optimized',
      alphabet: 'abcdefghijklm',
      prefix: 'tw-',
      suffix: '-gen',
      numericSuffix: true,
      ensureCssValid: true,
    });
  }

  /**
   * Generate invalid name generation configuration for error testing
   */
  static generateInvalidNameGeneration(): Partial<EnigmaConfiguration> {
    return this.generateConfigWithNameGeneration({
      minimumLength: -1, // Invalid: negative length
      strategy: 'invalid-strategy' as any, // Invalid strategy
      alphabet: '', // Invalid: empty alphabet
    });
  }

  /**
   * Generate configuration with environment variable overrides
   */
  static generateConfigWithEnvOverrides(): Partial<EnigmaConfiguration> {
    return {
      ...this.generateMinimalConfig(),
      // These would be overridden by environment variables in tests
      nameGeneration: {
        minimumLength: parseInt(process.env.TW_ENIGMA_NAME_GENERATION_MINIMUM_LENGTH || '1'),
        strategy: (process.env.TW_ENIGMA_NAME_GENERATION_STRATEGY || 'sequential') as any,
        alphabet: process.env.TW_ENIGMA_NAME_GENERATION_ALPHABET || 'abcdefghijklmnopqrstuvwxyz',
        prefix: process.env.TW_ENIGMA_NAME_GENERATION_PREFIX || '',
        suffix: process.env.TW_ENIGMA_NAME_GENERATION_SUFFIX || '',
        numericSuffix: process.env.TW_ENIGMA_NAME_GENERATION_NUMERIC_SUFFIX === 'true',
        ensureCssValid: process.env.TW_ENIGMA_NAME_GENERATION_ENSURE_CSS_VALID !== 'false',
      },
    };
  }

  /**
   * Generate JSON configuration file content
   */
  static generateJsonConfig(config: Partial<EnigmaConfiguration>): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate YAML configuration file content
   */
  static generateYamlConfig(config: Partial<EnigmaConfiguration>): string {
    // Simple YAML generation for testing
    const yamlLines: string[] = [];

    const addToYaml = (obj: any, indent = 0) => {
      const spaces = '  '.repeat(indent);
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          yamlLines.push(`${spaces}${key}:`);
          addToYaml(value, indent + 1);
        } else {
          yamlLines.push(`${spaces}${key}: ${typeof value === 'string' ? `"${value}"` : value}`);
        }
      }
    };

    addToYaml(config);
    return yamlLines.join('\n');
  }

  /**
   * Generate JavaScript configuration file content
   */
  static generateJsConfig(config: Partial<EnigmaConfiguration>): string {
    return `module.exports = ${JSON.stringify(config, null, 2)};`;
  }
}

/**
 * Integration Test Data Generation
 */
export class IntegrationTestData {
  /**
   * Generate sequential test names
   */
  static generateSequentialNames(count: number, minimumLength: number = 1): string[] {
    const names: string[] = [];
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';

    for (let i = 0; i < count; i++) {
      let name = '';
      let num = i;

      do {
        name = alphabet[num % 26] + name;
        num = Math.floor(num / 26);
      } while (num > 0 || name.length < minimumLength);

      names.push(name);
    }

    return names;
  }

  /**
   * Generate random test names
   */
  static generateRandomNames(
    count: number,
    minimumLength: number = 1,
    maxLength: number = 8
  ): string[] {
    const names: string[] = [];
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';

    for (let i = 0; i < count; i++) {
      const length = Math.max(
        minimumLength,
        Math.floor(Math.random() * (maxLength - minimumLength + 1)) + minimumLength
      );
      let name = '';

      for (let j = 0; j < length; j++) {
        name += alphabet[Math.floor(Math.random() * 26)];
      }

      names.push(name);
    }

    return names;
  }

  /**
   * Generate alphabet-based test names
   */
  static generateAlphabetNames(customAlphabet?: string): string[] {
    const alphabet = customAlphabet || 'abcdefghijklmnopqrstuvwxyz';
    return Array.from(alphabet).map((char) => char);
  }

  /**
   * Generate edge case test names
   */
  static generateEdgeCaseNames(): string[] {
    return [
      'a', // Single character
      'z', // Last alphabet character
      'aa', // Double character
      'zz', // Double last character
      'aaa', // Triple character
      'abc', // Sequential
      'xyz', // End sequential
      'abcdefghijklmnopqrstuvwxyz', // Full alphabet
    ];
  }

  /**
   * Generate CSS validity test names
   */
  static generateCssValidityNames(): { valid: string[]; invalid: string[] } {
    return {
      valid: [
        'validClassName',
        'valid-class-name',
        'valid_class_name',
        'a1',
        'class2',
        'my-component',
        '_private',
        'camelCase',
        'kebab-case',
        'snake_case',
      ],
      invalid: [
        '1invalid', // Starts with number
        '-invalid', // Starts with hyphen
        'invalid.class', // Contains dot
        'invalid class', // Contains space
        'invalid@class', // Contains @
        'invalid#class', // Contains #
        'invalid%class', // Contains %
        'invalid&class', // Contains &
      ],
    };
  }

  /**
   * Generate test CSS content
   */
  static generateTestCss(classNames: string[]): string {
    return classNames.map((className) => `.${className} { color: red; }`).join('\n');
  }

  /**
   * Generate test HTML content
   */
  static generateTestHtml(classNames: string[]): string {
    const divs = classNames
      .map((className) => `  <div class="${className}">Test content</div>`)
      .join('\n');
    return `<!DOCTYPE html>
<html>
<head>
  <title>Test HTML</title>
</head>
<body>
${divs}
</body>
</html>`;
  }

  /**
   * Generate test JavaScript content
   */
  static generateTestJs(classNames: string[]): string {
    return classNames
      .map((className) => `document.querySelector('.${className}').style.display = 'block';`)
      .join('\n');
  }
}

/**
 * Environment Variable Management for Tests
 */
export class TestEnvironment {
  private static savedEnv: Record<string, string | undefined> = {};

  /**
   * Set environment variables for testing
   */
  static setEnvVars(vars: Record<string, string>): void {
    for (const [key, value] of Object.entries(vars)) {
      this.savedEnv[key] = process.env[key];
      process.env[key] = value;
    }
  }

  /**
   * Restore original environment variables
   */
  static restoreEnvVars(): void {
    for (const [key, value] of Object.entries(this.savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    this.savedEnv = {};
  }

  /**
   * Generate test environment configuration
   */
  static generateTestEnv(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      TW_ENIGMA_NAME_GENERATION_MINIMUM_LENGTH: '3',
      TW_ENIGMA_NAME_GENERATION_STRATEGY: 'sequential',
      TW_ENIGMA_NAME_GENERATION_ALPHABET: 'abcdefghijklm',
      TW_ENIGMA_NAME_GENERATION_PREFIX: 'tw-',
      TW_ENIGMA_NAME_GENERATION_SUFFIX: '-gen',
      TW_ENIGMA_NAME_GENERATION_NUMERIC_SUFFIX: 'false',
      TW_ENIGMA_NAME_GENERATION_ENSURE_CSS_VALID: 'true',
      ...overrides,
    };
  }
}

/**
 * Fixture File Management
 */
export class FixtureManager {
  private static tempFiles: string[] = [];

  /**
   * Create temporary test file
   */
  static async createTempFile(filename: string, content: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-enigma-test-'));
    const filePath = path.join(tempDir, filename);

    await fs.writeFile(filePath, content, 'utf-8');
    this.tempFiles.push(tempDir);

    return filePath;
  }

  /**
   * Clean up temporary files
   */
  static async cleanup(): Promise<void> {
    const fs = await import('fs/promises');

    for (const tempDir of this.tempFiles) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    this.tempFiles = [];
  }

  /**
   * Create configuration file fixture
   */
  static async createConfigFixture(
    format: 'json' | 'yaml' | 'js',
    config: Partial<EnigmaConfiguration>
  ): Promise<string> {
    let content: string;
    let filename: string;

    switch (format) {
      case 'json':
        content = ConfigGenerators.generateJsonConfig(config);
        filename = 'enigma.config.json';
        break;
      case 'yaml':
        content = ConfigGenerators.generateYamlConfig(config);
        filename = 'enigma.config.yaml';
        break;
      case 'js':
        content = ConfigGenerators.generateJsConfig(config);
        filename = 'enigma.config.js';
        break;
    }

    return await this.createTempFile(filename, content);
  }
}

export default {
  ConfigGenerators,
  IntegrationTestData,
  TestEnvironment,
  FixtureManager,
};
