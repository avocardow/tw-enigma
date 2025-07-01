/**
 * SSR/SSG Detector Test Suite
 * 
 * Tests for server-side rendering and static site generation detection
 */

import { describe, test, expect } from '@jest/globals';
import { SSRDetector } from '../../src/detectors/ssrDetector';
import type { DetectionContext } from '../../src/frameworkDetector';

describe('SSRDetector', () => {
  describe('Next.js SSR Detection', () => {
    test('should detect Next.js SSR capabilities', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            next: '^13.0.0',
            react: '^18.0.0',
          },
        },
        configFiles: new Map([
          ['next.config.js', {
            _rawContent: `
              module.exports = {
                experimental: {
                  appDir: true,
                },
              };
            `,
          }],
        ]),
        fileStructure: {
          directories: ['pages', 'app'],
          files: ['next.config.js'],
        },
      };

      const result = SSRDetector.detect(context, 'nextjs');

      expect(result.isSSRCapable).toBe(true);
      expect(result.ssrInfo.hasSSR).toBe(true);
      expect(result.ssrInfo.hasSSG).toBe(true);
      expect(result.ssrInfo.hasISR).toBe(true);
      expect(result.ssrInfo.ssrFramework).toBe('Next.js');
      expect(result.ssrInfo.renderingModes).toContain('hybrid');
    });

    test('should detect Next.js static export configuration', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: { next: '^13.0.0' },
        },
        configFiles: new Map([
          ['next.config.js', {
            _rawContent: `
              module.exports = {
                output: 'export',
                trailingSlash: true,
              };
            `,
          }],
        ]),
      };

      const result = SSRDetector.detect(context, 'nextjs');

      expect(result.ssrInfo.staticExportEnabled).toBe(true);
      expect(result.evidence).toContain('Next.js static export configured');
    });
  });

  describe('Nuxt.js SSR Detection', () => {
    test('should detect Nuxt.js SSR capabilities', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            nuxt: '^3.8.0',
            vue: '^3.3.0',
          },
        },
        configFiles: new Map([
          ['nuxt.config.ts', {
            _rawContent: `
              export default defineNuxtConfig({
                ssr: true,
                nitro: {
                  prerender: {
                    routes: ['/sitemap.xml'],
                  },
                },
              });
            `,
          }],
        ]),
      };

      const result = SSRDetector.detect(context, 'vue');

      expect(result.isSSRCapable).toBe(true);
      expect(result.ssrInfo.hasSSR).toBe(true);
      expect(result.ssrInfo.hasSSG).toBe(true);
      expect(result.ssrInfo.ssrFramework).toBe('Nuxt.js');
    });

    test('should detect disabled SSR in Nuxt.js', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: { nuxt: '^3.8.0' },
        },
        configFiles: new Map([
          ['nuxt.config.js', {
            _rawContent: `
              export default defineNuxtConfig({
                ssr: false,
              });
            `,
          }],
        ]),
      };

      const result = SSRDetector.detect(context, 'vue');

      expect(result.ssrInfo.hasSSR).toBe(false);
      expect(result.evidence).toContain('Nuxt.js SSR disabled in config');
    });
  });

  describe('SvelteKit SSR Detection', () => {
    test('should detect SvelteKit SSR with adapters', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@sveltejs/kit': '^1.20.0',
          },
          devDependencies: {
            '@sveltejs/adapter-node': '^1.3.0',
            '@sveltejs/adapter-static': '^2.0.0',
          },
        },
      };

      const result = SSRDetector.detect(context, 'svelte');

      expect(result.isSSRCapable).toBe(true);
      expect(result.ssrInfo.hasSSR).toBe(true);
      expect(result.ssrInfo.hasSSG).toBe(true);
      expect(result.ssrInfo.ssrFramework).toBe('SvelteKit');
      expect(result.evidence).toContain('SvelteKit static adapter found: @sveltejs/adapter-static');
    });
  });

  describe('Angular Universal SSR Detection', () => {
    test('should detect Angular Universal', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.0.0',
            '@nguniversal/express-engine': '^16.0.0',
          },
        },
        configFiles: new Map([
          ['angular.json', {
            projects: {
              app: {
                architect: {
                  build: { builder: '@angular-devkit/build-angular:browser' },
                  server: { builder: '@angular-devkit/build-angular:server' },
                  prerender: { builder: '@nguniversal/builders:prerender' },
                },
              },
            },
          }],
        ]),
      };

      const result = SSRDetector.detect(context, 'angular');

      expect(result.isSSRCapable).toBe(true);
      expect(result.ssrInfo.hasSSR).toBe(true);
      expect(result.ssrInfo.ssrFramework).toBe('Angular Universal');
      expect(result.ssrInfo.prerenderingEnabled).toBe(true);
    });
  });

  describe('Universal SSR Libraries Detection', () => {
    test('should detect generic SSR libraries', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            express: '^4.18.0',
            'react-dom': '^18.0.0',
          },
        },
      };

      const result = SSRDetector.detect(context);

      expect(result.isSSRCapable).toBe(true);
      expect(result.ssrInfo.hasSSR).toBe(true);
      expect(result.evidence).toContain('SSR library found: express');
    });

    test('should detect static site generators', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            gatsby: '^5.0.0',
          },
          devDependencies: {
            '@11ty/eleventy': '^2.0.0',
          },
        },
      };

      const result = SSRDetector.detect(context);

      expect(result.isSSRCapable).toBe(true);
      expect(result.ssrInfo.hasSSG).toBe(true);
      expect(result.evidence).toContain('SSG framework found: gatsby');
      expect(result.evidence).toContain('SSG framework found: @11ty/eleventy');
    });
  });

  describe('Configuration File Analysis', () => {
    test('should detect SSR patterns in config files', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          ['webpack.config.js', {
            _rawContent: `
              module.exports = {
                target: 'node',
                entry: './server.js',
                output: {
                  path: path.resolve(__dirname, 'dist'),
                  filename: 'server.bundle.js',
                },
              };
            `,
          }],
          ['vite.config.js', {
            _rawContent: `
              export default defineConfig({
                build: {
                  ssr: true,
                },
                ssr: {
                  noExternal: ['some-package'],
                },
              });
            `,
          }],
        ]),
      };

      const result = SSRDetector.detect(context);

      expect(result.isSSRCapable).toBe(true);
      expect(result.evidence).toContain('SSR configuration found in webpack.config.js');
      expect(result.evidence).toContain('SSR configuration found in vite.config.js');
    });
  });

  describe('File Structure Analysis', () => {
    test('should detect SSR file patterns', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        fileStructure: {
          directories: ['server', 'api', 'static'],
          files: ['server.js', 'app.js'],
        },
      };

      const result = SSRDetector.detect(context);

      expect(result.isSSRCapable).toBe(true);
      expect(result.evidence).toContain('Server directory found: server');
      expect(result.evidence).toContain('Server file found: server.js');
    });
  });

  describe('Rendering Mode Classification', () => {
    test('should classify hybrid rendering', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            next: '^13.0.0',
          },
        },
      };

      const result = SSRDetector.detect(context, 'nextjs');

      expect(result.ssrInfo.renderingModes).toContain('hybrid');
      expect(result.ssrInfo.hasSSR).toBe(true);
      expect(result.ssrInfo.hasSSG).toBe(true);
    });

    test('should classify SSG-only projects', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            gatsby: '^5.0.0',
          },
        },
      };

      const result = SSRDetector.detect(context);

      expect(result.ssrInfo.renderingModes).toContain('ssg');
      expect(result.ssrInfo.hasSSG).toBe(true);
      expect(result.ssrInfo.hasSSR).toBe(false);
    });

    test('should classify SPA projects', () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            react: '^18.0.0',
          },
        },
      };

      const result = SSRDetector.detect(context, 'react');

      expect(result.ssrInfo.renderingModes).toContain('spa');
      expect(result.ssrInfo.hasSSR).toBe(false);
      expect(result.ssrInfo.hasSSG).toBe(false);
    });
  });
});