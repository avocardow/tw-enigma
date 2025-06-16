#!/bin/bash

# Fix atomicOps imports to point to correct location
echo "Fixing atomicOps imports..."

# Fix imports from ../types/atomicOps to ../types/legacy/atomicOps
sed -i '' 's|from "../types/atomicOps"|from "../types/legacy/atomicOps"|g' src/atomicOps/AtomicPermissionManager.ts
sed -i '' 's|from "../types/atomicOps"|from "../types/legacy/atomicOps"|g' src/atomicOps/AtomicFileCreator.ts
sed -i '' 's|from "../types/atomicOps"|from "../types/legacy/atomicOps"|g' src/atomicOps/AtomicFileWriter.ts
sed -i '' 's|from "../types/atomicOps"|from "../types/legacy/atomicOps"|g' src/atomicOps/AtomicFileReader.ts
sed -i '' 's|from "../types/atomicOps"|from "../types/legacy/atomicOps"|g' src/atomicOps/AtomicFileManager.ts
sed -i '' 's|from "../types/atomicOps"|from "../types/legacy/atomicOps"|g' src/atomicOps/index.ts
sed -i '' 's|from "../types/atomicOps"|from "../types/legacy/atomicOps"|g' src/atomicOps/AtomicRollbackManager.ts

echo "AtomicOps imports fixed!" 