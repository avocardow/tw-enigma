import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Test setup utilities
import { CLITestHarness } from '../utils/cli-test-harness';
import { validateIntegrationBoundary } from '../utils/integration-assertions';
import { cleanupTemporaryDirectory, createTemporaryDirectory } from '../utils/test-helpers';

describe('CLI-Core Integration Tests', () => {
  let testDir: string;
  let cliHarness: CLITestHarness;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await createTemporaryDirectory('cli-core-integration');
    process.chdir(testDir);

    cliHarness = new CLITestHarness(testDir);
    await cliHarness.initialize();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTemporaryDirectory(testDir);
  });

  describe('Command-to-Core Operation Mapping', () => {
    it('should correctly map CLI analyze command to core analysis operations', async () => {
      // Setup test HTML file
      const htmlContent = `
        <html>
          <body>
            <div class="container mx-auto p-4 bg-blue-500 text-white">
              <h1 class="text-2xl font-bold mb-4">Test Page</h1>
              <p class="text-lg opacity-75">Sample content</p>
            </div>
          </body>
        </html>
      `;

      writeFileSync(join(testDir, 'index.html'), htmlContent);

      // Execute CLI analyze command
      const result = await cliHarness.execute('analyze', [
        'index.html',
        '--output',
        'analysis-results.json',
        '--length',
        '3',
      ]);

      expect(result.success).toBe(true);
      expect(result.stderr).toBe('');

      // Validate core operations were triggered
      const analysisFile = join(testDir, 'analysis-results.json');
      expect(existsSync(analysisFile)).toBe(true);

      const analysisResults = JSON.parse(readFileSync(analysisFile, 'utf-8'));

      // Verify core analysis operations
      expect(analysisResults).toHaveProperty('usedClasses');
      expect(analysisResults).toHaveProperty('unusedClasses');
      expect(analysisResults).toHaveProperty('statistics');

      // Verify --length parameter was passed to core
      expect(analysisResults.usedClasses.every((cls: string) => cls.length >= 3)).toBe(true);
    });

    it('should map CLI optimize command to core optimization pipeline', async () => {
      // Setup test files
      const htmlContent = `
        <div class="flex items-center justify-center min-h-screen bg-gray-100">
          <div class="max-w-md mx-auto bg-white rounded-xl shadow-md">
            <div class="p-8">
              <h2 class="text-xl font-medium text-gray-900 mb-4">Optimization Test</h2>
              <p class="text-gray-600">This tests the optimization pipeline.</p>
            </div>
          </div>
        </div>
      `;

      writeFileSync(join(testDir, 'test.html'), htmlContent);

      // Execute CLI optimize command
      const result = await cliHarness.execute('optimize', [
        'test.html',
        '--output',
        'optimized.css',
        '--length',
        '4',
      ]);

      expect(result.success).toBe(true);

      // Validate optimization results
      const optimizedCss = readFileSync(join(testDir, 'optimized.css'), 'utf-8');

      // Verify core optimization operations
      expect(optimizedCss).toContain('.flex');
      expect(optimizedCss).toContain('.items-center');
      expect(optimizedCss).toContain('.justify-center');
      expect(optimizedCss).toContain('.min-h-screen');

      // Verify --length parameter applied to generated names
      const customClassMatches = optimizedCss.match(/\.[a-zA-Z0-9-_]{4,}/g);
      expect(customClassMatches).toBeTruthy();
    });

    it('should map CLI generate command to core generation strategies', async () => {
      // Setup configuration for generation
      const generationConfig = {
        strategy: 'sequential',
        minimumLength: 5,
        prefix: 'tw-',
        outputFormat: 'css',
      };

      writeFileSync(
        join(testDir, 'generation.config.json'),
        JSON.stringify(generationConfig, null, 2)
      );

      // Execute CLI generate command
      const result = await cliHarness.execute('generate', [
        '--config',
        'generation.config.json',
        '--count',
        '10',
        '--output',
        'generated-classes.css',
        '--length',
        '6',
      ]);

      expect(result.success).toBe(true);

      // Validate generation results
      const generatedCss = readFileSync(join(testDir, 'generated-classes.css'), 'utf-8');

      // Verify core generation strategy was applied
      const generatedClasses = generatedCss.match(/\.tw-[a-zA-Z0-9]+/g);
      expect(generatedClasses).toBeTruthy();
      expect(generatedClasses!.length).toBeGreaterThanOrEqual(10);

      // Verify --length override was applied
      generatedClasses?.forEach((cls) => {
        const className = cls.substring(1); // Remove the dot
        expect(className.length).toBeGreaterThanOrEqual(6);
      });
    });
  });

  describe('Data Flow Validation', () => {
    it('should maintain data integrity across CLI-Core boundary', async () => {
      // Setup complex configuration
      const complexConfig = {
        processing: {
          strategy: 'alphabet',
          minimumLength: 3,
          preserveOriginal: true,
          optimization: {
            removeUnused: true,
            minify: true,
            deduplicate: true,
          },
        },
        output: {
          format: 'css',
          destination: 'dist/optimized.css',
          sourcemap: true,
        },
      };

      writeFileSync(join(testDir, 'complex.config.json'), JSON.stringify(complexConfig, null, 2));

      // Execute CLI command with complex data flow
      const result = await cliHarness.execute('process', [
        '--config',
        'complex.config.json',
        '--verbose',
        '--length',
        '4',
      ]);

      expect(result.success).toBe(true);

      // Validate data integrity
      const processingLog = result.stdout;

      // Verify configuration was passed correctly
      expect(processingLog).toContain('Processing strategy: alphabet');
      expect(processingLog).toContain('Minimum length: 4'); // Should show override
    });

    it('should handle configuration cascading between CLI and Core', async () => {
      // Setup base configuration
      const baseConfig = {
        strategy: 'random',
        minimumLength: 2,
        seed: 12345,
        output: {
          format: 'scss',
        },
      };

      // Setup environment-specific overrides
      const envConfig = {
        development: {
          minimumLength: 3,
          sourcemap: true,
          verbose: true,
        },
        production: {
          minimumLength: 1,
          minify: true,
          removeUnused: true,
        },
      };

      writeFileSync(join(testDir, 'base.config.json'), JSON.stringify(baseConfig, null, 2));
      writeFileSync(join(testDir, 'env.config.json'), JSON.stringify(envConfig, null, 2));

      // Test development environment cascading
      process.env.NODE_ENV = 'development';

      const devResult = await cliHarness.execute('generate', [
        '--config',
        'base.config.json',
        '--env-config',
        'env.config.json',
        '--count',
        '5',
        '--output',
        'dev-output.scss',
        '--length',
        '4', // CLI override
      ]);

      expect(devResult.success).toBe(true);

      // Verify cascading: CLI (4) > env.development (3) > base (2)
      const devOutput = readFileSync(join(testDir, 'dev-output.scss'), 'utf-8');
      const devClasses = devOutput.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);
      devClasses?.forEach((cls) => {
        expect(cls.length).toBeGreaterThanOrEqual(5); // CLI override should win
      });

      // Cleanup
      delete process.env.NODE_ENV;
    });

    it('should preserve error context across package boundaries', async () => {
      // Setup invalid configuration that should trigger core errors
      const invalidConfig = {
        strategy: 'invalid-strategy',
        minimumLength: -5,
        output: {
          format: 'invalid-format',
          destination: '/invalid/path/output.css',
        },
      };

      writeFileSync(join(testDir, 'invalid.config.json'), JSON.stringify(invalidConfig, null, 2));

      // Execute CLI command that should fail
      const result = await cliHarness.execute('process', [
        '--config',
        'invalid.config.json',
        '--length',
        'invalid-length',
      ]);

      expect(result.success).toBe(false);

      // Verify error context preservation
      const errorOutput = result.stderr;

      // Should contain CLI-level errors
      expect(errorOutput).toContain('Invalid --length parameter');

      // Should contain Core-level errors with context
      expect(errorOutput).toContain('Invalid strategy: invalid-strategy');
      expect(errorOutput).toContain('Minimum length must be positive');
      expect(errorOutput).toContain('Invalid output format: invalid-format');

      // Should maintain error hierarchy
      expect(errorOutput).toMatch(/CLI Error:.*Core Error:/s);

      // Should include helpful suggestions
      expect(errorOutput).toContain('Valid strategies: sequential, random, alphabet');
      expect(errorOutput).toContain('Valid formats: css, scss, sass');
    });
  });

  describe('Integration Boundary Validation', () => {
    it('should validate CLI-Core API contract', async () => {
      // Test that CLI properly implements Core API contract
      const coreApiTest = await validateIntegrationBoundary({
        packageA: '@tw-enigma/cli',
        packageB: '@tw-enigma/core',
        interface: 'ProcessingAPI',
        testDir,
      });

      expect(coreApiTest.isValid).toBe(true);
      expect(coreApiTest.violations).toHaveLength(0);

      // Verify required methods are implemented
      expect(coreApiTest.implementedMethods).toContain('analyze');
      expect(coreApiTest.implementedMethods).toContain('optimize');
      expect(coreApiTest.implementedMethods).toContain('generate');
      expect(coreApiTest.implementedMethods).toContain('process');

      // Verify method signatures match
      expect(coreApiTest.signatureMatches).toHaveProperty('analyze', true);
      expect(coreApiTest.signatureMatches).toHaveProperty('optimize', true);
      expect(coreApiTest.signatureMatches).toHaveProperty('generate', true);
      expect(coreApiTest.signatureMatches).toHaveProperty('process', true);
    });

    it('should validate configuration interface consistency', async () => {
      // Test configuration interface between packages
      const configApiTest = await validateIntegrationBoundary({
        packageA: '@tw-enigma/cli',
        packageB: '@tw-enigma/core',
        interface: 'ConfigurationAPI',
        testDir,
      });

      expect(configApiTest.isValid).toBe(true);

      // Verify configuration schema consistency
      expect(configApiTest.schemaMatches).toHaveProperty('ProcessingConfig', true);
      expect(configApiTest.schemaMatches).toHaveProperty('NameGenerationOptions', true);
      expect(configApiTest.schemaMatches).toHaveProperty('OutputConfig', true);
      expect(configApiTest.schemaMatches).toHaveProperty('ValidationConfig', true);

      // Verify type compatibility
      expect(configApiTest.typeCompatibility).toHaveProperty('minimumLength', true);
      expect(configApiTest.typeCompatibility).toHaveProperty('strategy', true);
      expect(configApiTest.typeCompatibility).toHaveProperty('outputFormat', true);
    });

    it('should maintain version compatibility across packages', async () => {
      // Read package.json files
      const cliPackageJson = JSON.parse(
        readFileSync(join(process.cwd(), '../../packages/cli/package.json'), 'utf-8')
      );
      const corePackageJson = JSON.parse(
        readFileSync(join(process.cwd(), '../../packages/core/package.json'), 'utf-8')
      );

      // Verify dependency versions
      expect(cliPackageJson.dependencies).toHaveProperty('@tw-enigma/core');

      const cliCoreVersion = cliPackageJson.dependencies['@tw-enigma/core'];
      const actualCoreVersion = corePackageJson.version;

      // Should use workspace protocol or compatible version
      expect(
        cliCoreVersion === 'workspace:*' ||
          cliCoreVersion === `^${actualCoreVersion}` ||
          cliCoreVersion === actualCoreVersion
      ).toBe(true);

      // Verify peer dependencies if any
      if (cliPackageJson.peerDependencies?.['@tw-enigma/core']) {
        const peerVersion = cliPackageJson.peerDependencies['@tw-enigma/core'];
        expect(peerVersion).toMatch(/^[\^~]?\d+\.\d+\.\d+/);
      }
    });
  });

  describe('Global Length Override Integration', () => {
    it('should apply global --length to all Core operations', async () => {
      // Setup mixed operation test
      const htmlContent = `
        <div class="a b c long-class-name very-long-class-name">
          <span class="x y z medium-length ultra-long-class-name-test">Content</span>
        </div>
      `;

      const configContent = {
        strategy: 'sequential',
        minimumLength: 2,
        output: {
          format: 'css',
        },
      };

      writeFileSync(join(testDir, 'test.html'), htmlContent);
      writeFileSync(join(testDir, 'config.json'), JSON.stringify(configContent, null, 2));

      // Test global length override
      const result = await cliHarness.execute('process', [
        'test.html',
        '--config',
        'config.json',
        '--output',
        'processed.css',
        '--length',
        '6', // Global override
      ]);

      expect(result.success).toBe(true);

      // Verify all operations respect global length
      const processedCss = readFileSync(join(testDir, 'processed.css'), 'utf-8');

      // All generated class names should meet minimum length
      const generatedClasses = processedCss.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);
      generatedClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(6);
      });

      // Should include original classes that meet length requirement
      expect(processedCss).toContain('.long-class-name');
      expect(processedCss).toContain('.very-long-class-name');
      expect(processedCss).toContain('.medium-length');
      expect(processedCss).toContain('.ultra-long-class-name-test');

      // Should generate new names for classes that don't meet requirement
      expect(processedCss).not.toContain('.a {');
      expect(processedCss).not.toContain('.b {');
      expect(processedCss).not.toContain('.c {');
      expect(processedCss).not.toContain('.x {');
      expect(processedCss).not.toContain('.y {');
      expect(processedCss).not.toContain('.z {');
    });

    it('should validate length parameter across all CLI commands', async () => {
      // Test each CLI command with global length parameter
      const testCommands = [
        ['analyze', ['test.html']],
        ['optimize', ['test.html', '--output', 'opt.css']],
        ['generate', ['--count', '5', '--output', 'gen.css']],
        ['process', ['test.html', '--output', 'proc.css']],
      ];

      // Setup basic test file
      writeFileSync(join(testDir, 'test.html'), '<div class="test">Content</div>');

      for (const [command, baseArgs] of testCommands) {
        // Test valid length parameter
        const validResult = await cliHarness.execute(command, [...baseArgs, '--length', '5']);

        expect(validResult.success).toBe(true);
        expect(validResult.stderr).not.toContain('Invalid --length');

        // Test invalid length parameter
        const invalidResult = await cliHarness.execute(command, [
          ...baseArgs,
          '--length',
          'invalid',
        ]);

        expect(invalidResult.success).toBe(false);
        expect(invalidResult.stderr).toContain('Invalid --length parameter');

        // Test negative length parameter
        const negativeResult = await cliHarness.execute(command, [...baseArgs, '--length', '-1']);

        expect(negativeResult.success).toBe(false);
        expect(negativeResult.stderr).toContain('Length must be positive');
      }
    });
  });

  describe('Error Propagation Across Packages', () => {
    it('should propagate Core validation errors through CLI', async () => {
      // Setup configuration that will trigger Core validation errors
      const invalidConfig = {
        strategy: 'sequential',
        minimumLength: 1001, // Exceeds maximum allowed
        seed: 'invalid-seed-type',
        output: {
          format: 'css',
          destination: null, // Invalid destination
        },
      };

      writeFileSync(join(testDir, 'invalid.json'), JSON.stringify(invalidConfig, null, 2));

      const result = await cliHarness.execute('generate', [
        '--config',
        'invalid.json',
        '--count',
        '10',
        '--length',
        '2000', // Also invalid
      ]);

      expect(result.success).toBe(false);

      // Verify error propagation
      const errorOutput = result.stderr;

      // CLI-level validation errors
      expect(errorOutput).toContain('Invalid --length parameter: exceeds maximum allowed (1000)');

      // Core-level validation errors
      expect(errorOutput).toContain('Configuration validation failed');
      expect(errorOutput).toContain('minimumLength exceeds maximum allowed value');
      expect(errorOutput).toContain('Invalid seed type: expected number');
      expect(errorOutput).toContain('Output destination cannot be null');

      // Error categorization
      expect(errorOutput).toContain('[CLI_ERROR]');
      expect(errorOutput).toContain('[CORE_ERROR]');
      expect(errorOutput).toContain('[VALIDATION_ERROR]');
    });

    it('should handle Core processing errors gracefully', async () => {
      // Setup scenario that will cause Core processing errors
      const corruptedHtml = `
        <div class="test-class">
          <span class="${'x'.repeat(10000)}">Extremely long class name</span>
          <div class="$invalid-characters@#%">Invalid characters</div>
          <!-- Malformed HTML structure -->
        </div>
        <div class="another-test
      `; // Intentionally malformed

      writeFileSync(join(testDir, 'corrupted.html'), corruptedHtml);

      const result = await cliHarness.execute('analyze', [
        'corrupted.html',
        '--strict',
        '--length',
        '3',
      ]);

      expect(result.success).toBe(false);

      // Verify graceful error handling
      const errorOutput = result.stderr;

      expect(errorOutput).toContain('Processing failed for file: corrupted.html');
      expect(errorOutput).toContain('Class name exceeds maximum length');
      expect(errorOutput).toContain('Invalid characters in class name');
      expect(errorOutput).toContain('Malformed HTML structure detected');

      // Should provide recovery suggestions
      expect(errorOutput).toContain('Try using --lenient mode');
      expect(errorOutput).toContain('Consider preprocessing the HTML file');

      // Should not crash the entire process
      expect(result.exitCode).toBe(1); // Controlled exit
    });
  });
});
