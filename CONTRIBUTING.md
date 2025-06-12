# Contributing to Tailwind Enigma Core

Thank you for your interest in contributing to Tailwind Enigma Core! This document provides comprehensive guidelines for contributors to help you get started and ensure your contributions align with the project's standards.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Code Review Guidelines](#code-review-guidelines)
- [Release Process](#release-process)
- [Community Guidelines](#community-guidelines)

## 🎯 Project Overview

**Tailwind Enigma Core** is an intelligent CSS optimization engine that automatically detects, extracts, and optimizes Tailwind CSS classes from various file formats and frameworks to dramatically reduce bundle sizes while maintaining functionality.

### Mission

- Provide the most efficient CSS optimization for Tailwind CSS projects
- Maintain zero-configuration usability while offering extensive customization
- Support all major frameworks and file formats out of the box
- Deliver measurable performance improvements in production environments

### Key Technologies

- **TypeScript** (primary language with strict type checking)
- **Node.js 18+** (runtime environment)
- **Vitest** (testing framework)
- **ESLint 9.x** (linting with flat config)
- **Prettier** (code formatting)
- **Changesets** (release management)
- **PostCSS** (CSS processing)
- **pnpm** (package manager)

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have the following installed:

- **Node.js** >= 18.0.0 (LTS recommended)
- **pnpm** >= 8.0.0 (preferred package manager)
- **Git** >= 2.20.0
- A modern code editor (VS Code recommended with TypeScript support)

### Installation

1. **Fork and Clone the Repository**

   ```bash
   git clone https://github.com/your-username/tw-enigma.git
   cd tw-enigma
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Verify Setup**

   ```bash
   pnpm test
   pnpm build
   pnpm type-check
   ```

4. **Run Development Commands**

   ```bash
   # Start development mode with watch
   pnpm dev

   # Run tests in watch mode
   pnpm test:watch

   # Run linting
   pnpm lint
   ```

## 🏗️ Development Environment Setup

### Environment Configuration

1. **Environment Variables**

   - No environment variables are required for basic development
   - For AI-powered features, set `ANTHROPIC_API_KEY` in a `.env` file
   - See [Environment Variables](#environment-variables) section for details

2. **Editor Configuration**

   - Install TypeScript and ESLint extensions
   - Enable format-on-save with Prettier
   - Configure TypeScript strict mode support

3. **Git Hooks**
   - Pre-commit hooks automatically run ESLint and Prettier
   - Commit message validation enforces conventional commit format

### Available Scripts

| Command              | Description                               |
| -------------------- | ----------------------------------------- |
| `pnpm dev`           | Start development mode with file watching |
| `pnpm build`         | Build the project for production          |
| `pnpm test`          | Run all tests once                        |
| `pnpm test:watch`    | Run tests in watch mode                   |
| `pnpm test:ui`       | Open Vitest UI for interactive testing    |
| `pnpm test:coverage` | Run tests with coverage reporting         |
| `pnpm type-check`    | Run TypeScript type checking              |
| `pnpm lint`          | Run ESLint linting                        |
| `pnpm lint:fix`      | Run ESLint with automatic fixes           |
| `pnpm format`        | Format code with Prettier                 |
| `pnpm format:check`  | Check code formatting                     |
| `pnpm changeset`     | Create a new changeset for releases       |

### Troubleshooting Common Issues

**Node.js Version Issues**

```bash
# Check your Node.js version
node --version

# If using nvm, install and use Node 18+
nvm install 18
nvm use 18
```

**pnpm Installation Issues**

```bash
# Install pnpm globally
npm install -g pnpm

# Or use corepack (Node.js 16+)
corepack enable
corepack prepare pnpm@latest --activate
```

**TypeScript Errors**

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
pnpm install

# Run type checking explicitly
pnpm type-check
```

## 📁 Project Structure

```
tw-enigma/
├── bin/                    # CLI entry points
├── src/                    # Source code
│   ├── core/              # Core optimization engines
│   │   ├── plugins/       # Built-in optimization plugins
│   │   └── pluginManager.ts
│   ├── detectors/         # File format detectors
│   ├── integrations/      # Framework integrations
│   ├── output/            # Output optimization system
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Shared utilities
├── tests/                 # Test files
│   ├── fixtures/          # Test data and mock files
│   ├── integration/       # Integration tests
│   └── unit/              # Unit tests
├── tasks/                 # Task management (development)
├── scripts/               # Development and build scripts
└── docs/                  # Documentation
```

### Key Modules

- **Core Engines** (`src/core/`): CSS optimization and processing logic
- **File Processing** (`src/detectors/`, `src/utils/`): File discovery and parsing
- **Framework Integration** (`src/integrations/`): Framework-specific optimizations
- **Output System** (`src/output/`): CSS bundling, chunking, and performance optimization
- **Plugin System** (`src/core/plugins/`): Extensible optimization plugins

## 🔄 Development Workflow

### Branch Strategy

1. **Main Branch** (`main`): Production-ready code
2. **Feature Branches** (`feature/description`): New features and enhancements
3. **Bugfix Branches** (`fix/description`): Bug fixes
4. **Documentation Branches** (`docs/description`): Documentation updates

### Workflow Steps

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**

   - Follow coding standards
   - Write comprehensive tests
   - Update documentation as needed

3. **Test Thoroughly**

   ```bash
   pnpm test
   pnpm type-check
   pnpm lint
   ```

4. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat: add new optimization algorithm"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Coding Standards

### TypeScript Guidelines

- **Strict Mode**: All code must pass TypeScript strict mode checking
- **Type Safety**: Prefer explicit types over `any`
- **Interfaces**: Use interfaces for object shapes, types for unions/primitives
- **Null Safety**: Handle null/undefined cases explicitly

```typescript
// ✅ Good
interface OptimizationResult {
  readonly sizeSavings: number;
  readonly optimizedClasses: string[];
  readonly errors?: string[];
}

// ❌ Avoid
const result: any = optimize();
```

### Code Style

- **ESLint 9.x**: All code must pass ESLint with flat config
- **Prettier**: Automatic formatting enforced
- **Naming Conventions**:
  - Variables/Functions: `camelCase`
  - Classes/Interfaces: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case` or `camelCase`

```typescript
// ✅ Good naming
class CssOptimizer {
  private readonly MAX_CHUNK_SIZE = 50 * 1024;

  public optimizeCss(input: CssInput): OptimizationResult {
    const processedClasses = this.processClasses(input);
    return this.generateResult(processedClasses);
  }
}
```

### Error Handling

- Use custom error classes with descriptive messages
- Provide actionable error information
- Log errors appropriately for debugging

```typescript
// ✅ Good error handling
export class OptimizationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OptimizationError";
  }
}

// Usage
if (!isValidInput(input)) {
  throw new OptimizationError(
    "Invalid CSS input: missing required properties",
    "INVALID_INPUT",
  );
}
```

### Performance Considerations

- Profile performance-critical code paths
- Use efficient algorithms for CSS processing
- Implement proper caching where appropriate
- Monitor memory usage in long-running operations

## 🧪 Testing Guidelines

### Testing Strategy

Our testing approach ensures reliability across different use cases:

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test component interactions
- **CLI Tests**: Test command-line interface behavior
- **Performance Tests**: Validate optimization performance

### Test Structure

```typescript
// test file: src/utils/cssParser.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { CssParser } from "./cssParser.js";

describe("CssParser", () => {
  let parser: CssParser;

  beforeEach(() => {
    parser = new CssParser({
      optimizationLevel: 2,
    });
  });

  describe("parseClasses", () => {
    it("should extract Tailwind classes from CSS content", () => {
      const css = ".bg-blue-500 { background-color: blue; }";
      const result = parser.parseClasses(css);

      expect(result).toEqual(["bg-blue-500"]);
    });

    it("should handle malformed CSS gracefully", () => {
      const malformedCss = ".bg-blue-500 { background-color: blue";
      const result = parser.parseClasses(malformedCss);

      expect(result).toEqual([]);
    });
  });
});
```

### Coverage Requirements

- **Minimum Coverage**: 80% overall, 90% for core optimization logic
- **Critical Paths**: 95% coverage for CSS processing and file operations
- **New Features**: All new code must include comprehensive tests

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test cssParser

# Run tests in interactive UI
pnpm test:ui
```

### Test Best Practices

- Write descriptive test names that explain the expected behavior
- Use the AAA pattern (Arrange, Act, Assert)
- Test both success and failure scenarios
- Mock external dependencies appropriately
- Use fixtures for complex test data

## 📝 Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature or enhancement
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (not affecting functionality)
- `refactor`: Code restructuring without functional changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependency updates, etc.

### Examples

```bash
# New feature
git commit -m "feat(optimizer): add CSS chunking strategy"

# Bug fix
git commit -m "fix(parser): handle nested CSS selectors correctly"

# Documentation
git commit -m "docs: update API documentation for new features"

# Breaking change
git commit -m "feat!: redesign configuration API

BREAKING CHANGE: Configuration format has changed.
See MIGRATION.md for upgrade instructions."
```

## 🔄 Pull Request Process

### Before Submitting

1. **Ensure Code Quality**

   ```bash
   pnpm lint
   pnpm type-check
   pnpm test
   pnpm format:check
   ```

2. **Update Documentation**

   - Update README if adding new features
   - Add/update JSDoc comments for public APIs
   - Update type definitions if needed

3. **Add Changeset** (for user-facing changes)
   ```bash
   pnpm changeset
   ```

### PR Template Checklist

When creating a PR, ensure you address:

- [ ] **Description**: Clear description of changes and motivation
- [ ] **Type**: Bug fix, feature, documentation, etc.
- [ ] **Testing**: All tests pass, new tests added if needed
- [ ] **Documentation**: Updated relevant documentation
- [ ] **Breaking Changes**: Called out with migration guide
- [ ] **Changeset**: Added for user-facing changes

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer approval required
3. **Testing**: Verify functionality works as described
4. **Documentation**: Ensure changes are properly documented

## 🐛 Issue Reporting

### Before Reporting

1. **Search Existing Issues**: Check if the issue already exists
2. **Verify Bug**: Confirm the issue is reproducible
3. **Minimal Reproduction**: Create the smallest possible example

### Bug Reports

Use the bug report template and include:

- **Environment Details**: Node.js version, OS, package versions
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Reproduction Steps**: Clear steps to reproduce
- **Code Examples**: Minimal reproducible code
- **Error Messages**: Full error messages and stack traces

### Feature Requests

Use the feature request template and include:

- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other solutions considered
- **Use Cases**: Real-world scenarios where this is needed

## 👥 Code Review Guidelines

### As a Reviewer

- **Be Constructive**: Provide actionable feedback
- **Focus on Code Quality**: Maintainability, performance, correctness
- **Security**: Check for potential security issues
- **Test Coverage**: Ensure adequate testing
- **Documentation**: Verify public APIs are documented

### Review Checklist

- [ ] **Functionality**: Does the code work as intended?
- [ ] **Tests**: Are there sufficient tests with good coverage?
- [ ] **Performance**: Are there any performance concerns?
- [ ] **Security**: Are there potential security vulnerabilities?
- [ ] **Style**: Does the code follow project conventions?
- [ ] **Documentation**: Is the code and changes well-documented?

## 🚀 Release Process

### Changesets Workflow

1. **Create Changeset**

   ```bash
   pnpm changeset
   ```

2. **Select Change Type**

   - `major`: Breaking changes
   - `minor`: New features (backward compatible)
   - `patch`: Bug fixes

3. **Version and Release**
   ```bash
   pnpm version    # Creates version PR
   pnpm release    # Publishes to npm
   ```

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] Changelog reviewed
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)

## 🤝 Community Guidelines

### Code of Conduct

- **Be Respectful**: Treat all contributors with respect
- **Be Inclusive**: Welcome developers of all skill levels
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Remember that everyone is learning

### Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community discussion
- **Code Review**: For specific code-related questions

### Recognition

We value all contributions, including:

- Code contributions (features, bug fixes, optimizations)
- Documentation improvements
- Bug reports and testing
- Community support and discussions
- Performance benchmarking and optimization suggestions

## 📚 Additional Resources

- [Project README](./README.md)
- [API Documentation](./docs/api.md)
- [Performance Guide](./docs/performance.md)
- [Migration Guide](./docs/migration.md)
- [Conventional Commits](https://conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

Thank you for contributing to Tailwind Enigma Core! Your contributions help make CSS optimization more efficient and accessible for developers worldwide. 🎉
