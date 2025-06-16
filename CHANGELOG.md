# Changelog

All notable changes to the tw-enigma monorepo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Monorepo architecture with @tw-enigma/core and @tw-enigma/cli packages
- Comprehensive test infrastructure migration to packages
- Turborepo build pipeline for efficient builds and caching
- Private package setup with registry support
- Complete documentation suite with API reference and examples
- TypeScript strict mode compliance across all packages

### Changed
- Migrated core CSS optimization engine to separate @tw-enigma/core package
- Refactored CLI functionality into @tw-enigma/cli package
- Enhanced error handling with circuit breaker patterns
- Updated build pipeline to use Turbo for monorepo optimization
- Improved test infrastructure with vitest configuration

### Deprecated
- Legacy single-package architecture (will be removed in v2.0.0)

### Security
- Enhanced input validation across all file processors
- Implemented secure path handling for file operations
- Added comprehensive error boundaries

## [1.0.0] - 2024-12-XX

### Added
- Initial CSS optimization engine
- HTML and JavaScript class extraction
- Pattern analysis and frequency tracking
- CSS generation with multiple strategies (atomic, utility, component, mixed)
- @apply directive generation for Tailwind CSS
- CLI interface for project optimization
- Configuration system with JSON/JavaScript support
- PostCSS integration for advanced optimizations
- Performance monitoring and metrics
- File discovery and processing utilities
- Error handling and logging framework

### Features
- **Core Engine**
  - CSS class extraction from HTML, JavaScript, TypeScript files
  - Pattern analysis with frequency tracking
  - CSS generation with multiple optimization strategies
  - @apply directive generation for Tailwind CSS compatibility
  - PostCSS integration for advanced CSS optimizations

- **CLI Interface**
  - Configuration initialization and management
  - Project-wide optimization commands
  - Watch mode for development
  - Progress reporting and metrics
  - Integration with build tools

- **Performance**
  - Parallel file processing
  - Memory-efficient streaming for large projects
  - Caching for repeated optimizations
  - Comprehensive performance metrics

## Package Changelog Links

For detailed changes in individual packages, see:

- [@tw-enigma/core CHANGELOG](packages/core/CHANGELOG.md)
- [@tw-enigma/cli CHANGELOG](packages/cli/CHANGELOG.md)

## Development Milestones

### Phase 1: Foundation (Completed)
- ✅ Core optimization engine
- ✅ CLI interface
- ✅ Basic file processing
- ✅ Configuration system

### Phase 2: Monorepo Conversion (In Progress)
- ✅ Package separation (@tw-enigma/core, @tw-enigma/cli)
- ✅ Turborepo integration
- ✅ Test infrastructure migration
- ✅ Build pipeline optimization
- ✅ Documentation suite

### Phase 3: Advanced Features (Planned)
- 🔄 Framework-specific plugins (React, Vue, Angular)
- 🔄 Build tool integrations (Vite, Webpack, Rollup)
- 🔄 Performance optimizations
- 🔄 Advanced analytics and reporting

### Phase 4: Ecosystem (Future)
- 📋 VS Code extension
- 📋 GitHub Actions integration
- 📋 CI/CD template
- 📋 Community plugins

## Migration Guide

### From v0.x to v1.x

The monorepo migration introduces breaking changes to the package structure:

#### Package Installation
```bash
# Before (v0.x)
npm install tw-enigma

# After (v1.x)
npm install @tw-enigma/core @tw-enigma/cli
```

#### API Usage
```javascript
// Before (v0.x)
const { optimize } = require('tw-enigma');

// After (v1.x)
const { EnhancedCSSGenerator } = require('@tw-enigma/core');
```

#### CLI Usage
```bash
# Before (v0.x)
npx tw-enigma optimize

# After (v1.x)
npx @tw-enigma/cli optimize
```

### Breaking Changes in v1.0.0

1. **Package Structure**: Split into separate core and CLI packages
2. **Import Paths**: All imports now use scoped package names
3. **Configuration**: Enhanced configuration system with new options
4. **CLI Commands**: Updated command structure and options
5. **TypeScript**: Strict mode enabled with enhanced type definitions

### Compatibility

- **Node.js**: Requires v18.0.0 or higher
- **Package Manager**: pnpm recommended, npm and yarn supported
- **TypeScript**: v5.0.0 or higher for development
- **Build Tools**: Compatible with Vite, Webpack, Rollup, esbuild

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Release Process

1. Feature development in feature branches
2. Pull request review and approval
3. Merge to main branch
4. Automated testing and validation
5. Version bumping and changelog generation
6. Automated release to npm registry

### Versioning Strategy

- **Major versions**: Breaking changes, major feature additions
- **Minor versions**: New features, non-breaking changes
- **Patch versions**: Bug fixes, documentation updates

### Support Policy

- **Current major version**: Full support with new features and bug fixes
- **Previous major version**: Security updates and critical bug fixes for 1 year
- **Older versions**: Community support only

---

For more information, visit our [GitHub repository](https://github.com/your-org/tw-enigma) or [documentation](https://tw-enigma.dev). 