#!/bin/bash

# Fix logger imports in core package
echo "Fixing logger imports in core package..."

# Files in src/ root that need to import from "./utils/logger"
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/devPreview.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/postcssIntegration.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/devDashboard.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/pluginConfig.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/devExperience.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/sourceMapGenerator.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/devIdeIntegration.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/devDiagnostics.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/devDashboardEnhanced.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/devHotReload.ts
sed -i '' 's|from "./logger"|from "./utils/logger"|g' src/runtimeValidator.ts

# Files in src/config/ that need to import from "../utils/logger"
sed -i '' 's|from "./logger"|from "../utils/logger"|g' src/config/configWatcher.ts
sed -i '' 's|from "./logger"|from "../utils/logger"|g' src/config/configSafeUpdater.ts
sed -i '' 's|from "./logger"|from "../utils/logger"|g' src/config/config.ts
sed -i '' 's|from "./logger"|from "../utils/logger"|g' src/config/configValidator.ts

# Files in src/utils/ that need to import from "./logger"
sed -i '' 's|from "./logger"|from "./logger"|g' src/utils/debugUtils.ts
sed -i '' 's|from "./logger"|from "./logger"|g' src/utils/errors.ts
sed -i '' 's|from "./logger"|from "./logger"|g' src/utils/fileIntegrity.ts

echo "Logger imports fixed!" 