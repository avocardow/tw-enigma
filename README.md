# Tailwind Enigma Core

An intelligent CSS optimization engine that automatically detects, extracts, and optimizes Tailwind CSS classes from various file formats and frameworks to dramatically reduce bundle sizes while maintaining functionality.

## 🚀 Features

- **Intelligent Class Extraction**: Supports HTML, JavaScript, TypeScript, React, Vue, and more
- **Advanced CSS Optimization**: Dead code elimination, minification, and compression
- **Production-Ready Output System**: Chunking, hashing, and critical CSS extraction
- **Performance Monitoring**: Comprehensive reporting and CI integration
- **Framework Agnostic**: Works with any build system or framework
- **TypeScript Native**: Built with TypeScript for type safety and developer experience

## 📦 Installation

```bash
npm install tw-enigma
# or
pnpm add tw-enigma
# or
yarn add tw-enigma
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { TailwindEnigma } from 'tw-enigma';

const enigma = new TailwindEnigma({
  input: ['src/**/*.{html,js,ts,jsx,tsx}'],
  output: 'dist/css',
  tailwindConfig: './tailwind.config.js'
});

const result = await enigma.optimize();
console.log(`Saved ${result.sizeSavings}% CSS size!`);
```

### CLI Usage

```bash
# Basic optimization
npx enigma optimize --input="src/**/*.html" --output="dist/css"

# With CSS chunking and performance budgets
npx enigma css-optimize --strategy=chunked --budget-file="budgets.json"

# Analyze CSS performance
npx enigma css-analyze --input="dist/css/**/*.css" --generate-report
```

## 🏗️ Core Systems

### CSS Output Optimization System

The CSS Output Optimization System provides comprehensive CSS optimization for production environments:

#### Features

- **Multiple Chunking Strategies**: Component-based, route-based, or usage-pattern chunking
- **Critical CSS Extraction**: Automatic above-the-fold CSS detection and inlining
- **Asset Hashing**: Content-based hashing for optimal browser caching
- **Performance Budgets**: Define and enforce CSS performance constraints
- **CI Integration**: Automated performance monitoring and regression detection
- **Comprehensive Reporting**: Detailed metrics and optimization recommendations

#### Configuration

```typescript
import { CssOutputOrchestrator } from 'tw-enigma/output';

const orchestrator = new CssOutputOrchestrator({
  strategy: 'chunked',
  chunking: {
    strategy: 'component',
    chunkSizeTarget: 50 * 1024, // 50KB
    maxChunks: 10
  },
  optimization: {
    minify: true,
    removeUnused: true
  },
  compression: {
    gzip: true,
    brotli: true
  },
  performance: {
    maxBundleSize: 100 * 1024, // 100KB
    maxCriticalCssSize: 14 * 1024, // 14KB
    estimatedLoadTime: 2000 // 2 seconds
  }
});

const results = await orchestrator.optimizeCssOutput(bundles);
```

#### CLI Commands

```bash
# Optimize CSS with chunking
npx enigma css-optimize --input="src/**/*.css" --strategy=chunked

# Generate configuration documentation
npx enigma css-config --docs --output="css-config-docs.md"

# Analyze CSS performance with budgets
npx enigma css-analyze --budget-file="performance-budgets.json"
```

### File Processing Engine

Advanced file processing with support for multiple formats:

```typescript
import { createFileDiscovery } from 'tw-enigma';

const discovery = createFileDiscovery({
  patterns: ['src/**/*.{html,js,ts,jsx,tsx,vue}'],
  ignore: ['node_modules/**', 'dist/**'],
  extensions: ['.html', '.js', '.ts', '.jsx', '.tsx', '.vue']
});

const files = await discovery.findFiles();
```

### Class Extraction

Extract Tailwind classes from various file formats:

```typescript
import { createHtmlExtractor, createJsExtractor } from 'tw-enigma';

// HTML extraction
const htmlExtractor = createHtmlExtractor();
const htmlClasses = await htmlExtractor.extractClasses(htmlContent);

// JavaScript/React extraction
const jsExtractor = createJsExtractor();
const jsClasses = await jsExtractor.extractClasses(jsContent, 'tsx');
```

## 🔧 Configuration

### Basic Configuration

Create a `enigma.config.js` file:

```javascript
export default {
  input: ['src/**/*.{html,js,ts,jsx,tsx}'],
  output: 'dist/css',
  tailwindConfig: './tailwind.config.js',
  optimization: {
    minify: true,
    removeUnused: true,
    purgeCSS: true
  },
  chunking: {
    enabled: true,
    strategy: 'component',
    maxChunks: 10
  }
};
```

### Performance Budgets

Define performance constraints in `budgets.json`:

```json
{
  "maxBundleSize": 102400,
  "maxCriticalCssSize": 14336,
  "maxChunks": 15,
  "estimatedLoadTime": 2000,
  "maxTotalSize": 512000
}
```

### Deployment Presets

Use optimized presets for different deployment scenarios:

```typescript
import { ProductionCssConfigManager } from 'tw-enigma/output';

const configManager = new ProductionCssConfigManager();

// CDN optimized
configManager.applyDeploymentPreset('cdn');

// Serverless optimized
configManager.applyDeploymentPreset('serverless');

// SPA optimized
configManager.applyDeploymentPreset('spa');

// SSR optimized
configManager.applyDeploymentPreset('ssr');
```

## 📊 Performance Monitoring

### CI Integration

Set up continuous performance monitoring:

```typescript
import { createCiIntegration } from 'tw-enigma/output';

const ciIntegration = createCiIntegration({
  thresholds: {
    performanceScore: 80,
    maxSizeIncrease: 0.1 // 10% max increase
  },
  webhooks: ['https://hooks.slack.com/services/...'],
  reports: {
    format: 'html',
    outputPath: './reports/css-performance.html'
  }
});

// In your CI pipeline
const report = await generatePerformanceReport();
const result = await ciIntegration.processReport(report);

if (!result.passed) {
  process.exit(1); // Fail the build
}
```

### Performance Reports

Generate detailed performance reports:

```typescript
import { createCssReportGenerator } from 'tw-enigma/output';

const reportGenerator = createCssReportGenerator(config, performanceBudget);
const report = await reportGenerator.generateReport(optimizationResults);

// Export in different formats
const jsonReport = await reportGenerator.exportReport(report, 'json');
const htmlReport = await reportGenerator.exportReport(report, 'html');
const markdownReport = await reportGenerator.exportReport(report, 'markdown');
```

## 🔄 Framework Integration

### React/Next.js

```typescript
// next.config.js
import { withTailwindEnigma } from 'tw-enigma/next';

export default withTailwindEnigma({
  // Next.js config
}, {
  // Enigma config
  chunking: { strategy: 'route' },
  optimization: { aggressive: true }
});
```

### Vite

```typescript
// vite.config.js
import { tailwindEnigmaPlugin } from 'tw-enigma/vite';

export default {
  plugins: [
    tailwindEnigmaPlugin({
      chunking: { strategy: 'component' }
    })
  ]
};
```

### Webpack

```javascript
// webpack.config.js
const { TailwindEnigmaPlugin } = require('tw-enigma/webpack');

module.exports = {
  plugins: [
    new TailwindEnigmaPlugin({
      optimization: { removeUnused: true }
    })
  ]
};
```

## 🧪 Testing

Run the test suite:

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# Performance tests
pnpm test:performance

# Coverage report
pnpm test:coverage
```

### Test Categories

- **Unit Tests**: Individual component functionality
- **Integration Tests**: End-to-end optimization pipeline
- **Performance Tests**: Bundle size and optimization benchmarks
- **CLI Tests**: Command-line interface functionality

## 📈 Benchmarks

Typical optimization results:

| Project Type | Original Size | Optimized Size | Savings |
|--------------|---------------|----------------|---------|
| React SPA    | 2.3MB         | 456KB          | 80%     |
| Next.js App  | 1.8MB         | 312KB          | 83%     |
| Vue.js App   | 1.5MB         | 289KB          | 81%     |
| Static Site  | 890KB         | 156KB          | 82%     |

## 🛠️ API Reference

### Core Classes

#### TailwindEnigma

Main optimization engine.

```typescript
class TailwindEnigma {
  constructor(config: EnigmaConfig);
  optimize(): Promise<OptimizationResult>;
  analyzeBundle(bundle: CssBundle): Promise<BundleAnalysis>;
}
```

#### CssOutputOrchestrator

CSS output optimization coordinator.

```typescript
class CssOutputOrchestrator {
  optimizeCssOutput(bundles: CssBundle[], options: OptimizationOptions): Promise<OptimizationResult>;
  generateReport(results: OptimizationResult): Promise<CssPerformanceReport>;
  analyzeCssPerformance(bundles: CssBundle[], budget?: PerformanceBudget): Promise<PerformanceAnalysis>;
}
```

For complete API documentation, see [src/output/README.md](src/output/README.md).

## 🐛 Troubleshooting

### Common Issues

#### Large Bundle Sizes

- Enable more aggressive chunking: `chunking.strategy = 'component'`
- Increase minification: `optimization.aggressive = true`
- Check for unused CSS: Enable `optimization.removeUnused`

#### Slow Build Times

- Reduce input file patterns
- Enable caching: `cache.enabled = true`
- Use worker threads: `workers.enabled = true`

#### Memory Issues

- Increase Node.js memory: `--max-old-space-size=4096`
- Enable streaming processing: `streaming.enabled = true`
- Reduce batch sizes: `batch.size = 100`

### Debug Mode

Enable detailed logging:

```bash
DEBUG=enigma:* npx enigma optimize
```

Or in configuration:

```typescript
{
  debug: true,
  logLevel: 'debug'
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/avocardow/tw-enigma.git
cd tw-enigma
pnpm install
pnpm build
pnpm test
```

### Release Process

1. Create a changeset: `pnpm changeset`
2. Version bump: `pnpm version`
3. Publish: `pnpm release`

## 📄 License

MIT © [Rowan Cardow](https://github.com/avocardow)

## 🙏 Acknowledgments

- [Tailwind CSS](https://tailwindcss.com/) for the amazing utility-first framework
- [PostCSS](https://postcss.org/) for CSS processing capabilities
- [Cheerio](https://cheerio.js.org/) for HTML parsing
- [cssnano](https://cssnano.co/) for CSS optimization

---

**Built with ❤️ for the Tailwind CSS community**
