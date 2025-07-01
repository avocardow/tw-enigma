/**
 * End-to-End Framework Integration Test Suite
 * 
 * Tests complete framework detection and configuration workflows
 * including real project scenarios and edge cases
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FrameworkDetector, type DetectionResult, type FrameworkDetectorOptions } from '../../src/frameworkDetector';

describe('Framework Integration Tests', () => {
  let testDir: string;
  let detector: FrameworkDetector;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-enigma-integration-'));
    detector = new FrameworkDetector({
      rootPath: testDir,
      enableCaching: false,
      confidenceThreshold: 0.5,
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Complete Project Detection Workflows', () => {
    test('should detect Next.js with Tailwind and TypeScript', async () => {
      // Create Next.js project structure
      await createProjectStructure({
        'package.json': {
          name: 'nextjs-tailwind-app',
          dependencies: {
            next: '^14.0.0',
            react: '^18.0.0',
            'react-dom': '^18.0.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
            '@types/react': '^18.0.0',
            '@types/node': '^20.0.0',
            tailwindcss: '^3.3.0',
            autoprefixer: '^10.4.0',
            postcss: '^8.4.0',
          },
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
          },
        },
        'next.config.js': `
          /** @type {import('next').NextConfig} */
          const nextConfig = {
            experimental: {
              appDir: true,
            },
          };
          module.exports = nextConfig;
        `,
        'tailwind.config.js': `
          module.exports = {
            content: ['./src/**/*.{js,ts,jsx,tsx}'],
            theme: { extend: {} },
            plugins: [],
          };
        `,
        'postcss.config.js': `
          module.exports = {
            plugins: {
              tailwindcss: {},
              autoprefixer: {},
            },
          };
        `,
        'tsconfig.json': {
          compilerOptions: {
            target: 'es5',
            lib: ['dom', 'dom.iterable', 'es6'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'node',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        'app/layout.tsx': `
          export default function RootLayout({
            children,
          }: {
            children: React.ReactNode;
          }) {
            return (
              <html lang="en">
                <body className="bg-gray-100 text-gray-900">{children}</body>
              </html>
            );
          }
        `,
        'app/page.tsx': `
          export default function HomePage() {
            return (
              <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold text-center mb-8">
                  Welcome to Next.js with Tailwind
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Feature 1</h2>
                    <p className="text-gray-600">Description of feature</p>
                  </div>
                </div>
              </div>
            );
          }
        `,
        'app/globals.css': `
          @tailwind base;
          @tailwind components;
          @tailwind utilities;
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('nextjs');
      expect(result.primary?.confidence).toBeGreaterThan(0.8);
      expect(result.primary?.metadata.hasTypeScript).toBe(true);
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.hasSSG).toBe(true);
      expect(result.primary?.metadata.hasUtilityFirst).toBe(true);
      expect(result.primary?.metadata.primaryStylingLibrary).toBe('tailwindcss');
      expect(result.primary?.metadata.routingMode).toBe('app');
      expect(result.errors).toHaveLength(0);
    });

    test('should detect Vue 3 with Nuxt.js and SCSS', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'nuxt-scss-app',
          dependencies: {
            nuxt: '^3.8.0',
            vue: '^3.3.0',
          },
          devDependencies: {
            sass: '^1.69.0',
            '@nuxt/typescript-build': '^3.0.0',
          },
          scripts: {
            dev: 'nuxt dev',
            build: 'nuxt build',
            start: 'nuxt start',
          },
        },
        'nuxt.config.ts': `
          export default defineNuxtConfig({
            devtools: { enabled: true },
            ssr: true,
            css: ['~/assets/scss/main.scss'],
            modules: ['@nuxtjs/tailwindcss'],
          });
        `,
        'pages/index.vue': `
          <template>
            <div class="container">
              <h1 class="title">Welcome to Nuxt.js</h1>
              <p class="description">
                A Vue.js framework for building SSR applications
              </p>
            </div>
          </template>

          <script setup>
          const title = 'Nuxt App';
          useHead({ title });
          </script>

          <style lang="scss" scoped>
          .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
          }
          
          .title {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            color: #2c3e50;
          }
          
          .description {
            font-size: 1.2rem;
            color: #7f8c8d;
          }
          </style>
        `,
        'assets/scss/main.scss': `
          $primary-color: #42b883;
          $secondary-color: #35495e;
          
          body {
            font-family: 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI';
            background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
            color: white;
            min-height: 100vh;
          }
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('vue');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.ssrFramework).toBe('Nuxt.js');
      expect(result.primary?.metadata.vueVersion).toBe('3.x');
      expect(result.primary?.metadata.stylingLibraries).toContain('sass');
    });

    test('should detect SvelteKit with TypeScript and UnoCSS', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'sveltekit-unocss-app',
          dependencies: {
            '@sveltejs/kit': '^1.20.0',
            svelte: '^4.2.0',
          },
          devDependencies: {
            '@sveltejs/adapter-auto': '^2.1.0',
            '@sveltejs/vite-plugin-svelte': '^2.4.0',
            typescript: '^5.2.0',
            unocss: '^0.57.0',
            '@unocss/svelte-scoped': '^0.57.0',
            vite: '^4.5.0',
          },
          type: 'module',
        },
        'svelte.config.js': `
          import adapter from '@sveltejs/adapter-auto';
          import { vitePreprocess } from '@sveltejs/kit/vite';

          const config = {
            preprocess: vitePreprocess(),
            kit: {
              adapter: adapter(),
            },
          };

          export default config;
        `,
        'vite.config.ts': `
          import { sveltekit } from '@sveltejs/kit/vite';
          import UnoCSS from 'unocss/vite';
          import { defineConfig } from 'vite';

          export default defineConfig({
            plugins: [UnoCSS(), sveltekit()],
          });
        `,
        'uno.config.ts': `
          import { defineConfig } from 'unocss';

          export default defineConfig({
            shortcuts: {
              'btn': 'px-4 py-2 rounded border-none cursor-pointer',
              'btn-primary': 'btn bg-blue-500 text-white hover:bg-blue-600',
            },
          });
        `,
        'src/app.html': `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <link rel="icon" href="%sveltekit.assets%/favicon.png" />
              <meta name="viewport" content="width=device-width" />
              %sveltekit.head%
            </head>
            <body data-sveltekit-preload-data="hover" class="bg-gray-50">
              <div style="display: contents">%sveltekit.body%</div>
            </body>
          </html>
        `,
        'src/routes/+page.svelte': `
          <script lang="ts">
            let count: number = 0;
            
            function increment() {
              count += 1;
            }
          </script>

          <div class="container mx-auto p-8">
            <h1 class="text-4xl font-bold text-center mb-8 text-purple-600">
              Welcome to SvelteKit!
            </h1>
            
            <div class="text-center">
              <button
                class="btn-primary mr-4"
                on:click={increment}
              >
                count is {count}
              </button>
              
              <p class="mt-4 text-gray-600">
                Check out <a 
                  href="https://kit.svelte.dev" 
                  target="_blank" 
                  class="text-purple-500 hover:underline"
                >
                  kit.svelte.dev
                </a> to learn how to build Svelte apps.
              </p>
            </div>
          </div>
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('svelte');
      expect(result.primary?.metadata.svelteKitEnabled).toBe(true);
      expect(result.primary?.metadata.hasTypeScript).toBe(true);
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.hasUtilityFirst).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('unocss');
    });

    test('should detect Angular Universal with Material UI', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'angular-material-app',
          dependencies: {
            '@angular/animations': '^16.2.0',
            '@angular/common': '^16.2.0',
            '@angular/compiler': '^16.2.0',
            '@angular/core': '^16.2.0',
            '@angular/material': '^16.2.0',
            '@angular/cdk': '^16.2.0',
            '@angular/platform-browser': '^16.2.0',
            '@angular/platform-browser-dynamic': '^16.2.0',
            '@angular/router': '^16.2.0',
            '@angular/ssr': '^16.2.0',
            '@nguniversal/express-engine': '^16.2.0',
            rxjs: '^7.8.0',
            'zone.js': '^0.13.0',
          },
          devDependencies: {
            '@angular/cli': '^16.2.0',
            '@angular-devkit/build-angular': '^16.2.0',
            typescript: '^5.1.0',
          },
          scripts: {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
            'build:ssr': 'ng build && ng run app:server',
            'serve:ssr': 'node dist/app/server/main.js',
          },
        },
        'angular.json': {
          version: 1,
          projects: {
            app: {
              projectType: 'application',
              architect: {
                build: {
                  builder: '@angular-devkit/build-angular:browser',
                  options: {
                    outputPath: 'dist/app',
                    index: 'src/index.html',
                    main: 'src/main.ts',
                    polyfills: ['zone.js'],
                    tsConfig: 'tsconfig.app.json',
                  },
                },
                server: {
                  builder: '@angular-devkit/build-angular:server',
                  options: {
                    outputPath: 'dist/app/server',
                    main: 'server.ts',
                    tsConfig: 'tsconfig.server.json',
                  },
                },
                prerender: {
                  builder: '@nguniversal/builders:prerender',
                  options: {
                    routes: ['/'],
                  },
                },
              },
            },
          },
        },
        'src/app/app.component.ts': `
          import { Component } from '@angular/core';

          @Component({
            selector: 'app-root',
            template: \`
              <mat-toolbar color="primary">
                <span>Angular Material App</span>
              </mat-toolbar>
              
              <div class="container">
                <mat-card class="example-card">
                  <mat-card-header>
                    <mat-card-title>Welcome</mat-card-title>
                    <mat-card-subtitle>Angular Universal with Material Design</mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content>
                    <p>This is a server-side rendered Angular application using Material UI components.</p>
                    <mat-form-field appearance="fill">
                      <mat-label>Enter your name</mat-label>
                      <input matInput [(ngModel)]="name">
                    </mat-form-field>
                    <p *ngIf="name">Hello, {{name}}!</p>
                  </mat-card-content>
                  <mat-card-actions>
                    <button mat-raised-button color="primary">Get Started</button>
                  </mat-card-actions>
                </mat-card>
              </div>
            \`,
            styles: [\`
              .container {
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
              }
              .example-card {
                margin: 20px 0;
              }
            \`],
          })
          export class AppComponent {
            name = '';
          }
        `,
        'src/app/app.module.ts': `
          import { NgModule } from '@angular/core';
          import { BrowserModule } from '@angular/platform-browser';
          import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
          import { FormsModule } from '@angular/forms';
          import { MatToolbarModule } from '@angular/material/toolbar';
          import { MatCardModule } from '@angular/material/card';
          import { MatInputModule } from '@angular/material/input';
          import { MatButtonModule } from '@angular/material/button';
          import { MatFormFieldModule } from '@angular/material/form-field';

          import { AppComponent } from './app.component';

          @NgModule({
            declarations: [AppComponent],
            imports: [
              BrowserModule,
              BrowserAnimationsModule,
              FormsModule,
              MatToolbarModule,
              MatCardModule,
              MatInputModule,
              MatButtonModule,
              MatFormFieldModule,
            ],
            providers: [],
            bootstrap: [AppComponent],
          })
          export class AppModule {}
        `,
        'tsconfig.json': {
          compileOnSave: false,
          compilerOptions: {
            baseUrl: './',
            outDir: './dist/out-tsc',
            forceConsistentCasingInFileNames: true,
            strict: true,
            noImplicitOverride: true,
            noPropertyAccessFromIndexSignature: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            sourceMap: true,
            declaration: false,
            downlevelIteration: true,
            experimentalDecorators: true,
            moduleResolution: 'node',
            importHelpers: true,
            target: 'ES2022',
            module: 'ES2022',
            useDefineForClassFields: false,
            lib: ['ES2022', 'dom'],
          },
        },
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('angular');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.ssrFramework).toBe('Angular Universal');
      expect(result.primary?.metadata.hasTypeScript).toBe(true);
      expect(result.primary?.metadata.hasAngularCLI).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('@angular/material');
    });
  });

  describe('Mixed and Hybrid Project Scenarios', () => {
    test('should handle monorepo with multiple frameworks', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'monorepo-workspace',
          private: true,
          workspaces: ['packages/*'],
          devDependencies: {
            lerna: '^7.0.0',
            typescript: '^5.0.0',
          },
        },
        'lerna.json': {
          version: 'independent',
          npmClient: 'npm',
          command: {
            publish: {
              conventionalCommits: true,
            },
          },
        },
        'packages/react-ui/package.json': {
          name: '@monorepo/react-ui',
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            'styled-components': '^5.3.0',
          },
          devDependencies: {
            '@types/react': '^18.0.0',
            typescript: '^5.0.0',
          },
        },
        'packages/react-ui/src/Button.tsx': `
          import styled from 'styled-components';

          const StyledButton = styled.button\`
            background: \${props => props.primary ? '#007bff' : '#6c757d'};
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.25rem;
            cursor: pointer;
          \`;

          export interface ButtonProps {
            primary?: boolean;
            children: React.ReactNode;
            onClick?: () => void;
          }

          export const Button: React.FC<ButtonProps> = ({ children, ...props }) => (
            <StyledButton {...props}>{children}</StyledButton>
          );
        `,
        'packages/vue-app/package.json': {
          name: '@monorepo/vue-app',
          dependencies: {
            vue: '^3.3.0',
            '@monorepo/react-ui': '*',
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^4.0.0',
            vite: '^4.0.0',
          },
        },
        'packages/vue-app/src/App.vue': `
          <template>
            <div class="app">
              <h1>Vue App in Monorepo</h1>
              <p>This Vue app can import React components from the shared UI package.</p>
            </div>
          </template>

          <script setup>
          // This would typically use a Vue wrapper for React components
          </script>

          <style scoped>
          .app {
            padding: 2rem;
            text-align: center;
          }
          </style>
        `,
        'packages/next-docs/package.json': {
          name: '@monorepo/next-docs',
          dependencies: {
            next: '^14.0.0',
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            '@monorepo/react-ui': '*',
          },
          devDependencies: {
            '@types/react': '^18.0.0',
            typescript: '^5.0.0',
          },
          scripts: {
            dev: 'next dev',
            build: 'next build',
          },
        },
        'packages/next-docs/pages/index.tsx': `
          import { Button } from '@monorepo/react-ui';

          export default function DocsHome() {
            return (
              <div style={{ padding: '2rem' }}>
                <h1>Documentation Site</h1>
                <p>Built with Next.js and shared UI components</p>
                <Button primary onClick={() => alert('Hello!')}>
                  Get Started
                </Button>
              </div>
            );
          }
        `,
      });

      const result = await detector.detect();

      // Should detect multiple frameworks but prioritize appropriately
      expect(result.frameworks.length).toBeGreaterThan(1);
      expect(result.conflicts.length).toBeGreaterThan(0);
      
      // Check that all major frameworks are detected
      const detectedTypes = result.frameworks.map(fw => fw.type);
      expect(detectedTypes).toContain('react');
      expect(detectedTypes).toContain('vue');
      expect(detectedTypes).toContain('nextjs');
    });

    test('should handle project with conflicting CSS frameworks', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'multi-css-app',
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            'styled-components': '^5.3.0',
            '@emotion/react': '^11.11.0',
            '@emotion/styled': '^11.11.0',
            '@chakra-ui/react': '^2.8.0',
          },
          devDependencies: {
            tailwindcss: '^3.3.0',
            sass: '^1.69.0',
            autoprefixer: '^10.4.0',
            postcss: '^8.4.0',
          },
        },
        'tailwind.config.js': `
          module.exports = {
            content: ['./src/**/*.{js,jsx,ts,tsx}'],
            theme: { extend: {} },
            plugins: [],
          };
        `,
        'src/styles/main.scss': `
          $primary: #007bff;
          $secondary: #6c757d;
          
          .custom-button {
            background: $primary;
            color: white;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.25rem;
          }
        `,
        'src/App.jsx': `
          import React from 'react';
          import styled from 'styled-components';
          import { css } from '@emotion/react';
          import { ChakraProvider, Button as ChakraButton } from '@chakra-ui/react';
          import './styles/main.scss';

          const StyledButton = styled.button\`
            background: #28a745;
            color: white;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.25rem;
          \`;

          const emotionStyles = css\`
            background: #dc3545;
            color: white;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.25rem;
          \`;

          export default function App() {
            return (
              <ChakraProvider>
                <div className="p-8 bg-gray-100">
                  <h1 className="text-4xl font-bold mb-6">Multi-CSS Framework Demo</h1>
                  
                  <div className="space-y-4">
                    <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                      Tailwind Button
                    </button>
                    
                    <StyledButton>
                      Styled Components Button
                    </StyledButton>
                    
                    <button css={emotionStyles}>
                      Emotion CSS Button
                    </button>
                    
                    <ChakraButton colorScheme="purple">
                      Chakra UI Button
                    </ChakraButton>
                    
                    <button className="custom-button">
                      SCSS Button
                    </button>
                  </div>
                </div>
              </ChakraProvider>
            );
          }
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('react');
      expect(result.primary?.metadata.hasCSSInJS).toBe(true);
      expect(result.primary?.metadata.hasUtilityFirst).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('styled-components');
      expect(result.primary?.metadata.stylingLibraries).toContain('@emotion/react');
      expect(result.primary?.metadata.stylingLibraries).toContain('@chakra-ui/react');
      expect(result.primary?.metadata.stylingLibraries).toContain('tailwindcss');
      expect(result.primary?.metadata.stylingLibraries).toContain('sass');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle corrupted package.json gracefully', async () => {
      await createFile('package.json', '{ "name": "test", "dependencies": { "react": }');

      const result = await detector.detect();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.type === 'invalid_json')).toBe(true);
      expect(result.primary).toBeUndefined();
    });

    test('should handle missing configuration files', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'test-missing-config',
          dependencies: {
            next: '^14.0.0',
            react: '^18.0.0',
          },
        },
        'pages/index.js': `
          export default function Home() {
            return <h1>Hello Next.js!</h1>;
          }
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('nextjs');
      expect(result.primary?.confidence).toBeGreaterThan(0.5);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle permission errors gracefully', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'test-permissions',
          dependencies: { react: '^18.0.0' },
        },
      });

      // Create a file with restrictive permissions (if possible on this platform)
      const restrictedFile = path.join(testDir, 'restricted.json');
      await createFile('restricted.json', '{"test": true}');
      
      try {
        await fs.chmod(restrictedFile, 0o000);
      } catch {
        // Skip this test if we can't change permissions
        return;
      }

      const result = await detector.detect();

      // Should still detect React despite permission issues
      expect(result.primary?.type).toBe('react');
      
      // Restore permissions for cleanup
      try {
        await fs.chmod(restrictedFile, 0o644);
      } catch {
        // Ignore
      }
    });

    test('should handle extremely large projects', async () => {
      // Create a project with many dependencies
      const largeDependencies: Record<string, string> = {};
      for (let i = 0; i < 500; i++) {
        largeDependencies[`fake-package-${i}`] = '^1.0.0';
      }

      await createProjectStructure({
        'package.json': {
          name: 'large-project',
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            ...largeDependencies,
          },
        },
      });

      // Create many source files
      for (let i = 0; i < 50; i++) {
        await createFile(`src/component-${i}.jsx`, `
          import React from 'react';
          export default function Component${i}() {
            return <div>Component ${i}</div>;
          }
        `);
      }

      const startTime = performance.now();
      const result = await detector.detect();
      const endTime = performance.now();

      expect(result.primary?.type).toBe('react');
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.performance.detectionTime).toBeLessThan(10000);
    });

    test('should handle symlinks and special files', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'test-symlinks',
          dependencies: { vue: '^3.3.0' },
        },
        'src/App.vue': `
          <template>
            <div>Hello Vue!</div>
          </template>
        `,
      });

      // Try to create a symlink (if supported on this platform)
      try {
        await fs.symlink(
          path.join(testDir, 'package.json'),
          path.join(testDir, 'package-link.json')
        );
      } catch {
        // Symlinks may not be supported on all systems - continue without
      }

      const result = await detector.detect();

      expect(result.primary?.type).toBe('vue');
      expect(result.errors.length).toBe(0);
    });
  });

  // Helper functions
  async function createProjectStructure(structure: Record<string, any>): Promise<void> {
    for (const [filePath, content] of Object.entries(structure)) {
      if (typeof content === 'object' && !Array.isArray(content)) {
        await createFile(filePath, JSON.stringify(content, null, 2));
      } else {
        await createFile(filePath, String(content));
      }
    }
  }

  async function createFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(testDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }
});