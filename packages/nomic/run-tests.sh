#!/bin/bash

echo "=================================================="
echo "Running Nomic Embeddings Tests"
echo "=================================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Failed to install dependencies"
        exit 1
    fi
fi

# Check if model file exists
if [ ! -f "models/nomic-embed-text-v1.5.Q2_K.gguf" ]; then
    echo "ERROR: Model file not found!"
    echo "Expected: models/nomic-embed-text-v1.5.Q2_K.gguf"
    exit 1
fi

echo "Model file found: models/nomic-embed-text-v1.5.Q2_K.gguf"
echo ""

# Run the tests
echo "Running Jest tests..."
NODE_OPTIONS='--experimental-vm-modules' npm test

# Check test result
if [ $? -eq 0 ]; then
    echo ""
    echo "=================================================="
    echo "✅ ALL TESTS PASSED!"
    echo "=================================================="
else
    echo ""
    echo "=================================================="
    echo "❌ TESTS FAILED!"
    echo "=================================================="
    exit 1
fi