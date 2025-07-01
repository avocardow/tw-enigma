# Framework Setup Guide

## Overview

This comprehensive guide walks you through setting up TW-Enigma with different frontend frameworks. Each framework has specific integration steps and configuration options to ensure optimal performance.

## Table of Contents

1. [React Setup](#react-setup)
2. [Vue Setup](#vue-setup)
3. [Angular Setup](#angular-setup)
4. [Next.js Setup](#nextjs-setup)
5. [Nuxt.js Setup](#nuxtjs-setup)
6. [Vite Integration](#vite-integration)
7. [Build Tool Configuration](#build-tool-configuration)
8. [Verification and Testing](#verification-and-testing)

## React Setup

### Create React App

#### Step 1: Install Dependencies

```bash
# Install TW-Enigma
npm install @tw-enigma/core @tw-enigma/react

# Install peer dependencies
npm install tailwindcss postcss autoprefixer

# Install build integration
npm install @tw-enigma/webpack-plugin
```

#### Step 2: Initialize Configuration

```bash
# Initialize TW-Enigma configuration
npx tw-enigma init

# Initialize Tailwind CSS
npx tailwindcss init -p
```

#### Step 3: Configure TW-Enigma

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-cra',
  
  // Input files to analyze
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  
  // Optimization settings
  optimization: {
    strategy: 'atomic',
    threshold: 2,
    enableTreeShaking: true,
  },
  
  // Development settings
  development: {
    enableHMR: true,
    sourceMaps: true,
    fastRefresh: true,
  },
  
  // Production settings
  production: {
    minify: true,
    removeUnused: true,
    generateReport: true,
  },
};
```

#### Step 4: Configure Webpack (if ejected)

```javascript
// webpack.config.js
const { TWEnigmaPlugin } = require('@tw-enigma/webpack-plugin');

module.exports = {
  // ... existing config
  
  plugins: [
    // ... existing plugins
    new TWEnigmaPlugin({
      configFile: './tw-enigma.config.js',
    }),
  ],
};
```

#### Step 5: Update Package Scripts

```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build && tw-enigma optimize",
    "analyze": "tw-enigma analyze",
    "optimize": "tw-enigma optimize --verbose"
  }
}
```

#### Step 6: Add CSS Import

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* TW-Enigma will automatically optimize this */
```

### React with TypeScript

#### Additional TypeScript Configuration

```typescript
// src/tw-enigma.d.ts
declare module '@tw-enigma/react' {
  export function useTWEnigma(): {
    optimizedClasses: (classes: string) => string;
    analyzeUsage: () => Promise<AnalysisResult>;
  };
}
```

#### Usage in Components

```typescript
// src/components/Button.tsx
import React from 'react';
import { useTWEnigma } from '@tw-enigma/react';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', children }: ButtonProps) {
  const { optimizedClasses } = useTWEnigma();
  
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  };
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3',
  };
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`;
  
  return (
    <button className={optimizedClasses(classes)}>
      {children}
    </button>
  );
}
```

## Vue Setup

### Vue CLI

#### Step 1: Install Dependencies

```bash
# Install TW-Enigma
npm install @tw-enigma/core @tw-enigma/vue

# Install build integration
npm install @tw-enigma/vue-cli-plugin
```

#### Step 2: Add Vue CLI Plugin

```bash
# Add TW-Enigma plugin
vue add @tw-enigma/vue-cli-plugin
```

#### Step 3: Configure TW-Enigma

```javascript
// tw-enigma.config.js
export default {
  preset: 'vue-cli',
  
  content: [
    './src/**/*.{vue,js,ts}',
    './public/index.html',
  ],
  
  // Vue-specific settings
  vue: {
    version: '3',
    enableCompositionApi: true,
    
    // Scoped styles optimization
    scopedStyles: {
      optimize: true,
      extractGlobal: true,
    },
  },
  
  optimization: {
    strategy: 'atomic',
    vueSpecific: {
      optimizeDirectives: true,
      optimizeSlots: true,
    },
  },
};
```

#### Step 4: Configure Vue CLI

```javascript
// vue.config.js
const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  configureWebpack: {
    plugins: [
      // TW-Enigma plugin is automatically added
    ],
  },
  
  css: {
    sourceMap: true,
  },
});
```

#### Step 5: Usage in Components

```vue
<!-- src/components/VueButton.vue -->
<template>
  <button 
    :class="optimizedClasses"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTWEnigma } from '@tw-enigma/vue';

interface Props {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const { optimizeClasses } = useTWEnigma();

const optimizedClasses = computed(() => {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  };
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3',
  };
  
  const classes = `${baseClasses} ${variantClasses[props.variant]} ${sizeClasses[props.size]}`;
  return optimizeClasses(classes);
});

const handleClick = (event: MouseEvent) => {
  emit('click', event);
};
</script>

<style scoped>
/* Scoped styles are automatically optimized */
.button-custom {
  @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
}
</style>
```

## Angular Setup

### Angular CLI

#### Step 1: Install Dependencies

```bash
# Install TW-Enigma
npm install @tw-enigma/core @tw-enigma/angular

# Install Angular schematics
npm install @tw-enigma/angular-schematics
```

#### Step 2: Add Schematic

```bash
# Add TW-Enigma to Angular project
ng add @tw-enigma/angular-schematics
```

#### Step 3: Configure TW-Enigma

```javascript
// tw-enigma.config.js
export default {
  preset: 'angular-cli',
  
  content: [
    './src/**/*.{html,ts}',
    './src/**/*.component.html',
  ],
  
  // Angular-specific settings
  angular: {
    version: '17',
    enableIvy: true,
    
    // ViewEncapsulation strategy
    viewEncapsulation: 'Emulated',
    
    // Optimize Angular components
    components: {
      optimizeTemplates: true,
      optimizeStyles: true,
    },
  },
  
  optimization: {
    strategy: 'atomic',
    angularSpecific: {
      optimizeDirectives: true,
      optimizePipes: true,
    },
  },
};
```

#### Step 4: Configure Angular Build

```json
// angular.json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@tw-enigma/angular:build",
          "options": {
            "outputPath": "dist/my-app",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": "src/polyfills.ts",
            "tsConfig": "tsconfig.app.json",
            "assets": ["src/favicon.ico", "src/assets"],
            "styles": ["src/styles.css"],
            "scripts": [],
            "twEnigmaConfig": "tw-enigma.config.js"
          }
        }
      }
    }
  }
}
```

#### Step 5: Usage in Components

```typescript
// src/app/components/button/button.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TWEnigmaService } from '@tw-enigma/angular';

@Component({
  selector: 'app-button',
  template: `
    <button 
      [class]="optimizedClasses"
      (click)="handleClick($event)"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class ButtonComponent {
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Output() buttonClick = new EventEmitter<MouseEvent>();
  
  constructor(private twEnigma: TWEnigmaService) {}
  
  get optimizedClasses(): string {
    const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    };
    const sizeClasses = {
      sm: 'text-sm px-2 py-1',
      md: 'text-base px-4 py-2',
      lg: 'text-lg px-6 py-3',
    };
    
    const classes = `${baseClasses} ${variantClasses[this.variant]} ${sizeClasses[this.size]}`;
    return this.twEnigma.optimizeClasses(classes);
  }
  
  handleClick(event: MouseEvent): void {
    this.buttonClick.emit(event);
  }
}
```

## Next.js Setup

### Next.js 13+ with App Router

#### Step 1: Install Dependencies

```bash
# Install TW-Enigma
npm install @tw-enigma/core @tw-enigma/next

# Install Next.js plugin
npm install @tw-enigma/next-plugin
```

#### Step 2: Configure Next.js

```javascript
// next.config.js
const { withTWEnigma } = require('@tw-enigma/next-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
};

module.exports = withTWEnigma(nextConfig, {
  configFile: './tw-enigma.config.js',
  
  // Next.js specific options
  optimizeAppRouter: true,
  serverComponents: true,
  edgeRuntime: true,
});
```

#### Step 3: Configure TW-Enigma

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-nextjs',
  
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  
  // Next.js specific settings
  nextjs: {
    appRouter: true,
    
    // Server Components optimization
    serverComponents: {
      enabled: true,
      extractServerCSS: true,
      optimizeClientBoundary: true,
    },
    
    // Static generation
    staticGeneration: {
      enabled: true,
      optimizeStaticCSS: true,
    },
    
    // Edge runtime
    edge: {
      enabled: true,
      optimizeForEdge: true,
    },
  },
  
  // SSR optimization
  ssr: {
    extractCriticalCSS: true,
    inlineStyles: true,
    deferNonCritical: true,
  },
};
```

#### Step 4: App Layout Configuration

```typescript
// app/layout.tsx
import { TWEnigmaProvider } from '@tw-enigma/next';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TWEnigmaProvider
          config={{
            enableOptimization: true,
            ssr: true,
          }}
        >
          {children}
        </TWEnigmaProvider>
      </body>
    </html>
  );
}
```

#### Step 5: Usage in Server Components

```typescript
// app/components/ServerButton.tsx
import { optimizeClasses } from '@tw-enigma/next/server';

interface ServerButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function ServerButton({ variant = 'primary', children }: ServerButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-medium';
  const variantClasses = {
    primary: 'bg-blue-600 text-white',
    secondary: 'bg-gray-200 text-gray-900',
  };
  
  const classes = `${baseClasses} ${variantClasses[variant]}`;
  
  return (
    <button className={optimizeClasses(classes)}>
      {children}
    </button>
  );
}
```

## Nuxt.js Setup

### Nuxt 3

#### Step 1: Install Module

```bash
# Install TW-Enigma Nuxt module
npm install @tw-enigma/nuxt
```

#### Step 2: Configure Nuxt

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@tw-enigma/nuxt'],
  
  twEnigma: {
    preset: 'vue-nuxt',
    
    // Nuxt-specific configuration
    nuxt: {
      // SSR optimization
      ssr: {
        extractCriticalCSS: true,
        inlineStyles: true,
      },
      
      // Static generation
      generate: {
        optimizeStaticCSS: true,
        perPageCSS: true,
      },
      
      // Module integration
      modules: {
        optimizeModules: true,
        includedModules: ['@nuxtjs/tailwindcss'],
      },
    },
    
    content: [
      './components/**/*.{vue,js,ts}',
      './layouts/**/*.vue',
      './pages/**/*.vue',
      './app.vue',
    ],
  },
  
  css: ['~/assets/css/main.css'],
});
```

#### Step 3: Usage in Components

```vue
<!-- components/NuxtButton.vue -->
<template>
  <button 
    :class="optimizedClasses"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

// Use Nuxt's optimizeClasses composable
const { optimizeClasses } = useTWEnigma();

const optimizedClasses = computed(() => {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  };
  const sizeClasses = {
    sm: 'text-sm px-2 py-1',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3',
  };
  
  const classes = `${baseClasses} ${variantClasses[props.variant]} ${sizeClasses[props.size]}`;
  return optimizeClasses(classes);
});

const handleClick = (event: MouseEvent) => {
  emit('click', event);
};
</script>
```

## Vite Integration

### Universal Vite Setup

#### Step 1: Install Plugin

```bash
# Install Vite plugin
npm install @tw-enigma/vite-plugin
```

#### Step 2: Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin';

// Framework-specific imports
import react from '@vitejs/plugin-react'; // For React
import vue from '@vitejs/plugin-vue'; // For Vue

export default defineConfig({
  plugins: [
    // Framework plugin
    react(), // or vue()
    
    // TW-Enigma plugin
    twEnigmaPlugin({
      configFile: './tw-enigma.config.js',
      
      // Vite-specific options
      vite: {
        // Development optimization
        development: {
          enableHMR: true,
          fastRefresh: true,
          optimizeImports: true,
        },
        
        // Build optimization
        build: {
          extractCSS: true,
          minifyCSS: true,
          generateSourceMap: true,
        },
        
        // SSR support
        ssr: {
          optimizeSSR: true,
          extractServerCSS: true,
        },
      },
    }),
  ],
  
  // CSS configuration
  css: {
    devSourcemap: true,
    postcss: './postcss.config.js',
  },
  
  // Build configuration
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'css/[name].[hash].css';
          }
          return 'assets/[name].[hash][extname]';
        },
      },
    },
  },
});
```

## Build Tool Configuration

### Webpack Configuration

```javascript
// webpack.config.js
const { TWEnigmaPlugin } = require('@tw-enigma/webpack-plugin');

module.exports = {
  // ... existing config
  
  plugins: [
    new TWEnigmaPlugin({
      configFile: './tw-enigma.config.js',
      
      // Webpack-specific options
      webpack: {
        // Optimization
        optimization: {
          extractCSS: true,
          splitChunks: true,
          treeShaking: true,
        },
        
        // Development
        development: {
          enableHMR: true,
          sourceMaps: true,
        },
        
        // Production
        production: {
          minify: true,
          compress: true,
          analyze: true,
        },
      },
    }),
  ],
  
  // CSS handling
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },
};
```

### Rollup Configuration

```javascript
// rollup.config.js
import { twEnigmaPlugin } from '@tw-enigma/rollup-plugin';

export default {
  // ... existing config
  
  plugins: [
    twEnigmaPlugin({
      configFile: './tw-enigma.config.js',
      
      // Rollup-specific options
      rollup: {
        // Bundle configuration
        bundle: {
          extractCSS: true,
          generateSourceMap: true,
        },
        
        // Tree shaking
        treeShaking: {
          enabled: true,
          aggressive: true,
        },
      },
    }),
  ],
};
```

## Verification and Testing

### Test Your Setup

#### Step 1: Create Test Component

```typescript
// src/components/TestButton.tsx (React)
// or src/components/TestButton.vue (Vue)
// or src/app/test-button/test-button.component.ts (Angular)

export function TestButton() {
  return (
    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
      Test TW-Enigma
    </button>
  );
}
```

#### Step 2: Run Development Server

```bash
npm run dev
# or npm start
```

#### Step 3: Check Optimization

```bash
# Analyze CSS optimization
npm run analyze

# Generate optimization report
npx tw-enigma analyze --report

# Check bundle size
npm run build && npx tw-enigma report
```

#### Step 4: Verify Output

Look for:
- ✅ Optimized CSS classes in development tools
- ✅ Reduced CSS bundle size
- ✅ Fast HMR updates
- ✅ No console errors

### Performance Testing

#### Test Script

```javascript
// scripts/test-performance.js
const { analyzePerformance } = require('@tw-enigma/core');

async function testPerformance() {
  const results = await analyzePerformance({
    buildDir: './dist',
    testPages: ['/', '/about', '/contact'],
    metrics: ['bundle-size', 'css-size', 'load-time'],
  });
  
  console.log('Performance Results:', results);
  
  // Assert performance improvements
  if (results.cssReduction < 0.5) {
    console.log('✅ CSS size reduced by', (results.cssReduction * 100).toFixed(1), '%');
  } else {
    console.warn('⚠️ CSS reduction below expected threshold');
  }
}

testPerformance();
```

### Troubleshooting Setup Issues

#### Common Problems

1. **TW-Enigma not detecting framework**
   ```bash
   # Check detection
   npx tw-enigma detect
   
   # Force framework
   npx tw-enigma init --framework react
   ```

2. **CSS not optimizing**
   ```bash
   # Enable debug mode
   DEBUG=tw-enigma:* npm run build
   ```

3. **Build errors**
   ```bash
   # Validate configuration
   npx tw-enigma validate
   
   # Check compatibility
   npx tw-enigma doctor
   ```

#### Debug Configuration

```javascript
// tw-enigma.config.js
export default {
  // ... your config
  
  debug: {
    enabled: true,
    logLevel: 'verbose',
    outputDir: './debug',
    
    // Debug specific areas
    areas: ['detection', 'optimization', 'extraction'],
  },
};
```

---

This setup guide provides framework-specific instructions for integrating TW-Enigma into your project. Follow the appropriate section for your framework and build tool combination, then verify the setup using the testing procedures.