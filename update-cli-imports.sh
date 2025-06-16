#!/bin/bash

# Script to update imports in CLI package tests
# Updates relative imports to use @tw-enigma/cli and @tw-enigma/core packages

echo "Updating imports in CLI package tests..."

# Find all test files in packages/cli/tests
find packages/cli/tests -name "*.test.ts" -type f | while read -r file; do
    echo "Processing: $file"
    
    # Update CLI-specific imports to @tw-enigma/cli
    sed -i '' 's|from "../src/\([^"]*\)\.ts"|from "@tw-enigma/cli"|g' "$file"
    sed -i '' 's|from "\.\./\.\./src/\([^"]*\)\.ts"|from "@tw-enigma/cli"|g' "$file"
    sed -i '' 's|from "\.\./\.\./\.\./src/\([^"]*\)\.ts"|from "@tw-enigma/cli"|g' "$file"
    
    # Update core functionality imports to @tw-enigma/core
    # Look for imports that are likely core functionality
    sed -i '' 's|from "../src/cssGeneration\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/patternAnalysis\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/nameGeneration\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/htmlExtractor\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/jsExtractor\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/fileDiscovery\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/pathUtils\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/config\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/logger\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "../src/errorHandler\.ts"|from "@tw-enigma/core"|g' "$file"
    
    # Update type-only imports
    sed -i '' 's|} from "../src/\([^"]*\)\.ts";|} from "@tw-enigma/cli";|g' "$file"
    sed -i '' 's|} from "\.\./\.\./src/\([^"]*\)\.ts";|} from "@tw-enigma/cli";|g' "$file"
    sed -i '' 's|} from "\.\./\.\./\.\./src/\([^"]*\)\.ts";|} from "@tw-enigma/cli";|g' "$file"
    
    echo "Updated: $file"
done

echo "Import updates completed for CLI package tests." 