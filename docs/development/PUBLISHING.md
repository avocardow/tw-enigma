# Publishing and Release Workflows

> Comprehensive guide for publishing, versioning, and maintaining the tw-enigma packages

## 📋 Table of Contents

- [Overview](#overview)
- [Package Publishing](#package-publishing)
- [Release Process](#release-process)
- [Version Management](#version-management)
- [Automation Workflows](#automation-workflows)
- [Quality Gates](#quality-gates)
- [Emergency Procedures](#emergency-procedures)
- [Maintenance Tasks](#maintenance-tasks)

## 🚀 Overview

The tw-enigma project uses a monorepo structure with two main packages:

- `@tw-enigma/core` - Core optimization engine
- `@tw-enigma/cli` - Command-line interface

This document outlines the complete workflow for publishing, versioning, and maintaining these packages.

## 📦 Package Publishing

### Prerequisites

Before publishing packages, ensure you have:

1. **NPM Access**: Proper npm registry access for the `@tw-enigma` scope
2. **Authentication**: Valid npm token configured locally
3. **Permissions**: Maintainer or owner permissions for the packages
4. **Environment**: Clean workspace with all tests passing

### Authentication Setup

```bash
# Login to npm registry
npm login

# Verify authentication
npm whoami

# Set registry for scoped packages (if using private registry)
npm config set @tw-enigma:registry https://registry.npmjs.org/
```

### Publishing Individual Packages

#### Core Package (`@tw-enigma/core`)

```bash
# Navigate to core package
cd packages/core

# Verify package contents
npm pack --dry-run

# Publish to npm
npm publish --access public

# Verify publication
npm view @tw-enigma/core
```

#### CLI Package (`@tw-enigma/cli`)

```bash
# Navigate to CLI package
cd packages/cli

# Verify package contents
npm pack --dry-run

# Publish to npm
npm publish --access public

# Verify publication
npm view @tw-enigma/cli
```

### Batch Publishing with Turbo

```bash
# Build all packages
pnpm build

# Run pre-publish checks
pnpm test
pnpm lint
pnpm type-check

# Publish all packages
pnpm --filter "./packages/*" publish --access public
```

## 🔄 Release Process

### Pre-Release Checklist

- [ ] **All tests passing**: Ensure 100% test success rate
- [ ] **Build verification**: All packages build successfully
- [ ] **Dependency audit**: No security vulnerabilities
- [ ] **Documentation updated**: READMEs, changelogs, and examples current
- [ ] **Version bumped**: Semantic versioning applied correctly
- [ ] **Quality gates**: All linting and type checking passes

### Release Steps

#### 1. Version Preparation

```bash
# Update package versions
pnpm changeset version

# Review version changes
git diff

# Commit version updates
git add .
git commit -m "chore: bump package versions"
```

#### 2. Pre-Release Validation

```bash
# Full test suite
pnpm test

# Build verification
pnpm build

# Dependency security audit
pnpm audit

# Type checking
pnpm type-check

# Linting verification
pnpm lint
```

#### 3. Release Execution

```bash
# Create release tag
git tag v$(node -p "require('./package.json').version")

# Push changes and tags
git push origin main --tags

# Publish packages
pnpm changeset publish
```

#### 4. Post-Release Tasks

```bash
# Verify package availability
npm view @tw-enigma/core
npm view @tw-enigma/cli

# Update documentation if needed
# Create GitHub release with changelog
# Notify users via appropriate channels
```

## 📊 Version Management

### Semantic Versioning

The project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (`x.0.0`): Breaking changes
- **MINOR** (`0.x.0`): New features, backward compatible
- **PATCH** (`0.0.x`): Bug fixes, backward compatible

### Changesets Workflow

```bash
# Add changeset for new feature
pnpm changeset add

# Add changeset for bug fix
pnpm changeset add

# Add changeset for breaking change
pnpm changeset add
```

### Version Coordination

Both packages should maintain compatible versions:

```json
{
  "@tw-enigma/core": "1.2.3",
  "@tw-enigma/cli": "1.2.3"
}
```

### Pre-release Versions

For testing and beta releases:

```bash
# Create pre-release version
pnpm changeset version --snapshot beta

# Publish pre-release
pnpm changeset publish --tag beta
```

## 🤖 Automation Workflows

### GitHub Actions Setup

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Run tests
        run: pnpm test

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          commit: 'chore: release packages'
          title: 'chore: release packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Automated Quality Checks

```yaml
# .github/workflows/quality.yml
name: Quality Checks

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
      - run: pnpm build
```

### Security Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly
  push:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm audit
      - run: pnpm audit --audit-level moderate
```

## 🛡️ Quality Gates

### Pre-Publish Validation

```bash
#!/bin/bash
# scripts/pre-publish.sh

set -e

echo "🔍 Running pre-publish validation..."

# Type checking
echo "📝 Type checking..."
pnpm type-check

# Linting
echo "🧹 Linting..."
pnpm lint

# Testing
echo "🧪 Running tests..."
pnpm test

# Build verification
echo "🏗️ Building packages..."
pnpm build

# Security audit
echo "🔒 Security audit..."
pnpm audit --audit-level moderate

# Package validation
echo "📦 Validating packages..."
pnpm --filter "./packages/*" pack --dry-run

echo "✅ Pre-publish validation complete!"
```

### Post-Publish Verification

```bash
#!/bin/bash
# scripts/post-publish.sh

set -e

echo "🔍 Running post-publish verification..."

# Wait for npm propagation
sleep 30

# Verify package availability
echo "📦 Verifying @tw-enigma/core..."
npm view @tw-enigma/core

echo "📦 Verifying @tw-enigma/cli..."
npm view @tw-enigma/cli

# Test installation
echo "🧪 Testing fresh installation..."
mkdir -p /tmp/test-install
cd /tmp/test-install
npm init -y
npm install @tw-enigma/core @tw-enigma/cli

echo "✅ Post-publish verification complete!"
```

## 🚨 Emergency Procedures

### Package Withdrawal

If a critical issue is discovered after publishing:

```bash
# Deprecate specific version
npm deprecate @tw-enigma/core@1.2.3 "Critical bug - use 1.2.4 instead"

# Unpublish (only within 72 hours)
npm unpublish @tw-enigma/core@1.2.3
```

### Hotfix Release

For critical security fixes:

```bash
# Create hotfix branch
git checkout -b hotfix/security-fix

# Make minimal fix
# ... edit files ...

# Test thoroughly
pnpm test

# Create emergency changeset
pnpm changeset add

# Version and publish immediately
pnpm changeset version
pnpm changeset publish

# Create GitHub release
gh release create v1.2.4 --title "Security Hotfix v1.2.4" --notes "Critical security fix"
```

### Communication Template

````markdown
# Emergency Release Notice

## Issue

[Brief description of the critical issue]

## Affected Versions

- @tw-enigma/core: v1.2.0 - v1.2.3
- @tw-enigma/cli: v1.2.0 - v1.2.3

## Resolution

- Updated packages to v1.2.4
- [Brief description of fix]

## Action Required

Please update immediately:

```bash
npm update @tw-enigma/core @tw-enigma/cli
```
````

## Impact

[Description of security/functionality impact]

````

## 🔧 Maintenance Tasks

### Regular Maintenance Schedule

#### Weekly Tasks
- [ ] **Dependency Updates**: Check for package updates
- [ ] **Security Audit**: Run security scans
- [ ] **Test Suite**: Verify all tests passing
- [ ] **Performance**: Monitor package sizes and performance

#### Monthly Tasks
- [ ] **Major Dependency Updates**: Update major versions carefully
- [ ] **Documentation Review**: Update docs for accuracy
- [ ] **Analytics Review**: Check download statistics and usage
- [ ] **Issue Triage**: Address community issues and PRs

#### Quarterly Tasks
- [ ] **Architecture Review**: Assess system design decisions
- [ ] **Performance Optimization**: Identify optimization opportunities
- [ ] **User Feedback**: Gather and analyze user feedback
- [ ] **Roadmap Planning**: Plan next quarter features

### Dependency Management

```bash
# Check for outdated dependencies
pnpm outdated

# Update dependencies interactively
pnpm update -i

# Update specific dependency
pnpm update @types/node

# Check for security vulnerabilities
pnpm audit

# Fix security issues automatically
pnpm audit --fix
````

### Performance Monitoring

```bash
# Monitor package sizes
pnpm --filter "./packages/*" exec npm pack --dry-run

# Bundle analysis
pnpm build:analyze

# Performance benchmarks
pnpm test:perf

# Memory usage analysis
pnpm test:memory
```

### Documentation Maintenance

```bash
# Update API documentation
pnpm docs:generate

# Update changelog
pnpm changeset

# Validate documentation links
pnpm docs:validate

# Generate updated examples
pnpm examples:update
```

## 📊 Metrics and Analytics

### Publishing Metrics

Track the following metrics:

- **Release Frequency**: Target monthly releases
- **Time to Release**: From changeset to published
- **Quality Gates**: Success rate of pre-publish checks
- **Download Statistics**: NPM download counts

### Quality Metrics

Monitor these quality indicators:

- **Test Coverage**: Maintain >90% coverage
- **Bug Reports**: Track issues per release
- **Breaking Changes**: Minimize breaking changes
- **Security Vulnerabilities**: Zero tolerance policy

### Performance Metrics

Benchmark performance regularly:

- **Package Size**: Monitor bundle size growth
- **Installation Time**: Track npm install performance
- **Build Time**: Monitor CI/CD pipeline performance
- **Memory Usage**: Track memory consumption

## 🤝 Team Workflows

### Release Responsibility

#### Release Manager

- Coordinates release timeline
- Ensures quality gates pass
- Manages emergency releases
- Communicates with stakeholders

#### Package Maintainers

- Review and approve changes
- Write and maintain changelogs
- Handle community feedback
- Monitor package health

#### Contributors

- Follow contribution guidelines
- Add appropriate changesets
- Ensure tests pass
- Update documentation

### Communication Channels

- **Internal**: Team slack/discord for coordination
- **Community**: GitHub discussions for community
- **Announcements**: GitHub releases for major updates
- **Support**: GitHub issues for bug reports

## 📚 Resources

### Tools and Services

- [Changesets](https://github.com/changesets/changesets) - Version management
- [GitHub Actions](https://github.com/features/actions) - CI/CD automation
- [npm](https://www.npmjs.com/) - Package registry
- [Semantic Versioning](https://semver.org/) - Versioning standard

### Documentation

- [Contributing Guidelines](./CONTRIBUTING.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Package READMEs](./packages/)
- [Examples](./examples/)

### Support

- [GitHub Issues](https://github.com/avocardow/tw-enigma/issues)
- [GitHub Discussions](https://github.com/avocardow/tw-enigma/discussions)
- [Package Health](https://snyk.io/advisor/npm-package/@tw-enigma/core)

---

<div align="center">
  <p>📚 Part of the <a href="./">tw-enigma documentation</a></p>
  <p>For questions about publishing workflows, please open a <a href="https://github.com/avocardow/tw-enigma/discussions">discussion</a></p>
</div>
