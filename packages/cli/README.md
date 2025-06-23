# @tw-enigma/cli

[![npm version](https://img.shields.io/npm/v/@tw-enigma/cli.svg)](https://www.npmjs.com/package/@tw-enigma/cli)
[![Downloads](https://img.shields.io/npm/dm/@tw-enigma/cli.svg)](https://npmjs.org/package/@tw-enigma/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

> Command-line interface for tw-enigma - powerful CSS optimization tools for Tailwind CSS projects.

## 🎯 Overview

`@tw-enigma/cli` provides a comprehensive command-line interface for the tw-enigma CSS optimization system. The main `enigma` command optimizes Tailwind CSS by consolidating repetitive class patterns, reducing file size, and offering optional scramble text effects integration.

### ✨ Features

- **⚡ CSS Optimization**: Consolidate repetitive Tailwind CSS class patterns for smaller file sizes
- **🔍 File Discovery**: Intelligent file discovery with glob patterns and type filtering
- **🛠️ Configuration Management**: Flexible configuration with auto-discovery and CLI overrides
- **🎯 Dry Run Mode**: Preview optimization changes without modifying files
- **🎨 Scramble Effects**: Optional integration with @tw-enigma/scramble for animated text effects
- **🔧 Build Integration**: Easy integration with existing build tools and workflows
- **📈 Progress Monitoring**: Real-time progress indicators and comprehensive logging

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

### 1. Basic Optimization

```bash
# Basic optimization with default settings
enigma

# Optimize specific directory with output
enigma --input src --output dist

# Preview changes without modifying files
enigma --dry-run --verbose
```

### 2. Configuration-based Optimization

```bash
# Use specific configuration file
enigma --config enigma.config.js

# Override configuration with CLI options
enigma --config myconfig.js --minify --source-maps
```

### 3. Advanced Features

```bash
# Enable scramble text effects (requires @tw-enigma/scramble)
enigma --scramble --scramble-speed 100

# High concurrency processing
enigma --max-concurrency 8 --verbose

# Custom file filtering
enigma --include-file-types HTML JAVASCRIPT --exclude-extensions .min.js
```

## 🔧 Command Options

The `enigma` command supports these options for controlling optimization behavior:

### Input/Output Control

- **`--input <path>`** - Input file or directory to process. Supports glob patterns.
- **`--output <path>`** - Output file or directory for optimized results.
- **`--config <path>`** - Path to configuration file (auto-discovered if not specified).
- **`--dry-run`** - Preview mode - analyze without modifying files.

### Processing Options

- **`--minify`** / **`--no-minify`** - Enable/disable CSS minification.
- **`--remove-unused`** / **`--no-remove-unused`** - Remove/keep unused CSS classes.
- **`--preserve-comments`** - Keep CSS comments in optimized output.
- **`--source-maps`** - Generate source map files for debugging.

### File Discovery

- **`--include-file-types <types...>`** - File types: HTML, JAVASCRIPT, CSS, TEMPLATE.
- **`--exclude-extensions <extensions...>`** - File extensions to skip (e.g., .min.js).
- **`--exclude-patterns <patterns...>`** - Glob patterns to exclude.
- **`--follow-symlinks`** - Follow symbolic links during discovery.
- **`--max-files <number>`** - Safety limit for number of files to process.

### Performance & Logging

- **`--max-concurrency <number>`** - Concurrent file processing (1-10, default: 4).
- **`--verbose`** - Enable detailed logging and debug information.
- **`--very-verbose`** - Enable trace-level logging with detailed operations.
- **`--quiet`** - Suppress all output except warnings and errors.
- **`--debug`** - Enable debug mode with comprehensive diagnostics.
- **`--log-level <level>`** - Set minimum log level (trace, debug, info, warn, error, fatal).
- **`--log-file <path>`** - Write logs to file.
- **`--log-format <format>`** - Log format: human, json, csv.

### Scramble Effects (Optional)

- **`--scramble`** - Enable scramble text effects (requires @tw-enigma/scramble).
- **`--scramble-speed <number>`** - Animation speed in milliseconds (50-1000, default: 150).
- **`--scramble-debug`** - Enable debug logging for scramble effects.
- **`--scramble-mode <mode>`** - Animation mode: "all", "recursive", or custom.
- **`--scramble-charset <charset>`** - Character set for scrambling (default: a-z).

### Usage Examples

```bash
# Basic optimization with auto-discovery
enigma

# Specify input and output directories  
enigma --input src --output dist

# Preview optimization without changes
enigma --dry-run --verbose

# Enable scrambling effect with custom speed
enigma --scramble --scramble-speed 100

# Production build with minification and source maps
enigma --minify --source-maps --quiet

# Custom configuration with performance tuning
enigma --config ./config/enigma.config.js --max-concurrency 8

# High concurrency processing with detailed logging
enigma --max-concurrency 8 --very-verbose

# Exclude specific file types and patterns
enigma --exclude-extensions .min.js .min.css --exclude-patterns "node_modules/**"
```

## 📋 Main Command

### `enigma`

Optimize Tailwind CSS by consolidating repetitive class patterns and reducing file size.

```bash
enigma [options]

Options:
  # Input/Output
  --input <path>                    Input file or directory (default: "./src")
  --output <path>                   Output file or directory (default: "./dist")
  --config <path>                   Configuration file path (auto-discovered)
  --dry-run                         Preview changes without modifying files
  
  # Processing
  --minify / --no-minify           Enable/disable CSS minification
  --remove-unused / --no-remove-unused  Remove/keep unused CSS classes
  --preserve-comments               Keep CSS comments in output
  --source-maps                     Generate source map files
  
  # File Discovery
  --include-file-types <types...>   File types: HTML, JAVASCRIPT, CSS, TEMPLATE
  --exclude-extensions <exts...>    File extensions to exclude
  --exclude-patterns <patterns...>  Glob patterns to exclude
  --follow-symlinks                 Follow symbolic links
  --max-files <number>              Maximum files to process
  
  # Performance
  --max-concurrency <number>        Concurrent processing (1-10, default: 4)
  
  # Logging
  --verbose                         Enable detailed logging
  --very-verbose                    Enable trace-level logging
  --quiet                           Only warnings and errors
  --debug                           Debug mode
  --log-level <level>               Minimum log level
  --log-file <path>                 Write logs to file
  --log-format <format>             Log format: human, json, csv
  
  # Scramble Effects (Optional)
  --scramble                        Enable scramble text effects
  --scramble-speed <number>         Animation speed (50-1000ms, default: 150)
  --scramble-debug                  Debug scramble effects
  --scramble-mode <mode>            Animation mode
  --scramble-charset <charset>      Character set for scrambling

Examples:
  enigma                                    # Basic optimization
  enigma --input src --output dist         # Specify directories
  enigma --dry-run --verbose               # Preview with details
  enigma --scramble --scramble-speed 100   # Enable scrambling
  enigma --minify --source-maps            # Production build
  enigma --max-concurrency 8 --debug       # High performance
```

## ⚙️ Configuration

### Configuration File

Create `enigma.config.js` in your project root:

```javascript
export default {
  // Input/Output settings
  input: "./src",
  output: "./dist",
  
  // Processing options
  minify: true,
  removeUnused: true,
  preserveComments: false,
  sourceMaps: false,
  
  // File discovery
  followSymlinks: false,
  maxFiles: 1000,
  includeFileTypes: ["HTML", "JAVASCRIPT"],
  excludeExtensions: [".min.js", ".min.css"],
  excludePatterns: ["node_modules/**", "*.test.*"],
  
  // Performance
  maxConcurrency: 4,
  
  // Logging
  verbose: false,
  veryVerbose: false,
  quiet: false,
  debug: false,
  logLevel: "info",
  logFile: undefined,
  logFormat: "human",
  
  // Advanced options
  classPrefix: "",
  
  // Development mode (future)
  dev: {
    enabled: false,
    watch: false,
    server: {
      enabled: false,
      port: 3000,
      host: "localhost"
    }
  }
};
```

### Configuration Discovery

The CLI automatically searches for configuration files in this order:

1. File specified with `--config` option
2. `enigma.config.js`
3. `enigma.config.mjs`
4. `.enigmarc.json`
5. `.enigmarc.js`
6. `enigma` section in `package.json`

### Configuration Priority

Settings are merged in this order (later values override earlier ones):

1. Default configuration
2. Configuration file
3. CLI arguments

This allows you to set base configuration in a file and override specific options via CLI.

## 🔧 Integration Examples

### npm Scripts

```json
{
  "scripts": {
    "enigma": "enigma",
    "enigma:dev": "enigma --dry-run --verbose",
    "enigma:prod": "enigma --minify --source-maps",
    "enigma:scramble": "enigma --scramble --scramble-speed 100",
    "build": "vite build && enigma --minify --quiet",
    "build:analyze": "vite build && enigma --dry-run --verbose"
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

      - name: Optimize CSS
        run: npx @tw-enigma/cli --minify --source-maps --quiet

      - name: Verify optimization
        run: npx @tw-enigma/cli --dry-run --verbose
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
    enigma --minify --quiet

CMD ["npm", "start"]
```

## 📊 Output Examples

### Console Output

```bash
enigma --verbose
```

Shows detailed progress information:

```
🎯 Enigma optimization starting...
✅ Configuration loaded successfully
🔧 Testing core optimization engine...
✅ Core optimization engine working - 3 classes processed
🔍 Discovering files for processing...
📁 Found 42 files to process
🔍 Checking scramble package availability...
ℹ️  Scramble package not available - using basic optimization
🎉 Enigma optimization complete!
```

### Dry Run Output

```bash
enigma --dry-run --verbose
```

Previews what would be optimized:

```
🔍 Running in dry-run mode - no files will be modified
🎯 Enigma optimization starting...
✅ Configuration loaded successfully
📁 Found 42 files to process
⚠️  No files found to process. Check your input patterns and file paths.
```

### With Scramble Effects

```bash
enigma --scramble --scramble-debug
```

When @tw-enigma/scramble is installed:

```
🔄 Starting scramble integration pipeline...
✅ Scramble module imported successfully
🔧 Building scramble with configuration...
💉 Injecting scramble into HTML files...
✅ Scramble integration complete!
📄 HTML files processed: 3
✨ Scramble integration: Enabled
```

## 🔍 Debugging

### Verbose Mode

Enable detailed logging to debug issues:

```bash
enigma --verbose                    # Detailed logging
enigma --very-verbose               # Trace-level logging
enigma --debug                      # Debug mode
enigma --log-level debug           # Specific log level
```

### Common Issues

#### No files found

```bash
# Check input patterns
enigma --input "src/**/*.tsx" --verbose

# Check file discovery
enigma --include-file-types HTML JAVASCRIPT --verbose

# Check exclusions
enigma --exclude-patterns "" --verbose
```

#### Configuration issues

```bash
# Test configuration loading
enigma --config enigma.config.js --verbose

# Preview without changes
enigma --dry-run --verbose

# Check file permissions
ls -la src/ dist/
```

#### Performance issues

```bash
# Reduce concurrency
enigma --max-concurrency 2 --verbose

# Limit file processing
enigma --max-files 100 --verbose

# Monitor resource usage
enigma --debug
```

#### Scramble integration issues

```bash
# Check package availability
npm list @tw-enigma/scramble

# Enable scramble debugging
enigma --scramble --scramble-debug --verbose

# Test without scramble
enigma --verbose
```

## 🧪 Testing

### Test Commands

```bash
# Test without making changes
enigma --dry-run

# Test with specific configuration
enigma --config test.config.js --dry-run

# Test file discovery
enigma --include-file-types HTML --dry-run --verbose

# Test with debug output
enigma --debug --dry-run
```

### CI/CD Testing

```bash
# Silent optimization for CI
enigma --quiet

# Verification mode
enigma --dry-run --verbose

# Performance test
enigma --max-concurrency 1 --max-files 10 --dry-run
```

## 📄 License

This package is part of the tw-enigma project and is licensed under the MIT License. See the [LICENSE](../../LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](../../CONTRIBUTING.md) for details on how to get started.

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/avocardow/tw-enigma/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/avocardow/tw-enigma/discussions)
