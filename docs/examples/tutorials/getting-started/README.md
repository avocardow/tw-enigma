# Getting Started with tw-enigma

A comprehensive tutorial to get you started with tw-enigma CSS optimization in 15 minutes.

## 📋 What You'll Learn

By the end of this tutorial, you'll have:

- ✅ A basic understanding of how tw-enigma works
- ✅ tw-enigma integrated into a sample project
- ✅ Real optimization results with before/after metrics
- ✅ Knowledge of key configuration options
- ✅ Tools to monitor and analyze performance

**Time Required:** ~15 minutes
**Prerequisites:** Basic knowledge of CSS, Node.js, and a build tool (Vite, Webpack, etc.)

## 🎯 Tutorial Overview

| Step                                | Topic                  | Time  | Difficulty   |
| ----------------------------------- | ---------------------- | ----- | ------------ |
| [1](#step-1-installation)           | Installation & Setup   | 2 min | Beginner     |
| [2](#step-2-basic-configuration)    | Basic Configuration    | 3 min | Beginner     |
| [3](#step-3-first-optimization)     | First Optimization     | 5 min | Beginner     |
| [4](#step-4-analyzing-results)      | Analyzing Results      | 2 min | Beginner     |
| [5](#step-5-advanced-configuration) | Advanced Configuration | 3 min | Intermediate |

## 🚀 Step 1: Installation

Let's start by setting up tw-enigma in a new project.

### Create a Sample Project

```bash
# Create a new Vite project (you can use any build tool)
npm create vite@latest tw-enigma-demo -- --template react-ts
cd tw-enigma-demo
npm install

# Add Tailwind CSS (if not already present)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Install tw-enigma

```bash
# Install tw-enigma packages
npm install @tw-enigma/core @tw-enigma/cli

# For build tool integration (optional but recommended)
npm install -D @tw-enigma/vite-plugin  # For Vite
# OR
npm install -D @tw-enigma/webpack-plugin  # For Webpack
```

### Verify Installation

```bash
# Check if tw-enigma CLI is available
npx tw-enigma --version

# Should output something like: @tw-enigma/cli v1.0.0
```

✅ **Checkpoint:** You should now have tw-enigma installed and ready to use.

## ⚙️ Step 2: Basic Configuration

Now let's configure tw-enigma for your project.

### Create Configuration File

Create `tw-enigma.config.js` in your project root:

```javascript
// tw-enigma.config.js
import { defineConfig } from '@tw-enigma/core';

export default defineConfig({
  // Specify which files to analyze for CSS usage
  content: ['./src/**/*.{js,jsx,ts,tsx,html}', './public/index.html'],

  // Basic optimization settings
  optimization: {
    strategy: 'atomic', // Start with atomic strategy
    threshold: 2, // Remove classes used less than 2 times
    minify: true, // Minify the output CSS
  },

  // Where to output the optimized CSS
  output: {
    filename: 'optimized.css',
    directory: 'dist/assets',
  },
});
```

### Update Tailwind Configuration

Modify your `tailwind.config.js` to work with tw-enigma:

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
  // Add this for tw-enigma integration
  corePlugins: {
    preflight: true,
  },
};
```

### Add Build Tool Integration

#### For Vite Users:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { twEnigmaPlugin } from '@tw-enigma/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    twEnigmaPlugin(), // Add tw-enigma plugin
  ],
});
```

#### For Webpack Users:

```javascript
// webpack.config.js
const { TwEnigmaPlugin } = require('@tw-enigma/webpack-plugin');

module.exports = {
  // ... your existing config
  plugins: [new TwEnigmaPlugin()],
};
```

✅ **Checkpoint:** Configuration files are set up and your build tool is integrated.

## 🎨 Step 3: First Optimization

Let's create some sample content and see tw-enigma in action.

### Create Sample Components

Create a sample React component with Tailwind classes:

```tsx
// src/components/SampleCard.tsx
import React from 'react';

interface SampleCardProps {
  title: string;
  description: string;
  variant?: 'primary' | 'secondary';
}

export function SampleCard({ title, description, variant = 'primary' }: SampleCardProps) {
  return (
    <div
      className={`
      max-w-sm mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl
      ${variant === 'primary' ? 'border-l-4 border-blue-500' : 'border-l-4 border-green-500'}
    `}
    >
      <div className="md:flex">
        <div className="md:shrink-0">
          <div className="h-48 w-full object-cover md:h-full md:w-48 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500"></div>
        </div>
        <div className="p-8">
          <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">
            {variant} Card
          </div>
          <h3 className="block mt-1 text-lg leading-tight font-medium text-black hover:underline">
            {title}
          </h3>
          <p className="mt-2 text-slate-500">{description}</p>
          <div className="mt-4">
            <button
              className={`
              px-4 py-2 rounded-md text-white font-medium transition-colors
              ${
                variant === 'primary'
                  ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              }
              focus:ring-2 focus:ring-offset-2
            `}
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Update Main App

```tsx
// src/App.tsx
import { SampleCard } from './components/SampleCard';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-12">tw-enigma Demo</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SampleCard
            title="Primary Card"
            description="This is a sample card demonstrating tw-enigma optimization with primary styling."
            variant="primary"
          />
          <SampleCard
            title="Secondary Card"
            description="This is another sample card showing different color variants and how tw-enigma handles conditional classes."
            variant="secondary"
          />
        </div>

        {/* Add some unused classes for demonstration */}
        <div className="hidden">
          <div className="bg-yellow-500 text-white p-4 rounded-lg shadow-lg"></div>
          <div className="bg-purple-600 text-yellow-200 p-8 rounded-full border-4 border-dashed border-red-400"></div>
          <div className="grid grid-cols-12 gap-6 items-center justify-items-stretch"></div>
        </div>
      </div>
    </div>
  );
}

export default App;
```

### Add CSS File

```css
/* src/App.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Some custom styles that might conflict */
.custom-button {
  @apply px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700;
}

.unused-style {
  @apply bg-orange-500 text-center font-bold text-2xl p-10 rounded-full shadow-2xl;
}

/* Utility classes that are used in HTML but not in JSX */
.footer-style {
  @apply bg-gray-800 text-white text-center py-4 mt-auto;
}
```

### Run Your First Optimization

```bash
# Development build (no optimization)
npm run dev

# Production build with optimization
npm run build

# Analyze the optimization results
npx tw-enigma analyze
```

✅ **Checkpoint:** You should see your app running with tw-enigma analyzing CSS usage.

## 📊 Step 4: Analyzing Results

Let's examine what tw-enigma found and optimized.

### View Basic Analysis

```bash
# Get a quick overview
npx tw-enigma analyze --summary

# Example output:
# ✅ Analysis Complete
# 📊 CSS Classes Found: 1,247
# 🎯 CSS Classes Used: 89
# 🗑️  CSS Classes Removed: 1,158
# 📉 Size Reduction: 96.2% (3.2MB → 125KB)
```

### Generate Detailed Report

```bash
# Generate a detailed report
npx tw-enigma analyze --detailed --output reports/analysis.json

# View the report in browser
npx tw-enigma serve-report reports/analysis.json
```

The detailed report shows:

#### Before Optimization

```json
{
  "originalStats": {
    "totalClasses": 1247,
    "fileSize": "3.2MB",
    "parseTime": "45ms",
    "unusedClasses": 1158
  }
}
```

#### After Optimization

```json
{
  "optimizedStats": {
    "usedClasses": 89,
    "fileSize": "125KB",
    "parseTime": "8ms",
    "optimizationRatio": 0.962
  }
}
```

### Performance Metrics

tw-enigma also tracks performance impact:

| Metric        | Before | After  | Improvement       |
| ------------- | ------ | ------ | ----------------- |
| CSS File Size | 3.2 MB | 125 KB | **96% reduction** |
| Parse Time    | 45ms   | 8ms    | **82% faster**    |
| Build Time    | 3.2s   | 2.1s   | **34% faster**    |
| First Paint   | 1.2s   | 0.8s   | **33% faster**    |

✅ **Checkpoint:** You can see measurable optimization results from tw-enigma.

## ⚡ Step 5: Advanced Configuration

Now let's explore more advanced optimization strategies.

### Strategy Comparison

Try different optimization strategies to see their impact:

```javascript
// tw-enigma.config.js
export default defineConfig({
  content: ['./src/**/*.{js,jsx,ts,tsx}'],

  // Try different strategies
  optimization: {
    // strategy: 'atomic',    // Best for simple projects
    // strategy: 'chunked',   // Good for medium projects
    strategy: 'hybrid', // Best for complex projects

    threshold: 1, // More aggressive removal
    minify: true,
    preserveComments: false,

    // Advanced options
    parallel: true, // Use multiple cores
    workers: 4, // Number of parallel workers
    cache: true, // Enable optimization caching

    // Experimental features
    treeshaking: true, // Remove unused @apply directives
    prefixOptimization: true, // Optimize vendor prefixes
    mediaQueryOptimization: true, // Optimize media queries
  },

  // Enhanced analytics
  analytics: {
    enabled: true,
    detailed: true,
    reportPath: 'reports/optimization.json',
    metrics: ['fileSize', 'parseTime', 'classes', 'selectors'],

    // Performance tracking
    performance: {
      trackBuildTime: true,
      trackParseTime: true,
      trackMemoryUsage: true,
    },
  },
});
```

### Environment-Specific Configuration

```javascript
// tw-enigma.config.js
export default defineConfig({
  content: ['./src/**/*.{js,jsx,ts,tsx}'],

  // Development settings
  development: {
    optimize: false, // Skip optimization in dev
    enableHMR: true, // Hot module replacement
    sourceMaps: true, // Generate source maps
    liveAnalysis: true, // Real-time analysis
  },

  // Production settings
  production: {
    optimize: true,
    strategy: 'hybrid',
    minify: true,
    generateReport: true,

    // Production-only optimizations
    advancedOptimizations: {
      removeUnusedKeyframes: true,
      optimizeCustomProperties: true,
      consolidateDuplicateRules: true,
    },
  },

  // Testing settings
  test: {
    optimize: false,
    preserveTestIds: true, // Keep data-testid attributes
    mockOptimization: true, // Simulate optimization without changes
  },
});
```

### CI/CD Integration

Add optimization to your build pipeline:

```yaml
# .github/workflows/optimize.yml
name: CSS Optimization

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  optimize:
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

      - name: Run tw-enigma optimization
        run: |
          npm run build
          npx tw-enigma analyze --ci

      - name: Upload optimization report
        uses: actions/upload-artifact@v3
        with:
          name: optimization-report
          path: reports/optimization.json

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('reports/optimization.json'));

            const comment = `
            ## 🎯 tw-enigma Optimization Results

            - **CSS Reduction:** ${report.optimizationRatio * 100}%
            - **File Size:** ${report.originalStats.fileSize} → ${report.optimizedStats.fileSize}
            - **Classes Removed:** ${report.originalStats.unusedClasses}
            - **Build Time:** ${report.performance.buildTime}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Custom Optimization Rules

Create custom rules for your specific needs:

```javascript
// tw-enigma.config.js
export default defineConfig({
  content: ['./src/**/*.{js,jsx,ts,tsx}'],

  // Custom optimization rules
  rules: {
    // Keep specific classes even if unused
    preserve: [
      'error-state', // Keep error state classes
      'loading-*', // Keep all loading variants
      /^data-/, // Keep data attributes
      /^test-/, // Keep test identifiers
    ],

    // Force removal of specific classes
    remove: [
      'debug-*', // Remove debug classes
      'temp-*', // Remove temporary classes
      'unused-*', // Remove explicitly unused classes
    ],

    // Transform classes during optimization
    transform: {
      'btn-primary': 'bg-blue-600 text-white px-4 py-2 rounded',
      'btn-secondary': 'bg-gray-200 text-gray-800 px-4 py-2 rounded',
    },
  },

  // Plugin system for custom processing
  plugins: [
    // Custom plugin example
    {
      name: 'custom-optimizer',
      apply: (css, context) => {
        // Custom optimization logic
        return css.replace(/\/\* debug \*\/.*?\/\* \/debug \*\//gs, '');
      },
    },
  ],
});
```

✅ **Checkpoint:** You now have advanced tw-enigma configuration that can handle complex optimization scenarios.

## 🎉 Congratulations!

You've successfully:

- ✅ **Installed and configured** tw-enigma in your project
- ✅ **Created sample components** with Tailwind CSS classes
- ✅ **Ran your first optimization** and saw dramatic file size reduction
- ✅ **Analyzed the results** with detailed performance metrics
- ✅ **Explored advanced configuration** options for production use

## 📚 Next Steps

Now that you have the basics, here are some recommended next steps:

### 1. **Explore Framework Examples**

- [React with TypeScript](../frameworks/react/typescript/) - Type-safe configuration
- [Vue.js Integration](../frameworks/vue/basic/) - Vue-specific patterns
- [Next.js Optimization](../frameworks/next/basic/) - Server-side optimization

### 2. **Learn Optimization Strategies**

- [Atomic Strategy](../optimization/atomic.md) - Best for simple projects
- [Chunked Strategy](../optimization/chunked.md) - Good for medium projects
- [Hybrid Strategy](../optimization/hybrid.md) - Best for complex projects

### 3. **Production Setup**

- [Enterprise Configuration](../../use-cases/enterprise/) - Large-scale deployment
- [Monorepo Setup](../../use-cases/monorepo/) - Multi-package optimization
- [CI/CD Integration](../deployment/ci-cd.md) - Automated optimization

### 4. **Advanced Features**

- [Performance Monitoring](../../tutorials/performance/monitoring.md) - Track optimization impact
- [Custom Rules](../../tutorials/configuration/custom-rules.md) - Create specific optimization rules
- [Plugin Development](../../tutorials/plugins/development.md) - Extend tw-enigma functionality

## 🆘 Getting Help

If you run into issues:

1. **Check the [Troubleshooting Guide](../../troubleshooting.md)**
2. **Review [Common Issues](../../common-issues.md)**
3. **Open an issue on [GitHub](https://github.com/tw-enigma/tw-enigma)**

## 📖 Additional Resources

- **[API Documentation](../../../packages/core/README.md)** - Complete API reference
- **[Configuration Guide](../../../docs/configuration.md)** - All configuration options
- **[Performance Guide](../../../docs/performance.md)** - Optimization best practices
- **[Migration Guide](../../../docs/migration.md)** - Migrating from other tools
