# Tailwind Enigma Examples & Tutorials

[![npm version](https://img.shields.io/npm/v/@tw-enigma/core.svg)](https://www.npmjs.com/package/@tw-enigma/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)
[![Examples Status](https://img.shields.io/badge/examples-tested-green.svg)](#testing-examples)

This directory contains practical examples and tutorials demonstrating how to use tw-enigma across different frameworks, build tools, and deployment scenarios. Each example is thoroughly tested and includes step-by-step instructions.

## 📁 Directory Structure

```
examples/
├── frameworks/           # Framework-specific integrations
│   ├── react/           # React applications
│   ├── vue/             # Vue.js applications
│   ├── angular/         # Angular applications
│   ├── svelte/          # Svelte applications
│   └── next/            # Next.js applications
├── build-tools/         # Build tool integrations
│   ├── vite/            # Vite configurations
│   ├── webpack/         # Webpack setups
│   ├── rollup/          # Rollup configurations
│   └── postcss/         # PostCSS plugins
├── tutorials/           # Step-by-step guides
│   ├── getting-started/ # Basic setup and usage
│   ├── optimization/    # Advanced optimization techniques
│   ├── performance/     # Performance optimization guides
│   └── migration/       # Migration from other tools
├── use-cases/          # Real-world scenarios
│   ├── enterprise/     # Enterprise setups
│   ├── monorepo/       # Monorepo configurations
│   ├── micro-frontend/ # Micro-frontend architectures
│   └── component-lib/  # Component library optimization
└── tools/              # Utility scripts and helpers
    ├── scripts/        # Automation scripts
    ├── configs/        # Reusable configurations
    └── benchmarks/     # Performance benchmarks
```

## 🚀 Quick Start Examples

### 1. Basic React Application

The simplest way to get started with tw-enigma in a React application:

```bash
cd examples/frameworks/react/basic
npm install
npm run dev
```

**What you'll learn:**

- Basic tw-enigma configuration
- Vite integration setup
- CSS optimization in development
- Production build optimization

### 2. Advanced Optimization

Explore advanced optimization techniques:

```bash
cd examples/tutorials/optimization/advanced
npm install
npm run analyze
```

**What you'll learn:**

- Pattern analysis and frequency detection
- Multiple optimization strategies
- Bundle size analysis
- Performance metrics

### 3. Enterprise Setup

See how tw-enigma works in enterprise environments:

```bash
cd examples/use-cases/enterprise/full-stack
npm install
npm run build:all
```

**What you'll learn:**

- Monorepo configuration
- Multi-environment setup
- CI/CD integration
- Security and compliance

## 📚 Framework Examples

### React Examples

| Example                                                      | Description                    | Complexity   | Features                             |
| ------------------------------------------------------------ | ------------------------------ | ------------ | ------------------------------------ |
| [Basic React](./frameworks/react/basic/)                     | Simple Create React App setup  | Beginner     | Vite, basic optimization             |
| [React TypeScript](./frameworks/react/typescript/)           | TypeScript React application   | Intermediate | Type-safe configs, advanced analysis |
| [React Component Library](./frameworks/react/component-lib/) | Component library optimization | Advanced     | Tree-shaking, bundle analysis        |

### Vue Examples

| Example                                            | Description                 | Complexity   | Features                           |
| -------------------------------------------------- | --------------------------- | ------------ | ---------------------------------- |
| [Vue 3 Composition](./frameworks/vue/composition/) | Vue 3 with Composition API  | Beginner     | Vite, SFC optimization             |
| [Vue with Nuxt](./frameworks/vue/nuxt/)            | Nuxt.js application         | Intermediate | SSR, universal optimization        |
| [Vue Enterprise](./frameworks/vue/enterprise/)     | Large-scale Vue application | Advanced     | Module federation, micro-frontends |

### Angular Examples

| Example                                                | Description                | Complexity   | Features                         |
| ------------------------------------------------------ | -------------------------- | ------------ | -------------------------------- |
| [Angular Basic](./frameworks/angular/basic/)           | Standard Angular CLI setup | Beginner     | Angular CLI, Webpack integration |
| [Angular Standalone](./frameworks/angular/standalone/) | Standalone components      | Intermediate | Tree-shakable components         |
| [Angular Universal](./frameworks/angular/universal/)   | SSR with Angular Universal | Advanced     | Server-side optimization         |

### Next.js Examples

| Example                                             | Description              | Complexity   | Features                           |
| --------------------------------------------------- | ------------------------ | ------------ | ---------------------------------- |
| [Next.js App Router](./frameworks/next/app-router/) | Next.js 13+ App Router   | Intermediate | RSC, streaming, edge optimization  |
| [Next.js Pages](./frameworks/next/pages/)           | Traditional Pages Router | Beginner     | SSG, ISR, API routes               |
| [Next.js Enterprise](./frameworks/next/enterprise/) | Production-ready setup   | Advanced     | Turborepo, deployment optimization |

## 🔧 Build Tool Examples

### Vite Integration

| Example                                         | Description                     | Use Case                |
| ----------------------------------------------- | ------------------------------- | ----------------------- |
| [Basic Plugin](./build-tools/vite/basic/)       | Simple Vite plugin setup        | Development builds      |
| [Advanced Config](./build-tools/vite/advanced/) | Complex optimization strategies | Production optimization |
| [Monorepo Setup](./build-tools/vite/monorepo/)  | Multi-package configuration     | Shared libraries        |

### Webpack Integration

| Example                                                        | Description                 | Use Case                 |
| -------------------------------------------------------------- | --------------------------- | ------------------------ |
| [Webpack Plugin](./build-tools/webpack/plugin/)                | Custom webpack plugin       | Legacy projects          |
| [Module Federation](./build-tools/webpack/module-federation/)  | Micro-frontend setup        | Distributed architecture |
| [Performance Optimization](./build-tools/webpack/performance/) | Bundle splitting strategies | Large applications       |

### PostCSS Integration

| Example                                           | Description              | Use Case                   |
| ------------------------------------------------- | ------------------------ | -------------------------- |
| [PostCSS Plugin](./build-tools/postcss/plugin/)   | Standalone PostCSS usage | Build pipeline integration |
| [Custom Processor](./build-tools/postcss/custom/) | Custom CSS processing    | Specialized workflows      |

## 📖 Tutorial Series

### Getting Started Series

1. **[Installation & Setup](./tutorials/getting-started/01-installation.md)**

   - Package installation
   - Basic configuration
   - First optimization

2. **[Configuration Deep Dive](./tutorials/getting-started/02-configuration.md)**

   - Configuration file structure
   - Environment-specific settings
   - Advanced options

3. **[Integration Patterns](./tutorials/getting-started/03-integration.md)**
   - Build tool integration
   - Framework-specific setup
   - Common pitfalls

### Optimization Series

1. **[Analysis & Profiling](./tutorials/optimization/01-analysis.md)**

   - Pattern detection
   - Frequency analysis
   - Performance profiling

2. **[Optimization Strategies](./tutorials/optimization/02-strategies.md)**

   - Atomic optimization
   - Chunked optimization
   - Hybrid approaches

3. **[Bundle Analysis](./tutorials/optimization/03-bundle-analysis.md)**
   - Size reduction measurement
   - Load time optimization
   - Runtime performance

### Performance Series

1. **[Development Performance](./tutorials/performance/01-development.md)**

   - Fast rebuilds
   - Watch mode optimization
   - Memory management

2. **[Production Optimization](./tutorials/performance/02-production.md)**

   - Advanced compression
   - CDN optimization
   - Caching strategies

3. **[Monitoring & Analytics](./tutorials/performance/03-monitoring.md)**
   - Performance metrics
   - Real-user monitoring
   - Continuous optimization

## 🏢 Real-World Use Cases

### Enterprise Examples

| Use Case                                                 | Description                   | Key Features                          |
| -------------------------------------------------------- | ----------------------------- | ------------------------------------- |
| [E-commerce Platform](./use-cases/enterprise/ecommerce/) | Large-scale e-commerce site   | Multi-tenant, internationalization    |
| [SaaS Dashboard](./use-cases/enterprise/saas/)           | Complex dashboard application | Real-time updates, data visualization |
| [Corporate Website](./use-cases/enterprise/corporate/)   | Marketing and content site    | SEO optimization, accessibility       |

### Monorepo Examples

| Example                                             | Description              | Tools                         |
| --------------------------------------------------- | ------------------------ | ----------------------------- |
| [Nx Monorepo](./use-cases/monorepo/nx/)             | Nx workspace setup       | Nx, shared libraries          |
| [Lerna Setup](./use-cases/monorepo/lerna/)          | Lerna package management | Lerna, independent versioning |
| [Turborepo Config](./use-cases/monorepo/turborepo/) | Turborepo optimization   | Turborepo, task caching       |

### Component Library Examples

| Example                                                   | Description            | Publishing                    |
| --------------------------------------------------------- | ---------------------- | ----------------------------- |
| [Design System](./use-cases/component-lib/design-system/) | Complete design system | npm, documentation site       |
| [UI Kit](./use-cases/component-lib/ui-kit/)               | Reusable UI components | Storybook, visual testing     |
| [Icon Library](./use-cases/component-lib/icons/)          | SVG icon optimization  | Tree-shaking, bundle analysis |

## 🛠️ Development Tools

### Scripts

| Script                                                 | Purpose                      | Usage                             |
| ------------------------------------------------------ | ---------------------------- | --------------------------------- |
| [Benchmark Runner](./tools/scripts/benchmark.js)       | Performance benchmarking     | `node benchmark.js`               |
| [Config Generator](./tools/scripts/generate-config.js) | Auto-generate configurations | `node generate-config.js`         |
| [Migration Helper](./tools/scripts/migrate.js)         | Migrate from other tools     | `node migrate.js --from=tailwind` |

### Configurations

| Config                                               | Description                     | Use Case                        |
| ---------------------------------------------------- | ------------------------------- | ------------------------------- |
| [Base Config](./tools/configs/base.js)               | Standard configuration template | Starting point for new projects |
| [Enterprise Config](./tools/configs/enterprise.js)   | Enterprise-grade setup          | Large organizations             |
| [Performance Config](./tools/configs/performance.js) | Performance-optimized settings  | High-traffic applications       |

### Benchmarks

| Benchmark                                          | Measures            | Comparison                   |
| -------------------------------------------------- | ------------------- | ---------------------------- |
| [Build Speed](./tools/benchmarks/build-speed/)     | Compilation time    | vs. native Tailwind CSS      |
| [Bundle Size](./tools/benchmarks/bundle-size/)     | Output file sizes   | vs. other optimization tools |
| [Runtime Performance](./tools/benchmarks/runtime/) | Browser performance | vs. unoptimized CSS          |

## 🧪 Testing Examples

All examples include comprehensive tests to ensure they work correctly and demonstrate best practices:

```bash
# Test all examples
npm run test:examples

# Test specific framework
npm run test:react

# Test specific use case
npm run test:enterprise

# Run performance benchmarks
npm run benchmark:all
```

### Test Categories

- **Unit Tests**: Individual component testing
- **Integration Tests**: Build tool integration testing
- **E2E Tests**: Complete workflow testing
- **Performance Tests**: Optimization effectiveness testing
- **Visual Tests**: UI component visual regression testing

## 📊 Performance Metrics

Each example includes performance metrics to demonstrate optimization effectiveness:

### Before/After Comparisons

| Metric              | Before tw-enigma | After tw-enigma | Improvement   |
| ------------------- | ---------------- | --------------- | ------------- |
| Bundle Size         | 2.1 MB           | 450 KB          | 78% reduction |
| Load Time           | 3.2s             | 1.1s            | 66% faster    |
| Runtime Performance | 45 FPS           | 60 FPS          | 33% smoother  |
| Build Time          | 45s              | 12s             | 73% faster    |

_Metrics vary by project size and complexity. See individual examples for specific measurements._

## 🤝 Contributing Examples

Want to contribute a new example or improve an existing one?

1. **Check the [Contributing Guide](../CONTRIBUTING.md)**
2. **Follow the [Example Template](./tools/templates/example-template/)**
3. **Include comprehensive documentation**
4. **Add appropriate tests**
5. **Submit a pull request**

### Example Template Structure

```
example-name/
├── README.md              # Detailed setup instructions
├── package.json           # Dependencies and scripts
├── tw-enigma.config.js    # Configuration file
├── src/                   # Source code
├── tests/                 # Test files
├── docs/                  # Additional documentation
└── benchmarks/            # Performance measurements
```

## 📖 Documentation

- **[Getting Started Guide](../README.md##quick-start)**
- **[Contributing Guidelines](../CONTRIBUTING.md)**

## 🆘 Getting Help

- **[GitHub Issues](https://github.com/avocardow/tw-enigma/issues)** - Bug reports and feature requests
- **[GitHub Discussions](https://github.com/avocardow/tw-enigma/discussions)** - Questions and community support

## 📄 License

All examples are provided under the [MIT License](../LICENSE). Feel free to use them as starting points for your own projects.
