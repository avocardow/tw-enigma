# Server-Side Rendering (SSR) Compatibility Guide

## Overview

TW-Enigma provides comprehensive support for Server-Side Rendering (SSR) and Static Site Generation (SSG) across multiple frameworks. This guide covers SSR-specific optimizations, configurations, and best practices.

## Table of Contents

1. [Supported SSR Frameworks](#supported-ssr-frameworks)
2. [SSR Optimization Strategies](#ssr-optimization-strategies)
3. [Framework-Specific Guides](#framework-specific-guides)
4. [CSS Extraction for SSR](#css-extraction-for-ssr)
5. [Performance Optimization](#performance-optimization)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Configuration](#advanced-configuration)

## Supported SSR Frameworks

### React SSR Frameworks

| Framework | Support Level | Preset | Key Features |
|-----------|---------------|--------|--------------|
| Next.js | ✅ Full | `react-nextjs` | App Router, RSC, ISR |
| Remix | ✅ Full | `react-remix` | Nested routing, progressive enhancement |
| Gatsby | ✅ Full | `react-gatsby` | GraphQL, static generation |
| Vite SSR | ✅ Experimental | `react-vite-ssr` | ESM, fast dev server |

### Vue SSR Frameworks

| Framework | Support Level | Preset | Key Features |
|-----------|---------------|--------|--------------|
| Nuxt.js | ✅ Full | `vue-nuxt` | Universal rendering, modules |
| Quasar | ✅ Full | `vue-quasar-ssr` | Material design, mobile |
| Vue SSR | ✅ Basic | `vue-ssr` | Manual SSR setup |
| Vite SSR | ✅ Experimental | `vue-vite-ssr` | Modern tooling |

### Angular SSR Frameworks

| Framework | Support Level | Preset | Key Features |
|-----------|---------------|--------|--------------|
| Angular Universal | ✅ Full | `angular-universal` | Full SSR, prerendering |
| Analog | ✅ Beta | `angular-analog` | Vite-powered SSR |

## SSR Optimization Strategies

### 1. Critical CSS Extraction

Extract above-the-fold CSS for faster initial rendering:

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-nextjs',
  
  ssr: {
    criticalCSS: {
      enabled: true,
      
      // Extract critical CSS per route
      perRoute: true,
      
      // Inline critical CSS
      inline: true,
      
      // Defer non-critical CSS
      deferNonCritical: true,
      
      // Critical CSS size limit
      maxSize: '50kb',
    },
  },
};
```

### 2. CSS Code Splitting

Split CSS by routes and components:

```javascript
export default {
  ssr: {
    codeSplitting: {
      enabled: true,
      
      // Strategy: 'route', 'component', 'hybrid'
      strategy: 'hybrid',
      
      // Minimum chunk size
      minChunkSize: '10kb',
      
      // Maximum chunks per route
      maxChunksPerRoute: 5,
    },
  },
};
```

### 3. Server-Side CSS Generation

Generate CSS on the server for SSR:

```javascript
export default {
  ssr: {
    serverGeneration: {
      enabled: true,
      
      // Cache generated CSS
      cache: true,
      cacheTTL: 3600,
      
      // Precompile common patterns
      precompile: true,
      
      // Memory limits
      maxMemoryUsage: '512mb',
    },
  },
};
```

## Framework-Specific Guides

### Next.js Integration

#### App Router Support

```javascript
// tw-enigma.config.js for Next.js App Router
export default {
  preset: 'react-nextjs',
  
  nextjs: {
    // App Router specific settings
    appRouter: true,
    
    // Server Components support
    serverComponents: {
      enabled: true,
      extractServerCSS: true,
      clientBoundary: true,
    },
    
    // Route-based CSS splitting
    routeCodeSplitting: true,
    
    // Edge runtime support
    edgeRuntime: true,
  },
};
```

#### Pages Router Support

```javascript
// tw-enigma.config.js for Next.js Pages Router
export default {
  preset: 'react-nextjs',
  
  nextjs: {
    appRouter: false,
    
    // _document.js integration
    documentIntegration: true,
    
    // Custom _app.js CSS handling
    appIntegration: true,
    
    // Automatic CSS imports
    autoImportCSS: true,
  },
};
```

#### Deployment Configuration

```javascript
// next.config.js
const { withTWEnigma } = require('@tw-enigma/next');

module.exports = withTWEnigma({
  // Next.js config
  experimental: {
    appDir: true,
  },
  
  // TW-Enigma specific
  twEnigma: {
    configFile: './tw-enigma.config.js',
    
    // Build-time optimization
    buildTimeOptimization: true,
    
    // Static export support
    staticExport: true,
  },
});
```

### Nuxt.js Integration

#### Nuxt 3 Configuration

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@tw-enigma/nuxt'],
  
  twEnigma: {
    preset: 'vue-nuxt',
    
    // SSR-specific settings
    ssr: {
      // Inline critical CSS
      inlineCritical: true,
      
      // Lazy load non-critical CSS
      lazyLoadCSS: true,
      
      // Preload CSS for faster navigation
      preloadCSS: true,
    },
    
    // Nuxt-specific optimizations
    nuxt: {
      // Generate CSS for each page
      perPageCSS: true,
      
      // Use Nuxt's CSS extraction
      useNuxtCSS: true,
      
      // Asset optimization
      optimizeAssets: true,
    },
  },
});
```

#### Module Integration

```javascript
// modules/tw-enigma.ts
import { defineNuxtModule } from '@nuxt/kit';

export default defineNuxtModule({
  meta: {
    name: 'tw-enigma',
    configKey: 'twEnigma',
  },
  
  setup(options, nuxt) {
    // Build-time integration
    nuxt.hook('build:before', async () => {
      await optimizeTailwindCSS(options);
    });
    
    // Runtime integration
    nuxt.hook('render:route', async (url, result) => {
      result.html = await injectCriticalCSS(result.html, url);
    });
  },
});
```

### Angular Universal Integration

#### Basic Setup

```typescript
// angular.json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@tw-enigma/angular:build",
          "options": {
            "configFile": "tw-enigma.config.js",
            "ssr": true
          }
        }
      }
    }
  }
}
```

#### Server Configuration

```typescript
// server.ts
import { ngExpressEngine } from '@nguniversal/express-engine';
import { TWEnigmaSSRModule } from '@tw-enigma/angular';

app.engine('html', ngExpressEngine({
  bootstrap: AppServerModule,
  providers: [
    // TW-Enigma SSR provider
    TWEnigmaSSRModule.forRoot({
      extractCriticalCSS: true,
      inlineStyles: true,
    }),
  ],
}));
```

## CSS Extraction for SSR

### Critical CSS Detection

Automatically detect and extract critical CSS:

```javascript
export default {
  ssr: {
    criticalCSS: {
      // Detection methods
      detection: {
        // Viewport-based detection
        viewport: {
          width: 1200,
          height: 800,
        },
        
        // Above-the-fold detection
        aboveFold: true,
        
        // Component-based detection
        components: ['Header', 'Hero', 'Navigation'],
        
        // Route-specific detection
        routes: {
          '/': ['hero', 'navigation'],
          '/about': ['header', 'content'],
        },
      },
      
      // Extraction options
      extraction: {
        // Remove unused CSS
        removeUnused: true,
        
        // Minify extracted CSS
        minify: true,
        
        // Include media queries
        includeMediaQueries: true,
        
        // Font optimization
        optimizeFonts: true,
      },
    },
  },
};
```

### CSS Injection Strategies

Different strategies for injecting CSS in SSR:

```javascript
export default {
  ssr: {
    injection: {
      // Strategy: 'inline', 'link', 'hybrid'
      strategy: 'hybrid',
      
      // Inline critical CSS
      inlineCritical: {
        enabled: true,
        maxSize: '50kb',
        position: 'head',
      },
      
      // Link non-critical CSS
      linkNonCritical: {
        enabled: true,
        preload: true,
        defer: true,
      },
      
      // Progressive loading
      progressive: {
        enabled: true,
        loadOrder: ['critical', 'above-fold', 'below-fold'],
      },
    },
  },
};
```

### CSS Caching

Implement caching for better SSR performance:

```javascript
export default {
  ssr: {
    cache: {
      // Cache extracted CSS
      extractedCSS: {
        enabled: true,
        ttl: 3600, // 1 hour
        storage: 'memory', // 'memory', 'file', 'redis'
      },
      
      // Cache critical CSS per route
      criticalCSS: {
        enabled: true,
        keyStrategy: 'route', // 'route', 'component', 'custom'
        maxEntries: 1000,
      },
      
      // Cache compiled patterns
      compiledPatterns: {
        enabled: true,
        persistToDisk: true,
        location: './cache/tw-enigma',
      },
    },
  },
};
```

## Performance Optimization

### 1. Streaming SSR

Support for streaming SSR responses:

```javascript
export default {
  ssr: {
    streaming: {
      enabled: true,
      
      // Stream critical CSS first
      prioritizeCritical: true,
      
      // Chunk size for streaming
      chunkSize: '8kb',
      
      // Stream timeout
      timeout: 5000,
    },
  },
};
```

### 2. Incremental Static Regeneration (ISR)

Optimize for ISR when available:

```javascript
export default {
  ssr: {
    isr: {
      enabled: true,
      
      // CSS generation strategy for ISR
      cssStrategy: 'pregenerate', // 'pregenerate', 'on-demand'
      
      // Revalidation interval
      revalidate: 3600, // 1 hour
      
      // Static CSS caching
      staticCache: true,
    },
  },
};
```

### 3. Edge Computing Support

Configuration for edge computing platforms:

```javascript
export default {
  ssr: {
    edge: {
      enabled: true,
      
      // Platform: 'vercel', 'cloudflare', 'deno'
      platform: 'vercel',
      
      // Edge-specific optimizations
      optimizations: {
        // Minimal runtime
        minimalRuntime: true,
        
        // Tree-shake SSR code
        treeShakeSSR: true,
        
        // Optimize for cold starts
        coldStart: true,
      },
    },
  },
};
```

## Troubleshooting

### Common SSR Issues

#### CSS Hydration Mismatch

**Problem**: CSS differs between server and client rendering

**Solution**:
```javascript
export default {
  ssr: {
    hydration: {
      // Ensure consistent CSS between server/client
      consistent: true,
      
      // Suppress hydration warnings
      suppressWarnings: false,
      
      // Force client-side re-render for CSS
      forceClientRender: false,
    },
  },
};
```

#### Flash of Unstyled Content (FOUC)

**Problem**: Brief flash of unstyled content on page load

**Solution**:
```javascript
export default {
  ssr: {
    fouc: {
      // Prevention strategy
      prevention: 'critical-css', // 'critical-css', 'inline-all', 'blocking'
      
      // Preload critical CSS
      preloadCritical: true,
      
      // Hide content until styles load
      hideUntilStyled: true,
    },
  },
};
```

#### Memory Leaks in SSR

**Problem**: Memory usage increases over time in SSR

**Solution**:
```javascript
export default {
  ssr: {
    memory: {
      // Cleanup after each request
      cleanup: true,
      
      // Memory limits
      maxMemoryUsage: '512mb',
      
      // Garbage collection hints
      gcHints: true,
      
      // Pool CSS generators
      poolGenerators: true,
      maxPoolSize: 10,
    },
  },
};
```

### Debug Mode

Enable SSR-specific debugging:

```bash
# Enable SSR debugging
DEBUG=tw-enigma:ssr npm run build

# Verbose SSR logging
DEBUG=tw-enigma:ssr:* npm run dev

# Memory profiling
NODE_OPTIONS="--inspect" DEBUG=tw-enigma:ssr:memory npm run build
```

### Performance Monitoring

Monitor SSR performance:

```javascript
export default {
  ssr: {
    monitoring: {
      enabled: true,
      
      // Track critical metrics
      metrics: [
        'ttfb', // Time to First Byte
        'fcp',  // First Contentful Paint
        'lcp',  // Largest Contentful Paint
        'cls',  // Cumulative Layout Shift
      ],
      
      // Report to monitoring service
      reporting: {
        service: 'datadog', // 'datadog', 'newrelic', 'custom'
        apiKey: process.env.MONITORING_API_KEY,
      },
    },
  },
};
```

## Advanced Configuration

### Custom SSR Pipeline

Create custom SSR processing pipeline:

```typescript
import { SSRPipeline, SSRProcessor } from '@tw-enigma/core';

class CustomCSSProcessor implements SSRProcessor {
  async process(html: string, context: SSRContext): Promise<string> {
    // Custom CSS processing logic
    const criticalCSS = await this.extractCritical(html, context);
    return this.injectCSS(html, criticalCSS);
  }
  
  private async extractCritical(html: string, context: SSRContext): Promise<string> {
    // Implementation
  }
  
  private injectCSS(html: string, css: string): string {
    // Implementation
  }
}

// Configure pipeline
export default {
  ssr: {
    pipeline: {
      processors: [
        new CustomCSSProcessor(),
      ],
    },
  },
};
```

### Multi-Framework Support

Support multiple frameworks in the same project:

```javascript
export default {
  workspaces: {
    'apps/nextjs-app': {
      preset: 'react-nextjs',
      ssr: { /* Next.js specific SSR config */ },
    },
    
    'apps/nuxt-app': {
      preset: 'vue-nuxt',
      ssr: { /* Nuxt.js specific SSR config */ },
    },
    
    'apps/angular-app': {
      preset: 'angular-universal',
      ssr: { /* Angular Universal specific config */ },
    },
  },
};
```

### Build-Time Optimization

Optimize CSS at build time for SSR:

```javascript
export default {
  ssr: {
    buildTime: {
      // Pre-generate critical CSS for all routes
      pregenerateCritical: true,
      
      // Analyze route dependencies
      analyzeRouteDependencies: true,
      
      // Create CSS bundles per route group
      routeGroupBundles: true,
      
      // Optimize for static generation
      staticOptimization: true,
    },
  },
};
```

---

SSR support in TW-Enigma provides powerful optimization capabilities while maintaining compatibility with popular SSR frameworks. Follow the framework-specific guides and optimization strategies to achieve the best performance for your server-rendered applications.