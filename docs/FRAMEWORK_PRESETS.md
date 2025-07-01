# Framework Configuration Presets

## Overview

TW-Enigma provides pre-configured optimization settings for popular frontend frameworks. These presets are automatically applied based on framework detection and can be customized or extended to meet specific project requirements.

## Table of Contents

1. [Available Presets](#available-presets)
2. [React Presets](#react-presets)
3. [Vue Presets](#vue-presets)
4. [Angular Presets](#angular-presets)
5. [Custom Presets](#custom-presets)
6. [Configuration Overrides](#configuration-overrides)
7. [API Reference](#api-reference)
8. [Migration Guide](#migration-guide)

## Available Presets

### Framework Support Matrix

| Framework | Preset ID | Build System | SSR Support | CSS-in-JS | Status |
|-----------|-----------|--------------|-------------|-----------|--------|
| React | `react-cra` | Create React App | ❌ | ✅ | Stable |
| React | `react-nextjs` | Next.js | ✅ | ✅ | Stable |
| React | `react-vite` | Vite | ✅ | ✅ | Stable |
| Vue | `vue-cli` | Vue CLI | ❌ | ✅ | Stable |
| Vue | `vue-vite` | Vite | ✅ | ✅ | Stable |
| Vue | `vue-nuxt` | Nuxt.js | ✅ | ✅ | Stable |
| Angular | `angular-cli` | Angular CLI | ✅ | ✅ | Stable |
| Angular | `angular-universal` | Angular Universal | ✅ | ✅ | Stable |

### Automatic Preset Selection

TW-Enigma automatically selects the most appropriate preset based on:

1. **Framework Detection**: Identified framework type
2. **Build System**: Detected build tool (webpack, Vite, etc.)
3. **SSR Requirements**: Server-side rendering capabilities
4. **Project Structure**: File organization and configuration

```javascript
// Automatic selection example
const detectedFramework = {
  type: 'react',
  buildSystem: 'next',
  hasSSR: true
};

// Results in: react-nextjs preset
```

## React Presets

### react-cra (Create React App)

Optimized for standard Create React App projects.

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-cra',
  // Additional customization
};
```

**Configuration Details:**

```javascript
{
  framework: 'react',
  name: 'React CRA',
  supportedBuildSystems: ['Create React App', 'Webpack'],
  ssrCompatible: false,
  
  // CSS-in-JS optimization
  cssInJs: {
    extractStatic: true,
    optimizeRuntime: true,
    generateSourceMaps: true,
    removeDuplicates: true,
    minimizeSize: false,
    preserveDebugInfo: true,
    enableHMR: true,
  },
  
  // React-specific settings
  frameworkSpecific: {
    serverComponents: {
      enabled: false,
      extractServerCSS: false,
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
  
  // Performance settings
  performance: {
    treeShaking: true,
    codeSplitting: true,
    lazyLoading: true,
    deadCodeElimination: true,
    bundleOptimization: true,
  },
  
  // Development settings
  development: {
    sourceMaps: true,
    hmr: true,
    debugInfo: true,
    fastRefresh: true,
  },
  
  // Production settings
  production: {
    minify: true,
    compress: true,
    optimizeAssets: true,
    removeDebugCode: true,
  },
}
```

**Recommended CSS-in-JS Libraries:**
- `styled-components`
- `@emotion/react`

**Prerequisites:**
- `react` >= 16.8.0
- `react-dom` >= 16.8.0

### react-nextjs (Next.js)

Optimized for Next.js applications with SSR support.

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-nextjs',
  // Next.js specific overrides
  framework: {
    serverComponents: {
      extractServerCSS: true,
    },
  },
};
```

**Key Differences from CRA:**
- Server-side rendering compatible
- Server components support
- Optimized CSS extraction for SSR
- Enhanced production minification
- Built-in theme extraction

**Configuration Details:**

```javascript
{
  ssrCompatible: true,
  
  cssInJs: {
    minimizeSize: true,
    preserveDebugInfo: false,
    customThemeExtraction: true,
  },
  
  frameworkSpecific: {
    serverComponents: {
      enabled: true,
      extractServerCSS: true,
      clientBoundary: true,
    },
    optimizations: {
      displayNames: false, // Disabled in production
      devtools: false,
    },
  },
}
```

**Recommended CSS-in-JS Libraries:**
- `styled-jsx` (built-in)
- `@emotion/react`
- `styled-components`

**Prerequisites:**
- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `next` >= 13.0.0

### react-vite (React + Vite)

Optimized for React applications using Vite.

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-vite',
  // Vite-specific optimizations
  development: {
    fastRefresh: true,
    hmr: true,
  },
};
```

**Key Features:**
- Lightning-fast HMR
- ESM-based development
- Optimized for modern browsers
- Enhanced emotion integration

**Configuration Details:**

```javascript
{
  supportedBuildSystems: ['Vite', 'Rollup'],
  ssrCompatible: true,
  
  frameworkSpecific: {
    jsxPragma: {
      importSource: '@emotion/react',
    },
  },
  
  cssInJs: {
    customThemeExtraction: true,
  },
}
```

**Recommended CSS-in-JS Libraries:**
- `@emotion/react`
- `stitches`
- `vanilla-extract`

**Prerequisites:**
- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `vite` >= 4.0.0

## Vue Presets

### vue-cli (Vue CLI)

Standard configuration for Vue CLI projects.

```javascript
// tw-enigma.config.js
export default {
  preset: 'vue-cli',
  // Vue-specific customization
};
```

**Configuration Details:**

```javascript
{
  framework: 'vue',
  supportedBuildSystems: ['Vue CLI', 'Webpack'],
  ssrCompatible: false,
  
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
}
```

**Prerequisites:**
- `vue` >= 3.0.0

### vue-vite (Vue + Vite)

Optimized for Vue applications using Vite.

```javascript
// tw-enigma.config.js
export default {
  preset: 'vue-vite',
  // Vite + Vue optimizations
  development: {
    hmr: true,
    fastRefresh: true,
  },
};
```

**Key Features:**
- Fast development server
- Vue 3 Composition API support
- Optimized scoped styles
- Modern build optimizations

**Prerequisites:**
- `vue` >= 3.0.0
- `vite` >= 4.0.0

### vue-nuxt (Nuxt.js)

Full-stack Vue framework with SSR/SSG support.

```javascript
// tw-enigma.config.js
export default {
  preset: 'vue-nuxt',
  // Nuxt.js specific settings
  framework: {
    scopedStyles: {
      generateSourceMaps: false, // Optimized for production
    },
  },
};
```

**Key Features:**
- Universal rendering
- Automatic routing
- Built-in optimization
- Module ecosystem

**Configuration Details:**

```javascript
{
  ssrCompatible: true,
  supportedBuildSystems: ['Nuxt.js', 'Webpack', 'Vite'],
  
  cssInJs: {
    minimizeSize: true,
    preserveDebugInfo: false,
    customThemeExtraction: true,
  },
}
```

**Prerequisites:**
- `vue` >= 3.0.0
- `nuxt` >= 3.0.0

## Angular Presets

### angular-cli (Angular CLI)

Standard Angular CLI configuration.

```javascript
// tw-enigma.config.js
export default {
  preset: 'angular-cli',
  // Angular-specific settings
};
```

**Configuration Details:**

```javascript
{
  framework: 'angular',
  supportedBuildSystems: ['Angular CLI', 'Webpack'],
  ssrCompatible: true,
  
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
  
  development: {
    hmr: false, // Not supported by default
    fastRefresh: false,
  },
}
```

**Prerequisites:**
- `@angular/core` >= 16.0.0
- `@angular/cli` >= 16.0.0

### angular-universal (Angular Universal)

SSR-enabled Angular applications.

```javascript
// tw-enigma.config.js
export default {
  preset: 'angular-universal',
  // Universal-specific optimizations
  production: {
    removeDebugCode: true,
    optimizeAssets: true,
  },
};
```

**Key Features:**
- Server-side rendering
- SEO optimization
- Performance enhancements
- Prerendering support

**Prerequisites:**
- `@angular/core` >= 16.0.0
- `@angular/cli` >= 16.0.0
- `@nguniversal/express-engine`

## Custom Presets

### Creating Custom Presets

Define your own presets for specific project requirements:

```javascript
// tw-enigma.config.js
import { definePreset } from '@tw-enigma/core';

const customReactPreset = definePreset({
  id: 'react-enterprise',
  name: 'React Enterprise',
  description: 'Enterprise React configuration with advanced optimizations',
  
  extends: 'react-cra', // Base preset
  
  config: {
    performance: {
      bundleOptimization: true,
      advancedTreeShaking: true,
    },
    
    security: {
      cspIntegration: true,
      contentHashVerification: true,
    },
    
    monitoring: {
      performanceTracking: true,
      errorBoundaries: true,
    },
  },
  
  prerequisites: ['react', 'react-dom', '@enterprise/monitoring'],
  
  compatibility: {
    node: ['>=18.0.0'],
    packageManagers: ['npm', 'yarn', 'pnpm'],
    buildTools: ['webpack', 'vite'],
  },
});

export default {
  presets: [customReactPreset],
  preset: 'react-enterprise',
};
```

### Preset Validation

Custom presets are automatically validated:

```javascript
const preset = {
  id: 'my-preset',
  config: {
    framework: 'react',
    // Invalid configuration will throw validation error
    performance: {
      invalidOption: true, // Error: Unknown option
    },
  },
};
```

### Sharing Presets

Package and share presets as npm modules:

```javascript
// @company/tw-enigma-presets
export const companyReactPreset = definePreset({
  id: 'company-react',
  // ... preset configuration
});

// Consumer usage
import { companyReactPreset } from '@company/tw-enigma-presets';

export default {
  presets: [companyReactPreset],
  preset: 'company-react',
};
```

## Configuration Overrides

### Simple Overrides

Override specific preset values:

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-nextjs',
  
  // Override specific settings
  overrides: [
    {
      path: 'development.sourceMaps',
      value: false,
      mode: 'replace',
    },
    {
      path: 'cssInJs.minimizeSize',
      value: false,
      mode: 'replace',
    },
  ],
};
```

### Complex Overrides

Use merge and append modes for complex modifications:

```javascript
export default {
  preset: 'vue-nuxt',
  
  overrides: [
    // Merge object properties
    {
      path: 'performance',
      value: {
        experimentalOptimizations: true,
        customBundling: true,
      },
      mode: 'merge',
    },
    
    // Append to arrays
    {
      path: 'supportedBuildSystems',
      value: ['Custom Build Tool'],
      mode: 'append',
    },
  ],
};
```

### Conditional Overrides

Apply overrides based on conditions:

```javascript
export default {
  preset: 'react-cra',
  
  overrides: [
    {
      path: 'cssInJs.minimizeSize',
      value: true,
      mode: 'replace',
      condition: (config, context) => {
        return process.env.NODE_ENV === 'production';
      },
    },
  ],
};
```

### Environment-Specific Overrides

```javascript
export default {
  preset: 'angular-cli',
  
  environments: {
    development: {
      overrides: [
        {
          path: 'development.debugInfo',
          value: true,
          mode: 'replace',
        },
      ],
    },
    production: {
      overrides: [
        {
          path: 'production.removeDebugCode',
          value: true,
          mode: 'replace',
        },
      ],
    },
  },
};
```

## API Reference

### ConfigPresetManager

```typescript
class ConfigPresetManager {
  // Get all available presets
  getAvailablePresets(): ConfigPreset[];
  
  // Get presets for specific framework
  getFrameworkPresets(framework: 'react' | 'vue' | 'angular'): ConfigPreset[];
  
  // Get specific preset
  getPreset(id: string): ConfigPreset | undefined;
  
  // Register custom preset
  registerPreset(preset: ConfigPreset): void;
  
  // Create configuration from preset
  createConfig(
    presetId: string,
    overrides?: ConfigOverride[],
    customConfig?: CustomConfig
  ): FrameworkConfig;
  
  // Recommend preset based on framework info
  recommendPreset(frameworkInfo: FrameworkInfo): ConfigPreset | null;
  
  // Validate configuration
  validateConfig(config: FrameworkConfig): ValidationResult;
}
```

### Types

```typescript
interface ConfigPreset {
  id: string;
  name: string;
  description: string;
  config: FrameworkConfig;
  prerequisites: string[];
  recommendedCSSInJS: CSSInJSLibrary[];
  compatibility: {
    node: string[];
    packageManagers: string[];
    buildTools: string[];
  };
}

interface ConfigOverride {
  path: string;
  value: any;
  mode: 'replace' | 'merge' | 'append';
  condition?: (config: FrameworkConfig, context: any) => boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}
```

### Usage Examples

```typescript
import { ConfigPresetManager } from '@tw-enigma/core';

const manager = new ConfigPresetManager();

// Get recommended preset
const frameworkInfo = await detectFramework('./my-project');
const preset = manager.recommendPreset(frameworkInfo);

// Create configuration with overrides
const config = manager.createConfig(preset.id, [
  {
    path: 'development.sourceMaps',
    value: false,
    mode: 'replace',
  },
]);

// Validate configuration
const validation = manager.validateConfig(config);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

## Migration Guide

### Upgrading Presets

When upgrading TW-Enigma versions, preset configurations may change:

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-nextjs',
  
  // Pin to specific preset version for stability
  presetVersion: '1.2.0',
  
  // Or allow automatic updates
  autoUpgrade: true,
};
```

### Deprecation Handling

Handle deprecated preset options:

```javascript
export default {
  preset: 'vue-cli',
  
  // Handle deprecated options
  migration: {
    handleDeprecated: 'warn', // 'ignore', 'warn', 'error'
    replacements: {
      'oldOption': 'newOption',
    },
  },
};
```

### Breaking Changes

Version-specific breaking changes are documented in:

- [CHANGELOG.md](../CHANGELOG.md)
- [Migration Guides](./migration/)
- [Breaking Changes](./breaking-changes.md)

---

Framework presets provide a solid foundation for optimizing your project while maintaining flexibility for customization. Choose the appropriate preset for your framework and build system, then customize as needed for your specific requirements.