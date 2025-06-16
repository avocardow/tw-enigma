#!/bin/bash

# Fix test imports from .js to .ts files
echo "Fixing test imports from .js to .ts..."

# Find all test files and replace .js imports with .ts
find tests -name "*.test.ts" -exec sed -i '' 's|\.js'"'"';|.ts'"'"';|g' {} \;
find tests -name "*.test.ts" -exec sed -i '' 's|\.js"|.ts"|g' {} \;

echo "Test imports fixed!" 