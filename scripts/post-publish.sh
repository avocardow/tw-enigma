#!/bin/bash
# scripts/post-publish.sh
# Post-publish verification script for tw-enigma packages

set -e

echo "🔍 Running post-publish verification..."

# Wait for npm propagation
echo "⏱️ Waiting for npm propagation..."
sleep 30

# Verify package availability
echo "📦 Verifying @tw-enigma/core..."
npm view @tw-enigma/core

echo "📦 Verifying @tw-enigma/cli..."
npm view @tw-enigma/cli

# Test installation
echo "🧪 Testing fresh installation..."
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"
npm init -y > /dev/null 2>&1
npm install @tw-enigma/core @tw-enigma/cli

echo "✅ Post-publish verification complete!"

# Cleanup
cd - > /dev/null
rm -rf "$TEMP_DIR" 