/**
 * Test suite for Framework Configuration Presets
 * 
 * Tests the ConfigPresetManager class and framework-specific preset functionality
 * including React, Vue, and Angular configurations with validation and overrides.
 */

import {
  ConfigPresetManager,
  ConfigValidationError,
  ConfigNotFoundError,
  REACT_PRESETS,
  VUE_PRESETS,
  ANGULAR_PRESETS,
  ALL_PRESETS,
  type ConfigPreset,
  type FrameworkConfig,
  type ConfigOverride,
  type CustomConfig,
  type ReactConfig,
  type VueConfig,
  type AngularConfig,
  createConfigPresetManager,
  getRecommendedConfig,
} from '../src/config/frameworkPresets';
import type { FrameworkInfo } from '../src/frameworkDetector';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Framework Configuration Presets', () => {
  let manager: ConfigPresetManager;

  beforeEach(() => {
    manager = new ConfigPresetManager();
  });

  describe('Preset Loading', () => {
    it('should load all default presets', () => {
      const presets = manager.getAvailablePresets();
      expect(presets.length).toBeGreaterThan(0);
      
      // Check that React presets are loaded
      const reactPresets = manager.getFrameworkPresets('react');
      expect(reactPresets.length).toBe(3); // react-cra, react-nextjs, react-vite
      
      // Check that Vue presets are loaded
      const vuePresets = manager.getFrameworkPresets('vue');
      expect(vuePresets.length).toBe(3); // vue-cli, vue-vite, vue-nuxt
      
      // Check that Angular presets are loaded
      const angularPresets = manager.getFrameworkPresets('angular');
      expect(angularPresets.length).toBe(2); // angular-cli, angular-universal
    });

    it('should emit presetsLoaded event', (done) => {
      const newManager = new ConfigPresetManager();
      
      newManager.once('presetsLoaded', (data) => {
        expect(data.count).toBeGreaterThan(0);
        expect(data.presets).toContain('react-cra');
        expect(data.presets).toContain('vue-cli');
        expect(data.presets).toContain('angular-cli');
        done();
      });
    });
  });

  describe('Preset Retrieval', () => {
    it('should get preset by ID', () => {
      const preset = manager.getPreset('react-cra');
      expect(preset).toBeDefined();
      expect(preset?.id).toBe('react-cra');
      expect(preset?.config.framework).toBe('react');
    });

    it('should return undefined for non-existent preset', () => {
      const preset = manager.getPreset('non-existent');
      expect(preset).toBeUndefined();
    });

    it('should get framework-specific presets', () => {
      const reactPresets = manager.getFrameworkPresets('react');
      expect(reactPresets.every(p => p.config.framework === 'react')).toBe(true);
      
      const vuePresets = manager.getFrameworkPresets('vue');
      expect(vuePresets.every(p => p.config.framework === 'vue')).toBe(true);
      
      const angularPresets = manager.getFrameworkPresets('angular');
      expect(angularPresets.every(p => p.config.framework === 'angular')).toBe(true);
    });
  });

  describe('React Presets', () => {
    it('should have valid React CRA preset', () => {
      const preset = REACT_PRESETS['react-cra'];
      expect(preset.config.framework).toBe('react');
      expect(preset.config.ssrCompatible).toBe(false);
      expect(preset.config.supportedBuildSystems).toContain('Create React App');
      
      const reactConfig = preset.config as ReactConfig;
      expect(reactConfig.frameworkSpecific.serverComponents.enabled).toBe(false);
      expect(reactConfig.frameworkSpecific.jsxPragma.pragma).toBe('React.createElement');
    });

    it('should have valid React Next.js preset', () => {
      const preset = REACT_PRESETS['react-nextjs'];
      expect(preset.config.framework).toBe('react');
      expect(preset.config.ssrCompatible).toBe(true);
      expect(preset.config.supportedBuildSystems).toContain('Next.js');
      
      const reactConfig = preset.config as ReactConfig;
      expect(reactConfig.frameworkSpecific.serverComponents.enabled).toBe(true);
      expect(reactConfig.frameworkSpecific.serverComponents.extractServerCSS).toBe(true);
    });

    it('should have valid React Vite preset', () => {
      const preset = REACT_PRESETS['react-vite'];
      expect(preset.config.framework).toBe('react');
      expect(preset.config.ssrCompatible).toBe(true);
      expect(preset.config.supportedBuildSystems).toContain('Vite');
      
      const reactConfig = preset.config as ReactConfig;
      expect(reactConfig.frameworkSpecific.jsxPragma.importSource).toBe('@emotion/react');
    });
  });

  describe('Vue Presets', () => {
    it('should have valid Vue CLI preset', () => {
      const preset = VUE_PRESETS['vue-cli'];
      expect(preset.config.framework).toBe('vue');
      expect(preset.config.ssrCompatible).toBe(false);
      expect(preset.config.supportedBuildSystems).toContain('Vue CLI');
      
      const vueConfig = preset.config as VueConfig;
      expect(vueConfig.frameworkSpecific.version).toBe('3');
      expect(vueConfig.frameworkSpecific.compositionApi).toBe(true);
      expect(vueConfig.frameworkSpecific.scopedStyles.enabled).toBe(true);
    });

    it('should have valid Vue Nuxt preset', () => {
      const preset = VUE_PRESETS['vue-nuxt'];
      expect(preset.config.framework).toBe('vue');
      expect(preset.config.ssrCompatible).toBe(true);
      expect(preset.config.supportedBuildSystems).toContain('Nuxt.js');
      
      const vueConfig = preset.config as VueConfig;
      expect(vueConfig.frameworkSpecific.version).toBe('3');
      expect(vueConfig.frameworkSpecific.scopedStyles.extractToFiles).toBe(true);
    });
  });

  describe('Angular Presets', () => {
    it('should have valid Angular CLI preset', () => {
      const preset = ANGULAR_PRESETS['angular-cli'];
      expect(preset.config.framework).toBe('angular');
      expect(preset.config.ssrCompatible).toBe(true);
      expect(preset.config.supportedBuildSystems).toContain('Angular CLI');
      
      const angularConfig = preset.config as AngularConfig;
      expect(angularConfig.frameworkSpecific.viewEncapsulation).toBe('Emulated');
      expect(angularConfig.frameworkSpecific.cliIntegration.enabled).toBe(true);
      expect(angularConfig.frameworkSpecific.optimizations.ivyOptimizations).toBe(true);
    });

    it('should have valid Angular Universal preset', () => {
      const preset = ANGULAR_PRESETS['angular-universal'];
      expect(preset.config.framework).toBe('angular');
      expect(preset.config.ssrCompatible).toBe(true);
      expect(preset.prerequisites).toContain('@nguniversal/express-engine');
      
      const angularConfig = preset.config as AngularConfig;
      expect(angularConfig.frameworkSpecific.optimizations.standaloneComponents).toBe(true);
    });
  });

  describe('Configuration Overrides', () => {
    it('should apply simple replace overrides', () => {
      const preset = manager.getPreset('react-cra')!;
      const overrides: ConfigOverride[] = [
        {
          path: 'development.sourceMaps',
          value: false,
          mode: 'replace',
        },
      ];

      const config = manager.applyOverrides(preset.config, overrides);
      expect(config.development.sourceMaps).toBe(false);
    });

    it('should apply merge overrides for objects', () => {
      const preset = manager.getPreset('react-cra')!;
      const overrides: ConfigOverride[] = [
        {
          path: 'performance',
          value: { treeShaking: false, newOption: true },
          mode: 'merge',
        },
      ];

      const config = manager.applyOverrides(preset.config, overrides);
      expect(config.performance.treeShaking).toBe(false);
      expect(config.performance.codeSplitting).toBe(true); // Original value preserved
      expect((config.performance as any).newOption).toBe(true);
    });

    it('should apply append overrides for arrays', () => {
      const preset = manager.getPreset('react-cra')!;
      const overrides: ConfigOverride[] = [
        {
          path: 'supportedBuildSystems',
          value: ['Custom Build Tool'],
          mode: 'append',
        },
      ];

      const config = manager.applyOverrides(preset.config, overrides);
      expect(config.supportedBuildSystems).toContain('Create React App');
      expect(config.supportedBuildSystems).toContain('Custom Build Tool');
    });

    it('should apply conditional overrides', () => {
      const preset = manager.getPreset('react-nextjs')!;
      const overrides: ConfigOverride[] = [
        {
          path: 'cssInJs.minimizeSize',
          value: false,
          mode: 'replace',
          condition: (config) => config.ssrCompatible === true,
        },
        {
          path: 'development.debugInfo',
          value: false,
          mode: 'replace',
          condition: (config) => config.ssrCompatible === false,
        },
      ];

      const config = manager.applyOverrides(preset.config, overrides);
      expect(config.cssInJs.minimizeSize).toBe(false); // First condition met
      expect(config.development.debugInfo).toBe(true); // Second condition not met
    });

    it('should handle nested path overrides', () => {
      const preset = manager.getPreset('react-cra')!;
      const overrides: ConfigOverride[] = [
        {
          path: 'frameworkSpecific.optimizations.displayNames',
          value: false,
          mode: 'replace',
        },
      ];

      const config = manager.applyOverrides(preset.config, overrides) as ReactConfig;
      expect(config.frameworkSpecific.optimizations.displayNames).toBe(false);
    });
  });

  describe('Configuration Creation', () => {
    it('should create configuration from preset', () => {
      const config = manager.createConfig('react-cra');
      expect(config.framework).toBe('react');
      expect(config.name).toBe('React CRA');
    });

    it('should create configuration with overrides', () => {
      const overrides: ConfigOverride[] = [
        {
          path: 'development.sourceMaps',
          value: false,
          mode: 'replace',
        },
      ];

      const config = manager.createConfig('react-cra', overrides);
      expect(config.development.sourceMaps).toBe(false);
    });

    it('should create configuration with custom config', () => {
      const customConfig: CustomConfig = {
        extends: 'react-cra',
        overrides: [
          {
            path: 'production.minify',
            value: false,
            mode: 'replace',
          },
        ],
      };

      const config = manager.createConfig('react-cra', [], customConfig);
      expect(config.production.minify).toBe(false);
    });

    it('should throw error for non-existent preset', () => {
      expect(() => {
        manager.createConfig('non-existent');
      }).toThrow(ConfigNotFoundError);
    });

    it('should emit configCreated event', async () => {
      return new Promise<void>((resolve) => {
        manager.once('configCreated', (data) => {
          expect(data.presetId).toBe('react-cra');
          expect(data.config.framework).toBe('react');
          expect(data.validation.valid).toBe(true);
          resolve();
        });

        manager.createConfig('react-cra');
      });
    });
  });

  describe('Preset Registration', () => {
    it('should register custom preset', () => {
      const customPreset: ConfigPreset = {
        id: 'custom-react',
        name: 'Custom React',
        description: 'Custom React configuration',
        config: {
          framework: 'react',
          name: 'Custom React',
          description: 'Custom React configuration',
          supportedBuildSystems: ['Custom'],
          ssrCompatible: false,
          cssInJs: {
            extractStatic: true,
            optimizeRuntime: true,
            generateSourceMaps: true,
            removeDuplicates: true,
            minimizeSize: false,
            preserveDebugInfo: true,
            enableHMR: true,
            customThemeExtraction: false,
          },
          frameworkSpecific: {
            serverComponents: {
              enabled: false,
              extractServerCSS: false,
              clientBoundary: false,
            },
            jsxPragma: {
              pragma: 'React.createElement',
              pragmaFrag: 'React.Fragment',
            },
            optimizations: {
              displayNames: true,
              devtools: true,
              componentTreeShaking: true,
            },
          },
          performance: {
            treeShaking: true,
            codeSplitting: true,
            lazyLoading: true,
            deadCodeElimination: true,
            bundleOptimization: true,
          },
          development: {
            sourceMaps: true,
            hmr: true,
            debugInfo: true,
            fastRefresh: true,
          },
          production: {
            minify: true,
            compress: true,
            optimizeAssets: true,
            removeDebugCode: true,
          },
        },
        prerequisites: ['react', 'react-dom'],
        recommendedCSSInJS: [],
        compatibility: {
          node: ['>=14.0.0'],
          packageManagers: ['npm'],
          buildTools: ['custom'],
        },
      };

      manager.registerPreset(customPreset);
      
      const retrieved = manager.getPreset('custom-react');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Custom React');
    });

    it('should throw error for invalid preset', () => {
      const invalidPreset = {
        id: '',
        name: '',
        config: null,
      } as any;

      expect(() => {
        manager.registerPreset(invalidPreset);
      }).toThrow(ConfigValidationError);
    });

    it('should emit presetRegistered event', async () => {
      const customPreset: ConfigPreset = {
        id: 'test-preset',
        name: 'Test Preset',
        description: 'Test configuration',
        config: REACT_PRESETS['react-cra'].config,
        prerequisites: [],
        recommendedCSSInJS: [],
        compatibility: {
          node: ['>=14.0.0'],
          packageManagers: ['npm'],
          buildTools: ['test'],
        },
      };

      return new Promise<void>((resolve) => {
        manager.once('presetRegistered', (data) => {
          expect(data.preset.id).toBe('test-preset');
          resolve();
        });

        manager.registerPreset(customPreset);
      });
    });
  });

  describe('Validation', () => {
    it('should validate React configuration', () => {
      const config: ReactConfig = {
        framework: 'react',
        name: 'Test React',
        description: 'Test configuration',
        supportedBuildSystems: ['Test'],
        ssrCompatible: false,
        cssInJs: {
          extractStatic: true,
          optimizeRuntime: true,
          generateSourceMaps: true,
          removeDuplicates: true,
          minimizeSize: false,
          preserveDebugInfo: true,
          enableHMR: true,
          customThemeExtraction: false,
        },
        frameworkSpecific: {
          serverComponents: {
            enabled: false,
            extractServerCSS: false,
            clientBoundary: false,
          },
          jsxPragma: {
            pragma: 'React.createElement',
            pragmaFrag: 'React.Fragment',
          },
          optimizations: {
            displayNames: true,
            devtools: true,
            componentTreeShaking: true,
          },
        },
        performance: {
          treeShaking: true,
          codeSplitting: true,
          lazyLoading: true,
          deadCodeElimination: true,
          bundleOptimization: true,
        },
        development: {
          sourceMaps: true,
          hmr: true,
          debugInfo: true,
          fastRefresh: true,
        },
        production: {
          minify: true,
          compress: true,
          optimizeAssets: true,
          removeDebugCode: true,
        },
      };

      const validation = manager.validateConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect React validation errors', () => {
      const config = {
        framework: 'react',
        name: 'Test React',
        description: 'Test configuration',
        supportedBuildSystems: ['Test'],
        ssrCompatible: false,
        cssInJs: {
          extractStatic: true,
          optimizeRuntime: true,
          generateSourceMaps: true,
          removeDuplicates: true,
          minimizeSize: false,
          preserveDebugInfo: true,
          enableHMR: true,
          customThemeExtraction: false,
        },
        frameworkSpecific: {
          serverComponents: {
            enabled: false,
            extractServerCSS: false,
            clientBoundary: false,
          },
          jsxPragma: {
            pragma: '', // Invalid: empty pragma
            pragmaFrag: '', // Invalid: empty pragmaFrag
          },
          optimizations: {
            displayNames: true,
            devtools: true,
            componentTreeShaking: true,
          },
        },
        performance: {
          treeShaking: true,
          codeSplitting: true,
          lazyLoading: true,
          deadCodeElimination: true,
          bundleOptimization: true,
        },
        development: {
          sourceMaps: true,
          hmr: true,
          debugInfo: true,
          fastRefresh: true,
        },
        production: {
          minify: true,
          compress: true,
          optimizeAssets: true,
          removeDebugCode: true,
        },
      } as ReactConfig;

      const validation = manager.validateConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.path.includes('jsxPragma.pragma'))).toBe(true);
      expect(validation.errors.some(e => e.path.includes('jsxPragma.pragmaFrag'))).toBe(true);
    });

    it('should validate Vue configuration', () => {
      const config: VueConfig = {
        framework: 'vue',
        name: 'Test Vue',
        description: 'Test configuration',
        supportedBuildSystems: ['Test'],
        ssrCompatible: false,
        cssInJs: {
          extractStatic: true,
          optimizeRuntime: true,
          generateSourceMaps: true,
          removeDuplicates: true,
          minimizeSize: false,
          preserveDebugInfo: true,
          enableHMR: true,
          customThemeExtraction: false,
        },
        frameworkSpecific: {
          version: '3',
          compositionApi: true,
          scopedStyles: {
            enabled: true,
            extractToFiles: true,
            generateSourceMaps: true,
          },
          optimizations: {
            templateOptimization: true,
            compilerOptimizations: true,
            reactivityOptimizations: true,
          },
        },
        performance: {
          treeShaking: true,
          codeSplitting: true,
          lazyLoading: true,
          deadCodeElimination: true,
          bundleOptimization: true,
        },
        development: {
          sourceMaps: true,
          hmr: true,
          debugInfo: true,
          fastRefresh: true,
        },
        production: {
          minify: true,
          compress: true,
          optimizeAssets: true,
          removeDebugCode: true,
        },
      };

      const validation = manager.validateConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect Vue validation errors', () => {
      const config = {
        framework: 'vue',
        name: 'Test Vue',
        description: 'Test configuration',
        supportedBuildSystems: ['Test'],
        ssrCompatible: false,
        cssInJs: {
          extractStatic: true,
          optimizeRuntime: true,
          generateSourceMaps: true,
          removeDuplicates: true,
          minimizeSize: false,
          preserveDebugInfo: true,
          enableHMR: true,
          customThemeExtraction: false,
        },
        frameworkSpecific: {
          version: '4', // Invalid: should be '2' or '3'
          compositionApi: true,
          scopedStyles: {
            enabled: true,
            extractToFiles: true,
            generateSourceMaps: true,
          },
          optimizations: {
            templateOptimization: true,
            compilerOptimizations: true,
            reactivityOptimizations: true,
          },
        },
        performance: {
          treeShaking: true,
          codeSplitting: true,
          lazyLoading: true,
          deadCodeElimination: true,
          bundleOptimization: true,
        },
        development: {
          sourceMaps: true,
          hmr: true,
          debugInfo: true,
          fastRefresh: true,
        },
        production: {
          minify: true,
          compress: true,
          optimizeAssets: true,
          removeDebugCode: true,
        },
      } as VueConfig;

      const validation = manager.validateConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.path.includes('version'))).toBe(true);
    });

    it('should validate Angular configuration', () => {
      const config: AngularConfig = {
        framework: 'angular',
        name: 'Test Angular',
        description: 'Test configuration',
        supportedBuildSystems: ['Test'],
        ssrCompatible: false,
        cssInJs: {
          extractStatic: true,
          optimizeRuntime: true,
          generateSourceMaps: true,
          removeDuplicates: true,
          minimizeSize: false,
          preserveDebugInfo: true,
          enableHMR: true,
          customThemeExtraction: false,
        },
        frameworkSpecific: {
          version: '17.0.0',
          viewEncapsulation: 'Emulated',
          cliIntegration: {
            enabled: true,
            buildOptimizer: true,
            extractCss: true,
          },
          optimizations: {
            ivyOptimizations: true,
            zoneOptimizations: true,
            standaloneComponents: true,
          },
        },
        performance: {
          treeShaking: true,
          codeSplitting: true,
          lazyLoading: true,
          deadCodeElimination: true,
          bundleOptimization: true,
        },
        development: {
          sourceMaps: true,
          hmr: true,
          debugInfo: true,
          fastRefresh: true,
        },
        production: {
          minify: true,
          compress: true,
          optimizeAssets: true,
          removeDebugCode: true,
        },
      };

      const validation = manager.validateConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should apply custom validation rules', () => {
      const config = REACT_PRESETS['react-cra'].config;
      
      const customValidation = {
        rules: [
          {
            path: 'development.sourceMaps',
            validator: (value: any) => value === false,
            message: 'Source maps must be disabled for this configuration',
          },
        ],
      };

      const validation = manager.validateConfig(config, customValidation);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.message.includes('Source maps must be disabled'))).toBe(true);
    });
  });

  describe('Preset Recommendation', () => {
    it('should recommend React preset for React project', () => {
      const frameworkInfo: FrameworkInfo = {
        type: 'react',
        confidence: 0.9,
        metadata: {
          buildSystem: 'Create React App',
          hasSSR: false,
          packageManager: 'npm',
          dependencies: ['react', 'react-dom'],
        },
      };

      const preset = manager.recommendPreset(frameworkInfo);
      expect(preset).toBeDefined();
      expect(preset?.config.framework).toBe('react');
      expect(preset?.id).toBe('react-cra');
    });

    it('should recommend Next.js preset for React with SSR', () => {
      const frameworkInfo: FrameworkInfo = {
        type: 'react',
        confidence: 0.9,
        metadata: {
          buildSystem: 'Next.js',
          hasSSR: true,
          packageManager: 'npm',
          dependencies: ['react', 'react-dom', 'next'],
        },
      };

      const preset = manager.recommendPreset(frameworkInfo);
      expect(preset).toBeDefined();
      expect(preset?.config.framework).toBe('react');
      expect(preset?.id).toBe('react-nextjs');
      expect(preset?.config.ssrCompatible).toBe(true);
    });

    it('should recommend Vite preset for Vite build system', () => {
      const frameworkInfo: FrameworkInfo = {
        type: 'react',
        confidence: 0.9,
        metadata: {
          buildSystem: 'Vite',
          hasSSR: false,
          packageManager: 'npm',
          dependencies: ['react', 'react-dom', 'vite'],
        },
      };

      const preset = manager.recommendPreset(frameworkInfo);
      expect(preset).toBeDefined();
      expect(preset?.id).toBe('react-vite');
    });

    it('should return null for unknown framework', () => {
      const frameworkInfo: FrameworkInfo = {
        type: 'unknown',
        confidence: 0.1,
        metadata: {},
      };

      const preset = manager.recommendPreset(frameworkInfo);
      expect(preset).toBeNull();
    });

    it('should recommend SSR preset when SSR is detected', () => {
      const frameworkInfo: FrameworkInfo = {
        type: 'vue',
        confidence: 0.9,
        metadata: {
          hasSSR: true,
          buildSystem: 'Nuxt.js',
          packageManager: 'npm',
          dependencies: ['vue', 'nuxt'],
        },
      };

      const preset = manager.recommendPreset(frameworkInfo);
      expect(preset).toBeDefined();
      expect(preset?.config.ssrCompatible).toBe(true);
      expect(preset?.id).toBe('vue-nuxt');
    });
  });

  describe('Factory Functions', () => {
    it('should create preset manager via factory', () => {
      const factoryManager = createConfigPresetManager();
      expect(factoryManager).toBeInstanceOf(ConfigPresetManager);
      expect(factoryManager.getAvailablePresets().length).toBeGreaterThan(0);
    });

    it('should get recommended configuration', () => {
      const frameworkInfo: FrameworkInfo = {
        type: 'react',
        confidence: 0.9,
        metadata: {
          buildSystem: 'Create React App',
          hasSSR: false,
        },
      };

      const config = getRecommendedConfig(frameworkInfo);
      expect(config).toBeDefined();
      expect(config?.framework).toBe('react');
    });

    it('should return null for unknown framework in recommendation', () => {
      const frameworkInfo: FrameworkInfo = {
        type: 'unknown',
        confidence: 0.1,
        metadata: {},
      };

      const config = getRecommendedConfig(frameworkInfo);
      expect(config).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should throw ConfigValidationError with detailed information', () => {
      try {
        const invalidPreset = {
          id: '',
          name: '',
          config: null,
        } as any;

        manager.registerPreset(invalidPreset);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as ConfigValidationError).errors.length).toBeGreaterThan(0);
      }
    });

    it('should throw ConfigNotFoundError for missing preset', () => {
      expect(() => {
        manager.createConfig('missing-preset');
      }).toThrow(ConfigNotFoundError);
    });
  });

  describe('Preset Constants', () => {
    it('should have all React presets in REACT_PRESETS', () => {
      expect(REACT_PRESETS['react-cra']).toBeDefined();
      expect(REACT_PRESETS['react-nextjs']).toBeDefined();
      expect(REACT_PRESETS['react-vite']).toBeDefined();
    });

    it('should have all Vue presets in VUE_PRESETS', () => {
      expect(VUE_PRESETS['vue-cli']).toBeDefined();
      expect(VUE_PRESETS['vue-vite']).toBeDefined();
      expect(VUE_PRESETS['vue-nuxt']).toBeDefined();
    });

    it('should have all Angular presets in ANGULAR_PRESETS', () => {
      expect(ANGULAR_PRESETS['angular-cli']).toBeDefined();
      expect(ANGULAR_PRESETS['angular-universal']).toBeDefined();
    });

    it('should combine all presets in ALL_PRESETS', () => {
      const allKeys = Object.keys(ALL_PRESETS);
      const reactKeys = Object.keys(REACT_PRESETS);
      const vueKeys = Object.keys(VUE_PRESETS);
      const angularKeys = Object.keys(ANGULAR_PRESETS);

      expect(allKeys).toEqual(expect.arrayContaining(reactKeys));
      expect(allKeys).toEqual(expect.arrayContaining(vueKeys));
      expect(allKeys).toEqual(expect.arrayContaining(angularKeys));
    });
  });
});