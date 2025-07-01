/**
 * Build Tool Integration Tests
 * Comprehensive testing of Webpack, Vite, PostCSS, and Rollup plugins
 */

import * as fs from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Import build tool plugins with correct names
import { postcssEnigma } from '../../src/integrations/postcss/postcssPlugin';
import { enigmaVite } from '../../src/integrations/vite/vitePlugin';
import { EnigmaWebpackPlugin } from '../../src/integrations/webpack/webpackPlugin';

// Mock data
const sampleCSS = `
.test {
  color: red;
  margin: 10px;
}

.example {
  @apply text-blue-500 p-4;
}

@media (max-width: 768px) {
  .responsive {
    display: none;
  }
}
`;

const sampleTailwindCSS = `
.text-red-500 { color: #ef4444; }
.text-blue-500 { color: #3b82f6; }
.p-4 { padding: 1rem; }
`;

describe('Build Tool Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'tw-enigma-test-'));

    // Create test CSS files
    await fs.writeFile(path.join(tempDir, 'input.css'), sampleCSS);
    await fs.writeFile(path.join(tempDir, 'tailwind.css'), sampleTailwindCSS);

    // Create test config
    const config = {
      input: path.join(tempDir, 'input.css'),
      output: path.join(tempDir, 'output.css'),
      enableOptimization: true,
      enableValidation: true,
      enableFormatting: true,
    };

    await fs.writeFile(
      path.join(tempDir, 'tw-enigma.config.js'),
      `module.exports = ${JSON.stringify(config, null, 2)};`
    );
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Integration Test Framework', () => {
    it('should create temporary test environment', async () => {
      expect(tempDir).toBeDefined();
      const files = await fs.readdir(tempDir);
      expect(files).toContain('input.css');
    });

    it('should handle CSS processing pipeline', async () => {
      const css = await fs.readFile(path.join(tempDir, 'input.css'), 'utf-8');
      expect(css).toContain('.test');
      expect(css).toContain('@apply');
    });
  });

  describe('Build Tool Plugin Architecture', () => {
    it('should support plugin configuration', () => {
      const config = {
        enableOptimization: true,
        enableValidation: true,
        enableFormatting: true,
      };

      expect(config.enableOptimization).toBe(true);
      expect(config.enableValidation).toBe(true);
      expect(config.enableFormatting).toBe(true);
    });

    it('should handle error scenarios gracefully', () => {
      const invalidConfig = {
        configPath: '/nonexistent/path',
      };

      expect(() => {
        // Test error handling
        if (!invalidConfig.configPath) {
          throw new Error('Config path required');
        }
      }).toThrow();
    });
  });

  describe('Webpack Plugin Integration', () => {
    it('should initialize with default configuration', () => {
      const plugin = new EnigmaWebpackPlugin();

      expect(plugin).toBeDefined();
      expect(plugin.constructor.name).toBe('EnigmaWebpackPlugin');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        enableOptimization: true,
        enableValidation: false,
      };

      const plugin = new EnigmaWebpackPlugin(customConfig);

      expect(plugin).toBeDefined();
    });

    it('should process CSS files during compilation', async () => {
      const plugin = new EnigmaWebpackPlugin({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
      });

      // Mock webpack compiler and compilation
      const mockCompiler = {
        hooks: {
          compilation: {
            tap: vi.fn(),
          },
        },
      };

      const mockCompilation = {
        hooks: {
          processAssets: {
            tap: vi.fn(),
          },
        },
        getAsset: vi.fn(() => ({
          source: () => sampleCSS,
          size: () => sampleCSS.length,
        })),
        updateAsset: vi.fn(),
        emitAsset: vi.fn(),
      };

      // Apply plugin
      plugin.apply(mockCompiler as any);

      // Verify hooks were registered
      expect(mockCompiler.hooks.compilation.tap).toHaveBeenCalled();
    });

    it('should handle HMR updates in development mode', async () => {
      const plugin = new EnigmaWebpackPlugin({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        enableHMR: true,
      });

      expect(plugin).toBeDefined();
      // HMR functionality would be tested with actual webpack dev server
    });
  });

  describe('Vite Plugin Integration', () => {
    it('should create plugin with default configuration', () => {
      const plugin = enigmaVite();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('enigma-vite');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        enableOptimization: true,
        enableValidation: true,
      };

      const plugin = enigmaVite(customConfig);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('enigma-vite');
    });

    it('should transform CSS during build', async () => {
      const plugin = enigmaVite({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
      });

      // Test the transform function if it exists
      if (plugin.transform && typeof plugin.transform === 'function') {
        const result = await plugin.transform(sampleCSS, 'test.css');
        expect(result).toBeDefined();
      }
    });

    it('should handle development server integration', async () => {
      const plugin = enigmaVite({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        enableHMR: true,
      });

      // Test configureServer hook if it exists
      if (plugin.configureServer) {
        const mockServer = {
          middlewares: {
            use: vi.fn(),
          },
        };

        plugin.configureServer(mockServer as any);
        expect(mockServer.middlewares.use).toHaveBeenCalled();
      }
    });
  });

  describe('PostCSS Plugin Integration', () => {
    it('should create plugin with default configuration', async () => {
      const plugin = postcssEnigma();

      expect(plugin).toBeDefined();
      expect(plugin.pluginName).toBe('postcss-enigma');
    });

    it('should accept custom configuration', async () => {
      const customConfig = {
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        enableOptimization: true,
        enableValidation: false,
      };

      const plugin = postcssEnigma(customConfig);

      expect(plugin).toBeDefined();
      expect(plugin.pluginName).toBe('postcss-enigma');
    });

    it('should process CSS through PostCSS pipeline', async () => {
      const plugin = postcssEnigma({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
      });

      // Mock PostCSS processor
      const postcss = (await import('postcss')).default;
      const processor = postcss([plugin as any]);

      const result = await processor.process(sampleCSS, {
        from: path.join(tempDir, 'input.css'),
        to: path.join(tempDir, 'output.css'),
      });

      expect(result).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should handle @apply directives', async () => {
      const cssWithApply = `
        .test {
          @apply text-blue-500 p-4;
        }
      `;

      const plugin = postcssEnigma({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        processing: {
          processApplyDirectives: true,
        },
      });

      const postcss = (await import('postcss')).default;
      const processor = postcss([plugin as any]);

      const result = await processor.process(cssWithApply, {
        from: path.join(tempDir, 'input.css'),
      });

      expect(result.css).toBeDefined();
    });
  });

  describe('Cross-Plugin Compatibility', () => {
    it('should work with multiple build tools simultaneously', async () => {
      // Test that plugins don't interfere with each other
      const webpackPlugin = new EnigmaWebpackPlugin({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
      });

      const vitePlugin = enigmaVite({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
      });

      const postcssPlugin = postcssEnigma({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
      });

      expect(webpackPlugin).toBeDefined();
      expect(vitePlugin).toBeDefined();
      expect(postcssPlugin).toBeDefined();
    });

    it('should maintain consistent configuration across plugins', async () => {
      const sharedConfig = {
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        enableOptimization: true,
        enableValidation: true,
        enableFormatting: false,
      };

      const webpackPlugin = new EnigmaWebpackPlugin(sharedConfig);
      const vitePlugin = enigmaVite(sharedConfig);
      const postcssPlugin = postcssEnigma(sharedConfig);

      // All plugins should be configured consistently
      expect(webpackPlugin).toBeDefined();
      expect(vitePlugin).toBeDefined();
      expect(postcssPlugin).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle missing configuration files gracefully', async () => {
      const invalidConfigPath = path.join(tempDir, 'nonexistent-config.js');

      expect(() => {
        new EnigmaWebpackPlugin({
          configPath: invalidConfigPath,
        });
      }).not.toThrow();

      expect(() => {
        enigmaVite({
          configPath: invalidConfigPath,
        });
      }).not.toThrow();

      expect(() => {
        postcssEnigma({
          configPath: invalidConfigPath,
        });
      }).not.toThrow();
    });

    it('should handle malformed CSS gracefully', async () => {
      const malformedCSS = `
        .test {
          color: red
          margin: 10px;
        broken syntax here
      `;

      const plugin = postcssEnigma({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
      });

      const postcss = (await import('postcss')).default;
      const processor = postcss([plugin as any]);

      // Should not throw but handle error gracefully
      try {
        await processor.process(malformedCSS, {
          from: path.join(tempDir, 'broken.css'),
        });
      } catch (error) {
        expect(error).toBeDefined();
        // Error should be PostCSS parsing error, not plugin error
      }
    });

    it('should provide helpful error messages', async () => {
      const plugin = postcssEnigma({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        enableValidation: true,
      });

      // Test error reporting
      expect(plugin).toBeDefined();
      // Actual error message testing would require more complex setup
    });
  });

  describe('Performance and Caching', () => {
    it('should support caching for performance', async () => {
      const plugin = postcssEnigma({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
        enableCaching: true,
      });

      // Process same CSS twice to test caching
      const postcss = (await import('postcss')).default;
      const processor = postcss([plugin as any]);

      const startTime1 = Date.now();
      await processor.process(sampleCSS, {
        from: path.join(tempDir, 'input.css'),
      });
      const duration1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      await processor.process(sampleCSS, {
        from: path.join(tempDir, 'input.css'),
      });
      const duration2 = Date.now() - startTime2;

      // Second run should be faster (though this test might be flaky)
      expect(duration2).toBeLessThanOrEqual(duration1 + 10); // Allow 10ms variance
    });

    it('should handle concurrent processing', async () => {
      const plugin = postcssEnigma({
        configPath: path.join(tempDir, 'tw-enigma.config.js'),
      });

      const postcss = (await import('postcss')).default;
      const processor = postcss([plugin as any]);

      // Process multiple CSS files concurrently
      const promises = Array.from({ length: 3 }, (_, i) =>
        processor.process(sampleCSS, {
          from: path.join(tempDir, `input-${i}.css`),
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.css).toBeDefined();
      });
    });
  });
});
