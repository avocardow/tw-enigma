# CSS-in-JS Integration Guide

## Overview

TW-Enigma provides comprehensive support for CSS-in-JS libraries across React, Vue, and Angular frameworks. This guide covers integration strategies, optimization techniques, and best practices for CSS-in-JS workflows.

## Table of Contents

1. [Supported Libraries](#supported-libraries)
2. [React CSS-in-JS Integration](#react-css-in-js-integration)
3. [Vue CSS-in-JS Integration](#vue-css-in-js-integration)
4. [Angular CSS-in-JS Integration](#angular-css-in-js-integration)
5. [Static Extraction](#static-extraction)
6. [Runtime Optimization](#runtime-optimization)
7. [Theme Integration](#theme-integration)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)

## Supported Libraries

### React CSS-in-JS Libraries

| Library | Support Level | Static Extraction | Theme Support | SSR Compatible |
|---------|---------------|-------------------|---------------|----------------|
| **styled-components** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **@emotion/react** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **@emotion/styled** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **styled-jsx** | ✅ Full | ✅ Yes | ✅ Limited | ✅ Yes |
| **stitches** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **vanilla-extract** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **twin.macro** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **@compiled/react** | ✅ Beta | ✅ Yes | ✅ Limited | ✅ Yes |
| **goober** | ✅ Basic | ✅ Limited | ✅ Limited | ✅ Yes |
| **jss** | ✅ Basic | ✅ Limited | ✅ Yes | ✅ Yes |

### Vue CSS-in-JS Libraries

| Library | Support Level | Static Extraction | Theme Support | SSR Compatible |
|---------|---------------|-------------------|---------------|----------------|
| **vue-styled-components** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **@emotion/vue** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **styled-vue** | ✅ Beta | ✅ Limited | ✅ Limited | ✅ Yes |

### Angular CSS-in-JS Libraries

| Library | Support Level | Static Extraction | Theme Support | SSR Compatible |
|---------|---------------|-------------------|---------------|----------------|
| **@angular/material** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |
| **ng-zorro-antd** | ✅ Full | ✅ Yes | ✅ Yes | ✅ Yes |

### Universal Libraries

| Library | Support Level | Framework Support | Static Extraction |
|---------|---------------|-------------------|-------------------|
| **linaria** | ✅ Full | React, Vue | ✅ Yes |
| **fela** | ✅ Basic | React, Vue | ✅ Limited |
| **style9** | ✅ Beta | React | ✅ Yes |

## React CSS-in-JS Integration

### styled-components Integration

#### Basic Setup

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-cra',
  
  cssInJs: {
    libraries: ['styled-components'],
    
    styledComponents: {
      // Static extraction
      staticExtraction: {
        enabled: true,
        extractTheme: true,
        extractHelpers: true,
      },
      
      // Runtime optimization
      runtime: {
        optimizeSelectors: true,
        deduplicateStyles: true,
        minifyStyles: true,
      },
      
      // SSR configuration
      ssr: {
        extractServerCSS: true,
        inlineStyles: false,
      },
    },
  },
};
```

#### Advanced Configuration

```javascript
export default {
  cssInJs: {
    styledComponents: {
      // Babel plugin configuration
      babel: {
        displayName: true,
        fileName: true,
        meaninglessFileNames: ['index', 'styles'],
        namespace: 'tw-enigma',
        topLevelImportPaths: ['@tw-enigma/styled'],
      },
      
      // Theme extraction
      theme: {
        extractVariables: true,
        variablePrefix: '--tw-',
        generateTypes: true,
        outputPath: './src/types/theme.d.ts',
      },
      
      // Component analysis
      components: {
        analyzeUsage: true,
        optimizeProps: true,
        eliminateDeadCode: true,
      },
    },
  },
};
```

#### Usage Example

```typescript
// components/Button.tsx
import styled from 'styled-components';
import tw from 'twin.macro';

const Button = styled.button<{ variant: 'primary' | 'secondary' }>`
  ${tw`px-4 py-2 rounded font-medium transition-colors`}
  
  ${({ variant }) => variant === 'primary' && tw`bg-blue-600 text-white hover:bg-blue-700`}
  ${({ variant }) => variant === 'secondary' && tw`bg-gray-200 text-gray-900 hover:bg-gray-300`}
`;

// TW-Enigma will automatically extract and optimize these Tailwind classes
export default Button;
```

### Emotion Integration

#### @emotion/react Setup

```javascript
// tw-enigma.config.js
export default {
  preset: 'react-vite',
  
  cssInJs: {
    libraries: ['@emotion/react'],
    
    emotion: {
      // Auto-inject runtime
      autoInject: true,
      
      // Static extraction
      staticExtraction: {
        enabled: true,
        cssFilePattern: 'extracted-emotion.css',
        extractToFiles: true,
      },
      
      // Development features
      development: {
        sourceMap: true,
        autoLabel: true,
        labelFormat: '[local]',
      },
      
      // Production optimizations
      production: {
        minify: true,
        removeSourceMaps: true,
        optimizeAtoms: true,
      },
    },
  },
};
```

#### Usage with css prop

```typescript
// components/Card.tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import tw from 'twin.macro';

const cardStyles = css`
  ${tw`bg-white rounded-lg shadow-md p-6`}
  
  &:hover {
    ${tw`shadow-lg`}
  }
`;

export function Card({ children }: { children: React.ReactNode }) {
  return <div css={cardStyles}>{children}</div>;
}
```

### Stitches Integration

```javascript
// tw-enigma.config.js
export default {
  cssInJs: {
    libraries: ['stitches'],
    
    stitches: {
      // Theme integration
      theme: {
        extractTokens: true,
        generateCSS: true,
        outputPath: './stitches.config.ts',
      },
      
      // Variant optimization
      variants: {
        optimizeComputation: true,
        staticVariants: true,
        deduplicateProps: true,
      },
      
      // Utils integration
      utils: {
        includeTailwindUtils: true,
        customUtilsPath: './src/utils/stitches.ts',
      },
    },
  },
};
```

## Vue CSS-in-JS Integration

### vue-styled-components Integration

```javascript
// tw-enigma.config.js
export default {
  preset: 'vue-vite',
  
  cssInJs: {
    libraries: ['vue-styled-components'],
    
    vueStyledComponents: {
      // Static extraction
      staticExtraction: {
        enabled: true,
        extractScoped: true,
        extractGlobal: true,
      },
      
      // Vue-specific optimizations
      vue: {
        optimizeDirectives: true,
        scopedStylesIntegration: true,
        reactivityOptimization: true,
      },
    },
  },
};
```

#### Usage Example

```vue
<!-- components/VueButton.vue -->
<template>
  <StyledButton :variant="variant" @click="handleClick">
    <slot />
  </StyledButton>
</template>

<script setup lang="ts">
import styled from 'vue-styled-components';

const buttonProps = {
  variant: String,
};

const StyledButton = styled('button', buttonProps)`
  @apply px-4 py-2 rounded font-medium transition-colors;
  
  ${props => props.variant === 'primary' && `
    @apply bg-blue-600 text-white hover:bg-blue-700;
  `}
  
  ${props => props.variant === 'secondary' && `
    @apply bg-gray-200 text-gray-900 hover:bg-gray-300;
  `}
`;

defineProps<{
  variant: 'primary' | 'secondary';
}>();

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (event: MouseEvent) => {
  emit('click', event);
};
</script>
```

### Single File Component Integration

```javascript
// tw-enigma.config.js
export default {
  cssInJs: {
    vue: {
      // SFC style block analysis
      sfc: {
        analyzeStyleBlocks: true,
        extractUtilities: true,
        optimizeScoped: true,
      },
      
      // Composition API integration
      compositionApi: {
        optimizeReactiveStyles: true,
        extractComputedStyles: true,
      },
    },
  },
};
```

## Angular CSS-in-JS Integration

### Angular Material Integration

```javascript
// tw-enigma.config.js
export default {
  preset: 'angular-cli',
  
  cssInJs: {
    libraries: ['@angular/material'],
    
    angularMaterial: {
      // Theme integration
      theme: {
        extractCustomTheme: true,
        optimizePalette: true,
        generateVariables: true,
      },
      
      // Component optimization
      components: {
        optimizeImports: true,
        treeShakeComponents: true,
        bundleOptimization: true,
      },
      
      // Angular-specific features
      angular: {
        viewEncapsulation: 'Emulated',
        changeDetectionOptimization: true,
      },
    },
  },
};
```

#### Usage Example

```typescript
// components/material-button.component.ts
import { Component, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';

@Component({
  selector: 'app-material-button',
  template: `
    <button 
      mat-raised-button 
      [color]="color"
      [class]="computedClasses"
      (click)="handleClick()"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    :host {
      @apply inline-block;
    }
    
    .custom-primary {
      @apply bg-blue-600 text-white hover:bg-blue-700;
    }
    
    .custom-secondary {
      @apply bg-gray-200 text-gray-900 hover:bg-gray-300;
    }
  `]
})
export class MaterialButtonComponent {
  @Input() color: ThemePalette = 'primary';
  @Input() variant: 'primary' | 'secondary' = 'primary';
  
  get computedClasses(): string {
    return `custom-${this.variant}`;
  }
  
  handleClick(): void {
    // Handle click
  }
}
```

## Static Extraction

### Configuration

```javascript
export default {
  cssInJs: {
    staticExtraction: {
      // Enable extraction
      enabled: true,
      
      // Extraction strategy
      strategy: 'build-time', // 'build-time', 'runtime', 'hybrid'
      
      // Output configuration
      output: {
        directory: 'dist/css',
        filename: '[name].[hash].css',
        sourceMap: true,
      },
      
      // Extraction rules
      rules: {
        // Extract by library
        byLibrary: {
          'styled-components': 'styled-components.css',
          '@emotion/react': 'emotion.css',
        },
        
        // Extract by component
        byComponent: true,
        componentPattern: 'components/[name].css',
        
        // Extract by route
        byRoute: true,
        routePattern: 'routes/[route].css',
      },
      
      // Optimization during extraction
      optimize: {
        deduplicate: true,
        minify: true,
        removeUnused: true,
        mergeSimilar: true,
      },
    },
  },
};
```

### Build-Time Extraction

```javascript
// Build script integration
const { extractCSSInJS } = require('@tw-enigma/core');

async function buildWithExtraction() {
  // Regular build
  await build();
  
  // Extract CSS-in-JS
  await extractCSSInJS({
    sourceDir: 'src',
    outputDir: 'dist/css',
    libraries: ['styled-components', '@emotion/react'],
    optimize: true,
  });
}
```

### Runtime Extraction

```typescript
// Runtime extraction hook
import { useExtractedCSS } from '@tw-enigma/react';

function App() {
  // Extract CSS for current component tree
  const extractedCSS = useExtractedCSS({
    autoInject: true,
    deduplicate: true,
  });
  
  return (
    <div>
      {/* App content */}
    </div>
  );
}
```

## Runtime Optimization

### Performance Monitoring

```javascript
export default {
  cssInJs: {
    runtime: {
      // Performance monitoring
      monitoring: {
        enabled: true,
        trackMetrics: ['renderTime', 'styleInjection', 'cacheHits'],
        reportInterval: 5000,
      },
      
      // Optimization strategies
      optimization: {
        // Cache computed styles
        caching: {
          enabled: true,
          maxCacheSize: 1000,
          ttl: 300000, // 5 minutes
        },
        
        // Batch style updates
        batching: {
          enabled: true,
          batchSize: 50,
          debounceTime: 16, // ~60fps
        },
        
        // Lazy load styles
        lazyLoading: {
          enabled: true,
          threshold: '100px',
          rootMargin: '50px',
        },
      },
    },
  },
};
```

### Memory Management

```javascript
export default {
  cssInJs: {
    runtime: {
      memory: {
        // Garbage collection
        gc: {
          enabled: true,
          interval: 30000, // 30 seconds
          memoryThreshold: '50mb',
        },
        
        // Style cleanup
        cleanup: {
          removeUnusedStyles: true,
          cleanupInterval: 60000, // 1 minute
          retainCount: 100,
        },
        
        // Memory limits
        limits: {
          maxStyleSheets: 20,
          maxStylesPerSheet: 1000,
          maxCacheEntries: 500,
        },
      },
    },
  },
};
```

## Theme Integration

### Theme Extraction

```javascript
export default {
  cssInJs: {
    theme: {
      // Extract theme tokens
      extraction: {
        enabled: true,
        extractColors: true,
        extractSpacing: true,
        extractTypography: true,
        extractBreakpoints: true,
      },
      
      // Theme optimization
      optimization: {
        deduplicateTokens: true,
        generateVariables: true,
        createUtilities: true,
      },
      
      // Output configuration
      output: {
        cssVariables: 'theme/variables.css',
        jsonTokens: 'theme/tokens.json',
        typeDefinitions: 'theme/types.ts',
      },
    },
  },
};
```

### Dynamic Theming

```typescript
// theme/provider.tsx
import { createContext, useContext } from 'react';
import { useThemeOptimization } from '@tw-enigma/react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children, theme }) {
  const optimizedTheme = useThemeOptimization(theme, {
    extractVariables: true,
    optimizeColors: true,
    generateUtilities: true,
  });
  
  return (
    <ThemeContext.Provider value={optimizedTheme}>
      {children}
    </ThemeContext.Provider>
  );
}
```

## Performance Optimization

### Bundle Size Optimization

```javascript
export default {
  cssInJs: {
    bundleOptimization: {
      // Tree shaking
      treeShaking: {
        enabled: true,
        aggressiveElimination: true,
        preserveImportant: true,
      },
      
      // Code splitting
      codeSplitting: {
        enabled: true,
        strategy: 'component', // 'component', 'route', 'library'
        chunkSize: '50kb',
      },
      
      // Compression
      compression: {
        enabled: true,
        algorithm: 'gzip', // 'gzip', 'brotli'
        level: 9,
      },
    },
  },
};
```

### Runtime Performance

```javascript
export default {
  cssInJs: {
    runtime: {
      // Fast path optimizations
      fastPath: {
        enabled: true,
        cacheFrequentStyles: true,
        precomputeCommonPatterns: true,
        optimizeHotPaths: true,
      },
      
      // Virtualization
      virtualization: {
        enabled: true,
        windowSize: 100,
        bufferSize: 20,
      },
      
      // Web Workers
      webWorkers: {
        enabled: true,
        workerCount: 2,
        offloadTasks: ['parsing', 'optimization', 'caching'],
      },
    },
  },
};
```

## Troubleshooting

### Common Issues

#### Styles Not Applying

**Problem**: CSS-in-JS styles not applying correctly

**Solution**:

```javascript
// Check library detection
export default {
  cssInJs: {
    debug: {
      enabled: true,
      logLevel: 'verbose',
      trackInjection: true,
    },
    
    // Force library detection
    libraries: ['styled-components'], // Explicit declaration
    
    // Ensure proper initialization
    autoInit: true,
  },
};
```

#### Performance Issues

**Problem**: Slow style injection or computation

**Solution**:

```javascript
export default {
  cssInJs: {
    runtime: {
      // Enable caching
      caching: {
        enabled: true,
        strategy: 'lru',
        maxSize: 1000,
      },
      
      // Batch updates
      batching: {
        enabled: true,
        debounceTime: 16,
      },
      
      // Use Web Workers
      webWorkers: {
        enabled: true,
        tasks: ['computation', 'caching'],
      },
    },
  },
};
```

#### SSR Hydration Mismatches

**Problem**: Server and client CSS differ

**Solution**:

```javascript
export default {
  cssInJs: {
    ssr: {
      // Ensure consistent extraction
      consistentExtraction: true,
      
      // Use deterministic class names
      deterministicClassNames: true,
      
      // Suppress hydration warnings in development
      suppressHydrationWarnings: process.env.NODE_ENV === 'development',
    },
  },
};
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Debug CSS-in-JS processing
DEBUG=tw-enigma:css-in-js npm run dev

# Debug specific library
DEBUG=tw-enigma:css-in-js:styled-components npm run build

# Debug runtime performance
DEBUG=tw-enigma:css-in-js:runtime npm start
```

### Performance Profiling

```javascript
export default {
  cssInJs: {
    profiling: {
      enabled: true,
      
      // Profile extraction performance
      extraction: {
        measureTime: true,
        trackMemory: true,
        reportBottlenecks: true,
      },
      
      // Profile runtime performance
      runtime: {
        measureInjection: true,
        trackCachePerformance: true,
        monitorMemoryUsage: true,
      },
      
      // Output profiling reports
      output: {
        directory: 'profiles',
        format: 'json',
        includeStackTraces: true,
      },
    },
  },
};
```

---

CSS-in-JS integration in TW-Enigma provides powerful optimization capabilities while maintaining the developer experience you expect from modern CSS-in-JS libraries. Choose the appropriate configuration for your library and framework combination, then fine-tune for optimal performance.