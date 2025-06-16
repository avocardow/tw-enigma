#!/bin/bash

# Fix test file import paths to match actual file locations
echo "Fixing test file import paths..."

# Fix configValidation.test.ts imports
sed -i '' 's|from '"'"'../src/configValidator.ts'"'"'|from '"'"'../src/config/configValidator.ts'"'"'|g' tests/configValidation.test.ts
sed -i '' 's|from '"'"'../src/runtimeValidator.ts'"'"'|from '"'"'../src/config/runtimeValidator.ts'"'"'|g' tests/configValidation.test.ts
sed -i '' 's|from '"'"'../src/configWatcher.ts'"'"'|from '"'"'../src/config/configWatcher.ts'"'"'|g' tests/configValidation.test.ts
sed -i '' 's|from '"'"'../src/configDefaults.ts'"'"'|from '"'"'../src/config/configDefaults.ts'"'"'|g' tests/configValidation.test.ts
sed -i '' 's|from '"'"'../src/configMigration.ts'"'"'|from '"'"'../src/config/configMigration.ts'"'"'|g' tests/configValidation.test.ts
sed -i '' 's|from '"'"'../src/performanceValidator.ts'"'"'|from '"'"'../src/config/performanceValidator.ts'"'"'|g' tests/configValidation.test.ts
sed -i '' 's|from '"'"'../src/configBackup.ts'"'"'|from '"'"'../src/config/configBackup.ts'"'"'|g' tests/configValidation.test.ts
sed -i '' 's|from '"'"'../src/config.ts'"'"'|from '"'"'../src/config/index.ts'"'"'|g' tests/configValidation.test.ts

# Fix optimizationCache.test.ts imports
sed -i '' 's|from '"'"'../src/optimizationCache.ts'"'"'|from '"'"'../src/engine/optimizationCache.ts'"'"'|g' tests/optimizationCache.test.ts

# Fix pathUtils.test.ts imports
sed -i '' 's|from '"'"'../src/pathUtils'"'"'|from '"'"'../src/utils/pathUtils'"'"'|g' tests/pathUtils.test.ts

echo "Test file import paths fixed!" 