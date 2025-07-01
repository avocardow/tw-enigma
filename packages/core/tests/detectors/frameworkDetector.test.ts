/**
 * Framework Detector Test Suite
 * 
 * Comprehensive tests for framework detection system including:
 * - Individual framework detection
 * - SSR/SSG capability detection
 * - CSS-in-JS library detection
 * - Error handling and edge cases
 * - Mixed and hybrid project scenarios
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FrameworkDetector, type DetectionResult } from '../../src/frameworkDetector';

describe('FrameworkDetector', () => {
  let testDir: string;
  let detector: FrameworkDetector;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-enigma-test-'));
    detector = new FrameworkDetector({
      rootPath: testDir,
      enableCaching: false,
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('React Detection', () => {
    test('should detect React project with high confidence', async () => {
      await createPackageJson({
        name: 'test-react-app',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      });

      await createFile('src/App.jsx', `
        import React from 'react';
        export default function App() {
          return <div className="bg-blue-500">Hello React!</div>;
        }
      `);

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('react');
      expect(result.primary?.confidence).toBeGreaterThan(0.8);
      expect(result.primary?.metadata.hasTypeScript).toBe(false);
    });

    test('should detect React TypeScript project', async () => {
      await createPackageJson({
        name: 'test-react-ts-app',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
        devDependencies: {
          typescript: '^4.9.0',
          '@types/react': '^18.0.0',
        },
      });

      await createFile('src/App.tsx', `
        import React from 'react';
        const App: React.FC = () => {
          return <div className="bg-blue-500">Hello React!</div>;
        };
        export default App;
      `);

      await createFile('tsconfig.json', JSON.stringify({
        compilerOptions: {
          jsx: 'react-jsx',
          strict: true,
        },
      }));

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('react');
      expect(result.primary?.metadata.hasTypeScript).toBe(true);
    });

    test('should detect React with CSS-in-JS libraries', async () => {
      await createPackageJson({
        name: 'test-react-styled',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
          'styled-components': '^5.3.0',
          '@emotion/react': '^11.0.0',
        },
      });

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('react');
      expect(result.primary?.metadata.hasCSSInJS).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('styled-components');
      expect(result.primary?.metadata.stylingLibraries).toContain('@emotion/react');
    });
  });

  describe('Next.js Detection', () => {
    test('should detect Next.js project with SSR capabilities', async () => {
      await createPackageJson({
        name: 'test-nextjs-app',
        dependencies: {
          next: '^13.0.0',
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
      });

      await createFile('next.config.js', `
        /** @type {import('next').NextConfig} */
        const nextConfig = {
          experimental: {
            appDir: true,
          },
        };
        module.exports = nextConfig;
      `);

      await createDirectory('pages');
      await createFile('pages/index.js', `
        export default function Home() {
          return <h1 className="text-4xl">Welcome to Next.js!</h1>;
        }
      `);

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('nextjs');
      expect(result.primary?.confidence).toBeGreaterThan(0.8);
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.hasSSG).toBe(true);
      expect(result.primary?.metadata.hasISR).toBe(true);
      expect(result.primary?.metadata.buildSystem).toBe('Next.js');
    });

    test('should detect Next.js App Router', async () => {
      await createPackageJson({
        name: 'test-nextjs-app-router',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      });

      await createDirectory('app');
      await createFile('app/page.tsx', `
        export default function Page() {
          return <h1>App Router Page</h1>;
        }
      `);

      await createFile('app/layout.tsx', `
        export default function RootLayout({
          children,
        }: {
          children: React.ReactNode;
        }) {
          return (
            <html lang="en">
              <body>{children}</body>
            </html>
          );
        }
      `);

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('nextjs');
      expect(result.primary?.metadata.routingMode).toBe('app');
    });
  });

  describe('Vue.js Detection', () => {
    test('should detect Vue 3 project', async () => {
      await createPackageJson({
        name: 'test-vue-app',
        dependencies: {
          vue: '^3.3.0',
        },
        devDependencies: {
          '@vitejs/plugin-vue': '^4.0.0',
        },
      });

      await createFile('vite.config.js', `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        
        export default defineConfig({
          plugins: [vue()],
        });
      `);

      await createFile('src/App.vue', `
        <template>
          <div class="bg-green-500">
            <h1>{{ message }}</h1>
          </div>
        </template>
        
        <script setup>
        import { ref } from 'vue';
        const message = ref('Hello Vue 3!');
        </script>
      `);

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('vue');
      expect(result.primary?.metadata.vueVersion).toBe('3.x');
      expect(result.primary?.metadata.compositionAPI).toBe(true);
    });

    test('should detect Nuxt.js with SSR', async () => {
      await createPackageJson({
        name: 'test-nuxt-app',
        dependencies: {
          nuxt: '^3.8.0',
          vue: '^3.3.0',
        },
        scripts: {
          dev: 'nuxt dev',
          build: 'nuxt build',
          start: 'nuxt start',
        },
      });

      await createFile('nuxt.config.ts', `
        export default defineNuxtConfig({
          devtools: { enabled: true },
          ssr: true,
        });
      `);

      await createDirectory('pages');
      await createFile('pages/index.vue', `
        <template>
          <div>
            <h1 class="text-4xl">Welcome to Nuxt!</h1>
          </div>
        </template>
      `);

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('vue');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.ssrFramework).toBe('Nuxt.js');
    });
  });

  describe('Svelte Detection', () => {
    test('should detect Svelte project', async () => {
      await createPackageJson({
        name: 'test-svelte-app',
        dependencies: {
          svelte: '^4.0.0',
        },
        devDependencies: {
          '@sveltejs/vite-plugin-svelte': '^2.4.0',
          vite: '^4.4.0',
        },
      });

      await createFile('svelte.config.js', `
        import { vitePreprocess } from '@sveltejs/kit/vite';
        
        const config = {
          preprocess: vitePreprocess(),
        };
        
        export default config;
      `);

      await createFile('src/App.svelte', `
        <script>
          let count = 0;
        </script>
        
        <main>
          <h1 class="text-purple-600">Hello Svelte!</h1>
          <button on:click={() => count++}>Count: {count}</button>
        </main>
      `);

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('svelte');
      expect(result.primary?.confidence).toBeGreaterThan(0.7);
    });

    test('should detect SvelteKit with SSR', async () => {
      await createPackageJson({
        name: 'test-sveltekit-app',
        dependencies: {
          '@sveltejs/kit': '^1.20.0',
          svelte: '^4.0.0',
        },
        devDependencies: {
          '@sveltejs/adapter-auto': '^2.0.0',
        },
      });

      await createFile('svelte.config.js', `
        import adapter from '@sveltejs/adapter-auto';
        
        const config = {
          kit: {
            adapter: adapter(),
          },
        };
        
        export default config;
      `);

      await createDirectory('src/routes');
      await createFile('src/routes/+page.svelte', `
        <h1>Welcome to SvelteKit</h1>
      `);

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('svelte');
      expect(result.primary?.metadata.svelteKitEnabled).toBe(true);
      expect(result.primary?.metadata.hasSSR).toBe(true);
    });
  });

  describe('Angular Detection', () => {
    test('should detect Angular project', async () => {
      await createPackageJson({
        name: 'test-angular-app',
        dependencies: {
          '@angular/core': '^16.0.0',
          '@angular/common': '^16.0.0',
          '@angular/platform-browser': '^16.0.0',
          rxjs: '^7.8.0',
          'zone.js': '^0.13.0',
        },
        devDependencies: {
          '@angular/cli': '^16.0.0',
          typescript: '^4.9.0',
        },
      });

      await createFile('angular.json', JSON.stringify({
        version: 1,
        projects: {
          'test-app': {
            projectType: 'application',
            architect: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
              },
            },
          },
        },
      }));

      await createFile('src/app/app.component.ts', `
        import { Component } from '@angular/core';
        
        @Component({
          selector: 'app-root',
          template: '<h1 class="text-red-500">Hello Angular!</h1>',
        })
        export class AppComponent {
          title = 'test-app';
        }
      `);

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('angular');
      expect(result.primary?.metadata.hasTypeScript).toBe(true);
      expect(result.primary?.metadata.hasAngularCLI).toBe(true);
    });

    test('should detect Angular Universal SSR', async () => {
      await createPackageJson({
        name: 'test-angular-ssr',
        dependencies: {
          '@angular/core': '^16.0.0',
          '@angular/ssr': '^16.0.0',
          '@nguniversal/express-engine': '^16.0.0',
        },
      });

      await createFile('angular.json', JSON.stringify({
        version: 1,
        projects: {
          'test-app': {
            architect: {
              build: {
                builder: '@angular-devkit/build-angular:browser',
              },
              server: {
                builder: '@angular-devkit/build-angular:server',
              },
            },
          },
        },
      }));

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('angular');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.ssrFramework).toBe('Angular Universal');
    });
  });

  describe('CSS-in-JS Detection', () => {
    test('should detect Tailwind CSS', async () => {
      await createPackageJson({
        name: 'test-tailwind',
        dependencies: {
          react: '^18.0.0',
        },
        devDependencies: {
          tailwindcss: '^3.3.0',
          autoprefixer: '^10.4.0',
          postcss: '^8.4.0',
        },
      });

      await createFile('tailwind.config.js', `
        module.exports = {
          content: ['./src/**/*.{js,jsx,ts,tsx}'],
          theme: {
            extend: {},
          },
          plugins: [],
        };
      `);

      await createFile('postcss.config.js', `
        module.exports = {
          plugins: {
            tailwindcss: {},
            autoprefixer: {},
          },
        };
      `);

      const result = await detector.detect();
      
      expect(result.primary?.metadata.hasUtilityFirst).toBe(true);
      expect(result.primary?.metadata.primaryStylingLibrary).toBe('tailwindcss');
    });

    test('should detect multiple CSS-in-JS libraries', async () => {
      await createPackageJson({
        name: 'test-multiple-css',
        dependencies: {
          react: '^18.0.0',
          'styled-components': '^5.3.0',
          '@emotion/react': '^11.0.0',
          '@chakra-ui/react': '^2.8.0',
        },
      });

      const result = await detector.detect();
      
      expect(result.primary?.metadata.hasCSSInJS).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('styled-components');
      expect(result.primary?.metadata.stylingLibraries).toContain('@emotion/react');
      expect(result.primary?.metadata.stylingLibraries).toContain('@chakra-ui/react');
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted package.json gracefully', async () => {
      await createFile('package.json', '{ "name": "test", "dependencies": { broken json');

      const result = await detector.detect();
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.type === 'invalid_json')).toBe(true);
      expect(result.primary).toBeUndefined();
    });

    test('should handle missing files gracefully', async () => {
      // Create empty directory
      const result = await detector.detect();
      
      expect(result.primary).toBeUndefined();
      expect(result.frameworks).toHaveLength(0);
      expect(result.overallConfidence).toBe(0);
    });

    test('should resolve framework conflicts correctly', async () => {
      await createPackageJson({
        name: 'test-conflict',
        dependencies: {
          next: '^13.0.0',
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      });

      await createDirectory('pages');

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('nextjs');
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].frameworks).toContain('Next.js');
      expect(result.conflicts[0].frameworks).toContain('React');
    });
  });

  describe('Mixed Projects', () => {
    test('should handle monorepo with multiple frameworks', async () => {
      await createPackageJson({
        name: 'monorepo-root',
        workspaces: ['packages/*'],
      });

      // React package
      await createDirectory('packages/react-app');
      await createFile('packages/react-app/package.json', JSON.stringify({
        name: 'react-app',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      }));

      // Vue package
      await createDirectory('packages/vue-app');
      await createFile('packages/vue-app/package.json', JSON.stringify({
        name: 'vue-app',
        dependencies: {
          vue: '^3.3.0',
        },
      }));

      const result = await detector.detect();
      
      // Should detect the primary framework with highest confidence
      expect(result.frameworks.length).toBeGreaterThan(0);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very large package.json', async () => {
      const largeDeps: Record<string, string> = {};
      // Create 1000 fake dependencies
      for (let i = 0; i < 1000; i++) {
        largeDeps[`fake-package-${i}`] = '^1.0.0';
      }

      await createPackageJson({
        name: 'large-project',
        dependencies: {
          react: '^18.0.0',
          ...largeDeps,
        },
      });

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('react');
      expect(result.performance.detectionTime).toBeLessThan(10000); // Should complete within 10s
    });

    test('should handle symbolic links and special files', async () => {
      await createPackageJson({
        name: 'test-symlinks',
        dependencies: {
          react: '^18.0.0',
        },
      });

      // Create a symlink (if supported)
      try {
        await fs.symlink('package.json', path.join(testDir, 'link-to-package.json'));
      } catch {
        // Symlinks may not be supported on all systems
      }

      const result = await detector.detect();
      
      expect(result.primary?.type).toBe('react');
      expect(result.errors.length).toBe(0);
    });
  });

  // Helper functions
  async function createPackageJson(content: any): Promise<void> {
    await createFile('package.json', JSON.stringify(content, null, 2));
  }

  async function createFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(testDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async function createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(path.join(testDir, dirPath), { recursive: true });
  }
});