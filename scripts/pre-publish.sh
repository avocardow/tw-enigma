#!/bin/bash
# scripts/pre-publish.sh
# Pre-publish validation script for tw-enigma packages

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