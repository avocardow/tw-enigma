/**
 * SSR Compatibility Integration Test Suite
 * 
 * Tests server-side rendering detection and compatibility across frameworks
 * with various CSS-in-JS and styling solutions
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FrameworkDetector } from '../../src/frameworkDetector';
import { SSRDetector } from '../../src/detectors/ssrDetector';
import { CSSInJSDetector } from '../../src/detectors/cssInJsDetector';

describe('SSR Compatibility Tests', () => {
  let testDir: string;
  let detector: FrameworkDetector;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-enigma-ssr-test-'));
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

  describe('Next.js SSR Scenarios', () => {
    test('should detect Next.js App Router with SSR and styled-components', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'nextjs-ssr-styled',
          dependencies: {
            next: '^14.0.0',
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            'styled-components': '^6.0.0',
          },
          devDependencies: {
            '@types/styled-components': '^5.1.0',
            typescript: '^5.0.0',
          },
        },
        'next.config.js': `
          /** @type {import('next').NextConfig} */
          const nextConfig = {
            experimental: {
              appDir: true,
            },
            compiler: {
              styledComponents: true,
            },
          };
          module.exports = nextConfig;
        `,
        '.babelrc': {
          presets: ['next/babel'],
          plugins: [['styled-components', { ssr: true }]],
        },
        'app/layout.tsx': `
          'use client';
          import StyledComponentsRegistry from './registry';

          export default function RootLayout({
            children,
          }: {
            children: React.ReactNode;
          }) {
            return (
              <html lang="en">
                <body>
                  <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
                </body>
              </html>
            );
          }
        `,
        'app/registry.tsx': `
          'use client';
          import React, { useState } from 'react';
          import { useServerInsertedHTML } from 'next/navigation';
          import { ServerStyleSheet, StyleSheetManager } from 'styled-components';

          export default function StyledComponentsRegistry({
            children,
          }: {
            children: React.ReactNode;
          }) {
            const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet());

            useServerInsertedHTML(() => {
              const styles = styledComponentsStyleSheet.getStyleElement();
              styledComponentsStyleSheet.instance.clearTag();
              return <>{styles}</>;
            });

            if (typeof window !== 'undefined') return <>{children}</>;

            return (
              <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
                {children}
              </StyleSheetManager>
            );
          }
        `,
        'app/page.tsx': `
          import styled from 'styled-components';

          const Container = styled.div\`
            padding: 2rem;
            text-align: center;
            background: linear-gradient(45deg, #007bff, #6610f2);
            color: white;
          \`;

          const Title = styled.h1\`
            font-size: 3rem;
            margin-bottom: 1rem;
          \`;

          export default function HomePage() {
            return (
              <Container>
                <Title>Next.js SSR with Styled Components</Title>
                <p>This page is server-side rendered with CSS-in-JS styles!</p>
              </Container>
            );
          }
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('nextjs');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.hasSSG).toBe(true);
      expect(result.primary?.metadata.hasISR).toBe(true);
      expect(result.primary?.metadata.hasCSSInJS).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('styled-components');
      expect(result.primary?.metadata.routingMode).toBe('app');
    });

    test('should detect Next.js Pages Router with getServerSideProps and Emotion', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'nextjs-pages-emotion',
          dependencies: {
            next: '^13.5.0',
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            '@emotion/react': '^11.11.0',
            '@emotion/server': '^11.11.0',
            '@emotion/styled': '^11.11.0',
          },
        },
        'next.config.js': `
          /** @type {import('next').NextConfig} */
          const nextConfig = {
            experimental: {
              emotion: true,
            },
          };
          module.exports = nextConfig;
        `,
        'pages/_document.tsx': `
          import Document, { Html, Head, Main, NextScript } from 'next/document';
          import { extractCritical } from '@emotion/server';

          export default class MyDocument extends Document {
            static async getInitialProps(ctx: any) {
              const initialProps = await Document.getInitialProps(ctx);
              const critical = extractCritical(initialProps.html);
              initialProps.html = critical.html;
              initialProps.styles = (
                <>
                  {initialProps.styles}
                  <style
                    data-emotion-css={critical.ids.join(' ')}
                    dangerouslySetInnerHTML={{ __html: critical.css }}
                  />
                </>
              );

              return initialProps;
            }

            render() {
              return (
                <Html>
                  <Head />
                  <body>
                    <Main />
                    <NextScript />
                  </body>
                </Html>
              );
            }
          }
        `,
        'pages/index.tsx': `
          import { GetServerSideProps } from 'next';
          import styled from '@emotion/styled';
          import { css } from '@emotion/react';

          const Container = styled.div\`
            padding: 2rem;
            background: #f8f9fa;
            min-height: 100vh;
          \`;

          const titleStyles = css\`
            color: #495057;
            text-align: center;
            margin-bottom: 2rem;
          \`;

          interface Props {
            timestamp: string;
          }

          export default function HomePage({ timestamp }: Props) {
            return (
              <Container>
                <h1 css={titleStyles}>Server-Side Rendered Page</h1>
                <p>This page was rendered on the server at: {timestamp}</p>
              </Container>
            );
          }

          export const getServerSideProps: GetServerSideProps = async () => {
            return {
              props: {
                timestamp: new Date().toISOString(),
              },
            };
          };
        `,
        'pages/static.tsx': `
          import { GetStaticProps } from 'next';
          import styled from '@emotion/styled';

          const StaticContainer = styled.div\`
            padding: 2rem;
            background: #e9ecef;
          \`;

          interface Props {
            buildTime: string;
          }

          export default function StaticPage({ buildTime }: Props) {
            return (
              <StaticContainer>
                <h1>Static Generation with ISR</h1>
                <p>Built at: {buildTime}</p>
              </StaticContainer>
            );
          }

          export const getStaticProps: GetStaticProps = async () => {
            return {
              props: {
                buildTime: new Date().toISOString(),
              },
              revalidate: 60, // ISR: revalidate every 60 seconds
            };
          };
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('nextjs');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.hasSSG).toBe(true);
      expect(result.primary?.metadata.hasISR).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('@emotion/react');
      expect(result.primary?.metadata.routingMode).toBe('pages');
    });
  });

  describe('Nuxt.js SSR Scenarios', () => {
    test('should detect Nuxt.js 3 with SSR and TailwindCSS', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'nuxt3-ssr-tailwind',
          dependencies: {
            nuxt: '^3.8.0',
            vue: '^3.3.0',
          },
          devDependencies: {
            '@nuxtjs/tailwindcss': '^6.8.0',
            tailwindcss: '^3.3.0',
          },
        },
        'nuxt.config.ts': `
          export default defineNuxtConfig({
            devtools: { enabled: true },
            ssr: true,
            modules: ['@nuxtjs/tailwindcss'],
            nitro: {
              prerender: {
                routes: ['/sitemap.xml', '/robots.txt'],
              },
            },
            app: {
              head: {
                title: 'Nuxt SSR with Tailwind',
                meta: [
                  { name: 'description', content: 'SSR Vue app with TailwindCSS' },
                ],
              },
            },
          });
        `,
        'tailwind.config.js': `
          module.exports = {
            content: [
              './components/**/*.{js,vue,ts}',
              './layouts/**/*.vue',
              './pages/**/*.vue',
              './plugins/**/*.{js,ts}',
              './nuxt.config.{js,ts}',
              './app.vue',
            ],
            theme: {
              extend: {},
            },
            plugins: [],
          };
        `,
        'app.vue': `
          <template>
            <div>
              <NuxtPage />
            </div>
          </template>
        `,
        'pages/index.vue': `
          <template>
            <div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
              <div class="container mx-auto px-4 py-16">
                <h1 class="text-5xl font-bold text-white text-center mb-8">
                  Nuxt.js SSR with Tailwind
                </h1>
                <div class="bg-white rounded-lg shadow-xl p-8 max-w-2xl mx-auto">
                  <p class="text-gray-700 text-lg mb-4">
                    This page is server-side rendered with Nuxt.js 3 and styled with TailwindCSS.
                  </p>
                  <p class="text-sm text-gray-500">
                    Server time: {{ serverTime }}
                  </p>
                </div>
              </div>
            </div>
          </template>

          <script setup>
          const { data: serverTime } = await $fetch('/api/time');

          useHead({
            title: 'SSR Home Page',
          });
          </script>
        `,
        'server/api/time.get.ts': `
          export default defineEventHandler(() => {
            return {
              serverTime: new Date().toISOString(),
            };
          });
        `,
        'pages/spa.vue': `
          <template>
            <div class="p-8">
              <h1 class="text-3xl font-bold mb-4">SPA Mode Page</h1>
              <p>This page uses client-side rendering only.</p>
              <p>Client time: {{ clientTime }}</p>
            </div>
          </template>

          <script setup>
          definePageMeta({
            ssr: false, // This page is SPA only
          });

          const clientTime = ref('');

          onMounted(() => {
            clientTime.value = new Date().toISOString();
          });
          </script>
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('vue');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.hasSSG).toBe(true);
      expect(result.primary?.metadata.ssrFramework).toBe('Nuxt.js');
      expect(result.primary?.metadata.hasUtilityFirst).toBe(true);
      expect(result.primary?.metadata.primaryStylingLibrary).toBe('tailwindcss');
    });

    test('should detect disabled SSR in Nuxt.js SPA mode', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'nuxt-spa-mode',
          dependencies: {
            nuxt: '^3.8.0',
            vue: '^3.3.0',
          },
        },
        'nuxt.config.ts': `
          export default defineNuxtConfig({
            ssr: false, // SPA mode
            target: 'static',
            generate: {
              fallback: true,
            },
          });
        `,
        'pages/index.vue': `
          <template>
            <div>
              <h1>SPA Mode Nuxt App</h1>
              <p>This runs entirely on the client side.</p>
            </div>
          </template>
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('vue');
      expect(result.primary?.metadata.hasSSR).toBe(false);
      expect(result.primary?.metadata.renderingModes).toContain('spa');
    });
  });

  describe('SvelteKit SSR Scenarios', () => {
    test('should detect SvelteKit with SSR adapters and CSS preprocessing', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'sveltekit-ssr-scss',
          dependencies: {
            '@sveltejs/kit': '^1.20.0',
            svelte: '^4.2.0',
          },
          devDependencies: {
            '@sveltejs/adapter-node': '^1.3.0',
            '@sveltejs/adapter-static': '^2.0.0',
            '@sveltejs/vite-plugin-svelte': '^2.4.0',
            sass: '^1.69.0',
            vite: '^4.5.0',
            typescript: '^5.2.0',
          },
        },
        'svelte.config.js': `
          import adapter from '@sveltejs/adapter-node';
          import { vitePreprocess } from '@sveltejs/kit/vite';

          const config = {
            preprocess: vitePreprocess(),
            kit: {
              adapter: adapter({
                out: 'build',
                precompress: false,
                envPrefix: '',
              }),
            },
          };

          export default config;
        `,
        'vite.config.ts': `
          import { sveltekit } from '@sveltejs/kit/vite';
          import { defineConfig } from 'vite';

          export default defineConfig({
            plugins: [sveltekit()],
            css: {
              preprocessorOptions: {
                scss: {
                  additionalData: '@use "src/styles/variables.scss" as *;',
                },
              },
            },
          });
        `,
        'src/styles/variables.scss': `
          $primary-color: #ff3e00;
          $secondary-color: #676778;
          $success-color: #40b3ff;
          
          @mixin button-style($bg-color) {
            background: $bg-color;
            color: white;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.25rem;
            cursor: pointer;
            transition: opacity 0.2s;
            
            &:hover {
              opacity: 0.8;
            }
          }
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
            <body data-sveltekit-preload-data="hover">
              <div style="display: contents">%sveltekit.body%</div>
            </body>
          </html>
        `,
        'src/routes/+layout.svelte': `
          <script lang="ts">
            import '../styles/global.scss';
          </script>

          <main class="app">
            <slot />
          </main>

          <style lang="scss">
            :global(.app) {
              min-height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 2rem;
            }
          </style>
        `,
        'src/routes/+page.svelte': `
          <script lang="ts">
            export let data;
          </script>

          <svelte:head>
            <title>SvelteKit SSR Demo</title>
            <meta name="description" content="SvelteKit with SSR and SCSS" />
          </svelte:head>

          <div class="container">
            <h1 class="title">SvelteKit SSR with SCSS</h1>
            <p class="description">
              This page was server-side rendered at: {data.serverTime}
            </p>
            <button class="primary-btn">Get Started</button>
          </div>

          <style lang="scss">
            .container {
              max-width: 800px;
              margin: 0 auto;
              text-align: center;
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            }

            .title {
              color: $primary-color;
              font-size: 3rem;
              margin-bottom: 1rem;
            }

            .description {
              color: $secondary-color;
              font-size: 1.2rem;
              margin-bottom: 2rem;
            }

            .primary-btn {
              @include button-style($success-color);
              font-size: 1.1rem;
            }
          </style>
        `,
        'src/routes/+page.server.ts': `
          import type { PageServerLoad } from './$types';

          export const load: PageServerLoad = async () => {
            return {
              serverTime: new Date().toISOString(),
            };
          };
        `,
        'src/routes/api/data/+server.ts': `
          import { json } from '@sveltejs/kit';
          import type { RequestHandler } from './$types';

          export const GET: RequestHandler = async () => {
            return json({
              message: 'Hello from SvelteKit API!',
              timestamp: new Date().toISOString(),
            });
          };
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('svelte');
      expect(result.primary?.metadata.svelteKitEnabled).toBe(true);
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.hasSSG).toBe(true);
      expect(result.primary?.metadata.hasTypeScript).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('sass');
    });
  });

  describe('Angular Universal SSR Scenarios', () => {
    test('should detect Angular Universal with Material and SSR configuration', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'angular-universal-material',
          dependencies: {
            '@angular/animations': '^16.2.0',
            '@angular/common': '^16.2.0',
            '@angular/compiler': '^16.2.0',
            '@angular/core': '^16.2.0',
            '@angular/material': '^16.2.0',
            '@angular/cdk': '^16.2.0',
            '@angular/platform-browser': '^16.2.0',
            '@angular/platform-browser-dynamic': '^16.2.0',
            '@angular/platform-server': '^16.2.0',
            '@angular/router': '^16.2.0',
            '@angular/ssr': '^16.2.0',
            '@nguniversal/express-engine': '^16.2.0',
            express: '^4.18.0',
            rxjs: '^7.8.0',
            'zone.js': '^0.13.0',
          },
          devDependencies: {
            '@angular/cli': '^16.2.0',
            '@angular-devkit/build-angular': '^16.2.0',
            '@nguniversal/builders': '^16.2.0',
            typescript: '^5.1.0',
          },
          scripts: {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
            'build:ssr': 'ng build && ng run app:server',
            'serve:ssr': 'node dist/app/server/main.js',
            prerender: 'ng run app:prerender',
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
                    assets: ['src/favicon.ico', 'src/assets'],
                    styles: ['src/styles.scss'],
                    scripts: [],
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
                'serve-ssr': {
                  builder: '@nguniversal/builders:ssr-dev-server',
                  options: {
                    browserTarget: 'app:build',
                    serverTarget: 'app:server',
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
        'server.ts': `
          import { ngExpressEngine } from '@nguniversal/express-engine';
          import express from 'express';
          import { join } from 'path';

          import { AppServerModule } from './src/main.server';
          import { APP_BASE_HREF } from '@angular/common';
          import { existsSync } from 'fs';

          const app = express();
          const PORT = process.env['PORT'] || 4000;
          const DIST_FOLDER = join(process.cwd(), 'dist');

          app.engine('html', ngExpressEngine({
            bootstrap: AppServerModule,
          }));

          app.set('view engine', 'html');
          app.set('views', DIST_FOLDER);

          app.get('*.*', express.static(DIST_FOLDER));

          app.get('*', (req, res) => {
            res.render('index', { req, providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }] });
          });

          app.listen(PORT, () => {
            console.log(\`Node Express server listening on http://localhost:\${PORT}\`);
          });
        `,
        'src/app/app.component.ts': `
          import { Component, OnInit } from '@angular/core';

          @Component({
            selector: 'app-root',
            template: \`
              <mat-toolbar color="primary">
                <span>Angular Universal with Material</span>
              </mat-toolbar>
              
              <div class="container">
                <mat-card class="welcome-card">
                  <mat-card-header>
                    <mat-card-title>Server-Side Rendered Angular</mat-card-title>
                    <mat-card-subtitle>with Angular Material UI</mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content>
                    <p>This page was rendered on: {{ renderContext }}</p>
                    <p>Render time: {{ renderTime }}</p>
                    
                    <mat-form-field appearance="fill">
                      <mat-label>Enter your name</mat-label>
                      <input matInput [(ngModel)]="name" placeholder="Your name">
                    </mat-form-field>
                    
                    <p *ngIf="name">Hello, {{ name }}!</p>
                  </mat-card-content>
                  <mat-card-actions>
                    <button mat-raised-button color="accent">Get Started</button>
                    <button mat-button>Learn More</button>
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
              .welcome-card {
                margin: 20px 0;
              }
              mat-form-field {
                width: 100%;
                margin: 10px 0;
              }
            \`],
          })
          export class AppComponent implements OnInit {
            name = '';
            renderContext = '';
            renderTime = '';

            ngOnInit() {
              this.renderContext = typeof window !== 'undefined' ? 'Client' : 'Server';
              this.renderTime = new Date().toISOString();
            }
          }
        `,
        'src/styles.scss': `
          @use '@angular/material' as mat;
          @include mat.core();

          $primary: mat.define-palette(mat.$indigo-palette);
          $accent: mat.define-palette(mat.$pink-palette, A200, A100, A400);
          $warn: mat.define-palette(mat.$red-palette);

          $theme: mat.define-light-theme((
            color: (
              primary: $primary,
              accent: $accent,
              warn: $warn,
            )
          ));

          @include mat.all-component-themes($theme);

          html, body { 
            height: 100%; 
            margin: 0; 
            font-family: Roboto, "Helvetica Neue", sans-serif; 
          }
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('angular');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.ssrFramework).toBe('Angular Universal');
      expect(result.primary?.metadata.prerenderingEnabled).toBe(true);
      expect(result.primary?.metadata.hasTypeScript).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('@angular/material');
      expect(result.primary?.metadata.stylingLibraries).toContain('sass');
    });
  });

  describe('CSS-in-JS SSR Compatibility', () => {
    test('should detect SSR-compatible CSS-in-JS configuration', async () => {
      await createProjectStructure({
        'package.json': {
          name: 'react-ssr-css-in-js',
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            express: '^4.18.0',
            'styled-components': '^6.0.0',
            '@emotion/react': '^11.11.0',
            '@emotion/server': '^11.11.0',
          },
          devDependencies: {
            '@babel/core': '^7.22.0',
            '@babel/preset-react': '^7.22.0',
            'babel-plugin-styled-components': '^2.1.0',
            webpack: '^5.88.0',
            'webpack-cli': '^5.1.0',
            'babel-loader': '^9.1.0',
          },
          scripts: {
            'build:client': 'webpack --config webpack.client.js',
            'build:server': 'webpack --config webpack.server.js',
            start: 'node dist/server.js',
          },
        },
        'babel.config.js': `
          module.exports = {
            presets: ['@babel/preset-react'],
            plugins: [
              ['styled-components', { 
                ssr: true,
                displayName: true,
                preprocess: false,
              }],
            ],
          };
        `,
        'webpack.server.js': `
          const path = require('path');

          module.exports = {
            target: 'node',
            mode: 'production',
            entry: './src/server.js',
            output: {
              path: path.resolve(__dirname, 'dist'),
              filename: 'server.js',
            },
            module: {
              rules: [
                {
                  test: /\\.jsx?$/,
                  exclude: /node_modules/,
                  use: 'babel-loader',
                },
              ],
            },
          };
        `,
        'src/server.js': `
          import express from 'express';
          import React from 'react';
          import { renderToString } from 'react-dom/server';
          import { ServerStyleSheet } from 'styled-components';
          import { renderStylesToString } from '@emotion/server';
          import App from './App';

          const app = express();

          app.get('*', (req, res) => {
            const sheet = new ServerStyleSheet();
            
            try {
              const html = renderToString(
                sheet.collectStyles(<App />)
              );
              const styleTags = sheet.getStyleTags();
              
              const emotionHtml = renderStylesToString(html);
              
              res.send(\`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>SSR React with CSS-in-JS</title>
                    \${styleTags}
                  </head>
                  <body>
                    <div id="root">\${emotionHtml}</div>
                  </body>
                </html>
              \`);
            } finally {
              sheet.seal();
            }
          });

          app.listen(3000, () => {
            console.log('Server running on http://localhost:3000');
          });
        `,
        'src/App.jsx': `
          import React from 'react';
          import styled from 'styled-components';
          import { css } from '@emotion/react';

          const StyledContainer = styled.div\`
            padding: 2rem;
            background: linear-gradient(45deg, #007bff, #6610f2);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          \`;

          const emotionStyles = css\`
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          \`;

          export default function App() {
            return (
              <StyledContainer>
                <div css={emotionStyles}>
                  <h1>SSR React with CSS-in-JS</h1>
                  <p>This page uses both Styled Components and Emotion with SSR!</p>
                </div>
              </StyledContainer>
            );
          }
        `,
      });

      const result = await detector.detect();

      expect(result.primary?.type).toBe('react');
      expect(result.primary?.metadata.hasSSR).toBe(true);
      expect(result.primary?.metadata.hasCSSInJS).toBe(true);
      expect(result.primary?.metadata.stylingLibraries).toContain('styled-components');
      expect(result.primary?.metadata.stylingLibraries).toContain('@emotion/react');
    });
  });

  // Helper function
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