# Vite Plugin Integration

Comprehensive examples for integrating tw-enigma with Vite across different project types and configurations.

## 📋 Overview

The tw-enigma Vite plugin provides seamless integration with Vite-based projects, offering:

- **Hot Module Replacement (HMR)** - Real-time CSS optimization during development
- **Build Optimization** - Automatic optimization during production builds
- **Framework Agnostic** - Works with React, Vue, Svelte, and vanilla JavaScript
- **Development Tools** - Live analysis dashboard and performance monitoring

## 🚀 Quick Start

### Installation

```bash
# Install tw-enigma packages
npm install @tw-enigma/core
npm install -D @tw-enigma/vite-plugin

# For framework-specific support
npm install -D @vitejs/plugin-react      # React projects
npm install -D @vitejs/plugin-vue        # Vue projects  
npm install -D @vitejs/plugin-svelte     # Svelte projects
```

### Basic Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin'

export default defineConfig({
  plugins: [
    // Framework plugin first
    // react(), vue(), svelte(), etc.
    
    // tw-enigma plugin
    twEnigmaPlugin({
      // Optional: custom config file path
      configFile: './tw-enigma.config.js',
      
      // Enable/disable optimization in development
      enableInDev: false,
      
      // Show optimization progress
      verbose: true
    })
  ]
})
```

## ⚙️ Configuration Examples

### 1. React + TypeScript + Tailwind

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    twEnigmaPlugin({
      configFile: './tw-enigma.config.js',
      enableInDev: process.env.NODE_ENV === 'production',
      verbose: true,
      
      // React-specific optimizations
      reactOptions: {
        preserveReactTestIds: true,
        optimizeConditionalClasses: true
      }
    })
  ],
  
  // CSS configuration
  css: {
    devSourcemap: true,
    postcss: './postcss.config.js'
  },
  
  // Build optimization
  build: {
    // Enable CSS code splitting
    cssCodeSplit: true,
    
    // Generate source maps for production debugging
    sourcemap: true,
    
    rollupOptions: {
      output: {
        // Separate CSS chunks for better caching
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  }
})
```

```javascript
// tw-enigma.config.js
import { defineConfig } from '@tw-enigma/core'

export default defineConfig({
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html'
  ],
  
  optimization: {
    strategy: 'hybrid',
    threshold: 2,
    minify: true,
    
    // React-specific settings
    react: {
      preserveDataTestIds: true,
      optimizeConditionalClasses: true,
      handleDynamicClasses: true
    }
  },
  
  development: {
    enableHMR: true,
    sourceMaps: true,
    liveAnalysis: true
  },
  
  analytics: {
    enabled: true,
    reportPath: 'reports/optimization.json'
  }
})
```

### 2. Vue 3 + Composition API

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    twEnigmaPlugin({
      // Vue-specific configuration
      vueOptions: {
        extractFromSFC: true,        // Extract classes from Vue SFC
        optimizeScoped: true,        // Optimize scoped styles
        handleDynamicBinding: true   // Handle v-bind:class
      }
    })
  ],
  
  // Vue-specific CSS handling
  css: {
    preprocessorOptions: {
      scss: {
        // Global SCSS variables available in all components
        additionalData: `@import "./src/assets/styles/variables.scss";`
      }
    }
  }
})
```

```javascript
// tw-enigma.config.js for Vue
export default defineConfig({
  content: [
    './src/**/*.{vue,js,ts}',
    './public/index.html'
  ],
  
  optimization: {
    strategy: 'atomic',
    vue: {
      extractFromSFC: true,
      scopedStyles: true,
      dynamicClasses: true
    }
  },
  
  // Vue-specific class extraction patterns
  extraction: {
    patterns: [
      // Standard class attributes
      /class="([^"]*?)"/g,
      
      // Vue dynamic classes
      /:class="([^"]*?)"/g,
      
      // Vue conditional classes
      /v-bind:class="([^"]*?)"/g,
      
      // Template literals in script setup
      /`([^`]*)`/g
    ]
  }
})
```

### 3. Svelte + SvelteKit

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite'
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    sveltekit(),
    twEnigmaPlugin({
      svelteOptions: {
        extractFromComponents: true,
        optimizeTransitions: true,
        handleReactiveClasses: true
      }
    })
  ]
})
```

### 4. Multi-Framework Monorepo

```typescript
// vite.config.ts for monorepo
import { defineConfig } from 'vite'
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin'

export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      // Multi-package configuration
      packages: [
        {
          name: '@myorg/react-components',
          path: './packages/react',
          framework: 'react'
        },
        {
          name: '@myorg/vue-components', 
          path: './packages/vue',
          framework: 'vue'
        }
      ],
      
      // Shared optimization settings
      sharedConfig: './shared/tw-enigma.config.js',
      
      // Cross-package optimization
      crossPackageOptimization: true
    })
  ]
})
```

## 🔧 Development Features

### Hot Module Replacement (HMR)

tw-enigma supports Vite's HMR for real-time optimization:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      development: {
        // Enable HMR for CSS optimization
        hmr: true,
        
        // Update optimization on file changes
        watchFiles: [
          'src/**/*.{js,jsx,ts,tsx,vue,svelte}',
          'tailwind.config.js',
          'tw-enigma.config.js'
        ],
        
        // Live analysis during development
        liveAnalysis: {
          enabled: true,
          updateInterval: 1000,
          showNotifications: true
        }
      }
    })
  ]
})
```

### Development Dashboard

Enable the built-in development dashboard:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      dashboard: {
        enabled: true,
        port: 3001,
        
        // Dashboard features
        features: {
          realTimeStats: true,
          classUsageGraph: true,
          optimizationHistory: true,
          performanceMetrics: true
        }
      }
    })
  ]
})
```

Access dashboard at `http://localhost:3001` during development.

## 🏗️ Build Optimization

### Production Build Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      build: {
        // Enable aggressive optimization for production
        aggressive: true,
        
        // Generate optimization report
        generateReport: true,
        reportPath: 'dist/optimization-report.json',
        
        // Bundle analysis
        bundleAnalysis: {
          enabled: true,
          openBrowser: false,
          outputPath: 'dist/bundle-analysis.html'
        }
      }
    })
  ],
  
  build: {
    // Enable CSS minification
    cssMinify: true,
    
    // Build performance
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate tw-enigma optimized CSS
          if (id.includes('tw-enigma-optimized')) {
            return 'tw-enigma-optimized'
          }
        }
      }
    }
  }
})
```

### Environment-Specific Builds

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const isProd = mode === 'production'
  const isTest = mode === 'test'
  
  return {
    plugins: [
      twEnigmaPlugin({
        // Environment-specific configuration
        optimization: {
          enabled: isProd,
          strategy: isProd ? 'hybrid' : 'atomic',
          minify: isProd,
          preserveComments: isDev
        },
        
        analytics: {
          enabled: isProd,
          detailed: isProd,
          performance: isProd
        },
        
        development: {
          enableHMR: isDev,
          liveAnalysis: isDev,
          sourceMaps: isDev || isTest
        }
      })
    ]
  }
})
```

## 📊 Performance Monitoring

### Build Performance Tracking

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      performance: {
        // Track build performance
        trackBuildTime: true,
        trackMemoryUsage: true,
        trackCSSParseTime: true,
        
        // Performance thresholds
        thresholds: {
          buildTime: 30000,      // 30 seconds
          memoryUsage: 512,      // 512 MB
          cssParseTime: 5000     // 5 seconds
        },
        
        // Alerts for performance issues
        alerts: {
          enabled: true,
          webhook: process.env.SLACK_WEBHOOK,
          thresholdExceeded: true
        }
      }
    })
  ]
})
```

### Runtime Performance Monitoring

```typescript
// src/utils/performance.ts
import { trackOptimization } from '@tw-enigma/core/analytics'

// Custom performance tracking
export function trackPageLoad() {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'paint') {
        trackOptimization({
          metric: entry.name,
          value: entry.startTime,
          timestamp: Date.now(),
          context: 'page-load'
        })
      }
    }
  })
  
  observer.observe({ entryTypes: ['paint'] })
}
```

## 🧪 Testing Integration

### Test Environment Configuration

```typescript
// vite.config.test.ts
import { defineConfig } from 'vite'
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin'

export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      test: {
        // Disable optimization in tests
        optimize: false,
        
        // Preserve test identifiers
        preserveTestIds: true,
        
        // Mock optimization for testing
        mockOptimization: true
      }
    })
  ],
  
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  }
})
```

### Test Utilities

```typescript
// src/test/tw-enigma-utils.ts
import { createOptimizationMock } from '@tw-enigma/core/testing'

// Mock optimization for testing
export const mockOptimization = createOptimizationMock({
  strategy: 'atomic',
  preserveTestClasses: true
})

// Test optimization results
export function expectOptimizationResults(result: any) {
  expect(result).toHaveProperty('optimizedCSS')
  expect(result).toHaveProperty('originalSize')
  expect(result).toHaveProperty('optimizedSize')
  expect(result.optimizedSize).toBeLessThan(result.originalSize)
}
```

## 📈 CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/build.yml
name: Build with tw-enigma

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build with tw-enigma optimization
      run: npm run build
      env:
        NODE_ENV: production
        TW_ENIGMA_ANALYTICS: true
    
    - name: Upload optimization report
      uses: actions/upload-artifact@v3
      with:
        name: optimization-report
        path: dist/optimization-report.json
    
    - name: Performance regression check
      run: |
        # Compare with baseline performance
        npm run performance:compare
```

## 🔍 Troubleshooting

### Common Issues

**Issue: Plugin not optimizing in development**
```typescript
// Solution: Enable development optimization
export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      enableInDev: true  // Enable optimization in development
    })
  ]
})
```

**Issue: HMR not working with tw-enigma**
```typescript
// Solution: Configure HMR properly
export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      development: {
        hmr: true,
        watchFiles: ['src/**/*.{js,jsx,ts,tsx}'],
        debounceDelay: 100
      }
    })
  ]
})
```

**Issue: Build performance slow**
```typescript
// Solution: Enable parallel processing
export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      optimization: {
        parallel: true,
        workers: 4,
        cache: true
      }
    })
  ]
})
```

### Debug Mode

Enable debug logging:

```bash
# Enable debug mode
DEBUG=tw-enigma:vite npm run dev

# Enable verbose logging
DEBUG=tw-enigma:* npm run build
```

## 📚 Advanced Usage

### Custom Plugin Extensions

```typescript
// vite.config.ts
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin'

export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      // Custom hooks
      hooks: {
        beforeOptimization: (css, context) => {
          console.log('Optimizing CSS:', css.length, 'characters')
        },
        
        afterOptimization: (result) => {
          console.log('Optimization complete:', result.savings)
        },
        
        onError: (error) => {
          console.error('Optimization error:', error)
        }
      },
      
      // Custom transformations
      transformations: [
        {
          name: 'custom-transform',
          transform: (css) => {
            // Custom CSS transformation logic
            return css.replace(/\/\* custom \*\//g, '')
          }
        }
      ]
    })
  ]
})
```

### Integration with Other Plugins

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin'
import { critters } from 'vite-plugin-critters'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // Order matters - tw-enigma should come before CSS processing plugins
    twEnigmaPlugin(),
    
    // Critical CSS extraction (after tw-enigma)
    critters({
      config: './critters.config.js'
    }),
    
    // PWA plugin (last)
    VitePWA({
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})
```

## 📖 Further Reading

- **[Core Documentation](../../packages/core/README.md)** - Complete API reference
- **[Performance Guide](../../docs/performance.md)** - Optimization best practices
- **[Framework Examples](../frameworks/)** - Framework-specific implementations
- **[Configuration Reference](../../docs/configuration.md)** - All configuration options

---

**Ready to supercharge your Vite builds?** The tw-enigma Vite plugin seamlessly integrates CSS optimization into your development workflow, providing up to 96% CSS size reduction with zero configuration required. 