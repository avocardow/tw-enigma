#!/bin/bash

# Fix remaining logger imports in core package
echo "Fixing remaining logger imports..."

# Files that import from "../logger" and need to import from "../utils/logger"
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/types/legacy/plugins.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/security/pluginSandbox.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/marketplace/pluginMarketplace.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/debugging/pluginDebugger.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/utils/legacy/index.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/errorHandler/errorHandler.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/errorHandler/types.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/errorHandler/circuitBreaker.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/errorHandler/pluginErrorHandler.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/errorHandler/index.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/registry/pluginRegistry.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/templates/pluginTemplate.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/templates/postcssPluginTemplate.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/performance/profiler.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/performance/streamOptimizer.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/performance/workerManager.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/performance/batchCoordinator.ts
sed -i '' 's|from "../logger"|from "../utils/logger"|g' src/engine/core/postcssPlugin.ts

echo "Remaining logger imports fixed!" 