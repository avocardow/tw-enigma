/**
 * Angular Framework Detector Tests
 */

import { AngularDetector } from '../../src/detectors/angularDetector';
import type { DetectionContext } from '../../src/frameworkDetector';

describe('AngularDetector', () => {
  let detector: AngularDetector;

  beforeEach(() => {
    detector = new AngularDetector();
  });

  describe('basic detection', () => {
    it('should have correct framework type and name', () => {
      expect(detector.frameworkType).toBe('angular');
      expect(detector.name).toBe('Angular Detector');
    });

    it('should be able to detect any context', () => {
      const context: DetectionContext = { rootPath: '/test' };
      expect(detector.canDetect(context)).toBe(true);
    });
  });

  describe('package.json analysis', () => {
    it('should detect Angular 16+ project with core dependencies', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
            '@angular/common': '^16.2.0',
            '@angular/platform-browser': '^16.2.0',
            '@angular/platform-browser-dynamic': '^16.2.0',
            '@angular/router': '^16.2.0',
            '@angular/forms': '^16.2.0',
            rxjs: '^7.8.0',
            'zone.js': '^0.13.0',
          },
          devDependencies: {
            '@angular/cli': '^16.2.0',
            '@angular/compiler-cli': '^16.2.0',
            '@angular-devkit/build-angular': '^16.2.0',
            typescript: '^5.1.0',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('angular');
      expect(result!.name).toBe('Angular');
      expect(result!.confidence).toBeGreaterThan(0.8);
      expect(result!.metadata.angularVersion).toBe('16.x');
      expect(result!.metadata.hasAngularCLI).toBe(true);
      expect(result!.metadata.hasRxJS).toBe(true);
      expect(result!.metadata.hasZoneJS).toBe(true);
      expect(result!.metadata.hasTypeScript).toBe(true);
      expect(result!.metadata.dependencies).toContain('@angular/core');
      expect(result!.metadata.dependencies).toContain('@angular/cli');
    });

    it('should detect Angular 15 project', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^15.2.9',
            '@angular/common': '^15.2.9',
            '@angular/platform-browser': '^15.2.9',
            rxjs: '^7.5.0',
            'zone.js': '^0.12.0',
          },
          devDependencies: {
            '@angular/cli': '^15.2.8',
            '@angular/compiler-cli': '^15.2.9',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.angularVersion).toBe('15.x');
    });

    it('should detect Angular with Material Design', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
            '@angular/material': '^16.2.0',
            '@angular/cdk': '^16.2.0',
            '@angular/animations': '^16.2.0',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.libraries).toContain('Angular Material');
      expect(result!.metadata.dependencies).toContain('@angular/material');
      expect(result!.metadata.dependencies).toContain('@angular/cdk');
    });

    it('should detect Angular CLI project with scripts', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
          },
          devDependencies: {
            '@angular/cli': '^16.2.0',
          },
          scripts: {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
            test: 'ng test',
            e2e: 'ng e2e',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.hasAngularCLI).toBe(true);
      expect(result!.metadata.buildSystem).toBe('Angular CLI');
      expect(result!.sources.some((s) => s.evidence?.includes('Angular CLI scripts found'))).toBe(
        true
      );
    });

    it('should detect Angular with NgRx state management', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
            '@ngrx/store': '^16.2.0',
            '@ngrx/effects': '^16.2.0',
            '@ngrx/router-store': '^16.2.0',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.libraries).toContain('@ngrx/store');
      expect(result!.sources.some((s) => s.evidence?.includes('@ngrx/store library found'))).toBe(
        true
      );
    });

    it('should detect Angular with internationalization', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
            '@ngx-translate/core': '^15.0.0',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.libraries).toContain('@ngx-translate/core');
    });

    it('should detect Angular with service worker support', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
            '@angular/service-worker': '^16.2.0',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.libraries).toContain('Service Worker');
    });
  });

  describe('configuration file analysis', () => {
    it('should detect angular.json configuration', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            'angular.json',
            {
              version: 1,
              newProjectRoot: 'projects',
              defaultProject: 'my-app',
              projects: {
                'my-app': {
                  projectType: 'application',
                  architect: {
                    build: {
                      builder: '@angular-devkit/build-angular:browser',
                    },
                  },
                },
              },
              schematics: {
                '@schematics/angular:component': {
                  style: 'scss',
                },
              },
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('angular.json');
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular CLI project configuration found'))
      ).toBe(true);
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular CLI build configuration found'))
      ).toBe(true);
    });

    it('should detect legacy .angular-cli.json configuration', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            '.angular-cli.json',
            {
              project: {
                name: 'my-app',
              },
              apps: [
                {
                  root: 'src',
                  outDir: 'dist',
                },
              ],
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('.angular-cli.json');
      expect(
        result!.sources.some((s) => s.evidence?.includes('.angular-cli.json found (legacy)'))
      ).toBe(true);
    });

    it('should detect ng-package.json for library projects', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            'ng-package.json',
            {
              $schema: 'ng-packagr/ng-package.schema.json',
              dest: '../dist/my-lib',
              lib: {
                entryFile: 'src/public-api.ts',
              },
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('ng-package.json');
      expect(result!.sources.some((s) => s.evidence?.includes('ng-package.json found'))).toBe(true);
    });

    it('should detect Angular TypeScript configuration', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            'tsconfig.json',
            {
              compilerOptions: {
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                module: 'esnext',
                target: 'es2022',
              },
              angularCompilerOptions: {
                enableI18nLegacyMessageIdFormat: false,
                strictInjectionParameters: true,
              },
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('tsconfig.json');
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular TypeScript configuration found'))
      ).toBe(true);
    });

    it('should detect Angular-specific TypeScript configs', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          ['tsconfig.app.json', {}],
          ['tsconfig.spec.json', {}],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('tsconfig.app.json / tsconfig.spec.json');
      expect(
        result!.sources.some((s) =>
          s.evidence?.includes('Angular-specific TypeScript configs found')
        )
      ).toBe(true);
    });

    it('should detect Karma test configuration', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            'karma.conf.js',
            {
              _rawContent: `
                module.exports = function (config) {
                  config.set({
                    frameworks: ['jasmine', '@angular-devkit/build-angular'],
                    plugins: [
                      require('karma-jasmine'),
                      require('karma-coverage-istanbul-reporter'),
                      require('@angular-devkit/build-angular/plugins/karma')
                    ],
                  });
                };
              `,
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('karma.conf.js');
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular Karma test configuration found'))
      ).toBe(true);
    });

    it('should detect ESLint configuration with Angular', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            '.eslintrc.json',
            {
              extends: [
                '@angular-eslint/recommended',
                '@angular-eslint/template/process-inline-templates',
              ],
              rules: {
                '@angular-eslint/directive-selector': [
                  'error',
                  { type: 'attribute', prefix: 'app', style: 'camelCase' },
                ],
              },
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('ESLint configuration');
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular ESLint configuration found'))
      ).toBe(true);
    });
  });

  describe('source pattern analysis', () => {
    it('should detect Angular TypeScript patterns', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        sourcePatterns: ['*.component.ts', '*.service.ts', '*.module.ts'],
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular TypeScript patterns found'))
      ).toBe(true);
    });

    it('should detect Angular component templates', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        sourcePatterns: ['*.component.html', '*.component.ts'],
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular component templates found'))
      ).toBe(true);
    });

    it('should detect Angular project directories', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        sourcePatterns: ['src/app', 'src/environments', 'src/main.ts'],
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.sources.some((s) => s.evidence?.includes('src/app directory found'))).toBe(
        true
      );
      expect(
        result!.sources.some((s) => s.evidence?.includes('src/environments directory found'))
      ).toBe(true);
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular main.ts entry point found'))
      ).toBe(true);
    });

    it('should detect Angular polyfills', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        sourcePatterns: ['src/polyfills.ts'],
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.sources.some((s) => s.evidence?.includes('Angular polyfills.ts found'))).toBe(
        true
      );
    });
  });

  describe('file structure analysis', () => {
    it('should detect Angular CLI project structure', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        fileStructure: {
          directories: ['src', 'app', 'environments', 'assets'],
          files: ['angular.json', 'package.json', 'main.ts', 'app.module.ts', 'app.component.ts'],
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(
        result!.sources.some((s) => s.evidence?.includes('Angular CLI project structure detected'))
      ).toBe(true);
      expect(result!.metadata.entryPoints).toContain('src/main.ts');
    });

    it('should detect Angular configuration files', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        fileStructure: {
          directories: ['src'],
          files: ['angular.json', 'karma.conf.js', 'protractor.conf.js'],
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.sources.some((s) => s.evidence?.includes('angular.json found'))).toBe(true);
      expect(result!.sources.some((s) => s.evidence?.includes('karma.conf.js found'))).toBe(true);
      expect(result!.sources.some((s) => s.evidence?.includes('protractor.conf.js found'))).toBe(
        true
      );
    });

    it('should detect entry points correctly', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        fileStructure: {
          directories: ['src'],
          files: ['main.ts', 'polyfills.ts', 'app.module.ts', 'app.component.ts', 'index.html'],
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.entryPoints).toContain('src/main.ts');
      expect(result!.metadata.entryPoints).toContain('src/polyfills.ts');
      expect(result!.metadata.entryPoints).toContain('src/app/app.module.ts');
    });
  });

  describe('TypeScript support detection', () => {
    it('should always detect TypeScript for Angular projects', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.hasTypeScript).toBe(true);
    });

    it('should detect TypeScript from explicit dependencies', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
          },
          devDependencies: {
            typescript: '^5.1.0',
            '@angular/compiler': '^16.2.0',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.hasTypeScript).toBe(true);
    });
  });

  describe('build system detection', () => {
    it('should detect various build systems', async () => {
      const testCases = [
        {
          deps: { '@angular-devkit/build-angular': '^16.2.0', '@angular/cli': '^16.2.0' },
          expected: 'Angular CLI',
        },
        {
          deps: { webpack: '^5.88.0' },
          configFiles: new Map(),
          expected: 'Webpack',
        },
        {
          deps: { esbuild: '^0.18.0' },
          configFiles: new Map(),
          expected: 'esbuild',
        },
      ];

      for (const testCase of testCases) {
        const context: DetectionContext = {
          rootPath: '/test',
          packageJson: {
            dependencies: { '@angular/core': '^16.2.0' },
            devDependencies: testCase.deps,
          },
          configFiles: testCase.configFiles,
        };

        const result = await detector.detect(context);

        expect(result).not.toBeNull();
        expect(result!.metadata.buildSystem).toBe(testCase.expected);
      }
    });

    it('should default to Angular CLI for Angular projects', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: { '@angular/core': '^16.2.0' },
        },
        configFiles: new Map([['angular.json', {}]]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.buildSystem).toBe('Angular CLI');
    });
  });

  describe('confidence threshold and edge cases', () => {
    it('should return null for low confidence detection', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            react: '^18.2.0', // Different framework
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).toBeNull();
    });

    it('should handle missing context gracefully', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
      };

      const result = await detector.detect(context);

      expect(result).toBeNull();
    });

    it('should normalize confidence to not exceed 1.0', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            '@angular/core': '^16.2.0',
            '@angular/common': '^16.2.0',
            '@angular/platform-browser': '^16.2.0',
            '@angular/router': '^16.2.0',
            '@angular/forms': '^16.2.0',
            '@angular/material': '^16.2.0',
            '@angular/cdk': '^16.2.0',
            '@angular/animations': '^16.2.0',
            '@ngrx/store': '^16.2.0',
            '@ngrx/effects': '^16.2.0',
            rxjs: '^7.8.0',
            'zone.js': '^0.13.0',
          },
          devDependencies: {
            '@angular/cli': '^16.2.0',
            '@angular/compiler-cli': '^16.2.0',
            '@angular-devkit/build-angular': '^16.2.0',
            typescript: '^5.1.0',
            '@angular/language-service': '^16.2.0',
            'ng-packagr': '^16.2.0',
          },
          scripts: {
            ng: 'ng',
            start: 'ng serve',
            build: 'ng build',
            test: 'ng test',
            e2e: 'ng e2e',
          },
        },
        configFiles: new Map([
          ['angular.json', { projects: {}, architect: {} }],
          ['tsconfig.json', { compilerOptions: { experimentalDecorators: true } }],
          ['karma.conf.js', { _rawContent: '@angular-devkit/build-angular' }],
        ]),
        sourcePatterns: ['*.component.ts', '*.service.ts', '*.module.ts', 'src/app', 'src/main.ts'],
        fileStructure: {
          directories: ['src', 'app', 'environments', 'assets'],
          files: ['angular.json', 'main.ts', 'app.module.ts', 'app.component.ts'],
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBeLessThanOrEqual(1.0);
      expect(result!.confidence).toBeGreaterThan(0.9);
    });
  });
});
