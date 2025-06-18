# @tw-enigma/cli

[![npm version](https://img.shields.io/npm/v/@tw-enigma/cli.svg)](https://www.npmjs.com/package/@tw-enigma/cli)
[![Downloads](https://img.shields.io/npm/dm/@tw-enigma/cli.svg)](https://npmjs.org/package/@tw-enigma/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

> Command-line interface for tw-enigma - powerful CSS optimization tools for Tailwind CSS projects.

## 🎯 Overview

`@tw-enigma/cli` provides a comprehensive command-line interface for the tw-enigma CSS optimization system. Use it to analyze your Tailwind CSS usage patterns, generate optimized stylesheets, and integrate CSS optimization into your build pipelines.

### ✨ Features

- **🔍 Project Analysis**: Deep analysis of Tailwind CSS usage patterns
- **⚡ CSS Optimization**: Generate optimized atomic or chunked CSS
- **🛠️ Configuration Management**: Easy setup and configuration management
- **📊 Performance Metrics**: Detailed optimization reports and analytics
- **🔧 Build Integration**: Seamless integration with build tools and CI/CD
- **🎨 Multiple Strategies**: Atomic, chunked, and hybrid optimization strategies
- **📈 Progress Monitoring**: Real-time progress indicators and verbose logging

## 📦 Installation

### Global Installation (Recommended)

```bash
# npm
npm install -g @tw-enigma/cli

# pnpm
pnpm add -g @tw-enigma/cli

# yarn
yarn global add @tw-enigma/cli
```

### Local Installation

```bash
# npm
npm install --save-dev @tw-enigma/cli

# pnpm
pnpm add -D @tw-enigma/cli

# yarn
yarn add --dev @tw-enigma/cli
```

### One-time Usage

```bash
npx @tw-enigma/cli [command] [options]
```

## 🚀 Quick Start

### 1. Initialize Configuration

```bash
# Create configuration file with defaults
enigma init

# Interactive setup with prompts
enigma init --interactive

# Set project type and framework
enigma init --framework react --strategy atomic
```

### 2. Analyze Your Project

```bash
# Analyze Tailwind usage patterns
enigma analyze

# Analyze with detailed reporting
enigma analyze --report --output analysis.json

# Analyze specific directories
enigma analyze --paths "src/**/*.tsx" --paths "components/**/*.jsx"
```

### 3. Generate Optimized CSS

```bash
# Generate optimized CSS
enigma generate

# Generate with specific strategy
enigma generate --strategy chunked --output dist/optimized.css

# Generate with minification
enigma generate --minify --sourcemap
```

### 4. Watch for Changes

```bash
# Watch mode for development
enigma watch

# Watch with hot reload
enigma watch --hmr --verbose
```

## 🔧 Global Options

All `enigma` commands support these global options that can be combined with any command:

### Class Name Generation

- **`--length <number>`** - Set minimum class name length (1-26)

  ```bash
  # Generate longer class names for enhanced security
  enigma --length 8 init --framework react
  enigma --length 12 generate --strategy atomic

  # Use with analysis and reporting
  enigma --length 6 analyze --report --verbose
  ```

### Output Control

- **`--verbose`** - Enable detailed logging and debug information
- **`--debug`** - Enable debug mode with comprehensive diagnostics
- **`--pretty`** - Format output for better readability
- **`--quiet`** - Suppress all output except warnings and errors

### Configuration

- **`--config <path>`** - Specify custom configuration file path
- **`--input <path>`** - Override input directory
- **`--output <path>`** - Override output directory

### Performance & Processing

- **`--max-concurrency <number>`** - Control parallel processing threads
- **`--exclude-patterns <patterns...>`** - Exclude files from processing
- **`--format <format>`** - Output format (json, console, markdown, html, all)

### Usage Examples

```bash
# Enhanced security with longer class names
enigma --length 10 --verbose generate --strategy chunked

# Custom configuration with performance tuning
enigma --config ./config/enigma.config.js --max-concurrency 8 analyze

# Development workflow with detailed output
enigma --length 6 --pretty --debug init --interactive

# Production build with optimized settings
enigma --length 12 --quiet generate --minify --sourcemap
```

### Security & Obfuscation Benefits

The `--length` flag provides enhanced security through class name obfuscation:

| Length | Possible Combinations | Security Level | Use Case                        |
| ------ | --------------------- | -------------- | ------------------------------- |
| 1-3    | 18-18,278             | Basic          | Development, small projects     |
| 4-6    | 456K-476M             | Moderate       | Medium projects, basic security |
| 7-10   | 12B-18.7T             | High           | Enterprise, security-focused    |
| 11+    | 487T+                 | Maximum        | High-security, government       |

**Performance Considerations:**

- Longer names increase CSS file size but improve obfuscation
- Length 6-8 provides excellent security/performance balance
- Length 10+ recommended for maximum security requirements
- Use warning system to monitor performance impact

## 📋 Commands

### `enigma init`

Initialize a new tw-enigma configuration.

```bash
enigma init [options]

Options:
  --framework <type>    Target framework (react, vue, angular, svelte)
  --strategy <type>     Optimization strategy (atomic, chunked, hybrid)
  --interactive         Interactive configuration setup
  --force              Overwrite existing configuration
  --template <name>     Use configuration template
  --output <path>       Configuration file path (default: enigma.config.js)

Examples:
  enigma init --framework react --strategy atomic
  enigma init --interactive --output config/enigma.js
  enigma init --template production --force
```

### `enigma analyze`

Analyze Tailwind CSS usage patterns in your project.

```bash
enigma analyze [options]

Options:
  --paths <patterns>    File patterns to analyze (can be used multiple times)
  --exclude <patterns>  Patterns to exclude (can be used multiple times)
  --framework <type>    Target framework for analysis
  --threshold <number>  Minimum pattern frequency (default: 2)
  --report             Generate detailed analysis report
  --output <path>      Report output path (default: enigma-analysis.json)
  --format <type>      Report format (json, csv, html)
  --verbose            Enable verbose logging

Examples:
  enigma analyze --paths "src/**/*.tsx" --threshold 3
  enigma analyze --report --output reports/analysis.html --format html
  enigma analyze --exclude "**/*.test.*" --verbose
```

### `enigma generate`

Generate optimized CSS from analyzed patterns.

```bash
enigma generate [options]

Options:
  --strategy <type>     Optimization strategy (atomic, chunked, hybrid)
  --output <path>      Output CSS file path (default: dist/enigma.css)
  --minify             Minify generated CSS
  --sourcemap          Generate source maps
  --watch              Watch mode for continuous generation
  --clean              Clean output directory before generation
  --dry-run            Preview changes without writing files
  --format <type>      Output format (css, scss, less)

Examples:
  enigma generate --strategy chunked --output assets/optimized.css
  enigma generate --minify --sourcemap --clean
  enigma generate --dry-run --verbose
```

### `enigma watch`

Watch for file changes and automatically regenerate optimized CSS.

```bash
enigma watch [options]

Options:
  --hmr                Enable hot module replacement
  --debounce <ms>      Debounce delay for file changes (default: 300)
  --ignore <patterns>  Patterns to ignore (can be used multiple times)
  --poll               Use polling instead of native file watching
  --verbose            Enable verbose logging
  --notify             Show desktop notifications for changes

Examples:
  enigma watch --hmr --debounce 500
  enigma watch --ignore "**/*.test.*" --notify
  enigma watch --poll --verbose
```

### `enigma optimize`

One-command optimization for existing projects.

```bash
enigma optimize [paths] [options]

Options:
  --strategy <type>     Optimization strategy (atomic, chunked, hybrid)
  --output <path>      Output directory for optimized files
  --backup             Create backup of original files
  --threshold <number>  Minimum pattern frequency
  --aggressive         Enable aggressive optimizations
  --dry-run            Preview changes without modifying files
  --report             Generate optimization report

Examples:
  enigma optimize "dist/**/*.html" --strategy atomic --backup
  enigma optimize "build/**/*.{js,css}" --aggressive --report
  enigma optimize --dry-run --verbose
```

### `enigma config`

Manage configuration settings.

```bash
enigma config [command] [options]

Commands:
  set <key> <value>    Set configuration value
  get <key>           Get configuration value
  list                List all configuration values
  reset               Reset to default configuration
  validate            Validate current configuration
  migrate             Migrate configuration to latest version

Examples:
  enigma config set optimization.threshold 5
  enigma config get output.strategy
  enigma config list --format table
  enigma config validate --verbose
```

### `enigma report`

Generate detailed optimization and performance reports.

```bash
enigma report [type] [options]

Types:
  patterns             Pattern analysis report
  performance          Performance metrics report
  optimization         Optimization results report
  bundle               Bundle size analysis report

Options:
  --output <path>      Report output path
  --format <type>      Report format (json, html, csv, pdf)
  --template <name>    Report template
  --compare <path>     Compare with previous report
  --metrics <types>    Specific metrics to include

Examples:
  enigma report patterns --format html --output reports/patterns.html
  enigma report performance --compare previous-report.json
  enigma report bundle --metrics size,compression,performance
```

### `enigma clean`

Clean generated files and caches.

```bash
enigma clean [targets] [options]

Targets:
  cache               Clean optimization cache
  output              Clean generated output files
  reports             Clean generated reports
  all                 Clean everything

Options:
  --force             Force cleanup without confirmation
  --dry-run           Preview what would be cleaned
  --verbose           Show detailed cleanup information

Examples:
  enigma clean cache --force
  enigma clean output reports --dry-run
  enigma clean all --verbose
```

### `enigma doctor`

Diagnose and fix common issues.

```bash
enigma doctor [options]

Options:
  --fix               Automatically fix detected issues
  --report            Generate diagnostic report
  --output <path>     Diagnostic report output path
  --verbose           Show detailed diagnostic information

Examples:
  enigma doctor --fix --verbose
  enigma doctor --report --output diagnostics.json
```

## ⚙️ Configuration

### Configuration File

Create `enigma.config.js` in your project root:

```javascript
export default {
  // Input configuration
  input: {
    // File patterns to analyze
    paths: ['src/**/*.{html,js,ts,jsx,tsx,vue,svelte}', 'components/**/*.{jsx,tsx,vue}'],

    // Patterns to exclude
    exclude: ['node_modules/**', '**/*.test.*', '**/*.spec.*', 'dist/**', 'build/**'],

    // Target frameworks
    frameworks: ['react', 'vue'],

    // File encoding
    encoding: 'utf8',
  },

  // Output configuration
  output: {
    // Optimization strategy
    strategy: 'atomic', // 'atomic' | 'chunked' | 'hybrid'

    // Output file path
    path: 'dist/enigma.css',

    // CSS format
    format: 'css', // 'css' | 'scss' | 'less'

    // Minification
    minify: true,

    // Source maps
    sourceMaps: true,

    // Public path for assets
    publicPath: '/assets/',
  },

  // Optimization settings
  optimization: {
    // Minimum pattern frequency for inclusion
    threshold: 2,

    // Enable aggressive optimizations
    aggressive: false,

    // Preserve comments in output
    preserveComments: false,

    // Enable tree shaking
    enableTreeShaking: true,

    // Custom optimization rules
    rules: {
      // Combine adjacent utility classes
      combineAdjacent: true,

      // Remove duplicate classes
      removeDuplicates: true,

      // Optimize vendor prefixes
      optimizeVendorPrefixes: true,
    },
  },

  // Development settings
  dev: {
    // Enable hot module replacement
    hmr: true,

    // Enable debug logging
    debug: process.env.NODE_ENV === 'development',

    // Watch mode settings
    watch: {
      enabled: true,
      debounce: 300,
      ignored: ['node_modules/**', '.git/**'],
    },
  },

  // Cache configuration
  cache: {
    // Enable caching
    enabled: true,

    // Cache strategy
    strategy: 'memory', // 'memory' | 'disk' | 'hybrid'

    // Cache directory
    directory: '.enigma-cache',

    // Cache TTL (in milliseconds)
    ttl: 3600000, // 1 hour

    // Maximum cache size
    maxSize: '100MB',
  },

  // Plugin configuration
  plugins: [
    // Custom plugins
  ],

  // Reporting settings
  reporting: {
    // Enable analytics
    analytics: true,

    // Report formats to generate
    formats: ['json', 'html'],

    // Report output directory
    outputDir: 'reports',

    // Metrics to track
    metrics: ['compression', 'performance', 'patterns', 'bundle-size'],
  },
};
```

### Environment Variables

Configure behavior using environment variables:

```bash
# Debug mode
ENIGMA_DEBUG=true

# Log level
ENIGMA_LOG_LEVEL=info  # debug, info, warn, error

# Cache settings
ENIGMA_CACHE_ENABLED=true
ENIGMA_CACHE_DIR=.enigma-cache

# Performance settings
ENIGMA_MAX_CONCURRENCY=8
ENIGMA_MEMORY_LIMIT=512MB

# Output settings
ENIGMA_MINIFY=true
ENIGMA_SOURCE_MAPS=true
```

### Configuration Templates

Use built-in templates for quick setup:

```bash
# React project with TypeScript
enigma init --template react-ts

# Vue.js project
enigma init --template vue

# Production-optimized configuration
enigma init --template production

# Development configuration
enigma init --template development

# Monorepo configuration
enigma init --template monorepo
```

## 🔧 Integration Examples

### npm Scripts

```json
{
  "scripts": {
    "enigma:analyze": "enigma analyze --report",
    "enigma:generate": "enigma generate --minify",
    "enigma:watch": "enigma watch --hmr",
    "enigma:optimize": "enigma optimize dist/**/*.html --backup",
    "build": "vite build && enigma generate --minify --clean",
    "dev": "concurrently \"vite dev\" \"enigma watch --hmr\""
  }
}
```

### GitHub Actions

```yaml
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
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Analyze CSS patterns
        run: npx @tw-enigma/cli analyze --report --format html

      - name: Generate optimized CSS
        run: npx @tw-enigma/cli generate --minify --sourcemap

      - name: Upload optimization report
        uses: actions/upload-artifact@v3
        with:
          name: enigma-report
          path: reports/
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install enigma CLI globally
RUN npm install -g @tw-enigma/cli

# Copy project files
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Build and optimize
RUN npm run build && \
    enigma optimize dist/**/*.html --minify --report

CMD ["npm", "start"]
```

## 📊 Output Examples

### Analysis Report

```bash
enigma analyze --report --format html
```

Generates a comprehensive HTML report showing:

- Pattern frequency analysis
- Optimization opportunities
- Bundle size estimates
- Performance recommendations
- Visual pattern maps

### JSON Output

```bash
enigma analyze --output analysis.json
```

```json
{
  "summary": {
    "filesAnalyzed": 45,
    "patternsFound": 127,
    "optimizationOpportunities": 89,
    "estimatedSavings": "68%"
  },
  "patterns": [
    {
      "id": "pattern-1",
      "classes": ["flex", "items-center", "justify-center"],
      "frequency": 23,
      "locations": [
        { "file": "src/components/Button.tsx", "line": 12 },
        { "file": "src/components/Card.tsx", "line": 8 }
      ],
      "estimatedSavings": "45%"
    }
  ],
  "recommendations": [
    {
      "type": "atomic-class",
      "pattern": "flex items-center justify-center",
      "frequency": 23,
      "suggestedName": "tw-flex-center",
      "savings": "234 bytes"
    }
  ]
}
```

### CSS Generation

```bash
enigma generate --strategy atomic --minify
```

Generates optimized CSS:

```css
/* Generated by tw-enigma/cli */
.tw-1 {
  @apply flex items-center justify-center;
}
.tw-2 {
  @apply px-4 py-2 bg-blue-500 text-white rounded;
}
.tw-3 {
  @apply hover:bg-blue-600 transition-colors;
}
.tw-4 {
  @apply bg-white rounded-lg shadow-md p-6 border;
}
/* ... more optimized classes ... */
```

## 🔍 Debugging

### Verbose Mode

Enable detailed logging to debug issues:

```bash
enigma analyze --verbose
enigma generate --verbose --debug
enigma watch --verbose --debug
```

### Debug Information

```bash
# Show configuration
enigma config list --verbose

# Validate setup
enigma doctor --verbose

# Check cache status
enigma clean cache --dry-run --verbose
```

### Common Issues

#### No patterns found

```bash
# Check file paths
enigma analyze --paths "src/**/*.tsx" --verbose

# Lower threshold
enigma analyze --threshold 1 --verbose

# Check exclusions
enigma analyze --exclude "" --verbose
```

#### Build integration issues

```bash
# Test configuration
enigma config validate

# Check build output
enigma optimize "dist/**/*.html" --dry-run --verbose

# Verify file permissions
ls -la dist/
```

#### Performance issues

```bash
# Clean cache
enigma clean cache --force

# Reduce concurrency
ENIGMA_MAX_CONCURRENCY=2 enigma generate

# Monitor memory usage
enigma generate --verbose
```

## 🧪 Testing

### Test Commands

```bash
# Test configuration
enigma config validate

# Dry run analysis
enigma analyze --dry-run

# Dry run generation
enigma generate --dry-run

# Test optimization
enigma optimize "test-files/**/*.html" --dry-run
```

### CI/CD Testing

```bash
# Non-interactive mode
CI=true enigma init --template production --force

# Fail on issues
enigma doctor --fix --verbose || exit 1

# Generate reports for CI
enigma analyze --report --format json --output ci-report.json
```

## 📄 License

This package is part of the tw-enigma project and is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](../../CONTRIBUTING.md) for details on how to get started.

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/avocardow/tw-enigma/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/avocardow/tw-enigma/discussions)
