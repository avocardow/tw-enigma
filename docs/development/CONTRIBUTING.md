# Contributing to tw-enigma

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![GitHub Issues](https://img.shields.io/github/issues/avocardow/tw-enigma.svg)](https://github.com/avocardow/tw-enigma/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

Thank you for your interest in contributing to tw-enigma! This document provides comprehensive guidelines for contributing to our CSS optimization toolkit. We welcome contributions from developers of all skill levels.

## 🎯 Quick Start for Contributors

1. **🍴 Fork the repository** on GitHub
2. **📥 Clone your fork** locally
3. **🔧 Set up the development environment**
4. **🌿 Create a feature branch**
5. **💻 Make your changes**
6. **🧪 Test your changes**
7. **📤 Submit a pull request**

Detailed instructions for each step are provided below.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Documentation](#documentation)
- [Release Process](#release-process)
- [Community Guidelines](#community-guidelines)
- [Getting Help](#getting-help)

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@tw-enigma.dev](mailto:conduct@tw-enigma.dev).

## 🤝 Ways to Contribute

### 🐛 Bug Reports

Help us improve by reporting bugs:

- **Search existing issues** first to avoid duplicates
- **Use the bug report template** when creating new issues
- **Provide detailed reproduction steps**
- **Include environment information** (Node.js version, OS, etc.)
- **Share minimal code examples** that demonstrate the issue

### 💡 Feature Requests

Suggest new features or improvements:

- **Check the roadmap** to see if it's already planned
- **Use the feature request template**
- **Explain the use case** and why it would be valuable
- **Consider implementation complexity** and breaking changes
- **Propose API design** if applicable

### 📝 Documentation

Improve our documentation:

- **Fix typos and grammar errors**
- **Add missing documentation**
- **Improve clarity and examples**
- **Translate documentation** (contact us first)
- **Create tutorials and guides**

### 🔧 Code Contributions

Contribute code improvements:

- **Core optimization algorithms**
- **Build tool integrations**
- **CLI commands and features**
- **Performance optimizations**
- **Framework-specific adapters**
- **Testing utilities**

### 🧪 Testing

Help improve our test coverage:

- **Add unit tests** for existing features
- **Create integration tests** for build tool plugins
- **Develop performance benchmarks**
- **Test on different platforms** and environments
- **Report and fix test failures**

## 🛠️ Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 7.0.0 (recommended package manager)
- **Git** >= 2.0.0

### Initial Setup

1. **Fork and clone the repository:**

   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/tw-enigma.git
   cd tw-enigma

   # Add upstream remote
   git remote add upstream https://github.com/avocardow/tw-enigma.git
   ```

2. **Install dependencies:**

   ```bash
   # Install all dependencies for the monorepo
   pnpm install
   ```

3. **Build all packages:**

   ```bash
   # Build all packages
   pnpm build

   # Or build specific packages
   pnpm --filter @tw-enigma/core build
   pnpm --filter @tw-enigma/cli build
   ```

4. **Run tests to verify setup:**

   ```bash
   # Run all tests
   pnpm test

   # Run tests for specific package
   pnpm --filter @tw-enigma/core test
   ```

5. **Start development mode:**

   ```bash
   # Watch mode for all packages
   pnpm dev

   # Watch mode for specific package
   pnpm --filter @tw-enigma/core dev
   ```

### Development Environment

#### Recommended VSCode Extensions

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "vitest.explorer",
    "ms-vscode.vscode-json"
  ]
}
```

#### Environment Variables

Create a `.env.local` file for development:

```bash
# Debug mode
ENIGMA_DEBUG=true

# Log level
ENIGMA_LOG_LEVEL=debug

# Test configuration
NODE_ENV=development
```

## 🏗️ Project Structure

```
tw-enigma/
├── packages/
│   ├── core/                 # Core optimization engine
│   │   ├── src/
│   │   │   ├── analyzer/     # Pattern analysis
│   │   │   ├── generator/    # CSS generation
│   │   │   ├── optimizer/    # Optimization algorithms
│   │   │   ├── plugins/      # Build tool plugins
│   │   │   └── utils/        # Shared utilities
│   │   ├── tests/           # Package tests
│   │   └── package.json
│   └── cli/                  # Command-line interface
│       ├── src/
│       │   ├── commands/     # CLI commands
│       │   ├── config/       # Configuration management
│       │   └── utils/        # CLI utilities
│       ├── bin/             # Executable files
│       ├── tests/           # Package tests
│       └── package.json
├── docs/                     # Documentation
├── examples/                 # Usage examples
├── .github/                  # GitHub workflows and templates
├── .changeset/              # Changeset configuration
├── scripts/                 # Build and utility scripts
└── turbo.json               # Turborepo configuration
```

### Package Architecture

#### Core Package (`@tw-enigma/core`)

- **Analyzer**: Pattern detection and frequency analysis
- **Generator**: CSS generation with multiple strategies
- **Optimizer**: Optimization algorithms and rule engines
- **Plugins**: Build tool integrations (Vite, Webpack, PostCSS)
- **Utils**: Shared utilities and helper functions

#### CLI Package (`@tw-enigma/cli`)

- **Commands**: Individual CLI command implementations
- **Config**: Configuration file management
- **Utils**: CLI-specific utilities and helpers

## 🔄 Development Workflow

### Branch Strategy

We use a feature branch workflow:

```bash
# Create feature branch from main
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature"

# Push to your fork
git push origin feature/your-feature-name

# Create pull request on GitHub
```

### Branch Naming

Use descriptive branch names with prefixes:

- **Features**: `feature/add-vue-plugin`
- **Bug fixes**: `fix/memory-leak-in-analyzer`
- **Documentation**: `docs/update-contributing-guide`
- **Refactoring**: `refactor/optimizer-architecture`
- **Performance**: `perf/improve-pattern-matching`
- **Tests**: `test/add-integration-tests`

### Commit Messages

We follow [Conventional Commits](https://conventionalcommits.org/):

```bash
# Format
type(scope): description

# Examples
feat(core): add Vue.js framework support
fix(cli): resolve memory leak in watch mode
docs(readme): update installation instructions
test(analyzer): add unit tests for pattern detection
perf(optimizer): improve CSS generation speed by 40%
refactor(generator): simplify atomic class naming
```

#### Commit Types

- **feat**: New features
- **fix**: Bug fixes
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **ci**: CI/CD changes
- **revert**: Reverting previous commits

### Syncing with Upstream

Keep your fork up to date:

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream main into your main
git checkout main
git merge upstream/main
git push origin main

# Rebase your feature branch on latest main
git checkout feature/your-feature-name
git rebase main
```

## 📏 Coding Standards

### TypeScript Guidelines

```typescript
// ✅ Good: Use explicit types
interface OptimizationConfig {
  strategy: 'atomic' | 'chunked' | 'hybrid';
  threshold: number;
  minify: boolean;
}

// ✅ Good: Use descriptive names
function analyzePatternFrequency(patterns: Pattern[]): FrequencyMap {
  // Implementation
}

// ❌ Avoid: Implicit any types
function processData(data: any): any {
  // Avoid this
}

// ✅ Good: Use proper error handling
try {
  const result = await processFile(filePath);
  return result;
} catch (error) {
  logger.error('Failed to process file', { filePath, error });
  throw new ProcessingError('File processing failed', { cause: error });
}
```

### ESLint Configuration

We use ESLint 9.x with TypeScript support:

```bash
# Lint all packages
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix

# Lint specific package
pnpm --filter @tw-enigma/core lint
```

### Prettier Configuration

Code formatting is handled by Prettier:

```bash
# Format all files
pnpm format

# Check formatting
pnpm format:check
```

### Code Structure Guidelines

#### File Organization

```typescript
// File header with description
/**
 * Pattern analyzer for detecting Tailwind CSS usage patterns
 * @author tw-enigma team
 * @since 1.0.0
 */

// Imports (external libraries first, then internal)
import { readFile } from 'fs/promises';
import { glob } from 'glob';

import { Logger } from '../utils/logger';
import { PatternCache } from './cache';

// Types and interfaces
interface AnalyzerOptions {
  threshold: number;
  includeVariants: boolean;
}

// Constants
const DEFAULT_THRESHOLD = 2;
const PATTERN_REGEX = /class[Name]*=['"`]([^'"`]+)['"`]/g;

// Main class/function implementation
export class PatternAnalyzer {
  // Implementation
}
```

#### Error Handling

```typescript
// ✅ Good: Custom error classes
export class OptimizationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OptimizationError';
  }
}

// ✅ Good: Proper error context
async function analyzeFile(filePath: string): Promise<Pattern[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return extractPatterns(content);
  } catch (error) {
    throw new OptimizationError(`Failed to analyze file: ${filePath}`, 'FILE_ANALYSIS_FAILED', {
      filePath,
      originalError: error,
    });
  }
}
```

#### Logging

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('PatternAnalyzer');

export class PatternAnalyzer {
  async analyze(): Promise<void> {
    logger.info('Starting pattern analysis', { fileCount: this.files.length });

    try {
      const patterns = await this.extractPatterns();
      logger.debug('Patterns extracted', { patternCount: patterns.length });
    } catch (error) {
      logger.error('Pattern analysis failed', { error });
      throw error;
    }
  }
}
```

## 🧪 Testing Guidelines

### Test Structure

We use Vitest for testing with comprehensive coverage requirements:

```typescript
// test-utils.ts - Shared test utilities
export function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    strategy: 'atomic',
    threshold: 2,
    minify: false,
    ...overrides,
  };
}

// analyzer.test.ts - Unit tests
describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = createMockConfig();
    analyzer = new PatternAnalyzer(mockConfig);
  });

  describe('analyze()', () => {
    it('should extract patterns from HTML files', async () => {
      const mockHtml = '<div class="flex items-center justify-center"></div>';
      const patterns = await analyzer.analyze([mockHtml]);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].classes).toEqual(['flex', 'items-center', 'justify-center']);
    });

    it('should handle empty files gracefully', async () => {
      const patterns = await analyzer.analyze(['']);
      expect(patterns).toHaveLength(0);
    });

    it('should throw error for invalid input', async () => {
      await expect(analyzer.analyze(null as any)).rejects.toThrow(OptimizationError);
    });
  });
});
```

### Test Categories

#### Unit Tests

Test individual functions and classes in isolation:

```bash
# Run unit tests
pnpm test:unit

# Run with coverage
pnpm test:unit --coverage

# Watch mode
pnpm test:unit --watch
```

#### Integration Tests

Test package interactions and build tool plugins:

```bash
# Run integration tests
pnpm test:integration

# Test specific integration
pnpm test:integration --grep "Vite plugin"
```

#### End-to-End Tests

Test complete workflows and CLI commands:

```bash
# Run E2E tests
pnpm test:e2e

# Test CLI commands
pnpm test:e2e --grep "CLI"
```

### Performance Tests

Benchmark critical operations:

```typescript
// performance.test.ts
import { performance } from 'perf_hooks';

describe('Performance', () => {
  it('should analyze 1000 patterns in under 100ms', async () => {
    const patterns = generateMockPatterns(1000);

    const start = performance.now();
    await analyzer.analyze(patterns);
    const end = performance.now();

    expect(end - start).toBeLessThan(100);
  });
});
```

### Coverage Requirements

- **Overall coverage**: >= 80%
- **Core package**: >= 85%
- **Critical paths**: >= 95%
- **New features**: >= 90%

```bash
# Generate coverage report
pnpm test:coverage

# View coverage report
open coverage/index.html
```

## 🔄 Pull Request Process

### Before Submitting

1. **📝 Update documentation** if needed
2. **🧪 Add tests** for new functionality
3. **🔍 Run linting and formatting** (`pnpm lint && pnpm format`)
4. **✅ Ensure all tests pass** (`pnpm test`)
5. **📊 Check test coverage** meets requirements
6. **📋 Update CHANGELOG.md** if needed

### Pull Request Template

When creating a PR, please include:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 💥 Breaking change
- [ ] 📝 Documentation update
- [ ] 🎨 Style/formatting
- [ ] ♻️ Refactoring
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test changes

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added for new functionality
- [ ] All tests pass
- [ ] No breaking changes (or properly documented)
```

### Review Process

1. **🤖 Automated checks** must pass (CI, linting, tests)
2. **👥 Code review** by at least one maintainer
3. **✅ All feedback addressed**
4. **🔀 Merge** when approved

### Merge Strategy

- **Squash and merge** for feature branches
- **Rebase and merge** for hotfixes
- **Merge commit** for release branches

## 🐛 Issue Guidelines

### Bug Reports

Use the bug report template and include:

- **Environment details** (Node.js version, OS, package versions)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Minimal code example** that demonstrates the bug
- **Error messages and stack traces**
- **Screenshots** if applicable

### Feature Requests

Use the feature request template and include:

- **Problem statement** - what problem does this solve?
- **Proposed solution** - how should it work?
- **Alternatives considered** - other approaches you've thought of
- **Use cases** - specific scenarios where this would be helpful
- **Implementation ideas** - if you have technical suggestions

### Issue Labels

We use labels to categorize issues:

- **Type**: `bug`, `feature`, `documentation`, `question`
- **Priority**: `critical`, `high`, `medium`, `low`
- **Complexity**: `trivial`, `easy`, `medium`, `hard`
- **Package**: `core`, `cli`, `docs`
- **Status**: `needs-triage`, `in-progress`, `blocked`, `needs-review`

## 📚 Documentation

### Documentation Types

- **API Documentation**: Generated from TSDoc comments
- **User Guides**: Step-by-step instructions
- **Tutorials**: Learning-oriented content
- **Reference**: Information-oriented content

### Writing Guidelines

#### API Documentation

Use TSDoc comments for all public APIs:

````typescript
/**
 * Analyzes Tailwind CSS usage patterns in the provided files
 *
 * @param files - Array of file paths or content to analyze
 * @param options - Configuration options for analysis
 * @returns Promise resolving to array of detected patterns
 *
 * @example
 * ```typescript
 * const analyzer = new PatternAnalyzer();
 * const patterns = await analyzer.analyze(['src/**\/*.tsx'], {
 *   threshold: 3,
 *   includeVariants: true
 * });
 * ```
 *
 * @throws {OptimizationError} When file analysis fails
 * @since 1.0.0
 */
async analyze(
  files: string[],
  options: AnalyzerOptions = {}
): Promise<Pattern[]>
````

#### User Documentation

- **Use clear, concise language**
- **Include working code examples**
- **Provide context and rationale**
- **Use consistent formatting**
- **Test all examples**

### Documentation Commands

```bash
# Generate API documentation
pnpm docs:api

# Build documentation site
pnpm docs:build

# Serve documentation locally
pnpm docs:serve

# Lint documentation
pnpm docs:lint
```

## 🚀 Release Process

### Changesets

We use changesets for version management:

```bash
# Add a changeset
pnpm changeset

# Version packages
pnpm changeset version

# Publish packages
pnpm changeset publish
```

### Release Types

- **Patch** (1.0.1): Bug fixes, documentation updates
- **Minor** (1.1.0): New features, non-breaking changes
- **Major** (2.0.0): Breaking changes

### Release Checklist

1. **📝 Update documentation**
2. **🧪 All tests passing**
3. **📋 Update CHANGELOG.md**
4. **🏷️ Create changeset**
5. **🔖 Tag release**
6. **📦 Publish to npm**
7. **📢 Announce release**

## 👥 Community Guidelines

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: General questions, ideas
- **Discord**: Real-time chat (coming soon)
- **Twitter**: [@tw_enigma](https://twitter.com/tw_enigma) - announcements

### Community Standards

- **Be respectful** and inclusive
- **Help others** learn and grow
- **Share knowledge** and experiences
- **Provide constructive feedback**
- **Follow the code of conduct**

### Recognition

We recognize contributors through:

- **All Contributors** specification
- **Contributor highlights** in releases
- **Special thanks** in documentation
- **Maintainer invitations** for consistent contributors

## 🆘 Getting Help

### Before Asking for Help

1. **📖 Check the documentation**
2. **🔍 Search existing issues**
3. **💬 Look through discussions**
4. **🧪 Try the examples**

### How to Ask for Help

When asking for help:

- **Be specific** about the problem
- **Include relevant code** and configuration
- **Describe what you've tried**
- **Provide environment details**
- **Use proper formatting** for code blocks

### Response Expectations

- **Issues**: Response within 2-3 business days
- **Pull requests**: Review within 1 week
- **Discussions**: Community-driven, varies
- **Security issues**: Response within 24 hours

## 🏆 Recognition

### Contributors

All contributors are recognized in our [All Contributors](https://allcontributors.org/) section. Contributions of all kinds are welcome and acknowledged.

### Maintainers

Current maintainers:

- **[@maintainer1](https://github.com/maintainer1)** - Core development
- **[@maintainer2](https://github.com/maintainer2)** - CLI and tooling
- **[@maintainer3](https://github.com/maintainer3)** - Documentation

## 📄 License

By contributing to tw-enigma, you agree that your contributions will be licensed under the [MIT License](LICENSE).
