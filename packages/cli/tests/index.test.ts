import { describe, expect, test } from 'vitest';
import { CLIUtils, cliVersion, version } from '../src/index';

describe('@tw-enigma/cli', () => {
  test('exports version correctly', () => {
    expect(version).toBe('1.0.0');
    expect(cliVersion).toBe('1.0.0');
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
