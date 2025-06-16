#!/bin/bash

# Script to update imports in core package tests
# Updates relative imports to use @tw-enigma/core package

echo "Updating imports in core package tests..."

# Find all test files in packages/core/tests
find packages/core/tests -name "*.test.ts" -type f | while read -r file; do
    echo "Processing: $file"
    
    # Update imports from "../src/" to "@tw-enigma/core"
    sed -i '' 's|from "../src/\([^"]*\)\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "\.\./\.\./src/\([^"]*\)\.ts"|from "@tw-enigma/core"|g' "$file"
    sed -i '' 's|from "\.\./\.\./\.\./src/\([^"]*\)\.ts"|from "@tw-enigma/core"|g' "$file"
    
    # Update type-only imports
    sed -i '' 's|} from "../src/\([^"]*\)\.ts";|} from "@tw-enigma/core";|g' "$file"
    sed -i '' 's|} from "\.\./\.\./src/\([^"]*\)\.ts";|} from "@tw-enigma/core";|g' "$file"
    sed -i '' 's|} from "\.\./\.\./\.\./src/\([^"]*\)\.ts";|} from "@tw-enigma/core";|g' "$file"
    
    echo "Updated: $file"
done

echo "Import updates completed for core package tests." 