#!/bin/bash

# Get all files with _error issues and replace unused ones with _
files=$(npm run lint 2>&1 | grep -B1 "error.*_error.*never used" | grep "^/" | sort -u)

for file in $files; do
    echo "Processing final _error fixes in: $file"
    
    # Replace all remaining _error with _ since they are reported as unused
    sed -i '' 's/} catch (_error) {/} catch (_) {/g' "$file"
    sed -i '' 's/) catch (_error) {/) catch (_) {/g' "$file"
    sed -i '' 's/const _error =/const _ =/g' "$file"
    sed -i '' 's/let _error =/let _ =/g' "$file"
    sed -i '' 's/var _error =/var _ =/g' "$file"
    
    # Also handle function parameters and other patterns
    sed -i '' 's/(_error)/(\_)/g' "$file"
    sed -i '' 's/(_error:/(\_:/g' "$file"
done

echo "Applied final _error fixes"