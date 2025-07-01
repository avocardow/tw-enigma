# CLI Reference Guide

## Overview

The TW-Enigma CLI provides comprehensive command-line tools for optimization, dry run operations, performance testing, and system management. This reference covers all available commands, options, and usage patterns.

## Installation

```bash
# Install globally
npm install -g @tw-enigma/cli

# Install locally in project
npm install --save-dev @tw-enigma/cli

# Use with npx
npx @tw-enigma/cli --help
```

## Global Options

All commands support these global options:

| Option | Alias | Description | Default |
|--------|--------|-------------|---------|
| `--help` | `-h` | Show command help | |
| `--version` | `-v` | Show version information | |
| `--config` | `-c` | Configuration file path | `tw-enigma.config.js` |
| `--verbose` | | Enable verbose logging | `false` |
| `--quiet` | `-q` | Suppress output | `false` |
| `--dry-run` | | Simulate operations without changes | `false` |
| `--no-color` | | Disable colored output | `false` |

## Core Commands

### `enigma optimize`

Optimize CSS and class names in your project.

```bash
enigma optimize [source] [options]
```

#### Arguments

- `source` - Source directory or file pattern (default: current directory)

#### Options

| Option | Alias | Type | Description | Default |
|--------|--------|------|-------------|---------|
| `--output` | `-o` | string | Output directory | `./dist` |
| `--level` | `-l` | string | Optimization level (basic\|aggressive\|extreme) | `aggressive` |
| `--framework` | `-f` | string | Target framework (react\|vue\|angular\|vanilla) | auto-detect |
| `--exclude` | `-e` | string[] | Exclude patterns | `['node_modules', '.git']` |
| `--include` | `-i` | string[] | Include patterns | `['**/*.{js,jsx,ts,tsx,vue,html,css}']` |
| `--preserve` | `-p` | string[] | Preserve class patterns | `[]` |
| `--scramble` | `-s` | boolean | Enable class name scrambling | `true` |
| `--minify` | `-m` | boolean | Minify CSS output | `true` |
| `--sourcemap` | | boolean | Generate source maps | `false` |
| `--watch` | `-w` | boolean | Watch for changes | `false` |

#### Examples

```bash
# Basic optimization
enigma optimize

# Aggressive optimization with React
enigma optimize src/ --level aggressive --framework react

# Preserve specific classes
enigma optimize --preserve "btn-*" --preserve "nav-*"

# Watch mode with custom output
enigma optimize src/ --output build/ --watch

# Exclude specific directories
enigma optimize --exclude "test/" --exclude "stories/"
```

### `enigma dry-run`

Run optimization simulation without making changes.

```bash
enigma dry-run [source] [options]
```

#### Options

| Option | Alias | Type | Description | Default |
|--------|--------|------|-------------|---------|
| `--interactive` | `-i` | boolean | Interactive CLI mode | `false` |
| `--report` | `-r` | string | Report output file | `dry-run-report.html` |
| `--format` | | string | Report format (html\|markdown\|json\|text) | `html` |
| `--diff` | `-d` | boolean | Generate visual diff | `true` |
| `--impact` | | boolean | Analyze change impact | `true` |
| `--performance` | `-p` | boolean | Include performance analysis | `false` |
| `--max-operations` | | number | Maximum operations to simulate | `10000` |
| `--timeout` | | number | Operation timeout (ms) | `5000` |

#### Examples

```bash
# Basic dry run
enigma dry-run

# Interactive mode
enigma dry-run --interactive

# Generate detailed report
enigma dry-run --report detailed-analysis.html --diff --impact

# Performance analysis
enigma dry-run --performance --format json --report perf-analysis.json

# Custom limits
enigma dry-run --max-operations 5000 --timeout 10000
```

### `enigma performance`

Run performance tests and benchmarks.

```bash
enigma performance [command] [options]
```

#### Subcommands

##### `test`

Run performance test suite.

```bash
enigma performance test [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--suite` | string | Test suite (smoke\|regression\|stress\|all) | `regression` |
| `--iterations` | number | Test iterations | `3` |
| `--warmup` | number | Warmup runs | `1` |
| `--baseline` | string | Baseline file for regression testing | |
| `--output` | string | Output file | `performance-results.json` |
| `--format` | string | Output format (json\|html\|markdown) | `json` |
| `--ci` | boolean | CI mode (reduced output) | `false` |

```bash
# Run regression tests
enigma performance test --suite regression

# Stress testing
enigma performance test --suite stress --iterations 5

# CI mode with baseline comparison
enigma performance test --ci --baseline baseline.json --format junit
```

##### `benchmark`

Run custom benchmark scenarios.

```bash
enigma performance benchmark [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--scenarios` | string | Scenarios file | `scenarios.json` |
| `--files` | number | Number of files to simulate | `100` |
| `--operations` | number | Operations per file | `3` |
| `--complexity` | number | Complexity multiplier (1-10) | `2` |
| `--output` | string | Output file | `benchmark-results.json` |

```bash
# Custom benchmark
enigma performance benchmark --files 500 --operations 4 --complexity 3

# Load scenarios from file
enigma performance benchmark --scenarios my-scenarios.json
```

##### `analyze`

Analyze existing performance results.

```bash
enigma performance analyze <results-file> [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--output` | string | Analysis output file | `analysis-report.html` |
| `--format` | string | Output format | `html` |
| `--threshold` | string | Custom thresholds file | |

```bash
# Analyze results
enigma performance analyze results.json

# Generate markdown report
enigma performance analyze results.json --format markdown --output PERFORMANCE.md
```

### `enigma config`

Manage configuration files and settings.

```bash
enigma config [command] [options]
```

#### Subcommands

##### `init`

Initialize configuration file.

```bash
enigma config init [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--template` | string | Configuration template (basic\|advanced\|framework) | `basic` |
| `--framework` | string | Target framework | auto-detect |
| `--output` | string | Config file name | `tw-enigma.config.js` |
| `--force` | boolean | Overwrite existing config | `false` |

```bash
# Initialize basic config
enigma config init

# Framework-specific config
enigma config init --template framework --framework react

# Custom output
enigma config init --output enigma.config.js --force
```

##### `validate`

Validate configuration file.

```bash
enigma config validate [config-file] [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--strict` | boolean | Strict validation mode | `false` |
| `--fix` | boolean | Auto-fix common issues | `false` |

```bash
# Validate config
enigma config validate

# Strict validation with auto-fix
enigma config validate --strict --fix
```

##### `show`

Display current configuration.

```bash
enigma config show [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--format` | string | Output format (json\|yaml\|table) | `table` |
| `--resolved` | boolean | Show resolved configuration | `false` |

```bash
# Show config as table
enigma config show

# Show resolved JSON config
enigma config show --format json --resolved
```

## Framework Commands

### `enigma react`

React-specific optimization commands.

```bash
enigma react [command] [options]
```

#### Subcommands

- `optimize` - Optimize React components
- `analyze` - Analyze React app structure
- `extract` - Extract React class usage

### `enigma vue`

Vue.js-specific optimization commands.

```bash
enigma vue [command] [options]
```

#### Subcommands

- `optimize` - Optimize Vue components
- `analyze` - Analyze Vue app structure
- `extract` - Extract Vue class usage

### `enigma angular`

Angular-specific optimization commands.

```bash
enigma angular [command] [options]
```

#### Subcommands

- `optimize` - Optimize Angular components
- `analyze` - Analyze Angular app structure
- `extract` - Extract Angular class usage

## Utility Commands

### `enigma extract`

Extract class names from source files.

```bash
enigma extract [source] [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--output` | string | Output file | `extracted-classes.json` |
| `--format` | string | Output format (json\|csv\|txt) | `json` |
| `--dedupe` | boolean | Remove duplicates | `true` |
| `--sort` | boolean | Sort results | `true` |
| `--stats` | boolean | Include usage statistics | `false` |

```bash
# Extract all classes
enigma extract src/

# With statistics
enigma extract src/ --stats --format csv --output classes.csv
```

### `enigma analyze`

Analyze project structure and class usage.

```bash
enigma analyze [source] [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--output` | string | Output file | `analysis-report.html` |
| `--format` | string | Output format | `html` |
| `--dependencies` | boolean | Analyze dependencies | `true` |
| `--unused` | boolean | Find unused classes | `false` |
| `--duplicates` | boolean | Find duplicate classes | `false` |

```bash
# Full analysis
enigma analyze src/ --dependencies --unused --duplicates

# Quick analysis
enigma analyze --format json --output quick-analysis.json
```

### `enigma validate`

Validate CSS and class usage.

```bash
enigma validate [source] [options]
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--css` | string | CSS file to validate against | |
| `--strict` | boolean | Strict validation mode | `false` |
| `--fix` | boolean | Auto-fix issues | `false` |
| `--report` | string | Validation report file | |

```bash
# Validate against CSS
enigma validate src/ --css styles.css

# Strict validation with auto-fix
enigma validate --strict --fix --report validation-report.html
```

## Environment Variables

Control CLI behavior with environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TW_ENIGMA_CONFIG` | Configuration file path | `tw-enigma.config.js` |
| `TW_ENIGMA_LOG_LEVEL` | Logging level (debug\|info\|warn\|error) | `info` |
| `TW_ENIGMA_NO_COLOR` | Disable colored output | `false` |
| `TW_ENIGMA_CACHE_DIR` | Cache directory | `~/.tw-enigma` |
| `TW_ENIGMA_TIMEOUT` | Default timeout (ms) | `30000` |

## Configuration File

### Basic Configuration

```javascript
// tw-enigma.config.js
module.exports = {
  // Input/Output
  input: './src',
  output: './dist',
  
  // Optimization
  optimization: {
    level: 'aggressive',
    scrambleClassNames: true,
    minifyCSS: true,
    preserveSourceMaps: false
  },
  
  // Framework
  framework: {
    type: 'react',
    version: '18'
  },
  
  // File handling
  files: {
    include: ['**/*.{js,jsx,ts,tsx,vue,html,css}'],
    exclude: ['node_modules/**', 'dist/**', '.git/**']
  },
  
  // Dry run
  dryRun: {
    enabled: false,
    maxOperations: 10000,
    generateReport: true,
    reportFormat: 'html'
  },
  
  // Performance
  performance: {
    enabled: false,
    baseline: './performance-baseline.json',
    thresholds: {
      maxExecutionTime: 30000,
      maxMemoryUsage: 512 * 1024 * 1024
    }
  }
};
```

### Advanced Configuration

```javascript
// tw-enigma.config.js
module.exports = {
  // Multiple build targets
  targets: {
    development: {
      optimization: { level: 'basic' },
      dryRun: { enabled: true }
    },
    production: {
      optimization: { level: 'extreme' },
      minifyCSS: true
    }
  },
  
  // Custom processors
  processors: {
    css: {
      postcss: {
        plugins: ['autoprefixer', 'cssnano']
      }
    },
    js: {
      babel: {
        presets: ['@babel/preset-react']
      }
    }
  },
  
  // Hooks
  hooks: {
    beforeOptimize: async (config) => {
      console.log('Starting optimization...');
    },
    afterOptimize: async (result) => {
      console.log(`Optimized ${result.filesProcessed} files`);
    }
  },
  
  // Performance monitoring
  performance: {
    enabled: true,
    regression: {
      baseline: './baseline.json',
      threshold: 15,
      updateOnImprovement: true
    },
    ci: {
      enabled: process.env.CI === 'true',
      outputFormat: 'junit'
    }
  }
};
```

## Exit Codes

The CLI uses standard exit codes:

| Code | Description |
|------|-------------|
| `0` | Success |
| `1` | General error |
| `2` | Configuration error |
| `3` | File system error |
| `4` | Validation error |
| `5` | Performance test failure |
| `6` | Timeout error |

## Examples and Workflows

### Development Workflow

```bash
# Initialize project
enigma config init --framework react

# Run dry-run to preview changes
enigma dry-run --interactive

# Optimize for development
enigma optimize --level basic --watch

# Run performance tests
enigma performance test --suite smoke
```

### Production Build

```bash
# Validate configuration
enigma config validate --strict

# Run full dry-run analysis
enigma dry-run --report prod-analysis.html --diff --impact --performance

# Optimize for production
enigma optimize --level extreme --minify --sourcemap

# Run regression tests
enigma performance test --suite regression --baseline prod-baseline.json
```

### CI/CD Integration

```bash
# Validate configuration
enigma config validate --strict || exit 1

# Run performance tests
enigma performance test --ci --baseline baseline.json --format junit

# Optimize with dry-run validation
enigma dry-run --format json --report dry-run-ci.json
enigma optimize --level aggressive

# Generate reports
enigma analyze --output analysis-report.html
```

### Framework-Specific Examples

#### React Project

```bash
# Initialize React config
enigma config init --framework react

# React-specific analysis
enigma react analyze src/components/

# Optimize React components
enigma react optimize --preserve "react-*"

# Performance test with React scenarios
enigma performance benchmark --scenarios react-scenarios.json
```

#### Vue.js Project

```bash
# Initialize Vue config
enigma config init --framework vue

# Vue-specific optimization
enigma vue optimize src/ --preserve "v-*"

# Analyze Vue components
enigma vue analyze --output vue-analysis.html
```

#### Angular Project

```bash
# Initialize Angular config
enigma config init --framework angular

# Angular-specific optimization
enigma angular optimize src/app/

# Analyze Angular modules
enigma angular analyze --dependencies
```

## Troubleshooting

### Common Issues

#### Configuration Errors

```bash
# Validate configuration
enigma config validate --strict

# Show resolved configuration
enigma config show --resolved --format json
```

#### Performance Issues

```bash
# Enable verbose logging
enigma optimize --verbose

# Use debug mode
TW_ENIGMA_LOG_LEVEL=debug enigma optimize

# Check cache directory
ls -la ~/.tw-enigma/
```

#### Memory Issues

```bash
# Reduce batch size
enigma optimize --batch-size 50

# Disable sourcemaps
enigma optimize --no-sourcemap

# Use streaming mode
enigma optimize --stream
```

### Debug Mode

```bash
# Enable debug logging
export TW_ENIGMA_LOG_LEVEL=debug
enigma optimize --verbose

# Save debug info
enigma dry-run --debug --report debug-report.json

# Performance profiling
enigma performance test --profile --output profile-results.json
```

## Getting Help

### Command Help

```bash
# General help
enigma --help

# Command-specific help
enigma optimize --help
enigma dry-run --help
enigma performance --help

# Show examples
enigma optimize --examples
```

### Version Information

```bash
# Show version
enigma --version

# Show detailed version info
enigma --version --verbose
```

### Documentation

- [User Guide](./DRY_RUN_GUIDE.md)
- [Performance Testing](./PERFORMANCE_TESTING.md)
- [API Reference](./API_REFERENCE.md)
- [Examples](../examples/)

### Support

- GitHub Issues: [Report bugs and request features](https://github.com/your-repo/issues)
- Documentation: [Complete documentation](./README.md)
- Examples: [Working examples](../examples/)