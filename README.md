# Tailwind Enigma �

**Dramatically shrink your HTML and JavaScript bundle sizes by replacing repetitive Tailwind class patterns with short, optimized class names.**

[![npm version](https://badge.fury.io/js/tw-enigma.svg)](https://badge.fury.io/js/tw-enigma)
[![Downloads](https://img.shields.io/npm/dm/tw-enigma.svg)](https://npmjs.org/package/tw-enigma)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-1779%20passing-brightgreen.svg)](#)

---

## What does this do? 🤔

**Simple answer:** Your HTML and JavaScript files are full of repetitive Tailwind class combinations like `"flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded"`. This tool finds those patterns and replaces them with tiny class names like `"ab"` while generating the CSS to make it work.

**Before Tailwind Enigma:**
```html
<!-- This pattern repeats 50 times in your app -->
<div class="flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded">Button</div>
<div class="flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded">Another Button</div>
<div class="flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded">Yet Another</div>

<!-- Your bundle: 4,200 characters just for classes 😱 -->
```

**After Tailwind Enigma:**
```html
<!-- Same pattern now uses tiny class names -->
<div class="ab">Button</div>
<div class="ab">Another Button</div>
<div class="ab">Yet Another</div>

<!-- Your bundle: 150 characters 🎉 -->
<!-- Plus generated CSS: .ab { @apply flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded; } -->
```

**Result: 97% smaller HTML/JS bundles!** ⚡

---

## 30-Second Quick Start ⚡

```bash
# 1. Install it
npm install -g tw-enigma

# 2. Build your project first
npm run build

# 3. Optimize your built files
enigma css-optimize "dist/**/*.{html,js}"

# Done! Your files now use tiny class names
```

**What just happened?**
1. 🔍 **Scanned your files** - Found every Tailwind class combination
2. 📊 **Counted patterns** - Identified which combinations appear most often  
3. ✂️ **Generated short names** - Created tiny class names like `ab`, `cd`, `ef`
4. 🎯 **Rewritten your files** - Replaced long patterns with short names
5. 📄 **Created CSS** - Generated `@apply` rules so everything still works
6. 🚀 **Smaller bundles** - Your users download way less code!

---

## Real-World Examples 💪

### Example 1: Button Pattern
```html
<!-- Before: 78 characters -->
<button class="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">

<!-- After: 16 characters -->
<button class="ab">

<!-- Savings: 79% smaller -->
```

### Example 2: Card Layout
```html
<!-- Before: 156 characters -->
<div class="bg-white rounded-lg shadow-md p-6 max-w-sm mx-auto border border-gray-200 hover:shadow-lg transition-shadow">

<!-- After: 16 characters -->  
<div class="cd">

<!-- Savings: 90% smaller -->
```

### Example 3: Navigation Item
```html
<!-- Before: 98 characters -->
<a class="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">

<!-- After: 15 characters -->
<a class="ef">

<!-- Savings: 85% smaller -->
```

---

## Installation Options 📦

### Option 1: Global Install (Recommended)
```bash
npm install -g tw-enigma
# Then use anywhere: enigma css-optimize ...
```

### Option 2: Project Install
```bash
npm install tw-enigma
# Then use: npx enigma css-optimize ...
```

### Option 3: One-time use
```bash
npx tw-enigma css-optimize "dist/**/*.{html,js}"
```

---

## How to Use It 🛠️

### Basic Optimization
```bash
# Optimize HTML files after build
enigma css-optimize "dist/**/*.html"

# Optimize React/JS files after build
enigma css-optimize "build/**/*.{js,jsx}"

# Optimize everything in your build folder
enigma css-optimize "dist/**/*.{html,js,jsx,tsx}"
```

### With Options
```bash
# Use pretty class names (no repeated letters: ab, cd, ef not aa, bb, cc)
enigma css-optimize "dist/**/*.html" --class-prefix "tw-" --pretty

# Custom output location for generated CSS
enigma css-optimize "dist/**/*.html" --output "dist/optimized.css"

# See what it's doing
enigma css-optimize "dist/**/*.html" --verbose

# Test without making changes
enigma css-optimize "dist/**/*.html" --dry-run
```

### Configuration File
Create `enigma.config.js` to avoid typing long commands:

```javascript
export default {
  buildDir: "dist",
  source: ["**/*.{html,js,jsx,tsx}"],
  output: { css: "styles/optimized.css" },
  usePrettyNames: true,
  classPrefix: "tw-",
  minify: true
};
```

Then just run:
```bash
enigma css-optimize
```

---

## Perfect for These Setups ✅

**✅ Build Tools:** Vite, Webpack, Next.js, Nuxt, Create React App, Parcel  
**✅ Frameworks:** React, Vue, Svelte, Angular, Solid, plain HTML  
**✅ Languages:** HTML, JavaScript, TypeScript, JSX, TSX  
**✅ Package Managers:** npm, yarn, pnpm, bun  
**✅ Deployment:** Vercel, Netlify, AWS, any static hosting  

---

## Build Process Integration 🔄

### With npm scripts
```json
{
  "scripts": {
    "build": "vite build",
    "optimize": "npm run build && enigma css-optimize 'dist/**/*.{html,js}'",
    "deploy": "npm run optimize && deploy-to-production"
  }
}
```

### With GitHub Actions
```yaml
- name: Build and optimize
  run: |
    npm run build
    npx tw-enigma css-optimize "dist/**/*.{html,js}"
    
- name: Deploy optimized build
  uses: actions/deploy@v3
```

### With Vercel
```json
{
  "buildCommand": "npm run build && npx tw-enigma css-optimize 'dist/**/*.{html,js}'"
}
```

---

## How It Works Under the Hood 🔧

### 1. Pattern Detection
```javascript
// Finds patterns like this across all your files:
{
  "flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded": 47, // appears 47 times
  "bg-white rounded-lg shadow-md p-6 border border-gray-200": 23,                // appears 23 times  
  "text-gray-700 hover:text-blue-600 transition-colors": 18                      // appears 18 times
}
```

### 2. Smart Name Generation
```javascript
// Standard mode: shortest possible
"ab", "ac", "ad", "ae", ... "zz", "aaa", "aab"

// Pretty mode: no repeated characters  
"ab", "ac", "ad", "bc", "bd", "cd" (never "aa", "bb", "cc")
```

### 3. CSS Generation
```css
/* Automatically generated CSS using Tailwind's @apply */
.ab { @apply flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded; }
.ac { @apply bg-white rounded-lg shadow-md p-6 border border-gray-200; }
.ad { @apply text-gray-700 hover:text-blue-600 transition-colors; }
```

### 4. File Transformation
```html
<!-- Before -->
<div class="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded">

<!-- After -->  
<div class="ab">
<link rel="stylesheet" href="optimized.css">
```

---

## Troubleshooting 🔧

### "No patterns found"
```bash
# Make sure you're running on BUILT files, not source files
enigma css-optimize "dist/**/*.html" --verbose

# Check your file paths
ls dist/**/*.html
```

### "Command not found: enigma"
```bash
# Install globally first
npm install -g tw-enigma

# Or use npx
npx tw-enigma css-optimize "dist/**/*.html"
```

### "CSS not working"
```bash
# Make sure the generated CSS is linked in your HTML
# The tool should auto-inject <link> tags, but check manually
```

### Still having issues?
1. Use `--verbose` to see detailed processing
2. Try `--dry-run` to preview changes first  
3. Check our [GitHub Issues](https://github.com/avocardow/tw-enigma/issues)

---

# Advanced Usage 🚀

*For developers who want more control and enterprise features.*

## Advanced Pattern Analysis

### Frequency Thresholds
```bash
# Only optimize patterns that appear 5+ times
enigma css-optimize "dist/**/*.html" --min-frequency 5

# Analyze pattern frequency first
enigma css-analyze "dist/**/*.html" --generate-report
```

### Custom Pattern Detection
```javascript
// enigma.config.js
export default {
  patternAnalysis: {
    minimumFrequency: 3,
    enableCoOccurrenceAnalysis: true,
    excludePatterns: ["sr-only", "hidden"],
    includeVariants: true
  }
};
```

## Advanced Name Generation

### Custom Naming Strategies
```javascript
export default {
  nameGeneration: {
    strategy: "pretty", // "sequential" | "frequency-optimized" | "pretty" | "custom"
    alphabet: "abcdefghijklmnopqrstuvwxyz",
    prefix: "tw-",
    suffix: "",
    reservedNames: ["btn", "card", "nav"] // won't be used
  }
};
```

### Performance Optimization
```javascript
export default {
  performance: {
    maxConcurrency: 8,
    batchSize: 1000,
    enableCaching: true,
    maxCacheSize: 50000
  }
};
```

## Enterprise Features

### Multiple Build Targets
```javascript
export default {
  targets: {
    main: {
      source: "dist/**/*.{html,js}",
      output: "dist/styles.css",
      strategy: "frequency-optimized"
    },
    mobile: {
      source: "mobile-dist/**/*.{html,js}",  
      output: "mobile-dist/styles.css",
      strategy: "pretty"
    }
  }
};
```

### Integration with Build Tools
```javascript
// vite.config.js
import { enigmaPlugin } from '@tw-enigma/core/plugins';

export default {
  plugins: [
    enigmaPlugin({
      autoOptimize: true,
      outputStrategy: "chunked"
    })
  ]
};
```

## Programmatic API

### Basic Usage
```typescript
import { createEnigmaOptimizer } from '@tw-enigma/core';

const optimizer = createEnigmaOptimizer({
  source: ["dist/**/*.{html,js}"],
  output: { css: "dist/optimized.css" }
});

const result = await optimizer.optimize();
console.log(`Reduced bundle size by ${result.compressionRatio}%`);
```

### Advanced Usage
```typescript
import { 
  analyzePatterns,
  generateOptimizedNames,
  rewriteAssets 
} from '@tw-enigma/core';

// Step 1: Analyze patterns
const patterns = await analyzePatterns({
  source: ["dist/**/*.html"],
  options: { minimumFrequency: 3 }
});

// Step 2: Generate names
const nameMap = await generateOptimizedNames(patterns, {
  strategy: "pretty",
  prefix: "tw-"
});

// Step 3: Rewrite assets
const result = await rewriteAssets({
  source: ["dist/**/*.html"], 
  nameMap,
  outputCSS: "dist/styles.css"
});
```

## Performance Monitoring

### Bundle Analysis
```bash
# Generate detailed bundle analysis
node dist/enigma.js css-analyze "dist/**/*.{html,js}" --output "analysis.json"

# Performance budgets
node dist/enigma.js css-optimize "dist/**/*.html" --budget-max-patterns 100
```

### Real-time Monitoring
```javascript
// Monitor optimization impact
const optimizer = createEnigmaOptimizer({
  metrics: {
    trackBundleSize: true,
    trackPatternEfficiency: true,
    generateReport: true
  }
});
```

---

## API Reference

### Core Classes

#### `EnigmaOptimizer`
```typescript
class EnigmaOptimizer {
  constructor(config: EnigmaConfig);
  optimize(): Promise<OptimizationResult>;
  analyzePatterns(): Promise<PatternAnalysis>;
  generateReport(): Promise<ReportData>;
}
```

#### `OptimizationResult`
```typescript
interface OptimizationResult {
  originalBundleSize: number;
  optimizedBundleSize: number;
  compressionRatio: number;      // Percentage reduction
  patternsOptimized: number;     // Number of patterns found
  filesProcessed: number;        // Files that were modified
  cssGenerated: string;          // Path to generated CSS
  processingTime: number;        // Time taken in ms
}
```

### Configuration Types

```typescript
interface EnigmaConfig {
  source: string | string[];              // File patterns to analyze  
  output: { css: string };                // Where to put generated CSS
  buildDir?: string;                      // Build directory
  usePrettyNames?: boolean;               // Pretty vs standard naming
  classPrefix?: string;                   // Prefix for generated classes
  minimumFrequency?: number;              // Min pattern frequency
  excludePatterns?: string[];             // Patterns to ignore
}
```

---

## Contributing 🤝

We love contributions! Here's how to get started:

1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/awesome-feature`  
3. **Make your changes** and add tests
4. **Submit a pull request**

### Development Setup
```bash
git clone https://github.com/avocardow/tw-enigma.git
cd tw-enigma/core
npm install
npm test
npm run build
```

### Running Tests
```bash
npm test                    # Unit tests
npm run test:integration    # Integration tests  
npm run test:e2e           # End-to-end tests
```

---

## Support & Community 💬

- **🐛 Bug Reports**: [GitHub Issues](https://github.com/avocardow/tw-enigma/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/avocardow/tw-enigma/discussions)

---

## License 📄

MIT License - see [LICENSE](LICENSE) file for details.

---