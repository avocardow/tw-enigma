import { describe, test, expect } from 'vitest';
import { version, cliVersion, CLIUtils } from '../src/index';

describe('@tw-enigma/cli', () => {
  test('exports version correctly', () => {
    expect(version).toBe('0.1.0');
    expect(cliVersion).toBe('0.1.0');
  });

  test('CLIUtils.formatOutput works correctly', () => {
    const data = { test: 'value' };
    
    // Test JSON format
    const jsonOutput = CLIUtils.formatOutput(data, 'json');
    expect(jsonOutput).toBe(JSON.stringify(data, null, 2));
    
    // Test CSS format (default)
    const cssOutput = CLIUtils.formatOutput(data);
    expect(cssOutput).toBe(String(data));
  });

  test('CLIUtils.log and error methods exist', () => {
    expect(typeof CLIUtils.log).toBe('function');
    expect(typeof CLIUtils.error).toBe('function');
  });
}); 