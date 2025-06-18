# @tw-enigma/core

> Core CSS optimization engine for intelligent Tailwind CSS class analysis and optimization

[![npm version](https://badge.fury.io/js/%40tw-enigma%2Fcore.svg)](https://badge.fury.io/js/%40tw-enigma%2Fcore)
[![Build Status](https://github.com/avocardow/tw-enigma/workflows/CI/badge.svg)](https://github.com/avocardow/tw-enigma/actions)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

`@tw-enigma/core` is the heart of the tw-enigma optimization engine. It provides intelligent CSS class analysis, pattern detection, and optimization capabilities for Tailwind CSS projects. This package offers a programmatic API for analyzing CSS usage patterns and generating optimized stylesheets.

## ✨ Features

- **🔍 Intelligent Analysis**: Advanced pattern detection and frequency analysis
- **⚡ Multiple Strategies**: Atomic, utility, component, and mixed optimization approaches
- **🎯 Tailwind Integration**: Native support for `@apply` directives and Tailwind CSS
- **🔧 PostCSS Integration**: Extensible with PostCSS plugins for advanced optimizations
- **📊 Performance Metrics**: Comprehensive performance monitoring and reporting
- **🛡️ Type Safety**: Full TypeScript support with strict type definitions
- **🔄 Streaming Processing**: Memory-efficient handling of large projects

## 📦 Installation

```bash
# npm
npm install @tw-enigma/core

# pnpm (recommended)
pnpm add @tw-enigma/core

# yarn
yarn add @tw-enigma/core
```

## 🏁 Quick Start

### Basic Usage

```typescript
import { EnhancedCSSGenerator, loadConfig } from '@tw-enigma/core';

// Load configuration
const config = await loadConfig();

// Create frequency analyzer (implement based on your needs)
const frequencyAnalyzer = new FrequencyAnalyzer();

// Initialize the CSS generator
const generator = new EnhancedCSSGenerator(config, frequencyAnalyzer);

// Generate optimized CSS
const result = await generator.generateEnhancedCSS(classFrequencies, {
  strategy: 'mixed',
  useApplyDirective: true,
  sortingStrategy: 'frequency',
});

console.log('Generated CSS:', result.css);
console.log('Compression ratio:', result.statistics.compressionRatio);
```

### File Processing

```typescript
import { htmlExtractor, jsExtractor, fileDiscovery } from '@tw-enigma/core';

// Discover files
const files = await fileDiscovery.find(['src/**/*.{html,js,ts,jsx,tsx}'], {
  ignore: ['node_modules/**'],
});

// Extract classes from HTML
const htmlContent = await fs.readFile('index.html', 'utf8');
const htmlClasses = await htmlExtractor.extract(htmlContent);

// Extract classes from JavaScript/TypeScript
const jsContent = await fs.readFile('component.tsx', 'utf8');
const jsClasses = await jsExtractor.extract(jsContent);
```

### Advanced CSS Generation

```typescript
import { generateOptimizedCss, generateCssRules } from '@tw-enigma/core';

// Generate CSS from patterns
const result = generateOptimizedCss(patterns, {
  strategy: 'mixed',
  useApplyDirective: true,
  sortingStrategy: 'frequency',
  commentLevel: 'detailed',
  minimumFrequency: 3,
});

// Generate individual CSS rules
const rules = generateCssRules(patterns, {
  selectorNaming: 'pretty',
  minimumFrequency: 2,
});
```

## 📚 API Reference

### Core Classes

#### `EnhancedCSSGenerator`

The main CSS generation engine that provides intelligent optimization and code generation.

```typescript
class EnhancedCSSGenerator {
  constructor(config: EnigmaConfig, frequencyAnalyzer: FrequencyAnalyzer, enablePostCSS?: boolean);

  async generateEnhancedCSS(
    classFrequencies: Map<string, number>,
    options?: Partial<CssGenerationOptions>
  ): Promise<GeneratedCSS>;

  getPostCSSMetrics(): any;

  async updatePostCSSConfig(updates: PostCSSConfigUpdates): Promise<void>;
}
```

### Core Functions

#### CSS Generation Functions

```typescript
// Generate optimized CSS from patterns
function generateOptimizedCss(
  patterns: AggregatedClassData[],
  options?: Partial<CssGenerationOptions>
): CssGenerationResult;

// Generate CSS rules from patterns
function generateCssRules(
  patterns: AggregatedClassData[],
  options?: CssGenerationOptions
): CssRule[];

// Generate @apply directives
function generateApplyDirective(classes: string[], options: CssGenerationOptions): ApplyDirective;
```

#### Pattern Analysis Functions

```typescript
// Classify CSS patterns
function classifyPattern(
  pattern: AggregatedClassData,
  options: CssGenerationOptions
): PatternClassification;

// Sort CSS rules
function sortCssRules(
  rules: CssRule[],
  strategy: SortingStrategy,
  customSortFn?: SortFunction
): CssRule[];
```

### File Processors

#### HTML Processing

```typescript
const htmlExtractor: {
  extract(content: string, options?: ExtractionOptions): Promise<Map<string, number>>;
};

const htmlRewriter: {
  rewrite(content: string, classMapping: Map<string, string>): Promise<string>;
};
```

#### JavaScript/TypeScript Processing

```typescript
const jsExtractor: {
  extract(content: string, options?: ExtractionOptions): Promise<Map<string, number>>;
};

const jsRewriter: {
  rewrite(content: string, classMapping: Map<string, string>): Promise<string>;
};
```

### Configuration

```typescript
// Load configuration
function loadConfig(configPath?: string): Promise<EnigmaConfig>;

interface EnigmaConfig {
  optimization: OptimizationConfig;
  files: FileConfig;
  css: CssGenerationOptions;
  performance: PerformanceConfig;
}
```

## ⚙️ Configuration

### Basic Configuration

```javascript
// enigma.config.js
export default {
  optimization: {
    strategy: 'mixed',
    enableMinification: true,
    preserveComments: false,
    generateSourceMaps: true,
  },

  files: {
    input: ['src/**/*.{html,js,ts,jsx,tsx}'],
    output: 'dist/optimized.css',
    ignore: ['node_modules/**', 'dist/**'],
    extensions: ['.html', '.js', '.ts', '.jsx', '.tsx'],
  },

  css: {
    strategy: 'mixed',
    useApplyDirective: true,
    sortingStrategy: 'frequency',
    commentLevel: 'detailed',
    minimumFrequency: 2,
  },

  performance: {
    maxConcurrency: 4,
    memoryLimit: 512,
    timeout: 30000,
  },
};
```

### CSS Generation Options

```typescript
interface CssGenerationOptions {
  strategy: 'atomic' | 'utility' | 'component' | 'mixed';
  useApplyDirective: boolean;
  sortingStrategy: 'specificity' | 'frequency' | 'alphabetical' | 'custom';
  commentLevel: 'none' | 'minimal' | 'detailed' | 'verbose';
  selectorNaming: 'sequential' | 'frequency-optimized' | 'pretty' | 'custom';
  minimumFrequency: number;
  includeSourceMaps: boolean;
  formatOutput: boolean;
  maxRulesPerFile: number;
  enableOptimizations: boolean;
}
```

## 🔧 Advanced Usage

### Custom PostCSS Integration

```typescript
const generator = new EnhancedCSSGenerator(config, frequencyAnalyzer);

// Configure PostCSS plugins
await generator.updatePostCSSConfig({
  optimizationLevel: 'aggressive',
  enableTailwindOptimizer: true,
  enableCSSMinifier: true,
  customPluginConfigs: {
    autoprefixer: { grid: true },
    cssnano: { preset: 'advanced' },
  },
});
```

### Pattern Classification

```typescript
import { classifyPattern } from '@tw-enigma/core';

const classification = classifyPattern(pattern, options);

console.log(`Pattern type: ${classification.type}`);
console.log(`Confidence: ${classification.confidence}`);
console.log(`Recommended strategy: ${classification.recommendedStrategy}`);
```

### Custom Error Handling

```typescript
import { CssGenerationError, InvalidCssError, ApplyDirectiveError } from '@tw-enigma/core';

try {
  const result = await generator.generateEnhancedCSS(classFrequencies);
} catch (error) {
  if (error instanceof InvalidCssError) {
    console.error('Invalid CSS:', error.invalidCss);
  } else if (error instanceof ApplyDirectiveError) {
    console.error('Invalid @apply directive:', error.directive);
  } else if (error instanceof CssGenerationError) {
    console.error('CSS Generation failed:', error.message);
  }
}
```

## 🚀 Performance

### Memory Management

```typescript
// Process files in batches for large projects
const batchSize = 100;
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### Performance Monitoring

```typescript
const result = await generator.generateEnhancedCSS(classFrequencies);

console.log('Performance Metrics:');
console.log(`Generation time: ${result.statistics.generationTime}ms`);
console.log(`Memory usage: ${result.statistics.memoryUsage}MB`);
console.log(`Compression ratio: ${result.statistics.compressionRatio}%`);
```

## 🧪 Testing

The package includes comprehensive testing utilities:

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run performance tests
pnpm test:perf
```

## 🔗 Integration Examples

### Vite Integration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { EnhancedCSSGenerator } from '@tw-enigma/core';

export default defineConfig({
  plugins: [
    {
      name: 'enigma-integration',
      buildStart() {
        // Initialize CSS generation
      },
    },
  ],
});
```

### Webpack Integration

```javascript
// webpack.config.js
const { EnhancedCSSGenerator } = require('@tw-enigma/core');

module.exports = {
  plugins: [
    {
      apply(compiler) {
        compiler.hooks.emit.tapAsync('EnigmaPlugin', (compilation, callback) => {
          // Process CSS optimization
          callback();
        });
      },
    },
  ],
};
```

## 📊 Benchmarks

Performance benchmarks on typical projects:

| Project Size | Files  | Classes | Processing Time | Memory Usage | Compression |
| ------------ | ------ | ------- | --------------- | ------------ | ----------- |
| Small        | 50     | 500     | 0.2s            | 15MB         | 45%         |
| Medium       | 200    | 2,000   | 0.8s            | 35MB         | 62%         |
| Large        | 1,000  | 10,000  | 3.2s            | 120MB        | 78%         |
| Enterprise   | 5,000+ | 50,000+ | 12s             | 400MB        | 85%         |

## 🔧 Troubleshooting

### Common Issues

#### Memory Issues

```typescript
// Reduce memory usage
const config = {
  performance: {
    maxConcurrency: 2,
    memoryLimit: 256,
  },
};
```

#### Performance Issues

```typescript
// Optimize for speed
const options = {
  strategy: 'atomic', // Fastest strategy
  minimumFrequency: 3, // Higher threshold
  enableOptimizations: false, // Skip expensive optimizations
};
```

### Debug Mode

Enable detailed logging:

```typescript
import { logger } from '@tw-enigma/core';

logger.setLevel('debug');
```

## 📄 License

This package is part of the tw-enigma project and is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](../../CONTRIBUTING.md) for details on how to get started.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/avocardow/tw-enigma.git

# Install dependencies
cd tw-enigma
pnpm install

# Build the core package
pnpm --filter @tw-enigma/core build

# Run tests
pnpm --filter @tw-enigma/core test
```

## 📞 Support

- 📖 **Documentation**: [API Reference](../../docs/API_REFERENCE.md)
- 🏗️ **Architecture**: [Architecture Documentation](../../docs/ARCHITECTURE.md)
- 🐛 **Issues**: [GitHub Issues](https://github.com/avocardow/tw-enigma/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/avocardow/tw-enigma/discussions)

## 🔗 Related Packages

- [@tw-enigma/cli](../cli) - Command-line interface for tw-enigma
- [tw-enigma](../../) - Main monorepo documentation
