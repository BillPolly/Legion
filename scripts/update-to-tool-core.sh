#!/bin/bash

# Script to update all imports from @legion/tools to @legion/tool-core

echo "Updating imports from @legion/tools to @legion/tool-core..."

# Find all JavaScript files that import from @legion/tools (but not in general-tools)
find packages -name "*.js" -type f -not -path "*/node_modules/*" -not -path "*/general-tools/*" -exec grep -l "@legion/tools" {} \; | while read file; do
    echo "Updating: $file"
    # Replace the import
    sed -i '' 's/@legion\/tools/@legion\/tool-core/g' "$file"
done

# Find all package.json files that depend on @legion/tools (but not general-tools itself)
find packages -name "package.json" -type f -not -path "*/node_modules/*" -not -path "*/general-tools/package.json" -exec grep -l "@legion/tools" {} \; | while read file; do
    echo "Updating package.json: $file"
    # Replace the dependency
    sed -i '' 's/"@legion\/tools"/"@legion\/tool-core"/g' "$file"
done

echo "Done updating imports!"