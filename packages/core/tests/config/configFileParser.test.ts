/**
 * Configuration File Parser Tests
 * Comprehensive test suite for the configuration file parser
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigFileParser, ConfigFileParseError } from '../../src/config/configFileParser';

// Mock fs module
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('ConfigFileParser', () => {
  let parser: ConfigFileParser;
  let tempDir: string;

  beforeEach(() => {
    parser = new ConfigFileParser();
    tempDir = '/tmp/test-config';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Format Detection', () => {
    test('should detect JSON format', () => {
      const filePath = '/path/config.json';
      expect(() => parser['detectFormat'](filePath)).not.toThrow();
    });

    test('should detect YAML formats', () => {
      expect(() => parser['detectFormat']('/path/config.yaml')).not.toThrow();
      expect(() => parser['detectFormat']('/path/config.yml')).not.toThrow();
    });

    test('should detect JavaScript formats', () => {
      expect(() => parser['detectFormat']('/path/config.js')).not.toThrow();
      expect(() => parser['detectFormat']('/path/config.mjs')).not.toThrow();
    });

    test('should detect TypeScript format', () => {
      expect(() => parser['detectFormat']('/path/config.ts')).not.toThrow();
    });

    test('should detect TOML format', () => {
      expect(() => parser['detectFormat']('/path/config.toml')).not.toThrow();
    });

    test('should throw for unsupported format', () => {
      expect(() => parser['detectFormat']('/path/config.xml')).toThrow(
        'Unsupported config file extension: .xml'
      );
    });
  });

  describe('File Validation', () => {
    test('should validate existing readable file', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();

      await expect(parser['validateFile']('/path/config.json')).resolves.not.toThrow();
    });

    test('should throw for non-existent file', async () => {
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      await expect(parser['validateFile']('/path/config.json')).rejects.toThrow(
        'Config file not found: /path/config.json'
      );
    });

    test('should throw for non-readable file', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockRejectedValue({ code: 'EACCES' });

      await expect(parser['validateFile']('/path/config.json')).rejects.toThrow(
        'Config file not readable: /path/config.json'
      );
    });

    test('should throw for directory instead of file', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        size: 0,
      } as any);

      await expect(parser['validateFile']('/path/config.json')).rejects.toThrow(
        'Path is not a file: /path/config.json'
      );
    });

    test('should throw for file too large', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 2 * 1024 * 1024, // 2MB, larger than default 1MB limit
      } as any);

      await expect(parser['validateFile']('/path/config.json')).rejects.toThrow(
        'File too large: 2097152 bytes (max: 1048576)'
      );
    });

    test('should throw for unsupported extension', async () => {
      await expect(parser['validateFile']('/path/config.xml')).rejects.toThrow(
        'Unsupported file extension: .xml'
      );
    });
  });

  describe('JSON Parsing', () => {
    test('should parse valid JSON', async () => {
      const content = '{"test": "value", "number": 42}';
      const result = await parser['parseJSON'](content, []);
      
      expect(result).toEqual({
        test: 'value',
        number: 42,
      });
    });

    test('should parse JSON with comments when enabled', async () => {
      const content = `{
        // This is a comment
        "test": "value",
        /* Block comment */
        "number": 42
      }`;
      
      const parser = new ConfigFileParser({ allowComments: true });
      const result = await parser['parseJSON'](content, []);
      
      expect(result).toEqual({
        test: 'value',
        number: 42,
      });
    });

    test('should throw for invalid JSON', async () => {
      const content = '{"test": "value",}'; // Trailing comma
      
      await expect(parser['parseJSON'](content, [])).rejects.toThrow();
    });

    test('should provide helpful error for JSON syntax error', async () => {
      const content = '{"test": }'; // Missing value
      
      await expect(parser['parseJSON'](content, [])).rejects.toThrow(/JSON syntax error/);
    });
  });

  describe('YAML Parsing', () => {
    test('should parse valid YAML', async () => {
      const content = `
test: value
number: 42
nested:
  property: true
`;
      
      // Mock yaml import
      vi.doMock('yaml', () => ({
        parse: vi.fn().mockReturnValue({
          test: 'value',
          number: 42,
          nested: { property: true },
        }),
      }));

      const result = await parser['parseYAML'](content, []);
      
      expect(result).toEqual({
        test: 'value',
        number: 42,
        nested: { property: true },
      });
    });

    test('should throw for invalid YAML', async () => {
      const content = `
test: value
  invalid: indentation
`;
      
      vi.doMock('yaml', () => ({
        parse: vi.fn().mockImplementation(() => {
          throw new Error('YAML parsing failed');
        }),
      }));

      await expect(parser['parseYAML'](content, [])).rejects.toThrow(/YAML parsing failed/);
    });
  });

  describe('JavaScript Parsing', () => {
    test('should parse JavaScript module', async () => {
      const filePath = '/path/config.js';
      const expectedConfig = { test: 'value' };
      
      // Mock dynamic import
      vi.doMock('/path/config.js', () => ({
        default: expectedConfig,
      }));

      const result = await parser['parseJavaScript']('', filePath, []);
      expect(result).toEqual(expectedConfig);
    });

    test('should fallback to require for CommonJS', async () => {
      const filePath = '/path/config.js';
      const expectedConfig = { test: 'value' };
      
      // Mock require
      const mockRequire = vi.fn().mockReturnValue(expectedConfig);
      vi.stubGlobal('require', mockRequire);
      vi.stubGlobal('require.cache', {});
      vi.stubGlobal('require.resolve', vi.fn().mockReturnValue(filePath));

      // Mock import to fail first
      vi.doMock('/path/config.js', () => {
        throw new Error('Import failed');
      });

      const result = await parser['parseJavaScript']('', filePath, []);
      expect(result).toEqual(expectedConfig);
    });

    test('should throw when both import and require fail', async () => {
      const filePath = '/path/config.js';
      
      // Mock both to fail
      vi.doMock('/path/config.js', () => {
        throw new Error('Import failed');
      });
      
      const mockRequire = vi.fn().mockImplementation(() => {
        throw new Error('Require failed');
      });
      vi.stubGlobal('require', mockRequire);

      await expect(parser['parseJavaScript']('', filePath, [])).rejects.toThrow(
        /JavaScript config loading failed/
      );
    });

    test('should throw when no file path provided', async () => {
      await expect(parser['parseJavaScript']('content', undefined, [])).rejects.toThrow(
        'File path required for JavaScript config parsing'
      );
    });
  });

  describe('TypeScript Parsing', () => {
    test('should parse TypeScript content', async () => {
      const content = `
interface Config {
  test: string;
}

const config: Config = {
  test: 'value'
};

export default config;
`;
      
      // Mock TypeScript
      vi.doMock('typescript', () => ({
        transpile: vi.fn().mockReturnValue(`
const config = {
  test: 'value'
};
module.exports = config;
`),
        ModuleKind: { CommonJS: 1 },
        ScriptTarget: { ES2018: 5 },
      }));

      const result = await parser['parseTypeScript'](content, undefined, []);
      expect(result).toBeDefined();
    });

    test('should throw for TypeScript compilation errors', async () => {
      const content = 'invalid typescript syntax here';
      
      vi.doMock('typescript', () => ({
        transpile: vi.fn().mockImplementation(() => {
          throw new Error('TypeScript compilation failed');
        }),
        ModuleKind: { CommonJS: 1 },
        ScriptTarget: { ES2018: 5 },
      }));

      await expect(parser['parseTypeScript'](content, undefined, [])).rejects.toThrow(
        /TypeScript config parsing failed/
      );
    });
  });

  describe('TOML Parsing', () => {
    test('should parse valid TOML', async () => {
      const content = `
test = "value"
number = 42

[nested]
property = true
`;
      
      // Mock TOML parser
      vi.doMock('@iarna/toml', () => ({
        parse: vi.fn().mockReturnValue({
          test: 'value',
          number: 42,
          nested: { property: true },
        }),
      }));

      const result = await parser['parseTOML'](content, []);
      
      expect(result).toEqual({
        test: 'value',
        number: 42,
        nested: { property: true },
      });
    });

    test('should throw for invalid TOML', async () => {
      const content = 'invalid = toml = syntax';
      
      vi.doMock('@iarna/toml', () => ({
        parse: vi.fn().mockImplementation(() => {
          throw new Error('TOML parsing failed');
        }),
      }));

      await expect(parser['parseTOML'](content, [])).rejects.toThrow(/TOML parsing failed/);
    });
  });

  describe('Configuration Inheritance (Extends)', () => {
    test('should resolve extends with relative path', async () => {
      const baseConfig = { base: 'value', shared: 'base' };
      const childConfig = { extends: './base.json', child: 'value', shared: 'child' };
      
      // Mock file system
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes('base.json')) {
          return Promise.resolve(JSON.stringify(baseConfig));
        }
        return Promise.resolve(JSON.stringify(childConfig));
      });

      const parser = new ConfigFileParser({ followExtends: true });
      const result = await parser.parseFile('/project/config.json');
      
      expect(result.config).toEqual({
        base: 'value',
        child: 'value',
        shared: 'child', // Child overrides base
      });
      expect(result.extendsChain).toContain('/project/base.json');
    });

    test('should handle multiple levels of inheritance', async () => {
      const grandParent = { a: 1, b: 2 };
      const parent = { extends: './grandparent.json', b: 20, c: 3 };
      const child = { extends: './parent.json', c: 30, d: 4 };
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockImplementation((filePath) => {
        const path = filePath.toString();
        if (path.includes('grandparent.json')) {
          return Promise.resolve(JSON.stringify(grandParent));
        }
        if (path.includes('parent.json')) {
          return Promise.resolve(JSON.stringify(parent));
        }
        return Promise.resolve(JSON.stringify(child));
      });

      const parser = new ConfigFileParser({ followExtends: true });
      const result = await parser.parseFile('/project/config.json');
      
      expect(result.config).toEqual({
        a: 1,    // From grandparent
        b: 20,   // Parent overrides grandparent
        c: 30,   // Child overrides parent
        d: 4,    // From child
      });
    });

    test('should detect circular inheritance', async () => {
      const configA = { extends: './config-b.json', a: 1 };
      const configB = { extends: './config-a.json', b: 2 };
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockImplementation((filePath) => {
        const path = filePath.toString();
        if (path.includes('config-a.json')) {
          return Promise.resolve(JSON.stringify(configA));
        }
        return Promise.resolve(JSON.stringify(configB));
      });

      const parser = new ConfigFileParser({ followExtends: true });
      
      await expect(parser.parseFile('/project/config-a.json')).rejects.toThrow(
        /Circular extends detected/
      );
    });

    test('should respect maxExtendsDepth limit', async () => {
      const config = { extends: './base.json', test: 'value' };
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockResolvedValue(JSON.stringify(config));

      const parser = new ConfigFileParser({ 
        followExtends: true,
        maxExtendsDepth: 2,
      });
      
      await expect(parser.parseFile('/project/config.json')).rejects.toThrow(
        /Extends chain too deep/
      );
    });

    test('should handle missing extends file gracefully', async () => {
      const config = { extends: './missing.json', test: 'value' };
      
      mockFs.stat.mockImplementation((filePath) => {
        if (filePath.toString().includes('missing.json')) {
          return Promise.reject({ code: 'ENOENT' });
        }
        return Promise.resolve({
          isFile: () => true,
          size: 1024,
        } as any);
      });
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockResolvedValue(JSON.stringify(config));

      const parser = new ConfigFileParser({ followExtends: true });
      const result = await parser.parseFile('/project/config.json');
      
      // Should continue without the extends file
      expect(result.config).toEqual(config);
      expect(result.warnings).toHaveLength(0); // Parser logs warning but doesn't add to warnings
    });
  });

  describe('File Discovery', () => {
    test('should find config files with different extensions', async () => {
      mockFs.access.mockImplementation((filePath) => {
        if (filePath.toString().includes('tw-enigma.json')) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('File not found'));
      });

      const parser = new ConfigFileParser();
      const result = await parser.findConfigFiles('/project', ['tw-enigma']);
      
      expect(result).toContain('/project/tw-enigma.json');
    });

    test('should return empty array when no files found', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const parser = new ConfigFileParser();
      const result = await parser.findConfigFiles('/project', ['tw-enigma']);
      
      expect(result).toHaveLength(0);
    });

    test('should handle directory access errors', async () => {
      mockFs.access.mockRejectedValue(new Error('Permission denied'));

      const parser = new ConfigFileParser();
      const result = await parser.findConfigFiles('/inaccessible', ['tw-enigma']);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('Comment Detection', () => {
    test('should detect JSON comments', () => {
      const content = '// Comment\n{"test": "value"}';
      expect(parser['detectComments'](content, 'json')).toBe(true);
      
      const contentBlock = '/* Block comment */\n{"test": "value"}';
      expect(parser['detectComments'](contentBlock, 'json')).toBe(true);
      
      const noComments = '{"test": "value"}';
      expect(parser['detectComments'](noComments, 'json')).toBe(false);
    });

    test('should detect YAML comments', () => {
      const content = '# Comment\ntest: value';
      expect(parser['detectComments'](content, 'yaml')).toBe(true);
      
      const noComments = 'test: value';
      expect(parser['detectComments'](noComments, 'yaml')).toBe(false);
    });

    test('should detect JavaScript comments', () => {
      const content = '// Comment\nmodule.exports = {};';
      expect(parser['detectComments'](content, 'js')).toBe(true);
      
      const noComments = 'module.exports = {};';
      expect(parser['detectComments'](noComments, 'js')).toBe(false);
    });
  });

  describe('JSON Comment Stripping', () => {
    test('should strip single-line comments', () => {
      const content = `{
        "test": "value", // This is a comment
        "number": 42
      }`;
      
      const stripped = parser['stripJSONComments'](content);
      expect(stripped).not.toContain('// This is a comment');
      expect(stripped).toContain('"test": "value"');
    });

    test('should not strip comments inside strings', () => {
      const content = `{
        "test": "value with // inside string",
        "number": 42 // Real comment
      }`;
      
      const stripped = parser['stripJSONComments'](content);
      expect(stripped).toContain('value with // inside string');
      expect(stripped).not.toContain('// Real comment');
    });

    test('should handle complex comment scenarios', () => {
      const content = `{
        // Top level comment
        "url": "https://example.com", // URL comment
        "nested": {
          "prop": "value" // Nested comment
        }
      }`;
      
      const stripped = parser['stripJSONComments'](content);
      expect(stripped).toContain('https://example.com');
      expect(stripped).not.toContain('// Top level comment');
      expect(stripped).not.toContain('// URL comment');
      expect(stripped).not.toContain('// Nested comment');
    });
  });

  describe('Parser Options', () => {
    test('should respect allowComments option', async () => {
      const parser = new ConfigFileParser({ allowComments: false });
      const content = '{"test": "value"} // Comment';
      
      // Should fail to parse with comments when disabled
      await expect(parser['parseJSON'](content, [])).rejects.toThrow();
    });

    test('should respect maxFileSize option', async () => {
      const parser = new ConfigFileParser({ maxFileSize: 100 });
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 200, // Larger than limit
      } as any);

      await expect(parser['validateFile']('/path/config.json')).rejects.toThrow(
        'File too large: 200 bytes (max: 100)'
      );
    });

    test('should respect supportedExtensions option', () => {
      const parser = new ConfigFileParser({ 
        supportedExtensions: ['.json', '.yaml'],
      });

      expect(() => parser['detectFormat']('/path/config.json')).not.toThrow();
      expect(() => parser['detectFormat']('/path/config.yaml')).not.toThrow();
      expect(() => parser['detectFormat']('/path/config.js')).toThrow();
    });

    test('should update options', () => {
      const parser = new ConfigFileParser({ allowComments: false });
      
      parser.updateOptions({ allowComments: true });
      
      // Options should be updated (testing internal state change)
      expect(parser.getSupportedExtensions()).toContain('.json');
    });
  });

  describe('Error Handling', () => {
    test('should throw ConfigFileParseError for parsing failures', async () => {
      const content = 'invalid json content';
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockResolvedValue(content);

      await expect(parser.parseFile('/path/config.json')).rejects.toThrow(
        ConfigFileParseError
      );
    });

    test('should include file path in error', async () => {
      const content = 'invalid json';
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockResolvedValue(content);

      try {
        await parser.parseFile('/project/config.json');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigFileParseError);
        expect((error as ConfigFileParseError).filePath).toBe('/project/config.json');
      }
    });

    test('should handle unexpected errors gracefully', async () => {
      mockFs.stat.mockRejectedValue(new Error('Unexpected error'));

      await expect(parser.parseFile('/path/config.json')).rejects.toThrow(
        'Failed to parse config file'
      );
    });
  });

  describe('Integration Tests', () => {
    test('should parse complete configuration file', async () => {
      const config = {
        root: './src',
        framework: 'react',
        optimization: {
          level: 'basic',
          scrambleClassNames: false,
        },
        output: {
          outDir: './dist',
          sourceMaps: true,
        },
      };
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockResolvedValue(JSON.stringify(config));

      const result = await parser.parseFile('/project/config.json');
      
      expect(result.config).toEqual(config);
      expect(result.format).toBe('json');
      expect(result.metadata.parseTime).toBeGreaterThan(0);
      expect(result.metadata.fileSize).toBe(1024);
      expect(result.warnings).toHaveLength(0);
    });

    test('should handle complex inheritance chain', async () => {
      const base = {
        root: './src',
        optimization: { level: 'basic' },
      };
      const development = {
        extends: './base.json',
        optimization: { scrambleClassNames: false },
        output: { sourceMaps: true },
      };
      const local = {
        extends: './development.json',
        output: { outDir: './local-dist' },
      };
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      } as any);
      mockFs.access.mockResolvedValue();
      mockFs.readFile.mockImplementation((filePath) => {
        const path = filePath.toString();
        if (path.includes('base.json')) {
          return Promise.resolve(JSON.stringify(base));
        }
        if (path.includes('development.json')) {
          return Promise.resolve(JSON.stringify(development));
        }
        return Promise.resolve(JSON.stringify(local));
      });

      const parser = new ConfigFileParser({ followExtends: true });
      const result = await parser.parseFile('/project/local.json');
      
      expect(result.config).toEqual({
        root: './src',
        optimization: {
          level: 'basic',
          scrambleClassNames: false,
        },
        output: {
          sourceMaps: true,
          outDir: './local-dist',
        },
      });
      expect(result.extendsChain).toHaveLength(2);
    });
  });
});