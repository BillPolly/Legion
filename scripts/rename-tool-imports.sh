#!/bin/bash

# Script to update all imports from @legion/tool-system to @legion/tools

echo "Updating imports from @legion/tool-system to @legion/tools..."

# Find all JavaScript files that import from @legion/tool-system
find packages -name "*.js" -type f -not -path "*/node_modules/*" -exec grep -l "@legion/tool-system" {} \; | while read file; do
    echo "Updating: $file"
    # Replace the import
    sed -i '' 's/@legion\/tool-system/@legion\/tools/g' "$file"
done

# Find all package.json files that depend on @legion/tool-system
find packages -name "package.json" -type f -not -path "*/node_modules/*" -exec grep -l "@legion/tool-system" {} \; | while read file; do
    echo "Updating package.json: $file"
    # Replace the dependency
    sed -i '' 's/"@legion\/tool-system"/"@legion\/tools"/g' "$file"
done

echo "Done updating imports!"