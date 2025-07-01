/**
 * Framework Configuration Presets
 *
 * Provides pre-configured optimization settings for popular frontend frameworks
 * and CSS-in-JS libraries with extensibility and validation support.
 */

import { EventEmitter } from 'events';
import type { FrameworkInfo } from '../frameworkDetector';
import type { CSSInJSLibrary, CSSInJSOptimizationConfig } from '../integrations/cssInJsIntegration';

export interface BaseFrameworkConfig {
  /** Framework type */
  framework: 'react' | 'vue' | 'angular' | 'universal';
  /** Configuration name */
  name: string;
  /** Configuration description */
  description: string;
  /** Supported build systems */
  supportedBuildSystems: string[];
  /** SSR compatibility */
  ssrCompatible: boolean;
  /** CSS-in-JS integration */
  cssInJs: CSSInJSOptimizationConfig;
  /** Framework-specific options */
  frameworkSpecific: Record<string, any>;
  /** Performance optimizations */
  performance: {
    /** Enable tree shaking */
    treeShaking: boolean;
    /** Enable code splitting */
    codeSplitting: boolean;
    /** Enable lazy loading */
    lazyLoading: boolean;
    /** Enable dead code elimination */
    deadCodeElimination: boolean;
    /** Bundle size optimization */
    bundleOptimization: boolean;
  };
  /** Development settings */
  development: {
    /** Source maps */
    sourceMaps: boolean;
    /** Hot module replacement */
    hmr: boolean;
    /** Debug information */
    debugInfo: boolean;
    /** Watch mode optimizations */
    fastRefresh: boolean;
  };
  /** Production settings */
  production: {
    /** Minification */
    minify: boolean;
    /** Compression */
    compress: boolean;
    /** Asset optimization */
    optimizeAssets: boolean;
    /** Remove debug code */
    removeDebugCode: boolean;
  };
}

export interface ReactConfig extends BaseFrameworkConfig {
  framework: 'react';
  frameworkSpecific: {
    /** React Server Components support */
    serverComponents: {
      enabled: boolean;
      extractServerCSS: boolean;
      clientBoundary: boolean;
    };
    /** JSX pragma settings */
    jsxPragma: {
      pragma: string;
      pragmaFrag: string;
      importSource?: string;
    };
    /** React-specific optimizations */
    optimizations: {
      /** Preserve component names in production */
      displayNames: boolean;
      /** Optimize React DevTools */
      devtools: boolean;
      /** Component tree shaking */
      componentTreeShaking: boolean;
    };
  };
}

export interface VueConfig extends BaseFrameworkConfig {
  framework: 'vue';
  frameworkSpecific: {
    /** Vue version */
    version: '2' | '3';
    /** Composition API support */
    compositionApi: boolean;
    /** Scoped styles handling */
    scopedStyles: {
      enabled: boolean;
      extractToFiles: boolean;
      generateSourceMaps: boolean;
    };
    /** Vue-specific optimizations */
    optimizations: {
      /** Template optimization */
      templateOptimization: boolean;
      /** Compiler optimizations */
      compilerOptimizations: boolean;
      /** Reactivity system optimizations */
      reactivityOptimizations: boolean;
    };
  };
}

export interface AngularConfig extends BaseFrameworkConfig {
  framework: 'angular';
  frameworkSpecific: {
    /** Angular version */
    version: string;
    /** ViewEncapsulation strategy */
    viewEncapsulation: 'Emulated' | 'None' | 'ShadowDom';
    /** Angular CLI integration */
    cliIntegration: {
      enabled: boolean;
      buildOptimizer: boolean;
      extractCss: boolean;
    };
    /** Angular-specific optimizations */
    optimizations: {
      /** Ivy renderer optimizations */
      ivyOptimizations: boolean;
      /** Zone.js optimizations */
      zoneOptimizations: boolean;
      /** Standalone components */
      standaloneComponents: boolean;
    };
  };
}

export type FrameworkConfig = ReactConfig | VueConfig | AngularConfig;

export interface ConfigPreset {
  /** Preset identifier */
  id: string;
  /** Preset name */
  name: string;
  /** Preset description */
  description: string;
  /** Framework configuration */
  config: FrameworkConfig;
  /** Prerequisites */
  prerequisites: string[];
  /** Recommended CSS-in-JS libraries */
  recommendedCSSInJS: CSSInJSLibrary[];
  /** Compatibility matrix */
  compatibility: {
    /** Node.js versions */
    node: string[];
    /** Package manager compatibility */
    packageManagers: string[];
    /** Build tool compatibility */
    buildTools: string[];
  };
}

export interface ConfigOverride {
  /** Override target path (dot notation) */
  path: string;
  /** Override value */
  value: any;
  /** Override mode */
  mode: 'replace' | 'merge' | 'append';
  /** Condition for applying override */
  condition?: (config: FrameworkConfig, context: any) => boolean;
}

export interface CustomConfig {
  /** Base preset to extend */
  extends?: string;
  /** Configuration overrides */
  overrides: ConfigOverride[];
  /** Custom validation rules */
  validation?: {
    rules: Array<{
      path: string;
      validator: (value: any) => boolean;
      message: string;
    }>;
  };
}

export interface ValidationResult {
  /** Validation success */
  valid: boolean;
  /** Validation errors */
  errors: Array<{
    path: string;
    message: string;
    value: any;
  }>;
  /** Validation warnings */
  warnings: Array<{
    path: string;
    message: string;
    value: any;
  }>;
  /** Suggested fixes */
  suggestions: Array<{
    path: string;
    description: string;
    fix: any;
  }>;
}

/**
 * Default React configuration presets
 */
export const REACT_PRESETS: Record<string, ConfigPreset> = {
  'react-cra': {
    id: 'react-cra',
    name: 'Create React App',
    description: 'Optimized configuration for Create React App projects',
    config: {
      framework: 'react',
      name: 'React CRA',
      description: 'Create React App configuration',
      supportedBuildSystems: ['Create React App', 'Webpack'],
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
    recommendedCSSInJS: ['styled-components', '@emotion/react'],
    compatibility: {
      node: ['>=14.0.0'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildTools: ['webpack', 'babel'],
    },
  },

  'react-nextjs': {
    id: 'react-nextjs',
    name: 'Next.js',
    description: 'Optimized configuration for Next.js projects with SSR support',
    config: {
      framework: 'react',
      name: 'React Next.js',
      description: 'Next.js configuration with SSR',
      supportedBuildSystems: ['Next.js', 'Webpack'],
      ssrCompatible: true,
      cssInJs: {
        extractStatic: true,
        optimizeRuntime: true,
        generateSourceMaps: false,
        removeDuplicates: true,
        minimizeSize: true,
        preserveDebugInfo: false,
        enableHMR: true,
        customThemeExtraction: true,
      },
      frameworkSpecific: {
        serverComponents: {
          enabled: true,
          extractServerCSS: true,
          clientBoundary: true,
        },
        jsxPragma: {
          pragma: 'React.createElement',
          pragmaFrag: 'React.Fragment',
        },
        optimizations: {
          displayNames: false,
          devtools: false,
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
    prerequisites: ['react', 'react-dom', 'next'],
    recommendedCSSInJS: ['styled-jsx', '@emotion/react', 'styled-components'],
    compatibility: {
      node: ['>=14.0.0'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildTools: ['next', 'webpack'],
    },
  },

  'react-vite': {
    id: 'react-vite',
    name: 'React + Vite',
    description: 'Optimized configuration for React projects using Vite',
    config: {
      framework: 'react',
      name: 'React Vite',
      description: 'React with Vite bundler',
      supportedBuildSystems: ['Vite', 'Rollup'],
      ssrCompatible: true,
      cssInJs: {
        extractStatic: true,
        optimizeRuntime: true,
        generateSourceMaps: true,
        removeDuplicates: true,
        minimizeSize: false,
        preserveDebugInfo: true,
        enableHMR: true,
        customThemeExtraction: true,
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
          importSource: '@emotion/react',
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
    prerequisites: ['react', 'react-dom', 'vite'],
    recommendedCSSInJS: ['@emotion/react', 'stitches', 'vanilla-extract'],
    compatibility: {
      node: ['>=14.0.0'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildTools: ['vite', 'rollup'],
    },
  },
};

/**
 * Default Vue configuration presets
 */
export const VUE_PRESETS: Record<string, ConfigPreset> = {
  'vue-cli': {
    id: 'vue-cli',
    name: 'Vue CLI',
    description: 'Optimized configuration for Vue CLI projects',
    config: {
      framework: 'vue',
      name: 'Vue CLI',
      description: 'Vue CLI configuration',
      supportedBuildSystems: ['Vue CLI', 'Webpack'],
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
    },
    prerequisites: ['vue'],
    recommendedCSSInJS: ['vue-styled-components', '@emotion/vue'],
    compatibility: {
      node: ['>=14.0.0'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildTools: ['webpack', 'babel'],
    },
  },

  'vue-vite': {
    id: 'vue-vite',
    name: 'Vue + Vite',
    description: 'Optimized configuration for Vue projects using Vite',
    config: {
      framework: 'vue',
      name: 'Vue Vite',
      description: 'Vue with Vite bundler',
      supportedBuildSystems: ['Vite', 'Rollup'],
      ssrCompatible: true,
      cssInJs: {
        extractStatic: true,
        optimizeRuntime: true,
        generateSourceMaps: true,
        removeDuplicates: true,
        minimizeSize: false,
        preserveDebugInfo: true,
        enableHMR: true,
        customThemeExtraction: true,
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
    },
    prerequisites: ['vue', 'vite'],
    recommendedCSSInJS: ['vue-styled-components', '@emotion/vue', 'stitches'],
    compatibility: {
      node: ['>=14.0.0'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildTools: ['vite', 'rollup'],
    },
  },

  'vue-nuxt': {
    id: 'vue-nuxt',
    name: 'Nuxt.js',
    description: 'Optimized configuration for Nuxt.js projects with SSR support',
    config: {
      framework: 'vue',
      name: 'Vue Nuxt.js',
      description: 'Nuxt.js configuration with SSR',
      supportedBuildSystems: ['Nuxt.js', 'Webpack', 'Vite'],
      ssrCompatible: true,
      cssInJs: {
        extractStatic: true,
        optimizeRuntime: true,
        generateSourceMaps: false,
        removeDuplicates: true,
        minimizeSize: true,
        preserveDebugInfo: false,
        enableHMR: true,
        customThemeExtraction: true,
      },
      frameworkSpecific: {
        version: '3',
        compositionApi: true,
        scopedStyles: {
          enabled: true,
          extractToFiles: true,
          generateSourceMaps: false,
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
    },
    prerequisites: ['vue', 'nuxt'],
    recommendedCSSInJS: ['vue-styled-components', '@emotion/vue'],
    compatibility: {
      node: ['>=14.0.0'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildTools: ['nuxt', 'webpack', 'vite'],
    },
  },
};

/**
 * Default Angular configuration presets
 */
export const ANGULAR_PRESETS: Record<string, ConfigPreset> = {
  'angular-cli': {
    id: 'angular-cli',
    name: 'Angular CLI',
    description: 'Optimized configuration for Angular CLI projects',
    config: {
      framework: 'angular',
      name: 'Angular CLI',
      description: 'Angular CLI configuration',
      supportedBuildSystems: ['Angular CLI', 'Webpack'],
      ssrCompatible: true,
      cssInJs: {
        extractStatic: true,
        optimizeRuntime: true,
        generateSourceMaps: true,
        removeDuplicates: true,
        minimizeSize: false,
        preserveDebugInfo: true,
        enableHMR: false, // Angular CLI doesn't support HMR by default
        customThemeExtraction: true,
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
        hmr: false,
        debugInfo: true,
        fastRefresh: false,
      },
      production: {
        minify: true,
        compress: true,
        optimizeAssets: true,
        removeDebugCode: true,
      },
    },
    prerequisites: ['@angular/core', '@angular/cli'],
    recommendedCSSInJS: ['@angular/material', 'ng-zorro-antd'],
    compatibility: {
      node: ['>=16.14.0'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildTools: ['angular-cli', 'webpack'],
    },
  },

  'angular-universal': {
    id: 'angular-universal',
    name: 'Angular Universal',
    description: 'Optimized configuration for Angular Universal SSR projects',
    config: {
      framework: 'angular',
      name: 'Angular Universal',
      description: 'Angular Universal SSR configuration',
      supportedBuildSystems: ['Angular CLI', 'Webpack'],
      ssrCompatible: true,
      cssInJs: {
        extractStatic: true,
        optimizeRuntime: true,
        generateSourceMaps: false,
        removeDuplicates: true,
        minimizeSize: true,
        preserveDebugInfo: false,
        enableHMR: false,
        customThemeExtraction: true,
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
        hmr: false,
        debugInfo: true,
        fastRefresh: false,
      },
      production: {
        minify: true,
        compress: true,
        optimizeAssets: true,
        removeDebugCode: true,
      },
    },
    prerequisites: ['@angular/core', '@angular/cli', '@nguniversal/express-engine'],
    recommendedCSSInJS: ['@angular/material', 'ng-zorro-antd'],
    compatibility: {
      node: ['>=16.14.0'],
      packageManagers: ['npm', 'yarn', 'pnpm'],
      buildTools: ['angular-cli', 'webpack'],
    },
  },
};

/**
 * All available configuration presets
 */
export const ALL_PRESETS: Record<string, ConfigPreset> = {
  ...REACT_PRESETS,
  ...VUE_PRESETS,
  ...ANGULAR_PRESETS,
};

/**
 * Configuration preset manager
 */
export class ConfigPresetManager extends EventEmitter {
  private presets: Map<string, ConfigPreset> = new Map();
  private customConfigs: Map<string, CustomConfig> = new Map();

  constructor() {
    super();
    this.loadDefaultPresets();
  }

  /**
   * Load default presets
   */
  private loadDefaultPresets(): void {
    for (const [id, preset] of Object.entries(ALL_PRESETS)) {
      this.presets.set(id, preset);
    }

    this.emit('presetsLoaded', {
      count: this.presets.size,
      presets: Array.from(this.presets.keys()),
    });
  }

  /**
   * Get all available presets
   */
  getAvailablePresets(): ConfigPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get presets for a specific framework
   */
  getFrameworkPresets(framework: 'react' | 'vue' | 'angular'): ConfigPreset[] {
    return Array.from(this.presets.values()).filter(
      (preset) => preset.config.framework === framework
    );
  }

  /**
   * Get a specific preset by ID
   */
  getPreset(id: string): ConfigPreset | undefined {
    return this.presets.get(id);
  }

  /**
   * Register a custom preset
   */
  registerPreset(preset: ConfigPreset): void {
    // Validate preset before registration
    const validation = this.validatePreset(preset);
    if (!validation.valid) {
      throw new ConfigValidationError(
        `Invalid preset configuration: ${validation.errors.map((e) => e.message).join(', ')}`,
        validation.errors
      );
    }

    this.presets.set(preset.id, preset);
    this.emit('presetRegistered', { preset });
  }

  /**
   * Apply configuration overrides
   */
  applyOverrides(baseConfig: FrameworkConfig, overrides: ConfigOverride[]): FrameworkConfig {
    let config = JSON.parse(JSON.stringify(baseConfig)); // Deep clone

    for (const override of overrides) {
      // Check condition if provided
      if (override.condition && !override.condition(config, {})) {
        continue;
      }

      // Apply override based on mode
      config = this.applyOverride(config, override);
    }

    return config;
  }

  /**
   * Apply a single override
   */
  private applyOverride(config: FrameworkConfig, override: ConfigOverride): FrameworkConfig {
    const pathParts = override.path.split('.');
    let current: any = config;

    // Navigate to the target location
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    const finalKey = pathParts[pathParts.length - 1];

    switch (override.mode) {
      case 'replace':
        current[finalKey] = override.value;
        break;
      case 'merge':
        if (typeof current[finalKey] === 'object' && typeof override.value === 'object') {
          current[finalKey] = { ...current[finalKey], ...override.value };
        } else {
          current[finalKey] = override.value;
        }
        break;
      case 'append':
        if (Array.isArray(current[finalKey])) {
          current[finalKey].push(
            ...(Array.isArray(override.value) ? override.value : [override.value])
          );
        } else {
          current[finalKey] = override.value;
        }
        break;
    }

    return config;
  }

  /**
   * Create configuration from preset with overrides
   */
  createConfig(
    presetId: string,
    overrides: ConfigOverride[] = [],
    customConfig?: CustomConfig
  ): FrameworkConfig {
    const preset = this.getPreset(presetId);
    if (!preset) {
      throw new ConfigNotFoundError(`Preset not found: ${presetId}`);
    }

    let config = preset.config;

    // Apply preset overrides first
    if (overrides.length > 0) {
      config = this.applyOverrides(config, overrides);
    }

    // Apply custom configuration overrides
    if (customConfig) {
      config = this.applyOverrides(config, customConfig.overrides);
    }

    // Validate final configuration
    const validation = this.validateConfig(config, customConfig?.validation);
    if (!validation.valid) {
      throw new ConfigValidationError(
        `Invalid configuration: ${validation.errors.map((e) => e.message).join(', ')}`,
        validation.errors
      );
    }

    this.emit('configCreated', { presetId, config, validation });

    return config;
  }

  /**
   * Validate a configuration preset
   */
  validatePreset(preset: ConfigPreset): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    const suggestions: ValidationResult['suggestions'] = [];

    // Validate required fields
    if (!preset.id) {
      errors.push({ path: 'id', message: 'Preset ID is required', value: preset.id });
    }

    if (!preset.name) {
      errors.push({ path: 'name', message: 'Preset name is required', value: preset.name });
    }

    if (!preset.config) {
      errors.push({
        path: 'config',
        message: 'Preset configuration is required',
        value: preset.config,
      });
    }

    // Validate configuration structure
    if (preset.config) {
      const configValidation = this.validateConfig(preset.config);
      errors.push(...configValidation.errors);
      warnings.push(...configValidation.warnings);
      suggestions.push(...configValidation.suggestions);
    }

    // Validate compatibility
    if (preset.compatibility) {
      const compatibility = preset.compatibility;

      if (compatibility.node && compatibility.node.length === 0) {
        warnings.push({
          path: 'compatibility.node',
          message: 'No Node.js versions specified',
          value: compatibility.node,
        });
      }

      if (compatibility.buildTools && compatibility.buildTools.length === 0) {
        warnings.push({
          path: 'compatibility.buildTools',
          message: 'No build tools specified',
          value: compatibility.buildTools,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate a framework configuration
   */
  validateConfig(
    config: FrameworkConfig,
    customValidation?: CustomConfig['validation']
  ): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    const suggestions: ValidationResult['suggestions'] = [];

    // Validate required fields
    if (!config.framework) {
      errors.push({ path: 'framework', message: 'Framework is required', value: config.framework });
    }

    if (!config.name) {
      errors.push({ path: 'name', message: 'Configuration name is required', value: config.name });
    }

    // Validate framework-specific fields
    switch (config.framework) {
      case 'react':
        this.validateReactConfig(config as ReactConfig, errors, warnings, suggestions);
        break;
      case 'vue':
        this.validateVueConfig(config as VueConfig, errors, warnings, suggestions);
        break;
      case 'angular':
        this.validateAngularConfig(config as AngularConfig, errors, warnings, suggestions);
        break;
    }

    // Apply custom validation rules
    if (customValidation?.rules) {
      for (const rule of customValidation.rules) {
        const value = this.getValueByPath(config, rule.path);
        if (!rule.validator(value)) {
          errors.push({ path: rule.path, message: rule.message, value });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate React-specific configuration
   */
  private validateReactConfig(
    config: ReactConfig,
    errors: ValidationResult['errors'],
    warnings: ValidationResult['warnings'],
    suggestions: ValidationResult['suggestions']
  ): void {
    const specific = config.frameworkSpecific;

    // Validate JSX pragma
    if (specific.jsxPragma) {
      if (!specific.jsxPragma.pragma) {
        errors.push({
          path: 'frameworkSpecific.jsxPragma.pragma',
          message: 'JSX pragma is required',
          value: specific.jsxPragma.pragma,
        });
      }

      if (!specific.jsxPragma.pragmaFrag) {
        errors.push({
          path: 'frameworkSpecific.jsxPragma.pragmaFrag',
          message: 'JSX pragma fragment is required',
          value: specific.jsxPragma.pragmaFrag,
        });
      }
    }

    // Validate server components configuration
    if (specific.serverComponents?.enabled && !config.ssrCompatible) {
      warnings.push({
        path: 'frameworkSpecific.serverComponents.enabled',
        message: 'Server components enabled but SSR compatibility is false',
        value: specific.serverComponents.enabled,
      });

      suggestions.push({
        path: 'ssrCompatible',
        description: 'Enable SSR compatibility for server components',
        fix: true,
      });
    }
  }

  /**
   * Validate Vue-specific configuration
   */
  private validateVueConfig(
    config: VueConfig,
    errors: ValidationResult['errors'],
    warnings: ValidationResult['warnings'],
    suggestions: ValidationResult['suggestions']
  ): void {
    const specific = config.frameworkSpecific;

    // Validate Vue version
    if (!['2', '3'].includes(specific.version)) {
      errors.push({
        path: 'frameworkSpecific.version',
        message: 'Vue version must be "2" or "3"',
        value: specific.version,
      });
    }

    // Validate Composition API with Vue 2
    if (specific.version === '2' && specific.compositionApi) {
      warnings.push({
        path: 'frameworkSpecific.compositionApi',
        message: 'Composition API in Vue 2 requires @vue/composition-api plugin',
        value: specific.compositionApi,
      });
    }

    // Validate scoped styles
    if (specific.scopedStyles?.extractToFiles && !config.cssInJs.extractStatic) {
      suggestions.push({
        path: 'cssInJs.extractStatic',
        description: 'Enable static CSS extraction for scoped styles',
        fix: true,
      });
    }
  }

  /**
   * Validate Angular-specific configuration
   */
  private validateAngularConfig(
    config: AngularConfig,
    errors: ValidationResult['errors'],
    warnings: ValidationResult['warnings'],
    suggestions: ValidationResult['suggestions']
  ): void {
    const specific = config.frameworkSpecific;

    // Validate Angular version
    if (!specific.version) {
      errors.push({
        path: 'frameworkSpecific.version',
        message: 'Angular version is required',
        value: specific.version,
      });
    }

    // Validate ViewEncapsulation
    const validEncapsulation = ['Emulated', 'None', 'ShadowDom'];
    if (!validEncapsulation.includes(specific.viewEncapsulation)) {
      errors.push({
        path: 'frameworkSpecific.viewEncapsulation',
        message: `ViewEncapsulation must be one of: ${validEncapsulation.join(', ')}`,
        value: specific.viewEncapsulation,
      });
    }

    // Validate CLI integration
    if (specific.cliIntegration?.enabled && !config.supportedBuildSystems.includes('Angular CLI')) {
      warnings.push({
        path: 'frameworkSpecific.cliIntegration.enabled',
        message: 'CLI integration enabled but Angular CLI not in supported build systems',
        value: specific.cliIntegration.enabled,
      });
    }

    // Validate Ivy optimizations
    if (!specific.optimizations.ivyOptimizations) {
      suggestions.push({
        path: 'frameworkSpecific.optimizations.ivyOptimizations',
        description: 'Enable Ivy optimizations for better performance',
        fix: true,
      });
    }
  }

  /**
   * Get value by dot notation path
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Recommend preset based on framework info
   */
  recommendPreset(frameworkInfo: FrameworkInfo): ConfigPreset | null {
    const framework = frameworkInfo.type;
    const buildSystem = frameworkInfo.metadata.buildSystem?.toLowerCase();

    // Get framework-specific presets
    const frameworkPresets = this.getFrameworkPresets(framework);

    if (frameworkPresets.length === 0) {
      return null;
    }

    // Try to match based on build system
    if (buildSystem) {
      const matchingPreset = frameworkPresets.find((preset) =>
        preset.compatibility.buildTools.some(
          (tool) =>
            tool.toLowerCase().includes(buildSystem) || buildSystem.includes(tool.toLowerCase())
        )
      );

      if (matchingPreset) {
        return matchingPreset;
      }
    }

    // Check for SSR requirement
    if (frameworkInfo.metadata.hasSSR) {
      const ssrPreset = frameworkPresets.find((preset) => preset.config.ssrCompatible);
      if (ssrPreset) {
        return ssrPreset;
      }
    }

    // Return the first preset as default
    return frameworkPresets[0];
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  public errors: ValidationResult['errors'];

  constructor(message: string, errors: ValidationResult['errors']) {
    super(message);
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

/**
 * Configuration not found error
 */
export class ConfigNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Factory function to create preset manager
 */
export function createConfigPresetManager(): ConfigPresetManager {
  return new ConfigPresetManager();
}

/**
 * Get recommended configuration for framework
 */
export function getRecommendedConfig(frameworkInfo: FrameworkInfo): FrameworkConfig | null {
  const manager = createConfigPresetManager();
  const preset = manager.recommendPreset(frameworkInfo);

  if (!preset) {
    return null;
  }

  return manager.createConfig(preset.id);
}
