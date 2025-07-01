# TW-Enigma Framework Integration Troubleshooting

## Overview

This comprehensive troubleshooting guide covers common issues encountered when integrating TW-Enigma with different frontend frameworks, as well as general optimization system problems.

## Table of Contents

1. [General Integration Issues](#general-integration-issues)
2. [React-Specific Issues](#react-specific-issues)
3. [Vue-Specific Issues](#vue-specific-issues)
4. [Angular-Specific Issues](#angular-specific-issues)
5. [Build System Issues](#build-system-issues)
6. [CSS-in-JS Issues](#css-in-js-issues)
7. [SSR/SSG Issues](#ssrssg-issues)
8. [Performance Issues](#performance-issues)
9. [Configuration Issues](#configuration-issues)
10. [Responsive & Pseudo-Class Optimization Issues](#responsive--pseudo-class-optimization-issues)
11. [Debug Tools and Techniques](#debug-tools-and-techniques)

## General Integration Issues

### TW-Enigma Not Working

**Symptoms:**
- CSS optimization not occurring
- No console output from TW-Enigma
- Build succeeds but no optimization detected

**Diagnosis:**
```bash
# Check if TW-Enigma is properly installed
npm list @tw-enigma/core

# Verify configuration file exists
ls -la tw-enigma.config.js

# Enable debug logging
DEBUG=tw-enigma:* npm run build
```

**Solutions:**

1. **Missing Installation:**
```bash
npm install @tw-enigma/core
```

2. **Invalid Configuration:**
```javascript
// tw-enigma.config.js
export default {
  // Ensure basic configuration is present
  content: ['./src/**/*.{js,jsx,ts,tsx,vue}'],
  optimization: {
    strategy: 'atomic',
  },
};
```

3. **Framework Detection Failed:**
```javascript
// Force framework detection
export default {
  framework: {
    type: 'react', // or 'vue', 'angular'
    autoDetect: false,
  },
};
```

### Framework Not Detected

**Symptoms:**
- TW-Enigma uses generic optimization instead of framework-specific
- Missing framework-specific features
- Suboptimal performance

**Diagnosis:**
```bash
# Generate detection report
npx tw-enigma detect --report
```

**Solutions:**

1. **Manual Framework Declaration:**
```javascript
export default {
  preset: 'react-nextjs', // Use specific preset
  framework: {
    type: 'react',
    buildSystem: 'next',
  },
};
```

2. **Add Framework Dependencies:**
```bash
# Ensure framework is properly listed in package.json
npm install react react-dom
# or
npm install vue
# or
npm install @angular/core
```

## React-Specific Issues

### Create React App Integration

**Problem:** CRA doesn't recognize TW-Enigma webpack plugin

**Solution:**
```bash
# Use CRACO for configuration override
npm install @craco/craco
```

```javascript
// craco.config.js
const { TWEnigmaPlugin } = require('@tw-enigma/webpack-plugin');

module.exports = {
  webpack: {
    plugins: {
      add: [
        new TWEnigmaPlugin({
          configFile: './tw-enigma.config.js',
        }),
      ],
    },
  },
};
```

### Next.js App Router Issues

**Problem:** Server Components not optimizing CSS

**Solution:**
```javascript
// next.config.js
const { withTWEnigma } = require('@tw-enigma/next');

module.exports = withTWEnigma({
  experimental: {
    appDir: true,
  },
  twEnigma: {
    serverComponents: {
      enabled: true,
      extractServerCSS: true,
    },
  },
});
```

### Styled Components SSR Mismatch

**Problem:** CSS hydration errors with styled-components

**Solution:**
```javascript
// pages/_document.js
import Document from 'next/document';
import { ServerStyleSheet } from 'styled-components';
import { extractCriticalToChunks } from '@tw-enigma/react';

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) =>
            sheet.collectStyles(<App {...props} />),
        });

      const initialProps = await Document.getInitialProps(ctx);
      const criticalChunks = extractCriticalToChunks(initialProps.html);

      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
            {criticalChunks.styles}
          </>
        ),
      };
    } finally {
      sheet.seal();
    }
  }
}
```

## Vue-Specific Issues

### Vue CLI Plugin Conflicts

**Problem:** TW-Enigma conflicts with other Vue CLI plugins

**Solution:**
```javascript
// vue.config.js
module.exports = {
  pluginOptions: {
    'tw-enigma': {
      priority: 100, // Load after other plugins
    },
  },
  configureWebpack: {
    optimization: {
      splitChunks: {
        cacheGroups: {
          twEnigma: {
            name: 'tw-enigma',
            test: /tw-enigma/,
            chunks: 'all',
          },
        },
      },
    },
  },
};
```

### Nuxt.js Module Issues

**Problem:** TW-Enigma module not loading in Nuxt

**Solution:**
```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@tw-enigma/nuxt',
  ],
  
  twEnigma: {
    configFile: './tw-enigma.config.js',
  },
  
  build: {
    transpile: ['@tw-enigma/nuxt'],
  },
});
```

## Angular-Specific Issues

### Angular CLI Builder Issues

**Problem:** Custom builder not recognized

**Solution:**
```json
// angular.json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@tw-enigma/angular:build",
          "options": {
            "configFile": "tw-enigma.config.js"
          }
        }
      }
    }
  }
}
```

### ViewEncapsulation Conflicts

**Problem:** Angular ViewEncapsulation preventing CSS optimization

**Solution:**
```typescript
// Component with optimized styles
import { Component, ViewEncapsulation } from '@angular/core';
import { TWEnigmaService } from '@tw-enigma/angular';

@Component({
  selector: 'app-component',
  template: `<div [class]="optimizedClasses">Content</div>`,
  encapsulation: ViewEncapsulation.None, // Allow global optimization
})
export class MyComponent {
  constructor(private twEnigma: TWEnigmaService) {}
  
  get optimizedClasses(): string {
    return this.twEnigma.optimizeClasses('bg-blue-500 text-white p-4');
  }
}
```

## Build System Issues

### Webpack Plugin Configuration

**Problem:** TW-Enigma webpack plugin not working

**Solution:**
```javascript
// webpack.config.js
const { TWEnigmaPlugin } = require('@tw-enigma/webpack-plugin');

module.exports = {
  plugins: [
    new TWEnigmaPlugin({
      configFile: './tw-enigma.config.js',
      debug: process.env.NODE_ENV === 'development',
      verbose: true,
      cache: true,
      parallel: true,
    }),
  ],
  
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

### Vite Plugin Issues

**Problem:** Vite plugin not processing CSS

**Solution:**
```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin';

export default defineConfig({
  plugins: [
    twEnigmaPlugin({
      configFile: './tw-enigma.config.js',
      enforce: 'pre',
      css: {
        preprocessorOptions: {
          postcss: {
            plugins: [],
          },
        },
      },
    }),
  ],
});
```

## CSS-in-JS Issues

### Styled Components Not Optimizing

**Problem:** styled-components CSS not being optimized

**Solution:**
```javascript
// tw-enigma.config.js
export default {
  cssInJs: {
    libraries: ['styled-components'],
    styledComponents: {
      babel: {
        displayName: true,
        fileName: true,
      },
      staticExtraction: {
        enabled: true,
        extractTheme: true,
      },
    },
  },
};
```

### Emotion Integration Issues

**Problem:** @emotion/react not working with TW-Enigma

**Solution:**
```javascript
// tw-enigma.config.js
export default {
  cssInJs: {
    libraries: ['@emotion/react'],
    emotion: {
      autoInject: true,
      labelFormat: '[local]',
    },
  },
};
```

## SSR/SSG Issues

### Critical CSS Not Extracting

**Problem:** Critical CSS not being extracted for SSR

**Solution:**
```javascript
export default {
  ssr: {
    criticalCSS: {
      enabled: true,
      detection: {
        viewport: { width: 1200, height: 800 },
        aboveFold: true,
      },
      extraction: {
        removeUnused: true,
        minify: true,
      },
    },
  },
};
```

### FOUC (Flash of Unstyled Content)

**Problem:** Brief flash of unstyled content on page load

**Solution:**
```javascript
export default {
  ssr: {
    fouc: {
      prevention: 'critical-css',
      preloadCritical: true,
      hideUntilStyled: true,
    },
    injection: {
      strategy: 'hybrid',
      inlineCritical: {
        enabled: true,
        maxSize: '50kb',
      },
    },
  },
};
```

## Performance Issues

### Slow Build Times

**Problem:** TW-Enigma significantly slowing build

**Solutions:**

1. **Enable Caching:**
```javascript
export default {
  cache: {
    enabled: true,
    directory: '.tw-enigma-cache',
    ttl: 86400000, // 24 hours
  },
};
```

2. **Optimize Analysis:**
```javascript
export default {
  optimization: {
    parallel: true,
    maxWorkers: 4,
    chunkSize: 1000,
  },
};
```

### Large Bundle Size

**Problem:** CSS bundle larger than expected

**Solution:**
```javascript
export default {
  optimization: {
    strategy: 'atomic',
    threshold: 3,
    removeUnused: true,
    minify: true,
  },
};
```

## Configuration Issues

### Invalid Configuration Schema

**Problem:** Configuration validation errors

**Solution:**
```bash
# Validate configuration
npx tw-enigma validate

# Get schema documentation
npx tw-enigma schema --output schema.json
```

### Environment-Specific Configuration

**Problem:** Different configuration needed per environment

**Solution:**
```javascript
// tw-enigma.config.js
const isDevelopment = process.env.NODE_ENV === 'development';

export default {
  optimization: {
    strategy: 'atomic',
    minify: !isDevelopment,
  },
  development: {
    sourceMaps: isDevelopment,
    hmr: isDevelopment,
  },
  production: {
    removeDebugCode: !isDevelopment,
    optimizeAssets: !isDevelopment,
  },
};
```

## Responsive & Pseudo-Class Optimization Issues

## Common Issues

### Issue: Classes Not Being Optimized

**Symptoms:**

- Output classes are identical to input classes
- No optimization metrics reported
- Performance gains not observed

**Possible Causes:**

1. **Configuration Issue:**

```typescript
// ❌ Incorrect - optimization disabled
const engine = new ResponsiveOptimizationEngine({
  enablePseudoClassOptimization: false,
  enableBreakpointGrouping: false,
  enableComplexPatternHandling: false,
});

// ✅ Correct - optimization enabled
const engine = new ResponsiveOptimizationEngine({
  enablePseudoClassOptimization: true,
  enableBreakpointGrouping: true,
  enableComplexPatternHandling: true,
  aggressiveOptimization: true,
});
```

2. **Insufficient Pattern Complexity:**

```typescript
// ❌ Simple classes may not benefit from optimization
const simpleClasses = ['text-red-500', 'bg-blue-500'];

// ✅ Complex patterns benefit more
const complexClasses = [
  'sm:text-red-500',
  'md:hover:text-blue-600',
  'lg:focus:active:bg-green-500',
];
```

**Solutions:**

- Enable all optimization features
- Increase `aggressiveOptimization` setting
- Ensure input contains responsive/pseudo-class patterns
- Check minimum frequency thresholds

### Issue: Pseudo-Class Order Violations

**Symptoms:**

- Validation errors about LVHA order
- Unexpected CSS specificity issues
- Hover/focus states not working correctly

**Cause:**

```typescript
// ❌ Incorrect LVHA order
const incorrectOrder = [
  'active:text-blue-700',
  'hover:text-blue-600',
  'visited:text-purple-500',
  'link:text-blue-500',
];
```

**Solution:**

```typescript
// ✅ Enable automatic reordering
const pseudoHandler = new PseudoClassHandler({
  enforceLVHAOrder: true,
  enableReordering: true,
  strictValidation: true,
});

// Manual reordering
const correctOrder = [
  'link:text-blue-500',
  'visited:text-purple-500',
  'hover:text-blue-600',
  'active:text-blue-700',
];
```

### Issue: Breakpoint Conflicts

**Symptoms:**

- Media query conflicts in generated CSS
- Responsive behavior not working as expected
- Validation errors about breakpoint order

**Diagnosis:**

```typescript
// Check breakpoint configuration
const engine = new ResponsiveOptimizationEngine({
  strictBreakpointOrder: true, // Enable strict checking
});

// Validate breakpoints
const validation = breakpointEngine.validateBreakpoints(breakpoints);
if (!validation.isValid) {
  console.error('Breakpoint issues:', validation.errors);
}
```

**Common Problems:**

1. **Overlapping Breakpoints:**

```typescript
// ❌ Problematic overlap
const problematicBreakpoints = [
  { name: 'sm', minWidth: 640, maxWidth: 800 },
  { name: 'md', minWidth: 768, maxWidth: 1024 }, // Overlaps with sm
];

// ✅ Correct non-overlapping
const correctBreakpoints = [
  { name: 'sm', minWidth: 640, order: 1 },
  { name: 'md', minWidth: 768, order: 2 },
  { name: 'lg', minWidth: 1024, order: 3 },
];
```

2. **Incorrect Order:**

```typescript
// ❌ Wrong order values
const wrongOrder = [
  { name: 'lg', minWidth: 1024, order: 1 },
  { name: 'sm', minWidth: 640, order: 2 }, // Should be before lg
];

// ✅ Correct order
const correctOrder = [
  { name: 'sm', minWidth: 640, order: 1 },
  { name: 'lg', minWidth: 1024, order: 2 },
];
```

## Configuration Problems

### Invalid Configuration Values

**Error: `ConfigurationError: Invalid merge strategy`**

```typescript
// ❌ Invalid strategy
const config = {
  mergeStrategy: 'invalid-strategy', // Not supported
};

// ✅ Valid strategies
const validConfig = {
  mergeStrategy: 'mobile-first', // or 'desktop-first', 'specificity', 'custom'
};
```

**Error: `ConfigurationError: Cache size must be positive`**

```typescript
// ❌ Invalid cache size
const config = {
  enableCaching: true,
  maxCacheSize: -1, // Must be positive
};

// ✅ Valid cache size
const validConfig = {
  enableCaching: true,
  maxCacheSize: 1000,
};
```

### Missing Required Configuration

**Error: `ConfigurationError: supportedPseudoClasses is required`**

```typescript
// ❌ Missing required config
const pseudoConfig = {
  enforceLVHAOrder: true,
  // Missing supportedPseudoClasses
};

// ✅ Complete configuration
const validPseudoConfig = {
  supportedPseudoClasses: [
    'hover',
    'focus',
    'active',
    'visited',
    'disabled',
    'first-child',
    'last-child',
  ],
  enforceLVHAOrder: true,
  enableOptimization: true,
};
```

### Environment-Specific Issues

**Node.js Version Compatibility:**

```bash
# Check Node.js version
node --version

# TW-Enigma requires Node.js 16+ for optimal performance
# Update if necessary:
nvm install 18
nvm use 18
```

**Memory Configuration:**

```bash
# Increase memory limit for large projects
node --max-old-space-size=8192 your-script.js

# Or set environment variable
export NODE_OPTIONS="--max-old-space-size=8192"
```

## Performance Issues

### Slow Optimization Performance

**Symptoms:**

- Long processing times
- High memory usage
- Process hanging or timing out

**Diagnosis:**

```typescript
// Enable performance monitoring
const engine = new ResponsiveOptimizationEngine({
  includeOptimizationMetrics: true,
  enablePerformanceMonitoring: true,
});

const result = await engine.optimizeClasses(classes);
console.log('Performance metrics:', result.metrics);
```

**Solutions:**

1. **Enable Caching:**

```typescript
const optimizedConfig = {
  enableCaching: true,
  maxCacheSize: 5000,
  cacheStrategy: 'lru',
};
```

2. **Use Parallel Processing:**

```typescript
const parallelConfig = {
  enableParallelProcessing: true,
  parallelThreshold: 100, // Process in parallel if > 100 classes
};
```

3. **Reduce Optimization Complexity:**

```typescript
const lightweightConfig = {
  aggressiveOptimization: false,
  enableComplexPatternHandling: false,
  strictMode: false,
};
```

4. **Batch Processing:**

```typescript
async function processBatches(allClasses: string[]) {
  const batchSize = 500;
  const results = [];

  for (let i = 0; i < allClasses.length; i += batchSize) {
    const batch = allClasses.slice(i, i + batchSize);
    const result = await engine.optimizeClasses(batch);
    results.push(result);

    // Allow garbage collection between batches
    if (i % 2000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results;
}
```

### Memory Leaks

**Symptoms:**

- Continuously increasing memory usage
- Out of memory errors
- Degrading performance over time

**Detection:**

```typescript
// Monitor memory usage
function logMemoryUsage() {
  const used = process.memoryUsage();
  console.log('Memory usage:');
  for (let key in used) {
    console.log(`${key}: ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`);
  }
}

// Clear caches periodically
setInterval(() => {
  engine.clearCache();
  if (global.gc) global.gc(); // If --expose-gc flag is used
  logMemoryUsage();
}, 60000); // Every minute
```

**Solutions:**

```typescript
// Limit cache size
const memoryEfficientConfig = {
  enableCaching: true,
  maxCacheSize: 500, // Smaller cache
  enableParallelProcessing: false, // Reduce memory overhead
};

// Clear resources explicitly
function cleanup() {
  engine.clearCache();
  breakpointEngine.clearCache();
  complexHandler.clearCache();
}

// Call cleanup after processing
await processClasses();
cleanup();
```

## Validation Errors

### Strict Mode Validation Failures

**Error: `ValidationError: Breakpoint order violation`**

```typescript
// ❌ Classes in wrong order
const classes = [
  'lg:text-blue-500',
  'sm:text-red-500', // Should come before lg
];

// Solutions:
// 1. Disable strict mode
const relaxedConfig = {
  strictBreakpointOrder: false,
};

// 2. Enable automatic reordering
const reorderingConfig = {
  strictBreakpointOrder: true,
  enableReordering: true, // Auto-fix order issues
};

// 3. Manual reordering
const orderedClasses = ['sm:text-red-500', 'lg:text-blue-500'];
```

**Error: `ValidationError: Unsupported pseudo-class`**

```typescript
// ❌ Using unsupported pseudo-class
const classes = ['custom-pseudo:text-blue-500'];

// Solutions:
// 1. Add to supported list
const expandedConfig = {
  supportedPseudoClasses: [
    'hover',
    'focus',
    'active',
    'custom-pseudo', // Add custom pseudo-class
  ],
  allowCustomPseudoClasses: true,
};

// 2. Disable strict validation
const permissiveConfig = {
  strictValidation: false,
  errorOnUnsupportedPseudoClass: false,
};
```

### Pattern Complexity Errors

**Error: `ValidationError: Pattern complexity exceeds maximum`**

```typescript
// ❌ Overly complex pattern
const complexPattern = 'xl:dark:group-hover:peer-focus:first:last:odd:even:disabled:text-blue-500';

// Solutions:
// 1. Increase complexity threshold
const higherThresholdConfig = {
  validation: {
    maxComplexityScore: 15, // Increase from default 10
    warnOnHighComplexity: true,
  },
};

// 2. Simplify patterns
const simplifiedPatterns = [
  'xl:group-hover:text-blue-500',
  'xl:peer-focus:text-blue-500',
  'xl:disabled:text-blue-500',
];

// 3. Disable complexity checking
const noComplexityConfig = {
  validation: {
    warnOnHighComplexity: false,
    maxComplexityScore: 100,
  },
};
```

## Integration Problems

### Build System Integration Issues

**Webpack Plugin Not Working:**

```javascript
// ❌ Incorrect plugin configuration
const { TailwindEnigmaPlugin } = require('@tw-enigma/webpack-plugin');

module.exports = {
  plugins: [
    new TailwindEnigmaPlugin(), // Missing configuration
  ],
};

// ✅ Correct configuration
module.exports = {
  plugins: [
    new TailwindEnigmaPlugin({
      enablePseudoClassOptimization: true,
      enableBreakpointGrouping: true,
      aggressiveOptimization: true,
      // Specify input files
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
};
```

**Vite Integration Issues:**

```typescript
// ❌ Plugin not properly registered
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // Missing TW-Enigma plugin
  ],
});

// ✅ Correct Vite setup
import { defineConfig } from 'vite';
import { tailwindEnigma } from '@tw-enigma/vite-plugin';

export default defineConfig({
  plugins: [
    tailwindEnigma({
      configPath: './tw-enigma.config.js',
      enableDevelopmentMode: process.env.NODE_ENV === 'development',
    }),
  ],
});
```

### CSS Framework Conflicts

**Tailwind CSS Conflicts:**

```css
/* ❌ Conflicting order */
@import 'tailwindcss/base';
@import './optimized-classes.css'; /* Should come after utilities */
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* ✅ Correct order */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';
@import './optimized-classes.css'; /* After utilities */
```

**PostCSS Configuration:**

```javascript
// ❌ Wrong plugin order
module.exports = {
  plugins: [
    require('@tw-enigma/postcss-plugin'),
    require('tailwindcss'), // Should come first
    require('autoprefixer'),
  ],
};

// ✅ Correct plugin order
module.exports = {
  plugins: [require('tailwindcss'), require('@tw-enigma/postcss-plugin'), require('autoprefixer')],
};
```

## Debugging Techniques

### Enable Debug Logging

```typescript
// Enable comprehensive logging
const engine = new ResponsiveOptimizationEngine({
  // Enable all debugging features
  includeOptimizationMetrics: true,
  errorReporting: 'console',
  strictMode: true, // Catch issues early

  // Add debug configuration
  debug: {
    enableVerboseLogging: true,
    logPerformanceMetrics: true,
    logCacheOperations: true,
    logValidationDetails: true,
  },
});

// Log detailed results
const result = await engine.optimizeClasses(classes);
console.log('Optimization Details:');
console.log('- Input classes:', result.originalClasses.length);
console.log('- Output classes:', result.optimizedClasses.length);
console.log('- Reduction:', `${result.reductionPercentage}%`);
console.log('- Cache hits:', result.metrics.cacheHits);
console.log('- Processing time:', `${result.metrics.totalTime}ms`);

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}

if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}
```

### Step-by-Step Analysis

```typescript
async function debugOptimization(classes: string[]) {
  console.log('🔍 Starting debug analysis...');

  // Step 1: Validate input
  console.log('Step 1: Input validation');
  const validClasses = classes.filter((cls) => typeof cls === 'string' && cls.trim().length > 0);
  console.log(`- Valid classes: ${validClasses.length}/${classes.length}`);

  // Step 2: Parse patterns
  console.log('Step 2: Pattern parsing');
  const patterns = validClasses
    .map((cls) => {
      try {
        return parsePattern(cls);
      } catch (error) {
        console.warn(`- Failed to parse: ${cls}`, error.message);
        return null;
      }
    })
    .filter(Boolean);
  console.log(`- Parsed patterns: ${patterns.length}`);

  // Step 3: Analyze complexity
  console.log('Step 3: Complexity analysis');
  const complexPatterns = patterns.filter((p) => p.complexityScore > 5);
  console.log(`- Complex patterns: ${complexPatterns.length}`);

  // Step 4: Group patterns
  console.log('Step 4: Pattern grouping');
  const groupingEngine = new PatternGroupingEngine(groupingConfig);
  const groupingResult = groupingEngine.groupPatterns(patterns);
  console.log(`- Groups created: ${groupingResult.groups.length}`);

  // Step 5: Merge patterns
  console.log('Step 5: Pattern merging');
  const mergingEngine = new PatternMergingEngine(mergingConfig);
  const mergingResult = mergingEngine.mergePatterns(patterns);
  console.log(`- Patterns merged: ${mergingResult.mergedPatterns.length}`);
  console.log(`- Conflicts: ${mergingResult.conflicts.length}`);

  // Step 6: Final optimization
  console.log('Step 6: Final optimization');
  const result = await engine.optimizeClasses(validClasses);
  console.log(`- Final reduction: ${result.reductionPercentage}%`);

  return result;
}
```

### Performance Profiling

```typescript
// Create a performance profiler
class OptimizationProfiler {
  private startTime: number = 0;
  private measurements: Map<string, number> = new Map();

  start(label: string) {
    this.startTime = performance.now();
    this.measurements.set(`${label}_start`, this.startTime);
  }

  end(label: string) {
    const endTime = performance.now();
    const startTime = this.measurements.get(`${label}_start`) || 0;
    const duration = endTime - startTime;
    this.measurements.set(label, duration);
    console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  getReport() {
    const report: Record<string, number> = {};
    for (const [key, value] of this.measurements) {
      if (!key.endsWith('_start')) {
        report[key] = value;
      }
    }
    return report;
  }
}

// Use profiler
async function profiledOptimization(classes: string[]) {
  const profiler = new OptimizationProfiler();

  profiler.start('total');

  profiler.start('parsing');
  const patterns = classes.map(parsePattern);
  profiler.end('parsing');

  profiler.start('grouping');
  const groupingResult = groupingEngine.groupPatterns(patterns);
  profiler.end('grouping');

  profiler.start('merging');
  const mergingResult = mergingEngine.mergePatterns(patterns);
  profiler.end('merging');

  profiler.start('optimization');
  const result = await engine.optimizeClasses(classes);
  profiler.end('optimization');

  profiler.end('total');

  console.log('📊 Performance Report:', profiler.getReport());

  return result;
}
```

### Common Solutions Summary

| Issue                | Quick Fix             | Long-term Solution               |
| -------------------- | --------------------- | -------------------------------- |
| Slow performance     | Enable caching        | Implement batch processing       |
| Memory leaks         | Clear caches manually | Reduce cache size, use streaming |
| Validation errors    | Disable strict mode   | Fix input patterns               |
| Configuration errors | Use defaults          | Validate config with schema      |
| Integration issues   | Check plugin order    | Use official integrations        |
| CSS conflicts        | Adjust import order   | Use CSS layers                   |

For additional help, check the [GitHub Issues](https://github.com/tw-enigma/tw-enigma/issues) or [Documentation](./RESPONSIVE_PSEUDOCLASS_OPTIMIZATION.md).
