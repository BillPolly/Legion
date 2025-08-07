#!/bin/bash

# Script to update all references from aiur-ui-clean to aiur-ui

echo "Updating all references from aiur-ui-clean to aiur-ui..."

# Update JavaScript file imports
find . -name "*.js" -type f -not -path "*/node_modules/*" -exec grep -l "aiur-ui-clean" {} \; | while read file; do
    echo "Updating JS file: $file"
    sed -i '' 's/aiur-ui-clean/aiur-ui/g' "$file"
done

# Update package.json references
find . -name "package.json" -type f -not -path "*/node_modules/*" -exec grep -l "@legion/aiur-ui-clean" {} \; | while read file; do
    echo "Updating package.json: $file"
    sed -i '' 's/@legion\/aiur-ui-clean/@legion\/aiur-ui/g' "$file"
done

echo "Done updating references!"