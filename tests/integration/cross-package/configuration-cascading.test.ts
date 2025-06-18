import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Test setup utilities
import { CLITestHarness } from '../utils/cli-test-harness';
import { cleanupTemporaryDirectory, createTemporaryDirectory } from '../utils/test-helpers';

describe('Configuration Cascading Integration Tests', () => {
  let testDir: string;
  let cliHarness: CLITestHarness;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalCwd = process.cwd();
    originalEnv = { ...process.env };
    testDir = await createTemporaryDirectory('config-cascading');
    process.chdir(testDir);

    cliHarness = new CLITestHarness(testDir);
    await cliHarness.initialize();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    await cleanupTemporaryDirectory(testDir);
  });

  describe('Configuration Precedence Rules', () => {
    it('should prioritize CLI flags over configuration files', async () => {
      // Setup configuration file with base settings
      const configFile = {
        strategy: 'random',
        minimumLength: 3,
        seed: 12345,
        output: {
          format: 'css',
          minify: false,
          sourcemap: false,
        },
      };

      writeFileSync(join(testDir, 'base.config.json'), JSON.stringify(configFile, null, 2));

      // Execute command with CLI flag overrides
      const result = await cliHarness.execute('generate', [
        '--config',
        'base.config.json',
        '--count',
        '10',
        '--output',
        'output.css',
        '--length',
        '8', // Override minimumLength
        '--strategy',
        'sequential', // Override strategy
        '--minify', // Override minify
        '--sourcemap', // Override sourcemap
      ]);

      expect(result.success).toBe(true);

      // Verify CLI flags took precedence
      const output = result.stdout;
      expect(output).toContain('Strategy: sequential'); // CLI override
      expect(output).toContain('Minimum length: 8'); // CLI override
      expect(output).toContain('Minification: enabled'); // CLI override
      expect(output).toContain('Sourcemap: enabled'); // CLI override
      expect(output).toContain('Seed: 12345'); // From config file
    });

    it('should prioritize environment variables over configuration files', async () => {
      // Setup configuration file
      const configFile = {
        strategy: 'alphabet',
        minimumLength: 4,
        output: {
          format: 'scss',
          destination: 'default-output.scss',
        },
      };

      writeFileSync(join(testDir, 'config.json'), JSON.stringify(configFile, null, 2));

      // Set environment variables
      process.env.TW_ENIGMA_STRATEGY = 'random';
      process.env.TW_ENIGMA_MIN_LENGTH = '6';
      process.env.TW_ENIGMA_OUTPUT_FORMAT = 'css';
      process.env.TW_ENIGMA_SEED = '98765';

      const result = await cliHarness.execute('generate', [
        '--config',
        'config.json',
        '--count',
        '5',
        '--output',
        'env-output.css',
      ]);

      expect(result.success).toBe(true);

      // Verify environment variables took precedence
      const output = result.stdout;
      expect(output).toContain('Strategy: random'); // From env
      expect(output).toContain('Minimum length: 6'); // From env
      expect(output).toContain('Output format: css'); // From env
      expect(output).toContain('Seed: 98765'); // From env
    });

    it('should prioritize CLI flags over environment variables', async () => {
      // Setup environment variables
      process.env.TW_ENIGMA_STRATEGY = 'alphabet';
      process.env.TW_ENIGMA_MIN_LENGTH = '5';
      process.env.TW_ENIGMA_OUTPUT_FORMAT = 'scss';

      const result = await cliHarness.execute('generate', [
        '--count',
        '7',
        '--output',
        'cli-priority.css',
        '--length',
        '10', // Override env variable
        '--strategy',
        'sequential', // Override env variable
        '--format',
        'css', // Override env variable
      ]);

      expect(result.success).toBe(true);

      // Verify CLI flags took highest precedence
      const output = result.stdout;
      expect(output).toContain('Strategy: sequential'); // CLI override
      expect(output).toContain('Minimum length: 10'); // CLI override
      expect(output).toContain('Output format: css'); // CLI override
    });
  });

  describe('Multi-Level Configuration Merging', () => {
    it('should merge global, environment, and local configurations', async () => {
      // Setup global configuration
      const globalConfig = {
        defaults: {
          strategy: 'sequential',
          minimumLength: 2,
          preserveOriginal: true,
        },
        output: {
          format: 'css',
          minify: true,
          sourcemap: false,
        },
      };

      // Setup environment-specific configuration
      const envConfig = {
        development: {
          minimumLength: 4,
          sourcemap: true,
          verbose: true,
          debug: true,
        },
        production: {
          minimumLength: 1,
          minify: true,
          removeUnused: true,
          verbose: false,
        },
      };

      // Setup local project configuration
      const localConfig = {
        strategy: 'random',
        seed: 42,
        input: {
          files: ['src/**/*.html', 'components/**/*.tsx'],
        },
        customOptions: {
          prefix: 'app-',
          suffix: '-gen',
        },
      };

      writeFileSync(join(testDir, 'global.config.json'), JSON.stringify(globalConfig, null, 2));
      writeFileSync(join(testDir, 'env.config.json'), JSON.stringify(envConfig, null, 2));
      writeFileSync(join(testDir, 'local.config.json'), JSON.stringify(localConfig, null, 2));

      // Test development environment merging
      process.env.NODE_ENV = 'development';

      const devResult = await cliHarness.execute('generate', [
        '--global-config',
        'global.config.json',
        '--env-config',
        'env.config.json',
        '--config',
        'local.config.json',
        '--count',
        '8',
        '--output',
        'dev-merged.css',
      ]);

      expect(devResult.success).toBe(true);

      const devOutput = devResult.stdout;

      // Verify proper merging precedence
      expect(devOutput).toContain('Strategy: random'); // Local override
      expect(devOutput).toContain('Minimum length: 4'); // Environment override
      expect(devOutput).toContain('Sourcemap: enabled'); // Environment override
      expect(devOutput).toContain('Minification: enabled'); // Global setting
      expect(devOutput).toContain('Preserve original: true'); // Global setting
      expect(devOutput).toContain('Seed: 42'); // Local setting
      expect(devOutput).toContain('Prefix: app-'); // Local setting
      expect(devOutput).toContain('Verbose: enabled'); // Environment setting
      expect(devOutput).toContain('Debug: enabled'); // Environment setting

      // Test production environment merging
      process.env.NODE_ENV = 'production';

      const prodResult = await cliHarness.execute('generate', [
        '--global-config',
        'global.config.json',
        '--env-config',
        'env.config.json',
        '--config',
        'local.config.json',
        '--count',
        '8',
        '--output',
        'prod-merged.css',
      ]);

      expect(prodResult.success).toBe(true);

      const prodOutput = prodResult.stdout;

      // Verify production-specific merging
      expect(prodOutput).toContain('Strategy: random'); // Local override
      expect(prodOutput).toContain('Minimum length: 1'); // Production override
      expect(prodOutput).toContain('Remove unused: enabled'); // Production setting
      expect(prodOutput).toContain('Verbose: disabled'); // Production setting
      expect(prodOutput).not.toContain('Debug: enabled'); // Not in production
    });

    it('should handle nested configuration merging', async () => {
      // Setup base configuration with nested structures
      const baseConfig = {
        processing: {
          strategy: 'alphabet',
          minimumLength: 3,
          optimization: {
            removeUnused: false,
            minify: false,
            deduplicate: true,
          },
          validation: {
            strictMode: false,
            allowEmptyClasses: true,
            maxClassLength: 1000,
          },
        },
        output: {
          format: 'css',
          destination: 'dist/output.css',
          assets: {
            generateSourcemap: false,
            inlineAssets: false,
            compressionLevel: 6,
          },
        },
      };

      // Setup override configuration
      const overrideConfig = {
        processing: {
          minimumLength: 5, // Override
          optimization: {
            removeUnused: true, // Override
            minify: true, // Override
            // deduplicate: inherit from base
          },
          validation: {
            strictMode: true, // Override
            maxClassLength: 500, // Override
            // allowEmptyClasses: inherit from base
          },
        },
        output: {
          assets: {
            generateSourcemap: true, // Override
            compressionLevel: 9, // Override
            // inlineAssets: inherit from base
          },
          // format, destination: inherit from base
        },
      };

      writeFileSync(join(testDir, 'base.config.json'), JSON.stringify(baseConfig, null, 2));
      writeFileSync(join(testDir, 'override.config.json'), JSON.stringify(overrideConfig, null, 2));

      const result = await cliHarness.execute('process', [
        '--config',
        'base.config.json',
        '--override-config',
        'override.config.json',
        'test.html',
        '--output',
        'nested-merged.css',
      ]);

      expect(result.success).toBe(true);

      const output = result.stdout;

      // Verify nested merging results
      expect(output).toContain('Strategy: alphabet'); // Base
      expect(output).toContain('Minimum length: 5'); // Override
      expect(output).toContain('Remove unused: enabled'); // Override
      expect(output).toContain('Minification: enabled'); // Override
      expect(output).toContain('Deduplication: enabled'); // Base (inherited)
      expect(output).toContain('Strict mode: enabled'); // Override
      expect(output).toContain('Allow empty classes: true'); // Base (inherited)
      expect(output).toContain('Max class length: 500'); // Override
      expect(output).toContain('Output format: css'); // Base (inherited)
      expect(output).toContain('Generate sourcemap: enabled'); // Override
      expect(output).toContain('Inline assets: false'); // Base (inherited)
      expect(output).toContain('Compression level: 9'); // Override
    });
  });

  describe('Dynamic Configuration Loading', () => {
    it('should support configuration functions and computed values', async () => {
      // Setup configuration with functions and computed values
      const dynamicConfigContent = `
        module.exports = function(env) {
          const baseLength = env === 'production' ? 1 : 3;
          const timestamp = Date.now();

          return {
            strategy: env === 'production' ? 'random' : 'sequential',
            minimumLength: baseLength + (env === 'development' ? 2 : 0),
            seed: timestamp % 10000,
            output: {
              format: 'css',
              destination: \`dist/output-\${env}-\${timestamp}.css\`,
              metadata: {
                buildTime: new Date().toISOString(),
                environment: env,
                version: '1.0.0'
              }
            },
            optimization: {
              removeUnused: env === 'production',
              minify: env === 'production',
              deduplicate: true
            }
          };
        };
      `;

      writeFileSync(join(testDir, 'dynamic.config.js'), dynamicConfigContent);

      // Test development environment
      process.env.NODE_ENV = 'development';

      const devResult = await cliHarness.execute('generate', [
        '--config',
        'dynamic.config.js',
        '--count',
        '6',
        '--output',
        'dynamic-dev.css',
      ]);

      expect(devResult.success).toBe(true);

      const devOutput = devResult.stdout;
      expect(devOutput).toContain('Strategy: sequential'); // Development mode
      expect(devOutput).toContain('Minimum length: 5'); // 3 + 2 for development
      expect(devOutput).toContain('Remove unused: disabled'); // Development mode
      expect(devOutput).toContain('Minification: disabled'); // Development mode
      expect(devOutput).toContain('Environment: development');

      // Test production environment
      process.env.NODE_ENV = 'production';

      const prodResult = await cliHarness.execute('generate', [
        '--config',
        'dynamic.config.js',
        '--count',
        '6',
        '--output',
        'dynamic-prod.css',
      ]);

      expect(prodResult.success).toBe(true);

      const prodOutput = prodResult.stdout;
      expect(prodOutput).toContain('Strategy: random'); // Production mode
      expect(prodOutput).toContain('Minimum length: 1'); // 1 + 0 for production
      expect(prodOutput).toContain('Remove unused: enabled'); // Production mode
      expect(prodOutput).toContain('Minification: enabled'); // Production mode
      expect(prodOutput).toContain('Environment: production');
    });

    it('should support conditional configuration based on project structure', async () => {
      // Setup project structure
      mkdirSync(join(testDir, 'src'), { recursive: true });
      mkdirSync(join(testDir, 'components'), { recursive: true });
      mkdirSync(join(testDir, 'pages'), { recursive: true });

      writeFileSync(
        join(testDir, 'src/app.tsx'),
        'export const App = () => <div className="app">App</div>;'
      );
      writeFileSync(
        join(testDir, 'components/Button.tsx'),
        'export const Button = () => <button className="btn">Button</button>;'
      );
      writeFileSync(join(testDir, 'pages/index.html'), '<div class="page">Page</div>');
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            react: '^18.0.0',
            tailwindcss: '^3.0.0',
          },
        })
      );

      // Setup conditional configuration
      const conditionalConfigContent = `
        const fs = require('fs');
        const path = require('path');

        module.exports = function() {
          const hasReact = fs.existsSync(path.join(process.cwd(), 'package.json')) &&
            JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'))
              .dependencies?.react;

          const hasTailwind = fs.existsSync(path.join(process.cwd(), 'package.json')) &&
            JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'))
              .dependencies?.tailwindcss;

          const srcExists = fs.existsSync(path.join(process.cwd(), 'src'));
          const componentsExists = fs.existsSync(path.join(process.cwd(), 'components'));

          return {
            strategy: hasReact ? 'random' : 'sequential',
            minimumLength: hasTailwind ? 2 : 4,
            input: {
              files: [
                ...(srcExists ? ['src/**/*.{tsx,jsx,ts,js}'] : []),
                ...(componentsExists ? ['components/**/*.{tsx,jsx,ts,js}'] : []),
                'pages/**/*.{html,tsx,jsx}'
              ].filter(Boolean),
              extensions: hasReact ? ['.tsx', '.jsx'] : ['.html', '.js']
            },
            processing: {
              framework: hasReact ? 'react' : 'vanilla',
              tailwindCompatible: hasTailwind,
              preserveJSX: hasReact
            },
            output: {
              format: hasTailwind ? 'css' : 'scss',
              framework: hasReact ? 'react' : 'html'
            }
          };
        };
      `;

      writeFileSync(join(testDir, 'conditional.config.js'), conditionalConfigContent);

      const result = await cliHarness.execute('analyze', [
        '--config',
        'conditional.config.js',
        '--output',
        'conditional-analysis.json',
      ]);

      expect(result.success).toBe(true);

      const output = result.stdout;

      // Verify conditional configuration was applied
      expect(output).toContain('Strategy: random'); // React detected
      expect(output).toContain('Minimum length: 2'); // Tailwind detected
      expect(output).toContain('Framework: react'); // React detected
      expect(output).toContain('Tailwind compatible: true'); // Tailwind detected
      expect(output).toContain('Preserve JSX: true'); // React detected
      expect(output).toContain('Output format: css'); // Tailwind detected
      expect(output).toContain('Extensions: .tsx, .jsx'); // React detected

      // Verify input files were detected correctly
      expect(output).toContain('src/**/*.{tsx,jsx,ts,js}');
      expect(output).toContain('components/**/*.{tsx,jsx,ts,js}');
      expect(output).toContain('pages/**/*.{html,tsx,jsx}');
    });
  });

  describe('Configuration Validation and Error Handling', () => {
    it('should validate configuration schema and provide helpful errors', async () => {
      // Setup invalid configuration
      const invalidConfig = {
        strategy: 'invalid-strategy',
        minimumLength: 'not-a-number',
        seed: -1,
        output: {
          format: 'unknown-format',
          destination: null,
        },
        processing: {
          optimization: 'should-be-object',
        },
      };

      writeFileSync(join(testDir, 'invalid.config.json'), JSON.stringify(invalidConfig, null, 2));

      const result = await cliHarness.execute('generate', [
        '--config',
        'invalid.config.json',
        '--count',
        '5',
      ]);

      expect(result.success).toBe(false);

      const errorOutput = result.stderr;

      // Verify detailed validation errors
      expect(errorOutput).toContain('Configuration validation failed');
      expect(errorOutput).toContain('Invalid strategy: "invalid-strategy"');
      expect(errorOutput).toContain('Expected valid strategies: sequential, random, alphabet');
      expect(errorOutput).toContain('minimumLength must be a positive number');
      expect(errorOutput).toContain('seed must be a positive number');
      expect(errorOutput).toContain('Invalid output format: "unknown-format"');
      expect(errorOutput).toContain('Expected formats: css, scss, sass');
      expect(errorOutput).toContain('output.destination cannot be null');
      expect(errorOutput).toContain('processing.optimization must be an object');
    });

    it('should handle configuration file loading errors gracefully', async () => {
      // Test missing configuration file
      const missingResult = await cliHarness.execute('generate', [
        '--config',
        'nonexistent.config.json',
        '--count',
        '3',
      ]);

      expect(missingResult.success).toBe(false);
      expect(missingResult.stderr).toContain(
        'Configuration file not found: nonexistent.config.json'
      );
      expect(missingResult.stderr).toContain(
        'Please check the file path and ensure the file exists'
      );

      // Test malformed JSON configuration
      writeFileSync(
        join(testDir, 'malformed.config.json'),
        '{ "strategy": "sequential", "invalid": }'
      );

      const malformedResult = await cliHarness.execute('generate', [
        '--config',
        'malformed.config.json',
        '--count',
        '3',
      ]);

      expect(malformedResult.success).toBe(false);
      expect(malformedResult.stderr).toContain(
        'Failed to parse configuration file: malformed.config.json'
      );
      expect(malformedResult.stderr).toContain('Invalid JSON syntax');

      // Test JavaScript configuration with syntax errors
      writeFileSync(
        join(testDir, 'syntax-error.config.js'),
        'module.exports = { strategy: "sequential", invalid syntax here }'
      );

      const syntaxErrorResult = await cliHarness.execute('generate', [
        '--config',
        'syntax-error.config.js',
        '--count',
        '3',
      ]);

      expect(syntaxErrorResult.success).toBe(false);
      expect(syntaxErrorResult.stderr).toContain(
        'Failed to load configuration file: syntax-error.config.js'
      );
      expect(syntaxErrorResult.stderr).toContain('Syntax error in JavaScript configuration');
    });

    it('should provide configuration merge conflict resolution', async () => {
      // Setup conflicting configurations
      const config1 = {
        strategy: 'sequential',
        minimumLength: 3,
        output: { format: 'css' },
      };

      const config2 = {
        strategy: 'random', // Conflict
        minimumLength: 5, // Conflict
        output: { format: 'scss' }, // Conflict
      };

      writeFileSync(join(testDir, 'config1.json'), JSON.stringify(config1, null, 2));
      writeFileSync(join(testDir, 'config2.json'), JSON.stringify(config2, null, 2));

      // Test conflict detection and resolution
      const result = await cliHarness.execute('generate', [
        '--config',
        'config1.json',
        '--override-config',
        'config2.json',
        '--count',
        '4',
        '--resolve-conflicts',
        'merge-favor-override',
        '--verbose',
      ]);

      expect(result.success).toBe(true);

      const output = result.stdout;

      // Verify conflict resolution
      expect(output).toContain('Configuration conflicts detected');
      expect(output).toContain('strategy: "sequential" → "random" (resolved: "random")');
      expect(output).toContain('minimumLength: 3 → 5 (resolved: 5)');
      expect(output).toContain('output.format: "css" → "scss" (resolved: "scss")');
      expect(output).toContain('Conflict resolution strategy: merge-favor-override');

      // Verify final configuration
      expect(output).toContain('Strategy: random'); // Override won
      expect(output).toContain('Minimum length: 5'); // Override won
      expect(output).toContain('Output format: scss'); // Override won
    });
  });
});
