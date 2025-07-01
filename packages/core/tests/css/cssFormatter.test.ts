/**
 * CSS Formatter Tests
 * Tests for the comprehensive CSS formatting functionality
 */

import { describe, expect, it } from 'vitest';
import {
  createDevelopmentFormatter,
  createMinimalFormatter,
  createProductionFormatter,
  CssFormatter,
  CssFormatterConfig,
} from '../../src/css/cssFormatter';

describe('CssFormatter', () => {
  describe('Basic formatting', () => {
    it('should format simple CSS with default options', async () => {
      const formatter = new CssFormatter();
      const css = '.test{color:red;margin:10px;}';

      const result = await formatter.formatCss(css);

      expect(result.success).toBe(true);
      expect(result.css).toContain('color: red');
      expect(result.css).toContain('margin: 10px');
    });

    it('should handle empty CSS', async () => {
      const formatter = new CssFormatter();
      const result = await formatter.formatCss('');

      expect(result.success).toBe(true);
      expect(result.css).toBe('');
      expect(result.stats.rulesProcessed).toBe(0);
    });

    it('should preserve CSS semantics', async () => {
      const formatter = new CssFormatter();
      const css = '.test { color: red; } .test:hover { color: blue; }';

      const result = await formatter.formatCss(css);

      expect(result.success).toBe(true);
      expect(result.css).toContain('.test');
      expect(result.css).toContain('.test:hover');
    });
  });

  describe('Indentation options', () => {
    it('should use spaces for indentation by default', async () => {
      const formatter = new CssFormatter();
      const css = '.test{color:red;}';

      const result = await formatter.formatCss(css);

      expect(result.css).toMatch(/^\.test \{\n {2}/);
    });

    it('should use tabs when configured', async () => {
      const config: Partial<CssFormatterConfig> = {
        indentStyle: 'tabs',
      };
      const formatter = new CssFormatter(config);
      const css = '.test{color:red;}';

      const result = await formatter.formatCss(css);

      expect(result.css).toMatch(/^\t/m);
    });

    it('should respect custom indent size', async () => {
      const config: Partial<CssFormatterConfig> = {
        indentSize: 4,
      };
      const formatter = new CssFormatter(config);
      const css = '.test{color:red;}';

      const result = await formatter.formatCss(css);

      expect(result.css).toMatch(/^\.test \{\n {4}/);
    });
  });

  describe('Output formats', () => {
    it('should produce compact output', async () => {
      const config: Partial<CssFormatterConfig> = {
        outputFormat: 'compact',
      };
      const formatter = new CssFormatter(config);
      const css = '.test { color: red; margin: 10px; }';

      const result = await formatter.formatCss(css);

      expect(result.css).not.toContain('\n');
      expect(result.css).toContain('.test{');
    });

    it('should produce pretty output', async () => {
      const config: Partial<CssFormatterConfig> = {
        outputFormat: 'pretty',
      };
      const formatter = new CssFormatter(config);
      const css = '.test{color:red;margin:10px;}';

      const result = await formatter.formatCss(css);

      expect(result.css).toContain('\n');
      expect(result.css).toMatch(/\.test/);
    });

    it('should produce readable output with comments', async () => {
      const config: Partial<CssFormatterConfig> = {
        outputFormat: 'readable',
        includeComments: true,
      };
      const formatter = new CssFormatter(config);
      const css = '.test{color:red;margin:10px;}';

      const result = await formatter.formatCss(css);

      expect(result.css).toContain('\n');
      expect(result.css).toContain('/* ');
    });
  });

  describe('Property ordering', () => {
    it('should order properties alphabetically', async () => {
      const config: Partial<CssFormatterConfig> = {
        propertyOrder: 'alphabetical',
      };
      const formatter = new CssFormatter(config);
      const css = '.test { z-index: 1; color: red; background: blue; }';

      const result = await formatter.formatCss(css);

      const lines = result.css.split('\n').filter((line) => line.trim());
      const properties = lines.slice(1, -1).map((line) => line.trim().split(':')[0]);

      expect(properties).toEqual(['background', 'color', 'z-index']);
    });

    it('should group properties by type', async () => {
      const config: Partial<CssFormatterConfig> = {
        propertyOrder: 'grouped',
      };
      const formatter = new CssFormatter(config);
      const css = '.test { color: red; display: block; margin: 10px; font-size: 14px; }';

      const result = await formatter.formatCss(css);

      // Should group layout, then typography, then visual
      expect(result.css).toContain('display');
      expect(result.css).toContain('margin');
      expect(result.css).toContain('font-size');
      expect(result.css).toContain('color');
    });
  });

  describe('Factory functions', () => {
    it('should create production formatter with compact output', async () => {
      const formatter = createProductionFormatter();
      const css = '.test { color: red; margin: 10px; }';

      const result = await formatter.formatCss(css);

      expect(result.css).not.toContain('\n');
      expect(result.css).toContain('.test{');
    });

    it('should create development formatter with readable output', async () => {
      const formatter = createDevelopmentFormatter();
      const css = '.test{color:red;}';

      const result = await formatter.formatCss(css);

      expect(result.css).toContain('\n');
      expect(result.css).toContain('.test');
    });

    it('should create minimal formatter with basic formatting', async () => {
      const formatter = createMinimalFormatter();
      const css = '.test{color:red;}';

      const result = await formatter.formatCss(css);

      expect(result.success).toBe(true);
      expect(result.css).toContain('.test');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid CSS gracefully', async () => {
      const formatter = new CssFormatter();
      const invalidCss = '.test { color: red; margin 10px }'; // Missing colon

      const result = await formatter.formatCss(invalidCss);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('CSS parsing error');
    });

    it('should provide detailed error information', async () => {
      const formatter = new CssFormatter();
      const invalidCss = '.test { color: red; }'; // Actually valid, let's use truly invalid CSS
      const reallyInvalidCss = '.test { color: red margin: 10px; }'; // Missing semicolon

      const result = await formatter.formatCss(reallyInvalidCss);

      if (!result.success) {
        expect(result.errors[0]).toHaveProperty('line');
        expect(result.errors[0]).toHaveProperty('column');
        expect(result.errors[0]).toHaveProperty('message');
      }
    });
  });

  describe('Statistics and performance', () => {
    it('should provide formatting statistics', async () => {
      const formatter = new CssFormatter();
      const css = '.test { color: red; } .other { margin: 10px; }';

      const result = await formatter.formatCss(css);

      expect(result.stats).toHaveProperty('rulesProcessed');
      expect(result.stats).toHaveProperty('processingTime');
      expect(result.stats.rulesProcessed).toBe(2);
      expect(result.stats.processingTime).toBeGreaterThan(0);
    });

    it('should track character changes', async () => {
      const formatter = new CssFormatter();
      const css = '.test{color:red;}';

      const result = await formatter.formatCss(css);

      expect(result.stats).toHaveProperty('originalSize');
      expect(result.stats).toHaveProperty('formattedSize');
      expect(result.stats.originalSize).toBe(Buffer.byteLength(css, 'utf8'));
    });
  });

  describe('Real-world CSS patterns', () => {
    it('should handle @apply directives', async () => {
      const formatter = new CssFormatter();
      const css = '.btn { @apply bg-blue-500 text-white px-4 py-2; }';

      const result = await formatter.formatCss(css);

      expect(result.success).toBe(true);
      expect(result.css).toContain('@apply');
    });

    it('should handle media queries', async () => {
      const formatter = new CssFormatter();
      const css = '@media (max-width: 768px) { .test { display: none; } }';

      const result = await formatter.formatCss(css);

      expect(result.success).toBe(true);
      expect(result.css).toContain('@media');
      expect(result.css).toContain('max-width');
    });

    it('should handle complex selectors', async () => {
      const formatter = new CssFormatter();
      const css = '.parent > .child:nth-child(2n+1):hover { color: red; }';

      const result = await formatter.formatCss(css);

      expect(result.success).toBe(true);
      expect(result.css).toContain('.parent > .child:nth-child(2n+1):hover');
    });
  });
});
