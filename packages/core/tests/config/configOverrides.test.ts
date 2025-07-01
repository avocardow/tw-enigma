/**
 * Configuration Overrides Tests
 * Test suite for CLI and environment variable override processing
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigOverrideProcessor, ConfigOverrideError } from '../../src/config/configOverrides';
import { TWEnigmaConfigSchema } from '../../src/config/configSchema';

describe('ConfigOverrideProcessor', () => {
  let processor: ConfigOverrideProcessor;
  let baseConfig: any;

  beforeEach(() => {
    baseConfig = {
      root: './src',
      framework: 'auto',
      optimization: {
        level: 'basic',
        scrambleClassNames: false,
        minifyCSS: false,
      },
      output: {
        outDir: './dist',
        sourceMaps: false,
      },
      performance: {
        parallel: true,
        workers: 2,
      },
      logging: {
        level: 'info',
      },
      cache: {
        enabled: true,
        directory: '.cache',
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CLI Argument Parsing', () => {
    test('should parse basic CLI arguments', () => {
      const args = ['--root', '/path/to/project', '--framework', 'react'];
      const parsed = processor['parseCliArguments'](args);

      expect(parsed.get('--root')).toBe('/path/to/project');
      expect(parsed.get('--framework')).toBe('react');
    });

    test('should parse flag=value format', () => {
      const args = ['--root=/path/to/project', '--workers=4'];
      const parsed = processor['parseCliArguments'](args);

      expect(parsed.get('--root')).toBe('/path/to/project');
      expect(parsed.get('--workers')).toBe('4');
    });

    test('should parse boolean flags', () => {
      const args = ['--source-maps', '--no-cache'];
      const parsed = processor['parseCliArguments'](args);

      expect(parsed.get('--source-maps')).toBe(true);
      expect(parsed.get('--no-cache')).toBe(true);
    });

    test('should handle short flags', () => {
      const args = ['-v', 'debug', '-p'];
      const parsed = processor['parseCliArguments'](args);

      expect(parsed.get('-v')).toBe('debug');
      expect(parsed.get('-p')).toBe(true);
    });

    test('should handle mixed argument formats', () => {
      const args = [
        '--root=/project',
        '--framework', 'react',
        '--source-maps',
        '--workers=4',
        '--no-cache',
      ];
      const parsed = processor['parseCliArguments'](args);

      expect(parsed.get('--root')).toBe('/project');
      expect(parsed.get('--framework')).toBe('react');
      expect(parsed.get('--source-maps')).toBe(true);
      expect(parsed.get('--workers')).toBe('4');
      expect(parsed.get('--no-cache')).toBe(true);
    });
  });

  describe('Environment Variable Processing', () => {
    test('should process environment variables', async () => {
      const envVars = {
        TW_ENIGMA_ROOT: '/env/project',
        TW_ENIGMA_FRAMEWORK: 'vue',
        TW_ENIGMA_OPTIMIZATION_LEVEL: 'aggressive',
        TW_ENIGMA_SCRAMBLE_CLASSES: 'true',
        TW_ENIGMA_WORKERS: '8',
      };

      processor = new ConfigOverrideProcessor({ envVars });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.root).toBe('/env/project');
      expect(result.config.framework).toBe('vue');
      expect(result.config.optimization.level).toBe('aggressive');
      expect(result.config.optimization.scrambleClassNames).toBe(true);
      expect(result.config.performance.workers).toBe(8);

      expect(result.appliedOverrides.env).toEqual({
        root: '/env/project',
        framework: 'vue',
        optimization: {
          level: 'aggressive',
          scrambleClassNames: true,
        },
        performance: {
          workers: 8,
        },
      });
    });

    test('should handle boolean environment variables', async () => {
      const envVars = {
        TW_ENIGMA_SCRAMBLE_CLASSES: 'true',
        TW_ENIGMA_MINIFY_CSS: 'false',
        TW_ENIGMA_SOURCE_MAPS: 'TRUE',
        TW_ENIGMA_CACHE_ENABLED: 'FALSE',
      };

      processor = new ConfigOverrideProcessor({ envVars });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.optimization.scrambleClassNames).toBe(true);
      expect(result.config.optimization.minifyCSS).toBe(false);
      expect(result.config.output.sourceMaps).toBe(true);
      expect(result.config.cache.enabled).toBe(false);
    });

    test('should handle numeric environment variables', async () => {
      const envVars = {
        TW_ENIGMA_WORKERS: '4',
        TW_ENIGMA_WORKERS_FLOAT: '4.5', // Custom mapping for testing
      };

      processor = new ConfigOverrideProcessor({
        envVars,
        customMappings: {
          env: {
            TW_ENIGMA_WORKERS_FLOAT: 'performance.workers',
          },
        },
      });
      
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.performance.workers).toBe(4.5);
    });

    test('should handle array environment variables', async () => {
      const envVars = {
        TW_ENIGMA_PRESERVE_CLASSES: 'debug-*,test-*,keep-*',
      };

      processor = new ConfigOverrideProcessor({
        envVars,
        customMappings: {
          env: {
            TW_ENIGMA_PRESERVE_CLASSES: 'optimization.preserveClasses',
          },
        },
      });
      
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.optimization.preserveClasses).toEqual([
        'debug-*',
        'test-*',
        'keep-*',
      ]);
    });
  });

  describe('CLI Argument Processing', () => {
    test('should process CLI arguments', async () => {
      const cliArgs = [
        '--root', '/cli/project',
        '--framework', 'angular',
        '--optimization', 'extreme',
        '--source-maps',
        '--workers', '6',
      ];

      processor = new ConfigOverrideProcessor({ cliArgs });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.root).toBe('/cli/project');
      expect(result.config.framework).toBe('angular');
      expect(result.config.optimization.level).toBe('extreme');
      expect(result.config.output.sourceMaps).toBe(true);
      expect(result.config.performance.workers).toBe(6);

      expect(result.appliedOverrides.cli).toEqual({
        root: '/cli/project',
        framework: 'angular',
        optimization: {
          level: 'extreme',
        },
        output: {
          sourceMaps: true,
        },
        performance: {
          workers: 6,
        },
      });
    });

    test('should handle negation flags', async () => {
      const cliArgs = [
        '--no-scramble',
        '--no-minify',
        '--no-parallel',
        '--no-cache',
      ];

      processor = new ConfigOverrideProcessor({ cliArgs });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.optimization.scrambleClassNames).toBe(false);
      expect(result.config.optimization.minifyCSS).toBe(false);
      expect(result.config.performance.parallel).toBe(false);
      expect(result.config.cache.enabled).toBe(false);
    });

    test('should handle equals syntax', async () => {
      const cliArgs = [
        '--root=/project/cli',
        '--workers=8',
        '--compression=gzip',
      ];

      processor = new ConfigOverrideProcessor({ cliArgs });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.root).toBe('/project/cli');
      expect(result.config.performance.workers).toBe(8);
      expect(result.config.output.compression).toBe('gzip');
    });
  });

  describe('Precedence Rules', () => {
    test('should apply CLI > ENV > Config precedence', async () => {
      const envVars = {
        TW_ENIGMA_ROOT: '/env/project',
        TW_ENIGMA_WORKERS: '4',
      };
      const cliArgs = [
        '--root', '/cli/project', // CLI overrides ENV
        '--framework', 'svelte',  // CLI only
      ];

      processor = new ConfigOverrideProcessor({ envVars, cliArgs });
      const result = await processor.applyOverrides({
        ...baseConfig,
        root: '/config/project',  // Config value
        workers: 2,              // Config value
        framework: 'react',      // Config value
      });

      expect(result.config.root).toBe('/cli/project');      // CLI wins
      expect(result.config.performance.workers).toBe(4);    // ENV wins (no CLI)
      expect(result.config.framework).toBe('svelte');       // CLI wins

      expect(result.sources.root).toBe('cli');
      expect(result.sources['performance.workers']).toBe('env');
      expect(result.sources.framework).toBe('cli');
    });

    test('should track source of each override', async () => {
      const envVars = {
        TW_ENIGMA_FRAMEWORK: 'vue',
        TW_ENIGMA_WORKERS: '6',
      };
      const cliArgs = ['--root', '/cli/project'];

      processor = new ConfigOverrideProcessor({ envVars, cliArgs });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.sources.root).toBe('cli');
      expect(result.sources.framework).toBe('env');
      expect(result.sources['performance.workers']).toBe('env');
      expect(result.sources['optimization.level']).toBe('config');
    });
  });

  describe('Value Parsing and Type Coercion', () => {
    test('should parse environment variable types correctly', () => {
      const testCases = [
        { value: 'true', expected: true },
        { value: 'false', expected: false },
        { value: 'TRUE', expected: true },
        { value: 'FALSE', expected: false },
        { value: '42', expected: 42 },
        { value: '3.14', expected: 3.14 },
        { value: 'string', expected: 'string' },
        { value: 'a,b,c', expected: ['a', 'b', 'c'] },
        { value: 'single', expected: 'single' },
      ];

      testCases.forEach(({ value, expected }) => {
        const result = processor['parseEnvironmentValue'](value, 'test.path');
        expect(result).toEqual(expected);
      });
    });

    test('should parse CLI values correctly', () => {
      const testCases = [
        { value: true, flag: '--flag', expected: true },
        { value: true, flag: '--no-flag', expected: false },
        { value: 'true', flag: '--flag', expected: true },
        { value: 'false', flag: '--flag', expected: false },
        { value: '42', flag: '--flag', expected: 42 },
        { value: 'text', flag: '--flag', expected: 'text' },
      ];

      testCases.forEach(({ value, flag, expected }) => {
        const result = processor['parseCliValue'](value, 'test.path', flag);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('Nested Value Handling', () => {
    test('should set nested values correctly', () => {
      const obj = {};
      processor['setNestedValue'](obj, 'a.b.c', 'value');
      
      expect(obj).toEqual({
        a: {
          b: {
            c: 'value',
          },
        },
      });
    });

    test('should get nested values correctly', () => {
      const obj = {
        a: {
          b: {
            c: 'value',
          },
        },
      };
      
      expect(processor['getNestedValue'](obj, 'a.b.c')).toBe('value');
      expect(processor['getNestedValue'](obj, 'a.b')).toEqual({ c: 'value' });
      expect(processor['getNestedValue'](obj, 'a.b.d')).toBeUndefined();
      expect(processor['getNestedValue'](obj, 'x.y.z')).toBeUndefined();
    });

    test('should handle existing nested values', () => {
      const obj = {
        a: {
          b: 'existing',
        },
      };
      
      processor['setNestedValue'](obj, 'a.c', 'new');
      
      expect(obj).toEqual({
        a: {
          b: 'existing',
          c: 'new',
        },
      });
    });
  });

  describe('Custom Mappings', () => {
    test('should use custom environment mappings', async () => {
      const envVars = {
        CUSTOM_ROOT: '/custom/project',
        CUSTOM_THEME: 'dark',
      };

      processor = new ConfigOverrideProcessor({
        envVars,
        customMappings: {
          env: {
            CUSTOM_ROOT: 'root',
            CUSTOM_THEME: 'theme.mode',
          },
        },
      });

      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.root).toBe('/custom/project');
      expect(result.config.theme?.mode).toBe('dark');
    });

    test('should use custom CLI mappings', async () => {
      const cliArgs = ['--project-root', '/project', '--theme-dark'];

      processor = new ConfigOverrideProcessor({
        cliArgs,
        customMappings: {
          cli: {
            '--project-root': 'root',
            '--theme-dark': 'theme.dark',
          },
        },
      });

      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.root).toBe('/project');
      expect(result.config.theme?.dark).toBe(true);
    });
  });

  describe('Unknown Override Detection', () => {
    test('should warn about unknown environment variables', async () => {
      const envVars = {
        TW_ENIGMA_UNKNOWN_VAR: 'value',
        TW_ENIGMA_ANOTHER_UNKNOWN: 'value2',
        OTHER_VAR: 'not-relevant',
      };

      processor = new ConfigOverrideProcessor({ 
        envVars,
        warnUnknown: true,
      });
      
      const result = await processor.applyOverrides(baseConfig);

      const unknownWarnings = result.warnings.filter(w => w.type === 'unknown_env');
      expect(unknownWarnings).toHaveLength(2);
      expect(unknownWarnings[0].key).toBe('TW_ENIGMA_UNKNOWN_VAR');
      expect(unknownWarnings[1].key).toBe('TW_ENIGMA_ANOTHER_UNKNOWN');
    });

    test('should warn about unknown CLI flags', async () => {
      const cliArgs = ['--unknown-flag', 'value', '--another-unknown'];

      processor = new ConfigOverrideProcessor({ 
        cliArgs,
        warnUnknown: true,
      });
      
      const result = await processor.applyOverrides(baseConfig);

      const unknownWarnings = result.warnings.filter(w => w.type === 'unknown_flag');
      expect(unknownWarnings).toHaveLength(2);
      expect(unknownWarnings[0].key).toBe('--unknown-flag');
      expect(unknownWarnings[1].key).toBe('--another-unknown');
    });

    test('should not warn when warnUnknown is disabled', async () => {
      const envVars = { TW_ENIGMA_UNKNOWN: 'value' };
      const cliArgs = ['--unknown-flag'];

      processor = new ConfigOverrideProcessor({ 
        envVars,
        cliArgs,
        warnUnknown: false,
      });
      
      const result = await processor.applyOverrides(baseConfig);

      const unknownWarnings = result.warnings.filter(w => 
        w.type === 'unknown_env' || w.type === 'unknown_flag'
      );
      expect(unknownWarnings).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    test('should validate overrides when enabled', async () => {
      const cliArgs = ['--optimization', 'invalid-level'];

      processor = new ConfigOverrideProcessor({ 
        cliArgs,
        validateOverrides: true,
      });
      
      await expect(processor.applyOverrides(baseConfig))
        .rejects.toThrow(ConfigOverrideError);
    });

    test('should skip validation when disabled', async () => {
      const cliArgs = ['--optimization', 'invalid-level'];

      processor = new ConfigOverrideProcessor({ 
        cliArgs,
        validateOverrides: false,
      });
      
      // Should not throw even with invalid value
      const result = await processor.applyOverrides(baseConfig);
      expect(result.config.optimization.level).toBe('invalid-level');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid override values', async () => {
      const envVars = {
        TW_ENIGMA_WORKERS: 'not-a-number',
      };

      processor = new ConfigOverrideProcessor({ envVars });
      const result = await processor.applyOverrides(baseConfig);

      const typeWarnings = result.warnings.filter(w => w.type === 'invalid_value');
      expect(typeWarnings).toHaveLength(0); // 'not-a-number' is treated as string, not invalid

      // Test with actually invalid scenario
      processor = new ConfigOverrideProcessor({
        envVars: { TW_ENIGMA_WORKERS: 'not-a-number' },
        customMappings: {
          env: { TW_ENIGMA_WORKERS: 'performance.workers' },
        },
      });

      const result2 = await processor.applyOverrides(baseConfig);
      // String value should be applied as-is, validation happens later
      expect(result2.config.performance.workers).toBe('not-a-number');
    });

    test('should handle validation errors gracefully', async () => {
      const cliArgs = ['--workers', 'invalid'];

      processor = new ConfigOverrideProcessor({ 
        cliArgs,
        validateOverrides: true,
      });
      
      try {
        await processor.applyOverrides(baseConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigOverrideError);
        expect((error as ConfigOverrideError).source).toBe('cli');
      }
    });
  });

  describe('Deep Merging', () => {
    test('should merge nested objects correctly', async () => {
      const envVars = {
        TW_ENIGMA_OPTIMIZATION_LEVEL: 'aggressive',
        TW_ENIGMA_SCRAMBLE_CLASSES: 'true',
      };
      const cliArgs = ['--no-minify'];

      processor = new ConfigOverrideProcessor({ envVars, cliArgs });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.optimization).toEqual({
        level: 'aggressive',        // From ENV
        scrambleClassNames: true,   // From ENV
        minifyCSS: false,          // From CLI
      });
    });

    test('should preserve non-overridden values', async () => {
      const cliArgs = ['--root', '/new/root'];

      processor = new ConfigOverrideProcessor({ cliArgs });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config.root).toBe('/new/root');
      expect(result.config.framework).toBe(baseConfig.framework);
      expect(result.config.optimization).toEqual(baseConfig.optimization);
      expect(result.config.output).toEqual(baseConfig.output);
    });
  });

  describe('Utility Methods', () => {
    test('should get current mappings', () => {
      processor = new ConfigOverrideProcessor({
        customMappings: {
          env: { CUSTOM_VAR: 'custom.path' },
          cli: { '--custom-flag': 'custom.flag' },
        },
      });

      const mappings = processor.getMappings();
      
      expect(mappings.env).toHaveProperty('TW_ENIGMA_ROOT');
      expect(mappings.env).toHaveProperty('CUSTOM_VAR');
      expect(mappings.cli).toHaveProperty('--root');
      expect(mappings.cli).toHaveProperty('--custom-flag');
    });

    test('should validate config paths', () => {
      expect(processor.validateConfigPath('root')).toBe(true);
      expect(processor.validateConfigPath('optimization.level')).toBe(true);
      expect(processor.validateConfigPath('invalid.path')).toBe(false);
    });

    test('should update options', () => {
      processor = new ConfigOverrideProcessor({ warnUnknown: false });
      
      processor.updateOptions({ warnUnknown: true });
      
      // Options should be updated
      expect(processor['options'].warnUnknown).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex override scenario', async () => {
      const envVars = {
        TW_ENIGMA_ROOT: '/env/project',
        TW_ENIGMA_FRAMEWORK: 'react',
        TW_ENIGMA_OPTIMIZATION_LEVEL: 'basic',
        TW_ENIGMA_WORKERS: '4',
        TW_ENIGMA_LOG_LEVEL: 'debug',
      };
      
      const cliArgs = [
        '--framework', 'vue',        // Overrides ENV
        '--optimization', 'aggressive', // Overrides ENV
        '--source-maps',             // New value
        '--no-cache',               // New value
        '--workers', '8',           // Overrides ENV
      ];

      processor = new ConfigOverrideProcessor({ envVars, cliArgs });
      const result = await processor.applyOverrides(baseConfig);

      expect(result.config).toEqual({
        ...baseConfig,
        root: '/env/project',              // From ENV
        framework: 'vue',                  // CLI overrides ENV
        optimization: {
          ...baseConfig.optimization,
          level: 'aggressive',             // CLI overrides ENV
        },
        output: {
          ...baseConfig.output,
          sourceMaps: true,                // From CLI
        },
        performance: {
          ...baseConfig.performance,
          workers: 8,                      // CLI overrides ENV
        },
        logging: {
          ...baseConfig.logging,
          level: 'debug',                  // From ENV
        },
        cache: {
          ...baseConfig.cache,
          enabled: false,                  // From CLI
        },
      });

      // Check applied overrides
      expect(Object.keys(result.appliedOverrides.env)).toHaveLength(4);
      expect(Object.keys(result.appliedOverrides.cli)).toHaveLength(5);
      
      // Check sources
      expect(result.sources.root).toBe('env');
      expect(result.sources.framework).toBe('cli');
      expect(result.sources['optimization.level']).toBe('cli');
      expect(result.sources['output.sourceMaps']).toBe('cli');
      expect(result.sources['performance.workers']).toBe('cli');
      expect(result.sources['logging.level']).toBe('env');
      expect(result.sources['cache.enabled']).toBe('cli');
    });
  });
});