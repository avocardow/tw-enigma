/**
 * Copyright (c) 2025 Rowan Cardow
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { promises as fs } from 'fs';
import { mkdtemp, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BUILD_TOOL_PRESETS,
  BuildToolWatchIntegration,
  createBuildToolWatchIntegration,
} from '../core/buildToolWatchIntegration';

describe('BuildToolWatchIntegration', () => {
  let tempDir: string;
  let integration: BuildToolWatchIntegration;
  let mockCssFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'build-tool-watch-test-'));
    mockCssFile = join(tempDir, 'styles.css');
    await fs.writeFile(mockCssFile, '.test { color: red; transform: scale(1.1); }');

    integration = createBuildToolWatchIntegration({
      enabled: true,
      buildTool: 'webpack',
      projectRoot: tempDir,
      watch: {
        include: ['**/*.css'],
        exclude: ['**/node_modules/**'],
        recursive: true,
        debounceMs: 50,
      },
      fastMode: {
        enabled: true,
        mode: 'ultra',
        showIndicators: false,
      },
      incremental: {
        enabled: true,
        cacheDir: join(tempDir, '.cache'),
        maxCacheSize: 10,
        trackDependencies: true,
      },
      hmr: {
        enabled: true,
        delay: 25,
        liveReload: true,
      },
    });
  });

  afterEach(async () => {
    if (integration) {
      await integration.cleanup();
    }
    try {
      await rmdir(tempDir, { recursive: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await expect(integration.initialize()).resolves.not.toThrow();
    });

    test('should start and stop watching', async () => {
      await integration.initialize();
      await expect(integration.startWatch()).resolves.not.toThrow();
      await expect(integration.stopWatch()).resolves.not.toThrow();
    });

    test('should emit watch-started event', async () => {
      const spy = jest.fn();
      integration.on('watch-started', spy);

      await integration.initialize();
      await integration.startWatch();

      expect(spy).toHaveBeenCalledWith({
        buildTool: 'webpack',
        config: expect.objectContaining({
          buildTool: 'webpack',
          enabled: true,
        }),
      });
    });
  });

  describe('File Change Handling', () => {
    beforeEach(async () => {
      await integration.initialize();
      await integration.startWatch();
    });

    test('should handle file changes', async () => {
      const result = await integration.handleFileChange(mockCssFile, 'change');

      expect(result).toEqual({
        success: true,
        duration: expect.any(Number),
        filesProcessed: expect.any(Number),
        bytesOptimized: expect.any(Number),
        buildTool: 'webpack',
        watchMode: {
          enabled: true,
          fastMode: expect.any(Boolean),
          incremental: expect.any(Boolean),
          cacheHit: expect.any(Boolean),
        },
        errors: [],
        warnings: [],
        metadata: expect.any(Object),
      });
    });

    test('should emit file-changed event', async () => {
      const spy = jest.fn();
      integration.on('file-changed', spy);

      await integration.handleFileChange(mockCssFile, 'change');

      expect(spy).toHaveBeenCalledWith({
        filePath: mockCssFile,
        buildTool: 'webpack',
        event: expect.objectContaining({
          type: 'change',
          path: mockCssFile,
        }),
      });
    });

    test('should emit optimization-complete event', async () => {
      const spy = jest.fn();
      integration.on('optimization-complete', spy);

      await integration.handleFileChange(mockCssFile, 'change');

      expect(spy).toHaveBeenCalledWith({
        result: expect.any(Object),
        buildTool: 'webpack',
      });
    });
  });

  describe('HMR Integration', () => {
    beforeEach(async () => {
      await integration.initialize();
      await integration.startWatch();
    });

    test('should trigger HMR updates', async () => {
      const spy = jest.fn();
      integration.on('hmr-update', spy);

      const hmrUpdate = {
        type: 'css' as const,
        path: mockCssFile,
        content: '.updated { color: blue; }',
        timestamp: Date.now(),
      };

      await integration.triggerHMR(hmrUpdate);

      expect(spy).toHaveBeenCalledWith({
        update: hmrUpdate,
        buildTool: 'webpack',
      });
    });
  });

  describe('Fast Mode', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should toggle fast mode', () => {
      const spy = jest.fn();
      integration.on('fast-mode-toggled', spy);

      integration.toggleFastMode(false);
      integration.toggleFastMode(true);

      // Should emit events when toggling
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should provide metrics', () => {
      const metrics = integration.getMetrics();

      expect(metrics).toEqual({
        buildTool: 'webpack',
        isWatching: expect.any(Boolean),
        fastMode: expect.any(Object),
        incremental: expect.any(Object),
        config: expect.any(Object),
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      const invalidIntegration = createBuildToolWatchIntegration({
        enabled: true,
        buildTool: 'webpack',
        projectRoot: '/nonexistent/path',
      });

      await expect(invalidIntegration.initialize()).rejects.toThrow();
    });

    test('should emit error events', async () => {
      const spy = jest.fn();
      integration.on('error', spy);

      // Force an error by handling invalid file
      await integration.handleFileChange('/invalid/path', 'change');

      expect(spy).toHaveBeenCalledWith({
        error: expect.any(Error),
        buildTool: 'webpack',
        context: expect.any(String),
      });
    });
  });
});

describe('Build Tool Presets', () => {
  test('should provide webpack preset', () => {
    const preset = BUILD_TOOL_PRESETS.webpack;

    expect(preset).toEqual({
      buildTool: 'webpack',
      watch: {
        include: ['**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        recursive: true,
        debounceMs: 300,
      },
      fastMode: {
        enabled: true,
        mode: 'balanced',
        showIndicators: true,
      },
    });
  });

  test('should provide vite preset', () => {
    const preset = BUILD_TOOL_PRESETS.vite;

    expect(preset).toEqual({
      buildTool: 'vite',
      watch: {
        include: ['**/*.css', '**/*.scss', '**/*.vue'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        recursive: true,
        debounceMs: 100,
      },
      fastMode: {
        enabled: true,
        mode: 'ultra',
        showIndicators: true,
      },
    });
  });

  test('should provide rollup preset', () => {
    const preset = BUILD_TOOL_PRESETS.rollup;

    expect(preset).toEqual({
      buildTool: 'rollup',
      watch: {
        include: ['**/*.css', '**/*.scss'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        recursive: true,
        debounceMs: 200,
      },
      fastMode: {
        enabled: true,
        mode: 'balanced',
        showIndicators: false,
      },
    });
  });
});

describe('Factory Function', () => {
  test('should create integration with default config', () => {
    const integration = createBuildToolWatchIntegration({});

    expect(integration).toBeInstanceOf(BuildToolWatchIntegration);
  });

  test('should create integration with custom config', () => {
    const integration = createBuildToolWatchIntegration({
      buildTool: 'vite',
      fastMode: { enabled: false, mode: 'conservative', showIndicators: false },
    });

    expect(integration).toBeInstanceOf(BuildToolWatchIntegration);
    const metrics = integration.getMetrics();
    expect(metrics.buildTool).toBe('vite');
  });
});

describe('Build Tool Adapters', () => {
  test('should support different build tools', async () => {
    const buildTools = ['webpack', 'rollup', 'vite', 'esbuild', 'parcel'] as const;

    for (const buildTool of buildTools) {
      const integration = createBuildToolWatchIntegration({
        buildTool,
        projectRoot: tempDir,
      });

      await expect(integration.initialize()).resolves.not.toThrow();
      await integration.cleanup();
    }
  });

  test('should handle adapter-specific configurations', async () => {
    const webpackIntegration = createBuildToolWatchIntegration({
      buildTool: 'webpack',
      watch: { debounceMs: 300 }, // Webpack-specific timing
    });

    const viteIntegration = createBuildToolWatchIntegration({
      buildTool: 'vite',
      watch: { debounceMs: 100 }, // Vite-specific timing
    });

    expect(webpackIntegration.getMetrics().config.watch.debounceMs).toBe(300);
    expect(viteIntegration.getMetrics().config.watch.debounceMs).toBe(100);

    await webpackIntegration.cleanup();
    await viteIntegration.cleanup();
  });
});

describe('Integration Lifecycle', () => {
  test('should handle complete lifecycle', async () => {
    const integration = createBuildToolWatchIntegration({
      buildTool: 'webpack',
      projectRoot: tempDir,
    });

    // Initialize
    await integration.initialize();
    expect(integration.getMetrics().isWatching).toBe(false);

    // Start watching
    await integration.startWatch();
    expect(integration.getMetrics().isWatching).toBe(true);

    // Process file change
    const result = await integration.handleFileChange(mockCssFile, 'change');
    expect(result.success).toBe(true);

    // Stop watching
    await integration.stopWatch();
    expect(integration.getMetrics().isWatching).toBe(false);

    // Cleanup
    await integration.cleanup();
  });

  test('should prevent duplicate operations', async () => {
    const integration = createBuildToolWatchIntegration({
      buildTool: 'webpack',
      projectRoot: tempDir,
    });

    await integration.initialize();
    await integration.startWatch();

    // Should not throw when starting watch again
    await expect(integration.startWatch()).resolves.not.toThrow();

    // Should not throw when stopping watch multiple times
    await integration.stopWatch();
    await expect(integration.stopWatch()).resolves.not.toThrow();

    await integration.cleanup();
  });
});
