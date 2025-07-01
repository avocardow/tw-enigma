/**
 * CSS-in-JS Detector Test Suite
 * 
 * Tests for CSS-in-JS library and styling approach detection
 */

import { describe, test, expect } from '@jest/globals';
import { CSSInJSDetector } from '../../src/detectors/cssInJsDetector';
import type { DetectionContext } from '../../src/frameworkDetector';

describe('CSSInJSDetector', () => {
  describe('Styled Components Detection', () => {
    test('should detect styled-components', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            react: '^18.0.0',
            'styled-components': '^5.3.0',
          },
          devDependencies: {
            'babel-plugin-styled-components': '^2.1.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context, 'react');

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.hasStyledComponents).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.name === 'styled-components')).toBe(true);
      expect(result.cssInfo.stylingApproach).toContain('css-in-js');
      expect(result.evidence).toContain('styled-components dependency found');
    });

    test('should detect Emotion', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@emotion/react': '^11.11.0',
            '@emotion/styled': '^11.11.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context, 'react');

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.hasStyledComponents).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.name === '@emotion/react')).toBe(true);
      expect(result.evidence).toContain('@emotion/react dependency found');
    });
  });

  describe('Component Library Detection', () => {
    test('should detect Chakra UI', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@chakra-ui/react': '^2.8.0',
            '@chakra-ui/theme': '^3.3.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context, 'react');

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.hasThemeProvider).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'chakra-ui')).toBe(true);
      expect(result.cssInfo.stylingApproach).toContain('component-library');
    });

    test('should detect Material-UI', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@mui/material': '^5.14.0',
            '@mui/system': '^5.14.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context, 'react');

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'material-ui')).toBe(true);
      expect(result.evidence).toContain('@mui/material dependency found');
    });

    test('should detect Mantine', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@mantine/core': '^7.0.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context, 'react');

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'mantine')).toBe(true);
    });
  });

  describe('Utility-First CSS Detection', () => {
    test('should detect Tailwind CSS', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          devDependencies: {
            tailwindcss: '^3.3.0',
            autoprefixer: '^10.4.0',
            postcss: '^8.4.0',
          },
        },
        configFiles: new Map([
          ['tailwind.config.js', {
            _rawContent: `
              module.exports = {
                content: ['./src/**/*.{js,jsx,ts,tsx}'],
                theme: {
                  extend: {},
                },
                plugins: [],
              };
            `,
          }],
          ['postcss.config.js', {
            _rawContent: `
              module.exports = {
                plugins: {
                  tailwindcss: {},
                  autoprefixer: {},
                },
              };
            `,
          }],
        ]),
        fileStructure: {
          directories: [],
          files: ['tailwind.config.js', 'postcss.config.js'],
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.hasUtilityFirst).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'tailwind')).toBe(true);
      expect(result.cssInfo.stylingApproach).toContain('utility-first');
      expect(result.cssInfo.primaryLibrary).toBe('tailwindcss');
      expect(result.evidence).toContain('Tailwind CSS configuration found');
    });

    test('should detect UnoCSS', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          devDependencies: {
            unocss: '^0.56.0',
          },
        },
        configFiles: new Map([
          ['uno.config.ts', {
            _rawContent: `
              import { defineConfig } from 'unocss';
              
              export default defineConfig({
                shortcuts: {
                  'btn': 'px-4 py-2 rounded',
                },
              });
            `,
          }],
        ]),
        fileStructure: {
          directories: [],
          files: ['uno.config.ts'],
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.hasUtilityFirst).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'unocss')).toBe(true);
      expect(result.evidence).toContain('UnoCSS configuration found');
    });

    test('should detect WindiCSS', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          devDependencies: {
            windicss: '^3.5.0',
          },
        },
        fileStructure: {
          directories: [],
          files: ['windi.config.js'],
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.hasUtilityFirst).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'windicss')).toBe(true);
    });
  });

  describe('Zero-Runtime CSS-in-JS Detection', () => {
    test('should detect Vanilla Extract', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          devDependencies: {
            '@vanilla-extract/css': '^1.14.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'vanilla-extract')).toBe(true);
      expect(result.cssInfo.stylingApproach).toContain('zero-runtime');
    });

    test('should detect Linaria', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          devDependencies: {
            linaria: '^4.2.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'linaria')).toBe(true);
      expect(result.cssInfo.stylingApproach).toContain('zero-runtime');
    });

    test('should detect Stitches', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@stitches/react': '^1.2.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'stitches')).toBe(true);
      expect(result.cssInfo.stylingApproach).toContain('zero-runtime');
    });
  });

  describe('CSS Preprocessors Detection', () => {
    test('should detect Sass/SCSS', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          devDependencies: {
            sass: '^1.66.0',
          },
        },
        fileStructure: {
          directories: ['scss', 'styles'],
          files: [],
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'sass')).toBe(true);
      expect(result.cssInfo.stylingApproach).toContain('preprocessor');
    });

    test('should detect Less', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          devDependencies: {
            less: '^4.2.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'less')).toBe(true);
    });

    test('should detect Stylus', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          devDependencies: {
            stylus: '^0.60.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.some(lib => lib.type === 'stylus')).toBe(true);
    });
  });

  describe('Framework-Specific CSS Detection', () => {
    test('should detect Vue-specific styling libraries', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            vue: '^3.3.0',
            vuetify: '^3.3.0',
            quasar: '^2.12.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context, 'vue');

      expect(result.evidence).toContain('Vuetify detected for Vue');
      expect(result.evidence).toContain('Quasar detected for Vue');
    });

    test('should detect React-specific styling libraries', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            react: '^18.0.0',
            '@mui/material': '^5.14.0',
            '@chakra-ui/react': '^2.8.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context, 'react');

      expect(result.evidence).toContain('Material-UI detected for React');
      expect(result.evidence).toContain('Chakra UI detected for React');
    });
  });

  describe('Multiple Libraries Detection', () => {
    test('should handle multiple CSS libraries and classify as hybrid', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            'styled-components': '^5.3.0',
            '@emotion/react': '^11.11.0',
          },
          devDependencies: {
            tailwindcss: '^3.3.0',
            sass: '^1.66.0',
          },
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(true);
      expect(result.cssInfo.libraries.length).toBeGreaterThan(3);
      expect(result.cssInfo.stylingApproach).toContain('hybrid');
      expect(result.cssInfo.hasStyledComponents).toBe(true);
      expect(result.cssInfo.hasUtilityFirst).toBe(true);
    });

    test('should prioritize libraries by confidence for primary selection', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@chakra-ui/react': '^2.8.0', // Higher confidence (0.5)
          },
          devDependencies: {
            postcss: '^8.4.0', // Lower confidence (0.1)
            sass: '^1.66.0', // Lower confidence (0.2)
          },
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.cssInfo.primaryLibrary).toBe('@chakra-ui/react');
    });
  });

  describe('Theme Provider Detection', () => {
    test('should detect theme providers', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@chakra-ui/theme': '^3.3.0',
            '@mui/system': '^5.14.0',
            'styled-theming': '^2.2.0',
          },
        },
        fileStructure: {
          directories: ['theme', 'design-system'],
          files: [],
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.cssInfo.hasThemeProvider).toBe(true);
      expect(result.evidence).toContain('Theme provider found: @chakra-ui/theme');
      expect(result.evidence).toContain('theme directory found');
      expect(result.evidence).toContain('design-system directory found');
    });
  });

  describe('Configuration Analysis', () => {
    test('should detect CSS-in-JS configurations in build files', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          ['webpack.config.js', {
            _rawContent: `
              module.exports = {
                module: {
                  rules: [
                    {
                      test: /\\.css$/,
                      use: ['style-loader', 'css-loader'],
                    },
                  ],
                },
                plugins: [
                  new StyledComponentsPlugin(),
                ],
              };
            `,
          }],
          ['babel.config.js', {
            _rawContent: `
              module.exports = {
                plugins: [
                  ['styled-components', { ssr: true }],
                ],
              };
            `,
          }],
        ]),
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.evidence).toContain('Styled Components configuration found in webpack.config.js');
      expect(result.evidence).toContain('Styled Components configuration found in babel.config.js');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty or minimal projects', () => {
      const context: DetectionContext = {
        rootPath: '/test',
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.hasCSSInJS).toBe(false);
      expect(result.cssInfo.libraries).toHaveLength(0);
      expect(result.cssInfo.stylingApproach).toContain('traditional');
    });

    test('should handle projects with only traditional CSS', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        fileStructure: {
          directories: ['css', 'styles'],
          files: ['styles.css', 'main.css'],
        },
      };

      const result = CSSInJSDetector.detect(context);

      expect(result.cssInfo.stylingApproach).toContain('traditional');
      expect(result.evidence).toContain('css directory found');
      expect(result.evidence).toContain('styles directory found');
    });
  });
});