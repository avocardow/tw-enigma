# Changeset Workflow Guide

This document explains how to use changesets for versioning and releasing packages in the tw-enigma monorepo.

## 📋 Table of Contents

- [Overview](#overview)
- [Creating Changesets](#creating-changesets)
- [Release Process](#release-process)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🔄 Overview

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing of our packages. Changesets provide:

- **Semantic Versioning**: Automatic version bumping based on change type
- **Linked Releases**: Coordinated releases across related packages
- **GitHub Integration**: Rich changelogs with PR links and contributors
- **Automated Publishing**: CI/CD integration for seamless releases

### Package Structure

```
tw-enigma/
├── packages/
│   ├── core/           # @tw-enigma/core
│   └── cli/            # @tw-enigma/cli
└── .changeset/         # Changeset configuration and files
```

## ✏️ Creating Changesets

### When to Create a Changeset

Create a changeset when you:
- ✅ Add new features to a package
- ✅ Fix bugs in package code
- ✅ Make breaking changes to APIs
- ✅ Update package dependencies that affect functionality
- ❌ Update documentation only
- ❌ Fix typos or formatting
- ❌ Update development dependencies that don't affect package output

### How to Create a Changeset

1. **Make your changes** to the packages

2. **Run the changeset command**:
   ```bash
   pnpm changeset
   ```

3. **Select packages** that were changed:
   - Use space to select/deselect packages
   - Use arrow keys to navigate
   - Press enter to continue

4. **Choose change type**:
   - **patch**: Bug fixes, small improvements (0.0.X)
   - **minor**: New features, non-breaking changes (0.X.0)
   - **major**: Breaking changes (X.0.0)

5. **Write a summary** of your changes:
   - Be descriptive and clear
   - Focus on user-facing changes
   - Use present tense ("Add feature X" not "Added feature X")

6. **Commit the changeset file**:
   ```bash
   git add .changeset/[generated-filename].md
   git commit -m "feat: add changeset for feature X"
   ```

### Changeset Format

Changesets are markdown files with frontmatter:

```markdown
---
"@tw-enigma/core": minor
"@tw-enigma/cli": patch
---

Add new CSS optimization algorithm that reduces bundle size by 15%

This improvement includes:
- Enhanced class detection patterns
- Better duplicate class removal
- Improved minification strategies
```

## 🚀 Release Process

### Automatic Releases (Recommended)

1. **Merge PR with changesets** to main branch
2. **CI automatically detects** changesets and triggers release workflow
3. **Release workflow**:
   - Validates changesets
   - Runs tests
   - Builds packages
   - Versions packages
   - Publishes to npm
   - Creates GitHub release
   - Updates changelogs

### Manual Releases

For emergency releases or special cases:

1. **Navigate to Actions tab** in GitHub
2. **Select "Release" workflow**
3. **Click "Run workflow"**
4. **Choose release type**:
   - `auto`: Use existing changesets
   - `patch`: Force patch release
   - `minor`: Force minor release
   - `major`: Force major release
5. **Optionally skip tests** (emergency only)

### Local Release (Development)

```bash
# Version packages based on changesets
pnpm version

# Build and publish
pnpm release
```

## 🤖 CI/CD Integration

### Workflows

#### 1. **Changeset PR Management** (`.github/workflows/changeset-pr.yml`)
- **Trigger**: Pull requests to main
- **Purpose**: Validate changesets, preview releases, auto-label PRs
- **Features**:
  - Changeset validation
  - Release impact preview
  - Automatic PR labeling
  - Skip changeset option with `skip-changeset` label

#### 2. **Release Workflow** (`.github/workflows/release.yml`)
- **Trigger**: Push to main, manual dispatch
- **Purpose**: Automated versioning and publishing
- **Steps**:
  1. Validate release preconditions
  2. Run tests (optional skip for emergencies)
  3. Build release artifacts
  4. Version and publish packages
  5. Create GitHub release
  6. Post-release cleanup

### Required Secrets

Configure these in GitHub repository settings:

```bash
NPM_TOKEN          # npm authentication token
GITHUB_TOKEN       # Automatically provided by GitHub
TURBO_TOKEN        # Optional: Turborepo remote caching
```

### Environment Variables

```bash
TURBO_TEAM         # Optional: Turborepo team name
```

## 🎯 Best Practices

### Changeset Guidelines

1. **One changeset per PR**: Keep changes focused
2. **Descriptive summaries**: Help users understand changes
3. **Appropriate versioning**: Follow semantic versioning principles
4. **Review before merge**: Ensure changesets accurately reflect changes

### Version Strategy

- **patch** (0.0.X): Bug fixes, performance improvements, documentation
- **minor** (0.X.0): New features, new options, deprecations
- **major** (X.0.0): Breaking changes, removed features, API changes

### Linked Releases

Our packages are configured as linked, meaning:
- Both packages get the same version number
- Releases are coordinated
- Maintains compatibility between CLI and core

### Package Dependencies

When updating dependencies:
- **Internal dependencies**: Use `updateInternalDependencies: "patch"`
- **External dependencies**: Create changesets for significant updates
- **Dev dependencies**: Usually don't require changesets

## 🐛 Troubleshooting

### Common Issues

#### "No changesets found"
```bash
# If you forgot to add a changeset:
pnpm changeset add
```

#### "Version already exists on npm"
```bash
# Check current versions:
npm view @tw-enigma/core versions --json
npm view @tw-enigma/cli versions --json

# Force version bump if needed:
pnpm changeset version --ignore-private
```

#### "Permission denied to npm"
```bash
# Check npm authentication:
npm whoami

# Login if needed:
npm login

# Check package access:
npm access list packages @tw-enigma/core
```

#### "Changeset validation failed"
- Ensure changeset files have proper frontmatter
- Check package names are correct
- Verify bump types are valid (patch/minor/major)

### Manual Intervention

#### Skip Changeset Requirement
Add `skip-changeset` label to PR if:
- Only documentation changes
- Only development tool updates
- CI/CD configuration changes

#### Emergency Release
1. Use manual workflow dispatch
2. Select appropriate version bump
3. Consider skipping tests if critical

#### Rollback Release
```bash
# Deprecate problematic version:
npm deprecate @tw-enigma/core@1.2.3 "Version deprecated due to critical issue"

# Publish hotfix:
pnpm changeset add
# Select patch, describe fix
pnpm version && pnpm release
```

## 📚 Additional Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Semantic Versioning Guide](https://semver.org/)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## 🔧 Configuration Files

### `.changeset/config.json`
- Main changeset configuration
- Controls linking, changelog generation, access levels

### GitHub Workflows
- `changeset-pr.yml`: PR validation and preview
- `release.yml`: Automated release pipeline

### Package Scripts
```json
{
  "changeset": "changeset",
  "version": "changeset version",
  "release": "pnpm build && changeset publish"
}
```

---

For questions or issues with the release process, please open an issue or contact the maintainers. 