import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Test setup utilities
import { CLITestHarness } from '../utils/cli-test-harness';
import { cleanupTemporaryDirectory, createTemporaryDirectory } from '../utils/test-helpers';

describe('Global Length Override Integration Tests', () => {
  let testDir: string;
  let cliHarness: CLITestHarness;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await createTemporaryDirectory('global-length-override');
    process.chdir(testDir);

    cliHarness = new CLITestHarness(testDir);
    await cliHarness.initialize();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTemporaryDirectory(testDir);
  });

  describe('Length Override Precedence', () => {
    it('should override configuration file minimumLength with --length flag', async () => {
      // Setup configuration with specific minimumLength
      const config = {
        strategy: 'sequential',
        minimumLength: 2,
        output: {
          format: 'css',
        },
      };

      writeFileSync(join(testDir, 'config.json'), JSON.stringify(config, null, 2));

      // Test --length override
      const result = await cliHarness.execute('generate', [
        '--config',
        'config.json',
        '--count',
        '10',
        '--output',
        'length-override.css',
        '--length',
        '8', // Should override config minimumLength: 2
      ]);

      expect(result.success).toBe(true);

      // Verify override was applied
      const outputCss = readFileSync(join(testDir, 'length-override.css'), 'utf-8');
      const generatedClasses = outputCss.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);

      generatedClasses?.forEach((cls) => {
        const className = cls.substring(1); // Remove the dot
        expect(className.length).toBeGreaterThanOrEqual(8);
      });

      // Verify configuration file value was not used
      generatedClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).not.toBe(2); // Should not use config value
      });
    });

    it('should override environment variable with --length flag', async () => {
      // Setup environment variable
      process.env.TW_ENIGMA_MIN_LENGTH = '3';

      const result = await cliHarness.execute('generate', [
        '--count',
        '8',
        '--output',
        'env-override.css',
        '--length',
        '12', // Should override env variable
      ]);

      expect(result.success).toBe(true);

      // Verify CLI flag took precedence over environment variable
      const outputCss = readFileSync(join(testDir, 'env-override.css'), 'utf-8');
      const generatedClasses = outputCss.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);

      generatedClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(12);
        expect(className.length).not.toBe(3); // Should not use env value
      });

      // Cleanup
      delete process.env.TW_ENIGMA_MIN_LENGTH;
    });

    it('should override nested configuration with --length flag', async () => {
      // Setup nested configuration
      const nestedConfig = {
        processing: {
          nameGeneration: {
            strategy: 'alphabet',
            options: {
              minimumLength: 4,
              maximumLength: 20,
              prefix: 'cls-',
            },
          },
          optimization: {
            removeUnused: true,
            minify: false,
          },
        },
        output: {
          format: 'scss',
          destination: 'nested-output.scss',
        },
      };

      writeFileSync(join(testDir, 'nested.config.json'), JSON.stringify(nestedConfig, null, 2));

      const result = await cliHarness.execute('generate', [
        '--config',
        'nested.config.json',
        '--count',
        '6',
        '--length',
        '15', // Should override nested minimumLength: 4
      ]);

      expect(result.success).toBe(true);

      // Verify deep override was applied
      const outputScss = readFileSync(join(testDir, 'nested-output.scss'), 'utf-8');
      const generatedClasses = outputScss.match(/\.cls-[a-zA-Z][a-zA-Z0-9-_]*/g);

      generatedClasses?.forEach((cls) => {
        const className = cls.substring(1); // Remove the dot
        expect(className.length).toBeGreaterThanOrEqual(15);
        expect(className.length).not.toBe(4); // Should not use nested config value
      });

      // Verify other nested settings were preserved
      expect(outputScss).toContain('.cls-'); // Prefix should be preserved
    });
  });

  describe('Cross-Command Length Consistency', () => {
    it('should apply --length consistently across analyze command', async () => {
      // Setup test HTML with various class name lengths
      const htmlContent = `
        <div class="a ab abc abcd abcde abcdef abcdefg abcdefgh">
          <span class="x xy xyz wxyz vwxyz uvwxyz tuvwxyz">Content</span>
          <p class="short medium-class very-long-class-name extremely-long-class-name-for-testing">Text</p>
        </div>
      `;

      writeFileSync(join(testDir, 'test.html'), htmlContent);

      // Analyze with length requirement
      const result = await cliHarness.execute('analyze', [
        'test.html',
        '--output',
        'analysis.json',
        '--length',
        '6',
      ]);

      expect(result.success).toBe(true);

      // Verify analysis respects length requirement
      const analysisData = JSON.parse(readFileSync(join(testDir, 'analysis.json'), 'utf-8'));

      // All reported classes should meet length requirement
      analysisData.usedClasses.forEach((cls: string) => {
        expect(cls.length).toBeGreaterThanOrEqual(6);
      });

      // Should include: abcdef, abcdefg, abcdefgh, medium-class, very-long-class-name, extremely-long-class-name-for-testing
      expect(analysisData.usedClasses).toContain('abcdef');
      expect(analysisData.usedClasses).toContain('abcdefg');
      expect(analysisData.usedClasses).toContain('abcdefgh');
      expect(analysisData.usedClasses).toContain('medium-class');
      expect(analysisData.usedClasses).toContain('very-long-class-name');
      expect(analysisData.usedClasses).toContain('extremely-long-class-name-for-testing');

      // Should exclude: a, ab, abc, abcd, abcde, x, xy, xyz, wxyz, vwxyz, short
      expect(analysisData.usedClasses).not.toContain('a');
      expect(analysisData.usedClasses).not.toContain('ab');
      expect(analysisData.usedClasses).not.toContain('abc');
      expect(analysisData.usedClasses).not.toContain('abcd');
      expect(analysisData.usedClasses).not.toContain('abcde');
      expect(analysisData.usedClasses).not.toContain('x');
      expect(analysisData.usedClasses).not.toContain('xy');
      expect(analysisData.usedClasses).not.toContain('xyz');
      expect(analysisData.usedClasses).not.toContain('wxyz');
      expect(analysisData.usedClasses).not.toContain('vwxyz');
      expect(analysisData.usedClasses).not.toContain('short');
    });

    it('should apply --length consistently across optimize command', async () => {
      // Setup test files for optimization
      const htmlContent = `
        <div class="btn primary lg red hover-effect transition-all">
          <span class="icon left medium">Icon</span>
          <span class="text bold uppercase tracking-wide">Button Text</span>
        </div>
      `;

      const cssContent = `
        .btn { display: inline-block; padding: 8px 16px; }
        .primary { background-color: #007bff; color: white; }
        .lg { font-size: 1.125rem; padding: 12px 24px; }
        .red { background-color: #dc3545; }
        .hover-effect:hover { transform: translateY(-1px); }
        .transition-all { transition: all 0.2s ease; }
        .icon { display: inline-flex; align-items: center; }
        .left { margin-right: 8px; }
        .medium { width: 16px; height: 16px; }
        .text { font-weight: 500; }
        .bold { font-weight: 700; }
        .uppercase { text-transform: uppercase; }
        .tracking-wide { letter-spacing: 0.025em; }
        .unused-class { display: none; }
      `;

      writeFileSync(join(testDir, 'optimize-test.html'), htmlContent);
      writeFileSync(join(testDir, 'styles.css'), cssContent);

      const result = await cliHarness.execute('optimize', [
        'optimize-test.html',
        '--css',
        'styles.css',
        '--output',
        'optimized.css',
        '--length',
        '7',
      ]);

      expect(result.success).toBe(true);

      // Verify optimization respects length requirement
      const optimizedCss = readFileSync(join(testDir, 'optimized.css'), 'utf-8');

      // Should include classes that meet length requirement
      expect(optimizedCss).toContain('.primary');
      expect(optimizedCss).toContain('.hover-effect');
      expect(optimizedCss).toContain('.transition-all');
      expect(optimizedCss).toContain('.medium');
      expect(optimizedCss).toContain('.uppercase');
      expect(optimizedCss).toContain('.tracking-wide');

      // Should generate new names for classes that don't meet requirement
      // and those new names should meet the length requirement
      const generatedClasses = optimizedCss.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);
      generatedClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(7);
      });
    });

    it('should apply --length consistently across process command', async () => {
      // Setup comprehensive test scenario
      const htmlContent = `
        <html>
          <head>
            <title>Process Test</title>
          </head>
          <body>
            <header class="hdr nav top sticky shadow">
              <nav class="navbar container mx-auto flex items-center justify-between">
                <div class="logo brand text-xl font-bold">Logo</div>
                <ul class="menu list-none flex space-x-4">
                  <li><a href="#" class="link text-blue hover-underline">Home</a></li>
                  <li><a href="#" class="link text-blue hover-underline">About</a></li>
                  <li><a href="#" class="link text-blue hover-underline">Contact</a></li>
                </ul>
              </nav>
            </header>
            <main class="content main-area padding-top">
              <section class="hero bg-gradient text-center padding-large">
                <h1 class="title text-4xl font-black mb-8">Hero Title</h1>
                <p class="subtitle text-lg text-gray mb-12">Hero subtitle</p>
                <button class="cta btn primary large rounded shadow-lg">Call to Action</button>
              </section>
            </main>
          </body>
        </html>
      `;

      const config = {
        strategy: 'alphabet',
        preserveOriginal: true,
        output: {
          format: 'css',
          minify: false,
        },
      };

      writeFileSync(join(testDir, 'process-test.html'), htmlContent);
      writeFileSync(join(testDir, 'process.config.json'), JSON.stringify(config, null, 2));

      const result = await cliHarness.execute('process', [
        'process-test.html',
        '--config',
        'process.config.json',
        '--output',
        'processed.css',
        '--length',
        '9',
      ]);

      expect(result.success).toBe(true);

      // Verify comprehensive processing respects length requirement
      const processedCss = readFileSync(join(testDir, 'processed.css'), 'utf-8');

      // Should include original classes that meet length requirement
      expect(processedCss).toContain('.container');
      expect(processedCss).toContain('.mx-auto');
      expect(processedCss).toContain('.items-center');
      expect(processedCss).toContain('.justify-between');
      expect(processedCss).toContain('.text-blue');
      expect(processedCss).toContain('.hover-underline');
      expect(processedCss).toContain('.main-area');
      expect(processedCss).toContain('.padding-top');
      expect(processedCss).toContain('.bg-gradient');
      expect(processedCss).toContain('.text-center');
      expect(processedCss).toContain('.padding-large');
      expect(processedCss).toContain('.text-4xl');
      expect(processedCss).toContain('.font-black');
      expect(processedCss).toContain('.subtitle');
      expect(processedCss).toContain('.text-gray');
      expect(processedCss).toContain('.shadow-lg');

      // All classes in output should meet length requirement
      const allClasses = processedCss.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);
      allClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(9);
      });

      // Should not contain short classes as-is
      expect(processedCss).not.toContain('.hdr {');
      expect(processedCss).not.toContain('.nav {');
      expect(processedCss).not.toContain('.top {');
      expect(processedCss).not.toContain('.logo {');
      expect(processedCss).not.toContain('.brand {');
      expect(processedCss).not.toContain('.menu {');
      expect(processedCss).not.toContain('.link {');
      expect(processedCss).not.toContain('.hero {');
      expect(processedCss).not.toContain('.title {');
      expect(processedCss).not.toContain('.cta {');
      expect(processedCss).not.toContain('.btn {');
      expect(processedCss).not.toContain('.large {');
    });
  });

  describe('Length Validation and Error Handling', () => {
    it('should validate --length parameter format and range', async () => {
      // Test invalid string value
      const stringResult = await cliHarness.execute('generate', [
        '--count',
        '5',
        '--length',
        'invalid',
      ]);

      expect(stringResult.success).toBe(false);
      expect(stringResult.stderr).toContain('Invalid --length parameter');
      expect(stringResult.stderr).toContain('Expected a positive integer');

      // Test negative value
      const negativeResult = await cliHarness.execute('generate', [
        '--count',
        '5',
        '--length',
        '-3',
      ]);

      expect(negativeResult.success).toBe(false);
      expect(negativeResult.stderr).toContain('Length must be positive');

      // Test zero value
      const zeroResult = await cliHarness.execute('generate', ['--count', '5', '--length', '0']);

      expect(zeroResult.success).toBe(false);
      expect(zeroResult.stderr).toContain('Length must be greater than 0');

      // Test extremely large value
      const largeResult = await cliHarness.execute('generate', [
        '--count',
        '5',
        '--length',
        '10000',
      ]);

      expect(largeResult.success).toBe(false);
      expect(largeResult.stderr).toContain('Length exceeds maximum allowed value');
      expect(largeResult.stderr).toContain('Maximum allowed: 1000');

      // Test decimal value
      const decimalResult = await cliHarness.execute('generate', [
        '--count',
        '5',
        '--length',
        '5.5',
      ]);

      expect(decimalResult.success).toBe(false);
      expect(decimalResult.stderr).toContain('Length must be an integer');
    });

    it('should provide helpful suggestions for invalid length values', async () => {
      const result = await cliHarness.execute('generate', ['--count', '5', '--length', 'abc']);

      expect(result.success).toBe(false);

      const errorOutput = result.stderr;
      expect(errorOutput).toContain('Invalid --length parameter: "abc"');
      expect(errorOutput).toContain('Expected a positive integer between 1 and 1000');
      expect(errorOutput).toContain('Examples: --length 3, --length 10, --length 50');
      expect(errorOutput).toContain('For more information, see documentation');
    });

    it('should handle edge cases gracefully', async () => {
      // Test boundary values
      const minValidResult = await cliHarness.execute('generate', [
        '--count',
        '3',
        '--output',
        'min-valid.css',
        '--length',
        '1',
      ]);

      expect(minValidResult.success).toBe(true);

      const minValidCss = readFileSync(join(testDir, 'min-valid.css'), 'utf-8');
      const minValidClasses = minValidCss.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);
      minValidClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(1);
      });

      // Test maximum valid value
      const maxValidResult = await cliHarness.execute('generate', [
        '--count',
        '2',
        '--output',
        'max-valid.css',
        '--length',
        '1000',
      ]);

      expect(maxValidResult.success).toBe(true);

      const maxValidCss = readFileSync(join(testDir, 'max-valid.css'), 'utf-8');
      const maxValidClasses = maxValidCss.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);
      maxValidClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(1000);
      });
    });
  });

  describe('Integration with Name Generation Strategies', () => {
    it('should work correctly with sequential strategy', async () => {
      const config = {
        strategy: 'sequential',
        startValue: 1,
      };

      writeFileSync(join(testDir, 'sequential.config.json'), JSON.stringify(config, null, 2));

      const result = await cliHarness.execute('generate', [
        '--config',
        'sequential.config.json',
        '--count',
        '15',
        '--output',
        'sequential-length.css',
        '--length',
        '8',
      ]);

      expect(result.success).toBe(true);

      const output = readFileSync(join(testDir, 'sequential-length.css'), 'utf-8');
      const classes = output.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);

      // All classes should meet length requirement
      classes?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(8);
      });

      // Should maintain sequential pattern while meeting length
      expect(classes?.length).toBeGreaterThanOrEqual(15);
    });

    it('should work correctly with random strategy', async () => {
      const config = {
        strategy: 'random',
        seed: 42,
      };

      writeFileSync(join(testDir, 'random.config.json'), JSON.stringify(config, null, 2));

      const result = await cliHarness.execute('generate', [
        '--config',
        'random.config.json',
        '--count',
        '12',
        '--output',
        'random-length.css',
        '--length',
        '6',
      ]);

      expect(result.success).toBe(true);

      const output = readFileSync(join(testDir, 'random-length.css'), 'utf-8');
      const classes = output.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);

      // All classes should meet length requirement
      classes?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(6);
      });

      // Should maintain randomness while meeting length
      expect(classes?.length).toBeGreaterThanOrEqual(12);

      // With same seed, should be reproducible
      const secondResult = await cliHarness.execute('generate', [
        '--config',
        'random.config.json',
        '--count',
        '12',
        '--output',
        'random-length-2.css',
        '--length',
        '6',
      ]);

      expect(secondResult.success).toBe(true);

      const secondOutput = readFileSync(join(testDir, 'random-length-2.css'), 'utf-8');
      expect(output).toBe(secondOutput); // Should be identical with same seed
    });

    it('should work correctly with alphabet strategy', async () => {
      const config = {
        strategy: 'alphabet',
        charset: 'abcdefghijklmnopqrstuvwxyz',
      };

      writeFileSync(join(testDir, 'alphabet.config.json'), JSON.stringify(config, null, 2));

      const result = await cliHarness.execute('generate', [
        '--config',
        'alphabet.config.json',
        '--count',
        '20',
        '--output',
        'alphabet-length.css',
        '--length',
        '10',
      ]);

      expect(result.success).toBe(true);

      const output = readFileSync(join(testDir, 'alphabet-length.css'), 'utf-8');
      const classes = output.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);

      // All classes should meet length requirement
      classes?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(10);

        // Should only contain alphabetic characters
        expect(className).toMatch(/^[a-z]+$/);
      });

      // Should maintain alphabetic pattern while meeting length
      expect(classes?.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Performance Impact Assessment', () => {
    it('should not significantly impact performance with longer length requirements', async () => {
      // Generate baseline performance
      const baselineStart = Date.now();

      const baselineResult = await cliHarness.execute('generate', [
        '--count',
        '100',
        '--output',
        'baseline.css',
        '--length',
        '3',
      ]);

      const baselineTime = Date.now() - baselineStart;
      expect(baselineResult.success).toBe(true);

      // Generate with longer length requirement
      const longLengthStart = Date.now();

      const longLengthResult = await cliHarness.execute('generate', [
        '--count',
        '100',
        '--output',
        'long-length.css',
        '--length',
        '50',
      ]);

      const longLengthTime = Date.now() - longLengthStart;
      expect(longLengthResult.success).toBe(true);

      // Performance should not degrade significantly
      const performanceRatio = longLengthTime / baselineTime;
      expect(performanceRatio).toBeLessThan(3); // Should not be more than 3x slower

      // Verify outputs
      const baselineOutput = readFileSync(join(testDir, 'baseline.css'), 'utf-8');
      const longLengthOutput = readFileSync(join(testDir, 'long-length.css'), 'utf-8');

      const baselineClasses = baselineOutput.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);
      const longLengthClasses = longLengthOutput.match(/\.[a-zA-Z][a-zA-Z0-9-_]*/g);

      expect(baselineClasses?.length).toBe(longLengthClasses?.length);

      baselineClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(3);
      });

      longLengthClasses?.forEach((cls) => {
        const className = cls.substring(1);
        expect(className.length).toBeGreaterThanOrEqual(50);
      });
    });
  });
});
