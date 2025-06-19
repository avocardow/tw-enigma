import { describe, test, expect } from 'vitest';
import { version, optimizeCSS, coreVersion } from '../src/index';

describe('@tw-enigma/core', () => {
  test('exports version correctly', () => {
    expect(version).toBe('0.1.0');
    expect(coreVersion).toBe('0.1.0');
  });

  test('optimizeCSS function exists and is callable', async () => {
    const result = await optimizeCSS('body { margin: 0; }');
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  test('optimizeCSS accepts configuration parameter', async () => {
    const config = { minify: true };
    const result = await optimizeCSS('body { margin: 0; }', config);
    expect(result).toBeDefined();
  });
});
