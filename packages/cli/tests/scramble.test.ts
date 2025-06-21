/**
 * Scramble Command Tests
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createScrambleCommand } from '../src/commands/scramble';

describe('Scramble Command', () => {
  const testDir = join(process.cwd(), 'test-temp/scramble');
  const mockTemplate = `
// Configuration injected at build time by CLI
const CONFIG = {
  SCRAMBLE_INTERVAL: {{SCRAMBLE_INTERVAL}}, // Default: 150
  SCRAMBLE_MODE: "{{SCRAMBLE_MODE}}", // Default: "all"
  CHARSET: "{{CHARSET}}", // Default: "abcdefghijklmnopqrstuvwxyz"
  DEBUG_MODE: {{DEBUG_MODE}}, // Default: false
  RETRY_ATTEMPTS: {{RETRY_ATTEMPTS}}, // Default: 3
  CLEANUP_INTERVAL: {{CLEANUP_INTERVAL}}, // Default: 30
  MAX_REGISTRY_SIZE: {{MAX_REGISTRY_SIZE}}, // Default: 1000
  PERFORMANCE_MONITORING: {{PERFORMANCE_MONITORING}} // Default: false
};

console.log('Scramble configuration loaded:', CONFIG);
`;

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it('should create scramble command', () => {
    const command = createScrambleCommand();
    expect(command).toBeDefined();
    expect(command.name()).toBe('scramble');
    expect(command.description()).toBe('Integrate scramble effect into build output');
  });

  it('should have all expected options', () => {
    const command = createScrambleCommand();
    const options = command.options;

    const optionNames = options.map((opt) => opt.long);

    expect(optionNames).toContain('--out-dir');
    expect(optionNames).toContain('--scramble-speed');
    expect(optionNames).toContain('--scramble-debug');
    expect(optionNames).toContain('--scramble-mode');
    expect(optionNames).toContain('--scramble-charset');
    expect(optionNames).toContain('--build-scramble');
    expect(optionNames).toContain('--template');
    expect(optionNames).toContain('--skip-html-injection');
    expect(optionNames).toContain('--force');
  });

  it('should validate scramble speed option', () => {
    const command = createScrambleCommand();
    const speedOption = command.options.find((opt) => opt.long === '--scramble-speed');

    expect(speedOption).toBeDefined();
    expect(speedOption?.parseArg).toBeDefined();

    if (speedOption?.parseArg) {
      // Test valid speed
      expect(speedOption.parseArg('100', undefined)).toBe(100);

      // Test invalid speeds
      expect(() => speedOption.parseArg('30', undefined)).toThrow(
        'Invalid scramble speed: 30. Must be between 50-1000ms.'
      );
      expect(() => speedOption.parseArg('1500', undefined)).toThrow(
        'Invalid scramble speed: 1500. Must be between 50-1000ms.'
      );
      expect(() => speedOption.parseArg('invalid', undefined)).toThrow(
        'Invalid scramble speed: invalid. Must be between 50-1000ms.'
      );
    }
  });

  it('should create template file for testing', () => {
    const templatePath = join(testDir, 'template.js');
    writeFileSync(templatePath, mockTemplate, 'utf8');

    expect(existsSync(templatePath)).toBe(true);

    const content = readFileSync(templatePath, 'utf8');
    expect(content).toContain('{{SCRAMBLE_INTERVAL}}');
    expect(content).toContain('{{DEBUG_MODE}}');
  });
});
