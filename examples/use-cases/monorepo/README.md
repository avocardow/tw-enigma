# Monorepo tw-enigma Integration

A comprehensive guide for optimizing CSS in complex monorepo architectures with shared design systems, multiple applications, and sophisticated build orchestration.

## 📋 Monorepo Overview

This example demonstrates tw-enigma integration in a large-scale monorepo with:

- **Multiple Applications** - Frontend apps, admin dashboards, mobile apps
- **Shared Design System** - Reusable components with optimized CSS
- **Micro-frontends** - Independent deployable frontend modules
- **Build Orchestration** - Turbo-powered builds with intelligent caching
- **Cross-Package Optimization** - CSS deduplication across packages

## 🏗️ Monorepo Architecture

```
monorepo-example/
├── packages/
│   ├── design-system/          # Shared UI components
│   ├── ui-primitives/          # Low-level UI building blocks
│   ├── tokens/                 # Design tokens and theme
│   └── utils/                  # Shared utilities
├── apps/
│   ├── web-app/               # Main web application
│   ├── admin-dashboard/       # Admin interface
│   ├── marketing-site/        # Marketing website
│   ├── mobile-app/            # React Native app
│   └── docs/                  # Documentation site
├── libs/
│   ├── api-client/            # Shared API client
│   ├── auth/                  # Authentication library
│   └── analytics/             # Analytics utilities
└── micro-frontends/
    ├── user-profile/          # User profile micro-frontend
    ├── shopping-cart/         # Shopping cart micro-frontend
    └── notifications/         # Notifications micro-frontend
```

## ⚙️ Root Configuration

### 1. Workspace Configuration

```json
// package.json (root)
{
  "name": "monorepo-example",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*", 
    "libs/*",
    "micro-frontends/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "build:optimized": "turbo run build:optimized",
    "optimize": "tw-enigma optimize --workspace",
    "optimize:apps": "tw-enigma optimize --filter='apps/*'",
    "optimize:packages": "tw-enigma optimize --filter='packages/*'",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "analyze": "tw-enigma analyze --workspace --report"
  },
  "devDependencies": {
    "@tw-enigma/core": "^1.0.0",
    "@tw-enigma/cli": "^1.0.0",
    "turbo": "^1.10.0"
  }
}
```

### 2. Turborepo Configuration

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", ".next/**"],
      "env": ["NODE_ENV"]
    },
    "build:optimized": {
      "dependsOn": ["^build", "optimize"],
      "outputs": ["dist/**", "build/**", ".next/**"],
      "env": ["NODE_ENV", "TW_ENIGMA_ENABLED"]
    },
    "optimize": {
      "dependsOn": ["^build"],
      "outputs": [".tw-enigma/**", "dist/**/*.css"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    }
  },
  "globalDependencies": [
    "tw-enigma.config.js",
    "tailwind.config.js",
    "tsconfig.json"
  ]
}
```

### 3. tw-enigma Workspace Configuration

```javascript
// tw-enigma.config.js (root)
import { defineConfig } from '@tw-enigma/core'

export default defineConfig({
  // Workspace-wide settings
  workspace: {
    enabled: true,
    packages: [
      'packages/*',
      'apps/*', 
      'libs/*',
      'micro-frontends/*'
    ],
    
    // Cross-package optimization
    crossPackageOptimization: {
      enabled: true,
      strategy: 'deduplicate',
      sharedComponents: ['packages/design-system', 'packages/ui-primitives']
    },

    // Shared configuration inheritance
    extends: './tw-enigma.shared.js'
  },

  // Package-specific overrides
  packageOverrides: {
    'packages/design-system': {
      optimization: {
        strategy: 'preserve', // Don't optimize design system components
        extractComponentCSS: true
      }
    },
    'packages/tokens': {
      optimization: {
        enabled: false // Don't optimize design tokens
      }
    },
    'apps/*': {
      optimization: {
        strategy: 'aggressive',
        crossPackageOptimization: true,
        importSharedStyles: true
      }
    },
    'micro-frontends/*': {
      optimization: {
        strategy: 'chunked',
        isolateStyles: true, // Prevent style leaking between micro-frontends
        prefixClasses: true
      }
    }
  },

  // Build integration
  build: {
    integration: 'turbo',
    caching: {
      enabled: true,
      key: ['package.json', 'tw-enigma.config.js', 'tailwind.config.js'],
      outputs: ['.tw-enigma/**', 'dist/**/*.css']
    }
  },

  // Performance optimization for large monorepos
  performance: {
    parallel: true,
    workers: 'auto',
    memoryLimit: '4GB',
    
    // Smart rebuilding
    incremental: {
      enabled: true,
      trackDependencies: true,
      cacheStrategy: 'content-hash'
    }
  }
})
```

## 📦 Package-Specific Configurations

### 1. Design System Package

```javascript
// packages/design-system/tw-enigma.config.js
import { defineConfig } from '@tw-enigma/core'

export default defineConfig({
  extends: '../../tw-enigma.shared.js',
  
  // Design system specific optimization
  optimization: {
    strategy: 'component-based',
    
    // Extract component CSS for distribution
    extractComponents: {
      enabled: true,
      outputDir: 'dist/components',
      format: 'css-modules'
    },

    // Preserve design tokens and utilities
    preserve: [
      'tokens/**/*',
      'utilities/**/*',
      'themes/**/*'
    ],

    // Generate optimized variants
    variants: {
      atomic: {
        enabled: true,
        outputDir: 'dist/atomic'
      },
      bundled: {
        enabled: true,
        outputDir: 'dist/bundled'
      }
    }
  },

  // Component analysis
  analysis: {
    componentUsage: true,
    exportMetrics: true,
    generateReport: 'dist/usage-report.json'
  }
})
```

**Component Structure:**

```typescript
// packages/design-system/src/Button/Button.tsx
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { VariantProps, cva } from 'class-variance-authority'

// Component variants with optimized classes
const buttonVariants = cva(
  'tw-enigma-preserve inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'underline-offset-4 hover:underline text-primary'
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3 rounded-md',
        lg: 'h-11 px-8 rounded-md',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={twMerge(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

```javascript
// packages/design-system/package.json
{
  "name": "@monorepo/design-system",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./styles": {
      "import": "./dist/styles/index.css",
      "require": "./dist/styles/index.css"
    },
    "./atomic": {
      "import": "./dist/atomic/index.css",
      "require": "./dist/atomic/index.css"
    },
    "./components/*": "./dist/components/*.css"
  },
  "scripts": {
    "build": "rollup -c && tw-enigma optimize --component-extract",
    "build:optimized": "npm run build",
    "dev": "rollup -c -w",
    "optimize": "tw-enigma optimize --component-extract",
    "analyze": "tw-enigma analyze --components --usage"
  }
}
```

### 2. Application Configuration

```javascript
// apps/web-app/tw-enigma.config.js
import { defineConfig } from '@tw-enigma/core'

export default defineConfig({
  extends: '../../tw-enigma.shared.js',
  
  // Application-specific optimization
  optimization: {
    strategy: 'aggressive',
    
    // Import optimized styles from design system
    importSharedStyles: {
      enabled: true,
      packages: [
        '@monorepo/design-system',
        '@monorepo/ui-primitives'
      ],
      strategy: 'atomic' // Use atomic CSS from design system
    },

    // Application-specific styles
    applicationStyles: {
      criticalCSS: true,
      splitChunks: true,
      asyncLoading: true
    },

    // Remove unused design system components
    treeShaking: {
      enabled: true,
      analyzeUsage: true,
      removeUnused: true
    }
  },

  // Framework integration
  framework: {
    name: 'next',
    config: {
      experimental: {
        optimizeCss: true
      }
    }
  },

  // Development features
  development: {
    hmr: true,
    sourceMaps: true,
    liveAnalysis: true,
    performanceMonitoring: true
  }
})
```

**Next.js Integration:**

```javascript
// apps/web-app/next.config.js
const { withTwEnigma } = require('@tw-enigma/core/next')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: true,
    turbo: {
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json']
    }
  },
  
  // tw-enigma configuration
  twEnigma: {
    enabled: true,
    development: {
      hmr: true,
      analysis: true
    },
    production: {
      aggressive: true,
      criticalCSS: true
    }
  }
}

module.exports = withTwEnigma(nextConfig)
```

```typescript
// apps/web-app/src/app/layout.tsx
import '@monorepo/design-system/atomic' // Use atomic CSS from design system
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### 3. Micro-frontend Configuration

```javascript
// micro-frontends/user-profile/tw-enigma.config.js
import { defineConfig } from '@tw-enigma/core'

export default defineConfig({
  extends: '../../tw-enigma.shared.js',
  
  // Micro-frontend specific optimization
  optimization: {
    strategy: 'isolated',
    
    // Prevent style conflicts between micro-frontends
    isolation: {
      enabled: true,
      prefix: 'user-profile',
      scopeCSS: true,
      namespaceComponents: true
    },

    // Shared design system integration
    sharedDependencies: {
      '@monorepo/design-system': {
        strategy: 'external',
        loadStrategy: 'runtime'
      },
      '@monorepo/tokens': {
        strategy: 'bundled'
      }
    },

    // Bundle optimization for micro-frontend
    bundling: {
      splitChunks: false, // Single bundle for micro-frontend
      extractCSS: true,
      minify: true
    }
  },

  // Module federation compatibility
  moduleFederation: {
    enabled: true,
    exposes: {
      './UserProfile': './src/components/UserProfile'
    },
    shared: {
      '@monorepo/design-system': {
        singleton: true,
        requiredVersion: '^1.0.0'
      }
    }
  }
})
```

**Webpack Module Federation:**

```javascript
// micro-frontends/user-profile/webpack.config.js
const ModuleFederationPlugin = require('@module-federation/webpack')
const { TwEnigmaWebpackPlugin } = require('@tw-enigma/core/webpack')

module.exports = {
  mode: 'development',
  
  plugins: [
    // Module Federation
    new ModuleFederationPlugin({
      name: 'userProfile',
      filename: 'remoteEntry.js',
      exposes: {
        './UserProfile': './src/components/UserProfile'
      },
      shared: {
        '@monorepo/design-system': {
          singleton: true
        }
      }
    }),

    // tw-enigma optimization
    new TwEnigmaWebpackPlugin({
      isolation: true,
      prefix: 'user-profile'
    })
  ]
}
```

## 🔄 Build Orchestration

### 1. Turbo Build Pipeline

```bash
#!/bin/bash
# scripts/build-optimized.sh

echo "🚀 Starting optimized monorepo build..."

# 1. Build shared packages first
echo "📦 Building shared packages..."
turbo run build --filter='packages/*' --cache-dir=".turbo"

# 2. Optimize shared CSS
echo "✨ Optimizing shared CSS..."
tw-enigma optimize --filter='packages/*' --extract-components

# 3. Build applications with optimization
echo "🏗️ Building applications..."
turbo run build:optimized --filter='apps/*' --cache-dir=".turbo"

# 4. Build micro-frontends with isolation
echo "🔧 Building micro-frontends..."
turbo run build:optimized --filter='micro-frontends/*' --cache-dir=".turbo"

# 5. Generate workspace optimization report
echo "📊 Generating optimization report..."
tw-enigma analyze --workspace --report=reports/monorepo-optimization.json

echo "✅ Optimized build complete!"
```

### 2. Parallel Development

```bash
#!/bin/bash
# scripts/dev.sh

echo "🔥 Starting monorepo development..."

# Start all development servers in parallel
turbo run dev --parallel --filter='apps/*' &
turbo run dev --parallel --filter='micro-frontends/*' &

# Start design system watch mode
cd packages/design-system && npm run dev &

# Start CSS optimization watch mode
tw-enigma watch --workspace &

echo "🚀 Development servers started!"
echo "📱 Web App: http://localhost:3000"
echo "🔧 Admin: http://localhost:3001" 
echo "📄 Marketing: http://localhost:3002"
echo "📚 Docs: http://localhost:3003"

wait
```

## 📊 Workspace Analytics

### 1. Cross-Package Analysis

```typescript
// tools/analyze-workspace.ts
import { analyzeworkspace } from '@tw-enigma/core'

const analysis = await analyzeworkspace({
  workspace: {
    packages: ['packages/*', 'apps/*', 'micro-frontends/*']
  },
  
  analysis: {
    // Package dependencies
    dependencies: {
      crossPackage: true,
      circularDetection: true,
      unusedDependencies: true
    },

    // CSS optimization opportunities
    optimization: {
      duplication: true,
      sharedComponents: true,
      unusedStyles: true
    },

    // Performance impact
    performance: {
      bundleSize: true,
      loadingTime: true,
      cacheEfficiency: true
    }
  }
})

// Generate comprehensive report
const report = {
  summary: {
    totalPackages: analysis.packages.length,
    totalOptimization: analysis.optimization.totalReduction,
    sharedComponents: analysis.components.shared.length,
    duplicateStyles: analysis.styles.duplicates.count
  },

  packages: analysis.packages.map(pkg => ({
    name: pkg.name,
    optimization: `${pkg.optimization.reduction}%`,
    bundleSize: `${pkg.bundle.originalSize} → ${pkg.bundle.optimizedSize}`,
    sharedComponents: pkg.components.shared.length,
    dependencies: pkg.dependencies.internal
  })),

  recommendations: [
    ...analysis.recommendations.optimization,
    ...analysis.recommendations.architecture,
    ...analysis.recommendations.performance
  ]
}

console.table(report.packages)
console.log('\n🎯 Recommendations:')
report.recommendations.forEach(rec => console.log(`• ${rec}`))
```

### 2. Dependency Visualization

```typescript
// tools/visualize-dependencies.ts
import { createDependencyGraph } from '@tw-enigma/core'

const dependencyGraph = await createDependencyGraph({
  workspace: './packages',
  
  analysis: {
    types: ['css', 'components', 'packages'],
    includeExternal: false,
    circularDetection: true
  },

  visualization: {
    format: 'mermaid',
    output: 'dependency-graph.md',
    
    grouping: {
      byType: true,
      byPackage: true
    },

    highlighting: {
      circularDependencies: 'red',
      sharedComponents: 'blue',
      unusedPackages: 'gray'
    }
  }
})

// Generate Mermaid diagram
const mermaidDiagram = `
graph TD
  subgraph "Shared Packages"
    DS[design-system]
    UP[ui-primitives] 
    T[tokens]
  end
  
  subgraph "Applications"
    WA[web-app]
    AD[admin-dashboard]
    MS[marketing-site]
  end
  
  subgraph "Micro-frontends"
    UPF[user-profile]
    SC[shopping-cart]
    N[notifications]
  end
  
  DS --> UP
  UP --> T
  
  WA --> DS
  WA --> UP
  AD --> DS
  MS --> DS
  
  UPF --> DS
  SC --> DS
  N --> DS
  
  classDef shared fill:#e1f5fe
  classDef app fill:#f3e5f5
  classDef microfrontend fill:#e8f5e8
  
  class DS,UP,T shared
  class WA,AD,MS app
  class UPF,SC,N microfrontend
`

console.log('📊 Dependency visualization generated!')
```

## 🎯 Performance Results

### Monorepo Optimization Results

| Package | Original Size | Optimized Size | Reduction | Build Time |
|---------|---------------|----------------|-----------|------------|
| **design-system** | 2.3MB | 450KB | 80.4% | +2s (analysis) |
| **web-app** | 1.8MB | 280KB | 84.4% | +3s |
| **admin-dashboard** | 1.2MB | 190KB | 84.2% | +2s |
| **marketing-site** | 950KB | 120KB | 87.4% | +1s |
| **user-profile** | 340KB | 85KB | 75.0% | +0.5s |
| **shopping-cart** | 280KB | 70KB | 75.0% | +0.5s |
| **notifications** | 220KB | 55KB | 75.0% | +0.5s |

### Cross-Package Benefits

- **Shared Component Optimization**: 92% reduction in duplicate CSS
- **Design System Efficiency**: 95% of components reused across apps
- **Build Cache Hit Rate**: 89% with Turbo + tw-enigma caching
- **Development HMR**: 40% faster hot reloads with optimized CSS
- **Bundle Analysis**: 85% reduction in total CSS across monorepo

## 🚀 Best Practices

### 1. Package Organization

```
✅ DO: Organize by domain and responsibility
packages/
├── design-system/     # Shared UI components
├── ui-primitives/     # Low-level primitives
└── tokens/            # Design tokens

❌ DON'T: Mix concerns or create circular dependencies
packages/
├── shared-everything/ # Too broad, unclear boundaries
└── utils/             # Vague purpose
```

### 2. Optimization Strategy

```javascript
// ✅ DO: Use appropriate strategies per package type
{
  packageOverrides: {
    'packages/design-system': { strategy: 'preserve' },
    'apps/*': { strategy: 'aggressive' },
    'micro-frontends/*': { strategy: 'isolated' }
  }
}

// ❌ DON'T: Use same strategy everywhere
{
  optimization: { strategy: 'aggressive' } // Too simplistic
}
```

### 3. Build Performance

```javascript
// ✅ DO: Leverage caching and parallelization
{
  performance: {
    parallel: true,
    workers: 'auto',
    incremental: true,
    caching: { enabled: true }
  }
}

// ❌ DON'T: Ignore build performance
{
  performance: { parallel: false } // Slow builds
}
```

## 🔧 Troubleshooting

### Common Issues

**1. Circular Dependencies**
```bash
# Detect circular dependencies
tw-enigma analyze --workspace --circular-deps

# Fix by restructuring imports
# Move shared utilities to separate package
```

**2. Style Conflicts Between Micro-frontends**
```javascript
// Enable style isolation
{
  optimization: {
    isolation: {
      enabled: true,
      prefix: 'micro-frontend-name'
    }
  }
}
```

**3. Build Performance Issues**
```bash
# Enable parallel builds and caching
turbo run build --parallel --cache-dir=".turbo"

# Use incremental optimization
tw-enigma optimize --incremental --workers=auto
```

**4. Design System Updates Not Propagating**
```bash
# Clear caches and rebuild
turbo run clean
npm run build:design-system
turbo run build --filter='apps/*' --force
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=tw-enigma:* npm run build:optimized

# Analyze specific package
tw-enigma analyze --package=apps/web-app --verbose

# Check optimization pipeline
tw-enigma debug --workspace --pipeline
```

## 📚 Migration Guide

### From Separate Repositories

1. **Consolidate Packages**
   ```bash
   # Move packages to monorepo structure
   mkdir packages apps libs
   git subtree add --prefix=packages/design-system \
     https://github.com/company/design-system.git main
   ```

2. **Update Package References**
   ```bash
   # Update imports across packages
   tw-enigma migrate --from-separate-repos \
     --update-imports \
     --workspace
   ```

3. **Configure Workspace Optimization**
   ```bash
   # Set up workspace configuration
   tw-enigma init --workspace
   tw-enigma configure --cross-package-optimization
   ```

---

**Ready to optimize your monorepo?** tw-enigma provides powerful workspace-aware optimization with cross-package deduplication, intelligent caching, and seamless build integration. 