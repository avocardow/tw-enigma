/**
 * Configuration Fixture Generators
 *
 * Provides utilities for generating test configuration files and scenarios.
 * Supports various configuration combinations for testing.
 */

import fs from 'fs/promises';
import path from 'path';

export interface ConfigFixtureOptions {
  minimumLength?: number;
  strategy?: 'sequential' | 'random' | 'alphabet';
  alphabet?: string;
  prefix?: string;
  suffix?: string;
  numericSuffix?: boolean;
  ensureCssValid?: boolean;
  pretty?: boolean;
  input?: string;
  output?: string;
  minify?: boolean;
  removeUnused?: boolean;
  preserveComments?: boolean;
  sourceMaps?: boolean;
}

export interface ConfigTestScenario {
  name: string;
  description: string;
  options: ConfigFixtureOptions;
  expectedBehavior: string;
  validationCriteria: string[];
}

export class ConfigFixtureGenerator {
  private readonly tempPath: string;

  constructor(tempPath?: string) {
    this.tempPath = tempPath || globalThis.testEnv?.TEMP_PATH || '/tmp';
  }

  /**
   * Generate a basic config object
   */
  generateBasicConfig(options: ConfigFixtureOptions = {}): Record<string, any> {
    const config: Record<string, any> = {
      pretty: options.pretty ?? false,
      input: options.input ?? './src',
      output: options.output ?? './dist',
      minify: options.minify ?? true,
      removeUnused: options.removeUnused ?? true,
      preserveComments: options.preserveComments ?? false,
      sourceMaps: options.sourceMaps ?? false,
    };

    // Add nameGeneration if minimumLength is specified
    if (options.minimumLength !== undefined) {
      config.nameGeneration = {
        minimumLength: options.minimumLength,
        strategy: options.strategy || 'sequential',
      };

      // Add optional fields if specified
      if (options.alphabet) config.nameGeneration.alphabet = options.alphabet;
      if (options.prefix) config.nameGeneration.prefix = options.prefix;
      if (options.suffix) config.nameGeneration.suffix = options.suffix;
      if (options.numericSuffix !== undefined)
        config.nameGeneration.numericSuffix = options.numericSuffix;
      if (options.ensureCssValid !== undefined)
        config.nameGeneration.ensureCssValid = options.ensureCssValid;
    }

    return config;
  }

  /**
   * Generate JavaScript config file content
   */
  generateJavaScriptConfig(options: ConfigFixtureOptions = {}): string {
    const config = this.generateBasicConfig(options);

    let content = '// enigma.config.js\n';
    content += '// Generated configuration for Tailwind Enigma Core\n\n';
    content += 'module.exports = ';
    content += JSON.stringify(config, null, 2);
    content += ';\n';

    return content;
  }

  /**
   * Generate JSON config file content
   */
  generateJsonConfig(options: ConfigFixtureOptions = {}): string {
    const config = this.generateBasicConfig(options);
    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate TypeScript config file content
   */
  generateTypeScriptConfig(options: ConfigFixtureOptions = {}): string {
    const config = this.generateBasicConfig(options);

    let content = '// enigma.config.ts\n';
    content += '// Generated configuration for Tailwind Enigma Core\n\n';
    content += "import { Config } from '@tw-enigma/core';\n\n";
    content += 'const config: Config = ';
    content += JSON.stringify(config, null, 2);
    content += ';\n\n';
    content += 'export default config;\n';

    return content;
  }

  /**
   * Write config file to filesystem
   */
  async writeConfigFile(filename: string, content: string, directory?: string): Promise<string> {
    const targetDir = directory || this.tempPath;
    await fs.mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  /**
   * Create a temporary config file
   */
  async createTempConfigFile(
    options: ConfigFixtureOptions = {},
    format: 'js' | 'json' | 'ts' = 'js'
  ): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const filename = `enigma-test-${timestamp}-${random}.config.${format}`;

    let content: string;
    switch (format) {
      case 'js':
        content = this.generateJavaScriptConfig(options);
        break;
      case 'json':
        content = this.generateJsonConfig(options);
        break;
      case 'ts':
        content = this.generateTypeScriptConfig(options);
        break;
    }

    const filePath = await this.writeConfigFile(filename, content);

    // Register cleanup
    if (globalThis.addCleanup) {
      globalThis.addCleanup(async () => {
        await fs.unlink(filePath).catch(() => {});
      });
    }

    return filePath;
  }

  /**
   * Generate invalid config scenarios for error testing
   */
  generateInvalidConfigs(): Array<{ name: string; config: any; expectedError: string }> {
    return [
      {
        name: 'Invalid minimumLength (negative)',
        config: { nameGeneration: { minimumLength: -1 } },
        expectedError: 'minimumLength must be a positive integer',
      },
      {
        name: 'Invalid minimumLength (zero)',
        config: { nameGeneration: { minimumLength: 0 } },
        expectedError: 'minimumLength must be a positive integer',
      },
      {
        name: 'Invalid strategy',
        config: { nameGeneration: { minimumLength: 5, strategy: 'invalid' } },
        expectedError: 'strategy must be one of: sequential, random, alphabet',
      },
      {
        name: 'Empty alphabet with alphabet strategy',
        config: { nameGeneration: { minimumLength: 5, strategy: 'alphabet', alphabet: '' } },
        expectedError: 'alphabet cannot be empty when strategy is "alphabet"',
      },
      {
        name: 'Invalid input path',
        config: { input: null },
        expectedError: 'input must be a string',
      },
      {
        name: 'Invalid output path',
        config: { output: 123 },
        expectedError: 'output must be a string',
      },
    ];
  }

  /**
   * Get predefined test scenarios
   */
  getTestScenarios(): ConfigTestScenario[] {
    return [
      {
        name: 'Default Configuration',
        description: 'Basic configuration without name generation',
        options: {},
        expectedBehavior: 'Standard CSS optimization without class name changes',
        validationCriteria: [
          'Configuration should not include nameGeneration',
          'Should use default input/output paths',
          'Should enable minification and remove unused styles',
        ],
      },
      {
        name: 'Short Names (length=3)',
        description: 'Configuration with very short class names',
        options: { minimumLength: 3, strategy: 'sequential' },
        expectedBehavior: 'Generate sequential class names with minimum 3 characters',
        validationCriteria: [
          'nameGeneration.minimumLength should be 3',
          'strategy should be sequential',
          'Should generate names like "aaa", "aab", etc.',
        ],
      },
      {
        name: 'Medium Names (length=8)',
        description: 'Configuration with medium-length class names',
        options: { minimumLength: 8, strategy: 'random' },
        expectedBehavior: 'Generate random class names with minimum 8 characters',
        validationCriteria: [
          'nameGeneration.minimumLength should be 8',
          'strategy should be random',
          'Generated names should be at least 8 characters',
        ],
      },
      {
        name: 'Custom Alphabet',
        description: 'Configuration with custom character set',
        options: {
          minimumLength: 5,
          strategy: 'alphabet',
          alphabet: 'abcdef0123456789',
          prefix: 'tw-',
        },
        expectedBehavior: 'Generate names using only specified characters with prefix',
        validationCriteria: [
          'Should only use characters from alphabet',
          'All names should start with "tw-"',
          'Names should be at least 5 characters (excluding prefix)',
        ],
      },
      {
        name: 'Development Configuration',
        description: 'Configuration optimized for development',
        options: {
          minimumLength: 12,
          pretty: true,
          minify: false,
          preserveComments: true,
          sourceMaps: true,
        },
        expectedBehavior: 'Readable output with source maps for debugging',
        validationCriteria: [
          'Output should be formatted (pretty)',
          'Comments should be preserved',
          'Source maps should be generated',
          'No minification',
        ],
      },
      {
        name: 'Production Configuration',
        description: 'Configuration optimized for production',
        options: {
          minimumLength: 4,
          strategy: 'sequential',
          pretty: false,
          minify: true,
          removeUnused: true,
          preserveComments: false,
          sourceMaps: false,
        },
        expectedBehavior: 'Highly optimized output with minimal file size',
        validationCriteria: [
          'Output should be minified',
          'No comments preserved',
          'No source maps',
          'Unused styles removed',
          'Compact class names',
        ],
      },
    ];
  }

  /**
   * Create environment variable scenarios
   */
  getEnvironmentScenarios(): Array<{
    name: string;
    env: Record<string, string>;
    description: string;
  }> {
    return [
      {
        name: 'Default Environment',
        env: {},
        description: 'No environment variables set',
      },
      {
        name: 'Debug Mode',
        env: { DEBUG: 'true', LOG_LEVEL: 'debug' },
        description: 'Enable debug logging and verbose output',
      },
      {
        name: 'Production Environment',
        env: { NODE_ENV: 'production', LOG_LEVEL: 'warn' },
        description: 'Production environment with minimal logging',
      },
      {
        name: 'Custom Input/Output',
        env: {
          ENIGMA_INPUT: './custom-src',
          ENIGMA_OUTPUT: './custom-dist',
        },
        description: 'Override input/output paths via environment',
      },
    ];
  }
  /**
   * Generate minimal config for testing
   */
  generateMinimalConfig(options: Partial<ConfigFixtureOptions> = {}): Record<string, any> {
    return {
      input: options.input || './src',
      output: options.output || './dist',
      ...(options.minimumLength && {
        nameGeneration: {
          minimumLength: options.minimumLength,
          strategy: options.strategy || 'sequential',
        },
      }),
    };
  }

  /**
   * Generate config with name generation options
   */
  generateConfigWithNameGeneration(length: number, strategy?: string): Record<string, any> {
    return {
      input: './src',
      output: './dist',
      nameGeneration: {
        minimumLength: length,
        strategy: strategy || 'sequential',
      },
    };
  }

  /**
   * Generate config with complex name generation
   */
  generateComplexNameGeneration(options: ConfigFixtureOptions): Record<string, any> {
    const config = this.generateBasicConfig(options);
    return config;
  }

  /**
   * Generate invalid name generation config
   */
  generateInvalidNameGeneration(invalidField: string, invalidValue: any): Record<string, any> {
    const config = this.generateBasicConfig();
    config.nameGeneration = {
      minimumLength: 5,
      strategy: 'sequential',
      [invalidField]: invalidValue,
    };
    return config;
  }

  /**
   * Generate config with environment overrides
   */
  generateConfigWithEnvOverrides(
    baseConfig: Record<string, any>,
    envVars: Record<string, string>
  ): {
    config: Record<string, any>;
    env: Record<string, string>;
  } {
    return {
      config: baseConfig,
      env: envVars,
    };
  }
}

/**
 * Global config fixture generator
 */
export const configFixtures = new ConfigFixtureGenerator();
