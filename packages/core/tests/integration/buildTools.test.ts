/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Build Tool Integration Tests
 * Tests for ESBuild, Parcel, and Next.js integrations
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

// ESBuild Integration Tests
import {
  EnigmaESBuildPlugin,
  defaultESBuildConfig,
  enigmaESBuild,
  esbuildPluginConfigSchema,
} from '../../src/integrations/esbuild';

// Parcel Integration Tests
import {
  EnigmaParcelTransformer,
  defaultParcelConfig,
  enigmaParcel,
  parcelTransformerConfigSchema,
} from '../../src/integrations/parcel';

// Next.js Integration Tests
import {
  EnigmaNextJSPlugin,
  defaultNextJSConfig,
  enigmaNextJS,
  nextjsPluginConfigSchema,
  withEnigma,
} from '../../src/integrations/nextjs';

import type { BuildToolContext } from '../../src/integrations/core/buildToolPlugin';

describe('ESBuild Integration', () => {
  let tempDir: string;
  let plugin: EnigmaESBuildPlugin;
  let context: BuildToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'esbuild-test-'));

    plugin = new EnigmaESBuildPlugin({
      name: 'test-esbuild-plugin',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'esbuild',
        autoDetect: true,
        development: { hmr: true },
        production: { sourceMaps: true, minify: true },
        esbuild: { platform: 'browser', format: 'esm' },
      },
    });

    context = {
      buildTool: 'esbuild',
      phase: 'transform',
      isDevelopment: true,
      isProduction: false,
      projectRoot: tempDir,
      sourceFiles: [],
      assets: new Map(),
      metrics: {
        startTime: Date.now(),
        phaseTimings: {},
        memoryPeaks: {},
        assetSizes: {},
        fileCounts: { total: 0, processed: 0, skipped: 0 },
      },
    };
  });

  it('should create ESBuild plugin with default configuration', () => {
    const defaultPlugin = enigmaESBuild();

    expect(defaultPlugin).toBeInstanceOf(EnigmaESBuildPlugin);
    expect(defaultPlugin.name).toBe('enigma-esbuild-plugin');
    expect(defaultPlugin.supportedBuildTools).toContain('esbuild');
  });

  it('should validate ESBuild plugin configuration', () => {
    const validConfig = {
      name: 'test-plugin',
      enabled: true,
      priority: 5,
      buildTool: {
        type: 'esbuild' as const,
        autoDetect: false,
        esbuild: { platform: 'node' as const, format: 'cjs' as const },
      },
    };

    const result = esbuildPluginConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should initialize build tool correctly', async () => {
    const config = {
      name: 'test-esbuild-plugin',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'esbuild' as const,
        autoDetect: true,
        development: { hmr: true },
        production: { sourceMaps: true, minify: true },
      },
    };
    await expect(plugin.initializeBuildTool(context, config)).resolves.toBeUndefined();
  });

  it('should process build successfully', async () => {
    const result = await plugin.processBuild(context);

    expect(result.success).toBe(true);
    expect(result.assets).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it('should create ESBuild plugin configuration', () => {
    const config = plugin.getBuildToolConfig();

    expect(config.plugins).toBeInstanceOf(Array);
    expect(config.platform).toBe('browser');
    expect(config.format).toBe('esm');
    expect(config.bundle).toBe(true);
  });

  it('should handle CSS file transformation through hooks', async () => {
    const cssCode = '.test { color: red; }';
    const filePath = 'test.css';

    if (plugin.hooks.transform) {
      const result = await plugin.hooks.transform(context, cssCode, filePath);
      expect(typeof result).toBe('string');
    }
  });
});

describe('Parcel Integration', () => {
  let tempDir: string;
  let transformer: EnigmaParcelTransformer;
  let context: BuildToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'parcel-test-'));

    transformer = new EnigmaParcelTransformer({
      name: 'test-parcel-transformer',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'parcel',
        autoDetect: true,
        development: { hmr: true },
        production: { sourceMaps: true, minify: true },
        parcel: { bundle: { cacheDir: '.parcel-cache' } },
      },
    });

    context = {
      buildTool: 'parcel',
      phase: 'transform',
      isDevelopment: true,
      isProduction: false,
      projectRoot: tempDir,
      sourceFiles: [],
      assets: new Map(),
      metrics: {
        startTime: Date.now(),
        phaseTimings: {},
        memoryPeaks: {},
        assetSizes: {},
        fileCounts: { total: 0, processed: 0, skipped: 0 },
      },
    };
  });

  it('should create Parcel transformer with default configuration', () => {
    const defaultTransformer = enigmaParcel();

    expect(defaultTransformer).toBeInstanceOf(EnigmaParcelTransformer);
    expect(defaultTransformer.name).toBe('enigma-parcel-transformer');
    expect(defaultTransformer.supportedBuildTools).toContain('parcel');
  });

  it('should validate Parcel transformer configuration', () => {
    const validConfig = {
      name: 'test-transformer',
      enabled: true,
      priority: 5,
      buildTool: {
        type: 'parcel' as const,
        autoDetect: false,
        parcel: { bundle: { cacheDir: 'custom-cache' } },
      },
    };

    const result = parcelTransformerConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should initialize build tool correctly', async () => {
    const config = {
      name: 'test-parcel-transformer',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'parcel' as const,
        autoDetect: true,
        development: { hmr: true },
        production: { sourceMaps: true, minify: true },
      },
    };
    await expect(transformer.initializeBuildTool(context, config)).resolves.toBeUndefined();
  });

  it('should process build successfully', async () => {
    const result = await transformer.processBuild(context);

    expect(result.success).toBe(true);
    expect(result.assets).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it('should create Parcel transformer configuration', () => {
    const config = transformer.getBuildToolConfig();

    expect(config.transformers).toBeDefined();
    expect(config.bundle?.cacheDir).toBe('.parcel-cache');
  });

  it('should handle CSS transformation', async () => {
    const cssCode = '.example { background: blue; }';
    const filePath = 'example.css';

    if (transformer.hooks.transform) {
      const result = await transformer.hooks.transform(context, cssCode, filePath);
      expect(typeof result).toBe('string');
    }
  });
});

describe('Next.js Integration', () => {
  let tempDir: string;
  let plugin: EnigmaNextJSPlugin;
  let context: BuildToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'nextjs-test-'));

    plugin = new EnigmaNextJSPlugin({
      name: 'test-nextjs-plugin',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'nextjs',
        autoDetect: true,
        development: { hmr: true },
        production: { sourceMaps: true, minify: true },
        nextjs: {
          configMode: 'merge',
          webpack: { optimize: true },
          experimental: { appDir: true },
        },
      },
    });

    context = {
      buildTool: 'nextjs',
      phase: 'transform',
      isDevelopment: true,
      isProduction: false,
      projectRoot: tempDir,
      sourceFiles: [],
      assets: new Map(),
      metrics: {
        startTime: Date.now(),
        phaseTimings: {},
        memoryPeaks: {},
        assetSizes: {},
        fileCounts: { total: 0, processed: 0, skipped: 0 },
      },
    };
  });

  it('should create Next.js plugin with default configuration', () => {
    const defaultPlugin = enigmaNextJS();

    expect(defaultPlugin).toBeInstanceOf(EnigmaNextJSPlugin);
    expect(defaultPlugin.name).toBe('enigma-nextjs-plugin');
    expect(defaultPlugin.supportedBuildTools).toContain('nextjs');
  });

  it('should validate Next.js plugin configuration', () => {
    const validConfig = {
      name: 'test-plugin',
      enabled: true,
      priority: 5,
      buildTool: {
        type: 'nextjs' as const,
        autoDetect: false,
        nextjs: {
          configMode: 'override' as const,
          webpack: { optimize: false },
        },
      },
    };

    const result = nextjsPluginConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should initialize build tool correctly', async () => {
    const config = {
      name: 'test-nextjs-plugin',
      enabled: true,
      priority: 10,
      buildTool: {
        type: 'nextjs' as const,
        autoDetect: true,
        development: { hmr: true },
        production: { sourceMaps: true, minify: true },
      },
    };
    await expect(plugin.initializeBuildTool(context, config)).resolves.toBeUndefined();
  });

  it('should process build successfully', async () => {
    const result = await plugin.processBuild(context);

    expect(result.success).toBe(true);
    expect(result.assets).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it('should create Next.js configuration', () => {
    const config = plugin.createNextConfig();

    expect(config.webpack).toBeInstanceOf(Function);
  });

  it('should merge existing Next.js configuration', () => {
    const existingConfig = {
      experimental: { serverComponents: true },
      env: { CUSTOM_KEY: 'value' },
    };

    const mergedConfig = plugin.createNextConfig(existingConfig);

    expect(mergedConfig.experimental?.serverComponents).toBe(true);
    expect(mergedConfig.env?.CUSTOM_KEY).toBe('value');
    expect(mergedConfig.webpack).toBeInstanceOf(Function);
  });

  it('should use withEnigma helper function', () => {
    const nextConfig = {
      experimental: { appDir: true },
      env: { NODE_ENV: 'test' },
    };
    const pluginConfig = { name: 'custom-plugin' };

    const result = withEnigma(nextConfig, pluginConfig);

    expect(result.webpack).toBeInstanceOf(Function);
  });

  it('should handle CSS transformation through hooks', async () => {
    const cssCode = '.nextjs-test { margin: 10px; }';
    const filePath = 'globals.css';

    if (plugin.hooks.transform) {
      const result = await plugin.hooks.transform(context, cssCode, filePath);
      expect(typeof result).toBe('string');
    }
  });
});

describe('Build Tool Integration Manager', () => {
  it('should import all build tool plugins successfully', async () => {
    // Test dynamic imports work correctly
    const { EnigmaESBuildPlugin } = await import('../../src/integrations/esbuild');
    const { EnigmaParcelTransformer } = await import('../../src/integrations/parcel');
    const { EnigmaNextJSPlugin } = await import('../../src/integrations/nextjs');

    expect(EnigmaESBuildPlugin).toBeDefined();
    expect(EnigmaParcelTransformer).toBeDefined();
    expect(EnigmaNextJSPlugin).toBeDefined();
  });

  it('should validate all configuration schemas', () => {
    const esbuildResult = esbuildPluginConfigSchema.safeParse(defaultESBuildConfig);
    const parcelResult = parcelTransformerConfigSchema.safeParse(defaultParcelConfig);
    const nextjsResult = nextjsPluginConfigSchema.safeParse(defaultNextJSConfig);

    expect(esbuildResult.success).toBe(true);
    expect(parcelResult.success).toBe(true);
    expect(nextjsResult.success).toBe(true);
  });

  it('should create all plugins with factory functions', () => {
    const esbuildPlugin = enigmaESBuild({ name: 'test-esbuild' });
    const parcelTransformer = enigmaParcel({ name: 'test-parcel' });
    const nextjsPlugin = enigmaNextJS({ name: 'test-nextjs' });

    expect(esbuildPlugin.name).toBe('test-esbuild');
    expect(parcelTransformer.name).toBe('test-parcel');
    expect(nextjsPlugin.name).toBe('test-nextjs');
  });
});
