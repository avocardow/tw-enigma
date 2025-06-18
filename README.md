# Tailwind Enigma

[![CI](https://github.com/avocardow/tw-enigma/actions/workflows/ci.yml/badge.svg)](https://github.com/avocardow/tw-enigma/actions/workflows/ci.yml)
[![Release](https://github.com/avocardow/tw-enigma/actions/workflows/release.yml/badge.svg)](https://github.com/avocardow/tw-enigma/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-1779%20passing-brightgreen.svg)](#)

**Dramatically shrink your HTML and JavaScript bundle sizes by replacing repetitive Tailwind class patterns with short, optimized class names.**

---

### What does this do? 🤔

**Simple answer:** Your HTML and JavaScript files are full of repetitive Tailwind class combinations like `"flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded"`. This tool finds those patterns and replaces them with tiny class names like `"ab"` while generating the CSS to make it work.

**Before Tailwind Enigma:**

```html
<!-- This pattern repeats 50 times in your app -->
<div class="flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded">Button</div>
<div class="flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded">
  Another Button
</div>
<div class="flex items-center justify-center text-white bg-blue-500 px-4 py-2 rounded">
  Yet Another
</div>

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
npm install @tw-enigma/cli

# 2. Initialize configuration
npx enigma init

# 3. Analyze your project
npx enigma analyze

# 4. Generate optimized CSS
npx enigma generate

# Done! Your project now uses optimized atomic CSS
```

**What just happened?**

1. 🔍 **Scanned your files** - Found every Tailwind class combination
2. 📊 **Counted patterns** - Identified which combinations appear most often
3. ✂️ **Generated atomic CSS** - Created optimized classes based on usage patterns
4. 🎯 **Optimized your build** - Reduced CSS bundle size dramatically
5. 🚀 **Smaller bundles** - Your users download way less code!

---

### 📦 Packages

This monorepo contains the following packages:

| Package                              | Version                                                          | Description                                                       |
| ------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`@tw-enigma/core`](./packages/core) | ![npm version](https://img.shields.io/npm/v/@tw-enigma/core.svg) | Core CSS optimization engine with pattern analysis and generation |
| [`@tw-enigma/cli`](./packages/cli)   | ![npm version](https://img.shields.io/npm/v/@tw-enigma/cli.svg)  | Command-line interface for tw-enigma operations                   |

### 🔧 Core Package

The heart of the optimization engine, providing:

- CSS pattern analysis and frequency detection
- Atomic class generation with semantic naming
- Build tool plugins (Vite, Webpack, PostCSS)
- Development tools and debugging utilities
- Performance monitoring and optimization metrics

### 💻 CLI Package

Command-line tools for:

- Project analysis and optimization
- Configuration management
- Performance benchmarking
- Development workflow integration

---

### 🏗️ Development

#### Monorepo Structure

```
tw-enigma/
├── packages/
│   ├── core/                 # Core optimization engine
│   │   ├── src/
│   │   ├── dist/
│   │   └── package.json
│   └── cli/                  # Command-line interface
│       ├── src/
│       ├── bin/
│       └── package.json
├── docs/                     # Documentation
├── examples/                 # Usage examples
├── .github/                  # GitHub Actions workflows
├── .changeset/              # Changeset configuration
└── turbo.json               # Turborepo configuration
```

#### Setup Development Environment

1. **Clone the repository:**

   ```bash
   git clone https://github.com/avocardow/tw-enigma.git
   cd tw-enigma
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Build all packages:**

   ```bash
   pnpm build
   ```

4. **Run tests:**
   ```bash
   pnpm test
   ```

#### Development Workflow

##### Working with Specific Packages

```bash
# Start development mode for core package
pnpm --filter @tw-enigma/core dev

# Run tests for CLI package
pnpm --filter @tw-enigma/cli test

# Build only the core package
pnpm --filter @tw-enigma/core build
```

##### Running Common Tasks

```bash
# Lint all packages
pnpm lint

# Type check all packages
pnpm type-check

# Run all tests
pnpm test

# Clean all build artifacts
pnpm clean
```

##### Using Turbo for Efficient Builds

This project uses [Turborepo](https://turbo.build/) for intelligent task execution:

```bash
# Build with caching
pnpm turbo build

# Run tests with parallelization
pnpm turbo test

# Clear Turbo cache
pnpm turbo prune
```

#### Code Quality

We maintain high code quality standards through:

- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety
- **Vitest** for comprehensive testing
- **Changesets** for version management

---

### 📚 Documentation

#### Developer Documentation

- [Contributing Guidelines](./CONTRIBUTING.md)
- [Architecture Overview](./docs/architecture.md)

---

### 🤝 Contributing

We welcome contributions from the community! Here's how to get started:

1. **Read our [Contributing Guidelines](./CONTRIBUTING.md)**
2. **Check out [good first issues](https://github.com/avocardow/tw-enigma/labels/good%20first%20issue)**
3. **Join our [Discord community](https://discord.gg/tw-enigma)** (placeholder)

#### Development Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for your changes
5. Run the test suite: `pnpm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to your branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

---

### 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
