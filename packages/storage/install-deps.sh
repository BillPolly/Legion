#!/bin/bash

# Install MongoDB dependency locally for storage package
echo "Installing MongoDB package for storage provider..."

# Create node_modules if it doesn't exist
mkdir -p node_modules

# Create a temporary package.json for installing MongoDB
cat > temp-package.json << EOF
{
  "name": "storage-deps",
  "version": "1.0.0",
  "dependencies": {
    "mongodb": "^6.10.0"
  }
}
EOF

# Install MongoDB
npm install --prefix . --package-lock=false --no-save mongodb

# Clean up
rm -f temp-package.json package-lock.json

echo "MongoDB package installed successfully!"