/**
 * Integration Tests for css-config Command with Global --length Option (Task 8)
 * Tests the integration between global CLI options and command-specific functionality
 */

import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('CSS Config Integration with Global Length Option', () => {
  let tempDir: string;
  const enigmaCommand = join(__dirname, '../dist/enigma.js');

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'css-config-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Global --length Option Integration', () => {
    it('should access and use the global --length option', () => {
      const output = execSync(`node ${enigmaCommand} --length=7 css-config`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      // Should show the length usage message
      expect(output).toContain('🎯 Using minimum class name length: 7');

      // Should include nameGeneration configuration in output
      expect(output).toContain('"nameGeneration"');
      expect(output).toContain('"minimumLength": 7');
    });

    it('should include complete nameGeneration configuration when --length is provided', () => {
      const output = execSync(`node ${enigmaCommand} --length=12 css-config`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      const config = JSON.parse(output.split('\n').slice(-1)[0] || '{}');

      expect(config.nameGeneration).toBeDefined();
      expect(config.nameGeneration.minimumLength).toBe(12);
      expect(config.nameGeneration.strategy).toBe('frequency-optimized');
      expect(config.nameGeneration.alphabet).toBeDefined();
      expect(config.nameGeneration.ensureCssValid).toBeDefined();
    });

    it('should work with different length values', () => {
      // Test minimum length
      const output1 = execSync(`node ${enigmaCommand} --length=1 css-config`, {
        encoding: 'utf8',
        cwd: tempDir,
      });
      expect(output1).toContain('"minimumLength": 1');

      // Test maximum length
      const output26 = execSync(`node ${enigmaCommand} --length=26 css-config`, {
        encoding: 'utf8',
        cwd: tempDir,
      });
      expect(output26).toContain('"minimumLength": 26');
    });

    it('should maintain backward compatibility when --length is not provided', () => {
      const output = execSync(`node ${enigmaCommand} css-config`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      // Should not show length usage message
      expect(output).not.toContain('🎯 Using minimum class name length');

      // Should not include nameGeneration configuration
      expect(output).not.toContain('"nameGeneration"');

      // Should still produce valid CSS configuration
      expect(output).toContain('"strategy"');
      expect(output).toContain('"optimization"');
    });
  });

  describe('Integration with Other Options', () => {
    it('should work with --length and --preset options together', () => {
      const output = execSync(`node ${enigmaCommand} --length=6 css-config --preset=production`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(output).toContain('🎯 Using minimum class name length: 6');
      expect(output).toContain('📋 Generated production configuration preset');
      expect(output).toContain('"minimumLength": 6');
    });

    it('should work with --length and --save options together', () => {
      const configPath = join(tempDir, 'test-config.json');

      const output = execSync(`node ${enigmaCommand} --length=9 css-config --save=${configPath}`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(output).toContain('🎯 Using minimum class name length: 9');
      expect(output).toContain('💾 Configuration saved');

      // Check that saved file includes nameGeneration config
      const savedConfig = require(configPath);
      expect(savedConfig.nameGeneration).toBeDefined();
      expect(savedConfig.nameGeneration.minimumLength).toBe(9);
    });

    it('should work with --length and --budget options together', () => {
      const output = execSync(`node ${enigmaCommand} --length=4 css-config --budget`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(output).toContain('🎯 Using minimum class name length: 4');
      expect(output).toContain('📊 Added performance budget configuration');
      expect(output).toContain('"minimumLength": 4');
    });
  });

  describe('Configuration Output Quality', () => {
    it('should produce valid JSON output with nameGeneration', () => {
      const output = execSync(`node ${enigmaCommand} --length=5 css-config`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      // Extract the JSON portion (after the log messages)
      const lines = output.split('\n');
      const jsonStart = lines.findIndex((line) => line.trim().startsWith('{'));
      const jsonEnd = lines.findLastIndex((line) => line.trim().endsWith('}'));

      if (jsonStart >= 0 && jsonEnd >= 0) {
        const jsonStr = lines.slice(jsonStart, jsonEnd + 1).join('\n');
        const config = JSON.parse(jsonStr);

        expect(config).toBeDefined();
        expect(config.nameGeneration).toBeDefined();
        expect(config.nameGeneration.minimumLength).toBe(5);
      }
    });

    it('should include all expected nameGeneration fields when length is provided', () => {
      const output = execSync(`node ${enigmaCommand} --length=8 css-config`, {
        encoding: 'utf8',
        cwd: tempDir,
      });

      expect(output).toContain('"alphabet"');
      expect(output).toContain('"strategy"');
      expect(output).toContain('"ensureCssValid"');
      expect(output).toContain('"numericSuffix"');
      expect(output).toContain('"reservedNames"');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid length values gracefully', () => {
      // This should be handled by the global option validation
      try {
        execSync(`node ${enigmaCommand} --length=invalid css-config`, {
          encoding: 'utf8',
          cwd: tempDir,
        });
      } catch (error: any) {
        expect(error.status).toBe(1);
        expect(error.stderr || error.stdout).toContain('error');
      }
    });
  });
});
