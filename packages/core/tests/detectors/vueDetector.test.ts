/**
 * Vue Framework Detector Tests
 */

import { VueDetector } from '../../src/detectors/vueDetector';
import type { DetectionContext } from '../../src/frameworkDetector';

describe('VueDetector', () => {
  let detector: VueDetector;

  beforeEach(() => {
    detector = new VueDetector();
  });

  describe('basic detection', () => {
    it('should have correct framework type and name', () => {
      expect(detector.frameworkType).toBe('vue');
      expect(detector.name).toBe('Vue Detector');
    });

    it('should be able to detect any context', () => {
      const context: DetectionContext = { rootPath: '/test' };
      expect(detector.canDetect(context)).toBe(true);
    });
  });

  describe('package.json analysis', () => {
    it('should detect Vue 3 project with core dependencies', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            vue: '^3.3.4',
            'vue-router': '^4.2.4',
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^4.2.3',
            'vue-tsc': '^1.8.5',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('vue');
      expect(result!.name).toBe('Vue.js');
      expect(result!.confidence).toBeGreaterThan(0.7);
      expect(result!.metadata.vueVersion).toBe('3.x');
      expect(result!.metadata.compositionAPI).toBe(true);
      expect(result!.metadata.dependencies).toContain('vue');
      expect(result!.metadata.dependencies).toContain('vue-router');
    });

    it('should detect Vue 2 project', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            vue: '^2.6.14',
            vuex: '^3.6.2',
          },
          devDependencies: {
            'vue-template-compiler': '^2.6.14',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.vueVersion).toBe('2.x');
      expect(result!.metadata.compositionAPI).toBe(false);
      expect(result!.metadata.dependencies).toContain('vuex');
    });

    it('should detect composition API in Vue 2 with backport', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            vue: '^2.6.14',
            '@vue/composition-api': '^1.7.2',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.vueVersion).toBe('2.x');
      expect(result!.metadata.compositionAPI).toBe(true);
    });

    it('should detect Vue CLI project', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            vue: '^3.3.4',
          },
          devDependencies: {
            '@vue/cli-service': '^5.0.8',
          },
          scripts: {
            serve: 'vue-cli-service serve',
            build: 'vue-cli-service build',
            test: 'vue-cli-service test:unit',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.buildSystem).toBe('Vue CLI');
      expect(
        result!.sources.some((s) => s.evidence?.includes('vue-cli-service serve script found'))
      ).toBe(true);
    });

    it('should detect Vite + Vue project', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            vue: '^3.3.4',
          },
          devDependencies: {
            vite: '^4.4.5',
            '@vitejs/plugin-vue': '^4.2.3',
          },
          scripts: {
            dev: 'vite',
            build: 'vite build',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.buildSystem).toBe('Vite');
      expect(result!.metadata.vueVersion).toBe('3.x');
    });

    it('should detect Vue ecosystem libraries', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: {
            vue: '^3.3.4',
            pinia: '^2.1.6',
            'vue-i18n': '^9.2.2',
            '@vue/apollo-composable': '^4.0.0-alpha.20',
          },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.vueVersion).toBe('3.x');
      expect(result!.metadata.compositionAPI).toBe(true);
      expect(result!.metadata.dependencies).toContain('pinia');
      expect(result!.sources.some((s) => s.evidence?.includes('pinia dependency found'))).toBe(
        true
      );
    });
  });

  describe('configuration file analysis', () => {
    it('should detect vue.config.js', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            'vue.config.js',
            {
              _rawContent: `
                module.exports = {
                  configureWebpack: {
                    // webpack config
                  },
                  chainWebpack: config => {
                    // webpack chain config
                  },
                  outputDir: 'dist',
                  pwa: {
                    // PWA config
                  }
                }
              `,
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('vue.config.js');
      expect(
        result!.sources.some((s) => s.evidence?.includes('Vue CLI webpack configuration found'))
      ).toBe(true);
      expect(
        result!.sources.some((s) => s.evidence?.includes('Vue CLI project configuration found'))
      ).toBe(true);
    });

    it('should detect Vite config with Vue plugin', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            'vite.config.js',
            {
              _rawContent: `
                import { defineConfig } from 'vite'
                import vue from '@vitejs/plugin-vue'

                export default defineConfig({
                  plugins: [vue()],
                })
              `,
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('vite.config.*');
      expect(
        result!.sources.some((s) => s.evidence?.includes('Vite Vue plugin configuration found'))
      ).toBe(true);
      expect(
        result!.sources.some((s) => s.evidence?.includes('Vue plugin setup found in Vite config'))
      ).toBe(true);
    });

    it('should detect TypeScript configuration for Vue', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            'tsconfig.json',
            {
              compilerOptions: {
                target: 'esnext',
                module: 'esnext',
                moduleResolution: 'node',
                strict: true,
                jsx: 'preserve',
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
              },
              types: ['vue'],
              include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.tsx', 'src/**/*.vue'],
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('tsconfig.json');
      expect(
        result!.sources.some((s) => s.evidence?.includes('Vue TypeScript configuration found'))
      ).toBe(true);
    });

    it('should detect ESLint configuration with Vue', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        configFiles: new Map([
          [
            '.eslintrc.js',
            {
              _rawContent: `
                module.exports = {
                  extends: [
                    'plugin:vue/vue3-essential',
                    '@vue/eslint-config-typescript'
                  ],
                  rules: {
                    'vue/multi-word-component-names': 'off'
                  }
                }
              `,
            },
          ],
        ]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.configFiles).toContain('ESLint configuration');
      expect(
        result!.sources.some((s) => s.evidence?.includes('ESLint Vue plugin configuration found'))
      ).toBe(true);
    });
  });

  describe('source pattern analysis', () => {
    it('should detect Vue Single File Components', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        sourcePatterns: ['*.vue', 'src', 'components'],
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.singleFileComponents).toBe(true);
      expect(
        result!.sources.some((s) => s.evidence?.includes('Vue Single File Components found'))
      ).toBe(true);
    });

    it('should detect Vue project structure', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        sourcePatterns: ['src', 'components', 'views', 'src/main.js'],
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.sources.some((s) => s.evidence?.includes('src directory found'))).toBe(true);
      expect(result!.sources.some((s) => s.evidence?.includes('components directory found'))).toBe(
        true
      );
      expect(result!.sources.some((s) => s.evidence?.includes('views directory found'))).toBe(true);
    });
  });

  describe('file structure analysis', () => {
    it('should detect Vue CLI project structure', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        fileStructure: {
          directories: ['public', 'src', 'components', 'views'],
          files: ['vue.config.js', 'package.json', 'main.js'],
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(
        result!.sources.some((s) => s.evidence?.includes('Vue CLI project structure detected'))
      ).toBe(true);
      expect(result!.metadata.entryPoints).toContain('src/main.js');
    });

    it('should detect entry points correctly', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        fileStructure: {
          directories: ['src'],
          files: ['main.ts', 'App.vue', 'index.html'],
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.entryPoints).toContain('src/main.ts');
      expect(result!.metadata.entryPoints).toContain('src/App.vue');
    });
  });

  describe('TypeScript support detection', () => {
    it('should detect TypeScript support from dependencies', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: {
          dependencies: { vue: '^3.3.4' },
          devDependencies: { 'vue-tsc': '^1.8.5', typescript: '^5.0.0' },
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.hasTypeScript).toBe(true);
    });

    it('should detect TypeScript support from config', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: { dependencies: { vue: '^3.3.4' } },
        configFiles: new Map([['tsconfig.json', {}]]),
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.metadata.hasTypeScript).toBe(true);
    });

    it('should detect TypeScript support from source patterns', async () => {
      const context: DetectionContext = {
        rootPath: '/test',
        packageJson: { dependencies: { vue: '^3.3.4' } },
        sourcePatterns: ['src/main.ts', '*.vue'],
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
          deps: { '@vue/cli-service': '^5.0.8' },
          expected: 'Vue CLI',
        },
        {
          deps: { vite: '^4.4.5', '@vitejs/plugin-vue': '^4.2.3' },
          expected: 'Vite',
        },
        {
          deps: { webpack: '^5.88.0', 'vue-loader': '^17.2.2' },
          expected: 'Webpack',
        },
        {
          deps: { rollup: '^3.26.0', 'rollup-plugin-vue': '^6.0.0' },
          expected: 'Rollup',
        },
      ];

      for (const testCase of testCases) {
        const context: DetectionContext = {
          rootPath: '/test',
          packageJson: {
            dependencies: { vue: '^3.3.4' },
            devDependencies: testCase.deps,
          },
        };

        const result = await detector.detect(context);

        expect(result).not.toBeNull();
        expect(result!.metadata.buildSystem).toBe(testCase.expected);
      }
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
            vue: '^3.3.4',
            'vue-router': '^4.2.4',
            vuex: '^4.1.0',
            pinia: '^2.1.6',
            'vue-i18n': '^9.2.2',
          },
          devDependencies: {
            '@vue/cli-service': '^5.0.8',
            '@vitejs/plugin-vue': '^4.2.3',
            'vue-tsc': '^1.8.5',
            typescript: '^5.0.0',
            '@vue/test-utils': '^2.4.1',
          },
          scripts: {
            serve: 'vue-cli-service serve',
            build: 'vue-cli-service build',
            test: 'vue-cli-service test:unit',
          },
        },
        configFiles: new Map([
          ['vue.config.js', { _rawContent: 'module.exports = { configureWebpack: {} }' }],
          ['tsconfig.json', { types: ['vue'] }],
        ]),
        sourcePatterns: ['*.vue', 'src', 'components', 'views'],
        fileStructure: {
          directories: ['public', 'src', 'components', 'views'],
          files: ['vue.config.js', 'main.ts', 'App.vue'],
        },
      };

      const result = await detector.detect(context);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBeLessThanOrEqual(1.0);
      expect(result!.confidence).toBeGreaterThan(0.9);
    });
  });
});
