# Turborepo Performance Configuration

This document outlines the advanced Turborepo pipeline configuration implemented for optimal monorepo performance in the tw-enigma project.

## 🚀 Configuration Overview

The tw-enigma project uses Turborepo for task orchestration and caching, with advanced configurations to maximize build performance and developer productivity.

### Key Features

- ⚡ **Parallel Task Execution**: Tasks run concurrently where dependencies allow
- 🗄️ **Intelligent Caching**: Comprehensive cache strategies for builds, tests, and linting
- 📦 **Package-Specific Optimization**: Tailored configurations for each package
- 🌐 **Remote Caching Ready**: Prepared for CI/CD and team collaboration
- 🔧 **Cross-Platform Clean Scripts**: Reliable cleanup using rimraf

## 📁 Configuration Files

### Root Configuration: `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "daemon": true,
  "cacheDir": ".turbo/cache",
  "tasks": {
    "build": { /* Core build configuration */ },
    "test": { /* Test execution with proper dependencies */ },
    "lint": { /* Linting with ESLint cache */ },
    "type-check": { /* TypeScript validation */ },
    "clean": { /* Cleanup tasks */ }
  },
  "remoteCache": {
    "signature": false,
    "enabled": true,
    "timeout": 30,
    "uploadTimeout": 60
  }
}
```

### Package-Specific Configurations

#### Core Package: `packages/core/turbo.json`
- **Inputs**: TypeScript source files, configuration files
- **Outputs**: `dist/**` directory
- **Exclusions**: Test files from build cache

#### CLI Package: `packages/cli/turbo.json`
- **Dependencies**: Depends on `@tw-enigma/core#build`
- **Inputs**: CLI source files, binary files, configurations
- **Outputs**: `dist/**` directory

## 🎯 Task Pipeline

### Build Pipeline
```
@tw-enigma/core#build (parallel with other root tasks)
        ↓
@tw-enigma/cli#build (depends on core)
```

### Test Pipeline
```
@tw-enigma/core#build (required for tests)
        ↓
@tw-enigma/core#test (parallel)
@tw-enigma/cli#test (parallel)
```

### Lint Pipeline
```
@tw-enigma/core#lint (parallel)
@tw-enigma/cli#lint (parallel)
```

## 📊 Performance Optimizations

### Cache Strategy

#### Build Tasks
- **Cache Key**: Based on source files, dependencies, and configuration
- **Inputs**: TypeScript files, package.json, tsconfig files
- **Outputs**: Built artifacts in `dist/` directories
- **Exclusions**: Test files don't affect build cache

#### Test Tasks
- **Cache Key**: Based on source and test files
- **Inputs**: All TypeScript files, test configuration
- **Outputs**: Coverage reports
- **Dependencies**: Requires built packages for integration tests

#### Lint Tasks
- **Cache Key**: Based on source files and ESLint configuration
- **Inputs**: Source files, ESLint configs, TypeScript configs
- **Outputs**: No outputs (linting doesn't produce artifacts)
- **Performance**: Uses ESLint cache for faster subsequent runs

### Input Optimization

#### Inclusion Patterns
- `$TURBO_DEFAULT$`: Standard Turbo inputs
- `src/**/*.ts`: Source TypeScript files
- `package.json`: Package dependencies
- `tsconfig.json`: TypeScript configuration
- `../../tsconfig.base.json`: Shared TypeScript config

#### Exclusion Patterns
- `!src/**/*.test.ts`: Test files excluded from build
- `!src/**/*.spec.ts`: Spec files excluded from build
- `!README.md`: Documentation doesn't affect builds

## 🧹 Clean Operations

### Available Clean Scripts

#### Root Level
```bash
# Clean specific artifacts
pnpm clean:dist        # Remove all dist directories
pnpm clean:coverage    # Remove coverage reports
pnpm clean:cache       # Clear Turbo and other caches
pnpm clean:node-modules # Remove all node_modules

# Comprehensive cleaning
pnpm clean:all         # Clean everything except node_modules
pnpm reset             # Full reset including reinstall
```

#### Package Level
```bash
# Per-package cleaning
cd packages/core
pnpm clean             # Remove dist
pnpm clean:coverage    # Remove coverage
pnpm clean:cache       # Remove caches
pnpm clean:all         # Clean everything

cd packages/cli
pnpm clean             # Remove dist
pnpm clean:coverage    # Remove coverage  
pnpm clean:cache       # Remove caches
pnpm clean:all         # Clean everything
```

#### Turbo-Native Cleaning
```bash
pnpm turbo clean       # Run clean tasks in all packages
pnpm turbo clean:cache # Clear Turbo cache only
pnpm turbo clean:all   # Comprehensive Turbo cleanup
```

## 🌐 Remote Caching

### Configuration

The project is configured for remote caching with these settings:

- **Enabled**: Ready for remote cache when credentials are available
- **Timeout**: 30 seconds for cache retrieval
- **Upload Timeout**: 60 seconds for cache uploads
- **Signature**: Disabled for simpler setup

### Setup for CI/CD

To enable remote caching in your CI/CD environment:

```bash
# Set Vercel Turborepo token
export TURBO_TOKEN="your-turbo-token"
export TURBO_TEAM="your-team-name"

# Or use Turbo login
npx turbo login
npx turbo link
```

### Benefits

- **Shared Cache**: Team members share build artifacts
- **CI Speedup**: Dramatically faster CI builds
- **Consistent Results**: Same artifacts across environments

## 📈 Performance Metrics

### Expected Performance Improvements

#### Cache Hits
- **Fresh Build**: ~2-3 minutes full build
- **Cache Hit**: ~10-30 seconds (95%+ improvement)
- **Partial Cache**: ~30-90 seconds (70%+ improvement)

#### Parallel Execution
- **Sequential**: Core → CLI build (~2-3 minutes)
- **Parallel**: Core + CLI tasks (~1-2 minutes)
- **Dependencies**: Only necessary sequencing

#### Development Workflow
- **Watch Mode**: Incremental builds in ~5-15 seconds
- **Test Runs**: Only affected packages retest
- **Linting**: ESLint cache provides sub-second runs

## 🔧 Troubleshooting

### Cache Issues

#### Clear All Caches
```bash
pnpm clean:cache
rm -rf .turbo
pnpm install
```

#### Verify Cache Configuration
```bash
pnpm turbo build --dry-run  # Shows cache strategy
pnpm turbo build --force    # Bypass cache
```

### Build Issues

#### Check Dependencies
```bash
pnpm turbo build --dry-run  # Verify task dependencies
pnpm install                # Ensure dependencies are current
```

#### Validate Configuration
```bash
# Check turbo.json syntax
cat turbo.json | jq '.'

# Verify package configurations
ls packages/*/turbo.json
```

### Performance Debugging

#### Enable Verbose Logging
```bash
pnpm turbo build --verbosity=2
pnpm turbo build --dry-run --verbosity=2
```

#### Analyze Task Performance
```bash
pnpm turbo build --profile  # Generate performance profile
```

## 🚀 Best Practices

### Development Workflow

1. **Use Watch Mode**: `pnpm dev` for continuous development
2. **Targeted Testing**: `pnpm test:core` or `pnpm test:cli` for focused testing
3. **Clean Regularly**: Use clean scripts when switching branches
4. **Cache Awareness**: Understand what invalidates caches

### CI/CD Integration

1. **Enable Remote Caching**: Set up Turbo tokens for shared caching
2. **Use Dry Runs**: Validate configurations in CI
3. **Monitor Performance**: Track build times and cache hit rates
4. **Parallel Jobs**: Structure CI to maximize Turbo's parallelization

### Configuration Maintenance

1. **Package-Specific**: Use package-level turbo.json for custom needs
2. **Input Precision**: Be specific about what affects each task
3. **Output Clarity**: Clearly define what each task produces
4. **Dependency Accuracy**: Ensure task dependencies reflect actual requirements

## 📚 Additional Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Remote Caching Guide](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Configuration Reference](https://turbo.build/repo/docs/reference/configuration)
- [Performance Optimization](https://turbo.build/repo/docs/guides/optimizing-builds) 