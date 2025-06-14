#!/bin/bash

# Script to fix _error variable issues systematically
files=$(npm run lint 2>&1 | grep -B1 "error.*_error.*never used" | grep "^/" | sort -u)

for file in $files; do
    echo "Processing: $file"
    
    # Use sed to replace } catch (_error) { with } catch (error) { only when error is used
    # This is a simpler approach - we'll replace all and rely on ESLint to tell us about unused ones
    sed -i '' 's/} catch (_error) {/} catch (error) {/g' "$file"
    
    # Also handle catch blocks with newlines
    perl -i -pe 's/\} catch \(_error\) \{/} catch (error) {/g' "$file"
done

echo "Fixed _error variables in files"