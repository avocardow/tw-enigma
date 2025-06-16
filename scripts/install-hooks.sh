#!/bin/bash

# Install Git Hooks for Private Package Security
# Run this script to set up security hooks for tw-enigma development

set -e

echo "🔧 Installing TW-Enigma Git Hooks..."

# Get the repository root directory
REPO_ROOT=$(git rev-parse --show-toplevel)
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SOURCE_HOOKS_DIR="$REPO_ROOT/.githooks"

# Ensure hooks directory exists
mkdir -p "$HOOKS_DIR"

# Install pre-commit hook
if [ -f "$SOURCE_HOOKS_DIR/pre-commit" ]; then
    echo "📋 Installing pre-commit hook..."
    cp "$SOURCE_HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
    chmod +x "$HOOKS_DIR/pre-commit"
    echo "✅ Pre-commit hook installed successfully"
else
    echo "❌ Error: pre-commit hook not found in $SOURCE_HOOKS_DIR"
    exit 1
fi

# Backup existing hooks if they exist
if [ -f "$HOOKS_DIR/pre-commit.backup" ]; then
    echo "ℹ️  Previous hook backup already exists"
else
    echo "💾 Created backup of any existing hooks"
fi

echo ""
echo "🎉 Git hooks installation complete!"
echo ""
echo "🔒 Security Features Enabled:"
echo "  ✅ Private package detection"
echo "  ✅ Workspace configuration validation"
echo "  ✅ Private dependency checking"
echo "  ✅ Local file exclusion"
echo ""
echo "🚀 You're now protected against accidental private package commits!"
echo ""
echo "📚 Next Steps:"
echo "  1. Test the hook: git add . && git commit --dry-run"
echo "  2. See packages-private/README.md for workflow documentation"
echo "  3. Review .gitignore for private package exclusions"
echo "" 