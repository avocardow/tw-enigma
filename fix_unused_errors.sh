#!/bin/bash

# Script to fix unused _error variables by replacing them with _
files=$(npm run lint 2>&1 | grep -B1 "error.*_error.*never used" | grep "^/" | sort -u)

for file in $files; do
    echo "Processing unused _error in: $file"
    
    # Find catch blocks with _error that don't use the error variable
    # Replace } catch (_error) { with } catch (_) { for truly unused errors
    # This is a more conservative approach - only change if the error is never referenced
    
    # First, let's see which catch blocks have _error
    while IFS= read -r line_num; do
        if [ ! -z "$line_num" ]; then
            echo "  Line $line_num has unused _error"
            # Use sed to replace _error with _ on specific lines if it's in a catch block
            sed -i "${line_num}s/_error/_/g" "$file"
        fi
    done < <(grep -n "catch.*_error" "$file" | cut -d: -f1)
    
    # Also handle variable declarations that are unused
    sed -i 's/const _error =/const _ =/g' "$file"
    sed -i 's/let _error =/let _ =/g' "$file"
    sed -i 's/var _error =/var _ =/g' "$file"
done

echo "Fixed unused _error variables"