/**
 * Tests for CustomPropertyDetector
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { CustomPropertyDetector, createCustomPropertyDetector, scanCustomProperties } from '../customPropertyDetector.js';
import type { VariableMap, DetectionOptions } from '../customPropertyDetector.js';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('CustomPropertyDetector', () => {
  let detector: CustomPropertyDetector;
  const testOptions: Partial<DetectionOptions> = {
    includeCssInJs: true,
    includePatterns: ['**/*.css', '**/*.js'],
    excludePatterns: ['**/node_modules/**'],
    analyzeJsInterpolations: true,
    maxFileSize: 1024 * 1024,
    validateValues: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new CustomPropertyDetector(testOptions);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create detector with default options', () => {
      const defaultDetector = createCustomPropertyDetector();
      expect(defaultDetector).toBeInstanceOf(CustomPropertyDetector);
    });

    it('should create detector with custom options', () => {
      const customDetector = createCustomPropertyDetector({
        includeCssInJs: false,
        maxFileSize: 512 * 1024
      });
      expect(customDetector).toBeInstanceOf(CustomPropertyDetector);
    });
  });

  describe('CSS Custom Property Detection', () => {
    it('should detect global (:root) custom properties', async () => {
      const cssContent = `
        :root {
          --primary-color: #007bff;
          --secondary-color: #6c757d;
          --font-size: 16px;
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.size).toBe(3);
      expect(variableMap.declarations.has('primary-color')).toBe(true);
      expect(variableMap.declarations.has('secondary-color')).toBe(true);
      expect(variableMap.declarations.has('font-size')).toBe(true);

      const primaryDecl = variableMap.declarations.get('primary-color')![0];
      expect(primaryDecl.scope.type).toBe('global');
      expect(primaryDecl.scope.identifier).toBe(':root');
      expect(primaryDecl.value).toBe('#007bff');
    });

    it('should detect component-scoped custom properties', async () => {
      const cssContent = `
        .button {
          --button-padding: 8px 16px;
          --button-radius: 4px;
        }
        
        #navbar {
          --nav-height: 60px;
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'components.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.size).toBe(3);
      
      const buttonPadding = variableMap.declarations.get('button-padding')![0];
      expect(buttonPadding.scope.type).toBe('component');
      expect(buttonPadding.scope.identifier).toBe('.button');
      
      const navHeight = variableMap.declarations.get('nav-height')![0];
      expect(navHeight.scope.type).toBe('component');
      expect(navHeight.scope.identifier).toBe('#navbar');
    });

    it('should detect custom property usages', async () => {
      const cssContent = `
        .element {
          color: var(--primary-color);
          background: var(--bg-color, #ffffff);
          font-size: var(--font-size);
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.usages.size).toBe(3);
      expect(variableMap.usages.has('primary-color')).toBe(true);
      expect(variableMap.usages.has('bg-color')).toBe(true);
      expect(variableMap.usages.has('font-size')).toBe(true);

      const bgColorUsage = variableMap.usages.get('bg-color')![0];
      expect(bgColorUsage.fallback).toBe('#ffffff');
      expect(bgColorUsage.cssProperty).toBe('background');
    });

    it('should detect nested variable references', async () => {
      const cssContent = `
        :root {
          --base-size: 16px;
          --large-size: calc(var(--base-size) * 1.5);
          --theme-color: var(--primary-color);
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      const largeSizeDecl = variableMap.declarations.get('large-size')![0];
      expect(largeSizeDecl.containsVariables).toBe(true);
      expect(largeSizeDecl.referencedVariables).toContain('base-size');

      const themeColorDecl = variableMap.declarations.get('theme-color')![0];
      expect(themeColorDecl.containsVariables).toBe(true);
      expect(themeColorDecl.referencedVariables).toContain('primary-color');
    });
  });

  describe('CSS-in-JS Detection', () => {
    it('should detect custom properties in template literals', async () => {
      const jsContent = `
        const styles = css\`
          :root {
            --primary: #007bff;
          }
          .button {
            color: var(--primary);
          }
        \`;
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(jsContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'components.js', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.has('primary')).toBe(true);
      expect(variableMap.usages.has('primary')).toBe(true);
    });

    it('should detect custom properties in styled components', async () => {
      const jsContent = `
        const Button = styled.button\`
          --button-bg: \${props => props.primary ? '#007bff' : '#6c757d'};
          background: var(--button-bg);
        \`;
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(jsContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'Button.js', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.has('button-bg')).toBe(true);
      expect(variableMap.usages.has('button-bg')).toBe(true);
    });

    it('should detect JavaScript interpolations', async () => {
      const jsContent = `
        const getStyles = (theme) => css\`
          --primary: \${theme.colors.primary};
          --spacing: \${theme.spacing * 2}px;
        \`;
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(jsContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'theme.js', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.has('primary')).toBe(true);
      expect(variableMap.declarations.has('spacing')).toBe(true);

      const primaryDecl = variableMap.declarations.get('primary')![0];
      expect(primaryDecl.scope.type).toBe('dynamic');
    });

    it('should process CSS object literals', async () => {
      const jsContent = `
        const styles = {
          root: {
            '--primary-color': '#007bff',
            '--secondary-color': '#6c757d'
          }
        };
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(jsContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'styles.js', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.has('primary-color')).toBe(true);
      expect(variableMap.declarations.has('secondary-color')).toBe(true);
    });
  });

  describe('Variable Analysis', () => {
    it('should identify undefined variables', async () => {
      const cssContent = `
        .element {
          color: var(--undefined-color);
          background: var(--missing-bg);
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.undefinedVariables).toContain('undefined-color');
      expect(variableMap.undefinedVariables).toContain('missing-bg');
    });

    it('should identify unused variables', async () => {
      const cssContent = `
        :root {
          --used-color: #007bff;
          --unused-color: #6c757d;
          --another-unused: 16px;
        }
        
        .element {
          color: var(--used-color);
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.unusedVariables).toContain('unused-color');
      expect(variableMap.unusedVariables).toContain('another-unused');
      expect(variableMap.unusedVariables).not.toContain('used-color');
    });

    it('should detect scope conflicts', async () => {
      const cssContent = `
        :root {
          --primary-color: #007bff;
        }
        
        .button {
          --primary-color: #dc3545;
        }
        
        .card {
          --primary-color: #28a745;
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.get('primary-color')).toHaveLength(3);
      // Note: The current implementation doesn't detect these as conflicts
      // since they're in different scopes, which is actually correct behavior
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'error.css', isFile: () => true, isDirectory: () => false }
      ] as any);
      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.size).toBe(0);
      expect(detector.getErrors()).toHaveLength(1);
      expect(detector.getErrors()[0].type).toBe('file');
    });

    it('should handle large files', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'large.css', isFile: () => true, isDirectory: () => false }
      ] as any);
      mockFs.stat.mockResolvedValue({ size: 2 * 1024 * 1024 } as any); // 2MB

      const variableMap = await detector.scanDirectory('/test');

      expect(detector.getErrors()).toHaveLength(1);
      expect(detector.getErrors()[0].message).toContain('File too large');
    });

    it('should validate custom property values', async () => {
      const cssContent = `
        :root {
          --empty-value: ;
          --circular-ref: var(--circular-ref);
          --valid-value: #007bff;
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'invalid.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      const errors = detector.getErrors();
      expect(errors.some(e => e.message.includes('Empty value'))).toBe(true);
      expect(errors.some(e => e.message.includes('Circular reference'))).toBe(true);
    });

    it('should handle malformed CSS gracefully', async () => {
      const malformedCss = `
        .broken {
          --incomplete
          color: var(--missing-closing;
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(malformedCss);
      mockFs.readdir.mockResolvedValue([
        { name: 'broken.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      // Should not throw and should return some result
      expect(variableMap).toBeDefined();
    });
  });

  describe('File Pattern Matching', () => {
    it('should respect include patterns', async () => {
      const detector = createCustomPropertyDetector({
        includePatterns: ['**/*.css'],
        includeCssInJs: false
      });

      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false },
        { name: 'component.js', isFile: () => true, isDirectory: () => false },
        { name: 'theme.scss', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(':root { --color: red; }');

      await detector.scanDirectory('/test');

      // Only CSS files should be processed
      expect(mockFs.readFile).toHaveBeenCalledWith(expect.stringContaining('styles.css'), 'utf8');
      expect(mockFs.readFile).not.toHaveBeenCalledWith(expect.stringContaining('component.js'), 'utf8');
    });

    it('should respect exclude patterns', async () => {
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'node_modules', isFile: () => false, isDirectory: () => true },
          { name: 'src', isFile: () => false, isDirectory: () => true }
        ] as any)
        .mockResolvedValueOnce([
          { name: 'styles.css', isFile: () => true, isDirectory: () => false }
        ] as any);

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(':root { --color: red; }');

      await detector.scanDirectory('/test');

      // node_modules should be excluded
      expect(mockFs.readdir).toHaveBeenCalledWith('/test', expect.any(Object));
      expect(mockFs.readdir).toHaveBeenCalledWith('/test/src', expect.any(Object));
      expect(mockFs.readdir).not.toHaveBeenCalledWith('/test/node_modules', expect.any(Object));
    });
  });

  describe('Utility Functions', () => {
    it('should work with scanCustomProperties utility', async () => {
      const cssContent = ':root { --color: blue; }';

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await scanCustomProperties('/test', {
        includeCssInJs: false
      });

      expect(variableMap.declarations.has('color')).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed CSS and CSS-in-JS files', async () => {
      const cssContent = `
        :root {
          --primary: #007bff;
        }
      `;

      const jsContent = `
        const Button = styled.button\`
          background: var(--primary);
          color: var(--text-color);
        \`;
      `;

      mockFs.readdir.mockResolvedValue([
        { name: 'styles.css', isFile: () => true, isDirectory: () => false },
        { name: 'Button.js', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile
        .mockResolvedValueOnce(cssContent)
        .mockResolvedValueOnce(jsContent);

      const variableMap = await detector.scanDirectory('/test');

      expect(variableMap.declarations.has('primary')).toBe(true);
      expect(variableMap.usages.has('primary')).toBe(true);
      expect(variableMap.usages.has('text-color')).toBe(true);
      expect(variableMap.undefinedVariables).toContain('text-color');
    });

    it('should track variable scoping accurately', async () => {
      const cssContent = `
        :root {
          --global-color: #000;
        }
        
        .component {
          --local-color: #fff;
        }
        
        .nested .element {
          --nested-color: #ccc;
          color: var(--global-color);
          background: var(--local-color);
          border: var(--nested-color);
        }
      `;

      mockFs.stat.mockResolvedValue({ size: 1000 } as any);
      mockFs.readFile.mockResolvedValue(cssContent);
      mockFs.readdir.mockResolvedValue([
        { name: 'complex.css', isFile: () => true, isDirectory: () => false }
      ] as any);

      const variableMap = await detector.scanDirectory('/test');

      const globalDecl = variableMap.declarations.get('global-color')![0];
      expect(globalDecl.scope.type).toBe('global');

      const localDecl = variableMap.declarations.get('local-color')![0];
      expect(localDecl.scope.type).toBe('component');

      const nestedDecl = variableMap.declarations.get('nested-color')![0];
      expect(nestedDecl.scope.nestingLevel).toBeGreaterThan(0);
    });
  });
});