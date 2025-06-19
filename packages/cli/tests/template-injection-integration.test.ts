/**
 * Template Injection Integration Tests
 *
 * Comprehensive test suite covering the full template injection process:
 * - CLI template command usage scenarios
 * - Placeholder replacement in various contexts
 * - Error handling and validation
 * - Debug output verification
 * - Integration with scramble defaults
 * - Real-world usage patterns
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TemplateProcessor, processScrambleTemplate } from '../src/utils/template-processor';

describe('Template Injection Integration Tests', () => {
  const testDir = join(process.cwd(), 'test-temp/template-injection');
  const cliPath = join(process.cwd(), 'dist/enigma.js');

  beforeEach(() => {
    // Ensure test directory exists
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Ensure CLI is built
    if (!existsSync(cliPath)) {
      execSync('npm run build', { cwd: process.cwd() });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('CLI Template Command Integration', () => {
    it('should process template with scramble defaults via CLI', () => {
      // Create a test template
      const templateContent = `
// Configuration injected at build time by CLI
const CONFIG = {
  SCRAMBLE_INTERVAL: {{SCRAMBLE_INTERVAL}}, // Default: 150
  SCRAMBLE_MODE: "{{SCRAMBLE_MODE}}", // Default: "all"
  DEBUG_MODE: {{DEBUG_MODE}}, // Default: false
  CHARSET: "{{CHARSET}}" // Default: "abcdefghijklmnopqrstuvwxyz0123456789"
};

function debug(...args) {
  if (CONFIG.DEBUG_MODE) {
    console.log('[scramble]', ...args);
  }
}
`;

      const templatePath = join(testDir, 'scramble-template.js');
      const outputPath = join(testDir, 'scramble-output.js');

      writeFileSync(templatePath, templateContent);

      // Execute CLI command with scramble defaults
      const result = execSync(
        `node "${cliPath}" template "${templatePath}" --scramble --output "${outputPath}"`,
        {
          encoding: 'utf-8',
          cwd: testDir,
        }
      );

      // Verify output file was created
      expect(existsSync(outputPath)).toBe(true);

      const output = readFileSync(outputPath, 'utf-8');

      // Verify scramble defaults were applied
      expect(output).toContain('SCRAMBLE_INTERVAL: 150');
      expect(output).toContain('SCRAMBLE_MODE: "all"');
      expect(output).toContain('DEBUG_MODE: false');
      expect(output).toContain('CHARSET: "abcdefghijklmnopqrstuvwxyz0123456789"');

      // Verify result contains success feedback
      expect(result).toMatch(/template processed successfully|template processed/i);
    });

    it('should process template with custom configuration via CLI', () => {
      const templateContent = `
const CONFIG = {
  SCRAMBLE_INTERVAL: {{SCRAMBLE_INTERVAL}},
  DEBUG_MODE: {{DEBUG_MODE}},
  RETRY_ATTEMPTS: {{RETRY_ATTEMPTS}}
};
`;

      const configData = {
        SCRAMBLE_INTERVAL: 300,
        DEBUG_MODE: true,
        RETRY_ATTEMPTS: 5,
      };

      const templatePath = join(testDir, 'custom-template.js');
      const configPath = join(testDir, 'config.json');
      const outputPath = join(testDir, 'custom-output.js');

      writeFileSync(templatePath, templateContent);
      writeFileSync(configPath, JSON.stringify(configData, null, 2));

      // Execute CLI command with custom config
      const result = execSync(
        `node "${cliPath}" template "${templatePath}" --config-file "${configPath}" --output "${outputPath}"`,
        {
          encoding: 'utf-8',
          cwd: testDir,
        }
      );

      expect(existsSync(outputPath)).toBe(true);

      const output = readFileSync(outputPath, 'utf-8');
      expect(output).toContain('SCRAMBLE_INTERVAL: 300');
      expect(output).toContain('DEBUG_MODE: true');
      expect(output).toContain('RETRY_ATTEMPTS: 5');
    });

    it('should process template with inline configuration via CLI', () => {
      const templateContent = 'const interval = {{INTERVAL}}; const debug = {{DEBUG}};';
      const templatePath = join(testDir, 'inline-template.js');
      const outputPath = join(testDir, 'inline-output.js');

      writeFileSync(templatePath, templateContent);

      // Execute CLI command with inline config
      execSync(
        `node "${cliPath}" template "${templatePath}" --config '{"INTERVAL": 500, "DEBUG": true}' --output "${outputPath}"`,
        { cwd: testDir }
      );

      expect(existsSync(outputPath)).toBe(true);

      const output = readFileSync(outputPath, 'utf-8');
      expect(output).toContain('interval = 500');
      expect(output).toContain('debug = true');
    });

    it('should process template with --set flags via CLI', () => {
      const templateContent =
        'const speed = {{SPEED}}; const mode = "{{MODE}}"; const enabled = {{ENABLED}};';
      const templatePath = join(testDir, 'set-template.js');
      const outputPath = join(testDir, 'set-output.js');

      writeFileSync(templatePath, templateContent);

      // Execute CLI command with --set flags
      execSync(
        `node "${cliPath}" template "${templatePath}" --set SPEED=750 MODE=fast ENABLED=true --output "${outputPath}"`,
        { cwd: testDir }
      );

      expect(existsSync(outputPath)).toBe(true);

      const output = readFileSync(outputPath, 'utf-8');
      expect(output).toContain('speed = 750');
      expect(output).toContain('mode = "fast"');
      expect(output).toContain('enabled = true');
    });

    it('should validate template syntax via CLI', () => {
      const validTemplate = 'const value = {{VALID_PLACEHOLDER}};';
      const invalidTemplate = 'const value = {{INVALID_PLACEHOLDER; // Missing closing brace';

      const validPath = join(testDir, 'valid-template.js');
      const invalidPath = join(testDir, 'invalid-template.js');

      writeFileSync(validPath, validTemplate);
      writeFileSync(invalidPath, invalidTemplate);

      // Test valid template validation
      const validResult = execSync(`node "${cliPath}" template "${validPath}" --validate-only`, {
        encoding: 'utf-8',
        cwd: testDir,
      });
      expect(validResult).toMatch(/validation passed|template valid/i);

      // Test invalid template validation
      let invalidResult: string;
      try {
        execSync(`node "${cliPath}" template "${invalidPath}" --validate-only`, {
          encoding: 'utf-8',
          cwd: testDir,
        });
        throw new Error('Should have failed validation');
      } catch (error: any) {
        invalidResult = (error.stdout || '') + (error.stderr || '') + (error.message || '');
      }
      expect(invalidResult).toMatch(
        /validation failed|unmatched braces|template validation failed/i
      );
    });
  });

  describe('Template Processor Integration', () => {
    it('should process complex template with all data types', () => {
      const processor = new TemplateProcessor({ strict: true });

      const template = `
const CONFIG = {
  // String values
  MODE: "{{MODE}}",
  CHARSET: "{{CHARSET}}",

  // Number values
  INTERVAL: {{INTERVAL}},
  RETRY_COUNT: {{RETRY_COUNT}},

  // Boolean values
  DEBUG: {{DEBUG}},
  ENABLED: {{ENABLED}},

  // Complex string with escaping
  MESSAGE: "{{MESSAGE}}"
};
`;

      const config = {
        MODE: 'production',
        CHARSET: 'abc123!@#',
        INTERVAL: 150,
        RETRY_COUNT: 3,
        DEBUG: true,
        ENABLED: false,
        MESSAGE: 'Hello "world" with\nnewlines and\ttabs',
      };

      const result = processor.process(template, config);

      expect(result.output).toContain('MODE: "production"');
      expect(result.output).toContain('CHARSET: "abc123!@#"');
      expect(result.output).toContain('INTERVAL: 150');
      expect(result.output).toContain('RETRY_COUNT: 3');
      expect(result.output).toContain('DEBUG: true');
      expect(result.output).toContain('ENABLED: false');
      expect(result.output).toContain('MESSAGE: "Hello \\"world\\" with\\nnewlines and\\ttabs"');

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(Object.keys(result.replacements)).toHaveLength(7);
    });

    it('should handle missing placeholders in strict mode', () => {
      const processor = new TemplateProcessor({ strict: true });

      const template = 'const a = {{VALUE_A}}; const b = {{VALUE_B}};';
      const config = { VALUE_A: 'provided' };

      const result = processor.process(template, config);

      expect(result.errors).toContain('Missing value for placeholder: VALUE_B');
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle missing placeholders in non-strict mode', () => {
      const processor = new TemplateProcessor({ strict: false });

      const template = 'const a = {{VALUE_A}}; const b = {{VALUE_B}};';
      const config = { VALUE_A: 'provided' };

      const result = processor.process(template, config);

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain(
        'No value provided for placeholder: VALUE_B, keeping original'
      );
      expect(result.output).toContain('const a = provided');
      expect(result.output).toContain('const b = {{VALUE_B}}'); // Unchanged
    });

    it('should detect unused configuration values', () => {
      const processor = new TemplateProcessor({ strict: false });

      const template = 'const value = {{USED_VALUE}};';
      const config = {
        USED_VALUE: 'used',
        UNUSED_VALUE: 'unused',
        ANOTHER_UNUSED: 'also unused',
      };

      const result = processor.process(template, config);

      expect(result.warnings).toContain('Unused configuration value: UNUSED_VALUE');
      expect(result.warnings).toContain('Unused configuration value: ANOTHER_UNUSED');
      expect(result.warnings).toHaveLength(2);
    });
  });

  describe('Scramble Template Integration', () => {
    it('should process scramble template with defaults', () => {
      const template = `
const CONFIG = {
  SCRAMBLE_INTERVAL: {{SCRAMBLE_INTERVAL}},
  SCRAMBLE_MODE: "{{SCRAMBLE_MODE}}",
  CHARSET: "{{CHARSET}}",
  DEBUG_MODE: {{DEBUG_MODE}},
  RETRY_ATTEMPTS: {{RETRY_ATTEMPTS}},
  CLEANUP_INTERVAL: {{CLEANUP_INTERVAL}},
  MAX_REGISTRY_SIZE: {{MAX_REGISTRY_SIZE}},
  PERFORMANCE_MONITORING: {{PERFORMANCE_MONITORING}}
};
`;

      const result = processScrambleTemplate(template, {});

      // Verify all default values are applied
      expect(result.output).toContain('SCRAMBLE_INTERVAL: 150');
      expect(result.output).toContain('SCRAMBLE_MODE: "all"');
      expect(result.output).toContain('CHARSET: "abcdefghijklmnopqrstuvwxyz0123456789"');
      expect(result.output).toContain('DEBUG_MODE: false');
      expect(result.output).toContain('RETRY_ATTEMPTS: 3');
      expect(result.output).toContain('CLEANUP_INTERVAL: 30');
      expect(result.output).toContain('MAX_REGISTRY_SIZE: 1000');
      expect(result.output).toContain('PERFORMANCE_MONITORING: false');

      expect(Object.keys(result.replacements)).toHaveLength(8);
    });

    it('should process scramble template with overrides', () => {
      const template = `
const CONFIG = {
  SCRAMBLE_INTERVAL: {{SCRAMBLE_INTERVAL}},
  DEBUG_MODE: {{DEBUG_MODE}},
  CHARSET: "{{CHARSET}}"
};
`;

      const overrides = {
        SCRAMBLE_INTERVAL: 200,
        DEBUG_MODE: true,
        CHARSET: 'xyz789',
      };

      const result = processScrambleTemplate(template, overrides);

      // Verify overrides are applied
      expect(result.output).toContain('SCRAMBLE_INTERVAL: 200');
      expect(result.output).toContain('DEBUG_MODE: true');
      expect(result.output).toContain('CHARSET: "xyz789"');

      expect(Object.keys(result.replacements)).toHaveLength(3);
    });

    it('should handle partial scramble configuration', () => {
      const template = `
const CONFIG = {
  SCRAMBLE_INTERVAL: {{SCRAMBLE_INTERVAL}},
  DEBUG_MODE: {{DEBUG_MODE}},
  UNKNOWN_PLACEHOLDER: {{UNKNOWN_PLACEHOLDER}}
};
`;

      const partialConfig = {
        SCRAMBLE_INTERVAL: 100,
      };

      const result = processScrambleTemplate(template, partialConfig);

      // Verify partial override and defaults
      expect(result.output).toContain('SCRAMBLE_INTERVAL: 100'); // Override
      expect(result.output).toContain('DEBUG_MODE: false'); // Default
      expect(result.output).toContain('{{UNKNOWN_PLACEHOLDER}}'); // Unchanged (not in defaults)

      expect(
        result.warnings.some((w) => w.includes('UNKNOWN_PLACEHOLDER')) ||
          result.output.includes('{{UNKNOWN_PLACEHOLDER}}')
      ).toBe(true);
    });
  });

  describe('Debug Mode Integration', () => {
    it('should provide comprehensive debug information', () => {
      const processor = new TemplateProcessor({ debug: true });

      const template = 'const a = {{VALUE_A}}; const b = {{VALUE_B}};';
      const config = { VALUE_A: 'test', VALUE_B: 123 };

      const result = processor.process(template, config);

      expect(result.debug).toBeDefined();
      expect(result.debug!.templateLength).toBe(template.length);
      expect(result.debug!.placeholdersFound).toEqual(['VALUE_A', 'VALUE_B']);
      expect(result.debug!.configKeys).toEqual(['VALUE_A', 'VALUE_B']);
      expect(result.debug!.processingSteps.length).toBeGreaterThan(0);
      expect(result.debug!.replacementDetails).toHaveLength(2);

      // Check replacement details
      const valueADetail = result.debug!.replacementDetails.find(
        (d) => d.placeholder === 'VALUE_A'
      );
      expect(valueADetail).toBeDefined();
      expect(valueADetail!.originalValue).toBe('test');
      expect(valueADetail!.formattedValue).toBe('test');
      expect(valueADetail!.type).toBe('string');

      const valueBDetail = result.debug!.replacementDetails.find(
        (d) => d.placeholder === 'VALUE_B'
      );
      expect(valueBDetail).toBeDefined();
      expect(valueBDetail!.originalValue).toBe(123);
      expect(valueBDetail!.formattedValue).toBe('123');
      expect(valueBDetail!.type).toBe('number');
    });

    it('should provide debug information for validation', () => {
      const processor = new TemplateProcessor({ debug: true });

      const invalidTemplate = 'const value = {{INVALID_PLACEHOLDER;';
      const validation = processor.validateTemplate(invalidTemplate);

      expect(validation.debug).toBeDefined();
      expect(validation.debug!.length).toBeGreaterThan(0);
      expect(validation.debug!.join(' ')).toMatch(/validation|braces|analysis/i);
    });

    it('should work with scramble template debug mode', () => {
      const template = 'const interval = {{SCRAMBLE_INTERVAL}}; const debug = {{DEBUG_MODE}};';
      const config = { SCRAMBLE_INTERVAL: 250 };

      const result = processScrambleTemplate(template, config, { debug: true });

      expect(result.debug).toBeDefined();
      expect(result.debug!.processingSteps.length).toBeGreaterThan(0);
      expect(result.debug!.replacementDetails.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid number values', () => {
      const processor = new TemplateProcessor({ strict: true });

      const template = 'const value = {{NUMBER_VALUE}};';
      const config = { NUMBER_VALUE: NaN };

      expect(() => processor.process(template, config)).toThrow('Invalid number value');
    });

    it('should handle unsupported value types', () => {
      const processor = new TemplateProcessor({ strict: true });

      const template = 'const value = {{OBJECT_VALUE}};';
      const config = { OBJECT_VALUE: { key: 'value' } as any };

      expect(() => processor.process(template, config)).toThrow('Unsupported value type');
    });

    it('should handle file I/O errors via CLI', () => {
      // Test with non-existent template file
      expect(() => {
        execSync(`node "${cliPath}" template "non-existent-template.js"`, { cwd: testDir });
      }).toThrow();

      // Test with invalid JSON config
      const templatePath = join(testDir, 'test-template.js');
      writeFileSync(templatePath, 'const value = {{VALUE}};');

      expect(() => {
        execSync(`node "${cliPath}" template "${templatePath}" --config 'invalid json'`, {
          cwd: testDir,
        });
      }).toThrow();
    });

    it('should handle malformed --set arguments via CLI', () => {
      const templatePath = join(testDir, 'test-template.js');
      writeFileSync(templatePath, 'const value = {{VALUE}};');

      expect(() => {
        execSync(`node "${cliPath}" template "${templatePath}" --set INVALID_FORMAT`, {
          cwd: testDir,
        });
      }).toThrow();
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should handle large template with many placeholders', () => {
      const placeholders = Array.from({ length: 50 }, (_, i) => `PLACEHOLDER_${i}`);
      const template = placeholders.map((p) => `const ${p.toLowerCase()} = {{${p}}};`).join('\n');

      const config = Object.fromEntries(
        placeholders.map((p, i) => [
          p,
          i % 3 === 0 ? i : i % 3 === 1 ? `value_${i}` : i % 2 === 0 ? true : false,
        ])
      );

      const processor = new TemplateProcessor({ strict: true, debug: true });
      const result = processor.process(template, config);

      // Debug: log actual vs expected
      console.log('Template preview:', template.substring(0, 200) + '...');
      console.log('Config keys:', Object.keys(config));
      console.log('Actual replacements:', Object.keys(result.replacements).length);
      console.log('Expected replacements:', 50);
      console.log('Errors:', result.errors);
      console.log('Debug placeholders found:', result.debug?.placeholdersFound);
      console.log('Template length:', template.length);
      console.log('Template contains PLACEHOLDER_0?', template.includes('{{PLACEHOLDER_0}}'));

      expect(result.errors).toHaveLength(0);
      expect(Object.keys(result.replacements)).toHaveLength(50);
    });

    it('should handle production-like scramble template', () => {
      const productionTemplate = `
(function() {
  'use strict';

  // Configuration injected at build time by CLI
  const CONFIG = {
    SCRAMBLE_INTERVAL: {{SCRAMBLE_INTERVAL}}, // Default: 150
    SCRAMBLE_MODE: "{{SCRAMBLE_MODE}}", // Default: "all"
    CHARSET: "{{CHARSET}}", // Default: "abcdefghijklmnopqrstuvwxyz0123456789"
    DEBUG_MODE: {{DEBUG_MODE}}, // Default: false
    RETRY_ATTEMPTS: {{RETRY_ATTEMPTS}}, // Default: 3
    CLEANUP_INTERVAL: {{CLEANUP_INTERVAL}}, // Default: 30
    MAX_REGISTRY_SIZE: {{MAX_REGISTRY_SIZE}}, // Default: 1000
    PERFORMANCE_MONITORING: {{PERFORMANCE_MONITORING}} // Default: false
  };

  function debug(...args) {
    if (CONFIG.DEBUG_MODE) {
      console.log('[tw-enigma/scramble]', ...args);
    }
  }

  // Production scramble logic would go here...
  debug('Scramble configuration loaded:', CONFIG);
})();
`;

      const productionConfig = {
        SCRAMBLE_INTERVAL: 100,
        SCRAMBLE_MODE: 'partial',
        DEBUG_MODE: false,
        PERFORMANCE_MONITORING: true,
      };

      const result = processScrambleTemplate(productionTemplate, productionConfig);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toContain('SCRAMBLE_INTERVAL: 100');
      expect(result.output).toContain('SCRAMBLE_MODE: "partial"');
      expect(result.output).toContain('DEBUG_MODE: false');
      expect(result.output).toContain('PERFORMANCE_MONITORING: true');

      // Verify defaults are applied for unspecified values
      expect(result.output).toContain('CHARSET: "abcdefghijklmnopqrstuvwxyz0123456789"');
      expect(result.output).toContain('RETRY_ATTEMPTS: 3');
      expect(result.output).toContain('CLEANUP_INTERVAL: 30');
      expect(result.output).toContain('MAX_REGISTRY_SIZE: 1000');
    });

    it('should handle edge case with string values containing quotes and special characters', () => {
      const template = 'const message = "{{MESSAGE}}"; const path = "{{FILE_PATH}}";';
      const config = {
        MESSAGE: 'Hello "world" with \n new lines and \t tabs',
        FILE_PATH: 'C:\\Users\\test\\file with spaces.js',
      };

      const processor = new TemplateProcessor({ strict: true });
      const result = processor.process(template, config);

      expect(result.errors).toHaveLength(0);
      expect(result.output).toContain('Hello \\"world\\" with \\n new lines and \\t tabs');
      expect(result.output).toContain('C:\\\\Users\\\\test\\\\file with spaces.js');
    });

    it('should maintain proper JavaScript syntax after processing', () => {
      const template = `
const config = {
  interval: {{INTERVAL}},
  message: "{{MESSAGE}}",
  enabled: {{ENABLED}},
  values: [{{VALUE1}}, {{VALUE2}}, {{VALUE3}}]
};

function init() {
  if (config.enabled && config.interval > 0) {
    console.log(config.message);
  }
}
`;

      const config = {
        INTERVAL: 150,
        MESSAGE: 'Scramble initialized',
        ENABLED: true,
        VALUE1: 10,
        VALUE2: 20,
        VALUE3: 30,
      };

      const processor = new TemplateProcessor({ strict: true });
      const result = processor.process(template, config);

      expect(result.errors).toHaveLength(0);

      // Test that the resulting JavaScript is syntactically valid
      expect(() => {
        // Just test that it can be parsed by the JS engine
        new Function(result.output);
      }).not.toThrow();

      // Verify structure is maintained
      expect(result.output).toContain('interval: 150');
      expect(result.output).toContain('message: "Scramble initialized"');
      expect(result.output).toContain('enabled: true');
      expect(result.output).toContain('values: [10, 20, 30]');
    });
  });

  describe('Command Integration with Common Options', () => {
    it('should respect debug flag across all processing modes', () => {
      const templateContent = 'const value = {{TEST_VALUE}};';
      const templatePath = join(testDir, 'debug-template.js');
      writeFileSync(templatePath, templateContent);

      // Test debug output with scramble defaults
      const debugResult = execSync(
        `node "${cliPath}" template "${templatePath}" --scramble --debug`,
        { encoding: 'utf-8', cwd: testDir }
      );

      expect(debugResult).toMatch(/debug mode enabled|processing steps|replacement details/i);
    });

    it('should handle command-specific help', () => {
      const helpOutput = execSync(`node "${cliPath}" template --help`, {
        encoding: 'utf-8',
        cwd: testDir,
      });

      expect(helpOutput).toContain('Process templates with placeholder replacement');
      expect(helpOutput).toContain('--config');
      expect(helpOutput).toContain('--scramble');
      expect(helpOutput).toContain('--validate-only');
      expect(helpOutput).toContain('--set');
    });
  });
});
