# TW-Enigma Configuration System

## Overview

TW-Enigma features a comprehensive configuration system that supports multiple file formats, environment variables, CLI arguments, intelligent defaults, and validation. The system follows a clear precedence order and provides extensive customization options.

## Configuration Precedence

The configuration system applies settings in the following order (highest to lowest precedence):

1. **CLI Arguments** - Command-line flags override everything
2. **Environment Variables** - Environment-specific overrides
3. **Configuration File** - User-defined configuration
4. **Intelligent Defaults** - Context-aware default values
5. **Schema Defaults** - Built-in fallback values

## Configuration Files

### Supported Formats

TW-Enigma supports multiple configuration file formats:

- **JSON** (`.json`) - Standard JSON with optional comments
- **YAML** (`.yaml`, `.yml`) - Human-readable YAML format
- **JavaScript** (`.js`, `.mjs`) - Dynamic configuration with full JS support
- **TypeScript** (`.ts`) - Type-safe configuration
- **TOML** (`.toml`) - Simple, readable format

### File Discovery

The system searches for configuration files in the following order:

1. `tw-enigma.{ext}`
2. `tailwind-enigma.{ext}`
3. `.tw-enigma.{ext}`

Search locations (from current directory upward):
- Current working directory
- Parent directories (up to 5 levels)

### Configuration Schema

```typescript
interface TWEnigmaConfig {
  // Project settings
  root: string;
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'auto';
  
  // File discovery
  files: {
    include: string[];
    exclude: string[];
    maxFileSize: number;
    followSymlinks: boolean;
    includeHidden: boolean;
    cache: boolean;
    cacheTTL: number;
  };
  
  // Class extraction
  extraction: {
    html: boolean;
    javascript: boolean;
    css: boolean;
    templateLiterals: boolean;
    dynamicClasses: boolean;
    caseSensitive: boolean;
    ignoreEmpty: boolean;
    customPatterns: string[];
    frameworkRules: Record<string, any>;
  };
  
  // Optimization settings
  optimization: {
    level: 'none' | 'basic' | 'aggressive' | 'extreme';
    scrambleClassNames: boolean;
    minifyCSS: boolean;
    removeUnused: boolean;
    mergeSimilar: boolean;
    optimizeMediaQueries: boolean;
    optimizeKeyframes: boolean;
    treeShaking: boolean;
    preserveClasses: string[];
    presets: string[];
  };
  
  // Template literal processing
  templateLiterals: {
    enabled: boolean;
    includeTagged: boolean;
    includeMultiline: boolean;
    maxLength: number;
    enableASTParsing: boolean;
    enableFallback: boolean;
    fallbackStrategies: string[];
    cache: boolean;
    cacheTTL: number;
  };
  
  // Performance settings
  performance: {
    monitoring: boolean;
    thresholds: {
      fileProcessingTime: number;
      memoryUsage: number;
      totalProcessingTime: number;
    };
    parallel: boolean;
    workers: number;
    batchSize: number;
    useWorkerPool: boolean;
  };
  
  // Output configuration
  output: {
    outDir: string;
    cssFileName: string;
    sourceMaps: boolean;
    versioning: boolean;
    compression: 'none' | 'gzip' | 'brotli' | 'both';
    generateReport: boolean;
    reportFormat: 'json' | 'html' | 'markdown';
    clean: boolean;
  };
  
  // Logging
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    colors: boolean;
    timestamps: boolean;
    file?: string;
    maxFileSize: number;
    maxFiles: number;
    performance: boolean;
    debugComponents: string[];
  };
  
  // Caching
  cache: {
    enabled: boolean;
    directory: string;
    ttl: number;
    maxSize: number;
    clearOnVersionChange: boolean;
    compression: boolean;
  };
  
  // Plugins
  plugins: Array<{
    name: string;
    options: Record<string, any>;
    priority: number;
    enabled: boolean;
  }>;
}
```

## Environment Variables

All configuration options can be overridden using environment variables with the `TW_ENIGMA_` prefix:

```bash
# Core settings
export TW_ENIGMA_ROOT="/path/to/project"
export TW_ENIGMA_FRAMEWORK="react"

# Optimization
export TW_ENIGMA_OPTIMIZATION_LEVEL="aggressive"
export TW_ENIGMA_SCRAMBLE_CLASSES="true"
export TW_ENIGMA_MINIFY_CSS="true"

# Performance
export TW_ENIGMA_PARALLEL="true"
export TW_ENIGMA_WORKERS="4"

# Output
export TW_ENIGMA_OUT_DIR="./dist"
export TW_ENIGMA_SOURCE_MAPS="true"

# Logging
export TW_ENIGMA_LOG_LEVEL="debug"

# Caching
export TW_ENIGMA_CACHE_ENABLED="true"
export TW_ENIGMA_CACHE_DIR="./.tw-enigma-cache"
```

### Complete Environment Variable Reference

| Environment Variable | Config Path | Type | Description |
|---------------------|-------------|------|-------------|
| `TW_ENIGMA_ROOT` | `root` | string | Project root directory |
| `TW_ENIGMA_FRAMEWORK` | `framework` | string | Target framework |
| `TW_ENIGMA_OPTIMIZATION_LEVEL` | `optimization.level` | string | Optimization level |
| `TW_ENIGMA_SCRAMBLE_CLASSES` | `optimization.scrambleClassNames` | boolean | Enable class scrambling |
| `TW_ENIGMA_MINIFY_CSS` | `optimization.minifyCSS` | boolean | Enable CSS minification |
| `TW_ENIGMA_REMOVE_UNUSED` | `optimization.removeUnused` | boolean | Remove unused CSS |
| `TW_ENIGMA_OUT_DIR` | `output.outDir` | string | Output directory |
| `TW_ENIGMA_CSS_FILE_NAME` | `output.cssFileName` | string | CSS output filename |
| `TW_ENIGMA_SOURCE_MAPS` | `output.sourceMaps` | boolean | Generate source maps |
| `TW_ENIGMA_LOG_LEVEL` | `logging.level` | string | Logging level |
| `TW_ENIGMA_CACHE_ENABLED` | `cache.enabled` | boolean | Enable caching |
| `TW_ENIGMA_CACHE_DIR` | `cache.directory` | string | Cache directory |
| `TW_ENIGMA_PERFORMANCE_MONITORING` | `performance.monitoring` | boolean | Enable performance monitoring |
| `TW_ENIGMA_PARALLEL` | `performance.parallel` | boolean | Enable parallel processing |
| `TW_ENIGMA_WORKERS` | `performance.workers` | number | Number of worker threads |
| `TW_ENIGMA_TEMPLATE_LITERALS` | `templateLiterals.enabled` | boolean | Enable template literal processing |
| `TW_ENIGMA_AST_PARSING` | `templateLiterals.enableASTParsing` | boolean | Enable AST parsing |
| `TW_ENIGMA_FALLBACK` | `templateLiterals.enableFallback` | boolean | Enable fallback handling |

## CLI Arguments

Configuration options can be overridden via command-line arguments:

```bash
# Basic usage
tw-enigma --root /path/to/project --framework react

# Optimization flags
tw-enigma --optimization aggressive --no-scramble --no-minify

# Output settings
tw-enigma --out-dir ./build --css-file styles.css --source-maps

# Performance settings
tw-enigma --no-parallel --workers 2

# Logging
tw-enigma --log-level debug

# Caching
tw-enigma --no-cache --cache-dir ./.cache

# Boolean flags (disable with --no- prefix)
tw-enigma --clean --compression gzip
tw-enigma --no-clean --no-compression
```

### Complete CLI Flag Reference

| CLI Flag | Config Path | Type | Description |
|----------|-------------|------|-------------|
| `--root` | `root` | string | Project root directory |
| `--framework` | `framework` | string | Target framework |
| `--optimization` | `optimization.level` | string | Optimization level |
| `--no-scramble` | `optimization.scrambleClassNames` | boolean | Disable class scrambling |
| `--no-minify` | `optimization.minifyCSS` | boolean | Disable CSS minification |
| `--no-remove-unused` | `optimization.removeUnused` | boolean | Disable unused CSS removal |
| `--out-dir` | `output.outDir` | string | Output directory |
| `--css-file` | `output.cssFileName` | string | CSS output filename |
| `--source-maps` | `output.sourceMaps` | boolean | Generate source maps |
| `--log-level` | `logging.level` | string | Set logging level |
| `--no-cache` | `cache.enabled` | boolean | Disable caching |
| `--cache-dir` | `cache.directory` | string | Set cache directory |
| `--performance` | `performance.monitoring` | boolean | Enable performance monitoring |
| `--no-parallel` | `performance.parallel` | boolean | Disable parallel processing |
| `--workers` | `performance.workers` | number | Set worker count |
| `--no-template-literals` | `templateLiterals.enabled` | boolean | Disable template literal processing |
| `--no-ast-parsing` | `templateLiterals.enableASTParsing` | boolean | Disable AST parsing |
| `--no-fallback` | `templateLiterals.enableFallback` | boolean | Disable fallback handling |
| `--clean` | `output.clean` | boolean | Clean output directory |
| `--compression` | `output.compression` | string | Enable compression |
| `--report` | `output.generateReport` | boolean | Generate optimization report |
| `--report-format` | `output.reportFormat` | string | Set report format |

## Configuration Examples

### Basic Configuration

```json
{
  "root": "./src",
  "framework": "react",
  "optimization": {
    "level": "basic",
    "scrambleClassNames": false
  },
  "output": {
    "outDir": "./dist",
    "sourceMaps": true
  }
}
```

### Production Configuration

```yaml
root: ./src
framework: auto

optimization:
  level: aggressive
  scrambleClassNames: true
  minifyCSS: true
  removeUnused: true
  mergeSimilar: true
  treeShaking: true

output:
  outDir: ./dist
  sourceMaps: false
  compression: both
  versioning: true
  generateReport: true

performance:
  parallel: true
  workers: 4
  monitoring: false

cache:
  enabled: true
  directory: ./.tw-enigma-cache
  maxSize: 500
```

### Development Configuration

```javascript
module.exports = {
  root: './src',
  framework: 'react',
  
  optimization: {
    level: 'basic',
    scrambleClassNames: false,
    minifyCSS: false
  },
  
  output: {
    outDir: './dev-build',
    sourceMaps: true,
    generateReport: true,
    reportFormat: 'html'
  },
  
  logging: {
    level: 'debug',
    performance: true,
    debugComponents: ['template-literals', 'file-discovery']
  },
  
  performance: {
    monitoring: true,
    parallel: false // Easier debugging
  }
};
```

### Framework-Specific Configuration

#### React/Next.js
```json
{
  "framework": "react",
  "files": {
    "include": [
      "**/*.{jsx,tsx}",
      "**/components/**/*.{js,ts}",
      "**/pages/**/*.{js,ts,jsx,tsx}",
      "**/app/**/*.{js,ts,jsx,tsx}"
    ]
  },
  "extraction": {
    "templateLiterals": true,
    "dynamicClasses": true,
    "frameworkRules": {
      "react": {
        "classNameProp": "className",
        "styleProps": ["style", "sx"]
      }
    }
  }
}
```

#### Vue/Nuxt
```yaml
framework: vue
files:
  include:
    - "**/*.vue"
    - "**/components/**/*.{js,ts}"
    - "**/pages/**/*.vue"
    - "**/layouts/**/*.vue"

extraction:
  html: true
  templateLiterals: true
  frameworkRules:
    vue:
      classAttribute: "class"
      conditionalClass: ":class"
```

#### Angular
```json
{
  "framework": "angular",
  "files": {
    "include": [
      "**/*.component.{html,ts}",
      "**/src/**/*.{html,ts}",
      "**/*.module.ts"
    ]
  },
  "extraction": {
    "html": true,
    "javascript": true,
    "frameworkRules": {
      "angular": {
        "classBinding": "[class]",
        "ngClass": "[ngClass]"
      }
    }
  }
}
```

## Presets

TW-Enigma includes built-in presets for common scenarios:

### Development Preset
```json
{
  "extends": "development",
  // Inherits:
  // - optimization.level: "basic"
  // - optimization.scrambleClassNames: false
  // - optimization.minifyCSS: false
  // - output.sourceMaps: true
  // - logging.level: "debug"
  // - performance.monitoring: true
}
```

### Production Preset
```json
{
  "extends": "production",
  // Inherits:
  // - optimization.level: "aggressive"
  // - optimization.scrambleClassNames: true
  // - optimization.minifyCSS: true
  // - output.compression: "both"
  // - output.versioning: true
  // - logging.level: "warn"
  // - performance.parallel: true
}
```

### Test Preset
```json
{
  "extends": "test",
  // Inherits:
  // - optimization.level: "none"
  // - optimization.scrambleClassNames: false
  // - output.sourceMaps: true
  // - logging.level: "error"
  // - performance.parallel: false
}
```

## Configuration Inheritance

Use the `extends` property to inherit from other configurations:

```json
{
  "extends": "./base-config.json",
  "optimization": {
    "level": "aggressive"
  }
}
```

Multiple inheritance is supported:
```json
{
  "extends": ["./base-config.json", "./production-overrides.json"],
  "output": {
    "outDir": "./custom-dist"
  }
}
```

## Intelligent Defaults

TW-Enigma automatically applies intelligent defaults based on your project context:

### System-Based Defaults
- **Worker Count**: Based on CPU cores (1-8 workers)
- **Batch Size**: Based on available memory (25-500 items)
- **Cache Size**: Based on system memory (50-500 MB)

### Environment-Based Defaults
- **Development**: Disables optimizations, enables debugging
- **Production**: Enables aggressive optimizations
- **CI/CD**: Disables parallel processing to avoid resource contention

### Framework-Based Defaults
- **React**: Includes JSX/TSX patterns, React-specific extraction rules
- **Vue**: Includes .vue files, Vue-specific class bindings
- **Angular**: Includes component templates, Angular-specific directives

### Project Type Defaults
- **Library**: Enables source maps, conservative optimizations
- **Monorepo**: Shared cache directory, workspace-aware settings
- **Application**: Standard build optimizations

## Validation

The configuration system includes comprehensive validation:

### Built-in Rules
- **File System**: Validates paths exist and are accessible
- **Performance**: Warns about resource-intensive settings
- **Optimization**: Detects conflicting optimization settings
- **Security**: Checks for potentially sensitive file patterns

### Custom Validation
```typescript
import { createConfigValidator } from '@tw-enigma/core';

const validator = createConfigValidator({
  customRules: [
    {
      name: 'custom-rule',
      description: 'Custom validation rule',
      priority: 100,
      category: 'custom',
      severity: 'warning',
      enabled: true,
      validate: async (context) => {
        // Custom validation logic
        return [];
      }
    }
  ]
});
```

## Error Handling

### Common Configuration Errors

1. **File Not Found**
   ```
   Error: Config file not found: tw-enigma.json
   Suggestion: Create a config file or use --config flag
   ```

2. **Invalid Schema**
   ```
   Error: Configuration validation failed
   Path: optimization.level
   Message: Expected 'none' | 'basic' | 'aggressive' | 'extreme'
   ```

3. **Circular Inheritance**
   ```
   Error: Circular extends detected: base.json -> prod.json -> base.json
   ```

4. **Override Conflicts**
   ```
   Warning: Optimization level is 'none' but individual optimizations are enabled
   Suggestion: Set level to 'basic' or disable individual optimizations
   ```

## Programmatic Usage

### Loading Configuration
```typescript
import { loadTWEnigmaConfig } from '@tw-enigma/core';

const { config, overrides, validation } = await loadTWEnigmaConfig({
  root: '/path/to/project',
  overrideOptions: {
    cliArgs: process.argv.slice(2),
    envVars: process.env
  }
});
```

### Manual Configuration
```typescript
import { 
  createConfigManager,
  createConfigValidator,
  applyConfigOverrides 
} from '@tw-enigma/core';

// Create manager with custom options
const manager = createConfigManager({
  root: '/path/to/project',
  configNames: ['my-config'],
  validationOptions: {
    disabledRules: ['validate-output-directory']
  }
});

// Load and validate
const result = await manager.loadConfig();
```

### Configuration Updates
```typescript
// Watch for changes
const manager = createConfigManager({ watch: true });
const config = await manager.loadConfig();

// Reload configuration
const updatedConfig = await manager.reloadConfig();

// Update options
manager.updateOptions({
  validationOptions: {
    disabledRules: ['performance-warnings']
  }
});
```

## Troubleshooting

### Debug Configuration Loading
```bash
# Enable debug logging
export TW_ENIGMA_LOG_LEVEL=debug
tw-enigma

# Or via CLI
tw-enigma --log-level debug
```

### Validate Configuration
```bash
# Validate config file
tw-enigma validate-config ./tw-enigma.json

# Show resolved configuration
tw-enigma show-config

# Show configuration sources
tw-enigma show-config --show-sources
```

### Common Issues

1. **Configuration not being applied**
   - Check file discovery paths
   - Verify precedence order
   - Enable debug logging

2. **Performance issues**
   - Review worker count and batch size
   - Check memory thresholds
   - Monitor cache usage

3. **Validation errors**
   - Review error messages and suggestions
   - Check file paths and permissions
   - Verify configuration syntax

## Migration Guide

### From v1.x Configuration
```json
// Old format
{
  "inputDir": "./src",
  "outputDir": "./dist",
  "enableScrambling": true
}

// New format
{
  "root": "./src",
  "output": {
    "outDir": "./dist"
  },
  "optimization": {
    "scrambleClassNames": true
  }
}
```

### Configuration Migration Tool
```bash
# Migrate old configuration
tw-enigma migrate-config ./old-config.json ./new-config.json

# Show migration diff
tw-enigma migrate-config --dry-run ./old-config.json
```

## Best Practices

1. **Use Environment-Specific Configs**
   ```
   tw-enigma.development.json
   tw-enigma.production.json
   tw-enigma.test.json
   ```

2. **Leverage Presets**
   ```json
   {
     "extends": "production",
     "optimization": {
       "preserveClasses": ["debug-*"]
     }
   }
   ```

3. **Version Control**
   - Include base configuration files
   - Exclude environment-specific overrides
   - Document configuration decisions

4. **Performance Optimization**
   - Use appropriate worker counts
   - Enable caching in CI/CD
   - Monitor memory usage

5. **Security**
   - Exclude sensitive files
   - Use environment variables for secrets
   - Review file discovery patterns